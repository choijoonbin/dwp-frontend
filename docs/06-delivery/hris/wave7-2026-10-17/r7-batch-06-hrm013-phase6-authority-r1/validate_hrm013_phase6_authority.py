#!/usr/bin/env python3
"""Fail-closed authoring validator for the HRM-013 Phase-6 authority carrier."""

from __future__ import annotations

import hashlib
import json
import os
import re
import stat
import subprocess
import sys
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
FRONTEND_BASE = "7ae106853d7110dde96da37e321757d15f6d3c33"
FRONTEND_TREE = "e4265efb2c2cef2668cbb39c3fe2e4c9ba94dba6"
BACKEND_BASE = "8ccc7baeff43b60dc6cdf719449514f56b6dbca5"
BACKEND_TREE = "f17b244d9d47da035dfe09f7c9a604796f19eb74"
CARRIER_BRANCH = "codex/hris-wave7-batch06-hrm013-phase6-authority-frontend-20261027-r1"
DIR = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-phase6-authority-r1"
)
AUTHORITY = f"{DIR}/phase6-task-owner-execution-authority.v1.json"
REVIEW = f"{DIR}/independent-review.v1.json"
VALIDATOR = f"{DIR}/validate_hrm013_phase6_authority.py"
TIME_RESERVATION = f"{DIR}/reservations/time-v15.migration-reservation.v1.json"
PAYROLL_RESERVATION = f"{DIR}/reservations/payroll-v56.migration-reservation.v1.json"
AUTH_RESERVATION = f"{DIR}/reservations/auth-v272.migration-reservation.v1.json"
TIME_TOKEN = f"{DIR}/tokens/hrm-013-time-task-owner.start-token.v1.json"
PAYROLL_TOKEN = f"{DIR}/tokens/hrm-013-payroll-task-owner.start-token.v1.json"
AUTH_TOKEN = f"{DIR}/tokens/hrm-013-auth-identity-task-owner.start-token.v1.json"
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
    AUTHORITY,
    REVIEW,
    VALIDATOR,
    TIME_RESERVATION,
    PAYROLL_RESERVATION,
    AUTH_RESERVATION,
    TIME_TOKEN,
    PAYROLL_TOKEN,
    AUTH_TOKEN,
}
PACKAGE_JSON_SHA256 = "2852cdd0cb616ff419479018e9d30d3602d606a9014fbf64e9a40d6b8d889bb6"
ACCEPTANCE_SHA256 = "72c40f9a0a7ec19cc4b27e3caec7443a4d653a2aa42546113601af32f64f383b"
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


def read_regular(path: Path) -> bytes:
    if path.is_symlink() or not path.is_file():
        raise ValidationError(f"missing or symlinked regular file: {path}")
    return path.read_bytes()


def load_json_bytes(data: bytes, label: str) -> dict[str, Any]:
    def pairs(values: list[tuple[str, Any]]) -> dict[str, Any]:
        result: dict[str, Any] = {}
        for key, value in values:
            if key in result:
                raise ValidationError(f"duplicate JSON key in {label}: {key}")
            result[key] = value
        return result

    value = json.loads(data.decode(), object_pairs_hook=pairs)
    if not isinstance(value, dict):
        raise ValidationError(f"JSON root must be an object: {label}")
    return value


def load_json(path: str) -> dict[str, Any]:
    return load_json_bytes(read_regular(ROOT / path), path)


def status_paths(repo: Path) -> set[str]:
    lines = text(repo, "status", "--porcelain=v1", "--untracked-files=all").splitlines()
    paths: set[str] = set()
    for line in lines:
        if not line:
            continue
        if len(line) < 4:
            raise ValidationError(f"malformed git status line: {line!r}")
        path = line[3:]
        if " -> " in path:
            path = path.split(" -> ", 1)[1]
        paths.add(path)
    return paths


def changed_paths(commit: str) -> set[str]:
    parent_count = int(text(ROOT, "rev-list", "--parents", "-n", "1", commit).count(" "))
    if parent_count != 1:
        raise ValidationError("authority carrier must be a non-merge commit")
    return set(
        output(ROOT, "diff-tree", "--no-commit-id", "--name-only", "-r", commit)
        .decode()
        .splitlines()
    )


def validate_repo_state(checks: Checks) -> None:
    checks.exact(digest(read_regular(ROOT / "package.json")), PACKAGE_JSON_SHA256, "package.json unchanged")
    head = text(ROOT, "rev-parse", "HEAD")
    origin_dwp_dev = text(ROOT, "rev-parse", "origin/dwp-dev")
    if head == FRONTEND_BASE:
        checks.exact(origin_dwp_dev, FRONTEND_BASE, "frontend origin/dwp-dev at authoring base")
        checks.exact(text(ROOT, "rev-parse", "HEAD^{tree}"), FRONTEND_TREE, "frontend base tree")
        checks.exact(text(ROOT, "branch", "--show-current"), CARRIER_BRANCH, "carrier branch")
        checks.exact(status_paths(ROOT), CARRIER_PATHS, "authoring dirty path boundary")
    else:
        candidates = output(
            ROOT, "log", "--all", "--diff-filter=A", "--format=%H", "--", AUTHORITY
        ).decode().splitlines()
        carriers = [
            candidate
            for candidate in candidates
            if text(ROOT, "rev-parse", f"{candidate}^") == FRONTEND_BASE
            and changed_paths(candidate) == CARRIER_PATHS
        ]
        checks.exact(len(carriers), 1, "unique direct-child carrier")
        carrier = carriers[0]
        checks.require(
            origin_dwp_dev == FRONTEND_BASE
            or run(ROOT, "merge-base", "--is-ancestor", carrier, origin_dwp_dev).returncode == 0,
            "frontend origin/dwp-dev must be the base or contain the immutable carrier",
        )
        checks.require(
            run(ROOT, "merge-base", "--is-ancestor", carrier, head).returncode == 0,
            "carrier must remain an ancestor of frontend HEAD",
        )
        for path in CARRIER_PATHS:
            checks.exact(
                read_regular(ROOT / path),
                output(ROOT, "show", f"{carrier}:{path}"),
                f"immutable carrier artifact {path}",
            )

    checks.exact(text(BACKEND, "rev-parse", "HEAD"), BACKEND_BASE, "backend HEAD")
    checks.exact(text(BACKEND, "rev-parse", "HEAD^{tree}"), BACKEND_TREE, "backend tree")
    checks.exact(text(BACKEND, "rev-parse", "origin/dwp-dev"), BACKEND_BASE, "backend origin/dwp-dev")
    checks.exact(text(BACKEND, "branch", "--show-current"), "dwp-dev", "backend branch")
    checks.exact(status_paths(BACKEND), set(), "backend base cleanliness")


def validate_pins(checks: Checks, authority: dict[str, Any]) -> None:
    expected = [
        (
            RECEIPTS / "people-owner-runtime-central-integration-receipt.v1.json",
            16669,
            "f8bde1048167e6d2ae5a7f1d7522dec2c06b89b2d4c6823c3ad274269fdb3b91",
            "GO_FOR_SEPARATE_PHASE6_TASK_OWNER_EXECUTION_AUTHORITY_AUTHORING_ONLY",
        ),
        (
            RECEIPTS / "bounded-shared-auth-approval-people-handshake-matrix-receipt.v1.json",
            3883,
            "65d60fbf874635d68d03c06a0c067d7d28c5dedbd03d833b1271c27b60b3c7ea",
            "PASS_OWNER_RUNTIME_BOUNDED_HANDSHAKE_PREREQUISITE_SATISFIED_FOR_SEPARATE_PHASE6_AUTHORITY_AUTHORING",
        ),
        (
            RECEIPTS / "bounded-shared-auth-approval-people-handshake-matrix-independent-review.v1.json",
            3519,
            "3f6f1ea985467573467f86f0388f5e986eb36cec528e43b6239f899db4327fd2",
            "GO_FOR_SEPARATE_PHASE6_TASK_OWNER_EXECUTION_AUTHORITY_AUTHORING_ONLY",
        ),
    ]
    for path, size, sha256, decision in expected:
        data = read_regular(path)
        checks.exact(stat.S_IMODE(path.stat().st_mode), 0o600, f"owner-only mode {path.name}")
        checks.exact(len(data), size, f"receipt size {path.name}")
        checks.exact(digest(data), sha256, f"receipt digest {path.name}")
        checks.exact(load_json_bytes(data, str(path)).get("decision"), decision, f"receipt decision {path.name}")

    integration = load_json_bytes(read_regular(expected[0][0]), str(expected[0][0]))
    auth = integration["authority"]
    checks.exact(auth["phase6TaskOwnerAuthorityAuthoringMayProceed"], True, "Phase-6 authoring prerequisite")
    checks.exact(auth["phase6TaskOwnerImplementationAuthorizedByThisReceipt"], False, "predecessor grants no implementation")
    checks.exact(integration["backendIntegration"]["targetCommitAfter"], BACKEND_BASE, "receipt backend base")
    checks.exact(integration["backendIntegration"]["targetTreeAfter"], BACKEND_TREE, "receipt backend tree")
    checks.exact(integration["frontendIntegration"]["targetHead"], FRONTEND_BASE, "receipt frontend base")

    tracked = [
        (GATE, 170804, "aa88b6116f2fa8ca4e96d85204414a737e763afa4e1bb01372e31fdaa59deb47"),
        (REGISTER, 23958, "16e1401119b1bfff0cf6fa0383ec311e154db91e86df738fb9dffa5e4dd8bf1a"),
    ]
    for path, size, sha256 in tracked:
        data = read_regular(ROOT / path)
        checks.exact(len(data), size, f"tracked pin size {path}")
        checks.exact(digest(data), sha256, f"tracked pin digest {path}")
        checks.exact(data, output(ROOT, "show", f"{FRONTEND_BASE}:{path}"), f"base blob {path}")

    checks.exact(len(authority["sealedPrerequisites"]), 5, "sealed prerequisite count")
    declared = {entry["path"]: entry for entry in authority["sealedPrerequisites"]}
    checks.exact(set(declared), {str(item[0]) for item in expected} | {GATE, REGISTER}, "sealed prerequisite paths")
    for path, size, sha256, decision in expected:
        entry = declared[str(path)]
        checks.exact(entry["mode"], "0600", f"declared receipt mode {path.name}")
        checks.exact(entry["bytes"], size, f"declared receipt size {path.name}")
        checks.exact(entry["sha256"], sha256, f"declared receipt digest {path.name}")
        checks.exact(entry["requiredDecision"], decision, f"declared receipt decision {path.name}")
    for path, size, sha256 in tracked:
        entry = declared[path]
        checks.exact(entry["bytes"], size, f"declared tracked size {path}")
        checks.exact(entry["sha256"], sha256, f"declared tracked digest {path}")


def validate_gate_projection(checks: Checks, authority: dict[str, Any]) -> dict[str, Any]:
    gate = load_json(GATE)
    projection = authority["sealedGateProjection"]
    checks.exact(
        projection["futureSourceAllowlistsTaskDispatchOwners"],
        gate["futureSourceAllowlists"]["taskDispatchOwners"],
        "exact copied Phase-6 source allowlist",
    )
    checks.exact(
        projection["futureTargetTestAllowlistsTaskDispatchOwners"],
        gate["futureTargetTestAllowlists"]["taskDispatchOwners"],
        "exact copied Phase-6 target test allowlist",
    )
    matrix = gate["targetedAcceptanceMatrix"]
    canonical = json.dumps(matrix, ensure_ascii=False, separators=(",", ":")).encode()
    checks.exact(digest(canonical), ACCEPTANCE_SHA256, "twelve-condition canonical digest")
    checks.exact(len(matrix), 12, "twelve-condition count")
    checks.exact(authority["acceptanceMatrixPin"]["source"], "sealedPrerequisites.TRACKED_GATE.targetedAcceptanceMatrix", "declared acceptance source")
    checks.exact(authority["acceptanceMatrixPin"]["canonicalCompactJsonSha256"], ACCEPTANCE_SHA256, "declared acceptance digest")
    checks.exact(authority["acceptanceMatrixPin"]["conditionCount"], 12, "declared acceptance count")
    checks.exact(
        authority["acceptanceMatrixPin"]["ids"],
        [f"HRM013-RBG-{number:02d}" for number in range(1, 13)],
        "twelve-condition ids",
    )
    checks.exact(len(projection["futureTargetTestAllowlistsTaskDispatchOwners"]), 30, "target test count")
    checks.exact(
        len(set(projection["futureTargetTestAllowlistsTaskDispatchOwners"])),
        30,
        "target test uniqueness",
    )
    return gate


def validate_migrations(checks: Checks) -> None:
    specs = [
        (
            TIME_RESERVATION,
            "TIME_TASK_OWNER",
            "TIME_MAIN",
            "V14",
            "dwp-time-server/src/main/resources/db/migration/V14__tim_base_tfr_tim_003_employment_absence_projection.sql",
            18812,
            "d442c9f6315cf01d60601694499d0cf79eff1d9f7d784b0fb162ec2a3aef66eb",
            "V15",
            "dwp-time-server/src/main/resources/db/migration/V15__hrm013_time_task_dispatch_inbox.sql",
        ),
        (
            PAYROLL_RESERVATION,
            "PAYROLL_TASK_OWNER",
            "PAYROLL_MAIN",
            "V55",
            "dwp-payroll-server/src/main/resources/db/migration/V55__pay_base_tfr_pay_004_retirement.sql",
            44054,
            "7596e52c968d8a754f2fa8336260fc5aa790be8d02b97e6edd9aae56fd3f1f84",
            "V56",
            "dwp-payroll-server/src/main/resources/db/migration/V56__hrm013_payroll_task_dispatch_inbox.sql",
        ),
        (
            AUTH_RESERVATION,
            "AUTH_IDENTITY_TASK_OWNER",
            "AUTH_MAIN",
            "V271",
            "dwp-auth-server/src/main/resources/db/migration/V271__create_hris_service_grant_authority.sql",
            39093,
            "800abea33e1103790ef15065d74f05e589da66fd69c1346c875c0ea1461237a8",
            "V272",
            "dwp-auth-server/src/main/resources/db/migration/V272__hrm013_identity_task_dispatch_inbox.sql",
        ),
    ]
    version_pattern = re.compile(r"^V(\d+)__")
    for reservation_path, lane, stream, prior_version, prior_path, size, sha256, version, candidate in specs:
        reservation = load_json(reservation_path)
        checks.exact(reservation["schema"], "dwp.hris.wave7.hrm013-phase6-migration-reservation.v1", f"reservation schema {lane}")
        checks.exact(reservation["lane"], lane, f"reservation lane {lane}")
        checks.exact(reservation["stream"], stream, f"reservation stream {lane}")
        checks.exact(reservation["backendBase"], {"commit": BACKEND_BASE, "tree": BACKEND_TREE}, f"reservation base {lane}")
        checks.exact(reservation["predecessor"]["version"], prior_version, f"predecessor version {lane}")
        checks.exact(reservation["predecessor"]["path"], prior_path, f"predecessor path {lane}")
        prior = read_regular(BACKEND / prior_path)
        checks.exact(len(prior), size, f"predecessor size {lane}")
        checks.exact(digest(prior), sha256, f"predecessor digest {lane}")
        checks.exact(reservation["reservation"]["version"], version, f"reserved version {lane}")
        checks.exact(reservation["reservation"]["path"], candidate, f"reserved path {lane}")
        checks.exact(reservation["reservation"]["mustBeAbsentAtBase"], True, f"candidate absent contract {lane}")
        checks.exact(reservation["reservation"]["exclusiveToTokenLane"], lane, f"exclusive token lane {lane}")
        checks.exact(reservation["reservation"]["schemaOnlyDefaultOff"], True, f"default-off migration {lane}")
        checks.exact(reservation["reservation"]["seedTenantGrantCredentialOrEnrollmentRowsAllowed"], False, f"no seeded authority rows {lane}")
        checks.require(not (BACKEND / candidate).exists(), f"reserved candidate already exists: {candidate}")
        migration_dir = (BACKEND / prior_path).parent
        observed = []
        for child in migration_dir.iterdir():
            match = version_pattern.match(child.name)
            if match:
                observed.append(int(match.group(1)))
        checks.exact(max(observed), int(prior_version[1:]), f"migration high-water {stream}")
        checks.exact(reservation["authority"]["migrationReservationActive"], True, f"active reservation {lane}")
        checks.exact(reservation["authority"]["migrationAuthoringAuthorizedByMatchingConditionalToken"], True, f"conditional migration authority {lane}")
        checks.exact(reservation["authority"]["featureActivationAuthorized"], False, f"no feature activation {lane}")
        checks.exact(reservation["authority"]["tenantEnrollmentAuthorized"], False, f"no tenant enrollment {lane}")
        checks.exact(reservation["authority"]["productionReleaseAuthorized"], False, f"no production release {lane}")
        other_key = {"TIME_TASK_OWNER": "anyOtherTimeMigrationAuthorized", "PAYROLL_TASK_OWNER": "anyOtherPayrollMigrationAuthorized", "AUTH_IDENTITY_TASK_OWNER": "anyOtherAuthMigrationAuthorized"}[lane]
        checks.exact(reservation["authority"], {
            "migrationReservationActive": True,
            "migrationAuthoringAuthorizedByMatchingConditionalToken": True,
            other_key: False,
            "featureActivationAuthorized": False,
            "tenantEnrollmentAuthorized": False,
            "productionReleaseAuthorized": False,
        }, f"complete reservation authority boundary {lane}")


def expanded_source(scope: dict[str, Any]) -> list[str]:
    return [scope["package"] + name for name in scope["newClasses"]] + scope["existingMayModify"] + [scope["migrationCandidateNotReserved"]]


def validate_tokens(checks: Checks, gate: dict[str, Any]) -> None:
    source = gate["futureSourceAllowlists"]["taskDispatchOwners"]
    tests = gate["futureTargetTestAllowlists"]["taskDispatchOwners"]
    specs = [
        (
            TIME_TOKEN,
            "dwp.hris.wave7.hrm013-time-task-owner-start-token.v1",
            "TIME_TASK_OWNER",
            source["time"],
            [path for path in tests if path.startswith("dwp-time-server/")],
            "/Users/a10697/Work/DWP/.codex-worktrees/hris/wave7-20261027/batch06/hrm013-phase6/time",
            "codex/hris-wave7-batch06-hrm013-phase6-time-backend-20261027-r1",
            TIME_RESERVATION,
        ),
        (
            PAYROLL_TOKEN,
            "dwp.hris.wave7.hrm013-payroll-task-owner-start-token.v1",
            "PAYROLL_TASK_OWNER",
            source["payroll"],
            [path for path in tests if path.startswith("dwp-payroll-server/")],
            "/Users/a10697/Work/DWP/.codex-worktrees/hris/wave7-20261027/batch06/hrm013-phase6/payroll",
            "codex/hris-wave7-batch06-hrm013-phase6-payroll-backend-20261027-r1",
            PAYROLL_RESERVATION,
        ),
        (
            AUTH_TOKEN,
            "dwp.hris.wave7.hrm013-auth-identity-task-owner-start-token.v1",
            "AUTH_IDENTITY_TASK_OWNER",
            source["authIdentityTask"],
            [path for path in tests if path.startswith("dwp-auth-server/")],
            "/Users/a10697/Work/DWP/.codex-worktrees/hris/wave7-20261027/batch06/hrm013-phase6/auth",
            "codex/hris-wave7-batch06-hrm013-phase6-auth-backend-20261027-r1",
            AUTH_RESERVATION,
        ),
    ]
    for token_path, schema, lane, gate_scope, expected_tests, worktree, branch, reservation in specs:
        token = load_json(token_path)
        checks.exact(token["schema"], schema, f"token schema {lane}")
        checks.exact(token["lane"], lane, f"token lane {lane}")
        checks.exact(token["state"], "CONDITIONAL_EXECUTABLE_AFTER_CARRIER_PUSH_AND_MATCHING_EXTERNAL_CLEAN_WORKTREE_RECEIPT", f"token state {lane}")
        checks.exact(token["backendBase"], {"repository": "dwp-backend", "branch": "dwp-dev", "commit": BACKEND_BASE, "tree": BACKEND_TREE}, f"token base {lane}")
        checks.exact(
            token["authorityCarrier"],
            {
                "path": AUTHORITY,
                "requiredCarrierBranch": CARRIER_BRANCH,
                "requiredCarrierBase": FRONTEND_BASE,
                "carrierCommitAndRemotePushRequired": True,
            },
            f"token carrier binding {lane}",
        )
        checks.exact(
            token["prerequisiteReceiptPin"],
            {
                "path": str(RECEIPTS / "people-owner-runtime-central-integration-receipt.v1.json"),
                "sha256": "f8bde1048167e6d2ae5a7f1d7522dec2c06b89b2d4c6823c3ad274269fdb3b91",
            },
            f"token prerequisite pin {lane}",
        )
        checks.exact(token["migrationReservation"], reservation, f"token reservation {lane}")
        checks.exact(token["worktree"]["absolutePath"], worktree, f"token worktree {lane}")
        checks.exact(token["worktree"]["branch"], branch, f"token branch {lane}")
        checks.exact(token["worktree"]["baseHead"], BACKEND_BASE, f"token worktree base {lane}")
        checks.exact(token["worktree"]["baseTree"], BACKEND_TREE, f"token worktree tree {lane}")
        receipt_leaf = {"TIME_TASK_OWNER": "time", "PAYROLL_TASK_OWNER": "payroll", "AUTH_IDENTITY_TASK_OWNER": "auth"}[lane]
        checks.exact(
            token["worktree"]["cleanReceiptPath"],
            f"/Users/a10697/Work/DWP/.codex-worktrees/hris/wave7-20261027/batch06/hrm013-phase6/receipts/{receipt_leaf}-clean-worktree-receipt.v1.json",
            f"token clean receipt path {lane}",
        )
        checks.exact(token["worktree"]["cleanReceiptSchema"], "dwp.hris.wave7.hrm013-phase6-clean-worktree-receipt.v1", f"token clean receipt schema {lane}")
        for field in ("cleanAtIssueRequired", "upstreamAbsentAtIssueRequired", "remoteBranchAbsentAtIssueRequired"):
            checks.exact(token["worktree"][field], True, f"token clean precondition {lane}.{field}")
        checks.require(not Path(worktree).exists(), f"worktree must not preexist: {worktree}")
        checks.require(run(BACKEND, "show-ref", "--verify", "--quiet", f"refs/heads/{branch}").returncode != 0, f"local branch must not preexist: {branch}")
        checks.require(run(BACKEND, "show-ref", "--verify", "--quiet", f"refs/remotes/origin/{branch}").returncode != 0, f"remote branch must not preexist: {branch}")
        checks.exact(token["sourceScope"]["exactAuthorizedPaths"], expanded_source(gate_scope), f"token source scope {lane}")
        checks.exact(token["sourceScope"]["exactNewPaths"], [gate_scope["package"] + name for name in gate_scope["newClasses"]] + [gate_scope["migrationCandidateNotReserved"]], f"token new paths {lane}")
        checks.exact(token["sourceScope"]["exactExistingMayModify"], gate_scope["existingMayModify"], f"token existing paths {lane}")
        checks.exact(token["targetedVerification"]["exactTestPaths"], expected_tests, f"token tests {lane}")
        checks.exact(token["targetedVerification"]["broadRepositoryRerunAuthorized"], False, f"no broad rerun {lane}")
        token_authority = token["authority"]
        expected_integrations = {
            "TIME_TASK_OWNER": {"branchCommitAndPushAfterIndependentReviewAuthorized": True, "directDwpDevMergeAuthorized": False, "requiredCentralOrder": 1},
            "PAYROLL_TASK_OWNER": {"branchCommitAndPushAfterIndependentReviewAuthorized": True, "directDwpDevMergeAuthorized": False, "requiredCentralOrder": 2, "rebaseOnLatestDwpDevBeforeIntegrationRequired": True},
            "AUTH_IDENTITY_TASK_OWNER": {"branchCommitAndPushAfterIndependentReviewAuthorized": True, "directDwpDevMergeAuthorized": False, "requiredCentralOrder": 3, "rebaseOnLatestDwpDevBeforeIntegrationRequired": True, "completeTwelveConditionMatrixAfterIntegrationRequired": True},
        }
        checks.exact(token["integration"], expected_integrations[lane], f"integration contract {lane}")
        source_authority_key = {"TIME_TASK_OWNER": "timeTaskOwnerSourceAuthoringAuthorized", "PAYROLL_TASK_OWNER": "payrollTaskOwnerSourceAuthoringAuthorized", "AUTH_IDENTITY_TASK_OWNER": "authIdentityTaskOwnerSourceAuthoringAuthorized"}[lane]
        migration_authority_key = {"TIME_TASK_OWNER": "timeV15MigrationAuthoringAuthorized", "PAYROLL_TASK_OWNER": "payrollV56MigrationAuthoringAuthorized", "AUTH_IDENTITY_TASK_OWNER": "authV272MigrationAuthoringAuthorized"}[lane]
        checks.exact(token_authority, {
            source_authority_key: True,
            migration_authority_key: True,
            "hrm008CallbackProducerImplementationAuthorized": True,
            "centralPeopleHandshakeTestAuthoringAuthorized": lane == "AUTH_IDENTITY_TASK_OWNER",
            "otherPeopleSourceOrTestAuthoringAuthorized": False,
            "otherModuleSourceAuthoringAuthorized": False,
            "featureActivationAuthorized": False,
            "tenantEnrollmentAuthorized": False,
            "runtimeCredentialProvisioningAuthorized": False,
            "productionReleaseAuthorized": False,
            "businessCompletionCredit": 0,
        }, f"complete token authority boundary {lane}")
        checks.exact(token_authority[source_authority_key], True, f"source authoring authority {lane}")
        checks.exact(token_authority[migration_authority_key], True, f"migration authoring authority {lane}")
        checks.exact(token_authority["hrm008CallbackProducerImplementationAuthorized"], True, f"callback producer authority {lane}")
        checks.exact(token_authority["centralPeopleHandshakeTestAuthoringAuthorized"], lane == "AUTH_IDENTITY_TASK_OWNER", f"People handshake exception {lane}")
        checks.exact(token_authority["otherPeopleSourceOrTestAuthoringAuthorized"], False, f"no other People source or test {lane}")
        checks.exact(token_authority["otherModuleSourceAuthoringAuthorized"], False, f"no other module source {lane}")
        checks.exact(token_authority["featureActivationAuthorized"], False, f"no feature activation {lane}")
        checks.exact(token_authority["tenantEnrollmentAuthorized"], False, f"no tenant enrollment {lane}")
        checks.exact(token_authority["runtimeCredentialProvisioningAuthorized"], False, f"no credential provisioning {lane}")
        checks.exact(token_authority["productionReleaseAuthorized"], False, f"no production release {lane}")
        checks.exact(token_authority["businessCompletionCredit"], 0, f"zero business completion {lane}")

    auth_token = load_json(AUTH_TOKEN)
    people_handshake = [path for path in tests if path.startswith("dwp-people-server/")]
    checks.exact(people_handshake, [auth_token["targetedVerification"]["centralPeopleHandshakeTest"]], "central People handshake test")


def validate_documents(checks: Checks) -> None:
    authority = load_json(AUTHORITY)
    review = load_json(REVIEW)
    checks.exact(authority["schema"], "dwp.hris.wave7.hrm013-phase6-task-owner-execution-authority.v1", "authority schema")
    checks.exact(authority["state"], "INDEPENDENTLY_REVIEWED_HASH_BOUND_PARALLEL_TIME_PAYROLL_AUTH_TASK_OWNER_EXECUTION_AUTHORITY", "authority state")
    checks.exact(authority["carrier"]["baseCommit"], FRONTEND_BASE, "authority frontend base")
    checks.exact(authority["carrier"]["baseTree"], FRONTEND_TREE, "authority frontend tree")
    checks.exact(authority["carrier"]["exactChangedPathCount"], 9, "authority changed path count")
    checks.exact(authority["backendBase"]["commit"], BACKEND_BASE, "authority backend base")
    checks.exact(authority["backendBase"]["tree"], BACKEND_TREE, "authority backend tree")
    checks.exact(authority["migrationReservations"], [
        {"lane": "TIME_TASK_OWNER", "path": TIME_RESERVATION, "version": "V15"},
        {"lane": "PAYROLL_TASK_OWNER", "path": PAYROLL_RESERVATION, "version": "V56"},
        {"lane": "AUTH_IDENTITY_TASK_OWNER", "path": AUTH_RESERVATION, "version": "V272"},
    ], "authority migration reservation declarations")
    checks.exact(authority["tokens"], [
        {"lane": "TIME_TASK_OWNER", "path": TIME_TOKEN, "schema": "dwp.hris.wave7.hrm013-time-task-owner-start-token.v1"},
        {"lane": "PAYROLL_TASK_OWNER", "path": PAYROLL_TOKEN, "schema": "dwp.hris.wave7.hrm013-payroll-task-owner-start-token.v1"},
        {"lane": "AUTH_IDENTITY_TASK_OWNER", "path": AUTH_TOKEN, "schema": "dwp.hris.wave7.hrm013-auth-identity-task-owner-start-token.v1"},
    ], "authority token declarations")
    checks.exact(authority["executionTopology"], {
        "parallelAuthoringFromSameBackendBase": True,
        "authoringOrder": [
            "COMMIT_AND_PUSH_AUTHORITY_CARRIER",
            "MATERIALIZE_THREE_CLEAN_BACKEND_WORKTREES_AND_OWNER_ONLY_0600_RECEIPTS",
            "AUTHOR_AND_RUN_ONLY_EACH_LANE_COMPILE_AND_NAMED_TESTS_IN_PARALLEL",
        ],
        "centralIntegrationOrder": [
            "INDEPENDENTLY_REVIEW_COMMIT_AND_PUSH_TIME_TASK_OWNER",
            "FAST_FORWARD_TIME_TASK_OWNER_TO_BACKEND_DWP_DEV",
            "REBASE_PAYROLL_TASK_OWNER_ON_LATEST_BACKEND_DWP_DEV_AND_RERUN_ONLY_ITS_NAMED_TARGETS",
            "INDEPENDENTLY_REVIEW_COMMIT_AND_PUSH_PAYROLL_TASK_OWNER",
            "FAST_FORWARD_PAYROLL_TASK_OWNER_TO_BACKEND_DWP_DEV",
            "REBASE_AUTH_IDENTITY_TASK_OWNER_ON_LATEST_BACKEND_DWP_DEV_AND_RERUN_ONLY_ITS_NAMED_TARGETS",
            "INDEPENDENTLY_REVIEW_COMMIT_AND_PUSH_AUTH_IDENTITY_TASK_OWNER",
            "FAST_FORWARD_AUTH_IDENTITY_TASK_OWNER_TO_BACKEND_DWP_DEV",
            "RUN_COMPLETE_TWELVE_CONDITION_MATRIX_ONCE",
        ],
        "broadRepositoryRerunRequired": False,
    }, "authority execution topology")
    checks.exact(authority["authority"], {
        "independentReviewComplete": True,
        "carrierCommitAndPushAuthorized": True,
        "timeTaskOwnerImplementationAuthorizedAfterMatchingCleanReceipt": True,
        "payrollTaskOwnerImplementationAuthorizedAfterMatchingCleanReceipt": True,
        "authIdentityTaskOwnerImplementationAuthorizedAfterMatchingCleanReceipt": True,
        "centralPeopleHandshakeTestAuthoringAuthorizedInAuthLaneOnlyAfterTimeAndPayrollIntegration": True,
        "otherPeopleSourceOrTestAuthoringAuthorized": False,
        "parallelAuthoringAuthorized": True,
        "timeV15MigrationAuthoringAuthorized": True,
        "payrollV56MigrationAuthoringAuthorized": True,
        "authV272MigrationAuthoringAuthorized": True,
        "hrm008CallbackProducerImplementationAuthorized": True,
        "directBackendDwpDevIntegrationAuthorized": False,
        "performanceConsumerImplementationAuthorized": False,
        "frontendUiMenuOrRouteAuthorized": False,
        "featureEnablementAuthorized": False,
        "tenantEnrollmentAuthorized": False,
        "runtimeCredentialProvisioningAuthorized": False,
        "liveNetworkHandshakeAuthorized": False,
        "productionBindingAuthorized": False,
        "productionReleaseAuthorized": False,
        "businessCompletionCredit": 0,
    }, "complete top-level authority boundary")
    checks.exact(authority["authority"]["businessCompletionCredit"], 0, "zero business completion")
    for denied in (
        "directBackendDwpDevIntegrationAuthorized",
        "frontendUiMenuOrRouteAuthorized",
        "featureEnablementAuthorized",
        "tenantEnrollmentAuthorized",
        "runtimeCredentialProvisioningAuthorized",
        "liveNetworkHandshakeAuthorized",
        "productionBindingAuthorized",
        "productionReleaseAuthorized",
    ):
        checks.exact(authority["authority"][denied], False, f"denied authority {denied}")
    checks.exact(review["authorityPath"], AUTHORITY, "review authority path")
    checks.exact(review["validatorPath"], VALIDATOR, "review validator path")
    checks.exact(review["state"], "INDEPENDENT_ZERO_FINDING_HASH_BOUND_PHASE6_AUTHORITY_REVIEW_COMPLETE", "review state")
    checks.exact(review["reviewedFacts"]["acceptanceMatrixCanonicalCompactJsonSha256"], ACCEPTANCE_SHA256, "reviewed acceptance digest")
    checks.exact(review["reviewedFacts"]["acceptanceDigestExcludesTrailingNewline"], True, "reviewed canonicalization rule")
    checks.exact(review["reviewedFacts"]["centralPeopleHandshakeTestAuthorizedOnlyByAuthTokenAfterTimeAndPayrollIntegration"], True, "reviewed People handshake exception")
    checks.exact(review["reviewedFacts"]["validatorSealsAllTokenReservationAndTopLevelAuthorityFields"], True, "reviewed validator closure")
    checks.exact(set(review["exactCarrierPaths"]), CARRIER_PATHS, "review carrier paths")
    checks.exact(review["findings"], {"p0": 0, "p1": 0, "p2": 0}, "review findings")
    checks.exact(review["decision"], "GO_FOR_EXACT_NINE_PATH_PHASE6_AUTHORITY_CARRIER_COMMIT_AND_PUSH_ONLY", "review decision")
    validate_pins(checks, authority)
    gate = validate_gate_projection(checks, authority)
    validate_migrations(checks)
    validate_tokens(checks, gate)


def main() -> int:
    checks = Checks()
    try:
        checks.exact(ROOT, Path(text(ROOT, "rev-parse", "--show-toplevel")), "frontend root")
        validate_repo_state(checks)
        validate_documents(checks)
    except (ValidationError, KeyError, json.JSONDecodeError, OSError, ValueError) as error:
        print(f"FAIL HRM-013 Phase-6 authority: {error}", file=sys.stderr)
        return 1
    print(f"PASS HRM-013 Phase-6 authority: checks={checks.count}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
