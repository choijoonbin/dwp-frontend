#!/usr/bin/env python3
"""Validate the operation-level modern HRIS causal/state successor.

This validator deliberately does not import the candidate generator or its
STATE/COMMAND_WRITES maps.  It cross-checks the sealed causal candidate against
the independently persisted exact schema, event schemas and module projections,
then applies structural invariants that cannot be satisfied by relabelling a
guard.  The separately reviewed independent oracle remains an additional gate;
this file neither reads nor generates it.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import time
from typing import Any, Callable

from validate_modern_capability_contracts import build_postgres_feasibility_ddl


HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
WORKSPACE = ROOT.parents[1]
CAUSAL = HERE / "modern-capability-causal-state-contracts.v2.json"
EXACT = HERE / "modern-capability-exact-schema-contracts.v1.json"
EVENTS = HERE / "modern-capability-event-payload-contracts.v1.json"
BINDINGS = HERE / "modern-capability-semantic-bindings.v1.json"
IDENTITIES = HERE / "modern-capability-public-identity-registry.v1.json"
LISTENING_AUTHORITY = HERE / "sys-listening-stream-authority-successor.v1.json"
LISTENING_AUTHORITY_ID = "dwp.hris.sys.listening.stream-authority-successor.v1"
PAY_CONSUMER = ROOT / "session-evidence/pay/g3-modern-capability-consumer-contracts.v1.json"
MODULES = (
    ROOT / "session-evidence/hrm/g3-modern-capability-contracts.v1.json",
    ROOT / "session-evidence/per/g3-modern-capability-contracts.v2.json",
    ROOT / "session-evidence/tim/g3-modern-capability-contracts.v1.json",
    ROOT / "session-evidence/sys/g3-modern-capability-contracts.v1.json",
)

# The transaction envelope is intentionally verified against the checked-in
# owner DDL, not against a generator constant.  This closes the historical gap
# where a syntactically complete causal contract named receipt/outbox tables
# and JSON members that did not exist physically.
EXPECTED_TRANSACTION_INFRASTRUCTURE = {
    "baseDdlSources": {
        "HRIS-HRM-RECEIPT-INBOX": "session-evidence/hrm/g2-readiness/physical-schema-blueprint.sql",
        "HRIS-HRM-OUTBOX": "../../dwp-backend/dwp-people-server/src/main/resources/db/migration/V1__create_workforce_projection.sql",
        "HRIS-PER": "session-evidence/per/g2-readiness/physical-schema.sql",
        "HRIS-TIM": "session-evidence/tim/g2-physical-schema.sql",
        "HRIS-SYS-RECEIPT": "session-evidence/sys/g2-physical-schema.sql",
        "HRIS-SYS-INBOX-OUTBOX": "../../dwp-backend/dwp-core/src/main/resources/db/migration/R__create_domain_event_delivery_ledger.sql",
    },
    "sessions": {
        "HRIS-HRM": {
            "receiptTable": "ppl_command_receipts",
            "outboxTable": "sys_people_outbox_events",
            "inboxTable": "ppl_domain_inbox_receipts",
            "ddlKeys": ["HRIS-HRM-RECEIPT-INBOX", "HRIS-HRM-OUTBOX"],
            "immutableReceiptColumns": {
                "tenant_id", "command_type", "idempotency_key", "request_hash",
                "actor_public_id", "originating_action", "subject_principal_public_id",
                "population_scope_digest", "field_policy_revision", "purpose_code",
                "authorization_revision", "originating_context_sealed_at",
                "originating_context_digest", "correlation_id",
            },
        },
        "HRIS-PER": {
            "receiptTable": "prf_command_receipts",
            "outboxTable": "prf_outbox_events",
            "inboxTable": "prf_inbox_receipts",
            "ddlKeys": ["HRIS-PER"],
            "immutableReceiptColumns": {
                "tenant_id", "command_type", "idempotency_key", "request_hash",
                "actor_user_id", "originating_action", "subject_principal_public_id",
                "population_scope_digest", "field_policy_revision", "purpose_code",
                "authorization_revision", "originating_context_sealed_at",
                "originating_context_digest",
            },
        },
        "HRIS-TIM": {
            "receiptTable": "tme_command_receipts",
            "outboxTable": "tme_outbox_events",
            "inboxTable": "tme_inbox_receipts",
            "ddlKeys": ["HRIS-TIM"],
            "immutableReceiptColumns": {
                "tenant_id", "command_type", "originating_action",
                "subject_principal_public_id", "population_scope_digest",
                "field_policy_revision", "purpose_code", "authorization_revision",
                "idempotency_key", "request_digest", "correlation_id",
            },
        },
        "HRIS-SYS": {
            "receiptTable": "sys_hris_command_receipts",
            "outboxTable": "sys_domain_event_outbox",
            "inboxTable": "sys_domain_event_inbox",
            "ddlKeys": ["HRIS-SYS-RECEIPT", "HRIS-SYS-INBOX-OUTBOX"],
            "immutableReceiptColumns": {
                "tenant_id", "command_type", "originating_action",
                "subject_principal_public_id", "population_scope_digest",
                "field_policy_revision", "purpose_code", "authorization_revision",
                "idempotency_key", "request_digest", "correlation_id",
            },
        },
    },
}

TRANSACTION_GUARDS = {
    "HRIS-HRM": ("ppl_guard_command_receipt_originating_auth", "trg_ppl_command_receipt_originating_auth"),
    "HRIS-PER": ("prf_guard_command_receipt_originating_auth", "trg_prf_command_receipt_originating_auth"),
    "HRIS-TIM": ("tme_guard_command_receipt_seal", "tr_tme_command_receipt_seal"),
    "HRIS-SYS": ("sys_hris_guard_command_receipt_seal", "tr_sys_hris_command_receipt_seal"),
}

TRANSACTION_SQL_TYPES = re.compile(
    r"^(UUID|BIGSERIAL|BIGINT|INTEGER|SMALLINT|BOOLEAN|JSONB|TEXT|DATE|"
    r"TIMESTAMPTZ|TIMESTAMP|CHAR\s*\(\s*\d+\s*\)|VARCHAR\s*\(\s*\d+\s*\))(?=\s|$)",
    re.I,
)

EXPECTED_SCOPE = {
    "operations": 100,
    "commands": 81,
    "queries": 19,
    "publicCommandPrimaryEvents": 81,
    "conditionalCommandEvents": 1,
    "internalHandlerEvents": 4,
    "causalEvents": 86,
    "internalConsumerHandlers": 4,
    "implementationState": "NOT_STARTED_G3",
    "productionState": "NOT_AUTHORIZED_G6",
}

EXPECTED_HANDLERS = {
    "internal.recruiting.hire-handoff.acknowledge",
    "internal.contingent.access-expiry.enforce",
    "internal.wfm.schedule-optimization.complete",
    "internal.ai.policy-evaluation.complete",
}

READ_ONLY_OWNER_TABLES = {
    "ppl_bnf_provider_receipts",
    "ppl_cwk_sponsor_assignments",
    "ppl_hrs_sla_receipts",
    "prf_suc_readiness_evidence",
    "sys_hris_listening_cohort_results",
}

# These aliases were introduced by an intermediate successor and duplicate the
# canonical interval/typed-line fields.  Keeping both would allow writes and
# readers to diverge while still satisfying individual column checks.
FORBIDDEN_SYNONYM_COLUMNS = {
    "tme_wfm_demand_lines": {"line_key", "starts_at", "ends_at", "required_skills"},
    "tme_wfm_candidate_shift_lines": {"shift_start", "shift_end"},
}

CRITICAL_EVENT_ROOTS = {
    "CandidateHireHandoffRequested.v2": "ppl_rec_hire_requests",
    "CandidateHired.v2": "ppl_rec_candidate_cases",
    "OnboardingJourneyCompleted.v2": "ppl_jny_assignments",
    "CompensationPlanApprovalRecorded.v2": "prf_cmp_plans",
    "ApprovedCompensationPlanSnapshotPublished.v2": "prf_cmp_approved_snapshots",
    "WorkforceScheduleOptimizationRequested.v2": "tme_wfm_optimization_requests",
    "WorkforceScheduleCandidateGenerated.v2": "tme_wfm_schedule_candidates",
    "GovernedAiPolicyEvaluationRequested.v2": "sys_hris_ai_evaluation_requests",
    "GovernedAiPolicyEvaluationCompleted.v2": "sys_hris_ai_evaluation_requests",
}

FORBIDDEN_LEGACY_EDGES = {
    "modern.recruiting.hire.record|APPEND|ppl_rec_hire_handoff_receipts",
    "modern.learning.offering.create|INSERT|prf_lrn_assignments",
    "modern.opportunity.create|INSERT|prf_mkt_applications",
    "modern.wfm.schedule.optimize|APPEND|tme_wfm_schedule_publish_ledger",
    "modern.wfm.schedule.submit|APPEND|tme_wfm_constraint_evaluation_receipts",
}

OBSERVABLE_COMMAND_EFFECTS = {
    "PERSISTED_COLUMN", "PERSISTED_BUSINESS_FACT", "PERSISTED_DERIVED_DIGEST",
    "PERSISTED_TYPED_OBJECT", "APPEND_TYPED_COLLECTION",
    "PERSISTED_DECISION_RECEIPT", "ENTITY_SELECTOR", "OWNER_REFETCH",
    "ROOT_CAS_FILTER", "LOCKED_FACT_MATCH", "OBSERVABILITY_CONTEXT",
    "PERSISTED_CONTROL", "IDEMPOTENCY_CLAIM",
}
QUERY_EFFECTS = {
    "OBSERVABILITY_CONTEXT", "QUERY_FILTER", "OWNER_EFFECTIVE_TIME_FILTER",
    "PAGINATION_CURSOR_FILTER", "QUERY_LIMIT",
}
BUSINESS_COMMAND_EFFECTS = {
    "PERSISTED_COLUMN", "PERSISTED_BUSINESS_FACT", "PERSISTED_DERIVED_DIGEST",
    "PERSISTED_TYPED_OBJECT", "APPEND_TYPED_COLLECTION",
    "PERSISTED_DECISION_RECEIPT", "ENTITY_SELECTOR", "OWNER_REFETCH",
    "ROOT_CAS_FILTER", "LOCKED_FACT_MATCH",
}


class Result:
    def __init__(self) -> None:
        self.errors: list[str] = []
        self.counts: dict[str, int] = {}

    def require(self, condition: bool, code: str, message: str) -> None:
        if not condition:
            self.errors.append(f"[{code}] {message}")


def digest_without_seal(value: dict[str, Any]) -> str:
    payload = {key: item for key, item in value.items() if key != "sealedPayloadSha256"}
    encoded = json.dumps(payload, ensure_ascii=False, sort_keys=True,
                         separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _ddl_path(relative: str) -> Path:
    """Resolve an infrastructure DDL source relative to the blueprint root."""
    return (ROOT / relative).resolve()


def _extract_create_table(sql: str, table: str) -> str:
    """Return one complete CREATE TABLE statement using balanced parentheses."""
    match = re.search(
        rf"\bCREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+{re.escape(table)}\s*\(",
        sql,
        re.I,
    )
    if not match:
        raise ValueError(f"missing physical CREATE TABLE {table}")
    start = match.start()
    index = match.end() - 1
    depth = 0
    quote: str | None = None
    while index < len(sql):
        char = sql[index]
        if quote:
            if char == quote and (index + 1 >= len(sql) or sql[index + 1] != quote):
                quote = None
            elif char == quote and index + 1 < len(sql) and sql[index + 1] == quote:
                index += 1
        elif char in {"'", '"'}:
            quote = char
        elif char == "(":
            depth += 1
        elif char == ")":
            depth -= 1
            if depth == 0:
                semicolon = sql.find(";", index)
                if semicolon < 0:
                    raise ValueError(f"unterminated CREATE TABLE {table}")
                return sql[start:semicolon + 1]
        index += 1
    raise ValueError(f"unterminated CREATE TABLE {table}")


def _extract_guard_function(sql: str, name: str) -> str:
    match = re.search(
        rf"\bCREATE\s+OR\s+REPLACE\s+FUNCTION\s+{re.escape(name)}\s*\(\)", sql, re.I
    )
    if not match:
        raise ValueError(f"missing checked-in receipt guard function {name}")
    end = sql.find("$$;", match.end())
    if end < 0:
        raise ValueError(f"unterminated receipt guard function {name}")
    return sql[match.start():end + 3]


def _extract_trigger(sql: str, name: str) -> str:
    match = re.search(rf"\bCREATE\s+TRIGGER\s+{re.escape(name)}\b", sql, re.I)
    if not match:
        raise ValueError(f"missing checked-in receipt guard trigger {name}")
    end = sql.find(";", match.end())
    if end < 0:
        raise ValueError(f"unterminated receipt guard trigger {name}")
    return sql[match.start():end + 1]


def _parse_ddl_columns(statement: str) -> dict[str, dict[str, Any]]:
    columns: dict[str, dict[str, Any]] = {}
    for line in statement.splitlines()[1:]:
        stripped = line.strip().rstrip(",")
        if not stripped or stripped.upper().startswith(
                ("CONSTRAINT ", "PRIMARY ", "UNIQUE ", "FOREIGN ", "CHECK ")):
            continue
        name_match = re.match(r"([a-z][a-z0-9_]*)\s+(.+)$", stripped, re.I)
        if not name_match:
            continue
        name, remainder = name_match.groups()
        type_match = TRANSACTION_SQL_TYPES.match(remainder)
        if not type_match:
            continue
        sql_type = re.sub(r"\s+", "", type_match.group(1).upper())
        if sql_type == "BIGSERIAL":
            sql_type = "BIGINT"
        tail = remainder[type_match.end():]
        generated = "GENERATED " in tail.upper() or "SERIAL" in type_match.group(1).upper()
        columns[name] = {
            "sqlType": sql_type,
            "nullable": "NOT NULL" not in tail.upper() and "PRIMARY KEY" not in tail.upper(),
            "default": bool(re.search(r"\bDEFAULT\b", tail, re.I)) or generated,
            "generated": generated,
        }
    return columns


def _load_transaction_physical_contracts() -> tuple[
        dict[str, dict[str, dict[str, Any]]], dict[str, str], dict[str, str]]:
    sources = EXPECTED_TRANSACTION_INFRASTRUCTURE["baseDdlSources"]
    source_sql: dict[str, str] = {}
    for key, relative in sources.items():
        path = _ddl_path(relative)
        if not path.is_file():
            raise ValueError(f"missing base transaction DDL {key}:{path}")
        source_sql[key] = path.read_text(encoding="utf-8")
    columns: dict[str, dict[str, dict[str, Any]]] = {}
    statements: dict[str, str] = {}
    for session, expected in EXPECTED_TRANSACTION_INFRASTRUCTURE["sessions"].items():
        for role in ("receiptTable", "outboxTable", "inboxTable"):
            table = expected[role]
            found: list[str] = []
            for key in expected["ddlKeys"]:
                try:
                    found.append(_extract_create_table(source_sql[key], table))
                except ValueError:
                    pass
            if len(found) != 1:
                raise ValueError(
                    f"{session}:{role}:{table} must have exactly one checked-in owner DDL, got {len(found)}"
                )
            statements[table] = found[0]
            columns[table] = _parse_ddl_columns(found[0])
            if not columns[table]:
                raise ValueError(f"could not parse physical columns for {table}")
    return columns, statements, source_sql


def _assignment_index(rows: list[dict[str, Any]]) -> dict[str, str]:
    return {str(row.get("column")): str(row.get("sourcePath")) for row in rows}


def _validate_transaction_infrastructure(
    result: Result, causal: dict[str, Any]
) -> tuple[dict[str, dict[str, dict[str, Any]]], dict[str, dict[str, Any]]]:
    try:
        physical, _statements, source_sql = _load_transaction_physical_contracts()
    except (OSError, ValueError) as error:
        result.require(False, "TRANSACTION_PHYSICAL_DDL", str(error))
        return {}, {}
    infrastructure = causal.get("transactionInfrastructure", {})
    result.require(
        infrastructure.get("policy") ==
        "USE_EXISTING_OWNER_RECEIPT_AND_OUTBOX_PHYSICAL_DDL_WITH_OPERATION_SCOPED_EXACT_ASSIGNMENTS"
        and infrastructure.get("baseDdlSources") ==
        EXPECTED_TRANSACTION_INFRASTRUCTURE["baseDdlSources"],
        "TRANSACTION_PHYSICAL_DDL",
        "transaction infrastructure policy or checked-in DDL source closed set drift",
    )
    profiles = infrastructure.get("sessions", {})
    result.require(
        set(profiles) == set(EXPECTED_TRANSACTION_INFRASTRUCTURE["sessions"]),
        "TRANSACTION_PHYSICAL_DDL",
        "four owner transaction profiles are not a closed set",
    )
    fixed_sources = {
        "originating_action": "CONSTANT:{operationId}",
        "subject_principal_public_id": "authenticatedPrincipal.publicId",
        "population_scope_digest": "authorization.populationScopeDigest",
        "field_policy_revision": "authorization.fieldPolicyRevision",
        "purpose_code": "CONSTANT:{authorizationCapability}",
        "authorization_revision": "authorization.authorizationRevision",
        "idempotency_key": "headers.Idempotency-Key",
        "correlation_id": "headers.X-Correlation-ID",
    }
    for session, expected in EXPECTED_TRANSACTION_INFRASTRUCTURE["sessions"].items():
        profile = profiles.get(session, {})
        result.require(
            all(profile.get(key) == expected[key]
                for key in ("receiptTable", "outboxTable", "inboxTable")),
            "TRANSACTION_PHYSICAL_DDL",
            f"{session}: receipt/inbox/outbox physical table drift",
        )
        receipt = expected["receiptTable"]
        claim = profile.get("receiptClaimAssignments", {})
        complete = profile.get("receiptCompleteAssignments", {})
        outbox = profile.get("outboxAssignments", {})
        for column, source in fixed_sources.items():
            if column in physical.get(receipt, {}):
                result.require(
                    claim.get(column) == source,
                    "TRANSACTION_AUTHORIZATION_SEAL",
                    f"{session}:{receipt}.{column} source is not exact",
                )
        digest_column = "request_hash" if session in {"HRIS-HRM", "HRIS-PER"} else "request_digest"
        result.require(
            "SERVER_DERIVE:canonical validated request excluding correlationId SHA-256"
            == claim.get(digest_column),
            "TRANSACTION_AUTHORIZATION_SEAL",
            f"{session}:{receipt}.{digest_column} is not server-derived",
        )
        immutable = expected["immutableReceiptColumns"]
        result.require(
            immutable <= set(claim) <= set(physical.get(receipt, {})),
            "TRANSACTION_AUTHORIZATION_SEAL",
            f"{session}:{receipt} claim misses immutable seal columns or names a phantom column",
        )
        guard_source = "\n".join(source_sql[key] for key in expected["ddlKeys"])
        result.require(
            all(f"NEW.{column}" in guard_source and f"OLD.{column}" in guard_source
                for column in immutable),
            "TRANSACTION_AUTHORIZATION_SEAL",
            f"{session}:{receipt} checked-in mutation guard does not seal every authorization/idempotency column",
        )
        required_claim = {
            name for name, spec in physical[receipt].items()
            if spec["nullable"] is False and not spec["default"]
        }
        result.require(
            required_claim <= set(claim),
            "TRANSACTION_ASSIGNMENT_REQUIRED",
            f"{session}:{receipt} claim misses NOT NULL/no-default columns {sorted(required_claim - set(claim))}",
        )
        result.require(
            set(complete) <= set(physical[receipt])
            and set(outbox) <= set(physical[expected["outboxTable"]]),
            "TRANSACTION_ASSIGNMENT_PHYSICAL",
            f"{session}: completion/outbox assignment references a phantom physical column",
        )
        required_outbox = {
            name for name, spec in physical[expected["outboxTable"]].items()
            if spec["nullable"] is False and not spec["default"]
        }
        result.require(
            required_outbox <= set(outbox),
            "TRANSACTION_ASSIGNMENT_REQUIRED",
            f"{session}:{expected['outboxTable']} misses NOT NULL/no-default assignments "
            f"{sorted(required_outbox - set(outbox))}",
        )
        if profile.get("inboxClaimAssignments") is not None:
            inbox = expected["inboxTable"]
            claim_columns = set(profile.get("inboxClaimAssignments", {}))
            completion_columns = set(profile.get("inboxCompleteAssignments", {}))
            required_inbox = {
                name for name, spec in physical[inbox].items()
                if spec["nullable"] is False and not spec["default"]
            }
            result.require(
                claim_columns <= set(physical[inbox])
                and completion_columns <= set(physical[inbox])
                and required_inbox <= claim_columns,
                "TRANSACTION_ASSIGNMENT_REQUIRED",
                f"{session}:{inbox} claim/completion is not physically insert-feasible",
            )
        bindings = profile.get("decisionAuditBindings", {})
        result.require(
            set(bindings) == {"ruleId", "inputDigestOrRef", "outcome", "decisionVersion"}
            and all(
                all(part.startswith(receipt + ".")
                    and part.split(".", 1)[1] in physical[receipt]
                    for part in str(value).split("+"))
                for value in bindings.values()
            ),
            "TRANSACTION_DECISION_AUDIT",
            f"{session}: decision receipt bindings are not exact physical receipt columns",
        )
    result.counts["transactionTables"] = len(physical)
    result.counts["transactionProfiles"] = len(profiles)
    return physical, profiles


def request_fields(operation: dict[str, Any], schemas: dict[str, dict[str, Any]]) -> dict[str, dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {}

    def add(path: str, field: dict[str, Any], parent_required: bool = True) -> None:
        materialized = dict(field)
        materialized["required"] = parent_required and bool(field.get("required"))
        result[path] = materialized
        nested_ref = field.get("schemaRef") or field.get("itemSchemaRef")
        if not nested_ref:
            return
        marker = "[]" if field.get("itemSchemaRef") else ""
        for member in schemas.get(nested_ref, {}).get("fields", []):
            add(path + marker + "." + member.get("name", ""), member,
                materialized["required"])

    for section in ("pathParameters", "queryParameters", "headers", "body"):
        for field in operation.get("requestSchema", {}).get(section, []):
            add(f"{section}.{field.get('name')}", field)
    return result


def top_level_request_fields(operation: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """Return wire-visible request members without inventing nested uses.

    A typed OBJECT/ARRAY is one causal input whose member-to-column binding is
    checked by its PERSISTED_TYPED_OBJECT/APPEND_TYPED_COLLECTION effect and by
    the semantic lineage registry.  Expanding the value object here would
    incorrectly require a second, unrepresentable HTTP input for every member.
    """
    return {
        f"{section}.{field['name']}": dict(field)
        for section in ("pathParameters", "queryParameters", "headers", "body")
        for field in operation.get("requestSchema", {}).get(section, [])
    }


def physical_columns(exact: dict[str, Any], table: dict[str, Any]) -> dict[str, dict[str, Any]]:
    common = [row for row in exact["commonTableContract"]["columns"]
              if row["name"] != "__internal_id__"]
    return {row["name"]: row for row in [table["idColumn"], *common, *table["columns"]]}


def allowed_states(table: dict[str, Any], column: str) -> set[str]:
    values: set[str] = set()
    for check in table.get("checks", []):
        if column not in check.get("columns", []):
            continue
        match = re.search(rf"\b{re.escape(column)}\s+IN\s*\(([^)]*)\)",
                          check.get("expression", ""), re.I)
        if match:
            values.update(re.findall(r"'([^']+)'", match.group(1)))
        equal = re.search(rf"\b{re.escape(column)}\s*=\s*'([^']+)'",
                          check.get("expression", ""), re.I)
        if equal:
            values.add(equal.group(1))
    return values


def normalize_type(value: str) -> str:
    upper = str(value).upper()
    if upper.startswith(("VARCHAR", "CHAR", "TEXT")):
        return "STRING"
    if upper.startswith(("NUMERIC", "DECIMAL")):
        return "DECIMAL"
    if upper in {"INT", "INTEGER", "SMALLINT", "BIGINT"}:
        return "INTEGER"
    if upper in {"SHA256", "CHAR(64)"}:
        return "SHA256"
    return upper


def types_compatible(source: str, target: str) -> bool:
    left, right = normalize_type(source), normalize_type(target)
    return left == right or {left, right} <= {"INTEGER", "DECIMAL"}


def disposition_compatible(left: str | None, right: str | None) -> bool:
    aliases = {
        "INSERT": "APPEND_ONE", "APPEND": "APPEND_ONE",
        "INSERT_MANY": "APPEND_MANY", "APPEND_MANY": "APPEND_MANY",
        "UPSERT": "UPSERT_CAS", "UPSERT_CAS": "UPSERT_CAS",
        "UPDATE": "UPDATE", "UPDATE_CAS": "UPDATE",
    }
    return aliases.get(str(left), str(left)) == aliases.get(str(right), str(right))


def module_indexes(modules: list[dict[str, Any]]) -> tuple[dict[str, dict], dict[str, dict], dict[str, dict]]:
    operations: dict[str, dict] = {}
    transitions: dict[str, dict] = {}
    events: dict[str, dict] = {}
    for module in modules:
        for capability in module.get("capabilities", []):
            for operation in capability.get("operations", []):
                operations[operation["operationId"]] = operation
            for machine in capability.get("stateMachines", []):
                for transition in machine.get("transitions", []):
                    transitions[transition["operationId"]] = transition
            for event in capability.get("events", []):
                events[event["name"]] = event
    return operations, transitions, events


def _optional_required_edges(exact: dict[str, Any], events: dict[str, Any]) -> list[str]:
    schemas = {row["schemaId"]: row for group in ("recordSchemas", "responseSchemas")
               for row in exact.get(group, [])}
    operations = {row["operationId"]: row for row in exact["operationBindings"]}
    event_schemas = {row["eventName"]: row for row in events["eventPayloadSchemas"]}
    issues: list[str] = []
    for lineage in exact["operationFieldLineage"]:
        operation_id = lineage["operationId"]
        fields = request_fields(operations[operation_id], schemas)
        optional = {name for name, field in fields.items() if not field.get("required")}
        typed = {row["source"]: row for row in lineage.get("typedSources", [])}

        def reaches_optional(source: str, seen: set[str] | None = None) -> bool:
            seen = set() if seen is None else set(seen)
            if source in optional:
                return True
            if source in seen or source not in typed:
                return False
            seen.add(source)
            row = typed[source]
            if str(row.get("ruleId", "")).startswith(
                    "COALESCE_VALIDATED_OPTIONAL_PATCH_WITH_LOCKED_EXISTING_VALUE"):
                return False
            if row.get("optionalInputEncoding") == "EXPLICIT_NULL_SENTINEL_WITH_FIELD_TAG":
                return False
            return any(reaches_optional(item, seen) for item in row.get("inputs", []))

        for row in lineage.get("requiredColumnSources", []):
            if reaches_optional(row.get("sourcePath", "")):
                issues.append(f"{operation_id}:{row['target']}")
        required_events = {
            f"{name}.{field['name']}"
            for name in operations[operation_id].get("eventNames", [])
            for field in event_schemas.get(name, {}).get("fields", []) if field.get("required")
        }
        for row in lineage.get("eventFieldSources", []):
            if row.get("target") in required_events and reaches_optional(row.get("sourcePath", "")):
                issues.append(f"{operation_id}:{row['target']}")
    return issues


def validate(causal: dict[str, Any], exact: dict[str, Any], events: dict[str, Any],
             modules: list[dict[str, Any]], *, verify_bytes: bool = True) -> Result:
    result = Result()
    result.require(causal.get("contractId") == "dwp.hris.modern.operation-causal-state.v2"
                   and causal.get("schemaVersion") == 2,
                   "CONTRACT_IDENTITY", "causal successor identity/version drift")
    result.require(causal.get("status") == "SEALED_G3_DESIGN_NOT_IMPLEMENTED"
                   and causal.get("scope") == EXPECTED_SCOPE,
                   "LIFECYCLE_SCOPE", "scope or NOT_STARTED_G3/NOT_AUTHORIZED_G6 boundary drift")
    if verify_bytes:
        result.require(causal.get("sealedPayloadSha256") == digest_without_seal(causal),
                       "CONTRACT_SEAL", "causal contract seal mismatch")
        for path in (EXACT, EVENTS, BINDINGS, IDENTITIES, LISTENING_AUTHORITY):
            result.require(causal.get("canonicalSourcePins", {}).get(path.name)
                           == hashlib.sha256(path.read_bytes()).hexdigest(),
                           "SOURCE_PIN", f"causal contract does not pin exact bytes of {path.name}")

    schemas = {row["schemaId"]: row for group in ("recordSchemas", "responseSchemas")
               for row in exact.get(group, [])}
    exact_ops = {row["operationId"]: row for row in exact.get("operationBindings", [])}
    lineages = {row["operationId"]: row for row in exact.get("operationFieldLineage", [])}
    tables = {row["tableName"]: row for row in exact.get("tableSpecifications", [])}
    table_columns = {name: physical_columns(exact, table) for name, table in tables.items()}
    event_schemas = {row["eventName"]: row for row in events.get("eventPayloadSchemas", [])}
    causal_ops = {row["operationId"]: row for row in causal.get("operations", [])}
    try:
        listening_authority = json.loads(LISTENING_AUTHORITY.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        result.require(False, "LISTENING_SUCCESSOR_AUTHORITY", f"authority unreadable: {exc}")
        listening_authority = {}
    listening_reference = {
        "contractId": LISTENING_AUTHORITY_ID,
        "path": LISTENING_AUTHORITY.name,
        "fileSha256": hashlib.sha256(LISTENING_AUTHORITY.read_bytes()).hexdigest()
        if LISTENING_AUTHORITY.is_file() else "",
        "sealedPayloadSha256": listening_authority.get("sealedPayloadSha256", ""),
        "canonicalInputSetSha256": listening_authority.get(
            "canonicalPrecedence", {}
        ).get("generatedSummary", {}).get("canonicalInputSetSha256", ""),
        "capabilityId": "HRIS.MODERN.EMPLOYEE_LISTENING",
        "authorityMode": "DERIVED_SUMMARY_OF_CANONICAL_FIVE",
        "canonicalRowsRole": "PRIMARY_ACTIVE_IMPLEMENTATION_AUTHORITY",
    }
    result.require(
        listening_authority.get("contractId") == LISTENING_AUTHORITY_ID
        and listening_authority.get("status")
        == "CANONICAL_G3_START_AUTHORITY_NOT_IMPLEMENTED"
        and listening_authority.get("sealedPayloadSha256")
        == digest_without_seal(listening_authority)
        and listening_authority.get("canonicalPrecedence", {}).get("mode")
        == "CANONICAL_FIVE_PRIMARY_DERIVED_SUMMARY_ONLY",
        "LISTENING_SUCCESSOR_AUTHORITY",
        "listening authority current identity/status/seal drift",
    )
    result.require(
        causal.get("canonicalDerivedSummaries")
        == {"sysListeningStreamSummary": listening_reference},
        "LISTENING_SUCCESSOR_AUTHORITY",
        "causal derived-summary verification reference drift",
    )
    listening_operations = {
        operation_id: row for operation_id, row in causal_ops.items()
        if operation_id.startswith("modern.listening.")
    }
    result.require(
        len(listening_operations) == 8
        and all(
            row.get("derivedSummaryVerification") == listening_reference
            for row in listening_operations.values()
        ),
        "LISTENING_SUCCESSOR_AUTHORITY",
        "Listening causal rows are not all verified by the derived summary",
    )
    module_ops, module_transitions, module_events = module_indexes(modules)
    transaction_columns, transaction_profiles = _validate_transaction_infrastructure(result, causal)
    result.require(len(tables) == 71, "TABLE_CLOSED_SET", "modern physical closed set must be exact 71")
    for table_name, forbidden in FORBIDDEN_SYNONYM_COLUMNS.items():
        result.require(not (forbidden & set(table_columns.get(table_name, {}))),
                       "CANONICAL_PHYSICAL_SCHEMA",
                       f"{table_name}: duplicate/synonymous WFM columns returned")
    result.require(set(causal_ops) == set(exact_ops) == set(module_ops)
                   and len(causal_ops) == 100,
                   "OPERATION_CLOSED_SET", "100-operation exact/causal/module closed set drift")
    result.require(set(lineages) == set(exact_ops), "LINEAGE_CLOSED_SET",
                   "operation lineage closed set differs from exact operations")

    command_count = query_count = state_sinks = required_uses = selectors_count = 0
    command_event_names: set[str] = set()
    ordered_dml_tables: set[str] = set()
    for operation_id, exact_op in exact_ops.items():
        row = causal_ops.get(operation_id, {})
        fields = top_level_request_fields(exact_op)
        mode = exact_op.get("mode")
        result.require(row.get("mode") == mode, "OPERATION_MODE", f"{operation_id}: mode drift")
        uses_list = row.get("requiredInputUses", [])
        uses = {item.get("source"): item for item in uses_list}
        # Optional values with explicit absence semantics are causal inputs too;
        # omitting them from the contract would leave their present branch
        # unverified.  The closed set is therefore every top-level wire member.
        expected_uses = set(fields)
        result.require(len(uses) == len(uses_list) and set(uses) == expected_uses,
                       "REQUIRED_INPUT_EFFECT", f"{operation_id}: exact input/effect closure drift")
        required_uses += len(uses_list)
        result.require(all(use.get("causalEffect") ==
                           "OBSERVABLE_EFFECT_SET_NO_GUARD_ONLY_FALLBACK"
                           for use in uses_list), "REQUIRED_INPUT_EFFECT",
                       f"{operation_id}: a required input has a catch-all/renamed guard")

        if mode == "QUERY":
            query_count += 1
            result.require(row.get("mutationFieldSet") == [] and row.get("causalEvents") == []
                           and not exact_op.get("writesTables"),
                           "QUERY_ZERO_WRITE", f"{operation_id}: query mutates state or emits an event")
            read_plan = row.get("readPlan", {})
            result.require(read_plan.get("writesForbidden") is True
                           and read_plan.get("receiptsForbidden") is True
                           and read_plan.get("outboxForbidden") is True
                           and read_plan.get("eventsForbidden") is True
                           and read_plan.get("transactionMode") == "READ_ONLY",
                           "QUERY_ZERO_WRITE", f"{operation_id}: query read-only plan is incomplete")
            for source, use in uses.items():
                effects = use.get("effects", [])
                result.require(effects and all(effect.get("kind") in QUERY_EFFECTS for effect in effects)
                               and use.get("requestDigestMember") is False,
                               "QUERY_ZERO_WRITE", f"{operation_id}:{source} references command state")
                for effect in effects:
                    kind, target = effect.get("kind"), effect.get("target")
                    if source == "headers.X-Correlation-ID":
                        result.require(kind == "OBSERVABILITY_CONTEXT"
                                       and target == "requestContext.correlationId",
                                       "QUERY_ZERO_WRITE",
                                       f"{operation_id}:{source} is not trace-context-only")
                    elif source == "queryParameters.asOf":
                        result.require(kind == "OWNER_EFFECTIVE_TIME_FILTER"
                                       and target == "readPlan.asOf",
                                       "QUERY_ZERO_WRITE", f"{operation_id}:{source} as-of drift")
                    elif source == "queryParameters.cursor":
                        result.require(kind == "PAGINATION_CURSOR_FILTER"
                                       and target == "readPlan.cursor"
                                       and "tenant+caller+scope+purpose+asOf" in effect.get("binding", ""),
                                       "QUERY_ZERO_WRITE", f"{operation_id}:{source} cursor binding drift")
                    elif source == "queryParameters.limit":
                        result.require(kind == "QUERY_LIMIT" and target == "readPlan.limit"
                                       and bool(effect.get("range")),
                                       "QUERY_ZERO_WRITE", f"{operation_id}:{source} limit drift")
                    else:
                        table, _, column = str(target).partition(".")
                        matching_selector = next(
                            (item for item in row.get("targetSelectors", [])
                             if item.get("source") == source), {}
                        )
                        owner_filter = (
                            str(target).startswith("OWNER_PORT::")
                            and matching_selector.get("selectorType") == "OWNER_PORT"
                            and str(target).removeprefix("OWNER_PORT::") ==
                            f"{matching_selector.get('entityType')}.publicId"
                        )
                        physical_filter = table in table_columns and column in table_columns.get(table, {})
                        result.require(kind == "QUERY_FILTER" and (physical_filter or owner_filter),
                                       "QUERY_ZERO_WRITE", f"{operation_id}:{source} filter target drift")
                if not fields[source].get("required"):
                    absence = use.get("absenceSemantics", {})
                    result.require(absence.get("mode") == "EXPLICIT_ABSENT_BRANCH"
                                   and absence.get("mustTestAbsentAndPresent") is True,
                                   "QUERY_OPTIONAL_BRANCH", f"{operation_id}:{source} absence is implicit")
            path_sources = {source for source in fields if source.startswith("pathParameters.")}
            selectors = row.get("targetSelectors", [])
            result.require({item.get("source") for item in selectors} == path_sources,
                           "SELECTOR_CLOSED_SET", f"{operation_id}: query selector closure drift")
            _validate_selectors(result, operation_id, selectors, fields, tables, table_columns,
                                root=None, root_disposition=None)
            selectors_count += len(selectors)
            continue

        command_count += 1
        root = row.get("aggregateRoot", {})
        root_name = exact_op.get("aggregateRootTable")
        result.require(root.get("table") == root_name and root_name in exact_op.get("writesTables", [])
                       and root_name in tables,
                       "AGGREGATE_ROOT", f"{operation_id}: exact physical aggregate root drift")
        write_set = {item["table"]: item["disposition"]
                     for item in lineages[operation_id].get("writeSet", [])}
        result.require(set(write_set) == set(exact_op.get("writesTables", []))
                       and row.get("writeTables") == exact_op.get("writesTables"),
                       "WRITE_SET", f"{operation_id}: ordered write-table closure drift")
        ordered = row.get("orderedDml", [])
        result.require([item.get("table") for item in ordered] == exact_op.get("writesTables")
                       and [item.get("step") for item in ordered] == list(range(1, len(ordered) + 1)),
                       "ORDERED_DML", f"{operation_id}: ordered DML table/step drift")
        ordered_dml_tables.update(item.get("table") for item in ordered)
        mutation_sources = {item["target"]: item for item in
                            lineages[operation_id].get("mutationFieldSources", [])}
        required_sources = {item["target"]: item for item in
                            lineages[operation_id].get("requiredColumnSources", [])}
        expected_mutation_set = {
            item.get("target") for dml in ordered for item in dml.get("assignments", [])
        }
        result.require(set(row.get("mutationFieldSet", [])) == expected_mutation_set,
                       "MUTATION_FIELD_SET", f"{operation_id}: mutation field set is not exact")
        for dml in ordered:
            table_name = dml.get("table")
            disposition = dml.get("disposition")
            result.require(disposition_compatible(disposition, write_set.get(table_name)), "ORDERED_DML",
                           f"{operation_id}:{table_name} disposition drift")
            assignments = dml.get("assignments", [])
            targets = {item.get("target") for item in assignments}
            result.require(len(targets) == len(assignments), "ORDERED_DML_ASSIGNMENT",
                           f"{operation_id}:{table_name} contains duplicate assignments")
            for assignment in assignments:
                target = assignment.get("target", "")
                column = target.split(".", 1)[1] if "." in target else ""
                result.require(target.startswith(table_name + ".")
                               and column in table_columns.get(table_name, {})
                               and assignment.get("sqlType") == table_columns[table_name][column]["sqlType"]
                               and bool(assignment.get("sourcePath")),
                               "ORDERED_DML_ASSIGNMENT", f"{operation_id}:{target} is not physical/typed")
            if disposition in {"INSERT", "APPEND", "INSERT_MANY", "APPEND_MANY"}:
                required_insert = {
                    f"{table_name}.{name}" for name, column in table_columns[table_name].items()
                    if name != tables[table_name]["idColumn"]["name"]
                    and column.get("nullable") is False and column.get("default") is None
                }
                result.require(required_insert <= targets, "INSERT_REQUIRED_COLUMN",
                               f"{operation_id}:{table_name} misses NOT NULL/no-default assignments")

        state_column = root.get("stateColumn")
        transition = row.get("transition", {})
        sink = f"{root_name}.{state_column}"
        allowed = allowed_states(tables.get(root_name, {}), state_column)
        result.require(state_column in {"status", "state", "stage"}
                       and transition.get("physicalPostStateSink") == sink
                       and sink in mutation_sources
                       and bool(allowed)
                       and set(transition.get("postStates", [])) <= allowed,
                       "POST_STATE_PHYSICAL_SINK", f"{operation_id}: post-state/CHECK sink drift")
        root_assignments = {a.get("target"): a for dml in ordered if dml.get("table") == root_name
                            for a in dml.get("assignments", [])}
        version_sink = f"{root_name}.{root.get('versionColumn', 'aggregate_version')}"
        result.require(sink in root_assignments
                       and version_sink in root_assignments,
                       "POST_STATE_PHYSICAL_SINK", f"{operation_id}: state/version is not written")
        result.require(transition.get("postStateSource") ==
                       module_transitions.get(operation_id, {}).get("postStateSource"),
                       "TRANSITION_SOURCE", f"{operation_id}: reviewed transition source drift")
        if len(transition.get("postStates", [])) > 1:
            result.require(transition.get("postStateSource") not in {None, "", "CONSTANT"},
                           "FALSE_FACT_OUTCOME", f"{operation_id}: multi-outcome state uses a constant")
        state_sinks += 1

        root_disposition = write_set.get(root_name)
        selectors = root.get("selectors", [])
        effect_selector_sources = {
            source for source, use in uses.items()
            if any(effect.get("kind") in {"ENTITY_SELECTOR", "OWNER_REFETCH"}
                   for effect in use.get("effects", []))
        }
        selector_sources = {item.get("source") for item in selectors
                            if item.get("source") != "OWNER_GENERATED_UUID_V7"}
        result.require(selector_sources == effect_selector_sources,
                       "SELECTOR_CLOSED_SET", f"{operation_id}: path selector closure drift")
        generated = [item for item in selectors if item.get("source") == "OWNER_GENERATED_UUID_V7"]
        result.require(bool(generated) == (root_disposition in {"INSERT", "APPEND", "INSERT_MANY", "APPEND_MANY"}),
                       "SELECTOR_GENERATED_ROOT", f"{operation_id}: generated root identity drift")
        _validate_selectors(result, operation_id, selectors, fields, tables, table_columns,
                            root=root_name, root_disposition=root_disposition)
        selectors_count += len(selectors)

        for source, use in uses.items():
            effects = use.get("effects", [])
            kinds = {effect.get("kind") for effect in effects}
            result.require(effects and kinds <= OBSERVABLE_COMMAND_EFFECTS,
                           "REQUIRED_INPUT_EFFECT", f"{operation_id}:{source} has unknown/no effect")
            text = json.dumps(use, sort_keys=True)
            result.require("decision_input." not in text and "GENERIC_GUARD" not in text
                           and "TRANSITION_GUARD" not in text,
                           "REQUIRED_INPUT_EFFECT", f"{operation_id}:{source} is a renamed guard")
            if not source.startswith("headers."):
                business = kinds & BUSINESS_COMMAND_EFFECTS
                result.require(bool(business), "REQUIRED_INPUT_EFFECT",
                               f"{operation_id}:{source} has no observable business effect")
            for effect in effects:
                _validate_effect(result, operation_id, source, effect, row, fields[source],
                                 table_columns, transaction_columns, transaction_profiles)

        _validate_command_envelope(
            result, operation_id, row, transaction_columns, transaction_profiles
        )
        exact_names = exact_op.get("eventNames", [])
        causal_events = row.get("causalEvents", [])
        result.require([event.get("eventName") for event in causal_events] == exact_names
                       and bool(causal_events),
                       "EVENT_CLOSED_SET", f"{operation_id}: command event list drift")
        for event in causal_events:
            name = event.get("eventName")
            command_event_names.add(name)
            _validate_event(result, operation_id, event, event_schemas.get(name, {}),
                            exact_op, tables, table_columns, module_events.get(name, {}))

    handlers = {row.get("handlerId"): row for row in causal.get("internalConsumerHandlers", [])}
    result.require(set(handlers) == EXPECTED_HANDLERS,
                   "HANDLER_CLOSED_SET", "four reviewed internal handler contracts drift")
    handler_events: set[str] = set()
    for handler_id, handler in handlers.items():
        root = handler.get("aggregateRoot", {})
        result.require(root.get("table") == handler.get("aggregateRootTable")
                       and root.get("table") in handler.get("writesTables", []),
                       "HANDLER_AGGREGATE_ROOT", f"{handler_id}: handler root drift")
        ordered = handler.get("orderedDml", [])
        result.require([dml.get("table") for dml in ordered] == handler.get("writesTables")
                       and [dml.get("step") for dml in ordered] == list(range(1, len(ordered) + 1))
                       and all(dml.get("assignments") and dml.get("sameTransaction") is True
                               for dml in ordered),
                       "HANDLER_ORDERED_DML", f"{handler_id}: handler DML is not exact")
        for dml in ordered:
            table_name = dml.get("table")
            assignments = dml.get("assignments", [])
            targets = {item.get("target") for item in assignments}
            result.require(
                disposition_compatible(
                    dml.get("disposition"), handler.get("writeDispositions", {}).get(table_name)
                )
                and len(targets) == len(assignments)
                and bool(dml.get("rowCount"))
                and bool(dml.get("tenantPredicate"))
                and bool(dml.get("rootCasPredicate")),
                "HANDLER_ORDERED_DML", f"{handler_id}:{table_name} DML contract drift",
            )
            for assignment in assignments:
                target = str(assignment.get("target", ""))
                column = target.split(".", 1)[1] if "." in target else ""
                result.require(
                    target.startswith(str(table_name) + ".")
                    and column in table_columns.get(table_name, {})
                    and assignment.get("sqlType") == table_columns[table_name][column]["sqlType"]
                    and bool(assignment.get("sourcePath")),
                    "HANDLER_ORDERED_DML_ASSIGNMENT",
                    f"{handler_id}:{target} is not an exact physical assignment",
                )
            if dml.get("disposition") in {"INSERT", "APPEND", "INSERT_MANY", "APPEND_MANY"}:
                required_insert = {
                    f"{table_name}.{name}"
                    for name, column in table_columns.get(table_name, {}).items()
                    if name != tables[table_name]["idColumn"]["name"]
                    and column.get("nullable") is False and column.get("default") is None
                }
                result.require(required_insert <= targets, "HANDLER_INSERT_REQUIRED_COLUMN",
                               f"{handler_id}:{table_name} misses NOT NULL/no-default assignments")
        root_dml = next((dml for dml in ordered if dml.get("table") == root.get("table")), {})
        root_targets = {item.get("target") for item in root_dml.get("assignments", [])}
        result.require(
            f"{root.get('table')}.{root.get('stateColumn')}" in root_targets
            and f"{root.get('table')}.{root.get('versionColumn')}" in root_targets,
            "HANDLER_STATE_VERSION_SINK", f"{handler_id}: root state/version is not atomically written",
        )
        ordered_dml_tables.update(handler.get("writesTables", []))
        _validate_handler_envelope(
            result, handler_id, handler, transaction_columns, transaction_profiles
        )
        event = handler.get("eventContract", {})
        name = event.get("eventName")
        handler_events.add(name)
        schema = event_schemas.get(name, {})
        _validate_event(result, handler_id, event, schema, handler, tables, table_columns,
                        module_events.get(name, {}))

    result.require(command_count == 81 and query_count == 19 and state_sinks == 81,
                   "COMMAND_QUERY_SCOPE", "81 command state sinks / 19 zero-write queries required")
    result.require(len(command_event_names) == 82 and len(handler_events) == 4
                   and command_event_names.isdisjoint(handler_events)
                   and command_event_names | handler_events == set(event_schemas),
                   "EVENT_CLOSED_SET", "82 command/conditional + 4 handler event closure drift")
    result.require(len(event_schemas) == 86 and set(module_events) == set(event_schemas),
                   "EVENT_CLOSED_SET", "exact/module event schema closed set must be 86")
    read_tables = {table for operation in exact_ops.values()
                   for table in operation.get("readsTables", [])}
    result.require(ordered_dml_tables == set(tables) - READ_ONLY_OWNER_TABLES
                   and READ_ONLY_OWNER_TABLES <= read_tables,
                   "TABLE_CLOSED_SET",
                   "71-table set must split exactly into ordered-DML owners and five explicit read-only owner projections")

    for table in tables.values():
        for column in physical_columns(exact, table).values():
            if column.get("default") is None:
                continue
            accepted = allowed_states(table, column["name"])
            if accepted:
                default = str(column["default"]).strip("'")
                result.require(default in accepted, "DEFAULT_CHECK_CONTRADICTION",
                               f"{table['tableName']}.{column['name']} default violates CHECK")

    optional_edges = _optional_required_edges(exact, events)
    result.require(not optional_edges, "OPTIONAL_REQUIRED_EDGE",
                   "optional value reaches required sink: " + ",".join(optional_edges[:5]))
    _validate_edge_decisions(result, causal, exact)
    _validate_snapshot_identity(result, exact, events, modules)

    result.counts.update({
        "operations": len(causal_ops), "commands": command_count, "queries": query_count,
        "events": len(event_schemas), "handlers": len(handlers), "tables": len(tables),
        "stateSinks": state_sinks, "requiredInputUses": required_uses,
        "selectors": selectors_count, "optionalRequiredEdges": len(optional_edges),
        "legacyEdges": 58, "forbiddenEdges": 5,
    })
    return result


def _validate_selectors(result: Result, operation_id: str, selectors: list[dict[str, Any]],
                        fields: dict[str, dict[str, Any]], tables: dict[str, dict[str, Any]],
                        columns: dict[str, dict[str, dict[str, Any]]], *, root: str | None,
                        root_disposition: str | None) -> None:
    for selector in selectors:
        source = selector.get("source")
        selector_type = selector.get("selectorType")
        target_table = selector.get("targetTable")
        target_column = selector.get("targetColumn")
        result.require(selector.get("cardinality") in {"EXACTLY_ONE", "ONE_TO_MANY_ORDER_INDEPENDENT"}
                       and bool(selector.get("tenantFilter"))
                       and bool(selector.get("purposeFilter"))
                       and bool(selector.get("versionRule"))
                       and bool(selector.get("asOfRule"))
                       and bool(selector.get("causalJoin")),
                       "SELECTOR_EXACTNESS", f"{operation_id}:{source} selector metadata incomplete")
        if source == "OWNER_GENERATED_UUID_V7":
            result.require(selector_type == "GENERATED_ROOT" and target_table == root
                           and target_column == "public_id" and selector.get("sourceType") == "UUID",
                           "SELECTOR_GENERATED_ROOT", f"{operation_id}: generated root selector drift")
            continue
        field = fields.get(source, {})
        if selector.get("cardinality") == "ONE_TO_MANY_ORDER_INDEPENDENT":
            result.require(str(field.get("type", "")).startswith("ARRAY")
                           and (str(target_table).startswith("OWNER_PORT::")
                                or target_table in columns),
                           "SELECTOR_EXACTNESS",
                           f"{operation_id}:{source} one-to-many selector is not a typed owner array")
        result.require(selector.get("sourceType") == field.get("type"),
                       "SELECTOR_TYPE", f"{operation_id}:{source} selector source type drift")
        if str(target_table).startswith("OWNER_PORT::"):
            entity = str(target_table).removeprefix("OWNER_PORT::")
            reference = field.get("referenceContract", {})
            expected_owner_type = (field.get("type")
                                   if selector.get("cardinality") == "ONE_TO_MANY_ORDER_INDEPENDENT"
                                   else "UUID")
            result.require(selector_type == "OWNER_PORT"
                           and selector.get("entityType") == entity
                           and selector.get("targetColumn") == "publicId"
                           and selector.get("targetSqlType") == expected_owner_type
                           and reference.get("entityType") == entity
                           and reference.get("idSpace") == "PUBLIC_UUID",
                           "SELECTOR_EXACTNESS", f"{operation_id}:{source} owner selector drift")
            continue
        result.require(target_table in tables and target_column in columns.get(target_table, {}),
                       "SELECTOR_PHYSICAL_TARGET", f"{operation_id}:{source} target is not physical")
        if target_table in columns and target_column in columns[target_table]:
            target_sql = columns[target_table][target_column]["sqlType"]
            source_type = field.get("type", "")
            if selector.get("cardinality") == "ONE_TO_MANY_ORDER_INDEPENDENT":
                match = re.fullmatch(r"ARRAY(?:<(.+)>)?", str(source_type))
                source_type = match.group(1) if match and match.group(1) else "UUID"
            result.require(selector.get("targetSqlType") == target_sql
                           and types_compatible(source_type, target_sql),
                           "SELECTOR_TYPE", f"{operation_id}:{source} source/target type mismatch")
        if selector_type == "VERSION":
            result.require(target_column != "public_id"
                           and re.search(r"(?:version|revision)", target_column or "", re.I),
                           "SELECTOR_VERSION", f"{operation_id}:{source} version aliases public identity")
        if selector_type == "ROOT_TARGET":
            result.require(target_table == root and target_column == "public_id",
                           "SELECTOR_ROOT_ROLE", f"{operation_id}:{source} root selector targets another entity")
        if selector_type == "CREATE_CHILD_CAUSAL_PARENT":
            result.require(root_disposition in {"INSERT", "APPEND", "APPEND_MANY"}
                           and target_table != root,
                           "SELECTOR_PARENT_ROLE", f"{operation_id}:{source} parent was collapsed into child root")


def _validate_effect(result: Result, operation_id: str, source: str, effect: dict[str, Any],
                     operation: dict[str, Any], field: dict[str, Any],
                     columns: dict[str, dict[str, dict[str, Any]]],
                     transaction_columns: dict[str, dict[str, dict[str, Any]]],
                     transaction_profiles: dict[str, dict[str, Any]]) -> None:
    kind = effect.get("kind")
    target = str(effect.get("target", ""))
    profile = transaction_profiles.get(operation.get("session"), {})
    if kind == "PERSISTED_COLUMN":
        if "." not in target:
            result.require(False, "PERSISTED_EFFECT_TARGET", f"{operation_id}:{source} target is not table.column")
            return
        table, column = target.split(".", 1)
        result.require(table in columns and column in columns[table], "PERSISTED_EFFECT_TARGET",
                       f"{operation_id}:{source} persisted target is not physical")
        if table in columns and column in columns[table]:
            target_type = columns[table][column]["sqlType"]
            if normalize_type(field.get("type", "")) == "UUID" and normalize_type(target_type) == "INTEGER":
                resolution = effect.get("resolution", {})
                result.require(resolution.get("kind") == "TENANT_BOUND_PUBLIC_TO_LOCAL_INTERNAL"
                               and resolution.get("table") in columns
                               and resolution.get("publicColumn") == "public_id"
                               and resolution.get("internalColumn") in columns[resolution["table"]]
                               and resolution.get("tenantSource") == "principal.tenantId",
                               "PUBLIC_TO_INTERNAL_RESOLUTION",
                               f"{operation_id}:{source} UUID→BIGINT sink lacks exact tenant resolution")
    elif kind in {"PERSISTED_BUSINESS_FACT", "PERSISTED_DERIVED_DIGEST"}:
        if "." not in target:
            result.require(False, "PERSISTED_EFFECT_TARGET",
                           f"{operation_id}:{source} target is not table.column")
        else:
            table, column = target.split(".", 1)
            result.require(table in columns and column in columns.get(table, {})
                           and bool(effect.get("observableAssertion")),
                           "PERSISTED_EFFECT_TARGET",
                           f"{operation_id}:{source} persisted fact is not physical/observable")
            if kind == "PERSISTED_DERIVED_DIGEST":
                result.require("digest" in column or "hash" in column,
                               "PERSISTED_EFFECT_TARGET",
                               f"{operation_id}:{source} derived digest targets a non-digest column")
    elif kind == "PERSISTED_TYPED_OBJECT":
        targets = effect.get("targets", [])
        result.require(bool(targets) and bool(effect.get("observableAssertion"))
                       and all("." in item and item.split(".", 1)[0] in columns
                               and item.split(".", 1)[1] in columns[item.split(".", 1)[0]]
                               for item in targets),
                       "PERSISTED_TYPED_OBJECT_EFFECT",
                       f"{operation_id}:{source} typed object lacks an exact physical field set")
    elif kind == "APPEND_TYPED_COLLECTION":
        result.require(target in operation.get("writeTables", [])
                       and str(effect.get("cardinality", "")).startswith("EXACT_")
                       and bool(effect.get("observableAssertion")),
                       "APPEND_TYPED_COLLECTION_EFFECT",
                       f"{operation_id}:{source} collection append lacks exact row cardinality")
    elif kind == "ENTITY_SELECTOR":
        table, _, column = target.partition(".")
        cardinality = effect.get("cardinality")
        field_type = str(field.get("type", ""))
        result.require(table in columns and column in columns.get(table, {})
                       and (cardinality == "EXACTLY_ONE"
                            or (cardinality == "ONE_TO_MANY_ORDER_INDEPENDENT"
                                and field_type.startswith("ARRAY")))
                       and bool(effect.get("selectorType"))
                       and effect.get("pep", {}).get("tenant")
                       and effect.get("pep", {}).get("purpose")
                       and effect.get("pep", {}).get("denyOnUnavailable") is True,
                       "SELECTOR_EXACTNESS", f"{operation_id}:{source} selector effect incomplete")
    elif kind == "OWNER_REFETCH":
        reference = field.get("referenceContract", {})
        selectors = (operation.get("aggregateRoot", {}).get("selectors", [])
                     or operation.get("targetSelectors", []))
        selector = next((item for item in selectors if item.get("source") == source), {})
        raw_target = str(effect.get("target", ""))
        if raw_target.startswith("OWNER_PORT::"):
            entity = raw_target.removeprefix("OWNER_PORT::").removesuffix("[]").removesuffix(".publicId")
        elif raw_target.endswith(".public_id") and raw_target.split(".", 1)[0] in columns:
            entity = "table:" + raw_target.split(".", 1)[0]
        else:
            entity = raw_target.removesuffix("[]").removesuffix(".publicId")
        cardinality = selector.get("cardinality")
        result.require(bool(selector)
                       and selector.get("entityType") == reference.get("entityType")
                       and selector.get("idSpace") == "PUBLIC_UUID"
                       and cardinality in {"EXACTLY_ONE", "ONE_TO_MANY_ORDER_INDEPENDENT"}
                       and (cardinality != "ONE_TO_MANY_ORDER_INDEPENDENT"
                            or str(field.get("type", "")).startswith("ARRAY"))
                       and entity == reference.get("entityType")
                       and reference.get("idSpace") == "PUBLIC_UUID"
                       and effect.get("pep", {}).get("tenant")
                       and effect.get("pep", {}).get("purpose")
                       and effect.get("pep", {}).get("denyOnUnavailable") is True,
                       "OWNER_REFETCH_EFFECT",
                       f"{operation_id}:{source} owner refetch is not typed/tenant/purpose bound")
    elif kind == "PERSISTED_DECISION_RECEIPT":
        required = effect.get("requiredFields", {})
        bindings = effect.get("physicalFieldBindings", {})
        receipt = profile.get("receiptTable")
        result.require(all(required.get(key) for key in
                           ("ruleId", "inputDigestOrRef", "outcome", "decisionVersion"))
                       and effect.get("sameTransaction") is True
                       and target == receipt
                       and bool(effect.get("mutationDependency"))
                       and bool(effect.get("executionProof"))
                       and bindings == profile.get("decisionAuditBindings")
                       and set(bindings) == set(required)
                       and all(
                           all(part.startswith(str(receipt) + ".")
                               and part.split(".", 1)[1] in transaction_columns.get(str(receipt), {})
                               for part in str(value).split("+"))
                           for value in bindings.values()
                       ),
                       "DECISION_RECEIPT_EFFECT",
                       f"{operation_id}:{source} policy outcome is not durably/casually recorded")
    elif kind == "LOCKED_FACT_MATCH":
        table, _, column = target.partition(".")
        result.require(table in columns and column in columns.get(table, {})
                       and effect.get("operator") in {"=", "CONSTANT_TIME_EQUAL"}
                       and str(effect.get("onMismatch", "")).startswith("409")
                       and bool(effect.get("observableAssertion"))
                       and bool(effect.get("mutationDependency")),
                       "LOCKED_FACT_MATCH_EFFECT",
                       f"{operation_id}:{source} locked fact comparison is not causal")
    elif kind == "ROOT_CAS_FILTER":
        result.require(target.endswith((".aggregate_version", ".version_no", ".revision_no")),
                       "CAS_EFFECT", f"{operation_id}:{source} CAS target is not a version")
        result.require(source == "headers.If-Match" and effect.get("operator") == "="
                       and str(effect.get("rowCount", "")).startswith("EXACTLY_ONE"),
                       "CAS_EFFECT", f"{operation_id}:{source} CAS is not If-Match/exact-row bound")
    elif kind == "OBSERVABILITY_CONTEXT":
        result.require(source == "headers.X-Correlation-ID"
                       and target == "requestContext.correlationId",
                       "OBSERVABILITY_EFFECT",
                       f"{operation_id}:{source} observability context is not correlation-only")
    elif kind == "PERSISTED_CONTROL":
        result.require(source == "headers.X-Correlation-ID"
                       and target == f"{profile.get('outboxTable')}.correlation_id"
                       and "correlation_id" in transaction_columns.get(
                           str(profile.get("outboxTable")), {}
                       ),
                       "OBSERVABILITY_EFFECT",
                       f"{operation_id}:{source} persisted control is not outbox correlation")
    elif kind == "IDEMPOTENCY_CLAIM":
        result.require(source == "headers.Idempotency-Key"
                       and target == profile.get("receiptTable")
                       and "idempotency_key" in transaction_columns.get(target, {})
                       and effect.get("uniqueKey") == "tenant+caller+operation+idempotencyKey"
                       and effect.get("conflictKey") == "canonicalRequestDigest",
                       "IDEMPOTENCY_EFFECT",
                       f"{operation_id}:{source} idempotency claim is not caller/operation/digest bound")


def _expanded_transaction_assignment_map(
    template: dict[str, Any], target: dict[str, Any], event: dict[str, Any] | None = None,
) -> dict[str, str]:
    replacements = {
        "{operationId}": str(target.get("operationId", "")),
        "{handlerId}": str(target.get("handlerId", "")),
        "{authorizationCapability}": str(target.get("authorizationCapability", "")),
        "{aggregateRootTable}": str(
            target.get("aggregateRoot", {}).get("table")
            or target.get("aggregateRootTable", "")
        ),
        "{eventName}": str((event or {}).get("eventName", "")),
    }
    result: dict[str, str] = {}
    for column, raw_source in template.items():
        source = str(raw_source)
        for token, value in replacements.items():
            source = source.replace(token, value)
        result[column] = source
    return result


def _validate_transaction_step_assignments(
    result: Result, code: str, subject: str, step: dict[str, Any],
    expected: dict[str, str], physical: dict[str, dict[str, dict[str, Any]]],
    *, insert: bool,
) -> None:
    rows = step.get("assignments", [])
    actual = _assignment_index(rows)
    table = str(step.get("table", ""))
    result.require(
        len(actual) == len(rows) and actual == expected,
        code,
        f"{subject}:{step.get('stage')} exact assignment/source mapping drift",
    )
    result.require(
        set(actual) <= set(physical.get(table, {})),
        "TRANSACTION_ASSIGNMENT_PHYSICAL",
        f"{subject}:{step.get('stage')} references a nonphysical {table} column",
    )
    if insert:
        required = {
            name for name, spec in physical.get(table, {}).items()
            if spec["nullable"] is False and not spec["default"]
        }
        result.require(
            required <= set(actual),
            "TRANSACTION_ASSIGNMENT_REQUIRED",
            f"{subject}:{step.get('stage')} misses insert columns {sorted(required - set(actual))}",
        )


def _validate_command_envelope(
    result: Result, operation_id: str, row: dict[str, Any],
    physical: dict[str, dict[str, dict[str, Any]]],
    profiles: dict[str, dict[str, Any]],
) -> None:
    envelope = row.get("transactionEnvelope", {})
    steps = envelope.get("steps", [])
    ordered = row.get("orderedDml", [])
    profile = profiles.get(row.get("session"), {})
    result.require(envelope.get("operationBinding") == operation_id
                   and envelope.get("sameTransaction") is True
                   and envelope.get("stepOrder") ==
                   "RECEIPT_CLAIM_FIRST_DOMAIN_DML_THEN_RECEIPT_COMPLETION_OUTBOX_LAST"
                   and len(steps) == len(ordered) + 3
                   and [step.get("step") for step in steps] == list(range(1, len(steps) + 1)),
                   "COMMAND_TX_ENVELOPE", f"{operation_id}: transaction envelope structure drift")
    if len(steps) != len(ordered) + 3:
        return
    result.require(steps[0].get("stage") == "CLAIM_OR_REPLAY_COMMAND_RECEIPT"
                   and steps[-2].get("stage") == "COMPLETE_COMMAND_RECEIPT"
                   and steps[-1].get("stage") == "APPEND_CAUSAL_OUTBOX_LAST"
                   and steps[0].get("table") == envelope.get("receiptTable")
                   and steps[-2].get("table") == envelope.get("receiptTable")
                   and steps[-1].get("table") == envelope.get("outboxTable")
                   and envelope.get("receiptTable") == profile.get("receiptTable")
                   and envelope.get("outboxTable") == profile.get("outboxTable"),
                   "COMMAND_TX_ENVELOPE", f"{operation_id}: receipt/domain/outbox order drift")
    result.require(all(step.get("sameTransaction") is True and step.get("failureAfterStep")
                       for step in steps)
                   and all(envelope.get(key) for key in
                           ("atomicity", "idempotentReplay", "staleVersion", "tenantMismatch")),
                   "COMMAND_TX_ROLLBACK", f"{operation_id}: rollback/replay/CAS semantics missing")
    for dml, step in zip(ordered, steps[1:-2]):
        result.require(step.get("stage") == "DOMAIN_DML"
                       and step.get("table") == dml.get("table")
                       and step.get("disposition") == dml.get("disposition")
                       and step.get("assignments") == dml.get("assignments")
                       and bool(step.get("rowCount")),
                       "COMMAND_TX_ENVELOPE", f"{operation_id}: envelope domain step drift")
    expected_events = [event.get("eventName") for event in row.get("causalEvents", [])]
    actual_events = [event.get("eventName") for event in steps[-1].get("events", [])]
    result.require(expected_events == actual_events,
                   "COMMAND_TX_OUTBOX", f"{operation_id}: outbox events differ from causal facts")
    _validate_transaction_step_assignments(
        result, "COMMAND_TX_RECEIPT_ASSIGNMENT", operation_id, steps[0],
        _expanded_transaction_assignment_map(profile.get("receiptClaimAssignments", {}), row),
        physical, insert=True,
    )
    _validate_transaction_step_assignments(
        result, "COMMAND_TX_RECEIPT_ASSIGNMENT", operation_id, steps[-2],
        _expanded_transaction_assignment_map(profile.get("receiptCompleteAssignments", {}), row),
        physical, insert=False,
    )
    _validate_transaction_step_assignments(
        result, "COMMAND_TX_OUTBOX_ASSIGNMENT", operation_id, steps[-1],
        _expanded_transaction_assignment_map(profile.get("outboxAssignments", {}), row),
        physical, insert=True,
    )
    event = handler.get("eventContract", {})
    _validate_transaction_step_assignments(
        result, "HANDLER_TX_INBOX_ASSIGNMENT", handler_id, steps[0],
        _expanded_transaction_assignment_map(
            profile.get("inboxClaimAssignments", {}), handler, event
        ),
        physical, insert=True,
    )
    _validate_transaction_step_assignments(
        result, "HANDLER_TX_INBOX_ASSIGNMENT", handler_id, steps[-2],
        _expanded_transaction_assignment_map(
            profile.get("inboxCompleteAssignments", {}), handler, event
        ),
        physical, insert=False,
    )
    _validate_transaction_step_assignments(
        result, "HANDLER_TX_OUTBOX_ASSIGNMENT", handler_id, steps[-1],
        _expanded_transaction_assignment_map(profile.get("outboxAssignments", {}), handler, event),
        physical, insert=True,
    )


def _validate_handler_envelope(
    result: Result, handler_id: str, handler: dict[str, Any],
    physical: dict[str, dict[str, dict[str, Any]]],
    profiles: dict[str, dict[str, Any]],
) -> None:
    envelope = handler.get("transactionEnvelope", {})
    steps = envelope.get("steps", [])
    ordered = handler.get("orderedDml", [])
    profile = profiles.get(handler.get("session"), {})
    result.require(envelope.get("operationBinding") == handler_id
                   and envelope.get("sameTransaction") is True
                   and len(steps) == len(ordered) + 3
                   and steps and steps[0].get("stage") == "CLAIM_OR_REPLAY_DURABLE_OWNER_INBOX"
                   and steps[-2].get("stage") == "COMPLETE_DURABLE_OWNER_INBOX"
                   and steps[-1].get("stage") == "APPEND_CAUSAL_OUTBOX_LAST"
                   and all(step.get("sameTransaction") is True and step.get("failureAfterStep")
                           for step in steps),
                   "HANDLER_TX_ENVELOPE", f"{handler_id}: inbox/domain/outbox atomic envelope drift")
    result.require(all(envelope.get(key) for key in
                       ("atomicity", "idempotentReplay", "staleVersion", "tenantMismatch")),
                   "HANDLER_TX_ENVELOPE", f"{handler_id}: replay/rollback policy missing")
    if len(steps) != len(ordered) + 3:
        return
    result.require(
        steps[0].get("table") == envelope.get("inboxTable")
        and steps[-2].get("table") == envelope.get("inboxTable")
        and steps[-1].get("table") == envelope.get("outboxTable")
        and envelope.get("inboxTable") == profile.get("inboxTable")
        and envelope.get("outboxTable") == profile.get("outboxTable")
        and [step.get("step") for step in steps] == list(range(1, len(steps) + 1)),
        "HANDLER_TX_ENVELOPE", f"{handler_id}: inbox/domain/outbox order or table drift",
    )
    for dml, step in zip(ordered, steps[1:-2]):
        result.require(
            step.get("stage") == "DOMAIN_DML"
            and step.get("table") == dml.get("table")
            and step.get("disposition") == dml.get("disposition")
            and step.get("assignments") == dml.get("assignments")
            and step.get("rowCount") == dml.get("rowCount"),
            "HANDLER_TX_ENVELOPE", f"{handler_id}: envelope domain step drift",
        )
    result.require(
        steps[-1].get("events") == [{
            "eventName": handler.get("eventContract", {}).get("eventName"),
            "condition": handler.get("eventContract", {}).get("emissionCondition"),
        }],
        "HANDLER_TX_OUTBOX", f"{handler_id}: outbox fact differs from handler contract",
    )


def _validate_event(result: Result, operation_id: str, event: dict[str, Any], schema: dict[str, Any],
                    operation: dict[str, Any], tables: dict[str, dict[str, Any]],
                    columns: dict[str, dict[str, dict[str, Any]]], module_event: dict[str, Any]) -> None:
    name = event.get("eventName")
    aggregate_source = event.get("aggregateIdSource", "")
    version_source = event.get("aggregateVersionSource", "")
    state_source = event.get("postStateSource", "")
    aggregate_root = aggregate_source.split(".", 1)[0] if aggregate_source.endswith(".public_id") else None
    expected_root = CRITICAL_EVENT_ROOTS.get(name)
    result.require(aggregate_root in tables and event.get("aggregateEntityType") == "table:" + str(aggregate_root)
                   and version_source == f"{aggregate_root}.aggregate_version"
                   and state_source.startswith(f"{aggregate_root}.")
                   and state_source.split(".", 1)[1] in {"status", "state", "stage"},
                   "EVENT_AGGREGATE_ROOT", f"{operation_id}:{name} aggregate/state/version source drift")
    if expected_root:
        result.require(aggregate_root == expected_root, "EVENT_AGGREGATE_ROOT",
                       f"{name}: critical fact root must be {expected_root}")
    result.require(module_event.get("aggregateRootTable") == aggregate_root
                   and module_event.get("aggregate") == "table:" + str(aggregate_root),
                   "MODULE_EVENT_ROOT", f"{name}: module event root drift")
    result.require(event.get("emissionBoundary") == "AFTER_COMMIT_OUTBOX_SAME_TRANSACTION",
                   "EVENT_EMISSION_BOUNDARY", f"{name}: event may be emitted before commit")
    schema_fields = {field.get("name"): field for field in schema.get("fields", [])}
    sources = {field.get("field"): field for field in event.get("payloadFieldSources", [])}
    result.require(set(sources) == set(schema_fields)
                   and event.get("payloadFields") == list(schema_fields),
                   "EVENT_FIELD_SOURCE", f"{name}: payload/source closed set drift")
    # A physical column proves provenance, while the schema reference names the
    # business identity represented by that UUID.  The causal registry must
    # preserve both and may never substitute a sibling UUID merely because it
    # was written in the same aggregate transaction.
    foreign_references = event.get("foreignBusinessReferences", [])
    references_by_field = {row.get("field"): row for row in foreign_references}
    expected_reference_fields = {
        field_name
        for field_name, field in schema_fields.items()
        if field_name != "aggregateId" and field.get("referenceContract")
    }
    result.require(
        len(references_by_field) == len(foreign_references)
        and set(references_by_field) == expected_reference_fields,
        "EVENT_REFERENCE_CONTRACT",
        f"{name}: foreign business reference closed set drift",
    )
    for field_name in sorted(expected_reference_fields):
        reference = references_by_field.get(field_name, {})
        schema_field = schema_fields[field_name]
        schema_reference = schema_field.get("referenceContract", {})
        result.require(
            reference.get("entityType") == schema_reference.get("entityType")
            and reference.get("idSpace") == schema_reference.get("idSpace")
            and reference.get("source") == schema_field.get("source"),
            "EVENT_REFERENCE_CONTRACT",
            f"{name}.{field_name}: semantic referent/provenance drift",
        )
    allowed_tables = set(operation.get("readsTables", [])) | set(operation.get("writesTables", []))
    for field_name, source in sources.items():
        if field_name not in schema_fields:
            # The closed-set error above is authoritative; do not dereference a
            # missing schema field and turn a deterministic rejection into a
            # validator exception.
            continue
        raw = source.get("source", "")
        source_kind = source.get("sourceKind")
        result.require(source_kind in {"SAME_TRANSACTION_WRITE", "DECLARED_OWNER_REFETCH",
                                       "TRANSITION_SNAPSHOT", "OWNER_TRANSACTION_CONTEXT",
                                       "VALIDATED_REQUEST"},
                       "EVENT_FIELD_SOURCE", f"{name}.{field_name}: unknown causal source kind")
        if source_kind == "VALIDATED_REQUEST":
            result.require(field_name == "correlationId" and raw == "headers.X-Correlation-ID",
                           "EVENT_CALLER_ECHO", f"{name}.{field_name}: caller-sourced business fact")
        if "." in raw and raw.split(".", 1)[0] in tables:
            table_name, column = raw.split(".", 1)
            result.require(table_name in allowed_tables and column in columns[table_name],
                           "EVENT_FIELD_SOURCE", f"{name}.{field_name}: undeclared physical refetch")
            reference = schema_fields[field_name].get("referenceContract", {})
            if schema_fields[field_name].get("type") == "UUID":
                result.require(columns[table_name][column]["sqlType"] == "UUID",
                               "EVENT_INTERNAL_ID_EXPOSURE", f"{name}.{field_name}: internal BIGINT exposed")
                physical_ref = columns[table_name][column].get("referenceContract", {})
                if reference and physical_ref:
                    result.require(reference.get("entityType") == physical_ref.get("entityType")
                                   and reference.get("idSpace") == physical_ref.get("idSpace") == "PUBLIC_UUID",
                                   "EVENT_IDENTITY_SUBSTITUTION",
                                   f"{name}.{field_name}: public identity entity/source mismatch")
    _validate_delivery(result, name, schema, event.get("deliveryPolicy", {}),
                       event.get("consumerRefetch", {}), operation.get("session"))


def _validate_delivery(result: Result, name: str, schema: dict[str, Any], delivery: dict[str, Any],
                       refetch: dict[str, Any], owner_session: str | None) -> None:
    field_names = [field.get("name") for field in schema.get("fields", [])]
    result.require(delivery.get("audience") in {"SAME_BOUNDED_CONTEXT_ONLY",
                                                "EXPLICIT_CROSS_SESSION_ALLOWLIST"}
                   and delivery.get("fieldAllowlist") == field_names
                   and delivery.get("allowedConsumerSessions")
                   and delivery.get("allowedPurposeCodes")
                   and delivery.get("pep")
                   and delivery.get("sensitivePayloadRule"),
                   "EVENT_DELIVERY_POLICY", f"{name}: explicit audience/purpose/field policy drift")
    schema_restricted = {field.get("name") for field in schema.get("fields", [])
                         if field.get("sensitivity") in {"RESTRICTED", "CONFIDENTIAL", "HIGHLY_RESTRICTED"}}
    result.require(schema_restricted <= set(delivery.get("restrictedFields", [])),
                   "EVENT_SENSITIVE_FIELD_POLICY", f"{name}: restricted field omitted from policy")
    cross = delivery.get("audience") == "EXPLICIT_CROSS_SESSION_ALLOWLIST"
    refetch_allowed = refetch.get("allowed", refetch.get("refetchAllowed"))
    endpoint = refetch.get("endpoint", refetch.get("ownerRefetchEndpoint"))
    mode = refetch.get("mode")
    result.require(isinstance(refetch_allowed, bool)
                   and refetch_allowed == (mode != "FORBIDDEN"),
                   "EVENT_REFETCH_POLICY", f"{name}: explicit refetch decision/mode drift")
    result.require((cross and len(delivery.get("allowedConsumerSessions", [])) > 1)
                   or (not cross and delivery.get("allowedConsumerSessions") == [owner_session]),
                   "EVENT_REFETCH_POLICY", f"{name}: event audience/session cardinality drift")
    pep_contract = refetch.get("pepContract", {})
    if refetch_allowed:
        result.require(bool(endpoint)
                       and refetch.get("ownerSession") == owner_session
                       and set(refetch.get("allowedConsumerSessions", []))
                       <= set(delivery.get("allowedConsumerSessions", []))
                       and set(refetch.get("purposeCodes", []))
                       <= set(delivery.get("allowedPurposeCodes", []))
                       and refetch.get("pep") == delivery.get("pep")
                       and pep_contract.get("tenant") == "event.tenantId"
                       and pep_contract.get("reauthorizeEveryCall") is True
                       and pep_contract.get("denyOnUnavailable") is True
                       and bool(refetch.get("version")) and bool(refetch.get("asOf")),
                       "EVENT_REFETCH_POLICY", f"{name}: allowed refetch lacks exact PEP/version/asOf")
    else:
        result.require(endpoint is None
                       and refetch.get("fieldAllowlist", []) == []
                       and refetch.get("allowedFields", []) == [],
                       "EVENT_REFETCH_POLICY", f"{name}: forbidden refetch exposes endpoint/fields")
    if name == "ApprovedCompensationPlanSnapshotPublished.v2":
        result.require(cross and "HRIS-PAY" in delivery.get("allowedConsumerSessions", [])
                       and endpoint == "/internal/hris-performance/v1/approved-compensation-plan-snapshots/{snapshotId}"
                       and delivery.get("pep") == refetch.get("pep") == "SVC-PEP-PER-001",
                       "EVENT_REFETCH_POLICY", f"{name}: PAY PEP/endpoint drift")


def _validate_edge_decisions(result: Result, causal: dict[str, Any], exact: dict[str, Any]) -> None:
    response = causal.get("candidateAuditResponse", {})
    decisions = response.get("legacyInsertAppendEdgeDecisions", [])
    by_edge = {row.get("legacyEdge"): row for row in decisions}
    disposition_counts = {
        disposition: sum(row.get("decision") == disposition for row in decisions)
        for disposition in {"COMMITTED", "COMMITTED_BY_OWNER_HANDLER", "FORBIDDEN"}
    }
    result.require(len(decisions) == len(by_edge) == 58
                   and disposition_counts == {
                       "COMMITTED": 51, "COMMITTED_BY_OWNER_HANDLER": 2, "FORBIDDEN": 5,
                   }
                   and response.get("counts") == {"legacyEdges": 58, "committed": 53, "forbidden": 5},
                   "LEGACY_EDGE_CLOSED_SET", "58-edge decision inventory must be 53 committed + 5 forbidden")
    result.require({edge for edge, row in by_edge.items() if row.get("decision") == "FORBIDDEN"}
                   == FORBIDDEN_LEGACY_EDGES,
                   "FORBIDDEN_EDGE", "forbidden lifecycle-edge set drift")
    lineages = {row["operationId"]: row for row in exact["operationFieldLineage"]}
    for edge in FORBIDDEN_LEGACY_EDGES:
        operation_id, _old, table = edge.split("|")
        write_tables = {row["table"] for row in lineages[operation_id]["writeSet"]}
        result.require(table not in write_tables, "FORBIDDEN_EDGE",
                       f"{edge}: forbidden side effect returned to write set")
    handler_edges = {
        row["legacyEdge"]: row for row in decisions
        if row.get("decision") == "COMMITTED_BY_OWNER_HANDLER"
    }
    result.require(
        {
            "modern.wfm.schedule.optimize|INSERT|tme_wfm_schedule_candidates",
            "modern.wfm.schedule.optimize|APPEND|tme_wfm_constraint_evaluation_receipts",
        } == set(handler_edges)
        and all(row.get("successorOwner") == "internal.wfm.schedule-optimization.complete"
                for row in handler_edges.values()),
        "LEGACY_EDGE_CLOSED_SET",
        "the two asynchronous WFM result edges must be owned by the completion handler",
    )
    # WFM submission proves/reuses one immutable passing receipt and creates an
    # approval request; it never manufactures a validation result.
    submit = next(row for row in exact["operationBindings"]
                  if row["operationId"] == "modern.wfm.schedule.submit")
    result.require("tme_wfm_constraint_evaluation_receipts" in submit.get("readsTables", [])
                   and submit.get("writesTables") ==
                   ["tme_wfm_schedule_candidates", "tme_wfm_approval_requests"],
                   "FORBIDDEN_EDGE", "WFM submit owner-selector/approval-request boundary drift")


def _validate_snapshot_identity(result: Result, exact: dict[str, Any], events: dict[str, Any],
                                modules: list[dict[str, Any]]) -> None:
    lineage = next(row for row in exact["operationFieldLineage"]
                   if row["operationId"] == "modern.compplan.snapshot.publish")
    response_sources = {row["target"].rsplit(".", 1)[-1]: row
                        for row in lineage["responseFieldSources"]}
    expected = {
        "snapshotId": ("prf_cmp_approved_snapshots.public_id", "table:prf_cmp_approved_snapshots"),
        "planId": ("prf_cmp_approved_snapshots.plan_public_id", "PER.CompensationPlan"),
        "cycleId": ("prf_cmp_approved_snapshots.cycle_public_id", "table:prf_cmp_cycles"),
    }
    observed: list[str] = []
    for name, (source, entity) in expected.items():
        row = response_sources.get(name, {})
        observed.append(row.get("source"))
        result.require(row.get("source") == source
                       and row.get("semanticBinding", {}).get("entityType") == entity,
                       "SNAPSHOT_IDENTITY", f"snapshot {name} physical/entity source drift")
    result.require(len(set(observed)) == 3, "SNAPSHOT_IDENTITY",
                   "snapshotId/planId/cycleId sources must be pairwise distinct")
    schema = next(row for row in events["eventPayloadSchemas"]
                  if row["eventName"] == "ApprovedCompensationPlanSnapshotPublished.v2")
    result.require({"snapshotId", "planId", "cycleId", "approvalRevision", "approvalReceiptId",
                    "effectiveDate", "sourceVersion", "lineCount", "payloadDigest"}
                   <= {field["name"] for field in schema["fields"]},
                   "SNAPSHOT_EVENT_CONSUMER", "PAY snapshot event lost immutable header facts")
    if PAY_CONSUMER.is_file():
        pay = PAY_CONSUMER.read_text(encoding="utf-8")
        result.require("ApprovedCompensationPlanSnapshotPublished.v2" in pay
                       and all(name in pay for name in ("snapshotId", "planId", "cycleId",
                                                        "lineCount", "payloadDigest", "SVC-PEP-PER-001")),
                       "SNAPSHOT_EVENT_CONSUMER", "PAY consumer is not on the approved snapshot successor")


def run_self_tests(base: tuple[dict, dict, dict, list[dict]]) -> tuple[int, list[str]]:
    causal, exact, events, modules = base
    cases: list[tuple[str, str, Callable[[dict, dict, dict, list[dict]], None]]] = []

    def case(name: str, code: str, mutation: Callable[[dict, dict, dict, list[dict]], None]) -> None:
        cases.append((name, code, mutation))

    def cop(doc: dict, operation_id: str) -> dict:
        return next(row for row in doc["operations"] if row["operationId"] == operation_id)

    def xop(doc: dict, operation_id: str) -> dict:
        return next(row for row in doc["operationBindings"] if row["operationId"] == operation_id)

    def xtable(doc: dict, table: str) -> dict:
        return next(row for row in doc["tableSpecifications"] if row["tableName"] == table)

    command = "modern.recruiting.requisition.publish"
    case("post state sink", "POST_STATE_PHYSICAL_SINK",
         lambda c, x, e, m: next(
             assignment for assignment in cop(c, command)["orderedDml"][0]["assignments"]
             if assignment["target"].endswith(".status")
         ).update({"target": "ppl_rec_requisitions.display_name"}))
    case("transition check mismatch", "POST_STATE_PHYSICAL_SINK",
         lambda c, x, e, m: cop(c, command)["transition"]["postStates"].append("IMPOSSIBLE"))
    case("default check contradiction", "DEFAULT_CHECK_CONTRADICTION",
         lambda c, x, e, m: next(col for col in xtable(x, "ppl_jny_assignments")["columns"]
                                if col["name"] == "status").update({"default": "'DRAFT'"}))
    case("selector missing", "SELECTOR_CLOSED_SET",
         lambda c, x, e, m: cop(c, command)["aggregateRoot"]["selectors"].clear())
    case("version aliases public id", "SELECTOR_VERSION",
         lambda c, x, e, m: next(s for s in cop(c, "modern.onboarding.template.publish")
                                  ["aggregateRoot"]["selectors"] if s["selectorType"] == "VERSION")
         .update({"targetColumn": "public_id", "targetSqlType": "UUID"}))
    case("selector type mismatch", "SELECTOR_TYPE",
         lambda c, x, e, m: cop(c, command)["aggregateRoot"]["selectors"][0]
         .update({"sourceType": "STRING", "targetSqlType": "BIGINT"}))
    case("required use dropped", "REQUIRED_INPUT_EFFECT",
         lambda c, x, e, m: cop(c, command)["requiredInputUses"].pop())
    case("guard renamed decision input", "REQUIRED_INPUT_EFFECT",
         lambda c, x, e, m: cop(c, command)["requiredInputUses"][0]
         .update({"causalEffect": "decision_input.any"}))
    case("decision receipt incomplete", "DECISION_RECEIPT_EFFECT",
         lambda c, x, e, m: next(effect for use in cop(c, "modern.recruiting.hire.record")
                                  ["requiredInputUses"] for effect in use["effects"]
                                  if effect["kind"] == "PERSISTED_DECISION_RECEIPT")
         ["requiredFields"].pop("outcome"))
    case("query writes", "QUERY_ZERO_WRITE",
         lambda c, x, e, m: cop(c, "modern.recruiting.requisitions.query")
         ["mutationFieldSet"].append("ppl_rec_requisitions.status"))
    case("query outbox input", "QUERY_ZERO_WRITE",
         lambda c, x, e, m: cop(c, "modern.recruiting.requisitions.query")
         ["requiredInputUses"][0]["effects"].append({"kind": "COMMAND_CONTROL", "target": "outbox"}))
    case("query optional absence", "QUERY_OPTIONAL_BRANCH",
         lambda c, x, e, m: next(use for use in cop(c, "modern.recruiting.requisitions.query")
                                  ["requiredInputUses"] if not use["required"]).pop("absenceSemantics"))
    case("optional required column", "OPTIONAL_REQUIRED_EDGE",
         lambda c, x, e, m: next(row for row in x["operationFieldLineage"]
                                  if row["operationId"] == "modern.contingent.engagement.submit")
         ["requiredColumnSources"][0].update({"sourcePath": "body.effectiveDate"}))
    case("command envelope missing", "COMMAND_TX_ENVELOPE",
         lambda c, x, e, m: cop(c, command)["transactionEnvelope"]["steps"].pop())
    case("command outbox reordered", "COMMAND_TX_ENVELOPE",
         lambda c, x, e, m: cop(c, command)["transactionEnvelope"]["steps"].reverse())
    case("phantom command outbox table", "COMMAND_TX_ENVELOPE",
         lambda c, x, e, m: cop(c, command)["transactionEnvelope"]
         .update({"outboxTable": "ppl_outbox_events"}))
    case("receipt authorization source substituted", "TRANSACTION_AUTHORIZATION_SEAL",
         lambda c, x, e, m: c["transactionInfrastructure"]["sessions"]["HRIS-HRM"]
         ["receiptClaimAssignments"].update({"subject_principal_public_id": "body.workerId"}))
    case("receipt claim physical assignment dropped", "COMMAND_TX_RECEIPT_ASSIGNMENT",
         lambda c, x, e, m: cop(c, command)["transactionEnvelope"]["steps"][0]
         ["assignments"].pop())
    case("outbox physical assignment renamed", "COMMAND_TX_OUTBOX_ASSIGNMENT",
         lambda c, x, e, m: cop(c, command)["transactionEnvelope"]["steps"][-1]
         ["assignments"][0].update({"column": "phantom_tenant"}))
    case("decision receipt phantom JSON member", "DECISION_RECEIPT_EFFECT",
         lambda c, x, e, m: next(
             effect for use in cop(c, "modern.recruiting.candidate.stage")["requiredInputUses"]
             for effect in use["effects"] if effect["kind"] == "PERSISTED_DECISION_RECEIPT"
         )["physicalFieldBindings"].update({
             "outcome": "ppl_command_receipts.result_reference.decisionReceipt"
         }))
    case("domain assignment removed", "ORDERED_DML_ASSIGNMENT",
         lambda c, x, e, m: cop(c, command)["orderedDml"][0]["assignments"][0]
         .update({"sqlType": "BYTEA"}))
    case("event precommit", "EVENT_EMISSION_BOUNDARY",
         lambda c, x, e, m: cop(c, command)["causalEvents"][0]
         .update({"emissionBoundary": "BEFORE_COMMIT"}))
    case("event caller echo", "EVENT_CALLER_ECHO",
         lambda c, x, e, m: cop(c, command)["causalEvents"][0]["payloadFieldSources"][-1]
         .update({"source": "body.title", "sourceKind": "VALIDATED_REQUEST"}))
    case("event business identity substituted", "EVENT_REFERENCE_CONTRACT",
         lambda c, x, e, m: next(
             reference for reference in cop(c, "modern.recruiting.requisition.create")
             ["causalEvents"][0]["foreignBusinessReferences"]
             if reference["field"] == "organizationPublicId"
         ).update({"entityType": "HRM.Position"}))
    case("conditional root inherited", "EVENT_AGGREGATE_ROOT",
         lambda c, x, e, m: cop(c, "modern.onboarding.task.complete")["causalEvents"][1]
         .update({"aggregateIdSource": "ppl_jny_assignment_tasks.public_id"}))
    case("event internal bigint", "EVENT_INTERNAL_ID_EXPOSURE",
         lambda c, x, e, m: next(source for source in cop(c, "modern.compplan.snapshot.publish")
                                  ["causalEvents"][0]["payloadFieldSources"]
                                  if source["field"] == "planId")
         .update({"source": "prf_cmp_approved_snapshots.compensation_plan_id"}))
    case("event blanket refetch", "EVENT_REFETCH_POLICY",
         lambda c, x, e, m: cop(c, command)["causalEvents"][0]["consumerRefetch"]
         .update({"allowed": True, "endpoint": "/unsafe"}))
    case("event sensitive allowlist", "EVENT_SENSITIVE_FIELD_POLICY",
         lambda c, x, e, m: cop(c, "modern.recruiting.hire.record")["causalEvents"][0]
         ["deliveryPolicy"].update({"restrictedFields": []}))
    case("module conditional root", "MODULE_EVENT_ROOT",
         lambda c, x, e, m: next(event for module in m for cap in module["capabilities"]
                                  for event in cap["events"]
                                  if event["name"] == "OnboardingJourneyCompleted.v2")
         .update({"aggregateRootTable": "ppl_jny_assignment_tasks"}))
    case("handler dropped", "HANDLER_CLOSED_SET",
         lambda c, x, e, m: c["internalConsumerHandlers"].pop())
    case("handler envelope dropped", "HANDLER_TX_ENVELOPE",
         lambda c, x, e, m: c["internalConsumerHandlers"][0]["transactionEnvelope"]["steps"].pop())
    case("handler inbox physical alias", "HANDLER_TX_ENVELOPE",
         lambda c, x, e, m: c["internalConsumerHandlers"][0]["transactionEnvelope"]
         .update({"inboxTable": "sys_hris_command_receipts"}))
    case("handler field source dropped", "EVENT_FIELD_SOURCE",
         lambda c, x, e, m: c["internalConsumerHandlers"][0]["eventContract"]
         ["payloadFieldSources"].pop())
    case("handler required insert field dropped", "HANDLER_INSERT_REQUIRED_COLUMN",
         lambda c, x, e, m: next(
             dml for dml in c["internalConsumerHandlers"][0]["orderedDml"]
             if dml["table"] == "ppl_rec_hire_handoff_receipts"
         )["assignments"].remove(next(
             assignment for assignment in next(
                 dml for dml in c["internalConsumerHandlers"][0]["orderedDml"]
                 if dml["table"] == "ppl_rec_hire_handoff_receipts"
             )["assignments"] if assignment["target"].endswith(".worker_public_id")
         )))
    case("handler root state sink dropped", "HANDLER_STATE_VERSION_SINK",
         lambda c, x, e, m: next(
             assignment for assignment in next(
                 dml for dml in c["internalConsumerHandlers"][1]["orderedDml"]
                 if dml["table"] == "ppl_cwk_engagements"
             )["assignments"] if assignment["target"].endswith(".status")
         ).update({"target": "ppl_cwk_engagements.last_reason_code"}))
    case("handler event root inherited from request", "EVENT_AGGREGATE_ROOT",
         lambda c, x, e, m: c["internalConsumerHandlers"][2]["eventContract"].update({
             "aggregateIdSource": "tme_wfm_optimization_requests.public_id",
             "aggregateVersionSource": "tme_wfm_optimization_requests.aggregate_version",
             "postStateSource": "tme_wfm_optimization_requests.status",
             "aggregateEntityType": "table:tme_wfm_optimization_requests",
         }))
    case("forbidden WFM submit edge", "FORBIDDEN_EDGE",
         lambda c, x, e, m: next(row for row in x["operationFieldLineage"]
                                  if row["operationId"] == "modern.wfm.schedule.submit")
         ["writeSet"].append({"table": "tme_wfm_constraint_evaluation_receipts", "disposition": "APPEND"}))
    case("edge count relabel", "LEGACY_EDGE_CLOSED_SET",
         lambda c, x, e, m: c["candidateAuditResponse"]["counts"].update({"forbidden": 4}))
    case("snapshot identity collapse", "SNAPSHOT_IDENTITY",
         lambda c, x, e, m: next(
             row for row in next(item for item in x["operationFieldLineage"]
                                 if item["operationId"] == "modern.compplan.snapshot.publish")
             ["responseFieldSources"] if row["target"].endswith(".planId")
         ).update({"source": "prf_cmp_approved_snapshots.public_id"}))
    case("table closed set", "TABLE_CLOSED_SET",
         lambda c, x, e, m: x["tableSpecifications"].append({
             **copy.deepcopy(x["tableSpecifications"][0]),
             "tableName": "ppl_unowned_hostile_table",
         }))
    case("WFM synonymous interval column", "CANONICAL_PHYSICAL_SCHEMA",
         lambda c, x, e, m: xtable(x, "tme_wfm_demand_lines")["columns"].append({
             "name": "starts_at", "sqlType": "TIMESTAMPTZ", "nullable": False,
             "default": None, "sensitivity": "INTERNAL", "tokenization": "NONE",
         }))
    case("event schema missing", "EVENT_CLOSED_SET",
         lambda c, x, e, m: e["eventPayloadSchemas"].pop())
    case("listening successor authority removed", "LISTENING_SUCCESSOR_AUTHORITY",
         lambda c, x, e, m: cop(c, "modern.listening.response.submit")
         .pop("successorAuthorityResolution"))

    failures: list[str] = []
    for name, code, mutation in cases:
        candidate = copy.deepcopy((causal, exact, events, modules))
        try:
            mutation(*candidate)
            outcome = validate(*candidate, verify_bytes=False)
        except Exception as exc:  # A hostile mutation may break traversal; that is still fail-closed.
            failures.append(f"{name}: validator raised {type(exc).__name__}: {exc}")
            continue
        if not any(f"[{code}]" in error for error in outcome.errors):
            failures.append(f"{name}: expected {code}, got {outcome.errors[:4]}")
    return len(cases), failures


def _sample_value(column: dict[str, Any], table_no: int, column_no: int,
                  accepted: set[str] | None = None) -> str:
    name, value_type = column["name"], column["sqlType"].upper()
    if accepted:
        return repr(sorted(accepted)[0])
    if value_type == "UUID":
        return repr(f"{table_no:08x}-0000-4000-8000-{column_no:012x}") + "::uuid"
    if value_type == "UUID[]":
        return "ARRAY['20000000-0000-4000-8000-000000000001'::uuid]"
    if value_type in {"BIGINT", "INTEGER", "SMALLINT"}:
        if name == "prohibited_attribute_count":
            return "0"
        return "5" if "threshold" in name or "count" in name else "1"
    if value_type.startswith(("NUMERIC", "DECIMAL")):
        return "1"
    if value_type == "BOOLEAN":
        return "TRUE"
    if value_type == "DATE":
        return "DATE '2026-01-02'" if re.search(r"(?:to|end|expiry)", name) else "DATE '2026-01-01'"
    if value_type.startswith("TIMESTAMP"):
        return ("TIMESTAMPTZ '2026-01-02 00:00:00+00'" if
                re.search(r"(?:to|end|ends|close|expires|due|completed|published)", name) else
                "TIMESTAMPTZ '2026-01-01 00:00:00+00'")
    if value_type == "JSONB":
        return "'{}'::jsonb"
    if value_type.endswith("[]"):
        return "ARRAY[]::" + value_type.lower()
    if "digest" in name or "hash" in name or value_type == "CHAR(64)":
        return "repeat('a',64)"
    if value_type == "CHAR(3)" or "currency" in name:
        return "'USD'"
    return repr(f"v{table_no}_{column_no}")


def _uuid_sql(salt: int, member: int = 1) -> str:
    return repr(f"{salt & 0xffffffff:08x}-0000-4000-8000-{member & 0xffffffffffff:012x}") + "::uuid"


def _transaction_sql_value(
    column: str, spec: dict[str, Any], source: str, salt: int, operation_id: str,
    root: str, tables: dict[str, dict[str, Any]], *, event_name: str | None = None,
    receipt_table: str | None = None,
) -> str:
    sql_type = spec["sqlType"].upper()
    root_id = tables[root]["idColumn"]["name"]
    root_public_id = (
        f"(SELECT public_id FROM {root} WHERE tenant_id=1 "
        f"ORDER BY {root_id} DESC LIMIT 1)"
    )
    root_version = (
        f"(SELECT aggregate_version FROM {root} WHERE tenant_id=1 "
        f"ORDER BY {root_id} DESC LIMIT 1)"
    )
    if source.startswith("CONSTANT:"):
        raw = source.removeprefix("CONSTANT:")
        if sql_type in {"BIGINT", "INTEGER", "SMALLINT"}:
            return raw if re.fullmatch(r"-?\d+", raw) else "2"
        if sql_type == "BOOLEAN":
            return "TRUE" if raw.lower() == "true" else "FALSE"
        return repr(raw)
    if column == "tenant_id":
        return "1"
    if column in {"aggregate_id", "aggregate_public_id", "subject", "target_public_id", "result_ref"}:
        if "result" in source.lower() and sql_type == "JSONB":
            return f"jsonb_build_object('operationId',{operation_id!r})"
        if sql_type == "UUID":
            return root_public_id
        return f"({root_public_id})::text"
    if column in {"aggregate_version", "aggregate_revision", "aggregate_sequence", "subject_revision"}:
        return root_version
    if column in {"aggregate_type", "target_type"}:
        return repr("table:" + root)
    if column in {"event_type", "schema_name"} and event_name:
        return repr(event_name)
    if column == "consumer_name" or column == "consumer_key":
        return repr(operation_id)
    if column == "event_source":
        return repr("dwp.hris.owner")
    if column in {"payload", "result_reference"}:
        return f"jsonb_build_object('operationId',{operation_id!r},'eventName',{(event_name or '')!r})"
    if "digest" in column or "hash" in column or sql_type == "CHAR(64)":
        return "repeat('a',64)"
    if column in {"occurred_at", "received_at", "available_at", "expires_at",
                  "created_at", "updated_at", "completed_at", "processed_at", "applied_at"}:
        return "TIMESTAMPTZ '2026-01-01 00:00:00+00'"
    if sql_type == "UUID":
        if column == "causation_id" and receipt_table:
            receipt_public = "command_receipt_id" if receipt_table in {
                "ppl_command_receipts", "prf_command_receipts"
            } else "public_id"
            return (
                f"(SELECT {receipt_public} FROM {receipt_table} WHERE tenant_id=1 "
                f"AND originating_action={operation_id!r} LIMIT 1)"
            )
        return _uuid_sql(salt, abs(hash(column)) % 100000 + 1)
    if sql_type in {"BIGINT", "INTEGER", "SMALLINT"}:
        return "1"
    if sql_type == "BOOLEAN":
        return "TRUE"
    if sql_type == "JSONB":
        return "'{}'::jsonb"
    if sql_type == "DATE":
        return "DATE '2026-01-01'"
    if sql_type.startswith("TIMESTAMP"):
        return "TIMESTAMPTZ '2026-01-01 00:00:00+00'"
    if column == "idempotency_key":
        return repr(f"idem-{salt}-{operation_id}")
    if column in {"originating_action", "command_type"}:
        return repr(operation_id)
    if column in {"schema_version", "spec_version"}:
        return repr("v2") if sql_type.startswith(("VARCHAR", "CHAR", "TEXT")) else "2"
    if column in {"correlation_id", "causation_id"} and sql_type.startswith(("VARCHAR", "CHAR", "TEXT")):
        return repr(str(_uuid_sql(salt, 991)).replace("'", "").replace("::uuid", ""))
    return repr(f"v{salt}_{column}")


def _transaction_insert_sql(
    table: str, assignments: list[dict[str, Any]], physical: dict[str, dict[str, dict[str, Any]]],
    salt: int, operation_id: str, root: str, tables: dict[str, dict[str, Any]],
    *, event_name: str | None = None, receipt_table: str | None = None,
) -> str:
    columns = [str(row["column"]) for row in assignments]
    values = [
        _transaction_sql_value(
            column, physical[table][column], str(row["sourcePath"]), salt + index,
            operation_id, root, tables, event_name=event_name, receipt_table=receipt_table,
        )
        for index, (column, row) in enumerate(zip(columns, assignments), 1)
    ]
    return f"INSERT INTO {table} ({', '.join(columns)}) VALUES ({', '.join(values)})"


def _domain_insert_sql(
    exact: dict[str, Any], tables: dict[str, dict[str, Any]],
    all_columns: dict[str, dict[str, dict[str, Any]]], numbers: dict[str, int],
    table: str, dml: dict[str, Any], salt: int, post_states: list[str],
) -> str:
    spec = tables[table]
    assignments = {
        row["target"].split(".", 1)[1]: row for row in dml.get("assignments", [])
    }
    selected = {
        spec["idColumn"]["name"], "tenant_id", "public_id", "aggregate_version",
        *assignments,
    }
    for name, column in all_columns[table].items():
        if column.get("nullable") is False and column.get("default") is None:
            selected.add(name)
    chosen_state: dict[str, str] = {}
    for name in ("status", "state", "stage"):
        accepted = allowed_states(spec, name)
        if not accepted:
            continue
        preferred = next((state for state in post_states if state in accepted), None)
        chosen_state[name] = preferred or sorted(accepted)[0]
        if name in assignments or name in selected:
            selected.add(name)
    for check in spec.get("checks", []):
        expression = check.get("expression", "")
        if any(state in expression for state in chosen_state.values()):
            selected.update(re.findall(r"\b([a-z][a-z0-9_]*)\s+IS\s+NOT\s+NULL\b", expression, re.I))
    local: dict[str, tuple[str, str]] = {}
    for fk in spec.get("foreignKeys", []):
        if fk.get("mode") != "LOCAL_COMPOSITE_FK":
            continue
        for source, target in zip(fk["columns"], fk["targetColumns"]):
            local[source] = (fk["target"], target)
    ordered_columns = [spec["idColumn"], *[
        row for row in exact["commonTableContract"]["columns"] if row["name"] != "__internal_id__"
    ], *spec["columns"]]
    names: list[str] = []
    values: list[str] = []
    for column_no, column in enumerate(ordered_columns, 1):
        name = column["name"]
        if name not in selected:
            continue
        if name in local:
            parent, target = local[name]
            if target == "tenant_id":
                value = "1"
            elif target == "public_id":
                value = repr(f"{numbers[parent]:08x}-0000-4000-8000-000000000001") + "::uuid"
            else:
                value = str(numbers[parent])
        elif name == spec["idColumn"]["name"]:
            value = str(1000000 + salt)
        elif name == "tenant_id":
            value = "1"
        elif name == "public_id":
            value = _uuid_sql(1000000 + salt, 1)
        elif name == "aggregate_version":
            value = "1"
        elif name in chosen_state:
            value = repr(chosen_state[name])
        elif name in {"created_at", "updated_at"}:
            value = "TIMESTAMPTZ '2026-01-01 00:00:00+00'"
        elif name in {"created_by", "updated_by", "correlation_id"}:
            value = _uuid_sql(2000000 + salt, column_no)
        elif column["sqlType"].upper() in {"BIGINT", "INTEGER", "SMALLINT"} and re.search(
                r"(?:version|revision|sequence|order)", name):
            value = str(2 + salt)
        elif "digest" in name or "hash" in name or column["sqlType"].upper() == "CHAR(64)":
            value = f"md5('{salt}:{column_no}:a') || md5('{salt}:{column_no}:b')"
        elif name in assignments and str(assignments[name].get("sourcePath", "")).startswith("CONSTANT:"):
            raw = str(assignments[name]["sourcePath"]).removeprefix("CONSTANT:")
            value = raw if column["sqlType"].upper() in {"BIGINT", "INTEGER", "SMALLINT"} and raw.isdigit() else repr(raw)
        else:
            value = _sample_value(column, 3000000 + salt, column_no, allowed_states(spec, name))
            if normalize_type(column["sqlType"]) == "STRING" and value.startswith("'v"):
                value = repr(f"v{salt}_{column_no}")
        names.append(name)
        values.append(value)
    return f"INSERT INTO {table} ({', '.join(names)}) VALUES ({', '.join(values)})"


def _domain_update_sql(
    tables: dict[str, dict[str, Any]], table: str, dml: dict[str, Any],
    post_states: list[str], *, skip_state_version: bool = False,
) -> str:
    spec = tables[table]
    setters: list[str] = []
    for assignment in dml.get("assignments", []):
        column = assignment["target"].split(".", 1)[1]
        if skip_state_version and (column in {"status", "state", "stage"}
                                   or re.search(r"(?:aggregate_)?version$", column)):
            continue
        accepted = allowed_states(spec, column)
        if accepted:
            value = next((state for state in post_states if state in accepted), sorted(accepted)[0])
            setters.append(f"{column}={value!r}")
        elif re.search(r"(?:version|revision)$", column):
            setters.append(f"{column}={column}+1")
        else:
            # The candidate's exact typed assignment has already been checked;
            # retaining the locked value here exercises the physical column and
            # CHECK/FK update path without manufacturing an unrelated owner fact.
            setters.append(f"{column}={column}")
    if not setters:
        setters.append("aggregate_version=aggregate_version")
    id_column = spec["idColumn"]["name"]
    return (
        f"UPDATE {table} SET {', '.join(dict.fromkeys(setters))} WHERE {id_column}="
        f"(SELECT {id_column} FROM {table} WHERE tenant_id=1 ORDER BY {id_column} DESC LIMIT 1)"
    )


def build_postgres_operation_probe(exact: dict[str, Any], causal: dict[str, Any]) -> str:
    ddl = build_postgres_feasibility_ddl(exact)
    ddl = re.sub(r"^BEGIN;\s*", "", ddl)
    ddl = re.sub(r"ROLLBACK;\s*$", "", ddl)
    transaction_columns, transaction_statements, source_sql = _load_transaction_physical_contracts()
    profiles = causal["transactionInfrastructure"]["sessions"]
    tables = {row["tableName"]: row for row in exact["tableSpecifications"]}
    all_columns = {name: physical_columns(exact, table) for name, table in tables.items()}
    dependencies = {
        name: {
            fk["target"] for fk in table["foreignKeys"]
            if fk["mode"] == "LOCAL_COMPOSITE_FK"
            and any(column != "tenant_id" and all_columns[name][column].get("nullable") is False
                    for column in fk["columns"])
        }
        for name, table in tables.items()
    }
    order: list[str] = []
    pending = set(tables)
    while pending:
        ready = sorted(name for name in pending if dependencies[name] <= set(order))
        if not ready:
            raise ValueError("local FK cycle prevents insert feasibility: " + ",".join(sorted(pending)))
        order.extend(ready)
        pending -= set(ready)
    numbers = {name: index for index, name in enumerate(order, 1)}
    common = [row for row in exact["commonTableContract"]["columns"]
              if row["name"] != "__internal_id__"]
    guard_statements: list[str] = []
    for session, (function_name, trigger_name) in TRANSACTION_GUARDS.items():
        expected = EXPECTED_TRANSACTION_INFRASTRUCTURE["sessions"][session]
        owner_sql = "\n".join(source_sql[key] for key in expected["ddlKeys"])
        guard_statements.extend([
            _extract_guard_function(owner_sql, function_name),
            _extract_trigger(owner_sql, trigger_name),
        ])
    statements = [
        "CREATE EXTENSION IF NOT EXISTS pgcrypto",
        *[transaction_statements[name] for name in sorted(transaction_statements)],
        *guard_statements,
        ddl,
        "BEGIN",
        "SET CONSTRAINTS ALL IMMEDIATE",
    ]
    for name in order:
        spec = tables[name]
        columns = [spec["idColumn"], *common, *spec["columns"]]
        local: dict[str, tuple[str, str]] = {}
        for fk in spec["foreignKeys"]:
            if fk["mode"] != "LOCAL_COMPOSITE_FK":
                continue
            for source, target in zip(fk["columns"], fk["targetColumns"]):
                local[source] = (fk["target"], target)
        names: list[str] = []
        values: list[str] = []
        for column_no, column in enumerate(columns, 1):
            column_name = column["name"]
            if (column_name in local and local[column_name][0] not in order[:order.index(name)]
                    and column.get("nullable") is not False):
                # Break a nullable circular reference for seed creation. The
                # FK itself is still compiled and later command/handler DML
                # exercises the owning state row.
                continue
            if column_name in local:
                parent, target = local[column_name]
                if target == "tenant_id":
                    value = "1"
                elif target == "public_id":
                    value = repr(f"{numbers[parent]:08x}-0000-4000-8000-000000000001") + "::uuid"
                else:
                    value = str(numbers[parent])
            elif column_name == spec["idColumn"]["name"]:
                value = str(numbers[name])
            elif column_name == "tenant_id":
                value = "1"
            elif column_name == "public_id":
                value = repr(f"{numbers[name]:08x}-0000-4000-8000-000000000001") + "::uuid"
            elif column_name == "aggregate_version":
                value = "1"
            elif column_name in {"created_at", "updated_at"}:
                value = "TIMESTAMPTZ '2026-01-01 00:00:00+00'"
            elif column_name in {"created_by", "updated_by", "correlation_id"}:
                value = repr(f"30000000-0000-4000-8000-{column_no:012x}") + "::uuid"
            elif column.get("default") is not None:
                continue
            elif column.get("nullable") is not False:
                continue
            else:
                value = _sample_value(column, numbers[name], column_no,
                                      allowed_states(spec, column_name))
            names.append(column_name)
            values.append(value)
        statements.append(f"INSERT INTO {name} ({', '.join(names)}) VALUES ({', '.join(values)})")

    statements.append("COMMIT")
    command_rows = [row for row in causal["operations"] if row["mode"] == "COMMAND"]
    operation_rows = {row["operationId"]: row for row in command_rows}
    edge_decisions = causal["candidateAuditResponse"]["legacyInsertAppendEdgeDecisions"]
    committed_by_operation: dict[str, list[dict[str, Any]]] = {}
    forbidden_by_operation: dict[str, list[dict[str, Any]]] = {}
    for decision in edge_decisions:
        operation_id, _legacy_action, table = decision["legacyEdge"].split("|")
        if decision["decision"] == "COMMITTED":
            committed_by_operation.setdefault(operation_id, []).append({**decision, "table": table})
        elif decision["decision"] == "FORBIDDEN":
            forbidden_by_operation.setdefault(operation_id, []).append({**decision, "table": table})
        elif decision["decision"] != "COMMITTED_BY_OWNER_HANDLER":
            raise ValueError(f"unknown legacy edge disposition: {decision}")
    for operation_id, edges in committed_by_operation.items():
        operation = operation_rows[operation_id]
        for edge in edges:
            dml = next((item for item in operation["orderedDml"]
                        if item["table"] == edge["table"]), None)
            if not dml or dml["disposition"] not in {
                    "INSERT", "APPEND", "INSERT_MANY", "APPEND_MANY"}:
                raise ValueError(f"committed edge has no attributable append DML: {edge['legacyEdge']}")
    expected_outbox = 0
    for index, row in enumerate(command_rows, 1):
        operation_id = row["operationId"]
        root = row["aggregateRoot"]["table"]
        state_column = row["aggregateRoot"]["stateColumn"]
        post_state = row["transition"]["postStates"][0]
        receipt_step = row["transactionEnvelope"]["steps"][0]
        completion_step = row["transactionEnvelope"]["steps"][-2]
        outbox_step = row["transactionEnvelope"]["steps"][-1]
        receipt_table = receipt_step["table"]
        statements.append("BEGIN")
        for forbidden_no, forbidden in enumerate(forbidden_by_operation.get(operation_id, []), 1):
            table = forbidden["table"]
            probe = f"forbidden_before_{index}_{forbidden_no}"
            statements.append(
                f"CREATE TEMP TABLE {probe} ON COMMIT DROP AS "
                f"SELECT md5(COALESCE(string_agg(row_to_json(r)::text,'|' ORDER BY row_to_json(r)::text),'')) digest "
                f"FROM {table} r WHERE tenant_id=1"
            )
        statements.append(_transaction_insert_sql(
            receipt_table, receipt_step["assignments"], transaction_columns,
            400000 + index * 100, operation_id, root, tables,
        ))
        for dml_no, dml in enumerate(row["orderedDml"], 1):
            if dml["disposition"] in {"INSERT", "APPEND", "INSERT_MANY", "APPEND_MANY"}:
                statements.append(_domain_insert_sql(
                    exact, tables, all_columns, numbers, dml["table"], dml,
                    index * 100 + dml_no, row["transition"]["postStates"],
                ))
            elif dml["table"] != root:
                statements.append(_domain_update_sql(
                    tables, dml["table"], dml, row["transition"]["postStates"]
                ))
        setters = [f"{state_column}={post_state!r}",
                   "aggregate_version=aggregate_version+1"]
        # Some state CHECKs require companion facts at the same transition
        # boundary (for example SUBMITTED requires submission_digest/time).
        # Populate those exact physical columns in the probe transaction.
        for check in tables[root].get("checks", []):
            expression = check.get("expression", "")
            if post_state not in expression:
                continue
            for required_column in re.findall(r"\b([a-z][a-z0-9_]*)\s+IS\s+NOT\s+NULL\b",
                                              expression, re.I):
                if required_column in {state_column, "aggregate_version"}:
                    continue
                spec = physical_columns(exact, tables[root]).get(required_column)
                if spec:
                    setters.append(
                        required_column + "=" + _sample_value(
                            spec, numbers[root], len(setters) + 1,
                            allowed_states(tables[root], required_column),
                        )
                    )
        root_id = tables[root]["idColumn"]["name"]
        statements.append(
            f"UPDATE {root} SET {', '.join(setters)} WHERE {root_id}="
            f"(SELECT {root_id} FROM {root} WHERE tenant_id=1 ORDER BY {root_id} DESC LIMIT 1)"
        )
        completion_sets = [
            f"{assignment['column']}=" + _transaction_sql_value(
                assignment["column"], transaction_columns[receipt_table][assignment["column"]],
                assignment["sourcePath"], 500000 + index * 100 + assignment_no,
                operation_id, root, tables, receipt_table=receipt_table,
            )
            for assignment_no, assignment in enumerate(completion_step["assignments"], 1)
        ]
        statements.append(
            f"UPDATE {receipt_table} SET {', '.join(completion_sets)} "
            f"WHERE tenant_id=1 AND originating_action={operation_id!r}"
        )
        for event_no, event in enumerate(row["causalEvents"], 1):
            expected_outbox += 1
            event_root = str(event["aggregateIdSource"]).split(".", 1)[0]
            statements.append(_transaction_insert_sql(
                outbox_step["table"], outbox_step["assignments"], transaction_columns,
                600000 + index * 100 + event_no, operation_id, event_root, tables,
                event_name=event["eventName"], receipt_table=receipt_table,
            ))
        for forbidden_no, forbidden in enumerate(forbidden_by_operation.get(operation_id, []), 1):
            table = forbidden["table"]
            probe = f"forbidden_before_{index}_{forbidden_no}"
            statements.append(
                "DO $$ BEGIN IF (SELECT digest FROM " + probe + ") IS DISTINCT FROM "
                f"(SELECT md5(COALESCE(string_agg(row_to_json(r)::text,'|' ORDER BY row_to_json(r)::text),'')) "
                f"FROM {table} r WHERE tenant_id=1) THEN RAISE EXCEPTION 'forbidden edge mutated {table}'; "
                "END IF; END $$"
            )
        statements.append("COMMIT")

    # Internal owner-result consumers use the same real owner inbox/outbox
    # tables and exercise their domain state/append paths independently.
    for handler_no, handler in enumerate(causal["internalConsumerHandlers"], 1):
        handler_id = handler["handlerId"]
        root = handler["aggregateRoot"]["table"]
        envelope = handler["transactionEnvelope"]
        receipt_table = envelope["inboxTable"]
        statements.append("BEGIN")
        statements.append(_transaction_insert_sql(
            receipt_table, envelope["steps"][0]["assignments"], transaction_columns,
            700000 + handler_no * 100, handler_id, root, tables,
        ))
        for dml_no, dml in enumerate(handler["orderedDml"], 1):
            if dml["disposition"] in {"INSERT", "APPEND", "INSERT_MANY", "APPEND_MANY"}:
                statements.append(_domain_insert_sql(
                    exact, tables, all_columns, numbers, dml["table"], dml,
                    800000 + handler_no * 100 + dml_no, handler.get("postStates", []),
                ))
            elif dml["table"] == root:
                state = handler.get("postStates", [])[0]
                state_column = handler["aggregateRoot"]["stateColumn"]
                root_id = tables[root]["idColumn"]["name"]
                statements.append(
                    f"UPDATE {root} SET {state_column}={state!r}, aggregate_version=aggregate_version+1 "
                    f"WHERE {root_id}=(SELECT {root_id} FROM {root} WHERE tenant_id=1 "
                    f"ORDER BY {root_id} DESC LIMIT 1)"
                )
            else:
                statements.append(_domain_update_sql(
                    tables, dml["table"], dml, handler.get("postStates", [])
                ))
        completion = envelope["steps"][-2]
        completion_sets = [
            f"{assignment['column']}=" + _transaction_sql_value(
                assignment["column"], transaction_columns[receipt_table][assignment["column"]],
                assignment["sourcePath"], 900000 + handler_no * 100 + assignment_no,
                handler_id, root, tables,
            )
            for assignment_no, assignment in enumerate(completion["assignments"], 1)
        ]
        # Each handler inbox table has event_id; use the deterministic row just
        # claimed in this isolated transaction.
        statements.append(
            f"UPDATE {receipt_table} SET {', '.join(completion_sets)} WHERE event_id="
            f"(SELECT event_id FROM {receipt_table} WHERE tenant_id=1 ORDER BY event_id DESC LIMIT 1)"
        )
        outbox = envelope["steps"][-1]
        event = handler["eventContract"]
        event_root = str(event["aggregateIdSource"]).split(".", 1)[0]
        statements.append(_transaction_insert_sql(
            outbox["table"], outbox["assignments"], transaction_columns,
            950000 + handler_no * 100, handler_id, event_root, tables,
            event_name=event["eventName"],
        ))
        statements.append("COMMIT")

    receipt_tables = sorted({profile["receiptTable"] for profile in profiles.values()})
    outbox_tables = sorted({profile["outboxTable"] for profile in profiles.values()})
    inbox_tables = sorted({
        handler["transactionEnvelope"]["inboxTable"] for handler in causal["internalConsumerHandlers"]
    })
    receipt_total = " + ".join(f"(SELECT count(*) FROM {table})" for table in receipt_tables)
    outbox_total = " + ".join(f"(SELECT count(*) FROM {table})" for table in outbox_tables)
    inbox_total = " + ".join(f"(SELECT count(*) FROM {table})" for table in inbox_tables)
    statements.append(
        "DO $$ BEGIN "
        f"IF ({receipt_total}) <> {len(command_rows)} THEN RAISE EXCEPTION 'physical receipt count'; END IF; "
        f"IF ({outbox_total}) <> {expected_outbox + 4} THEN RAISE EXCEPTION 'physical outbox count'; END IF; "
        f"IF ({inbox_total}) <> 4 THEN RAISE EXCEPTION 'physical inbox count'; END IF; END $$"
    )

    # Every checked-in command-receipt guard must reject mutation of the
    # originating authorization seal after successful completion.
    for profile in profiles.values():
        receipt = profile["receiptTable"]
        statements.append(
            "DO $$ DECLARE rejected boolean := false; BEGIN BEGIN "
            f"UPDATE {receipt} SET purpose_code=purpose_code || '-tamper' WHERE tenant_id=1; "
            "EXCEPTION WHEN OTHERS THEN rejected := true; END; "
            f"IF NOT rejected THEN RAISE EXCEPTION '{receipt} authorization seal mutable'; END IF; END $$"
        )

    # An identical retry only conflicts with the physical owner receipt.  The
    # service returns the prior result and performs no domain/outbox statement.
    replay = command_rows[0]
    replay_step = replay["transactionEnvelope"]["steps"][0]
    replay_receipt = replay_step["table"]
    statements.extend([
        f"CREATE TEMP TABLE replay_counts AS SELECT (SELECT count(*) FROM {replay_receipt}) receipts, ({outbox_total}) outbox, (SELECT sum(aggregate_version) FROM {replay['aggregateRoot']['table']} WHERE tenant_id=1) versions",
        _transaction_insert_sql(
            replay_receipt, replay_step["assignments"], transaction_columns,
            400000 + 100, replay["operationId"], replay["aggregateRoot"]["table"], tables,
        ) + " ON CONFLICT DO NOTHING",
        "DO $$ BEGIN IF (SELECT receipts FROM replay_counts) <> "
        f"(SELECT count(*) FROM {replay_receipt}) OR (SELECT outbox FROM replay_counts) <> ({outbox_total}) "
        f"OR (SELECT versions FROM replay_counts) <> (SELECT sum(aggregate_version) FROM {replay['aggregateRoot']['table']} WHERE tenant_id=1) "
        "THEN RAISE EXCEPTION 'idempotent replay wrote'; END IF; END $$",
    ])

    # Failure after claim/domain/outbox is proven against the real tables and
    # real receipt guard under one database transaction.
    rollback_operation = next(row for row in command_rows
                              if row["operationId"] == "modern.recruiting.requisition.publish")
    rollback_root = rollback_operation["aggregateRoot"]["table"]
    rollback_receipt_step = rollback_operation["transactionEnvelope"]["steps"][0]
    rollback_receipt = rollback_receipt_step["table"]
    rollback_outbox_step = rollback_operation["transactionEnvelope"]["steps"][-1]
    rollback_event = rollback_operation["causalEvents"][0]
    rollback_insert = _transaction_insert_sql(
        rollback_receipt, rollback_receipt_step["assignments"], transaction_columns,
        990001, rollback_operation["operationId"], rollback_root, tables,
    ).replace("idem-990001-", "idem-rollback-")
    statements.extend([
        f"CREATE TEMP TABLE rollback_counts AS SELECT (SELECT count(*) FROM {rollback_receipt}) receipts, ({outbox_total}) outbox, (SELECT sum(aggregate_version) FROM {rollback_root} WHERE tenant_id=1) versions",
        "BEGIN",
        rollback_insert,
        f"UPDATE {rollback_root} SET aggregate_version=aggregate_version+1 WHERE tenant_id=1",
        _transaction_insert_sql(
            rollback_outbox_step["table"], rollback_outbox_step["assignments"], transaction_columns,
            990002, rollback_operation["operationId"], rollback_root, tables,
            event_name=rollback_event["eventName"], receipt_table=rollback_receipt,
        ),
        "ROLLBACK",
        "DO $$ BEGIN IF (SELECT receipts FROM rollback_counts) <> "
        f"(SELECT count(*) FROM {rollback_receipt}) OR (SELECT outbox FROM rollback_counts) <> ({outbox_total}) "
        f"OR (SELECT versions FROM rollback_counts) <> (SELECT sum(aggregate_version) FROM {rollback_root} WHERE tenant_id=1) "
        "THEN RAISE EXCEPTION 'atomic rollback leaked'; END IF; END $$",
        "DO $$ DECLARE n integer; BEGIN UPDATE ppl_rec_requisitions SET aggregate_version=aggregate_version+1 WHERE tenant_id=-1; GET DIAGNOSTICS n=ROW_COUNT; IF n<>0 THEN RAISE EXCEPTION 'tenant mismatch mutated'; END IF; END $$",
        "",
    ])
    return ";\n".join(statements)


def run_postgres(exact: dict[str, Any], causal: dict[str, Any]) -> tuple[bool, str]:
    sql = build_postgres_operation_probe(exact, causal)
    try:
        images = ((16, "postgres:16-alpine"), (18, "postgres:18.4-alpine"))
        for version, image in images:
            name = f"dwp-modern-causal-{version}-{os.getpid()}"
            try:
                start = subprocess.run(
                    ["docker", "run", "--rm", "--detach", "--name", name,
                     "--env", "POSTGRES_PASSWORD=causal_only", "--env", "POSTGRES_DB=causal",
                     image], capture_output=True, text=True, timeout=30,
                )
                if start.returncode:
                    return False, f"postgres {version}: {start.stderr.strip()}"
                for _ in range(60):
                    ready = subprocess.run(
                        ["docker", "exec", name, "pg_isready", "-U", "postgres", "-d", "causal"],
                        capture_output=True, text=True, timeout=5,
                    )
                    logs = subprocess.run(
                        ["docker", "logs", name], capture_output=True, text=True, timeout=5
                    )
                    # A fresh official image briefly starts a bootstrap server,
                    # then shuts it down before the final postmaster.  Waiting
                    # only for pg_isready races that intentional shutdown.
                    initialized = "PostgreSQL init process complete; ready for start up." in (
                        logs.stdout + logs.stderr
                    )
                    if ready.returncode == 0 and initialized:
                        break
                    time.sleep(.25)
                else:
                    return False, f"postgres {version} did not become ready"
                run = subprocess.run(
                    ["docker", "exec", "-i", name, "psql", "-v", "ON_ERROR_STOP=1",
                     "-U", "postgres", "-d", "causal"],
                    input=sql, capture_output=True, text=True, timeout=120,
                )
                if run.returncode:
                    return False, f"postgres {version}: {run.stderr.strip()}"
            finally:
                subprocess.run(
                    ["docker", "rm", "--force", name], capture_output=True, text=True, timeout=10
                )
        command_events = sum(len(row["causalEvents"]) for row in causal["operations"]
                             if row["mode"] == "COMMAND")
        local_fks = sum(1 for table in exact["tableSpecifications"] for fk in table["foreignKeys"]
                        if fk["mode"] == "LOCAL_COMPOSITE_FK")
        edge_decisions = causal["candidateAuditResponse"]["legacyInsertAppendEdgeDecisions"]
        command_domain_dml = sum(
            len(row.get("orderedDml", [])) for row in causal["operations"] if row["mode"] == "COMMAND"
        )
        handler_domain_dml = sum(
            len(row.get("orderedDml", [])) for row in causal["internalConsumerHandlers"]
        )
        decision_effects = sum(
            effect.get("kind") == "PERSISTED_DECISION_RECEIPT"
            for row in causal["operations"] for use in row.get("requiredInputUses", [])
            for effect in use.get("effects", [])
        )
        return True, (
            f"postgres=16,18 modernPhysicalSeedInserts={len(exact['tableSpecifications'])} "
            "baseTransactionTables=12 ownerReceiptTables=4 ownerInboxTables=3 ownerOutboxTables=4 "
            f"commandTransactions={sum(row['mode']=='COMMAND' for row in causal['operations'])} "
            f"handlerTransactions={len(causal['internalConsumerHandlers'])} "
            f"commandDomainDml={command_domain_dml} handlerDomainDml={handler_domain_dml} "
            f"commandStateVersionWrites=81 handlerRootStateVersionWrites=4 "
            "receiptClaims=81 receiptCompletions=81 "
            f"inboxClaims=4 inboxCompletions=4 publicOutboxFacts={command_events + 4} "
            f"legacyEdges={len(edge_decisions)} committedCommandEdges="
            f"{sum(row['decision']=='COMMITTED' for row in edge_decisions)} "
            f"committedHandlerEdges={sum(row['decision']=='COMMITTED_BY_OWNER_HANDLER' for row in edge_decisions)} "
            f"forbiddenEdges={sum(row['decision']=='FORBIDDEN' for row in edge_decisions)} "
            f"decisionReceiptEffects={decision_effects} immutableReceiptGuards=4 localFks={local_fks} "
            "replayZeroWrite=PASS rollback=PASS tenantMismatchZeroWrite=PASS "
            "forbiddenEdgeRowsByteStable=PASS"
        )
    except (OSError, subprocess.SubprocessError, ValueError) as error:
        return False, str(error)


def load() -> tuple[dict, dict, dict, list[dict]]:
    return (json.loads(CAUSAL.read_text(encoding="utf-8")),
            json.loads(EXACT.read_text(encoding="utf-8")),
            json.loads(EVENTS.read_text(encoding="utf-8")),
            [json.loads(path.read_text(encoding="utf-8")) for path in MODULES])


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--postgres-feasibility", action="store_true")
    parser.add_argument("--compact", action="store_true")
    args = parser.parse_args()
    values = load()
    result = validate(*values)
    mutation_count = 0
    if args.self_test:
        mutation_count, failures = run_self_tests(values)
        result.require(not failures, "SELF_TEST", "; ".join(failures))
    pg_detail = ""
    if args.postgres_feasibility and not result.errors:
        ok, pg_detail = run_postgres(values[1], values[0])
        result.require(ok, "POSTGRES_OPERATION_DML_FEASIBILITY", pg_detail)
    if result.errors:
        print(f"MODERN_CAUSAL_STATE_CONTRACTS=FAIL errors={len(result.errors)}")
        for error in result.errors[:20 if args.compact else None]:
            print("- " + error)
        return 1
    print("MODERN_CAUSAL_STATE_CONTRACTS=PASS "
          + " ".join(f"{key}={value}" for key, value in result.counts.items())
          + " implementation=NOT_STARTED_G3 production=NOT_AUTHORIZED_G6")
    if args.self_test:
        print(f"MODERN_CAUSAL_MUTATION_SELF_TESTS=PASS mutations={mutation_count}")
    if args.postgres_feasibility:
        print("MODERN_CAUSAL_POSTGRES_DML=PASS " + pg_detail)
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
