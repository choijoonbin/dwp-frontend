#!/usr/bin/env python3
"""Fail-closed HRM-013 Auth v62 generation-preparation authority validator.

Use ``/usr/bin/python3 -I`` and ``--require-trusted`` for authoritative runs.
This program is read-only and never creates branches, worktrees, receipts, source,
generated artifacts, commits, or pushes.
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

LIFECYCLE_CORRECTION_BASE = "50cf521fd38f09f1a930582562fd15f7c4bc126b"
LIFECYCLE_CORRECTION_BASE_TREE = "830b484b5a3b338e984bbecd4be71236e611a86c"
LIFECYCLE_CORRECTION_BRANCH = (
    "codex/hris-wave7-batch06-hrm013-validator-lifecycle-"
    "correction-frontend-20261027-r1"
)
LIFECYCLE_CORRECTION_ROOT = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-validator-lifecycle-successor-r1"
)
LIFECYCLE_CORRECTION_AUTHORITY = (
    f"{LIFECYCLE_CORRECTION_ROOT}/validator-lifecycle-successor-authority.v1.json"
)
LIFECYCLE_CORRECTION_REVIEW = f"{LIFECYCLE_CORRECTION_ROOT}/independent-review.v1.json"
LIFECYCLE_CORRECTION_VALIDATOR = (
    f"{LIFECYCLE_CORRECTION_ROOT}/validate_hrm013_validator_lifecycle_successor.py"
)
LIFECYCLE_SEVENTH_VALIDATOR = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-auth-v62-generation-r1/"
    "validate_hrm013_auth_v62_generation_authority.py"
)
LIFECYCLE_EIGHTH_VALIDATOR = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-auth-v62-generation-integration-r1/"
    "validate_hrm013_auth_v62_generation_integration.py"
)
LIFECYCLE_NINTH_VALIDATOR = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-auth-v271-authority-r1/"
    "validate_hrm013_auth_v271_authority.py"
)
LIFECYCLE_VALIDATORS = [
    LIFECYCLE_SEVENTH_VALIDATOR,
    LIFECYCLE_EIGHTH_VALIDATOR,
    LIFECYCLE_NINTH_VALIDATOR,
]
LIFECYCLE_CORRECTION_PATHS = {
    *LIFECYCLE_VALIDATORS,
    LIFECYCLE_CORRECTION_AUTHORITY,
    LIFECYCLE_CORRECTION_REVIEW,
    LIFECYCLE_CORRECTION_VALIDATOR,
    "package.json",
}
APPROVAL_INTEGRATION_COMMIT = "2479ef3da2185668ec8dcbe4815cd6ba3caa0986"
APPROVAL_INTEGRATION_TREE = "8e99270400e5c47928d659a7ba4fe0552963445f"
APPROVAL_INTEGRATION_PARENT = "b2fa6d56f16ce5befe0e366ca55d34ef8f42f58e"
HARDENED_AUTH_RUNTIME_VALIDATOR = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-auth-runtime-authority-r1/"
    "validate_hrm013_auth_runtime_authority.py"
)
APPROVAL_INTEGRATION_PATHS = {
    "package.json",
    HARDENED_AUTH_RUNTIME_VALIDATOR,
    "docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-hrm013-approval-readiness-authority-r1/validate_hrm013_approval_readiness_authority.py",
    "docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-hrm013-approval-readiness-successor-r1/validate_hrm013_approval_readiness_successor.py",
    "docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-hrm013-owner-runtime-phase4-authority-r1/validate_hrm013_owner_runtime_phase4_authority.py",
    "docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-hrm013-approval-drain-clarification-r1/validate_hrm013_approval_drain_clarification.py",
    "docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-hrm013-approval-runtime-integration-r1/approval-runtime-central-integration-authority.v1.json",
    "docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-hrm013-approval-runtime-integration-r1/independent-review.v1.json",
    "docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-hrm013-approval-runtime-integration-r1/validate_hrm013_approval_runtime_integration.py",
}


FRONTEND_BASE = "b3841a03d3ee60864b721cc1d98397c3004de1d8"
FRONTEND_TREE = "127540e50eae673fbf63bb96b025a8a0e641e5ea"
BACKEND_BASE = "3505cb2e84fc73f97d62de385cc347c5f8c81572"
BACKEND_TREE = "fa84a79668fd0f133d34c81d5a649747a6c527b6"

ROOT_REL = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-auth-v62-generation-r1"
)
AUTHORITY_REL = f"{ROOT_REL}/auth-v62-generation-execution-authority.v1.json"
TOKEN_REL = f"{ROOT_REL}/auth-v62-generation.start-token.v1.json"
REVIEW_REL = f"{ROOT_REL}/independent-review.v1.json"
VALIDATOR_REL = f"{ROOT_REL}/validate_hrm013_auth_v62_generation_authority.py"
CARRIER_PATHS = {"package.json", AUTHORITY_REL, TOKEN_REL, REVIEW_REL, VALIDATOR_REL}
AUTHORITY_BYTES = 28892
AUTHORITY_SHA = "5e1fcb96b785746eda572c2af1918340b776fcb4e5d152900f8ea29acabc2350"
TOKEN_BYTES = 6459
TOKEN_SHA = "c79e902bcc38d20940142685f3403c4ae9c68f8b501807d168d68993a2874fab"

SIXTH_REL = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-shared-contract-integration-r1/"
    "validate_hrm013_shared_contract_integration.py"
)
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
    f"python3 {SIXTH_REL}"
)
CURRENT_SCRIPT = PREDECESSOR_SCRIPT + " && python3 " + VALIDATOR_REL

LANE = "codex/hris-wave7-batch06-hrm013-auth-v62-generation-backend-20261026-r1"
WORKTREE = Path(
    "/Users/a10697/Work/DWP/.codex-worktrees/hris/wave7-20261026/"
    "batch06/hrm013-owner-runtime/auth-v62-generation"
)
RECEIPTS = Path(
    "/Users/a10697/Work/DWP/.codex-worktrees/hris/wave7-20261026/"
    "batch06/hrm013-owner-runtime/receipts"
)
CLEAN_RECEIPT = RECEIPTS / "auth-v62-generation-clean-worktree-receipt.v1.json"
TARGETED_RECEIPT = RECEIPTS / "auth-v62-generation-targeted-verification-receipt.v1.json"
POST_REVIEW_RECEIPT = RECEIPTS / "auth-v62-generation-post-implementation-review.v1.json"
CENTRAL_INTEGRATION_RECEIPT = RECEIPTS / "auth-v62-generation-central-integration-authority.v1.json"
CENTRAL_RECEIPT = RECEIPTS / "shared-central-integration-authority.v1.json"
CENTRAL_SHA = "742db293eee814cbb038eede1222a2841c711346101ea1c466e2051c276ad672"
EMPTY_SHA = hashlib.sha256(b"").hexdigest()

FUTURE_ROOT_REL = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-auth-v62-generation-integration-r1"
)
FUTURE_AUTHORITY_REL = f"{FUTURE_ROOT_REL}/auth-v62-generation-central-integration-authority.v1.json"
FUTURE_REVIEW_REL = f"{FUTURE_ROOT_REL}/independent-review.v1.json"
FUTURE_VALIDATOR_REL = f"{FUTURE_ROOT_REL}/validate_hrm013_auth_v62_generation_integration.py"
FUTURE_CARRIER_PATHS = {
    "package.json", FUTURE_AUTHORITY_REL, FUTURE_REVIEW_REL, FUTURE_VALIDATOR_REL,
}
GOVERNANCE_ROOT_REL = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-backend-descendant-governance"
)

SAFE_GIT_ENV = {
    "PATH": "/usr/bin:/bin", "HOME": "/var/empty", "LC_ALL": "C", "LANG": "C",
    "GIT_CONFIG_NOSYSTEM": "1", "GIT_CONFIG_GLOBAL": "/dev/null",
    "GIT_NO_REPLACE_OBJECTS": "1",
}
TRUSTED_ENV = {
    "PATH": "/usr/bin:/bin", "HOME": "/var/empty", "LC_ALL": "C", "LANG": "C",
    "CPATH": "/usr/local/include", "LIBRARY_PATH": "/usr/local/lib",
    "MANPATH": "/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/share/man:/Library/Developer/CommandLineTools/usr/share/man:/Library/Developer/CommandLineTools/Toolchains/XcodeDefault.xctoolchain/usr/share/man:",
    "SDKROOT": "/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk",
    "__CF_USER_TEXT_ENCODING": "0x1F7:0x3:0x33",
}
TRUSTED_PYTHONS = {
    Path("/usr/bin/python3").resolve(),
    Path("/Library/Developer/CommandLineTools/usr/bin/python3").resolve(),
}
UNSAFE_ENV = {
    "GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_OBJECT_DIRECTORY",
    "GIT_ALTERNATE_OBJECT_DIRECTORIES", "GIT_COMMON_DIR",
    "GIT_CEILING_DIRECTORIES", "GIT_DISCOVERY_ACROSS_FILESYSTEM", "GIT_CONFIG",
    "GIT_CONFIG_COUNT", "GIT_CONFIG_PARAMETERS", "GIT_CONFIG_SYSTEM",
    "GIT_EXEC_PATH", "GIT_ATTR_NOSYSTEM", "GIT_OPTIONAL_LOCKS", "GIT_EXTERNAL_DIFF",
}

REVIEW_BOUNDARIES = [
    "EXACT_PREDECESSOR_CARRIER_AND_CENTRAL_RECEIPT_PINS",
    "EXACT_SEMANTIC_AUTHORITY_AND_SERVICE_BINDING_REGISTER_PINS",
    "EXACT_BACKEND_BASE_GENERATOR_INPUTS_AND_MAXIMUM_CHANGED_PATHS",
    "CARRIER_PUSH_AND_EXTERNAL_CLEAN_WORKTREE_RECEIPT_REQUIRED",
    "ONE_RUN_V62_DRAFT_GENERATION_AND_TARGETED_VERIFICATION_ONLY",
    "FIXED_EIGHTH_VALIDATOR_CARRIER_EXTERNAL_RECEIPT_AND_DIRECT_FAST_FORWARD_HANDOFF",
    "NO_V271_MIGRATION_RUNTIME_UI_ACTIVATION_OR_PRODUCTION_AUTHORITY",
]
REVIEW_AUTHORITY = {
    "independentReviewComplete": True,
    "carrierCommitAndPushAuthorized": True,
    "cleanWorktreeMaterializationAuthorizedAfterCarrierPush": True,
    "authV62GenerationAuthorizedAfterCleanReceipt": True,
    "backendDwpDevIntegrationAuthorized": False,
    "authV271ReservationAuthorized": False,
    "authV271ImplementationAuthorized": False,
    "migrationAuthoringAuthorized": False,
    "runtimeImplementationAuthorized": False,
    "productionReleaseAuthorized": False,
    "businessCompletionCredit": 0,
}
FUTURE_AUTHORITY_MAP = {
    "independentReviewComplete": True,
    "externalCentralIntegrationReceiptRequired": True,
    "exactGenerationCommitDirectFastForwardAuthorizedAfterReceipt": True,
    "differentBackendTargetAuthorized": False,
    "mergeRebaseSquashOrCherryPickAuthorized": False,
    "authV271ReservationAuthorized": False,
    "authV271ImplementationAuthorized": False,
    "migrationAuthoringAuthorized": False,
    "runtimeImplementationAuthorized": False,
    "featureEnablementAuthorized": False,
    "tenantEnrollmentAuthorized": False,
    "productionReleaseAuthorized": False,
    "businessCompletionCredit": 0,
}
FUTURE_REVIEW_AUTHORITY = {
    "independentReviewComplete": True,
    "carrierCommitAndPushAuthorized": True,
    "externalReceiptIssuanceAuthorizedAfterCarrierPush": True,
    "exactGenerationCommitDirectFastForwardAuthorizedAfterReceipt": True,
    "authV271ReservationAuthorized": False,
    "authV271ImplementationAuthorized": False,
    "migrationAuthoringAuthorized": False,
    "runtimeImplementationAuthorized": False,
    "productionReleaseAuthorized": False,
    "businessCompletionCredit": 0,
}
FUTURE_REVIEW_BOUNDARIES = [
    "GENERATION_AUTHORITY_CARRIER_AND_FIVE_ARTIFACT_PINS",
    "EXACT_GENERATION_LANE_COMMIT_TREE_PATHS_AND_RECEIPTS",
    "DESCENDANT_GOVERNANCE_CARRIER_ARTIFACT_AND_RECEIPT_PINS",
    "EXTERNAL_CENTRAL_INTEGRATION_RECEIPT_REQUIRED",
    "DIRECT_FAST_FORWARD_TO_EXACT_GENERATION_COMMIT_ONLY",
    "NO_V271_MIGRATION_RUNTIME_ACTIVATION_OR_PRODUCTION_AUTHORITY",
]

MAXIMUM_CHANGED_PATHS = [
    "contracts/product-authorization/product-surfaces-v1.yaml",
    "scripts/generate-product-authorization-contracts.py",
    "scripts/generate-product-authorization-fixtures.py",
    "scripts/tests/test_product_authorization_v61.py",
    "scripts/tests/test_product_authorization_v62.py",
    "contracts/product-authorization/product-surfaces-v1.json",
    "contracts/product-authorization/product-surfaces-v1.bundle-v62.json",
    "contracts/product-authorization/product-surfaces-v1.index.json",
    "contracts/product-authorization/pilot-fixtures.v1.generated.json",
    "dwp-auth-server/src/main/resources/product-authorization/product-surfaces-v1.generated.json",
    "dwp-auth-server/src/main/resources/product-authorization/product-surfaces-v1.bundle-v62.generated.json",
    "dwp-auth-server/src/main/resources/product-authorization/product-surfaces-v1.index.generated.json",
    "dwp-approval-server/src/main/resources/product-authorization/approval-pilot-pep-v62.generated.json",
    "dwp-payroll-server/src/main/resources/product-authorization/hcm-payroll-pep-v62.generated.json",
    "dwp-people-server/src/main/resources/product-authorization/hcm-people-pep-v62.generated.json",
    "dwp-platform-server/src/main/resources/product-authorization/hcm-platform-pep-v62.generated.json",
    "dwp-time-server/src/main/resources/product-authorization/hcm-time-pep-v62.generated.json",
    "dwp-auth-server/src/main/java/com/dwp/services/auth/service/ProductAuthorizationContractValidator.java",
    "dwp-auth-server/src/main/java/com/dwp/services/auth/service/ProductAuthorizationReleaseLineage.java",
    "dwp-auth-server/src/test/java/com/dwp/services/auth/config/ProductAuthorizationSeedLoaderTest.java",
    "dwp-auth-server/src/test/java/com/dwp/services/auth/service/ProductAuthorizationContractReleaseLineageTest.java",
    "dwp-auth-server/src/test/java/com/dwp/services/auth/service/ProductAuthorizationReleaseLineageTest.java",
    "dwp-auth-server/src/test/java/com/dwp/services/auth/service/ProductAuthorizationV62ContractTest.java",
    "dwp-auth-server/src/test/java/com/dwp/services/auth/support/PilotAuthorizationFixtureAdapter.java",
    "dwp-auth-server/src/test/java/com/dwp/services/auth/support/PilotAuthorizationFixtureAdapterTest.java",
    "dwp-gateway/src/test/java/com/dwp/gateway/support/PilotAuthorizationFixtureAdapter.java",
    "dwp-gateway/src/test/java/com/dwp/gateway/support/PilotAuthorizationFixtureAdapterTest.java",
    "dwp-approval-server/src/test/java/com/dwp/services/approval/security/ApprovalRelease62PepContractTest.java",
    "dwp-gateway/src/test/java/com/dwp/gateway/ProductSurfaceDecisionContextFilterTest.java",
    "dwp-gateway/src/test/java/com/dwp/gateway/productsurface/GeneratedProductRouteCatalogTest.java",
]
COMPATIBILITY_SOURCE_PATHS = {
    "dwp-auth-server/src/main/java/com/dwp/services/auth/service/ProductAuthorizationContractValidator.java",
    "dwp-auth-server/src/main/java/com/dwp/services/auth/service/ProductAuthorizationReleaseLineage.java",
}
PREMATERIALIZATION_ABSENT_PATHS = {
    path for path in MAXIMUM_CHANGED_PATHS
    if "v62" in path.lower() or "release62" in path.lower()
}
SOURCE_TEST_SHADOW_ROOTS = [
    "contracts/product-authorization", "scripts",
    "dwp-auth-server/src", "dwp-approval-server/src", "dwp-gateway/src",
    "dwp-payroll-server/src", "dwp-people-server/src", "dwp-platform-server/src",
    "dwp-time-server/src",
]
BUILD_SHADOW_ROOTS = [
    ".gradle", "build",
    "dwp-auth-server/.gradle", "dwp-auth-server/build",
    "dwp-approval-server/.gradle", "dwp-approval-server/build",
    "dwp-gateway/.gradle", "dwp-gateway/build",
    "dwp-payroll-server/.gradle", "dwp-payroll-server/build",
    "dwp-people-server/.gradle", "dwp-people-server/build",
    "dwp-platform-server/.gradle", "dwp-platform-server/build",
    "dwp-time-server/.gradle", "dwp-time-server/build",
]


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
        self.require(strict_equal(actual, expected), message)


def strict_equal(actual: Any, expected: Any) -> bool:
    if type(actual) is not type(expected):
        return False
    if isinstance(expected, dict):
        return set(actual) == set(expected) and all(
            type(key) is str and strict_equal(actual[key], expected[key]) for key in expected
        )
    if isinstance(expected, list):
        return len(actual) == len(expected) and all(
            strict_equal(left, right) for left, right in zip(actual, expected)
        )
    return actual == expected


def duplicate_guard(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise VerificationError(f"duplicate JSON key: {key}")
        result[key] = value
    return result


def nonfinite(value: str) -> Any:
    raise VerificationError(f"non-finite JSON number: {value}")


def load_json(data: bytes, label: str) -> dict[str, Any]:
    try:
        value = json.loads(
            data.decode("utf-8"), object_pairs_hook=duplicate_guard, parse_constant=nonfinite
        )
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise VerificationError(f"invalid JSON {label}: {exc}") from exc
    if not isinstance(value, dict):
        raise VerificationError(f"JSON root is not an object: {label}")
    return value


def closed(v: V, value: Any, keys: set[str], label: str) -> None:
    v.require(isinstance(value, dict), f"{label} must be an object")
    if isinstance(value, dict):
        v.exact(set(value), keys, f"{label} key set drift")


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def artifact(path: str, data: bytes) -> dict[str, Any]:
    return {"path": path, "bytes": len(data), "sha256": digest(data)}


def parse_time(value: Any, label: str) -> datetime:
    pattern = r"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:Z|[+-][0-9]{2}:[0-9]{2})"
    if type(value) is not str or re.fullmatch(pattern, value) is None:
        raise VerificationError(f"{label} is not whole-second RFC3339")
    try:
        result = datetime.fromisoformat(value[:-1] + "+00:00" if value.endswith("Z") else value)
    except ValueError as exc:
        raise VerificationError(f"invalid {label}") from exc
    if result.tzinfo is None or result.utcoffset() is None:
        raise VerificationError(f"{label} lacks timezone")
    return result.astimezone(timezone.utc)


def causal(v: V, events: list[tuple[str, datetime]]) -> None:
    for (left_name, left), (right_name, right) in zip(events, events[1:]):
        v.require(left <= right, f"{left_name} follows {right_name}")
    for name, value in events:
        v.require(value <= datetime.now(timezone.utc) + timedelta(minutes=5), f"future {name}")


def canonical(path: str) -> bool:
    if type(path) is not str or not path:
        return False
    parsed = PurePosixPath(path)
    return not parsed.is_absolute() and parsed.as_posix() == path and all(
        part not in {"", ".", ".."} for part in parsed.parts
    )


def symlink_free(root: Path, relative: str) -> bool:
    if not canonical(relative):
        return False
    root = root.absolute()
    if root != root.resolve() or root.is_symlink():
        return False
    current = root
    for part in PurePosixPath(relative).parts:
        current /= part
        try:
            if stat.S_ISLNK(current.lstat().st_mode):
                return False
        except FileNotFoundError:
            return False
    try:
        current.resolve().relative_to(root.resolve())
    except ValueError:
        return False
    return True


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


def read_receipt(path: Path, label: str) -> bytes:
    parent = open_directory(path.parent)
    descriptor = -1
    try:
        descriptor = os.open(path.name, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0), dir_fd=parent)
        before = os.fstat(descriptor)
        if (
            not stat.S_ISREG(before.st_mode) or stat.S_IMODE(before.st_mode) != 0o600
            or before.st_uid != os.geteuid() or before.st_nlink != 1 or before.st_size > 65536
        ):
            raise VerificationError(f"unsafe {label} file metadata")
        with os.fdopen(descriptor, "rb", closefd=True) as stream:
            descriptor = -1
            data = stream.read(65537)
            after = os.fstat(stream.fileno())
        stable = ("st_dev", "st_ino", "st_mode", "st_uid", "st_nlink", "st_size", "st_mtime_ns")
        if len(data) != before.st_size or len(data) > 65536:
            raise VerificationError(f"unstable or oversized {label}")
        if any(getattr(before, key) != getattr(after, key) for key in stable):
            raise VerificationError(f"{label} changed while read")
        return data
    finally:
        if descriptor >= 0:
            os.close(descriptor)
        os.close(parent)


def present(path: Path) -> bool:
    return path.exists() or path.is_symlink()


def git(repo: Path, *args: str, check: bool = True) -> subprocess.CompletedProcess[bytes]:
    result = subprocess.run(
        [GIT, *args], cwd=repo, env=SAFE_GIT_ENV, stdout=subprocess.PIPE,
        stderr=subprocess.PIPE, check=False, shell=False,
    )
    if check and result.returncode:
        raise VerificationError(
            f"git {' '.join(args)} failed: {result.stderr.decode('utf-8', errors='replace').strip()}"
        )
    return result


def text(repo: Path, *args: str) -> str:
    return git(repo, *args).stdout.decode("utf-8", errors="strict").strip()


def blob(repo: Path, revision: str, path: str) -> bytes | None:
    result = git(repo, "show", f"{revision}:{path}", check=False)
    return result.stdout if result.returncode == 0 else None


def mode(repo: Path, revision: str, path: str) -> str | None:
    output = text(repo, "ls-tree", revision, "--", path)
    fields = output.split(None, 3) if output else []
    return fields[0] if len(fields) == 4 and fields[3] == path else None


def nul(data: bytes) -> set[str]:
    return {item.decode("utf-8", errors="strict") for item in data.split(b"\0") if item}


def changes(repo: Path) -> set[str]:
    return (
        nul(git(repo, "diff", "--name-only", "-z", "HEAD", "--").stdout)
        | nul(git(repo, "diff", "--cached", "--name-only", "-z", "HEAD", "--").stdout)
        | nul(git(repo, "ls-files", "--others", "--exclude-standard", "-z").stdout)
    )


def shadow(repo: Path, *, ignored: bool, roots: list[str]) -> set[str]:
    args = ["ls-files", "--others"]
    if ignored:
        args.extend(["--ignored", "--exclude-standard"])
    else:
        args.append("--exclude-standard")
    args.extend(["-z", "--", *roots])
    return nul(git(repo, *args).stdout)


def final_shadow_absence(v: V, repo: Path) -> None:
    v.require(not shadow(repo, ignored=True, roots=SOURCE_TEST_SHADOW_ROOTS), "ignored source/test shadow exists")
    v.require(not shadow(repo, ignored=False, roots=SOURCE_TEST_SHADOW_ROOTS), "untracked source/test shadow exists")
    v.require(not shadow(repo, ignored=True, roots=BUILD_SHADOW_ROOTS), "ignored build shadow exists")
    v.require(not shadow(repo, ignored=False, roots=BUILD_SHADOW_ROOTS), "untracked build shadow exists")


def between(repo: Path, older: str, newer: str) -> set[str]:
    return nul(git(repo, "diff", "--name-only", "-z", f"{older}..{newer}", "--").stdout)


def ancestor(repo: Path, older: str, newer: str) -> bool:
    return git(repo, "merge-base", "--is-ancestor", older, newer, check=False).returncode == 0


def git_artifact(repo: Path, revision: str, path: str) -> dict[str, Any]:
    data = blob(repo, revision, path)
    if data is None:
        raise VerificationError(f"missing Git blob {revision}:{path}")
    return artifact(path, data)


def runtime(v: V, required: bool) -> bool:
    inherited = sorted(
        key for key in os.environ
        if key in UNSAFE_ENV or key.startswith("GIT_CONFIG_KEY_") or key.startswith("GIT_CONFIG_VALUE_")
    )
    v.require(not inherited, f"unsafe inherited Git environment: {inherited}")
    isolated = bool(sys.flags.isolated) and Path(sys.executable).resolve() in TRUSTED_PYTHONS
    if required:
        v.require(isolated, "trusted validation requires /usr/bin/python3 -I")
        v.exact(dict(os.environ), TRUSTED_ENV, "trusted env -i allowlist drift")
    return isolated


def hygiene(v: V, repo: Path) -> None:
    v.exact(Path(text(repo, "rev-parse", "--show-toplevel")).resolve(), repo.resolve(), "Git root drift")
    v.require(not text(repo, "for-each-ref", "--format=%(refname)", "refs/replace/"), "replace refs forbidden")
    unsafe = git(
        repo, "config", "--get-regexp",
        r"^(core\.sparseCheckout|core\.sparseCheckoutCone|core\.fsmonitor|diff\.external|diff\..*\.command)$",
        check=False,
    )
    v.require(unsafe.returncode == 1 and not unsafe.stdout, "unsafe Git config")
    tags = [entry[:1] for entry in git(repo, "ls-files", "-v", "-z").stdout.split(b"\0") if entry]
    v.require(not [tag for tag in tags if tag != b"H"], "assume-unchanged or skip-worktree forbidden")


def expected_package() -> bytes:
    data = blob(FRONTEND, FRONTEND_BASE, "package.json")
    if data is None:
        raise VerificationError("predecessor package missing")
    package = load_json(data, "predecessor package")
    scripts = package.get("scripts")
    if not isinstance(scripts, dict) or scripts.get("hris:current-contracts:check") != PREDECESSOR_SCRIPT:
        raise VerificationError("predecessor validator chain drift")
    old = json.dumps(PREDECESSOR_SCRIPT, ensure_ascii=False).encode()[1:-1]
    new = json.dumps(CURRENT_SCRIPT, ensure_ascii=False).encode()[1:-1]
    if data.count(old) != 1:
        raise VerificationError("predecessor command bytes missing or ambiguous")
    return data.replace(old, new, 1)


def check_package(v: V, data: bytes, exact: bool) -> None:
    if exact:
        v.exact(data, expected_package(), "package is not exact seventh-validator append")
    package = load_json(data, "package")
    scripts = package.get("scripts")
    v.require(isinstance(scripts, dict), "scripts missing")
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
    v.require(parts[: len(sealed)] == sealed, "sealed validator prefix drift")
    pattern = re.compile(r"python3 (docs/06-delivery/hris/[A-Za-z0-9._/-]+/validate_[A-Za-z0-9_]+\.py)")
    matched = [pattern.fullmatch(part) for part in parts]
    v.require(all(matched), "non-validator command in validator chain")
    paths = [match.group(1) for match in matched if match]
    v.require(len(paths) == len(set(paths)), "duplicate validator command")
    v.exact(paths[5:7], [SIXTH_REL, VALIDATOR_REL], "sixth/seventh order drift")


def expected_future_package(parent: str) -> bytes:
    data = blob(FRONTEND, parent, "package.json")
    if data is None:
        raise VerificationError("future carrier parent package missing")
    package = load_json(data, "future carrier parent package")
    scripts = package.get("scripts")
    if not isinstance(scripts, dict) or scripts.get("hris:current-contracts:check") != CURRENT_SCRIPT:
        raise VerificationError("future carrier parent does not end at seventh validator")
    successor = CURRENT_SCRIPT + " && python3 " + FUTURE_VALIDATOR_REL
    old = json.dumps(CURRENT_SCRIPT, ensure_ascii=False).encode()[1:-1]
    new = json.dumps(successor, ensure_ascii=False).encode()[1:-1]
    if data.count(old) != 1:
        raise VerificationError("future package append bytes missing or ambiguous")
    return data.replace(old, new, 1)


def validate_python(v: V, data: bytes, label: str) -> None:
    try:
        source = data.decode("utf-8")
        compile(source, label, "exec")
    except (UnicodeDecodeError, SyntaxError) as exc:
        raise VerificationError(f"invalid Python {label}: {exc}") from exc
    forbidden = ("write_" + "text(", "write_" + "bytes(", "O_" + "CREAT", "shell=" + "True")
    v.require(not any(token in source for token in forbidden), f"{label} contains write/shell primitive")


def check_predecessors(v: V) -> None:
    v.exact(text(FRONTEND, "rev-parse", f"{FRONTEND_BASE}^{{tree}}"), FRONTEND_TREE, "frontend base tree drift")
    v.exact(text(BACKEND, "rev-parse", f"{BACKEND_BASE}^{{tree}}"), BACKEND_TREE, "backend base tree drift")
    central = read_receipt(CENTRAL_RECEIPT, "central receipt")
    v.exact((len(central), digest(central)), (4186, CENTRAL_SHA), "central receipt pin drift")
    authority = load_json((FRONTEND / AUTHORITY_REL).read_bytes(), "authority")
    for expected in authority["predecessorArtifacts"][:-1]:
        v.exact(git_artifact(FRONTEND, FRONTEND_BASE, expected["path"]), expected, f"predecessor artifact drift: {expected['path']}")
    for expected in authority["semanticAuthorityPins"]:
        expected_pin = {key: expected[key] for key in ("path", "bytes", "sha256")}
        v.exact(git_artifact(FRONTEND, expected["introducingCommit"], expected["path"]), expected_pin, f"semantic artifact drift: {expected['path']}")
        v.exact(text(FRONTEND, "rev-parse", f"{expected['introducingCommit']}^{{tree}}"), expected["introducingTree"], "semantic carrier tree drift")
    for expected in authority["backendBase"]["inputPins"]:
        v.exact(git_artifact(BACKEND, BACKEND_BASE, expected["path"]), expected, f"backend input drift: {expected['path']}")


def check_authority_and_token(v: V, authority_data: bytes, token_data: bytes) -> tuple[dict[str, Any], dict[str, Any]]:
    v.exact((len(authority_data), digest(authority_data)), (AUTHORITY_BYTES, AUTHORITY_SHA), "authority bytes/hash drift")
    v.exact((len(token_data), digest(token_data)), (TOKEN_BYTES, TOKEN_SHA), "token bytes/hash drift")
    authority = load_json(authority_data, "authority")
    token = load_json(token_data, "token")
    closed(v, authority, {
        "schema", "state", "lane", "predecessorCarrier", "predecessorArtifacts",
        "semanticAuthorityPins", "backendBase", "generationExecution",
        "worktreeReceiptContract", "verificationContract", "integrationHandoff", "authority",
    }, "authority")
    v.exact({key: authority.get(key) for key in ("schema", "state", "lane")}, {
        "schema": "dwp.hris.wave7.hrm013-auth-v62-generation-execution-authority.v1",
        "state": "INDEPENDENTLY_REVIEWED_HASH_BOUND_AUTH_V62_GENERATION_PREPARATION_AUTHORITY",
        "lane": "AUTH_PRODUCT_AUTHORIZATION_V62_GENERATION_PREP",
    }, "authority identity drift")
    predecessor = authority["predecessorCarrier"]
    v.exact({key: predecessor.get(key) for key in ("repository", "branch", "commit", "tree", "exactCarrierChangedPaths", "validatorPosition")}, {
        "repository": "dwp-frontend", "branch": "dwp-dev", "commit": FRONTEND_BASE,
        "tree": FRONTEND_TREE, "exactCarrierChangedPaths": [
            "package.json", AUTHORITY_REL, TOKEN_REL, REVIEW_REL, VALIDATOR_REL,
        ], "validatorPosition": 7,
    }, "predecessor carrier closure drift")
    backend = authority["backendBase"]
    v.exact({key: backend.get(key) for key in ("repository", "branch", "commit", "tree", "requiredClean", "requiredOriginEquality", "v62BundleMustBeAbsent", "authV271MigrationMustBeAbsent")}, {
        "repository": "dwp-backend", "branch": "dwp-dev", "commit": BACKEND_BASE,
        "tree": BACKEND_TREE, "requiredClean": True, "requiredOriginEquality": True,
        "v62BundleMustBeAbsent": True, "authV271MigrationMustBeAbsent": True,
    }, "backend base closure drift")
    generation = authority["generationExecution"]
    v.exact({key: generation.get(key) for key in ("repository", "branch", "worktree", "operation", "predecessorVersion", "generatedVersion", "bundleStatus", "generationRunCount")}, {
        "repository": "dwp-backend", "branch": LANE, "worktree": str(WORKTREE),
        "operation": "GENERATE_VALIDATE_COMMIT_AND_PUSH_AUTH_PRODUCT_AUTHORIZATION_V62_ONLY",
        "predecessorVersion": 61, "generatedVersion": 62, "bundleStatus": "DRAFT",
        "generationRunCount": 1,
    }, "generation execution drift")
    maximum = generation["maximumChangedPaths"]
    v.exact(maximum, MAXIMUM_CHANGED_PATHS, "maximum changed paths drift")
    v.require(len(set(maximum)) == len(MAXIMUM_CHANGED_PATHS), "maximum changed paths must be unique")
    v.require(all(canonical(path) for path in maximum), "noncanonical maximum changed path")
    forbidden = {
        "dwp-auth-server/src/main/resources/db/migration/V271__create_hris_service_grant_authority.sql",
    }
    v.require(not (set(maximum) & forbidden), "V271 is allowlisted")
    production_java = {
        path for path in maximum
        if "/src/main/java/" in path
    }
    v.exact(production_java, COMPATIBILITY_SOURCE_PATHS, "production source authority expanded")
    expected_authority = {
        "generationPreparationAuthorityComplete": True,
        "independentReviewComplete": True,
        "carrierCommitAndPushAuthorized": True,
        "worktreeMaterializationAuthorizedAfterCarrierPush": True,
        "sourceAuthoringAuthorizedAfterCleanWorktreeReceipt": True,
        "authV62GenerationAuthorized": True,
        "boundedGenerationCompatibilitySourceAuthorized": True,
        "laneCommitAndPushAuthorizedAfterTargetedVerification": True,
        "backendDwpDevIntegrationAuthorized": False,
        "authV271ReservationAuthorized": False,
        "authV271ImplementationAuthorized": False,
        "migrationAuthoringAuthorized": False,
        "runtimeJavaImplementationAuthorized": False,
        "controllerOrRelayImplementationAuthorized": False,
        "approvalOrPeopleOwnerRuntimeAuthorized": False,
        "frontendUiMenuOrRouteAuthorized": False,
        "featureEnablementAuthorized": False,
        "tenantEnrollmentAuthorized": False,
        "automaticImportAuthorized": False,
        "productionBindingAuthorized": False,
        "productionReleaseAuthorized": False,
        "businessCompletionCredit": 0,
    }
    v.exact(authority["authority"], expected_authority, "authority map drift")
    closed(v, token, {"schema", "state", "tokenId", "lane", "authorityBinding", "execution", "verification", "forbidden", "authorization", "nextGate"}, "token")
    v.exact({key: token.get(key) for key in ("schema", "state", "tokenId", "lane")}, {
        "schema": "dwp.hris.wave7.hrm013-auth-v62-generation-start-token.v1",
        "state": "EXECUTABLE_ONLY_AFTER_CARRIER_PUSH_AND_HASH_BOUND_CLEAN_WORKTREE_RECEIPT",
        "tokenId": "HRIS-WAVE7-R7-BATCH06-HRM013-AUTH-V62-GENERATION-20261027-R1",
        "lane": "AUTH_PRODUCT_AUTHORIZATION_V62_GENERATION_PREP",
    }, "token identity drift")
    execution = token["execution"]
    v.exact({key: execution.get(key) for key in ("repository", "baseCommit", "baseTree", "branch", "worktree", "cleanWorktreeReceiptPath", "operation", "generatorRunCount")}, {
        "repository": "dwp-backend", "baseCommit": BACKEND_BASE, "baseTree": BACKEND_TREE,
        "branch": LANE, "worktree": str(WORKTREE), "cleanWorktreeReceiptPath": str(CLEAN_RECEIPT),
        "operation": "GENERATE_VALIDATE_COMMIT_AND_PUSH_AUTH_PRODUCT_AUTHORIZATION_V62_ONLY",
        "generatorRunCount": 1,
    }, "token execution drift")
    v.require(any("V271" in item for item in token["forbidden"]), "token omits V271 prohibition")
    v.require(token["authorization"]["backendDwpDevIntegrationAuthorized"] is False, "token grants direct integration")
    v.require(token["authorization"]["migrationAuthoringAuthorized"] is False, "token grants migration")
    return authority, token


def check_review(v: V, data: bytes, blobs: dict[str, bytes], committed: datetime | None) -> datetime:
    review = load_json(data, "review")
    closed(v, review, {"schema", "reviewedAt", "reviewer", "scope", "findings", "finalVerdict", "authority", "artifactPins"}, "review")
    v.exact({key: review.get(key) for key in ("schema", "reviewer")}, {
        "schema": "dwp.hris.wave7.hrm013-auth-v62-generation-execution-authority-independent-review.v1",
        "reviewer": "INDEPENDENT_HRM013_AUTH_V62_GENERATION_AUTHORITY_REVIEW",
    }, "review identity drift")
    reviewed = parse_time(review.get("reviewedAt"), "reviewedAt")
    causal(v, [("reviewedAt", reviewed)] + ([] if committed is None else [("carrier committedAt", committed)]))
    v.exact(review.get("scope"), {
        "authorityPath": AUTHORITY_REL, "tokenPath": TOKEN_REL,
        "validatorPath": VALIDATOR_REL, "packagePath": "package.json",
        "reviewedBoundaries": REVIEW_BOUNDARIES,
    }, "review scope drift")
    v.exact(review.get("findings"), {
        "p0": [], "p1": [], "p2": [], "notes": [
            "The carrier authorizes only deterministic Auth product-authorization v62 generation after its external clean-worktree receipt.",
            "The committed changed paths must be a nonempty subset of the closed maximum allowlist and v1 through v61 remain byte-identical.",
            "Backend dwp-dev integration remains forbidden until the fixed eighth-validator successor carrier and its external direct-fast-forward receipt are independently reviewed, committed and pushed.",
            "No V271 reservation, migration, runtime, UI, activation, tenant enrollment, production binding or business-completion credit is authorized.",
        ],
    }, "review findings drift")
    v.exact(review.get("finalVerdict"), {
        "p0": 0, "p1": 0, "p2": 0,
        "decision": "GO_FOR_AUTH_V62_GENERATION_AUTHORITY_CARRIER_COMMIT_AND_PUSH_ONLY",
    }, "review verdict drift")
    v.exact(review.get("authority"), REVIEW_AUTHORITY, "review authority drift")
    v.exact(review.get("artifactPins"), [
        artifact(path, blobs[path]) for path in (AUTHORITY_REL, TOKEN_REL, VALIDATOR_REL, "package.json")
    ], "review artifact pins drift")
    return reviewed


def backend_default(v: V, authoring: bool) -> str:
    v.exact(text(BACKEND, "branch", "--show-current"), "dwp-dev", "backend default branch drift")
    head = text(BACKEND, "rev-parse", "HEAD")
    v.exact(head, text(BACKEND, "rev-parse", "origin/dwp-dev"), "backend HEAD/origin drift")
    v.require(not changes(BACKEND), "backend default checkout dirty")
    if authoring or not present(CENTRAL_INTEGRATION_RECEIPT):
        v.exact(head, BACKEND_BASE, "backend moved before central integration authority receipt")
    else:
        v.require(ancestor(BACKEND, BACKEND_BASE, head), "backend lost generation base")
    migration_rel = "dwp-auth-server/src/main/resources/db/migration/V271__create_hris_service_grant_authority.sql"
    migration = BACKEND / migration_rel
    if head == BACKEND_BASE:
        v.require(not present(migration), "V271 migration forbidden on generation base")
        v.require(blob(BACKEND, head, migration_rel) is None, "V271 migration exists on generation base")
        for path in PREMATERIALIZATION_ABSENT_PATHS:
            v.require(blob(BACKEND, BACKEND_BASE, path) is None, f"v62 material exists on base: {path}")
            v.require(not present(BACKEND / path), f"v62 material exists before materialization: {path}")
    return head


def lane_absent(v: V) -> None:
    v.require(not present(CLEAN_RECEIPT), "clean receipt exists before materialization")
    v.require(not present(TARGETED_RECEIPT), "targeted receipt exists before materialization")
    v.require(not present(POST_REVIEW_RECEIPT), "post-review receipt exists before materialization")
    v.require(not present(CENTRAL_INTEGRATION_RECEIPT), "central integration receipt exists before materialization")
    v.require(not present(WORKTREE), "worktree exists before materialization")
    v.require(git(BACKEND, "rev-parse", "--verify", f"refs/heads/{LANE}", check=False).returncode != 0, "local lane exists")
    v.require(git(BACKEND, "rev-parse", "--verify", f"refs/remotes/origin/{LANE}", check=False).returncode != 0, "remote lane exists")


def check_clean_receipt(v: V, carrier: dict[str, Any]) -> bytes:
    receipt_data = read_receipt(CLEAN_RECEIPT, "clean receipt")
    receipt = load_json(receipt_data, "clean receipt")
    blobs = carrier["blobs"]
    expected = {
        "schema": "dwp.hris.wave7.hrm013-auth-v62-generation-clean-worktree-receipt.v1",
        "state": "HASH_BOUND_FRESH_CLEAN_AUTH_V62_GENERATION_WORKTREE_RECEIPT",
        "authorityCarrierCommit": carrier["commit"], "authorityCarrierTree": carrier["tree"],
        "authorityCarrierCommittedAt": text(FRONTEND, "show", "-s", "--format=%cI", carrier["commit"]),
        "authorityArtifact": artifact(AUTHORITY_REL, blobs[AUTHORITY_REL]),
        "tokenArtifact": artifact(TOKEN_REL, blobs[TOKEN_REL]),
        "validatorArtifact": artifact(VALIDATOR_REL, blobs[VALIDATOR_REL]),
        "reviewArtifact": artifact(REVIEW_REL, blobs[REVIEW_REL]),
        "packageArtifact": artifact("package.json", blobs["package.json"]),
        "repository": "dwp-backend", "repositoryRoot": str(BACKEND),
        "repositoryRealRoot": str(BACKEND.resolve()), "worktree": str(WORKTREE),
        "worktreeRealRoot": str(WORKTREE), "branch": LANE,
        "baseCommit": BACKEND_BASE, "baseTree": BACKEND_TREE, "head": BACKEND_BASE,
        "tree": BACKEND_TREE, "originDwpDevAtMaterialization": BACKEND_BASE,
        "upstreamAtMaterialization": None, "remoteBranchPresentAtMaterialization": False,
        "statusPorcelainV2Bytes": 0, "statusPorcelainV2Sha256": EMPTY_SHA,
        "ignoredSourceTestShadowNulBytes": 0, "ignoredSourceTestShadowNulSha256": EMPTY_SHA,
        "untrackedSourceTestShadowNulBytes": 0, "untrackedSourceTestShadowNulSha256": EMPTY_SHA,
        "ignoredBuildShadowNulBytes": 0, "ignoredBuildShadowNulSha256": EMPTY_SHA,
        "untrackedBuildShadowNulBytes": 0, "untrackedBuildShadowNulSha256": EMPTY_SHA,
        "verifiedBy": "TRUSTED_HRM013_AUTH_V62_GENERATION_WORKTREE_CHECK",
    }
    closed(v, receipt, set(expected) | {
        "protections", "authorityCarrierPushObservedAt", "verifiedAt",
    }, "clean receipt")
    v.exact({key: receipt.get(key) for key in expected}, expected, "clean receipt evidence drift")
    v.exact(receipt.get("protections"), {
        "assumeUnchangedPaths": [], "skipWorktreePaths": [], "sparseCheckoutEnabled": False,
        "fsmonitorConfigured": False, "diffExternalConfigured": False,
        "unsafeGitConfigEntries": [], "unsafeGitConfigNulBytes": 0,
        "unsafeGitConfigNulSha256": EMPTY_SHA, "graftFilePresent": False,
        "replaceRefs": [], "repositoryOrWorktreePathSymlinks": [],
        "authorizedSourceOrTestPathSymlinks": [],
    }, "clean receipt protections drift")
    causal(v, [
        ("carrier committedAt", parse_time(receipt.get("authorityCarrierCommittedAt"), "carrier committedAt")),
        ("carrier pushObservedAt", parse_time(receipt.get("authorityCarrierPushObservedAt"), "pushObservedAt")),
        ("worktree verifiedAt", parse_time(receipt.get("verifiedAt"), "verifiedAt")),
    ])
    return receipt_data


def exact_changed_artifacts(v: V, commit: str, paths: list[str]) -> list[dict[str, Any]]:
    pins: list[dict[str, Any]] = []
    for path in paths:
        base_mode = mode(BACKEND, BACKEND_BASE, path)
        expected_mode = base_mode if base_mode is not None else "100644"
        v.require(expected_mode in {"100644", "100755"}, f"unsafe base artifact mode: {path}")
        v.exact(mode(BACKEND, commit, path), expected_mode, f"lane artifact mode drift: {path}")
        pins.append(git_artifact(BACKEND, commit, path))
    return pins


def check_targeted_receipt(
    v: V,
    carrier: dict[str, Any],
    authority: dict[str, Any],
    clean_data: bytes,
    commit: str,
    tree: str,
    paths: list[str],
) -> tuple[bytes, datetime]:
    data = read_receipt(TARGETED_RECEIPT, "targeted verification receipt")
    receipt = load_json(data, "targeted verification receipt")
    contract = authority["integrationHandoff"]["generationReceiptContract"]
    closed(v, receipt, set(contract["closedTopLevelFields"]), "targeted verification receipt")
    blobs = carrier["blobs"]
    v.exact({key: receipt.get(key) for key in (
        "schema", "state", "authorityCarrierCommit", "authorityCarrierTree",
        "authorityArtifact", "tokenArtifact", "cleanWorktreeReceiptSha256",
        "repository", "branch", "baseCommit", "baseTree", "testedCommit",
        "testedTree", "changedPaths", "changedArtifacts", "generationCommands",
        "generationRunCount", "verifiedBy",
    )}, {
        "schema": contract["schema"], "state": contract["state"],
        "authorityCarrierCommit": carrier["commit"], "authorityCarrierTree": carrier["tree"],
        "authorityArtifact": artifact(AUTHORITY_REL, blobs[AUTHORITY_REL]),
        "tokenArtifact": artifact(TOKEN_REL, blobs[TOKEN_REL]),
        "cleanWorktreeReceiptSha256": digest(clean_data),
        "repository": "dwp-backend", "branch": LANE,
        "baseCommit": BACKEND_BASE, "baseTree": BACKEND_TREE,
        "testedCommit": commit, "testedTree": tree, "changedPaths": paths,
        "changedArtifacts": exact_changed_artifacts(v, commit, paths),
        "generationCommands": authority["generationExecution"]["generatorCommands"],
        "generationRunCount": 1, "verifiedBy": contract["verifiedBy"],
    }, "targeted verification receipt evidence drift")
    verification = authority["verificationContract"]
    commands = receipt.get("verificationCommands")
    expected_commands = verification["generationChecks"] + verification["namedGradleTests"]
    v.exact(commands, expected_commands, "targeted verification command set drift")
    v.exact(receipt.get("exitCodes"), {command: 0 for command in expected_commands}, "targeted verification exit codes drift")
    v.exact(
        receipt.get("semanticEvidence"),
        {assertion: "PASS" for assertion in verification["requiredAssertions"]},
        "targeted semantic evidence drift",
    )
    verified = parse_time(receipt.get("verifiedAt"), "targeted verifiedAt")
    committed = parse_time(text(BACKEND, "show", "-s", "--format=%cI", commit), "lane committedAt")
    causal(v, [("lane committedAt", committed), ("targeted verifiedAt", verified)])
    return data, verified


def check_post_review_receipt(
    v: V,
    carrier: dict[str, Any],
    authority: dict[str, Any],
    targeted_data: bytes,
    verified: datetime,
    commit: str,
    tree: str,
    paths: list[str],
) -> None:
    data = read_receipt(POST_REVIEW_RECEIPT, "post-implementation review receipt")
    receipt = load_json(data, "post-implementation review receipt")
    contract = authority["integrationHandoff"]["postImplementationReviewContract"]
    closed(v, receipt, set(contract["closedTopLevelFields"]), "post-implementation review receipt")
    blobs = carrier["blobs"]
    v.exact({key: receipt.get(key) for key in (
        "schema", "state", "authorityCarrierCommit", "authorityCarrierTree",
        "authorityArtifact", "tokenArtifact", "targetedVerificationReceiptSha256",
        "laneCommit", "laneTree", "changedPaths", "p0", "p1", "p2",
        "decision", "reviewedBy",
    )}, {
        "schema": contract["schema"], "state": contract["state"],
        "authorityCarrierCommit": carrier["commit"], "authorityCarrierTree": carrier["tree"],
        "authorityArtifact": artifact(AUTHORITY_REL, blobs[AUTHORITY_REL]),
        "tokenArtifact": artifact(TOKEN_REL, blobs[TOKEN_REL]),
        "targetedVerificationReceiptSha256": digest(targeted_data),
        "laneCommit": commit, "laneTree": tree, "changedPaths": paths,
        "p0": 0, "p1": 0, "p2": 0, "decision": contract["decision"],
        "reviewedBy": contract["reviewedBy"],
    }, "post-implementation review receipt evidence drift")
    committed = parse_time(text(BACKEND, "show", "-s", "--format=%cI", commit), "lane committedAt")
    reviewed = parse_time(receipt.get("reviewedAt"), "post-review reviewedAt")
    pushed = parse_time(receipt.get("lanePushObservedAt"), "lane pushObservedAt")
    recorded = parse_time(receipt.get("recordedAt"), "post-review recordedAt")
    causal(v, [
        ("lane committedAt", committed), ("targeted verifiedAt", verified),
        ("post-review reviewedAt", reviewed), ("lane pushObservedAt", pushed),
        ("post-review recordedAt", recorded),
    ])
    remote = git(BACKEND, "rev-parse", "--verify", f"refs/remotes/origin/{LANE}", check=False)
    v.require(remote.returncode == 0, "post-review claims push but remote lane is absent")
    if remote.returncode == 0:
        v.exact(remote.stdout.decode("utf-8", errors="strict").strip(), commit, "remote lane commit drift")


def governance_evidence(
    v: V, lane_commit: str, lane_tree: str, changed_paths: list[str]
) -> dict[str, Any]:
    authority_rel = f"{GOVERNANCE_ROOT_REL}/{lane_commit}/authority.v1.json"
    review_rel = f"{GOVERNANCE_ROOT_REL}/{lane_commit}/independent-review.v1.json"
    commits: list[str] = []
    for path in (authority_rel, review_rel):
        found = [line for line in text(FRONTEND, "log", "--diff-filter=A", "--format=%H", "--", path).splitlines() if line]
        v.require(len(found) == 1, f"descendant governance artifact introduction ambiguous: {path}")
        commits.extend(found)
    v.require(len(set(commits)) == 1, "descendant governance artifacts introduced separately")
    carrier = commits[0] if commits else ""
    v.exact(
        text(FRONTEND, "rev-list", "--parents", "-n", "1", carrier).split(),
        [carrier, FRONTEND_BASE],
        "descendant governance carrier parent drift",
    )
    v.exact(between(FRONTEND, FRONTEND_BASE, carrier), {authority_rel, review_rel}, "descendant governance carrier paths drift")
    frontend_head = text(FRONTEND, "rev-parse", "HEAD")
    frontend_origin = text(FRONTEND, "rev-parse", "origin/dwp-dev")
    v.require(
        ancestor(FRONTEND, carrier, frontend_head) and ancestor(FRONTEND, carrier, frontend_origin),
        "descendant governance carrier is not pushed",
    )
    blobs: dict[str, bytes] = {}
    for path in (authority_rel, review_rel):
        v.exact(mode(FRONTEND, carrier, path), "100644", f"descendant governance artifact mode drift: {path}")
        data = blob(FRONTEND, carrier, path)
        v.require(data is not None, f"descendant governance artifact missing: {path}")
        blobs[path] = data or b""
        v.require(symlink_free(FRONTEND, path), f"descendant governance artifact symlinked: {path}")
        v.exact(artifact(path, (FRONTEND / path).read_bytes()), artifact(path, blobs[path]), f"descendant governance artifact mutated: {path}")
    receipt_path = RECEIPTS / "backend-descendants" / f"{lane_commit}.hrm013-shared-contract-governance.v1.json"
    receipt_data = read_receipt(receipt_path, "descendant governance receipt")
    receipt = load_json(receipt_data, "descendant governance receipt")
    v.exact({key: receipt.get(key) for key in (
        "schema", "state", "immediateParentCommit", "descendantCommit",
        "descendantTree", "descendantChangedPaths", "governingFrontendCarrierCommit",
        "governingFrontendCarrierTree", "governingAuthorityArtifact",
        "governingIndependentReviewArtifact", "decision", "recordedBy",
    )}, {
        "schema": "dwp.hris.wave7.hrm013-shared-contract-backend-descendant-governance-receipt.v1",
        "state": "REVIEWED_ORDERED_BACKEND_DESCENDANT_GOVERNANCE_SHARED_ELEVEN_BLOBS_IMMUTABLE",
        "immediateParentCommit": BACKEND_BASE, "descendantCommit": lane_commit,
        "descendantTree": lane_tree, "descendantChangedPaths": changed_paths,
        "governingFrontendCarrierCommit": carrier,
        "governingFrontendCarrierTree": text(FRONTEND, "rev-parse", f"{carrier}^{{tree}}"),
        "governingAuthorityArtifact": artifact(authority_rel, blobs[authority_rel]),
        "governingIndependentReviewArtifact": artifact(review_rel, blobs[review_rel]),
        "decision": "GO_FOR_EXACT_BACKEND_DESCENDANT_GOVERNANCE_ONLY",
        "recordedBy": "INDEPENDENT_HRM013_BACKEND_DESCENDANT_GOVERNANCE_REVIEW",
    }, "descendant governance receipt drift")
    recorded = parse_time(receipt.get("recordedAt"), "descendant governance recordedAt")
    return {
        "commit": carrier, "tree": text(FRONTEND, "rev-parse", f"{carrier}^{{tree}}"),
        "authorityPath": authority_rel, "reviewPath": review_rel, "blobs": blobs,
        "receiptPath": receipt_path, "receiptData": receipt_data, "recordedAt": recorded,
    }


def future_authority_and_review(
    v: V,
    carrier: dict[str, Any],
    future_commit: str,
    future_parent: str,
    future_blobs: dict[str, bytes],
    lane_commit: str,
    lane_tree: str,
    changed_paths: list[str],
    targeted_data: bytes,
    post_data: bytes,
    governance: dict[str, Any],
    contract: dict[str, Any],
) -> datetime:
    authority = load_json(future_blobs[FUTURE_AUTHORITY_REL], "future integration authority")
    review = load_json(future_blobs[FUTURE_REVIEW_REL], "future integration review")
    closed(v, authority, {
        "schema", "state", "lane", "predecessorCarrier", "generationEvidence",
        "descendantGovernanceEvidence", "centralIntegrationBoundary", "authority",
    }, "future integration authority")
    v.exact({key: authority.get(key) for key in ("schema", "state", "lane")}, {
        "schema": contract["authoritySchema"], "state": contract["authorityState"],
        "lane": "AUTH_PRODUCT_AUTHORIZATION_V62_GENERATION_CENTRAL_INTEGRATION",
    }, "future integration authority identity drift")
    generation_blobs = carrier["blobs"]
    generation_pins = [artifact(path, generation_blobs[path]) for path in (
        AUTHORITY_REL, TOKEN_REL, VALIDATOR_REL, REVIEW_REL, "package.json",
    )]
    v.exact(authority.get("predecessorCarrier"), {
        "repository": "dwp-frontend", "branch": "dwp-dev",
        "commit": future_parent, "tree": text(FRONTEND, "rev-parse", f"{future_parent}^{{tree}}"),
        "generationAuthorityCarrierCommit": carrier["commit"],
        "generationAuthorityCarrierTree": carrier["tree"],
        "generationArtifactPins": generation_pins,
    }, "future integration predecessor closure drift")
    v.exact(authority.get("generationEvidence"), {
        "repository": "dwp-backend", "branch": LANE,
        "baseCommit": BACKEND_BASE, "baseTree": BACKEND_TREE,
        "laneCommit": lane_commit, "laneTree": lane_tree,
        "changedPaths": changed_paths,
        "targetedVerificationReceiptSha256": digest(targeted_data),
        "postImplementationReviewReceiptSha256": digest(post_data),
    }, "future integration generation evidence drift")
    v.exact(authority.get("descendantGovernanceEvidence"), {
        "carrierCommit": governance["commit"], "carrierTree": governance["tree"],
        "authorityArtifact": artifact(governance["authorityPath"], governance["blobs"][governance["authorityPath"]]),
        "independentReviewArtifact": artifact(governance["reviewPath"], governance["blobs"][governance["reviewPath"]]),
        "receiptPath": str(governance["receiptPath"]),
        "receiptSha256": digest(governance["receiptData"]),
    }, "future integration governance evidence drift")
    receipt_contract = contract["externalReceiptContract"]
    v.exact(authority.get("centralIntegrationBoundary"), {
        "receiptPath": contract["externalReceiptPath"],
        "receiptSchema": receipt_contract["schema"], "receiptState": receipt_contract["state"],
        "requiredDecision": receipt_contract["decision"],
        "integrationMode": receipt_contract["integrationMode"],
        "externalAttestationRequired": True,
        "directDwpDevIntegrationAuthorizedBeforeExternalReceipt": False,
    }, "future integration boundary drift")
    v.exact(authority.get("authority"), FUTURE_AUTHORITY_MAP, "future integration authority map drift")

    closed(v, review, {"schema", "reviewedAt", "reviewer", "scope", "findings", "finalVerdict", "authority", "artifactPins"}, "future integration review")
    v.exact({key: review.get(key) for key in ("schema", "reviewer")}, {
        "schema": contract["reviewSchema"],
        "reviewer": "INDEPENDENT_HRM013_AUTH_V62_GENERATION_CENTRAL_INTEGRATION_REVIEW",
    }, "future integration review identity drift")
    v.exact(review.get("scope"), {
        "authorityPath": FUTURE_AUTHORITY_REL, "validatorPath": FUTURE_VALIDATOR_REL,
        "packagePath": "package.json", "reviewedBoundaries": FUTURE_REVIEW_BOUNDARIES,
    }, "future integration review scope drift")
    v.exact(review.get("findings"), {
        "p0": [], "p1": [], "p2": [], "notes": [
            "The carrier authorizes only externally attested direct fast-forward integration of the exact reviewed Auth v62 generation commit.",
            "The generation carrier, both generation receipts and the ordered descendant-governance carrier and receipt are hash-bound.",
            "No V271 reservation, migration, runtime, activation, tenant enrollment, production binding or release is authorized.",
        ],
    }, "future integration review findings drift")
    v.exact(review.get("finalVerdict"), {
        "p0": 0, "p1": 0, "p2": 0, "decision": contract["reviewDecision"],
    }, "future integration review verdict drift")
    v.exact(review.get("authority"), FUTURE_REVIEW_AUTHORITY, "future integration review authority drift")
    v.exact(review.get("artifactPins"), [
        artifact(FUTURE_AUTHORITY_REL, future_blobs[FUTURE_AUTHORITY_REL]),
        artifact(FUTURE_VALIDATOR_REL, future_blobs[FUTURE_VALIDATOR_REL]),
        artifact("package.json", future_blobs["package.json"]),
    ], "future integration review pins drift")
    reviewed = parse_time(review.get("reviewedAt"), "future integration reviewedAt")
    committed = parse_time(text(FRONTEND, "show", "-s", "--format=%cI", future_commit), "future carrier committedAt")
    causal(v, [("future review reviewedAt", reviewed), ("future carrier committedAt", committed)])
    return reviewed


def future_carrier(
    v: V,
    carrier: dict[str, Any],
    lane_commit: str,
    lane_tree: str,
    changed_paths: list[str],
    targeted_data: bytes,
    post_data: bytes,
    governance: dict[str, Any],
) -> dict[str, Any]:
    contract = carrier["authority"]["integrationHandoff"]["futureCentralIntegrationContract"]
    v.exact({contract["authorityPath"], contract["reviewPath"], contract["validatorPath"], contract["packagePath"]}, FUTURE_CARRIER_PATHS, "future carrier contract path drift")
    commits: list[str] = []
    for path in (FUTURE_AUTHORITY_REL, FUTURE_REVIEW_REL, FUTURE_VALIDATOR_REL):
        found = [line for line in text(FRONTEND, "log", "--diff-filter=A", "--format=%H", "--", path).splitlines() if line]
        v.require(len(found) == 1, f"future carrier artifact introduction ambiguous: {path}")
        commits.extend(found)
    v.require(len(set(commits)) == 1, "future carrier artifacts introduced separately")
    commit = commits[0] if commits else ""
    parents = text(FRONTEND, "rev-list", "--parents", "-n", "1", commit).split()
    v.require(len(parents) == 2, "future integration carrier must be non-merge")
    parent = parents[1] if len(parents) == 2 else ""
    v.exact(between(FRONTEND, parent, commit), FUTURE_CARRIER_PATHS, "future integration carrier paths drift")
    v.require(ancestor(FRONTEND, carrier["commit"], parent), "future integration carrier bypasses generation carrier")
    v.require(ancestor(FRONTEND, governance["commit"], parent), "future integration carrier predates governance carrier")
    head, origin = text(FRONTEND, "rev-parse", "HEAD"), text(FRONTEND, "rev-parse", "origin/dwp-dev")
    v.require(ancestor(FRONTEND, commit, head) and ancestor(FRONTEND, commit, origin), "future integration carrier is not pushed")
    correction = lifecycle_correction(v)
    blobs: dict[str, bytes] = {}
    for path in (FUTURE_AUTHORITY_REL, FUTURE_REVIEW_REL, FUTURE_VALIDATOR_REL, "package.json"):
        v.exact(mode(FRONTEND, commit, path), "100644", f"future carrier artifact mode drift: {path}")
        data = blob(FRONTEND, commit, path)
        v.require(data is not None, f"future carrier artifact missing: {path}")
        blobs[path] = data or b""
        if path != "package.json":
            v.require(symlink_free(FRONTEND, path), f"future carrier artifact symlinked: {path}")
            expected_live = (
                correction["blobs"][path]
                if path == FUTURE_VALIDATOR_REL else blobs[path]
            )
            v.exact(artifact(path, (FRONTEND / path).read_bytes()), artifact(path, expected_live), f"future carrier artifact mutated: {path}")
    v.exact(blobs["package.json"], expected_future_package(parent), "future package is not exact eighth-validator append")
    validate_python(v, blobs[FUTURE_VALIDATOR_REL], "future integration validator")
    reviewed = future_authority_and_review(
        v, carrier, commit, parent, blobs, lane_commit, lane_tree, changed_paths,
        targeted_data, post_data, governance, contract,
    )
    return {
        "commit": commit, "tree": text(FRONTEND, "rev-parse", f"{commit}^{{tree}}"),
        "parent": parent, "blobs": blobs, "reviewedAt": reviewed,
        "reviewedAtRaw": load_json(blobs[FUTURE_REVIEW_REL], "future integration review").get("reviewedAt"),
        "contract": contract,
    }


def check_central_integration(
    v: V,
    carrier: dict[str, Any],
    lane_commit: str,
    lane_tree: str,
    changed_paths: list[str],
) -> str:
    targeted_data = read_receipt(TARGETED_RECEIPT, "targeted verification receipt")
    post_data = read_receipt(POST_REVIEW_RECEIPT, "post-implementation review receipt")
    targeted = load_json(targeted_data, "targeted verification receipt")
    post = load_json(post_data, "post-implementation review receipt")
    governance = governance_evidence(v, lane_commit, lane_tree, changed_paths)
    future = future_carrier(
        v, carrier, lane_commit, lane_tree, changed_paths, targeted_data, post_data, governance,
    )
    contract = future["contract"]
    v.exact(Path(contract["externalReceiptPath"]), CENTRAL_INTEGRATION_RECEIPT, "central receipt path drift")
    receipt_data = read_receipt(CENTRAL_INTEGRATION_RECEIPT, "central integration receipt")
    receipt = load_json(receipt_data, "central integration receipt")
    receipt_contract = contract["externalReceiptContract"]
    closed(v, receipt, set(receipt_contract["closedTopLevelFields"]), "central integration receipt")
    generation_blobs = carrier["blobs"]
    future_blobs = future["blobs"]
    expected = {
        "schema": receipt_contract["schema"], "state": receipt_contract["state"],
        "generationAuthorityCarrierCommit": carrier["commit"],
        "generationAuthorityCarrierTree": carrier["tree"],
        "generationAuthorityArtifact": artifact(AUTHORITY_REL, generation_blobs[AUTHORITY_REL]),
        "generationTokenArtifact": artifact(TOKEN_REL, generation_blobs[TOKEN_REL]),
        "generationValidatorArtifact": artifact(VALIDATOR_REL, generation_blobs[VALIDATOR_REL]),
        "generationIndependentReviewArtifact": artifact(REVIEW_REL, generation_blobs[REVIEW_REL]),
        "generationPackageArtifact": artifact("package.json", generation_blobs["package.json"]),
        "targetedVerificationReceiptSha256": digest(targeted_data),
        "postImplementationReviewReceiptSha256": digest(post_data),
        "backendBaseCommit": BACKEND_BASE, "backendBaseTree": BACKEND_TREE,
        "generationLaneCommit": lane_commit, "generationLaneTree": lane_tree,
        "generationLaneChangedPaths": changed_paths,
        "descendantGovernanceCarrierCommit": governance["commit"],
        "descendantGovernanceCarrierTree": governance["tree"],
        "descendantGovernanceAuthorityArtifact": artifact(
            governance["authorityPath"], governance["blobs"][governance["authorityPath"]]
        ),
        "descendantGovernanceIndependentReviewArtifact": artifact(
            governance["reviewPath"], governance["blobs"][governance["reviewPath"]]
        ),
        "descendantGovernanceReceiptSha256": digest(governance["receiptData"]),
        "centralIntegrationAuthorityCarrierCommit": future["commit"],
        "centralIntegrationAuthorityCarrierTree": future["tree"],
        "centralIntegrationAuthorityArtifact": artifact(FUTURE_AUTHORITY_REL, future_blobs[FUTURE_AUTHORITY_REL]),
        "centralIntegrationValidatorArtifact": artifact(FUTURE_VALIDATOR_REL, future_blobs[FUTURE_VALIDATOR_REL]),
        "centralIntegrationIndependentReviewArtifact": artifact(FUTURE_REVIEW_REL, future_blobs[FUTURE_REVIEW_REL]),
        "centralIntegrationPackageArtifact": artifact("package.json", future_blobs["package.json"]),
        "generationLaneCommittedAt": text(BACKEND, "show", "-s", "--format=%cI", lane_commit),
        "targetedVerificationVerifiedAt": targeted.get("verifiedAt"),
        "postImplementationReviewReviewedAt": post.get("reviewedAt"),
        "generationLanePushObservedAt": post.get("lanePushObservedAt"),
        "postImplementationReviewRecordedAt": post.get("recordedAt"),
        "descendantGovernanceReceiptRecordedAt": load_json(
            governance["receiptData"], "descendant governance receipt"
        ).get("recordedAt"),
        "centralIntegrationReviewReviewedAt": future["reviewedAtRaw"],
        "centralIntegrationAuthorityCarrierCommittedAt": text(
            FRONTEND, "show", "-s", "--format=%cI", future["commit"]
        ),
        "p0": 0, "p1": 0, "p2": 0,
        "decision": receipt_contract["decision"],
        "integrationMode": receipt_contract["integrationMode"],
        "recordedBy": receipt_contract["recordedBy"],
    }
    v.exact({key: receipt.get(key) for key in expected}, expected, "central integration receipt evidence drift")
    times = [
        ("generation lane committedAt", parse_time(receipt.get("generationLaneCommittedAt"), "generationLaneCommittedAt")),
        ("targeted verifiedAt", parse_time(receipt.get("targetedVerificationVerifiedAt"), "targetedVerificationVerifiedAt")),
        ("post-review reviewedAt", parse_time(receipt.get("postImplementationReviewReviewedAt"), "postImplementationReviewReviewedAt")),
        ("lane pushObservedAt", parse_time(receipt.get("generationLanePushObservedAt"), "generationLanePushObservedAt")),
        ("post-review recordedAt", parse_time(receipt.get("postImplementationReviewRecordedAt"), "postImplementationReviewRecordedAt")),
        ("governance recordedAt", parse_time(receipt.get("descendantGovernanceReceiptRecordedAt"), "descendantGovernanceReceiptRecordedAt")),
        ("central review reviewedAt", parse_time(receipt.get("centralIntegrationReviewReviewedAt"), "centralIntegrationReviewReviewedAt")),
        ("central carrier committedAt", parse_time(receipt.get("centralIntegrationAuthorityCarrierCommittedAt"), "centralIntegrationAuthorityCarrierCommittedAt")),
        ("central carrier pushObservedAt", parse_time(receipt.get("centralIntegrationAuthorityCarrierPushObservedAt"), "centralIntegrationAuthorityCarrierPushObservedAt")),
        ("central receipt recordedAt", parse_time(receipt.get("recordedAt"), "central integration recordedAt")),
    ]
    causal(v, times)
    default_head = text(BACKEND, "rev-parse", "HEAD")
    if default_head == BACKEND_BASE:
        return "AUTH_V62_GENERATION_CENTRAL_INTEGRATION_AUTHORITY_READY"
    v.require(ancestor(BACKEND, lane_commit, default_head), "backend default is not generation commit descendant")
    return "AUTH_V62_GENERATION_INTEGRATED_LATER_DESCENDANT_CONTROL_DELEGATED"


def check_lane(v: V, carrier: dict[str, Any], clean_data: bytes) -> str:
    authority = carrier["authority"]
    maximum = set(authority["generationExecution"]["maximumChangedPaths"])
    v.require(present(WORKTREE) and WORKTREE.absolute() == WORKTREE.resolve(), "worktree missing or symlinked")
    hygiene(v, WORKTREE)
    v.exact(Path(text(WORKTREE, "rev-parse", "--show-toplevel")).resolve(), WORKTREE.resolve(), "worktree Git root drift")
    v.exact(text(WORKTREE, "branch", "--show-current"), LANE, "lane branch drift")
    head = text(WORKTREE, "rev-parse", "HEAD")
    v.require(ancestor(WORKTREE, BACKEND_BASE, head), "lane does not descend from base")
    delta = between(WORKTREE, BACKEND_BASE, head) | changes(WORKTREE)
    if head == BACKEND_BASE and not delta:
        final_shadow_absence(v, WORKTREE)
        v.require(not present(TARGETED_RECEIPT), "targeted receipt exists before generation")
        v.require(not present(POST_REVIEW_RECEIPT), "post-review receipt exists before generation")
        return "CLEAN_WORKTREE_READY_FOR_AUTH_V62_GENERATION"
    v.require(bool(delta), "lane advanced without path delta")
    v.require(delta <= maximum, f"lane path expansion: {sorted(delta - maximum)}")
    ignored_source = shadow(WORKTREE, ignored=True, roots=SOURCE_TEST_SHADOW_ROOTS)
    untracked_source = shadow(WORKTREE, ignored=False, roots=SOURCE_TEST_SHADOW_ROOTS)
    v.require(not ignored_source, f"ignored source/test shadow exists: {sorted(ignored_source)}")
    v.require(untracked_source <= maximum, f"untracked source/test path outside allowlist: {sorted(untracked_source - maximum)}")
    production_java = {path for path in delta if "/src/main/java/" in path}
    v.require(production_java <= COMPATIBILITY_SOURCE_PATHS, "source-authority boundary expanded")
    v.require(not any("/db/migration/" in path or "V271" in path for path in delta), "migration or V271 changed")
    for path in delta:
        if (WORKTREE / path).exists():
            v.require(symlink_free(WORKTREE, path), f"changed path symlinked: {path}")
    dirty = changes(WORKTREE)
    if dirty:
        v.require(not present(TARGETED_RECEIPT), "targeted receipt exists for dirty lane")
        v.require(not present(POST_REVIEW_RECEIPT), "post-review receipt exists for dirty lane")
        return "BOUNDED_AUTH_V62_GENERATION_LANE_IN_PROGRESS"
    final_shadow_absence(v, WORKTREE)
    parents = text(WORKTREE, "rev-list", "--parents", "-n", "1", head).split()
    v.exact(parents, [head, BACKEND_BASE], "generation lane must be exact non-merge direct child of base")
    tree = text(WORKTREE, "rev-parse", f"{head}^{{tree}}")
    paths = sorted(between(WORKTREE, BACKEND_BASE, head))
    v.require(bool(paths) and set(paths) == delta, "committed generation path evidence drift")
    remote = git(BACKEND, "rev-parse", "--verify", f"refs/remotes/origin/{LANE}", check=False)
    if not present(TARGETED_RECEIPT):
        v.require(not present(POST_REVIEW_RECEIPT), "post-review receipt exists without targeted receipt")
        v.require(remote.returncode != 0, "lane pushed before targeted verification and review")
        return "COMMITTED_AUTH_V62_GENERATION_TARGETED_VERIFICATION_RECEIPT_REQUIRED"
    targeted_data, verified = check_targeted_receipt(
        v, carrier, authority, clean_data, head, tree, paths,
    )
    if not present(POST_REVIEW_RECEIPT):
        v.require(remote.returncode != 0, "lane pushed before post-implementation review")
        return "VERIFIED_AUTH_V62_GENERATION_POST_IMPLEMENTATION_REVIEW_REQUIRED"
    check_post_review_receipt(v, carrier, authority, targeted_data, verified, head, tree, paths)
    return "REVIEWED_AUTH_V62_GENERATION_LANE_PUSHED_DESCENDANT_GOVERNANCE_REQUIRED"


def authoring(v: V) -> dict[str, Any]:
    v.exact(text(FRONTEND, "branch", "--show-current"), "dwp-dev", "frontend branch drift")
    v.exact(text(FRONTEND, "rev-parse", "HEAD"), FRONTEND_BASE, "frontend base drift")
    v.exact(text(FRONTEND, "rev-parse", "origin/dwp-dev"), FRONTEND_BASE, "frontend origin drift")
    v.exact(changes(FRONTEND), CARRIER_PATHS, "authoring five-path carrier drift")
    blobs: dict[str, bytes] = {}
    for path in (AUTHORITY_REL, TOKEN_REL, REVIEW_REL, VALIDATOR_REL, "package.json"):
        v.require(symlink_free(FRONTEND, path), f"authoring artifact missing or symlinked: {path}")
        blobs[path] = (FRONTEND / path).read_bytes()
    check_package(v, blobs["package.json"], True)
    authority, _ = check_authority_and_token(v, blobs[AUTHORITY_REL], blobs[TOKEN_REL])
    check_review(v, blobs[REVIEW_REL], blobs, None)
    return {"commit": None, "tree": None, "blobs": blobs, "authority": authority}


def historical(v: V) -> dict[str, Any]:
    v.exact(text(FRONTEND, "branch", "--show-current"), "dwp-dev", "frontend branch drift")
    head, origin = text(FRONTEND, "rev-parse", "HEAD"), text(FRONTEND, "rev-parse", "origin/dwp-dev")
    v.exact(head, origin, "frontend HEAD/origin drift")
    v.require(not changes(FRONTEND), "frontend dirty")
    additions: list[str] = []
    for path in (AUTHORITY_REL, TOKEN_REL, REVIEW_REL, VALIDATOR_REL):
        found = [line for line in text(FRONTEND, "log", "--diff-filter=A", "--format=%H", "--", path).splitlines() if line]
        v.require(len(found) == 1, f"carrier introduction ambiguous: {path}")
        additions.extend(found)
    v.require(len(set(additions)) == 1, "carrier artifacts introduced separately")
    carrier = additions[0] if additions else ""
    v.exact(text(FRONTEND, "rev-list", "--parents", "-n", "1", carrier).split(), [carrier, FRONTEND_BASE], "carrier parent drift")
    v.exact(between(FRONTEND, FRONTEND_BASE, carrier), CARRIER_PATHS, "carrier path set drift")
    v.require(ancestor(FRONTEND, carrier, head), "carrier not on frontend dwp-dev")
    tree = text(FRONTEND, "rev-parse", f"{carrier}^{{tree}}")
    committed = parse_time(text(FRONTEND, "show", "-s", "--format=%cI", carrier), "carrier committedAt")
    correction = lifecycle_correction(v)
    blobs: dict[str, bytes] = {}
    for path in (AUTHORITY_REL, TOKEN_REL, REVIEW_REL, VALIDATOR_REL, "package.json"):
        v.exact(mode(FRONTEND, carrier, path), "100644", f"unsafe carrier mode: {path}")
        data = blob(FRONTEND, carrier, path)
        v.require(data is not None, f"missing carrier blob: {path}")
        blobs[path] = data or b""
        if path != "package.json":
            v.require(symlink_free(FRONTEND, path), f"current artifact missing/symlinked: {path}")
            expected_live = (
                correction["blobs"][path]
                if path == VALIDATOR_REL else blobs[path]
            )
            v.exact(artifact(path, (FRONTEND / path).read_bytes()), artifact(path, expected_live), f"artifact mutated: {path}")
    check_package(v, blobs["package.json"], True)
    if head != carrier:
        check_package(v, (FRONTEND / "package.json").read_bytes(), False)
    authority, _ = check_authority_and_token(v, blobs[AUTHORITY_REL], blobs[TOKEN_REL])
    check_review(v, blobs[REVIEW_REL], blobs, committed)
    return {"commit": carrier, "tree": tree, "blobs": blobs, "authority": authority}


def negatives(v: V) -> None:
    for left, right in ((True, 1), (False, 0), (1, 1.0)):
        v.require(not strict_equal(left, right), "strict-type fixture accepted")
    for raw in (b'{"x":1,"x":2}', b'{"x":NaN}', b'{"x":Infinity}'):
        try:
            load_json(raw, "negative")
        except VerificationError:
            continue
        raise VerificationError("invalid JSON fixture accepted")
    for unsafe in ("../x", "/x", "a//b", "a/./b"):
        v.require(not canonical(unsafe), f"unsafe path accepted: {unsafe}")



def expected_lifecycle_correction_authority() -> dict[str, Any]:
    return {
        "schema": "dwp.hris.wave7.hrm013-validator-lifecycle-successor-authority.v1",
        "state": "INDEPENDENTLY_REVIEWED_HASH_BOUND_EXACT_THREE_VALIDATOR_LIFECYCLE_SUCCESSOR",
        "sliceId": "BASE-TFR-HRM-013",
        "lane": "FRONTEND_VALIDATOR_LIFECYCLE_CORRECTION",
        "carrier": {
            "repository": "dwp-frontend",
            "branch": LIFECYCLE_CORRECTION_BRANCH,
            "baseCommit": LIFECYCLE_CORRECTION_BASE,
            "baseTree": LIFECYCLE_CORRECTION_BASE_TREE,
            "requiredDirectChild": True,
            "exactChangedPathCount": 7,
            "exactChangedPaths": [
                *LIFECYCLE_VALIDATORS,
                LIFECYCLE_CORRECTION_AUTHORITY,
                LIFECYCLE_CORRECTION_REVIEW,
                LIFECYCLE_CORRECTION_VALIDATOR,
                "package.json",
            ],
        },
        "historicalValidatorIntroductions": [
            {"path": LIFECYCLE_SEVENTH_VALIDATOR, "commit": "d80e886121886792c33150b0ff97f128f0da9e14"},
            {"path": LIFECYCLE_EIGHTH_VALIDATOR, "commit": "4b24bdefb0f61d5cb61d89d08397975e45ac389e"},
            {"path": LIFECYCLE_NINTH_VALIDATOR, "commit": "24cb37b7c9f23b2f74a833aedf6939e499f5ab99"},
        ],
        "correction": {
            "modifiedValidatorPaths": LIFECYCLE_VALIDATORS,
            "historicalAuthorityReviewAndTokenBlobsRemainPinned": True,
            "successorBlobSubstitutionRestrictedToValidatorPaths": True,
            "packageMutationRestrictedToExactSingleValidatorAppend": True,
            "basePackagePin": {
                "path": "package.json", "bytes": 16469,
                "sha256": "0e496cced22dbc11a4c9dfd7315f83d8ae6c905ec99c4cec166a6437b6a6e3ee",
            },
            "appendedValidatorPath": LIFECYCLE_CORRECTION_VALIDATOR,
            "approvalRuntimeHardening": {
                "carrierCommit": APPROVAL_INTEGRATION_COMMIT,
                "carrierTree": APPROVAL_INTEGRATION_TREE,
                "carrierParent": APPROVAL_INTEGRATION_PARENT,
                "exactChangedPathCount": 9,
                "authRuntimeValidatorPath": HARDENED_AUTH_RUNTIME_VALIDATOR,
                "authRuntimeValidatorBytes": 34031,
                "authRuntimeValidatorSha256": "a84254807daebc854ae35c9c6388869d02ba4129deda3a94312a367fad117b1c",
            },
        },
        "authority": {
            "independentReviewComplete": True,
            "exactSevenPathCarrierCommitAndPushAuthorized": True,
            "existingCurrentContractChainRevalidationAuthorized": True,
            "exactSingleValidatorPackageAppendAuthorized": True,
            "backendDwpDevIntegrationAuthorized": False,
            "approvalRuntimeIntegrationAuthorityExpanded": False,
            "peopleIntegrationAuthorized": False,
            "featureActivationAuthorized": False,
            "tenantEnrollmentAuthorized": False,
            "runtimeCredentialProvisioningAuthorized": False,
            "productionReleaseAuthorized": False,
            "businessCompletionCredit": 0,
        },
        "next": (
            "RERUN_CURRENT_CONTRACT_CHAIN_THEN_CONTINUE_ONLY_UNDER_"
            "EXISTING_APPROVAL_RUNTIME_INTEGRATION_AUTHORITY"
        ),
    }


def lifecycle_correction(v: V, authoring: bool = False) -> dict[str, Any]:
    v.exact(
        text(FRONTEND, "rev-parse", f"{LIFECYCLE_CORRECTION_BASE}^{{tree}}"),
        LIFECYCLE_CORRECTION_BASE_TREE,
        "lifecycle correction base tree",
    )
    v.exact(
        text(FRONTEND, "rev-list", "--parents", "-n", "1", APPROVAL_INTEGRATION_COMMIT).split(),
        [APPROVAL_INTEGRATION_COMMIT, APPROVAL_INTEGRATION_PARENT],
        "Approval integration carrier parent",
    )
    v.exact(
        text(FRONTEND, "rev-parse", f"{APPROVAL_INTEGRATION_COMMIT}^{{tree}}"),
        APPROVAL_INTEGRATION_TREE,
        "Approval integration carrier tree",
    )
    v.exact(
        between(FRONTEND, APPROVAL_INTEGRATION_PARENT, APPROVAL_INTEGRATION_COMMIT),
        APPROVAL_INTEGRATION_PATHS,
        "Approval integration carrier paths",
    )
    hardened = blob(FRONTEND, APPROVAL_INTEGRATION_COMMIT, HARDENED_AUTH_RUNTIME_VALIDATOR)
    v.require(hardened is not None, "hardened Auth runtime validator missing")
    v.exact(
        artifact(HARDENED_AUTH_RUNTIME_VALIDATOR, hardened or b""),
        {
            "path": HARDENED_AUTH_RUNTIME_VALIDATOR,
            "bytes": 34031,
            "sha256": "a84254807daebc854ae35c9c6388869d02ba4129deda3a94312a367fad117b1c",
        },
        "hardened Auth runtime validator pin",
    )

    if authoring:
        v.exact(text(FRONTEND, "branch", "--show-current"), LIFECYCLE_CORRECTION_BRANCH, "correction branch")
        v.exact(text(FRONTEND, "rev-parse", "HEAD"), LIFECYCLE_CORRECTION_BASE, "correction authoring head")
        v.exact(text(FRONTEND, "rev-parse", "origin/dwp-dev"), LIFECYCLE_CORRECTION_BASE, "correction authoring origin")
        v.exact(changes(FRONTEND), LIFECYCLE_CORRECTION_PATHS, "correction authoring paths")
        commit = None
    else:
        additions: list[str] = []
        for path in (
            LIFECYCLE_CORRECTION_AUTHORITY,
            LIFECYCLE_CORRECTION_REVIEW,
            LIFECYCLE_CORRECTION_VALIDATOR,
        ):
            found = [
                line for line in text(
                    FRONTEND, "log", "--diff-filter=A", "--format=%H", "--", path,
                ).splitlines() if line
            ]
            v.require(len(found) == 1, f"lifecycle correction introduction ambiguous: {path}")
            additions.extend(found)
        v.exact(len(set(additions)), 1, "lifecycle correction artifacts introduced separately")
        commit = additions[0] if additions else ""
        v.exact(
            text(FRONTEND, "rev-list", "--parents", "-n", "1", commit).split(),
            [commit, LIFECYCLE_CORRECTION_BASE],
            "lifecycle correction is not the exact direct child",
        )
        v.exact(
            between(FRONTEND, LIFECYCLE_CORRECTION_BASE, commit),
            LIFECYCLE_CORRECTION_PATHS,
            "lifecycle correction path set",
        )
        head = text(FRONTEND, "rev-parse", "HEAD")
        origin = text(FRONTEND, "rev-parse", "origin/dwp-dev")
        v.require(
            ancestor(FRONTEND, commit, head) and ancestor(FRONTEND, commit, origin),
            "lifecycle correction is not on pushed frontend dwp-dev",
        )
        v.exact(head, origin, "frontend HEAD/origin drift after lifecycle correction")
        v.exact(changes(FRONTEND), set(), "frontend dirty after lifecycle correction")

    blobs: dict[str, bytes] = {}
    for path in [
        LIFECYCLE_CORRECTION_AUTHORITY,
        LIFECYCLE_CORRECTION_REVIEW,
        LIFECYCLE_CORRECTION_VALIDATOR,
        *LIFECYCLE_VALIDATORS,
        "package.json",
    ]:
        if commit is None:
            candidate = FRONTEND / path
            v.require(candidate.is_file() and not candidate.is_symlink(), f"correction artifact missing: {path}")
            v.exact(stat.S_IMODE(candidate.stat().st_mode), 0o644, f"correction artifact mode: {path}")
            data = candidate.read_bytes()
        else:
            v.exact(mode(FRONTEND, commit, path), "100644", f"correction carrier mode: {path}")
            data = blob(FRONTEND, commit, path)
            v.require(data is not None, f"correction carrier artifact missing: {path}")
            data = data or b""
            v.exact(mode(FRONTEND, text(FRONTEND, "rev-parse", "HEAD"), path), "100644", f"current correction mode: {path}")
            v.require(symlink_free(FRONTEND, path), f"current correction artifact symlinked: {path}")
            v.exact(
                artifact(path, (FRONTEND / path).read_bytes()),
                artifact(path, data),
                f"current correction artifact drift: {path}",
            )
        blobs[path] = data

    base_package = blob(FRONTEND, LIFECYCLE_CORRECTION_BASE, "package.json")
    v.require(base_package is not None, "correction base package missing")
    v.exact(
        artifact("package.json", base_package or b""),
        {
            "path": "package.json", "bytes": 16469,
            "sha256": "0e496cced22dbc11a4c9dfd7315f83d8ae6c905ec99c4cec166a6437b6a6e3ee",
        },
        "correction base package pin",
    )
    base_package_json = load_json(base_package or b"", "lifecycle correction base package")
    base_command = base_package_json["scripts"]["hris:current-contracts:check"]
    successor_command = base_command + " && python3 " + LIFECYCLE_CORRECTION_VALIDATOR
    old_command = json.dumps(base_command, ensure_ascii=False).encode()[1:-1]
    new_command = json.dumps(successor_command, ensure_ascii=False).encode()[1:-1]
    v.exact((base_package or b"").count(old_command), 1, "base package command byte count")
    expected_package = (base_package or b"").replace(old_command, new_command, 1)
    v.exact(blobs["package.json"], expected_package, "lifecycle correction package bytes drift")
    package = load_json(blobs["package.json"], "lifecycle correction package")
    scripts = package.get("scripts")
    v.require(isinstance(scripts, dict), "lifecycle correction scripts missing")
    if isinstance(scripts, dict):
        v.require("prehris:current-contracts:check" not in scripts, "lifecycle correction npm pre-hook")
        v.require("posthris:current-contracts:check" not in scripts, "lifecycle correction npm post-hook")
        command = scripts.get("hris:current-contracts:check")
        v.require(isinstance(command, str), "lifecycle correction chain missing")
        if isinstance(command, str):
            parts = command.split(" && ")
            matches = [re.fullmatch(
                r"python3 (docs/06-delivery/hris/[A-Za-z0-9._/-]+/validate_[A-Za-z0-9_]+\.py)",
                item,
            ) for item in parts]
            v.require(all(matches), "lifecycle correction contains a non-validator command")
            validator_paths = [match.group(1) for match in matches if match]
            v.exact(len(validator_paths), len(set(validator_paths)), "lifecycle correction duplicate validator")
            v.exact(validator_paths[-1], LIFECYCLE_CORRECTION_VALIDATOR, "lifecycle correction validator order")
    correction_validator = FRONTEND / LIFECYCLE_CORRECTION_VALIDATOR
    v.require(
        correction_validator.is_file() and not correction_validator.is_symlink(),
        "lifecycle correction validator missing or symlinked",
    )
    tracked = git(
        FRONTEND, "ls-files", "--error-unmatch", "--",
        LIFECYCLE_CORRECTION_VALIDATOR, check=False,
    )
    v.require(tracked.returncode == 0, "lifecycle correction validator is untracked")
    v.exact(
        artifact("package.json", (FRONTEND / "package.json").read_bytes()),
        artifact("package.json", blobs["package.json"]),
        "live package drift during lifecycle correction",
    )

    authority = load_json(blobs[LIFECYCLE_CORRECTION_AUTHORITY], "lifecycle correction authority")
    v.exact(authority, expected_lifecycle_correction_authority(), "lifecycle correction authority drift")
    review = load_json(blobs[LIFECYCLE_CORRECTION_REVIEW], "lifecycle correction review")
    v.exact(
        set(review),
        {"schema", "state", "reviewedAt", "reviewer", "scope", "findings", "finalVerdict", "authority", "artifactPins"},
        "lifecycle correction review key set",
    )
    v.exact(review.get("schema"), "dwp.hris.wave7.hrm013-validator-lifecycle-successor-independent-review.v1", "lifecycle review schema")
    v.exact(review.get("state"), "INDEPENDENT_ZERO_FINDING_REVIEW_OF_EXACT_SEVEN_PATH_VALIDATOR_LIFECYCLE_SUCCESSOR", "lifecycle review state")
    v.exact(review.get("reviewer"), "INDEPENDENT_HRM013_VALIDATOR_LIFECYCLE_SUCCESSOR_REVIEW", "lifecycle reviewer")
    v.exact(review.get("scope"), {
        "authorityPath": LIFECYCLE_CORRECTION_AUTHORITY,
        "reviewPath": LIFECYCLE_CORRECTION_REVIEW,
        "validatorPath": LIFECYCLE_CORRECTION_VALIDATOR,
        "modifiedValidatorPaths": LIFECYCLE_VALIDATORS,
        "packagePath": "package.json",
        "reviewedBoundaries": [
            "EXACT_DIRECT_CHILD_SEVEN_PATH_CARRIER",
            "ORIGINAL_AUTHORITY_REVIEW_AND_TOKEN_BLOBS_REMAIN_IMMUTABLE",
            "ONLY_THREE_VALIDATOR_BLOBS_USE_THE_CORRECTION_CARRIER",
            "AUTH_RUNTIME_HARDENING_BOUND_TO_EXACT_APPROVAL_INTEGRATION_CARRIER",
            "EXACT_SINGLE_VALIDATOR_PACKAGE_APPEND_AND_NO_BACKEND_OR_ACTIVATION_AUTHORITY",
        ],
    }, "lifecycle review scope")
    v.exact(review.get("findings"), {"p0": [], "p1": [], "p2": []}, "lifecycle review findings")
    v.exact(review.get("finalVerdict"), {
        "p0": 0, "p1": 0, "p2": 0,
        "decision": "GO_FOR_EXACT_SEVEN_PATH_VALIDATOR_LIFECYCLE_SUCCESSOR_ONLY",
    }, "lifecycle review verdict")
    v.exact(review.get("authority"), {
        "independentReviewComplete": True,
        "exactSevenPathCarrierCommitAndPushAuthorized": True,
        "currentContractChainRevalidationAuthorized": True,
        "exactSingleValidatorPackageAppendAuthorized": True,
        "backendDwpDevIntegrationAuthorized": False,
        "featureActivationOrProductionAuthority": False,
        "businessCompletionCredit": 0,
    }, "lifecycle review authority")
    v.exact(review.get("artifactPins"), [
        artifact(LIFECYCLE_CORRECTION_AUTHORITY, blobs[LIFECYCLE_CORRECTION_AUTHORITY]),
        artifact(LIFECYCLE_CORRECTION_VALIDATOR, blobs[LIFECYCLE_CORRECTION_VALIDATOR]),
        *[artifact(path, blobs[path]) for path in LIFECYCLE_VALIDATORS],
        artifact("package.json", blobs["package.json"]),
    ], "lifecycle review artifact pins")
    reviewed_at = parse_time(review.get("reviewedAt"), "lifecycle correction reviewedAt")
    v.require(
        reviewed_at <= datetime.now(timezone.utc) + timedelta(minutes=5),
        "lifecycle correction review is in the future",
    )
    base_at = parse_time(
        text(FRONTEND, "show", "-s", "--format=%cI", LIFECYCLE_CORRECTION_BASE),
        "lifecycle correction base committedAt",
    )
    hardening_at = parse_time(
        text(FRONTEND, "show", "-s", "--format=%cI", APPROVAL_INTEGRATION_COMMIT),
        "Approval integration committedAt",
    )
    v.require(max(base_at, hardening_at) <= reviewed_at, "lifecycle review predates its prerequisites")
    if commit is None:
        latest = max(
            datetime.fromtimestamp(
                int((FRONTEND / path).stat().st_mtime), timezone.utc,
            )
            for path in [
                LIFECYCLE_CORRECTION_AUTHORITY,
                LIFECYCLE_CORRECTION_VALIDATOR,
                *LIFECYCLE_VALIDATORS,
                "package.json",
            ]
        )
        v.require(latest <= reviewed_at, "lifecycle review predates final authoring snapshot")
    else:
        committed_at = parse_time(
            text(FRONTEND, "show", "-s", "--format=%cI", commit),
            "lifecycle correction committedAt",
        )
        v.require(reviewed_at <= committed_at, "lifecycle review follows correction commit")
    return {
        "commit": commit,
        "blobs": blobs,
        "hardenedAuthRuntimeValidator": hardened or b"",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--authoring", action="store_true")
    parser.add_argument("--lifecycle-correction-authoring", action="store_true")
    parser.add_argument("--require-trusted", action="store_true")
    args = parser.parse_args()
    v = V()
    try:
        isolated = runtime(
            v,
            args.require_trusted or args.authoring
            or args.lifecycle_correction_authoring,
        )
        if args.lifecycle_correction_authoring:
            lifecycle_correction(v, authoring=True)
            print(
                "PASS state=VALIDATOR_LIFECYCLE_SUCCESSOR_READY_TO_COMMIT_AND_PUSH "
                f"checks={v.checks} trusted_runtime={'true' if isolated else 'false'}"
            )
            return 0
        negatives(v)
        v.require(SCRIPT == SCRIPT.resolve(), "validator path symlinked")
        hygiene(v, FRONTEND)
        hygiene(v, BACKEND)
        check_predecessors(v)
        backend_default(v, args.authoring)
        if args.authoring:
            carrier = authoring(v)
            lane_absent(v)
            state = "AUTHORITY_CARRIER_AUTHORING_MATERIALIZATION_NOT_YET_ALLOWED"
        else:
            carrier = historical(v)
            if not present(CLEAN_RECEIPT):
                lane_absent(v)
                state = "AUTHORITY_CARRIER_PUSHED_CLEAN_WORKTREE_RECEIPT_REQUIRED"
            else:
                clean_data = check_clean_receipt(v, carrier)
                state = check_lane(v, carrier, clean_data)
                if present(CENTRAL_INTEGRATION_RECEIPT):
                    lane_commit = text(WORKTREE, "rev-parse", "HEAD")
                    lane_tree = text(WORKTREE, "rev-parse", f"{lane_commit}^{{tree}}")
                    changed_paths = sorted(between(WORKTREE, BACKEND_BASE, lane_commit))
                    state = check_central_integration(
                        v, carrier, lane_commit, lane_tree, changed_paths,
                    )
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
