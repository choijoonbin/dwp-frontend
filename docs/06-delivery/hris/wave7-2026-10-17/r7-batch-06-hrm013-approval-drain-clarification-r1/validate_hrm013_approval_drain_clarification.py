#!/usr/bin/env python3
"""Fail-closed validator for the HRM-013 Approval drain clarification."""

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
APPROVAL = Path(
    "/Users/a10697/Work/DWP/.codex-worktrees/hris/wave7-20261026/"
    "batch06/hrm013-owner-runtime/approval"
)
RECEIPT = Path(
    "/Users/a10697/Work/DWP/.codex-worktrees/hris/wave7-20261026/"
    "batch06/hrm013-owner-runtime/receipts/approval-runtime-clean-worktree-receipt.v1.json"
)
GIT = "/usr/bin/git"
FRONTEND_BASE = "431564c02500d40c3a4a1443d91fdf1f37aad5c8"
FRONTEND_TREE = "c008e4937ec1a9c228990e73fbc6d1f4a9665c58"
BACKEND_BASE = "bed31127123a318358f495f66edced7b024469d8"
BACKEND_TREE = "e5564ff7a81e5dd0a85d0e61f091ec0714a1f777"
APPROVAL_COMMIT = "b9880ec6cf0ad65e08d86c6624ee2ac91a748716"
APPROVAL_TREE = "3b6033339058ae684dafe94361bc653d28d6fe75"
APPROVAL_RESEAL_COMMIT = "3970b26c111c0492d7a7b637b8153f7a6844318d"
APPROVAL_RESEAL_BRANCH = (
    "codex/hris-wave7-batch06-hrm013-approval-runtime-backend-20261027-r2"
)
CARRIER_BRANCH = (
    "codex/hris-wave7-batch06-hrm013-approval-drain-"
    "clarification-frontend-20261027-r1"
)
APPROVAL_BRANCH = (
    "codex/hris-wave7-batch06-hrm013-approval-runtime-backend-20261026-r1"
)
DIR = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-approval-drain-clarification-r1"
)
AUTHORITY = f"{DIR}/approval-drain-root-terminal-clarification.v1.json"
VALIDATOR = f"{DIR}/validate_hrm013_approval_drain_clarification.py"
REVIEW = f"{DIR}/independent-review.v1.json"
GATE = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-owner-runtime-binding-gate-r1/"
    "hrm-013-owner-runtime-binding-gate.v1.json"
)
TOKEN = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-owner-runtime-phase4-authority-r1/tokens/"
    "hrm-013-approval-runtime.start-token.v1.json"
)
CARRIER_PATHS = {"package.json", AUTHORITY, VALIDATOR, REVIEW}
ENV = {
    "PATH": "/usr/bin:/bin",
    "HOME": "/var/empty",
    "LC_ALL": "C",
    "LANG": "C",
    "GIT_CONFIG_NOSYSTEM": "1",
    "GIT_CONFIG_GLOBAL": "/dev/null",
    "GIT_NO_REPLACE_OBJECTS": "1",
}


class ValidationError(RuntimeError):
    pass


class Checks:
    def __init__(self) -> None:
        self.count = 0

    def require(self, condition: bool, message: str) -> None:
        self.count += 1
        if not condition:
            raise ValidationError(message)

    def exact(self, actual: Any, expected: Any, message: str) -> None:
        self.count += 1
        if type(actual) is not type(expected) or actual != expected:
            raise ValidationError(
                f"{message}: expected={expected!r} actual={actual!r}"
            )


def run(repo: Path, *args: str) -> subprocess.CompletedProcess[bytes]:
    return subprocess.run(
        [GIT, "-C", str(repo), *args],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=ENV,
        check=False,
    )


def output(repo: Path, *args: str) -> bytes:
    result = run(repo, *args)
    if result.returncode:
        raise ValidationError(result.stderr.decode(errors="replace").strip())
    return result.stdout


def text(repo: Path, *args: str) -> str:
    return output(repo, *args).decode().strip()


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def load(data: bytes, label: str) -> dict[str, Any]:
    def pairs(items: list[tuple[str, Any]]) -> dict[str, Any]:
        result: dict[str, Any] = {}
        for key, value in items:
            if key in result:
                raise ValidationError(f"duplicate JSON key in {label}: {key}")
            result[key] = value
        return result

    value = json.loads(data.decode(), object_pairs_hook=pairs)
    if not isinstance(value, dict):
        raise ValidationError(f"JSON root is not an object: {label}")
    return value


def changed(repo: Path) -> set[str]:
    lines = output(repo, "status", "--porcelain=v1", "--untracked-files=all").decode()
    return {line[3:] for line in lines.rstrip("\n").splitlines() if line}


def diff_paths(repo: Path, older: str, newer: str) -> set[str]:
    return set(filter(None, text(repo, "diff", "--name-only", older, newer).splitlines()))


def pin(path: str, data: bytes) -> dict[str, Any]:
    return {"path": path, "bytes": len(data), "sha256": sha256(data)}


def carrier_commit(checks: Checks) -> str | None:
    additions = list(filter(None, text(
        ROOT, "log", "--diff-filter=A", "--format=%H", "--", AUTHORITY
    ).splitlines()))
    if not additions:
        return None
    checks.exact(len(additions), 1, "ambiguous clarification carrier")
    commit = additions[0]
    checks.exact(
        text(ROOT, "rev-list", "--parents", "-n", "1", commit).split(),
        [commit, FRONTEND_BASE],
        "clarification carrier is not a direct child",
    )
    checks.exact(
        diff_paths(ROOT, FRONTEND_BASE, commit),
        CARRIER_PATHS,
        "clarification carrier paths",
    )
    return commit


def source(path: str, carrier: str | None) -> bytes:
    if carrier is None:
        return (ROOT / path).read_bytes()
    return output(ROOT, "show", f"{carrier}:{path}")


def validate_prerequisites(checks: Checks) -> tuple[dict[str, Any], dict[str, Any]]:
    gate_data = output(ROOT, "show", f"{FRONTEND_BASE}:{GATE}")
    token_data = output(ROOT, "show", f"{FRONTEND_BASE}:{TOKEN}")
    checks.exact(len(gate_data), 170804, "gate bytes")
    checks.exact(
        sha256(gate_data),
        "aa88b6116f2fa8ca4e96d85204414a737e763afa4e1bb01372e31fdaa59deb47",
        "gate hash",
    )
    checks.exact(len(token_data), 11855, "token bytes")
    checks.exact(
        sha256(token_data),
        "402630c991fa01bbd5a0920769755764f9322f8fd30315ec32a464a48b06f6e4",
        "token hash",
    )
    checks.require(RECEIPT.exists() and not RECEIPT.is_symlink(), "clean receipt")
    info = RECEIPT.stat()
    checks.require(stat.S_ISREG(info.st_mode), "clean receipt regular file")
    checks.exact(stat.S_IMODE(info.st_mode), 0o600, "clean receipt mode")
    receipt_data = RECEIPT.read_bytes()
    checks.exact(len(receipt_data), 2407, "clean receipt bytes")
    checks.exact(
        sha256(receipt_data),
        "361539385a925a1b96e1a4bfbfa72bbaacac9f17a4eb63cc1dd18d9697cc368d",
        "clean receipt hash",
    )
    receipt = load(receipt_data, "clean receipt")
    checks.exact(receipt["branch"], APPROVAL_BRANCH, "receipt branch")
    checks.exact(receipt["baseCommit"], BACKEND_BASE, "receipt base")
    checks.exact(receipt["porcelainV2"], "", "receipt clean state")
    return load(gate_data, GATE), load(token_data, TOKEN)


def validate_backend(checks: Checks, token: dict[str, Any]) -> None:
    checks.exact(text(BACKEND, "branch", "--show-current"), "dwp-dev", "backend branch")
    backend_head = text(BACKEND, "rev-parse", "HEAD")
    checks.exact(
        text(BACKEND, "rev-list", "--parents", "-n", "1", APPROVAL_COMMIT).split(),
        [APPROVAL_COMMIT, BACKEND_BASE],
        "historical Approval commit topology",
    )
    checks.exact(
        text(BACKEND, "rev-list", "--parents", "-n", "1", APPROVAL_RESEAL_COMMIT).split(),
        [APPROVAL_RESEAL_COMMIT, BACKEND_BASE],
        "Approval reseal topology",
    )
    checks.exact(text(BACKEND, "rev-parse", f"{APPROVAL_COMMIT}^{{tree}}"), APPROVAL_TREE, "historical Approval tree")
    checks.exact(text(BACKEND, "rev-parse", f"{APPROVAL_RESEAL_COMMIT}^{{tree}}"), APPROVAL_TREE, "Approval reseal tree")
    historical_paths = diff_paths(BACKEND, BACKEND_BASE, APPROVAL_COMMIT)
    reseal_paths = diff_paths(BACKEND, BACKEND_BASE, APPROVAL_RESEAL_COMMIT)
    checks.exact(len(historical_paths), 45, "historical Approval path count")
    checks.exact(reseal_paths, historical_paths, "Approval reseal changed paths")
    checks.exact(diff_paths(BACKEND, APPROVAL_COMMIT, APPROVAL_RESEAL_COMMIT), set(), "Approval reseal content diff")
    checks.exact(
        text(BACKEND, "rev-parse", f"origin/{APPROVAL_RESEAL_BRANCH}"),
        APPROVAL_RESEAL_COMMIT,
        "Approval reseal branch is not pushed",
    )
    checks.require(
        backend_head in {BACKEND_BASE, APPROVAL_RESEAL_COMMIT},
        "backend head is outside the authorized Approval integration lifecycle",
    )
    checks.exact(text(BACKEND, "rev-parse", "origin/dwp-dev"), backend_head, "backend origin")
    checks.exact(text(BACKEND, "rev-parse", f"{BACKEND_BASE}^{{tree}}"), BACKEND_TREE, "backend base tree")
    if backend_head == APPROVAL_RESEAL_COMMIT:
        checks.exact(
            text(BACKEND, "rev-parse", f"{APPROVAL_RESEAL_COMMIT}^{{tree}}"),
            APPROVAL_TREE,
            "integrated Approval tree",
        )
        checks.exact(
            text(BACKEND, "rev-list", "--parents", "-n", "1", APPROVAL_RESEAL_COMMIT).split(),
            [APPROVAL_RESEAL_COMMIT, BACKEND_BASE],
            "integrated Approval commit is not a direct child",
        )
    checks.exact(changed(BACKEND), set(), "backend base dirty")
    checks.exact(text(APPROVAL, "branch", "--show-current"), APPROVAL_BRANCH, "approval branch")
    allowed = set(token["sourceScope"]["newSourcePaths"])
    allowed.update(token["sourceScope"]["existingMayModify"])
    allowed.update(token["targetedVerification"]["namedTestPaths"])
    approval_head = text(APPROVAL, "rev-parse", "HEAD")
    dirty = changed(APPROVAL)
    if approval_head == BACKEND_BASE:
        checks.exact(text(APPROVAL, "rev-parse", "HEAD^{tree}"), BACKEND_TREE, "approval base tree")
        checks.require(bool(dirty), "approval implementation has no candidate changes")
        actual = dirty
    else:
        checks.exact(approval_head, APPROVAL_COMMIT, "unexpected Approval implementation commit")
        checks.exact(text(APPROVAL, "rev-parse", "HEAD^{tree}"), APPROVAL_TREE, "Approval implementation tree")
        checks.exact(dirty, set(), "committed approval implementation is dirty")
        checks.exact(
            text(APPROVAL, "rev-list", "--parents", "-n", "1", approval_head).split(),
            [approval_head, BACKEND_BASE],
            "approval implementation is not one direct-child commit",
        )
        actual = diff_paths(APPROVAL, BACKEND_BASE, approval_head)
        remote_ref = f"refs/remotes/origin/{APPROVAL_BRANCH}"
        if run(APPROVAL, "show-ref", "--verify", "--quiet", remote_ref).returncode == 0:
            checks.exact(
                text(APPROVAL, "rev-parse", remote_ref),
                approval_head,
                "published approval branch does not match local commit",
            )
    checks.require(bool(actual), "approval implementation has no changes")
    checks.require(actual <= allowed, f"approval paths outside token: {sorted(actual - allowed)}")
    checks.require(
        not any(Path(item).name.startswith("V60") for item in actual),
        "Approval V60 change present",
    )


def validate_authority(checks: Checks, carrier: str | None) -> None:
    authority = load(source(AUTHORITY, carrier), AUTHORITY)
    checks.exact(
        set(authority),
        {
            "schema", "state", "sliceId", "lane", "carrier", "backendBoundary",
            "predecessors", "contradiction", "clarification", "authority", "next",
        },
        "authority key set",
    )
    checks.exact(
        authority["schema"],
        "dwp.hris.wave7.hrm013-approval-drain-root-terminal-clarification.v1",
        "authority schema",
    )
    checks.exact(
        authority["state"],
        "INDEPENDENTLY_REVIEWED_APPEND_ONLY_APPROVAL_DRAIN_SEMANTIC_CLARIFICATION",
        "authority state",
    )
    checks.exact(authority["sliceId"], "BASE-TFR-HRM-013", "slice")
    checks.exact(authority["lane"], "APPROVAL_RUNTIME", "lane")
    checks.exact(authority["carrier"], {
        "repository": "dwp-frontend",
        "branch": CARRIER_BRANCH,
        "baseCommit": FRONTEND_BASE,
        "baseTree": FRONTEND_TREE,
        "requiredDirectChild": True,
        "exactChangedPathCount": 4,
    }, "carrier")
    checks.exact(authority["backendBoundary"], {
        "repository": "dwp-backend",
        "dwpDevCommit": BACKEND_BASE,
        "dwpDevTree": BACKEND_TREE,
        "implementationBranch": APPROVAL_BRANCH,
        "implementationWorktree": str(APPROVAL),
        "implementationHeadMustRemainBaseBeforeCommit": True,
    }, "backend boundary")
    checks.exact(authority["predecessors"], {
        "bindingGate": pin(GATE, output(ROOT, "show", f"{FRONTEND_BASE}:{GATE}")),
        "approvalToken": pin(TOKEN, output(ROOT, "show", f"{FRONTEND_BASE}:{TOKEN}")),
        "cleanWorktreeReceipt": {
            "path": str(RECEIPT), "mode": "0600", "bytes": 2407,
            "sha256": "361539385a925a1b96e1a4bfbfa72bbaacac9f17a4eb63cc1dd18d9697cc368d",
        },
    }, "predecessors")
    checks.exact(authority["contradiction"], {
        "consumerRule": "The predecessor requires APR-002 and HRM-010 Auth admission and V59 comparison before APR-002 native creation.",
        "terminalChildRule": "The predecessor also permits HRM-010 DRAIN_EXISTING only for its exact persisted root or deterministic terminal child, whose callbackEventId, occurredAt and payload digest do not exist at APR-002 root ingress.",
        "unsafeInterpretationForbidden": "APR-002 approvalRequestId, requestedAt or payload digest must never be substituted as HRM-010 callback selectors or recorded as false HRM-010 drain activity.",
    }, "contradiction")
    checks.exact(authority["clarification"], {
        "newWorkApr002Ingress": [
            "Resolve APR-002 and HRM-010 under NEW_WORK before native request creation.",
            "Require the same grantSetId, tenantGrantRevision and authorizationRevision and exact-compare the immutable V59 two-member projection.",
        ],
        "drainApr002RootIngress": [
            "Resolve APR-002 as the exact DRAIN_EXISTING ROOT_DELIVERY and resolve SVC-AUT-HRM-013 only as the exact DEPENDENT_READ needed by that root.",
            "Require both returned authorizations to identify the same old grantSetId, tenantGrantRevision, authorizationRevision and common quiesceEffectiveAt, and cap the dependent-read proof and local transaction by the earlier drainAuthorizationExpiresAt.",
            "Exact-compare the current highest ADMIT V59 row common fields and APR-002 member with the Auth result and validate the row's immutable HRM-010 projection fields.",
            "Rely only on the sealed Auth three-member waiver-group atomicity for the not-yet-materialized HRM-010 member; do not call HRM-010 with APR-002 root selectors and do not append HRM-010 drain activity at ingress.",
        ],
        "terminalChildCreationAndDelivery": [
            "Before every HRM-010 terminal outbox creation, resolve HRM-010 as its exact TERMINAL_CHILD and APR-002 as the exact ROOT_DELIVERY under the same old grantSetId, revisions and common quiesceEffectiveAt.",
            "Exact-compare both Auth results to the same immutable V59 row and fail before commit if either authorization is mismatched, changed or expired.",
            "Before every HRM-010 delivery attempt, freshly repeat both exact resolutions and comparisons, cap the business-proof expiry by the earlier drainAuthorizationExpiresAt, then fail before proof signing or network send if either result changed or expired.",
        ],
        "scope": "This clarification applies only to APR-002 DRAIN_EXISTING root ingress and its deterministic HRM-010 terminal child. It does not relax NEW_WORK, requester identity, replay, proof, V59 immutability, TLS, credential, step-up, maker-checker, audit or fail-closed rules.",
    }, "clarification")
    checks.exact(authority["authority"], {
        "independentReviewComplete": True,
        "carrierCommitAndPushAuthorized": True,
        "approvalImplementationMayContinueAfterCarrierPush": True,
        "approvalSourceOrTestAllowlistExpanded": False,
        "peopleRuntimeAuthorityChanged": False,
        "migrationAuthoringAuthorized": False,
        "featureEnablementAuthorized": False,
        "tenantEnrollmentAuthorized": False,
        "runtimeCredentialProvisioningAuthorized": False,
        "directBackendDwpDevIntegrationAuthorized": False,
        "productionReleaseAuthorized": False,
        "businessCompletionCredit": 0,
    }, "authority flags")
    checks.exact(
        authority["next"],
        "COMMIT_AND_PUSH_THIS_EXACT_FOUR_PATH_CARRIER_THEN_COMPLETE_APPROVAL_UNDER_THE_UNCHANGED_PHASE4_TOKEN_AND_THIS_CLARIFICATION",
        "next action",
    )


def validate_package_and_review(checks: Checks, carrier: str | None) -> None:
    package = load(source("package.json", carrier), "package.json")
    base_package = load(output(ROOT, "show", f"{FRONTEND_BASE}:package.json"), "base package")
    expected = base_package["scripts"]["hris:current-contracts:check"] + " && python3 " + VALIDATOR
    checks.exact(package["scripts"]["hris:current-contracts:check"], expected, "package chain")
    review = load(source(REVIEW, carrier), REVIEW)
    checks.exact(
        review["schema"],
        "dwp.hris.wave7.hrm013-approval-drain-root-terminal-clarification-independent-review.v1",
        "review schema",
    )
    checks.exact(review["findings"], {"p0": [], "p1": [], "p2": []}, "review findings")
    checks.exact(review["finalVerdict"], {
        "p0": 0, "p1": 0, "p2": 0,
        "decision": "GO_FOR_APPROVAL_DRAIN_CLARIFICATION_CARRIER_COMMIT_AND_PUSH_ONLY",
    }, "review verdict")
    checks.exact(review["authority"], {
        "independentReviewComplete": True,
        "carrierCommitAndPushAuthorized": True,
        "approvalImplementationMayContinueAfterCarrierPush": True,
        "sourceOrTestScopeExpanded": False,
        "migrationOrActivationAuthority": False,
        "businessCompletionCredit": 0,
    }, "review authority")
    checks.exact(review["artifactPins"], [
        pin(AUTHORITY, source(AUTHORITY, carrier)),
        pin(VALIDATOR, source(VALIDATOR, carrier)),
        pin("package.json", source("package.json", carrier)),
    ], "review pins")
    datetime.fromisoformat(review["reviewedAt"].replace("Z", "+00:00"))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--authoring", action="store_true")
    args = parser.parse_args()
    checks = Checks()
    try:
        checks.exact(text(ROOT, "rev-parse", "--show-toplevel"), str(ROOT), "frontend root")
        checks.exact(text(ROOT, "rev-parse", f"{FRONTEND_BASE}^{{tree}}"), FRONTEND_TREE, "frontend base tree")
        _, token = validate_prerequisites(checks)
        validate_backend(checks, token)
        carrier = carrier_commit(checks)
        validate_authority(checks, carrier)
        validate_package_and_review(checks, carrier)
        if carrier is None:
            checks.require(args.authoring, "uncommitted carrier requires --authoring")
            checks.exact(text(ROOT, "rev-parse", "HEAD"), FRONTEND_BASE, "authoring head")
            checks.exact(text(ROOT, "branch", "--show-current"), CARRIER_BRANCH, "authoring branch")
            checks.exact(changed(ROOT), CARRIER_PATHS, "authoring paths")
            state = "APPROVAL_DRAIN_CLARIFICATION_READY_TO_COMMIT_AND_PUSH"
        else:
            checks.exact(text(ROOT, "rev-parse", f"origin/{CARRIER_BRANCH}"), carrier, "carrier branch push")
            checks.require(
                run(ROOT, "merge-base", "--is-ancestor", carrier, "origin/dwp-dev").returncode == 0,
                "clarification carrier not integrated into frontend dwp-dev",
            )
            state = "APPROVAL_DRAIN_CLARIFICATION_IN_FORCE"
        print(f"PASS state={state} checks={checks.count}")
        return 0
    except (ValidationError, OSError, KeyError, ValueError, json.JSONDecodeError) as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
