#!/usr/bin/env python3
"""Run every active slice's closed commands at one module repository final HEAD.

This is a Control-owned capture helper, not G4 authority.  It accepts no
free-form command and publishes only a complete PASS receipt to immutable
Control intake.  Integration Control must still validate the aggregate and
append the central G4 Gate row.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import stat
import subprocess
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from host_semaphore import (
    HOST_VERIFICATION_SEMAPHORE,
    SemaphoreTimeoutError,
    active_host_semaphore_capability,
    exclusive_host_semaphore,
)
from central_transaction_fence import assert_all_central_transactions_committed
from gate_authority import assert_authoritative_gate_open
from validate_code_checkpoint import (
    Checks,
    G0,
    MODULES,
    ROOT,
    SHA40,
    canonical_argv_sha256,
    expected_command_bindings,
    git,
    parse_frontend_slice_typed_result,
    read_csv,
    reproducible_result_sha256,
    validate_command_catalog,
)
G4_CONTRACT = ROOT / "coding-readiness/g4-functional-gate-contract.v1.json"
SLICE_REGISTER = ROOT / "coding-readiness/g3-slice-code-go-register.csv"
COMMAND_CATALOG = G0 / "g3-verification-command-catalog.v1.json"
REPOSITORIES = ("DWP_BACKEND", "DWP_FRONTEND")
GATE_ID = re.compile(r"^G4-[A-Z0-9-]{6,120}$")


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace(
        "+00:00", "Z"
    )


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def assert_gate_open() -> None:
    assert_authoritative_gate_open()


def fsync_directory(path: Path) -> None:
    descriptor = os.open(path, os.O_RDONLY | getattr(os, "O_CLOEXEC", 0))
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def ensure_control_parent(path: Path) -> None:
    root = (G0 / "control-evidence-intake").resolve()
    current = root
    for part in path.resolve(strict=False).relative_to(root).parent.parts:
        current = current / part
        try:
            metadata = current.lstat()
        except FileNotFoundError:
            current.mkdir(mode=0o700)
            fsync_directory(current.parent)
            metadata = current.lstat()
        if not stat.S_ISDIR(metadata.st_mode) or stat.S_ISLNK(metadata.st_mode):
            raise ValueError("Control G4 capture parent is unsafe")


def append_control_capture(relative: str, data: bytes) -> Path:
    """Publish one immutable Control-owned receipt without overwrite."""
    candidate = Path(relative)
    if candidate.is_absolute() or ".." in candidate.parts or not relative.endswith(".json"):
        raise ValueError("Control G4 capture path is unsafe")
    lexical_root = G0 / "control-evidence-intake"
    lexical_target = ROOT / candidate
    root_metadata = lexical_root.lstat()
    if stat.S_ISLNK(root_metadata.st_mode) or not stat.S_ISDIR(root_metadata.st_mode):
        raise ValueError("Control G4 intake root is unsafe")
    try:
        relative_parts = lexical_target.relative_to(lexical_root).parts
    except ValueError as error:
        raise ValueError("Control G4 capture escapes the intake") from error
    current = lexical_root
    for part in relative_parts[:-1]:
        current = current / part
        if current.exists() or current.is_symlink():
            metadata = current.lstat()
            if stat.S_ISLNK(metadata.st_mode) or not stat.S_ISDIR(metadata.st_mode):
                raise ValueError("Control G4 capture path contains an unsafe component")
    root = lexical_root.resolve()
    target = lexical_target
    resolved_target = target.resolve(strict=False)
    if root not in resolved_target.parents:
        raise ValueError("Control G4 capture escapes the intake")
    ensure_control_parent(target)
    if target.exists() or target.is_symlink():
        metadata = target.lstat()
        if (
            stat.S_ISLNK(metadata.st_mode)
            or not stat.S_ISREG(metadata.st_mode)
            or stat.S_IMODE(metadata.st_mode) != 0o600
            or metadata.st_nlink != 1
            or target.read_bytes() != data
        ):
            raise ValueError("immutable Control G4 capture already differs")
        return target
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{target.name}.", suffix=".uncommitted", dir=target.parent
    )
    temporary = Path(temporary_name)
    try:
        os.fchmod(descriptor, 0o600)
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        try:
            os.link(temporary, target, follow_symlinks=False)
        except FileExistsError:
            if target.is_symlink() or not target.is_file() or target.read_bytes() != data:
                raise ValueError("concurrent Control G4 capture differs")
        fsync_directory(target.parent)
    finally:
        if temporary.exists():
            temporary.unlink()
            fsync_directory(temporary.parent)
    published = target.lstat()
    if (
        not stat.S_ISREG(published.st_mode)
        or stat.S_ISLNK(published.st_mode)
        or stat.S_IMODE(published.st_mode) != 0o600
        or published.st_nlink != 1
        or target.read_bytes() != data
    ):
        raise ValueError("Control G4 capture publication integrity drift")
    return target


def load_contract() -> dict[str, Any]:
    try:
        payload = json.loads(G4_CONTRACT.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError("G4 functional Gate contract is unavailable") from error
    final = payload.get("finalHeadVerification", {}) if isinstance(payload, dict) else {}
    if not isinstance(final, dict) or final.get("schema") != (
        "dwp.hris.g4.final-head-command-evidence.v1"
    ):
        raise ValueError("G4 final-head evidence contract drift")
    return payload


def integration_worktree_registration(repository: str) -> tuple[Path, str]:
    rows = read_csv(G0 / "worktree-branch-register.csv")
    matches = [
        row for row in rows
        if row.get("session_id") == "CONTROL" and row.get("repository") == repository
    ]
    if len(matches) != 1:
        raise ValueError("repository has no unique Integration Control worktree")
    worktree = Path(matches[0]["worktree_path"])
    if worktree.is_symlink() or not worktree.is_dir():
        raise ValueError("registered Integration Control worktree path is unsafe")
    return worktree, matches[0]["branch"]


def assert_clean_identity(
    worktree: Path, branch: str, expected_head: str,
    expected_tree: str | None = None,
) -> str:
    head_code, head = git(worktree, "rev-parse", "HEAD")
    branch_code, observed_branch = git(worktree, "branch", "--show-current")
    tree_code, tree = git(worktree, "rev-parse", "HEAD^{tree}")
    dirty_code, dirty = git(
        worktree, "status", "--porcelain=v1", "--untracked-files=all",
        "--ignore-submodules=none",
    )
    if not (
        head_code == branch_code == tree_code == dirty_code == 0
        and head == expected_head
        and observed_branch == branch
        and SHA40.fullmatch(tree)
        and not dirty
        and (expected_tree is None or tree == expected_tree)
    ):
        raise ValueError("registered worktree branch/HEAD/tree/clean identity drift")
    return tree


def replay_under_active_control_lock(
    session: str, repository: str, gate_id: str, expected_head: str,
    *,
    publish: bool,
) -> tuple[dict[str, object], Path | None]:
    """Execute the closed catalog while the caller owns the real host lease.

    This is intentionally a same-process API.  ``append_g4_functional_gate``
    uses it for an independent replay immediately before its Control CAS, so a
    syntactically valid hand-authored PASS receipt can never authorize G4.
    """
    if active_host_semaphore_capability(HOST_VERIFICATION_SEMAPHORE) is None:
        raise ValueError("G4 replay requires the active same-process Control host lease")
    if not GATE_ID.fullmatch(gate_id):
        raise ValueError("gate-id is not canonical")
    if not SHA40.fullmatch(expected_head):
        raise ValueError("expected-head must be lowercase 40-hex")
    contract = load_contract()
    slug = MODULES[session]["slug"]
    # G4 is an integrated-product completion Gate.  Replaying at the module
    # branch would miss merge and cross-module regressions, so the source of
    # truth is always the registered clean Integration Control worktree.
    worktree, branch = integration_worktree_registration(repository)
    slice_register_sha256 = hashlib.sha256(SLICE_REGISTER.read_bytes()).hexdigest()
    command_catalog_sha256 = hashlib.sha256(COMMAND_CATALOG.read_bytes()).hexdigest()
    slices = [
        row for row in read_csv(SLICE_REGISTER)
        if row.get("session_id") == session and row.get("gate_status") == "OPEN_G3_CODE"
    ]
    if len(slices) != contract["moduleSliceCounts"].get(session):
        raise ValueError("module active slice count drift")
    checks = Checks()
    profiles = validate_command_catalog(checks)
    if checks.errors:
        raise ValueError("closed command catalog invalid: " + "; ".join(checks.errors))
    environment = dict(os.environ)
    environment.update({"CI": "true", "TZ": "UTC", "LANG": "C", "LC_ALL": "C"})
    started_at = utc_now()
    slice_executions: list[dict[str, object]] = []
    assert_gate_open()
    assert_all_central_transactions_committed()
    source_tree = assert_clean_identity(worktree, branch, expected_head)
    for slice_row in slices:
        slice_id = slice_row["slice_id"]
        checkpoint_shape = {
            "owner_session_id": session,
            "writer_session_id": session,
            "repository": repository,
            "slice_id": slice_id,
            "checkpoint_kind": "MODULE_COMMIT",
        }
        allocation_ids = {
            item for item in slice_row.get("file_allocation_ids", "").split("|")
            if item
        }
        bindings = expected_command_bindings(
            checkpoint_shape, profiles, touched_allocation_ids=allocation_ids
        )
        if not bindings:
            raise ValueError(f"{slice_id}: no closed verification commands")
        receipts: list[dict[str, object]] = []
        for command_id in sorted(bindings):
            argv, working_directory = bindings[command_id]
            command_cwd = (worktree / working_directory).resolve()
            root = worktree.resolve()
            if command_cwd != root and root not in command_cwd.parents:
                raise ValueError(f"{slice_id}: command workdir escapes worktree")
            command_started = utc_now()
            try:
                completed = subprocess.run(
                    argv, cwd=command_cwd, env=environment,
                    stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                    timeout=1800, check=False, shell=False,
                )
            except (OSError, subprocess.TimeoutExpired) as error:
                raise ValueError(f"{slice_id}/{command_id}: command failed: {error}") from error
            command_ended = utc_now()
            status = "PASS" if completed.returncode == 0 else "FAIL"
            command_sha = canonical_argv_sha256(argv)
            receipt: dict[str, object] = {
                "commandId": command_id,
                "commandSha256": command_sha,
                "startedAt": command_started,
                "endedAt": command_ended,
                "exitCode": completed.returncode,
                "outputSha256": sha256_bytes(completed.stdout),
                "reproducibleResultSha256": reproducible_result_sha256(
                    command_sha, completed.returncode, status
                ),
                "status": status,
            }
            typed = parse_frontend_slice_typed_result(
                command_id, completed.stdout, slice_id=slice_id,
                test_path=slice_row.get("frontend_test_path", ""),
            )
            if typed is not None:
                receipt["typedResult"] = typed
            receipts.append(receipt)
            if status != "PASS":
                raise ValueError(f"{slice_id}/{command_id}: closed command did not pass")
        slice_executions.append({"sliceId": slice_id, "commands": receipts})
    assert_clean_identity(worktree, branch, expected_head, source_tree)
    assert_gate_open()
    assert_all_central_transactions_committed()
    if not (
        hashlib.sha256(SLICE_REGISTER.read_bytes()).hexdigest()
        == slice_register_sha256
        and hashlib.sha256(COMMAND_CATALOG.read_bytes()).hexdigest()
        == command_catalog_sha256
        and integration_worktree_registration(repository) == (worktree, branch)
    ):
        raise ValueError("G4 replay authority inputs changed while commands ran")
    ended_at = utc_now()
    payload = {
        "schema": contract["finalHeadVerification"]["schema"],
        "gateId": gate_id,
        "sessionId": session,
        "repository": repository,
        "sourceCommit": expected_head,
        "sourceTreeSha": source_tree,
        "sliceRegisterSha256": slice_register_sha256,
        "verificationCommandCatalogSha256": command_catalog_sha256,
        "startedAt": started_at,
        "endedAt": ended_at,
        "sliceExecutions": slice_executions,
        "syntheticOnly": True,
        "worktreeStatus": "CLEAN_AT_CAPTURE",
        "overallStatus": "PASS",
    }
    target: Path | None = None
    if publish:
        relative = contract["finalHeadVerification"]["pathTemplates"][repository].format(
            module_slug=slug, gate_id=gate_id
        )
        target = append_control_capture(
            relative,
            (json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode(),
        )
        assert_clean_identity(worktree, branch, expected_head, source_tree)
        assert_gate_open()
        assert_all_central_transactions_committed()
        if not (
            hashlib.sha256(SLICE_REGISTER.read_bytes()).hexdigest()
            == slice_register_sha256
            and hashlib.sha256(COMMAND_CATALOG.read_bytes()).hexdigest()
            == command_catalog_sha256
            and integration_worktree_registration(repository) == (worktree, branch)
        ):
            raise ValueError("G4 capture authority inputs changed during publication")
    return payload, target


def capture(
    session: str, repository: str, gate_id: str, expected_head: str,
) -> dict[str, object]:
    with exclusive_host_semaphore(HOST_VERIFICATION_SEMAPHORE, timeout_seconds=300.0):
        payload, target = replay_under_active_control_lock(
            session, repository, gate_id, expected_head, publish=True
        )
    if target is None:  # pragma: no cover - invariant guard
        raise ValueError("Control capture publication did not produce a target")
    return {
        "schema": "dwp.hris.g4.final-head-command-capture.v1",
        "status": "PASS",
        "sessionId": session,
        "repository": repository,
        "sourceCommit": expected_head,
        "sourceTreeSha": payload["sourceTreeSha"],
        "activeSliceCount": len(payload["sliceExecutions"]),
        "path": target.relative_to(ROOT).as_posix(),
        "sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
        "authorityState": "CONTROL_CAPTURE_PENDING_G4_AGGREGATE_APPEND",
        "captureWorktreeOwner": "CONTROL_INTEGRATION",
    }


def self_test() -> dict[str, object]:
    import ast
    import inspect

    tree = ast.parse(Path(__file__).read_text(encoding="utf-8"))
    parser_flags = {
        arg.value
        for node in ast.walk(tree)
        if isinstance(node, ast.Call)
        and isinstance(node.func, ast.Attribute)
        and node.func.attr == "add_argument"
        for arg in node.args
        if isinstance(arg, ast.Constant) and isinstance(arg.value, str)
    }
    source = inspect.getsource(replay_under_active_control_lock)
    capture_source = inspect.getsource(capture)
    cases = {
        "free-form-command-argument-absent": "--command" not in parser_flags,
        "shell-execution-forbidden": "shell=False" in source and "shell=True" not in source,
        "host-semaphore-wraps-command-replay": (
            capture_source.index("with exclusive_host_semaphore")
            < capture_source.index("replay_under_active_control_lock(")
        ),
        "same-process-host-capability-required": (
            "active_host_semaphore_capability(" in source
            and "active same-process Control host lease" in source
        ),
        "gate-rechecked-before-replay-before-publish-and-after": source.count("assert_gate_open()") == 3,
        "central-transactions-fenced-before-replay-and-publication": (
            source.count("assert_all_central_transactions_committed()") == 3
        ),
        "clean-head-tree-checked-before-replay-before-publish-and-after": source.count("assert_clean_identity(") == 3,
        "integration-control-worktree-is-mandatory": "integration_worktree_registration(repository)" in source,
        "exact-active-slice-source": 'row.get("gate_status") == "OPEN_G3_CODE"' in source,
        "closed-command-authority-only": "expected_command_bindings(" in source,
        "authority-input-digests-stable-across-replay-and-publication": (
            source.count("slice_register_sha256") >= 4
            and source.count("command_catalog_sha256") >= 4
            and "authority inputs changed while commands ran" in source
            and "authority inputs changed during publication" in source
        ),
        "frontend-typed-result-required": "parse_frontend_slice_typed_result(" in source,
        "failed-command-never-published": source.index('status != "PASS"') < source.index("append_control_capture("),
        "control-owned-intake-publication": (
            "append_control_capture(" in source
            and "pathTemplates" in source
            and "append_new_bytes" not in source
        ),
        "publication-remains-inside-host-lock": (
            capture_source.index("with exclusive_host_semaphore")
            < capture_source.index("replay_under_active_control_lock(")
            and source.index("append_control_capture(")
            < source.rindex("assert_gate_open()")
        ),
        "unpersisted-replay-supported-for-final-cas": (
            "publish: bool" in source and "if publish:" in source
        ),
    }
    return {
        "schema": "dwp.hris.g4.final-head-command-capture-self-test.v1",
        "status": "PASS" if all(cases.values()) else "FAIL",
        "caseCount": len(cases),
        "passedCount": sum(cases.values()),
        "cases": cases,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--session", choices=sorted(MODULES))
    parser.add_argument("--repository", choices=REPOSITORIES)
    parser.add_argument("--gate-id")
    parser.add_argument("--expected-head")
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--compact", action="store_true")
    args = parser.parse_args()
    try:
        if args.self_test:
            result = self_test()
        elif not all((args.session, args.repository, args.gate_id, args.expected_head)):
            raise ValueError("session, repository, gate-id and expected-head are required")
        else:
            result = capture(
                args.session, args.repository, args.gate_id, args.expected_head
            )
    except (
        KeyError, OSError, TypeError, ValueError,
        json.JSONDecodeError, SemaphoreTimeoutError,
    ) as error:
        result = {
            "schema": "dwp.hris.g4.final-head-command-capture.v1",
            "status": "FAIL", "errors": [str(error)],
        }
    print(json.dumps(
        result, ensure_ascii=False, sort_keys=True,
        separators=(",", ":") if args.compact else None,
        indent=None if args.compact else 2,
    ))
    return 0 if result.get("status") == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
