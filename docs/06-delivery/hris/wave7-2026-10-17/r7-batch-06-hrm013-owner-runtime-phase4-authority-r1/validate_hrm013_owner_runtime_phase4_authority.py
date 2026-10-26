#!/usr/bin/env python3
"""Fail-closed authoring validator for HRM-013 owner/runtime Phase 4."""

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
RECEIPTS = Path(
    "/Users/a10697/Work/DWP/.codex-worktrees/hris/wave7-20261026/"
    "batch06/hrm013-owner-runtime/receipts"
)
GIT = "/usr/bin/git"
FRONTEND_BASE = "85d6a4f732fc41abad3c37475862c6eafe1ccca2"
FRONTEND_TREE = "13bc5cc80a59cbea1cea1cce58a87f42a7217945"
BACKEND_BASE = "bed31127123a318358f495f66edced7b024469d8"
BACKEND_TREE = "e5564ff7a81e5dd0a85d0e61f091ec0714a1f777"
CARRIER_BRANCH = (
    "codex/hris-wave7-batch06-hrm013-owner-runtime-"
    "phase4-authority-frontend-20261027-r1"
)
DIR = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-owner-runtime-phase4-authority-r1"
)
AUTHORITY = f"{DIR}/owner-runtime-phase4-execution-authority.v1.json"
VALIDATOR = f"{DIR}/validate_hrm013_owner_runtime_phase4_authority.py"
REVIEW = f"{DIR}/independent-review.v1.json"
APPROVAL_TOKEN = f"{DIR}/tokens/hrm-013-approval-runtime.start-token.v1.json"
PEOPLE_TOKEN = f"{DIR}/tokens/hrm-013-people-owner-runtime.start-token.v1.json"
GATE = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-owner-runtime-binding-gate-r1/"
    "hrm-013-owner-runtime-binding-gate.v1.json"
)
REGISTER = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-owner-runtime-execution-r1/"
    "service-api-auth-binding-register.successor.v3.csv"
)
CARRIER_PATHS = {
    "package.json", AUTHORITY, VALIDATOR, REVIEW, APPROVAL_TOKEN, PEOPLE_TOKEN,
}
INTEGRATION_RECEIPT = RECEIPTS / "approval-readiness-central-integration-receipt.v1.json"
AUTH_DELEGATION_RECEIPT = RECEIPTS / "auth-runtime-successor-delegation-authority.v1.json"
EXTERNAL_RECEIPTS = [
    (
        INTEGRATION_RECEIPT,
        3042,
        "53b2bbee2dc7be38b3d61a4214b16f144ad78eecc3c1b0afe587727aef6de0a6",
    ),
    (
        AUTH_DELEGATION_RECEIPT,
        7234,
        "b39a7f825996291d5c50e03f6e2335649ca9b2fb9c7b509b0e4268fa0c5bd0d9",
    ),
]
TRACKED_PINS = [
    (
        GATE,
        170804,
        "aa88b6116f2fa8ca4e96d85204414a737e763afa4e1bb01372e31fdaa59deb47",
    ),
    (
        REGISTER,
        23958,
        "16e1401119b1bfff0cf6fa0383ec311e154db91e86df738fb9dffa5e4dd8bf1a",
    ),
]
APPROVAL_MIGRATION = (
    "dwp-approval-server/src/main/resources/db/migration/"
    "V59__bridge_hris_separation_task_waivers.sql"
)
PEOPLE_MIGRATION = (
    "dwp-people-server/src/main/resources/db/migration/"
    "V61__hrm_base_tfr_hrm_013.sql"
)
BACKEND_PINS = [
    (
        APPROVAL_MIGRATION,
        28589,
        "03ee5347e25631dd40f35b9a20bc056207ae98c80712a03f6daa69900c814c18",
    ),
    (
        PEOPLE_MIGRATION,
        47156,
        "b77bbc5823b40e2c134d9dab396f040a9a90fe87fa71a1b634895aa3182c526f",
    ),
]
APPROVAL_BRANCH = (
    "codex/hris-wave7-batch06-hrm013-approval-runtime-backend-20261026-r1"
)
PEOPLE_BRANCH = (
    "codex/hris-wave7-batch06-hrm013-people-owner-runtime-backend-20261026-r1"
)
APPROVAL_WORKTREE = Path(
    "/Users/a10697/Work/DWP/.codex-worktrees/hris/wave7-20261026/"
    "batch06/hrm013-owner-runtime/approval"
)
PEOPLE_WORKTREE = Path(
    "/Users/a10697/Work/DWP/.codex-worktrees/hris/wave7-20261026/"
    "batch06/hrm013-owner-runtime/people"
)
REVIEW_BOUNDARIES = [
    "EXACT_CORRECTED_FRONTEND_AND_BACKEND_BASES",
    "TWO_SEPARATE_HASH_BOUND_TOKENS_FROM_ONE_BACKEND_BASE",
    "EXACT_APPROVAL_30_PATH_AND_PEOPLE_28_PATH_SOURCE_SCOPES",
    "EXACT_23_NAMED_TARGETS_PER_LANE_AND_NO_BROAD_RERUN",
    "NO_APPROVAL_V60_OR_PEOPLE_V62_MIGRATION",
    "APPROVAL_FIRST_PEOPLE_REBASE_SECOND_AND_ONE_BOUNDED_HANDSHAKE",
    "NO_PHASE6_UI_FEATURE_TENANT_CREDENTIAL_OR_PRODUCTION_AUTHORITY",
]
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

    def require(self, value: bool, message: str) -> None:
        self.count += 1
        if not value:
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


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def pin(path: str, data: bytes) -> dict[str, Any]:
    return {"path": path, "bytes": len(data), "sha256": digest(data)}


def load_json(data: bytes, label: str) -> dict[str, Any]:
    def pairs(values: list[tuple[str, Any]]) -> dict[str, Any]:
        result: dict[str, Any] = {}
        for key, value in values:
            if key in result:
                raise ValidationError(f"duplicate JSON key in {label}: {key}")
            result[key] = value
        return result

    value = json.loads(data.decode(), object_pairs_hook=pairs)
    if not isinstance(value, dict):
        raise ValidationError(f"JSON root is not an object: {label}")
    return value


def source(path: str, carrier: str | None) -> bytes:
    if carrier is None:
        candidate = ROOT / path
        if candidate.is_symlink() or not candidate.is_file():
            raise ValidationError(f"missing or symlinked authoring artifact: {path}")
        return candidate.read_bytes()
    return output(ROOT, "show", f"{carrier}:{path}")


def changed(repo: Path) -> set[str]:
    raw = output(
        repo, "status", "--porcelain=v1", "--untracked-files=all"
    ).decode()
    return {line[3:] for line in raw.rstrip("\n").splitlines() if line}


def diff_paths(repo: Path, older: str, newer: str) -> set[str]:
    return set(
        filter(None, text(repo, "diff", "--name-only", older, newer).splitlines())
    )


def closed(
    checks: Checks, value: dict[str, Any], keys: set[str], label: str
) -> None:
    checks.exact(set(value), keys, f"{label} key set")


def secure_receipt(
    checks: Checks, path: Path, expected_bytes: int, expected_sha: str
) -> dict[str, Any]:
    checks.require(path.exists() and not path.is_symlink(), f"receipt missing: {path}")
    info = path.stat()
    checks.require(stat.S_ISREG(info.st_mode), f"receipt not regular: {path}")
    checks.exact(stat.S_IMODE(info.st_mode), 0o600, f"receipt mode: {path.name}")
    checks.exact(info.st_uid, os.getuid(), f"receipt owner: {path.name}")
    checks.exact(info.st_nlink, 1, f"receipt link count: {path.name}")
    data = path.read_bytes()
    checks.exact(len(data), expected_bytes, f"receipt bytes: {path.name}")
    checks.exact(digest(data), expected_sha, f"receipt hash: {path.name}")
    return load_json(data, path.name)


def carrier_commit(checks: Checks) -> str | None:
    commits = [
        item
        for item in text(
            ROOT, "log", "--diff-filter=A", "--format=%H", "--", AUTHORITY
        ).splitlines()
        if item
    ]
    if not commits:
        return None
    checks.exact(len(commits), 1, "authority introduction commit count")
    carrier = commits[0]
    checks.exact(
        text(ROOT, "rev-list", "--parents", "-n", "1", carrier).split(),
        [carrier, FRONTEND_BASE],
        "carrier must be a non-merge direct child",
    )
    checks.exact(
        diff_paths(ROOT, FRONTEND_BASE, carrier),
        CARRIER_PATHS,
        "carrier changed paths",
    )
    checks.require(
        run(ROOT, "merge-base", "--is-ancestor", carrier, "HEAD").returncode == 0,
        "carrier is not an ancestor of frontend HEAD",
    )
    return carrier


def validate_prerequisites(checks: Checks) -> None:
    integration = secure_receipt(checks, *EXTERNAL_RECEIPTS[0])
    delegation = secure_receipt(checks, *EXTERNAL_RECEIPTS[1])
    checks.exact(
        integration.get("schema"),
        "dwp.hris.wave7.hrm013-approval-readiness-central-integration-receipt.v1",
        "integration receipt schema",
    )
    checks.exact(
        integration.get("state"),
        "HASH_BOUND_ZERO_FINDING_APPROVAL_READINESS_DIRECT_FAST_FORWARD_INTEGRATED",
        "integration receipt state",
    )
    checks.exact(
        integration.get("backendIntegration", {}).get("targetCommitAfter"),
        BACKEND_BASE,
        "integration backend result",
    )
    checks.exact(
        integration.get("decision"),
        "GO_FOR_FRESH_PHASE4_APPROVAL_AND_PEOPLE_AUTHORITY_AUTHORING_FROM_EXACT_CORRECTED_BASE",
        "integration receipt decision",
    )
    checks.exact(
        delegation.get("schema"),
        "dwp.hris.wave7.hrm013-auth-runtime-successor-delegation-authority-receipt.v1",
        "auth delegation schema",
    )
    checks.exact(
        delegation.get("state"),
        "HASH_BOUND_REVIEWED_AUTH_RUNTIME_SUCCESSOR_CONTROL_DELEGATION",
        "auth delegation state",
    )
    checks.exact(
        delegation.get("decision"),
        "GO_FOR_AUTH_RUNTIME_SUCCESSOR_CONTROL_DELEGATION_ONLY",
        "auth delegation decision",
    )
    for path, size, sha in TRACKED_PINS:
        data = output(ROOT, "show", f"{FRONTEND_BASE}:{path}")
        checks.exact(len(data), size, f"tracked prerequisite bytes: {path}")
        checks.exact(digest(data), sha, f"tracked prerequisite hash: {path}")


def validate_backend(checks: Checks) -> None:
    checks.exact(
        text(BACKEND, "branch", "--show-current"), "dwp-dev", "backend branch"
    )
    checks.exact(text(BACKEND, "rev-parse", "HEAD"), BACKEND_BASE, "backend head")
    checks.exact(
        text(BACKEND, "rev-parse", "origin/dwp-dev"),
        BACKEND_BASE,
        "backend origin",
    )
    checks.exact(
        text(BACKEND, "rev-parse", f"{BACKEND_BASE}^{{tree}}"),
        BACKEND_TREE,
        "backend tree",
    )
    checks.exact(changed(BACKEND), set(), "backend worktree is dirty")
    for path, size, sha in BACKEND_PINS:
        data = output(BACKEND, "show", f"{BACKEND_BASE}:{path}")
        checks.exact(len(data), size, f"backend pin bytes: {path}")
        checks.exact(digest(data), sha, f"backend pin hash: {path}")
    approval_names = text(
        BACKEND,
        "ls-tree",
        "-r",
        "--name-only",
        BACKEND_BASE,
        "dwp-approval-server/src/main/resources/db/migration",
    ).splitlines()
    people_names = text(
        BACKEND,
        "ls-tree",
        "-r",
        "--name-only",
        BACKEND_BASE,
        "dwp-people-server/src/main/resources/db/migration",
    ).splitlines()
    checks.require(
        not any(Path(name).name.startswith("V60") for name in approval_names),
        "Approval V60 exists",
    )
    checks.require(
        not any(Path(name).name.startswith("V62") for name in people_names),
        "People V62 exists",
    )


def expected_scopes(
    checks: Checks,
) -> tuple[list[str], list[str], list[str], list[str], list[str], list[str]]:
    gate = load_json(output(ROOT, "show", f"{FRONTEND_BASE}:{GATE}"), GATE)
    allowlists = gate["futureSourceAllowlists"]
    tests = gate["futureTargetTestAllowlists"]
    approval = allowlists["approval"]
    people = allowlists["people"]
    approval_new = [
        approval["newPackage"] + name for name in approval["newClasses"]
    ] + [approval["newDomainFile"]]
    people_new = [people["package"] + name for name in people["newClasses"]]
    approval_tests = tests["approval"]
    people_tests = tests["people"]
    checks.exact(len(approval_new), 13, "Approval new path count")
    checks.exact(len(approval["existingMayModify"]), 17, "Approval existing count")
    checks.exact(len(people_new), 20, "People new path count")
    checks.exact(len(people["existingMayModify"]), 8, "People existing count")
    checks.exact(len(approval_tests), 23, "Approval target count")
    checks.exact(len(people_tests), 23, "People target count")
    return (
        approval_new,
        approval["existingMayModify"],
        approval_tests,
        people_new,
        people["existingMayModify"],
        people_tests,
    )


def selector(path: str, marker: str) -> str:
    return path.split(marker, 1)[1].removesuffix(".java").replace("/", ".")


def validate_token_common(
    checks: Checks,
    token: dict[str, Any],
    schema: str,
    lane: str,
    branch: str,
    worktree: Path,
    clean_name: str,
    clean_schema: str,
) -> None:
    closed(
        checks,
        token,
        {
            "schema", "state", "sliceId", "lane", "authorityCarrier",
            "backendBase", "worktree", "sourceScope", "targetedVerification",
            "immutablePersistence", "integration", "authority",
        },
        f"{lane} token",
    )
    checks.exact(token["schema"], schema, f"{lane} schema")
    checks.exact(
        token["state"],
        "EXECUTABLE_AFTER_CARRIER_PUSH_AND_MATCHING_EXTERNAL_CLEAN_WORKTREE_RECEIPT",
        f"{lane} state",
    )
    checks.exact(token["sliceId"], "BASE-TFR-HRM-013", f"{lane} slice")
    checks.exact(token["lane"], lane, f"{lane} name")
    checks.exact(
        token["authorityCarrier"],
        {"path": AUTHORITY, "frontendBaseCommit": FRONTEND_BASE},
        f"{lane} authority carrier",
    )
    checks.exact(
        token["backendBase"],
        {
            "repository": "dwp-backend", "branch": "dwp-dev",
            "commit": BACKEND_BASE, "tree": BACKEND_TREE,
            "originMustMatch": True,
        },
        f"{lane} backend base",
    )
    checks.exact(token["worktree"], {
        "absolutePath": str(worktree),
        "branch": branch,
        "baseHead": BACKEND_BASE,
        "baseTree": BACKEND_TREE,
        "cleanReceiptPath": str(RECEIPTS / clean_name),
        "cleanReceiptSchema": clean_schema,
        "cleanAtIssueRequired": True,
        "upstreamAbsentAtIssueRequired": True,
        "remoteBranchAbsentAtIssueRequired": True,
    }, f"{lane} worktree")


def validate_tokens(checks: Checks, carrier: str | None) -> None:
    (
        approval_new,
        approval_existing,
        approval_tests,
        people_new,
        people_existing,
        people_tests,
    ) = expected_scopes(checks)
    approval = load_json(source(APPROVAL_TOKEN, carrier), APPROVAL_TOKEN)
    people = load_json(source(PEOPLE_TOKEN, carrier), PEOPLE_TOKEN)
    validate_token_common(
        checks, approval,
        "dwp.hris.wave7.hrm013-approval-runtime-start-token.v1",
        "APPROVAL_RUNTIME", APPROVAL_BRANCH, APPROVAL_WORKTREE,
        "approval-runtime-clean-worktree-receipt.v1.json",
        "dwp.hris.wave7.hrm013-approval-runtime-clean-worktree-receipt.v1",
    )
    validate_token_common(
        checks, people,
        "dwp.hris.wave7.hrm013-people-owner-runtime-start-token.v1",
        "PEOPLE_OWNER_AND_RUNTIME", PEOPLE_BRANCH, PEOPLE_WORKTREE,
        "people-owner-runtime-clean-worktree-receipt.v1.json",
        "dwp.hris.wave7.hrm013-people-owner-runtime-clean-worktree-receipt.v1",
    )
    checks.exact(approval["sourceScope"], {
        "newSourcePaths": approval_new,
        "existingMayModify": approval_existing,
        "authorizedSourcePathCount": 30,
        "migrationAuthoringAuthorized": False,
        "forbiddenMigrationPattern":
            "dwp-approval-server/src/main/resources/db/migration/V60*",
        "unrelatedModuleChangesAuthorized": False,
    }, "Approval source scope")
    checks.exact(people["sourceScope"], {
        "newSourcePaths": people_new,
        "existingMayModify": people_existing,
        "authorizedSourcePathCount": 28,
        "migrationAuthoringAuthorized": False,
        "forbiddenMigrationPattern":
            "dwp-people-server/src/main/resources/db/migration/V62*",
        "unrelatedModuleChangesAuthorized": False,
    }, "People source scope")
    approval_units = [
        selector(path, "/src/test/java/")
        for path in approval_tests if "/src/test/java/" in path
    ]
    approval_cross = [
        selector(path, "/src/crossServiceTest/java/")
        for path in approval_tests if "/src/crossServiceTest/java/" in path
    ]
    people_v60_class = (
        "com.dwp.services.people.integration.Hrm012V60MigrationPostgresTest"
    )
    people_selectors = [
        selector(path, "/src/test/java/")
        for path in people_tests
        if selector(path, "/src/test/java/") != people_v60_class
    ]
    people_method_selectors = [
        people_v60_class
        + ".cleanMigrationThroughV60BuildsOnlyTheTwoTablesAndLockedControls",
        people_v60_class
        + ".upgradeFromV59PreservesRowsAndEveryHistoricalChecksum",
    ]
    checks.exact(approval["targetedVerification"], {
        "compileTasks": [
            ":dwp-approval-server:compileJava",
            ":dwp-approval-server:compileTestJava",
            ":dwp-approval-server:compileCrossServiceTestJava",
        ],
        "namedTestPaths": approval_tests,
        "namedTestCount": 23,
        "unitTestTask": ":dwp-approval-server:test",
        "unitTestSelectors": approval_units,
        "crossServiceTestTask": ":dwp-approval-server:crossServiceTest",
        "crossServiceTestSelectors": approval_cross,
        "broadRepositorySuiteAuthorized": False,
        "rerunRule":
            "RERUN_ONLY_THE_SMALLEST_FAILED_TARGET_AFTER_A_BOUNDED_FIX",
    }, "Approval targeted verification")
    checks.exact(people["targetedVerification"], {
        "compileTasks": [
            ":dwp-people-server:compileJava",
            ":dwp-people-server:compileTestJava",
        ],
        "namedTestPaths": people_tests,
        "namedTestCount": 23,
        "unitTestTask": ":dwp-people-server:test",
        "unitTestSelectors": people_selectors,
        "methodSelectors": people_method_selectors,
        "broadRepositorySuiteAuthorized": False,
        "rerunRule":
            "RERUN_ONLY_THE_SMALLEST_FAILED_TARGET_AFTER_A_BOUNDED_FIX",
    }, "People targeted verification")
    checks.exact(approval["immutablePersistence"], {
        "migrationPath": APPROVAL_MIGRATION,
        "bytes": 28589,
        "sha256":
            "03ee5347e25631dd40f35b9a20bc056207ae98c80712a03f6daa69900c814c18",
        "historicalEditAuthorized": False,
    }, "Approval persistence")
    checks.exact(people["immutablePersistence"], {
        "migrationPath": PEOPLE_MIGRATION,
        "bytes": 47156,
        "sha256":
            "b77bbc5823b40e2c134d9dab396f040a9a90fe87fa71a1b634895aa3182c526f",
        "historicalEditAuthorized": False,
    }, "People persistence")
    checks.exact(approval["integration"], {
        "finalBranchCommitMustBeSingleDirectChildOfBase": True,
        "independentPostImplementationReviewRequired": True,
        "branchCommitAndPushAuthorizedAfterTargetedVerification": True,
        "centralOrder": "FIRST",
        "directDwpDevIntegrationAuthorizedByThisToken": False,
    }, "Approval integration")
    checks.exact(people["integration"], {
        "initialBranchCommitMustBeSingleDirectChildOfBase": True,
        "independentPostImplementationReviewRequired": True,
        "branchCommitAndPushAuthorizedAfterTargetedVerification": True,
        "centralOrder": "SECOND_AFTER_REBASE_ON_APPROVAL_INTEGRATED_DWP_DEV",
        "rebaseRequiredBeforeCentralIntegration": True,
        "collisionSensitiveTargetedVerificationRequiredAfterRebase": True,
        "directDwpDevIntegrationAuthorizedByThisToken": False,
    }, "People integration")
    checks.exact(approval["authority"], {
        "approvalRuntimeSourceAuthoringAuthorized": True,
        "peopleRuntimeSourceAuthoringAuthorized": False,
        "taskOwnerSourceAuthoringAuthorized": False,
        "migrationAuthoringAuthorized": False,
        "featureActivationAuthorized": False,
        "tenantEnrollmentAuthorized": False,
        "productionReleaseAuthorized": False,
        "businessCompletionCredit": 0,
    }, "Approval token authority")
    checks.exact(people["authority"], {
        "peopleOwnerAndRuntimeSourceAuthoringAuthorized": True,
        "approvalRuntimeSourceAuthoringAuthorized": False,
        "phase6TaskOwnerSourceAuthoringAuthorized": False,
        "migrationAuthoringAuthorized": False,
        "featureActivationAuthorized": False,
        "tenantEnrollmentAuthorized": False,
        "productionReleaseAuthorized": False,
        "businessCompletionCredit": 0,
    }, "People token authority")


def validate_authority(checks: Checks, carrier: str | None) -> None:
    authority = load_json(source(AUTHORITY, carrier), AUTHORITY)
    closed(
        checks,
        authority,
        {
            "schema", "state", "sliceId", "module", "moduleSession", "lane",
            "carrier", "correctedBackendBase", "sealedPrerequisites", "tokens",
            "executionTopology", "authority", "nonClaims", "nextAction",
        },
        "authority",
    )
    checks.exact(
        authority["schema"],
        "dwp.hris.wave7.hrm013-owner-runtime-phase4-execution-authority.v1",
        "authority schema",
    )
    checks.exact(
        authority["state"],
        "INDEPENDENTLY_REVIEWED_HASH_BOUND_PARALLEL_APPROVAL_AND_PEOPLE_RUNTIME_EXECUTION_AUTHORITY",
        "authority state",
    )
    checks.exact(authority["sliceId"], "BASE-TFR-HRM-013", "authority slice")
    checks.exact(authority["module"], "HRM", "authority module")
    checks.exact(authority["moduleSession"], "HRIS-HRM", "authority session")
    checks.exact(authority["lane"], "OWNER_RUNTIME_PHASE4", "authority lane")
    checks.exact(
        authority["carrier"],
        {
            "repository": "dwp-frontend", "branch": CARRIER_BRANCH,
            "baseCommit": FRONTEND_BASE, "baseTree": FRONTEND_TREE,
            "requiredDirectChild": True, "exactChangedPathCount": 6,
        },
        "authority carrier",
    )
    checks.exact(authority["correctedBackendBase"], {
        "repository": "dwp-backend", "branch": "dwp-dev",
        "commit": BACKEND_BASE, "tree": BACKEND_TREE,
        "originMustMatch": True, "worktreeMustBeClean": True,
    }, "authority backend base")
    checks.exact(authority["sealedPrerequisites"], [
        {
            "kind": "EXTERNAL_OWNER_ONLY_RECEIPT",
            "path": str(INTEGRATION_RECEIPT),
            "mode": "0600",
            "bytes": 3042,
            "sha256":
                "53b2bbee2dc7be38b3d61a4214b16f144ad78eecc3c1b0afe587727aef6de0a6",
        },
        {
            "kind": "EXTERNAL_OWNER_ONLY_RECEIPT",
            "path": str(AUTH_DELEGATION_RECEIPT),
            "mode": "0600",
            "bytes": 7234,
            "sha256":
                "b39a7f825996291d5c50e03f6e2335649ca9b2fb9c7b509b0e4268fa0c5bd0d9",
        },
        {
            "kind": "TRACKED_GATE",
            "path": GATE,
            "bytes": 170804,
            "sha256":
                "aa88b6116f2fa8ca4e96d85204414a737e763afa4e1bb01372e31fdaa59deb47",
        },
        {
            "kind": "TRACKED_SERVICE_BINDING_REGISTER",
            "path": REGISTER,
            "bytes": 23958,
            "sha256":
                "16e1401119b1bfff0cf6fa0383ec311e154db91e86df738fb9dffa5e4dd8bf1a",
        },
        {
            "kind": "IMMUTABLE_BACKEND_MIGRATION",
            "path": APPROVAL_MIGRATION,
            "bytes": 28589,
            "sha256":
                "03ee5347e25631dd40f35b9a20bc056207ae98c80712a03f6daa69900c814c18",
        },
        {
            "kind": "IMMUTABLE_BACKEND_MIGRATION",
            "path": PEOPLE_MIGRATION,
            "bytes": 47156,
            "sha256":
                "b77bbc5823b40e2c134d9dab396f040a9a90fe87fa71a1b634895aa3182c526f",
        },
    ], "authority sealed prerequisites")
    checks.exact(
        authority["tokens"],
        [
            {
                "lane": "APPROVAL_RUNTIME", "path": APPROVAL_TOKEN,
                "schema":
                    "dwp.hris.wave7.hrm013-approval-runtime-start-token.v1",
            },
            {
                "lane": "PEOPLE_OWNER_AND_RUNTIME", "path": PEOPLE_TOKEN,
                "schema":
                    "dwp.hris.wave7.hrm013-people-owner-runtime-start-token.v1",
            },
        ],
        "authority token declarations",
    )
    checks.exact(authority["executionTopology"], {
        "parallelAuthoringFromSameCorrectedBase": True,
        "authoringOrder": [
            "MATERIALIZE_BOTH_CLEAN_WORKTREES_AFTER_CARRIER_PUSH",
            "AUTHOR_AND_VERIFY_APPROVAL_AND_PEOPLE_IN_PARALLEL",
        ],
        "centralIntegrationOrder": [
            "INDEPENDENTLY_REVIEW_COMMIT_AND_PUSH_APPROVAL_RUNTIME",
            "FAST_FORWARD_APPROVAL_RUNTIME_TO_BACKEND_DWP_DEV",
            "REBASE_PEOPLE_OWNER_AND_RUNTIME_ON_THE_LATEST_BACKEND_DWP_DEV",
            "RERUN_ONLY_PEOPLE_COLLISION_SENSITIVE_COMPILE_AND_NAMED_TARGETS",
            "INDEPENDENTLY_REVIEW_COMMIT_AND_PUSH_REBASED_PEOPLE_RUNTIME",
            "FAST_FORWARD_REBASED_PEOPLE_RUNTIME_TO_BACKEND_DWP_DEV",
            "RUN_ONE_BOUNDED_SHARED_AUTH_APPROVAL_PEOPLE_HANDSHAKE_MATRIX",
        ],
        "completeTwelveConditionCrossServiceMatrix":
            "DEFERRED_UNTIL_SEPARATELY_AUTHORIZED_PHASE6_TASK_OWNERS_ARE_INTEGRATED",
        "broadRepositoryRerunRequired": False,
    }, "authority execution topology")
    checks.exact(authority["authority"], {
        "independentReviewComplete": True,
        "carrierCommitAndPushAuthorized": True,
        "approvalRuntimeImplementationAuthorizedAfterMatchingCleanReceipt": True,
        "peopleOwnerRuntimeImplementationAuthorizedAfterMatchingCleanReceipt": True,
        "parallelAuthoringAuthorized": True,
        "newMigrationAuthorized": False,
        "directBackendDwpDevIntegrationAuthorized": False,
        "taskDispatchOwnerImplementationAuthorized": False,
        "frontendUiMenuOrRouteAuthorized": False,
        "featureEnablementAuthorized": False,
        "tenantEnrollmentAuthorized": False,
        "runtimeCredentialProvisioningAuthorized": False,
        "productionBindingAuthorized": False,
        "productionReleaseAuthorized": False,
        "businessCompletionCredit": 0,
    }, "authority grants")
    checks.exact(authority["nonClaims"], [
        "The two runtime worktrees, branches or clean-worktree receipts already exist.",
        "Approval V60 or People V62 is reserved, authored or permitted.",
        "The complete twelve-condition cross-service matrix is executable before Phase 6 task owners.",
        "Any HRIS menu, feature, tenant, production credential or production route is enabled.",
        "HRM-013 or HRIS is complete.",
    ], "authority non-claims")
    checks.exact(
        authority["nextAction"],
        "COMMIT_AND_PUSH_THIS_EXACT_SIX_PATH_FRONTEND_CARRIER_THEN_MATERIALIZE_BOTH_HASH_BOUND_BACKEND_WORKTREES_AND_EXTERNAL_0600_CLEAN_RECEIPTS",
        "authority next action",
    )


def validate_package_and_review(
    checks: Checks, carrier: str | None
) -> None:
    package = load_json(source("package.json", carrier), "package.json")
    base_package = load_json(
        output(ROOT, "show", f"{FRONTEND_BASE}:package.json"), "base package"
    )
    expected_script = (
        base_package["scripts"]["hris:current-contracts:check"]
        + " && python3 " + VALIDATOR
    )
    checks.exact(
        package["scripts"]["hris:current-contracts:check"],
        expected_script,
        "package validator chain",
    )
    review = load_json(source(REVIEW, carrier), REVIEW)
    closed(
        checks,
        review,
        {
            "schema", "reviewedAt", "reviewer", "scope", "findings",
            "finalVerdict", "authority", "artifactPins",
        },
        "review",
    )
    checks.exact(
        review["schema"],
        "dwp.hris.wave7.hrm013-owner-runtime-phase4-authority-independent-review.v1",
        "review schema",
    )
    checks.exact(
        review["reviewer"],
        "INDEPENDENT_HRM013_OWNER_RUNTIME_PHASE4_AUTHORITY_REVIEW",
        "reviewer",
    )
    checks.exact(review["scope"], {
        "authorityPath": AUTHORITY,
        "validatorPath": VALIDATOR,
        "approvalTokenPath": APPROVAL_TOKEN,
        "peopleTokenPath": PEOPLE_TOKEN,
        "packagePath": "package.json",
        "reviewedBoundaries": REVIEW_BOUNDARIES,
    }, "review scope")
    checks.exact(review["findings"]["p0"], [], "review P0")
    checks.exact(review["findings"]["p1"], [], "review P1")
    checks.exact(review["findings"]["p2"], [], "review P2")
    checks.exact(review["finalVerdict"], {
        "p0": 0, "p1": 0, "p2": 0,
        "decision":
            "GO_FOR_OWNER_RUNTIME_PHASE4_AUTHORITY_CARRIER_COMMIT_AND_PUSH_ONLY",
    }, "review verdict")
    checks.exact(review["authority"], {
        "independentReviewComplete": True,
        "carrierCommitAndPushAuthorized": True,
        "approvalAndPeopleWorktreeMaterializationAuthorizedAfterCarrierPush": True,
        "runtimeAuthoringRequiresMatchingExternalCleanReceipts": True,
        "newMigrationAuthorized": False,
        "directBackendDwpDevIntegrationAuthorized": False,
        "phase6OrProductionAuthority": False,
        "businessCompletionCredit": 0,
    }, "review authority")
    expected_pins = [
        pin(path, source(path, carrier))
        for path in (
            AUTHORITY, VALIDATOR, APPROVAL_TOKEN, PEOPLE_TOKEN, "package.json"
        )
    ]
    checks.exact(review["artifactPins"], expected_pins, "review artifact pins")
    datetime.fromisoformat(review["reviewedAt"].replace("Z", "+00:00"))


def validate_authoring_absence(checks: Checks) -> None:
    for path, branch in (
        (APPROVAL_WORKTREE, APPROVAL_BRANCH),
        (PEOPLE_WORKTREE, PEOPLE_BRANCH),
    ):
        checks.require(not path.exists(), f"worktree already exists: {path}")
        checks.require(not path.is_symlink(), f"worktree path is symlinked: {path}")
        checks.require(
            run(
                BACKEND, "show-ref", "--verify", "--quiet", f"refs/heads/{branch}"
            ).returncode != 0,
            f"local branch already exists: {branch}",
        )
        checks.require(
            run(
                BACKEND,
                "show-ref",
                "--verify",
                "--quiet",
                f"refs/remotes/origin/{branch}",
            ).returncode != 0,
            f"remote-tracking branch already exists: {branch}",
        )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--authoring", action="store_true")
    args = parser.parse_args()
    checks = Checks()
    try:
        checks.exact(
            text(ROOT, "rev-parse", "--show-toplevel"),
            str(ROOT),
            "frontend root",
        )
        checks.exact(
            text(ROOT, "rev-parse", f"{FRONTEND_BASE}^{{tree}}"),
            FRONTEND_TREE,
            "frontend base tree",
        )
        validate_prerequisites(checks)
        validate_backend(checks)
        carrier = carrier_commit(checks)
        validate_authority(checks, carrier)
        validate_tokens(checks, carrier)
        validate_package_and_review(checks, carrier)
        if carrier is None:
            checks.require(args.authoring, "uncommitted carrier requires --authoring")
            checks.exact(text(ROOT, "rev-parse", "HEAD"), FRONTEND_BASE, "authoring head")
            checks.exact(
                text(ROOT, "branch", "--show-current"),
                CARRIER_BRANCH,
                "authoring branch",
            )
            checks.exact(changed(ROOT), CARRIER_PATHS, "authoring changed paths")
            validate_authoring_absence(checks)
            state = "OWNER_RUNTIME_PHASE4_AUTHORITY_READY_TO_COMMIT_AND_PUSH"
        else:
            checks.exact(
                text(ROOT, "rev-parse", f"origin/{CARRIER_BRANCH}"),
                carrier,
                "carrier branch not pushed",
            )
            checks.require(
                run(
                    ROOT, "merge-base", "--is-ancestor", carrier, "origin/dwp-dev"
                ).returncode == 0,
                "carrier is not integrated into frontend dwp-dev",
            )
            state = "OWNER_RUNTIME_PHASE4_READY_TO_MATERIALIZE_WORKTREES"
        print(f"PASS state={state} checks={checks.count}")
        return 0
    except (
        ValidationError, OSError, KeyError, ValueError, json.JSONDecodeError
    ) as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
