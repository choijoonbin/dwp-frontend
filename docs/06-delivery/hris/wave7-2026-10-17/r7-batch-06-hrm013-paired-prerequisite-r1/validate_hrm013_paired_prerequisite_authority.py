#!/usr/bin/env python3
"""Validate the pre-materialization HRM-013 paired prerequisite authority carrier."""

from __future__ import annotations

import hashlib
import json
import pathlib
import subprocess
import sys
from typing import Any


HERE = pathlib.Path(__file__).resolve().parent
FRONTEND_ROOT = HERE.parents[4]
BACKEND_ROOT = FRONTEND_ROOT.parent / "dwp-backend"
AUTHORITY_PATH = HERE / "paired-prerequisite-execution-authority.v1.json"
REVIEW_PATH = HERE / "independent-review.v1.json"


def load_json(path: pathlib.Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def require(condition: bool, message: str, failures: list[str]) -> None:
    if not condition:
        failures.append(message)


def git(repo: pathlib.Path, *args: str) -> str:
    return subprocess.run(
        ["git", "-C", str(repo), *args],
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()


def validate_pin(base: pathlib.Path, pin: dict[str, Any], label: str, failures: list[str]) -> None:
    path = (base / pin["path"]).resolve()
    require(path.is_file(), f"missing pinned artifact: {label}", failures)
    if not path.is_file():
        return
    value = path.read_bytes()
    require(len(value) == pin["bytes"], f"byte drift: {label}", failures)
    require(sha256_bytes(value) == pin["sha256"], f"sha256 drift: {label}", failures)


def migration_names(path: pathlib.Path) -> list[str]:
    return [item.name for item in path.glob("V*.sql") if item.is_file()]


def main() -> int:
    failures: list[str] = []
    require(AUTHORITY_PATH.is_file(), "authority file missing", failures)
    require(REVIEW_PATH.is_file(), "independent review missing", failures)
    if failures:
        print(json.dumps({"status": "FAIL", "failures": failures}, indent=2))
        return 1

    authority = load_json(AUTHORITY_PATH)
    review = load_json(REVIEW_PATH)
    require(
        authority.get("schema")
        == "dwp.hris.wave7.r7-batch-06-hrm013-paired-prerequisite-execution-authority.v1",
        "authority schema drift",
        failures,
    )
    require(
        authority.get("state")
        == "SEALED_PAIRED_WORKTREE_MATERIALIZATION_ONLY_SOURCE_LEASE_TOKEN_AND_RUNTIME_WITHHELD",
        "authority state drift",
        failures,
    )

    preconditions = authority["preconditions"]
    for name in (
        "currentAuthorityIndex",
        "centralIntegrationReceipt",
        "callbackIndependentReview",
        "trustedCallbackAuthority",
        "pairedApprovalBridge",
        "peopleV61Manifest",
        "approvalV59Manifest",
    ):
        validate_pin(AUTHORITY_PATH.parent, preconditions[name], name, failures)

    callback_review = load_json(
        (AUTHORITY_PATH.parent / preconditions["callbackIndependentReview"]["path"]).resolve()
    )
    require(
        callback_review.get("finalVerdict", {}).get("p0") == 0
        and callback_review.get("finalVerdict", {}).get("p1") == 0
        and callback_review.get("finalVerdict", {}).get("p2") == 0,
        "callback independent review is not zero-finding",
        failures,
    )
    require(
        callback_review.get("authority", {}).get(
            "centralPairedApprovalPeoplePrerequisitePreparationEligibleAfterCarrierPush"
        )
        is True,
        "callback review does not permit paired prerequisite preparation",
        failures,
    )

    frontend = preconditions["callbackCarrier"]
    backend = preconditions["backendBaseline"]
    require(
        git(FRONTEND_ROOT, "rev-parse", f"{frontend['commit']}^{{tree}}") == frontend["tree"],
        "frontend callback carrier tree drift",
        failures,
    )
    frontend_head_contains_carrier = subprocess.run(
        ["git", "-C", str(FRONTEND_ROOT), "merge-base", "--is-ancestor", frontend["commit"], "HEAD"],
        check=False,
    )
    frontend_origin_contains_carrier = subprocess.run(
        [
            "git",
            "-C",
            str(FRONTEND_ROOT),
            "merge-base",
            "--is-ancestor",
            frontend["commit"],
            "origin/dwp-dev",
        ],
        check=False,
    )
    require(frontend_head_contains_carrier.returncode == 0, "frontend HEAD lost callback carrier ancestry", failures)
    require(frontend_origin_contains_carrier.returncode == 0, "frontend origin lost callback carrier ancestry", failures)
    require(git(BACKEND_ROOT, "rev-parse", "HEAD") == backend["commit"], "backend HEAD drift", failures)
    require(git(BACKEND_ROOT, "rev-parse", "HEAD^{tree}") == backend["tree"], "backend tree drift", failures)
    require(git(BACKEND_ROOT, "rev-parse", "origin/dwp-dev") == backend["commit"], "backend origin drift", failures)
    require(git(BACKEND_ROOT, "status", "--porcelain=v1") == "", "backend is not clean", failures)

    lanes = authority["boundedLanes"]
    approval_migration = lanes["approval"]["migration"]
    people_migration = lanes["people"]["migration"]
    require(approval_migration["observedHighWater"] == "V58", "Approval high-water drift", failures)
    require(people_migration["observedHighWater"] == "V60", "People high-water drift", failures)
    approval_dir = BACKEND_ROOT / "dwp-approval-server/src/main/resources/db/migration"
    people_dir = BACKEND_ROOT / "dwp-people-server/src/main/resources/db/migration"
    require(
        "V58__bridge_hris_employee_change_approvals.sql" in migration_names(approval_dir),
        "Approval V58 predecessor missing",
        failures,
    )
    require(
        "V60__hrm_base_tfr_hrm_012.sql" in migration_names(people_dir),
        "People V60 predecessor missing",
        failures,
    )
    require(
        not (BACKEND_ROOT / approval_migration["exactCandidatePath"]).exists(),
        "Approval V59 candidate already exists",
        failures,
    )
    require(
        not (BACKEND_ROOT / people_migration["exactCandidatePath"]).exists(),
        "People V61 candidate already exists",
        failures,
    )
    require(
        not any(name.startswith("V59__") for name in migration_names(approval_dir)),
        "competing Approval V59 exists",
        failures,
    )
    require(
        not any(name.startswith("V61__") for name in migration_names(people_dir)),
        "competing People V61 exists",
        failures,
    )

    worktrees = authority["plannedWorktrees"]
    require(set(worktrees) == {"approval", "people"}, "planned worktree set drift", failures)
    require(
        worktrees["approval"]["absolutePath"] != worktrees["people"]["absolutePath"]
        and worktrees["approval"]["branch"] != worktrees["people"]["branch"],
        "planned worktrees are not isolated",
        failures,
    )
    for name, item in worktrees.items():
        require(item["baseCommit"] == backend["commit"], f"{name} base commit drift", failures)
        require(item["baseTree"] == backend["tree"], f"{name} base tree drift", failures)
        require(item["materializedByThisAuthority"] is False, f"{name} falsely materialized", failures)
        require(not pathlib.Path(item["absolutePath"]).exists(), f"{name} worktree path already exists", failures)
        branch_result = subprocess.run(
            ["git", "-C", str(BACKEND_ROOT), "show-ref", "--verify", "--quiet", f"refs/heads/{item['branch']}"],
            check=False,
        )
        require(branch_result.returncode == 1, f"{name} branch already exists", failures)

    granted_true = {
        "authorityCarrierSealed",
        "pairedPrerequisitePreparationAuthorized",
        "approvalWorktreeMaterializationAuthorized",
        "peopleWorktreeMaterializationAuthorized",
    }
    authority_flags = authority["authority"]
    for key, value in authority_flags.items():
        if key in granted_true:
            require(value is True, f"required Phase A authority false: {key}", failures)
        elif key == "businessCompletionCredit":
            require(value == 0, "business completion credit is nonzero", failures)
        else:
            require(value is False, f"authority leaked: {key}", failures)

    require(
        review.get("schema")
        == "dwp.hris.wave7.r7-batch-06-hrm013-paired-prerequisite-independent-review.v1",
        "review schema drift",
        failures,
    )
    require(review.get("finalVerdict") == {"p0": 0, "p1": 0, "p2": 0}, "review findings not zero", failures)
    validate_pin(REVIEW_PATH.parent, review["artifactPins"]["authority"], "review authority pin", failures)
    validate_pin(REVIEW_PATH.parent, review["artifactPins"]["validator"], "review validator pin", failures)
    review_authority = review["authority"]
    require(review_authority.get("carrierCommitAndPushAuthorized") is True, "carrier commit/push not authorized", failures)
    require(
        review_authority.get("worktreeMaterializationEligibleAfterCarrierPush") is True,
        "worktree materialization not eligible after push",
        failures,
    )
    for key, value in review_authority.items():
        if key in {"independentReviewComplete", "carrierCommitAndPushAuthorized", "worktreeMaterializationEligibleAfterCarrierPush"}:
            require(value is True, f"required review authority false: {key}", failures)
        elif key == "businessCompletionCredit":
            require(value == 0, "review business completion credit is nonzero", failures)
        else:
            require(value is False, f"review authority leaked: {key}", failures)

    result = {
        "schema": "dwp.hris.wave7.r7-batch-06-hrm013-paired-prerequisite-authority-validation.v1",
        "status": "PASS" if not failures else "FAIL",
        "checks": {
            "pinnedPreconditions": 7,
            "plannedWorktrees": len(worktrees),
            "activeMigrationLeases": 0,
            "executableTokens": 0,
            "sourceAuthorityGranted": False,
            "businessCompletionCredit": 0,
        },
        "failures": failures,
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if not failures else 1


if __name__ == "__main__":
    sys.exit(main())
