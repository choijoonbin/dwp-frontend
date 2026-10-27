#!/usr/bin/env python3
"""Fail-closed Approval-first integration validator for HRM-013 Phase 4."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import stat
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

SCRIPT = Path(__file__).absolute()
ROOT = SCRIPT.parents[5]
BACKEND = Path("/Users/a10697/Work/DWP/dwp-backend")
RECEIPTS = Path(
    "/Users/a10697/Work/DWP/.codex-worktrees/hris/wave7-20261026/"
    "batch06/hrm013-owner-runtime/receipts"
)
GIT = "/usr/bin/git"
FRONTEND_BASE = "b2fa6d56f16ce5befe0e366ca55d34ef8f42f58e"
FRONTEND_TREE = "13f7c1690864eb34b7ae317f7a2a7e25124be73f"
BRANCH = "codex/hris-wave7-batch06-hrm013-approval-runtime-integration-frontend-20261027-r1"
BACKEND_BASE = "bed31127123a318358f495f66edced7b024469d8"
BACKEND_TREE = "e5564ff7a81e5dd0a85d0e61f091ec0714a1f777"
APPROVAL_BRANCH = "codex/hris-wave7-batch06-hrm013-approval-runtime-backend-20261026-r1"
APPROVAL_COMMIT = "b9880ec6cf0ad65e08d86c6624ee2ac91a748716"
APPROVAL_TREE = "3b6033339058ae684dafe94361bc653d28d6fe75"
APPROVAL_RESEAL_BRANCH = "codex/hris-wave7-batch06-hrm013-approval-runtime-backend-20261027-r2"
APPROVAL_RESEAL_COMMIT = "3970b26c111c0492d7a7b637b8153f7a6844318d"
PEOPLE_BRANCH = "codex/hris-wave7-batch06-hrm013-people-owner-runtime-backend-20261026-r1"
PEOPLE_COMMIT = "626e1de182678d28a82d6801855c039ed6f3f637"
PEOPLE_TREE = "4366c40e6c2bec1b5ab6cb2f09b28bdd72754c08"
GOVERNANCE_PARENT = "54f312dd799570da659cbc438a40af5495aa153c"
GOVERNANCE_BRANCH = "codex/hris-wave7-batch06-hrm013-bed31127-governance-frontend-20261027-r1"
GOVERNANCE_COMMIT = "189bb49645515bbd3e4423cfb93dcc53ff40ed75"
GOVERNANCE_TREE = "6acc5bf2cece78655d8653071ac38a3b06647bc0"
RESEAL_GOVERNANCE_PARENT = "189bb49645515bbd3e4423cfb93dcc53ff40ed75"
RESEAL_GOVERNANCE_BRANCH = "codex/hris-wave7-batch06-hrm013-b9880-governance-frontend-20261027-r2"
RESEAL_GOVERNANCE_COMMIT = "dca74e7fabc58651a40b2b9605b38da5adc1b9b8"
RESEAL_GOVERNANCE_TREE = "57611528080e3b19183abea146ad140e6f7b5cfc"
SHARED_INTEGRATION_COMMIT = "3505cb2e84fc73f97d62de385cc347c5f8c81572"
SHARED_INTEGRATION_TREE = "fa84a79668fd0f133d34c81d5a649747a6c527b6"
PREVIOUS_BACKEND_COMMIT = "a1c0d8ecdbc959d378ef04dc401ee0ff2348ef6c"
PREVIOUS_GOVERNANCE_RECEIPT_SHA256 = (
    "88b33f889471fd7568b1c01e8c8231374a5d92bb4612b58716efd2faa8993bd4"
)
DIR = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-approval-runtime-integration-r1"
)
AUTHORITY = f"{DIR}/approval-runtime-central-integration-authority.v1.json"
VALIDATOR = f"{DIR}/validate_hrm013_approval_runtime_integration.py"
REVIEW = f"{DIR}/independent-review.v1.json"
AUTH_RUNTIME_VALIDATOR = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-auth-runtime-authority-r1/"
    "validate_hrm013_auth_runtime_authority.py"
)
READINESS_VALIDATOR = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-approval-readiness-authority-r1/"
    "validate_hrm013_approval_readiness_authority.py"
)
READINESS_SUCCESSOR_VALIDATOR = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-approval-readiness-successor-r1/"
    "validate_hrm013_approval_readiness_successor.py"
)
PHASE4_VALIDATOR = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-owner-runtime-phase4-authority-r1/"
    "validate_hrm013_owner_runtime_phase4_authority.py"
)
CLARIFICATION_VALIDATOR = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-approval-drain-clarification-r1/"
    "validate_hrm013_approval_drain_clarification.py"
)
GOV_AUTHORITY = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-backend-descendant-governance/"
    f"{BACKEND_BASE}/authority.v1.json"
)
GOV_REVIEW = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-backend-descendant-governance/"
    f"{BACKEND_BASE}/independent-review.v1.json"
)
TARGET_RECEIPT = RECEIPTS / "approval-runtime-targeted-verification-receipt.v1.json"
POST_REVIEW = RECEIPTS / "approval-runtime-post-implementation-review.v1.json"
RESEAL_EQUIVALENCE_RECEIPT = (
    RECEIPTS / "approval-runtime-same-tree-reseal-equivalence-receipt.v1.json"
)
GOV_RECEIPT = (
    RECEIPTS / "backend-descendants" /
    f"{BACKEND_BASE}.hrm013-shared-contract-governance.v1.json"
)
PREVIOUS_GOV_RECEIPT = (
    RECEIPTS / "backend-descendants" /
    f"{PREVIOUS_BACKEND_COMMIT}.hrm013-shared-contract-governance.v1.json"
)
RESEAL_GOVERNANCE_ROOT = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-backend-descendant-governance/"
    f"{APPROVAL_RESEAL_COMMIT}"
)
RESEAL_GOV_AUTHORITY = f"{RESEAL_GOVERNANCE_ROOT}/authority.v1.json"
RESEAL_GOV_REVIEW = f"{RESEAL_GOVERNANCE_ROOT}/independent-review.v1.json"
RESEAL_GOV_RECEIPT = (
    RECEIPTS / "backend-descendants" /
    f"{APPROVAL_RESEAL_COMMIT}.hrm013-shared-contract-governance.v1.json"
)
SHARED_VALIDATOR = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-shared-contract-integration-r1/"
    "validate_hrm013_shared_contract_integration.py"
)
SHARED_PATHS = [
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
CARRIER_PATHS = {
    "package.json", AUTHORITY, VALIDATOR, REVIEW, AUTH_RUNTIME_VALIDATOR,
    READINESS_VALIDATOR, READINESS_SUCCESSOR_VALIDATOR, PHASE4_VALIDATOR,
    CLARIFICATION_VALIDATOR,
}
MODIFIED_VALIDATORS = [
    AUTH_RUNTIME_VALIDATOR, READINESS_VALIDATOR, READINESS_SUCCESSOR_VALIDATOR,
    PHASE4_VALIDATOR, CLARIFICATION_VALIDATOR,
]
ENV = {
    "PATH": "/usr/bin:/bin", "HOME": "/var/empty", "LC_ALL": "C",
    "LANG": "C", "GIT_CONFIG_NOSYSTEM": "1",
    "GIT_CONFIG_GLOBAL": "/dev/null", "GIT_NO_REPLACE_OBJECTS": "1",
}


class Error(RuntimeError):
    pass


class Checks:
    def __init__(self) -> None:
        self.count = 0

    def require(self, condition: bool, message: str) -> None:
        self.count += 1
        if not condition:
            raise Error(message)

    def exact(self, actual: Any, expected: Any, message: str) -> None:
        self.count += 1
        if type(actual) is not type(expected) or actual != expected:
            raise Error(f"{message}: expected={expected!r} actual={actual!r}")


def run(repo: Path, *args: str) -> subprocess.CompletedProcess[bytes]:
    return subprocess.run(
        [GIT, "-C", str(repo), *args], stdout=subprocess.PIPE,
        stderr=subprocess.PIPE, env=ENV, check=False,
    )


def output(repo: Path, *args: str) -> bytes:
    result = run(repo, *args)
    if result.returncode:
        raise Error(result.stderr.decode(errors="replace").strip())
    return result.stdout


def text(repo: Path, *args: str) -> str:
    return output(repo, *args).decode().strip()


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def load(data: bytes, label: str) -> dict[str, Any]:
    def pairs(items: list[tuple[str, Any]]) -> dict[str, Any]:
        result: dict[str, Any] = {}
        for key, value in items:
            if key in result:
                raise Error(f"duplicate JSON key in {label}: {key}")
            result[key] = value
        return result
    value = json.loads(data.decode(), object_pairs_hook=pairs)
    if not isinstance(value, dict):
        raise Error(f"JSON root is not an object: {label}")
    return value


def changed(repo: Path) -> set[str]:
    raw = output(repo, "status", "--porcelain=v1", "--untracked-files=all").decode()
    return {line[3:] for line in raw.rstrip("\n").splitlines() if line}


def diff_paths(repo: Path, older: str, newer: str) -> set[str]:
    return set(filter(None, text(repo, "diff", "--name-only", older, newer).splitlines()))


def pin(path: str, data: bytes) -> dict[str, Any]:
    return {"path": path, "bytes": len(data), "sha256": sha(data)}


def secure_receipt(checks: Checks, path: Path, size: int, digest: str) -> dict[str, Any]:
    checks.require(path.exists() and not path.is_symlink(), f"receipt missing: {path}")
    info = path.stat()
    checks.require(stat.S_ISREG(info.st_mode), f"receipt not regular: {path}")
    checks.exact(stat.S_IMODE(info.st_mode), 0o600, f"receipt mode: {path.name}")
    checks.exact(info.st_uid, os.getuid(), f"receipt owner: {path.name}")
    checks.exact(info.st_nlink, 1, f"receipt link count: {path.name}")
    data = path.read_bytes()
    checks.exact(len(data), size, f"receipt bytes: {path.name}")
    checks.exact(sha(data), digest, f"receipt hash: {path.name}")
    return load(data, path.name)


def secure_external_receipt(checks: Checks, path: Path) -> tuple[dict[str, Any], bytes]:
    """Read a secure external receipt without trusting its own size or hash."""
    checks.require(path.exists() and not path.is_symlink(), f"receipt missing: {path}")
    info = path.stat()
    checks.require(stat.S_ISREG(info.st_mode), f"receipt not regular: {path}")
    checks.exact(stat.S_IMODE(info.st_mode), 0o600, f"receipt mode: {path.name}")
    checks.exact(info.st_uid, os.getuid(), f"receipt owner: {path.name}")
    checks.exact(info.st_nlink, 1, f"receipt link count: {path.name}")
    data = path.read_bytes()
    return load(data, path.name), data


def parse_timestamp(value: Any, label: str) -> datetime:
    if type(value) is not str:
        raise Error(f"{label} is not a timestamp string")
    normalized = value[:-1] + "+00:00" if value.endswith("Z") else value
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError as exc:
        raise Error(f"{label} is not a valid timestamp") from exc
    if parsed.tzinfo is None or parsed.utcoffset() is None or parsed.microsecond:
        raise Error(f"{label} must have an explicit timezone and second precision")
    return parsed.astimezone(timezone.utc)


def carrier_commit(checks: Checks) -> str | None:
    commits = list(filter(None, text(
        ROOT, "log", "--diff-filter=A", "--format=%H", "--", AUTHORITY
    ).splitlines()))
    if not commits:
        return None
    checks.exact(len(commits), 1, "ambiguous integration carrier")
    commit = commits[0]
    checks.exact(
        text(ROOT, "rev-list", "--parents", "-n", "1", commit).split(),
        [commit, FRONTEND_BASE], "integration carrier is not a direct child",
    )
    checks.exact(diff_paths(ROOT, FRONTEND_BASE, commit), CARRIER_PATHS, "carrier paths")
    return commit


def validate_carrier_modes(checks: Checks, carrier: str | None) -> None:
    for path in CARRIER_PATHS:
        if carrier is None:
            candidate = ROOT / path
            checks.require(candidate.exists() and not candidate.is_symlink(), f"carrier path missing: {path}")
            info = candidate.stat()
            checks.require(stat.S_ISREG(info.st_mode), f"carrier path not regular: {path}")
            checks.exact(stat.S_IMODE(info.st_mode), 0o644, f"carrier path mode: {path}")
        else:
            entry = text(ROOT, "ls-tree", carrier, "--", path).split()
            checks.require(len(entry) >= 4, f"carrier path absent from tree: {path}")
            checks.exact(entry[0], "100644", f"carrier git mode: {path}")


def source(path: str, carrier: str | None) -> bytes:
    if carrier is None:
        candidate = ROOT / path
        if candidate.is_symlink() or not candidate.is_file():
            raise Error(f"missing or symlinked artifact: {path}")
        return candidate.read_bytes()
    return output(ROOT, "show", f"{carrier}:{path}")


def validate_lane_evidence(checks: Checks) -> datetime:
    target = secure_receipt(
        checks, TARGET_RECEIPT, 3217,
        "903abb7ffdbd7153a95f21144eda24b7978f8c4d1d50f36bcd6e02323f0d8d2b",
    )
    review = secure_receipt(
        checks, POST_REVIEW, 1992,
        "b0d52957d72e87f15797e41a043bda491a35ee63255f83d86e9dcbb6b5984e5e",
    )
    checks.exact(target["testedCommit"], APPROVAL_COMMIT, "target receipt commit")
    checks.exact(target["testedTree"], APPROVAL_TREE, "target receipt tree")
    checks.exact(target["verification"]["compileExitCode"], 0, "compile result")
    checks.exact(target["verification"]["smallestRerunFailures"], 0, "unit rerun")
    checks.exact(target["verification"]["crossServiceFailures"], 0, "cross result")
    checks.exact(review["laneCommit"], APPROVAL_COMMIT, "review commit")
    checks.exact(review["laneTree"], APPROVAL_TREE, "review tree")
    checks.exact(
        (review["p0"], review["p1"], review["p2"], review["decision"]),
        (0, 0, 0, "GO_FOR_DORMANT_DEFAULT_OFF_APPROVAL_RUNTIME_LANE_BRANCH_PUSH_ONLY"),
        "post-review verdict",
    )
    target_at = parse_timestamp(target.get("verifiedAt"), "target receipt verifiedAt")
    review_at = parse_timestamp(review.get("reviewedAt"), "post implementation reviewedAt")
    checks.require(target_at <= review_at, "Approval evidence causal order")
    checks.require(
        review_at <= datetime.now(timezone.utc) + timedelta(minutes=5),
        "Approval evidence is in the future",
    )
    return review_at


def validate_reseal_equivalence(checks: Checks) -> datetime:
    receipt = secure_receipt(
        checks,
        RESEAL_EQUIVALENCE_RECEIPT,
        10119,
        "052f58e89bfb0088dec975c0de659923b6778adf79103a0bc925a94722ab8b81",
    )
    checks.exact(set(receipt), {
        "schema", "state", "repository", "originalReviewedCommit",
        "exactSuccessorCommit", "equivalenceProof",
        "predecessorGovernanceReceipt", "reusedReviewedEvidence",
        "testRerun", "causalOrder", "findings", "decision", "authority",
        "reviewedAt", "recordedAt", "recordedBy",
    }, "reseal equivalence receipt key set")
    checks.exact(receipt["schema"],
        "dwp.hris.wave7.hrm013-approval-runtime-same-tree-reseal-equivalence-receipt.v1",
        "reseal equivalence schema")
    checks.exact(receipt["state"],
        "HASH_BOUND_ZERO_FINDING_APPROVAL_RUNTIME_SAME_TREE_RESEAL_EQUIVALENCE",
        "reseal equivalence state")
    checks.exact(receipt["repository"], "dwp-backend", "reseal repository")
    checks.exact(receipt["originalReviewedCommit"], {
        "branch": APPROVAL_BRANCH,
        "commit": APPROVAL_COMMIT,
        "parent": BACKEND_BASE,
        "tree": APPROVAL_TREE,
        "committedAt": "2026-10-26T23:03:36Z",
    }, "historical Approval evidence identity")
    checks.exact(receipt["exactSuccessorCommit"], {
        "branch": APPROVAL_RESEAL_BRANCH,
        "commit": APPROVAL_RESEAL_COMMIT,
        "parent": BACKEND_BASE,
        "tree": APPROVAL_TREE,
        "committedAt": "2026-10-27T00:02:58Z",
        "remoteRef": f"refs/remotes/origin/{APPROVAL_RESEAL_BRANCH}",
        "remoteRefCommit": APPROVAL_RESEAL_COMMIT,
    }, "Approval reseal identity")
    historical_paths = diff_paths(BACKEND, BACKEND_BASE, APPROVAL_COMMIT)
    reseal_paths = diff_paths(BACKEND, BACKEND_BASE, APPROVAL_RESEAL_COMMIT)
    checks.exact(len(historical_paths), 45, "historical Approval path count")
    checks.exact(reseal_paths, historical_paths, "Approval reseal path equivalence")
    checks.exact(diff_paths(BACKEND, APPROVAL_COMMIT, APPROVAL_RESEAL_COMMIT), set(), "Approval reseal tree diff")
    proof = receipt["equivalenceProof"]
    checks.exact(set(proof), {
        "sameImmediateParent", "sameTree", "originalToSuccessorChangedPaths",
        "originalToSuccessorDiffEmpty", "successorChangedPathCountFromParent",
        "successorChangedPathsFromParent", "contentAddressedConclusion",
    }, "reseal equivalence proof key set")
    checks.exact(proof["sameImmediateParent"], True, "reseal same parent")
    checks.exact(proof["sameTree"], True, "reseal same tree")
    checks.exact(proof["originalToSuccessorChangedPaths"], [], "reseal changed paths")
    checks.exact(proof["originalToSuccessorDiffEmpty"], True, "reseal diff empty")
    checks.exact(proof["successorChangedPathCountFromParent"], 45, "reseal path count evidence")
    checks.exact(proof["successorChangedPathsFromParent"], sorted(reseal_paths), "reseal path evidence")
    checks.exact(
        proof["contentAddressedConclusion"],
        "The exact successor commit names the identical Git tree under the identical immediate parent; therefore its source, resources and tests are byte-identical to the independently verified original commit.",
        "reseal content-addressed conclusion",
    )
    checks.exact(receipt["predecessorGovernanceReceipt"], {
        "path": str(GOV_RECEIPT), "mode": "0600", "bytes": 5739,
        "sha256": "e2d60685644680ced28dfcf14a8848a7fe04fdd3804e654389da83cb3b86e4a4",
        "recordedAt": "2026-10-26T23:31:54Z",
    }, "reseal predecessor governance receipt")
    checks.exact(receipt["reusedReviewedEvidence"], [
        {
            "purpose": "TARGETED_VERIFICATION_OF_THE_EXACT_CONTENT_ADDRESSED_TREE",
            "path": str(TARGET_RECEIPT), "mode": "0600", "bytes": 3217,
            "sha256": "903abb7ffdbd7153a95f21144eda24b7978f8c4d1d50f36bcd6e02323f0d8d2b",
            "commit": APPROVAL_COMMIT, "tree": APPROVAL_TREE,
            "recordedAt": "2026-10-26T23:04:11Z",
        },
        {
            "purpose": "INDEPENDENT_POST_IMPLEMENTATION_REVIEW_OF_THE_EXACT_CONTENT_ADDRESSED_TREE",
            "path": str(POST_REVIEW), "mode": "0600", "bytes": 1992,
            "sha256": "b0d52957d72e87f15797e41a043bda491a35ee63255f83d86e9dcbb6b5984e5e",
            "commit": APPROVAL_COMMIT, "tree": APPROVAL_TREE,
            "recordedAt": "2026-10-26T23:04:11Z",
        },
    ], "reused reviewed evidence")
    checks.exact(receipt["testRerun"], {
        "performed": False,
        "reason": "NO_TEST_RERUN_BECAUSE_THE_SUCCESSOR_GIT_TREE_IS_BYTE_IDENTICAL_TO_THE_ALREADY_TARGETED_AND_INDEPENDENTLY_REVIEWED_TREE",
        "scopeExpansionAuthorized": False,
    }, "reseal test-rerun policy")
    checks.exact(receipt["findings"], {"p0": [], "p1": [], "p2": []}, "reseal findings")
    checks.exact(receipt["decision"],
        "GO_FOR_EXACT_3970B26C_SAME_TREE_RESEAL_EVIDENCE_REUSE_ONLY",
        "reseal decision")
    checks.exact(receipt["authority"], {
        "exactSuccessorEvidenceReuseRecorded": True,
        "originalEvidenceMutated": False,
        "newRuntimeContentAuthorized": False,
        "additionalSourceOrTestChangeAuthorized": False,
        "backendDwpDevIntegrationAuthorized": False,
        "featureActivationAuthorized": False,
        "tenantEnrollmentAuthorized": False,
        "productionReleaseAuthorized": False,
        "businessCompletionCredit": 0,
    }, "reseal authority")
    expected_causal_order = [
        {"event": "ORIGINAL_COMMIT", "at": "2026-10-26T23:03:36Z"},
        {"event": "ORIGINAL_TARGETED_VERIFICATION_AND_POST_IMPLEMENTATION_REVIEW", "at": "2026-10-26T23:04:11Z"},
        {"event": "IMMEDIATE_PARENT_GOVERNANCE_RECEIPT", "at": "2026-10-26T23:31:54Z"},
        {"event": "EXACT_SAME_TREE_SUCCESSOR_COMMIT", "at": "2026-10-27T00:02:58Z"},
        {"event": "SAME_TREE_RESEAL_EQUIVALENCE_REVIEW_AND_RECORD", "at": "2026-10-27T00:11:11Z"},
    ]
    checks.exact(receipt["causalOrder"], expected_causal_order, "reseal causal events")
    times = [parse_timestamp(item.get("at"), f"reseal causal event {index}")
             for index, item in enumerate(expected_causal_order)]
    checks.require(all(left <= right for left, right in zip(times, times[1:])), "reseal causal order")
    reviewed_at = parse_timestamp(receipt.get("reviewedAt"), "reseal reviewedAt")
    recorded_at = parse_timestamp(receipt.get("recordedAt"), "reseal recordedAt")
    checks.exact(reviewed_at, recorded_at, "reseal review/record time")
    checks.exact(times[-1], recorded_at, "reseal final causal event")
    checks.require(recorded_at <= datetime.now(timezone.utc) + timedelta(minutes=5), "reseal receipt is in the future")
    checks.exact(receipt["recordedBy"],
        "INDEPENDENT_HRM013_APPROVAL_RUNTIME_SAME_TREE_RESEAL_REVIEW",
        "reseal recordedBy")
    return recorded_at


def validate_reseal_governance(checks: Checks) -> datetime:
    checks.exact(
        text(ROOT, "rev-list", "--parents", "-n", "1", RESEAL_GOVERNANCE_COMMIT).split(),
        [RESEAL_GOVERNANCE_COMMIT, RESEAL_GOVERNANCE_PARENT],
        "reseal governance carrier parent",
    )
    checks.exact(text(ROOT, "rev-parse", f"{RESEAL_GOVERNANCE_COMMIT}^{{tree}}"), RESEAL_GOVERNANCE_TREE, "reseal governance tree")
    checks.exact(
        diff_paths(ROOT, RESEAL_GOVERNANCE_PARENT, RESEAL_GOVERNANCE_COMMIT),
        {RESEAL_GOV_AUTHORITY, RESEAL_GOV_REVIEW},
        "reseal governance carrier paths",
    )
    checks.exact(text(ROOT, "rev-parse", f"origin/{RESEAL_GOVERNANCE_BRANCH}"), RESEAL_GOVERNANCE_COMMIT, "reseal governance branch push")
    checks.require(run(ROOT, "merge-base", "--is-ancestor", RESEAL_GOVERNANCE_COMMIT, "HEAD").returncode == 0, "reseal governance carrier is not in frontend HEAD")
    authority_data = output(ROOT, "show", f"{RESEAL_GOVERNANCE_COMMIT}:{RESEAL_GOV_AUTHORITY}")
    review_data = output(ROOT, "show", f"{RESEAL_GOVERNANCE_COMMIT}:{RESEAL_GOV_REVIEW}")
    checks.exact(pin(RESEAL_GOV_AUTHORITY, authority_data), {
        "path": RESEAL_GOV_AUTHORITY, "bytes": 9846,
        "sha256": "61f0a6fbde31295d1f0ef91a7b2ce9be6a88ff0d0aa501cc7a4a0a55d50f4a80",
    }, "reseal governance authority pin")
    checks.exact(pin(RESEAL_GOV_REVIEW, review_data), {
        "path": RESEAL_GOV_REVIEW, "bytes": 2187,
        "sha256": "57aea401fdd2a62de9a3dd2687fca0e7bfeda6e992e80632283f4a12464ee24f",
    }, "reseal governance review pin")
    previous = secure_receipt(
        checks, GOV_RECEIPT, 5739,
        "e2d60685644680ced28dfcf14a8848a7fe04fdd3804e654389da83cb3b86e4a4",
    )
    receipt = secure_receipt(
        checks, RESEAL_GOV_RECEIPT, 10234,
        "d43c7c5e9556633989638c9f29627611afa117edda93fcf4ca22113d7844423d",
    )
    checks.exact(set(receipt), {
        "schema", "state", "sharedIntegrationCommit", "sharedIntegrationTree",
        "immediateParentCommit", "descendantCommit", "descendantTree",
        "descendantChangedPaths", "sharedElevenBlobPins",
        "governingFrontendCarrierCommit", "governingFrontendCarrierTree",
        "governingAuthorityArtifact", "governingValidatorArtifact",
        "governingIndependentReviewArtifact", "governingPackageArtifact",
        "previousGovernanceReceiptSha256", "p0", "p1", "p2", "decision",
        "recordedAt", "recordedBy",
    }, "reseal governance receipt key set")
    shared_pins = []
    for path in SHARED_PATHS:
        shared_blob = output(BACKEND, "show", f"{SHARED_INTEGRATION_COMMIT}:{path}")
        checks.exact(output(BACKEND, "show", f"{APPROVAL_RESEAL_COMMIT}:{path}"), shared_blob, f"reseal shared blob: {path}")
        shared_pins.append(pin(path, shared_blob))
    expected = {
        "schema": "dwp.hris.wave7.hrm013-shared-contract-backend-descendant-governance-receipt.v1",
        "state": "REVIEWED_ORDERED_BACKEND_DESCENDANT_GOVERNANCE_SHARED_ELEVEN_BLOBS_IMMUTABLE",
        "sharedIntegrationCommit": SHARED_INTEGRATION_COMMIT,
        "sharedIntegrationTree": SHARED_INTEGRATION_TREE,
        "immediateParentCommit": BACKEND_BASE,
        "descendantCommit": APPROVAL_RESEAL_COMMIT,
        "descendantTree": APPROVAL_TREE,
        "descendantChangedPaths": sorted(diff_paths(BACKEND, BACKEND_BASE, APPROVAL_RESEAL_COMMIT)),
        "sharedElevenBlobPins": shared_pins,
        "governingFrontendCarrierCommit": RESEAL_GOVERNANCE_COMMIT,
        "governingFrontendCarrierTree": RESEAL_GOVERNANCE_TREE,
        "governingAuthorityArtifact": pin(RESEAL_GOV_AUTHORITY, authority_data),
        "governingValidatorArtifact": {
            "path": SHARED_VALIDATOR, "bytes": 78934,
            "sha256": "d177b30ca101a1cc3fd69749ff064d5a8e73224ff308fe812f18690ef291d49e",
        },
        "governingIndependentReviewArtifact": pin(RESEAL_GOV_REVIEW, review_data),
        "governingPackageArtifact": {
            "path": "package.json", "bytes": 14858,
            "sha256": "ca2693e843d440191a84f29d417e553c8296b5b93a1dcdc8644b13d1a92eb1bb",
        },
        "previousGovernanceReceiptSha256": "e2d60685644680ced28dfcf14a8848a7fe04fdd3804e654389da83cb3b86e4a4",
        "p0": 0, "p1": 0, "p2": 0,
        "decision": "GO_FOR_EXACT_BACKEND_DESCENDANT_GOVERNANCE_ONLY",
        "recordedBy": "INDEPENDENT_HRM013_BACKEND_DESCENDANT_GOVERNANCE_REVIEW",
    }
    checks.exact({key: receipt.get(key) for key in expected}, expected, "reseal governance receipt evidence")
    previous_at = parse_timestamp(previous.get("recordedAt"), "bed governance recordedAt")
    backend_at = parse_timestamp(text(BACKEND, "show", "-s", "--format=%cI", APPROVAL_RESEAL_COMMIT), "reseal committedAt")
    review_at = parse_timestamp(load(review_data, RESEAL_GOV_REVIEW).get("reviewedAt"), "reseal governance reviewedAt")
    carrier_at = parse_timestamp(text(ROOT, "show", "-s", "--format=%cI", RESEAL_GOVERNANCE_COMMIT), "reseal governance carrier committedAt")
    recorded_at = parse_timestamp(receipt.get("recordedAt"), "reseal governance recordedAt")
    events = [previous_at, backend_at, review_at, carrier_at, recorded_at]
    checks.require(all(left <= right for left, right in zip(events, events[1:])), "reseal governance causal order")
    checks.require(recorded_at <= datetime.now(timezone.utc) + timedelta(minutes=5), "reseal governance receipt is in the future")
    return recorded_at


def validate_backend(checks: Checks) -> str:
    checks.exact(text(BACKEND, "branch", "--show-current"), "dwp-dev", "backend branch")
    head = text(BACKEND, "rev-parse", "HEAD")
    checks.require(head in {BACKEND_BASE, APPROVAL_RESEAL_COMMIT}, "unexpected backend dwp-dev head")
    checks.exact(text(BACKEND, "rev-parse", "origin/dwp-dev"), head, "backend origin drift")
    checks.exact(changed(BACKEND), set(), "backend dwp-dev dirty")
    checks.exact(text(BACKEND, "rev-parse", f"{BACKEND_BASE}^{{tree}}"), BACKEND_TREE, "backend base tree")
    checks.exact(
        text(BACKEND, "rev-list", "--parents", "-n", "1", APPROVAL_COMMIT).split(),
        [APPROVAL_COMMIT, BACKEND_BASE], "Approval commit is not a direct child",
    )
    checks.exact(text(BACKEND, "rev-parse", f"{APPROVAL_COMMIT}^{{tree}}"), APPROVAL_TREE, "Approval tree")
    checks.exact(text(BACKEND, "rev-parse", f"origin/{APPROVAL_BRANCH}"), APPROVAL_COMMIT, "Approval branch push")
    checks.exact(
        text(BACKEND, "rev-list", "--parents", "-n", "1", APPROVAL_RESEAL_COMMIT).split(),
        [APPROVAL_RESEAL_COMMIT, BACKEND_BASE], "Approval reseal is not a direct child",
    )
    checks.exact(text(BACKEND, "rev-parse", f"{APPROVAL_RESEAL_COMMIT}^{{tree}}"), APPROVAL_TREE, "Approval reseal tree")
    checks.exact(text(BACKEND, "rev-parse", f"origin/{APPROVAL_RESEAL_BRANCH}"), APPROVAL_RESEAL_COMMIT, "Approval reseal branch push")
    checks.exact(text(BACKEND, "rev-parse", f"origin/{PEOPLE_BRANCH}"), PEOPLE_COMMIT, "People branch push")
    checks.exact(text(BACKEND, "rev-parse", f"{PEOPLE_COMMIT}^{{tree}}"), PEOPLE_TREE, "People pre-rebase tree")
    checks.require(
        run(BACKEND, "merge-base", "--is-ancestor", PEOPLE_COMMIT, head).returncode != 0,
        "People pre-rebase commit was integrated out of order",
    )
    approval_paths = diff_paths(BACKEND, BACKEND_BASE, APPROVAL_COMMIT)
    checks.exact(len(approval_paths), 45, "Approval path count")
    checks.exact(
        diff_paths(BACKEND, BACKEND_BASE, APPROVAL_RESEAL_COMMIT),
        approval_paths,
        "Approval reseal path equivalence",
    )
    checks.exact(diff_paths(BACKEND, APPROVAL_COMMIT, APPROVAL_RESEAL_COMMIT), set(), "Approval reseal content diff")
    checks.require(
        not any(Path(path).name.startswith("V60") for path in approval_paths),
        "Approval V60 present",
    )
    for revision in (BACKEND_BASE, APPROVAL_COMMIT, APPROVAL_RESEAL_COMMIT):
        v59 = output(
            BACKEND, "show",
            f"{revision}:dwp-approval-server/src/main/resources/db/migration/V59__bridge_hris_separation_task_waivers.sql",
        )
        checks.exact(len(v59), 28589, f"V59 bytes at {revision}")
        checks.exact(
            sha(v59), "03ee5347e25631dd40f35b9a20bc056207ae98c80712a03f6daa69900c814c18",
            f"V59 hash at {revision}",
        )
    return head


def validate_governance(checks: Checks) -> bool:
    checks.exact(
        text(ROOT, "rev-list", "--parents", "-n", "1", GOVERNANCE_COMMIT).split(),
        [GOVERNANCE_COMMIT, GOVERNANCE_PARENT], "governance carrier parent",
    )
    checks.exact(text(ROOT, "rev-parse", f"{GOVERNANCE_COMMIT}^{{tree}}"), GOVERNANCE_TREE, "governance tree")
    checks.exact(
        diff_paths(ROOT, GOVERNANCE_PARENT, GOVERNANCE_COMMIT),
        {GOV_AUTHORITY, GOV_REVIEW}, "governance carrier paths",
    )
    for path in (GOV_AUTHORITY, GOV_REVIEW):
        entry = text(ROOT, "ls-tree", GOVERNANCE_COMMIT, "--", path).split()
        checks.require(len(entry) >= 4, f"governance artifact absent from tree: {path}")
        checks.exact(entry[0], "100644", f"governance artifact git mode: {path}")
    checks.exact(text(ROOT, "rev-parse", f"origin/{GOVERNANCE_BRANCH}"), GOVERNANCE_COMMIT, "governance branch push")
    gov_authority = output(ROOT, "show", f"{GOVERNANCE_COMMIT}:{GOV_AUTHORITY}")
    gov_review = output(ROOT, "show", f"{GOVERNANCE_COMMIT}:{GOV_REVIEW}")
    checks.exact(pin(GOV_AUTHORITY, gov_authority), {
        "path": GOV_AUTHORITY, "bytes": 5279,
        "sha256": "9a8c12bd1d6135db15f842b163c5a35086420a080c50ff422b7b7e52353387f1",
    }, "governance authority pin")
    checks.exact(pin(GOV_REVIEW, gov_review), {
        "path": GOV_REVIEW, "bytes": 2187,
        "sha256": "134efd684222b107ac587418aaccbe0c04e115a723bd2c139b28089036718310",
    }, "governance review pin")
    merged = run(ROOT, "merge-base", "--is-ancestor", GOVERNANCE_COMMIT, "origin/dwp-dev").returncode == 0
    if merged:
        previous = secure_receipt(
            checks, PREVIOUS_GOV_RECEIPT, 9260,
            PREVIOUS_GOVERNANCE_RECEIPT_SHA256,
        )
        receipt, _ = secure_external_receipt(checks, GOV_RECEIPT)
        receipt_keys = {
            "schema", "state", "sharedIntegrationCommit", "sharedIntegrationTree",
            "immediateParentCommit", "descendantCommit", "descendantTree",
            "descendantChangedPaths", "sharedElevenBlobPins",
            "governingFrontendCarrierCommit", "governingFrontendCarrierTree",
            "governingAuthorityArtifact", "governingValidatorArtifact",
            "governingIndependentReviewArtifact", "governingPackageArtifact",
            "previousGovernanceReceiptSha256", "p0", "p1", "p2", "decision",
            "recordedAt", "recordedBy",
        }
        checks.exact(set(receipt), receipt_keys, "governance receipt key set")
        checks.exact(
            text(BACKEND, "rev-list", "--parents", "-n", "1", BACKEND_BASE).split(),
            [BACKEND_BASE, PREVIOUS_BACKEND_COMMIT], "governed backend parent",
        )
        checks.exact(
            text(BACKEND, "rev-parse", f"{SHARED_INTEGRATION_COMMIT}^{{tree}}"),
            SHARED_INTEGRATION_TREE, "shared integration tree",
        )
        shared_pins = []
        for path in SHARED_PATHS:
            shared_blob = output(BACKEND, "show", f"{SHARED_INTEGRATION_COMMIT}:{path}")
            checks.exact(
                output(BACKEND, "show", f"{BACKEND_BASE}:{path}"), shared_blob,
                f"shared blob drift at governed backend: {path}",
            )
            shared_pins.append(pin(path, shared_blob))
        checks.exact(
            previous["sharedElevenBlobPins"], shared_pins,
            "previous receipt shared pins",
        )
        expected = {
            "schema": "dwp.hris.wave7.hrm013-shared-contract-backend-descendant-governance-receipt.v1",
            "state": "REVIEWED_ORDERED_BACKEND_DESCENDANT_GOVERNANCE_SHARED_ELEVEN_BLOBS_IMMUTABLE",
            "sharedIntegrationCommit": SHARED_INTEGRATION_COMMIT,
            "sharedIntegrationTree": SHARED_INTEGRATION_TREE,
            "immediateParentCommit": PREVIOUS_BACKEND_COMMIT,
            "descendantCommit": BACKEND_BASE,
            "descendantTree": BACKEND_TREE,
            "descendantChangedPaths": sorted(diff_paths(BACKEND, PREVIOUS_BACKEND_COMMIT, BACKEND_BASE)),
            "sharedElevenBlobPins": shared_pins,
            "governingFrontendCarrierCommit": GOVERNANCE_COMMIT,
            "governingFrontendCarrierTree": GOVERNANCE_TREE,
            "governingAuthorityArtifact": pin(GOV_AUTHORITY, gov_authority),
            "governingValidatorArtifact": {
                "path": SHARED_VALIDATOR,
                "bytes": 78934,
                "sha256": "d177b30ca101a1cc3fd69749ff064d5a8e73224ff308fe812f18690ef291d49e",
            },
            "governingIndependentReviewArtifact": pin(GOV_REVIEW, gov_review),
            "governingPackageArtifact": pin(
                "package.json", output(ROOT, "show", f"{GOVERNANCE_COMMIT}:package.json")
            ),
            "previousGovernanceReceiptSha256": PREVIOUS_GOVERNANCE_RECEIPT_SHA256,
            "p0": 0,
            "p1": 0,
            "p2": 0,
            "decision": "GO_FOR_EXACT_BACKEND_DESCENDANT_GOVERNANCE_ONLY",
            "recordedBy": "INDEPENDENT_HRM013_BACKEND_DESCENDANT_GOVERNANCE_REVIEW",
        }
        checks.exact(
            {key: receipt.get(key) for key in expected}, expected,
            "governance receipt evidence",
        )
        previous_at = parse_timestamp(previous.get("recordedAt"), "previous receipt recordedAt")
        backend_at = parse_timestamp(
            text(BACKEND, "show", "-s", "--format=%cI", BACKEND_BASE),
            "governed backend committedAt",
        )
        review_at = parse_timestamp(
            load(gov_review, GOV_REVIEW).get("reviewedAt"),
            "governance review reviewedAt",
        )
        carrier_at = parse_timestamp(
            text(ROOT, "show", "-s", "--format=%cI", GOVERNANCE_COMMIT),
            "governance carrier committedAt",
        )
        recorded_at = parse_timestamp(receipt.get("recordedAt"), "governance receipt recordedAt")
        checks.require(
            recorded_at <= datetime.now(timezone.utc) + timedelta(minutes=5),
            "governance receipt recordedAt is in the future",
        )
        events = [previous_at, backend_at, review_at, carrier_at, recorded_at]
        checks.require(
            all(left <= right for left, right in zip(events, events[1:])),
            "governance receipt causal order",
        )
    else:
        checks.require(not GOV_RECEIPT.exists(), "governance receipt exists before ancestry merge")
    return merged


def validate_content(checks: Checks, carrier: str | None) -> datetime:
    authority_data = source(AUTHORITY, carrier)
    checks.exact(pin(AUTHORITY, authority_data), {
        "path": AUTHORITY,
        "bytes": 5131,
        "sha256": "11fd746188dd954be11d5266ea04236bd00a1305bdc98f077640203dd8831e3a",
    }, "authority artifact pin")
    authority = load(authority_data, AUTHORITY)
    checks.exact(set(authority), {
        "schema", "state", "sliceId", "lane", "carrier", "governanceRepair",
        "backendIntegration", "evidence", "peopleBoundary",
        "validatorLifecycleCorrection", "authority", "next",
    }, "authority key set")
    checks.exact(authority["schema"], "dwp.hris.wave7.hrm013-approval-runtime-central-integration-authority.v1", "authority schema")
    checks.exact(authority["state"], "HASH_BOUND_ZERO_FINDING_APPROVAL_FIRST_INTEGRATION_AND_MISSING_DESCENDANT_GOVERNANCE_REPAIR", "authority state")
    checks.exact(authority["sliceId"], "BASE-TFR-HRM-013", "slice")
    checks.exact(authority["lane"], "APPROVAL_RUNTIME_INTEGRATION", "lane")
    checks.exact(authority["carrier"], {
        "repository": "dwp-frontend", "branch": BRANCH,
        "baseCommit": FRONTEND_BASE, "baseTree": FRONTEND_TREE,
        "requiredDirectChild": True, "exactChangedPathCount": 9,
    }, "carrier")
    checks.exact(authority["governanceRepair"], {
        "backendDescendantCommit": BACKEND_BASE,
        "carrierBranch": GOVERNANCE_BRANCH,
        "carrierCommit": GOVERNANCE_COMMIT,
        "carrierTree": GOVERNANCE_TREE,
        "requiredParent": GOVERNANCE_PARENT,
        "authority": {
            "path": GOV_AUTHORITY, "bytes": 5279,
            "sha256": "9a8c12bd1d6135db15f842b163c5a35086420a080c50ff422b7b7e52353387f1",
        },
        "independentReview": {
            "path": GOV_REVIEW, "bytes": 2187,
            "sha256": "134efd684222b107ac587418aaccbe0c04e115a723bd2c139b28089036718310",
        },
        "integrationMode": "NO_FF_MERGE_PRESERVING_THE_EXACT_CARRIER_COMMIT_AS_ANCESTOR",
        "externalReceiptPath": str(GOV_RECEIPT),
    }, "governance repair")
    checks.exact(authority["backendIntegration"], {
        "repository": "dwp-backend", "targetBranch": "dwp-dev",
        "baseCommit": BACKEND_BASE, "baseTree": BACKEND_TREE,
        "approvalBranch": APPROVAL_BRANCH, "approvalCommit": APPROVAL_COMMIT,
        "approvalTree": APPROVAL_TREE, "requiredDirectChild": True,
        "integrationMode": "DIRECT_FAST_FORWARD_ONLY", "changedPathCount": 45,
    }, "backend integration")
    checks.exact(authority["evidence"], {
        "targetedVerificationReceipt": {
            "path": str(TARGET_RECEIPT), "mode": "0600", "bytes": 3217,
            "sha256": "903abb7ffdbd7153a95f21144eda24b7978f8c4d1d50f36bcd6e02323f0d8d2b",
        },
        "postImplementationReview": {
            "path": str(POST_REVIEW), "mode": "0600", "bytes": 1992,
            "sha256": "b0d52957d72e87f15797e41a043bda491a35ee63255f83d86e9dcbb6b5984e5e",
        },
    }, "authority evidence")
    checks.exact(authority["peopleBoundary"], {
        "branch": PEOPLE_BRANCH, "preRebaseCommit": PEOPLE_COMMIT,
        "preRebaseTree": PEOPLE_TREE, "centralIntegrationAuthorized": False,
        "requiredNext": "REBASE_ON_APPROVAL_INTEGRATED_DWP_DEV_AND_RUN_ONLY_COLLISION_SENSITIVE_VERIFICATION",
    }, "People boundary")
    checks.exact(authority["validatorLifecycleCorrection"], {
        "appendOnlyPackagePrefixChecks": [
            AUTH_RUNTIME_VALIDATOR, READINESS_VALIDATOR, READINESS_SUCCESSOR_VALIDATOR,
        ],
        "approvalIntegrationStateChecks": [PHASE4_VALIDATOR, CLARIFICATION_VALIDATOR],
    }, "validator lifecycle correction")
    checks.exact(authority["authority"], {
        "independentReviewComplete": True, "carrierCommitAndPushAuthorized": True,
        "governanceRepairMergeAuthorizedAfterCarrierPush": True,
        "governanceReceiptAuthoringAuthorizedAfterAncestryMerge": True,
        "approvalDirectFastForwardIntegrationAuthorizedAfterGovernanceClosure": True,
        "peopleIntegrationAuthorized": False, "featureActivationAuthorized": False,
        "tenantEnrollmentAuthorized": False, "runtimeCredentialProvisioningAuthorized": False,
        "productionReleaseAuthorized": False, "businessCompletionCredit": 0,
    }, "authority flags")
    checks.exact(
        authority["next"],
        "COMMIT_AND_PUSH_CARRIER_THEN_PRESERVE_GOVERNANCE_ANCESTRY_CREATE_RECEIPT_VALIDATE_CHAIN_AND_FAST_FORWARD_APPROVAL_ONLY",
        "next action",
    )
    package = load(source("package.json", carrier), "package.json")
    base_package = load(output(ROOT, "show", f"{FRONTEND_BASE}:package.json"), "base package")
    expected = base_package["scripts"]["hris:current-contracts:check"] + " && python3 " + VALIDATOR
    checks.exact(package["scripts"]["hris:current-contracts:check"], expected, "package chain")
    review = load(source(REVIEW, carrier), REVIEW)
    checks.exact(set(review), {
        "schema", "state", "reviewedAt", "reviewer", "scope", "findings",
        "finalVerdict", "authority", "artifactPins",
    }, "review key set")
    checks.exact(review["schema"], "dwp.hris.wave7.hrm013-approval-runtime-integration-independent-review.v1", "review schema")
    checks.exact(
        review["state"],
        "INDEPENDENT_ZERO_FINDING_REVIEW_OF_GOVERNANCE_REPAIR_AND_APPROVAL_FIRST_INTEGRATION",
        "review state",
    )
    checks.exact(
        review["reviewer"],
        "INDEPENDENT_HRM013_APPROVAL_RUNTIME_INTEGRATION_REVIEW",
        "reviewer",
    )
    checks.exact(review["scope"], {
        "authorityPath": AUTHORITY,
        "validatorPath": VALIDATOR,
        "packagePath": "package.json",
        "modifiedValidatorPaths": MODIFIED_VALIDATORS,
        "reviewedBoundaries": [
            "EXACT_NINE_PATH_DIRECT_CHILD_CARRIER",
            "MISSING_BED31127_DESCENDANT_GOVERNANCE_COMMIT_PRESERVED_BY_NO_FF_MERGE",
            "EXTERNAL_DESCENDANT_RECEIPT_REQUIRED_BEFORE_BACKEND_MOVE",
            "APPROVAL_EXACT_DIRECT_CHILD_AND_REVIEW_RECEIPTS",
            "APPROVAL_FIRST_DIRECT_FAST_FORWARD_ONLY",
            "PEOPLE_REMAINS_UNMERGED_AND_REBASE_REQUIRED",
            "APPEND_ONLY_VALIDATOR_LIFECYCLE_WITH_NO_ACTIVATION_AUTHORITY",
        ],
    }, "review scope")
    checks.exact(review["findings"], {"p0": [], "p1": [], "p2": []}, "review findings")
    checks.exact(review["finalVerdict"], {
        "p0": 0, "p1": 0, "p2": 0,
        "decision": "GO_FOR_GOVERNANCE_ANCESTRY_REPAIR_THEN_APPROVAL_DIRECT_FAST_FORWARD_ONLY",
    }, "review verdict")
    checks.exact(review["authority"], {
        "independentReviewComplete": True, "carrierCommitAndPushAuthorized": True,
        "governanceAncestryMergeAuthorized": True,
        "approvalDirectFastForwardAuthorizedAfterGovernanceClosure": True,
        "peopleIntegrationAuthorized": False, "activationOrProductionAuthority": False,
        "businessCompletionCredit": 0,
    }, "review authority")
    checks.exact(review["artifactPins"], [
        pin(path, source(path, carrier))
        for path in [AUTHORITY, VALIDATOR, *MODIFIED_VALIDATORS, "package.json"]
    ], "review pins")
    reviewed_at = parse_timestamp(review.get("reviewedAt"), "integration review reviewedAt")
    checks.require(
        reviewed_at <= datetime.now(timezone.utc) + timedelta(minutes=5),
        "integration review is in the future",
    )
    return reviewed_at


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--authoring", action="store_true")
    args = parser.parse_args()
    checks = Checks()
    try:
        checks.exact(text(ROOT, "rev-parse", "--show-toplevel"), str(ROOT), "frontend root")
        checks.exact(text(ROOT, "rev-parse", f"{FRONTEND_BASE}^{{tree}}"), FRONTEND_TREE, "frontend base tree")
        evidence_at = validate_lane_evidence(checks)
        reseal_evidence_at = validate_reseal_equivalence(checks)
        reseal_governance_at = validate_reseal_governance(checks)
        checks.require(
            reseal_evidence_at <= reseal_governance_at,
            "reseal governance receipt predates same-tree equivalence evidence",
        )
        backend_head = validate_backend(checks)
        governance_merged = validate_governance(checks)
        carrier = carrier_commit(checks)
        validate_carrier_modes(checks, carrier)
        reviewed_at = validate_content(checks, carrier)
        approval_commit_at = parse_timestamp(
            text(BACKEND, "show", "-s", "--format=%cI", APPROVAL_COMMIT),
            "Approval runtime committedAt",
        )
        governance_commit_at = parse_timestamp(
            text(ROOT, "show", "-s", "--format=%cI", GOVERNANCE_COMMIT),
            "governance carrier committedAt",
        )
        checks.require(
            max(evidence_at, approval_commit_at, governance_commit_at) <= reviewed_at,
            "integration review precedes required evidence",
        )
        if carrier is None:
            checks.require(args.authoring, "uncommitted carrier requires --authoring")
            checks.exact(text(ROOT, "rev-parse", "HEAD"), FRONTEND_BASE, "authoring head")
            checks.exact(text(ROOT, "branch", "--show-current"), BRANCH, "authoring branch")
            checks.exact(changed(ROOT), CARRIER_PATHS, "authoring paths")
            latest_artifact_mtime = max(
                datetime.fromtimestamp(int((ROOT / path).stat().st_mtime), timezone.utc)
                for path in CARRIER_PATHS if path != REVIEW
            )
            checks.require(
                latest_artifact_mtime <= reviewed_at,
                "integration review predates the final authoring snapshot",
            )
            checks.exact(backend_head, BACKEND_BASE, "authoring backend state")
            checks.require(not governance_merged, "governance merged before authority carrier")
            state = "APPROVAL_RUNTIME_INTEGRATION_AUTHORITY_READY_TO_COMMIT_AND_PUSH"
        else:
            carrier_commit_at = parse_timestamp(
                text(ROOT, "show", "-s", "--format=%cI", carrier),
                "integration carrier committedAt",
            )
            checks.require(reviewed_at <= carrier_commit_at, "integration review follows carrier commit")
            checks.exact(text(ROOT, "rev-parse", f"origin/{BRANCH}"), carrier, "carrier branch push")
            checks.require(
                run(ROOT, "merge-base", "--is-ancestor", carrier, "origin/dwp-dev").returncode == 0,
                "integration carrier not in frontend dwp-dev",
            )
            if not governance_merged:
                checks.exact(backend_head, BACKEND_BASE, "backend moved before governance closure")
                state = "APPROVAL_RUNTIME_INTEGRATION_AUTHORITY_IN_FORCE_GOVERNANCE_MERGE_REQUIRED"
            elif backend_head == BACKEND_BASE:
                state = "APPROVAL_RUNTIME_GOVERNANCE_CLOSED_READY_FOR_BACKEND_FAST_FORWARD"
            else:
                state = "APPROVAL_RUNTIME_DIRECT_FAST_FORWARD_INTEGRATED"
        print(f"PASS state={state} checks={checks.count}")
        return 0
    except (Error, OSError, KeyError, ValueError, json.JSONDecodeError) as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
