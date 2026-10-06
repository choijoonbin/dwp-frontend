#!/usr/bin/env python3
"""Independent fail-closed proof for all 98 IA entry/access contracts.

The validator intentionally does not import the IA generator.  It resolves
entry queries and actions from the PEP, modern, shared and projection source
contracts, then proves the persona -> package -> duty -> capability path and
the closed browser response schema independently.
"""

from __future__ import annotations

import argparse
import copy
import csv
import glob
import json
import re
from collections import Counter
from pathlib import Path
from typing import Any


HERE = Path(__file__).resolve().parent
ROOT = HERE.parent

IA_HEADER = [
    "ia_node_id", "source_set", "source_node_key", "inventory_group",
    "navigation_surface", "owner_session", "runtime_owner", "personas",
    "source_lifecycle", "canonical_route", "workbench_tab", "source_family_refs",
    "api_contract_refs", "entry_query_refs", "visibility_capability_refs",
    "action_contract_refs", "action_capability_refs", "persona_access_profiles",
    "entry_contract_state", "authorization_refs", "authorization_source_refs",
    "deep_link_template", "implementation_state", "production_state", "source_ref",
    "source_digest_sha256", "compatibility_decision_ref",
]
ACCESS_HEADER = [
    "ia_node_id", "canonical_personas", "entry_mode", "entry_query_refs",
    "visibility_capability_refs", "action_refs", "action_capability_refs",
    "persona_access_profiles", "source_family_refs", "access_contract_state", "rationale",
]
PROJECTION_HEADER = [
    "query_id", "projection_family", "variant_key", "ia_node_id", "owner_session",
    "primary_slice_id", "owner_service", "method", "browser_path",
    "response_schema_ref", "authorization_capability", "authorization_profiles",
    "field_scope", "purpose_code", "implementation_state", "production_state",
]
EXCEPTION_HEADER = [
    "exception_id", "ia_node_id", "contract_ref", "persona", "required_entitlements",
    "hris_access_package", "hris_atomic_duty", "external_capability",
    "external_authorization_source", "sod_constraint", "state",
]
API_QUERY_HEADER = [
    "query_id", "operation_id", "ia_node_id", "owner_session", "primary_slice_id",
    "owner_service", "method", "browser_path", "owner_path", "request_schema_ref",
    "response_schema_ref", "problem_schema_ref", "authorization_capability",
    "authorization_profiles", "pep_layers", "allowed_filters", "allowed_sorts",
    "default_sort", "max_page_size", "deep_link_route", "action_keys", "action_provenance_refs",
    "test_allocation_id", "runtime_invariant_ids", "implementation_state", "production_state",
]
RUNTIME_HEADER = [
    "query_id", "primary_slice_id", "owner_session", "test_allocation_id",
    "required_invariants", "required_test_class", "required_test_methods",
    "evidence_state", "production_state",
]
FIELD_TYPE_HEADER = ["field_group", "value_type", "owner_sessions", "wire_semantics"]
ACTION_HEADER = [
    "action_key", "provenance_ref", "source_operation_id", "method", "browser_path",
    "owner_path", "owner_service", "authorization_capabilities", "step_up_policy",
    "idempotency_policy", "implementation_state", "production_state",
]

CANONICAL_PERSONAS = {
    "EMPLOYEE", "MANAGER", "BUSINESS_OPERATOR", "SETTINGS_ADMIN", "ENTERPRISE_AUDITOR"
}
PERSONA_CATEGORY = {
    "EMPLOYEE": "EMPLOYEE",
    "MANAGER": "MANAGER",
    "BUSINESS_OPERATOR": "OPERATIONS",
    "SETTINGS_ADMIN": "CONFIGURATION",
    "ENTERPRISE_AUDITOR": "AUDIT",
}
QUERY_STATE_FIELDS = {
    "state", "scopeDecisionRevision", "freshness", "nextCursor", "fieldDecisionSummary",
    "partialFailures", "correlationId", "cachePolicy",
}
PEP_LAYERS = {
    "GATEWAY_APP_ENTITLEMENT", "OWNER_API_OPERATION", "RESOURCE_POPULATION",
    "REPOSITORY_TENANT_PREDICATE", "FIELD_PROJECTION", "PURPOSE_POLICY", "AUDIT_DECISION",
}
RUNTIME_INVARIANTS = {
    "QUERY_STATE_ITEM_CARDINALITY", "PARTIAL_FAILURE_STATE_MATCH", "CURSOR_SCOPE_REVISION_BINDING",
    "PAGE_LIMIT_AND_STABLE_ORDER", "FIELD_DECISION_SUMMARY_MATCH", "DEEP_LINK_ACTION_ALLOWLIST",
    "TRUSTED_TENANT_CONTEXT_NON_SERIALIZATION", "LOCALE_TIMEZONE_CANONICALIZATION",
    "FIELD_DECISION_VIEW_MASK_OMIT", "PROBLEM_STATUS_AND_CORRELATION",
}
RUNTIME_TEST_METHODS = {
    "emptyUnavailableHaveNoItems", "partialRequiresFailure", "completeHasNoFailure",
    "cursorBindsScopeAndRevision", "pageHonorsLimitAndStableOrder",
    "fieldSummaryMatchesSerializedDecisions", "deepLinksAndActionsAreAllowlisted",
    "trustedTenantContextIsNotSerialized", "localeAndTimeZoneAreCanonical",
    "fieldDecisionViewMaskOmitSemantics", "problemStatusAndCorrelationAreClosed",
}
OWNER_PREFIXES = {
    "dwp-people-server": "/api/people",
    "dwp-time-server": "/api/time",
    "dwp-payroll-server": "/api/payroll",
    "dwp-platform-server": "/api/platform",
    "dwp-auth-server": "/api/auth",
}
VALUE_TYPES = {
    "AggregateValue", "AuditValue", "DurationValue", "EffectiveRangeValue",
    "MeasureValue", "MetadataValue", "MoneyValue", "PolicyValue", "QueueValue",
    "ReceiptValue", "ReferenceValue", "StatusValue", "TemporalValue", "TextValue",
}
FILTER_TYPES = {value.removesuffix("Value") + "Filter" for value in VALUE_TYPES}
SEMANTIC_DEFS = VALUE_TYPES | FILTER_TYPES | {"Problem"}
WIRE_SEMANTICS = {
    "AggregateValue": "COUNT_REVISION_AS_OF", "AuditValue": "DECISION_EVIDENCE_TIME_REVISION",
    "DurationValue": "CANONICAL_DECIMAL_AND_UNIT", "EffectiveRangeValue": "CLOSED_DATE_RANGE_AND_REVISION",
    "MeasureValue": "CANONICAL_DECIMAL_UNIT_REVISION", "MetadataValue": "KEY_VERSION_DIGEST",
    "MoneyValue": "DECIMAL_STRING_AND_ISO_CURRENCY", "PolicyValue": "POLICY_KEY_REVISION_EFFECTIVITY_STATUS",
    "QueueValue": "OPEN_COUNT_OLDEST_TIME_SLA_STATUS", "ReceiptValue": "RECEIPT_ID_STATE_TIME_REVISION",
    "ReferenceValue": "PUBLIC_ID_CODE_LABEL_REVISION", "StatusValue": "STATUS_CODE_AND_REVISION",
    "TemporalValue": "INSTANT_RANGE_AND_DURATION", "TextValue": "BOUNDED_TEXT_LANGUAGE_REVISION",
}

LISTENING_ENTRY_QUERY_TEST_ALLOCATIONS = {
    "IAQ-033": "G3-SYS-LISTEN-CONFIGURATION-BE-TEST",
    "IAQ-065": "G3-SYS-LISTEN-PROTECTED-BE-TEST",
}
CORE_G3_ALLOCATION_IDS = {
    "G3-HRM-BE-SOURCE", "G3-HRM-BE-TEST", "G3-HRM-FE-SOURCE",
    "G3-PER-BE-SOURCE", "G3-PER-BE-TEST", "G3-PER-FE-SOURCE",
    "G3-TIM-BE-SOURCE", "G3-TIM-BE-TEST", "G3-TIM-FE-SOURCE",
    "G3-PAY-BE-SOURCE", "G3-PAY-BE-TEST", "G3-PAY-FE-SOURCE",
    "G3-SYS-BE-SOURCE", "G3-SYS-BE-TEST", "G3-SYS-AUTH-BE-SOURCE",
    "G3-SYS-AUTH-BE-TEST", "G3-SYS-FE-SOURCE",
    "G3-CTL-BE-ROOT-BUILD", "G3-CTL-TIM-SCAFFOLD", "G3-CTL-PAY-SCAFFOLD",
    "G3-CTL-PER-MIGRATION-STREAM", "G3-CTL-BE-SHARED-WORKFORCE-ABI",
    "G3-CTL-BE-GENERATED-HRIS-CONTRACTS", "G3-CTL-BE-CONTRACT-VERIFIER",
    "G3-CTL-BE-CONTRACTS", "G3-CTL-BE-GATEWAY", "G3-CTL-BE-RUNTIME",
    "G3-CTL-FE-MANIFEST", "G3-CTL-FE-ROUTES", "G3-CTL-FE-CONTRACTS",
    "G3-CTL-FE-HRIS-SHARED", "G3-CTL-FE-HRIS-API-TRANSITION",
    "G3-CTL-FE-RUNTIME", "G3-HRM-BE-MIGRATION", "G3-PER-BE-MIGRATION",
    "G3-TIM-BE-MIGRATION", "G3-PAY-BE-MIGRATION",
    "G3-SYS-AUTH-BE-MIGRATION", "G3-SYS-BE-MIGRATION",
}
LISTENING_STREAM_G3_ALLOCATION_IDS = {
    f"G3-SYS-LISTEN-{stream}-{artifact}"
    for stream in ("CONFIGURATION", "PROTECTED", "INSIGHTS", "ISSUER")
    for artifact in ("BE-SOURCE", "BE-TEST", "BE-MIGRATION")
} | {
    f"G3-CTL-SYS-LISTEN-{stream}-STREAM"
    for stream in ("CONFIGURATION", "PROTECTED", "INSIGHTS", "ISSUER")
}
EXPECTED_G3_ALLOCATION_IDS = (
    CORE_G3_ALLOCATION_IDS | LISTENING_STREAM_G3_ALLOCATION_IDS
)


def split(value: str) -> list[str]:
    return [] if value in {"", "NONE"} else [part for part in value.split("|") if part]


def camel(value: str) -> str:
    parts = value.lower().split("_")
    return parts[0] + "".join(part.title() for part in parts[1:])


def kebab_camel(value: str) -> str:
    return re.sub(r"(?<!^)(?=[A-Z])", "-", value).replace("_", "-").lower()


def path_key(value: str) -> str:
    normalized = re.sub(r"\{[^}]+\}", "resource", value).strip("/")
    return ".".join(part.replace("_", "-") for part in normalized.split("/") if part)


def read_csv(path: Path, expected_header: list[str]) -> tuple[list[dict[str, str]], list[str]]:
    if not path.is_file():
        return [], [f"missing artifact: {path.relative_to(ROOT)}"]
    with path.open(newline="", encoding="utf-8-sig") as stream:
        reader = csv.DictReader(stream)
        errors = [] if reader.fieldnames == expected_header else [
            f"{path.name}: header drift expected={expected_header} actual={reader.fieldnames}"
        ]
        return list(reader), errors


def recursive_operations(value: Any, result: dict[str, dict[str, Any]], source: str) -> None:
    if isinstance(value, dict):
        if isinstance(value.get("operationId"), str) and isinstance(value.get("method"), str):
            operation_id = value["operationId"]
            if operation_id in result and result[operation_id].get("_source") != source:
                result[operation_id]["_duplicate"] = True
            else:
                result[operation_id] = {**value, "_source": source}
        for child in value.values():
            recursive_operations(child, result, source)
    elif isinstance(value, list):
        for child in value:
            recursive_operations(child, result, source)


def load_documents() -> tuple[dict[str, Any], list[str]]:
    errors: list[str] = []
    paths = {
        "ia": (HERE / "hris-information-architecture-register.csv", IA_HEADER),
        "access": (HERE / "ia-node-access-contract-register.csv", ACCESS_HEADER),
        "projections": (HERE / "ia-entry-query-projection-register.csv", PROJECTION_HEADER),
        "exceptions": (HERE / "ia-shared-authorization-exception-register.csv", EXCEPTION_HEADER),
        "query_api": (HERE / "ia-entry-query-api-contract-register.csv", API_QUERY_HEADER),
        "runtime": (HERE / "ia-entry-query-runtime-invariant-register.csv", RUNTIME_HEADER),
        "field_types": (HERE / "ia-entry-query-field-type-register.csv", FIELD_TYPE_HEADER),
        "actions": (HERE / "ia-entry-query-action-key-register.csv", ACTION_HEADER),
    }
    docs: dict[str, Any] = {}
    for key, (path, header) in paths.items():
        docs[key], found = read_csv(path, header)
        errors.extend(found)
    for key, path in {
        "packages": ROOT / "hris-permission-group-matrix.csv",
        "duties": ROOT / "hris-atomic-duty-matrix.csv",
        "sod": ROOT / "hris-sod-rule-matrix.csv",
        "pep": HERE / "api-pep-binding-register.csv",
        "shared": HERE / "shared-contract-catalog.csv",
        "slices": HERE / "g3-slice-code-go-register.csv",
        "allocations": HERE / "g3-file-allocation-register.csv",
    }.items():
        if not path.is_file():
            errors.append(f"missing artifact: {path.relative_to(ROOT)}")
            docs[key] = []
        else:
            with path.open(newline="", encoding="utf-8-sig") as stream:
                docs[key] = list(csv.DictReader(stream))
    schema_path = HERE / "ia-entry-query-projection-schemas.v1.json"
    try:
        raw = schema_path.read_bytes()
        if not raw.startswith(b"{"):
            errors.append("projection schema first byte must be '{'")
        if b"Warning: truncated output" in raw or b"tokens truncated" in raw:
            errors.append("projection schema contains tool-output contamination")
        docs["schema"] = json.loads(raw)
    except (OSError, json.JSONDecodeError) as error:
        docs["schema"] = {}
        errors.append(f"projection schema JSON parse failed closed: {error}")
    modern: dict[str, dict[str, Any]] = {}
    modern_paths = [ROOT / path for path in (
        "session-evidence/hrm/g3-modern-capability-contracts.v1.json",
        "session-evidence/per/g3-modern-capability-contracts.v2.json",
        "session-evidence/tim/g3-modern-capability-contracts.v1.json",
        "session-evidence/sys/g3-modern-capability-contracts.v1.json",
    )]
    for path in modern_paths:
        try:
            recursive_operations(json.loads(path.read_text(encoding="utf-8")), modern, str(path.relative_to(ROOT)))
        except (OSError, json.JSONDecodeError) as error:
            errors.append(f"modern source parse failed closed {path.name}: {error}")
    docs["modern"] = modern
    return docs, errors


def unique_map(rows: list[dict[str, str]], key: str, label: str, errors: list[str]) -> dict[str, dict[str, str]]:
    values = [row.get(key, "") for row in rows]
    if any(not value for value in values) or len(values) != len(set(values)):
        errors.append(f"{label}: blank or duplicate {key}")
    return {row.get(key, ""): row for row in rows}


def closed_object(
    schema: Any,
    properties_expected: set[str],
    label: str,
    errors: list[str],
    required_expected: set[str] | None = None,
) -> dict[str, Any]:
    if not isinstance(schema, dict):
        errors.append(f"{label}: schema must be an object")
        return {}
    if schema.get("type") != "object" or schema.get("additionalProperties") is not False:
        errors.append(f"{label}: object schema must be closed")
    properties = schema.get("properties")
    if not isinstance(properties, dict) or set(properties) != properties_expected:
        errors.append(f"{label}: property set drift expected={sorted(properties_expected)}")
        properties = properties if isinstance(properties, dict) else {}
    expected_required = properties_expected if required_expected is None else required_expected
    if set(schema.get("required", [])) != expected_required:
        errors.append(f"{label}: required set drift expected={sorted(expected_required)}")
    return properties


def validate_projection_schema(
    row: dict[str, str], schema: dict[str, Any], field_types: dict[str, dict[str, str]],
    api_row: dict[str, str], actions_by_ref: dict[str, dict[str, str]], errors: list[str]
) -> None:
    qid = row["query_id"]
    if schema.get("queryId") != qid or schema.get("iaNodeId") != row["ia_node_id"]:
        errors.append(f"{qid}: projection identity drift")
    if schema.get("variantKey") != row["variant_key"]:
        errors.append(f"{qid}: variant key drift")
    if schema.get("authorizationCapability") != row["authorization_capability"]:
        errors.append(f"{qid}: authorization capability drift")
    groups = split(row["field_scope"])
    if schema.get("fieldGroups") != groups or len(groups) != len(set(groups)):
        errors.append(f"{qid}: field group SSOT drift")
    request = closed_object(
        schema.get("requestSchema"),
        {"asOf", "limit", "cursor", "filter", "sort", "locale", "timeZone", "correlationId"},
        f"{qid}.request", errors,
        {"limit", "filter", "sort", "locale", "timeZone", "correlationId"},
    )
    if any("tenant" in name.lower() or "actor" in name.lower() for name in request):
        errors.append(f"{qid}: request must receive tenant/actor only from trusted server context")
    if request.get("limit", {}).get("maximum") != 100:
        errors.append(f"{qid}: request page limit drift")
    cursor_contract = {"type": "string", "pattern": r"^[A-Za-z0-9_-]{16,1024}$"}
    if request.get("cursor", {}).get("anyOf") != [cursor_contract, {"type": "null"}]:
        errors.append(f"{qid}: authenticated request cursor contract drift")
    for locale_key, minimum, maximum in (("locale", 2, 35), ("timeZone", 1, 255)):
        contract = request.get(locale_key, {})
        if contract != {"type": "string", "minLength": minimum, "maxLength": maximum}:
            errors.append(f"{qid}: {locale_key} must be bounded for runtime canonicalization")
    filter_schema = request.get("filter", {})
    if filter_schema.get("type") != "object" or filter_schema.get("additionalProperties") is not False:
        errors.append(f"{qid}: filter allowlist must be closed")
    for group in groups:
        value_type = field_types.get(group, {}).get("value_type", "")
        expected_filter = {"anyOf": [
            {"$ref": f"#/$defs/{value_type.removesuffix('Value')}Filter"}, {"type": "null"}
        ]}
        if filter_schema.get("properties", {}).get(camel(group)) != expected_filter:
            errors.append(f"{qid}.{group}: typed request filter binding drift")
    sort_schema = request.get("sort", {})
    if sort_schema.get("type") != "array" or not sort_schema.get("uniqueItems"):
        errors.append(f"{qid}: stable sort allowlist missing")
    if schema.get("problemSchema") != {"$ref": "#/$defs/Problem"}:
        errors.append(f"{qid}: canonical problem schema binding missing")
    response = schema.get("responseSchema")
    props = closed_object(
        response,
        {"projectionVersion", "asOf", "variantKey", "queryState", "items"},
        f"{qid}.response", errors,
    )
    if "tenantId" in props or any("tenant" in name.lower() for name in props):
        errors.append(f"{qid}: browser response must not serialize trusted tenant identity")
    if props.get("variantKey", {}).get("const") != row["variant_key"]:
        errors.append(f"{qid}: response variant const drift")
    state = closed_object(props.get("queryState"), QUERY_STATE_FIELDS, f"{qid}.queryState", errors)
    if state.get("state", {}).get("enum") != ["COMPLETE", "EMPTY", "PARTIAL", "UNAVAILABLE"]:
        errors.append(f"{qid}: query state enum drift")
    if state.get("freshness", {}).get("enum") != ["CURRENT", "STALE", "UNAVAILABLE"]:
        errors.append(f"{qid}: freshness enum drift")
    if state.get("nextCursor", {}).get("anyOf") != [cursor_contract, {"type": "null"}]:
        errors.append(f"{qid}: response cursor must use the authenticated request cursor contract")
    closed_object(
        state.get("fieldDecisionSummary"),
        {"viewCount", "maskedCount", "omittedCount"},
        f"{qid}.fieldDecisionSummary", errors,
    )
    failures = state.get("partialFailures", {})
    if failures.get("type") != "array" or not isinstance(failures.get("items"), dict):
        errors.append(f"{qid}: partial failure array contract missing")
    else:
        closed_object(
            failures["items"], {"componentKey", "errorCode", "correlationId", "retryable"},
            f"{qid}.partialFailure", errors,
        )
    cache = closed_object(
        state.get("cachePolicy"),
        {"authorizationDecisionRevision", "invalidationEvent", "maxAgeSeconds"},
        f"{qid}.cachePolicy", errors,
    )
    if cache.get("invalidationEvent", {}).get("const") != "dwp.hris.access.assignment.changed.v1":
        errors.append(f"{qid}: authorization cache invalidation event drift")
    items = props.get("items", {})
    if items.get("type") != "array" or not isinstance(items.get("items"), dict):
        errors.append(f"{qid}: typed item schema missing")
        return
    item = closed_object(
        items["items"], {"itemPublicId", "title", "statusCode", "fieldGroups", "deepLink", "availableActions"},
        f"{qid}.item", errors,
    )
    field_schema = item.get("fieldGroups", {})
    if field_schema.get("type") != "object" or field_schema.get("additionalProperties") is not False:
        errors.append(f"{qid}: field group object must be closed")
    if set(field_schema.get("properties", {})) != set(groups):
        errors.append(f"{qid}: typed field group property set drift")
    for group, group_schema in field_schema.get("properties", {}).items():
        choices = group_schema.get("oneOf") if isinstance(group_schema, dict) else None
        if not isinstance(choices, list) or len(choices) != 2:
            errors.append(f"{qid}.{group}: exact VIEW/MASK decision union missing")
            continue
        by_decision: dict[str, dict[str, Any]] = {}
        for choice in choices:
            props_choice = choice.get("properties", {}) if isinstance(choice, dict) else {}
            decision = props_choice.get("decision", {}).get("const")
            if isinstance(decision, str):
                by_decision[decision] = choice
        if set(by_decision) != {"VIEW", "MASK"}:
            errors.append(f"{qid}.{group}: field decision alternatives drift")
            continue
        view = closed_object(by_decision["VIEW"], {"decision", "value"}, f"{qid}.{group}.VIEW", errors)
        expected_type = field_types.get(group, {}).get("value_type", "")
        if view.get("value", {}).get("$ref") != f"#/$defs/{expected_type}":
            errors.append(f"{qid}.{group}: explicit semantic typed value binding drift")
        masked = closed_object(
            by_decision["MASK"], {"decision", "value", "maskReason", "maskedDisplayKey"},
            f"{qid}.{group}.MASK", errors,
        )
        if masked.get("value") != {"type": "null"}:
            errors.append(f"{qid}.{group}: MASK must serialize only a null value")
        if any("displayValue" in choice.get("properties", {}) for choice in choices if isinstance(choice, dict)):
            errors.append(f"{qid}.{group}: generic display-string DTO is forbidden")
    deep_link = closed_object(item.get("deepLink"), {"route", "resourcePublicId"}, f"{qid}.deepLink", errors)
    if not isinstance(deep_link.get("route", {}).get("const"), str):
        errors.append(f"{qid}: stable deep-link route missing")
    actions = item.get("availableActions", {})
    if actions.get("type") != "array" or actions.get("uniqueItems") is not True:
        errors.append(f"{qid}: action descriptor allowlist missing")
    provenance_refs = split(api_row.get("action_provenance_refs", ""))
    action_keys = split(api_row.get("action_keys", ""))
    if not provenance_refs:
        if actions.get("maxItems") != 0 or actions.get("items") is not False or action_keys:
            errors.append(f"{qid}: action-free projection exposes an action descriptor")
    else:
        choices = actions.get("items", {}).get("oneOf") if isinstance(actions.get("items"), dict) else None
        if not isinstance(choices, list) or len(choices) != len(provenance_refs):
            errors.append(f"{qid}: action descriptor exact alternative set missing")
        else:
            actual: dict[str, dict[str, Any]] = {}
            for choice in choices:
                descriptor = closed_object(
                    choice,
                    {"actionKey", "method", "hrefTemplate", "idempotencyPolicy", "stepUpPolicy"},
                    f"{qid}.actionDescriptor", errors,
                )
                key = descriptor.get("actionKey", {}).get("const")
                if isinstance(key, str):
                    actual[key] = descriptor
            expected_keys = [actions_by_ref.get(ref, {}).get("action_key", "") for ref in provenance_refs]
            if set(actual) != set(expected_keys) or action_keys != expected_keys:
                errors.append(f"{qid}: public action key/provenance closure drift")
            for ref in provenance_refs:
                source = actions_by_ref.get(ref, {})
                descriptor = actual.get(source.get("action_key", ""), {})
                expected_values = {
                    "method": source.get("method"), "hrefTemplate": source.get("browser_path"),
                    "idempotencyPolicy": source.get("idempotency_policy"),
                    "stepUpPolicy": source.get("step_up_policy"),
                }
                for field, expected_value in expected_values.items():
                    if descriptor.get(field, {}).get("const") != expected_value:
                        errors.append(f"{qid}: action descriptor {field} drift for {ref}")
        rendered_actions = json.dumps(actions, sort_keys=True)
        if any(prefix in rendered_actions for prefix in ("PEP-", "SYS-API-", "MODOP:", "SHARED-API-")):
            errors.append(f"{qid}: internal action provenance id leaked into wire schema")
    conditions = response.get("allOf")
    if not isinstance(conditions, list) or len(conditions) != 5:
        errors.append(f"{qid}: query-state cross-field condition set drift")
    else:
        rendered = {json.dumps(condition, sort_keys=True, separators=(",", ":")) for condition in conditions}
        expected = {
            json.dumps({
                "if": {"properties": {"queryState": {"properties": {"state": {"enum": ["EMPTY", "UNAVAILABLE"]}}}}},
                "then": {"properties": {"items": {"maxItems": 0}}},
            }, sort_keys=True, separators=(",", ":")),
            json.dumps({
                "if": {"properties": {"queryState": {"properties": {"state": {"const": "PARTIAL"}}}}},
                "then": {"properties": {"queryState": {"properties": {"partialFailures": {"minItems": 1}}}}},
            }, sort_keys=True, separators=(",", ":")),
            json.dumps({
                "if": {"properties": {"queryState": {"properties": {"state": {"const": "COMPLETE"}}}}},
                "then": {"properties": {"queryState": {"properties": {"partialFailures": {"maxItems": 0}}}}},
            }, sort_keys=True, separators=(",", ":")),
            json.dumps({
                "if": {"properties": {"queryState": {"properties": {"state": {"const": "UNAVAILABLE"}}}}},
                "then": {"properties": {"queryState": {"properties": {
                    "freshness": {"const": "UNAVAILABLE"}, "nextCursor": {"type": "null"}
                }}}},
            }, sort_keys=True, separators=(",", ":")),
            json.dumps({
                "if": {"properties": {"queryState": {"properties": {"freshness": {"const": "UNAVAILABLE"}}}}},
                "then": {"properties": {
                    "items": {"maxItems": 0},
                    "queryState": {"properties": {
                        "state": {"const": "UNAVAILABLE"}, "nextCursor": {"type": "null"}
                    }},
                }},
            }, sort_keys=True, separators=(",", ":")),
        }
        if rendered != expected:
            errors.append(f"{qid}: query-state cross-field condition semantics drift")


def parse_profiles(value: str, node: str, errors: list[str]) -> dict[str, tuple[str, str]]:
    result: dict[str, tuple[str, str]] = {}
    for raw in split(value):
        if raw.count("=") != 1 or raw.count(">") != 1:
            errors.append(f"{node}: malformed persona access profile {raw}")
            continue
        persona, binding = raw.split("=", 1)
        package, duty = binding.split(">", 1)
        if persona in result:
            errors.append(f"{node}: duplicate persona access profile {persona}")
        result[persona] = (package, duty)
    return result


def operation_maps(docs: dict[str, Any], errors: list[str]) -> tuple[dict[str, dict], dict[str, dict]]:
    pep: dict[str, dict] = {}
    for row in docs["pep"]:
        binding_id = row.get("binding_id", "")
        if binding_id in pep:
            errors.append(f"PEP binding id is duplicated: {binding_id}")
        pep[binding_id] = row
        # A SYS contract id can intentionally name a GET/command pair.  CSV
        # order pins the command row for action resolution; query references
        # use an unambiguous binding id except where the source id is GET-only.
        pep[row.get("source_operation_id", "")] = row
    modern = docs["modern"]
    for key, row in modern.items():
        if row.get("_duplicate"):
            errors.append(f"modern operation id is duplicated: {key}")
    return pep, modern


def validate_documents(docs: dict[str, Any], initial_errors: list[str] | None = None) -> list[str]:
    errors = list(initial_errors or [])
    expected_counts = {
        "ia": 98, "access": 98, "projections": 66, "exceptions": 9,
        "query_api": 66, "runtime": 66, "actions": 202,
        "field_types": 138, "packages": 31, "duties": 128, "sod": 29, "allocations": 55,
    }
    for key, count in expected_counts.items():
        if len(docs.get(key, [])) != count:
            errors.append(f"{key}: row count drift expected={count} actual={len(docs.get(key, []))}")

    ia = unique_map(docs["ia"], "ia_node_id", "IA", errors)
    access = unique_map(docs["access"], "ia_node_id", "access SSOT", errors)
    projections = unique_map(docs["projections"], "query_id", "projection", errors)
    query_api = unique_map(docs["query_api"], "query_id", "entry query API", errors)
    runtimes = unique_map(docs["runtime"], "query_id", "entry query runtime", errors)
    field_types = unique_map(docs["field_types"], "field_group", "entry query field type", errors)
    actions = unique_map(docs["actions"], "action_key", "entry query action key", errors)
    action_refs = [row.get("provenance_ref", "") for row in docs["actions"]]
    if any(not ref for ref in action_refs) or len(action_refs) != len(set(action_refs)):
        errors.append("entry query action provenance refs must be nonblank and unique")
    actions_by_ref = {row.get("provenance_ref", ""): row for row in docs["actions"]}
    exceptions = unique_map(docs["exceptions"], "exception_id", "shared exception", errors)
    packages = unique_map(docs["packages"], "package_code", "package", errors)
    duties = unique_map(docs["duties"], "duty_code", "duty", errors)
    slices = unique_map(docs["slices"], "slice_id", "G3 slice", errors)
    allocations = unique_map(docs["allocations"], "allocation_id", "G3 allocation", errors)
    shared = unique_map(docs["shared"], "contract_id", "shared contract", errors)
    pep, modern = operation_maps(docs, errors)
    if set(ia) != set(access):
        errors.append("IA and node-access SSOT must contain the same exact 98 node ids")
    if set(allocations) != EXPECTED_G3_ALLOCATION_IDS:
        errors.append(
            "G3 allocation taxonomy drift "
            f"missing={sorted(EXPECTED_G3_ALLOCATION_IDS - set(allocations))} "
            f"extra={sorted(set(allocations) - EXPECTED_G3_ALLOCATION_IDS)}"
        )
    if set(query_api) != set(projections) or set(runtimes) != set(projections):
        errors.append("projection, public API and runtime invariant registers must contain the same exact 66 query ids")
    expected_action_refs = {
        ref for row in access.values() for ref in split(row.get("action_refs", ""))
    }
    if set(actions_by_ref) != expected_action_refs:
        errors.append("public action-key register does not cover the exact IA action provenance universe")
    for ref in expected_action_refs:
        sealed = actions_by_ref.get(ref, {})
        expected: dict[str, str] = {}
        if ref.startswith("MODOP:"):
            operation = modern.get(ref.removeprefix("MODOP:"), {})
            browser_path = operation.get("path", "")
            owner_matches = [
                (service, prefix) for service, prefix in OWNER_PREFIXES.items()
                if browser_path.startswith(prefix + "/")
            ]
            if len(owner_matches) != 1:
                errors.append(f"{ref}: modern action path has no unique owner prefix")
                continue
            owner_service, owner_prefix = owner_matches[0]
            idempotency = (
                "REQUIRED_IDEMPOTENCY_KEY"
                if operation.get("idempotency") == "REQUIRED"
                else "SOURCE_POLICY_" + operation.get("idempotency", "")
            )
            expected = {
                "action_key": "hris.action." + operation.get("operationId", "").removeprefix("modern."),
                "source_operation_id": operation.get("operationId", ""),
                "method": operation.get("method", ""),
                "browser_path": browser_path,
                "owner_path": browser_path[len(owner_prefix):],
                "owner_service": owner_service,
                "authorization_capabilities": operation.get("authorizationCapability", ""),
                "idempotency_policy": idempotency,
            }
        elif ref in shared:
            operation = shared[ref]
            expected = {
                "action_key": "hris.action.shared." + operation.get("semantic_role", "").lower().replace("_", "."),
                "source_operation_id": operation.get("semantic_role", ""),
                "method": operation.get("method", ""),
                "browser_path": operation.get("browser_path", ""),
                "owner_path": operation.get("owner_path", ""),
                "owner_service": operation.get("owner_service", ""),
                "authorization_capabilities": "EXTERNAL_SHARED_AUTHORIZATION_EXCEPTION",
                "idempotency_policy": "REQUIRED_IDEMPOTENCY_KEY",
            }
        else:
            operation = pep.get(ref, {})
            source_operation = operation.get("source_operation_id", "")
            action_key = (
                f"hris.action.sys.{operation.get('method', '').lower()}."
                + path_key(operation.get("browser_path", "").removeprefix("/api/"))
                if source_operation.startswith("SYS-API-")
                else f"hris.action.{operation.get('module', '').lower()}." + kebab_camel(source_operation)
            )
            expected = {
                "action_key": action_key,
                "source_operation_id": source_operation,
                "method": operation.get("method", ""),
                "browser_path": operation.get("browser_path", ""),
                "owner_path": operation.get("owner_path", ""),
                "owner_service": operation.get("owner_service", ""),
                "authorization_capabilities": operation.get("canonical_capability_keys", ""),
                "idempotency_policy": "REQUIRED_IDEMPOTENCY_KEY",
            }
        for field, value in expected.items():
            if sealed.get(field) != value:
                errors.append(f"{ref}: public action contract drift for {field}")
        if (
            sealed.get("provenance_ref") != ref
            or sealed.get("method") in {"", "GET"}
            or sealed.get("step_up_policy") != "OWNER_PEP_RISK_POLICY_DECISION_REQUIRED"
            or sealed.get("implementation_state") != "REQUIRED_G3_ACTION_DESCRIPTOR_NOT_IMPLEMENTED"
            or sealed.get("production_state") != "NOT_AUTHORIZED_G6"
            or not re.fullmatch(r"hris\.action\.[a-z0-9.-]+", sealed.get("action_key", ""))
        ):
            errors.append(f"{ref}: public action-key seal/state invalid")

    schema_doc = docs.get("schema", {})
    if schema_doc.get("contractId") != "HRIS-IA-ENTRY-QUERY-PROJECTIONS-V2" or schema_doc.get("schemaVersion") != "2.0.0":
        errors.append("projection schema contract identity/version drift")
    if (
        schema_doc.get("projectionCount") != 66
        or schema_doc.get("fieldGroupTypeCount") != 138
        or schema_doc.get("tenantContextPolicy") != "SERVER_TRUSTED_CONTEXT_NOT_SERIALIZED"
    ):
        errors.append("projection schema count or tenant context policy drift")
    definitions = schema_doc.get("$defs", {})
    if not isinstance(definitions, dict) or set(definitions) != SEMANTIC_DEFS:
        errors.append("projection schema semantic definition set drift")
        definitions = definitions if isinstance(definitions, dict) else {}
    for name in SEMANTIC_DEFS:
        definition = definitions.get(name)
        if not isinstance(definition, dict) or definition.get("type") != "object" or definition.get("additionalProperties") is not False:
            errors.append(f"projection schema definition {name} must be a closed object")
    problem = definitions.get("Problem", {}).get("properties", {})
    if problem.get("status", {}).get("enum") != [400, 401, 403, 404, 409, 429, 503]:
        errors.append("projection problem status set drift")
    field_owners: dict[str, set[str]] = {}
    for projection in projections.values():
        for group in split(projection.get("field_scope", "")):
            field_owners.setdefault(group, set()).add(projection.get("owner_session", ""))
    if set(field_types) != set(field_owners):
        errors.append("explicit field type SSOT does not cover the exact projection field-group universe")
    for group, owners in field_owners.items():
        type_row = field_types.get(group, {})
        value_type = type_row.get("value_type", "")
        if value_type not in VALUE_TYPES:
            errors.append(f"{group}: unregistered semantic value type")
        if split(type_row.get("owner_sessions", "")) != sorted(owners):
            errors.append(f"{group}: field type owner-session closure drift")
        if type_row.get("wire_semantics") != WIRE_SEMANTICS.get(value_type):
            errors.append(f"{group}: field type wire semantics drift")
    critical_semantics = {
        "PAYROLL_POLICY": "PolicyValue", "TIME_POLICY": "PolicyValue",
        "SKILL_TAXONOMY": "ReferenceValue", "PAYROLL_POPULATION": "AggregateValue",
        "EVALUATION_THRESHOLD": "MeasureValue", "COHORT_THRESHOLD": "MeasureValue",
        "BALANCE": "DurationValue", "DUE_STATUS": "StatusValue",
    }
    for group, value_type in critical_semantics.items():
        if field_types.get(group, {}).get("value_type") != value_type:
            errors.append(f"{group}: independently anchored semantic value type drift")
    schema_projections = schema_doc.get("projections", {})
    if not isinstance(schema_projections, dict) or set(schema_projections) != set(projections):
        errors.append("projection schema/query register exact set differs")
        schema_projections = schema_projections if isinstance(schema_projections, dict) else {}
    for query_id, row in projections.items():
        expected_ref = f"ia-entry-query-projection-schemas.v1.json#/projections/{query_id}"
        if row.get("response_schema_ref") != expected_ref or row.get("method") != "GET":
            errors.append(f"{query_id}: projection must be an exact GET with canonical schema ref")
        if row.get("production_state") != "NOT_AUTHORIZED_G6":
            errors.append(f"{query_id}: projection overstates production readiness")
        if query_id in schema_projections:
            validate_projection_schema(
                row, schema_projections[query_id], field_types,
                query_api.get(query_id, {}), actions_by_ref, errors,
            )
        slice_row = slices.get(row.get("primary_slice_id", ""))
        if not slice_row or slice_row.get("session_id") != row.get("owner_session"):
            errors.append(f"{query_id}: primary slice/session ownership drift")
        elif row.get("ia_node_id") not in set(split(slice_row.get("ia_node_ids", ""))):
            errors.append(f"{query_id}: IA node is absent from primary slice contributor set")

    operation_ids = [row.get("operation_id", "") for row in query_api.values()]
    if len(operation_ids) != len(set(operation_ids)) or set(operation_ids) != {
        f"IAQ.OP.{number:03d}" for number in range(1, 67)
    }:
        errors.append("entry query public operation ids must be the exact IAQ.OP.001..066 set")
    for query_id, projection in projections.items():
        api = query_api.get(query_id, {})
        runtime = runtimes.get(query_id, {})
        ia_row = ia.get(projection.get("ia_node_id", ""), {})
        access_row = access.get(projection.get("ia_node_id", ""), {})
        identity_fields = (
            "ia_node_id", "owner_session", "primary_slice_id", "owner_service", "method",
            "browser_path", "authorization_capability", "authorization_profiles",
            "implementation_state", "production_state",
        )
        for field in identity_fields:
            if api.get(field) != projection.get(field):
                errors.append(f"{query_id}: public API/projection identity drift for {field}")
        expected_number = query_id.removeprefix("IAQ-")
        if api.get("operation_id") != f"IAQ.OP.{expected_number}":
            errors.append(f"{query_id}: public operation id drift")
        owner_prefix = OWNER_PREFIXES.get(projection.get("owner_service", ""))
        browser_path = projection.get("browser_path", "")
        if not owner_prefix or not browser_path.startswith(owner_prefix + "/"):
            errors.append(f"{query_id}: owner service/browser path topology drift")
        elif api.get("owner_path") != browser_path[len(owner_prefix):]:
            errors.append(f"{query_id}: owner path is not the exact gateway-prefix suffix")
        schema = schema_projections.get(query_id, {})
        expected_root = f"ia-entry-query-projection-schemas.v1.json#/projections/{query_id}"
        if api.get("request_schema_ref") != expected_root + "/requestSchema":
            errors.append(f"{query_id}: request schema ref drift")
        if api.get("response_schema_ref") != expected_root + "/responseSchema":
            errors.append(f"{query_id}: response schema ref drift")
        if api.get("problem_schema_ref") != "ia-entry-query-projection-schemas.v1.json#/$defs/Problem":
            errors.append(f"{query_id}: problem schema ref drift")
        if set(split(api.get("pep_layers", ""))) != PEP_LAYERS or len(split(api.get("pep_layers", ""))) != len(PEP_LAYERS):
            errors.append(f"{query_id}: seven-layer PEP closure drift")
        groups = split(projection.get("field_scope", ""))
        expected_filters = [camel(group) for group in groups] + ["effectiveOn"]
        expected_sorts = [f"{camel(group)}:ASC" for group in groups] + [
            f"{camel(group)}:DESC" for group in groups
        ] + ["itemPublicId:ASC", "itemPublicId:DESC"]
        if split(api.get("allowed_filters", "")) != expected_filters:
            errors.append(f"{query_id}: filter allowlist drift")
        if split(api.get("allowed_sorts", "")) != expected_sorts:
            errors.append(f"{query_id}: sort allowlist drift")
        request = schema.get("requestSchema", {}).get("properties", {})
        if set(request.get("filter", {}).get("properties", {})) != set(expected_filters):
            errors.append(f"{query_id}: request filter schema/register closure drift")
        if request.get("sort", {}).get("items", {}).get("enum") != expected_sorts:
            errors.append(f"{query_id}: request sort schema/register closure drift")
        if api.get("default_sort") != "itemPublicId:ASC" or api.get("max_page_size") != "100":
            errors.append(f"{query_id}: stable paging policy drift")
        if api.get("deep_link_route") != ia_row.get("canonical_route"):
            errors.append(f"{query_id}: public API deep-link route differs from IA route")
        if api.get("action_provenance_refs") != access_row.get("action_refs"):
            errors.append(f"{query_id}: public API action provenance differs from node access SSOT")
        expected_action_keys = [
            actions_by_ref.get(ref, {}).get("action_key", "")
            for ref in split(access_row.get("action_refs", ""))
        ]
        if split(api.get("action_keys", "")) != expected_action_keys:
            errors.append(f"{query_id}: public API action-key allowlist differs from provenance")
        if set(split(api.get("runtime_invariant_ids", ""))) != RUNTIME_INVARIANTS:
            errors.append(f"{query_id}: public API runtime invariant closure drift")
        allocation_id = api.get("test_allocation_id", "")
        allocation = allocations.get(allocation_id)
        slice_row = slices.get(api.get("primary_slice_id", ""), {})
        if not allocation or allocation.get("artifact_class") != "BACKEND_TEST" or allocation.get("session_id") != api.get("owner_session"):
            errors.append(f"{query_id}: named test allocation is missing or owned by another session")
        if allocation_id not in set(split(slice_row.get("file_allocation_ids", ""))):
            errors.append(f"{query_id}: named test allocation is absent from primary slice")
        expected_listening_allocation = LISTENING_ENTRY_QUERY_TEST_ALLOCATIONS.get(query_id)
        if expected_listening_allocation and allocation_id != expected_listening_allocation:
            errors.append(
                f"{query_id}: listening entry query test allocation must be "
                f"{expected_listening_allocation}"
            )
        module = api.get("owner_session", "").removeprefix("HRIS-")
        runtime_expected = {
            "primary_slice_id": api.get("primary_slice_id", ""),
            "owner_session": api.get("owner_session", ""),
            "test_allocation_id": allocation_id,
            "required_test_class": f"*{module.title()}IaEntryQueryContractTest",
            "evidence_state": "REQUIRED_G3_NAMED_TEST_NOT_IMPLEMENTED",
            "production_state": "NOT_AUTHORIZED_G6",
        }
        for field, expected in runtime_expected.items():
            if runtime.get(field) != expected:
                errors.append(f"{query_id}: runtime invariant register drift for {field}")
        if set(split(runtime.get("required_invariants", ""))) != RUNTIME_INVARIANTS:
            errors.append(f"{query_id}: runtime invariant exact set drift")
        methods = split(runtime.get("required_test_methods", ""))
        if set(methods) != RUNTIME_TEST_METHODS or len(methods) != len(RUNTIME_TEST_METHODS):
            errors.append(f"{query_id}: runtime named test method exact set drift")

    used_projection_refs: Counter[str] = Counter()
    exception_pairs = {(row["ia_node_id"], row["contract_ref"]): row for row in exceptions.values()}
    for node_id, row in access.items():
        ia_row = ia.get(node_id, {})
        copy_fields = {
            "canonical_personas": "personas",
            "entry_query_refs": "entry_query_refs",
            "visibility_capability_refs": "visibility_capability_refs",
            "action_refs": "action_contract_refs",
            "action_capability_refs": "action_capability_refs",
            "persona_access_profiles": "persona_access_profiles",
            "source_family_refs": "source_family_refs",
            "access_contract_state": "entry_contract_state",
        }
        for source, target in copy_fields.items():
            if row.get(source) != ia_row.get(target):
                errors.append(f"{node_id}: generated IA/access SSOT drift {source}->{target}")
        personas = split(row.get("canonical_personas", ""))
        if not personas or len(personas) != len(set(personas)) or set(personas) - CANONICAL_PERSONAS:
            errors.append(f"{node_id}: noncanonical or duplicate persona vocabulary")
        profiles = parse_profiles(row.get("persona_access_profiles", ""), node_id, errors)
        if set(profiles) != set(personas):
            errors.append(f"{node_id}: every persona must have exactly one access profile")
        visibility = set(split(row.get("visibility_capability_refs", "")))
        if not visibility:
            errors.append(f"{node_id}: initial visibility capability is empty")
        for persona, (package_code, duty_code) in profiles.items():
            package = packages.get(package_code)
            duty = duties.get(duty_code)
            if not package or not duty:
                errors.append(f"{node_id}: unresolved package/duty for {persona}")
                continue
            expected_category = PERSONA_CATEGORY[persona]
            actual_category = package.get("package_category")
            manager_employee = (
                persona == "MANAGER" and actual_category == "EMPLOYEE"
                and ia_row.get("navigation_surface") == "MY_HR"
            )
            if actual_category != expected_category and not manager_employee:
                errors.append(f"{node_id}: persona {persona} cannot reach package category {actual_category}")
            if duty_code not in set(split(package.get("atomic_duty_codes", ""))):
                errors.append(f"{node_id}: duty is not assigned to package {package_code}")
            if package_code not in set(split(duty.get("package_codes", ""))):
                errors.append(f"{node_id}: package/duty reverse assignment is missing")
            external_profile = any(
                exception.get("persona") == persona
                and exception.get("hris_access_package") == package_code
                and exception.get("hris_atomic_duty") == duty_code
                and exception.get("external_capability") in visibility
                and exception.get("ia_node_id") == node_id
                for exception in exceptions.values()
            )
            if duty.get("permission_code") != "VIEW" or (
                duty.get("capability_key") not in visibility and not external_profile
            ):
                errors.append(f"{node_id}: persona entry duty must be a matching VIEW capability")
            if persona == "ENTERPRISE_AUDITOR" and (
                actual_category != "AUDIT" or package_code != "HRIS_AUDITOR"
                or "SOD_HRIS_AUDIT_INDEPENDENCE" not in split(package.get("sod_rule_codes", ""))
            ):
                errors.append(f"{node_id}: auditor entry violates audit independence")

        query_caps: set[str] = set()
        query_refs = split(row.get("entry_query_refs", ""))
        if row.get("entry_mode") != "AUTHORIZED_QUERY_REQUIRED" or not query_refs:
            errors.append(f"{node_id}: every IA node requires an explicit authorized initial query")
        for ref in query_refs:
            method = ""
            caps: set[str] = set()
            owner_session = ""
            owner_service = ""
            if ref in projections:
                q = projections[ref]
                used_projection_refs[ref] += 1
                if q.get("ia_node_id") != node_id:
                    errors.append(f"{node_id}: projection {ref} belongs to another IA node")
                method = q.get("method", "")
                caps = {q.get("authorization_capability", "")}
                owner_session, owner_service = q.get("owner_session", ""), q.get("owner_service", "")
            elif ref.startswith("MODOP:"):
                op = modern.get(ref.removeprefix("MODOP:"), {})
                method = op.get("method", "")
                caps = {op.get("authorizationCapability", "")}
                source = op.get("_source", "")
                owner_session = next((f"HRIS-{m.upper()}" for m in ("hrm", "per", "tim", "sys") if f"/{m}/" in f"/{source}"), "")
            elif ref in shared:
                op = shared[ref]
                method = op.get("method", "")
                exception = exception_pairs.get((node_id, ref))
                if not exception or "READ" not in exception.get("state", ""):
                    errors.append(f"{node_id}: shared entry query {ref} lacks exact read exception")
                else:
                    caps = {exception.get("external_capability", "")}
            elif ref in pep:
                op = pep[ref]
                method = op.get("method", "")
                caps = set(split(op.get("canonical_capability_keys", "")))
                owner_session = f"HRIS-{op.get('module', '')}"
                owner_service = op.get("owner_service", "")
            else:
                errors.append(f"{node_id}: unresolved entry query ref {ref}")
                continue
            if method != "GET":
                errors.append(f"{node_id}: initial query ref {ref} is not GET")
            if not (caps & visibility):
                errors.append(f"{node_id}: initial query {ref} has no node visibility capability")
            query_caps.update(caps & visibility)
            if ref in projections or ref.startswith("MODOP:"):
                if owner_session and owner_session != ia_row.get("owner_session"):
                    errors.append(f"{node_id}: query {ref} owner session differs from IA owner")
                if owner_service and owner_service != ia_row.get("runtime_owner"):
                    errors.append(f"{node_id}: query {ref} runtime owner differs from IA owner")
            elif ref not in set(split(ia_row.get("api_contract_refs", ""))):
                errors.append(f"{node_id}: source query {ref} is absent from node contract refs")
        if query_caps != visibility:
            errors.append(f"{node_id}: visibility capabilities are not exactly backed by initial queries")

        action_refs = split(row.get("action_refs", ""))
        action_caps_expected = set(split(row.get("action_capability_refs", "")))
        if bool(action_refs) != bool(action_caps_expected):
            errors.append(f"{node_id}: action ref/capability presence mismatch")
        action_caps_found: set[str] = set()
        for ref in action_refs:
            method = ""
            caps: set[str] = set()
            if ref.startswith("MODOP:"):
                op = modern.get(ref.removeprefix("MODOP:"), {})
                method, caps = op.get("method", ""), {op.get("authorizationCapability", "")}
            elif ref in shared:
                op = shared[ref]
                method = op.get("method", "")
                exception = exception_pairs.get((node_id, ref))
                if not exception or "COMMAND" not in exception.get("state", ""):
                    errors.append(f"{node_id}: shared action {ref} lacks exact command exception")
                else:
                    caps = {exception.get("external_capability", "")}
            elif ref in pep:
                op = pep[ref]
                method, caps = op.get("method", ""), set(split(op.get("canonical_capability_keys", "")))
            else:
                errors.append(f"{node_id}: unresolved action ref {ref}")
                continue
            if method == "GET" or not method:
                errors.append(f"{node_id}: action ref {ref} is a query or unresolved")
            if not (caps & action_caps_expected):
                errors.append(f"{node_id}: action {ref} has no node action capability")
            action_caps_found.update(caps & action_caps_expected)
        if action_caps_found != action_caps_expected:
            errors.append(f"{node_id}: action capabilities are not exactly backed by action refs")
        if set(split(ia_row.get("authorization_refs", ""))) != visibility | action_caps_expected:
            errors.append(f"{node_id}: IA authorization refs are not exact visibility/action union")

    if used_projection_refs != Counter({query_id: 1 for query_id in projections}):
        errors.append("all 66 typed projections must be consumed by exactly one IA node")
    for row in exceptions.values():
        node_id, ref = row.get("ia_node_id", ""), row.get("contract_ref", "")
        target = access.get(node_id, {})
        refs = set(split(target.get("entry_query_refs", ""))) | set(split(target.get("action_refs", "")))
        if ref not in refs:
            errors.append(f"{row.get('exception_id')}: external exception is orphaned")
        package, duty = packages.get(row.get("hris_access_package", "")), duties.get(row.get("hris_atomic_duty", ""))
        if not package or not duty or row.get("hris_atomic_duty") not in set(split(package.get("atomic_duty_codes", ""))):
            errors.append(f"{row.get('exception_id')}: exception package/duty path is unresolved")
        if row.get("persona") == "ENTERPRISE_AUDITOR" and "READ_ONLY" not in row.get("state", ""):
            errors.append(f"{row.get('exception_id')}: auditor exception must be read-only")
    if "SOD_HRIS_AUDIT_INDEPENDENCE" not in {row.get("rule_code") for row in docs["sod"]}:
        errors.append("audit independence SoD rule is missing")
    return errors


def self_test(base: dict[str, Any]) -> tuple[int, list[str]]:
    cases: list[tuple[str, Any]] = []
    def add(name: str, mutate: Any) -> None:
        cases.append((name, mutate))
    add("entry-query-omission", lambda d: d["access"][0].__setitem__("entry_query_refs", "NONE"))
    add("command-used-as-query", lambda d: d["access"][1].__setitem__("entry_query_refs", "PEP-HRM-003"))
    add("projection-wrong-node", lambda d: d["projections"][0].__setitem__("ia_node_id", "BASE:my-hr-home"))
    add("projection-wrong-method", lambda d: d["projections"][0].__setitem__("method", "POST"))
    add("projection-wrong-owner", lambda d: d["projections"][0].__setitem__("owner_session", "HRIS-PAY"))
    add("projection-schema-ref-drift", lambda d: d["projections"][0].__setitem__("response_schema_ref", "wrong.json#/x"))
    add("persona-alias-rejected", lambda d: d["access"][0].__setitem__("canonical_personas", "OPERATOR"))
    add("auditor-operations-package-rejected", lambda d: d["access"][0].__setitem__("persona_access_profiles", d["access"][0]["persona_access_profiles"].replace("ENTERPRISE_AUDITOR=HRIS_AUDITOR>HRIS_DUTY_APP_SHELL_READER", "ENTERPRISE_AUDITOR=HRIS_HR_BUSINESS_PARTNER>HRIS_DUTY_APP_SHELL_READER")))
    add("missing-duty-assignment", lambda d: d["packages"][0].__setitem__("atomic_duty_codes", d["packages"][0]["atomic_duty_codes"].replace("HRIS_DUTY_APP_SHELL_READER", "")))
    add("external-exception-orphan", lambda d: d["exceptions"][0].__setitem__("contract_ref", "SHARED-API-005"))
    add("delegation-policy-substitution", lambda d: next(r for r in d["access"] if r["ia_node_id"] == "BASE:team-delegation").__setitem__("entry_query_refs", "SHARED-API-005"))
    add("action-query-swap", lambda d: next(r for r in d["access"] if r["action_refs"] != "NONE").__setitem__("entry_query_refs", next(r for r in d["access"] if r["action_refs"] != "NONE")["action_refs"].split("|")[0]))
    add("projection-orphan", lambda d: d["access"][0].__setitem__("entry_query_refs", d["access"][1]["entry_query_refs"]))
    add("schema-tool-warning", lambda d: d.__setitem__("_initial_errors", ["projection schema contains tool-output contamination"]))
    add("schema-tenant-alias", lambda d: d["schema"]["projections"]["IAQ-001"]["responseSchema"]["properties"].__setitem__("tenantId", {"type": "string", "format": "uuid"}))
    add("schema-open-items", lambda d: d["schema"]["projections"]["IAQ-001"]["responseSchema"]["properties"]["items"]["items"].__setitem__("additionalProperties", True))
    add("schema-missing-freshness", lambda d: d["schema"]["projections"]["IAQ-001"]["responseSchema"]["properties"]["queryState"]["properties"].pop("freshness"))
    add("schema-open-field-groups", lambda d: d["schema"]["projections"]["IAQ-001"]["responseSchema"]["properties"]["items"]["items"]["properties"]["fieldGroups"].__setitem__("additionalProperties", True))
    add("schema-field-group-drift", lambda d: d["schema"]["projections"]["IAQ-001"].__setitem__("fieldGroups", ["WRONG"]))
    add("cache-invalidation-drift", lambda d: d["schema"]["projections"]["IAQ-001"]["responseSchema"]["properties"]["queryState"]["properties"]["cachePolicy"]["properties"]["invalidationEvent"].__setitem__("const", "wrong.event.v1"))
    add("query-api-omission", lambda d: d["query_api"].pop())
    add("query-api-operation-duplicate", lambda d: d["query_api"][1].__setitem__("operation_id", d["query_api"][0]["operation_id"]))
    add("query-api-owner-drift", lambda d: d["query_api"][0].__setitem__("owner_session", "HRIS-PAY"))
    add("query-api-slice-rehome", lambda d: d["query_api"][0].__setitem__("primary_slice_id", "BASE-TFR-HRM-005"))
    add("query-api-owner-path-drift", lambda d: d["query_api"][0].__setitem__("owner_path", "/v1/hris/wrong"))
    add("query-api-pep-layer-omission", lambda d: d["query_api"][0].__setitem__("pep_layers", "|".join(sorted(PEP_LAYERS - {"PURPOSE_POLICY"}))))
    add("query-api-request-ref-drift", lambda d: d["query_api"][0].__setitem__("request_schema_ref", "wrong.json#/request"))
    add("query-api-filter-allowlist-drift", lambda d: d["query_api"][0].__setitem__("allowed_filters", "effectiveOn"))
    add("query-api-test-allocation-drift", lambda d: d["query_api"][0].__setitem__("test_allocation_id", "G3-PAY-BE-TEST"))
    def swap_listening_test_allocation(d: dict[str, Any]) -> None:
        query = next(row for row in d["query_api"] if row["query_id"] == "IAQ-033")
        runtime = next(row for row in d["runtime"] if row["query_id"] == "IAQ-033")
        query["test_allocation_id"] = "G3-SYS-LISTEN-INSIGHTS-BE-TEST"
        runtime["test_allocation_id"] = "G3-SYS-LISTEN-INSIGHTS-BE-TEST"
    add("listening-query-stream-allocation-swap", swap_listening_test_allocation)
    add("allocation-taxonomy-substitution", lambda d: d["allocations"][0].__setitem__("allocation_id", "G3-HRM-BE-SOURCE-SUBSTITUTED"))
    add("runtime-row-omission", lambda d: d["runtime"].pop())
    add("runtime-invariant-omission", lambda d: d["runtime"][0].__setitem__("required_invariants", "|".join(sorted(RUNTIME_INVARIANTS - {"CURSOR_SCOPE_REVISION_BINDING"}))))
    add("runtime-method-omission", lambda d: d["runtime"][0].__setitem__("required_test_methods", "|".join(sorted(RUNTIME_TEST_METHODS - {"fieldSummaryMatchesSerializedDecisions"}))))
    add("runtime-test-class-drift", lambda d: d["runtime"][0].__setitem__("required_test_class", "*GenericQueryTest"))
    add("schema-semantic-value-drift", lambda d: d["schema"]["projections"]["IAQ-001"]["responseSchema"]["properties"]["items"]["items"]["properties"]["fieldGroups"]["properties"]["SELF_PROFILE"]["oneOf"][0]["properties"]["value"].__setitem__("$ref", "#/$defs/MoneyValue"))
    add("schema-state-condition-omission", lambda d: d["schema"]["projections"]["IAQ-001"]["responseSchema"]["allOf"].pop())
    add("schema-open-filter", lambda d: d["schema"]["projections"]["IAQ-001"]["requestSchema"]["properties"]["filter"].__setitem__("additionalProperties", True))
    add("schema-problem-status-drift", lambda d: d["schema"]["$defs"]["Problem"]["properties"]["status"].__setitem__("enum", [200]))
    add("schema-trusted-tenant-request-leak", lambda d: d["schema"]["projections"]["IAQ-001"]["requestSchema"]["properties"].__setitem__("tenantId", {"type": "integer"}))
    add("field-type-row-omission", lambda d: d["field_types"].pop())
    add("field-type-heuristic-reclassification", lambda d: next(r for r in d["field_types"] if r["field_group"] == "PAYROLL_POLICY").__setitem__("value_type", "MoneyValue"))
    add("field-type-owner-drift", lambda d: d["field_types"][0].__setitem__("owner_sessions", "HRIS-PAY"))
    add("mask-real-value-rejected", lambda d: d["schema"]["projections"]["IAQ-001"]["responseSchema"]["properties"]["items"]["items"]["properties"]["fieldGroups"]["properties"]["SELF_PROFILE"]["oneOf"][1]["properties"].__setitem__("value", {"$ref": "#/$defs/ReferenceValue"}))
    add("view-null-value-rejected", lambda d: d["schema"]["projections"]["IAQ-001"]["responseSchema"]["properties"]["items"]["items"]["properties"]["fieldGroups"]["properties"]["SELF_PROFILE"]["oneOf"][0]["properties"].__setitem__("value", {"type": "null"}))
    add("unknown-field-decision-rejected", lambda d: d["schema"]["projections"]["IAQ-001"]["responseSchema"]["properties"]["items"]["items"]["properties"]["fieldGroups"]["properties"]["SELF_PROFILE"]["oneOf"][0]["properties"]["decision"].__setitem__("const", "REDACT"))
    add("locale-runtime-boundary-drift", lambda d: d["schema"]["projections"]["IAQ-001"]["requestSchema"]["properties"]["locale"].__setitem__("pattern", "^[a-z]{2}$"))
    add("timezone-runtime-boundary-drift", lambda d: d["schema"]["projections"]["IAQ-001"]["requestSchema"]["properties"]["timeZone"].__setitem__("maxLength", 3))
    add("response-cursor-contract-drift", lambda d: d["schema"]["projections"]["IAQ-001"]["responseSchema"]["properties"]["queryState"]["properties"]["nextCursor"]["anyOf"][0].pop("pattern"))
    add("typed-filter-string-flattening", lambda d: d["schema"]["projections"]["IAQ-001"]["requestSchema"]["properties"]["filter"]["properties"].__setitem__("selfProfile", {"type": "string"}))
    add("action-key-row-omission", lambda d: d["actions"].pop())
    add("action-key-internal-id-leak", lambda d: d["actions"][0].__setitem__("action_key", d["actions"][0]["provenance_ref"]))
    add("action-key-query-method", lambda d: d["actions"][0].__setitem__("method", "GET"))
    add("action-key-path-drift", lambda d: d["actions"][0].__setitem__("browser_path", "/api/wrong"))
    add("action-key-idempotency-drift", lambda d: d["actions"][0].__setitem__("idempotency_policy", "NONE"))

    def leak_internal_action_id(d: dict[str, Any]) -> None:
        query_id = next(
            qid for qid, projection in d["schema"]["projections"].items()
            if projection["responseSchema"]["properties"]["items"]["items"]["properties"]["availableActions"]["maxItems"] > 0
        )
        d["schema"]["projections"][query_id]["responseSchema"]["properties"]["items"]["items"]["properties"]["availableActions"]["items"]["oneOf"][0]["properties"]["actionKey"]["const"] = "PEP-HRM-003"

    add("wire-internal-action-id-leak", leak_internal_action_id)

    failures: list[str] = []
    for name, mutate in cases:
        docs = copy.deepcopy(base)
        try:
            mutate(docs)
            found = validate_documents(docs, docs.pop("_initial_errors", []))
        except Exception as error:  # a mutation may intentionally break structure
            found = [str(error)]
        if not found:
            failures.append(name)
    return len(cases), failures


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--compact", action="store_true")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    docs, read_errors = load_documents()
    errors = validate_documents(docs, read_errors)
    result: dict[str, Any] = {
        "status": "PASS" if not errors else "FAIL",
        "checks": {
            "iaNodes": len(docs.get("ia", [])),
            "entryProjections": len(docs.get("projections", [])),
            "entryQueryPublicOperations": len(docs.get("query_api", [])),
            "entryQueryRuntimeContracts": len(docs.get("runtime", [])),
            "typedFieldGroups": len(docs.get("field_types", [])),
            "publicActionKeys": len(docs.get("actions", [])),
            "personaCategories": len(CANONICAL_PERSONAS),
            "accessPackages": len(docs.get("packages", [])),
            "atomicDuties": len(docs.get("duties", [])),
        },
        "errors": errors,
    }
    if args.self_test and not errors:
        count, failures = self_test(docs)
        result["selfTests"] = count
        result["selfTestFailures"] = failures
        if failures:
            result["status"] = "FAIL"
    if args.compact:
        print(json.dumps(result, ensure_ascii=False, separators=(",", ":")))
    else:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
