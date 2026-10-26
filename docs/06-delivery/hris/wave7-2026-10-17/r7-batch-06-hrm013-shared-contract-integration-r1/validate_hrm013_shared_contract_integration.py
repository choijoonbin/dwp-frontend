#!/usr/bin/env python3
"""Fail-closed HRM-013 shared-contract central-integration validator.

The package command is compatibility evidence.  An authoritative invocation uses
``/usr/bin/python3 -I`` with ``--require-trusted`` (``--authoring`` implies it).
This validator is deliberately read-only: in particular, it never creates the
external central-integration receipt or descendant-governance receipts.
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


SCRIPT_FILE = Path(__file__).absolute()
HERE = SCRIPT_FILE.parent
FRONTEND = HERE.parents[4]
WORKSPACE = FRONTEND.parent
BACKEND = WORKSPACE / "dwp-backend"

GIT = "/usr/bin/git"
TRUSTED_PYTHON_EXECUTABLES = {
    Path("/usr/bin/python3").resolve(),
    Path("/Library/Developer/CommandLineTools/usr/bin/python3").resolve(),
}
SAFE_GIT_ENV = {
    "PATH": "/usr/bin:/bin",
    "HOME": "/var/empty",
    "LC_ALL": "C",
    "LANG": "C",
    "GIT_CONFIG_NOSYSTEM": "1",
    "GIT_CONFIG_GLOBAL": "/dev/null",
    "GIT_NO_REPLACE_OBJECTS": "1",
}
TRUSTED_RUNTIME_ENV = {
    "PATH": "/usr/bin:/bin",
    "HOME": "/var/empty",
    "LC_ALL": "C",
    "LANG": "C",
    "CPATH": "/usr/local/include",
    "LIBRARY_PATH": "/usr/local/lib",
    "MANPATH": "/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/share/man:/Library/Developer/CommandLineTools/usr/share/man:/Library/Developer/CommandLineTools/Toolchains/XcodeDefault.xctoolchain/usr/share/man:",
    "SDKROOT": "/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk",
    "__CF_USER_TEXT_ENCODING": "0x1F7:0x3:0x33",
}
UNSAFE_GIT_ENV = {
    "GIT_DIR",
    "GIT_WORK_TREE",
    "GIT_INDEX_FILE",
    "GIT_OBJECT_DIRECTORY",
    "GIT_ALTERNATE_OBJECT_DIRECTORIES",
    "GIT_COMMON_DIR",
    "GIT_CEILING_DIRECTORIES",
    "GIT_DISCOVERY_ACROSS_FILESYSTEM",
    "GIT_CONFIG",
    "GIT_CONFIG_COUNT",
    "GIT_CONFIG_PARAMETERS",
    "GIT_CONFIG_SYSTEM",
    "GIT_EXEC_PATH",
    "GIT_ATTR_NOSYSTEM",
    "GIT_OPTIONAL_LOCKS",
    "GIT_EXTERNAL_DIFF",
}

FRONTEND_BASE = "58cad5d0b1506cda5103dfe87a54b589bdebdc52"
FRONTEND_BASE_TREE = "46e0a4f71fe1d545a9dbd9f4a25d9f1284c948cb"
BACKEND_BASE = "c50b267e7b015758ab6f7acc7fdf353eee81e631"
BACKEND_BASE_TREE = "22bd6533ab340cfb91c6cf5ab5fd6991e501e6c4"
LANE_BRANCH = "codex/hris-wave7-batch06-hrm013-runtime-contract-backend-20261026-r1"
LANE_COMMIT = "3505cb2e84fc73f97d62de385cc347c5f8c81572"
LANE_TREE = "fa84a79668fd0f133d34c81d5a649747a6c527b6"

PREDECESSOR_AUTHORITY_REL = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-runtime-contract-authority-r1/"
    "hrm-013-runtime-contract-execution-authority.v1.json"
)
PREDECESSOR_VALIDATOR_REL = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-runtime-contract-authority-r1/"
    "validate_hrm013_runtime_contract_authority.py"
)
PREDECESSOR_PINS = [
    {
        "path": PREDECESSOR_AUTHORITY_REL,
        "bytes": 55483,
        "sha256": "9e0c0035b8364f68ff95dc934af8766034c02ddb64cca35255ae8a85eba39fff",
    },
    {
        "path": PREDECESSOR_VALIDATOR_REL,
        "bytes": 141680,
        "sha256": "4860f664184cb9afa4d6f4096777691302e4fcd2281afc8054bdb743579b2e32",
    },
]

AUTHORITY_REL = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-shared-contract-integration-r1/"
    "shared-contract-central-integration-authority.v1.json"
)
VALIDATOR_REL = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-shared-contract-integration-r1/"
    "validate_hrm013_shared_contract_integration.py"
)
REVIEW_REL = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-shared-contract-integration-r1/independent-review.v1.json"
)
CARRIER_PATHS = {"package.json", AUTHORITY_REL, VALIDATOR_REL, REVIEW_REL}

AUTHORIZED_BACKEND_PATHS = [
    "dwp-platform-contracts/src/main/java/com/dwp/platform/contracts/hris/separation/v1/Hrm013SeparationBridgeV1.java",
    "dwp-platform-contracts/src/main/java/com/dwp/platform/contracts/hris/separation/v1/Hrm013WorkloadProofV1.java",
    "dwp-platform-contracts/src/main/java/com/dwp/platform/contracts/hris/separation/v1/HrisServiceGrantAuthorityV1.java",
    "dwp-platform-contracts/src/main/java/com/dwp/platform/contracts/hris/separation/v1/Hrm013SafeErrorV1.java",
    "dwp-platform-contracts/src/main/java/com/dwp/platform/contracts/hris/separation/v1/Hrm013RequesterIdentityAuthorityV1.java",
    "dwp-platform-contracts/src/main/java/com/dwp/platform/contracts/hris/separation/v1/Hrm013TaskDispatchV1.java",
    "dwp-platform-contracts/src/test/java/com/dwp/platform/contract/Hrm013SeparationBridgeV1Test.java",
    "dwp-platform-contracts/src/test/java/com/dwp/platform/contract/Hrm013WorkloadProofV1Test.java",
    "dwp-platform-contracts/src/test/java/com/dwp/platform/contract/HrisServiceGrantAuthorityV1Test.java",
    "dwp-platform-contracts/src/test/java/com/dwp/platform/contract/Hrm013RequesterIdentityAuthorityV1Test.java",
    "dwp-platform-contracts/src/test/java/com/dwp/platform/contract/Hrm013TaskDispatchV1Test.java",
]

RECEIPT_ROOT = Path(
    "/Users/a10697/Work/DWP/.codex-worktrees/hris/wave7-20261026/"
    "batch06/hrm013-owner-runtime/receipts"
)
TARGETED_RECEIPT_PATH = RECEIPT_ROOT / "shared-targeted-verification-receipt.v1.json"
POST_REVIEW_RECEIPT_PATH = RECEIPT_ROOT / "shared-post-implementation-review.v1.json"
CENTRAL_RECEIPT_PATH = RECEIPT_ROOT / "shared-central-integration-authority.v1.json"
DESCENDANT_RECEIPT_ROOT = RECEIPT_ROOT / "backend-descendants"
TARGETED_RECEIPT_SHA256 = "49b03a307cf9364eab7dd35b0bb98a7b5611d68158e99d05c3f6af24904aa4c2"
POST_REVIEW_RECEIPT_SHA256 = "c1fe5fe2c35fd240c8f765d8927b49f307234a968d68889e4b8fb7a0f248b981"

GOVERNANCE_ROOT_REL = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-backend-descendant-governance"
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
    "validate_hrm013_runtime_contract_authority.py"
)
CURRENT_SCRIPT = PREDECESSOR_SCRIPT + " && python3 " + VALIDATOR_REL

AUTHORITY_MAP = {
    "centralIntegrationAuthorityPrepared": True,
    "independentReviewComplete": True,
    "sharedContractFastForwardIntegrationAuthorizedAfterExternalReceipt": True,
    "historicalBackendDescendantGovernanceAssumed": True,
    "sharedContractBlobMutationAuthorized": False,
    "authGenerationAuthorized": False,
    "migrationAuthoringAuthorized": False,
    "runtimeImplementationAuthorized": False,
    "productionBindingAuthorized": False,
    "productionReleaseAuthorized": False,
    "businessCompletionCredit": 0,
}
REVIEW_AUTHORITY_MAP = {
    "independentReviewComplete": True,
    "carrierCommitAndPushAuthorized": True,
    "externalCentralIntegrationAttestationRequired": True,
    "fastForwardIntegrationAuthorizedBeforeExternalAttestation": False,
    "historicalBackendDescendantGovernanceReviewed": True,
    "authGenerationAuthorized": False,
    "migrationAuthoringAuthorized": False,
    "runtimeImplementationAuthorized": False,
    "productionReleaseAuthorized": False,
    "businessCompletionCredit": 0,
}
GOVERNANCE_AUTHORITY_MAP = {
    "backendDescendantGovernanceRecorded": True,
    "sharedElevenBlobsVerifiedImmutable": True,
    "sharedBlobMutationAuthorized": False,
    "authGenerationAuthorized": False,
    "migrationAuthoringAuthorized": False,
    "runtimeImplementationAuthorized": False,
    "productionReleaseAuthorized": False,
    "businessCompletionCredit": 0,
}
GOVERNANCE_REVIEW_AUTHORITY_MAP = {
    "independentReviewComplete": True,
    "descendantGovernanceReceiptAuthorized": True,
    "sharedElevenBlobsVerifiedImmutable": True,
    "sharedBlobMutationAuthorized": False,
    "productionReleaseAuthorized": False,
    "businessCompletionCredit": 0,
}


class VerificationError(RuntimeError):
    """Raised whenever evidence is incomplete, unsafe, ambiguous, or drifting."""


class Verifier:
    def __init__(self) -> None:
        self.checks = 0

    def require(self, condition: bool, message: str) -> None:
        self.checks += 1
        if not condition:
            raise VerificationError(message)

    def exact(self, actual: Any, expected: Any, message: str) -> None:
        self.require(strict_typed_equal(actual, expected), message)


def strict_typed_equal(actual: Any, expected: Any) -> bool:
    if type(actual) is not type(expected):
        return False
    if isinstance(expected, dict):
        return (
            set(actual) == set(expected)
            and all(type(key) is str for key in actual)
            and all(strict_typed_equal(actual[key], expected[key]) for key in expected)
        )
    if isinstance(expected, list):
        return len(actual) == len(expected) and all(
            strict_typed_equal(left, right) for left, right in zip(actual, expected)
        )
    return actual == expected


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def digest_bytes(data: bytes) -> tuple[int, str]:
    return len(data), sha256_bytes(data)


def digest_file(path: Path) -> tuple[int, str]:
    return digest_bytes(path.read_bytes())


def reject_duplicate_pairs(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise VerificationError(f"duplicate JSON key rejected: {key}")
        result[key] = value
    return result


def reject_nonfinite_json_constant(value: str) -> Any:
    raise VerificationError(f"non-finite JSON number rejected: {value}")


def load_json_bytes(data: bytes, label: str) -> dict[str, Any]:
    try:
        value = json.loads(
            data.decode("utf-8"),
            object_pairs_hook=reject_duplicate_pairs,
            parse_constant=reject_nonfinite_json_constant,
        )
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise VerificationError(f"invalid UTF-8 JSON in {label}: {exc}") from exc
    if not isinstance(value, dict):
        raise VerificationError(f"JSON root must be an object: {label}")
    return value


def check_closed_keys(v: Verifier, value: Any, expected: set[str], label: str) -> None:
    v.require(isinstance(value, dict), f"{label} must be an object")
    if isinstance(value, dict):
        v.require(
            set(value) == expected,
            f"{label} key set drift: {sorted(set(value) ^ expected)}",
        )


RFC3339_SECONDS = re.compile(
    r"(?P<date>[0-9]{4}-[0-9]{2}-[0-9]{2})T"
    r"(?P<time>[0-9]{2}:[0-9]{2}:[0-9]{2})"
    r"(?P<zone>Z|[+-][0-9]{2}:[0-9]{2})"
)


def parse_rfc3339_seconds(value: Any, label: str) -> datetime:
    if type(value) is not str or RFC3339_SECONDS.fullmatch(value) is None:
        raise VerificationError(
            f"{label} must be RFC3339 with seconds and an explicit timezone"
        )
    normalized = value[:-1] + "+00:00" if value.endswith("Z") else value
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError as exc:
        raise VerificationError(f"{label} is not a real calendar timestamp") from exc
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise VerificationError(f"{label} lacks a timezone")
    offset = parsed.utcoffset()
    if offset is None or abs(offset) > timedelta(hours=23, minutes=59):
        raise VerificationError(f"{label} has an invalid UTC offset")
    return parsed.astimezone(timezone.utc)


def require_not_future(v: Verifier, observed: datetime, label: str) -> None:
    v.require(
        observed <= datetime.now(timezone.utc) + timedelta(minutes=5),
        f"{label} is more than five minutes in the future",
    )


def require_causal_order(
    v: Verifier, labeled_events: list[tuple[str, datetime]]
) -> None:
    for (left_label, left), (right_label, right) in zip(
        labeled_events, labeled_events[1:]
    ):
        v.require(
            left <= right,
            f"causal order violation: {left_label} must not follow {right_label}",
        )


def canonical_relative_path(value: str) -> bool:
    if type(value) is not str or not value:
        return False
    path = PurePosixPath(value)
    return (
        not path.is_absolute()
        and path.as_posix() == value
        and all(part not in {"", ".", ".."} for part in path.parts)
    )


def symlink_free_path(
    root: Path, relative_path: str, *, terminal_may_be_missing: bool = False
) -> bool:
    if not canonical_relative_path(relative_path):
        return False
    root_absolute = root.absolute()
    if root_absolute != root_absolute.resolve() or root_absolute.is_symlink():
        return False
    current = root_absolute
    parts = PurePosixPath(relative_path).parts
    for index, part in enumerate(parts):
        current /= part
        if not current.exists() and not current.is_symlink():
            return terminal_may_be_missing and index == len(parts) - 1
        try:
            mode = current.lstat().st_mode
        except FileNotFoundError:
            return terminal_may_be_missing and index == len(parts) - 1
        if stat.S_ISLNK(mode):
            return False
    try:
        current.resolve().relative_to(root_absolute.resolve())
    except ValueError:
        return False
    return True


def absolute_path_is_regular_and_symlink_free(path: Path) -> bool:
    absolute = path.absolute()
    if absolute != absolute.resolve() or not absolute.is_file() or absolute.is_symlink():
        return False
    current = Path(absolute.anchor)
    for part in absolute.parts[1:]:
        current /= part
        try:
            if stat.S_ISLNK(current.lstat().st_mode):
                return False
        except FileNotFoundError:
            return False
    return True


def open_real_directory(path: Path) -> int:
    absolute = path.absolute()
    if not absolute.is_absolute():
        raise VerificationError(f"directory must be absolute: {path}")
    flags = os.O_RDONLY | getattr(os, "O_DIRECTORY", 0) | getattr(os, "O_NOFOLLOW", 0)
    descriptor = os.open(absolute.anchor, flags)
    try:
        for part in absolute.parts[1:]:
            child = os.open(part, flags, dir_fd=descriptor)
            os.close(descriptor)
            descriptor = child
    except Exception:
        os.close(descriptor)
        raise
    return descriptor


def safe_read_receipt(
    path: Path, label: str, *, maximum_bytes: int = 65536
) -> tuple[bytes, os.stat_result]:
    directory_fd = open_real_directory(path.parent)
    descriptor = -1
    try:
        descriptor = os.open(
            path.name,
            os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0),
            dir_fd=directory_fd,
        )
        before = os.fstat(descriptor)
        if (
            not stat.S_ISREG(before.st_mode)
            or stat.S_IMODE(before.st_mode) != 0o600
            or before.st_uid != os.geteuid()
            or before.st_nlink != 1
            or before.st_size > maximum_bytes
        ):
            raise VerificationError(
                f"{label} must be a current-user 0600 single-link regular file "
                f"no larger than {maximum_bytes} bytes"
            )
        with os.fdopen(descriptor, "rb", closefd=True) as stream:
            descriptor = -1
            data = stream.read(maximum_bytes + 1)
            after = os.fstat(stream.fileno())
        stable = (
            "st_dev",
            "st_ino",
            "st_mode",
            "st_uid",
            "st_nlink",
            "st_size",
            "st_mtime_ns",
        )
        if len(data) != before.st_size or len(data) > maximum_bytes:
            raise VerificationError(f"{label} changed while being read or is oversized")
        if any(getattr(before, key) != getattr(after, key) for key in stable):
            raise VerificationError(f"{label} metadata changed while being read")
        return data, before
    finally:
        if descriptor >= 0:
            os.close(descriptor)
        os.close(directory_fd)


def receipt_exists(path: Path) -> bool:
    return path.exists() or path.is_symlink()


def safe_directory_names(path: Path, label: str) -> set[str]:
    descriptor = open_real_directory(path)
    try:
        names = os.listdir(descriptor)
    finally:
        os.close(descriptor)
    if any(type(name) is not str or not name or "/" in name for name in names):
        raise VerificationError(f"{label} contains an invalid entry name")
    return set(names)


def git(
    repo: Path, *args: str, check: bool = True
) -> subprocess.CompletedProcess[bytes]:
    result = subprocess.run(
        [GIT, *args],
        cwd=repo,
        env=SAFE_GIT_ENV,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        shell=False,
        check=False,
    )
    if check and result.returncode:
        stderr = result.stderr.decode("utf-8", errors="replace").strip()
        raise VerificationError(f"git {' '.join(args)} failed in {repo}: {stderr}")
    return result


def git_text(repo: Path, *args: str) -> str:
    return git(repo, *args).stdout.decode("utf-8", errors="strict").strip()


def git_blob(repo: Path, revision: str, relative_path: str) -> bytes | None:
    result = git(repo, "show", f"{revision}:{relative_path}", check=False)
    return result.stdout if result.returncode == 0 else None


def git_blob_digest(
    repo: Path, revision: str, relative_path: str
) -> tuple[int, str] | None:
    blob = git_blob(repo, revision, relative_path)
    return digest_bytes(blob) if blob is not None else None


def git_tree_mode(repo: Path, revision: str, relative_path: str) -> str | None:
    output = git_text(repo, "ls-tree", revision, "--", relative_path)
    if not output:
        return None
    fields = output.split(None, 3)
    return fields[0] if len(fields) == 4 and fields[3] == relative_path else None


def nul_paths(data: bytes) -> set[str]:
    return {
        item.decode("utf-8", errors="strict")
        for item in data.split(b"\0")
        if item
    }


def working_changes(repo: Path) -> set[str]:
    tracked = nul_paths(git(repo, "diff", "--name-only", "-z", "HEAD", "--").stdout)
    untracked = nul_paths(
        git(repo, "ls-files", "--others", "--exclude-standard", "-z", "--").stdout
    )
    return tracked | untracked


def branch_diff_paths(repo: Path, older: str, newer: str) -> set[str]:
    return nul_paths(git(repo, "diff", "--name-only", "-z", f"{older}..{newer}", "--").stdout)


def is_ancestor(repo: Path, older: str, newer: str) -> bool:
    return git(repo, "merge-base", "--is-ancestor", older, newer, check=False).returncode == 0


def artifact_pin(path: str, data: bytes) -> dict[str, Any]:
    return {"path": path, "bytes": len(data), "sha256": sha256_bytes(data)}


def git_artifact_pin(repo: Path, revision: str, path: str) -> dict[str, Any]:
    blob = git_blob(repo, revision, path)
    if blob is None:
        raise VerificationError(f"artifact blob is missing at {revision}: {path}")
    return artifact_pin(path, blob)


def check_git_hygiene(v: Verifier, repo: Path, expected_root: Path) -> None:
    v.require(
        absolute_path_is_regular_and_symlink_free(Path(GIT)),
        "trusted /usr/bin/git is unavailable",
    )
    actual = Path(git_text(repo, "rev-parse", "--show-toplevel"))
    v.require(
        actual.absolute() == expected_root.absolute()
        and actual.resolve() == expected_root.resolve(),
        f"Git top-level mismatch for {repo}",
    )
    v.require(
        expected_root.absolute() == expected_root.resolve(),
        f"repository root uses a symlink: {expected_root}",
    )
    v.require(
        not git_text(repo, "for-each-ref", "--format=%(refname)", "refs/replace/"),
        f"replace refs are forbidden in {repo}",
    )
    for suffix, label in (("info/grafts", "grafts"), ("info/sparse-checkout", "sparse checkout")):
        candidate = Path(git_text(repo, "rev-parse", "--git-path", suffix))
        if not candidate.is_absolute():
            candidate = repo / candidate
        if suffix.endswith("grafts"):
            v.require(
                not candidate.exists() or candidate.stat().st_size == 0,
                f"{label} are forbidden in {repo}",
            )
        else:
            v.require(not candidate.exists(), f"{label} is forbidden in {repo}")
    unsafe = git(
        repo,
        "config",
        "--get-regexp",
        r"^(core\.sparseCheckout|core\.sparseCheckoutCone|core\.fsmonitor|diff\.external|diff\..*\.command)$",
        check=False,
    )
    v.require(
        unsafe.returncode == 1 and not unsafe.stdout,
        f"unsafe sparse/fsmonitor/external-diff config in {repo}",
    )
    tags = git(repo, "ls-files", "-v", "-z").stdout.split(b"\0")
    v.require(
        not [entry[:1] for entry in tags if entry and entry[:1] != b"H"],
        f"assume-unchanged or skip-worktree index flags in {repo}",
    )


def check_runtime_environment(v: Verifier, *, require_trusted: bool) -> bool:
    v.exact(
        SAFE_GIT_ENV,
        {
            "PATH": "/usr/bin:/bin",
            "HOME": "/var/empty",
            "LC_ALL": "C",
            "LANG": "C",
            "GIT_CONFIG_NOSYSTEM": "1",
            "GIT_CONFIG_GLOBAL": "/dev/null",
            "GIT_NO_REPLACE_OBJECTS": "1",
        },
        "Git subprocess environment drift",
    )
    inherited = sorted(
        key
        for key in os.environ
        if key in UNSAFE_GIT_ENV
        or key.startswith("GIT_CONFIG_KEY_")
        or key.startswith("GIT_CONFIG_VALUE_")
    )
    v.require(not inherited, f"unsafe inherited Git environment: {inherited}")
    isolated = bool(sys.flags.isolated) and Path(sys.executable).resolve() in TRUSTED_PYTHON_EXECUTABLES
    if require_trusted:
        v.require(isolated, "authoritative validation requires /usr/bin/python3 -I")
        v.exact(
            dict(os.environ),
            TRUSTED_RUNTIME_ENV,
            "authoritative validation requires the exact env -i runtime allowlist",
        )
    return isolated


def expected_successor_package_bytes() -> bytes:
    predecessor = git_blob(FRONTEND, FRONTEND_BASE, "package.json")
    if predecessor is None:
        raise VerificationError("pinned frontend predecessor package.json is missing")
    package = load_json_bytes(predecessor, "pinned predecessor package.json")
    scripts = package.get("scripts")
    if not isinstance(scripts, dict):
        raise VerificationError("pinned predecessor scripts object is missing")
    if scripts.get("hris:current-contracts:check") != PREDECESSOR_SCRIPT:
        raise VerificationError("pinned predecessor validator chain drift")
    old = json.dumps(PREDECESSOR_SCRIPT, ensure_ascii=False).encode("utf-8")[1:-1]
    new = json.dumps(CURRENT_SCRIPT, ensure_ascii=False).encode("utf-8")[1:-1]
    if predecessor.count(old) != 1:
        raise VerificationError("pinned predecessor script bytes are missing or ambiguous")
    return predecessor.replace(old, new, 1)


def validate_successor_package(v: Verifier, package_bytes: bytes, label: str) -> None:
    v.require(
        package_bytes == expected_successor_package_bytes(),
        f"{label} is not the exact one-command package successor",
    )
    package = load_json_bytes(package_bytes, label)
    scripts = package.get("scripts")
    v.require(isinstance(scripts, dict), f"{label} scripts object is missing")
    if isinstance(scripts, dict):
        v.require(
            "prehris:current-contracts:check" not in scripts,
            f"{label} pre-hook is forbidden",
        )
        v.require(
            "posthris:current-contracts:check" not in scripts,
            f"{label} post-hook is forbidden",
        )
        v.exact(
            scripts.get("hris:current-contracts:check"),
            CURRENT_SCRIPT,
            f"{label} six-command validator chain drift",
        )


def validate_current_package(v: Verifier, head: str) -> None:
    v.require(
        symlink_free_path(FRONTEND, "package.json"),
        "current package.json is missing or symlinked",
    )
    live = (FRONTEND / "package.json").read_bytes()
    v.require(
        live == (git_blob(FRONTEND, head, "package.json") or b""),
        "current package.json differs from HEAD",
    )
    package = load_json_bytes(live, "current package.json")
    scripts = package.get("scripts")
    v.require(isinstance(scripts, dict), "current package scripts object is missing")
    if not isinstance(scripts, dict):
        return
    v.require(
        "prehris:current-contracts:check" not in scripts,
        "current package pre-hook is forbidden",
    )
    v.require(
        "posthris:current-contracts:check" not in scripts,
        "current package post-hook is forbidden",
    )
    script = scripts.get("hris:current-contracts:check")
    v.require(isinstance(script, str), "current validator chain must be a string")
    if not isinstance(script, str):
        return
    parts = script.split(" && ")
    sealed = CURRENT_SCRIPT.split(" && ")
    v.require(parts[: len(sealed)] == sealed, "current validator chain lost its sealed prefix")
    pattern = re.compile(
        r"python3 (docs/06-delivery/hris/[A-Za-z0-9._/-]+/validate_[A-Za-z0-9_]+\.py)"
    )
    matches = [pattern.fullmatch(part) for part in parts]
    v.require(all(matches), "current validator chain contains a non-validator command")
    paths = [match.group(1) for match in matches if match is not None]
    v.require(len(paths) == len(set(paths)), "current validator chain contains duplicates")
    for path in paths:
        v.require(canonical_relative_path(path), f"noncanonical validator path: {path}")
        v.require(
            symlink_free_path(FRONTEND, path),
            f"current validator path is missing or symlinked: {path}",
        )
        v.require(
            git_tree_mode(FRONTEND, head, path) in {"100644", "100755"},
            f"current validator is not tracked regular: {path}",
        )


def validate_predecessor(v: Verifier) -> None:
    v.exact(
        git_text(FRONTEND, "rev-parse", f"{FRONTEND_BASE}^{{tree}}"),
        FRONTEND_BASE_TREE,
        "frontend predecessor tree drift",
    )
    for pin in PREDECESSOR_PINS:
        v.exact(
            git_artifact_pin(FRONTEND, FRONTEND_BASE, pin["path"]),
            pin,
            f"frontend predecessor artifact pin drift: {pin['path']}",
        )


def validate_authority(v: Verifier, authority_bytes: bytes) -> dict[str, Any]:
    authority = load_json_bytes(authority_bytes, AUTHORITY_REL)
    check_closed_keys(
        v,
        authority,
        {
            "schema",
            "state",
            "lane",
            "predecessorCarrier",
            "sharedLaneEvidence",
            "centralIntegrationBoundary",
            "historicalBackendDescendantGovernance",
            "authority",
        },
        "central-integration authority",
    )
    v.exact(
        {key: authority.get(key) for key in ("schema", "state", "lane")},
        {
            "schema": "dwp.hris.wave7.hrm013-shared-contract-central-integration-authority.v1",
            "state": "INDEPENDENTLY_REVIEWED_HASH_BOUND_SHARED_CONTRACT_FAST_FORWARD_INTEGRATION_AUTHORITY",
            "lane": "SHARED_CONTRACT_CENTRAL_INTEGRATION",
        },
        "central-integration authority identity drift",
    )
    predecessor = authority.get("predecessorCarrier")
    check_closed_keys(
        v,
        predecessor,
        {"repository", "branch", "commit", "tree", "artifactPins"},
        "authority predecessorCarrier",
    )
    v.exact(
        predecessor,
        {
            "repository": "dwp-frontend",
            "branch": "dwp-dev",
            "commit": FRONTEND_BASE,
            "tree": FRONTEND_BASE_TREE,
            "artifactPins": PREDECESSOR_PINS,
        },
        "authority predecessor carrier drift",
    )
    shared = authority.get("sharedLaneEvidence")
    check_closed_keys(
        v,
        shared,
        {
            "repository",
            "branch",
            "baseCommit",
            "baseTree",
            "laneCommit",
            "laneTree",
            "changedPaths",
            "targetedVerificationReceiptSha256",
            "postImplementationReviewReceiptSha256",
        },
        "authority sharedLaneEvidence",
    )
    v.exact(
        shared,
        {
            "repository": "dwp-backend",
            "branch": LANE_BRANCH,
            "baseCommit": BACKEND_BASE,
            "baseTree": BACKEND_BASE_TREE,
            "laneCommit": LANE_COMMIT,
            "laneTree": LANE_TREE,
            "changedPaths": AUTHORIZED_BACKEND_PATHS,
            "targetedVerificationReceiptSha256": TARGETED_RECEIPT_SHA256,
            "postImplementationReviewReceiptSha256": POST_REVIEW_RECEIPT_SHA256,
        },
        "authority shared-lane evidence drift",
    )
    boundary = authority.get("centralIntegrationBoundary")
    check_closed_keys(
        v,
        boundary,
        {
            "receiptPath",
            "receiptSchema",
            "receiptState",
            "requiredDecision",
            "integrationMode",
            "externalAttestationRequired",
            "directDwpDevMergeAuthorizedBeforeExternalAttestation",
        },
        "authority centralIntegrationBoundary",
    )
    v.exact(
        boundary,
        {
            "receiptPath": str(CENTRAL_RECEIPT_PATH),
            "receiptSchema": "dwp.hris.wave7.hrm013-shared-contract-central-integration-authority-receipt.v1",
            "receiptState": "HASH_BOUND_ZERO_FINDING_SHARED_CONTRACT_FAST_FORWARD_INTEGRATION_AUTHORITY",
            "requiredDecision": "GO_FOR_SHARED_CONTRACT_FAST_FORWARD_DWP_DEV_INTEGRATION_ONLY",
            "integrationMode": "DIRECT_FAST_FORWARD_ONLY",
            "externalAttestationRequired": True,
            "directDwpDevMergeAuthorizedBeforeExternalAttestation": False,
        },
        "authority central-integration boundary drift",
    )
    historical = authority.get("historicalBackendDescendantGovernance")
    check_closed_keys(
        v,
        historical,
        {
            "assumesAllHistoricalBackendDescendantGovernance",
            "governingValidatorPath",
            "predecessorValidatorPath",
            "oneReviewedReceiptPerBackendDescendantRequired",
            "oneOrderedFrontendGovernanceCarrierPerBackendDescendantRequired",
            "sharedElevenBlobMutationAuthorized",
        },
        "authority historicalBackendDescendantGovernance",
    )
    v.exact(
        historical,
        {
            "assumesAllHistoricalBackendDescendantGovernance": True,
            "governingValidatorPath": VALIDATOR_REL,
            "predecessorValidatorPath": PREDECESSOR_VALIDATOR_REL,
            "oneReviewedReceiptPerBackendDescendantRequired": True,
            "oneOrderedFrontendGovernanceCarrierPerBackendDescendantRequired": True,
            "sharedElevenBlobMutationAuthorized": False,
        },
        "authority historical descendant governance drift",
    )
    v.exact(authority.get("authority"), AUTHORITY_MAP, "authority map drift")
    check_closed_keys(v, authority.get("authority"), set(AUTHORITY_MAP), "authority map")
    return authority


def validate_review(
    v: Verifier,
    review_bytes: bytes,
    artifact_blobs: dict[str, bytes],
    *,
    carrier_committed_at: datetime | None,
) -> datetime:
    review = load_json_bytes(review_bytes, REVIEW_REL)
    check_closed_keys(
        v,
        review,
        {
            "schema",
            "reviewedAt",
            "reviewer",
            "scope",
            "findings",
            "finalVerdict",
            "authority",
            "artifactPins",
        },
        "central-integration independent review",
    )
    v.exact(
        {key: review.get(key) for key in ("schema", "reviewer")},
        {
            "schema": "dwp.hris.wave7.hrm013-shared-contract-central-integration-authority-independent-review.v1",
            "reviewer": "INDEPENDENT_HRM013_SHARED_CONTRACT_CENTRAL_INTEGRATION_REVIEW",
        },
        "central-integration review identity drift",
    )
    reviewed_at = parse_rfc3339_seconds(review.get("reviewedAt"), "review reviewedAt")
    require_not_future(v, reviewed_at, "review reviewedAt")
    if carrier_committed_at is not None:
        require_causal_order(
            v,
            [("review reviewedAt", reviewed_at), ("carrier committedAt", carrier_committed_at)],
        )
    scope = review.get("scope")
    check_closed_keys(
        v,
        scope,
        {"authorityPath", "validatorPath", "packagePath", "reviewedBoundaries"},
        "central-integration review scope",
    )
    v.exact(
        scope,
        {
            "authorityPath": AUTHORITY_REL,
            "validatorPath": VALIDATOR_REL,
            "packagePath": "package.json",
            "reviewedBoundaries": [
                "CURRENT_RUNTIME_CONTRACT_AUTHORITY_AND_VALIDATOR_PINS",
                "EXACT_SHARED_LANE_COMMIT_TREE_AND_ELEVEN_PATHS",
                "TARGETED_AND_POST_IMPLEMENTATION_RECEIPT_PINS",
                "EXTERNAL_CENTRAL_INTEGRATION_ATTESTATION_REQUIRED",
                "SIXTH_VALIDATOR_HISTORICAL_DESCENDANT_GOVERNANCE_ASSUMPTION",
                "NO_SHARED_BLOB_MUTATION_RUNTIME_MIGRATION_AUTH_OR_PRODUCTION_AUTHORITY",
            ],
        },
        "central-integration review scope drift",
    )
    findings = review.get("findings")
    check_closed_keys(v, findings, {"p0", "p1", "p2", "notes"}, "review findings")
    v.exact(
        findings,
        {
            "p0": [],
            "p1": [],
            "p2": [],
            "notes": [
                "The later carrier pins the current runtime-contract authority and validator and authorizes only externally attested direct fast-forward integration.",
                "The immutable sixth validator assumes all historical backend descendant governance using one reviewed receipt and one ordered frontend governance carrier per descendant.",
                "No shared-contract blob mutation, auth generation, migration authoring, runtime implementation or production release is authorized.",
            ],
        },
        "central-integration review findings drift",
    )
    v.exact(
        review.get("finalVerdict"),
        {
            "p0": 0,
            "p1": 0,
            "p2": 0,
            "decision": "GO_FOR_SHARED_CONTRACT_FAST_FORWARD_DWP_DEV_INTEGRATION_ONLY",
        },
        "central-integration review verdict drift",
    )
    check_closed_keys(
        v,
        review.get("finalVerdict"),
        {"p0", "p1", "p2", "decision"},
        "review finalVerdict",
    )
    v.exact(review.get("authority"), REVIEW_AUTHORITY_MAP, "review authority map drift")
    check_closed_keys(v, review.get("authority"), set(REVIEW_AUTHORITY_MAP), "review authority")
    expected_pins = [
        artifact_pin(path, artifact_blobs[path])
        for path in (AUTHORITY_REL, VALIDATOR_REL, "package.json")
    ]
    v.exact(review.get("artifactPins"), expected_pins, "review artifact pins drift")
    if isinstance(review.get("artifactPins"), list):
        for index, pin in enumerate(review["artifactPins"]):
            check_closed_keys(v, pin, {"path", "bytes", "sha256"}, f"review pin {index}")
    return reviewed_at


def validate_lane_commit(v: Verifier) -> list[dict[str, Any]]:
    v.exact(
        git_text(BACKEND, "rev-parse", f"{BACKEND_BASE}^{{tree}}"),
        BACKEND_BASE_TREE,
        "backend base tree drift",
    )
    v.exact(
        git_text(BACKEND, "rev-parse", f"{LANE_COMMIT}^{{tree}}"),
        LANE_TREE,
        "shared lane tree drift",
    )
    parents = git_text(BACKEND, "rev-list", "--parents", "-n", "1", LANE_COMMIT).split()
    v.exact(
        parents,
        [LANE_COMMIT, BACKEND_BASE],
        "shared lane commit is not the exact non-merge direct child of base",
    )
    v.exact(
        branch_diff_paths(BACKEND, BACKEND_BASE, LANE_COMMIT),
        set(AUTHORIZED_BACKEND_PATHS),
        "shared lane changed-path set drift",
    )
    remote = git(
        BACKEND,
        "rev-parse",
        "--verify",
        f"refs/remotes/origin/{LANE_BRANCH}",
        check=False,
    )
    v.require(
        remote.returncode == 0
        and remote.stdout.decode("utf-8", errors="strict").strip() == LANE_COMMIT,
        "remote shared lane does not equal the pinned lane commit",
    )
    pins: list[dict[str, Any]] = []
    for path in AUTHORIZED_BACKEND_PATHS:
        v.require(
            git_tree_mode(BACKEND, LANE_COMMIT, path) == "100644",
            f"shared lane path mode drift: {path}",
        )
        blob = git_blob(BACKEND, LANE_COMMIT, path)
        v.require(blob is not None, f"shared lane blob is missing: {path}")
        if blob is not None:
            pins.append(artifact_pin(path, blob))
    return pins


def validate_lane_receipts(v: Verifier) -> tuple[bytes, bytes, datetime, datetime]:
    targeted_bytes, _ = safe_read_receipt(TARGETED_RECEIPT_PATH, "targeted verification receipt")
    post_bytes, _ = safe_read_receipt(POST_REVIEW_RECEIPT_PATH, "post-implementation review receipt")
    v.exact(sha256_bytes(targeted_bytes), TARGETED_RECEIPT_SHA256, "targeted receipt hash drift")
    v.exact(sha256_bytes(post_bytes), POST_REVIEW_RECEIPT_SHA256, "post-review receipt hash drift")
    targeted = load_json_bytes(targeted_bytes, "targeted verification receipt")
    check_closed_keys(
        v,
        targeted,
        {
            "schema", "state", "authorityCarrierCommit", "authorityCarrierTree",
            "authorityArtifact", "cleanWorktreeReceiptSha256", "repository", "branch",
            "baseCommit", "baseTree", "testedCommit", "testedTree", "changedPaths",
            "gradleSubprocessEnvironment", "gradleUserHomePath",
            "gradleUserHomeInitialNulBytes", "gradleUserHomeInitialNulSha256",
            "gradleUserHomeFinalInventorySha256", "compileExecutable", "compileArgv",
            "compileExitCode", "testExecutable", "testArgv", "testExitCode",
            "securityCriteria", "verifiedAt", "verifiedBy",
        },
        "targeted verification receipt",
    )
    v.exact(
        {key: targeted.get(key) for key in (
            "schema", "state", "authorityCarrierCommit", "authorityCarrierTree",
            "authorityArtifact", "repository", "branch", "baseCommit", "baseTree",
            "testedCommit", "testedTree", "changedPaths", "compileExecutable",
            "compileArgv", "compileExitCode", "testExecutable", "testArgv",
            "testExitCode", "verifiedBy",
        )},
        {
            "schema": "dwp.hris.wave7.hrm013-shared-contract-targeted-verification-receipt.v1",
            "state": "TRUSTED_RUNNER_EXACT_COMMITTED_TREE_TARGETED_COMPILE_AND_FIVE_TESTS_PASS",
            "authorityCarrierCommit": FRONTEND_BASE,
            "authorityCarrierTree": FRONTEND_BASE_TREE,
            "authorityArtifact": PREDECESSOR_PINS[0],
            "repository": "dwp-backend",
            "branch": LANE_BRANCH,
            "baseCommit": BACKEND_BASE,
            "baseTree": BACKEND_BASE_TREE,
            "testedCommit": LANE_COMMIT,
            "testedTree": LANE_TREE,
            "changedPaths": AUTHORIZED_BACKEND_PATHS,
            "compileExecutable": "./gradlew",
            "compileArgv": [":dwp-platform-contracts:compileJava", "--no-daemon"],
            "compileExitCode": 0,
            "testExecutable": "./gradlew",
            "testArgv": [
                ":dwp-platform-contracts:test", "--no-daemon",
                "--tests", "com.dwp.platform.contract.Hrm013SeparationBridgeV1Test",
                "--tests", "com.dwp.platform.contract.Hrm013WorkloadProofV1Test",
                "--tests", "com.dwp.platform.contract.HrisServiceGrantAuthorityV1Test",
                "--tests", "com.dwp.platform.contract.Hrm013RequesterIdentityAuthorityV1Test",
                "--tests", "com.dwp.platform.contract.Hrm013TaskDispatchV1Test",
            ],
            "testExitCode": 0,
            "verifiedBy": "TRUSTED_HRM013_SHARED_CONTRACT_TARGETED_VERIFICATION",
        },
        "targeted verification receipt evidence drift",
    )
    verified_at = parse_rfc3339_seconds(targeted.get("verifiedAt"), "targeted verifiedAt")
    require_not_future(v, verified_at, "targeted verifiedAt")

    post = load_json_bytes(post_bytes, "post-implementation review receipt")
    check_closed_keys(
        v,
        post,
        {
            "schema", "state", "authorityCarrierCommit", "authorityCarrierTree",
            "authorityArtifact", "cleanWorktreeReceiptSha256",
            "targetedVerificationReceiptSha256", "laneCommit", "laneTree",
            "p0", "p1", "p2", "decision", "reviewedAt", "reviewedBy",
        },
        "post-implementation review receipt",
    )
    v.exact(
        {key: post.get(key) for key in (
            "schema", "state", "authorityCarrierCommit", "authorityCarrierTree",
            "authorityArtifact", "targetedVerificationReceiptSha256", "laneCommit",
            "laneTree", "p0", "p1", "p2", "decision", "reviewedBy",
        )},
        {
            "schema": "dwp.hris.wave7.hrm013-shared-contract-post-implementation-review.v1",
            "state": "INDEPENDENTLY_REVIEWED_EXACT_TESTED_SHARED_CONTRACT_TREE_BRANCH_PUSH_ONLY",
            "authorityCarrierCommit": FRONTEND_BASE,
            "authorityCarrierTree": FRONTEND_BASE_TREE,
            "authorityArtifact": PREDECESSOR_PINS[0],
            "targetedVerificationReceiptSha256": TARGETED_RECEIPT_SHA256,
            "laneCommit": LANE_COMMIT,
            "laneTree": LANE_TREE,
            "p0": 0,
            "p1": 0,
            "p2": 0,
            "decision": "GO_FOR_SHARED_CONTRACT_LANE_BRANCH_PUSH_ONLY",
            "reviewedBy": "INDEPENDENT_HRM013_SHARED_CONTRACT_POST_IMPLEMENTATION_REVIEW",
        },
        "post-implementation review evidence drift",
    )
    reviewed_at = parse_rfc3339_seconds(post.get("reviewedAt"), "post-review reviewedAt")
    require_not_future(v, reviewed_at, "post-review reviewedAt")
    require_causal_order(
        v,
        [("targeted verifiedAt", verified_at), ("post-review reviewedAt", reviewed_at)],
    )
    return targeted_bytes, post_bytes, verified_at, reviewed_at


def validate_python_blob(v: Verifier, data: bytes, label: str) -> None:
    try:
        source = data.decode("utf-8")
        compile(source, label, "exec")
    except (UnicodeDecodeError, SyntaxError) as exc:
        raise VerificationError(f"{label} is not valid UTF-8 Python: {exc}") from exc
    forbidden = (
        "atomic_" + "emit_json",
        "issue_" + "central",
        "." + "write_text(",
        "." + "write_bytes(",
    )
    v.require(
        not any(token in source for token in forbidden),
        f"{label} contains a receipt-emission primitive",
    )


def validate_authoring_carrier(v: Verifier) -> dict[str, Any]:
    branch = git_text(FRONTEND, "branch", "--show-current")
    head = git_text(FRONTEND, "rev-parse", "HEAD")
    origin = git_text(FRONTEND, "rev-parse", "origin/dwp-dev")
    v.exact(branch, "dwp-dev", "frontend authoring must use dwp-dev")
    v.exact(head, FRONTEND_BASE, "frontend authoring base drift")
    v.exact(origin, FRONTEND_BASE, "frontend origin/dwp-dev authoring base drift")
    v.exact(
        working_changes(FRONTEND),
        CARRIER_PATHS,
        "authoring carrier changed-path set drift",
    )
    blobs: dict[str, bytes] = {}
    for path in (AUTHORITY_REL, VALIDATOR_REL, REVIEW_REL, "package.json"):
        v.require(
            symlink_free_path(FRONTEND, path),
            f"authoring artifact is missing or symlinked: {path}",
        )
        v.require((FRONTEND / path).is_file(), f"authoring artifact is not regular: {path}")
        blobs[path] = (FRONTEND / path).read_bytes()
    validate_successor_package(v, blobs["package.json"], "authoring package.json")
    validate_python_blob(v, blobs[VALIDATOR_REL], "authoring integration validator")
    validate_authority(v, blobs[AUTHORITY_REL])
    validate_review(v, blobs[REVIEW_REL], blobs, carrier_committed_at=None)
    v.require(
        not receipt_exists(CENTRAL_RECEIPT_PATH),
        "external central receipt exists before the carrier commit and push",
    )
    return {
        "mode": "authoring",
        "commit": None,
        "tree": None,
        "blobs": blobs,
        "head": head,
    }


def discover_carrier(v: Verifier) -> dict[str, Any]:
    branch = git_text(FRONTEND, "branch", "--show-current")
    head = git_text(FRONTEND, "rev-parse", "HEAD")
    origin = git_text(FRONTEND, "rev-parse", "origin/dwp-dev")
    v.exact(branch, "dwp-dev", "frontend must use dwp-dev")
    v.exact(head, origin, "frontend HEAD must equal origin/dwp-dev")
    v.require(not working_changes(FRONTEND), "frontend worktree must be clean")
    commits: list[str] = []
    for path in (AUTHORITY_REL, VALIDATOR_REL, REVIEW_REL):
        additions = [
            line
            for line in git_text(
                FRONTEND, "log", "--diff-filter=A", "--format=%H", "--", path
            ).splitlines()
            if line
        ]
        v.require(len(additions) == 1, f"carrier add commit missing or ambiguous: {path}")
        commits.extend(additions)
    v.require(
        len(set(commits)) == 1,
        "authority, validator and review were not introduced together",
    )
    carrier = commits[0] if commits else ""
    parents = git_text(FRONTEND, "rev-list", "--parents", "-n", "1", carrier).split()
    v.exact(
        parents,
        [carrier, FRONTEND_BASE],
        "central-integration carrier is not the non-merge direct child of predecessor",
    )
    v.exact(
        branch_diff_paths(FRONTEND, FRONTEND_BASE, carrier),
        CARRIER_PATHS,
        "central-integration carrier path set drift",
    )
    v.require(
        is_ancestor(FRONTEND, carrier, head) and is_ancestor(FRONTEND, carrier, origin),
        "central-integration carrier is not pushed on dwp-dev",
    )
    tree = git_text(FRONTEND, "rev-parse", f"{carrier}^{{tree}}")
    committed_at = parse_rfc3339_seconds(
        git_text(FRONTEND, "show", "-s", "--format=%cI", carrier),
        "central-integration carrier committedAt",
    )
    blobs: dict[str, bytes] = {}
    for path in (AUTHORITY_REL, VALIDATOR_REL, REVIEW_REL, "package.json"):
        v.require(
            git_tree_mode(FRONTEND, carrier, path) == "100644",
            f"unsafe central-integration carrier mode: {path}",
        )
        blob = git_blob(FRONTEND, carrier, path)
        v.require(blob is not None, f"central-integration carrier blob missing: {path}")
        blobs[path] = blob or b""
    for path in (AUTHORITY_REL, VALIDATOR_REL, REVIEW_REL):
        v.require(
            symlink_free_path(FRONTEND, path),
            f"central-integration artifact is missing or symlinked: {path}",
        )
        v.require(
            digest_file(FRONTEND / path) == digest_bytes(blobs[path]),
            f"immutable central-integration artifact drift: {path}",
        )
        v.require(
            git_tree_mode(FRONTEND, head, path) == "100644",
            f"current central-integration artifact mode drift: {path}",
        )
    validate_successor_package(v, blobs["package.json"], "carrier package.json")
    validate_current_package(v, head)
    validate_python_blob(v, blobs[VALIDATOR_REL], "carrier integration validator")
    validate_authority(v, blobs[AUTHORITY_REL])
    validate_review(v, blobs[REVIEW_REL], blobs, carrier_committed_at=committed_at)
    return {
        "mode": "historical",
        "commit": carrier,
        "tree": tree,
        "committed_at": committed_at,
        "blobs": blobs,
        "head": head,
        "origin": origin,
    }


def validate_central_receipt(
    v: Verifier,
    carrier: dict[str, Any],
    targeted_bytes: bytes,
    post_bytes: bytes,
    post_reviewed_at: datetime,
) -> tuple[bytes, datetime]:
    receipt_bytes, _ = safe_read_receipt(
        CENTRAL_RECEIPT_PATH, "central integration authority receipt"
    )
    receipt = load_json_bytes(receipt_bytes, "central integration authority receipt")
    keys = {
        "schema", "state", "sharedExecutionCarrierCommit", "sharedExecutionCarrierTree",
        "sharedExecutionAuthorityArtifact", "centralIntegrationAuthorityCarrierCommit",
        "centralIntegrationAuthorityCarrierTree", "centralIntegrationAuthorityCarrierCommittedAt",
        "centralIntegrationAuthorityCarrierPushObservedAt", "centralIntegrationAuthorityArtifact",
        "centralIntegrationValidatorArtifact", "centralIntegrationIndependentReviewArtifact",
        "centralIntegrationPackageArtifact", "backendBaseCommit", "backendBaseTree",
        "laneCommit", "laneTree", "changedPaths", "targetedVerificationReceiptSha256",
        "postImplementationReviewReceiptSha256", "p0", "p1", "p2", "decision",
        "integrationMode", "authGenerationAuthorized", "migrationAuthoringAuthorized",
        "runtimeImplementationAuthorized", "recordedAt", "recordedBy",
    }
    check_closed_keys(v, receipt, keys, "central integration authority receipt")
    blobs = carrier["blobs"]
    expected = {
        "schema": "dwp.hris.wave7.hrm013-shared-contract-central-integration-authority-receipt.v1",
        "state": "HASH_BOUND_ZERO_FINDING_SHARED_CONTRACT_FAST_FORWARD_INTEGRATION_AUTHORITY",
        "sharedExecutionCarrierCommit": FRONTEND_BASE,
        "sharedExecutionCarrierTree": FRONTEND_BASE_TREE,
        "sharedExecutionAuthorityArtifact": PREDECESSOR_PINS[0],
        "centralIntegrationAuthorityCarrierCommit": carrier["commit"],
        "centralIntegrationAuthorityCarrierTree": carrier["tree"],
        "centralIntegrationAuthorityCarrierCommittedAt": git_text(
            FRONTEND, "show", "-s", "--format=%cI", carrier["commit"]
        ),
        "centralIntegrationAuthorityArtifact": artifact_pin(AUTHORITY_REL, blobs[AUTHORITY_REL]),
        "centralIntegrationValidatorArtifact": artifact_pin(VALIDATOR_REL, blobs[VALIDATOR_REL]),
        "centralIntegrationIndependentReviewArtifact": artifact_pin(REVIEW_REL, blobs[REVIEW_REL]),
        "centralIntegrationPackageArtifact": artifact_pin("package.json", blobs["package.json"]),
        "backendBaseCommit": BACKEND_BASE,
        "backendBaseTree": BACKEND_BASE_TREE,
        "laneCommit": LANE_COMMIT,
        "laneTree": LANE_TREE,
        "changedPaths": AUTHORIZED_BACKEND_PATHS,
        "targetedVerificationReceiptSha256": sha256_bytes(targeted_bytes),
        "postImplementationReviewReceiptSha256": sha256_bytes(post_bytes),
        "p0": 0,
        "p1": 0,
        "p2": 0,
        "decision": "GO_FOR_SHARED_CONTRACT_FAST_FORWARD_DWP_DEV_INTEGRATION_ONLY",
        "integrationMode": "DIRECT_FAST_FORWARD_ONLY",
        "authGenerationAuthorized": False,
        "migrationAuthoringAuthorized": False,
        "runtimeImplementationAuthorized": False,
        "recordedBy": "INDEPENDENT_HRM013_SHARED_CONTRACT_CENTRAL_INTEGRATION_REVIEW",
    }
    v.exact(
        {key: receipt.get(key) for key in expected},
        expected,
        "central integration authority receipt evidence drift",
    )
    for key in (
        "sharedExecutionAuthorityArtifact",
        "centralIntegrationAuthorityArtifact",
        "centralIntegrationValidatorArtifact",
        "centralIntegrationIndependentReviewArtifact",
        "centralIntegrationPackageArtifact",
    ):
        check_closed_keys(v, receipt.get(key), {"path", "bytes", "sha256"}, f"central receipt {key}")
    committed_at = parse_rfc3339_seconds(
        receipt.get("centralIntegrationAuthorityCarrierCommittedAt"),
        "central receipt carrier committedAt",
    )
    pushed_at = parse_rfc3339_seconds(
        receipt.get("centralIntegrationAuthorityCarrierPushObservedAt"),
        "central receipt carrier pushObservedAt",
    )
    recorded_at = parse_rfc3339_seconds(receipt.get("recordedAt"), "central receipt recordedAt")
    require_not_future(v, pushed_at, "central receipt carrier pushObservedAt")
    require_not_future(v, recorded_at, "central receipt recordedAt")
    require_causal_order(
        v,
        [
            ("post-review reviewedAt", post_reviewed_at),
            ("carrier committedAt", committed_at),
            ("carrier pushObservedAt", pushed_at),
            ("central receipt recordedAt", recorded_at),
        ],
    )
    return receipt_bytes, recorded_at


def governance_paths(descendant: str) -> tuple[str, str]:
    if re.fullmatch(r"[0-9a-f]{40}", descendant) is None:
        raise VerificationError(f"invalid backend descendant commit id: {descendant}")
    base = f"{GOVERNANCE_ROOT_REL}/{descendant}"
    return f"{base}/authority.v1.json", f"{base}/independent-review.v1.json"


def descendant_receipt_path(descendant: str) -> Path:
    if re.fullmatch(r"[0-9a-f]{40}", descendant) is None:
        raise VerificationError(f"invalid backend descendant commit id: {descendant}")
    return DESCENDANT_RECEIPT_ROOT / (
        f"{descendant}.hrm013-shared-contract-governance.v1.json"
    )


def validate_shared_blobs(
    v: Verifier,
    revision: str,
    lane_pins: list[dict[str, Any]],
    *,
    require_live: bool,
) -> None:
    for pin in lane_pins:
        path = pin["path"]
        v.require(
            git_tree_mode(BACKEND, revision, path) == "100644",
            f"shared path mode drift at {revision}: {path}",
        )
        blob = git_blob(BACKEND, revision, path)
        v.require(blob is not None, f"shared blob missing at {revision}: {path}")
        if blob is not None:
            v.exact(
                artifact_pin(path, blob),
                pin,
                f"shared blob mutated at {revision}: {path}",
            )
        if require_live:
            v.require(
                symlink_free_path(BACKEND, path)
                and (BACKEND / path).is_file()
                and not (BACKEND / path).is_symlink(),
                f"integrated shared path is not live regular and symlink-free: {path}",
            )


def validate_governance_authority_and_review(
    v: Verifier,
    *,
    descendant: str,
    descendant_tree: str,
    immediate_parent: str,
    changed_paths: list[str],
    authority_path: str,
    review_path: str,
    authority_blob: bytes,
    review_blob: bytes,
    governance_carrier: str,
    central_carrier: dict[str, Any],
    previous_receipt_path: Path,
    previous_receipt_bytes: bytes,
    lane_pins: list[dict[str, Any]],
) -> tuple[datetime, datetime]:
    authority = load_json_bytes(authority_blob, authority_path)
    check_closed_keys(
        v,
        authority,
        {
            "schema", "state", "backendDescendant", "predecessorGovernanceReceipt",
            "sharedElevenBlobPins", "governingValidatorArtifact", "authority",
        },
        f"descendant governance authority {descendant}",
    )
    v.exact(
        {key: authority.get(key) for key in ("schema", "state")},
        {
            "schema": "dwp.hris.wave7.hrm013-backend-descendant-governance-authority.v1",
            "state": "HASH_BOUND_REVIEWED_BACKEND_DESCENDANT_GOVERNANCE_SHARED_ELEVEN_BLOBS_IMMUTABLE",
        },
        f"descendant authority identity drift: {descendant}",
    )
    backend_descendant = authority.get("backendDescendant")
    check_closed_keys(
        v,
        backend_descendant,
        {
            "repository", "branch", "sharedIntegrationCommit", "sharedIntegrationTree",
            "immediateParentCommit", "commit", "tree", "changedPaths",
        },
        f"descendant authority backendDescendant {descendant}",
    )
    v.exact(
        backend_descendant,
        {
            "repository": "dwp-backend",
            "branch": "dwp-dev",
            "sharedIntegrationCommit": LANE_COMMIT,
            "sharedIntegrationTree": LANE_TREE,
            "immediateParentCommit": immediate_parent,
            "commit": descendant,
            "tree": descendant_tree,
            "changedPaths": changed_paths,
        },
        f"descendant authority backend evidence drift: {descendant}",
    )
    predecessor_pin = artifact_pin(str(previous_receipt_path), previous_receipt_bytes)
    v.exact(
        authority.get("predecessorGovernanceReceipt"),
        predecessor_pin,
        f"descendant authority predecessor receipt pin drift: {descendant}",
    )
    check_closed_keys(
        v,
        authority.get("predecessorGovernanceReceipt"),
        {"path", "bytes", "sha256"},
        f"descendant predecessor receipt pin {descendant}",
    )
    v.exact(
        authority.get("sharedElevenBlobPins"),
        lane_pins,
        f"descendant authority shared-blob pins drift: {descendant}",
    )
    validator_pin = artifact_pin(VALIDATOR_REL, central_carrier["blobs"][VALIDATOR_REL])
    v.exact(
        authority.get("governingValidatorArtifact"),
        validator_pin,
        f"descendant authority validator pin drift: {descendant}",
    )
    v.exact(
        authority.get("authority"),
        GOVERNANCE_AUTHORITY_MAP,
        f"descendant authority map drift: {descendant}",
    )
    check_closed_keys(
        v,
        authority.get("authority"),
        set(GOVERNANCE_AUTHORITY_MAP),
        f"descendant authority map {descendant}",
    )

    review = load_json_bytes(review_blob, review_path)
    check_closed_keys(
        v,
        review,
        {
            "schema", "reviewedAt", "reviewer", "scope", "findings",
            "finalVerdict", "authority", "artifactPins",
        },
        f"descendant governance review {descendant}",
    )
    v.exact(
        {key: review.get(key) for key in ("schema", "reviewer")},
        {
            "schema": "dwp.hris.wave7.hrm013-backend-descendant-governance-independent-review.v1",
            "reviewer": "INDEPENDENT_HRM013_BACKEND_DESCENDANT_GOVERNANCE_REVIEW",
        },
        f"descendant review identity drift: {descendant}",
    )
    scope = review.get("scope")
    check_closed_keys(
        v,
        scope,
        {"authorityPath", "validatorPath", "packagePath", "backendDescendantCommit", "reviewedBoundaries"},
        f"descendant review scope {descendant}",
    )
    v.exact(
        scope,
        {
            "authorityPath": authority_path,
            "validatorPath": VALIDATOR_REL,
            "packagePath": "package.json",
            "backendDescendantCommit": descendant,
            "reviewedBoundaries": [
                "EXACT_LINEAR_BACKEND_DESCENDANT_AND_IMMEDIATE_PARENT",
                "SHARED_ELEVEN_BLOBS_BYTE_IDENTICAL_TO_INTEGRATION_COMMIT",
                "PREVIOUS_GOVERNANCE_RECEIPT_HASH_CHAIN",
                "ORDERED_TWO_PATH_FRONTEND_GOVERNANCE_CARRIER",
                "NO_SHARED_BLOB_MUTATION_RUNTIME_OR_PRODUCTION_AUTHORITY",
            ],
        },
        f"descendant review scope drift: {descendant}",
    )
    findings = review.get("findings")
    check_closed_keys(v, findings, {"p0", "p1", "p2"}, f"descendant findings {descendant}")
    v.exact(findings, {"p0": [], "p1": [], "p2": []}, f"descendant findings drift: {descendant}")
    v.exact(
        review.get("finalVerdict"),
        {"p0": 0, "p1": 0, "p2": 0, "decision": "GO_FOR_EXACT_BACKEND_DESCENDANT_GOVERNANCE_ONLY"},
        f"descendant review verdict drift: {descendant}",
    )
    v.exact(
        review.get("authority"),
        GOVERNANCE_REVIEW_AUTHORITY_MAP,
        f"descendant review authority drift: {descendant}",
    )
    package_blob = git_blob(FRONTEND, governance_carrier, "package.json") or b""
    expected_review_pins = [
        artifact_pin(authority_path, authority_blob),
        validator_pin,
        artifact_pin("package.json", package_blob),
    ]
    v.exact(
        review.get("artifactPins"),
        expected_review_pins,
        f"descendant review artifact pins drift: {descendant}",
    )
    reviewed_at = parse_rfc3339_seconds(
        review.get("reviewedAt"), f"descendant review reviewedAt {descendant}"
    )
    require_not_future(v, reviewed_at, f"descendant review reviewedAt {descendant}")
    carrier_at = parse_rfc3339_seconds(
        git_text(FRONTEND, "show", "-s", "--format=%cI", governance_carrier),
        f"descendant governance carrier committedAt {descendant}",
    )
    require_not_future(
        v,
        carrier_at,
        f"descendant governance carrier committedAt {descendant}",
    )
    require_causal_order(
        v,
        [("descendant review reviewedAt", reviewed_at), ("governance carrier committedAt", carrier_at)],
    )
    return reviewed_at, carrier_at


def discover_governance_carrier(
    v: Verifier,
    *,
    descendant: str,
    previous_frontend_carrier: str,
    central_carrier: dict[str, Any],
    immediate_parent: str,
    descendant_tree: str,
    changed_paths: list[str],
    previous_receipt_path: Path,
    previous_receipt_bytes: bytes,
    lane_pins: list[dict[str, Any]],
) -> tuple[str, datetime, datetime, bytes, bytes]:
    authority_path, review_path = governance_paths(descendant)
    commits: list[str] = []
    for path in (authority_path, review_path):
        v.require(
            symlink_free_path(FRONTEND, path),
            f"descendant governance artifact missing or symlinked: {path}",
        )
        additions = [
            line
            for line in git_text(
                FRONTEND, "log", "--diff-filter=A", "--format=%H", "--", path
            ).splitlines()
            if line
        ]
        v.require(len(additions) == 1, f"descendant governance add commit ambiguous: {path}")
        commits.extend(additions)
    v.require(
        len(set(commits)) == 1,
        f"descendant governance authority/review not introduced together: {descendant}",
    )
    carrier = commits[0] if commits else ""
    parents = git_text(FRONTEND, "rev-list", "--parents", "-n", "1", carrier).split()
    v.exact(
        parents,
        [carrier, previous_frontend_carrier],
        f"descendant governance carrier is not ordered direct child: {descendant}",
    )
    v.exact(
        branch_diff_paths(FRONTEND, previous_frontend_carrier, carrier),
        {authority_path, review_path},
        f"descendant governance carrier path set drift: {descendant}",
    )
    v.require(
        is_ancestor(FRONTEND, carrier, central_carrier["head"])
        and is_ancestor(FRONTEND, carrier, central_carrier["origin"]),
        f"descendant governance carrier is not pushed: {descendant}",
    )
    governance_blobs = {
        authority_path: git_blob(FRONTEND, carrier, authority_path) or b"",
        review_path: git_blob(FRONTEND, carrier, review_path) or b"",
    }
    for path in (authority_path, review_path):
        v.require(
            git_tree_mode(FRONTEND, carrier, path) == "100644",
            f"descendant governance artifact mode drift: {path}",
        )
        v.require(
            git_tree_mode(FRONTEND, central_carrier["head"], path) == "100644",
            f"current descendant governance artifact mode drift: {path}",
        )
        v.exact(
            git_blob_digest(FRONTEND, central_carrier["head"], path),
            digest_bytes(governance_blobs[path]),
            f"descendant governance artifact mutated after introduction: {path}",
        )
    for path in (VALIDATOR_REL, "package.json"):
        v.require(
            git_blob_digest(FRONTEND, carrier, path)
            == digest_bytes(central_carrier["blobs"][path]),
            f"immutable governing artifact drift at descendant carrier: {path}",
        )
    authority_blob = governance_blobs[authority_path]
    review_blob = governance_blobs[review_path]
    reviewed_at, carrier_at = validate_governance_authority_and_review(
        v,
        descendant=descendant,
        descendant_tree=descendant_tree,
        immediate_parent=immediate_parent,
        changed_paths=changed_paths,
        authority_path=authority_path,
        review_path=review_path,
        authority_blob=authority_blob,
        review_blob=review_blob,
        governance_carrier=carrier,
        central_carrier=central_carrier,
        previous_receipt_path=previous_receipt_path,
        previous_receipt_bytes=previous_receipt_bytes,
        lane_pins=lane_pins,
    )
    return carrier, reviewed_at, carrier_at, authority_blob, review_blob


def validate_descendant_governance(
    v: Verifier,
    *,
    backend_head: str,
    central_carrier: dict[str, Any],
    central_receipt_bytes: bytes,
    central_recorded_at: datetime,
    lane_pins: list[dict[str, Any]],
) -> int:
    descendants = [
        line
        for line in git_text(
            BACKEND, "rev-list", "--reverse", f"{LANE_COMMIT}..{backend_head}"
        ).splitlines()
        if line
    ]
    v.require(descendants, "backend descendant governance called without descendants")
    expected_receipt_names = {
        descendant_receipt_path(commit).name for commit in descendants
    }
    v.require(
        receipt_exists(DESCENDANT_RECEIPT_ROOT),
        "backend descendants exist without the receipt directory",
    )
    v.exact(
        safe_directory_names(DESCENDANT_RECEIPT_ROOT, "descendant receipt directory"),
        expected_receipt_names,
        "descendant receipt set contains a gap, fork, duplicate, or stale receipt",
    )
    governance_root = FRONTEND / GOVERNANCE_ROOT_REL
    v.require(
        governance_root.exists() or governance_root.is_symlink(),
        "backend descendants exist without frontend governance carriers",
    )
    v.exact(
        safe_directory_names(governance_root, "frontend descendant governance root"),
        set(descendants),
        "frontend descendant governance carrier directory set drift",
    )

    previous_backend = LANE_COMMIT
    previous_frontend = central_carrier["commit"]
    previous_receipt_path = CENTRAL_RECEIPT_PATH
    previous_receipt_bytes = central_receipt_bytes
    previous_recorded_at = central_recorded_at
    for descendant in descendants:
        parents = git_text(BACKEND, "rev-list", "--parents", "-n", "1", descendant).split()
        v.exact(
            parents,
            [descendant, previous_backend],
            f"backend descendant chain is not linear and non-merge: {descendant}",
        )
        descendant_tree = git_text(BACKEND, "rev-parse", f"{descendant}^{{tree}}")
        changed_paths = sorted(branch_diff_paths(BACKEND, previous_backend, descendant))
        validate_shared_blobs(v, descendant, lane_pins, require_live=False)
        authority_path, review_path = governance_paths(descendant)
        v.exact(
            safe_directory_names(
                FRONTEND / PurePosixPath(authority_path).parent,
                f"frontend governance directory {descendant}",
            ),
            {"authority.v1.json", "independent-review.v1.json"},
            f"frontend governance directory path set drift: {descendant}",
        )
        (
            governance_carrier,
            reviewed_at,
            governance_carrier_at,
            authority_blob,
            review_blob,
        ) = discover_governance_carrier(
            v,
            descendant=descendant,
            previous_frontend_carrier=previous_frontend,
            central_carrier=central_carrier,
            immediate_parent=previous_backend,
            descendant_tree=descendant_tree,
            changed_paths=changed_paths,
            previous_receipt_path=previous_receipt_path,
            previous_receipt_bytes=previous_receipt_bytes,
            lane_pins=lane_pins,
        )
        receipt_path = descendant_receipt_path(descendant)
        receipt_bytes, _ = safe_read_receipt(
            receipt_path, f"backend descendant governance receipt {descendant}"
        )
        receipt = load_json_bytes(
            receipt_bytes, f"backend descendant governance receipt {descendant}"
        )
        check_closed_keys(
            v,
            receipt,
            {
                "schema", "state", "sharedIntegrationCommit", "sharedIntegrationTree",
                "immediateParentCommit", "descendantCommit", "descendantTree",
                "descendantChangedPaths", "sharedElevenBlobPins",
                "governingFrontendCarrierCommit", "governingFrontendCarrierTree",
                "governingAuthorityArtifact", "governingValidatorArtifact",
                "governingIndependentReviewArtifact", "governingPackageArtifact",
                "previousGovernanceReceiptSha256", "p0", "p1", "p2", "decision",
                "recordedAt", "recordedBy",
            },
            f"backend descendant governance receipt {descendant}",
        )
        package_blob = git_blob(FRONTEND, governance_carrier, "package.json") or b""
        expected = {
            "schema": "dwp.hris.wave7.hrm013-shared-contract-backend-descendant-governance-receipt.v1",
            "state": "REVIEWED_ORDERED_BACKEND_DESCENDANT_GOVERNANCE_SHARED_ELEVEN_BLOBS_IMMUTABLE",
            "sharedIntegrationCommit": LANE_COMMIT,
            "sharedIntegrationTree": LANE_TREE,
            "immediateParentCommit": previous_backend,
            "descendantCommit": descendant,
            "descendantTree": descendant_tree,
            "descendantChangedPaths": changed_paths,
            "sharedElevenBlobPins": lane_pins,
            "governingFrontendCarrierCommit": governance_carrier,
            "governingFrontendCarrierTree": git_text(FRONTEND, "rev-parse", f"{governance_carrier}^{{tree}}"),
            "governingAuthorityArtifact": artifact_pin(authority_path, authority_blob),
            "governingValidatorArtifact": artifact_pin(VALIDATOR_REL, central_carrier["blobs"][VALIDATOR_REL]),
            "governingIndependentReviewArtifact": artifact_pin(review_path, review_blob),
            "governingPackageArtifact": artifact_pin("package.json", package_blob),
            "previousGovernanceReceiptSha256": sha256_bytes(previous_receipt_bytes),
            "p0": 0,
            "p1": 0,
            "p2": 0,
            "decision": "GO_FOR_EXACT_BACKEND_DESCENDANT_GOVERNANCE_ONLY",
            "recordedBy": "INDEPENDENT_HRM013_BACKEND_DESCENDANT_GOVERNANCE_REVIEW",
        }
        v.exact(
            {key: receipt.get(key) for key in expected},
            expected,
            f"backend descendant governance receipt evidence drift: {descendant}",
        )
        recorded_at = parse_rfc3339_seconds(
            receipt.get("recordedAt"), f"descendant receipt recordedAt {descendant}"
        )
        require_not_future(v, recorded_at, f"descendant receipt recordedAt {descendant}")
        backend_committed_at = parse_rfc3339_seconds(
            git_text(BACKEND, "show", "-s", "--format=%cI", descendant),
            f"backend descendant committedAt {descendant}",
        )
        require_causal_order(
            v,
            [
                ("previous governance receipt recordedAt", previous_recorded_at),
                ("backend descendant committedAt", backend_committed_at),
                ("descendant review reviewedAt", reviewed_at),
                ("descendant governance carrier committedAt", governance_carrier_at),
                ("descendant governance receipt recordedAt", recorded_at),
            ],
        )
        previous_backend = descendant
        previous_frontend = governance_carrier
        previous_receipt_path = receipt_path
        previous_receipt_bytes = receipt_bytes
        previous_recorded_at = recorded_at
    return len(descendants)


def validate_backend_state(
    v: Verifier,
    *,
    authoring: bool,
    carrier: dict[str, Any] | None,
    targeted_bytes: bytes,
    post_bytes: bytes,
    post_reviewed_at: datetime,
    lane_pins: list[dict[str, Any]],
) -> tuple[str, int]:
    branch = git_text(BACKEND, "branch", "--show-current")
    head = git_text(BACKEND, "rev-parse", "HEAD")
    origin = git_text(BACKEND, "rev-parse", "origin/dwp-dev")
    v.exact(branch, "dwp-dev", "backend default checkout must use dwp-dev")
    v.exact(head, origin, "backend HEAD must equal origin/dwp-dev")
    v.require(not working_changes(BACKEND), "backend default checkout must remain clean")
    if authoring:
        v.exact(head, BACKEND_BASE, "carrier authoring requires the untouched backend base")
        v.require(
            not receipt_exists(CENTRAL_RECEIPT_PATH),
            "central receipt exists before carrier commit and push",
        )
        return "CARRIER_AUTHORING_EXTERNAL_ATTESTATION_NOT_YET_ALLOWED", 0

    if carrier is None:
        raise VerificationError("historical validation requires the carrier context")
    has_central_receipt = receipt_exists(CENTRAL_RECEIPT_PATH)
    if not has_central_receipt:
        v.exact(
            head,
            BACKEND_BASE,
            "backend dwp-dev moved before the external central receipt",
        )
        return "CARRIER_PUSHED_EXTERNAL_ATTESTATION_REQUIRED", 0

    central_bytes, central_recorded_at = validate_central_receipt(
        v, carrier, targeted_bytes, post_bytes, post_reviewed_at
    )
    if head == BACKEND_BASE:
        return "CENTRAL_FAST_FORWARD_AUTHORITY_READY", 0
    v.require(
        is_ancestor(BACKEND, LANE_COMMIT, head),
        "backend dwp-dev is not a descendant of the exact shared lane commit",
    )
    validate_shared_blobs(v, head, lane_pins, require_live=True)
    if head == LANE_COMMIT:
        return "SHARED_CONTRACT_DIRECT_FAST_FORWARD_INTEGRATED", 0
    descendants = validate_descendant_governance(
        v,
        backend_head=head,
        central_carrier=carrier,
        central_receipt_bytes=central_bytes,
        central_recorded_at=central_recorded_at,
        lane_pins=lane_pins,
    )
    return "SHARED_CONTRACT_INTEGRATED_WITH_ORDERED_DESCENDANT_GOVERNANCE", descendants


def run_internal_negative_tests(v: Verifier) -> None:
    for left, right in ((True, 1), (False, 0), (1, 1.0), (0, False)):
        v.require(
            not strict_typed_equal(left, right),
            f"strict JSON type negative fixture accepted: {left!r}/{right!r}",
        )
    for fixture in (
        b'{"x":1,"x":2}',
        b'{"x":NaN}',
        b'{"x":Infinity}',
        b'{"x":-Infinity}',
    ):
        rejected = False
        try:
            load_json_bytes(fixture, "negative JSON fixture")
        except VerificationError:
            rejected = True
        v.require(rejected, f"invalid JSON negative fixture accepted: {fixture!r}")
    for timestamp in ("2026-02-30T00:00:00Z", "2026-10-27T00:00:00"):
        rejected = False
        try:
            parse_rfc3339_seconds(timestamp, "negative timestamp fixture")
        except VerificationError:
            rejected = True
        v.require(rejected, f"invalid timestamp negative fixture accepted: {timestamp}")
    earlier = datetime(2026, 10, 27, 1, 0, tzinfo=timezone.utc)
    later = datetime(2026, 10, 27, 1, 1, tzinfo=timezone.utc)
    rejected = False
    try:
        require_causal_order(Verifier(), [("later", later), ("earlier", earlier)])
    except VerificationError:
        rejected = True
    v.require(rejected, "causal inversion negative fixture accepted")
    for invalid in ("../escape", "/absolute", "a//b", "a/./b"):
        v.require(not canonical_relative_path(invalid), f"unsafe path accepted: {invalid}")
    rejected = False
    try:
        governance_paths("not-a-commit")
    except VerificationError:
        rejected = True
    v.require(rejected, "invalid governance commit id negative fixture accepted")
    extra_environment = dict(TRUSTED_RUNTIME_ENV)
    extra_environment["UNSEALED"] = "1"
    v.require(
        not strict_typed_equal(extra_environment, TRUSTED_RUNTIME_ENV),
        "extra trusted-environment key negative fixture accepted",
    )
    # A receipt-free run may only remain at the pinned base; integration without
    # external attestation is deliberately unrepresentable in the state machine.
    v.require(
        BACKEND_BASE != LANE_COMMIT,
        "pre-receipt/integrated negative state fixture collapsed",
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--authoring",
        action="store_true",
        help="validate the exact uncommitted four-path carrier",
    )
    parser.add_argument(
        "--require-trusted",
        action="store_true",
        help="require /usr/bin/python3 -I and the sealed env -i allowlist",
    )
    args = parser.parse_args()
    v = Verifier()
    try:
        isolated = check_runtime_environment(
            v, require_trusted=(args.require_trusted or args.authoring)
        )
        run_internal_negative_tests(v)
        v.require(SCRIPT_FILE == SCRIPT_FILE.resolve(), "validator invocation path is symlinked")
        v.require(HERE == HERE.resolve(), "validator directory path is symlinked")
        check_git_hygiene(v, FRONTEND, FRONTEND)
        check_git_hygiene(v, BACKEND, BACKEND)
        validate_predecessor(v)
        lane_pins = validate_lane_commit(v)
        targeted_bytes, post_bytes, _, post_reviewed_at = validate_lane_receipts(v)
        if args.authoring:
            carrier = validate_authoring_carrier(v)
            state, descendants = validate_backend_state(
                v,
                authoring=True,
                carrier=None,
                targeted_bytes=targeted_bytes,
                post_bytes=post_bytes,
                post_reviewed_at=post_reviewed_at,
                lane_pins=lane_pins,
            )
        else:
            carrier = discover_carrier(v)
            state, descendants = validate_backend_state(
                v,
                authoring=False,
                carrier=carrier,
                targeted_bytes=targeted_bytes,
                post_bytes=post_bytes,
                post_reviewed_at=post_reviewed_at,
                lane_pins=lane_pins,
            )
        print(
            "PASS "
            f"state={state} checks={v.checks} descendants={descendants} "
            f"trusted_runtime={'true' if isolated else 'false'} "
            "receipt_issuance=external-only"
        )
        return 0
    except (VerificationError, OSError) as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
