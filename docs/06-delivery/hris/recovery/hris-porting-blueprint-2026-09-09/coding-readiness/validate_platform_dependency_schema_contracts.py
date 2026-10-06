#!/usr/bin/env python3
"""Fail closed on exact G3 schemas and code/test bindings for six platform dependencies."""

from __future__ import annotations

import argparse
import copy
import csv
import hashlib
import json
import re
from pathlib import Path
from typing import Any, Callable


HERE = Path(__file__).resolve().parent
SCHEMAS = HERE / "platform-dependency-canonical-schemas.v1.json"
BINDINGS = HERE / "platform-dependency-schema-binding-register.csv"
DEPENDENCIES = HERE / "module-dependency-register.csv"

EXACT = {
    "DEP-004": {
        "contract": "CONFIG_LIFECYCLE_POLICY_REF_V1",
        "producer": "SYS_PLATFORM",
        "consumers": {"HRIS-HRM", "HRIS-PER", "HRIS-TIM", "HRIS-PAY", "HRIS-SYS"},
        "schemas": {"PDX_001", "PDX_002", "PDX_003"},
    },
    "DEP-005": {
        "contract": "AUTOMATION_HANDLER_AND_RECEIPT_V1",
        "producer": "SYS_PLATFORM",
        "consumers": {"HRIS-HRM", "HRIS-PER", "HRIS-TIM", "HRIS-PAY"},
        "schemas": {"PDX_004", "PDX_005", "PDX_006"},
    },
    "DEP-006": {
        "contract": "CONNECTOR_PORT_MAPPING_RECEIPT_V1",
        "producer": "SYS_PLATFORM",
        "consumers": {"HRIS-HRM", "HRIS-PER", "HRIS-TIM", "HRIS-PAY"},
        "schemas": {"PDX_007", "PDX_008", "PDX_009"},
    },
    "DEP-014": {
        "contract": "APPROVAL_REQUEST_DECISION_V1",
        "producer": "DWP_APPROVAL",
        "consumers": {"HRIS-HRM", "HRIS-PER", "HRIS-TIM", "HRIS-PAY", "HRIS-SYS"},
        "schemas": {"PDX_010", "PDX_011"},
    },
    "DEP-015": {
        "contract": "NOTIFICATION_INTENT_RECEIPT_V1",
        "producer": "DWP_NOTIFICATION",
        "consumers": {"HRIS-HRM", "HRIS-PER", "HRIS-TIM", "HRIS-PAY", "HRIS-SYS"},
        "schemas": {"PDX_012", "PDX_013"},
    },
    "DEP-016": {
        "contract": "AUDIT_OUTBOX_EVENT_V1",
        "producer": "DWP_AUDIT",
        "consumers": {"HRIS-HRM", "HRIS-PER", "HRIS-TIM", "HRIS-PAY", "HRIS-SYS"},
        "schemas": {"PDX_014"},
    },
}

EXACT_FIELDS = {
    "PDX_001": {"configurationId", "configurationType", "scopeType", "scopeId", "version", "state", "effectiveFrom", "effectiveTo", "payloadSchemaVersion", "payloadDigest", "approvalReceiptId"},
    "PDX_002": {"configurationId", "configurationType", "scopeType", "scopeId", "version", "effectiveFrom", "effectiveTo", "payloadSchemaVersion", "payloadDigest", "approvalReceiptId", "publishedAt", "eventSequence"},
    "PDX_003": {"configurationId", "configurationType", "scopeType", "scopeId", "invalidatedVersion", "replacementVersion", "reasonCode", "invalidatedAt", "eventSequence"},
    "PDX_004": {"handlerKey", "ownerService", "contractVersion", "inputSchemaRef", "receiptSchemaRef", "signatureDigest", "allowedScopeTypes", "retryMode", "maxAttempts", "state"},
    "PDX_005": {"invocationId", "automationId", "automationVersion", "handlerKey", "handlerContractVersion", "scopeType", "scopeId", "requestedAt", "requestedByActorRef", "idempotencyKey", "inputRef", "inputDigest", "expectedItemCount", "correlationId"},
    "PDX_006": {"runId", "runRevision", "itemId", "itemSequence", "subjectRef", "state", "attemptNumber", "acceptedAt", "completedAt", "resultRef", "resultDigest", "errorCode", "retryable", "nextAttemptAt", "correlationId"},
    "PDX_007": {"connectorId", "mappingId", "version", "state", "sourceSchemaVersion", "targetSchemaVersion", "mappingDigest", "dryRunDigest", "authoredByActorRef", "approvedByActorRef", "approvalReceiptId", "effectiveFrom", "effectiveTo", "compatibilityMode"},
    "PDX_008": {"executionId", "connectorId", "mappingId", "mappingVersion", "mode", "direction", "scopeType", "scopeId", "sourceRef", "sourceDigest", "requestedAt", "requestedByActorRef", "idempotencyKey", "correlationId"},
    "PDX_009": {"executionId", "receiptId", "mappingVersion", "state", "sourceCount", "acceptedCount", "rejectedCount", "quarantinedCount", "sourceDigest", "resultDigest", "errorReportRef", "reconciliationDigest", "completedAt", "correlationId"},
    "PDX_010": {"requestId", "workflowKey", "workflowVersion", "subjectRef", "subjectRevision", "requesterRef", "requestedAction", "payloadRef", "payloadDigest", "state", "requestedAt", "correlationId", "idempotencyKey"},
    "PDX_011": {"eventId", "requestId", "workflowVersion", "subjectRef", "subjectRevision", "requestRevision", "decision", "decisionActorRef", "decisionAt", "approvalReceiptId", "reasonCode", "decisionDigest", "correlationId"},
    "PDX_012": {"intentId", "sourceEventId", "tenantId", "producerAppKey", "typeKey", "purposeCode", "recipientUserIds", "excludedUserIds", "threadRef", "locale", "reasonCode", "actorRef", "subjectRef", "targetRef", "templateKey", "templateVersion", "templateModelDigest", "classification", "actionRequired", "dueAt", "requestedAt", "idempotencyKey", "correlationId"},
    "PDX_013": {"receiptId", "intentId", "sourceEventId", "tenantId", "recipientUserId", "receiptSequence", "state", "channel", "decisionCode", "reasonCode", "notificationId", "policyRevision", "templateVersion", "materializedDigest", "providerReceiptDigest", "attemptNumber", "occurredAt", "errorCode", "retryable", "nextAttemptAt", "correlationId"},
    "PDX_014": {"eventId", "tenantId", "occurredAt", "sourceService", "sourceModule", "aggregateType", "aggregateRef", "aggregateRevision", "action", "outcome", "actorType", "actorRef", "effectiveCapability", "purposeCode", "authorizationDecisionRef", "scopeRevision", "fieldPolicyRevision", "delegationRef", "supportSessionRef", "stepUpReceiptRef", "approvalReceiptId", "targetRef", "reasonCode", "errorCode", "beforeDigest", "afterDigest", "evidenceDigest", "classification", "retentionClass", "causationId", "correlationId"},
}

EXACT_INVARIANTS = {
    "PDX_001": {"globalScope", "effectiveRange", "resolution", "publishedApproval"},
    "PDX_002": {"source", "ordering", "consumer"},
    "PDX_003": {"ordering", "consumer"},
    "PDX_004": {"execution", "compatibility", "activation"},
    "PDX_005": {"idempotency", "dispatch", "retry"},
    "PDX_006": {"identity", "terminal", "retry", "counts"},
    "PDX_007": {"fourEyes", "activation", "effectiveRange"},
    "PDX_008": {"idempotency", "execution", "secrets"},
    "PDX_009": {"counts", "terminal", "partial", "reconciliation"},
    "PDX_010": {"authority", "idempotency", "version"},
    "PDX_011": {"ordering", "idempotency", "domainGuard", "separation", "authority"},
    "PDX_012": {"recipients", "idempotency", "policy", "privacy"},
    "PDX_013": {"state", "ordering", "privacy", "retry"},
    "PDX_014": {"policy", "failure", "evidenceOnly", "privacy"},
}

EXACT_NEW_INVARIANT_VALUES = {
    "PDX_012": {
        "recipients": "RECIPIENTS_MINUS_EXCLUSIONS_MUST_REMAIN_NONEMPTY_AND_BOUNDED",
        "idempotency": "SOURCE_EVENT_INTENT_AND_IDEMPOTENCY_KEY_BIND_TEMPLATE_MODEL_DIGEST",
        "policy": "NOTIFICATION_POLICY_SELECTS_CHANNEL_AND_TEMPLATE_WITHOUT_PRODUCER_OVERRIDE",
        "privacy": "NO_RAW_TEMPLATE_VARIABLE_BODY_CHANNEL_OR_PROVIDER_DATA",
    },
    "PDX_013": {
        "state": "STATE_CHANNEL_NOTIFICATION_PROVIDER_AND_RETRY_FIELDS_FORM_AN_EXACT_VALID_COMBINATION",
        "ordering": "INTENT_RECIPIENT_RECEIPT_SEQUENCE_IS_MONOTONIC_AND_IDEMPOTENT",
        "privacy": "NO_PROVIDER_REFERENCE_RAW_CONTENT_OR_TEMPLATE_MODEL_IS_EXPOSED",
        "retry": "RETRYABLE_STATE_ALONE_MAY_HAVE_NEXT_ATTEMPT_AND_FAILURE_METADATA",
    },
    "PDX_014": {
        "policy": "CAPABILITY_PURPOSE_SCOPE_AND_FIELD_POLICY_REVISIONS_BIND_THE_DECISION",
        "failure": "DENIED_OR_FAILED_OUTCOME_REQUIRES_ERROR_CODE_AND_EVIDENCE_DIGEST",
        "evidenceOnly": "DELEGATION_SUPPORT_STEP_UP_AND_APPROVAL_REFS_ARE_EVIDENCE_NOT_AUTHORITY",
        "privacy": "NO_RAW_BEFORE_AFTER_METADATA_DISPLAY_NAME_SESSION_OR_NETWORK_ADDRESS",
    },
}

PROVIDER_TEST_ROOTS = {
    "SYS_PLATFORM": "dwp-platform-server/src/test/java/com/dwp/services/platform/hriscontracts/",
    "DWP_APPROVAL": "dwp-approval-server/src/test/java/com/dwp/services/approval/hriscontracts/",
    "DWP_NOTIFICATION": "dwp-notification-server/src/test/java/com/dwp/services/notification/hriscontracts/",
    "DWP_AUDIT": "dwp-core/src/test/java/com/dwp/core/audit/hriscontracts/",
}

CONSUMER_TEST_ROOTS = {
    "HRIS-HRM": "dwp-people-server/src/test/java/com/dwp/services/people/hris/core/",
    "HRIS-PER": "dwp-people-server/src/test/java/com/dwp/services/people/hris/performance/",
    "HRIS-TIM": "dwp-time-server/src/test/java/com/dwp/services/time/hris/",
    "HRIS-PAY": "dwp-payroll-server/src/test/java/com/dwp/services/payroll/hris/",
    "HRIS-SYS": "dwp-platform-server/src/test/java/com/dwp/services/platform/hrisconfiguration/",
}

EXPECTED_HEADER = [
    "binding_id", "dependency_id", "contract_key", "schema_id", "schema_title",
    "producer", "consumers", "canonical_generated_import", "producer_generated_import",
    "consumer_generated_imports", "producer_test_refs", "consumer_test_refs",
    "delivery_mode", "g3_state", "g6_boundary", "normalized_schema_sha256",
]


def read_rows(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames != EXPECTED_HEADER:
            raise ValueError(f"binding header drift: {reader.fieldnames}")
        return list(reader)


def read_dependencies() -> dict[str, dict[str, str]]:
    with DEPENDENCIES.open(newline="", encoding="utf-8") as handle:
        return {row["dependency_id"]: row for row in csv.DictReader(handle)}


def split_set(value: str, separator: str = "|") -> set[str]:
    return {item for item in value.split(separator) if item}


def parse_map(value: str) -> dict[str, str]:
    result: dict[str, str] = {}
    for item in value.split(";"):
        if not item or ":" not in item:
            raise ValueError("typed session map must contain SESSION:value entries")
        session, mapped = item.split(":", 1)
        if not session or not mapped or session in result:
            raise ValueError("typed session map has an empty or duplicate entry")
        result[session] = mapped
    return result


def normalized_digest(schema: dict[str, Any]) -> str:
    encoded = json.dumps(schema, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(encoded).hexdigest()


def local_refs(value: Any) -> set[str]:
    refs: set[str] = set()
    if isinstance(value, dict):
        ref = value.get("$ref")
        if isinstance(ref, str) and ref.startswith("#/$defs/"):
            refs.add(ref.removeprefix("#/$defs/"))
        for child in value.values():
            refs |= local_refs(child)
    elif isinstance(value, list):
        for child in value:
            refs |= local_refs(child)
    return refs


def validate_payload(rows: list[dict[str, str]], schemas: dict[str, Any], dependencies: dict[str, dict[str, str]]) -> tuple[list[str], int]:
    errors: list[str] = []
    checks = 0
    definitions = schemas.get("$defs", {})
    checks += 4
    if schemas.get("$schema") != "https://json-schema.org/draft/2020-12/schema":
        errors.append("canonical schema must use JSON Schema draft 2020-12")
    if schemas.get("$id") != "urn:dwp:hris:platform-dependency-canonical-schemas:v1":
        errors.append("canonical schema id drift")
    if set(EXACT_FIELDS) - set(definitions):
        errors.append("one or more exact PDX schemas are missing")
    if len(rows) != 14:
        errors.append(f"binding register must contain exact 14 schema rows; got {len(rows)}")

    ids = [row.get("binding_id", "") for row in rows]
    schema_ids = [row.get("schema_id", "") for row in rows]
    checks += 2
    if len(ids) != len(set(ids)) or any(not value for value in ids):
        errors.append("binding ids must be unique and non-empty")
    if set(schema_ids) != set(EXACT_FIELDS) or len(schema_ids) != len(set(schema_ids)):
        errors.append("binding register must bind each exact PDX schema once")

    for dependency_id, expected in EXACT.items():
        dependency = dependencies.get(dependency_id)
        checks += 5
        if dependency is None:
            errors.append(f"{dependency_id}: dependency row missing")
            continue
        if dependency.get("contract") != expected["contract"]:
            errors.append(f"{dependency_id}: dependency contract drift")
        if dependency.get("producer") != expected["producer"]:
            errors.append(f"{dependency_id}: dependency producer drift")
        dependency_consumers = split_set(dependency.get("consumer", ""))
        normalized_consumers = {f"HRIS-{item}" for item in dependency_consumers if item != "ALL"}
        if "ALL" in dependency_consumers:
            normalized_consumers = {"HRIS-HRM", "HRIS-PER", "HRIS-TIM", "HRIS-PAY", "HRIS-SYS"}
        if normalized_consumers != expected["consumers"]:
            errors.append(f"{dependency_id}: dependency consumer set drift")
        if dependency.get("required_for_consumer_stage") != "G3" or dependency.get("status") != "READY":
            errors.append(f"{dependency_id}: dependency is not a ready G3 contract")

        actual_schemas = {row["schema_id"] for row in rows if row.get("dependency_id") == dependency_id}
        if actual_schemas != expected["schemas"]:
            errors.append(f"{dependency_id}: exact schema membership drift")

    all_refs = local_refs(schemas)
    checks += 1
    if all_refs - set(definitions):
        errors.append(f"unresolved local schema refs: {sorted(all_refs - set(definitions))}")

    for schema_id, fields in EXACT_FIELDS.items():
        where = schema_id
        schema = definitions.get(schema_id, {})
        checks += 7
        if schema.get("type") != "object" or schema.get("additionalProperties") is not False:
            errors.append(f"{where}: schema must be a closed object")
        if set(schema.get("properties", {})) != fields:
            errors.append(f"{where}: exact property set drift")
        if set(schema.get("required", [])) != fields:
            errors.append(f"{where}: every exact property must be required with nullable types used explicitly")
        if set(schema.get("x-invariants", {})) != EXACT_INVARIANTS[schema_id]:
            errors.append(f"{where}: invariant key set drift")
        if any(not str(value).strip() for value in schema.get("x-invariants", {}).values()):
            errors.append(f"{where}: invariant value is empty")
        if schema_id in EXACT_NEW_INVARIANT_VALUES and schema.get("x-invariants") != EXACT_NEW_INVARIANT_VALUES[schema_id]:
            errors.append(f"{where}: exact runtime invariant semantics drift")
        if not schema.get("title", "").endswith(".v1"):
            errors.append(f"{where}: versioned title missing")
        if local_refs(schema) - set(definitions):
            errors.append(f"{where}: unresolved local reference")

    checks += 9
    if definitions.get("PositiveId") != {"type": "integer", "minimum": 1, "maximum": 9223372036854775807}:
        errors.append("PositiveId must be the exact positive signed-Long identifier type")
    if definitions.get("Locale") != {
        "type": "string",
        "minLength": 2,
        "maxLength": 35,
        "pattern": "^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$",
    }:
        errors.append("Locale must remain the bounded canonical BCP47 contract")
    intent_properties = definitions.get("PDX_012", {}).get("properties", {})
    for field, minimum in (("recipientUserIds", 1), ("excludedUserIds", 0)):
        expected_array = {
            "type": "array",
            "minItems": minimum,
            "maxItems": 100,
            "uniqueItems": True,
            "items": {"$ref": "#/$defs/PositiveId"},
        }
        if intent_properties.get(field) != expected_array:
            errors.append(f"PDX_012: {field} must be an exact bounded unique PositiveId array")
    if intent_properties.get("classification", {}).get("enum") != ["INTERNAL", "CONFIDENTIAL", "RESTRICTED"]:
        errors.append("PDX_012: classification enum drift")
    receipt_properties = definitions.get("PDX_013", {}).get("properties", {})
    if receipt_properties.get("state", {}).get("enum") != ["RECEIVED", "ADMITTED", "SUPPRESSED", "MATERIALIZED", "QUEUED", "DELIVERED", "FAILED", "DEAD_LETTERED", "CANCELED"]:
        errors.append("PDX_013: receipt state enum drift")
    if receipt_properties.get("channel", {}).get("enum") != ["NONE", "IN_APP", "EMAIL", "PUSH", "SMS"]:
        errors.append("PDX_013: channel enum drift")
    audit_properties = definitions.get("PDX_014", {}).get("properties", {})
    if audit_properties.get("outcome", {}).get("enum") != ["SUCCESS", "DENIED", "FAILED"]:
        errors.append("PDX_014: outcome enum drift")
    if audit_properties.get("actorType", {}).get("enum") != ["USER", "SERVICE", "SYSTEM", "AGENT"]:
        errors.append("PDX_014: actor type enum drift")
    if audit_properties.get("retentionClass", {}).get("enum") != ["STANDARD", "EXTENDED", "LEGAL_HOLD"]:
        errors.append("PDX_014: retention class enum drift")

    expected_modes = {"SYNC", "EVENT", "ASYNC_COMMAND", "ASYNC_RECEIPT", "SYNC_COMMAND"}
    java_import = re.compile(r"^com\.dwp\.platform\.contracts\.hris\.generated\.[A-Za-z][A-Za-z0-9]+V1$")
    for row in rows:
        where = row.get("binding_id", "<missing>")
        dependency = EXACT.get(row.get("dependency_id", ""))
        schema = definitions.get(row.get("schema_id", ""), {})
        checks += 19
        if dependency is None:
            errors.append(f"{where}: unsupported dependency")
            continue
        if row.get("contract_key") != dependency["contract"]:
            errors.append(f"{where}: contract key drift")
        expected_binding_id = f"PDB-{row.get('schema_id', '').removeprefix('PDX_')}"
        if row.get("binding_id") != expected_binding_id:
            errors.append(f"{where}: binding id must exactly track the schema id")
        if row.get("producer") != dependency["producer"]:
            errors.append(f"{where}: producer drift")
        consumers = split_set(row.get("consumers", ""))
        if consumers != dependency["consumers"]:
            errors.append(f"{where}: exact consumer set drift")
        if row.get("schema_title") != schema.get("title"):
            errors.append(f"{where}: schema title drift")
        if row.get("normalized_schema_sha256") != normalized_digest(schema):
            errors.append(f"{where}: normalized schema digest drift")
        canonical_import = row.get("canonical_generated_import", "")
        if not java_import.fullmatch(canonical_import):
            errors.append(f"{where}: canonical generated import naming drift")
        expected_class = str(schema.get("title", "")).replace(".v1", "V1")
        if canonical_import != f"com.dwp.platform.contracts.hris.generated.{expected_class}":
            errors.append(f"{where}: canonical generated class does not derive from the exact schema title")
        if row.get("producer_generated_import") != canonical_import:
            errors.append(f"{where}: producer must import the canonical generated type")
        try:
            consumer_imports = parse_map(row.get("consumer_generated_imports", ""))
            consumer_tests = parse_map(row.get("consumer_test_refs", ""))
        except ValueError as error:
            errors.append(f"{where}: {error}")
            consumer_imports, consumer_tests = {}, {}
        if set(consumer_imports) != consumers or set(consumer_imports.values()) != {canonical_import}:
            errors.append(f"{where}: every consumer must import the same canonical generated type")
        if set(consumer_tests) != consumers:
            errors.append(f"{where}: consumer contract-test allocation is not exact")
        if any(not path.endswith("ConsumerContractTest.java") for path in consumer_tests.values()):
            errors.append(f"{where}: consumer contract-test path drift")
        expected_provider_test = f"{PROVIDER_TEST_ROOTS[dependency['producer']]}{expected_class}ProviderContractTest.java"
        if row.get("producer_test_refs") != expected_provider_test:
            errors.append(f"{where}: provider contract-test allocation missing")
        expected_consumer_tests = {
            session: f"{CONSUMER_TEST_ROOTS[session]}{expected_class}ConsumerContractTest.java"
            for session in consumers
        }
        if consumer_tests != expected_consumer_tests:
            errors.append(f"{where}: consumer contract-test exact path drift")
        if row.get("delivery_mode") not in expected_modes:
            errors.append(f"{where}: unsupported delivery mode")
        if row.get("g3_state") != "NOT_STARTED_G3":
            errors.append(f"{where}: G3 state must remain truthful")
        if "G6" not in row.get("g6_boundary", ""):
            errors.append(f"{where}: explicit G6 boundary missing")

    return errors, checks


def run_self_tests(rows: list[dict[str, str]], schemas: dict[str, Any], dependencies: dict[str, dict[str, str]]) -> tuple[list[dict[str, Any]], list[str]]:
    cases: list[dict[str, Any]] = []
    failures: list[str] = []

    def rejected(name: str, mutate: Callable[[list[dict[str, str]], dict[str, Any], dict[str, dict[str, str]]], None]) -> None:
        test_rows, test_schemas, test_dependencies = copy.deepcopy(rows), copy.deepcopy(schemas), copy.deepcopy(dependencies)
        mutate(test_rows, test_schemas, test_dependencies)
        errors, _ = validate_payload(test_rows, test_schemas, test_dependencies)
        status = "PASS" if errors else "FAIL"
        cases.append({"name": name, "status": status, "rejectedErrorCount": len(errors)})
        if status != "PASS":
            failures.append(f"self-test {name} was not rejected")

    rejected("schema-property-drift", lambda r, s, d: s["$defs"]["PDX_004"]["properties"].pop("signatureDigest"))
    rejected("schema-open-object", lambda r, s, d: s["$defs"]["PDX_008"].update({"additionalProperties": True}))
    rejected("schema-required-drift", lambda r, s, d: s["$defs"]["PDX_010"]["required"].remove("payloadDigest"))
    rejected("unresolved-ref", lambda r, s, d: s["$defs"]["PDX_001"]["properties"].update({"payloadDigest": {"$ref": "#/$defs/Missing"}}))
    rejected("digest-drift", lambda r, s, d: r[0].update({"normalized_schema_sha256": "0" * 64}))
    rejected("producer-import-drift", lambda r, s, d: r[3].update({"producer_generated_import": "com.example.LocalDto"}))
    rejected("consumer-import-drift", lambda r, s, d: r[4].update({"consumer_generated_imports": r[4]["consumer_generated_imports"].replace("HRIS-PAY:com.dwp", "HRIS-PAY:com.local", 1)}))
    rejected("consumer-test-missing", lambda r, s, d: r[6].update({"consumer_test_refs": r[6]["consumer_test_refs"].split(";", 1)[0]}))
    rejected("dependency-contract-drift", lambda r, s, d: d["DEP-014"].update({"contract": "LOCAL_APPROVAL_DTO"}))
    rejected("dependency-schema-membership-drift", lambda r, s, d: r[10].update({"dependency_id": "DEP-006"}))
    rejected("notification-recipient-item-type-drift", lambda r, s, d: s["$defs"]["PDX_012"]["properties"]["recipientUserIds"].update({"items": {"$ref": "#/$defs/Reference"}}))
    rejected("notification-empty-recipient-bound-drift", lambda r, s, d: s["$defs"]["PDX_012"]["properties"]["recipientUserIds"].update({"minItems": 0}))
    rejected("notification-runtime-invariant-semantic-drift", lambda r, s, d: s["$defs"]["PDX_012"]["x-invariants"].update({"policy": "PRODUCER_SELECTS_CHANNEL"}))
    rejected("notification-receipt-state-drift", lambda r, s, d: s["$defs"]["PDX_013"]["properties"]["state"]["enum"].append("UNKNOWN"))
    rejected("audit-outcome-drift", lambda r, s, d: s["$defs"]["PDX_014"]["properties"]["outcome"].update({"enum": ["SUCCESS", "FAILED"]}))
    rejected("notification-provider-path-drift", lambda r, s, d: r[11].update({"producer_test_refs": "dwp-platform-server/src/test/java/LocalProviderContractTest.java"}))
    rejected("audit-consumer-path-drift", lambda r, s, d: r[13].update({"consumer_test_refs": r[13]["consumer_test_refs"].replace("dwp-payroll-server/src/test/java/com/dwp/services/payroll/hris/", "dwp-payroll-server/src/test/java/com/dwp/services/payroll/local/")}))
    rejected("binding-id-schema-id-drift", lambda r, s, d: r[12].update({"binding_id": "PDB-099"}))
    return cases, failures


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    try:
        rows = read_rows(BINDINGS)
        schemas = json.loads(SCHEMAS.read_text(encoding="utf-8"))
        dependencies = read_dependencies()
        errors, checks = validate_payload(rows, schemas, dependencies)
    except (OSError, csv.Error, json.JSONDecodeError, ValueError) as error:
        print(json.dumps({"schema": "dwp.hris.platform-dependency-schema-contracts.v1", "status": "FAIL", "errors": [str(error)]}, indent=2))
        return 1

    if args.self_test:
        cases, failures = run_self_tests(rows, schemas, dependencies)
        payload = {"schema": "dwp.hris.platform-dependency-schema-contracts-self-test.v1", "status": "PASS" if not errors and not failures else "FAIL", "baseErrors": errors, "cases": cases, "errors": failures}
    else:
        payload = {
            "schema": "dwp.hris.platform-dependency-schema-contracts.v1",
            "status": "PASS" if not errors else "FAIL",
            "checks": checks,
            "coverage": {"dependencyCount": 6, "schemaCount": len(rows), "providerTestAllocationCount": len(rows), "consumerTestAllocationCount": sum(len(split_set(row["consumers"])) for row in rows), "generatedImportMatchCount": sum(row["canonical_generated_import"] == row["producer_generated_import"] for row in rows)},
            "states": {"implementation": "NOT_STARTED_G3", "production": "NOT_AUTHORIZED_G6"},
            "errors": errors,
        }
    print(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True))
    return 0 if payload["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
