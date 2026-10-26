#!/usr/bin/env python3
"""Fail-closed validator for the reviewed Approval-readiness fast-forward."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import stat
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Any


SCRIPT = Path(__file__).absolute()
ROOT = SCRIPT.parents[5]
BACKEND = Path("/Users/a10697/Work/DWP/dwp-backend")
LANE = Path(
    "/Users/a10697/Work/DWP/.codex-worktrees/hris/wave7-20261026/"
    "batch06/hrm013-owner-runtime/approval-readiness"
)
RECEIPTS = Path(
    "/Users/a10697/Work/DWP/.codex-worktrees/hris/wave7-20261026/"
    "batch06/hrm013-owner-runtime/receipts"
)
GIT = "/usr/bin/git"

FRONTEND_BASE = "2f4fccfebada4628145595ab65e48e270d28aedd"
FRONTEND_TREE = "9d8600614fa00f575ce093443539beca607731fb"
BACKEND_BASE = "a1c0d8ecdbc959d378ef04dc401ee0ff2348ef6c"
BACKEND_TREE = "b2173c7448d2e88b5a7f9278f0084d591c4462bf"
LANE_COMMIT = "bed31127123a318358f495f66edced7b024469d8"
LANE_TREE = "e5564ff7a81e5dd0a85d0e61f091ec0714a1f777"
CARRIER_BRANCH = (
    "codex/hris-wave7-batch06-hrm013-approval-readiness-"
    "integration-frontend-20261027-r1"
)
LANE_BRANCH = (
    "codex/hris-wave7-batch06-hrm013-approval-readiness-backend-20261027-r1"
)
DIR = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-approval-readiness-integration-r1"
)
AUTHORITY = f"{DIR}/approval-readiness-central-integration-authority.v1.json"
VALIDATOR = f"{DIR}/validate_hrm013_approval_readiness_integration.py"
REVIEW = f"{DIR}/independent-review.v1.json"
SUCCESSOR_VALIDATOR = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-approval-readiness-successor-r1/"
    "validate_hrm013_approval_readiness_successor.py"
)
CARRIER_PATHS = {
    "package.json", AUTHORITY, VALIDATOR, REVIEW, SUCCESSOR_VALIDATOR,
}
LANE_PATHS = [
    "dwp-approval-server/build.gradle",
    "dwp-approval-server/src/main/java/com/dwp/services/approval/security/ApprovalPepProjectionLineage.java",
    "dwp-approval-server/src/main/java/com/dwp/services/approval/security/ApprovalPepProjectionLoader.java",
    "dwp-approval-server/src/main/java/com/dwp/services/approval/security/ApprovalPilotPepRegistry.java",
    "dwp-approval-server/src/test/java/com/dwp/services/approval/security/ApprovalExtensionV9PepRegistryTest.java",
    "dwp-approval-server/src/test/java/com/dwp/services/approval/security/ApprovalRelease31PepContractTest.java",
    "dwp-approval-server/src/test/java/com/dwp/services/approval/security/ApprovalRelease32PepContractTest.java",
    "dwp-approval-server/src/test/java/com/dwp/services/approval/security/ApprovalRelease62PepContractTest.java",
    "dwp-auth-server/src/test/java/com/dwp/services/auth/service/ProductSurfaceStepUpRuntimeSpringFixture.java",
]
TARGETED = RECEIPTS / "approval-readiness-targeted-verification-receipt.v1.json"
POST_REVIEW = RECEIPTS / "approval-readiness-post-implementation-review.v1.json"
SEALED_RECEIPTS = [
    (TARGETED, 6023, "954728a1d81d24ae872eeb145b03077ac979c59363012416d33f9384f4196c92"),
    (POST_REVIEW, 2006, "97a7b31b7bb6010cbf74f6d3ed75658907725aab427b2366aaa45285e045541e"),
]
AUTHORITY_MAP = {
    "independentReviewComplete": True,
    "carrierCommitAndPushAuthorized": True,
    "backendFastForwardIntegrationAuthorizedAfterCarrierPush": True,
    "sourceBranchDeletionAuthorized": False,
    "additionalBackendSourceChangesAuthorized": False,
    "approvalRuntimeImplementationAuthorized": False,
    "peopleOwnerRuntimeImplementationAuthorized": False,
    "featureEnablementAuthorized": False,
    "tenantEnrollmentAuthorized": False,
    "productionReleaseAuthorized": False,
    "businessCompletionCredit": 0,
}
REVIEW_AUTHORITY = {
    "independentReviewComplete": True,
    "carrierCommitAndPushAuthorized": True,
    "exactBackendFastForwardAuthorizedAfterCarrierPush": True,
    "additionalBackendSourceChangesAuthorized": False,
    "phase4RuntimeImplementationAuthorized": False,
    "productionReleaseAuthorized": False,
    "businessCompletionCredit": 0,
}
REVIEW_BOUNDARIES = [
    "EXACT_FRONTEND_CARRIER_BASE_AND_FIVE_PATHS",
    "EXACT_BACKEND_DIRECT_CHILD_COMMIT_TREE_AND_NINE_PATHS",
    "HASH_BOUND_TARGETED_VERIFICATION_AND_POST_IMPLEMENTATION_REVIEW",
    "FAST_FORWARD_ONLY_TO_EXACT_REVIEWED_BACKEND_COMMIT",
    "NO_PHASE4_RUNTIME_ACTIVATION_TENANT_OR_PRODUCTION_AUTHORITY",
]
ENV = {
    "PATH": "/usr/bin:/bin", "HOME": "/var/empty", "LC_ALL": "C", "LANG": "C",
    "GIT_CONFIG_NOSYSTEM": "1", "GIT_CONFIG_GLOBAL": "/dev/null",
    "GIT_NO_REPLACE_OBJECTS": "1",
}


class Error(RuntimeError):
    pass


class Check:
    def __init__(self) -> None:
        self.count = 0

    def require(self, value: bool, message: str) -> None:
        self.count += 1
        if not value:
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


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def pin(path: str, data: bytes) -> dict[str, Any]:
    return {"path": path, "bytes": len(data), "sha256": digest(data)}


def load_bytes(data: bytes, label: str) -> dict[str, Any]:
    def pairs(values: list[tuple[str, Any]]) -> dict[str, Any]:
        result: dict[str, Any] = {}
        for key, value in values:
            if key in result:
                raise Error(f"duplicate JSON key in {label}: {key}")
            result[key] = value
        return result

    value = json.loads(data.decode(), object_pairs_hook=pairs)
    if not isinstance(value, dict):
        raise Error(f"JSON root is not an object: {label}")
    return value


def changed(repo: Path) -> set[str]:
    lines = output(repo, "status", "--porcelain=v1", "--untracked-files=all").decode()
    return {line[3:] for line in lines.rstrip("\n").splitlines() if line}


def diff_paths(repo: Path, older: str, newer: str) -> set[str]:
    return set(filter(None, text(repo, "diff", "--name-only", older, newer).splitlines()))


def carrier_commit(c: Check) -> str | None:
    additions = list(filter(None, text(
        ROOT, "log", "--diff-filter=A", "--format=%H", "--", AUTHORITY
    ).splitlines()))
    if not additions:
        return None
    c.exact(len(additions), 1, "ambiguous integration carrier")
    commit = additions[0]
    c.exact(
        text(ROOT, "rev-list", "--parents", "-n", "1", commit).split(),
        [commit, FRONTEND_BASE], "integration carrier is not a direct child",
    )
    c.exact(diff_paths(ROOT, FRONTEND_BASE, commit), CARRIER_PATHS, "carrier paths")
    return commit


def source(path: str, carrier: str | None) -> bytes:
    if carrier is None:
        return (ROOT / path).read_bytes()
    return output(ROOT, "show", f"{carrier}:{path}")


def secure_receipt(c: Check, path: Path, size: int, expected_sha: str) -> dict[str, Any]:
    c.require(path.exists() and not path.is_symlink(), f"receipt missing or symlinked: {path.name}")
    info = path.stat()
    c.require(stat.S_ISREG(info.st_mode), f"receipt is not regular: {path.name}")
    c.exact(stat.S_IMODE(info.st_mode), 0o600, f"receipt mode: {path.name}")
    c.exact(info.st_uid, os.getuid(), f"receipt owner: {path.name}")
    c.exact(info.st_nlink, 1, f"receipt link count: {path.name}")
    data = path.read_bytes()
    c.exact(len(data), size, f"receipt bytes: {path.name}")
    c.exact(digest(data), expected_sha, f"receipt hash: {path.name}")
    return load_bytes(data, path.name)


def validate_evidence(c: Check) -> None:
    targeted = secure_receipt(c, *SEALED_RECEIPTS[0])
    post = secure_receipt(c, *SEALED_RECEIPTS[1])
    c.exact(targeted["authorityCarrierCommit"], FRONTEND_BASE, "targeted carrier")
    c.exact(targeted["baseCommit"], BACKEND_BASE, "targeted backend base")
    c.exact(targeted["baseTree"], BACKEND_TREE, "targeted backend base tree")
    c.exact(targeted["testedCommit"], LANE_COMMIT, "targeted commit")
    c.exact(targeted["testedTree"], LANE_TREE, "targeted tree")
    c.exact(targeted["branch"], LANE_BRANCH, "targeted branch")
    c.exact(targeted["changedPaths"], LANE_PATHS, "targeted paths")
    c.exact(targeted["exitCodes"], [0, 0, 0], "targeted exit codes")
    c.exact(post["authorityCarrierCommit"], FRONTEND_BASE, "post-review carrier")
    c.exact(post["laneCommit"], LANE_COMMIT, "post-review commit")
    c.exact(post["laneTree"], LANE_TREE, "post-review tree")
    c.exact(post["changedPaths"], LANE_PATHS, "post-review paths")
    c.exact([post["p0"], post["p1"], post["p2"]], [0, 0, 0], "post-review findings")
    c.exact(post["decision"], "GO_FOR_APPROVAL_READINESS_CORRECTION_BRANCH_PUSH_ONLY", "post-review decision")
    artifacts = targeted["changedArtifacts"]
    c.exact([item["path"] for item in artifacts], LANE_PATHS, "artifact path order")
    for item in artifacts:
        data = output(LANE, "show", f"{LANE_COMMIT}:{item['path']}")
        c.exact(pin(item["path"], data), item, f"artifact pin: {item['path']}")


def validate_content(c: Check, carrier: str | None) -> None:
    authority = load_bytes(source(AUTHORITY, carrier), AUTHORITY)
    review = load_bytes(source(REVIEW, carrier), REVIEW)
    package = load_bytes(source("package.json", carrier), "package.json")
    base_package = load_bytes(output(ROOT, "show", f"{FRONTEND_BASE}:package.json"), "base package")
    expected_script = (
        base_package["scripts"]["hris:current-contracts:check"]
        + " && python3 " + VALIDATOR
    )
    c.exact(package["scripts"]["hris:current-contracts:check"], expected_script, "package chain")
    c.exact(
        set(authority), {"schema", "state", "lane", "carrier", "backendIntegration", "sealedEvidence", "authority", "next"},
        "authority key set",
    )
    c.exact(
        authority["schema"],
        "dwp.hris.wave7.hrm013-approval-readiness-central-integration-authority.v1",
        "authority schema",
    )
    c.exact(
        authority["state"],
        "INDEPENDENTLY_REVIEWED_HASH_BOUND_APPROVAL_READINESS_FAST_FORWARD_INTEGRATION_AUTHORITY",
        "authority state",
    )
    c.exact(authority["lane"], "APPROVAL_PHASE4_READINESS_CORRECTION_INTEGRATION", "authority lane")
    c.exact(authority["carrier"], {
        "repository": "dwp-frontend", "branch": CARRIER_BRANCH,
        "baseCommit": FRONTEND_BASE, "baseTree": FRONTEND_TREE,
        "requiredDirectChild": True, "exactChangedPathCount": 5,
    }, "authority carrier")
    c.exact(authority["backendIntegration"], {
        "repository": "dwp-backend", "sourceBranch": LANE_BRANCH,
        "sourceCommit": LANE_COMMIT, "sourceTree": LANE_TREE,
        "targetBranch": "dwp-dev", "expectedTargetBefore": BACKEND_BASE,
        "operation": "FAST_FORWARD_ONLY", "expectedTargetAfter": LANE_COMMIT,
        "mergeCommitForbidden": True, "rebaseForbidden": True,
    }, "backend integration authority")
    c.exact(authority["sealedEvidence"], [
        {"path": str(path), "bytes": size, "sha256": sha}
        for path, size, sha in SEALED_RECEIPTS
    ], "sealed evidence")
    c.exact(authority["authority"], AUTHORITY_MAP, "authority grants")
    c.exact(
        authority["next"],
        "AFTER_EXACT_BACKEND_DWP_DEV_INTEGRATION_ISSUE_FRESH_PHASE4_APPROVAL_AND_PEOPLE_TOKENS_FROM_THE_SAME_CORRECTED_BASE",
        "authority next step",
    )
    c.exact(
        set(review), {"schema", "reviewedAt", "reviewer", "scope", "findings", "finalVerdict", "authority", "artifactPins"},
        "review key set",
    )
    c.exact(
        review["schema"],
        "dwp.hris.wave7.hrm013-approval-readiness-central-integration-authority-independent-review.v1",
        "review schema",
    )
    c.exact(
        review["reviewer"],
        "INDEPENDENT_HRM013_APPROVAL_READINESS_CENTRAL_INTEGRATION_REVIEW",
        "reviewer",
    )
    c.exact(review["scope"], {
        "authorityPath": AUTHORITY,
        "validatorPath": VALIDATOR,
        "successorValidatorPath": SUCCESSOR_VALIDATOR,
        "packagePath": "package.json",
        "reviewedBoundaries": REVIEW_BOUNDARIES,
    }, "review scope")
    c.exact(review["findings"], {
        "p0": [], "p1": [], "p2": [],
        "notes": [
            "The carrier permits only a direct fast-forward of the exact independently reviewed Approval readiness commit.",
            "The targeted verification and post-implementation review receipts are owner-only and hash-bound.",
            "No Phase 4 runtime implementation, feature activation, tenant enrollment or production release is authorized.",
        ],
    }, "review findings")
    c.exact(review["finalVerdict"], {
        "p0": 0, "p1": 0, "p2": 0,
        "decision": "GO_FOR_APPROVAL_READINESS_CENTRAL_INTEGRATION_CARRIER_COMMIT_AND_PUSH_ONLY",
    }, "review verdict")
    c.exact(review["authority"], REVIEW_AUTHORITY, "review authority")
    expected_pins = [pin(path, source(path, carrier)) for path in (
        AUTHORITY, VALIDATOR, SUCCESSOR_VALIDATOR, "package.json",
    )]
    c.exact(review["artifactPins"], expected_pins, "review artifact pins")
    datetime.fromisoformat(review["reviewedAt"].replace("Z", "+00:00"))


def validate_backend(c: Check) -> str:
    c.exact(text(BACKEND, "rev-parse", f"{BACKEND_BASE}^{{tree}}"), BACKEND_TREE, "backend base tree")
    c.exact(text(LANE, "rev-parse", "HEAD"), LANE_COMMIT, "lane head")
    c.exact(text(LANE, "branch", "--show-current"), LANE_BRANCH, "lane branch")
    c.exact(text(LANE, "rev-parse", f"{LANE_COMMIT}^{{tree}}"), LANE_TREE, "lane tree")
    c.exact(
        text(LANE, "rev-list", "--parents", "-n", "1", LANE_COMMIT).split(),
        [LANE_COMMIT, BACKEND_BASE], "lane commit is not a direct child",
    )
    c.exact(diff_paths(LANE, BACKEND_BASE, LANE_COMMIT), set(LANE_PATHS), "lane paths")
    c.exact(changed(LANE), set(), "lane worktree is dirty")
    c.exact(text(BACKEND, "rev-parse", f"origin/{LANE_BRANCH}"), LANE_COMMIT, "lane branch not pushed")
    c.exact(text(BACKEND, "branch", "--show-current"), "dwp-dev", "backend target branch")
    c.exact(changed(BACKEND), set(), "backend target worktree is dirty")
    head = text(BACKEND, "rev-parse", "HEAD")
    c.require(head in {BACKEND_BASE, LANE_COMMIT}, "unexpected backend dwp-dev head")
    c.exact(text(BACKEND, "rev-parse", "origin/dwp-dev"), head, "backend dwp-dev origin drift")
    return head


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--authoring", action="store_true")
    args = parser.parse_args()
    c = Check()
    try:
        c.exact(text(ROOT, "rev-parse", f"{FRONTEND_BASE}^{{tree}}"), FRONTEND_TREE, "frontend base tree")
        validate_evidence(c)
        backend_head = validate_backend(c)
        carrier = carrier_commit(c)
        validate_content(c, carrier)
        if carrier is None:
            c.require(args.authoring, "uncommitted integration carrier requires --authoring")
            c.exact(text(ROOT, "rev-parse", "HEAD"), FRONTEND_BASE, "authoring head")
            c.exact(text(ROOT, "branch", "--show-current"), CARRIER_BRANCH, "authoring branch")
            c.exact(changed(ROOT), CARRIER_PATHS, "authoring paths")
            c.exact(backend_head, BACKEND_BASE, "backend integrated before carrier")
            state = "APPROVAL_READINESS_INTEGRATION_AUTHORITY_READY_TO_COMMIT_AND_PUSH"
        else:
            c.exact(text(ROOT, "rev-parse", f"origin/{CARRIER_BRANCH}"), carrier, "carrier branch not pushed")
            c.require(
                run(ROOT, "merge-base", "--is-ancestor", carrier, "origin/dwp-dev").returncode == 0,
                "integration carrier not pushed to frontend dwp-dev",
            )
            state = (
                "APPROVAL_READINESS_CORRECTION_READY_FOR_BACKEND_FAST_FORWARD"
                if backend_head == BACKEND_BASE else
                "APPROVAL_READINESS_CORRECTION_INTEGRATED"
            )
        print(f"PASS state={state} checks={c.count} receipt_issuance=external-only")
        return 0
    except (Error, OSError, KeyError, ValueError, json.JSONDecodeError) as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
