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


def validate_approval_hardening(v: V, head: str) -> None:
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
        v.exact(pin(path, current or b""), pin(path, data or b""), f"hardened validator changed: {path}")
        v.exact(pin(path, regular_live(v, path)), pin(path, data or b""), f"live hardened validator drift: {path}")


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


def validate(authoring: bool) -> int:
    v = V()
    runtime(v, authoring)
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
        v.exact(head, origin, "frontend HEAD/origin drift")
        v.require(ancestor(commit, head) and ancestor(commit, origin), "successor not on pushed dwp-dev")
        v.exact(changes(), set(), "frontend dirty")

    head_for_evidence = BASE if commit is None else text("rev-parse", "HEAD")
    validate_approval_hardening(v, head_for_evidence)
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
            v.exact(pin(path, regular_live(v, path)), pin(path, data), f"current successor drift: {path}")
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
    args = parser.parse_args()
    try:
        return validate(args.authoring)
    except (
        VerificationError, OSError, UnicodeError, KeyError, TypeError,
        ValueError, json.JSONDecodeError,
    ) as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
