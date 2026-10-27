#!/usr/bin/env python3
"""Fail-closed authoring validator for HRM-013 Phase-6 central integration."""
from __future__ import annotations

import hashlib
import json
import subprocess
import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[5]
HERE = Path(__file__).resolve().parent
BACKEND = Path("/Users/a10697/Work/DWP/dwp-backend")
AUTHORITY = HERE / "phase6-central-integration-authority.v1.json"
REVIEW = HERE / "independent-review.v1.json"
FRONTEND_BASE = "a08b287eac7dcfb99d39aa83093a63cb979412dc"
FRONTEND_TREE = "596d7e6531a958058e0b90a57037bff68bf8d21c"
BACKEND_BASE = "8ccc7baeff43b60dc6cdf719449514f56b6dbca5"
BACKEND_TREE = "f17b244d9d47da035dfe09f7c9a604796f19eb74"
AUTH_OLD_REMOTE = "0a8faf23386966b861cf019d306a1cfbd3e6c3fb"
ARTIFACTS = {
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-phase6-central-integration-r1/"
    "phase6-central-integration-authority.v1.json",
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-phase6-central-integration-r1/independent-review.v1.json",
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-phase6-central-integration-r1/"
    "validate_hrm013_phase6_central_integration.py",
}
BACKEND_SCOPE_PREFIXES = (
    "dwp-time-server/", "dwp-payroll-server/", "dwp-auth-server/",
    "dwp-people-server/", "dwp-platform-contracts/",
)


def load(path: Path) -> dict[str, Any]:
    def pairs(items: list[tuple[str, Any]]) -> dict[str, Any]:
        result: dict[str, Any] = {}
        for key, value in items:
            if key in result:
                raise AssertionError(f"duplicate JSON key in {path}: {key}")
            result[key] = value
        return result

    value = json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=pairs)
    if not isinstance(value, dict):
        raise AssertionError(f"JSON root must be object: {path}")
    return value


def git(repo: Path, *args: str) -> str:
    result = subprocess.run(
        ["/usr/bin/git", "-C", str(repo), *args],
        text=True,
        capture_output=True,
        check=False,
    )
    if result.returncode:
        raise AssertionError(
            f"git {' '.join(args)} failed in {repo}: {result.stderr.strip()}"
        )
    return result.stdout.rstrip()


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def equal(actual: Any, expected: Any, label: str) -> None:
    if type(actual) is not type(expected) or actual != expected:
        raise AssertionError(f"{label}: expected={expected!r} actual={actual!r}")


def status_paths(repo: Path) -> set[str]:
    paths: set[str] = set()
    for line in git(repo, "status", "--porcelain=v1", "-uall").splitlines():
        if line:
            paths.add(line[3:].split(" -> ")[-1])
    return paths


def remote_tip(branch: str) -> str:
    output = git(BACKEND, "ls-remote", "origin", f"refs/heads/{branch}")
    if not output:
        raise AssertionError(f"missing remote branch: {branch}")
    return output.split()[0]


def validate_tip(name: str, item: dict[str, Any], allowed_remote: set[str]) -> int:
    branch = item["branch"]
    commit = item["commit"]
    equal(git(BACKEND, "rev-parse", branch), commit, f"{name} local tip")
    equal(git(BACKEND, "rev-parse", f"{commit}^{{tree}}"), item["tree"], f"{name} tree")
    equal(git(BACKEND, "merge-base", commit, item["baseCommit"]), item["baseCommit"], f"{name} base")
    equal(git(BACKEND, "rev-list", "--count", f"{item['baseCommit']}..{commit}"), str(item["commitCount"]), f"{name} commit count")
    paths = git(BACKEND, "diff", "--name-only", f"{item['baseCommit']}..{commit}").splitlines()
    equal(len(paths), item["changedPathCount"], f"{name} changed path count")
    if remote_tip(branch) not in allowed_remote:
        raise AssertionError(f"{name} remote is neither reviewed nor final tip")
    return 6


def main() -> int:
    checks = 0
    authority = load(AUTHORITY)
    review = load(REVIEW)
    equal(authority["schema"], "dwp.hris.wave7.hrm013-phase6-central-integration-authority.v1", "schema")
    equal(authority["state"], "INDEPENDENTLY_REVIEWED_HASH_BOUND_ORDERED_PHASE6_CENTRAL_INTEGRATION_AUTHORITY", "state")
    equal(authority["carrier"]["baseCommit"], FRONTEND_BASE, "frontend base")
    equal(authority["backendBase"]["commit"], BACKEND_BASE, "backend base")
    checks += 4

    for pin in authority["predecessorPins"]:
        path = ROOT / pin["path"]
        equal(path.stat().st_size, pin["bytes"], f"bytes {pin['path']}")
        equal(sha256(path), pin["sha256"], f"sha256 {pin['path']}")
        checks += 2

    equal(git(ROOT, "rev-parse", f"{FRONTEND_BASE}^{{tree}}"), FRONTEND_TREE, "frontend base tree")
    head, origin, dirty = git(ROOT, "rev-parse", "HEAD"), git(ROOT, "rev-parse", "origin/dwp-dev"), status_paths(ROOT)
    if head == FRONTEND_BASE:
        equal(origin, FRONTEND_BASE, "frontend authoring origin")
        equal(ARTIFACTS <= dirty, True, "frontend carrier authoring paths present")
        unrelated_hris = {
            path for path in dirty
            if path.startswith("docs/06-delivery/hris/") and path not in ARTIFACTS
        }
        equal(unrelated_hris, set(), "no unrelated dirty HRIS delivery paths")
    else:
        equal(git(ROOT, "merge-base", FRONTEND_BASE, head), FRONTEND_BASE, "frontend ancestry")
        equal(git(ROOT, "rev-list", "--count", f"{FRONTEND_BASE}..{head}"), "1", "frontend direct child")
        equal(set(git(ROOT, "diff", "--name-only", f"{FRONTEND_BASE}..{head}").splitlines()), ARTIFACTS, "carrier paths")
        equal(dirty & ARTIFACTS, set(), "committed carrier paths clean")
        if origin not in {FRONTEND_BASE, head}:
            raise AssertionError(f"frontend origin drift: {origin}")
    checks += 5

    equal(git(BACKEND, "rev-parse", "dwp-dev"), BACKEND_BASE, "backend dwp-dev")
    equal(git(BACKEND, "rev-parse", "origin/dwp-dev"), BACKEND_BASE, "backend origin")
    equal(git(BACKEND, "rev-parse", f"{BACKEND_BASE}^{{tree}}"), BACKEND_TREE, "backend tree")
    dirty_backend_scope = {
        path for path in status_paths(BACKEND)
        if path.startswith(BACKEND_SCOPE_PREFIXES)
    }
    equal(dirty_backend_scope, set(), "backend integration scope clean")
    checks += 4

    tips = authority["reviewedOwnerTips"]
    checks += validate_tip("time", tips["time"], {tips["time"]["commit"]})
    checks += validate_tip("payroll", tips["payroll"], {tips["payroll"]["commit"]})
    checks += validate_tip("auth", tips["auth"], {AUTH_OLD_REMOTE, tips["auth"]["commit"]})
    policy = authority["sourcePathPolicy"]
    for name, prefix in (("time", policy["timePrefix"]), ("payroll", policy["payrollPrefix"]), ("auth", policy["authPrefix"])):
        paths = git(BACKEND, "diff", "--name-only", f"{BACKEND_BASE}..{tips[name]['commit']}").splitlines()
        if not all(path.startswith(prefix) for path in paths):
            raise AssertionError(f"{name} path escapes {prefix}")
        checks += 1

    equal(tips["auth"]["finalCrossReviewDecision"], "GO", "AUTH cross review")
    equal(tips["auth"]["reviewFindings"], {"P0": 0, "P1": 0, "P2": 3}, "AUTH findings")
    equal(len(tips["auth"]["activationOnlyP2"]), 3, "AUTH activation prerequisites")
    equal(len(authority["targetedVerification"]["auth"]["selectors"]), 14, "AUTH selector count")
    equal(len(authority["orderedIntegrationPlan"]), 11, "integration plan count")
    equal(authority["acceptanceMatrixPin"]["conditionCount"], 12, "acceptance count")
    equal(len(set(authority["acceptanceMatrixPin"]["ids"])), 12, "acceptance ids")
    checks += 7

    required_true = {
        "independentReviewComplete", "carrierCommitAndPushAuthorized",
        "orderedBackendDwpDevIntegrationAuthorizedAfterCarrierPush",
        "timeExactTipFastForwardAuthorized",
        "payrollRebaseTargetedVerificationAndFastForwardAuthorized",
        "authFinalSealPushRebaseTargetedVerificationAndFastForwardAuthorized",
        "peopleHandshakeTestAuthoringAuthorizedAfterTimeAndPayrollIntegration",
        "finalBoundedMatrixAndReceiptAuthorized",
    }
    required_false = {
        "activationAuthorized", "tenantRolloutAuthorized",
        "runtimeCredentialProvisioningAuthorized", "liveNetworkHandshakeAuthorized",
        "productionBindingAuthorized", "productionReleaseAuthorized",
        "hrm013BusinessCompletionAuthorized", "batch06CompletionAuthorized",
        "hrisCompletionAuthorized",
    }
    for key in required_true:
        equal(authority["authority"][key], True, f"required authority {key}")
        checks += 1
    for key in required_false:
        equal(authority["authority"][key], False, f"forbidden authority {key}")
        checks += 1
    equal(authority["authority"]["businessCompletionCredit"], 0, "business credit")
    equal(authority["targetedVerification"]["broadRepositoryRerunAuthorized"], False, "broad rerun")
    equal(authority["targetedVerification"]["unrelatedModuleRerunAuthorized"], False, "unrelated rerun")
    checks += 3

    equal(review["schema"], "dwp.hris.wave7.hrm013-phase6-central-integration-independent-review.v1", "review schema")
    equal(review["decision"], "GO_FOR_EXACT_THREE_PATH_CARRIER_AND_ORDERED_BOUNDED_INTEGRATION_ONLY", "review decision")
    equal(review["severityCounts"], {"P0": 0, "P1": 0, "P2": 3}, "review findings")
    equal(review["authorityPin"]["bytes"], AUTHORITY.stat().st_size, "authority bytes")
    equal(review["authorityPin"]["sha256"], sha256(AUTHORITY), "authority sha256")
    equal(review["validatorPin"]["bytes"], Path(__file__).stat().st_size, "validator bytes")
    equal(review["validatorPin"]["sha256"], sha256(Path(__file__)), "validator sha256")
    checks += 7
    print(f"PASS HRM-013 Phase-6 central integration authority: checks={checks}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (AssertionError, KeyError, json.JSONDecodeError, IndexError) as exc:
        print(f"FAIL HRM-013 Phase-6 central integration authority: {exc}", file=sys.stderr)
        raise SystemExit(1)
