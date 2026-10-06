#!/usr/bin/env python3
"""Deterministic semantic normalization for the five HRIS child traces.

Only target-design fields are normalized.  Source identity, source location,
fingerprint, parent linkage, child ID, disposition, and decision evidence are
never changed by this module.
"""

from __future__ import annotations

import re
from collections import Counter
from typing import Iterable


QUERY = "QUERY"
COMMAND = "COMMAND"
LEGACY_GET_SIDE_EFFECT = "LEGACY_GET_SIDE_EFFECT"
MENU_QUERY = "MENU_QUERY"
JOB_COMMAND = "JOB_COMMAND"
INTERFACE_COMMAND = "INTERFACE_COMMAND"
FILE_COMMAND_QUERY = "FILE_COMMAND_QUERY"
FORMULA_EVALUATION = "FORMULA_EVALUATION"
DATA_CONTRACT = "DATA_CONTRACT"
RETIRED = "RETIRED"

SEMANTIC_PREFIXES = (
    "QUERY:",
    "COMMAND:",
    "ROUTE_QUERY:",
    "JOB_COMMAND:",
    "INTERFACE_COMMAND:",
    "FILE_COMMAND_QUERY:",
    "FORMULA_EVALUATION:",
    "DATA_CONTRACT:",
    "RETIRED_NO_TARGET:",
)

DEPRECATED_TARGET_ALIASES = (
    "WorkforceWidgetSnapshot",
    "WorkerAssignmentChanged",
    "WorkerAvailabilityChanged",
    "OrganizationRelationshipPublished",
    "WorkerPayrollFactsChanged",
    "WorkerBankAccountVerified",
)

MUTATION_NAME_TOKENS = (
    "create", "save", "insert", "update", "modify", "delete", "remove",
    "submit", "approve", "reject", "cancel", "publish", "apply", "issue",
    "revoke", "register", "sync", "execute", "run", "close", "reopen",
    "reverse", "import", "upload", "send", "write", "commit", "release",
)

QUERY_NAME_TOKENS = (
    "get", "find", "select", "list", "search", "read", "view", "preview",
    "count", "check", "download", "export", "query", "lookup", "status",
)

IDENTITY_FIELDS = (
    "child_id", "parent_artifact_id", "session_id", "source_module",
    "child_type", "source_file", "source_line", "source_fingerprint",
    "disposition", "decision_status", "decision_id", "owner_role",
)


def _has_query_state(state: str) -> bool:
    lowered = state.lower()
    return (
        "query" in lowered
        or "projection" in lowered
        or lowered.startswith("none")
        or lowered.startswith("not_applicable")
        or lowered.startswith("query_only")
    )


def _http_verb(trigger: str) -> str:
    match = re.search(r"(?:\bHTTP\s+|^|\b)(GET|POST|PUT|PATCH|DELETE|REQUEST)(?:_OPERATION|\s|\b)", trigger, re.I)
    return match.group(1).upper() if match else ""


def _operation_name_implies_mutation(trigger: str) -> bool:
    lowered = trigger.lower()
    return any(token in lowered for token in MUTATION_NAME_TOKENS)


def _operation_name_implies_query(trigger: str) -> bool:
    lowered = trigger.lower()
    return any(token in lowered for token in QUERY_NAME_TOKENS)


def legacy_get_side_effect_keys(rows: Iterable[dict[str, str]]) -> set[tuple[str, str, str]]:
    """Return locations where an explicit companion trace proves GET mutated state."""
    return {
        (row["session_id"], row["parent_artifact_id"], row["source_line"])
        for row in rows
        if row["child_type"] == "STATE_TRANSITION"
        and (
            row["trigger"].upper().startswith("GET COMMAND")
            or "LEGACY_GET_SIDE_EFFECT" in row["trigger"].upper()
        )
    }


def semantic_intent(
    row: dict[str, str],
    legacy_get_keys: set[tuple[str, str, str]] | None = None,
) -> str:
    child_type = row["child_type"]
    target = row["target_api_event_candidate"].strip()
    if row["disposition"] == "RETIRE" and (
        target.upper() == "NONE"
        or "NO TARGET ENDPOINT" in target.upper()
        or "RETIRED_NO_TARGET" in target.upper()
        or "GOVERNED ABSENCE; DECISION=" in target.upper()
    ):
        return RETIRED
    if child_type == "MENU_ELEMENT":
        return MENU_QUERY
    if child_type == "JOB":
        return JOB_COMMAND
    if child_type == "INTERFACE":
        return INTERFACE_COMMAND
    if child_type == "FILE_DOCUMENT":
        return FILE_COMMAND_QUERY
    if child_type == "FORMULA_BEHAVIOR":
        return FORMULA_EVALUATION
    if child_type == "SQL_BEHAVIOR":
        return DATA_CONTRACT
    if child_type == "STATE_TRANSITION":
        if _http_verb(row["trigger"]) == "GET" or "LEGACY_GET_SIDE_EFFECT" in row["trigger"].upper():
            return LEGACY_GET_SIDE_EFFECT
        return COMMAND

    verb = _http_verb(row["trigger"])
    key = (row["session_id"], row["parent_artifact_id"], row["source_line"])
    if verb == "GET":
        if (
            _operation_name_implies_mutation(row["trigger"])
            or (legacy_get_keys is not None and key in legacy_get_keys)
        ):
            return LEGACY_GET_SIDE_EFFECT
        return QUERY
    if verb in {"POST", "PUT", "PATCH", "DELETE"}:
        return COMMAND
    if verb == "REQUEST":
        if _operation_name_implies_query(row["trigger"]) and not _operation_name_implies_mutation(row["trigger"]):
            return QUERY
        return COMMAND

    lowered = row["trigger"].lower()
    if any(token in lowered for token in ("command", "notification", "ingest", "persist", "write")):
        return COMMAND
    if _has_query_state(row["state_transitions"]):
        return QUERY
    return COMMAND


def _strip_semantic_prefix(target: str) -> str:
    value = target.strip()
    for prefix in SEMANTIC_PREFIXES:
        if value.upper().startswith(prefix):
            value = value[len(prefix):].strip()
            break
    return value


def _strip_leading_method(target: str) -> str:
    return re.sub(
        r"^(?:GET\s*[|/]\s*POST|GET\s*[|/]\s*PUT|GET|POST|PUT|PATCH|DELETE)\s+",
        "",
        target,
        flags=re.I,
    ).strip()


def _method_target(base: str, method: str) -> str:
    clean = _strip_leading_method(_strip_semantic_prefix(base))
    if clean.upper() in {"NONE", "NO TARGET ENDPOINT"}:
        return clean
    if method == "POST" and "{?" in clean:
        clean = re.sub(r"\{\?[^}]+\}", "/{resourcePublicId}/commands", clean, count=1)
    if clean.startswith("/"):
        return f"{method} {clean}"
    return clean


def normalize_target(row: dict[str, str], intent: str) -> str:
    base = row["target_api_event_candidate"]
    if intent == RETIRED:
        return f"RETIRED_NO_TARGET: governed absence; decision={row['decision_id']}"
    if intent == MENU_QUERY:
        return f"ROUTE_QUERY: {_method_target(base, 'GET')}"
    if intent == QUERY:
        return f"QUERY: {_method_target(base, 'GET')}"
    if intent in {COMMAND, LEGACY_GET_SIDE_EFFECT}:
        return f"COMMAND: {_method_target(base, 'POST')}"
    if intent == JOB_COMMAND:
        return f"JOB_COMMAND: {_method_target(base, 'POST')}"
    if intent == INTERFACE_COMMAND:
        return f"INTERFACE_COMMAND: {_method_target(base, 'POST')}"
    if intent == FILE_COMMAND_QUERY:
        return f"FILE_COMMAND_QUERY: {_method_target(base, 'GET|POST')}"
    if intent == FORMULA_EVALUATION:
        return f"FORMULA_EVALUATION: {_method_target(base, 'POST')}"
    if intent == DATA_CONTRACT:
        return f"DATA_CONTRACT: {_strip_semantic_prefix(base)}"
    raise ValueError(f"unsupported semantic intent: {intent}")


def _domain_state_detail(state: str) -> str:
    value = state.strip()
    value = re.sub(
        r"^(?:COMMAND_LIFECYCLE|JOB_LIFECYCLE|INTERFACE_LIFECYCLE|FILE_LIFECYCLE|"
        r"DETERMINISTIC_EVALUATION|PERSISTENCE_INVARIANTS)\s*;\s*",
        "",
        value,
        flags=re.I,
    )
    if "->" in value and not _has_query_state(value):
        return value
    return "REQUESTED->VALIDATED->APPLIED|REJECTED; corrections are versioned and audit is immutable"


def normalize_state(row: dict[str, str], intent: str) -> str:
    if intent == RETIRED:
        return "RETIRED; no target runtime state"
    if intent in {MENU_QUERY, QUERY}:
        return "QUERY_ONLY; no aggregate state change; authorization and projection freshness are evaluated"
    if intent in {COMMAND, LEGACY_GET_SIDE_EFFECT}:
        return f"COMMAND_LIFECYCLE; {_domain_state_detail(row['state_transitions'])}"
    if intent == JOB_COMMAND:
        return "JOB_LIFECYCLE; QUEUED->RUNNING->SUCCEEDED|FAILED|RESULT_UNKNOWN; retry creates a new attempt under one idempotency key"
    if intent == INTERFACE_COMMAND:
        return "INTERFACE_LIFECYCLE; RECEIVED->VALIDATING->APPLIED|PARTIAL|QUARANTINED|REJECTED; replay is receipt-based"
    if intent == FILE_COMMAND_QUERY:
        return "FILE_LIFECYCLE; REQUESTED->SCANNING->AVAILABLE|REJECTED->EXPIRED|REVOKED; every download is audited"
    if intent == FORMULA_EVALUATION:
        return "DETERMINISTIC_EVALUATION; no aggregate lifecycle mutation; result retains ruleVersion and inputDigest"
    if intent == DATA_CONTRACT:
        return "PERSISTENCE_INVARIANTS; tenant ownership, version/effective-time, immutable history and corrective semantics are explicit"
    raise ValueError(f"unsupported semantic intent: {intent}")


def _append_required(value: str, terms: tuple[str, ...], clause: str) -> str:
    lowered = value.lower()
    if all(term.lower() in lowered for term in terms):
        return value
    return f"{value.rstrip(' ;')}; semantic-contract: {clause}"


def normalize_contract_fields(row: dict[str, str], intent: str) -> None:
    if intent in {COMMAND, LEGACY_GET_SIDE_EFFECT}:
        row["input_contract"] = _append_required(
            row["input_contract"], ("Idempotency-Key", "expectedVersion"),
            "tenant from trusted context; public IDs; schemaVersion; Idempotency-Key; expectedVersion; effectiveAt",
        )
        row["output_contract"] = _append_required(
            row["output_contract"], ("command receipt", "correlation"),
            "durable command receipt with outcome, resource revision, correlationId and result-unknown handling",
        )
    elif intent in {QUERY, MENU_QUERY}:
        row["input_contract"] = _append_required(
            row["input_contract"], ("asOf", "cursor"),
            "tenant from trusted context; public IDs; asOf; cursor; filter; purpose",
        )
        row["output_contract"] = _append_required(
            row["output_contract"], ("projection",),
            "field-filtered projection with revision, freshness and pagination metadata",
        )
    elif intent == JOB_COMMAND:
        row["input_contract"] = _append_required(
            row["input_contract"], ("signed job manifest", "schema", "Idempotency-Key", "lease"),
            "signed job manifest/version; schema parameters; tenant scope; Idempotency-Key; lease policy",
        )
        row["output_contract"] = _append_required(
            row["output_contract"], ("run receipt", "row counts", "reconciliation"),
            "lease-backed run receipt with row counts, error artifact, retry attempt and reconciliation status",
        )
    elif intent == INTERFACE_COMMAND:
        row["input_contract"] = _append_required(
            row["input_contract"], ("adapter", "mapping version", "cursor", "Idempotency-Key"),
            "adapter manifest/version; mapping version; schemaVersion; cursor; signed object reference; Idempotency-Key",
        )
        row["output_contract"] = _append_required(
            row["output_contract"], ("receipt", "quarantine", "reconciliation"),
            "durable receipt with accepted/rejected counts, canonical errors, quarantine reference and reconciliation totals",
        )
    elif intent == FILE_COMMAND_QUERY:
        row["input_contract"] = _append_required(
            row["input_contract"], ("object reference", "content digest", "purpose"),
            "versioned template/format; object reference; content digest; purpose; asOf/filter snapshot",
        )
        row["output_contract"] = _append_required(
            row["output_contract"], ("malware", "digest", "expiry", "audit"),
            "malware-scanned object reference with digest, row counts, expiry and download audit",
        )
    elif intent == FORMULA_EVALUATION:
        row["input_contract"] = _append_required(
            row["input_contract"], ("ruleVersion", "decimal", "missing/null", "inputDigest"),
            "ruleVersion; decimal inputs; currency/unit; explicit missing/null policy; inputDigest",
        )
        row["output_contract"] = _append_required(
            row["output_contract"], ("intermediate", "final", "lineage"),
            "deterministic intermediate/final decimal values with ruleVersion, inputDigest and lineage",
        )
        row["validation_rules"] = _append_required(
            row["validation_rules"], ("rounding", "reproducibility", "no executable tenant expression"),
            "decimal scale and rounding; bounds; missing/null policy; reproducibility; no executable tenant expression",
        )
    elif intent == DATA_CONTRACT:
        row["input_contract"] = _append_required(
            row["input_contract"], ("tenant", "version", "effective"),
            "tenant identity; public ID; aggregate version; [effectiveFrom,effectiveTo); schemaVersion",
        )
        row["output_contract"] = _append_required(
            row["output_contract"], ("tenant", "immutable", "correction"),
            "tenant-scoped constraints; non-overlap; immutable ledger/history or versioned correction",
        )


def normalize_row(
    source: dict[str, str],
    legacy_get_keys: set[tuple[str, str, str]] | None = None,
) -> dict[str, str]:
    row = dict(source)
    identity = {field: row[field] for field in IDENTITY_FIELDS}
    intent = semantic_intent(row, legacy_get_keys)
    if intent == LEGACY_GET_SIDE_EFFECT and "LEGACY_GET_SIDE_EFFECT" not in row["trigger"].upper():
        row["trigger"] = f"LEGACY_GET_SIDE_EFFECT isolated; {row['trigger']}; target uses guarded command semantics"
    row["target_api_event_candidate"] = normalize_target(row, intent)
    row["state_transitions"] = normalize_state(row, intent)
    normalize_contract_fields(row, intent)
    if identity != {field: row[field] for field in IDENTITY_FIELDS}:
        raise AssertionError(f"source identity changed while normalizing {row['child_id']}")
    return row


def normalize_rows(rows: list[dict[str, str]]) -> list[dict[str, str]]:
    keys = legacy_get_side_effect_keys(rows)
    normalized = [normalize_row(row, keys) for row in rows]
    if len(normalized) != len(rows):
        raise AssertionError("semantic normalization changed row count")
    if Counter(row["child_id"] for row in normalized) != Counter(row["child_id"] for row in rows):
        raise AssertionError("semantic normalization changed child IDs")
    return normalized
