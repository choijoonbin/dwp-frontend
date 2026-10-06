#!/usr/bin/env python3
"""Generate and verify the immutable modern-HRIS closed-set manifest.

The manifest is the hand-off boundary between canonical projection, physical
DDL/module implementation, and independent validation.  Its counts are always
derived from sorted identifier sets; no consumer may substitute target counts.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import tempfile
from collections import Counter
from pathlib import Path
from typing import Any

from modern_closed_set_design import (
    ADDED_TABLE_IDS,
    CURRENT_115_REMOVED_TABLE_IDS,
    CURRENT_115_TO_131_TABLE_SCOPE_CHANGE,
    DESIGN_ID,
    FROZEN_115_TABLE_SET_SHA256,
    LEGACY_LISTENING_TABLE_IDS,
    NEW_COMMAND_EVENTS_BY_SESSION,
    NEW_QUERY_IDS_BY_SESSION,
    NON_LISTENING_HANDLER_EVENTS,
    NON_LISTENING_HANDLER_ADDITIONAL_EVENTS,
    P0_TABLE_SCOPE_CHANGE,
    REVIEWED_106_TO_115_TABLE_IDS,
    PREDECESSOR_OPERATION_SSOT_SHA256,
    REMOVED_OPERATION_IDS,
    REMOVED_PUBLIC_EVENT_IDS,
    REPLACED_OPERATION_IDS,
    REPLACED_PUBLIC_EVENT_IDS,
    all_new_operation_ids,
    events_for_new_operation,
    mode_for_new_operation,
    session_for_new_operation,
)
from sys_listening_canonical_design import (
    build_static_design,
    build_stream_authority_successor_v2,
    static_design_digest,
)


HERE = Path(__file__).resolve().parent
SSOT = HERE / "modern-capability-operation-causal-contract-ssot.v2.json"
EXACT = HERE / "modern-capability-exact-schema-contracts.v1.json"
EVENTS = HERE / "modern-capability-event-payload-contracts.v1.json"
OUTPUT = HERE / "modern-capability-closed-set-manifest.v3.json"
TABLE_SCOPE_POLICY_V5 = (
    HERE / "modern-independent-successor/global-hcm-table-expansion-acceptance-policy.v5.json"
)
TABLE_SCOPE_POLICY_V5_SHA256 = "ec29008105473639a2a6ffcf116295e410de4c017d5bf1c0fd5a02c228cb088b"
TABLE_SCOPE_POLICY_V5_SEAL = "4bdfd9282371ce9c6f32db6d2d50265b3480c8d4157d35132c1d7dccefcd69e2"
LISTENING_AUTHORITY_V2_SHA256 = "6bb9f2cca31cd10988e463d5aed8ec67aa789812e68bccf3e76547edd28b4316"
LISTENING_AUTHORITY_V2_SEAL = "55d5b62e903b62f1b8d486ff41971ceb189bf02b8e5d8307331439dfa380d7c4"

# Explicit, reviewable bridge from the first materialized successor.  This is
# not a historical byte restore: it authorizes idempotent reprojection of the
# current canonical successor after the manifest seal changes.
SUCCESSOR_REFRESH_ORIGIN = {
    "manifestId": "dwp.hris.modern.closed-set-manifest.v3",
    "sealedPayloadSha256": "00bb8fba8b91addbc9dea24d0441bc70f6e6833db9997bd89e85da26984f9a0a",
    "operationSsotSha256": "0d9dbc68b71866295da1e792419367be02c8fc00a8adaabf693c670569c2f9ef",
}


def canonical_payload(value: dict[str, Any]) -> bytes:
    payload = {key: item for key, item in value.items() if key != "sealedPayloadSha256"}
    return json.dumps(
        payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")


def sealed(value: dict[str, Any]) -> dict[str, Any]:
    result = json.loads(json.dumps(value, ensure_ascii=False))
    result["sealedPayloadSha256"] = hashlib.sha256(canonical_payload(result)).hexdigest()
    return result


def global_owner_dependency_pins(
    listening: dict[str, Any],
) -> list[dict[str, Any]]:
    """Project the global two-contract closure without changing Listening's one."""
    from generate_modern_operation_ssot_successor import (
        _compensation_payroll_owner_dependency,
    )

    listening_dependencies = listening.get("ownerDependencyContracts", [])
    if len(listening_dependencies) != 1:
        raise ValueError("Listening local owner-dependency count must remain one")
    dependencies = [
        *listening_dependencies,
        _compensation_payroll_owner_dependency(),
    ]
    pins = sorted(({
        "dependencyContractId": row["dependencyContractId"],
        "ownerSession": row.get("ownerSession"),
        "consumerSession": row.get("consumerSession"),
        "sealedPayloadSha256": row["sealedPayloadSha256"],
    } for row in dependencies), key=lambda row: row["dependencyContractId"])
    if len(pins) != 2 or len({row["dependencyContractId"] for row in pins}) != 2:
        raise ValueError("global owner-dependency closed set must be exact two")
    return pins


def reviewed_table_scope_policy() -> dict[str, Any]:
    """Load and verify the sealed v5 acceptance policy."""

    raw = TABLE_SCOPE_POLICY_V5.read_bytes()
    if hashlib.sha256(raw).hexdigest() != TABLE_SCOPE_POLICY_V5_SHA256:
        raise ValueError("table-scope acceptance policy v5 byte hash drift")
    policy = json.loads(raw)
    if policy.get("sealedPayloadSha256") != TABLE_SCOPE_POLICY_V5_SEAL:
        raise ValueError("table-scope acceptance policy v5 declared seal drift")
    if hashlib.sha256(canonical_payload(policy)).hexdigest() != TABLE_SCOPE_POLICY_V5_SEAL:
        raise ValueError("table-scope acceptance policy v5 payload seal mismatch")
    scope = policy.get("successorScope", {})
    if (
        scope.get("tableCount") != 131
        or scope.get("deltaCount") != len(CURRENT_115_TO_131_TABLE_SCOPE_CHANGE)
        or scope.get("netDelta")
        != len(CURRENT_115_TO_131_TABLE_SCOPE_CHANGE)
        - len(CURRENT_115_REMOVED_TABLE_IDS)
        or scope.get("removedTableIds") != sorted(CURRENT_115_REMOVED_TABLE_IDS)
    ):
        raise ValueError("table-scope acceptance policy v5 count/removal drift")
    return policy


def reviewed_table_scope_rows() -> dict[str, dict[str, Any]]:
    """Load the sealed v4 acceptance rows instead of duplicating their prose.

    The authored design still owns the exact table-ID closed set.  The
    independent successor policy owns the reviewed producer/reader and
    non-replaceability statements that the manifest must reproduce byte for
    byte.  Both inputs are pinned and must agree on all 17 IDs.
    """

    policy = reviewed_table_scope_policy()
    rows = {
        row["tableId"]: row
        for row in policy.get("successorScope", {}).get("addedRows", [])
    }
    if len(rows) != len(policy.get("successorScope", {}).get("addedRows", [])):
        raise ValueError("table-scope acceptance policy v5 has duplicate table IDs")
    if set(rows) != set(CURRENT_115_TO_131_TABLE_SCOPE_CHANGE):
        raise ValueError("table-scope policy/design exact17 ID closure drift")
    for table_id, policy_row in rows.items():
        design_row = CURRENT_115_TO_131_TABLE_SCOPE_CHANGE[table_id]
        for key in (
            "ownerSession", "producers", "readConsumers",
            "requirementIds",
        ):
            policy_value = policy_row.get(key)
            design_value = design_row.get(key)
            if key != "ownerSession":
                policy_value = sorted(policy_value or [])
                design_value = sorted(design_value or [])
            if policy_value != design_value:
                raise ValueError(
                    f"table-scope policy/design {key} drift: {table_id}"
                )
    if policy["successorScope"].get("removedTableIds") != sorted(
        CURRENT_115_REMOVED_TABLE_IDS
    ):
        raise ValueError("table-scope acceptance policy v5 removal disposition drift")
    return {table_id: rows[table_id] for table_id in sorted(rows)}


def predecessor_session(operation: dict[str, Any]) -> str:
    session = operation.get("session")
    if session not in {"HRIS-HRM", "HRIS-PER", "HRIS-TIM", "HRIS-SYS"}:
        raise ValueError(f"predecessor operation lacks exact session: {operation.get('operationId')}")
    return session


def build_manifest() -> dict[str, Any]:
    authority_v2 = build_stream_authority_successor_v2(HERE.parent)
    authority_v2_bytes = (
        json.dumps(authority_v2, ensure_ascii=False, sort_keys=True, indent=2) + "\n"
    ).encode("utf-8")
    if hashlib.sha256(authority_v2_bytes).hexdigest() != LISTENING_AUTHORITY_V2_SHA256:
        raise ValueError("Listening authority v2 rendered file SHA pin drift")
    if authority_v2.get("sealedPayloadSha256") != LISTENING_AUTHORITY_V2_SEAL:
        raise ValueError("Listening authority v2 payload seal pin drift")
    ssot_sha = hashlib.sha256(SSOT.read_bytes()).hexdigest()
    predecessor = json.loads(SSOT.read_text(encoding="utf-8"))
    exact = json.loads(EXACT.read_text(encoding="utf-8"))
    events = json.loads(EVENTS.read_text(encoding="utf-8"))
    refresh = ssot_sha != PREDECESSOR_OPERATION_SSOT_SHA256
    previous_manifest: dict[str, Any] | None = None
    if refresh:
        if not OUTPUT.is_file():
            raise ValueError("successor refresh requires the previously sealed manifest")
        previous_manifest = json.loads(OUTPUT.read_text(encoding="utf-8"))
        if previous_manifest.get("manifestId") != SUCCESSOR_REFRESH_ORIGIN["manifestId"]:
            raise ValueError("successor refresh manifestId drift")
        if previous_manifest.get("sealedPayloadSha256") != hashlib.sha256(
            canonical_payload(previous_manifest)
        ).hexdigest():
            raise ValueError("successor refresh source manifest seal mismatch")
        pinned = predecessor.get("closedSetManifest", {})
        origin_match = (
            ssot_sha == SUCCESSOR_REFRESH_ORIGIN["operationSsotSha256"]
            and pinned.get("sealedPayloadSha256")
            == SUCCESSOR_REFRESH_ORIGIN["sealedPayloadSha256"]
        )
        current_match = (
            pinned.get("manifestId") == previous_manifest["manifestId"]
            and pinned.get("sealedPayloadSha256")
            == previous_manifest["sealedPayloadSha256"]
            and previous_manifest.get("refreshSource") == SUCCESSOR_REFRESH_ORIGIN
        )
        reprojection_pin = previous_manifest.get("successorReprojectionPin", {})
        reprojection_match = (
            pinned.get("manifestId") == reprojection_pin.get("manifestId")
            and pinned.get("sealedPayloadSha256")
            == reprojection_pin.get("sealedPayloadSha256")
            and ssot_sha == reprojection_pin.get("operationSsotSha256")
        )
        if not (origin_match or current_match or reprojection_match):
            raise ValueError("canonical successor is not pinned to an allowed refresh source")
    predecessor_operations = {
        row["operationId"]: row for row in predecessor.get("operations", [])
    }
    if len(predecessor_operations) != len(predecessor.get("operations", [])):
        raise ValueError("predecessor operation IDs are not unique")
    if not refresh and not REMOVED_OPERATION_IDS <= predecessor_operations.keys():
        raise ValueError("removed operation set is not a subset of the sealed predecessor")
    new_ids = all_new_operation_ids()
    if not refresh and new_ids & predecessor_operations.keys():
        raise ValueError("new operation collides with predecessor")

    operation_rows: list[dict[str, Any]] = []
    prior_rows = {
        row["operationId"]: row
        for row in (previous_manifest or {}).get("operations", [])
    }
    for operation_id, row in predecessor_operations.items():
        if operation_id in REMOVED_OPERATION_IDS:
            continue
        operation_rows.append({
            "operationId": operation_id,
            "session": predecessor_session(row),
            "mode": row["mode"],
            "provenance": prior_rows.get(operation_id, {}).get(
                "provenance", "SEALED_PREDECESSOR"
            ),
            "eventIds": sorted(
                REPLACED_PUBLIC_EVENT_IDS.get(event["eventName"], event["eventName"])
                for event in row.get("events", [])
                if event["eventName"] not in REMOVED_PUBLIC_EVENT_IDS
            ),
        })
    for operation_id in (() if refresh else sorted(new_ids)):
        operation_rows.append({
            "operationId": operation_id,
            "session": session_for_new_operation(operation_id),
            "mode": mode_for_new_operation(operation_id),
            "provenance": "REVIEWED_SUCCESSOR_ADDITION",
            "eventIds": sorted(events_for_new_operation(operation_id)),
        })
    operation_rows.sort(key=lambda row: row["operationId"])
    if len({row["operationId"] for row in operation_rows}) != len(operation_rows):
        raise ValueError("successor operation IDs are not unique")

    listening = build_static_design()
    owner_dependency_pins = global_owner_dependency_pins(listening)
    listening_events_by_operation = {
        row["operationId"]: sorted(row["publicEventIds"])
        for row in listening["publicOperationBindings"]
    }
    for operation_row in operation_rows:
        if operation_row["operationId"] in listening_events_by_operation:
            operation_row["eventIds"] = listening_events_by_operation[
                operation_row["operationId"]
            ]
    listening_handler_ids = {
        row["handlerId"] for row in listening["ownerLocalHandlers"]
    }
    handler_ids = set(NON_LISTENING_HANDLER_EVENTS) | listening_handler_ids
    if len(handler_ids) != len(NON_LISTENING_HANDLER_EVENTS) + len(listening_handler_ids):
        raise ValueError("handler IDs collide across Listening and other owners")

    predecessor_tables = {
        row["tableName"] for row in exact.get("tableSpecifications", [])
    }
    listening_tables = {
        row["tableName"] for row in listening["tableOwnership"]
    }
    if not refresh and not LEGACY_LISTENING_TABLE_IDS <= predecessor_tables:
        raise ValueError("legacy Listening table set drifted")
    if refresh:
        table_ids = (
            predecessor_tables - CURRENT_115_REMOVED_TABLE_IDS
            | set(ADDED_TABLE_IDS)
        )
        if not listening_tables <= table_ids:
            raise ValueError("successor refresh lost static Listening tables")
    else:
        table_ids = (
            predecessor_tables - LEGACY_LISTENING_TABLE_IDS
            - CURRENT_115_REMOVED_TABLE_IDS
            | listening_tables
            | set(ADDED_TABLE_IDS)
        )
        if len(table_ids) != (
            len(predecessor_tables) - len(LEGACY_LISTENING_TABLE_IDS)
            - len(CURRENT_115_REMOVED_TABLE_IDS)
            + len(listening_tables) + len(ADDED_TABLE_IDS)
        ):
            raise ValueError("successor table additions collide with predecessor/Listening")

    predecessor_event_ids = {
        row["eventName"] for row in events.get("eventPayloadSchemas", [])
    }
    if not refresh and not REMOVED_PUBLIC_EVENT_IDS <= predecessor_event_ids:
        raise ValueError("removed event set is not a subset of predecessor")
    if not refresh and not set(REPLACED_PUBLIC_EVENT_IDS) <= predecessor_event_ids:
        raise ValueError("replaced event set is not a subset of predecessor")
    retained_event_ids = (
        predecessor_event_ids
        - REMOVED_PUBLIC_EVENT_IDS
        - set(REPLACED_PUBLIC_EVENT_IDS)
    )
    new_command_event_ids = {
        event_id
        for operations in NEW_COMMAND_EVENTS_BY_SESSION.values()
        for event_ids in operations.values()
        for event_id in event_ids
    }
    listening_public_event_ids = {
        row["eventName"]
        for row in listening["eventOwnership"]["canonicalPublicEvents"]
    }
    handler_event_ids = set(NON_LISTENING_HANDLER_EVENTS.values()) | {
        event_id
        for event_ids in NON_LISTENING_HANDLER_ADDITIONAL_EVENTS.values()
        for event_id in event_ids
    }
    event_ids = (
        ({REPLACED_PUBLIC_EVENT_IDS.get(value, value) for value in predecessor_event_ids
          if value not in REMOVED_PUBLIC_EVENT_IDS} if refresh else retained_event_ids)
        | set(REPLACED_PUBLIC_EVENT_IDS.values())
        | new_command_event_ids | handler_event_ids | listening_public_event_ids
    )
    event_sources = [
        retained_event_ids,
        set(REPLACED_PUBLIC_EVENT_IDS.values()),
        new_command_event_ids,
        handler_event_ids,
        listening_public_event_ids,
    ]
    # Derive the overlap from actual command event sources.  Publish/close are
    # finalizer-owned saga results, while create/revise/action facts remain
    # command-owned; no hard-coded historical subtotal is accepted.
    if not refresh:
        ownership: Counter[str] = Counter(
            event_id for source in event_sources for event_id in source
        )
        duplicate_claims = {
            event_id for event_id, count in ownership.items() if count > 1
        }
        expected_listening_command_overlap = listening_public_event_ids & (
            retained_event_ids | set(REPLACED_PUBLIC_EVENT_IDS.values())
            | new_command_event_ids
        )
        if duplicate_claims != expected_listening_command_overlap:
            raise ValueError(f"unexpected event ownership overlap: {sorted(duplicate_claims)}")

    session_mode_counts = Counter(
        (row["session"], row["mode"]) for row in operation_rows
    )
    scope = {
        "operations": len(operation_rows),
        "commands": sum(row["mode"] == "COMMAND" for row in operation_rows),
        "queries": sum(row["mode"] == "QUERY" for row in operation_rows),
        "handlers": len(handler_ids),
        "publicEvents": len(event_ids),
        "tableSpecifications": len(table_ids),
        "ownerPortOperationContracts": len(listening["ownerPortOperationContracts"]),
        "ownerDependencyContracts": len(owner_dependency_pins),
        "bySession": {
            session: {
                "operations": sum(row["session"] == session for row in operation_rows),
                "commands": session_mode_counts[(session, "COMMAND")],
                "queries": session_mode_counts[(session, "QUERY")],
            }
            for session in ("HRIS-HRM", "HRIS-PER", "HRIS-TIM", "HRIS-SYS")
        },
    }
    if scope["commands"] + scope["queries"] != scope["operations"]:
        raise ValueError("command/query partition is not closed")

    if not set(P0_TABLE_SCOPE_CHANGE) <= table_ids:
        raise ValueError("P0 table scope-change provenance is not in the active table set")
    scope_policy = reviewed_table_scope_policy()
    active_scope_rows = reviewed_table_scope_rows()
    pinned = predecessor.get("closedSetManifest", {})
    preserved_reprojection_pin = (
        (previous_manifest or {}).get("successorReprojectionPin")
        if refresh else None
    )
    successor_reprojection_pin = preserved_reprojection_pin or {
        "manifestId": pinned.get("manifestId", SUCCESSOR_REFRESH_ORIGIN["manifestId"]),
        "sealedPayloadSha256": pinned.get(
            "sealedPayloadSha256", SUCCESSOR_REFRESH_ORIGIN["sealedPayloadSha256"]
        ),
        "operationSsotSha256": ssot_sha,
    }
    return sealed({
        "manifestId": "dwp.hris.modern.closed-set-manifest.v3",
        "schemaVersion": 3,
        "status": "REVIEWED_G3_SUCCESSOR_CLOSED_SET_NOT_IMPLEMENTED",
        "designId": DESIGN_ID,
        "sourcePolicy": (
            "EXACT_SORTED_IDENTIFIER_SETS_ARE_AUTHORITY;COUNTS_ARE_DERIVED_ONLY;"
            "MISSING_EXTRA_DUPLICATE_IDENTIFIERS_FAIL_CLOSED"
        ),
        "predecessorPins": (
            previous_manifest["predecessorPins"] if refresh and previous_manifest else {
                SSOT.name: PREDECESSOR_OPERATION_SSOT_SHA256,
                EXACT.name: hashlib.sha256(EXACT.read_bytes()).hexdigest(),
                EVENTS.name: hashlib.sha256(EVENTS.read_bytes()).hexdigest(),
            }
        ),
        "refreshSource": SUCCESSOR_REFRESH_ORIGIN,
        "successorReprojectionPin": successor_reprojection_pin,
        "tableScopeChange": {
            "previousTableSetSha256": FROZEN_115_TABLE_SET_SHA256,
            "previousTableSpecifications": 115,
            "activeTableSpecifications": len(table_ids),
            "deltaCount": len(active_scope_rows),
            "netDelta": len(active_scope_rows) - len(CURRENT_115_REMOVED_TABLE_IDS),
            "addedTableIds": sorted(active_scope_rows),
            "removedTableIds": sorted(CURRENT_115_REMOVED_TABLE_IDS),
            "removalDisposition": scope_policy["successorScope"]["removalDisposition"],
            "reason": "NON_REPLACEABLE_TYPED_DOMAIN_FACTS_EFFECTIVE_VERSIONS_AND_IMMUTABLE_DECISION_RESULT_LEDGERS",
            "rows": active_scope_rows,
            "acceptancePolicy": {
                "path": "modern-independent-successor/global-hcm-table-expansion-acceptance-policy.v5.json",
                "fileSha256": TABLE_SCOPE_POLICY_V5_SHA256,
                "sealedPayloadSha256": TABLE_SCOPE_POLICY_V5_SEAL,
                "predecessorPolicySha256": "afb844e6ce31f588ec04b3fc46f759c616c13227742bc3d688d8f246d92c83de",
                "predecessorPolicySealedPayloadSha256": "a939167ed5167155cb8d08383415d8e518d25583bb2362fa7b2b5bfa95748b63",
                "independentReviewSha256": "da7b9a3b5adfe0246f9d53e4dd42d4275135b303033782a7c84450f822198075",
                "scopeReductionReviewSha256": "99e96abe87d7141f3d7ff6a0185db5f1820a8385e700d34d0df3b8e11a322604",
            },
        },
        "priorReviewedTableScopeChange": {
            "fromTableSpecifications": 106,
            "toTableSpecifications": 115,
            "addedTableIds": sorted(REVIEWED_106_TO_115_TABLE_IDS),
            "status": "IMMUTABLE_PRIOR_REVIEW_PROVENANCE_NOT_REOPENED",
        },
        "listeningStaticDesign": {
            "designId": listening["contractId"],
            "designSha256": static_design_digest(),
            "exactCounts": listening["exactCounts"],
        },
        "ownerPortOperationContracts": listening["ownerPortOperationContracts"],
        "ownerDependencyContracts": owner_dependency_pins,
        "ownerBoundaryInputs": {
            "listeningStreamAuthority": {
                "contractId": "dwp.hris.sys.listening.stream-authority-successor.v2",
                "path": "coding-readiness/sys-listening-stream-authority-successor.v2.json",
                "fileSha256": LISTENING_AUTHORITY_V2_SHA256,
                "sealedPayloadSha256": LISTENING_AUTHORITY_V2_SEAL,
            },
            "physicalOwnerPrefixRegister": {
                "path": "coding-readiness/physical-owner-prefix-register.csv",
                "fileSha256": "182694bf615ca633ba705f971e07b1285869621ff2dcf7380439d767fa5f9b49",
                "bindingRule": "EACH_EXACT_TABLE_SELF_CONTAINS_STREAM_KEY_PHYSICAL_SCHEMA_AND_OWNER_SERVICE",
            },
            "independentBoundaryReview": {
                "path": "coding-readiness/modern-independent-successor/reports/modern-132-owner-stream-boundary-q0mnjg.v1.json",
                "fileSha256": "7b7b149ae2d76983ded568d1c3f17e81c1f2cb29b6129933b7e54acf0abaf594",
            },
        },
        "operationChanges": {
            "removed": sorted(REMOVED_OPERATION_IDS),
            "replaced": dict(sorted(REPLACED_OPERATION_IDS.items())),
            "added": sorted(new_ids),
        },
        "operations": operation_rows,
        "handlerIds": sorted(handler_ids),
        "nonListeningHandlerEvents": dict(sorted(NON_LISTENING_HANDLER_EVENTS.items())),
        "tableIds": sorted(table_ids),
        "publicEventIds": sorted(event_ids),
        "scope": scope,
        "implementationState": "NOT_STARTED_G3",
        "productionState": "NOT_AUTHORIZED_G6",
    })


def render(value: dict[str, Any]) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2) + "\n"


def validate_table_scope_change(value: dict[str, Any]) -> None:
    change = value.get("tableScopeChange", {})
    rows = change.get("rows", {})
    expected_rows = reviewed_table_scope_rows()
    if rows != expected_rows:
        raise ValueError("P0 table scope-change row provenance drift")
    if set(rows) - set(value["tableIds"]):
        raise ValueError("P0 table scope-change row is outside active table set")
    if (
        change.get("previousTableSetSha256") != FROZEN_115_TABLE_SET_SHA256
        or change.get("previousTableSpecifications") != 115
        or change.get("addedTableIds") != sorted(rows)
        or change.get("removedTableIds") != sorted(CURRENT_115_REMOVED_TABLE_IDS)
        or change.get("deltaCount") != len(rows)
        or change.get("netDelta") != len(rows) - len(CURRENT_115_REMOVED_TABLE_IDS)
        or change.get("removalDisposition")
        != reviewed_table_scope_policy()["successorScope"]["removalDisposition"]
    ):
        raise ValueError("P0 table scope-change delta is not source-derived")
    if (
        change.get("previousTableSpecifications") + len(rows)
        - len(CURRENT_115_REMOVED_TABLE_IDS)
        != change.get("activeTableSpecifications")
        or change.get("activeTableSpecifications") != len(value["tableIds"])
    ):
        raise ValueError("P0 table scope-change counts do not reconcile")


def validate_manifest(value: dict[str, Any]) -> None:
    expected = build_manifest()
    if value != expected:
        raise ValueError("closed-set manifest differs from reviewed source-derived projection")
    if value.get("sealedPayloadSha256") != hashlib.sha256(canonical_payload(value)).hexdigest():
        raise ValueError("closed-set manifest seal mismatch")
    operations = value["operations"]
    if len(operations) != len({row["operationId"] for row in operations}):
        raise ValueError("closed-set manifest contains duplicate operations")
    for key in ("handlerIds", "tableIds", "publicEventIds"):
        if len(value[key]) != len(set(value[key])):
            raise ValueError(f"closed-set manifest contains duplicate {key}")
    validate_table_scope_change(value)


def validate_successor_projection(value: dict[str, Any]) -> None:
    """Validate the immutable ID manifest after canonical materialization."""
    if value.get("sealedPayloadSha256") != hashlib.sha256(canonical_payload(value)).hexdigest():
        raise ValueError("closed-set manifest seal mismatch")
    validate_table_scope_change(value)
    ssot = json.loads(SSOT.read_text(encoding="utf-8"))
    exact = json.loads(EXACT.read_text(encoding="utf-8"))
    events = json.loads(EVENTS.read_text(encoding="utf-8"))
    if ssot.get("closedSetManifest", {}).get("sealedPayloadSha256") != value["sealedPayloadSha256"]:
        raise ValueError("successor operation SSOT does not pin this immutable manifest")
    operation_ids = {row["operationId"] for row in ssot["operations"]}
    manifest_operation_ids = {row["operationId"] for row in value["operations"]}
    if operation_ids != manifest_operation_ids or len(ssot["operations"]) != len(operation_ids):
        raise ValueError("successor operation ID closure differs from manifest")
    observed_rows = {
        row["operationId"]: {
            "session": row["session"], "mode": row["mode"],
            "eventIds": sorted(event["eventName"] for event in row.get("events", [])),
        }
        for row in ssot["operations"]
    }
    for row in value["operations"]:
        if observed_rows[row["operationId"]] != {
            "session": row["session"], "mode": row["mode"],
            "eventIds": row["eventIds"],
        }:
            raise ValueError(f"successor operation row drift: {row['operationId']}")
    if {row["handlerId"] for row in ssot["systemHandlers"]} != set(value["handlerIds"]):
        raise ValueError("successor handler ID closure differs from manifest")
    if {row["operationId"] for row in exact["operationBindings"]} != operation_ids:
        raise ValueError("successor exact operation closure differs from manifest")
    if {row["tableName"] for row in exact["tableSpecifications"]} != set(value["tableIds"]):
        raise ValueError("successor table closure differs from manifest")
    if {row["eventName"] for row in events["eventPayloadSchemas"]} != set(value["publicEventIds"]):
        raise ValueError("successor event closure differs from manifest")
    scope = value["scope"]
    observed_scope = {
        "operations": len(operation_ids),
        "commands": sum(row["mode"] == "COMMAND" for row in ssot["operations"]),
        "queries": sum(row["mode"] == "QUERY" for row in ssot["operations"]),
        "handlers": len(ssot["systemHandlers"]),
        "publicEvents": len(events["eventPayloadSchemas"]),
        "tableSpecifications": len(exact["tableSpecifications"]),
        "ownerPortOperationContracts": len(
            ssot.get("ownerPortOperationContracts", [])
        ),
        "ownerDependencyContracts": len(
            ssot.get("ownerDependencyContracts", [])
        ),
        "bySession": {
            session: {
                "operations": sum(row["session"] == session for row in ssot["operations"]),
                "commands": sum(row["session"] == session and row["mode"] == "COMMAND" for row in ssot["operations"]),
                "queries": sum(row["session"] == session and row["mode"] == "QUERY" for row in ssot["operations"]),
            }
            for session in ("HRIS-HRM", "HRIS-PER", "HRIS-TIM", "HRIS-SYS")
        },
    }
    if scope != observed_scope:
        raise ValueError("successor source-derived counts differ from immutable manifest")
    observed_dependency_pins = sorted(({
        "dependencyContractId": row.get("dependencyContractId"),
        "ownerSession": row.get("ownerSession"),
        "consumerSession": row.get("consumerSession"),
        "sealedPayloadSha256": row.get("sealedPayloadSha256"),
    } for row in ssot.get("ownerDependencyContracts", [])), key=lambda row: str(
        row["dependencyContractId"]
    ))
    if observed_dependency_pins != value.get("ownerDependencyContracts"):
        raise ValueError("successor owner-dependency ID/seal closure differs from manifest")
    listening = build_static_design()
    if value["listeningStaticDesign"] != {
        "designId": listening["contractId"],
        "designSha256": static_design_digest(),
        "exactCounts": listening["exactCounts"],
    }:
        raise ValueError("Listening static-design pin differs from manifest")


def main() -> int:
    parser = argparse.ArgumentParser()
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--write", action="store_true")
    group.add_argument("--check", action="store_true")
    group.add_argument("--candidate-dir", type=Path)
    args = parser.parse_args()
    output = OUTPUT if not args.candidate_dir else args.candidate_dir / OUTPUT.name
    if args.write or args.candidate_dir:
        expected = build_manifest()
        output.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(
            mode="w", encoding="utf-8", dir=output.parent,
            prefix=output.name + ".", suffix=".tmp", delete=False,
        ) as handle:
            staged = Path(handle.name)
            handle.write(render(expected))
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(staged, output)
    if not output.is_file():
        raise ValueError("closed-set manifest is missing")
    current = json.loads(output.read_text(encoding="utf-8"))
    if args.write or args.candidate_dir:
        validate_manifest(current)
    elif hashlib.sha256(SSOT.read_bytes()).hexdigest() == PREDECESSOR_OPERATION_SSOT_SHA256:
        validate_manifest(current)
    else:
        validate_successor_projection(current)
    print(
        "MODERN_CLOSED_SET_MANIFEST_CHECK=PASS"
        f" operations={current['scope']['operations']}"
        f" commands={current['scope']['commands']}"
        f" queries={current['scope']['queries']}"
        f" handlers={current['scope']['handlers']}"
        f" events={current['scope']['publicEvents']}"
        f" tables={current['scope']['tableSpecifications']}"
        f" seal={current['sealedPayloadSha256']}"
        f" path={output}"
    )
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
