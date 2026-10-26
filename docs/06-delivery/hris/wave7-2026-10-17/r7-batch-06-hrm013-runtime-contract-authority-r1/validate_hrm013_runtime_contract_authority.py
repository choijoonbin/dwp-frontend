#!/usr/bin/env python3
"""Fail-closed validator for the HRM-013 shared-contract execution authority.

The npm/yarn command that invokes this file is compatibility evidence only.  A
security-authoritative run uses ``/usr/bin/python3 -I`` so a local ``json.py``,
``sitecustomize.py`` or ``PYTHONPATH`` cannot execute before these checks.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import os
import re
import secrets
import stat
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from copy import deepcopy
from pathlib import Path, PurePosixPath
from typing import Any, Iterable


SCRIPT_FILE = Path(__file__).absolute()
HERE = SCRIPT_FILE.parent
FRONTEND = HERE.parents[4]
WORKSPACE = FRONTEND.parent
BACKEND = WORKSPACE / "dwp-backend"
AGENT = WORKSPACE / "dwp_agent"

GIT = "/usr/bin/git"
TRUSTED_PYTHON_EXECUTABLES = {
    Path("/usr/bin/python3").resolve(),
    # macOS' /usr/bin/python3 launcher reports the CLT interpreter here.
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
GRADLE_BASE_ENV = {
    "PATH": "/usr/bin:/bin",
    "HOME": "/var/empty",
    "LC_ALL": "C",
    "LANG": "C",
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
    "GIT_CONFIG_KEY_0",
    "GIT_CONFIG_VALUE_0",
    "GIT_CONFIG_PARAMETERS",
    "GIT_CONFIG_SYSTEM",
    "GIT_EXEC_PATH",
    "GIT_ATTR_NOSYSTEM",
    "GIT_OPTIONAL_LOCKS",
    "GIT_EXTERNAL_DIFF",
}
PREDECESSOR_COMMIT = "2d07c6a830d01b1702b08f44b372ec611bbc5d31"
PREDECESSOR_TREE = "3215d5fd107c01410b7555f2254719ba371c1aac"
BACKEND_BASE = "c50b267e7b015758ab6f7acc7fdf353eee81e631"
BACKEND_TREE = "22bd6533ab340cfb91c6cf5ab5fd6991e501e6c4"
AGENT_BASE = "9beb5439cad065e7d919a98c9f9becb44481508a"
SHARED_BRANCH = "codex/hris-wave7-batch06-hrm013-runtime-contract-backend-20261026-r1"
SHARED_WORKTREE = Path(
    "/Users/a10697/Work/DWP/.codex-worktrees/hris/wave7-20261026/"
    "batch06/hrm013-owner-runtime/shared"
)
RECEIPT_PATH = Path(
    "/Users/a10697/Work/DWP/.codex-worktrees/hris/wave7-20261026/"
    "batch06/hrm013-owner-runtime/receipts/shared-clean-worktree-receipt.v1.json"
)

AUTHORITY_REL = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-runtime-contract-authority-r1/"
    "hrm-013-runtime-contract-execution-authority.v1.json"
)
REVIEW_REL = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-runtime-contract-authority-r1/independent-review.v1.json"
)
VALIDATOR_REL = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-runtime-contract-authority-r1/"
    "validate_hrm013_runtime_contract_authority.py"
)
REGISTER_V3_REL = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-owner-runtime-execution-r1/"
    "service-api-auth-binding-register.successor.v3.csv"
)
REGISTER_V2_REL = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-callback-binding-r1/"
    "service-api-auth-binding-register.successor.v2.csv"
)
GATE_REL = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-owner-runtime-binding-gate-r1/"
    "hrm-013-owner-runtime-binding-gate.v1.json"
)
GATE_VALIDATOR_REL = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-owner-runtime-binding-gate-r1/"
    "validate_hrm013_owner_runtime_binding_gate.py"
)
GATE_REVIEW_REL = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-owner-runtime-binding-gate-r1/independent-review.v1.json"
)

PREDECESSOR_PINS = [
    {
        "path": GATE_REL,
        "bytes": 170804,
        "sha256": "aa88b6116f2fa8ca4e96d85204414a737e763afa4e1bb01372e31fdaa59deb47",
    },
    {
        "path": GATE_VALIDATOR_REL,
        "bytes": 105034,
        "sha256": "47387b5fa0f27be3e6e4944d0439678fc0b4f516ba0d97966bb958c2a9eb637b",
    },
    {
        "path": GATE_REVIEW_REL,
        "bytes": 8545,
        "sha256": "18487992c6f20f9fa66b7e12b06791a5e074e4bf7e816e9a37956d5822075410",
    },
    {
        "path": "package.json",
        "bytes": 14566,
        "sha256": "1bbf859f9f4078d678a2fea2eb9aaf2c64b331300e0653d30eafde60e16db38f",
    },
]

AUTHORIZED_SOURCE_PATHS = [
    "dwp-platform-contracts/src/main/java/com/dwp/platform/contracts/hris/separation/v1/Hrm013SeparationBridgeV1.java",
    "dwp-platform-contracts/src/main/java/com/dwp/platform/contracts/hris/separation/v1/Hrm013WorkloadProofV1.java",
    "dwp-platform-contracts/src/main/java/com/dwp/platform/contracts/hris/separation/v1/HrisServiceGrantAuthorityV1.java",
    "dwp-platform-contracts/src/main/java/com/dwp/platform/contracts/hris/separation/v1/Hrm013SafeErrorV1.java",
    "dwp-platform-contracts/src/main/java/com/dwp/platform/contracts/hris/separation/v1/Hrm013RequesterIdentityAuthorityV1.java",
    "dwp-platform-contracts/src/main/java/com/dwp/platform/contracts/hris/separation/v1/Hrm013TaskDispatchV1.java",
]
AUTHORIZED_TEST_PATHS = [
    "dwp-platform-contracts/src/test/java/com/dwp/platform/contract/Hrm013SeparationBridgeV1Test.java",
    "dwp-platform-contracts/src/test/java/com/dwp/platform/contract/Hrm013WorkloadProofV1Test.java",
    "dwp-platform-contracts/src/test/java/com/dwp/platform/contract/HrisServiceGrantAuthorityV1Test.java",
    "dwp-platform-contracts/src/test/java/com/dwp/platform/contract/Hrm013RequesterIdentityAuthorityV1Test.java",
    "dwp-platform-contracts/src/test/java/com/dwp/platform/contract/Hrm013TaskDispatchV1Test.java",
]
AUTHORIZED_BACKEND_PATHS = AUTHORIZED_SOURCE_PATHS + AUTHORIZED_TEST_PATHS

SEALED_REGISTER = {
    "path": REGISTER_V3_REL,
    "predecessor": {
        "path": REGISTER_V2_REL,
        "bytes": 10190,
        "sha256": "15b52f3cd3867aefa79f02cdf83441d9d5220836344391574cc42a8bdbde7e37",
    },
    "appendCount": 8,
    "appendedBindingIds": [
        "SVC-AUT-HRM-011",
        "SVC-AUT-HRM-012",
        "SVC-AUT-HRM-013",
        "SVC-PEP-TIM-004",
        "SVC-PEP-PAY-002",
        "SVC-AUT-HRM-014",
        "SVC-AUT-HRM-015",
        "SVC-AUT-HRM-016",
    ],
    "appendedRowsSha256": "720ac954b8f5f45b520900a1e078bc1cb5b5750dc79745f714fb994dab9765ea",
    "bytes": 23958,
    "sha256": "16e1401119b1bfff0cf6fa0383ec311e154db91e86df738fb9dffa5e4dd8bf1a",
}

EXPECTED_AUTHORITY = {
    "sharedContractExecutionAuthorityPrepared": True,
    "independentReviewComplete": True,
    "serviceBindingRegisterV3Sealed": True,
    "sharedContractImplementationAuthorized": True,
    "authV62GenerationPreparationAuthorized": False,
    "authV271ReservationAuthorized": False,
    "authV271ImplementationAuthorized": False,
    "approvalRuntimeImplementationAuthorized": False,
    "peopleOwnerRuntimeImplementationAuthorized": False,
    "taskDispatchOwnerImplementationAuthorized": False,
    "performanceConsumerImplementationAuthorized": False,
    "grantRotationAuthorized": False,
    "worktreeAuthorized": True,
    "sourceAuthoringAuthorized": True,
    "migrationAuthoringAuthorized": False,
    "controllerOrRelayActivationAuthorized": False,
    "callbackProducerImplementationAuthorized": False,
    "frontendUiMenuOrRouteAuthorized": False,
    "featureEnablementAuthorized": False,
    "tenantEnrollmentAuthorized": False,
    "runtimeCredentialBindingAuthorized": False,
    "productionBindingAuthorized": False,
    "productionReleaseAuthorized": False,
    "businessCompletionCredit": 0,
}
EXPECTED_REVIEW_AUTHORITY = {
    "independentReviewComplete": True,
    "successorCarrierCommitAndPushAuthorized": True,
    "serviceBindingRegisterV3Reviewed": True,
    "sharedContractImplementationAuthorizedAfterCarrierPush": True,
    "sourceAuthoringAuthorizedBeforeCarrierPush": False,
    "migrationAuthoringAuthorized": False,
    "authGenerationAuthorized": False,
    "runtimeImplementationAuthorized": False,
    "productionBindingAuthorized": False,
    "productionReleaseAuthorized": False,
    "businessCompletionCredit": 0,
}

TEST_FQCNS = [
    "com.dwp.platform.contract.Hrm013SeparationBridgeV1Test",
    "com.dwp.platform.contract.Hrm013WorkloadProofV1Test",
    "com.dwp.platform.contract.HrisServiceGrantAuthorityV1Test",
    "com.dwp.platform.contract.Hrm013RequesterIdentityAuthorityV1Test",
    "com.dwp.platform.contract.Hrm013TaskDispatchV1Test",
]
TARGETED_RECEIPT_PATH = RECEIPT_PATH.with_name(
    "shared-targeted-verification-receipt.v1.json"
)
POST_REVIEW_RECEIPT_PATH = RECEIPT_PATH.with_name(
    "shared-post-implementation-review.v1.json"
)
CENTRAL_RECEIPT_PATH = RECEIPT_PATH.with_name(
    "shared-central-integration-authority.v1.json"
)
GRADLE_USER_HOME_ROOT = RECEIPT_PATH.parent.parent / "gradle-user-home"
LATER_AUTHORITY_REL = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-shared-contract-integration-r1/"
    "shared-contract-central-integration-authority.v1.json"
)
LATER_VALIDATOR_REL = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-shared-contract-integration-r1/"
    "validate_hrm013_shared_contract_integration.py"
)
LATER_REVIEW_REL = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-shared-contract-integration-r1/"
    "independent-review.v1.json"
)
LATER_CARRIER_PATHS = {
    "package.json",
    LATER_AUTHORITY_REL,
    LATER_REVIEW_REL,
    LATER_VALIDATOR_REL,
}
LATER_AUTHORITY_TOP_KEYS = {
    "schema",
    "state",
    "lane",
    "predecessorCarrier",
    "sharedLaneEvidence",
    "centralIntegrationBoundary",
    "historicalBackendDescendantGovernance",
    "authority",
}
LATER_REVIEW_TOP_KEYS = {
    "schema",
    "reviewedAt",
    "reviewer",
    "scope",
    "findings",
    "finalVerdict",
    "authority",
    "artifactPins",
}
LATER_AUTHORITY_MAP = {
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
LATER_REVIEW_AUTHORITY_MAP = {
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
EXPECTED_AUTHORITY_DOCUMENT_PIN = (
    55483,
    "9e0c0035b8364f68ff95dc934af8766034c02ddb64cca35255ae8a85eba39fff",
)

OLD_SCRIPT = (
    "python3 docs/06-delivery/hris/tools/validate_current_authority.py && "
    "python3 docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-semantic-closure-r1/validate_hrm013_semantic_closure.py && "
    "python3 docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-callback-binding-r1/validate_hrm013_callback_binding.py && "
    "python3 docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-owner-runtime-binding-gate-r1/"
    "validate_hrm013_owner_runtime_binding_gate.py"
)
NEW_SCRIPT = OLD_SCRIPT + " && python3 " + VALIDATOR_REL
EXACT_CARRIER_PATHS = {
    "package.json",
    AUTHORITY_REL,
    REVIEW_REL,
    VALIDATOR_REL,
    REGISTER_V3_REL,
}

AUTHORITY_TOP_KEYS = {
    "schema",
    "state",
    "lane",
    "predecessorCarrier",
    "authorizedSourcePaths",
    "authorizedTestPaths",
    "sealedServiceBindingRegister",
    "executionBoundary",
    "validationPlan",
    "authority",
}
REVIEW_TOP_KEYS = {
    "schema",
    "reviewedAt",
    "reviewer",
    "scope",
    "findings",
    "finalVerdict",
    "authority",
    "artifactPins",
}


class VerificationError(RuntimeError):
    """Raised for an unsafe or nonconforming carrier."""


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
    """JSON-oriented equality that never treats bool as an integer."""
    if type(actual) is not type(expected):
        return False
    if isinstance(expected, dict):
        return (
            set(actual.keys()) == set(expected.keys())
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


def canonical_digest(value: Any) -> str:
    return sha256_bytes(
        json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode(
            "utf-8"
        )
    )


RFC3339_SECONDS = re.compile(
    r"(?P<date>[0-9]{4}-[0-9]{2}-[0-9]{2})T"
    r"(?P<time>[0-9]{2}:[0-9]{2}:[0-9]{2})"
    r"(?P<zone>Z|[+-][0-9]{2}:[0-9]{2})"
)


def parse_rfc3339_seconds(value: Any, label: str) -> datetime:
    if type(value) is not str or RFC3339_SECONDS.fullmatch(value) is None:
        raise VerificationError(f"{label} must be RFC3339 with seconds and an explicit timezone")
    normalized = value[:-1] + "+00:00" if value.endswith("Z") else value
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError as exc:
        raise VerificationError(f"{label} is not a real calendar timestamp: {value}") from exc
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
    """Require every adjacent event to be monotonically nondecreasing."""
    for (earlier_label, earlier), (later_label, later) in zip(
        labeled_events, labeled_events[1:]
    ):
        v.require(
            earlier <= later,
            f"causal order violation: {earlier_label} must not follow {later_label}",
        )


def run_internal_negative_tests(v: Verifier) -> None:
    for left, right in ((True, 1), (False, 0), (0, False), (1, 1.0)):
        v.require(not strict_typed_equal(left, right), f"strict type negative test failed: {left!r}/{right!r}")
    v.require(
        not strict_typed_equal(
            {"nested": [{"authorized": True, "count": 1}]},
            {"nested": [{"authorized": 1, "count": True}]},
        ),
        "nested bool/integer substitution negative fixture was accepted",
    )
    for token in (b'{"x":NaN}', b'{"x":Infinity}', b'{"x":-Infinity}', b'{"x":1,"x":2}'):
        rejected = False
        try:
            load_json_bytes(token, "negative JSON fixture")
        except VerificationError:
            rejected = True
        v.require(rejected, f"invalid JSON negative fixture was accepted: {token!r}")
    for timestamp in ("2026-02-30T00:00:00Z", "2026-10-27T00:00:00"):
        rejected = False
        try:
            parse_rfc3339_seconds(timestamp, "negative timestamp fixture")
        except VerificationError:
            rejected = True
        v.require(rejected, f"invalid timestamp negative fixture was accepted: {timestamp}")
    future_rejected = False
    try:
        require_not_future(
            Verifier(),
            datetime.now(timezone.utc) + timedelta(seconds=301),
            "negative future fixture",
        )
    except VerificationError:
        future_rejected = True
    v.require(future_rejected, "future-skew negative fixture was accepted")
    earlier = datetime(2026, 10, 27, 1, 0, tzinfo=timezone.utc)
    later = datetime(2026, 10, 27, 1, 1, tzinfo=timezone.utc)
    causal_inversion_rejected = False
    try:
        require_causal_order(
            Verifier(),
            [("later fixture", later), ("earlier fixture", earlier)],
        )
    except VerificationError:
        causal_inversion_rejected = True
    v.require(
        causal_inversion_rejected,
        "causal-inversion negative fixture was accepted",
    )
    for label, events in (
        (
            "central recordedAt before later carrier committedAt",
            [("later carrier committedAt", later), ("central recordedAt", earlier)],
        ),
        (
            "central recordedAt before later carrier pushObservedAt",
            [("later carrier pushObservedAt", later), ("central recordedAt", earlier)],
        ),
    ):
        rejected = False
        try:
            require_causal_order(Verifier(), events)
        except VerificationError:
            rejected = True
        v.require(rejected, f"{label} negative fixture was accepted")
    extra_environment = dict(TRUSTED_RUNTIME_ENV)
    extra_environment["UNSEALED"] = "1"
    wrong_path_environment = dict(TRUSTED_RUNTIME_ENV)
    wrong_path_environment["PATH"] = "/tmp:/usr/bin:/bin"
    v.require(not strict_typed_equal(extra_environment, TRUSTED_RUNTIME_ENV), "extra environment key negative fixture was accepted")
    v.require(not strict_typed_equal(wrong_path_environment, TRUSTED_RUNTIME_ENV), "wrong PATH negative fixture was accepted")


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
        decoded = data.decode("utf-8")
        value = json.loads(
            decoded,
            object_pairs_hook=reject_duplicate_pairs,
            parse_constant=reject_nonfinite_json_constant,
        )
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise VerificationError(f"invalid UTF-8 JSON in {label}: {exc}") from exc
    if not isinstance(value, dict):
        raise VerificationError(f"JSON root must be an object: {label}")
    return value


def load_json_file(path: Path, label: str) -> dict[str, Any]:
    return load_json_bytes(path.read_bytes(), label)


def git(repo: Path, *args: str, check: bool = True) -> subprocess.CompletedProcess[bytes]:
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


def canonical_relative_path(value: str) -> bool:
    if not isinstance(value, str) or not value:
        return False
    pure = PurePosixPath(value)
    return (
        not pure.is_absolute()
        and pure.as_posix() == value
        and all(part not in {"", ".", ".."} for part in pure.parts)
    )


def symlink_free_path(root: Path, relative_path: str, *, terminal_may_be_missing: bool = False) -> bool:
    if not canonical_relative_path(relative_path):
        return False
    root_absolute = root.absolute()
    if root_absolute != root_absolute.resolve() or root_absolute.is_symlink():
        return False
    current = root_absolute
    parts = PurePosixPath(relative_path).parts
    for index, part in enumerate(parts):
        current = current / part
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
        current = current / part
        try:
            if stat.S_ISLNK(current.lstat().st_mode):
                return False
        except FileNotFoundError:
            return False
    return True


def nul_paths(data: bytes) -> set[str]:
    if not data:
        return set()
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


def is_ancestor(repo: Path, older: str, newer: str) -> bool:
    return git(repo, "merge-base", "--is-ancestor", older, newer, check=False).returncode == 0


def check_closed_keys(v: Verifier, value: Any, expected: set[str], label: str) -> None:
    v.require(isinstance(value, dict), f"{label} must be an object")
    if isinstance(value, dict):
        v.require(set(value) == expected, f"{label} key set drift: {sorted(set(value) ^ expected)}")


def check_git_hygiene(v: Verifier, repo: Path, expected_root: Path) -> None:
    v.require(absolute_path_is_regular_and_symlink_free(Path(GIT)), "trusted /usr/bin/git is unavailable")
    actual_root = Path(git_text(repo, "rev-parse", "--show-toplevel"))
    v.require(
        actual_root.absolute() == expected_root.absolute()
        and actual_root.resolve() == expected_root.resolve(),
        f"Git top-level mismatch for {repo}",
    )
    v.require(expected_root.absolute() == expected_root.resolve(), f"repository root uses a symlink: {expected_root}")
    replace_refs = git_text(repo, "for-each-ref", "--format=%(refname)", "refs/replace/")
    v.require(not replace_refs, f"replace refs are forbidden in {repo}")
    graft_path = Path(git_text(repo, "rev-parse", "--git-path", "info/grafts"))
    if not graft_path.is_absolute():
        graft_path = repo / graft_path
    v.require(not graft_path.exists() or graft_path.stat().st_size == 0, f"grafts are forbidden in {repo}")
    sparse_path = Path(git_text(repo, "rev-parse", "--git-path", "info/sparse-checkout"))
    if not sparse_path.is_absolute():
        sparse_path = repo / sparse_path
    v.require(not sparse_path.exists(), f"sparse checkout file is forbidden in {repo}")
    forbidden_config = git(
        repo,
        "config",
        "--get-regexp",
        r"^(core\.sparseCheckout|core\.sparseCheckoutCone|core\.fsmonitor|diff\.external|diff\..*\.command)$",
        check=False,
    )
    v.require(
        forbidden_config.returncode == 1 and not forbidden_config.stdout,
        f"unsafe sparse/fsmonitor/external-diff config in {repo}",
    )
    tags = git(repo, "ls-files", "-v", "-z").stdout.split(b"\0")
    unsafe_tags = [entry[:1] for entry in tags if entry and entry[:1] != b"H"]
    v.require(not unsafe_tags, f"assume-unchanged or skip-worktree index flags in {repo}")


def check_branch_clean_and_synced(
    v: Verifier,
    repo: Path,
    branch: str,
    *,
    exact_head: str | None = None,
) -> tuple[str, str]:
    current_branch = git_text(repo, "branch", "--show-current")
    head = git_text(repo, "rev-parse", "HEAD")
    origin = git_text(repo, "rev-parse", f"origin/{branch}")
    v.require(current_branch == branch, f"{repo.name} must be on {branch}")
    v.require(head == origin, f"{repo.name} HEAD must equal origin/{branch}")
    v.require(not working_changes(repo), f"{repo.name} worktree must be clean")
    if exact_head is not None:
        v.require(head == exact_head, f"{repo.name} HEAD drifted from pinned commit")
    return head, origin


def expected_package_bytes() -> tuple[bytes, dict[str, Any]]:
    predecessor = git_blob(FRONTEND, PREDECESSOR_COMMIT, "package.json")
    if predecessor is None:
        raise VerificationError("predecessor package.json blob is missing")
    old_encoded = json.dumps(OLD_SCRIPT, ensure_ascii=False).encode("utf-8")[1:-1]
    new_encoded = json.dumps(NEW_SCRIPT, ensure_ascii=False).encode("utf-8")[1:-1]
    if predecessor.count(old_encoded) != 1:
        raise VerificationError("predecessor package script is missing or ambiguous")
    successor = predecessor.replace(old_encoded, new_encoded, 1)
    successor_json = load_json_bytes(successor, "expected successor package.json")
    return successor, successor_json


def check_package_delta(
    v: Verifier,
    package_bytes: bytes,
    label: str,
    *,
    exact_successor: bool,
) -> dict[str, Any]:
    expected_bytes, expected_json = expected_package_bytes()
    package = load_json_bytes(package_bytes, label)
    scripts = package.get("scripts")
    v.require(isinstance(scripts, dict), f"{label} scripts must be an object")
    if not isinstance(scripts, dict):
        return package
    v.require("prehris:current-contracts:check" not in scripts, f"{label} pre-hook is forbidden")
    v.require("posthris:current-contracts:check" not in scripts, f"{label} post-hook is forbidden")
    if exact_successor:
        predecessor = load_json_bytes(
            git_blob(FRONTEND, PREDECESSOR_COMMIT, "package.json") or b"",
            "predecessor package.json",
        )
        semantic_expected = deepcopy(predecessor)
        semantic_expected["scripts"]["hris:current-contracts:check"] = NEW_SCRIPT
        v.exact(package, semantic_expected, f"{label} changed JSON outside the one sealed script")
        v.exact(package, expected_json, f"{label} semantic successor mismatch")
        v.require(package_bytes == expected_bytes, f"{label} byte delta is not the one sealed replacement")
        v.require(scripts.get("hris:current-contracts:check") == NEW_SCRIPT, f"{label} five-command chain drift")
    else:
        script = scripts.get("hris:current-contracts:check")
        v.require(isinstance(script, str), f"{label} current-contract script must be a string")
        if isinstance(script, str):
            validate_script_grammar(v, script)
    return package


def validate_script_grammar(v: Verifier, script: str) -> None:
    parts = script.split(" && ")
    pattern = re.compile(
        r"python3 (docs/06-delivery/hris/[A-Za-z0-9._/-]+/validate_[A-Za-z0-9_]+\.py)"
    )
    matches = [pattern.fullmatch(part) for part in parts]
    paths = [match.group(1) for match in matches if match is not None]
    expected_prefix = NEW_SCRIPT.split(" && ")
    v.require(" && ".join(parts) == script, "contract script delimiter grammar drift")
    v.require(len(parts) >= 5 and parts[:5] == expected_prefix, "contract script lost its sealed five-command prefix")
    v.require(len(matches) == len(paths) and all(matches), "contract script contains a non-validator command")
    v.require(len(paths) == len(set(paths)), "contract script contains a duplicate validator path")
    for path in paths:
        v.require(canonical_relative_path(path), f"noncanonical validator command path: {path}")
        v.require(path.startswith("docs/06-delivery/hris/"), f"validator escaped HRIS docs root: {path}")
        v.require(symlink_free_path(FRONTEND, path), f"validator path is missing or symlinked: {path}")
        v.require(git_tree_mode(FRONTEND, "HEAD", path) in {"100644", "100755"}, f"validator is not tracked regular: {path}")


def check_authority_structure(v: Verifier, authority: dict[str, Any]) -> None:
    check_closed_keys(v, authority, AUTHORITY_TOP_KEYS, "authority document")
    v.require(
        authority.get("schema") == "dwp.hris.wave7.hrm013-runtime-contract-execution-authority.v1",
        "authority schema drift",
    )
    v.require(
        authority.get("state") == "INDEPENDENTLY_REVIEWED_HASH_BOUND_SHARED_CONTRACT_EXECUTION_AUTHORITY",
        "authority state drift",
    )
    v.require(authority.get("lane") == "SHARED_CONTRACT", "authority lane drift")
    predecessor = authority.get("predecessorCarrier")
    check_closed_keys(
        v,
        predecessor,
        {"repository", "branch", "commit", "tree", "artifactPins"},
        "predecessorCarrier",
    )
    if isinstance(predecessor, dict):
        v.exact(
            {key: predecessor.get(key) for key in ("repository", "branch", "commit", "tree")},
            {
                "repository": "dwp-frontend",
                "branch": "dwp-dev",
                "commit": PREDECESSOR_COMMIT,
                "tree": PREDECESSOR_TREE,
            },
            "predecessor carrier identity drift",
        )
        pins = predecessor.get("artifactPins")
        v.exact(pins, PREDECESSOR_PINS, "predecessor carrier pins are not exact, ordered and closed")
        if isinstance(pins, list):
            for index, pin in enumerate(pins):
                check_closed_keys(v, pin, {"path", "bytes", "sha256"}, f"predecessor pin {index}")
    v.exact(authority.get("authorizedSourcePaths"), AUTHORIZED_SOURCE_PATHS, "source allowlist drift")
    v.exact(authority.get("authorizedTestPaths"), AUTHORIZED_TEST_PATHS, "test allowlist drift")
    v.exact(authority.get("sealedServiceBindingRegister"), SEALED_REGISTER, "sealed register authority drift")
    sealed = authority.get("sealedServiceBindingRegister")
    check_closed_keys(
        v,
        sealed,
        {"path", "predecessor", "appendCount", "appendedBindingIds", "appendedRowsSha256", "bytes", "sha256"},
        "sealedServiceBindingRegister",
    )
    if isinstance(sealed, dict):
        check_closed_keys(v, sealed.get("predecessor"), {"path", "bytes", "sha256"}, "sealed register predecessor")
    check_execution_boundary(v, authority.get("executionBoundary"))
    check_validation_plan(v, authority.get("validationPlan"))
    v.exact(authority.get("authority"), EXPECTED_AUTHORITY, "authority boolean map drift")
    check_closed_keys(v, authority.get("authority"), set(EXPECTED_AUTHORITY), "authority boolean map")


def check_execution_boundary(v: Verifier, boundary: Any) -> None:
    check_closed_keys(
        v,
        boundary,
        {
            "tokenPhase",
            "materializationEffectiveAfter",
            "sourceAuthoringEffectiveAfter",
            "fixedAuthorityConjunction",
            "backend",
            "cleanWorktreeReceiptContract",
            "allowedScope",
            "forbiddenScope",
            "centralIntegrationHandoff",
            "commitAndIntegration",
        },
        "executionBoundary",
    )
    if not isinstance(boundary, dict):
        return
    # The complete document has an immutable byte pin.  These recursive key
    # closures keep diagnostics local while the pin makes every value exact.
    check_closed_keys(
        v,
        boundary.get("centralIntegrationHandoff"),
        {
            "directDwpDevMergeAuthorizedByThisCarrier",
            "eligibilityEffectiveAfter",
            "laterFrontendAuthority",
            "receiptContract",
            "attestationIndependence",
            "integrationRule",
            "historicalValidationRule",
        },
        "executionBoundary.centralIntegrationHandoff",
    )
    central = boundary.get("centralIntegrationHandoff")
    if isinstance(central, dict):
        v.require(central.get("directDwpDevMergeAuthorizedByThisCarrier") is False, "this carrier must deny direct dwp-dev integration")
        check_closed_keys(
            v,
            central.get("laterFrontendAuthority"),
            {
                "repository", "branch", "authorityPath", "validatorPath",
                "independentReviewPath", "packagePath", "authoritySchema",
                "authorityState", "authorityLane", "reviewSchema", "reviewer",
                "reviewDecision", "exactCarrierChangedPaths",
                "authorityClosedTopLevelFields", "authorityMap",
                "reviewClosedTopLevelFields", "reviewFinalVerdict",
                "reviewAuthorityMap", "nonCyclicArtifactPinContract",
                "validatorPosition", "predecessorValidatorPath",
                "assumesHistoricalBackendDescendantGovernance",
                "currentValidatorHandoffRule", "sixthValidatorOwnershipRule",
                "packageAppendRule", "mustBeHashBoundAndIndependentlyReviewed",
            },
            "centralIntegrationHandoff.laterFrontendAuthority",
        )
        later = central.get("laterFrontendAuthority")
        if isinstance(later, dict):
            check_closed_keys(
                v,
                later.get("nonCyclicArtifactPinContract"),
                {
                    "laterAuthorityPredecessorPinPaths",
                    "laterReviewArtifactPinPaths",
                    "authorityMustNotPinItsOwnBlob",
                    "reviewMustNotPinItsOwnBlob",
                    "duplicateOrExtraPinAllowed",
                },
                "centralIntegrationHandoff.laterFrontendAuthority.nonCyclicArtifactPinContract",
            )
        check_closed_keys(
            v,
            central.get("receiptContract"),
            {"path", "schema", "state", "closedTopLevelFields", "dynamicPinRequirements", "fixedEvidence", "timestampField", "fileSecurity"},
            "centralIntegrationHandoff.receiptContract",
        )
        check_closed_keys(
            v,
            central.get("attestationIndependence"),
            {"emittedByThisRuntimeContractValidator", "emittedByCleanOrTargetedIssuerMode", "requiredAttestor", "selfAttestationOrCopiedJsonClaimAccepted", "targetMustBeAbsentBeforeAttestation", "writeRule"},
            "centralIntegrationHandoff.attestationIndependence",
        )
        check_closed_keys(
            v,
            central.get("integrationRule"),
            {"laneCommitMustBeExactNonMergeDirectChildOfBackendBase", "laneCommitChangedPathsMustEqualExactElevenPathAllowlist", "allElevenPathsMustBeRegularMode100644AndSymlinkFreeAtLaneCommitAndIntegration", "backendDwpDevMustEqualOriginDwpDevBeforeAndAfterIntegration", "integrationMethod", "mergeCommitAuthorized", "rebaseOrSquashAuthorized", "authGenerationAuthorized", "migrationAuthoringAuthorized", "runtimeImplementationAuthorized"},
            "centralIntegrationHandoff.integrationRule",
        )
        check_closed_keys(
            v,
            central.get("historicalValidationRule"),
            {"sharedIntegrationCommitDiscovery", "delegationOwner", "currentValidatorResponsibility", "laterBackendDescendantsAllowedOnlyWhen", "descendantGovernanceReceiptContract", "perDescendantFrontendGovernanceCarrier", "sharedElevenBlobImmutability", "ungovernedDescendantAction"},
            "centralIntegrationHandoff.historicalValidationRule",
        )
        historical = central.get("historicalValidationRule")
        if isinstance(historical, dict):
            check_closed_keys(
                v,
                historical.get("descendantGovernanceReceiptContract"),
                {"pathTemplate", "schema", "state", "closedTopLevelFields", "decision", "requiredFindings", "recordedBy", "fileSecurity", "chainRule"},
                "centralIntegrationHandoff.historicalValidationRule.descendantGovernanceReceiptContract",
            )
            check_closed_keys(
                v,
                historical.get("perDescendantFrontendGovernanceCarrier"),
                {"authorityPathTemplate", "independentReviewPathTemplate", "governingValidatorPath", "authoritySchema", "authorityState", "authorityClosedTopLevelFields", "authorityMap", "reviewSchema", "reviewer", "reviewDecision", "reviewClosedTopLevelFields", "reviewFinalVerdict", "reviewAuthorityMap", "exactChangedPathTemplates", "orderedCarrierRule", "authorityPinRule", "reviewPinRule", "validatorMutationOrAdditionalCommandRequired"},
                "centralIntegrationHandoff.historicalValidationRule.perDescendantFrontendGovernanceCarrier",
            )
    # Exact values and all nested JSON types are sealed by
    # EXPECTED_AUTHORITY_DOCUMENT_PIN before this function is entered.
    return
def expected_security_mapping() -> dict[str, list[str]]:
    return {
        "CLOSED_DTOS_STRICT_JSON_DUPLICATE_UNKNOWN_MISSING_NULL_COERCION_NONCANONICAL_AND_OVERSIZE_REJECTION": [TEST_FQCNS[0], TEST_FQCNS[2], TEST_FQCNS[3], TEST_FQCNS[4]],
        "RFC8785_CANONICAL_BODY_PAYLOAD_COMMAND_AND_RECEIPT_DIGESTS": [TEST_FQCNS[0], TEST_FQCNS[1], TEST_FQCNS[4]],
        "RS256_CLOSED_HEADERS_CLAIMS_EXACT_FIVE_HEADER_ENVELOPE_METHOD_PATH_BODY_CNF_FRESHNESS_AND_AUTHORIZATION_FORBIDDEN": [TEST_FQCNS[1]],
        "EXACT_GRANT_USE_MODE_NEW_WORK_AND_CONDITIONAL_SEVEN_FIELD_DRAIN_EXISTING_REVISION_FAIL_CLOSED_RULES": [TEST_FQCNS[1], TEST_FQCNS[2]],
        "REQUESTER_TENANT_APPROVAL_ROOT_AND_ACTOR_BINDING": [TEST_FQCNS[3]],
        "TIME_PAYROLL_AUTH_TASK_OWNER_PURPOSE_REVISION_AND_RECEIPT_BINDING": [TEST_FQCNS[4]],
        "SAFE_ERROR_ALLOWLIST_NO_SECRET_KEY_GRANT_OR_IDENTITY_DISCLOSURE": [TEST_FQCNS[0], TEST_FQCNS[2], TEST_FQCNS[3], TEST_FQCNS[4]],
    }


def check_validation_plan(v: Verifier, plan: Any) -> None:
    top_keys = {
        "trustedRunner",
        "gradleSubprocessEnvironment",
        "targetedCompile",
        "targetedTests",
        "securityCriterionMapping",
        "testedTreeEvidence",
        "postImplementationReview",
        "evidenceTimePolicy",
        "validatorLifecycle",
        "failureRule",
        "broadRepositoryRerunRequired",
        "npmChainEvidenceRole",
    }
    check_closed_keys(v, plan, top_keys, "validationPlan")
    if not isinstance(plan, dict):
        return
    time_policy = plan.get("evidenceTimePolicy")
    check_closed_keys(
        v,
        time_policy,
        {"format", "parserRule", "causalOrder", "presentPrefixRule", "maximumFutureSkewSeconds", "implicitExpiryAllowed", "expiryRule", "mandatoryNegativeTests"},
        "validationPlan.evidenceTimePolicy",
    )
    lifecycle = plan.get("validatorLifecycle")
    check_closed_keys(
        v,
        lifecycle,
        {"authoritativeInvocation", "normalValidation", "receiptFileSecurityContract", "issueCleanReceipt", "runTargetedVerification", "postImplementationReview", "centralIntegrationAttestation"},
        "validationPlan.validatorLifecycle",
    )
    if isinstance(lifecycle, dict):
        check_closed_keys(v, lifecycle.get("authoritativeInvocation"), {"workingDirectory", "executable", "argvPrefix", "launchEnvironment", "requiredRuntimeEnvironment", "environmentMode"}, "validatorLifecycle.authoritativeInvocation")
        check_closed_keys(v, lifecycle.get("normalValidation"), {"argvSuffix", "mutatesFilesystem", "claimRule"}, "validatorLifecycle.normalValidation")
        check_closed_keys(v, lifecycle.get("receiptFileSecurityContract"), {"owner", "mode", "fileType", "hardLinkCount", "maximumBytes", "contentEncoding", "pathComponentsSymlinked", "openRule", "readRule", "publicationRule", "replacementOrOverwriteAuthorized"}, "validatorLifecycle.receiptFileSecurityContract")
        check_closed_keys(v, lifecycle.get("issueCleanReceipt"), {"mode", "argvSuffix", "receiptPath", "receiptSchema", "preseedAbsentPaths", "liveChecksBeforeEmission", "sourceAuthoringMustNotHaveStarted", "writeRule", "postWriteRule"}, "validatorLifecycle.issueCleanReceipt")
        check_closed_keys(v, lifecycle.get("runTargetedVerification"), {"mode", "argvSuffix", "receiptPath", "receiptSchema", "subprocessEnvironment", "preseedAbsentPaths", "liveChecksBeforeExecution", "execution", "writeRule", "postWriteRule"}, "validatorLifecycle.runTargetedVerification")
        check_closed_keys(v, lifecycle.get("postImplementationReview"), {"emittedByThisValidator", "rule"}, "validatorLifecycle.postImplementationReview")
        check_closed_keys(v, lifecycle.get("centralIntegrationAttestation"), {"emittedByThisValidator", "rule"}, "validatorLifecycle.centralIntegrationAttestation")
    gradle_environment = plan.get("gradleSubprocessEnvironment")
    check_closed_keys(
        v,
        gradle_environment,
        {"baseEnvironment", "additions", "exactChildEnvironmentKeys", "finalEnvironmentRule", "gradleUserHome"},
        "validationPlan.gradleSubprocessEnvironment",
    )
    if isinstance(gradle_environment, dict):
        check_closed_keys(v, gradle_environment.get("additions"), {"GRADLE_USER_HOME"}, "gradleSubprocessEnvironment.additions")
        check_closed_keys(
            v,
            gradle_environment.get("gradleUserHome"),
            {"pathTemplate", "singleUseKey", "preparationRule", "beforeFirstExecution", "forbiddenPaths", "allowedTopLevelEntriesAfterExecution", "allowedContentRule", "revalidateBeforeEachGradleInvocation", "reuseAcrossTestedCommitsAuthorized"},
            "gradleSubprocessEnvironment.gradleUserHome",
        )
    return
def check_review_structure(v: Verifier, review: dict[str, Any]) -> None:
    check_closed_keys(v, review, REVIEW_TOP_KEYS, "independent review")
    v.require(
        review.get("schema")
        == "dwp.hris.wave7.hrm013-runtime-contract-execution-authority-independent-review.v1",
        "review schema drift",
    )
    v.require(
        review.get("reviewer") == "INDEPENDENT_HRM013_SHARED_CONTRACT_AUTHORITY_REVIEW",
        "reviewer identity drift",
    )
    reviewed_at = parse_rfc3339_seconds(review.get("reviewedAt"), "carrier review reviewedAt")
    require_not_future(v, reviewed_at, "carrier review reviewedAt")
    scope = review.get("scope")
    check_closed_keys(v, scope, {"authorityPath", "validatorPath", "registerPath", "packagePath", "reviewedBoundaries"}, "review scope")
    if isinstance(scope, dict):
        v.exact(
            {key: scope.get(key) for key in ("authorityPath", "validatorPath", "registerPath", "packagePath")},
            {
                "authorityPath": AUTHORITY_REL,
                "validatorPath": VALIDATOR_REL,
                "registerPath": REGISTER_V3_REL,
                "packagePath": "package.json",
            },
            "review scope paths drift",
        )
        v.exact(
            scope.get("reviewedBoundaries"),
            [
                "PREDECESSOR_CARRIER_AND_ARTIFACT_PINS",
                "EXACT_SIX_SOURCE_AND_FIVE_TEST_ALLOWLISTS",
                "BYTE_PRESERVING_EIGHT_ROW_V3_REGISTER_APPEND",
                "PHASE_SPLIT_AND_CONJUNCTIVE_AUTHORITY_EFFECTIVITY",
                "CLOSED_DYNAMIC_CARRIER_AND_CLEAN_WORKTREE_RECEIPT_CONTRACT",
                "MACHINE_READABLE_ISOLATED_PYTHON_AND_SANITIZED_GIT_RUNNER",
                "FRESH_PER_TESTED_COMMIT_REAL_NON_SYMLINK_GRADLE_USER_HOME_AND_EXACT_FIVE_KEY_SUBPROCESS_ENVIRONMENT",
                "EXACT_GRADLE_ARGV_FQCN_SECURITY_CRITERIA_TESTED_TREE_AND_POST_REVIEW",
                "EXCLUSIVE_RECEIPT_PROVENANCE_SAFE_BOUNDED_READ_MODE_0600_CURRENT_UID_NLINK_ONE_AND_HARD_LINK_PUBLICATION",
                "FUTURE_FOUR_PATH_HASH_BOUND_CENTRAL_INTEGRATION_HANDOFF_AND_NONCYCLIC_REVIEW_PINS",
                "REVIEWED_SIXTH_VALIDATOR_HISTORICAL_DESCENDANT_GOVERNANCE_DELEGATION_AND_SHARED_BLOB_IMMUTABILITY",
                "MIGRATION_RUNTIME_UI_TENANT_CREDENTIAL_AND_PRODUCTION_DENIALS",
                "SUPPLEMENTARY_NPM_CHAIN_NOT_SECURITY_AUTHORITY",
            ],
            "review boundary list drift",
        )
    findings = review.get("findings")
    check_closed_keys(v, findings, {"p0", "p1", "p2", "notes"}, "review findings")
    if isinstance(findings, dict):
        v.exact(findings.get("p0"), [], "review P0 findings drift")
        v.exact(findings.get("p1"), [], "review P1 findings drift")
        v.exact(findings.get("p2"), [], "review P2 findings drift")
        expected_notes = [
            "The exact authority, validator, v3 register and package artifact bytes and SHA-256 pins are final; this verdict authorizes only the carrier commit and push.",
            "The predecessor-fixed true authority and review booleans are conjunctive with the materializationEffectiveAfter and sourceAuthoringEffectiveAfter conditions and never operate as standalone grants.",
            "Backend source, worktree materialization, clean-worktree receipt, tested-tree evidence, post-implementation review, central integration attestation and descendant governance have not occurred under this carrier-authoring step.",
            "Bare python3 execution through the package script is supplementary only; direct dwp-dev merge remains withheld after targeted tests and branch review.",
        ]
        v.exact(findings.get("notes"), expected_notes, "review notes drift")
        v.require(
            all(
                isinstance(note, str)
                and "DRAFT" not in note
                and "placeholder" not in note.lower()
                for note in findings.get("notes", [])
            ),
            "review still contains draft or placeholder language",
        )
    verdict = review.get("finalVerdict")
    check_closed_keys(v, verdict, {"p0", "p1", "p2", "decision"}, "review finalVerdict")
    if isinstance(verdict, dict):
        v.exact(
            verdict,
            {
                "p0": 0,
                "p1": 0,
                "p2": 0,
                "decision": "GO_FOR_SHARED_CONTRACT_EXECUTION_AUTHORITY_CARRIER_COMMIT_AND_PUSH_ONLY",
            },
            "review verdict drift",
        )
    v.exact(review.get("authority"), EXPECTED_REVIEW_AUTHORITY, "review authority map drift")
    check_closed_keys(v, review.get("authority"), set(EXPECTED_REVIEW_AUTHORITY), "review authority map")
    pins = review.get("artifactPins")
    v.require(isinstance(pins, list) and len(pins) == 4, "review must contain exactly four artifact pins")
    if isinstance(pins, list):
        for index, pin in enumerate(pins):
            check_closed_keys(v, pin, {"path", "bytes", "sha256"}, f"review pin {index}")


def check_predecessor_pins(v: Verifier) -> None:
    v.require(git_text(FRONTEND, "rev-parse", f"{PREDECESSOR_COMMIT}^{{tree}}") == PREDECESSOR_TREE, "predecessor tree drift")
    for pin in PREDECESSOR_PINS:
        path = pin["path"]
        v.require(canonical_relative_path(path), f"noncanonical predecessor pin path: {path}")
        v.require(
            git_blob_digest(FRONTEND, PREDECESSOR_COMMIT, path) == (pin["bytes"], pin["sha256"]),
            f"predecessor blob pin drift: {path}",
        )
        v.require(git_tree_mode(FRONTEND, PREDECESSOR_COMMIT, path) == "100644", f"predecessor blob mode drift: {path}")
        if path != "package.json":
            v.require(symlink_free_path(FRONTEND, path), f"predecessor artifact missing or symlinked: {path}")
            v.require(digest_file(FRONTEND / path) == (pin["bytes"], pin["sha256"]), f"predecessor artifact worktree drift: {path}")


def expand_register_rows(register_contract: dict[str, Any]) -> tuple[list[str], list[dict[str, str]]]:
    header = register_contract.get("requiredHeader")
    common = register_contract.get("requiredCommonColumns")
    profiles = register_contract.get("requiredProfiles")
    specifications = register_contract.get("requiredRows")
    if not isinstance(header, list) or not isinstance(common, dict) or not isinstance(profiles, dict) or not isinstance(specifications, list):
        raise VerificationError("predecessor register contract shape drift")
    rows: list[dict[str, str]] = []
    for specification in specifications:
        if not isinstance(specification, dict) or set(specification) != {"profile", "columns"}:
            raise VerificationError("register row specification is not closed")
        profile = profiles.get(specification["profile"])
        columns = specification["columns"]
        if not isinstance(profile, dict) or not isinstance(columns, dict):
            raise VerificationError("register profile/columns shape drift")
        row = {**common, **profile, **columns}
        if set(row) != set(header) or not all(isinstance(row.get(column), str) and row[column] for column in header):
            raise VerificationError("register expanded row is incomplete")
        rows.append({column: row[column] for column in header})
    return header, rows


def check_register(v: Verifier) -> None:
    v.require(symlink_free_path(FRONTEND, REGISTER_V2_REL), "v2 register is missing or symlinked")
    v.require(symlink_free_path(FRONTEND, REGISTER_V3_REL), "v3 register is missing or symlinked")
    v2 = (FRONTEND / REGISTER_V2_REL).read_bytes()
    v3 = (FRONTEND / REGISTER_V3_REL).read_bytes()
    v.require(digest_bytes(v2) == (10190, SEALED_REGISTER["predecessor"]["sha256"]), "v2 register pin drift")
    v.require(digest_bytes(v3) == (SEALED_REGISTER["bytes"], SEALED_REGISTER["sha256"]), "v3 register pin drift")
    v.require(v3.startswith(v2), "v3 register does not preserve the complete v2 byte prefix")
    gate = load_json_file(FRONTEND / GATE_REL, "predecessor gate")
    register_contract = gate.get("nextExecutionAuthorityPrerequisites", {}).get("serviceBindingRegisterSuccessor")
    v.require(isinstance(register_contract, dict), "predecessor register contract missing")
    if not isinstance(register_contract, dict):
        return
    header, expected_rows = expand_register_rows(register_contract)
    v.require([row["binding_id"] for row in expected_rows] == SEALED_REGISTER["appendedBindingIds"], "appended binding order drift")
    v.require(canonical_digest(expected_rows) == SEALED_REGISTER["appendedRowsSha256"], "appended row canonical digest drift")
    output = io.StringIO(newline="")
    writer = csv.DictWriter(output, fieldnames=header, lineterminator="\n")
    for row in expected_rows:
        writer.writerow(row)
    expected_v3 = v2 + output.getvalue().encode("utf-8") + b"\n"
    v.require(v3 == expected_v3, "v3 register bytes are not the canonical sealed append")
    try:
        v2_reader = csv.DictReader(io.StringIO(v2.decode("utf-8"), newline=""))
        v2_rows = list(v2_reader)
        v3_reader = csv.DictReader(io.StringIO(v3.decode("utf-8"), newline=""))
        v3_rows = list(v3_reader)
    except (UnicodeDecodeError, csv.Error) as exc:
        raise VerificationError(f"register CSV parse failed: {exc}") from exc
    v.require(v2_reader.fieldnames == header and v3_reader.fieldnames == header, "register header drift")
    v.require(v3_rows[: len(v2_rows)] == v2_rows and v3_rows[len(v2_rows) :] == expected_rows, "register row closure drift")
    v.require(len({row["binding_id"] for row in v3_rows}) == len(v3_rows), "duplicate register binding ID")


def expected_review_pins(blob_source: dict[str, bytes]) -> list[dict[str, Any]]:
    return [
        {"path": path, "bytes": len(blob_source[path]), "sha256": sha256_bytes(blob_source[path])}
        for path in (AUTHORITY_REL, VALIDATOR_REL, REGISTER_V3_REL, "package.json")
    ]


def check_frontend_authoring(v: Verifier, authority: dict[str, Any], review: dict[str, Any]) -> None:
    head, _ = check_branch_clean_and_synced_except_carrier(v)
    v.require(head == PREDECESSOR_COMMIT, "authoring must occur on the exact predecessor carrier")
    changes = working_changes(FRONTEND)
    v.require(changes == EXACT_CARRIER_PATHS, f"authoring changed-path set drift: {sorted(changes ^ EXACT_CARRIER_PATHS)}")
    for path in (AUTHORITY_REL, REVIEW_REL, VALIDATOR_REL, REGISTER_V3_REL, "package.json"):
        v.require(symlink_free_path(FRONTEND, path), f"authoring artifact missing or symlinked: {path}")
        v.require((FRONTEND / path).is_file(), f"authoring artifact is not a regular file: {path}")
    package_bytes = (FRONTEND / "package.json").read_bytes()
    check_package_delta(v, package_bytes, "authoring package.json", exact_successor=True)
    blobs = {
        AUTHORITY_REL: (FRONTEND / AUTHORITY_REL).read_bytes(),
        VALIDATOR_REL: (FRONTEND / VALIDATOR_REL).read_bytes(),
        REGISTER_V3_REL: (FRONTEND / REGISTER_V3_REL).read_bytes(),
        "package.json": package_bytes,
    }
    v.exact(review.get("artifactPins"), expected_review_pins(blobs), "authoring review pins do not match exact current artifacts")


def check_branch_clean_and_synced_except_carrier(v: Verifier) -> tuple[str, str]:
    branch = git_text(FRONTEND, "branch", "--show-current")
    head = git_text(FRONTEND, "rev-parse", "HEAD")
    origin = git_text(FRONTEND, "rev-parse", "origin/dwp-dev")
    v.require(branch == "dwp-dev", "frontend must be on dwp-dev")
    v.require(head == origin, "frontend authoring base must equal origin/dwp-dev")
    return head, origin


def discover_carrier_commit(v: Verifier) -> str:
    add_commits: list[str] = []
    for path in (AUTHORITY_REL, REVIEW_REL, VALIDATOR_REL, REGISTER_V3_REL):
        lines = [line for line in git_text(FRONTEND, "log", "--diff-filter=A", "--format=%H", "--", path).splitlines() if line]
        v.require(len(lines) == 1, f"carrier add commit missing or ambiguous: {path}")
        if len(lines) == 1:
            add_commits.append(lines[0])
    v.require(len(set(add_commits)) == 1, "four carrier artifacts were not introduced together")
    carrier = add_commits[0]
    parents = git_text(FRONTEND, "rev-list", "--parents", "-n", "1", carrier).split()
    v.require(parents == [carrier, PREDECESSOR_COMMIT], "carrier is not the non-merge direct child of its predecessor")
    changed = set(git_text(FRONTEND, "diff", "--name-only", f"{PREDECESSOR_COMMIT}..{carrier}").splitlines())
    v.require(changed == EXACT_CARRIER_PATHS, f"carrier commit path set drift: {sorted(changed ^ EXACT_CARRIER_PATHS)}")
    return carrier


def check_frontend_historical(v: Verifier, authority: dict[str, Any], review: dict[str, Any]) -> str:
    head, origin = check_branch_clean_and_synced(v, FRONTEND, "dwp-dev")
    carrier = discover_carrier_commit(v)
    v.require(is_ancestor(FRONTEND, carrier, head), "carrier is not an ancestor of frontend HEAD")
    v.require(is_ancestor(FRONTEND, carrier, origin), "carrier is not pushed to origin/dwp-dev")
    for path in (AUTHORITY_REL, REVIEW_REL, VALIDATOR_REL, REGISTER_V3_REL):
        v.require(git_tree_mode(FRONTEND, carrier, path) == "100644", f"unsafe carrier Git mode: {path}")
        v.require(git_tree_mode(FRONTEND, head, path) == "100644", f"unsafe current Git mode: {path}")
        v.require(symlink_free_path(FRONTEND, path), f"carrier artifact missing or symlinked: {path}")
        v.require(digest_file(FRONTEND / path) == git_blob_digest(FRONTEND, carrier, path), f"immutable carrier artifact drift: {path}")
    v.require(git_tree_mode(FRONTEND, carrier, "package.json") == "100644", "carrier package mode must be 100644")
    v.require(git_tree_mode(FRONTEND, head, "package.json") == "100644", "current package mode must be 100644")
    v.require(symlink_free_path(FRONTEND, "package.json"), "current package is missing or symlinked")
    carrier_package = git_blob(FRONTEND, carrier, "package.json") or b""
    check_package_delta(v, carrier_package, "carrier package.json", exact_successor=True)
    current_package = (FRONTEND / "package.json").read_bytes()
    v.require(current_package == (git_blob(FRONTEND, head, "package.json") or b""), "current package bytes differ from HEAD blob")
    check_package_delta(v, current_package, "current package.json", exact_successor=(head == carrier))
    carrier_blobs = {
        path: git_blob(FRONTEND, carrier, path) or b""
        for path in (AUTHORITY_REL, VALIDATOR_REL, REGISTER_V3_REL, "package.json")
    }
    v.exact(review.get("artifactPins"), expected_review_pins(carrier_blobs), "review pins do not match carrier blobs")
    return carrier


def check_agent_repository(v: Verifier) -> None:
    check_git_hygiene(v, AGENT, AGENT)
    head, _ = check_branch_clean_and_synced(v, AGENT, "dwp-dev")
    v.require(is_ancestor(AGENT, AGENT_BASE, head), "agent repository lost the pinned HRM-013 base")


def check_backend_denials(v: Verifier, repo: Path) -> None:
    forbidden = [
        "dwp-auth-server/src/main/resources/db/migration/V271__create_hris_service_grant_authority.sql",
        "dwp-auth-server/src/main/resources/product-authorization/product-authorization-v62.generated.json",
    ]
    for path in forbidden:
        v.require(not (repo / path).exists(), f"forbidden later-phase artifact exists: {path}")
    v.require(
        not list((repo / "dwp-approval-server/src/main/resources/db/migration").glob("V60*")),
        "Approval V60 is forbidden in the shared-contract phase",
    )
    v.require(
        not list((repo / "dwp-people-server/src/main/resources/db/migration").glob("V62*")),
        "People V62 is forbidden in the shared-contract phase",
    )


def check_source_shadow(v: Verifier, repo: Path, *, allow_authorized_untracked: bool) -> None:
    roots = ["dwp-platform-contracts/src"]
    ignored = nul_paths(
        git(repo, "ls-files", "--others", "--ignored", "--exclude-standard", "-z", "--", *roots).stdout
    )
    v.require(not ignored, f"ignored source/test shadow files are forbidden: {sorted(ignored)}")
    untracked = nul_paths(git(repo, "ls-files", "--others", "--exclude-standard", "-z", "--", *roots).stdout)
    if allow_authorized_untracked:
        v.require(untracked <= set(AUTHORIZED_BACKEND_PATHS), f"untracked source/test shadow outside allowlist: {sorted(untracked - set(AUTHORIZED_BACKEND_PATHS))}")
    else:
        v.require(not untracked, f"source/test shadow exists before receipt: {sorted(untracked)}")


SOURCE_SHADOW_ROOTS = ["dwp-platform-contracts/src"]
BUILD_SHADOW_ROOTS = [
    "dwp-platform-contracts/build",
    "dwp-platform-contracts/.gradle",
    "dwp-platform-contracts/gradle",
]


def raw_shadow_inventory(repo: Path, *, ignored: bool, roots: list[str]) -> bytes:
    args = ["ls-files", "--others"]
    if ignored:
        args.extend(["--ignored", "--exclude-standard"])
    else:
        args.append("--exclude-standard")
    args.extend(["-z", "--", *roots])
    return git(repo, *args).stdout


def porcelain_v2(repo: Path) -> bytes:
    return git(
        repo,
        "status",
        "--porcelain=v2",
        "-z",
        "--untracked-files=all",
    ).stdout


def live_protections(repo: Path) -> dict[str, Any]:
    assume: list[str] = []
    skip: list[str] = []
    for entry in git(repo, "ls-files", "-v", "-z").stdout.split(b"\0"):
        if not entry:
            continue
        marker = entry[:1]
        path = entry[2:].decode("utf-8", errors="strict")
        if marker.islower():
            assume.append(path)
        if marker == b"S":
            skip.append(path)
    unsafe_config = git(
        repo,
        "config",
        "-z",
        "--get-regexp",
        r"^(core\.sparseCheckout|core\.sparseCheckoutCone|core\.fsmonitor|diff\.external|diff\..*\.command)$",
        check=False,
    ).stdout
    replace_refs = [
        line
        for line in git_text(repo, "for-each-ref", "--format=%(refname)", "refs/replace/").splitlines()
        if line
    ]
    graft_path = Path(git_text(repo, "rev-parse", "--git-path", "info/grafts"))
    if not graft_path.is_absolute():
        graft_path = repo / graft_path
    sparse_path = Path(git_text(repo, "rev-parse", "--git-path", "info/sparse-checkout"))
    if not sparse_path.is_absolute():
        sparse_path = repo / sparse_path
    return {
        "assumeUnchangedPaths": assume,
        "skipWorktreePaths": skip,
        "sparseCheckoutEnabled": sparse_path.exists(),
        "fsmonitorConfigured": b"core.fsmonitor" in unsafe_config,
        "diffExternalConfigured": b"diff.external" in unsafe_config or b".command" in unsafe_config,
        "unsafeGitConfigEntries": [
            item.decode("utf-8", errors="strict")
            for item in unsafe_config.split(b"\0")
            if item
        ],
        "unsafeGitConfigNulBytes": len(unsafe_config),
        "unsafeGitConfigNulSha256": sha256_bytes(unsafe_config),
        "graftFilePresent": graft_path.exists() and graft_path.stat().st_size > 0,
        "replaceRefs": replace_refs,
        "repositoryOrWorktreePathSymlinks": [],
        "authorizedSourceOrTestPathSymlinks": [
            path
            for path in AUTHORIZED_BACKEND_PATHS
            if (repo / path).is_symlink()
        ],
    }


def utc_now_seconds() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace(
        "+00:00", "Z"
    )


def open_real_directory(path: Path, *, create: bool) -> int:
    """Open an absolute directory through one no-follow descriptor chain."""
    absolute = path.absolute()
    if not absolute.is_absolute():
        raise VerificationError(f"directory must be absolute: {path}")
    flags = os.O_RDONLY | getattr(os, "O_DIRECTORY", 0) | getattr(os, "O_NOFOLLOW", 0)
    descriptor = os.open(absolute.anchor, flags)
    try:
        for part in absolute.parts[1:]:
            try:
                child = os.open(part, flags, dir_fd=descriptor)
            except FileNotFoundError:
                if not create:
                    raise
                os.mkdir(part, 0o700, dir_fd=descriptor)
                child = os.open(part, flags, dir_fd=descriptor)
            os.close(descriptor)
            descriptor = child
    except Exception:
        os.close(descriptor)
        raise
    return descriptor


def ensure_real_directory(path: Path) -> None:
    descriptor = open_real_directory(path, create=True)
    os.close(descriptor)


def safe_read_receipt(
    path: Path, label: str, *, maximum_bytes: int = 65536
) -> tuple[bytes, os.stat_result]:
    """Read a closed receipt through held no-follow directory/file descriptors."""
    directory_fd = open_real_directory(path.parent, create=False)
    descriptor = -1
    try:
        descriptor = os.open(
            path.name,
            os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0),
            dir_fd=directory_fd,
        )
        metadata = os.fstat(descriptor)
        if (
            not stat.S_ISREG(metadata.st_mode)
            or stat.S_IMODE(metadata.st_mode) != 0o600
            or metadata.st_uid != os.geteuid()
            or metadata.st_nlink != 1
            or metadata.st_size > maximum_bytes
        ):
            raise VerificationError(
                f"{label} must be a current-user 0600 single-link regular file "
                f"no larger than {maximum_bytes} bytes"
            )
        with os.fdopen(descriptor, "rb", closefd=True) as stream:
            descriptor = -1
            data = stream.read(maximum_bytes + 1)
            final_metadata = os.fstat(stream.fileno())
        if len(data) != metadata.st_size or len(data) > maximum_bytes:
            raise VerificationError(f"{label} changed while being read or is oversized")
        stable_fields = (
            "st_dev",
            "st_ino",
            "st_mode",
            "st_uid",
            "st_nlink",
            "st_size",
            "st_mtime_ns",
        )
        if any(
            getattr(metadata, field) != getattr(final_metadata, field)
            for field in stable_fields
        ):
            raise VerificationError(f"{label} metadata changed while being read")
        return data, metadata
    finally:
        if descriptor >= 0:
            os.close(descriptor)
        os.close(directory_fd)


def atomic_emit_json(path: Path, value: dict[str, Any]) -> bytes:
    data = (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    if len(data) > 65536:
        raise VerificationError(f"receipt exceeds the 65536-byte contract: {path}")
    directory_fd = open_real_directory(path.parent, create=True)
    temporary_name = (
        f".{path.name}.tmp-{os.getpid()}-{secrets.token_hex(16)}"
    )
    descriptor = -1
    temporary_created = False
    published = False
    try:
        try:
            os.stat(path.name, dir_fd=directory_fd, follow_symlinks=False)
        except FileNotFoundError:
            pass
        else:
            raise VerificationError(
                f"receipt target already exists; overwrite forbidden: {path}"
            )
        descriptor = os.open(
            temporary_name,
            os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0),
            0o600,
            dir_fd=directory_fd,
        )
        temporary_created = True
        with os.fdopen(descriptor, "wb", closefd=True) as stream:
            descriptor = -1
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        # Hard-link publication is atomic and cannot replace an existing target.
        os.link(
            temporary_name,
            path.name,
            src_dir_fd=directory_fd,
            dst_dir_fd=directory_fd,
            follow_symlinks=False,
        )
        published = True
        os.unlink(temporary_name, dir_fd=directory_fd)
        temporary_created = False
        os.fsync(directory_fd)
        reopened = os.open(
            path.name,
            os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0),
            dir_fd=directory_fd,
        )
        with os.fdopen(reopened, "rb", closefd=True) as stream:
            actual_stat = os.fstat(stream.fileno())
            actual = stream.read()
        if (
            not stat.S_ISREG(actual_stat.st_mode)
            or stat.S_IMODE(actual_stat.st_mode) != 0o600
            or actual_stat.st_uid != os.geteuid()
            or actual_stat.st_nlink != 1
        ):
            raise VerificationError(
                f"receipt post-write metadata verification failed: {path}"
            )
        if actual != data:
            raise VerificationError(f"receipt post-write byte verification failed: {path}")
        return data
    except Exception:
        if descriptor >= 0:
            os.close(descriptor)
        if temporary_created:
            try:
                os.unlink(temporary_name, dir_fd=directory_fd)
            except FileNotFoundError:
                pass
        if published:
            try:
                os.unlink(path.name, dir_fd=directory_fd)
                os.fsync(directory_fd)
            except FileNotFoundError:
                pass
        raise
    finally:
        os.close(directory_fd)


def require_primary_backend_base(v: Verifier) -> None:
    check_git_hygiene(v, BACKEND, BACKEND)
    v.require(git_text(BACKEND, "branch", "--show-current") == "dwp-dev", "backend primary checkout must be dwp-dev")
    head = git_text(BACKEND, "rev-parse", "HEAD")
    origin = git_text(BACKEND, "rev-parse", "origin/dwp-dev")
    v.require(head == origin == BACKEND_BASE, "backend primary and origin/dwp-dev must equal the pinned base")
    v.require(not working_changes(BACKEND), "backend primary checkout must be clean")


def require_exact_fresh_shared_worktree(v: Verifier) -> dict[str, Any]:
    v.require(SHARED_WORKTREE.exists(), "exact shared worktree is not materialized")
    v.require(SHARED_WORKTREE.absolute() == SHARED_WORKTREE.resolve(), "shared worktree root is symlinked")
    v.require(
        absolute_path_is_regular_and_symlink_free(SHARED_WORKTREE / ".git"),
        "shared worktree .git file is missing, nonregular or symlinked",
    )
    check_git_hygiene(v, SHARED_WORKTREE, SHARED_WORKTREE)
    v.require(git_text(SHARED_WORKTREE, "branch", "--show-current") == SHARED_BRANCH, "shared worktree branch drift")
    v.require(git_text(SHARED_WORKTREE, "rev-parse", "HEAD") == BACKEND_BASE, "fresh shared worktree HEAD drift")
    v.require(git_text(SHARED_WORKTREE, "rev-parse", "HEAD^{tree}") == BACKEND_TREE, "fresh shared worktree tree drift")
    upstream = git(SHARED_WORKTREE, "rev-parse", "--verify", "@{upstream}", check=False)
    v.require(upstream.returncode != 0, "fresh shared branch must have no upstream")
    remote = git(BACKEND, "rev-parse", "--verify", f"refs/remotes/origin/{SHARED_BRANCH}", check=False)
    v.require(remote.returncode != 0, "remote shared branch must be absent at materialization")
    status = porcelain_v2(SHARED_WORKTREE)
    ignored_source = raw_shadow_inventory(SHARED_WORKTREE, ignored=True, roots=SOURCE_SHADOW_ROOTS)
    untracked_source = raw_shadow_inventory(SHARED_WORKTREE, ignored=False, roots=SOURCE_SHADOW_ROOTS)
    ignored_build = raw_shadow_inventory(SHARED_WORKTREE, ignored=True, roots=BUILD_SHADOW_ROOTS)
    untracked_build = raw_shadow_inventory(SHARED_WORKTREE, ignored=False, roots=BUILD_SHADOW_ROOTS)
    v.require(not status, "fresh shared worktree status is not empty")
    v.require(not ignored_source and not untracked_source, "fresh shared worktree has source/test shadow files")
    v.require(not ignored_build and not untracked_build, "fresh shared worktree has build shadow files")
    for relative in AUTHORIZED_BACKEND_PATHS:
        v.require(not (SHARED_WORKTREE / relative).exists(), f"authorized path exists before source authoring: {relative}")
    protections = live_protections(SHARED_WORKTREE)
    expected_protections = {
        "assumeUnchangedPaths": [],
        "skipWorktreePaths": [],
        "sparseCheckoutEnabled": False,
        "fsmonitorConfigured": False,
        "diffExternalConfigured": False,
        "unsafeGitConfigEntries": [],
        "unsafeGitConfigNulBytes": 0,
        "unsafeGitConfigNulSha256": sha256_bytes(b""),
        "graftFilePresent": False,
        "replaceRefs": [],
        "repositoryOrWorktreePathSymlinks": [],
        "authorizedSourceOrTestPathSymlinks": [],
    }
    v.exact(protections, expected_protections, "fresh shared worktree protections drift")
    return {
        "status": status,
        "ignoredSource": ignored_source,
        "untrackedSource": untracked_source,
        "ignoredBuild": ignored_build,
        "untrackedBuild": untracked_build,
        "protections": protections,
    }


def issue_clean_receipt(
    v: Verifier, carrier: str, authority_bytes: bytes
) -> None:
    for later_path in (
        RECEIPT_PATH,
        TARGETED_RECEIPT_PATH,
        POST_REVIEW_RECEIPT_PATH,
        CENTRAL_RECEIPT_PATH,
    ):
        v.require(
            not later_path.exists() and not later_path.is_symlink(),
            f"receipt lifecycle was pre-seeded before clean issuance: {later_path}",
        )
    v.require(
        not GRADLE_USER_HOME_ROOT.exists() and not GRADLE_USER_HOME_ROOT.is_symlink(),
        "Gradle user-home root was pre-seeded before clean receipt issuance",
    )
    require_primary_backend_base(v)
    evidence = require_exact_fresh_shared_worktree(v)
    now = utc_now_seconds()
    carrier_tree = git_text(FRONTEND, "rev-parse", f"{carrier}^{{tree}}")
    committed_at = git_text(FRONTEND, "show", "-s", "--format=%cI", carrier)
    receipt = {
        "schema": "dwp.hris.wave7.hrm013-shared-contract-clean-worktree-receipt.v1",
        "state": "HASH_BOUND_FRESH_CLEAN_SHARED_CONTRACT_WORKTREE_RECEIPT",
        "authorityCarrierCommit": carrier,
        "authorityCarrierTree": carrier_tree,
        "authorityCarrierCommittedAt": committed_at,
        "authorityCarrierPushObservedAt": now,
        "authorityArtifact": authority_artifact_pin(authority_bytes),
        "repository": "dwp-backend",
        "repositoryRoot": str(BACKEND),
        "repositoryRealRoot": str(BACKEND.resolve()),
        "worktree": str(SHARED_WORKTREE),
        "worktreeRealRoot": str(SHARED_WORKTREE.resolve()),
        "branch": SHARED_BRANCH,
        "baseCommit": BACKEND_BASE,
        "baseTree": BACKEND_TREE,
        "head": BACKEND_BASE,
        "tree": BACKEND_TREE,
        "originDwpDevAtMaterialization": BACKEND_BASE,
        "upstreamAtMaterialization": None,
        "remoteBranchPresentAtMaterialization": False,
        "statusPorcelainV2Bytes": len(evidence["status"]),
        "statusPorcelainV2Sha256": sha256_bytes(evidence["status"]),
        "ignoredSourceTestShadowNulBytes": len(evidence["ignoredSource"]),
        "ignoredSourceTestShadowNulSha256": sha256_bytes(evidence["ignoredSource"]),
        "untrackedSourceTestShadowNulBytes": len(evidence["untrackedSource"]),
        "untrackedSourceTestShadowNulSha256": sha256_bytes(evidence["untrackedSource"]),
        "ignoredBuildShadowNulBytes": len(evidence["ignoredBuild"]),
        "ignoredBuildShadowNulSha256": sha256_bytes(evidence["ignoredBuild"]),
        "untrackedBuildShadowNulBytes": len(evidence["untrackedBuild"]),
        "untrackedBuildShadowNulSha256": sha256_bytes(evidence["untrackedBuild"]),
        "protections": evidence["protections"],
        "verifiedAt": now,
        "verifiedBy": "TRUSTED_HRM013_SHARED_CONTRACT_WORKTREE_CHECK",
    }
    atomic_emit_json(RECEIPT_PATH, receipt)
    validate_receipt(v, carrier, authority_bytes)


def validate_receipt(
    v: Verifier, carrier: str, authority_bytes: bytes
) -> tuple[bytes, datetime]:
    receipt_bytes, _ = safe_read_receipt(RECEIPT_PATH, "clean-worktree receipt")
    receipt = load_json_bytes(receipt_bytes, "clean-worktree receipt")
    expected_keys = {
        "schema",
        "state",
        "authorityCarrierCommit",
        "authorityCarrierTree",
        "authorityCarrierCommittedAt",
        "authorityCarrierPushObservedAt",
        "authorityArtifact",
        "repository",
        "repositoryRoot",
        "repositoryRealRoot",
        "worktree",
        "worktreeRealRoot",
        "branch",
        "baseCommit",
        "baseTree",
        "head",
        "tree",
        "originDwpDevAtMaterialization",
        "upstreamAtMaterialization",
        "remoteBranchPresentAtMaterialization",
        "statusPorcelainV2Bytes",
        "statusPorcelainV2Sha256",
        "ignoredSourceTestShadowNulBytes",
        "ignoredSourceTestShadowNulSha256",
        "untrackedSourceTestShadowNulBytes",
        "untrackedSourceTestShadowNulSha256",
        "ignoredBuildShadowNulBytes",
        "ignoredBuildShadowNulSha256",
        "untrackedBuildShadowNulBytes",
        "untrackedBuildShadowNulSha256",
        "protections",
        "verifiedAt",
        "verifiedBy",
    }
    check_closed_keys(v, receipt, expected_keys, "clean-worktree receipt")
    v.require(receipt.get("schema") == "dwp.hris.wave7.hrm013-shared-contract-clean-worktree-receipt.v1", "receipt schema drift")
    v.require(receipt.get("state") == "HASH_BOUND_FRESH_CLEAN_SHARED_CONTRACT_WORKTREE_RECEIPT", "receipt state drift")
    v.require(receipt.get("authorityCarrierCommit") == carrier, "receipt carrier commit drift")
    carrier_tree = git_text(FRONTEND, "rev-parse", f"{carrier}^{{tree}}")
    v.require(receipt.get("authorityCarrierTree") == carrier_tree, "receipt carrier tree drift")
    carrier_committed_raw = git_text(FRONTEND, "show", "-s", "--format=%cI", carrier)
    carrier_committed_at = parse_rfc3339_seconds(
        receipt.get("authorityCarrierCommittedAt"),
        "clean receipt authorityCarrierCommittedAt",
    )
    v.require(
        carrier_committed_at
        == parse_rfc3339_seconds(carrier_committed_raw, "carrier Git committer timestamp"),
        "clean receipt carrier committed timestamp drift",
    )
    push_observed_at = parse_rfc3339_seconds(
        receipt.get("authorityCarrierPushObservedAt"),
        "clean receipt authorityCarrierPushObservedAt",
    )
    artifact = receipt.get("authorityArtifact")
    check_closed_keys(v, artifact, {"path", "bytes", "sha256"}, "receipt authorityArtifact")
    v.exact(
        artifact,
        {"path": AUTHORITY_REL, "bytes": len(authority_bytes), "sha256": sha256_bytes(authority_bytes)},
        "receipt authority artifact pin drift",
    )
    fixed = {
        "repository": "dwp-backend",
        "repositoryRoot": str(BACKEND),
        "repositoryRealRoot": str(BACKEND.resolve()),
        "worktree": str(SHARED_WORKTREE),
        "worktreeRealRoot": str(SHARED_WORKTREE),
        "branch": SHARED_BRANCH,
        "baseCommit": BACKEND_BASE,
        "baseTree": BACKEND_TREE,
        "head": BACKEND_BASE,
        "tree": BACKEND_TREE,
        "originDwpDevAtMaterialization": BACKEND_BASE,
        "upstreamAtMaterialization": None,
        "remoteBranchPresentAtMaterialization": False,
        "statusPorcelainV2Bytes": 0,
        "statusPorcelainV2Sha256": sha256_bytes(b""),
        "ignoredSourceTestShadowNulBytes": 0,
        "ignoredSourceTestShadowNulSha256": sha256_bytes(b""),
        "untrackedSourceTestShadowNulBytes": 0,
        "untrackedSourceTestShadowNulSha256": sha256_bytes(b""),
        "ignoredBuildShadowNulBytes": 0,
        "ignoredBuildShadowNulSha256": sha256_bytes(b""),
        "untrackedBuildShadowNulBytes": 0,
        "untrackedBuildShadowNulSha256": sha256_bytes(b""),
        "protections": {
            "assumeUnchangedPaths": [],
            "skipWorktreePaths": [],
            "sparseCheckoutEnabled": False,
            "fsmonitorConfigured": False,
            "diffExternalConfigured": False,
            "unsafeGitConfigEntries": [],
            "unsafeGitConfigNulBytes": 0,
            "unsafeGitConfigNulSha256": sha256_bytes(b""),
            "graftFilePresent": False,
            "replaceRefs": [],
            "repositoryOrWorktreePathSymlinks": [],
            "authorizedSourceOrTestPathSymlinks": [],
        },
        "verifiedBy": "TRUSTED_HRM013_SHARED_CONTRACT_WORKTREE_CHECK",
    }
    v.exact(
        {key: receipt.get(key) for key in fixed},
        fixed,
        "receipt fixed evidence drift",
    )
    check_closed_keys(
        v,
        receipt.get("protections"),
        {
            "assumeUnchangedPaths",
            "skipWorktreePaths",
            "sparseCheckoutEnabled",
            "fsmonitorConfigured",
            "diffExternalConfigured",
            "unsafeGitConfigEntries",
            "unsafeGitConfigNulBytes",
            "unsafeGitConfigNulSha256",
            "graftFilePresent",
            "replaceRefs",
            "repositoryOrWorktreePathSymlinks",
            "authorizedSourceOrTestPathSymlinks",
        },
        "receipt protections",
    )
    verified_at = parse_rfc3339_seconds(receipt.get("verifiedAt"), "clean receipt verifiedAt")
    require_not_future(v, push_observed_at, "clean receipt authorityCarrierPushObservedAt")
    require_not_future(v, verified_at, "clean receipt verifiedAt")
    require_causal_order(
        v,
        [
            ("authority carrier committedAt", carrier_committed_at),
            ("authority carrier pushObservedAt", push_observed_at),
            ("clean receipt verifiedAt", verified_at),
        ],
    )
    return receipt_bytes, verified_at


def authority_artifact_pin(authority_bytes: bytes) -> dict[str, Any]:
    return {
        "path": AUTHORITY_REL,
        "bytes": len(authority_bytes),
        "sha256": sha256_bytes(authority_bytes),
    }


def gradle_user_home_for(tested_commit: str) -> Path:
    if re.fullmatch(r"[0-9a-f]{40}", tested_commit) is None:
        raise VerificationError("tested commit is not a lowercase 40-hex object ID")
    return GRADLE_USER_HOME_ROOT / tested_commit


def validate_targeted_verification_receipt(
    v: Verifier,
    carrier: str,
    authority_bytes: bytes,
    lane_commit: str,
    lane_tree: str,
    live_gradle_inventory: bytes | None = None,
) -> tuple[bytes, datetime]:
    clean_receipt_bytes, clean_verified_at = validate_receipt(
        v, carrier, authority_bytes
    )
    receipt_bytes, _ = safe_read_receipt(
        TARGETED_RECEIPT_PATH, "targeted verification receipt"
    )
    receipt = load_json_bytes(receipt_bytes, "targeted verification receipt")
    keys = {
        "schema", "state", "authorityCarrierCommit", "authorityCarrierTree", "authorityArtifact",
        "cleanWorktreeReceiptSha256", "repository", "branch", "baseCommit",
        "baseTree", "testedCommit", "testedTree", "changedPaths",
        "gradleSubprocessEnvironment", "gradleUserHomePath",
        "gradleUserHomeInitialNulBytes", "gradleUserHomeInitialNulSha256",
        "gradleUserHomeFinalInventorySha256",
        "compileExecutable", "compileArgv", "compileExitCode", "testExecutable",
        "testArgv", "testExitCode", "securityCriteria", "verifiedAt", "verifiedBy",
    }
    check_closed_keys(v, receipt, keys, "targeted verification receipt")
    test_argv: list[str] = [":dwp-platform-contracts:test", "--no-daemon"]
    for fqcn in TEST_FQCNS:
        test_argv.extend(["--tests", fqcn])
    gradle_user_home = gradle_user_home_for(lane_commit)
    gradle_environment = dict(GRADLE_BASE_ENV)
    gradle_environment["GRADLE_USER_HOME"] = str(gradle_user_home)
    expected_fixed = {
        "schema": "dwp.hris.wave7.hrm013-shared-contract-targeted-verification-receipt.v1",
        "state": "TRUSTED_RUNNER_EXACT_COMMITTED_TREE_TARGETED_COMPILE_AND_FIVE_TESTS_PASS",
        "authorityCarrierCommit": carrier,
        "authorityCarrierTree": git_text(FRONTEND, "rev-parse", f"{carrier}^{{tree}}"),
        "authorityArtifact": authority_artifact_pin(authority_bytes),
        "cleanWorktreeReceiptSha256": sha256_bytes(clean_receipt_bytes),
        "repository": "dwp-backend",
        "branch": SHARED_BRANCH,
        "baseCommit": BACKEND_BASE,
        "baseTree": BACKEND_TREE,
        "testedCommit": lane_commit,
        "testedTree": lane_tree,
        "changedPaths": AUTHORIZED_BACKEND_PATHS,
        "gradleSubprocessEnvironment": gradle_environment,
        "gradleUserHomePath": str(gradle_user_home),
        "gradleUserHomeInitialNulBytes": 0,
        "gradleUserHomeInitialNulSha256": sha256_bytes(b""),
        "compileExecutable": "./gradlew",
        "compileArgv": [":dwp-platform-contracts:compileJava", "--no-daemon"],
        "compileExitCode": 0,
        "testExecutable": "./gradlew",
        "testArgv": test_argv,
        "testExitCode": 0,
        "verifiedBy": "TRUSTED_HRM013_SHARED_CONTRACT_TARGETED_VERIFICATION",
    }
    v.exact(
        {key: receipt.get(key) for key in expected_fixed},
        expected_fixed,
        "targeted verification fixed evidence drift",
    )
    final_inventory_sha = receipt.get("gradleUserHomeFinalInventorySha256")
    v.require(
        type(final_inventory_sha) is str
        and re.fullmatch(r"[0-9a-f]{64}", final_inventory_sha) is not None,
        "targeted receipt final Gradle inventory digest is invalid",
    )
    if live_gradle_inventory is not None:
        v.require(
            final_inventory_sha == sha256_bytes(live_gradle_inventory),
            "targeted receipt final Gradle inventory digest drift",
        )
    check_closed_keys(v, receipt.get("authorityArtifact"), {"path", "bytes", "sha256"}, "targeted receipt authorityArtifact")
    expected_criteria = {
        criterion: {"status": "PASS", "fqcnFilters": filters}
        for criterion, filters in expected_security_mapping().items()
    }
    criteria = receipt.get("securityCriteria")
    check_closed_keys(v, criteria, set(expected_criteria), "targeted receipt securityCriteria")
    if isinstance(criteria, dict):
        for criterion, value in criteria.items():
            check_closed_keys(v, value, {"status", "fqcnFilters"}, f"security criterion {criterion}")
    v.exact(criteria, expected_criteria, "targeted security criterion evidence drift")
    verified_at = parse_rfc3339_seconds(receipt.get("verifiedAt"), "targeted receipt verifiedAt")
    lane_committed_at = parse_rfc3339_seconds(
        git_text(SHARED_WORKTREE if SHARED_WORKTREE.exists() else BACKEND, "show", "-s", "--format=%cI", lane_commit),
        "shared lane Git committer timestamp",
    )
    require_not_future(v, verified_at, "targeted receipt verifiedAt")
    require_causal_order(
        v,
        [
            ("clean receipt verifiedAt", clean_verified_at),
            ("shared lane committedAt", lane_committed_at),
            ("targeted receipt verifiedAt", verified_at),
        ],
    )
    return receipt_bytes, verified_at


def validate_post_implementation_review(
    v: Verifier,
    carrier: str,
    authority_bytes: bytes,
    lane_commit: str,
    lane_tree: str,
    targeted_receipt_bytes: bytes,
    targeted_verified_at: datetime,
) -> datetime:
    review_bytes, _ = safe_read_receipt(
        POST_REVIEW_RECEIPT_PATH, "post-implementation review receipt"
    )
    review = load_json_bytes(review_bytes, "post-implementation review receipt")
    keys = {
        "schema", "state", "authorityCarrierCommit", "authorityCarrierTree", "authorityArtifact",
        "cleanWorktreeReceiptSha256", "targetedVerificationReceiptSha256",
        "laneCommit", "laneTree", "p0", "p1", "p2", "decision",
        "reviewedAt", "reviewedBy",
    }
    check_closed_keys(v, review, keys, "post-implementation review receipt")
    expected = {
        "schema": "dwp.hris.wave7.hrm013-shared-contract-post-implementation-review.v1",
        "state": "INDEPENDENTLY_REVIEWED_EXACT_TESTED_SHARED_CONTRACT_TREE_BRANCH_PUSH_ONLY",
        "authorityCarrierCommit": carrier,
        "authorityCarrierTree": git_text(FRONTEND, "rev-parse", f"{carrier}^{{tree}}"),
        "authorityArtifact": authority_artifact_pin(authority_bytes),
        "cleanWorktreeReceiptSha256": sha256_bytes(
            safe_read_receipt(RECEIPT_PATH, "clean-worktree receipt")[0]
        ),
        "targetedVerificationReceiptSha256": sha256_bytes(targeted_receipt_bytes),
        "laneCommit": lane_commit,
        "laneTree": lane_tree,
        "p0": 0,
        "p1": 0,
        "p2": 0,
        "decision": "GO_FOR_SHARED_CONTRACT_LANE_BRANCH_PUSH_ONLY",
        "reviewedBy": "INDEPENDENT_HRM013_SHARED_CONTRACT_POST_IMPLEMENTATION_REVIEW",
    }
    v.exact(
        {key: review.get(key) for key in expected},
        expected,
        "post-implementation review evidence drift",
    )
    check_closed_keys(v, review.get("authorityArtifact"), {"path", "bytes", "sha256"}, "post-review authorityArtifact")
    reviewed_at = parse_rfc3339_seconds(review.get("reviewedAt"), "post-review reviewedAt")
    require_not_future(v, reviewed_at, "post-review reviewedAt")
    require_causal_order(
        v,
        [
            ("targeted receipt verifiedAt", targeted_verified_at),
            ("post-implementation reviewedAt", reviewed_at),
        ],
    )
    return reviewed_at


def require_exact_local_lane_commit(v: Verifier) -> tuple[str, str]:
    require_primary_backend_base(v)
    v.require(SHARED_WORKTREE.exists(), "shared worktree is missing")
    check_git_hygiene(v, SHARED_WORKTREE, SHARED_WORKTREE)
    v.require(git_text(SHARED_WORKTREE, "branch", "--show-current") == SHARED_BRANCH, "shared branch drift")
    lane_commit = git_text(SHARED_WORKTREE, "rev-parse", "HEAD")
    parents = git_text(SHARED_WORKTREE, "rev-list", "--parents", "-n", "1", lane_commit).split()
    v.exact(parents, [lane_commit, BACKEND_BASE], "lane commit must be the non-merge direct child of base")
    changed = branch_diff_paths(SHARED_WORKTREE, BACKEND_BASE, lane_commit)
    v.require(changed == set(AUTHORIZED_BACKEND_PATHS), "lane commit path set drift")
    v.require(not porcelain_v2(SHARED_WORKTREE), "lane worktree must be clean")
    remote = git(BACKEND, "rev-parse", "--verify", f"refs/remotes/origin/{SHARED_BRANCH}", check=False)
    v.require(remote.returncode != 0, "targeted verification must occur before shared branch push")
    for path in AUTHORIZED_BACKEND_PATHS:
        v.require(git_tree_mode(SHARED_WORKTREE, lane_commit, path) == "100644", f"lane path mode drift: {path}")
        v.require(symlink_free_path(SHARED_WORKTREE, path), f"lane path missing or symlinked: {path}")
    v.require(
        git_tree_mode(SHARED_WORKTREE, lane_commit, "gradlew") == "100755"
        and symlink_free_path(SHARED_WORKTREE, "gradlew")
        and (SHARED_WORKTREE / "gradlew").is_file()
        and not (SHARED_WORKTREE / "gradlew").is_symlink(),
        "targeted Gradle executable is not the tracked regular mode-100755 wrapper",
    )
    v.require(not raw_shadow_inventory(SHARED_WORKTREE, ignored=True, roots=SOURCE_SHADOW_ROOTS), "ignored platform-contracts source shadow exists")
    v.require(not raw_shadow_inventory(SHARED_WORKTREE, ignored=False, roots=SOURCE_SHADOW_ROOTS), "untracked platform-contracts source shadow exists")
    v.require(not raw_shadow_inventory(SHARED_WORKTREE, ignored=True, roots=BUILD_SHADOW_ROOTS), "ignored build shadow exists before targeted verification")
    v.require(not raw_shadow_inventory(SHARED_WORKTREE, ignored=False, roots=BUILD_SHADOW_ROOTS), "untracked build shadow exists before targeted verification")
    lane_tree = git_text(SHARED_WORKTREE, "rev-parse", f"{lane_commit}^{{tree}}")
    return lane_commit, lane_tree


GRADLE_HOME_ALLOWED_TOP_LEVEL = {
    ".tmp",
    "caches",
    "daemon",
    "jdks",
    "native",
    "notifications",
    "workers",
    "wrapper",
}


def prepare_fresh_gradle_user_home(gradle_user_home: Path) -> None:
    if gradle_user_home.parent != GRADLE_USER_HOME_ROOT:
        raise VerificationError("Gradle user home escaped its sealed per-commit root")
    parent_fd = open_real_directory(GRADLE_USER_HOME_ROOT, create=True)
    child_fd = -1
    try:
        try:
            os.mkdir(gradle_user_home.name, 0o700, dir_fd=parent_fd)
        except FileExistsError as exc:
            raise VerificationError(
                f"single-use Gradle user home already exists: {gradle_user_home}"
            ) from exc
        child_fd = os.open(
            gradle_user_home.name,
            os.O_RDONLY
            | getattr(os, "O_DIRECTORY", 0)
            | getattr(os, "O_NOFOLLOW", 0),
            dir_fd=parent_fd,
        )
        metadata = os.fstat(child_fd)
        if (
            not stat.S_ISDIR(metadata.st_mode)
            or stat.S_IMODE(metadata.st_mode) != 0o700
            or metadata.st_uid != os.geteuid()
            or os.listdir(child_fd)
        ):
            raise VerificationError(
                "new Gradle user home is not an empty current-user mode-0700 directory"
            )
        os.fsync(parent_fd)
    finally:
        if child_fd >= 0:
            os.close(child_fd)
        os.close(parent_fd)


def _gradle_inventory(directory_fd: int, prefix: str = "") -> list[bytes]:
    records: list[bytes] = []
    directory_flags = (
        os.O_RDONLY
        | getattr(os, "O_DIRECTORY", 0)
        | getattr(os, "O_NOFOLLOW", 0)
    )
    for name in sorted(os.listdir(directory_fd)):
        relative = f"{prefix}/{name}" if prefix else name
        metadata = os.stat(name, dir_fd=directory_fd, follow_symlinks=False)
        if stat.S_ISLNK(metadata.st_mode):
            raise VerificationError(f"Gradle user-home symlink is forbidden: {relative}")
        if stat.S_ISDIR(metadata.st_mode):
            child_fd = os.open(name, directory_flags, dir_fd=directory_fd)
            try:
                opened = os.fstat(child_fd)
                if (opened.st_dev, opened.st_ino) != (metadata.st_dev, metadata.st_ino):
                    raise VerificationError(
                        f"Gradle directory changed while being inspected: {relative}"
                    )
                records.append(b"D\t" + relative.encode("utf-8") + b"\0")
                records.extend(_gradle_inventory(child_fd, relative))
            finally:
                os.close(child_fd)
        elif stat.S_ISREG(metadata.st_mode):
            file_fd = os.open(
                name,
                os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0),
                dir_fd=directory_fd,
            )
            try:
                opened = os.fstat(file_fd)
                if (opened.st_dev, opened.st_ino) != (metadata.st_dev, metadata.st_ino):
                    raise VerificationError(
                        f"Gradle file changed while being inspected: {relative}"
                    )
            finally:
                os.close(file_fd)
            records.append(b"F\t" + relative.encode("utf-8") + b"\0")
        else:
            raise VerificationError(
                f"Gradle user-home special file is forbidden: {relative}"
            )
    return records


def validate_gradle_user_home(
    gradle_user_home: Path, *, require_empty: bool
) -> bytes:
    if gradle_user_home.parent != GRADLE_USER_HOME_ROOT:
        raise VerificationError("Gradle user home escaped its sealed per-commit root")
    directory_fd = open_real_directory(gradle_user_home, create=False)
    try:
        metadata = os.fstat(directory_fd)
        if (
            not stat.S_ISDIR(metadata.st_mode)
            or stat.S_IMODE(metadata.st_mode) != 0o700
            or metadata.st_uid != os.geteuid()
        ):
            raise VerificationError(
                "controlled Gradle user home must be a current-user mode-0700 directory"
            )
        top_level = sorted(os.listdir(directory_fd))
        if require_empty and top_level:
            raise VerificationError(
                "controlled Gradle user home must be empty before compile"
            )
        forbidden = sorted(
            set(top_level)
            & {"init.gradle", "init.gradle.kts", "init.d", "gradle.properties"}
        )
        if forbidden:
            raise VerificationError(
                f"forbidden Gradle user-home configuration exists: {forbidden}"
            )
        unexpected = sorted(set(top_level) - GRADLE_HOME_ALLOWED_TOP_LEVEL)
        if unexpected:
            raise VerificationError(
                f"undeclared Gradle user-home entries: {unexpected}"
            )
        return b"".join(_gradle_inventory(directory_fd))
    finally:
        os.close(directory_fd)


def controlled_gradle_environment(gradle_user_home: Path) -> dict[str, str]:
    gradle_environment = dict(GRADLE_BASE_ENV)
    gradle_environment["GRADLE_USER_HOME"] = str(gradle_user_home)
    expected_environment = dict(GRADLE_BASE_ENV)
    expected_environment["GRADLE_USER_HOME"] = str(gradle_user_home)
    if not strict_typed_equal(gradle_environment, expected_environment):
        raise VerificationError("Gradle subprocess environment drift")
    return gradle_environment


def run_exact_gradle(argv: list[str], environment: dict[str, str]) -> int:
    result = subprocess.run(
        ["./gradlew", *argv],
        cwd=SHARED_WORKTREE,
        env=environment,
        shell=False,
        check=False,
        timeout=1200,
    )
    return result.returncode


def run_targeted_verification(
    v: Verifier, carrier: str, authority_bytes: bytes
) -> None:
    lane_commit, lane_tree = require_exact_local_lane_commit(v)
    clean_receipt_bytes, _ = validate_receipt(v, carrier, authority_bytes)
    v.require(not TARGETED_RECEIPT_PATH.exists() and not TARGETED_RECEIPT_PATH.is_symlink(), "targeted receipt overwrite forbidden")
    v.require(not POST_REVIEW_RECEIPT_PATH.exists() and not POST_REVIEW_RECEIPT_PATH.is_symlink(), "post-review receipt was pre-seeded before targeted verification")
    v.require(not CENTRAL_RECEIPT_PATH.exists() and not CENTRAL_RECEIPT_PATH.is_symlink(), "central receipt was pre-seeded before targeted verification")
    compile_argv = [":dwp-platform-contracts:compileJava", "--no-daemon"]
    test_argv: list[str] = [":dwp-platform-contracts:test", "--no-daemon"]
    for fqcn in TEST_FQCNS:
        test_argv.extend(["--tests", fqcn])
    gradle_user_home = gradle_user_home_for(lane_commit)
    prepare_fresh_gradle_user_home(gradle_user_home)
    initial_gradle_inventory = validate_gradle_user_home(
        gradle_user_home, require_empty=True
    )
    gradle_environment = controlled_gradle_environment(gradle_user_home)
    compile_exit = run_exact_gradle(compile_argv, gradle_environment)
    v.require(compile_exit == 0, "targeted shared-contract compile failed")
    v.require(git_text(SHARED_WORKTREE, "rev-parse", "HEAD") == lane_commit, "lane commit changed during compile")
    v.require(git_text(SHARED_WORKTREE, "rev-parse", "HEAD^{tree}") == lane_tree, "lane tree changed during compile")
    v.require(not porcelain_v2(SHARED_WORKTREE), "lane worktree changed during compile")
    validate_gradle_user_home(gradle_user_home, require_empty=False)
    test_exit = run_exact_gradle(test_argv, gradle_environment)
    v.require(test_exit == 0, "targeted shared-contract tests failed")
    v.require(git_text(SHARED_WORKTREE, "rev-parse", "HEAD") == lane_commit, "lane commit changed during tests")
    v.require(git_text(SHARED_WORKTREE, "rev-parse", "HEAD^{tree}") == lane_tree, "lane tree changed during tests")
    v.require(not porcelain_v2(SHARED_WORKTREE), "lane worktree changed during tests")
    v.require(not raw_shadow_inventory(SHARED_WORKTREE, ignored=True, roots=SOURCE_SHADOW_ROOTS), "ignored source shadow appeared during tests")
    v.require(not raw_shadow_inventory(SHARED_WORKTREE, ignored=False, roots=SOURCE_SHADOW_ROOTS), "untracked source shadow appeared during tests")
    final_gradle_inventory = validate_gradle_user_home(
        gradle_user_home, require_empty=False
    )
    security = {
        criterion: {"status": "PASS", "fqcnFilters": filters}
        for criterion, filters in expected_security_mapping().items()
    }
    receipt = {
        "schema": "dwp.hris.wave7.hrm013-shared-contract-targeted-verification-receipt.v1",
        "state": "TRUSTED_RUNNER_EXACT_COMMITTED_TREE_TARGETED_COMPILE_AND_FIVE_TESTS_PASS",
        "authorityCarrierCommit": carrier,
        "authorityCarrierTree": git_text(FRONTEND, "rev-parse", f"{carrier}^{{tree}}"),
        "authorityArtifact": authority_artifact_pin(authority_bytes),
        "cleanWorktreeReceiptSha256": sha256_bytes(clean_receipt_bytes),
        "repository": "dwp-backend",
        "branch": SHARED_BRANCH,
        "baseCommit": BACKEND_BASE,
        "baseTree": BACKEND_TREE,
        "testedCommit": lane_commit,
        "testedTree": lane_tree,
        "changedPaths": AUTHORIZED_BACKEND_PATHS,
        "gradleSubprocessEnvironment": gradle_environment,
        "gradleUserHomePath": str(gradle_user_home),
        "gradleUserHomeInitialNulBytes": len(initial_gradle_inventory),
        "gradleUserHomeInitialNulSha256": sha256_bytes(initial_gradle_inventory),
        "gradleUserHomeFinalInventorySha256": sha256_bytes(final_gradle_inventory),
        "compileExecutable": "./gradlew",
        "compileArgv": compile_argv,
        "compileExitCode": compile_exit,
        "testExecutable": "./gradlew",
        "testArgv": test_argv,
        "testExitCode": test_exit,
        "securityCriteria": security,
        "verifiedAt": utc_now_seconds(),
        "verifiedBy": "TRUSTED_HRM013_SHARED_CONTRACT_TARGETED_VERIFICATION",
    }
    atomic_emit_json(TARGETED_RECEIPT_PATH, receipt)
    validate_targeted_verification_receipt(
        v,
        carrier,
        authority_bytes,
        lane_commit,
        lane_tree,
        live_gradle_inventory=final_gradle_inventory,
    )


def branch_diff_paths(repo: Path, older: str, newer: str) -> set[str]:
    if older == newer:
        return set()
    return set(git_text(repo, "diff", "--name-only", f"{older}..{newer}", "--").splitlines())


def require_clean_receipt_predates_authored_paths(
    v: Verifier, repo: Path, clean_verified_at: datetime
) -> None:
    tolerance = timedelta(seconds=2)
    for relative in AUTHORIZED_BACKEND_PATHS:
        path = repo / relative
        if not path.exists():
            continue
        modified_at = datetime.fromtimestamp(path.stat().st_mtime, timezone.utc)
        v.require(
            modified_at + tolerance >= clean_verified_at,
            f"authorized path predates its claimed clean-worktree receipt: {relative}",
        )


def check_existing_authorized_paths_are_regular(v: Verifier, repo: Path) -> None:
    for relative in AUTHORIZED_BACKEND_PATHS:
        path = repo / relative
        if not path.exists() and not path.is_symlink():
            continue
        v.require(
            symlink_free_path(repo, relative)
            and path.is_file()
            and not path.is_symlink(),
            f"authorized source/test path is not a regular symlink-free file: {relative}",
        )


def current_validator_paths() -> list[str]:
    package = load_json_file(FRONTEND / "package.json", "current package.json")
    script = package.get("scripts", {}).get("hris:current-contracts:check", "")
    pattern = re.compile(
        r"python3 (docs/06-delivery/hris/[A-Za-z0-9._/-]+/validate_[A-Za-z0-9_]+\.py)"
    )
    paths: list[str] = []
    for part in script.split(" && "):
        match = pattern.fullmatch(part)
        if match is None:
            raise VerificationError("current validator lifecycle contains a non-validator command")
        paths.append(match.group(1))
    return paths


def discover_shared_lane_commit(v: Verifier, backend_head: str) -> str:
    add_commits: list[str] = []
    for path in AUTHORIZED_BACKEND_PATHS:
        commits = [
            line
            for line in git_text(
                BACKEND,
                "log",
                "--diff-filter=A",
                "--format=%H",
                f"{BACKEND_BASE}..{backend_head}",
                "--",
                path,
            ).splitlines()
            if line
        ]
        v.require(len(commits) == 1, f"shared path add commit missing or ambiguous: {path}")
        add_commits.extend(commits)
    v.require(len(set(add_commits)) == 1, "eleven shared paths were not introduced together")
    lane_commit = add_commits[0]
    parents = git_text(BACKEND, "rev-list", "--parents", "-n", "1", lane_commit).split()
    v.exact(parents, [lane_commit, BACKEND_BASE], "shared lane commit is not the direct non-merge child of base")
    changed = branch_diff_paths(BACKEND, BACKEND_BASE, lane_commit)
    v.require(changed == set(AUTHORIZED_BACKEND_PATHS), "shared lane commit path set drift")
    v.require(is_ancestor(BACKEND, lane_commit, backend_head), "shared lane commit is not an ancestor of backend HEAD")
    for path in AUTHORIZED_BACKEND_PATHS:
        v.require(git_tree_mode(BACKEND, lane_commit, path) == "100644", f"shared lane blob mode drift: {path}")
        if backend_head == lane_commit:
            v.require(
                symlink_free_path(BACKEND, path)
                and (BACKEND / path).is_file()
                and not (BACKEND / path).is_symlink(),
                f"shared lane integration path is not regular and symlink-free: {path}",
            )
            v.require(
                git_blob_digest(BACKEND, lane_commit, path)
                == git_blob_digest(BACKEND, backend_head, path),
                f"shared lane blob drift at integration: {path}",
            )
    return lane_commit


def git_artifact_pin(repo: Path, revision: str, path: str) -> dict[str, Any]:
    blob = git_blob(repo, revision, path)
    if blob is None:
        raise VerificationError(f"artifact blob is missing at {revision}: {path}")
    return {"path": path, "bytes": len(blob), "sha256": sha256_bytes(blob)}


def expected_later_package_bytes(parent_commit: str) -> bytes:
    predecessor = git_blob(FRONTEND, parent_commit, "package.json")
    if predecessor is None:
        raise VerificationError("later carrier predecessor package.json is missing")
    predecessor_json = load_json_bytes(
        predecessor, "later carrier predecessor package.json"
    )
    scripts = predecessor_json.get("scripts")
    if not isinstance(scripts, dict):
        raise VerificationError("later carrier predecessor scripts are missing")
    if scripts.get("hris:current-contracts:check") != NEW_SCRIPT:
        raise VerificationError(
            "later carrier predecessor does not end at this fifth validator"
        )
    later_script = NEW_SCRIPT + " && python3 " + LATER_VALIDATOR_REL
    old_encoded = json.dumps(NEW_SCRIPT, ensure_ascii=False).encode("utf-8")[1:-1]
    new_encoded = json.dumps(later_script, ensure_ascii=False).encode("utf-8")[1:-1]
    if predecessor.count(old_encoded) != 1:
        raise VerificationError(
            "later carrier predecessor script bytes are missing or ambiguous"
        )
    return predecessor.replace(old_encoded, new_encoded, 1)


def validate_later_authority_and_review(
    v: Verifier,
    *,
    shared_carrier: str,
    later_commit: str,
    later_parent: str,
    lane_commit: str,
    lane_tree: str,
    targeted_receipt_bytes: bytes,
    post_review_bytes: bytes,
) -> None:
    authority_blob = git_blob(FRONTEND, later_commit, LATER_AUTHORITY_REL) or b""
    review_blob = git_blob(FRONTEND, later_commit, LATER_REVIEW_REL) or b""
    package_blob = git_blob(FRONTEND, later_commit, "package.json") or b""
    validator_blob = git_blob(FRONTEND, later_commit, LATER_VALIDATOR_REL) or b""
    authority = load_json_bytes(authority_blob, "later central-integration authority")
    review = load_json_bytes(review_blob, "later central-integration independent review")
    check_closed_keys(v, authority, LATER_AUTHORITY_TOP_KEYS, "later authority")
    v.exact(
        {key: authority.get(key) for key in ("schema", "state", "lane")},
        {
            "schema": "dwp.hris.wave7.hrm013-shared-contract-central-integration-authority.v1",
            "state": "INDEPENDENTLY_REVIEWED_HASH_BOUND_SHARED_CONTRACT_FAST_FORWARD_INTEGRATION_AUTHORITY",
            "lane": "SHARED_CONTRACT_CENTRAL_INTEGRATION",
        },
        "later authority identity drift",
    )
    predecessor = authority.get("predecessorCarrier")
    check_closed_keys(
        v,
        predecessor,
        {"repository", "branch", "commit", "tree", "artifactPins"},
        "later authority predecessorCarrier",
    )
    expected_predecessor_pins = [
        git_artifact_pin(FRONTEND, shared_carrier, AUTHORITY_REL),
        git_artifact_pin(FRONTEND, shared_carrier, VALIDATOR_REL),
    ]
    if isinstance(predecessor, dict):
        v.exact(
            {key: predecessor.get(key) for key in ("repository", "branch", "commit", "tree")},
            {
                "repository": "dwp-frontend",
                "branch": "dwp-dev",
                "commit": shared_carrier,
                "tree": git_text(FRONTEND, "rev-parse", f"{shared_carrier}^{{tree}}"),
            },
            "later authority predecessor carrier drift",
        )
        v.exact(
            predecessor.get("artifactPins"),
            expected_predecessor_pins,
            "later authority predecessor artifact pins drift",
        )
        pins = predecessor.get("artifactPins")
        if isinstance(pins, list):
            for index, pin in enumerate(pins):
                check_closed_keys(
                    v,
                    pin,
                    {"path", "bytes", "sha256"},
                    f"later predecessor pin {index}",
                )
    shared_evidence = authority.get("sharedLaneEvidence")
    check_closed_keys(
        v,
        shared_evidence,
        {
            "repository", "branch", "baseCommit", "baseTree", "laneCommit",
            "laneTree", "changedPaths", "targetedVerificationReceiptSha256",
            "postImplementationReviewReceiptSha256",
        },
        "later authority sharedLaneEvidence",
    )
    v.exact(
        shared_evidence,
        {
            "repository": "dwp-backend",
            "branch": SHARED_BRANCH,
            "baseCommit": BACKEND_BASE,
            "baseTree": BACKEND_TREE,
            "laneCommit": lane_commit,
            "laneTree": lane_tree,
            "changedPaths": AUTHORIZED_BACKEND_PATHS,
            "targetedVerificationReceiptSha256": sha256_bytes(targeted_receipt_bytes),
            "postImplementationReviewReceiptSha256": sha256_bytes(post_review_bytes),
        },
        "later authority shared-lane evidence drift",
    )
    central_boundary = authority.get("centralIntegrationBoundary")
    check_closed_keys(
        v,
        central_boundary,
        {
            "receiptPath", "receiptSchema", "receiptState", "requiredDecision",
            "integrationMode", "externalAttestationRequired",
            "directDwpDevMergeAuthorizedBeforeExternalAttestation",
        },
        "later authority centralIntegrationBoundary",
    )
    v.exact(
        central_boundary,
        {
            "receiptPath": str(CENTRAL_RECEIPT_PATH),
            "receiptSchema": "dwp.hris.wave7.hrm013-shared-contract-central-integration-authority-receipt.v1",
            "receiptState": "HASH_BOUND_ZERO_FINDING_SHARED_CONTRACT_FAST_FORWARD_INTEGRATION_AUTHORITY",
            "requiredDecision": "GO_FOR_SHARED_CONTRACT_FAST_FORWARD_DWP_DEV_INTEGRATION_ONLY",
            "integrationMode": "DIRECT_FAST_FORWARD_ONLY",
            "externalAttestationRequired": True,
            "directDwpDevMergeAuthorizedBeforeExternalAttestation": False,
        },
        "later authority central-integration boundary drift",
    )
    historical = authority.get("historicalBackendDescendantGovernance")
    check_closed_keys(
        v,
        historical,
        {
            "assumesAllHistoricalBackendDescendantGovernance",
            "governingValidatorPath", "predecessorValidatorPath",
            "oneReviewedReceiptPerBackendDescendantRequired",
            "oneOrderedFrontendGovernanceCarrierPerBackendDescendantRequired",
            "sharedElevenBlobMutationAuthorized",
        },
        "later authority historicalBackendDescendantGovernance",
    )
    v.exact(
        historical,
        {
            "assumesAllHistoricalBackendDescendantGovernance": True,
            "governingValidatorPath": LATER_VALIDATOR_REL,
            "predecessorValidatorPath": VALIDATOR_REL,
            "oneReviewedReceiptPerBackendDescendantRequired": True,
            "oneOrderedFrontendGovernanceCarrierPerBackendDescendantRequired": True,
            "sharedElevenBlobMutationAuthorized": False,
        },
        "later authority historical descendant delegation drift",
    )
    v.exact(authority.get("authority"), LATER_AUTHORITY_MAP, "later authority map drift")
    check_closed_keys(v, authority.get("authority"), set(LATER_AUTHORITY_MAP), "later authority map")

    check_closed_keys(v, review, LATER_REVIEW_TOP_KEYS, "later independent review")
    v.exact(
        {key: review.get(key) for key in ("schema", "reviewer")},
        {
            "schema": "dwp.hris.wave7.hrm013-shared-contract-central-integration-authority-independent-review.v1",
            "reviewer": "INDEPENDENT_HRM013_SHARED_CONTRACT_CENTRAL_INTEGRATION_REVIEW",
        },
        "later review identity drift",
    )
    reviewed_at = parse_rfc3339_seconds(review.get("reviewedAt"), "later review reviewedAt")
    require_not_future(v, reviewed_at, "later review reviewedAt")
    later_committed_at = parse_rfc3339_seconds(
        git_text(FRONTEND, "show", "-s", "--format=%cI", later_commit),
        "later carrier Git committer timestamp",
    )
    require_causal_order(
        v,
        [("later review reviewedAt", reviewed_at), ("later carrier committedAt", later_committed_at)],
    )
    scope = review.get("scope")
    check_closed_keys(
        v,
        scope,
        {"authorityPath", "validatorPath", "packagePath", "reviewedBoundaries"},
        "later review scope",
    )
    if isinstance(scope, dict):
        v.exact(
            {key: scope.get(key) for key in ("authorityPath", "validatorPath", "packagePath")},
            {
                "authorityPath": LATER_AUTHORITY_REL,
                "validatorPath": LATER_VALIDATOR_REL,
                "packagePath": "package.json",
            },
            "later review scope paths drift",
        )
        v.exact(
            scope.get("reviewedBoundaries"),
            [
                "CURRENT_RUNTIME_CONTRACT_AUTHORITY_AND_VALIDATOR_PINS",
                "EXACT_SHARED_LANE_COMMIT_TREE_AND_ELEVEN_PATHS",
                "TARGETED_AND_POST_IMPLEMENTATION_RECEIPT_PINS",
                "EXTERNAL_CENTRAL_INTEGRATION_ATTESTATION_REQUIRED",
                "SIXTH_VALIDATOR_HISTORICAL_DESCENDANT_GOVERNANCE_ASSUMPTION",
                "NO_SHARED_BLOB_MUTATION_RUNTIME_MIGRATION_AUTH_OR_PRODUCTION_AUTHORITY",
            ],
            "later review boundary list drift",
        )
    findings = review.get("findings")
    check_closed_keys(v, findings, {"p0", "p1", "p2", "notes"}, "later review findings")
    if isinstance(findings, dict):
        v.exact(findings.get("p0"), [], "later review P0 findings drift")
        v.exact(findings.get("p1"), [], "later review P1 findings drift")
        v.exact(findings.get("p2"), [], "later review P2 findings drift")
        v.exact(
            findings.get("notes"),
            [
                "The later carrier pins the current runtime-contract authority and validator and authorizes only externally attested direct fast-forward integration.",
                "The immutable sixth validator assumes all historical backend descendant governance using one reviewed receipt and one ordered frontend governance carrier per descendant.",
                "No shared-contract blob mutation, auth generation, migration authoring, runtime implementation or production release is authorized.",
            ],
            "later review notes drift",
        )
    v.exact(
        review.get("finalVerdict"),
        {"p0": 0, "p1": 0, "p2": 0, "decision": "GO_FOR_SHARED_CONTRACT_FAST_FORWARD_DWP_DEV_INTEGRATION_ONLY"},
        "later review verdict drift",
    )
    check_closed_keys(v, review.get("finalVerdict"), {"p0", "p1", "p2", "decision"}, "later review finalVerdict")
    v.exact(review.get("authority"), LATER_REVIEW_AUTHORITY_MAP, "later review authority map drift")
    check_closed_keys(v, review.get("authority"), set(LATER_REVIEW_AUTHORITY_MAP), "later review authority map")
    expected_review_pins = [
        git_artifact_pin(FRONTEND, later_commit, LATER_AUTHORITY_REL),
        git_artifact_pin(FRONTEND, later_commit, LATER_VALIDATOR_REL),
        git_artifact_pin(FRONTEND, later_commit, "package.json"),
    ]
    v.exact(review.get("artifactPins"), expected_review_pins, "later review artifact pins drift")
    pins = review.get("artifactPins")
    if isinstance(pins, list):
        for index, pin in enumerate(pins):
            check_closed_keys(v, pin, {"path", "bytes", "sha256"}, f"later review pin {index}")

    expected_package = expected_later_package_bytes(later_parent)
    v.require(package_blob == expected_package, "later carrier package is not the exact one-script append")
    package = load_json_bytes(package_blob, "later carrier package.json")
    scripts = package.get("scripts")
    v.require(isinstance(scripts, dict), "later carrier scripts object is missing")
    if isinstance(scripts, dict):
        v.require("prehris:current-contracts:check" not in scripts, "later carrier pre-hook is forbidden")
        v.require("posthris:current-contracts:check" not in scripts, "later carrier post-hook is forbidden")
        v.exact(
            scripts.get("hris:current-contracts:check"),
            NEW_SCRIPT + " && python3 " + LATER_VALIDATOR_REL,
            "later carrier validator append drift",
        )
    try:
        compile(validator_blob.decode("utf-8"), LATER_VALIDATOR_REL, "exec")
    except (UnicodeDecodeError, SyntaxError) as exc:
        raise VerificationError(f"later integration validator is not valid UTF-8 Python: {exc}") from exc


def discover_later_frontend_carrier(
    v: Verifier,
    shared_carrier: str,
    lane_commit: str,
    lane_tree: str,
    targeted_receipt_bytes: bytes,
    post_review_bytes: bytes,
) -> str:
    commits: list[str] = []
    for path in (LATER_AUTHORITY_REL, LATER_REVIEW_REL, LATER_VALIDATOR_REL):
        v.require(symlink_free_path(FRONTEND, path), f"later integration artifact missing or symlinked: {path}")
        add = [line for line in git_text(FRONTEND, "log", "--diff-filter=A", "--format=%H", "--", path).splitlines() if line]
        v.require(len(add) == 1, f"later integration artifact add commit missing or ambiguous: {path}")
        commits.extend(add)
    v.require(len(set(commits)) == 1, "later integration authority, review and validator were not introduced together")
    commit = commits[0]
    parents = git_text(FRONTEND, "rev-list", "--parents", "-n", "1", commit).split()
    v.require(len(parents) == 2, "later integration authority carrier must be non-merge")
    parent = parents[1]
    v.require(is_ancestor(FRONTEND, shared_carrier, commit), "later integration authority does not descend from this carrier")
    changed = branch_diff_paths(FRONTEND, parent, commit)
    v.require(changed == LATER_CARRIER_PATHS, f"later carrier path set drift: {sorted(changed ^ LATER_CARRIER_PATHS)}")
    head = git_text(FRONTEND, "rev-parse", "HEAD")
    origin = git_text(FRONTEND, "rev-parse", "origin/dwp-dev")
    v.require(is_ancestor(FRONTEND, commit, head) and is_ancestor(FRONTEND, commit, origin), "later integration authority is not pushed")
    for path in (LATER_AUTHORITY_REL, LATER_REVIEW_REL, LATER_VALIDATOR_REL, "package.json"):
        v.require(git_tree_mode(FRONTEND, commit, path) == "100644", f"later integration artifact mode drift: {path}")
        v.require(git_tree_mode(FRONTEND, head, path) == "100644", f"current later integration artifact mode drift: {path}")
        if path != "package.json":
            v.require(digest_file(FRONTEND / path) == git_blob_digest(FRONTEND, commit, path), f"later integration artifact mutated after introduction: {path}")
    paths = current_validator_paths()
    index = paths.index(VALIDATOR_REL) if VALIDATOR_REL in paths else -1
    v.require(index >= 0 and index + 1 < len(paths) and paths[index + 1] == LATER_VALIDATOR_REL, "later integration validator is not appended immediately after this validator")
    v.require(index + 2 == 6, "later integration validator is not the sixth validator")
    validate_later_authority_and_review(
        v,
        shared_carrier=shared_carrier,
        later_commit=commit,
        later_parent=parent,
        lane_commit=lane_commit,
        lane_tree=lane_tree,
        targeted_receipt_bytes=targeted_receipt_bytes,
        post_review_bytes=post_review_bytes,
    )
    return commit


def validate_central_integration_receipt(
    v: Verifier,
    shared_carrier: str,
    authority_bytes: bytes,
    lane_commit: str,
    lane_tree: str,
) -> None:
    receipt_bytes, _ = safe_read_receipt(
        CENTRAL_RECEIPT_PATH, "central integration authority receipt"
    )
    targeted_bytes, targeted_at = validate_targeted_verification_receipt(
        v, shared_carrier, authority_bytes, lane_commit, lane_tree
    )
    post_at = validate_post_implementation_review(
        v,
        shared_carrier,
        authority_bytes,
        lane_commit,
        lane_tree,
        targeted_bytes,
        targeted_at,
    )
    post_bytes = safe_read_receipt(
        POST_REVIEW_RECEIPT_PATH, "post-implementation review receipt"
    )[0]
    later_commit = discover_later_frontend_carrier(
        v,
        shared_carrier,
        lane_commit,
        lane_tree,
        targeted_bytes,
        post_bytes,
    )
    later_tree = git_text(FRONTEND, "rev-parse", f"{later_commit}^{{tree}}")
    remote_lane = git(
        BACKEND,
        "rev-parse",
        "--verify",
        f"refs/remotes/origin/{SHARED_BRANCH}",
        check=False,
    )
    v.require(
        remote_lane.returncode == 0
        and remote_lane.stdout.decode("utf-8", errors="strict").strip() == lane_commit,
        "central integration authority requires the exact pushed shared lane commit",
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
    later_authority_blob = git_blob(FRONTEND, later_commit, LATER_AUTHORITY_REL) or b""
    later_validator_blob = git_blob(FRONTEND, later_commit, LATER_VALIDATOR_REL) or b""
    later_review_blob = git_blob(FRONTEND, later_commit, LATER_REVIEW_REL) or b""
    later_package_blob = git_blob(FRONTEND, later_commit, "package.json") or b""
    later_committed_raw = git_text(
        FRONTEND, "show", "-s", "--format=%cI", later_commit
    )
    expected = {
        "schema": "dwp.hris.wave7.hrm013-shared-contract-central-integration-authority-receipt.v1",
        "state": "HASH_BOUND_ZERO_FINDING_SHARED_CONTRACT_FAST_FORWARD_INTEGRATION_AUTHORITY",
        "sharedExecutionCarrierCommit": shared_carrier,
        "sharedExecutionCarrierTree": git_text(FRONTEND, "rev-parse", f"{shared_carrier}^{{tree}}"),
        "sharedExecutionAuthorityArtifact": authority_artifact_pin(authority_bytes),
        "centralIntegrationAuthorityCarrierCommit": later_commit,
        "centralIntegrationAuthorityCarrierTree": later_tree,
        "centralIntegrationAuthorityCarrierCommittedAt": later_committed_raw,
        "centralIntegrationAuthorityArtifact": {"path": LATER_AUTHORITY_REL, "bytes": len(later_authority_blob), "sha256": sha256_bytes(later_authority_blob)},
        "centralIntegrationValidatorArtifact": {"path": LATER_VALIDATOR_REL, "bytes": len(later_validator_blob), "sha256": sha256_bytes(later_validator_blob)},
        "centralIntegrationIndependentReviewArtifact": {"path": LATER_REVIEW_REL, "bytes": len(later_review_blob), "sha256": sha256_bytes(later_review_blob)},
        "centralIntegrationPackageArtifact": {"path": "package.json", "bytes": len(later_package_blob), "sha256": sha256_bytes(later_package_blob)},
        "backendBaseCommit": BACKEND_BASE,
        "backendBaseTree": BACKEND_TREE,
        "laneCommit": lane_commit,
        "laneTree": lane_tree,
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
    v.exact({key: receipt.get(key) for key in expected}, expected, "central integration authority receipt evidence drift")
    for key in ("sharedExecutionAuthorityArtifact", "centralIntegrationAuthorityArtifact", "centralIntegrationValidatorArtifact", "centralIntegrationIndependentReviewArtifact", "centralIntegrationPackageArtifact"):
        check_closed_keys(v, receipt.get(key), {"path", "bytes", "sha256"}, f"central receipt {key}")
    later_committed_at = parse_rfc3339_seconds(
        receipt.get("centralIntegrationAuthorityCarrierCommittedAt"),
        "central receipt centralIntegrationAuthorityCarrierCommittedAt",
    )
    later_push_observed_at = parse_rfc3339_seconds(
        receipt.get("centralIntegrationAuthorityCarrierPushObservedAt"),
        "central receipt centralIntegrationAuthorityCarrierPushObservedAt",
    )
    recorded_at = parse_rfc3339_seconds(receipt.get("recordedAt"), "central receipt recordedAt")
    require_not_future(v, later_push_observed_at, "central receipt centralIntegrationAuthorityCarrierPushObservedAt")
    require_not_future(v, recorded_at, "central receipt recordedAt")
    require_causal_order(
        v,
        [
            ("post-implementation reviewedAt", post_at),
            ("later central-authority carrier committedAt", later_committed_at),
            ("later central-authority carrier pushObservedAt", later_push_observed_at),
            ("central integration recordedAt", recorded_at),
        ],
    )


def check_shared_file_content_boundary(v: Verifier, repo: Path) -> None:
    forbidden_patterns = [
        r"\bimport\s+org\.springframework\.",
        r"\bimport\s+jakarta\.persistence\.",
        r"\bimport\s+javax\.sql\.",
        r"\bimport\s+java\.net\.http\.",
        r"@(Controller|RestController|Service|Component|Configuration|Repository)\b",
        r"\b(System\.getenv|System\.getProperty)\s*\(",
    ]
    for relative in AUTHORIZED_SOURCE_PATHS:
        path = repo / relative
        if not path.exists():
            continue
        v.require(path.is_file() and not path.is_symlink(), f"authorized source is not regular: {relative}")
        text = path.read_text(encoding="utf-8")
        for pattern in forbidden_patterns:
            v.require(not re.search(pattern, text), f"runtime/framework boundary crossed in {relative}: {pattern}")


def check_backend_state(v: Verifier, carrier: str, authority_bytes: bytes, *, authoring: bool) -> str:
    check_git_hygiene(v, BACKEND, BACKEND)
    branch = git_text(BACKEND, "branch", "--show-current")
    head = git_text(BACKEND, "rev-parse", "HEAD")
    origin = git_text(BACKEND, "rev-parse", "origin/dwp-dev")
    v.require(branch == "dwp-dev", "default backend checkout must remain on dwp-dev")
    v.require(not working_changes(BACKEND), "default backend checkout must remain clean")
    v.require(git_text(BACKEND, "rev-parse", f"{BACKEND_BASE}^{{tree}}") == BACKEND_TREE, "backend base tree drift")

    worktree_exists = SHARED_WORKTREE.exists() or SHARED_WORKTREE.is_symlink()
    receipt_exists = RECEIPT_PATH.exists() or RECEIPT_PATH.is_symlink()
    targeted_receipt_exists = TARGETED_RECEIPT_PATH.exists() or TARGETED_RECEIPT_PATH.is_symlink()
    post_review_exists = POST_REVIEW_RECEIPT_PATH.exists() or POST_REVIEW_RECEIPT_PATH.is_symlink()
    central_receipt_exists = CENTRAL_RECEIPT_PATH.exists() or CENTRAL_RECEIPT_PATH.is_symlink()
    local_lane_ref_exists = (
        git(BACKEND, "rev-parse", "--verify", f"refs/heads/{SHARED_BRANCH}", check=False).returncode
        == 0
    )
    remote_lane_ref_exists = (
        git(BACKEND, "rev-parse", "--verify", f"refs/remotes/origin/{SHARED_BRANCH}", check=False).returncode
        == 0
    )
    if authoring:
        v.require(head == origin == BACKEND_BASE, "authority-carrier authoring requires untouched backend base")
        v.require(not worktree_exists, "shared backend worktree exists before carrier push")
        v.require(not receipt_exists, "clean-worktree receipt exists before carrier push")
        v.require(not targeted_receipt_exists, "targeted verification receipt exists before carrier push")
        v.require(not post_review_exists, "post-implementation review exists before carrier push")
        v.require(not central_receipt_exists, "central integration authority exists before carrier push")
        v.require(not local_lane_ref_exists and not remote_lane_ref_exists, "shared branch exists before carrier push")
        for path in AUTHORIZED_BACKEND_PATHS:
            v.require(not (BACKEND / path).exists(), f"shared source/test exists before carrier push: {path}")
        check_source_shadow(v, BACKEND, allow_authorized_untracked=False)
        return "CARRIER_AUTHORING_BACKEND_UNTOUCHED"

    integrated = head != BACKEND_BASE
    if integrated:
        v.require(head == origin, "integrated backend HEAD must equal origin/dwp-dev")
        v.require(is_ancestor(BACKEND, BACKEND_BASE, head), "integrated backend lost the pinned base")
        lane_commit = discover_shared_lane_commit(v, head)
        lane_tree = git_text(BACKEND, "rev-parse", f"{lane_commit}^{{tree}}")
        validate_central_integration_receipt(
            v, carrier, authority_bytes, lane_commit, lane_tree
        )
        check_source_shadow(v, BACKEND, allow_authorized_untracked=False)
        check_shared_file_content_boundary(v, BACKEND)
        return "SHARED_CONTRACT_HISTORY_DELEGATED_TO_REVIEWED_SIXTH_VALIDATOR"

    v.require(origin == BACKEND_BASE, "backend origin/dwp-dev moved before an exact shared integration")
    check_backend_denials(v, BACKEND)
    if not worktree_exists:
        v.require(not receipt_exists, "stale receipt exists without its exact worktree")
        v.require(not targeted_receipt_exists, "stale targeted verification receipt exists without its exact worktree")
        v.require(not post_review_exists, "stale post-review receipt exists without its exact worktree")
        v.require(not central_receipt_exists, "central integration authority exists before shared lane evidence")
        v.require(not local_lane_ref_exists and not remote_lane_ref_exists, "shared branch exists before fresh materialization")
        for path in AUTHORIZED_BACKEND_PATHS:
            v.require(not (BACKEND / path).exists(), f"shared path exists before worktree materialization: {path}")
        check_source_shadow(v, BACKEND, allow_authorized_untracked=False)
        return "CARRIER_READY_WORKTREE_RECEIPT_REQUIRED"

    v.require(absolute_path_is_regular_and_symlink_free(SHARED_WORKTREE / ".git"), "shared worktree .git indirection is missing, nonregular or symlinked")
    v.require(SHARED_WORKTREE.absolute() == SHARED_WORKTREE.resolve(), "shared worktree root is symlinked")
    check_git_hygiene(v, SHARED_WORKTREE, SHARED_WORKTREE)
    worktree_branch = git_text(SHARED_WORKTREE, "branch", "--show-current")
    worktree_head = git_text(SHARED_WORKTREE, "rev-parse", "HEAD")
    v.require(worktree_branch == SHARED_BRANCH, "shared worktree branch drift")
    v.require(is_ancestor(SHARED_WORKTREE, BACKEND_BASE, worktree_head), "shared worktree lost its pinned base")
    v.require(receipt_exists, "shared worktree requires its clean pre-source receipt")
    _, clean_verified_at = validate_receipt(v, carrier, authority_bytes)
    committed_changes = branch_diff_paths(SHARED_WORKTREE, BACKEND_BASE, worktree_head)
    live_changes = working_changes(SHARED_WORKTREE)
    all_changes = committed_changes | live_changes
    v.require(all_changes <= set(AUTHORIZED_BACKEND_PATHS), f"shared worktree changed paths outside allowlist: {sorted(all_changes - set(AUTHORIZED_BACKEND_PATHS))}")
    check_existing_authorized_paths_are_regular(v, SHARED_WORKTREE)
    require_clean_receipt_predates_authored_paths(
        v, SHARED_WORKTREE, clean_verified_at
    )
    check_source_shadow(v, SHARED_WORKTREE, allow_authorized_untracked=True)
    check_backend_denials(v, SHARED_WORKTREE)
    check_shared_file_content_boundary(v, SHARED_WORKTREE)
    if worktree_head == BACKEND_BASE:
        v.require(
            not targeted_receipt_exists,
            "targeted verification receipt exists before a lane commit",
        )
        v.require(
            not post_review_exists,
            "post-review receipt exists before a lane commit",
        )
        v.require(
            not central_receipt_exists,
            "central integration receipt exists before a lane commit",
        )
        if not all_changes:
            require_exact_fresh_shared_worktree(v)
        return "SHARED_WORKTREE_RECEIPT_READY" if not all_changes else "SHARED_SOURCE_AUTHORING_IN_PROGRESS"
    v.require(not live_changes, "shared lane commit state must be clean")
    parents = git_text(SHARED_WORKTREE, "rev-list", "--parents", "-n", "1", worktree_head).split()
    v.require(parents == [worktree_head, BACKEND_BASE], "shared lane commit must be one non-merge direct child of base")
    v.require(committed_changes == set(AUTHORIZED_BACKEND_PATHS), "shared lane commit must contain all and only six source plus five test paths")
    lane_tree = git_text(SHARED_WORKTREE, "rev-parse", f"{worktree_head}^{{tree}}")
    targeted_evidence: tuple[bytes, datetime] | None = None
    if targeted_receipt_exists:
        targeted_evidence = validate_targeted_verification_receipt(
            v, carrier, authority_bytes, worktree_head, lane_tree
        )
    v.require(not post_review_exists or targeted_evidence is not None, "post-review receipt exists without targeted-tree evidence")
    v.require(
        not central_receipt_exists or post_review_exists,
        "central integration receipt exists without post-implementation review",
    )
    if post_review_exists and targeted_evidence is not None:
        validate_post_implementation_review(
            v,
            carrier,
            authority_bytes,
            worktree_head,
            lane_tree,
            targeted_evidence[0],
            targeted_evidence[1],
        )
    remote_ref = f"refs/remotes/origin/{SHARED_BRANCH}"
    remote = git(SHARED_WORKTREE, "rev-parse", "--verify", remote_ref, check=False)
    if central_receipt_exists:
        v.require(
            remote.returncode == 0
            and remote.stdout.decode("utf-8", errors="strict").strip()
            == worktree_head,
            "central integration receipt exists before the exact lane branch push",
        )
        validate_central_integration_receipt(
            v, carrier, authority_bytes, worktree_head, lane_tree
        )
        return "CENTRAL_FAST_FORWARD_AUTHORITY_READY_NOT_INTEGRATED"
    if remote.returncode == 0:
        v.require(remote.stdout.decode().strip() == worktree_head, "remote shared branch does not equal lane commit")
        v.require(targeted_evidence is not None, "pushed shared branch lacks tested-tree evidence")
        v.require(post_review_exists, "pushed shared branch lacks post-implementation review")
        return "SHARED_LANE_COMMIT_PUSHED_CENTRAL_REVIEW_REQUIRED"
    return "SHARED_LANE_COMMIT_LOCAL_REVIEW_AND_PUSH_REQUIRED"


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
    unsafe_git = sorted(
        key
        for key in os.environ
        if key in UNSAFE_GIT_ENV
        or key.startswith("GIT_CONFIG_KEY_")
        or key.startswith("GIT_CONFIG_VALUE_")
    )
    v.require(not unsafe_git, f"unsafe inherited Git environment: {unsafe_git}")
    isolated = (
        bool(sys.flags.isolated)
        and Path(sys.executable).resolve() in TRUSTED_PYTHON_EXECUTABLES
    )
    if require_trusted:
        v.require(isolated, "authoritative validation requires /usr/bin/python3 -I")
        v.exact(
            dict(os.environ),
            TRUSTED_RUNTIME_ENV,
            "authoritative validation requires the exact env -i runtime allowlist",
        )
    return isolated


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument(
        "--authoring",
        action="store_true",
        help="validate the exact uncommitted five-path carrier before its one allowed commit",
    )
    modes.add_argument(
        "--issue-clean-receipt",
        action="store_true",
        help="live-verify a freshly materialized shared worktree and atomically issue its receipt",
    )
    modes.add_argument(
        "--run-targeted-verification",
        action="store_true",
        help="run the sealed compile/tests on the exact local lane commit and issue evidence",
    )
    parser.add_argument(
        "--require-trusted",
        action="store_true",
        help="fail unless running under /usr/bin/python3 -I with injection variables absent",
    )
    args = parser.parse_args()
    v = Verifier()
    try:
        isolated = check_runtime_environment(
            v,
            require_trusted=(
                args.require_trusted
                or args.authoring
                or args.issue_clean_receipt
                or args.run_targeted_verification
            ),
        )
        run_internal_negative_tests(v)
        v.require(SCRIPT_FILE == SCRIPT_FILE.resolve(), "validator invocation path is symlinked")
        v.require(HERE == HERE.resolve(), "validator directory path is symlinked")
        check_git_hygiene(v, FRONTEND, FRONTEND)
        check_predecessor_pins(v)
        authority_path = FRONTEND / AUTHORITY_REL
        review_path = FRONTEND / REVIEW_REL
        v.require(symlink_free_path(FRONTEND, AUTHORITY_REL), "authority path is missing or symlinked")
        v.require(symlink_free_path(FRONTEND, REVIEW_REL), "review path is missing or symlinked")
        authority_bytes = authority_path.read_bytes()
        v.require(
            digest_bytes(authority_bytes) == EXPECTED_AUTHORITY_DOCUMENT_PIN,
            "authority document immutable byte pin drift",
        )
        authority = load_json_bytes(authority_bytes, AUTHORITY_REL)
        review = load_json_file(review_path, REVIEW_REL)
        check_authority_structure(v, authority)
        check_review_structure(v, review)
        check_register(v)
        if args.authoring:
            check_frontend_authoring(v, authority, review)
            carrier = "UNCOMMITTED"
        else:
            carrier = check_frontend_historical(v, authority, review)
        check_agent_repository(v)
        if args.issue_clean_receipt:
            issue_clean_receipt(v, carrier, authority_bytes)
        elif args.run_targeted_verification:
            run_targeted_verification(v, carrier, authority_bytes)
        backend_state = check_backend_state(
            v,
            carrier,
            authority_bytes,
            authoring=args.authoring,
        )
    except (VerificationError, OSError, UnicodeError, ValueError) as exc:
        print(f"HRM-013 runtime-contract authority: FAIL: {exc}", file=sys.stderr)
        return 1
    evidence_role = "AUTHORITATIVE_TRUSTED_ISOLATED" if isolated else "SUPPLEMENTARY_NON_ISOLATED"
    mode = (
        "AUTHORING"
        if args.authoring
        else "ISSUE_CLEAN_RECEIPT"
        if args.issue_clean_receipt
        else "RUN_TARGETED_VERIFICATION"
        if args.run_targeted_verification
        else "HISTORICAL"
    )
    print(
        "HRM-013 runtime-contract authority: PASS "
        f"(mode={mode}; evidence={evidence_role}; backend={backend_state}; checks={v.checks})"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
