#!/usr/bin/env python3
"""Project the reviewed, candidate-owned 100-operation causal SSOT.

The source JSON is a checked-in candidate artifact.  This module deliberately
does not import or open the independent oracle, its builder, fixtures, or
reports.  The independent validator remains the acceptance authority.
"""

from __future__ import annotations

import copy
import hashlib
import json
from collections import Counter
from pathlib import Path
from typing import Any

from sys_listening_canonical_design import composition_marker
from modern_successor_reader_guard import require_active_reader_guard


HERE = Path(__file__).resolve().parent
SSOT = HERE / "modern-capability-operation-causal-contract-ssot.v2.json"
SSOT_SHA256 = "ac5ab13730c77267d6d7433b9e567560f0511c18d9255e879a7bb1c6c2286790"
HANDLER_OWNERS = {
    "internal.recruiting.hire-handoff.acknowledge": (
        "HRIS.MODERN.RECRUITING_ATS", "HRIS-HRM"
    ),
    "internal.contingent.access-expiry.enforce": (
        "HRIS.MODERN.CONTINGENT_WORKFORCE", "HRIS-HRM"
    ),
    "internal.wfm.schedule-optimization.complete": (
        "HRIS.MODERN.ADVANCED_WFM", "HRIS-TIM"
    ),
    "internal.ai.policy-evaluation.complete": (
        "HRIS.MODERN.GOVERNED_AI", "HRIS-SYS"
    ),
}
EVENT_OWNER_REFERENCE_IDENTITIES = {
    "ownerRefetch.Approval.DecisionReceipt.publicId": "Approval.DecisionReceipt",
    "ownerRefetch.TIM.DemandForecast.publicId": "TIM.DemandForecast",
    "ownerAck.canonicalSchedulePeriodPublicId": "TIM.SchedulePeriod",
    "ownerRefetch.SYS.AiUsePolicy.publicId": "SYS.AiUsePolicy",
}


def _owned_handler(handler: dict[str, Any]) -> dict[str, Any]:
    capability, session = HANDLER_OWNERS[handler["handlerId"]]
    return {**copy.deepcopy(handler), "capabilityId": capability, "session": session}


def load_candidate_ssot() -> dict[str, Any]:
    require_active_reader_guard(__file__)
    if hashlib.sha256(SSOT.read_bytes()).hexdigest() != SSOT_SHA256:
        raise ValueError("candidate operation causal SSOT byte seal drift")
    value = json.loads(SSOT.read_text(encoding="utf-8"))
    if (
        value.get("status") != "SEALED_G3_DESIGN_NOT_IMPLEMENTED"
        or value.get("implementationState") != "NOT_STARTED_G3"
        or value.get("productionState") != "NOT_AUTHORIZED_G6"
        or len(value.get("operations", [])) != 100
        or Counter(row.get("mode") for row in value["operations"])
        != Counter({"COMMAND": 81, "QUERY": 19})
        or len(value.get("systemHandlers", [])) != 4
        or len(value.get("publicEventOwnership", {}).get("events", [])) != 86
        or value.get("listeningCanonicalComposition")
        != composition_marker("operationCausal")
    ):
        raise ValueError("candidate operation causal SSOT scope/status drift")
    return value


def _field_from_request(row: dict[str, Any]) -> dict[str, Any]:
    result = {
        key: copy.deepcopy(value)
        for key, value in row.items()
        if key not in {"source", "location"}
    }
    result.setdefault("validation", "reviewed typed request contract")
    return result


def _physical_tables(operation: dict[str, Any]) -> list[str]:
    result: list[str] = []
    for step in operation.get("orderedDml", []):
        if step.get("role") in {"COMMAND_RECEIPT", "TRANSACTIONAL_OUTBOX"}:
            continue
        if step.get("action") == "CALL_OWNER_PORT" or not step.get("table"):
            continue
        if step["table"] not in result:
            result.append(step["table"])
    return result


def _physical_reads(operation: dict[str, Any], physical_table_names: set[str]) -> list[str]:
    result: list[str] = []
    for table in operation.get("readPlan", {}).get("tables", []):
        if table in physical_table_names and table not in result:
            result.append(table)
    writes = set(_physical_tables(operation))
    for selector in operation.get("selectors", []):
        table = selector.get("targetTable")
        if table in physical_table_names and table not in writes and table not in result:
            result.append(table)
    for event in operation.get("events", []):
        for field in event.get("fields", []):
            source = str(field.get("source", ""))
            table = source.split(".", 1)[0]
            if table in physical_table_names and table not in writes and table not in result:
                result.append(table)
    return result


def _column(
    name: str,
    sql_type: str,
    *,
    nullable: bool = False,
) -> dict[str, Any]:
    sensitivity = "RESTRICTED" if name.endswith(("public_id", "receipt_id")) else "INTERNAL"
    tokenization = (
        "NONREVERSIBLE_DIGEST"
        if name.endswith(("digest", "hash"))
        else "OPAQUE_PUBLIC_ID"
        if name.endswith(("public_id", "receipt_id"))
        else "NONE"
    )
    return {
        "name": name,
        "sqlType": sql_type,
        "nullable": nullable,
        "default": None,
        "sensitivity": sensitivity,
        "tokenization": tokenization,
        "source": "REVIEWED_OPERATION_CAUSAL_SSOT_V2",
    }


def _value_object(schema_id: str, target: dict[str, Any]) -> dict[str, Any]:
    fields: list[dict[str, Any]] = []
    for source in target.get("fields", []):
        field = copy.deepcopy(source)
        field.setdefault("validation", "validated typed closed value-object member")
        field.setdefault("sensitivity", "INTERNAL")
        field.setdefault("tokenization", "NONE")
        fields.append(field)
    return {
        "schemaId": schema_id,
        "kind": "OBJECT",
        "additionalProperties": False,
        "fields": fields,
        "serverGeneratedFields": copy.deepcopy(target.get("serverGeneratedFields", [])),
    }


def _event_schema(existing: dict[str, Any], event: dict[str, Any], operation: dict[str, Any]) -> dict[str, Any]:
    result = copy.deepcopy(existing)
    event_name = event["eventName"]
    event_type, raw_version = event_name.rsplit(".v", 1)
    if not raw_version.isdigit() or int(raw_version) < 1:
        raise ValueError(f"event version is not explicit: {event_name}")
    event_version = int(raw_version)
    result.update({
        "eventName": event_name,
        "capabilityId": operation["capabilityId"],
        "session": operation["session"],
        "eventType": event_type,
        "schemaVersion": event_version,
        "payloadSchemaId": event_type + f".Payload.v{event_version}",
        "additionalProperties": False,
        "fields": [],
        "emittedByOperationIds": [operation["operationId"]]
        if operation.get("operationId") else [],
        "emittedByInternalHandlerIds": [operation["handlerId"]]
        if operation.get("handlerId") else [],
        "emissionCondition": event.get("condition", "ALWAYS"),
        "causalRule": "SAME_TRANSACTION_POST_COMMIT_ROOT_SNAPSHOT_ONLY",
    })
    result.setdefault(
        "topic", "dwp.hris.modern." + event_type.lower() + f".v{event_version}"
    )
    for source in event.get("fields", []):
        field = copy.deepcopy(source)
        raw = str(field.get("source", ""))
        if raw in EVENT_OWNER_REFERENCE_IDENTITIES and "referenceContract" not in field:
            field["referenceContract"] = {
                "entityType": EVENT_OWNER_REFERENCE_IDENTITIES[raw],
                "idSpace": "PUBLIC_UUID",
            }
        if raw.startswith(("ppl_", "prf_", "tme_", "sys_hris_")) and "." in raw:
            field["sourcePhysicalField"] = raw
        elif raw.startswith("context."):
            field["sourceOwnerContext"] = raw
        elif raw.startswith("LOCKED_PRE:"):
            field["sourceTransitionPhase"] = "PRE"
            field["sourcePhysicalField"] = raw.removeprefix("LOCKED_PRE:")
        elif raw.startswith("CONSTANT:"):
            field["sourceOwnerContext"] = raw
        elif raw:
            field["sourceOwnerContext"] = raw
        result["fields"].append(field)
    audience = event["audience"]
    refetch = event["refetchContract"]
    cross = len(audience["allowedConsumerSessions"]) > 1
    pep: Any = "SVC-PEP-PER-001" if event_name == "ApprovedCompensationPlanSnapshotPublished.v2" \
        else "SAME_BOUNDED_CONTEXT_EVENT_PEP_V1"
    result["deliveryPolicy"] = {
        "audience": "EXPLICIT_CROSS_SESSION_ALLOWLIST" if cross else "SAME_BOUNDED_CONTEXT_ONLY",
        "classification": audience.get("classification", "INTERNAL_DOMAIN"),
        "allowedConsumerSessions": copy.deepcopy(audience["allowedConsumerSessions"]),
        "allowedPurposeCodes": copy.deepcopy(audience["allowedPurposes"]),
        "pep": pep,
        "fieldAllowlist": [field["name"] for field in event["fields"]],
        "restrictedFields": [
            field["name"] for field in event["fields"]
            if field.get("sensitivity") in {"RESTRICTED", "CONFIDENTIAL", "HIGHLY_RESTRICTED"}
        ],
        "sensitivePayloadRule": "EXACT_REVIEWED_FIELD_ALLOWLIST_WITH_FIELD_CLASSIFICATION",
        "denyUnknownConsumerOrPurpose": True,
    }
    result["consumerRefetchPolicy"] = {
        "allowed": refetch.get("mode") != "FORBIDDEN",
        "mode": refetch.get("mode"),
        "ownerSession": refetch.get("ownerSession"),
        "entityType": refetch.get("entityType"),
        "endpoint": refetch.get("endpoint"),
        "allowedConsumerSessions": copy.deepcopy(
            refetch.get("pep", {}).get("consumerSessionAllowlist", [])
        ),
        "purposeCodes": copy.deepcopy(refetch.get("pep", {}).get("purpose", [])),
        "pep": pep,
        "pepContract": copy.deepcopy(refetch.get("pep")),
        "fieldAllowlist": copy.deepcopy(refetch.get("allowedFields", [])),
        "ownerKey": "snapshotId" if event_name == "ApprovedCompensationPlanSnapshotPublished.v2" else None,
        "versionField": "snapshotRevision" if event_name == "ApprovedCompensationPlanSnapshotPublished.v2" else None,
        "version": refetch.get("version"),
        "asOf": refetch.get("asOf"),
        "rule": refetch.get("version", "CROSS_SESSION_REFETCH_FORBIDDEN"),
    }
    return result


def apply_reviewed_exact_projection(exact: dict[str, Any], events: dict[str, Any]) -> None:
    ssot = load_candidate_ssot()
    targets = {row["operationId"]: row for row in ssot["operations"]}
    operations = {row["operationId"]: row for row in exact["operationBindings"]}
    if set(targets) != set(operations):
        raise ValueError("candidate operation SSOT/exact operation closed-set drift")

    tables = {row["tableName"]: row for row in exact["tableSpecifications"]}
    expected_tables = set(ssot["schemaOracle"]["expectedTables"])
    if set(tables) != expected_tables:
        raise ValueError("candidate operation SSOT/exact 71-table closed-set drift")
    common_names = {row["name"] for row in exact["commonTableContract"]["columns"]}
    for table_name, delta in ssot["schemaOracle"]["requiredTableColumnCheckDeltas"].items():
        table = tables[table_name]
        forbidden_columns = set(delta.get("forbiddenColumns", []))
        if forbidden_columns:
            table["columns"] = [
                row for row in table["columns"] if row["name"] not in forbidden_columns
            ]
            for collection in ("checks", "uniqueKeys", "indexes", "foreignKeys"):
                table[collection] = [
                    row for row in table.get(collection, [])
                    if not forbidden_columns.intersection(row.get("columns", []))
                ]
        columns = {row["name"]: row for row in table["columns"]}
        for column_name, sql_type in delta.get("requiredColumns", {}).items():
            if column_name in common_names or column_name == table["idColumn"]["name"]:
                continue
            if column_name not in columns:
                table["columns"].append(_column(column_name, sql_type))
            else:
                columns[column_name]["sqlType"] = sql_type
        for column_name, entity_type in delta.get("requiredOpaqueReferences", {}).items():
            if column_name not in columns:
                raise ValueError(f"opaque reference targets absent column: {table_name}.{column_name}")
            columns[column_name]["referenceContract"] = {
                "entityType": entity_type, "idSpace": "PUBLIC_UUID",
            }
            matching = next(
                (row for row in table.get("foreignKeys", [])
                 if row.get("mode") == "OPAQUE_CROSS_BOUNDARY_REFERENCE"
                 and row.get("columns") == [column_name]),
                None,
            )
            if matching is None:
                table.setdefault("foreignKeys", []).append({
                    "mode": "OPAQUE_CROSS_BOUNDARY_REFERENCE",
                    "columns": [column_name],
                    "target": entity_type,
                    "constraintId": f"fk_{table_name}_{column_name}_owner_v2",
                })
            else:
                matching["target"] = entity_type
        state_check = delta.get("stateCheck")
        if state_check:
            column_name = state_check["column"]
            state_column = columns.get(column_name)
            if state_column is not None and state_check.get("defaultState"):
                state_column["default"] = repr(state_check["defaultState"])
            table["checks"] = [
                row for row in table.get("checks", [])
                if column_name not in row.get("columns", [])
            ]
            allowed = ",".join(f"'{value}'" for value in state_check["allowed"])
            table["checks"].append({
                "constraintId": f"ck_{table_name}_{column_name}_reviewed_v2",
                "expression": f"{column_name} IN ({allowed})",
                "columns": [column_name],
            })
        for check in delta.get("requiredChecks", []):
            table["checks"] = [
                row for row in table.get("checks", [])
                if row.get("constraintId") != check["constraintId"]
            ]
            table["checks"].append(copy.deepcopy(check))
        for index in delta.get("requiredIndexes", []):
            table["indexes"] = [
                row for row in table.get("indexes", [])
                if row.get("indexId") != index["indexId"]
            ]
            table["indexes"].append(copy.deepcopy(index))
    # An explicitly absent optional request branch must remain representable in
    # the physical row.  The reviewed DML marks these sinks with ``IF PRESENT``;
    # derive nullability from that assignment instead of maintaining a second
    # hand-written nullable-column list.
    for target in targets.values():
        for input_effect in target.get("inputEffects", []):
            if input_effect.get("required") is not False:
                continue
            for effect in input_effect.get("effects", []):
                physical_target = effect.get("target", "")
                if effect.get("kind") != "PERSISTED_COLUMN" or "." not in physical_target:
                    continue
                table_name, column_name = physical_target.split(".", 1)
                if table_name in tables:
                    column = next(
                        (row for row in tables[table_name]["columns"] if row["name"] == column_name),
                        None,
                    )
                    if column is not None:
                        column["nullable"] = True
        for step in target.get("orderedDml", []):
            table_name = step.get("table")
            if table_name not in tables:
                continue
            for column_name, expression in step.get("assignments", {}).items():
                if "IF PRESENT" not in str(expression):
                    continue
                column = next(
                    (row for row in tables[table_name]["columns"] if row["name"] == column_name),
                    None,
                )
                if column is not None:
                    column["nullable"] = True
    # A lifecycle field that is populated only by a later command (approval,
    # completion, publication, revocation, and similar facts) cannot be a
    # NOT-NULL/no-default requirement on the aggregate's creation path.  The
    # reviewed ordered DML is the authority: if any physical create/append path
    # omits a business column, absence is a real stored state for that phase.
    create_assignment_sets: dict[str, list[set[str]]] = {}
    for target in targets.values():
        for step in target.get("orderedDml", []):
            if step.get("action") not in {"INSERT", "APPEND", "APPEND_MANY"}:
                continue
            table_name = step.get("table")
            if table_name in tables:
                create_assignment_sets.setdefault(table_name, []).append(
                    set(step.get("assignments", {}))
                )
    for table_name, assignment_sets in create_assignment_sets.items():
        for column in tables[table_name]["columns"]:
            if column.get("default") is not None:
                continue
            if any(column["name"] not in assignments for assignments in assignment_sets):
                column["nullable"] = True
    record_by_id = {row["schemaId"]: row for row in exact["recordSchemas"]}
    for schema_id, target in ssot["valueObjects"].items():
        record_by_id[schema_id] = _value_object(schema_id, target)
    exact["recordSchemas"] = list(record_by_id.values())

    physical_names = set(tables)
    for operation_id, operation in operations.items():
        target = targets[operation_id]
        sections = {name: [] for name in ("pathParameters", "queryParameters", "headers", "body")}
        for request_field in target["requestFields"]:
            sections[request_field["location"]].append(_field_from_request(request_field))
        operation["requestSchema"].update(sections)
        operation.update({
            "method": target["method"],
            "path": target["path"],
            "authorizationCapability": target["authorizationCapability"],
            "mode": target["mode"],
            "readsTables": _physical_reads(target, physical_names),
            "writesTables": _physical_tables(target),
            "stateTransitionIds": [target["transition"]["transitionId"]]
            if target["mode"] == "COMMAND" else [],
            "eventNames": [event["eventName"] for event in target.get("events", [])],
            "aggregateRootTable": target.get("aggregateRoot", {}).get("table"),
        })

    existing_events = {row["eventName"]: row for row in events["eventPayloadSchemas"]}
    projected_events: list[dict[str, Any]] = []
    for target in ssot["operations"]:
        for event in target.get("events", []):
            projected_events.append(_event_schema(existing_events.get(event["eventName"], {}), event, target))
    for raw_handler in ssot["systemHandlers"]:
        handler = _owned_handler(raw_handler)
        event = handler.get("event")
        if event:
            projected_events.append(_event_schema(existing_events.get(event["eventName"], {}), event, handler))
    if len(projected_events) != 86 or len({row["eventName"] for row in projected_events}) != 86:
        raise ValueError("candidate reviewed public event closed set must be 86")
    events["eventPayloadSchemas"] = projected_events
    events["scope"].update({
        "operations": 100,
        "commands": 81,
        "queries": 19,
        "publicCommandPrimaryEvents": 81,
        "conditionalCommandEvents": 1,
        "internalHandlerEvents": 4,
        "events": 86,
        "implementationState": "NOT_STARTED_G3",
        "productionState": "NOT_AUTHORIZED_G6",
    })
    exact["internalConsumerHandlers"] = [
        _exact_handler(_owned_handler(row)) for row in ssot["systemHandlers"]
    ]


def _normalize_action(action: str) -> str:
    return {"UPDATE_CAS": "UPDATE"}.get(action, action)


def _causal_input_effect(effect: dict[str, Any]) -> dict[str, Any]:
    result = copy.deepcopy(effect)
    result["causalEffect"] = "OBSERVABLE_EFFECT_SET_NO_GUARD_ONLY_FALLBACK"
    for sink in result.get("effects", []):
        if sink.get("kind") == "PERSISTED_DECISION_RECEIPT":
            sink["executionProof"] = (
                "sameTransaction persisted rule input digest/ref outcome decisionVersion "
                "and mutation dependency"
            )
    return result


def _exact_handler(handler: dict[str, Any]) -> dict[str, Any]:
    event = handler["event"]
    root = handler["aggregateRoot"]
    writes = {
        row["table"]: _normalize_action(row["action"])
        for row in handler.get("writes", [])
        if row.get("action") != "CALL_OWNER_PORT"
    }
    business_facts = [
        (field["name"], field["source"])
        for field in event["fields"]
        if field["name"] not in {
            "aggregateId", "fromState", "toState", "aggregateVersion", "occurredAt", "correlationId"
        }
    ]
    audience = event["audience"]
    owner_assertions = copy.deepcopy(handler.get("ownerAssertions", []))
    if not owner_assertions:
        # The reviewed handler protocol stores owner-result guards as ordered
        # lock/verify/validate steps. Project them explicitly into the module
        # transition instead of manufacturing an unguarded state change.
        owner_assertions = [
            str(step) for step in handler.get("orderedDml", [])
            if str(step).lower().startswith(("lock ", "verify ", "validate "))
        ]
    if not owner_assertions:
        raise ValueError(f"handler lacks an owner-result guard: {handler['handlerId']}")
    return {
        "handlerId": handler["handlerId"],
        "capabilityId": handler["capabilityId"],
        "session": handler["session"],
        "trigger": copy.deepcopy(handler.get("trigger", {})),
        "aggregateRootTable": root["table"],
        "stateColumn": root["stateColumn"],
        "preStates": copy.deepcopy(root["preStates"]),
        "postStates": copy.deepcopy(root["postStates"]),
        "transitionId": handler.get("transitionId", "HANDLER-" + handler["handlerId"].upper()),
        "readsTables": copy.deepcopy(handler.get("readsTables", [])),
        "writesTables": list(writes),
        "writeDispositions": writes,
        "emits": [event["eventName"]],
        "facts": business_facts,
        "ownerAssertions": owner_assertions,
        "idempotency": {
            "key": copy.deepcopy(handler["idempotency"]),
            "scope": "TENANT_HANDLER_EVENT_VERSION",
            "duplicateResult": "RETURN_PRIOR_COMMITTED_RESULT_WITHOUT_DOMAIN_OR_OUTBOX_WRITE",
        },
        "policy": {
            "allowedConsumerSessions": copy.deepcopy(audience["allowedConsumerSessions"]),
            "purposeCodes": copy.deepcopy(audience["allowedPurposes"]),
            "pep": "SAME_BOUNDED_CONTEXT_EVENT_PEP_V1",
            "refetchAllowed": False,
        },
        "orderedTransactionSteps": [
            "ATOMIC INBOX CLAIM",
            *[f"{row['action']} {row['table']}" for row in handler.get("writes", [])],
            f"APPEND {event['eventName']} OUTBOX",
            "ROLLBACK ALL ON ANY FAILURE",
        ],
        "failureSemantics": "ATOMIC ROLLBACK; NO PARTIAL DOMAIN OR OUTBOX FACT",
    }


def _event_source_kind(field: dict[str, Any], writes: set[str]) -> str:
    raw = str(field.get("source", ""))
    source_kind = field.get("sourceKind")
    if source_kind == "TRACE_CONTEXT":
        return "OWNER_TRANSACTION_CONTEXT"
    if source_kind == "OWNER_TRANSACTION_CLOCK":
        return "OWNER_TRANSACTION_CONTEXT"
    if source_kind in {"LOCKED_PRE_STATE", "DERIVED_DOMAIN_FACT"}:
        return "TRANSITION_SNAPSHOT"
    if "." in raw and raw.split(".", 1)[0] in writes:
        return "SAME_TRANSACTION_WRITE"
    if "." in raw and not raw.startswith("context."):
        return "DECLARED_OWNER_REFETCH"
    return "OWNER_TRANSACTION_CONTEXT"


def _causal_event(event: dict[str, Any], writes: set[str]) -> dict[str, Any]:
    fields = event["fields"]
    sources = {field["name"]: field for field in fields}
    audience = event["audience"]
    refetch = event["refetchContract"]
    cross = len(audience["allowedConsumerSessions"]) > 1
    pep = "SVC-PEP-PER-001" if event["eventName"] == "ApprovedCompensationPlanSnapshotPublished.v2" \
        else "SAME_BOUNDED_CONTEXT_EVENT_PEP_V1"
    return {
        "eventName": event["eventName"],
        "eventType": event["eventName"].rsplit(".v", 1)[0],
        "aggregateEntityType": event["aggregateEntityType"],
        "aggregateIdSource": sources["aggregateId"]["source"],
        "aggregateVersionSource": sources["aggregateVersion"]["source"],
        "postStateSource": sources["toState"]["source"],
        "emissionBoundary": "AFTER_COMMIT_OUTBOX_SAME_TRANSACTION",
        "emissionCondition": event.get("condition", "ALWAYS"),
        "foreignBusinessReferences": [
            {
                "field": field["name"],
                "entityType": field.get("referenceContract", {}).get("entityType"),
                "idSpace": field.get("referenceContract", {}).get("idSpace"),
                "sourceKind": field.get("sourceKind"),
                "source": field.get("source"),
            }
            for field in fields
            if field.get("referenceContract") and field["name"] != "aggregateId"
        ],
        "payloadFields": [field["name"] for field in fields],
        "payloadFieldSources": [
            {
                "field": field["name"],
                "source": field["source"],
                "sourceKind": _event_source_kind(field, writes),
            }
            for field in fields
        ],
        "deliveryPolicy": {
            "audience": "EXPLICIT_CROSS_SESSION_ALLOWLIST" if cross else "SAME_BOUNDED_CONTEXT_ONLY",
            "allowedConsumerSessions": copy.deepcopy(audience["allowedConsumerSessions"]),
            "allowedPurposeCodes": copy.deepcopy(audience["allowedPurposes"]),
            "pep": pep,
            "fieldAllowlist": [field["name"] for field in fields],
            "restrictedFields": [
                field["name"] for field in fields
                if field.get("sensitivity") in {"RESTRICTED", "CONFIDENTIAL", "HIGHLY_RESTRICTED"}
            ],
            "sensitivePayloadRule": "EXACT_REVIEWED_FIELD_ALLOWLIST_WITH_FIELD_CLASSIFICATION",
            "denyUnknownConsumerOrPurpose": True,
        },
        "consumerRefetch": {
            "allowed": refetch.get("mode") != "FORBIDDEN",
            "mode": refetch.get("mode"),
            "ownerSession": refetch.get("ownerSession"),
            "entityType": refetch.get("entityType"),
            "endpoint": refetch.get("endpoint"),
            "allowedConsumerSessions": copy.deepcopy(
                refetch.get("pep", {}).get("consumerSessionAllowlist", [])
            ),
            "purposeCodes": copy.deepcopy(refetch.get("pep", {}).get("purpose", [])),
            "pep": pep,
            "pepContract": copy.deepcopy(refetch.get("pep")),
            "fieldAllowlist": copy.deepcopy(refetch.get("allowedFields", [])),
            "allowedFields": copy.deepcopy(refetch.get("allowedFields", [])),
            "version": refetch.get("version"),
            "asOf": refetch.get("asOf"),
            "rule": refetch.get("version", "CROSS_SESSION_REFETCH_FORBIDDEN"),
        },
    }


def _assignment_rows(
    step: dict[str, Any],
    columns: dict[str, dict[str, dict[str, Any]]],
) -> list[dict[str, Any]]:
    table = step.get("table")
    return [
        {
            "target": f"{table}.{column}",
            "sourcePath": str(source),
            "sourceKind": "REVIEWED_OPERATION_CAUSAL_SOURCE",
            "sqlType": columns.get(table, {}).get(column, {}).get("sqlType", "OWNER_PORT"),
        }
        for column, source in step.get("assignments", {}).items()
    ]


def _row_count_contract(disposition: str) -> str:
    if disposition == "APPEND_MANY":
        return "EXACT_VALIDATED_COLLECTION_CARDINALITY"
    return "EXACTLY_ONE"


def _transaction_assignments(
    template: dict[str, Any], target: dict[str, Any], event: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """Expand one reviewed owner-infrastructure profile into an exact step.

    Profiles live in the candidate SSOT so the projection has no hidden table
    aliases.  Expansion only substitutes identifiers already fixed by the
    operation or handler; it never infers columns from naming conventions.
    """
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
    rows: list[dict[str, Any]] = []
    for column, raw_source in template.items():
        source = str(raw_source)
        for token, value in replacements.items():
            source = source.replace(token, value)
        rows.append({"column": column, "sourcePath": source})
    return rows


def _command_transaction_envelope(
    target: dict[str, Any], ordered: list[dict[str, Any]], events: list[dict[str, Any]],
    profile: dict[str, Any],
) -> dict[str, Any]:
    """Materialize the receipt→domain→completion→outbox order per command."""
    base = copy.deepcopy(target["transactionEnvelope"])
    steps: list[dict[str, Any]] = [{
        "step": 1,
        "stage": "CLAIM_OR_REPLAY_COMMAND_RECEIPT",
        "table": profile["receiptTable"],
        "action": "INSERT_OR_RETURN_EXISTING_BY_TENANT_CALLER_OPERATION_KEY",
        "rowCount": "ZERO_ON_IDENTICAL_REPLAY_OTHERWISE_EXACTLY_ONE_CLAIM",
        "sameTransaction": True,
        "failureAfterStep": "ROLLBACK_RECEIPT_DOMAIN_DECISION_AND_OUTBOX",
        "assignments": _transaction_assignments(
            profile["receiptClaimAssignments"], target
        ),
    }]
    for dml in ordered:
        steps.append({
            "step": len(steps) + 1,
            "stage": "DOMAIN_DML",
            "table": dml["table"],
            "disposition": dml["disposition"],
            "assignments": copy.deepcopy(dml["assignments"]),
            "rowCount": _row_count_contract(dml["disposition"]),
            "sameTransaction": True,
            "failureAfterStep": "ROLLBACK_RECEIPT_DOMAIN_DECISION_AND_OUTBOX",
        })
    steps.extend([
        {
            "step": len(steps) + 1,
            "stage": "COMPLETE_COMMAND_RECEIPT",
            "table": profile["receiptTable"],
            "action": "PERSIST_CLOSED_RESULT_REFERENCE_AND_DECISION_RECEIPTS",
            "rowCount": "EXACTLY_ONE_CLAIMED_RECEIPT",
            "sameTransaction": True,
            "failureAfterStep": "ROLLBACK_RECEIPT_DOMAIN_DECISION_AND_OUTBOX",
            "assignments": _transaction_assignments(
                profile["receiptCompleteAssignments"], target
            ),
        },
        {
            "step": len(steps) + 2,
            "stage": "APPEND_CAUSAL_OUTBOX_LAST",
            "table": profile["outboxTable"],
            "action": "APPEND_MATCHED_PRIMARY_AND_CONDITIONAL_FACTS",
            "events": [
                {"eventName": event["eventName"], "condition": event["emissionCondition"]}
                for event in events
            ],
            "rowCount": "EXACT_MATCHED_EVENT_CARDINALITY",
            "sameTransaction": True,
            "failureAfterStep": "ROLLBACK_RECEIPT_DOMAIN_DECISION_AND_OUTBOX",
            "assignments": _transaction_assignments(
                profile["outboxAssignments"], target
            ),
        },
    ])
    base.update({
        "sameTransaction": True,
        "stepOrder": "RECEIPT_CLAIM_FIRST_DOMAIN_DML_THEN_RECEIPT_COMPLETION_OUTBOX_LAST",
        "receiptTable": profile["receiptTable"],
        "outboxTable": profile["outboxTable"],
        "steps": steps,
        "atomicity": base["rollback"],
        "idempotentReplay": base["replay"]["identicalDigest"],
        "staleVersion": "ROOT_CAS_ROW_COUNT_ZERO_RETURNS_409_AND_ROLLS_BACK_ALL_STEPS",
        "tenantMismatch": "TENANT_PREDICATE_ROW_COUNT_ZERO_RETURNS_OPAQUE_404_AND_ROLLS_BACK_ALL_STEPS",
    })
    return base


def _handler_transaction_envelope(
    target: dict[str, Any], ordered: list[dict[str, Any]], event: dict[str, Any],
    profile: dict[str, Any],
) -> dict[str, Any]:
    steps: list[dict[str, Any]] = [{
        "step": 1,
        "stage": "CLAIM_OR_REPLAY_DURABLE_OWNER_INBOX",
        "table": profile["inboxTable"],
        "action": "INSERT_OR_RETURN_EXISTING_BY_TENANT_HANDLER_EVENT_VERSION",
        "rowCount": "ZERO_ON_IDENTICAL_REPLAY_OTHERWISE_EXACTLY_ONE_CLAIM",
        "sameTransaction": True,
        "failureAfterStep": "ROLLBACK_INBOX_DOMAIN_AND_OUTBOX",
        "assignments": _transaction_assignments(
            profile["inboxClaimAssignments"], target, event
        ),
    }]
    for dml in ordered:
        steps.append({
            "step": len(steps) + 1,
            "stage": "DOMAIN_DML",
            "table": dml["table"],
            "disposition": dml["disposition"],
            "assignments": copy.deepcopy(dml["assignments"]),
            "rowCount": _row_count_contract(dml["disposition"]),
            "sameTransaction": True,
            "failureAfterStep": "ROLLBACK_INBOX_DOMAIN_AND_OUTBOX",
        })
    steps.extend([
        {
            "step": len(steps) + 1,
            "stage": "COMPLETE_DURABLE_OWNER_INBOX",
            "table": profile["inboxTable"],
            "action": "MARK_OWNER_EVENT_VERSION_PROCESSED_WITH_RESULT_REFERENCE",
            "rowCount": "EXACTLY_ONE_CLAIMED_INBOX_ROW",
            "sameTransaction": True,
            "failureAfterStep": "ROLLBACK_INBOX_DOMAIN_AND_OUTBOX",
            "assignments": _transaction_assignments(
                profile["inboxCompleteAssignments"], target, event
            ),
        },
        {
            "step": len(steps) + 2,
            "stage": "APPEND_CAUSAL_OUTBOX_LAST",
            "table": profile["outboxTable"],
            "action": "APPEND_OWNER_ACKNOWLEDGED_FACT",
            "events": [{"eventName": event["eventName"],
                        "condition": event["emissionCondition"]}],
            "rowCount": "EXACTLY_ONE",
            "sameTransaction": True,
            "failureAfterStep": "ROLLBACK_INBOX_DOMAIN_AND_OUTBOX",
            "assignments": _transaction_assignments(
                profile["outboxAssignments"], target, event
            ),
        },
    ])
    return {
        "operationBinding": target["handlerId"],
        "sameTransaction": True,
        "stepOrder": "INBOX_CLAIM_FIRST_DOMAIN_DML_THEN_INBOX_COMPLETION_OUTBOX_LAST",
        "inboxTable": profile["inboxTable"],
        "outboxTable": profile["outboxTable"],
        "steps": steps,
        "idempotency": copy.deepcopy(target.get("idempotency", {})),
        "atomicity": target.get("rollback"),
        "idempotentReplay": "RETURN_PRIOR_COMMITTED_RESULT_WITH_ZERO_DOMAIN_OR_OUTBOX_WRITE",
        "staleVersion": "ROOT_CAS_ROW_COUNT_ZERO_ROLLS_BACK_ALL_STEPS",
        "tenantMismatch": "TENANT_PREDICATE_ROW_COUNT_ZERO_ROLLS_BACK_ALL_STEPS",
        "rollback": copy.deepcopy(target.get("rollback", {})),
        "retry": copy.deepcopy(target.get("retry", {})),
    }


def build_reviewed_causal_contract(exact: dict[str, Any], events: dict[str, Any]) -> dict[str, Any]:
    ssot = load_candidate_ssot()
    transaction_profiles = ssot["transactionInfrastructure"]["sessions"]
    common = {row["name"]: row for row in exact["commonTableContract"]["columns"]}
    columns: dict[str, dict[str, dict[str, Any]]] = {}
    for table in exact["tableSpecifications"]:
        columns[table["tableName"]] = {
            row["name"]: row
            for row in [table["idColumn"], *common.values(), *table["columns"]]
        }
    exact_ops = {row["operationId"]: row for row in exact["operationBindings"]}
    rows: list[dict[str, Any]] = []
    for target in sorted(ssot["operations"], key=lambda row: row["operationId"]):
        operation_id = target["operationId"]
        if target["mode"] == "QUERY":
            read_plan = copy.deepcopy(target["readPlan"])
            read_plan.update({"eventsForbidden": True, "transactionMode": "READ_ONLY"})
            rows.append({
                "operationId": operation_id,
                "mode": "QUERY",
                "targetSelectors": copy.deepcopy(target["selectors"]),
                "requiredInputUses": [_causal_input_effect(effect) for effect in target["inputEffects"]],
                "mutationFieldSet": [],
                "causalEvents": [],
                "readPlan": read_plan,
            })
            continue
        root = copy.deepcopy(target["aggregateRoot"])
        root["selectors"] = copy.deepcopy(target["selectors"])
        root.setdefault("tenantFilter", "tenant_id = authenticatedPrincipal.tenantId")
        root.setdefault("versionFilter", "exact expected version or create version one")
        domain = [
            step for step in target["orderedDml"]
            if (step.get("role") not in {"COMMAND_RECEIPT", "TRANSACTIONAL_OUTBOX"}
                and step.get("action") != "CALL_OWNER_PORT"
                and step.get("table"))
        ]
        physical_writes = set(_physical_tables(target))
        ordered: list[dict[str, Any]] = []
        for index, step in enumerate(domain, start=1):
            ordered.append({
                "step": index,
                "table": step.get("table"),
                "disposition": _normalize_action(step.get("action", "")),
                "action": step.get("action"),
                "role": step.get("role"),
                "assignments": _assignment_rows(step, columns),
                "tenantPredicate": "tenant_id = authenticatedPrincipal.tenantId",
                "rootCasPredicate": step.get("selector"),
                "sameTransaction": True,
            })
        events_for_operation = [_causal_event(event, physical_writes) for event in target["events"]]
        mutation_fields = sorted({
            assignment["target"]
            for step in ordered
            for assignment in step["assignments"]
        })
        rows.append({
            "operationId": operation_id,
            "mode": "COMMAND",
            "aggregateRoot": root,
            "writeTables": _physical_tables(target),
            "orderedDml": ordered,
            "transactionEnvelope": _command_transaction_envelope(
                target, ordered, events_for_operation,
                transaction_profiles[target["session"]],
            ),
            "mutationFieldSet": mutation_fields,
            "transition": copy.deepcopy(target["transition"]),
            "requiredInputUses": [_causal_input_effect(effect) for effect in target["inputEffects"]],
            "causalEvents": events_for_operation,
            "identityConstraints": copy.deepcopy(target.get("identityConstraints", [])),
            "forbiddenRequestFields": copy.deepcopy(target.get("forbiddenRequestFields", [])),
            "session": target["session"],
            "authorizationCapability": target["authorizationCapability"],
        })

    handlers: list[dict[str, Any]] = []
    for raw_target in ssot["systemHandlers"]:
        target = _owned_handler(raw_target)
        exact_handler = _exact_handler(target)
        root = target["aggregateRoot"]
        writes = set(exact_handler["writesTables"])
        domain = [row for row in target.get("writes", []) if row.get("action") != "CALL_OWNER_PORT"]
        ordered = [
            {
                "step": index,
                "table": step["table"],
                "disposition": _normalize_action(step["action"]),
                "action": step["action"],
                "role": step.get("role"),
                "assignments": _assignment_rows(step, columns),
                "rowCount": _row_count_contract(_normalize_action(step["action"])),
                "tenantPredicate": "tenant_id = ownerContext.tenantId",
                "rootCasPredicate": (
                    "tenant_id + public_id + expected aggregate_version + allowed pre-state"
                    if step["action"] == "UPDATE_CAS" else
                    "owner-result identity and exact locked parent/version"
                ),
                "sameTransaction": True,
            }
            for index, step in enumerate(domain, start=1)
        ]
        event = _causal_event(target["event"], writes)
        handlers.append({
            **exact_handler,
            "aggregateRoot": {
                "table": root["table"],
                "publicIdColumn": root.get("publicIdColumn", "public_id"),
                "versionColumn": root.get("versionColumn", "aggregate_version"),
                "stateColumn": root["stateColumn"],
            },
            "orderedDml": ordered,
            "transactionEnvelope": _handler_transaction_envelope(
                target, ordered, event,
                transaction_profiles[target["session"]],
            ),
            # Keep the same complete causal event shape as public commands so
            # handler events cannot evade aggregate/state/version or PEP checks.
            "eventContract": event,
        })
    return {
        "contractId": "dwp.hris.modern.operation-causal-state.v2",
        "schemaVersion": 2,
        "status": "SEALED_G3_DESIGN_NOT_IMPLEMENTED",
        "scope": {
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
        },
        "policies": copy.deepcopy(ssot["policies"]),
        "transactionInfrastructure": copy.deepcopy(ssot["transactionInfrastructure"]),
        "operations": rows,
        "internalConsumerHandlers": handlers,
    }
