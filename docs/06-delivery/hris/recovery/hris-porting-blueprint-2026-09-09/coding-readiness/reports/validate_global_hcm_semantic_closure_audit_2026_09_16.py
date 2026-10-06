#!/usr/bin/env python3
"""Reproduce the independent global-HCM semantic audit against its pinned candidate.

PASS_AUDIT_SNAPSHOT_WITH_P0_FINDINGS means that the report is complete and
reproducible for the failed candidate.  It never means that the candidate is
coding-ready.
"""

from __future__ import annotations

import hashlib
import json
import re
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any


REPORT_DIR = Path(__file__).resolve().parent
ROOT = REPORT_DIR.parents[1]
REPORT_PATH = REPORT_DIR / "global-hcm-semantic-closure-independent-audit-2026-09-16.v1.json"
SSOT_PATH = ROOT / "coding-readiness/modern-capability-operation-causal-contract-ssot.v2.json"
EXACT_PATH = ROOT / "coding-readiness/modern-capability-exact-schema-contracts.v1.json"
EXPECTED_COMMON_ENTITY_FIELDS = {
    "publicId",
    "aggregateVersion",
    "state",
    "referenceEffectiveAt",
    "fieldPolicyRevision",
}
REQUIRED_CONTRACT_AXES = {"request", "response", "dml", "event", "handler", "schema"}


def load(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def add_error(errors: list[str], condition: bool, message: str) -> None:
    if not condition:
        errors.append(message)


def schema_by_ref(exact: dict[str, Any]) -> dict[str, dict[str, Any]]:
    schemas = exact["recordSchemas"] + exact["responseSchemas"]
    return {schema["schemaId"]: schema for schema in schemas}


def entity_schema_for(binding: dict[str, Any], schemas: dict[str, dict[str, Any]]) -> dict[str, Any]:
    response = schemas[binding["responseSchemaRef"]]
    for field in response.get("fields", []):
        if field.get("name") in {"item", "items"}:
            entity_ref = field.get("schemaRef") or field.get("itemSchemaRef")
            if entity_ref:
                return schemas[entity_ref]
    raise KeyError(f"no item/items entity schema: {binding['operationId']}")


def derive_generic_queries(
    exact: dict[str, Any],
) -> tuple[dict[str, list[str]], list[str], list[str]]:
    schemas = schema_by_ref(exact)
    by_capability: dict[str, list[str]] = defaultdict(list)
    ai_operations: list[str] = []
    ai_field_lists: list[list[str]] = []
    for binding in exact["operationBindings"]:
        if binding["mode"] != "QUERY":
            continue
        entity = entity_schema_for(binding, schemas)
        field_names = [field["name"] for field in entity.get("fields", [])]
        if set(field_names) == EXPECTED_COMMON_ENTITY_FIELDS and len(field_names) == 5:
            by_capability[binding["capabilityId"]].append(binding["operationId"])
        if binding["capabilityId"] == "HRIS.MODERN.GOVERNED_AI":
            ai_operations.append(binding["operationId"])
            ai_field_lists.append(field_names)
    for operations in by_capability.values():
        operations.sort()
    ai_operations.sort()
    addl = (
        [field for field in ai_field_lists[0] if field not in EXPECTED_COMMON_ENTITY_FIELDS]
        if ai_field_lists and all(fields == ai_field_lists[0] for fields in ai_field_lists)
        else []
    )
    return dict(sorted(by_capability.items())), ai_operations, addl


def allowed_states(table: dict[str, Any], state_column: str) -> list[str]:
    values: set[str] = set()
    for check in table.get("checks", []):
        if state_column not in check.get("columns", []):
            continue
        expression = check.get("expression", "")
        match = re.search(r"\bIN\s*\(([^)]*)\)", expression, re.IGNORECASE)
        if match:
            values.update(re.findall(r"'([^']+)'", match.group(1)))
    return sorted(values)


def derive_handler_mismatches(
    ssot: dict[str, Any], exact: dict[str, Any]
) -> list[dict[str, Any]]:
    tables = {table["tableName"]: table for table in exact["tableSpecifications"]}
    rows: list[dict[str, Any]] = []
    for handler in ssot["systemHandlers"]:
        aggregate = handler.get("aggregateRoot") or {}
        table_name = aggregate.get("table")
        state_column = aggregate.get("stateColumn")
        if table_name not in tables or not state_column:
            continue
        allowed = allowed_states(tables[table_name], state_column)
        pre_states = aggregate.get("preStates", [])
        post_states = aggregate.get("postStates", [])
        invalid_pre = sorted(set(pre_states) - set(allowed))
        invalid_post = sorted(set(post_states) - set(allowed))
        if invalid_pre or invalid_post:
            rows.append(
                {
                    "handlerId": handler["handlerId"],
                    "table": table_name,
                    "stateColumn": state_column,
                    "declaredPreStates": pre_states,
                    "declaredPostStates": post_states,
                    "allowedStates": allowed,
                    "invalidPreStates": invalid_pre,
                    "invalidPostStates": invalid_post,
                }
            )
    return rows


def derive_generic_async_handlers(
    ssot: dict[str, Any], exact: dict[str, Any]
) -> list[dict[str, Any]]:
    tables = {table["tableName"]: table for table in exact["tableSpecifications"]}
    rows: list[dict[str, Any]] = []
    for handler in ssot["systemHandlers"]:
        aggregate = handler.get("aggregateRoot") or {}
        if aggregate.get("preStates") != ["REQUESTED", "RUNNING"]:
            continue
        if aggregate.get("postStates") != ["COMPLETED", "FAILED"]:
            continue
        table_name = aggregate["table"]
        state_column = aggregate["stateColumn"]
        ddl_states = allowed_states(tables[table_name], state_column)
        event = handler.get("event") or {}
        compatible = set(aggregate["preStates"] + aggregate["postStates"]) <= set(ddl_states)
        rows.append(
            {
                "handlerId": handler["handlerId"],
                "capabilityId": handler["capabilityId"],
                "aggregateTable": table_name,
                "stateColumn": state_column,
                "declaredPreStates": aggregate["preStates"],
                "declaredPostStates": aggregate["postStates"],
                "ddlAllowedStates": ddl_states,
                "ddlLifecycleCompatible": compatible,
                "eventName": event.get("eventName"),
                "eventCondition": event.get("condition"),
                "semanticDisposition": (
                    "P0_PROJECTION_NOT_CREATED_OR_WRITTEN_AND_EVENT_UNREACHABLE"
                    if handler["handlerId"] == "internal.analytics.metric-projection.result.consume"
                    else "P0_STATE_AND_EVENT_CONTRACT"
                ),
            }
        )
    return rows


def condition_state(condition: str) -> str | None:
    match = re.fullmatch(r"toState=([A-Z0-9_]+)", condition or "")
    return match.group(1) if match else None


def derive_unreachable_events(
    ssot: dict[str, Any],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    commands: list[dict[str, Any]] = []
    handlers: list[dict[str, Any]] = []
    for operation in ssot["operations"]:
        post_states = (operation.get("transition") or {}).get("postStates", [])
        for event in operation.get("events", []):
            required = condition_state(event.get("condition", ""))
            if required is not None and required not in post_states:
                commands.append(
                    {
                        "operationId": operation["operationId"],
                        "eventName": event["eventName"],
                        "condition": event["condition"],
                        "allowedPostStates": sorted(post_states),
                    }
                )
    for handler in ssot["systemHandlers"]:
        event = handler.get("event")
        if not event:
            continue
        post_states = (handler.get("aggregateRoot") or {}).get("postStates", [])
        required = condition_state(event.get("condition", ""))
        if required is not None and required not in post_states:
            handlers.append(
                {
                    "handlerId": handler["handlerId"],
                    "eventName": event["eventName"],
                    "condition": event["condition"],
                    "declaredPostStates": post_states,
                }
            )
    return commands, handlers


def all_writers(ssot: dict[str, Any]) -> dict[str, list[dict[str, str]]]:
    writers: dict[str, list[dict[str, str]]] = defaultdict(list)
    for operation in ssot["operations"]:
        for dml in operation.get("orderedDml", []):
            if isinstance(dml, dict) and dml.get("table"):
                writers[dml["table"]].append(
                    {"producer": operation["operationId"], "action": dml.get("action", "")}
                )
    for handler in ssot["systemHandlers"]:
        for write in handler.get("writes", []):
            if isinstance(write, dict) and write.get("table"):
                writers[write["table"]].append(
                    {"producer": handler["handlerId"], "action": write.get("action", "")}
                )
    return writers


def derive_producerless_tables(
    ssot: dict[str, Any], exact: dict[str, Any]
) -> list[dict[str, str]]:
    writers = all_writers(ssot)
    return sorted(
        (
            {"capabilityId": table["capabilityId"], "table": table["tableName"]}
            for table in exact["tableSpecifications"]
            if table["tableName"] not in writers
        ),
        key=lambda row: (row["capabilityId"], row["table"]),
    )


def derive_update_only_roots(ssot: dict[str, Any]) -> dict[str, list[dict[str, str]]]:
    writers = all_writers(ssot)
    return {
        table: rows
        for table, rows in sorted(writers.items())
        if rows and all(row["action"].startswith("UPDATE") for row in rows)
    }


def anchor_exists(
    anchor: dict[str, Any], artifacts_by_basename: dict[str, dict[str, Any]]
) -> bool:
    artifact = artifacts_by_basename.get(anchor["artifact"])
    if artifact is None:
        return False
    selector = anchor["selector"]
    collection = artifact.get(selector["collection"])
    key = selector["key"]
    value = selector["value"]
    if isinstance(collection, list):
        return any(isinstance(item, dict) and item.get(key) == value for item in collection)
    if isinstance(collection, dict):
        if key == "name" and value in collection:
            return True
        return collection.get(key) == value
    return False


def main() -> int:
    errors: list[str] = []
    report = load(REPORT_PATH)

    artifacts_by_path: dict[str, dict[str, Any]] = {}
    artifacts_by_basename: dict[str, dict[str, Any]] = {}
    for pin in report["sourceSnapshot"]["artifacts"]:
        path = ROOT / pin["path"]
        add_error(errors, path.is_file(), f"missing pinned artifact: {pin['path']}")
        if not path.is_file():
            continue
        add_error(errors, sha256(path) == pin["sha256"], f"source hash drift: {pin['path']}")
        if path.suffix == ".json":
            loaded = load(path)
            artifacts_by_path[pin["path"]] = loaded
            artifacts_by_basename[path.name] = loaded

    ssot = load(SSOT_PATH)
    exact = load(EXACT_PATH)
    operations = ssot["operations"]
    handlers = ssot["systemHandlers"]
    counts = {
        "capabilities": len({operation["capabilityId"] for operation in operations}),
        "operations": len(operations),
        "commands": sum(operation["mode"] == "COMMAND" for operation in operations),
        "queries": sum(operation["mode"] == "QUERY" for operation in operations),
        "systemHandlers": len(handlers),
        "publicEvents": sum(len(operation.get("events", [])) for operation in operations)
        + sum(bool(handler.get("event")) for handler in handlers),
        "tableSpecifications": len(exact["tableSpecifications"]),
    }
    add_error(errors, counts == report["sourceSnapshot"]["derivedCounts"], "derived source counts differ")

    findings = report["findings"]
    finding_ids = [finding["id"] for finding in findings]
    add_error(errors, len(finding_ids) == len(set(finding_ids)), "duplicate finding id")
    add_error(errors, len(findings) == 24, "expected exactly 24 findings")
    add_error(errors, sum(f["severity"] == "P0" for f in findings) == 20, "expected exactly 20 P0 findings")
    add_error(errors, sum(f["severity"] == "P1" for f in findings) == 4, "expected exactly 4 P1 findings")
    for finding in findings:
        add_error(
            errors,
            set(finding.get("minimumCanonicalContract", {})) == REQUIRED_CONTRACT_AXES,
            f"incomplete six-axis contract: {finding['id']}",
        )
        add_error(errors, bool(finding.get("sourceAnchors")), f"missing source anchor: {finding['id']}")
        for anchor in finding.get("sourceAnchors", []):
            add_error(errors, anchor_exists(anchor, artifacts_by_basename), f"unresolved anchor: {finding['id']} {anchor}")

    capabilities = {operation["capabilityId"] for operation in operations}
    matrix = report["capabilityP0Matrix"]
    add_error(errors, set(matrix) == capabilities, "capability P0 matrix is not the exact 16-capability set")
    p0_ids = {finding["id"] for finding in findings if finding["severity"] == "P0"}
    for capability, ids in matrix.items():
        add_error(errors, bool(ids), f"capability has no P0: {capability}")
        add_error(errors, set(ids) <= p0_ids, f"capability matrix cites non-P0 finding: {capability}")

    enumeration = report["enumerations"]
    generic_by_capability, ai_operations, copied_ai_fields = derive_generic_queries(exact)
    generic = enumeration["genericQueryEntities"]
    add_error(errors, sum(map(len, generic_by_capability.values())) == 60, "derived generic query count is not 60")
    add_error(errors, generic["count"] == 60 and generic["totalQueries"] == 66, "reported query totals differ")
    add_error(errors, generic["operationsByCapability"] == generic_by_capability, "60 generic queries are not exhaustively enumerated")
    add_error(errors, set(generic["closedEntityFieldSet"]) == EXPECTED_COMMON_ENTITY_FIELDS, "generic entity field set differs")

    ai = enumeration["aiQuerySchemaCopy"]
    add_error(errors, ai["count"] == 6 and set(ai["operations"]) == set(ai_operations), "six AI queries are not exhaustively enumerated")
    add_error(errors, ai["copiedFields"] == copied_ai_fields, "AI entity field copies are not identical to the report")
    lineage_by_operation = {row["operationId"]: row for row in exact["operationFieldLineage"]}
    binding_by_operation = {row["operationId"]: row for row in exact["operationBindings"]}
    for row in ai["impossibleOrWrongLineage"]:
        binding = binding_by_operation[row["operationId"]]
        add_error(errors, row["source"].split(".", 1)[0] not in binding["readsTables"], f"AI lineage source is actually readable: {row}")
        add_error(errors, row["readPlan"] == binding["readsTables"], f"AI read plan drift: {row['operationId']}")
        add_error(errors, row["operationId"] in lineage_by_operation, f"missing AI field lineage row: {row['operationId']}")

    generic_async_rows = derive_generic_async_handlers(ssot, exact)
    reported_generic_async = enumeration["genericAsyncHandlers"]
    add_error(errors, len(generic_async_rows) == 17, "derived generic async handler count is not 17")
    add_error(
        errors,
        reported_generic_async["count"] == 17 and reported_generic_async["rows"] == generic_async_rows,
        "17 generic async handlers are not exhaustively enumerated",
    )
    handler_rows = derive_handler_mismatches(ssot, exact)
    reported_handlers = enumeration["handlerLifecycleMismatches"]
    add_error(errors, len(handler_rows) == 16, "derived handler mismatch count is not 16")
    add_error(errors, reported_handlers["count"] == 16 and reported_handlers["rows"] == handler_rows, "16 handler mismatches differ")

    command_events, handler_events = derive_unreachable_events(ssot)
    reported_events = enumeration["unreachableEventConditions"]
    add_error(errors, len(command_events) == 10, "derived command event mismatch count is not 10")
    add_error(errors, len(handler_events) == 17, "derived handler event mismatch count is not 17")
    add_error(errors, reported_events["commandEventCount"] == 10 and reported_events["commandEvents"] == command_events, "10 command events differ")
    add_error(errors, reported_events["handlerEventCount"] == 17 and reported_events["handlerEvents"] == handler_events, "17 handler events differ")

    producerless = derive_producerless_tables(ssot, exact)
    reported_producerless = enumeration["producerlessExactTables"]
    add_error(errors, len(producerless) == 30, "derived producerless-table count is not 30")
    add_error(errors, reported_producerless["count"] == 30 and sorted(reported_producerless["rows"], key=lambda row: (row["capabilityId"], row["table"])) == producerless, "30 producerless tables differ")

    update_only = derive_update_only_roots(ssot)
    reported_update_only = {row["table"]: row["writers"] for row in enumeration["updateOnlyRoots"]}
    add_error(errors, len(update_only) == 3, "derived update-only-root count is not 3")
    add_error(errors, reported_update_only == update_only, "three update-only roots differ")

    operation_by_id = {operation["operationId"]: operation for operation in operations}
    self_rows = enumeration["selfSubjectBindingsMissing"]["rows"]
    add_error(errors, enumeration["selfSubjectBindingsMissing"]["count"] == 18 and len(self_rows) == 18, "self-subject list is not exactly 18")
    for row in self_rows:
        operation = operation_by_id.get(row["operationId"])
        add_error(errors, operation is not None, f"unknown self-subject operation: {row['operationId']}")
        if operation:
            serialized = json.dumps(operation, sort_keys=True)
            add_error(errors, row["requiredBinding"] not in serialized, f"reported missing self binding is already present: {row['operationId']}")

    # Every affected exact identifier must resolve.  This catches hand-edited drift
    # even for semantic findings that intentionally require human domain judgment.
    handler_by_id = {handler["handlerId"]: handler for handler in handlers}
    table_names = {table["tableName"] for table in exact["tableSpecifications"]}
    event_names = {
        event["eventName"] for operation in operations for event in operation.get("events", [])
    } | {handler["event"]["eventName"] for handler in handlers if handler.get("event")}
    for finding in findings:
        for operation_id in finding.get("affectedOperations", []):
            add_error(errors, operation_id in operation_by_id, f"unknown affected operation: {finding['id']} {operation_id}")
        for handler_id in finding.get("affectedHandlers", []):
            add_error(errors, handler_id in handler_by_id, f"unknown affected handler: {finding['id']} {handler_id}")
        for table_name in finding.get("affectedTables", []):
            add_error(errors, table_name in table_names, f"unknown affected table: {finding['id']} {table_name}")
        for event_name in finding.get("affectedEvents", []):
            add_error(errors, event_name in event_names, f"unknown affected event: {finding['id']} {event_name}")

    summary = {
        "auditId": report["auditId"],
        "candidateVerdict": report["verdict"],
        "sourceCounts": counts,
        "findings": {"P0": 20, "P1": 4},
        "finiteEnumerations": {
            "genericQueryEntities": 60,
            "aiQuerySchemaCopies": 6,
            "genericAsyncHandlers": 17,
            "handlerLifecycleMismatches": 16,
            "unreachableCommandEvents": 10,
            "unreachableHandlerEvents": 17,
            "producerlessExactTables": 30,
            "updateOnlyRoots": 3,
            "selfSubjectBindingsMissing": 18,
        },
        "reportSha256": sha256(REPORT_PATH),
        "errors": errors,
    }
    print(json.dumps(summary, ensure_ascii=False, sort_keys=True))
    if errors:
        print("FAIL_AUDIT_SNAPSHOT", file=sys.stderr)
        return 1
    print("PASS_AUDIT_SNAPSHOT_WITH_P0_FINDINGS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
