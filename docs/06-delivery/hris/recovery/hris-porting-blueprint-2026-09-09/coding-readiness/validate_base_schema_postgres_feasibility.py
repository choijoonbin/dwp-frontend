#!/usr/bin/env python3
"""Fail-closed PostgreSQL 16 proof for the HRIS base physical schemas.

Static mode proves that the checked-in People V1..V46 chain and the four HRIS
base DDL blueprints still have the exact table/schema/constraint/RLS boundary
approved for G3.  ``--docker-postgres`` additionally executes the SQL against
disposable PostgreSQL 16 databases:

* one dwp-people-server database: People V1..V46 -> HRM -> PER;
* one empty dwp-time-server database: TIM;
* one empty dwp-payroll-server database: PAY.

The People migrations are sent through one psql connection, with one explicit
transaction per migration.  This models Flyway's per-migration transaction
semantics and is required for V7's ``TEMP ... ON COMMIT DROP`` seed tables.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import time
import uuid
from copy import deepcopy
from pathlib import Path
from typing import Any


HERE = Path(__file__).resolve().parent
BLUEPRINT = HERE.parent
WORKSPACE = BLUEPRINT.parents[1]
BACKEND = WORKSPACE / ".codex-worktrees/hris/integration/backend"
PEOPLE_MIGRATIONS = (
    BACKEND
    / "dwp-people-server/src/main/resources/db/migration"
)

DDL_PATHS = {
    "HRM": BLUEPRINT / "session-evidence/hrm/g2-readiness/physical-schema-blueprint.sql",
    "PER": BLUEPRINT / "session-evidence/per/g2-readiness/physical-schema.sql",
    "TIM": BLUEPRINT / "session-evidence/tim/g2-physical-schema.sql",
    "PAY": BLUEPRINT / "session-evidence/pay/g2-physical-schema.sql",
}

EXPECTED_MIGRATION_FILENAME_DIGEST = (
    "d36fabb5eec22713d2e2e2030a0ecfb0e821c857b640ac8e3451c5a179b79074"
)

BASELINE_PUBLIC_TABLES = {
    "abs_leave_balances",
    "abs_leave_plans",
    "abs_leave_requests",
    "abs_worker_plan_enrollments",
    "bnf_benefit_plans",
    "bnf_benefit_programs",
    "bnf_enrollment_windows",
    "bnf_enrollments",
    "int_connector_cursors",
    "int_connector_instances",
    "int_external_mappings",
    "int_ingestion_receipts",
    "int_mapping_profiles",
    "int_reconciliation_issues",
    "int_reconciliation_runs",
    "int_source_systems",
    "int_sync_errors",
    "int_sync_runs",
    "pay_pay_cycles",
    "pay_statement_references",
    "ppl_approval_role_catalog",
    "ppl_assignment_change_reason_catalog",
    "ppl_assignments",
    "ppl_contacts",
    "ppl_job_grades",
    "ppl_job_profiles",
    "ppl_legal_employers",
    "ppl_locations",
    "ppl_org_design_policies",
    "ppl_organization_change_type_catalog",
    "ppl_organization_relationships",
    "ppl_organization_role_assignments",
    "ppl_organization_role_catalog",
    "ppl_organization_scenario_approvals",
    "ppl_organization_scenario_changes",
    "ppl_organization_scenario_validation_runs",
    "ppl_organization_scenarios",
    "ppl_organization_type_catalog",
    "ppl_organizations",
    "ppl_person_names",
    "ppl_persons",
    "ppl_position_criticality_catalog",
    "ppl_position_relationships",
    "ppl_position_type_catalog",
    "ppl_positions",
    "ppl_profile_media",
    "ppl_step_up_replay_ledger",
    "ppl_work_relationships",
    "ppl_workers",
    "ppl_workforce_access_policies",
    "ppl_workforce_export_attempt_events",
    "ppl_workforce_export_datasets",
    "ppl_workforce_export_requests",
    "sys_audit_outbox",
    "sys_people_audit_events",
    "sys_people_outbox_events",
    "sys_provider_tenant_command_receipts",
    "sys_service_tenants",
    "tal_goals",
    "tal_journey_instances",
    "tal_journey_templates",
    "tal_learning_assignments",
    "tme_time_cards",
    "tme_time_entries",
    "tme_time_exceptions",
    "tme_work_schedule_profiles",
    "tme_worker_schedule_assignments",
}

HRM_TABLES = {
    "ppl_legal_entity_registrations",
    "ppl_business_units",
    "ppl_establishments",
    "ppl_employment_terms",
    "ppl_assignment_events",
    "ppl_sensitive_change_payloads",
    "ppl_assignment_event_items",
    "ppl_compensation_basis",
    "ppl_employment_contracts",
    "ppl_worker_restricted_tokens",
    "ppl_dependents",
    "ppl_educations",
    "ppl_careers",
    "ppl_qualifications",
    "ppl_service_records",
    "ppl_accessibility_records",
    "ppl_employee_change_requests",
    "ppl_employee_change_evidence",
    "ppl_certificate_requests",
    "ppl_issued_certificates",
    "ppl_separation_cases",
    "ppl_separation_tasks",
    "ppl_command_receipts",
    "ppl_domain_inbox_receipts",
}

PER_TABLES = {
    "prf_cycles",
    "prf_cycle_versions",
    "prf_cycle_stages",
    "prf_templates",
    "prf_template_versions",
    "prf_template_items",
    "prf_rubric_levels",
    "prf_population_rules",
    "prf_population_freezes",
    "prf_participants",
    "prf_reviewer_assignments",
    "prf_goals",
    "prf_goal_revisions",
    "prf_goal_alignments",
    "prf_reviews",
    "prf_review_submissions",
    "prf_review_answers",
    "prf_feedback_requests",
    "prf_feedback_assignments",
    "prf_feedback_responses",
    "prf_checkins",
    "prf_calibration_sessions",
    "prf_calibration_adjustments",
    "prf_result_sets",
    "prf_results",
    "prf_result_publications",
    "prf_appeals",
    "prf_appeal_events",
    "prf_evidence_refs",
    "prf_command_receipts",
    "prf_inbox_receipts",
    "prf_outbox_events",
    "prf_import_runs",
    "prf_import_row_issues",
}

TIM_TABLES = {
    "tme_worker_projections",
    "tme_work_rule_set_versions",
    "tme_shift_template_versions",
    "tme_schedule_patterns",
    "tme_worker_schedule_assignments",
    "tme_scheduled_segments",
    "tme_clock_sources",
    "tme_clock_events",
    "tme_interpretation_runs",
    "tme_interpretation_attempts",
    "tme_interpreted_segments",
    "tme_time_ledger_entries",
    "tme_time_cards",
    "tme_time_exceptions",
    "tme_work_requests",
    "abs_leave_plan_versions",
    "abs_worker_plan_enrollments",
    "abs_leave_requests",
    "abs_leave_request_segments",
    "abs_entitlement_runs",
    "abs_entitlement_ledger_entries",
    "abs_leave_balance_projections",
    "tme_close_periods",
    "tme_close_attempts",
    "tme_closed_time_results",
    "tme_closed_time_result_lines",
    "tme_closed_time_result_sources",
    "tme_payroll_handoffs",
    "tme_command_receipts",
    "tme_inbox_receipts",
    "tme_outbox_events",
}

PAY_TABLES = {
    "pay_worker_projections",
    "pay_time_handoff_snapshots",
    "pay_time_handoff_lines",
    "pay_time_handoff_ingest_receipts",
    "pay_legal_payroll_entities",
    "pay_pay_groups",
    "pay_pay_periods",
    "pay_element_versions",
    "pay_formula_versions",
    "pay_formula_dependencies",
    "pay_formula_test_cases",
    "pay_rounding_policy_versions",
    "pay_worker_element_entries",
    "pay_worker_tax_profiles",
    "pay_input_snapshots",
    "pay_payroll_runs",
    "pay_payroll_run_workers",
    "pay_payroll_run_attempts",
    "pay_worker_results",
    "pay_result_lines",
    "pay_calculation_trace_nodes",
    "pay_balance_ledger_entries",
    "pay_retro_events",
    "pay_reconciliation_issues",
    "pay_run_approvals",
    "pay_payment_batches",
    "pay_payment_instructions",
    "pay_payment_files",
    "pay_connector_receipts",
    "pay_gl_mapping_rule_versions",
    "pay_gl_batches",
    "pay_gl_lines",
    "pay_payslips",
    "pay_payslip_access_events",
    "pay_country_pack_versions",
    "pay_statutory_cases",
    "pay_year_end_cases",
    "pay_year_end_evidence",
    "pay_year_end_provider_invocations",
    "pay_command_receipts",
    "pay_inbox_receipts",
    "pay_outbox_events",
}

MODULE_TABLES = {
    "HRM": HRM_TABLES,
    "PER": PER_TABLES,
    "TIM": TIM_TABLES,
    "PAY": PAY_TABLES,
}

MODULE_SCHEMAS = {
    "HRM": "public",
    "PER": "hris_performance",
    "TIM": "public",
    "PAY": "public",
}

MODULE_PREFIXES = {
    "HRM": ("ppl_",),
    "PER": ("prf_",),
    "TIM": ("tme_", "abs_"),
    "PAY": ("pay_",),
}

HRM_BASELINE_INDEXES = {
    "uk_ppl_legal_employers_public_id",
    "uk_ppl_work_relationships_public_id",
    "uk_ppl_assignments_public_id",
    "uk_ppl_job_profiles_public_id",
    "uk_ppl_job_grades_public_id",
    "uk_ppl_positions_public_id",
    "uk_ppl_locations_public_id",
}

HRM_BASELINE_EXCLUSIONS = {
    "ex_ppl_work_relationships_primary_period",
    "ex_ppl_assignments_primary_period",
}

# Counts are independent invariants, not values inferred from the current SQL.
EXPECTED_STATIC_STATS = {
    "HRM": {
        "tables": 24,
        "primaryKeys": 24,
        "uniqueConstraints": 59,
        "foreignKeys": 35,
        "checkConstraints": 53,
        "exclusionConstraints": 7,
        "explicitIndexes": 22,
        "triggers": 4,
    },
    "PER": {
        "tables": 34,
        "primaryKeys": 34,
        "uniqueConstraints": 66,
        "foreignKeys": 38,
        "checkConstraints": 78,
        "exclusionConstraints": 2,
        "explicitIndexes": 17,
        "triggers": 2,
    },
    "TIM": {
        "tables": 31,
        "primaryKeys": 31,
        "uniqueConstraints": 59,
        "foreignKeys": 17,
        "checkConstraints": 90,
        "exclusionConstraints": 4,
        "explicitIndexes": 12,
        "triggers": 9,
    },
    "PAY": {
        "tables": 42,
        "primaryKeys": 42,
        "uniqueConstraints": 82,
        "foreignKeys": 35,
        "checkConstraints": 119,
        "exclusionConstraints": 7,
        "explicitIndexes": 11,
        "triggers": 20,
    },
}

# These are catalog counts on only the newly owned tables.  HRM's script also
# strengthens seven pre-existing People tables with indexes and two exclusion
# constraints; those baseline augmentations are verified separately below.
# The static CHECK count is one higher per script because ``WITH CHECK`` in the
# RLS policy template is not a pg_constraint row.
EXPECTED_POSTGRES_STATS = {
    "HRM": {
        "tables": 24,
        "rlsTables": 24,
        "forcedRlsTables": 24,
        "tenantPolicies": 24,
        "tenantBigintNotNullColumns": 24,
        "indexes": 103,
        "primaryKeys": 24,
        "uniqueConstraints": 59,
        "foreignKeys": 35,
        "checkConstraints": 52,
        "exclusionConstraints": 5,
        "triggers": 4,
    },
    "PER": {
        "tables": 34,
        "rlsTables": 34,
        "forcedRlsTables": 34,
        "tenantPolicies": 34,
        "tenantBigintNotNullColumns": 34,
        "indexes": 119,
        "primaryKeys": 34,
        "uniqueConstraints": 66,
        "foreignKeys": 38,
        "checkConstraints": 77,
        "exclusionConstraints": 2,
        "triggers": 2,
    },
    "TIM": {
        "tables": 31,
        "rlsTables": 31,
        "forcedRlsTables": 31,
        "tenantPolicies": 31,
        "tenantBigintNotNullColumns": 31,
        "indexes": 106,
        "primaryKeys": 31,
        "uniqueConstraints": 59,
        "foreignKeys": 17,
        "checkConstraints": 89,
        "exclusionConstraints": 4,
        "triggers": 9,
    },
    "PAY": {
        "tables": 42,
        "rlsTables": 42,
        "forcedRlsTables": 42,
        "tenantPolicies": 42,
        "tenantBigintNotNullColumns": 42,
        "indexes": 142,
        "primaryKeys": 42,
        "uniqueConstraints": 82,
        "foreignKeys": 35,
        "checkConstraints": 118,
        "exclusionConstraints": 7,
        "triggers": 20,
    },
}

HRM_BASELINE_INDEXES = {
    "uk_ppl_legal_employers_public_id",
    "uk_ppl_work_relationships_public_id",
    "uk_ppl_assignments_public_id",
    "uk_ppl_job_profiles_public_id",
    "uk_ppl_job_grades_public_id",
    "uk_ppl_positions_public_id",
    "uk_ppl_locations_public_id",
}
HRM_BASELINE_EXCLUSIONS = {
    "ex_ppl_work_relationships_primary_period",
    "ex_ppl_assignments_primary_period",
}

EXPECTED_BASELINE_POSTGRES_STATS = {
    "tables": 67,
    "rlsTables": 0,
    "forcedRlsTables": 0,
    "tenantPolicies": 0,
    "indexes": 239,
    "primaryKeys": 67,
    "uniqueConstraints": 103,
    "foreignKeys": 94,
    "checkConstraints": 240,
    "exclusionConstraints": 2,
    "triggers": 4,
}


def digest_lines(values: set[str] | list[str]) -> str:
    return hashlib.sha256("\n".join(sorted(values)).encode("utf-8")).hexdigest()


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def strip_comments(sql: str) -> str:
    sql = re.sub(r"/\*.*?\*/", "", sql, flags=re.DOTALL)
    return re.sub(r"--[^\n]*", "", sql)


def table_blocks(sql: str) -> dict[str, str]:
    return {
        match.group(1).lower(): match.group(2)
        for match in re.finditer(
            r"^CREATE\s+TABLE\s+([a-z][a-z0-9_]*)\s*\((.*?)^\);",
            sql,
            flags=re.IGNORECASE | re.MULTILINE | re.DOTALL,
        )
    }

# Exact semantic controls which counts cannot distinguish.  These are the
# minimum database invariants for duplicate delivery, append-only corrections,
# local lineage, effective dating, and unpublished outbox tamper resistance.
TIM_REQUIRED_CONTROLS = {
    "clock-public-identity": "uk_tme_clock_event_public UNIQUE (tenant_id, public_id)",
    "clock-source-idempotency": "uk_tme_clock_source_event UNIQUE (tenant_id, source_public_id, source_event_key)",
    "clock-source-parent": "fk_tme_clock_event_source FOREIGN KEY (tenant_id, source_public_id) REFERENCES tme_clock_sources (tenant_id, public_id)",
    "clock-void-parent": "fk_tme_clock_event_voids FOREIGN KEY (tenant_id, voids_event_public_id) REFERENCES tme_clock_events (tenant_id, public_id)",
    "clock-single-void": "CREATE UNIQUE INDEX uk_tme_clock_event_single_void",
    "time-ledger-public-identity": "uk_tme_time_ledger_public UNIQUE (tenant_id, public_id)",
    "time-ledger-worker-revision": "uk_tme_time_ledger_revision UNIQUE (tenant_id, worker_public_id, ledger_revision)",
    "time-ledger-attempt-parent": "fk_tme_time_ledger_attempt FOREIGN KEY (tenant_id, interpretation_attempt_public_id) REFERENCES tme_interpretation_attempts (tenant_id, public_id)",
    "time-ledger-reversal-parent": "fk_tme_time_ledger_reversal FOREIGN KEY (tenant_id, reverses_entry_public_id) REFERENCES tme_time_ledger_entries (tenant_id, public_id)",
    "time-ledger-single-reversal": "CREATE UNIQUE INDEX uk_tme_time_ledger_single_reversal",
    "entitlement-source-idempotency": "uk_abs_ledger_source UNIQUE (tenant_id, source_public_id, worker_public_id, leave_plan_public_id, entry_type, effective_date)",
    "entitlement-plan-parent": "fk_abs_ledger_plan FOREIGN KEY (tenant_id, leave_plan_public_id) REFERENCES abs_leave_plan_versions (tenant_id, public_id)",
    "entitlement-reversal-parent": "fk_abs_ledger_reversal FOREIGN KEY (tenant_id, reverses_entry_public_id) REFERENCES abs_entitlement_ledger_entries (tenant_id, public_id)",
    "entitlement-single-reversal": "CREATE UNIQUE INDEX uk_abs_ledger_single_reversal",
    "interpreted-fact-append-only": "BEFORE UPDATE OR DELETE ON tme_interpreted_segments FOR EACH ROW EXECUTE FUNCTION tme_reject_fact_mutation()",
    "outbox-envelope-sealed-before-publish": "TIME_OUTBOX_EVENT_ENVELOPE_IMMUTABLE",
    "outbox-delete-rejected": "TIME_OUTBOX_EVENT_CANNOT_BE_DELETED",
}

PAY_REQUIRED_CONTROLS = {
    "input-snapshot-handoff-parent": "fk_pay_input_snapshot_handoff FOREIGN KEY (tenant_id, time_handoff_public_id) REFERENCES pay_time_handoff_snapshots (tenant_id, public_id)",
    "run-correction-parent": "fk_pay_run_supersedes FOREIGN KEY (tenant_id, supersedes_run_public_id) REFERENCES pay_payroll_runs (tenant_id, public_id)",
    "worker-result-public-identity": "uk_pay_worker_result_public UNIQUE (tenant_id, public_id)",
    "worker-result-attempt-idempotency": "uk_pay_worker_result_attempt UNIQUE (tenant_id, payroll_run_attempt_id, worker_public_id)",
    "worker-result-attempt-parent": "fk_pay_worker_result_attempt FOREIGN KEY (tenant_id, payroll_run_attempt_id) REFERENCES pay_payroll_run_attempts (tenant_id, payroll_run_attempt_id)",
    "result-line-worker-parent": "fk_pay_result_line_worker_result FOREIGN KEY (tenant_id, worker_result_public_id) REFERENCES pay_worker_results (tenant_id, public_id)",
    "result-line-element-parent": "fk_pay_result_line_element_version FOREIGN KEY (tenant_id, element_version_public_id) REFERENCES pay_element_versions (tenant_id, public_id)",
    "result-line-trace-parent": "fk_pay_result_line_trace FOREIGN KEY (tenant_id, trace_public_id) REFERENCES pay_calculation_trace_nodes (tenant_id, public_id)",
    "result-line-reversal-parent": "fk_pay_result_line_reversal FOREIGN KEY (tenant_id, reverses_line_public_id) REFERENCES pay_result_lines (tenant_id, public_id)",
    "result-line-single-reversal": "CREATE UNIQUE INDEX uk_pay_result_line_single_reversal",
    "trace-attempt-parent": "fk_pay_trace_attempt FOREIGN KEY (tenant_id, payroll_run_attempt_public_id) REFERENCES pay_payroll_run_attempts (tenant_id, public_id)",
    "trace-parent-node": "fk_pay_trace_parent FOREIGN KEY (tenant_id, parent_node_public_id) REFERENCES pay_calculation_trace_nodes (tenant_id, public_id)",
    "balance-source-parent": "fk_pay_balance_source_line FOREIGN KEY (tenant_id, source_result_line_public_id) REFERENCES pay_result_lines (tenant_id, public_id)",
    "balance-reversal-parent": "fk_pay_balance_reversal FOREIGN KEY (tenant_id, reverses_entry_public_id) REFERENCES pay_balance_ledger_entries (tenant_id, public_id)",
    "balance-single-reversal": "CREATE UNIQUE INDEX uk_pay_balance_single_reversal",
    "payment-result-parent": "fk_pay_payment_instruction_result FOREIGN KEY (tenant_id, source_worker_result_public_id) REFERENCES pay_worker_results (tenant_id, public_id)",
    "gl-result-parent": "fk_pay_gl_line_result FOREIGN KEY (tenant_id, source_result_line_public_id) REFERENCES pay_result_lines (tenant_id, public_id)",
    "payslip-result-parent": "fk_pay_payslip_worker_result FOREIGN KEY (tenant_id, worker_result_public_id) REFERENCES pay_worker_results (tenant_id, public_id)",
    "rounding-published-no-overlap": "ALTER TABLE pay_rounding_policy_versions ADD CONSTRAINT ex_pay_rounding_overlap EXCLUDE USING gist",
    "gl-mapping-published-no-overlap": "ALTER TABLE pay_gl_mapping_rule_versions ADD CONSTRAINT ex_pay_gl_mapping_overlap EXCLUDE USING gist",
    "published-config-seal": "PAYROLL_PUBLISHED_VERSION_PAYLOAD_IMMUTABLE",
    "frozen-input-seal": "PAYROLL_FROZEN_INPUT_SNAPSHOT_IMMUTABLE",
    "run-attempt-seal": "PAYROLL_RUN_ATTEMPT_IDENTITY_IMMUTABLE",
    "payment-file-seal": "PAYMENT_FILE_EVIDENCE_IMMUTABLE",
    "connector-request-seal": "PAYROLL_CONNECTOR_RECEIPT_REQUEST_IMMUTABLE",
    "payslip-lifecycle-seal": "PAYSLIP_INVALID_STATE_TRANSITION",
    "outbox-envelope-seal": "PAYROLL_OUTBOX_ENVELOPE_IMMUTABLE",
}


def require_control_fragments(
    module: str,
    sql: str,
    controls: dict[str, str],
) -> list[str]:
    normalized = re.sub(r"\s+", " ", sql).strip()
    return [
        f"{module}: required semantic control missing: {name}"
        for name, fragment in controls.items()
        if re.sub(r"\s+", " ", fragment).strip() not in normalized
    ]


def rls_loop_tables(sql: str) -> set[str]:
    loops = re.findall(
        r"FOREACH\s+(?:target_table|table_name)\s+IN\s+ARRAY\s+ARRAY\[(.*?)\]\s+LOOP",
        sql,
        flags=re.IGNORECASE | re.DOTALL,
    )
    if len(loops) != 1:
        return set()
    return {
        value.lower()
        for value in re.findall(r"'([a-z][a-z0-9_]*)'", loops[0], re.IGNORECASE)
    }


def sql_stats(sql: str) -> dict[str, int]:
    clean = strip_comments(sql)
    patterns = {
        "tables": r"^CREATE\s+TABLE\s+",
        "primaryKeys": r"\bPRIMARY\s+KEY\b",
        "uniqueConstraints": r"\bUNIQUE\s*\(",
        "foreignKeys": r"\bFOREIGN\s+KEY\b",
        "checkConstraints": r"\bCHECK\s*\(",
        "exclusionConstraints": r"\bEXCLUDE\s+USING\b",
        "explicitIndexes": r"^CREATE\s+(?:UNIQUE\s+)?INDEX\s+",
        "triggers": r"^CREATE\s+TRIGGER\s+",
    }
    return {
        key: len(re.findall(pattern, clean, flags=re.IGNORECASE | re.MULTILINE))
        for key, pattern in patterns.items()
    }


def referenced_tables(sql: str) -> set[tuple[str | None, str]]:
    return {
        ((schema.lower() if schema else None), table.lower())
        for schema, table in re.findall(
            r"\bREFERENCES\s+(?:([a-z][a-z0-9_]*)\.)?([a-z][a-z0-9_]*)\s*\(",
            strip_comments(sql),
            flags=re.IGNORECASE,
        )
    }


def load_inputs() -> tuple[list[tuple[str, str]], dict[str, str], list[str]]:
    errors: list[str] = []
    migrations: list[tuple[str, str]] = []
    if not PEOPLE_MIGRATIONS.is_dir():
        errors.append(f"missing People migration directory: {PEOPLE_MIGRATIONS}")
    else:
        candidates = list(PEOPLE_MIGRATIONS.glob("V*.sql"))
        parsed: list[tuple[int, Path]] = []
        for path in candidates:
            match = re.fullmatch(r"V(\d+)__.+\.sql", path.name)
            if match is None:
                errors.append(f"invalid People migration filename: {path.name}")
                continue
            parsed.append((int(match.group(1)), path))
        for _, path in sorted(parsed):
            migrations.append((path.name, path.read_text(encoding="utf-8")))

    module_sql: dict[str, str] = {}
    for module, path in DDL_PATHS.items():
        if not path.is_file():
            errors.append(f"missing {module} physical DDL: {path}")
        else:
            module_sql[module] = path.read_text(encoding="utf-8")
    return migrations, module_sql, errors


def validate_static(
    migrations: list[tuple[str, str]],
    module_sql: dict[str, str],
) -> tuple[list[str], int, dict[str, Any]]:
    errors: list[str] = []
    checks = 0

    versions: list[int] = []
    for filename, _ in migrations:
        match = re.fullmatch(r"V(\d+)__.+\.sql", filename)
        if match is not None:
            versions.append(int(match.group(1)))
    filename_digest = digest_lines([name for name, _ in migrations])
    checks += 5
    if versions != list(range(1, 47)):
        errors.append(f"People migration versions must be exact V1..V46; got {versions}")
    if len({name for name, _ in migrations}) != 46:
        errors.append("People migration filename set must contain exactly 46 unique files")
    if filename_digest != EXPECTED_MIGRATION_FILENAME_DIGEST:
        errors.append("People V1..V46 migration filename digest drift")
    if any(re.search(r"(?mi)^\s*(?:BEGIN|COMMIT)\s*;", sql) for _, sql in migrations):
        errors.append("People migration embeds transaction control; psql/Flyway wrapper owns it")
    v7 = next((sql for name, sql in migrations if name.startswith("V7__")), "")
    if (
        len(re.findall(r"\bCREATE\s+TEMP\s+TABLE\b", v7, re.IGNORECASE)) != 2
        or len(re.findall(r"\bON\s+COMMIT\s+DROP\b", v7, re.IGNORECASE)) != 2
    ):
        errors.append("People V7 TEMP/ON COMMIT contract drift")

    module_details: dict[str, Any] = {}
    for module in ("HRM", "PER", "TIM", "PAY"):
        sql = module_sql.get(module, "")
        expected_tables = MODULE_TABLES[module]
        blocks = table_blocks(sql)
        tables = set(blocks)
        stats = sql_stats(sql)
        rls = rls_loop_tables(sql)
        references = referenced_tables(sql)
        expected_schema = MODULE_SCHEMAS[module]
        checks += 15
        if tables != expected_tables:
            errors.append(
                f"{module}: exact table set drift missing={sorted(expected_tables - tables)} "
                f"unexpected={sorted(tables - expected_tables)}"
            )
        if stats != EXPECTED_STATIC_STATS[module]:
            errors.append(
                f"{module}: static constraint/index stats drift "
                f"expected={EXPECTED_STATIC_STATS[module]} actual={stats}"
            )
        if any(not table.startswith(MODULE_PREFIXES[module]) for table in tables):
            errors.append(f"{module}: table prefix escaped its owner boundary")
        if set(blocks) and any(
            re.search(r"\btenant_id\s+BIGINT\s+NOT\s+NULL\b", block, re.IGNORECASE)
            is None
            for block in blocks.values()
        ):
            errors.append(f"{module}: every table must have tenant_id BIGINT NOT NULL")
        if rls != expected_tables:
            errors.append(
                f"{module}: RLS loop must cover the exact table set "
                f"missing={sorted(expected_tables - rls)} unexpected={sorted(rls - expected_tables)}"
            )
        if sql.count("CREATE POLICY %I") != 1:
            errors.append(f"{module}: canonical tenant policy loop must occur exactly once")
        if "ENABLE ROW LEVEL SECURITY" not in sql or "FORCE ROW LEVEL SECURITY" not in sql:
            errors.append(f"{module}: ENABLE/FORCE RLS contract missing")
        if "dwp.tenant_id" not in sql:
            errors.append(f"{module}: canonical tenant context is missing")
        if re.search(r"(?mi)^\s*(?:BEGIN|COMMIT)\s*;", sql):
            errors.append(f"{module}: blueprint embeds transaction control; runner owns it")
        if re.search(r"\\(?:i|include)\b", sql, re.IGNORECASE):
            errors.append(f"{module}: blueprint depends on a psql include")
        if re.search(
            r"\b(?:dblink|postgres_fdw|IMPORT\s+FOREIGN\s+SCHEMA)\b",
            sql,
            re.IGNORECASE,
        ):
            errors.append(f"{module}: cross-database access construct found")
        if re.search(r"\b(?:DROP\s+TABLE|TRUNCATE|DELETE\s+FROM)\b", sql, re.IGNORECASE):
            errors.append(f"{module}: destructive SQL found")

        if module == "PER":
            if (
                len(re.findall(r"CREATE\s+SCHEMA\s+IF\s+NOT\s+EXISTS\s+hris_performance", sql, re.IGNORECASE))
                != 1
                or len(re.findall(r"SET\s+search_path\s+TO\s+hris_performance\s*,\s*public", sql, re.IGNORECASE))
                != 1
            ):
                errors.append("PER: hris_performance schema/search_path contract drift")
        elif re.search(r"\b(?:CREATE\s+SCHEMA|SET\s+search_path)\b", sql, re.IGNORECASE):
            errors.append(f"{module}: must execute in its service-local public schema")

        allowed_references = expected_tables | (
            BASELINE_PUBLIC_TABLES if module == "HRM" else set()
        )
        bad_references = {
            f"{schema + '.' if schema else ''}{table}"
            for schema, table in references
            if schema not in (None, expected_schema)
            or table not in allowed_references
        }
        if bad_references:
            errors.append(
                f"{module}: unresolved/cross-owner database FK targets {sorted(bad_references)}"
            )
        if module in ("PER", "TIM", "PAY") and any(
            table not in expected_tables for _, table in references
        ):
            errors.append(f"{module}: service-local schema contains a foreign-table FK")

        semantic_controls = (
            TIM_REQUIRED_CONTROLS
            if module == "TIM"
            else PAY_REQUIRED_CONTROLS
            if module == "PAY"
            else {}
        )
        if semantic_controls:
            checks += len(semantic_controls)
            errors.extend(require_control_fragments(module, sql, semantic_controls))

        if module == "HRM":
            baseline_indexes = {
                value.lower()
                for value in re.findall(
                    r"^CREATE\s+UNIQUE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+([a-z][a-z0-9_]*)",
                    sql,
                    flags=re.IGNORECASE | re.MULTILINE,
                )
            }
            alter_exclusions = {
                value.lower()
                for value in re.findall(
                    r"ALTER\s+TABLE\s+(?:ppl_work_relationships|ppl_assignments).*?"
                    r"CONSTRAINT\s+([a-z][a-z0-9_]*)\s+EXCLUDE\s+USING",
                    sql,
                    flags=re.IGNORECASE | re.DOTALL,
                )
            }
            checks += 2
            if baseline_indexes != HRM_BASELINE_INDEXES:
                errors.append("HRM: exact People-baseline index augmentation drift")
            if alter_exclusions != HRM_BASELINE_EXCLUSIONS:
                errors.append("HRM: exact People-baseline exclusion augmentation drift")

        module_details[module] = {
            "schema": expected_schema,
            "tables": len(tables),
            "tableSetSha256": digest_lines(tables),
            "rlsTables": len(rls),
            **stats,
        }

    checks += 5
    all_owner_tables = set().union(*MODULE_TABLES.values())
    if len(all_owner_tables) != 131:
        errors.append("base physical owner table sets do not total exactly 131")
    if HRM_TABLES & BASELINE_PUBLIC_TABLES:
        errors.append("HRM extension table collides with People V1..V46 baseline")
    if not all(
        MODULE_TABLES[left].isdisjoint(MODULE_TABLES[right])
        for index, left in enumerate(MODULE_TABLES)
        for right in list(MODULE_TABLES)[index + 1 :]
    ):
        errors.append("a base physical table is allocated to more than one module")
    if len(BASELINE_PUBLIC_TABLES) != 67:
        errors.append("People V1..V46 expected baseline table set must contain 67 tables")
    if digest_lines(BASELINE_PUBLIC_TABLES) != (
        "1fdfb5774ea3d991122bbba30765f325d2c22f8ab979805e9db06da6abe5c48f"
    ):
        errors.append("People V1..V46 expected baseline table-set digest drift")

    details = {
        "peopleBaselineMigrations": len(migrations),
        "peopleBaselineVersions": versions,
        "peopleMigrationFilenameSetSha256": filename_digest,
        "peopleBaselineTables": len(BASELINE_PUBLIC_TABLES),
        "peopleBaselineTableSetSha256": digest_lines(BASELINE_PUBLIC_TABLES),
        "baseOwnerTables": len(all_owner_tables),
        "modules": module_details,
        "executionPlan": {
            "peopleDatabaseOrder": ["People V1..V46", "HRM", "PER"],
            "peopleMigrationTransactions": 48,
            "peopleBaselineSinglePsqlSession": True,
            "onErrorStop": True,
            "timeDatabase": "independent-empty",
            "payrollDatabase": "independent-empty",
        },
    }
    return errors, checks, details


def run_command(
    command: list[str],
    *,
    timeout: int = 60,
    input_text: str | None = None,
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        input=input_text,
        capture_output=True,
        check=False,
        text=True,
        timeout=timeout,
    )


def psql_transaction_script(paths: list[str]) -> str:
    lines = [r"\set ON_ERROR_STOP on"]
    for path in paths:
        lines.extend(("BEGIN;", rf"\i '{path}'", "COMMIT;"))
    return "\n".join(lines) + "\n"


def execute_psql_script(
    container: str,
    database: str,
    script: str,
    *,
    timeout: int,
) -> tuple[bool, str]:
    completed = run_command(
        [
            "docker",
            "exec",
            "-i",
            container,
            "psql",
            "-X",
            "-q",
            "-U",
            "postgres",
            "-d",
            database,
        ],
        timeout=timeout,
        input_text=script,
    )
    if completed.returncode == 0:
        return True, ""
    output = (completed.stderr or completed.stdout).strip()
    return False, output[-4000:]


def query_json(container: str, database: str, query: str) -> Any:
    completed = run_command(
        [
            "docker",
            "exec",
            container,
            "psql",
            "-X",
            "-At",
            "-U",
            "postgres",
            "-d",
            database,
            "-c",
            query,
        ],
        timeout=30,
    )
    if completed.returncode != 0:
        raise RuntimeError((completed.stderr or completed.stdout).strip()[-4000:])
    return json.loads(completed.stdout.strip())


def schema_table_names(container: str, database: str, schema: str) -> set[str]:
    payload = query_json(
        container,
        database,
        "SELECT COALESCE(json_agg(c.relname ORDER BY c.relname), '[]'::json) "
        "FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace "
        f"WHERE n.nspname='{schema}' AND c.relkind IN ('r','p');",
    )
    if not isinstance(payload, list):
        raise RuntimeError(f"catalog table-name query returned {type(payload).__name__}")
    return {str(item) for item in payload}


def inspect_table_set(
    container: str,
    database: str,
    schema: str,
    tables: set[str],
) -> dict[str, Any]:
    values = ",".join(f"('{table}')" for table in sorted(tables))
    query = f"""
WITH wanted(name) AS (VALUES {values}),
rels AS (
  SELECT c.oid,c.relname,c.relrowsecurity,c.relforcerowsecurity
    FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    JOIN wanted w ON w.name=c.relname
   WHERE n.nspname='{schema}' AND c.relkind IN ('r','p')
), tenant_columns AS (
  SELECT a.attrelid
    FROM pg_attribute a
    JOIN rels r ON r.oid=a.attrelid
   WHERE a.attname='tenant_id' AND NOT a.attisdropped
     AND a.atttypid='int8'::regtype AND a.attnotnull
)
SELECT json_build_object(
  'tables',(SELECT count(*) FROM rels),
  'tableNames',(SELECT COALESCE(json_agg(relname ORDER BY relname),'[]'::json) FROM rels),
  'rlsTables',(SELECT count(*) FROM rels WHERE relrowsecurity),
  'forcedRlsTables',(SELECT count(*) FROM rels WHERE relforcerowsecurity),
  'tenantPolicies',(SELECT count(*) FROM pg_policy p JOIN rels r ON r.oid=p.polrelid),
  'policyNames',(SELECT COALESCE(json_agg(r.relname || ':' || p.polname ORDER BY r.relname,p.polname),'[]'::json) FROM pg_policy p JOIN rels r ON r.oid=p.polrelid),
  'tenantBigintNotNullColumns',(SELECT count(*) FROM tenant_columns),
  'indexes',(SELECT count(*) FROM pg_index i JOIN rels r ON r.oid=i.indrelid),
  'primaryKeys',(SELECT count(*) FROM pg_constraint c JOIN rels r ON r.oid=c.conrelid WHERE c.contype='p'),
  'uniqueConstraints',(SELECT count(*) FROM pg_constraint c JOIN rels r ON r.oid=c.conrelid WHERE c.contype='u'),
  'foreignKeys',(SELECT count(*) FROM pg_constraint c JOIN rels r ON r.oid=c.conrelid WHERE c.contype='f'),
  'checkConstraints',(SELECT count(*) FROM pg_constraint c JOIN rels r ON r.oid=c.conrelid WHERE c.contype='c'),
  'exclusionConstraints',(SELECT count(*) FROM pg_constraint c JOIN rels r ON r.oid=c.conrelid WHERE c.contype='x'),
  'triggers',(SELECT count(*) FROM pg_trigger t JOIN rels r ON r.oid=t.tgrelid WHERE NOT t.tgisinternal)
);"""
    return query_json(container, database, query)


def validate_postgres_stats(
    label: str,
    actual: dict[str, Any],
    expected: dict[str, int],
    expected_tables: set[str],
    errors: list[str],
) -> int:
    checks = 3 + len(expected)
    actual_names = {str(value) for value in actual.get("tableNames", [])}
    if actual_names != expected_tables:
        errors.append(
            f"{label}: PostgreSQL exact table set drift "
            f"missing={sorted(expected_tables - actual_names)} "
            f"unexpected={sorted(actual_names - expected_tables)}"
        )
    expected_policies = {
        f"{table}:{table}_tenant_policy" for table in expected_tables
    }
    actual_policies = {str(value) for value in actual.get("policyNames", [])}
    if expected.get("tenantPolicies", 0) > 0 and actual_policies != expected_policies:
        errors.append(f"{label}: exact tenant policy names/table binding drift")
    if expected.get("tenantPolicies", 0) == 0 and actual_policies:
        errors.append(f"{label}: unexpected tenant policies {sorted(actual_policies)}")
    for key, value in expected.items():
        if actual.get(key) != value:
            errors.append(
                f"{label}: PostgreSQL {key} expected={value} actual={actual.get(key)}"
            )
    return checks


def validate_with_docker(
    migrations: list[tuple[str, str]],
) -> tuple[list[str], int, dict[str, Any]]:
    errors: list[str] = []
    checks = 0
    container = "dwp-hris-base-ddl-" + uuid.uuid4().hex[:10]
    migration_mount = f"{PEOPLE_MIGRATIONS}:/people-migrations:ro"
    blueprint_mount = f"{BLUEPRINT}:/blueprint:ro"
    try:
        started = run_command(
            [
                "docker",
                "run",
                "--rm",
                "-d",
                "--name",
                container,
                "-e",
                "POSTGRES_PASSWORD=dwp_hris_test_only",
                "-v",
                migration_mount,
                "-v",
                blueprint_mount,
                "postgres:16-alpine",
            ],
            timeout=90,
        )
    except (OSError, subprocess.TimeoutExpired) as error:
        return [f"docker PostgreSQL start failed: {error}"], checks, {"executed": False}
    if started.returncode != 0:
        return [f"docker PostgreSQL start failed: {started.stderr.strip()}"], checks, {
            "executed": False
        }

    try:
        ready = False
        # The official image briefly exposes an initialization server and then
        # restarts PostgreSQL.  pg_isready alone can therefore produce a race.
        # Require the second "ready" lifecycle message and a real SQL roundtrip.
        for _ in range(80):
            logs = run_command(["docker", "logs", container], timeout=5)
            lifecycle = logs.stdout + logs.stderr
            probe = run_command(
                [
                    "docker",
                    "exec",
                    container,
                    "psql",
                    "-X",
                    "-At",
                    "-U",
                    "postgres",
                    "-c",
                    "SELECT 1;",
                ],
                timeout=5,
            )
            if (
                lifecycle.count("database system is ready to accept connections") >= 2
                and probe.returncode == 0
                and probe.stdout.strip() == "1"
            ):
                ready = True
                break
            time.sleep(0.25)
        checks += 1
        if not ready:
            errors.append("docker PostgreSQL did not become ready")
            return errors, checks, {"executed": False}

        version = run_command(
            [
                "docker",
                "exec",
                container,
                "psql",
                "-X",
                "-At",
                "-U",
                "postgres",
                "-c",
                "SHOW server_version;",
            ],
            timeout=15,
        )
        checks += 1
        server_version = version.stdout.strip()
        if version.returncode != 0 or not server_version.startswith("16."):
            errors.append(f"expected PostgreSQL 16, got {server_version or version.stderr.strip()}")

        databases = {
            "people": "people_service",
            "time": "time_service",
            "payroll": "payroll_service",
        }
        for database in databases.values():
            created = run_command(
                ["docker", "exec", container, "createdb", "-U", "postgres", database],
                timeout=20,
            )
            checks += 1
            if created.returncode != 0:
                errors.append(f"{database}: empty database create failed: {created.stderr.strip()}")
        if errors:
            return errors, checks, {"executed": True, "image": "postgres:16-alpine"}

        baseline_paths = [f"/people-migrations/{name}" for name, _ in migrations]
        ok, failure = execute_psql_script(
            container,
            databases["people"],
            psql_transaction_script(baseline_paths),
            timeout=240,
        )
        checks += 1
        if not ok:
            errors.append(f"People V1..V46 execution failed: {failure}")
            return errors, checks, {"executed": True, "image": "postgres:16-alpine"}

        baseline_names = schema_table_names(container, databases["people"], "public")
        baseline_stats = inspect_table_set(
            container,
            databases["people"],
            "public",
            BASELINE_PUBLIC_TABLES,
        )
        checks += 2
        if baseline_names != BASELINE_PUBLIC_TABLES:
            errors.append(
                "People V1..V46 PostgreSQL table set drift "
                f"missing={sorted(BASELINE_PUBLIC_TABLES - baseline_names)} "
                f"unexpected={sorted(baseline_names - BASELINE_PUBLIC_TABLES)}"
            )
        checks += validate_postgres_stats(
            "People V1..V46",
            baseline_stats,
            EXPECTED_BASELINE_POSTGRES_STATS,
            BASELINE_PUBLIC_TABLES,
            errors,
        )

        hrm_path = "/blueprint/session-evidence/hrm/g2-readiness/physical-schema-blueprint.sql"
        ok, failure = execute_psql_script(
            container,
            databases["people"],
            psql_transaction_script([hrm_path]),
            timeout=120,
        )
        checks += 1
        if not ok:
            errors.append(f"HRM DDL after People V46 failed: {failure}")
            return errors, checks, {"executed": True, "image": "postgres:16-alpine"}
        people_after_hrm = schema_table_names(container, databases["people"], "public")
        checks += 1
        if people_after_hrm != BASELINE_PUBLIC_TABLES | HRM_TABLES:
            errors.append("HRM DDL did not add exactly 24 owner tables to People baseline")

        augmentation = query_json(
            container,
            databases["people"],
            "SELECT json_build_object("
            "'indexes',(SELECT COALESCE(json_agg(indexname ORDER BY indexname),'[]'::json) "
            "FROM pg_indexes WHERE schemaname='public' AND indexname IN ("
            + ",".join(f"'{name}'" for name in sorted(HRM_BASELINE_INDEXES))
            + ")),"
            "'exclusions',(SELECT COALESCE(json_agg(c.conname ORDER BY c.conname),'[]'::json) "
            "FROM pg_constraint c JOIN pg_class r ON r.oid=c.conrelid "
            "JOIN pg_namespace n ON n.oid=r.relnamespace "
            "WHERE n.nspname='public' AND c.contype='x' AND c.conname IN ("
            + ",".join(f"'{name}'" for name in sorted(HRM_BASELINE_EXCLUSIONS))
            + ")));",
        )
        checks += 2
        actual_augmentation_indexes = {
            str(value) for value in augmentation.get("indexes", [])
        }
        actual_augmentation_exclusions = {
            str(value) for value in augmentation.get("exclusions", [])
        }
        if actual_augmentation_indexes != HRM_BASELINE_INDEXES:
            errors.append("HRM: PostgreSQL baseline index augmentation is incomplete")
        if actual_augmentation_exclusions != HRM_BASELINE_EXCLUSIONS:
            errors.append("HRM: PostgreSQL baseline exclusion augmentation is incomplete")

        per_path = "/blueprint/session-evidence/per/g2-readiness/physical-schema.sql"
        ok, failure = execute_psql_script(
            container,
            databases["people"],
            psql_transaction_script([per_path]),
            timeout=120,
        )
        checks += 1
        if not ok:
            errors.append(f"PER DDL after HRM failed: {failure}")
            return errors, checks, {"executed": True, "image": "postgres:16-alpine"}

        tim_path = "/blueprint/session-evidence/tim/g2-physical-schema.sql"
        pay_path = "/blueprint/session-evidence/pay/g2-physical-schema.sql"
        for module, database, path in (
            ("TIM", databases["time"], tim_path),
            ("PAY", databases["payroll"], pay_path),
        ):
            ok, failure = execute_psql_script(
                container,
                database,
                psql_transaction_script([path]),
                timeout=120,
            )
            checks += 1
            if not ok:
                errors.append(f"{module} DDL in independent empty DB failed: {failure}")

        if errors:
            return errors, checks, {"executed": True, "image": "postgres:16-alpine"}

        module_results: dict[str, Any] = {}
        locations = {
            "HRM": (databases["people"], "public"),
            "PER": (databases["people"], "hris_performance"),
            "TIM": (databases["time"], "public"),
            "PAY": (databases["payroll"], "public"),
        }
        for module, (database, schema) in locations.items():
            actual = inspect_table_set(
                container,
                database,
                schema,
                MODULE_TABLES[module],
            )
            checks += validate_postgres_stats(
                module,
                actual,
                EXPECTED_POSTGRES_STATS[module],
                MODULE_TABLES[module],
                errors,
            )
            actual.pop("tableNames", None)
            actual.pop("policyNames", None)
            module_results[module] = {
                "database": database,
                "schema": schema,
                **actual,
            }

        checks += 4
        time_names = schema_table_names(container, databases["time"], "public")
        pay_names = schema_table_names(container, databases["payroll"], "public")
        per_names = schema_table_names(
            container, databases["people"], "hris_performance"
        )
        people_public_final = schema_table_names(
            container, databases["people"], "public"
        )
        if time_names != TIM_TABLES:
            errors.append("TIM independent database contains an unexpected public table")
        if pay_names != PAY_TABLES:
            errors.append("PAY independent database contains an unexpected public table")
        if per_names != PER_TABLES:
            errors.append("PER schema contains an unexpected table")
        if people_public_final != BASELINE_PUBLIC_TABLES | HRM_TABLES:
            errors.append("PER execution changed the People/HRM public table boundary")

        extension_expectations = {
            databases["people"]: {"plpgsql", "btree_gist", "pgcrypto"},
            databases["time"]: {"plpgsql", "btree_gist"},
            databases["payroll"]: {"plpgsql", "btree_gist"},
        }
        extensions: dict[str, list[str]] = {}
        for database, expected in extension_expectations.items():
            payload = query_json(
                container,
                database,
                "SELECT COALESCE(json_agg(extname ORDER BY extname),'[]'::json) FROM pg_extension;",
            )
            actual = {str(value) for value in payload}
            extensions[database] = sorted(actual)
            checks += 1
            if actual != expected:
                errors.append(
                    f"{database}: extension set expected={sorted(expected)} actual={sorted(actual)}"
                )

        result = {
            "executed": True,
            "image": "postgres:16-alpine",
            "serverVersion": server_version,
            "databaseIsolation": {
                "people": databases["people"],
                "time": databases["time"],
                "payroll": databases["payroll"],
            },
            "peopleExecutionOrder": ["V1..V46", "HRM", "PER"],
            "peopleBaselineTransactions": 46,
            "peopleTotalTransactions": 48,
            "baseline": {
                **{
                    key: value
                    for key, value in baseline_stats.items()
                    if key not in {"tableNames", "policyNames"}
                },
                "tableSetSha256": digest_lines(baseline_names),
            },
            "hrmBaselineAugmentations": {
                "indexes": sorted(actual_augmentation_indexes),
                "exclusions": sorted(actual_augmentation_exclusions),
            },
            "modules": module_results,
            "extensions": extensions,
        }
        return errors, checks, result
    except (OSError, subprocess.TimeoutExpired, RuntimeError, json.JSONDecodeError) as error:
        errors.append(f"PostgreSQL feasibility inspection failed: {error}")
        return errors, checks, {"executed": True, "image": "postgres:16-alpine"}
    finally:
        try:
            run_command(["docker", "rm", "-f", container], timeout=20)
        except (OSError, subprocess.TimeoutExpired):
            pass


def run_self_tests(
    migrations: list[tuple[str, str]],
    module_sql: dict[str, str],
) -> tuple[list[str], list[dict[str, Any]]]:
    failures: list[str] = []
    cases: list[dict[str, Any]] = []

    mutations: list[tuple[str, list[tuple[str, str]], dict[str, str]]] = []
    mutations.append(("people-migration-gap", migrations[:-1], deepcopy(module_sql)))

    v7_drift = list(migrations)
    for index, (name, sql) in enumerate(v7_drift):
        if name.startswith("V7__"):
            v7_drift[index] = (name, sql.replace("ON COMMIT DROP", "", 1))
            break
    mutations.append(("people-v7-transaction-semantics-drift", v7_drift, deepcopy(module_sql)))

    hrm_drift = deepcopy(module_sql)
    hrm_drift["HRM"] = hrm_drift["HRM"].replace(
        "CREATE TABLE ppl_legal_entity_registrations",
        "CREATE TABLE ppl_legal_entity_registrationz",
        1,
    )
    mutations.append(("hrm-owner-table-set-drift", list(migrations), hrm_drift))

    per_drift = deepcopy(module_sql)
    per_drift["PER"] = per_drift["PER"].replace(
        "SET search_path TO hris_performance, public",
        "SET search_path TO public",
        1,
    )
    mutations.append(("per-schema-boundary-drift", list(migrations), per_drift))

    tim_drift = deepcopy(module_sql)
    tim_drift["TIM"] = tim_drift["TIM"].replace(
        "    'tme_worker_projections',",
        "",
        1,
    )
    mutations.append(("tim-rls-coverage-drift", list(migrations), tim_drift))

    pay_drift = deepcopy(module_sql)
    pay_drift["PAY"] = pay_drift["PAY"].replace(
        "REFERENCES pay_payroll_runs (tenant_id, payroll_run_id)",
        "REFERENCES ppl_persons (tenant_id, person_id)",
        1,
    )
    mutations.append(("pay-cross-owner-fk-drift", list(migrations), pay_drift))

    tim_clock_idempotency_drift = deepcopy(module_sql)
    tim_clock_idempotency_drift["TIM"] = tim_clock_idempotency_drift["TIM"].replace(
        "uk_tme_clock_source_event UNIQUE (tenant_id, source_public_id, source_event_key)",
        "uk_tme_clock_source_event UNIQUE (tenant_id, source_public_id, source_event_key, occurred_at)",
        1,
    )
    mutations.append(
        ("tim-clock-idempotency-timestamp-drift", list(migrations), tim_clock_idempotency_drift)
    )

    tim_outbox_seal_drift = deepcopy(module_sql)
    tim_outbox_seal_drift["TIM"] = tim_outbox_seal_drift["TIM"].replace(
        "TIME_OUTBOX_EVENT_ENVELOPE_IMMUTABLE",
        "TIME_OUTBOX_EVENT_ENVELOPE_MUTABLE",
        1,
    )
    mutations.append(
        ("tim-unpublished-outbox-seal-drift", list(migrations), tim_outbox_seal_drift)
    )

    pay_worker_result_idempotency_drift = deepcopy(module_sql)
    pay_worker_result_idempotency_drift["PAY"] = pay_worker_result_idempotency_drift["PAY"].replace(
        "uk_pay_worker_result_attempt UNIQUE (tenant_id, payroll_run_attempt_id, worker_public_id)",
        "uk_pay_worker_result_attempt UNIQUE (tenant_id, payroll_run_attempt_id, worker_public_id, posted_at)",
        1,
    )
    mutations.append(
        ("pay-worker-result-idempotency-timestamp-drift", list(migrations), pay_worker_result_idempotency_drift)
    )

    pay_rounding_overlap_drift = deepcopy(module_sql)
    pay_rounding_overlap_drift["PAY"] = pay_rounding_overlap_drift["PAY"].replace(
        "ex_pay_rounding_overlap",
        "ex_pay_rounding_overlap_removed",
        1,
    )
    mutations.append(
        ("pay-rounding-effective-overlap-drift", list(migrations), pay_rounding_overlap_drift)
    )

    pay_lineage_drift = deepcopy(module_sql)
    pay_lineage_drift["PAY"] = pay_lineage_drift["PAY"].replace(
        "fk_pay_payment_instruction_result",
        "fk_pay_payment_instruction_result_removed",
        1,
    )
    mutations.append(("pay-payment-result-lineage-drift", list(migrations), pay_lineage_drift))

    pay_outbox_seal_drift = deepcopy(module_sql)
    pay_outbox_seal_drift["PAY"] = pay_outbox_seal_drift["PAY"].replace(
        "PAYROLL_OUTBOX_ENVELOPE_IMMUTABLE",
        "PAYROLL_OUTBOX_ENVELOPE_MUTABLE",
        1,
    )
    mutations.append(("pay-unpublished-outbox-seal-drift", list(migrations), pay_outbox_seal_drift))

    check_drift = deepcopy(module_sql)
    check_drift["HRM"] = check_drift["HRM"].replace(" CHECK (", " (", 1)
    mutations.append(("constraint-count-drift", list(migrations), check_drift))

    for name, mutated_migrations, mutated_sql in mutations:
        mutation_errors, _, _ = validate_static(mutated_migrations, mutated_sql)
        passed = bool(mutation_errors)
        cases.append(
            {
                "name": name,
                "status": "PASS" if passed else "FAIL",
                "rejectedErrorCount": len(mutation_errors),
            }
        )
        if not passed:
            failures.append(f"self-test mutation was not rejected: {name}")
    return failures, cases


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--docker-postgres", action="store_true")
    parser.add_argument("--compact", action="store_true")
    args = parser.parse_args()

    if args.self_test and args.docker_postgres:
        payload = {
            "schema": "dwp.hris.base-schema-postgres-feasibility.v1",
            "status": "FAIL",
            "errors": ["--self-test and --docker-postgres are separate evidence modes"],
        }
        print(json.dumps(payload, sort_keys=True))
        return 1

    migrations, module_sql, load_errors = load_inputs()
    static_errors, checks, details = validate_static(migrations, module_sql)
    errors = [*load_errors, *static_errors]

    cases: list[dict[str, Any]] = []
    if args.self_test and not errors:
        self_test_errors, cases = run_self_tests(migrations, module_sql)
        errors.extend(self_test_errors)
        checks += len(cases)

    postgres_result: dict[str, Any] = {"executed": False}
    if args.docker_postgres and not errors:
        docker_errors, docker_checks, postgres_result = validate_with_docker(migrations)
        errors.extend(docker_errors)
        checks += docker_checks

    migration_chain_digest = hashlib.sha256()
    for filename, sql in migrations:
        migration_chain_digest.update(filename.encode("utf-8"))
        migration_chain_digest.update(b"\0")
        migration_chain_digest.update(hashlib.sha256(sql.encode("utf-8")).digest())
    input_digests = {
        "peopleV1ToV46ContentChainSha256": migration_chain_digest.hexdigest(),
        "moduleDdlSha256": {
            module: sha256(path)
            for module, path in DDL_PATHS.items()
            if path.is_file()
        },
    }
    payload = {
        "schema": "dwp.hris.base-schema-postgres-feasibility.v1",
        "mode": (
            "self-test"
            if args.self_test
            else "postgres16"
            if args.docker_postgres
            else "static"
        ),
        "status": "PASS" if not errors else "FAIL",
        "checks": checks,
        "selfTests": len(cases),
        "selfTestCases": cases,
        **details,
        "postgresExecution": postgres_result,
        "inputDigests": input_digests,
        "errors": errors,
    }
    print(
        json.dumps(payload, ensure_ascii=False, sort_keys=True)
        if args.compact
        else json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True)
    )
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
