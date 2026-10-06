#!/usr/bin/env python3
"""Shared static design and one-way canonical projection for SYS Listening.

Dependency direction is intentionally fixed:
  this static design -> canonical five -> derived Listening summary ->
  downstream causal/event/SYS lineage.

This source never reads the generated Listening summary and never writes an
artifact. Canonical documents may carry this design identity/digest, but may
not reference the derived summary path, contract, file hash, or seal.
"""

from __future__ import annotations

import copy
import hashlib
import json
from pathlib import Path
from typing import Any, Mapping

from modern_successor_reader_guard import require_active_reader_guard


HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
DESIGN_ID = "dwp.hris.sys.listening.canonical-static-design.v1"
SUMMARY_ID = "dwp.hris.sys.listening.stream-authority-successor.v1"
SUMMARY_PATH = "coding-readiness/sys-listening-stream-authority-successor.v1.json"
SUMMARY_V2_ID = "dwp.hris.sys.listening.stream-authority-successor.v2"
SUMMARY_V2_PATH = "coding-readiness/sys-listening-stream-authority-successor.v2.json"

# The wire representation is deliberately fixed for both approved algorithms:
# Ed25519 and P-256 signatures are each 64 raw bytes when P-256 uses the
# fixed-width IEEE-P1363 r||s encoding.  Unpadded base64url is therefore
# exactly bounded by 86 ASCII bytes.  Every named signature/algorithm field is
# normalized from this one profile before the authority is sealed.
LISTENING_SIGNATURE_ALGORITHMS = ("ED25519", "ECDSA_P256_SHA256")
LISTENING_SIGNATURE_SERIALIZATION = "BASE64URL_UNPADDED_P1363_FIXED_64_BYTE_SIGNATURE"
LISTENING_SIGNATURE_MAX_BYTES = 86
LISTENING_SIGNATURE_ALGORITHM_MAX_BYTES = max(
    len(algorithm) for algorithm in LISTENING_SIGNATURE_ALGORITHMS
)
LISTENING_SIGNATURE_PROFILE = {
    "serialization": LISTENING_SIGNATURE_SERIALIZATION,
    "maxBytes": LISTENING_SIGNATURE_MAX_BYTES,
    "allowedAlgorithms": list(LISTENING_SIGNATURE_ALGORITHMS),
    "ed25519Encoding": "RAW_FIXED_64_BYTE_SIGNATURE",
    "ecdsaP256Encoding": "IEEE_P1363_FIXED_64_BYTE_R_CONCAT_S;ASN1_DER_FORBIDDEN",
    "algorithmMaxBytes": LISTENING_SIGNATURE_ALGORITHM_MAX_BYTES,
    "algorithmValidation": "ED25519|ECDSA_P256_SHA256",
}

CANONICAL_INPUTS: tuple[tuple[str, str, str, str], ...] = (
    ("operationCausal", "coding-readiness/modern-capability-operation-causal-contract-ssot.v2.json", "contractId", "dwp.hris.modern.operation-causal-state.reviewed-candidate.v2"),
    ("semanticBindings", "coding-readiness/modern-capability-semantic-bindings.v1.json", "registryId", "dwp.hris.modern.operation-semantic-bindings.v1"),
    ("publicIdentities", "coding-readiness/modern-capability-public-identity-registry.v1.json", "registryId", "dwp.hris.modern.public-identities.v1"),
    ("exactSchemas", "coding-readiness/modern-capability-exact-schema-contracts.v1.json", "contractId", "dwp.hris.modern.exact-schema.v1"),
    ("eventPayloads", "coding-readiness/modern-capability-event-payload-contracts.v1.json", "contractId", "dwp.hris.modern.event-payloads.v1"),
)

def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def canonical_payload(value: dict[str, Any]) -> bytes:
    payload = {key: item for key, item in value.items() if key != "sealedPayloadSha256"}
    return json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def stream(
    *,
    key: str,
    service: str,
    context: str,
    schema: str,
    history: str,
    migration_location: str,
    migration_allocation: str,
    migration_owner: str,
    migration_principal: str,
    runtime_principals: list[dict[str, Any]],
    source_root: str,
    test_root: str,
    source_allocation: str,
    test_allocation: str,
    migration_file_allocation: str,
    first_migration: str,
) -> dict[str, Any]:
    return {
        "streamKey": key,
        "ownerService": service,
        "boundedContext": context,
        "catalogBoundary": (
            "AUTH_CATALOG_SUPPLEMENTAL_DATASOURCE"
            if service == "dwp-auth-server"
            else "PLATFORM_CATALOG_SUPPLEMENTAL_DATASOURCE"
        ),
        "databaseSchema": schema,
        "historyTable": history,
        "migrationLocation": migration_location,
        "migrationAllocationId": migration_allocation,
        "migrationOwnershipId": migration_owner,
        "migrationPrincipal": migration_principal,
        "runtimePrincipals": runtime_principals,
        "sourceRoot": source_root,
        "testRoot": test_root,
        "sourceAllocationId": source_allocation,
        "testAllocationId": test_allocation,
        "migrationFileAllocationId": migration_file_allocation,
        "controlBootstrapAllocationId": {
            "platform-hris-configuration": "G3-CTL-SYS-LISTEN-CONFIGURATION-STREAM",
            "platform-hris-listening-protected": "G3-CTL-SYS-LISTEN-PROTECTED-STREAM",
            "platform-hris-insights": "G3-CTL-SYS-LISTEN-INSIGHTS-STREAM",
            "auth-hris-participation-issuer": "G3-CTL-SYS-LISTEN-ISSUER-STREAM",
        }[key],
        "firstReservedMigration": first_migration,
        "migrationRange": {"baselineHighWater": 0, "start": 1, "end": 40},
        "crossSchemaForeignKeysAllowed": False,
        "foreignLocalIdsAllowed": False,
        "foreignRepositoryImportsAllowed": False,
        "applicationDdlAllowed": False,
        "implementationState": "NOT_STARTED_G3",
    }


def table(name: str, stream_key: str, local_foreign_keys: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    return {
        "tableName": name,
        "streamKey": stream_key,
        "tenantScoped": True,
        "publicIdentity": "UUID_PUBLIC_ID_WHEN_EXTERNALLY_REFERENCED",
        "localForeignKeys": local_foreign_keys or [],
        "crossSchemaForeignKeys": [],
        "foreignLocalIdColumns": [],
        "implementationState": "NOT_STARTED_G4",
    }


def fk(columns: list[str], target: str, target_columns: list[str]) -> dict[str, Any]:
    return {
        "columns": columns,
        "targetTable": target,
        "targetColumns": target_columns,
        "mode": "TENANT_LOCAL_COMPOSITE_FK",
    }


def contract_field(
    name: str,
    field_type: str,
    *,
    required: bool = True,
    sensitivity: str = "INTERNAL",
    validation: str = "EXACT_TYPED_VALUE",
    value_schema: dict[str, Any] | None = None,
    condition: str | None = None,
) -> dict[str, Any]:
    result = {
        "name": name,
        "type": field_type,
        "required": required,
        "sensitivity": sensitivity,
        "validation": validation,
    }
    if value_schema is not None:
        result["valueSchema"] = value_schema
    if condition is not None:
        result["condition"] = condition
    return result


def apply_signature_contracts(value: Any) -> None:
    """Freeze every typed Listening signature and algorithm representation.

    This traverses only structured contract fields (never prose values), so
    the authority cannot drift between an owner-port request, nested signed
    credential, signed response, or internal envelope.
    """
    if isinstance(value, list):
        for item in value:
            apply_signature_contracts(item)
        return
    if not isinstance(value, dict):
        return
    if value.get("type") == "STRING":
        if value.get("name") in {"ownerSignature", "signature"}:
            value.update({
                "serialization": LISTENING_SIGNATURE_SERIALIZATION,
                "maxBytes": LISTENING_SIGNATURE_MAX_BYTES,
                "allowedAlgorithms": list(LISTENING_SIGNATURE_ALGORITHMS),
                "ed25519Encoding": "RAW_FIXED_64_BYTE_SIGNATURE",
                "ecdsaEncoding": "IEEE_P1363_FIXED_64_BYTE_R_CONCAT_S;ASN1_DER_FORBIDDEN",
                "validation": (
                    "BASE64URL_UNPADDED_P1363_FIXED_64_BYTE_SIGNATURE;"
                    "ED25519|ECDSA_P256_SHA256"
                ),
            })
        elif value.get("name") in {"signatureAlgorithm", "alg", "algorithm"}:
            value.update({
                "maxBytes": LISTENING_SIGNATURE_ALGORITHM_MAX_BYTES,
                "allowedValues": list(LISTENING_SIGNATURE_ALGORITHMS),
                "validation": "ED25519|ECDSA_P256_SHA256",
            })
    for child in value.values():
        apply_signature_contracts(child)


def owner_port_contract(
    *,
    name: str,
    stream_key: str,
    kind: str,
    execution_class: str,
    entrypoint_ref: dict[str, str],
    request_fields: list[dict[str, Any]],
    caller_auth: dict[str, Any],
    purpose: str,
    selectors: list[dict[str, Any]],
    ordered_dml: list[dict[str, Any]],
    pre_states: list[str],
    post_states: list[str],
    receipt_table: str | None,
    outbox_table: str | None,
    response_fields: list[dict[str, Any]],
    completion_handler_id: str | None = None,
    delivery_class: str = "OWNER_LOCAL_ONLY",
) -> dict[str, Any]:
    row: dict[str, Any] = {
        "ownerPortOperation": name,
        "streamKey": stream_key,
        "kind": kind,
        "executionClass": execution_class,
        "entrypointRef": entrypoint_ref,
        "requestSchema": {
            "schemaId": name + ".Request.v2",
            "additionalProperties": False,
            "fields": request_fields,
        },
        "callerAuth": caller_auth,
        "pep": {
            "tenant": "verified request tenant equals owner-local tenant",
            "purpose": purpose,
            "population": "exact authorized population or owner-service scope",
            "fieldPolicy": "minimum named fields only; deny unknown or unavailable policy",
            "denyOnUnavailable": True,
        },
        "selectors": selectors,
        "orderedDml": [
            {
                "step": index,
                "action": item["action"],
                "table": item["table"],
                "assignments": item["assignments"],
                "expectedRows": item["expectedRows"],
            }
            for index, item in enumerate(ordered_dml, 1)
        ],
        "stateAndCas": {
            "preStates": pre_states,
            "postStates": post_states,
            "expectedVersion": "EXACT_REQUEST_OR_LOCKED_OWNER_VERSION",
            "lock": "TENANT_BOUND_OWNER_LOCAL_LOCK_BEFORE_MUTATION",
            "idempotency": (
                "tenant+ownerPortOperation+caller+idempotencyKey with stored canonical digest"
                if ordered_dml else "NOT_APPLICABLE_READ_ONLY"
            ),
            "concurrency": (
                "SAME_EXPECTED_VERSION_EXACTLY_ONE_WINNER; LOSER_ZERO_MUTATION"
                if ordered_dml else "CONSISTENT_OWNER_READ_SNAPSHOT"
            ),
        },
        "receiptAndOutbox": ({
            "receiptTable": receipt_table,
            "outboxTable": outbox_table,
            "deliveryClass": delivery_class,
            "atomicity": (
                "OWNER_LOCAL_DOMAIN_AND_PRIVATE_RECEIPT_ONE_TRANSACTION;BROKER_OUTBOX_FORBIDDEN"
                if outbox_table is None else
                "OWNER_LOCAL_DOMAIN_RECEIPT_AND_OUTBOX_ONE_TRANSACTION"
            ),
            "crossDatabaseTransaction": False,
        } if ordered_dml else {
            "receiptTable": None,
            "outboxTable": None,
            "deliveryClass": "FORBIDDEN_READ_ONLY",
            "atomicity": "WRITES_RECEIPTS_OUTBOX_FORBIDDEN",
            "crossDatabaseTransaction": False,
        }),
        "responseSchema": {
            "schemaId": name + ".Response.v2",
            "additionalProperties": False,
            "fields": response_fields,
        },
        "errorContract": {
            "closedStatuses": [400, 401, 403, 404, 409, 422, 503],
            "zeroWriteStatuses": [400, 401, 403, 404, 409, 422],
            "resultUnknown": (
                "SIGNED_STATUS_REFETCH_REQUIRED_AFTER_TIMEOUT_OR_503"
                if completion_handler_id
                else "NOT_APPLICABLE_OR_ZERO_WRITE_FAILURE"
            ),
            "unknownErrorField": "FORBIDDEN",
        },
        "implementationState": "NOT_STARTED_G3",
    }
    if completion_handler_id:
        row["completionHandlerId"] = completion_handler_id
    return row


def operation(
    operation_id: str,
    kind: str,
    stream_key: str,
    owner_port: str,
    transaction: str,
    *,
    result_unknown: bool = False,
    public_path: str,
) -> dict[str, Any]:
    return {
        "operationId": operation_id,
        "kind": kind,
        "publicPath": public_path,
        "authoritativeStreamKey": stream_key,
        "ownerPortOperation": owner_port,
        "transactionBoundary": transaction,
        "resultUnknownRefetchRequired": result_unknown,
        "crossDatabaseTransactionClaimAllowed": False,
        "foreignRepositoryReadAllowed": False,
        "foreignLocalIdAllowed": False,
        "implementationState": "NOT_STARTED_G3",
    }


def internal_message_handler(
    *,
    handler_id: str,
    message_name: str,
    stream_key: str,
    inbox_table: str,
    domain_tables: list[str],
    outbox_table: str,
    acknowledgement: str,
) -> dict[str, Any]:
    return {
        "handlerId": handler_id,
        "handlerKind": "SIGNED_INTERNAL_PORT_MESSAGE_INBOX_CONSUMER",
        "messageName": message_name,
        "streamKey": stream_key,
        "trigger": "VERIFY_SIGNATURE_THEN_CLAIM_OWNER_LOCAL_INBOX_BY_MESSAGE_ID",
        "inboxLedgerTable": inbox_table,
        "domainWriteTables": domain_tables,
        "casRule": "EXPECTED_OWNER_VERSION_OR_EXACT_FIRST_RESULT_REPLAY",
        "closedAcknowledgement": acknowledgement,
        "outboxTable": outbox_table,
        "transactionBoundary": (
            "INBOX_CLAIM_DOMAIN_CAS_CLOSED_ACK_AND_OUTBOX_ATOMIC"
        ),
        "idempotencyRule": (
            "SAME_MESSAGE_ID_AND_DIGEST_RETURNS_THE_SEALED_FIRST_ACK;"
            "SAME_MESSAGE_ID_DIFFERENT_DIGEST_CONFLICTS"
        ),
        "failureRule": (
            "ANY_FAULT_AFTER_CLAIM_OR_DOMAIN_STEP_ROLLS_BACK_INBOX_DOMAIN_"
            "ACK_AND_OUTBOX_TO_PRESTATE"
        ),
        "publicEventEmission": "ONLY_CANONICAL_PRIVACY_SAFE_EVENT_IF_DECLARED",
        "implementationState": "NOT_STARTED_G3",
    }


def build_static_design() -> dict[str, Any]:
    configuration = "platform-hris-configuration"
    protected = "platform-hris-listening-protected"
    insights = "platform-hris-insights"
    issuer = "auth-hris-participation-issuer"

    authority_streams = [
        stream(
            key=configuration,
            service="dwp-platform-server",
            context="DWP_PLATFORM_HRIS_CONFIGURATION",
            schema="hris_configuration",
            history="flyway_hris_configuration_history",
            migration_location="dwp-platform-server/src/main/resources/db/hris-configuration/migration",
            migration_allocation="MIG-SYS-PLATFORM-HRIS-CONFIGURATION-1-40",
            migration_owner="OWN-SYS-BE-MIG-PLATFORM-HRIS-CONFIGURATION",
            migration_principal="dwp_hris_configuration_migrator",
            runtime_principals=[{
                "principal": "dwp_hris_configuration_runtime",
                "purpose": "CONFIGURATION_COMMAND_QUERY",
                "readOnly": False,
                "objectPolicy": "EXACT_CONFIGURATION_ALLOWLIST_NO_PROTECTED_OR_INSIGHTS_OR_ISSUER",
            }],
            source_root="dwp-platform-server/src/main/java/com/dwp/services/platform/hrisconfiguration/listening",
            test_root="dwp-platform-server/src/test/java/com/dwp/services/platform/hrisconfiguration/listening",
            source_allocation="G3-SYS-LISTEN-CONFIGURATION-BE-SOURCE",
            test_allocation="G3-SYS-LISTEN-CONFIGURATION-BE-TEST",
            migration_file_allocation="G3-SYS-LISTEN-CONFIGURATION-BE-MIGRATION",
            first_migration="V1__hris_listening_configuration_foundation.sql",
        ),
        stream(
            key=protected,
            service="dwp-platform-server",
            context="DWP_PLATFORM_HRIS_LISTENING_PROTECTED",
            schema="hris_listening_protected",
            history="flyway_hris_listening_protected_history",
            migration_location="dwp-platform-server/src/main/resources/db/hris-listening-protected/migration",
            migration_allocation="MIG-SYS-PLATFORM-HRIS-LISTENING-PROTECTED-1-40",
            migration_owner="OWN-SYS-BE-MIG-PLATFORM-HRIS-LISTENING-PROTECTED",
            migration_principal="dwp_hris_listening_protected_migrator",
            runtime_principals=[{
                "principal": "dwp_hris_listening_protected_runtime",
                "purpose": "PROTECTED_ADMISSION_COMMAND_QUERY",
                "readOnly": False,
                "objectPolicy": "EXACT_PROTECTED_ALLOWLIST_NO_CONFIGURATION_OR_INSIGHTS_OR_ISSUER",
            }],
            source_root="dwp-platform-server/src/main/java/com/dwp/services/platform/hrislisteningprotected",
            test_root="dwp-platform-server/src/test/java/com/dwp/services/platform/hrislisteningprotected",
            source_allocation="G3-SYS-LISTEN-PROTECTED-BE-SOURCE",
            test_allocation="G3-SYS-LISTEN-PROTECTED-BE-TEST",
            migration_file_allocation="G3-SYS-LISTEN-PROTECTED-BE-MIGRATION",
            first_migration="V1__hris_listening_protected_foundation.sql",
        ),
        stream(
            key=insights,
            service="dwp-platform-server",
            context="DWP_PLATFORM_HRIS_INSIGHTS",
            schema="hris_insights",
            history="flyway_hris_insights_history",
            migration_location="dwp-platform-server/src/main/resources/db/hris-insights/migration",
            migration_allocation="MIG-SYS-PLATFORM-HRIS-INSIGHTS-1-40",
            migration_owner="OWN-SYS-BE-MIG-PLATFORM-HRIS-INSIGHTS",
            migration_principal="dwp_hris_insights_migrator",
            runtime_principals=[
                {
                    "principal": "dwp_hris_insights_query_runtime",
                    "purpose": "INSIGHTS_QUERY",
                    "readOnly": True,
                    "objectPolicy": "SELECT_EXACT_INSIGHTS_PROJECTION_ALLOWLIST_ONLY",
                },
                {
                    "principal": "dwp_hris_insights_projection_runtime",
                    "purpose": "INSIGHTS_PROJECTION_WRITE",
                    "readOnly": False,
                    "objectPolicy": "DML_EXACT_INSIGHTS_PROJECTION_ALLOWLIST_ONLY",
                },
            ],
            source_root="dwp-platform-server/src/main/java/com/dwp/services/platform/hrisinsights/listening",
            test_root="dwp-platform-server/src/test/java/com/dwp/services/platform/hrisinsights/listening",
            source_allocation="G3-SYS-LISTEN-INSIGHTS-BE-SOURCE",
            test_allocation="G3-SYS-LISTEN-INSIGHTS-BE-TEST",
            migration_file_allocation="G3-SYS-LISTEN-INSIGHTS-BE-MIGRATION",
            first_migration="V1__hris_listening_insights_foundation.sql",
        ),
        stream(
            key=issuer,
            service="dwp-auth-server",
            context="DWP_AUTH_HRIS_PARTICIPATION_ISSUER",
            schema="hris_participation_issuer",
            history="flyway_hris_participation_issuer_history",
            migration_location="dwp-auth-server/src/main/resources/db/hris-participation-issuer/migration",
            migration_allocation="MIG-SYS-AUTH-HRIS-PARTICIPATION-ISSUER-1-40",
            migration_owner="OWN-SYS-BE-MIG-AUTH-HRIS-PARTICIPATION-ISSUER",
            migration_principal="dwp_hris_participation_issuer_migrator",
            runtime_principals=[{
                "principal": "dwp_hris_participation_issuer_runtime",
                "purpose": "PARTICIPATION_ELIGIBILITY_TOKEN_ISSUANCE",
                "readOnly": False,
                "objectPolicy": "EXACT_ISSUER_ALLOWLIST_NO_RESPONSE_OR_INSIGHTS",
            }],
            source_root="dwp-auth-server/src/main/java/com/dwp/services/auth/productaccess/listeningissuer",
            test_root="dwp-auth-server/src/test/java/com/dwp/services/auth/productaccess/listeningissuer",
            source_allocation="G3-SYS-LISTEN-ISSUER-BE-SOURCE",
            test_allocation="G3-SYS-LISTEN-ISSUER-BE-TEST",
            migration_file_allocation="G3-SYS-LISTEN-ISSUER-BE-MIGRATION",
            first_migration="V1__hris_listening_participation_issuer_foundation.sql",
        ),
    ]

    public_operations = [
        operation(
            "modern.listening.active.query", "QUERY", protected,
            "protected.listActiveAdmissions", "PROTECTED_READ_ONLY_TRANSACTION",
            public_path="GET /api/platform/v1/hris/listening/surveys/active",
        ),
        operation(
            "modern.listening.response.submit", "COMMAND", protected,
            "protected.submitResponse", "PROTECTED_SUBMIT_CLOSE_FENCE_TRANSACTION",
            public_path="POST /api/platform/v1/hris/listening/surveys/{surveyId}/responses",
        ),
        {
            **operation(
                "modern.listening.surveys.query", "QUERY", configuration,
                "configuration.querySurveys", "CONFIGURATION_READ_ONLY_TRANSACTION",
                public_path="GET /api/platform/v1/admin/hris/listening/surveys",
            ),
            "requestContract": {
                "surveyId": "OPTIONAL_EXACT_PUBLIC_UUID",
                "status": "OPTIONAL_DRAFT_PUBLISHED_CLOSED",
                "period": "OPTIONAL_FROM_TO_TIMESTAMPTZ_HALF_OPEN",
                "cursor": "OPTIONAL_SCOPE_BOUND_OPAQUE_CURSOR",
                "limit": "OPTIONAL_INTEGER_1_200_DEFAULT_50",
            },
            "responseSchemaId": "EmployeeListeningSurveyAdministrationPage.v1",
            "recordSchemaId": "EmployeeListeningSurveyAdministrationRecord.v1",
        },
        operation(
            "modern.listening.survey.create", "COMMAND", configuration,
            "configuration.createSurvey", "CONFIGURATION_LOCAL_TRANSACTION",
            public_path="POST /api/platform/v1/admin/hris/listening/surveys",
        ),
        {
            **operation(
                "modern.listening.survey.revise", "COMMAND", configuration,
                "configuration.reviseSurvey",
                "CONFIGURATION_DRAFT_CAS_REVISION_TRANSACTION",
                public_path=(
                    "PATCH /api/platform/v1/admin/hris/listening/"
                    "surveys/{surveyId}"
                ),
            ),
            "requestSchemaId": "EmployeeListeningSurveyRevisionCommand.v1",
            "responseSchemaId": "EmployeeListeningSurveyRevisionResult.v1",
            "stateContract": "DRAFT_TO_DRAFT_EXPECTED_AGGREGATE_VERSION_CAS",
            "serverVersionRule": "INCREMENT_EXACTLY_ONE_AFTER_STRUCTURED_REVISION",
        },
        operation(
            "modern.listening.survey.publish", "COMMAND", configuration,
            "configuration.publishSurveyOrchestrate", "LOCAL_COMMIT_THEN_PROTECTED_PORT_REFETCH",
            result_unknown=True,
            public_path="POST /api/platform/v1/admin/hris/listening/surveys/{surveyId}/publish",
        ),
        operation(
            "modern.listening.survey.close", "COMMAND", configuration,
            "configuration.closeSurveyOrchestrate", "PROTECTED_CLOSE_REFETCH_THEN_CONFIGURATION_FINALIZE",
            result_unknown=True,
            public_path="POST /api/platform/v1/admin/hris/listening/surveys/{surveyId}/close",
        ),
        operation(
            "modern.listening.cohorts.query", "QUERY", insights,
            "insights.queryCohortResults", "INSIGHTS_READ_ONLY_TRANSACTION",
            public_path="GET /api/platform/v1/admin/hris/listening/surveys/{surveyId}/cohort-projections",
        ),
        {
            **operation(
                "modern.listening.action.create", "COMMAND", configuration,
                "configuration.createAction", "CONFIGURATION_LOCAL_TRANSACTION",
                public_path="POST /api/platform/v1/admin/hris/listening/surveys/{surveyId}/actions",
            ),
            "crossOwnerIngress": {
                "sourceStreamKey": insights,
                "sourceOwnerPortOperation": "insights.queryCohortResults",
                "mode": "SIGNED_PRIVACY_SAFE_VERSIONED_OWNER_PORT_REFETCH",
                "fieldAllowlist": [
                    "cohortProjectionId", "cohortProjectionRevision",
                    "cohortProjectionAsOf", "cohortProjectionLineageReceiptId",
                ],
                "localRepositoryRead": False,
                "failure": "403_404_409_503_ZERO_CONFIGURATION_MUTATION",
            },
        },
        operation(
            "modern.listening.action.complete", "COMMAND", configuration,
            "configuration.completeAction", "CONFIGURATION_LOCAL_TRANSACTION",
            public_path="POST /api/platform/v1/admin/hris/listening/actions/{actionId}/complete",
        ),
    ]
    public_events_by_operation = {
        "modern.listening.active.query": [],
        "modern.listening.response.submit": [],
        "modern.listening.surveys.query": [],
        "modern.listening.survey.create": ["EmployeeListeningSurveyCreated.v3"],
        "modern.listening.survey.revise": ["EmployeeListeningSurveyRevised.v3"],
        # Publish/close only create durable intents.  Their configuration
        # finalizers own the public events after a signed protected receipt.
        "modern.listening.survey.publish": [],
        "modern.listening.survey.close": [],
        "modern.listening.cohorts.query": [],
        "modern.listening.action.create": ["EmployeeListeningActionCreated.v3"],
        "modern.listening.action.complete": ["EmployeeListeningActionCompleted.v3"],
    }
    for row in public_operations:
        row["publicEventIds"] = public_events_by_operation[row["operationId"]]
        if row["operationId"] == "modern.listening.survey.publish":
            row["sagaContract"] = {
                "intentState": "PUBLISH_PENDING",
                "requestMessage": "ListeningAdmissionInstallRequested.v1",
                "signedResultMessage": "ListeningAdmissionInstallReceipt.v1",
                "completionHandlerId": "internal.listening.configuration.admission-install-receipt.consume",
                "successState": "PUBLISHED",
                "retryableState": "PUBLISH_RETRYABLE",
                "publicEvent": "EmployeeListeningSurveyPublished.v3",
                "eventBeforeSignedSuccess": "FORBIDDEN",
            }
        elif row["operationId"] == "modern.listening.survey.close":
            row["sagaContract"] = {
                "intentState": "CLOSE_PENDING",
                "requestMessage": "ListeningAdmissionCloseRequested.v1",
                "signedResultMessage": "ListeningAdmissionCloseReceipt.v1",
                "completionHandlerId": "internal.listening.configuration.admission-close-receipt.consume",
                "successState": "CLOSED",
                "retryableState": "CLOSE_RETRYABLE",
                "publicEvent": "EmployeeListeningSurveyClosed.v3",
                "eventBeforeSignedSuccess": "FORBIDDEN",
            }

    owner_ports = [
        ("configuration.querySurveys", configuration, "QUERY"),
        ("configuration.createSurvey", configuration, "COMMAND"),
        ("configuration.reviseSurvey", configuration, "CAS_COMMAND"),
        ("configuration.publishSurveyOrchestrate", configuration, "ORCHESTRATION_COMMAND"),
        ("configuration.closeSurveyOrchestrate", configuration, "ORCHESTRATION_COMMAND"),
        ("configuration.createAction", configuration, "COMMAND"),
        ("configuration.completeAction", configuration, "COMMAND"),
        ("protected.listActiveAdmissions", protected, "QUERY"),
        ("protected.installAdmission", protected, "SIGNED_OWNER_COMMAND"),
        ("protected.closeAdmission", protected, "SIGNED_OWNER_COMMAND"),
        ("protected.submitResponse", protected, "ANONYMOUS_OWNER_COMMAND"),
        (
            "protected.requestErasure",
            protected,
            "SIGNED_PRIVACY_RETENTION_OWNER_COMMAND",
        ),
        ("protected.buildCohortPackage", protected, "PRIVACY_OWNER_COMMAND"),
        ("insights.ingestCohortPackage", insights, "SIGNED_MINIMIZED_PROJECTION_COMMAND"),
        ("insights.queryCohortResults", insights, "QUERY"),
        ("issuer.issueParticipationEnvelope", issuer, "AUTHENTICATED_OWNER_COMMAND"),
        ("issuer.resolveParticipationStatus", issuer, "SIGNED_OWNER_QUERY"),
        ("issuer.revokeParticipationEnvelope", issuer, "AUTHENTICATED_OWNER_COMMAND"),
    ]

    table_ownership = [
        table("sys_hris_listening_surveys", configuration),
        table("sys_hris_listening_survey_versions", configuration, [
            fk(["tenant_id", "listening_survey_id"], "sys_hris_listening_surveys", ["tenant_id", "listening_survey_id"]),
        ]),
        table("sys_hris_listening_actions", configuration, [
            fk(["tenant_id", "listening_survey_version_id"], "sys_hris_listening_survey_versions", ["tenant_id", "record_id"]),
        ]),
        table("sys_hris_listening_operation_receipts", configuration),
        table("sys_hris_listening_domain_outbox", configuration),
        table("sys_hris_listening_admission_versions", protected),
        table("sys_hris_listening_responses", protected, [
            fk(["tenant_id", "listening_admission_version_id"], "sys_hris_listening_admission_versions", ["tenant_id", "record_id"]),
        ]),
        table("sys_hris_listening_answer_values", protected, [
            fk(["tenant_id", "listening_response_id"], "sys_hris_listening_responses", ["tenant_id", "listening_response_id"]),
        ]),
        table("sys_hris_listening_token_consumptions", protected, [
            fk(["tenant_id", "listening_admission_version_id"], "sys_hris_listening_admission_versions", ["tenant_id", "record_id"]),
        ]),
        table("sys_hris_listening_protected_receipts", protected, [
            fk(["tenant_id", "listening_response_id"], "sys_hris_listening_responses", ["tenant_id", "listening_response_id"]),
        ]),
        table("sys_hris_listening_erasure_tickets", protected, [
            fk(["tenant_id", "listening_response_id"], "sys_hris_listening_responses", ["tenant_id", "listening_response_id"]),
        ]),
        table("sys_hris_listening_cohort_budgets", protected, [
            fk(["tenant_id", "listening_admission_version_id"], "sys_hris_listening_admission_versions", ["tenant_id", "record_id"]),
        ]),
        table("sys_hris_listening_cohort_packages", protected, [
            fk(["tenant_id", "listening_cohort_budget_id"], "sys_hris_listening_cohort_budgets", ["tenant_id", "record_id"]),
        ]),
        table("sys_hris_listening_protected_outbox", protected),
        table("sys_hris_listening_cohort_projections", insights),
        table("sys_hris_listening_lineage_receipts", insights, [
            fk(["tenant_id", "listening_cohort_projection_id"], "sys_hris_listening_cohort_projections", ["tenant_id", "record_id"]),
        ]),
        table("sys_hris_listening_insights_inbox", insights),
        table("sys_hris_listening_insights_outbox", insights),
        table("sys_hris_listening_eligibility_versions", issuer),
        table("sys_hris_listening_token_issuances", issuer, [
            fk(["tenant_id", "listening_eligibility_version_id"], "sys_hris_listening_eligibility_versions", ["tenant_id", "record_id"]),
        ]),
        table("sys_hris_listening_token_revocations", issuer, [
            fk(["tenant_id", "listening_token_issuance_id"], "sys_hris_listening_token_issuances", ["tenant_id", "record_id"]),
        ]),
        table("sys_hris_listening_issuer_receipts", issuer),
        table("sys_hris_listening_issuer_outbox", issuer),
    ]

    owner_local_handlers = [
        {
            "handlerId": "internal.listening.protected.erasure.request",
            "handlerKind": "SIGNED_PRIVACY_RETENTION_OWNER_INGRESS",
            "ownerPortOperation": "protected.requestErasure",
            "streamKey": protected,
            "trigger": (
                "SIGNED_PRIVACY_OR_RETENTION_REQUEST_OR_OWNER_LOCAL_DUE_SCAN"
            ),
            "requestContract": {
                "tenantPublicId": "REQUIRED_UUID",
                "responsePublicId": "REQUIRED_UUID_OWNER_RESOLVED_ONLY",
                "retentionPolicyRevision": "REQUIRED_POSITIVE_INTEGER",
                "dueAt": "REQUIRED_TIMESTAMPTZ",
                "idempotencyKey": "REQUIRED_SCOPE_BOUND_OPAQUE_KEY",
                "requestDigest": "REQUIRED_SHA256",
                "signatureKeyId": "REQUIRED_ACTIVE_OWNER_KEY",
            },
            "producerContract": (
                "ATOMIC_INSERT_REQUESTED_TICKET_SEALED_RECEIPT_AND_INTERNAL_ACK"
            ),
            "ticketTable": "sys_hris_listening_erasure_tickets",
            "receiptTable": "sys_hris_listening_protected_receipts",
            "outboxTable": "sys_hris_listening_protected_outbox",
            "readsTables": ["sys_hris_listening_responses"],
            "domainWriteTables": ["sys_hris_listening_erasure_tickets"],
            "initialStatus": "REQUESTED",
            "statusReentry": (
                "SAME_OWNER_PORT_BY_IDEMPOTENCY_KEY_OR_TICKET_PUBLIC_ID_"
                "RETURNS_SEALED_STATUS_RECEIPT"
            ),
            "idempotencyRule": (
                "SAME_KEY_AND_DIGEST_RETURNS_FIRST_TICKET_AND_RECEIPT;"
                "SAME_KEY_DIFFERENT_DIGEST_CONFLICTS"
            ),
            "identityBoundary": (
                "NO_PRINCIPAL_WORKER_OR_PARTICIPATION_TOKEN_LEAVES_PROTECTED_OWNER"
            ),
            "transactionBoundary": (
                "PROTECTED_OWNER_LOCAL_TICKET_RECEIPT_AND_ACK_ATOMIC"
            ),
            "publicEventEmission": "FORBIDDEN_RAW_OR_IDENTITY_LINKABLE",
            "implementationState": "NOT_STARTED_G3",
        },
        {
            "handlerId": "internal.listening.protected.erasure.process",
            "handlerKind": "OWNER_LOCAL_ERASURE_PROCESSOR",
            "streamKey": protected,
            "trigger": "CLAIM_REQUESTED_ERASURE_TICKET_WITH_OWNER_LOCAL_LEASE",
            "ticketProducerHandlerId": (
                "internal.listening.protected.erasure.request"
            ),
            "readsTables": [
                "sys_hris_listening_erasure_tickets",
                "sys_hris_listening_responses",
                "sys_hris_listening_answer_values",
            ],
            "domainWriteTables": ["sys_hris_listening_erasure_tickets"],
            "receiptTable": "sys_hris_listening_protected_receipts",
            "outboxTable": "sys_hris_listening_protected_outbox",
            "erasureAction": (
                "OWNER_LOCAL_CRYPTO_SHRED_KEY_MATERIAL_THEN_APPEND_IMMUTABLE_"
                "TOMBSTONE_DIGEST_WITHOUT_MUTATING_RESPONSE_STATUS"
            ),
            "transactionBoundary": (
                "PROTECTED_OWNER_LOCAL_RESPONSE_AND_ANSWER_ERASURE_"
                "KEY_MATERIAL_DESTRUCTION_TOMBSTONE_AND_STABLE_REPLAY_RECEIPT"
            ),
            "stateModel": (
                "ERASURE_TICKET_REQUESTED_CLAIMED_COMPLETED_OR_FAILED_RETRYABLE"
            ),
            "responseMutableStatusForbidden": ["WITHDRAWN", "ANONYMIZED"],
            "publicEventEmission": "FORBIDDEN_RAW_OR_IDENTITY_LINKABLE",
            "stableReplayReceiptRequired": True,
            "implementationState": "NOT_STARTED_G3",
        },
        {
            "handlerId": "internal.listening.protected.cohort-package.build",
            "handlerKind": "OWNER_LOCAL_SCHEDULED_PRIVACY_AGGREGATION_JOB",
            "ownerPortOperation": "protected.buildCohortPackage",
            "streamKey": protected,
            "sourceStreamKey": protected,
            "targetStreamKey": protected,
            "trigger": (
                "OWNER_SCHEDULER_FIXED_TENANT_ADMISSION_SOURCE_EPOCH_AND_CUTOFF;"
                "CLAIM_BUDGET_BEFORE_READING_ELIGIBLE_PROTECTED_ROWS"
            ),
            "requestContract": {
                "additionalProperties": False,
                "tenantPublicId": "REQUIRED_UUID",
                "admissionPublicId": "REQUIRED_UUID",
                "admissionVersionPublicId": "REQUIRED_UUID",
                "admissionOwnerVersion": "REQUIRED_POSITIVE_INTEGER",
                "surveyPublicId": "REQUIRED_UUID",
                "policyRevision": "REQUIRED_POSITIVE_INTEGER",
                "sourceEpoch": "REQUIRED_TIMESTAMPTZ",
                "cutoffAt": "REQUIRED_TIMESTAMPTZ",
                "measureSchemaVersion": "REQUIRED_CLOSED_SCHEMA_VERSION",
                "idempotencyKey": "REQUIRED_SCOPE_BOUND_OPAQUE_KEY",
            },
            "callerAuth": (
                "PROTECTED_OWNER_SCHEDULER_SERVICE_PRINCIPAL_ONLY;"
                "tenant+purpose+policy revision fail closed"
            ),
            "readsTables": [
                "sys_hris_listening_admission_versions",
                "sys_hris_listening_responses",
                "sys_hris_listening_answer_values",
                "sys_hris_listening_erasure_tickets",
            ],
            "domainWriteTables": [
                "sys_hris_listening_cohort_budgets",
                "sys_hris_listening_cohort_packages",
            ],
            "receiptTable": "sys_hris_listening_protected_receipts",
            "outboxTable": "sys_hris_listening_protected_outbox",
            "eligibilityRule": (
                "LOCK_CLOSED_ADMISSION_AT_EXACT_OWNER_REVISION;include only submittedAt<=cutoffAt "
                "and responses without a completed erasure tombstone; late/erased rows excluded"
            ),
            "privacyRule": (
                "CLAIM_EXACT_K_AND_DP_BUDGET_BEFORE_AGGREGATION;below-k emits deterministic "
                "SUPPRESSED package; raw answers and small-cell values never leave protected owner"
            ),
            "transactionBoundary": (
                "BUDGET_CLAIM_AGGREGATE_PACKAGE_SEALED_RECEIPT_AND_READY_OUTBOX_ATOMIC"
            ),
            "idempotencyRule": (
                "tenant+admission+policyRevision+sourceEpoch+cutoffAt+measureSchemaVersion+"
                "idempotencyKey;same digest returns sealed package;different digest conflicts"
            ),
            "closedAcknowledgement": "PACKAGE_OR_SUPPRESSED_SEALED_RESULT",
            "publicEventEmission": "FORBIDDEN_PROTECTED_PACKAGE_IS_INTERNAL_MESSAGE_ONLY",
            "implementationState": "NOT_STARTED_G3",
        },
        internal_message_handler(
            handler_id="internal.listening.protected.admission-install.consume",
            message_name="ListeningAdmissionInstallRequested.v1",
            stream_key=protected,
            inbox_table="sys_hris_listening_protected_receipts",
            domain_tables=["sys_hris_listening_admission_versions"],
            outbox_table="sys_hris_listening_protected_outbox",
            acknowledgement="ListeningAdmissionInstallReceipt.v1",
        ),
        internal_message_handler(
            handler_id="internal.listening.configuration.admission-install-receipt.consume",
            message_name="ListeningAdmissionInstallReceipt.v1",
            stream_key=configuration,
            inbox_table="sys_hris_listening_operation_receipts",
            domain_tables=[
                "sys_hris_listening_surveys",
                "sys_hris_listening_survey_versions",
            ],
            outbox_table="sys_hris_listening_domain_outbox",
            acknowledgement="CLOSED_CONFIGURATION_PUBLISH_RESULT",
        ),
        internal_message_handler(
            handler_id="internal.listening.protected.admission-close.consume",
            message_name="ListeningAdmissionCloseRequested.v1",
            stream_key=protected,
            inbox_table="sys_hris_listening_protected_receipts",
            domain_tables=["sys_hris_listening_admission_versions"],
            outbox_table="sys_hris_listening_protected_outbox",
            acknowledgement="ListeningAdmissionCloseReceipt.v1",
        ),
        internal_message_handler(
            handler_id="internal.listening.configuration.admission-close-receipt.consume",
            message_name="ListeningAdmissionCloseReceipt.v1",
            stream_key=configuration,
            inbox_table="sys_hris_listening_operation_receipts",
            domain_tables=[
                "sys_hris_listening_surveys",
                "sys_hris_listening_survey_versions",
            ],
            outbox_table="sys_hris_listening_domain_outbox",
            acknowledgement="CLOSED_CONFIGURATION_CLOSE_RESULT",
        ),
        internal_message_handler(
            handler_id="internal.listening.insights.cohort-package.consume",
            message_name="ListeningCohortPackageReady.v1",
            stream_key=insights,
            inbox_table="sys_hris_listening_insights_inbox",
            domain_tables=[
                "sys_hris_listening_cohort_projections",
                "sys_hris_listening_lineage_receipts",
            ],
            outbox_table="sys_hris_listening_insights_outbox",
            acknowledgement="ListeningCohortProjectionReceipt.v1",
        ),
        internal_message_handler(
            handler_id="internal.listening.protected.cohort-projection-receipt.consume",
            message_name="ListeningCohortProjectionReceipt.v1",
            stream_key=protected,
            inbox_table="sys_hris_listening_protected_receipts",
            domain_tables=["sys_hris_listening_cohort_packages"],
            outbox_table="sys_hris_listening_protected_outbox",
            acknowledgement="CLOSED_PROTECTED_COHORT_TRANSFER_RESULT",
        ),
    ]

    # Every owner port is executable contract surface.  Public routes,
    # signed internal messages, scheduled protected work and auth synchronous
    # ports remain separate entrypoint classes; none is a prose-only alias.
    public_by_port = {
        row["ownerPortOperation"]: row["operationId"] for row in public_operations
    }
    handler_by_port = {
        row["ownerPortOperation"]: row["handlerId"]
        for row in owner_local_handlers if row.get("ownerPortOperation")
    }
    handler_by_port.update({
        "protected.installAdmission": "internal.listening.protected.admission-install.consume",
        "protected.closeAdmission": "internal.listening.protected.admission-close.consume",
        "insights.ingestCohortPackage": "internal.listening.insights.cohort-package.consume",
    })
    auth_refs = {
        "issuer.issueParticipationEnvelope": "issuer.issueParticipationEnvelope.v1",
        "issuer.resolveParticipationStatus": "issuer.resolveParticipationStatus.v1",
        "issuer.revokeParticipationEnvelope": "issuer.revokeParticipationEnvelope.v1",
    }
    purpose_by_port = {
        "configuration.querySurveys": "hcm.listening.manage",
        "configuration.createSurvey": "hcm.listening.manage",
        "configuration.reviseSurvey": "hcm.listening.manage",
        "configuration.publishSurveyOrchestrate": "hcm.listening.manage",
        "configuration.closeSurveyOrchestrate": "hcm.listening.manage",
        "configuration.createAction": "hcm.listening.action.manage",
        "configuration.completeAction": "hcm.listening.action.manage",
        "protected.listActiveAdmissions": "hcm.listening.self.view",
        "protected.installAdmission": "listening.admission.install",
        "protected.closeAdmission": "listening.admission.close",
        "protected.submitResponse": "listening.response.submit.anonymous",
        "protected.requestErasure": "listening.response.erase",
        "protected.buildCohortPackage": "listening.cohort.build",
        "insights.ingestCohortPackage": "listening.cohort.ingest",
        "insights.queryCohortResults": "hcm.listening.cohort.view",
        "issuer.issueParticipationEnvelope": "listening.participation.issue",
        "issuer.resolveParticipationStatus": "listening.participation.resolve",
        "issuer.revokeParticipationEnvelope": "listening.participation.revoke",
    }
    f = contract_field
    common_idempotency = f("idempotencyKey", "STRING", validation="NONEMPTY_SCOPE_BOUND_MAX_240")
    request_fields_by_port: dict[str, list[dict[str, Any]]] = {
        "configuration.querySurveys": [
            f("surveyPublicId", "UUID", required=False), f("status", "STRING", required=False),
            f("from", "TIMESTAMPTZ", required=False), f("to", "TIMESTAMPTZ", required=False),
            f("cursor", "STRING", required=False), f("limit", "INTEGER", required=False, validation="1..200"),
        ],
        "configuration.createSurvey": [
            f("surveyKey", "STRING"), f("displayName", "STRING"),
            f("formVersionPublicId", "UUID", sensitivity="RESTRICTED"),
            f("privacyVersionPublicId", "UUID", sensitivity="RESTRICTED"),
            f("retentionVersionPublicId", "UUID", sensitivity="RESTRICTED"),
            f("audienceSnapshotPublicId", "UUID", sensitivity="RESTRICTED"),
            f("consentPolicyVersionPublicId", "UUID", sensitivity="RESTRICTED"),
            f("opensAt", "TIMESTAMPTZ"), f("closesAt", "TIMESTAMPTZ"),
            f("anonymityThreshold", "INTEGER", validation=">=5"), copy.deepcopy(common_idempotency),
        ],
        "configuration.reviseSurvey": [
            f("surveyPublicId", "UUID"), f("expectedAggregateVersion", "BIGINT"),
            f("formVersionPublicId", "UUID", sensitivity="RESTRICTED"),
            f("privacyVersionPublicId", "UUID", sensitivity="RESTRICTED"),
            f("retentionVersionPublicId", "UUID", sensitivity="RESTRICTED"),
            f("questionDefinitions", "ARRAY", sensitivity="RESTRICTED"),
            f("reasonCode", "STRING"), copy.deepcopy(common_idempotency),
        ],
        "configuration.publishSurveyOrchestrate": [
            f("surveyPublicId", "UUID"), f("expectedAggregateVersion", "BIGINT"),
            f("approvalReceiptPublicId", "UUID", sensitivity="RESTRICTED"),
            copy.deepcopy(common_idempotency),
        ],
        "configuration.closeSurveyOrchestrate": [
            f("surveyPublicId", "UUID"), f("expectedAggregateVersion", "BIGINT"),
            f("reasonCode", "STRING"), copy.deepcopy(common_idempotency),
        ],
        "configuration.createAction": [
            f("surveyPublicId", "UUID"), f("surveyVersionPublicId", "UUID"),
            f("cohortProjectionPublicId", "UUID", sensitivity="RESTRICTED"),
            f("cohortProjectionRevision", "BIGINT"), f("cohortProjectionAsOf", "TIMESTAMPTZ"),
            f("cohortProjectionLineageReceiptPublicId", "UUID", sensitivity="RESTRICTED"),
            f("actionKey", "STRING"), f("displayName", "STRING"), f("dueAt", "TIMESTAMPTZ"),
            copy.deepcopy(common_idempotency),
        ],
        "configuration.completeAction": [
            f("actionPublicId", "UUID"), f("expectedAggregateVersion", "BIGINT"),
            f("completionEvidencePublicId", "UUID", sensitivity="RESTRICTED"),
            f("completedAt", "TIMESTAMPTZ"), copy.deepcopy(common_idempotency),
        ],
        "protected.listActiveAdmissions": [
            f("signedParticipationCredential", "OBJECT", sensitivity="HIGHLY_RESTRICTED",
              validation="same exact closed ListeningSignedParticipationCredential.v1 used by submit; offline signature/non-revocation proof only"),
        ],
        "protected.installAdmission": [
            f("messageId", "UUID"), f("tenantPublicId", "UUID"), f("surveyPublicId", "UUID"),
            f("surveyRevision", "BIGINT"), f("admissionPublicId", "UUID"),
            f("formVersionPublicId", "UUID"), f("formRevision", "BIGINT"),
            f("formArtifactSchemaVersion", "STRING"),
            f("formArtifactDigest", "SHA256"),
            f("questionDefinitions", "ARRAY", sensitivity="HIGHLY_RESTRICTED",
              validation="ListeningQuestionDefinition.v1 closed discriminated union; stable question key/type/cardinality/choice vocabulary"),
            f("privacyVersionPublicId", "UUID"), f("privacyRevision", "BIGINT"),
            f("retentionVersionPublicId", "UUID"), f("retentionRevision", "BIGINT"),
            f("tokenPolicyVersionPublicId", "UUID"),
            f("consentPolicyVersionPublicId", "UUID"),
            f("anonymityThreshold", "INTEGER", validation=">=5"),
            f("epsilonMicros", "BIGINT", validation=">0 owner policy micro-units"),
            f("privacyBudgetCapEpsilonMicros", "BIGINT",
              validation=">=epsilonMicros; immutable owner policy composition cap"),
            f("measureSchemaVersion", "STRING"),
            f("measureDefinitionDigest", "SHA256"),
            f("contentSha256", "SHA256"), f("opensAt", "TIMESTAMPTZ"),
            f("closesAt", "TIMESTAMPTZ"), f("eraseAfter", "TIMESTAMPTZ"),
            f("payloadDigest", "SHA256"), f("ownerSignature", "STRING", sensitivity="RESTRICTED"),
            copy.deepcopy(common_idempotency),
        ],
        "protected.closeAdmission": [
            f("messageId", "UUID"), f("tenantPublicId", "UUID"), f("surveyPublicId", "UUID"),
            f("admissionPublicId", "UUID"), f("expectedOwnerVersion", "BIGINT"),
            f("payloadDigest", "SHA256"), f("ownerSignature", "STRING", sensitivity="RESTRICTED"),
            copy.deepcopy(common_idempotency),
        ],
        "protected.submitResponse": [
            f("signedParticipationCredential", "OBJECT", sensitivity="HIGHLY_RESTRICTED",
              validation="ListeningSignedParticipationCredential.v1 additionalProperties=false",
              value_schema={
                  "schemaId": "ListeningSignedParticipationCredential.v1",
                  "additionalProperties": False,
                  "fields": [
                      f("tenantPublicId", "UUID"), f("surveyPublicId", "UUID"),
                      f("surveyRevision", "BIGINT"), f("admissionPublicId", "UUID"),
                      f("admissionVersionPublicId", "UUID"),
                      f("admissionOwnerVersion", "BIGINT"), f("formVersionPublicId", "UUID"),
                      f("formArtifactDigest", "SHA256"), f("eligibilityVersionPublicId", "UUID"),
                      f("eligibilityRevision", "BIGINT"),
                      f("consentPolicyVersionPublicId", "UUID"),
                      f("consentEvidenceCommitment", "SHA256", sensitivity="HIGHLY_RESTRICTED",
                        validation="issuance-specific unlinkable blinded commitment; not an owner-resolvable receipt id"),
                      f("nonRevocationProof", "OBJECT", sensitivity="HIGHLY_RESTRICTED",
                        validation="short-lived signed ACTIVE issuer proof minted before anonymous protected submit",
                        value_schema={
                            "schemaId": "ListeningOfflineNonRevocationProof.v1",
                            "additionalProperties": False,
                            "fields": [
                                f("issuancePublicId", "UUID"), f("issuanceRevision", "BIGINT"),
                                f("opaqueJtiCommitment", "SHA256", sensitivity="HIGHLY_RESTRICTED"),
                                f("tokenCommitment", "SHA256", sensitivity="HIGHLY_RESTRICTED"),
                                f("status", "STRING", validation="ACTIVE_ONLY"),
                                f("proofGeneratedAt", "TIMESTAMPTZ"),
                                f("proofExpiresAt", "TIMESTAMPTZ",
                                  validation="after captured now and within bounded maximum TTL"),
                                f("kid", "STRING"),
                                f("alg", "STRING", validation="approved asymmetric allowlist"),
                                f("ownerSignature", "STRING", sensitivity="HIGHLY_RESTRICTED"),
                            ],
                        }),
                      f("opaqueJti", "UUID", sensitivity="HIGHLY_RESTRICTED"),
                      f("tokenCommitment", "SHA256", sensitivity="HIGHLY_RESTRICTED"),
                      f("aud", "STRING"), f("iat", "TIMESTAMPTZ"),
                      f("nbf", "TIMESTAMPTZ"), f("exp", "TIMESTAMPTZ"),
                      f("kid", "STRING"), f("alg", "STRING", validation="approved asymmetric allowlist"),
                      f("signature", "STRING", sensitivity="HIGHLY_RESTRICTED"),
                  ],
                  "forbiddenClaims": ["workerId", "personId", "principalId", "employeeId"],
              }),
            f("surveyId", "UUID", sensitivity="RESTRICTED",
              validation="route identity equals signed credential surveyPublicId"),
            f("responseToken", "STRING", sensitivity="HIGHLY_RESTRICTED"),
            f("answers", "ARRAY", sensitivity="HIGHLY_RESTRICTED",
              validation="ListeningAnswer.v1 closed discriminated union; exact form snapshot question/type/cardinality",
              value_schema={
                  "schemaId": "ListeningAnswer.v1",
                  "additionalProperties": False,
                  "discriminator": "answerType",
                  "arrayBounds": {"minItems": 1, "maxItems": 500},
                  "uniqueBy": "questionKey",
                  "membership": "EXACT_LOCKED_FORM_QUESTION_SET",
                  "variants": [
                      {"answerType": "SCALE", "additionalProperties": False, "fields": [
                          {"name": "questionKey", "type": "STRING", "required": True, "maxLength": 160},
                          {"name": "answerType", "type": "STRING", "required": True, "const": "SCALE"},
                          {"name": "scaleValue", "type": "INTEGER", "required": True,
                           "bounds": "LOCKED_QUESTION_MIN_MAX"},
                      ]},
                      {"answerType": "SINGLE_CHOICE", "additionalProperties": False, "fields": [
                          {"name": "questionKey", "type": "STRING", "required": True, "maxLength": 160},
                          {"name": "answerType", "type": "STRING", "required": True, "const": "SINGLE_CHOICE"},
                          {"name": "choiceKey", "type": "STRING", "required": True,
                           "membership": "LOCKED_QUESTION_CHOICE_SET"},
                      ]},
                      {"answerType": "MULTI_CHOICE", "additionalProperties": False, "fields": [
                          {"name": "questionKey", "type": "STRING", "required": True, "maxLength": 160},
                          {"name": "answerType", "type": "STRING", "required": True, "const": "MULTI_CHOICE"},
                          {"name": "choiceKeys", "type": "ARRAY<STRING>", "required": True,
                           "minItems": 1, "maxItems": 50, "uniqueItems": True,
                           "membership": "LOCKED_QUESTION_CHOICE_SET"},
                      ]},
                      {"answerType": "TEXT", "additionalProperties": False, "fields": [
                          {"name": "questionKey", "type": "STRING", "required": True, "maxLength": 160},
                          {"name": "answerType", "type": "STRING", "required": True, "const": "TEXT"},
                          {"name": "textValue", "type": "STRING", "required": True,
                           "minLength": 1, "maxLength": 4000},
                      ]},
                  ],
              }),
        ],
        "protected.requestErasure": [
            f("tenantPublicId", "UUID", sensitivity="RESTRICTED"),
            f("responsePublicId", "UUID", sensitivity="HIGHLY_RESTRICTED"),
            f("erasureAuthority", "OBJECT", sensitivity="HIGHLY_RESTRICTED",
              validation=(
                  "closed union RETENTION_SCHEDULER(due policy)|SIGNED_PRIVACY_WORKFLOW(authority receipt)"
                  "; response UUID possession and anonymous-holder invocation are insufficient"
              ), value_schema={
                  "schemaId": "ListeningErasureAuthority.v1", "additionalProperties": False,
                  "discriminator": "authorityType",
                  "variants": [
                      {"authorityType": "RETENTION_SCHEDULER", "additionalProperties": False,
                       "fields": [
                           {"name": "authorityType", "type": "STRING", "required": True,
                            "const": "RETENTION_SCHEDULER"},
                           {"name": "retentionPolicyPublicId", "type": "UUID", "required": True},
                           {"name": "retentionPolicyRevision", "type": "BIGINT", "required": True},
                           {"name": "dueAt", "type": "TIMESTAMPTZ", "required": True},
                       ]},
                      {"authorityType": "SIGNED_PRIVACY_WORKFLOW", "additionalProperties": False,
                       "fields": [
                           {"name": "authorityType", "type": "STRING", "required": True,
                            "const": "SIGNED_PRIVACY_WORKFLOW"},
                           {"name": "authorityReceiptPublicId", "type": "UUID", "required": True},
                           {"name": "authorityReceiptRevision", "type": "BIGINT", "required": True},
                           {"name": "purposeCode", "type": "STRING", "required": True},
                           {"name": "ownerSignature", "type": "STRING", "required": True},
                       ]},
                  ],
              }),
            copy.deepcopy(common_idempotency),
        ],
        "protected.buildCohortPackage": [
            f("tenantPublicId", "UUID"), f("admissionPublicId", "UUID"),
            f("admissionVersionPublicId", "UUID"), f("admissionOwnerVersion", "BIGINT"),
            f("surveyPublicId", "UUID"),
            f("policyRevision", "BIGINT"), f("sourceEpoch", "TIMESTAMPTZ"),
            f("cutoffAt", "TIMESTAMPTZ"), f("measureSchemaVersion", "STRING"),
            copy.deepcopy(common_idempotency),
        ],
        "insights.ingestCohortPackage": [
            f("messageId", "UUID"), f("tenantPublicId", "UUID"), f("surveyPublicId", "UUID"),
            f("cohortPackagePublicId", "UUID"), f("policyRevision", "BIGINT"),
            f("sourceEpoch", "TIMESTAMPTZ"), f("cutoffAt", "TIMESTAMPTZ"),
            f("measureSchemaVersion", "STRING"), f("measureDefinitionDigest", "SHA256"),
            f("measureValues", "ARRAY", required=False, sensitivity="RESTRICTED",
              validation="REQUIRED_IFF_ADEQUATE;FORBIDDEN_IFF_SUPPRESSED; ListeningMeasureValue.v1 closed typed ordered array; raw and small-cell values forbidden",
              condition="adequacyCategory=ADEQUATE",
              value_schema={
                  "schemaId": "ListeningMeasureValue.v1", "additionalProperties": False,
                  "minItems": 1, "maxItems": 10000, "uniqueBy": "ordinal+measureKey",
                  "fields": [
                      f("ordinal", "INTEGER", validation="1..10000"),
                      f("measureKey", "STRING", validation="configured closed metric key max 160"),
                      f("valueType", "STRING", validation="COUNT|DECIMAL|RATE|SCORE"),
                      f("numericValue", "DECIMAL", validation="finite configured bounds"),
                      f("suppression", "STRING", validation="NONE_ONLY_FOR_ADEQUATE_PACKAGE"),
                  ],
                  "forbiddenFields": ["responseId", "answer", "workerId", "personId", "rawDimension"],
              }),
            f("subjectCount", "INTEGER", required=False,
              validation="REQUIRED_IFF_ADEQUATE;FORBIDDEN_IFF_SUPPRESSED",
              condition="adequacyCategory=ADEQUATE"),
            f("anonymityThreshold", "INTEGER"),
            f("privacyBudgetReceiptPublicId", "UUID"),
            f("adequacyCategory", "STRING", validation="ADEQUATE|SUPPRESSED"),
            f("packageSha256", "SHA256"), f("payloadDigest", "SHA256"),
            f("ownerSignature", "STRING", sensitivity="RESTRICTED"),
        ],
        "insights.queryCohortResults": [
            f("surveyPublicId", "UUID"), f("referenceEffectiveAt", "TIMESTAMPTZ"),
            f("cursor", "STRING", required=False), f("limit", "INTEGER", required=False, validation="1..200"),
        ],
        "issuer.issueParticipationEnvelope": [
            f("tenantPublicId", "UUID"),
            f("requestedSurveyPublicId", "UUID", sensitivity="RESTRICTED",
              validation=(
                  "candidate survey identity only; issuer must server-side resolve the signed admission "
                  "offer through the configuration-owner dependency after entitlement authorization"
              )),
            f("consentPolicyVersionPublicId", "UUID", sensitivity="RESTRICTED"),
            f("consentEvidencePublicId", "UUID", sensitivity="RESTRICTED"),
            f("consentEvidenceDigest", "SHA256", sensitivity="RESTRICTED"),
            f("tokenCommitment", "SHA256", sensitivity="HIGHLY_RESTRICTED",
              validation="SHA-256 domain LISTENING_RESPONSE_TOKEN_V1 over client-generated >=256-bit base64url token; raw token forbidden"),
            copy.deepcopy(common_idempotency),
        ],
        "issuer.resolveParticipationStatus": [
            f("tenantPublicId", "UUID"), f("opaqueJti", "UUID", sensitivity="HIGHLY_RESTRICTED"),
            f("tokenCommitment", "SHA256", sensitivity="HIGHLY_RESTRICTED"),
        ],
        "issuer.revokeParticipationEnvelope": [
            f("tenantPublicId", "UUID"), f("issuancePublicId", "UUID", sensitivity="RESTRICTED"),
            f("expectedIssuanceRevision", "BIGINT"), f("reasonCode", "STRING"),
            f("actorMode", "STRING", validation="TENANT_ADMIN|WORKER_SELF_EXACT_ISSUANCE_SUBJECT"),
            copy.deepcopy(common_idempotency),
        ],
    }
    for signed_message_port in (
        "protected.installAdmission",
        "protected.closeAdmission",
        "insights.ingestCohortPackage",
    ):
        request_fields_by_port[signed_message_port].extend([
            f("signingKeyId", "STRING", sensitivity="RESTRICTED",
              validation="active source-stream key at referenceEffectiveAt"),
            f("signatureAlgorithm", "STRING", sensitivity="RESTRICTED",
              validation="ED25519|ECDSA_P256_SHA256"),
        ])
    request_fields_by_port["protected.listActiveAdmissions"][0]["valueSchema"] = copy.deepcopy(
        request_fields_by_port["protected.submitResponse"][0]["valueSchema"]
    )
    signed_offer_response_schema = {
        "schemaId": "ListeningSignedAdmissionOfferSnapshot.v1",
        "additionalProperties": False,
        "fields": [
            f("tenantPublicId", "UUID"), f("surveyPublicId", "UUID"),
            f("surveyRevision", "BIGINT"), f("admissionPublicId", "UUID"),
            f("admissionVersionPublicId", "UUID"),
            f("admissionOwnerVersion", "BIGINT"),
            f("formVersionPublicId", "UUID"),
            f("formArtifactDigest", "SHA256"),
            f("privacyVersionPublicId", "UUID"),
            f("retentionVersionPublicId", "UUID"),
            f("tokenPolicyVersionPublicId", "UUID"),
            f("consentPolicyVersionPublicId", "UUID"),
            f("opensAt", "TIMESTAMPTZ"), f("closesAt", "TIMESTAMPTZ"),
            f("aud", "STRING"), f("kid", "STRING"), f("alg", "STRING"),
            f("signature", "STRING", sensitivity="RESTRICTED"),
        ],
    }
    # This schema is carried by a separately self-sealed dependency below;
    # normalize its signature fields before that dependency's seal is derived.
    apply_signature_contracts(signed_offer_response_schema)
    offer_dependency: dict[str, Any] = {
        "dependencyContractId": (
            "configuration.resolveSignedParticipationOfferForEntitledSubject.v1"
        ),
        "streamKey": configuration,
        "consumerOwnerPortOperation": "issuer.issueParticipationEnvelope",
        "executionClass": "AUTH_EDGE_TO_CONFIGURATION_SYNCHRONOUS_OWNER_DEPENDENCY",
        "durableProducerHandlerId": (
            "internal.listening.configuration.admission-install-receipt.consume"
        ),
        "requestSchema": {
            "schemaId": "ListeningParticipationOfferResolutionRequest.v1",
            "additionalProperties": False,
            "fields": [
                f("tenantPublicId", "UUID"),
                f("requestedSurveyPublicId", "UUID", sensitivity="RESTRICTED"),
                f("entitlementAudienceSnapshotPublicId", "UUID", sensitivity="RESTRICTED"),
                f("capturedAsOf", "TIMESTAMPTZ"),
            ],
        },
        "callerAuth": {
            "mode": "AUTH_EDGE_SERVICE_PRINCIPAL_SIGNED_REQUEST",
            "principalClass": "DWP_AUTH_HRIS_PARTICIPATION_ISSUER",
            "audience": "configuration.resolveSignedParticipationOfferForEntitledSubject",
            "signature": "active auth-edge service key covers exact request schema+digest",
            "clock": "bounded skew against capturedAsOf",
        },
        "pep": {
            "tenant": "signed tenant equals owner-local tenant mapping",
            "purpose": "LISTENING_PARTICIPATION_OFFER_BOOTSTRAP",
            "population": "exact entitlement audience snapshot equals stored survey audience snapshot",
            "fieldPolicy": "signed offer fields only; no response, token, principal or worker identity",
            "denyOnUnavailable": True,
        },
        "selectors": [
            {
                "selectorType": "CONFIGURATION_LOCAL_PUBLISHED_SURVEY_ROOT",
                "source": "request.requestedSurveyPublicId",
                "targetTable": "sys_hris_listening_surveys",
                "targetColumn": "public_id",
                "operator": "EQUALS",
                "cardinality": "EXACTLY_ONE",
                "tenantFilter": "tenant_id=owner-local request tenant",
                "versionRule": "status=PUBLISHED and aggregate_version locked in read snapshot",
                "asOfRule": "opens_at<=request.capturedAsOf<closes_at",
                "causalJoin": (
                    "audience_snapshot_id=request.entitlementAudienceSnapshotPublicId"
                ),
                "failure": "404_OR_409_ZERO_SIGNING_OUTPUT",
            },
            {
                "selectorType": "CONFIGURATION_LOCAL_FINAL_SURVEY_VERSION_AND_ADMISSION_PROOF",
                "source": "LOCKED_SURVEY.aggregate_version",
                "targetTable": "sys_hris_listening_survey_versions",
                "targetColumn": "owner_revision",
                "operator": "EQUALS",
                "cardinality": "EXACTLY_ONE",
                "tenantFilter": "same tenant and listening_survey_id as locked root",
                "versionRule": (
                    "state=PUBLISHED; admission public/version/owner revision and verified protected "
                    "receipt/request causation are non-null"
                ),
                "asOfRule": "reference_effective_at<=request.capturedAsOf",
                "causalJoin": (
                    "owner_revision=LOCKED_SURVEY.aggregate_version and protected_receipt_public_id "
                    "was signature-verified by durableProducerHandlerId"
                ),
                "failure": "404_OR_409_ZERO_SIGNING_OUTPUT",
            },
        ],
        "readPlan": {
            "tables": [
                "sys_hris_listening_surveys", "sys_hris_listening_survey_versions",
                "sys_hris_listening_operation_receipts",
            ],
            "snapshot": "one configuration-owner consistent read snapshot",
            "foreignRepositoryRead": False,
        },
        "orderedDml": [],
        "writes": "FORBIDDEN",
        "receiptAndOutbox": "FORBIDDEN_READ_ONLY_DEPENDENCY",
        "responseSchema": signed_offer_response_schema,
        "responseFieldSources": {
            "tenantPublicId": "OWNER_PUBLIC_ID:LOCKED_SURVEY.tenant_id",
            "surveyPublicId": "LOCKED_SURVEY.public_id",
            "surveyRevision": "LOCKED_SURVEY_VERSION.owner_revision",
            "admissionPublicId": "LOCKED_SURVEY_VERSION.admission_public_id",
            "admissionVersionPublicId": "LOCKED_SURVEY_VERSION.admission_version_public_id",
            "admissionOwnerVersion": "LOCKED_SURVEY_VERSION.admission_owner_version",
            "formVersionPublicId": "LOCKED_SURVEY_VERSION.form_version_public_id",
            "formArtifactDigest": "LOCKED_SURVEY_VERSION.form_artifact_digest",
            "privacyVersionPublicId": "LOCKED_SURVEY_VERSION.privacy_version_public_id",
            "retentionVersionPublicId": "LOCKED_SURVEY_VERSION.retention_version_public_id",
            "tokenPolicyVersionPublicId": "LOCKED_SURVEY_VERSION.token_policy_version_public_id",
            "consentPolicyVersionPublicId": "LOCKED_SURVEY_VERSION.consent_policy_version_public_id",
            "opensAt": "LOCKED_SURVEY.opens_at",
            "closesAt": "LOCKED_SURVEY.closes_at",
            "aud": "CONSTANT:issuer.issueParticipationEnvelope",
            "kid": "ACTIVE_CONFIGURATION_OFFER_SIGNING_KEY.kid",
            "alg": "ACTIVE_CONFIGURATION_OFFER_SIGNING_KEY.alg",
            "signature": "CONFIGURATION_SIGN:canonical preceding response fields",
        },
        "errorContract": {
            "401": "invalid auth-edge service signature; zero output",
            "403": "tenant/purpose/audience mismatch; zero output",
            "404": "no eligible published offer; opaque zero output",
            "409": "version/window/receipt causation mismatch; zero output",
            "503": "policy/key unavailable; fail closed zero output",
        },
        "implementationState": "NOT_STARTED_G3",
    }
    offer_dependency["sealedPayloadSha256"] = sha256_bytes(canonical_payload(offer_dependency))
    owner_dependency_contracts = [offer_dependency]
    query_ports = {
        "configuration.querySurveys", "protected.listActiveAdmissions",
        "insights.queryCohortResults", "issuer.resolveParticipationStatus",
    }
    selector_table_by_port = {
        "configuration.querySurveys": "sys_hris_listening_surveys",
        "configuration.reviseSurvey": "sys_hris_listening_surveys",
        "configuration.publishSurveyOrchestrate": "sys_hris_listening_surveys",
        "configuration.closeSurveyOrchestrate": "sys_hris_listening_surveys",
        "configuration.createAction": "sys_hris_listening_survey_versions",
        "configuration.completeAction": "sys_hris_listening_actions",
        "protected.listActiveAdmissions": "sys_hris_listening_admission_versions",
        "protected.installAdmission": "sys_hris_listening_protected_receipts",
        "protected.closeAdmission": "sys_hris_listening_admission_versions",
        "protected.submitResponse": "sys_hris_listening_admission_versions",
        "protected.requestErasure": "sys_hris_listening_responses",
        "protected.buildCohortPackage": "sys_hris_listening_admission_versions",
        "insights.ingestCohortPackage": "sys_hris_listening_insights_inbox",
        "insights.queryCohortResults": "sys_hris_listening_cohort_projections",
        "issuer.resolveParticipationStatus": "sys_hris_listening_token_issuances",
        "issuer.revokeParticipationEnvelope": "sys_hris_listening_token_issuances",
    }
    write_tables_by_port = {
        "configuration.createSurvey": [("APPEND", "sys_hris_listening_surveys"), ("APPEND", "sys_hris_listening_survey_versions")],
        "configuration.reviseSurvey": [("UPDATE_CAS", "sys_hris_listening_surveys"), ("APPEND", "sys_hris_listening_survey_versions")],
        "configuration.publishSurveyOrchestrate": [("UPDATE_CAS", "sys_hris_listening_surveys"), ("APPEND", "sys_hris_listening_survey_versions")],
        "configuration.closeSurveyOrchestrate": [("UPDATE_CAS", "sys_hris_listening_surveys"), ("APPEND", "sys_hris_listening_survey_versions")],
        "configuration.createAction": [("APPEND", "sys_hris_listening_actions")],
        "configuration.completeAction": [("UPDATE_CAS", "sys_hris_listening_actions")],
        "protected.installAdmission": [("APPEND", "sys_hris_listening_admission_versions")],
        "protected.closeAdmission": [("APPEND", "sys_hris_listening_admission_versions")],
        "protected.submitResponse": [("CLAIM_OR_REPLAY", "sys_hris_listening_token_consumptions"), ("APPEND", "sys_hris_listening_responses"), ("APPEND_MANY", "sys_hris_listening_answer_values")],
        "protected.requestErasure": [("APPEND", "sys_hris_listening_erasure_tickets")],
        "protected.buildCohortPackage": [("CLAIM_OR_REPLAY", "sys_hris_listening_cohort_budgets"), ("APPEND", "sys_hris_listening_cohort_packages")],
        # The internal-message wrapper adds the single inbox claim.  Domain
        # rows below must not duplicate it.
        "insights.ingestCohortPackage": [("APPEND", "sys_hris_listening_cohort_projections"), ("APPEND", "sys_hris_listening_lineage_receipts")],
        "issuer.issueParticipationEnvelope": [
            ("APPEND", "sys_hris_listening_eligibility_versions"),
            ("APPEND", "sys_hris_listening_token_issuances"),
            ("APPEND", "sys_hris_listening_issuer_receipts"),
            ("APPEND_PRIVATE_ONLY", "sys_hris_listening_issuer_outbox"),
        ],
        "issuer.revokeParticipationEnvelope": [
            ("APPEND", "sys_hris_listening_token_revocations"),
            ("APPEND", "sys_hris_listening_issuer_receipts"),
            ("APPEND_PRIVATE_ONLY", "sys_hris_listening_issuer_outbox"),
        ],
    }
    state_by_port = {
        "configuration.publishSurveyOrchestrate": (["DRAFT", "PUBLISH_RETRYABLE"], ["PUBLISH_PENDING"]),
        "configuration.closeSurveyOrchestrate": (["PUBLISHED", "CLOSE_RETRYABLE"], ["CLOSE_PENDING"]),
        "protected.installAdmission": (["NONE"], ["ACTIVE"]),
        "protected.closeAdmission": (["ACTIVE"], ["CLOSED"]),
        "protected.submitResponse": (["ACTIVE", "UNCONSUMED"], ["SUBMITTED", "CONSUMED"]),
        "protected.requestErasure": (["SUBMITTED"], ["REQUESTED"]),
        "protected.buildCohortPackage": (["CLOSED", "UNCLAIMED_BUDGET"], ["READY", "SUPPRESSED"]),
        "insights.ingestCohortPackage": (["NONE"], ["PUBLISHED", "SUPPRESSED"]),
        "issuer.issueParticipationEnvelope": (["ELIGIBLE"], ["ISSUED"]),
        "issuer.revokeParticipationEnvelope": (["ISSUED"], ["REVOKED"]),
    }
    receipt_outbox_by_stream = {
        configuration: ("sys_hris_listening_operation_receipts", "sys_hris_listening_domain_outbox"),
        protected: ("sys_hris_listening_protected_receipts", "sys_hris_listening_protected_outbox"),
        insights: ("sys_hris_listening_insights_inbox", "sys_hris_listening_insights_outbox"),
        issuer: ("sys_hris_listening_issuer_receipts", "sys_hris_listening_issuer_outbox"),
    }
    owner_port_operation_contracts = []
    for name, stream_key, kind in owner_ports:
        if name in public_by_port:
            execution_class = "PUBLIC_OPERATION"
            entrypoint_ref = {"publicOperationId": public_by_port[name]}
        elif name in handler_by_port:
            execution_class = (
                "OWNER_LOCAL_SCHEDULED_JOB"
                if name == "protected.buildCohortPackage" else "INTERNAL_MESSAGE_HANDLER"
            )
            if name == "protected.requestErasure":
                # This ingress is deliberately not a broker message.  It is a
                # protected-owner synchronous union: an owner-local retention
                # scheduler call or a signed privacy-workflow call.  Keeping it
                # classified as INTERNAL_MESSAGE_HANDLER would imply a seventh
                # cross-stream message that does not exist in the closed six.
                execution_class = (
                    "OWNER_LOCAL_RETENTION_OR_SIGNED_PRIVACY_SYNCHRONOUS_PORT"
                )
            entrypoint_ref = {"systemHandlerId": handler_by_port[name]}
        else:
            execution_class = "AUTH_OWNER_SYNCHRONOUS_PORT"
            entrypoint_ref = {"authPortHandlerId": auth_refs[name]}
        selector_table = selector_table_by_port.get(name)
        selectors = ([] if selector_table is None else [{
            "selectorType": "OWNER_LOCAL_TABLE",
            "source": "request exact public identity/version/asOf",
            "targetTable": selector_table,
            "targetColumn": "public_id",
            "sourceType": "UUID",
            "targetSqlType": "UUID",
            "tenantFilter": "tenant_id=verifiedTenantId",
            "versionRule": "exact owner revision or captured asOf; no latest fallback",
            "asOfRule": "reference_effective_at<=captured owner clock",
            "cardinality": "EXACTLY_ONE_OR_OPAQUE_NOT_FOUND",
            "failure": "404_OR_409_ZERO_MUTATION",
        }])
        submit_response_dml = None
        if name == "protected.submitResponse":
            submit_response_dml = [
                {"action": "CLAIM_OR_REPLAY", "table": "sys_hris_listening_protected_receipts",
                 "assignments": {
                     "tenant_id": "VERIFIED_CREDENTIAL.tenant owner-local mapping",
                     "public_id": "SERVER_ALLOCATE:UNLINKABLE_UUID_V7_REPLAY_STABLE",
                     "receipt_kind": "CONSTANT:SUBMISSION",
                     "admission_public_id": "VERIFIED_CREDENTIAL.admissionPublicId",
                     "state": "CONSTANT:RUNNING",
                     "owner_revision": "CONSTANT:1", "idempotency_key": "OWNER_HMAC:request.responseToken",
                     "request_digest": "OWNER_KEYED_DIGEST:canonical typed request using per-response secret",
                     "payload_digest": "OWNER_KEYED_DIGEST:canonical typed request using per-response secret",
                     "reference_effective_at": "ownerClock.transactionNow",
                 }, "expectedRows": "ONE_NEW_OR_SEALED_SAME_DIGEST_REPLAY"},
                {"action": "LOCK_FOR_UPDATE", "table": "sys_hris_listening_admission_versions",
                 "assignments": {},
                 "expectedRows": "EXACT_LATEST_STABLE_ACTIVE_VERSION_AND_CREDENTIAL_PIN"},
                {"action": "CLAIM_OR_REPLAY", "table": "sys_hris_listening_token_consumptions",
                 "assignments": {
                     "tenant_id": "LOCKED_ADMISSION.tenant_id",
                     "public_id": "SERVER_ALLOCATE:UNLINKABLE_UUID_V7_REPLAY_STABLE",
                     "listening_admission_version_id": "LOCKED_ADMISSION.record_id",
                     "token_commitment": "VERIFIED_CREDENTIAL.tokenCommitment",
                     "credential_jti_commitment": "OWNER_HMAC:VERIFIED_CREDENTIAL.opaqueJti",
                     "credential_digest": "SERVER_DERIVE:verified credential digest",
                     "non_revocation_proof_digest": "SERVER_DERIVE:verified offline proof digest",
                     "request_digest": "PROTECTED_RECEIPT.request_digest",
                     "state": "CONSTANT:CONSUMED", "owner_revision": "CONSTANT:1",
                     "consumed_at": "ownerClock.transactionNow",
                     "payload_digest": "OWNER_HMAC:request.responseToken",
                     "reference_effective_at": "ownerClock.transactionNow",
                 }, "expectedRows": "ONE_NEW_OR_TOMBSTONED_OR_SEALED_REPLAY"},
                {"action": "APPEND", "table": "sys_hris_listening_responses",
                 "assignments": {
                     "tenant_id": "LOCKED_ADMISSION.tenant_id",
                     "public_id": "SERVER_ALLOCATE:UNLINKABLE_UUID_V7_REPLAY_STABLE",
                     "listening_admission_version_id": "LOCKED_ADMISSION.record_id",
                     "survey_public_id": "LOCKED_ADMISSION.survey_public_id",
                     "survey_revision": "LOCKED_ADMISSION.survey_revision",
                     "response_key_public_id": "OWNER_KEY_MANAGER:ALLOCATE_PER_RESPONSE_DEK_ID",
                     "response_key_version": "CONSTANT:1",
                     "form_version_public_id": "LOCKED_ADMISSION.form_version_public_id",
                     "form_artifact_digest": "LOCKED_ADMISSION.form_artifact_digest",
                     "consent_policy_version_public_id": "LOCKED_ADMISSION.consent_policy_version_public_id",
                     "consent_evidence_digest": "VERIFIED_CREDENTIAL.consentEvidenceCommitment",
                     "status": "CONSTANT:SUBMITTED", "owner_revision": "CONSTANT:1",
                     "response_digest": "OWNER_KEYED_DIGEST_WITH_PER_RESPONSE_DEK:canonical typed answers",
                     "response_token_hash": "OWNER_HMAC:DOMAIN_SHA256(request.responseToken)",
                     "submitted_at": "ownerClock.transactionNow", "erase_after": "LOCKED_ADMISSION.erase_after",
                     "payload_digest": "OWNER_KEYED_DIGEST_WITH_PER_RESPONSE_DEK:minimized metadata",
                     "reference_effective_at": "ownerClock.transactionNow",
                 }, "expectedRows": "EXACTLY_ONE_FOR_NEW_TOKEN_CLAIM"},
                {"action": "APPEND_MANY", "table": "sys_hris_listening_answer_values",
                 "assignments": {
                     "tenant_id": "LOCKED_ADMISSION.tenant_id",
                     "public_id": "SERVER_ALLOCATE:UNLINKABLE_UUID_V7",
                     "listening_response_id": "PREVIOUS:response.record_id",
                     "question_key": "request.answers[*].questionKey",
                     "answer_type": "request.answers[*].answerType",
                     "encrypted_answer": "SERVER_ENCRYPT_WITH_RESPONSE_DEK:request.answers[*].typedValue",
                     "response_key_public_id": "PREVIOUS:response.response_key_public_id",
                     "response_key_version": "PREVIOUS:response.response_key_version",
                     "state": "CONSTANT:ACTIVE", "owner_revision": "LOCKED_ADMISSION.form_revision",
                     "payload_digest": "OWNER_KEYED_DIGEST_WITH_PER_RESPONSE_DEK:encrypted typed answer",
                     "reference_effective_at": "ownerClock.transactionNow",
                 }, "expectedRows": "EXACT_REQUEST_ANSWER_CARDINALITY"},
                {"action": "UPDATE_CAS", "table": "sys_hris_listening_token_consumptions",
                 "assignments": {"response_public_id": "PREVIOUS:response.public_id",
                                 "owner_revision": "LOCKED_PRE:owner_revision+1"},
                 "expectedRows": "EXACTLY_ONE_NEW_CLAIM_ZERO_ON_REPLAY"},
                {"action": "UPDATE_CAS", "table": "sys_hris_listening_protected_receipts",
                 "assignments": {"listening_response_id": "PREVIOUS:response.record_id",
                                 "response_public_id": "PREVIOUS:response.public_id",
                                 "state": "CONSTANT:COMPLETED",
                                 "owner_revision": "LOCKED_PRE:owner_revision+1",
                                 "result_digest": "SERVER_DERIVE:canonical private result",
                                 "completed_at": "ownerClock.transactionNow"},
                 "expectedRows": "EXACTLY_ONE_NEW_CLAIM_ZERO_ON_REPLAY"},
            ]
        if name == "issuer.issueParticipationEnvelope":
            selectors = [
                {
                    "selectorType": "AUTH_OWNER_ENTITLEMENT_POPULATION_RESOLUTION",
                    "source": "authenticated principal+application entitlement+persona+population policy",
                    "targetTable": "AUTH_OWNER_PORT::DWP.Authorization.CurrentHrisEntitlement",
                    "targetColumn": "principalPublicId", "sourceType": "AUTHENTICATED_PRINCIPAL",
                    "targetSqlType": "UUID", "tenantFilter": "principal tenant=request tenant",
                    "versionRule": "active entitlement/persona/population/audience policy exact revision",
                    "asOfRule": "captured auth-owner transaction clock",
                    "cardinality": "EXACTLY_ONE_ELIGIBLE_OR_403_ZERO_WRITES",
                    "failure": "401_403_503_ZERO_ISSUER_MUTATION",
                },
                {
                    "selectorType": "SERVER_SIDE_SIGNED_ADMISSION_OFFER_RESOLUTION",
                    "source": (
                        "request.requestedSurveyPublicId+AUTH_OWNER_RESOLUTION.audienceSnapshotPublicId"
                    ),
                    "targetTable": (
                        "OWNER_PORT::DWP.Listening.ConfigurationSignedAdmissionOfferResolution"
                    ),
                    "targetColumn": "surveyPublicId", "sourceType": "UUID",
                    "targetSqlType": "UUID", "tenantFilter": "signed tenant=request/auth tenant",
                    "versionRule": "exact survey+admission version+form+privacy+retention+token+consent pins",
                    "asOfRule": "signed opensAt<=capturedNow<closesAt",
                    "cardinality": "EXACTLY_ONE_VALID_SIGNED_SNAPSHOT",
                    "failure": "400_401_409_503_ZERO_ISSUER_MUTATION",
                    "dependencyContractId": offer_dependency["dependencyContractId"],
                    "dependencyContractSha256": offer_dependency["sealedPayloadSha256"],
                },
                {
                    "selectorType": "CONSENT_OWNER_EXACT_EVIDENCE",
                    "source": (
                        "request.consentEvidencePublicId+request.consentEvidenceDigest+"
                        "request.consentPolicyVersionPublicId+SIGNED_OFFER.consentPolicyVersionPublicId+"
                        "AUTH_OWNER_RESOLUTION.principalPublicId"
                    ),
                    "targetTable": "OWNER_PORT::DWP.Consent.DecisionEvidence",
                    "targetColumn": "publicId", "sourceType": "UUID", "targetSqlType": "UUID",
                    "tenantFilter": "owner proof tenant=request/auth tenant",
                    "versionRule": (
                        "request.consentPolicyVersionPublicId="
                        "SIGNED_OFFER.consentPolicyVersionPublicId="
                        "CONSENT_PROOF.policyVersionPublicId; evidence digest+exact subject; "
                        "any cross-field mismatch is 409 with zero writes"
                    ),
                    "asOfRule": "valid at captured auth-owner clock",
                    "causalJoin": (
                        "CONSENT_PROOF.subjectPrincipalPublicId="
                        "AUTH_OWNER_RESOLUTION.principalPublicId AND "
                        "request.consentPolicyVersionPublicId="
                        "SIGNED_OFFER.consentPolicyVersionPublicId="
                        "CONSENT_PROOF.policyVersionPublicId AND "
                        "request.consentEvidenceDigest=CONSENT_PROOF.digest"
                    ),
                    "cardinality": "EXACTLY_ONE_OR_403_ZERO_WRITES",
                    "failure": "403_404_409_503_ZERO_ISSUER_MUTATION",
                },
            ]
        elif name == "issuer.resolveParticipationStatus":
            selectors = [
                {
                    "selectorType": "ISSUER_LOCAL_OPAQUE_JTI_COMMITMENT",
                    "source": "OWNER_HMAC(request.opaqueJti)",
                    "targetTable": "sys_hris_listening_token_issuances",
                    "targetColumn": "opaque_jti_commitment", "sourceType": "SHA256",
                    "targetSqlType": "CHAR(64)",
                    "tenantFilter": "tenant_id=verified authenticated request tenant",
                    "versionRule": "exact issuance row and authenticated issuance subject/auth-edge binding",
                    "asOfRule": (
                        "lookup remains exact after expiry; ownerClock.transactionNow decides ACTIVE "
                        "versus EXPIRED and caller-controlled historical time is forbidden; "
                        "signing key must be valid for the new bounded status proof"
                    ),
                    "cardinality": "EXACTLY_ONE_OR_OPAQUE_NOT_FOUND",
                    "failure": "401_403_404_409_ZERO_MUTATION",
                },
                {
                    "selectorType": "ISSUER_LOCAL_TOKEN_COMMITMENT_EQUALITY",
                    "source": "request.tokenCommitment",
                    "targetTable": "sys_hris_listening_token_issuances",
                    "targetColumn": "token_commitment", "sourceType": "SHA256",
                    "targetSqlType": "CHAR(64)",
                    "tenantFilter": "same tenant and same issuance row as opaque JTI selector",
                    "versionRule": "latest matching immutable revocation decides ACTIVE|REVOKED",
                    "asOfRule": (
                        "revoked_at<=ownerClock.transactionNow; expires_at<=ownerClock.transactionNow "
                        "=> EXPIRED; ACTIVE proof generated/expires at bounded owner now"
                    ),
                    "cardinality": "EXACTLY_ONE_SAME_ISSUANCE_ROW",
                    "failure": "404_OR_409_ZERO_MUTATION",
                },
                {
                    "selectorType": "ISSUER_LOCAL_ELIGIBILITY_SUBJECT_OR_AUTH_EDGE_BINDING",
                    "source": "LOCKED_ISSUANCE.listening_eligibility_version_id",
                    "targetTable": "sys_hris_listening_eligibility_versions",
                    "targetColumn": "record_id", "sourceType": "BIGINT",
                    "targetSqlType": "BIGINT",
                    "tenantFilter": "eligibility.tenant_id=LOCKED_ISSUANCE.tenant_id=request tenant",
                    "versionRule": (
                        "authenticated issuance subject requires eligibility.subject_principal_public_id="
                        "authenticatedPrincipal.publicId; auth-edge requires separately allowlisted service "
                        "audience+purpose with no protected endpoint identity"
                    ),
                    "asOfRule": (
                        "eligibility immutable valid_from<=ownerClock.transactionNow<valid_to"
                    ),
                    "cardinality": "EXACTLY_ONE_AUTHORIZED_SUBJECT_OR_AUTH_EDGE",
                    "failure": "401_403_404_OPAQUE_ZERO_MUTATION",
                },
            ]
        elif name == "issuer.revokeParticipationEnvelope":
            selectors = [
                {
                    "selectorType": "ISSUER_LOCAL_EXACT_ISSUANCE_REVISION",
                    "source": "request.issuancePublicId+expectedIssuanceRevision",
                    "targetTable": "sys_hris_listening_token_issuances",
                    "targetColumn": "public_id", "sourceType": "UUID",
                    "targetSqlType": "UUID", "tenantFilter": "tenant_id=request/auth tenant",
                    "versionRule": "owner_revision=request.expectedIssuanceRevision and state=ISSUED",
                    "asOfRule": "immutable issuance row under captured owner clock",
                    "cardinality": "EXACTLY_ONE_OR_OPAQUE_NOT_FOUND",
                    "failure": "404_OR_409_ZERO_MUTATION",
                },
                {
                    "selectorType": "ISSUER_LOCAL_REVOCATION_ACTOR_BINDING",
                    "source": "LOCKED_ISSUANCE.listening_eligibility_version_id+request.actorMode",
                    "targetTable": "sys_hris_listening_eligibility_versions",
                    "targetColumn": "record_id", "sourceType": "BIGINT",
                    "targetSqlType": "BIGINT",
                    "tenantFilter": "eligibility.tenant_id=LOCKED_ISSUANCE.tenant_id=request/auth tenant",
                    "versionRule": (
                        "WORKER_SELF_EXACT_ISSUANCE_SUBJECT requires eligibility.subject_principal_public_id="
                        "authenticatedPrincipal.publicId; TENANT_ADMIN requires distinct revoke capability "
                        "and exact delegation receipt when acting outside own subject"
                    ),
                    "asOfRule": "eligibility immutable and exact issuance-bound snapshot",
                    "cardinality": "EXACTLY_ONE_AUTHORIZED_ACTOR_BRANCH",
                    "failure": "403_OR_404_OPAQUE_ZERO_MUTATION",
                },
            ]
        elif name in {
            "protected.listActiveAdmissions", "protected.submitResponse",
            "protected.buildCohortPackage",
        }:
            selectors = [{
                "selectorType": "OWNER_LOCAL_LATEST_STABLE_ADMISSION_FENCE",
                "source": (
                    "request.signedParticipationCredential.admissionPublicId"
                    if name != "protected.buildCohortPackage"
                    else "schedulerRequest.admissionPublicId"
                ),
                "targetTable": "sys_hris_listening_admission_versions",
                "targetColumn": "admission_public_id", "sourceType": "UUID",
                "targetSqlType": "UUID", "tenantFilter": "target.tenant_id=verified owner-local tenant",
                "versionRule": (
                    "select max owner_revision for stable admission then require exact request/credential "
                    "admissionVersionPublicId+ownerRevision"
                ),
                "asOfRule": (
                    "latest state ACTIVE and window open" if name != "protected.buildCohortPackage"
                    else "latest state CLOSED and sourceEpoch/cutoff exact"
                ),
                "cardinality": "EXACTLY_ONE_LATEST_OR_OPAQUE_NOT_FOUND",
                "failure": "404_OR_409_ZERO_MUTATION",
            }]
            if name in {"protected.listActiveAdmissions", "protected.submitResponse"}:
                selectors.append({
                    "selectorType": "SIGNED_CREDENTIAL_PROTECTED_RESOURCE_AUDIENCE",
                    "source": "request.signedParticipationCredential.aud",
                    "targetTable": "OWNER_PORT::DWP.Listening.ProtectedResourceAudienceVerifier",
                    "targetColumn": "resource_audience",
                    "sourceType": "STRING", "targetSqlType": "VARCHAR(240)",
                    "operator": "EQUALS_CONSTANT",
                    "tenantFilter": "credential tenant equals locked protected-local admission tenant",
                    "purposeFilter": "LISTENING_PROTECTED_ACTIVE_OR_SUBMIT_ONLY",
                    "versionRule": (
                        "aud=DWP.HRIS.LISTENING.PROTECTED and issuer key active for iat/kid"
                    ),
                    "asOfRule": (
                        "nbf<=ownerClock.transactionNow<exp and offline non-revocation proof current"
                    ),
                    "cardinality": "EXACTLY_ONE_VALID_RESOURCE_AUDIENCE",
                    "failure": "401_403_ZERO_READ_OR_MUTATION",
                })
        receipt, outbox = receipt_outbox_by_stream[stream_key]
        dml = []
        if name not in query_ports:
            if execution_class == "INTERNAL_MESSAGE_HANDLER":
                dml.append({
                    "action": "CLAIM_OR_REPLAY", "table": receipt,
                    "assignments": {
                        "tenant_id": "verified signed-message tenant",
                        "message_id": "request.messageId",
                        "payload_digest": "canonical signed request digest",
                    },
                    "expectedRows": "ONE_NEW_CLAIM_OR_SEALED_SAME_DIGEST_REPLAY",
                })
            for action, table_name in write_tables_by_port.get(name, []):
                dml.append({
                    "action": action, "table": table_name,
                    "assignments": {
                        "tenant_id": "verified request tenant",
                        "public_id": "owner generated replay-stable public identity",
                        "owner_revision": "exact initial or locked predecessor+1",
                        "payload_digest": "canonical typed request/result digest",
                        "reference_effective_at": "captured owner clock",
                    },
                    "expectedRows": "EXACTLY_ONE_OR_SEALED_SAME_DIGEST_REPLAY",
                })
            tables_already_written = {row["table"] for row in dml}
            if receipt not in tables_already_written:
                dml.append({
                    "action": "APPEND_SEALED_OWNER_RECEIPT", "table": receipt,
                    "assignments": {
                        "tenant_id": "verified request tenant",
                        "public_id": "owner generated replay-stable receipt identity",
                        "payload_digest": "canonical typed result digest",
                        "reference_effective_at": "captured owner clock",
                    },
                    "expectedRows": "EXACTLY_ONE_OR_SEALED_SAME_DIGEST_REPLAY",
                })
            private_no_broker = name in {
                "protected.submitResponse", "protected.requestErasure",
            }
            if outbox not in tables_already_written and not private_no_broker:
                dml.append({
                    "action": (
                        "APPEND_PRIVATE_OWNER_DELIVERY"
                        if stream_key == issuer else "APPEND_SIGNED_OWNER_OUTBOX"
                    ),
                    "table": outbox,
                    "assignments": {
                        "tenant_id": "verified request tenant",
                        "message_id": "owner generated replay-stable message identity",
                        "payload_digest": "canonical typed result/message digest",
                    },
                    "expectedRows": "EXACTLY_ONE_OR_SEALED_SAME_DIGEST_REPLAY",
                })
        if name == "issuer.issueParticipationEnvelope":
            dml = [
                {"action": "APPEND", "table": "sys_hris_listening_eligibility_versions",
                 "assignments": {
                     "tenant_id": "authenticatedPrincipal.tenantId",
                     "public_id": "SERVER_ALLOCATE:UUID_V7_REPLAY_STABLE",
                     "state": "CONSTANT:ELIGIBLE", "owner_revision": "CONSTANT:1",
                     "subject_principal_public_id": "AUTH_OWNER_RESOLUTION.principalPublicId",
                     "hris_entitlement_version_public_id": "AUTH_OWNER_RESOLUTION.entitlementVersionPublicId",
                     "persona_code": "AUTH_OWNER_RESOLUTION.personaCode",
                     "population_scope_digest": "AUTH_OWNER_RESOLUTION.populationScopeDigest",
                     "audience_snapshot_public_id": "AUTH_OWNER_RESOLUTION.audienceSnapshotPublicId",
                     "survey_public_id": "SIGNED_OFFER.surveyPublicId",
                     "survey_revision": "SIGNED_OFFER.surveyRevision",
                     "admission_public_id": "SIGNED_OFFER.admissionPublicId",
                     "admission_version_public_id": "SIGNED_OFFER.admissionVersionPublicId",
                     "admission_owner_version": "SIGNED_OFFER.admissionOwnerVersion",
                     "form_version_public_id": "SIGNED_OFFER.formVersionPublicId",
                     "form_artifact_digest": "SIGNED_OFFER.formArtifactDigest",
                     "privacy_version_public_id": "SIGNED_OFFER.privacyVersionPublicId",
                     "retention_version_public_id": "SIGNED_OFFER.retentionVersionPublicId",
                     "token_policy_version_public_id": "SIGNED_OFFER.tokenPolicyVersionPublicId",
                     "consent_policy_version_public_id": "CONSENT_PROOF.policyVersionPublicId",
                     "consent_evidence_public_id": "CONSENT_PROOF.publicId",
                     "consent_evidence_digest": "CONSENT_PROOF.digest",
                     "valid_from": "ownerClock.transactionNow", "valid_to": "SERVER_DERIVE:bounded offer/policy expiry",
                     "idempotency_key": "request.idempotencyKey", "request_digest": "SERVER_DERIVE:canonical request",
                     "payload_digest": "SERVER_DERIVE:canonical immutable eligibility snapshot",
                     "reference_effective_at": "ownerClock.transactionNow",
                 }, "expectedRows": "EXACTLY_ONE_OR_SEALED_SAME_DIGEST_REPLAY"},
                {"action": "APPEND", "table": "sys_hris_listening_token_issuances",
                 "assignments": {
                     "tenant_id": "authenticatedPrincipal.tenantId",
                     "public_id": "SERVER_ALLOCATE:UUID_V7_REPLAY_STABLE",
                     "state": "CONSTANT:ISSUED", "owner_revision": "CONSTANT:1",
                     "listening_eligibility_version_id": "PREVIOUS:eligibility.record_id",
                     "eligibility_version_public_id": "PREVIOUS:eligibility.public_id",
                     "opaque_jti_commitment": "OWNER_HMAC:SERVER_ALLOCATED_OPAQUE_JTI",
                     "token_commitment": "request.tokenCommitment",
                     "audience": "CONSTANT:DWP.HRIS.LISTENING.PROTECTED",
                     "issued_at": "ownerClock.transactionNow", "not_before": "ownerClock.transactionNow",
                     "expires_at": "SERVER_DERIVE:bounded token-policy/offer expiry",
                     "signing_key_id": "ACTIVE_ISSUER_KEY.kid", "algorithm": "ACTIVE_ISSUER_KEY.alg",
                     "credential_digest": "SERVER_DERIVE:canonical credential claims",
                     "credential_signature": "SERVER_SIGN:canonical credential claims",
                     "idempotency_key": "request.idempotencyKey", "request_digest": "SERVER_DERIVE:canonical request",
                     "payload_digest": "SERVER_DERIVE:canonical signed credential",
                     "reference_effective_at": "ownerClock.transactionNow",
                 }, "expectedRows": "EXACTLY_ONE_OR_SEALED_SAME_DIGEST_REPLAY"},
                {"action": "APPEND", "table": "sys_hris_listening_issuer_receipts",
                 "assignments": {
                     "tenant_id": "authenticatedPrincipal.tenantId",
                     "public_id": "SERVER_ALLOCATE:UUID_V7_REPLAY_STABLE",
                     "state": "CONSTANT:COMPLETED", "owner_revision": "CONSTANT:1",
                     "receipt_kind": "CONSTANT:ISSUANCE", "operation_name": "CONSTANT:issuer.issueParticipationEnvelope",
                     "idempotency_key": "request.idempotencyKey", "request_digest": "SERVER_DERIVE:canonical request",
                     "result_digest": "PREVIOUS:issuance.credential_digest",
                     "eligibility_version_public_id": "PREVIOUS:eligibility.public_id",
                     "issuance_public_id": "PREVIOUS:issuance.public_id", "revocation_public_id": "CONSTANT:NULL",
                     "completed_at": "ownerClock.transactionNow", "payload_digest": "PREVIOUS:issuance.credential_digest",
                     "reference_effective_at": "ownerClock.transactionNow",
                 }, "expectedRows": "EXACTLY_ONE_OR_SEALED_SAME_DIGEST_REPLAY"},
                {"action": "APPEND_PRIVATE_ONLY", "table": "sys_hris_listening_issuer_outbox",
                 "assignments": {
                     "tenant_id": "authenticatedPrincipal.tenantId",
                     "public_id": "SERVER_ALLOCATE:UUID_V7_REPLAY_STABLE",
                     "state": "CONSTANT:PENDING", "owner_revision": "CONSTANT:1",
                     "delivery_kind": "CONSTANT:OWNER_LOCAL_PRIVATE_BROKER_FORBIDDEN",
                     "message_id": "SERVER_ALLOCATE:UUID_V7_REPLAY_STABLE",
                     "payload": "SERVER_DERIVE:signed credential+private receipt only",
                     "delivered_at": "CONSTANT:NULL", "payload_digest": "PREVIOUS:issuance.credential_digest",
                     "reference_effective_at": "ownerClock.transactionNow",
                 }, "expectedRows": "EXACTLY_ONE_FOR_NEW_ISSUANCE"},
            ]
        elif name == "issuer.revokeParticipationEnvelope":
            dml = [
                {"action": "APPEND", "table": "sys_hris_listening_token_revocations",
                 "assignments": {
                     "tenant_id": "authenticatedPrincipal.tenantId",
                     "public_id": "SERVER_ALLOCATE:UUID_V7_REPLAY_STABLE",
                     "state": "CONSTANT:REVOKED", "owner_revision": "LOCKED_ISSUANCE.owner_revision+1",
                     "listening_token_issuance_id": "LOCKED_ISSUANCE.record_id",
                     "issuance_public_id": "LOCKED_ISSUANCE.public_id",
                     "issuance_revision": "request.expectedIssuanceRevision",
                     "reason_code": "request.reasonCode", "actor_mode": "request.actorMode",
                     "actor_public_id": "authenticatedPrincipal.publicId",
                     "delegation_receipt_public_id": "AUTHORIZATION.delegationReceiptPublicId OR NULL",
                     "revoked_at": "ownerClock.transactionNow", "idempotency_key": "request.idempotencyKey",
                     "request_digest": "SERVER_DERIVE:canonical request",
                     "payload_digest": "SERVER_DERIVE:immutable revocation decision",
                     "reference_effective_at": "ownerClock.transactionNow",
                 }, "expectedRows": "EXACTLY_ONE_OR_SEALED_SAME_DIGEST_REPLAY"},
                {"action": "APPEND", "table": "sys_hris_listening_issuer_receipts",
                 "assignments": {
                     "tenant_id": "authenticatedPrincipal.tenantId",
                     "public_id": "SERVER_ALLOCATE:UUID_V7_REPLAY_STABLE",
                     "state": "CONSTANT:COMPLETED", "owner_revision": "CONSTANT:1",
                     "receipt_kind": "CONSTANT:REVOCATION", "operation_name": "CONSTANT:issuer.revokeParticipationEnvelope",
                     "idempotency_key": "request.idempotencyKey", "request_digest": "SERVER_DERIVE:canonical request",
                     "result_digest": "PREVIOUS:revocation.payload_digest", "eligibility_version_public_id": "CONSTANT:NULL",
                     "issuance_public_id": "LOCKED_ISSUANCE.public_id",
                     "revocation_public_id": "PREVIOUS:revocation.public_id", "completed_at": "ownerClock.transactionNow",
                     "payload_digest": "PREVIOUS:revocation.payload_digest", "reference_effective_at": "ownerClock.transactionNow",
                 }, "expectedRows": "EXACTLY_ONE_OR_SEALED_SAME_DIGEST_REPLAY"},
                {"action": "APPEND_PRIVATE_ONLY", "table": "sys_hris_listening_issuer_outbox",
                 "assignments": {
                     "tenant_id": "authenticatedPrincipal.tenantId", "public_id": "SERVER_ALLOCATE:UUID_V7_REPLAY_STABLE",
                     "state": "CONSTANT:PENDING", "owner_revision": "CONSTANT:1",
                     "delivery_kind": "CONSTANT:OWNER_LOCAL_PRIVATE_BROKER_FORBIDDEN",
                     "message_id": "SERVER_ALLOCATE:UUID_V7_REPLAY_STABLE",
                     "payload": "SERVER_DERIVE:signed revocation status+private receipt only",
                     "delivered_at": "CONSTANT:NULL", "payload_digest": "PREVIOUS:revocation.payload_digest",
                     "reference_effective_at": "ownerClock.transactionNow",
                 }, "expectedRows": "EXACTLY_ONE_FOR_NEW_REVOCATION"},
            ]
        elif name == "protected.submitResponse":
            # The public protected endpoint is itself the executable owner-port
            # entrypoint.  Keep its full claim/fence/bind/close transaction here;
            # the generic owner-port skeleton above is deliberately replaced,
            # otherwise a four-step summary can falsely claim equivalence to the
            # seven-step anonymous submission transaction.
            dml = submit_response_dml
        if name == "protected.listActiveAdmissions":
            response_fields = [
                f("admissionPublicId", "UUID", sensitivity="RESTRICTED"),
                f("admissionVersionPublicId", "UUID", sensitivity="RESTRICTED"),
                f("admissionOwnerVersion", "BIGINT"),
                f("surveyPublicId", "UUID", sensitivity="RESTRICTED"),
                f("surveyRevision", "BIGINT"),
                f("formVersionPublicId", "UUID", sensitivity="RESTRICTED"),
                f("formArtifactSchemaVersion", "STRING"),
                f("formArtifactDigest", "SHA256"),
                f("questionDefinitions", "ARRAY", sensitivity="HIGHLY_RESTRICTED"),
                f("opensAt", "TIMESTAMPTZ"), f("closesAt", "TIMESTAMPTZ"),
                f("consentPolicyVersionPublicId", "UUID", sensitivity="RESTRICTED"),
            ]
        elif name == "protected.submitResponse":
            response_fields = [
                f("privateReceiptPublicId", "UUID", sensitivity="HIGHLY_RESTRICTED"),
                f("status", "STRING", validation="COMPLETED|ERASED_TOMBSTONE"),
                f("referenceEffectiveAt", "TIMESTAMPTZ"),
            ]
        elif name == "issuer.resolveParticipationStatus":
            credential_schema = request_fields_by_port["protected.submitResponse"][0]["valueSchema"]
            non_revocation_schema = copy.deepcopy(next(
                field["valueSchema"] for field in credential_schema["fields"]
                if field["name"] == "nonRevocationProof"
            ))
            inactive_proof_schema = copy.deepcopy(non_revocation_schema)
            inactive_proof_schema["schemaId"] = "ListeningInactiveParticipationStatusProof.v1"
            next(
                field for field in inactive_proof_schema["fields"]
                if field["name"] == "status"
            )["validation"] = "REVOKED|EXPIRED"
            response_fields = [
                f("statusResult", "OBJECT", sensitivity="HIGHLY_RESTRICTED",
                  validation=(
                      "closed ACTIVE|REVOKED|EXPIRED signed result; ACTIVE carries the exact offline "
                      "non-revocation proof, inactive outcomes never masquerade as an ACTIVE proof"
                  ), value_schema={
                      "schemaId": "ListeningParticipationStatusResult.v1",
                      "additionalProperties": False,
                      "discriminator": "outcome",
                      "variants": [
                          {
                              "outcome": "ACTIVE", "additionalProperties": False,
                              "fields": [
                                  {"name": "outcome", "type": "STRING", "required": True,
                                   "const": "ACTIVE"},
                                  {"name": "nonRevocationProof", "type": "OBJECT", "required": True,
                                   "valueSchema": non_revocation_schema},
                              ],
                          },
                          {
                              "outcome": "INACTIVE", "additionalProperties": False,
                              "fields": [
                                  {"name": "outcome", "type": "STRING", "required": True,
                                   "const": "INACTIVE"},
                                  {"name": "inactiveStatusProof", "type": "OBJECT", "required": True,
                                   "valueSchema": inactive_proof_schema},
                              ],
                          },
                      ],
                  }),
            ]
        elif name == "issuer.issueParticipationEnvelope":
            response_fields = [
                f("signedParticipationCredential", "OBJECT", sensitivity="HIGHLY_RESTRICTED",
                  validation="ListeningSignedParticipationCredential.v1 exact closed signed claims; NO worker/principal",
                  value_schema=copy.deepcopy(
                      request_fields_by_port["protected.submitResponse"][0]["valueSchema"]
                  )),
                f("privateReceiptPublicId", "UUID", sensitivity="RESTRICTED"),
                f("eligibilityVersionPublicId", "UUID", sensitivity="RESTRICTED"),
                f("eligibilityRevision", "BIGINT"),
            ]
        elif name == "protected.buildCohortPackage":
            response_fields = [
                f("cohortPackagePublicId", "UUID"), f("packageRevision", "BIGINT"),
                f("status", "STRING", validation="READY|SUPPRESSED"),
                f("receiptPublicId", "UUID"), f("packageSha256", "SHA256"),
            ]
        elif name == "insights.queryCohortResults":
            response_fields = [
                f("projectionPublicId", "UUID"),
                f("adequacyCategory", "STRING", validation="ADEQUATE|SUPPRESSED"),
                f("measureValues", "ARRAY", required=False, sensitivity="RESTRICTED",
                  validation="REQUIRED_IFF_ADEQUATE; FORBIDDEN_IFF_SUPPRESSED",
                  condition="adequacyCategory=ADEQUATE"),
                f("subjectCount", "INTEGER", required=False, sensitivity="RESTRICTED",
                  validation="REQUIRED_IFF_ADEQUATE; FORBIDDEN_IFF_SUPPRESSED",
                  condition="adequacyCategory=ADEQUATE"),
                f("anonymityThreshold", "INTEGER"),
                f("policyRevision", "BIGINT"),
                f("lineageReceiptPublicId", "UUID", sensitivity="RESTRICTED"),
            ]
        else:
            response_fields = [
                f("ownerResultPublicId", "UUID", required=name not in query_ports),
                f("ownerRevision", "BIGINT"), f("status", "STRING"),
                f("referenceEffectiveAt", "TIMESTAMPTZ"),
            ]
        if execution_class == "AUTH_OWNER_SYNCHRONOUS_PORT":
            for step in dml:
                if step.get("action") in {
                    "APPEND", "APPEND_PRIVATE_ONLY", "APPEND_PRIVATE_OWNER_DELIVERY",
                }:
                    step.setdefault("assignments", {}).setdefault(
                        "created_by", "authenticatedPrincipal.publicId"
                    )
                    step["assignments"].setdefault(
                        "correlation_id", "SERVER_ALLOCATE:ISSUER_PRIVATE_TRACE"
                    )
        caller_auth = {
            "mode": (
                "SIGNED_PARTICIPATION_CREDENTIAL"
                if name in {"protected.submitResponse", "protected.listActiveAdmissions"}
                else "SIGNED_SOURCE_STREAM_MESSAGE"
                if execution_class == "INTERNAL_MESSAGE_HANDLER"
                else "OWNER_SCHEDULER_SERVICE_PRINCIPAL"
                if execution_class == "OWNER_LOCAL_SCHEDULED_JOB"
                else "AUTHENTICATED_TENANT_PRINCIPAL_WITH_HRIS_ENTITLEMENT"
                if name in {"issuer.issueParticipationEnvelope", "issuer.revokeParticipationEnvelope"}
                else "AUTHENTICATED_EXACT_ISSUANCE_SUBJECT_OR_AUTH_EDGE"
                if name == "issuer.resolveParticipationStatus"
                else "AUTHENTICATED_PUBLIC_PRINCIPAL"
            ),
            "principalClass": (
                "ANONYMOUS_CREDENTIAL_HOLDER" if name in {"protected.submitResponse", "protected.listActiveAdmissions"}
                else "OWNER_SERVICE" if execution_class != "PUBLIC_OPERATION"
                else "TENANT_USER"
            ),
            "signature": "active issuer/source-stream key; exact audience and digest",
            "audience": name,
            "clock": "bounded skew; captured owner clock",
        }
        if name in {"protected.submitResponse", "protected.listActiveAdmissions"}:
            caller_auth["audience"] = "DWP.HRIS.LISTENING.PROTECTED"
        if name == "protected.requestErasure":
            caller_auth.update({
                "mode": "DISCRIMINATED_RETENTION_SCHEDULER_OR_SIGNED_PRIVACY_WORKFLOW",
                "principalClass": "OWNER_RETENTION_SCHEDULER_OR_PRIVACY_WORKFLOW_SERVICE",
                "variantRules": {
                    "RETENTION_SCHEDULER": (
                        "owner-local scheduler principal+locked retention policy revision+due time"
                    ),
                    "SIGNED_PRIVACY_WORKFLOW": (
                        "active workflow signing key+exact tenant/purpose/authority receipt revision"
                    ),
                },
            })
        completion = {
            "configuration.publishSurveyOrchestrate": "internal.listening.configuration.admission-install-receipt.consume",
            "configuration.closeSurveyOrchestrate": "internal.listening.configuration.admission-close-receipt.consume",
        }.get(name)
        states = state_by_port.get(name, (["OWNER_SPECIFIC"], ["OWNER_SPECIFIC"]))
        principal_class = (
            "ANONYMOUS_CREDENTIAL_HOLDER" if name in {
                "protected.submitResponse", "protected.listActiveAdmissions",
            }
            else "OWNER_RETENTION_SCHEDULER_OR_PRIVACY_WORKFLOW_SERVICE"
            if name == "protected.requestErasure"
            else "TENANT_ADMIN_OR_EXACT_WORKER_SELF" if name == "issuer.revokeParticipationEnvelope"
            else "TENANT_USER" if name == "issuer.issueParticipationEnvelope"
            else "OWNER_SERVICE" if execution_class != "PUBLIC_OPERATION"
            else "TENANT_USER"
        )
        caller_auth["principalClass"] = principal_class
        if name == "issuer.resolveParticipationStatus":
            caller_auth["invocationBoundary"] = (
                "FORBIDDEN_FROM_PROTECTED_ACTIVE_OR_SUBMIT_ENDPOINT; issuer status proof is minted "
                "during authenticated exact-issuance-subject/auth-edge preflight and verified offline by protected owner"
            )
            caller_auth["principalClass"] = "EXACT_ISSUANCE_SUBJECT_OR_SEPARATE_AUTH_EDGE_SERVICE"
        delivery_class = (
            "OWNER_LOCAL_PRIVATE_BROKER_FORBIDDEN"
            if name in {
                "protected.submitResponse", "protected.requestErasure",
                "issuer.issueParticipationEnvelope", "issuer.revokeParticipationEnvelope",
            }
            else "SIGNED_INTERNAL_MESSAGE_ONLY"
            if name in {"protected.installAdmission", "protected.closeAdmission", "protected.buildCohortPackage", "insights.ingestCohortPackage"}
            else "OWNER_LOCAL_ONLY"
        )
        generic_response_roots = {
            "configuration.querySurveys": ("sys_hris_listening_surveys", "aggregate_version", "status", "updated_at"),
            "configuration.createSurvey": ("sys_hris_listening_surveys", "aggregate_version", "status", "updated_at"),
            "configuration.reviseSurvey": ("sys_hris_listening_survey_versions", "owner_revision", "state", "reference_effective_at"),
            "configuration.publishSurveyOrchestrate": ("sys_hris_listening_surveys", "aggregate_version", "status", "updated_at"),
            "configuration.closeSurveyOrchestrate": ("sys_hris_listening_surveys", "aggregate_version", "status", "updated_at"),
            "configuration.createAction": ("sys_hris_listening_actions", "aggregate_version", "status", "updated_at"),
            "configuration.completeAction": ("sys_hris_listening_actions", "aggregate_version", "status", "updated_at"),
            "protected.installAdmission": ("sys_hris_listening_admission_versions", "owner_revision", "state", "reference_effective_at"),
            "protected.closeAdmission": ("sys_hris_listening_admission_versions", "owner_revision", "state", "reference_effective_at"),
            "protected.requestErasure": ("sys_hris_listening_erasure_tickets", "owner_revision", "state", "reference_effective_at"),
            "insights.ingestCohortPackage": ("sys_hris_listening_cohort_projections", "owner_revision", "state", "reference_effective_at"),
            "issuer.revokeParticipationEnvelope": ("sys_hris_listening_token_revocations", "owner_revision", "state", "reference_effective_at"),
        }
        response_field_sources: dict[str, str]
        if name in generic_response_roots:
            response_root, response_revision, response_state, response_at = generic_response_roots[name]
            response_field_sources = {
                "ownerResultPublicId": response_root + ".public_id",
                "ownerRevision": response_root + "." + response_revision,
                "status": response_root + "." + response_state,
                "referenceEffectiveAt": response_root + "." + response_at,
            }
        elif name == "protected.listActiveAdmissions":
            response_field_sources = {
                "admissionPublicId": "sys_hris_listening_admission_versions.admission_public_id",
                "admissionVersionPublicId": "sys_hris_listening_admission_versions.public_id",
                "admissionOwnerVersion": "sys_hris_listening_admission_versions.owner_revision",
                "surveyPublicId": "sys_hris_listening_admission_versions.survey_public_id",
                "surveyRevision": "sys_hris_listening_admission_versions.survey_revision",
                "formVersionPublicId": "sys_hris_listening_admission_versions.form_version_public_id",
                "formArtifactSchemaVersion": "sys_hris_listening_admission_versions.form_artifact_schema_version",
                "formArtifactDigest": "sys_hris_listening_admission_versions.form_artifact_digest",
                "questionDefinitions": "sys_hris_listening_admission_versions.question_definitions",
                "opensAt": "sys_hris_listening_admission_versions.opens_at",
                "closesAt": "sys_hris_listening_admission_versions.closes_at",
                "consentPolicyVersionPublicId": "sys_hris_listening_admission_versions.consent_policy_version_public_id",
            }
        elif name == "protected.submitResponse":
            response_field_sources = {
                "privateReceiptPublicId": "sys_hris_listening_protected_receipts.public_id",
                "status": "sys_hris_listening_protected_receipts.state",
                "referenceEffectiveAt": "sys_hris_listening_protected_receipts.reference_effective_at",
            }
        elif name == "protected.buildCohortPackage":
            response_field_sources = {
                "cohortPackagePublicId": "sys_hris_listening_cohort_packages.public_id",
                "packageRevision": "sys_hris_listening_cohort_packages.owner_revision",
                "status": "sys_hris_listening_cohort_packages.state",
                "receiptPublicId": "sys_hris_listening_protected_receipts.public_id",
                "packageSha256": "sys_hris_listening_cohort_packages.package_sha256",
            }
        elif name == "insights.queryCohortResults":
            response_field_sources = {
                "projectionPublicId": "sys_hris_listening_cohort_projections.public_id",
                "adequacyCategory": "sys_hris_listening_cohort_projections.adequacy_category",
                "measureValues": "sys_hris_listening_cohort_projections.measure_values IF ADEQUATE ELSE OMIT",
                "subjectCount": "sys_hris_listening_cohort_projections.subject_count IF ADEQUATE ELSE OMIT",
                "anonymityThreshold": "sys_hris_listening_cohort_projections.anonymity_threshold",
                "policyRevision": "sys_hris_listening_cohort_projections.policy_revision",
                "lineageReceiptPublicId": "sys_hris_listening_lineage_receipts.public_id",
            }
        elif name == "issuer.issueParticipationEnvelope":
            response_field_sources = {
                "signedParticipationCredential": (
                    "SIGNED_PROJECTION:sys_hris_listening_token_issuances+"
                    "sys_hris_listening_eligibility_versions"
                ),
                "privateReceiptPublicId": "sys_hris_listening_issuer_receipts.public_id",
                "eligibilityVersionPublicId": "sys_hris_listening_eligibility_versions.public_id",
                "eligibilityRevision": "sys_hris_listening_eligibility_versions.owner_revision",
            }
        elif name == "issuer.resolveParticipationStatus":
            response_field_sources = {
                "statusResult": (
                    "SIGNED_PROJECTION:sys_hris_listening_token_issuances+"
                    "sys_hris_listening_token_revocations"
                ),
            }
        else:
            raise ValueError(f"missing owner-port response lineage: {name}")
        contract_row = owner_port_contract(
            name=name, stream_key=stream_key, kind=kind,
            execution_class=execution_class, entrypoint_ref=entrypoint_ref,
            request_fields=request_fields_by_port[name], caller_auth=caller_auth,
            purpose=purpose_by_port[name], selectors=selectors, ordered_dml=dml,
            pre_states=states[0], post_states=states[1],
            receipt_table=receipt,
            outbox_table=(
                None if name in {"protected.submitResponse", "protected.requestErasure"}
                else outbox
            ),
            response_fields=response_fields, completion_handler_id=completion,
            delivery_class=delivery_class,
        )
        contract_row["responseFieldSources"] = response_field_sources
        contract_row["responseFieldPolicy"] = {
            "purpose": purpose_by_port[name],
            "behavior": "ALLOW_EXACT_NAMED_FIELD_OR_OMIT;NO_LATEST_FALLBACK",
            "denyOnUnavailable": True,
        }
        owner_port_operation_contracts.append(contract_row)

    contract: dict[str, Any] = {
        "contractId": DESIGN_ID,
        "schemaVersion": 1,
        "status": "STATIC_GENERATOR_INPUT_NOT_AN_ARTIFACT",
        "scope": "GENERIC_GLOBAL_PRODUCT_CORE_SYS_EMPLOYEE_LISTENING_BOUNDARY",
        "ownerSession": "HRIS-SYS",
        "signatureProfile": copy.deepcopy(LISTENING_SIGNATURE_PROFILE),
        "sessionTopology": "FIVE_SESSIONS_UNCHANGED_HRM_PER_PAY_TIM_SYS",
        "canonicalPrecedence": {
            "mode": "CANONICAL_FIVE_PRIMARY_DERIVED_SUMMARY_ONLY",
            "supersedesCapability": "HRIS.MODERN.EMPLOYEE_LISTENING",
            "legacyDirectImplementation": "FORBIDDEN",
            "legacyArtifactRole": "HISTORICAL_TRACE_ONLY_WHEN_SEPARATELY_FROZEN",
            "requiredConsumerBehavior": "RESOLVE_LISTENING_FROM_CANONICAL_FIVE_THEN_VERIFY_THIS_DERIVED_SUMMARY",
            "supersededLegacyTableSet": [
                "sys_hris_listening_surveys",
                "sys_hris_listening_responses",
                "sys_hris_listening_cohort_results",
                "sys_hris_listening_actions",
            ],
            "forbiddenLegacyPublicEvent": "EmployeeListeningResponseSubmitted.v2",
            "forbiddenLegacyMigration": "dwp-platform-server/src/main/resources/db/migration/V287__hris_platform_modern_employee_listening.sql",
        },
        "authorityStreams": authority_streams,
        "publicOperationBindings": public_operations,
        "ownerPortOperations": [
            {
                "ownerPortOperation": name,
                "streamKey": stream_key,
                "kind": kind,
                "contractState": "G3_INTERFACE_REQUIRED_NOT_IMPLEMENTED",
            }
            for name, stream_key, kind in owner_ports
        ],
        "ownerPortOperationContracts": owner_port_operation_contracts,
        "ownerDependencyContracts": owner_dependency_contracts,
        "ownerLocalHandlers": owner_local_handlers,
        "tableOwnership": table_ownership,
        "eventOwnership": {
            "canonicalPublicEvents": [
                {"eventName": "EmployeeListeningSurveyCreated.v3", "streamKey": configuration, "payloadClass": "CONFIGURATION_METADATA_ONLY"},
                {"eventName": "EmployeeListeningSurveyRevised.v3", "streamKey": configuration, "payloadClass": "CONFIGURATION_REVISION_METADATA_ONLY"},
                {"eventName": "EmployeeListeningSurveyPublished.v3", "streamKey": configuration, "payloadClass": "CONFIGURATION_METADATA_AND_PROTECTED_RECEIPT_REF_ONLY"},
                {"eventName": "EmployeeListeningSurveyClosed.v3", "streamKey": configuration, "payloadClass": "CONFIGURATION_METADATA_AND_PROTECTED_RECEIPT_REF_ONLY"},
                {"eventName": "EmployeeListeningActionCreated.v3", "streamKey": configuration, "payloadClass": "ACTION_METADATA_ONLY"},
                {"eventName": "EmployeeListeningActionCompleted.v3", "streamKey": configuration, "payloadClass": "ACTION_METADATA_ONLY"},
                {"eventName": "EmployeeListeningCohortProjectionPublished.v1", "streamKey": insights, "payloadClass": "PRIVACY_SAFE_AGGREGATE_LINEAGE_ONLY"},
            ],
            "internalPortMessages": [
                {
                    "messageName": name, "from": source, "to": target,
                    "fieldAllowlist": fields,
                    "envelopeAuth": {
                        "additionalProperties": False,
                        "fields": [
                            {"name": "messageId", "type": "UUID", "required": True},
                            {"name": "payloadDigest", "type": "SHA256", "required": True},
                            {"name": "signingKeyId", "type": "STRING", "required": True},
                            {"name": "signatureAlgorithm", "type": "STRING", "required": True,
                             "validation": "ED25519|ECDSA_P256_SHA256"},
                            {"name": "ownerSignature", "type": "STRING", "required": True,
                             "sensitivity": "RESTRICTED"},
                        ],
                        "canonicalSignatureInput": (
                            "tenantPublicId+messageId+messageName+sourceStreamKey+"
                            "payloadDigest+referenceEffectiveAt"
                        ),
                        "keyRule": "signingKeyId must be active for source stream at referenceEffectiveAt",
                        "verificationFailure": "401_OR_QUARANTINE_ZERO_DOMAIN_ACK_OUTBOX_WRITES",
                    },
                }
                for name, source, target, fields in (
                    ("ListeningAdmissionInstallRequested.v1", configuration, protected, ["tenantPublicId", "surveyPublicId", "surveyRevision", "admissionPublicId", "formVersionPublicId", "formRevision", "formArtifactSchemaVersion", "formArtifactDigest", "questionDefinitions", "privacyVersionPublicId", "privacyRevision", "retentionVersionPublicId", "retentionRevision", "tokenPolicyVersionPublicId", "consentPolicyVersionPublicId", "anonymityThreshold", "epsilonMicros", "privacyBudgetCapEpsilonMicros", "measureSchemaVersion", "measureDefinitionDigest", "contentSha256", "opensAt", "closesAt", "eraseAfter", "idempotencyKey"]),
                    ("ListeningAdmissionInstallReceipt.v1", protected, configuration, ["tenantPublicId", "surveyPublicId", "admissionPublicId", "admissionVersionPublicId", "status", "ownerVersion", "receiptPublicId", "requestMessageId", "occurredAt"]),
                    ("ListeningAdmissionCloseRequested.v1", configuration, protected, ["tenantPublicId", "surveyPublicId", "admissionPublicId", "expectedOwnerVersion", "idempotencyKey"]),
                    ("ListeningAdmissionCloseReceipt.v1", protected, configuration, ["tenantPublicId", "surveyPublicId", "admissionPublicId", "admissionVersionPublicId", "status", "ownerVersion", "receiptPublicId", "requestMessageId", "closedAt"]),
                    ("ListeningCohortPackageReady.v1", protected, insights, ["tenantPublicId", "surveyPublicId", "cohortPackagePublicId", "policyRevision", "sourceEpoch", "cutoffAt", "measureSchemaVersion", "measureDefinitionDigest", "measureValues", "packageSha256", "payloadDigest", "adequacyCategory", "subjectCount", "anonymityThreshold", "privacyBudgetReceiptPublicId"]),
                    ("ListeningCohortProjectionReceipt.v1", insights, protected, ["tenantPublicId", "surveyPublicId", "cohortPackagePublicId", "projectionPublicId", "projectionVersion", "status", "receiptPublicId", "requestMessageId"]),
                )
            ],
            "privateReceiptOnly": [
                "ProtectedListeningSubmissionReceipt.v1",
                "ProtectedListeningErasureTicketReceipt.v1",
                "ProtectedListeningErasureCompletedReceipt.v1",
                "ParticipationEnvelopeIssuanceReceipt.v1",
                "ParticipationEnvelopeRevocationReceipt.v1",
            ],
            "publicBrokerForbidden": [
                "EmployeeListeningResponseSubmitted.v2",
                "RAW_RESPONSE_EVENT",
                "RAW_ANSWER_EVENT",
                "PARTICIPATION_TOKEN_EVENT",
                "TOKEN_COMMITMENT_EVENT",
                "ISSUER_TRACE_EVENT",
            ],
            "forbiddenPublicFieldPatterns": [
                "responseId", "responseToken", "token", "tokenCommitment", "answer", "answers",
                "principalId", "workerId", "employeeId", "issuerTrace", "ipAddress", "userAgent",
            ],
        },
        "transactionAndIdempotency": {
            "publish": "CONFIGURATION_INTENT_COMMIT_THEN_SIGNED_PROTECTED_INSTALL_RESULT_UNKNOWN_REFETCH_THEN_CONFIGURATION_FINALIZE",
            "close": "SIGNED_PROTECTED_CLOSE_FENCE_COMMIT_AND_REFETCH_BEFORE_CONFIGURATION_FINALIZE",
            "submit": "PROTECTED_ADMISSION_LOCK_PLUS_WINDOW_TOKEN_CONSENT_RESPONSE_ANSWER_TOKEN_CONSUMPTION_RECEIPT_ATOMIC",
            "submitCloseOrdering": "SAME_PROTECTED_ADMISSION_LOCK_FENCE",
            "replayBeforeErasure": "SAME_TOKEN_SAME_PAYLOAD_RETURNS_SAME_ACCEPTED_RECEIPT_DIFFERENT_PAYLOAD_CONFLICT",
            "replayAfterErasure": "SAME_VALID_CONSUMED_TOKEN_ALWAYS_RETURNS_SAME_ERASED_RECEIPT_NO_COMPARISON_ORACLE",
            "cohortTransfer": "FIXED_QUERY_EPOCH_BUDGET_MINIMIZED_AGGREGATE_ONLY",
            "crossDatabaseAtomicityClaim": "FORBIDDEN",
            "ownerLocalOutboxInboxHistory": "REQUIRED_PER_STREAM_NO_SHARED_RECEIPT_TABLE",
        },
        "publicIdentityAndSemanticOverlay": {
            "externalIdentity": "UUID_PUBLIC_ID_ONLY",
            "localIdentity": "BIGINT_STREAM_LOCAL_NEVER_TRANSPORTED_ACROSS_STREAM",
            "protectedResponseParent": "hris_listening_protected.sys_hris_listening_admission_versions(tenant_id,listening_admission_version_id)",
            "configurationSurveyReferenceInProtected": "surveyPublicId+formRevision+privacyRevision+retentionRevision+contentSha256 immutable snapshot only",
            "insightsInput": "PRIVACY_SAFE_COHORT_PACKAGE_PUBLIC_ID_AND_AGGREGATE_MEASURES_ONLY",
            "issuerOutput": "SIGNED_OPAQUE_PARTICIPATION_ENVELOPE_NO_PRINCIPAL_OR_WORKER_ID_TO_PROTECTED",
            "semanticRegistryMode": "CANONICAL_FIVE_ROWS_ARE_PRIMARY_THIS_SUMMARY_IS_DERIVED",
        },
        "migrationReservations": [
            {
                "streamKey": item["streamKey"],
                "allocationId": item["migrationAllocationId"],
                "ownershipId": item["migrationOwnershipId"],
                "migrationLocation": item["migrationLocation"],
                "databaseSchema": item["databaseSchema"],
                "historyTable": item["historyTable"],
                "range": item["migrationRange"],
                "firstReservedMigration": item["firstReservedMigration"],
                "state": "RESERVED_G3_RANGE_NOT_CREATED",
            }
            for item in authority_streams
        ],
        "fileAllocations": [
            {
                "streamKey": item["streamKey"],
                "sourceAllocationId": item["sourceAllocationId"],
                "testAllocationId": item["testAllocationId"],
                "migrationAllocationId": item["migrationFileAllocationId"],
                "controlBootstrapAllocationId": item["controlBootstrapAllocationId"],
                "sourceRoot": item["sourceRoot"],
                "testRoot": item["testRoot"],
                "migrationLocation": item["migrationLocation"],
            }
            for item in authority_streams
        ],
        "verificationProfileBindings": [
            {"profileId": "G3-SYS-LISTEN-CONFIGURATION-BE", "streamKeys": [configuration], "ownerService": "dwp-platform-server", "state": "CONTROL_CATALOG_BINDING_REQUIRED"},
            {"profileId": "G3-SYS-LISTEN-PROTECTED-BE", "streamKeys": [protected], "ownerService": "dwp-platform-server", "state": "CONTROL_CATALOG_BINDING_REQUIRED"},
            {"profileId": "G3-SYS-LISTEN-INSIGHTS-BE", "streamKeys": [insights], "ownerService": "dwp-platform-server", "state": "CONTROL_CATALOG_BINDING_REQUIRED"},
            {"profileId": "G3-SYS-LISTEN-ISSUER-BE", "streamKeys": [issuer], "ownerService": "dwp-auth-server", "state": "CONTROL_CATALOG_BINDING_REQUIRED"},
            {"profileId": "G3-SYS-LISTEN-FE", "streamKeys": [], "ownerService": "dwp-frontend", "state": "CONTROL_CATALOG_BINDING_REQUIRED"},
        ],
        "capabilityDependencies": {
            "HRIS.MODERN.EMPLOYEE_LISTENING": [configuration, protected, insights, issuer],
            "HRIS.MODERN.PEOPLE_ANALYTICS": [configuration, insights],
            "HRIS.MODERN.GOVERNED_AI": [configuration, insights],
            "protectedIssuerPairRequired": True,
            "disabledCapabilityOpensSupplementalDatasource": False,
        },
        "requiredCanonicalConsumers": [
            "coding-readiness/03-backend-service-architecture.md",
            "coding-readiness/physical-owner-prefix-register.csv",
            "coding-readiness/module-structure-contract-register.csv",
            "coding-readiness/07-modern-capability-coding-contract.md",
            "coding-readiness/modern-capability-coding-contract-register.csv",
            "coding-readiness/modern-capability-trace-register.csv",
            "coding-readiness/g3-slice-code-go-register.csv",
            "coding-readiness/g3-file-allocation-register.csv",
            "coding-readiness/sys-exact-business-start-successor.v1.json",
            "coding-readiness/sys-exact-business-start-pin.v1.json",
            "g0/file-ownership-register.csv",
            "g0/migration-stream-register.csv",
            "g0/migration-allocation-register.csv",
            "session-prompts/00-common-session-contract.md",
            "session-prompts/05-cloudhr-sys-session.md",
            "session-prompts/06-hris-integration-control.md",
        ],
        "forbiddenPatterns": [
            "CROSS_SCHEMA_FK",
            "CROSS_STREAM_LOCAL_ID",
            "FOREIGN_REPOSITORY_IMPORT",
            "SHARED_RUNTIME_PRINCIPAL",
            "SHARED_MIGRATION_HISTORY",
            "PRIMARY_DATASOURCE_FALLBACK",
            "RAW_RESPONSE_PUBLIC_EVENT",
            "PARTICIPATION_TOKEN_PUBLIC_EVENT",
            "CONFIGURATION_CLOSED_BEFORE_PROTECTED_CLOSE_FENCE",
            "CROSS_DATABASE_ATOMIC_TRANSACTION_CLAIM",
            "LEGACY_V287_LISTENING_MIGRATION",
        ],
        "assurance": {
            "canonicalDesignPublished": True,
            "runtimeImplemented": False,
            "userJourneyCrud": "NOT_STARTED_G3_G4",
            "databaseObjectsCreated": False,
            "globalGateAuthorization": "NONE_FROM_THIS_CONTRACT",
            "productionAuthorized": False,
            "realIdentityAndProcessIsolation": "G6_ONLY_NOT_CLAIMED",
            "externalIdentityAttestation": "NOT_CLAIMED",
            "benskIncluded": False,
            "addskIncluded": False,
        },
        "exactCounts": {
            "streams": 4,
            "ownerServices": 2,
            "runtimePurposes": 5,
            "publicOperations": len(public_operations),
            "ownerPortOperations": len(owner_ports),
            "ownerDependencyContracts": len(owner_dependency_contracts),
            "ownerLocalHandlers": len(owner_local_handlers),
            "plannedTables": len(table_ownership),
            "canonicalPublicEvents": 7,
            "internalPortMessages": 6,
            "privateReceiptTypes": 5,
            "migrationReservations": 4,
            "streamFileAllocationTriples": 4,
            "verificationProfiles": 5,
        },
    }
    apply_signature_contracts(contract)
    contract["sealedPayloadSha256"] = sha256_bytes(canonical_payload(contract))
    return contract


def static_design_digest() -> str:
    """Return the semantic digest shared by every canonical composition marker."""

    return sha256_bytes(canonical_payload(build_static_design()))


def composition_marker(role: str) -> dict[str, Any]:
    expected_roles = {item[0] for item in CANONICAL_INPUTS}
    if role not in expected_roles:
        raise ValueError(f"unknown canonical Listening role: {role}")
    return {
        "designId": DESIGN_ID,
        "designSha256": static_design_digest(),
        "role": role,
        "authorityMode": "PRIMARY_CANONICAL_FIVE_ROWS",
        "dependencyDirection": "STATIC_DESIGN_TO_CANONICAL_FIVE_TO_DERIVED_SUMMARY",
        "derivedSummaryDependency": "FORBIDDEN",
    }


def stamp_canonical_document(document: dict[str, Any], role: str) -> dict[str, Any]:
    """Stamp one canonical document without reading any generated successor.

    The caller owns row composition.  Keeping this operation metadata-only is
    deliberate: the operation SSOT and exact/event materializers retain their
    independent row builders, while all five agree on one static design seal.
    """

    document["listeningCanonicalComposition"] = composition_marker(role)
    return document


def _strict_pairs(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"duplicate JSON key: {key}")
        result[key] = value
    return result


def load_canonical_inputs(root: Path = ROOT) -> dict[str, dict[str, Any]]:
    require_active_reader_guard(__file__)
    documents: dict[str, dict[str, Any]] = {}
    for role, relative, id_key, expected_id in CANONICAL_INPUTS:
        path = root / relative
        if not path.is_file() or path.is_symlink():
            raise ValueError(f"canonical input is missing or symlinked: {relative}")
        raw = path.read_bytes()
        if raw.startswith(b"\xef\xbb\xbf"):
            raise ValueError(f"canonical input contains BOM: {relative}")
        if not raw.endswith(b"\n") or raw.endswith(b"\n\n"):
            raise ValueError(
                f"canonical input must end with exactly one LF: {relative}"
            )
        value = json.loads(
            raw.decode("utf-8"),
            object_pairs_hook=_strict_pairs,
            parse_constant=lambda value: (_ for _ in ()).throw(
                ValueError(f"non-finite JSON is forbidden: {value}")
            ),
            parse_float=lambda value: (_ for _ in ()).throw(
                ValueError(f"floating point JSON is forbidden: {value}")
            ),
        )
        if not isinstance(value, dict) or value.get(id_key) != expected_id:
            raise ValueError(f"canonical input identity drift: {relative}")
        documents[role] = {"path": relative, "raw": raw, "document": value}
    return documents


def _operation_id(row: Any) -> str:
    return str(row.get("operationId", "")) if isinstance(row, dict) else ""


def _event_name(row: Any) -> str:
    return str(row.get("eventName", "")) if isinstance(row, dict) else ""


def _listening_operation_rows(rows: Any) -> list[dict[str, Any]]:
    return [copy.deepcopy(row) for row in rows if _operation_id(row).startswith("modern.listening.")]


def _listening_event_rows(rows: Any, expected_events: set[str]) -> list[dict[str, Any]]:
    return [copy.deepcopy(row) for row in rows if _event_name(row) in expected_events]


def _referenced_schema_ids(operations: list[dict[str, Any]]) -> set[str]:
    return {
        str(value)
        for row in operations
        for value in (row.get("requestSchemaRef"), row.get("responseSchemaRef"))
        if value
    }


def canonical_listening_subset(role: str, document: dict[str, Any]) -> dict[str, Any]:
    """Project only Listening-owned rows for an independent subset digest."""

    design = build_static_design()
    operation_ids = {
        row["operationId"] for row in design["publicOperationBindings"]
    }
    table_names = {row["tableName"] for row in design["tableOwnership"]}
    event_names = {
        row["eventName"]
        for row in design["eventOwnership"]["canonicalPublicEvents"]
    }
    marker = copy.deepcopy(document.get("listeningCanonicalComposition"))
    if role == "operationCausal":
        event_owner = document.get("publicEventOwnership", {})
        return {
            "composition": marker,
            "operations": _listening_operation_rows(document.get("operations", [])),
            "eventSuccessorLineage": [
                copy.deepcopy(row)
                for row in document.get("eventSuccessorLineage", [])
                if "Listening" in json.dumps(row, ensure_ascii=False, sort_keys=True)
            ],
            "publicEvents": _listening_event_rows(
                event_owner.get("events", []), event_names
            ),
            "ownerPortOperationContracts": copy.deepcopy(
                document.get("ownerPortOperationContracts", [])
            ),
            "ownerDependencyContracts": copy.deepcopy(
                document.get("ownerDependencyContracts", [])
            ),
            "expectedTables": sorted(
                table_names
                & set(document.get("schemaOracle", {}).get("expectedTables", []))
            ),
        }
    if role == "semanticBindings":
        return {
            "composition": marker,
            "operations": _listening_operation_rows(document.get("operations", [])),
        }
    if role == "publicIdentities":
        result: dict[str, Any] = {"composition": marker}
        result["physicalColumns"] = {
            key: copy.deepcopy(value)
            for key, value in sorted(document.get("physicalColumns", {}).items())
            if key.split(".", 1)[0] in table_names
        }
        for key in (
            "requestFieldsByOperation",
            "responseFieldsByOperation",
            "eventFieldsByOperation",
        ):
            result[key] = {
                op_id: copy.deepcopy(value)
                for op_id, value in sorted(document.get(key, {}).items())
                if op_id in operation_ids
            }
        return result
    if role == "exactSchemas":
        operations = _listening_operation_rows(document.get("operationBindings", []))
        schema_ids = _referenced_schema_ids(operations)
        schemas = document.get("recordSchemas", []) + document.get("responseSchemas", [])
        # Include one level of nested response/value-object schemas.  Repeating
        # to a fixed point keeps the digest complete without serializing other
        # capabilities' schemas.
        selected: dict[str, dict[str, Any]] = {}
        while True:
            before = len(schema_ids)
            for row in schemas:
                if row.get("schemaId") not in schema_ids:
                    continue
                selected[str(row["schemaId"])] = copy.deepcopy(row)
                for field in row.get("fields", []):
                    nested = field.get("schemaRef") or field.get("itemSchemaRef")
                    if nested:
                        schema_ids.add(str(nested))
            if len(schema_ids) == before:
                break
        return {
            "composition": marker,
            "operations": operations,
            "tables": [
                copy.deepcopy(row)
                for row in document.get("tableSpecifications", [])
                if row.get("tableName") in table_names
            ],
            "schemas": [selected[key] for key in sorted(selected)],
            "fieldLineage": _listening_operation_rows(
                document.get("operationFieldLineage", [])
            ),
            "internalHandlers": [
                copy.deepcopy(row)
                for row in document.get("internalConsumerHandlers", [])
                if row.get("capabilityId") == "HRIS.MODERN.EMPLOYEE_LISTENING"
            ],
        }
    if role == "eventPayloads":
        return {
            "composition": marker,
            "events": _listening_event_rows(
                document.get("eventPayloadSchemas", []), event_names
            ),
            "internalHandlers": [
                copy.deepcopy(row)
                for row in document.get("internalEventHandlers", [])
                if "Listening" in json.dumps(row, ensure_ascii=False, sort_keys=True)
            ],
        }
    raise ValueError(f"unknown canonical Listening role: {role}")


def subset_counts(subset: dict[str, Any]) -> dict[str, int]:
    return {
        key: len(value)
        for key, value in sorted(subset.items())
        if key != "composition" and isinstance(value, (list, dict))
    }


def _reverse_reference_findings(role: str, document: dict[str, Any]) -> list[str]:
    serialized = json.dumps(document, ensure_ascii=False, sort_keys=True)
    findings: list[str] = []
    for forbidden in (
        SUMMARY_ID,
        SUMMARY_PATH,
        Path(SUMMARY_PATH).name,
        "canonicalSuccessorOverlay",
        "canonicalSuccessorOverlays",
        '\"predecessorPins\"',
        '\"historicalPredecessor\"',
    ):
        if forbidden in serialized:
            findings.append(f"{role}:reverse-reference:{forbidden}")
    return findings


def validate_canonical_five(
    documents: Mapping[str, dict[str, Any]],
) -> list[str]:
    """Validate closed Listening row sets and the no-reverse-reference rule."""

    findings: list[str] = []
    design = build_static_design()
    expected_roles = {item[0] for item in CANONICAL_INPUTS}
    if set(documents) != expected_roles:
        findings.append("canonical-role-set")
        return findings
    expected_operations = {
        row["operationId"] for row in design["publicOperationBindings"]
    }
    expected_tables = {row["tableName"] for row in design["tableOwnership"]}
    expected_events = {
        row["eventName"]
        for row in design["eventOwnership"]["canonicalPublicEvents"]
    }
    expected_messages = {
        row["messageName"]
        for row in design["eventOwnership"]["internalPortMessages"]
    }
    expected_handler_ids = {
        row["handlerId"] for row in design["ownerLocalHandlers"]
    }
    expected_message_handler_ids = {
        row["handlerId"]
        for row in design["ownerLocalHandlers"]
        if row.get("messageName") in expected_messages
    }
    for role, document in documents.items():
        if document.get("listeningCanonicalComposition") != composition_marker(role):
            findings.append(f"{role}:composition-marker")
        findings.extend(_reverse_reference_findings(role, document))

    operation_doc = documents["operationCausal"]
    causal_ops = {
        _operation_id(row)
        for row in operation_doc.get("operations", [])
        if _operation_id(row).startswith("modern.listening.")
    }
    if causal_ops != expected_operations:
        findings.append("operationCausal:listening-operation-set")
    causal_blob = json.dumps(operation_doc, ensure_ascii=False, sort_keys=True)
    for message in expected_messages:
        if message not in causal_blob:
            findings.append(f"operationCausal:internal-message:{message}")
    causal_handler_ids = {
        row.get("handlerId")
        for row in operation_doc.get("systemHandlers", [])
        if isinstance(row, dict) and row.get("handlerId") in expected_handler_ids
    }
    if causal_handler_ids != expected_handler_ids:
        findings.append("operationCausal:owner-local-handler-set")

    semantic_ops = {
        _operation_id(row)
        for row in documents["semanticBindings"].get("operations", [])
        if _operation_id(row).startswith("modern.listening.")
    }
    if semantic_ops != expected_operations:
        findings.append("semanticBindings:listening-operation-set")

    identities = documents["publicIdentities"]
    for section in ("responseFieldsByOperation",):
        identity_ops = {
            key for key in identities.get(section, {}) if key.startswith("modern.listening.")
        }
        if identity_ops != expected_operations:
            findings.append(f"publicIdentities:{section}-operation-set")

    exact = documents["exactSchemas"]
    exact_ops = {
        _operation_id(row)
        for row in exact.get("operationBindings", [])
        if _operation_id(row).startswith("modern.listening.")
    }
    exact_tables = {
        row.get("tableName")
        for row in exact.get("tableSpecifications", [])
        if row.get("tableName") in expected_tables
    }
    if exact_ops != expected_operations:
        findings.append("exactSchemas:listening-operation-set")
    if exact_tables != expected_tables:
        findings.append("exactSchemas:listening-table-set")
    exact_handler_ids = {
        row.get("handlerId")
        for row in exact.get("internalConsumerHandlers", [])
        if isinstance(row, dict)
        and row.get("capabilityId") == "HRIS.MODERN.EMPLOYEE_LISTENING"
    }
    if exact_handler_ids != expected_handler_ids:
        findings.append("exactSchemas:listening-handler-set")
    for row in exact.get("operationBindings", []):
        if _operation_id(row) not in expected_operations:
            continue
        events = set(row.get("eventNames", []))
        if events - expected_events:
            findings.append(f"exactSchemas:noncanonical-event:{_operation_id(row)}")

    event_doc = documents["eventPayloads"]
    actual_events = {
        _event_name(row)
        for row in event_doc.get("eventPayloadSchemas", [])
        if _event_name(row) in expected_events
    }
    if actual_events != expected_events:
        findings.append("eventPayloads:listening-event-set")
    event_blob = json.dumps(event_doc, ensure_ascii=False, sort_keys=True)
    for message in expected_messages:
        if message not in event_blob:
            findings.append(f"eventPayloads:internal-message:{message}")
    event_handler_ids = {
        row.get("handlerId")
        for row in event_doc.get("internalEventHandlers", [])
        if isinstance(row, dict) and row.get("handlerId") in expected_handler_ids
    }
    if event_handler_ids != expected_handler_ids:
        findings.append("eventPayloads:owner-local-handler-set")
    event_message_handler_ids = {
        row.get("handlerId")
        for row in event_doc.get("internalEventHandlers", [])
        if isinstance(row, dict) and row.get("messageName") in expected_messages
    }
    if event_message_handler_ids != expected_message_handler_ids:
        findings.append("eventPayloads:signed-message-consumer-set")

    legacy_response_event = "EmployeeListeningResponseSubmitted.v2"
    active_operation_events = {
        event.get("eventName")
        for row in operation_doc.get("operations", [])
        if isinstance(row, dict)
        for event in row.get("events", [])
        if isinstance(event, dict)
    }
    if legacy_response_event in active_operation_events:
        findings.append("operationCausal:active-legacy-response-event")
    active_exact_events = {
        event_name
        for row in exact.get("operationBindings", [])
        if isinstance(row, dict)
        for event_name in row.get("eventNames", [])
    }
    if legacy_response_event in active_exact_events:
        findings.append("exactSchemas:active-legacy-response-event")
    active_payload_events = {
        _event_name(row) for row in event_doc.get("eventPayloadSchemas", [])
    }
    if legacy_response_event in active_payload_events:
        findings.append("eventPayloads:active-legacy-response-event")
    return findings


def authoritative_input_rows(
    loaded: Mapping[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    documents = {role: value["document"] for role, value in loaded.items()}
    findings = validate_canonical_five(documents)
    if findings:
        raise ValueError("canonical Listening composition is not closed: " + "|".join(findings))
    result: list[dict[str, Any]] = []
    for role, relative, id_key, _expected_id in CANONICAL_INPUTS:
        entry = loaded[role]
        raw = entry["raw"]
        document = entry["document"]
        subset = canonical_listening_subset(role, document)
        subset_bytes = json.dumps(
            subset, ensure_ascii=False, sort_keys=True, separators=(",", ":")
        ).encode("utf-8")
        result.append({
            "role": role,
            "path": relative,
            "documentId": document[id_key],
            "fileSha256": sha256_bytes(raw),
            "byteCount": len(raw),
            "listeningSubsetCounts": subset_counts(subset),
            "listeningSubsetSha256": sha256_bytes(subset_bytes),
            "precedence": "PRIMARY_CANONICAL_INPUT",
        })
    return result


def build_derived_summary(root: Path = ROOT) -> dict[str, Any]:
    """Build the derived summary only after all canonical five are closed."""

    result = copy.deepcopy(build_static_design())
    inputs = authoritative_input_rows(load_canonical_inputs(root))
    result["contractId"] = SUMMARY_ID
    result["status"] = "CANONICAL_G3_START_AUTHORITY_NOT_IMPLEMENTED"
    precedence = result["canonicalPrecedence"]
    precedence["authoritativeInputs"] = inputs
    precedence["generatedSummary"] = {
        "sourceDesignId": DESIGN_ID,
        "sourceDesignSha256": static_design_digest(),
        "canonicalInputCount": len(inputs),
        "canonicalInputSetSha256": sha256_bytes(json.dumps(
            inputs, ensure_ascii=False, sort_keys=True, separators=(",", ":")
        ).encode("utf-8")),
        "activePrecedence": "CANONICAL_FIVE_ROWS_THEN_DERIVED_SUMMARY",
    }
    precedence["reverseReferenceFromCanonicalFiveAllowed"] = False
    precedence.pop("historicalPredecessor", None)
    result["sealedPayloadSha256"] = sha256_bytes(canonical_payload(result))
    return result


def build_stream_authority_successor_v2(root: Path = ROOT) -> dict[str, Any]:
    """Build the product-complete authority without a reverse canonical pin.

    The immutable v1 remains reproducible failure/predecessor evidence.  V2 is
    the acyclic design input: canonical candidates pin its sealed bytes, while
    it pins only v1 and the static design from which the 10-operation boundary
    is generated.
    """

    require_active_reader_guard(__file__)
    predecessor_path = root / SUMMARY_PATH
    if not predecessor_path.is_file() or predecessor_path.is_symlink():
        raise ValueError("immutable Listening v1 predecessor is missing or symlinked")
    predecessor_raw = predecessor_path.read_bytes()
    predecessor_sha = sha256_bytes(predecessor_raw)
    expected_predecessor_sha = "62f110f36a4d26dab7dda3051e6baf1a5872a475b8f2a83cee19f2cd950496b1"
    if predecessor_sha != expected_predecessor_sha:
        raise ValueError(
            "immutable Listening v1 predecessor hash drift: "
            f"expected {expected_predecessor_sha}, got {predecessor_sha}"
        )
    result = copy.deepcopy(build_static_design())
    result["contractId"] = SUMMARY_V2_ID
    result["schemaVersion"] = 2
    result["status"] = "SEALED_PRODUCT_COMPLETE_STREAM_AUTHORITY_NOT_IMPLEMENTED"
    result["successorLineage"] = {
        "predecessorContractId": SUMMARY_ID,
        "predecessorPath": SUMMARY_PATH,
        "predecessorFileSha256": predecessor_sha,
        "predecessorDisposition": "IMMUTABLE_FAILED_EVIDENCE_NOT_ACTIVE_AUTHORITY",
        "correction": (
            "ADD_SURVEY_ADMINISTRATION_QUERY_AND_DRAFT_REVISION_TO_CLOSE_THE_"
            "10_OPERATION_7_EVENT_PRODUCT_BOUNDARY"
        ),
        "operationDelta": {
            "added": [
                "modern.listening.survey.revise",
                "modern.listening.surveys.query",
            ],
            "removed": [],
        },
        "eventDelta": {
            "added": ["EmployeeListeningSurveyRevised.v3"],
            "removed": [],
        },
    }
    precedence = result["canonicalPrecedence"]
    precedence.update({
        "mode": "SEALED_STREAM_AUTHORITY_TO_CANONICAL_PROJECTION",
        "sourceDesignId": DESIGN_ID,
        "sourceDesignSha256": static_design_digest(),
        "canonicalCandidatePinRequired": True,
        "reverseCanonicalHashPin": "FORBIDDEN_TO_PREVENT_AUTHORITY_CYCLE",
        "activeAuthority": SUMMARY_V2_ID,
    })
    precedence.pop("authoritativeInputs", None)
    precedence.pop("generatedSummary", None)
    precedence.pop("predecessorPins", None)
    precedence.pop("historicalPredecessor", None)
    result["sealedPayloadSha256"] = sha256_bytes(canonical_payload(result))
    return result
