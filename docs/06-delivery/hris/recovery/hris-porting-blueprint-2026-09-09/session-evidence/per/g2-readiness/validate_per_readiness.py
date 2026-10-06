#!/usr/bin/env python3
"""Validate PER G1 traceability and G2 coding-readiness contracts.

Uses only the Python standard library so the gate is reproducible on a clean host.
It validates evidence structure and synthetic oracle consistency; it does not grant
G2-CODE-GO or substitute for named human review.
"""

from __future__ import annotations

import csv
import json
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
PER = ROOT / "session-evidence/per"
G2 = PER / "g2-readiness"
COVERAGE = ROOT / "session-registers/hris-per-source-coverage.csv"
CHILD = PER / "g1-child-trace.csv"
DECISIONS = PER / "g1-decision-log.csv"
CHARACTERIZATION = PER / "g1-characterization.md"
ACCESS = ROOT / "g0/source-security-evidence/coverage-sanitized-access-register.csv"
DDL = G2 / "physical-schema.sql"
API = G2 / "api-event-contracts.yaml"
ADR = G2 / "ADR-001-performance-boundary.md"
STATE = G2 / "state-guard-idempotency-recovery.md"
AUTHZ = G2 / "authorization-field-policy.md"
FIXTURE = G2 / "golden/performance-golden-fixtures.json"
GOLDEN_SPEC = G2 / "golden/golden-spec.md"
README = G2 / "README.md"
SLICES = G2 / "g2-code-go-slices.csv"

OWNER = "dwp-people-server/hris/performance"
checks = 0


def require(condition: bool, message: str) -> None:
    global checks
    checks += 1
    if not condition:
        raise AssertionError(message)


def read_csv(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        return list(reader.fieldnames or []), list(reader)


def validate_files() -> None:
    for path in [
        COVERAGE, CHILD, DECISIONS, CHARACTERIZATION, DDL, API, ADR, STATE,
        AUTHZ, FIXTURE, GOLDEN_SPEC, README, SLICES, G2 / "build_g1_evidence.py",
    ]:
        require(path.is_file() and path.stat().st_size > 0, f"missing/empty file: {path}")


def validate_coverage() -> tuple[list[dict[str, str]], set[str]]:
    header, rows = read_csv(COVERAGE)
    expected_header = [
        "session_id", "source_module", "artifact_type", "artifact_id", "display_key",
        "source_file", "source_line", "legacy_contract", "legacy_component_or_table",
        "observed_metadata", "disposition", "target_capability_id",
        "target_bounded_context_candidate", "target_api_or_event", "target_data_owner",
        "process_change", "genericity", "acceptance_evidence", "decision_status",
        "decision_owner", "notes",
    ]
    require(header == expected_header, "PER coverage header drift")
    require(len(rows) == 349, f"PER coverage count must be 349, got {len(rows)}")
    ids = [row["artifact_id"] for row in rows]
    require(len(ids) == len(set(ids)), "duplicate PER parent artifact_id")
    required = [
        "session_id", "source_module", "artifact_type", "artifact_id", "source_file",
        "disposition", "target_capability_id", "target_bounded_context_candidate",
        "target_api_or_event", "target_data_owner", "process_change", "genericity",
        "acceptance_evidence", "decision_status", "decision_owner", "notes",
    ]
    allowed_dispositions = {"REUSE", "REBUILD", "CONFIGURE", "EXTENSION", "RETIRE"}
    for row in rows:
        for field in required:
            require(bool(row[field].strip()), f"blank coverage {field}: {row['artifact_id']}")
        require(row["session_id"] == "HRIS-PER", "wrong coverage session")
        require(row["source_module"] == "per", "wrong coverage module")
        require(row["disposition"] in allowed_dispositions, f"invalid disposition: {row['artifact_id']}")
        require(row["decision_status"] == "DECIDED", f"undecided coverage row: {row['artifact_id']}")
        require("UNKNOWN" not in row["disposition"] and "UNASSESSED" not in row["decision_status"], "unknown coverage row")
        if row["target_bounded_context_candidate"] == "PERFORMANCE":
            require(row["target_data_owner"] == OWNER, f"PER owner drift: {row['artifact_id']}")
        marker_text = (row["source_file"] + row["display_key"]).upper()
        require("BENSK" not in marker_text and "ADDSK" not in marker_text, f"customer artifact entered PER shard: {row['artifact_id']}")
    counts = Counter(row["disposition"] for row in rows)
    require(counts == Counter({"REBUILD": 305, "CONFIGURE": 17, "REUSE": 12, "RETIRE": 9, "EXTENSION": 6}), f"disposition drift: {counts}")
    return rows, set(ids)


def validate_children(parents: list[dict[str, str]], parent_ids: set[str]) -> tuple[list[dict[str, str]], set[str]]:
    header, rows = read_csv(CHILD)
    expected_header = [
        "child_id", "parent_artifact_id", "session_id", "source_module", "child_type",
        "source_file", "source_line", "source_fingerprint", "actor", "trigger",
        "input_contract", "output_contract", "validation_rules", "state_transitions",
        "exceptions", "legacy_dependency", "target_capability_candidate",
        "target_api_event_candidate", "target_data_owner_candidate", "disposition",
        "decision_status", "decision_id", "owner_role", "evidence_refs", "notes",
    ]
    require(header == expected_header, "PER child trace header drift")
    require(len(rows) == 1041, f"PER child count must be 1041, got {len(rows)}")
    child_ids = [row["child_id"] for row in rows]
    require(len(child_ids) == len(set(child_ids)), "duplicate PER child_id")
    required = [
        "child_id", "parent_artifact_id", "session_id", "source_module", "child_type",
        "source_file", "source_fingerprint", "actor", "trigger", "input_contract",
        "output_contract", "validation_rules", "state_transitions", "exceptions",
        "target_capability_candidate", "target_api_event_candidate",
        "target_data_owner_candidate", "disposition", "decision_status", "decision_id",
        "owner_role", "evidence_refs", "notes",
    ]
    allowed_types = {
        "MENU_ELEMENT", "SERVICE_OPERATION", "JOB", "INTERFACE", "FORMULA_BEHAVIOR",
        "FILE_DOCUMENT", "SQL_BEHAVIOR", "STATE_TRANSITION",
    }
    seen_types = set()
    by_parent_type: dict[tuple[str, str], int] = defaultdict(int)
    for row in rows:
        for field in required:
            require(bool(row[field].strip()), f"blank child {field}: {row['child_id']}")
        require(row["parent_artifact_id"] in parent_ids, f"orphan child: {row['child_id']}")
        require(row["session_id"] == "HRIS-PER" and row["source_module"] == "per", f"wrong child ownership: {row['child_id']}")
        require(row["child_type"] in allowed_types, f"invalid child type: {row['child_id']}")
        require(bool(re.fullmatch(r"[0-9a-f]{64}", row["source_fingerprint"])), f"invalid fingerprint: {row['child_id']}")
        require(row["decision_status"] == "DECIDED", f"undecided child: {row['child_id']}")
        require("UNKNOWN" not in row["disposition"], f"unknown child disposition: {row['child_id']}")
        require(not row["source_file"].startswith("/"), f"absolute/raw source path in child: {row['child_id']}")
        seen_types.add(row["child_type"])
        by_parent_type[(row["parent_artifact_id"], row["child_type"])] += 1
    require(seen_types == allowed_types, f"missing child behavior classes: {allowed_types - seen_types}")
    require({row["parent_artifact_id"] for row in rows} == parent_ids, "not every parent has child evidence")
    for parent in parents:
        if parent["artifact_type"] == "ROUTE":
            require(by_parent_type[(parent["artifact_id"], "MENU_ELEMENT")] >= 1, f"route without menu trace: {parent['artifact_id']}")
        if parent["artifact_type"] == "ENTITY":
            require(by_parent_type[(parent["artifact_id"], "SQL_BEHAVIOR")] >= 1, f"entity without SQL trace: {parent['artifact_id']}")
        if parent["artifact_type"] == "CONTROLLER":
            match = re.search(r"method_mapping_count=(\d+)", parent["observed_metadata"])
            declared = int(match.group(1)) if match else 0
            require(by_parent_type[(parent["artifact_id"], "SERVICE_OPERATION")] >= max(1, declared), f"controller method trace shortfall: {parent['artifact_id']}")
    return rows, {row["decision_id"] for row in rows}


def validate_decisions(coverage_rows: list[dict[str, str]], child_decisions: set[str]) -> None:
    header, rows = read_csv(DECISIONS)
    expected_header = [
        "decision_id", "session_id", "scope", "decision_type", "question", "options",
        "proposed_decision", "status", "owner_role", "consulted_role_ids", "due_at",
        "blocking_gate", "blocking_scope", "evidence_refs", "resolution", "decided_at", "notes",
    ]
    require(header == expected_header, "PER decision log header drift")
    require(len(rows) == 16, f"expected 16 PER decisions, got {len(rows)}")
    ids = [row["decision_id"] for row in rows]
    require(len(ids) == len(set(ids)), "duplicate PER decision_id")
    required = [
        "decision_id", "session_id", "scope", "decision_type", "question", "options",
        "proposed_decision", "status", "owner_role", "blocking_gate", "blocking_scope",
        "evidence_refs", "resolution", "decided_at", "notes",
    ]
    for row in rows:
        for field in required:
            require(bool(row[field].strip()), f"blank decision {field}: {row['decision_id']}")
        require(row["session_id"] == "HRIS-PER", f"wrong decision session: {row['decision_id']}")
        require(row["status"] == "DECIDED", f"open decision remains: {row['decision_id']}")
        datetime.fromisoformat(row["decided_at"])
    decision_ids = set(ids)
    require(child_decisions <= decision_ids, f"child points to missing decision: {child_decisions - decision_ids}")
    for row in coverage_rows:
        require(any(decision_id in row["notes"] for decision_id in decision_ids), f"coverage missing decision pointer: {row['artifact_id']}")


def validate_security_blocked(coverage_rows: list[dict[str, str]], children: list[dict[str, str]]) -> None:
    _, access_rows = read_csv(ACCESS)
    blocked = {
        row["artifact_id"]
        for row in access_rows
        if row["session_id"] == "HRIS-PER" and row["sanitized_access_status"] == "SECURITY_BLOCKED_UNKNOWN"
    }
    require(len(blocked) == 2, f"expected two governed blocked PER parents, got {len(blocked)}")
    coverage_by_id = {row["artifact_id"]: row for row in coverage_rows}
    for artifact_id in blocked:
        row = coverage_by_id[artifact_id]
        require(row["disposition"] == "REUSE", f"blocked template must use safe platform contract: {artifact_id}")
        require("security-blocked source not reconstructed" in row["notes"], f"blocked source reconstruction boundary missing: {artifact_id}")
        matching = [child for child in children if child["parent_artifact_id"] == artifact_id]
        require(bool(matching), f"blocked source has no safe substitute trace: {artifact_id}")
        require(all("source was not reconstructed" in child["notes"] for child in matching), f"blocked source child overclaims characterization: {artifact_id}")


def validate_characterization() -> None:
    text = CHARACTERIZATION.read_text(encoding="utf-8")
    headings = [
        "Provenance and scope", "Coverage summary", "Actors and authorization",
        "Journeys and commands", "Validation, state, and exceptions",
        "Data ownership and retention", "Batch, interface, and document behavior",
        "Redundancy and process improvements", "Generic core, country pack, and tenant extension",
        "Target contract proposals", "Unknowns and decisions", "Synthetic characterization tests",
    ]
    for heading in headings:
        require(f"## {heading}" in text, f"missing characterization heading: {heading}")
    for token in ["349", "UNKNOWN=0", "UNASSESSED=0", "1,041", OWNER, "0692b1efee13c0be4efe813c8d41957a0dca76d6"]:
        require(token in text, f"characterization missing baseline/count token: {token}")


def validate_ddl() -> None:
    text = DDL.read_text(encoding="utf-8")
    expected_tables = {
        "prf_cycles", "prf_cycle_versions", "prf_cycle_stages", "prf_templates",
        "prf_template_versions", "prf_template_items", "prf_rubric_levels",
        "prf_population_rules", "prf_population_freezes", "prf_participants",
        "prf_reviewer_assignments", "prf_goals", "prf_goal_revisions",
        "prf_goal_alignments", "prf_reviews", "prf_review_submissions",
        "prf_review_answers", "prf_feedback_requests", "prf_feedback_assignments",
        "prf_feedback_responses", "prf_checkins", "prf_calibration_sessions",
        "prf_calibration_adjustments", "prf_result_sets", "prf_results",
        "prf_result_publications", "prf_appeals", "prf_appeal_events",
        "prf_evidence_refs", "prf_command_receipts", "prf_inbox_receipts",
        "prf_outbox_events", "prf_import_runs", "prf_import_row_issues",
    }
    found = set(re.findall(r"CREATE TABLE\s+(prf_[a-z0-9_]+)\s*\(", text, re.I))
    require(found == expected_tables, f"DDL table set drift missing={expected_tables-found} extra={found-expected_tables}")
    for table in expected_tables:
        start = text.index(f"CREATE TABLE {table} (")
        end = text.index("\n);", start)
        block = text[start:end]
        require("tenant_id BIGINT NOT NULL" in block, f"tenant missing: {table}")
        require(f"uk_{table}_tenant_id UNIQUE (tenant_id" in block, f"composite tenant identity missing: {table}")
    require("REFERENCES ppl_" not in text and "REFERENCES auth_" not in text, "cross-context physical FK detected")
    require("ENABLE ROW LEVEL SECURITY" in text and "app.tenant_id" in text, "RLS blueprint missing")
    require("prf_command_receipts" in text and "prf_inbox_receipts" in text and "prf_outbox_events" in text, "reliability tables missing")


def validate_api_contract() -> None:
    text = API.read_text(encoding="utf-8")
    for token in [
        "openapi: 3.1.0", "/dashboard:", "/cycles/{cycleId}/population-freezes:",
        "/reviews/{reviewId}/submit:", "/calibration-sessions/{sessionId}/adjustments:",
        "/result-sets/{resultSetId}/publish:", "/command-receipts/{receiptId}:",
        "Idempotency-Key", "If-Match", "application/problem+json", "x-dwp-domain-events",
        "PerformanceCyclePublished.v1", "PerformancePopulationFrozen.v1",
        "PerformanceReviewSubmitted.v1", "PerformanceResultsPublished.v1",
        "WorkerAssignmentChanged.v1",
    ]:
        require(token in text, f"API/event contract missing: {token}")
    for path_name, parameter_name in [
        ("cycleId", "CycleId"), ("goalId", "GoalId"), ("reviewId", "ReviewId"),
        ("sessionId", "SessionId"), ("resultSetId", "ResultSetId"),
        ("resultId", "ResultId"), ("receiptId", "ReceiptId"),
    ]:
        require(f"{parameter_name}:\n      name: {path_name}" in text, f"path parameter mismatch: {path_name}")
    require("tenantId" not in text[text.index("CreateCycleCommand:"):text.index("x-dwp-event-envelope:")], "client-writable tenantId found in command schemas")


def decimal6(value: Decimal) -> str:
    return str(value.quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP))


def validate_fixture() -> None:
    data = json.loads(FIXTURE.read_text(encoding="utf-8"))
    require(data["schemaVersion"] == "per-golden.v1", "fixture schema version drift")
    require(data["syntheticOnly"] is True, "fixture must be synthetic only")
    cases = data["cases"]
    ids = [case["caseId"] for case in cases]
    require(len(ids) == len(set(ids)) and len(ids) >= 16, "fixture IDs duplicate or coverage too small")
    by_id = {case["caseId"]: case for case in cases}

    valid_weight = by_id["PER-GOLDEN-WEIGHT-001"]
    weights = [Decimal(item["weight"]) for item in valid_weight["input"]["items"]]
    scores = [Decimal(item["score"]) for item in valid_weight["input"]["items"]]
    intermediate = [decimal6(weight * score) for weight, score in zip(weights, scores)]
    require(decimal6(sum(weights)) == valid_weight["expected"]["weightTotal"], "valid fixture weight total mismatch")
    require(intermediate == valid_weight["expected"]["intermediate"], "valid fixture intermediate mismatch")
    require(decimal6(sum(weight * score for weight, score in zip(weights, scores))) == valid_weight["expected"]["overallScore"], "valid fixture overall mismatch")

    invalid_weight = by_id["PER-GOLDEN-WEIGHT-002"]
    invalid_total = sum(Decimal(item["weight"]) for item in invalid_weight["input"]["items"])
    require(decimal6(invalid_total) == invalid_weight["expected"]["weightTotal"] != data["policy"]["weightTotal"], "invalid fixture weight total mismatch")

    workers = data["workers"]
    pop = by_id["PER-GOLDEN-POPULATION-001"]
    allowed_orgs = set(pop["input"]["organizationPublicIds"])
    actual_workers = sorted(worker["workerPublicId"] for worker in workers if worker["active"] and worker["organizationPublicId"] in allowed_orgs)
    require(actual_workers == sorted(pop["expected"]["participantWorkerPublicIds"]), "population oracle mismatch")
    require(len(actual_workers) == pop["expected"]["participantCount"], "population count mismatch")

    for case_id in ["PER-GOLDEN-CYCLE-001", "PER-GOLDEN-CYCLE-002"]:
        case = by_id[case_id]
        stages = sorted(case["input"]["stages"], key=lambda stage: stage["sequenceNo"])
        overlap = any(
            datetime.fromisoformat(stages[index]["opensAt"]) < datetime.fromisoformat(stages[index - 1]["closesAt"])
            for index in range(1, len(stages))
        )
        require(case["expected"]["valid"] is (not overlap), f"cycle overlap oracle mismatch: {case_id}")

    feedback_low = by_id["PER-GOLDEN-FEEDBACK-001"]
    feedback_exact = by_id["PER-GOLDEN-FEEDBACK-002"]
    require(feedback_low["expected"]["released"] is (feedback_low["input"]["submittedCount"] >= feedback_low["input"]["minimumReleaseCount"]), "feedback low threshold mismatch")
    require(feedback_exact["expected"]["released"] is (feedback_exact["input"]["submittedCount"] >= feedback_exact["input"]["minimumReleaseCount"]), "feedback exact threshold mismatch")

    idem_same = by_id["PER-GOLDEN-IDEMPOTENCY-001"]
    idem_diff = by_id["PER-GOLDEN-IDEMPOTENCY-002"]
    require((idem_same["input"]["firstRequestHash"] == idem_same["input"]["secondRequestHash"]) and idem_same["expected"]["sameReceipt"], "same idempotency oracle mismatch")
    require((idem_diff["input"]["firstRequestHash"] != idem_diff["input"]["secondRequestHash"]) and idem_diff["expected"]["status"] == 409, "mismatched idempotency oracle mismatch")

    imp = by_id["PER-GOLDEN-IMPORT-001"]
    require(imp["input"]["validCount"] + imp["input"]["invalidCount"] == imp["input"]["totalCount"], "import input reconciliation mismatch")
    require(imp["expected"]["acceptedCount"] + imp["expected"]["rejectedCount"] == imp["input"]["totalCount"], "import expected reconciliation mismatch")
    require(not imp["expected"]["published"] and imp["expected"]["appliedCount"] == 0, "partial atomic import must not publish")
    require(by_id["PER-GOLDEN-HOME-001"]["expected"]["menuCatalogRendered"] is False, "home may not render menu catalog")


def validate_docs() -> None:
    adr = ADR.read_text(encoding="utf-8")
    state = STATE.read_text(encoding="utf-8")
    authz = AUTHZ.read_text(encoding="utf-8")
    golden = GOLDEN_SPEC.read_text(encoding="utf-8")
    readme = README.read_text(encoding="utf-8")
    for token in [OWNER, "Extractability constraints", "may not import HRM entities/repositories"]:
        require(token in adr, f"ADR missing: {token}")
    for token in ["Idempotency contract", "Failure and recovery table", "RESULT_UNKNOWN", "Calibration", "appeal"]:
        require(token in state, f"state/recovery contract missing: {token}")
    for token in ["Authorization equation", "SOD_HRIS_PERFORMANCE_CALIBRATE_PUBLISH", "PERFORMANCE_PRIVATE", "Resource PEP algorithm", "negative"]:
        require(token.lower() in authz.lower(), f"authorization contract missing: {token}")
    for token in ["synthetic", "customer data", "do not block core coding", "Change control"]:
        require(token.lower() in golden.lower(), f"golden spec missing: {token}")
    for token in ["CONTRACT_READY_FOR_INDEPENDENT_G2_REVIEW", OWNER, "Target code layout", "Core coding has no dependency"]:
        require(token in readme, f"readiness README missing: {token}")
    header, slices = read_csv(SLICES)
    require(header == ["slice_id", "scope", "depends_on", "contracts", "core_readiness", "evidence", "activation_only_conditions", "implementation_order"], "slice register header drift")
    require(len(slices) == 9, f"expected nine implementation slices, got {len(slices)}")
    require([int(row["implementation_order"]) for row in slices] == list(range(1, 10)), "slice implementation order drift")
    require(all(row["core_readiness"] == "READY_FOR_INDEPENDENT_REVIEW" for row in slices), "slice readiness state drift")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    self_tests = 0
    try:
        validate_files()
        coverage_rows, parent_ids = validate_coverage()
        children, child_decisions = validate_children(coverage_rows, parent_ids)
        validate_decisions(coverage_rows, child_decisions)
        validate_security_blocked(coverage_rows, children)
        validate_characterization()
        validate_ddl()
        api_document = validate_api_contract()
        validate_fixture()
        validate_docs()
        if args.self_test:
            mutations = []
            mutated = copy.deepcopy(api_document)
            mutated["components"]["schemas"]["CreateGoalCommand"]["properties"]["weight"] = {"type": "number"}
            mutations.append(("binary-float", mutated))
            mutated = copy.deepcopy(api_document)
            mutated["components"]["schemas"]["QuantitativeGoalMeasurement"]["additionalProperties"] = True
            mutations.append(("open-measurement-json", mutated))
            mutated = copy.deepcopy(api_document)
            mutated["components"]["schemas"]["CommandReceipt"]["required"].remove("authorizationRevision")
            mutations.append(("unsealed-receipt", mutated))
            mutated = copy.deepcopy(api_document)
            mutated["paths"]["/command-receipts/{receiptId}"]["get"]["x-dwp-authorization-rule"] = "CURRENT_CONTEXT_ONLY"
            mutations.append(("receipt-reauthorization", mutated))
            mutated = copy.deepcopy(api_document)
            mutated["components"]["schemas"]["ReviewDraftCommand"]["properties"]["answers"] = {"type": "object", "additionalProperties": True}
            mutations.append(("open-review-answers", mutated))
            for mutation_name, mutation in mutations:
                self_tests += 1
                require(bool(public_dto_errors(mutation)), f"PER self-test mutation was accepted: {mutation_name}")
    except (AssertionError, KeyError, ValueError, json.JSONDecodeError) as error:
        print(f"PER_READINESS=FAIL checks={checks} error={error}")
        return 1
    print(
        "PER_READINESS=PASS "
        f"checks={checks} parents=349 children=1041 decisions=16 "
        f"self_tests={self_tests} unknown=0 unassessed=0 "
        "runtime_owner=dwp-people-server/hris/performance"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
