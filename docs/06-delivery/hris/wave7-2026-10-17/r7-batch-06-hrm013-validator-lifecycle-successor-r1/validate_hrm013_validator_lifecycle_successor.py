#!/usr/bin/env python3
"""Fail-closed validator for the HRM-013 validator lifecycle successor."""

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
ROOT = SCRIPT.parents[5]
BACKEND = Path("/Users/a10697/Work/DWP/dwp-backend")
GIT = "/usr/bin/git"
BASE = "50cf521fd38f09f1a930582562fd15f7c4bc126b"
BASE_TREE = "830b484b5a3b338e984bbecd4be71236e611a86c"
BRANCH = (
    "codex/hris-wave7-batch06-hrm013-validator-lifecycle-"
    "correction-frontend-20261027-r1"
)
DIR = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-validator-lifecycle-successor-r1"
)
AUTHORITY = f"{DIR}/validator-lifecycle-successor-authority.v1.json"
REVIEW = f"{DIR}/independent-review.v1.json"
VALIDATOR = f"{DIR}/validate_hrm013_validator_lifecycle_successor.py"
SEVENTH = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-auth-v62-generation-r1/"
    "validate_hrm013_auth_v62_generation_authority.py"
)
EIGHTH = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-auth-v62-generation-integration-r1/"
    "validate_hrm013_auth_v62_generation_integration.py"
)
NINTH = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-auth-v271-authority-r1/"
    "validate_hrm013_auth_v271_authority.py"
)
MODIFIED_VALIDATORS = [SEVENTH, EIGHTH, NINTH]
CARRIER_PATHS = {
    AUTHORITY, REVIEW, VALIDATOR, *MODIFIED_VALIDATORS, "package.json",
}
ORIGINALS = {
    SEVENTH: (
        "d80e886121886792c33150b0ff97f128f0da9e14", 73707,
        "838aa615dbe5311f7af28eca26b8d480bdd21f6448e9eea6b80a39b506762794",
    ),
    EIGHTH: (
        "4b24bdefb0f61d5cb61d89d08397975e45ac389e", 69057,
        "593c7385717649dd860588b3ec8a8d9a67a6f131b098886746c90a7ed0e77168",
    ),
    NINTH: (
        "24cb37b7c9f23b2f74a833aedf6939e499f5ab99", 64903,
        "e99ea3a5b74f27917730493ca708678b9147534775ac6100195a8beb263567f1",
    ),
}
APPROVAL_COMMIT = "2479ef3da2185668ec8dcbe4815cd6ba3caa0986"
APPROVAL_TREE = "8e99270400e5c47928d659a7ba4fe0552963445f"
APPROVAL_PARENT = "b2fa6d56f16ce5befe0e366ca55d34ef8f42f58e"
HARDENED_VALIDATORS = {
    "docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-hrm013-auth-runtime-authority-r1/validate_hrm013_auth_runtime_authority.py": (
        34031, "a84254807daebc854ae35c9c6388869d02ba4129deda3a94312a367fad117b1c"
    ),
    "docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-hrm013-approval-readiness-authority-r1/validate_hrm013_approval_readiness_authority.py": (
        19342, "15378f74a7b0c67258c13b1e6fda432a801011cfffc247af0bfb7e877a6fa014"
    ),
    "docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-hrm013-approval-readiness-successor-r1/validate_hrm013_approval_readiness_successor.py": (
        14640, "a4a8f41e01e0c2d0fd10e1fed608af6cf05d9ce280dbbd4e842656e195575678"
    ),
    "docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-hrm013-owner-runtime-phase4-authority-r1/validate_hrm013_owner_runtime_phase4_authority.py": (
        34309, "9964ef667df99a3c1c5a5bdcebb91e7c7f570480d30769080e71a5cd99f06ad5"
    ),
    "docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-hrm013-approval-drain-clarification-r1/validate_hrm013_approval_drain_clarification.py": (
        18707, "1e207887c80cc367de3d7c7097c0e42db946a374b3b6530a6094c4c72e2fffd4"
    ),
}
# Spell out the three Approval integration artifacts to prevent path construction
# from silently accepting a neighboring delivery directory.
APPROVAL_PATHS = {
    "package.json", *HARDENED_VALIDATORS,
    "docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-hrm013-approval-runtime-integration-r1/approval-runtime-central-integration-authority.v1.json",
    "docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-hrm013-approval-runtime-integration-r1/independent-review.v1.json",
    "docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-hrm013-approval-runtime-integration-r1/validate_hrm013_approval_runtime_integration.py",
}

RESEAL_BASE = "6c79565649861f8bd1e9658495edc85155c10744"
RESEAL_BASE_TREE = "aa7049f0429cfba465995e3b46fad7e7caebf64c"
RESEAL_BRANCH = (
    "codex/hris-wave7-batch06-hrm013-approval-reseal-"
    "integration-frontend-20261027-r2"
)
RESEAL_DIR = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-approval-reseal-integration-r1"
)
RESEAL_AUTHORITY = f"{RESEAL_DIR}/approval-reseal-central-integration-authority.v1.json"
RESEAL_REVIEW = f"{RESEAL_DIR}/independent-review.v1.json"
READINESS = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-approval-readiness-authority-r1/"
    "validate_hrm013_approval_readiness_authority.py"
)
READINESS_SUCCESSOR = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-approval-readiness-successor-r1/"
    "validate_hrm013_approval_readiness_successor.py"
)
READINESS_INTEGRATION = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-approval-readiness-integration-r1/"
    "validate_hrm013_approval_readiness_integration.py"
)
PHASE4 = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-owner-runtime-phase4-authority-r1/"
    "validate_hrm013_owner_runtime_phase4_authority.py"
)
CLARIFICATION = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-approval-drain-clarification-r1/"
    "validate_hrm013_approval_drain_clarification.py"
)
APPROVAL_RUNTIME_INTEGRATION = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-approval-runtime-integration-r1/"
    "validate_hrm013_approval_runtime_integration.py"
)
RESEAL_MODIFIED_VALIDATORS = [
    SEVENTH,
    EIGHTH,
    NINTH,
    READINESS,
    READINESS_SUCCESSOR,
    READINESS_INTEGRATION,
    PHASE4,
    CLARIFICATION,
    APPROVAL_RUNTIME_INTEGRATION,
    VALIDATOR,
]
RESEAL_PATHS = {
    *RESEAL_MODIFIED_VALIDATORS,
    RESEAL_AUTHORITY,
    RESEAL_REVIEW,
}
RESEAL_PACKAGE_PIN = {
    "path": "package.json",
    "bytes": 16620,
    "sha256": "2852cdd0cb616ff419479018e9d30d3602d606a9014fbf64e9a40d6b8d889bb6",
}

BACKEND_BASE = "bed31127123a318358f495f66edced7b024469d8"
BACKEND_BASE_TREE = "e5564ff7a81e5dd0a85d0e61f091ec0714a1f777"
ORIGINAL_APPROVAL_COMMIT = "b9880ec6cf0ad65e08d86c6624ee2ac91a748716"
RESEALED_APPROVAL_COMMIT = "3970b26c111c0492d7a7b637b8153f7a6844318d"
RESEALED_APPROVAL_TREE = "3b6033339058ae684dafe94361bc653d28d6fe75"
RESEALED_APPROVAL_BRANCH = (
    "codex/hris-wave7-batch06-hrm013-approval-runtime-backend-20261027-r2"
)
GOVERNANCE_PARENT = "189bb49645515bbd3e4423cfb93dcc53ff40ed75"
GOVERNANCE_COMMIT = "dca74e7fabc58651a40b2b9605b38da5adc1b9b8"
GOVERNANCE_TREE = "57611528080e3b19183abea146ad140e6f7b5cfc"
GOVERNANCE_BRANCH = (
    "codex/hris-wave7-batch06-hrm013-b9880-governance-frontend-20261027-r2"
)
GOVERNANCE_AUTHORITY = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-backend-descendant-governance/"
    f"{RESEALED_APPROVAL_COMMIT}/authority.v1.json"
)
GOVERNANCE_REVIEW = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-backend-descendant-governance/"
    f"{RESEALED_APPROVAL_COMMIT}/independent-review.v1.json"
)
RECEIPT_ROOT = Path(
    "/Users/a10697/Work/DWP/.codex-worktrees/hris/wave7-20261026/"
    "batch06/hrm013-owner-runtime/receipts"
)
EQUIVALENCE_RECEIPT = RECEIPT_ROOT / (
    "approval-runtime-same-tree-reseal-equivalence-receipt.v1.json"
)
TARGETED_RECEIPT = RECEIPT_ROOT / "approval-runtime-targeted-verification-receipt.v1.json"
POST_REVIEW_RECEIPT = RECEIPT_ROOT / "approval-runtime-post-implementation-review.v1.json"
PREVIOUS_GOVERNANCE_RECEIPT = RECEIPT_ROOT / "backend-descendants" / (
    f"{BACKEND_BASE}.hrm013-shared-contract-governance.v1.json"
)
GOVERNANCE_RECEIPT = RECEIPT_ROOT / "backend-descendants" / (
    f"{RESEALED_APPROVAL_COMMIT}.hrm013-shared-contract-governance.v1.json"
)
SHARED_VALIDATOR = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-shared-contract-integration-r1/"
    "validate_hrm013_shared_contract_integration.py"
)
ENV = {
    "PATH": "/usr/bin:/bin", "HOME": "/var/empty", "LC_ALL": "C",
    "LANG": "C", "GIT_CONFIG_NOSYSTEM": "1",
    "GIT_CONFIG_GLOBAL": "/dev/null", "GIT_NO_REPLACE_OBJECTS": "1",
}
TRUSTED_PYTHONS = {
    Path("/usr/bin/python3").resolve(),
    Path("/Library/Developer/CommandLineTools/usr/bin/python3").resolve(),
}
UNSAFE_ENV = {
    "GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_OBJECT_DIRECTORY",
    "GIT_ALTERNATE_OBJECT_DIRECTORIES", "GIT_COMMON_DIR",
    "GIT_CEILING_DIRECTORIES", "GIT_DISCOVERY_ACROSS_FILESYSTEM",
    "GIT_CONFIG", "GIT_CONFIG_COUNT", "GIT_CONFIG_PARAMETERS",
    "GIT_CONFIG_SYSTEM", "GIT_EXEC_PATH", "GIT_ATTR_NOSYSTEM",
    "GIT_OPTIONAL_LOCKS", "GIT_EXTERNAL_DIFF", "PYTHONPATH", "PYTHONHOME",
}


class VerificationError(RuntimeError):
    pass


def strict_equal(actual: Any, expected: Any) -> bool:
    if type(actual) is not type(expected):
        return False
    if isinstance(expected, dict):
        return set(actual) == set(expected) and all(
            type(key) is str and strict_equal(actual[key], expected[key])
            for key in expected
        )
    if isinstance(expected, list):
        return len(actual) == len(expected) and all(
            strict_equal(left, right)
            for left, right in zip(actual, expected)
        )
    return actual == expected


class V:
    def __init__(self) -> None:
        self.checks = 0

    def require(self, value: bool, message: str) -> None:
        self.checks += 1
        if not value:
            raise VerificationError(message)

    def exact(self, actual: Any, expected: Any, message: str) -> None:
        self.checks += 1
        if not strict_equal(actual, expected):
            raise VerificationError(f"{message}: expected={expected!r} actual={actual!r}")


def run(*args: str) -> subprocess.CompletedProcess[bytes]:
    return subprocess.run(
        [GIT, "-C", str(ROOT), *args], stdout=subprocess.PIPE,
        stderr=subprocess.PIPE, env=ENV, check=False,
    )


def output(*args: str) -> bytes:
    result = run(*args)
    if result.returncode:
        raise VerificationError(result.stderr.decode(errors="replace").strip())
    return result.stdout


def text(*args: str) -> str:
    return output(*args).decode().strip()


def run_backend(*args: str) -> subprocess.CompletedProcess[bytes]:
    return subprocess.run(
        [GIT, "-C", str(BACKEND), *args], stdout=subprocess.PIPE,
        stderr=subprocess.PIPE, env=ENV, check=False,
    )


def output_backend(*args: str) -> bytes:
    result = run_backend(*args)
    if result.returncode:
        raise VerificationError(result.stderr.decode(errors="replace").strip())
    return result.stdout


def text_backend(*args: str) -> str:
    return output_backend(*args).decode().strip()


def blob(commit: str, path: str) -> bytes | None:
    result = run("show", f"{commit}:{path}")
    return result.stdout if result.returncode == 0 else None


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def pin(path: str, data: bytes) -> dict[str, Any]:
    return {"path": path, "bytes": len(data), "sha256": sha(data)}


def load(data: bytes, label: str) -> dict[str, Any]:
    def pairs(items: list[tuple[str, Any]]) -> dict[str, Any]:
        value: dict[str, Any] = {}
        for key, item in items:
            if key in value:
                raise VerificationError(f"duplicate JSON key in {label}: {key}")
            value[key] = item
        return value

    def reject_constant(value: str) -> None:
        raise VerificationError(f"non-finite JSON constant in {label}: {value}")

    value = json.loads(
        data.decode("utf-8"), object_pairs_hook=pairs,
        parse_constant=reject_constant,
    )
    if not isinstance(value, dict):
        raise VerificationError(f"JSON root is not an object: {label}")
    return value


def changes() -> set[str]:
    raw = output("status", "--porcelain=v1", "--untracked-files=all").decode()
    return {line[3:] for line in raw.rstrip("\n").splitlines() if line}


def between(older: str, newer: str) -> set[str]:
    return set(filter(None, text("diff", "--name-only", older, newer).splitlines()))


def backend_between(older: str, newer: str) -> set[str]:
    return set(filter(None, text_backend("diff", "--name-only", older, newer).splitlines()))


def mode(commit: str, path: str) -> str | None:
    raw = text("ls-tree", commit, "--", path)
    return raw.split()[0] if raw else None


def ancestor(older: str, newer: str) -> bool:
    return run("merge-base", "--is-ancestor", older, newer).returncode == 0


def parse_time(value: Any, label: str) -> datetime:
    pattern = (
        r"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}"
        r"(?:Z|[+-][0-9]{2}:[0-9]{2})"
    )
    if type(value) is not str or re.fullmatch(pattern, value) is None:
        raise VerificationError(f"{label} is not whole-second RFC3339")
    normalized = value[:-1] + "+00:00" if value.endswith("Z") else value
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError as exc:
        raise VerificationError(f"{label} is not a valid timestamp") from exc
    if parsed.tzinfo is None or parsed.utcoffset() is None or parsed.microsecond:
        raise VerificationError(f"{label} must have timezone and second precision")
    return parsed.astimezone(timezone.utc)


def canonical(value: str) -> bool:
    if type(value) is not str or not value:
        return False
    path = PurePosixPath(value)
    return (
        not path.is_absolute() and path.as_posix() == value
        and all(part not in {"", ".", ".."} for part in path.parts)
    )


def regular_live(v: V, path: str) -> bytes:
    candidate = ROOT / path
    v.require(candidate.is_file() and not candidate.is_symlink(), f"missing/symlinked artifact: {path}")
    v.exact(stat.S_IMODE(candidate.stat().st_mode), 0o644, f"artifact mode: {path}")
    return candidate.read_bytes()


def secure_receipt(
    v: V, path: Path, expected_size: int, expected_sha: str,
) -> tuple[dict[str, Any], bytes]:
    v.require(path.exists() and not path.is_symlink(), f"receipt missing/symlinked: {path}")
    info = path.stat()
    v.require(stat.S_ISREG(info.st_mode), f"receipt is not regular: {path}")
    v.exact(stat.S_IMODE(info.st_mode), 0o600, f"receipt mode: {path}")
    v.exact(info.st_uid, os.getuid(), f"receipt owner: {path}")
    v.exact(info.st_nlink, 1, f"receipt link count: {path}")
    data = path.read_bytes()
    v.exact(pin(str(path), data), {
        "path": str(path), "bytes": expected_size, "sha256": expected_sha,
    }, f"receipt pin: {path}")
    return load(data, str(path)), data


def runtime(v: V, required: bool) -> bool:
    inherited = sorted(
        key for key in os.environ
        if key in UNSAFE_ENV
        or key.startswith("GIT_CONFIG_KEY_")
        or key.startswith("GIT_CONFIG_VALUE_")
    )
    v.require(not inherited, f"unsafe inherited environment: {inherited}")
    v.require(SCRIPT == SCRIPT.resolve(), "validator path is symlinked")
    isolated = bool(sys.flags.isolated) and Path(sys.executable).resolve() in TRUSTED_PYTHONS
    if required:
        v.require(isolated, "trusted validation requires /usr/bin/python3 -I")
    return isolated


def expected_authority() -> dict[str, Any]:
    return {
        "schema": "dwp.hris.wave7.hrm013-validator-lifecycle-successor-authority.v1",
        "state": "INDEPENDENTLY_REVIEWED_HASH_BOUND_EXACT_THREE_VALIDATOR_LIFECYCLE_SUCCESSOR",
        "sliceId": "BASE-TFR-HRM-013",
        "lane": "FRONTEND_VALIDATOR_LIFECYCLE_CORRECTION",
        "carrier": {
            "repository": "dwp-frontend", "branch": BRANCH,
            "baseCommit": BASE, "baseTree": BASE_TREE,
            "requiredDirectChild": True, "exactChangedPathCount": 7,
            "exactChangedPaths": [
                *MODIFIED_VALIDATORS, AUTHORITY, REVIEW, VALIDATOR, "package.json",
            ],
        },
        "historicalValidatorIntroductions": [
            {"path": path, "commit": ORIGINALS[path][0]}
            for path in MODIFIED_VALIDATORS
        ],
        "correction": {
            "modifiedValidatorPaths": MODIFIED_VALIDATORS,
            "historicalAuthorityReviewAndTokenBlobsRemainPinned": True,
            "successorBlobSubstitutionRestrictedToValidatorPaths": True,
            "packageMutationRestrictedToExactSingleValidatorAppend": True,
            "basePackagePin": {
                "path": "package.json", "bytes": 16469,
                "sha256": "0e496cced22dbc11a4c9dfd7315f83d8ae6c905ec99c4cec166a6437b6a6e3ee",
            },
            "appendedValidatorPath": VALIDATOR,
            "approvalRuntimeHardening": {
                "carrierCommit": APPROVAL_COMMIT, "carrierTree": APPROVAL_TREE,
                "carrierParent": APPROVAL_PARENT, "exactChangedPathCount": 9,
                "authRuntimeValidatorPath": next(iter(HARDENED_VALIDATORS)),
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


def validate_package(v: V, package_data: bytes) -> None:
    base_data = blob(BASE, "package.json")
    v.require(base_data is not None, "base package missing")
    v.exact(pin("package.json", base_data or b""), {
        "path": "package.json", "bytes": 16469,
        "sha256": "0e496cced22dbc11a4c9dfd7315f83d8ae6c905ec99c4cec166a6437b6a6e3ee",
    }, "base package pin")
    base = load(base_data or b"", "base package")
    base_command = base["scripts"]["hris:current-contracts:check"]
    successor_command = base_command + " && python3 " + VALIDATOR
    old_command = json.dumps(base_command, ensure_ascii=False).encode()[1:-1]
    new_command = json.dumps(successor_command, ensure_ascii=False).encode()[1:-1]
    v.exact((base_data or b"").count(old_command), 1, "base package command byte count")
    expected = (base_data or b"").replace(old_command, new_command, 1)
    v.exact(package_data, expected, "package is not exact one-validator byte append")
    package = load(package_data, "successor package")
    scripts = package.get("scripts")
    v.require(isinstance(scripts, dict), "scripts missing")
    if not isinstance(scripts, dict):
        return
    v.require("prehris:current-contracts:check" not in scripts, "npm pre-hook forbidden")
    v.require("posthris:current-contracts:check" not in scripts, "npm post-hook forbidden")
    command = scripts.get("hris:current-contracts:check")
    v.require(isinstance(command, str), "current-contract chain missing")
    if not isinstance(command, str):
        return
    parts = command.split(" && ")
    matches = [
        re.fullmatch(
            r"python3 (docs/06-delivery/hris/[A-Za-z0-9._/-]+/validate_[A-Za-z0-9_]+\.py)",
            item,
        )
        for item in parts
    ]
    v.require(all(matches), "non-validator command in package chain")
    paths = [match.group(1) for match in matches if match]
    v.exact(len(paths), len(set(paths)), "duplicate validator command")
    v.exact(paths[-1], VALIDATOR, "successor validator is not final")
    for path in paths:
        v.require(canonical(path), f"noncanonical validator path: {path}")
        candidate = ROOT / path
        v.require(candidate.is_file() and not candidate.is_symlink(), f"validator missing/symlinked: {path}")
        v.require(run("ls-files", "--error-unmatch", "--", path).returncode == 0, f"untracked validator: {path}")


def validate_approval_hardening(
    v: V, head: str, reseal_blobs: dict[str, bytes] | None = None,
    reseal_authoring: bool = False,
) -> None:
    v.exact(
        text("rev-list", "--parents", "-n", "1", APPROVAL_COMMIT).split(),
        [APPROVAL_COMMIT, APPROVAL_PARENT], "Approval carrier parent",
    )
    v.exact(text("rev-parse", f"{APPROVAL_COMMIT}^{{tree}}"), APPROVAL_TREE, "Approval carrier tree")
    v.exact(between(APPROVAL_PARENT, APPROVAL_COMMIT), APPROVAL_PATHS, "Approval carrier paths")
    v.require(ancestor(APPROVAL_COMMIT, BASE) and ancestor(APPROVAL_COMMIT, head), "Approval carrier ancestry")
    for path, (size, digest) in HARDENED_VALIDATORS.items():
        data = blob(APPROVAL_COMMIT, path)
        v.require(data is not None, f"hardened validator missing: {path}")
        v.exact(pin(path, data or b""), {
            "path": path, "bytes": size, "sha256": digest,
        }, f"hardened validator pin: {path}")
        v.exact(mode(APPROVAL_COMMIT, path), "100644", f"hardened validator mode: {path}")
        current = blob(head, path)
        v.require(current is not None, f"current hardened validator missing: {path}")
        v.exact(mode(head, path), "100644", f"current hardened validator mode: {path}")
        expected = (
            reseal_blobs[path]
            if reseal_blobs is not None and path in reseal_blobs
            else data or b""
        )
        committed_expected = (data or b"") if reseal_authoring else expected
        v.exact(pin(path, current or b""), pin(path, committed_expected), f"hardened validator successor drift: {path}")
        v.exact(pin(path, regular_live(v, path)), pin(path, expected), f"live hardened validator drift: {path}")


def validate_review(
    v: V, blobs: dict[str, bytes], commit: str | None,
) -> None:
    authority = load(blobs[AUTHORITY], "successor authority")
    v.exact(authority, expected_authority(), "successor authority drift")
    review = load(blobs[REVIEW], "successor review")
    v.exact(set(review), {
        "schema", "state", "reviewedAt", "reviewer", "scope", "findings",
        "finalVerdict", "authority", "artifactPins",
    }, "review key set")
    v.exact(review.get("schema"), "dwp.hris.wave7.hrm013-validator-lifecycle-successor-independent-review.v1", "review schema")
    v.exact(review.get("state"), "INDEPENDENT_ZERO_FINDING_REVIEW_OF_EXACT_SEVEN_PATH_VALIDATOR_LIFECYCLE_SUCCESSOR", "review state")
    v.exact(review.get("reviewer"), "INDEPENDENT_HRM013_VALIDATOR_LIFECYCLE_SUCCESSOR_REVIEW", "reviewer")
    v.exact(review.get("scope"), {
        "authorityPath": AUTHORITY, "reviewPath": REVIEW,
        "validatorPath": VALIDATOR, "modifiedValidatorPaths": MODIFIED_VALIDATORS,
        "packagePath": "package.json",
        "reviewedBoundaries": [
            "EXACT_DIRECT_CHILD_SEVEN_PATH_CARRIER",
            "ORIGINAL_AUTHORITY_REVIEW_AND_TOKEN_BLOBS_REMAIN_IMMUTABLE",
            "ONLY_THREE_VALIDATOR_BLOBS_USE_THE_CORRECTION_CARRIER",
            "AUTH_RUNTIME_HARDENING_BOUND_TO_EXACT_APPROVAL_INTEGRATION_CARRIER",
            "EXACT_SINGLE_VALIDATOR_PACKAGE_APPEND_AND_NO_BACKEND_OR_ACTIVATION_AUTHORITY",
        ],
    }, "review scope")
    v.exact(review.get("findings"), {"p0": [], "p1": [], "p2": []}, "review findings")
    v.exact(review.get("finalVerdict"), {
        "p0": 0, "p1": 0, "p2": 0,
        "decision": "GO_FOR_EXACT_SEVEN_PATH_VALIDATOR_LIFECYCLE_SUCCESSOR_ONLY",
    }, "review verdict")
    v.exact(review.get("authority"), {
        "independentReviewComplete": True,
        "exactSevenPathCarrierCommitAndPushAuthorized": True,
        "currentContractChainRevalidationAuthorized": True,
        "exactSingleValidatorPackageAppendAuthorized": True,
        "backendDwpDevIntegrationAuthorized": False,
        "featureActivationOrProductionAuthority": False,
        "businessCompletionCredit": 0,
    }, "review authority")
    v.exact(review.get("artifactPins"), [
        pin(AUTHORITY, blobs[AUTHORITY]),
        pin(VALIDATOR, blobs[VALIDATOR]),
        *[pin(path, blobs[path]) for path in MODIFIED_VALIDATORS],
        pin("package.json", blobs["package.json"]),
    ], "review artifact pins")
    reviewed_at = parse_time(review.get("reviewedAt"), "reviewedAt")
    v.require(
        reviewed_at <= datetime.now(timezone.utc) + timedelta(minutes=5),
        "reviewedAt is in the future",
    )
    base_at = parse_time(text("show", "-s", "--format=%cI", BASE), "base committedAt")
    approval_at = parse_time(
        text("show", "-s", "--format=%cI", APPROVAL_COMMIT),
        "Approval carrier committedAt",
    )
    v.require(max(base_at, approval_at) <= reviewed_at, "review predates prerequisites")
    if commit is None:
        latest = max(
            datetime.fromtimestamp(int((ROOT / path).stat().st_mtime), timezone.utc)
            for path in [AUTHORITY, VALIDATOR, *MODIFIED_VALIDATORS, "package.json"]
        )
        v.require(latest <= reviewed_at, "review predates authoring snapshot")
    else:
        committed_at = parse_time(
            text("show", "-s", "--format=%cI", commit),
            "successor committedAt",
        )
        v.require(reviewed_at <= committed_at, "review follows successor commit")


def expected_reseal_authority() -> dict[str, Any]:
    changed_paths = sorted(backend_between(BACKEND_BASE, RESEALED_APPROVAL_COMMIT))
    return {
        "schema": "dwp.hris.wave7.hrm013-approval-reseal-central-integration-authority.v1",
        "state": "INDEPENDENTLY_REVIEWED_HASH_BOUND_EXACT_SAME_TREE_APPROVAL_RESEAL_INTEGRATION",
        "sliceId": "BASE-TFR-HRM-013",
        "lane": "APPROVAL_RUNTIME_SAME_TREE_RESEAL_INTEGRATION",
        "carrier": {
            "repository": "dwp-frontend",
            "branch": RESEAL_BRANCH,
            "baseCommit": RESEAL_BASE,
            "baseTree": RESEAL_BASE_TREE,
            "requiredDirectChild": True,
            "exactChangedPathCount": 12,
            "exactChangedPaths": [
                *RESEAL_MODIFIED_VALIDATORS,
                RESEAL_AUTHORITY,
                RESEAL_REVIEW,
            ],
        },
        "historicalReviewedImplementation": {
            "commit": ORIGINAL_APPROVAL_COMMIT,
            "parent": BACKEND_BASE,
            "tree": RESEALED_APPROVAL_TREE,
            "targetedVerificationReceipt": {
                "path": str(TARGETED_RECEIPT),
                "mode": "0600",
                "bytes": 3217,
                "sha256": "903abb7ffdbd7153a95f21144eda24b7978f8c4d1d50f36bcd6e02323f0d8d2b",
            },
            "postImplementationReview": {
                "path": str(POST_REVIEW_RECEIPT),
                "mode": "0600",
                "bytes": 1992,
                "sha256": "b0d52957d72e87f15797e41a043bda491a35ee63255f83d86e9dcbb6b5984e5e",
            },
            "historicalEvidenceImmutable": True,
        },
        "sameTreeSuccessor": {
            "branch": RESEALED_APPROVAL_BRANCH,
            "commit": RESEALED_APPROVAL_COMMIT,
            "parent": BACKEND_BASE,
            "tree": RESEALED_APPROVAL_TREE,
            "changedPathCount": 45,
            "changedPaths": changed_paths,
            "originalToSuccessorChangedPaths": [],
            "equivalenceReceipt": {
                "path": str(EQUIVALENCE_RECEIPT),
                "mode": "0600",
                "bytes": 10119,
                "sha256": "052f58e89bfb0088dec975c0de659923b6778adf79103a0bc925a94722ab8b81",
            },
            "evidenceReuseRule": (
                "ONLY_THE_EXACT_3970B26C_COMMIT_MAY_REUSE_THE_IMMUTABLE_"
                "B9880EC6_TREE_EVIDENCE"
            ),
        },
        "descendantGovernance": {
            "carrierBranch": GOVERNANCE_BRANCH,
            "carrierCommit": GOVERNANCE_COMMIT,
            "carrierTree": GOVERNANCE_TREE,
            "carrierParent": GOVERNANCE_PARENT,
            "exactChangedPaths": [GOVERNANCE_AUTHORITY, GOVERNANCE_REVIEW],
            "authority": {
                "path": GOVERNANCE_AUTHORITY,
                "bytes": 9846,
                "sha256": "61f0a6fbde31295d1f0ef91a7b2ce9be6a88ff0d0aa501cc7a4a0a55d50f4a80",
            },
            "independentReview": {
                "path": GOVERNANCE_REVIEW,
                "bytes": 2187,
                "sha256": "57aea401fdd2a62de9a3dd2687fca0e7bfeda6e992e80632283f4a12464ee24f",
            },
            "externalReceipt": {
                "path": str(GOVERNANCE_RECEIPT),
                "mode": "0600",
                "bytes": 10234,
                "sha256": "d43c7c5e9556633989638c9f29627611afa117edda93fcf4ca22113d7844423d",
            },
        },
        "validatorLifecycle": {
            "governingValidatorPath": VALIDATOR,
            "modifiedValidatorPaths": RESEAL_MODIFIED_VALIDATORS,
            "package": RESEAL_PACKAGE_PIN,
            "currentContractCommandCount": 18,
            "packageMutationAuthorized": False,
            "historicalLifecycleCarrierCommit": "928f8dc665cff069c62cabc433c49dbefe2a3046",
        },
        "authority": {
            "independentReviewComplete": True,
            "exactTwelvePathCarrierCommitAndPushAuthorized": True,
            "approvalDirectFastForwardAuthorizedAfterGovernanceClosure": True,
            "originalB988IntegrationAuthorized": False,
            "additionalSourceOrTestChangeAuthorized": False,
            "peopleIntegrationAuthorized": False,
            "featureActivationAuthorized": False,
            "tenantEnrollmentAuthorized": False,
            "runtimeCredentialProvisioningAuthorized": False,
            "productionReleaseAuthorized": False,
            "businessCompletionCredit": 0,
        },
        "next": (
            "COMMIT_AND_PUSH_EXACT_TWELVE_PATH_CARRIER_THEN_FAST_FORWARD_"
            "BACKEND_ONLY_TO_EXACT_3970B26C_AFTER_GOVERNANCE_CLOSURE"
        ),
    }


def validate_reseal_package(v: V, package_data: bytes) -> None:
    base = blob(RESEAL_BASE, "package.json")
    v.require(base is not None, "reseal base package missing")
    v.exact(pin("package.json", base or b""), RESEAL_PACKAGE_PIN, "reseal base package pin")
    v.exact(package_data, base or b"", "reseal package changed")
    package = load(package_data, "reseal package")
    scripts = package.get("scripts")
    v.require(isinstance(scripts, dict), "reseal scripts missing")
    if not isinstance(scripts, dict):
        return
    v.require("prehris:current-contracts:check" not in scripts, "reseal npm pre-hook")
    v.require("posthris:current-contracts:check" not in scripts, "reseal npm post-hook")
    command = scripts.get("hris:current-contracts:check")
    v.require(isinstance(command, str), "reseal current-contract chain missing")
    if not isinstance(command, str):
        return
    parts = command.split(" && ")
    matches = [
        re.fullmatch(
            r"python3 (docs/06-delivery/hris/[A-Za-z0-9._/-]+/validate_[A-Za-z0-9_]+\.py)",
            item,
        )
        for item in parts
    ]
    v.require(all(matches), "reseal package contains a non-validator command")
    paths = [match.group(1) for match in matches if match]
    v.exact(len(paths), 18, "reseal current-contract command count")
    v.exact(len(paths), len(set(paths)), "reseal duplicate validator command")
    v.exact(paths[-1], VALIDATOR, "lifecycle validator is not final after reseal")
    for path in paths:
        v.require(canonical(path), f"noncanonical reseal validator path: {path}")
        candidate = ROOT / path
        v.require(candidate.is_file() and not candidate.is_symlink(), f"missing reseal validator: {path}")
        v.require(run("ls-files", "--error-unmatch", "--", path).returncode == 0, f"untracked reseal validator: {path}")


def validate_reseal_external_evidence(v: V) -> datetime:
    v.exact(text_backend("rev-parse", f"{BACKEND_BASE}^{{tree}}"), BACKEND_BASE_TREE, "Approval reseal base tree")
    for commit in (ORIGINAL_APPROVAL_COMMIT, RESEALED_APPROVAL_COMMIT):
        v.exact(
            text_backend("rev-list", "--parents", "-n", "1", commit).split(),
            [commit, BACKEND_BASE], f"Approval reseal parent: {commit}",
        )
        v.exact(text_backend("rev-parse", f"{commit}^{{tree}}"), RESEALED_APPROVAL_TREE, f"Approval reseal tree: {commit}")
    v.exact(
        backend_between(ORIGINAL_APPROVAL_COMMIT, RESEALED_APPROVAL_COMMIT),
        set(), "original-to-reseal diff is not empty",
    )
    changed_paths = sorted(backend_between(BACKEND_BASE, RESEALED_APPROVAL_COMMIT))
    v.exact(len(changed_paths), 45, "resealed Approval path count")
    v.exact(
        text_backend("rev-parse", f"origin/{RESEALED_APPROVAL_BRANCH}"),
        RESEALED_APPROVAL_COMMIT, "resealed Approval branch push",
    )

    targeted, _ = secure_receipt(
        v, TARGETED_RECEIPT, 3217,
        "903abb7ffdbd7153a95f21144eda24b7978f8c4d1d50f36bcd6e02323f0d8d2b",
    )
    post, _ = secure_receipt(
        v, POST_REVIEW_RECEIPT, 1992,
        "b0d52957d72e87f15797e41a043bda491a35ee63255f83d86e9dcbb6b5984e5e",
    )
    predecessor_governance, _ = secure_receipt(
        v, PREVIOUS_GOVERNANCE_RECEIPT, 5739,
        "e2d60685644680ced28dfcf14a8848a7fe04fdd3804e654389da83cb3b86e4a4",
    )
    v.exact(
        (targeted.get("testedCommit"), targeted.get("testedTree")),
        (ORIGINAL_APPROVAL_COMMIT, RESEALED_APPROVAL_TREE),
        "historical targeted evidence",
    )
    v.exact(
        (post.get("laneCommit"), post.get("laneTree"), post.get("p0"), post.get("p1"), post.get("p2")),
        (ORIGINAL_APPROVAL_COMMIT, RESEALED_APPROVAL_TREE, 0, 0, 0),
        "historical post-review evidence",
    )
    v.exact(
        (
            predecessor_governance.get("schema"),
            predecessor_governance.get("state"),
            predecessor_governance.get("descendantCommit"),
            predecessor_governance.get("descendantTree"),
            predecessor_governance.get("p0"),
            predecessor_governance.get("p1"),
            predecessor_governance.get("p2"),
            predecessor_governance.get("decision"),
        ),
        (
            "dwp.hris.wave7.hrm013-shared-contract-backend-descendant-governance-receipt.v1",
            "REVIEWED_ORDERED_BACKEND_DESCENDANT_GOVERNANCE_SHARED_ELEVEN_BLOBS_IMMUTABLE",
            BACKEND_BASE,
            BACKEND_BASE_TREE,
            0,
            0,
            0,
            "GO_FOR_EXACT_BACKEND_DESCENDANT_GOVERNANCE_ONLY",
        ),
        "predecessor governance receipt",
    )

    equivalence, _ = secure_receipt(
        v, EQUIVALENCE_RECEIPT, 10119,
        "052f58e89bfb0088dec975c0de659923b6778adf79103a0bc925a94722ab8b81",
    )
    v.exact(set(equivalence), {
        "schema", "state", "repository", "originalReviewedCommit",
        "exactSuccessorCommit", "equivalenceProof", "predecessorGovernanceReceipt",
        "reusedReviewedEvidence", "testRerun", "causalOrder", "findings",
        "decision", "authority", "reviewedAt", "recordedAt", "recordedBy",
    }, "equivalence receipt key set")
    v.exact(equivalence.get("schema"), "dwp.hris.wave7.hrm013-approval-runtime-same-tree-reseal-equivalence-receipt.v1", "equivalence schema")
    v.exact(equivalence.get("state"), "HASH_BOUND_ZERO_FINDING_APPROVAL_RUNTIME_SAME_TREE_RESEAL_EQUIVALENCE", "equivalence state")
    v.exact(equivalence.get("repository"), "dwp-backend", "equivalence repository")
    v.exact(equivalence.get("originalReviewedCommit"), {
        "branch": "codex/hris-wave7-batch06-hrm013-approval-runtime-backend-20261026-r1",
        "commit": ORIGINAL_APPROVAL_COMMIT, "parent": BACKEND_BASE,
        "tree": RESEALED_APPROVAL_TREE, "committedAt": "2026-10-26T23:03:36Z",
    }, "equivalence original commit")
    v.exact(equivalence.get("exactSuccessorCommit"), {
        "branch": RESEALED_APPROVAL_BRANCH, "commit": RESEALED_APPROVAL_COMMIT,
        "parent": BACKEND_BASE, "tree": RESEALED_APPROVAL_TREE,
        "committedAt": "2026-10-27T00:02:58Z",
        "remoteRef": f"refs/remotes/origin/{RESEALED_APPROVAL_BRANCH}",
        "remoteRefCommit": RESEALED_APPROVAL_COMMIT,
    }, "equivalence successor commit")
    proof = equivalence.get("equivalenceProof")
    v.require(isinstance(proof, dict), "equivalence proof missing")
    if isinstance(proof, dict):
        v.exact(set(proof), {
            "sameImmediateParent", "sameTree", "originalToSuccessorChangedPaths",
            "originalToSuccessorDiffEmpty", "successorChangedPathCountFromParent",
            "successorChangedPathsFromParent", "contentAddressedConclusion",
        }, "equivalence proof key set")
        v.exact(proof.get("sameImmediateParent"), True, "same-parent proof")
        v.exact(proof.get("sameTree"), True, "same-tree proof")
        v.exact(proof.get("originalToSuccessorChangedPaths"), [], "empty-diff proof")
        v.exact(proof.get("originalToSuccessorDiffEmpty"), True, "empty-diff flag")
        v.exact(proof.get("successorChangedPathCountFromParent"), 45, "equivalence path count")
        v.exact(proof.get("successorChangedPathsFromParent"), changed_paths, "equivalence paths")
    v.exact(equivalence.get("predecessorGovernanceReceipt"), {
        "path": str(PREVIOUS_GOVERNANCE_RECEIPT), "mode": "0600", "bytes": 5739,
        "sha256": "e2d60685644680ced28dfcf14a8848a7fe04fdd3804e654389da83cb3b86e4a4",
        "recordedAt": "2026-10-26T23:31:54Z",
    }, "equivalence predecessor receipt")
    v.exact(equivalence.get("reusedReviewedEvidence"), [
        {
            "purpose": "TARGETED_VERIFICATION_OF_THE_EXACT_CONTENT_ADDRESSED_TREE",
            "path": str(TARGETED_RECEIPT), "mode": "0600", "bytes": 3217,
            "sha256": "903abb7ffdbd7153a95f21144eda24b7978f8c4d1d50f36bcd6e02323f0d8d2b",
            "commit": ORIGINAL_APPROVAL_COMMIT, "tree": RESEALED_APPROVAL_TREE,
            "recordedAt": "2026-10-26T23:04:11Z",
        },
        {
            "purpose": "INDEPENDENT_POST_IMPLEMENTATION_REVIEW_OF_THE_EXACT_CONTENT_ADDRESSED_TREE",
            "path": str(POST_REVIEW_RECEIPT), "mode": "0600", "bytes": 1992,
            "sha256": "b0d52957d72e87f15797e41a043bda491a35ee63255f83d86e9dcbb6b5984e5e",
            "commit": ORIGINAL_APPROVAL_COMMIT, "tree": RESEALED_APPROVAL_TREE,
            "recordedAt": "2026-10-26T23:04:11Z",
        },
    ], "equivalence reused evidence")
    v.exact(equivalence.get("testRerun"), {
        "performed": False,
        "reason": "NO_TEST_RERUN_BECAUSE_THE_SUCCESSOR_GIT_TREE_IS_BYTE_IDENTICAL_TO_THE_ALREADY_TARGETED_AND_INDEPENDENTLY_REVIEWED_TREE",
        "scopeExpansionAuthorized": False,
    }, "equivalence test rerun")
    v.exact(equivalence.get("findings"), {"p0": [], "p1": [], "p2": []}, "equivalence findings")
    v.exact(equivalence.get("decision"), "GO_FOR_EXACT_3970B26C_SAME_TREE_RESEAL_EVIDENCE_REUSE_ONLY", "equivalence decision")
    v.exact(equivalence.get("authority"), {
        "exactSuccessorEvidenceReuseRecorded": True,
        "originalEvidenceMutated": False,
        "newRuntimeContentAuthorized": False,
        "additionalSourceOrTestChangeAuthorized": False,
        "backendDwpDevIntegrationAuthorized": False,
        "featureActivationAuthorized": False,
        "tenantEnrollmentAuthorized": False,
        "productionReleaseAuthorized": False,
        "businessCompletionCredit": 0,
    }, "equivalence authority")
    v.exact(equivalence.get("causalOrder"), [
        {"event": "ORIGINAL_COMMIT", "at": "2026-10-26T23:03:36Z"},
        {
            "event": "ORIGINAL_TARGETED_VERIFICATION_AND_POST_IMPLEMENTATION_REVIEW",
            "at": "2026-10-26T23:04:11Z",
        },
        {"event": "IMMEDIATE_PARENT_GOVERNANCE_RECEIPT", "at": "2026-10-26T23:31:54Z"},
        {"event": "EXACT_SAME_TREE_SUCCESSOR_COMMIT", "at": "2026-10-27T00:02:58Z"},
        {
            "event": "SAME_TREE_RESEAL_EQUIVALENCE_REVIEW_AND_RECORD",
            "at": "2026-10-27T00:11:11Z",
        },
    ], "equivalence causal order")
    v.exact(
        equivalence.get("reviewedAt"), equivalence.get("recordedAt"),
        "equivalence review/record time mismatch",
    )
    v.exact(
        equivalence.get("recordedBy"),
        "INDEPENDENT_HRM013_APPROVAL_RUNTIME_SAME_TREE_RESEAL_REVIEW",
        "equivalence recorder",
    )

    v.exact(
        text("rev-list", "--parents", "-n", "1", GOVERNANCE_COMMIT).split(),
        [GOVERNANCE_COMMIT, GOVERNANCE_PARENT], "governance carrier parent",
    )
    v.exact(text("rev-parse", f"{GOVERNANCE_COMMIT}^{{tree}}"), GOVERNANCE_TREE, "governance carrier tree")
    v.exact(between(GOVERNANCE_PARENT, GOVERNANCE_COMMIT), {GOVERNANCE_AUTHORITY, GOVERNANCE_REVIEW}, "governance carrier paths")
    v.exact(text("rev-parse", f"origin/{GOVERNANCE_BRANCH}"), GOVERNANCE_COMMIT, "governance branch push")
    v.require(ancestor(GOVERNANCE_COMMIT, RESEAL_BASE), "governance carrier missing from reseal base")
    governance_pins = {
        GOVERNANCE_AUTHORITY: (9846, "61f0a6fbde31295d1f0ef91a7b2ce9be6a88ff0d0aa501cc7a4a0a55d50f4a80"),
        GOVERNANCE_REVIEW: (2187, "57aea401fdd2a62de9a3dd2687fca0e7bfeda6e992e80632283f4a12464ee24f"),
        SHARED_VALIDATOR: (78934, "d177b30ca101a1cc3fd69749ff064d5a8e73224ff308fe812f18690ef291d49e"),
        "package.json": (14858, "ca2693e843d440191a84f29d417e553c8296b5b93a1dcdc8644b13d1a92eb1bb"),
    }
    for path, (size, digest) in governance_pins.items():
        data = blob(GOVERNANCE_COMMIT, path)
        v.require(data is not None, f"governance artifact missing: {path}")
        v.exact(pin(path, data or b""), {"path": path, "bytes": size, "sha256": digest}, f"governance artifact pin: {path}")
        v.exact(mode(GOVERNANCE_COMMIT, path), "100644", f"governance artifact mode: {path}")

    governance_receipt, _ = secure_receipt(
        v, GOVERNANCE_RECEIPT, 10234,
        "d43c7c5e9556633989638c9f29627611afa117edda93fcf4ca22113d7844423d",
    )
    v.exact(set(governance_receipt), {
        "schema", "state", "sharedIntegrationCommit", "sharedIntegrationTree",
        "immediateParentCommit", "descendantCommit", "descendantTree",
        "descendantChangedPaths", "sharedElevenBlobPins",
        "governingFrontendCarrierCommit", "governingFrontendCarrierTree",
        "governingAuthorityArtifact", "governingValidatorArtifact",
        "governingIndependentReviewArtifact", "governingPackageArtifact",
        "previousGovernanceReceiptSha256", "p0", "p1", "p2", "decision",
        "recordedAt", "recordedBy",
    }, "governance receipt key set")
    v.exact(governance_receipt.get("schema"), "dwp.hris.wave7.hrm013-shared-contract-backend-descendant-governance-receipt.v1", "governance receipt schema")
    v.exact(governance_receipt.get("state"), "REVIEWED_ORDERED_BACKEND_DESCENDANT_GOVERNANCE_SHARED_ELEVEN_BLOBS_IMMUTABLE", "governance receipt state")
    v.exact(governance_receipt.get("immediateParentCommit"), BACKEND_BASE, "governance receipt parent")
    v.exact(governance_receipt.get("descendantCommit"), RESEALED_APPROVAL_COMMIT, "governance receipt commit")
    v.exact(governance_receipt.get("descendantTree"), RESEALED_APPROVAL_TREE, "governance receipt tree")
    v.exact(governance_receipt.get("descendantChangedPaths"), changed_paths, "governance receipt paths")
    v.exact(
        governance_receipt.get("sharedIntegrationCommit"),
        predecessor_governance.get("sharedIntegrationCommit"),
        "governance shared integration commit",
    )
    v.exact(
        governance_receipt.get("sharedIntegrationTree"),
        predecessor_governance.get("sharedIntegrationTree"),
        "governance shared integration tree",
    )
    v.exact(
        governance_receipt.get("sharedElevenBlobPins"),
        predecessor_governance.get("sharedElevenBlobPins"),
        "governance shared-eleven pin drift",
    )
    v.exact(governance_receipt.get("governingFrontendCarrierCommit"), GOVERNANCE_COMMIT, "governance receipt carrier")
    v.exact(governance_receipt.get("governingFrontendCarrierTree"), GOVERNANCE_TREE, "governance receipt carrier tree")
    v.exact(governance_receipt.get("governingAuthorityArtifact"), {
        "path": GOVERNANCE_AUTHORITY, "bytes": 9846,
        "sha256": "61f0a6fbde31295d1f0ef91a7b2ce9be6a88ff0d0aa501cc7a4a0a55d50f4a80",
    }, "governance receipt authority")
    v.exact(governance_receipt.get("governingIndependentReviewArtifact"), {
        "path": GOVERNANCE_REVIEW, "bytes": 2187,
        "sha256": "57aea401fdd2a62de9a3dd2687fca0e7bfeda6e992e80632283f4a12464ee24f",
    }, "governance receipt review")
    v.exact(governance_receipt.get("governingValidatorArtifact"), {
        "path": SHARED_VALIDATOR, "bytes": 78934,
        "sha256": "d177b30ca101a1cc3fd69749ff064d5a8e73224ff308fe812f18690ef291d49e",
    }, "governance receipt validator")
    v.exact(governance_receipt.get("governingPackageArtifact"), {
        "path": "package.json", "bytes": 14858,
        "sha256": "ca2693e843d440191a84f29d417e553c8296b5b93a1dcdc8644b13d1a92eb1bb",
    }, "governance receipt package")
    v.exact(governance_receipt.get("previousGovernanceReceiptSha256"), "e2d60685644680ced28dfcf14a8848a7fe04fdd3804e654389da83cb3b86e4a4", "governance receipt chain")
    v.exact(
        (governance_receipt.get("p0"), governance_receipt.get("p1"), governance_receipt.get("p2"), governance_receipt.get("decision")),
        (0, 0, 0, "GO_FOR_EXACT_BACKEND_DESCENDANT_GOVERNANCE_ONLY"),
        "governance receipt verdict",
    )

    governance_review = load(
        blob(GOVERNANCE_COMMIT, GOVERNANCE_REVIEW) or b"",
        "governance independent review",
    )
    times = [
        parse_time(targeted.get("verifiedAt"), "targeted verifiedAt"),
        parse_time(post.get("reviewedAt"), "post reviewedAt"),
        parse_time(predecessor_governance.get("recordedAt"), "predecessor governance recordedAt"),
        parse_time(
            text_backend("show", "-s", "--format=%cI", RESEALED_APPROVAL_COMMIT),
            "resealed Approval committedAt",
        ),
        parse_time(equivalence.get("recordedAt"), "equivalence recordedAt"),
        parse_time(governance_review.get("reviewedAt"), "governance reviewedAt"),
        parse_time(
            text("show", "-s", "--format=%cI", GOVERNANCE_COMMIT),
            "governance carrier committedAt",
        ),
        parse_time(governance_receipt.get("recordedAt"), "governance recordedAt"),
    ]
    v.require(all(left <= right for left, right in zip(times, times[1:])), "reseal receipt causal order")
    v.require(times[-1] <= datetime.now(timezone.utc) + timedelta(minutes=5), "reseal receipt is in the future")
    return times[-1]


def validate_reseal_authority_review(
    v: V, blobs: dict[str, bytes], commit: str | None, evidence_at: datetime,
) -> None:
    authority = load(blobs[RESEAL_AUTHORITY], "reseal authority")
    v.exact(authority, expected_reseal_authority(), "reseal authority drift")
    review = load(blobs[RESEAL_REVIEW], "reseal review")
    v.exact(set(review), {
        "schema", "state", "reviewedAt", "reviewer", "scope", "findings",
        "finalVerdict", "authority", "artifactPins",
    }, "reseal review key set")
    v.exact(review.get("schema"), "dwp.hris.wave7.hrm013-approval-reseal-central-integration-independent-review.v1", "reseal review schema")
    v.exact(review.get("state"), "INDEPENDENT_ZERO_FINDING_REVIEW_OF_EXACT_TWELVE_PATH_APPROVAL_RESEAL_INTEGRATION", "reseal review state")
    v.exact(review.get("reviewer"), "INDEPENDENT_HRM013_APPROVAL_RESEAL_INTEGRATION_REVIEW", "reseal reviewer")
    v.exact(review.get("scope"), {
        "authorityPath": RESEAL_AUTHORITY,
        "governingValidatorPath": VALIDATOR,
        "modifiedValidatorPaths": RESEAL_MODIFIED_VALIDATORS,
        "packagePath": "package.json",
        "reviewedBoundaries": [
            "EXACT_DIRECT_CHILD_TWELVE_PATH_CARRIER",
            "B9880EC6_REMAINS_IMMUTABLE_HISTORICAL_EVIDENCE_ONLY",
            "ONLY_EXACT_3970B26C_SAME_TREE_SUCCESSOR_MAY_FAST_FORWARD",
            "EXACT_ORDERED_DESCENDANT_GOVERNANCE_AND_SECURE_EXTERNAL_RECEIPTS",
            "TEN_CURRENT_VALIDATOR_BLOBS_AND_UNCHANGED_EIGHTEEN_COMMAND_PACKAGE",
            "NO_FEATURE_TENANT_CREDENTIAL_OR_PRODUCTION_AUTHORITY",
        ],
    }, "reseal review scope")
    v.exact(review.get("findings"), {"p0": [], "p1": [], "p2": []}, "reseal review findings")
    v.exact(review.get("finalVerdict"), {
        "p0": 0, "p1": 0, "p2": 0,
        "decision": "GO_FOR_EXACT_APPROVAL_SAME_TREE_RESEAL_CORRECTION_AND_3970_FAST_FORWARD_AFTER_GOVERNANCE_CLOSURE",
    }, "reseal review verdict")
    v.exact(review.get("authority"), {
        "independentReviewComplete": True,
        "exactTwelvePathCarrierCommitAndPushAuthorized": True,
        "exact3970FastForwardAuthorizedAfterGovernanceClosure": True,
        "originalB988IntegrationAuthorized": False,
        "additionalSourceOrTestChangeAuthorized": False,
        "featureActivationOrTenantOrCredentialOrProductionAuthority": False,
        "businessCompletionCredit": 0,
    }, "reseal review authority")
    v.exact(review.get("artifactPins"), [
        pin(RESEAL_AUTHORITY, blobs[RESEAL_AUTHORITY]),
        *[pin(path, blobs[path]) for path in RESEAL_MODIFIED_VALIDATORS],
        pin("package.json", blobs["package.json"]),
    ], "reseal review pins")
    reviewed_at = parse_time(review.get("reviewedAt"), "reseal reviewedAt")
    v.require(evidence_at <= reviewed_at, "reseal review predates external evidence")
    v.require(reviewed_at <= datetime.now(timezone.utc) + timedelta(minutes=5), "reseal review is in the future")
    if commit is None:
        latest = max(
            datetime.fromtimestamp(int((ROOT / path).stat().st_mtime), timezone.utc)
            for path in [RESEAL_AUTHORITY, *RESEAL_MODIFIED_VALIDATORS, "package.json"]
        )
        v.require(latest <= reviewed_at, "reseal review predates authoring snapshot")
    else:
        committed_at = parse_time(text("show", "-s", "--format=%cI", commit), "reseal carrier committedAt")
        v.require(reviewed_at <= committed_at, "reseal review follows carrier commit")


def validate_reseal_successor(v: V, authoring: bool) -> dict[str, Any]:
    v.exact(text("rev-parse", f"{RESEAL_BASE}^{{tree}}"), RESEAL_BASE_TREE, "reseal base tree")
    if authoring:
        v.exact(text("branch", "--show-current"), RESEAL_BRANCH, "reseal authoring branch")
        v.exact(text("rev-parse", "HEAD"), RESEAL_BASE, "reseal authoring head")
        v.exact(changes(), RESEAL_PATHS, "reseal authoring path set")
        commit = None
    else:
        additions: list[str] = []
        for path in (RESEAL_AUTHORITY, RESEAL_REVIEW):
            found = list(filter(None, text(
                "log", "--diff-filter=A", "--format=%H", "--", path,
            ).splitlines()))
            v.exact(len(found), 1, f"reseal artifact introduction count: {path}")
            additions.extend(found)
        v.exact(len(set(additions)), 1, "reseal authority/review introduced separately")
        commit = additions[0] if additions else ""
        v.exact(
            text("rev-list", "--parents", "-n", "1", commit).split(),
            [commit, RESEAL_BASE], "reseal carrier is not exact direct child",
        )
        v.exact(between(RESEAL_BASE, commit), RESEAL_PATHS, "reseal carrier path set")
        head = text("rev-parse", "HEAD")
        origin = text("rev-parse", "origin/dwp-dev")
        v.exact(head, origin, "frontend HEAD/origin drift after reseal")
        v.require(ancestor(commit, head) and ancestor(commit, origin), "reseal carrier not on pushed dwp-dev")
        v.exact(changes(), set(), "frontend dirty after reseal")

    blobs: dict[str, bytes] = {}
    for path in [RESEAL_AUTHORITY, RESEAL_REVIEW, *RESEAL_MODIFIED_VALIDATORS]:
        if commit is None:
            data = regular_live(v, path)
        else:
            v.exact(mode(commit, path), "100644", f"reseal carrier mode: {path}")
            data = blob(commit, path)
            v.require(data is not None, f"reseal carrier blob missing: {path}")
            data = data or b""
            v.exact(mode(text("rev-parse", "HEAD"), path), "100644", f"current reseal mode: {path}")
            v.exact(pin(path, regular_live(v, path)), pin(path, data), f"current reseal drift: {path}")
        blobs[path] = data
    package_data = regular_live(v, "package.json")
    blobs["package.json"] = package_data
    validate_reseal_package(v, package_data)
    evidence_at = validate_reseal_external_evidence(v)
    validate_reseal_authority_review(v, blobs, commit, evidence_at)

    v.exact(text_backend("branch", "--show-current"), "dwp-dev", "backend branch")
    backend_head = text_backend("rev-parse", "HEAD")
    v.require(backend_head in {BACKEND_BASE, RESEALED_APPROVAL_COMMIT}, "backend head outside reseal lifecycle")
    v.exact(text_backend("rev-parse", "origin/dwp-dev"), backend_head, "backend origin drift")
    v.exact(output_backend("status", "--porcelain=v1", "--untracked-files=all").decode(), "", "backend dirty")
    if authoring:
        v.exact(backend_head, BACKEND_BASE, "backend moved during reseal authoring")
    return {"commit": commit, "blobs": blobs, "backendHead": backend_head}


def validate(authoring: bool, reseal_authoring: bool = False) -> int:
    v = V()
    v.require(not (authoring and reseal_authoring), "authoring modes are mutually exclusive")
    runtime(v, authoring or reseal_authoring)
    for left, right in (
        ({"x": True}, {"x": 1}),
        ([False], [0]),
        ({"x": [True, {"y": False}]}, {"x": [1, {"y": 0}]}),
    ):
        v.require(not strict_equal(left, right), "nested strict-type fixture accepted")
    v.exact(text("rev-parse", "--show-toplevel"), str(ROOT), "frontend root")
    v.exact(text("rev-parse", f"{BASE}^{{tree}}"), BASE_TREE, "base tree")
    if authoring:
        v.exact(text("branch", "--show-current"), BRANCH, "authoring branch")
        v.exact(text("rev-parse", "HEAD"), BASE, "authoring head")
        v.exact(text("rev-parse", "origin/dwp-dev"), BASE, "authoring origin")
        v.exact(changes(), CARRIER_PATHS, "authoring path set")
        commit = None
    else:
        additions: list[str] = []
        for path in (AUTHORITY, REVIEW, VALIDATOR):
            found = list(filter(None, text(
                "log", "--diff-filter=A", "--format=%H", "--", path,
            ).splitlines()))
            v.exact(len(found), 1, f"successor introduction count: {path}")
            additions.extend(found)
        v.exact(len(set(additions)), 1, "successor artifacts introduced separately")
        commit = additions[0] if additions else ""
        v.exact(
            text("rev-list", "--parents", "-n", "1", commit).split(),
            [commit, BASE], "successor is not exact direct child",
        )
        v.exact(between(BASE, commit), CARRIER_PATHS, "successor path set")
        head = text("rev-parse", "HEAD")
        origin = text("rev-parse", "origin/dwp-dev")
        v.require(ancestor(commit, head) and ancestor(commit, origin), "successor not on pushed dwp-dev")
        if reseal_authoring:
            v.exact(text("branch", "--show-current"), RESEAL_BRANCH, "reseal branch during historical lifecycle validation")
            v.exact(head, RESEAL_BASE, "reseal base during historical lifecycle validation")
            v.exact(changes(), RESEAL_PATHS, "reseal path set during historical lifecycle validation")
        else:
            v.exact(head, origin, "frontend HEAD/origin drift")
            v.exact(changes(), set(), "frontend dirty")

    reseal = None if authoring else validate_reseal_successor(v, reseal_authoring)
    reseal_blobs = None if reseal is None else reseal["blobs"]
    head_for_evidence = BASE if commit is None else (
        RESEAL_BASE if reseal_authoring else text("rev-parse", "HEAD")
    )
    validate_approval_hardening(
        v, head_for_evidence, reseal_blobs, reseal_authoring=reseal_authoring,
    )
    blobs: dict[str, bytes] = {}
    for path in [AUTHORITY, REVIEW, VALIDATOR, *MODIFIED_VALIDATORS, "package.json"]:
        if commit is None:
            data = regular_live(v, path)
        else:
            v.exact(mode(commit, path), "100644", f"successor carrier mode: {path}")
            data = blob(commit, path)
            v.require(data is not None, f"successor blob missing: {path}")
            data = data or b""
            v.exact(mode(text("rev-parse", "HEAD"), path), "100644", f"current mode: {path}")
            expected_live = (
                reseal_blobs[path]
                if reseal_blobs is not None and path in reseal_blobs
                else data
            )
            v.exact(pin(path, regular_live(v, path)), pin(path, expected_live), f"current successor drift: {path}")
        blobs[path] = data
    validate_package(v, blobs["package.json"])
    v.exact(pin("package.json", regular_live(v, "package.json")), pin("package.json", blobs["package.json"]), "live package drift")
    for path, (introduced, size, digest) in ORIGINALS.items():
        found = list(filter(None, text(
            "log", "--diff-filter=A", "--format=%H", "--", path,
        ).splitlines()))
        v.exact(found, [introduced], f"original introduction drift: {path}")
        original = blob(introduced, path)
        v.require(original is not None, f"original validator missing: {path}")
        v.exact(pin(path, original or b""), {
            "path": path, "bytes": size, "sha256": digest,
        }, f"original validator pin: {path}")
        v.require(pin(path, original or b"") != pin(path, blobs[path]), f"validator has no lifecycle correction: {path}")
    validate_review(v, blobs, commit)
    if reseal_authoring:
        state = "APPROVAL_RESEAL_INTEGRATION_SUCCESSOR_READY_TO_COMMIT_AND_PUSH"
    elif reseal is not None and reseal["backendHead"] == BACKEND_BASE:
        state = "APPROVAL_RESEAL_INTEGRATION_SUCCESSOR_IN_FORCE_READY_FOR_BACKEND_FAST_FORWARD"
    elif reseal is not None:
        state = "APPROVAL_RESEAL_INTEGRATION_SUCCESSOR_IN_FORCE_BACKEND_INTEGRATED"
    else:
        state = (
            "VALIDATOR_LIFECYCLE_SUCCESSOR_READY_TO_COMMIT_AND_PUSH"
            if commit is None
            else "VALIDATOR_LIFECYCLE_SUCCESSOR_IN_FORCE"
        )
    print(f"PASS state={state} checks={v.checks}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--authoring", action="store_true")
    parser.add_argument("--approval-reseal-authoring", action="store_true")
    args = parser.parse_args()
    try:
        return validate(args.authoring, args.approval_reseal_authoring)
    except (
        VerificationError, OSError, UnicodeError, KeyError, TypeError,
        ValueError, json.JSONDecodeError,
    ) as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
