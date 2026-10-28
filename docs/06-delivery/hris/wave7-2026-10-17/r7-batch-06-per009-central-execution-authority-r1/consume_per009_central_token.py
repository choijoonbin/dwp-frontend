#!/usr/bin/env python3
"""Atomically consume one PER-009 central-lane token after fail-closed validation."""

from __future__ import annotations

import sys

if not sys.flags.isolated:
    raise SystemExit("PER-009 token consumer must be invoked with /usr/bin/python3 -I")

import argparse
import hashlib
import json
import os
import pathlib
import stat
import subprocess
import types
from datetime import datetime, timedelta, timezone
from typing import Any

sys.dont_write_bytecode = True

GIT_BINARY = "/usr/bin/git"
FRONTEND_ORIGIN = "https://github.com/choijoonbin/dwp-frontend.git"


def isolated_git_environment() -> dict[str, str]:
    return {
        "LANG": "C",
        "LC_ALL": "C",
        "GIT_CONFIG_NOSYSTEM": "1",
        "GIT_CONFIG_GLOBAL": "/dev/null",
        "GIT_NO_REPLACE_OBJECTS": "1",
        "GIT_TERMINAL_PROMPT": "0",
    }


def run_git(*args: str, repository: pathlib.Path | None = None) -> subprocess.CompletedProcess[bytes]:
    command = [GIT_BINARY]
    if repository is not None:
        command.extend(["-C", str(repository)])
    command.extend(args)
    return subprocess.run(
        command,
        check=False,
        capture_output=True,
        cwd="/" if repository is None else None,
        env=isolated_git_environment(),
    )


def load_authority_validator() -> types.ModuleType:
    consumer_path = pathlib.Path(__file__).resolve()
    frontend = consumer_path.parents[5]
    validator_path = consumer_path.with_name("validate_per009_central_execution_authority.py")
    review_path = consumer_path.with_name("independent-review.v1.json")
    relative = validator_path.relative_to(frontend).as_posix()

    def pairs(items: list[tuple[str, Any]]) -> dict[str, Any]:
        value: dict[str, Any] = {}
        for key, item in items:
            if key in value:
                raise RuntimeError(f"duplicate review JSON key: {key}")
            value[key] = item
        return value

    for label, path in (
        ("consumer", consumer_path),
        ("validator", validator_path),
        ("independent review", review_path),
    ):
        info = path.lstat()
        if not stat.S_ISREG(info.st_mode) or path.is_symlink() or stat.S_IMODE(info.st_mode) != 0o644:
            raise RuntimeError(f"{label} must be a non-symlink 100644 worktree file")

    review_bytes = review_path.read_bytes()
    review = json.loads(
        review_bytes.decode("utf-8"),
        object_pairs_hook=pairs,
        parse_constant=lambda value: (_ for _ in ()).throw(RuntimeError(f"non-finite review JSON value: {value}")),
    )
    if not isinstance(review, dict):
        raise RuntimeError("independent review root must be an object")
    pins = [item for item in review.get("artifactPins", []) if isinstance(item, dict) and item.get("path") == relative]
    if len(pins) != 1:
        raise RuntimeError("independent review does not contain one validator artifact pin")
    remote = run_git("ls-remote", "--heads", FRONTEND_ORIGIN, "refs/heads/dwp-dev")
    if remote.returncode != 0:
        raise RuntimeError("authoritative Frontend dwp-dev head cannot be resolved")
    remote_lines = [line for line in remote.stdout.decode("ascii").splitlines() if line]
    if len(remote_lines) != 1 or not remote_lines[0].endswith("\trefs/heads/dwp-dev"):
        raise RuntimeError("authoritative Frontend dwp-dev head is not singular")
    remote_head = remote_lines[0].split("\t", 1)[0]
    if len(remote_head) != 40 or any(character not in "0123456789abcdef" for character in remote_head):
        raise RuntimeError("authoritative Frontend dwp-dev head is malformed")
    local_heads = []
    for ref in ("dwp-dev", "origin/dwp-dev"):
        resolved = run_git("rev-parse", "--verify", ref, repository=frontend)
        if resolved.returncode != 0:
            raise RuntimeError(f"Frontend ref cannot be resolved: {ref}")
        local_heads.append(resolved.stdout.decode("ascii").strip())
    if local_heads != [remote_head, remote_head]:
        raise RuntimeError("local Frontend refs differ from authoritative dwp-dev")

    source = validator_path.read_bytes()
    if len(source) != pins[0].get("bytes") or hashlib.sha256(source).hexdigest() != pins[0].get("sha256"):
        raise RuntimeError("validator source differs from the independent-review byte pin")
    carrier_paths = {
        relative: source,
        review_path.relative_to(frontend).as_posix(): review_bytes,
        consumer_path.relative_to(frontend).as_posix(): consumer_path.read_bytes(),
    }
    for carrier_relative, local_bytes in carrier_paths.items():
        entry = run_git("ls-tree", remote_head, "--", carrier_relative, repository=frontend)
        fields = entry.stdout.decode("utf-8").split(None, 3) if entry.returncode == 0 else []
        if len(fields) != 4 or fields[0] != "100644" or fields[1] != "blob":
            raise RuntimeError(f"carrier artifact is not a 100644 blob: {carrier_relative}")
        committed = run_git("show", f"{remote_head}:{carrier_relative}", repository=frontend)
        if committed.returncode != 0 or committed.stdout != local_bytes:
            raise RuntimeError(f"carrier artifact differs from authoritative dwp-dev: {carrier_relative}")
    module = types.ModuleType("per009_exact_authority_validator")
    module.__file__ = str(validator_path)
    exec(compile(source, str(validator_path), "exec", dont_inherit=True), module.__dict__)
    return module


authority_validator = load_authority_validator()


def fail(message: str, details: list[str] | None = None) -> int:
    print(
        json.dumps(
            {"status": "FAIL", "message": message, "details": details or []},
            ensure_ascii=False,
            indent=2,
        )
    )
    return 1


def ensure_receipt_directory(path: pathlib.Path) -> None:
    current = pathlib.Path(path.anchor)
    for part in path.parts[1:]:
        current = current / part
        info = current.lstat()
        if stat.S_ISLNK(info.st_mode):
            raise RuntimeError(f"receipt path ancestor must not be a symlink: {current}")
    if not path.is_dir() or path.is_symlink():
        raise RuntimeError(f"receipt directory is missing or unsafe: {path}")
    info = path.lstat()
    if stat.S_IMODE(info.st_mode) != 0o700 or info.st_uid != os.geteuid():
        raise RuntimeError(f"receipt directory must be current-UID 0700: {path}")


def atomic_write(path: pathlib.Path, payload: bytes) -> None:
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    descriptor = os.open(path, flags, 0o600)
    try:
        with os.fdopen(descriptor, "wb", closefd=False) as stream:
            stream.write(payload)
            stream.flush()
            os.fsync(stream.fileno())
    finally:
        os.close(descriptor)
    directory_flags = os.O_RDONLY
    if hasattr(os, "O_DIRECTORY"):
        directory_flags |= os.O_DIRECTORY
    if hasattr(os, "O_NOFOLLOW"):
        directory_flags |= os.O_NOFOLLOW
    directory_descriptor = os.open(path.parent, directory_flags)
    try:
        os.fsync(directory_descriptor)
    finally:
        os.close(directory_descriptor)


def build_receipt(lane: str, executor: str) -> tuple[pathlib.Path, dict[str, Any]]:
    backend = lane == "backend"
    phase = "backend-ready" if backend else "frontend-ready"
    failures, carrier = authority_validator.validate_phase(phase)
    if failures or carrier is None:
        raise RuntimeError(json.dumps({"phase": phase, "failures": failures}, ensure_ascii=False))

    authority = authority_validator.load(authority_validator.AUTHORITY_PATH)
    token_path = authority_validator.BACKEND_TOKEN_PATH if backend else authority_validator.FRONTEND_TOKEN_PATH
    token = authority_validator.load(token_path)
    clean_path = authority_validator.BACKEND_RECEIPT if backend else authority_validator.FRONTEND_RECEIPT
    worktree = authority_validator.BACKEND_WORKTREE if backend else authority_validator.FRONTEND_WORKTREE
    branch = authority_validator.BACKEND_LANE if backend else authority_validator.FRONTEND_LANE
    output = authority_validator.BACKEND_CONSUMPTION if backend else authority_validator.FRONTEND_CONSUMPTION
    writable = authority["sourceAllowlist"]["backendWritable" if backend else "frontendWritable"]
    carrier_commit, carrier_tree = carrier
    base_commit = authority_validator.BACKEND_BASE if backend else carrier_commit
    base_tree = authority_validator.BACKEND_TREE if backend else carrier_tree
    backend_dependency = None
    if not backend:
        dependency_failures: list[str] = []
        backend_dependency = authority_validator.validate_backend_dependency(
            carrier,
            authority,
            dependency_failures,
        )
        if dependency_failures or backend_dependency is None:
            raise RuntimeError(
                json.dumps(
                    {"phase": "frontend-backend-dependency", "failures": dependency_failures},
                    ensure_ascii=False,
                )
            )

    now = datetime.now(timezone.utc)
    deadline = now + timedelta(hours=4 if backend else 2)
    clean_failures: list[str] = []
    clean_bytes = authority_validator.secure_receipt_bytes(clean_path, clean_failures)
    if clean_failures or clean_bytes is None:
        raise RuntimeError(
            json.dumps(
                {"phase": f"{lane}-clean-receipt-read", "failures": clean_failures},
                ensure_ascii=False,
            )
        )
    receipt = {
        "schema": "dwp.hris.wave7.per009-central-token-consumption-receipt.v1",
        "state": "CONSUMED_OPERATIONAL_ONE_SHOT_WITHIN_RETAINED_RECEIPT_LEDGER_SOURCE_WRITE_AUTHORIZED_UNTIL_PROCEDURAL_DEADLINE",
        "laneId": "PER009_CENTRAL_BACKEND_V63_V273" if backend else "PER009_CENTRAL_FRONTEND_V62_V63_MIRROR",
        "tokenId": token["tokenId"],
        "jti": token["jti"],
        "tokenArtifact": authority_validator.artifact_at(
            carrier_commit,
            token_path.relative_to(authority_validator.FRONTEND).as_posix(),
        ),
        "authorityArtifact": authority_validator.artifact_at(
            carrier_commit,
            authority_validator.AUTHORITY_REL,
        ),
        "authorityCarrierCommit": carrier_commit,
        "authorityCarrierTree": carrier_tree,
        "cleanReceiptSha256": authority_validator.digest_bytes(clean_bytes),
        "allowlistSha256": authority_validator.allowlist_digest(writable),
        "repository": "dwp-backend" if backend else "dwp-frontend",
        "worktree": str(worktree),
        "branch": branch,
        "head": base_commit,
        "tree": base_tree,
        "originDwpDevAtConsumption": base_commit,
        "authoritativeOriginDwpDevAtConsumption": base_commit,
        "backendDependency": backend_dependency,
        "oneShotEnforcementScope": "CONCURRENT_REPLAY_ONLY_WHILE_CURRENT_UID_0700_RECEIPT_LEDGER_AND_0600_RECEIPT_ARE_RETAINED",
        "durableTamperResistanceProvided": False,
        "executionDeadlineSemantics": "PROCEDURAL_BOUNDED_WORK_WINDOW_ONLY",
        "consumedAt": now.isoformat(),
        "executionDeadline": deadline.isoformat(),
        "executor": executor,
    }
    return output, receipt


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("lane", choices=("backend", "frontend"))
    parser.add_argument("--executor", required=True)
    args = parser.parse_args()
    if not args.executor.strip():
        return fail("executor must be non-empty")
    expected_executor = (
        authority_validator.BACKEND_EXECUTOR
        if args.lane == "backend"
        else authority_validator.FRONTEND_EXECUTOR
    )
    if args.executor.strip() != expected_executor:
        return fail(f"executor identity must equal the lane-bound trusted identity: {expected_executor}")
    try:
        ensure_receipt_directory(authority_validator.RECEIPT_ROOT)
        output, receipt = build_receipt(args.lane, args.executor.strip())
        payload = (json.dumps(receipt, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
        if len(payload) > 65536:
            return fail("consumption receipt exceeds 65536 bytes")
        atomic_write(output, payload)
        validation_failures, _ = authority_validator.validate_phase(
            "backend-consumed" if args.lane == "backend" else "frontend-consumed"
        )
        if validation_failures:
            return fail(
                "token was consumed but terminal validation failed; the retained receipt operationally burns this token",
                validation_failures,
            )
    except FileExistsError:
        return fail("REPLAY_DENIED: consumption receipt already exists; token is already burned")
    except (OSError, RuntimeError, ValueError) as exc:
        return fail(str(exc))

    print(
        json.dumps(
            {
                "status": "PASS",
                "lane": args.lane,
                "consumptionReceipt": str(output),
                "executionDeadline": receipt["executionDeadline"],
                "replayAllowed": False,
                "maximumConsumptions": 1,
                "oneShotEnforcementScope": receipt["oneShotEnforcementScope"],
                "durableTamperResistanceProvided": False,
                "executionDeadlineSemantics": receipt["executionDeadlineSemantics"],
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
