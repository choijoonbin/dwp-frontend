#!/usr/bin/env python3
"""Validate HRIS-HRM G1/G2 readiness without modifying central/G0 state."""

from __future__ import annotations

import ast
import csv
import hashlib
import json
import re
import subprocess
import sys
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
WORKSPACE = ROOT.parents[1]
HRM = ROOT / "session-evidence/hrm"
G2 = HRM / "g2-readiness"
COVERAGE_PATH = ROOT / "session-registers/hris-hrm-source-coverage.csv"
CHILD_PATH = HRM / "g1-child-trace.csv"
DECISION_PATH = HRM / "g1-decision-log.csv"
ACCESS_PATH = ROOT / "g0/source-security-evidence/coverage-sanitized-access-register.csv"
ROLE_PATH = ROOT / "g0/role-register.csv"
TARGET_WORKTREES = {
    "backend": (
        WORKSPACE / ".codex-worktrees/hris/g1-20260910/hrm/backend",
        "5670877de7a39e94e75021c7e23cbbb553296c90",
    ),
    "frontend": (
        WORKSPACE / ".codex-worktrees/hris/g1-20260910/hrm/frontend",
        "0692b1efee13c0be4efe813c8d41957a0dca76d6",
    ),
}

COVERAGE_HEADER = [
    "session_id", "source_module", "artifact_type", "artifact_id", "display_key",
    "source_file", "source_line", "legacy_contract", "legacy_component_or_table",
    "observed_metadata", "disposition", "target_capability_id",
    "target_bounded_context_candidate", "target_api_or_event", "target_data_owner",
    "process_change", "genericity", "acceptance_evidence", "decision_status",
    "decision_owner", "notes",
]
CHILD_HEADER = [
    "child_id", "parent_artifact_id", "session_id", "source_module",
    "child_type", "source_file", "source_line", "source_fingerprint",
    "actor", "trigger", "input_contract", "output_contract",
    "validation_rules", "state_transitions", "exceptions",
    "legacy_dependency", "target_capability_candidate",
    "target_api_event_candidate", "target_data_owner_candidate",
    "disposition", "decision_status", "decision_id", "owner_role",
    "evidence_refs", "notes",
]
DECISION_HEADER = [
    "decision_id", "session_id", "scope", "decision_type", "question",
    "options", "proposed_decision", "status", "owner_role",
    "consulted_role_ids", "due_at", "blocking_gate", "blocking_scope",
    "evidence_refs", "resolution", "decided_at", "notes",
]
AUTH_HEADER = [
    "policy_id", "persona_package", "atomic_duty", "required_app_entitlement",
    "capability", "resource_action", "population", "field_groups", "purpose",
    "field_mode", "step_up", "sod_rule", "owner_pep", "ui_surfaces",
    "negative_tests", "status",
]
ALLOWED_DISPOSITIONS = {"REUSE", "REBUILD", "CONFIGURE", "EXTENSION", "RETIRE"}
CHILD_TYPES = {
    "MENU_ELEMENT", "SERVICE_OPERATION", "JOB", "INTERFACE",
    "FORMULA_BEHAVIOR", "FILE_DOCUMENT", "SQL_BEHAVIOR", "STATE_TRANSITION",
}
EXPECTED_DISPOSITIONS = {
    "CONFIGURE": 87,
    "EXTENSION": 49,
    "REBUILD": 312,
    "RETIRE": 23,
    "REUSE": 112,
}
REQUIRED_G2_FILES = [
    "README.md",
    "adr-001-people-sor-effective-dating.md",
    "physical-schema-blueprint.sql",
    "api-event-contracts.v1.json",
    "state-guard-idempotency-recovery.md",
    "authorization-field-policy.csv",
    "synthetic-golden-fixtures.json",
    "synthetic-golden-spec.md",
    "build_hrm_g1_evidence.py",
    "validate_hrm_readiness.py",
]


class Validation:
    def __init__(self) -> None:
        self.checks = 0
        self.errors: list[str] = []

    def require(self, condition: bool, message: str) -> None:
        self.checks += 1
        if not condition:
            self.errors.append(message)

HRM_NEW_TENANT_TABLES = {
    "ppl_legal_entity_registrations", "ppl_business_units", "ppl_establishments",
    "ppl_employment_terms", "ppl_assignment_events", "ppl_sensitive_change_payloads",
    "ppl_assignment_event_items", "ppl_compensation_basis", "ppl_employment_contracts",
    "ppl_worker_restricted_tokens", "ppl_dependents", "ppl_educations", "ppl_careers",
    "ppl_qualifications", "ppl_service_records", "ppl_accessibility_records",
    "ppl_employee_change_requests", "ppl_employee_change_evidence",
    "ppl_certificate_requests", "ppl_issued_certificates", "ppl_separation_cases",
    "ppl_separation_tasks", "ppl_command_receipts", "ppl_domain_inbox_receipts",
}

HRM_EXISTING_CANONICAL_TENANT_TABLES = {
    "ppl_persons", "ppl_person_names", "ppl_contacts", "ppl_profile_media",
    "ppl_workers", "ppl_work_relationships", "ppl_assignments", "ppl_legal_employers",
    "ppl_organizations", "ppl_organization_relationships", "ppl_job_profiles",
    "ppl_job_grades", "ppl_positions", "ppl_locations", "int_source_systems",
    "int_external_mappings", "int_sync_runs", "int_sync_errors",
    "sys_people_audit_events", "sys_people_outbox_events",
}


def read_csv(path: Path, expected_header: list[str], validation: Validation) -> list[dict[str, str]]:
    validation.require(path.is_file(), f"missing file: {path}")
    if not path.is_file():
        return []
    with path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        validation.require(reader.fieldnames == expected_header, f"header mismatch: {path}")
        return list(reader)


def git_text(worktree: Path, *arguments: str) -> str:
    return subprocess.run(
        ["git", "-C", str(worktree), *arguments],
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()


def main() -> int:
    v = Validation()

    for name in REQUIRED_G2_FILES:
        v.require((G2 / name).is_file(), f"missing G2 artifact: {name}")
    v.require((HRM / "g1-characterization.md").is_file(), "missing characterization")

    for surface, (worktree, expected_head) in TARGET_WORKTREES.items():
        v.require(worktree.is_dir(), f"missing {surface} target worktree: {worktree}")
        if worktree.is_dir():
            try:
                observed_head = git_text(worktree, "rev-parse", "HEAD")
                dirty_paths = git_text(worktree, "status", "--porcelain=v1")
                v.require(observed_head == expected_head, f"{surface} worktree HEAD drift: {observed_head}")
                v.require(not dirty_paths, f"{surface} worktree is dirty")
            except subprocess.CalledProcessError as error:
                v.require(False, f"{surface} worktree Git inspection failed: {error}")

    with ROLE_PATH.open(newline="", encoding="utf-8") as role_handle:
        role_header = next(csv.reader(role_handle))
    roles = {
        row["role_id"] for row in read_csv(ROLE_PATH, role_header, v)
    }
    with ACCESS_PATH.open(newline="", encoding="utf-8") as access_handle:
        access_header = next(csv.reader(access_handle))
    access_rows = [
        row for row in read_csv(ACCESS_PATH, access_header, v)
        if row.get("session_id") == "HRIS-HRM"
    ]
    access_by_id = {row["artifact_id"]: row for row in access_rows}
    v.require(len(access_rows) == 583, f"expected 583 access rows, got {len(access_rows)}")

    coverage = read_csv(COVERAGE_PATH, COVERAGE_HEADER, v)
    v.require(len(coverage) == 583, f"expected 583 coverage rows, got {len(coverage)}")
    parent_ids = {row["artifact_id"] for row in coverage}
    v.require(len(parent_ids) == len(coverage), "duplicate coverage artifact_id")
    v.require(parent_ids == set(access_by_id), "coverage/access artifact set mismatch")
    required_coverage = [
        "disposition", "target_capability_id", "target_bounded_context_candidate",
        "target_api_or_event", "target_data_owner", "process_change", "genericity",
        "acceptance_evidence", "decision_status", "decision_owner", "notes",
    ]
    for line, row in enumerate(coverage, 2):
        v.require(row["session_id"] == "HRIS-HRM", f"coverage line {line}: wrong session")
        v.require(row["source_module"] == "hrm", f"coverage line {line}: wrong module")
        v.require(row["disposition"] in ALLOWED_DISPOSITIONS, f"coverage line {line}: bad disposition")
        v.require(row["decision_status"] == "DECIDED", f"coverage line {line}: not decided")
        v.require(row["decision_owner"] in roles, f"coverage line {line}: unknown decision owner")
        for column in required_coverage:
            v.require(bool(row[column].strip()), f"coverage line {line}: empty {column}")
        v.require("UNKNOWN" not in row["disposition"], f"coverage line {line}: UNKNOWN disposition")
        v.require("UNASSESSED" not in row["decision_status"], f"coverage line {line}: UNASSESSED")
        v.require("decision_id=HRM-DEC-" in row["notes"], f"coverage line {line}: no decision pointer")
    v.require(dict(Counter(row["disposition"] for row in coverage)) == EXPECTED_DISPOSITIONS,
              f"disposition drift: {Counter(row['disposition'] for row in coverage)}")

    bensk = [row for row in coverage if "BENSK" in row["genericity"] or row["target_capability_id"] == "OUT_OF_SCOPE.BENSK"]
    v.require(len(bensk) == 2, f"expected exactly 2 BENSK rows, got {len(bensk)}")
    for row in bensk:
        v.require(row["disposition"] == "RETIRE", f"BENSK not retired: {row['artifact_id']}")
        v.require(row["target_api_or_event"] == "NONE", f"BENSK has target API: {row['artifact_id']}")
        v.require(row["target_data_owner"] == "NONE", f"BENSK has data owner: {row['artifact_id']}")
    blocked = [row for row in access_rows if row["sanitized_access_status"] == "SECURITY_BLOCKED_UNKNOWN"]
    v.require(len(blocked) == 2, f"expected 2 security-blocked rows, got {len(blocked)}")
    coverage_by_id = {row["artifact_id"]: row for row in coverage}
    for row in blocked:
        decided = coverage_by_id[row["artifact_id"]]
        v.require("SAFE_SUBSTITUTE_ONLY" in decided["notes"], f"blocked artifact lacks safe substitute: {row['artifact_id']}")
        v.require(decided["disposition"] == "CONFIGURE", f"blocked artifact not CONFIGURE: {row['artifact_id']}")

    decisions = read_csv(DECISION_PATH, DECISION_HEADER, v)
    decision_by_id = {row["decision_id"]: row for row in decisions}
    v.require(len(decisions) == 15, f"expected 15 decisions, got {len(decisions)}")
    v.require(len(decision_by_id) == len(decisions), "duplicate decision_id")
    required_decision = [
        "decision_id", "session_id", "scope", "decision_type", "question", "options",
        "proposed_decision", "status", "owner_role", "consulted_role_ids", "blocking_gate",
        "blocking_scope", "evidence_refs", "resolution", "decided_at", "notes",
    ]
    for line, row in enumerate(decisions, 2):
        for column in required_decision:
            v.require(bool(row[column].strip()), f"decision line {line}: empty {column}")
        v.require(row["session_id"] == "HRIS-HRM", f"decision line {line}: wrong session")
        v.require(row["status"] == "DECIDED", f"decision line {line}: not DECIDED")
        v.require(row["owner_role"] in roles, f"decision line {line}: unknown owner role")
        v.require(row["blocking_gate"] == "G2", f"decision line {line}: wrong blocking gate")
        for role in row["consulted_role_ids"].split("|"):
            v.require(role in roles, f"decision line {line}: unknown consulted role {role}")
        try:
            parsed = row["decided_at"].replace("Z", "+00:00")
            __import__("datetime").datetime.fromisoformat(parsed)
        except ValueError:
            v.require(False, f"decision line {line}: invalid decided_at")

    for line, row in enumerate(coverage, 2):
        decision_match = re.search(r"decision_id=(HRM-DEC-\d{3})", row["notes"])
        v.require(bool(decision_match), f"coverage line {line}: invalid decision pointer")
        if decision_match:
            v.require(decision_match.group(1) in decision_by_id, f"coverage line {line}: missing decision")

    children = read_csv(CHILD_PATH, CHILD_HEADER, v)
    child_ids = {row["child_id"] for row in children}
    v.require(len(children) == 1654, f"expected 1654 child traces, got {len(children)}")
    v.require(len(child_ids) == len(children), "duplicate child_id")
    child_parent_counts: Counter[str] = Counter()
    child_type_counts: Counter[str] = Counter()
    expected_fingerprint: dict[str, str] = {}
    for artifact_id, access in access_by_id.items():
        path_text = access.get("sanitized_export_path", "")
        path = Path(path_text) if path_text else None
        expected_fingerprint[artifact_id] = (
            hashlib.sha256(path.read_bytes()).hexdigest()
            if path and path.is_file() else access["mapping_fingerprint"]
        )
    required_child = [column for column in CHILD_HEADER if column != "source_line"]
    for line, row in enumerate(children, 2):
        for column in required_child:
            v.require(bool(row[column].strip()), f"child line {line}: empty {column}")
        v.require(row["parent_artifact_id"] in parent_ids, f"child line {line}: orphan parent")
        v.require(row["session_id"] == "HRIS-HRM", f"child line {line}: wrong session")
        v.require(row["source_module"] == "hrm", f"child line {line}: wrong module")
        v.require(row["child_type"] in CHILD_TYPES, f"child line {line}: bad child type")
        v.require(row["disposition"] in ALLOWED_DISPOSITIONS, f"child line {line}: bad disposition")
        v.require(row["decision_status"] == "DECIDED", f"child line {line}: not decided")
        v.require(row["decision_id"] in decision_by_id, f"child line {line}: missing decision")
        v.require(row["owner_role"] in roles, f"child line {line}: bad owner role")
        v.require(re.fullmatch(r"[0-9a-f]{64}", row["source_fingerprint"]) is not None,
                  f"child line {line}: bad fingerprint")
        if row["parent_artifact_id"] in expected_fingerprint:
            v.require(row["source_fingerprint"] == expected_fingerprint[row["parent_artifact_id"]],
                      f"child line {line}: fingerprint does not match sanitized evidence")
        v.require(not row["source_file"].startswith("/"), f"child line {line}: absolute source path")
        v.require(".codex-worktrees/hris/source/" not in row["source_file"], f"child line {line}: raw source pointer")
        if row["source_line"]:
            v.require(row["source_line"].isdigit() and int(row["source_line"]) > 0,
                      f"child line {line}: invalid source_line")
        child_parent_counts[row["parent_artifact_id"]] += 1
        child_type_counts[row["child_type"]] += 1
    v.require(set(child_parent_counts) == parent_ids, "not every parent has a child trace")
    v.require(set(child_type_counts) == CHILD_TYPES, f"missing child types: {CHILD_TYPES - set(child_type_counts)}")
    v.require(child_type_counts["SERVICE_OPERATION"] >= 900, "service method trace unexpectedly low")
    v.require(child_type_counts["SQL_BEHAVIOR"] == 144, "entity/SQL behavior coverage mismatch")
    v.require(child_type_counts["MENU_ELEMENT"] == 193, "route/menu behavior coverage mismatch")

    characterization = (HRM / "g1-characterization.md").read_text(encoding="utf-8")
    for heading in (
        "## 1. Provenance and scope", "## 2. Coverage summary",
        "## 3. Actors and authorization", "## 4. Journeys and commands",
        "## 5. Validation, state, and exceptions", "## 6. Data ownership and retention",
        "## 7. Batch, interface, and document behavior", "## 8. Redundancy and process improvements",
        "## 9. Generic core, country pack, and tenant extension", "## 10. Target contract proposals",
        "## 11. Unknowns and decisions", "## 12. Synthetic characterization tests",
    ):
        v.require(heading in characterization, f"missing characterization heading: {heading}")
    v.require("1,654" in characterization, "characterization child count drift")
    v.require("`UNKNOWN` parents | 0" in characterization, "characterization unknown count drift")

    contract = json.loads((G2 / "api-event-contracts.v1.json").read_text(encoding="utf-8"))
    v.require(contract["contractId"] == "dwp.hris.hrm.v1", "wrong contract id")
    operations = contract["endpoints"]
    operation_ids = [row["operationId"] for row in operations]
    v.require(len(operation_ids) == len(set(operation_ids)), "duplicate API operationId")
    for operation in operations:
        for key in ("operationId", "method", "path", "capability", "response", "rules"):
            v.require(key in operation and bool(operation[key]), f"API operation missing {key}")
        v.require(operation["path"].startswith("/"), f"API path invalid: {operation['path']}")
    event_types = [event["eventType"] for event in contract["events"]]
    v.require(len(event_types) == len(set(event_types)), "duplicate event type")
    for required_event in (
        "PersonChanged.v1", "WorkerHired.v1", "EmploymentChanged.v1",
        "AssignmentChanged.v1", "OrganizationChanged.v1",
        "CompensationBasisChanged.v1", "WorkerSeparated.v1",
        "WorkforceIngestionReconciled.v1", "WorkforceWidgetSnapshot.v1",
    ):
        v.require(required_event in event_types, f"missing required event: {required_event}")
    target_bindings = contract["coverageTargetBindings"]
    bound_targets = [row["coverageTarget"] for row in target_bindings]
    v.require(len(bound_targets) == len(set(bound_targets)), "duplicate coverage target binding")
    v.require(
        set(bound_targets) == {row["target_api_or_event"] for row in coverage},
        "API/event contract does not bind every coverage target exactly once",
    )
    for binding in target_bindings:
        v.require(binding["bindingKind"] in {"LOCAL_HRM", "SHARED_PLATFORM", "RETIRED_OR_EXCLUDED"},
                  f"invalid target binding kind: {binding['coverageTarget']}")
        v.require(bool(binding["owner"]), f"target binding has no owner: {binding['coverageTarget']}")
        if binding["bindingKind"] == "LOCAL_HRM":
            for operation_id in binding["operations"]:
                v.require(operation_id in operation_ids, f"target binding references missing operation: {operation_id}")
            for event_type in binding["events"]:
                v.require(event_type in event_types, f"target binding references missing event: {event_type}")
        else:
            v.require(bool(binding.get("contractRef")), f"delegated/retired binding lacks contractRef: {binding['coverageTarget']}")
    forbidden_event_fields = set(contract["eventEnvelope"]["forbidden"])
    v.require("internalDatabaseId" in forbidden_event_fields, "internal DB IDs not forbidden in events")
    v.require("clearPersonalIdentifier" in forbidden_event_fields, "clear identifier not forbidden")

    fixtures = json.loads((G2 / "synthetic-golden-fixtures.json").read_text(encoding="utf-8"))
    v.require(fixtures["dataClassification"] == "SYNTHETIC_NO_CUSTOMER_DATA", "fixture is not synthetic")
    v.require(fixtures["effectivePeriodConvention"] == "[from,to)", "wrong fixture interval convention")
    tenant_keys = {row["tenantKey"] for row in fixtures["tenants"]}
    v.require(tenant_keys == {"SYNTH-A", "SYNTH-B"}, "fixture tenant set drift")
    legal_employer_ids = {(row["tenantKey"], row["publicId"]) for row in fixtures["legalEmployers"]}
    organization_ids = {(row["tenantKey"], row["publicId"]) for row in fixtures["organizations"]}
    person_ids = {(row["tenantKey"], row["personPublicId"]) for row in fixtures["people"]}
    worker_ids = {(row["tenantKey"], row["workerPublicId"]) for row in fixtures["workers"]}
    relationship_ids = {(row["tenantKey"], row["relationshipPublicId"]) for row in fixtures["relationships"]}
    for worker in fixtures["workers"]:
        v.require(
            (worker["tenantKey"], worker["personPublicId"]) in person_ids,
            f"fixture worker has missing person: {worker['workerPublicId']}",
        )
    for relationship in fixtures["relationships"]:
        v.require(
            (relationship["tenantKey"], relationship["workerPublicId"]) in worker_ids,
            f"fixture relationship has missing worker: {relationship['relationshipPublicId']}",
        )
        v.require(
            (relationship["tenantKey"], relationship["legalEntityPublicId"]) in legal_employer_ids,
            f"fixture relationship has missing legal employer: {relationship['relationshipPublicId']}",
        )
    for assignment in fixtures["assignments"]:
        v.require(
            (assignment["tenantKey"], assignment["relationshipPublicId"]) in relationship_ids,
            f"fixture assignment has missing relationship: {assignment['assignmentPublicId']}",
        )
        v.require(
            (assignment["tenantKey"], assignment["organizationPublicId"]) in organization_ids,
            f"fixture assignment has missing organization: {assignment['assignmentPublicId']}",
        )
    case_ids = [row["caseId"] for row in fixtures["cases"]]
    v.require(case_ids == [f"HRM-GOLD-{number:03d}" for number in range(1, 16)], "golden cases missing or unordered")
    for case in fixtures["cases"]:
        v.require(bool(case.get("inputs")), f"{case['caseId']}: missing inputs")
        v.require(bool(case.get("expected")), f"{case['caseId']}: missing expected oracle")
    fixture_text = json.dumps(fixtures, sort_keys=True).lower()
    for forbidden in ("password", "access_token", "secret_key", "@sk.com", "@kolon"):
        v.require(forbidden not in fixture_text, f"fixture contains forbidden marker: {forbidden}")

    primary_by_relationship: defaultdict[tuple[str, str], list[tuple[date, date | None]]] = defaultdict(list)
    for assignment in fixtures["assignments"]:
        if assignment["primary"]:
            start = date.fromisoformat(assignment["validFrom"])
            end = date.fromisoformat(assignment["validTo"]) if assignment["validTo"] else None
            primary_by_relationship[(assignment["tenantKey"], assignment["relationshipPublicId"])].append((start, end))
    for key, periods in primary_by_relationship.items():
        periods.sort()
        for previous, current in zip(periods, periods[1:]):
            v.require(previous[1] is not None and previous[1] <= current[0], f"fixture primary overlap: {key}")

    auth_rows = read_csv(G2 / "authorization-field-policy.csv", AUTH_HEADER, v)
    v.require(len(auth_rows) == 24, f"expected 24 auth policies, got {len(auth_rows)}")
    auth_ids = {row["policy_id"] for row in auth_rows}
    v.require(len(auth_ids) == len(auth_rows), "duplicate auth policy id")
    packages = {row["persona_package"] for row in auth_rows}
    for required_package in (
        "HRIS_EMPLOYEE", "HRIS_LINE_MANAGER", "HRIS_HR_BUSINESS_PARTNER",
        "HRIS_HR_LIFECYCLE_APPROVER", "HRIS_CONFIG_AUTHOR",
        "HRIS_CONFIG_PUBLISHER", "HRIS_INTEGRATION_AUTHOR",
        "HRIS_INTEGRATION_EXECUTOR", "HRIS_ENTERPRISE_AUDITOR",
    ):
        v.require(required_package in packages, f"missing auth package: {required_package}")
    for line, row in enumerate(auth_rows, 2):
        for column in AUTH_HEADER:
            v.require(bool(row[column].strip()), f"auth line {line}: empty {column}")
        v.require("APP.HCM:VIEW" in row["required_app_entitlement"], f"auth line {line}: no parent entitlement")
        v.require(row["status"] == "TARGET_DECIDED", f"auth line {line}: wrong status")
        v.require("denied" in row["negative_tests"] or "rejected" in row["negative_tests"] or "absent" in row["negative_tests"],
                  f"auth line {line}: no negative test")

    ddl = (G2 / "physical-schema-blueprint.sql").read_text(encoding="utf-8")
    v.require("NOT A FLYWAY MIGRATION" in ddl, "DDL lacks non-executable blueprint warning")
    for table in (
        "ppl_legal_entity_registrations", "ppl_business_units", "ppl_establishments",
        "ppl_employment_terms", "ppl_assignment_events", "ppl_assignment_event_items",
        "ppl_compensation_basis", "ppl_employment_contracts", "ppl_worker_bank_accounts",
        "ppl_dependents", "ppl_educations", "ppl_careers", "ppl_qualifications",
        "ppl_service_records", "ppl_accessibility_records",
        "ppl_employee_change_requests", "ppl_employee_change_evidence",
        "ppl_certificate_requests", "ppl_issued_certificates",
        "ppl_separation_cases", "ppl_separation_tasks", "ppl_command_receipts",
        "ppl_domain_inbox_receipts",
    ):
        v.require(f"CREATE TABLE {table}" in ddl, f"DDL missing table {table}")
    v.require(ddl.count("EXCLUDE USING gist") >= 6, "DDL lacks effective overlap constraints")
    v.require("ppl_guard_terminal_row" in ddl, "DDL lacks immutable terminal guard")
    v.require(re.search(r"\b(DROP|TRUNCATE)\b", ddl, re.IGNORECASE) is None, "DDL contains destructive operation")

    for python_file in (G2 / "build_hrm_g1_evidence.py", G2 / "validate_hrm_readiness.py"):
        try:
            ast.parse(python_file.read_text(encoding="utf-8"), filename=str(python_file))
            v.require(True, f"python syntax: {python_file.name}")
        except SyntaxError as error:
            v.require(False, f"python syntax error {python_file.name}: {error}")

    secret_pattern = re.compile(r"(?i)(password\s*[=:]|access[_-]?token\s*[=:]|secret[_-]?key\s*[=:]|BEGIN [A-Z ]*PRIVATE KEY)")
    for path in [HRM / "g1-characterization.md", CHILD_PATH, DECISION_PATH] + [G2 / name for name in REQUIRED_G2_FILES]:
        text = path.read_text(encoding="utf-8")
        v.require(secret_pattern.search(text) is None, f"credential-like value in {path.name}")

    if v.errors:
        for error in v.errors:
            print(f"ERROR: {error}")
        print(f"HRM_READINESS=FAIL checks={v.checks} errors={len(v.errors)}")
        return 1

    print(
        "HRM_READINESS=PASS "
        f"checks={v.checks} parents={len(coverage)} children={len(children)} "
        f"decisions={len(decisions)} auth_policies={len(auth_rows)} golden_cases={len(case_ids)} "
        "unknown=0 unassessed=0 bensk_retired=2 "
        "module_contract=READY_FOR_G2_REVIEW code_gate=BLOCKED_EXTERNAL_CHECKPOINT_AND_NAMED_APPROVAL"
    )
    print("child_types=" + ",".join(f"{key}:{value}" for key, value in sorted(child_type_counts.items())))
    return 0


if __name__ == "__main__":
    sys.exit(main())
