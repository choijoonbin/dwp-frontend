#!/usr/bin/env python3
"""Compose the semantic-binding and public-identity canonical successors.

This generator consumes only the operation, exact-schema and event canonical
inputs plus the immutable closed-set manifest.  It does not import a generated
module projection, the Listening summary, an independent oracle, or historical
evidence.  Registry core digests are pinned by the exact/event contracts while
the registries pin the exact final canonical bytes, avoiding a circular file
hash dependency.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
from pathlib import Path
from typing import Any

from generate_modern_exact_event_successor import compose_exact, compose_exact_from_ssot
from modern_closed_set_design import PREDECESSOR_OPERATION_SSOT_SHA256
from sys_listening_canonical_design import composition_marker, stamp_canonical_document


HERE = Path(__file__).resolve().parent
SSOT = HERE / "modern-capability-operation-causal-contract-ssot.v2.json"
MANIFEST = HERE / "modern-capability-closed-set-manifest.v3.json"
EXACT = HERE / "modern-capability-exact-schema-contracts.v1.json"
EVENTS = HERE / "modern-capability-event-payload-contracts.v1.json"
BINDINGS = HERE / "modern-capability-semantic-bindings.v1.json"
IDENTITIES = HERE / "modern-capability-public-identity-registry.v1.json"

BUSINESS_ID_TYPES = {"UUID", "UUID[]", "ARRAY<UUID>"}


def render(value: dict[str, Any]) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2) + "\n"


def sha_bytes(value: dict[str, Any]) -> str:
    return hashlib.sha256(render(value).encode("utf-8")).hexdigest()


def sealed_payload(value: dict[str, Any]) -> str:
    payload = {key: item for key, item in value.items() if key != "sealedPayloadSha256"}
    encoded = json.dumps(
        payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def registry_core(value: dict[str, Any]) -> str:
    payload = {
        key: item for key, item in value.items()
        if key not in {"sealedPayloadSha256", "canonicalContractPins"}
    }
    encoded = json.dumps(
        payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _request_contract(binding: dict[str, Any]) -> list[dict[str, Any]]:
    rows = []
    for location in ("pathParameters", "queryParameters", "headers", "body"):
        for field in binding["requestSchema"].get(location, []):
            row = {
                "source": location + "." + field["name"],
                "type": field["type"], "required": field["required"],
            }
            for key in (
                "referenceContract", "traceContract", "requestDigestMember",
                "sensitivity", "tokenization", "validation",
            ):
                if key in field:
                    row[key] = copy.deepcopy(field[key])
            rows.append(row)
    return rows


def _typed_sources(binding: dict[str, Any], lineage: dict[str, Any]) -> list[dict[str, Any]]:
    result = []
    for request in _request_contract(binding):
        reference = request.get("referenceContract")
        if reference:
            result.append({
                "source": request["source"], "type": request["type"],
                "kind": "TYPED_REQUEST_REFERENCE",
                "semanticBinding": {
                    "sourceKind": "VALIDATED_REQUEST",
                    **copy.deepcopy(reference), "tenantBound": True,
                    "ownerValidated": True, "exactRevisionAsOf": True,
                },
            })
    for row in lineage.get("responseFieldSources", []):
        result.append({
            "source": row["sourcePath"], "kind": "CLOSED_RESPONSE_SOURCE",
            "target": row["target"], "sourceKind": row["sourceKind"],
        })
    for row in lineage.get("eventFieldSources", []):
        result.append({
            "source": row["sourcePath"], "kind": "DURABLE_EVENT_SOURCE",
            "target": row["target"], "sourceKind": row["sourceKind"],
        })
    return result


def _owner_dependency_semantic_bindings(
    exact: dict[str, Any],
) -> list[dict[str, Any]]:
    """Deterministic full projection; IDs alone are not semantic closure."""
    return [
        {
            "dependencyContractId": row["dependencyContractId"],
            "ownerSession": row.get("ownerSession"),
            "consumerSession": row.get("consumerSession"),
            "purpose": row.get("pep", {}).get("purpose"),
            "requestFields": [
                field["name"]
                for field in row.get("requestSchema", {}).get("fields", [])
            ],
            "responseHeaderFields": [
                field["name"]
                for field in row.get("responseSchema", {}).get(
                    "headerFields", []
                )
            ],
            "responseLineFields": [
                field["name"]
                for field in row.get("responseSchema", {}).get(
                    "lines", {}
                ).get("itemFields", [])
            ],
            "readTables": copy.deepcopy(
                row.get("readPlan", {}).get("tables", [])
            ),
            "writes": row.get("writes"),
            "latestFallback": row.get("latestFallback"),
            "sealedPayloadSha256": row.get("sealedPayloadSha256"),
        }
        for row in exact.get("ownerDependencyContracts", [])
    ]


def build_semantic_registry(
    exact: dict[str, Any], canonical_pins: dict[str, str], manifest: dict[str, Any]
) -> dict[str, Any]:
    lineages = {row["operationId"]: row for row in exact["operationFieldLineage"]}
    operations = []
    for binding in sorted(exact["operationBindings"], key=lambda row: row["operationId"]):
        lineage = lineages[binding["operationId"]]
        operations.append({
            "operationId": binding["operationId"],
            "capabilityId": binding["capabilityId"], "session": binding["session"],
            "mode": binding["mode"], "method": binding["method"], "path": binding["path"],
            "authorizationCapability": binding["authorizationCapability"],
            "readsTables": copy.deepcopy(binding["readsTables"]),
            "writesTables": copy.deepcopy(binding["writesTables"]),
            "responseSchemaRef": binding["responseSchemaRef"],
            "stateTransitionIds": copy.deepcopy(binding["stateTransitionIds"]),
            "eventNames": copy.deepcopy(binding["eventNames"]),
            "requestContract": _request_contract(binding),
            "inputMappings": copy.deepcopy(lineage["inputMappings"]),
            "typedSources": _typed_sources(binding, lineage),
            "receiptContracts": copy.deepcopy(lineage["receiptContracts"]),
            "writeSet": copy.deepcopy(lineage["writeSet"]),
            "mutationFieldSources": copy.deepcopy(lineage["mutationFieldSources"]),
            "requiredColumnSources": copy.deepcopy(lineage["requiredColumnSources"]),
            "responseFieldSources": copy.deepcopy(lineage["responseFieldSources"]),
            "eventFieldSources": copy.deepcopy(lineage["eventFieldSources"]),
            "mutationEvidence": copy.deepcopy(lineage["mutationEvidence"]),
            "semanticClosure": {
                "request": "EXACT_SCHEMA_TO_TYPED_EFFECT",
                "mutation": "EXACT_PHYSICAL_COLUMN_SOURCE",
                "response": "PHYSICAL_POST_OR_SEALED_RECEIPT_OR_IMMUTABLE_PROOF",
                "event": "DURABLE_POST_PRE_OR_IMMUTABLE_OWNER_PROOF",
                "query": "ENTITY_PHYSICAL_SOURCE_PEP_PURPOSE_POPULATION_ASOF_FRESHNESS_CURSOR",
            },
        })
    result = {
        "registryId": "dwp.hris.modern.operation-semantic-bindings.v1",
        "schemaVersion": 3, "status": "SEALED_G3_DESIGN_NOT_IMPLEMENTED",
        "scope": {
            "operations": len(operations),
            "commands": manifest["scope"]["commands"],
            "queries": manifest["scope"]["queries"],
            "implementationState": "NOT_STARTED_G3",
            "productionState": "NOT_AUTHORIZED_G6",
        },
        "closedSetManifest": {
            "manifestId": manifest["manifestId"],
            "sealedPayloadSha256": manifest["sealedPayloadSha256"],
        },
        "canonicalContractPins": dict(sorted(canonical_pins.items())),
        "operations": operations,
        "ownerPortOperationContracts": copy.deepcopy(
            exact.get("ownerPortOperationContracts", [])
        ),
        "ownerDependencyContracts": copy.deepcopy(
            exact.get("ownerDependencyContracts", [])
        ),
        "ownerDependencySemanticBindings": (
            _owner_dependency_semantic_bindings(exact)
        ),
        "ownerPortSemanticBindings": [
            {
                "ownerPortOperation": row["ownerPortOperation"],
                "streamKey": row["streamKey"], "entrypointRef": copy.deepcopy(row["entrypointRef"]),
                "purpose": row["pep"]["purpose"], "population": row["pep"]["population"],
                "fieldPolicy": row["pep"]["fieldPolicy"],
                "selectorEntities": [
                    selector.get("entityType") or selector.get("targetTable")
                    for selector in row["selectors"]
                ],
                "writeTables": [step["table"] for step in row["orderedDml"]],
            }
            for row in exact.get("ownerPortOperationContracts", [])
        ],
    }
    stamp_canonical_document(result, "semanticBindings")
    result["sealedPayloadSha256"] = sealed_payload(result)
    return result


def _schema_identities(
    operation_id: str, schema_id: str, schemas: dict[str, dict[str, Any]],
    result: dict[str, dict[str, Any]], seen: set[str],
) -> None:
    if schema_id in seen:
        return
    seen.add(schema_id)
    schema = schemas[schema_id]
    for field in schema["fields"]:
        reference = field.get("referenceContract")
        if reference:
            result[f"{schema_id}.{field['name']}"] = copy.deepcopy(reference)
        nested = field.get("schemaRef") or field.get("itemSchemaRef")
        if nested:
            _schema_identities(operation_id, nested, schemas, result, seen)


def build_identity_registry(
    exact: dict[str, Any], events: dict[str, Any], canonical_pins: dict[str, str],
    manifest: dict[str, Any],
) -> dict[str, Any]:
    physical: dict[str, dict[str, Any]] = {}
    for table in exact["tableSpecifications"]:
        table_name = table["tableName"]
        physical[table_name + ".public_id"] = {
            "entityType": "table:" + table_name, "idSpace": "PUBLIC_UUID",
        }
        for field in table.get("columns", []):
            if field.get("referenceContract"):
                physical[table_name + "." + field["name"]] = copy.deepcopy(
                    field["referenceContract"]
                )
    schemas = {
        row["schemaId"]: row
        for row in exact["recordSchemas"] + exact["responseSchemas"]
    }
    requests: dict[str, dict[str, Any]] = {}
    responses: dict[str, dict[str, Any]] = {}
    bindings = {row["operationId"]: row for row in exact["operationBindings"]}
    for operation_id, binding in sorted(bindings.items()):
        for request in _request_contract(binding):
            reference = request.get("referenceContract")
            if reference:
                requests.setdefault(operation_id, {})[request["source"]] = copy.deepcopy(reference)
        response_fields: dict[str, Any] = {}
        _schema_identities(
            operation_id, binding["responseSchemaRef"], schemas, response_fields, set()
        )
        responses[operation_id] = dict(sorted(response_fields.items()))

    event_fields: dict[str, dict[str, Any]] = {}
    event_producers: dict[str, str] = {}
    for schema in events["eventPayloadSchemas"]:
        producers = [
            *schema.get("emittedByOperationIds", []),
            *schema.get("emittedByInternalHandlerIds", []),
        ]
        if len(producers) != 1:
            raise ValueError(f"event lacks exact producer identity: {schema['eventName']}")
        producer = producers[0]
        event_producers[schema["eventName"]] = producer
        for field in schema["fields"]:
            if field.get("referenceContract"):
                event_fields.setdefault(producer, {})[
                    schema["eventName"] + "." + field["name"]
                ] = copy.deepcopy(field["referenceContract"])
    result = {
        "registryId": "dwp.hris.modern.public-identities.v1",
        "schemaVersion": 3, "status": "SEALED_G3_DESIGN_NOT_IMPLEMENTED",
        "scope": {
            "operations": len(bindings), "publicEvents": len(event_producers),
            "implementationState": "NOT_STARTED_G3",
            "productionState": "NOT_AUTHORIZED_G6",
        },
        "closedSetManifest": {
            "manifestId": manifest["manifestId"],
            "sealedPayloadSha256": manifest["sealedPayloadSha256"],
        },
        "canonicalContractPins": dict(sorted(canonical_pins.items())),
        "identityPolicy": {
            "traceEnvelopeIds": "NOT_BUSINESS_IDENTITY",
            "typedReference": "EXACT_OWNER_ENTITY_AND_ID_SPACE_REQUIRED",
            "latestFallback": "FORBIDDEN",
            "genericUuidAlias": "FORBIDDEN",
        },
        "physicalColumns": dict(sorted(physical.items())),
        "requestFieldsByOperation": {
            key: dict(sorted(value.items())) for key, value in sorted(requests.items())
        },
        "responseFieldsByOperation": dict(sorted(responses.items())),
        "eventFieldsByProducer": {
            key: dict(sorted(value.items())) for key, value in sorted(event_fields.items())
        },
        "eventProducerByName": dict(sorted(event_producers.items())),
        "ownerPortOperationContracts": copy.deepcopy(
            exact.get("ownerPortOperationContracts", [])
        ),
        "ownerPortPublicIdentityFields": {
            row["ownerPortOperation"]: {
                "request": [
                    field["name"] for field in row["requestSchema"]["fields"]
                    if field.get("type") in BUSINESS_ID_TYPES
                ],
                "response": [
                    field["name"] for field in row["responseSchema"]["fields"]
                    if field.get("type") in BUSINESS_ID_TYPES
                ],
                "crossStreamLocalIdsForbidden": True,
            }
            for row in exact.get("ownerPortOperationContracts", [])
        },
    }
    stamp_canonical_document(result, "publicIdentities")
    result["sealedPayloadSha256"] = sealed_payload(result)
    return result


def _validate_business_identity_fields(exact: dict[str, Any], events: dict[str, Any]) -> None:
    missing: list[str] = []
    for table in exact["tableSpecifications"]:
        for field in table.get("columns", []):
            if field.get("sqlType") in BUSINESS_ID_TYPES and not field.get("referenceContract"):
                missing.append(table["tableName"] + "." + field["name"])
    for binding in exact["operationBindings"]:
        for request in _request_contract(binding):
            if (
                request["type"] in BUSINESS_ID_TYPES
                and request.get("traceContract") != "Trace.Correlation"
                and not request.get("referenceContract")
            ):
                missing.append(binding["operationId"] + ":" + request["source"])
    schemas = exact["recordSchemas"] + exact["responseSchemas"]
    for schema in schemas:
        for field in schema["fields"]:
            if (
                field.get("type") in BUSINESS_ID_TYPES
                and field.get("traceContract") != "Trace.Correlation"
                and not field.get("referenceContract")
                and field.get("name") != "childResults"
            ):
                missing.append(schema["schemaId"] + "." + field["name"])
    for schema in events["eventPayloadSchemas"]:
        for field in schema["fields"]:
            if (
                field.get("type") in BUSINESS_ID_TYPES
                and field.get("traceContract") != "Trace.Correlation"
                and not field.get("referenceContract")
            ):
                missing.append(schema["eventName"] + "." + field["name"])
    if missing:
        raise ValueError("untyped business identity fields: " + ", ".join(sorted(missing)[:20]))


def compose_all(
    current_exact: dict[str, Any], current_events: dict[str, Any],
    current_ssot: dict[str, Any], current_ssot_sha: str, manifest: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any], dict[str, Any]]:
    successor_set = {row["operationId"] for row in manifest["operations"]}
    if (
        current_ssot_sha == PREDECESSOR_OPERATION_SSOT_SHA256
        and {row["operationId"] for row in current_exact["operationBindings"]} != successor_set
    ):
        exact, events = compose_exact(
            current_exact, current_ssot, manifest,
            source_events=current_events,
        )
    elif (
        {row["operationId"] for row in current_ssot["operations"]} == successor_set
        and current_ssot.get("closedSetManifest", {}).get("manifestId")
        == manifest["manifestId"]
    ):
        exact, events = compose_exact_from_ssot(
            current_exact, current_ssot, manifest,
            source_events=current_events,
        )
    else:
        raise ValueError("canonical exact/event inputs are neither predecessor nor this successor")

    provisional_semantic = build_semantic_registry(exact, {}, manifest)
    provisional_identity = build_identity_registry(exact, events, {}, manifest)
    core_pins = {
        BINDINGS.name: registry_core(provisional_semantic),
        IDENTITIES.name: registry_core(provisional_identity),
    }
    registry_refs = {
        "semanticBindingRegistry": {
            "registryId": provisional_semantic["registryId"],
            "schemaVersion": 3, "path": BINDINGS.name,
            "status": "SEALED_G3_DESIGN_NOT_IMPLEMENTED",
        },
        "publicIdentityRegistry": {
            "registryId": provisional_identity["registryId"],
            "schemaVersion": 3, "path": IDENTITIES.name,
            "status": "SEALED_G3_DESIGN_NOT_IMPLEMENTED",
        },
    }
    exact.update(copy.deepcopy(registry_refs))
    exact["independentRegistryCorePins"] = dict(sorted(core_pins.items()))
    events["independentRegistryCorePins"] = dict(sorted(core_pins.items()))
    canonical_pins = {EXACT.name: sha_bytes(exact), EVENTS.name: sha_bytes(events)}
    semantic = build_semantic_registry(exact, canonical_pins, manifest)
    identity = build_identity_registry(exact, events, canonical_pins, manifest)
    if registry_core(semantic) != core_pins[BINDINGS.name]:
        raise ValueError("semantic reciprocal core pin is not stable")
    if registry_core(identity) != core_pins[IDENTITIES.name]:
        raise ValueError("identity reciprocal core pin is not stable")
    _validate_business_identity_fields(exact, events)
    return exact, events, semantic, identity


def validate(
    exact: dict[str, Any], events: dict[str, Any], semantic: dict[str, Any],
    identity: dict[str, Any], manifest: dict[str, Any],
) -> None:
    operation_ids = {row["operationId"] for row in manifest["operations"]}
    event_ids = set(manifest["publicEventIds"])
    if {row["operationId"] for row in exact["operationBindings"]} != operation_ids:
        raise ValueError("exact operation set differs from manifest")
    if {row["operationId"] for row in semantic["operations"]} != operation_ids:
        raise ValueError("semantic operation set differs from manifest")
    if {row["eventName"] for row in events["eventPayloadSchemas"]} != event_ids:
        raise ValueError("event set differs from manifest")
    if set(identity["eventProducerByName"]) != event_ids:
        raise ValueError("identity event-producer set differs from manifest")
    for document, role in (
        (exact, "exactSchemas"), (events, "eventPayloads"),
        (semantic, "semanticBindings"), (identity, "publicIdentities"),
    ):
        if document.get("listeningCanonicalComposition") != composition_marker(role):
            raise ValueError(f"Listening composition marker drift: {role}")
    expected_pins = {EXACT.name: sha_bytes(exact), EVENTS.name: sha_bytes(events)}
    if semantic["canonicalContractPins"] != expected_pins:
        raise ValueError("semantic exact/event byte pins drift")
    if identity["canonicalContractPins"] != expected_pins:
        raise ValueError("identity exact/event byte pins drift")
    if semantic["sealedPayloadSha256"] != sealed_payload(semantic):
        raise ValueError("semantic registry seal drift")
    if identity["sealedPayloadSha256"] != sealed_payload(identity):
        raise ValueError("identity registry seal drift")
    if semantic.get("ownerDependencyContracts") != exact.get(
        "ownerDependencyContracts", []
    ):
        raise ValueError("semantic owner-dependency contract projection drift")
    dependency_ids = [
        row.get("dependencyContractId")
        for row in exact.get("ownerDependencyContracts", [])
    ]
    expected_dependency_bindings = _owner_dependency_semantic_bindings(exact)
    semantic_dependency_bindings = semantic.get(
        "ownerDependencySemanticBindings", []
    )
    semantic_dependency_ids = [
        row.get("dependencyContractId")
        for row in semantic_dependency_bindings
    ]
    if (
        len(dependency_ids) != len(set(dependency_ids))
        or semantic_dependency_ids != dependency_ids
        or semantic_dependency_bindings != expected_dependency_bindings
    ):
        raise ValueError("semantic owner-dependency full projection closure drift")
    _validate_business_identity_fields(exact, events)


def main() -> int:
    parser = argparse.ArgumentParser()
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--preview", action="store_true")
    group.add_argument("--write", action="store_true")
    group.add_argument("--check", action="store_true")
    args = parser.parse_args()
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    ssot_bytes = SSOT.read_bytes()
    current_ssot = json.loads(ssot_bytes)
    current_exact = json.loads(EXACT.read_text(encoding="utf-8"))
    current_events = json.loads(EVENTS.read_text(encoding="utf-8"))
    expected = compose_all(
        current_exact, current_events, current_ssot,
        hashlib.sha256(ssot_bytes).hexdigest(), manifest,
    )
    validate(*expected, manifest)
    paths = (EXACT, EVENTS, BINDINGS, IDENTITIES)
    encoded = tuple(render(value).encode("utf-8") for value in expected)
    if args.preview:
        print(
            "MODERN_SEMANTIC_IDENTITY_SUCCESSOR_PREVIEW=PASS"
            f" operations={len(expected[0]['operationBindings'])}"
            f" events={len(expected[1]['eventPayloadSchemas'])}"
            f" exactSha256={hashlib.sha256(encoded[0]).hexdigest()}"
            f" eventSha256={hashlib.sha256(encoded[1]).hexdigest()}"
            f" semanticSha256={hashlib.sha256(encoded[2]).hexdigest()}"
            f" identitySha256={hashlib.sha256(encoded[3]).hexdigest()}"
        )
        return 0
    if args.write:
        for path, value in zip(paths, encoded):
            path.write_bytes(value)
    mismatches = [path.name for path, value in zip(paths, encoded) if path.read_bytes() != value]
    if mismatches:
        raise ValueError("semantic/identity successor byte mismatch: " + ", ".join(mismatches))
    print("MODERN_SEMANTIC_IDENTITY_SUCCESSOR_CHECK=PASS")
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
