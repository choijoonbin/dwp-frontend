#!/usr/bin/env python3
"""Independently validate the reviewed G3 canonical ownership successor.

The validator intentionally does not import the generator.  It recomputes the
closed operation/event sets and primary-owner projection from the sealed G2
disposition, recovered current registers, and reviewed design sources.
"""

from __future__ import annotations

import argparse
import copy
import csv
import hashlib
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any


HERE = Path(__file__).resolve().parent
HRIS_ROOT = HERE.parents[1]
FRONTEND_ROOT = HERE.parents[4]
BLUEPRINT = HRIS_ROOT / "recovery/hris-porting-blueprint-2026-09-09"
CODING = BLUEPRINT / "coding-readiness"
G2_DIR = HRIS_ROOT / "g2-successors/2026-10-07"

G2_DISPOSITION = G2_DIR / "g3-primary-ownership-disposition.v1.json"
SOURCE_EXACT = CODING / "modern-capability-exact-schema-contracts.v1.json"
SOURCE_EVENTS = CODING / "modern-capability-event-payload-contracts.v1.json"
SOURCE_SLICES = CODING / "g3-slice-code-go-register.csv"
AUTH_REGISTER = CODING / "modern-capability-authorization-register.csv"
PUBLIC_PEP = CODING / "api-pep-binding-register.csv"
SERVICE_PEP = CODING / "service-api-auth-binding-register.csv"
XCON = CODING / "cross-module-schema-binding-register.csv"
SYS_G2 = BLUEPRINT / "session-evidence/sys/g2-contract-catalog.csv"
DESIGN_SOURCE = CODING / "modern_closed_set_design.py"
CAUSAL_SOURCE = CODING / "modern_causal_successor.py"
LISTENING_SOURCE = CODING / "sys_listening_canonical_design.py"
OPERATION_SOURCE = CODING / "generate_modern_operation_ssot_successor.py"
EXACT_SUCCESSOR_SOURCE = CODING / "generate_modern_exact_event_successor.py"

GENERATOR = HERE / "generate_g3_canonical_ownership.py"
EXACT = HERE / "modern-capability-exact-schema-contracts.v1.json"
EVENTS = HERE / "modern-capability-event-payload-contracts.v1.json"
SEMANTIC = HERE / "modern-capability-semantic-bindings.v1.json"
IDENTITY = HERE / "modern-capability-public-identity-registry.v1.json"
OWNERSHIP = HERE / "g3-contract-primary-ownership-register.csv"
MANIFEST = HERE / "manifest.v1.json"

STATUS = "SEALED_G3_DESIGN_NOT_IMPLEMENTED"
OWNER_STATUS = "SEALED_G3_PRIMARY_OWNER"
EXPECTED_PROFILE = {
    "PUBLIC_PEP": 175,
    "INTERNAL_SERVICE_PEP": 11,
    "XCON_PRODUCER": 21,
    "SYS_G2_CONTRACT": 84,
    "BASE_EVENT": 48,
    "MODERN_OPERATION": 199,
    "MODERN_EVENT": 157,
}
EXPECTED_SESSION_OPERATIONS = {
    "HRIS-HRM": 70,
    "HRIS-PER": 76,
    "HRIS-TIM": 12,
    "HRIS-SYS": 41,
}
OWNERSHIP_FIELDS = [
    "contract_id",
    "contract_kind",
    "owner_session",
    "primary_slice_id",
    "source_semantic_ref",
    "source_register_ref",
    "rationale",
    "status",
]
SOURCE_PATHS = (
    G2_DISPOSITION,
    SOURCE_EXACT,
    SOURCE_EVENTS,
    SOURCE_SLICES,
    AUTH_REGISTER,
    PUBLIC_PEP,
    SERVICE_PEP,
    XCON,
    SYS_G2,
    DESIGN_SOURCE,
    CAUSAL_SOURCE,
    LISTENING_SOURCE,
    OPERATION_SOURCE,
    EXACT_SUCCESSOR_SOURCE,
)
DATA_OUTPUTS = (EXACT, EVENTS, SEMANTIC, IDENTITY, OWNERSHIP)


sys.path.insert(0, str(CODING))
from modern_closed_set_design import (  # noqa: E402
    NON_LISTENING_HANDLER_ADDITIONAL_EVENTS,
    NON_LISTENING_HANDLER_EVENTS,
    NEW_COMMAND_RUNTIME,
    NEW_QUERY_RUNTIME,
    REMOVED_OPERATION_IDS,
    REMOVED_PUBLIC_EVENT_IDS,
    REPLACED_PUBLIC_EVENT_IDS,
    all_new_operation_ids,
    events_for_new_operation,
    mode_for_new_operation,
    session_for_new_operation,
)
from modern_causal_successor import (  # noqa: E402
    CONDITIONAL_COMMAND_EVENTS,
    EVENT_TYPES,
    STATE,
    STATE_COLUMN_OVERRIDES,
    aggregate_root_for,
    state_column_for,
)
from sys_listening_canonical_design import build_static_design  # noqa: E402
from generate_modern_operation_ssot_successor import (  # noqa: E402
    BUSINESS_INPUT_SPECS,
    GLOBAL_BUSINESS_INPUT_SPECS,
    HANDLER_RUNTIME,
    ROUTE_OVERRIDES,
    _event as build_reviewed_event,
    _listening_handlers as build_reviewed_listening_handlers,
    _new_command as build_official_new_command,
    _new_query as build_official_new_query,
    _non_listening_handler as build_reviewed_non_listening_handler,
    _semantic_operation_overlay as apply_official_semantic_overlay,
)
from generate_modern_exact_event_successor import (  # noqa: E402
    _child_schema as build_official_child_schema,
    _record_schema as build_official_record_schema,
    _response_schema as build_official_response_schema,
)


class ValidationError(ValueError):
    """Raised for a deterministic successor validation failure."""


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValidationError(message)


def read_json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    require(isinstance(value, dict), f"JSON root must be object: {path}")
    return value


def read_csv(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        return list(reader.fieldnames or []), list(reader)


def repo_path(path: Path) -> str:
    return path.resolve().relative_to(FRONTEND_ROOT.resolve()).as_posix()


def sha256_bytes(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def file_pin(path: Path) -> dict[str, Any]:
    raw = path.read_bytes()
    return {"path": repo_path(path), "bytes": len(raw), "sha256": sha256_bytes(raw)}


def payload_bytes(value: dict[str, Any]) -> bytes:
    body = copy.deepcopy(value)
    body.pop("sealedPayloadSha256", None)
    return json.dumps(
        body, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")


def reseal(value: dict[str, Any]) -> None:
    value["sealedPayloadSha256"] = sha256_bytes(payload_bytes(value))


def verify_seal(value: dict[str, Any], label: str) -> None:
    require(
        value.get("sealedPayloadSha256") == sha256_bytes(payload_bytes(value)),
        f"{label} sealed payload digest mismatch",
    )


def split_refs(value: str) -> list[str]:
    return [item for item in value.split("|") if item]


def prefix_kind(contract_id: str, operations: set[str], events: set[str]) -> str:
    if contract_id in operations:
        return "MODERN_OPERATION"
    if contract_id in events:
        return "MODERN_EVENT"
    if contract_id.startswith("SVC-PEP-"):
        return "INTERNAL_SERVICE_PEP"
    if contract_id.startswith("PEP-"):
        return "PUBLIC_PEP"
    if contract_id.startswith("XCON-"):
        return "XCON_PRODUCER"
    if contract_id.startswith(("SYS-API-", "SYS-EVT-")):
        return "SYS_G2_CONTRACT"
    if contract_id.startswith("EVT-"):
        return "BASE_EVENT"
    if contract_id.startswith("IAQ-"):
        return "IAQ"
    raise ValidationError(f"unclassified current primary ref: {contract_id}")


def handler_slice(handler_id: str) -> str:
    prefixes = (
        ("internal.recruiting.", "MOD-HRM-RECRUIT"),
        ("internal.benefits.", "MOD-HRM-BENEFITS"),
        ("internal.hrservice.", "MOD-HRM-HRSD"),
        ("internal.contingent.", "MOD-HRM-CONTINGENT"),
        ("internal.growth.", "MOD-PER-GROWTH"),
        ("internal.wfm.", "MOD-TIM-WFM"),
        ("internal.analytics.", "MOD-SYS-ANALYTICS"),
        ("internal.ai.", "MOD-SYS-AI"),
        ("internal.workforceplan.", "MOD-HRM-WFP"),
        ("internal.listening.", "MOD-SYS-LISTEN"),
    )
    matches = [slice_id for prefix, slice_id in prefixes if handler_id.startswith(prefix)]
    require(len(matches) == 1, f"handler slice is not unique: {handler_id}")
    return matches[0]


def event_type_and_version(event_name: str) -> tuple[str, int]:
    match = re.fullmatch(r"(.+)\.v([1-9][0-9]*)", event_name)
    require(match is not None, f"event lacks exact version suffix: {event_name}")
    return match.group(1), int(match.group(2))


def event_topic(event_name: str) -> str:
    event_type, version = event_type_and_version(event_name)
    kebab = re.sub(r"(?<!^)(?=[A-Z])", "-", event_type).lower()
    return f"dwp.hris.modern.{kebab}.v{version}"


def path_fields(path: str) -> list[dict[str, Any]]:
    return [
        {
            "name": name,
            "type": "UUID",
            "required": True,
            "validation": "CANONICAL_PUBLIC_UUID_OWNER_RESOLVED",
            "sensitivity": "INTERNAL",
            "tokenization": "OPAQUE_PUBLIC_ID",
        }
        for name in re.findall(r"\{([^}]+)\}", path)
    ]


def request_headers(mode: str, expected_version: str) -> list[dict[str, Any]]:
    rows = [{
        "name": "X-Correlation-ID",
        "type": "UUID",
        "required": True,
        "validation": "canonical UUID",
        "sensitivity": "INTERNAL",
        "tokenization": "OPAQUE_CORRELATION_ID",
    }]
    if mode == "COMMAND":
        rows.append({
            "name": "Idempotency-Key",
            "type": "STRING",
            "required": True,
            "validation": "1..128 opaque characters",
            "sensitivity": "INTERNAL",
            "tokenization": "NONE",
        })
    if expected_version == "REQUIRED":
        rows.append({
            "name": "If-Match",
            "type": "BIGINT",
            "required": True,
            "validation": "positive owner aggregate version",
            "sensitivity": "INTERNAL",
            "tokenization": "NONE",
        })
    return rows


def source_id_set(path: Path, field: str) -> set[str]:
    _header, rows = read_csv(path)
    values = [row.get(field, "") for row in rows]
    require(all(values), f"missing {field} in {path}")
    require(len(values) == len(set(values)), f"duplicate {field} in {path}")
    return set(values)


def reviewed_route(
    operation_id: str,
    fallback_path: str,
    fallback_method: str,
    fallback_authorization: str,
) -> tuple[str, str, str]:
    """Resolve the frozen public route and authorization source independently."""
    return ROUTE_OVERRIDES.get(
        operation_id,
        (fallback_path, fallback_method, fallback_authorization),
    )


def authorization_index() -> dict[tuple[str, str], dict[str, str]]:
    header, rows = read_csv(AUTH_REGISTER)
    required = {
        "binding_id", "modern_capability_id", "canonical_capability_key",
        "canonical_action", "canonical_population_types", "persona_categories",
        "purpose_code", "enforcement_layers", "implementation_state",
        "production_state",
    }
    require(required <= set(header), "authorization register columns drift")
    result: dict[tuple[str, str], dict[str, str]] = {}
    for row in rows:
        key = (row["modern_capability_id"], row["canonical_capability_key"])
        require(key not in result, f"duplicate authorization binding: {key}")
        result[key] = row
    require(len(rows) == len(result) == 48, "authorization binding set drift")
    return result


def authorization_contract(
    index: dict[tuple[str, str], dict[str, str]],
    capability_id: str,
    authorization_capability: str,
) -> tuple[list[str], dict[str, Any]]:
    row = index.get((capability_id, authorization_capability))
    require(
        row is not None,
        "reviewed authorization binding unavailable: "
        f"{capability_id} {authorization_capability}",
    )
    assert row is not None
    population_types = split_refs(row["canonical_population_types"])
    require(population_types, f"authorization population is empty: {row['binding_id']}")
    return population_types, {
        "bindingId": row["binding_id"],
        "source": repo_path(AUTH_REGISTER),
        "canonicalCapabilityKey": row["canonical_capability_key"],
        "canonicalAction": row["canonical_action"],
        "populationTypes": population_types,
        "personaCategories": split_refs(row["persona_categories"]),
        "purposeCode": row["purpose_code"],
        "enforcementLayers": split_refs(row["enforcement_layers"]),
        "implementationState": row["implementation_state"],
        "productionState": row["production_state"],
    }


def business_body_fields(operation_id: str) -> list[dict[str, Any]]:
    """Project only typed business inputs reviewed by the operation source."""
    by_name: dict[str, dict[str, Any]] = {}
    for specs in (
        GLOBAL_BUSINESS_INPUT_SPECS.get(operation_id, ()),
        BUSINESS_INPUT_SPECS.get(operation_id, ()),
    ):
        for name, field_type, entity, table, column in specs:
            field = by_name.setdefault(name, {
                "name": name,
                "type": field_type,
                "required": True,
                "sensitivity": "INTERNAL",
                "tokenization": "OPAQUE_PUBLIC_ID" if field_type == "UUID" else "NONE",
                "reviewedPhysicalTargets": [],
            })
            require(
                field["type"] == field_type,
                f"business field type conflict: {operation_id} {name}",
            )
            target = f"{table}.{column}"
            if target not in field["reviewedPhysicalTargets"]:
                field["reviewedPhysicalTargets"].append(target)
            if entity:
                reference = {"entityType": entity, "idSpace": "PUBLIC_UUID"}
                require(
                    field.get("referenceContract", reference) == reference,
                    f"business field entity conflict: {operation_id} {name}",
                )
                field["referenceContract"] = reference
    if operation_id in NEW_COMMAND_RUNTIME:
        runtime = NEW_COMMAND_RUNTIME[operation_id]
        post_states = list(runtime[5])
        post_source = runtime[6]
        if post_source.startswith("body."):
            name = post_source.removeprefix("body.")
            field = by_name.setdefault(name, {
                "name": name,
                "type": "STRING",
                "required": True,
                "sensitivity": "INTERNAL",
                "tokenization": "NONE",
                "reviewedPhysicalTargets": [f"{runtime[2]}.{runtime[3]}"],
            })
            field["allowedValues"] = post_states
    return [by_name[name] for name in sorted(by_name)]


def minimal_reviewed_operation_base(
    source_operations: list[dict[str, Any]],
) -> dict[str, Any]:
    return {"operations": [{
        "operationId": source["operationId"],
        "capabilityId": source["capabilityId"],
        "session": source["session"],
        "authorizationCapability": source["authorizationCapability"],
        "mode": source["mode"],
        "method": source["method"],
        "path": source["path"],
        "requestFields": [],
        "selectors": [],
        "orderedDml": [],
        "events": [],
    } for source in source_operations]}


def official_new_operation_rows(
    source_operations: list[dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    base = minimal_reviewed_operation_base(source_operations)
    listening_bindings = {
        row["operationId"]: row
        for row in build_static_design()["publicOperationBindings"]
    }
    result: dict[str, dict[str, Any]] = {}
    for operation_id in sorted(all_new_operation_ids()):
        row = (
            build_official_new_command(base, operation_id)
            if operation_id in NEW_COMMAND_RUNTIME
            else build_official_new_query(base, operation_id)
        )
        if operation_id in listening_bindings:
            row["listeningAuthority"] = copy.deepcopy(
                listening_bindings[operation_id]
            )
        apply_official_semantic_overlay(row)
        result[operation_id] = row
    require(
        set(result) == set(all_new_operation_ids()) and len(result) == 101,
        "official reviewed new-operation projection closure drift",
    )
    require(
        {
            operation_id for operation_id in result
            if operation_id.startswith("modern.listening.")
        } == {"modern.listening.surveys.query", "modern.listening.survey.revise"},
        "new Listening operation overlay closure drift",
    )
    return result


def official_request_schema(operation: dict[str, Any]) -> dict[str, Any]:
    """Reproduce the reviewed helper body; its pinned source omits its return."""
    groups = {key: [] for key in ("pathParameters", "queryParameters", "headers", "body")}
    for field in operation.get("requestFields", []):
        location = field.get("location")
        require(location in groups,
                f"unsupported official request location: {operation['operationId']} {location}")
        groups[location].append({
            key: copy.deepcopy(value)
            for key, value in field.items()
            if key not in {"source", "location"}
        })
    return {
        "schemaId": operation["operationId"] + ".Request.v3",
        "kind": "OBJECT",
        "additionalProperties": False,
        **groups,
        "validationRules": [
            "reject unknown fields and caller tenant/actor",
            "business public references require operation-specific owner/revision/asOf proof",
            "Idempotency-Key and X-Correlation-ID are excluded from canonical business digest",
        ],
    }


def schema_refs(value: Any) -> list[str]:
    refs: list[str] = []
    if isinstance(value, dict):
        for key, child in value.items():
            if key in {"schemaRef", "itemSchemaRef"}:
                require(isinstance(child, str), "schema reference is not a string")
                refs.append(child)
            refs.extend(schema_refs(child))
    elif isinstance(value, list):
        for child in value:
            refs.extend(schema_refs(child))
    return refs


def retained_event_runtime(
    operation_id: str,
    source_exact: dict[str, Any],
) -> tuple[str, str, tuple[str, ...], tuple[str, ...]]:
    root = aggregate_root_for(operation_id)
    tables = {
        row["tableName"]: row for row in source_exact["tableSpecifications"]
    }
    try:
        state_column = state_column_for(tables[root], operation_id)
    except (KeyError, ValueError):
        state_column = STATE_COLUMN_OVERRIDES.get(operation_id, "status")
    pre_states, post_states, _source = STATE[operation_id]
    return root, state_column, tuple(pre_states), tuple(post_states)


def json_pointer_escape(value: str) -> str:
    return value.replace("~", "~0").replace("/", "~1")


def resolve_local_ref(
    reference: str,
    documents: dict[str, Any],
) -> Any:
    """Resolve an RFC 6901 JSON pointer against one of the published documents."""
    require("#" in reference, f"reference lacks fragment: {reference}")
    document_name, fragment = reference.split("#", 1)
    require(document_name in documents, f"reference document unavailable: {reference}")
    require(fragment == "" or fragment.startswith("/"), f"invalid JSON pointer: {reference}")
    value: Any = documents[document_name]
    if not fragment:
        return value
    for raw_token in fragment[1:].split("/"):
        token = raw_token.replace("~1", "/").replace("~0", "~")
        if isinstance(value, list):
            require(re.fullmatch(r"0|[1-9][0-9]*", token) is not None,
                    f"non-numeric array pointer token: {reference}")
            index = int(token)
            require(index < len(value), f"array pointer out of range: {reference}")
            value = value[index]
        elif isinstance(value, dict):
            require(token in value, f"object pointer key missing: {reference}")
            value = value[token]
        else:
            raise ValidationError(f"pointer traverses scalar: {reference}")
    return value


def expected_model() -> dict[str, Any]:
    g2 = read_json(G2_DISPOSITION)
    source_exact = read_json(SOURCE_EXACT)
    source_events = read_json(SOURCE_EVENTS)
    auth_index = authorization_index()
    source_operations = source_exact.get("operationBindings", [])
    source_by_id = {row.get("operationId"): row for row in source_operations}
    require(len(source_operations) == 100 and len(source_by_id) == 100, "source op set drift")
    official_new_operations = official_new_operation_rows(source_operations)
    expected_new_record_schemas: dict[str, dict[str, Any]] = {}
    expected_new_response_schemas: dict[str, dict[str, Any]] = {}
    for operation_id, official in sorted(official_new_operations.items()):
        if operation_id in NEW_COMMAND_RUNTIME:
            root = official["aggregateRoot"]["table"]
            nested = build_official_child_schema(official)
            response = build_official_response_schema(official, root, True)
        else:
            root = official["readPlan"]["tables"][0]
            nested = build_official_record_schema(official, root)
            response = build_official_response_schema(official, root, False)
        expected_new_record_schemas[nested["schemaId"]] = nested
        expected_new_response_schemas[response["schemaId"]] = response
    require(
        len(expected_new_record_schemas) == 101
        and len(expected_new_response_schemas) == 101,
        "official successor schema closure drift",
    )
    source_operation_index = {
        row["operationId"]: index for index, row in enumerate(source_operations)
    }
    predecessor_events = source_events.get("eventPayloadSchemas", [])
    predecessor_event_by_id = {row.get("eventName"): row for row in predecessor_events}
    require(
        len(predecessor_events) == 32
        and len(predecessor_event_by_id) == 32
        and None not in predecessor_event_by_id,
        "source event payload set drift",
    )
    predecessor_event_index = {
        row["eventName"]: index for index, row in enumerate(predecessor_events)
    }

    _header, slice_rows = read_csv(SOURCE_SLICES)
    slice_by_id = {row["slice_id"]: row for row in slice_rows}
    require(len(slice_rows) == 102 and len(slice_by_id) == 102, "slice set drift")
    primary: dict[str, dict[str, str]] = {}
    for row in slice_rows:
        for ref in split_refs(row.get("primary_contract_refs", "")):
            require(ref not in primary, f"multiple current primary owners: {ref}")
            primary[ref] = row

    source_op_ids = set(source_by_id)
    known_prefixes = (
        "PEP-", "SVC-PEP-", "XCON-", "SYS-API-", "SYS-EVT-", "EVT-", "IAQ-"
    )
    current_events = {
        ref for ref in primary
        if ref not in source_op_ids and not ref.startswith(known_prefixes)
    }
    current_counts = Counter(prefix_kind(ref, source_op_ids, current_events) for ref in primary)
    require(current_counts == Counter({
        "PUBLIC_PEP": 175,
        "INTERNAL_SERVICE_PEP": 11,
        "XCON_PRODUCER": 21,
        "SYS_G2_CONTRACT": 84,
        "BASE_EVENT": 48,
        "MODERN_OPERATION": 100,
        "MODERN_EVENT": 86,
        "IAQ": 66,
    }), "current primary profile drift")

    source_sets = {
        "PUBLIC_PEP": source_id_set(PUBLIC_PEP, "binding_id"),
        "INTERNAL_SERVICE_PEP": source_id_set(SERVICE_PEP, "binding_id"),
        "XCON_PRODUCER": source_id_set(XCON, "contract_id"),
        "SYS_G2_CONTRACT": source_id_set(SYS_G2, "contract_id"),
    }
    for kind, expected_ids in source_sets.items():
        actual_ids = {
            ref for ref in primary if prefix_kind(ref, source_op_ids, current_events) == kind
        }
        require(actual_ids == expected_ids, f"source ID closure drift: {kind}")

    listening = build_static_design()
    listening_events_by_op = {
        row["operationId"]: sorted(row["publicEventIds"])
        for row in listening["publicOperationBindings"]
    }
    retained = source_op_ids - set(REMOVED_OPERATION_IDS)
    new_ids = set(all_new_operation_ids())
    operation_ids = retained | new_ids
    require(not retained & new_ids and len(operation_ids) == 199, "operation successor set drift")

    operation_claims: dict[str, dict[str, Any]] = {}
    for operation_id in sorted(retained):
        source = source_by_id[operation_id]
        owner = primary[operation_id]
        path, method, authorization_capability = reviewed_route(
            operation_id,
            source["path"],
            source["method"],
            source["authorizationCapability"],
        )
        scope, authorization_binding = authorization_contract(
            auth_index, source["capabilityId"], authorization_capability,
        )
        if source["mode"] != "COMMAND":
            event_names: list[str] = []
        elif operation_id in listening_events_by_op:
            event_names = listening_events_by_op[operation_id]
        else:
            require(operation_id in EVENT_TYPES, f"retained command event missing: {operation_id}")
            candidates = [EVENT_TYPES[operation_id] + ".v2"] + [
                item["eventType"] + ".v2"
                for item in CONDITIONAL_COMMAND_EVENTS.get(operation_id, [])
            ]
            event_names = sorted({
                REPLACED_PUBLIC_EVENT_IDS.get(name, name)
                for name in candidates if name not in REMOVED_PUBLIC_EVENT_IDS
            })
        operation_claims[operation_id] = {
            "ownerSession": source["session"],
            "primarySliceId": owner["slice_id"],
            "capabilityId": source["capabilityId"],
            "mode": source["mode"],
            "method": method,
            "path": path,
            "action": authorization_binding["canonicalAction"],
            "authorizationCapability": authorization_capability,
            "scope": scope,
            "authorizationBinding": authorization_binding,
            "idempotency": source["idempotency"],
            "expectedVersion": source["expectedVersion"],
            "requestSchemaRef": source["requestSchemaRef"],
            "responseSchemaRef": source["responseSchemaRef"],
            "errorSchemaRefs": copy.deepcopy(source["errorSchemaRefs"]),
            "requestSchema": copy.deepcopy(source["requestSchema"]),
            "readsTables": copy.deepcopy(source["readsTables"]),
            "writesTables": copy.deepcopy(source["writesTables"]),
            "stateTransitionIds": copy.deepcopy(source["stateTransitionIds"]),
            "sourceOperationIndex": source_operation_index[operation_id],
            "predecessorEventNames": copy.deepcopy(source["eventNames"]),
            "sourceAuthority": {
                "kind": "RECOVERED_CURRENT_OPERATION_REVIEWED_SUCCESSOR_PROJECTION",
                "path": repo_path(SOURCE_EXACT),
                "sourceOperationId": operation_id,
                "reviewedRouteAuthority": repo_path(OPERATION_SOURCE),
            },
            "eventNames": event_names,
        }

    for operation_id in sorted(new_ids):
        official = official_new_operations[operation_id]
        mode = mode_for_new_operation(operation_id)
        runtime = NEW_COMMAND_RUNTIME[operation_id] if mode == "COMMAND" else NEW_QUERY_RUNTIME[operation_id]
        template_id, fallback_path = runtime[0], runtime[1]
        template = source_by_id[template_id]
        owner = primary[template_id]
        session = session_for_new_operation(operation_id)
        require(template["session"] == session == owner["session_id"], f"new op owner drift: {operation_id}")
        fallback_method = "POST" if mode == "COMMAND" else "GET"
        expected_route = reviewed_route(
            operation_id,
            fallback_path,
            fallback_method,
            template["authorizationCapability"],
        )
        official_route = (
            official["path"], official["method"], official["authorizationCapability"],
        )
        require(official_route == expected_route,
                f"official route/authorization projection drift: {operation_id}")
        path, method, authorization_capability = official_route
        scope, authorization_binding = authorization_contract(
            auth_index, template["capabilityId"], authorization_capability,
        )
        if mode == "COMMAND":
            pre_states = tuple(runtime[4])
            expected_version = "NOT_APPLICABLE" if pre_states == ("NONE",) else "REQUIRED"
            reads_tables = [runtime[2]]
            writes_tables = list(runtime[7])
            state_transition_ids = [
                "TR-" + operation_id.upper().replace(".", "-") + "-V3"
            ]
            event_names = sorted(event["eventName"] for event in official["events"])
            require(event_names == sorted(events_for_new_operation(operation_id)),
                    f"official command event closure drift: {operation_id}")
        else:
            expected_version = "NOT_APPLICABLE"
            reads_tables = list(runtime[2])
            writes_tables = []
            state_transition_ids = []
            event_names = []
        request_schema_ref = operation_id + ".Request.v3"
        request_schema = official_request_schema(official)
        operation_claims[operation_id] = {
            "ownerSession": session,
            "primarySliceId": owner["slice_id"],
            "capabilityId": template["capabilityId"],
            "mode": mode,
            "method": method,
            "path": path,
            "action": authorization_binding["canonicalAction"],
            "authorizationCapability": authorization_capability,
            "scope": scope,
            "authorizationBinding": authorization_binding,
            "idempotency": "REQUIRED" if mode == "COMMAND" else "READ_SAFE",
            "expectedVersion": expected_version,
            "requestSchemaRef": request_schema_ref,
            "responseSchemaRef": operation_id + ".Response.v3",
            "errorSchemaRefs": copy.deepcopy(template["errorSchemaRefs"]),
            "readsTables": reads_tables,
            "writesTables": writes_tables,
            "stateTransitionIds": state_transition_ids,
            "requestSchema": request_schema,
            "templateOperationId": template_id,
            "sourceAuthority": {
                "kind": "REVIEWED_SUCCESSOR_ADDITION",
                "path": repo_path(OPERATION_SOURCE),
                "templateOperationId": template_id,
                "closedSetAuthority": repo_path(DESIGN_SOURCE),
                "exactSchemaProjectionAuthority": repo_path(EXACT_SUCCESSOR_SOURCE),
            },
            "eventNames": event_names,
        }

    require(Counter(row["mode"] for row in operation_claims.values()) == {"COMMAND": 133, "QUERY": 66}, "mode partition drift")
    require(Counter(row["ownerSession"] for row in operation_claims.values()) == EXPECTED_SESSION_OPERATIONS, "session operation partition drift")

    caps_by_slice: dict[str, set[str]] = defaultdict(set)
    for claim in operation_claims.values():
        caps_by_slice[claim["primarySliceId"]].add(claim["capabilityId"])
    require(all(len(values) == 1 for values in caps_by_slice.values()), "slice capability ambiguity")

    event_claims: dict[str, dict[str, Any]] = {}

    def claim_event(
        event_name: str,
        producer_kind: str,
        producer_id: str,
        session: str,
        slice_id: str,
        capability_id: str,
        *,
        reviewed_contract: dict[str, Any] | None = None,
        source_authority: str = "",
        predecessor_event_schema_refs: list[str] | None = None,
    ) -> None:
        claim = {
            "producerKind": producer_kind,
            "producerId": producer_id,
            "ownerSession": session,
            "primarySliceId": slice_id,
            "capabilityId": capability_id,
            "reviewedContract": reviewed_contract,
            "sourceAuthority": source_authority,
            "predecessorEventSchemaRefs": predecessor_event_schema_refs or [],
        }
        require(event_name not in event_claims or event_claims[event_name] == claim,
                f"multiple expected event producers: {event_name}")
        event_claims[event_name] = claim

    for operation_id, claim in operation_claims.items():
        predecessor_refs = [
            f"{EVENTS.name}#/predecessorEventPayloadSchemas/"
            f"{predecessor_event_index[event_name]}"
            for event_name in claim.get("predecessorEventNames", [])
        ]
        if claim["mode"] == "COMMAND":
            if operation_id in NEW_COMMAND_RUNTIME:
                runtime = NEW_COMMAND_RUNTIME[operation_id]
                root, state_column = runtime[2], runtime[3]
                pre_states, post_states = tuple(runtime[4]), tuple(runtime[5])
            else:
                root, state_column, pre_states, post_states = retained_event_runtime(
                    operation_id, source_exact,
                )
        for event_name in claim["eventNames"]:
            reviewed_contract = build_reviewed_event(
                event_name,
                {
                    "session": claim["ownerSession"],
                    "authorizationCapability": claim["authorizationCapability"],
                },
                root,
                state_column,
                pre_states,
                post_states,
            )
            claim_event(event_name, "PUBLIC_OPERATION", operation_id,
                        claim["ownerSession"], claim["primarySliceId"], claim["capabilityId"],
                        reviewed_contract=reviewed_contract,
                        source_authority=repo_path(OPERATION_SOURCE),
                        predecessor_event_schema_refs=predecessor_refs)
    for handler_id, event_name in sorted(NON_LISTENING_HANDLER_EVENTS.items()):
        slice_id = handler_slice(handler_id)
        reviewed_handler = build_reviewed_non_listening_handler(handler_id, event_name)
        claim_event(event_name, "OWNER_LOCAL_HANDLER", handler_id,
                    slice_by_id[slice_id]["session_id"], slice_id, next(iter(caps_by_slice[slice_id])),
                    reviewed_contract=copy.deepcopy(reviewed_handler["event"]),
                    source_authority=repo_path(OPERATION_SOURCE))
    for handler_id, event_names in sorted(NON_LISTENING_HANDLER_ADDITIONAL_EVENTS.items()):
        slice_id = handler_slice(handler_id)
        primary_event_name = NON_LISTENING_HANDLER_EVENTS[handler_id]
        reviewed_handler = build_reviewed_non_listening_handler(
            handler_id, primary_event_name,
        )
        reviewed_additional = {
            row["eventName"]: row for row in reviewed_handler.get("additionalEvents", [])
        }
        for event_name in event_names:
            require(event_name in reviewed_additional,
                    f"reviewed handler additional event missing: {handler_id} {event_name}")
            claim_event(event_name, "OWNER_LOCAL_HANDLER", handler_id,
                        slice_by_id[slice_id]["session_id"], slice_id, next(iter(caps_by_slice[slice_id])),
                        reviewed_contract=copy.deepcopy(reviewed_additional[event_name]),
                        source_authority=repo_path(OPERATION_SOURCE))
    listening_handler_contracts = {
        row["handlerId"]: row["event"]
        for row in build_reviewed_listening_handlers() if row.get("event")
    }
    for handler_id, event_name in {
        "internal.listening.configuration.admission-install-receipt.consume": "EmployeeListeningSurveyPublished.v3",
        "internal.listening.configuration.admission-close-receipt.consume": "EmployeeListeningSurveyClosed.v3",
        "internal.listening.insights.cohort-package.consume": "EmployeeListeningCohortProjectionPublished.v1",
    }.items():
        require(handler_id in listening_handler_contracts,
                f"reviewed listening handler event missing: {handler_id}")
        claim_event(event_name, "OWNER_LOCAL_HANDLER", handler_id, "HRIS-SYS",
                    "MOD-SYS-LISTEN", "HRIS.MODERN.EMPLOYEE_LISTENING",
                    reviewed_contract=copy.deepcopy(listening_handler_contracts[handler_id]),
                    source_authority=repo_path(OPERATION_SOURCE))

    target_events = {
        REPLACED_PUBLIC_EVENT_IDS.get(name, name)
        for name in current_events if name not in REMOVED_PUBLIC_EVENT_IDS
    } | {
        name for claim in operation_claims.values() for name in claim["eventNames"]
    } | set(NON_LISTENING_HANDLER_EVENTS.values()) | {
        name for values in NON_LISTENING_HANDLER_ADDITIONAL_EVENTS.values() for name in values
    } | {
        row["eventName"] for row in listening["eventOwnership"]["canonicalPublicEvents"]
    }
    require(len(target_events) == 157 and set(event_claims) == target_events, "event successor set drift")

    owner_claims: dict[str, tuple[str, str, str]] = {}
    for ref, owner in primary.items():
        kind = prefix_kind(ref, source_op_ids, current_events)
        if kind not in {"MODERN_OPERATION", "MODERN_EVENT", "IAQ"}:
            owner_claims[ref] = (kind, owner["session_id"], owner["slice_id"])
    for operation_id, claim in operation_claims.items():
        owner_claims[operation_id] = (
            "MODERN_OPERATION", claim["ownerSession"], claim["primarySliceId"]
        )
    for event_name, claim in event_claims.items():
        owner_claims[event_name] = (
            "MODERN_EVENT", claim["ownerSession"], claim["primarySliceId"]
        )
    require(len(owner_claims) == 695, "expected ownership set is not 695")
    require(Counter(row[0] for row in owner_claims.values()) == EXPECTED_PROFILE, "expected ownership profile drift")

    register_specs = {
        "PUBLIC_PEP": (PUBLIC_PEP, "binding_id", "EXACT"),
        "INTERNAL_SERVICE_PEP": (SERVICE_PEP, "binding_id", "EXACT"),
        "XCON_PRODUCER": (XCON, "contract_id", "EXACT"),
        "SYS_G2_CONTRACT": (SYS_G2, "contract_id", "EXACT"),
        "BASE_EVENT": (SOURCE_SLICES, "primary_contract_refs", "PIPE_MEMBERSHIP"),
    }
    register_rows = {
        path: read_csv(path)[1] for path, _field, _mode in register_specs.values()
    }
    ownership_source_index: dict[str, dict[str, Any]] = {}
    for contract_id, (kind, session, slice_id) in sorted(owner_claims.items()):
        if kind.startswith("MODERN_"):
            continue
        path, selector_field, selector_mode = register_specs[kind]
        matches: list[tuple[int, dict[str, str]]] = []
        for index, row in enumerate(register_rows[path], start=1):
            candidate_values = (
                split_refs(row.get(selector_field, ""))
                if selector_mode == "PIPE_MEMBERSHIP"
                else [row.get(selector_field, "")]
            )
            if contract_id in candidate_values:
                matches.append((index, row))
        require(len(matches) == 1,
                f"non-modern ownership source row is not unique: {contract_id}")
        data_row, _source_row = matches[0]
        ownership_source_index[contract_id] = {
            "semantic": {
                "contractId": contract_id,
                "contractKind": kind,
                "ownerSession": session,
                "primarySliceId": slice_id,
                "authority": "CURRENT_PRIMARY_SLICE",
            },
            "sourceRegister": {
                "path": repo_path(path),
                "format": "CSV",
                "selectorField": selector_field,
                "selectorMode": selector_mode,
                "selectorValue": contract_id,
                "dataRow": data_row,
                "bytes": path.stat().st_size,
                "sha256": sha256_bytes(path.read_bytes()),
            },
        }

    expected_source_pins = [file_pin(path) for path in SOURCE_PATHS]
    set_seed = {
        "operationIds": sorted(operation_ids),
        "eventIds": sorted(target_events),
        "sourcePins": expected_source_pins,
        "g2BackendResultCommit": g2["sourcePins"]["backendResultCommit"],
    }
    canonical_set_id = "sha256:" + sha256_bytes(json.dumps(
        set_seed, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode("utf-8"))
    authority = {
        "generationStage": "G3_ONLY",
        "canonicalSetId": canonical_set_id,
        "sourceDisposition": repo_path(G2_DISPOSITION),
        "currentBackendCommit": g2["sourcePins"]["currentBackendCommit"],
        "reconciledBackendCommit": g2["sourcePins"]["reconciledBackendCommit"],
        "backendResultCommit": g2["sourcePins"]["backendResultCommit"],
        "historicalBytesReused": False,
        "historicalByteIdentityClaim": False,
        "implementationState": "NOT_STARTED_G3",
        "productionState": "NOT_AUTHORIZED_G6",
        "moduleCodeGoGranted": False,
        "productionAuthorizationGranted": False,
    }
    return {
        "g2": g2,
        "sourceExact": source_exact,
        "sourceEvents": source_events,
        "sourceById": source_by_id,
        "officialNewOperations": official_new_operations,
        "expectedNewRecordSchemas": expected_new_record_schemas,
        "expectedNewResponseSchemas": expected_new_response_schemas,
        "sourceOperationIndex": source_operation_index,
        "predecessorEventIndex": predecessor_event_index,
        "primaryOwners": primary,
        "sliceById": slice_by_id,
        "operationClaims": operation_claims,
        "eventClaims": event_claims,
        "ownerClaims": owner_claims,
        "ownershipSourceIndex": ownership_source_index,
        "sourcePins": expected_source_pins,
        "authority": authority,
    }


def load_bundle() -> dict[str, Any]:
    for path in (*DATA_OUTPUTS, MANIFEST):
        require(path.is_file(), f"published artifact missing: {path}")
    ownership_header, ownership_rows = read_csv(OWNERSHIP)
    return {
        "exact": read_json(EXACT),
        "events": read_json(EVENTS),
        "semantic": read_json(SEMANTIC),
        "identity": read_json(IDENTITY),
        "ownershipHeader": ownership_header,
        "ownership": ownership_rows,
        "manifest": read_json(MANIFEST),
        "raw": {path.name: path.read_bytes() for path in (*DATA_OUTPUTS, MANIFEST)},
    }


def validate_bundle(bundle: dict[str, Any], *, verify_artifact_bytes: bool = True) -> dict[str, Any]:
    expected = expected_model()
    exact = bundle["exact"]
    events = bundle["events"]
    semantic = bundle["semantic"]
    identity = bundle["identity"]
    ownership = bundle["ownership"]
    manifest = bundle["manifest"]

    for label, doc in (
        ("exact", exact), ("events", events), ("semantic", semantic),
        ("identity", identity), ("manifest", manifest),
    ):
        verify_seal(doc, label)
    for label, doc in (
        ("exact", exact), ("events", events), ("semantic", semantic),
        ("identity", identity), ("manifest", manifest),
    ):
        require(doc.get("authority") == expected["authority"], f"{label} authority drift")
    for label, doc in (("exact", exact), ("events", events), ("semantic", semantic), ("identity", identity)):
        require(doc.get("status") == STATUS, f"{label} status drift")

    operation_rows = exact.get("operationBindings", [])
    operation_map = {row.get("operationId"): row for row in operation_rows}
    require(len(operation_rows) == 199 and len(operation_map) == 199 and None not in operation_map,
            "exact operation cardinality/uniqueness drift")
    require(list(operation_map) == sorted(operation_map), "exact operations are not sorted")
    require(set(operation_map) == set(expected["operationClaims"]), "exact operation closed set drift")
    for operation_id, claim in expected["operationClaims"].items():
        row = operation_map[operation_id]
        for key in (
            "ownerSession", "primarySliceId", "capabilityId", "mode", "method",
            "path", "action", "authorizationCapability", "scope",
            "authorizationBinding", "idempotency", "expectedVersion",
            "requestSchemaRef", "responseSchemaRef", "errorSchemaRefs",
            "readsTables", "writesTables", "sourceAuthority",
            "stateTransitionIds",
        ):
            require(row.get(key) == claim[key], f"operation {key} drift: {operation_id}")
        require(row.get("eventNames") == claim["eventNames"], f"operation event closure drift: {operation_id}")
        require(
            row.get("predecessorEventNames") == claim.get("predecessorEventNames", []),
            f"operation predecessor event refs drift: {operation_id}",
        )
        request_schema = row.get("requestSchema")
        require(isinstance(request_schema, dict), f"request schema missing: {operation_id}")
        require(
            row.get("requestSchemaRef") == request_schema.get("schemaId"),
            f"request schema ref unresolved: {operation_id}",
        )
        if "requestSchema" in claim:
            require(
                request_schema == claim["requestSchema"],
                f"retained request schema semantic loss: {operation_id}",
            )
            require(
                row.get("requestSchemaRef") == claim["requestSchemaRef"],
                f"retained request schema ref drift: {operation_id}",
            )
        else:
            require(
                request_schema.get("body") == claim["requestBody"],
                f"reviewed business request body drift: {operation_id}",
            )
        require(row.get("implementationState") == "NOT_STARTED_G3", f"operation implementation grant: {operation_id}")
        require(row.get("productionState") == "NOT_AUTHORIZED_G6", f"operation production grant: {operation_id}")
    require(Counter(row["mode"] for row in operation_rows) == {"COMMAND": 133, "QUERY": 66}, "exact mode counts drift")
    require(Counter(row["ownerSession"] for row in operation_rows) == EXPECTED_SESSION_OPERATIONS, "exact session counts drift")

    response_schema_ids = {
        row.get("schemaId") for row in exact.get("responseSchemas", [])
    }
    error_schema_ids = {
        row.get("schemaId") for row in exact.get("commonErrorSchemas", [])
    }
    require(None not in response_schema_ids and None not in error_schema_ids,
            "schema registry contains unnamed schema")
    for operation_id, row in operation_map.items():
        require(
            row.get("responseSchemaRef") in response_schema_ids,
            f"response schema ref unresolved: {operation_id}",
        )
        refs = row.get("errorSchemaRefs")
        require(
            isinstance(refs, list) and bool(refs) and set(refs) <= error_schema_ids,
            f"error schema ref unresolved: {operation_id}",
        )

    predecessor_exact = expected["sourceExact"]
    for key in (
        "commonTableContract", "commonErrorSchemas", "tableSpecifications",
    ):
        require(exact.get(key) == predecessor_exact.get(key),
                f"predecessor exact schema section lost or changed: {key}")
    expected_record_schemas = [
        *predecessor_exact["recordSchemas"],
        *expected["expectedNewRecordSchemas"].values(),
    ]
    expected_response_schemas = [
        *predecessor_exact["responseSchemas"],
        *expected["expectedNewResponseSchemas"].values(),
    ]
    require(exact.get("recordSchemas") == expected_record_schemas,
            "official successor record/entity-child schema projection drift")
    require(exact.get("responseSchemas") == expected_response_schemas,
            "official successor response schema projection drift")
    require(
        all(exact.get("policies", {}).get(key) == value
            for key, value in predecessor_exact.get("policies", {}).items()),
        "predecessor exact policy semantic loss",
    )
    local_schema_ids = response_schema_ids | error_schema_ids | {
        row.get("schemaId") for row in exact.get("recordSchemas", [])
    }
    all_schema_refs = set(schema_refs(operation_rows)) | set(
        schema_refs(exact.get("recordSchemas", []))
    ) | set(schema_refs(exact.get("responseSchemas", [])))
    require(None not in local_schema_ids and all_schema_refs <= local_schema_ids,
            "nested request/response/entity-child schema ref unresolved")
    for operation_id in NEW_QUERY_RUNTIME:
        expected_ref = operation_id + ".Response.v3"
        require(operation_map[operation_id]["responseSchemaRef"] == expected_ref,
                f"new query response ref is not operation-specific: {operation_id}")
        require(response_schema_ids and expected_ref in response_schema_ids,
                f"new query response schema missing: {operation_id}")
    listening_revise_response = next(
        row for row in exact["responseSchemas"]
        if row["schemaId"] == "modern.listening.survey.revise.Response.v3"
    )
    listening_receipt_field = next(
        field for field in listening_revise_response["fields"]
        if field["name"] == "commandReceiptId"
    )
    require(
        listening_receipt_field.get("referenceContract", {}).get("entityType")
        == "table:sys_hris_listening_operation_receipts",
        "Listening configuration response receipt authority drift",
    )

    new_per = [
        row for operation_id, row in operation_map.items()
        if operation_id not in expected["sourceById"] and row["ownerSession"] == "HRIS-PER"
    ]
    require(len(new_per) == 40, "new PER operation cardinality drift")
    require(
        all(row["path"].startswith("/api/people/v1/hris/performance/") for row in new_per),
        "new PER operation escaped canonical people/performance prefix",
    )
    require(
        all("/api/performance/v1/hris/" not in row["path"] for row in operation_rows),
        "obsolete performance-first route prefix published",
    )
    for operation_id in (
        "modern.listening.surveys.query", "modern.listening.survey.revise",
    ):
        row = operation_map[operation_id]
        require(row["authorizationCapability"] == "hcm.listening.manage",
                f"listening admin authorization drift: {operation_id}")
        require("SELF" not in row["scope"],
                f"listening admin operation copied SELF scope: {operation_id}")
        require(row["path"].startswith("/api/platform/v1/admin/hris/listening/"),
                f"listening admin operation escaped admin route: {operation_id}")
    for operation_id in ("modern.benefits.plans.query", "modern.benefits.plan.query"):
        row = operation_map[operation_id]
        require(row["authorizationCapability"] == "hcm.benefits.operate",
                f"benefits plan query authorization drift: {operation_id}")
        require("SELF" not in row["scope"],
                f"benefits plan query copied SELF scope: {operation_id}")
    for operation_id in (
        "modern.benefits.enrollment.query", "modern.benefits.enrollments.query",
        "modern.benefits.lifeevent.query", "modern.benefits.lifeevents.query",
    ):
        row = operation_map[operation_id]
        require(row["authorizationCapability"] == "hcm.benefits.self.view",
                f"benefits self query authorization drift: {operation_id}")
        require(row["scope"] == ["SELF"],
                f"benefits self query population drift: {operation_id}")

    event_rows = events.get("eventPayloadSchemas", [])
    event_map = {row.get("eventName"): row for row in event_rows}
    require(len(event_rows) == 157 and len(event_map) == 157 and None not in event_map,
            "event cardinality/uniqueness drift")
    require(list(event_map) == sorted(event_map), "events are not sorted")
    require(set(event_map) == set(expected["eventClaims"]), "event closed set drift")
    for event_name, claim in expected["eventClaims"].items():
        row = event_map[event_name]
        for key in ("ownerSession", "primarySliceId", "capabilityId", "producerKind", "producerId"):
            require(row.get(key) == claim[key], f"event {key} drift: {event_name}")
        require(row.get("sourceAuthority") == claim["sourceAuthority"],
                f"event reviewed source authority drift: {event_name}")
        event_type, version = event_type_and_version(event_name)
        require(row.get("eventType") == event_type and row.get("schemaVersion") == version,
                f"event identity drift: {event_name}")
        require(row.get("topic") == event_topic(event_name), f"event topic drift: {event_name}")
        require(row.get("payloadSchemaId") == event_name + ".Payload",
                f"event payload schema identity drift: {event_name}")
        require(row.get("additionalProperties") is False,
                f"event payload permits unknown fields: {event_name}")
        predecessor_refs = row.get("predecessorEventSchemaRefs")
        require(
            predecessor_refs == claim["predecessorEventSchemaRefs"],
            f"event predecessor schema refs drift: {event_name}",
        )
        for reference in predecessor_refs:
            target = resolve_local_ref(reference, {EVENTS.name: events})
            require(isinstance(target, dict) and target.get("eventName"),
                    f"event predecessor schema ref unresolved: {event_name}")
        require("payloadContract" not in row,
                f"event retained generic payload wrapper: {event_name}")
        fields = row.get("fields")
        require(isinstance(fields, list) and len(fields) >= 6,
                f"event lacks reviewed durable payload fields: {event_name}")
        field_names = [field.get("name") for field in fields if isinstance(field, dict)]
        require(len(field_names) == len(fields) == len(set(field_names)) and None not in field_names,
                f"event payload fields are missing or duplicated: {event_name}")
        require(all(field.get("sourceKind") and field.get("source") for field in fields),
                f"event payload field lacks reviewed durable source: {event_name}")
        require(row.get("rawRequestMirroringForbidden") is True,
                f"event permits raw request mirroring: {event_name}")
        require(isinstance(row.get("emission"), dict),
                f"event emission contract missing: {event_name}")
        require(isinstance(row.get("audience"), dict),
                f"event audience contract missing: {event_name}")
        require(isinstance(row.get("refetchContract"), dict),
                f"event refetch contract missing: {event_name}")
        reviewed_contract = claim.get("reviewedContract")
        if reviewed_contract is not None:
            for key in (
                "condition", "aggregateEntityType", "emission", "fields",
                "rawRequestMirroringForbidden", "audience", "refetchContract",
            ):
                require(row.get(key) == reviewed_contract.get(key),
                        f"reviewed handler event {key} drift: {event_name}")
            if "privacyContract" in reviewed_contract:
                require(row.get("privacyContract") == reviewed_contract["privacyContract"],
                        f"reviewed handler privacy contract drift: {event_name}")
            else:
                require("privacyContract" not in row,
                        f"unsupported event privacy contract invented: {event_name}")
        require(row.get("implementationState") == "NOT_STARTED_G3", f"event implementation grant: {event_name}")
        require(row.get("productionState") == "NOT_AUTHORIZED_G6", f"event production grant: {event_name}")

    predecessor_events = expected["sourceEvents"]
    require(events.get("eventEnvelopeRef") == predecessor_events.get("eventEnvelopeRef"),
            "predecessor event envelope reference lost")
    require(events.get("eventEnvelope") == predecessor_events.get("eventEnvelope"),
            "predecessor event envelope semantic loss")
    require(
        events.get("predecessorEventPayloadSchemas")
        == predecessor_events.get("eventPayloadSchemas"),
        "predecessor event payload schemas lost or changed",
    )
    signatures = {
        tuple((field["name"], field["sourceKind"], field["source"]) for field in row["fields"])
        for row in event_rows
    }
    require(len(signatures) > 32,
            "event set collapsed to generic non-operation-specific payloads")

    semantic_ops = semantic.get("operationSemanticBindings", [])
    semantic_op_map = {row.get("operationId"): row for row in semantic_ops}
    require(len(semantic_ops) == 199 and set(semantic_op_map) == set(operation_map), "semantic operation closure drift")
    for index, row in enumerate(semantic_ops):
        operation_id = row["operationId"]
        exact_row = operation_map[operation_id]
        for key in ("ownerSession", "primarySliceId", "capabilityId", "mode", "method", "path"):
            require(row.get(key) == exact_row.get(key), f"semantic operation {key} drift: {operation_id}")
        require(row.get("eventIds") == exact_row.get("eventNames"), f"semantic event refs drift: {operation_id}")
        exact_ref = f"{EXACT.name}#/operationBindings/{index}"
        require(row.get("exactSchemaRef") == exact_ref,
                f"semantic exact operation ref drift: {operation_id}")
        require(resolve_local_ref(exact_ref, {EXACT.name: exact}).get("operationId") == operation_id,
                f"semantic exact operation ref unresolved: {operation_id}")
    semantic_events = semantic.get("eventSemanticBindings", [])
    semantic_event_map = {row.get("eventName"): row for row in semantic_events}
    require(len(semantic_events) == 157 and set(semantic_event_map) == set(event_map), "semantic event closure drift")
    for index, row in enumerate(semantic_events):
        event_name = row["eventName"]
        event_row = event_map[event_name]
        for key in ("ownerSession", "primarySliceId", "capabilityId", "producerKind", "producerId"):
            require(row.get(key) == event_row.get(key), f"semantic event {key} drift: {event_name}")
        event_ref = f"{EVENTS.name}#/eventPayloadSchemas/{index}"
        require(row.get("eventSchemaRef") == event_ref,
                f"semantic event schema ref drift: {event_name}")
        require(resolve_local_ref(event_ref, {EVENTS.name: events}).get("eventName") == event_name,
                f"semantic event schema ref unresolved: {event_name}")

    identity_ops = identity.get("operationPublicIdentities", [])
    identity_op_map = {row.get("operationId"): row for row in identity_ops}
    require(len(identity_ops) == 199 and set(identity_op_map) == set(operation_map), "identity operation closure drift")
    for operation_id, row in identity_op_map.items():
        exact_row = operation_map[operation_id]
        for key in ("method", "path", "ownerSession", "primarySliceId"):
            require(row.get(key) == exact_row.get(key), f"public operation identity {key} drift: {operation_id}")
    identity_events = identity.get("eventPublicIdentities", [])
    identity_event_map = {row.get("eventName"): row for row in identity_events}
    require(len(identity_events) == 157 and set(identity_event_map) == set(event_map), "identity event closure drift")
    for event_name, row in identity_event_map.items():
        event_row = event_map[event_name]
        require(row.get("eventType") == event_row.get("eventType"), f"public event type drift: {event_name}")
        require(row.get("version") == event_row.get("schemaVersion"), f"public event version drift: {event_name}")
        require(row.get("topic") == event_row.get("topic"), f"public event topic drift: {event_name}")
        require(row.get("ownerSession") == event_row.get("ownerSession"), f"public event owner drift: {event_name}")
        require(row.get("primarySliceId") == event_row.get("primarySliceId"), f"public event slice drift: {event_name}")

    require(bundle["ownershipHeader"] == OWNERSHIP_FIELDS, "ownership header drift")
    owner_map = {row.get("contract_id"): row for row in ownership}
    require(len(ownership) == 695 and len(owner_map) == 695 and None not in owner_map,
            "ownership cardinality/uniqueness drift")
    require(set(owner_map) == set(expected["ownerClaims"]), "ownership contract closed set drift")
    require(Counter(row.get("contract_kind") for row in ownership) == EXPECTED_PROFILE,
            "ownership category profile drift")
    require(all(row.get("status") == OWNER_STATUS for row in ownership), "ownership status drift")
    require(all(row.get("contract_kind") != "IAQ" for row in ownership), "IAQ leaked into ownership")
    for contract_id, (kind, session, slice_id) in expected["ownerClaims"].items():
        row = owner_map[contract_id]
        require(
            (row.get("contract_kind"), row.get("owner_session"), row.get("primary_slice_id"))
            == (kind, session, slice_id),
            f"primary owner drift: {contract_id}",
        )

    ownership_source_index = manifest.get("ownershipSourceIndex")
    require(
        ownership_source_index == expected["ownershipSourceIndex"],
        "manifest non-modern ownership source index drift",
    )
    documents = {
        EXACT.name: exact,
        EVENTS.name: events,
        SEMANTIC.name: semantic,
        IDENTITY.name: identity,
        MANIFEST.name: manifest,
    }
    semantic_operation_index = {
        row["operationId"]: index for index, row in enumerate(semantic_ops)
    }
    semantic_event_index = {
        row["eventName"]: index for index, row in enumerate(semantic_events)
    }
    exact_operation_index = {
        row["operationId"]: index for index, row in enumerate(operation_rows)
    }
    exact_event_index = {
        row["eventName"]: index for index, row in enumerate(event_rows)
    }
    for contract_id, row in owner_map.items():
        kind = row["contract_kind"]
        if kind == "MODERN_OPERATION":
            expected_semantic_ref = (
                f"{SEMANTIC.name}#/operationSemanticBindings/"
                f"{semantic_operation_index[contract_id]}"
            )
            expected_register_ref = (
                f"{EXACT.name}#/operationBindings/{exact_operation_index[contract_id]}"
            )
        elif kind == "MODERN_EVENT":
            expected_semantic_ref = (
                f"{SEMANTIC.name}#/eventSemanticBindings/"
                f"{semantic_event_index[contract_id]}"
            )
            expected_register_ref = (
                f"{EVENTS.name}#/eventPayloadSchemas/{exact_event_index[contract_id]}"
            )
        else:
            escaped = json_pointer_escape(contract_id)
            expected_semantic_ref = (
                f"{MANIFEST.name}#/ownershipSourceIndex/{escaped}/semantic"
            )
            expected_register_ref = (
                f"{MANIFEST.name}#/ownershipSourceIndex/{escaped}/sourceRegister"
            )
        require(row.get("source_semantic_ref") == expected_semantic_ref,
                f"ownership semantic reference drift: {contract_id}")
        require(row.get("source_register_ref") == expected_register_ref,
                f"ownership register reference drift: {contract_id}")
        semantic_target = resolve_local_ref(expected_semantic_ref, documents)
        register_target = resolve_local_ref(expected_register_ref, documents)
        require(isinstance(semantic_target, dict),
                f"ownership semantic reference is not an object: {contract_id}")
        require(isinstance(register_target, dict),
                f"ownership register reference is not an object: {contract_id}")
        if kind == "MODERN_OPERATION":
            require(semantic_target.get("operationId") == contract_id,
                    f"ownership semantic operation pointer mismatch: {contract_id}")
            require(register_target.get("operationId") == contract_id,
                    f"ownership operation register pointer mismatch: {contract_id}")
        elif kind == "MODERN_EVENT":
            require(semantic_target.get("eventName") == contract_id,
                    f"ownership semantic event pointer mismatch: {contract_id}")
            require(register_target.get("eventName") == contract_id,
                    f"ownership event register pointer mismatch: {contract_id}")
        else:
            require(semantic_target.get("contractId") == contract_id,
                    f"ownership indexed semantic mismatch: {contract_id}")
            path = FRONTEND_ROOT / register_target.get("path", "")
            require(path.is_file(), f"ownership indexed source missing: {contract_id}")
            require(register_target.get("bytes") == path.stat().st_size,
                    f"ownership indexed source bytes drift: {contract_id}")
            require(register_target.get("sha256") == sha256_bytes(path.read_bytes()),
                    f"ownership indexed source hash drift: {contract_id}")
            _header, indexed_rows = read_csv(path)
            data_row = register_target.get("dataRow")
            require(isinstance(data_row, int) and 1 <= data_row <= len(indexed_rows),
                    f"ownership indexed data row invalid: {contract_id}")
            source_row = indexed_rows[data_row - 1]
            selector_field = register_target.get("selectorField")
            require(selector_field in source_row,
                    f"ownership selector field unavailable: {contract_id}")
            selector_values = (
                split_refs(source_row[selector_field])
                if register_target.get("selectorMode") == "PIPE_MEMBERSHIP"
                else [source_row[selector_field]]
            )
            require(register_target.get("selectorValue") == contract_id in selector_values,
                    f"ownership indexed source selector mismatch: {contract_id}")

    proposal_events = {
        "people.assignment-proposal.created.v1",
        "people.assignment-proposal.validated.v1",
        "people.assignment-proposal.submitted.v1",
        "people.assignment-proposal.cancelled.v1",
    }
    require(not proposal_events & set(event_map), "proposal-local outbox event promoted")
    require(not proposal_events & set(owner_map), "proposal-local outbox ownership promoted")
    require("PersonChanged.v1" not in event_map and "AssignmentChanged.v1" not in event_map,
            "forbidden modern alias claimed")
    require(not set(REMOVED_OPERATION_IDS) & set(operation_map), "superseded operation retained")
    require(not set(REMOVED_PUBLIC_EVENT_IDS) & set(event_map), "superseded event retained")

    carry = {
        "PEP-HRM-001": ("HRIS-HRM", "BASE-TFR-HRM-004"),
        "PEP-HRM-002": ("HRIS-HRM", "BASE-TFR-HRM-004"),
        "PEP-HRM-006": ("HRIS-HRM", "BASE-TFR-HRM-008"),
        "PEP-HRM-007": ("HRIS-HRM", "BASE-TFR-HRM-008"),
        "PEP-HRM-008": ("HRIS-HRM", "BASE-TFR-HRM-008"),
        "PEP-HRM-009": ("HRIS-HRM", "BASE-TFR-HRM-008"),
        **{key: ("HRIS-PER", "BASE-TFR-PER-005") for key in (
            "PEP-PER-002", "PEP-PER-003", "PEP-PER-004", "PEP-PER-005",
            "PEP-PER-006", "PEP-PER-007", "EVT-PER:PerformanceCyclePublished.v1",
        )},
        "PEP-PER-008": ("HRIS-PER", "BASE-TFR-PER-006"),
        "PEP-PER-021": ("HRIS-PER", "BASE-TFR-PER-011"),
    }
    for contract_id, expected_owner in carry.items():
        row = owner_map[contract_id]
        require((row["owner_session"], row["primary_slice_id"]) == expected_owner,
                f"G2 carry-forward owner drift: {contract_id}")

    require(manifest.get("status") == "SEALED_G3_CANONICAL_SUCCESSOR_NOT_IMPLEMENTED", "manifest status drift")
    require(manifest.get("sourcePins") == expected["sourcePins"], "manifest source pins drift")
    require(manifest.get("toolPins") == [file_pin(GENERATOR), file_pin(Path(__file__))], "manifest tool pins drift")
    require(manifest.get("targetProfile") == {
        "canonicalJsonCount": 4,
        "modernOperations": 199,
        "modernCommands": 133,
        "modernQueries": 66,
        "modernEvents": 157,
        "officialNewOperations": 101,
        "officialNewRequestFields": sum(
            len(row["requestFields"])
            for row in expected["officialNewOperations"].values()
        ),
        "recordSchemas": len(expected_record_schemas),
        "responseSchemas": len(expected_response_schemas),
        "primaryOwnershipCategories": EXPECTED_PROFILE,
        "primaryOwnershipRows": 695,
    }, "manifest target profile drift")

    historical = expected["g2"]["supersedesHistorical"]
    require(manifest.get("historicalNonIdentity") == {
        "historicalOwnershipPath": historical["path"],
        "historicalOwnershipSha256": historical["historicalExpectedSha256"],
        "historicalOwnershipBytes": historical["historicalExpectedBytes"],
        "historicalOwnershipRows": historical["historicalExpectedRows"],
        "historicalBytesRecovered": False,
        "historicalBytesReused": False,
        "historicalByteIdentityClaim": False,
        "successorRelationship": "FORWARD_ONLY_REVIEWED_SUCCESSOR_NOT_ROW_RECONSTRUCTION",
    }, "historical nonidentity receipt drift")
    require(manifest.get("authorizationBoundary") == {
        "moduleCodeGoGranted": False,
        "productionAuthorizationGranted": False,
        "implementationState": "NOT_STARTED_G3",
        "productionState": "NOT_AUTHORIZED_G6",
    }, "authorization boundary drift")
    require("publicationReceipt" not in manifest,
            "manifest self-asserts a publication execution receipt")
    require("verification" not in manifest,
            "manifest retained ambiguous verification execution claims")
    plan = manifest.get("verificationPlan", {})
    require(plan.get("status") == "NOT_RECORDED",
            "verification plan must remain non-executed")
    require(plan.get("fullSuitePlanned") is False and plan.get("w1Planned") is False,
            "verification plan expanded to forbidden broad suites")
    require(plan.get("historicalByteIdentityClaim") is False,
            "verification plan claims historical byte identity")
    require(plan.get("moduleCodeGoGranted") is False,
            "verification plan grants module code-go")
    require(plan.get("productionAuthorizationGranted") is False,
            "verification plan grants production authorization")
    plan_commands = {row.get("id"): row for row in plan.get("commands", [])}
    require(set(plan_commands) == {
        "GENERATOR_WRITE", "GENERATOR_CHECK", "GENERATOR_SELF_TEST",
        "VALIDATOR_CHECK", "VALIDATOR_SELF_TEST",
    }, "verification plan command closure drift")
    require(all(row.get("result") == "NOT_RECORDED" for row in plan_commands.values()),
            "verification plan contains an execution result assertion")
    require(all(row.get("expectedExitCode") == 0 for row in plan_commands.values()),
            "verification plan expected exit code drift")
    require(all(isinstance(row.get("command"), str) and row["command"]
                for row in plan_commands.values()),
            "verification plan command missing")

    if verify_artifact_bytes:
        artifact_map = {row.get("path"): row for row in manifest.get("artifacts", [])}
        require(len(artifact_map) == 5, "manifest artifact receipt count drift")
        for path in DATA_OUTPUTS:
            rel = repo_path(path)
            row = artifact_map.get(rel)
            require(row is not None, f"manifest artifact receipt missing: {rel}")
            raw = bundle["raw"][path.name]
            require(row.get("bytes") == len(raw), f"artifact byte count drift: {path.name}")
            require(row.get("sha256") == sha256_bytes(raw), f"artifact hash drift: {path.name}")
            if path == OWNERSHIP:
                require(row.get("dataRows") == 695 and row.get("header") == OWNERSHIP_FIELDS,
                        "ownership artifact receipt drift")
            else:
                doc = bundle[{EXACT: "exact", EVENTS: "events", SEMANTIC: "semantic", IDENTITY: "identity"}[path]]
                require(row.get("sealedPayloadSha256") == doc.get("sealedPayloadSha256"),
                        f"sealed artifact receipt drift: {path.name}")

    return {
        "canonicalSetId": expected["authority"]["canonicalSetId"],
        "operations": len(operation_map),
        "commands": sum(row["mode"] == "COMMAND" for row in operation_rows),
        "queries": sum(row["mode"] == "QUERY" for row in operation_rows),
        "events": len(event_map),
        "officialNewOperations": len(expected["officialNewOperations"]),
        "officialNewRequestFields": sum(
            len(row["requestFields"])
            for row in expected["officialNewOperations"].values()
        ),
        "recordSchemas": len(exact.get("recordSchemas", [])),
        "responseSchemas": len(exact.get("responseSchemas", [])),
        "ownershipRows": len(owner_map),
        "ownershipCategories": dict(Counter(row["contract_kind"] for row in ownership)),
        "historicalByteIdentityClaim": False,
        "moduleCodeGoGranted": False,
        "productionAuthorizationGranted": False,
        "hashes": {path.name: sha256_bytes(bundle["raw"][path.name]) for path in (*DATA_OUTPUTS, MANIFEST)},
    }


def run_self_test() -> dict[str, Any]:
    baseline = load_bundle()
    summary = validate_bundle(baseline)
    cases: list[tuple[str, Any]] = []

    def add(name: str, mutate: Any) -> None:
        candidate = copy.deepcopy(baseline)
        mutate(candidate)
        cases.append((name, candidate))

    add("ownership-row-omission", lambda b: b["ownership"].pop())
    add("ownership-duplicate", lambda b: b["ownership"].append(copy.deepcopy(b["ownership"][0])))

    def rehome(b: dict[str, Any]) -> None:
        next(row for row in b["ownership"] if row["contract_id"] == "PEP-HRM-001")["owner_session"] = "HRIS-PER"
    add("carry-forward-owner-rehome", rehome)

    def promote_proposal(b: dict[str, Any]) -> None:
        row = copy.deepcopy(b["ownership"][0])
        row["contract_id"] = "people.assignment-proposal.created.v1"
        row["contract_kind"] = "MODERN_EVENT"
        b["ownership"].append(row)
    add("proposal-outbox-promotion", promote_proposal)

    def alias_event(b: dict[str, Any]) -> None:
        b["events"]["eventPayloadSchemas"][0]["eventName"] = "PersonChanged.v1"
        reseal(b["events"])
    add("forbidden-event-alias", alias_event)

    def omit_operation(b: dict[str, Any]) -> None:
        b["exact"]["operationBindings"].pop()
        reseal(b["exact"])
    add("exact-operation-omission", omit_operation)

    def rehome_event(b: dict[str, Any]) -> None:
        row = b["events"]["eventPayloadSchemas"][0]
        row["ownerSession"] = "HRIS-SYS" if row["ownerSession"] != "HRIS-SYS" else "HRIS-PER"
        reseal(b["events"])
    add("event-owner-rehome", rehome_event)

    def omit_semantic(b: dict[str, Any]) -> None:
        b["semantic"]["operationSemanticBindings"].pop()
        reseal(b["semantic"])
    add("semantic-operation-omission", omit_semantic)

    def omit_identity(b: dict[str, Any]) -> None:
        b["identity"]["eventPublicIdentities"].pop()
        reseal(b["identity"])
    add("identity-event-omission", omit_identity)

    def grant_g6(b: dict[str, Any]) -> None:
        b["exact"]["authority"]["productionAuthorizationGranted"] = True
        reseal(b["exact"])
    add("g6-authorization-grant", grant_g6)

    def drift_pin(b: dict[str, Any]) -> None:
        b["manifest"]["sourcePins"][0]["sha256"] = "0" * 64
        reseal(b["manifest"])
    add("source-pin-drift", drift_pin)

    add("sealed-payload-corruption", lambda b: b["manifest"].__setitem__("sealedPayloadSha256", "0" * 64))

    def erase_business_body(b: dict[str, Any]) -> None:
        next(row for row in b["exact"]["operationBindings"]
             if row["operationId"] == "modern.listening.survey.revise")["requestSchema"]["body"] = []
        reseal(b["exact"])
    add("reviewed-business-body-erasure", erase_business_body)

    def break_response_ref(b: dict[str, Any]) -> None:
        b["exact"]["operationBindings"][0]["responseSchemaRef"] = "Missing.Response.v999"
        reseal(b["exact"])
    add("unresolved-response-schema-ref", break_response_ref)

    def generic_event_payload(b: dict[str, Any]) -> None:
        row = b["events"]["eventPayloadSchemas"][0]
        row["fields"] = [
            {"name": name, "type": field_type, "required": True}
            for name, field_type in (
                ("aggregateId", "UUID"), ("aggregateVersion", "BIGINT"),
                ("occurredAt", "TIMESTAMPTZ"), ("correlationId", "UUID"),
                ("payloadDigest", "SHA256"),
            )
        ]
        reseal(b["events"])
    add("generic-event-payload-collapse", generic_event_payload)

    def wrong_per_route(b: dict[str, Any]) -> None:
        next(row for row in b["exact"]["operationBindings"]
             if row["operationId"] == "modern.skills.evidence.revoke")["path"] = (
                 "/api/performance/v1/hris/skills/evidence/{evidenceId}/revoke"
             )
        reseal(b["exact"])
    add("wrong-per-route-prefix", wrong_per_route)

    def listening_self_auth(b: dict[str, Any]) -> None:
        next(row for row in b["exact"]["operationBindings"]
             if row["operationId"] == "modern.listening.surveys.query")[
                 "authorizationCapability"
             ] = "hcm.listening.respond"
        reseal(b["exact"])
    add("listening-admin-self-authorization", listening_self_auth)

    def listening_self_scope(b: dict[str, Any]) -> None:
        next(row for row in b["exact"]["operationBindings"]
             if row["operationId"] == "modern.listening.survey.revise")["scope"] = ["SELF"]
        reseal(b["exact"])
    add("listening-admin-self-scope", listening_self_scope)

    def benefits_self_auth(b: dict[str, Any]) -> None:
        next(row for row in b["exact"]["operationBindings"]
             if row["operationId"] == "modern.benefits.plan.query")[
                 "authorizationCapability"
             ] = "hcm.benefits.self.view"
        reseal(b["exact"])
    add("benefits-plan-self-authorization", benefits_self_auth)

    def benefits_self_scope(b: dict[str, Any]) -> None:
        next(row for row in b["exact"]["operationBindings"]
             if row["operationId"] == "modern.benefits.plans.query")["scope"] = ["SELF"]
        reseal(b["exact"])
    add("benefits-plan-self-scope", benefits_self_scope)

    def break_semantic_pointer(b: dict[str, Any]) -> None:
        next(row for row in b["ownership"]
             if row["contract_kind"] == "MODERN_OPERATION")["source_semantic_ref"] += "/missing"
    add("ownership-semantic-pointer-unresolved", break_semantic_pointer)

    def break_register_pointer(b: dict[str, Any]) -> None:
        next(row for row in b["ownership"]
             if row["contract_kind"] == "BASE_EVENT")["source_register_ref"] += "/missing"
    add("ownership-register-pointer-unresolved", break_register_pointer)

    def self_assert_publication_pass(b: dict[str, Any]) -> None:
        b["manifest"]["publicationReceipt"] = {"result": "PASS"}
        reseal(b["manifest"])
    add("self-asserted-publication-pass", self_assert_publication_pass)

    def drop_response_schemas(b: dict[str, Any]) -> None:
        b["exact"]["responseSchemas"] = []
        reseal(b["exact"])
    add("predecessor-response-schema-loss", drop_response_schemas)

    def drop_predecessor_events(b: dict[str, Any]) -> None:
        b["events"]["predecessorEventPayloadSchemas"] = []
        reseal(b["events"])
    add("predecessor-event-schema-loss", drop_predecessor_events)

    def erase_ai_proof(b: dict[str, Any]) -> None:
        row = next(row for row in b["exact"]["operationBindings"]
                   if row["operationId"] == "modern.ai.policy.revise")
        row["requestSchema"]["body"] = [
            field for field in row["requestSchema"]["body"]
            if field["name"] != "killSwitchControlVersionId"
        ]
        reseal(b["exact"])
    add("official-ai-governance-proof-erasure", erase_ai_proof)

    def erase_temporal_selector(b: dict[str, Any]) -> None:
        row = next(row for row in b["exact"]["operationBindings"]
                   if row["operationId"] == "modern.benefits.plan.query")
        row["requestSchema"]["queryParameters"] = [
            field for field in row["requestSchema"]["queryParameters"]
            if field["name"] != "systemAsOf"
        ]
        reseal(b["exact"])
    add("official-temporal-selector-erasure", erase_temporal_selector)

    def wrong_existing_query_response_ref(b: dict[str, Any]) -> None:
        row = next(row for row in b["exact"]["operationBindings"]
                   if row["operationId"] == "modern.benefits.plan.query")
        row["responseSchemaRef"] = "EligibleBenefitPlanPage.v1"
        reseal(b["exact"])
    add("wrong-existing-query-response-ref", wrong_existing_query_response_ref)

    def mutate_new_query_response_schema(b: dict[str, Any]) -> None:
        row = next(row for row in b["exact"]["responseSchemas"]
                   if row["schemaId"] == "modern.benefits.plan.query.Response.v3")
        row["fields"].pop()
        reseal(b["exact"])
    add("new-query-response-schema-content-drift", mutate_new_query_response_schema)

    def wrong_listening_receipt_owner(b: dict[str, Any]) -> None:
        response = next(row for row in b["exact"]["responseSchemas"]
                        if row["schemaId"] == "modern.listening.survey.revise.Response.v3")
        field = next(field for field in response["fields"]
                     if field["name"] == "commandReceiptId")
        field["referenceContract"]["entityType"] = "table:sys_hris_command_receipts"
        reseal(b["exact"])
    add("listening-configuration-receipt-owner-drift", wrong_listening_receipt_owner)

    rejected: list[str] = []
    for name, candidate in cases:
        try:
            validate_bundle(candidate, verify_artifact_bytes=False)
        except ValidationError:
            rejected.append(name)
        else:
            raise ValidationError(f"hostile self-test mutation was accepted: {name}")
    require(len(rejected) == 30, "hostile self-test cardinality drift")
    return {**summary, "hostileMutationsRejected": len(rejected), "cases": rejected}


def main() -> int:
    parser = argparse.ArgumentParser()
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--check", action="store_true")
    group.add_argument("--self-test", action="store_true")
    args = parser.parse_args()

    if args.self_test:
        result = run_self_test()
        schema = "dwp.hris.g3.canonical-ownership-validator-self-test.v1"
    else:
        result = validate_bundle(load_bundle())
        schema = "dwp.hris.g3.canonical-ownership-validator-check.v1"
    print(json.dumps({"schema": schema, "status": "PASS", **result},
                     ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
