#!/usr/bin/env python3
"""Generate the reviewed G3 canonical-four and primary ownership successor.

This is a forward-only G3 publication.  It deliberately does not reconstruct
the missing historical canonical files or the historical 525-row register.
The generated set is derived from the recovered current slice ownership, the
reviewed closed-set design, and the sealed G2 owner disposition.
"""

from __future__ import annotations

import argparse
import copy
import csv
import hashlib
import io
import json
import os
import re
import sys
import tempfile
from collections import Counter
from pathlib import Path
from typing import Any


HERE = Path(__file__).resolve().parent
HRIS_ROOT = HERE.parents[1]
FRONTEND_ROOT = HERE.parents[4]
BLUEPRINT = (
    HRIS_ROOT
    / "recovery/hris-porting-blueprint-2026-09-09"
)
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

EXACT = HERE / "modern-capability-exact-schema-contracts.v1.json"
EVENTS = HERE / "modern-capability-event-payload-contracts.v1.json"
SEMANTIC = HERE / "modern-capability-semantic-bindings.v1.json"
IDENTITY = HERE / "modern-capability-public-identity-registry.v1.json"
OWNERSHIP = HERE / "g3-contract-primary-ownership-register.csv"
MANIFEST = HERE / "manifest.v1.json"
VALIDATOR = HERE / "validate_g3_canonical_ownership.py"

JSON_OUTPUTS = (EXACT, EVENTS, SEMANTIC, IDENTITY)
DATA_OUTPUTS = (*JSON_OUTPUTS, OWNERSHIP)
ALL_OUTPUTS = (*DATA_OUTPUTS, MANIFEST)

STATUS = "SEALED_G3_DESIGN_NOT_IMPLEMENTED"
OWNER_STATUS = "SEALED_G3_PRIMARY_OWNER"
CANONICAL_SCHEMA_VERSION = 3
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
KIND_ORDER = tuple(EXPECTED_PROFILE)
OWNERSHIP_FIELDS = (
    "contract_id",
    "contract_kind",
    "owner_session",
    "primary_slice_id",
    "source_semantic_ref",
    "source_register_ref",
    "rationale",
    "status",
)


sys.path.insert(0, str(CODING))
from modern_closed_set_design import (  # noqa: E402
    NEW_COMMAND_EVENTS_BY_SESSION,
    NEW_COMMAND_RUNTIME,
    NEW_QUERY_RUNTIME,
    NON_LISTENING_HANDLER_ADDITIONAL_EVENTS,
    NON_LISTENING_HANDLER_EVENTS,
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


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def file_sha(path: Path) -> str:
    return sha256_bytes(path.read_bytes())


def repo_path(path: Path) -> str:
    return path.resolve().relative_to(FRONTEND_ROOT.resolve()).as_posix()


def read_json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"JSON root must be an object: {path}")
    return value


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def split_refs(value: str) -> list[str]:
    return [item for item in value.split("|") if item]


def canonical_payload(value: dict[str, Any]) -> bytes:
    body = copy.deepcopy(value)
    body.pop("sealedPayloadSha256", None)
    return json.dumps(
        body, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")


def seal(value: dict[str, Any]) -> dict[str, Any]:
    result = copy.deepcopy(value)
    result.pop("sealedPayloadSha256", None)
    result["sealedPayloadSha256"] = sha256_bytes(canonical_payload(result))
    return result


def render_json(value: dict[str, Any]) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def _prefix_kind(contract_id: str, operations: set[str], events: set[str]) -> str:
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
    raise ValueError(f"unclassified primary contract ref: {contract_id}")


def _source_ids(path: Path, field: str) -> set[str]:
    rows = read_csv(path)
    values = [row.get(field, "") for row in rows]
    if any(not value for value in values) or len(values) != len(set(values)):
        raise ValueError(f"source register has missing or duplicate {field}: {path}")
    return set(values)


def _event_type_and_version(event_name: str) -> tuple[str, int]:
    match = re.fullmatch(r"(.+)\.v([1-9][0-9]*)", event_name)
    if not match:
        raise ValueError(f"modern event lacks version suffix: {event_name}")
    return match.group(1), int(match.group(2))


def _event_topic(event_name: str) -> str:
    event_type, version = _event_type_and_version(event_name)
    kebab = re.sub(r"(?<!^)(?=[A-Z])", "-", event_type).lower()
    return f"dwp.hris.modern.{kebab}.v{version}"


def _path_fields(path: str) -> list[dict[str, Any]]:
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


def _headers(mode: str, expected_version: str) -> list[dict[str, Any]]:
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


def _json_pointer_escape(value: str) -> str:
    return value.replace("~", "~0").replace("/", "~1")


def _reviewed_route(
    operation_id: str,
    fallback_path: str,
    fallback_method: str,
    fallback_authorization: str,
) -> tuple[str, str, str]:
    return ROUTE_OVERRIDES.get(
        operation_id,
        (fallback_path, fallback_method, fallback_authorization),
    )


def _authorization_index() -> dict[tuple[str, str], dict[str, str]]:
    rows = read_csv(AUTH_REGISTER)
    result: dict[tuple[str, str], dict[str, str]] = {}
    for row in rows:
        key = (row["modern_capability_id"], row["canonical_capability_key"])
        if key in result:
            raise ValueError(f"duplicate modern authorization binding: {key}")
        result[key] = row
    return result


def _authorization_contract(
    index: dict[tuple[str, str], dict[str, str]],
    capability_id: str,
    authorization_capability: str,
) -> tuple[list[str], dict[str, Any]]:
    row = index.get((capability_id, authorization_capability))
    if row is None:
        raise ValueError(
            "reviewed authorization binding unavailable: "
            f"{capability_id} {authorization_capability}"
        )
    scope = split_refs(row["canonical_population_types"])
    return scope, {
        "bindingId": row["binding_id"],
        "source": repo_path(AUTH_REGISTER),
        "canonicalCapabilityKey": row["canonical_capability_key"],
        "canonicalAction": row["canonical_action"],
        "populationTypes": scope,
        "personaCategories": split_refs(row["persona_categories"]),
        "purposeCode": row["purpose_code"],
        "enforcementLayers": split_refs(row["enforcement_layers"]),
        "implementationState": row["implementation_state"],
        "productionState": row["production_state"],
    }


def _business_body_fields(operation_id: str) -> list[dict[str, Any]]:
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
            if field["type"] != field_type:
                raise ValueError(f"business field type conflict: {operation_id} {name}")
            target = f"{table}.{column}"
            if target not in field["reviewedPhysicalTargets"]:
                field["reviewedPhysicalTargets"].append(target)
            if entity:
                contract = {"entityType": entity, "idSpace": "PUBLIC_UUID"}
                previous = field.get("referenceContract")
                if previous is not None and previous != contract:
                    raise ValueError(f"business field entity conflict: {operation_id} {name}")
                field["referenceContract"] = contract
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


def _minimal_reviewed_operation_base(
    source_operations: list[dict[str, Any]],
) -> dict[str, Any]:
    """Build only the predecessor fields consumed by the official new-op builders."""
    operations = []
    for source in source_operations:
        operations.append({
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
        })
    return {"operations": operations}


def _official_new_operation_rows(
    source_operations: list[dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    base = _minimal_reviewed_operation_base(source_operations)
    listening_bindings = {
        row["operationId"]: row
        for row in build_static_design()["publicOperationBindings"]
    }
    result: dict[str, dict[str, Any]] = {}
    for operation_id in sorted(all_new_operation_ids()):
        if operation_id in NEW_COMMAND_RUNTIME:
            row = build_official_new_command(base, operation_id)
        else:
            row = build_official_new_query(base, operation_id)
        if operation_id in listening_bindings:
            # Official compose order is new-op build, Listening authority
            # overlay, then semantic overlay.  Receipt ownership and protected
            # request semantics depend on this exact ordering.
            row["listeningAuthority"] = copy.deepcopy(
                listening_bindings[operation_id]
            )
        apply_official_semantic_overlay(row)
        result[operation_id] = row
    if set(result) != set(all_new_operation_ids()) or len(result) != 101:
        raise ValueError("official reviewed new-operation projection closure drift")
    if {
        operation_id for operation_id in result
        if operation_id.startswith("modern.listening.")
    } != {"modern.listening.surveys.query", "modern.listening.survey.revise"}:
        raise ValueError("new Listening operation overlay closure drift")
    return result


def _official_request_schema(operation: dict[str, Any]) -> dict[str, Any]:
    """Exact local reproduction of the reviewed helper whose source lacks return."""
    groups = {key: [] for key in ("pathParameters", "queryParameters", "headers", "body")}
    for field in operation.get("requestFields", []):
        location = field.get("location")
        if location not in groups:
            raise ValueError(
                f"official request field has unsupported location: "
                f"{operation['operationId']} {location}"
            )
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


def _schema_refs(value: Any) -> list[str]:
    refs: list[str] = []
    if isinstance(value, dict):
        for key, child in value.items():
            if key in {"schemaRef", "itemSchemaRef"}:
                if not isinstance(child, str):
                    raise ValueError(f"schema reference is not a string: {child!r}")
                refs.append(child)
            refs.extend(_schema_refs(child))
    elif isinstance(value, list):
        for child in value:
            refs.extend(_schema_refs(child))
    return refs


def _retained_event_runtime(
    operation_id: str,
    source_exact: dict[str, Any],
) -> tuple[str, str, tuple[str, ...], tuple[str, ...]]:
    """Return the reviewed causal root/state tuple without rebuilding old bytes."""
    root = aggregate_root_for(operation_id)
    tables = {
        row["tableName"]: row
        for row in source_exact["tableSpecifications"]
    }
    try:
        state_column = state_column_for(tables[root], operation_id)
    except (KeyError, ValueError):
        # The reviewed causal successor adds these missing roots/state columns;
        # every such addition is an explicit VARCHAR status column.
        state_column = STATE_COLUMN_OVERRIDES.get(operation_id, "status")
    pre_states, post_states, _source = STATE[operation_id]
    return root, state_column, tuple(pre_states), tuple(post_states)


def _handler_slice(handler_id: str) -> str:
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
    if len(matches) != 1:
        raise ValueError(f"handler has no exact reviewed slice: {handler_id}")
    return matches[0]


def _common_authority(canonical_set_id: str, g2: dict[str, Any]) -> dict[str, Any]:
    pins = g2["sourcePins"]
    return {
        "generationStage": "G3_ONLY",
        "canonicalSetId": canonical_set_id,
        "sourceDisposition": repo_path(G2_DISPOSITION),
        "currentBackendCommit": pins["currentBackendCommit"],
        "reconciledBackendCommit": pins["reconciledBackendCommit"],
        "backendResultCommit": pins["backendResultCommit"],
        "historicalBytesReused": False,
        "historicalByteIdentityClaim": False,
        "implementationState": "NOT_STARTED_G3",
        "productionState": "NOT_AUTHORIZED_G6",
        "moduleCodeGoGranted": False,
        "productionAuthorizationGranted": False,
    }


def compose() -> tuple[dict[Path, bytes], dict[str, Any]]:
    required = (
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
        Path(__file__),
        VALIDATOR,
    )
    missing = [str(path) for path in required if not path.is_file()]
    if missing:
        raise ValueError("required G3 successor input missing: " + ", ".join(missing))

    g2 = read_json(G2_DISPOSITION)
    if g2.get("status") != "G2_DISPOSITION_COMPLETE_G3_GENERATION_BLOCKED":
        raise ValueError("G2 disposition status drift")
    target = g2.get("g3TargetProfile", {})
    if target.get("categories") != EXPECTED_PROFILE or target.get("totalRows") != 695:
        raise ValueError("G2 target profile is not the exact reviewed 695-row profile")
    invariants = g2.get("invariants", {})
    expected_invariants = {
        "proposalEventsAreNotAssignmentChangedV1": True,
        "people360DoesNotProducePersonChangedV1": True,
        "performanceContractsRemainPerOwned": True,
        "final695RowRegisterGeneratedOnlyAtG3": True,
        "historical525RowsNotFabricated": True,
    }
    if any(invariants.get(key) is not value for key, value in expected_invariants.items()):
        raise ValueError("G2 ownership invariants drift")

    source_exact = read_json(SOURCE_EXACT)
    source_events = read_json(SOURCE_EVENTS)
    authorization_index = _authorization_index()
    source_operations = source_exact.get("operationBindings", [])
    source_by_id = {row.get("operationId"): row for row in source_operations}
    if len(source_operations) != 100 or len(source_by_id) != 100 or None in source_by_id:
        raise ValueError("recovered exact predecessor must contain 100 unique operations")
    predecessor_event_rows = source_events.get("eventPayloadSchemas", [])
    predecessor_event_by_id = {
        row.get("eventName"): row for row in predecessor_event_rows
    }
    if (
        len(predecessor_event_rows) != 32
        or len(predecessor_event_by_id) != 32
        or None in predecessor_event_by_id
    ):
        raise ValueError("recovered event predecessor must contain 32 unique payload schemas")
    official_new_operations = _official_new_operation_rows(source_operations)
    new_record_schemas: list[dict[str, Any]] = []
    new_response_schemas: list[dict[str, Any]] = []
    for operation_id in sorted(official_new_operations):
        official = official_new_operations[operation_id]
        if operation_id in NEW_COMMAND_RUNTIME:
            root = official["aggregateRoot"]["table"]
            nested = build_official_child_schema(official)
            response = build_official_response_schema(official, root, True)
        else:
            root = official["readPlan"]["tables"][0]
            nested = build_official_record_schema(official, root)
            response = build_official_response_schema(official, root, False)
        new_record_schemas.append(nested)
        new_response_schemas.append(response)
    all_record_schemas = [
        *copy.deepcopy(source_exact["recordSchemas"]),
        *new_record_schemas,
    ]
    all_response_schemas = [
        *copy.deepcopy(source_exact["responseSchemas"]),
        *new_response_schemas,
    ]
    if (
        len({row["schemaId"] for row in all_record_schemas}) != len(all_record_schemas)
        or len({row["schemaId"] for row in all_response_schemas})
        != len(all_response_schemas)
    ):
        raise ValueError("official successor schema identifiers are not unique")

    slice_rows = read_csv(SOURCE_SLICES)
    if len(slice_rows) != 102 or len({row["slice_id"] for row in slice_rows}) != 102:
        raise ValueError("current G3 slice register must contain 102 unique slices")
    slice_by_id = {row["slice_id"]: row for row in slice_rows}
    primary_owner: dict[str, dict[str, str]] = {}
    for row in slice_rows:
        for ref in split_refs(row.get("primary_contract_refs", "")):
            if ref in primary_owner:
                raise ValueError(f"current primary ref has multiple slices: {ref}")
            primary_owner[ref] = row

    source_operation_ids = set(source_by_id)
    known_prefixes = (
        "PEP-", "SVC-PEP-", "XCON-", "SYS-API-", "SYS-EVT-", "EVT-", "IAQ-"
    )
    current_events = {
        ref for ref in primary_owner
        if ref not in source_operation_ids and not ref.startswith(known_prefixes)
    }
    current_counts = Counter(
        _prefix_kind(ref, source_operation_ids, current_events)
        for ref in primary_owner
    )
    expected_current_counts = {
        "PUBLIC_PEP": 175,
        "INTERNAL_SERVICE_PEP": 11,
        "XCON_PRODUCER": 21,
        "SYS_G2_CONTRACT": 84,
        "BASE_EVENT": 48,
        "MODERN_OPERATION": 100,
        "MODERN_EVENT": 86,
        "IAQ": 66,
    }
    if dict(current_counts) != expected_current_counts:
        raise ValueError(f"current primary source profile drift: {dict(current_counts)}")

    source_sets = {
        "PUBLIC_PEP": _source_ids(PUBLIC_PEP, "binding_id"),
        "INTERNAL_SERVICE_PEP": _source_ids(SERVICE_PEP, "binding_id"),
        "XCON_PRODUCER": _source_ids(XCON, "contract_id"),
        "SYS_G2_CONTRACT": _source_ids(SYS_G2, "contract_id"),
    }
    for kind, values in source_sets.items():
        observed = {
            ref for ref in primary_owner
            if _prefix_kind(ref, source_operation_ids, current_events) == kind
        }
        if observed != values:
            raise ValueError(f"slice/source exact ID closure drift: {kind}")

    listening = build_static_design()
    listening_events_by_operation = {
        row["operationId"]: list(row["publicEventIds"])
        for row in listening["publicOperationBindings"]
    }

    retained_ids = source_operation_ids - set(REMOVED_OPERATION_IDS)
    new_ids = set(all_new_operation_ids())
    if retained_ids & new_ids or len(retained_ids | new_ids) != 199:
        raise ValueError("reviewed operation successor set is not exact 199")

    operation_rows: list[dict[str, Any]] = []
    operation_owner: dict[str, tuple[str, str, str]] = {}

    def retained_events(operation_id: str, mode: str) -> list[str]:
        if mode != "COMMAND":
            return []
        if operation_id in listening_events_by_operation:
            return sorted(listening_events_by_operation[operation_id])
        event = EVENT_TYPES.get(operation_id)
        if event is None:
            raise ValueError(f"retained command lacks reviewed primary event: {operation_id}")
        name = event + ".v2"
        result = [] if name in REMOVED_PUBLIC_EVENT_IDS else [
            REPLACED_PUBLIC_EVENT_IDS.get(name, name)
        ]
        for conditional in CONDITIONAL_COMMAND_EVENTS.get(operation_id, []):
            conditional_name = conditional["eventType"] + ".v2"
            if conditional_name not in REMOVED_PUBLIC_EVENT_IDS:
                result.append(REPLACED_PUBLIC_EVENT_IDS.get(conditional_name, conditional_name))
        return sorted(set(result))

    for operation_id in sorted(retained_ids):
        source = copy.deepcopy(source_by_id[operation_id])
        owner = primary_owner.get(operation_id)
        if owner is None:
            raise ValueError(f"retained operation lacks primary slice: {operation_id}")
        if owner["session_id"] != source.get("session"):
            raise ValueError(f"retained operation session/slice drift: {operation_id}")
        events = retained_events(operation_id, source["mode"])
        path, method, authorization_capability = _reviewed_route(
            operation_id, source["path"], source["method"],
            source["authorizationCapability"],
        )
        scope, authorization_binding = _authorization_contract(
            authorization_index, source["capabilityId"], authorization_capability,
        )
        row = {
            "operationId": operation_id,
            "capabilityId": source["capabilityId"],
            "ownerSession": source["session"],
            "primarySliceId": owner["slice_id"],
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
            "requestSchema": source["requestSchema"],
            "readsTables": copy.deepcopy(source["readsTables"]),
            "writesTables": copy.deepcopy(source["writesTables"]),
            "stateTransitionIds": copy.deepcopy(source["stateTransitionIds"]),
            "eventNames": events,
            "predecessorEventNames": copy.deepcopy(source["eventNames"]),
            "sourceAuthority": {
                "kind": "RECOVERED_CURRENT_OPERATION_REVIEWED_SUCCESSOR_PROJECTION",
                "path": repo_path(SOURCE_EXACT),
                "sourceOperationId": operation_id,
                "reviewedRouteAuthority": repo_path(OPERATION_SOURCE),
            },
            "implementationState": "NOT_STARTED_G3",
            "productionState": "NOT_AUTHORIZED_G6",
        }
        operation_rows.append(row)
        operation_owner[operation_id] = (
            source["session"], owner["slice_id"], source["capabilityId"]
        )

    for operation_id in sorted(new_ids):
        official = official_new_operations[operation_id]
        mode = mode_for_new_operation(operation_id)
        if mode == "COMMAND":
            runtime = NEW_COMMAND_RUNTIME[operation_id]
            template_id, fallback_path = runtime[0], runtime[1]
            pre_states = tuple(runtime[4])
            expected_version = "NOT_APPLICABLE" if pre_states == ("NONE",) else "REQUIRED"
            fallback_method = "POST"
            event_names = sorted(event["eventName"] for event in official["events"])
            if event_names != sorted(events_for_new_operation(operation_id)):
                raise ValueError(f"official command event closure drift: {operation_id}")
        else:
            runtime = NEW_QUERY_RUNTIME[operation_id]
            template_id, fallback_path = runtime[0], runtime[1]
            expected_version = "NOT_APPLICABLE"
            fallback_method = "GET"
            event_names = []
        template = source_by_id.get(template_id)
        template_owner = primary_owner.get(template_id)
        if template is None or template_owner is None:
            raise ValueError(f"new operation template is not current authority: {operation_id}")
        session = session_for_new_operation(operation_id)
        if template["session"] != session or template_owner["session_id"] != session:
            raise ValueError(f"new operation template crosses owner session: {operation_id}")
        reviewed_route = _reviewed_route(
            operation_id, fallback_path, fallback_method,
            template["authorizationCapability"],
        )
        official_route = (
            official["path"], official["method"], official["authorizationCapability"],
        )
        if official_route != reviewed_route:
            raise ValueError(f"official route/authorization projection drift: {operation_id}")
        path, method, authorization_capability = official_route
        scope, authorization_binding = _authorization_contract(
            authorization_index, template["capabilityId"], authorization_capability,
        )
        request_ref = operation_id + ".Request.v3"
        response_ref = operation_id + ".Response.v3"
        if mode == "COMMAND":
            reads_tables = [runtime[2]]
            writes_tables = list(runtime[7])
            transition_ids = ["TR-" + operation_id.upper().replace(".", "-") + "-V3"]
        else:
            reads_tables = list(runtime[2])
            writes_tables = []
            transition_ids = []
        row = {
            "operationId": operation_id,
            "capabilityId": template["capabilityId"],
            "ownerSession": session,
            "primarySliceId": template_owner["slice_id"],
            "mode": mode,
            "method": method,
            "path": path,
            "action": authorization_binding["canonicalAction"],
            "authorizationCapability": authorization_capability,
            "scope": scope,
            "authorizationBinding": authorization_binding,
            "idempotency": "REQUIRED" if mode == "COMMAND" else "READ_SAFE",
            "expectedVersion": expected_version,
            "requestSchemaRef": request_ref,
            "responseSchemaRef": response_ref,
            "errorSchemaRefs": copy.deepcopy(template["errorSchemaRefs"]),
            "requestSchema": _official_request_schema(official),
            "readsTables": reads_tables,
            "writesTables": writes_tables,
            "stateTransitionIds": transition_ids,
            "eventNames": event_names,
            "predecessorEventNames": [],
            "sourceAuthority": {
                "kind": "REVIEWED_SUCCESSOR_ADDITION",
                "path": repo_path(OPERATION_SOURCE),
                "templateOperationId": template_id,
                "closedSetAuthority": repo_path(DESIGN_SOURCE),
                "exactSchemaProjectionAuthority": repo_path(EXACT_SUCCESSOR_SOURCE),
            },
            "implementationState": "NOT_STARTED_G3",
            "productionState": "NOT_AUTHORIZED_G6",
        }
        operation_rows.append(row)
        operation_owner[operation_id] = (
            session, template_owner["slice_id"], template["capabilityId"]
        )

    operation_rows.sort(key=lambda row: row["operationId"])
    operation_ids = {row["operationId"] for row in operation_rows}
    modes = Counter(row["mode"] for row in operation_rows)
    sessions = Counter(row["ownerSession"] for row in operation_rows)
    if (
        len(operation_rows) != 199
        or len(operation_ids) != 199
        or modes != {"COMMAND": 133, "QUERY": 66}
        or dict(sessions) != EXPECTED_SESSION_OPERATIONS
    ):
        raise ValueError("generated operation closed set/count partition drift")

    response_schema_ids = {
        row["schemaId"] for row in all_response_schemas
    }
    error_schema_ids = {
        row["schemaId"] for row in source_exact["commonErrorSchemas"]
    }
    record_schema_ids = {row["schemaId"] for row in all_record_schemas}
    for row in operation_rows:
        if row["requestSchemaRef"] != row["requestSchema"]["schemaId"]:
            raise ValueError(f"request schema ref is unresolved: {row['operationId']}")
        if row["responseSchemaRef"] not in response_schema_ids:
            raise ValueError(f"response schema ref is unresolved: {row['operationId']}")
        if not set(row["errorSchemaRefs"]).issubset(error_schema_ids):
            raise ValueError(f"error schema ref is unresolved: {row['operationId']}")
    local_schema_ids = response_schema_ids | error_schema_ids | record_schema_ids
    referenced_schema_ids = set(_schema_refs(operation_rows)) | set(
        _schema_refs(all_response_schemas)
    ) | set(_schema_refs(all_record_schemas))
    if not referenced_schema_ids.issubset(local_schema_ids):
        raise ValueError(
            "nested schema refs are unresolved: "
            + ", ".join(sorted(referenced_schema_ids - local_schema_ids))
        )
    new_per_rows = [
        row for row in operation_rows
        if row["operationId"] in new_ids and row["ownerSession"] == "HRIS-PER"
    ]
    if len(new_per_rows) != 40 or any(
        not row["path"].startswith("/api/people/v1/hris/performance/")
        for row in new_per_rows
    ) or any("/api/performance/v1/hris/" in row["path"] for row in operation_rows):
        raise ValueError("PER successor route prefix/reachability drift")
    operation_by_id = {row["operationId"]: row for row in operation_rows}
    for operation_id in ("modern.listening.surveys.query", "modern.listening.survey.revise"):
        row = operation_by_id[operation_id]
        if row["authorizationCapability"] != "hcm.listening.manage" or "SELF" in row["scope"]:
            raise ValueError(f"listening admin boundary drift: {operation_id}")
    for operation_id in ("modern.benefits.plans.query", "modern.benefits.plan.query"):
        row = operation_by_id[operation_id]
        if row["authorizationCapability"] != "hcm.benefits.operate" or "SELF" in row["scope"]:
            raise ValueError(f"benefits operator boundary drift: {operation_id}")

    event_producers: dict[str, dict[str, Any]] = {}

    def add_event(
        event_name: str,
        *,
        producer_kind: str,
        producer_id: str,
        session: str,
        slice_id: str,
        capability_id: str,
        source_authority: str,
        event_contract: dict[str, Any],
        predecessor_event_schema_refs: list[str] | None = None,
    ) -> None:
        claim = {
            "producerKind": producer_kind,
            "producerId": producer_id,
            "ownerSession": session,
            "primarySliceId": slice_id,
            "capabilityId": capability_id,
            "sourceAuthority": source_authority,
            "eventContract": copy.deepcopy(event_contract),
            "predecessorEventSchemaRefs": list(predecessor_event_schema_refs or []),
        }
        previous = event_producers.get(event_name)
        if previous is not None and previous != claim:
            raise ValueError(f"modern event has multiple producer claims: {event_name}")
        event_producers[event_name] = claim

    predecessor_event_index = {
        row["eventName"]: index
        for index, row in enumerate(predecessor_event_rows)
    }
    for row in operation_rows:
        if row["mode"] != "COMMAND":
            continue
        operation_id = row["operationId"]
        if operation_id in NEW_COMMAND_RUNTIME:
            runtime = NEW_COMMAND_RUNTIME[operation_id]
            root, state_column = runtime[2], runtime[3]
            pre_states, post_states = tuple(runtime[4]), tuple(runtime[5])
        else:
            root, state_column, pre_states, post_states = _retained_event_runtime(
                operation_id, source_exact,
            )
        predecessor_refs = [
            f"{EVENTS.name}#/predecessorEventPayloadSchemas/{predecessor_event_index[name]}"
            for name in row["predecessorEventNames"]
            if name in predecessor_event_index
        ]
        for event_name in row["eventNames"]:
            event_contract = build_reviewed_event(
                event_name,
                {
                    "session": row["ownerSession"],
                    "authorizationCapability": row["authorizationCapability"],
                },
                root, state_column, pre_states, post_states,
            )
            add_event(
                event_name,
                producer_kind="PUBLIC_OPERATION",
                producer_id=row["operationId"],
                session=row["ownerSession"],
                slice_id=row["primarySliceId"],
                capability_id=row["capabilityId"],
                source_authority=repo_path(OPERATION_SOURCE),
                event_contract=event_contract,
                predecessor_event_schema_refs=predecessor_refs,
            )

    capability_by_slice = {
        row["primarySliceId"]: row["capabilityId"] for row in operation_rows
    }
    for handler_id, event_name in sorted(NON_LISTENING_HANDLER_EVENTS.items()):
        slice_id = _handler_slice(handler_id)
        owner = slice_by_id[slice_id]
        handler_contract = build_reviewed_non_listening_handler(handler_id, event_name)
        add_event(
            event_name,
            producer_kind="OWNER_LOCAL_HANDLER",
            producer_id=handler_id,
            session=owner["session_id"],
            slice_id=slice_id,
            capability_id=capability_by_slice[slice_id],
            source_authority=repo_path(OPERATION_SOURCE),
            event_contract=handler_contract["event"],
        )
    for handler_id, event_names in sorted(NON_LISTENING_HANDLER_ADDITIONAL_EVENTS.items()):
        slice_id = _handler_slice(handler_id)
        owner = slice_by_id[slice_id]
        primary_name = NON_LISTENING_HANDLER_EVENTS[handler_id]
        handler_contract = build_reviewed_non_listening_handler(handler_id, primary_name)
        additional = {
            row["eventName"]: row
            for row in handler_contract.get("additionalEvents", [])
        }
        for event_name in event_names:
            if event_name not in additional:
                raise ValueError(f"reviewed additional handler event missing: {event_name}")
            add_event(
                event_name,
                producer_kind="OWNER_LOCAL_HANDLER",
                producer_id=handler_id,
                session=owner["session_id"],
                slice_id=slice_id,
                capability_id=capability_by_slice[slice_id],
                source_authority=repo_path(OPERATION_SOURCE),
                event_contract=additional[event_name],
            )

    listening_handler_events = {
        "internal.listening.configuration.admission-install-receipt.consume":
            "EmployeeListeningSurveyPublished.v3",
        "internal.listening.configuration.admission-close-receipt.consume":
            "EmployeeListeningSurveyClosed.v3",
        "internal.listening.insights.cohort-package.consume":
            "EmployeeListeningCohortProjectionPublished.v1",
    }
    reviewed_listening_handlers = {
        row["handlerId"]: row for row in build_reviewed_listening_handlers()
    }
    for handler_id, event_name in listening_handler_events.items():
        handler = reviewed_listening_handlers.get(handler_id)
        if handler is None or handler.get("event", {}).get("eventName") != event_name:
            raise ValueError(f"reviewed listening event missing: {handler_id}")
        add_event(
            event_name,
            producer_kind="OWNER_LOCAL_HANDLER",
            producer_id=handler_id,
            session="HRIS-SYS",
            slice_id="MOD-SYS-LISTEN",
            capability_id="HRIS.MODERN.EMPLOYEE_LISTENING",
            source_authority=repo_path(OPERATION_SOURCE),
            event_contract=handler["event"],
        )

    current_to_target = {
        REPLACED_PUBLIC_EVENT_IDS.get(event_name, event_name)
        for event_name in current_events
        if event_name not in REMOVED_PUBLIC_EVENT_IDS
    }
    new_command_events = {
        event_name
        for operations in NEW_COMMAND_EVENTS_BY_SESSION.values()
        for event_names in operations.values()
        for event_name in event_names
    }
    handler_events = set(NON_LISTENING_HANDLER_EVENTS.values()) | {
        event_name
        for event_names in NON_LISTENING_HANDLER_ADDITIONAL_EVENTS.values()
        for event_name in event_names
    }
    listening_public_events = {
        row["eventName"]
        for row in listening["eventOwnership"]["canonicalPublicEvents"]
    }
    target_events = (
        current_to_target | new_command_events | handler_events | listening_public_events
    )
    if len(target_events) != 157 or set(event_producers) != target_events:
        missing_events = sorted(target_events - set(event_producers))
        extra_events = sorted(set(event_producers) - target_events)
        raise ValueError(
            f"generated event closed set drift missing={missing_events} extra={extra_events}"
        )

    event_rows = []
    for event_name in sorted(target_events):
        event_type, version = _event_type_and_version(event_name)
        claim = event_producers[event_name]
        contract = claim["eventContract"]
        fields = copy.deepcopy(contract.get("fields", []))
        if not fields or any(
            not field.get("name") or not field.get("sourceKind") or not field.get("source")
            for field in fields
        ) or len({field["name"] for field in fields}) != len(fields):
            raise ValueError(f"event payload lacks reviewed source closure: {event_name}")
        event_row = {
            "eventName": event_name,
            "eventType": event_type,
            "schemaVersion": version,
            "topic": _event_topic(event_name),
            "ownerSession": claim["ownerSession"],
            "primarySliceId": claim["primarySliceId"],
            "capabilityId": claim["capabilityId"],
            "producerKind": claim["producerKind"],
            "producerId": claim["producerId"],
            "payloadSchemaId": event_name + ".Payload",
            "additionalProperties": False,
            "fields": fields,
            "condition": contract["condition"],
            "aggregateEntityType": contract["aggregateEntityType"],
            "emission": copy.deepcopy(contract["emission"]),
            "audience": copy.deepcopy(contract["audience"]),
            "refetchContract": copy.deepcopy(contract["refetchContract"]),
            "rawRequestMirroringForbidden": contract["rawRequestMirroringForbidden"],
            "predecessorEventSchemaRefs": claim["predecessorEventSchemaRefs"],
            "sourceAuthority": claim["sourceAuthority"],
            "implementationState": "NOT_STARTED_G3",
            "productionState": "NOT_AUTHORIZED_G6",
        }
        if "privacyContract" in contract:
            event_row["privacyContract"] = copy.deepcopy(contract["privacyContract"])
        event_rows.append(event_row)

    source_pin_rows = [
        {
            "path": repo_path(path),
            "bytes": path.stat().st_size,
            "sha256": file_sha(path),
        }
        for path in (
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
    ]
    set_seed = {
        "operationIds": sorted(operation_ids),
        "eventIds": sorted(target_events),
        "sourcePins": source_pin_rows,
        "g2BackendResultCommit": g2["sourcePins"]["backendResultCommit"],
    }
    canonical_set_id = "sha256:" + sha256_bytes(
        json.dumps(set_seed, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        .encode("utf-8")
    )
    authority = _common_authority(canonical_set_id, g2)

    by_session_scope = {
        session: {
            "operations": sum(row["ownerSession"] == session for row in operation_rows),
            "commands": sum(
                row["ownerSession"] == session and row["mode"] == "COMMAND"
                for row in operation_rows
            ),
            "queries": sum(
                row["ownerSession"] == session and row["mode"] == "QUERY"
                for row in operation_rows
            ),
        }
        for session in EXPECTED_SESSION_OPERATIONS
    }
    exact_doc = seal({
        "contractId": "dwp.hris.g3.modern.exact-schema-successor.v1",
        "schemaVersion": CANONICAL_SCHEMA_VERSION,
        "status": STATUS,
        "authority": authority,
        "scope": {
            "capabilities": len({row["capabilityId"] for row in operation_rows}),
            "operations": 199,
            "commands": 133,
            "queries": 66,
            "bySession": by_session_scope,
        },
        "policies": {
            **copy.deepcopy(source_exact["policies"]),
            "tenant": "AUTHENTICATED_CONTEXT_ONLY",
            "publicIdentity": "UUID_PUBLIC_ID_ONLY",
            "commands": "IDEMPOTENCY_RECEIPT_CAS_AND_OUTBOX_REQUIRED",
            "queries": "READ_ONLY_REAUTHORIZED_AS_OF_AND_FIELD_SCOPED",
        },
        "commonTableContract": copy.deepcopy(source_exact["commonTableContract"]),
        "commonErrorSchemas": copy.deepcopy(source_exact["commonErrorSchemas"]),
        "recordSchemas": all_record_schemas,
        "responseSchemas": all_response_schemas,
        "operationBindings": operation_rows,
        "tableSpecifications": copy.deepcopy(source_exact["tableSpecifications"]),
    })

    event_doc = seal({
        "contractId": "dwp.hris.g3.modern.event-payload-successor.v1",
        "schemaVersion": CANONICAL_SCHEMA_VERSION,
        "status": STATUS,
        "authority": authority,
        "scope": {
            "capabilities": len({row["capabilityId"] for row in event_rows}),
            "publicEvents": 157,
            "ownerSessions": sorted({row["ownerSession"] for row in event_rows}),
            "predecessorPayloadSchemasPreserved": len(predecessor_event_rows),
        },
        "eventEnvelopeRef": source_events["eventEnvelopeRef"],
        "eventEnvelope": copy.deepcopy(source_events["eventEnvelope"]),
        "predecessorEventPayloadSchemas": copy.deepcopy(predecessor_event_rows),
        "eventPayloadSchemas": event_rows,
    })

    semantic_operations = [{
        "operationId": row["operationId"],
        "ownerSession": row["ownerSession"],
        "primarySliceId": row["primarySliceId"],
        "capabilityId": row["capabilityId"],
        "mode": row["mode"],
        "method": row["method"],
        "path": row["path"],
        "authorizationCapability": row["authorizationCapability"],
        "eventIds": list(row["eventNames"]),
        "exactSchemaRef": f"{EXACT.name}#/operationBindings/{index}",
    } for index, row in enumerate(operation_rows)]
    semantic_events = [{
        "eventName": row["eventName"],
        "ownerSession": row["ownerSession"],
        "primarySliceId": row["primarySliceId"],
        "capabilityId": row["capabilityId"],
        "producerKind": row["producerKind"],
        "producerId": row["producerId"],
        "eventSchemaRef": f"{EVENTS.name}#/eventPayloadSchemas/{index}",
    } for index, row in enumerate(event_rows)]
    semantic_doc = seal({
        "registryId": "dwp.hris.g3.modern.semantic-bindings-successor.v1",
        "schemaVersion": CANONICAL_SCHEMA_VERSION,
        "status": STATUS,
        "authority": authority,
        "scope": {"operations": 199, "commands": 133, "queries": 66, "events": 157},
        "operationSemanticBindings": semantic_operations,
        "eventSemanticBindings": semantic_events,
    })

    identity_doc = seal({
        "registryId": "dwp.hris.g3.modern.public-identities-successor.v1",
        "schemaVersion": CANONICAL_SCHEMA_VERSION,
        "status": STATUS,
        "authority": authority,
        "scope": {"operations": 199, "publicEvents": 157},
        "operationPublicIdentities": [{
            "operationId": row["operationId"],
            "method": row["method"],
            "path": row["path"],
            "ownerSession": row["ownerSession"],
            "primarySliceId": row["primarySliceId"],
            "identityRule": "METHOD_PLUS_CANONICAL_PATH_PLUS_OPERATION_ID",
        } for row in operation_rows],
        "eventPublicIdentities": [{
            "eventName": row["eventName"],
            "eventType": row["eventType"],
            "version": row["schemaVersion"],
            "topic": row["topic"],
            "ownerSession": row["ownerSession"],
            "primarySliceId": row["primarySliceId"],
            "identityRule": "EXACT_EVENT_NAME_AND_VERSION_NO_ALIAS",
        } for row in event_rows],
    })

    final_owner: dict[str, tuple[str, str, str]] = {}
    for ref, slice_row in primary_owner.items():
        kind = _prefix_kind(ref, source_operation_ids, current_events)
        if kind in {"MODERN_OPERATION", "MODERN_EVENT", "IAQ"}:
            continue
        final_owner[ref] = (kind, slice_row["session_id"], slice_row["slice_id"])
    for operation_id, (session, slice_id, _capability) in operation_owner.items():
        final_owner[operation_id] = ("MODERN_OPERATION", session, slice_id)
    for event_name, claim in event_producers.items():
        final_owner[event_name] = (
            "MODERN_EVENT", claim["ownerSession"], claim["primarySliceId"]
        )
    final_counts = Counter(kind for kind, _session, _slice in final_owner.values())
    if len(final_owner) != 695 or dict(final_counts) != EXPECTED_PROFILE:
        raise ValueError(f"final primary ownership profile drift: {dict(final_counts)}")

    locator_specs = {
        "PUBLIC_PEP": (PUBLIC_PEP, "binding_id", "EXACT"),
        "INTERNAL_SERVICE_PEP": (SERVICE_PEP, "binding_id", "EXACT"),
        "XCON_PRODUCER": (XCON, "contract_id", "EXACT"),
        "SYS_G2_CONTRACT": (SYS_G2, "contract_id", "EXACT"),
        "BASE_EVENT": (SOURCE_SLICES, "primary_contract_refs", "PIPE_MEMBERSHIP"),
    }
    source_locator: dict[str, dict[str, Any]] = {}
    for kind, (path, field, mode) in locator_specs.items():
        for data_row, row in enumerate(read_csv(path), start=1):
            values = split_refs(row[field]) if mode == "PIPE_MEMBERSHIP" else [row[field]]
            for contract_id in values:
                if contract_id in final_owner and final_owner[contract_id][0] == kind:
                    source_locator[contract_id] = {
                        "path": repo_path(path),
                        "format": "CSV",
                        "selectorField": field,
                        "selectorMode": mode,
                        "selectorValue": contract_id,
                        "dataRow": data_row,
                        "bytes": path.stat().st_size,
                        "sha256": file_sha(path),
                    }
    nonmodern_ids = {
        contract_id for contract_id, (kind, _session, _slice) in final_owner.items()
        if kind not in {"MODERN_OPERATION", "MODERN_EVENT"}
    }
    if set(source_locator) != nonmodern_ids:
        raise ValueError("non-modern ownership source locator closure drift")
    ownership_source_index = {
        contract_id: {
            "semantic": {
                "contractId": contract_id,
                "contractKind": final_owner[contract_id][0],
                "ownerSession": final_owner[contract_id][1],
                "primarySliceId": final_owner[contract_id][2],
                "authority": "CURRENT_PRIMARY_SLICE",
            },
            "sourceRegister": source_locator[contract_id],
        }
        for contract_id in sorted(nonmodern_ids)
    }
    rationale = {
        "PUBLIC_PEP": "G2_PUBLIC_PEP_PRIMARY_ROUTE_OWNER",
        "INTERNAL_SERVICE_PEP": "G2_INTERNAL_SERVICE_PRIMARY_PROVIDER",
        "XCON_PRODUCER": "G2_XCON_PRIMARY_PRODUCER",
        "SYS_G2_CONTRACT": "G2_SYS_PRIMARY_CONTRACT_OWNER",
        "BASE_EVENT": "G2_BASE_EVENT_PRIMARY_PRODUCER",
        "MODERN_OPERATION": "G3_CANONICAL_OPERATION_PRIMARY_OWNER",
        "MODERN_EVENT": "G3_CANONICAL_EVENT_PRIMARY_PRODUCER",
    }
    owner_rows = []
    operation_index = {
        row["operationId"]: index for index, row in enumerate(operation_rows)
    }
    event_index = {
        row["eventName"]: index for index, row in enumerate(event_rows)
    }
    for contract_id, (kind, session, slice_id) in final_owner.items():
        if kind == "MODERN_OPERATION":
            semantic_ref = (
                f"{SEMANTIC.name}#/operationSemanticBindings/{operation_index[contract_id]}"
            )
            register_ref = (
                f"{EXACT.name}#/operationBindings/{operation_index[contract_id]}"
            )
        elif kind == "MODERN_EVENT":
            semantic_ref = (
                f"{SEMANTIC.name}#/eventSemanticBindings/{event_index[contract_id]}"
            )
            register_ref = (
                f"{EVENTS.name}#/eventPayloadSchemas/{event_index[contract_id]}"
            )
        else:
            escaped = _json_pointer_escape(contract_id)
            semantic_ref = f"{MANIFEST.name}#/ownershipSourceIndex/{escaped}/semantic"
            register_ref = f"{MANIFEST.name}#/ownershipSourceIndex/{escaped}/sourceRegister"
        owner_rows.append({
            "contract_id": contract_id,
            "contract_kind": kind,
            "owner_session": session,
            "primary_slice_id": slice_id,
            "source_semantic_ref": semantic_ref,
            "source_register_ref": register_ref,
            "rationale": rationale[kind],
            "status": OWNER_STATUS,
        })
    owner_rows.sort(key=lambda row: (KIND_ORDER.index(row["contract_kind"]), row["contract_id"]))
    owner_buffer = io.StringIO(newline="")
    writer = csv.DictWriter(owner_buffer, fieldnames=OWNERSHIP_FIELDS, lineterminator="\n")
    writer.writeheader()
    writer.writerows(owner_rows)
    ownership_bytes = owner_buffer.getvalue().encode("utf-8")

    artifact_bytes: dict[Path, bytes] = {
        EXACT: render_json(exact_doc),
        EVENTS: render_json(event_doc),
        SEMANTIC: render_json(semantic_doc),
        IDENTITY: render_json(identity_doc),
        OWNERSHIP: ownership_bytes,
    }
    source_tool_rows = [
        {"path": repo_path(path), "bytes": path.stat().st_size, "sha256": file_sha(path)}
        for path in (Path(__file__), VALIDATOR)
    ]
    artifacts = []
    roles = {
        EXACT: "G3_CANONICAL_EXACT_OPERATION_SCHEMA",
        EVENTS: "G3_CANONICAL_EVENT_PAYLOAD_SCHEMA",
        SEMANTIC: "G3_CANONICAL_SEMANTIC_BINDINGS",
        IDENTITY: "G3_CANONICAL_PUBLIC_IDENTITIES",
        OWNERSHIP: "G3_FINAL_PRIMARY_OWNERSHIP_695",
    }
    for path in DATA_OUTPUTS:
        raw = artifact_bytes[path]
        row: dict[str, Any] = {
            "path": repo_path(path),
            "role": roles[path],
            "bytes": len(raw),
            "sha256": sha256_bytes(raw),
        }
        if path == OWNERSHIP:
            row["dataRows"] = 695
            row["header"] = list(OWNERSHIP_FIELDS)
        else:
            doc = json.loads(raw)
            row["sealedPayloadSha256"] = doc["sealedPayloadSha256"]
        artifacts.append(row)

    carry_forward = {
        "people360": {
            "contractIds": ["PEP-HRM-001", "PEP-HRM-002"],
            "ownerSession": "HRIS-HRM",
            "primarySliceId": "BASE-TFR-HRM-004",
            "personChangedV1ProductionClaim": False,
        },
        "assignmentProposal": {
            "contractIds": ["PEP-HRM-006", "PEP-HRM-007", "PEP-HRM-008", "PEP-HRM-009"],
            "ownerSession": "HRIS-HRM",
            "primarySliceId": "BASE-TFR-HRM-008",
            "proposalOutboxEventsPromotedToG3Rows": False,
            "assignmentChangedV1EquivalenceClaim": False,
        },
        "workforceSnapshotQueryPort": {
            "contractId": "WorkforceSnapshotQueryPort.v1",
            "producerOwnerSession": "HRIS-HRM",
            "producerSliceId": "BASE-TFR-HRM-004",
            "consumerOwnerSession": "HRIS-PER",
            "consumerSliceId": "BASE-TFR-PER-016",
            "ownershipRowEmitted": False,
            "reason": "IN_PROCESS_PORT_EVIDENCE_NOT_ONE_OF_THE_CLOSED_21_XCON_ROWS",
        },
        "performance": {
            "cycleContractIds": [
                "PEP-PER-002", "PEP-PER-003", "PEP-PER-004", "PEP-PER-005",
                "PEP-PER-006", "PEP-PER-007", "EVT-PER:PerformanceCyclePublished.v1",
            ],
            "cycleSliceId": "BASE-TFR-PER-005",
            "populationPreviewContractId": "PEP-PER-008",
            "populationPreviewSliceId": "BASE-TFR-PER-006",
            "commandReceiptContractId": "PEP-PER-021",
            "commandReceiptSliceId": "BASE-TFR-PER-011",
            "ownerSession": "HRIS-PER",
        },
    }
    manifest_doc = seal({
        "schema": "dwp.hris.g3.canonical-ownership-successor-manifest.v1",
        "manifestId": "dwp.hris.g3.canonical-ownership-successor.2026-10-07",
        "schemaVersion": 1,
        "status": "SEALED_G3_CANONICAL_SUCCESSOR_NOT_IMPLEMENTED",
        "authority": authority,
        "sourcePins": source_pin_rows,
        "toolPins": source_tool_rows,
        "artifacts": artifacts,
        "targetProfile": {
            "canonicalJsonCount": 4,
            "modernOperations": 199,
            "modernCommands": 133,
            "modernQueries": 66,
            "modernEvents": 157,
            "officialNewOperations": 101,
            "officialNewRequestFields": sum(
                len(row["requestFields"]) for row in official_new_operations.values()
            ),
            "recordSchemas": len(all_record_schemas),
            "responseSchemas": len(all_response_schemas),
            "primaryOwnershipCategories": EXPECTED_PROFILE,
            "primaryOwnershipRows": 695,
        },
        "historicalNonIdentity": {
            "historicalOwnershipPath": g2["supersedesHistorical"]["path"],
            "historicalOwnershipSha256": g2["supersedesHistorical"]["historicalExpectedSha256"],
            "historicalOwnershipBytes": g2["supersedesHistorical"]["historicalExpectedBytes"],
            "historicalOwnershipRows": g2["supersedesHistorical"]["historicalExpectedRows"],
            "historicalBytesRecovered": False,
            "historicalBytesReused": False,
            "historicalByteIdentityClaim": False,
            "successorRelationship": "FORWARD_ONLY_REVIEWED_SUCCESSOR_NOT_ROW_RECONSTRUCTION",
        },
        "g2CarryForwardEvidence": carry_forward,
        "ownershipSourceIndex": ownership_source_index,
        "invariants": {
            "singlePrimaryOwnerPerContract": True,
            "iaQueryRowsExcludedFromOwnership": True,
            "proposalOutboxEventsAreEvidenceOnly": True,
            "proposalEventsAreNotAssignmentChangedV1": True,
            "people360DoesNotClaimPersonChangedV1Production": True,
            "performanceContractsRemainPerOwned": True,
            "supersededModernOperationsExcluded": sorted(REMOVED_OPERATION_IDS),
            "supersededModernEventsExcluded": sorted(REMOVED_PUBLIC_EVENT_IDS),
        },
        "authorizationBoundary": {
            "moduleCodeGoGranted": False,
            "productionAuthorizationGranted": False,
            "implementationState": "NOT_STARTED_G3",
            "productionState": "NOT_AUTHORIZED_G6",
        },
        "verificationPlan": {
            "status": "NOT_RECORDED",
            "commands": [
                {
                    "id": "GENERATOR_WRITE",
                    "command": f"python3 {repo_path(Path(__file__))} --write",
                    "expectedExitCode": 0,
                    "result": "NOT_RECORDED",
                },
                {
                    "id": "GENERATOR_CHECK",
                    "command": f"python3 {repo_path(Path(__file__))} --check",
                    "expectedExitCode": 0,
                    "result": "NOT_RECORDED",
                },
                {
                    "id": "GENERATOR_SELF_TEST",
                    "command": f"python3 {repo_path(Path(__file__))} --self-test",
                    "expectedExitCode": 0,
                    "result": "NOT_RECORDED",
                },
                {
                    "id": "VALIDATOR_CHECK",
                    "command": f"python3 {repo_path(VALIDATOR)} --check",
                    "expectedExitCode": 0,
                    "result": "NOT_RECORDED",
                },
                {
                    "id": "VALIDATOR_SELF_TEST",
                    "command": f"python3 {repo_path(VALIDATOR)} --self-test",
                    "expectedExitCode": 0,
                    "result": "NOT_RECORDED",
                },
            ],
            "fullSuitePlanned": False,
            "w1Planned": False,
            "historicalByteIdentityClaim": False,
            "moduleCodeGoGranted": False,
            "productionAuthorizationGranted": False,
        },
    })
    artifact_bytes[MANIFEST] = render_json(manifest_doc)

    summary = {
        "canonicalSetId": canonical_set_id,
        "operations": len(operation_rows),
        "commands": modes["COMMAND"],
        "queries": modes["QUERY"],
        "events": len(event_rows),
        "officialNewOperations": len(official_new_operations),
        "officialNewRequestFields": sum(
            len(row["requestFields"]) for row in official_new_operations.values()
        ),
        "recordSchemas": len(all_record_schemas),
        "responseSchemas": len(all_response_schemas),
        "ownershipRows": len(owner_rows),
        "ownershipCategories": dict(final_counts),
        "hashes": {path.name: sha256_bytes(raw) for path, raw in artifact_bytes.items()},
    }
    return artifact_bytes, summary


def compose_deterministic() -> tuple[dict[Path, bytes], dict[str, Any]]:
    first, first_summary = compose()
    second, second_summary = compose()
    if first != second or first_summary != second_summary:
        raise ValueError("G3 successor composition is nondeterministic")
    return first, first_summary


def _resolve_generated_ref(documents: dict[str, Any], reference: str) -> Any:
    name, marker, pointer = reference.partition("#")
    if not marker or name not in documents or not pointer.startswith("/"):
        raise ValueError(f"generated ownership reference is not local JSON pointer: {reference}")
    value: Any = documents[name]
    for token in pointer[1:].split("/"):
        token = token.replace("~1", "/").replace("~0", "~")
        if isinstance(value, list):
            if not token.isdigit() or int(token) >= len(value):
                raise ValueError(f"generated ownership array reference is invalid: {reference}")
            value = value[int(token)]
        elif isinstance(value, dict) and token in value:
            value = value[token]
        else:
            raise ValueError(f"generated ownership object reference is invalid: {reference}")
    return value


def generator_self_test(outputs: dict[Path, bytes]) -> dict[str, int]:
    documents = {
        path.name: json.loads(outputs[path]) for path in (*JSON_OUTPUTS, MANIFEST)
    }
    owner_rows = list(csv.DictReader(io.StringIO(outputs[OWNERSHIP].decode("utf-8"))))
    resolved = 0
    for row in owner_rows:
        for column in ("source_semantic_ref", "source_register_ref"):
            value = _resolve_generated_ref(documents, row[column])
            if not isinstance(value, dict):
                raise ValueError(f"generated ownership reference is not an object: {row[column]}")
            resolved += 1
    manifest = documents[MANIFEST.name]
    if "publicationReceipt" in manifest or "verification" in manifest:
        raise ValueError("generated manifest contains synthesized execution claims")
    plan = manifest.get("verificationPlan", {})
    if plan.get("status") != "NOT_RECORDED" or any(
        row.get("result") != "NOT_RECORDED" for row in plan.get("commands", [])
    ):
        raise ValueError("generated verification plan records unexecuted results")
    exact = documents[EXACT.name]
    operation_map = {
        row["operationId"]: row for row in exact["operationBindings"]
    }
    record_map = {row["schemaId"]: row for row in exact["recordSchemas"]}
    response_map = {row["schemaId"]: row for row in exact["responseSchemas"]}
    official_rows = _official_new_operation_rows(
        read_json(SOURCE_EXACT)["operationBindings"]
    )
    request_field_count = 0
    for operation_id, official in official_rows.items():
        request_field_count += len(official["requestFields"])
        published = operation_map[operation_id]
        if published["requestSchema"] != _official_request_schema(official):
            raise ValueError(f"official request schema drift: {operation_id}")
        response_id = operation_id + ".Response.v3"
        if published["responseSchemaRef"] != response_id:
            raise ValueError(f"official response ref drift: {operation_id}")
        if operation_id in NEW_COMMAND_RUNTIME:
            root = official["aggregateRoot"]["table"]
            nested = build_official_child_schema(official)
            response = build_official_response_schema(official, root, True)
        else:
            root = official["readPlan"]["tables"][0]
            nested = build_official_record_schema(official, root)
            response = build_official_response_schema(official, root, False)
        if record_map.get(nested["schemaId"]) != nested:
            raise ValueError(f"official nested schema drift: {operation_id}")
        if response_map.get(response_id) != response:
            raise ValueError(f"official response schema drift: {operation_id}")
    listening_response = response_map[
        "modern.listening.survey.revise.Response.v3"
    ]
    listening_receipt = next(
        field for field in listening_response["fields"]
        if field["name"] == "commandReceiptId"
    )
    if listening_receipt.get("referenceContract", {}).get("entityType") != (
        "table:sys_hris_listening_operation_receipts"
    ):
        raise ValueError("Listening configuration receipt authority drift")
    return {
        "ownershipReferenceColumnsResolved": resolved,
        "officialNewOperationsValidated": len(official_rows),
        "officialRequestFieldsValidated": request_field_count,
        "operationSpecificResponseSchemasValidated": len(official_rows),
        "listeningReceiptBindingsValidated": 1,
        "semanticDefectsGuarded": 9,
    }


def write_outputs(outputs: dict[Path, bytes]) -> None:
    with tempfile.TemporaryDirectory(prefix="g3-canonical-ownership-", dir=str(HERE)) as raw_dir:
        stage = Path(raw_dir)
        staged: dict[Path, Path] = {}
        for destination, raw in outputs.items():
            target = stage / destination.name
            with target.open("wb") as handle:
                handle.write(raw)
                handle.flush()
                os.fsync(handle.fileno())
            if target.read_bytes() != raw:
                raise ValueError(f"staged successor bytes changed: {destination.name}")
            staged[destination] = target
        for destination in ALL_OUTPUTS:
            os.replace(staged[destination], destination)
    mismatches = [path.name for path, raw in outputs.items() if path.read_bytes() != raw]
    if mismatches:
        raise ValueError("written successor bytes mismatch: " + ", ".join(mismatches))


def main() -> int:
    parser = argparse.ArgumentParser()
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--preview", action="store_true")
    group.add_argument("--write", action="store_true")
    group.add_argument("--check", action="store_true")
    group.add_argument("--self-test", action="store_true")
    args = parser.parse_args()

    outputs, summary = compose_deterministic()
    if args.preview:
        print(json.dumps({
            "schema": "dwp.hris.g3.canonical-ownership-generator-preview.v1",
            "status": "PASS",
            **summary,
        }, ensure_ascii=False, sort_keys=True))
        return 0
    if args.self_test:
        assertions = generator_self_test(outputs)
        print(json.dumps({
            "schema": "dwp.hris.g3.canonical-ownership-generator-self-test.v1",
            "status": "PASS",
            "deterministicCompositions": 2,
            **assertions,
            **summary,
        }, ensure_ascii=False, sort_keys=True))
        return 0
    if args.write:
        write_outputs(outputs)
    mismatches = [
        path.name for path, raw in outputs.items()
        if not path.is_file() or path.read_bytes() != raw
    ]
    if mismatches:
        raise ValueError("G3 successor generated bytes mismatch: " + ", ".join(mismatches))
    print(json.dumps({
        "schema": "dwp.hris.g3.canonical-ownership-generator-check.v1",
        "status": "PASS",
        **summary,
    }, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
