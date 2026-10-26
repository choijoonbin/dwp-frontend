#!/usr/bin/env python3
"""Fail-closed validator for HRM-013 paired prerequisite central admission."""

from __future__ import annotations

import hashlib
import json
import subprocess
import sys
from pathlib import Path


HERE = Path(__file__).resolve().parent
FRONTEND = HERE.parents[4]
BACKEND = Path("/Users/a10697/Work/DWP/dwp-backend")
EMPTY_SHA = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
FRONTEND_HEAD = "8739852a4608ce7d2c32607265d8b9d2c3ffdc34"
FRONTEND_TREE = "cb9fac770f26ab82ce02e386e3f41ccc771eb767"
BASE = "fe2842a36d13709e6aecc27011a8f0ad3c770ce8"
BASE_TREE = "190636f40e29126970aaf1b68b85a94eaf49402d"
COMBINED_TREE = "22bd6533ab340cfb91c6cf5ab5fd6991e501e6c4"
DECISION = (13356, "65f1d6858f547dd0bcd24b9b465cf5b4e5e657c38ad8365f9e2e4f0b830edf2c")

LANES = {
    "approval": {
        "path": Path("/Users/a10697/Work/DWP/.codex-worktrees/hris/wave7-20261026/batch06/hrm013-paired/approval"),
        "branch": "codex/hris-wave7-batch06-hrm013-approval-v59-prereq-backend-20261026-r1",
        "commit": "ef69ffd6fb608941053e1ca48a5a7a137bd0088e",
        "tree": "db13f4a08005d37905f1b42f1e992eec8185c118",
        "commits": ["ff73ba68dfa0b3942ddfc85dd8a9aa4ec89bf384", "ef69ffd6fb608941053e1ca48a5a7a137bd0088e"],
        "nameStatusBytes": 1194,
        "nameStatusSha256": "f62da2ea62571902c0b59c3f342c07c2e7619e546fefe718d6844a470d0320b0",
        "binaryDiffBytes": 133020,
        "binaryDiffSha256": "55975684f08c52d0034053ea3fc2f442963a667c506ff35219632a1163f0fa05",
        "paths": [
            "dwp-approval-server/src/main/java/com/dwp/services/approval/hrisbridge/separation/HrisSeparationDecisionOutboxStore.java",
            "dwp-approval-server/src/main/java/com/dwp/services/approval/hrisbridge/separation/HrisSeparationGrantStore.java",
            "dwp-approval-server/src/main/java/com/dwp/services/approval/hrisbridge/separation/HrisSeparationPersistenceModels.java",
            "dwp-approval-server/src/main/java/com/dwp/services/approval/hrisbridge/separation/HrisSeparationProofReplayStore.java",
            "dwp-approval-server/src/main/java/com/dwp/services/approval/hrisbridge/separation/HrisSeparationRlsScope.java",
            "dwp-approval-server/src/main/java/com/dwp/services/approval/hrisbridge/separation/HrisSeparationWaiverBindingStore.java",
            "dwp-approval-server/src/main/resources/db/migration/V59__bridge_hris_separation_task_waivers.sql",
            "dwp-approval-server/src/test/java/com/dwp/services/approval/hrisbridge/HrisEmployeeChangeBridgeMigrationPostgresTest.java",
            "dwp-approval-server/src/test/java/com/dwp/services/approval/hrisbridge/separation/HrisSeparationWaiverMigrationPostgresTest.java",
            "dwp-approval-server/src/test/java/com/dwp/services/approval/hrisbridge/separation/HrisSeparationWaiverStoresPostgresTest.java",
        ],
    },
    "people": {
        "path": Path("/Users/a10697/Work/DWP/.codex-worktrees/hris/wave7-20261026/batch06/hrm013-paired/people"),
        "branch": "codex/hris-wave7-batch06-hrm013-people-v61-prereq-backend-20261026-r1",
        "commit": "2d814d42d07079429d265c2e534df9715685575f",
        "tree": "cfc00d488355428fca29b9b005caafe47cde5839",
        "commits": ["4d8fcdaf269b823f0b573bb67b54b1fc1a3c8167", "2d814d42d07079429d265c2e534df9715685575f"],
        "nameStatusBytes": 1568,
        "nameStatusSha256": "912b61d09db6d885ed5dd47f21e581da371dd5d1c45a01a4a6df37439b235fd4",
        "binaryDiffBytes": 213283,
        "binaryDiffSha256": "9ba3317ea56fcb486e168fc93eb4f8a93f568714fd9b308f37b4b37c0282ecbc",
        "paths": [
            "dwp-people-server/src/main/java/com/dwp/services/people/hris/separation/hrm013/Hrm013PersistenceModels.java",
            "dwp-people-server/src/main/java/com/dwp/services/people/hris/separation/hrm013/Hrm013PersistencePorts.java",
            "dwp-people-server/src/main/java/com/dwp/services/people/hris/separation/hrm013/Hrm013ServiceAuthorityPort.java",
            "dwp-people-server/src/main/java/com/dwp/services/people/hris/separation/hrm013/Hrm013TenantScope.java",
            "dwp-people-server/src/main/java/com/dwp/services/people/hris/separation/hrm013/JdbcHrm013CallbackAuthorityStore.java",
            "dwp-people-server/src/main/java/com/dwp/services/people/hris/separation/hrm013/JdbcHrm013CallbackReceiptStore.java",
            "dwp-people-server/src/main/java/com/dwp/services/people/hris/separation/hrm013/JdbcHrm013ProofReplayStore.java",
            "dwp-people-server/src/main/java/com/dwp/services/people/hris/separation/hrm013/JdbcHrm013WaiverRequestOutboxStore.java",
            "dwp-people-server/src/main/resources/db/migration/V61__hrm_base_tfr_hrm_013.sql",
            "dwp-people-server/src/test/java/com/dwp/services/people/hris/separation/hrm013/Hrm013PrerequisiteStoresPostgresTest.java",
            "dwp-people-server/src/test/java/com/dwp/services/people/hris/separation/hrm013/Hrm013ServiceAuthorityPortTest.java",
            "dwp-people-server/src/test/java/com/dwp/services/people/hris/separation/hrm013/Hrm013V61MigrationContractTest.java",
            "dwp-people-server/src/test/java/com/dwp/services/people/hris/separation/hrm013/Hrm013V61MigrationPostgresTest.java",
            "dwp-people-server/src/test/java/com/dwp/services/people/integration/Hrm012V60MigrationPostgresTest.java",
        ],
    },
}

PINNED_ARTIFACTS = {
    "paired-prerequisite-contract-clarification.v1.json": (9244, "a839368ec78f43b1b45d6d50f0a8a741fd19e106671b52b356586a36c776079a"),
    "migration-lease-activation.v1.json": (2868, "6af2db4505d570908b3170b93d07c5fe181434a872689729fea747dfe9d3200e"),
    "token-validation-receipt.v1.json": (3634, "47678adb2f67a8b773b3ebc930540c6ed0bf5655a40d542ec89da4b56d2535d5"),
    "tokens/hrm-013-approval-v59-prerequisite.start-token.v1.json": (5468, "060a420174a36ef8a39153237b4ee8a171f2a074256ada9dcfa0d1122b88b2de"),
    "tokens/hrm-013-people-v61-prerequisite.start-token.v1.json": (5627, "8f8e87ab05402b73d20f1a4c749b9b2597b5b59663ff403ce58747f07b877146"),
    "people-v61-v60-regression-test-successor-authority.v1.json": (4299, "194e42e6e310d002153632f984bba1c251290dd32b78ca95af4744576f5f2b1c"),
}


def run(cwd: Path, *args: str, check: bool = True) -> subprocess.CompletedProcess[bytes]:
    result = subprocess.run(args, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if check and result.returncode:
        raise RuntimeError(f"{' '.join(args)} failed in {cwd}: {result.stderr.decode(errors='replace').strip()}")
    return result


def text(cwd: Path, *args: str, check: bool = True) -> str:
    return run(cwd, *args, check=check).stdout.decode().strip()


def file_digest(path: Path) -> tuple[int, str]:
    data = path.read_bytes()
    return len(data), hashlib.sha256(data).hexdigest()


def load(name: str) -> dict:
    return json.loads((HERE / name).read_text(encoding="utf-8"))


errors: list[str] = []
checks = 0


def require(condition: bool, message: str) -> None:
    global checks
    checks += 1
    if not condition:
        errors.append(message)


require(file_digest(HERE / "paired-prerequisite-central-admission-decision.v1.json") == DECISION, "central decision byte/hash drift")
for relative, expected in PINNED_ARTIFACTS.items():
    require((HERE / relative).is_file(), f"missing pinned artifact: {relative}")
    if (HERE / relative).is_file():
        require(file_digest(HERE / relative) == expected, f"pinned artifact drift: {relative}")

decision = load("paired-prerequisite-central-admission-decision.v1.json")
require(text(FRONTEND, "git", "rev-parse", "HEAD") == FRONTEND_HEAD, "frontend carrier HEAD drift")
require(text(FRONTEND, "git", "rev-parse", "HEAD^{tree}") == FRONTEND_TREE, "frontend carrier tree drift")
require(text(FRONTEND, "git", "rev-parse", "origin/dwp-dev") == FRONTEND_HEAD, "frontend origin/dwp-dev drift")

require(text(BACKEND, "git", "branch", "--show-current") == "dwp-dev", "backend integration checkout is not dwp-dev")
require(text(BACKEND, "git", "rev-parse", "HEAD") == BASE, "backend dwp-dev HEAD drift before admission")
require(text(BACKEND, "git", "rev-parse", "HEAD^{tree}") == BASE_TREE, "backend dwp-dev tree drift before admission")
require(text(BACKEND, "git", "rev-parse", "origin/dwp-dev") == BASE, "backend origin/dwp-dev drift before admission")
backend_status = run(BACKEND, "git", "status", "--porcelain=v1").stdout
require(backend_status == b"", "backend integration checkout is not clean")
require(hashlib.sha256(backend_status).hexdigest() == EMPTY_SHA, "backend porcelain digest drift")

computed_paths: dict[str, set[str]] = {}
for lane, expected in LANES.items():
    path = expected["path"]
    require(path.is_dir(), f"{lane} worktree missing")
    if not path.is_dir():
        continue
    require(text(path, "git", "branch", "--show-current") == expected["branch"], f"{lane} branch drift")
    require(text(path, "git", "rev-parse", "HEAD") == expected["commit"], f"{lane} HEAD drift")
    require(text(path, "git", "rev-parse", "HEAD^{tree}") == expected["tree"], f"{lane} tree drift")
    require(text(path, "git", "rev-parse", "@{upstream}") == expected["commit"], f"{lane} upstream is not exact")
    require(text(BACKEND, "git", "rev-parse", f"origin/{expected['branch']}") == expected["commit"], f"{lane} remote ref drift")
    require(run(path, "git", "status", "--porcelain=v1").stdout == b"", f"{lane} worktree not clean")
    require(text(BACKEND, "git", "merge-base", BASE, expected["commit"]) == BASE, f"{lane} is not based on admitted baseline")
    commits = text(BACKEND, "git", "rev-list", "--reverse", f"{BASE}..{expected['commit']}").splitlines()
    require(commits == expected["commits"], f"{lane} commit chain drift")
    name_status = run(BACKEND, "git", "diff", "--name-status", "--no-renames", f"{BASE}..{expected['commit']}").stdout
    binary_diff = run(BACKEND, "git", "diff", "--binary", "--full-index", "--no-renames", f"{BASE}..{expected['commit']}").stdout
    require((len(name_status), hashlib.sha256(name_status).hexdigest()) == (expected["nameStatusBytes"], expected["nameStatusSha256"]), f"{lane} name-status digest drift")
    require((len(binary_diff), hashlib.sha256(binary_diff).hexdigest()) == (expected["binaryDiffBytes"], expected["binaryDiffSha256"]), f"{lane} binary diff digest drift")
    paths = {line.split("\t", 1)[1] for line in name_status.decode().splitlines()}
    computed_paths[lane] = paths
    require(paths == set(expected["paths"]), f"{lane} changed path set drift")
    require(run(BACKEND, "git", "diff", "--check", f"{BASE}..{expected['commit']}").returncode == 0, f"{lane} diff-check failed")

if set(computed_paths) == set(LANES):
    require(computed_paths["approval"].isdisjoint(computed_paths["people"]), "lane changed paths overlap")

probe = run(BACKEND, "git", "merge-tree", "--write-tree", "--messages", LANES["approval"]["commit"], LANES["people"]["commit"], check=False)
probe_lines = probe.stdout.decode().splitlines()
require(probe.returncode == 0, "merge-tree reports a conflict")
require(bool(probe_lines) and probe_lines[0] == COMBINED_TREE, "combined merge tree drift")

require(decision["mergeTopology"]["requiredOrder"] == [LANES["approval"]["commit"], LANES["people"]["commit"]], "merge order drift")
require(decision["mergeTopology"]["changedPathOverlapCount"] == 0, "decision records path overlap")
require(decision["mergeTopology"]["sourceConflictResolutionAuthorized"] is False, "conflict resolution must remain forbidden")
require(decision["mergeTopology"]["sourceOrTestEditDuringIntegrationAuthorized"] is False, "integration source edits must remain forbidden")

verification = decision["mergedVerification"]
approval_classes = {
    "com.dwp.services.approval.hrisbridge.separation.HrisSeparationWaiverMigrationPostgresTest",
    "com.dwp.services.approval.hrisbridge.separation.HrisSeparationWaiverStoresPostgresTest",
    "com.dwp.services.approval.hrisbridge.HrisEmployeeChangeBridgeMigrationPostgresTest",
    "com.dwp.services.approval.hrisbridge.HrisApprovalBindingLedgerPostgresTest",
}
people_classes = {
    "com.dwp.services.people.hris.separation.hrm013.Hrm013PrerequisiteStoresPostgresTest",
    "com.dwp.services.people.hris.separation.hrm013.Hrm013ServiceAuthorityPortTest",
    "com.dwp.services.people.hris.separation.hrm013.Hrm013V61MigrationContractTest",
    "com.dwp.services.people.hris.separation.hrm013.Hrm013V61MigrationPostgresTest",
}
hrm012_methods = {
    "com.dwp.services.people.integration.Hrm012V60MigrationPostgresTest.cleanMigrationThroughV60BuildsOnlyTheTwoTablesAndLockedControls",
    "com.dwp.services.people.integration.Hrm012V60MigrationPostgresTest.upgradeFromV59PreservesRowsAndEveryHistoricalChecksum",
}
require(set(verification["approvalClasses"]) == approval_classes, "Approval merged verification set drift")
require(set(verification["peopleHrm013Classes"]) == people_classes, "People HRM-013 merged verification set drift")
require(set(verification["peopleHrm012NamedMethods"]) == hrm012_methods, "People HRM-012 named method set drift")
for task in (":dwp-approval-server:compileJava", ":dwp-approval-server:compileTestJava", ":dwp-people-server:compileJava", ":dwp-people-server:compileTestJava"):
    require(task in verification["compileCommand"], f"missing compile task: {task}")
require(verification["fullRepositoryTestRequired"] is False, "unexpected full repository validation authority")

authority = decision["authority"]
for key in ("centralAdmissionApproved", "exactApprovalCommitMergeAuthorized", "exactPeopleCommitMergeAuthorized", "approvalThenPeopleOrderRequired", "mergeCommitCreationAuthorized", "targetedMergedVerificationAuthorized", "backendDwpDevPushAuthorizedAfterAllVerificationPasses"):
    require(authority[key] is True, f"required merge authority false: {key}")
for key in ("sourceConflictResolutionAuthorized", "additionalSourceOrTestEditAuthorized", "additionalLaneCommitAuthorized", "additionalMigrationAuthorized", "runtimeActivationAuthorized", "controllerOrRelayActivationAuthorized", "frontendUiMenuOrRouteAuthorized", "moduleOwnerPacketAuthorized", "fullHrm013ModuleSourceAuthorized", "featureEnablementAuthorized", "tenantEnrollmentAuthorized", "runtimeCredentialBindingAuthorized", "productionBindingAuthorized", "productionReleaseAuthorized"):
    require(authority[key] is False, f"forbidden authority true: {key}")
require(authority["businessCompletionCredit"] == 0, "business completion credit must remain zero")

review_path = HERE / "paired-prerequisite-central-admission-independent-review-evidence.v1.json"
require(review_path.is_file(), "independent review/evidence missing")
if review_path.is_file():
    review = load(review_path.name)
    require(review["state"] == "INDEPENDENT_REVIEW_COMPLETE_ZERO_FINDINGS_GO_FOR_EXACT_PAIRED_MERGE", "review state is not GO")
    require(review["findings"] == {"p0": 0, "p1": 0, "p2": 0}, "review has findings")
    require(review["artifactPins"]["decision"] == {"path": "paired-prerequisite-central-admission-decision.v1.json", "bytes": DECISION[0], "sha256": DECISION[1]}, "review decision pin drift")
    require(review["authority"]["mergeAuthorized"] is True, "review does not authorize merge")
    require(review["authority"]["runtimeActivationAuthorized"] is False, "review authorizes runtime")
    require(review["authority"]["businessCompletionCredit"] == 0, "review grants business credit")

result = {"validator": Path(__file__).name, "state": "PASS" if not errors else "FAIL", "checks": checks, "p0": len(errors), "errors": errors}
print(json.dumps(result, ensure_ascii=False, sort_keys=True))
sys.exit(0 if not errors else 1)
