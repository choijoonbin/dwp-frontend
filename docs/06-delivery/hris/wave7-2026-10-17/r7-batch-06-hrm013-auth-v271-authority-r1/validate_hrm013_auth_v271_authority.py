#!/usr/bin/env python3
"""Fail-closed HRM-013 Auth V271 exclusive-migration authority validator.

The validator is read-only.  It seals the ninth HRM-013 authority carrier,
permits exactly one separately receipted V271 migration lane, and delegates a
later Auth control-plane descendant only through a fixed tenth validator and
an external hash-bound receipt.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import stat
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path, PurePosixPath
from typing import Any


SCRIPT = Path(__file__).absolute()
HERE = SCRIPT.parent
FRONTEND = HERE.parents[4]
WORKSPACE = FRONTEND.parent
BACKEND = WORKSPACE / "dwp-backend"
GIT = "/usr/bin/git"

FRONTEND_BASE = "4b24bdefb0f61d5cb61d89d08397975e45ac389e"
FRONTEND_BASE_TREE = "cc7f9cfbf100a1460a0e711a8a6f121b3fbbac7c"
BACKEND_BASE = "d7a6ed8ae9ae2d91fd68c8d0a31a882e4da101f5"
BACKEND_BASE_TREE = "fdf087a186c3084fbca6fcad2c32b119d8865675"
LANE = "codex/hris-wave7-batch06-hrm013-auth-v271-backend-20261027-r1"
WORKTREE = Path(
    "/Users/a10697/Work/DWP/.codex-worktrees/hris/wave7-20261026/"
    "batch06/hrm013-owner-runtime/auth-v271"
)

ROOT_REL = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-auth-v271-authority-r1"
)
AUTHORITY_REL = f"{ROOT_REL}/auth-v271-execution-authority.v1.json"
REVIEW_REL = f"{ROOT_REL}/independent-review.v1.json"
VALIDATOR_REL = f"{ROOT_REL}/validate_hrm013_auth_v271_authority.py"
CARRIER_PATHS = {"package.json", AUTHORITY_REL, REVIEW_REL, VALIDATOR_REL}
AUTHORITY_BYTES = 2286
AUTHORITY_SHA256 = "c59f8e3851e25903e040475c9572452872776d59f251a8489540b1d5c199b0da"

EIGHTH_ROOT_REL = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-auth-v62-generation-integration-r1"
)
EIGHTH_AUTHORITY_REL = f"{EIGHTH_ROOT_REL}/auth-v62-generation-central-integration-authority.v1.json"
EIGHTH_REVIEW_REL = f"{EIGHTH_ROOT_REL}/independent-review.v1.json"
EIGHTH_VALIDATOR_REL = f"{EIGHTH_ROOT_REL}/validate_hrm013_auth_v62_generation_integration.py"
EIGHTH_ARTIFACT_PINS = [
    {"path": EIGHTH_AUTHORITY_REL, "bytes": 7811, "sha256": "f823a5b7e256a0e29832ea423c6423db645aa09da11eb15119888db4e44f486b"},
    {"path": EIGHTH_REVIEW_REL, "bytes": 2920, "sha256": "24cd68a45eb3005ad3ae0070012389cd56f868916eaf72ca3d209a867df7f7fb"},
    {"path": EIGHTH_VALIDATOR_REL, "bytes": 69057, "sha256": "593c7385717649dd860588b3ec8a8d9a67a6f131b098886746c90a7ed0e77168"},
    {"path": "package.json", "bytes": 15154, "sha256": "8d485521123a0dde1b10afb45cfda5a52c85f6fdd5e12f860c0da59c3a32c45d"},
]

PREDECESSOR_SCRIPT = (
    "python3 docs/06-delivery/hris/tools/validate_current_authority.py && "
    "python3 docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-semantic-closure-r1/validate_hrm013_semantic_closure.py && "
    "python3 docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-callback-binding-r1/validate_hrm013_callback_binding.py && "
    "python3 docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-owner-runtime-binding-gate-r1/"
    "validate_hrm013_owner_runtime_binding_gate.py && "
    "python3 docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-runtime-contract-authority-r1/"
    "validate_hrm013_runtime_contract_authority.py && "
    "python3 docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-shared-contract-integration-r1/"
    "validate_hrm013_shared_contract_integration.py && "
    "python3 docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-auth-v62-generation-r1/"
    "validate_hrm013_auth_v62_generation_authority.py && "
    "python3 " + EIGHTH_VALIDATOR_REL
)
CURRENT_SCRIPT = PREDECESSOR_SCRIPT + " && python3 " + VALIDATOR_REL

MIGRATION_REL = (
    "dwp-auth-server/src/main/resources/db/migration/"
    "V271__create_hris_service_grant_authority.sql"
)
GRANT_POSTGRES_TEST_REL = (
    "dwp-auth-server/src/test/java/com/dwp/services/auth/hrisservicegrant/"
    "HrisServiceGrantAuthorityMigrationPostgresTest.java"
)
CONTRACT_TEST_REL = (
    "dwp-auth-server/src/test/java/com/dwp/services/auth/repository/"
    "TenantFeatureActivationV271MigrationContractTest.java"
)
ACTIVATION_POSTGRES_TEST_REL = (
    "dwp-auth-server/src/test/java/com/dwp/services/auth/tenantfeatureactivation/"
    "TenantFeatureActivationV271PostgresTest.java"
)
LANE_PATHS = {
    MIGRATION_REL, GRANT_POSTGRES_TEST_REL, CONTRACT_TEST_REL,
    ACTIVATION_POSTGRES_TEST_REL,
}
VERIFICATION_COMMANDS = [
    "./gradlew :dwp-auth-server:test --tests com.dwp.services.auth.hrisservicegrant.HrisServiceGrantAuthorityMigrationPostgresTest",
    "./gradlew :dwp-auth-server:test --tests com.dwp.services.auth.repository.TenantFeatureActivationV271MigrationContractTest",
    "./gradlew :dwp-auth-server:test --tests com.dwp.services.auth.tenantfeatureactivation.TenantFeatureActivationV271PostgresTest",
]

RECEIPTS = Path(
    "/Users/a10697/Work/DWP/.codex-worktrees/hris/wave7-20261026/"
    "batch06/hrm013-owner-runtime/receipts"
)
CENTRAL_RECEIPT = RECEIPTS / "auth-v62-generation-central-integration-authority.v1.json"
CENTRAL_BYTES = 8012
CENTRAL_SHA256 = "ce2c972ca8bced36f9401a9d7d8c2e2f8e5d3d1e897ccdb8f7df693265007461"
CLEAN_RECEIPT = RECEIPTS / "auth-v271-clean-worktree-receipt.v1.json"
TARGETED_RECEIPT = RECEIPTS / "auth-v271-targeted-verification-receipt.v1.json"
POST_RECEIPT = RECEIPTS / "auth-v271-post-implementation-review.v1.json"
DELEGATION_RECEIPT = RECEIPTS / "auth-v271-successor-delegation-authority.v1.json"

# The fixed tenth carrier is deliberately declared before any Auth runtime
# source exists.  The ninth validator permits suffix validators, but the first
# suffix must be this exact handoff.  A later backend descendant is rejected
# until this carrier and its external receipt are both hash-bound.
FUTURE_ROOT_REL = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-auth-runtime-authority-r1"
)
FUTURE_AUTHORITY_REL = f"{FUTURE_ROOT_REL}/auth-runtime-execution-authority.v1.json"
FUTURE_REVIEW_REL = f"{FUTURE_ROOT_REL}/independent-review.v1.json"
FUTURE_VALIDATOR_REL = f"{FUTURE_ROOT_REL}/validate_hrm013_auth_runtime_authority.py"
FUTURE_CARRIER_PATHS = {
    "package.json", FUTURE_AUTHORITY_REL, FUTURE_REVIEW_REL, FUTURE_VALIDATOR_REL,
}
FUTURE_BRANCH = "codex/hris-wave7-batch06-hrm013-auth-authority-backend-20261026-r1"
FUTURE_DELEGATION_RECEIPT = RECEIPTS / "auth-runtime-successor-delegation-authority.v1.json"
FUTURE_AUTHORITY_MAP = {
    "independentReviewComplete": True,
    "authRuntimeImplementationAuthorizedAfterSeparateCleanWorktreeReceipt": True,
    "laneCommitAndPushAuthorizedAfterTargetedVerification": True,
    "backendDwpDevIntegrationAuthorized": False,
    "approvalRuntimeImplementationAuthorized": False,
    "peopleOwnerRuntimeImplementationAuthorized": False,
    "taskDispatchOwnerImplementationAuthorized": False,
    "featureEnablementAuthorized": False,
    "tenantEnrollmentAuthorized": False,
    "productionReleaseAuthorized": False,
    "businessCompletionCredit": 0,
}
FUTURE_REVIEW_AUTHORITY = {
    "independentReviewComplete": True,
    "carrierCommitAndPushAuthorized": True,
    "cleanWorktreeMaterializationAuthorizedAfterCarrierPush": True,
    "authRuntimeAuthoringAuthorizedAfterCleanReceipt": True,
    "migrationAuthoringAuthorized": False,
    "approvalOrPeopleRuntimeAuthorized": False,
    "backendDwpDevIntegrationAuthorized": False,
    "productionReleaseAuthorized": False,
    "businessCompletionCredit": 0,
}
FUTURE_REVIEW_BOUNDARIES = [
    "EXACT_INTEGRATED_AUTH_V271_COMMIT_AND_DELEGATION_RECEIPT",
    "EXACT_AUTH_RUNTIME_BRANCH_BASE_AND_DIRECT_CHILD",
    "DEDICATED_CLEAN_WORKTREE_AND_TARGETED_VERIFICATION_REQUIRED",
    "NO_MIGRATION_OR_CROSS_MODULE_RUNTIME_AUTHORITY",
    "NO_DIRECT_BACKEND_DWP_DEV_INTEGRATION",
    "NO_FEATURE_TENANT_OR_PRODUCTION_AUTHORITY",
]

AUTHORITY_MAP = {
    "independentReviewComplete": True,
    "authV271ReservationAuthorized": True,
    "authV271ImplementationAuthorizedAfterSeparateCleanWorktreeReceipt": True,
    "laneCommitAndPushAuthorizedAfterTargetedVerification": True,
    "backendDwpDevIntegrationAuthorized": False,
    "runtimeImplementationAuthorized": False,
    "featureEnablementAuthorized": False,
    "tenantEnrollmentAuthorized": False,
    "productionReleaseAuthorized": False,
    "businessCompletionCredit": 0,
}
REVIEW_AUTHORITY = {
    "independentReviewComplete": True,
    "carrierCommitAndPushAuthorized": True,
    "cleanWorktreeMaterializationAuthorizedAfterCarrierPush": True,
    "authV271AuthoringAuthorizedAfterCleanReceipt": True,
    "backendDwpDevIntegrationAuthorized": False,
    "runtimeImplementationAuthorized": False,
    "productionReleaseAuthorized": False,
    "businessCompletionCredit": 0,
}
REVIEW_BOUNDARIES = [
    "EXACT_AUTH_V62_INTEGRATION_CARRIER_AND_RECEIPT_PINS",
    "EXACT_BACKEND_GENERATION_BASE_AND_V271_MIGRATION_PATH",
    "DEDICATED_CLEAN_WORKTREE_AND_TARGETED_VERIFICATION_REQUIRED",
    "NO_DIRECT_BACKEND_DWP_DEV_INTEGRATION",
    "NO_RUNTIME_ACTIVATION_TENANT_OR_PRODUCTION_AUTHORITY",
]

SAFE_GIT_ENV = {
    "PATH": "/usr/bin:/bin", "HOME": "/var/empty", "LC_ALL": "C", "LANG": "C",
    "GIT_CONFIG_NOSYSTEM": "1", "GIT_CONFIG_GLOBAL": "/dev/null",
    "GIT_NO_REPLACE_OBJECTS": "1",
}
TRUSTED_PYTHONS = {
    Path("/usr/bin/python3").resolve(),
    Path("/Library/Developer/CommandLineTools/usr/bin/python3").resolve(),
}
UNSAFE_ENV = {
    "GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_OBJECT_DIRECTORY",
    "GIT_ALTERNATE_OBJECT_DIRECTORIES", "GIT_CEILING_DIRECTORIES",
    "GIT_DISCOVERY_ACROSS_FILESYSTEM", "GIT_CONFIG", "GIT_CONFIG_COUNT",
    "GIT_CONFIG_PARAMETERS", "GIT_CONFIG_SYSTEM", "GIT_EXEC_PATH",
    "GIT_EXTERNAL_DIFF", "PYTHONPATH", "PYTHONHOME",
}


class VerificationError(RuntimeError):
    pass


class V:
    def __init__(self) -> None:
        self.checks = 0

    def require(self, condition: bool, message: str) -> None:
        self.checks += 1
        if not condition:
            raise VerificationError(message)

    def exact(self, actual: Any, expected: Any, message: str) -> None:
        self.checks += 1
        if type(actual) is not type(expected) or actual != expected:
            raise VerificationError(f"{message}: expected={expected!r} actual={actual!r}")


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def artifact(path: str, data: bytes) -> dict[str, Any]:
    return {"path": path, "bytes": len(data), "sha256": digest(data)}


def run(repo: Path, *args: str, check: bool = True) -> subprocess.CompletedProcess[bytes]:
    result = subprocess.run(
        [GIT, "-C", str(repo), *args], stdout=subprocess.PIPE,
        stderr=subprocess.PIPE, env=SAFE_GIT_ENV, check=False,
    )
    if check and result.returncode != 0:
        raise VerificationError(
            f"git {' '.join(args)} failed: "
            f"{result.stderr.decode('utf-8', errors='replace').strip()}"
        )
    return result


def text(repo: Path, *args: str) -> str:
    return run(repo, *args).stdout.decode("utf-8", errors="strict").strip()


def blob(repo: Path, commit: str, path: str) -> bytes | None:
    result = run(repo, "show", f"{commit}:{path}", check=False)
    return result.stdout if result.returncode == 0 else None


def mode(repo: Path, commit: str, path: str) -> str | None:
    result = run(repo, "ls-tree", commit, "--", path, check=False)
    if result.returncode != 0 or not result.stdout:
        return None
    return result.stdout.decode("utf-8", errors="strict").split(None, 1)[0]


def ancestor(repo: Path, older: str, newer: str) -> bool:
    return run(repo, "merge-base", "--is-ancestor", older, newer, check=False).returncode == 0


def between(repo: Path, older: str, newer: str) -> set[str]:
    out = text(repo, "diff", "--name-only", "--no-renames", f"{older}..{newer}")
    return {line for line in out.splitlines() if line}


def changes(repo: Path) -> set[str]:
    values: set[str] = set()
    for args in (
        ("diff", "--name-only", "--no-renames"),
        ("diff", "--cached", "--name-only", "--no-renames"),
        ("ls-files", "--others", "--exclude-standard"),
    ):
        out = text(repo, *args)
        values.update(line for line in out.splitlines() if line)
    return values


def canonical(path: str) -> bool:
    if (
        not path or path.startswith("/") or "\\" in path or "//" in path
        or path.startswith("./") or path.endswith("/.") or "/./" in path
        or path.startswith("../") or path.endswith("/..") or "/../" in path
    ):
        return False
    parts = PurePosixPath(path).parts
    return bool(parts) and all(part not in ("", ".", "..") for part in parts)


def symlink_free(root: Path, relative: str) -> bool:
    if not canonical(relative):
        return False
    cursor = root
    try:
        for part in PurePosixPath(relative).parts:
            cursor = cursor / part
            if cursor.is_symlink():
                return False
        return cursor.exists() and cursor.resolve().is_relative_to(root.resolve())
    except (OSError, RuntimeError):
        return False


def load_json(data: bytes, label: str) -> Any:
    def pairs(items: list[tuple[str, Any]]) -> dict[str, Any]:
        result: dict[str, Any] = {}
        for key, value in items:
            if key in result:
                raise VerificationError(f"duplicate JSON key in {label}: {key}")
            result[key] = value
        return result

    def constant(value: str) -> Any:
        raise VerificationError(f"non-finite JSON value in {label}: {value}")

    try:
        return json.loads(data.decode("utf-8"), object_pairs_hook=pairs, parse_constant=constant)
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise VerificationError(f"invalid JSON in {label}: {exc}") from exc


def closed(v: V, value: Any, fields: set[str], label: str) -> dict[str, Any]:
    v.require(isinstance(value, dict), f"{label} is not an object")
    if not isinstance(value, dict):
        return {}
    v.exact(set(value), fields, f"{label} field drift")
    return value


def parse_time(value: Any, label: str) -> datetime:
    if not isinstance(value, str):
        raise VerificationError(f"{label} is not a timestamp")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise VerificationError(f"invalid {label}: {value}") from exc
    if parsed.tzinfo is None:
        raise VerificationError(f"timezone missing from {label}")
    return parsed.astimezone(timezone.utc)


def causal(v: V, events: list[tuple[str, datetime]]) -> None:
    for (left_name, left), (right_name, right) in zip(events, events[1:]):
        v.require(left <= right, f"causal order drift: {left_name} after {right_name}")
    now = datetime.now(timezone.utc)
    for name, event in events:
        v.require(event <= now + timedelta(minutes=5), f"future timestamp: {name}")


def open_directory(path: Path) -> int:
    flags = os.O_RDONLY | getattr(os, "O_DIRECTORY", 0) | getattr(os, "O_NOFOLLOW", 0)
    descriptor = os.open(path.absolute().anchor, flags)
    try:
        for part in path.absolute().parts[1:]:
            child = os.open(part, flags, dir_fd=descriptor)
            os.close(descriptor)
            descriptor = child
    except Exception:
        os.close(descriptor)
        raise
    return descriptor


def receipt_bytes(v: V, path: Path, label: str) -> bytes:
    parent = open_directory(path.parent)
    descriptor = -1
    try:
        descriptor = os.open(
            path.name, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0), dir_fd=parent,
        )
        before = os.fstat(descriptor)
        v.require(stat.S_ISREG(before.st_mode), f"{label} is not regular")
        v.exact(stat.S_IMODE(before.st_mode), 0o600, f"{label} mode drift")
        v.exact(before.st_uid, os.geteuid(), f"{label} owner drift")
        v.exact(before.st_nlink, 1, f"{label} link-count drift")
        v.require(0 < before.st_size <= 65536, f"{label} size out of bounds")
        with os.fdopen(descriptor, "rb", closefd=True) as stream:
            descriptor = -1
            data = stream.read(65537)
            after = os.fstat(stream.fileno())
        stable = (
            "st_dev", "st_ino", "st_mode", "st_uid", "st_nlink", "st_size",
            "st_mtime_ns",
        )
        v.exact(len(data), before.st_size, f"{label} length changed while read")
        v.require(len(data) <= 65536, f"{label} oversized while read")
        v.require(
            all(getattr(before, key) == getattr(after, key) for key in stable),
            f"{label} changed while read",
        )
        return data
    finally:
        if descriptor >= 0:
            os.close(descriptor)
        os.close(parent)


def runtime(v: V, required: bool) -> bool:
    resolved = Path(sys.executable).resolve()
    isolated = resolved in TRUSTED_PYTHONS and sys.flags.isolated == 1
    unsafe = sorted(key for key in UNSAFE_ENV if key in os.environ)
    v.require(not unsafe, f"unsafe environment variables: {unsafe}")
    v.require(SCRIPT == SCRIPT.resolve(), "validator path is symlinked")
    v.exact(Path(text(FRONTEND, "rev-parse", "--show-toplevel")).resolve(), FRONTEND.resolve(), "frontend root drift")
    v.exact(Path(text(BACKEND, "rev-parse", "--show-toplevel")).resolve(), BACKEND.resolve(), "backend root drift")
    if required:
        v.require(isolated, "trusted isolated /usr/bin/python3 runtime required")
    return isolated


def verify_repository(v: V, repo: Path, *, require_clean: bool) -> None:
    v.require(repo.exists() and not repo.is_symlink(), f"repository missing or symlinked: {repo}")
    v.exact(text(repo, "rev-parse", "--is-inside-work-tree"), "true", "not a worktree")
    v.exact(text(repo, "rev-parse", "--show-toplevel"), str(repo.resolve()), "worktree root drift")
    v.exact(text(repo, "replace", "-l"), "", "replace refs present")
    git_dir = Path(text(repo, "rev-parse", "--git-dir"))
    if not git_dir.is_absolute():
        git_dir = repo / git_dir
    v.require(not (git_dir / "info/grafts").exists(), "grafts present")
    sparse = run(repo, "config", "--bool", "core.sparseCheckout", check=False)
    v.require(sparse.returncode != 0 or sparse.stdout.decode().strip() != "true", "sparse checkout enabled")
    if require_clean:
        v.exact(changes(repo), set(), f"repository is dirty: {repo}")


def expected_package(parent: str) -> bytes:
    data = blob(FRONTEND, parent, "package.json")
    if data is None:
        raise VerificationError("carrier parent package missing")
    package = load_json(data, "carrier parent package")
    scripts = package.get("scripts") if isinstance(package, dict) else None
    if not isinstance(scripts, dict) or scripts.get("hris:current-contracts:check") != PREDECESSOR_SCRIPT:
        raise VerificationError("carrier parent does not end at eighth validator")
    successor = CURRENT_SCRIPT
    old = json.dumps(PREDECESSOR_SCRIPT, ensure_ascii=False).encode()[1:-1]
    new = json.dumps(successor, ensure_ascii=False).encode()[1:-1]
    if data.count(old) != 1:
        raise VerificationError("ninth package append bytes missing or ambiguous")
    return data.replace(old, new, 1)


def expected_future_package(parent: str) -> bytes:
    data = blob(FRONTEND, parent, "package.json")
    if data is None:
        raise VerificationError("future carrier parent package missing")
    package = load_json(data, "future carrier parent package")
    scripts = package.get("scripts") if isinstance(package, dict) else None
    if not isinstance(scripts, dict) or scripts.get("hris:current-contracts:check") != CURRENT_SCRIPT:
        raise VerificationError("future carrier parent does not end at ninth validator")
    successor = CURRENT_SCRIPT + " && python3 " + FUTURE_VALIDATOR_REL
    old = json.dumps(CURRENT_SCRIPT, ensure_ascii=False).encode()[1:-1]
    new = json.dumps(successor, ensure_ascii=False).encode()[1:-1]
    if data.count(old) != 1:
        raise VerificationError("tenth package append bytes missing or ambiguous")
    return data.replace(old, new, 1)


def check_package(v: V, data: bytes, *, exact: bool, tracked_commit: str | None = None) -> None:
    if exact:
        v.exact(data, expected_package(FRONTEND_BASE), "package is not exact ninth append")
    package = load_json(data, "package")
    scripts = package.get("scripts") if isinstance(package, dict) else None
    v.require(isinstance(scripts, dict), "package scripts missing")
    if not isinstance(scripts, dict):
        return
    v.require("prehris:current-contracts:check" not in scripts, "pre-hook forbidden")
    v.require("posthris:current-contracts:check" not in scripts, "post-hook forbidden")
    command = scripts.get("hris:current-contracts:check")
    v.require(isinstance(command, str), "validator chain missing")
    if not isinstance(command, str):
        return
    parts = command.split(" && ")
    sealed = CURRENT_SCRIPT.split(" && ")
    v.require(parts[: len(sealed)] == sealed, "sealed ninth-validator prefix drift")
    pattern = re.compile(r"python3 (docs/06-delivery/hris/[A-Za-z0-9._/-]+/validate_[A-Za-z0-9_]+\.py)")
    matches = [pattern.fullmatch(part) for part in parts]
    v.require(all(matches), "non-validator command in current contract chain")
    paths = [match.group(1) for match in matches if match]
    v.require(len(paths) == len(set(paths)), "duplicate validator command")
    v.exact(paths[7:9], [EIGHTH_VALIDATOR_REL, VALIDATOR_REL], "eighth/ninth order drift")
    if len(paths) > 9:
        v.exact(paths[9], FUTURE_VALIDATOR_REL, "first post-V271 validator is not fixed Auth runtime handoff")
    if tracked_commit is not None:
        for path in paths:
            v.require(canonical(path), f"noncanonical validator path: {path}")
            v.exact(mode(FRONTEND, tracked_commit, path), "100644", f"validator is not a tracked regular file: {path}")
            v.require(symlink_free(FRONTEND, path), f"validator path is missing or symlinked: {path}")


def expected_authority() -> dict[str, Any]:
    return {
        "schema": "dwp.hris.wave7.hrm013-auth-v271-execution-authority.v1",
        "state": "INDEPENDENTLY_REVIEWED_HASH_BOUND_AUTH_V271_EXECUTION_AUTHORITY",
        "lane": "AUTH_V271_EXCLUSIVE_MIGRATION",
        "predecessorCarrier": {
            "repository": "dwp-frontend", "branch": "dwp-dev",
            "commit": FRONTEND_BASE, "tree": FRONTEND_BASE_TREE,
            "v62IntegrationCarrierCommit": FRONTEND_BASE,
            "v62IntegrationCarrierTree": FRONTEND_BASE_TREE,
            "v62CentralIntegrationReceiptSha256": CENTRAL_SHA256,
        },
        "backendImplementation": {
            "repository": "dwp-backend", "branch": LANE,
            "baseCommit": BACKEND_BASE, "baseTree": BACKEND_BASE_TREE,
            "operation": "AUTHOR_VALIDATE_COMMIT_AND_PUSH_AUTH_V271_ONLY",
            "requiredDirectChild": True, "requiredMigrationPath": MIGRATION_REL,
            "databaseMigrationVersion": 271, "directDwpDevIntegrationAuthorized": False,
        },
        "delegationBoundary": {
            "receiptPath": str(DELEGATION_RECEIPT),
            "receiptSchema": "dwp.hris.wave7.hrm013-auth-v271-successor-delegation-authority-receipt.v1",
            "receiptState": "HASH_BOUND_REVIEWED_AUTH_V271_SUCCESSOR_CONTROL_DELEGATION",
            "requiredDecision": "GO_FOR_AUTH_V271_SUCCESSOR_CONTROL_DELEGATION_ONLY",
            "externalAttestationRequired": True,
            "currentV62AuthorityGrantsV271": False,
        },
        "authority": AUTHORITY_MAP,
    }


def expected_review(blobs: dict[str, bytes]) -> dict[str, Any]:
    return {
        "schema": "dwp.hris.wave7.hrm013-auth-v271-execution-authority-independent-review.v1",
        "reviewer": "INDEPENDENT_HRM013_AUTH_V271_AUTHORITY_REVIEW",
        "scope": {
            "authorityPath": AUTHORITY_REL, "validatorPath": VALIDATOR_REL,
            "packagePath": "package.json", "reviewedBoundaries": REVIEW_BOUNDARIES,
        },
        "findings": {
            "p0": [], "p1": [], "p2": [],
            "notes": [
                "The carrier may authorize only one separately receipted Auth V271 migration lane from the exact integrated Auth v62 commit.",
                "Backend dwp-dev integration remains forbidden until descendant governance and successor delegation receipts are complete.",
                "No runtime, activation, tenant enrollment, production binding or release authority is granted.",
            ],
        },
        "finalVerdict": {
            "p0": 0, "p1": 0, "p2": 0,
            "decision": "GO_FOR_AUTH_V271_AUTHORITY_CARRIER_COMMIT_AND_PUSH_ONLY",
        },
        "authority": REVIEW_AUTHORITY,
        "artifactPins": [
            artifact(AUTHORITY_REL, blobs[AUTHORITY_REL]),
            artifact(VALIDATOR_REL, blobs[VALIDATOR_REL]),
            artifact("package.json", blobs["package.json"]),
        ],
    }


def check_authority_and_review(v: V, blobs: dict[str, bytes]) -> datetime:
    v.exact(
        (len(blobs[AUTHORITY_REL]), digest(blobs[AUTHORITY_REL])),
        (AUTHORITY_BYTES, AUTHORITY_SHA256), "authority artifact drift",
    )
    authority = load_json(blobs[AUTHORITY_REL], "V271 authority")
    closed(v, authority, {
        "schema", "state", "lane", "predecessorCarrier", "backendImplementation",
        "delegationBoundary", "authority",
    }, "V271 authority")
    v.exact(authority, expected_authority(), "V271 authority content drift")
    review = load_json(blobs[REVIEW_REL], "V271 independent review")
    closed(v, review, {
        "schema", "reviewedAt", "reviewer", "scope", "findings",
        "finalVerdict", "authority", "artifactPins",
    }, "V271 independent review")
    reviewed_at = parse_time(review.get("reviewedAt"), "V271 review reviewedAt")
    expected = expected_review(blobs)
    v.exact({key: review.get(key) for key in expected}, expected, "V271 review content drift")
    central_data = receipt_bytes(v, CENTRAL_RECEIPT, "Auth v62 central integration receipt")
    v.exact((len(central_data), digest(central_data)), (CENTRAL_BYTES, CENTRAL_SHA256), "central receipt drift")
    central = load_json(central_data, "Auth v62 central integration receipt")
    central_at = parse_time(central.get("recordedAt"), "central receipt recordedAt")
    causal(v, [("central receipt", central_at), ("V271 review", reviewed_at)])
    return reviewed_at


def check_predecessor_pins(v: V) -> None:
    for pin in EIGHTH_ARTIFACT_PINS:
        data = blob(FRONTEND, FRONTEND_BASE, pin["path"])
        v.require(data is not None, f"missing predecessor artifact: {pin['path']}")
        v.exact(artifact(pin["path"], data or b""), pin, f"predecessor pin drift: {pin['path']}")
        v.exact(mode(FRONTEND, FRONTEND_BASE, pin["path"]), "100644", f"predecessor mode drift: {pin['path']}")


def authoring(v: V) -> str:
    v.exact(text(FRONTEND, "branch", "--show-current"), "dwp-dev", "frontend branch drift")
    v.exact(text(FRONTEND, "rev-parse", "HEAD"), FRONTEND_BASE, "frontend authoring base drift")
    v.exact(text(FRONTEND, "rev-parse", "HEAD^{tree}"), FRONTEND_BASE_TREE, "frontend base tree drift")
    v.exact(text(FRONTEND, "rev-parse", "origin/dwp-dev"), FRONTEND_BASE, "frontend origin drift")
    v.exact(changes(FRONTEND), CARRIER_PATHS, "authoring four-path carrier drift")
    blobs: dict[str, bytes] = {}
    for path in (AUTHORITY_REL, REVIEW_REL, VALIDATOR_REL, "package.json"):
        v.require(symlink_free(FRONTEND, path), f"authoring artifact missing or symlinked: {path}")
        blobs[path] = (FRONTEND / path).read_bytes()
    check_package(v, blobs["package.json"], exact=True)
    try:
        compile(blobs[VALIDATOR_REL].decode("utf-8"), VALIDATOR_REL, "exec")
    except (UnicodeDecodeError, SyntaxError) as exc:
        raise VerificationError(f"invalid ninth validator: {exc}") from exc
    forbidden = ("write_" + "text(", "write_" + "bytes(", "O_" + "CREAT", "shell=" + "True")
    source = blobs[VALIDATOR_REL].decode("utf-8")
    v.require(not any(token in source for token in forbidden), "validator contains write/shell primitive")
    check_authority_and_review(v, blobs)
    v.exact(text(BACKEND, "branch", "--show-current"), "dwp-dev", "backend branch drift")
    v.exact(text(BACKEND, "rev-parse", "HEAD"), BACKEND_BASE, "backend base drift")
    v.exact(text(BACKEND, "rev-parse", "HEAD^{tree}"), BACKEND_BASE_TREE, "backend base tree drift")
    v.exact(text(BACKEND, "rev-parse", "origin/dwp-dev"), BACKEND_BASE, "backend origin drift")
    verify_repository(v, BACKEND, require_clean=True)
    v.require(blob(BACKEND, BACKEND_BASE, MIGRATION_REL) is None, "V271 already exists at backend base")
    for path in (CLEAN_RECEIPT, TARGETED_RECEIPT, POST_RECEIPT, DELEGATION_RECEIPT, FUTURE_DELEGATION_RECEIPT):
        v.require(not path.exists(), f"premature receipt exists: {path}")
    v.require(not WORKTREE.exists(), "V271 worktree exists before carrier push")
    return "AUTH_V271_CARRIER_AUTHORING_RECEIPT_NOT_YET_ALLOWED"


def historical(v: V) -> tuple[dict[str, Any], datetime]:
    v.exact(text(FRONTEND, "branch", "--show-current"), "dwp-dev", "frontend branch drift")
    commits: list[str] = []
    for path in (AUTHORITY_REL, REVIEW_REL, VALIDATOR_REL):
        found = [line for line in text(FRONTEND, "log", "--diff-filter=A", "--format=%H", "--", path).splitlines() if line]
        v.require(len(found) == 1, f"carrier artifact introduction ambiguous: {path}")
        commits.extend(found)
    v.exact(len(set(commits)), 1, "carrier artifacts introduced separately")
    commit = commits[0] if commits else ""
    v.exact(text(FRONTEND, "rev-list", "--parents", "-n", "1", commit).split(), [commit, FRONTEND_BASE], "carrier is not direct child of fixed base")
    v.exact(between(FRONTEND, FRONTEND_BASE, commit), CARRIER_PATHS, "carrier changed-path drift")
    v.exact(text(FRONTEND, "rev-parse", f"{commit}^{{tree}}"), text(FRONTEND, "show", "-s", "--format=%T", commit), "carrier tree lookup drift")
    head = text(FRONTEND, "rev-parse", "HEAD")
    origin = text(FRONTEND, "rev-parse", "origin/dwp-dev")
    v.require(ancestor(FRONTEND, commit, head), "carrier not on frontend dwp-dev")
    v.require(ancestor(FRONTEND, commit, origin), "carrier not pushed to frontend origin/dwp-dev")
    v.exact(changes(FRONTEND), set(), "frontend is dirty after carrier commit")
    blobs: dict[str, bytes] = {}
    for path in (AUTHORITY_REL, REVIEW_REL, VALIDATOR_REL, "package.json"):
        v.exact(mode(FRONTEND, commit, path), "100644", f"unsafe carrier artifact mode: {path}")
        data = blob(FRONTEND, commit, path)
        v.require(data is not None, f"missing carrier artifact: {path}")
        blobs[path] = data or b""
    v.exact(blobs["package.json"], expected_package(FRONTEND_BASE), "carrier package is not exact ninth append")
    for path in (AUTHORITY_REL, REVIEW_REL, VALIDATOR_REL):
        v.require(symlink_free(FRONTEND, path), f"current carrier artifact missing or symlinked: {path}")
        v.exact(artifact(path, (FRONTEND / path).read_bytes()), artifact(path, blobs[path]), f"carrier artifact mutated: {path}")
    current_package = (FRONTEND / "package.json").read_bytes()
    v.exact(artifact("package.json", current_package), artifact("package.json", blob(FRONTEND, head, "package.json") or b""), "live package differs from frontend HEAD")
    check_package(v, current_package, exact=False, tracked_commit=head)
    reviewed_at = check_authority_and_review(v, blobs)
    committed_at = parse_time(text(FRONTEND, "show", "-s", "--format=%cI", commit), "V271 carrier committedAt")
    causal(v, [("V271 review", reviewed_at), ("V271 carrier commit", committed_at)])
    return {"commit": commit, "tree": text(FRONTEND, "rev-parse", f"{commit}^{{tree}}"), "blobs": blobs}, reviewed_at


CLEAN_FIELDS = {
    "schema", "state", "authorityCarrierCommit", "authorityCarrierTree",
    "authorityArtifact", "validatorArtifact", "packageArtifact", "repository",
    "repositoryRoot", "worktreeRoot", "branch", "baseCommit", "baseTree",
    "headCommit", "headTree", "originDwpDevCommit", "porcelainV2",
    "ignoredSourceShadows", "untrackedSourceShadows", "replaceRefs", "grafts",
    "sparseCheckout", "fsmonitor", "externalDiff", "assumeUnchanged",
    "skipWorktree", "pathSymlinks", "authorityCarrierCommittedAt",
    "authorityCarrierPushObservedAt", "verifiedAt", "verifiedBy",
}


def check_clean_receipt(v: V, carrier: dict[str, Any]) -> tuple[bytes, datetime]:
    data = receipt_bytes(v, CLEAN_RECEIPT, "V271 clean-worktree receipt")
    receipt = load_json(data, "V271 clean-worktree receipt")
    closed(v, receipt, CLEAN_FIELDS, "V271 clean-worktree receipt")
    expected = {
        "schema": "dwp.hris.wave7.hrm013-auth-v271-clean-worktree-receipt.v1",
        "state": "HASH_BOUND_FRESH_CLEAN_AUTH_V271_WORKTREE_RECEIPT",
        "authorityCarrierCommit": carrier["commit"], "authorityCarrierTree": carrier["tree"],
        "authorityArtifact": artifact(AUTHORITY_REL, carrier["blobs"][AUTHORITY_REL]),
        "validatorArtifact": artifact(VALIDATOR_REL, carrier["blobs"][VALIDATOR_REL]),
        "packageArtifact": artifact("package.json", carrier["blobs"]["package.json"]),
        "repository": "dwp-backend", "repositoryRoot": str(BACKEND),
        "worktreeRoot": str(WORKTREE), "branch": LANE,
        "baseCommit": BACKEND_BASE, "baseTree": BACKEND_BASE_TREE,
        "headCommit": BACKEND_BASE, "headTree": BACKEND_BASE_TREE,
        "originDwpDevCommit": BACKEND_BASE, "porcelainV2": "",
        "ignoredSourceShadows": [], "untrackedSourceShadows": [],
        "replaceRefs": [], "grafts": [], "sparseCheckout": False,
        "fsmonitor": False, "externalDiff": False, "assumeUnchanged": [],
        "skipWorktree": [], "pathSymlinks": [],
        "authorityCarrierCommittedAt": text(
            FRONTEND, "show", "-s", "--format=%cI", carrier["commit"],
        ),
        "verifiedBy": "TRUSTED_HRM013_AUTH_V271_CLEAN_WORKTREE_VERIFIER",
    }
    v.exact({key: receipt.get(key) for key in expected}, expected, "clean-worktree receipt evidence drift")
    verified_at = parse_time(receipt.get("verifiedAt"), "clean receipt verifiedAt")
    carrier_at = parse_time(text(FRONTEND, "show", "-s", "--format=%cI", carrier["commit"]), "carrier committedAt")
    pushed_at = parse_time(
        receipt.get("authorityCarrierPushObservedAt"), "carrier pushObservedAt",
    )
    causal(v, [
        ("carrier commit", carrier_at), ("carrier push", pushed_at),
        ("clean receipt", verified_at),
    ])
    return data, verified_at


def validate_migration_bytes(v: V, source: bytes) -> None:
    try:
        lowered = source.decode("utf-8").lower()
    except UnicodeDecodeError as exc:
        raise VerificationError("V271 migration is not UTF-8") from exc
    for table in (
        "auth_hris_service_grant_sets", "auth_hris_service_grant_bindings",
        "auth_hris_service_authority_proof_replays",
        "auth_hris_service_grant_quiesce_fences",
        "auth_hris_service_grant_drain_activities",
    ):
        v.require(table in lowered, f"V271 omits required table: {table}")
    v.require(lowered.count("enable row level security") >= 5, "V271 does not enable RLS on all authority tables")
    v.require(lowered.count("force row level security") >= 5, "V271 does not force RLS on all authority tables")
    for table in ("auth_hris_service_grant_sets", "auth_hris_service_grant_bindings"):
        v.require(f"insert into {table}" not in lowered, f"V271 seeds forbidden service-grant rows: {table}")
    for token in (
        "hris_hrm_exit_return_workbench", "product-surfaces", "draft",
        "cb370fd02a896452a64187fca8afb8bb3e3d281e490fba02e76f7a3c0d7f9770",
        "automatic_import_enabled",
        "route.hcm.operations.exit-return.page", "route.hcm.operations.exit-return.data",
        "route.hcm.operations.separation-case.action",
    ):
        v.require(token in lowered, f"V271 omits sealed release token: {token}")
    v.require(
        re.search(r"automatic_import_enabled[\s\S]{0,160}\bfalse\b", lowered) is not None,
        "V271 does not keep automatic product import disabled",
    )


def validate_migration_source(v: V, root: Path) -> None:
    for path in LANE_PATHS:
        v.require(symlink_free(root, path), f"lane path missing or symlinked: {path}")
    validate_migration_bytes(v, (root / MIGRATION_REL).read_bytes())


TARGETED_FIELDS = {
    "schema", "state", "authorityCarrierCommit", "authorityCarrierTree",
    "authorityArtifact", "validatorArtifact", "cleanWorktreeReceiptSha256",
    "repository", "branch", "baseCommit", "baseTree", "testedCommit", "testedTree",
    "changedPaths", "changedArtifacts", "verificationCommands", "exitCodes",
    "semanticEvidence", "verifiedAt", "verifiedBy",
}


def check_targeted_receipt(
    v: V, carrier: dict[str, Any], clean_data: bytes, lane_commit: str,
    lane_tree: str, paths: list[str], clean_at: datetime,
) -> tuple[bytes, datetime]:
    data = receipt_bytes(v, TARGETED_RECEIPT, "V271 targeted-verification receipt")
    receipt = load_json(data, "V271 targeted-verification receipt")
    closed(v, receipt, TARGETED_FIELDS, "V271 targeted-verification receipt")
    pins = [artifact(path, blob(BACKEND, lane_commit, path) or b"") for path in paths]
    expected = {
        "schema": "dwp.hris.wave7.hrm013-auth-v271-targeted-verification-receipt.v1",
        "state": "TRUSTED_EXACT_AUTH_V271_TREE_AND_TARGETED_TESTS_PASS",
        "authorityCarrierCommit": carrier["commit"], "authorityCarrierTree": carrier["tree"],
        "authorityArtifact": artifact(AUTHORITY_REL, carrier["blobs"][AUTHORITY_REL]),
        "validatorArtifact": artifact(VALIDATOR_REL, carrier["blobs"][VALIDATOR_REL]),
        "cleanWorktreeReceiptSha256": digest(clean_data), "repository": "dwp-backend",
        "branch": LANE, "baseCommit": BACKEND_BASE, "baseTree": BACKEND_BASE_TREE,
        "testedCommit": lane_commit, "testedTree": lane_tree, "changedPaths": paths,
        "changedArtifacts": pins, "verificationCommands": VERIFICATION_COMMANDS,
        "exitCodes": [0, 0, 0],
        "semanticEvidence": {
            "migrationVersion": 271,
            "requiredTables": 5,
            "forcedTenantRlsTables": 5,
            "serviceGrantSeedRows": 0,
            "tenantEnrollmentRows": 0,
            "automaticImportEnabled": False,
            "featureBaseline": "OFF",
            "boundHcmRoutes": 3,
            "runtimeSourcePaths": 0,
        },
        "verifiedBy": "TRUSTED_HRM013_AUTH_V271_TARGETED_VERIFICATION",
    }
    v.exact({key: receipt.get(key) for key in expected}, expected, "targeted receipt evidence drift")
    verified_at = parse_time(receipt.get("verifiedAt"), "targeted receipt verifiedAt")
    committed_at = parse_time(text(BACKEND, "show", "-s", "--format=%cI", lane_commit), "V271 commit committedAt")
    causal(v, [("clean receipt", clean_at), ("V271 commit", committed_at), ("targeted verification", verified_at)])
    return data, verified_at


POST_FIELDS = {
    "schema", "state", "authorityCarrierCommit", "authorityCarrierTree",
    "authorityArtifact", "validatorArtifact", "targetedVerificationReceiptSha256",
    "laneCommit", "laneTree", "changedPaths", "p0", "p1", "p2", "decision",
    "reviewedAt", "lanePushObservedAt", "recordedAt", "reviewedBy",
}


def check_post_receipt(
    v: V, carrier: dict[str, Any], targeted_data: bytes, targeted_at: datetime,
    lane_commit: str, lane_tree: str, paths: list[str],
) -> tuple[bytes, datetime]:
    data = receipt_bytes(v, POST_RECEIPT, "V271 post-implementation review")
    receipt = load_json(data, "V271 post-implementation review")
    closed(v, receipt, POST_FIELDS, "V271 post-implementation review")
    expected = {
        "schema": "dwp.hris.wave7.hrm013-auth-v271-post-implementation-review.v1",
        "state": "INDEPENDENTLY_REVIEWED_EXACT_AUTH_V271_TREE_BRANCH_PUSH_ONLY",
        "authorityCarrierCommit": carrier["commit"], "authorityCarrierTree": carrier["tree"],
        "authorityArtifact": artifact(AUTHORITY_REL, carrier["blobs"][AUTHORITY_REL]),
        "validatorArtifact": artifact(VALIDATOR_REL, carrier["blobs"][VALIDATOR_REL]),
        "targetedVerificationReceiptSha256": digest(targeted_data),
        "laneCommit": lane_commit, "laneTree": lane_tree, "changedPaths": paths,
        "p0": 0, "p1": 0, "p2": 0,
        "decision": "GO_FOR_AUTH_V271_LANE_BRANCH_PUSH_ONLY",
        "reviewedBy": "INDEPENDENT_HRM013_AUTH_V271_POST_IMPLEMENTATION_REVIEW",
    }
    v.exact({key: receipt.get(key) for key in expected}, expected, "post-review evidence drift")
    remote = run(BACKEND, "rev-parse", "--verify", f"refs/remotes/origin/{LANE}", check=False)
    v.require(remote.returncode == 0, "V271 branch is not pushed")
    if remote.returncode == 0:
        v.exact(remote.stdout.decode().strip(), lane_commit, "V271 remote branch drift")
    reviewed_at = parse_time(receipt.get("reviewedAt"), "post review reviewedAt")
    pushed_at = parse_time(receipt.get("lanePushObservedAt"), "lane pushObservedAt")
    recorded_at = parse_time(receipt.get("recordedAt"), "post review recordedAt")
    causal(v, [
        ("targeted verification", targeted_at), ("post review", reviewed_at),
        ("lane push", pushed_at), ("post review record", recorded_at),
    ])
    return data, recorded_at


def check_lane(v: V, carrier: dict[str, Any]) -> str:
    if not CLEAN_RECEIPT.exists():
        v.require(not TARGETED_RECEIPT.exists(), "targeted receipt exists without clean receipt")
        v.require(not POST_RECEIPT.exists(), "post-review receipt exists without clean receipt")
        remote = run(BACKEND, "rev-parse", "--verify", f"refs/remotes/origin/{LANE}", check=False)
        v.require(remote.returncode != 0, "V271 branch exists before clean receipt")
        return "AUTH_V271_AUTHORITY_CARRIER_PUSHED_CLEAN_WORKTREE_RECEIPT_REQUIRED"
    clean_data, clean_at = check_clean_receipt(v, carrier)
    v.require(WORKTREE.exists() and not WORKTREE.is_symlink(), "V271 worktree missing or symlinked")
    v.exact(Path(text(WORKTREE, "rev-parse", "--show-toplevel")).resolve(), WORKTREE.resolve(), "V271 worktree root drift")
    v.exact(text(WORKTREE, "branch", "--show-current"), LANE, "V271 worktree branch drift")
    v.exact(text(WORKTREE, "merge-base", BACKEND_BASE, "HEAD"), BACKEND_BASE, "V271 lane does not descend from base")
    head = text(WORKTREE, "rev-parse", "HEAD")
    delta = between(WORKTREE, BACKEND_BASE, head) | changes(WORKTREE)
    v.require(delta <= LANE_PATHS, f"V271 lane path expansion: {sorted(delta - LANE_PATHS)}")
    if head == BACKEND_BASE and not delta:
        v.require(not TARGETED_RECEIPT.exists() and not POST_RECEIPT.exists(), "verification receipt precedes V271 source")
        return "CLEAN_WORKTREE_READY_FOR_AUTH_V271_MIGRATION"
    v.require(MIGRATION_REL in delta, "V271 lane lacks required migration")
    for path in delta:
        if (WORKTREE / path).exists():
            v.require(symlink_free(WORKTREE, path), f"V271 changed path symlinked: {path}")
    dirty = changes(WORKTREE)
    if dirty:
        v.require(not TARGETED_RECEIPT.exists() and not POST_RECEIPT.exists(), "verification receipt exists for dirty V271 lane")
        return "BOUNDED_AUTH_V271_MIGRATION_LANE_IN_PROGRESS"
    v.exact(delta, LANE_PATHS, "committed V271 lane must contain migration and three focused tests")
    v.exact(text(WORKTREE, "rev-list", "--parents", "-n", "1", head).split(), [head, BACKEND_BASE], "V271 commit is not direct child of base")
    lane_tree = text(WORKTREE, "rev-parse", "HEAD^{tree}")
    paths = sorted(delta)
    validate_migration_source(v, WORKTREE)
    remote = run(BACKEND, "rev-parse", "--verify", f"refs/remotes/origin/{LANE}", check=False)
    if not TARGETED_RECEIPT.exists():
        v.require(not POST_RECEIPT.exists(), "post-review exists without targeted receipt")
        v.require(remote.returncode != 0, "V271 branch pushed before targeted verification")
        return "COMMITTED_AUTH_V271_TARGETED_VERIFICATION_RECEIPT_REQUIRED"
    targeted_data, targeted_at = check_targeted_receipt(
        v, carrier, clean_data, head, lane_tree, paths, clean_at,
    )
    if not POST_RECEIPT.exists():
        v.require(remote.returncode != 0, "V271 branch pushed before post-implementation review")
        return "VERIFIED_AUTH_V271_POST_IMPLEMENTATION_REVIEW_REQUIRED"
    check_post_receipt(v, carrier, targeted_data, targeted_at, head, lane_tree, paths)
    return "REVIEWED_AUTH_V271_LANE_PUSHED_DESCENDANT_GOVERNANCE_REQUIRED"


def lane_evidence_from_delegation(
    v: V, carrier: dict[str, Any],
) -> tuple[dict[str, Any], str, str, list[str]]:
    data = receipt_bytes(v, DELEGATION_RECEIPT, "V271 successor delegation receipt")
    receipt = load_json(data, "V271 successor delegation receipt")
    v.exact(receipt.get("schema"), "dwp.hris.wave7.hrm013-auth-v271-successor-delegation-authority-receipt.v1", "delegation schema drift")
    v.exact(receipt.get("state"), "HASH_BOUND_REVIEWED_AUTH_V271_SUCCESSOR_CONTROL_DELEGATION", "delegation state drift")
    v.exact(receipt.get("authorizedBackendBranch"), LANE, "delegation branch drift")
    v.exact(receipt.get("previousBackendCommit"), BACKEND_BASE, "delegation base drift")
    v.exact(receipt.get("previousBackendTree"), BACKEND_BASE_TREE, "delegation base tree drift")
    v.exact(receipt.get("decision"), "GO_FOR_AUTH_V271_SUCCESSOR_CONTROL_DELEGATION_ONLY", "delegation decision drift")
    v.exact((receipt.get("p0"), receipt.get("p1"), receipt.get("p2")), (0, 0, 0), "delegation finding drift")
    commit = receipt.get("authorizedBackendCommit")
    v.require(isinstance(commit, str) and re.fullmatch(r"[0-9a-f]{40}", commit or "") is not None, "invalid delegated V271 commit")
    commit = str(commit)
    tree = text(BACKEND, "rev-parse", f"{commit}^{{tree}}")
    v.exact(receipt.get("authorizedBackendTree"), tree, "delegated V271 tree drift")
    v.exact(text(BACKEND, "rev-list", "--parents", "-n", "1", commit).split(), [commit, BACKEND_BASE], "delegated V271 commit topology drift")
    paths = sorted(between(BACKEND, BACKEND_BASE, commit))
    v.exact(set(paths), LANE_PATHS, "delegated V271 changed paths drift")
    v.exact(receipt.get("authorizedBackendChangedPaths"), paths, "delegation changed-path evidence drift")
    remote = text(BACKEND, "rev-parse", f"refs/remotes/origin/{LANE}")
    v.exact(remote, commit, "delegated V271 remote branch drift")
    for path in paths:
        v.exact(mode(BACKEND, commit, path), "100644", f"delegated V271 path mode drift: {path}")
    migration = blob(BACKEND, commit, MIGRATION_REL)
    v.require(migration is not None, "delegated V271 migration blob missing")
    validate_migration_bytes(v, migration or b"")
    clean_data, clean_at = check_clean_receipt(v, carrier)
    targeted_data, targeted_at = check_targeted_receipt(
        v, carrier, clean_data, commit, tree, paths, clean_at,
    )
    _, post_recorded_at = check_post_receipt(
        v, carrier, targeted_data, targeted_at, commit, tree, paths,
    )
    governance_at = parse_time(
        receipt.get("backendGovernanceReceiptRecordedAt"),
        "delegation backendGovernanceReceiptRecordedAt",
    )
    delegated_at = parse_time(receipt.get("recordedAt"), "delegation recordedAt")
    causal(v, [
        ("V271 post review", post_recorded_at),
        ("V271 descendant governance", governance_at),
        ("V271 successor delegation", delegated_at),
    ])
    return receipt, commit, tree, paths


def future_handoff(
    v: V, carrier: dict[str, Any], v271_commit: str, v271_tree: str,
    backend_head: str,
) -> str:
    data = receipt_bytes(v, FUTURE_DELEGATION_RECEIPT, "Auth runtime successor delegation receipt")
    receipt = load_json(data, "Auth runtime successor delegation receipt")
    fields = {
        "schema", "state", "v271BackendCommit", "v271BackendTree",
        "runtimeAuthorityCarrierCommit", "runtimeAuthorityCarrierTree",
        "runtimeAuthorityCarrierParentCommit", "runtimeAuthorityArtifact",
        "runtimeValidatorArtifact", "runtimeIndependentReviewArtifact",
        "runtimePackageArtifact", "authorizedBackendBranch", "authorizedBackendCommit",
        "authorizedBackendTree", "authorizedBackendParentCommit", "authorizedBackendChangedPaths",
        "backendDescendantGovernanceReceiptPath", "backendDescendantGovernanceReceiptSha256",
        "backendCommitCommittedAt", "runtimeReviewReviewedAt", "runtimeCarrierCommittedAt",
        "runtimeCarrierPushObservedAt", "backendGovernanceReceiptRecordedAt", "recordedAt",
        "p0", "p1", "p2", "decision", "recordedBy",
    }
    closed(v, receipt, fields, "Auth runtime successor delegation receipt")
    carrier_commit = receipt.get("runtimeAuthorityCarrierCommit")
    v.require(isinstance(carrier_commit, str) and re.fullmatch(r"[0-9a-f]{40}", carrier_commit or "") is not None, "invalid Auth runtime carrier commit")
    carrier_commit = str(carrier_commit)
    additions: list[str] = []
    for path in (FUTURE_AUTHORITY_REL, FUTURE_REVIEW_REL, FUTURE_VALIDATOR_REL):
        found = [line for line in text(FRONTEND, "log", "--diff-filter=A", "--format=%H", "--", path).splitlines() if line]
        v.require(len(found) == 1, f"Auth runtime carrier introduction ambiguous: {path}")
        additions.extend(found)
    v.exact(set(additions), {carrier_commit}, "Auth runtime carrier artifacts introduced separately")
    parents = text(FRONTEND, "rev-list", "--parents", "-n", "1", carrier_commit).split()
    v.require(len(parents) == 2, "Auth runtime carrier must be non-merge")
    parent = parents[1] if len(parents) == 2 else ""
    v.exact(receipt.get("runtimeAuthorityCarrierParentCommit"), parent, "Auth runtime carrier parent drift")
    v.require(ancestor(FRONTEND, carrier["commit"], parent), "Auth runtime carrier bypasses V271 authority carrier")
    v.exact(between(FRONTEND, parent, carrier_commit), FUTURE_CARRIER_PATHS, "Auth runtime carrier path drift")
    v.exact(blob(FRONTEND, carrier_commit, "package.json"), expected_future_package(parent), "Auth runtime package is not exact tenth append")
    frontend_head = text(FRONTEND, "rev-parse", "HEAD")
    v.require(ancestor(FRONTEND, carrier_commit, frontend_head), "Auth runtime carrier not on frontend dwp-dev")
    v.require(ancestor(FRONTEND, carrier_commit, text(FRONTEND, "rev-parse", "origin/dwp-dev")), "Auth runtime carrier not pushed")
    blobs: dict[str, bytes] = {}
    for path in (FUTURE_AUTHORITY_REL, FUTURE_REVIEW_REL, FUTURE_VALIDATOR_REL, "package.json"):
        v.exact(mode(FRONTEND, carrier_commit, path), "100644", f"Auth runtime carrier mode drift: {path}")
        item = blob(FRONTEND, carrier_commit, path)
        v.require(item is not None, f"missing Auth runtime carrier artifact: {path}")
        blobs[path] = item or b""
    for path in (FUTURE_AUTHORITY_REL, FUTURE_REVIEW_REL, FUTURE_VALIDATOR_REL):
        current = blob(FRONTEND, frontend_head, path)
        v.require(current is not None, f"current Auth runtime artifact missing: {path}")
        v.exact(artifact(path, current or b""), artifact(path, blobs[path]), f"Auth runtime artifact mutated: {path}")
        v.require(symlink_free(FRONTEND, path), f"live Auth runtime artifact missing or symlinked: {path}")
        v.exact(artifact(path, (FRONTEND / path).read_bytes()), artifact(path, blobs[path]), f"live Auth runtime artifact drift: {path}")
    try:
        compile(blobs[FUTURE_VALIDATOR_REL].decode("utf-8"), FUTURE_VALIDATOR_REL, "exec")
    except (UnicodeDecodeError, SyntaxError) as exc:
        raise VerificationError(f"invalid tenth validator: {exc}") from exc
    forbidden = ("write_" + "text(", "write_" + "bytes(", "O_" + "CREAT", "shell=" + "True")
    future_source = blobs[FUTURE_VALIDATOR_REL].decode("utf-8")
    v.require(not any(token in future_source for token in forbidden), "tenth validator contains write/shell primitive")
    v271_delegation_data = receipt_bytes(v, DELEGATION_RECEIPT, "V271 successor delegation receipt")
    future_authority = load_json(blobs[FUTURE_AUTHORITY_REL], "Auth runtime authority")
    closed(v, future_authority, {
        "schema", "state", "lane", "predecessor", "backendImplementation",
        "delegationBoundary", "authority",
    }, "Auth runtime authority")
    v.exact({key: future_authority.get(key) for key in ("schema", "state", "lane")}, {
        "schema": "dwp.hris.wave7.hrm013-auth-runtime-execution-authority.v1",
        "state": "INDEPENDENTLY_REVIEWED_HASH_BOUND_AUTH_RUNTIME_EXECUTION_AUTHORITY",
        "lane": "AUTH_SERVICE_GRANT_REQUESTER_AND_STEP_UP_CONTROL_PLANE",
    }, "Auth runtime authority identity drift")
    v.exact(future_authority.get("predecessor"), {
        "repository": "dwp-backend", "commit": v271_commit, "tree": v271_tree,
        "v271AuthorityCarrierCommit": carrier["commit"],
        "v271AuthorityCarrierTree": carrier["tree"],
        "v271SuccessorDelegationReceiptSha256": digest(v271_delegation_data),
    }, "Auth runtime predecessor drift")
    implementation = future_authority.get("backendImplementation")
    closed(v, implementation, {
        "repository", "branch", "baseCommit", "baseTree", "operation",
        "requiredDirectChild", "migrationAuthoringAuthorized",
        "directDwpDevIntegrationAuthorized",
    }, "Auth runtime backend implementation")
    v.exact(implementation, {
        "repository": "dwp-backend", "branch": FUTURE_BRANCH,
        "baseCommit": v271_commit, "baseTree": v271_tree,
        "operation": "AUTHOR_VALIDATE_COMMIT_AND_PUSH_AUTH_RUNTIME_ONLY",
        "requiredDirectChild": True, "migrationAuthoringAuthorized": False,
        "directDwpDevIntegrationAuthorized": False,
    }, "Auth runtime backend implementation drift")
    v.exact(future_authority.get("delegationBoundary"), {
        "receiptPath": str(FUTURE_DELEGATION_RECEIPT),
        "receiptSchema": "dwp.hris.wave7.hrm013-auth-runtime-successor-delegation-authority-receipt.v1",
        "receiptState": "HASH_BOUND_REVIEWED_AUTH_RUNTIME_SUCCESSOR_CONTROL_DELEGATION",
        "requiredDecision": "GO_FOR_AUTH_RUNTIME_SUCCESSOR_CONTROL_DELEGATION_ONLY",
        "externalAttestationRequired": True,
        "currentV271AuthorityGrantsRuntime": False,
    }, "Auth runtime delegation boundary drift")
    v.exact(future_authority.get("authority"), FUTURE_AUTHORITY_MAP, "Auth runtime authority map drift")
    review = load_json(blobs[FUTURE_REVIEW_REL], "Auth runtime independent review")
    closed(v, review, {
        "schema", "reviewedAt", "reviewer", "scope", "findings",
        "finalVerdict", "authority", "artifactPins",
    }, "Auth runtime independent review")
    future_review_expected = {
        "schema": "dwp.hris.wave7.hrm013-auth-runtime-execution-authority-independent-review.v1",
        "reviewer": "INDEPENDENT_HRM013_AUTH_RUNTIME_AUTHORITY_REVIEW",
        "scope": {
            "authorityPath": FUTURE_AUTHORITY_REL,
            "validatorPath": FUTURE_VALIDATOR_REL,
            "packagePath": "package.json",
            "reviewedBoundaries": FUTURE_REVIEW_BOUNDARIES,
        },
        "findings": {
            "p0": [], "p1": [], "p2": [],
            "notes": [
                "The carrier may authorize only the Auth service-grant, requester-identity and step-up control-plane runtime from the exact integrated V271 commit.",
                "No migration or Approval, People, Time or Payroll runtime source is authorized by this carrier.",
                "Backend dwp-dev integration, feature activation, tenant enrollment and production release remain externally gated.",
            ],
        },
        "finalVerdict": {
            "p0": 0, "p1": 0, "p2": 0,
            "decision": "GO_FOR_AUTH_RUNTIME_AUTHORITY_CARRIER_COMMIT_AND_PUSH_ONLY",
        },
        "authority": FUTURE_REVIEW_AUTHORITY,
        "artifactPins": [
            artifact(FUTURE_AUTHORITY_REL, blobs[FUTURE_AUTHORITY_REL]),
            artifact(FUTURE_VALIDATOR_REL, blobs[FUTURE_VALIDATOR_REL]),
            artifact("package.json", blobs["package.json"]),
        ],
    }
    v.exact(
        {key: review.get(key) for key in future_review_expected},
        future_review_expected, "Auth runtime review content drift",
    )
    future_reviewed_at = parse_time(review.get("reviewedAt"), "Auth runtime review reviewedAt")
    carrier_committed_at = parse_time(
        text(FRONTEND, "show", "-s", "--format=%cI", carrier_commit),
        "Auth runtime carrier committedAt",
    )
    causal(v, [
        ("Auth runtime review", future_reviewed_at),
        ("Auth runtime carrier commit", carrier_committed_at),
    ])
    expected = {
        "schema": "dwp.hris.wave7.hrm013-auth-runtime-successor-delegation-authority-receipt.v1",
        "state": "HASH_BOUND_REVIEWED_AUTH_RUNTIME_SUCCESSOR_CONTROL_DELEGATION",
        "v271BackendCommit": v271_commit, "v271BackendTree": v271_tree,
        "runtimeAuthorityCarrierCommit": carrier_commit,
        "runtimeAuthorityCarrierTree": text(FRONTEND, "rev-parse", f"{carrier_commit}^{{tree}}"),
        "runtimeAuthorityCarrierParentCommit": parent,
        "runtimeAuthorityArtifact": artifact(FUTURE_AUTHORITY_REL, blobs[FUTURE_AUTHORITY_REL]),
        "runtimeValidatorArtifact": artifact(FUTURE_VALIDATOR_REL, blobs[FUTURE_VALIDATOR_REL]),
        "runtimeIndependentReviewArtifact": artifact(FUTURE_REVIEW_REL, blobs[FUTURE_REVIEW_REL]),
        "runtimePackageArtifact": artifact("package.json", blobs["package.json"]),
        "authorizedBackendBranch": FUTURE_BRANCH,
        "authorizedBackendParentCommit": v271_commit,
        "p0": 0, "p1": 0, "p2": 0,
        "decision": "GO_FOR_AUTH_RUNTIME_SUCCESSOR_CONTROL_DELEGATION_ONLY",
        "recordedBy": "INDEPENDENT_HRM013_AUTH_RUNTIME_SUCCESSOR_DELEGATION_REVIEW",
    }
    v.exact({key: receipt.get(key) for key in expected}, expected, "Auth runtime delegation evidence drift")
    authorized = receipt.get("authorizedBackendCommit")
    v.require(isinstance(authorized, str) and re.fullmatch(r"[0-9a-f]{40}", authorized or "") is not None, "invalid Auth runtime backend commit")
    authorized = str(authorized)
    v.exact(text(BACKEND, "rev-list", "--parents", "-n", "1", authorized).split(), [authorized, v271_commit], "Auth runtime commit is not direct child of V271")
    changed = sorted(between(BACKEND, v271_commit, authorized))
    v.require(bool(changed) and all(canonical(path) for path in changed), "invalid Auth runtime changed paths")
    v.require(not any("/db/migration/" in path for path in changed), "Auth runtime successor contains migration")
    v.exact(receipt.get("authorizedBackendChangedPaths"), changed, "Auth runtime changed-path evidence drift")
    authorized_tree = text(BACKEND, "rev-parse", f"{authorized}^{{tree}}")
    v.exact(receipt.get("authorizedBackendTree"), authorized_tree, "Auth runtime backend tree drift")
    remote = run(BACKEND, "rev-parse", "--verify", f"refs/remotes/origin/{FUTURE_BRANCH}", check=False)
    v.require(remote.returncode == 0, "Auth runtime branch is not pushed")
    if remote.returncode == 0:
        v.exact(remote.stdout.decode().strip(), authorized, "Auth runtime remote branch drift")
    governance_path = RECEIPTS / "backend-descendants" / f"{authorized}.hrm013-shared-contract-governance.v1.json"
    governance_data = receipt_bytes(v, governance_path, "Auth runtime descendant-governance receipt")
    governance = load_json(governance_data, "Auth runtime descendant-governance receipt")
    governance_expected = {
        "schema": "dwp.hris.wave7.hrm013-shared-contract-backend-descendant-governance-receipt.v1",
        "state": "REVIEWED_ORDERED_BACKEND_DESCENDANT_GOVERNANCE_SHARED_ELEVEN_BLOBS_IMMUTABLE",
        "immediateParentCommit": v271_commit,
        "descendantCommit": authorized,
        "descendantTree": authorized_tree,
        "descendantChangedPaths": changed,
        "p0": 0, "p1": 0, "p2": 0,
        "decision": "GO_FOR_EXACT_BACKEND_DESCENDANT_GOVERNANCE_ONLY",
    }
    v.exact(
        {key: governance.get(key) for key in governance_expected},
        governance_expected, "Auth runtime governance evidence drift",
    )
    expected.update({
        "authorizedBackendCommit": authorized,
        "authorizedBackendTree": authorized_tree,
        "authorizedBackendChangedPaths": changed,
        "backendDescendantGovernanceReceiptPath": str(governance_path),
        "backendDescendantGovernanceReceiptSha256": digest(governance_data),
        "backendCommitCommittedAt": text(BACKEND, "show", "-s", "--format=%cI", authorized),
        "runtimeReviewReviewedAt": review.get("reviewedAt"),
        "runtimeCarrierCommittedAt": text(FRONTEND, "show", "-s", "--format=%cI", carrier_commit),
        "backendGovernanceReceiptRecordedAt": governance.get("recordedAt"),
    })
    v.exact({key: receipt.get(key) for key in expected}, expected, "Auth runtime delegation evidence drift")
    causal(v, [
        ("Auth runtime review", future_reviewed_at),
        ("Auth runtime carrier commit", carrier_committed_at),
        ("Auth runtime carrier push", parse_time(receipt.get("runtimeCarrierPushObservedAt"), "runtimeCarrierPushObservedAt")),
        ("Auth runtime backend commit", parse_time(receipt.get("backendCommitCommittedAt"), "backendCommitCommittedAt")),
        ("Auth runtime governance", parse_time(receipt.get("backendGovernanceReceiptRecordedAt"), "backendGovernanceReceiptRecordedAt")),
        ("Auth runtime delegation", parse_time(receipt.get("recordedAt"), "runtime delegation recordedAt")),
    ])
    v.require(ancestor(BACKEND, authorized, backend_head), "backend head predates Auth runtime delegated commit")
    return "AUTH_RUNTIME_SUCCESSOR_CONTROL_DELEGATED_TO_FIXED_TENTH_VALIDATOR"


def negatives(v: V) -> None:
    for raw in (b'{"x":1,"x":2}', b'{"x":NaN}', b'{"x":Infinity}'):
        try:
            load_json(raw, "negative fixture")
        except VerificationError:
            continue
        raise VerificationError("invalid JSON fixture accepted")
    for unsafe in ("../x", "/x", "a//b", "a/./b", "a\\b"):
        v.require(not canonical(unsafe), f"unsafe path accepted: {unsafe}")
    v.require(canonical(MIGRATION_REL), "authorized migration path is noncanonical")
    v.require(
        LANE_PATHS == {
            MIGRATION_REL, GRANT_POSTGRES_TEST_REL, CONTRACT_TEST_REL,
            ACTIVATION_POSTGRES_TEST_REL,
        },
        "lane allowlist fixture drift",
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--authoring", action="store_true")
    parser.add_argument("--require-trusted", action="store_true")
    args = parser.parse_args()
    v = V()
    try:
        isolated = runtime(v, args.require_trusted or args.authoring)
        negatives(v)
        check_predecessor_pins(v)
        if args.authoring:
            state = authoring(v)
        else:
            verify_repository(v, FRONTEND, require_clean=True)
            verify_repository(v, BACKEND, require_clean=True)
            carrier, _ = historical(v)
            v.exact(text(BACKEND, "branch", "--show-current"), "dwp-dev", "backend default branch drift")
            backend_head = text(BACKEND, "rev-parse", "HEAD")
            v.exact(text(BACKEND, "rev-parse", "origin/dwp-dev"), backend_head, "backend origin drift")
            if backend_head == BACKEND_BASE:
                v.require(not DELEGATION_RECEIPT.exists(), "V271 delegation receipt precedes backend fast-forward")
                v.require(not FUTURE_DELEGATION_RECEIPT.exists(), "Auth runtime receipt precedes V271 integration")
                state = check_lane(v, carrier)
            else:
                _, lane_commit, lane_tree, _ = lane_evidence_from_delegation(v, carrier)
                v.require(ancestor(BACKEND, lane_commit, backend_head), "backend head does not contain delegated V271 commit")
                if backend_head == lane_commit:
                    v.require(not FUTURE_DELEGATION_RECEIPT.exists(), "Auth runtime receipt exists at exact V271 head")
                    state = "AUTH_V271_DIRECT_FAST_FORWARD_INTEGRATED"
                else:
                    state = future_handoff(v, carrier, lane_commit, lane_tree, backend_head)
        print(
            f"PASS state={state} checks={v.checks} "
            f"trusted_runtime={'true' if isolated else 'false'} receipt_issuance=external-only"
        )
        return 0
    except (VerificationError, OSError, UnicodeError, KeyError, TypeError) as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
