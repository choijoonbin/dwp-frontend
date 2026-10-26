#!/usr/bin/env python3
"""Validate the HRM-013 paired prerequisite Phase B execution gate."""

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
BASE_HEAD = "fe2842a36d13709e6aecc27011a8f0ad3c770ce8"
BASE_TREE = "190636f40e29126970aaf1b68b85a94eaf49402d"
PHASE_A_COMMIT = "06813924e3777fff2ebc52136741c4620d7aaa7d"
PHASE_A_TREE = "c09d01041bd3258ccaf6c9889d610ae660262593"

EXPECTED = {
    "paired-prerequisite-execution-authority.v1.json": (10379, "0ee7f88c27d3fe7756ffca017b6126a41c92607ca23940d4c826d5f9d7049a90"),
    "independent-review.v1.json": (4860, "ad8b2470784823a300fdc14b546cc1526b4d0d05f108ad6abbdfee3883027927"),
    "worktree-materialization-receipt.v1.json": (3355, "5268a089401d06e7454368c194605d65b432d0d2e043d0a8a6e6bc9280e0f5aa"),
    "paired-prerequisite-contract-clarification.v1.json": (9244, "a839368ec78f43b1b45d6d50f0a8a741fd19e106671b52b356586a36c776079a"),
    "migration-lease-activation.v1.json": (2868, "6af2db4505d570908b3170b93d07c5fe181434a872689729fea747dfe9d3200e"),
    "tokens/hrm-013-approval-v59-prerequisite.start-token.v1.json": (5468, "060a420174a36ef8a39153237b4ee8a171f2a074256ada9dcfa0d1122b88b2de"),
    "tokens/hrm-013-people-v61-prerequisite.start-token.v1.json": (5627, "8f8e87ab05402b73d20f1a4c749b9b2597b5b59663ff403ce58747f07b877146"),
}

WORKTREES = {
    "approval": {
        "path": Path("/Users/a10697/Work/DWP/.codex-worktrees/hris/wave7-20261026/batch06/hrm013-paired/approval"),
        "branch": "codex/hris-wave7-batch06-hrm013-approval-v59-prereq-backend-20261026-r1",
        "candidate": "dwp-approval-server/src/main/resources/db/migration/V59__bridge_hris_separation_task_waivers.sql",
    },
    "people": {
        "path": Path("/Users/a10697/Work/DWP/.codex-worktrees/hris/wave7-20261026/batch06/hrm013-paired/people"),
        "branch": "codex/hris-wave7-batch06-hrm013-people-v61-prereq-backend-20261026-r1",
        "candidate": "dwp-people-server/src/main/resources/db/migration/V61__hrm_base_tfr_hrm_013.sql",
    },
}


def digest(path: Path) -> tuple[int, str]:
    data = path.read_bytes()
    return len(data), hashlib.sha256(data).hexdigest()


def load(relative: str) -> dict:
    return json.loads((HERE / relative).read_text(encoding="utf-8"))


def git(cwd: Path, *args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(["git", *args], cwd=cwd, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if check and result.returncode:
        raise RuntimeError(f"git {' '.join(args)} failed in {cwd}: {result.stderr.strip()}")
    return result


errors: list[str] = []
checks = 0


def require(condition: bool, message: str) -> None:
    global checks
    checks += 1
    if not condition:
        errors.append(message)


for relative, expected in EXPECTED.items():
    path = HERE / relative
    require(path.is_file(), f"missing artifact: {relative}")
    if path.is_file():
        require(digest(path) == expected, f"byte/hash drift: {relative}: {digest(path)} != {expected}")

authority = load("paired-prerequisite-execution-authority.v1.json")
review = load("independent-review.v1.json")
receipt = load("worktree-materialization-receipt.v1.json")
clarification = load("paired-prerequisite-contract-clarification.v1.json")
leases = load("migration-lease-activation.v1.json")
approval = load("tokens/hrm-013-approval-v59-prerequisite.start-token.v1.json")
people = load("tokens/hrm-013-people-v61-prerequisite.start-token.v1.json")

require(git(FRONTEND, "rev-parse", "HEAD").stdout.strip() == PHASE_A_COMMIT, "frontend HEAD is not the committed Phase A carrier")
require(git(FRONTEND, "rev-parse", "HEAD^{tree}").stdout.strip() == PHASE_A_TREE, "frontend Phase A tree drift")
require(git(FRONTEND, "rev-parse", "origin/dwp-dev").stdout.strip() == PHASE_A_COMMIT, "origin/dwp-dev is not the Phase A carrier commit")
require(authority["authority"]["worktreeMaterialized"] is False, "immutable Phase A carrier was rewritten")
require(review["finalVerdict"] == {"p0": 0, "p1": 0, "p2": 0}, "Phase A independent review is not zero-finding")
require(receipt["assertions"]["exactlyTwoPlannedWorktreesMaterialized"] is True, "worktree materialization receipt is not PASS")

for lane, spec in WORKTREES.items():
    path = spec["path"]
    require(path.is_dir(), f"{lane} worktree missing")
    if not path.is_dir():
        continue
    status = git(path, "status", "--porcelain=v1").stdout
    require(git(path, "rev-parse", "HEAD").stdout.strip() == BASE_HEAD, f"{lane} HEAD drift before execution")
    require(git(path, "rev-parse", "HEAD^{tree}").stdout.strip() == BASE_TREE, f"{lane} tree drift before execution")
    require(git(path, "branch", "--show-current").stdout.strip() == spec["branch"], f"{lane} branch mismatch")
    require(status == "", f"{lane} worktree is not clean before execution")
    require(hashlib.sha256(status.encode()).hexdigest() == EMPTY_SHA, f"{lane} porcelain digest mismatch")
    upstream = git(path, "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}", check=False)
    require(upstream.returncode != 0, f"{lane} unexpectedly has upstream")
    remote = git(BACKEND, "ls-remote", "--heads", "origin", spec["branch"])
    require(remote.stdout == "", f"{lane} remote branch already exists")
    require(not (path / spec["candidate"]).exists(), f"{lane} candidate migration already exists before token execution")

active = {(entry["stream"], entry["candidateVersion"]): entry for entry in leases["leases"] if entry["state"] == "ACTIVE"}
require(set(active) == {("APPROVAL_MAIN", "V59"), ("PEOPLE_MAIN", "V61")}, "exact two different-stream active leases required")
require(all(entry["exclusiveActiveLeaseCountForStream"] == 1 for entry in active.values()), "lease is not exclusive")
require(leases["rules"]["leaseAloneAuthorizesSourceOrSql"] is False, "lease alone must not authorize source")

idem = clarification["approval"]["idempotency"]
require(idem["idempotencyKey"] == "canonical lowercase 36-character UUID text of approvalRequestId", "Approval idempotency key ambiguity")
require(clarification["approval"]["retry"]["maximumAttempts"] == 10, "Approval retry maximum must be 10")
require(clarification["approval"]["stepUp"]["freshnessWindowSeconds"] == 600, "Approval step-up freshness must be 600 seconds")
require(clarification["approval"]["terminalSink"]["soleTerminalSink"] == "apr_hrm013_waiver_decision_outbox", "sole terminal sink drift")
require(clarification["approval"]["hrm010Revision"]["terminalDecisionRevision"] == 1, "HRM-010 terminal decision revision must be 1")
require("unsigned 32-bit big-endian byte length" in clarification["approval"]["grantDigest"]["encoding"], "grant digest length-prefix encoding missing")
require(clarification["people"]["controlPlaneAuthorityPort"]["requiredTypedPort"] == "Hrm013ServiceAuthorityPort", "People typed control-plane port missing")
require("configuration cache" in clarification["people"]["controlPlaneAuthorityPort"]["forbiddenFallbacks"], "People config-cache fallback not forbidden")
require(clarification["people"]["retry"]["maximumAttempts"] == 10 and clarification["people"]["retry"]["attemptCountRange"] == "0..10 inclusive", "People APR-002 outbox retry maximum must be 10")
require(len(clarification["people"]["v61Split"]["sqlMustCreateFullEffectiveSixTableManifest"]) == 6, "People V61 must create six tables")

for token, lane in ((approval, "approval"), (people, "people")):
    flags = token["authority"]
    require(flags["tokenExecutable"] is True, f"{lane} token is not executable")
    for key in ("migrationSqlAuthoringAuthorized", "boundedSourceAuthoringAuthorized", "targetedTestAuthoringAndExecutionAuthorized", "laneBranchCommitAuthorized", "laneBranchPushAuthorized"):
        require(flags[key] is True, f"{lane} required bounded authority false: {key}")
    for key in ("directDwpDevMergeAuthorized", "centralAdmissionAuthorized", "moduleOwnerPacketAuthorized", "fullModuleSourceAuthorized", "frontendSourceAuthorized", "runtimeActivationAuthorized", "featureEnablementAuthorized", "tenantEnrollmentAuthorized", "productionBindingAuthorized", "productionReleaseAuthorized"):
        require(flags[key] is False, f"{lane} forbidden authority true: {key}")
    require(flags["businessCompletionCredit"] == 0, f"{lane} business completion credit is nonzero")

require(approval["changedPathAllowlist"]["existingEditOnly"] == ["dwp-approval-server/src/test/java/com/dwp/services/approval/hrisbridge/HrisEmployeeChangeBridgeMigrationPostgresTest.java"], "Approval existing-edit allowlist drift")
require("second Flyway builder" in approval["changedPathAllowlist"]["existingEditConstraint"] and ".target(\"58\")" in approval["changedPathAllowlist"]["existingEditConstraint"] and "three V58 employee-change tables" in approval["changedPathAllowlist"]["existingEditConstraint"], "Approval V58 non-regression edit constraint drift")
require(any("controller" == item for item in approval["implementationScope"]["forbidden"]), "Approval controller prohibition missing")
require(any("runtime/native terminal wiring" == item for item in approval["implementationScope"]["forbidden"]), "Approval terminal wiring prohibition missing")
require(people["changedPathAllowlist"]["existingEditOnly"] == [], "People existing edits must be empty")
require(any("application.yml edit" == item for item in people["implementationScope"]["forbidden"]), "People configuration edit prohibition missing")
require(any("HTTP ingress activation" == item for item in people["implementationScope"]["forbidden"]), "People ingress activation prohibition missing")

validation_receipt_path = HERE / "token-validation-receipt.v1.json"
require(validation_receipt_path.is_file(), "token validation receipt missing")
if validation_receipt_path.is_file():
    validation = load("token-validation-receipt.v1.json")
    require(validation["state"] == "PASS_TWO_EXECUTABLE_BOUNDED_TOKENS", "token validation receipt not PASS")
    require(validation["findings"] == {"p0": 0, "p1": 0, "p2": 0}, "token validation findings are nonzero")
    require(validation["authority"]["directDwpDevMergeAuthorized"] is False, "validation receipt permits direct merge")
    require(validation["authority"]["runtimeActivationAuthorized"] is False, "validation receipt permits runtime")
    require(validation["authority"]["businessCompletionCredit"] == 0, "validation receipt grants business credit")

result = {
    "validator": "validate_hrm013_paired_prerequisite_execution.py",
    "state": "PASS" if not errors else "FAIL",
    "checks": checks,
    "p0": len(errors),
    "errors": errors,
}
print(json.dumps(result, ensure_ascii=False, sort_keys=True))
sys.exit(0 if not errors else 1)
