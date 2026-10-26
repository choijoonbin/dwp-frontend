#!/usr/bin/env python3
"""Validate the sealed HRM-013 callback and paired Approval design carrier."""

from __future__ import annotations

import csv
import hashlib
import json
import pathlib
import sys
from typing import Any


HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[4]
MAIN_PATH = HERE / "hrm-013-trusted-callback-service-binding-successor.v1.json"
BRIDGE_PATH = HERE / "hrm-013-separation-waiver-approval-bridge-successor.v1.json"
REGISTER_PATH = HERE / "service-api-auth-binding-register.successor.v2.csv"
PEOPLE_PATH = (
    HERE
    / "migration-manifests/base-tfr-hrm-013.people-v61-schema-manifest-successor.v2.json"
)
APPROVAL_PATH = HERE / "migration-manifests/hrm-013.approval-v59-schema-manifest.v1.json"

EXPECTED_IDS = [
    "SVC-PEP-HRM-007",
    "SVC-PEP-APR-002",
    "SVC-PEP-HRM-008",
    "SVC-PEP-HRM-009",
    "SVC-PEP-HRM-010",
]
EXPECTED_CALLBACKS: dict[str, dict[str, Any]] = {
    "SVC-PEP-HRM-008": {
        "operation": "task.receive",
        "sourceOperationId": "recordSeparationTaskReceipt",
        "path": "/internal/hris-people/v1/separation-cases/{casePublicId}/tasks/{taskPublicId}/receipts",
        "schema": "SeparationTaskReceiptV2",
        "callers": {
            "dwp-time-server": ("HRIS_SEPARATION_TIME_TASK_RECEIPT", "TIME_FINALIZATION"),
            "dwp-payroll-server": ("HRIS_SEPARATION_PAYROLL_TASK_RECEIPT", "PAYROLL_SETTLEMENT"),
            "dwp-auth-server": (
                "HRIS_SEPARATION_IDENTITY_TASK_RECEIPT",
                "IDENTITY_ACCESS_REVOCATION",
            ),
        },
    },
    "SVC-PEP-HRM-009": {
        "operation": "reconcile",
        "sourceOperationId": "recordSeparationReconciliationResult",
        "path": "/internal/hris-people/v1/separation-cases/{casePublicId}/reconciliation-results",
        "schema": "SeparationReconciliationResultV1",
        "callers": {
            "dwp-time-server": ("HRIS_SEPARATION_TIME_RECONCILIATION", None),
            "dwp-payroll-server": ("HRIS_SEPARATION_PAYROLL_RECONCILIATION", None),
        },
    },
    "SVC-PEP-HRM-010": {
        "operation": "task.waive.evidence.receive",
        "sourceOperationId": "recordSeparationTaskWaiverDecision",
        "path": "/internal/hris-people/v1/separation-cases/{casePublicId}/tasks/{taskPublicId}/waiver-decisions",
        "schema": "SeparationWaiverDecisionV2",
        "callers": {
            "dwp-approval-server": ("HRIS_SEPARATION_TASK_WAIVER_DECISION", None),
        },
    },
}


def load_json(path: pathlib.Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def read_csv(path: pathlib.Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open(encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        return list(reader.fieldnames or []), list(reader)


def sha256(path: pathlib.Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def require(condition: bool, message: str, failures: list[str]) -> None:
    if not condition:
        failures.append(message)


def validate_pin(
    base: pathlib.Path, pin: dict[str, Any], label: str, failures: list[str]
) -> None:
    path = (base / pin.get("path", "")).resolve()
    require(path.is_file(), f"{label} path missing", failures)
    if path.is_file():
        require(path.stat().st_size == pin.get("bytes"), f"{label} byte drift", failures)
        require(sha256(path) == pin.get("sha256"), f"{label} SHA-256 drift", failures)


def main() -> int:
    failures: list[str] = []
    for path in (MAIN_PATH, BRIDGE_PATH, REGISTER_PATH, PEOPLE_PATH, APPROVAL_PATH):
        require(path.is_file(), f"missing carrier artifact: {path.name}", failures)
    if failures:
        print(json.dumps({"status": "FAIL", "failures": failures}, indent=2))
        return 1

    main_doc = load_json(MAIN_PATH)
    bridge = load_json(BRIDGE_PATH)
    people = load_json(PEOPLE_PATH)
    approval = load_json(APPROVAL_PATH)

    require(
        main_doc.get("schema")
        == "dwp.hris.wave7.r7-batch-06-hrm013-trusted-callback-service-binding-successor.v1",
        "callback authority schema drift",
        failures,
    )
    require(
        bridge.get("schema")
        == "dwp.hris.wave7.r7-batch-06-hrm013-separation-waiver-approval-bridge-successor.v1",
        "paired Approval bridge schema drift",
        failures,
    )
    require(
        people.get("schema")
        == "dwp.hris.wave7.r7-batch-06-hrm013-people-v61-schema-manifest-successor.v2",
        "People V61 manifest successor schema drift",
        failures,
    )
    require(
        approval.get("schema")
        == "dwp.hris.wave7.r7-batch-06-hrm013-approval-v59-schema-manifest.v1",
        "Approval V59 manifest schema drift",
        failures,
    )

    lineage = main_doc["lineage"]
    for name in (
        "centralIntegrationReceipt",
        "semanticDisposition",
        "contractSuccessor",
        "peopleV61Manifest",
        "priorServiceBindingOverlay",
        "currentAuthorityIndex",
    ):
        validate_pin(MAIN_PATH.parent, lineage[name], name, failures)
    validate_pin(PEOPLE_PATH.parent, people["predecessor"], "People V61 predecessor", failures)

    prior_register = (
        MAIN_PATH.parent / lineage["priorServiceBindingOverlay"]["path"]
    ).resolve()
    prior_header, prior_rows = read_csv(prior_register)
    header, rows = read_csv(REGISTER_PATH)
    require(header == prior_header, "service-binding register header drift", failures)
    require(len(header) == 24, "service-binding register must have 24 columns", failures)
    require([row["binding_id"] for row in rows] == EXPECTED_IDS, "binding ID set/order drift", failures)
    require(len({row["binding_id"] for row in rows}) == len(rows), "duplicate binding ID", failures)
    require(len(prior_rows) == 1 and rows[0] == prior_rows[0], "HRM-007 row was not preserved exactly", failures)

    by_id = {row["binding_id"]: row for row in rows}
    apr = by_id["SVC-PEP-APR-002"]
    require(apr["method"] == "POST", "APR-002 method drift", failures)
    require(
        apr["owner_path"] == "/internal/hris-approval/v1/separation-task-waiver-requests",
        "APR-002 path drift",
        failures,
    )
    require(apr["owner_service"] == "dwp-approval-server", "APR-002 owner drift", failures)
    require(apr["caller_service_identities"] == "dwp-people-server", "APR-002 caller drift", failures)
    require(apr["purpose_codes"] == "HRIS_SEPARATION_TASK_WAIVER_REQUEST", "APR-002 purpose drift", failures)

    callbacks = {item["bindingId"]: item for item in main_doc["bindings"]}
    require(set(callbacks) == set(EXPECTED_CALLBACKS), "callback binding set drift", failures)
    for binding_id, expected in EXPECTED_CALLBACKS.items():
        item = callbacks.get(binding_id, {})
        row = by_id[binding_id]
        require(item.get("operation") == expected["operation"], f"{binding_id} operation drift", failures)
        require(
            item.get("sourceOperationId") == expected["sourceOperationId"]
            and row["source_operation_id"] == expected["sourceOperationId"],
            f"{binding_id} source operation drift",
            failures,
        )
        require(item.get("method") == "POST", f"{binding_id} method drift", failures)
        require(item.get("exactPathTemplate") == expected["path"], f"{binding_id} path drift", failures)
        require(item.get("requestSchema") == expected["schema"], f"{binding_id} schema drift", failures)
        require(row["owner_path"] == expected["path"], f"{binding_id} CSV path drift", failures)
        require(row["owner_service"] == "dwp-people-server", f"{binding_id} owner drift", failures)
        actual_callers = {
            entry["callerWorkloadId"]: (
                entry["purpose"],
                (entry.get("allowedTaskTypes") or [None])[0],
            )
            for entry in item.get("callerMatrix", [])
        }
        require(actual_callers == expected["callers"], f"{binding_id} caller matrix drift", failures)
        require("*" not in row["caller_service_identities"], f"{binding_id} wildcard caller", failures)
        require(row["owner_path"].startswith("/internal/"), f"{binding_id} is not internal", failures)

    for binding_id in EXPECTED_IDS[1:]:
        authentication = by_id[binding_id]["workload_authentication"]
        controls = by_id[binding_id]["transport_controls"]
        require(
            "X_DWP_WORKLOAD_PROOF_RS256_JWT" in authentication
            and "AUTHORIZATION_HEADER_FORBIDDEN" in authentication
            and "OAUTH2" not in authentication
            and "BEARER" not in authentication,
            f"{binding_id} workload-proof carrier drift",
            failures,
        )
        require(
            "X_DWP_WORKLOAD_PROOF_REQUIRED" in controls
            and "AUTHORIZATION_HEADER_FORBIDDEN" in controls
            and "MAX_REQUEST_BYTES_32768" in controls
            and "MAX_RESPONSE_BYTES_16384" in controls,
            f"{binding_id} transport-control drift",
            failures,
        )

    require(
        all(item.get("maximumRequestBytes") == 32768 for item in callbacks.values()),
        "callback request cap drift",
        failures,
    )

    constants = main_doc["bindingConstants"]
    require(constants.get("browserRoute") is None, "browser callback route exists", failures)
    require(constants.get("gatewayRoute") is None, "gateway callback route exists", failures)
    require(constants.get("publicOpenApiMember") is False, "callback entered public OpenAPI", failures)
    require(constants.get("ownerAudience") == "dwp-people-server", "callback audience drift", failures)

    schemas = main_doc["closedRequestSchemas"]
    require(
        "externalReceiptPublicId" in schemas["SeparationTaskReceiptV2"]["requiredFields"],
        "task receipt lacks externalReceiptPublicId",
        failures,
    )
    waiver_fields = schemas["SeparationWaiverDecisionV2"]["requiredFields"]
    require("decision" in waiver_fields, "waiver decision field missing", failures)
    require(
        schemas["SeparationWaiverDecisionV2"]["fieldTypes"].get("decision")
        == "APPROVED|REJECTED",
        "waiver decision enum drift",
        failures,
    )
    require(
        schemas["SeparationReconciliationResultV1"].get("taskPublicIdRule", "").startswith("Not present"),
        "reconciliation task identity rule drift",
        failures,
    )
    require("occurredAtRule" in schemas["common"], "callback temporal rule missing", failures)
    for schema_name in (
        "SeparationTaskReceiptV2",
        "SeparationWaiverDecisionV2",
        "SeparationReconciliationResultV1",
    ):
        require(
            "originatingPayloadSha256" in schemas[schema_name]["requiredFields"],
            f"{schema_name} originating payload lineage missing",
            failures,
        )
    step_up_fields = [
        "stepUpEvidenceId",
        "stepUpEvidenceAudience",
        "stepUpEvidencePurpose",
        "stepUpEvidenceNonce",
        "stepUpEvidenceDigest",
        "stepUpVerifiedAt",
        "stepUpConsumedAt",
    ]
    waiver_conditionals = schemas["SeparationWaiverDecisionV2"]["conditionalFields"]
    require(
        waiver_conditionals["APPROVED"]["requiredNonNull"] == step_up_fields
        and waiver_conditionals["REJECTED"]["mustBeAbsent"] == step_up_fields
        and waiver_conditionals["REJECTED"]["nullEncodingAllowed"] is False,
        "waiver APPROVED/REJECTED step-up body contract drift",
        failures,
    )

    transport = main_doc["transportAuthentication"]
    require(
        transport.get("composition") == "TLS_1_3_MTLS_SPIFFE_AND_RS256_CLIENT_CREDENTIAL_JWT",
        "transport authentication drift",
        failures,
    )
    common_claims = {
        "iss", "aud", "sub", "iat", "nbf", "exp", "jti", "requestNonce",
        "bindingId", "purpose", "method", "path", "tenantId",
        "tenantGrantRevision", "authorizationRevision", "correlationId",
        "callbackEventId", "casePublicId", "ownerRevision",
        "originatingPayloadSha256", "requestBodySha256", "authn", "cnf",
    }
    expected_claims_by_binding = {
        "SVC-PEP-HRM-008": common_claims | {"taskPublicId"},
        "SVC-PEP-HRM-009": common_claims,
        "SVC-PEP-HRM-010": common_claims | {"taskPublicId", "approvalRequestId"},
    }
    closed_claims_by_binding = transport["jwt"]["closedClaimsByBinding"]
    require(
        set(closed_claims_by_binding) == set(expected_claims_by_binding),
        "closed callback binding claim allocation drift",
        failures,
    )
    for binding_id, expected_claims in expected_claims_by_binding.items():
        claim_contract = closed_claims_by_binding.get(binding_id, {})
        require(
            set(claim_contract.get("alwaysRequiredClaims", [])) == expected_claims
            and claim_contract.get("additionalClaimsAllowed") is False,
            f"{binding_id} closed callback claim set drift",
            failures,
        )
    require(
        transport["jwt"].get("jtiMustDifferFromRequestNonce") is True,
        "callback proof permits jti/requestNonce equality",
        failures,
    )
    bridge_claims = bridge["workloadProofProfile"]["closedClaimsByBinding"]
    require(
        closed_claims_by_binding["SVC-PEP-HRM-010"]
        == bridge_claims["SVC-PEP-HRM-010"],
        "HRM-010 callback/Approval bridge claim contract drift",
        failures,
    )
    hrm010_conditional_claims = closed_claims_by_binding["SVC-PEP-HRM-010"][
        "conditionalClaims"
    ]
    require(
        hrm010_conditional_claims["APPROVED"]["requiredNonNull"] == step_up_fields
        and hrm010_conditional_claims["APPROVED"]["mustEqualBody"] == step_up_fields
        and hrm010_conditional_claims["REJECTED"]["mustBeAbsent"] == step_up_fields
        and hrm010_conditional_claims["REJECTED"]["nullEncodingAllowed"] is False,
        "HRM-010 conditional step-up claim contract drift",
        failures,
    )
    forbidden = set(transport["forbiddenApplicationHeaders"])
    require("X-Forwarded-*" in forbidden and "Sec-*" in forbidden, "header prefix firewall missing", failures)
    exact_headers = {
        "Content-Type",
        "Accept",
        "X-DWP-Service-Identity",
        "X-DWP-Workload-Proof",
        "X-Correlation-ID",
    }
    require(
        set(transport["requiredApplicationHeaders"]) == exact_headers
        and "Authorization" in forbidden,
        "callback exact header allowlist or Authorization deny rule drift",
        failures,
    )

    response = main_doc["responseContract"]
    require(response.get("schema") == "SeparationCallbackReceiptV1", "response schema drift", failures)
    require(response.get("maximumResponseBytes") == 16384, "callback response cap drift", failures)
    require("taskPublicId" not in response["requiredFields"], "conditional taskPublicId made globally required", failures)
    require("taskPublicId" in response["conditionalFields"], "conditional taskPublicId rule missing", failures)
    replay = main_doc["replayAndPersistence"]
    durable = set(replay["requiredDurableEvidence"])
    require("receiptPublicId" in durable, "callback receipt identity is not durable", failures)
    require("commandReceiptId" not in durable, "generic command receipt leaked into callback ledger", failures)
    require(
        replay.get("rawCallbackRequestPayloadStored") is False,
        "raw callback body persistence enabled",
        failures,
    )
    require(
        "originatingPayloadSha256" in durable
        and "externalReceiptPublicId for task receipt callbacks" in durable
        and "all seven step-up evidence fields for approved waiver callbacks" in durable,
        "callback durable lineage evidence drift",
        failures,
    )

    request = bridge["requestEndpoint"]
    decision = bridge["decisionEndpoint"]
    require(request.get("bindingId") == "SVC-PEP-APR-002", "bridge request binding drift", failures)
    require(decision.get("bindingId") == "SVC-PEP-HRM-010", "bridge decision binding drift", failures)
    require(
        request.get("operationId") == "createAndSubmitSeparationTaskWaiverRequest"
        and decision.get("operationId") == "recordSeparationTaskWaiverDecision",
        "paired bridge operation ID drift",
        failures,
    )
    require(request.get("successStatus") == 202, "waiver submission is not atomic 202", failures)
    require(
        request.get("maximumRequestBytes") == 32768
        and request.get("maximumResponseBytes") == 16384
        and decision.get("maximumRequestBytes") == 32768
        and decision.get("maximumResponseBytes") == 16384
        and set(request.get("allowedApplicationHeaderNames", [])) == exact_headers
        and set(request.get("requiredApplicationHeaders", {})) == exact_headers
        and "Authorization" in request.get("forbiddenApplicationHeaders", [])
        and bridge["workloadProofProfile"].get("authorizationHeaderAllowed") is False,
        "APR-002 exact header or 16-KiB response contract drift",
        failures,
    )
    size_contract = bridge["persistenceSizeContract"]
    require(
        size_contract.get("maximumAcceptedRequestBytes") == 32768
        and size_contract.get("maximumPersistedExactRequestBytes") == 32768
        and size_contract.get("maximumPersistedExactResponseBytes") == 16384,
        "paired bridge 32-KiB request/16-KiB response persistence contract drift",
        failures,
    )
    expected_apr_claims = {
        "iss", "aud", "sub", "iat", "nbf", "exp", "jti", "requestNonce",
        "bindingId", "purpose", "method", "path", "tenantId",
        "tenantGrantRevision", "authorizationRevision", "correlationId",
        "approvalRequestId", "casePublicId", "taskPublicId", "requestBodySha256",
        "authn", "cnf",
    }
    apr_claims = bridge_claims["SVC-PEP-APR-002"]
    require(
        set(apr_claims.get("alwaysRequiredClaims", [])) == expected_apr_claims
        and apr_claims.get("additionalClaimsAllowed") is False,
        "APR-002 closed workload-proof claims drift",
        failures,
    )
    require(
        bridge["closedSchemas"]["SeparationWaiverApprovalSubmissionReceiptV1"]["fieldTypes"].get("state")
        == "PENDING",
        "remote draft state is allowed",
        failures,
    )
    bridge_waiver_conditionals = bridge["closedSchemas"]["SeparationWaiverDecisionV2"][
        "conditionalFields"
    ]
    require(
        bridge_waiver_conditionals == waiver_conditionals,
        "HRM-010 main/bridge conditional body schema drift",
        failures,
    )
    touch_tables = set(bridge["approvalPersistenceTouchManifest"]["requiredTables"])
    expected_approval_tables = {
        "apr_hrm013_tenant_grants",
        "apr_hrm013_proof_replays",
        "apr_hrm013_waiver_request_bindings",
        "apr_hrm013_waiver_decision_outbox",
    }
    require(touch_tables == expected_approval_tables, "bridge Approval table manifest drift", failures)

    people_tables = set(people["effectiveComposition"]["effectiveTableSet"])
    expected_people_tables = {
        "ppl_separation_cases",
        "ppl_separation_tasks",
        "ppl_hrm013_callback_proof_replays",
        "ppl_separation_waiver_request_outbox",
        "ppl_separation_callback_authorities",
        "ppl_separation_callbacks",
    }
    require(people_tables == expected_people_tables, "People V61 effective table set drift", failures)
    require(
        set(bridge["peoplePrerequisitePersistence"]["requiredTables"])
        == {
            "ppl_hrm013_callback_proof_replays",
            "ppl_separation_waiver_request_outbox",
            "ppl_separation_callback_authorities",
        },
        "bridge People prerequisite table manifest drift",
        failures,
    )
    main_fence = main_doc["protocolFenceRequirement"]
    people_fence = people["callbackAuthorityTable"]
    expected_stream_key = [
        "tenant_id",
        "binding_id",
        "caller_workload_id",
        "case_public_id",
        "task_public_id",
        "purpose_code",
        "approval_request_id",
    ]
    expected_fence_values = [
        "expected_next_owner_revision",
        "correlation_id",
        "originating_payload_sha256",
        "task_type",
        "consumer_event_id",
        "tenant_grant_revision",
        "authorization_revision",
        "created_at",
        "closed_at",
    ]
    require(
        main_fence.get("persistenceTable") == people_fence.get("table")
        and main_fence.get("immutableStreamKeyColumns") == expected_stream_key
        and people_fence.get("immutableKey") == expected_stream_key
        and main_fence.get("versionColumn") == "authority_revision"
        and "authority_revision BIGINT NOT NULL" in people_fence.get("columns", [])
        and main_fence.get("requiredColumns") == expected_fence_values
        and people_fence.get("requiredValues") == expected_fence_values
        and people_fence.get("uniqueConstraints", [])[-1]
        == "tenant_id,binding_id,caller_workload_id,case_public_id,task_public_id,purpose_code,approval_request_id,authority_revision NULLS NOT DISTINCT"
        and "first ownerRevision and decisionRevision are 1"
        in " ".join(main_fence.get("rules", []))
        and "new authority_revision 1 and expected_next_owner_revision 1 stream"
        in people_fence.get("sequenceRule", ""),
        "main/People protocol-fence key or column parity drift",
        failures,
    )
    people_fence_columns = set(people_fence.get("columns", []))
    require(
        {
            "tenant_grant_revision BIGINT NOT NULL",
            "authorization_revision BIGINT NOT NULL",
        }.issubset(people_fence_columns)
        and people.get("grantRevisionFence", {}).get("proofClaims")
        == {
            "tenantGrantRevision": "tenant_grant_revision",
            "authorizationRevision": "authorization_revision",
        }
        and "one current service-grant row"
        in people.get("grantRevisionFence", {}).get("authorityRule", ""),
        "People callback grant-revision fence drift",
        failures,
    )
    callback_columns = set(people["callbackTableReplacement"]["columns"])
    for column in (
        "external_receipt_public_id UUID",
        "originating_payload_sha256 CHAR(64) NOT NULL",
        "command_digest CHAR(64) NOT NULL",
        "request_body_sha256 CHAR(64) NOT NULL",
        "receipt_public_id UUID NOT NULL",
        "exact_response_body BYTEA NOT NULL",
        "response_body_sha256 CHAR(64) NOT NULL",
        "approval_request_id UUID",
        "decision_revision BIGINT",
        "tenant_grant_revision BIGINT NOT NULL",
        "authorization_revision BIGINT NOT NULL",
        "case_maker_public_id UUID",
        "requested_by_actor_public_id UUID",
        "step_up_evidence_id UUID",
        "step_up_evidence_audience VARCHAR(120)",
        "step_up_evidence_purpose VARCHAR(120)",
        "step_up_evidence_nonce_sha256 CHAR(64)",
        "step_up_evidence_sha256 CHAR(64)",
        "step_up_verified_at TIMESTAMPTZ",
        "step_up_consumed_at TIMESTAMPTZ",
    ):
        require(column in callback_columns, f"People callback column missing: {column}", failures)
    require(
        "ppl_command_receipts" not in people["effectiveComposition"]["existingInfrastructureReused"]
        and any(
            "ppl_command_receipts" in item
            for item in people["effectiveComposition"]["protectedInfrastructureNotReused"]
        ),
        "public command receipt separation declaration missing",
        failures,
    )
    require(
        "do not insert ppl_command_receipts" in people["callbackTableReplacement"]["genericReceiptSeparation"],
        "callback/generic receipt separation missing",
        failures,
    )
    callback_checks = " ".join(people["callbackTableReplacement"]["checks"])
    require(
        "octet_length(exact_response_body) is between 1 and 16384" in callback_checks
        and "APPROVAL_DECISION requires owner_revision = decision_revision" in callback_checks
        and "65536" not in callback_checks,
        "People callback response byte cap drift",
        failures,
    )
    proof_replay = people["proofReplayTable"]
    require(
        proof_replay.get("table") == "ppl_hrm013_callback_proof_replays"
        and proof_replay.get("uniqueConstraints") == ["tenant_id,token_digest"]
        and any(
            "jti digest and requestNonce digest presented by one proof must differ" in item
            for item in proof_replay.get("checks", [])
        )
        and "across token kinds, bindings and callers" in proof_replay.get("reservationRule", "")
        and people["v54NonRegression"].get("protectedTable")
        == "ppl_hris_bridge_proof_replays"
        and people["v54NonRegression"].get("protectedBindingId") == "SVC-PEP-HRM-001",
        "People HRM-013 proof replay isolation drift",
        failures,
    )
    waiver_outbox = people["waiverRequestFenceAndOutbox"]
    waiver_outbox_columns = set(waiver_outbox["columns"])
    waiver_outbox_checks = " ".join(waiver_outbox["checks"])
    require(
        waiver_outbox.get("table") == "ppl_separation_waiver_request_outbox"
        and {
            "case_maker_public_id UUID NOT NULL",
            "requested_by_actor_public_id UUID NOT NULL",
            "task_owner_revision BIGINT NOT NULL",
            "task_version BIGINT NOT NULL",
            "exact_request_body BYTEA NOT NULL",
            "request_body_sha256 CHAR(64) NOT NULL",
            "approval_request_payload_sha256 CHAR(64) NOT NULL",
            "command_digest CHAR(64) NOT NULL",
            "correlation_id UUID NOT NULL",
            "dispatch_state VARCHAR(20) NOT NULL DEFAULT 'PENDING'",
        }.issubset(waiver_outbox_columns),
        "People APR-002 immutable fence/outbox drift",
        failures,
    )
    require(
        "octet_length(exact_request_body) is between 1 and 32768"
        in waiver_outbox_checks
        and "octet_length(exact_response_body) is between 1 and 16384"
        in waiver_outbox_checks,
        "People APR-002 request/response byte-cap split drift",
        failures,
    )

    approval_tables = {item["name"] for item in approval["newTables"]}
    require(approval_tables == expected_approval_tables, "Approval V59 table set drift", failures)
    require(
        approval["bindingAllocation"]["request"].get("operation")
        == "createAndSubmitSeparationTaskWaiverRequest"
        and approval["bindingAllocation"]["callback"].get("operation")
        == "recordSeparationTaskWaiverDecision",
        "Approval manifest operation alignment drift",
        failures,
    )
    approval_by_table = {item["name"]: item for item in approval["newTables"]}
    approval_grant = approval_by_table["apr_hrm013_tenant_grants"]
    approval_grant_columns = set(approval_grant["columns"])
    approval_grant_checks = " ".join(approval_grant["checks"])
    grant_contract = approval["grantRevisionContract"]
    bridge_grant_contract = bridge["workloadProofProfile"]["tenantGrantAuthority"]
    require(
        {
            "grant_revision BIGINT NOT NULL",
            "tenant_grant_revision BIGINT NOT NULL",
            "authorization_revision BIGINT NOT NULL",
        }.issubset(approval_grant_columns)
        and "tenant_grant_revision > 0" in approval_grant_checks
        and "authorization_revision > 0" in approval_grant_checks
        and approval_grant.get("uniqueConstraints")
        == [
            "tenant_id,grant_id",
            "tenant_id,grant_id,tenant_grant_revision,authorization_revision",
            "tenant_id,grant_revision",
        ]
        and bridge_grant_contract.get("claimToColumnMapping")
        == {
            "tenantGrantRevision": "tenant_grant_revision",
            "authorizationRevision": "authorization_revision",
        }
        and "highest grant_revision" in grant_contract.get("admissionRule", "")
        and "decision ADMIT" in grant_contract.get("admissionRule", "")
        and "same grant_id" in grant_contract.get("outboxRule", "")
        and "No proof may combine" in grant_contract.get("proofRule", ""),
        "Approval current grant and signed revision mapping drift",
        failures,
    )
    approval_replay = approval_by_table["apr_hrm013_proof_replays"]
    approval_replay_checks = " ".join(approval_replay["checks"])
    bridge_replay = bridge["workloadProofProfile"]["replayPersistence"]
    require(
        approval_replay.get("columns")
        == [
            "proof_replay_id BIGSERIAL PRIMARY KEY",
            "tenant_id BIGINT NOT NULL",
            "binding_id VARCHAR(40) NOT NULL",
            "caller_workload_id VARCHAR(120) NOT NULL",
            "token_kind VARCHAR(16) NOT NULL",
            "token_digest CHAR(64) NOT NULL",
            "expires_at TIMESTAMPTZ NOT NULL",
            "reserved_at TIMESTAMPTZ NOT NULL",
        ]
        and approval_replay.get("uniqueConstraints") == ["tenant_id,token_digest"]
        and "token_digest is lowercase hexadecimal length 64" in approval_replay_checks
        and "canonical UUIDs, differ before hashing" in approval_replay_checks
        and "atomically insert two separate JTI and REQUEST_NONCE rows"
        in approval_replay.get("reservationRule", "")
        and "binding_id, caller_workload_id or token_kind changes"
        in approval_replay.get("reservationRule", "")
        and "Persist only token_digest" in approval_replay.get("persistenceRule", "")
        and "Raw jti" in approval_replay.get("persistenceRule", "")
        and bridge_replay.get("uniqueIdentity") == ["tenant_id", "token_digest"]
        and bridge_replay.get("atomicRows")
        == ["JTI digest", "REQUEST_NONCE digest"],
        "Approval two-row digest-only proof replay design drift",
        failures,
    )
    approval_request_columns = set(
        approval_by_table["apr_hrm013_waiver_request_bindings"]["columns"]
    )
    approval_request = approval_by_table["apr_hrm013_waiver_request_bindings"]
    approval_request_checks = " ".join(approval_request["checks"])
    require(
        {
            "case_maker_public_id UUID NOT NULL",
            "requested_by_actor_public_id UUID NOT NULL",
            "requested_task_version BIGINT NOT NULL",
            "grant_id UUID NOT NULL",
            "tenant_grant_revision BIGINT NOT NULL",
            "authorization_revision BIGINT NOT NULL",
            "approval_request_payload_sha256 CHAR(64) NOT NULL",
            "exact_request_body BYTEA NOT NULL",
            "request_body_sha256 CHAR(64) NOT NULL",
            "command_digest CHAR(64) NOT NULL",
        }.issubset(approval_request_columns),
        "Approval immutable request evidence drift",
        failures,
    )
    require(
        "octet_length(exact_request_body) is between 1 and 32768"
        in approval_request_checks
        and "octet_length(exact_response_body) is between 1 and 16384"
        in approval_request_checks
        and "tenant_id,approval_request_id,grant_id,tenant_grant_revision,authorization_revision"
        in approval_request.get("uniqueConstraints", []),
        "Approval APR-002 request/response cap or exact grant preservation drift",
        failures,
    )
    approval_outbox = approval_by_table["apr_hrm013_waiver_decision_outbox"]
    approval_outbox_columns = set(approval_outbox["columns"])
    approval_outbox_checks = " ".join(approval_outbox["checks"])
    require(
        {
            "case_maker_public_id UUID NOT NULL",
            "requested_by_actor_public_id UUID NOT NULL",
            "step_up_evidence_id UUID",
            "step_up_evidence_audience VARCHAR(120)",
            "step_up_evidence_purpose VARCHAR(120)",
            "step_up_evidence_nonce_sha256 CHAR(64)",
            "step_up_evidence_sha256 CHAR(64)",
            "step_up_verified_at TIMESTAMPTZ",
            "step_up_consumed_at TIMESTAMPTZ",
            "approval_request_payload_sha256 CHAR(64) NOT NULL",
            "callback_payload_sha256 CHAR(64) NOT NULL",
            "exact_callback_body BYTEA NOT NULL",
            "grant_id UUID NOT NULL",
            "tenant_grant_revision BIGINT NOT NULL",
            "authorization_revision BIGINT NOT NULL",
            "owner_revision BIGINT NOT NULL",
        }.issubset(approval_outbox_columns)
        and "APPROVED requires all seven step-up columns non-null" in approval_outbox_checks
        and "REJECTED requires all seven step-up columns null" in approval_outbox_checks
        and "owner_revision = decision_revision" in approval_outbox_checks
        and "octet_length(exact_callback_body) is between 1 and 32768"
        in approval_outbox_checks
        and "exact receipt bytes of 1 through 16384 octets" in approval_outbox_checks,
        "Approval conditional step-up/exact outbox drift",
        failures,
    )
    migration = approval["migration"]
    require(migration.get("observedHighWater") == "V58", "Approval high-water drift", failures)
    require(migration.get("candidateVersion") == "V59", "Approval candidate version drift", failures)
    require(migration.get("leaseState") == "NOT_ISSUED", "Approval V59 lease unexpectedly issued", failures)

    for doc, label in (
        (main_doc, "callback authority"),
        (bridge, "Approval bridge"),
        (people, "People manifest"),
        (approval, "Approval manifest"),
    ):
        next_action = doc.get("nextAction", "")
        require(
            "APPROVAL_V59" in next_action
            and "PEOPLE_V61" in next_action
            and "INTEGRATION_RECEIPT" in next_action
            and "HRM013_OWNER_PACKET" in next_action,
            f"{label} paired V59/V61 preparation or integration gate drift",
            failures,
        )

    for doc, label in (
        (main_doc, "callback authority"),
        (bridge, "Approval bridge"),
        (people, "People manifest"),
        (approval, "Approval manifest"),
    ):
        authority = doc["authority"]
        for key, value in authority.items():
            if key.endswith("Authorized") or key.endswith("Active") or key.endswith("Issued"):
                require(value is False, f"{label} unexpectedly grants {key}", failures)
        require(authority.get("businessCompletionCredit", 0) == 0, f"{label} grants business credit", failures)

    result = {
        "schema": "dwp.hris.wave7.r7-batch-06-hrm013-callback-binding-validation.v1",
        "status": "PASS" if not failures else "FAIL",
        "checks": {
            "registerColumns": len(header),
            "registerRows": len(rows),
            "callbackBindings": len(callbacks),
            "peopleEffectiveTables": len(people_tables),
            "approvalV59Tables": len(approval_tables),
            "sourceAuthorityGranted": False,
        },
        "failures": failures,
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if not failures else 1


if __name__ == "__main__":
    sys.exit(main())
