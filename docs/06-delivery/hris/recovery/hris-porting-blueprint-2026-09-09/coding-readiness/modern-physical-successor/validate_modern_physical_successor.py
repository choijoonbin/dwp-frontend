#!/usr/bin/env python3
"""Independent fail-closed validator for the modern physical successor design.

This validator trusts exactly one upstream byte generation: the reviewed v3
closed-set manifest.  It never imports the SQL/JSON producers.  It performs
closed-set, physical-shape and hostile mutation checks without touching a live
database.  Live PostgreSQL 16/18 execution remains a G3 migration concern.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
READINESS = HERE.parent
MANIFEST = READINESS / "modern-capability-closed-set-manifest.v3.json"
MANIFEST_FILE_SHA256 = "be4e5fc198af218db740d46b6a264644f2fd9cae686ca35c3b0cd430541f04b6"
MANIFEST_PAYLOAD_SEAL = "00bb8fba8b91addbc9dea24d0441bc70f6e6833db9997bd89e85da26984f9a0a"

SQL_BY_SESSION = {
    "HRIS-HRM": "hrm-modern-forward-ddl.v3.sql",
    "HRIS-PER": "per-modern-forward-ddl.v3.sql",
    "HRIS-TIM": "tim-modern-forward-ddl.v3.sql",
    "HRIS-SYS": "sys-modern-forward-ddl.v3.sql",
}
CONTRACT_FILES = (
    "modern-owner-handler-physical-contracts.v3.json",
    "modern-query-projection-physical-contracts.v3.json",
)

EXPECTED_TABLES = {
    "HRIS-HRM": frozenset("""
ppl_bnf_enrollment_decisions ppl_bnf_enrollments ppl_bnf_life_events
ppl_bnf_plan_versions ppl_bnf_plans ppl_bnf_provider_receipts
ppl_bnf_provider_requests ppl_cwk_access_expiry_receipts ppl_cwk_access_requests
ppl_cwk_classification_receipts ppl_cwk_engagements ppl_cwk_sponsor_assignments
ppl_hrs_case_actions ppl_hrs_cases ppl_hrs_sla_receipts
ppl_jny_assignment_revisions ppl_jny_assignment_task_revisions
ppl_jny_assignment_tasks ppl_jny_assignments ppl_jny_task_evidence
ppl_jny_template_versions ppl_jny_templates ppl_rec_candidate_cases
ppl_rec_candidate_stage_history ppl_rec_hire_handoff_receipts
ppl_rec_hire_requests ppl_rec_offers ppl_rec_requisitions
ppl_wfp_publish_receipts ppl_wfp_scenario_revisions ppl_wfp_scenarios
""".split()),
    "HRIS-PER": frozenset("""
prf_cmp_approved_snapshot_lines prf_cmp_approved_snapshots prf_cmp_budget_ledger
prf_cmp_cycles prf_cmp_plans prf_cmp_proposals prf_grw_aspirations
prf_grw_coaching_notes prf_grw_evidence_links prf_grw_portability_export_receipts
prf_grw_profile_revisions prf_grw_profiles prf_lrn_assignments
prf_lrn_completion_evidence prf_lrn_offerings prf_mkt_application_decisions
prf_mkt_applications prf_mkt_match_explanations prf_mkt_opportunities
prf_skl_proficiency_levels prf_skl_skill_edges prf_skl_skill_nodes
prf_skl_taxonomies prf_skl_taxonomy_versions prf_skl_worker_evidence
prf_suc_nominations prf_suc_plans prf_suc_readiness_evidence
""".split()),
    "HRIS-TIM": frozenset("""
tme_wfm_approval_requests tme_wfm_candidate_shift_lines
tme_wfm_constraint_evaluation_receipts tme_wfm_constraint_violation_lines
tme_wfm_demand_forecasts tme_wfm_demand_lines tme_wfm_fairness_measure_values
tme_wfm_forecast_revision_counters tme_wfm_optimization_requests
tme_wfm_schedule_candidate_versions tme_wfm_schedule_candidates
tme_wfm_schedule_publish_ledger
""".split()),
    "HRIS-SYS": frozenset("""
sys_hris_ai_assistance_requests sys_hris_ai_evaluation_receipts
sys_hris_ai_evaluation_requests sys_hris_ai_policy_versions
sys_hris_ai_provenance_receipts sys_hris_ai_use_policies
sys_hris_analytics_export_receipts sys_hris_listening_actions
sys_hris_listening_admission_versions sys_hris_listening_answer_values
sys_hris_listening_cohort_budgets sys_hris_listening_cohort_packages
sys_hris_listening_cohort_projections sys_hris_listening_domain_outbox
sys_hris_listening_eligibility_versions sys_hris_listening_erasure_tickets
sys_hris_listening_export_receipts sys_hris_listening_insights_inbox
sys_hris_listening_insights_outbox sys_hris_listening_issuer_outbox
sys_hris_listening_issuer_receipts sys_hris_listening_lineage_receipts
sys_hris_listening_operation_receipts sys_hris_listening_protected_outbox
sys_hris_listening_protected_receipts sys_hris_listening_responses
sys_hris_listening_survey_versions sys_hris_listening_surveys
sys_hris_listening_token_consumptions sys_hris_listening_token_issuances
sys_hris_listening_token_revocations sys_hris_metric_definitions
sys_hris_metric_projection_requests sys_hris_metric_projections
sys_hris_metric_versions
""".split()),
}
EXPECTED_HANDLERS = frozenset("""
internal.ai.assistance-result.consume internal.ai.policy-evaluation-result.consume
internal.analytics.export.expire internal.analytics.export.result.consume
internal.analytics.metric-projection.result.consume
internal.benefits.life-event.expire internal.benefits.provider-result.consume
internal.contingent.access-expiry.initiate
internal.contingent.access-grant-result.consume
internal.contingent.access-revoke-result.consume
internal.growth.portability-export.expire
internal.growth.portability-export.result.consume
internal.hrservice.sla-milestone.consume
internal.listening.configuration.admission-close-receipt.consume
internal.listening.configuration.admission-install-receipt.consume
internal.listening.insights.cohort-package.consume
internal.listening.protected.admission-close.consume
internal.listening.protected.admission-install.consume
internal.listening.protected.cohort-projection-receipt.consume
internal.listening.protected.erasure.process
internal.listening.protected.erasure.request
internal.recruiting.hire-handoff.result.consume internal.recruiting.offer.expire
internal.wfm.approval-result.consume
internal.wfm.schedule-optimization.result.consume
""".split())

CREATE_TABLE_RE = re.compile(
    r"CREATE\s+TABLE\s+"
    r"(?P<schema>[a-z][a-z0-9_]*)\.(?P<table>(?:ppl|prf|tme|sys)_[a-z0-9_]+)\s*\(",
    re.IGNORECASE,
)
FORBIDDEN_HISTORY = re.compile(r"(?:session-evidence/.+\.sql|V\d+__|ALTER\s+TABLE\s+(?!hris_))", re.I)

EXPECTED_WRITER_ZERO = {
    "ppl_bnf_provider_receipts": ("internal.benefits.provider-result.consume",),
    "ppl_hrs_sla_receipts": ("internal.hrservice.sla-milestone.consume",),
    "ppl_cwk_sponsor_assignments": ("modern.contingent.engagement.create", "modern.contingent.sponsor.reassign"),
    "prf_suc_readiness_evidence": ("modern.succession.readiness.record",),
    "sys_hris_listening_cohort_results": ("internal.listening.insights.cohort-package.consume",),
}
EXPECTED_UPDATE_ONLY = {
    "ppl_rec_candidate_cases": ("modern.recruiting.candidate.admit", "INSERT_ROOT_AND_APPEND_HISTORY"),
    "prf_skl_worker_evidence": ("modern.skills.evidence.record", "INSERT_ROOT"),
    "prf_cmp_proposals": ("modern.compplan.proposal.upsert", "INSERT_OR_UPDATE_CAS"),
}
EXPECTED_EXCLUSIONS = {
    "sys.listening.protected.response.private",
    "sys.listening.protected.erasure.internal",
}


def sha256_bytes(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def canonical_payload(value: dict[str, Any]) -> bytes:
    payload = {k: v for k, v in value.items() if k != "sealedPayloadSha256"}
    return json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()


def verify_manifest(raw: bytes) -> dict[str, Any]:
    if sha256_bytes(raw) != MANIFEST_FILE_SHA256:
        raise ValueError("immutable manifest file SHA mismatch")
    value = json.loads(raw)
    if value.get("sealedPayloadSha256") != MANIFEST_PAYLOAD_SEAL:
        raise ValueError("immutable manifest declared seal mismatch")
    if sha256_bytes(canonical_payload(value)) != MANIFEST_PAYLOAD_SEAL:
        raise ValueError("immutable manifest payload seal mismatch")
    expected_tables = frozenset().union(*EXPECTED_TABLES.values())
    if set(value.get("tableIds", [])) != expected_tables or len(value.get("tableIds", [])) != 106:
        raise ValueError("manifest/independent exact 106-table inventory mismatch")
    if set(value.get("handlerIds", [])) != EXPECTED_HANDLERS or len(value.get("handlerIds", [])) != 25:
        raise ValueError("manifest/independent exact 25-handler inventory mismatch")
    operations = value.get("operations", [])
    operation_ids = [row.get("operationId") for row in operations]
    if len(operation_ids) != 199 or len(set(operation_ids)) != 199:
        raise ValueError("manifest exact 199-operation inventory mismatch")
    if sum(row.get("mode") == "COMMAND" for row in operations) != 133:
        raise ValueError("manifest command count mismatch")
    if sum(row.get("mode") == "QUERY" for row in operations) != 66:
        raise ValueError("manifest query count mismatch")
    return value


def load_sealed_json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    declared = value.get("sealedPayloadSha256")
    if not isinstance(declared, str) or sha256_bytes(canonical_payload(value)) != declared:
        raise ValueError(f"{path.name}: self seal mismatch")
    return value


def balanced_sql(text: str) -> bool:
    # Remove line comments and single/dollar-quoted bodies before delimiter checks.
    stripped = re.sub(r"--[^\n]*", "", text)
    stripped = re.sub(r"\$[A-Za-z_]*\$.*?\$[A-Za-z_]*\$", "", stripped, flags=re.S)
    stripped = re.sub(r"'(?:''|[^'])*'", "''", stripped)
    depth = 0
    for ch in stripped:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
            if depth < 0:
                return False
    return depth == 0 and text.count("BEGIN;") >= 1 and text.rstrip().endswith("-- 5. Cross-owner UUID references deliberately have no database FK; handlers must resolve typed owner/purpose/version receipts.") or depth == 0 and "COMMIT;" in text


def validate_sql_text(session: str, text: str) -> list[str]:
    errors: list[str] = []
    found = [m.group("table").lower() for m in CREATE_TABLE_RE.finditer(text)]
    if len(found) != len(set(found)):
        errors.append(f"{session}: duplicate CREATE TABLE")
    if set(found) != EXPECTED_TABLES[session]:
        errors.append(f"{session}: exact table set mismatch")
    for marker in (
        MANIFEST_FILE_SHA256, MANIFEST_PAYLOAD_SEAL, "BEGIN;", "COMMIT;",
        "ENABLE ROW LEVEL SECURITY", "FORCE ROW LEVEL SECURITY",
        "tenant_isolation", "REVOKE ALL", "MIGRATION NOTES",
        "NOT_AUTHORIZED_G6", "Fail closed",
    ):
        if marker not in text:
            errors.append(f"{session}: missing marker {marker}")
    if not balanced_sql(text):
        errors.append(f"{session}: unbalanced/incomplete SQL")
    if re.search(r"UNIQUE\s*\([^)]*(?:correlation|sha256|digest|hash)", text, re.I):
        errors.append(f"{session}: forbidden correlation/hash/digest unique")
    for table in EXPECTED_TABLES[session]:
        block_match = re.search(
            rf"CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+[a-z0-9_]+\.{re.escape(table)}\s*\((.*?)\n\);",
            text, re.I | re.S,
        )
        if not block_match:
            errors.append(f"{session}:{table}: definition missing")
            continue
        block = block_match.group(1)
        for col in ("tenant_id", "public_id", "version", "created_at", "updated_at"):
            if not re.search(rf"\b{col}\b", block):
                errors.append(f"{session}:{table}: missing {col}")
        if "PRIMARY KEY (tenant_id, public_id)" not in block:
            errors.append(f"{session}:{table}: missing tenant composite PK")
    if "CREATE TABLE " in text.replace("CREATE TABLE IF NOT EXISTS", ""):
        errors.append(f"{session}: non-idempotent CREATE TABLE")
    return errors


def validate_contracts(manifest: dict[str, Any], handler: dict[str, Any], query: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    operations = {row["operationId"]: row for row in manifest["operations"]}
    handlers = handler.get("handlers", [])
    if {row.get("handlerId") for row in handlers} != EXPECTED_HANDLERS or len(handlers) != 25:
        errors.append("handler contract exact set mismatch")
    for row in handlers:
        stages = row.get("atomicStages", [])
        if row.get("handlerId") == "internal.listening.protected.erasure.process":
            required = {"CLAIM", "ERASE_OR_CRYPTO_SHRED", "TOMBSTONE", "SEALED_ACK"}
        elif row.get("handlerId") == "internal.listening.protected.erasure.request":
            required = {"CLAIM", "DOMAIN_INSERT", "SEALED_ACK", "OUTBOX"}
        else:
            required = {"INBOX_CLAIM", "DOMAIN_CAS", "CLOSED_ACK", "OUTBOX_APPEND"}
        if not required.issubset(set(stages)):
            errors.append(f"handler stages incomplete:{row.get('handlerId')}")
        if row.get("transactionBoundary") != "ONE_OWNER_LOCAL_DATABASE_TRANSACTION":
            errors.append(f"handler transaction not atomic:{row.get('handlerId')}")
        if row.get("differentDigestReplay") != "CONFLICT_NO_MUTATION":
            errors.append(f"handler digest replay unsafe:{row.get('handlerId')}")
    physical_ops = query.get("operationPhysicalContracts", [])
    if {row.get("operationId") for row in physical_ops} != set(operations) or len(physical_ops) != 199:
        errors.append("operation physical contract exact set mismatch")
    projections = query.get("reentryProjections", [])
    if len(projections) != 44 or len({row.get("projectionId") for row in projections}) != 44:
        errors.append("exact 44 re-entry projection set mismatch")
    if sum(row.get("visibility") in {"PRIVATE", "INTERNAL"} for row in projections) != 0:
        errors.append("private/internal projection leaked into public 44")
    for row in physical_ops:
        if row.get("mode") != operations[row.get("operationId")]["mode"]:
            errors.append(f"operation mode drift:{row.get('operationId')}")
        if not row.get("readTables"):
            errors.append(f"operation has no physical read/re-entry source:{row.get('operationId')}")
        if row.get("mode") == "QUERY" and row.get("writeTables"):
            errors.append(f"query declares writes:{row.get('operationId')}")
        if row.get("mode") == "COMMAND" and row.get("createPrestate") == "NONE":
            if not row.get("physicalPostState"):
                errors.append(f"create NONE has no post-state:{row.get('operationId')}")
    writer_zero = query.get("writerZeroProducers", [])
    update_only = query.get("updateOnlyProducers", [])
    if len(writer_zero) != 5 or any(row.get("writeTables") != [] for row in writer_zero):
        errors.append("writer-zero exact-five contract mismatch")
    if len(update_only) != 3 or any(row.get("writeDisposition") != "UPDATE_ONLY_CAS" for row in update_only):
        errors.append("update-only exact-three contract mismatch")
    table_contracts = query.get("tablePhysicalContracts", [])
    expected_tables = frozenset().union(*EXPECTED_TABLES.values())
    if {row.get("tableId") for row in table_contracts} != expected_tables or len(table_contracts) != 106:
        errors.append("table physical contract exact set mismatch")
    required_plans = {
        "singleLifecycleState", "typedCrossOwnerReferences", "recurrenceSafeUniqueness",
        "intervalSemantics", "correlationHashUniquenessRemoval",
        "directPublicationProof", "compensationSnapshot", "wfmValidation",
        "skillsTaxonomyEvidence", "contingentSaga",
    }
    if not required_plans.issubset(set(query.get("hardeningPlans", {}))):
        errors.append("hardening plan set incomplete")
    return errors


def validate(root: Path = HERE) -> list[str]:
    errors: list[str] = []
    try:
        manifest = verify_manifest(MANIFEST.read_bytes())
    except Exception as exc:
        return [str(exc)]
    sql_texts: dict[str, str] = {}
    for session, name in SQL_BY_SESSION.items():
        path = root / name
        if not path.is_file():
            errors.append(f"missing SQL:{name}")
            continue
        text = path.read_text(encoding="utf-8")
        sql_texts[session] = text
        errors.extend(validate_sql_text(session, text))
    try:
        handler = load_sealed_json(root / CONTRACT_FILES[0])
        query = load_sealed_json(root / CONTRACT_FILES[1])
        errors.extend(validate_contracts(manifest, handler, query))
    except Exception as exc:
        errors.append(str(exc))
    return errors


def self_test() -> list[str]:
    failures: list[str] = []
    raw = MANIFEST.read_bytes()
    manifest = verify_manifest(raw)
    cases: list[tuple[str, bool]] = []
    hostile = bytearray(raw); hostile[-2] ^= 1
    try: verify_manifest(bytes(hostile)); cases.append(("manifest-byte-mutation", False))
    except Exception: cases.append(("manifest-byte-mutation", True))
    bad = copy.deepcopy(manifest); bad["tableIds"] = bad["tableIds"][:-1]
    bad["sealedPayloadSha256"] = sha256_bytes(canonical_payload(bad))
    try:
        verify_manifest(json.dumps(bad, sort_keys=True).encode())
        cases.append(("manifest-reseal-cannot-bypass-file-pin", False))
    except Exception: cases.append(("manifest-reseal-cannot-bypass-file-pin", True))
    if (HERE / SQL_BY_SESSION["HRIS-HRM"]).is_file():
        good_sql = (HERE / SQL_BY_SESSION["HRIS-HRM"]).read_text()
        cases.append(("sql-table-delete-detected", bool(validate_sql_text("HRIS-HRM", re.sub(r"CREATE TABLE IF NOT EXISTS[^;]+;", "", good_sql, count=1, flags=re.S)))))
        cases.append(("sql-forbidden-unique-digest-detected", bool(validate_sql_text("HRIS-HRM", good_sql + "\nALTER TABLE x ADD UNIQUE (tenant_id, payload_sha256);"))))
        cases.append(("sql-truncation-detected", bool(validate_sql_text("HRIS-HRM", good_sql[:-200]))))
    for name, ok in cases:
        if not ok: failures.append(f"hostile self-test failed:{name}")
    print(f"MODERN_PHYSICAL_SUCCESSOR_SELF_TEST={'PASS' if not failures else 'FAIL'} cases={len(cases)} passed={len(cases)-len(failures)}")
    return failures


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    errors = self_test() if args.self_test else validate()
    if errors:
        for error in errors: print(f"ERROR {error}")
        return 1
    if not args.self_test:
        print("MODERN_PHYSICAL_SUCCESSOR_VALIDATION=PASS operations=199 handlers=25 tables=106 reentryProjections=44")
    return 0


if __name__ == "__main__":
    import pathlib as _guard_pathlib
    import sys as _guard_sys

    _guard_dir = _guard_pathlib.Path(__file__).resolve().parent
    while not (_guard_dir / "modern_successor_reader_guard.py").is_file():
        if _guard_dir.parent == _guard_dir:
            raise SystemExit("modern successor reader guard is unavailable")
        _guard_dir = _guard_dir.parent
    _guard_sys.path.insert(0, str(_guard_dir))
    from modern_successor_reader_guard import guarded_main as _guarded_main

    raise SystemExit(_guarded_main(__file__, main))
