#!/usr/bin/env python3
"""Validate one TIM/PAY G1 and G2 module evidence package without external deps."""

from __future__ import annotations

import csv
import json
import re
import sys
from collections import Counter
from decimal import Decimal
from pathlib import Path


HERE = Path(__file__).resolve().parent
MODULE = HERE.name
ROOT = HERE.parent.parent

CONFIG = {
    "tim": {
        "session": "HRIS-TIM",
        "source_modules": {"tim"},
        "parents": 568,
        "children": 3566,
        "decisions": 16,
        "golden": 10,
        "contamination": 1,
        "coverage": ROOT / "session-registers/hris-tim-source-coverage.csv",
        "required_tables": {
            "tme_worker_projections", "tme_work_rule_set_versions", "tme_shift_template_versions",
            "tme_clock_events", "tme_interpretation_runs", "tme_interpretation_attempts",
            "tme_interpreted_segments", "tme_time_ledger_entries", "tme_time_cards",
            "tme_time_exceptions", "tme_work_requests", "abs_leave_plan_versions",
            "abs_leave_requests", "abs_entitlement_runs", "abs_entitlement_ledger_entries",
            "tme_close_periods", "tme_close_attempts", "tme_payroll_handoffs",
            "tme_command_receipts", "tme_inbox_receipts", "tme_outbox_events"
        },
        "required_operations": {"clock.record", "interpretation.run", "timecard.submit", "timecard.decide", "leave.request.create", "leave.request.decide", "close.close", "close.reopen", "handoff.create"},
        "required_events": {"ClockEventRecorded", "TimeInterpreted", "TimecardDecisionRecorded", "LeaveDecisionRecorded", "LeaveLedgerPosted", "TimePeriodClosed", "TimePeriodReopened", "PayrollTimeHandoffReady"},
        "banned_fk_prefixes": ("ppl_", "pay_"),
    },
    "pay": {
        "session": "HRIS-PAY",
        "source_modules": {"pay", "yea"},
        "parents": 580,
        "children": 3515,
        "decisions": 18,
        "golden": 12,
        "contamination": 12,
        "coverage": ROOT / "session-registers/hris-pay-source-coverage.csv",
        "required_tables": {
            "pay_worker_projections", "pay_time_handoff_snapshots", "pay_legal_payroll_entities",
            "pay_pay_groups", "pay_pay_periods", "pay_element_versions", "pay_formula_versions",
            "pay_formula_dependencies", "pay_formula_test_cases", "pay_worker_element_entries",
            "pay_input_snapshots", "pay_payroll_runs", "pay_payroll_run_attempts",
            "pay_worker_results", "pay_result_lines", "pay_calculation_trace_nodes",
            "pay_balance_ledger_entries", "pay_retro_events", "pay_reconciliation_issues",
            "pay_run_approvals", "pay_payment_batches", "pay_payment_instructions",
            "pay_payment_files", "pay_connector_receipts", "pay_gl_mapping_rule_versions",
            "pay_gl_batches", "pay_gl_lines", "pay_payslips", "pay_payslip_access_events",
            "pay_country_pack_versions", "pay_statutory_cases", "pay_year_end_cases",
            "pay_year_end_evidence", "pay_year_end_provider_invocations", "pay_command_receipts",
            "pay_inbox_receipts", "pay_outbox_events"
        },
        "required_operations": {"formula.publish", "run.prepare", "run.calculate", "run.approve", "run.finalize", "correction.create", "payment.release", "gl.post", "payslip.download", "country.pack.activate", "yearend.provider.submit"},
        "required_events": {"PayrollConfigurationPublished", "PayrollRunPrepared", "PayrollCalculated", "PayrollValidated", "PayrollRunApproved", "PayrollFinalized", "PayrollCorrectionPosted", "PayslipPublished", "PaymentInstructionReleased", "PayrollPosted", "YearEndCaseChanged"},
        "banned_fk_prefixes": ("ppl_", "tme_", "abs_"),
    },
}

COVERAGE_HEADER = ["session_id","source_module","artifact_type","artifact_id","display_key","source_file","source_line","legacy_contract","legacy_component_or_table","observed_metadata","disposition","target_capability_id","target_bounded_context_candidate","target_api_or_event","target_data_owner","process_change","genericity","acceptance_evidence","decision_status","decision_owner","notes"]
CHILD_HEADER = ["child_id","parent_artifact_id","session_id","source_module","child_type","source_file","source_line","source_fingerprint","actor","trigger","input_contract","output_contract","validation_rules","state_transitions","exceptions","legacy_dependency","target_capability_candidate","target_api_event_candidate","target_data_owner_candidate","disposition","decision_status","decision_id","owner_role","evidence_refs","notes"]
DECISION_HEADER = ["decision_id","session_id","scope","decision_type","question","options","proposed_decision","status","owner_role","consulted_role_ids","due_at","blocking_gate","blocking_scope","evidence_refs","resolution","decided_at","notes"]
CHILD_TYPES = {"MENU_ELEMENT","SERVICE_OPERATION","JOB","INTERFACE","FORMULA_BEHAVIOR","FILE_DOCUMENT","SQL_BEHAVIOR","STATE_TRANSITION"}
DISPOSITIONS = {"REUSE","REBUILD","CONFIGURE","EXTENSION","RETIRE"}
BASE_BE = "5670877de7a39e94e75021c7e23cbbb553296c90"
BASE_FE = "0692b1efee13c0be4efe813c8d41957a0dca76d6"


class Validation:
    def __init__(self) -> None:
        self.errors: list[str] = []
        self.checks = 0

    def require(self, condition: bool, message: str) -> None:
        self.checks += 1
        if not condition:
            self.errors.append(message)


def read_csv(path: Path, v: Validation, expected_header: list[str]) -> list[dict[str, str]]:
    v.require(path.is_file(), f"missing {path}")
    if not path.is_file():
        return []
    with path.open(encoding="utf-8-sig", newline="") as fh:
        reader = csv.DictReader(fh)
        v.require(reader.fieldnames == expected_header, f"header mismatch: {path.name}")
        return list(reader)


def validate_characterization(v: Validation, cfg: dict) -> None:
    path = HERE / "g1-characterization.md"
    v.require(path.is_file(), "missing g1-characterization.md")
    if not path.is_file():
        return
    text = path.read_text(encoding="utf-8")
    headings = [
        "Provenance and scope", "Coverage summary", "Actors and authorization", "Journeys and commands",
        "Validation, state, and exceptions", "Data ownership and retention", "Batch, interface, and document behavior",
        "Redundancy and process improvements", "Generic core, country pack, and tenant extension",
        "Target contract proposals", "Unknowns and decisions", "Synthetic characterization tests"
    ]
    for heading in headings:
        v.require(bool(re.search(rf"^##\s+\d+\.\s+{re.escape(heading)}\s*$", text, re.M)), f"missing heading: {heading}")
    for marker in (BASE_BE, BASE_FE, str(cfg["parents"]), f"{cfg['children']:,}", "BEHAVIORAL_REIMPLEMENTATION_NO_CODE_REUSE"):
        v.require(marker in text, f"characterization missing marker: {marker}")


def validate_g1(v: Validation, cfg: dict) -> tuple[list[dict[str, str]], list[dict[str, str]], list[dict[str, str]]]:
    coverage = read_csv(cfg["coverage"], v, COVERAGE_HEADER)
    children = read_csv(HERE / "g1-child-trace.csv", v, CHILD_HEADER)
    decisions = read_csv(HERE / "g1-decision-log.csv", v, DECISION_HEADER)
    role_path = ROOT / "g0/role-register.csv"
    v.require(role_path.is_file(), "missing g0/role-register.csv")
    role_ids: set[str] = set()
    if role_path.is_file():
        with role_path.open(encoding="utf-8-sig", newline="") as fh:
            role_ids = {row.get("role_id", "") for row in csv.DictReader(fh)}
    v.require(len(coverage) == cfg["parents"], f"parent count {len(coverage)} != {cfg['parents']}")
    v.require(len(children) == cfg["children"], f"child count {len(children)} != {cfg['children']}")
    v.require(len(decisions) == cfg["decisions"], f"decision count {len(decisions)} != {cfg['decisions']}")

    parent_ids: set[str] = set()
    parent_decisions: set[str] = set()
    required_parent = ["disposition","target_capability_id","target_bounded_context_candidate","target_api_or_event","target_data_owner","process_change","genericity","acceptance_evidence","decision_status","decision_owner","notes"]
    for i, row in enumerate(coverage, 2):
        aid = row.get("artifact_id", "")
        v.require(bool(aid), f"coverage:{i} blank artifact_id")
        v.require(aid not in parent_ids, f"coverage:{i} duplicate artifact_id {aid}")
        parent_ids.add(aid)
        v.require(row.get("session_id") == cfg["session"], f"coverage:{i} wrong session")
        v.require(row.get("source_module") in cfg["source_modules"], f"coverage:{i} wrong source module")
        v.require(row.get("disposition") in DISPOSITIONS, f"coverage:{i} invalid disposition")
        v.require(row.get("decision_status") == "DECIDED", f"coverage:{i} not DECIDED")
        for key in required_parent:
            v.require(bool(row.get(key, "").strip()), f"coverage:{i} blank {key}")
        v.require(row.get("decision_owner") in role_ids, f"coverage:{i} decision_owner is not a stable role")
        v.require("UNKNOWN" not in row.get("disposition", ""), f"coverage:{i} UNKNOWN disposition")
        v.require("UNASSESSED" not in row.get("decision_status", ""), f"coverage:{i} UNASSESSED")
        match = re.search(r"decision_id=((?:TIM|PAY)-DEC-\d+)", row.get("notes", ""))
        v.require(bool(match), f"coverage:{i} missing decision_id note")
        if match:
            parent_decisions.add(match.group(1))
        if re.search(r"BENSK", " ".join(row.values()), re.I):
            v.require(row["disposition"] == "RETIRE", f"coverage:{i} BENSK not retired")
        if re.search(r"ADDSK|SK2|SKC|KEYFOUNDRY|RETKF", " ".join(row.values()), re.I):
            v.require(row["disposition"] in {"EXTENSION","RETIRE"} or "ADDSK" not in row["source_file"].upper(), f"coverage:{i} customer variant entered core")

    decision_ids: set[str] = set()
    for i, row in enumerate(decisions, 2):
        did = row.get("decision_id", "")
        v.require(bool(did), f"decision:{i} blank id")
        v.require(did not in decision_ids, f"decision:{i} duplicate {did}")
        decision_ids.add(did)
        v.require(row.get("session_id") == cfg["session"], f"decision:{i} wrong session")
        for key in ("scope","decision_type","question","status","owner_role","blocking_gate","blocking_scope","evidence_refs","resolution","decided_at"):
            v.require(bool(row.get(key, "").strip()), f"decision:{i} blank {key}")
        v.require(row.get("owner_role") in role_ids, f"decision:{i} owner_role is not a stable role")
        for role in filter(None, row.get("consulted_role_ids", "").split("|")):
            v.require(role in role_ids, f"decision:{i} consulted role is not stable: {role}")
        v.require(row.get("status") == "DECIDED", f"decision:{i} not terminal DECIDED")
    v.require(parent_decisions <= decision_ids, f"coverage references missing decisions: {sorted(parent_decisions - decision_ids)}")

    child_ids: set[str] = set()
    child_parents: set[str] = set()
    seen_types: set[str] = set()
    required_child = ["child_id","parent_artifact_id","session_id","source_module","child_type","source_file","source_fingerprint","actor","trigger","input_contract","output_contract","validation_rules","state_transitions","exceptions","legacy_dependency","target_capability_candidate","target_api_event_candidate","target_data_owner_candidate","disposition","decision_status","decision_id","owner_role","evidence_refs","notes"]
    for i, row in enumerate(children, 2):
        cid = row.get("child_id", "")
        v.require(cid not in child_ids, f"child:{i} duplicate {cid}")
        child_ids.add(cid)
        for key in required_child:
            v.require(bool(row.get(key, "").strip()), f"child:{i} blank {key}")
        v.require(row.get("parent_artifact_id") in parent_ids, f"child:{i} orphan parent")
        child_parents.add(row.get("parent_artifact_id", ""))
        v.require(row.get("session_id") == cfg["session"], f"child:{i} wrong session")
        v.require(row.get("source_module") in cfg["source_modules"], f"child:{i} wrong source module")
        v.require(row.get("child_type") in CHILD_TYPES, f"child:{i} invalid child type")
        seen_types.add(row.get("child_type", ""))
        v.require(bool(re.fullmatch(r"[0-9a-f]{64}", row.get("source_fingerprint", ""))), f"child:{i} invalid fingerprint")
        if row.get("source_line"):
            v.require(row["source_line"].isdigit() and int(row["source_line"]) > 0, f"child:{i} invalid source line")
        v.require(row.get("owner_role") in role_ids, f"child:{i} owner_role is not a stable role")
        v.require(row.get("disposition") in DISPOSITIONS, f"child:{i} invalid disposition")
        v.require(row.get("decision_status") == "DECIDED", f"child:{i} not DECIDED")
        v.require(row.get("decision_id") in decision_ids, f"child:{i} missing decision pointer")
        v.require("UNKNOWN" not in row.get("disposition", "") and "UNASSESSED" not in row.get("decision_status", ""), f"child:{i} unresolved")
        if "ADDSK" in row.get("notes", "").upper():
            v.require(row.get("disposition") in {"RETIRE","EXTENSION"}, f"child:{i} ADDSK not isolated")
    v.require(child_parents == parent_ids, f"parents without children: {len(parent_ids-child_parents)}")
    v.require(seen_types == CHILD_TYPES, f"missing child types: {sorted(CHILD_TYPES-seen_types)}")

    service_counts = Counter(row.get("parent_artifact_id") for row in children if row.get("child_type") == "SERVICE_OPERATION")
    for i, row in enumerate(coverage, 2):
        mapped = re.search(r"method_mapping_count=(\d+)", row.get("observed_metadata", ""))
        blocked = "SECURITY_BLOCKED_ARTIFACT" in row.get("notes", "")
        if row.get("artifact_type") == "CONTROLLER" and mapped and not blocked:
            expected = int(mapped.group(1))
            actual = service_counts[row.get("artifact_id", "")]
            v.require(actual >= expected, f"coverage:{i} controller operation trace {actual} < method_mapping_count {expected}")

    contamination_path = ROOT / "customer-specific-contamination-register.csv"
    v.require(contamination_path.is_file(), "missing customer-specific-contamination-register.csv")
    contamination: list[dict[str, str]] = []
    if contamination_path.is_file():
        with contamination_path.open(encoding="utf-8-sig", newline="") as fh:
            contamination = [row for row in csv.DictReader(fh) if row.get("source_module") == MODULE]
    v.require(len(contamination) == cfg["contamination"], f"contamination count {len(contamination)} != {cfg['contamination']}")
    for item in contamination:
        marker = f"customer-specific-contamination-register.csv:{item['source_file']};"
        matches = [row for row in children if marker in row.get("evidence_refs", "")]
        v.require(len(matches) == 1, f"ADDSK evidence trace count {len(matches)} != 1 for {item['source_file']}")
        if len(matches) == 1:
            trace = matches[0]
            v.require(trace.get("disposition") == "RETIRE", f"ADDSK source not retired: {item['source_file']}")
            v.require("ADDSK_CLASSIFICATION=RETIRE_FROM_CORE" in trace.get("notes", ""), f"ADDSK source lacks explicit classification: {item['source_file']}")
    return coverage, children, decisions


def validate_sql(v: Validation, cfg: dict) -> None:
    path = HERE / "g2-physical-schema.sql"
    v.require(path.is_file(), "missing g2-physical-schema.sql")
    if not path.is_file():
        return
    text = path.read_text(encoding="utf-8")
    tables = {m.group(1).lower() for m in re.finditer(r"CREATE\s+TABLE\s+([a-zA-Z0-9_]+)\s*\(", text, re.I)}
    v.require(cfg["required_tables"] <= tables, f"missing tables: {sorted(cfg['required_tables']-tables)}")
    for match in re.finditer(r"CREATE\s+TABLE\s+([a-zA-Z0-9_]+)\s*\((.*?)\)\s*(?:PARTITION\s+BY[^;]+)?;", text, re.I | re.S):
        v.require(re.search(r"\btenant_id\b", match.group(2), re.I) is not None, f"table {match.group(1)} lacks tenant_id")
    for prefix in cfg["banned_fk_prefixes"]:
        v.require(re.search(rf"REFERENCES\s+{re.escape(prefix)}", text, re.I) is None, f"cross-context FK to {prefix}")
    for marker in ("idempotency_key", "payload_digest", "row_version", "reverses", "CREATE TRIGGER", "BEFORE UPDATE OR DELETE"):
        v.require(marker.lower() in text.lower(), f"DDL missing {marker}")
    for banned in ("DROP TABLE", "cloudhr_", "bensk", "addsk"):
        v.require(banned.lower() not in text.lower(), f"DDL contains banned token {banned}")


def validate_api(v: Validation, cfg: dict) -> None:
    path = HERE / "g2-api-event-contracts.json"
    v.require(path.is_file(), "missing g2-api-event-contracts.json")
    if not path.is_file():
        return
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        v.errors.append(f"invalid API JSON: {exc}")
        return
    v.require(data.get("baseline", {}).get("backend") == BASE_BE, "API backend baseline mismatch")
    v.require(data.get("baseline", {}).get("frontend") == BASE_FE, "API frontend baseline mismatch")
    v.require(data.get("principles", {}).get("crossContextDatabaseAccess") is False, "API permits cross-context DB")
    ops = data.get("operations", [])
    op_ids = [x.get("id") for x in ops]
    v.require(len(op_ids) == len(set(op_ids)), "duplicate API operation ids")
    v.require(cfg["required_operations"] <= set(op_ids), f"missing API operations: {sorted(cfg['required_operations']-set(op_ids))}")
    for op in ops:
        for key in ("id", "method", "path", "action", "scope", "mode", "response"):
            v.require(bool(op.get(key)), f"operation {op.get('id')} missing {key}")
        if op.get("mode") == "command":
            v.require(op.get("idempotent") is True, f"command {op.get('id')} is not idempotent")
            v.require(op.get("response") in {"TimeCommandReceipt.v1", "PayrollCommandReceipt.v1"}, f"command {op.get('id')} lacks receipt")
    provided = data.get("providedEvents", [])
    event_names = [x.get("type") for x in provided]
    v.require(len(event_names) == len(set(event_names)), "duplicate provided events")
    v.require(cfg["required_events"] <= set(event_names), f"missing provided events: {sorted(cfg['required_events']-set(event_names))}")
    for event in provided:
        v.require(event.get("version") == 1, f"event {event.get('type')} is not v1")
        v.require(bool(event.get("payloadRequired")), f"event {event.get('type')} lacks required payload")
    envelope = set(data.get("eventEnvelope", {}).get("required", []))
    v.require({"eventId","tenantId","aggregateId","aggregateRevision","correlationId","payloadDigest","payload"} <= envelope, "event envelope incomplete")
    v.require(bool(data.get("activationGates", {}).get("core")), "missing core gate")
    v.require(bool(data.get("activationGates", {}).get("production")), "missing production gate")


def validate_golden(v: Validation, cfg: dict) -> None:
    path = HERE / "synthetic-golden-fixtures.json"
    v.require(path.is_file(), "missing synthetic-golden-fixtures.json")
    if not path.is_file():
        return
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        v.errors.append(f"invalid golden JSON: {exc}")
        return
    v.require(data.get("syntheticOnly") is True, "golden data is not synthetic-only")
    cases = data.get("cases", [])
    v.require(len(cases) == cfg["golden"], f"golden case count {len(cases)} != {cfg['golden']}")
    ids = [c.get("id") for c in cases]
    v.require(len(ids) == len(set(ids)), "duplicate golden ids")
    for case in cases:
        v.require(bool(case.get("id")) and bool(case.get("title")) and bool(case.get("layer")), "golden metadata incomplete")
        v.require(isinstance(case.get("input"), dict) and isinstance(case.get("expected"), dict), f"golden {case.get('id')} missing input/expected")
    raw = path.read_text(encoding="utf-8")
    for banned in ("SKKF", "BENSK", "ADDSK", "@sk.com", "residentRegistrationNumber", "bankAccountPlaintext"):
        v.require(banned.lower() not in raw.lower(), f"golden contains banned data marker {banned}")

    by_id = {c["id"]: c for c in cases}
    if MODULE == "tim":
        one = by_id["TIM-GOLD-001"]
        v.require(one["expected"]["regularMinutes"] == one["expected"]["elapsedMinutes"] - one["input"]["breakMinutes"], "TIM-GOLD-001 arithmetic")
        five = by_id["TIM-GOLD-005"]
        v.require(sum(x["quantityMinutes"] for x in five["input"]["entries"]) == five["expected"]["balanceMinutes"], "TIM-GOLD-005 ledger arithmetic")
        eight = by_id["TIM-GOLD-008"]
        v.require(sum(x["minutes"] for x in eight["input"]["aggregates"]) == eight["expected"]["acceptedMinutes"], "TIM-GOLD-008 handoff total")
    else:
        one = by_id["PAY-GOLD-001"]
        v.require(Decimal(one["expected"]["gross"]) - Decimal(one["expected"]["deductions"]) == Decimal(one["expected"]["net"]), "PAY-GOLD-001 totals")
        eight = by_id["PAY-GOLD-008"]
        debits = sum(Decimal(x["amount"]) for x in eight["input"]["lines"] if x["side"] == "DEBIT")
        credits = sum(Decimal(x["amount"]) for x in eight["input"]["lines"] if x["side"] == "CREDIT")
        v.require(debits == credits == Decimal(eight["expected"]["debitTotal"]), "PAY-GOLD-008 GL balance")
        v.require(data.get("statutoryAssertion") is False, "pay golden asserts statutory outcome")
    spec = HERE / "synthetic-golden-spec.md"
    v.require(spec.is_file(), "missing synthetic-golden-spec.md")
    if spec.is_file():
        text = spec.read_text(encoding="utf-8")
        for marker in ("activation", "idempot", "replay", "tenant"):
            v.require(marker.lower() in text.lower(), f"golden spec missing {marker}")


def validate_docs(v: Validation) -> None:
    for name in ("g2-service-boundary.md", "g2-runtime-controls.md", "g2-authorization.md"):
        path = HERE / name
        v.require(path.is_file(), f"missing {name}")
        if not path.is_file():
            continue
        text = path.read_text(encoding="utf-8")
        v.require("CODE_READY_PROPOSAL" in text or name == "g2-authorization.md", f"{name} missing proposal status")
        v.require("tenant" in text.lower(), f"{name} missing tenant boundary")
        v.require("idempot" in text.lower() or name == "g2-authorization.md", f"{name} missing idempotency")
    boundary = (HERE / "g2-service-boundary.md").read_text(encoding="utf-8")
    v.require(BASE_BE in boundary and BASE_FE in boundary, "service boundary baseline mismatch")
    if MODULE == "pay":
        combined = "\n".join((HERE / n).read_text(encoding="utf-8") for n in ("g2-service-boundary.md", "g2-runtime-controls.md", "g2-authorization.md"))
        for marker in ("provider", "hybrid", "country pack", "dwp-payroll-server"):
            v.require(marker.lower() in combined.lower(), f"PAY contract missing {marker}")
    else:
        v.require("dwp-time-server" in boundary, "TIM runtime not named")


def main() -> int:
    if MODULE not in CONFIG:
        print(f"unsupported module directory: {MODULE}", file=sys.stderr)
        return 2
    cfg = CONFIG[MODULE]
    v = Validation()
    validate_characterization(v, cfg)
    coverage, children, decisions = validate_g1(v, cfg)
    validate_sql(v, cfg)
    validate_api(v, cfg)
    validate_golden(v, cfg)
    validate_docs(v)
    disposition = Counter(row.get("disposition") for row in coverage)
    child_types = Counter(row.get("child_type") for row in children)
    if v.errors:
        for error in v.errors[:100]:
            print(f"ERROR: {error}")
        if len(v.errors) > 100:
            print(f"ERROR: ... {len(v.errors)-100} more")
        print(f"{cfg['session']}_READINESS=FAIL checks={v.checks} errors={len(v.errors)} parents={len(coverage)} children={len(children)} decisions={len(decisions)}")
        return 1
    print(f"{cfg['session']}_READINESS=PASS checks={v.checks} parents={len(coverage)} children={len(children)} decisions={len(decisions)} golden={cfg['golden']} dispositions={dict(disposition)} child_types={dict(child_types)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
