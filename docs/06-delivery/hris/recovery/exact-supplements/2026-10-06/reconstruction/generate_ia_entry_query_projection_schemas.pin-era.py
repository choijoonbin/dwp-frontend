#!/usr/bin/env python3
"""Generate the closed wire schemas for every canonical IA entry projection.

It consumes the independently authored projection, node-access and IA rows and
atomically emits the wire schema, public PEP/transport register and runtime
invariant register.  A failed generation cannot leave partial canonical files.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import tempfile
from pathlib import Path


HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
INPUT = HERE / "ia-entry-query-projection-register.csv"
ACCESS_INPUT = HERE / "ia-node-access-contract-register.csv"
IA_INPUT = HERE / "hris-information-architecture-register.csv"
FIELD_TYPE_INPUT = HERE / "ia-entry-query-field-type-register.csv"
OUTPUT = HERE / "ia-entry-query-projection-schemas.v1.json"
API_OUTPUT = HERE / "ia-entry-query-api-contract-register.csv"
RUNTIME_OUTPUT = HERE / "ia-entry-query-runtime-invariant-register.csv"
ACTION_OUTPUT = HERE / "ia-entry-query-action-key-register.csv"
QUERY_ID = re.compile(r"IAQ-[0-9]{3}")
FIELD_GROUP = re.compile(r"[A-Z][A-Z0-9_]{1,63}")
API_HEADER = [
    "query_id", "operation_id", "ia_node_id", "owner_session", "primary_slice_id",
    "owner_service", "method", "browser_path", "owner_path", "request_schema_ref",
    "response_schema_ref", "problem_schema_ref", "authorization_capability",
    "authorization_profiles", "pep_layers", "allowed_filters", "allowed_sorts",
    "default_sort", "max_page_size", "deep_link_route", "action_keys", "action_provenance_refs",
    "test_allocation_id", "runtime_invariant_ids", "implementation_state", "production_state",
]
ACTION_HEADER = [
    "action_key", "provenance_ref", "source_operation_id", "method", "browser_path",
    "owner_path", "owner_service", "authorization_capabilities", "step_up_policy",
    "idempotency_policy", "implementation_state", "production_state",
]
RUNTIME_HEADER = [
    "query_id", "primary_slice_id", "owner_session", "test_allocation_id",
    "required_invariants", "required_test_class", "required_test_methods",
    "evidence_state", "production_state",
]
PEP_LAYERS = (
    "GATEWAY_APP_ENTITLEMENT|OWNER_API_OPERATION|RESOURCE_POPULATION|"
    "REPOSITORY_TENANT_PREDICATE|FIELD_PROJECTION|PURPOSE_POLICY|AUDIT_DECISION"
)
RUNTIME_INVARIANTS = (
    "QUERY_STATE_ITEM_CARDINALITY|PARTIAL_FAILURE_STATE_MATCH|CURSOR_SCOPE_REVISION_BINDING|"
    "PAGE_LIMIT_AND_STABLE_ORDER|FIELD_DECISION_SUMMARY_MATCH|"
    "DEEP_LINK_ACTION_ALLOWLIST|TRUSTED_TENANT_CONTEXT_NON_SERIALIZATION|"
    "LOCALE_TIMEZONE_CANONICALIZATION|FIELD_DECISION_VIEW_MASK_OMIT|"
    "PROBLEM_STATUS_AND_CORRELATION"
)
FIELD_TYPE_HEADER = ["field_group", "value_type", "owner_sessions", "wire_semantics"]
VALUE_TYPES = {
    "AggregateValue", "AuditValue", "DurationValue", "EffectiveRangeValue",
    "MeasureValue", "MetadataValue", "MoneyValue", "PolicyValue", "QueueValue",
    "ReceiptValue", "ReferenceValue", "StatusValue", "TemporalValue", "TextValue",
}
WIRE_SEMANTICS = {
    "AggregateValue": "COUNT_REVISION_AS_OF",
    "AuditValue": "DECISION_EVIDENCE_TIME_REVISION",
    "DurationValue": "CANONICAL_DECIMAL_AND_UNIT",
    "EffectiveRangeValue": "CLOSED_DATE_RANGE_AND_REVISION",
    "MeasureValue": "CANONICAL_DECIMAL_UNIT_REVISION",
    "MetadataValue": "KEY_VERSION_DIGEST",
    "MoneyValue": "DECIMAL_STRING_AND_ISO_CURRENCY",
    "PolicyValue": "POLICY_KEY_REVISION_EFFECTIVITY_STATUS",
    "QueueValue": "OPEN_COUNT_OLDEST_TIME_SLA_STATUS",
    "ReceiptValue": "RECEIPT_ID_STATE_TIME_REVISION",
    "ReferenceValue": "PUBLIC_ID_CODE_LABEL_REVISION",
    "StatusValue": "STATUS_CODE_AND_REVISION",
    "TemporalValue": "INSTANT_RANGE_AND_DURATION",
    "TextValue": "BOUNDED_TEXT_LANGUAGE_REVISION",
}

def closed_object(properties: dict, required: list[str]) -> dict:
    return {
        "type": "object",
        "additionalProperties": False,
        "required": required,
        "properties": properties,
    }


def nullable(schema: dict) -> dict:
    return {"anyOf": [schema, {"type": "null"}]}


def camel(value: str) -> str:
    parts = value.lower().split("_")
    return parts[0] + "".join(part.title() for part in parts[1:])


def kebab_camel(value: str) -> str:
    return re.sub(r"(?<!^)(?=[A-Z])", "-", value).replace("_", "-").lower()


def path_key(value: str) -> str:
    normalized = re.sub(r"\{[^}]+\}", "resource", value).strip("/")
    return ".".join(part.replace("_", "-") for part in normalized.split("/") if part)


def recursive_operations(value: object, result: dict[str, dict]) -> None:
    if isinstance(value, dict):
        if isinstance(value.get("operationId"), str) and isinstance(value.get("method"), str):
            operation_id = value["operationId"]
            if operation_id in result:
                raise ValueError(f"duplicate modern operation: {operation_id}")
            result[operation_id] = value
        for child in value.values():
            recursive_operations(child, result)
    elif isinstance(value, list):
        for child in value:
            recursive_operations(child, result)


def action_contracts(access_rows: dict[str, dict[str, str]]) -> tuple[dict[str, dict[str, str]], list[dict[str, str]]]:
    pep_rows = list(csv.DictReader((HERE / "api-pep-binding-register.csv").open(newline="", encoding="utf-8")))
    pep: dict[str, dict[str, str]] = {}
    for row in pep_rows:
        pep[row["binding_id"]] = row
        pep[row["source_operation_id"]] = row
    shared = {
        row["contract_id"]: row
        for row in csv.DictReader((HERE / "shared-contract-catalog.csv").open(newline="", encoding="utf-8"))
    }
    modern: dict[str, dict] = {}
    modern_paths = [ROOT / path for path in (
        "session-evidence/hrm/g3-modern-capability-contracts.v1.json",
        "session-evidence/per/g3-modern-capability-contracts.v2.json",
        "session-evidence/tim/g3-modern-capability-contracts.v1.json",
        "session-evidence/sys/g3-modern-capability-contracts.v1.json",
    )]
    for path in modern_paths:
        recursive_operations(json.loads(path.read_text(encoding="utf-8")), modern)
    refs = sorted({
        ref
        for row in access_rows.values()
        for ref in ([] if row["action_refs"] == "NONE" else row["action_refs"].split("|"))
    })
    result: dict[str, dict[str, str]] = {}
    rows: list[dict[str, str]] = []
    for ref in refs:
        if ref.startswith("MODOP:"):
            operation = modern.get(ref.removeprefix("MODOP:"))
            if operation is None:
                raise ValueError(f"unresolved modern action ref: {ref}")
            browser_path = operation["path"]
            owner_service, owner_prefix = next(
                (service, prefix)
                for service, prefix in {
                    "dwp-people-server": "/api/people", "dwp-time-server": "/api/time",
                    "dwp-payroll-server": "/api/payroll", "dwp-platform-server": "/api/platform",
                    "dwp-auth-server": "/api/auth",
                }.items()
                if browser_path.startswith(prefix + "/")
            )
            action_key = "hris.action." + operation["operationId"].removeprefix("modern.")
            source_operation_id = operation["operationId"]
            method = operation["method"]
            owner_path = browser_path[len(owner_prefix):]
            capabilities = operation["authorizationCapability"]
            idempotency = "REQUIRED_IDEMPOTENCY_KEY" if operation["idempotency"] == "REQUIRED" else "SOURCE_POLICY_" + operation["idempotency"]
        elif ref in shared:
            operation = shared[ref]
            action_key = "hris.action.shared." + operation["semantic_role"].lower().replace("_", ".")
            source_operation_id = operation["semantic_role"]
            method, browser_path = operation["method"], operation["browser_path"]
            owner_path, owner_service = operation["owner_path"], operation["owner_service"]
            capabilities = "EXTERNAL_SHARED_AUTHORIZATION_EXCEPTION"
            idempotency = "REQUIRED_IDEMPOTENCY_KEY"
        else:
            operation = pep.get(ref)
            if operation is None:
                raise ValueError(f"unresolved PEP action ref: {ref}")
            source_operation_id = operation["source_operation_id"]
            method, browser_path = operation["method"], operation["browser_path"]
            owner_path, owner_service = operation["owner_path"], operation["owner_service"]
            capabilities = operation["canonical_capability_keys"]
            if source_operation_id.startswith("SYS-API-"):
                action_key = f"hris.action.sys.{method.lower()}." + path_key(browser_path.removeprefix("/api/"))
            else:
                action_key = f"hris.action.{operation['module'].lower()}." + kebab_camel(source_operation_id)
            idempotency = "REQUIRED_IDEMPOTENCY_KEY"
        if method == "GET":
            raise ValueError(f"query ref cannot be emitted as an action: {ref}")
        if action_key in result:
            raise ValueError(f"duplicate public action key: {action_key}")
        row = {
            "action_key": action_key,
            "provenance_ref": ref,
            "source_operation_id": source_operation_id,
            "method": method,
            "browser_path": browser_path,
            "owner_path": owner_path,
            "owner_service": owner_service,
            "authorization_capabilities": capabilities,
            "step_up_policy": "OWNER_PEP_RISK_POLICY_DECISION_REQUIRED",
            "idempotency_policy": idempotency,
            "implementation_state": "REQUIRED_G3_ACTION_DESCRIPTOR_NOT_IMPLEMENTED",
            "production_state": "NOT_AUTHORIZED_G6",
        }
        result[ref] = row
        rows.append(row)
    if len(rows) != 202:
        raise ValueError(f"action key register must contain 202 exact actions, got {len(rows)}")
    return result, rows


def common_defs() -> dict:
    decimal_string = {"type": "string", "pattern": r"^-?(0|[1-9][0-9]*)(\.[0-9]{1,6})?$"}
    revision = {"type": "integer", "minimum": 1}
    return {
        "MoneyValue": closed_object(
            {"amount": decimal_string, "currency": {"type": "string", "pattern": r"^[A-Z]{3}$"}},
            ["amount", "currency"],
        ),
        "TemporalValue": closed_object(
            {
                "startAt": {"type": "string", "format": "date-time"},
                "endAt": nullable({"type": "string", "format": "date-time"}),
                "durationMinutes": {"type": "integer", "minimum": 0},
            },
            ["startAt", "endAt", "durationMinutes"],
        ),
        "DurationValue": closed_object(
            {
                "value": decimal_string,
                "unit": {"type": "string", "enum": ["MINUTES", "HOURS", "DAYS"]},
                "revision": revision,
            },
            ["value", "unit", "revision"],
        ),
        "EffectiveRangeValue": closed_object(
            {
                "effectiveFrom": {"type": "string", "format": "date"},
                "effectiveTo": nullable({"type": "string", "format": "date"}),
                "revision": revision,
            },
            ["effectiveFrom", "effectiveTo", "revision"],
        ),
        "StatusValue": closed_object(
            {"code": {"type": "string", "pattern": r"^[A-Z][A-Z0-9_]{1,63}$"}, "revision": revision},
            ["code", "revision"],
        ),
        "ReceiptValue": closed_object(
            {
                "receiptId": {"type": "string", "format": "uuid"},
                "state": {"type": "string", "pattern": r"^[A-Z][A-Z0-9_]{1,63}$"},
                "occurredAt": {"type": "string", "format": "date-time"},
                "revision": revision,
            },
            ["receiptId", "state", "occurredAt", "revision"],
        ),
        "PolicyValue": closed_object(
            {
                "policyKey": {"type": "string", "pattern": r"^[a-z][a-z0-9._-]{1,127}$"},
                "revision": revision,
                "effectiveFrom": {"type": "string", "format": "date"},
                "effectiveTo": nullable({"type": "string", "format": "date"}),
                "status": {"type": "string", "pattern": r"^[A-Z][A-Z0-9_]{1,63}$"},
            },
            ["policyKey", "revision", "effectiveFrom", "effectiveTo", "status"],
        ),
        "MeasureValue": closed_object(
            {
                "value": decimal_string,
                "unit": {"type": "string", "pattern": r"^[A-Z][A-Z0-9_]{0,31}$"},
                "revision": revision,
            },
            ["value", "unit", "revision"],
        ),
        "ReferenceValue": closed_object(
            {
                "publicId": {"type": "string", "pattern": r"^[A-Za-z0-9._:-]{1,128}$"},
                "code": {"type": "string", "pattern": r"^[A-Z][A-Z0-9_]{1,63}$"},
                "label": {"type": "string", "minLength": 1, "maxLength": 512},
                "revision": revision,
            },
            ["publicId", "code", "label", "revision"],
        ),
        "AggregateValue": closed_object(
            {
                "itemCount": {"type": "integer", "minimum": 0},
                "revision": revision,
                "asOf": {"type": "string", "format": "date-time"},
            },
            ["itemCount", "revision", "asOf"],
        ),
        "AuditValue": closed_object(
            {
                "decisionCode": {"type": "string", "pattern": r"^[A-Z][A-Z0-9_]{1,63}$"},
                "evidenceDigest": {"type": "string", "pattern": r"^[0-9a-f]{64}$"},
                "occurredAt": {"type": "string", "format": "date-time"},
                "revision": revision,
            },
            ["decisionCode", "evidenceDigest", "occurredAt", "revision"],
        ),
        "MetadataValue": closed_object(
            {
                "key": {"type": "string", "pattern": r"^[A-Za-z0-9._:-]{1,128}$"},
                "version": {"type": "string", "pattern": r"^[A-Za-z0-9._:-]{1,64}$"},
                "digest": nullable({"type": "string", "pattern": r"^[0-9a-f]{64}$"}),
            },
            ["key", "version", "digest"],
        ),
        "TextValue": closed_object(
            {
                "text": {"type": "string", "minLength": 1, "maxLength": 4096},
                "language": {"type": "string", "minLength": 2, "maxLength": 35},
                "revision": revision,
            },
            ["text", "language", "revision"],
        ),
        "QueueValue": closed_object(
            {
                "openCount": {"type": "integer", "minimum": 0},
                "oldestAt": nullable({"type": "string", "format": "date-time"}),
                "slaStatus": {"type": "string", "pattern": r"^[A-Z][A-Z0-9_]{1,63}$"},
                "revision": revision,
            },
            ["openCount", "oldestAt", "slaStatus", "revision"],
        ),
        "Problem": closed_object(
            {
                "type": {"type": "string", "format": "uri"},
                "title": {"type": "string", "minLength": 1, "maxLength": 256},
                "status": {"type": "integer", "enum": [400, 401, 403, 404, 409, 429, 503]},
                "code": {"type": "string", "pattern": r"^[A-Z][A-Z0-9_]{1,63}$"},
                "correlationId": {"type": "string", "format": "uuid"},
                "retryable": {"type": "boolean"},
            },
            ["type", "title", "status", "code", "correlationId", "retryable"],
        ),
        **filter_defs(decimal_string),
    }


def filter_defs(decimal_string: dict) -> dict:
    nullable_decimal = nullable(decimal_string)
    nullable_code = nullable({"type": "string", "pattern": r"^[A-Z][A-Z0-9_]{1,63}$"})
    array_code = {"type": "array", "maxItems": 50, "uniqueItems": True,
                  "items": {"type": "string", "pattern": r"^[A-Z][A-Z0-9_]{1,63}$"}}
    array_ref = {"type": "array", "maxItems": 50, "uniqueItems": True,
                 "items": {"type": "string", "pattern": r"^[A-Za-z0-9._:-]{1,128}$"}}
    return {
        "MoneyFilter": closed_object({"minimumAmount": nullable_decimal, "maximumAmount": nullable_decimal,
                                      "currency": nullable({"type": "string", "pattern": r"^[A-Z]{3}$"})}, []),
        "TemporalFilter": closed_object({"startFrom": nullable({"type": "string", "format": "date-time"}),
                                         "startTo": nullable({"type": "string", "format": "date-time"}),
                                         "endFrom": nullable({"type": "string", "format": "date-time"}),
                                         "endTo": nullable({"type": "string", "format": "date-time"})}, []),
        "DurationFilter": closed_object({"minimum": nullable_decimal, "maximum": nullable_decimal,
                                         "unit": nullable({"type": "string", "enum": ["MINUTES", "HOURS", "DAYS"]})}, []),
        "EffectiveRangeFilter": closed_object({"activeOn": nullable({"type": "string", "format": "date"}),
                                               "from": nullable({"type": "string", "format": "date"}),
                                               "to": nullable({"type": "string", "format": "date"})}, []),
        "StatusFilter": closed_object({"codes": array_code, "minimumRevision": nullable({"type": "integer", "minimum": 1})}, []),
        "ReceiptFilter": closed_object({"receiptIds": array_ref, "states": array_code}, []),
        "PolicyFilter": closed_object({"policyKeys": array_ref, "minimumRevision": nullable({"type": "integer", "minimum": 1})}, []),
        "MeasureFilter": closed_object({"minimum": nullable_decimal, "maximum": nullable_decimal, "unit": nullable_code}, []),
        "ReferenceFilter": closed_object({"publicIds": array_ref, "codes": array_code}, []),
        "MetadataFilter": closed_object({"keys": array_ref, "versions": array_ref}, []),
        "TextFilter": closed_object({"query": nullable({"type": "string", "minLength": 1, "maxLength": 256})}, []),
        "QueueFilter": closed_object({"minimumOpenCount": nullable({"type": "integer", "minimum": 0}),
                                      "maximumOpenCount": nullable({"type": "integer", "minimum": 0}), "slaStates": array_code}, []),
        "AggregateFilter": closed_object({"minimumItemCount": nullable({"type": "integer", "minimum": 0}),
                                          "maximumItemCount": nullable({"type": "integer", "minimum": 0})}, []),
        "AuditFilter": closed_object({"decisionCodes": array_code, "evidenceDigest": nullable({"type": "string", "pattern": r"^[0-9a-f]{64}$"})}, []),
    }


def query_state_schema() -> dict:
    non_negative = {"type": "integer", "minimum": 0}
    return closed_object(
        {
            "state": {"type": "string", "enum": ["COMPLETE", "EMPTY", "PARTIAL", "UNAVAILABLE"]},
            "scopeDecisionRevision": {"type": "string", "pattern": r"^[A-Za-z0-9._:-]{1,128}$"},
            "freshness": {"type": "string", "enum": ["CURRENT", "STALE", "UNAVAILABLE"]},
            "nextCursor": nullable({"type": "string", "pattern": r"^[A-Za-z0-9_-]{16,1024}$"}),
            "fieldDecisionSummary": closed_object(
                {"viewCount": non_negative, "maskedCount": non_negative, "omittedCount": non_negative},
                ["viewCount", "maskedCount", "omittedCount"],
            ),
            "partialFailures": {
                "type": "array",
                "maxItems": 32,
                "items": closed_object(
                    {
                        "componentKey": {"type": "string", "pattern": r"^[a-z][a-z0-9._-]{0,127}$"},
                        "errorCode": {"type": "string", "pattern": r"^[A-Z][A-Z0-9_]{1,63}$"},
                        "correlationId": {"type": "string", "format": "uuid"},
                        "retryable": {"type": "boolean"},
                    },
                    ["componentKey", "errorCode", "correlationId", "retryable"],
                ),
            },
            "correlationId": {"type": "string", "format": "uuid"},
            "cachePolicy": closed_object(
                {
                    "authorizationDecisionRevision": {
                        "type": "string",
                        "pattern": r"^[A-Za-z0-9._:-]{1,128}$",
                    },
                    "invalidationEvent": {"const": "dwp.hris.access.assignment.changed.v1"},
                    "maxAgeSeconds": {"type": "integer", "minimum": 0, "maximum": 300},
                },
                ["authorizationDecisionRevision", "invalidationEvent", "maxAgeSeconds"],
            ),
        },
        [
            "state",
            "scopeDecisionRevision",
            "freshness",
            "nextCursor",
            "fieldDecisionSummary",
            "partialFailures",
            "correlationId",
            "cachePolicy",
        ],
    )


def field_decision_schema(value_type: str) -> dict:
    return {
        "oneOf": [
            closed_object(
                {"decision": {"const": "VIEW"}, "value": {"$ref": f"#/$defs/{value_type}"}},
                ["decision", "value"],
            ),
            closed_object(
                {
                    "decision": {"const": "MASK"},
                    "value": {"type": "null"},
                    "maskReason": {"type": "string", "pattern": r"^[A-Z][A-Z0-9_]{1,63}$"},
                    "maskedDisplayKey": {"type": "string", "pattern": r"^[a-z][a-z0-9._-]{1,127}$"},
                },
                ["decision", "value", "maskReason", "maskedDisplayKey"],
            ),
        ]
    }


def request_schema(row: dict[str, str], field_groups: list[str], field_types: dict[str, str]) -> dict:
    filter_properties = {
        camel(group): nullable({"$ref": f"#/$defs/{field_types[group].removesuffix('Value')}Filter"})
        for group in field_groups
    }
    filter_properties["effectiveOn"] = nullable({"type": "string", "format": "date"})
    sort_values = [f"{camel(group)}:ASC" for group in field_groups] + [
        f"{camel(group)}:DESC" for group in field_groups
    ] + ["itemPublicId:ASC", "itemPublicId:DESC"]
    return closed_object(
        {
            "asOf": nullable({"type": "string", "format": "date-time"}),
            "limit": {"type": "integer", "minimum": 1, "maximum": 100},
            "cursor": nullable({"type": "string", "pattern": r"^[A-Za-z0-9_-]{16,1024}$"}),
            "filter": closed_object(filter_properties, []),
            "sort": {"type": "array", "minItems": 1, "maxItems": 3, "uniqueItems": True,
                     "items": {"type": "string", "enum": sort_values}},
            "locale": {"type": "string", "minLength": 2, "maxLength": 35},
            "timeZone": {"type": "string", "minLength": 1, "maxLength": 255},
            "correlationId": {"type": "string", "format": "uuid"},
        },
        ["limit", "filter", "sort", "locale", "timeZone", "correlationId"],
    )


def response_schema(
    row: dict[str, str], field_groups: list[str], field_types: dict[str, str],
    ia_row: dict[str, str], access_row: dict[str, str], actions_by_ref: dict[str, dict[str, str]]
) -> dict:
    action_refs = [] if access_row["action_refs"] == "NONE" else access_row["action_refs"].split("|")
    action_descriptors = [
        closed_object(
            {
                "actionKey": {"const": actions_by_ref[ref]["action_key"]},
                "method": {"const": actions_by_ref[ref]["method"]},
                "hrefTemplate": {"const": actions_by_ref[ref]["browser_path"]},
                "idempotencyPolicy": {"const": actions_by_ref[ref]["idempotency_policy"]},
                "stepUpPolicy": {"const": actions_by_ref[ref]["step_up_policy"]},
            },
            ["actionKey", "method", "hrefTemplate", "idempotencyPolicy", "stepUpPolicy"],
        )
        for ref in action_refs
    ]
    item = closed_object(
        {
            "itemPublicId": {"type": "string", "pattern": r"^[A-Za-z0-9._:-]{1,128}$"},
            "title": {"type": "string", "minLength": 1, "maxLength": 512},
            "statusCode": {"type": "string", "pattern": r"^[A-Z][A-Z0-9_]{1,63}$"},
            "fieldGroups": {
                "type": "object",
                "additionalProperties": False,
                "minProperties": 1,
                "properties": {name: field_decision_schema(field_types[name]) for name in field_groups},
            },
            "deepLink": closed_object(
                {
                    "route": {"const": ia_row["canonical_route"]},
                    "resourcePublicId": {"type": "string", "pattern": r"^[A-Za-z0-9._:-]{1,128}$"},
                },
                ["route", "resourcePublicId"],
            ),
            "availableActions": {
                "type": "array", "uniqueItems": True,
                "maxItems": len(action_refs),
                "items": {"oneOf": action_descriptors} if action_refs else False,
            },
        },
        ["itemPublicId", "title", "statusCode", "fieldGroups", "deepLink", "availableActions"],
    )
    response = closed_object(
        {
            "projectionVersion": {"const": "1"},
            "asOf": {"type": "string", "format": "date-time"},
            "variantKey": {"const": row["variant_key"]},
            "queryState": query_state_schema(),
            "items": {"type": "array", "maxItems": 500, "items": item},
        },
        ["projectionVersion", "asOf", "variantKey", "queryState", "items"],
    )
    response["allOf"] = [
        {
            "if": {"properties": {"queryState": {"properties": {"state": {"enum": ["EMPTY", "UNAVAILABLE"]}}}}},
            "then": {"properties": {"items": {"maxItems": 0}}},
        },
        {
            "if": {"properties": {"queryState": {"properties": {"state": {"const": "PARTIAL"}}}}},
            "then": {"properties": {"queryState": {"properties": {"partialFailures": {"minItems": 1}}}}},
        },
        {
            "if": {"properties": {"queryState": {"properties": {"state": {"const": "COMPLETE"}}}}},
            "then": {"properties": {"queryState": {"properties": {"partialFailures": {"maxItems": 0}}}}},
        },
        {
            "if": {"properties": {"queryState": {"properties": {"state": {"const": "UNAVAILABLE"}}}}},
            "then": {"properties": {"queryState": {"properties": {
                "freshness": {"const": "UNAVAILABLE"}, "nextCursor": {"type": "null"}
            }}}},
        },
        {
            "if": {"properties": {"queryState": {"properties": {"freshness": {"const": "UNAVAILABLE"}}}}},
            "then": {"properties": {
                "items": {"maxItems": 0},
                "queryState": {"properties": {
                    "state": {"const": "UNAVAILABLE"}, "nextCursor": {"type": "null"}
                }},
            }},
        },
    ]
    return response


def build() -> tuple[dict, list[dict[str, str]], list[dict[str, str]], list[dict[str, str]]]:
    with INPUT.open(newline="", encoding="utf-8") as stream:
        rows = list(csv.DictReader(stream))
    with FIELD_TYPE_INPUT.open(newline="", encoding="utf-8") as stream:
        reader = csv.DictReader(stream)
        if reader.fieldnames != FIELD_TYPE_HEADER:
            raise ValueError(f"field type header drift: {reader.fieldnames}")
        field_type_rows = list(reader)
    with ACCESS_INPUT.open(newline="", encoding="utf-8") as stream:
        access_by_node = {row["ia_node_id"]: row for row in csv.DictReader(stream)}
    with IA_INPUT.open(newline="", encoding="utf-8") as stream:
        ia_by_node = {row["ia_node_id"]: row for row in csv.DictReader(stream)}
    actions_by_ref, action_rows = action_contracts(access_by_node)
    if len(rows) != 66:
        raise ValueError(f"projection register must contain exactly 66 rows, got {len(rows)}")
    field_types: dict[str, str] = {}
    field_type_rows_by_name: dict[str, dict[str, str]] = {}
    for type_row in field_type_rows:
        group = type_row["field_group"]
        value_type = type_row["value_type"]
        if not FIELD_GROUP.fullmatch(group) or group in field_types or value_type not in VALUE_TYPES:
            raise ValueError(f"invalid/duplicate explicit field type row: {group} -> {value_type}")
        if type_row["wire_semantics"] != WIRE_SEMANTICS[value_type]:
            raise ValueError(f"wire semantics drift for {group}")
        field_types[group] = value_type
        field_type_rows_by_name[group] = type_row
    used_field_owners: dict[str, set[str]] = {}
    for projection_row in rows:
        for group in projection_row["field_scope"].split("|"):
            used_field_owners.setdefault(group, set()).add(projection_row["owner_session"])
    if set(field_types) != set(used_field_owners) or len(field_types) != 138:
        raise ValueError("field type register must cover the exact 138 field-group universe")
    for group, owners in used_field_owners.items():
        if field_type_rows_by_name[group]["owner_sessions"].split("|") != sorted(owners):
            raise ValueError(f"field type owner session closure drift for {group}")
    seen: set[str] = set()
    projections: dict[str, dict] = {}
    api_rows: list[dict[str, str]] = []
    runtime_rows: list[dict[str, str]] = []
    for row in rows:
        query_id = row["query_id"]
        if not QUERY_ID.fullmatch(query_id) or query_id in seen:
            raise ValueError(f"invalid or duplicate query id: {query_id}")
        seen.add(query_id)
        groups = row["field_scope"].split("|")
        if not groups or any(not FIELD_GROUP.fullmatch(group) for group in groups) or len(groups) != len(set(groups)):
            raise ValueError(f"invalid field groups for {query_id}: {groups}")
        expected_ref = f"ia-entry-query-projection-schemas.v1.json#/projections/{query_id}"
        if row["response_schema_ref"] != expected_ref:
            raise ValueError(f"schema ref drift for {query_id}")
        if row["ia_node_id"] not in access_by_node or row["ia_node_id"] not in ia_by_node:
            raise ValueError(f"unresolved IA/access row for {query_id}")
        access = access_by_node[row["ia_node_id"]]
        ia = ia_by_node[row["ia_node_id"]]
        request_ref = f"ia-entry-query-projection-schemas.v1.json#/projections/{query_id}/requestSchema"
        problem_ref = "ia-entry-query-projection-schemas.v1.json#/$defs/Problem"
        filters = [camel(group) for group in groups] + ["effectiveOn"]
        sorts = [f"{camel(group)}:ASC" for group in groups] + [
            f"{camel(group)}:DESC" for group in groups
        ] + ["itemPublicId:ASC", "itemPublicId:DESC"]
        module = row["owner_session"].removeprefix("HRIS-")
        test_allocation = (
            "G3-SYS-AUTH-BE-TEST"
            if row["owner_service"] == "dwp-auth-server"
            else f"G3-{module}-BE-TEST"
        )
        owner_prefix = {
            "dwp-people-server": "/api/people",
            "dwp-time-server": "/api/time",
            "dwp-payroll-server": "/api/payroll",
            "dwp-platform-server": "/api/platform",
            "dwp-auth-server": "/api/auth",
        }[row["owner_service"]]
        if not row["browser_path"].startswith(owner_prefix):
            raise ValueError(f"gateway owner prefix drift for {query_id}")
        projections[query_id] = {
            "queryId": query_id,
            "iaNodeId": row["ia_node_id"],
            "variantKey": row["variant_key"],
            "authorizationCapability": row["authorization_capability"],
            "fieldGroups": groups,
            "requestSchema": request_schema(row, groups, field_types),
            "problemSchema": {"$ref": "#/$defs/Problem"},
            "responseSchema": response_schema(row, groups, field_types, ia, access, actions_by_ref),
        }
        api_rows.append({
            "query_id": query_id,
            "operation_id": f"IAQ.OP.{query_id[-3:]}",
            "ia_node_id": row["ia_node_id"],
            "owner_session": row["owner_session"],
            "primary_slice_id": row["primary_slice_id"],
            "owner_service": row["owner_service"],
            "method": "GET",
            "browser_path": row["browser_path"],
            "owner_path": row["browser_path"][len(owner_prefix):],
            "request_schema_ref": request_ref,
            "response_schema_ref": expected_ref + "/responseSchema",
            "problem_schema_ref": problem_ref,
            "authorization_capability": row["authorization_capability"],
            "authorization_profiles": row["authorization_profiles"],
            "pep_layers": PEP_LAYERS,
            "allowed_filters": "|".join(filters),
            "allowed_sorts": "|".join(sorts),
            "default_sort": "itemPublicId:ASC",
            "max_page_size": "100",
            "deep_link_route": ia["canonical_route"],
            "action_keys": "|".join(
                actions_by_ref[ref]["action_key"]
                for ref in ([] if access["action_refs"] == "NONE" else access["action_refs"].split("|"))
            ) or "NONE",
            "action_provenance_refs": access["action_refs"],
            "test_allocation_id": test_allocation,
            "runtime_invariant_ids": RUNTIME_INVARIANTS,
            "implementation_state": "REQUIRED_G3_ENTRY_QUERY_NOT_IMPLEMENTED",
            "production_state": "NOT_AUTHORIZED_G6",
        })
        runtime_rows.append({
            "query_id": query_id,
            "primary_slice_id": row["primary_slice_id"],
            "owner_session": row["owner_session"],
            "test_allocation_id": test_allocation,
            "required_invariants": RUNTIME_INVARIANTS,
            "required_test_class": f"*{module.title()}IaEntryQueryContractTest",
            "required_test_methods": "emptyUnavailableHaveNoItems|partialRequiresFailure|completeHasNoFailure|cursorBindsScopeAndRevision|pageHonorsLimitAndStableOrder|fieldSummaryMatchesSerializedDecisions|deepLinksAndActionsAreAllowlisted|trustedTenantContextIsNotSerialized|localeAndTimeZoneAreCanonical|fieldDecisionViewMaskOmitSemantics|problemStatusAndCorrelationAreClosed",
            "evidence_state": "REQUIRED_G3_NAMED_TEST_NOT_IMPLEMENTED",
            "production_state": "NOT_AUTHORIZED_G6",
        })
    document = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "contractId": "HRIS-IA-ENTRY-QUERY-PROJECTIONS-V2",
        "schemaVersion": "2.0.0",
        "projectionCount": len(projections),
        "fieldGroupTypeCount": len(field_types),
        "tenantContextPolicy": "SERVER_TRUSTED_CONTEXT_NOT_SERIALIZED",
        "fieldDecisionSemantics": "VIEW_OR_MASK_SERIALIZED; OMIT_MEANS_FIELD_GROUP_PROPERTY_ABSENT",
        "$defs": common_defs(),
        "projections": projections,
    }
    return document, api_rows, runtime_rows, action_rows


def atomic_write(document: dict) -> None:
    rendered = render(document)
    if "Warning: truncated output" in rendered or not rendered.startswith("{"):
        raise ValueError("refusing to write contaminated generated JSON")
    fd, raw_path = tempfile.mkstemp(prefix=f".{OUTPUT.name}.", suffix=".tmp", dir=OUTPUT.parent)
    temp_path = Path(raw_path)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as stream:
            stream.write(rendered)
            stream.flush()
            os.fsync(stream.fileno())
        json.loads(temp_path.read_text(encoding="utf-8"))
        os.replace(temp_path, OUTPUT)
    finally:
        temp_path.unlink(missing_ok=True)


def render(document: dict) -> str:
    return json.dumps(document, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def render_csv(rows: list[dict[str, str]], header: list[str]) -> str:
    import io

    buffer = io.StringIO(newline="")
    writer = csv.DictWriter(buffer, fieldnames=header, lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
    return buffer.getvalue()


def atomic_write_text(path: Path, rendered: str) -> None:
    fd, raw_path = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    temp_path = Path(raw_path)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as stream:
            stream.write(rendered)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temp_path, path)
    finally:
        temp_path.unlink(missing_ok=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    document, api_rows, runtime_rows, action_rows = build()
    if args.check:
        expected = {
            OUTPUT: render(document),
            API_OUTPUT: render_csv(api_rows, API_HEADER),
            RUNTIME_OUTPUT: render_csv(runtime_rows, RUNTIME_HEADER),
            ACTION_OUTPUT: render_csv(action_rows, ACTION_HEADER),
        }
        drift = [path.name for path, value in expected.items() if not path.is_file() or path.read_text(encoding="utf-8") != value]
        if drift:
            raise SystemExit(f"IA_ENTRY_QUERY_SCHEMA_GENERATION=FAIL deterministic output drift={drift}")
        print(f"IA_ENTRY_QUERY_SCHEMA_GENERATION=PASS mode=check projections={document['projectionCount']} api={len(api_rows)} runtime={len(runtime_rows)} actions={len(action_rows)}")
        return
    atomic_write(document)
    atomic_write_text(API_OUTPUT, render_csv(api_rows, API_HEADER))
    atomic_write_text(RUNTIME_OUTPUT, render_csv(runtime_rows, RUNTIME_HEADER))
    atomic_write_text(ACTION_OUTPUT, render_csv(action_rows, ACTION_HEADER))
    print(f"IA_ENTRY_QUERY_SCHEMA_GENERATION=PASS projections={document['projectionCount']} api={len(api_rows)} runtime={len(runtime_rows)} actions={len(action_rows)} output={OUTPUT}")


if __name__ == "__main__":
    main()
