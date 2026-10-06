#!/usr/bin/env python3
"""Compose the reviewed 199-operation causal SSOT successor.

This generator owns only the operation-level canonical document.  It consumes
the sealed predecessor once, the reviewed closed-set design, and the static
Listening design.  It does not read the independent oracle or any derived
Listening summary.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import re
from pathlib import Path
from typing import Any

from modern_closed_set_design import (
    DIRECT_APPROVAL_PUBLISH_IDS,
    EXISTING_QUERY_RUNTIME,
    FROZEN_APPROVAL_PUBLISH_IDS,
    NEW_COMMAND_RUNTIME,
    NEW_QUERY_RUNTIME,
    NON_LISTENING_HANDLER_EVENTS,
    NON_LISTENING_HANDLER_ADDITIONAL_EVENTS,
    PREDECESSOR_OPERATION_SSOT_SHA256,
    PUBLISH_OPERATION_IDS,
    REMOVED_OPERATION_IDS,
    REMOVED_PUBLIC_EVENT_IDS,
    REPLACED_PUBLIC_EVENT_IDS,
    SPECIAL_PROOF_PUBLISH_IDS,
    events_for_new_operation,
)
from sys_listening_canonical_design import (
    LISTENING_SIGNATURE_ALGORITHMS,
    LISTENING_SIGNATURE_ALGORITHM_MAX_BYTES,
    LISTENING_SIGNATURE_MAX_BYTES,
    LISTENING_SIGNATURE_SERIALIZATION,
    build_static_design,
    composition_marker,
    static_design_digest,
    stamp_canonical_document,
)


HERE = Path(__file__).resolve().parent
SSOT = HERE / "modern-capability-operation-causal-contract-ssot.v2.json"
MANIFEST = HERE / "modern-capability-closed-set-manifest.v3.json"
OPERATION_SUCCESSOR_PROJECTION_VERSION = "modern-operation-causal-source-v10-2026-09-16"
PREVIOUS_OPERATION_SUCCESSOR_PROJECTION_VERSION = (
    "modern-operation-causal-source-v8-2026-09-16"
)

PAYROLL_SNAPSHOT_DEPENDENCY_ID = (
    "compensation.resolveApprovedSnapshotForPayroll.v1"
)
PAYROLL_SNAPSHOT_EVENT = "ApprovedCompensationPlanSnapshotPublished.v2"
PAYROLL_SNAPSHOT_PURPOSE = "HRIS_APPROVED_COMPENSATION_PLAN_SNAPSHOT_REFETCH"
PAYROLL_SNAPSHOT_HEADER_FIELDS = (
    "snapshotId", "snapshotRevision", "planId", "cycleId", "effectiveFrom",
    "effectiveTo", "approvalReceiptId", "sourceVersion", "lineCount",
    "payloadDigest",
)
PAYROLL_SNAPSHOT_LINE_FIELDS = (
    "lineId", "lineSequence", "workerId", "assignmentId", "componentCode",
    "currency", "approvedAmount", "effectiveFrom", "effectiveTo", "lineDigest",
)
PAYROLL_SNAPSHOT_PAY_EVENT_FIELDS = (
    "snapshotId", "snapshotRevision", "payloadDigest", "lineCount",
)

LEARNING_SKILL_EVIDENCE_OWNER_SOURCE = (
    "ownerProof.body.evidencePublicId.skillEvidenceIds[*]"
)
LEARNING_WORKER_SKILL_EVIDENCE_SELECTOR = (
    "SELECTED:prf_skl_worker_evidence.worker_skill_evidence_id FROM "
    + LEARNING_SKILL_EVIDENCE_OWNER_SOURCE
)
WFP_RESULT_OWNER_REQUIRED_FIELDS = (
    "resultReceiptId", "resultReceiptRevision", "resultSchemaVersion", "resultDigest",
)
WFP_RESULT_OWNER_IDENTITY = (
    "receiptId+receiptRevision+resultSchemaVersion+resultDigest exact"
)
WFP_RESULT_OWNER_VALIDATION = (
    "SIGNED_OWNER_RESULT_MATCHES_LOCKED_REQUEST_ID_REVISION_AND_DIGEST"
)


def _sealed_contract(value: dict[str, Any]) -> dict[str, Any]:
    result = copy.deepcopy(value)
    result.pop("sealedPayloadSha256", None)
    result["sealedPayloadSha256"] = hashlib.sha256(
        json.dumps(
            result, ensure_ascii=False, sort_keys=True, separators=(",", ":"),
        ).encode("utf-8")
    ).hexdigest()
    return result


def _compensation_payroll_owner_dependency() -> dict[str, Any]:
    """Exact immutable PER snapshot read model consumed only by PAY.

    The public operation inventory remains 199.  This is an internal,
    service-to-service read-only owner dependency: the event is only a small
    invalidation trigger and never carries up to 100,000 sensitive pay lines.
    """
    request_fields = [
        {
            "name": "tenantId", "source": "verifiedWorkloadContext.tenantId",
            "location": "trustedContext", "type": "BIGINT", "required": True,
            "callerSupplied": False, "requestDigestMember": True,
        },
        {
            "name": "snapshotId", "source": "pathParameters.snapshotId",
            "location": "pathParameters", "type": "UUID", "required": True,
            "sensitivity": "INTERNAL", "tokenization": "OPAQUE_PUBLIC_ID",
            "requestDigestMember": True,
            "referenceContract": {
                "entityType": "table:prf_cmp_approved_snapshots",
                "idSpace": "PUBLIC_UUID",
            },
        },
        {
            "name": "snapshotRevision", "source": "queryParameters.snapshotRevision",
            "location": "queryParameters", "type": "BIGINT", "required": True,
            "requestDigestMember": True,
        },
        {
            "name": "payloadDigest", "source": "queryParameters.payloadDigest",
            "location": "queryParameters", "type": "SHA256", "required": True,
            "requestDigestMember": True, "tokenization": "NONREVERSIBLE_DIGEST",
        },
        {
            "name": "purposeCode", "source": "verifiedWorkloadContext.purposeCode",
            "location": "trustedContext", "type": "STRING", "required": True,
            "callerSupplied": False, "requestDigestMember": True,
            "allowedValues": [PAYROLL_SNAPSHOT_PURPOSE],
        },
    ]
    line_fields = [
        {
            "name": name,
            "type": (
                "UUID" if name.endswith("Id") else
                "INTEGER" if name == "lineSequence" else
                "DECIMAL_STRING" if name == "approvedAmount" else
                "DATE" if name in {"effectiveFrom", "effectiveTo"} else
                "SHA256" if name == "lineDigest" else "STRING"
            ),
            "required": True,
            "sensitivity": (
                "HIGHLY_RESTRICTED" if name in {
                    "workerId", "assignmentId", "approvedAmount",
                } else "RESTRICTED"
            ),
        }
        for name in PAYROLL_SNAPSHOT_LINE_FIELDS
    ]
    for field in line_fields:
        name = field["name"]
        field["nullable"] = name == "effectiveTo"
        if name == "effectiveTo":
            field["nullEncoding"] = "EXPLICIT_JSON_NULL_INCLUDED_IN_CANONICAL_DIGEST"
        elif name == "lineSequence":
            field["validation"] = (
                "ONE_BASED_STREAM_ORDINAL_CONTIGUOUS_NO_GAP_NO_DUPLICATE"
            )
        elif name == "currency":
            field.update({
                "pattern": "^[A-Z]{3}$",
                "validation": "ISO_4217_UPPERCASE_ALPHA3",
            })
        elif name == "approvedAmount":
            field.update({
                "pattern": r"^-?(?:0|[1-9][0-9]{0,14})(?:\.[0-9]{1,4})?$",
                "valueTypeRef": (
                    "coding-readiness/decimal-value-types.v1.json#/valueTypes/"
                    "PostedMoney"
                ),
                "sqlType": "NUMERIC(19,4)",
                "exponentNotation": "FORBIDDEN",
                "binaryFloatingPoint": "FORBIDDEN",
                "negativeZero": "FORBIDDEN",
                "implicitRounding": "FORBIDDEN",
                "quantization": (
                    "EXPLICIT_EFFECTIVE_CURRENCY_POLICY_BEFORE_SNAPSHOT_FREEZE"
                ),
                "validation": (
                    "CANONICAL_POSTED_MONEY_DECIMAL_STRING_PRECISION_19_SCALE_4"
                ),
            })
        elif name == "lineDigest":
            field["validation"] = (
                "SHA256_OF_VERSIONED_DOMAIN_SEPARATED_RFC8785_LINE_VALUE_ARRAY_"
                "EXCLUDING_LINE_DIGEST_WITH_EXPLICIT_NULL_AND_CANONICAL_POSTED_MONEY"
            )
    header_fields = [
        {
            "name": name,
            "type": (
                "UUID" if name.endswith("Id") else
                "BIGINT" if name in {"snapshotRevision", "sourceVersion"} else
                "INTEGER" if name == "lineCount" else
                "DATE" if name in {"effectiveFrom", "effectiveTo"} else
                "SHA256" if name == "payloadDigest" else "STRING"
            ),
            "required": True,
            "sensitivity": "RESTRICTED",
        }
        for name in PAYROLL_SNAPSHOT_HEADER_FIELDS
    ]
    for field in header_fields:
        field["nullable"] = field["name"] == "effectiveTo"
        if field["name"] == "effectiveTo":
            field["nullEncoding"] = (
                "EXPLICIT_JSON_NULL_INCLUDED_IN_CANONICAL_DIGEST"
            )
    digest_canonicalization = {
        "contractVersion": "DWP_HRIS_PAYROLL_SNAPSHOT_DIGEST_V1",
        "hashAlgorithm": "SHA-256",
        "serialization": "RFC8785_JCS",
        "encoding": "UTF-8",
        "framing": (
            "UTF8(domainSeparator)||0x00||UTF8(RFC8785_JCS(canonicalValue))"
        ),
        "transportRepresentation": (
            "EXCLUDED_COMPRESSED_UNCOMPRESSED_AND_CHUNK_FRAMING_BYTES"
        ),
        "typedScalars": {
            "uuid": "LOWERCASE_RFC4122_HYPHENATED",
            "date": "ISO8601_FULL_DATE_YYYY-MM-DD",
            "bigint": (
                "NONNEGATIVE_INT64_CANONICAL_DECIMAL_STRING_0_TO_"
                "9223372036854775807_NO_PLUS_NO_LEADING_ZERO"
            ),
            "boundedInteger": "RFC8785_JSON_INTEGER_0_TO_100000",
            "nullable": "REQUIRED_FIELD_EXPLICIT_JSON_NULL_NEVER_ABSENT",
            "postedMoney": (
                "CANONICAL_DECIMAL_STRING_PRECISION_19_SCALE_4_NO_EXPONENT_"
                "NO_NEGATIVE_ZERO_NO_IMPLICIT_ROUNDING"
            ),
            "digestHex": "LOWERCASE_HEX_64",
        },
        "lineDigest": {
            "domainSeparator": "DWP.HRIS.PAYROLL.SNAPSHOT.LINE.V1",
            "canonicalValue": "JSON_ARRAY_IN_EXACT_FIELD_ORDER",
            "fieldOrder": [
                name for name in PAYROLL_SNAPSHOT_LINE_FIELDS
                if name != "lineDigest"
            ],
            "excludedFields": ["lineDigest"],
            "formula": (
                "SHA256(UTF8(domainSeparator)||0x00||UTF8(RFC8785_JCS("
                "fieldValueArray)))"
            ),
            "selfDigestInput": "FORBIDDEN",
        },
        "payloadDigest": {
            "domainSeparator": "DWP.HRIS.PAYROLL.SNAPSHOT.PAYLOAD.V1",
            "canonicalValue": (
                "JSON_ARRAY_[HEADER_VALUE_ARRAY,ORDERED_LINE_DIGEST_HEX_ARRAY]"
            ),
            "headerFieldOrder": [
                name for name in PAYROLL_SNAPSHOT_HEADER_FIELDS
                if name != "payloadDigest"
            ],
            "excludedHeaderFields": ["payloadDigest"],
            "lineDigestOrder": "lineSequence ASC CONTIGUOUS_FROM_1",
            "lineDigestEncoding": "LOWERCASE_HEX_64_RAW_DIGEST_TEXT",
            "lineCountBinding": (
                "header.lineCount IS_IN_HEADER_PREIMAGE_AND_EQUALS_DIGEST_LIST_COUNT"
            ),
            "formula": (
                "SHA256(UTF8(domainSeparator)||0x00||UTF8(RFC8785_JCS(["
                "headerValueArray,orderedLineDigestHexArray])))"
            ),
            "selfDigestInput": "FORBIDDEN",
        },
        "closedInputValidation": {
            "schema": "EXACT_NO_ADDITIONAL_FIELDS",
            "duplicateFieldNames": "REJECT",
            "missingRequiredFields": "REJECT",
            "lineSequence": "ONE_BASED_CONTIGUOUS_NO_GAP_NO_DUPLICATE",
            "lineCountMatch": "REQUIRED_BEFORE_DIGEST_ACCEPTANCE",
            "zeroLines": "REJECT_MIN_ITEMS_1",
            "oneLine": "ACCEPT_IF_ALL_VALIDATIONS_PASS",
            "oneHundredThousandLines": "ACCEPT_IF_ALL_VALIDATIONS_PASS",
            "aboveOneHundredThousandLines": (
                "REJECT_BEFORE_DIGEST_CALCULATION"
            ),
            "nullVsAbsent": (
                "DISTINCT_EFFECTIVE_TO_NULL_REQUIRED_FIELD_ABSENCE_REJECTED"
            ),
            "decimalAlternateSpelling": (
                "REJECT_NON_CANONICAL_BEFORE_DIGEST"
            ),
            "selfDigestInjection": (
                "REJECT_DIGEST_FIELDS_ARE_NEVER_PREIMAGE_MEMBERS"
            ),
        },
    }
    return _sealed_contract({
        "dependencyContractId": PAYROLL_SNAPSHOT_DEPENDENCY_ID,
        "kind": "READ_ONLY_OWNER_DEPENDENCY",
        "ownerSession": "HRIS-PER",
        "consumerSession": "HRIS-PAY",
        "ownerRuntime": "dwp-people-server",
        "consumerRuntime": "dwp-payroll-server",
        "transport": {
            "method": "GET",
            "path": (
                "/internal/hris-performance/v1/approved-compensation-plan-"
                "snapshots/{snapshotId}"
            ),
            "mode": "BOUNDED_STREAMING_HEADER_THEN_ORDERED_LINES",
            "gatewayBuffering": "FORBIDDEN_STREAM_THROUGH",
            "backpressure": "END_TO_END_REACTIVE_PULL_WITH_BOUNDED_QUEUES",
        },
        "requestSchema": {
            "schemaId": "ApprovedCompensationPlanSnapshotPayrollRefetch.Request.v1",
            "additionalProperties": False,
            "fields": request_fields,
            "exactTuple": (
                "verifiedTenantId+snapshotId+snapshotRevision+payloadDigest+"
                "verifiedPurposeCode"
            ),
            "callerTenantOverride": "FORBIDDEN",
        },
        "callerAuth": {
            "workloadAllowlist": ["spiffe://dwp/service/dwp-payroll-server"],
            "authentication": [
                "MTLS_SPIFFE_WORKLOAD_IDENTITY",
                "OAUTH2_CLIENT_CREDENTIAL_JWT_AUD_DWP_PEOPLE",
            ],
            "signedTenantClaim": "REQUIRED_EXACT_OWNER_TENANT",
            "audience": "dwp-people:approved-compensation-snapshot-refetch",
            "noCallerTenantOverride": True,
        },
        "pep": {
            "tenant": "signed tenant claim equals snapshot tenant",
            "purpose": PAYROLL_SNAPSHOT_PURPOSE,
            "population": "PAYROLL_INPUT_AUTHORIZED_WORKER_POPULATION_ONLY",
            "fieldPolicy": "MINIMUM_PAYROLL_INPUT_FIELDS_ONLY",
            "consumerSessionAllowlist": ["HRIS-PAY"],
            "reauthorizeEveryCall": True,
            "denyOnUnavailable": True,
        },
        "selectors": [
            {
                "source": "pathParameters.snapshotId",
                "targetTable": "prf_cmp_approved_snapshots",
                "targetColumn": "public_id", "operator": "=",
                "tenantFilter": "tenant_id=verifiedWorkloadContext.tenantId",
                "versionRule": "aggregate_version=query.snapshotRevision EXACT",
                "digestRule": "payload_digest=query.payloadDigest EXACT",
                "latestFallback": "FORBIDDEN",
                "cardinality": "EXACTLY_ONE_IMMUTABLE_REVISION",
            }
        ],
        "readPlan": {
            "tables": [
                "prf_cmp_approved_snapshots", "prf_cmp_approved_snapshot_lines",
            ],
            "headerSelector": (
                "tenant+snapshot public_id+aggregate_version+payload_digest"
            ),
            "lineJoin": "tenant_id+approved_snapshot_id",
            "lineOrder": "line_sequence ASC CONTIGUOUS_FROM_1",
            "immutableRevision": True,
            "latestFallback": "FORBIDDEN",
            "locking": "READ_ONLY_REPEATABLE_SNAPSHOT_NO_DOMAIN_LOCK_MUTATION",
        },
        "responseSchema": {
            "schemaId": "ApprovedCompensationPlanSnapshotPayrollRefetch.Response.v1",
            "additionalProperties": False,
            "headerFields": header_fields,
            "lines": {
                "type": "ARRAY_STREAM", "required": True,
                "minItems": 1, "maxItems": 100000,
                "itemAdditionalProperties": False,
                "itemFields": line_fields,
                "ordering": "lineSequence ASC contiguous from 1",
            },
        },
        "digestCanonicalization": digest_canonicalization,
        "streamingValidation": {
            "maxHeaderBytes": 65536, "maxLineBytes": 4096,
            "maxLineCount": 100000, "maxPayloadBytes": 536870912,
            "maxCompressedPayloadBytes": 134217728,
            "maxUncompressedPayloadBytes": 536870912,
            "maxCompressionRatio": 100,
            "byteAccounting": (
                "COUNT_COMPRESSED_AND_STREAMING_DECOMPRESSED_BYTES_BEFORE_ALLOCATION"
            ),
            "count": "lineCount equals fully consumed line count",
            "sequence": "lineSequence equals one-based stream ordinal no gaps/duplicates",
            "digest": (
                "digestCanonicalization.payloadDigest formula equals requested "
                "payloadDigest; every lineDigest equals the "
                "digestCanonicalization.lineDigest formula; payloadDigest and lineDigest "
                "self fields plus transport/compression bytes are excluded from preimages"
            ),
            "failure": "ROLLBACK_STAGED_ROWS_AND_QUARANTINE_WHOLE_SNAPSHOT",
        },
        "privacy": {
            "eventCarriesLines": False,
            "minimumDisclosure": "ONLY_FIELDS_REQUIRED_TO_FREEZE_PAYROLL_INPUT",
            "arbitraryFieldExpansion": "FORBIDDEN",
            "logging": "NO_LINE_VALUES_NO_PAY_AMOUNTS_NO_WORKER_IDENTIFIERS",
        },
        "idempotency": {
            "mode": "READ_IDEMPOTENT_EXACT_REVISION",
            "cacheKey": (
                "tenantId:snapshotId:snapshotRevision:payloadDigest:purposeCode"
            ),
            "consumerLedger": (
                "tenantId:snapshotId:snapshotRevision:payloadDigest UNIQUE"
            ),
            "replay": "BYTE_EQUIVALENT_STREAM_OR_FAIL_CLOSED",
        },
        "orderedDml": [],
        "writes": "FORBIDDEN",
        "receiptAndOutbox": "FORBIDDEN_READ_ONLY_DEPENDENCY",
        "pagination": {
            "mode": "IMMUTABLE_REVISION_STREAM_NOT_OFFSET_PAGE",
            "arbitraryOffset": "FORBIDDEN",
            "cursor": "NOT_REQUIRED_SINGLE_BOUNDED_STREAM",
        },
        "latestFallback": "FORBIDDEN",
    })


def _compensation_payroll_event_refetch() -> dict[str, Any]:
    dependency = _compensation_payroll_owner_dependency()
    return {
        "mode": "EXACT_OWNER_DEPENDENCY",
        "dependencyContractId": dependency["dependencyContractId"],
        "dependencyContractSha256": dependency["sealedPayloadSha256"],
        "ownerSession": "HRIS-PER",
        "consumerSessionAllowlist": ["HRIS-PAY"],
        "purpose": PAYROLL_SNAPSHOT_PURPOSE,
        "selectorTuple": [
            "eventEnvelope.tenantId", "event.snapshotId", "event.snapshotRevision",
            "event.payloadDigest", "CONSTANT:" + PAYROLL_SNAPSHOT_PURPOSE,
        ],
        "tenantBinding": {
            "eventEnvelopeTenant": "eventEnvelope.tenantId",
            "signedWorkloadTenant": "verifiedWorkloadContext.tenantId",
            "ownerRowTenant": "prf_cmp_approved_snapshots.tenant_id",
            "equality": "ALL_THREE_REQUIRED_EQUAL",
        },
        "payloadSufficiency": "HEADER_DIGEST_INVALIDATION_TRIGGER_ONLY_NO_PAY_LINES",
        "response": "BOUNDED_STREAMING_HEADER_PLUS_1_TO_100000_ORDERED_LINES",
        "version": "event.snapshotRevision exact immutable revision",
        "digest": "event.payloadDigest exact complete-stream digest",
        "latestFallback": "FORBIDDEN",
        "pep": {
            "tenant": (
                "eventEnvelope.tenantId equals signed workload tenant and owner row tenant"
            ),
            "purpose": [PAYROLL_SNAPSHOT_PURPOSE],
            "population": "PAYROLL_INPUT_AUTHORIZED_WORKER_POPULATION_ONLY",
            "fieldExposure": [
                *PAYROLL_SNAPSHOT_HEADER_FIELDS, "lines",
                *("lines[]." + field for field in PAYROLL_SNAPSHOT_LINE_FIELDS),
            ],
            "reauthorizeEveryCall": True,
            "denyOnUnavailable": True,
        },
    }


def _compensation_payroll_consumer_field_exposure(
    event: dict[str, Any],
) -> dict[str, Any]:
    full_owner_fields = [field["name"] for field in event.get("fields", [])]
    if not set(PAYROLL_SNAPSHOT_PAY_EVENT_FIELDS) <= set(full_owner_fields):
        raise ValueError("PAY minimal snapshot trigger fields are unavailable")
    return {
        "HRIS-PAY": {
            "purpose": [PAYROLL_SNAPSHOT_PURPOSE],
            "mode": "EXACT_ALLOWLIST",
            "fields": list(PAYROLL_SNAPSHOT_PAY_EVENT_FIELDS),
        },
        "HRIS-PER": {
            "purpose": ["COMPENSATION_PLAN_PUBLISH"],
            "mode": "EXACT_ALLOWLIST",
            "fields": full_owner_fields,
        },
    }


def _apply_compensation_payroll_event_audience(event: dict[str, Any]) -> None:
    """Separate PAY's trigger-only view from PER's full owner event view."""
    audience = event["audience"]
    audience["allowedConsumerSessions"] = sorted(set([
        *audience["allowedConsumerSessions"], "HRIS-PAY",
    ]))
    audience["allowedPurposes"] = sorted(set([
        *audience["allowedPurposes"], PAYROLL_SNAPSHOT_PURPOSE,
    ]))
    audience["consumerFieldExposure"] = (
        _compensation_payroll_consumer_field_exposure(event)
    )

RECEIPT_TABLE = {
    "HRIS-HRM": "ppl_command_receipts",
    "HRIS-PER": "prf_command_receipts",
    "HRIS-TIM": "tme_command_receipts",
    "HRIS-SYS": "sys_hris_command_receipts",
}
OUTBOX_TABLE = {
    "HRIS-HRM": "sys_people_outbox_events",
    "HRIS-PER": "prf_outbox_events",
    "HRIS-TIM": "tme_outbox_events",
    "HRIS-SYS": "sys_hris_outbox_events",
}
INBOX_TABLE = {
    "HRIS-HRM": "ppl_domain_inbox_receipts",
    "HRIS-PER": "prf_domain_inbox_receipts",
    "HRIS-TIM": "tme_domain_inbox_receipts",
    "HRIS-SYS": "sys_hris_domain_inbox_receipts",
}

STATE_COLUMNS = {
    "ppl_rec_requisitions": "status",
    "ppl_rec_candidate_cases": "stage",
    "ppl_rec_offers": "status",
    "ppl_rec_hire_requests": "status",
    "ppl_jny_template_versions": "state",
    "ppl_jny_assignment_tasks": "state",
    "ppl_wfp_scenarios": "state",
    "ppl_bnf_plan_versions": "state",
    "ppl_bnf_enrollments": "state",
    "ppl_bnf_life_events": "state",
    "ppl_hrs_cases": "state",
    "ppl_cwk_engagements": "state",
    "prf_skl_taxonomy_versions": "state",
    "prf_skl_worker_evidence": "state",
    "prf_grw_profiles": "state",
    "prf_grw_portability_export_receipts": "state",
    "prf_lrn_offerings": "state",
    "prf_lrn_assignments": "state",
    "prf_mkt_opportunities": "state",
    "prf_mkt_applications": "state",
    "prf_suc_plans": "state",
    "prf_suc_nominations": "state",
    "prf_cmp_cycles": "state",
    "prf_cmp_proposals": "state",
    "tme_wfm_optimization_requests": "state",
    "tme_wfm_schedule_candidates": "state",
    "sys_hris_listening_survey_versions": "state",
    "sys_hris_metric_versions": "state",
    "sys_hris_metric_projection_requests": "state",
    "sys_hris_analytics_export_receipts": "state",
    "sys_hris_ai_policy_versions": "state",
    "sys_hris_ai_evaluation_requests": "state",
    "sys_hris_ai_assistance_requests": "state",
}

PATH_IDENTITIES = {
    "requisitionId": "ppl_rec_requisitions",
    "candidateCaseId": "ppl_rec_candidate_cases",
    "offerId": "ppl_rec_offers",
    "hireRequestId": "ppl_rec_hire_requests",
    "templateId": "ppl_jny_templates",
    "assignmentId": "ppl_jny_assignments",
    "taskId": "ppl_jny_assignment_tasks",
    "scenarioId": "ppl_wfp_scenarios",
    "enrollmentId": "ppl_bnf_enrollments",
    "lifeEventId": "ppl_bnf_life_events",
    "caseId": "ppl_hrs_cases",
    "engagementId": "ppl_cwk_engagements",
    "taxonomyId": "prf_skl_taxonomies",
    "evidenceId": "prf_skl_worker_evidence",
    "profileId": "prf_grw_profiles",
    "evidenceLinkId": "prf_grw_evidence_links",
    "offeringId": "prf_lrn_offerings",
    "opportunityId": "prf_mkt_opportunities",
    "applicationId": "prf_mkt_applications",
    "nominationId": "prf_suc_nominations",
    "cycleId": "prf_cmp_cycles",
    "proposalId": "prf_cmp_proposals",
    "forecastId": "tme_wfm_demand_forecasts",
    "optimizationId": "tme_wfm_optimization_requests",
    "candidateId": "tme_wfm_schedule_candidates",
    "surveyId": "sys_hris_listening_surveys",
    "metricId": "sys_hris_metric_definitions",
    "projectionId": "sys_hris_metric_projections",
    "evaluationId": "sys_hris_ai_evaluation_requests",
    "assistanceId": "sys_hris_ai_assistance_requests",
}

# Re-entry is aggregate-specific.  A capability-wide query silently returned a
# different aggregate for child events (offer, assignment task, request, etc.).
# Where the fixed 199-operation surface has no exact public detail query the
# event explicitly forbids refetch instead of pretending that a broad list or
# parent query can re-enter the fact.
DETAIL_QUERY_BY_ENTITY = {
    "table:ppl_rec_requisitions": "modern.recruiting.requisition.query",
    "table:ppl_rec_candidate_cases": "modern.recruiting.candidate.query",
    "table:ppl_jny_assignments": "modern.onboarding.assignment.query",
    "table:ppl_wfp_scenarios": "modern.workforceplan.scenario.query",
    "table:ppl_bnf_enrollments": "modern.benefits.enrollment.query",
    "table:ppl_bnf_life_events": "modern.benefits.lifeevent.query",
    "table:ppl_hrs_cases": "modern.hrservice.case.query",
    "table:ppl_cwk_engagements": "modern.contingent.engagement.query",
    "table:prf_skl_taxonomies": "modern.skills.taxonomy.query",
    "table:prf_skl_worker_evidence": "modern.skills.evidence.query",
    "table:prf_grw_profiles": "modern.growth.profile.query",
    "table:prf_grw_portability_export_receipts": "modern.growth.export.query",
    "table:prf_lrn_offerings": "modern.learning.offering.query",
    "table:prf_lrn_assignments": "modern.learning.assignment.query",
    "table:prf_mkt_opportunities": "modern.opportunity.query",
    "table:prf_mkt_applications": "modern.opportunity.application.query",
    "table:prf_suc_plans": "modern.succession.plan.query",
    "table:prf_cmp_cycles": "modern.compplan.cycle.query",
    "table:prf_cmp_proposals": "modern.compplan.proposal.query",
    "table:tme_wfm_demand_forecasts": "modern.wfm.forecast.query",
    "table:tme_wfm_optimization_requests": "modern.wfm.optimization.query",
    "table:tme_wfm_schedule_candidates": "modern.wfm.candidate.query",
    "table:sys_hris_metric_definitions": "modern.analytics.metric.query",
    "table:sys_hris_analytics_export_receipts": "modern.analytics.export.query",
    "table:sys_hris_ai_use_policies": "modern.ai.policy.query",
    "table:sys_hris_ai_evaluation_requests": "modern.ai.evaluation.query",
    "table:sys_hris_ai_assistance_requests": "modern.ai.assistance.query",
}


# Frozen v1 public-route authority.  These are exact corrections from the
# reviewed taxonomy, not aliases and not a v2 surface expansion.
ROUTE_OVERRIDES = {
    "modern.ai.assist.cancel": ("/api/platform/v1/hris/ai-assistance/{assistanceId}/cancel", "POST", "hcm.ai.assist.use"),
    "modern.ai.assist.review": ("/api/platform/v1/hris/ai-assistance/{assistanceId}/review", "POST", "hcm.ai.assist.use"),
    "modern.ai.assist.revoke": ("/api/platform/v1/hris/ai-assistance/{assistanceId}/revoke", "POST", "hcm.ai.assist.use"),
    "modern.ai.assistance.query": ("/api/platform/v1/hris/ai-assistance/{assistanceId}", "GET", "hcm.ai.assist.use"),
    "modern.ai.assistances.query": ("/api/platform/v1/hris/ai-assistance", "GET", "hcm.ai.assist.use"),
    "modern.ai.evaluation.cancel": ("/api/platform/v1/admin/hris/ai-governance/evaluations/{evaluationId}/cancel", "POST", "hcm.ai.policy.manage"),
    "modern.ai.evaluation.query": ("/api/platform/v1/admin/hris/ai-governance/evaluations/{evaluationId}", "GET", "hcm.ai.policy.manage"),
    "modern.ai.evaluations.query": ("/api/platform/v1/admin/hris/ai-governance/evaluations", "GET", "hcm.ai.policy.manage"),
    "modern.ai.policy.query": ("/api/platform/v1/admin/hris/ai-governance/policies/{policyId}", "GET", "hcm.ai.policy.manage"),
    "modern.ai.policy.revise": ("/api/platform/v1/admin/hris/ai-governance/policies/{policyId}/revisions", "POST", "hcm.ai.policy.manage"),
    "modern.analytics.export.cancel": ("/api/platform/v1/admin/hris/people-analytics/exports/{exportId}/cancel", "POST", "hcm.analytics.export"),
    "modern.analytics.export.query": ("/api/platform/v1/admin/hris/people-analytics/exports/{exportId}", "GET", "hcm.analytics.export"),
    "modern.analytics.exports.query": ("/api/platform/v1/admin/hris/people-analytics/exports", "GET", "hcm.analytics.export"),
    "modern.analytics.metric.query": ("/api/platform/v1/admin/hris/people-analytics/metrics/{metricId}", "GET", "hcm.analytics.metric.view"),
    "modern.analytics.metric.revise": ("/api/platform/v1/admin/hris/people-analytics/metrics/{metricId}/revisions", "POST", "hcm.analytics.metric.manage"),
    "modern.analytics.projection.query": ("/api/platform/v1/admin/hris/people-analytics/projections/{projectionId}", "GET", "hcm.analytics.metric.view"),
    "modern.analytics.projection.request": ("/api/platform/v1/admin/hris/people-analytics/metrics/{metricId}/projections", "POST", "hcm.analytics.export"),
    "modern.analytics.projections.query": ("/api/platform/v1/admin/hris/people-analytics/projections", "GET", "hcm.analytics.metric.view"),
    "modern.benefits.lifeevent.decide": ("/api/people/v1/hris/benefits/life-events/{lifeEventId}/decisions", "POST", "hcm.benefits.operate"),
    "modern.benefits.plan.query": ("/api/people/v1/hris/benefits/plans/{planId}", "GET", "hcm.benefits.operate"),
    "modern.benefits.plans.query": ("/api/people/v1/hris/benefits/plans", "GET", "hcm.benefits.operate"),
    "modern.compplan.cycle.cancel": ("/api/people/v1/hris/performance/compensation-planning/cycles/{cycleId}/cancel", "POST", "hcm.compensation.plan.propose"),
    "modern.compplan.cycle.query": ("/api/people/v1/hris/performance/compensation-planning/cycles/{cycleId}", "GET", "hcm.compensation.plan.view"),
    "modern.compplan.cycle.revise": ("/api/people/v1/hris/performance/compensation-planning/cycles/{cycleId}/revisions", "POST", "hcm.compensation.plan.propose"),
    "modern.compplan.proposal.query": ("/api/people/v1/hris/performance/compensation-planning/proposals/{proposalId}", "GET", "hcm.compensation.plan.view"),
    "modern.compplan.proposal.upsert": ("/api/people/v1/hris/performance/compensation-planning/cycles/{cycleId}/proposals/{proposalId}", "POST", "hcm.compensation.plan.propose"),
    "modern.compplan.proposals.query": ("/api/people/v1/hris/performance/compensation-planning/cycles/{cycleId}/proposals", "GET", "hcm.compensation.plan.view"),
    "modern.contingent.engagement.query": ("/api/people/v1/hris/contingent-workforce/engagements/{engagementId}", "GET", "hcm.contingent.view"),
    "modern.contingent.engagement.reject": ("/api/people/v1/hris/contingent-workforce/engagements/{engagementId}/reject", "POST", "hcm.contingent.operate"),
    "modern.contingent.engagement.revise": ("/api/people/v1/hris/contingent-workforce/engagements/{engagementId}/revisions", "POST", "hcm.contingent.operate"),
    "modern.contingent.sponsor.reassign": ("/api/people/v1/hris/contingent-workforce/engagements/{engagementId}/sponsor", "POST", "hcm.contingent.operate"),
    "modern.growth.evidence.unlink": ("/api/people/v1/hris/performance/growth-profiles/{profileId}/evidence-links/{evidenceLinkId}/unlink", "POST", "hcm.growth.self.manage"),
    "modern.growth.export.cancel": ("/api/people/v1/hris/performance/growth-profiles/exports/{exportId}/cancel", "POST", "hcm.growth.self.manage"),
    "modern.growth.export.query": ("/api/people/v1/hris/performance/growth-profiles/exports/{exportId}", "GET", "hcm.growth.self.view"),
    "modern.growth.export.request": ("/api/people/v1/hris/performance/growth-profiles/{profileId}/exports", "POST", "hcm.growth.self.manage"),
    "modern.growth.exports.query": ("/api/people/v1/hris/performance/growth-profiles/exports", "GET", "hcm.growth.self.view"),
    "modern.growth.profile.query": ("/api/people/v1/hris/performance/growth-profiles/{profileId}", "GET", "hcm.growth.self.view"),
    "modern.growth.profiles.query": ("/api/people/v1/hris/performance/growth-profiles", "GET", "hcm.growth.self.view"),
    "modern.hrservice.case.cancel": ("/api/people/v1/hris/hr-services/cases/{caseId}/cancel", "POST", "hcm.hrservice.case.work"),
    "modern.hrservice.cases.query": ("/api/people/v1/hris/hr-services/cases", "GET", "hcm.hrservice.case.work"),
    "modern.learning.assignment.cancel": ("/api/people/v1/hris/performance/learning/assignments/{assignmentId}/cancel", "POST", "hcm.learning.self.enroll"),
    "modern.learning.assignment.create": ("/api/people/v1/hris/performance/learning/assignments", "POST", "hcm.learning.self.enroll"),
    "modern.learning.assignment.query": ("/api/people/v1/hris/performance/learning/assignments/{assignmentId}", "GET", "hcm.learning.self.view"),
    "modern.learning.assignments.query": ("/api/people/v1/hris/performance/learning/assignments", "GET", "hcm.learning.self.view"),
    "modern.learning.offering.query": ("/api/people/v1/hris/performance/learning/offerings/{offeringId}", "GET", "hcm.learning.self.view"),
    "modern.learning.offering.retire": ("/api/people/v1/hris/performance/learning/offerings/{offeringId}/retire", "POST", "hcm.learning.operate"),
    "modern.learning.offering.revise": ("/api/people/v1/hris/performance/learning/offerings/{offeringId}/revisions", "POST", "hcm.learning.operate"),
    "modern.listening.cohorts.query": ("/api/platform/v1/admin/hris/listening/surveys/{surveyId}/cohort-projections", "GET", "hcm.listening.cohort.view"),
    "modern.listening.survey.revise": ("/api/platform/v1/admin/hris/listening/surveys/{surveyId}", "PATCH", "hcm.listening.manage"),
    "modern.listening.surveys.query": ("/api/platform/v1/admin/hris/listening/surveys", "GET", "hcm.listening.manage"),
    "modern.onboarding.assignment.query": ("/api/people/v1/hris/onboarding/journey-assignments/{assignmentId}", "GET", "hcm.onboarding.self.view"),
    "modern.onboarding.assignments.query": ("/api/people/v1/hris/onboarding/journey-assignments", "GET", "hcm.onboarding.self.view"),
    "modern.onboarding.task.waive": ("/api/people/v1/hris/onboarding/journey-assignments/{assignmentId}/tasks/{taskId}/waive", "POST", "hcm.onboarding.task.complete"),
    "modern.opportunity.application.query": ("/api/people/v1/hris/performance/opportunities/applications/{applicationId}", "GET", "hcm.opportunity.self.view"),
    "modern.opportunity.application.withdraw": ("/api/people/v1/hris/performance/opportunities/applications/{applicationId}/withdraw", "POST", "hcm.opportunity.operate"),
    "modern.opportunity.applications.query": ("/api/people/v1/hris/performance/opportunities/applications", "GET", "hcm.opportunity.self.view"),
    "modern.opportunity.cancel": ("/api/people/v1/hris/performance/opportunities/{opportunityId}/cancel", "POST", "hcm.opportunity.operate"),
    "modern.opportunity.close": ("/api/people/v1/hris/performance/opportunities/{opportunityId}/close", "POST", "hcm.opportunity.operate"),
    "modern.opportunity.query": ("/api/people/v1/hris/performance/opportunities/{opportunityId}", "GET", "hcm.opportunity.self.view"),
    "modern.opportunity.revise": ("/api/people/v1/hris/performance/opportunities/{opportunityId}/revisions", "POST", "hcm.opportunity.operate"),
    "modern.recruiting.candidate.query": ("/api/people/v1/hris/recruiting/candidate-cases/{candidateCaseId}", "GET", "hcm.recruiting.view"),
    "modern.recruiting.candidates.query": ("/api/people/v1/hris/recruiting/candidate-cases", "GET", "hcm.recruiting.view"),
    "modern.skills.evidence.query": ("/api/people/v1/hris/performance/skills/evidence/{evidenceId}", "GET", "hcm.skills.view"),
    "modern.skills.evidence.record": ("/api/people/v1/hris/performance/skills/evidence", "POST", "hcm.skills.evidence.verify"),
    "modern.skills.evidence.revoke": ("/api/people/v1/hris/performance/skills/evidence/{evidenceId}/revoke", "POST", "hcm.skills.evidence.verify"),
    "modern.skills.evidences.query": ("/api/people/v1/hris/performance/skills/evidence", "GET", "hcm.skills.view"),
    "modern.skills.taxonomy.query": ("/api/people/v1/hris/performance/skills/taxonomies/{taxonomyId}", "GET", "hcm.skills.view"),
    "modern.skills.taxonomy.retire": ("/api/people/v1/hris/performance/skills/taxonomies/{taxonomyId}/retire", "POST", "hcm.skills.manage"),
    "modern.skills.taxonomy.revise": ("/api/people/v1/hris/performance/skills/taxonomies/{taxonomyId}/revisions", "POST", "hcm.skills.manage"),
    "modern.succession.nomination.withdraw": ("/api/people/v1/hris/performance/succession/plans/{planId}/nominations/{nominationId}/withdraw", "POST", "hcm.succession.manage"),
    "modern.succession.plan.query": ("/api/people/v1/hris/performance/succession/plans/{planId}", "GET", "hcm.succession.view.restricted"),
    "modern.succession.plan.reject": ("/api/people/v1/hris/performance/succession/plans/{planId}/reject", "POST", "hcm.succession.publish"),
    "modern.succession.plan.retire": ("/api/people/v1/hris/performance/succession/plans/{planId}/retire", "POST", "hcm.succession.publish"),
    "modern.succession.plan.revise": ("/api/people/v1/hris/performance/succession/plans/{planId}/revisions", "POST", "hcm.succession.manage"),
    "modern.succession.readiness.record": ("/api/people/v1/hris/performance/succession/plans/{planId}/readiness-evidence", "POST", "hcm.succession.manage"),
    "modern.wfm.candidate.query": ("/api/time/v1/workforce-management/schedule-candidates/{candidateId}", "GET", "hcm.wfm.view"),
    "modern.wfm.candidates.query": ("/api/time/v1/workforce-management/schedule-candidates", "GET", "hcm.wfm.view"),
    "modern.wfm.forecast.query": ("/api/time/v1/workforce-management/demand-forecasts/{forecastId}", "GET", "hcm.wfm.view"),
    "modern.wfm.optimization.cancel": ("/api/time/v1/workforce-management/schedule-optimizations/{optimizationId}/cancel", "POST", "hcm.wfm.optimize"),
    "modern.wfm.optimization.query": ("/api/time/v1/workforce-management/schedule-optimizations/{optimizationId}", "GET", "hcm.wfm.view"),
    "modern.wfm.schedule.cancel": ("/api/time/v1/workforce-management/schedule-candidates/{candidateId}/cancel", "POST", "hcm.wfm.optimize"),
}


# Closed business deltas for operations that cannot be derived from a path,
# CAS header, or lifecycle transition.  Tuple members are
# (field, wire type, reference entity or None, persistence table, column).
BUSINESS_INPUT_SPECS = {
    "modern.listening.survey.create": (
        ("formVersionRef", "UUID", "DWP.Listening.FormVersion", "sys_hris_listening_survey_versions", "form_version_public_id"),
        ("privacyVersionRef", "UUID", "DWP.Listening.PrivacyPolicyVersion", "sys_hris_listening_survey_versions", "privacy_version_public_id"),
        ("retentionVersionRef", "UUID", "DWP.Listening.RetentionPolicyVersion", "sys_hris_listening_survey_versions", "retention_version_public_id"),
        ("questions", "ARRAY", None, "sys_hris_listening_survey_versions", "question_definitions"),
        ("contentSha256", "SHA256", None, "sys_hris_listening_survey_versions", "content_sha256"),
    ),
    "modern.analytics.metric.revise": (
        ("displayName", "STRING", None, "sys_hris_metric_definitions", "display_name"),
        ("effectiveFrom", "TIMESTAMPTZ", None, "sys_hris_metric_versions", "effective_from"),
        ("effectiveTo", "TIMESTAMPTZ", None, "sys_hris_metric_versions", "effective_to"),
        ("definitionDigest", "SHA256", None, "sys_hris_metric_versions", "definition_digest"),
        ("lineageDigest", "SHA256", None, "sys_hris_metric_versions", "lineage_digest"),
    ),
    "modern.analytics.projection.request": (
        ("asOf", "TIMESTAMPTZ", None, "sys_hris_metric_projection_requests", "as_of"),
        ("cohortDefinitionId", "UUID", "DWP.Analytics.CohortDefinitionVersion", "sys_hris_metric_projection_requests", "cohort_definition_public_id"),
        ("anonymityThreshold", "INTEGER", None, "sys_hris_metric_projection_requests", "anonymity_threshold"),
    ),
    "modern.benefits.plan.revise": (
        ("displayName", "STRING", None, "ppl_bnf_plans", "display_name"),
        ("effectiveFrom", "DATE", None, "ppl_bnf_plan_versions", "effective_from"),
        ("effectiveTo", "DATE", None, "ppl_bnf_plan_versions", "effective_to"),
        ("eligibilityPolicyVersionId", "UUID", "DWP.Benefits.EligibilityPolicyVersion", "ppl_bnf_plan_versions", "eligibility_policy_version_id"),
        ("coverageOptions", "ARRAY", None, "ppl_bnf_plan_versions", "coverage_options"),
    ),
    "modern.compplan.cycle.revise": (
        ("displayName", "STRING", None, "prf_cmp_cycles", "display_name"),
        ("effectiveFrom", "DATE", None, "prf_cmp_cycles", "effective_from"),
        ("effectiveTo", "DATE", None, "prf_cmp_cycles", "effective_to"),
        ("guidelinePolicyVersionId", "UUID", "DWP.Compensation.GuidelinePolicyVersion", "prf_cmp_cycles", "guideline_policy_version_id"),
        ("populationSnapshotId", "UUID", "DWP.Population.ImmutableSnapshot", "prf_cmp_cycles", "population_snapshot_id"),
    ),
    "modern.compplan.proposal.upsert": (
        ("workerPublicId", "UUID", "HRM.Worker", "prf_cmp_proposals", "worker_public_id"),
        ("componentCode", "STRING", None, "prf_cmp_proposals", "component_code"),
        ("amount", "DECIMAL", None, "prf_cmp_proposals", "amount"),
        ("currencyCode", "STRING", None, "prf_cmp_proposals", "currency_code"),
        ("effectiveDate", "DATE", None, "prf_cmp_proposals", "effective_date"),
    ),
    "modern.contingent.engagement.revise": (
        ("displayName", "STRING", None, "ppl_cwk_engagements", "display_name"),
        ("effectiveFrom", "DATE", None, "ppl_cwk_engagements", "effective_from"),
        ("effectiveTo", "DATE", None, "ppl_cwk_engagements", "effective_to"),
        ("vendorPublicId", "UUID", "HRM.ContingentVendor", "ppl_cwk_engagements", "vendor_public_id"),
        ("sponsorWorkerPublicId", "UUID", "HRM.Worker", "ppl_cwk_engagements", "sponsor_worker_public_id"),
    ),
    "modern.contingent.sponsor.reassign": (
        ("sponsorWorkerPublicId", "UUID", "HRM.Worker", "ppl_cwk_sponsor_assignments", "sponsor_worker_public_id"),
        ("effectiveAt", "TIMESTAMPTZ", None, "ppl_cwk_sponsor_assignments", "valid_from"),
        ("reasonCode", "STRING", None, "ppl_cwk_engagements", "last_reason_code"),
    ),
    "modern.learning.assignment.create": (
        ("offeringId", "UUID", "table:prf_lrn_offerings", "prf_lrn_assignments", "learning_offering_id"),
        ("workerPublicId", "UUID", "HRM.Worker", "prf_lrn_assignments", "worker_public_id"),
        ("effectiveFrom", "DATE", None, "prf_lrn_assignments", "effective_from"),
        ("consentRevision", "BIGINT", None, "prf_lrn_assignments", "consent_revision"),
    ),
    "modern.learning.offering.revise": (
        ("displayName", "STRING", None, "prf_lrn_offerings", "display_name"),
        ("effectiveFrom", "DATE", None, "prf_lrn_offerings", "valid_from"),
        ("effectiveTo", "DATE", None, "prf_lrn_offerings", "valid_to"),
        ("providerPublicId", "UUID", "DWP.Learning.Provider", "prf_lrn_offerings", "provider_public_id"),
        ("contentDigest", "SHA256", None, "prf_lrn_offerings", "content_digest"),
    ),
    "modern.listening.survey.revise": (
        ("displayName", "STRING", None, "sys_hris_listening_surveys", "display_name"),
        ("formVersionRef", "UUID", "DWP.Listening.FormVersion", "sys_hris_listening_survey_versions", "form_version_public_id"),
        ("privacyVersionRef", "UUID", "DWP.Listening.PrivacyPolicyVersion", "sys_hris_listening_survey_versions", "privacy_version_public_id"),
        ("retentionVersionRef", "UUID", "DWP.Listening.RetentionPolicyVersion", "sys_hris_listening_survey_versions", "retention_version_public_id"),
        ("opensAt", "TIMESTAMPTZ", None, "sys_hris_listening_surveys", "opens_at"),
        ("closesAt", "TIMESTAMPTZ", None, "sys_hris_listening_surveys", "closes_at"),
        ("contentSha256", "SHA256", None, "sys_hris_listening_survey_versions", "content_sha256"),
    ),
    "modern.onboarding.task.waive": (
        ("waiverCode", "STRING", None, "ppl_jny_task_evidence", "completion_code"),
        ("evidenceDigest", "SHA256", None, "ppl_jny_task_evidence", "evidence_digest"),
        ("objectRef", "UUID", "DWP.Content.SecuredArtifactVersion", "ppl_jny_task_evidence", "object_ref"),
        ("waivedAt", "TIMESTAMPTZ", None, "ppl_jny_task_evidence", "recorded_at"),
    ),
    "modern.onboarding.template.revise": (
        ("displayName", "STRING", None, "ppl_jny_templates", "display_name"),
        ("effectiveFrom", "DATE", None, "ppl_jny_template_versions", "effective_from"),
        ("effectiveTo", "DATE", None, "ppl_jny_template_versions", "effective_to"),
        ("configScopePublicId", "UUID", "DWP.Configuration.ScopeVersion", "ppl_jny_template_versions", "config_scope_public_id"),
        ("tasks", "ARRAY", None, "ppl_jny_template_versions", "task_definitions"),
        ("contentDigest", "SHA256", None, "ppl_jny_template_versions", "content_digest"),
    ),
    "modern.opportunity.revise": (
        ("displayName", "STRING", None, "prf_mkt_opportunities", "display_name"),
        ("ownerOrgPublicId", "UUID", "HRM.Organization", "prf_mkt_opportunities", "owner_org_public_id"),
        ("openFrom", "TIMESTAMPTZ", None, "prf_mkt_opportunities", "open_from"),
        ("closeAt", "TIMESTAMPTZ", None, "prf_mkt_opportunities", "close_at"),
        ("contentDigest", "SHA256", None, "prf_mkt_opportunities", "content_digest"),
    ),
    "modern.recruiting.candidate.admit": (
        ("sourceCandidateKey", "STRING", None, "ppl_rec_candidate_cases", "source_candidate_key"),
        ("sourceSystemId", "UUID", "DWP.Integration.SourceSystem", "ppl_rec_candidate_cases", "source_system_id"),
        ("candidatePersonToken", "STRING", None, "ppl_rec_candidate_cases", "candidate_person_token"),
    ),
    "modern.recruiting.requisition.revise": (
        ("positionPublicId", "UUID", "HRM.Position", "ppl_rec_requisitions", "position_public_id"),
        ("title", "STRING", None, "ppl_rec_requisitions", "title"),
        ("employmentType", "STRING", None, "ppl_rec_requisitions", "employment_type"),
        ("targetStartDate", "DATE", None, "ppl_rec_requisitions", "target_start_date"),
        ("organizationPublicId", "UUID", "HRM.Organization", "ppl_rec_requisitions", "organization_public_id"),
        ("contentDigest", "SHA256", None, "ppl_rec_requisitions", "content_digest"),
    ),
    "modern.skills.evidence.record": (
        ("workerPublicId", "UUID", "HRM.Worker", "prf_skl_worker_evidence", "worker_public_id"),
        ("skillPublicId", "UUID", "table:prf_skl_skill_nodes", "prf_skl_worker_evidence", "skill_public_id"),
        ("proficiencyLevel", "INTEGER", None, "prf_skl_worker_evidence", "proficiency_level"),
        ("sourceKey", "STRING", None, "prf_skl_worker_evidence", "source_key"),
        ("sourceRevision", "BIGINT", None, "prf_skl_worker_evidence", "source_revision"),
        ("evidenceDigest", "SHA256", None, "prf_skl_worker_evidence", "evidence_digest"),
        ("observedAt", "TIMESTAMPTZ", None, "prf_skl_worker_evidence", "observed_at"),
    ),
    "modern.skills.taxonomy.revise": (
        ("effectiveFrom", "TIMESTAMPTZ", None, "prf_skl_taxonomy_versions", "effective_from"),
        ("effectiveTo", "TIMESTAMPTZ", None, "prf_skl_taxonomy_versions", "effective_to"),
        ("contentDigest", "SHA256", None, "prf_skl_taxonomy_versions", "content_digest"),
        ("nodes", "ARRAY", None, "prf_skl_skill_nodes", "typed_node_rows"),
        ("edges", "ARRAY", None, "prf_skl_skill_edges", "typed_edge_rows"),
        ("proficiencyLevels", "ARRAY", None, "prf_skl_proficiency_levels", "typed_level_rows"),
    ),
    "modern.succession.plan.revise": (
        ("displayName", "STRING", None, "prf_suc_plans", "display_name"),
        ("effectiveFrom", "DATE", None, "prf_suc_plans", "valid_from"),
        ("effectiveTo", "DATE", None, "prf_suc_plans", "valid_to"),
        ("audiencePolicyId", "UUID", "DWP.Authorization.AudiencePolicyVersion", "prf_suc_plans", "audience_policy_id"),
        ("keyPositionPublicId", "UUID", "HRM.Position", "prf_suc_plans", "key_position_public_id"),
        ("contentDigest", "SHA256", None, "prf_suc_plans", "content_digest"),
    ),
    "modern.succession.readiness.record": (
        ("nominationId", "UUID", "table:prf_suc_nominations", "prf_suc_readiness_evidence", "succession_nomination_id"),
        ("evidencePublicId", "UUID", "DWP.Evidence.ImmutableArtifactVersion", "prf_suc_readiness_evidence", "evidence_public_id"),
        ("evidenceDigest", "SHA256", None, "prf_suc_readiness_evidence", "evidence_digest"),
        ("sourceRevision", "BIGINT", None, "prf_suc_readiness_evidence", "source_revision"),
        ("recordedAt", "TIMESTAMPTZ", None, "prf_suc_readiness_evidence", "recorded_at"),
    ),
    "modern.workforceplan.scenario.revise": (
        ("displayName", "STRING", None, "ppl_wfp_scenarios", "display_name"),
        ("effectiveDate", "DATE", None, "ppl_wfp_scenarios", "effective_date"),
        ("validTo", "DATE", None, "ppl_wfp_scenarios", "valid_to"),
        ("configVersionId", "UUID", "DWP.WorkforcePlanning.ConfigurationVersion", "ppl_wfp_scenario_revisions", "config_version_public_id"),
        ("organizationSnapshotId", "UUID", "HRM.Organization.ImmutableSnapshot", "ppl_wfp_scenario_revisions", "organization_snapshot_public_id"),
        ("inputSnapshotId", "UUID", "DWP.WorkforcePlanning.InputSnapshotVersion", "ppl_wfp_scenario_revisions", "input_snapshot_public_id"),
        ("revisionPayloadDigest", "SHA256", None, "ppl_wfp_scenario_revisions", "payload_digest"),
    ),
}


GLOBAL_BUSINESS_INPUT_SPECS = {
    "modern.recruiting.offer.issue": (
        ("frequencyCode", "STRING", None, "ppl_rec_offers", "frequency_code"),
        ("basisCode", "STRING", None, "ppl_rec_offers", "basis_code"),
        ("fxSnapshotPublicId", "UUID", "DWP.Finance.FxSnapshot", "ppl_rec_offers", "fx_snapshot_public_id"),
    ),
    "modern.benefits.plan.create": (
        ("payrollTreatmentCodeSetVersionId", "UUID", "DWP.Configuration.CodeSetVersion", "ppl_bnf_plan_versions", "payroll_treatment_code_set_version_id"),
    ),
    "modern.recruiting.candidate.admit": (
        ("consentReceiptPublicId", "UUID", "DWP.Consent.DecisionReceipt", "ppl_rec_candidate_cases", "candidate_consent_receipt_public_id"),
        ("consentReceiptRevision", "BIGINT", None, "ppl_rec_candidate_cases", "candidate_consent_receipt_revision"),
        ("consentExpiresAt", "TIMESTAMPTZ", None, "ppl_rec_candidate_cases", "candidate_consent_expires_at"),
        ("requisitionId", "UUID", "table:ppl_rec_requisitions", "ppl_rec_candidate_cases", "requisition_id"),
    ),
    "modern.recruiting.offer.respond": (
        ("actorMode", "STRING", None, "ppl_rec_offer_decisions", "actor_mode"),
        ("delegationReceiptPublicId", "UUID", "DWP.Authorization.DelegationReceipt", "ppl_rec_offer_decisions", "delegation_receipt_public_id"),
        ("delegationReceiptRevision", "BIGINT", None, "ppl_rec_offer_decisions", "delegation_receipt_revision"),
        ("reasonCode", "STRING", None, "ppl_rec_offer_decisions", "reason_code"),
        ("decisionSourceReceiptPublicId", "UUID", "DWP.Authorization.DecisionReceipt", "ppl_rec_offer_decisions", "decision_source_receipt_public_id"),
        ("decisionSourceReceiptRevision", "BIGINT", None, "ppl_rec_offer_decisions", "decision_source_receipt_revision"),
    ),
    "modern.recruiting.requisition.create": (
        ("employmentTypeCodeSetVersionId", "UUID", "DWP.Configuration.CodeSetVersion", "ppl_rec_requisition_versions", "employment_type_code_set_version_id"),
        ("employmentTypeCodeSetVersionId", "UUID", "DWP.Configuration.CodeSetVersion", "ppl_rec_requisitions", "employment_type_code_set_version_id"),
    ),
    "modern.recruiting.requisition.revise": (
        ("revisionMode", "STRING", None, "ppl_rec_requisition_versions", "revision_mode"),
        ("effectiveFrom", "DATE", None, "ppl_rec_requisition_versions", "effective_from"),
        ("effectiveTo", "DATE", None, "ppl_rec_requisition_versions", "effective_to"),
        ("reasonCode", "STRING", None, "ppl_rec_requisition_versions", "correction_reason_code"),
        ("changedFields", "OBJECT", None, "ppl_rec_requisition_versions", "changed_fields"),
        ("employmentTypeCodeSetVersionId", "UUID", "DWP.Configuration.CodeSetVersion", "ppl_rec_requisition_versions", "employment_type_code_set_version_id"),
        ("employmentTypeCodeSetVersionId", "UUID", "DWP.Configuration.CodeSetVersion", "ppl_rec_requisitions", "employment_type_code_set_version_id"),
    ),
    "modern.onboarding.template.revise": (
        ("revisionMode", "STRING", None, "ppl_jny_template_versions", "revision_mode"),
        ("reasonCode", "STRING", None, "ppl_jny_template_versions", "correction_reason_code"),
        ("changedFields", "OBJECT", None, "ppl_jny_template_versions", "changed_fields"),
    ),
    "modern.benefits.plan.revise": (
        ("revisionMode", "STRING", None, "ppl_bnf_plan_versions", "revision_mode"),
        ("reasonCode", "STRING", None, "ppl_bnf_plan_versions", "correction_reason_code"),
        ("changedFields", "OBJECT", None, "ppl_bnf_plan_versions", "changed_fields"),
        ("payrollTreatmentCodeSetVersionId", "UUID", "DWP.Configuration.CodeSetVersion", "ppl_bnf_plan_versions", "payroll_treatment_code_set_version_id"),
    ),
    "modern.onboarding.task.waive": (
        ("authorizationReceiptPublicId", "UUID", "DWP.Authorization.DecisionReceipt", "ppl_jny_task_evidence", "authorization_receipt_public_id"),
        ("authorizationReceiptRevision", "BIGINT", None, "ppl_jny_task_evidence", "authorization_receipt_revision"),
    ),
    "modern.workforceplan.scenario.create": (
        ("assumptionArtifactPublicId", "UUID", "DWP.Content.TypedWorkforceAssumptionArtifactVersion", "ppl_wfp_scenario_revisions", "assumption_artifact_public_id"),
        ("assumptionSchemaVersion", "STRING", None, "ppl_wfp_scenario_revisions", "assumption_schema_version"),
        ("unitCode", "STRING", None, "ppl_wfp_scenario_revisions", "unit_code"),
        ("currencyCode", "STRING", None, "ppl_wfp_scenario_revisions", "currency_code"),
        ("horizonStart", "DATE", None, "ppl_wfp_scenario_revisions", "horizon_start"),
        ("horizonEnd", "DATE", None, "ppl_wfp_scenario_revisions", "horizon_end"),
    ),
    "modern.workforceplan.scenario.revise": (
        ("revisionMode", "STRING", None, "ppl_wfp_scenario_revisions", "revision_kind"),
        ("assumptionArtifactPublicId", "UUID", "DWP.Content.TypedWorkforceAssumptionArtifactVersion", "ppl_wfp_scenario_revisions", "assumption_artifact_public_id"),
        ("assumptionSchemaVersion", "STRING", None, "ppl_wfp_scenario_revisions", "assumption_schema_version"),
        ("reasonCode", "STRING", None, "ppl_wfp_scenario_revisions", "correction_reason_code"),
    ),
    "modern.workforceplan.scenario.simulate": (
        ("scenarioRevision", "BIGINT", None, "ppl_wfp_simulation_requests", "scenario_revision"),
    ),
    "modern.benefits.enrollment.submit": (
        ("eligibilityDecisionReceiptId", "UUID", "DWP.Rules.DecisionReceipt", "ppl_bnf_enrollment_eligibility_receipts", "decision_receipt_public_id"),
        ("eligibilityDecisionReceiptRevision", "BIGINT", None, "ppl_bnf_enrollment_eligibility_receipts", "decision_receipt_revision"),
    ),
    "modern.benefits.lifeevent.decide": (
        ("actorMode", "STRING", None, "ppl_bnf_life_event_decisions", "actor_mode"),
        ("reasonCode", "STRING", None, "ppl_bnf_life_event_decisions", "reason_code"),
        ("delegationReceiptPublicId", "UUID", "DWP.Authorization.DelegationReceipt", "ppl_bnf_life_event_decisions", "delegation_receipt_public_id"),
        ("delegationReceiptRevision", "BIGINT", None, "ppl_bnf_life_event_decisions", "delegation_receipt_revision"),
        ("decisionSourceReceiptPublicId", "UUID", "DWP.Authorization.DecisionReceipt", "ppl_bnf_life_event_decisions", "decision_source_receipt_public_id"),
        ("decisionSourceReceiptRevision", "BIGINT", None, "ppl_bnf_life_event_decisions", "decision_source_receipt_revision"),
    ),
    "modern.hrservice.case.create": (
        ("requestArtifactPublicId", "UUID", "DWP.Content.EncryptedCaseArtifact", "ppl_hrs_case_actions", "content_artifact_public_id"),
        ("requestArtifactRevision", "BIGINT", None, "ppl_hrs_case_actions", "content_artifact_revision"),
        ("requestArtifactSchemaVersion", "STRING", None, "ppl_hrs_case_actions", "content_artifact_schema_version"),
        ("requesterMode", "STRING", None, "ppl_hrs_cases", "requester_mode"),
        ("caseTypeCodeSetVersionId", "UUID", "DWP.Configuration.CodeSetVersion", "ppl_hrs_cases", "case_type_code_set_version_id"),
        ("queueCodeSetVersionId", "UUID", "DWP.Configuration.CodeSetVersion", "ppl_hrs_cases", "queue_code_set_version_id"),
    ),
    "modern.hrservice.case.respond": (
        ("responseArtifactPublicId", "UUID", "DWP.Content.EncryptedCaseArtifact", "ppl_hrs_case_actions", "content_artifact_public_id"),
        ("responseArtifactRevision", "BIGINT", None, "ppl_hrs_case_actions", "content_artifact_revision"),
        ("responseArtifactSchemaVersion", "STRING", None, "ppl_hrs_case_actions", "content_artifact_schema_version"),
    ),
    "modern.hrservice.case.triage": (
        ("caseTypeCodeSetVersionId", "UUID", "DWP.Configuration.CodeSetVersion", "ppl_hrs_cases", "case_type_code_set_version_id"),
        ("queueCodeSetVersionId", "UUID", "DWP.Configuration.CodeSetVersion", "ppl_hrs_cases", "queue_code_set_version_id"),
    ),
    "modern.contingent.engagement.create": (
        ("classificationCode", "STRING", None, "ppl_cwk_classification_receipts", "classification_code"),
        ("classificationPolicyVersionId", "UUID", "DWP.Contingent.ClassificationPolicyVersion", "ppl_cwk_classification_receipts", "classification_policy_version_id"),
        ("classificationDecisionReceiptId", "UUID", "DWP.Rules.DecisionReceipt", "ppl_cwk_classification_receipts", "decision_receipt_public_id"),
        ("accessPackagePublicId", "UUID", "DWP.Access.PackageVersion", "ppl_cwk_access_requests", "access_package_public_id"),
        ("accessScope", "OBJECT", None, "ppl_cwk_access_requests", "access_scope"),
        ("accessExpiry", "TIMESTAMPTZ", None, "ppl_cwk_access_requests", "access_expires_at"),
    ),
    "modern.contingent.engagement.revise": (
        ("revisionMode", "STRING", None, "ppl_cwk_engagement_versions", "revision_mode"),
        ("reasonCode", "STRING", None, "ppl_cwk_engagement_versions", "correction_reason_code"),
        ("changedFields", "OBJECT", None, "ppl_cwk_engagement_versions", "changed_fields"),
    ),
    "modern.skills.taxonomy.create": (
        ("nodes", "ARRAY", None, "prf_skl_skill_nodes", "typed_node_rows"),
        ("edges", "ARRAY", None, "prf_skl_skill_edges", "typed_edge_rows"),
        ("proficiencyLevels", "ARRAY", None, "prf_skl_proficiency_levels", "typed_level_rows"),
    ),
    "modern.skills.evidence.record": (
        ("taxonomyVersionPublicId", "UUID", "table:prf_skl_taxonomy_versions", "prf_skl_worker_evidence", "taxonomy_version_public_id"),
        ("consentReceiptPublicId", "UUID", "DWP.Consent.DecisionReceipt", "prf_skl_worker_evidence", "consent_receipt_public_id"),
        ("consentReceiptRevision", "BIGINT", None, "prf_skl_worker_evidence", "consent_receipt_revision"),
    ),
    "modern.growth.profile.create": (
        ("artifactPublicId", "UUID", "DWP.Content.GrowthProfileArtifactVersion", "prf_grw_profile_revisions", "artifact_public_id"),
        ("artifactRevision", "BIGINT", None, "prf_grw_profile_revisions", "artifact_revision"),
        ("artifactSchemaVersion", "STRING", None, "prf_grw_profile_revisions", "artifact_schema_version"),
        ("artifactDigest", "SHA256", None, "prf_grw_profile_revisions", "content_digest"),
        ("visibility", "STRING", None, "prf_grw_profile_revisions", "visibility"),
    ),
    "modern.growth.coaching.record": (
        ("artifactPublicId", "UUID", "DWP.Content.CoachingArtifactVersion", "prf_grw_coaching_notes", "artifact_public_id"),
        ("artifactRevision", "BIGINT", None, "prf_grw_coaching_notes", "artifact_revision"),
        ("coachPrincipalPublicId", "UUID", "DWP.Principal", "prf_grw_coaching_notes", "coach_principal_public_id"),
    ),
    "modern.growth.evidence.link": (
        ("consentReceiptPublicId", "UUID", "DWP.Consent.DecisionReceipt", "prf_grw_evidence_links", "consent_receipt_public_id"),
        ("consentReceiptRevision", "BIGINT", None, "prf_grw_evidence_links", "consent_receipt_revision"),
        ("consentExpiresAt", "TIMESTAMPTZ", None, "prf_grw_evidence_links", "consent_expires_at"),
    ),
    "modern.learning.offering.create": (
        ("contentArtifactPublicId", "UUID", "DWP.Content.LearningArtifactVersion", "prf_lrn_offering_versions", "content_artifact_public_id"),
        ("contentArtifactRevision", "BIGINT", None, "prf_lrn_offering_versions", "content_artifact_revision"),
        ("deliveryMode", "STRING", None, "prf_lrn_offering_versions", "delivery_mode"),
        ("capacity", "INTEGER", None, "prf_lrn_offering_versions", "capacity"),
        ("eligibilityPolicyVersionId", "UUID", "DWP.Learning.EligibilityPolicyVersion", "prf_lrn_offering_versions", "eligibility_policy_version_id"),
        ("skillMappings", "ARRAY", None, "prf_lrn_offering_versions", "skill_mappings"),
        ("contentArtifactSchemaVersion", "STRING", None, "prf_lrn_offering_versions", "content_artifact_schema_version"),
        ("sessionSchema", "OBJECT", None, "prf_lrn_offering_versions", "session_schema"),
    ),
    "modern.learning.assignment.create": (
        ("offeringVersionPublicId", "UUID", "table:prf_lrn_offering_versions", "prf_lrn_assignments", "offering_version_public_id"),
        ("dueAt", "TIMESTAMPTZ", None, "prf_lrn_assignments", "due_at"),
        ("assignmentSourceCode", "STRING", None, "prf_lrn_assignments", "assignment_source_code"),
        ("assignmentSourcePolicyVersionId", "UUID", "DWP.Learning.AssignmentSourcePolicyVersion", "prf_lrn_assignments", "assignment_source_policy_version_id"),
    ),
    "modern.learning.offering.revise": (
        ("revisionMode", "STRING", None, "prf_lrn_offering_versions", "revision_mode"),
        ("reasonCode", "STRING", None, "prf_lrn_offering_versions", "correction_reason_code"),
        ("changedFields", "OBJECT", None, "prf_lrn_offering_versions", "changed_fields"),
        ("contentArtifactPublicId", "UUID", "DWP.Content.LearningArtifactVersion", "prf_lrn_offering_versions", "content_artifact_public_id"),
        ("contentArtifactRevision", "BIGINT", None, "prf_lrn_offering_versions", "content_artifact_revision"),
        ("contentArtifactSchemaVersion", "STRING", None, "prf_lrn_offering_versions", "content_artifact_schema_version"),
        ("deliveryMode", "STRING", None, "prf_lrn_offering_versions", "delivery_mode"),
        ("sessionSchema", "OBJECT", None, "prf_lrn_offering_versions", "session_schema"),
        ("capacity", "INTEGER", None, "prf_lrn_offering_versions", "capacity"),
        ("eligibilityPolicyVersionId", "UUID", "DWP.Learning.EligibilityPolicyVersion", "prf_lrn_offering_versions", "eligibility_policy_version_id"),
        ("skillMappings", "ARRAY", None, "prf_lrn_offering_versions", "skill_mappings"),
    ),
    "modern.opportunity.create": (
        ("criteriaArtifactPublicId", "UUID", "DWP.Content.OpportunityCriteriaArtifactVersion", "prf_mkt_opportunity_versions", "criteria_artifact_public_id"),
        ("criteriaArtifactRevision", "BIGINT", None, "prf_mkt_opportunity_versions", "criteria_artifact_revision"),
        ("capacity", "INTEGER", None, "prf_mkt_opportunity_versions", "capacity"),
        ("skillMappings", "ARRAY", None, "prf_mkt_opportunity_versions", "skill_mappings"),
        ("criteriaSchemaVersion", "STRING", None, "prf_mkt_opportunity_versions", "criteria_schema_version"),
    ),
    "modern.opportunity.revise": (
        ("revisionMode", "STRING", None, "prf_mkt_opportunity_versions", "revision_mode"),
        ("effectiveFrom", "TIMESTAMPTZ", None, "prf_mkt_opportunity_versions", "effective_from"),
        ("effectiveTo", "TIMESTAMPTZ", None, "prf_mkt_opportunity_versions", "effective_to"),
        ("reasonCode", "STRING", None, "prf_mkt_opportunity_versions", "correction_reason_code"),
        ("changedFields", "OBJECT", None, "prf_mkt_opportunity_versions", "changed_fields"),
        ("criteriaArtifactPublicId", "UUID", "DWP.Content.OpportunityCriteriaArtifactVersion", "prf_mkt_opportunity_versions", "criteria_artifact_public_id"),
        ("criteriaArtifactRevision", "BIGINT", None, "prf_mkt_opportunity_versions", "criteria_artifact_revision"),
        ("criteriaSchemaVersion", "STRING", None, "prf_mkt_opportunity_versions", "criteria_schema_version"),
        ("capacity", "INTEGER", None, "prf_mkt_opportunity_versions", "capacity"),
        ("skillMappings", "ARRAY", None, "prf_mkt_opportunity_versions", "skill_mappings"),
    ),
    "modern.opportunity.apply": (
        ("consentReceiptPublicId", "UUID", "DWP.Consent.DecisionReceipt", "prf_mkt_applications", "consent_receipt_public_id"),
        ("statementArtifactPublicId", "UUID", "DWP.Content.ApplicationStatementArtifactVersion", "prf_mkt_applications", "statement_artifact_public_id"),
        ("statementArtifactRevision", "BIGINT", None, "prf_mkt_applications", "statement_artifact_revision"),
    ),
    "modern.opportunity.shortlist": (
        ("explanationArtifactPublicId", "UUID", "DWP.Content.MatchExplanationArtifactVersion", "prf_mkt_match_explanations", "explanation_artifact_public_id"),
        ("explanationArtifactRevision", "BIGINT", None, "prf_mkt_match_explanations", "explanation_artifact_revision"),
        ("inputRevision", "BIGINT", None, "prf_mkt_match_explanations", "input_revision"),
    ),
    "modern.opportunity.selection.record": (
        ("decisionReceiptPublicId", "UUID", "DWP.Authorization.DecisionReceipt", "prf_mkt_application_decisions", "approval_receipt_public_id"),
        ("humanActorPublicId", "UUID", "DWP.Principal", "prf_mkt_application_decisions", "actor_public_id"),
    ),
    "modern.opportunity.application.withdraw": (
        ("actorMode", "STRING", None, "prf_mkt_application_decisions", "actor_mode"),
        ("reasonCode", "STRING", None, "prf_mkt_application_decisions", "reason_code"),
        ("delegationReceiptPublicId", "UUID", "DWP.Authorization.DelegationReceipt", "prf_mkt_application_decisions", "delegation_receipt_public_id"),
        ("delegationReceiptRevision", "BIGINT", None, "prf_mkt_application_decisions", "delegation_receipt_revision"),
        ("decisionSourceReceiptPublicId", "UUID", "DWP.Authorization.DecisionReceipt", "prf_mkt_application_decisions", "decision_source_receipt_public_id"),
        ("decisionSourceReceiptRevision", "BIGINT", None, "prf_mkt_application_decisions", "decision_source_receipt_revision"),
    ),
    "modern.succession.nomination.add": (
        ("consentReceiptPublicId", "UUID", "DWP.Consent.DecisionReceipt", "prf_suc_nominations", "consent_receipt_public_id"),
        ("consentExpiresAt", "TIMESTAMPTZ", None, "prf_suc_nominations", "consent_expires_at"),
        ("readinessVocabularyVersionId", "UUID", "DWP.Configuration.VocabularyVersion", "prf_suc_nominations", "readiness_vocabulary_version_id"),
    ),
    "modern.succession.plan.revise": (
        ("revisionMode", "STRING", None, "prf_suc_plan_versions", "revision_mode"),
        ("reasonCode", "STRING", None, "prf_suc_plan_versions", "correction_reason_code"),
        ("changedFields", "OBJECT", None, "prf_suc_plan_versions", "changed_fields"),
        ("contentArtifactPublicId", "UUID", "DWP.Content.RestrictedSuccessionPlanArtifactVersion", "prf_suc_plan_versions", "content_artifact_public_id"),
        ("contentArtifactRevision", "BIGINT", None, "prf_suc_plan_versions", "content_artifact_revision"),
    ),
    "modern.succession.plan.create": (
        ("contentArtifactPublicId", "UUID", "DWP.Content.RestrictedSuccessionPlanArtifactVersion", "prf_suc_plan_versions", "content_artifact_public_id"),
        ("contentArtifactRevision", "BIGINT", None, "prf_suc_plan_versions", "content_artifact_revision"),
        ("contentDigest", "SHA256", None, "prf_suc_plan_versions", "content_digest"),
    ),
    "modern.succession.nomination.withdraw": (
        ("actorMode", "STRING", None, "prf_suc_readiness_evidence", "actor_mode"),
        ("reasonCode", "STRING", None, "prf_suc_readiness_evidence", "reason_code"),
        ("delegationReceiptPublicId", "UUID", "DWP.Authorization.DelegationReceipt", "prf_suc_readiness_evidence", "delegation_receipt_public_id"),
        ("delegationReceiptRevision", "BIGINT", None, "prf_suc_readiness_evidence", "delegation_receipt_revision"),
        ("decisionSourceReceiptPublicId", "UUID", "DWP.Authorization.DecisionReceipt", "prf_suc_readiness_evidence", "decision_source_receipt_public_id"),
        ("decisionSourceReceiptRevision", "BIGINT", None, "prf_suc_readiness_evidence", "decision_source_receipt_revision"),
    ),
    "modern.succession.readiness.record": (
        ("evidenceRevision", "BIGINT", None, "prf_suc_readiness_evidence", "source_revision"),
        ("reviewDueAt", "TIMESTAMPTZ", None, "prf_suc_readiness_evidence", "review_due_at"),
    ),
    "modern.compplan.cycle.create": (
        ("budgetAmount", "DECIMAL", None, "prf_cmp_cycles", "budget_total"),
        ("currencyCode", "STRING", None, "prf_cmp_cycles", "budget_currency"),
        ("frequencyCode", "STRING", None, "prf_cmp_budget_ledger", "frequency_code"),
        ("basisCode", "STRING", None, "prf_cmp_budget_ledger", "basis_code"),
        ("fxSnapshotPublicId", "UUID", "DWP.Finance.FxSnapshot", "prf_cmp_budget_ledger", "fx_snapshot_public_id"),
    ),
    "modern.compplan.budget.allocate": (
        ("frequencyCode", "STRING", None, "prf_cmp_budget_ledger", "frequency_code"),
        ("basisCode", "STRING", None, "prf_cmp_budget_ledger", "basis_code"),
        ("fxSnapshotPublicId", "UUID", "DWP.Finance.FxSnapshot", "prf_cmp_budget_ledger", "fx_snapshot_public_id"),
    ),
    "modern.compplan.proposal.upsert": (
        ("assignmentPublicId", "UUID", "HRM.Assignment", "prf_cmp_proposals", "assignment_public_id"),
        ("reasonCode", "STRING", None, "prf_cmp_proposals", "reason_code"),
        ("componentCatalogVersionId", "UUID", "DWP.Compensation.ComponentCatalogVersion", "prf_cmp_proposals", "component_catalog_version_id"),
        ("componentCodeSetVersionId", "UUID", "DWP.Configuration.CodeSetVersion", "prf_cmp_proposals", "component_code_set_version_id"),
        ("frequencyCode", "STRING", None, "prf_cmp_proposals", "frequency_code"),
        ("basisCode", "STRING", None, "prf_cmp_proposals", "basis_code"),
        ("fxSnapshotPublicId", "UUID", "DWP.Finance.FxSnapshot", "prf_cmp_proposals", "fx_snapshot_public_id"),
    ),
    "modern.compplan.plan.approve": (
        ("decisionReceiptPublicId", "UUID", "Approval.DecisionReceipt", "prf_cmp_plans", "approval_receipt_public_id"),
        ("proposalVersions", "ARRAY", None, "prf_cmp_plan_proposal_refs", "typed_proposal_refs"),
    ),
    "modern.compplan.snapshot.publish": (
        ("planRevision", "BIGINT", None, "prf_cmp_approved_snapshots", "source_version"),
    ),
    "modern.wfm.schedule.optimize": (
        ("optimizationMode", "STRING", None, "tme_wfm_optimization_requests", "optimization_mode"),
        ("forecastPublicId", "UUID", "table:tme_wfm_demand_forecasts", "tme_wfm_optimization_requests", "forecast_public_id"),
        ("ruleSnapshotPublicId", "UUID", "DWP.WFM.RuleSnapshotVersion", "tme_wfm_optimization_requests", "rule_snapshot_public_id"),
        ("aiGovernanceActivationReceiptPublicId", "UUID", "DWP.AIGovernance.ActivationReceipt", "tme_wfm_optimization_requests", "algorithm_governance_receipt_id"),
        ("modelVersionPublicId", "UUID", "DWP.AIGovernance.ModelVersion", "tme_wfm_optimization_requests", "model_version_public_id"),
    ),
    "modern.wfm.schedule.validate": (
        ("candidateVersion", "BIGINT", None, "tme_wfm_constraint_evaluation_receipts", "candidate_revision"),
    ),
    "modern.wfm.forecast.create": (
        ("demandUnitCodeSetVersionId", "UUID", "DWP.Configuration.CodeSetVersion", "tme_wfm_demand_lines", "demand_unit_code_set_version_id"),
    ),
    "modern.wfm.schedule.publish": (
        ("candidateVersion", "BIGINT", None, "tme_wfm_schedule_publish_ledger", "candidate_revision"),
        ("approvalReceiptPublicId", "UUID", "Approval.DecisionReceipt", "tme_wfm_schedule_publish_ledger", "approval_receipt_public_id"),
    ),
    "modern.analytics.metric.create": (
        ("expressionAst", "OBJECT", None, "sys_hris_metric_versions", "expression_ast"),
        ("aggregationCode", "STRING", None, "sys_hris_metric_versions", "aggregation_code"),
        ("unitCode", "STRING", None, "sys_hris_metric_versions", "unit_code"),
        ("dimensionSchema", "OBJECT", None, "sys_hris_metric_versions", "dimension_schema"),
        ("sourceContracts", "ARRAY", None, "sys_hris_metric_versions", "source_contracts"),
        ("unitRegistryVersionId", "UUID", "DWP.Analytics.UnitRegistryVersion", "sys_hris_metric_versions", "unit_registry_version_id"),
    ),
    "modern.analytics.projection.request": (
        ("metricVersionPublicId", "UUID", "table:sys_hris_metric_versions", "sys_hris_metric_projection_requests", "metric_version_public_id"),
        ("populationSnapshotPublicId", "UUID", "DWP.Population.ImmutableSnapshot", "sys_hris_metric_projection_requests", "population_snapshot_public_id"),
        ("purposeCode", "STRING", None, "sys_hris_metric_projection_requests", "purpose_code"),
    ),
    "modern.ai.assist.create": (
        ("subjectWorkerPublicId", "UUID", "HRM.Worker", "sys_hris_ai_assistance_requests", "subject_worker_public_id"),
    ),
    "modern.ai.assist.review": (
        ("reasonCode", "STRING", None, "sys_hris_ai_assistance_reviews", "reason_code"),
        ("humanActorPublicId", "UUID", "DWP.Principal", "sys_hris_ai_assistance_reviews", "actor_public_id"),
        ("actorMode", "STRING", None, "sys_hris_ai_assistance_reviews", "actor_mode"),
        ("decisionSourceReceiptPublicId", "UUID", "DWP.Authorization.DecisionReceipt", "sys_hris_ai_assistance_reviews", "decision_source_receipt_public_id"),
        ("decisionSourceReceiptRevision", "BIGINT", None, "sys_hris_ai_assistance_reviews", "decision_source_receipt_revision"),
    ),
    "modern.ai.assist.revoke": (
        ("reasonCode", "STRING", None, "sys_hris_ai_assistance_reviews", "reason_code"),
        ("humanActorPublicId", "UUID", "DWP.Principal", "sys_hris_ai_assistance_reviews", "actor_public_id"),
        ("actorMode", "STRING", None, "sys_hris_ai_assistance_reviews", "actor_mode"),
        ("decisionSourceReceiptPublicId", "UUID", "DWP.Authorization.DecisionReceipt", "sys_hris_ai_assistance_reviews", "decision_source_receipt_public_id"),
        ("decisionSourceReceiptRevision", "BIGINT", None, "sys_hris_ai_assistance_reviews", "decision_source_receipt_revision"),
    ),
}


APPROVAL_PROOF_COLUMNS = {
    "approval_receipt_public_id": "ownerProof.body.approvalReceiptId.publicId",
    "approval_receipt_revision": "ownerProof.body.approvalReceiptId.revision",
    "approval_outcome": "ownerProof.body.approvalReceiptId.outcome",
    "approval_action": "ownerProof.body.approvalReceiptId.action",
    "approval_input_digest": "ownerProof.body.approvalReceiptId.inputDigest",
    "approval_purpose_code": "ownerProof.body.approvalReceiptId.purposeCode",
    "approval_tenant_id": "ownerProof.body.approvalReceiptId.tenantId=authenticatedPrincipal.tenantId",
}


def _typed_decision_proof_sources(field_name: str) -> dict[str, str]:
    prefix = "ownerProof.body." + field_name
    return {
        "approval_receipt_public_id": prefix + ".publicId",
        "approval_receipt_revision": prefix + ".revision",
        "approval_outcome": prefix + ".outcome",
        "approval_action": prefix + ".action",
        "approval_input_digest": prefix + ".inputDigest",
        "approval_purpose_code": prefix + ".purposeCode",
        "approval_tenant_id": prefix + ".tenantId=authenticatedPrincipal.tenantId",
    }


# Immutable owner-local destination for every publish approval.  Roots are
# used only where the root is itself an immutable version; mutable aggregates
# receive a dedicated append-only publish ledger.
PUBLISH_PROOF_TABLE = {
    "modern.recruiting.requisition.publish": "ppl_rec_requisition_publish_receipts",
    "modern.onboarding.template.publish": "ppl_jny_template_versions",
    "modern.workforceplan.scenario.publish": "ppl_wfp_publish_receipts",
    "modern.benefits.plan.publish": "ppl_bnf_plan_versions",
    "modern.skills.taxonomy.publish": "prf_skl_taxonomy_versions",
    "modern.learning.offering.publish": "prf_lrn_offering_publish_receipts",
    "modern.opportunity.publish": "prf_mkt_opportunity_publish_receipts",
    "modern.succession.plan.publish": "prf_suc_publish_receipts",
    "modern.compplan.snapshot.publish": "prf_cmp_approved_snapshots",
    "modern.wfm.schedule.publish": "tme_wfm_schedule_publish_ledger",
    "modern.listening.survey.publish": "sys_hris_listening_survey_versions",
    "modern.analytics.metric.publish": "sys_hris_metric_versions",
    "modern.ai.policy.publish": "sys_hris_ai_policy_versions",
}


DECISION_FACT_TARGETS = {
    ("modern.benefits.enrollment.decide", "body.decision"):
        ("ppl_bnf_enrollment_decisions", "state"),
    ("modern.benefits.enrollment.submit", "body.coverageOptionCode"):
        ("ppl_bnf_enrollments", "coverage_level"),
    ("modern.compplan.budget.allocate", "body.ledgerEntryType"):
        ("prf_cmp_budget_ledger", "entry_type"),
    ("modern.compplan.plan.approve", "body.decision"):
        ("prf_cmp_plans", "approval_outcome"),
    ("modern.onboarding.task.complete", "body.completionCode"):
        ("ppl_jny_task_evidence", "completion_code"),
    ("modern.opportunity.selection.record", "body.decision"):
        ("prf_mkt_application_decisions", "state"),
    ("modern.opportunity.shortlist", "body.decision"):
        ("prf_mkt_application_decisions", "state"),
    ("modern.recruiting.candidate.stage", "body.targetStage"):
        ("ppl_rec_candidate_stage_history", "state"),
    ("modern.recruiting.hire.record", "body.decision"):
        ("ppl_rec_hire_requests", "decision_outcome"),
    ("modern.skills.evidence.verify", "body.verificationReceiptId"):
        ("prf_skl_worker_evidence", "verification_receipt_public_id"),
    ("modern.succession.plan.approve", "body.decision"):
        ("prf_suc_plans", "approval_outcome"),
    ("modern.workforceplan.scenario.approve", "body.decision"):
        ("ppl_wfp_scenario_revisions", "approval_outcome"),
}


# The legacy reviewer and the pre-remediation causal model identified
# overlapping, but non-identical, sets of provenance-sensitive operations.
# Keep their source-derived union explicit and require a same-transaction
# domain fact or typed owner proof for every member.  This is intentionally
# separate from the invariant that the command-receipt marker is absent.
PROVENANCE_CLOSURE_TARGETS: dict[str, tuple[str, frozenset[str]]] = {
    "modern.ai.assist.create": (
        "sys_hris_ai_assistance_requests",
        frozenset({
            "governance_activation_receipt_id",
            "governance_activation_receipt_revision",
            "human_oversight_assignment_version_id",
        }),
    ),
    "modern.benefits.enrollment.decide": (
        "ppl_bnf_enrollment_decisions",
        frozenset({"state", "approval_receipt_public_id", "approval_receipt_revision"}),
    ),
    "modern.benefits.enrollment.submit": (
        "ppl_bnf_enrollments", frozenset({"coverage_level"}),
    ),
    "modern.benefits.lifeevent.submit": (
        "ppl_bnf_life_events", frozenset({"event_type", "event_date", "payload_digest"}),
    ),
    "modern.compplan.budget.allocate": (
        "prf_cmp_budget_ledger", frozenset({"entry_type"}),
    ),
    "modern.compplan.plan.approve": (
        "prf_cmp_plans",
        frozenset({"approval_outcome", "approval_receipt_public_id", "approval_receipt_revision"}),
    ),
    "modern.growth.profile.archive": (
        "prf_grw_profiles", frozenset({"last_reason_code", "archived_at"}),
    ),
    "modern.learning.self.enroll": (
        "prf_lrn_assignments",
        frozenset({"learning_offering_id", "consent_revision", "effective_from"}),
    ),
    "modern.onboarding.task.complete": (
        "ppl_jny_task_evidence", frozenset({"completion_code"}),
    ),
    "modern.opportunity.selection.record": (
        "prf_mkt_application_decisions",
        frozenset({"state", "approval_receipt_public_id", "approval_receipt_revision"}),
    ),
    "modern.opportunity.shortlist": (
        "prf_mkt_application_decisions",
        frozenset({"state", "approval_receipt_public_id", "approval_receipt_revision"}),
    ),
    "modern.recruiting.candidate.stage": (
        "ppl_rec_candidate_stage_history",
        frozenset({"state", "approval_receipt_public_id", "approval_receipt_revision"}),
    ),
    "modern.recruiting.hire.record": (
        "ppl_rec_hire_requests",
        frozenset({"decision_outcome", "decision_receipt_revision", "decision_input_digest"}),
    ),
    "modern.skills.evidence.verify": (
        "prf_skl_worker_evidence",
        frozenset({
            "verification_receipt_public_id", "verification_receipt_revision",
            "verification_input_digest",
        }),
    ),
    "modern.succession.plan.approve": (
        "prf_suc_plans",
        frozenset({"approval_outcome", "approval_receipt_public_id", "approval_receipt_revision"}),
    ),
    "modern.workforceplan.scenario.approve": (
        "ppl_wfp_scenario_revisions",
        frozenset({"approval_outcome", "approval_receipt_public_id", "approval_receipt_revision"}),
    ),
}


# Public event bytes must be reconstructable after a process restart.  These
# predecessor fields used a transient owner refetch/ack even though the exact
# tenant-bound relation (or publish ledger) is already durable in the owner
# database.  Keep this closed map deliberately explicit: a new transient
# source must fail validation instead of being silently rewritten.
DURABLE_EVENT_SOURCE_REPAIRS: dict[tuple[str, str], tuple[str, str]] = {
    ("CompensationPlanApprovalRecorded.v2", "approvalReceiptId"): (
        "IMMUTABLE_OWNER_PROOF", "prf_cmp_plans.approval_receipt_public_id"
    ),
    ("CompensationPlanApprovalRecorded.v2", "approvalRevision"): (
        "IMMUTABLE_OWNER_PROOF", "prf_cmp_plans.approval_receipt_revision"
    ),
    ("GovernedAiPolicyEvaluationRequested.v2", "policyId"): (
        "PHYSICAL_POST_STATE", "sys_hris_ai_evaluation_requests.policy_public_id",
    ),
    ("WorkforceScheduleOptimizationRequested.v2", "forecastId"): (
        "PHYSICAL_POST_STATE", "tme_wfm_optimization_requests.forecast_public_id",
    ),
    ("WorkforceSchedulePublished.v2", "canonicalSchedulePeriodPublicId"): (
        "IMMUTABLE_OWNER_PROOF",
        "tme_wfm_schedule_publish_ledger.canonical_schedule_period_public_id",
    ),
    ("WorkforceSchedulePublished.v2", "approvalReceiptPublicId"): (
        "IMMUTABLE_OWNER_PROOF",
        "tme_wfm_schedule_publish_ledger.approval_receipt_public_id",
    ),
}


# HRIS stores only immutable, typed references to the central DWP AI
# Governance owner.  It never recreates model/prompt/dataset registries or the
# risk, disclosure, oversight, conformity, incident and kill-switch engines.
AI_GOVERNANCE_REQUIRED_PROOFS: tuple[dict[str, str], ...] = (
    {"field": "useCaseRegistrationVersionId", "entityType": "DWP.AIGovernance.UseCaseRegistrationVersion"},
    {"field": "riskClassificationVersionId", "entityType": "DWP.AIGovernance.RiskClassificationVersion"},
    {"field": "modelVersionId", "entityType": "DWP.AIGovernance.ModelVersion"},
    {"field": "promptTemplateVersionId", "entityType": "DWP.AIGovernance.PromptTemplateVersion"},
    {"field": "datasetManifestVersionId", "entityType": "DWP.AIGovernance.DatasetManifestVersion"},
    {"field": "evaluationProtocolVersionId", "entityType": "DWP.AIGovernance.EvaluationProtocolVersion"},
    {"field": "purposePolicyVersionId", "entityType": "DWP.AIGovernance.PurposePolicyVersion"},
    {"field": "populationPolicyVersionId", "entityType": "DWP.AIGovernance.PopulationPolicyVersion"},
    {"field": "humanOversightAssignmentVersionId", "entityType": "DWP.AIGovernance.HumanOversightAssignmentVersion"},
    {"field": "affectedPersonDisclosurePlanVersionId", "entityType": "DWP.AIGovernance.AffectedPersonDisclosurePlanVersion"},
    {"field": "impactAssessmentVersionId", "entityType": "DWP.AIGovernance.ImpactAssessmentVersion"},
    {"field": "conformityAssessmentVersionId", "entityType": "DWP.AIGovernance.ConformityAssessmentVersion"},
    {"field": "incidentResponsePlanVersionId", "entityType": "DWP.AIGovernance.IncidentResponsePlanVersion"},
    {"field": "rollbackPlanVersionId", "entityType": "DWP.AIGovernance.RollbackPlanVersion"},
    {"field": "monitoringPolicyVersionId", "entityType": "DWP.AIGovernance.MonitoringPolicyVersion"},
    {"field": "killSwitchControlVersionId", "entityType": "DWP.AIGovernance.KillSwitchControlVersion"},
)


def render(value: dict[str, Any]) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2) + "\n"


def _snake(name: str) -> str:
    return re.sub(r"(?<!^)(?=[A-Z])", "_", name).lower()


def _field(name: str, location: str, field_type: str = "UUID", *, required: bool = True,
           entity: str | None = None) -> dict[str, Any]:
    row: dict[str, Any] = {
        "source": f"{location}.{name}", "name": name, "location": location,
        "type": field_type, "required": required,
        "sensitivity": "RESTRICTED" if field_type == "UUID" else "INTERNAL",
        "tokenization": "OPAQUE_PUBLIC_ID" if field_type == "UUID" else "NONE",
    }
    if entity:
        row["referenceContract"] = {"entityType": entity, "idSpace": "PUBLIC_UUID"}
    return row


def _path_fields(path: str, root: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for name in re.findall(r"\{([^}]+)\}", path):
        table = PATH_IDENTITIES.get(name)
        if name == "planId":
            table = "ppl_bnf_plans" if root.startswith("ppl_bnf_") else "prf_suc_plans"
        if name == "policyId":
            table = "sys_hris_ai_use_policies"
        if name == "exportId":
            table = (
                "prf_grw_portability_export_receipts"
                if root.startswith("prf_grw_") else "sys_hris_analytics_export_receipts"
            )
        if table is None:
            raise ValueError(f"path parameter lacks explicit identity: {path} {name}")
        rows.append(_field(name, "pathParameters", entity="table:" + table))
    return rows


def _headers(*, command: bool, if_match: bool) -> list[dict[str, Any]]:
    rows = [
        _field("X-Correlation-ID", "headers", entity=None),
    ]
    rows[0].update({
        "sensitivity": "INTERNAL", "tokenization": "OPAQUE_CORRELATION_ID",
        "traceContract": "Trace.Correlation", "requestDigestMember": False,
    })
    if command:
        rows.insert(0, _field("Idempotency-Key", "headers", "STRING", entity=None))
        rows[0].update({"sensitivity": "INTERNAL", "requestDigestMember": False})
        if if_match:
            rows.insert(1, _field("If-Match", "headers", "BIGINT", entity=None))
            rows[1].update({"sensitivity": "INTERNAL", "requestDigestMember": True})
    return rows


def _input_effect(field: dict[str, Any], root: str, state_column: str,
                  *, command: bool) -> dict[str, Any]:
    source = field["source"]
    effects: list[dict[str, Any]] = []
    if source == "headers.X-Correlation-ID":
        effects = [{"kind": "OBSERVABILITY_CONTEXT", "target": "requestContext.correlationId"}]
    elif source == "headers.Idempotency-Key":
        effects = [{"kind": "IDEMPOTENCY_TUPLE_CONTROL", "target": "commandReceipt.replayKey"}]
    elif source == "headers.If-Match":
        effects = [{"kind": "ROOT_CAS_FILTER", "target": f"{root}.aggregate_version"}]
    elif source.startswith("pathParameters."):
        reference_entity = field.get("referenceContract", {}).get("entityType", "")
        selector_target = (
            reference_entity.removeprefix("table:") + ".public_id"
            if reference_entity else f"{root}.public_id"
        )
        effects = [{"kind": "ENTITY_SELECTOR", "target": selector_target,
                    "cardinality": "EXACTLY_ONE_TENANT_BOUND"}]
    elif source.startswith("queryParameters."):
        effects = [{"kind": "QUERY_FILTER", "target": "readPlan." + field["name"]}]
    else:
        effects = [{"kind": "TYPED_DOMAIN_INPUT", "target": f"{root}.{state_column}"}]
    return {
        "source": source, "type": field["type"], "required": field["required"],
        "sensitivity": field["sensitivity"],
        "requestDigestMember": bool(
            command and not source.startswith("headers.")
        ) or source == "headers.If-Match",
        "effects": effects,
    }


def _event_field(name: str, field_type: str, source_kind: str, source: str,
                 *, entity: str | None = None) -> dict[str, Any]:
    row: dict[str, Any] = {
        "name": name, "type": field_type, "required": True,
        "sourceKind": source_kind, "source": source,
        "sensitivity": "INTERNAL", "tokenization": "NONE",
        "validation": "exact durable owner fact under the stated emission condition",
    }
    if entity:
        row["referenceContract"] = {"entityType": entity, "idSpace": "PUBLIC_UUID"}
        row["tokenization"] = "OPAQUE_PUBLIC_ID"
    return row


def _event(event_name: str, operation: dict[str, Any], root: str, state_column: str,
           pre_states: tuple[str, ...], post_states: tuple[str, ...]) -> dict[str, Any]:
    receipt = RECEIPT_TABLE[operation["session"]]
    from_source_kind = "DERIVED_DOMAIN_FACT" if pre_states == ("NONE",) else "LOCKED_PRE_STATE"
    from_source = "CONSTANT:NONE" if pre_states == ("NONE",) else f"LOCKED_PRE:{root}.{state_column}"
    fields = [
        _event_field("aggregateId", "UUID", "PHYSICAL_POST_STATE", f"{root}.public_id",
                     entity="table:" + root),
        _event_field("fromState", "STRING", from_source_kind, from_source),
        _event_field("toState", "STRING", "PHYSICAL_POST_STATE", f"{root}.{state_column}"),
        _event_field("aggregateVersion", "BIGINT", "PHYSICAL_POST_STATE",
                     f"{root}.aggregate_version"),
        _event_field("occurredAt", "TIMESTAMPTZ", "PHYSICAL_POST_STATE",
                     f"{root}.updated_at"),
        _event_field("correlationId", "UUID", "SEALED_COMMAND_RECEIPT",
                     f"{receipt}.correlation_id"),
    ]
    fields[-1].update({"traceContract": "Trace.Correlation",
                       "tokenization": "OPAQUE_CORRELATION_ID"})
    purpose = operation["authorizationCapability"]
    entity_type = "table:" + root
    state_conditions = {
        "GovernedAiAssistanceConfirmed.v2": "toState=CONFIRMED",
        "GovernedAiAssistanceRejected.v2": "toState=REJECTED",
        "CandidateOfferAccepted.v2": "toState=ACCEPTED",
        "CandidateOfferDeclined.v2": "toState=DECLINED",
        "RequisitionPaused.v2": "toState=PAUSED",
        "RequisitionResumed.v2": "toState=OPEN",
        "RequisitionClosed.v2": "toState=CLOSED",
        "OnboardingJourneyCompleted.v2": "ALWAYS",
        "WorkforceSchedulePublished.v2": "ALWAYS",
    }
    result = {
        "eventName": event_name,
        "condition": state_conditions.get(event_name, "ALWAYS"),
        "aggregateEntityType": entity_type,
        "emission": {
            "outboxWrite": "SAME_TRANSACTION_AFTER_DOMAIN_AND_CLOSED_RECEIPT",
            "brokerPublish": "AFTER_COMMIT_ONLY",
            "rollback": "NO_OUTBOX_OR_PUBLISH_ON_FAILURE",
        },
        "fields": fields,
        "rawRequestMirroringForbidden": True,
        "audience": {
            "classification": "INTERNAL_DOMAIN",
            "allowedConsumerSessions": [operation["session"]],
            "allowedPurposes": [purpose],
            "fieldExposure": {"mode": "EXACT_ALLOWLIST",
                              "fields": [row["name"] for row in fields]},
            "denyUnknownConsumerOrPurpose": True,
        },
    }
    query = DETAIL_QUERY_BY_ENTITY.get(entity_type)
    if query:
        result["refetchContract"] = {
            "mode": "EXACT_HISTORICAL_VERSION",
            "ownerSession": operation["session"], "entityType": entity_type,
            "endpointOperationId": query,
            "allowedFields": ["aggregateId", "aggregateVersion", "toState"],
            "pep": {"tenant": "event.tenantId", "purpose": [purpose],
                    "consumerSessionAllowlist": [operation["session"]],
                    "fieldExposure": ["aggregateId", "aggregateVersion", "toState"],
                    "reauthorizeEveryCall": True, "denyOnUnavailable": True},
            "version": "event.aggregateVersion exact immutable revision; no latest fallback",
            "asOf": "event.occurredAt",
        }
    else:
        result["refetchContract"] = {
            "mode": "FORBIDDEN",
            "reason": "FIXED_V1_SURFACE_HAS_NO_EXACT_AGGREGATE_DETAIL_OPERATION",
            "payloadSufficiency": "EVENT_FIELDS_ARE_CLOSED_AND_REPLAYABLE_FROM_DURABLE_OWNER_FACTS",
        }
    return result


def _selectors(fields: list[dict[str, Any]], root: str, purpose: str) -> list[dict[str, Any]]:
    rows = []
    for field in fields:
        reference = field.get("referenceContract")
        if not reference:
            continue
        entity_type = reference["entityType"]
        local = entity_type.startswith("table:")
        target = entity_type.removeprefix("table:")
        rows.append({
            "source": field["source"],
            "selectorType": "LOCAL_TABLE" if local else "OWNER_PORT_EXACT_VERSION",
            "entityType": entity_type,
            "idSpace": reference.get("idSpace", "PUBLIC_UUID"),
            "sourceType": field["type"],
            "targetTable": target if local else "OWNER_PORT::" + target,
            "targetColumn": "public_id" if local else "publicId",
            "targetSqlType": "UUID", "operator": "=", "cardinality": "EXACTLY_ONE",
            "tenantFilter": "tenant_id=authenticatedPrincipal.tenantId",
            "purposeFilter": purpose,
            "versionRule": (
                "IDENTITY_IS_EXACT_IMMUTABLE_VERSION_NO_LATEST_FALLBACK"
                if "Version" in field["name"] or "Revision" in field["name"]
                else "EXACT_IDENTITY_PLUS_LOCKED_REVISION_OR_QUERY_AS_OF"
            ),
            "asOfRule": "request.referenceEffectiveAt OR one captured owner transaction clock",
            "causalJoin": (
                "ROOT_IDENTITY" if target == root
                else "EXACT_SAME_TENANT_LOCKED_FK" if local
                else "SIGNED_OWNER_REFETCH_TENANT_PURPOSE_VERSION_ASOF_MATCH"
            ),
            "failure": "404_OPAQUE_OR_409_STALE; ZERO_DOMAIN_RECEIPT_OUTBOX_MUTATION",
        })
    return rows


def _receipt_steps(operation: dict[str, Any], domain_steps: list[dict[str, Any]]) -> list[dict[str, Any]]:
    receipt = RECEIPT_TABLE[operation["session"]]
    outbox = OUTBOX_TABLE[operation["session"]]
    claim = {
        "step": 1, "phase": "IN_TRANSACTION", "action": "CLAIM_OR_REPLAY",
        "table": receipt, "role": "COMMAND_RECEIPT",
        "selector": "tenant+caller+operation+idempotencyKey",
        "assignments": {
            "tenant_id": "authenticatedPrincipal.tenantId",
            "operation_id": f"CONSTANT:{operation['operationId']}",
            "idempotency_key": "headers.Idempotency-Key",
            "request_digest": (
                "SERVER_DERIVE:canonical method+path+selectors+body excluding correlation,"
                "idempotency,auth,purpose,population snapshots"
            ),
            "correlation_id": "headers.X-Correlation-ID",
            "authorization_revision": "authorization.authorizationRevision",
            "purpose_code": f"CONSTANT:{operation['authorizationCapability']}",
            "population_scope_digest": "authorization.populationScopeDigest",
            "field_policy_revision": "authorization.fieldPolicyRevision",
            "lifecycle_state": "CONSTANT:RUNNING",
        },
        "expectedRows": "ONE_NEW_OR_ONE_IDENTICAL_REPLAY",
        "failureInjectionAssertion": "no domain/receipt/outbox write survives",
    }
    rows = [claim]
    for index, step in enumerate(domain_steps, start=2):
        rows.append({**step, "step": index, "phase": "IN_TRANSACTION"})
    rows.append({
        "step": len(rows) + 1, "phase": "IN_TRANSACTION",
        "action": "COMPLETE_RECEIPT", "table": receipt, "role": "COMMAND_RECEIPT",
        "selector": "claimed receipt row", "assignments": {
            "lifecycle_state": "CONSTANT:COMPLETED",
            "result_json": "SERVER_DERIVE:closed typed post-state result",
            "result_digest": "SERVER_DERIVE:canonical result_json SHA-256",
            "post_identity_json": "SERVER_DERIVE:exact aggregate and child public IDs+versions",
            "completed_at": "ownerClock.transactionNow",
        }, "expectedRows": "EXACTLY_ONE",
        "failureInjectionAssertion": "domain and outbox roll back",
    })
    rows.append({
        "step": len(rows) + 1, "phase": "IN_TRANSACTION",
        "action": "APPEND_EVENTS", "table": outbox, "role": "TRANSACTIONAL_OUTBOX",
        "selector": "one row per matched event condition", "assignments": {
            "tenant_id": "authenticatedPrincipal.tenantId",
            "event_type": "events[*].eventName",
            "payload": "events[*].canonicalCommittedPayload",
            "correlation_id": f"{receipt}.correlation_id",
            "occurred_at": "ownerClock.transactionNow",
        }, "expectedRows": "EXACT_MATCHED_EVENT_CARDINALITY",
        "failureInjectionAssertion": "domain and receipt roll back",
    })
    return rows


def _domain_steps(root: str, state_column: str, pre_states: tuple[str, ...],
                  writes: tuple[str, ...]) -> list[dict[str, Any]]:
    steps: list[dict[str, Any]] = []
    for table in writes:
        is_root = table == root
        insert_root = is_root and pre_states == ("NONE",)
        append_child = not is_root and table.endswith((
            "_history", "_revisions", "_versions", "_decisions", "_requests", "_receipts",
            "_nodes", "_edges", "_levels", "_evidence",
        ))
        action = "INSERT" if insert_root else "APPEND" if append_child else "UPDATE_CAS"
        assignments: dict[str, str] = {
            "tenant_id": "authenticatedPrincipal.tenantId",
            "aggregate_version": (
                "CONSTANT:1" if action in {"INSERT", "APPEND"}
                else "LOCKED_PRE:aggregate_version+1"
            ),
        }
        if action in {"INSERT", "APPEND"}:
            assignments["public_id"] = "SERVER_ALLOCATE:UUID_V7_REPLAY_STABLE"
            assignments["created_by"] = "authenticatedPrincipal.publicId"
            assignments["correlation_id"] = "headers.X-Correlation-ID"
        if is_root:
            assignments[state_column] = "derived.transition_post_state"
            assignments["updated_at"] = "ownerClock.transactionNow"
        steps.append({
            "action": action, "table": table,
            "role": "CONCURRENCY_ROOT" if is_root else "RELATED_TYPED_FACT",
            "selector": (
                "tenant+owner-generated replay-stable identity+exact locked parent"
                if action in {"INSERT", "APPEND"}
                else "tenant+public_id+expected aggregate_version+allowed pre-state"
            ),
            "assignments": assignments,
            "expectedRows": "EXACTLY_ONE",
            "failureInjectionAssertion": "all earlier domain/control rows and outbox roll back",
        })
    return steps


def _query_read_plan(operation: dict[str, Any], tables: tuple[str, ...] | list[str]) -> dict[str, Any]:
    """Return the complete reviewed query re-entry tuple.

    Every value needed to authorize and reproduce a read is inside the tuple;
    convenience copies remain at readPlan level for older consumers.
    """
    sources = list(tables)
    if not sources:
        raise ValueError(f"query has no reviewed physical source: {operation['operationId']}")
    detail = bool(re.search(r"\{[^}]+\}", operation["path"]))
    pagination = (
        "NOT_APPLICABLE_DETAIL_OPAQUE_404" if detail else
        "SIGNED_KEYSET_CURSOR_BOUND_TO_TENANT_CALLER_PURPOSE_POPULATION_FIELD_POLICY_ASOF_SORT"
    )
    tuple_value = {
        "queryOperation": operation["operationId"],
        "responseSchema": operation["operationId"] + ".Response.v3",
        "entity": "table:" + sources[0],
        "physicalSources": sources,
        "pep": {
            "authorizationCapability": operation["authorizationCapability"],
            "tenant": "authenticatedPrincipal.tenantId at every physical source",
            "purpose": operation["authorizationCapability"],
            "population": "authorization.populationScope exact",
            "fieldPolicy": "authorization.fieldPolicyRevision exact allowlist/mask",
            "denyOnUnavailable": True,
        },
        "tenantPep": "tenant_id=authenticatedPrincipal.tenantId at every source and join",
        "purpose": operation["authorizationCapability"],
        "population": "authorization.populationScope exact named population",
        "fieldPolicy": "authorization.fieldPolicyRevision; unknown field OMIT, restricted field MASK",
        "asOf": (
            "businessAsOf=query.referenceEffectiveAt or one captured owner transaction clock; "
            "systemAsOf=query.systemAsOf or the same captured clock; immutable rows require created_at<=systemAsOf"
        ),
        "freshness": "OWNER_TRANSACTIONAL_OR_EXPLICIT_PROJECTION_WATERMARK",
        "pagination": pagination,
        "writesForbidden": True,
        "receiptsForbidden": True,
        "outboxForbidden": True,
        "deepLinkWithoutCommandReceipt": True,
    }
    result = {
        "tables": sources,
        "projectionTuple": tuple_value,
        **{key: copy.deepcopy(tuple_value[key]) for key in (
            "tenantPep", "purpose", "population", "fieldPolicy", "asOf",
            "freshness", "pagination", "writesForbidden", "receiptsForbidden",
            "outboxForbidden", "deepLinkWithoutCommandReceipt",
        )},
    }
    temporal_sources = [
        table for table in sources if table in {
            "ppl_bnf_plan_versions", "ppl_cwk_engagement_versions",
            "ppl_jny_template_versions", "ppl_rec_requisition_versions",
            "prf_lrn_offering_versions", "prf_mkt_opportunity_versions",
            "prf_suc_plan_versions",
        }
    ]
    if temporal_sources:
        result["temporalResolution"] = {
            "strategy": "DUAL_APPEND_ONLY_ROOT_AND_EFFECTIVE_SEGMENT_CHAINS",
            "tables": temporal_sources,
            "systemAsOfRule": "FIRST_FILTER_created_at<=query.systemAsOf_OR_CAPTURED_OWNER_CLOCK",
            "baseSegmentRule": (
                "among visible segment_revision=1 rows choose maximum effective_from<=businessAsOf"
            ),
            "businessAsOfWinner": (
                "CONTENT_WINNER: within the chosen effective_segment_public_id choose maximum "
                "segment_revision independently of the global state winner"
            ),
            "stateWinner": (
                "STATE_WINNER: maximum root_version after the systemAsOf filter; source lifecycle "
                "state and stable-root aggregate version from this row"
            ),
            "derivedEffectiveTo": (
                "next visible base segment effective_from; last visible base segment is open ended"
            ),
            "exactHistorySelector": (
                "query.revisionPublicId OR query.rootVersion; when both are present they must name "
                "the same STATE_ROW; join STATE_ROW.content_revision_public_id to the exact content "
                "snapshot; no latest fallback"
            ),
            "unqualifiedMode": (
                "select CONTENT_WINNER by businessAsOf and STATE_WINNER by root_version independently"
            ),
            "correctionRule": "same segment/effective_from and exact segment predecessor revision+1",
            "futureSupersedeRule": "new segment revision 1; older segment still wins before derived boundary",
            "persistedEffectiveTo": "NULL_ONLY_NON_AUTHORITATIVE",
            "tenantAndParentPartitionRequired": True,
        }
    return result


def _new_command(base: dict[str, Any], operation_id: str) -> dict[str, Any]:
    (template_id, path, root, state_column, pre_states, post_states,
     post_source, writes) = NEW_COMMAND_RUNTIME[operation_id]
    templates = {row["operationId"]: row for row in base["operations"]}
    template = templates[template_id]
    row = copy.deepcopy(template)
    row.update({
        "operationId": operation_id, "method": "POST", "path": path, "mode": "COMMAND",
        "aggregateRoot": {
            "table": root, "publicIdColumn": "public_id",
            "versionColumn": "aggregate_version", "stateColumn": state_column,
            "tenantColumn": "tenant_id",
        },
        "transition": {
            "transitionId": "TR-" + operation_id.upper().replace(".", "-") + "-V3",
            "preStates": list(pre_states), "postStates": list(post_states),
            "postStateSource": post_source,
            "stateSink": f"{root}.{state_column}",
            "cas": "tenant+public_id+existing parent If-Match; new child/root version=1 server allocation",
        },
        "forbiddenRequestFields": [
            "tenantId", "actorId", "contentDigest", "effectiveFrom",
            "approvalCasePublicId", "correlationAsBusinessIdentity",
        ],
    })
    # Keep the reviewed capability/session/authorization of the exact family
    # template, but never its request or DML shape.
    path_fields = _path_fields(path, root)
    fields = [*path_fields, *_headers(command=True, if_match=True)]
    if len(post_states) > 1 and not post_source.startswith("LOCKED_PRE:"):
        fields.append(_field("decision", "body", "STRING", entity=None))
    row["requestFields"] = fields
    row["inputEffects"] = [
        _input_effect(field, root, state_column, command=True) for field in fields
    ]
    row["selectors"] = _selectors(path_fields, root, row["authorizationCapability"])
    row["orderedDml"] = _receipt_steps(
        row, _domain_steps(root, state_column, pre_states, writes)
    )
    row["events"] = [
        _event(name, row, root, state_column, pre_states, post_states)
        for name in events_for_new_operation(operation_id)
    ]
    row["transactionEnvelope"] = {
        "boundary": "ONE_OWNER_DATABASE_TRANSACTION",
        "stepOrder": "CLAIM_FIRST_DOMAIN_THEN_CLOSED_RECEIPT_OUTBOX_LAST",
        "idempotencyTuple": "tenant+caller+operation+Idempotency-Key",
        "canonicalRequestDigestExcludes": [
            "Idempotency-Key", "X-Correlation-ID", "authorization snapshot",
            "purpose snapshot", "population snapshot",
        ],
        "replay": {"identicalDigest": "RETURN_SEALED_ORIGINAL_RESULT_ZERO_WRITES",
                   "differentDigest": "409_ZERO_DOMAIN_RECEIPT_OUTBOX_WRITES"},
        "rollback": "ANY_STEP_FAILURE_ROLLS_BACK_ALL_STEPS",
    }
    _repair_decision_facts(row)
    _repair_typed_children_and_special_writes(row)
    domain_steps = [
        copy.deepcopy(step) for step in row["orderedDml"]
        if step.get("role") not in {"COMMAND_RECEIPT", "TRANSACTIONAL_OUTBOX"}
    ]
    row["orderedDml"] = _receipt_steps(row, domain_steps)
    _apply_ai_governance_boundary(row)
    return row


def _new_query(base: dict[str, Any], operation_id: str) -> dict[str, Any]:
    template_id, path, tables = NEW_QUERY_RUNTIME[operation_id]
    templates = {row["operationId"]: row for row in base["operations"]}
    row = copy.deepcopy(templates[template_id])
    root = tables[0]
    path_fields = _path_fields(path, root)
    list_query = not path_fields
    fields = [*path_fields]
    fields.append(_field("referenceEffectiveAt", "queryParameters", "TIMESTAMPTZ",
                         required=False, entity=None))
    if list_query:
        fields.extend([
            _field("cursor", "queryParameters", "STRING", required=False, entity=None),
            _field("limit", "queryParameters", "INTEGER", required=False, entity=None),
        ])
    fields.extend(_headers(command=False, if_match=False))
    row.update({
        "operationId": operation_id, "method": "GET", "path": path, "mode": "QUERY",
        "requestFields": fields,
        "inputEffects": [_input_effect(field, root, "state", command=False) for field in fields],
        "selectors": _selectors(path_fields, root, row["authorizationCapability"]),
        "readPlan": _query_read_plan({**row, "operationId": operation_id, "path": path}, tables),
        "orderedDml": [], "events": [],
    })
    _apply_ai_governance_boundary(row)
    return row


def _normalize_trace_and_digest(operation: dict[str, Any]) -> None:
    for field in operation.get("requestFields", []):
        if field.get("name") == "X-Correlation-ID":
            field.pop("referenceContract", None)
            field.update({"type": "UUID", "tokenization": "OPAQUE_CORRELATION_ID",
                          "traceContract": "Trace.Correlation", "requestDigestMember": False})
        elif field.get("name") == "Idempotency-Key":
            field["requestDigestMember"] = False
    for effect in operation.get("inputEffects", []):
        if effect.get("source") in {"headers.X-Correlation-ID", "headers.Idempotency-Key"}:
            effect["requestDigestMember"] = False
    receipt = RECEIPT_TABLE[operation["session"]]
    for event in operation.get("events", []):
        for field in event.get("fields", []):
            if field.get("name") == "correlationId":
                field.pop("referenceContract", None)
                field.update({
                    "sourceKind": "SEALED_COMMAND_RECEIPT",
                    "source": receipt + ".correlation_id",
                    "traceContract": "Trace.Correlation",
                    "tokenization": "OPAQUE_CORRELATION_ID",
                })
    envelope = operation.get("transactionEnvelope")
    if isinstance(envelope, dict) and operation.get("mode") == "COMMAND":
        envelope["idempotencyTuple"] = "tenant+caller+operation+Idempotency-Key"
        envelope["canonicalRequestDigestExcludes"] = [
            "Idempotency-Key", "X-Correlation-ID", "authorization snapshot",
            "purpose snapshot", "population snapshot",
        ]


def _remove_request_field(operation: dict[str, Any], names: set[str]) -> None:
    sources = {
        field["source"] for field in operation.get("requestFields", [])
        if field.get("name") in names
    }
    operation["requestFields"] = [
        field for field in operation.get("requestFields", []) if field.get("name") not in names
    ]
    operation["inputEffects"] = [
        row for row in operation.get("inputEffects", []) if row.get("source") not in sources
    ]
    for step in operation.get("orderedDml", []):
        for column, source in list(step.get("assignments", {}).items()):
            if any(token in str(source) for token in sources):
                step["assignments"][column] = "SERVER_DERIVE:locked canonical owner fact"


def _domain_step(operation: dict[str, Any], table: str) -> dict[str, Any] | None:
    return next((
        step for step in operation.get("orderedDml", [])
        if step.get("table") == table
        and step.get("role") not in {"COMMAND_RECEIPT", "TRANSACTIONAL_OUTBOX"}
    ), None)


def _append_fact_step(
    operation: dict[str, Any], table: str, assignments: dict[str, str],
    *, action: str = "APPEND", role: str = "IMMUTABLE_TYPED_DOMAIN_FACT",
) -> dict[str, Any]:
    assignments = {
        "created_by": "authenticatedPrincipal.publicId",
        "correlation_id": "headers.X-Correlation-ID",
        **assignments,
    }
    existing = _domain_step(operation, table)
    if existing is not None:
        existing.setdefault("assignments", {}).update(assignments)
        return existing
    step = {
        "action": action, "table": table, "role": role,
        "selector": "tenant+locked parent+owner-generated replay-stable identity",
        "assignments": assignments, "expectedRows": "EXACTLY_ONE",
        "failureInjectionAssertion": "all domain/control/proof/outbox writes roll back",
    }
    # Insert before the receipt completion/outbox steps.  The final receipt
    # wrapper will renumber the transaction deterministically.
    insertion = next((
        index for index, value in enumerate(operation.get("orderedDml", []))
        if value.get("role") in {"COMMAND_RECEIPT", "TRANSACTIONAL_OUTBOX"}
        and value.get("action") != "CLAIM_OR_REPLAY"
    ), len(operation.get("orderedDml", [])))
    operation.setdefault("orderedDml", []).insert(insertion, step)
    return step


def _approval_sources(operation_id: str) -> dict[str, str]:
    if operation_id == "modern.compplan.snapshot.publish":
        return {
            "approval_receipt_public_id": "LOCKED_PRE:prf_cmp_plans.approval_receipt_public_id",
            "approval_receipt_revision": "LOCKED_PRE:prf_cmp_plans.approval_receipt_revision",
            "approval_outcome": "LOCKED_PRE:prf_cmp_plans.approval_outcome",
            "approval_action": "LOCKED_PRE:prf_cmp_plans.approval_action",
            "approval_input_digest": "LOCKED_PRE:prf_cmp_plans.approval_input_digest",
            "approval_purpose_code": "LOCKED_PRE:prf_cmp_plans.approval_purpose_code",
            "approval_tenant_id": "LOCKED_PRE:prf_cmp_plans.approval_tenant_id",
        }
    if operation_id == "modern.workforceplan.scenario.publish":
        prefix = "LOCKED_PRE:ppl_wfp_scenario_revisions."
    elif operation_id == "modern.succession.plan.publish":
        prefix = "LOCKED_PRE:prf_suc_plans."
    elif operation_id == "modern.wfm.schedule.publish":
        prefix = "LOCKED_PRE:tme_wfm_approval_requests."
    else:
        return dict(APPROVAL_PROOF_COLUMNS)
    return {name: prefix + name for name in APPROVAL_PROOF_COLUMNS}


def _repair_publish_proof(operation: dict[str, Any]) -> None:
    operation_id = operation["operationId"]
    if operation_id not in PUBLISH_OPERATION_IDS:
        return
    table = PUBLISH_PROOF_TABLE[operation_id]
    if operation_id == "modern.workforceplan.scenario.publish":
        _remove_request_field(operation, {"approvalCasePublicId"})
    direct_refetch = operation_id not in {
        "modern.workforceplan.scenario.publish", "modern.succession.plan.publish",
        "modern.compplan.snapshot.publish", "modern.wfm.schedule.publish",
    }
    if direct_refetch and not any(
        field.get("name") == "approvalReceiptId"
        for field in operation.get("requestFields", [])
    ):
        field = _field(
            "approvalReceiptId", "body", "UUID", required=True,
            entity="Approval.DecisionReceipt",
        )
        operation["requestFields"].append(field)
        operation.setdefault("inputEffects", []).append({
            "source": field["source"], "type": "UUID", "required": True,
            "sensitivity": "RESTRICTED", "requestDigestMember": True,
            "effects": [{
                "kind": "IMMUTABLE_OWNER_PROOF_SELECTOR",
                "target": table + ".approval_receipt_public_id",
                "cardinality": "EXACT_ONE_TENANT_PURPOSE_ACTION_INPUT_VERSION",
            }],
        })
    assignments = {
        "tenant_id": "authenticatedPrincipal.tenantId",
        **_approval_sources(operation_id),
    }
    step = _domain_step(operation, table)
    if step is not None and operation_id == "modern.workforceplan.scenario.publish":
        step.get("assignments", {}).pop("approval_case_public_id", None)
    if step is not None and operation_id == "modern.compplan.snapshot.publish":
        step.get("assignments", {}).pop("approval_receipt_id", None)
        step.get("assignments", {}).pop("approval_revision", None)
    if step is None:
        root = operation.get("aggregateRoot", {}).get("table", "")
        if table == "sys_hris_listening_survey_versions":
            assignments.update({
                "state": "CONSTANT:PUBLISHED",
                "aggregate_version": "LOCKED_PRE:aggregate_version+1",
                "updated_at": "ownerClock.transactionNow",
            })
            step = _append_fact_step(
                operation, table, assignments, action="UPDATE_CAS",
                role="IMMUTABLE_PUBLISH_APPROVAL_PROOF",
            )
            step["selector"] = (
                "tenant+locked survey current version+allowed DRAFT pre-state"
            )
        else:
            assignments.update({
                "parent_public_id": f"LOCKED_POST:{root}.public_id",
                "parent_version": f"LOCKED_POST:{root}.aggregate_version",
                "fact_revision": f"LOCKED_POST:{root}.aggregate_version",
                "state": "CONSTANT:PUBLISHED",
                "ordinal": "CONSTANT:1",
                "payload_digest": "SERVER_DERIVE:canonical immutable publish proof",
                "reference_effective_at": "ownerClock.transactionNow",
            })
            step = _append_fact_step(operation, table, assignments,
                                     role="IMMUTABLE_PUBLISH_APPROVAL_PROOF")
    else:
        step.setdefault("assignments", {}).update(assignments)
        if "IMMUTABLE_PUBLISH_APPROVAL_PROOF" not in step.get("role", ""):
            step["role"] = (
                step.get("role", "") + "+IMMUTABLE_PUBLISH_APPROVAL_PROOF"
            ).strip("+")
    step["approvalProofContract"] = {
        "kind": "TYPED_IMMUTABLE_APPROVAL_DECISION_PROOF",
        "requiredColumns": list(APPROVAL_PROOF_COLUMNS),
        "exactMatch": "tenant+purpose+action+inputDigest+outcome+receiptId+revision",
        "restartReplay": "RECONSTRUCT_WITHOUT_COMMAND_RECEIPT_OR_OWNER_REFETCH",
    }
    proof_event_fields = (
        ("approvalReceiptId", "UUID", "approval_receipt_public_id", "Approval.DecisionReceipt"),
        ("approvalReceiptRevision", "BIGINT", "approval_receipt_revision", None),
        ("approvalOutcome", "STRING", "approval_outcome", None),
        ("approvalAction", "STRING", "approval_action", None),
        ("approvalInputDigest", "SHA256", "approval_input_digest", None),
        ("approvalPurposeCode", "STRING", "approval_purpose_code", None),
        ("approvalTenantId", "BIGINT", "approval_tenant_id", None),
    )
    if table in {
        "ppl_rec_requisition_publish_receipts", "prf_lrn_offering_publish_receipts",
        "prf_mkt_opportunity_publish_receipts", "prf_suc_publish_receipts",
    }:
        proof_event_fields += (
            (
                "publishedParentId", "UUID", "parent_public_id",
                operation.get("events", [{}])[0].get("aggregateEntityType"),
            ),
            ("publishedParentVersion", "BIGINT", "parent_version", None),
            ("publicationProofDigest", "SHA256", "payload_digest", None),
        )
    replaced_names = {name for name, *_ in proof_event_fields} | {"approvalRevision"}
    for event in operation.get("events", []):
        event["fields"] = [
            field for field in event.get("fields", [])
            if field.get("name") not in replaced_names
        ]
        for name, field_type, column_name, entity in proof_event_fields:
            event["fields"].append(_event_field(
                name, field_type, "IMMUTABLE_OWNER_PROOF",
                table + "." + column_name, entity=entity,
            ))
        event["audience"]["fieldExposure"]["fields"] = [
            field["name"] for field in event["fields"]
        ]


def _repair_decision_facts(operation: dict[str, Any]) -> None:
    operation_id = operation["operationId"]
    if operation_id == "modern.growth.profile.archive":
        _remove_request_field(operation, {"portabilityExportRequested"})
        for step in operation.get("orderedDml", []):
            step.pop("decisionDependencies", None)
    for effect in operation.get("inputEffects", []):
        key = (operation_id, effect.get("source"))
        target = DECISION_FACT_TARGETS.get(key)
        repaired = []
        for value in effect.get("effects", []):
            if value.get("kind") == "PERSISTED_DECISION_RECEIPT":
                if target is None:
                    continue
                table, column = target
                repaired.append({
                    "kind": "TYPED_DURABLE_DOMAIN_FACT_OR_OWNER_PROOF",
                    "target": table + "." + column,
                    "durability": "SAME_TRANSACTION_PHYSICAL_ASSIGNMENT",
                    "commandReceiptBusinessProvenanceForbidden": True,
                })
            else:
                repaired.append(value)
        effect["effects"] = repaired

    # Decision operations that lacked their domain fact/owner proof write.
    if operation_id == "modern.benefits.enrollment.decide":
        _append_fact_step(operation, "ppl_bnf_enrollment_decisions", {
            "tenant_id": "authenticatedPrincipal.tenantId",
            "parent_public_id": "LOCKED_POST:ppl_bnf_enrollments.public_id",
            "parent_version": "LOCKED_POST:ppl_bnf_enrollments.aggregate_version",
            "fact_revision": "LOCKED_POST:ppl_bnf_enrollments.aggregate_version",
            "state": "MAP:body.decision APPROVE->APPROVED REJECT->REJECTED",
            "ordinal": "CONSTANT:1", "payload_digest": "SERVER_DERIVE:canonical decision fact",
            "reference_effective_at": "ownerClock.transactionNow",
            **_typed_decision_proof_sources("approvalReceiptId"),
        })
    elif operation_id == "modern.compplan.budget.allocate":
        step = _domain_step(operation, "prf_cmp_budget_ledger")
        if step: step.setdefault("assignments", {})["entry_type"] = "body.ledgerEntryType"
    elif operation_id == "modern.compplan.plan.approve":
        step = _domain_step(operation, "prf_cmp_plans")
        if step:
            step.setdefault("assignments", {}).pop("approval_revision", None)
            step["assignments"].update(APPROVAL_PROOF_COLUMNS)
    elif operation_id == "modern.onboarding.task.complete":
        step = _domain_step(operation, "ppl_jny_task_evidence")
        if step: step.setdefault("assignments", {})["completion_code"] = "body.completionCode"
    elif operation_id in {"modern.opportunity.selection.record", "modern.opportunity.shortlist"}:
        state = ("MAP:body.decision SELECT->SELECTED NOT_SELECT->NOT_SELECTED"
                 if operation_id.endswith("selection.record") else "CONSTANT:SHORTLISTED")
        _append_fact_step(operation, "prf_mkt_application_decisions", {
            "tenant_id": "authenticatedPrincipal.tenantId",
            "parent_public_id": "LOCKED_POST:prf_mkt_applications.public_id",
            "parent_version": "LOCKED_POST:prf_mkt_applications.aggregate_version",
            "fact_revision": "LOCKED_POST:prf_mkt_applications.aggregate_version",
            "state": state, "ordinal": "CONSTANT:1",
            "payload_digest": "SERVER_DERIVE:canonical application decision",
            "reference_effective_at": "ownerClock.transactionNow",
            **_typed_decision_proof_sources(
                "approvalReceiptId" if operation_id.endswith("selection.record")
                else "humanDecisionReceiptId"
            ),
        })
    elif operation_id == "modern.recruiting.candidate.stage":
        _append_fact_step(operation, "ppl_rec_candidate_stage_history", {
            "tenant_id": "authenticatedPrincipal.tenantId",
            "parent_public_id": "LOCKED_POST:ppl_rec_candidate_cases.public_id",
            "parent_version": "LOCKED_POST:ppl_rec_candidate_cases.aggregate_version",
            "fact_revision": "LOCKED_POST:ppl_rec_candidate_cases.aggregate_version",
            "state": "body.targetStage", "ordinal": "CONSTANT:1",
            "payload_digest": "SERVER_DERIVE:canonical stage fact",
            "reference_effective_at": "ownerClock.transactionNow",
            **_typed_decision_proof_sources("decisionReceiptId"),
        })
    elif operation_id == "modern.recruiting.hire.record":
        step = _domain_step(operation, "ppl_rec_hire_requests")
        if step:
            step.setdefault("assignments", {}).update({
                "decision_outcome": "ownerProof.body.humanDecisionReceiptId.outcome",
                "decision_receipt_revision": "ownerProof.body.humanDecisionReceiptId.revision",
                "decision_action": "ownerProof.body.humanDecisionReceiptId.action",
                "decision_input_digest": "ownerProof.body.humanDecisionReceiptId.inputDigest",
                "decision_purpose_code": "ownerProof.body.humanDecisionReceiptId.purposeCode",
                "decision_tenant_id": "ownerProof.body.humanDecisionReceiptId.tenantId",
            })
    elif operation_id == "modern.skills.evidence.verify":
        step = _domain_step(operation, "prf_skl_worker_evidence")
        if step:
            step.setdefault("assignments", {}).update({
                "verification_receipt_revision": "ownerProof.body.verificationReceiptId.revision",
                "verification_outcome": "ownerProof.body.verificationReceiptId.outcome",
                "verification_action": "ownerProof.body.verificationReceiptId.action",
                "verification_input_digest": "ownerProof.body.verificationReceiptId.inputDigest",
                "verification_purpose_code": "ownerProof.body.verificationReceiptId.purposeCode",
                "verification_tenant_id": "ownerProof.body.verificationReceiptId.tenantId",
            })
    elif operation_id == "modern.succession.plan.approve":
        step = _domain_step(operation, "prf_suc_plans")
        if step: step.setdefault("assignments", {}).update(APPROVAL_PROOF_COLUMNS)
    elif operation_id == "modern.workforceplan.scenario.approve":
        step = _domain_step(operation, "ppl_wfp_scenario_revisions")
        if step: step.setdefault("assignments", {}).update(APPROVAL_PROOF_COLUMNS)


def _repair_typed_children_and_special_writes(operation: dict[str, Any]) -> None:
    operation_id = operation["operationId"]
    child_specs = {
        "modern.growth.coaching.record": (
            "prf_grw_coaching_notes", "prf_grw_coaching_note_evidence_refs",
            "body.evidenceRefs[*]", "evidence_public_id"),
        "modern.growth.profile.update": (
            "prf_grw_profile_revisions", "prf_grw_profile_revision_evidence_refs",
            "body.evidenceRefs[*]", "evidence_public_id"),
        "modern.learning.completion.verify": (
            "prf_lrn_completion_evidence", "prf_lrn_completion_skill_evidence_refs",
            LEARNING_SKILL_EVIDENCE_OWNER_SOURCE, "skill_evidence_public_id"),
        "modern.analytics.export.create": (
            "sys_hris_analytics_export_receipts", "sys_hris_analytics_export_projection_refs",
            "body.metricProjectionIds[*]", "metric_projection_public_id"),
    }
    spec = child_specs.get(operation_id)
    if spec:
        parent, child, source, column = spec
        parent_step = _domain_step(operation, parent)
        if parent_step:
            for stale in ("evidence_refs", "skill_evidence_ids", "metric_projection_ids"):
                parent_step.get("assignments", {}).pop(stale, None)
        _append_fact_step(operation, child, {
            "tenant_id": "authenticatedPrincipal.tenantId",
            "parent_public_id": f"PREVIOUS:{parent}.public_id",
            "ordinal": "SERVER_DERIVE:validated request order then public ID tie-breaker",
            column: source,
        }, action="APPEND_MANY", role="TYPED_ORDERED_CHILD_REFERENCE")
    if operation_id == "modern.contingent.engagement.create":
        root_step = _domain_step(operation, "ppl_cwk_engagements")
        if root_step:
            root_step.setdefault("assignments", {}).update({
                "effective_from": "body.effectiveFrom",
                "engagement_occurrence_no": (
                    "SERVER_ALLOCATE:next tenant+worker recurrence under advisory lock"
                ),
            })
        _append_fact_step(operation, "ppl_cwk_sponsor_assignments", {
            "tenant_id": "authenticatedPrincipal.tenantId",
            "contingent_engagement_id": "PREVIOUS:ppl_cwk_engagements.contingent_engagement_id",
            "assignment_revision": "CONSTANT:1",
            "sponsor_worker_public_id": "body.sponsorWorkerPublicId",
            "valid_from": "body.effectiveFrom", "valid_to": "body.effectiveTo IF PRESENT",
        }, action="INSERT", role="INITIAL_SPONSOR_ASSIGNMENT")
    if operation_id == "modern.contingent.sponsor.reassign":
        step = _domain_step(operation, "ppl_cwk_sponsor_assignments")
        if step:
            step.update({
                "action": "UPDATE_CAS", "selector": (
                    "tenant+contingent_engagement_id+current open assignment_revision+If-Match"
                ), "expectedRows": "EXACTLY_ONE_EXISTING_OPEN_ASSIGNMENT",
            })
            step.setdefault("assignments", {}).update({
                "assignment_revision": "LOCKED_PRE:assignment_revision+1",
                "sponsor_worker_public_id": "body.sponsorWorkerPublicId",
                "valid_to": "body.validFrom",
            })
    if operation_id == "modern.compplan.proposal.upsert":
        step = _domain_step(operation, "prf_cmp_proposals")
        if step:
            position = operation["orderedDml"].index(step)
            operation["orderedDml"] = [
                value for value in operation["orderedDml"]
                if value.get("table") != "prf_cmp_proposals"
            ]
            common = {
                **step.get("assignments", {}),
                "status": "derived.transition_post_state",
            }
            insert_assignments = {
                **common,
                "tenant_id": "authenticatedPrincipal.tenantId",
                "public_id": "pathParameters.proposalId replay-stable public identity",
                "aggregate_version": "CONSTANT:1",
                "created_by": "authenticatedPrincipal.publicId",
                "correlation_id": "headers.X-Correlation-ID",
            }
            update_assignments = {
                key: value for key, value in common.items()
                if key not in {"tenant_id", "public_id", "created_by", "correlation_id"}
            }
            update_assignments.update({
                "aggregate_version": "LOCKED_PRE:aggregate_version+1",
                "updated_at": "ownerClock.transactionNow",
                "updated_by": "authenticatedPrincipal.publicId",
            })
            base = {
                key: value for key, value in step.items()
                if key not in {"action", "selector", "assignments", "expectedRows"}
            }
            branch_contract = {
                "mutuallyExclusiveBranchGroup": "proposal-upsert-prestate",
                "branchSelection": "LOCK_ONCE_THEN_EXACTLY_ONE_NONE_OR_DRAFT_BRANCH",
                "branchCardinality": "EXACTLY_ONE_SELECTED_BRANCH",
            }
            operation["orderedDml"][position:position] = [
                {
                    **base, "action": "INSERT",
                    "branchCondition": "LOCKED_PRE_STATE=NONE_AND_ROW_ABSENT",
                    "selector": "tenant+cycle+proposal public ID must be absent",
                    "assignments": insert_assignments,
                    "expectedRows": "EXACTLY_ONE_IF_NONE_BRANCH_ELSE_ZERO",
                    **branch_contract,
                },
                {
                    **base, "action": "UPDATE_CAS",
                    "branchCondition": "LOCKED_PRE_STATE=DRAFT_AND_IF_MATCH_EXACT",
                    "selector": "tenant+cycle+proposal public ID+If-Match; status=DRAFT",
                    "assignments": update_assignments,
                    "expectedRows": "EXACTLY_ONE_IF_DRAFT_BRANCH_ELSE_ZERO",
                    **branch_contract,
                },
            ]
    if operation_id == "modern.growth.export.request":
        step = _domain_step(operation, "prf_grw_portability_export_receipts")
        if step:
            step.setdefault("assignments", {}).update({
                "parent_public_id": "pathParameters.profileId",
                "parent_version": "LOCKED_PRE:prf_grw_profiles.aggregate_version",
                "fact_revision": "CONSTANT:1", "ordinal": "CONSTANT:1",
                "payload_digest": "SERVER_DERIVE:canonical export request",
                "reference_effective_at": "ownerClock.transactionNow",
                "request_digest": "SERVER_DERIVE:canonical validated export intent",
                "requested_at": "ownerClock.transactionNow",
            })
    if operation_id == "modern.wfm.forecast.create":
        step = _domain_step(operation, "tme_wfm_forecast_revision_counters")
        if step:
            step.get("assignments", {}).pop("current_revision", None)
            step.setdefault("assignments", {})["last_revision"] = "ALLOCATE:locked-last+1"
    if operation_id == "modern.wfm.schedule.validate":
        step = _domain_step(operation, "tme_wfm_fairness_measure_values")
        if step:
            for stale in (
                "line_sequence", "metric_code", "cohort_digest", "measured_value",
                "threshold_value", "outcome", "result_digest",
            ):
                step.get("assignments", {}).pop(stale, None)
            step.setdefault("assignments", {})["ordinal"] = (
                "ENGINE:fairnessMeasures[*].stableOrdinal"
            )
    if operation_id == "modern.wfm.schedule.optimize":
        step = _domain_step(operation, "tme_wfm_optimization_requests")
        if step:
            step.setdefault("assignments", {})["forecast_public_id"] = (
                "LOCKED_PRE:tme_wfm_demand_forecasts.public_id"
            )


def _apply_ai_governance_boundary(operation: dict[str, Any]) -> None:
    """Bind HRIS AI operations to central DWP governance without cloning it."""
    if not operation["operationId"].startswith("modern.ai."):
        return
    operation["aiGovernanceBoundary"] = {
        "owner": "DWP-COMMON-AI-GOVERNANCE",
        "localResponsibility": (
            "HRIS persists exact typed immutable proof IDs/revisions and the owner "
            "activation receipt; central governance owns models, prompts, datasets, "
            "risk, TEVV, disclosure, oversight, incidents, rollback, monitoring and kill switch"
        ),
        "useCase": "EMPLOYMENT_HRIS",
        "riskClassification": "OWNER_CLASSIFIED_FAIL_CLOSED",
        "requiredProofs": copy.deepcopy(list(AI_GOVERNANCE_REQUIRED_PROOFS)),
        "activationReceipt": {
            "field": "governanceActivationReceiptId",
            "entityType": "DWP.AIGovernance.ActivationReceipt",
            "exactMatch": (
                "tenant+useCase+riskClassification+all artifact revisions+purpose+population+"
                "humanOversight+disclosure+impact+conformity+incident+rollback+monitoring+killSwitch"
            ),
        },
        "affectedPersonDisclosureEvidence": {
            "field": "affectedPersonDisclosureEvidenceId",
            "entityType": "DWP.AIGovernance.AffectedPersonDisclosureEvidence",
            "requiredBeforeEmploymentAssistanceExposure": True,
        },
        "monitoring": {
            "expiry": "exact owner activation receipt expiry; no latest fallback",
            "killSwitch": "deny immediately when exact control revision is disabled",
            "incidentAndRollback": "exact version pins required and owner status revalidated",
        },
        "frameworkControl": "GOVERN_MAP_MEASURE_MANAGE_PLUS_TEVV",
        "activationGate": "G6_FAIL_CLOSED_WHEN_ANY_PROOF_MISSING_STALE_RETIRED_OR_CROSS_TENANT",
    }

    # The policy draft/revision is the only HRIS ingress that selects the full
    # central proof set.  Evaluate/publish/retire/kill-switch commands derive it
    # from the locked immutable policy version; assistance additionally seals
    # the exact activation and affected-person disclosure evidence.
    if operation["operationId"] in {"modern.ai.policy.create", "modern.ai.policy.revise"}:
        if operation["operationId"] == "modern.ai.policy.revise":
            for name, field_type, required in (
                ("displayName", "STRING", True),
                ("validFrom", "TIMESTAMPTZ", True),
                ("validTo", "TIMESTAMPTZ", False),
                ("humanControlMode", "STRING", True),
            ):
                field = _field(name, "body", field_type, required=required, entity=None)
                operation["requestFields"].append(field)
                operation["inputEffects"].append({
                    "source": field["source"], "type": field_type, "required": required,
                    "sensitivity": "INTERNAL", "requestDigestMember": True,
                    "effects": [{"kind": "TYPED_DOMAIN_INPUT",
                                 "target": "sys_hris_ai_policy_versions." + _snake(name)}],
                })
        existing = {field["name"] for field in operation.get("requestFields", [])}
        for proof in AI_GOVERNANCE_REQUIRED_PROOFS:
            if proof["field"] in existing:
                continue
            field = _field(
                proof["field"], "body", "UUID", required=True,
                entity=proof["entityType"],
            )
            operation["requestFields"].append(field)
            operation["inputEffects"].append({
                "source": field["source"], "type": "UUID", "required": True,
                "sensitivity": "RESTRICTED", "requestDigestMember": True,
                "effects": [{
                    "kind": "IMMUTABLE_OWNER_PROOF_SELECTOR",
                    "target": "sys_hris_ai_policy_versions." + re.sub(
                        r"(?<!^)(?=[A-Z])", "_", proof["field"]
                    ).lower(),
                    "cardinality": "EXACT_ONE_TENANT_PURPOSE_POPULATION_VERSION",
                }],
            })
        version_steps = [
            step for step in operation.get("orderedDml", [])
            if step.get("table") == "sys_hris_ai_policy_versions"
        ]
        if len(version_steps) != 1:
            raise ValueError(
                f"AI policy proof version write is not exact: {operation['operationId']}"
            )
        assignments = version_steps[0].setdefault("assignments", {})
        for proof in AI_GOVERNANCE_REQUIRED_PROOFS:
            column_name = re.sub(r"(?<!^)(?=[A-Z])", "_", proof["field"]).lower()
            assignments[column_name] = "body." + proof["field"]
        assignments["proof_set_digest"] = (
            "SERVER_DERIVE:canonical typed central AI-governance proof IDs and owner revisions"
        )
        policy_step = next(
            step for step in operation.get("orderedDml", [])
            if step.get("table") == "sys_hris_ai_use_policies"
            and step.get("role") not in {"COMMAND_RECEIPT", "TRANSACTIONAL_OUTBOX"}
        )
        policy_step.setdefault("assignments", {})["risk_classification"] = (
            "ownerProof.body.riskClassificationVersionId.classification"
        )
        if operation["operationId"] == "modern.ai.policy.revise":
            assignments.update({
                "ai_use_policy_id": "LOCKED_PRE:sys_hris_ai_use_policies.ai_use_policy_id",
                "effective_from": "body.validFrom", "effective_to": "body.validTo IF PRESENT",
                "human_control_mode": "body.humanControlMode",
                "version_no": "LOCKED_PRE:sys_hris_ai_use_policies.policy_version+1",
                "payload_digest": "SERVER_DERIVE:canonical immutable policy version row",
                "policy_digest": "SERVER_DERIVE:canonical immutable policy version content",
            })
            policy_step["assignments"].update({
                "display_name": "body.displayName", "valid_from": "body.validFrom",
                "valid_to": "body.validTo IF PRESENT",
                "policy_version": "LOCKED_PRE:policy_version+1",
            })
    if operation["operationId"] == "modern.ai.policy.evaluate":
        _remove_request_field(operation, {
            "evaluationSuiteVersion", "fixtureSetDigest", "modelRouteKey",
        })
        request_step = next(
            step for step in operation.get("orderedDml", [])
            if step.get("table") == "sys_hris_ai_evaluation_requests"
        )
        request_step["assignments"].update({
            "ai_policy_version_id": "LOCKED_PRE:sys_hris_ai_policy_versions.ai_policy_version_id",
            "policy_public_id": "LOCKED_PRE:sys_hris_ai_use_policies.public_id",
            "policy_version_public_id": "LOCKED_PRE:sys_hris_ai_policy_versions.public_id",
            "evaluation_protocol_version_id": (
                "LOCKED_PRE:sys_hris_ai_policy_versions.evaluation_protocol_version_id"
            ),
            "dataset_manifest_version_id": (
                "LOCKED_PRE:sys_hris_ai_policy_versions.dataset_manifest_version_id"
            ),
            "model_version_id": "LOCKED_PRE:sys_hris_ai_policy_versions.model_version_id",
            "request_digest": (
                "SERVER_DERIVE:locked immutable policy version and central proof set"
            ),
        })
        for legacy in (
            "policy_version", "evaluation_suite_version", "fixture_set_digest",
            "model_route_key",
        ):
            request_step["assignments"].pop(legacy, None)
    if operation["operationId"] == "modern.ai.policy.publish":
        field = _field(
            "governanceActivationReceiptId", "body", "UUID", required=True,
            entity="DWP.AIGovernance.ActivationReceipt",
        )
        if not any(row["name"] == field["name"] for row in operation["requestFields"]):
            operation["requestFields"].append(field)
            operation["inputEffects"].append({
                "source": field["source"], "type": "UUID", "required": True,
                "sensitivity": "RESTRICTED", "requestDigestMember": True,
                "effects": [{
                    "kind": "IMMUTABLE_OWNER_PROOF_SELECTOR",
                    "target": "sys_hris_ai_use_policies.governance_activation_receipt_id",
                    "cardinality": "EXACT_ONE_TENANT_PURPOSE_POPULATION_VERSION",
                }],
            })
        policy_step = next(
            step for step in operation.get("orderedDml", [])
            if step.get("table") == "sys_hris_ai_use_policies"
            and step.get("role") not in {"COMMAND_RECEIPT", "TRANSACTIONAL_OUTBOX"}
        )
        policy_step.setdefault("assignments", {}).update({
            "governance_activation_receipt_id": "body.governanceActivationReceiptId",
            "governance_activation_receipt_revision": (
                "ownerProof.body.governanceActivationReceiptId.revision"
            ),
            "governance_expires_at": "ownerProof.body.governanceActivationReceiptId.expiresAt",
            "monitoring_status": "ownerProof.body.governanceActivationReceiptId.monitoringStatus",
            "kill_switch_enabled": "ownerProof.body.governanceActivationReceiptId.killSwitchEnabled",
        })
    if operation["operationId"] == "modern.ai.assist.create":
        _remove_request_field(operation, {
            "instructionDigest", "sourceReferenceIds", "humanConfirmation",
        })
        for name, entity_type in (
            ("instructionArtifactVersionId", "DWP.Content.ProtectedInstructionArtifactVersion"),
            ("sourceProjectionBundleReceiptId", "DWP.DataGovernance.AuthorizedProjectionBundleReceipt"),
            ("governanceActivationReceiptId", "DWP.AIGovernance.ActivationReceipt"),
            ("affectedPersonDisclosureEvidenceId", "DWP.AIGovernance.AffectedPersonDisclosureEvidence"),
        ):
            if any(field.get("name") == name for field in operation["requestFields"]):
                continue
            field = _field(name, "body", "UUID", required=True, entity=entity_type)
            operation["requestFields"].append(field)
            operation["inputEffects"].append({
                "source": field["source"], "type": "UUID", "required": True,
                "sensitivity": "RESTRICTED", "requestDigestMember": True,
                "effects": [{
                    "kind": "IMMUTABLE_OWNER_PROOF_SELECTOR",
                    "target": "sys_hris_ai_assistance_requests." + re.sub(
                        r"(?<!^)(?=[A-Z])", "_", name
                    ).lower(),
                    "cardinality": "EXACT_ONE_TENANT_PURPOSE_POPULATION_VERSION",
                }],
            })
        root = "sys_hris_ai_assistance_requests"
        operation["aggregateRoot"] = {
            "table": root, "publicIdColumn": "public_id",
            "versionColumn": "aggregate_version", "stateColumn": "state",
            "tenantColumn": "tenant_id",
        }
        operation["transition"] = {
            "transitionId": "TR-MODERN-AI-ASSIST-CREATE-V3",
            "preStates": ["NONE"], "postStates": ["REQUESTED"],
            "postStateSource": "CONSTANT:REQUESTED",
            "stateSink": root + ".state",
            "cas": "new root version=1 owner allocation; no phantom pre-state",
        }
        operation["selectors"] = [{
            "source": "body." + name,
            "selectorType": "IMMUTABLE_OWNER_PROOF",
            "entityType": entity_type, "idSpace": "PUBLIC_UUID",
            "sourceType": "UUID", "targetTable": "OWNER_PORT::" + entity_type,
            "targetColumn": "publicId", "targetSqlType": "UUID", "operator": "=",
            "cardinality": "EXACTLY_ONE",
            "tenantFilter": "tenant=authenticatedPrincipal.tenantId",
            "purposeFilter": operation["authorizationCapability"],
            "versionRule": "EXACT_IMMUTABLE_REVISION_NO_LATEST_FALLBACK",
            "asOfRule": "referenceEffectiveAt within proof validity window",
            "causalJoin": "typed signed owner proof sealed in local request root",
            "failure": "403/404/409/503 fail closed with zero mutation",
        } for name, entity_type in (
            ("instructionArtifactVersionId", "DWP.Content.ProtectedInstructionArtifactVersion"),
            ("sourceProjectionBundleReceiptId", "DWP.DataGovernance.AuthorizedProjectionBundleReceipt"),
            ("governanceActivationReceiptId", "DWP.AIGovernance.ActivationReceipt"),
            ("affectedPersonDisclosureEvidenceId", "DWP.AIGovernance.AffectedPersonDisclosureEvidence"),
        )]
        assistance_assignments = {
            "tenant_id": "authenticatedPrincipal.tenantId",
            "public_id": "SERVER_ALLOCATE:UUID_V7_REPLAY_STABLE",
            "parent_public_id": "ownerProof.body.governanceActivationReceiptId.policyPublicId",
            "parent_version": "ownerProof.body.governanceActivationReceiptId.policyVersion",
            "fact_revision": "CONSTANT:1", "ordinal": "CONSTANT:1",
            "payload_digest": "SERVER_DERIVE:canonical assistance request row",
            "reference_effective_at": "ownerClock.transactionNow",
            "state": "CONSTANT:REQUESTED", "aggregate_version": "CONSTANT:1",
            "use_case_key": "body.useCaseKey",
            "instruction_artifact_version_id": "body.instructionArtifactVersionId",
            "source_projection_bundle_receipt_id": "body.sourceProjectionBundleReceiptId",
            "governance_activation_receipt_id": "body.governanceActivationReceiptId",
            "governance_activation_receipt_revision": (
                "ownerProof.body.governanceActivationReceiptId.revision"
            ),
            "ai_policy_version_id": "ownerProof.body.governanceActivationReceiptId.policyVersionId",
            "human_oversight_assignment_version_id": (
                "ownerProof.body.governanceActivationReceiptId.humanOversightAssignmentVersionId"
            ),
            "affected_person_disclosure_evidence_id": "body.affectedPersonDisclosureEvidenceId",
            "monitoring_expires_at": "ownerProof.body.governanceActivationReceiptId.expiresAt",
            "kill_switch_control_version_id": (
                "ownerProof.body.governanceActivationReceiptId.killSwitchControlVersionId"
            ),
            "requested_at": "ownerClock.transactionNow",
            "request_digest": "SERVER_DERIVE:canonical validated business request",
            "updated_at": "ownerClock.transactionNow",
        }
        operation["orderedDml"] = _receipt_steps(operation, [{
            "action": "INSERT", "table": root, "role": "CONCURRENCY_ROOT",
            "selector": "tenant+owner-generated replay-stable public identity",
            "assignments": assistance_assignments, "expectedRows": "EXACTLY_ONE",
            "failureInjectionAssertion": "receipt/domain/outbox all roll back",
        }])
        operation["events"] = [_event(
            "GovernedAiAssistanceRequested.v2", operation, root, "state",
            ("NONE",), ("REQUESTED",),
        )]

    if operation["mode"] == "COMMAND":
        operation.setdefault("transactionEnvelope", {})["aiGovernancePrecondition"] = (
            "lock exact central activation proof; verify all typed revisions, purpose/population, "
            "human oversight assignment, affected-person disclosure, monitoring expiry and enabled "
            "kill switch; otherwise fail closed with zero domain/receipt/outbox mutation"
        )


def _normalize_existing(operation: dict[str, Any]) -> dict[str, Any]:
    row = copy.deepcopy(operation)
    normalized_events = []
    for event in row.get("events", []):
        if event.get("eventName") in REMOVED_PUBLIC_EVENT_IDS:
            continue
        event = copy.deepcopy(event)
        if event.get("eventName") in REPLACED_PUBLIC_EVENT_IDS:
            event["eventName"] = REPLACED_PUBLIC_EVENT_IDS[event["eventName"]]
        normalized_events.append(event)
    row["events"] = normalized_events
    _normalize_trace_and_digest(row)
    operation_id = row["operationId"]
    if operation_id in DIRECT_APPROVAL_PUBLISH_IDS | FROZEN_APPROVAL_PUBLISH_IDS | SPECIAL_PROOF_PUBLISH_IDS:
        _remove_request_field(row, {"contentDigest", "effectiveFrom"})
    if operation_id in FROZEN_APPROVAL_PUBLISH_IDS | {"modern.wfm.schedule.publish"}:
        _remove_request_field(row, {"approvalReceiptId", "approvalReceiptPublicId"})
    if operation_id == "modern.recruiting.candidate.stage":
        for event in row.get("events", []):
            event["fields"] = [field for field in event["fields"] if field["name"] != "recordedAt"]
            event["audience"]["fieldExposure"]["fields"] = [
                name for name in event["audience"]["fieldExposure"]["fields"]
                if name != "recordedAt"
            ]
    if operation_id == "modern.compplan.plan.approve":
        row["transition"]["preStates"] = ["OPEN"]
    if operation_id == "modern.wfm.schedule.publish":
        row["transition"]["preStates"] = ["APPROVED"]
    if operation_id == "modern.contingent.engagement.activate":
        row["transition"]["postStates"] = ["ACTIVATION_PENDING"]
        row["transition"]["postStateSource"] = "CONSTANT:ACTIVATION_PENDING"
    if operation_id == "modern.ai.assist.create":
        row["transition"]["postStates"] = ["REQUESTED"]
        row["transition"]["postStateSource"] = "CONSTANT:REQUESTED"
    if operation_id == "modern.analytics.metric.create":
        row["orderedDml"] = [
            step for step in row["orderedDml"]
            if step.get("table") != "sys_hris_metric_projections"
        ]
    if operation_id == "modern.analytics.metric.publish":
        forbidden = {"projectionId", "projectionRevision", "subjectCount", "payloadDigest"}
        for event in row.get("events", []):
            event["fields"] = [field for field in event["fields"] if field["name"] not in forbidden]
            event["audience"]["fieldExposure"]["fields"] = [
                name for name in event["audience"]["fieldExposure"]["fields"]
                if name not in forbidden
            ]
    if operation_id == "modern.ai.policy.evaluate":
        removed = {"evaluationSuiteVersion", "fixtureSetDigest", "modelRouteKey"}
        for event in row.get("events", []):
            event["fields"] = [
                field for field in event["fields"] if field["name"] not in removed
            ]
            event["audience"]["fieldExposure"]["fields"] = [
                name for name in event["audience"]["fieldExposure"]["fields"]
                if name not in removed
            ]
            for field in event["fields"]:
                if field["name"] == "policyVersion":
                    field.update({
                        "type": "UUID", "sourceKind": "PHYSICAL_POST_STATE",
                        "source": "sys_hris_ai_evaluation_requests.policy_version_public_id",
                        "tokenization": "OPAQUE_PUBLIC_ID",
                        "referenceContract": {
                            "entityType": "table:sys_hris_ai_policy_versions",
                            "idSpace": "PUBLIC_UUID",
                        },
                    })
    if operation_id == "modern.listening.action.create":
        # A cohort result was a retired derived materialization.  The command
        # now binds the exact, static successor cohort projection and persists
        # that identity on the action row.
        for field in row.get("requestFields", []):
            if field.get("name") == "cohortResultId":
                field.update({
                    "name": "cohortProjectionId",
                    "source": "body.cohortProjectionId",
                    "referenceContract": {
                        "entityType": "DWP.Listening.CohortProjectionVersion",
                        "idSpace": "PUBLIC_UUID",
                    },
                })
        for name, field_type, entity in (
            ("cohortProjectionRevision", "BIGINT", None),
            ("cohortProjectionAsOf", "TIMESTAMPTZ", None),
            ("cohortProjectionLineageReceiptId", "UUID", "DWP.Listening.CohortProjectionLineageReceipt"),
        ):
            if not any(field.get("name") == name for field in row.get("requestFields", [])):
                field = _field(name, "body", field_type, entity=entity)
                row.setdefault("requestFields", []).append(field)
                row.setdefault("inputEffects", []).append({
                    "source": "body." + name, "type": field_type, "required": True,
                    "sensitivity": "RESTRICTED", "requestDigestMember": True,
                    "effects": [{
                        "kind": "OWNER_VERSION_SELECTOR",
                        "target": "DWP.Listening.CohortProjectionVersion." + name,
                        "cardinality": "EXACTLY_ONE_TENANT_PURPOSE_VERSION_ASOF",
                    }],
                })
        for effect in row.get("inputEffects", []):
            if effect.get("source") == "body.cohortResultId":
                effect["source"] = "body.cohortProjectionId"
            for value in effect.get("effects", []):
                if value.get("target") == "sys_hris_listening_cohort_results.public_id":
                    value.update({
                        "kind": "OWNER_VERSION_SELECTOR",
                        "target": "DWP.Listening.CohortProjectionVersion.publicId",
                        "cardinality": "EXACTLY_ONE_TENANT_PURPOSE_VERSION_ASOF",
                    })
        for selector in row.get("selectors", []):
            if selector.get("targetTable") != "sys_hris_listening_cohort_results":
                continue
            selector.update({
                "source": "body.cohortProjectionId",
                "selectorType": "OWNER_PORT_EXACT_VERSION",
                "entityType": "DWP.Listening.CohortProjectionVersion",
                "targetTable": "OWNER_PORT::DWP.Listening.CohortProjectionVersion",
                "targetColumn": "publicId",
                "versionRule": "EXACT_IMMUTABLE_PROJECTION_REVISION_NO_LATEST_FALLBACK",
                "asOfRule": "ownerProof.referenceEffectiveAt exact",
                "causalJoin": (
                    "SIGNED_PRIVACY_SAFE_OWNER_REFETCH_TENANT_PURPOSE_VERSION_ASOF_MATCH"
                ),
                "failure": "403/404/409/503 fail closed with zero configuration mutation",
            })
        step = _domain_step(row, "sys_hris_listening_actions")
        if step:
            step.setdefault("assignments", {}).update({
                "listening_survey_version_id": (
                    "selector.pathParameters.surveyId.currentPublishedVersion.internalId"
                ),
                "cohort_projection_public_id": "body.cohortProjectionId",
                "cohort_projection_revision": "body.cohortProjectionRevision",
                "cohort_projection_as_of": "body.cohortProjectionAsOf",
                "cohort_projection_lineage_receipt_public_id": "body.cohortProjectionLineageReceiptId",
            })
    if operation_id == "modern.learning.completion.verify":
        for event in row.get("events", []):
            for field in event.get("fields", []):
                if field["name"] == "skillEvidenceIds":
                    field.update({
                        "sourceKind": "TYPED_ORDERED_CHILD_PROJECTION",
                        "source": (
                            "prf_lrn_completion_skill_evidence_refs."
                            "skill_evidence_public_id"
                        ),
                        "collectionOrderSource": (
                            "prf_lrn_completion_skill_evidence_refs.ordinal ASC"
                        ),
                    })
    if operation_id == "modern.compplan.snapshot.publish":
        for event in row.get("events", []):
            for field in event.get("fields", []):
                if field["name"] == "approvalRevision":
                    field["source"] = "prf_cmp_approved_snapshots.approval_receipt_revision"
                elif field["name"] == "approvalReceiptId":
                    field["source"] = "prf_cmp_approved_snapshots.approval_receipt_public_id"
    if row.get("mode") == "QUERY":
        reviewed_sources = EXISTING_QUERY_RUNTIME.get(operation_id)
        if reviewed_sources is None:
            reviewed_sources = tuple(row.get("readPlan", {}).get("tables", ()))
        row["readPlan"] = _query_read_plan(row, reviewed_sources)
    root = row.get("aggregateRoot", {}).get("table")
    for event in row.get("events", []):
        event_name = event["eventName"]
        for field in event.get("fields", []):
            repair = DURABLE_EVENT_SOURCE_REPAIRS.get((event_name, field["name"]))
            if repair:
                field.update({"sourceKind": repair[0], "source": repair[1]})
            if field["name"] == "occurredAt" and field.get("sourceKind") == "OWNER_TRANSACTION_CLOCK":
                if not root:
                    raise ValueError(f"event occurredAt root unavailable: {operation_id}")
                field.update({"sourceKind": "PHYSICAL_POST_STATE", "source": root + ".updated_at"})
    # Every create/new-child event must use a real non-existent pre-state,
    # never a phantom locked row inserted by fixtures.
    inserted = {
        step.get("table") for step in row.get("orderedDml", [])
        if step.get("action") in {"INSERT", "INSERT_MANY", "APPEND", "APPEND_MANY"}
    }
    for event in row.get("events", []):
        for field in event.get("fields", []):
            if field.get("name") != "fromState":
                continue
            source = str(field.get("source", ""))
            source_table = source.removeprefix("LOCKED_PRE:").split(".", 1)[0]
            if source.startswith("LOCKED_PRE:") and source_table in inserted:
                field.update({"sourceKind": "DERIVED_DOMAIN_FACT", "source": "CONSTANT:NONE"})
    if row.get("mode") == "COMMAND":
        _repair_decision_facts(row)
        _repair_typed_children_and_special_writes(row)
        _repair_publish_proof(row)
        domain_steps = [
            copy.deepcopy(step) for step in row.get("orderedDml", [])
            if step.get("role") not in {"COMMAND_RECEIPT", "TRANSACTIONAL_OUTBOX"}
        ]
        row["orderedDml"] = _receipt_steps(row, domain_steps)
    _apply_ai_governance_boundary(row)
    return row


def _listening_operation_overlay(base: dict[str, Any], operations: list[dict[str, Any]]) -> None:
    design = build_static_design()
    expected = {row["operationId"] for row in design["publicOperationBindings"]}
    observed = {row["operationId"] for row in operations if row["operationId"].startswith("modern.listening.")}
    if expected != observed:
        raise ValueError(f"Listening public operation closure drift: {sorted(expected ^ observed)}")
    bindings = {row["operationId"]: row for row in design["publicOperationBindings"]}
    for operation in operations:
        binding = bindings.get(operation["operationId"])
        if binding:
            operation["listeningAuthority"] = copy.deepcopy(binding)


def _ensure_business_field(operation: dict[str, Any], spec: tuple[str, str, str | None, str, str]) -> None:
    name, field_type, entity, table, column_name = spec
    source = "body." + name
    field = next((row for row in operation.get("requestFields", []) if row.get("source") == source), None)
    if field is None:
        field = _field(name, "body", field_type, required=True, entity=entity)
        operation.setdefault("requestFields", []).append(field)
    else:
        field.update({"name": name, "location": "body", "type": field_type,
                      "required": True})
        if entity:
            field["referenceContract"] = {"entityType": entity, "idSpace": "PUBLIC_UUID"}
    effects: list[dict[str, Any]] = []
    if entity:
        effects.append({
            "kind": "ENTITY_SELECTOR" if entity.startswith("table:") else "OWNER_VERSION_SELECTOR",
            "target": entity.removeprefix("table:") + ".public_id",
            "cardinality": "EXACTLY_ONE_TENANT_PURPOSE_VERSION_ASOF",
        })
    if column_name not in {"typed_node_rows", "typed_edge_rows", "typed_level_rows"}:
        effects.append({"kind": "TYPED_DOMAIN_INPUT", "target": table + "." + column_name})
    current = next((row for row in operation.get("inputEffects", []) if row.get("source") == source), None)
    value = {
        "source": source, "type": field_type, "required": True,
        "sensitivity": field.get("sensitivity", "INTERNAL"),
        "requestDigestMember": True, "effects": effects,
    }
    if current is None:
        operation.setdefault("inputEffects", []).append(value)
    else:
        current.clear()
        current.update(value)


def _business_assignment_source(spec: tuple[str, str, str | None, str, str]) -> str:
    name, _, entity, _, column_name = spec
    if entity and entity.startswith("table:") and column_name.endswith("_id"):
        return "SELECTED:" + entity.removeprefix("table:") + ".record_id FROM body." + name
    return "body." + name


def _new_immutable_fact(parent_source: str, state: str) -> dict[str, str]:
    return {
        "tenant_id": "authenticatedPrincipal.tenantId",
        "public_id": "SERVER_ALLOCATE:UUID_V7_REPLAY_STABLE",
        "aggregate_version": "CONSTANT:1",
        "parent_public_id": parent_source,
        "parent_version": "LOCKED_PRE:aggregate_version",
        "fact_revision": "LOCKED_PRE:aggregate_version+1",
        "state": "CONSTANT:" + state,
        "ordinal": "CONSTANT:1",
        "payload_digest": "SERVER_DERIVE:canonical typed immutable fact",
        "reference_effective_at": "ownerClock.transactionNow",
    }


def _ensure_global_semantic_steps(operation: dict[str, Any]) -> None:
    operation_id = operation["operationId"]
    facts: dict[str, tuple[str, str, str]] = {
        "modern.recruiting.offer.respond": ("ppl_rec_offer_decisions", "pathParameters.offerId", "ACCEPTED"),
        "modern.recruiting.requisition.create": ("ppl_rec_requisition_versions", "LOCKED_POST:ppl_rec_requisitions.public_id", "DRAFT"),
        "modern.recruiting.requisition.revise": ("ppl_rec_requisition_versions", "pathParameters.requisitionId", "DRAFT"),
        "modern.workforceplan.scenario.simulate": ("ppl_wfp_simulation_requests", "pathParameters.scenarioId", "REQUESTED"),
        "modern.benefits.lifeevent.decide": ("ppl_bnf_life_event_decisions", "pathParameters.lifeEventId", "VERIFIED"),
        "modern.learning.offering.create": ("prf_lrn_offering_versions", "LOCKED_POST:prf_lrn_offerings.public_id", "DRAFT"),
        "modern.learning.offering.revise": ("prf_lrn_offering_versions", "pathParameters.offeringId", "DRAFT"),
        "modern.learning.self.enroll": ("prf_lrn_capacity_ledger", "LOCKED:prf_lrn_offerings.public_id", "RESERVED"),
        "modern.learning.assignment.cancel": ("prf_lrn_capacity_ledger", "pathParameters.assignmentId", "RELEASED"),
        "modern.opportunity.create": ("prf_mkt_opportunity_versions", "LOCKED_POST:prf_mkt_opportunities.public_id", "DRAFT"),
        "modern.opportunity.revise": ("prf_mkt_opportunity_versions", "pathParameters.opportunityId", "DRAFT"),
        "modern.compplan.proposal.upsert": ("prf_cmp_proposal_versions", "LOCKED_POST:prf_cmp_proposals.public_id", "DRAFT"),
        "modern.compplan.plan.approve": ("prf_cmp_plan_proposal_refs", "LOCKED_POST:prf_cmp_plans.public_id", "APPROVED"),
        "modern.ai.assist.review": ("sys_hris_ai_assistance_reviews", "pathParameters.assistanceId", "CONFIRMED"),
        "modern.ai.assist.revoke": ("sys_hris_ai_assistance_reviews", "pathParameters.assistanceId", "REVOKED"),
        "modern.contingent.engagement.create": ("ppl_cwk_engagement_versions", "LOCKED_POST:ppl_cwk_engagements.public_id", "DRAFT"),
        "modern.contingent.engagement.revise": ("ppl_cwk_engagement_versions", "pathParameters.engagementId", "DRAFT"),
        "modern.succession.plan.create": ("prf_suc_plan_versions", "LOCKED_POST:prf_suc_plans.public_id", "DRAFT"),
        "modern.succession.plan.revise": ("prf_suc_plan_versions", "pathParameters.planId", "DRAFT"),
    }
    if operation_id in facts:
        table, parent, state = facts[operation_id]
        _append_fact_step(operation, table, _new_immutable_fact(parent, state),
                          action="APPEND", role="IMMUTABLE_GLOBAL_HCM_FACT")

    if operation_id in {"modern.recruiting.requisition.create", "modern.recruiting.requisition.revise"}:
        step = _domain_step(operation, "ppl_rec_requisition_versions")
        if step:
            creating = operation_id.endswith("create")
            step["assignments"].update({
                "requisition_public_id": (
                    "LOCKED_POST:ppl_rec_requisitions.public_id" if creating
                    else "pathParameters.requisitionId"
                ),
                "revision_mode": "CONSTANT:CREATE" if creating else "body.revisionMode",
                "effective_from": "body.targetStartDate" if creating else "body.effectiveFrom",
                "effective_to": "CONSTANT:NULL" if creating else "body.effectiveTo",
                "predecessor_revision": "CONSTANT:0" if creating else "LOCKED_PRE:ppl_rec_requisitions.aggregate_version",
                "correction_reason_code": "CONSTANT:INITIAL" if creating else "body.reasonCode",
                "changed_fields": "SERVER_DERIVE:canonical initial fields" if creating else "body.changedFields",
                "employment_type_code_set_version_id": "body.employmentTypeCodeSetVersionId",
            })

    if operation_id == "modern.benefits.plan.create":
        step = _domain_step(operation, "ppl_bnf_plan_versions")
        if step:
            step["assignments"].update({
                "effective_from": "body.effectiveFrom",
                "effective_to": "body.effectiveTo",
                "revision_mode": "CONSTANT:CREATE",
                "predecessor_revision": "CONSTANT:0",
                "correction_reason_code": "CONSTANT:INITIAL",
                "changed_fields": "SERVER_DERIVE:canonical initial fields",
            })

    if operation_id == "modern.onboarding.template.create":
        step = _domain_step(operation, "ppl_jny_template_versions")
        if step:
            step["assignments"].update({
                "revision_mode": "CONSTANT:CREATE",
                "predecessor_revision": "CONSTANT:0",
                "correction_reason_code": "CONSTANT:INITIAL",
                "changed_fields": "SERVER_DERIVE:canonical initial fields",
            })

    if operation_id in {"modern.onboarding.template.create", "modern.onboarding.template.revise"}:
        _append_fact_step(operation, "ppl_jny_template_task_definitions", {
            **_new_immutable_fact("LOCKED_POST:ppl_jny_template_versions.public_id", "ACTIVE"),
            "template_version_public_id": "LOCKED_POST:ppl_jny_template_versions.public_id",
            "task_key": "body.tasks[*].taskKey", "title": "body.tasks[*].title",
            "task_type": "body.tasks[*].taskType", "actor_rule": "body.tasks[*].actorRule",
            "due_anchor_code": "body.tasks[*].dueAnchor", "due_offset_seconds": "body.tasks[*].dueOffsetSeconds",
            "condition_expression_version_id": "body.tasks[*].conditionExpressionVersionId IF PRESENT",
            "completion_schema_ref": "body.tasks[*].completionSchemaRef",
            "evidence_schema_ref": "body.tasks[*].evidenceSchemaRef",
            "required_flag": "body.tasks[*].required",
        }, action="APPEND_MANY", role="TYPED_TASK_DEFINITIONS")
        if operation_id.endswith("revise"):
            version = _domain_step(operation, "ppl_jny_template_versions")
            if version:
                version["assignments"].update({
                    "journey_template_id": "LOCKED_PRE:ppl_jny_templates.journey_template_id",
                    "version_no": "LOCKED_PRE:ppl_jny_templates.aggregate_version+1",
                })
    if operation_id in {"modern.onboarding.task.complete", "modern.onboarding.task.waive"}:
        _append_fact_step(operation, "ppl_jny_assignment_task_revisions", {
            **_new_immutable_fact("pathParameters.taskId", "COMPLETED" if operation_id.endswith("complete") else "WAIVED"),
            "parent_public_id": "pathParameters.taskId",
        })
    if operation_id == "modern.benefits.enrollment.submit":
        _append_fact_step(operation, "ppl_bnf_enrollment_eligibility_receipts", {
            **_new_immutable_fact("LOCKED_POST:ppl_bnf_enrollments.public_id", "ELIGIBLE"),
            "enrollment_public_id": "LOCKED_POST:ppl_bnf_enrollments.public_id",
            "eligibility_policy_version_id": "OWNER_REFETCH:body.benefitPlanVersionId.eligibilityPolicyVersionId",
            "population_snapshot_public_id": "authorization.populationSnapshotPublicId",
            "outcome": "CONSTANT:ELIGIBLE",
            "public_id": "SERVER_ALLOCATE:ELIGIBILITY_RECEIPT_UUID_V7_REPLAY_STABLE",
        })
        enrollment = _domain_step(operation, "ppl_bnf_enrollments")
        if enrollment:
            enrollment["assignments"].update({
                "coverage_option_code": "body.coverageOptionCode",
                "eligibility_receipt_public_id": "SERVER_ALLOCATE:ELIGIBILITY_RECEIPT_UUID_V7_REPLAY_STABLE",
            })
        _append_fact_step(operation, "ppl_bnf_dependent_elections", {
            **_new_immutable_fact("LOCKED_POST:ppl_bnf_enrollments.public_id", "ELECTED"),
            "enrollment_public_id": "LOCKED_POST:ppl_bnf_enrollments.public_id",
            "ordinal": "body.dependentTokens[*].ordinal",
            "dependent_relationship_token": "body.dependentTokens[*].relationshipToken",
            "coverage_option_code": "body.coverageOptionCode",
            "coverage_level_code": "body.dependentTokens[*].coverageLevelCode",
        }, action="APPEND_MANY", role="TYPED_DEPENDENT_ELECTIONS")
    if operation_id == "modern.benefits.lifeevent.decide":
        _append_fact_step(operation, "ppl_bnf_provider_requests", {
            **_new_immutable_fact("LOCKED:ppl_bnf_enrollments.public_id", "REQUESTED"),
            "enrollment_public_id": "LOCKED:ppl_bnf_enrollments.public_id",
            "request_digest": "SERVER_DERIVE:approved life event+enrollment+provider configuration",
        }, role="ASYNC_PROVIDER_REQUEST_IF_VERIFIED")
    if operation_id == "modern.benefits.plan.revise":
        step = _domain_step(operation, "ppl_bnf_plan_versions")
        if step:
            step["assignments"].update({
                "benefit_plan_id": "LOCKED_PRE:ppl_bnf_plans.benefit_plan_id",
                "version_no": "LOCKED_PRE:ppl_bnf_plans.aggregate_version+1",
                "valid_from": "body.effectiveFrom",
                "valid_to": "body.effectiveTo",
                "content_digest": "SERVER_DERIVE:canonical changed fields+coverage options",
                "coverage_configuration_digest": "SERVER_DERIVE:canonical coverage options",
                "delivery_mode": "LOCKED_PRE:ppl_bnf_plan_versions.delivery_mode",
                "enrollment_window_policy_version_id": "LOCKED_PRE:ppl_bnf_plan_versions.enrollment_window_policy_version_id",
                "payroll_treatment_code": "LOCKED_PRE:ppl_bnf_plan_versions.payroll_treatment_code",
            })
    if operation_id == "modern.contingent.engagement.create":
        _append_fact_step(operation, "ppl_cwk_classification_receipts", {
            **_new_immutable_fact("LOCKED_POST:ppl_cwk_engagements.public_id", "ELIGIBLE"),
            "classification_code": "body.classificationCode",
            "classification_policy_version_id": "body.classificationPolicyVersionId",
            "decision_receipt_revision": "ownerProof.body.classificationDecisionReceiptId.revision",
        })
        _append_fact_step(operation, "ppl_cwk_access_requests", {
            **_new_immutable_fact("LOCKED_POST:ppl_cwk_engagements.public_id", "REQUESTED"),
            "engagement_public_id": "LOCKED_POST:ppl_cwk_engagements.public_id",
            "request_digest": "SERVER_DERIVE:access package+scope+expiry",
        }, role="ASYNC_ACCESS_REQUEST")
    if operation_id in {"modern.contingent.engagement.create", "modern.contingent.engagement.revise"}:
        step = _domain_step(operation, "ppl_cwk_engagement_versions")
        if step:
            creating = operation_id.endswith("create")
            step["assignments"].update({
                "engagement_public_id": (
                    "LOCKED_POST:ppl_cwk_engagements.public_id" if creating
                    else "pathParameters.engagementId"
                ),
                "version_no": "CONSTANT:1" if creating else "LOCKED_PRE:ppl_cwk_engagements.aggregate_version+1",
                "revision_mode": "CONSTANT:CREATE" if creating else "body.revisionMode",
                "effective_from": "body.effectiveFrom",
                "effective_to": "body.effectiveTo",
                "predecessor_revision": "CONSTANT:0" if creating else "LOCKED_PRE:ppl_cwk_engagements.aggregate_version",
                "correction_reason_code": "CONSTANT:INITIAL" if creating else "body.reasonCode",
                "changed_fields": "SERVER_DERIVE:canonical initial fields" if creating else "body.changedFields",
                "classification_policy_version_id": (
                    "body.classificationPolicyVersionId" if creating
                    else "LOCKED_PRE:ppl_cwk_engagement_versions.classification_policy_version_id"
                ),
                "access_package_public_id": (
                    "body.accessPackagePublicId" if creating
                    else "LOCKED_PRE:ppl_cwk_engagement_versions.access_package_public_id"
                ),
            })
    if operation_id in {"modern.skills.taxonomy.create", "modern.skills.taxonomy.revise"}:
        parent = "LOCKED_POST:prf_skl_taxonomy_versions.public_id"
        for table, state, rows in (
            ("prf_skl_skill_nodes", "ACTIVE", "body.nodes[*]"),
            ("prf_skl_skill_edges", "ACTIVE", "body.edges[*]"),
            ("prf_skl_proficiency_levels", "ACTIVE", "body.proficiencyLevels[*]"),
        ):
            _append_fact_step(operation, table, {
                **_new_immutable_fact(parent, state),
                "ordinal": rows + ".ordinal",
            }, action="APPEND_MANY", role="TYPED_TAXONOMY_CHILDREN")
        nodes = _domain_step(operation, "prf_skl_skill_nodes")
        if nodes:
            nodes["assignments"].update({
                "skill_code": "body.nodes[*].skillCode",
                "label": "body.nodes[*].label",
                "locale_code": "body.nodes[*].localeCode",
            })
        edges = _domain_step(operation, "prf_skl_skill_edges")
        if edges:
            edges["assignments"].update({
                "source_skill_public_id": "body.edges[*].sourceSkillPublicId",
                "target_skill_public_id": "body.edges[*].targetSkillPublicId",
                "edge_type_code": "body.edges[*].edgeTypeCode",
            })
        levels = _domain_step(operation, "prf_skl_proficiency_levels")
        if levels:
            levels["assignments"].update({
                "level_code": "body.proficiencyLevels[*].levelCode",
                "label": "body.proficiencyLevels[*].label",
                "rank_order": "body.proficiencyLevels[*].rankOrder",
            })
    if operation_id == "modern.growth.profile.create":
        _append_fact_step(operation, "prf_grw_profile_revisions", {
            "tenant_id": "authenticatedPrincipal.tenantId", "public_id": "SERVER_ALLOCATE:UUID_V7_REPLAY_STABLE",
            "aggregate_version": "CONSTANT:1", "growth_profile_id": "LOCKED_POST:prf_grw_profiles.growth_profile_id",
            "profile_revision": "CONSTANT:1", "visibility": "body.visibility",
            "recorded_at": "ownerClock.transactionNow", "evidence_refs_digest": "SERVER_DERIVE:empty ordered refs",
        })
    if operation_id == "modern.compplan.cycle.create":
        _append_fact_step(operation, "prf_cmp_budget_ledger", {
            "tenant_id": "authenticatedPrincipal.tenantId", "public_id": "SERVER_ALLOCATE:UUID_V7_REPLAY_STABLE",
            "aggregate_version": "CONSTANT:1", "compensation_cycle_id": "LOCKED_POST:prf_cmp_cycles.compensation_cycle_id",
            "entry_sequence": "CONSTANT:1", "entry_type": "CONSTANT:INITIAL_BUDGET",
            "amount": "body.budgetAmount", "currency_code": "body.currencyCode",
            "org_public_id": "CONSTANT:NULL", "payload_digest": "SERVER_DERIVE:canonical initial budget",
            "recorded_at": "ownerClock.transactionNow",
        })
    if operation_id in {"modern.learning.offering.create", "modern.learning.offering.revise"}:
        step = _domain_step(operation, "prf_lrn_offering_versions")
        if step:
            creating = operation_id.endswith("create")
            step["assignments"].update({
                "offering_public_id": "LOCKED_POST:prf_lrn_offerings.public_id" if creating else "pathParameters.offeringId",
                "version_no": "CONSTANT:1" if creating else "LOCKED_PRE:prf_lrn_offerings.aggregate_version+1",
                "revision_mode": "CONSTANT:CREATE" if creating else "body.revisionMode",
                "effective_from": "body.effectiveFrom",
                "effective_to": "body.effectiveTo",
                "predecessor_revision": "CONSTANT:0" if creating else "LOCKED_PRE:prf_lrn_offerings.aggregate_version",
                "correction_reason_code": "CONSTANT:INITIAL" if creating else "body.reasonCode",
                "changed_fields": "SERVER_DERIVE:canonical initial fields" if creating else "body.changedFields",
                "content_artifact_schema_version": "body.contentArtifactSchemaVersion",
                "session_schema": "body.sessionSchema",
            })
    if operation_id in {"modern.opportunity.create", "modern.opportunity.revise"}:
        step = _domain_step(operation, "prf_mkt_opportunity_versions")
        if step:
            creating = operation_id.endswith("create")
            step["assignments"].update({
                "opportunity_public_id": "LOCKED_POST:prf_mkt_opportunities.public_id" if creating else "pathParameters.opportunityId",
                "version_no": "CONSTANT:1" if creating else "LOCKED_PRE:prf_mkt_opportunities.aggregate_version+1",
                "revision_mode": "CONSTANT:CREATE" if creating else "body.revisionMode",
                "effective_from": "body.openFrom" if creating else "body.effectiveFrom",
                "effective_to": "body.closeAt" if creating else "body.effectiveTo",
                "predecessor_revision": "CONSTANT:0" if creating else "LOCKED_PRE:prf_mkt_opportunities.aggregate_version",
                "correction_reason_code": "CONSTANT:INITIAL" if creating else "body.reasonCode",
                "changed_fields": "SERVER_DERIVE:canonical initial fields" if creating else "body.changedFields",
                "criteria_schema_version": "body.criteriaSchemaVersion",
            })
    if operation_id == "modern.compplan.proposal.upsert":
        step = _domain_step(operation, "prf_cmp_proposal_versions")
        if step:
            step["assignments"].update({
                "proposal_public_id": "LOCKED_POST:prf_cmp_proposals.public_id",
                "proposal_version": "LOCKED_POST:prf_cmp_proposals.aggregate_version",
                "worker_public_id": "body.workerPublicId", "assignment_public_id": "body.assignmentPublicId",
                "component_code": "body.componentCode", "component_catalog_version_id": "body.componentCatalogVersionId",
                "amount": "body.amount", "currency_code": "body.currencyCode", "frequency_code": "body.frequencyCode",
                "basis_code": "body.basisCode", "fx_snapshot_public_id": "body.fxSnapshotPublicId",
                "effective_date": "body.effectiveDate", "reason_code": "body.reasonCode",
            })
    if operation_id == "modern.compplan.plan.approve":
        step = _domain_step(operation, "prf_cmp_plan_proposal_refs")
        if step:
            step.update({"action": "APPEND_MANY", "role": "IMMUTABLE_APPROVED_PROPOSAL_MEMBERSHIP"})
            step["assignments"].update({
                "plan_public_id": "LOCKED_POST:prf_cmp_plans.public_id",
                "plan_revision": "LOCKED_POST:prf_cmp_plans.plan_revision",
                "proposal_public_id": "body.proposalVersions[*].proposalPublicId",
                "proposal_version": "body.proposalVersions[*].proposalVersion",
                "ordinal": "body.proposalVersions[*].ordinal",
            })
    if operation_id in {"modern.ai.assist.review", "modern.ai.assist.revoke"}:
        step = _domain_step(operation, "sys_hris_ai_assistance_reviews")
        if step:
            step["assignments"].update({
                "assistance_request_public_id": "pathParameters.assistanceId",
                "review_revision": "LOCKED_PRE:sys_hris_ai_assistance_requests.aggregate_version+1",
                "decision": "body.decision" if operation_id.endswith("review") else "CONSTANT:REVOKED",
                "subject_worker_public_id": "LOCKED_PRE:sys_hris_ai_assistance_requests.subject_worker_public_id",
                "reason_code": "body.reasonCode",
                "actor_public_id": "body.humanActorPublicId",
                "actor_mode": "body.actorMode",
                "decision_source_receipt_public_id": "body.decisionSourceReceiptPublicId",
                "decision_source_receipt_revision": "body.decisionSourceReceiptRevision",
            })
            if operation_id.endswith("revoke"):
                step["role"] = "IMMUTABLE_AI_HUMAN_REVOCATION_DECISION"
                step["selector"] = (
                    "tenant+assistance+next review revision; lock exact prior CONFIRMED review; "
                    "append REVOKED then root CAS"
                )
                step["assignments"].update({
                    "prior_review_public_id": "LOCKED_PRE:sys_hris_ai_assistance_reviews.public_id",
                    "prior_review_revision": "LOCKED_PRE:sys_hris_ai_assistance_reviews.review_revision",
                })
    if operation_id == "modern.benefits.lifeevent.decide":
        step = _domain_step(operation, "ppl_bnf_life_event_decisions")
        if step:
            step["assignments"].update({
                "life_event_public_id": "pathParameters.lifeEventId",
                "decision": "body.decision",
            })
    if operation_id == "modern.recruiting.offer.respond":
        step = _domain_step(operation, "ppl_rec_offer_decisions")
        if step:
            step["assignments"].update({
                "offer_public_id": "pathParameters.offerId",
                "decision": "body.decision",
            })
    if operation_id == "modern.workforceplan.scenario.simulate":
        step = _domain_step(operation, "ppl_wfp_simulation_requests")
        if step:
            step["assignments"].update({
                "input_snapshot_public_id": "body.inputSnapshotId",
                "request_digest": "SERVER_DERIVE:scenario revision+input snapshot+assumptions",
                "scenario_revision": "body.scenarioRevision",
                "rule_version": "body.ruleVersion",
                "deterministic_seed": "body.deterministicSeed",
            })
            step.update({
                "action": "APPEND", "role": "IMMUTABLE_SIMULATION_REQUEST",
                "selector": "tenant+scenario+scenarioRevision+request digest; one active REQUESTED request",
            })
        operation["orderedDml"] = [
            row for row in operation.get("orderedDml", [])
            if row.get("table") not in {"ppl_wfp_scenarios", "ppl_wfp_scenario_revisions"}
        ]
        operation["aggregateRoot"] = {
            "table": "ppl_wfp_simulation_requests", "publicIdColumn": "public_id",
            "versionColumn": "aggregate_version", "stateColumn": "state",
            "tenantColumn": "tenant_id", "choice": "ASYNC_REQUEST_CHILD_FIRST_WRITE",
        }
        operation["transition"] = {
            "transitionId": "TR-MODERN-WORKFORCEPLAN-SCENARIO-SIMULATE-ASYNC-V3",
            "preStates": ["NONE"], "postStates": ["REQUESTED"],
            "postStateSource": "CONSTANT:REQUESTED",
            "stateSink": "ppl_wfp_simulation_requests.state",
            "cas": "first immutable request row; scenario revision is locked and pinned",
        }
        operation["events"] = [_event(
            "WorkforceScenarioSimulationRequested.v2", operation,
            "ppl_wfp_simulation_requests", "state", ("NONE",), ("REQUESTED",),
        )]
    if operation_id == "modern.workforceplan.scenario.cancel":
        request_cas = {
            "action": "UPDATE_CAS", "table": "ppl_wfp_simulation_requests",
            "role": "CANCEL_ACTIVE_SIMULATION_REQUEST",
            "selector": (
                "tenant+parent scenario public_id+exact single active state=REQUESTED; "
                "terminal rows are immutable and never cancelled"
            ),
            "assignments": {
                "state": "CONSTANT:CANCELLED",
                "aggregate_version": "LOCKED_PRE:aggregate_version+1",
                "completed_at": "ownerClock.transactionNow",
                "updated_at": "ownerClock.transactionNow",
            },
            "expectedRows": "ZERO_OR_ONE_ACTIVE_REQUEST",
            "failureInjectionAssertion": "request/scenario/revision/receipt/outbox all roll back",
        }
        insertion = next((
            index for index, row in enumerate(operation.get("orderedDml", []))
            if row.get("role") not in {"COMMAND_RECEIPT"}
        ), len(operation.get("orderedDml", [])))
        operation.setdefault("orderedDml", []).insert(insertion, request_cas)
    if operation_id in {"modern.learning.assignment.create", "modern.learning.assignment.cancel"}:
        creating = operation_id.endswith("create")
        _append_fact_step(operation, "prf_lrn_capacity_ledger", {
            **_new_immutable_fact(
                "body.offeringVersionPublicId" if creating else "pathParameters.assignmentId",
                "RESERVED" if creating else "RELEASED",
            ),
            "offering_version_public_id": (
                "body.offeringVersionPublicId" if creating
                else "LOCKED_PRE:prf_lrn_assignments.offering_version_public_id"
            ),
            "assignment_public_id": (
                "LOCKED_POST:prf_lrn_assignments.public_id" if creating
                else "pathParameters.assignmentId"
            ),
            "entry_sequence": "SERVER_ALLOCATE:NEXT_LOCKED_OFFERING_SEQUENCE",
            "entry_type": "CONSTANT:RESERVE" if creating else "CONSTANT:RELEASE",
            "quantity": "CONSTANT:-1" if creating else "CONSTANT:1",
            "recorded_at": "ownerClock.transactionNow",
        }, role="IMMUTABLE_CAPACITY_RESERVATION")
    if operation_id == "modern.learning.self.enroll":
        step = _domain_step(operation, "prf_lrn_capacity_ledger")
        if step:
            step["assignments"].update({
                "offering_version_public_id": "LOCKED:prf_lrn_offering_versions.public_id",
                "assignment_public_id": "LOCKED_POST:prf_lrn_assignments.public_id",
                "entry_sequence": "SERVER_ALLOCATE:NEXT_LOCKED_OFFERING_SEQUENCE",
                "entry_type": "CONSTANT:RESERVE_OR_WAITLIST",
                "quantity": "SERVER_DERIVE:-1 IF RESERVED ELSE 0",
                "recorded_at": "ownerClock.transactionNow",
            })
    if operation_id in {"modern.succession.plan.create", "modern.succession.plan.revise"}:
        step = _domain_step(operation, "prf_suc_plan_versions")
        if step:
            creating = operation_id.endswith("create")
            step["assignments"].update({
                "plan_public_id": "LOCKED_POST:prf_suc_plans.public_id" if creating else "pathParameters.planId",
                "version_no": "CONSTANT:1" if creating else "LOCKED_PRE:prf_suc_plans.aggregate_version+1",
                "revision_mode": "CONSTANT:CREATE" if creating else "body.revisionMode",
                "effective_from": "body.effectiveFrom",
                "effective_to": "body.effectiveTo",
                "predecessor_revision": "CONSTANT:0" if creating else "LOCKED_PRE:prf_suc_plans.aggregate_version",
                "correction_reason_code": "CONSTANT:INITIAL" if creating else "body.reasonCode",
                "changed_fields": "SERVER_DERIVE:canonical initial fields" if creating else "body.changedFields",
                "audience_policy_public_id": "body.audiencePolicyId",
                "audience_policy_revision": "OWNER_REFETCH:body.audiencePolicyId.revision",
                "key_position_public_id": "body.keyPositionPublicId",
                "content_artifact_public_id": "body.contentArtifactPublicId",
                "content_artifact_revision": "body.contentArtifactRevision",
                "content_digest": "body.contentDigest",
            })

    temporal_creates = {
        "modern.benefits.plan.create": "ppl_bnf_plan_versions",
        "modern.onboarding.template.create": "ppl_jny_template_versions",
        "modern.recruiting.requisition.create": "ppl_rec_requisition_versions",
        "modern.contingent.engagement.create": "ppl_cwk_engagement_versions",
        "modern.learning.offering.create": "prf_lrn_offering_versions",
        "modern.opportunity.create": "prf_mkt_opportunity_versions",
        "modern.succession.plan.create": "prf_suc_plan_versions",
    }
    temporal_table = temporal_creates.get(operation_id)
    if temporal_table:
        step = _domain_step(operation, temporal_table)
        if step:
            step["selector"] = TEMPORAL_CREATE_VERSION_SELECTOR
            step.setdefault("assignments", {}).update({
                "public_id": "SERVER_ALLOCATE:REVISION_UUID_V7_REPLAY_STABLE",
                "revision_mode": "CONSTANT:CREATE",
                "root_version": "CONSTANT:1",
                "root_predecessor_public_id": "CONSTANT:NULL",
                "root_predecessor_version": "CONSTANT:0",
                "effective_segment_public_id": "SERVER_REUSE:REVISION_UUID_V7_REPLAY_STABLE",
                "content_revision_public_id": "SERVER_REUSE:REVISION_UUID_V7_REPLAY_STABLE",
                "segment_revision": "CONSTANT:1",
                "segment_predecessor_public_id": "CONSTANT:NULL",
                "segment_predecessor_revision": "CONSTANT:0",
                "effective_to": "CONSTANT:NULL",
            })
            # Five normalized version tables retain common immutable-fact
            # aliases.  A create has no locked predecessor, so these aliases
            # must be the initial root revision.  Benefits and journey do not
            # physically expose the aliases and must not invent them.
            if temporal_table not in {
                "ppl_bnf_plan_versions", "ppl_jny_template_versions",
            }:
                step["assignments"].update({
                    "parent_version": "CONSTANT:1",
                    "fact_revision": "CONSTANT:1",
                })
            step["assignments"].pop("predecessor_public_id", None)
            step["assignments"].pop("predecessor_revision", None)
            step["assignments"].pop("correction_target_public_id", None)
            step["assignments"].pop("correction_target_version", None)
            root_table = {
                "ppl_bnf_plan_versions": "ppl_bnf_plans",
                "ppl_jny_template_versions": "ppl_jny_templates",
                "ppl_rec_requisition_versions": "ppl_rec_requisitions",
                "ppl_cwk_engagement_versions": "ppl_cwk_engagements",
                "prf_lrn_offering_versions": "prf_lrn_offerings",
                "prf_mkt_opportunity_versions": "prf_mkt_opportunities",
                "prf_suc_plan_versions": "prf_suc_plans",
            }[temporal_table]
            snapshot_columns = {
                "ppl_bnf_plan_versions": {
                    "display_name_snapshot": "display_name", "plan_code_snapshot": "plan_code",
                },
                "ppl_jny_template_versions": {
                    "display_name_snapshot": "display_name", "template_code_snapshot": "template_code",
                },
                "ppl_rec_requisition_versions": {
                    "requisition_code": "requisition_code", "title": "title",
                    "organization_public_id": "organization_public_id",
                    "position_public_id": "position_public_id", "employment_type": "employment_type",
                    "target_start_date": "target_start_date",
                },
                "ppl_cwk_engagement_versions": {
                    "worker_public_id": "worker_public_id", "vendor_public_id": "vendor_public_id",
                    "sponsor_worker_public_id": "sponsor_worker_public_id",
                    "classification_code": "classification_code",
                },
                "prf_lrn_offering_versions": {
                    "display_name": "display_name", "provider_public_id": "provider_public_id",
                },
                "prf_mkt_opportunity_versions": {
                    "display_name": "display_name", "owner_org_public_id": "owner_org_public_id",
                    "open_from": "open_from", "close_at": "close_at",
                },
                "prf_suc_plan_versions": {"display_name": "display_name"},
            }[temporal_table]
            step["assignments"].update({
                target: "LOCKED_POST:" + root_table + "." + source
                for target, source in snapshot_columns.items()
            })
            root_step = _domain_step(operation, root_table)
            if root_step is None or root_step.get("action") not in {"INSERT", "APPEND"}:
                raise ValueError(
                    f"{operation_id} temporal create lacks one stable-root insert"
                )
            operation["aggregateRoot"] = {
                "table": root_table, "publicIdColumn": "public_id",
                "versionColumn": "aggregate_version", "stateColumn": "status",
                "tenantColumn": "tenant_id", "choice": "STABLE_ROOT_WITH_INITIAL_IMMUTABLE_VERSION",
            }
            operation["transition"]["stateSink"] = root_table + ".status"
            operation["transition"]["physicalPostStateSink"] = root_table + ".status"
            operation["transition"]["appendedRevisionStateSink"] = (
                temporal_table + "." + TEMPORAL_VERSION_STATE_COLUMN[temporal_table]
            )
            operation["temporalWriteContract"] = _temporal_create_write_contract(
                temporal_table, step["action"],
            )
            for event in operation.get("events", []):
                event["fields"] = [
                    field for field in event.get("fields", [])
                    if field.get("name") not in {"versionPublicId", "predecessorRevision"}
                ]
                event["aggregateEntityType"] = "table:" + root_table
                field_by_name = {field["name"]: field for field in event.get("fields", [])}
                replacements = {
                    "aggregateId": ("UUID", root_table + ".public_id", "table:" + root_table),
                    "aggregateVersion": ("BIGINT", root_table + ".aggregate_version", None),
                    "toState": ("STRING", root_table + ".status", None),
                }
                for name, (field_type, source, entity) in replacements.items():
                    if name in field_by_name:
                        field_by_name[name].update({
                            "type": field_type, "sourceKind": "PHYSICAL_POST_STATE",
                            "source": source,
                        })
                        if entity:
                            field_by_name[name]["referenceContract"] = {
                                "entityType": entity, "idSpace": "PUBLIC_UUID",
                            }
                for name, field_type, source, entity in (
                    ("revisionPublicId", "UUID", temporal_table + ".public_id", "table:" + temporal_table),
                    ("contentRevisionPublicId", "UUID", temporal_table + ".content_revision_public_id", "table:" + temporal_table),
                    ("stateRevisionPublicId", "UUID", temporal_table + ".public_id", "table:" + temporal_table),
                    ("rootVersion", "BIGINT", temporal_table + ".root_version", None),
                    ("effectiveSegmentPublicId", "UUID", temporal_table + ".effective_segment_public_id", "DWP.EffectiveTime.Segment"),
                    ("segmentRevision", "BIGINT", temporal_table + ".segment_revision", None),
                    ("revisionMode", "STRING", temporal_table + ".revision_mode", None),
                    ("effectiveFrom", (
                        "TIMESTAMPTZ" if temporal_table == "prf_mkt_opportunity_versions" else "DATE"
                    ), temporal_table + ".effective_from", None),
                    ("segmentPredecessorPublicId", "UUID", temporal_table + ".segment_predecessor_public_id", "table:" + temporal_table),
                    ("segmentPredecessorRevision", "BIGINT", temporal_table + ".segment_predecessor_revision", None),
                ):
                    if name not in field_by_name:
                        new_field = _event_field(
                            name, field_type, "PHYSICAL_POST_STATE", source, entity=entity,
                        )
                        if name == "segmentPredecessorPublicId":
                            new_field["required"] = False
                        event.setdefault("fields", []).append(new_field)
                event["audience"]["fieldExposure"]["fields"] = [
                    field["name"] for field in event["fields"]
                ]


def _repair_business_inputs_and_writes(operation: dict[str, Any]) -> None:
    operation_id = operation["operationId"]
    for spec in (*BUSINESS_INPUT_SPECS.get(operation_id, ()),
                 *GLOBAL_BUSINESS_INPUT_SPECS.get(operation_id, ())):
        _ensure_business_field(operation, spec)
        _, _, _, table, column_name = spec
        step = _domain_step(operation, table)
        if step is not None and column_name not in {"typed_node_rows", "typed_edge_rows", "typed_level_rows"}:
            step.setdefault("assignments", {})[column_name] = _business_assignment_source(spec)

    if operation_id == "modern.compplan.proposal.upsert":
        operation["transition"].pop("preStates", None)
        operation["transition"].update({
            "mode": "DISCRIMINATED_CREATE_OR_UPDATE",
            "branches": [
                {"branch": "CREATE", "when": "proposal identity absent", "preState": "NONE",
                 "postState": "DRAFT", "action": "INSERT", "expectedRows": "EXACTLY_ONE_NEW"},
                {"branch": "UPDATE", "when": "proposal identity exists", "preState": "DRAFT",
                 "postState": "DRAFT", "action": "UPDATE_CAS", "expectedRows": "EXACTLY_ONE_EXISTING"},
            ],
            "branchExclusivity": "EXACTLY_ONE_AFTER_TENANT_BOUND_IDENTITY_PROBE",
        })
        for step in operation.get("orderedDml", []):
            if step.get("table") != "prf_cmp_proposals":
                continue
            step.setdefault("assignments", {}).update({
                "compensation_cycle_id": "SELECTED:prf_cmp_cycles.record_id FROM pathParameters.cycleId",
                "worker_public_id": "body.workerPublicId", "component_code": "body.componentCode",
                "amount": "body.amount", "currency_code": "body.currencyCode",
                "effective_date": "body.effectiveDate", "effective_from": "body.effectiveDate",
            })
            step["branch"] = "CREATE" if step.get("action") == "INSERT" else "UPDATE"
            step["mutuallyExclusiveWith"] = "UPDATE" if step["branch"] == "CREATE" else "CREATE"


def _repair_internal_identity_fk_writes(operation: dict[str, Any]) -> None:
    """Persist owner-local BIGINT identities separately from public lineage IDs."""

    operation_id = operation["operationId"]
    by_operation: dict[str, dict[str, dict[str, str]]] = {
        "modern.contingent.engagement.create": {
            table: {"contingent_engagement_id": "LOCKED_POST:ppl_cwk_engagements.contingent_engagement_id"}
            for table in (
                "ppl_cwk_engagement_versions", "ppl_cwk_classification_receipts",
                "ppl_cwk_access_requests",
            )
        },
        "modern.contingent.engagement.revise": {
            "ppl_cwk_engagement_versions": {
                "contingent_engagement_id": (
                    "SELECTED:ppl_cwk_engagements.contingent_engagement_id "
                    "FROM pathParameters.engagementId"
                ),
            },
        },
        "modern.growth.coaching.record": {
            "prf_grw_coaching_note_evidence_refs": {
                "growth_coaching_note_id": "LOCKED_POST:prf_grw_coaching_notes.growth_coaching_note_id",
                "worker_skill_evidence_id": (
                    "SELECTED:prf_skl_worker_evidence.worker_skill_evidence_id "
                    "FROM body.evidenceRefs[*]"
                ),
            },
        },
        "modern.growth.profile.update": {
            "prf_grw_profile_revision_evidence_refs": {
                "worker_skill_evidence_id": (
                    "SELECTED:prf_skl_worker_evidence.worker_skill_evidence_id "
                    "FROM body.evidenceRefs[*]"
                ),
            },
        },
        "modern.learning.completion.verify": {
            "prf_lrn_completion_skill_evidence_refs": {
                "learning_completion_evidence_id": (
                    "LOCKED_POST:prf_lrn_completion_evidence.learning_completion_evidence_id"
                ),
                "worker_skill_evidence_id": (
                    LEARNING_WORKER_SKILL_EVIDENCE_SELECTOR
                ),
            },
        },
        "modern.analytics.export.create": {
            "sys_hris_analytics_export_projection_refs": {
                "analytics_export_receipt_id": (
                    "LOCKED_POST:sys_hris_analytics_export_receipts.analytics_export_receipt_id"
                ),
                "metric_projection_id": (
                    "SELECTED:sys_hris_metric_projections.metric_projection_id "
                    "FROM body.metricProjectionIds[*]"
                ),
            },
        },
    }
    if operation_id in {"modern.skills.taxonomy.create", "modern.skills.taxonomy.revise"}:
        by_operation[operation_id] = {
            table: {
                "skill_taxonomy_version_id": (
                    "LOCKED_POST:prf_skl_taxonomy_versions.skill_taxonomy_version_id"
                ),
            }
            for table in (
                "prf_skl_skill_nodes", "prf_skl_skill_edges", "prf_skl_proficiency_levels",
            )
        }
    for table, assignments in by_operation.get(operation_id, {}).items():
        step = _domain_step(operation, table)
        if step:
            step.setdefault("assignments", {}).update(assignments)


P1_DECISION_TABLES = {
    "modern.recruiting.offer.respond": "ppl_rec_offer_decisions",
    "modern.benefits.lifeevent.decide": "ppl_bnf_life_event_decisions",
    "modern.opportunity.application.withdraw": "prf_mkt_application_decisions",
    "modern.succession.nomination.withdraw": "prf_suc_readiness_evidence",
}


def _apply_p1_decision_contract(operation: dict[str, Any]) -> None:
    operation_id = operation["operationId"]
    table = P1_DECISION_TABLES.get(operation_id)
    if not table:
        return
    parent_source = {
        "modern.recruiting.offer.respond": "pathParameters.offerId",
        "modern.benefits.lifeevent.decide": "pathParameters.lifeEventId",
        "modern.opportunity.application.withdraw": "pathParameters.applicationId",
        "modern.succession.nomination.withdraw": "pathParameters.nominationId",
    }[operation_id]
    step = _domain_step(operation, table)
    if step is None:
        base_assignments = (
            {
                "tenant_id": "authenticatedPrincipal.tenantId",
                "public_id": "SERVER_ALLOCATE:UUID_V7_REPLAY_STABLE",
                "aggregate_version": "CONSTANT:1",
                "succession_nomination_id": "SELECTED:prf_suc_nominations.record_id FROM pathParameters.nominationId",
                "evidence_public_id": "body.decisionSourceReceiptPublicId",
                "evidence_digest": "SERVER_DERIVE:canonical withdrawal decision proof",
                "payload_digest": "SERVER_DERIVE:canonical withdrawal decision fact",
                "recorded_at": "ownerClock.transactionNow",
                "source_revision": "body.decisionSourceReceiptRevision",
                "expires_at": "CONSTANT:NULL",
            }
            if table == "prf_suc_readiness_evidence"
            else _new_immutable_fact(parent_source, "WITHDRAWN")
        )
        step = _append_fact_step(
            operation, table, base_assignments,
            role="IMMUTABLE_SUBJECT_OR_PROXY_DECISION",
        )
    step["action"] = "APPEND"
    step["role"] = "IMMUTABLE_SUBJECT_OR_PROXY_DECISION"
    step["assignments"].update({
        "actor_mode": "body.actorMode",
        "actor_public_id": "authenticatedPrincipal.publicId",
        "subject_public_id": "LOCKED_OWNER_SUBJECT",
        "delegation_receipt_public_id": "body.delegationReceiptPublicId IF AUTHORIZED_PROXY",
        "delegation_receipt_revision": "body.delegationReceiptRevision IF AUTHORIZED_PROXY",
        "decision_source_receipt_public_id": "body.decisionSourceReceiptPublicId",
        "decision_source_receipt_revision": "body.decisionSourceReceiptRevision",
        "reason_code": "body.reasonCode",
    })
    if table == "prf_mkt_application_decisions":
        step["assignments"].update({
            "approval_receipt_public_id": "body.decisionSourceReceiptPublicId",
            "approval_receipt_revision": "body.decisionSourceReceiptRevision",
            "approval_outcome": "OWNER_REFETCH:body.decisionSourceReceiptPublicId.outcome",
            "approval_action": "OWNER_REFETCH:body.decisionSourceReceiptPublicId.action",
            "approval_input_digest": "OWNER_REFETCH:body.decisionSourceReceiptPublicId.inputDigest",
            "approval_purpose_code": "OWNER_REFETCH:body.decisionSourceReceiptPublicId.purposeCode",
            "approval_tenant_id": "OWNER_REFETCH:body.decisionSourceReceiptPublicId.tenantId",
        })
    operation.setdefault("inputEffects", []).extend([
        {
            "source": "body.actorMode", "type": "STRING", "required": True,
            "sensitivity": "INTERNAL", "requestDigestMember": True,
            "effects": [{
                "kind": "ACTOR_MODE_SWITCH",
                "selfCapability": operation["authorizationCapability"],
                "proxyCapability": operation["authorizationCapability"] + ".proxy",
                "selfWhen": {"source": "body.actorMode", "equals": "SELF"},
                "proxyWhen": {"source": "body.actorMode", "equals": "AUTHORIZED_PROXY"},
                "failure": "403_ZERO_MUTATION",
            }],
        },
        {
            "source": "body.decisionSourceReceiptPublicId", "type": "UUID", "required": True,
            "sensitivity": "RESTRICTED", "requestDigestMember": True,
            "effects": [{
                "kind": "OWNER_REFETCH",
                "target": "DWP.Authorization.DecisionReceipt",
                "selector": "tenant+purpose+subject+publicId+revision",
                "delegation": "required exactly when actorMode=AUTHORIZED_PROXY",
                "failure": "404_OPAQUE_ZERO_MUTATION",
            }],
        },
    ])
    for event in operation.get("events", []):
        if not any(row.get("name") == "decisionSourceClass" for row in event.get("fields", [])):
            event.setdefault("fields", []).append(_event_field(
                "decisionSourceClass", "STRING", "PHYSICAL_POST_STATE",
                table + ".actor_mode",
            ))
            event["audience"]["fieldExposure"]["fields"] = [
                row["name"] for row in event["fields"]
            ]


P1_REVISION_TABLES = {
    "modern.recruiting.requisition.revise": "ppl_rec_requisition_versions",
    "modern.onboarding.template.revise": "ppl_jny_template_versions",
    "modern.benefits.plan.revise": "ppl_bnf_plan_versions",
    "modern.contingent.engagement.revise": "ppl_cwk_engagement_versions",
    "modern.learning.offering.revise": "prf_lrn_offering_versions",
    "modern.opportunity.revise": "prf_mkt_opportunity_versions",
    "modern.succession.plan.revise": "prf_suc_plan_versions",
}

TEMPORAL_VERSION_STATE_COLUMN = {
    "ppl_bnf_plan_versions": "status",
    "ppl_jny_template_versions": "status",
    "ppl_rec_requisition_versions": "state",
    "ppl_cwk_engagement_versions": "state",
    "prf_lrn_offering_versions": "state",
    "prf_mkt_opportunity_versions": "state",
    "prf_suc_plan_versions": "state",
}

TEMPORAL_VERSION_ROOT_TABLE = {
    "ppl_bnf_plan_versions": "ppl_bnf_plans",
    "ppl_jny_template_versions": "ppl_jny_templates",
    "ppl_rec_requisition_versions": "ppl_rec_requisitions",
    "ppl_cwk_engagement_versions": "ppl_cwk_engagements",
    "prf_lrn_offering_versions": "prf_lrn_offerings",
    "prf_mkt_opportunity_versions": "prf_mkt_opportunities",
    "prf_suc_plan_versions": "prf_suc_plans",
}

TEMPORAL_ROOT_STATE_COLUMN = {
    "ppl_bnf_plans": "status",
    "ppl_jny_templates": "status",
    "ppl_rec_requisitions": "status",
    "ppl_cwk_engagements": "status",
    "prf_lrn_offerings": "status",
    "prf_mkt_opportunities": "status",
    "prf_suc_plans": "status",
}

TEMPORAL_DETAIL_QUERY_BY_VERSION_TABLE = {
    "ppl_bnf_plan_versions": "modern.benefits.plan.query",
    "ppl_jny_template_versions": "modern.onboarding.template.query",
    "ppl_rec_requisition_versions": "modern.recruiting.requisition.query",
    "ppl_cwk_engagement_versions": "modern.contingent.engagement.query",
    "prf_lrn_offering_versions": "modern.learning.offering.query",
    "prf_mkt_opportunity_versions": "modern.opportunity.query",
    "prf_suc_plan_versions": "modern.succession.plan.query",
}

TEMPORAL_ROOT_INSERT_SELECTOR = (
    "tenant+owner-generated replay-stable stable-root public identity+"
    "exact parent selectors+sealed command idempotency claim"
)
TEMPORAL_ROOT_CAS_SELECTOR = (
    "tenant+stable root public identity+If-Match expected root version+allowed pre-state"
)
TEMPORAL_ROOT_VERSION_ATOMICITY = (
    "SAME_SQL_TRANSACTION_SAME_BRANCH_ROOT_MUTATION_AND_EXACTLY_ONE_VERSION_APPEND"
)
TEMPORAL_CREATE_VERSION_SELECTOR = (
    "tenant+new stable root identity+owner-generated replay-stable initial version identity;"
    "no predecessor row or clock-derived boundary"
)
TEMPORAL_REVISE_VERSION_SELECTOR = (
    "tenant+stable root locked by If-Match+current global max root_version tip;"
    "CORRECTION locks exact requested predecessor public_id+segment_revision and proves it is "
    "the maximum segment_revision in that same parent+effective_segment_public_id+effective_from;"
    "SUPERSEDE forbids a segment predecessor and requires a new effective_from;zero mutation on mismatch"
)
TEMPORAL_LIFECYCLE_VERSION_SELECTOR = (
    "tenant+locked stable root+global max root_version tip; follow that row's "
    "effective_segment_public_id then lock max segment_revision in the same segment; "
    "owner-generated replay-stable identity"
)

TEMPORAL_CREATE_EFFECTIVE_FROM_SOURCE = {
    "ppl_bnf_plan_versions": "body.effectiveFrom",
    "ppl_jny_template_versions": "body.effectiveFrom",
    "ppl_rec_requisition_versions": "body.targetStartDate",
    "ppl_cwk_engagement_versions": "body.effectiveFrom",
    "prf_lrn_offering_versions": "body.effectiveFrom",
    "prf_mkt_opportunity_versions": "body.openFrom",
    "prf_suc_plan_versions": "body.effectiveFrom",
}


def _temporal_create_write_contract(
    version_table: str, revision_action: str,
) -> dict[str, Any]:
    return {
        "strategy": "DUAL_APPEND_ONLY_ROOT_AND_EFFECTIVE_SEGMENT_CHAINS",
        "revisionStepTable": version_table,
        "revisionAction": revision_action,
        "rootTable": TEMPORAL_VERSION_ROOT_TABLE[version_table],
        "rootAction": "INSERT",
        "rootVersion": "1",
        "rootPredecessor": "NULL+0_INITIAL_GLOBAL_APPEND",
        "effectiveSegmentSource": "initial replay-stable revision public identity",
        "segmentRevision": "1",
        "segmentPredecessor": "NULL+0_INITIAL_BASE_SEGMENT",
        "storedEffectiveTo": "NULL_ONLY;DERIVED_FROM_NEXT_VISIBLE_BASE_SEGMENT",
        "priorHistoryMutation": "FORBIDDEN",
    }


def _temporal_revise_write_contract(version_table: str) -> dict[str, Any]:
    return {
        "strategy": "DUAL_APPEND_ONLY_ROOT_AND_EFFECTIVE_SEGMENT_CHAINS",
        "revisionStepTable": version_table,
        "revisionAction": "APPEND",
        "rootAction": "UPDATE_CAS",
        "expectedVersionSource": "If-Match",
        "rootPredecessorSource": "locked latest global append tip selected under root If-Match",
        "rootPredecessorMustBeCurrentGlobalAppendTip": True,
        "segmentPredecessorSource": (
            "body segmentPredecessorVersionId+Revision owner-local exact refetch under the same "
            "tenant+stable-parent root lock; public identity and revision must equal the maximum "
            "segment_revision in that exact effective_segment_public_id+effective_from"
        ),
        "segmentPredecessorMustBeCurrentTipWithinEffectiveSegment": True,
        "intervalValidation": (
            "SUPERSEDE requires a new effectiveFrom and forbids predecessor fields; CORRECTION "
            "forbids effectiveFrom, requires both exact predecessor fields, and reuses the exact "
            "predecessor segment boundary; persisted effective_to is always NULL; all violations "
            "fail before writes"
        ),
        "correctionRule": (
            "CORRECTION reuses exact predecessor effective_segment_public_id/effective_from, "
            "appends segment_revision+1, and may target an older segment after a future supersede"
        ),
        "lifecycleRule": (
            "LIFECYCLE reuses exact predecessor segment and appends segment_revision+1"
        ),
        "futureSupersedeRule": (
            "SUPERSEDE allocates a new effective segment; prior effective_to/history is never mutated"
        ),
        "storedEffectiveTo": "NULL_ONLY;derived from next visible base segment effective_from",
        "businessAsOfWinner": (
            "after recorded_at<=systemAsOf choose visible base segment revision 1 with maximum "
            "effective_from<=businessAsOf, then max segment_revision only in that segment"
        ),
        "stateWinner": (
            "after systemAsOf filter choose maximum root_version across all version rows; "
            "state/status and stable root aggregate version come from this row"
        ),
        "contentAndStateIdentity": (
            "contentRevisionPublicId=business segment winner public_id; "
            "stateRevisionPublicId=global state winner public_id"
        ),
        "atomicity": "revision APPEND and root UPDATE_CAS commit together; CAS loss rolls back append",
        "priorHistoryMutation": "FORBIDDEN",
    }


def _temporal_lifecycle_write_contract(version_table: str) -> dict[str, Any]:
    return {
        "strategy": "DUAL_APPEND_ONLY_ROOT_AND_EFFECTIVE_SEGMENT_CHAINS",
        "revisionStepTable": version_table,
        "revisionAction": "APPEND",
        "rootAction": "UPDATE_CAS",
        "expectedVersionSource": "If-Match",
        "rootPredecessorSource": "locked latest global append tip public_id+root_version",
        "rootPredecessorMustBeCurrentTip": True,
        "lifecycleSegmentSelection": (
            "GLOBAL_TIP_ROW.effective_segment_public_id then maximum segment_revision in that exact "
            "segment under the stable-root lock; never recompute business-current by wall clock"
        ),
        "segmentPredecessorSource": (
            "locked global-tip-attached segment tip public_id+segment_revision"
        ),
        "segmentPredecessorMustBeCurrentSegmentTip": True,
        "lifecycleRule": "reuse exact segment id/effective_from and append segment_revision+1",
        "storedEffectiveTo": "NULL_ONLY;derived from next visible base segment",
        "priorHistoryMutation": "FORBIDDEN",
        "atomicity": "root CAS and version append commit together; CAS loss rolls back append",
    }


def _temporal_event_refetch_contract(
    *,
    version_table: str,
    root_table: str,
    owner_session: str,
    purpose: str,
    event: dict[str, Any],
) -> dict[str, Any]:
    """Return the only permitted temporal-event re-entry contract.

    The event identifies the immutable global state row and its pinned content
    row separately.  Re-entry can therefore reproduce the event-time snapshot
    after later lifecycle, correction, or future-supersede appends.
    """
    allowed_fields = [field["name"] for field in event.get("fields", [])]
    return {
        "mode": "EXACT_HISTORICAL_VERSION",
        "ownerSession": owner_session,
        "entityType": "table:" + root_table,
        "endpointOperationId": TEMPORAL_DETAIL_QUERY_BY_VERSION_TABLE[version_table],
        "allowedFields": allowed_fields,
        "pep": {
            "tenant": "event envelope tenantId",
            "stableParent": "event.aggregateId exact stable-root public identity",
            "purpose": [purpose],
            "consumerSessionAllowlist": [owner_session],
            "fieldExposure": allowed_fields,
            "reauthorizeEveryCall": True,
            "denyOnUnavailable": True,
        },
        "version": (
            "event.revisionPublicId=event.stateRevisionPublicId and event.rootVersion "
            "must resolve the same tenant+stable-parent STATE_ROW; join exactly through "
            "STATE_ROW.content_revision_public_id=event.contentRevisionPublicId to one "
            "CONTENT_ROW; no latest fallback and no current-row fallback"
        ),
        "selectors": {
            "stableParent": "event.aggregateId",
            "stateRevisionPublicId": "event.stateRevisionPublicId",
            "revisionPublicId": "event.revisionPublicId",
            "rootVersion": "event.rootVersion",
            "contentRevisionPublicId": "event.contentRevisionPublicId",
            "agreement": (
                "revisionPublicId+stateRevisionPublicId+rootVersion name one STATE_ROW; "
                "contentRevisionPublicId equals that row's immutable content pointer"
            ),
        },
        "asOf": "event.occurredAt as systemAsOf under the event stable parent",
        "latestFallback": "FORBIDDEN",
    }


def _temporal_revise_control_fields(version_table: str) -> dict[str, dict[str, Any]]:
    effective_type = (
        "TIMESTAMPTZ" if version_table == "prf_mkt_opportunity_versions" else "DATE"
    )
    revision_mode = _field("revisionMode", "body", "STRING")
    revision_mode.update({
        "validation": (
            "closed enum CORRECTION|SUPERSEDE; LIFECYCLE is server-only in explicit "
            "publish/retire operations"
        ),
        "allowedValues": ["CORRECTION", "SUPERSEDE"],
    })
    effective_from = _field(
        "effectiveFrom", "body", effective_type, required=False,
    )
    effective_from["validation"] = (
        "REQUIRED_IFF_revisionMode=SUPERSEDE;FORBIDDEN_FOR_CORRECTION;"
        "must create a new business-effective segment"
    )
    predecessor_id = _field(
        "segmentPredecessorVersionId", "body", "UUID", required=False,
        entity="table:" + version_table,
    )
    predecessor_id["validation"] = (
        "REQUIRED_IFF_revisionMode=CORRECTION;FORBIDDEN_FOR_SUPERSEDE;"
        "exact current tip public identity within the target effective segment"
    )
    predecessor_revision = _field(
        "segmentPredecessorRevision", "body", "BIGINT", required=False,
    )
    predecessor_revision["validation"] = (
        "REQUIRED_IFF_revisionMode=CORRECTION;FORBIDDEN_FOR_SUPERSEDE;"
        "positive exact current segment revision"
    )
    return {
        row["source"]: row for row in (
            revision_mode, effective_from, predecessor_id, predecessor_revision,
        )
    }


def _temporal_revise_control_effects(version_table: str) -> list[dict[str, Any]]:
    effective_type = (
        "TIMESTAMPTZ" if version_table == "prf_mkt_opportunity_versions" else "DATE"
    )
    return [{
        "source": "body.revisionMode", "type": "STRING", "required": True,
        "sensitivity": "INTERNAL", "requestDigestMember": True,
        "effects": [{
            "kind": "TYPED_DOMAIN_INPUT",
            "target": version_table + ".revision_mode",
        }],
    }, {
        "source": "body.segmentPredecessorVersionId", "type": "UUID",
        "required": False, "sensitivity": "RESTRICTED", "requestDigestMember": True,
        "effects": [{
            "kind": "EFFECTIVE_SEGMENT_EXACT_PREDECESSOR",
            "target": version_table + ".public_id",
            "condition": {"source": "body.revisionMode", "equals": "CORRECTION"},
            "requires": (
                "body.segmentPredecessorRevision exact; same tenant+stable parent+"
                "effective_segment_public_id+effective_from; equals maximum segment_revision "
                "under the locked root"
            ),
            "failure": "422_NONLATEST_OR_CROSS_SEGMENT_PREDECESSOR_ZERO_MUTATION",
        }],
    }, {
        "source": "body.effectiveFrom", "type": effective_type,
        "required": False, "sensitivity": "INTERNAL", "requestDigestMember": True,
        "effects": [{
            "kind": "NEW_EFFECTIVE_SEGMENT_START",
            "target": version_table + ".effective_from",
            "condition": {"source": "body.revisionMode", "equals": "SUPERSEDE"},
            "failure": "422_MISSING_OR_CORRECTION_SUPPLIED_EFFECTIVE_FROM_ZERO_MUTATION",
        }],
    }, {
        "source": "body.segmentPredecessorRevision", "type": "BIGINT",
        "required": False, "sensitivity": "INTERNAL", "requestDigestMember": True,
        "effects": [{
            "kind": "SEGMENT_REVISION_COMPARE",
            "target": version_table + ".segment_revision",
            "condition": {"source": "body.revisionMode", "equals": "CORRECTION"},
            "requires": (
                "equals selected predecessor.segment_revision and that row is the maximum "
                "revision in the exact tenant+parent+segment under root lock"
            ),
            "failure": "409_SEGMENT_TIP_CHANGED_ZERO_MUTATION",
        }],
    }]


def _temporal_revise_predecessor_selector(
    operation: dict[str, Any], version_table: str,
) -> dict[str, Any]:
    return {
        "source": "body.segmentPredecessorVersionId",
        "selectorType": "LOCAL_TABLE",
        "entityType": "table:" + version_table,
        "idSpace": "PUBLIC_UUID",
        "sourceType": "UUID",
        "targetTable": version_table,
        "targetColumn": "public_id",
        "targetSqlType": "UUID",
        "operator": "=",
        "cardinality": "EXACTLY_ONE_IF_CORRECTION;FORBIDDEN_IF_SUPERSEDE",
        "tenantFilter": "tenant_id=authenticatedPrincipal.tenantId",
        "purposeFilter": operation["authorizationCapability"],
        "versionRule": (
            "request.segmentPredecessorRevision=target.segment_revision="
            "MAX(segment_revision) in exact parent+effective_segment_public_id+effective_from"
        ),
        "asOfRule": "same locked stable-root transaction snapshot; wall-clock latest forbidden",
        "causalJoin": (
            "same tenant+stable parent as path root; root global tip locked under If-Match; "
            "exact predecessor public_id+revision names current tip of its effective segment"
        ),
        "failure": "404_OPAQUE_OR_409_STALE_OR_422_CROSS_SEGMENT;ZERO_MUTATION",
    }


def _expected_temporal_create_chain_assignments(
    version_table: str,
) -> dict[str, str]:
    result = {
        "public_id": "SERVER_ALLOCATE:REVISION_UUID_V7_REPLAY_STABLE",
        "revision_mode": "CONSTANT:CREATE",
        "root_version": "CONSTANT:1",
        "root_predecessor_public_id": "CONSTANT:NULL",
        "root_predecessor_version": "CONSTANT:0",
        "effective_segment_public_id": "SERVER_REUSE:REVISION_UUID_V7_REPLAY_STABLE",
        "content_revision_public_id": "SERVER_REUSE:REVISION_UUID_V7_REPLAY_STABLE",
        "segment_revision": "CONSTANT:1",
        "segment_predecessor_public_id": "CONSTANT:NULL",
        "segment_predecessor_revision": "CONSTANT:0",
        "effective_from": TEMPORAL_CREATE_EFFECTIVE_FROM_SOURCE[version_table],
        "effective_to": "CONSTANT:NULL",
    }
    if version_table == "ppl_bnf_plan_versions":
        result["valid_from"] = "body.effectiveFrom"
    return result


def _expected_temporal_revise_chain_assignments(
    version_table: str,
) -> dict[str, str]:
    root_table = TEMPORAL_VERSION_ROOT_TABLE[version_table]
    result = {
        "public_id": "SERVER_ALLOCATE:REVISION_UUID_V7_REPLAY_STABLE",
        "revision_mode": "body.revisionMode",
        "root_version": "LOCKED_PRE:" + root_table + ".aggregate_version+1",
        "root_predecessor_public_id": (
            "LOCKED_GLOBAL_TIP:" + version_table + ".public_id"
        ),
        "root_predecessor_version": (
            "LOCKED_PRE:" + root_table + ".aggregate_version"
        ),
        "effective_from": (
            "SEGMENT_PREDECESSOR.effective_from IF body.revisionMode=CORRECTION "
            "ELSE body.effectiveFrom"
        ),
        "effective_to": "CONSTANT:NULL",
        "effective_segment_public_id": (
            "SEGMENT_PREDECESSOR.effective_segment_public_id "
            "IF body.revisionMode=CORRECTION "
            "ELSE SERVER_REUSE:REVISION_UUID_V7_REPLAY_STABLE"
        ),
        "content_revision_public_id": "SERVER_REUSE:REVISION_UUID_V7_REPLAY_STABLE",
        "segment_revision": (
            "body.segmentPredecessorRevision+1 "
            "IF body.revisionMode=CORRECTION ELSE CONSTANT:1"
        ),
        "segment_predecessor_public_id": (
            "body.segmentPredecessorVersionId "
            "IF body.revisionMode=CORRECTION ELSE CONSTANT:NULL"
        ),
        "segment_predecessor_revision": (
            "body.segmentPredecessorRevision "
            "IF body.revisionMode=CORRECTION ELSE CONSTANT:0"
        ),
    }
    if version_table == "ppl_bnf_plan_versions":
        result["valid_from"] = (
            "SEGMENT_PREDECESSOR.valid_from IF body.revisionMode=CORRECTION "
            "ELSE body.effectiveFrom"
        )
    return result


def _expected_temporal_lifecycle_chain_assignments(
    version_table: str,
) -> dict[str, str]:
    root_table = TEMPORAL_VERSION_ROOT_TABLE[version_table]
    return {
        "public_id": "SERVER_ALLOCATE:UUID_V7_REPLAY_STABLE",
        "revision_mode": "CONSTANT:LIFECYCLE",
        "root_version": "LOCKED_PRE:" + root_table + ".aggregate_version+1",
        "root_predecessor_public_id": (
            "LOCKED_GLOBAL_TIP:" + version_table + ".public_id"
        ),
        "root_predecessor_version": (
            "LOCKED_PRE:" + root_table + ".aggregate_version"
        ),
        "effective_segment_public_id": (
            "LOCKED_GLOBAL_TIP_SEGMENT_TIP:" + version_table
            + ".effective_segment_public_id"
        ),
        "segment_revision": (
            "LOCKED_GLOBAL_TIP_SEGMENT_TIP:" + version_table
            + ".segment_revision+1"
        ),
        "segment_predecessor_public_id": (
            "LOCKED_GLOBAL_TIP_SEGMENT_TIP:" + version_table + ".public_id"
        ),
        "segment_predecessor_revision": (
            "LOCKED_GLOBAL_TIP_SEGMENT_TIP:" + version_table
            + ".segment_revision"
        ),
        "content_revision_public_id": (
            "LOCKED_GLOBAL_TIP_SEGMENT_TIP:" + version_table
            + ".content_revision_public_id"
        ),
        "effective_from": (
            "LOCKED_GLOBAL_TIP_SEGMENT_TIP:" + version_table + ".effective_from"
        ),
        "effective_to": "CONSTANT:NULL",
    }

TEMPORAL_LIFECYCLE_OPERATION_SPECS = {
    "modern.benefits.plan.publish": ("ppl_bnf_plans", "ppl_bnf_plan_versions", "PUBLISHED"),
    "modern.benefits.plan.retire": ("ppl_bnf_plans", "ppl_bnf_plan_versions", "RETIRED"),
    "modern.onboarding.template.publish": ("ppl_jny_templates", "ppl_jny_template_versions", "PUBLISHED"),
    "modern.onboarding.template.retire": ("ppl_jny_templates", "ppl_jny_template_versions", "RETIRED"),
    "modern.contingent.engagement.activate": ("ppl_cwk_engagements", "ppl_cwk_engagement_versions", "ACTIVATION_PENDING"),
    "modern.contingent.engagement.offboard": ("ppl_cwk_engagements", "ppl_cwk_engagement_versions", "OFFBOARDING"),
    "modern.contingent.engagement.reject": ("ppl_cwk_engagements", "ppl_cwk_engagement_versions", "REJECTED"),
    "modern.contingent.engagement.submit": ("ppl_cwk_engagements", "ppl_cwk_engagement_versions", "PENDING_APPROVAL"),
    "modern.contingent.sponsor.reassign": ("ppl_cwk_engagements", "ppl_cwk_engagement_versions", "LOCKED_PRE_STATE"),
    "modern.recruiting.requisition.lifecycle.change": ("ppl_rec_requisitions", "ppl_rec_requisition_versions", "body.targetState"),
    "modern.recruiting.requisition.publish": ("ppl_rec_requisitions", "ppl_rec_requisition_versions", "OPEN"),
    "modern.learning.offering.publish": ("prf_lrn_offerings", "prf_lrn_offering_versions", "PUBLISHED"),
    "modern.learning.offering.retire": ("prf_lrn_offerings", "prf_lrn_offering_versions", "RETIRED"),
    "modern.opportunity.publish": ("prf_mkt_opportunities", "prf_mkt_opportunity_versions", "OPEN"),
    "modern.opportunity.close": ("prf_mkt_opportunities", "prf_mkt_opportunity_versions", "CLOSED"),
    "modern.opportunity.cancel": ("prf_mkt_opportunities", "prf_mkt_opportunity_versions", "CANCELLED"),
    "modern.succession.nomination.add": ("prf_suc_plans", "prf_suc_plan_versions", "LOCKED_PRE_STATE"),
    "modern.succession.nomination.withdraw": ("prf_suc_plans", "prf_suc_plan_versions", "LOCKED_PRE_STATE"),
    "modern.succession.plan.submit": ("prf_suc_plans", "prf_suc_plan_versions", "PENDING_APPROVAL"),
    "modern.succession.plan.approve": ("prf_suc_plans", "prf_suc_plan_versions", "APPROVED"),
    "modern.succession.plan.reject": ("prf_suc_plans", "prf_suc_plan_versions", "REJECTED"),
    "modern.succession.plan.publish": ("prf_suc_plans", "prf_suc_plan_versions", "PUBLISHED"),
    "modern.succession.plan.retire": ("prf_suc_plans", "prf_suc_plan_versions", "RETIRED"),
    "modern.succession.readiness.record": ("prf_suc_plans", "prf_suc_plan_versions", "LOCKED_PRE_STATE"),
}


def _apply_builtin_version_lifecycle_append(operation: dict[str, Any]) -> None:
    """Append one immutable state revision for every stable-root CAS.

    The root aggregate version and the immutable global chain are aliases, so
    a root mutation without a version append would create a permanent gap and
    make exact event/query re-entry impossible.  Content is copied from the
    business-time winner while lifecycle state is sourced from the global tip.
    """

    operation_id = operation["operationId"]
    specs = TEMPORAL_LIFECYCLE_OPERATION_SPECS
    """Closed map retained here for review history; executable source is the
    module-level constant shared with validation.
    specs_legacy = {
        "modern.benefits.plan.publish": ("ppl_bnf_plans", "ppl_bnf_plan_versions", "PUBLISHED"),
        "modern.benefits.plan.retire": ("ppl_bnf_plans", "ppl_bnf_plan_versions", "RETIRED"),
        "modern.onboarding.template.publish": ("ppl_jny_templates", "ppl_jny_template_versions", "PUBLISHED"),
        "modern.onboarding.template.retire": ("ppl_jny_templates", "ppl_jny_template_versions", "RETIRED"),
        "modern.contingent.engagement.activate": ("ppl_cwk_engagements", "ppl_cwk_engagement_versions", "ACTIVATION_PENDING"),
        "modern.contingent.engagement.offboard": ("ppl_cwk_engagements", "ppl_cwk_engagement_versions", "OFFBOARDING"),
        "modern.contingent.engagement.reject": ("ppl_cwk_engagements", "ppl_cwk_engagement_versions", "REJECTED"),
        "modern.contingent.engagement.submit": ("ppl_cwk_engagements", "ppl_cwk_engagement_versions", "PENDING_APPROVAL"),
        "modern.contingent.sponsor.reassign": ("ppl_cwk_engagements", "ppl_cwk_engagement_versions", "LOCKED_PRE_STATE"),
        "modern.recruiting.requisition.lifecycle.change": ("ppl_rec_requisitions", "ppl_rec_requisition_versions", "body.targetState"),
        "modern.recruiting.requisition.publish": ("ppl_rec_requisitions", "ppl_rec_requisition_versions", "OPEN"),
        "modern.learning.offering.publish": ("prf_lrn_offerings", "prf_lrn_offering_versions", "PUBLISHED"),
        "modern.learning.offering.retire": ("prf_lrn_offerings", "prf_lrn_offering_versions", "RETIRED"),
        "modern.opportunity.publish": ("prf_mkt_opportunities", "prf_mkt_opportunity_versions", "OPEN"),
        "modern.opportunity.close": ("prf_mkt_opportunities", "prf_mkt_opportunity_versions", "CLOSED"),
        "modern.opportunity.cancel": ("prf_mkt_opportunities", "prf_mkt_opportunity_versions", "CANCELLED"),
        "modern.succession.nomination.add": ("prf_suc_plans", "prf_suc_plan_versions", "LOCKED_PRE_STATE"),
        "modern.succession.nomination.withdraw": ("prf_suc_plans", "prf_suc_plan_versions", "LOCKED_PRE_STATE"),
        "modern.succession.plan.submit": ("prf_suc_plans", "prf_suc_plan_versions", "PENDING_APPROVAL"),
        "modern.succession.plan.approve": ("prf_suc_plans", "prf_suc_plan_versions", "APPROVED"),
        "modern.succession.plan.reject": ("prf_suc_plans", "prf_suc_plan_versions", "REJECTED"),
        "modern.succession.plan.publish": ("prf_suc_plans", "prf_suc_plan_versions", "PUBLISHED"),
        "modern.succession.plan.retire": ("prf_suc_plans", "prf_suc_plan_versions", "RETIRED"),
        "modern.succession.readiness.record": ("prf_suc_plans", "prf_suc_plan_versions", "LOCKED_PRE_STATE"),
    }
    """
    spec = specs.get(operation_id)
    if not spec:
        return
    root_table, version_table, post_state = spec
    root_steps = [
        row for row in operation.get("orderedDml", [])
        if row.get("table") == root_table
    ]
    if not root_steps:
        root_step = {
            "action": "UPDATE_CAS", "table": root_table,
            "role": "CONCURRENCY_ROOT",
            "selector": "tenant+public_id path identity+If-Match+allowed pre-state",
            "assignments": {
                "tenant_id": "authenticatedPrincipal.tenantId",
                "aggregate_version": "LOCKED_PRE:aggregate_version+1",
                "status": "derived.transition_post_state",
                "updated_at": "ownerClock.transactionNow",
            },
            "expectedRows": "EXACTLY_ONE",
            "failureInjectionAssertion": "version append, receipt and outbox roll back",
        }
        insertion = next((
            index for index, row in enumerate(operation.get("orderedDml", []))
            if row.get("role") != "COMMAND_RECEIPT"
        ), len(operation.get("orderedDml", [])))
        operation["orderedDml"].insert(insertion, root_step)
    else:
        root_step = root_steps[0]
        root_step["action"] = "UPDATE_CAS"
        root_step["role"] = "CONCURRENCY_ROOT"
        root_step.setdefault("assignments", {})["status"] = (
            "LOCKED_PRE:" + root_table + ".status"
            if post_state == "LOCKED_PRE_STATE" else "derived.transition_post_state"
        )
        root_step["selector"] = "tenant+public_id path identity+If-Match+allowed pre-state"
        root_step["expectedRows"] = "EXACTLY_ONE"

    version_step = _domain_step(operation, version_table)
    if version_step is None:
        version_step = _append_fact_step(
            operation, version_table, {}, action="APPEND",
            role="IMMUTABLE_LIFECYCLE_VERSION",
        )
    approval_source = (
        "ownerProof.body.approvalReceiptId" if operation_id.endswith("publish")
        else "LOCKED_GLOBAL_TIP_SEGMENT_CONTENT_ROW:" + version_table
    )
    common = {
        "tenant_id": "authenticatedPrincipal.tenantId",
        "public_id": "SERVER_ALLOCATE:UUID_V7_REPLAY_STABLE",
        "aggregate_version": "CONSTANT:1",
        ("status" if version_table in {
            "ppl_bnf_plan_versions", "ppl_jny_template_versions"
        } else "state"): (
            "LOCKED_PRE:" + root_table + ".status"
            if post_state == "LOCKED_PRE_STATE" else
            post_state if post_state.startswith("body.") else "CONSTANT:" + post_state
        ),
        "created_by": "authenticatedPrincipal.publicId",
        "correlation_id": "headers.X-Correlation-ID",
        "updated_at": "ownerClock.transactionNow",
        "revision_mode": "CONSTANT:LIFECYCLE",
        "root_version": "LOCKED_PRE:" + root_table + ".aggregate_version+1",
        "root_predecessor_public_id": "LOCKED_GLOBAL_TIP:" + version_table + ".public_id",
        "root_predecessor_version": "LOCKED_PRE:" + root_table + ".aggregate_version",
        "effective_segment_public_id": "LOCKED_GLOBAL_TIP_SEGMENT_TIP:" + version_table + ".effective_segment_public_id",
        "segment_revision": "LOCKED_GLOBAL_TIP_SEGMENT_TIP:" + version_table + ".segment_revision+1",
        "segment_predecessor_public_id": "LOCKED_GLOBAL_TIP_SEGMENT_TIP:" + version_table + ".public_id",
        "segment_predecessor_revision": "LOCKED_GLOBAL_TIP_SEGMENT_TIP:" + version_table + ".segment_revision",
        "correction_reason_code": "CONSTANT:LIFECYCLE_" + post_state,
        "changed_fields": "SERVER_DERIVE:typed lifecycle state change only",
        "content_revision_public_id": (
            "LOCKED_GLOBAL_TIP_SEGMENT_TIP:" + version_table + ".content_revision_public_id"
        ),
    }
    if version_table == "ppl_bnf_plan_versions":
        copies = {
            name: "LOCKED_GLOBAL_TIP_SEGMENT_CONTENT_ROW:" + version_table + "." + name
            for name in (
                "eligibility_policy_version_id", "effective_from", "effective_to",
                "content_digest", "enrollment_window_policy_version_id",
                "valid_from", "valid_to", "coverage_options",
                "coverage_configuration_digest", "delivery_mode",
                "provider_config_version_id", "payroll_treatment_code",
                "payroll_treatment_code_set_version_id",
                "display_name_snapshot", "plan_code_snapshot",
            )
        }
        copies.update({
            "benefit_plan_id": "LOCKED_PRE:ppl_bnf_plans.benefit_plan_id",
            "version_no": "LOCKED_PRE:ppl_bnf_plans.aggregate_version+1",
            "effective_to": "CONSTANT:NULL",
            "effective_from": "LOCKED_GLOBAL_TIP_SEGMENT_TIP:" + version_table + ".effective_from",
        })
    elif version_table == "ppl_jny_template_versions":
        copies = {
            name: "LOCKED_GLOBAL_TIP_SEGMENT_CONTENT_ROW:" + version_table + "." + name
            for name in (
                "effective_from", "effective_to", "task_manifest_digest", "task_count",
                "task_definitions", "content_digest", "config_scope_public_id",
                "task_schema_version",
                "display_name_snapshot", "template_code_snapshot",
            )
        }
        copies.update({
            "journey_template_id": "LOCKED_PRE:ppl_jny_templates.journey_template_id",
            "version_no": "LOCKED_PRE:ppl_jny_templates.aggregate_version+1",
            "effective_to": "CONSTANT:NULL",
            "effective_from": "LOCKED_GLOBAL_TIP_SEGMENT_TIP:" + version_table + ".effective_from",
        })
    else:
        parent_column, revision_column, content_columns = {
            "ppl_rec_requisition_versions": (
                "requisition_public_id", "fact_revision",
                ("employment_type_code_set_version_id", "requisition_code", "title",
                 "organization_public_id", "position_public_id", "employment_type",
                 "target_start_date"),
            ),
            "ppl_cwk_engagement_versions": (
                "engagement_public_id", "version_no",
                ("classification_policy_version_id", "access_package_public_id",
                 "worker_public_id", "vendor_public_id", "sponsor_worker_public_id",
                 "classification_code"),
            ),
            "prf_lrn_offering_versions": (
                "offering_public_id", "version_no",
                ("content_artifact_public_id", "content_artifact_revision",
                 "content_artifact_schema_version", "delivery_mode", "session_schema",
                 "capacity", "eligibility_policy_version_id", "skill_mappings",
                 "display_name", "provider_public_id"),
            ),
            "prf_mkt_opportunity_versions": (
                "opportunity_public_id", "version_no",
                ("criteria_artifact_public_id", "criteria_artifact_revision",
                 "criteria_schema_version", "capacity", "skill_mappings",
                 "display_name", "owner_org_public_id", "open_from", "close_at"),
            ),
            "prf_suc_plan_versions": (
                "plan_public_id", "version_no",
                ("audience_policy_public_id", "audience_policy_revision",
                 "key_position_public_id", "content_artifact_public_id",
                 "content_artifact_revision", "content_digest", "display_name"),
            ),
        }[version_table]
        copies = {
            name: "LOCKED_GLOBAL_TIP_SEGMENT_CONTENT_ROW:" + version_table + "." + name
            for name in content_columns
        }
        copies.update({
            parent_column: "LOCKED_PRE:" + root_table + ".public_id",
            revision_column: "LOCKED_PRE:" + root_table + ".aggregate_version+1",
            "parent_public_id": "LOCKED_PRE:" + root_table + ".public_id",
            "parent_version": "LOCKED_PRE:" + root_table + ".aggregate_version+1",
            "fact_revision": "LOCKED_PRE:" + root_table + ".aggregate_version+1",
            "ordinal": "LOCKED_PRE:" + root_table + ".aggregate_version+1",
            "payload_digest": "SERVER_DERIVE:canonical lifecycle row+copied content identity",
            "reference_effective_at": "ownerClock.transactionNow",
            "effective_from": "LOCKED_GLOBAL_TIP_SEGMENT_TIP:" + version_table + ".effective_from",
            "effective_to": "CONSTANT:NULL",
        })
        if version_table == "ppl_cwk_engagement_versions":
            copies["contingent_engagement_id"] = (
                "LOCKED_PRE:ppl_cwk_engagements.contingent_engagement_id"
            )
    approval: dict[str, str] = {}
    if operation_id.endswith("publish") and version_table in {
        "ppl_bnf_plan_versions", "ppl_jny_template_versions",
    }:
        approval = {
            "approval_receipt_public_id": approval_source + ".publicId",
            "approval_receipt_revision": approval_source + ".revision",
            "approval_outcome": approval_source + ".outcome",
            "approval_action": approval_source + ".action",
            "approval_input_digest": approval_source + ".inputDigest",
            "approval_purpose_code": approval_source + ".purposeCode",
            "approval_tenant_id": approval_source + ".tenantId=authenticatedPrincipal.tenantId",
        }
    elif version_table in {"ppl_bnf_plan_versions", "ppl_jny_template_versions"}:
        approval = {
            name: approval_source + "." + name
            for name in (
                "approval_receipt_public_id", "approval_receipt_revision",
                "approval_outcome", "approval_action", "approval_input_digest",
                "approval_purpose_code", "approval_tenant_id",
            )
        }
    version_step.update({
        "action": "APPEND", "role": "IMMUTABLE_LIFECYCLE_VERSION",
        "selector": TEMPORAL_LIFECYCLE_VERSION_SELECTOR,
        "assignments": {**common, **copies, **approval},
        "expectedRows": "EXACTLY_ONE",
        "failureInjectionAssertion": "root CAS, version append, receipt and outbox roll back",
        "temporalAppendContract": "DUAL_APPEND_ONLY_ROOT_AND_EFFECTIVE_SEGMENT_CHAINS_NO_PRIOR_ROW_MUTATION",
    })
    # The root is the concurrency aggregate.  The immutable version records the
    # same lifecycle result but is never the UPDATE_CAS target.
    operation["aggregateRoot"] = {
        "table": root_table, "publicIdColumn": "public_id",
        "versionColumn": "aggregate_version", "stateColumn": "status",
        "tenantColumn": "tenant_id", "choice": "PARENT_ROOT_CAS_WITH_IMMUTABLE_VERSION_APPEND",
    }
    if post_state == "LOCKED_PRE_STATE":
        operation["relatedEntityTransition"] = copy.deepcopy(operation["transition"])
        operation["transition"].update({
            "preStates": ["CURRENT_ROOT_STATE"],
            "postStates": ["SAME_CURRENT_ROOT_STATE"],
            "postStateSource": "LOCKED_PRE:" + root_table + ".status",
        })
    operation["transition"]["stateSink"] = root_table + ".status"
    operation["transition"]["physicalPostStateSink"] = root_table + ".status"
    operation["transition"]["appendedRevisionStateSink"] = (
        version_table + "." + TEMPORAL_VERSION_STATE_COLUMN[version_table]
    )
    operation["transition"]["cas"] = "tenant+root public_id+If-Match; exactly one parent UPDATE_CAS"
    operation["temporalWriteContract"] = _temporal_lifecycle_write_contract(
        version_table
    )
    for event in operation.get("events", []):
        event["fields"] = [
            row for row in event.get("fields", [])
            if row.get("name") not in {"versionPublicId", "predecessorRevision"}
        ]
        event["aggregateEntityType"] = "table:" + root_table
        field_by_name = {row["name"]: row for row in event.get("fields", [])}
        replacements = {
            "aggregateId": (root_table + ".public_id", "PHYSICAL_POST_STATE"),
            "aggregateVersion": (root_table + ".aggregate_version", "PHYSICAL_POST_STATE"),
            "fromState": ("LOCKED_PRE:" + root_table + ".status", "LOCKED_PRE_STATE"),
            "toState": (root_table + ".status", "PHYSICAL_POST_STATE"),
        }
        for name, (source, source_kind) in replacements.items():
            if name in field_by_name:
                field_by_name[name].update({"source": source, "sourceKind": source_kind})
        if "aggregateId" in field_by_name:
            field_by_name["aggregateId"]["referenceContract"] = {
                "entityType": "table:" + root_table, "idSpace": "PUBLIC_UUID",
            }
        additions = (
            ("revisionPublicId", "UUID", "public_id", "table:" + version_table),
            ("contentRevisionPublicId", "UUID", "content_revision_public_id", "table:" + version_table),
            ("stateRevisionPublicId", "UUID", "public_id", "table:" + version_table),
            ("rootVersion", "BIGINT", "root_version", None),
            ("effectiveSegmentPublicId", "UUID", "effective_segment_public_id", "DWP.EffectiveTime.Segment"),
            ("segmentRevision", "BIGINT", "segment_revision", None),
            ("revisionMode", "STRING", "revision_mode", None),
            ("effectiveFrom", (
                "TIMESTAMPTZ" if version_table == "prf_mkt_opportunity_versions" else "DATE"
            ), "effective_from", None),
            ("segmentPredecessorPublicId", "UUID", "segment_predecessor_public_id", "table:" + version_table),
            ("segmentPredecessorRevision", "BIGINT", "segment_predecessor_revision", None),
        )
        names = set(field_by_name)
        for name, field_type, column_name, entity in additions:
            if name not in names:
                new_field = _event_field(
                    name, field_type, "PHYSICAL_POST_STATE",
                    version_table + "." + column_name, entity=entity,
                )
                if name == "segmentPredecessorPublicId":
                    new_field["required"] = False
                event.setdefault("fields", []).append(new_field)
        event["audience"]["fieldExposure"]["fields"] = [
            row["name"] for row in event["fields"]
        ]


def _apply_p1_effective_contract(operation: dict[str, Any]) -> None:
    table = P1_REVISION_TABLES.get(operation["operationId"])
    if not table:
        return
    step = _domain_step(operation, table)
    if step is None:
        return
    revision_mode_field = next((
        row for row in operation.get("requestFields", [])
        if row.get("source") == "body.revisionMode"
    ), None)
    if revision_mode_field is None:
        raise ValueError(f"{operation['operationId']} lacks required revisionMode")
    revision_mode_field["validation"] = (
        "closed enum CORRECTION|SUPERSEDE; LIFECYCLE is server-only in explicit publish/retire operations"
    )
    revision_mode_field["allowedValues"] = ["CORRECTION", "SUPERSEDE"]
    _remove_request_field(operation, {
        "correctionTargetVersionId", "correctionTargetVersion", "effectiveTo",
    })
    effective_from_field = next((
        row for row in operation.get("requestFields", [])
        if row.get("source") == "body.effectiveFrom"
    ), None)
    if effective_from_field is None:
        effective_from_field = _field("effectiveFrom", "body", "DATE", required=False)
        operation.setdefault("requestFields", []).append(effective_from_field)
    effective_from_field["required"] = False
    effective_from_field["validation"] = (
        "REQUIRED_IFF_revisionMode=SUPERSEDE;FORBIDDEN_FOR_CORRECTION;"
        "must create a new business-effective segment"
    )
    if not any(
        field.get("source") == "body.segmentPredecessorVersionId"
        for field in operation.get("requestFields", [])
    ):
        field = _field(
            "segmentPredecessorVersionId", "body", "UUID", required=False,
            entity="table:" + table,
        )
        field["validation"] = (
            "REQUIRED_IFF_revisionMode=CORRECTION;FORBIDDEN_FOR_SUPERSEDE;"
            "exact current tip public identity within the target effective segment"
        )
        operation.setdefault("requestFields", []).append(field)
    if not any(
        field.get("source") == "body.segmentPredecessorRevision"
        for field in operation.get("requestFields", [])
    ):
        field = _field(
            "segmentPredecessorRevision", "body", "BIGINT", required=False,
        )
        field["validation"] = (
            "REQUIRED_IFF_revisionMode=CORRECTION;FORBIDDEN_FOR_SUPERSEDE;"
            "positive exact current segment revision"
        )
        operation.setdefault("requestFields", []).append(field)
    operation.setdefault("inputEffects", []).append({
        "source": "body.segmentPredecessorVersionId",
        "type": "UUID", "required": False, "sensitivity": "RESTRICTED",
        "requestDigestMember": True,
        "effects": [{
            "kind": "EFFECTIVE_SEGMENT_EXACT_PREDECESSOR",
            "target": table + ".public_id",
            "condition": {"source": "body.revisionMode", "equals": "CORRECTION"},
            "requires": "body.segmentPredecessorRevision exact and same tenant+parent+segment",
            "failure": "422_NONLATEST_OR_CROSS_SEGMENT_PREDECESSOR_ZERO_MUTATION",
        }],
    })
    operation["inputEffects"] = [
        row for row in operation.get("inputEffects", [])
        if row.get("source") not in {"body.effectiveTo", "body.effectiveFrom"}
    ]
    operation.setdefault("inputEffects", []).append({
        "source": "body.effectiveFrom", "type": effective_from_field["type"],
        "required": False, "sensitivity": "INTERNAL", "requestDigestMember": True,
        "effects": [{
            "kind": "NEW_EFFECTIVE_SEGMENT_START",
            "target": table + ".effective_from",
            "condition": {"source": "body.revisionMode", "equals": "SUPERSEDE"},
            "failure": "422_MISSING_OR_CORRECTION_SUPPLIED_EFFECTIVE_FROM_ZERO_MUTATION",
        }],
    })
    operation.setdefault("inputEffects", []).append({
        "source": "body.segmentPredecessorRevision",
        "type": "BIGINT", "required": False, "sensitivity": "INTERNAL",
        "requestDigestMember": True,
        "effects": [{
            "kind": "SEGMENT_REVISION_COMPARE",
            "target": table + ".segment_revision",
            "condition": {"source": "body.revisionMode", "equals": "CORRECTION"},
            "failure": "409_SEGMENT_TIP_CHANGED_ZERO_MUTATION",
        }],
    })
    control_fields = _temporal_revise_control_fields(table)
    operation["requestFields"] = [
        row for row in operation.get("requestFields", [])
        if row.get("source") not in set(control_fields) | {"body.effectiveTo"}
    ]
    operation["requestFields"].extend(copy.deepcopy(list(control_fields.values())))
    control_effects = _temporal_revise_control_effects(table)
    control_sources = {row["source"] for row in control_effects}
    operation["inputEffects"] = [
        row for row in operation.get("inputEffects", [])
        if row.get("source") not in control_sources | {"body.effectiveTo"}
    ]
    operation["inputEffects"].extend(copy.deepcopy(control_effects))
    operation["selectors"] = [
        row for row in operation.get("selectors", [])
        if row.get("source") != "body.segmentPredecessorVersionId"
    ]
    operation["selectors"].append(
        _temporal_revise_predecessor_selector(operation, table)
    )
    step["action"] = "APPEND"
    step["role"] = "IMMUTABLE_EFFECTIVE_DATED_REVISION"
    step["selector"] = TEMPORAL_REVISE_VERSION_SELECTOR
    step["assignments"].update({
        "public_id": "SERVER_ALLOCATE:REVISION_UUID_V7_REPLAY_STABLE",
        "revision_mode": "body.revisionMode",
        "effective_from": (
            "SEGMENT_PREDECESSOR.effective_from IF body.revisionMode=CORRECTION "
            "ELSE body.effectiveFrom"
        ),
        "effective_to": "CONSTANT:NULL",
        "correction_reason_code": "body.reasonCode",
        "effective_segment_public_id": (
            "SEGMENT_PREDECESSOR.effective_segment_public_id "
            "IF body.revisionMode=CORRECTION "
            "ELSE SERVER_REUSE:REVISION_UUID_V7_REPLAY_STABLE"
        ),
        "content_revision_public_id": "SERVER_REUSE:REVISION_UUID_V7_REPLAY_STABLE",
        "segment_revision": (
            "body.segmentPredecessorRevision+1 "
            "IF body.revisionMode=CORRECTION ELSE CONSTANT:1"
        ),
        "segment_predecessor_public_id": (
            "body.segmentPredecessorVersionId "
            "IF body.revisionMode=CORRECTION ELSE CONSTANT:NULL"
        ),
        "segment_predecessor_revision": (
            "body.segmentPredecessorRevision "
            "IF body.revisionMode=CORRECTION ELSE CONSTANT:0"
        ),
    })
    if table == "ppl_bnf_plan_versions":
        step["assignments"]["valid_from"] = (
            "SEGMENT_PREDECESSOR.valid_from IF body.revisionMode=CORRECTION "
            "ELSE body.effectiveFrom"
        )
    for stale in (
        "predecessor_public_id", "predecessor_revision",
        "correction_target_public_id", "correction_target_version",
    ):
        step["assignments"].pop(stale, None)
    root_table = {
        "ppl_bnf_plan_versions": "ppl_bnf_plans",
        "ppl_jny_template_versions": "ppl_jny_templates",
        "ppl_rec_requisition_versions": "ppl_rec_requisitions",
        "ppl_cwk_engagement_versions": "ppl_cwk_engagements",
        "prf_lrn_offering_versions": "prf_lrn_offerings",
        "prf_mkt_opportunity_versions": "prf_mkt_opportunities",
        "prf_suc_plan_versions": "prf_suc_plans",
    }[table]
    snapshot_columns = {
        "ppl_bnf_plan_versions": {
            "display_name_snapshot": "display_name", "plan_code_snapshot": "plan_code",
        },
        "ppl_jny_template_versions": {
            "display_name_snapshot": "display_name", "template_code_snapshot": "template_code",
        },
        "ppl_rec_requisition_versions": {
            "requisition_code": "requisition_code", "title": "title",
            "organization_public_id": "organization_public_id",
            "position_public_id": "position_public_id", "employment_type": "employment_type",
            "target_start_date": "target_start_date",
        },
        "ppl_cwk_engagement_versions": {
            "worker_public_id": "worker_public_id", "vendor_public_id": "vendor_public_id",
            "sponsor_worker_public_id": "sponsor_worker_public_id",
            "classification_code": "classification_code",
        },
        "prf_lrn_offering_versions": {
            "display_name": "display_name", "provider_public_id": "provider_public_id",
        },
        "prf_mkt_opportunity_versions": {
            "display_name": "display_name", "owner_org_public_id": "owner_org_public_id",
            "open_from": "open_from", "close_at": "close_at",
        },
        "prf_suc_plan_versions": {"display_name": "display_name"},
    }[table]
    step["assignments"].update({
        target: "LOCKED_POST:" + root_table + "." + source
        for target, source in snapshot_columns.items()
    })
    operation["aggregateRoot"].update({
        "table": root_table,
        "publicIdColumn": "public_id",
        "versionColumn": "aggregate_version",
        "stateColumn": "status",
        "tenantColumn": "tenant_id",
    })
    operation["transition"]["cas"] = (
        "tenant+stable root public_id+If-Match; root aggregate_version and appended "
        "root_version equal locked pre-root aggregate_version+1; CORRECTION advances the "
        "locked segment revision, SUPERSEDE creates segment revision 1"
    )
    root_steps = [
        row for row in operation.get("orderedDml", [])
        if row.get("table") == root_table and row.get("action") == "UPDATE_CAS"
    ]
    if len(root_steps) != 1:
        raise ValueError(
            f"{operation['operationId']} requires exactly one stable-root UPDATE_CAS before append"
        )
    root_steps[0].setdefault("assignments", {})["status"] = "derived.transition_post_state"
    root_steps[0]["role"] = "CONCURRENCY_ROOT"
    root_steps[0]["selector"] = (
        "tenant+stable root public identity+If-Match expected root version+allowed pre-state"
    )
    root_steps[0]["expectedRows"] = "EXACTLY_ONE"
    step["assignments"].update({
        "root_version": "LOCKED_PRE:" + root_table + ".aggregate_version+1",
        "root_predecessor_public_id": "LOCKED_GLOBAL_TIP:" + table + ".public_id",
        "root_predecessor_version": "LOCKED_PRE:" + root_table + ".aggregate_version",
    })
    operation["transition"]["stateSink"] = root_table + ".status"
    operation["transition"]["appendedRevisionStateSink"] = (
        table + "." + TEMPORAL_VERSION_STATE_COLUMN[table]
    )
    operation["temporalWriteContract"] = _temporal_revise_write_contract(table)
    for event in operation.get("events", []):
        event["fields"] = [
            row for row in event.get("fields", [])
            if row.get("name") not in {"versionPublicId", "predecessorRevision"}
        ]
        event["aggregateEntityType"] = "table:" + root_table
        field_by_name = {row["name"]: row for row in event.get("fields", [])}
        for name, source, source_kind in (
            ("aggregateId", root_table + ".public_id", "PHYSICAL_POST_STATE"),
            ("aggregateVersion", root_table + ".aggregate_version", "PHYSICAL_POST_STATE"),
            ("fromState", "LOCKED_PRE:" + root_table + ".status", "LOCKED_PRE_STATE"),
            ("toState", root_table + ".status", "PHYSICAL_POST_STATE"),
        ):
            if name in field_by_name:
                field_by_name[name].update({
                    "source": source, "sourceKind": source_kind,
                })
        if "aggregateId" in field_by_name:
            field_by_name["aggregateId"]["referenceContract"] = {
                "entityType": "table:" + root_table, "idSpace": "PUBLIC_UUID",
            }
        source_prefix = table + "."
        additions = (
            ("revisionMode", "STRING", "revision_mode"),
            ("effectiveFrom", (
                "TIMESTAMPTZ" if table == "prf_mkt_opportunity_versions" else "DATE"
            ), "effective_from"),
            ("revisionPublicId", "UUID", "public_id"),
            ("contentRevisionPublicId", "UUID", "content_revision_public_id"),
            ("stateRevisionPublicId", "UUID", "public_id"),
            ("rootVersion", "BIGINT", "root_version"),
            ("effectiveSegmentPublicId", "UUID", "effective_segment_public_id"),
            ("segmentRevision", "BIGINT", "segment_revision"),
            ("segmentPredecessorPublicId", "UUID", "segment_predecessor_public_id"),
            ("segmentPredecessorRevision", "BIGINT", "segment_predecessor_revision"),
        )
        names = {row.get("name") for row in event.get("fields", [])}
        for name, field_type, column_name in additions:
            if name not in names:
                new_field = _event_field(
                    name, field_type, "PHYSICAL_POST_STATE", source_prefix + column_name,
                    entity=("table:" + table if name in {
                                "revisionPublicId", "contentRevisionPublicId",
                                "stateRevisionPublicId", "segmentPredecessorPublicId",
                            } else
                            "DWP.EffectiveTime.Segment" if name == "effectiveSegmentPublicId" else None),
                )
                if name == "segmentPredecessorPublicId":
                    new_field["required"] = False
                event.setdefault("fields", []).append(new_field)
        event["audience"]["fieldExposure"]["fields"] = [
            row["name"] for row in event["fields"]
        ]


def _normalize_temporal_root_version_alias(operation: dict[str, Any]) -> None:
    """Use one literal root/version sequence contract across all seven families."""
    for version_table, root_table in TEMPORAL_VERSION_ROOT_TABLE.items():
        version_steps = [
            step for step in operation.get("orderedDml", [])
            if step.get("table") == version_table
            and step.get("action") in {"INSERT", "APPEND"}
        ]
        root_steps = [
            step for step in operation.get("orderedDml", [])
            if step.get("table") == root_table
            and step.get("action") in {"INSERT", "UPDATE_CAS"}
        ]
        if not version_steps and not root_steps:
            continue
        if len(version_steps) != 1 or len(root_steps) != 1:
            raise ValueError(
                f"{operation['operationId']} temporal root mutation/version append cardinality drift"
            )
        root_step, version_step = root_steps[0], version_steps[0]
        assignments = root_step.setdefault("assignments", {})
        assignments["tenant_id"] = "authenticatedPrincipal.tenantId"
        if root_step["action"] == "INSERT":
            assignments["public_id"] = "SERVER_ALLOCATE:UUID_V7_REPLAY_STABLE"
            assignments["created_by"] = "authenticatedPrincipal.publicId"
            assignments["correlation_id"] = "headers.X-Correlation-ID"
            assignments["aggregate_version"] = "CONSTANT:1"
            expected_root_version = "CONSTANT:1"
            expected_predecessor = "CONSTANT:0"
            root_step["selector"] = TEMPORAL_ROOT_INSERT_SELECTOR
        else:
            assignments["aggregate_version"] = (
                "LOCKED_PRE:" + root_table + ".aggregate_version+1"
            )
            expected_root_version = (
                "LOCKED_PRE:" + root_table + ".aggregate_version+1"
            )
            expected_predecessor = (
                "LOCKED_PRE:" + root_table + ".aggregate_version"
            )
            root_step["selector"] = TEMPORAL_ROOT_CAS_SELECTOR
        root_step["role"] = "CONCURRENCY_ROOT"
        root_step["expectedRows"] = "EXACTLY_ONE"
        root_step["failureInjectionAssertion"] = (
            "ROOT_MUTATION_AND_VERSION_APPEND_AND_CONTROL_ROWS_ROLL_BACK_TOGETHER"
        )
        version_assignments = version_step.setdefault("assignments", {})
        version_assignments["tenant_id"] = "authenticatedPrincipal.tenantId"
        version_assignments["created_by"] = "authenticatedPrincipal.publicId"
        version_assignments["correlation_id"] = "headers.X-Correlation-ID"
        version_assignments["root_version"] = expected_root_version
        version_assignments["root_predecessor_version"] = expected_predecessor
        post_states = operation.get("transition", {}).get("postStates", [])
        if len(post_states) == 1:
            post_state = post_states[0]
            root_state_column = TEMPORAL_ROOT_STATE_COLUMN[root_table]
            version_state_column = TEMPORAL_VERSION_STATE_COLUMN[version_table]
            assignments[root_state_column] = "CONSTANT:" + post_state
            version_assignments[version_state_column] = "CONSTANT:" + post_state
            operation["transition"].update({
                "postStateSource": "CONSTANT:" + post_state,
                "stateSink": root_table + "." + root_state_column,
                "physicalPostStateSink": root_table + "." + root_state_column,
                "appendedRevisionStateSink": (
                    version_table + "." + version_state_column
                ),
            })
        version_step["expectedRows"] = "EXACTLY_ONE"
        version_step["failureInjectionAssertion"] = (
            "ROOT_MUTATION_AND_VERSION_APPEND_AND_CONTROL_ROWS_ROLL_BACK_TOGETHER"
        )
        version_step["rootMutationBinding"] = {
            "rootTable": root_table,
            "rootAction": root_step["action"],
            "rootSelector": root_step["selector"],
            "rootExpectedRows": "EXACTLY_ONE",
            "versionExpectedRows": "EXACTLY_ONE",
            "sameTransaction": True,
            "sameBranchOrCondition": True,
            "postRootVersionEqualsAppendedRootVersion": True,
            "preRootVersionEqualsAppendedPredecessorVersion": True,
            "atomicity": TEMPORAL_ROOT_VERSION_ATOMICITY,
            "rollback": "ANY_ROOT_OR_VERSION_OR_CONTROL_FAILURE_ROLLS_BACK_ALL",
        }
        event_tuple = {
            "aggregateId": ("UUID", root_table + ".public_id", "table:" + root_table),
            "aggregateVersion": ("BIGINT", root_table + ".aggregate_version", None),
            "revisionPublicId": ("UUID", version_table + ".public_id", "table:" + version_table),
            "rootVersion": ("BIGINT", version_table + ".root_version", None),
            "contentRevisionPublicId": (
                "UUID", version_table + ".content_revision_public_id", "table:" + version_table,
            ),
            "stateRevisionPublicId": (
                "UUID", version_table + ".public_id", "table:" + version_table,
            ),
            "effectiveSegmentPublicId": (
                "UUID", version_table + ".effective_segment_public_id", "DWP.EffectiveTime.Segment",
            ),
            "segmentRevision": ("BIGINT", version_table + ".segment_revision", None),
            "revisionMode": ("STRING", version_table + ".revision_mode", None),
            "effectiveFrom": (
                "TIMESTAMPTZ" if version_table == "prf_mkt_opportunity_versions" else "DATE",
                version_table + ".effective_from", None,
            ),
            "segmentPredecessorPublicId": (
                "UUID", version_table + ".segment_predecessor_public_id", "table:" + version_table,
            ),
            "segmentPredecessorRevision": (
                "BIGINT", version_table + ".segment_predecessor_revision", None,
            ),
        }
        for event in operation.get("events", []):
            event["aggregateEntityType"] = "table:" + root_table
            fields = {field["name"]: field for field in event.get("fields", [])}
            for name, (field_type, source, entity) in event_tuple.items():
                if name in fields:
                    fields[name].update({
                        "type": field_type,
                        "sourceKind": "PHYSICAL_POST_STATE",
                        "source": source,
                    })
                    if entity:
                        fields[name]["referenceContract"] = {
                            "entityType": entity, "idSpace": "PUBLIC_UUID",
                        }
                else:
                    new_field = _event_field(
                        name, field_type, "PHYSICAL_POST_STATE", source, entity=entity,
                    )
                    if name == "segmentPredecessorPublicId":
                        new_field["required"] = False
                    event.setdefault("fields", []).append(new_field)
            event["audience"]["fieldExposure"]["fields"] = [
                field["name"] for field in event["fields"]
            ]
            event["refetchContract"] = _temporal_event_refetch_contract(
                version_table=version_table,
                root_table=root_table,
                owner_session=operation["session"],
                purpose=operation["authorizationCapability"],
                event=event,
            )


CONFIG_VERSION_BY_CODE = {
    ("ppl_bnf_plan_versions", "payroll_treatment_code"): "payroll_treatment_code_set_version_id",
    ("ppl_hrs_cases", "case_type"): "case_type_code_set_version_id",
    ("ppl_hrs_cases", "queue_key"): "queue_code_set_version_id",
    ("ppl_rec_requisitions", "employment_type"): "employment_type_code_set_version_id",
    ("prf_suc_nominations", "readiness_code"): "readiness_vocabulary_version_id",
    ("prf_cmp_proposals", "component_code"): "component_code_set_version_id",
    ("prf_cmp_approved_snapshot_lines", "component_code"): "component_code_set_version_id",
    ("tme_wfm_demand_lines", "demand_unit_code"): "demand_unit_code_set_version_id",
}


def _apply_configuration_version_contract(operation: dict[str, Any]) -> None:
    if operation["operationId"] == "modern.compplan.snapshot.publish":
        step = _domain_step(operation, "prf_cmp_approved_snapshot_lines")
        if step:
            step.setdefault("assignments", {})["component_code_set_version_id"] = (
                "LOCKED:prf_cmp_proposal_versions.component_code_set_version_id"
            )
    for step in operation.get("orderedDml", []):
        table = step.get("table")
        assignments = step.get("assignments", {})
        for (owner_table, code_column), version_column in CONFIG_VERSION_BY_CODE.items():
            if table != owner_table or code_column not in assignments:
                continue
            if version_column not in assignments:
                continue
            source = str(assignments[version_column])
            operation.setdefault("inputEffects", []).append({
                "source": source, "type": "UUID", "required": True,
                "sensitivity": "RESTRICTED", "requestDigestMember": True,
                "effects": [{
                    "kind": "CONFIG_VERSION_SELECTOR",
                    "target": owner_table + "." + version_column,
                    "owner": "DWP.Configuration",
                    "selector": "tenant+country+codeSet+publicId+revision+activeAt(referenceEffectiveAt)",
                    "failure": "422_STALE_UNKNOWN_OR_INACTIVE_CONFIG_VERSION_ZERO_MUTATION",
                }],
            })
            event_name = re.sub(r"_([a-z])", lambda match: match.group(1).upper(), version_column)
            for event in operation.get("events", []):
                if not any(row.get("source") == owner_table + "." + code_column
                           for row in event.get("fields", [])):
                    continue
                if not any(row.get("source") == owner_table + "." + version_column
                           for row in event.get("fields", [])):
                    event.setdefault("fields", []).append(_event_field(
                        event_name, "UUID", "PHYSICAL_POST_STATE",
                        owner_table + "." + version_column,
                        entity="DWP.Configuration.CodeSetVersion",
                    ))
                event["audience"]["fieldExposure"]["fields"] = [
                    row["name"] for row in event["fields"]
                ]
    for event in operation.get("events", []):
        event_sources = {row.get("source") for row in event.get("fields", [])}
        for (owner_table, code_column), version_column in CONFIG_VERSION_BY_CODE.items():
            if owner_table + "." + code_column not in event_sources:
                continue
            if owner_table + "." + version_column in event_sources:
                continue
            name = re.sub(r"_([a-z])", lambda match: match.group(1).upper(), version_column)
            event.setdefault("fields", []).append(_event_field(
                name, "UUID", "PHYSICAL_POST_STATE", owner_table + "." + version_column,
                entity="DWP.Configuration.CodeSetVersion",
            ))
            event["audience"]["fieldExposure"]["fields"] = [
                row["name"] for row in event["fields"]
            ]


MONEY_FACTS = {
    "ppl_rec_offers": "amount",
    "prf_cmp_budget_ledger": "amount",
    "prf_cmp_proposals": "amount",
    "prf_cmp_approved_snapshot_lines": "approved_amount",
}


def _apply_money_contract(operation: dict[str, Any]) -> None:
    operation_id = operation["operationId"]
    if operation["operationId"] == "modern.compplan.snapshot.publish":
        step = _domain_step(operation, "prf_cmp_approved_snapshot_lines")
        if step:
            step.setdefault("assignments", {}).update({
                "frequency_code": "LOCKED:prf_cmp_proposal_versions.frequency_code",
                "basis_code": "LOCKED:prf_cmp_proposal_versions.basis_code",
                "fx_snapshot_public_id": "LOCKED:prf_cmp_proposal_versions.fx_snapshot_public_id",
            })
    for step in operation.get("orderedDml", []):
        table = step.get("table")
        amount_column = MONEY_FACTS.get(table)
        assignments = step.get("assignments", {})
        if not amount_column or amount_column not in assignments:
            continue
        step["moneyContract"] = {
            "kind": "ORIGINAL_MONEY_FACT",
            "tuple": [amount_column, "currency_code", "frequency_code", "basis_code", "fx_snapshot_public_id"],
            "fxRule": "FX_SNAPSHOT_REQUIRED_IFF_SETTLEMENT_CURRENCY_DIFFERS_FROM_ORIGINAL_CURRENCY",
            "fakeDefaultForbidden": True,
        }
        for event in operation.get("events", []):
            if not any(row.get("source") == table + "." + amount_column
                       for row in event.get("fields", [])):
                continue
            existing_sources = {row.get("source") for row in event.get("fields", [])}
            for name, field_type, column_name, entity in (
                ("currencyCode", "STRING", "currency_code", None),
                ("frequencyCode", "STRING", "frequency_code", None),
                ("basisCode", "STRING", "basis_code", None),
                ("fxSnapshotPublicId", "UUID", "fx_snapshot_public_id", "DWP.Finance.FxSnapshot"),
            ):
                if table + "." + column_name not in existing_sources:
                    event.setdefault("fields", []).append(_event_field(
                        name, field_type, "PHYSICAL_POST_STATE",
                        table + "." + column_name, entity=entity,
                    ))
            event["audience"]["fieldExposure"]["fields"] = [
                row["name"] for row in event["fields"]
            ]

    if operation_id == "modern.contingent.sponsor.reassign":
        current = _domain_step(operation, "ppl_cwk_sponsor_assignments")
        if current is not None:
            current.update({"action": "UPDATE_CAS", "role": "CLOSE_CURRENT_SPONSOR_INTERVAL",
                            "selector": "tenant+engagement+current open interval+assignment revision"})
            current["assignments"] = {
                "valid_to": "body.effectiveAt", "updated_at": "ownerClock.transactionNow",
                "updated_by": "authenticatedPrincipal.publicId",
            }
        _append_fact_step(operation, "ppl_cwk_sponsor_assignments", {
            "tenant_id": "authenticatedPrincipal.tenantId",
            "contingent_engagement_id": "LOCKED_PRE:ppl_cwk_engagements.record_id",
            "sponsor_worker_public_id": "body.sponsorWorkerPublicId",
            "valid_from": "body.effectiveAt", "valid_to": "CONSTANT:NULL",
            "assignment_revision": "LOCKED_PRE:current assignment_revision+1",
        }, action="INSERT", role="NEW_SPONSOR_ASSIGNMENT")

    if operation_id == "modern.recruiting.candidate.admit":
        root = _domain_step(operation, "ppl_rec_candidate_cases")
        if root:
            root["assignments"].update({
                "requisition_id": "SELECTED:ppl_rec_requisitions.record_id FROM pathParameters.requisitionId",
                "recorded_at": "ownerClock.transactionNow",
            })
        history = _domain_step(operation, "ppl_rec_candidate_stage_history")
        if history:
            history["assignments"].update({
                "parent_public_id": "LOCKED_POST:ppl_rec_candidate_cases.public_id",
                "parent_version": "LOCKED_POST:ppl_rec_candidate_cases.aggregate_version",
                "fact_revision": "CONSTANT:1", "state": "CONSTANT:APPLIED", "ordinal": "CONSTANT:1",
                "payload_digest": "SERVER_DERIVE:canonical initial APPLIED history",
                "reference_effective_at": "ownerClock.transactionNow",
            })

    if operation_id == "modern.onboarding.task.waive":
        proof = _domain_step(operation, "ppl_jny_task_evidence")
        if proof:
            proof["assignments"].update({
                "journey_assignment_id": "SELECTED:ppl_jny_assignments.record_id FROM pathParameters.assignmentId",
                "journey_assignment_task_id": "SELECTED:ppl_jny_assignment_tasks.record_id FROM pathParameters.taskId",
                "task_key": "LOCKED_PRE:ppl_jny_assignment_tasks.task_key",
                "completion_revision": "LOCKED_PRE:ppl_jny_assignment_tasks.aggregate_version+1",
                "payload_digest": "SERVER_DERIVE:canonical waiver evidence",
            })

    if operation_id == "modern.succession.readiness.record":
        proof = _domain_step(operation, "prf_suc_readiness_evidence")
        if proof:
            proof["assignments"].update({
                "succession_nomination_id": "SELECTED:prf_suc_nominations.record_id FROM body.nominationId",
                "payload_digest": "SERVER_DERIVE:evidence id+revision+digest+recordedAt",
            })

    if operation_id == "modern.skills.evidence.record":
        step = _domain_step(operation, "prf_skl_worker_evidence")
        if step:
            step["assignments"].update({
                "payload_digest": "SERVER_DERIVE:canonical pending evidence",
                "provenance_type": "CONSTANT:OWNER_VERIFIED_REFERENCE",
            })

    if operation_id == "modern.skills.taxonomy.revise":
        parent = _domain_step(operation, "prf_skl_taxonomy_versions")
        parent_id = "LOCKED_POST:prf_skl_taxonomy_versions.public_id"
        parent_version = "LOCKED_POST:prf_skl_taxonomy_versions.aggregate_version"
        for table, source, typed in (
            ("prf_skl_skill_nodes", "body.nodes[*]", "node"),
            ("prf_skl_skill_edges", "body.edges[*]", "edge"),
            ("prf_skl_proficiency_levels", "body.proficiencyLevels[*]", "level"),
        ):
            step = _domain_step(operation, table)
            if step:
                step["action"] = "APPEND_MANY"
                step["assignments"].update({
                    "parent_public_id": parent_id, "parent_version": parent_version,
                    "fact_revision": parent_version, "state": "CONSTANT:ACTIVE",
                    "ordinal": f"SERVER_DERIVE:{source} stable ordinal",
                    "payload_digest": f"SERVER_DERIVE:canonical {typed} row",
                    "reference_effective_at": "body.effectiveFrom",
                })
        if parent:
            parent["action"] = "APPEND"
            parent["assignments"].update({
                "skill_taxonomy_id": "SELECTED:prf_skl_taxonomies.record_id FROM pathParameters.taxonomyId",
                "version_no": "LOCKED_PRE:prf_skl_taxonomies.aggregate_version+1",
                "payload_digest": "SERVER_DERIVE:canonical taxonomy version+typed graph",
            })
        node = _domain_step(operation, "prf_skl_skill_nodes")
        if node:
            node["assignments"].update({
                "skill_code": "body.nodes[*].code", "label": "body.nodes[*].label",
                "locale_code": "body.nodes[*].locale",
            })
        edge = _domain_step(operation, "prf_skl_skill_edges")
        if edge:
            edge["assignments"].update({
                "source_skill_public_id": "body.edges[*].sourceSkillPublicId",
                "target_skill_public_id": "body.edges[*].targetSkillPublicId",
                "edge_type_code": "body.edges[*].type",
            })
        level = _domain_step(operation, "prf_skl_proficiency_levels")
        if level:
            level["assignments"].update({
                "level_code": "body.proficiencyLevels[*].code",
                "label": "body.proficiencyLevels[*].label",
                "rank_order": "body.proficiencyLevels[*].rank",
            })

    if operation_id in {"modern.workforceplan.scenario.revise", "modern.workforceplan.scenario.cancel"}:
        step = _domain_step(operation, "ppl_wfp_scenario_revisions")
        if step:
            step["assignments"].update({
                "workforce_scenario_id": "LOCKED_PRE:ppl_wfp_scenarios.record_id",
                "revision_no": "LOCKED_PRE:ppl_wfp_scenarios.aggregate_version+1",
                "recorded_at": "ownerClock.transactionNow",
                "result_digest": "SERVER_DERIVE:canonical revision result",
                "payload_digest": step["assignments"].get("payload_digest", "SERVER_DERIVE:canonical revision input"),
            })

    if operation_id in {"modern.ai.assist.review", "modern.ai.assist.revoke"}:
        # Result provenance is appended only by the signed assistance-result
        # handler.  Human review/revocation updates the request and appends its
        # own decision fact; it must not manufacture a second result receipt.
        operation["orderedDml"] = [
            row for row in operation.get("orderedDml", [])
            if row.get("table") != "sys_hris_ai_provenance_receipts"
        ]
        review_step = _domain_step(operation, "sys_hris_ai_assistance_reviews")
        root_step = _domain_step(operation, "sys_hris_ai_assistance_requests")
        if operation_id.endswith("revoke") and review_step and root_step:
            operation["orderedDml"].remove(review_step)
            operation["orderedDml"].insert(operation["orderedDml"].index(root_step), review_step)
        for event in operation.get("events", []):
            names = {field["name"] for field in event.get("fields", [])}
            for field in (
                _event_field("reviewId", "UUID", "PHYSICAL_POST_STATE", "sys_hris_ai_assistance_reviews.public_id", entity="table:sys_hris_ai_assistance_reviews"),
                _event_field("reviewRevision", "BIGINT", "PHYSICAL_POST_STATE", "sys_hris_ai_assistance_reviews.review_revision"),
                _event_field("decision", "STRING", "PHYSICAL_POST_STATE", "sys_hris_ai_assistance_reviews.decision"),
                _event_field("reasonCode", "STRING", "PHYSICAL_POST_STATE", "sys_hris_ai_assistance_reviews.reason_code"),
            ):
                if field["name"] not in names:
                    field["sensitivity"] = "HIGHLY_RESTRICTED" if field["name"] == "reasonCode" else "RESTRICTED"
                    event.setdefault("fields", []).append(field)
            if operation_id.endswith("revoke"):
                event["fields"].extend([
                    _event_field("priorReviewId", "UUID", "PHYSICAL_POST_STATE", "sys_hris_ai_assistance_reviews.prior_review_public_id", entity="table:sys_hris_ai_assistance_reviews"),
                    _event_field("priorReviewRevision", "BIGINT", "PHYSICAL_POST_STATE", "sys_hris_ai_assistance_reviews.prior_review_revision"),
                ])
            event["audience"]["fieldExposure"]["fields"] = sorted(
                field["name"] for field in event["fields"]
            )
            event["refetchContract"]["allowedFields"] = [
                field["name"] for field in event["fields"]
            ]
            if event["refetchContract"].get("pep"):
                event["refetchContract"]["pep"]["fieldExposure"] = [
                    field["name"] for field in event["fields"]
                ]

    if operation_id in {"modern.listening.survey.create", "modern.listening.survey.revise"}:
        for field_name in ("tokenPolicyVersionRef", "consentPolicyVersionId"):
            source = "body." + field_name
            if not any(row.get("source") == source for row in operation.get("requestFields", [])):
                field = _field(field_name, "body", "UUID", entity=(
                    "DWP.Listening.TokenPolicyVersion" if field_name.startswith("token")
                    else "DWP.Consent.PolicyVersion"
                ))
                operation["requestFields"].append(field)
                operation.setdefault("inputEffects", []).append({
                    "source": source, "type": "UUID", "required": True,
                    "sensitivity": "RESTRICTED", "requestDigestMember": True,
                    "effects": [{"kind": "OWNER_VERSION_SELECTOR",
                                 "target": field["referenceContract"]["entityType"]}],
                })
        version = _domain_step(operation, "sys_hris_listening_survey_versions")
        if version is None:
            version = _append_fact_step(
                operation, "sys_hris_listening_survey_versions", {},
                action="APPEND", role="IMMUTABLE_SURVEY_FORM_VERSION",
            )
        version.update({
            "action": "APPEND", "role": "IMMUTABLE_SURVEY_FORM_VERSION",
            "selector": "tenant+locked survey+next owner revision; exact form/privacy/retention owner versions",
            "expectedRows": "EXACTLY_ONE_NEW_VERSION",
        })
        version.setdefault("assignments", {}).update({
            "tenant_id": "authenticatedPrincipal.tenantId",
            "public_id": "SERVER_ALLOCATE:UUID_V7_REPLAY_STABLE",
            "listening_survey_id": "LOCKED_POST:sys_hris_listening_surveys.listening_survey_id",
            "state": "CONSTANT:DRAFT",
            "owner_revision": (
                "CONSTANT:1" if operation_id.endswith("survey.create")
                else "LOCKED_PRE:sys_hris_listening_surveys.aggregate_version+1"
            ),
            "predecessor_version_public_id": (
                "CONSTANT:NULL" if operation_id.endswith("survey.create")
                else "LOCKED_PRE:sys_hris_listening_survey_versions.public_id"
            ),
            "predecessor_owner_revision": (
                "CONSTANT:0" if operation_id.endswith("survey.create")
                else "LOCKED_PRE:sys_hris_listening_surveys.aggregate_version"
            ),
            "payload_digest": "SERVER_DERIVE:canonical typed survey form version",
            "reference_effective_at": "ownerClock.transactionNow",
            "form_version_public_id": "body.formVersionRef",
            "form_artifact_schema_version": "OWNER_REFETCH:body.formVersionRef.schemaVersion",
            "form_artifact_digest": "OWNER_REFETCH:body.formVersionRef.contentDigest",
            "privacy_version_public_id": "body.privacyVersionRef",
            "retention_version_public_id": "body.retentionVersionRef",
            "consent_policy_version_public_id": "body.consentPolicyVersionId",
            "token_policy_version_public_id": "body.tokenPolicyVersionRef",
            "content_sha256": "body.contentSha256",
            "question_definitions": (
                "body.questions" if operation_id.endswith("survey.create")
                else "OWNER_REFETCH:body.formVersionRef closed typed questions"
            ),
            "questions_schema_version": "CONSTANT:LISTENING_QUESTION_V1",
        })
        for event in operation.get("events", []):
            event["aggregateEntityType"] = "table:sys_hris_listening_surveys"
            by_name = {field["name"]: field for field in event.get("fields", [])}
            for name, source, kind in (
                ("aggregateId", "sys_hris_listening_surveys.public_id", "PHYSICAL_POST_STATE"),
                ("aggregateVersion", "sys_hris_listening_surveys.aggregate_version", "PHYSICAL_POST_STATE"),
                ("fromState", "LOCKED_PRE:sys_hris_listening_surveys.status", "LOCKED_PRE_STATE"),
                ("toState", "sys_hris_listening_surveys.status", "PHYSICAL_POST_STATE"),
                ("occurredAt", "sys_hris_listening_surveys.updated_at", "PHYSICAL_POST_STATE"),
                ("correlationId", "sys_hris_listening_operation_receipts.correlation_id", "PHYSICAL_POST_STATE"),
            ):
                if name in by_name:
                    by_name[name].update({"source": source, "sourceKind": kind})
            if "aggregateId" in by_name:
                by_name["aggregateId"]["referenceContract"] = {
                    "entityType": "table:sys_hris_listening_surveys", "idSpace": "PUBLIC_UUID",
                }
            existing = set(by_name)
            for name, field_type, source, entity in (
                ("surveyRevisionPublicId", "UUID", "sys_hris_listening_survey_versions.public_id", "table:sys_hris_listening_survey_versions"),
                ("surveyRevision", "BIGINT", "sys_hris_listening_survey_versions.owner_revision", None),
                ("formVersionPublicId", "UUID", "sys_hris_listening_survey_versions.form_version_public_id", "DWP.Listening.FormVersion"),
                ("formArtifactDigest", "SHA256", "sys_hris_listening_survey_versions.form_artifact_digest", None),
            ):
                if name not in existing:
                    event.setdefault("fields", []).append(_event_field(
                        name, field_type, "PHYSICAL_POST_STATE", source, entity=entity,
                    ))
            event["audience"]["fieldExposure"]["fields"] = [
                field["name"] for field in event["fields"]
            ]


def _protected_listening_submit_v4(operation: dict[str, Any]) -> None:
    """Close anonymous submit entirely inside the protected owner.

    The issuer-signed credential is verified offline.  The client retains the
    raw response token; only domain-separated digests/HMACs cross a durable
    boundary.  A latest stable-admission fence serializes submit versus close.
    """
    path_field = next(
        row for row in operation["requestFields"]
        if row.get("source") == "pathParameters.surveyId"
    )
    path_field["referenceContract"] = {
        "entityType": "DWP.Listening.ProtectedAdmissionSurveyBinding",
        "idSpace": "PUBLIC_UUID",
        "resolution": "PROTECTED_LOCAL_SIGNED_ADMISSION_CLAIM_EQUALITY_ONLY",
    }
    proof_schema = {
        "schemaId": "ListeningOfflineNonRevocationProof.v1",
        "additionalProperties": False,
        "fields": [
            {"name": name, "type": field_type, "required": True}
            for name, field_type in (
                ("issuancePublicId", "UUID"), ("issuanceRevision", "BIGINT"),
                ("opaqueJtiCommitment", "SHA256"), ("tokenCommitment", "SHA256"),
                ("status", "STRING"), ("proofGeneratedAt", "TIMESTAMPTZ"),
                ("proofExpiresAt", "TIMESTAMPTZ"), ("kid", "STRING"),
                ("alg", "STRING"), ("ownerSignature", "STRING"),
            )
        ],
        "fieldRules": {
            "status": "ACTIVE_ONLY", "alg": "APPROVED_ASYMMETRIC_ALLOWLIST",
            "proofExpiresAt": "AFTER_CAPTURED_NOW_WITH_BOUNDED_MAX_TTL",
        },
    }
    credential_schema = {
        "schemaId": "ListeningSignedParticipationCredential.v1",
        "additionalProperties": False,
        "fields": [
            {"name": name, "type": field_type, "required": True}
            for name, field_type in (
                ("tenantPublicId", "UUID"), ("surveyPublicId", "UUID"),
                ("surveyRevision", "BIGINT"), ("admissionPublicId", "UUID"),
                ("admissionVersionPublicId", "UUID"), ("admissionOwnerVersion", "BIGINT"),
                ("formVersionPublicId", "UUID"), ("formArtifactDigest", "SHA256"),
                ("eligibilityVersionPublicId", "UUID"), ("eligibilityRevision", "BIGINT"),
                ("consentPolicyVersionPublicId", "UUID"),
                ("consentEvidenceCommitment", "SHA256"),
                ("opaqueJti", "UUID"), ("tokenCommitment", "SHA256"),
                ("aud", "STRING"), ("iat", "TIMESTAMPTZ"), ("nbf", "TIMESTAMPTZ"),
                ("exp", "TIMESTAMPTZ"), ("kid", "STRING"), ("alg", "STRING"),
                ("signature", "STRING"),
            )
        ] + [{
            "name": "nonRevocationProof", "type": "OBJECT", "required": True,
            "valueSchema": proof_schema,
        }],
        "forbiddenClaims": ["workerId", "personId", "principalId", "employeeId"],
    }
    answer_schema = {
        "schemaId": "ListeningAnswer.v1", "additionalProperties": False,
        "discriminator": "answerType", "arrayBounds": {"minItems": 1, "maxItems": 500},
        "uniqueBy": "questionKey", "membership": "EXACT_LOCKED_FORM_QUESTION_SET",
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
    }
    credential = _field(
        "signedParticipationCredential", "body", "OBJECT",
        entity="DWP.Listening.SignedParticipationCredential",
    )
    credential.update({"sensitivity": "HIGHLY_RESTRICTED",
                       "tokenization": "SIGNED_CLOSED_CREDENTIAL",
                       "valueSchema": credential_schema})
    token = _field("responseToken", "body", "STRING")
    token.update({
        "sensitivity": "HIGHLY_RESTRICTED", "tokenization": "NEVER_PERSIST_OR_LOG_RAW",
        "validation": (
            "BASE64URL_DECODED_ENTROPY_AT_LEAST_256_BITS;DOMAIN_SEPARATED_SHA256_EQUALS_"
            "SIGNED_TOKEN_COMMITMENT"
        ),
    })
    answers = _field("answers", "body", "ARRAY")
    answers.update({"sensitivity": "HIGHLY_RESTRICTED", "tokenization": "OWNER_LOCAL_ENCRYPTION",
                    "valueSchema": answer_schema})
    operation["requestFields"] = [path_field, credential, token, answers]
    operation["inputEffects"] = [
        {"source": "pathParameters.surveyId", "type": "UUID", "required": True,
         "sensitivity": "RESTRICTED", "requestDigestMember": True,
         "effects": [{"kind": "SIGNED_CLAIM_EQUALITY_ONLY",
                      "target": "LOCKED_ADMISSION.survey_public_id"}]},
        {"source": "body.signedParticipationCredential", "type": "OBJECT", "required": True,
         "sensitivity": "HIGHLY_RESTRICTED", "requestDigestMember": True,
         "effects": [{"kind": "OFFLINE_SIGNED_CREDENTIAL_AND_NONREVOCATION_PROOF",
                      "target": "LOCKED_ADMISSION exact tenant+survey+admission+version+form+consent",
                      "failure": "INVALID_EXPIRED_REVOKED_OR_MISMATCHED_ZERO_WRITES"}]},
        {"source": "body.responseToken", "type": "STRING", "required": True,
         "sensitivity": "HIGHLY_RESTRICTED", "requestDigestMember": False,
         "effects": [{"kind": "CLIENT_SECRET_COMMITMENT_PROOF",
                      "target": "sys_hris_listening_token_consumptions.token_commitment",
                      "transform": "DOMAIN_SHA256_THEN_OWNER_HMAC;RAW_NEVER_DURABLE"}]},
        {"source": "body.answers", "type": "ARRAY", "required": True,
         "sensitivity": "HIGHLY_RESTRICTED", "requestDigestMember": True,
         "effects": [{"kind": "TYPED_OWNER_ENCRYPTED_CHILD_COLLECTION",
                      "target": "sys_hris_listening_answer_values",
                      "validation": "EXACT_LOCKED_FORM_KEY_TYPE_CARDINALITY_CHOICES"}]},
    ]
    operation["selectors"] = [{
        "selectorType": "PROTECTED_LOCAL_LATEST_STABLE_ADMISSION_FENCE",
        "entityType": "table:sys_hris_listening_admission_versions", "idSpace": "PUBLIC_UUID",
        "source": "body.signedParticipationCredential.admissionPublicId", "sourceType": "UUID",
        "targetTable": "sys_hris_listening_admission_versions", "targetColumn": "admission_public_id",
        "targetSqlType": "UUID", "operator": "EQUALS",
        "cardinality": "EXACTLY_ONE_LATEST_OWNER_REVISION",
        "tenantFilter": "target.tenant_id=verified signed credential tenant",
        "purposeFilter": "LISTENING_RESPONSE_SUBMIT_ANONYMOUS",
        "referenceEffectiveAt": "ownerClock.transactionNow",
        "versionRule": (
            "target.owner_revision=credential.admissionOwnerVersion AND "
            "target.public_id=credential.admissionVersionPublicId"
        ),
        "asOfRule": "target.state=ACTIVE AND opens_at<=capturedNow<closes_at",
        "causalJoin": (
            "path survey=credential survey=target survey; form+consent exact; "
            "offline ACTIVE proof unexpired; latest stable admission tip"
        ),
        "failure": "401_OR_404_OPAQUE_OR_409_STALE_ZERO_MUTATION",
    }, {
        "selectorType": "SIGNED_CREDENTIAL_PROTECTED_RESOURCE_AUDIENCE",
        "entityType": "DWP.Listening.ProtectedResourceAudience",
        "idSpace": "CLOSED_RESOURCE_AUDIENCE",
        "source": "body.signedParticipationCredential.aud", "sourceType": "STRING",
        "targetTable": "OWNER_PORT::DWP.Listening.ProtectedResourceAudienceVerifier",
        "targetColumn": "resource_audience", "targetSqlType": "VARCHAR(240)",
        "operator": "EQUALS_CONSTANT",
        "cardinality": "EXACTLY_ONE_VALID_RESOURCE_AUDIENCE",
        "tenantFilter": "same verified credential tenant as locked admission",
        "purposeFilter": "LISTENING_RESPONSE_SUBMIT_ANONYMOUS",
        "referenceEffectiveAt": "ownerClock.transactionNow",
        "versionRule": "aud=DWP.HRIS.LISTENING.PROTECTED and issuer key active for iat/kid",
        "asOfRule": "nbf<=ownerClock.transactionNow<exp; offline ACTIVE proof unexpired",
        "causalJoin": "resource audience independent from configuration signed-offer endpoint audience",
        "failure": "401_403_ZERO_MUTATION",
    }]
    operation["orderedDml"] = [
        {"step": 1, "phase": "IN_TRANSACTION", "action": "CLAIM_OR_REPLAY",
         "table": "sys_hris_listening_protected_receipts", "role": "PROTECTED_TOKEN_RECEIPT_CLAIM",
         "selector": "tenant+stable admission+OWNER_HMAC(responseToken); stored request digest exact",
         "assignments": {
             "tenant_id": "SIGNED_CREDENTIAL.tenantPublicId resolved owner-locally",
             "public_id": "SERVER_ALLOCATE:UUID_V7_REPLAY_STABLE", "aggregate_version": "CONSTANT:1",
             "created_by": "PROTECTED_PSEUDONYMOUS_ACTOR_ID",
             "correlation_id": "SERVER_ALLOCATE:UNLINKABLE_PROTECTED_TRACE",
             "listening_response_id": "CONSTANT:NULL", "receipt_kind": "CONSTANT:SUBMISSION_CLAIM",
             "admission_public_id": "SIGNED_CREDENTIAL.admissionPublicId",
             "token_commitment": "OWNER_HMAC:DOMAIN_SHA256(body.responseToken)",
             "idempotency_key": "OWNER_HMAC:body.responseToken", "state": "CONSTANT:RUNNING",
             "owner_revision": "CONSTANT:1",
             "payload_digest": "OWNER_HMAC:responseToken over canonical request; raw token excluded",
             "request_digest": "OWNER_HMAC:responseToken over canonical request; raw token excluded",
             "reference_effective_at": "ownerClock.transactionNow",
         }, "expectedRows": "ONE_NEW_OR_SEALED_SAME_DIGEST_REPLAY", "failureInjectionAssertion": "ZERO_WRITES"},
        {"step": 2, "phase": "IN_TRANSACTION", "action": "LOCK_FOR_UPDATE",
         "table": "sys_hris_listening_admission_versions", "role": "LATEST_STABLE_ADMISSION_FENCE",
         "selector": "latest stable admission tip+exact signed version+ACTIVE+window+form+consent",
         "assignments": {}, "expectedRows": "EXACTLY_ONE", "failureInjectionAssertion": "CLAIM_ROLLS_BACK"},
        {"step": 3, "phase": "IN_TRANSACTION", "action": "CLAIM_OR_REPLAY",
         "table": "sys_hris_listening_token_consumptions", "role": "ONE_TIME_TOKEN_CONSUMPTION",
         "selector": "tenant+admission tip+OWNER_HMAC(responseToken)",
         "assignments": {
             "tenant_id": "LOCKED_ADMISSION.tenant_id", "public_id": "SERVER_ALLOCATE:UNLINKABLE_UUID_V7",
             "aggregate_version": "CONSTANT:1", "created_by": "PROTECTED_PSEUDONYMOUS_ACTOR_ID",
             "correlation_id": "PROTECTED_RECEIPT.correlation_id",
             "listening_admission_version_id": "LOCKED_ADMISSION.record_id",
             "credential_jti_commitment": "OWNER_HMAC:SIGNED_CREDENTIAL.opaqueJti",
             "credential_digest": "SERVER_DERIVE:canonical signed credential",
             "non_revocation_proof_digest": "SERVER_DERIVE:canonical offline proof",
             "request_digest": "PROTECTED_RECEIPT.request_digest", "response_public_id": "CONSTANT:NULL",
             "receipt_public_id": "PROTECTED_RECEIPT.public_id", "erasure_ticket_public_id": "CONSTANT:NULL",
             "tombstone_digest": "CONSTANT:NULL", "erased_at": "CONSTANT:NULL",
             "token_commitment": "OWNER_HMAC:DOMAIN_SHA256(body.responseToken)",
             "consumed_at": "ownerClock.transactionNow", "state": "CONSTANT:CONSUMED",
             "owner_revision": "CONSTANT:1", "payload_digest": "PROTECTED_RECEIPT.request_digest",
             "reference_effective_at": "ownerClock.transactionNow",
         }, "expectedRows": "EXACTLY_ONE_NEW_OR_SEALED_SAME_DIGEST_REPLAY",
         "failureInjectionAssertion": "ALL_PROTECTED_WRITES_ROLL_BACK"},
        {"step": 4, "phase": "IN_TRANSACTION", "action": "INSERT",
         "table": "sys_hris_listening_responses", "role": "ANONYMOUS_RESPONSE_WITH_PER_RESPONSE_DEK",
         "assignments": {
             "tenant_id": "LOCKED_ADMISSION.tenant_id", "public_id": "SERVER_ALLOCATE:UNLINKABLE_UUID_V7",
             "aggregate_version": "CONSTANT:1", "created_by": "PROTECTED_PSEUDONYMOUS_ACTOR_ID",
             "correlation_id": "PROTECTED_RECEIPT.correlation_id",
             "survey_public_id": "LOCKED_ADMISSION.survey_public_id", "survey_revision": "LOCKED_ADMISSION.survey_revision",
             "listening_admission_version_id": "LOCKED_ADMISSION.record_id",
             "response_digest": "OWNER_KEYED_DIGEST_WITH_PER_RESPONSE_DEK:canonical typed answers",
             "response_token_hash": "OWNER_HMAC:DOMAIN_SHA256(body.responseToken)",
             "submitted_at": "ownerClock.transactionNow", "status": "CONSTANT:SUBMITTED",
             "owner_revision": "CONSTANT:1", "payload_digest": "OWNER_KEYED_DIGEST_WITH_PER_RESPONSE_DEK:minimized metadata",
             "reference_effective_at": "ownerClock.transactionNow", "erase_after": "LOCKED_ADMISSION.erase_after",
             "respondent_public_id": "CONSTANT:NULL",
             "response_key_public_id": "OWNER_KEY_MANAGER:ALLOCATE_PER_RESPONSE_DEK_ID",
             "response_key_version": "CONSTANT:1", "form_version_public_id": "LOCKED_ADMISSION.form_version_public_id",
             "form_artifact_digest": "LOCKED_ADMISSION.form_artifact_digest",
             "consent_policy_version_public_id": "LOCKED_ADMISSION.consent_policy_version_public_id",
             "consent_evidence_digest": "SIGNED_CREDENTIAL.consentEvidenceCommitment",
         }, "expectedRows": "EXACTLY_ONE", "failureInjectionAssertion": "ALL_PROTECTED_WRITES_ROLL_BACK"},
        {"step": 5, "phase": "IN_TRANSACTION", "action": "APPEND_MANY",
         "table": "sys_hris_listening_answer_values", "role": "ENCRYPTED_TYPED_ANSWER_VALUES",
         "assignments": {
             "tenant_id": "LOCKED_ADMISSION.tenant_id", "public_id": "SERVER_ALLOCATE:UNLINKABLE_UUID_V7",
             "aggregate_version": "CONSTANT:1", "created_by": "PROTECTED_PSEUDONYMOUS_ACTOR_ID",
             "correlation_id": "PROTECTED_RECEIPT.correlation_id",
             "listening_response_id": "PREVIOUS:sys_hris_listening_responses.record_id",
             "question_key": "body.answers[*].questionKey", "answer_type": "body.answers[*].answerType",
             "encrypted_answer": "SERVER_ENCRYPT_WITH_RESPONSE_DEK:body.answers[*].typedValue",
             "response_key_public_id": "PREVIOUS:sys_hris_listening_responses.response_key_public_id",
             "response_key_version": "PREVIOUS:sys_hris_listening_responses.response_key_version",
             "state": "CONSTANT:ACTIVE", "owner_revision": "LOCKED_ADMISSION.form_revision",
             "payload_digest": "OWNER_KEYED_DIGEST_WITH_PER_RESPONSE_DEK:encrypted typed answer",
             "reference_effective_at": "ownerClock.transactionNow",
         }, "expectedRows": "EXACT_BODY_ANSWER_CARDINALITY", "failureInjectionAssertion": "ROLLBACK_ALL"},
        {"step": 6, "phase": "IN_TRANSACTION", "action": "UPDATE_CAS",
         "table": "sys_hris_listening_token_consumptions", "role": "TOKEN_CONSUMPTION_BIND_RESPONSE",
         "selector": "exact new token claim+CONSUMED+response_public_id IS NULL",
         "assignments": {"response_public_id": "PREVIOUS:sys_hris_listening_responses.public_id",
                         "owner_revision": "LOCKED_PRE:owner_revision+1"},
         "expectedRows": "EXACTLY_ONE_NEW_CLAIM_ZERO_ON_SEALED_REPLAY", "failureInjectionAssertion": "ROLLBACK_ALL"},
        {"step": 7, "phase": "IN_TRANSACTION", "action": "UPDATE_CAS",
         "table": "sys_hris_listening_protected_receipts", "role": "PROTECTED_TOKEN_RECEIPT_CLOSE",
         "selector": "exact claimed receipt RUNNING+stored request digest",
         "assignments": {
             "listening_response_id": "PREVIOUS:sys_hris_listening_responses.record_id",
             "response_public_id": "PREVIOUS:sys_hris_listening_responses.public_id",
             "state": "CONSTANT:COMPLETED", "owner_revision": "LOCKED_PRE:owner_revision+1",
             "result_digest": "SERVER_DERIVE:canonical private submission result",
             "completed_at": "ownerClock.transactionNow", "updated_at": "ownerClock.transactionNow",
         }, "expectedRows": "EXACTLY_ONE_NEW_CLAIM_ZERO_ON_REPLAY", "failureInjectionAssertion": "ROLLBACK_ALL"},
    ]
    operation["anonymousBoundary"] = {
        "principalContextForbidden": True, "issuerCallbackFromProtectedEndpoint": "FORBIDDEN",
        "crossStreamCorrelationForbidden": True,
        "tenantSource": "verified signed credential mapped owner-locally",
        "idempotencyKey": "tenant+stable admission+OWNER_HMAC(responseToken)",
        "retention": "locked protected retention version",
        "telemetry": {
            "allowed": ["owner-local unlinkable correlation", "coarse outcome", "bounded latency"],
            "forbidden": ["principal", "session", "ip", "user-agent", "raw token", "opaqueJti",
                          "token commitment", "answers", "issuer correlation", "message id"],
            "redactionTestRequired": True,
        },
    }
    operation["transactionEnvelope"] = {
        "boundary": "ONE_PROTECTED_LISTENING_OWNER_TRANSACTION",
        "stepOrder": "RECEIPT_CLAIM_ADMISSION_TIP_LOCK_TOKEN_CLAIM_RESPONSE_KEY_ROW_ANSWERS_BIND_CLOSE",
        "replay": {"sameTokenSameDigest": "RETURN_SEALED_ZERO_WRITES",
                   "sameTokenDifferentDigest": "409_ZERO_MUTATION",
                   "afterErasure": "RETURN_NONLINKABLE_TOMBSTONE_ONLY_ZERO_WRITES"},
        "rollback": "ANY_STEP_FAILURE_ROLLS_BACK_ALL_SEVEN_STEPS",
        "privateDelivery": "OWNER_LOCAL_RESPONSE_ONLY_BROKER_AND_PUBLIC_OUTBOX_FORBIDDEN",
    }


def _protected_listening_submit(operation: dict[str, Any]) -> None:
    if operation["operationId"] != "modern.listening.response.submit":
        return
    _protected_listening_submit_v4(operation)
    return
    _remove_request_field(operation, {"submissionDigest", "eraseAfter"})
    for name, field_type, entity in (
        ("participationEnvelope", "OBJECT", "DWP.Listening.SignedParticipationEnvelope"),
        ("anonymousEnvelope", "OBJECT", "table:sys_hris_listening_admission_versions"),
        ("responseToken", "STRING", None),
        ("admissionVersion", "BIGINT", None),
        ("formRevision", "BIGINT", None),
        ("answers", "ARRAY", None),
    ):
        if not any(row.get("source") == "body." + name for row in operation.get("requestFields", [])):
            field = _field(name, "body", field_type, entity=entity)
            operation["requestFields"].append(field)
            operation["inputEffects"].append({
                "source": field["source"], "type": field_type, "required": True,
                "sensitivity": "HIGHLY_RESTRICTED", "requestDigestMember": True,
                "effects": [{
                    "kind": "PROTECTED_ADMISSION_OR_CONTENT_INPUT",
                    "target": "sys_hris_listening_responses." + (
                        "listening_admission_version_id" if name == "anonymousEnvelope"
                        else "protected_submission"
                    ),
                }],
            })
    operation["requestFields"] = [
        row for row in operation["requestFields"]
        if row.get("location") != "headers"
    ]
    operation["inputEffects"] = [
        row for row in operation["inputEffects"]
        if not str(row.get("source", "")).startswith("headers.")
    ]
    operation["anonymousBoundary"] = {
        "authenticatedPrincipalForbidden": True,
        "crossStreamCorrelationForbidden": True,
        "tenantSource": "signed anonymousEnvelope.tenantId",
        "idempotencyKey": "tenant+survey+HMAC(responseToken)",
        "retention": "eraseAfter derived from locked retention policy version",
    }
    operation["orderedDml"] = [
        {
            "step": 1, "phase": "IN_TRANSACTION", "action": "INSERT",
            "table": "sys_hris_listening_protected_receipts", "role": "PROTECTED_TOKEN_RECEIPT_CLAIM",
            "selector": "tenant+survey+HMAC(responseToken); same digest replay, different digest conflict",
            "assignments": {
                "tenant_id": "anonymousEnvelope.tenantId", "public_id": "SERVER_ALLOCATE:UUID_V7_REPLAY_STABLE",
                "aggregate_version": "CONSTANT:1", "created_by": "PROTECTED_PSEUDONYMOUS_ACTOR_ID",
                "correlation_id": "SERVER_ALLOCATE:UNLINKABLE_PROTECTED_TRACE",
                "listening_response_id": "SERVER_RESERVE:replay-stable response internal id",
                "idempotency_key": "SERVER_HMAC:body.responseToken",
                "state": "CONSTANT:RUNNING", "owner_revision": "CONSTANT:1",
                "payload_digest": "SERVER_DERIVE:canonical protected request excluding raw token",
                "reference_effective_at": "ownerClock.transactionNow",
            }, "expectedRows": "ONE_NEW_OR_ONE_IDENTICAL_SEALED_REPLAY",
            "failureInjectionAssertion": "zero protected/domain/outbox rows survive",
        },
        {
            "step": 2, "phase": "IN_TRANSACTION", "action": "LOCK_FOR_UPDATE",
            "table": "sys_hris_listening_admission_versions", "role": "PROTECTED_ADMISSION_FENCE",
            "selector": "signed envelope admission id+revision+survey+tenant; ACTIVE; opensAt<=now<closesAt; consent exact",
            "assignments": {}, "expectedRows": "EXACTLY_ONE", "failureInjectionAssertion": "claim rolls back",
        },
        {
            "step": 3, "phase": "IN_TRANSACTION", "action": "INSERT",
            "table": "sys_hris_listening_responses", "role": "ANONYMOUS_RESPONSE",
            "assignments": {
                "tenant_id": "anonymousEnvelope.tenantId", "public_id": "SERVER_ALLOCATE:UNLINKABLE_UUID_V7",
                "aggregate_version": "CONSTANT:1", "created_by": "PROTECTED_PSEUDONYMOUS_ACTOR_ID",
                "correlation_id": "PROTECTED_RECEIPT.uninkable_trace",
                "survey_public_id": "LOCKED_ADMISSION.survey_public_id",
                "survey_revision": "LOCKED_ADMISSION.survey_revision",
                "listening_admission_version_id": "LOCKED_ADMISSION.record_id",
                "response_digest": "SERVER_DERIVE:canonical typed answers",
                "response_token_hash": "SERVER_HMAC:body.responseToken",
                "submitted_at": "ownerClock.transactionNow", "status": "CONSTANT:SUBMITTED",
                "owner_revision": "CONSTANT:1", "payload_digest": "SERVER_DERIVE:minimized response metadata",
                "reference_effective_at": "ownerClock.transactionNow",
                "erase_after": "LOCKED_ADMISSION.erase_after",
                "respondent_public_id": "CONSTANT:NULL",
            }, "expectedRows": "EXACTLY_ONE", "failureInjectionAssertion": "claim rolls back",
        },
        {
            "step": 4, "phase": "IN_TRANSACTION", "action": "APPEND_MANY",
            "table": "sys_hris_listening_answer_values", "role": "ENCRYPTED_TYPED_ANSWER_VALUES",
            "assignments": {
                "tenant_id": "anonymousEnvelope.tenantId", "public_id": "SERVER_ALLOCATE:UNLINKABLE_UUID_V7",
                "aggregate_version": "CONSTANT:1", "created_by": "PROTECTED_PSEUDONYMOUS_ACTOR_ID",
                "correlation_id": "PROTECTED_RECEIPT.uninkable_trace",
                "listening_response_id": "PREVIOUS:sys_hris_listening_responses.record_id",
                "question_public_id": "body.answers[*].questionPublicId",
                "answer_type": "body.answers[*].type",
                "encrypted_answer": "SERVER_ENCRYPT:body.answers[*].typedValue",
                "cipher_key_version_id": "LOCKED_ADMISSION.cipher_key_version_id",
                "state": "CONSTANT:ACTIVE", "owner_revision": "body.formRevision",
                "payload_digest": "SERVER_DERIVE:encrypted typed answer value",
                "reference_effective_at": "ownerClock.transactionNow",
            }, "expectedRows": "EXACT_BODY_ANSWER_CARDINALITY", "failureInjectionAssertion": "all rows roll back",
        },
        {
            "step": 5, "phase": "IN_TRANSACTION", "action": "INSERT",
            "table": "sys_hris_listening_token_consumptions", "role": "ONE_TIME_TOKEN_CONSUMPTION",
            "assignments": {
                "tenant_id": "anonymousEnvelope.tenantId", "public_id": "SERVER_ALLOCATE:UNLINKABLE_UUID_V7",
                "aggregate_version": "CONSTANT:1", "created_by": "PROTECTED_PSEUDONYMOUS_ACTOR_ID",
                "correlation_id": "PROTECTED_RECEIPT.uninkable_trace",
                "listening_admission_version_id": "LOCKED_ADMISSION.record_id",
                "token_commitment": "SERVER_HMAC:body.responseToken",
                "consumed_at": "ownerClock.transactionNow",
                "state": "CONSTANT:CONSUMED", "owner_revision": "LOCKED_ADMISSION.owner_revision",
                "payload_digest": "SERVER_HMAC:body.responseToken", "reference_effective_at": "ownerClock.transactionNow",
            }, "expectedRows": "EXACTLY_ONE_UNCONSUMED_TOKEN", "failureInjectionAssertion": "all rows roll back",
        },
        {
            "step": 6, "phase": "IN_TRANSACTION", "action": "UPDATE_CAS",
            "table": "sys_hris_listening_protected_receipts", "role": "PROTECTED_TOKEN_RECEIPT_CLOSE",
            "selector": "claimed protected receipt RUNNING", "assignments": {
                "state": "CONSTANT:COMPLETED", "owner_revision": "LOCKED_PRE:owner_revision+1",
                "result_digest": "SERVER_DERIVE:canonical protected submission result",
                "completed_at": "ownerClock.transactionNow",
                "updated_at": "ownerClock.transactionNow",
            }, "expectedRows": "EXACTLY_ONE", "failureInjectionAssertion": "all rows roll back",
        },
        {
            "step": 7, "phase": "IN_TRANSACTION", "action": "APPEND",
            "table": "sys_hris_listening_protected_outbox", "role": "PROTECTED_MINIMIZED_OUTBOX",
            "assignments": {
                "tenant_id": "anonymousEnvelope.tenantId", "public_id": "SERVER_ALLOCATE:UNLINKABLE_UUID_V7",
                "aggregate_version": "CONSTANT:1", "created_by": "PROTECTED_PSEUDONYMOUS_ACTOR_ID",
                "correlation_id": "PROTECTED_RECEIPT.uninkable_trace", "state": "CONSTANT:PENDING",
                "owner_revision": "CONSTANT:1", "payload_digest": "SERVER_DERIVE:minimized cohort-ingress fact",
                "reference_effective_at": "ownerClock.transactionNow",
            }, "expectedRows": "EXACTLY_ONE", "failureInjectionAssertion": "all rows roll back",
        },
    ]
    # Token consumption precedes any response/answer persistence.  The
    # admission row remains locked while the unique token commitment is
    # claimed, so a concurrent replay cannot create protected content.
    by_role = {row["role"]: row for row in operation["orderedDml"]}
    role_order = [
        "PROTECTED_TOKEN_RECEIPT_CLAIM", "PROTECTED_ADMISSION_FENCE",
        "ONE_TIME_TOKEN_CONSUMPTION", "ANONYMOUS_RESPONSE",
        "ENCRYPTED_TYPED_ANSWER_VALUES", "PROTECTED_TOKEN_RECEIPT_CLOSE",
        "PROTECTED_MINIMIZED_OUTBOX",
    ]
    operation["orderedDml"] = [by_role[role] for role in role_order]
    for index, row in enumerate(operation["orderedDml"], 1):
        row["step"] = index
    operation["transactionEnvelope"] = {
        "boundary": "ONE_PROTECTED_LISTENING_OWNER_TRANSACTION",
        "stepOrder": "TOKEN_RECEIPT_CLAIM_ADMISSION_LOCK_TOKEN_CONSUMPTION_RESPONSE_ANSWERS_CLOSE_OUTBOX",
        "replay": {"sameTokenSameDigest": "RETURN_SEALED_ZERO_WRITES",
                   "sameTokenDifferentDigest": "409_ZERO_MUTATION"},
        "rollback": "ANY_STEP_FAILURE_ROLLS_BACK_ALL_SEVEN_STEPS",
    }
    for selector in operation.get("selectors", []):
        if selector.get("source") == "pathParameters.surveyId":
            selector.update({
                "selectorType": "PROTECTED_LOCAL_ADMISSION_PROOF",
                "entityType": "table:sys_hris_listening_admission_versions",
                "targetTable": "sys_hris_listening_admission_versions",
                "targetColumn": "parent_public_id",
                "tenantFilter": "target.tenant_id=anonymousEnvelope.tenantId",
                "purposeFilter": "PROTECTED_ANONYMOUS_LISTENING_SUBMISSION",
                "versionRule": "body.admissionVersion exact signed envelope revision",
                "asOfRule": "LOCKED_ADMISSION.opens_at<=ownerClock.transactionNow<LOCKED_ADMISSION.closes_at",
                "causalJoin": "PATH_SURVEY_EQUALS_SIGNED_ENVELOPE_SURVEY_EQUALS_LOCAL_ADMISSION_PARENT",
                "failure": "404_OPAQUE_OR_409_STALE; ZERO_PROTECTED_MUTATION",
            })
    for field in operation.get("requestFields", []):
        if field.get("source") == "pathParameters.surveyId":
            field["referenceContract"] = {
                "entityType": "DWP.Listening.ProtectedAdmissionSurveyBinding",
                "idSpace": "PUBLIC_UUID",
                "resolution": "PROTECTED_LOCAL_SIGNED_ADMISSION_PARENT_ONLY",
            }
    for effect in operation.get("inputEffects", []):
        if effect.get("source") == "pathParameters.surveyId":
            effect["effects"] = [{
                "kind": "PROTECTED_LOCAL_ADMISSION_PROOF",
                "target": "sys_hris_listening_admission_versions.parent_public_id",
                "cardinality": "EXACTLY_ONE_TENANT_PURPOSE_VERSION_ASOF",
            }]


def _protected_listening_active_query(operation: dict[str, Any]) -> None:
    if operation["operationId"] != "modern.listening.active.query":
        return
    static_contract = next(
        row for row in build_static_design()["ownerPortOperationContracts"]
        if row["ownerPortOperation"] == "protected.listActiveAdmissions"
    )
    static_credential = next(
        row for row in static_contract["requestSchema"]["fields"]
        if row["name"] == "signedParticipationCredential"
    )
    credential = _field(
        "X-Listening-Participation-Credential", "headers", "STRING",
        entity="DWP.Listening.SignedParticipationCredential",
    )
    credential.update({
        "sensitivity": "HIGHLY_RESTRICTED", "tokenization": "SIGNED_COMPACT_JWS_NEVER_LOGGED",
        "valueSchema": copy.deepcopy(static_credential["valueSchema"]),
        "validation": (
            "OFFLINE_ACTIVE_ISSUER_SIGNATURE_AND_SHORT_LIVED_NONREVOCATION_PROOF; "
            "principal/session/IP/user-agent context forbidden"
        ),
    })
    operation["requestFields"] = [credential]
    operation["inputEffects"] = [{
        "source": credential["source"], "type": "STRING", "required": True,
        "sensitivity": "HIGHLY_RESTRICTED", "requestDigestMember": True,
        "effects": [{
            "kind": "ANONYMOUS_CREDENTIAL_ADMISSION_AND_FORM_SELECTOR",
            "target": "sys_hris_listening_admission_versions.admission_public_id",
            "failure": "401_OR_404_OPAQUE_OR_409_STALE_ZERO_WRITES",
        }],
    }]
    operation["selectors"] = [{
        "selectorType": "PROTECTED_LOCAL_LATEST_STABLE_ADMISSION_FENCE",
        "entityType": "table:sys_hris_listening_admission_versions", "idSpace": "PUBLIC_UUID",
        "source": credential["source"] + ".admissionPublicId", "sourceType": "UUID",
        "targetTable": "sys_hris_listening_admission_versions", "targetColumn": "admission_public_id",
        "targetSqlType": "UUID", "operator": "EQUALS",
        "cardinality": "EXACTLY_ONE_LATEST_OWNER_REVISION",
        "tenantFilter": "target.tenant_id=verified signed credential tenant owner-local mapping",
        "purposeFilter": "LISTENING_ACTIVE_FORM_VIEW_ANONYMOUS",
        "referenceEffectiveAt": "ownerClock.capturedNow",
        "versionRule": (
            "latest stable admission tip public_id+owner_revision equals credential; exact survey+form+consent"
        ),
        "asOfRule": "state=ACTIVE AND opens_at<=capturedNow<closes_at",
        "causalJoin": "credential claims=locked admission/form snapshot; offline proof ACTIVE and unexpired",
        "failure": "401_OR_404_OPAQUE_OR_409_STALE_ZERO_WRITES",
    }, {
        "selectorType": "SIGNED_CREDENTIAL_PROTECTED_RESOURCE_AUDIENCE",
        "entityType": "DWP.Listening.ProtectedResourceAudience",
        "idSpace": "CLOSED_RESOURCE_AUDIENCE",
        "source": credential["source"] + ".aud", "sourceType": "STRING",
        "targetTable": "OWNER_PORT::DWP.Listening.ProtectedResourceAudienceVerifier",
        "targetColumn": "resource_audience", "targetSqlType": "VARCHAR(240)",
        "operator": "EQUALS_CONSTANT",
        "cardinality": "EXACTLY_ONE_VALID_RESOURCE_AUDIENCE",
        "tenantFilter": "same verified credential tenant as locked admission",
        "purposeFilter": "LISTENING_ACTIVE_FORM_VIEW_ANONYMOUS",
        "referenceEffectiveAt": "ownerClock.capturedNow",
        "versionRule": "aud=DWP.HRIS.LISTENING.PROTECTED and issuer key active for iat/kid",
        "asOfRule": "nbf<=ownerClock.capturedNow<exp; offline ACTIVE proof unexpired",
        "causalJoin": "resource audience independent from configuration signed-offer endpoint audience",
        "failure": "401_403_ZERO_READ",
    }]
    operation["subjectAuthorization"] = {
        "mode": "ANONYMOUS_SIGNED_CREDENTIAL_HOLDER",
        "principalForbidden": True,
        "predicate": "signed credential exact admission/form claims; no worker/person identifier",
        "delegation": "FORBIDDEN",
    }
    operation["readPlan"] = {
        "tables": ["sys_hris_listening_admission_versions"],
        "physicalSources": ["sys_hris_listening_admission_versions"],
        "tenantPep": "tenant_id=verified signed credential tenant owner-local mapping",
        "purpose": "LISTENING_ACTIVE_FORM_VIEW_ANONYMOUS",
        "population": "signed eligibility snapshot exact; protected owner sees no principal",
        "fieldPolicy": "form snapshot fields only; raw identity and issuer trace forbidden",
        "asOf": "capturedNow; latest stable admission tip must be ACTIVE and in window",
        "freshness": "PROTECTED_OWNER_TRANSACTIONAL",
        "pagination": "NOT_APPLICABLE_SINGLE_SIGNED_ADMISSION",
        "writesForbidden": True, "receiptsForbidden": True, "outboxForbidden": True,
        "projectionTuple": {
            "queryOperation": operation["operationId"],
            "responseSchema": operation["operationId"] + ".Response.v3",
            "entity": "table:sys_hris_listening_admission_versions",
            "physicalSources": ["sys_hris_listening_admission_versions"],
            "tenantPep": "verified signed credential tenant exact",
            "purpose": "LISTENING_ACTIVE_FORM_VIEW_ANONYMOUS",
            "population": "signed eligibility snapshot exact",
            "fieldPolicy": "protected form snapshot allowlist",
            "asOf": "captured owner clock latest stable admission fence",
            "freshness": "OWNER_TRANSACTIONAL", "pagination": "NONE",
            "writesForbidden": True, "receiptsForbidden": True, "outboxForbidden": True,
            "deepLinkWithoutCommandReceipt": True,
            "pep": {"tenant": "signed credential tenant", "purpose": "active-form-view",
                    "population": "signed eligibility snapshot", "fieldPolicy": "form snapshot only",
                    "denyOnUnavailable": True},
        },
    }
    operation["anonymousBoundary"] = {
        "principalContextForbidden": True, "issuerCallbackFromProtectedEndpoint": "FORBIDDEN",
        "telemetry": {"allowed": ["unlinkable owner-local latency", "coarse outcome"],
                      "forbidden": ["principal", "session", "ip", "user-agent", "credential",
                                    "opaqueJti", "token commitment", "issuer correlation"],
                      "redactionTestRequired": True},
    }


def _normalize_reference_contracts(operation: dict[str, Any]) -> None:
    # `assignmentId` is capability-local: learning never borrows the
    # onboarding identity merely because the placeholder spelling matches.
    if operation["operationId"] in {
        "modern.learning.assignment.cancel", "modern.learning.assignment.query",
    }:
        for field in operation.get("requestFields", []):
            if field.get("source") == "pathParameters.assignmentId":
                field["referenceContract"] = {
                    "entityType": "table:prf_lrn_assignments", "idSpace": "PUBLIC_UUID",
                }

    reference_fields = [
        field for field in operation.get("requestFields", [])
        if field.get("referenceContract")
    ]
    operation["selectors"] = _selectors(
        reference_fields,
        operation.get("aggregateRoot", {}).get("table", ""),
        operation["authorizationCapability"],
    )
    effects_by_source = {
        row.get("source"): row for row in operation.get("inputEffects", [])
    }
    for field in reference_fields:
        source = field["source"]
        entity = field["referenceContract"]["entityType"]
        exact_target = entity.removeprefix("table:") + ".public_id"
        row = effects_by_source.get(source)
        if row is None:
            row = {
                "source": source, "type": field["type"], "required": field["required"],
                "sensitivity": field.get("sensitivity", "RESTRICTED"),
                "requestDigestMember": operation["mode"] == "COMMAND",
                "effects": [],
            }
            operation.setdefault("inputEffects", []).append(row)
        row["effects"] = [
            effect for effect in row.get("effects", [])
            if effect.get("kind") not in {"ENTITY_SELECTOR", "OWNER_VERSION_SELECTOR"}
        ]
        row["effects"].insert(0, {
            "kind": "ENTITY_SELECTOR" if entity.startswith("table:") else "OWNER_VERSION_SELECTOR",
            "target": exact_target,
            "cardinality": "EXACTLY_ONE_TENANT_PURPOSE_VERSION_ASOF",
        })


def _repair_listening_owner_boundaries(operation: dict[str, Any]) -> None:
    operation_id = operation["operationId"]
    if not operation_id.startswith("modern.listening."):
        return
    authority = operation.get("listeningAuthority", {})
    stream = authority.get("authoritativeStreamKey")
    if operation_id == "modern.listening.response.submit":
        # `_protected_listening_submit_v4` already materialized the complete
        # protected-local selector and private, broker-forbidden transaction.
        # Generic Listening boundary normalization must not reintroduce the
        # retired anonymousEnvelope/parent_public_id or outbox delivery path.
        return
    if operation_id == "modern.listening.action.create":
        for field in operation.get("requestFields", []):
            if field.get("source") == "body.cohortProjectionId":
                field["referenceContract"] = {
                    "entityType": "DWP.Listening.CohortProjectionVersion",
                    "idSpace": "PUBLIC_UUID",
                    "resolution": "SIGNED_INSIGHTS_OWNER_PORT_TENANT_PURPOSE_VERSION_ASOF",
                }
        for selector in operation.get("selectors", []):
            if selector.get("source") == "body.cohortProjectionId":
                selector.update({
                    "selectorType": "SIGNED_VERSIONED_OWNER_PORT_PROOF",
                    "entityType": "DWP.Listening.CohortProjectionVersion",
                    "targetTable": "OWNER_PORT::DWP.Listening.CohortProjectionVersion",
                    "targetColumn": "publicId", "targetSqlType": "UUID",
                    "tenantFilter": "ownerProof.tenantId=authenticatedPrincipal.tenantId",
                    "purposeFilter": operation["authorizationCapability"],
                    "versionRule": "body.cohortProjectionRevision exact owner proof revision",
                    "asOfRule": "body.cohortProjectionAsOf exact owner proof referenceEffectiveAt",
                    "causalJoin": "SIGNED_OWNER_REFETCH_TENANT_PURPOSE_VERSION_ASOF_AND_LINEAGE_RECEIPT_MATCH",
                    "failure": "404_OPAQUE_OR_409_STALE_OR_503_OWNER_UNAVAILABLE; ZERO_CONFIGURATION_MUTATION",
                })
        for effect in operation.get("inputEffects", []):
            if effect.get("source") == "body.cohortProjectionId":
                effect["effects"] = [{
                    "kind": "OWNER_REFETCH",
                    "target": "OWNER_PORT::DWP.Listening.CohortProjectionVersion.publicId",
                    "selectorType": "SIGNED_VERSIONED_OWNER_PORT_PROOF",
                    "cardinality": "EXACTLY_ONE",
                    "pep": {
                        "tenant": "authenticatedPrincipal.tenantId",
                        "purpose": operation["authorizationCapability"],
                        "fieldExposure": ["publicId", "revision", "referenceEffectiveAt", "lineageReceiptPublicId"],
                        "denyOnUnavailable": True,
                    },
                }]
        action_step = next(
            (step for step in operation.get("orderedDml", [])
             if step.get("table") == "sys_hris_listening_actions"), None
        )
        if action_step:
            action_step["assignments"].update({
                "cohort_projection_public_id": "OWNER_PROOF.cohortProjection.publicId",
                "cohort_projection_revision": "OWNER_PROOF.cohortProjection.revision",
                "cohort_projection_as_of": "OWNER_PROOF.cohortProjection.referenceEffectiveAt",
                "cohort_projection_lineage_receipt_public_id": "OWNER_PROOF.cohortProjection.lineageReceiptPublicId",
            })
    if operation_id == "modern.listening.surveys.query":
        local_tables = [
            table for table in operation.get("readPlan", {}).get("tables", [])
            if table in {"sys_hris_listening_surveys", "sys_hris_listening_survey_versions"}
        ]
        operation.setdefault("readPlan", {})["tables"] = local_tables
        operation["readPlan"].setdefault("projectionTuple", {})["physicalSources"] = list(local_tables)
        operation["readPlan"]["ownerBoundary"] = (
            "CONFIGURATION_LOCAL_SURVEY_AND_FORM_VERSION_ONLY;PROTECTED_ADMISSION_STATE_REFETCH_FORBIDDEN"
        )
    if operation_id == "modern.listening.cohorts.query":
        for field in operation.get("requestFields", []):
            if field.get("source") == "pathParameters.surveyId":
                field["referenceContract"] = {
                    "entityType": "DWP.Listening.SurveyPublicIdentity",
                    "idSpace": "PUBLIC_UUID",
                    "resolution": "INSIGHTS_LOCAL_SIGNED_COHORT_PACKAGE_PROJECTION_ONLY",
                }
        for selector in operation.get("selectors", []):
            if selector.get("source") == "pathParameters.surveyId":
                selector.update({
                    "selectorType": "LOCAL_OPAQUE_OWNER_ID_FILTER",
                    "entityType": "DWP.Listening.SurveyPublicIdentity",
                    "targetTable": "sys_hris_listening_cohort_projections",
                    "targetColumn": "survey_public_id", "targetSqlType": "UUID",
                    "tenantFilter": "target.tenant_id=authenticatedPrincipal.tenantId",
                    "purposeFilter": operation["authorizationCapability"],
                    "versionRule": "projection owner_revision exact or query asOf",
                    "asOfRule": "projection.reference_effective_at<=query.referenceEffectiveAt",
                    "causalJoin": "INSIGHTS_LOCAL_OPAQUE_SURVEY_PUBLIC_ID_FROM_SIGNED_COHORT_PACKAGE",
                    "failure": "404_OPAQUE_OR_EMPTY_AUTHORIZED_RESULT; ZERO_FOREIGN_REPOSITORY_READ",
                })
        for effect in operation.get("inputEffects", []):
            if effect.get("source") == "pathParameters.surveyId":
                effect["effects"] = [{
                    "kind": "LOCAL_OPAQUE_OWNER_ID_FILTER",
                    "target": "sys_hris_listening_cohort_projections.survey_public_id",
                    "cardinality": "ZERO_OR_MORE_AUTHORIZED_PROJECTIONS",
                }]
    if stream == "platform-hris-configuration" and operation.get("mode") == "COMMAND":
        replacements = {
            "sys_hris_command_receipts": "sys_hris_listening_operation_receipts",
            "sys_hris_outbox_events": "sys_hris_listening_domain_outbox",
            "sys_domain_event_outbox": "sys_hris_listening_domain_outbox",
        }
        def replace_owner_tokens(value: Any) -> Any:
            if isinstance(value, str):
                for old, new in replacements.items():
                    value = value.replace(old, new)
                return value
            if isinstance(value, list):
                return [replace_owner_tokens(item) for item in value]
            if isinstance(value, dict):
                return {key: replace_owner_tokens(item) for key, item in value.items()}
            return value
        repaired = replace_owner_tokens(operation)
        operation.clear()
        operation.update(repaired)
        for step in operation.get("orderedDml", []):
            step["table"] = replacements.get(step.get("table"), step.get("table"))
            if step.get("role") == "COMMAND_RECEIPT" and step.get("action") == "CLAIM_OR_REPLAY":
                step.setdefault("assignments", {}).update({
                    "public_id": "SERVER_ALLOCATE:UUID_V7_REPLAY_STABLE",
                    "aggregate_version": "CONSTANT:1",
                    "created_by": "authenticatedPrincipal.publicId",
                    "owner_revision": "CONSTANT:1",
                    "payload_digest": "SERVER_DERIVE:canonical request digest",
                    "reference_effective_at": "ownerClock.transactionNow",
                    "state": "CONSTANT:ACTIVE",
                })
            if step.get("role") == "TRANSACTIONAL_OUTBOX":
                step.setdefault("assignments", {}).update({
                    "public_id": "SERVER_ALLOCATE:UUID_V7",
                    "aggregate_version": "CONSTANT:1",
                    "created_by": "authenticatedPrincipal.publicId",
                    "owner_revision": "CONSTANT:1",
                    "payload_digest": "SERVER_DERIVE:canonical public event payload",
                    "reference_effective_at": "ownerClock.transactionNow",
                    "state": "CONSTANT:PENDING",
                })
        operation.setdefault("transactionEnvelope", {}).update({
            "receiptTable": "sys_hris_listening_operation_receipts",
            "outboxTable": "sys_hris_listening_domain_outbox",
        })
        operation.setdefault("transactionEnvelope", {})["ownerBoundary"] = (
            "CONFIGURATION_LOCAL_RECEIPT_DOMAIN_AND_OUTBOX_ONLY;NO_CROSS_DATABASE_TRANSACTION"
        )
    if operation_id in {
        "modern.listening.survey.publish", "modern.listening.survey.close",
    }:
        publish = operation_id.endswith("publish")
        pending_state = "PUBLISH_PENDING" if publish else "CLOSE_PENDING"
        retry_state = "PUBLISH_RETRYABLE" if publish else "CLOSE_RETRYABLE"
        request_message = (
            "ListeningAdmissionInstallRequested.v1" if publish
            else "ListeningAdmissionCloseRequested.v1"
        )
        receipt_message = (
            "ListeningAdmissionInstallReceipt.v1" if publish
            else "ListeningAdmissionCloseReceipt.v1"
        )
        completion_handler = (
            "internal.listening.configuration.admission-install-receipt.consume" if publish
            else "internal.listening.configuration.admission-close-receipt.consume"
        )
        final_event = (
            "EmployeeListeningSurveyPublished.v3" if publish
            else "EmployeeListeningSurveyClosed.v3"
        )
        root_step = next(
            row for row in operation["orderedDml"]
            if row.get("table") == "sys_hris_listening_surveys"
        )
        root_step["assignments"]["status"] = "CONSTANT:" + pending_state
        root_step["role"] = "CONFIGURATION_SAGA_INTENT_ROOT_CAS"
        version_step = next((
            row for row in operation["orderedDml"]
            if row.get("table") == "sys_hris_listening_survey_versions"
        ), None)
        if version_step is None:
            version_step = _append_fact_step(
                operation, "sys_hris_listening_survey_versions", {},
                action="APPEND", role="IMMUTABLE_SURVEY_SAGA_INTENT_VERSION",
            )
        version_step.update({
            "action": "APPEND", "role": "IMMUTABLE_SURVEY_SAGA_INTENT_VERSION",
            "selector": "tenant+locked survey+exact current survey version; append only",
            "assignments": {
                "tenant_id": "authenticatedPrincipal.tenantId",
                "public_id": "SERVER_ALLOCATE:UUID_V7_REPLAY_STABLE",
                "aggregate_version": "CONSTANT:1",
                "created_by": "authenticatedPrincipal.publicId",
                "correlation_id": "headers.X-Correlation-ID",
                "listening_survey_id": "LOCKED_PRE:sys_hris_listening_surveys.listening_survey_id",
                "state": "CONSTANT:" + pending_state,
                "owner_revision": "LOCKED_PRE:sys_hris_listening_surveys.aggregate_version+1",
                "predecessor_version_public_id": "LOCKED_FORM_VERSION.public_id",
                "predecessor_owner_revision": "LOCKED_PRE:sys_hris_listening_surveys.aggregate_version",
                "payload_digest": "SERVER_DERIVE:canonical saga intent+immutable form snapshot",
                "reference_effective_at": "ownerClock.transactionNow",
                "form_version_public_id": "LOCKED_FORM_VERSION.form_version_public_id",
                "form_artifact_schema_version": "LOCKED_FORM_VERSION.form_artifact_schema_version",
                "form_artifact_digest": "LOCKED_FORM_VERSION.form_artifact_digest",
                "privacy_version_public_id": "LOCKED_FORM_VERSION.privacy_version_public_id",
                "retention_version_public_id": "LOCKED_FORM_VERSION.retention_version_public_id",
                "consent_policy_version_public_id": "LOCKED_FORM_VERSION.consent_policy_version_public_id",
                "token_policy_version_public_id": "LOCKED_FORM_VERSION.token_policy_version_public_id",
                "content_sha256": "LOCKED_FORM_VERSION.content_sha256",
                "question_definitions": "LOCKED_FORM_VERSION.question_definitions",
                "questions_schema_version": "LOCKED_FORM_VERSION.questions_schema_version",
                "approval_receipt_public_id": (
                    "ownerProof.body.approvalReceiptId.publicId" if publish
                    else "LOCKED_FORM_VERSION.approval_receipt_public_id"
                ),
                "approval_receipt_revision": (
                    "ownerProof.body.approvalReceiptId.revision" if publish
                    else "LOCKED_FORM_VERSION.approval_receipt_revision"
                ),
                "approval_outcome": (
                    "ownerProof.body.approvalReceiptId.outcome" if publish
                    else "LOCKED_FORM_VERSION.approval_outcome"
                ),
                "approval_action": (
                    "ownerProof.body.approvalReceiptId.action" if publish
                    else "LOCKED_FORM_VERSION.approval_action"
                ),
                "approval_input_digest": (
                    "ownerProof.body.approvalReceiptId.inputDigest" if publish
                    else "LOCKED_FORM_VERSION.approval_input_digest"
                ),
                "approval_purpose_code": (
                    "ownerProof.body.approvalReceiptId.purposeCode" if publish
                    else "LOCKED_FORM_VERSION.approval_purpose_code"
                ),
                "approval_tenant_id": (
                    "ownerProof.body.approvalReceiptId.tenantId" if publish
                    else "LOCKED_FORM_VERSION.approval_tenant_id"
                ),
                "admission_public_id": (
                    "SERVER_ALLOCATE:UUID_V7_REPLAY_STABLE_FROM_COMMAND"
                    if publish else "LOCKED_FORM_VERSION.admission_public_id"
                ),
                "request_message_id": "SERVER_ALLOCATE:UUID_V7_REPLAY_STABLE",
            },
            "expectedRows": "EXACTLY_ONE_NEW_PENDING_INTENT_VERSION",
        })
        operation["events"] = []
        outbox_step = next(
            row for row in operation["orderedDml"]
            if row.get("table") == "sys_hris_listening_domain_outbox"
            and row.get("role") == "TRANSACTIONAL_OUTBOX"
        )
        outbox_step.update({
            "action": "APPEND", "role": "SIGNED_PROTECTED_OWNER_REQUEST_OUTBOX",
            "assignments": {
                "tenant_id": "authenticatedPrincipal.tenantId",
                "public_id": "SERVER_ALLOCATE:UUID_V7_REPLAY_STABLE",
                "aggregate_version": "CONSTANT:1",
                "created_by": "authenticatedPrincipal.publicId",
                "correlation_id": "sys_hris_listening_operation_receipts.correlation_id",
                "state": "CONSTANT:PENDING", "owner_revision": "CONSTANT:1",
                "payload_digest": "SERVER_DERIVE:canonical signed protected-owner request",
                "reference_effective_at": "ownerClock.transactionNow",
                "message_name": "CONSTANT:" + request_message,
                "message_id": "LOCKED_POST:sys_hris_listening_survey_versions.request_message_id",
                "source_stream_key": "CONSTANT:platform-hris-configuration",
                "payload": (
                    "SERVER_DERIVE:tenantPublicId+surveyPublicId+surveyRevision+admissionPublicId+"
                    "exact form artifact schema/digest/questionDefinitions+privacy/retention/consent/"
                    "token policy versions+window+eraseAfter+idempotency; no cipher key"
                ),
            },
            "expectedRows": "EXACTLY_ONE_SIGNED_OWNER_REQUEST",
        })
        if publish:
            outbox_step["payloadFieldSources"] = {
                "tenantPublicId": "authenticatedPrincipal.tenantPublicId",
                "surveyPublicId": "LOCKED_PRE:sys_hris_listening_surveys.public_id",
                "surveyRevision": "LOCKED_POST:sys_hris_listening_survey_versions.owner_revision",
                "admissionPublicId": "LOCKED_POST:sys_hris_listening_survey_versions.admission_public_id",
                "formVersionPublicId": "LOCKED_FORM_VERSION.form_version_public_id",
                "formRevision": "LOCKED_FORM_VERSION.owner_revision",
                "formArtifactSchemaVersion": "LOCKED_FORM_VERSION.form_artifact_schema_version",
                "formArtifactDigest": "LOCKED_FORM_VERSION.form_artifact_digest",
                "questionDefinitions": "LOCKED_FORM_VERSION.question_definitions",
                "privacyVersionPublicId": "LOCKED_FORM_VERSION.privacy_version_public_id",
                "privacyRevision": "OWNER_REFETCH:privacyVersionPublicId.ownerRevision",
                "retentionVersionPublicId": "LOCKED_FORM_VERSION.retention_version_public_id",
                "retentionRevision": "OWNER_REFETCH:retentionVersionPublicId.ownerRevision",
                "tokenPolicyVersionPublicId": "LOCKED_FORM_VERSION.token_policy_version_public_id",
                "consentPolicyVersionPublicId": "LOCKED_FORM_VERSION.consent_policy_version_public_id",
                "anonymityThreshold": "OWNER_REFETCH:privacyVersionPublicId.anonymityThreshold",
                "epsilonMicros": "OWNER_REFETCH:privacyVersionPublicId.epsilonMicros",
                "privacyBudgetCapEpsilonMicros": "OWNER_REFETCH:privacyVersionPublicId.budgetCapEpsilonMicros",
                "measureSchemaVersion": "OWNER_REFETCH:privacyVersionPublicId.measureSchemaVersion",
                "measureDefinitionDigest": "OWNER_REFETCH:privacyVersionPublicId.measureDefinitionDigest",
                "contentSha256": "LOCKED_FORM_VERSION.content_sha256",
                "opensAt": "LOCKED_PRE:sys_hris_listening_surveys.opens_at",
                "closesAt": "LOCKED_PRE:sys_hris_listening_surveys.closes_at",
                "eraseAfter": "OWNER_REFETCH:retentionVersionPublicId.eraseAfter",
                "idempotencyKey": "headers.Idempotency-Key",
            }
        else:
            outbox_step["payloadFieldSources"] = {
                "tenantPublicId": "authenticatedPrincipal.tenantPublicId",
                "surveyPublicId": "LOCKED_PRE:sys_hris_listening_surveys.public_id",
                "admissionPublicId": "LOCKED_FORM_VERSION.admission_public_id",
                "expectedOwnerVersion": "LOCKED_FORM_VERSION.admission_owner_version",
                "idempotencyKey": "headers.Idempotency-Key",
            }
        outbox_step["payloadSchema"] = request_message
        source_stream = "platform-hris-configuration"
        outbox_step["assignments"].update({
            "signing_key_id": "ACTIVE_SIGNING_KEY_FOR:" + source_stream + ".kid",
            "signature_algorithm": "ACTIVE_SIGNING_KEY_FOR:" + source_stream + ".algorithm",
            "owner_signature": (
                "SERVER_SIGN_ACTIVE_OWNER_KEY:tenantPublicId+messageId+messageName+"
                "sourceStreamKey+payloadDigest+referenceEffectiveAt"
            ),
        })
        outbox_step["signedEnvelope"] = {
            "sourceStreamKey": source_stream,
            "keyStatus": "ACTIVE_AT_REFERENCE_EFFECTIVE_AT",
            "algorithmAllowlist": ["ED25519", "ECDSA_P256_SHA256"],
            "canonicalSignatureInput": (
                "tenantPublicId+messageId+messageName+sourceStreamKey+"
                "payloadDigest+referenceEffectiveAt"
            ),
            "keyRotation": "consumer resolves signingKeyId at referenceEffectiveAt; unknown or retired key fails closed",
        }
        operation["transition"].update({
            "preStates": (["DRAFT", retry_state] if publish else ["PUBLISHED", retry_state]),
            "postStates": [pending_state], "postStateSource": "SERVER_SAGA_PENDING",
            "stateSink": "sys_hris_listening_surveys.status",
            "physicalPostStateSink": "sys_hris_listening_surveys.status",
        })
        operation["sagaContract"] = {
            "intentState": pending_state, "retryableState": retry_state,
            "requestMessage": request_message, "signedResultMessage": receipt_message,
            "completionHandlerId": completion_handler, "successPublicEvent": final_event,
            "eventBeforeSignedSuccess": "FORBIDDEN",
            "resultUnknown": "REFETCH_CONFIGURATION_INTENT_STATUS_BY_COMMAND_RECEIPT",
            "crossDatabaseTransaction": "FORBIDDEN",
        }
    if operation_id == "modern.listening.action.create":
        for event in operation.get("events", []):
            event["fields"] = [
                field for field in event.get("fields", [])
                if field.get("name") != "ownerPrincipalId"
            ]
            event["audience"]["fieldExposure"]["fields"] = [
                field["name"] for field in event["fields"]
            ]
            event["refetchContract"]["allowedFields"] = [
                field["name"] for field in event["fields"]
            ]
            if event["refetchContract"].get("pep"):
                event["refetchContract"]["pep"]["fieldExposure"] = [
                    field["name"] for field in event["fields"]
                ]


def _apply_route_override(operation: dict[str, Any]) -> None:
    override = ROUTE_OVERRIDES.get(operation["operationId"])
    if not override:
        return
    operation["path"], operation["method"], operation["authorizationCapability"] = override
    for event in operation.get("events", []):
        event["audience"]["allowedPurposes"] = [override[2]]
        refetch = event.get("refetchContract", {})
        if refetch.get("mode") != "FORBIDDEN":
            refetch["pep"]["purpose"] = [override[2]]


SELF_SUBJECT_BINDINGS = {
    "modern.ai.assist.cancel": "sys_hris_ai_assistance_requests.created_by=authenticatedPrincipal.publicId",
    "modern.ai.assist.review": "sys_hris_ai_assistance_requests.created_by=authenticatedPrincipal.publicId OR exact delegated reviewer duty",
    "modern.ai.assist.revoke": "sys_hris_ai_assistance_requests.created_by=authenticatedPrincipal.publicId OR exact revoke duty",
    "modern.benefits.enrollment.submit": "body.workerPublicId=authenticatedPrincipal.workerPublicId",
    "modern.benefits.lifeevent.submit": "body.workerPublicId=authenticatedPrincipal.workerPublicId",
    "modern.growth.profile.create": "body.workerPublicId=authenticatedPrincipal.workerPublicId",
    "modern.growth.profile.update": "prf_grw_profiles.worker_public_id=authenticatedPrincipal.workerPublicId",
    "modern.growth.profile.archive": "prf_grw_profiles.worker_public_id=authenticatedPrincipal.workerPublicId",
    "modern.growth.evidence.link": "prf_grw_profiles.worker_public_id=authenticatedPrincipal.workerPublicId",
    "modern.growth.evidence.unlink": "prf_grw_profiles.worker_public_id=authenticatedPrincipal.workerPublicId",
    "modern.growth.export.request": "prf_grw_profiles.worker_public_id=authenticatedPrincipal.workerPublicId",
    "modern.hrservice.case.create": "body.requesterWorkerPublicId=authenticatedPrincipal.workerPublicId OR exact proxy delegation",
    "modern.learning.assignment.start": "prf_lrn_assignments.worker_public_id=authenticatedPrincipal.workerPublicId",
    "modern.learning.assignment.cancel": "prf_lrn_assignments.worker_public_id=authenticatedPrincipal.workerPublicId",
    "modern.learning.self.enroll": "body.workerPublicId=authenticatedPrincipal.workerPublicId",
    "modern.onboarding.task.complete": "task assignee policy resolves authenticatedPrincipal.publicId or exact delegation",
    "modern.onboarding.task.waive": "distinct waiver duty plus exact delegated actor policy",
    "modern.opportunity.apply": "body.workerPublicId=authenticatedPrincipal.workerPublicId",
}

# Self routes never trust a caller-supplied worker identity.  The small number
# of acting-on-behalf-of flows retain the same public v1 route but require a
# separate proxy duty and immutable delegation proof; that proof is not an
# alternative spelling for the self authorization capability.
SELF_PROXY_ALLOWED = {
    "modern.ai.assist.review": "hcm.ai.assist.review.proxy",
    "modern.ai.assist.revoke": "hcm.ai.assist.revoke.proxy",
    "modern.hrservice.case.create": "hcm.hrservice.case.create.proxy",
    "modern.onboarding.task.complete": "hcm.onboarding.task.complete.proxy",
    "modern.onboarding.task.waive": "hcm.onboarding.task.waive.proxy",
}

QUERY_EXTRA_READS = {
    "modern.benefits.enrollment.query": ("ppl_bnf_enrollment_eligibility_receipts", "ppl_bnf_dependent_elections"),
    "modern.benefits.enrollments.query": ("ppl_bnf_enrollment_eligibility_receipts", "ppl_bnf_dependent_elections"),
    "modern.benefits.lifeevent.query": ("ppl_bnf_life_event_decisions",),
    "modern.benefits.lifeevents.query": ("ppl_bnf_life_event_decisions",),
    "modern.ai.assistance.query": ("sys_hris_ai_assistance_reviews",),
    "modern.ai.assistances.query": ("sys_hris_ai_assistance_reviews",),
    "modern.contingent.engagement.query": ("ppl_cwk_access_receipts", "ppl_cwk_engagement_versions"),
    "modern.contingent.engagements.query": ("ppl_cwk_access_receipts", "ppl_cwk_engagement_versions"),
    "modern.compplan.cycle.query": ("prf_cmp_plan_proposal_refs",),
    "modern.compplan.cycles.query": ("prf_cmp_plan_proposal_refs",),
    "modern.compplan.proposal.query": ("prf_cmp_proposal_versions", "prf_cmp_plan_proposal_refs"),
    "modern.compplan.proposals.query": ("prf_cmp_proposal_versions", "prf_cmp_plan_proposal_refs"),
    "modern.learning.assignment.query": ("prf_lrn_capacity_ledger",),
    "modern.learning.assignments.query": ("prf_lrn_capacity_ledger", "prf_lrn_completion_evidence", "prf_lrn_completion_skill_evidence_refs"),
    "modern.learning.catalog.query": ("prf_lrn_offering_versions",),
    "modern.learning.offering.query": ("prf_lrn_offering_versions",),
    "modern.onboarding.assignment.query": ("ppl_jny_template_task_definitions",),
    "modern.onboarding.assignments.query": ("ppl_jny_task_evidence", "ppl_jny_template_task_definitions"),
    "modern.onboarding.self.query": (
        "ppl_jny_template_versions", "ppl_jny_template_task_definitions",
    ),
    "modern.onboarding.template.query": ("ppl_jny_template_task_definitions",),
    "modern.onboarding.templates.query": ("ppl_jny_template_task_definitions",),
    "modern.opportunity.application.query": ("prf_mkt_opportunity_versions",),
    "modern.opportunity.applications.query": ("prf_mkt_opportunity_versions",),
    "modern.opportunity.catalog.query": ("prf_mkt_opportunity_versions",),
    "modern.opportunity.query": ("prf_mkt_opportunity_versions",),
    "modern.recruiting.candidate.query": ("ppl_rec_offer_decisions",),
    "modern.recruiting.candidates.query": ("ppl_rec_offers", "ppl_rec_hire_requests", "ppl_rec_hire_handoff_receipts", "ppl_rec_offer_decisions"),
    "modern.recruiting.requisition.query": ("ppl_rec_requisition_versions",),
    "modern.recruiting.requisitions.query": ("ppl_rec_requisition_versions",),
    "modern.succession.plan.query": ("prf_suc_plan_versions",),
    "modern.succession.plans.query": ("prf_suc_plan_versions",),
    "modern.wfm.candidate.query": ("tme_wfm_approval_receipts",),
    "modern.wfm.candidates.query": (
        "tme_wfm_candidate_shift_lines", "tme_wfm_constraint_evaluation_receipts",
        "tme_wfm_constraint_violation_lines", "tme_wfm_fairness_measure_values",
        "tme_wfm_approval_requests", "tme_wfm_approval_receipts", "tme_wfm_schedule_publish_ledger",
    ),
    "modern.workforceplan.scenario.query": ("ppl_wfp_simulation_requests",),
    "modern.workforceplan.scenarios.query": ("ppl_wfp_simulation_requests",),
}


# These collection/self projections expose facts owned by immutable child
# tables.  Listing a table in ``readPlan.tables`` is not sufficient: the
# execution contract must say how the child is reached without crossing a
# tenant boundary, which exact immutable revision is eligible, and which
# physical columns feed the closed response fields.  The strings below are a
# deliberately closed grammar consumed by the author-side validator; there is
# no ``MAX``, current-row or latest-state escape hatch.
QUERY_CHILD_READ_CONTRACTS: dict[str, tuple[dict[str, Any], ...]] = {
    "modern.benefits.lifeevents.query": ({
        "childTable": "ppl_bnf_life_event_decisions",
        "anchorTables": ["ppl_bnf_life_events"],
        "joinType": "LEFT_EXACT_IMMUTABLE_CHILD",
        "tenantPredicate": (
            "ppl_bnf_life_event_decisions.tenant_id="
            "ppl_bnf_life_events.tenant_id=authenticatedPrincipal.tenantId"
        ),
        "identityPredicates": [
            "ppl_bnf_life_event_decisions.parent_public_id=ppl_bnf_life_events.public_id",
            "ppl_bnf_life_event_decisions.life_event_public_id=ppl_bnf_life_events.public_id",
        ],
        "revisionPredicate": (
            "ppl_bnf_life_event_decisions.fact_revision="
            "ppl_bnf_life_events.aggregate_version"
        ),
        "statePredicate": "ppl_bnf_life_event_decisions.state IN (VERIFIED,REJECTED)",
        "subjectPredicate": (
            "ppl_bnf_life_events.worker_public_id is inside authorization.populationScope;"
            "self scope additionally equals authenticatedPrincipal.workerPublicId"
        ),
        "fieldSources": {
            "decisionOutcome": "ppl_bnf_life_event_decisions.decision",
            "decisionReasonCode": "ppl_bnf_life_event_decisions.reason_code",
        },
        "collectionOrder": (
            "ppl_bnf_life_event_decisions.fact_revision ASC,"
            "ppl_bnf_life_event_decisions.ordinal ASC"
        ),
        "selectionRule": "EXACT_FACT_REVISION_ONLY;LATEST_MAX_FALLBACK_FORBIDDEN",
    },),
    "modern.compplan.cycles.query": ({
        "childTable": "prf_cmp_plan_proposal_refs",
        "anchorTables": ["prf_cmp_cycles", "prf_cmp_plans"],
        "joinType": "LEFT_EXACT_IMMUTABLE_CHILD_COLLECTION",
        "tenantPredicate": (
            "prf_cmp_plan_proposal_refs.tenant_id=prf_cmp_plans.tenant_id="
            "prf_cmp_cycles.tenant_id=authenticatedPrincipal.tenantId"
        ),
        "identityPredicates": [
            "prf_cmp_plans.cycle_public_id=prf_cmp_cycles.public_id",
            "prf_cmp_plan_proposal_refs.parent_public_id=prf_cmp_plans.public_id",
            "prf_cmp_plan_proposal_refs.plan_public_id=prf_cmp_plans.public_id",
        ],
        "revisionPredicate": (
            "prf_cmp_plan_proposal_refs.plan_revision=prf_cmp_plans.plan_revision"
        ),
        "statePredicate": "prf_cmp_plan_proposal_refs.state=APPROVED",
        "subjectPredicate": (
            "prf_cmp_cycles.population_snapshot_id is inside authorization.populationScope"
        ),
        "fieldSources": {
            "approvedProposalPublicIds": "prf_cmp_plan_proposal_refs.proposal_public_id",
            "approvedProposalVersions": "prf_cmp_plan_proposal_refs.proposal_version",
        },
        "collectionOrder": (
            "prf_cmp_plan_proposal_refs.plan_revision ASC,"
            "prf_cmp_plan_proposal_refs.ordinal ASC"
        ),
        "selectionRule": "EXACT_PLAN_REVISION_ONLY;LATEST_MAX_FALLBACK_FORBIDDEN",
    },),
    "modern.compplan.proposals.query": ({
        "childTable": "prf_cmp_plan_proposal_refs",
        "anchorTables": ["prf_cmp_proposals"],
        "joinType": "LEFT_EXACT_IMMUTABLE_CHILD_COLLECTION",
        "tenantPredicate": (
            "prf_cmp_plan_proposal_refs.tenant_id="
            "prf_cmp_proposals.tenant_id=authenticatedPrincipal.tenantId"
        ),
        "identityPredicates": [
            "prf_cmp_plan_proposal_refs.proposal_public_id=prf_cmp_proposals.public_id",
        ],
        "revisionPredicate": (
            "prf_cmp_plan_proposal_refs.proposal_version="
            "prf_cmp_proposals.proposal_version"
        ),
        "statePredicate": "prf_cmp_plan_proposal_refs.state=APPROVED",
        "subjectPredicate": (
            "prf_cmp_proposals.compensation_cycle_id="
            "selector.pathParameters.cycleId.internalId and worker is inside "
            "authorization.populationScope"
        ),
        "fieldSources": {
            "approvedPlanPublicIds": "prf_cmp_plan_proposal_refs.plan_public_id",
            "approvedPlanRevisions": "prf_cmp_plan_proposal_refs.plan_revision",
        },
        "collectionOrder": (
            "prf_cmp_plan_proposal_refs.plan_revision ASC,"
            "prf_cmp_plan_proposal_refs.ordinal ASC"
        ),
        "selectionRule": "EXACT_PROPOSAL_VERSION_ONLY;LATEST_MAX_FALLBACK_FORBIDDEN",
    },),
    "modern.onboarding.self.query": ({
        "childTable": "ppl_jny_template_task_definitions",
        "anchorTables": [
            "ppl_jny_assignments", "ppl_jny_assignment_tasks",
            "ppl_jny_template_versions",
        ],
        "joinType": "LEFT_EXACT_IMMUTABLE_CHILD_COLLECTION",
        "tenantPredicate": (
            "ppl_jny_template_task_definitions.tenant_id="
            "ppl_jny_template_versions.tenant_id=ppl_jny_assignment_tasks.tenant_id="
            "ppl_jny_assignments.tenant_id=authenticatedPrincipal.tenantId"
        ),
        "identityPredicates": [
            "ppl_jny_assignment_tasks.journey_assignment_id=ppl_jny_assignments.journey_assignment_id",
            "ppl_jny_assignments.journey_template_version_id=ppl_jny_template_versions.journey_template_version_id",
            "ppl_jny_template_task_definitions.parent_public_id=ppl_jny_template_versions.public_id",
            "ppl_jny_template_task_definitions.template_version_public_id=ppl_jny_template_versions.public_id",
            "ppl_jny_template_task_definitions.task_key=ppl_jny_assignment_tasks.task_key",
        ],
        "revisionPredicate": (
            "ppl_jny_template_task_definitions.template_version_public_id="
            "ppl_jny_template_versions.public_id"
        ),
        "statePredicate": "ppl_jny_template_task_definitions.state=ACTIVE",
        "subjectPredicate": (
            "ppl_jny_assignments.worker_public_id=authenticatedPrincipal.workerPublicId and "
            "worker is inside authorization.populationScope"
        ),
        "fieldSources": {
            "templateTaskKeys": "ppl_jny_template_task_definitions.task_key",
            "templateTaskRequiredFlags": "ppl_jny_template_task_definitions.required_flag",
        },
        "collectionOrder": (
            "ppl_jny_assignment_tasks.task_order ASC,"
            "ppl_jny_template_task_definitions.ordinal ASC"
        ),
        "selectionRule": "EXACT_ASSIGNED_TEMPLATE_VERSION_ONLY;LATEST_MAX_FALLBACK_FORBIDDEN",
    },),
}


def _apply_query_child_read_contracts(operation: dict[str, Any]) -> None:
    contracts = QUERY_CHILD_READ_CONTRACTS.get(operation["operationId"])
    if not contracts:
        return
    operation["readPlan"]["joinContracts"] = copy.deepcopy(list(contracts))

TEMPORAL_DETAIL_QUERY_TABLES = {
    "modern.benefits.plan.query": "ppl_bnf_plan_versions",
    "modern.contingent.engagement.query": "ppl_cwk_engagement_versions",
    "modern.learning.offering.query": "prf_lrn_offering_versions",
    "modern.onboarding.template.query": "ppl_jny_template_versions",
    "modern.opportunity.query": "prf_mkt_opportunity_versions",
    "modern.recruiting.requisition.query": "ppl_rec_requisition_versions",
    "modern.succession.plan.query": "prf_suc_plan_versions",
}

TEMPORAL_COLLECTION_QUERY_TABLES = {
    "modern.benefits.plans.query": "ppl_bnf_plan_versions",
    "modern.benefits.self.plans.query": "ppl_bnf_plan_versions",
    "modern.contingent.engagements.query": "ppl_cwk_engagement_versions",
    "modern.learning.catalog.query": "prf_lrn_offering_versions",
    "modern.onboarding.templates.query": "ppl_jny_template_versions",
    "modern.opportunity.catalog.query": "prf_mkt_opportunity_versions",
    "modern.opportunity.application.query": "prf_mkt_opportunity_versions",
    "modern.opportunity.applications.query": "prf_mkt_opportunity_versions",
    "modern.recruiting.requisitions.query": "ppl_rec_requisition_versions",
    "modern.succession.plans.query": "prf_suc_plan_versions",
}


def _apply_temporal_detail_query_contract(operation: dict[str, Any]) -> None:
    table = (
        TEMPORAL_DETAIL_QUERY_TABLES.get(operation["operationId"])
        or TEMPORAL_COLLECTION_QUERY_TABLES.get(operation["operationId"])
    )
    if not table:
        return
    detail = operation["operationId"] in TEMPORAL_DETAIL_QUERY_TABLES
    transport_fields = [("systemAsOf", "TIMESTAMPTZ", None)]
    if detail:
        transport_fields.extend((
            ("revisionPublicId", "UUID", "table:" + table),
            ("rootVersion", "BIGINT", None),
            ("contentRevisionPublicId", "UUID", "table:" + table),
        ))
    for name, field_type, entity in transport_fields:
        source = "queryParameters." + name
        field = next((
            row for row in operation.get("requestFields", [])
            if row.get("source") == source
        ), None)
        if field is None:
            field = _field(name, "queryParameters", field_type, required=False, entity=entity)
            operation.setdefault("requestFields", []).append(field)
        field["required"] = False
        field["validation"] = {
            "systemAsOf": "owner-clock timestamp; defaults once to the captured read clock",
            "revisionPublicId": "exact immutable revision identity; no latest fallback",
            "rootVersion": "positive exact root append version; no latest fallback",
            "contentRevisionPublicId": (
                "exact content-history row; mutually exclusive with state-row selectors"
            ),
        }[name]
        operation["inputEffects"] = [
            row for row in operation.get("inputEffects", [])
            if row.get("source") != source
        ]
    temporal_effects = [{
            "source": "queryParameters.systemAsOf", "type": "TIMESTAMPTZ",
            "required": False, "sensitivity": "INTERNAL", "requestDigestMember": False,
            "effects": [{
                "kind": "SYSTEM_AS_OF_FILTER", "target": table + ".created_at",
                "operator": "<=", "default": "CAPTURED_OWNER_READ_CLOCK_ONCE",
            }],
        }]
    if not detail:
        # A list route has no one stable parent identity. rootVersion is only
        # unique inside an aggregate, so accepting it here would be ambiguous
        # across many rows. Collections expose bitemporal winners at one
        # captured systemAsOf only; exact revision re-entry belongs to the
        # corresponding detail route.
        forbidden_sources = {
            "queryParameters.revisionPublicId", "queryParameters.rootVersion",
            "queryParameters.contentRevisionPublicId",
        }
        operation["requestFields"] = [
            row for row in operation.get("requestFields", [])
            if row.get("source") not in forbidden_sources
        ]
        operation["inputEffects"] = [
            row for row in operation.get("inputEffects", [])
            if row.get("source") not in forbidden_sources
        ]
        operation["selectors"] = [
            row for row in operation.get("selectors", [])
            if row.get("source") not in forbidden_sources
        ]
        operation.pop("exactHistoryTransport", None)
        operation["readPlan"]["temporalResolution"].update({
            "exactHistorySelector": (
                "FORBIDDEN_ON_COLLECTION_WITHOUT_STABLE_PARENT_IDENTITY; "
                "use the matching stable-parent detail operation"
            ),
            "selectionScope": "INDEPENDENTLY_PER_TENANT_BOUND_STABLE_PARENT",
        })
        detail_reentry = (
            "resolve the tenant-bound application to its opportunity stable parent, then use "
            "modern.opportunity.query exact-history transport"
            if operation["operationId"] in {
                "modern.opportunity.application.query",
                "modern.opportunity.applications.query",
            }
            else "use " + TEMPORAL_DETAIL_QUERY_BY_VERSION_TABLE[table]
            + " with its stable-parent path identity"
        )
        operation["temporalCollectionContract"] = {
            "systemAsOf": "queryParameters.systemAsOf or one captured owner read clock",
            "businessAsOf": "queryParameters.referenceEffectiveAt or the same captured clock",
            "content": "CONTENT_WINNER independently per stable parent",
            "state": "STATE_WINNER independently per stable parent",
            "exactRevisionSelectors": "FORBIDDEN_WITHOUT_STABLE_PARENT_IDENTITY",
            "detailReentry": detail_reentry,
        }
        operation["inputEffects"].extend(temporal_effects)
        return
    temporal_effects.extend(({
            "source": "queryParameters.revisionPublicId", "type": "UUID",
            "required": False, "sensitivity": "RESTRICTED", "requestDigestMember": False,
            "effects": [{
                "kind": "EXACT_IMMUTABLE_REVISION_SELECTOR", "target": table + ".public_id",
                "cardinality": "EXACTLY_ONE_IF_PRESENT", "failure": "404_OPAQUE_ZERO_MUTATION",
            }],
        }, {
            "source": "queryParameters.rootVersion", "type": "BIGINT",
            "required": False, "sensitivity": "INTERNAL", "requestDigestMember": False,
            "effects": [{
                "kind": "EXACT_ROOT_VERSION_SELECTOR", "target": table + ".root_version",
                "cardinality": "EXACTLY_ONE_IF_PRESENT", "failure": "404_OPAQUE_ZERO_MUTATION",
            }],
        }, {
            "source": "queryParameters.contentRevisionPublicId", "type": "UUID",
            "required": False, "sensitivity": "RESTRICTED", "requestDigestMember": False,
            "effects": [{
                "kind": "EXACT_CONTENT_HISTORY_SELECTOR", "target": table + ".public_id",
                "cardinality": "EXACTLY_ONE_IF_PRESENT", "failure": "404_OPAQUE_ZERO_MUTATION",
            }],
        },))
    operation["inputEffects"].extend(temporal_effects)
    operation["selectors"] = [
        row for row in operation.get("selectors", [])
        if row.get("source") not in {
            "queryParameters.revisionPublicId", "queryParameters.rootVersion",
            "queryParameters.contentRevisionPublicId",
        }
    ]
    parent_filter = "tenant+stable root path identity"
    common = {
        "selectorType": "LOCAL_TABLE", "entityType": "table:" + table,
        "targetTable": table, "operator": "=", "cardinality": "ZERO_OR_ONE_IF_PRESENT",
        "tenantFilter": "tenant_id=authenticatedPrincipal.tenantId",
        "purposeFilter": operation["authorizationCapability"],
        "versionRule": "EXACT_IMMUTABLE_REVISION_NO_LATEST_FALLBACK",
        "asOfRule": "created_at<=queryParameters.systemAsOf OR captured owner read clock",
        "causalJoin": parent_filter + "; both exact selectors, if supplied, must identify one row",
        "failure": "404_OPAQUE; QUERY_HAS_ZERO_WRITES_RECEIPTS_OR_OUTBOX",
    }
    operation["selectors"].extend((
        {
            **common, "source": "queryParameters.revisionPublicId", "sourceType": "UUID",
            "idSpace": "PUBLIC_UUID", "targetColumn": "public_id", "targetSqlType": "UUID",
        },
        {
            **common, "source": "queryParameters.rootVersion", "sourceType": "BIGINT",
            "idSpace": "ROOT_VERSION", "targetColumn": "root_version", "targetSqlType": "BIGINT",
        },
        {
            **common, "source": "queryParameters.contentRevisionPublicId", "sourceType": "UUID",
            "idSpace": "PUBLIC_UUID", "targetColumn": "public_id", "targetSqlType": "UUID",
            "versionRule": "EXACT_CONTENT_HISTORY_ROW_NO_STATE_LATEST_FALLBACK",
            "causalJoin": parent_filter + "; mutually exclusive with revisionPublicId/rootVersion",
        },
    ))
    operation["exactHistoryTransport"] = {
        "systemAsOf": "queryParameters.systemAsOf",
        "revisionSelector": "queryParameters.revisionPublicId OR queryParameters.rootVersion",
        "selectorAgreement": "if both supplied they resolve the same tenant+parent revision row",
        "contentRevisionSelector": "queryParameters.contentRevisionPublicId exact content-history mode",
        "selectorModes": {
            "UNQUALIFIED": "independent CONTENT_WINNER and STATE_WINNER",
            "STATE_HISTORY": "state row selector then exact content_revision_public_id join",
            "CONTENT_HISTORY": "content row selector plus independent systemAsOf state winner",
        },
        "crossFieldRules": [
            "contentRevisionPublicId is mutually exclusive with revisionPublicId and rootVersion",
            "revisionPublicId and rootVersion may co-occur only when both resolve the same tenant+parent STATE_ROW",
            "every exact selector is constrained by tenant+stable-parent+systemAsOf",
            "STATE_HISTORY joins SELECTED_STATE_ROW.content_revision_public_id to one exact CONTENT_ROW with no latest fallback",
            "CONTENT_HISTORY returns the exact selected content row and the independently systemAsOf-visible STATE_WINNER; no current-row fallback",
        ],
        "ordinaryBusinessAsOf": (
            "when neither exact selector is supplied, query referenceEffectiveAt selects the "
            "dual-chain business winner under the captured systemAsOf"
        ),
    }


def _apply_subject_authorization(operation: dict[str, Any]) -> None:
    operation_id = operation["operationId"]
    if operation_id not in SELF_SUBJECT_BINDINGS:
        return
    worker_names = {"workerPublicId", "requesterWorkerPublicId"}
    worker_sources = {
        field["source"] for field in operation.get("requestFields", [])
        if field.get("name") in worker_names
    }
    if worker_sources:
        _remove_request_field(operation, worker_names)
        for selector in operation.get("selectors", []):
            if selector.get("source") in worker_sources:
                selector["source"] = "authenticatedPrincipal.workerPublicId"
                selector["sourceType"] = "AUTHENTICATED_PRINCIPAL_UUID"
                selector["selectorType"] = "CALLER_SUBJECT_EQUALITY"
        for step in operation.get("orderedDml", []):
            for column, source in list(step.get("assignments", {}).items()):
                if source in worker_sources or any(source.startswith("ownerRefetch." + item)
                                                   for item in worker_sources):
                    step["assignments"][column] = "authenticatedPrincipal.workerPublicId"
    root = operation["aggregateRoot"]["table"]
    proxy_capability = SELF_PROXY_ALLOWED.get(operation_id)
    subject = {
        "kind": "CALLER_SUBJECT_EQUALITY",
        "tenantPredicate": "locked.tenant_id=authenticatedPrincipal.tenantId",
        "purposePredicate": (
            "authorization.purpose=" + operation["authorizationCapability"]
        ),
        "subjectPredicate": (
            "NEW_ROW.worker_public_id=authenticatedPrincipal.workerPublicId"
            if worker_sources else
            f"LOCKED:{root}.worker_public_id=authenticatedPrincipal.workerPublicId OR "
            f"LOCKED:{root}.created_by=authenticatedPrincipal.publicId"
        ),
        "evaluation": "AFTER_TENANT_BOUND_LOCK_BEFORE_ANY_DOMAIN_WRITE",
        "failure": "404_OPAQUE_ZERO_MUTATION",
        "dmlSource": "authenticatedPrincipal.workerPublicId" if worker_sources else "LOCKED_OWNER_SUBJECT",
    }
    operation["subjectAuthorization"] = {
        "mode": "SELF_ONLY" if not proxy_capability else "SELF_OR_EXACT_DELEGATION",
        "self": subject,
        "proxy": ({
            "kind": "EXACT_DELEGATION_SELECTOR",
            "authorizationCapability": proxy_capability,
            "tenantPredicate": "delegationReceipt.tenantId=authenticatedPrincipal.tenantId",
            "purposePredicate": "delegationReceipt.purpose=authorization.purpose",
            "subjectPredicate": "delegationReceipt.subjectWorkerPublicId=LOCKED_OWNER_SUBJECT",
            "requiredReceipt": "delegationReceiptPublicId+delegationReceiptRevision",
            "requiredReason": "delegationReasonCode",
            "asOfRule": "delegationReceipt.validAt=ownerClock.transactionNow",
            "failure": "403_ZERO_MUTATION",
        } if proxy_capability else {
            "kind": "FORBIDDEN", "reason": "SELF_ROUTE_HAS_NO_PROXY_AUTHORITY",
        }),
    }
    operation.setdefault("inputEffects", []).append({
        "source": "authenticatedPrincipal.workerPublicId",
        "type": "UUID", "required": True, "sensitivity": "RESTRICTED",
        "requestDigestMember": False,
        "effects": [{
            "kind": "CALLER_SUBJECT_EQUALITY",
            "target": subject["subjectPredicate"],
            "tenant": subject["tenantPredicate"],
            "purpose": subject["purposePredicate"],
            "failure": subject["failure"],
        }],
    })


def _semantic_operation_overlay(operation: dict[str, Any]) -> None:
    _apply_route_override(operation)
    if operation["operationId"] == "modern.analytics.metric.create":
        _remove_request_field(operation, {
            "cohortDefinitionId", "anonymityThreshold", "asOf", "calculatedAt", "subjectCount",
        })
    _ensure_global_semantic_steps(operation)
    _repair_business_inputs_and_writes(operation)
    _repair_internal_identity_fk_writes(operation)
    _apply_p1_decision_contract(operation)
    _apply_p1_effective_contract(operation)
    _apply_builtin_version_lifecycle_append(operation)
    _normalize_temporal_root_version_alias(operation)
    _apply_configuration_version_contract(operation)
    _apply_money_contract(operation)
    operation_id = operation["operationId"]
    if operation_id == "modern.analytics.projection.request":
        step = _domain_step(operation, "sys_hris_metric_projection_requests")
        if step:
            step["assignments"].update({
                "parent_public_id": "pathParameters.metricId",
                "parent_version": "LOCKED_PRE:sys_hris_metric_definitions.aggregate_version",
                "fact_revision": "CONSTANT:1", "ordinal": "CONSTANT:1",
                "payload_digest": "SERVER_DERIVE:metric version+asOf+cohort+population+purpose",
                "reference_effective_at": "body.asOf",
            })
    elif operation_id == "modern.learning.assignment.create":
        step = _domain_step(operation, "prf_lrn_assignments")
        if step:
            step["assignments"].update({
                "assigned_at": "ownerClock.transactionNow", "assignment_revision": "CONSTANT:1",
            })
    elif operation_id == "modern.wfm.forecast.create":
        step = _domain_step(operation, "tme_wfm_forecast_revision_counters")
        if step:
            step["assignments"]["last_source_digest"] = "SERVER_DERIVE:canonical forecast source lines"
    elif operation_id == "modern.wfm.schedule.optimize":
        operation.setdefault("inputEffects", []).append({
            "source": "body.optimizationMode", "type": "STRING", "required": True,
            "sensitivity": "INTERNAL", "requestDigestMember": True,
            "effects": [{
                "kind": "OPTIMIZATION_MODE_SELECTOR",
                "allowed": ["DETERMINISTIC_RULES", "GOVERNED_AI"],
                "condition": {"source": "body.optimizationMode", "equals": "GOVERNED_AI"},
                "requires": "body.aiGovernanceActivationReceiptPublicId+body.modelVersionPublicId",
                "failure": "422_MISSING_OR_STALE_GOVERNANCE_PROOF_ZERO_MUTATION",
            }],
        })
        for effect_row in operation.get("inputEffects", []):
            if not re.search(r"(?:governedAi|aiGovernance|modelVersion)", str(effect_row.get("source", "")), re.I):
                continue
            for effect in effect_row.get("effects", []):
                effect["condition"] = {
                    "source": "body.optimizationMode", "equals": "GOVERNED_AI",
                }
    elif operation_id == "modern.listening.survey.create":
        root = _domain_step(operation, "sys_hris_listening_surveys")
        if root:
            root["assignments"].update({
                "payload_digest": "SERVER_DERIVE:canonical survey root",
                "reference_effective_at": "ownerClock.transactionNow",
            })
        for event in operation.get("events", []):
            for field in event.get("fields", []):
                if field.get("name") == "fromState":
                    field.update({
                        "sourceKind": "DERIVED_DOMAIN_FACT",
                        "source": "CONSTANT:NONE",
                    })
    elif operation_id == "modern.listening.action.create":
        step = _domain_step(operation, "sys_hris_listening_actions")
        if step:
            step["assignments"]["reference_effective_at"] = "ownerClock.transactionNow"
    elif operation_id == "modern.compplan.snapshot.publish":
        step = _domain_step(operation, "prf_cmp_approved_snapshots")
        if step:
            step["assignments"].pop("approval_revision", None)
    elif operation_id == "modern.ai.policy.revise":
        root = _domain_step(operation, "sys_hris_ai_use_policies")
        if root:
            root["assignments"].update({
                "display_name": "body.displayName", "valid_from": "body.validFrom",
                "valid_to": "body.validTo IF PRESENT",
            })
        for effect in operation.get("inputEffects", []):
            replacements = {
                "body.displayName": "display_name", "body.validFrom": "valid_from",
                "body.validTo": "valid_to",
            }
            if effect.get("source") in replacements:
                effect["effects"] = [{
                    "kind": "TYPED_DOMAIN_INPUT",
                    "target": "sys_hris_ai_use_policies." + replacements[effect["source"]],
                }]
    elif operation_id == "modern.analytics.export.create":
        for effect in operation.get("inputEffects", []):
            if effect.get("source") == "body.metricProjectionIds":
                effect["effects"] = [
                    row for row in effect.get("effects", [])
                    if row.get("kind") != "PERSISTED_COLUMN"
                ] + [{
                    "kind": "TYPED_ORDERED_CHILD_COLLECTION",
                    "target": "sys_hris_analytics_export_projection_refs.metric_projection_public_id",
                }]
    elif operation_id == "modern.ai.assist.create":
        for effect in operation.get("inputEffects", []):
            if effect.get("source") == "body.useCaseKey":
                effect["effects"] = [{
                    "kind": "TYPED_DOMAIN_INPUT",
                    "target": "sys_hris_ai_assistance_requests.use_case_key",
                }]
    elif operation_id == "modern.recruiting.requisition.lifecycle.change":
        if not any(row.get("source") == "body.targetState" for row in operation.get("requestFields", [])):
            field = _field("targetState", "body", "STRING", entity=None)
            operation["requestFields"].append(field)
            operation["inputEffects"].append({
                "source": field["source"], "type": "STRING", "required": True,
                "sensitivity": "INTERNAL", "requestDigestMember": True,
                "effects": [{"kind": "TYPED_DOMAIN_INPUT", "target": "ppl_rec_requisitions.status"}],
            })
        _remove_request_field(operation, {"decision"})

    # Common audit columns have no defaults and are part of every new durable
    # fact, including pre-existing operations normalized by this successor.
    for step in operation.get("orderedDml", []):
        if step.get("role") in {"COMMAND_RECEIPT", "TRANSACTIONAL_OUTBOX"}:
            continue
        if step.get("action") in {"INSERT", "APPEND", "INSERT_MANY", "APPEND_MANY", "UPSERT"}:
            step.setdefault("assignments", {}).setdefault(
                "created_by", "authenticatedPrincipal.publicId"
            )
            step["assignments"].setdefault("correlation_id", "headers.X-Correlation-ID")
    _normalize_reference_contracts(operation)
    if operation_id == "modern.listening.response.submit":
        for selector in operation.get("selectors", []):
            selector["tenantFilter"] = (
                "target.tenant_id=verified signedParticipationCredential.tenantPublicId owner-local mapping"
            )
            selector["purposeFilter"] = "PROTECTED_ANONYMOUS_LISTENING_SUBMISSION"
    state_conditions = {
        "GovernedAiAssistanceConfirmed.v2": "toState=CONFIRMED",
        "GovernedAiAssistanceRejected.v2": "toState=REJECTED",
        "CandidateOfferAccepted.v2": "toState=ACCEPTED",
        "CandidateOfferDeclined.v2": "toState=DECLINED",
        "RequisitionPaused.v2": "toState=PAUSED",
        "RequisitionResumed.v2": "toState=OPEN",
        "RequisitionClosed.v2": "toState=CLOSED",
        "OnboardingJourneyCompleted.v2": "ALWAYS",
        "WorkforceSchedulePublished.v2": "ALWAYS",
    }
    post_states = set(operation.get("transition", {}).get("postStates", []))
    post_states.update(
        branch.get("postState")
        for branch in operation.get("transition", {}).get("branches", [])
        if branch.get("postState")
    )
    temporal_event_version = next((
        table for table in TEMPORAL_VERSION_ROOT_TABLE
        if any(
            step.get("table") == table
            and step.get("action") in {"INSERT", "APPEND"}
            for step in operation.get("orderedDml", [])
        )
    ), None)
    for event in operation.get("events", []):
        condition = state_conditions.get(event["eventName"])
        if condition:
            event["condition"] = condition
        elif str(event.get("condition", "")).startswith("toState="):
            stated = event["condition"].split("=", 1)[1]
            if stated not in post_states:
                event["condition"] = "ALWAYS"
        entity = event.get("aggregateEntityType")
        endpoint = DETAIL_QUERY_BY_ENTITY.get(entity)
        if temporal_event_version:
            event["refetchContract"] = _temporal_event_refetch_contract(
                version_table=temporal_event_version,
                root_table=TEMPORAL_VERSION_ROOT_TABLE[temporal_event_version],
                owner_session=operation["session"],
                purpose=operation["authorizationCapability"],
                event=event,
            )
        elif endpoint:
            event["refetchContract"] = {
                "mode": "EXACT_HISTORICAL_VERSION", "ownerSession": operation["session"],
                "entityType": entity, "endpointOperationId": endpoint,
                "allowedFields": [field["name"] for field in event.get("fields", [])],
                "pep": {"tenant": "event.tenantId", "purpose": [operation["authorizationCapability"]],
                        "consumerSessionAllowlist": [operation["session"]],
                        "fieldExposure": [field["name"] for field in event.get("fields", [])],
                        "reauthorizeEveryCall": True, "denyOnUnavailable": True},
                "version": "event.aggregateVersion exact; no latest fallback",
                "asOf": "event.occurredAt",
            }
        else:
            event["refetchContract"] = {
                "mode": "FORBIDDEN",
                "reason": "FIXED_V1_SURFACE_HAS_NO_EXACT_AGGREGATE_DETAIL_OPERATION",
                "payloadSufficiency": "CLOSED_DURABLE_EVENT_FIELDS_ONLY",
            }
        if (
            operation_id == "modern.compplan.snapshot.publish"
            and event.get("eventName") == PAYROLL_SNAPSHOT_EVENT
        ):
            event["refetchContract"] = _compensation_payroll_event_refetch()
            _apply_compensation_payroll_event_audience(event)
    if operation["mode"] == "QUERY":
        sources = list(operation.get("readPlan", {}).get("tables", ()))
        for table in QUERY_EXTRA_READS.get(operation_id, ()):
            if table not in sources:
                sources.append(table)
        operation["readPlan"] = _query_read_plan(
            operation, sources
        )
        _apply_query_child_read_contracts(operation)
        _apply_temporal_detail_query_contract(operation)
    _apply_subject_authorization(operation)
    if operation["mode"] == "COMMAND" and operation["operationId"] != "modern.listening.response.submit":
        domain_steps = [
            copy.deepcopy(step) for step in operation.get("orderedDml", [])
            if step.get("role") not in {"COMMAND_RECEIPT", "TRANSACTIONAL_OUTBOX"}
        ]
        operation["orderedDml"] = _receipt_steps(operation, domain_steps)
    _repair_listening_owner_boundaries(operation)
    # These two protected endpoints are intentionally applied last.  Generic
    # reference normalization and query projection construction are principal-
    # aware and must never replace the anonymous, owner-local admission fence.
    if operation_id == "modern.listening.response.submit":
        _protected_listening_submit(operation)
    elif operation_id == "modern.listening.active.query":
        _protected_listening_active_query(operation)
    if operation_id in {
        "modern.listening.survey.publish", "modern.listening.survey.close",
    }:
        for step_no, step in enumerate(operation.get("orderedDml", []), start=1):
            step["step"] = step_no


HANDLER_RUNTIME = {
    "internal.workforceplan.simulation-result.consume": (
        "HRIS.MODERN.WORKFORCE_PLANNING", "HRIS-HRM", "ppl_wfp_simulation_requests", "state",
        ("REQUESTED",), ("COMPLETED", "FAILED")),
    "internal.recruiting.offer.expire": (
        "HRIS.MODERN.RECRUITING_ATS", "HRIS-HRM", "ppl_rec_offers", "status",
        ("ISSUED",), ("EXPIRED",)),
    "internal.recruiting.hire-handoff.result.consume": (
        "HRIS.MODERN.RECRUITING_ATS", "HRIS-HRM", "ppl_rec_hire_requests", "status",
        ("PENDING",), ("COMPLETED", "FAILED")),
    "internal.benefits.life-event.expire": (
        "HRIS.MODERN.BENEFITS_ADMIN", "HRIS-HRM", "ppl_bnf_life_events", "status",
        ("PENDING",), ("EXPIRED",)),
    "internal.benefits.provider-result.consume": (
        "HRIS.MODERN.BENEFITS_ADMIN", "HRIS-HRM", "ppl_bnf_provider_requests", "state",
        ("REQUESTED",), ("COMPLETED", "FAILED")),
    "internal.hrservice.sla-milestone.consume": (
        "HRIS.MODERN.HR_SERVICE_DELIVERY", "HRIS-HRM", "ppl_hrs_sla_receipts", "outcome",
        (), ("MEASURED", "BREACHED", "MET")),
    "internal.contingent.access-grant-result.consume": (
        "HRIS.MODERN.CONTINGENT_WORKFORCE", "HRIS-HRM", "ppl_cwk_access_requests", "state",
        ("REQUESTED",), ("GRANTED", "FAILED")),
    "internal.contingent.access-revoke-result.consume": (
        "HRIS.MODERN.CONTINGENT_WORKFORCE", "HRIS-HRM", "ppl_cwk_access_requests", "state",
        ("REQUESTED", "COMPLETED"), ("REVOKED", "FAILED")),
    "internal.contingent.access-expiry.initiate": (
        "HRIS.MODERN.CONTINGENT_WORKFORCE", "HRIS-HRM", "ppl_cwk_access_requests", "state",
        ("GRANTED",), ("EXPIRED",)),
    "internal.growth.portability-export.result.consume": (
        "HRIS.MODERN.GROWTH_PROFILE", "HRIS-PER", "prf_grw_portability_export_receipts", "state",
        ("REQUESTED", "GENERATING"), ("COMPLETED", "FAILED")),
    "internal.growth.portability-export.expire": (
        "HRIS.MODERN.GROWTH_PROFILE", "HRIS-PER", "prf_grw_portability_export_receipts", "state",
        ("COMPLETED",), ("EXPIRED",)),
    "internal.wfm.schedule-optimization.result.consume": (
        "HRIS.MODERN.ADVANCED_WFM", "HRIS-TIM", "tme_wfm_optimization_requests", "status",
        ("REQUESTED",), ("COMPLETED", "FAILED")),
    "internal.wfm.approval-result.consume": (
        "HRIS.MODERN.ADVANCED_WFM", "HRIS-TIM", "tme_wfm_schedule_candidates", "status",
        ("SUBMITTED",), ("APPROVED", "REJECTED")),
    "internal.analytics.metric-projection.result.consume": (
        "HRIS.MODERN.PEOPLE_ANALYTICS", "HRIS-SYS", "sys_hris_metric_projection_requests", "state",
        ("REQUESTED", "RUNNING"), ("COMPLETED", "FAILED")),
    "internal.analytics.export.result.consume": (
        "HRIS.MODERN.PEOPLE_ANALYTICS", "HRIS-SYS", "sys_hris_analytics_export_receipts", "status",
        ("REQUESTED", "GENERATING"), ("COMPLETED", "FAILED")),
    "internal.analytics.export.expire": (
        "HRIS.MODERN.PEOPLE_ANALYTICS", "HRIS-SYS", "sys_hris_analytics_export_receipts", "status",
        ("COMPLETED",), ("EXPIRED",)),
    "internal.ai.assistance-result.consume": (
        "HRIS.MODERN.GOVERNED_AI", "HRIS-SYS", "sys_hris_ai_assistance_requests", "state",
        ("REQUESTED", "RUNNING"), ("PRODUCED", "FAILED")),
    "internal.ai.policy-evaluation-result.consume": (
        "HRIS.MODERN.GOVERNED_AI", "HRIS-SYS", "sys_hris_ai_evaluation_requests", "status",
        ("REQUESTED",), ("COMPLETED", "FAILED")),
}


def _handler_owner(handler_id: str) -> tuple[str, str, str, str]:
    try:
        capability, session, root, state_column, _, _ = HANDLER_RUNTIME[handler_id]
    except KeyError as exc:
        raise ValueError(f"handler owner is not explicit: {handler_id}") from exc
    return capability, session, root, state_column


def _non_listening_handler(handler_id: str, event_name: str) -> dict[str, Any]:
    (capability, session, root, state_column,
     pre_states, post_states) = HANDLER_RUNTIME[handler_id]
    event_operation = {
        "session": session, "capabilityId": capability,
        "authorizationCapability": "internal.owner-result.consume",
    }
    event = _event(event_name, event_operation, root, state_column,
                   pre_states, post_states)
    event["condition"] = "ALWAYS"
    # Handler correlation comes from the sealed inbox envelope, not a command receipt.
    for field in event["fields"]:
        if field["name"] == "correlationId":
            field.update({"sourceKind": "IMMUTABLE_OWNER_PROOF",
                          "source": INBOX_TABLE[session] + ".correlation_id"})
    result = {
        "handlerId": handler_id, "capabilityId": capability, "session": session,
        "trigger": {"kind": "SIGNED_OWNER_RESULT", "eventId": "handlerContext.eventId",
                    "requestPublicId": "handlerContext.requestPublicId",
                    "expectedRevision": "handlerContext.expectedRevision",
                    "outcome": "ownerResult.outcome",
                    "payloadDigest": "handlerContext.payloadDigest",
                    "signature": "handlerContext.ownerSignature"},
        "aggregateRoot": {"table": root, "publicIdColumn": "public_id",
                          "versionColumn": "aggregate_version", "stateColumn": state_column,
                          "preStates": list(pre_states),
                          "postStates": list(post_states)},
        "readsTables": [root],
        "writes": [{"action": "UPDATE_CAS", "table": root,
                    "role": "CONCURRENCY_ROOT", "assignments": {
                        state_column: "derived.capabilitySpecificPostState",
                        "aggregate_version": "LOCKED_PRE:aggregate_version+1",
                        "updated_at": "ownerClock.transactionNow",
                    }}],
        "idempotency": {
            "scope": "tenant+handler+eventId",
            "claimKey": "tenant+handler+eventId",
            "storedPayloadDigest": "handlerContext.payloadDigest",
            "sameDigest": "RETURN_SEALED_FIRST_RESULT_ZERO_WRITES",
            "differentDigest": "CONFLICT_ZERO_DOMAIN_ACK_OUTBOX_MUTATION",
            "claimOrder": "CLAIM_INBOX_BEFORE_DOMAIN_READ_OR_WRITE",
        },
        "orderedDml": [
            "CLAIM_INBOX first", "LOCK aggregate tenant+public_id+version",
            "VALIDATE signed owner result and exact subject/version/digest",
            "UPDATE_CAS domain", "COMPLETE_INBOX closed result/resultDigest/post identity+version",
            "APPEND_OUTBOX last",
        ],
        "rollback": {"rule": "ANY_STEP_FAULT_ROLLS_BACK_INBOX_DOMAIN_ACK_AND_OUTBOX"},
        "event": event,
    }
    if handler_id == "internal.workforceplan.simulation-result.consume":
        result["readsTables"] = [root, "ppl_wfp_scenarios"]
        result["writes"] = [{
            "action": "UPDATE_CAS", "table": root,
            "role": "MONOTONIC_SIMULATION_REQUEST_TERMINAL_CAS",
            "selector": (
                "tenant+request public_id+expected aggregate_version+state=REQUESTED; "
                "terminal rows are immutable and accept no later result"
            ),
            "assignments": {
                "state": "derived.simulationRequestPostState.COMPLETED_OR_FAILED",
                "aggregate_version": "LOCKED_PRE:aggregate_version+1",
                "result_public_id": "ownerResult.resultPublicId",
                "result_revision": "ownerResult.resultRevision",
                "result_receipt_public_id": "ownerResult.resultReceiptPublicId",
                "result_receipt_revision": "ownerResult.resultReceiptRevision",
                "result_schema_version": "ownerResult.resultSchemaVersion",
                "result_digest": "ownerResult.resultDigest",
                "completed_at": "ownerClock.transactionNow",
                "updated_at": "ownerClock.transactionNow",
            },
        }]
        result["event"]["condition"] = "POST_STATE=COMPLETED"
        result["additionalEvents"] = []
        for additional_name in NON_LISTENING_HANDLER_ADDITIONAL_EVENTS.get(handler_id, ()):
            additional = _event(
                additional_name, event_operation, root, state_column,
                pre_states, post_states,
            )
            additional["condition"] = "POST_STATE=FAILED"
            for field in additional["fields"]:
                if field["name"] == "correlationId":
                    field.update({
                        "sourceKind": "IMMUTABLE_OWNER_PROOF",
                        "source": INBOX_TABLE[session] + ".correlation_id",
                    })
            result["additionalEvents"].append(additional)
        for handler_event in [result["event"], *result["additionalEvents"]]:
            handler_event["fields"].extend([
                _event_field("scenarioId", "UUID", "PHYSICAL_POST_STATE", root + ".parent_public_id", entity="table:ppl_wfp_scenarios"),
                _event_field("simulationRequestId", "UUID", "PHYSICAL_POST_STATE", root + ".public_id", entity="table:" + root),
                _event_field("simulationRequestRevision", "BIGINT", "PHYSICAL_POST_STATE", root + ".aggregate_version"),
                _event_field("resultReceiptId", "UUID", "IMMUTABLE_OWNER_PROOF", root + ".result_receipt_public_id", entity="DWP.WorkforcePlanning.SimulationResultReceipt"),
                _event_field("resultReceiptRevision", "BIGINT", "IMMUTABLE_OWNER_PROOF", root + ".result_receipt_revision"),
                _event_field("resultSchemaVersion", "STRING", "IMMUTABLE_OWNER_PROOF", root + ".result_schema_version"),
                _event_field("resultDigest", "SHA256", "IMMUTABLE_OWNER_PROOF", root + ".result_digest"),
            ])
            handler_event["audience"]["fieldExposure"]["fields"] = [
                field["name"] for field in handler_event["fields"]
            ]
            handler_event["refetchContract"] = {
                "mode": "FORBIDDEN",
                "reason": (
                    "PAYLOAD_SUFFICIENT_MINIMUM_PRIVILEGE_NO_DEDICATED_"
                    "SIMULATION_REQUEST_DETAIL_QUERY"
                ),
                "payloadSufficiency": (
                    "CLOSED_DURABLE_EVENT_ALLOWLIST_INCLUDES_EXACT_SIMULATION_REQUEST_"
                    "REVISION_AND_SIGNED_RESULT_OWNER_PROOF"
                ),
                "aggregateLookup": "FORBIDDEN",
                "latestFallback": "FORBIDDEN",
                "resultOwnerContract": {
                    "requiredFields": list(WFP_RESULT_OWNER_REQUIRED_FIELDS),
                    "identity": WFP_RESULT_OWNER_IDENTITY,
                    "validation": WFP_RESULT_OWNER_VALIDATION,
                    "denyOnUnavailable": True,
                },
            }
    if handler_id == "internal.recruiting.offer.expire":
        result["writes"][0]["assignments"]["status"] = "CONSTANT:EXPIRED"
    elif handler_id == "internal.recruiting.hire-handoff.result.consume":
        result["readsTables"].extend(["ppl_rec_candidate_cases", "ppl_rec_offers"])
        result["writes"] = [
            {"action": "APPEND", "table": "ppl_rec_hire_handoff_receipts",
             "role": "IMMUTABLE_HIRE_HANDOFF_RESULT_PROOF", "assignments": {
                 "tenant_id": "handlerContext.tenantId",
                 "candidate_case_id": "LOCKED:ppl_rec_hire_requests.candidate_case_id",
                 "offer_id": "LOCKED:ppl_rec_hire_requests.offer_id",
                 "decision_revision": "LOCKED:ppl_rec_hire_requests.decision_receipt_revision",
                 "effective_date": "LOCKED:ppl_rec_hire_requests.effective_date",
                 "payload_digest": "handlerContext.payloadDigest",
                 "recorded_at": "ownerClock.transactionNow",
                 "worker_public_id": "ownerResult.workerPublicId",
                 "employment_public_id": "ownerResult.employmentPublicId",
                 "assignment_public_id": "ownerResult.assignmentPublicId",
                 "owner_aggregate_version": "ownerResult.aggregateVersion",
                 "owner_acknowledgement_id": "ownerResult.acknowledgementId",
                 "owner_result_outcome": "ownerResult.outcome",
                 "request_digest": "LOCKED:ppl_rec_hire_requests.request_digest",
             }},
            *result["writes"],
            {"action": "UPDATE_CAS", "table": "ppl_rec_candidate_cases",
             "role": "BUSINESS_AGGREGATE_ON_ACK", "condition": "ownerResult.outcome=ACKNOWLEDGED",
             "assignments": {"stage": "CONSTANT:HIRED",
                             "aggregate_version": "LOCKED_PRE:aggregate_version+1",
                             "updated_at": "ownerClock.transactionNow"}},
        ]
        result["writes"][1]["assignments"].update({
            "acknowledged_at": "ownerClock.transactionNow",
            "owner_acknowledgement_id": "ownerResult.acknowledgementId",
        })
    elif handler_id == "internal.benefits.life-event.expire":
        result["writes"][0]["assignments"]["status"] = "CONSTANT:EXPIRED"
    elif handler_id == "internal.benefits.provider-result.consume":
        result["readsTables"] = [root, "ppl_bnf_enrollments"]
        result["writes"] = [
            {"action": "APPEND", "table": "ppl_bnf_provider_receipts",
             "role": "IMMUTABLE_PROVIDER_RESULT_PROOF", "assignments": {
                 "tenant_id": "handlerContext.tenantId",
                 "benefit_enrollment_id": "LOCKED:ppl_bnf_enrollments.benefit_enrollment_id",
                 "provider_request_id": "LOCKED:ppl_bnf_provider_requests.record_id",
                 "connector_execution_id": "ownerResult.connectorExecutionId",
                 "provider_key": "ownerResult.providerKey",
                 "provider_reference": "ownerResult.providerReference",
                 "request_digest": "LOCKED:ppl_bnf_provider_requests.payload_digest",
                 "response_digest": "ownerResult.responseDigest",
                 "payload_digest": "handlerContext.payloadDigest",
                 "result_revision": "ownerResult.revision",
                 "outcome": "ownerResult.status", "recorded_at": "ownerClock.transactionNow",
             }},
            {"action": "UPDATE_CAS", "table": "ppl_bnf_provider_requests",
             "role": "ASYNC_REQUEST_ROOT", "assignments": {
                 "state": "derived.requestPostState", "result_public_id": "ownerResult.publicId",
                 "result_revision": "ownerResult.revision",
                 "completed_at": "ownerClock.transactionNow",
                 "aggregate_version": "LOCKED_PRE:aggregate_version+1",
             }},
            {"action": "UPDATE_CAS", "table": "ppl_bnf_enrollments",
             "role": "BUSINESS_AGGREGATE_OUTCOME", "assignments": {
                 "status": "derived.enrollmentPostState.ACTIVE_OR_REJECTED",
                 "aggregate_version": "LOCKED_PRE:aggregate_version+1",
                 "updated_at": "ownerClock.transactionNow",
             }},
        ]
    elif handler_id == "internal.hrservice.sla-milestone.consume":
        result["readsTables"] = ["ppl_hrs_cases"]
        result["writes"] = [
            {"action": "APPEND", "table": "ppl_hrs_sla_receipts",
             "role": "IMMUTABLE_SLA_MILESTONE_FACT", "assignments": {
                 "tenant_id": "handlerContext.tenantId",
                 "hr_case_id": "LOCKED:ppl_hrs_cases.hr_case_id",
                 "case_revision": "LOCKED:ppl_hrs_cases.aggregate_version",
                 "sla_policy_version_id": "ownerResult.slaPolicyVersionId",
                 "milestone": "ownerResult.milestone", "outcome": "ownerResult.outcome",
                 "elapsed_seconds": "ownerResult.elapsedSeconds",
                 "measured_at": "ownerResult.measuredAt",
                 "payload_digest": "handlerContext.payloadDigest",
             }},
        ]
        result["aggregateRoot"]["transitionKind"] = "APPEND_ONLY_OBSERVATION_NO_CASE_STATE_CHANGE"
    elif handler_id.startswith("internal.contingent.access-"):
        result["readsTables"].append("ppl_cwk_engagements")
        proof_table = (
            "ppl_cwk_access_expiry_receipts"
            if handler_id.endswith("access-expiry.initiate") else "ppl_cwk_access_receipts"
        )
        proof = {
            "action": "APPEND", "table": proof_table,
            "role": "IMMUTABLE_ACCESS_RESULT_OR_EXPIRY_PROOF", "assignments": {
                "tenant_id": "handlerContext.tenantId",
                ("contingent_engagement_id" if proof_table.endswith("expiry_receipts") else "engagement_public_id"):
                    ("LOCKED:ppl_cwk_engagements.contingent_engagement_id" if proof_table.endswith("expiry_receipts") else "LOCKED:ppl_cwk_access_requests.engagement_public_id"),
                ("access_request_id" if proof_table.endswith("expiry_receipts") else "access_request_public_id"):
                    ("LOCKED:ppl_cwk_access_requests.record_id" if proof_table.endswith("expiry_receipts") else "LOCKED:ppl_cwk_access_requests.public_id"),
                "grant_public_id": "ownerResult.grantPublicId",
                ("grant_revision" if proof_table.endswith("expiry_receipts") else "result_revision"):
                    "ownerResult.grantRevision",
                "outcome": "derived.accessOutcome",
                ("payload_digest" if proof_table.endswith("expiry_receipts") else "result_digest"):
                    "handlerContext.payloadDigest",
                "recorded_at": "ownerClock.transactionNow",
            }}
        if proof_table.endswith("expiry_receipts"):
            proof["assignments"]["receipt_digest"] = "SERVER_DERIVE:canonical signed access outcome"
        else:
            proof["assignments"].update({
                "parent_public_id": "LOCKED:ppl_cwk_access_requests.public_id",
                "parent_version": "LOCKED:ppl_cwk_access_requests.aggregate_version",
                "payload_digest": "handlerContext.payloadDigest",
                "reference_effective_at": "ownerClock.transactionNow",
                "state": "CONSTANT:COMPLETED",
            })
        result["writes"] = [proof, *result["writes"]]
        result["writes"][1]["assignments"].update({
            "result_public_id": "ownerResult.grantPublicId",
            "result_revision": "ownerResult.grantRevision",
            "completed_at": "ownerClock.transactionNow",
        })
        business_state = None
        if handler_id.endswith("access-grant-result.consume"):
            business_state = "ACTIVE"
        elif handler_id.endswith("access-revoke-result.consume"):
            business_state = "ENDED"
        elif handler_id.endswith("access-expiry.initiate"):
            business_state = "OFFBOARDING"
        if business_state:
            result["writes"].append({
                "action": "UPDATE_CAS", "table": "ppl_cwk_engagements",
                "role": "EXPLICIT_ENGAGEMENT_TRANSITION", "assignments": {
                    "status": "CONSTANT:" + business_state,
                    "aggregate_version": "LOCKED_PRE:aggregate_version+1",
                    "updated_at": "ownerClock.transactionNow",
                }})
    elif handler_id == "internal.wfm.schedule-optimization.result.consume":
        result["writes"][0]["assignments"].update({
            "result_public_id": "ownerResult.resultPublicId",
            "result_revision": "ownerResult.resultRevision",
            "completed_at": "ownerClock.transactionNow",
        })
        result["writes"].extend([
            {"action": "INSERT", "table": "tme_wfm_schedule_candidates",
             "role": "OPTIMIZATION_CANDIDATE", "condition": "ownerResult.outcome=COMPLETED",
             "assignments": {
                 "tenant_id": "handlerContext.tenantId", "public_id": "ownerResult.candidatePublicId",
                 "aggregate_version": "CONSTANT:1", "status": "CONSTANT:GENERATED",
                 "optimization_request_id": "LOCKED:tme_wfm_optimization_requests.optimization_request_id",
                 "demand_forecast_id": "LOCKED:tme_wfm_optimization_requests.demand_forecast_id",
                 "input_snapshot_id": "LOCKED:tme_wfm_optimization_requests.input_snapshot_id",
                 "availability_snapshot_id": "LOCKED:tme_wfm_optimization_requests.availability_snapshot_id",
                 "period_start": "LOCKED:tme_wfm_optimization_requests.period_start",
                 "period_end": "LOCKED:tme_wfm_optimization_requests.period_end",
                 "candidate_digest": "ownerResult.candidateDigest", "candidate_revision": "CONSTANT:1",
                 "constraint_policy_version": "LOCKED:tme_wfm_optimization_requests.rule_version",
                 "coverage_score": "ownerResult.coverageScore",
                 "shift_line_count": "ownerResult.shifts.count", "updated_at": "ownerClock.transactionNow",
             }},
            {"action": "APPEND", "table": "tme_wfm_schedule_candidate_versions",
             "role": "IMMUTABLE_CANDIDATE_VERSION", "condition": "ownerResult.outcome=COMPLETED",
             "assignments": {
                 "tenant_id": "handlerContext.tenantId", "public_id": "SERVER_ALLOCATE:UUID_V7_REPLAY_STABLE_FROM_EVENT_ID",
                 "aggregate_version": "CONSTANT:1", "parent_public_id": "ownerResult.candidatePublicId",
                 "parent_version": "CONSTANT:1", "fact_revision": "CONSTANT:1", "ordinal": "CONSTANT:1",
                 "state": "CONSTANT:CANDIDATE_GENERATED", "payload_digest": "ownerResult.candidateDigest",
                 "reference_effective_at": "ownerClock.transactionNow", "result_public_id": "ownerResult.resultPublicId",
                 "result_revision": "ownerResult.resultRevision", "completed_at": "ownerClock.transactionNow",
                 "candidate_public_id": "ownerResult.candidatePublicId",
                 "candidate_result_digest": "ownerResult.candidateDigest",
                 "optimizer_version_id": "ownerResult.optimizerVersionId",
             }},
            {"action": "APPEND_MANY", "table": "tme_wfm_candidate_shift_lines",
             "role": "TYPED_SHIFT_LINES", "condition": "ownerResult.outcome=COMPLETED",
             "assignments": {
                 "tenant_id": "handlerContext.tenantId", "public_id": "SERVER_ALLOCATE:UUID_V7_REPLAY_STABLE_FROM_EVENT_ID_AND_ORDINAL",
                 "aggregate_version": "CONSTANT:1", "schedule_candidate_id": "LOCKED_POST:tme_wfm_schedule_candidates.schedule_candidate_id",
                 "line_sequence": "ownerResult.shifts[*].ordinal", "line_key": "ownerResult.shifts[*].lineKey",
                 "worker_public_id": "ownerResult.shifts[*].workerPublicId", "assignment_public_id": "ownerResult.shifts[*].assignmentPublicId",
                 "worksite_public_id": "ownerResult.shifts[*].worksitePublicId", "position_public_id": "ownerResult.shifts[*].positionPublicId",
                 "demand_forecast_id": "LOCKED:tme_wfm_optimization_requests.demand_forecast_id", "demand_line_key": "ownerResult.shifts[*].demandLineKey",
                 "starts_at": "ownerResult.shifts[*].startsAt", "ends_at": "ownerResult.shifts[*].endsAt",
                 "local_work_date": "ownerResult.shifts[*].localWorkDate", "time_zone": "ownerResult.shifts[*].timeZone",
                 "tzdb_version": "ownerResult.shifts[*].tzdbVersion", "start_offset_seconds": "ownerResult.shifts[*].startOffsetSeconds",
                 "end_offset_seconds": "ownerResult.shifts[*].endOffsetSeconds", "break_duration_seconds": "ownerResult.shifts[*].breakDurationSeconds",
                 "planning_input_snapshot_id": "LOCKED:tme_wfm_optimization_requests.input_snapshot_id",
                 "required_skills": "ownerResult.shifts[*].typedSkillRequirements", "segments": "ownerResult.shifts[*].typedSegments",
                 "calendar_snapshot_ref": "ownerResult.shifts[*].calendarSnapshotRef", "work_rule_snapshot_ref": "ownerResult.shifts[*].workRuleSnapshotRef",
                 "line_digest": "SERVER_DERIVE:canonical shift line",
                 "candidate_version": "CONSTANT:1",
             }},
            {
            "action": "APPEND_MANY",
            "table": "tme_wfm_schedule_candidate_time_group_refs",
            "role": "TYPED_ORDERED_CHILD_REFERENCE",
            "assignments": {
                "tenant_id": "handlerContext.tenantId",
                "parent_public_id": "LOCKED_POST:tme_wfm_schedule_candidates.public_id",
                "ordinal": "ownerResult.timeGroups stable order",
                "time_group_public_id": "ownerResult.timeGroups[*].publicId",
            },
            "condition": "ownerResult.outcome=COMPLETED",
        }])
    elif handler_id == "internal.wfm.approval-result.consume":
        result["readsTables"].append("tme_wfm_approval_requests")
        result["writes"] = [
            {"action": "APPEND", "table": "tme_wfm_approval_receipts",
             "role": "IMMUTABLE_APPROVAL_RESULT_PROOF", "assignments": {
                 "tenant_id": "handlerContext.tenantId", "public_id": "ownerResult.receiptPublicId",
                 "aggregate_version": "CONSTANT:1", "schedule_candidate_public_id": "LOCKED:tme_wfm_schedule_candidates.public_id",
                 "candidate_revision": "LOCKED:tme_wfm_schedule_candidates.candidate_revision",
                 "decision_receipt_public_id": "ownerResult.decisionReceiptPublicId",
                 "decision_receipt_revision": "ownerResult.decisionReceiptRevision",
                 "outcome": "ownerResult.outcome", "result_digest": "handlerContext.payloadDigest",
                 "recorded_at": "ownerClock.transactionNow",
                 "parent_public_id": "LOCKED:tme_wfm_schedule_candidates.public_id",
                 "parent_version": "LOCKED:tme_wfm_schedule_candidates.aggregate_version",
                 "payload_digest": "handlerContext.payloadDigest",
                 "reference_effective_at": "ownerClock.transactionNow",
                 "state": "CONSTANT:COMPLETED",
             }},
            *result["writes"],
            {"action": "UPDATE_CAS", "table": "tme_wfm_approval_requests",
             "role": "ASYNC_APPROVAL_REQUEST", "assignments": {
                 "status": "derived.approvalRequestPostState.APPROVED_OR_DENIED",
                 "aggregate_version": "LOCKED_PRE:aggregate_version+1", "updated_at": "ownerClock.transactionNow",
             }},
        ]
    elif handler_id == "internal.analytics.metric-projection.result.consume":
        result["writes"] = [
            {"action": "APPEND", "table": "sys_hris_metric_projections",
             "role": "IMMUTABLE_THRESHOLD_SAFE_PROJECTION", "condition": "ownerResult.outcome=COMPLETED",
             "assignments": {
                 "tenant_id": "handlerContext.tenantId", "public_id": "ownerResult.projectionPublicId",
                 "aggregate_version": "CONSTANT:1", "metric_version_id": "LOCKED:sys_hris_metric_projection_requests.parent_version",
                 "projection_revision": "ownerResult.projectionRevision", "as_of": "LOCKED:sys_hris_metric_projection_requests.as_of",
                 "cohort_definition_id": "LOCKED:sys_hris_metric_projection_requests.cohort_definition_public_id",
                 "anonymity_threshold": "LOCKED:sys_hris_metric_projection_requests.anonymity_threshold",
                 "calculated_at": "ownerResult.calculatedAt", "subject_count": "ownerResult.subjectCount",
                 "payload_digest": "ownerResult.projectionDigest",
                 "projection_request_public_id": "LOCKED:sys_hris_metric_projection_requests.public_id",
                 "projection_values": "ownerResult.projectionValues",
                 "lineage_receipt_public_id": "ownerResult.lineageReceiptPublicId",
             }},
            *result["writes"],
        ]
        result["writes"][1]["assignments"].update({
            "result_public_id": "ownerResult.projectionPublicId",
            "result_revision": "ownerResult.projectionRevision",
            "completed_at": "ownerClock.transactionNow",
        })
    elif handler_id == "internal.analytics.export.result.consume":
        result["writes"][0]["assignments"].update({
            "object_ref": "ownerResult.objectRef", "object_schema_version": "ownerResult.objectSchemaVersion",
            "object_digest": "ownerResult.objectDigest", "row_count": "ownerResult.rowCount",
            "completed_at": "ownerClock.transactionNow",
        })
    elif handler_id == "internal.analytics.export.expire":
        result["writes"][0]["assignments"].update({
            "status": "CONSTANT:EXPIRED", "object_ref": "CONSTANT:REVOKED",
        })
    elif handler_id == "internal.growth.portability-export.result.consume":
        root_write = result["writes"][0]
        root_write["assignments"].update({
            "result_public_id": "ownerResult.publicId",
            "result_revision": "ownerResult.revision",
            "payload_digest": "handlerContext.payloadDigest",
            "object_ref": "ownerResult.objectRef",
            "object_digest": "ownerResult.objectDigest",
            "completed_at": "ownerResult.completedAt",
        })
        result_fields = (
            ("resultPublicId", "UUID", "result_public_id", "table:prf_grw_portability_export_receipts"),
            ("resultRevision", "BIGINT", "result_revision", None),
            ("payloadDigest", "SHA256", "payload_digest", None),
            ("completedAt", "TIMESTAMPTZ", "completed_at", None),
        )
        for name, field_type, column_name, entity in result_fields:
            result["event"]["fields"].append(_event_field(
                name, field_type, "PHYSICAL_POST_STATE", f"{root}.{column_name}",
                entity=entity,
            ))
            result["event"]["audience"]["fieldExposure"]["fields"].append(name)
    elif handler_id == "internal.ai.assistance-result.consume":
        result["readsTables"].append("sys_hris_ai_provenance_receipts")
        result["writes"].insert(0, {
            "action": "APPEND",
            "table": "sys_hris_ai_provenance_receipts",
            "role": "IMMUTABLE_AI_ASSISTANCE_RESULT_PROOF",
            "assignments": {
                "tenant_id": "handlerContext.tenantId",
                "public_id": "SERVER_ALLOCATE:UUID_V7_REPLAY_STABLE_FROM_EVENT_ID",
                "aggregate_version": "CONSTANT:1",
                "created_by": "handlerPrincipal.publicId",
                "correlation_id": "sys_hris_domain_inbox_receipts.correlation_id",
                "assistance_request_id": "LOCKED:sys_hris_ai_assistance_requests.record_id",
                "model_version_id": "ownerResult.modelVersionId",
                "prompt_template_version_id": "ownerResult.promptTemplateVersionId",
                "dataset_manifest_version_id": "ownerResult.datasetManifestVersionId",
                "evaluation_protocol_version_id": "ownerResult.evaluationProtocolVersionId",
                "governance_activation_receipt_id": (
                    "LOCKED:sys_hris_ai_assistance_requests.governance_activation_receipt_id"
                ),
                "affected_person_disclosure_evidence_id": (
                    "LOCKED:sys_hris_ai_assistance_requests.affected_person_disclosure_evidence_id"
                ),
                "output_digest": "ownerResult.responseDigest",
                "generated_at": "ownerResult.producedAt",
                "input_digest": "LOCKED:sys_hris_ai_assistance_requests.request_digest",
                "payload_digest": "handlerContext.payloadDigest",
                "policy_version": "LOCKED:sys_hris_ai_assistance_requests.parent_version",
                "requester_principal_id": "LOCKED:sys_hris_ai_assistance_requests.created_by",
                "use_case_key": "LOCKED:sys_hris_ai_assistance_requests.use_case_key",
                "human_confirmation_required": "ownerResult.humanConfirmationRequired",
                "raw_prompt_stored": "CONSTANT:FALSE",
                "status": "CONSTANT:PRODUCED",
            },
        })
        proof_fields = (
            ("provenanceReceiptId", "UUID", "public_id", "table:sys_hris_ai_provenance_receipts"),
            ("modelVersionId", "UUID", "model_version_id", "DWP.AIGovernance.ModelVersion"),
            ("promptTemplateVersionId", "UUID", "prompt_template_version_id", "DWP.AIGovernance.PromptTemplateVersion"),
            ("datasetManifestVersionId", "UUID", "dataset_manifest_version_id", "DWP.AIGovernance.DatasetManifestVersion"),
            ("evaluationProtocolVersionId", "UUID", "evaluation_protocol_version_id", "DWP.AIGovernance.EvaluationProtocolVersion"),
            ("activationReceiptId", "UUID", "governance_activation_receipt_id", "DWP.AIGovernance.ActivationReceipt"),
            ("affectedPersonDisclosureEvidenceId", "UUID", "affected_person_disclosure_evidence_id", "DWP.AIGovernance.AffectedPersonDisclosureEvidence"),
            ("responseDigest", "SHA256", "output_digest", None),
            ("producedAt", "TIMESTAMPTZ", "generated_at", None),
        )
        for name, field_type, column_name, entity in proof_fields:
            result["event"]["fields"].append(_event_field(
                name, field_type, "IMMUTABLE_OWNER_PROOF",
                f"sys_hris_ai_provenance_receipts.{column_name}", entity=entity,
            ))
            result["event"]["audience"]["fieldExposure"]["fields"].append(name)
    elif handler_id == "internal.ai.policy-evaluation-result.consume":
        result["writes"] = [
            {"action": "APPEND", "table": "sys_hris_ai_evaluation_receipts",
             "role": "IMMUTABLE_AI_EVALUATION_RESULT_PROOF", "assignments": {
                 "tenant_id": "handlerContext.tenantId", "public_id": "ownerResult.evaluationReceiptPublicId",
                 "aggregate_version": "CONSTANT:1",
                 "ai_evaluation_request_id": "LOCKED:sys_hris_ai_evaluation_requests.ai_evaluation_request_id",
                 "ai_policy_version_id": "LOCKED:sys_hris_ai_evaluation_requests.ai_policy_version_id",
                 "evaluation_revision": "ownerResult.evaluationRevision",
                 "evaluation_suite_version_id": "ownerResult.evaluationSuiteVersionId",
                 "evaluation_outcome": "ownerResult.outcome", "blocking_failure_count": "ownerResult.blockingFailureCount",
                 "evaluated_at": "ownerResult.evaluatedAt", "result_digest": "ownerResult.resultDigest",
                 "payload_digest": "handlerContext.payloadDigest",
             }},
            *result["writes"],
        ]
    if handler_id in {
        "internal.contingent.access-grant-result.consume",
        "internal.contingent.access-revoke-result.consume",
        "internal.contingent.access-expiry.initiate",
    }:
        lifecycle_state = {
            "internal.contingent.access-grant-result.consume": "ACTIVE",
            "internal.contingent.access-revoke-result.consume": "ENDED",
            "internal.contingent.access-expiry.initiate": "OFFBOARDING",
        }[handler_id]
        version_table = "ppl_cwk_engagement_versions"
        if version_table not in result["readsTables"]:
            result["readsTables"].append(version_table)
        engagement_root_write = next(
            write for write in result["writes"]
            if write.get("table") == "ppl_cwk_engagements"
            and write.get("action") == "UPDATE_CAS"
        )
        engagement_root_write["condition"] = "OWNER_RESULT_OR_EXPIRY_TRANSITION_APPLIES"
        engagement_root_write["selector"] = (
            "tenant+engagement public identity+locked aggregate_version If-Match+"
            "exact handler pre-state; same eventId+payloadDigest sealed replay is zero-write"
        )
        engagement_root_write["expectedRows"] = (
            "EXACTLY_ONE_IF_TRANSITION_APPLIES;ZERO_ON_SEALED_REPLAY_OR_STALE_VERSION"
        )
        engagement_root_write["failureInjectionAssertion"] = (
            "HANDLER_ROOT_CAS_VERSION_APPEND_RECEIPT_AND_OUTBOX_ROLL_BACK_TOGETHER"
        )
        engagement_root_write.setdefault("assignments", {})["aggregate_version"] = (
            "LOCKED_PRE:ppl_cwk_engagements.aggregate_version+1"
        )
        result["writes"].append({
            "action": "APPEND", "table": version_table,
            "role": "IMMUTABLE_HANDLER_LIFECYCLE_VERSION",
            "selector": (
                "tenant+locked engagement root If-Match+global max root_version row, then that "
                "row's effective_segment_public_id and maximum segment_revision under the same lock; "
                "same event and digest returns the sealed first row"
            ),
            "assignments": {
                "tenant_id": "handlerContext.tenantId",
                "public_id": "SERVER_ALLOCATE:UUID_V7_REPLAY_STABLE_FROM_EVENT_ID",
                "aggregate_version": "CONSTANT:1",
                "contingent_engagement_id": "LOCKED_PRE:ppl_cwk_engagements.contingent_engagement_id",
                "engagement_public_id": "LOCKED_PRE:ppl_cwk_engagements.public_id",
                "version_no": "LOCKED_PRE:ppl_cwk_engagements.aggregate_version+1",
                "parent_public_id": "LOCKED_PRE:ppl_cwk_engagements.public_id",
                "parent_version": "LOCKED_PRE:ppl_cwk_engagements.aggregate_version+1",
                "fact_revision": "LOCKED_PRE:ppl_cwk_engagements.aggregate_version+1",
                "ordinal": "LOCKED_PRE:ppl_cwk_engagements.aggregate_version+1",
                "state": "CONSTANT:" + lifecycle_state,
                "payload_digest": "SERVER_DERIVE:handler result+lifecycle+copied content identity",
                "reference_effective_at": "ownerClock.transactionNow",
                "revision_mode": "CONSTANT:LIFECYCLE",
                "root_version": "LOCKED_PRE:ppl_cwk_engagements.aggregate_version+1",
                "root_predecessor_public_id": "LOCKED_GLOBAL_TIP:ppl_cwk_engagement_versions.public_id",
                "root_predecessor_version": "LOCKED_PRE:ppl_cwk_engagements.aggregate_version",
                "effective_segment_public_id": "LOCKED_GLOBAL_TIP_SEGMENT_TIP:ppl_cwk_engagement_versions.effective_segment_public_id",
                "segment_revision": "LOCKED_GLOBAL_TIP_SEGMENT_TIP:ppl_cwk_engagement_versions.segment_revision+1",
                "segment_predecessor_public_id": "LOCKED_GLOBAL_TIP_SEGMENT_TIP:ppl_cwk_engagement_versions.public_id",
                "segment_predecessor_revision": "LOCKED_GLOBAL_TIP_SEGMENT_TIP:ppl_cwk_engagement_versions.segment_revision",
                "content_revision_public_id": "LOCKED_GLOBAL_TIP_SEGMENT_TIP:ppl_cwk_engagement_versions.content_revision_public_id",
                "effective_from": "LOCKED_GLOBAL_TIP_SEGMENT_TIP:ppl_cwk_engagement_versions.effective_from",
                "effective_to": "CONSTANT:NULL",
                "correction_reason_code": "CONSTANT:LIFECYCLE_" + lifecycle_state,
                "changed_fields": "SERVER_DERIVE:typed owner-result lifecycle change",
                "classification_policy_version_id": "LOCKED_GLOBAL_TIP_SEGMENT_CONTENT_ROW:ppl_cwk_engagement_versions.classification_policy_version_id",
                "access_package_public_id": "LOCKED_GLOBAL_TIP_SEGMENT_CONTENT_ROW:ppl_cwk_engagement_versions.access_package_public_id",
                "worker_public_id": "LOCKED_GLOBAL_TIP_SEGMENT_CONTENT_ROW:ppl_cwk_engagement_versions.worker_public_id",
                "vendor_public_id": "LOCKED_GLOBAL_TIP_SEGMENT_CONTENT_ROW:ppl_cwk_engagement_versions.vendor_public_id",
                "sponsor_worker_public_id": "LOCKED_GLOBAL_TIP_SEGMENT_CONTENT_ROW:ppl_cwk_engagement_versions.sponsor_worker_public_id",
                "classification_code": "LOCKED_GLOBAL_TIP_SEGMENT_CONTENT_ROW:ppl_cwk_engagement_versions.classification_code",
            },
            "expectedRows": "EXACTLY_ONE_IF_ENGAGEMENT_ROOT_CAS_WINS",
            "condition": "OWNER_RESULT_OR_EXPIRY_TRANSITION_APPLIES",
            "failureInjectionAssertion": (
                "HANDLER_ROOT_CAS_VERSION_APPEND_RECEIPT_AND_OUTBOX_ROLL_BACK_TOGETHER"
            ),
            "handlerLifecycleBinding": {
                "rootTable": "ppl_cwk_engagements",
                "rootAction": "UPDATE_CAS",
                "rootExpectedRows": (
                    "EXACTLY_ONE_IF_TRANSITION_APPLIES;"
                    "ZERO_ON_SEALED_REPLAY_OR_STALE_VERSION"
                ),
                "versionExpectedRows": "EXACTLY_ONE_IF_ENGAGEMENT_ROOT_CAS_WINS",
                "sameCondition": "OWNER_RESULT_OR_EXPIRY_TRANSITION_APPLIES",
                "sameTransaction": True,
                "postRootVersionEqualsAppendedRootVersion": True,
                "preRootVersionEqualsAppendedPredecessorVersion": True,
                "atomicity": TEMPORAL_ROOT_VERSION_ATOMICITY,
                "rollback": "ANY_HANDLER_ROOT_OR_VERSION_OR_CONTROL_FAILURE_ROLLS_BACK_ALL",
            },
        })
        event = result["event"]
        event["aggregateEntityType"] = "table:ppl_cwk_engagements"
        fields = {field["name"]: field for field in event["fields"]}
        for name, source, source_kind in (
            ("aggregateId", "ppl_cwk_engagements.public_id", "PHYSICAL_POST_STATE"),
            ("aggregateVersion", "ppl_cwk_engagements.aggregate_version", "PHYSICAL_POST_STATE"),
            ("fromState", "LOCKED_PRE:ppl_cwk_engagements.status", "LOCKED_PRE_STATE"),
            ("toState", "ppl_cwk_engagements.status", "PHYSICAL_POST_STATE"),
        ):
            if name in fields:
                fields[name].update({"source": source, "sourceKind": source_kind})
        for name, field_type, column, entity in (
            ("revisionPublicId", "UUID", "public_id", "table:ppl_cwk_engagement_versions"),
            ("stateRevisionPublicId", "UUID", "public_id", "table:ppl_cwk_engagement_versions"),
            ("contentRevisionPublicId", "UUID", "content_revision_public_id", "table:ppl_cwk_engagement_versions"),
            ("rootVersion", "BIGINT", "root_version", None),
            ("effectiveSegmentPublicId", "UUID", "effective_segment_public_id", "DWP.EffectiveTime.Segment"),
            ("segmentRevision", "BIGINT", "segment_revision", None),
            ("revisionMode", "STRING", "revision_mode", None),
            ("effectiveFrom", "DATE", "effective_from", None),
            ("segmentPredecessorPublicId", "UUID", "segment_predecessor_public_id", "table:ppl_cwk_engagement_versions"),
            ("segmentPredecessorRevision", "BIGINT", "segment_predecessor_revision", None),
        ):
            if name not in fields:
                event["fields"].append(_event_field(
                    name, field_type, "PHYSICAL_POST_STATE", version_table + "." + column,
                    entity=entity,
                ))
        event["audience"]["fieldExposure"]["fields"] = [
            field["name"] for field in event["fields"]
        ]
        event["refetchContract"] = _temporal_event_refetch_contract(
            version_table="ppl_cwk_engagement_versions",
            root_table="ppl_cwk_engagements",
            owner_session="HRIS-HRM",
            purpose="hcm.contingent.operate",
            event=event,
        )
    if handler_id == "internal.wfm.schedule-optimization.result.consume":
        for write in result["writes"]:
            if write.get("table") in {
                "tme_wfm_schedule_candidate_versions",
                "tme_wfm_schedule_candidate_time_group_refs",
            }:
                write.setdefault("assignments", {})["schedule_candidate_id"] = (
                    "LOCKED_POST:tme_wfm_schedule_candidates.schedule_candidate_id"
                )
    elif handler_id == "internal.wfm.approval-result.consume":
        for write in result["writes"]:
            if write.get("table") == "tme_wfm_approval_receipts":
                write.setdefault("assignments", {})["schedule_candidate_id"] = (
                    "LOCKED:tme_wfm_schedule_candidates.schedule_candidate_id"
                )
    result["handlerContract"] = {
        "stateMachine": "CAPABILITY_SPECIFIC_NO_GENERIC_REQUESTED_RUNNING_TEMPLATE",
        "preStates": list(pre_states), "postStates": list(post_states),
        "signedResultFields": ["requestPublicId", "expectedRevision", "outcome", "payloadDigest"],
        "sameTransaction": "CLAIM_LOCK_PROOF_DOMAIN_ACK_OUTBOX",
        "compensation": "OWNER_RETRY_WITH_SAME_EVENT_ID_AND_DIGEST_RETURNS_SEALED_RESULT",
    }
    if handler_id in {
        "internal.contingent.access-grant-result.consume",
        "internal.contingent.access-revoke-result.consume",
        "internal.contingent.access-expiry.initiate",
    }:
        result["handlerContract"]["lifecycleSegmentSelection"] = (
            "lock global max root_version row, follow its effective_segment_public_id, then lock "
            "the maximum segment_revision in that segment; never recompute business-current by clock"
        )
    for write in result["writes"]:
        if write.get("action") not in {"APPEND", "APPEND_MANY", "INSERT", "INSERT_MANY"}:
            continue
        write.setdefault("assignments", {}).setdefault(
            "created_by", "handlerPrincipal.publicId"
        )
        write["assignments"].setdefault(
            "correlation_id", INBOX_TABLE[session] + ".correlation_id"
        )
    result["writeDispositions"] = {
        row["table"]: row["action"] for row in result["writes"]
    }
    return result


def _listening_handlers() -> list[dict[str, Any]]:
    design = build_static_design()
    message_contracts = {
        row["messageName"]: row
        for row in design["eventOwnership"]["internalPortMessages"]
    }
    cohort_event = next(
        row["eventName"] for row in design["eventOwnership"]["canonicalPublicEvents"]
        if row["eventName"] == "EmployeeListeningCohortProjectionPublished.v1"
    )
    rows: list[dict[str, Any]] = []
    for source in design["ownerLocalHandlers"]:
        row = copy.deepcopy(source)
        row["capabilityId"] = "HRIS.MODERN.EMPLOYEE_LISTENING"
        row["session"] = "HRIS-SYS"
        row["structuredTransaction"] = {
            "stepOrder": "CLAIM_INBOX_FIRST_DOMAIN_CAS_CLOSED_ACK_OUTBOX_LAST",
            "sameTransaction": True,
            "sameEventSameDigest": "RETURN_SEALED_FIRST_RESULT_ZERO_WRITES",
            "sameEventDifferentDigest": "QUARANTINE_ZERO_DOMAIN_ACK_OUTBOX_WRITES",
            "faultInjection": "ANY_STEP_ROLLS_BACK_INBOX_DOMAIN_ACK_OUTBOX",
        }
        message = message_contracts.get(row.get("messageName"))
        if message:
            row["sourceStreamKey"] = message["from"]
            row["targetStreamKey"] = message["to"]
            row["signatureAuthority"] = (
                "ACTIVE_SIGNING_KEY_FOR:" + message["from"] + ";EXACT_MESSAGE_SCHEMA_AND_DIGEST"
            )
            row["requestContract"] = {
                "additionalProperties": False,
                "messageId": "REQUIRED_UUID",
                "payloadDigest": "REQUIRED_SHA256",
                "signingKeyId": "REQUIRED_ACTIVE_SOURCE_STREAM_KEY_ID",
                "signatureAlgorithm": "REQUIRED_ED25519_OR_ECDSA_P256_SHA256_MAX_17",
                "ownerSignature": (
                    "REQUIRED_BASE64URL_UNPADDED_P1363_FIXED_64_BYTE_SIGNATURE_MAX_86"
                ),
                **{
                    field: (
                        "REQUIRED_UUID" if field.endswith(("PublicId", "Id"))
                        else "REQUIRED_SHA256" if field.endswith("Sha256")
                        else "REQUIRED_TIMESTAMPTZ" if field.endswith(("At", "Epoch"))
                        else "REQUIRED_POSITIVE_INTEGER" if field.endswith(("Revision", "Version"))
                        else "REQUIRED_STRING"
                    )
                    for field in message["fieldAllowlist"]
                },
            }
            exact_message_types = {
                "formArtifactSchemaVersion": "REQUIRED_CLOSED_SCHEMA_VERSION",
                "formArtifactDigest": "REQUIRED_SHA256",
                "questionDefinitions": "REQUIRED_CLOSED_ARRAY<ListeningQuestionDefinition.v1>",
                "eraseAfter": "REQUIRED_TIMESTAMPTZ",
                "measureSchemaVersion": "REQUIRED_CLOSED_SCHEMA_VERSION",
                "measureValues": "CONDITIONAL_CLOSED_ARRAY<ListeningMeasureValue.v1>",
                "subjectCount": "CONDITIONAL_NONNEGATIVE_INTEGER_ADEQUATE_ONLY",
                "anonymityThreshold": "REQUIRED_INTEGER_AT_LEAST_CONFIGURED_MINIMUM",
                "epsilonMicros": "REQUIRED_POSITIVE_BIGINT_MICRO_UNITS",
                "privacyBudgetCapEpsilonMicros": "REQUIRED_BIGINT_NOT_LESS_THAN_EPSILON_MICROS",
                "measureDefinitionDigest": "REQUIRED_SHA256",
            }
            row["requestContract"].update({
                field: exact_message_types[field]
                for field in message["fieldAllowlist"] if field in exact_message_types
            })
            if row["messageName"] == "ListeningCohortPackageReady.v1":
                row["requestContract"].update({
                    "policyRevision": "REQUIRED_POSITIVE_INTEGER",
                    "measureSchemaVersion": "REQUIRED_CLOSED_SCHEMA_VERSION",
                    "measureValues": "REQUIRED_IFF_ADEQUATE;FORBIDDEN_IFF_SUPPRESSED;CLOSED_ARRAY<ListeningMeasureValue.v1>",
                    "subjectCount": "REQUIRED_IFF_ADEQUATE;FORBIDDEN_IFF_SUPPRESSED;NONNEGATIVE_INTEGER",
                    "anonymityThreshold": "REQUIRED_INTEGER_AT_LEAST_CONFIGURED_MINIMUM",
                    "privacyBudgetReceiptPublicId": "REQUIRED_UUID",
                    "adequacyCategory": "REQUIRED_ADEQUATE_OR_SUPPRESSED",
                })
        else:
            row.setdefault("requestContract", {
                "additionalProperties": False,
                "messageId": "REQUIRED_UUID", "payloadDigest": "REQUIRED_SHA256",
                "expectedOwnerRevision": "REQUIRED_POSITIVE_INTEGER",
                "outcome": "REQUIRED_HANDLER_SPECIFIC_ENUM",
                "ownerSignature": (
                    "REQUIRED_BASE64URL_UNPADDED_P1363_FIXED_64_BYTE_SIGNATURE_MAX_86"
                ),
            })
        row.setdefault("idempotencyRule",
                       "SAME_MESSAGE_ID_AND_DIGEST_RETURNS_SEALED_FIRST_RESULT;DIFFERENT_DIGEST_CONFLICTS_ZERO_WRITES")
        row.setdefault("identityBoundary",
                       "NO_AUTHENTICATED_PRINCIPAL_WORKER_OR_RESPONSE_TOKEN_CROSSES_OWNER_STREAM")
        row.setdefault("transactionBoundary", "INBOX_DOMAIN_ACK_OUTBOX_ATOMIC")
        row.setdefault("implementationState", "NOT_STARTED_G3")
        domain_writes = [{
            "action": "APPEND", "table": table, "role": "LISTENING_OWNER_TYPED_FACT",
            "assignments": {
                "tenant_id": "signedMessage.tenantPublicId resolved to local tenant_id",
                "public_id": "SERVER_ALLOCATE:UNLINKABLE_UUID_V7",
                "aggregate_version": "CONSTANT:1", "created_by": "LISTENING_OWNER_SERVICE_PRINCIPAL",
                "correlation_id": "SERVER_ALLOCATE:UNLINKABLE_OWNER_TRACE",
            },
            "expectedRows": "EXACTLY_ONE_FOR_NEW_INBOX_CLAIM_ZERO_ON_SEALED_REPLAY",
        } for table in row.get("domainWriteTables", [])]
        if row["handlerId"] == "internal.listening.protected.cohort-package.build":
            row["selectors"] = [{
                "selectorType": "PROTECTED_LOCAL_LATEST_CLOSED_ADMISSION_AND_POLICY_FENCE",
                "entityType": "table:sys_hris_listening_admission_versions",
                "idSpace": "PUBLIC_UUID",
                "source": "schedulerRequest.admissionPublicId",
                "sourceType": "UUID",
                "targetTable": "sys_hris_listening_admission_versions",
                "targetColumn": "admission_public_id",
                "targetSqlType": "UUID",
                "operator": "EQUALS",
                "cardinality": "EXACTLY_ONE_LATEST_OWNER_REVISION",
                "tenantFilter": "target.tenant_id=owner-local resolution of schedulerRequest.tenantPublicId",
                "purposeFilter": "LISTENING_COHORT_BUILD_PROTECTED",
                "versionRule": (
                    "target.public_id=schedulerRequest.admissionVersionPublicId AND "
                    "target.owner_revision=schedulerRequest.admissionOwnerVersion AND target.state=CLOSED"
                ),
                "asOfRule": (
                    "schedulerRequest.sourceEpoch<=schedulerRequest.cutoffAt<=target.closes_at"
                ),
                "causalJoin": (
                    "target.survey_public_id=schedulerRequest.surveyPublicId; "
                    "target.privacy_revision=schedulerRequest.policyRevision; "
                    "target.measure_schema_version=schedulerRequest.measureSchemaVersion"
                ),
                "failure": "404_OR_409_ZERO_BUDGET_PACKAGE_RECEIPT_OUTBOX_MUTATION",
            }]
            row["aggregateRoot"] = {
                "entityType": "table:sys_hris_listening_cohort_packages",
                "table": "sys_hris_listening_cohort_packages", "publicIdColumn": "public_id",
                "versionColumn": "owner_revision", "stateColumn": "state",
            }
            row["writes"] = [
                {"action": "LOCK_FOR_UPDATE", "table": "sys_hris_listening_admission_versions",
                 "role": "LATEST_CLOSED_STABLE_ADMISSION_FENCE",
                 "selector": (
                     "tenant+stable admission max owner_revision; exact admissionVersionPublicId+"
                     "ownerVersion+CLOSED+survey; scheduler policyRevision and measureSchemaVersion "
                     "must equal the locked immutable admission snapshot; sourceEpoch<=cutoff<=admission close"
                 ), "assignments": {}, "expectedRows": "EXACTLY_ONE"},
                {"action": "CLAIM_OR_REPLAY", "table": "sys_hris_listening_cohort_budgets",
                 "role": "PRIVACY_BUDGET_AND_IDEMPOTENCY_CLAIM",
                 "selector": (
                     "tenant+admissionVersion+policy+sourceEpoch+cutoff+measureSchema+"
                     "measureDefinitionDigest canonical release key EXCLUDING caller idempotency; "
                     "same scope always returns the sealed release/noise, fresh idempotency never spends twice; "
                     "lock latest admission budget release and enforce cumulative epsilon <= locked policy cap"
                 ),
                 "assignments": {
                     "tenant_id": "schedulerRequest.tenantPublicId resolved owner-locally",
                     "public_id": "SERVER_ALLOCATE:UUID_V7_REPLAY_STABLE", "aggregate_version": "CONSTANT:1",
                     "created_by": "PROTECTED_COHORT_SCHEDULER_PRINCIPAL",
                     "correlation_id": "SERVER_ALLOCATE:UNLINKABLE_OWNER_TRACE",
                     "listening_admission_version_id": "LOCKED_ADMISSION.record_id",
                     "survey_public_id": "LOCKED_ADMISSION.survey_public_id",
                     "admission_public_id": "LOCKED_ADMISSION.admission_public_id",
                     "policy_revision": "LOCKED_ADMISSION.privacy_revision",
                     "source_epoch": "schedulerRequest.sourceEpoch", "cutoff_at": "schedulerRequest.cutoffAt",
                     "measure_schema_version": "LOCKED_ADMISSION.measure_schema_version",
                     "measure_definition_digest": "LOCKED_ADMISSION.measure_definition_digest",
                     "anonymity_threshold": "LOCKED_ADMISSION.anonymity_threshold",
                     "epsilon_micros": "LOCKED_ADMISSION.epsilon_micros",
                     "budget_receipt_public_id": "SERVER_REUSE:cohort budget public_id as immutable local receipt",
                     "release_sequence": "SERVER_ALLOCATE:NEXT_LOCKED_ADMISSION_BUDGET_SEQUENCE",
                     "cumulative_epsilon_micros": (
                         "LOCKED_PREVIOUS_BUDGET.cumulative_epsilon_micros+LOCKED_ADMISSION.epsilon_micros "
                         "OR LOCKED_ADMISSION.epsilon_micros; REQUIRE <=LOCKED_ADMISSION.privacy_budget_cap_epsilon_micros"
                     ),
                     "noise_seed_digest": "OWNER_KDF_DIGEST:canonical release scope+active protected DP key version",
                     "idempotency_key": "schedulerRequest.idempotencyKey",
                     "request_digest": "SERVER_DERIVE:canonical cohort build request",
                     "state": "CONSTANT:CLAIMED", "owner_revision": "CONSTANT:1",
                     "payload_digest": "SERVER_DERIVE:canonical budget claim",
                     "reference_effective_at": "schedulerRequest.cutoffAt",
                 }, "expectedRows": "ONE_NEW_OR_SEALED_SAME_DIGEST_REPLAY"},
                {"action": "APPEND", "table": "sys_hris_listening_cohort_packages",
                 "role": "PRIVACY_SAFE_COHORT_PACKAGE_OR_SUPPRESSION",
                 "selector": (
                     "repeatable owner snapshot at sourceEpoch; eligible responses submitted_at<=cutoff; "
                     "exclude any REQUESTED|CLAIMED|FAILED_RETRYABLE|COMPLETED erasure effective by cutoff "
                     "and all late rows; aggregate only after budget claim"
                 ), "assignments": {
                     "tenant_id": "LOCKED_ADMISSION.tenant_id", "public_id": "SERVER_ALLOCATE:UUID_V7_REPLAY_STABLE",
                     "aggregate_version": "CONSTANT:1", "created_by": "PROTECTED_COHORT_SCHEDULER_PRINCIPAL",
                     "correlation_id": "BUDGET_CLAIM.correlation_id",
                     "listening_cohort_budget_id": "BUDGET_CLAIM.record_id",
                     "projection_public_id": "CONSTANT:NULL", "projection_version": "CONSTANT:NULL",
                     "receipt_public_id": "CONSTANT:NULL", "survey_public_id": "LOCKED_ADMISSION.survey_public_id",
                     "admission_public_id": "LOCKED_ADMISSION.admission_public_id",
                     "policy_revision": "LOCKED_ADMISSION.privacy_revision",
                     "source_epoch": "schedulerRequest.sourceEpoch", "cutoff_at": "schedulerRequest.cutoffAt",
                     "measure_schema_version": "LOCKED_ADMISSION.measure_schema_version",
                     "measure_definition_digest": "LOCKED_ADMISSION.measure_definition_digest",
                     "measure_values": (
                         "SERVER_DERIVE:closed typed DP measureValues ordered by ordinal IF eligibleSubjectCount>=threshold "
                         "ELSE CONSTANT:NULL"
                     ),
                     "subject_count": "SERVER_DERIVE:eligible non-erased subject count",
                     "anonymity_threshold": "BUDGET_CLAIM.anonymity_threshold",
                     "privacy_budget_receipt_public_id": "BUDGET_CLAIM.budget_receipt_public_id",
                     "package_sha256": (
                         "SERVER_DERIVE:canonical outbound privacy-safe package projection; "
                         "SUPPRESSED omits exact subjectCount and measureValues and digest input never includes either"
                     ),
                     "adequacy_category": "SERVER_DERIVE:ADEQUATE IF count>=threshold ELSE SUPPRESSED",
                     "state": "SERVER_DERIVE:READY IF count>=threshold ELSE SUPPRESSED",
                     "owner_revision": "CONSTANT:1",
                     "payload_digest": "SERVER_REUSE:package_sha256 privacy-safe outbound projection digest",
                     "reference_effective_at": "schedulerRequest.cutoffAt",
                 }, "expectedRows": "EXACTLY_ONE_NEW_PACKAGE_OR_SUPPRESSION"},
                {"action": "APPEND", "table": "sys_hris_listening_protected_receipts",
                 "role": "SEALED_COHORT_BUILD_RECEIPT", "assignments": {
                     "tenant_id": "LOCKED_ADMISSION.tenant_id", "public_id": "SERVER_ALLOCATE:UUID_V7_REPLAY_STABLE",
                     "aggregate_version": "CONSTANT:1", "created_by": "PROTECTED_COHORT_SCHEDULER_PRINCIPAL",
                     "correlation_id": "BUDGET_CLAIM.correlation_id", "listening_response_id": "CONSTANT:NULL",
                     "receipt_kind": "CONSTANT:COHORT_BUILD", "request_digest": "BUDGET_CLAIM.request_digest",
                     "cohort_package_public_id": "PREVIOUS:cohort_package.public_id",
                     "state": "CONSTANT:COMPLETED", "owner_revision": "CONSTANT:1",
                     "payload_digest": "PREVIOUS:cohort_package.package_sha256",
                     "result_digest": "PREVIOUS:cohort_package.package_sha256",
                     "reference_effective_at": "schedulerRequest.cutoffAt",
                     "completed_at": "ownerClock.transactionNow",
                 }, "expectedRows": "EXACTLY_ONE_FOR_NEW_PACKAGE"},
                {"action": "APPEND", "table": "sys_hris_listening_protected_outbox",
                 "role": "SIGNED_COHORT_PACKAGE_READY_OUTBOX", "assignments": {
                     "tenant_id": "LOCKED_ADMISSION.tenant_id", "public_id": "SERVER_ALLOCATE:UUID_V7_REPLAY_STABLE",
                     "aggregate_version": "CONSTANT:1", "created_by": "PROTECTED_COHORT_SCHEDULER_PRINCIPAL",
                     "correlation_id": "BUDGET_CLAIM.correlation_id", "state": "CONSTANT:PENDING",
                     "owner_revision": "CONSTANT:1", "payload_digest": "PREVIOUS:cohort_package.package_sha256",
                     "reference_effective_at": "ownerClock.transactionNow",
                     "message_name": "CONSTANT:ListeningCohortPackageReady.v1",
                     "message_id": "SERVER_ALLOCATE:UUID_V7_REPLAY_STABLE",
                     "payload": (
                         "SERVER_DERIVE:single closed inline measureValues and subjectCount only when ADEQUATE; "
                         "SUPPRESSED carries category+policy+non-bruteforceable suppression proof only"
                     ),
                     "source_stream_key": "CONSTANT:platform-hris-listening-protected",
                 }, "expectedRows": "EXACTLY_ONE_FOR_NEW_PACKAGE"},
            ]
            row["structuredTransaction"] = {
                "stepOrder": "LOCK_CLOSED_ADMISSION_CLAIM_BUDGET_AGGREGATE_PACKAGE_RECEIPT_READY_OUTBOX",
                "sameTransaction": True,
                "sameEventSameDigest": "RETURN_SEALED_PACKAGE_ZERO_WRITES",
                "sameEventDifferentDigest": "CONFLICT_ZERO_MUTATION",
                "faultInjection": "ANY_SQL_STEP_ROLLS_BACK_BUDGET_PACKAGE_RECEIPT_OUTBOX",
            }
        elif row.get("messageName") == "ListeningAdmissionInstallRequested.v1":
            admission = next(write for write in domain_writes
                             if write["table"] == "sys_hris_listening_admission_versions")
            admission["assignments"].update({
                "tenant_id": "signedMessage.tenantPublicId resolved to local tenant_id",
                "public_id": "SERVER_ALLOCATE:UUID_V7_REPLAY_STABLE_FROM_MESSAGE_ID",
                "admission_public_id": "signedMessage.admissionPublicId",
                "predecessor_version_public_id": "CONSTANT:NULL",
                "predecessor_owner_revision": "CONSTANT:0",
                "survey_public_id": "signedMessage.surveyPublicId",
                "survey_revision": "signedMessage.surveyRevision",
                "form_version_public_id": "signedMessage.formVersionPublicId",
                "form_revision": "signedMessage.formRevision",
                "form_artifact_schema_version": "signedMessage.formArtifactSchemaVersion",
                "form_artifact_digest": "signedMessage.formArtifactDigest",
                "question_definitions": "signedMessage.questionDefinitions",
                "privacy_version_public_id": "signedMessage.privacyVersionPublicId",
                "privacy_revision": "signedMessage.privacyRevision",
                "retention_version_public_id": "signedMessage.retentionVersionPublicId",
                "retention_revision": "signedMessage.retentionRevision",
                "token_policy_version_public_id": "signedMessage.tokenPolicyVersionPublicId",
                "content_sha256": "signedMessage.contentSha256",
                "consent_policy_version_public_id": "signedMessage.consentPolicyVersionPublicId",
                "anonymity_threshold": "signedMessage.anonymityThreshold",
                "epsilon_micros": "signedMessage.epsilonMicros",
                "privacy_budget_cap_epsilon_micros": "signedMessage.privacyBudgetCapEpsilonMicros",
                "measure_schema_version": "signedMessage.measureSchemaVersion",
                "measure_definition_digest": "signedMessage.measureDefinitionDigest",
                "opens_at": "signedMessage.opensAt",
                "closes_at": "signedMessage.closesAt",
                "erase_after": "signedMessage.eraseAfter",
                "protected_kek_policy_version_id": "OWNER_ALLOCATE:ACTIVE_PROTECTED_KEK_POLICY_VERSION",
                "state": "CONSTANT:ACTIVE",
                "owner_revision": "CONSTANT:1",
                "payload_digest": "signedMessage.payloadDigest",
                "reference_effective_at": "signedMessage.opensAt",
            })
        elif row.get("messageName") == "ListeningAdmissionCloseRequested.v1":
            admission = next(write for write in domain_writes
                             if write["table"] == "sys_hris_listening_admission_versions")
            admission.update({
                "action": "APPEND", "role": "IMMUTABLE_CLOSED_ADMISSION_VERSION",
                "selector": "tenant+admission public id+exact expected owner version",
            })
            admission["assignments"].update({
                "tenant_id": "signedMessage.tenantPublicId resolved to local tenant_id",
                "public_id": "SERVER_ALLOCATE:UUID_V7_REPLAY_STABLE",
                "admission_public_id": "signedMessage.admissionPublicId",
                "predecessor_version_public_id": "LOCKED_PRE:sys_hris_listening_admission_versions.public_id",
                "predecessor_owner_revision": "signedMessage.expectedOwnerVersion",
                "survey_public_id": "signedMessage.surveyPublicId",
                "survey_revision": "LOCKED_PRE:sys_hris_listening_admission_versions.survey_revision",
                "form_version_public_id": "LOCKED_PRE:sys_hris_listening_admission_versions.form_version_public_id",
                "form_revision": "LOCKED_PRE:sys_hris_listening_admission_versions.form_revision",
                "form_artifact_schema_version": "LOCKED_PRE:sys_hris_listening_admission_versions.form_artifact_schema_version",
                "form_artifact_digest": "LOCKED_PRE:sys_hris_listening_admission_versions.form_artifact_digest",
                "question_definitions": "LOCKED_PRE:sys_hris_listening_admission_versions.question_definitions",
                "privacy_version_public_id": "LOCKED_PRE:sys_hris_listening_admission_versions.privacy_version_public_id",
                "privacy_revision": "LOCKED_PRE:sys_hris_listening_admission_versions.privacy_revision",
                "retention_version_public_id": "LOCKED_PRE:sys_hris_listening_admission_versions.retention_version_public_id",
                "retention_revision": "LOCKED_PRE:sys_hris_listening_admission_versions.retention_revision",
                "token_policy_version_public_id": "LOCKED_PRE:sys_hris_listening_admission_versions.token_policy_version_public_id",
                "consent_policy_version_public_id": "LOCKED_PRE:sys_hris_listening_admission_versions.consent_policy_version_public_id",
                "anonymity_threshold": "LOCKED_PRE:sys_hris_listening_admission_versions.anonymity_threshold",
                "epsilon_micros": "LOCKED_PRE:sys_hris_listening_admission_versions.epsilon_micros",
                "privacy_budget_cap_epsilon_micros": "LOCKED_PRE:sys_hris_listening_admission_versions.privacy_budget_cap_epsilon_micros",
                "measure_schema_version": "LOCKED_PRE:sys_hris_listening_admission_versions.measure_schema_version",
                "measure_definition_digest": "LOCKED_PRE:sys_hris_listening_admission_versions.measure_definition_digest",
                "content_sha256": "LOCKED_PRE:sys_hris_listening_admission_versions.content_sha256",
                "opens_at": "LOCKED_PRE:sys_hris_listening_admission_versions.opens_at",
                "closes_at": "ownerClock.transactionNow",
                "erase_after": "LOCKED_PRE:sys_hris_listening_admission_versions.erase_after",
                "protected_kek_policy_version_id": "LOCKED_PRE:sys_hris_listening_admission_versions.protected_kek_policy_version_id",
                "state": "CONSTANT:CLOSED",
                "owner_revision": "signedMessage.expectedOwnerVersion+1",
                "payload_digest": "signedMessage.payloadDigest",
                "reference_effective_at": "ownerClock.transactionNow",
            })
        elif row.get("messageName") in {
            "ListeningAdmissionInstallReceipt.v1", "ListeningAdmissionCloseReceipt.v1",
        }:
            install = row["messageName"] == "ListeningAdmissionInstallReceipt.v1"
            expected_pending = "PUBLISH_PENDING" if install else "CLOSE_PENDING"
            success_state = "PUBLISHED" if install else "CLOSED"
            retry_state = "PUBLISH_RETRYABLE" if install else "CLOSE_RETRYABLE"
            root_write = next(
                write for write in domain_writes
                if write["table"] == "sys_hris_listening_surveys"
            )
            root_write.update({
                "action": "UPDATE_CAS", "role": "CONFIGURATION_SAGA_FINAL_ROOT_CAS",
                "selector": (
                    "tenant+survey public id+state=" + expected_pending + "+exact requestMessageId causation"
                ),
            })
            root_write["assignments"] = {
                "status": (
                    "CONSTANT:" + success_state + " IF signedMessage.status=SUCCESS "
                    "ELSE CONSTANT:" + retry_state
                ),
                "aggregate_version": "LOCKED_PRE:aggregate_version+1",
                "updated_at": "ownerClock.transactionNow",
            }
            version_write = next(
                write for write in domain_writes
                if write["table"] == "sys_hris_listening_survey_versions"
            )
            version_write.update({
                "action": "APPEND", "role": "IMMUTABLE_CONFIGURATION_SAGA_FINAL_VERSION",
                "selector": (
                    "tenant+locked pending survey+exact pending version request_message_id="
                    "signedMessage.requestMessageId"
                ),
                "assignments": {
                    "tenant_id": "signedMessage.tenantPublicId resolved to local tenant_id",
                    "public_id": "SERVER_ALLOCATE:UUID_V7_REPLAY_STABLE_FROM_MESSAGE_ID",
                    "aggregate_version": "CONSTANT:1",
                    "created_by": "LISTENING_CONFIGURATION_OWNER_SERVICE_PRINCIPAL",
                    "correlation_id": "INBOX_CLAIM.correlation_id",
                    "listening_survey_id": "LOCKED_PRE:sys_hris_listening_surveys.listening_survey_id",
                    "state": (
                        "CONSTANT:" + success_state + " IF signedMessage.status=SUCCESS "
                        "ELSE CONSTANT:" + retry_state
                    ),
                    "owner_revision": "LOCKED_PRE:sys_hris_listening_surveys.aggregate_version+1",
                    "predecessor_version_public_id": "LOCKED_PENDING_VERSION.public_id",
                    "predecessor_owner_revision": "LOCKED_PRE:sys_hris_listening_surveys.aggregate_version",
                    "payload_digest": "SERVER_DERIVE:pending intent+signed protected receipt",
                    "reference_effective_at": "ownerClock.transactionNow",
                    "form_version_public_id": "LOCKED_PENDING_VERSION.form_version_public_id",
                    "form_artifact_schema_version": "LOCKED_PENDING_VERSION.form_artifact_schema_version",
                    "form_artifact_digest": "LOCKED_PENDING_VERSION.form_artifact_digest",
                    "privacy_version_public_id": "LOCKED_PENDING_VERSION.privacy_version_public_id",
                    "retention_version_public_id": "LOCKED_PENDING_VERSION.retention_version_public_id",
                    "consent_policy_version_public_id": "LOCKED_PENDING_VERSION.consent_policy_version_public_id",
                    "token_policy_version_public_id": "LOCKED_PENDING_VERSION.token_policy_version_public_id",
                    "content_sha256": "LOCKED_PENDING_VERSION.content_sha256",
                    "question_definitions": "LOCKED_PENDING_VERSION.question_definitions",
                    "questions_schema_version": "LOCKED_PENDING_VERSION.questions_schema_version",
                    "approval_receipt_public_id": "LOCKED_PENDING_VERSION.approval_receipt_public_id",
                    "approval_receipt_revision": "LOCKED_PENDING_VERSION.approval_receipt_revision",
                    "approval_outcome": "LOCKED_PENDING_VERSION.approval_outcome",
                    "approval_action": "LOCKED_PENDING_VERSION.approval_action",
                    "approval_input_digest": "LOCKED_PENDING_VERSION.approval_input_digest",
                    "approval_purpose_code": "LOCKED_PENDING_VERSION.approval_purpose_code",
                    "approval_tenant_id": "LOCKED_PENDING_VERSION.approval_tenant_id",
                    "admission_public_id": "signedMessage.admissionPublicId",
                    "admission_version_public_id": "signedMessage.admissionVersionPublicId",
                    "admission_owner_version": "signedMessage.ownerVersion",
                    "protected_receipt_public_id": "signedMessage.receiptPublicId",
                    "request_message_id": "signedMessage.requestMessageId",
                },
                "expectedRows": "EXACTLY_ONE_NEW_FINAL_OR_RETRYABLE_VERSION",
            })
            event_operation = {
                "session": "HRIS-SYS", "capabilityId": "HRIS.MODERN.EMPLOYEE_LISTENING",
                "authorizationCapability": "hcm.listening.manage",
            }
            row["event"] = _event(
                "EmployeeListeningSurveyPublished.v3" if install else "EmployeeListeningSurveyClosed.v3",
                event_operation, "sys_hris_listening_surveys", "status",
                (expected_pending,), (success_state,),
            )
            row["event"]["condition"] = "signedMessage.status=SUCCESS AND root CAS succeeded"
            for field in row["event"]["fields"]:
                if field["name"] == "correlationId":
                    field.update({
                        "sourceKind": "IMMUTABLE_OWNER_PROOF",
                        "source": "sys_hris_listening_operation_receipts.correlation_id",
                    })
            for name, field_type, source, entity in (
                ("surveyRevisionPublicId", "UUID", "sys_hris_listening_survey_versions.public_id", "table:sys_hris_listening_survey_versions"),
                ("surveyRevision", "BIGINT", "sys_hris_listening_survey_versions.owner_revision", None),
                ("formVersionPublicId", "UUID", "sys_hris_listening_survey_versions.form_version_public_id", "DWP.Listening.FormVersion"),
                ("admissionPublicId", "UUID", "sys_hris_listening_survey_versions.admission_public_id", "DWP.Listening.ProtectedAdmission"),
                ("admissionOwnerVersion", "BIGINT", "sys_hris_listening_survey_versions.admission_owner_version", None),
                (("installReceiptPublicId" if install else "closeReceiptPublicId"), "UUID", "sys_hris_listening_survey_versions.protected_receipt_public_id", "DWP.Listening.OwnerPortReceipt"),
                ("causationRequestMessageId", "UUID", "sys_hris_listening_survey_versions.request_message_id", "DWP.Listening.OwnerPortMessage"),
            ):
                row["event"]["fields"].append(_event_field(
                    name, field_type, "PHYSICAL_POST_STATE", source, entity=entity,
                ))
            if not install:
                row["event"]["fields"].append(_event_field(
                    "closedAt", "TIMESTAMPTZ", "IMMUTABLE_OWNER_PROOF",
                    "sys_hris_listening_operation_receipts.closed_at",
                ))
            row["event"]["audience"]["fieldExposure"]["fields"] = [
                field["name"] for field in row["event"]["fields"]
            ]
        elif row.get("messageName") == "ListeningCohortPackageReady.v1":
            projection = next(write for write in domain_writes
                              if write["table"] == "sys_hris_listening_cohort_projections")
            projection["assignments"].update({
                "survey_public_id": "signedMessage.surveyPublicId",
                "cohort_package_public_id": "signedMessage.cohortPackagePublicId",
                "policy_revision": "signedMessage.policyRevision",
                "source_epoch": "signedMessage.sourceEpoch",
                "cutoff_at": "signedMessage.cutoffAt",
                "measure_schema_version": "signedMessage.measureSchemaVersion",
                "measure_definition_digest": "signedMessage.measureDefinitionDigest",
                "package_sha256": "signedMessage.packageSha256",
                "adequacy_category": "signedMessage.adequacyCategory",
                "measure_values": "signedMessage.measureValues IF adequacyCategory=ADEQUATE ELSE NULL",
                "subject_count": "signedMessage.subjectCount IF adequacyCategory=ADEQUATE ELSE NULL",
                "anonymity_threshold": "signedMessage.anonymityThreshold",
                "privacy_budget_receipt_public_id": "signedMessage.privacyBudgetReceiptPublicId",
                "state": "CONSTANT:PUBLISHED",
                "owner_revision": "CONSTANT:1",
                "payload_digest": "signedMessage.packageSha256",
                "reference_effective_at": "signedMessage.cutoffAt",
            })
            lineage = next(write for write in domain_writes
                           if write["table"] == "sys_hris_listening_lineage_receipts")
            lineage["assignments"].update({
                "listening_cohort_projection_id": "PREVIOUS:sys_hris_listening_cohort_projections.record_id",
                "survey_public_id": "signedMessage.surveyPublicId",
                "cohort_package_public_id": "signedMessage.cohortPackagePublicId",
                "policy_revision": "signedMessage.policyRevision",
                "source_epoch": "signedMessage.sourceEpoch",
                "cutoff_at": "signedMessage.cutoffAt",
                "package_sha256": "signedMessage.packageSha256",
                "measure_schema_version": "signedMessage.measureSchemaVersion",
                "measure_definition_digest": "signedMessage.measureDefinitionDigest",
                "adequacy_category": "signedMessage.adequacyCategory",
                "measure_values": "signedMessage.measureValues IF adequacyCategory=ADEQUATE ELSE NULL",
                "subject_count": "signedMessage.subjectCount IF adequacyCategory=ADEQUATE ELSE NULL",
                "anonymity_threshold": "signedMessage.anonymityThreshold",
                "privacy_budget_receipt_public_id": "signedMessage.privacyBudgetReceiptPublicId",
                "state": "CONSTANT:SEALED",
                "owner_revision": "CONSTANT:1",
                "payload_digest": "signedMessage.payloadDigest",
                "reference_effective_at": "signedMessage.cutoffAt",
            })
        elif row.get("messageName") == "ListeningCohortProjectionReceipt.v1":
            package = next(write for write in domain_writes
                           if write["table"] == "sys_hris_listening_cohort_packages")
            package.update({
                "action": "UPDATE_CAS", "role": "PROTECTED_COHORT_TRANSFER_FINALIZE",
                "selector": "tenant+cohort package public id+expected owner revision",
            })
            # The result receipt advances an existing protected package.  Its
            # tenant, public identity and creation audit columns are immutable.
            package["assignments"] = {
                "aggregate_version": "LOCKED_PRE:aggregate_version+1",
                "owner_revision": "LOCKED_PRE:owner_revision+1",
                "projection_public_id": "signedMessage.projectionPublicId",
                "projection_version": "signedMessage.projectionVersion",
                "receipt_public_id": "signedMessage.receiptPublicId",
                "payload_digest": "signedMessage.payloadDigest",
                "updated_at": "ownerClock.transactionNow",
            }
        elif row["handlerId"] == "internal.listening.protected.erasure.request":
            row.update({
                "sourceStreamKey": "platform-hris-listening-protected",
                "targetStreamKey": "platform-hris-listening-protected",
                "readsTables": ["sys_hris_listening_responses"],
                "aggregateRoot": {
                    "entityType": "table:sys_hris_listening_erasure_tickets",
                    "table": "sys_hris_listening_erasure_tickets",
                    "publicIdColumn": "public_id", "versionColumn": "owner_revision",
                    "stateColumn": "state",
                },
            })
            row["requestContract"]["additionalProperties"] = False
            row["writes"] = [
                {
                    "action": "APPEND", "table": "sys_hris_listening_erasure_tickets",
                    "role": "OWNER_LOCAL_ERASURE_REQUEST_AND_PENDING_TOMBSTONE",
                    "assignments": {
                        "tenant_id": "ownerRequest.tenantId",
                        "public_id": "SERVER_ALLOCATE:UUID_V7_REPLAY_STABLE",
                        "aggregate_version": "CONSTANT:1",
                        "created_by": "LISTENING_PROTECTED_PRIVACY_SERVICE_PRINCIPAL",
                        "correlation_id": "ownerRequest.correlationId",
                        "listening_response_id": "OWNER_LOCAL:sys_hris_listening_responses.listening_response_id",
                        "state": "CONSTANT:REQUESTED", "owner_revision": "CONSTANT:1",
                        "payload_digest": "ownerRequest.requestDigest",
                        "reference_effective_at": "ownerClock.transactionNow",
                        "retention_policy_revision": "ownerRequest.retentionPolicyRevision",
                        "due_at": "ownerRequest.dueAt",
                        "idempotency_key": "ownerRequest.idempotencyKey",
                        "request_digest": "ownerRequest.requestDigest",
                        "attempt_no": "CONSTANT:0",
                    },
                    "expectedRows": "EXACTLY_ONE_NEW_OR_ZERO_SAME_DIGEST_REPLAY",
                },
                {
                    "action": "APPEND", "table": "sys_hris_listening_protected_receipts",
                    "role": "OWNER_LOCAL_ERASURE_REQUEST_RECEIPT",
                    "assignments": {
                        "tenant_id": "ownerRequest.tenantId",
                        "public_id": "SERVER_ALLOCATE:UUID_V7_REPLAY_STABLE",
                        "aggregate_version": "CONSTANT:1",
                        "created_by": "LISTENING_PROTECTED_PRIVACY_SERVICE_PRINCIPAL",
                        "correlation_id": "ownerRequest.correlationId",
                        "listening_response_id": "OWNER_LOCAL:sys_hris_listening_responses.listening_response_id",
                        "state": "CONSTANT:REQUESTED", "owner_revision": "CONSTANT:1",
                        "payload_digest": "ownerRequest.requestDigest",
                        "reference_effective_at": "ownerClock.transactionNow",
                        "idempotency_key": "ownerRequest.idempotencyKey",
                    },
                    "expectedRows": "EXACTLY_ONE_NEW_RECEIPT",
                },
                {
                    "action": "APPEND", "table": "sys_hris_listening_protected_outbox",
                    "role": "OWNER_LOCAL_ERASURE_REQUEST_ACK",
                    "assignments": {
                        "tenant_id": "ownerRequest.tenantId",
                        "public_id": "SERVER_ALLOCATE:UUID_V7_REPLAY_STABLE",
                        "aggregate_version": "CONSTANT:1",
                        "created_by": "LISTENING_PROTECTED_PRIVACY_SERVICE_PRINCIPAL",
                        "correlation_id": "ownerRequest.correlationId",
                        "state": "CONSTANT:PENDING", "owner_revision": "CONSTANT:1",
                        "payload_digest": "SERVER_DERIVE:closed erasure request acknowledgement",
                        "reference_effective_at": "ownerClock.transactionNow",
                        "message_name": "CONSTANT:ProtectedListeningErasureRequested.v1",
                        "message_id": "SERVER_ALLOCATE:UUID_V7_REPLAY_STABLE",
                        "payload": "SERVER_DERIVE:ticket public identity+revision+state only",
                        "source_stream_key": "CONSTANT:platform-hris-listening-protected",
                    },
                    "expectedRows": "EXACTLY_ONE_NEW_ACK",
                },
            ]
        elif row["handlerId"] == "internal.listening.protected.erasure.process":
            row.update({
                "sourceStreamKey": "platform-hris-listening-protected",
                "targetStreamKey": "platform-hris-listening-protected",
                "readsTables": [
                    "sys_hris_listening_erasure_tickets",
                    "sys_hris_listening_responses",
                    "sys_hris_listening_answer_values",
                ],
                "aggregateRoot": {
                    "entityType": "table:sys_hris_listening_erasure_tickets",
                    "table": "sys_hris_listening_erasure_tickets",
                    "publicIdColumn": "public_id", "versionColumn": "owner_revision",
                    "stateColumn": "state",
                },
                "nonSqlOwnerActions": [{
                    "action": "CRYPTO_SHRED_OWNER_KEY_MATERIAL",
                    "ownerBoundary": "platform-hris-listening-protected only",
                    "selector": "locked ticket tenant+response internal identity+exact key version",
                    "proofSink": "sys_hris_listening_erasure_tickets.tombstone_digest",
                    "failure": "FAILED_RETRYABLE_CAS;NO_FALSE_COMPLETION_RECEIPT_OR_OUTBOX",
                }],
            })
            row["requestContract"] = {
                "additionalProperties": False,
                "ticketPublicId": "REQUIRED_UUID",
                "expectedOwnerRevision": "REQUIRED_POSITIVE_INTEGER",
                "leasePublicId": "REQUIRED_UUID",
                "processorAttempt": "REQUIRED_POSITIVE_INTEGER",
            }
            row["writes"] = [
                {
                    "action": "UPDATE_CAS", "table": "sys_hris_listening_erasure_tickets",
                    "role": "OWNER_LOCAL_ERASURE_TOMBSTONE_AND_TERMINAL_STATE",
                    "selector": "tenant+ticket public id+REQUESTED|FAILED_RETRYABLE+expected owner revision",
                    "assignments": {
                        "state": "CONSTANT:COMPLETED", "owner_revision": "LOCKED_PRE:owner_revision+1",
                        "attempt_no": "processorRequest.processorAttempt",
                        "outcome": "CONSTANT:CRYPTO_SHREDDED", "failure_code": "CONSTANT:NULL",
                        "erased_at": "ownerClock.transactionNow",
                        "tombstone_digest": "SERVER_DERIVE:key-destruction attestation+ticket+response+attempt",
                        "completed_at": "ownerClock.transactionNow", "updated_at": "ownerClock.transactionNow",
                    },
                    "expectedRows": "EXACTLY_ONE_OR_ZERO_SEALED_REPLAY_OR_409_STALE",
                },
                {
                    "action": "APPEND", "table": "sys_hris_listening_protected_receipts",
                    "role": "OWNER_LOCAL_ERASURE_COMPLETION_RECEIPT",
                    "assignments": {
                        "tenant_id": "LOCKED_PRE:sys_hris_listening_erasure_tickets.tenant_id",
                        "public_id": "SERVER_ALLOCATE:UUID_V7_REPLAY_STABLE",
                        "aggregate_version": "CONSTANT:1",
                        "created_by": "LISTENING_PROTECTED_ERASURE_SERVICE_PRINCIPAL",
                        "correlation_id": "LOCKED_PRE:sys_hris_listening_erasure_tickets.correlation_id",
                        "listening_response_id": "LOCKED_PRE:sys_hris_listening_erasure_tickets.listening_response_id",
                        "state": "CONSTANT:COMPLETED", "owner_revision": "CONSTANT:1",
                        "payload_digest": "LOCKED_POST:sys_hris_listening_erasure_tickets.tombstone_digest",
                        "reference_effective_at": "ownerClock.transactionNow",
                        "completed_at": "ownerClock.transactionNow",
                        "result_digest": "LOCKED_POST:sys_hris_listening_erasure_tickets.tombstone_digest",
                    },
                    "expectedRows": "EXACTLY_ONE_FOR_NEW_TERMINAL_TRANSITION",
                },
                {
                    "action": "APPEND", "table": "sys_hris_listening_protected_outbox",
                    "role": "OWNER_LOCAL_ERASURE_COMPLETION_ACK",
                    "assignments": {
                        "tenant_id": "LOCKED_PRE:sys_hris_listening_erasure_tickets.tenant_id",
                        "public_id": "SERVER_ALLOCATE:UUID_V7_REPLAY_STABLE",
                        "aggregate_version": "CONSTANT:1",
                        "created_by": "LISTENING_PROTECTED_ERASURE_SERVICE_PRINCIPAL",
                        "correlation_id": "LOCKED_PRE:sys_hris_listening_erasure_tickets.correlation_id",
                        "state": "CONSTANT:PENDING", "owner_revision": "CONSTANT:1",
                        "payload_digest": "LOCKED_POST:sys_hris_listening_erasure_tickets.tombstone_digest",
                        "reference_effective_at": "ownerClock.transactionNow",
                        "message_name": "CONSTANT:ProtectedListeningErasureCompleted.v1",
                        "message_id": "SERVER_ALLOCATE:UUID_V7_REPLAY_STABLE",
                        "payload": "SERVER_DERIVE:ticket identity+revision+outcome+tombstone digest only",
                        "source_stream_key": "CONSTANT:platform-hris-listening-protected",
                    },
                    "expectedRows": "EXACTLY_ONE_FOR_NEW_TERMINAL_TRANSITION",
                },
            ]
        if message:
            envelope_assignments = {
                "tenant_id": "signedMessage.tenantPublicId resolved to local tenant_id",
                "public_id": "SERVER_ALLOCATE:UNLINKABLE_UUID_V7",
                "aggregate_version": "CONSTANT:1",
                "created_by": "LISTENING_OWNER_SERVICE_PRINCIPAL",
                "correlation_id": "SERVER_ALLOCATE:UNLINKABLE_OWNER_TRACE",
                "message_name": "CONSTANT:" + row["messageName"],
                "message_id": "signedMessage.messageId",
                "payload_digest": "signedMessage.payloadDigest",
                "source_stream_key": "CONSTANT:" + message["from"],
                "signing_key_id": "signedMessage.signingKeyId",
                "signature_algorithm": "signedMessage.signatureAlgorithm",
                "owner_signature": "signedMessage.ownerSignature",
                "reference_effective_at": "ownerClock.transactionNow",
                **{
                    ("message_status" if field == "status" else _snake(field)):
                        "signedMessage." + field
                    for field in message["fieldAllowlist"]
                },
            }
            row["writes"] = [
                {
                    "action": "CLAIM_OR_REPLAY",
                    "table": row["inboxLedgerTable"],
                    "role": "SIGNED_OWNER_PORT_INBOX_CLAIM",
                    "selector": "tenant+handler+messageId; stored payloadDigest exact",
                    "assignments": envelope_assignments,
                    "expectedRows": "ONE_NEW_OR_ONE_SAME_DIGEST_SEALED_REPLAY",
                },
                *domain_writes,
                {
                    "action": "APPEND", "table": row["outboxTable"],
                    "role": "CLOSED_OWNER_PORT_ACK_OUTBOX",
                    "assignments": {
                        "tenant_id": "signedMessage.tenantPublicId resolved to local tenant_id",
                        "public_id": "SERVER_ALLOCATE:UNLINKABLE_UUID_V7",
                        "aggregate_version": "CONSTANT:1",
                        "created_by": "LISTENING_OWNER_SERVICE_PRINCIPAL",
                        "correlation_id": "INBOX_CLAIM.correlation_id",
                        "message_name": "CONSTANT:" + row["closedAcknowledgement"],
                        "message_id": "SERVER_ALLOCATE:UUID_V7_REPLAY_STABLE",
                        "payload_digest": "SERVER_DERIVE:canonical closed acknowledgement",
                        "payload": "SERVER_DERIVE:closed typed owner acknowledgement",
                        "source_stream_key": "CONSTANT:" + message["to"],
                        "reference_effective_at": "ownerClock.transactionNow",
                    },
                    "expectedRows": "EXACTLY_ONE_NEW_ACK_FOR_NEW_INPUT",
                },
            ]
            # The configuration/protected inbox rows are also the durable
            # completion receipts for their owner-local orchestration.  Their
            # lifecycle columns are deliberately table-specific; no generic
            # `status` alias is introduced into the exact schema.
            inbox_completion_column = (
                "lifecycle_state"
                if row["inboxLedgerTable"] == "sys_hris_listening_operation_receipts"
                else "state"
            )
            row["writes"].insert(-1, {
                "action": "UPDATE_CAS",
                "table": row["inboxLedgerTable"],
                "role": "SIGNED_OWNER_PORT_INBOX_COMPLETE",
                "selector": "tenant+messageName+messageId+stored payloadDigest",
                "assignments": {
                    inbox_completion_column: "CONSTANT:COMPLETED",
                    "owner_revision": "LOCKED_PRE:owner_revision+1",
                    "completed_at": "ownerClock.transactionNow",
                },
                "expectedRows": "EXACTLY_ONE_NEW_CLAIM;ZERO_ON_SEALED_REPLAY",
            })
        elif "writes" not in row:
            row["writes"] = domain_writes
        if row["handlerId"] == "internal.listening.insights.cohort-package.consume":
            event_operation = {"session": "HRIS-SYS",
                               "capabilityId": "HRIS.MODERN.EMPLOYEE_LISTENING",
                               "authorizationCapability": "hcm.listening.cohort.view"}
            row["event"] = _event(
                cohort_event, event_operation, "sys_hris_listening_cohort_projections",
                "state", ("NONE",), ("PUBLISHED",)
            )
            for field in row["event"]["fields"]:
                if field["name"] == "correlationId":
                    field.update({
                        "sourceKind": "IMMUTABLE_OWNER_PROOF",
                        "source": "sys_hris_listening_insights_inbox.correlation_id",
                    })
            for name, field_type, source, entity in (
                ("surveyPublicId", "UUID", "sys_hris_listening_cohort_projections.survey_public_id", "DWP.Listening.SurveyPublicIdentity"),
                ("cohortPackagePublicId", "UUID", "sys_hris_listening_cohort_projections.cohort_package_public_id", "DWP.Listening.CohortPackage"),
                ("projectionRevision", "BIGINT", "sys_hris_listening_cohort_projections.owner_revision", None),
                ("policyRevision", "BIGINT", "sys_hris_listening_cohort_projections.policy_revision", None),
                ("sourceEpoch", "TIMESTAMPTZ", "sys_hris_listening_cohort_projections.source_epoch", None),
                ("cutoffAt", "TIMESTAMPTZ", "sys_hris_listening_cohort_projections.cutoff_at", None),
                ("measureSchemaVersion", "STRING", "sys_hris_listening_cohort_projections.measure_schema_version", None),
                ("packageSha256", "SHA256", "sys_hris_listening_cohort_projections.package_sha256", None),
                ("adequacyCategory", "STRING", "sys_hris_listening_cohort_projections.adequacy_category", None),
                ("subjectCount", "INTEGER", "sys_hris_listening_cohort_projections.subject_count", None),
                ("anonymityThreshold", "INTEGER", "sys_hris_listening_cohort_projections.anonymity_threshold", None),
                ("privacyBudgetReceiptPublicId", "UUID", "sys_hris_listening_cohort_projections.privacy_budget_receipt_public_id", "DWP.Listening.PrivacyBudgetReceipt"),
                ("lineageReceiptPublicId", "UUID", "sys_hris_listening_lineage_receipts.public_id", "table:sys_hris_listening_lineage_receipts"),
            ):
                event_field = _event_field(
                    name, field_type, "PHYSICAL_POST_STATE", source, entity=entity,
                )
                if name == "subjectCount":
                    event_field.update({
                        "required": False,
                        "condition": "adequacyCategory=ADEQUATE",
                        "validation": "ADEQUATE_ONLY; OMIT WHEN SUPPRESSED TO PREVENT SMALL_CELL_DISCLOSURE",
                    })
                row["event"]["fields"].append(event_field)
            row["event"]["audience"]["fieldExposure"]["fields"] = [
                field["name"] for field in row["event"]["fields"]
            ]
            row["event"]["privacyContract"] = {
                "forbiddenFields": [
                    "measureValues", "rawMeasure", "smallCell", "responseId", "answer",
                    "workerId", "personId", "token", "tokenCommitment",
                ],
                "thresholdProof": "subjectCount>=anonymityThreshold OR adequacyCategory=SUPPRESSED",
                "refetch": "exact projection+lineage receipt under cohort PEP",
            }
        # Every cross-stream message and every handler-owned public event has
        # one explicit closed payload map.  Generic CLOSED_* acknowledgements
        # are not part of the six-message topology and cannot stand in for a
        # public event envelope.
        message_payload_sources = {
            "ListeningAdmissionInstallReceipt.v1": {
                "tenantPublicId": "signedMessage.tenantPublicId",
                "surveyPublicId": "signedMessage.surveyPublicId",
                "admissionPublicId": "LOCKED_POST:sys_hris_listening_admission_versions.admission_public_id",
                "admissionVersionPublicId": "LOCKED_POST:sys_hris_listening_admission_versions.public_id",
                "status": "CONSTANT:SUCCESS",
                "ownerVersion": "LOCKED_POST:sys_hris_listening_admission_versions.owner_revision",
                "receiptPublicId": "INBOX_CLAIM.public_id",
                "requestMessageId": "signedMessage.messageId",
                "occurredAt": "ownerClock.transactionNow",
            },
            "ListeningAdmissionCloseReceipt.v1": {
                "tenantPublicId": "signedMessage.tenantPublicId",
                "surveyPublicId": "signedMessage.surveyPublicId",
                "admissionPublicId": "LOCKED_POST:sys_hris_listening_admission_versions.admission_public_id",
                "admissionVersionPublicId": "LOCKED_POST:sys_hris_listening_admission_versions.public_id",
                "status": "CONSTANT:SUCCESS",
                "ownerVersion": "LOCKED_POST:sys_hris_listening_admission_versions.owner_revision",
                "receiptPublicId": "INBOX_CLAIM.public_id",
                "requestMessageId": "signedMessage.messageId",
                "closedAt": "ownerClock.transactionNow",
            },
            "ListeningCohortPackageReady.v1": {
                "tenantPublicId": "LOCKED_ADMISSION.tenant public identity",
                "surveyPublicId": "PREVIOUS:cohort_package.survey_public_id",
                "cohortPackagePublicId": "PREVIOUS:cohort_package.public_id",
                "policyRevision": "PREVIOUS:cohort_package.policy_revision",
                "sourceEpoch": "PREVIOUS:cohort_package.source_epoch",
                "cutoffAt": "PREVIOUS:cohort_package.cutoff_at",
                "measureSchemaVersion": "PREVIOUS:cohort_package.measure_schema_version",
                "measureDefinitionDigest": "PREVIOUS:cohort_package.measure_definition_digest",
                "measureValues": "PREVIOUS:cohort_package.measure_values IF ADEQUATE ELSE OMIT",
                "packageSha256": "PREVIOUS:cohort_package.package_sha256",
                "payloadDigest": "PREVIOUS:cohort_package.payload_digest",
                "adequacyCategory": "PREVIOUS:cohort_package.adequacy_category",
                "subjectCount": "PREVIOUS:cohort_package.subject_count IF ADEQUATE ELSE OMIT",
                "anonymityThreshold": "PREVIOUS:cohort_package.anonymity_threshold",
                "privacyBudgetReceiptPublicId": "PREVIOUS:cohort_package.privacy_budget_receipt_public_id",
            },
            "ListeningCohortProjectionReceipt.v1": {
                "tenantPublicId": "signedMessage.tenantPublicId",
                "surveyPublicId": "LOCKED_POST:sys_hris_listening_cohort_projections.survey_public_id",
                "cohortPackagePublicId": "LOCKED_POST:sys_hris_listening_cohort_projections.cohort_package_public_id",
                "projectionPublicId": "LOCKED_POST:sys_hris_listening_cohort_projections.public_id",
                "projectionVersion": "LOCKED_POST:sys_hris_listening_cohort_projections.owner_revision",
                "status": "CONSTANT:SUCCESS",
                "receiptPublicId": "LOCKED_POST:sys_hris_listening_lineage_receipts.public_id",
                "requestMessageId": "signedMessage.messageId",
            },
        }
        for write in row.get("writes", []):
            message_name = write.get("assignments", {}).get("message_name", "")
            if isinstance(message_name, str) and message_name.startswith("CONSTANT:"):
                message_name = message_name.removeprefix("CONSTANT:")
            if message_name in message_payload_sources:
                write["payloadSchema"] = message_name
                write["payloadFieldSources"] = message_payload_sources[message_name]

        handler_id = row["handlerId"]
        if handler_id in {
            "internal.listening.configuration.admission-install-receipt.consume",
            "internal.listening.configuration.admission-close-receipt.consume",
        }:
            public_event = row["event"]["eventName"]
            event_sources = {
                field["name"]: field["source"] for field in row["event"]["fields"]
            }
            event_outbox = next(
                write for write in row["writes"]
                if write.get("table") == "sys_hris_listening_domain_outbox"
            )
            event_outbox.update({
                "role": "PUBLIC_EVENT_OUTBOX",
                "payloadSchema": public_event,
                "payloadFieldSources": event_sources,
            })
            event_outbox["assignments"].update({
                "payload_digest": "SERVER_DERIVE:canonical public event payload",
                "payload": "SERVER_DERIVE:closed exact public event fields",
                "event_type": "CONSTANT:" + public_event,
                "occurred_at": "ownerClock.transactionNow",
            })
            for column in ("message_name", "message_id", "source_stream_key"):
                event_outbox["assignments"].pop(column, None)
        elif handler_id == "internal.listening.insights.cohort-package.consume":
            public_event = row["event"]["eventName"]
            event_sources = {
                field["name"]: field["source"] for field in row["event"]["fields"]
            }
            row["writes"].append({
                "action": "APPEND",
                "table": "sys_hris_listening_insights_outbox",
                "role": "PUBLIC_EVENT_OUTBOX",
                "payloadSchema": public_event,
                "payloadFieldSources": event_sources,
                "assignments": {
                    "tenant_id": "signedMessage.tenantPublicId resolved to local tenant_id",
                    "public_id": "SERVER_ALLOCATE:UUID_V7_REPLAY_STABLE",
                    "aggregate_version": "CONSTANT:1",
                    "created_by": "LISTENING_INSIGHTS_OWNER_SERVICE_PRINCIPAL",
                    "correlation_id": "INBOX_CLAIM.correlation_id",
                    "payload_digest": "SERVER_DERIVE:canonical privacy-safe public event payload",
                    "payload": "SERVER_DERIVE:closed exact public event fields",
                    "event_type": "CONSTANT:" + public_event,
                    "occurred_at": "ownerClock.transactionNow",
                    "reference_effective_at": "signedMessage.cutoffAt",
                },
                "expectedRows": "EXACTLY_ONE_PUBLIC_EVENT_FOR_NEW_PROJECTION",
            })
        elif handler_id == "internal.listening.protected.cohort-projection-receipt.consume":
            row["writes"] = [
                write for write in row["writes"]
                if not (
                    write.get("table") == "sys_hris_listening_protected_outbox"
                    and write.get("assignments", {}).get("message_name")
                    == "CONSTANT:CLOSED_PROTECTED_COHORT_TRANSFER_RESULT"
                )
            ]
        for write in row.get("writes", []):
            message_name = write.get("assignments", {}).get("message_name", "")
            if isinstance(message_name, str) and message_name.startswith("CONSTANT:"):
                message_name = message_name.removeprefix("CONSTANT:")
            message_contract = message_contracts.get(message_name)
            if not message_contract or "outbox" not in write.get("table", ""):
                continue
            source_stream = message_contract["from"]
            write["assignments"].update({
                "signing_key_id": "ACTIVE_SIGNING_KEY_FOR:" + source_stream + ".kid",
                "signature_algorithm": "ACTIVE_SIGNING_KEY_FOR:" + source_stream + ".algorithm",
                "owner_signature": (
                    "SERVER_SIGN_ACTIVE_OWNER_KEY:tenantPublicId+messageId+messageName+"
                    "sourceStreamKey+payloadDigest+referenceEffectiveAt"
                ),
            })
            write["signedEnvelope"] = {
                "sourceStreamKey": source_stream,
                "keyStatus": "ACTIVE_AT_REFERENCE_EFFECTIVE_AT",
                "algorithmAllowlist": ["ED25519", "ECDSA_P256_SHA256"],
                "canonicalSignatureInput": (
                    "tenantPublicId+messageId+messageName+sourceStreamKey+"
                    "payloadDigest+referenceEffectiveAt"
                ),
                "keyRotation": "consumer resolves signingKeyId at referenceEffectiveAt; unknown or retired key fails closed",
            }
        rows.append(row)
    by_handler = {row["handlerId"]: row for row in rows}
    erasure_request = by_handler["internal.listening.protected.erasure.request"]
    erasure_owner_contract = next(
        contract for contract in design["ownerPortOperationContracts"]
        if contract["ownerPortOperation"] == "protected.requestErasure"
    )
    erasure_request["typedRequestSchema"] = copy.deepcopy(
        erasure_owner_contract["requestSchema"]
    )
    erasure_request["requestContract"] = {
        "additionalProperties": False,
        "tenantPublicId": "REQUIRED_UUID",
        "responsePublicId": "REQUIRED_UUID_OWNER_LOCAL_RESPONSE",
        "erasureAuthority": copy.deepcopy(next(
            field["valueSchema"]
            for field in erasure_owner_contract["requestSchema"]["fields"]
            if field["name"] == "erasureAuthority"
        )),
        "idempotencyKey": "REQUIRED_SCOPE_BOUND_OPAQUE_KEY",
    }
    erasure_request["selectors"] = [
        {
            "selectorType": "OWNER_LOCAL_RESPONSE_AND_RETENTION_FENCE",
            "entityType": "table:sys_hris_listening_responses",
            "idSpace": "PUBLIC_UUID",
            "source": "ownerRequest.responsePublicId",
            "sourceType": "UUID",
            "targetTable": "sys_hris_listening_responses",
            "targetColumn": "public_id",
            "targetSqlType": "UUID",
            "operator": "EQUALS",
            "cardinality": "EXACTLY_ONE",
            "tenantFilter": "target.tenant_id=owner-local resolution of ownerRequest.tenantPublicId",
            "purposeFilter": "LISTENING_RESPONSE_ERASURE",
            "versionRule": "exact immutable response row and linked admission retention snapshot",
            "asOfRule": (
                "erasureAuthority.dueAt=LOCKED_RESPONSE.erase_after<=captured owner clock "
                "for RETENTION_SCHEDULER; privacy workflow is immediate only when its receipt is active"
            ),
            "causalJoin": (
                "response.listening_admission_version_id locks LOCKED_ADMISSION; "
                "RETENTION_SCHEDULER erasureAuthority.retentionPolicyPublicId="
                "LOCKED_ADMISSION.retention_version_public_id and retentionPolicyRevision="
                "LOCKED_ADMISSION.retention_revision and dueAt=LOCKED_RESPONSE.erase_after"
            ),
            "failure": "404_OR_409_ZERO_TICKET_RECEIPT_MUTATION",
        },
        {
            "selectorType": "OWNER_LOCAL_TOKEN_CONSUMPTION_FENCE",
            "entityType": "table:sys_hris_listening_token_consumptions",
            "idSpace": "OWNER_LOCAL_INTERNAL_ID",
            "source": "LOCKED_RESPONSE.public_id",
            "sourceType": "UUID",
            "targetTable": "sys_hris_listening_token_consumptions",
            "targetColumn": "response_public_id",
            "targetSqlType": "UUID",
            "operator": "EQUALS",
            "cardinality": "EXACTLY_ONE_CONSUMED_OR_SAME_TOMBSTONE_REPLAY",
            "tenantFilter": "target.tenant_id=LOCKED_RESPONSE.tenant_id",
            "purposeFilter": "LISTENING_RESPONSE_ERASURE",
            "versionRule": "CONSUMED locks exact response key; ERASED returns sealed tombstone",
            "asOfRule": "reference_effective_at<=captured owner clock",
            "causalJoin": "target.response_public_id=LOCKED_RESPONSE.public_id and key identity/version exact",
            "failure": "404_OR_CONFLICT_ZERO_TICKET_RECEIPT_MUTATION",
        },
        {
            "selectorType": "DISCRIMINATED_ERASURE_AUTHORITY_PROOF",
            "entityType": "DWP.Listening.ErasureAuthority",
            "idSpace": "TYPED_OWNER_PROOF",
            "source": "ownerRequest.erasureAuthority",
            "sourceType": "OBJECT",
            "targetTable": "OWNER_PORT::DWP.Privacy.ErasureAuthority",
            "targetColumn": "authorityReceiptPublicId|retentionPolicyPublicId",
            "targetSqlType": "UUID",
            "operator": "VERIFY_SIGNATURE_OR_OWNER_LOCAL_POLICY",
            "cardinality": "EXACTLY_ONE_VALID_VARIANT",
            "tenantFilter": "proof tenant=ownerRequest.tenantPublicId=LOCKED_RESPONSE tenant",
            "purposeFilter": "LISTENING_RESPONSE_ERASURE_ONLY",
            "versionRule": "exact receipt/policy revision; no latest fallback",
            "asOfRule": "signature and due policy valid at captured owner clock",
            "causalJoin": (
                "RETENTION_SCHEDULER requires erasureAuthority.retentionPolicyPublicId="
                "LOCKED_ADMISSION.retention_version_public_id, retentionPolicyRevision="
                "LOCKED_ADMISSION.retention_revision and dueAt=LOCKED_RESPONSE.erase_after<=ownerClock.transactionNow; "
                "SIGNED_PRIVACY_WORKFLOW refetches the sealed receipt and requires exact "
                "tenant+ownerRequest.responsePublicId+LOCKED_ADMISSION.retention_revision+"
                "receipt dueAt+purposeCode+receipt revision; the active owner signature covers "
                "that canonical decision digest and cross-response replay fails closed"
            ),
            "failure": "401_403_409_ZERO_TICKET_RECEIPT_MUTATION",
        },
    ]
    erasure_request["preWriteVerificationOrder"] = (
        "LOCK_RESPONSE_THEN_TOKEN_CONSUMPTION_THEN_VALIDATE_EXACT_AUTHORITY_VARIANT_BEFORE_ANY_APPEND"
    )
    erasure_request["writes"] = [
        write for write in erasure_request["writes"]
        if write["table"] != "sys_hris_listening_protected_outbox"
    ]
    erasure_ticket_write = next(
        write for write in erasure_request["writes"]
        if write["table"] == "sys_hris_listening_erasure_tickets"
    )
    erasure_ticket_write["assignments"].update({
        "tenant_id": "VERIFIED_AUTHORITY.tenantPublicId resolved owner-locally",
        "correlation_id": "SERVER_ALLOCATE:UNLINKABLE_OWNER_TRACE",
        "payload_digest": "SERVER_DERIVE:canonical closed erasure request",
        "request_digest": "SERVER_DERIVE:canonical closed erasure request",
        "response_key_public_id": "LOCKED_RESPONSE.response_key_public_id",
        "response_key_version": "LOCKED_RESPONSE.response_key_version",
        "token_consumption_public_id": "LOCKED_TOKEN_CONSUMPTION.public_id",
        "authority_type": "ownerRequest.erasureAuthority.authorityType",
        "authority_evidence_digest": "SERVER_DERIVE:canonical verified authority proof",
        "authority_receipt_public_id": (
            "ownerRequest.erasureAuthority.authorityReceiptPublicId IF SIGNED_PRIVACY_WORKFLOW ELSE NULL"
        ),
        "authority_receipt_revision": (
            "ownerRequest.erasureAuthority.authorityReceiptRevision IF SIGNED_PRIVACY_WORKFLOW ELSE NULL"
        ),
        "retention_policy_revision": "LOCKED_ADMISSION.retention_revision",
        "retention_policy_public_id": "LOCKED_ADMISSION.retention_version_public_id",
        "due_at": (
            "LOCKED_RESPONSE.erase_after IF RETENTION_SCHEDULER ELSE ownerClock.transactionNow"
        ),
    })
    request_receipt_write = next(
        write for write in erasure_request["writes"]
        if write["table"] == "sys_hris_listening_protected_receipts"
    )
    request_receipt_write["assignments"].update({
        "tenant_id": "VERIFIED_AUTHORITY.tenantPublicId resolved owner-locally",
        "correlation_id": "SERVER_ALLOCATE:UNLINKABLE_OWNER_TRACE",
        "receipt_kind": "CONSTANT:ERASURE_REQUEST",
        "request_digest": "SERVER_DERIVE:canonical closed erasure request",
        "payload_digest": "SERVER_DERIVE:canonical verified authority decision",
        "erasure_ticket_public_id": "PREVIOUS:sys_hris_listening_erasure_tickets.public_id",
    })
    erasure_request["privateDelivery"] = (
        "OWNER_LOCAL_PRIVATE_RECEIPT_ONLY_BROKER_AND_CROSS_STREAM_OUTBOX_FORBIDDEN"
    )
    erasure_request["anonymousBoundary"] = {
        "authorityUnion": [
            "RETENTION_SCHEDULER_DUE_POLICY", "SIGNED_PRIVACY_WORKFLOW_AUTHORITY_RECEIPT",
        ],
        "responseUuidPossessionIsAuthority": False,
        "anonymousHolderIngress": "FORBIDDEN_NO_PUBLIC_ROUTE",
        "principalPersistence": "FORBIDDEN",
        "telemetry": "UNLINKABLE_OWNER_LOCAL_CORRELATION_AND_COARSE_OUTCOME_ONLY",
    }
    owner_port_by_handler = {
        contract["entrypointRef"]["systemHandlerId"]: contract
        for contract in design["ownerPortOperationContracts"]
        if "systemHandlerId" in contract.get("entrypointRef", {})
    }
    for handler_id, contract in owner_port_by_handler.items():
        by_handler[handler_id]["typedRequestSchema"] = copy.deepcopy(
            contract["requestSchema"]
        )
    erasure = by_handler["internal.listening.protected.erasure.process"]
    erasure["structuredTransaction"] = {
        "sameTransaction": False,
        "phases": [
            "TX1_CLAIM_AND_COMMIT_LEASE",
            "OUTSIDE_DB_TX_IDEMPOTENT_KMS_DESTROY_EXACT_RESPONSE_DEK",
            "TX2_SUCCESS_TOMBSTONE_TOKEN_ORIGINAL_RECEIPT_AND_PRIVATE_COMPLETION_RECEIPT",
            "TX2_FAILURE_RELEASE_LEASE_TO_FAILED_RETRYABLE_WITHOUT_COMPLETION_RECEIPT",
        ],
        "crashRecovery": (
            "before KMS destroy lease expiry permits retry; after KMS destroy retry obtains same destruction "
            "attestation then seals one tombstone; another response DEK remains decryptable"
        ),
        "concurrency": "tenant+ticket+owner revision+lease exactly one winner",
    }
    erasure["writes"] = [
        {"phase": "TX1", "action": "UPDATE_CAS", "table": "sys_hris_listening_erasure_tickets",
         "role": "CLAIM_ERASURE_LEASE", "selector": (
             "tenant+ticket+expected owner revision+REQUESTED|FAILED_RETRYABLE+lease absent/expired"
         ), "assignments": {
             "state": "CONSTANT:CLAIMED", "owner_revision": "LOCKED_PRE:owner_revision+1",
             "attempt_no": "processorRequest.processorAttempt",
             "claim_lease_public_id": "processorRequest.leasePublicId",
             "claim_lease_expires_at": "SERVER_DERIVE:bounded lease expiry",
             "updated_at": "ownerClock.transactionNow",
         }, "expectedRows": "EXACTLY_ONE"},
        {"phase": "TX2_SUCCESS", "action": "UPDATE_CAS",
         "table": "sys_hris_listening_erasure_tickets", "role": "SEAL_ERASURE_TOMBSTONE",
         "selector": "tenant+ticket+CLAIMED+matching lease+owner revision",
         "assignments": {
             "state": "CONSTANT:COMPLETED", "owner_revision": "LOCKED_PRE:owner_revision+1",
             "outcome": "CONSTANT:CRYPTO_SHREDDED", "failure_code": "CONSTANT:NULL",
             "erased_at": "ownerClock.transactionNow",
             "tombstone_digest": "SERVER_DERIVE:KMS destruction attestation+ticket+response key version",
             "completed_at": "ownerClock.transactionNow", "claim_lease_public_id": "CONSTANT:NULL",
             "claim_lease_expires_at": "CONSTANT:NULL", "updated_at": "ownerClock.transactionNow",
         }, "expectedRows": "EXACTLY_ONE_OR_ZERO_ALREADY_SEALED"},
        {"phase": "TX2_SUCCESS", "action": "UPDATE_CAS",
         "table": "sys_hris_listening_token_consumptions", "role": "TOKEN_REPLAY_TOMBSTONE",
         "selector": "tenant+ticket.token_consumption_public_id+CONSUMED+exact response",
         "assignments": {
             "state": "CONSTANT:ERASED", "owner_revision": "LOCKED_PRE:owner_revision+1",
             "erasure_ticket_public_id": "LOCKED_POST:ticket.public_id",
             "tombstone_digest": "LOCKED_POST:ticket.tombstone_digest",
             "erased_at": "LOCKED_POST:ticket.erased_at",
         }, "expectedRows": "EXACTLY_ONE_NEW_TERMINAL_TRANSITION"},
        {"phase": "TX2_SUCCESS", "action": "UPDATE_CAS",
         "table": "sys_hris_listening_protected_receipts", "role": "ORIGINAL_SUBMISSION_REPLAY_TOMBSTONE",
         "selector": "tenant+receiptPublicId from token consumption+COMPLETED submission receipt",
         "assignments": {
             "state": "CONSTANT:ERASED", "owner_revision": "LOCKED_PRE:owner_revision+1",
             "erasure_ticket_public_id": "LOCKED_POST:ticket.public_id",
             "tombstone_digest": "LOCKED_POST:ticket.tombstone_digest",
             "result_digest": "LOCKED_POST:ticket.tombstone_digest",
             "completed_at": "LOCKED_POST:ticket.completed_at",
         }, "expectedRows": "EXACTLY_ONE_NEW_TERMINAL_TRANSITION"},
        {"phase": "TX2_SUCCESS", "action": "APPEND",
         "table": "sys_hris_listening_protected_receipts", "role": "PRIVATE_ERASURE_COMPLETION_RECEIPT",
         "assignments": {
             "tenant_id": "LOCKED_POST:ticket.tenant_id", "public_id": "SERVER_ALLOCATE:UUID_V7_REPLAY_STABLE",
             "aggregate_version": "CONSTANT:1", "created_by": "PROTECTED_ERASURE_SERVICE_PRINCIPAL",
             "correlation_id": "SERVER_ALLOCATE:UNLINKABLE_OWNER_TRACE", "listening_response_id": "CONSTANT:NULL",
             "receipt_kind": "CONSTANT:ERASURE_COMPLETION",
             "erasure_ticket_public_id": "LOCKED_POST:ticket.public_id",
             "tombstone_digest": "LOCKED_POST:ticket.tombstone_digest", "state": "CONSTANT:COMPLETED",
             "owner_revision": "CONSTANT:1", "payload_digest": "LOCKED_POST:ticket.tombstone_digest",
             "result_digest": "LOCKED_POST:ticket.tombstone_digest",
             "reference_effective_at": "LOCKED_POST:ticket.erased_at",
             "completed_at": "LOCKED_POST:ticket.completed_at",
         }, "expectedRows": "EXACTLY_ONE_FOR_NEW_TERMINAL_TRANSITION"},
        {"phase": "TX2_FAILURE", "action": "UPDATE_CAS",
         "table": "sys_hris_listening_erasure_tickets", "role": "RELEASE_FAILED_ERASURE_LEASE",
         "selector": "tenant+ticket+CLAIMED+matching lease+owner revision AND KMS not attested destroyed",
         "assignments": {
             "state": "CONSTANT:FAILED_RETRYABLE", "owner_revision": "LOCKED_PRE:owner_revision+1",
             "failure_code": "KMS_FAILURE.closedCode", "claim_lease_public_id": "CONSTANT:NULL",
             "claim_lease_expires_at": "CONSTANT:NULL", "updated_at": "ownerClock.transactionNow",
         }, "expectedRows": "EXACTLY_ONE;NO_COMPLETION_RECEIPT_OR_TOMBSTONE"},
    ]
    erasure["privateDelivery"] = "OWNER_LOCAL_PRIVATE_BROKER_FORBIDDEN_NO_OUTBOX"
    return rows


def _materialize_owner_port_entrypoint_plans(
    static_rows: list[dict[str, Any]],
    operations: list[dict[str, Any]],
    handlers: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Project every bound owner port from its actual executable entrypoint."""
    operations_by_id = {row["operationId"]: row for row in operations}
    handlers_by_id = {row["handlerId"]: row for row in handlers}
    projected: list[dict[str, Any]] = []
    for static in static_rows:
        row = copy.deepcopy(static)
        ref = row["entrypointRef"]
        if "publicOperationId" in ref:
            entrypoint = operations_by_id[ref["publicOperationId"]]
            request_fields = copy.deepcopy(entrypoint.get("requestFields", []))
            selectors = copy.deepcopy(entrypoint.get("selectors", []))
            ordered_dml = copy.deepcopy(entrypoint.get("orderedDml", []))
            row["requestSchema"] = {
                "schemaId": row["ownerPortOperation"] + ".Request.v3",
                "additionalProperties": False,
                "fields": request_fields,
            }
            row["selectors"] = selectors
            row["orderedDml"] = ordered_dml
            public_response = copy.deepcopy(entrypoint.get("responseContract", {}))
            if not public_response:
                raise ValueError(
                    f"public owner port lacks canonical response contract: {entrypoint['operationId']}"
                )
            row["responseSchema"] = public_response["responseSchema"]
            row["responseFieldSources"] = public_response["responseFieldSources"]
            row["responseFieldPolicy"] = public_response["responseFieldPolicy"]
            binding_payload = {
                "requestFields": request_fields,
                "selectors": selectors,
                "orderedDml": ordered_dml,
            }
            binding_kind = "PUBLIC_OPERATION"
            binding_id = entrypoint["operationId"]
            bound_response_schema_ref = entrypoint["operationId"] + ".Response.v3"
            response_source_authority = "CANONICAL_EXACT_SCHEMA_OPERATION_BINDING"
        elif "systemHandlerId" in ref:
            entrypoint = handlers_by_id[ref["systemHandlerId"]]
            ordered_dml = copy.deepcopy(entrypoint.get("writes", []))
            for index, step in enumerate(ordered_dml, 1):
                step["step"] = index
            row["orderedDml"] = ordered_dml
            selectors = copy.deepcopy(entrypoint.get("selectors", []))
            row["selectors"] = selectors
            request_contract = copy.deepcopy(entrypoint.get("requestContract", {}))
            typed_request_schema = copy.deepcopy(entrypoint.get("typedRequestSchema", {}))
            if not typed_request_schema:
                raise ValueError(
                    f"handler owner port lacks one canonical typed request schema: {entrypoint['handlerId']}"
                )
            row["requestSchema"] = typed_request_schema
            row["requestSchema"]["entrypointRequestContract"] = request_contract
            binding_payload = {
                "requestContract": request_contract,
                "typedRequestSchema": typed_request_schema,
                "trigger": copy.deepcopy(entrypoint.get("trigger", {})),
                "selectors": selectors,
                "orderedDml": ordered_dml,
            }
            binding_kind = "SYSTEM_HANDLER"
            binding_id = entrypoint["handlerId"]
            bound_response_schema_ref = row["responseSchema"]["schemaId"]
            response_source_authority = "ENTRYPOINT_DURABLE_POST_STATE_OR_OWNER_RECEIPT"
        else:
            binding_payload = {
                "requestSchema": row["requestSchema"],
                "selectors": row["selectors"],
                "orderedDml": row["orderedDml"],
            }
            binding_kind = "AUTH_OWNER_SYNCHRONOUS_PORT"
            binding_id = ref["authPortHandlerId"]
            bound_response_schema_ref = row["responseSchema"]["schemaId"]
            response_source_authority = "AUTH_OWNER_DURABLE_POST_STATE_AND_SIGNED_RESULT"
        response_payload = {
            "responseSchema": row["responseSchema"],
            "responseFieldSources": row["responseFieldSources"],
            "responseFieldPolicy": row["responseFieldPolicy"],
            "errorContract": row["errorContract"],
            "receiptAndOutbox": row["receiptAndOutbox"],
        }
        binding_payload["response"] = response_payload
        row["responseExecutionBinding"] = {
            "boundSchemaRef": bound_response_schema_ref,
            "sourceAuthority": response_source_authority,
            "projection": "CLOSED_TYPED_RESPONSE_FIELD_SOURCE_ERROR_AND_RECEIPT_PLAN",
            "sha256": hashlib.sha256(
                json.dumps(
                    response_payload, ensure_ascii=False, sort_keys=True,
                    separators=(",", ":"),
                ).encode("utf-8")
            ).hexdigest(),
        }
        row["entrypointExecutionBinding"] = {
            "kind": binding_kind,
            "entrypointId": binding_id,
            "projection": "BYTE_EXACT_EXECUTABLE_REQUEST_SELECTOR_DML_PLAN",
            "sha256": hashlib.sha256(
                json.dumps(
                    binding_payload, ensure_ascii=False, sort_keys=True,
                    separators=(",", ":"),
                ).encode("utf-8")
            ).hexdigest(),
        }
        projected.append(row)
    return sorted(projected, key=lambda value: value["ownerPortOperation"])


def _public_listening_response_contract(operation: dict[str, Any]) -> dict[str, Any]:
    """Build the public Response.v3 contract shared with exact-schema output."""
    operation_id = operation["operationId"]
    if operation["mode"] == "COMMAND":
        stream = operation["listeningAuthority"]["authoritativeStreamKey"]
        receipt = {
            "platform-hris-configuration": "sys_hris_listening_operation_receipts",
            "platform-hris-listening-protected": "sys_hris_listening_protected_receipts",
            "platform-hris-insights": "sys_hris_listening_insights_inbox",
        }[stream]
        receipt_state = (
            "lifecycle_state" if receipt == "sys_hris_listening_operation_receipts"
            else "state"
        )
        root = operation["aggregateRoot"]["table"]
        fields = [
            {"name": "commandReceiptId", "type": "UUID", "required": True,
             "validation": "sealed receipt public identity", "sensitivity": "INTERNAL",
             "tokenization": "OPAQUE_PUBLIC_ID",
             "referenceContract": {"entityType": "table:" + receipt, "idSpace": "PUBLIC_UUID"}},
            {"name": "status", "type": "STRING", "required": True,
             "validation": "COMPLETED; ACCEPTED only for true async ingress",
             "sensitivity": "INTERNAL", "tokenization": "NONE"},
            {"name": "correlationId", "type": "UUID", "required": True,
             "validation": "original sealed trace correlation", "sensitivity": "INTERNAL",
             "tokenization": "OPAQUE_CORRELATION_ID", "traceContract": "Trace.Correlation"},
            {"name": "completedAt", "type": "TIMESTAMPTZ", "required": True,
             "validation": "owner completion clock", "sensitivity": "INTERNAL", "tokenization": "NONE"},
            {"name": "resultDigest", "type": "SHA256", "required": True,
             "validation": "digest of closed result JSON", "sensitivity": "INTERNAL",
             "tokenization": "NONREVERSIBLE_DIGEST"},
            {"name": "aggregatePublicId", "type": "UUID", "required": True,
             "validation": "physical post identity", "sensitivity": "INTERNAL",
             "tokenization": "OPAQUE_PUBLIC_ID",
             "referenceContract": {"entityType": "table:" + root, "idSpace": "PUBLIC_UUID"}},
            {"name": "aggregateVersion", "type": "BIGINT", "required": True,
             "validation": "physical post version", "sensitivity": "INTERNAL", "tokenization": "NONE"},
            {"name": "childResults", "type": "ARRAY", "required": True,
             "validation": "all downstream child identities in deterministic order",
             "sensitivity": "INTERNAL", "tokenization": "NONE",
             "itemSchemaRef": operation_id + ".TypedChild.v3"},
        ]
        sources = {
            "commandReceiptId": receipt + ".public_id",
            "status": receipt + "." + receipt_state,
            "correlationId": receipt + ".correlation_id",
            "completedAt": receipt + ".completed_at",
            "resultDigest": receipt + ".result_digest",
            "aggregatePublicId": root + ".public_id",
            "aggregateVersion": root + ".aggregate_version",
            "childResults": "SEALED_COMMAND_RECEIPT.post_identity_json",
        }
    else:
        detail = bool(re.search(r"\{[^}]+\}$", operation["path"]))
        item_name = "item" if detail else "items"
        fields = [
            {"name": item_name, "type": "OBJECT" if detail else "ARRAY",
             "required": True, "validation": "tenant/purpose/population/field-policy projection",
             "sensitivity": "INTERNAL", "tokenization": "NONE",
             ("schemaRef" if detail else "itemSchemaRef"): operation_id + ".Entity.v3"},
            {"name": "referenceEffectiveAt", "type": "TIMESTAMPTZ", "required": True,
             "validation": "owner as-of", "sensitivity": "INTERNAL", "tokenization": "NONE"},
            {"name": "freshnessWatermark", "type": "TIMESTAMPTZ", "required": True,
             "validation": "owner projection watermark", "sensitivity": "INTERNAL", "tokenization": "NONE"},
            {"name": "fieldPolicyRevision", "type": "BIGINT", "required": True,
             "validation": "exact policy revision", "sensitivity": "INTERNAL", "tokenization": "NONE"},
        ]
        sources = {
            item_name: "EXACT_TYPED_PROJECTION:" + "+".join(operation["readPlan"]["tables"]),
            "referenceEffectiveAt": "OWNER_PROJECTION.reference_effective_at",
            "freshnessWatermark": "OWNER_PROJECTION.freshness_watermark",
            "fieldPolicyRevision": "OWNER_FIELD_POLICY.revision",
        }
        if not detail:
            fields.extend([
                {"name": "nextCursor", "type": "STRING", "required": False,
                 "validation": "signed tenant/scope/purpose/asOf/sort cursor",
                 "sensitivity": "INTERNAL", "tokenization": "NONE"},
                {"name": "hasMore", "type": "BOOLEAN", "required": True,
                 "validation": "boolean", "sensitivity": "INTERNAL", "tokenization": "NONE"},
            ])
            sources.update({
                "nextCursor": "SERVER_SIGNED_KEYSET_CURSOR",
                "hasMore": "SERVER_DERIVE:limit+1",
            })
    return {
        "responseSchema": {
            "schemaId": operation_id + ".Response.v3",
            "kind": "OBJECT", "additionalProperties": False, "fields": fields,
        },
        "responseFieldSources": sources,
        "responseFieldPolicy": {
            "purpose": operation["authorizationCapability"],
            "behavior": "ALLOW_EXACT_NAMED_FIELD_OR_OMIT;NO_LATEST_FALLBACK",
            "denyOnUnavailable": True,
        },
    }


def _upgrade_v8_payroll_dependency(
    predecessor: dict[str, Any], manifest: dict[str, Any],
) -> dict[str, Any]:
    """Narrow v8→v10 upgrade without replaying non-idempotent older overlays."""
    result = copy.deepcopy(predecessor)
    if (
        result.get("closedSetManifest", {}).get("manifestId")
        != manifest.get("manifestId")
        or result.get("listeningCanonicalComposition")
        != composition_marker("operationCausal")
    ):
        raise ValueError("v8 payroll dependency upgrade authority drift")
    listening_dependencies = build_static_design()["ownerDependencyContracts"]
    if result.get("ownerDependencyContracts") != listening_dependencies:
        raise ValueError("v8 owner dependency predecessor is not exact")
    operations = {
        row["operationId"]: row for row in result.get("operations", [])
    }
    event = next(
        row for row in operations["modern.compplan.snapshot.publish"]["events"]
        if row.get("eventName") == PAYROLL_SNAPSHOT_EVENT
    )
    event["refetchContract"] = _compensation_payroll_event_refetch()
    _apply_compensation_payroll_event_audience(event)
    result["ownerDependencyContracts"] = [
        *copy.deepcopy(listening_dependencies),
        _compensation_payroll_owner_dependency(),
    ]
    result["ownerPortContractClosure"]["ownerDependencyContracts"] = 2
    result["scope"]["ownerDependencyContracts"] = 2
    result["closedSetManifest"] = {
        "manifestId": manifest["manifestId"],
        "sealedPayloadSha256": manifest["sealedPayloadSha256"],
        "fileSha256": hashlib.sha256(
            (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode(
                "utf-8"
            )
        ).hexdigest(),
        "path": MANIFEST.name,
        "countsAreDerivedOnly": True,
    }
    result["sourceProjectionVersion"] = OPERATION_SUCCESSOR_PROJECTION_VERSION
    stamp_canonical_document(result, "operationCausal")
    return result


def compose(predecessor: dict[str, Any], manifest: dict[str, Any]) -> dict[str, Any]:
    # A document already emitted by this exact source projection is a fixed
    # point.  This is intentionally versioned separately from the static
    # Listening design seal: changing generator semantics requires bumping the
    # projection version, while --check/second-pass composition remains byte
    # idempotent for the same source version.
    if (
        predecessor.get("sourceProjectionVersion")
        == OPERATION_SUCCESSOR_PROJECTION_VERSION
        and predecessor.get("closedSetManifest", {}).get("manifestId")
        == manifest["manifestId"]
        and predecessor.get("listeningCanonicalComposition")
        == composition_marker("operationCausal")
    ):
        return copy.deepcopy(predecessor)
    if (
        predecessor.get("sourceProjectionVersion")
        == PREVIOUS_OPERATION_SUCCESSOR_PROJECTION_VERSION
    ):
        return _upgrade_v8_payroll_dependency(predecessor, manifest)
    operations = [
        _normalize_existing(row) for row in predecessor["operations"]
        if row["operationId"] not in REMOVED_OPERATION_IDS
        and row["operationId"] not in NEW_COMMAND_RUNTIME
        and row["operationId"] not in NEW_QUERY_RUNTIME
    ]
    # Exact replacement, not an alias: old analytics cohorts response cannot
    # survive as the new projection re-entry contract.
    for row in operations:
        if row["operationId"] == "modern.analytics.cohorts.query":
            raise ValueError("removed analytics alias survived")
    for operation_id in sorted(NEW_COMMAND_RUNTIME):
        operations.append(_new_command(predecessor, operation_id))
    for operation_id in sorted(NEW_QUERY_RUNTIME):
        operations.append(_new_query(predecessor, operation_id))
    operations.sort(key=lambda row: row["operationId"])
    _listening_operation_overlay(predecessor, operations)
    for operation in operations:
        _semantic_operation_overlay(operation)

    result = copy.deepcopy(predecessor)
    result["operations"] = operations
    result["systemHandlers"] = [
        *[_non_listening_handler(key, value)
          for key, value in sorted(NON_LISTENING_HANDLER_EVENTS.items())],
        *_listening_handlers(),
    ]
    result["systemHandlers"].sort(key=lambda row: row["handlerId"])

    event_owners = []
    for operation in operations:
        for event in operation.get("events", []):
            event_owners.append({
                "eventName": event["eventName"], "primaryOwnerSession": operation["session"],
                "producerKind": "PUBLIC_COMMAND", "producerId": operation["operationId"],
                "contractBoundary": "PUBLIC_ASYNCAPI_EVENT",
                "ownershipCardinality": "EXACTLY_ONE",
            })
    for handler in result["systemHandlers"]:
        for handler_event in ([handler["event"]] if handler.get("event") else []) + handler.get("additionalEvents", []):
            event_owners.append({
                "eventName": handler_event["eventName"],
                "primaryOwnerSession": handler["session"],
                "producerKind": "INTERNAL_OWNER_HANDLER", "producerId": handler["handlerId"],
                "contractBoundary": "PUBLIC_ASYNCAPI_EVENT",
                "ownershipCardinality": "EXACTLY_ONE",
            })
    if len(event_owners) != len({row["eventName"] for row in event_owners}):
        duplicates = sorted(
            name for name in {row["eventName"] for row in event_owners}
            if sum(row["eventName"] == name for row in event_owners) > 1
        )
        raise ValueError(f"duplicate public event producer: {duplicates}")
    result["publicEventOwnership"] = {
        "boundaryDecision": "EXACT_ONE_PRODUCER_PER_PUBLIC_EVENT",
        "events": sorted(event_owners, key=lambda row: row["eventName"]),
        "expectedOwnedEventCount": len(event_owners),
        "expectedOwnerCountsBySession": {
            session: sum(row["primaryOwnerSession"] == session for row in event_owners)
            for session in ("HRIS-HRM", "HRIS-PER", "HRIS-TIM", "HRIS-SYS")
        },
        "registerMigration": "SOURCE_DERIVED_FROM_CLOSED_SET_MANIFEST",
    }
    result["eventSuccessorLineage"] = [{
        "predecessorEvent": old, "disposition": "REMOVED_OR_SUPERSEDED",
        "successorEvents": ([REPLACED_PUBLIC_EVENT_IDS[old]]
                            if old in REPLACED_PUBLIC_EVENT_IDS else []),
        "reason": "REVIEWED_CLOSED_SET_CAUSAL_OR_PRIVACY_CORRECTION",
        "orphanForbidden": True,
    } for old in sorted(REMOVED_PUBLIC_EVENT_IDS | set(REPLACED_PUBLIC_EVENT_IDS))]
    scope = manifest["scope"]
    result["scope"] = {
        "operations": scope["operations"], "commands": scope["commands"],
        "queries": scope["queries"],
        "commandCausedPrimaryFactsMinimum": sum(
            bool(row.get("events")) for row in operations if row["mode"] == "COMMAND"
        ),
        "conditionalOrSystemFactsAllowedAboveMinimum": True,
        "conditionalCommandFacts": sum(
            max(0, len(row.get("events", [])) - 1)
            for row in operations if row["mode"] == "COMMAND"
        ),
        "systemHandlerFacts": sum(
            bool(row.get("event")) + len(row.get("additionalEvents", []))
            for row in result["systemHandlers"]
        ),
        "reviewedSuccessorEventSchemas": len(event_owners),
        "stablePredecessorEvents": "SOURCE_DERIVED",
    }
    result["schemaOracle"]["expectedTables"] = list(manifest["tableIds"])
    result["schemaOracle"]["expectedTableCount"] = len(manifest["tableIds"])
    result["closedSetManifest"] = {
        "manifestId": manifest["manifestId"],
        "sealedPayloadSha256": manifest["sealedPayloadSha256"],
        "fileSha256": hashlib.sha256(
            (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
        ).hexdigest(),
        "path": MANIFEST.name,
        "countsAreDerivedOnly": True,
    }
    listening_design = build_static_design()
    operations_by_id = {row["operationId"]: row for row in operations}
    for owner_port in listening_design["ownerPortOperationContracts"]:
        public_operation_id = owner_port.get("entrypointRef", {}).get("publicOperationId")
        if public_operation_id:
            operations_by_id[public_operation_id]["responseContract"] = (
                _public_listening_response_contract(operations_by_id[public_operation_id])
            )
    result["ownerPortOperationContracts"] = _materialize_owner_port_entrypoint_plans(
        listening_design["ownerPortOperationContracts"],
        operations,
        result["systemHandlers"],
    )
    result["ownerDependencyContracts"] = copy.deepcopy(
        listening_design["ownerDependencyContracts"]
    ) + [_compensation_payroll_owner_dependency()]
    result["ownerPortContractClosure"] = {
        "count": len(result["ownerPortOperationContracts"]),
        "exactOwnerPortOperations": sorted(
            row["ownerPortOperation"] for row in result["ownerPortOperationContracts"]
        ),
        "canonicalPrecedence": "EXECUTABLE_ROWS_IN_OPERATION_CAUSAL_SSOT",
        "staticDesignDigest": static_design_digest(),
        "publicOperationRefs": sum(
            "publicOperationId" in row["entrypointRef"]
            for row in result["ownerPortOperationContracts"]
        ),
        "systemHandlerRefs": sum(
            "systemHandlerId" in row["entrypointRef"]
            for row in result["ownerPortOperationContracts"]
        ),
        "authPortHandlerRefs": sum(
            "authPortHandlerId" in row["entrypointRef"]
            for row in result["ownerPortOperationContracts"]
        ),
        "ownerDependencyContracts": len(result["ownerDependencyContracts"]),
    }
    result["scope"]["ownerPortOperationContracts"] = len(
        result["ownerPortOperationContracts"]
    )
    result["scope"]["ownerDependencyContracts"] = len(
        result["ownerDependencyContracts"]
    )
    result["policies"].update({
        "idempotency": (
            "tuple=tenant+caller+operation+key; digest=canonical method/path/selectors/body;"
            "correlation,key,auth,purpose,population excluded"
        ),
        "closedResponseSource": "PHYSICAL_POST|SEALED_COMMAND_RECEIPT|IMMUTABLE_PROOF_ONLY",
        "eventBusinessSource": "PHYSICAL_POST|LOCKED_PRE|IMMUTABLE_OWNER_PROOF_ONLY",
        "queryReentry": "EXACT_QUERY_RESPONSE_ENTITY_PHYSICAL_SOURCE_PEP_TUPLE",
        "collectionOrdinal": "EXPLICIT_TARGET_ORDER_TIEBREAKER_CHECK_INTERSECTION_FAIL_CLOSED",
        "decision": (
            "POLICY_OR_CONFIRMATION_INPUT_REQUIRES_SAME_TRANSACTION_TYPED_DOMAIN_FACT_OR_"
            "IMMUTABLE_OWNER_PROOF;COMMAND_RECEIPT_BUSINESS_PROVENANCE_FORBIDDEN"
        ),
    })
    for value_object_name in (
        "BenefitCoverageOption.v1", "ApprovedCompensationSnapshotLine.v1",
    ):
        value_object = result["valueObjects"][value_object_name]
        existing = {row["name"] for row in value_object.get("fields", [])}
        for field in (
            {"name": "frequencyCode", "type": "STRING", "required": True},
            {"name": "basisCode", "type": "STRING", "required": True},
            {
                "name": "fxSnapshotPublicId", "type": "UUID", "required": False,
                "referenceContract": {
                    "entityType": "DWP.Finance.FxSnapshot", "idSpace": "PUBLIC_UUID",
                },
            },
        ):
            if field["name"] not in existing:
                value_object.setdefault("fields", []).append(field)
        value_object["moneyContract"] = {
            "originalCurrencyPreserved": True,
            "frequencyAndBasisRequired": True,
            "fxSnapshotRule": "REQUIRED_IFF_CONVERSION_OCCURRED;FORBIDDEN_OTHERWISE",
            "opaqueDigestSubstitutionForbidden": True,
        }
    result["sourceProjectionVersion"] = OPERATION_SUCCESSOR_PROJECTION_VERSION
    stamp_canonical_document(result, "operationCausal")
    return result


def _validate_true_positive_query_read_closure(result: dict[str, Any]) -> None:
    """Close the seven reviewed candidate defects at the authored source.

    This is intentionally stricter than a table-name membership check.  Every
    affected response field is tied to one tenant-safe, immutable child join;
    the child and every anchor must be executable read and projection sources.
    Exact structural equality makes an invented column, relaxed subject scope,
    or mutable-latest selector a source-generation failure.
    """

    operations = {row["operationId"]: row for row in result.get("operations", [])}
    for operation_id, expected_contracts in QUERY_CHILD_READ_CONTRACTS.items():
        operation = operations.get(operation_id)
        if operation is None or operation.get("mode") != "QUERY":
            raise ValueError(f"reviewed child projection query missing: {operation_id}")
        read_plan = operation.get("readPlan", {})
        read_tables = set(read_plan.get("tables", []))
        projection = read_plan.get("projectionTuple", {})
        physical_sources = set(projection.get("physicalSources", []))
        actual_contracts = read_plan.get("joinContracts")
        if actual_contracts != list(expected_contracts):
            raise ValueError(f"exact child read/join contract drift: {operation_id}")
        if physical_sources != read_tables:
            raise ValueError(f"child projection physical/read source drift: {operation_id}")
        pep = projection.get("pep", {})
        if (
            pep.get("tenant") != "authenticatedPrincipal.tenantId at every physical source"
            or pep.get("purpose") != operation.get("authorizationCapability")
            or pep.get("population") != "authorization.populationScope exact"
            or pep.get("fieldPolicy")
            != "authorization.fieldPolicyRevision exact allowlist/mask"
            or pep.get("denyOnUnavailable") is not True
            or projection.get("tenantPep")
            != "tenant_id=authenticatedPrincipal.tenantId at every source and join"
        ):
            raise ValueError(f"child projection PEP drift: {operation_id}")
        for contract in actual_contracts:
            required_sources = {
                contract["childTable"], *contract.get("anchorTables", []),
            }
            if not required_sources <= read_tables or not required_sources <= physical_sources:
                raise ValueError(f"child projection executable source missing: {operation_id}")
            tenant_predicate = contract.get("tenantPredicate", "")
            if (
                "authenticatedPrincipal.tenantId" not in tenant_predicate
                or any(table + ".tenant_id" not in tenant_predicate for table in required_sources)
            ):
                raise ValueError(f"child projection tenant join drift: {operation_id}")
            if not contract.get("identityPredicates") or not contract.get("revisionPredicate"):
                raise ValueError(f"child projection identity/revision join missing: {operation_id}")
            if not contract.get("subjectPredicate") or "populationScope" not in contract["subjectPredicate"]:
                raise ValueError(f"child projection subject scope drift: {operation_id}")
            if not str(contract.get("selectionRule", "")).endswith(
                "LATEST_MAX_FALLBACK_FORBIDDEN"
            ):
                raise ValueError(f"child projection latest fallback drift: {operation_id}")
            field_sources = contract.get("fieldSources", {})
            if len(field_sources) < 2:
                raise ValueError(f"child projection direct field binding missing: {operation_id}")
            for response_field, source in field_sources.items():
                if (
                    not response_field
                    or re.fullmatch(
                        re.escape(contract["childTable"]) + r"\.[a-z][a-z0-9_]*",
                        str(source),
                    ) is None
                ):
                    raise ValueError(
                        f"child projection physical field source drift: "
                        f"{operation_id}.{response_field}"
                    )


def _validate_source_semantic_regression_closure(result: dict[str, Any]) -> None:
    """Fail closed on the P0 semantics most vulnerable to projection drift."""
    operations = {row["operationId"]: row for row in result.get("operations", [])}
    _validate_true_positive_query_read_closure(result)
    active = operations["modern.listening.active.query"]
    active_credential = "headers.X-Listening-Participation-Credential"
    if (
        [row.get("source") for row in active.get("requestFields", [])]
        != [active_credential]
        or {row.get("source") for row in active.get("selectors", [])}
        != {active_credential + ".admissionPublicId", active_credential + ".aud"}
    ):
        raise ValueError("active Listening nested credential selector closure drift")

    submit = operations["modern.listening.response.submit"]
    if (
        {row.get("source") for row in submit.get("requestFields", [])}
        != {
            "pathParameters.surveyId", "body.signedParticipationCredential",
            "body.responseToken", "body.answers",
        }
        or {row.get("source") for row in submit.get("selectors", [])}
        != {
            "body.signedParticipationCredential.admissionPublicId",
            "body.signedParticipationCredential.aud",
        }
    ):
        raise ValueError("submit Listening closed request/nested selector closure drift")
    expected_submit_roles = [
        "PROTECTED_TOKEN_RECEIPT_CLAIM", "LATEST_STABLE_ADMISSION_FENCE",
        "ONE_TIME_TOKEN_CONSUMPTION", "ANONYMOUS_RESPONSE_WITH_PER_RESPONSE_DEK",
        "ENCRYPTED_TYPED_ANSWER_VALUES", "TOKEN_CONSUMPTION_BIND_RESPONSE",
        "PROTECTED_TOKEN_RECEIPT_CLOSE",
    ]
    if (
        [row.get("role") for row in submit.get("orderedDml", [])]
        != expected_submit_roles
        or [row.get("step") for row in submit.get("orderedDml", [])]
        != list(range(1, 8))
        or submit.get("transactionEnvelope", {}).get("privateDelivery")
        != "OWNER_LOCAL_RESPONSE_ONLY_BROKER_AND_PUBLIC_OUTBOX_FORBIDDEN"
        or submit.get("events")
        or any(
            "outbox" in str(row.get("table", "")).lower()
            or "OUTBOX" in str(row.get("role", "")).upper()
            for row in submit.get("orderedDml", [])
        )
    ):
        raise ValueError("submit Listening seven-step private-no-broker closure drift")

    learning = operations["modern.learning.completion.verify"]
    learning_steps = [
        row for row in learning.get("orderedDml", [])
        if row.get("table") == "prf_lrn_completion_skill_evidence_refs"
    ]
    owner_member_prefix = "ownerProof.body.evidencePublicId."
    owner_member_uses = sorted(
        (
            str(row.get("table", "")), str(field), source,
        )
        for row in learning.get("orderedDml", [])
        for field, source in (row.get("assignments") or {}).items()
        if isinstance(source, str) and owner_member_prefix in source
    )
    expected_owner_member_uses = sorted([
        (
            "prf_lrn_completion_skill_evidence_refs",
            "skill_evidence_public_id",
            LEARNING_SKILL_EVIDENCE_OWNER_SOURCE,
        ),
        (
            "prf_lrn_completion_skill_evidence_refs",
            "worker_skill_evidence_id",
            LEARNING_WORKER_SKILL_EVIDENCE_SELECTOR,
        ),
    ])
    if (
        len(learning_steps) != 1
        or learning_steps[0].get("action") != "APPEND_MANY"
        or learning_steps[0].get("role") != "TYPED_ORDERED_CHILD_REFERENCE"
        or owner_member_uses != expected_owner_member_uses
        or "body.skillEvidenceIds" in json.dumps(
            learning.get("orderedDml", []), ensure_ascii=False
        )
    ):
        raise ValueError("learning completion skill evidence owner-proof derivation drift")

    workforce_handler = next(
        row for row in result.get("systemHandlers", [])
        if row.get("handlerId") == "internal.workforceplan.simulation-result.consume"
    )
    workforce_events = [
        workforce_handler.get("event", {}),
        *workforce_handler.get("additionalEvents", []),
    ]
    for event in workforce_events:
        refetch = event.get("refetchContract", {})
        owner = refetch.get("resultOwnerContract", {})
        if (
            refetch.get("mode") != "FORBIDDEN"
            or refetch.get("aggregateLookup") != "FORBIDDEN"
            or refetch.get("latestFallback") != "FORBIDDEN"
            or any(key in refetch for key in (
                "endpointOperationId", "entityType", "version", "asOf",
            ))
            or set(owner) != {
                "requiredFields", "identity", "validation", "denyOnUnavailable",
            }
            or owner.get("requiredFields") != list(WFP_RESULT_OWNER_REQUIRED_FIELDS)
            or owner.get("identity") != WFP_RESULT_OWNER_IDENTITY
            or owner.get("validation") != WFP_RESULT_OWNER_VALIDATION
            or owner.get("denyOnUnavailable") is not True
        ):
            raise ValueError(
                f"WFP payload-sufficient forbidden refetch drift: {event.get('eventName')}"
            )

    payroll_dependencies = [
        row for row in result.get("ownerDependencyContracts", [])
        if row.get("dependencyContractId") == PAYROLL_SNAPSHOT_DEPENDENCY_ID
    ]
    payroll_events = [
        event
        for event in operations["modern.compplan.snapshot.publish"].get("events", [])
        if event.get("eventName") == PAYROLL_SNAPSHOT_EVENT
    ]
    if (
        payroll_dependencies != [_compensation_payroll_owner_dependency()]
        or len(payroll_events) != 1
        or payroll_events[0].get("refetchContract")
        != _compensation_payroll_event_refetch()
        or "HRIS-PAY" not in payroll_events[0].get("audience", {}).get(
            "allowedConsumerSessions", []
        )
        or PAYROLL_SNAPSHOT_PURPOSE not in payroll_events[0].get(
            "audience", {}
        ).get("allowedPurposes", [])
        or payroll_events[0].get("audience", {}).get("consumerFieldExposure")
        != _compensation_payroll_consumer_field_exposure(payroll_events[0])
        or "lines" in {
            field.get("name") for field in payroll_events[0].get("fields", [])
        }
    ):
        raise ValueError("PAY exact owner-dependency source closure drift")


def _run_source_semantic_mutation_selftests(result: dict[str, Any]) -> None:
    """Prove the author-side closure rejects exact hostile mutations."""
    def operation(value: dict[str, Any], operation_id: str) -> dict[str, Any]:
        return next(row for row in value["operations"] if row["operationId"] == operation_id)

    def handler(value: dict[str, Any]) -> dict[str, Any]:
        return next(
            row for row in value["systemHandlers"]
            if row["handlerId"] == "internal.workforceplan.simulation-result.consume"
        )

    def add_submit_legacy_envelope(value: dict[str, Any]) -> None:
        operation(value, "modern.listening.response.submit")["requestFields"].append({
            "source": "body.participationEnvelope", "name": "participationEnvelope",
            "location": "body", "type": "OBJECT", "required": True,
        })

    def add_submit_outbox(value: dict[str, Any]) -> None:
        operation(value, "modern.listening.response.submit")["orderedDml"].append({
            "step": 8, "action": "APPEND", "table": "sys_hris_listening_protected_outbox",
            "role": "TRANSACTIONAL_OUTBOX",
        })

    def remove_active_audience(value: dict[str, Any]) -> None:
        row = operation(value, "modern.listening.active.query")
        row["selectors"] = [
            selector for selector in row["selectors"]
            if not str(selector.get("source", "")).endswith(".aud")
        ]

    def restore_learning_ghost(value: dict[str, Any]) -> None:
        row = operation(value, "modern.learning.completion.verify")
        text = json.dumps(row["orderedDml"], ensure_ascii=False)
        row["orderedDml"] = json.loads(text.replace(
            LEARNING_SKILL_EVIDENCE_OWNER_SOURCE,
            "body.skillEvidenceIds[*]",
        ))

    def rename_learning_owner_member(value: dict[str, Any]) -> None:
        row = operation(value, "modern.learning.completion.verify")
        text = json.dumps(row["orderedDml"], ensure_ascii=False)
        row["orderedDml"] = json.loads(text.replace(
            LEARNING_SKILL_EVIDENCE_OWNER_SOURCE,
            "ownerProof.body.evidencePublicId.unreviewedSkillEvidenceIds[*]",
        ))

    def add_learning_owner_sibling(value: dict[str, Any]) -> None:
        row = operation(value, "modern.learning.completion.verify")
        step = next(
            item for item in row["orderedDml"]
            if item.get("table") == "prf_lrn_completion_skill_evidence_refs"
        )
        step["assignments"]["unreviewed_skill_evidence_public_id"] = (
            "ownerProof.body.evidencePublicId.unreviewedSkillEvidenceIds[*]"
        )

    def add_wfp_endpoint_hint(value: dict[str, Any]) -> None:
        handler(value)["event"]["refetchContract"]["endpointOperationId"] = (
            "modern.workforceplan.scenario.query"
        )

    def remove_wfp_owner_digest(value: dict[str, Any]) -> None:
        handler(value)["additionalEvents"][0]["refetchContract"][
            "resultOwnerContract"
        ]["requiredFields"].remove("resultDigest")

    def trust_unverified_wfp_success(value: dict[str, Any]) -> None:
        handler(value)["event"]["refetchContract"]["resultOwnerContract"][
            "validation"
        ] = "TRUST_UNVERIFIED_RESULT"

    def drift_wfp_failure_validation(value: dict[str, Any]) -> None:
        handler(value)["additionalEvents"][0]["refetchContract"][
            "resultOwnerContract"
        ]["validation"] = "SIGNED_OWNER_RESULT_MATCHES_LATEST_RESULT"

    def payroll_dependency(value: dict[str, Any]) -> dict[str, Any]:
        return next(
            row for row in value["ownerDependencyContracts"]
            if row.get("dependencyContractId") == PAYROLL_SNAPSHOT_DEPENDENCY_ID
        )

    def payroll_event(value: dict[str, Any]) -> dict[str, Any]:
        return next(
            row for row in operation(
                value, "modern.compplan.snapshot.publish"
            )["events"]
            if row.get("eventName") == PAYROLL_SNAPSHOT_EVENT
        )

    def allow_payroll_latest(value: dict[str, Any]) -> None:
        payroll_dependency(value)["latestFallback"] = "ALLOWED"

    def allow_payroll_write(value: dict[str, Any]) -> None:
        payroll_dependency(value)["writes"] = "ALLOWED"

    def drift_payroll_dependency_pin(value: dict[str, Any]) -> None:
        payroll_event(value)["refetchContract"]["dependencyContractSha256"] = "0" * 64

    def leak_payroll_lines_to_event(value: dict[str, Any]) -> None:
        payroll_event(value)["fields"].append({
            "name": "lines", "type": "ARRAY", "required": True,
            "sourceKind": "PHYSICAL_POST_STATE",
            "source": "prf_cmp_approved_snapshot_lines.*",
        })

    def drift_payroll_tenant_envelope(value: dict[str, Any]) -> None:
        payroll_event(value)["refetchContract"]["selectorTuple"][0] = (
            "event.tenantId"
        )

    def expand_payroll_consumer_exposure(value: dict[str, Any]) -> None:
        payroll_event(value)["audience"]["consumerFieldExposure"]["HRIS-PAY"][
            "fields"
        ].append("approvalInputDigest")

    mutators = {
        "legacy-participation-envelope": add_submit_legacy_envelope,
        "protected-submit-outbox": add_submit_outbox,
        "active-audience-selector-removal": remove_active_audience,
        "learning-ghost-body-source": restore_learning_ghost,
        "learning-owner-proof-member-rename": rename_learning_owner_member,
        "learning-owner-proof-sibling-addition": add_learning_owner_sibling,
        "wfp-forbidden-endpoint-hint": add_wfp_endpoint_hint,
        "wfp-result-proof-member-removal": remove_wfp_owner_digest,
        "wfp-success-unverified-result-trust": trust_unverified_wfp_success,
        "wfp-failure-result-validation-drift": drift_wfp_failure_validation,
        "payroll-latest-fallback": allow_payroll_latest,
        "payroll-read-only-write-drift": allow_payroll_write,
        "payroll-dependency-pin-drift": drift_payroll_dependency_pin,
        "payroll-event-line-leak": leak_payroll_lines_to_event,
        "payroll-tenant-envelope-drift": drift_payroll_tenant_envelope,
        "payroll-consumer-field-expansion": expand_payroll_consumer_exposure,
    }

    def child_query_mutator(operation_id: str, mutation: str):
        def mutate(value: dict[str, Any]) -> None:
            row = operation(value, operation_id)
            contract = row["readPlan"]["joinContracts"][0]
            child_table = contract["childTable"]
            if mutation == "missing-read-table":
                row["readPlan"]["tables"].remove(child_table)
            elif mutation == "missing-physical-source":
                row["readPlan"]["projectionTuple"]["physicalSources"].remove(
                    child_table
                )
            elif mutation == "tenant-join-relaxed":
                contract["tenantPredicate"] = (
                    child_table + ".tenant_id IS NOT NULL"
                )
            elif mutation == "wrong-field-column":
                field_name = sorted(contract["fieldSources"])[0]
                contract["fieldSources"][field_name] = child_table + ".latest_value"
            elif mutation == "latest-fallback-enabled":
                contract["selectionRule"] = "MAX_CREATED_AT_LATEST_FALLBACK_ALLOWED"
            else:  # pragma: no cover - authored closed mutation enum
                raise AssertionError(mutation)
        return mutate

    # Exercise every affected query for all five failure modes.  A single
    # representative test would allow a future operation-specific relaxation
    # to escape while the shared validator still appeared covered.
    for query_id in sorted(QUERY_CHILD_READ_CONTRACTS):
        for hostile_kind in (
            "missing-read-table", "missing-physical-source",
            "tenant-join-relaxed", "wrong-field-column",
            "latest-fallback-enabled",
        ):
            mutators[f"{query_id}:{hostile_kind}"] = child_query_mutator(
                query_id, hostile_kind
            )
    undetected: list[str] = []
    for name, mutate in mutators.items():
        hostile = copy.deepcopy(result)
        mutate(hostile)
        try:
            _validate_source_semantic_regression_closure(hostile)
        except ValueError:
            continue
        undetected.append(name)
    if undetected:
        raise ValueError(f"source semantic hostile selftests undetected: {undetected}")


def validate(result: dict[str, Any], manifest: dict[str, Any]) -> None:
    expected_ops = {row["operationId"] for row in manifest["operations"]}
    operations = result["operations"]
    if manifest.get("scope", {}).get("ownerDependencyContracts") != 2:
        raise ValueError("manifest owner dependency count is not global exact two")
    expected_manifest_link = {
        "manifestId": manifest["manifestId"],
        "sealedPayloadSha256": manifest["sealedPayloadSha256"],
        "fileSha256": hashlib.sha256(
            (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode(
                "utf-8"
            )
        ).hexdigest(),
        "path": MANIFEST.name,
        "countsAreDerivedOnly": True,
    }
    if result.get("closedSetManifest") != expected_manifest_link:
        raise ValueError("operation SSOT closed-set manifest byte/seal pin drift")
    if {row["operationId"] for row in operations} != expected_ops or len(operations) != len(expected_ops):
        raise ValueError("operation SSOT does not match immutable manifest")
    if result.get("listeningCanonicalComposition") != composition_marker("operationCausal"):
        raise ValueError("operation SSOT Listening marker drift")
    handlers = result["systemHandlers"]
    if {row["handlerId"] for row in handlers} != set(manifest["handlerIds"]):
        raise ValueError("handler set does not match immutable manifest")
    event_ids = {
        event["eventName"] for row in operations for event in row.get("events", [])
    } | {
        row["event"]["eventName"] for row in handlers if row.get("event")
    } | {
        event["eventName"] for row in handlers for event in row.get("additionalEvents", [])
    }
    if event_ids != set(manifest["publicEventIds"]):
        raise ValueError("public event set does not match immutable manifest")
    _validate_source_semantic_regression_closure(result)
    _run_source_semantic_mutation_selftests(result)
    for row in operations:
        correlation = [
            field for field in row.get("requestFields", [])
            if field.get("name") == "X-Correlation-ID"
        ]
        anonymous = row["operationId"] in {
            "modern.listening.active.query", "modern.listening.response.submit",
        }
        if (not anonymous and (
            len(correlation) != 1 or correlation[0].get("traceContract") != "Trace.Correlation"
        )) or (anonymous and correlation):
            raise ValueError(f"correlation trace contract missing: {row['operationId']}")
        if row["mode"] == "COMMAND":
            digest_members = {
                effect["source"] for effect in row.get("inputEffects", [])
                if effect.get("requestDigestMember")
            }
            if digest_members & {"headers.X-Correlation-ID", "headers.Idempotency-Key"}:
                raise ValueError(f"trace/replay control leaked into digest: {row['operationId']}")
    forbidden_events = REMOVED_PUBLIC_EVENT_IDS | {"EmployeeListeningResponseSubmitted.v2"}
    if event_ids & forbidden_events:
        raise ValueError(f"forbidden public events survived: {sorted(event_ids & forbidden_events)}")
    if "PERSISTED_DECISION_RECEIPT" in json.dumps(result, ensure_ascii=False):
        raise ValueError("command receipt survived as business decision provenance")

    tuple_keys = {
        "queryOperation", "responseSchema", "entity", "physicalSources", "pep",
        "tenantPep", "purpose", "population", "fieldPolicy", "asOf", "freshness",
        "pagination", "writesForbidden", "receiptsForbidden", "outboxForbidden",
        "deepLinkWithoutCommandReceipt",
    }
    queries = [row for row in operations if row["mode"] == "QUERY"]
    for row in queries:
        read_plan = row.get("readPlan", {})
        projection = read_plan.get("projectionTuple", {})
        if set(projection) != tuple_keys:
            raise ValueError(f"query projection tuple is not exact: {row['operationId']}")
        if projection["queryOperation"] != row["operationId"]:
            raise ValueError(f"query operation self-reference drift: {row['operationId']}")
        if projection["responseSchema"] != row["operationId"] + ".Response.v3":
            raise ValueError(f"query response schema drift: {row['operationId']}")
        if projection["physicalSources"] != read_plan.get("tables"):
            raise ValueError(f"query physical source drift: {row['operationId']}")
        if not all(projection[key] is True for key in (
            "writesForbidden", "receiptsForbidden", "outboxForbidden",
            "deepLinkWithoutCommandReceipt",
        )):
            raise ValueError(f"query mutation/deeplink prohibition drift: {row['operationId']}")
        if any(value in projection["physicalSources"] for value in (
            "sys_hris_listening_cohort_results",
        )):
            raise ValueError(f"query uses retired Listening table: {row['operationId']}")
    if len(queries) != manifest["scope"]["queries"]:
        raise ValueError("source-derived query tuple coverage drift")

    by_operation = {row["operationId"]: row for row in operations}
    active = by_operation["modern.listening.active.query"]
    active_serialized = json.dumps(active, ensure_ascii=False)
    if (
        "authenticatedPrincipal" in active_serialized
        or "authorization." in active_serialized
        or active.get("selectors", [{}])[0].get("selectorType")
        != "PROTECTED_LOCAL_LATEST_STABLE_ADMISSION_FENCE"
        or active.get("selectors", [{}])[0].get("targetTable")
        != "sys_hris_listening_admission_versions"
    ):
        raise ValueError("anonymous active query was rebound to principal or foreign owner")
    submit = by_operation["modern.listening.response.submit"]
    if (
        len(submit.get("orderedDml", [])) != 7
        or submit.get("selectors", [{}])[0].get("selectorType")
        != "PROTECTED_LOCAL_LATEST_STABLE_ADMISSION_FENCE"
        or submit.get("transactionEnvelope", {}).get("privateDelivery")
        != "OWNER_LOCAL_RESPONSE_ONLY_BROKER_AND_PUBLIC_OUTBOX_FORBIDDEN"
        or any("outbox" in step.get("table", "") for step in submit.get("orderedDml", []))
    ):
        raise ValueError("protected anonymous submission closure drift")
    for operation_id in {
        "modern.listening.survey.publish", "modern.listening.survey.close",
    }:
        steps = by_operation[operation_id]["orderedDml"]
        if [row.get("step") for row in steps] != list(range(1, len(steps) + 1)):
            raise ValueError(f"Listening saga DML order is not contiguous: {operation_id}")
    if any(
        field.get("name") == "portabilityExportRequested"
        for field in by_operation["modern.growth.profile.archive"].get("requestFields", [])
    ):
        raise ValueError("archive still multiplexes portability export")
    for (operation_id, _), (table, column) in DECISION_FACT_TARGETS.items():
        row = by_operation[operation_id]
        if not any(
            step.get("table") == table and column in step.get("assignments", {})
            for step in row.get("orderedDml", [])
        ):
            raise ValueError(f"typed decision fact assignment missing: {operation_id}")
    if len(PROVENANCE_CLOSURE_TARGETS) != 16:
        raise ValueError("reviewer/pre-remediation provenance union is not 16 operations")
    for operation_id, (table, required_columns) in PROVENANCE_CLOSURE_TARGETS.items():
        steps = [
            step for step in by_operation[operation_id].get("orderedDml", [])
            if step.get("table") == table
            and step.get("role") not in {"COMMAND_RECEIPT", "TRANSACTIONAL_OUTBOX"}
        ]
        assigned = set().union(*(set(step.get("assignments", {})) for step in steps))
        if not required_columns <= assigned:
            raise ValueError(
                f"typed provenance same-tx assignment missing: {operation_id} "
                f"{sorted(required_columns - assigned)}"
            )
    for operation_id, table in PUBLISH_PROOF_TABLE.items():
        steps = [
            step for step in by_operation[operation_id].get("orderedDml", [])
            if step.get("table") == table
        ]
        if len(steps) != 1 or not set(APPROVAL_PROOF_COLUMNS) <= set(
            steps[0].get("assignments", {})
        ):
            raise ValueError(f"durable publish approval proof missing: {operation_id}")
        assignment_text = json.dumps(steps[0].get("assignments", {}))
        if "command_receipts" in assignment_text or "SEALED_COMMAND_RECEIPT" in assignment_text:
            raise ValueError(f"publish proof depends on command receipt: {operation_id}")
        if table in {
            "ppl_rec_requisition_publish_receipts", "prf_lrn_offering_publish_receipts",
            "prf_mkt_opportunity_publish_receipts", "prf_suc_publish_receipts",
        }:
            required_sources = {
                table + "." + column
                for column in (
                    *APPROVAL_PROOF_COLUMNS, "parent_public_id", "parent_version",
                    "payload_digest",
                )
            }
            observed_sources = {
                field.get("source")
                for event in by_operation[operation_id].get("events", [])
                for field in event.get("fields", [])
            }
            if not required_sources <= observed_sources:
                raise ValueError(
                    f"publish event does not consume immutable proof ledger: {operation_id}"
                )
    handler_by_id = {row["handlerId"]: row for row in handlers}
    for handler_id in NON_LISTENING_HANDLER_EVENTS:
        idempotency = handler_by_id[handler_id].get("idempotency", {})
        if idempotency != {
            "scope": "tenant+handler+eventId",
            "claimKey": "tenant+handler+eventId",
            "storedPayloadDigest": "handlerContext.payloadDigest",
            "sameDigest": "RETURN_SEALED_FIRST_RESULT_ZERO_WRITES",
            "differentDigest": "CONFLICT_ZERO_DOMAIN_ACK_OUTBOX_MUTATION",
            "claimOrder": "CLAIM_INBOX_BEFORE_DOMAIN_READ_OR_WRITE",
        }:
            raise ValueError(f"handler inbox idempotency contract drift: {handler_id}")
    for handler_id, table in (
        ("internal.benefits.provider-result.consume", "ppl_bnf_provider_receipts"),
        ("internal.hrservice.sla-milestone.consume", "ppl_hrs_sla_receipts"),
    ):
        if not any(
            row.get("table") == table and row.get("action") == "APPEND"
            for row in handler_by_id[handler_id].get("writes", [])
        ):
            raise ValueError(f"handler durable result fact missing: {handler_id}")
    growth_result_columns = {
        "result_public_id", "result_revision", "payload_digest", "completed_at",
    }
    growth_writes = handler_by_id[
        "internal.growth.portability-export.result.consume"
    ]["writes"]
    if not any(
        row.get("table") == "prf_grw_portability_export_receipts"
        and growth_result_columns <= set(row.get("assignments", {}))
        for row in growth_writes
    ):
        raise ValueError("growth async result proof is not persisted on its request")
    ai_result_columns = {
        "assistance_request_id", "model_version_id", "prompt_template_version_id",
        "dataset_manifest_version_id", "evaluation_protocol_version_id",
        "governance_activation_receipt_id", "affected_person_disclosure_evidence_id",
        "output_digest", "generated_at",
    }
    ai_writes = handler_by_id["internal.ai.assistance-result.consume"]["writes"]
    if not any(
        row.get("table") == "sys_hris_ai_provenance_receipts"
        and row.get("action") == "APPEND"
        and ai_result_columns <= set(row.get("assignments", {}))
        for row in ai_writes
    ):
        raise ValueError("AI assistance immutable result proof is missing")
    if not any(
        step.get("table") == "ppl_cwk_sponsor_assignments"
        and step.get("action") == "INSERT"
        for step in by_operation["modern.contingent.engagement.create"]["orderedDml"]
    ):
        raise ValueError("contingent create initial sponsor assignment missing")
    typed_child_producers = {
        "prf_grw_coaching_note_evidence_refs": "modern.growth.coaching.record",
        "prf_grw_profile_revision_evidence_refs": "modern.growth.profile.update",
        "prf_lrn_completion_skill_evidence_refs": "modern.learning.completion.verify",
        "sys_hris_analytics_export_projection_refs": "modern.analytics.export.create",
    }
    for table, operation_id in typed_child_producers.items():
        if not any(
            step.get("table") == table and step.get("action") == "APPEND_MANY"
            for step in by_operation[operation_id].get("orderedDml", [])
        ):
            raise ValueError(f"typed ordered child producer missing: {table}")
    if not any(
        step.get("table") == "tme_wfm_schedule_candidate_time_group_refs"
        and step.get("action") == "APPEND_MANY"
        for step in handler_by_id[
            "internal.wfm.schedule-optimization.result.consume"
        ].get("writes", [])
    ):
        raise ValueError("WFM time-group typed child handler producer missing")

    temporal_roots = {
        "ppl_bnf_plan_versions": "ppl_bnf_plans",
        "ppl_cwk_engagement_versions": "ppl_cwk_engagements",
        "ppl_jny_template_versions": "ppl_jny_templates",
        "ppl_rec_requisition_versions": "ppl_rec_requisitions",
        "prf_lrn_offering_versions": "prf_lrn_offerings",
        "prf_mkt_opportunity_versions": "prf_mkt_opportunities",
        "prf_suc_plan_versions": "prf_suc_plans",
    }
    temporal_creates = {
        "modern.benefits.plan.create": "ppl_bnf_plan_versions",
        "modern.contingent.engagement.create": "ppl_cwk_engagement_versions",
        "modern.onboarding.template.create": "ppl_jny_template_versions",
        "modern.recruiting.requisition.create": "ppl_rec_requisition_versions",
        "modern.learning.offering.create": "prf_lrn_offering_versions",
        "modern.opportunity.create": "prf_mkt_opportunity_versions",
        "modern.succession.plan.create": "prf_suc_plan_versions",
    }
    required_chain_columns = {
        "root_version", "root_predecessor_public_id", "root_predecessor_version",
        "effective_segment_public_id", "segment_revision",
        "segment_predecessor_public_id", "segment_predecessor_revision",
        "revision_mode", "effective_from", "effective_to",
    }
    forbidden_chain_aliases = {
        "predecessor_public_id", "predecessor_revision",
        "correction_target_public_id", "correction_target_version",
    }
    for operation_id, table in temporal_creates.items():
        operation = by_operation[operation_id]
        step = _domain_step(operation, table)
        if step is None or not required_chain_columns <= set(step.get("assignments", {})):
            raise ValueError(f"initial dual temporal chain is incomplete: {operation_id}")
        assignments = step["assignments"]
        if forbidden_chain_aliases & set(assignments):
            raise ValueError(f"legacy temporal chain alias survived: {operation_id}")
        expected_create_chain = _expected_temporal_create_chain_assignments(table)
        if {
            key: assignments.get(key) for key in expected_create_chain
        } != expected_create_chain:
            raise ValueError(f"initial dual temporal chain values drift: {operation_id}")
        if operation.get("aggregateRoot", {}).get("table") != temporal_roots[table]:
            raise ValueError(f"temporal create aggregate is not stable root: {operation_id}")

    for operation_id, table in P1_REVISION_TABLES.items():
        operation = by_operation[operation_id]
        step = _domain_step(operation, table)
        if step is None or not required_chain_columns <= set(step.get("assignments", {})):
            raise ValueError(f"revised dual temporal chain is incomplete: {operation_id}")
        if forbidden_chain_aliases & set(step.get("assignments", {})):
            raise ValueError(f"legacy temporal revise alias survived: {operation_id}")
        revision_mode = next(
            field for field in operation["requestFields"]
            if field.get("source") == "body.revisionMode"
        )
        if revision_mode.get("allowedValues") != ["CORRECTION", "SUPERSEDE"]:
            raise ValueError(f"public revise mode is not closed: {operation_id}")
        if any(
            field.get("source", "").startswith("body.correctionTarget")
            for field in operation["requestFields"]
        ):
            raise ValueError(f"legacy correction target request survived: {operation_id}")
        if operation.get("aggregateRoot", {}).get("table") != temporal_roots[table]:
            raise ValueError(f"temporal revise aggregate is not stable root: {operation_id}")
        expected_revise_chain = _expected_temporal_revise_chain_assignments(table)
        if {
            key: step.get("assignments", {}).get(key)
            for key in expected_revise_chain
        } != expected_revise_chain:
            raise ValueError(
                f"revised dual temporal chain values drift: {operation_id}"
            )
        root_steps = [
            row for row in operation["orderedDml"]
            if row.get("table") == temporal_roots[table]
            and row.get("action") == "UPDATE_CAS"
        ]
        if len(root_steps) != 1 or operation.get("temporalWriteContract", {}).get(
            "strategy"
        ) != "DUAL_APPEND_ONLY_ROOT_AND_EFFECTIVE_SEGMENT_CHAINS":
            raise ValueError(f"temporal revise root CAS/strategy drift: {operation_id}")

    lifecycle_temporal = {
        operation_id: spec[1]
        for operation_id, spec in TEMPORAL_LIFECYCLE_OPERATION_SPECS.items()
    }
    for operation_id, table in lifecycle_temporal.items():
        operation = by_operation[operation_id]
        step = _domain_step(operation, table)
        if step is None or not required_chain_columns <= set(step.get("assignments", {})):
            raise ValueError(f"lifecycle dual temporal chain is incomplete: {operation_id}")
        if step["assignments"].get("revision_mode") != "CONSTANT:LIFECYCLE":
            raise ValueError(f"lifecycle append uses a public revise mode: {operation_id}")
        expected_lifecycle_chain = _expected_temporal_lifecycle_chain_assignments(table)
        if {
            key: step.get("assignments", {}).get(key)
            for key in expected_lifecycle_chain
        } != expected_lifecycle_chain:
            raise ValueError(
                f"lifecycle dual temporal chain values drift: {operation_id}"
            )
        if forbidden_chain_aliases & set(step.get("assignments", {})):
            raise ValueError(f"legacy lifecycle chain alias survived: {operation_id}")
        if operation.get("aggregateRoot", {}).get("table") != temporal_roots[table]:
            raise ValueError(f"lifecycle aggregate is not stable root: {operation_id}")
        expected_sink = table + "." + TEMPORAL_VERSION_STATE_COLUMN[table]
        if operation.get("transition", {}).get("appendedRevisionStateSink") != expected_sink:
            raise ValueError(f"lifecycle appended revision state sink drift: {operation_id}")

    temporal_event_operations = {
        **temporal_creates, **P1_REVISION_TABLES, **lifecycle_temporal,
    }
    if len(temporal_event_operations) != 38:
        raise ValueError("dual temporal mutation closed set is not exact 38")
    required_temporal_event_fields = {
        "aggregateId", "aggregateVersion", "revisionPublicId", "rootVersion",
        "contentRevisionPublicId", "stateRevisionPublicId",
        "effectiveSegmentPublicId", "segmentRevision", "revisionMode",
        "effectiveFrom", "segmentPredecessorPublicId", "segmentPredecessorRevision",
    }
    for operation_id, table in temporal_event_operations.items():
        operation = by_operation[operation_id]
        root_table = temporal_roots[table]
        root_steps = [
            row for row in operation.get("orderedDml", [])
            if row.get("table") == root_table
            and row.get("action") in {"INSERT", "UPDATE_CAS"}
        ]
        version_steps = [
            row for row in operation.get("orderedDml", [])
            if row.get("table") == table
            and row.get("action") in {"INSERT", "APPEND"}
        ]
        if len(root_steps) != 1 or len(version_steps) != 1:
            raise ValueError(f"dual temporal root/version cardinality drift: {operation_id}")
        root_step, version_step = root_steps[0], version_steps[0]
        expected_root_action = (
            "INSERT" if operation_id in temporal_creates else "UPDATE_CAS"
        )
        expected_root_selector = (
            TEMPORAL_ROOT_INSERT_SELECTOR
            if expected_root_action == "INSERT" else TEMPORAL_ROOT_CAS_SELECTOR
        )
        expected_binding = {
            "rootTable": root_table,
            "rootAction": expected_root_action,
            "rootSelector": expected_root_selector,
            "rootExpectedRows": "EXACTLY_ONE",
            "versionExpectedRows": "EXACTLY_ONE",
            "sameTransaction": True,
            "sameBranchOrCondition": True,
            "postRootVersionEqualsAppendedRootVersion": True,
            "preRootVersionEqualsAppendedPredecessorVersion": True,
            "atomicity": TEMPORAL_ROOT_VERSION_ATOMICITY,
            "rollback": "ANY_ROOT_OR_VERSION_OR_CONTROL_FAILURE_ROLLS_BACK_ALL",
        }
        if (
            root_step.get("action") != expected_root_action
            or root_step.get("role") != "CONCURRENCY_ROOT"
            or root_step.get("selector") != expected_root_selector
            or root_step.get("expectedRows") != "EXACTLY_ONE"
            or root_step.get("failureInjectionAssertion")
            != "ROOT_MUTATION_AND_VERSION_APPEND_AND_CONTROL_ROWS_ROLL_BACK_TOGETHER"
            or version_step.get("expectedRows") != "EXACTLY_ONE"
            or version_step.get("failureInjectionAssertion")
            != "ROOT_MUTATION_AND_VERSION_APPEND_AND_CONTROL_ROWS_ROLL_BACK_TOGETHER"
            or version_step.get("rootMutationBinding") != expected_binding
        ):
            raise ValueError(
                f"dual temporal root selector/CAS/atomicity drift: {operation_id}"
            )
        expected_root_version = (
            "CONSTANT:1" if root_step["action"] == "INSERT"
            else "LOCKED_PRE:" + root_table + ".aggregate_version+1"
        )
        expected_predecessor_version = (
            "CONSTANT:0" if root_step["action"] == "INSERT"
            else "LOCKED_PRE:" + root_table + ".aggregate_version"
        )
        if root_step["action"] == "INSERT" and any(
            isinstance(value, str) and "LOCKED_PRE:" in value
            for value in version_step.get("assignments", {}).values()
        ):
            raise ValueError(
                f"initial temporal version reads a nonexistent predecessor: {operation_id}"
            )
        if (
            root_step.get("assignments", {}).get("aggregate_version")
            != expected_root_version
            or version_step.get("assignments", {}).get("root_version")
            != expected_root_version
            or version_step.get("assignments", {}).get("root_predecessor_version")
            != expected_predecessor_version
            or version_step.get("rootMutationBinding") != expected_binding
        ):
            raise ValueError(f"dual temporal root/version no-gap alias drift: {operation_id}")
        for event in operation.get("events", []):
            fields = {row["name"]: row for row in event.get("fields", [])}
            if not required_temporal_event_fields <= set(fields):
                raise ValueError(f"dual temporal event payload incomplete: {operation_id}")
            if (
                event.get("aggregateEntityType") != "table:" + root_table
                or fields["aggregateId"].get("source") != root_table + ".public_id"
                or fields["aggregateVersion"].get("source")
                != root_table + ".aggregate_version"
                or fields["revisionPublicId"].get("source") != table + ".public_id"
                or fields["rootVersion"].get("source") != table + ".root_version"
                or fields["stateRevisionPublicId"].get("source") != table + ".public_id"
                or fields["contentRevisionPublicId"].get("source")
                != table + ".content_revision_public_id"
                or fields["effectiveSegmentPublicId"].get("source")
                != table + ".effective_segment_public_id"
                or fields["segmentRevision"].get("source") != table + ".segment_revision"
                or fields["revisionMode"].get("source") != table + ".revision_mode"
                or fields["effectiveFrom"].get("source") != table + ".effective_from"
                or fields["segmentPredecessorPublicId"].get("source")
                != table + ".segment_predecessor_public_id"
                or fields["segmentPredecessorRevision"].get("source")
                != table + ".segment_predecessor_revision"
            ):
                raise ValueError(f"dual temporal event/root identity drift: {operation_id}")

    for operation_id, table in {
        **TEMPORAL_DETAIL_QUERY_TABLES,
        **TEMPORAL_COLLECTION_QUERY_TABLES,
    }.items():
        operation = by_operation[operation_id]
        required_sources = {"queryParameters.systemAsOf"}
        if operation_id in TEMPORAL_DETAIL_QUERY_TABLES:
            required_sources |= {
                "queryParameters.revisionPublicId", "queryParameters.rootVersion",
                "queryParameters.contentRevisionPublicId",
            }
        if not required_sources <= {
            field.get("source") for field in operation.get("requestFields", [])
        }:
            raise ValueError(f"temporal detail transport incomplete: {operation_id}")
        selector_sources = {
            row.get("source") for row in operation.get("selectors", [])
            if row.get("targetTable") == table
        }
        exact_sources = {
            "queryParameters.revisionPublicId", "queryParameters.rootVersion",
            "queryParameters.contentRevisionPublicId",
        }
        if operation_id in TEMPORAL_DETAIL_QUERY_TABLES:
            if not exact_sources <= selector_sources:
                raise ValueError(f"temporal query exact selectors incomplete: {operation_id}")
        elif (
            exact_sources & {
                field.get("source") for field in operation.get("requestFields", [])
            }
            or exact_sources & selector_sources
            or operation.get("exactHistoryTransport")
            or operation.get("temporalCollectionContract", {}).get(
                "exactRevisionSelectors"
            ) != "FORBIDDEN_WITHOUT_STABLE_PARENT_IDENTITY"
        ):
            raise ValueError(
                f"temporal collection has ambiguous parentless exact selector: {operation_id}"
            )
        resolution = operation.get("readPlan", {}).get("temporalResolution", {})
        if (
            resolution.get("strategy")
            != "DUAL_APPEND_ONLY_ROOT_AND_EFFECTIVE_SEGMENT_CHAINS"
            or resolution.get("persistedEffectiveTo") != "NULL_ONLY_NON_AUTHORITATIVE"
        ):
            raise ValueError(f"temporal query arbitration drift: {operation_id}")
        if operation_id in TEMPORAL_DETAIL_QUERY_TABLES and (
            set(operation.get("exactHistoryTransport", {}).get("selectorModes", {}))
            != {"UNQUALIFIED", "STATE_HISTORY", "CONTENT_HISTORY"}
            or len(operation.get("exactHistoryTransport", {}).get("crossFieldRules", [])) < 5
        ):
            raise ValueError(f"temporal detail exact-history modes drift: {operation_id}")

    by_handler = {row["handlerId"]: row for row in result["systemHandlers"]}
    for table_id, provenance in manifest.get("tableScopeChange", {}).get(
        "rows", {}
    ).items():
        actual_producers = sorted([
            *(
                operation["operationId"] for operation in result["operations"]
                if any(
                    step.get("table") == table_id
                    for step in operation.get("orderedDml", [])
                )
            ),
            *(
                handler["handlerId"] for handler in result["systemHandlers"]
                if any(
                    step.get("table") == table_id
                    for step in handler.get("writes", [])
                )
            ),
        ])
        actual_readers = sorted(
            operation["operationId"] for operation in queries
            if table_id in operation.get("readPlan", {}).get("tables", [])
        )
        if actual_producers != sorted(provenance.get("producers", [])):
            raise ValueError(
                f"table-scope complete producer set drift: {table_id} "
                f"expected={provenance.get('producers', [])} observed={actual_producers}"
            )
        if actual_readers != sorted(provenance.get("readConsumers", [])):
            raise ValueError(
                f"table-scope complete read-consumer set drift: {table_id} "
                f"expected={provenance.get('readConsumers', [])} observed={actual_readers}"
            )
    expected_owner_ports = _materialize_owner_port_entrypoint_plans(
        build_static_design()["ownerPortOperationContracts"],
        result["operations"],
        result["systemHandlers"],
    )
    if result.get("ownerPortOperationContracts") != expected_owner_ports:
        raise ValueError("owner-port executable entrypoint projection drift")
    listening_design = build_static_design()
    expected_dependencies = [
        *listening_design["ownerDependencyContracts"],
        _compensation_payroll_owner_dependency(),
    ]
    expected_dependency_pins = sorted(({
        "dependencyContractId": row["dependencyContractId"],
        "ownerSession": row.get("ownerSession"),
        "consumerSession": row.get("consumerSession"),
        "sealedPayloadSha256": row["sealedPayloadSha256"],
    } for row in expected_dependencies), key=lambda row: row["dependencyContractId"])
    if result.get("ownerDependencyContracts") != expected_dependencies:
        raise ValueError("owner dependency executable contract projection drift")
    if len(expected_dependencies) != 2:
        raise ValueError("owner dependency closed set is not exact two")
    if manifest.get("ownerDependencyContracts") != expected_dependency_pins:
        raise ValueError("manifest owner dependency ID/seal closure drift")
    dependency = next(
        row for row in expected_dependencies
        if row.get("dependencyContractId")
        == "configuration.resolveSignedParticipationOfferForEntitledSubject.v1"
    )
    if (
        dependency.get("dependencyContractId")
        != "configuration.resolveSignedParticipationOfferForEntitledSubject.v1"
        or dependency.get("orderedDml") != []
        or dependency.get("writes") != "FORBIDDEN"
        or dependency.get("receiptAndOutbox") != "FORBIDDEN_READ_ONLY_DEPENDENCY"
        or dependency.get("durableProducerHandlerId")
        != "internal.listening.configuration.admission-install-receipt.consume"
        or dependency.get("sealedPayloadSha256") != hashlib.sha256(
            json.dumps(
                {key: value for key, value in dependency.items()
                 if key != "sealedPayloadSha256"},
                ensure_ascii=False, sort_keys=True, separators=(",", ":"),
            ).encode("utf-8")
        ).hexdigest()
    ):
        raise ValueError("signed participation-offer dependency is not sealed/read-only")
    issue_port = next(
        row for row in expected_owner_ports
        if row["ownerPortOperation"] == "issuer.issueParticipationEnvelope"
    )
    if any(
        field.get("name") == "signedAdmissionOfferSnapshot"
        for field in issue_port["requestSchema"]["fields"]
    ):
        raise ValueError("issuer trusts a caller-supplied admission offer snapshot")
    dependency_selectors = [
        selector for selector in issue_port.get("selectors", [])
        if selector.get("dependencyContractId") == dependency["dependencyContractId"]
        and selector.get("dependencyContractSha256") == dependency["sealedPayloadSha256"]
    ]
    if len(dependency_selectors) != 1:
        raise ValueError("issuer participation bootstrap dependency is not exact/sealed")
    payroll_dependency = next(
        row for row in expected_dependencies
        if row.get("dependencyContractId") == PAYROLL_SNAPSHOT_DEPENDENCY_ID
    )
    payroll_event = next(
        event
        for event in by_operation["modern.compplan.snapshot.publish"].get("events", [])
        if event.get("eventName") == PAYROLL_SNAPSHOT_EVENT
    )
    payroll_refetch = payroll_event.get("refetchContract", {})
    payroll_request_names = {
        field.get("name")
        for field in payroll_dependency.get("requestSchema", {}).get("fields", [])
    }
    payroll_line_names = {
        field.get("name")
        for field in payroll_dependency.get("responseSchema", {}).get("lines", {}).get(
            "itemFields", []
        )
    }
    if (
        payroll_dependency.get("sealedPayloadSha256")
        != _sealed_contract(payroll_dependency)["sealedPayloadSha256"]
        or payroll_dependency.get("ownerSession") != "HRIS-PER"
        or payroll_dependency.get("consumerSession") != "HRIS-PAY"
        or payroll_dependency.get("orderedDml") != []
        or payroll_dependency.get("writes") != "FORBIDDEN"
        or payroll_dependency.get("receiptAndOutbox")
        != "FORBIDDEN_READ_ONLY_DEPENDENCY"
        or payroll_dependency.get("latestFallback") != "FORBIDDEN"
        or payroll_dependency.get("requestSchema", {}).get("callerTenantOverride")
        != "FORBIDDEN"
        or payroll_request_names
        != {"tenantId", "snapshotId", "snapshotRevision", "payloadDigest", "purposeCode"}
        or payroll_line_names != set(PAYROLL_SNAPSHOT_LINE_FIELDS)
        or payroll_dependency.get("responseSchema", {}).get("lines", {}).get("maxItems")
        != 100000
        or payroll_dependency.get("pep", {}).get("denyOnUnavailable") is not True
        or payroll_refetch.get("mode") != "EXACT_OWNER_DEPENDENCY"
        or payroll_refetch.get("dependencyContractId") != PAYROLL_SNAPSHOT_DEPENDENCY_ID
        or payroll_refetch.get("dependencyContractSha256")
        != payroll_dependency["sealedPayloadSha256"]
        or payroll_refetch.get("latestFallback") != "FORBIDDEN"
        or payroll_refetch.get("consumerSessionAllowlist") != ["HRIS-PAY"]
        or "HRIS-PAY" not in payroll_event.get("audience", {}).get(
            "allowedConsumerSessions", []
        )
        or PAYROLL_SNAPSHOT_PURPOSE not in payroll_event.get("audience", {}).get(
            "allowedPurposes", []
        )
        or payroll_event.get("audience", {}).get("consumerFieldExposure")
        != _compensation_payroll_consumer_field_exposure(payroll_event)
        or "lines" in {field.get("name") for field in payroll_event.get("fields", [])}
    ):
        raise ValueError("PAY compensation snapshot exact owner dependency drift")
    consent_selector = next((
        selector for selector in issue_port.get("selectors", [])
        if selector.get("selectorType") == "CONSENT_OWNER_EXACT_EVIDENCE"
    ), None)
    if (
        consent_selector is None
        or "AUTH_OWNER_RESOLUTION.principalPublicId" not in consent_selector.get("source", "")
        or "CONSENT_PROOF.subjectPrincipalPublicId="
        not in consent_selector.get("causalJoin", "")
        or "SIGNED_OFFER.consentPolicyVersionPublicId="
        not in consent_selector.get("causalJoin", "")
        or "request.consentEvidenceDigest=CONSENT_PROOF.digest"
        not in consent_selector.get("causalJoin", "")
    ):
        raise ValueError("issuer consent subject/policy/evidence equality is incomplete")
    resolve_port = next(
        row for row in expected_owner_ports
        if row["ownerPortOperation"] == "issuer.resolveParticipationStatus"
    )
    if (
        any(field.get("name") == "asOf" for field in resolve_port["requestSchema"]["fields"])
        or "request.asOf" in json.dumps(resolve_port, ensure_ascii=False)
        or "ownerClock.transactionNow" not in json.dumps(resolve_port.get("selectors", []))
    ):
        raise ValueError("issuer status resolution permits caller-chosen ACTIVE-proof time")
    protected_resource_audience = "DWP.HRIS.LISTENING.PROTECTED"
    issue_audience_writes = [
        step.get("assignments", {}).get("audience")
        for step in issue_port.get("orderedDml", [])
        if step.get("table") == "sys_hris_listening_token_issuances"
    ]
    protected_ports = [
        row for row in expected_owner_ports
        if row["ownerPortOperation"] in {
            "protected.listActiveAdmissions", "protected.submitResponse",
        }
    ]
    if (
        issue_audience_writes != ["CONSTANT:" + protected_resource_audience]
        or any(
            row.get("callerAuth", {}).get("audience") != protected_resource_audience
            or not any(
                selector.get("selectorType")
                == "SIGNED_CREDENTIAL_PROTECTED_RESOURCE_AUDIENCE"
                and protected_resource_audience
                in selector.get("versionRule", "")
                for selector in row.get("selectors", [])
            )
            for row in protected_ports
        )
    ):
        raise ValueError("participation credential protected-resource audience drift")
    owner_port_names = [
        row["ownerPortOperation"] for row in expected_owner_ports
    ]
    if len(owner_port_names) != 18 or len(set(owner_port_names)) != 18:
        raise ValueError("owner-port closed set is not exact 18")
    for owner_port in expected_owner_ports:
        ref = owner_port["entrypointRef"]
        if "publicOperationId" in ref:
            entrypoint = by_operation[ref["publicOperationId"]]
            if owner_port["orderedDml"] != entrypoint.get("orderedDml", []):
                raise ValueError(
                    f"owner-port public DML is not execution-equivalent: {owner_port['ownerPortOperation']}"
                )
        elif "systemHandlerId" in ref:
            entrypoint = by_handler[ref["systemHandlerId"]]
            normalized_writes = copy.deepcopy(entrypoint.get("writes", []))
            for index, step in enumerate(normalized_writes, 1):
                step["step"] = index
            if (
                owner_port["orderedDml"] != normalized_writes
                or owner_port.get("selectors", []) != entrypoint.get("selectors", [])
                or owner_port.get("requestSchema", {}).get("entrypointRequestContract")
                != entrypoint.get("requestContract", {})
            ):
                raise ValueError(
                    f"owner-port handler request/selector/DML is not execution-equivalent: "
                    f"{owner_port['ownerPortOperation']}"
                )
            typed_schema = entrypoint.get("typedRequestSchema", {})
            typed_names = {
                field["name"] for field in typed_schema.get("fields", [])
            }
            request_contract_names = set(entrypoint.get("requestContract", {})) - {
                "additionalProperties",
            }
            if (
                typed_schema.get("additionalProperties") is not False
                or typed_names != request_contract_names
            ):
                raise ValueError(
                    f"owner-port handler typed request fields drift: "
                    f"{owner_port['ownerPortOperation']}"
                )
            executable_text = json.dumps({
                "selectors": entrypoint.get("selectors", []),
                "writes": entrypoint.get("writes", []),
                "event": entrypoint.get("event"),
            }, ensure_ascii=False)
            referenced_fields = set(re.findall(
                r"(?:signedMessage|ownerRequest|schedulerRequest)\.([A-Za-z][A-Za-z0-9]*)",
                executable_text,
            ))
            if not referenced_fields <= typed_names:
                raise ValueError(
                    f"owner-port handler consumes undeclared request field: "
                    f"{owner_port['ownerPortOperation']} {sorted(referenced_fields - typed_names)}"
                )
        for index, step in enumerate(owner_port.get("orderedDml", []), 1):
            if (
                not step.get("action")
                or not step.get("table")
                or not isinstance(step.get("assignments"), dict)
                or not step.get("expectedRows")
            ):
                raise ValueError(
                    f"owner-port executable DML step is incomplete: "
                    f"{owner_port['ownerPortOperation']}[{index}]"
                )
        if owner_port["executionClass"] != "AUTH_OWNER_SYNCHRONOUS_PORT":
            binding = owner_port.get("entrypointExecutionBinding", {})
            if binding.get("projection") != "BYTE_EXACT_EXECUTABLE_REQUEST_SELECTOR_DML_PLAN":
                raise ValueError(
                    f"owner-port executable plan binding missing: {owner_port['ownerPortOperation']}"
                )
        response_fields = {
            field["name"] for field in owner_port.get("responseSchema", {}).get("fields", [])
        }
        if (
            owner_port.get("responseSchema", {}).get("additionalProperties") is not False
            or response_fields != set(owner_port.get("responseFieldSources", {}))
            or owner_port.get("responseFieldPolicy", {}).get("denyOnUnavailable") is not True
            or owner_port.get("responseExecutionBinding", {}).get("projection")
            != "CLOSED_TYPED_RESPONSE_FIELD_SOURCE_ERROR_AND_RECEIPT_PLAN"
        ):
            raise ValueError(
                f"owner-port response/field-source closure drift: "
                f"{owner_port['ownerPortOperation']}"
            )
        expected_response_payload = {
            "responseSchema": owner_port["responseSchema"],
            "responseFieldSources": owner_port["responseFieldSources"],
            "responseFieldPolicy": owner_port["responseFieldPolicy"],
            "errorContract": owner_port["errorContract"],
            "receiptAndOutbox": owner_port["receiptAndOutbox"],
        }
        if owner_port["responseExecutionBinding"].get("sha256") != hashlib.sha256(
            json.dumps(
                expected_response_payload, ensure_ascii=False, sort_keys=True,
                separators=(",", ":"),
            ).encode("utf-8")
        ).hexdigest():
            raise ValueError(
                f"owner-port response execution seal drift: {owner_port['ownerPortOperation']}"
            )

    if next(
        row for row in expected_owner_ports
        if row["ownerPortOperation"] == "protected.requestErasure"
    ).get("executionClass") != "OWNER_LOCAL_RETENTION_OR_SIGNED_PRIVACY_SYNCHRONOUS_PORT":
        raise ValueError("erasure ingress is incorrectly classified as a broker message")
    erasure_handler = by_handler["internal.listening.protected.erasure.request"]
    erasure_blob = json.dumps(erasure_handler, ensure_ascii=False, sort_keys=True)
    if (
        "erasureAuthority.retentionPolicyPublicId=LOCKED_ADMISSION.retention_version_public_id"
        not in erasure_blob
        or "retentionPolicyRevision=LOCKED_ADMISSION.retention_revision"
        not in erasure_blob
        or "dueAt=LOCKED_RESPONSE.erase_after" not in erasure_blob
        or not any(
            step.get("table") == "sys_hris_listening_erasure_tickets"
            and step.get("assignments", {}).get("retention_policy_public_id")
            == "LOCKED_ADMISSION.retention_version_public_id"
            for step in erasure_handler.get("writes", [])
        )
    ):
        raise ValueError("erasure retention policy public identity/revision/due fence drift")

    listening_message_contracts = {
        row["messageName"]: row
        for row in listening_design["eventOwnership"]["internalPortMessages"]
    }
    message_outboxes: dict[str, list[dict[str, Any]]] = {
        name: [] for name in listening_message_contracts
    }
    for producer in [*result["operations"], *result["systemHandlers"]]:
        writes = producer.get("orderedDml")
        if not isinstance(writes, list):
            writes = producer.get("writes", [])
        if not isinstance(writes, list):
            writes = []
        for write in writes:
            if not isinstance(write, dict):
                continue
            message_name = write.get("assignments", {}).get("message_name", "")
            if isinstance(message_name, str) and message_name.startswith("CONSTANT:"):
                message_name = message_name.removeprefix("CONSTANT:")
            if message_name in message_outboxes and "outbox" in write.get("table", ""):
                message_outboxes[message_name].append(write)
            if isinstance(message_name, str) and message_name.startswith("CLOSED_"):
                raise ValueError(f"orphan generic Listening acknowledgement survived: {message_name}")
    for message_name, contract in listening_message_contracts.items():
        producers = message_outboxes[message_name]
        if len(producers) != 1:
            raise ValueError(
                f"Listening internal message producer cardinality drift: {message_name}={len(producers)}"
            )
        producer = producers[0]
        if (
            producer.get("payloadSchema") != message_name
            or set(producer.get("payloadFieldSources", {}))
            != set(contract["fieldAllowlist"])
        ):
            raise ValueError(f"Listening internal message payload closure drift: {message_name}")
        envelope = contract.get("envelopeAuth", {})
        envelope_fields = {
            field.get("name"): field for field in envelope.get("fields", [])
        }
        assignments = producer.get("assignments", {})
        expected_signature_input = (
            "tenantPublicId+messageId+messageName+sourceStreamKey+"
            "payloadDigest+referenceEffectiveAt"
        )
        consumer = next((
            handler for handler in result["systemHandlers"]
            if handler.get("messageName") == message_name
        ), None)
        if (
            envelope.get("additionalProperties") is not False
            or set(envelope_fields) != {
                "messageId", "payloadDigest", "signingKeyId",
                "signatureAlgorithm", "ownerSignature",
            }
            or any(
                envelope_fields["signatureAlgorithm"].get(key) != value
                for key, value in {
                    "maxBytes": LISTENING_SIGNATURE_ALGORITHM_MAX_BYTES,
                    "allowedValues": list(LISTENING_SIGNATURE_ALGORITHMS),
                    "validation": "ED25519|ECDSA_P256_SHA256",
                }.items()
            )
            or any(
                envelope_fields["ownerSignature"].get(key) != value
                for key, value in {
                    "serialization": LISTENING_SIGNATURE_SERIALIZATION,
                    "maxBytes": LISTENING_SIGNATURE_MAX_BYTES,
                    "allowedAlgorithms": list(LISTENING_SIGNATURE_ALGORITHMS),
                }.items()
            )
            or envelope.get("canonicalSignatureInput") != expected_signature_input
            or producer.get("signedEnvelope", {}).get("canonicalSignatureInput")
            != expected_signature_input
            or producer.get("signedEnvelope", {}).get("sourceStreamKey")
            != contract["from"]
            or assignments.get("signing_key_id")
            != "ACTIVE_SIGNING_KEY_FOR:" + contract["from"] + ".kid"
            or assignments.get("signature_algorithm")
            != "ACTIVE_SIGNING_KEY_FOR:" + contract["from"] + ".algorithm"
            or not assignments.get("owner_signature", "").startswith(
                "SERVER_SIGN_ACTIVE_OWNER_KEY:"
            )
            or assignments.get("reference_effective_at") != "ownerClock.transactionNow"
            or consumer is None
            or consumer.get("requestContract", {}).get("signingKeyId")
            != "REQUIRED_ACTIVE_SOURCE_STREAM_KEY_ID"
            or consumer.get("requestContract", {}).get("signatureAlgorithm")
            != "REQUIRED_ED25519_OR_ECDSA_P256_SHA256_MAX_17"
            or consumer.get("requestContract", {}).get("ownerSignature")
            != "REQUIRED_BASE64URL_UNPADDED_P1363_FIXED_64_BYTE_SIGNATURE_MAX_86"
        ):
            raise ValueError(
                f"Listening signed internal-message envelope drift: {message_name}"
            )

    public_event_handlers = {
        "internal.listening.configuration.admission-install-receipt.consume":
            "EmployeeListeningSurveyPublished.v3",
        "internal.listening.configuration.admission-close-receipt.consume":
            "EmployeeListeningSurveyClosed.v3",
        "internal.listening.insights.cohort-package.consume":
            "EmployeeListeningCohortProjectionPublished.v1",
    }
    for handler_id, event_name in public_event_handlers.items():
        handler = by_handler[handler_id]
        event_outboxes = [
            write for write in handler["writes"]
            if write.get("role") == "PUBLIC_EVENT_OUTBOX"
            and write.get("assignments", {}).get("event_type") == "CONSTANT:" + event_name
        ]
        event_fields = {field["name"] for field in handler["event"]["fields"]}
        if (
            len(event_outboxes) != 1
            or event_outboxes[0].get("payloadSchema") != event_name
            or set(event_outboxes[0].get("payloadFieldSources", {})) != event_fields
            or event_outboxes[0].get("assignments", {}).get("occurred_at")
            != "ownerClock.transactionNow"
            or any(
                column in event_outboxes[0].get("assignments", {})
                for column in ("message_name", "message_id", "source_stream_key")
            )
        ):
            raise ValueError(f"handler-owned public event outbox closure drift: {handler_id}")
    cwk_lifecycle_handlers = {
        "internal.contingent.access-grant-result.consume",
        "internal.contingent.access-revoke-result.consume",
        "internal.contingent.access-expiry.initiate",
    }
    handler_event_fields = {
        "aggregateId", "aggregateVersion", "stateRevisionPublicId",
        "contentRevisionPublicId", "rootVersion", "effectiveSegmentPublicId",
        "segmentRevision", "revisionMode", "effectiveFrom",
        "segmentPredecessorPublicId", "segmentPredecessorRevision",
    }
    for handler_id in cwk_lifecycle_handlers:
        handler = by_handler[handler_id]
        root_steps = [
            row for row in handler["writes"]
            if row.get("table") == "ppl_cwk_engagements"
            and row.get("action") == "UPDATE_CAS"
        ]
        version_steps = [
            row for row in handler["writes"]
            if row.get("table") == "ppl_cwk_engagement_versions"
            and row.get("action") == "APPEND"
            and row.get("role") == "IMMUTABLE_HANDLER_LIFECYCLE_VERSION"
        ]
        if len(root_steps) != 1 or len(version_steps) != 1:
            raise ValueError(f"CWK handler lifecycle root/version pair drift: {handler_id}")
        root_step, version_step = root_steps[0], version_steps[0]
        expected_handler_chain = _expected_temporal_lifecycle_chain_assignments(
            "ppl_cwk_engagement_versions"
        )
        expected_handler_chain["public_id"] = (
            "SERVER_ALLOCATE:UUID_V7_REPLAY_STABLE_FROM_EVENT_ID"
        )
        expected_handler_binding = {
            "rootTable": "ppl_cwk_engagements",
            "rootAction": "UPDATE_CAS",
            "rootExpectedRows": (
                "EXACTLY_ONE_IF_TRANSITION_APPLIES;"
                "ZERO_ON_SEALED_REPLAY_OR_STALE_VERSION"
            ),
            "versionExpectedRows": "EXACTLY_ONE_IF_ENGAGEMENT_ROOT_CAS_WINS",
            "sameCondition": "OWNER_RESULT_OR_EXPIRY_TRANSITION_APPLIES",
            "sameTransaction": True,
            "postRootVersionEqualsAppendedRootVersion": True,
            "preRootVersionEqualsAppendedPredecessorVersion": True,
            "atomicity": TEMPORAL_ROOT_VERSION_ATOMICITY,
            "rollback": "ANY_HANDLER_ROOT_OR_VERSION_OR_CONTROL_FAILURE_ROLLS_BACK_ALL",
        }
        if (
            root_step.get("condition") != version_step.get("condition")
            or not root_step.get("selector")
            or root_step.get("expectedRows")
            != "EXACTLY_ONE_IF_TRANSITION_APPLIES;ZERO_ON_SEALED_REPLAY_OR_STALE_VERSION"
            or root_step.get("assignments", {}).get("aggregate_version")
            != "LOCKED_PRE:ppl_cwk_engagements.aggregate_version+1"
            or version_step.get("assignments", {}).get("root_version")
            != "LOCKED_PRE:ppl_cwk_engagements.aggregate_version+1"
            or version_step.get("assignments", {}).get("revision_mode")
            != "CONSTANT:LIFECYCLE"
            or {
                key: version_step.get("assignments", {}).get(key)
                for key in expected_handler_chain
            } != expected_handler_chain
            or version_step.get("expectedRows")
            != "EXACTLY_ONE_IF_ENGAGEMENT_ROOT_CAS_WINS"
            or root_step.get("failureInjectionAssertion")
            != "HANDLER_ROOT_CAS_VERSION_APPEND_RECEIPT_AND_OUTBOX_ROLL_BACK_TOGETHER"
            or version_step.get("failureInjectionAssertion")
            != "HANDLER_ROOT_CAS_VERSION_APPEND_RECEIPT_AND_OUTBOX_ROLL_BACK_TOGETHER"
            or version_step.get("handlerLifecycleBinding")
            != expected_handler_binding
            or handler.get("handlerContract", {}).get("sameTransaction")
            != "CLAIM_LOCK_PROOF_DOMAIN_ACK_OUTBOX"
        ):
            raise ValueError(f"CWK handler lifecycle no-gap/condition drift: {handler_id}")
        if (
            "global max root_version row" not in version_step.get("selector", "")
            or "maximum segment_revision" not in version_step.get("selector", "")
        ):
            raise ValueError(f"CWK handler lifecycle segment lock is ambiguous: {handler_id}")
        fields = {row["name"]: row for row in handler["event"]["fields"]}
        if not handler_event_fields <= set(fields):
            raise ValueError(f"CWK handler lifecycle event tuple incomplete: {handler_id}")
        if (
            fields["aggregateId"].get("source") != "ppl_cwk_engagements.public_id"
            or fields["aggregateVersion"].get("source")
            != "ppl_cwk_engagements.aggregate_version"
            or fields["stateRevisionPublicId"].get("source")
            != "ppl_cwk_engagement_versions.public_id"
            or fields["contentRevisionPublicId"].get("source")
            != "ppl_cwk_engagement_versions.content_revision_public_id"
            or fields["rootVersion"].get("source")
            != "ppl_cwk_engagement_versions.root_version"
            or fields["effectiveSegmentPublicId"].get("source")
            != "ppl_cwk_engagement_versions.effective_segment_public_id"
            or fields["segmentRevision"].get("source")
            != "ppl_cwk_engagement_versions.segment_revision"
            or fields["revisionMode"].get("source")
            != "ppl_cwk_engagement_versions.revision_mode"
            or fields["effectiveFrom"].get("source")
            != "ppl_cwk_engagement_versions.effective_from"
            or fields["segmentPredecessorPublicId"].get("source")
            != "ppl_cwk_engagement_versions.segment_predecessor_public_id"
            or fields["segmentPredecessorRevision"].get("source")
            != "ppl_cwk_engagement_versions.segment_predecessor_revision"
        ):
            raise ValueError(f"CWK handler lifecycle event identity drift: {handler_id}")
        refetch = handler["event"].get("refetchContract", {})
        if (
            refetch.get("mode") != "EXACT_HISTORICAL_VERSION"
            or refetch.get("endpointOperationId")
            != "modern.contingent.engagement.query"
            or "stateRevisionPublicId" not in refetch.get("version", "")
            or "no latest fallback" not in refetch.get("version", "")
        ):
            raise ValueError(f"CWK handler lifecycle refetch drift: {handler_id}")

    proposal_steps = [
        step for step in by_operation["modern.compplan.proposal.upsert"]["orderedDml"]
        if step.get("table") == "prf_cmp_proposals"
    ]
    if (
        {step.get("action") for step in proposal_steps} != {"INSERT", "UPDATE_CAS"}
        or {step.get("branchCondition") for step in proposal_steps} != {
            "LOCKED_PRE_STATE=NONE_AND_ROW_ABSENT",
            "LOCKED_PRE_STATE=DRAFT_AND_IF_MATCH_EXACT",
        }
        or {step.get("mutuallyExclusiveBranchGroup") for step in proposal_steps}
        != {"proposal-upsert-prestate"}
        or any(step.get("branchCardinality") != "EXACTLY_ONE_SELECTED_BRANCH"
               for step in proposal_steps)
    ):
        raise ValueError("proposal upsert NONE|DRAFT branches are not physically explicit")

    if result.get("sourceProjectionVersion") != OPERATION_SUCCESSOR_PROJECTION_VERSION:
        raise ValueError("operation successor source projection version drift")
    if compose(result, manifest) != result:
        raise ValueError("operation successor is not a composition fixed point")

    # The generator source is the canonical executable design.  Reprojecting
    # from the pinned operation input must reproduce every nested contract,
    # not merely the identifier/count surface.  This closes mutation gaps in
    # transition, selector, temporal, event and owner-port subobjects while
    # the targeted checks above retain precise diagnostics.
    source_document = json.loads(SSOT.read_text(encoding="utf-8"))
    expected_projection = compose(source_document, manifest)
    if result != expected_projection:
        raise ValueError(
            "operation SSOT differs from deterministic source reprojection"
        )


def main() -> int:
    parser = argparse.ArgumentParser()
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--write", action="store_true")
    group.add_argument("--check", action="store_true")
    group.add_argument("--preview", action="store_true")
    args = parser.parse_args()
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    current_bytes = SSOT.read_bytes()
    current = json.loads(current_bytes)
    if hashlib.sha256(current_bytes).hexdigest() == PREDECESSOR_OPERATION_SSOT_SHA256:
        expected = compose(current, manifest)
    elif current.get("closedSetManifest", {}).get("manifestId") == manifest["manifestId"]:
        expected = compose(current, manifest)
    else:
        raise ValueError("operation SSOT is neither sealed predecessor nor this successor")
    validate(expected, manifest)
    encoded = render(expected).encode("utf-8")
    if args.preview:
        print(
            "MODERN_OPERATION_SSOT_SUCCESSOR_PREVIEW=PASS"
            f" operations={len(expected['operations'])}"
            f" handlers={len(expected['systemHandlers'])}"
            f" events={len(expected['publicEventOwnership']['events'])}"
            f" sha256={hashlib.sha256(encoded).hexdigest()}"
        )
        return 0
    if args.write:
        SSOT.write_bytes(encoded)
    if SSOT.read_bytes() != encoded:
        raise ValueError("operation SSOT generated bytes mismatch")
    print(
        "MODERN_OPERATION_SSOT_SUCCESSOR_CHECK=PASS"
        f" operations={len(expected['operations'])}"
        f" handlers={len(expected['systemHandlers'])}"
        f" events={len(expected['publicEventOwnership']['events'])}"
        f" sha256={hashlib.sha256(encoded).hexdigest()}"
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
