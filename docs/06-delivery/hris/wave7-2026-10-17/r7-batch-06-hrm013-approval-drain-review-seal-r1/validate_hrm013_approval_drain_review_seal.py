#!/usr/bin/env python3
"""Fail-closed validator for the HRM-013 Approval drain review metadata seal."""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

SCRIPT = Path(__file__).absolute()
ROOT = SCRIPT.parents[5]
GIT = "/usr/bin/git"
BASE = "3f28c072b4a92c8607532ebf5fbed9967e6a6ccb"
BASE_TREE = "c14d44394bc4eae4d4ab2af4dac6b22ef24511c4"
BRANCH = "codex/hris-wave7-batch06-hrm013-approval-drain-review-seal-frontend-20261027-r1"
DIR = "docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-hrm013-approval-drain-review-seal-r1"
AUTHORITY = f"{DIR}/approval-drain-review-metadata-seal.v1.json"
VALIDATOR = f"{DIR}/validate_hrm013_approval_drain_review_seal.py"
REVIEW = f"{DIR}/independent-review.v1.json"
PRE_DIR = "docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-hrm013-approval-drain-clarification-r1"
PRE_AUTHORITY = f"{PRE_DIR}/approval-drain-root-terminal-clarification.v1.json"
PRE_VALIDATOR = f"{PRE_DIR}/validate_hrm013_approval_drain_clarification.py"
PRE_REVIEW = f"{PRE_DIR}/independent-review.v1.json"
CARRIER_PATHS = {"package.json", AUTHORITY, VALIDATOR, REVIEW}
ENV = {
    "PATH": "/usr/bin:/bin", "HOME": "/var/empty", "LC_ALL": "C",
    "LANG": "C", "GIT_CONFIG_NOSYSTEM": "1",
    "GIT_CONFIG_GLOBAL": "/dev/null", "GIT_NO_REPLACE_OBJECTS": "1",
}
PRE_REVIEW_SCOPE = {
    "semantics": [
        "APR-002 NEW_WORK dual binding closure is unchanged",
        "APR-002 DRAIN root ingress uses APR-002 ROOT_DELIVERY plus SVC-AUT-HRM-013 DEPENDENT_READ under one old grant set and never fabricates HRM-010 selectors or activity",
        "HRM-010 terminal child creation and every delivery re-resolve HRM-010 TERMINAL_CHILD plus APR-002 ROOT_DELIVERY and use the earlier authorization expiry",
    ],
    "lifecycle": [
        "uncommitted Approval candidate is restricted to the exact token allowlist at the pinned backend base",
        "committed Approval candidate is clean, one direct child of the pinned backend base and remote-equal once published",
        "Approval V60, scope expansion, feature activation and backend dwp-dev integration remain forbidden",
    ],
}
SEAL_REVIEW_SCOPE = {
    "predecessor": [
        "Pinned predecessor commit, tree and four artifact hashes are exact",
        "Predecessor independent-review top-level key set, state, reviewScope and reviewedBy are exact",
        "All predecessor review fields that were already enforced remain exact",
    ],
    "successor": [
        "The carrier is one direct-child commit with exactly four changed paths",
        "The package validation chain appends this successor validator once",
        "No implementation, migration, activation or integration authority is added",
    ],
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
            raise ValidationError(f"{message}: expected={expected!r} actual={actual!r}")


def run(*args: str) -> subprocess.CompletedProcess[bytes]:
    return subprocess.run(
        [GIT, "-C", str(ROOT), *args], stdout=subprocess.PIPE,
        stderr=subprocess.PIPE, env=ENV, check=False,
    )


def output(*args: str) -> bytes:
    result = run(*args)
    if result.returncode:
        raise ValidationError(result.stderr.decode(errors="replace").strip())
    return result.stdout


def text(*args: str) -> str:
    return output(*args).decode().strip()


def digest(data: bytes) -> str:
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


def changed() -> set[str]:
    lines = output("status", "--porcelain=v1", "--untracked-files=all").decode()
    return {line[3:] for line in lines.rstrip("\n").splitlines() if line}


def diff_paths(older: str, newer: str) -> set[str]:
    return set(filter(None, text("diff", "--name-only", older, newer).splitlines()))


def pin(path: str, data: bytes) -> dict[str, Any]:
    return {"path": path, "bytes": len(data), "sha256": digest(data)}


def base_data(path: str) -> bytes:
    return output("show", f"{BASE}:{path}")


def carrier_commit(checks: Checks) -> str | None:
    additions = list(filter(None, text(
        "log", "--diff-filter=A", "--format=%H", "--", AUTHORITY
    ).splitlines()))
    if not additions:
        return None
    checks.exact(len(additions), 1, "ambiguous review-seal carrier")
    commit = additions[0]
    checks.exact(
        text("rev-list", "--parents", "-n", "1", commit).split(),
        [commit, BASE], "review-seal carrier is not a direct child",
    )
    checks.exact(diff_paths(BASE, commit), CARRIER_PATHS, "carrier changed paths")
    checks.require(
        run("merge-base", "--is-ancestor", commit, "HEAD").returncode == 0,
        "carrier is not an ancestor of frontend HEAD",
    )
    return commit


def source(path: str, carrier: str | None) -> bytes:
    return (ROOT / path).read_bytes() if carrier is None else output("show", f"{carrier}:{path}")


def validate_predecessor(checks: Checks) -> None:
    checks.exact(text("rev-parse", f"{BASE}^{{tree}}"), BASE_TREE, "base tree")
    pins = {
        PRE_AUTHORITY: (5363, "4b44a5994fee40f518c4dfdb31ecd5ff865bc269c9cdcc83f8b19326334a1958"),
        PRE_VALIDATOR: (17785, "f2dfcfe1180b13d6ab6c4aeb86bffbd59ea700c72a1965f802299b6b7d6f9f96"),
        PRE_REVIEW: (2334, "c7450dca0f1a6d1c267298653aa7c041db71ed9c009b688d201e9ad1f176ea13"),
        "package.json": (16175, "059b0a66e01b2dc14173deffb703d6eb8d8c59c1bf40314ae56303e2ae3f1f4e"),
    }
    for path, (size, sha) in pins.items():
        data = base_data(path)
        checks.exact(len(data), size, f"predecessor bytes: {path}")
        checks.exact(digest(data), sha, f"predecessor hash: {path}")
    review = load(base_data(PRE_REVIEW), PRE_REVIEW)
    checks.exact(set(review), {
        "schema", "state", "reviewScope", "findings", "finalVerdict",
        "authority", "artifactPins", "reviewedAt", "reviewedBy",
    }, "predecessor review key set")
    checks.exact(review["schema"],
        "dwp.hris.wave7.hrm013-approval-drain-root-terminal-clarification-independent-review.v1",
        "predecessor schema")
    checks.exact(review["state"],
        "INDEPENDENT_ZERO_FINDING_REVIEW_OF_EXACT_APPEND_ONLY_CLARIFICATION_CARRIER",
        "predecessor state")
    checks.exact(review["reviewScope"], PRE_REVIEW_SCOPE, "predecessor reviewScope")
    checks.exact(review["findings"], {"p0": [], "p1": [], "p2": []}, "predecessor findings")
    checks.exact(review["finalVerdict"], {
        "p0": 0, "p1": 0, "p2": 0,
        "decision": "GO_FOR_APPROVAL_DRAIN_CLARIFICATION_CARRIER_COMMIT_AND_PUSH_ONLY",
    }, "predecessor verdict")
    checks.exact(review["authority"], {
        "independentReviewComplete": True, "carrierCommitAndPushAuthorized": True,
        "approvalImplementationMayContinueAfterCarrierPush": True,
        "sourceOrTestScopeExpanded": False, "migrationOrActivationAuthority": False,
        "businessCompletionCredit": 0,
    }, "predecessor authority")
    checks.exact(review["artifactPins"], [
        pin(PRE_AUTHORITY, base_data(PRE_AUTHORITY)),
        pin(PRE_VALIDATOR, base_data(PRE_VALIDATOR)),
        pin("package.json", base_data("package.json")),
    ], "predecessor artifact pins")
    datetime.fromisoformat(review["reviewedAt"].replace("Z", "+00:00"))
    checks.exact(review["reviewedBy"],
        "INDEPENDENT_HRM013_APPROVAL_RUNTIME_POST_REVIEW_AGENT",
        "predecessor reviewedBy")


def validate_authority(checks: Checks, carrier: str | None) -> None:
    authority = load(source(AUTHORITY, carrier), AUTHORITY)
    checks.exact(set(authority), {
        "schema", "state", "sliceId", "lane", "carrier", "predecessor",
        "defect", "correction", "authority", "next",
    }, "seal authority key set")
    checks.exact(authority["schema"],
        "dwp.hris.wave7.hrm013-approval-drain-review-metadata-seal.v1", "seal schema")
    checks.exact(authority["state"],
        "APPEND_ONLY_SUCCESSOR_SEAL_FOR_APPROVAL_DRAIN_REVIEW_METADATA", "seal state")
    checks.exact(authority["sliceId"], "BASE-TFR-HRM-013", "slice")
    checks.exact(authority["lane"], "APPROVAL_RUNTIME_GOVERNANCE", "lane")
    checks.exact(authority["carrier"], {
        "repository": "dwp-frontend", "branch": BRANCH, "baseCommit": BASE,
        "baseTree": BASE_TREE, "requiredDirectChild": True, "exactChangedPathCount": 4,
    }, "carrier")
    checks.exact(authority["predecessor"], {
        "commit": BASE, "tree": BASE_TREE,
        "authority": pin(PRE_AUTHORITY, base_data(PRE_AUTHORITY)),
        "validator": pin(PRE_VALIDATOR, base_data(PRE_VALIDATOR)),
        "independentReview": pin(PRE_REVIEW, base_data(PRE_REVIEW)),
        "package": pin("package.json", base_data("package.json")),
    }, "predecessor")
    checks.exact(authority["defect"], {
        "severity": "P1",
        "description": "The predecessor validator did not exact-check the independent review top-level key set, state, reviewScope or reviewedBy fields.",
        "historyPolicy": "The shared predecessor commit remains immutable; this successor closes the validation gap without amend or force-push.",
    }, "defect")
    checks.exact(authority["correction"], {
        "topLevelKeySetExact": True,
        "stateExact": "INDEPENDENT_ZERO_FINDING_REVIEW_OF_EXACT_APPEND_ONLY_CLARIFICATION_CARRIER",
        "reviewScopeExact": True,
        "reviewedByExact": "INDEPENDENT_HRM013_APPROVAL_RUNTIME_POST_REVIEW_AGENT",
        "allPreviouslyValidatedReviewFieldsRechecked": True,
        "predecessorSemanticsChanged": False,
    }, "correction")
    checks.exact(authority["authority"], {
        "independentReviewComplete": True, "carrierCommitAndPushAuthorized": True,
        "approvalImplementationMayContinueAfterCarrierPush": True,
        "sourceOrTestScopeExpanded": False, "migrationOrActivationAuthority": False,
        "directBackendDwpDevIntegrationAuthorized": False,
        "productionReleaseAuthorized": False, "businessCompletionCredit": 0,
    }, "authority flags")
    checks.exact(authority["next"],
        "COMMIT_AND_PUSH_THIS_EXACT_FOUR_PATH_SUCCESSOR_SEAL_THEN_CONTINUE_APPROVAL_TARGETED_CORRECTION",
        "next action")


def validate_package_and_review(checks: Checks, carrier: str | None) -> None:
    package = load(source("package.json", carrier), "package.json")
    base_package = load(base_data("package.json"), "base package")
    expected = base_package["scripts"]["hris:current-contracts:check"] + " && python3 " + VALIDATOR
    checks.exact(package["scripts"]["hris:current-contracts:check"], expected, "package chain")
    review = load(source(REVIEW, carrier), REVIEW)
    checks.exact(set(review), {
        "schema", "state", "reviewScope", "findings", "finalVerdict",
        "authority", "artifactPins", "reviewedAt", "reviewedBy",
    }, "seal review key set")
    checks.exact(review["schema"],
        "dwp.hris.wave7.hrm013-approval-drain-review-metadata-seal-independent-review.v1",
        "seal review schema")
    checks.exact(review["state"],
        "INDEPENDENT_ZERO_FINDING_REVIEW_OF_APPEND_ONLY_METADATA_SEAL",
        "seal review state")
    checks.exact(review["reviewScope"], SEAL_REVIEW_SCOPE, "seal reviewScope")
    checks.exact(review["findings"], {"p0": [], "p1": [], "p2": []}, "seal findings")
    checks.exact(review["finalVerdict"], {
        "p0": 0, "p1": 0, "p2": 0,
        "decision": "GO_FOR_APPROVAL_DRAIN_REVIEW_METADATA_SEAL_COMMIT_AND_PUSH_ONLY",
    }, "seal verdict")
    checks.exact(review["authority"], {
        "independentReviewComplete": True, "carrierCommitAndPushAuthorized": True,
        "approvalImplementationMayContinueAfterCarrierPush": True,
        "sourceOrTestScopeExpanded": False, "migrationOrActivationAuthority": False,
        "businessCompletionCredit": 0,
    }, "seal review authority")
    checks.exact(review["artifactPins"], [
        pin(AUTHORITY, source(AUTHORITY, carrier)),
        pin(VALIDATOR, source(VALIDATOR, carrier)),
        pin("package.json", source("package.json", carrier)),
    ], "seal review pins")
    datetime.fromisoformat(review["reviewedAt"].replace("Z", "+00:00"))
    checks.exact(review["reviewedBy"],
        "INDEPENDENT_HRM013_APPROVAL_RUNTIME_POST_REVIEW_AGENT", "seal reviewedBy")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--authoring", action="store_true")
    args = parser.parse_args()
    checks = Checks()
    try:
        checks.exact(text("rev-parse", "--show-toplevel"), str(ROOT), "frontend root")
        validate_predecessor(checks)
        carrier = carrier_commit(checks)
        validate_authority(checks, carrier)
        validate_package_and_review(checks, carrier)
        if carrier is None:
            checks.require(args.authoring, "uncommitted carrier requires --authoring")
            checks.exact(text("rev-parse", "HEAD"), BASE, "authoring head")
            checks.exact(text("branch", "--show-current"), BRANCH, "authoring branch")
            checks.exact(changed(), CARRIER_PATHS, "authoring paths")
            state = "APPROVAL_DRAIN_REVIEW_METADATA_SEAL_READY_TO_COMMIT_AND_PUSH"
        else:
            checks.exact(text("rev-parse", f"origin/{BRANCH}"), carrier, "carrier branch push")
            checks.require(
                run("merge-base", "--is-ancestor", carrier, "origin/dwp-dev").returncode == 0,
                "review-seal carrier not integrated into frontend dwp-dev",
            )
            state = "APPROVAL_DRAIN_REVIEW_METADATA_SEAL_IN_FORCE"
        print(f"PASS state={state} checks={checks.count}")
        return 0
    except (ValidationError, OSError, KeyError, ValueError, json.JSONDecodeError) as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
