#!/usr/bin/env python3
"""Fail-close the PER -> PAY approved compensation snapshot handoff on v2 only.

`CompensationPlanApproved.v1` remains valid historical G2/lineage evidence, but
it is never an active G3 producer, consumer, trigger, trace, XCON, slice, or
primary-owner contract.  This validator is deliberately independent of the
modern causal candidate generator.
"""

from __future__ import annotations

import argparse
import copy
import csv
import hashlib
import json
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Callable


HERE = Path(__file__).resolve().parent
ROOT = HERE.parent

PREDECESSOR = "CompensationPlanApproved.v1"
EVENT_V2 = "ApprovedCompensationPlanSnapshotPublished.v2"
SNAPSHOT_V1 = "ApprovedCompensationPlanSnapshot.v1"
CAPABILITY = "HRIS.MODERN.COMPENSATION_PLANNING"
LISTENING_CAPABILITY = "HRIS.MODERN.EMPLOYEE_LISTENING"
LISTENING_AUTHORITY_ID = "dwp.hris.sys.listening.stream-authority-successor.v1"
LISTENING_PREDECESSOR_EVENTS = {
    "EmployeeListeningResponseSubmitted.v2",
    "EmployeeListeningSurveyCreated.v2",
    "EmployeeListeningSurveyPublished.v2",
    "EmployeeListeningSurveyClosed.v2",
    "EmployeeListeningActionCreated.v2",
    "EmployeeListeningActionCompleted.v2",
}
LISTENING_SUCCESSOR_PUBLIC_EVENTS = {
    "EmployeeListeningSurveyCreated.v3",
    "EmployeeListeningSurveyRevised.v3",
    "EmployeeListeningSurveyPublished.v3",
    "EmployeeListeningSurveyClosed.v3",
    "EmployeeListeningActionCreated.v3",
    "EmployeeListeningActionCompleted.v3",
    "EmployeeListeningCohortProjectionPublished.v1",
}
LISTENING_INTERNAL_MESSAGES = {
    "ListeningAdmissionInstallRequested.v1",
    "ListeningAdmissionInstallReceipt.v1",
    "ListeningAdmissionCloseRequested.v1",
    "ListeningAdmissionCloseReceipt.v1",
    "ListeningCohortPackageReady.v1",
    "ListeningCohortProjectionReceipt.v1",
}
EXACT_FIELDS = {
    "aggregateId", "fromState", "toState", "aggregateVersion", "occurredAt",
    "correlationId", "planId", "cycleId", "approvalRevision",
    "approvalReceiptId", "effectiveDate", "snapshotId", "lineCount",
    "snapshotRevision", "sourceVersion", "payloadDigest",
}
EXPECTED_IMPORT = (
    "com.dwp.contracts.hris.xcon.v1."
    "Xcon021ApprovedCompensationPlanSnapshotPublishedV2"
)
EXPECTED_PROVIDER_TEST = (
    "dwp-people-server/src/test/java/com/dwp/services/people/hris/performance/"
    "contracts/xcon/Xcon021ApprovedCompensationPlanSnapshotPublishedV2ProviderContractTest.java"
)
EXPECTED_CONSUMER_TEST = (
    "dwp-payroll-server/src/test/java/com/dwp/services/payroll/integration/xcon/"
    "Xcon021ApprovedCompensationPlanSnapshotPublishedV2ConsumerContractTest.java"
)
NON_MODERN_PRIMARY_COUNTS = {
    "PUBLIC_PEP": 175,
    "INTERNAL_SERVICE_PEP": 11,
    "XCON_PRODUCER": 21,
    "SYS_G2_CONTRACT": 84,
    "BASE_EVENT": 48,
}

PATHS = {
    "dependency": HERE / "module-dependency-register.csv",
    "xcon": HERE / "cross-module-contract-register.csv",
    "binding": HERE / "cross-module-schema-binding-register.csv",
    "schema": HERE / "cross-module-canonical-schemas.v1.json",
    "trace": HERE / "modern-capability-trace-register.csv",
    "ownership": HERE / "g3-contract-primary-ownership-register.csv",
    "slices": HERE / "g3-slice-code-go-register.csv",
    "lineage": HERE / "modern-capability-event-successor-lineage.v2.json",
    "events": HERE / "modern-capability-event-payload-contracts.v1.json",
    "exact": HERE / "modern-capability-exact-schema-contracts.v1.json",
    "listening": HERE / "sys-listening-stream-authority-successor.v1.json",
    "per": ROOT / "session-evidence/per/g3-modern-capability-contracts.v2.json",
    "pay": ROOT / "session-evidence/pay/g3-modern-capability-consumer-contracts.v1.json",
}
LISTENING_CANONICAL_INPUTS = (
    ("operationCausal", "coding-readiness/modern-capability-operation-causal-contract-ssot.v2.json"),
    ("semanticBindings", "coding-readiness/modern-capability-semantic-bindings.v1.json"),
    ("publicIdentities", "coding-readiness/modern-capability-public-identity-registry.v1.json"),
    ("exactSchemas", "coding-readiness/modern-capability-exact-schema-contracts.v1.json"),
    ("eventPayloads", "coding-readiness/modern-capability-event-payload-contracts.v1.json"),
)


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8-sig") as handle:
        return list(csv.DictReader(handle))


def split_pipe(value: str) -> set[str]:
    return {item for item in value.split("|") if item}


def load_state() -> dict[str, Any]:
    return {
        key: (read_csv(path) if path.suffix == ".csv" else json.loads(path.read_text(encoding="utf-8")))
        for key, path in PATHS.items()
    }


def canonical_hash_without_seal(document: dict[str, Any]) -> str:
    payload = {
        key: value for key, value in document.items()
        if key != "sealedPayloadSha256"
    }
    raw = json.dumps(
        payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def validate_listening_overlay(authority: dict[str, Any]) -> list[str]:
    """Accept the unrelated SYS summary only through its one-way ceremony."""
    errors: list[str] = []
    if (
        authority.get("contractId") != LISTENING_AUTHORITY_ID
        or authority.get("schemaVersion") != 1
        or authority.get("ownerSession") != "HRIS-SYS"
        or authority.get("status") != "CANONICAL_G3_START_AUTHORITY_NOT_IMPLEMENTED"
        or authority.get("sealedPayloadSha256")
        != canonical_hash_without_seal(authority)
    ):
        errors.append("listening overlay: identity/status/seal drift")
    precedence = authority.get("canonicalPrecedence", {})
    if (
        precedence.get("mode")
        != "CANONICAL_FIVE_PRIMARY_DERIVED_SUMMARY_ONLY"
        or precedence.get("supersedesCapability") != LISTENING_CAPABILITY
        or precedence.get("legacyArtifactRole")
        != "HISTORICAL_TRACE_ONLY_WHEN_SEPARATELY_FROZEN"
        or precedence.get("legacyDirectImplementation") != "FORBIDDEN"
        or precedence.get("forbiddenLegacyPublicEvent")
        != "EmployeeListeningResponseSubmitted.v2"
        or precedence.get("reverseReferenceFromCanonicalFiveAllowed") is not False
        or "predecessorPins" in precedence
        or "historicalPredecessor" in precedence
    ):
        errors.append("listening summary: canonical-five precedence drift")
    inputs = precedence.get("authoritativeInputs", [])
    if (
        not isinstance(inputs, list)
        or len(inputs) != 5
        or [row.get("role") for row in inputs]
        != [row[0] for row in LISTENING_CANONICAL_INPUTS]
        or [row.get("path") for row in inputs]
        != [row[1] for row in LISTENING_CANONICAL_INPUTS]
    ):
        errors.append("listening summary: exact canonical input set drift")
    else:
        for row, (_role, relative) in zip(
            inputs, LISTENING_CANONICAL_INPUTS, strict=True
        ):
            target = ROOT / relative
            if (
                not target.is_file()
                or target.is_symlink()
                or hashlib.sha256(target.read_bytes()).hexdigest()
                != row.get("fileSha256")
                or len(target.read_bytes()) != row.get("byteCount")
                or row.get("precedence") != "PRIMARY_CANONICAL_INPUT"
            ):
                errors.append(f"listening summary: stale canonical input {relative}")
    generated = precedence.get("generatedSummary", {})
    expected_input_digest = hashlib.sha256(json.dumps(
        inputs if isinstance(inputs, list) else [],
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")).hexdigest()
    if (
        generated.get("canonicalInputCount") != 5
        or generated.get("canonicalInputSetSha256") != expected_input_digest
        or generated.get("activePrecedence")
        != "CANONICAL_FIVE_ROWS_THEN_DERIVED_SUMMARY"
    ):
        errors.append("listening summary: canonical input digest drift")
    ownership = authority.get("eventOwnership", {})
    public_rows = ownership.get("canonicalPublicEvents", [])
    public_names = [
        str(row.get("eventName", ""))
        for row in public_rows if isinstance(row, dict)
    ] if isinstance(public_rows, list) else []
    internal_rows = ownership.get("internalPortMessages", [])
    internal_names = [
        str(row.get("messageName", ""))
        for row in internal_rows if isinstance(row, dict)
    ] if isinstance(internal_rows, list) else []
    if (
        len(public_names) != len(LISTENING_SUCCESSOR_PUBLIC_EVENTS)
        or set(public_names) != LISTENING_SUCCESSOR_PUBLIC_EVENTS
        or len(internal_names) != len(LISTENING_INTERNAL_MESSAGES)
        or set(internal_names) != LISTENING_INTERNAL_MESSAGES
        or "EmployeeListeningResponseSubmitted.v2"
        not in set(ownership.get("publicBrokerForbidden", []))
    ):
        errors.append("listening summary: exact public/internal event boundary drift")
    return errors


def one(rows: list[dict[str, Any]], key: str, value: str, errors: list[str], where: str) -> dict[str, Any]:
    matches = [row for row in rows if row.get(key) == value]
    if len(matches) != 1:
        errors.append(f"{where}: expected exactly one row, got {len(matches)}")
        return {}
    return matches[0]


def validate_state(state: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    errors.extend(validate_listening_overlay(state.get("listening", {})))

    lineage_row = one(state["lineage"].get("lineage", []), "predecessorEvent", PREDECESSOR, errors, "lineage")
    if (
        lineage_row.get("disposition") != "SUPERSEDED"
        or lineage_row.get("successorEvents") != [EVENT_V2]
        or lineage_row.get("runtimeDualPublish", {}).get("required") is not False
        or lineage_row.get("consumerMigration", {}).get("orphanConsumerCount") != 0
    ):
        errors.append("lineage: predecessor must be superseded by one v2 event with dual publish false")
    successor_contracts = lineage_row.get("successorContracts", [])
    successor = successor_contracts[0] if len(successor_contracts) == 1 else {}
    if (
        successor.get("eventName") != EVENT_V2
        or successor.get("producerOperationId") != "modern.compplan.snapshot.publish"
        or successor.get("producerSession") != "HRIS-PER"
        or set(successor.get("payloadFields", [])) != EXACT_FIELDS
        or set(successor.get("requiredPayloadFields", [])) != EXACT_FIELDS
        or set(successor.get("allowedConsumerSessions", [])) != {"HRIS-PER", "HRIS-PAY"}
        or successor.get("pep") != "SVC-PEP-PER-001"
    ):
        errors.append("lineage: exact compensation successor contract drift")

    event_rows = state["events"].get("eventPayloadSchemas", [])
    event = one(event_rows, "eventName", EVENT_V2, errors, "event payload")
    if (
        event.get("capabilityId") != CAPABILITY
        or event.get("session") != "HRIS-PER"
        or event.get("schemaVersion") != 2
        or {field.get("name") for field in event.get("fields", [])} != EXACT_FIELDS
        or set(event.get("deliveryPolicy", {}).get("fieldAllowlist", [])) != EXACT_FIELDS
        or set(event.get("deliveryPolicy", {}).get("allowedConsumerSessions", []))
        != {"HRIS-PER", "HRIS-PAY"}
        or event.get("emittedByOperationIds") != ["modern.compplan.snapshot.publish"]
    ):
        errors.append("event payload: exact 16-field PER/PAY v2 authority drift")

    expected_by_capability: dict[str, set[str]] = defaultdict(set)
    for row in event_rows:
        expected_by_capability[row.get("capabilityId", "")].add(row.get("eventName", ""))
    lineage_successors = {
        name
        for row in state["lineage"].get("lineage", [])
        for name in row.get("successorEvents", [])
    }
    introduced = set(state["lineage"].get("introducedV2Events", []))
    payload_events = set().union(*expected_by_capability.values()) if expected_by_capability else set()
    if (
        payload_events != lineage_successors | introduced
        or lineage_successors & introduced
        or any(
            not name.endswith(".v2")
            and name not in LISTENING_SUCCESSOR_PUBLIC_EVENTS
            for name in payload_events
        )
    ):
        errors.append("trace: reviewed lineage and payload event universes diverge")

    exact_operation_rows = state["exact"].get("operationBindings", [])
    exact_operation_ids = [
        str(row.get("operationId", ""))
        for row in exact_operation_rows
        if isinstance(row, dict)
    ]
    if (
        not exact_operation_ids
        or "" in exact_operation_ids
        or len(exact_operation_ids) != len(set(exact_operation_ids))
    ):
        errors.append("exact schema: canonical operation id set is empty or non-unique")
    expected_modern_operations = set(exact_operation_ids)
    if len(state["trace"]) != 16 or len(expected_by_capability) != 16:
        errors.append("trace: capability cardinality drift")
    predecessor_names = {
        row.get("predecessorEvent", "") for row in state["lineage"].get("lineage", [])
    }
    active_expected_by_capability = copy.deepcopy(expected_by_capability)
    active_expected_by_capability[LISTENING_CAPABILITY] = (
        LISTENING_SUCCESSOR_PUBLIC_EVENTS | LISTENING_INTERNAL_MESSAGES
    )
    for trace in state["trace"]:
        refs = {
            ref for ref in split_pipe(trace.get("api_event_contracts", ""))
            if not ref.startswith("/")
        }
        capability = trace.get("capability_id", "")
        if refs != active_expected_by_capability.get(capability, set()):
            errors.append(f"trace: {capability} does not contain its exact active contract set")
        if refs & predecessor_names:
            errors.append(f"trace: {capability} contains an active predecessor event")
        if capability == CAPABILITY and any(not ref.endswith(".v2") for ref in refs):
            errors.append("trace: compensation planning contains a non-v2 event")

    dep = one(state["dependency"], "dependency_id", "DEP-019", errors, "DEP-019")
    if (
        split_pipe(dep.get("contract", "")) != {SNAPSHOT_V1, EVENT_V2}
        or dep.get("producer") != "PER"
        or dep.get("consumer") != "PAY"
        or dep.get("delivery_mode") != "SNAPSHOT_AND_EVENT"
    ):
        errors.append("DEP-019: must bind snapshot v1 plus post-commit event v2 only")

    xcon = one(state["xcon"], "contract_id", "XCON-021", errors, "XCON-021 source")
    if (
        xcon.get("canonical_name") != EVENT_V2
        or split_pipe(xcon.get("required_fields", "")) != EXACT_FIELDS
        or xcon.get("producer_evidence")
        != "../session-evidence/per/g3-modern-capability-contracts.v2.json"
        or xcon.get("consumer_evidence")
        != "../session-evidence/pay/g3-modern-capability-consumer-contracts.v1.json"
    ):
        errors.append("XCON-021 source: v2 name/16 fields/G3 evidence drift")

    binding = one(state["binding"], "contract_id", "XCON-021", errors, "XCON-021 binding")
    if (
        binding.get("canonical_name") != EVENT_V2
        or binding.get("canonical_generated_import") != EXPECTED_IMPORT
        or binding.get("producer_generated_import") != EXPECTED_IMPORT
        or binding.get("consumer_generated_imports") != f"HRIS-PAY:{EXPECTED_IMPORT}"
        or binding.get("producer_test_allocation") != EXPECTED_PROVIDER_TEST
        or binding.get("consumer_test_allocations")
        != f"HRIS-PAY:{EXPECTED_CONSUMER_TEST}"
        or binding.get("producer_evidence_required_ref")
        != "../session-evidence/per/g3-modern-capability-contracts.v2.json#/capabilities/5/events/4/payloadRequired"
        or binding.get("consumer_evidence_required_refs")
        != "HRIS-PAY:../session-evidence/pay/g3-modern-capability-consumer-contracts.v1.json#/consumedModernCapabilities/0/invalidationEvent/payloadRequired"
    ):
        errors.append("XCON-021 binding: v2 evidence/import/test allocation drift")

    schema = state["schema"].get("$defs", {}).get("XCON_021", {})
    if (
        schema.get("title") != EVENT_V2
        or set(schema.get("properties", {})) != EXACT_FIELDS
        or set(schema.get("required", [])) != EXACT_FIELDS
        or schema.get("additionalProperties") is not False
        or schema.get("x-causal-contract") != {
            "emission": "POST_SNAPSHOT_HEADER_AND_ALL_ORDERED_LINES_COMMIT",
            "runtimeVersion": "V2_ONLY",
            "dualPublish": "FORBIDDEN",
            "payTrigger": "THIS_EVENT_ONLY",
        }
    ):
        errors.append("XCON-021 schema: closed exact 16-field v2 causal contract drift")

    per_capability = one(state["per"].get("capabilities", []), "capabilityId", CAPABILITY, errors, "PER capability")
    per_event = one(per_capability.get("events", []), "name", EVENT_V2, errors, "PER producer event")
    per_snapshot_operation = one(
        per_capability.get("operations", []), "operationId", "modern.compplan.snapshot.publish",
        errors, "PER snapshot operation",
    )
    if (
        set(per_event.get("payloadRequired", [])) != EXACT_FIELDS
        or per_event.get("version") != 2
        or per_event.get("emissionCondition") != "ALWAYS"
        or per_snapshot_operation.get("emits") != [EVENT_V2]
    ):
        errors.append("PER producer: snapshot commit operation/event v2 drift")
    if any(
        PREDECESSOR in operation.get("emits", [])
        for operation in per_capability.get("operations", [])
    ):
        errors.append("PER producer: predecessor or dual publish remains active")

    consumers = state["pay"].get("consumedModernCapabilities", [])
    pay_consumer = consumers[0] if len(consumers) == 1 else {}
    pay_event = pay_consumer.get("invalidationEvent", {})
    if (
        pay_consumer.get("capabilityId") != CAPABILITY
        or pay_event.get("name") != EVENT_V2
        or pay_event.get("version") != 2
        or set(pay_event.get("payloadRequired", [])) != EXACT_FIELDS
        or "snapshotId and snapshotRevision" not in pay_event.get("consumerAction", "")
        or "dual publish is forbidden" not in pay_event.get("consumerAction", "")
    ):
        errors.append("PAY consumer: exact v2 trigger/16 fields/refetch revision drift")

    owner_counts = Counter(row.get("contract_kind", "") for row in state["ownership"])
    expected_owner_counts = {
        **NON_MODERN_PRIMARY_COUNTS,
        "MODERN_OPERATION": len(expected_modern_operations),
        "MODERN_EVENT": len(payload_events),
    }
    if (
        len(state["ownership"]) != sum(expected_owner_counts.values())
        or dict(owner_counts) != expected_owner_counts
    ):
        errors.append("primary ownership: source-derived kind composition drift")
    actual_modern_operations = [
        row.get("contract_id", "")
        for row in state["ownership"]
        if row.get("contract_kind") == "MODERN_OPERATION"
    ]
    if (
        len(actual_modern_operations) != len(set(actual_modern_operations))
        or set(actual_modern_operations) != expected_modern_operations
    ):
        errors.append("primary ownership: canonical modern operation set drift")
    actual_modern_events = [
        row.get("contract_id", "")
        for row in state["ownership"]
        if row.get("contract_kind") == "MODERN_EVENT"
    ]
    if (
        len(actual_modern_events) != len(set(actual_modern_events))
        or set(actual_modern_events) != payload_events
    ):
        errors.append("primary ownership: canonical modern event set drift")
    if any(
        row.get("contract_kind") == "BASE_EVENT"
        and row.get("contract_id", "").partition(":")[2] in predecessor_names
        for row in state["ownership"]
    ):
        errors.append("primary ownership: superseded predecessor remains active")
    v2_owners = [row for row in state["ownership"] if row.get("contract_id") == EVENT_V2]
    if (
        len(v2_owners) != 1
        or v2_owners[0].get("contract_kind") != "MODERN_EVENT"
        or v2_owners[0].get("owner_session") != "HRIS-PER"
        or v2_owners[0].get("primary_slice_id") != "MOD-PER-COMPPLAN"
    ):
        errors.append("primary ownership: compensation v2 event owner drift")

    active_slices = [row for row in state["slices"] if row.get("gate_status") == "OPEN_G3_CODE"]
    active_role_fields = (
        "api_event_contract_refs", "primary_contract_refs", "related_contract_refs",
        "produced_xcon_refs", "consumed_xcon_refs",
    )
    active_refs = {
        ref
        for row in active_slices
        for field in active_role_fields
        for ref in split_pipe(row.get(field, ""))
    }
    if PREDECESSOR in active_refs or f"EVT-PER:{PREDECESSOR}" in active_refs:
        errors.append("G3 slices: predecessor remains in an active contract role")
    primary_locations = [
        row.get("slice_id", "") for row in active_slices
        if EVENT_V2 in split_pipe(row.get("primary_contract_refs", ""))
    ]
    if primary_locations != ["MOD-PER-COMPPLAN"]:
        errors.append("G3 slices: compensation v2 event must have one PER primary slice")

    return sorted(set(errors))


def self_test() -> dict[str, Any]:
    base = load_state()
    baseline_errors = validate_state(base)
    cases: dict[str, bool] = {}

    def rejected(name: str, mutate: Callable[[dict[str, Any]], None]) -> None:
        candidate = copy.deepcopy(base)
        mutate(candidate)
        cases[name] = not baseline_errors and bool(validate_state(candidate))

    def comp_trace(state: dict[str, Any]) -> dict[str, str]:
        return next(row for row in state["trace"] if row["capability_id"] == CAPABILITY)

    def listening_trace(state: dict[str, Any]) -> dict[str, str]:
        return next(
            row for row in state["trace"]
            if row["capability_id"] == LISTENING_CAPABILITY
        )

    def mutate_listening_authority_version(state: dict[str, Any]) -> None:
        authority = state["listening"]
        next(
            row for row in authority["eventOwnership"]["canonicalPublicEvents"]
            if row["eventName"] == "EmployeeListeningCohortProjectionPublished.v1"
        )["eventName"] = "EmployeeListeningCohortProjectionPublished.v2"
        authority["sealedPayloadSha256"] = canonical_hash_without_seal(authority)

    rejected(
        "dependency-v2-to-v1-rejected",
        lambda state: one(state["dependency"], "dependency_id", "DEP-019", [], "").update(
            {"contract": f"{SNAPSHOT_V1}|{PREDECESSOR}"}
        ),
    )
    rejected(
        "trace-predecessor-reactivation-rejected",
        lambda state: comp_trace(state).update(
            {"api_event_contracts": comp_trace(state)["api_event_contracts"].replace(EVENT_V2, PREDECESSOR)}
        ),
    )
    rejected(
        "trace-dual-publish-rejected",
        lambda state: comp_trace(state).update(
            {"api_event_contracts": comp_trace(state)["api_event_contracts"] + "|" + PREDECESSOR}
        ),
    )
    rejected(
        "all-capability-successor-closure-rejected",
        lambda state: state["trace"][0].update(
            {"api_event_contracts": "|".join(sorted(split_pipe(state["trace"][0]["api_event_contracts"]) - {next(ref for ref in split_pipe(state["trace"][0]["api_event_contracts"]) if not ref.startswith('/'))}))}
        ),
    )
    rejected(
        "listening-predecessor-reactivation-rejected",
        lambda state: listening_trace(state).update({
            "api_event_contracts": listening_trace(state)["api_event_contracts"].replace(
                "EmployeeListeningCohortProjectionPublished.v1",
                "EmployeeListeningResponseSubmitted.v2",
            )
        }),
    )
    rejected(
        "listening-authority-version-substitution-rejected",
        mutate_listening_authority_version,
    )
    rejected(
        "pay-consumer-field-drift-rejected",
        lambda state: state["pay"]["consumedModernCapabilities"][0]["invalidationEvent"]["payloadRequired"].remove("snapshotRevision"),
    )
    rejected(
        "per-producer-field-drift-rejected",
        lambda state: next(
            event for event in next(cap for cap in state["per"]["capabilities"] if cap["capabilityId"] == CAPABILITY)["events"]
            if event["name"] == EVENT_V2
        )["payloadRequired"].remove("correlationId"),
    )
    rejected(
        "primary-predecessor-reactivation-rejected",
        lambda state: state["ownership"].append({
            "contract_id": f"EVT-PER:{PREDECESSOR}", "contract_kind": "BASE_EVENT",
            "owner_session": "HRIS-PER", "primary_slice_id": "MOD-PER-COMPPLAN",
            "source_semantic_ref": f"EVT-PER:{PREDECESSOR}",
            "source_register_ref": f"G2_EVENT_CONTRACT#EVT-PER:{PREDECESSOR}",
            "rationale": "TARGET_FAMILY_SEMANTIC_OWNER", "status": "SEALED_G3_PRIMARY_OWNER",
        }),
    )
    rejected(
        "primary-modern-operation-omission-rejected",
        lambda state: state["ownership"].remove(next(
            row for row in state["ownership"]
            if row.get("contract_kind") == "MODERN_OPERATION"
        )),
    )
    rejected(
        "primary-modern-event-substitution-rejected",
        lambda state: next(
            row for row in state["ownership"]
            if row.get("contract_kind") == "MODERN_EVENT"
        ).update({"contract_id": "SyntheticUnregisteredEvent.v9"}),
    )
    rejected(
        "lineage-dual-publish-rejected",
        lambda state: next(
            row for row in state["lineage"]["lineage"] if row["predecessorEvent"] == PREDECESSOR
        )["runtimeDualPublish"].update({"required": True}),
    )
    rejected(
        "xcon-v2-to-v1-rejected",
        lambda state: one(state["xcon"], "contract_id", "XCON-021", [], "").update(
            {"canonical_name": PREDECESSOR}
        ),
    )
    return {
        "schema": "dwp.hris.compensation-snapshot-v2-authority-self-test.v1",
        "status": "PASS" if all(cases.values()) else "FAIL",
        "caseCount": len(cases),
        "passedCount": sum(cases.values()),
        "baselineValid": not baseline_errors,
        "baselineErrors": baseline_errors,
        "cases": cases,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--compact", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        payload = self_test()
    else:
        state = load_state()
        errors = validate_state(state)
        exact_operation_count = len({
            row.get("operationId", "")
            for row in state["exact"].get("operationBindings", [])
            if isinstance(row, dict) and row.get("operationId")
        })
        modern_event_count = len({
            row.get("eventName", "")
            for row in state["events"].get("eventPayloadSchemas", [])
            if isinstance(row, dict) and row.get("eventName")
        })
        expected_primary_count = (
            sum(NON_MODERN_PRIMARY_COUNTS.values())
            + exact_operation_count
            + modern_event_count
        )
        payload = {
            "schema": "dwp.hris.compensation-snapshot-v2-authority.v1",
            "status": "PASS" if not errors else "FAIL",
            "predecessorDisposition": "HISTORICAL_G2_LINEAGE_ONLY",
            "runtimeEvent": EVENT_V2,
            "runtimeEventFieldCount": len(EXACT_FIELDS),
            "traceCapabilityCount": 16,
            "primaryOwnershipCount": len(state["ownership"]),
            "canonicalExpectedPrimaryOwnershipCount": expected_primary_count,
            "primaryBaseEventCount": 48,
            "primaryModernOperationCount": sum(
                row.get("contract_kind") == "MODERN_OPERATION"
                for row in state["ownership"]
            ),
            "canonicalExpectedModernOperationCount": exact_operation_count,
            "primaryModernEventCount": sum(
                row.get("contract_kind") == "MODERN_EVENT"
                for row in state["ownership"]
            ),
            "canonicalExpectedModernEventCount": modern_event_count,
            "artifactSha256": {
                key: hashlib.sha256(path.read_bytes()).hexdigest()
                for key, path in PATHS.items()
            },
            "errors": errors,
        }
    print(json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":") if args.compact else None, indent=None if args.compact else 2))
    return 0 if payload["status"] == "PASS" else 1


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
