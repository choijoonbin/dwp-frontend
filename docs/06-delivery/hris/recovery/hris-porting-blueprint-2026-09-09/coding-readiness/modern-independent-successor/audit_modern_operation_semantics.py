#!/usr/bin/env python3
"""Independent business-semantic audit for the 199-operation HRIS successor.

This is a reviewer-owned fail-closed oracle.  It imports neither an author
generator nor an author validator.  Candidate JSON is evidence only; the
business invariants, exception classes, and expected remediation semantics are
frozen below from the DWP public-contract, lifecycle, database and protected
listening authority reviews.

The audit intentionally goes beyond "column exists" checks.  It proves that a
request reference can be selected, that required domain facts can actually be
written, that a child is linked to its parent, and that an event can re-enter
the exact aggregate it names.  Findings always carry an exact subject and a
false-positive guard so broad string equivalence cannot make the gate pass.
"""

from __future__ import annotations

import argparse
import collections
import copy
import datetime as dt
import hashlib
import json
import re
from pathlib import Path
from typing import Any, Iterable


HERE = Path(__file__).resolve().parent
READINESS = HERE.parent
SSOT_PATH = READINESS / "modern-capability-operation-causal-contract-ssot.v2.json"
EXACT_PATH = READINESS / "modern-capability-exact-schema-contracts.v1.json"
LISTENING_AUTHORITY_PATH = READINESS / "sys_listening_canonical_design.py"
DEFAULT_REPORT = HERE / "reports/modern-operation-semantics-independent-latest.v1.json"
DEFAULT_SELFTEST_REPORT = HERE / "reports/modern-operation-semantics-independent-selftest-latest.v1.json"

EXPECTED_OPERATION_COUNT = 199
WRITE_ACTIONS = frozenset({"INSERT", "APPEND", "INSERT_MANY", "APPEND_MANY", "UPSERT"})
PROOF_COLUMNS = (
    "approval_receipt_public_id", "approval_receipt_revision", "approval_outcome",
    "approval_action", "approval_input_digest", "approval_purpose_code",
    "approval_tenant_id",
)
VERIFICATION_COLUMNS = (
    "verification_receipt_public_id", "verification_reason_code", "verified_at",
    "verification_receipt_revision", "verification_outcome", "verification_action",
    "verification_input_digest", "verification_purpose_code", "verification_tenant_id",
)
SELECTOR_REQUIRED_FIELDS = (
    "selectorType", "entityType", "idSpace", "sourceType", "targetTable",
    "targetColumn", "targetSqlType", "operator", "cardinality", "tenantFilter",
    "purposeFilter", "versionRule", "asOfRule", "causalJoin", "failure",
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
WFP_RESULT_OWNER_PAYLOAD_SUFFICIENCY = (
    "CLOSED_DURABLE_EVENT_ALLOWLIST_INCLUDES_EXACT_SIMULATION_REQUEST_"
    "REVISION_AND_SIGNED_RESULT_OWNER_PROOF"
)
WFP_RESULT_OWNER_CONTRACT_KEYS = frozenset({
    "requiredFields", "identity", "validation", "denyOnUnavailable",
})
PAYROLL_DEPENDENCY_ID = "compensation.resolveApprovedSnapshotForPayroll.v1"
LISTENING_DEPENDENCY_ID = (
    "configuration.resolveSignedParticipationOfferForEntitledSubject.v1"
)
PAYROLL_EVENT_NAME = "ApprovedCompensationPlanSnapshotPublished.v2"
PAYROLL_PURPOSE = "HRIS_APPROVED_COMPENSATION_PLAN_SNAPSHOT_REFETCH"
EXPECTED_OWNER_DEPENDENCY_SEALS = {
    LISTENING_DEPENDENCY_ID:
        "4409bdbfc2a2432264f5731357d298f1c2d0dcb0bb41960a37ca55f8cb85c4c5",
    PAYROLL_DEPENDENCY_ID:
        "7baa02b0d150893068acbe1137ecbe8d4918f07054409d734838b2d73c818bf3",
}
EXPECTED_CLOSED_SET_MANIFEST_PIN = {
    "manifestId": "dwp.hris.modern.closed-set-manifest.v3",
    "path": "modern-capability-closed-set-manifest.v3.json",
    "fileSha256": "c0ea76d567790e253c2d174b5887649f9ed2faa032f1c5f500d499689382b364",
    "sealedPayloadSha256":
        "01841851f972ffa4fa445cdaaa10bb9b4daec4a416303151a441c8337166734e",
    "countsAreDerivedOnly": True,
}
PAYROLL_OPERATION_EVENT_FIELDS_SHA256 = (
    "1643b272b6f71d9c7b1350c72cb0885577e2ee329a42c0e98a9e5060f458f7aa"
)
PAYROLL_OPERATION_REFETCH_SHA256 = (
    "e55e3329c43bf8d8ec637240d5360666d7caa7aa8b187abe4ba4e85474b83c2c"
)
PAYROLL_OPERATION_AUDIENCE_SHA256 = (
    "b02828c91cb83604e1848ffef9e5b31639787f7bdb95e2d49310108f1f12ffa1"
)
PAYROLL_REQUEST_FIELDS = frozenset({
    "tenantId", "snapshotId", "snapshotRevision", "payloadDigest", "purposeCode",
})
PAYROLL_HEADER_FIELD_ORDER = (
    "snapshotId", "snapshotRevision", "planId", "cycleId", "effectiveFrom",
    "effectiveTo", "approvalReceiptId", "sourceVersion", "lineCount",
    "payloadDigest",
)
PAYROLL_HEADER_FIELDS = frozenset(PAYROLL_HEADER_FIELD_ORDER)
PAYROLL_LINE_FIELD_ORDER = (
    "lineId", "lineSequence", "workerId", "assignmentId", "componentCode",
    "currency", "approvedAmount", "effectiveFrom", "effectiveTo", "lineDigest",
)
PAYROLL_LINE_FIELDS = frozenset(PAYROLL_LINE_FIELD_ORDER)
PAYROLL_PAY_EVENT_FIELD_ORDER = (
    "snapshotId", "snapshotRevision", "payloadDigest", "lineCount",
)


def _expected_payroll_digest_canonicalization() -> dict[str, Any]:
    """Independent exact digest contract; never import the author generator."""
    return {
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
            "fieldOrder": list(PAYROLL_LINE_FIELD_ORDER[:-1]),
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
            "headerFieldOrder": list(PAYROLL_HEADER_FIELD_ORDER[:-1]),
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
            "aboveOneHundredThousandLines": "REJECT_BEFORE_DIGEST_CALCULATION",
            "nullVsAbsent": (
                "DISTINCT_EFFECTIVE_TO_NULL_REQUIRED_FIELD_ABSENCE_REJECTED"
            ),
            "decimalAlternateSpelling": "REJECT_NON_CANONICAL_BEFORE_DIGEST",
            "selfDigestInjection": (
                "REJECT_DIGEST_FIELDS_ARE_NEVER_PREIMAGE_MEMBERS"
            ),
        },
    }


PAYROLL_EVENT_FIELD_TYPES = {
    "aggregateId": "UUID", "fromState": "STRING", "toState": "STRING",
    "aggregateVersion": "BIGINT", "occurredAt": "TIMESTAMPTZ",
    "correlationId": "UUID", "planId": "UUID", "cycleId": "UUID",
    "effectiveDate": "DATE", "snapshotId": "UUID", "lineCount": "INTEGER",
    "snapshotRevision": "BIGINT", "sourceVersion": "BIGINT",
    "payloadDigest": "SHA256", "approvalReceiptId": "UUID",
    "approvalReceiptRevision": "BIGINT", "approvalOutcome": "STRING",
    "approvalAction": "STRING", "approvalInputDigest": "SHA256",
    "approvalPurposeCode": "STRING", "approvalTenantId": "BIGINT",
}

# These 20 commands cannot be useful commands without a typed delta/evidence or
# a closed, explicitly named owner derivation.  A generic status transition,
# digest, or generated UUID is not a business input.
BODYLESS_BUSINESS_REQUIREMENTS: dict[str, dict[str, Any]] = {
    "modern.analytics.metric.revise": {
        "reason": "REVISION_WITHOUT_TYPED_DELTA",
        "required": ["displayName", "effectiveFrom", "effectiveTo", "definitionDigest", "lineageDigest"],
    },
    "modern.analytics.projection.request": {
        "reason": "FIRST_WRITE_WITHOUT_REQUIRED_PARENT_OR_PROJECTION_PARAMETERS",
        "required": ["asOf", "cohortDefinitionId", "anonymityThreshold"],
    },
    "modern.benefits.plan.revise": {
        "reason": "REVISION_WITHOUT_TYPED_DELTA",
        "required": ["displayName", "effectiveFrom", "effectiveTo", "eligibilityPolicyVersionId", "coverageOptions"],
    },
    "modern.compplan.cycle.revise": {
        "reason": "REVISION_WITHOUT_TYPED_DELTA",
        "required": ["displayName", "effectiveFrom", "effectiveTo", "guidelinePolicyVersionId", "populationSnapshotId"],
    },
    "modern.compplan.proposal.upsert": {
        "reason": "MIXED_CREATE_UPDATE_WITHOUT_COMPENSATION_FACTS",
        "required": ["workerPublicId", "componentCode", "amount", "currencyCode", "effectiveDate"],
    },
    "modern.contingent.engagement.revise": {
        "reason": "REVISION_WITHOUT_TYPED_DELTA",
        "required": ["displayName", "effectiveFrom", "effectiveTo", "vendorPublicId", "sponsorWorkerPublicId"],
    },
    "modern.contingent.sponsor.reassign": {
        "reason": "REASSIGN_WITHOUT_NEW_SPONSOR_OR_EFFECTIVE_TIME",
        "required": ["sponsorWorkerPublicId", "effectiveAt", "reasonCode"],
    },
    "modern.learning.assignment.create": {
        "reason": "CREATE_WITHOUT_OFFERING_WORKER_REVISION_OR_EFFECTIVE_FACTS",
        "required": ["offeringId", "workerPublicId", "effectiveFrom", "consentRevision"],
    },
    "modern.learning.offering.revise": {
        "reason": "REVISION_WITHOUT_TYPED_DELTA",
        "required": ["displayName", "effectiveFrom", "effectiveTo", "providerPublicId", "contentDigest"],
    },
    "modern.listening.survey.revise": {
        "reason": "REVISION_WITHOUT_STRUCTURED_FORM_OR_CONFIGURATION_DELTA",
        "required": ["displayName", "formVersionRef", "privacyVersionRef", "retentionVersionRef", "opensAt", "closesAt", "contentSha256"],
    },
    "modern.onboarding.task.waive": {
        "reason": "WAIVE_WITHOUT_WAIVER_EVIDENCE_OR_REASON",
        "required": ["waiverCode", "evidenceDigest", "objectRef", "waivedAt"],
    },
    "modern.onboarding.template.revise": {
        "reason": "REVISION_WITHOUT_TYPED_DELTA",
        "required": ["displayName", "effectiveFrom", "effectiveTo", "configScopePublicId", "tasks", "contentDigest"],
    },
    "modern.opportunity.revise": {
        "reason": "REVISION_WITHOUT_TYPED_DELTA",
        "required": ["displayName", "ownerOrgPublicId", "openFrom", "closeAt", "contentDigest"],
    },
    "modern.recruiting.candidate.admit": {
        "reason": "CREATE_WITHOUT_CANDIDATE_IDENTITY_SOURCE_OR_REQUISITION_LINK",
        "required": ["sourceCandidateKey", "sourceSystemId", "candidatePersonToken"],
    },
    "modern.recruiting.requisition.revise": {
        "reason": "REVISION_WITHOUT_TYPED_DELTA",
        "required": ["positionPublicId", "title", "employmentType", "targetStartDate", "organizationPublicId", "contentDigest"],
    },
    "modern.skills.evidence.record": {
        "reason": "CREATE_WITHOUT_WORKER_SKILL_PROVENANCE_OR_EVIDENCE_FACTS",
        "required": ["workerPublicId", "skillPublicId", "proficiencyLevel", "sourceKey", "sourceRevision", "evidenceDigest", "observedAt"],
    },
    "modern.skills.taxonomy.revise": {
        "reason": "REVISION_AND_CHILD_APPEND_WITHOUT_TYPED_GRAPH_DELTA",
        "required": ["effectiveFrom", "effectiveTo", "contentDigest", "nodes", "edges", "proficiencyLevels"],
    },
    "modern.succession.plan.revise": {
        "reason": "REVISION_WITHOUT_TYPED_DELTA",
        "required": ["displayName", "effectiveFrom", "effectiveTo", "audiencePolicyId", "keyPositionPublicId", "contentDigest"],
    },
    "modern.succession.readiness.record": {
        "reason": "EVIDENCE_APPEND_WITHOUT_NOMINATION_EVIDENCE_OR_PROVENANCE",
        "required": ["nominationId", "evidencePublicId", "evidenceDigest", "sourceRevision", "recordedAt"],
    },
    "modern.workforceplan.scenario.revise": {
        "reason": "REVISION_WITHOUT_TYPED_DELTA",
        "required": ["displayName", "effectiveDate", "validTo", "configVersionId", "organizationSnapshotId", "inputSnapshotId", "revisionPayloadDigest"],
    },
}

BODYLESS_STATE_ONLY = frozenset({
    "modern.ai.assist.cancel", "modern.ai.evaluation.cancel",
    "modern.analytics.export.cancel", "modern.benefits.enrollment.cancel",
    "modern.benefits.plan.retire", "modern.compplan.cycle.cancel",
    "modern.contingent.engagement.reject", "modern.growth.evidence.unlink",
    "modern.growth.export.cancel", "modern.hrservice.case.cancel",
    "modern.learning.assignment.cancel", "modern.learning.offering.retire",
    "modern.onboarding.template.retire", "modern.opportunity.application.withdraw",
    "modern.opportunity.cancel", "modern.opportunity.close",
    "modern.recruiting.hire.cancel", "modern.recruiting.offer.withdraw",
    "modern.skills.evidence.revoke", "modern.skills.taxonomy.retire",
    "modern.succession.nomination.withdraw", "modern.succession.plan.reject",
    "modern.succession.plan.retire", "modern.wfm.optimization.cancel",
    "modern.wfm.schedule.cancel",
})

BODYLESS_FROZEN_DERIVED = frozenset({
    "modern.ai.policy.evaluate", "modern.growth.export.request",
    "modern.succession.plan.publish", "modern.wfm.schedule.publish",
    "modern.workforceplan.scenario.publish",
})

BODYLESS_OTHER_DML_P0 = frozenset({
    "modern.ai.assist.revoke", "modern.workforceplan.scenario.cancel",
})

# Frozen lifecycle uses.  The check only fires while the exact proof columns
# remain NOT NULL/no-default and the operation still creates a pre-proof row.
LIFECYCLE_USES: dict[tuple[str, str], dict[str, Any]] = {
    ("modern.ai.policy.create", "sys_hris_ai_policy_versions"): {"columns": PROOF_COLUMNS, "model": "DRAFT_VERSION"},
    ("modern.ai.policy.revise", "sys_hris_ai_policy_versions"): {"columns": PROOF_COLUMNS, "model": "DRAFT_VERSION"},
    ("modern.analytics.metric.create", "sys_hris_metric_versions"): {"columns": PROOF_COLUMNS, "model": "DRAFT_VERSION"},
    ("modern.benefits.plan.create", "ppl_bnf_plan_versions"): {"columns": PROOF_COLUMNS, "model": "DRAFT_VERSION"},
    ("modern.onboarding.template.create", "ppl_jny_template_versions"): {"columns": PROOF_COLUMNS, "model": "DRAFT_VERSION"},
    ("modern.recruiting.candidate.admit", "ppl_rec_candidate_stage_history"): {"columns": PROOF_COLUMNS, "model": "INITIAL_APPLIED_HISTORY"},
    ("modern.skills.evidence.record", "prf_skl_worker_evidence"): {"columns": VERIFICATION_COLUMNS, "model": "PENDING_EVIDENCE"},
    ("modern.skills.taxonomy.create", "prf_skl_taxonomy_versions"): {"columns": PROOF_COLUMNS, "model": "DRAFT_VERSION"},
    ("modern.succession.plan.create", "prf_suc_plans"): {"columns": PROOF_COLUMNS, "model": "MUTABLE_DRAFT_ROOT_WITH_SEPARATE_PUBLISH_LEDGER"},
    ("modern.workforceplan.scenario.cancel", "ppl_wfp_scenario_revisions"): {"columns": PROOF_COLUMNS, "model": "GENERAL_REVISION"},
    ("modern.workforceplan.scenario.create", "ppl_wfp_scenario_revisions"): {"columns": PROOF_COLUMNS, "model": "GENERAL_REVISION"},
    ("modern.workforceplan.scenario.publish", "ppl_wfp_scenario_revisions"): {"columns": PROOF_COLUMNS, "model": "GENERAL_REVISION"},
    ("modern.workforceplan.scenario.revise", "ppl_wfp_scenario_revisions"): {"columns": PROOF_COLUMNS, "model": "GENERAL_REVISION"},
    ("modern.workforceplan.scenario.simulate", "ppl_wfp_scenario_revisions"): {"columns": PROOF_COLUMNS, "model": "GENERAL_REVISION"},
    ("modern.workforceplan.scenario.submit", "ppl_wfp_scenario_revisions"): {"columns": PROOF_COLUMNS, "model": "GENERAL_REVISION"},
}


def strict_load(path: Path) -> dict[str, Any]:
    def pairs(items: list[tuple[str, Any]]) -> dict[str, Any]:
        out: dict[str, Any] = {}
        for key, value in items:
            if key in out:
                raise ValueError(f"duplicate JSON key {key!r} in {path}")
            out[key] = value
        return out
    return json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=pairs)


def file_sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def canonical_hash(value: Any) -> str:
    raw = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(raw).hexdigest()


def table_entity(table: str | None) -> str | None:
    return f"table:{table}" if table else None


def target_table(value: Any) -> str | None:
    if not isinstance(value, str) or "." not in value:
        return None
    name = value.split(".", 1)[0]
    if name.startswith("table:"):
        name = name[6:]
    return name if re.fullmatch(r"(?:ppl|prf|tme|sys)_[a-z0-9_]+", name) else None


def walk_strings(value: Any) -> Iterable[tuple[str, str]]:
    if isinstance(value, str):
        yield "", value
    elif isinstance(value, dict):
        for key, child in value.items():
            for suffix, text in walk_strings(child):
                yield f".{key}{suffix}", text
    elif isinstance(value, list):
        for index, child in enumerate(value):
            for suffix, text in walk_strings(child):
                yield f"[{index}]{suffix}", text


def make_finding(code: str, *, severity: str = "P0", operation_id: str | None = None,
                 handler_id: str | None = None, event_name: str | None = None,
                 table: str | None = None, field: str | list[str] | None = None,
                 evidence: dict[str, Any] | None = None,
                 expected_correction_class: str,
                 false_positive_guard: str) -> dict[str, Any]:
    subject = {
        "operationId": operation_id,
        "handlerId": handler_id,
        "eventName": event_name,
        "table": table,
        "field": field,
    }
    subject = {key: value for key, value in subject.items() if value is not None}
    finding_id = "C-" + hashlib.sha256(
        json.dumps([code, subject], ensure_ascii=False, sort_keys=True).encode()
    ).hexdigest()[:16].upper()
    return {
        "findingId": finding_id,
        "code": code,
        "severity": severity,
        "subject": subject,
        "evidence": evidence or {},
        "falsePositiveGuard": false_positive_guard,
        "expectedCorrectionClass": expected_correction_class,
    }


def table_maps(exact: dict[str, Any]) -> tuple[dict[str, dict[str, Any]], dict[str, dict[str, dict[str, Any]]]]:
    specs = {row["tableName"]: row for row in exact.get("tableSpecifications", [])}
    common = {row["name"]: row for row in exact.get("commonTableContract", {}).get("columns", [])}
    columns: dict[str, dict[str, dict[str, Any]]] = {}
    for name, spec in specs.items():
        merged = {key: copy.deepcopy(value) for key, value in common.items() if key != "__internal_id__"}
        id_column = spec.get("idColumn")
        if isinstance(id_column, dict) and id_column.get("name"):
            merged[id_column["name"]] = copy.deepcopy(id_column)
        for col in spec.get("columns", []):
            merged[col["name"]] = copy.deepcopy(col)
        columns[name] = merged
    return specs, columns


def operation_index(ssot: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {row["operationId"]: row for row in ssot.get("operations", [])}


def binding_index(exact: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {row["operationId"]: row for row in exact.get("operationBindings", [])}


def request_body_names(op: dict[str, Any]) -> set[str]:
    return {row.get("name") for row in op.get("requestFields", []) if row.get("location") == "body" and row.get("name")}


def request_sources(op: dict[str, Any]) -> set[str]:
    return {row.get("source") for row in op.get("requestFields", []) if row.get("source")}


def exact_write_findings(ssot: dict[str, Any], exact: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    specs, columns = table_maps(exact)
    findings: list[dict[str, Any]] = []
    parent_findings: list[dict[str, Any]] = []
    for op in ssot.get("operations", []):
        oid = op["operationId"]
        for dml in op.get("orderedDml", []):
            if dml.get("action") not in WRITE_ACTIONS:
                continue
            table = dml.get("table")
            if table not in specs:
                continue
            assigned = set((dml.get("assignments") or {}).keys())
            required = {
                name for name, col in columns[table].items()
                if col.get("nullable") is False and col.get("default") is None
            }
            missing = sorted(required - assigned)
            if missing:
                common_names = {c["name"] for c in exact["commonTableContract"]["columns"]}
                findings.append(make_finding(
                    "EXACT_NOT_NULL_NO_DEFAULT_WRITE_GAP",
                    operation_id=oid, table=table, field=missing,
                    evidence={
                        "action": dml.get("action"), "step": dml.get("step"),
                        "assignedFields": sorted(assigned),
                        "missingCommonFields": sorted(set(missing) & common_names),
                        "missingTableFields": sorted(set(missing) - common_names),
                    },
                    expected_correction_class="DECLARE_TYPED_SOURCE_AND_ASSIGN_EVERY_REQUIRED_COLUMN_OR_FIX_LIFECYCLE_SCHEMA",
                    false_positive_guard=(
                        "Only exact-schema columns with nullable=false and default=null are required; "
                        "identity/defaulted/nullable columns and UPDATE_CAS steps are excluded."
                    ),
                ))
            for fk in specs[table].get("foreignKeys", []):
                if fk.get("mode") != "LOCAL_COMPOSITE_FK":
                    continue
                required_fk = []
                for name in fk.get("columns", []):
                    if name == "tenant_id":
                        continue
                    col = columns[table].get(name, {})
                    if col.get("nullable") is False and col.get("default") is None:
                        required_fk.append(name)
                missing_fk = sorted(set(required_fk) - assigned)
                if missing_fk:
                    parent_findings.append(make_finding(
                        "REQUIRED_LOCAL_PARENT_FK_NOT_WRITTEN",
                        operation_id=oid, table=table, field=missing_fk,
                        evidence={
                            "action": dml.get("action"), "step": dml.get("step"),
                            "constraintId": fk.get("constraintId"),
                            "parentTable": fk.get("target"),
                            "targetColumns": fk.get("targetColumns"),
                        },
                        expected_correction_class="WRITE_LOCKED_SAME_TENANT_PARENT_IDENTITY_AND_ENFORCE_LOCAL_COMPOSITE_FK",
                        false_positive_guard=(
                            "Only non-null/no-default columns of an explicit LOCAL_COMPOSITE_FK on an INSERT/APPEND/UPSERT row are checked."
                        ),
                    ))
    return findings, parent_findings


def bodyless_findings(ssot: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    operations = operation_index(ssot)
    all_bodyless = {
        oid for oid, op in operations.items()
        if op.get("mode") == "COMMAND" and not request_body_names(op)
    }
    findings: list[dict[str, Any]] = []
    for oid, rule in BODYLESS_BUSINESS_REQUIREMENTS.items():
        op = operations.get(oid)
        if not op or request_body_names(op):
            continue
        domain_writes = [
            {"action": row.get("action"), "table": row.get("table"), "assignments": sorted((row.get("assignments") or {}).keys())}
            for row in op.get("orderedDml", []) if row.get("action") in WRITE_ACTIONS | {"UPDATE_CAS"}
        ]
        findings.append(make_finding(
            "BODYLESS_BUSINESS_COMMAND",
            operation_id=oid,
            evidence={
                "reason": rule["reason"], "currentBodyFields": [],
                "minimumTypedBusinessFields": rule["required"], "domainWrites": domain_writes,
            },
            expected_correction_class="ADD_CLOSED_TYPED_REQUEST_DELTA_OR_EXACT_NAMED_OWNER_DERIVATION",
            false_positive_guard=(
                "Frozen state-only and frozen-owner-derived commands are separately allowlisted; these operations create/revise/reassign/waive/evidence facts that cannot be inferred from path+If-Match alone."
            ),
        ))
    classification = {
        "actualBodylessCommands": len(all_bodyless),
        "p0": sorted(all_bodyless & set(BODYLESS_BUSINESS_REQUIREMENTS)),
        "legitimateStateOnly": sorted(all_bodyless & BODYLESS_STATE_ONLY),
        "legitimateFrozenDerived": sorted(all_bodyless & BODYLESS_FROZEN_DERIVED),
        "bodylessnessOkayButOtherDmlP0": sorted(all_bodyless & BODYLESS_OTHER_DML_P0),
        "unclassified": sorted(all_bodyless - set(BODYLESS_BUSINESS_REQUIREMENTS) - BODYLESS_STATE_ONLY - BODYLESS_FROZEN_DERIVED - BODYLESS_OTHER_DML_P0),
        "frozenCoverageEquation": "20+25+5+2=52",
    }
    return findings, classification


LISTENING_CREDENTIAL_CLAIMS = frozenset({
    "tenantPublicId", "surveyPublicId", "surveyRevision", "admissionPublicId",
    "admissionVersionPublicId", "admissionOwnerVersion", "formVersionPublicId",
    "formArtifactDigest", "eligibilityVersionPublicId", "eligibilityRevision",
    "consentPolicyVersionPublicId", "consentEvidenceCommitment", "opaqueJti",
    "tokenCommitment", "aud", "iat", "nbf", "exp", "kid", "alg", "signature",
    "nonRevocationProof",
})
LISTENING_NON_REVOCATION_CLAIMS = frozenset({
    "issuancePublicId", "issuanceRevision", "opaqueJtiCommitment",
    "tokenCommitment", "status", "proofGeneratedAt", "proofExpiresAt",
    "kid", "alg", "ownerSignature",
})


def _closed_schema_fields(schema: Any) -> tuple[set[str], bool]:
    if not isinstance(schema, dict) or schema.get("additionalProperties") is not False:
        return set(), False
    fields = schema.get("fields")
    if not isinstance(fields, list) or not all(isinstance(row, dict) for row in fields):
        return set(), False
    names = {row.get("name") for row in fields if isinstance(row.get("name"), str)}
    return names, all(row.get("required") is True for row in fields)


def _listening_credential_nested_resolution(
    operation: dict[str, Any], field: dict[str, Any],
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Recognize the protected owner's typed nested signed-claim resolution.

    A credential is not a database UUID itself.  It is resolved through its
    closed `admissionPublicId` and `aud` claims, then bound to the same locked
    admission/form/consent snapshot.  Treating only an exact source-string as
    a selector incorrectly rejects this cryptographic composite selector.
    """
    oid = operation.get("operationId")
    source = field.get("source")
    if (
        oid not in {"modern.listening.active.query", "modern.listening.response.submit"}
        or field.get("referenceContract", {}).get("entityType")
        != "DWP.Listening.SignedParticipationCredential"
        or not isinstance(source, str)
    ):
        return [], {"applicable": False}

    claim_names, claims_required = _closed_schema_fields(field.get("valueSchema"))
    non_revocation = next((
        row.get("valueSchema") for row in field.get("valueSchema", {}).get("fields", [])
        if row.get("name") == "nonRevocationProof"
    ), None)
    proof_names, proof_required = _closed_schema_fields(non_revocation)
    selectors = operation.get("selectors", [])
    admission_source = source + ".admissionPublicId"
    audience_source = source + ".aud"
    admission = next((row for row in selectors if row.get("source") == admission_source), None)
    audience = next((row for row in selectors if row.get("source") == audience_source), None)
    effects = next((
        row.get("effects", []) for row in operation.get("inputEffects", [])
        if row.get("source") == source
    ), [])
    allowed_effect_kind = {
        "modern.listening.active.query": "ANONYMOUS_CREDENTIAL_ADMISSION_AND_FORM_SELECTOR",
        "modern.listening.response.submit": "OFFLINE_SIGNED_CREDENTIAL_AND_NONREVOCATION_PROOF",
    }[oid]
    effect_ok = any(
        effect.get("kind") == allowed_effect_kind
        and "ADMISSION" in str(effect.get("target", "")).upper()
        for effect in effects
    )
    admission_semantics = (
        str((admission or {}).get("versionRule", "")) + " "
        + str((admission or {}).get("causalJoin", ""))
    ).lower()
    admission_ok = bool(admission and (
        admission.get("selectorType") == "PROTECTED_LOCAL_LATEST_STABLE_ADMISSION_FENCE"
        and admission.get("entityType") == "table:sys_hris_listening_admission_versions"
        and admission.get("targetTable") == "sys_hris_listening_admission_versions"
        and admission.get("targetColumn") == "admission_public_id"
        and admission.get("operator") == "EQUALS"
        and admission.get("cardinality") == "EXACTLY_ONE_LATEST_OWNER_REVISION"
        and all(token in admission_semantics for token in (
            "credential", "form", "consent", "proof",
        ))
        and "active" in str(admission.get("asOfRule", "")).lower()
    ))
    audience_ok = bool(audience and (
        audience.get("selectorType") == "SIGNED_CREDENTIAL_PROTECTED_RESOURCE_AUDIENCE"
        and audience.get("entityType") == "DWP.Listening.ProtectedResourceAudience"
        and audience.get("targetTable")
        == "OWNER_PORT::DWP.Listening.ProtectedResourceAudienceVerifier"
        and audience.get("targetColumn") == "resource_audience"
        and audience.get("operator") == "EQUALS_CONSTANT"
        and audience.get("cardinality") == "EXACTLY_ONE_VALID_RESOURCE_AUDIENCE"
        and "DWP.HRIS.LISTENING.PROTECTED" in str(audience.get("versionRule", ""))
        and "proof" in str(audience.get("asOfRule", "")).lower()
    ))
    diagnostics = {
        "applicable": True,
        "credentialSchemaClosed": claims_required and claim_names == LISTENING_CREDENTIAL_CLAIMS,
        "credentialClaims": sorted(claim_names),
        "nonRevocationSchemaClosed": (
            proof_required and proof_names == LISTENING_NON_REVOCATION_CLAIMS
        ),
        "nonRevocationClaims": sorted(proof_names),
        "admissionClaimSelectorSource": admission_source,
        "admissionClaimSelectorValid": admission_ok,
        "audienceClaimSelectorSource": audience_source,
        "audienceClaimSelectorValid": audience_ok,
        "credentialInputEffectValid": effect_ok,
    }
    complete = all((
        diagnostics["credentialSchemaClosed"],
        diagnostics["nonRevocationSchemaClosed"],
        admission_ok, audience_ok, effect_ok,
    ))
    return ([admission, audience] if complete else []), diagnostics


def _listening_route_nested_resolution(
    operation: dict[str, Any], field: dict[str, Any],
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Prove route survey -> signed claim -> locked admission equality."""
    if (
        operation.get("operationId") != "modern.listening.response.submit"
        or field.get("source") != "pathParameters.surveyId"
        or field.get("referenceContract", {}).get("entityType")
        != "DWP.Listening.ProtectedAdmissionSurveyBinding"
    ):
        return [], {"applicable": False}
    credential = next((
        row for row in operation.get("requestFields", [])
        if row.get("source") == "body.signedParticipationCredential"
    ), None)
    credential_selectors, credential_diagnostics = (
        _listening_credential_nested_resolution(operation, credential or {})
    )
    admission = next((
        row for row in credential_selectors
        if row.get("targetTable") == "sys_hris_listening_admission_versions"
    ), None)
    path_effects = next((
        row.get("effects", []) for row in operation.get("inputEffects", [])
        if row.get("source") == "pathParameters.surveyId"
    ), [])
    path_effect_ok = any(
        effect.get("kind") == "SIGNED_CLAIM_EQUALITY_ONLY"
        and effect.get("target") == "LOCKED_ADMISSION.survey_public_id"
        for effect in path_effects
    )
    join = str((admission or {}).get("causalJoin", "")).lower()
    route_join_ok = all(token in join for token in ("path", "survey", "credential", "target"))
    resolution_ok = (
        field.get("referenceContract", {}).get("resolution")
        == "PROTECTED_LOCAL_SIGNED_ADMISSION_CLAIM_EQUALITY_ONLY"
    )
    diagnostics = {
        "applicable": True,
        "credentialResolution": credential_diagnostics,
        "pathInputEffectValid": path_effect_ok,
        "routeCredentialLockedAdmissionJoinValid": route_join_ok,
        "routeReferenceResolutionValid": resolution_ok,
    }
    complete = bool(
        credential_selectors and path_effect_ok and route_join_ok and resolution_ok
    )
    return ([admission] if complete and admission else []), diagnostics


def selector_findings(ssot: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    missing: list[dict[str, Any]] = []
    incomplete: list[dict[str, Any]] = []
    mismatch: list[dict[str, Any]] = []
    for op in ssot.get("operations", []):
        oid = op["operationId"]
        selectors = op.get("selectors", [])
        by_source: dict[str, list[dict[str, Any]]] = collections.defaultdict(list)
        for sel in selectors:
            by_source[sel.get("source")].append(sel)
            absent = [key for key in SELECTOR_REQUIRED_FIELDS if sel.get(key) in (None, "", [])]
            if absent:
                incomplete.append(make_finding(
                    "SELECTOR_EXACT_CONTRACT_INCOMPLETE",
                    operation_id=oid, table=sel.get("targetTable"), field=absent,
                    evidence={"source": sel.get("source"), "targetColumn": sel.get("targetColumn"), "currentSelector": sel},
                    expected_correction_class="COMPLETE_TYPED_TENANT_PURPOSE_VERSION_ASOF_CARDINALITY_FAILURE_SELECTOR",
                    false_positive_guard=(
                        "Every selector, local or owner-port, must state all frozen identity/type/tenant/purpose/version/asOf/cardinality/failure dimensions; legacy referenceEffectiveAt prose is not an asOfRule."
                    ),
                ))
        effects = {row.get("source"): row.get("effects", []) for row in op.get("inputEffects", [])}
        for field in op.get("requestFields", []):
            ref = field.get("referenceContract")
            source = field.get("source")
            if not ref or not source:
                continue
            matched = by_source.get(source, [])
            nested_diagnostics: dict[str, Any] | None = None
            if not matched:
                credential_matched, credential_diagnostics = (
                    _listening_credential_nested_resolution(op, field)
                )
                if credential_diagnostics.get("applicable"):
                    nested_diagnostics = credential_diagnostics
                matched = credential_matched
            if not matched:
                route_matched, route_diagnostics = _listening_route_nested_resolution(op, field)
                if route_diagnostics.get("applicable"):
                    nested_diagnostics = route_diagnostics
                matched = route_matched
            if not matched:
                missing.append(make_finding(
                    "REFERENCE_WITHOUT_EXPLICIT_SELECTOR",
                    operation_id=oid, field=source,
                    evidence={
                        "referenceContract": ref, "selectorsForSource": [],
                        "nestedSignedClaimResolution": nested_diagnostics,
                    },
                    expected_correction_class="ADD_EXACT_TYPED_SELECTOR_OR_REMOVE_UNNEEDED_REFERENCE",
                    false_positive_guard=(
                        "The request field itself has referenceContract; a high-level governance-boundary paragraph or an inputEffect marker is not an executable selector with cardinality and fail-closed semantics."
                    ),
                ))
                continue
            reference_entity = ref.get("entityType")
            if not isinstance(reference_entity, str) or not reference_entity.startswith("table:"):
                continue
            selector_entities = {
                sel.get("entityType") or table_entity(sel.get("targetTable")) for sel in matched
            }
            effect_tables = {
                table_entity(target_table(effect.get("target")))
                for effect in effects.get(source, []) if target_table(effect.get("target"))
            }
            if reference_entity not in selector_entities or (effect_tables and reference_entity not in effect_tables):
                mismatch.append(make_finding(
                    "REFERENCE_SELECTOR_INPUT_EFFECT_TARGET_MISMATCH",
                    operation_id=oid, field=source,
                    evidence={
                        "referenceEntity": reference_entity,
                        "selectorEntities": sorted(x for x in selector_entities if x),
                        "inputEffectEntities": sorted(x for x in effect_tables if x),
                        "inputEffects": effects.get(source, []),
                    },
                    expected_correction_class="BIND_REFERENCE_TO_ITS_EXACT_ROOT_SELECTOR_AND_SEPARATE_CHILD_FK_EFFECT",
                    false_positive_guard=(
                        "Only local table references are compared. A child persistence effect may be added, but it cannot replace the exact referenced-root selector/CAS effect."
                    ),
                ))
    return missing, incomplete, mismatch


def declared_persistence_findings(ssot: dict[str, Any]) -> list[dict[str, Any]]:
    findings: list[dict[str, Any]] = []
    persisted_kinds = {"PERSISTED_COLUMN", "PERSISTED_DERIVED_DIGEST", "TYPED_DOMAIN_INPUT"}
    for op in ssot.get("operations", []):
        writes: dict[str, set[str]] = collections.defaultdict(set)
        for row in op.get("orderedDml", []):
            if row.get("action") in WRITE_ACTIONS | {"UPDATE_CAS"}:
                writes[row.get("table")].update((row.get("assignments") or {}).keys())
        for input_effect in op.get("inputEffects", []):
            for effect in input_effect.get("effects", []):
                if effect.get("kind") not in persisted_kinds:
                    continue
                target = effect.get("target")
                table = target_table(target)
                if not table or "." not in str(target):
                    continue
                column = str(target).split(".", 1)[1]
                if column not in writes.get(table, set()):
                    findings.append(make_finding(
                        "DECLARED_PERSISTED_INPUT_NOT_WRITTEN",
                        operation_id=op["operationId"], table=table, field=column,
                        evidence={
                            "source": input_effect.get("source"), "effectKind": effect.get("kind"),
                            "declaredTarget": target, "actualAssignedFields": sorted(writes.get(table, set())),
                        },
                        expected_correction_class="WRITE_DECLARED_TARGET_OR_CORRECT_REMOVE_STALE_INPUT_EFFECT",
                        false_positive_guard=(
                            "Only effects explicitly declared as persisted/typed domain input are checked, against assignments to the exact declared table and column in this operation."
                        ),
                    ))
    return findings


def ghost_body_findings(ssot: dict[str, Any]) -> list[dict[str, Any]]:
    findings: list[dict[str, Any]] = []
    for op in ssot.get("operations", []):
        declared = request_sources(op)
        seen: set[tuple[str, str]] = set()
        inspect = {
            "selectors": op.get("selectors", []), "inputEffects": op.get("inputEffects", []),
            "transition": op.get("transition", {}), "orderedDml": op.get("orderedDml", []),
        }
        for path, text in walk_strings(inspect):
            for match in re.findall(r"\bbody\.[A-Za-z][A-Za-z0-9_]*", text):
                if match in declared or (match, path) in seen:
                    continue
                seen.add((match, path))
                findings.append(make_finding(
                    "UNDECLARED_BODY_SOURCE_USED",
                    operation_id=op["operationId"], field=match,
                    evidence={"usePath": path, "declaredRequestSources": sorted(declared)},
                    expected_correction_class="DECLARE_CLOSED_TYPED_REQUEST_FIELD_OR_REMOVE_GHOST_SOURCE",
                    false_positive_guard=(
                        "The detector only recognizes exact body.<field> tokens used in selector/transition/DML/input-effect structures and absent from requestFields."
                    ),
                ))
    return findings


def learning_owner_proof_findings(ssot: dict[str, Any]) -> list[dict[str, Any]]:
    """Require the reviewed owner-proof member, not merely an ownerProof prefix."""
    operation = operation_index(ssot).get("modern.learning.completion.verify")
    if not operation:
        return []
    child_steps = [
        row for row in operation.get("orderedDml", [])
        if row.get("table") == "prf_lrn_completion_skill_evidence_refs"
    ]
    owner_member_prefix = "ownerProof.body.evidencePublicId."
    owner_member_uses = sorted([
        {
            "table": row.get("table"),
            "field": field,
            "source": source,
        }
        for row in operation.get("orderedDml", [])
        for field, source in (row.get("assignments") or {}).items()
        if isinstance(source, str) and owner_member_prefix in source
    ], key=lambda item: (
        str(item.get("table")), str(item.get("field")), str(item.get("source"))
    ))
    expected_owner_member_uses = sorted([
        {
            "table": "prf_lrn_completion_skill_evidence_refs",
            "field": "skill_evidence_public_id",
            "source": LEARNING_SKILL_EVIDENCE_OWNER_SOURCE,
        },
        {
            "table": "prf_lrn_completion_skill_evidence_refs",
            "field": "worker_skill_evidence_id",
            "source": LEARNING_WORKER_SKILL_EVIDENCE_SELECTOR,
        },
    ], key=lambda item: (item["table"], item["field"], item["source"]))
    defects: list[str] = []
    if len(child_steps) != 1:
        defects.append("TYPED_CHILD_STEP_CARDINALITY_DRIFT")
    elif (
        child_steps[0].get("action") != "APPEND_MANY"
        or child_steps[0].get("role") != "TYPED_ORDERED_CHILD_REFERENCE"
    ):
        defects.append("TYPED_CHILD_ACTION_OR_ROLE_DRIFT")
    assignments = child_steps[0].get("assignments", {}) if len(child_steps) == 1 else {}
    if assignments.get("skill_evidence_public_id") != LEARNING_SKILL_EVIDENCE_OWNER_SOURCE:
        defects.append("SKILL_EVIDENCE_PUBLIC_ID_OWNER_MEMBER_DRIFT")
    if assignments.get("worker_skill_evidence_id") != LEARNING_WORKER_SKILL_EVIDENCE_SELECTOR:
        defects.append("WORKER_SKILL_EVIDENCE_SELECTOR_OWNER_MEMBER_DRIFT")
    if owner_member_uses != expected_owner_member_uses:
        defects.append("UNREVIEWED_OWNER_PROOF_MEMBER_PRESENT")
    legacy_ghost_used = any(
        isinstance(source, str)
        and re.search(r"\bbody\.skillEvidenceIds\b", source) is not None
        for row in operation.get("orderedDml", [])
        for source in (row.get("assignments") or {}).values()
    )
    # The generic ghost-body detector already emits the historical P0 for the
    # legacy body source.  Avoid a duplicate finding while retaining the new
    # exact-member finding for renamed/sibling ownerProof sources.
    if legacy_ghost_used:
        return []
    if not defects:
        return []
    return [make_finding(
        "LEARNING_OWNER_PROOF_DERIVATION_DRIFT",
        operation_id=operation["operationId"],
        table="prf_lrn_completion_skill_evidence_refs",
        field=["skill_evidence_public_id", "worker_skill_evidence_id"],
        evidence={
            "defects": defects,
            "expectedOwnerMemberUses": expected_owner_member_uses,
            "actualOwnerMemberUses": owner_member_uses,
            "childStepCount": len(child_steps),
            "childStepAction": child_steps[0].get("action") if len(child_steps) == 1 else None,
            "childStepRole": child_steps[0].get("role") if len(child_steps) == 1 else None,
        },
        expected_correction_class=(
            "RESTORE_BOTH_TYPED_CHILD_ASSIGNMENTS_TO_EXACT_REVIEWED_"
            "OWNER_PROOF_SKILL_EVIDENCE_MEMBER_AND_REMOVE_SIBLING_MEMBER_USES"
        ),
        false_positive_guard=(
            "The check compares the exact typed child step, both assignment sources, and the closed set of ownerProof.body.evidencePublicId member uses; a sibling or renamed member is not accepted by prefix or substring equivalence."
        ),
    )]


def lifecycle_findings(ssot: dict[str, Any], exact: dict[str, Any]) -> list[dict[str, Any]]:
    specs, columns = table_maps(exact)
    ops = operation_index(ssot)
    findings: list[dict[str, Any]] = []
    for (oid, table), rule in LIFECYCLE_USES.items():
        op = ops.get(oid)
        if not op or table not in specs:
            continue
        relevant_write = any(
            row.get("table") == table and row.get("action") in WRITE_ACTIONS
            for row in op.get("orderedDml", [])
        )
        if not relevant_write:
            continue
        forced = [
            name for name in rule["columns"]
            if columns[table].get(name, {}).get("nullable") is False
            and columns[table].get(name, {}).get("default") is None
        ]
        if not forced:
            continue
        model = rule["model"]
        if model == "PENDING_EVIDENCE":
            correction = "MAKE_VERIFICATION_TUPLE_NULLABLE_ALL_OR_NONE_FORBID_PENDING_REQUIRE_VERIFIED_PRESERVE_REVOKED"
        elif model == "INITIAL_APPLIED_HISTORY":
            correction = "MAKE_APPROVAL_TUPLE_NULLABLE_ALL_OR_NONE_FORBID_APPLIED_REQUIRE_DECISION_STAGES"
        elif model == "GENERAL_REVISION":
            correction = "ADD_REVISION_KIND_AND_CONDITIONAL_PROOF_OR_USE_SEPARATE_IMMUTABLE_PUBLISH_LEDGER"
        elif model == "MUTABLE_DRAFT_ROOT_WITH_SEPARATE_PUBLISH_LEDGER":
            correction = "REMOVE_REDUNDANT_PROOF_FROM_MUTABLE_ROOT_AND_USE_APPROVED_IMMUTABLE_PUBLISH_LEDGER"
        else:
            correction = "MAKE_PROOF_NULLABLE_ALL_OR_NONE_FORBID_DRAFT_REQUIRE_PUBLISHED_OR_MOVE_TO_IMMUTABLE_LEDGER"
        findings.append(make_finding(
            "LIFECYCLE_PROOF_REQUIRED_BEFORE_PROOF_EXISTS",
            operation_id=oid, table=table, field=forced,
            evidence={
                "lifecycleModel": model,
                "transitionPreStates": op.get("transition", {}).get("preStates"),
                "transitionPostStates": op.get("transition", {}).get("postStates"),
                "schemaColumns": {name: columns[table][name] for name in forced},
            },
            expected_correction_class=correction,
            false_positive_guard=(
                "The finding fires only while every listed proof field is NOT NULL/no-default on a row written before that approval/verification can exist. Fake values and generic defaults are explicitly forbidden."
            ),
        ))

    # Independent table/producer closure: the listening version is updated by
    # revise/publish but no command or handler can create it.
    version_table = "sys_hris_listening_survey_versions"
    producers = []
    mutators = []
    for op in ssot.get("operations", []):
        for row in op.get("orderedDml", []):
            if row.get("table") != version_table:
                continue
            record = {"operationId": op["operationId"], "action": row.get("action"), "step": row.get("step")}
            (producers if row.get("action") in WRITE_ACTIONS else mutators).append(record)
    for handler in ssot.get("systemHandlers", []):
        for row in handler.get("writes", []):
            if row.get("table") == version_table:
                record = {"handlerId": handler["handlerId"], "action": row.get("action")}
                (producers if row.get("action") in WRITE_ACTIONS else mutators).append(record)
    if mutators and not producers:
        findings.append(make_finding(
            "UPDATE_ONLY_VERSION_TABLE_HAS_NO_CREATOR",
            operation_id="modern.listening.survey.create", table=version_table,
            field=["listening_survey_id", "state", "payload_digest", "reference_effective_at", *PROOF_COLUMNS],
            evidence={"producers": producers, "mutators": mutators, "relatedOperations": ["modern.listening.survey.create", "modern.listening.survey.revise", "modern.listening.survey.publish"]},
            expected_correction_class="CREATE_INITIAL_DRAFT_VERSION_AT_SURVEY_CREATE_THEN_CAS_APPEND_OR_UPDATE_EXACT_VERSION",
            false_positive_guard=(
                "All public operations and all 25 handlers are searched for INSERT/APPEND/UPSERT; only UPDATE_CAS consumers exist."
            ),
        ))
    return findings


def owner_dependency_closed_set_findings(
    ssot: dict[str, Any], exact: dict[str, Any],
) -> list[dict[str, Any]]:
    """Independently freeze the two global owner dependencies and manifest pin.

    The protected Listening design contributes exactly one dependency; PAY adds
    exactly one.  Exact-schema projection must be byte-semantic equality, and
    both canonical documents must identify the deterministic successor
    manifest.  This prevents a locally valid PAY contract from masking a
    removed Listening dependency or an unreviewed third dependency.
    """
    rows = ssot.get("ownerDependencyContracts", [])
    exact_rows = exact.get("ownerDependencyContracts", [])
    ids = [row.get("dependencyContractId") for row in rows]
    expected_ids = [LISTENING_DEPENDENCY_ID, PAYROLL_DEPENDENCY_ID]
    defects: list[str] = []
    if ids != expected_ids:
        defects.append("GLOBAL_DEPENDENCY_IDS_OR_ORDER_NOT_EXACT_TWO")
    if sum(value == LISTENING_DEPENDENCY_ID for value in ids) != 1:
        defects.append("LISTENING_LOCAL_DEPENDENCY_NOT_EXACT_ONE")
    if exact_rows != rows:
        defects.append("EXACT_OWNER_DEPENDENCY_PROJECTION_DRIFT")
    for row in rows:
        dependency_id = row.get("dependencyContractId")
        observed = row.get("sealedPayloadSha256")
        calculated = canonical_hash({
            key: value for key, value in row.items()
            if key != "sealedPayloadSha256"
        })
        if observed != calculated:
            defects.append(f"DEPENDENCY_SELF_SEAL_MISMATCH:{dependency_id}")
        if observed != EXPECTED_OWNER_DEPENDENCY_SEALS.get(dependency_id):
            defects.append(f"DEPENDENCY_EXPECTED_SEAL_DRIFT:{dependency_id}")
    if ssot.get("closedSetManifest") != EXPECTED_CLOSED_SET_MANIFEST_PIN:
        defects.append("SSOT_EMBEDDED_MANIFEST_PIN_DRIFT")
    if exact.get("closedSetManifest") != EXPECTED_CLOSED_SET_MANIFEST_PIN:
        defects.append("EXACT_EMBEDDED_MANIFEST_PIN_DRIFT")
    if not defects:
        return []
    return [make_finding(
        "OWNER_DEPENDENCY_CLOSED_SET_INCOMPLETE",
        field="ownerDependencyContracts",
        evidence={
            "defects": defects,
            "expectedIds": expected_ids,
            "actualIds": ids,
            "expectedSeals": EXPECTED_OWNER_DEPENDENCY_SEALS,
            "ssotManifestPin": ssot.get("closedSetManifest"),
            "exactManifestPin": exact.get("closedSetManifest"),
        },
        expected_correction_class=(
            "RESTORE_EXACT_TWO_SEALED_GLOBAL_DEPENDENCIES_EXACT_SCHEMA_"
            "PROJECTION_AND_DETERMINISTIC_MANIFEST_PIN"
        ),
        false_positive_guard=(
            "The global contract has exactly one protected Listening dependency "
            "and one PAY snapshot dependency.  A third, missing, resealed, "
            "reordered, unprojected, or differently pinned dependency is a new "
            "cross-session API surface and requires a new reviewed successor."
        ),
    )]


def _payroll_dependency_defects(
    ssot: dict[str, Any], event: dict[str, Any], refetch: dict[str, Any],
) -> list[str]:
    dependencies = [
        row for row in ssot.get("ownerDependencyContracts", [])
        if row.get("dependencyContractId") == PAYROLL_DEPENDENCY_ID
    ]
    if len(dependencies) != 1:
        return ["DEPENDENCY_CARDINALITY_NOT_EXACT_ONE"]
    dependency = dependencies[0]
    body = {
        key: value for key, value in dependency.items()
        if key != "sealedPayloadSha256"
    }
    seal = hashlib.sha256(json.dumps(
        body, ensure_ascii=False, sort_keys=True, separators=(",", ":"),
    ).encode("utf-8")).hexdigest()
    request_schema = dependency.get("requestSchema", {})
    request_rows = request_schema.get("fields", [])
    request_fields = {row.get("name") for row in request_rows}
    request_by_name = {row.get("name"): row for row in request_rows}
    response_schema = dependency.get("responseSchema", {})
    header_rows = response_schema.get("headerFields", [])
    header_fields = [row.get("name") for row in header_rows]
    header_types = {row.get("name"): row.get("type") for row in header_rows}
    header_by_name = {row.get("name"): row for row in header_rows}
    lines = response_schema.get("lines", {})
    line_rows = lines.get("itemFields", [])
    line_fields = [row.get("name") for row in line_rows]
    line_types = {row.get("name"): row.get("type") for row in line_rows}
    line_by_name = {row.get("name"): row for row in line_rows}
    expected_header_types = {
        "snapshotId": "UUID", "snapshotRevision": "BIGINT", "planId": "UUID",
        "cycleId": "UUID", "effectiveFrom": "DATE", "effectiveTo": "DATE",
        "approvalReceiptId": "UUID", "sourceVersion": "BIGINT",
        "lineCount": "INTEGER", "payloadDigest": "SHA256",
    }
    expected_line_types = {
        "lineId": "UUID", "lineSequence": "INTEGER", "workerId": "UUID",
        "assignmentId": "UUID", "componentCode": "STRING",
        "currency": "STRING", "approvedAmount": "DECIMAL_STRING",
        "effectiveFrom": "DATE", "effectiveTo": "DATE", "lineDigest": "SHA256",
    }
    streaming = dependency.get("streamingValidation", {})
    expected_streaming = {
        "maxLineCount": 100000,
        "maxHeaderBytes": 65536,
        "maxLineBytes": 4096,
        "maxPayloadBytes": 536870912,
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
    }
    expected_transport = {
        "method": "GET",
        "path": (
            "/internal/hris-performance/v1/approved-compensation-plan-snapshots/"
            "{snapshotId}"
        ),
        "mode": "BOUNDED_STREAMING_HEADER_THEN_ORDERED_LINES",
        "backpressure": "END_TO_END_REACTIVE_PULL_WITH_BOUNDED_QUEUES",
        "gatewayBuffering": "FORBIDDEN_STREAM_THROUGH",
    }
    event_rows = event.get("fields", [])
    event_field_names = [row.get("name") for row in event_rows]
    event_field_types = {row.get("name"): row.get("type") for row in event_rows}
    expected_event_names = list(PAYROLL_EVENT_FIELD_TYPES)
    expected_refetch_exposure = [
        *PAYROLL_HEADER_FIELD_ORDER,
        "lines",
        *(f"lines[].{name}" for name in PAYROLL_LINE_FIELD_ORDER),
    ]
    audience = event.get("audience", {})
    audience_exposure = audience.get("fieldExposure", {})
    expected_consumer_exposure = {
        "HRIS-PAY": {
            "purpose": [PAYROLL_PURPOSE],
            "mode": "EXACT_ALLOWLIST",
            "fields": list(PAYROLL_PAY_EVENT_FIELD_ORDER),
        },
        "HRIS-PER": {
            "purpose": ["COMPENSATION_PLAN_PUBLISH"],
            "mode": "EXACT_ALLOWLIST",
            "fields": expected_event_names,
        },
    }
    pep = refetch.get("pep", {})
    defects: list[str] = []
    checks = {
        "EVENT_NOT_EXACT_COMPENSATION_SNAPSHOT": (
            event.get("eventName") == PAYROLL_EVENT_NAME
        ),
        "DEPENDENCY_SELF_SEAL_MISMATCH": (
            dependency.get("sealedPayloadSha256") == seal
        ),
        "DEPENDENCY_EXPECTED_SEAL_DRIFT": (
            dependency.get("sealedPayloadSha256")
            == EXPECTED_OWNER_DEPENDENCY_SEALS[PAYROLL_DEPENDENCY_ID]
        ),
        "DEPENDENCY_OWNER_CONSUMER_DRIFT": (
            dependency.get("ownerSession") == "HRIS-PER"
            and dependency.get("consumerSession") == "HRIS-PAY"
        ),
        "DEPENDENCY_REQUEST_TUPLE_OPEN_OR_INCOMPLETE": (
            request_schema.get("additionalProperties") is False
            and request_fields == PAYROLL_REQUEST_FIELDS
            and request_schema.get("callerTenantOverride") == "FORBIDDEN"
            and request_schema.get("exactTuple")
            == (
                "verifiedTenantId+snapshotId+snapshotRevision+payloadDigest+"
                "verifiedPurposeCode"
            )
            and request_by_name.get("tenantId", {}).get("source")
            == "verifiedWorkloadContext.tenantId"
            and request_by_name.get("tenantId", {}).get("callerSupplied") is False
            and request_by_name.get("snapshotId", {}).get("source")
            == "pathParameters.snapshotId"
            and request_by_name.get("snapshotRevision", {}).get("source")
            == "queryParameters.snapshotRevision"
            and request_by_name.get("payloadDigest", {}).get("source")
            == "queryParameters.payloadDigest"
            and request_by_name.get("purposeCode", {}).get("source")
            == "verifiedWorkloadContext.purposeCode"
            and request_by_name.get("purposeCode", {}).get("callerSupplied") is False
            and request_by_name.get("purposeCode", {}).get("allowedValues")
            == [PAYROLL_PURPOSE]
        ),
        "DEPENDENCY_WORKLOAD_AUTH_INCOMPLETE": (
            dependency.get("callerAuth", {}).get("workloadAllowlist")
            == ["spiffe://dwp/service/dwp-payroll-server"]
            and set(dependency.get("callerAuth", {}).get("authentication", []))
            == {
                "MTLS_SPIFFE_WORKLOAD_IDENTITY",
                "OAUTH2_CLIENT_CREDENTIAL_JWT_AUD_DWP_PEOPLE",
            }
            and dependency.get("callerAuth", {}).get("noCallerTenantOverride") is True
            and dependency.get("callerAuth", {}).get("audience")
            == "dwp-people:approved-compensation-snapshot-refetch"
            and dependency.get("callerAuth", {}).get("signedTenantClaim")
            == "REQUIRED_EXACT_OWNER_TENANT"
        ),
        "DEPENDENCY_PEP_INCOMPLETE": (
            dependency.get("pep", {}).get("purpose") == PAYROLL_PURPOSE
            and dependency.get("pep", {}).get("consumerSessionAllowlist")
            == ["HRIS-PAY"]
            and dependency.get("pep", {}).get("denyOnUnavailable") is True
            and dependency.get("pep", {}).get("reauthorizeEveryCall") is True
            and dependency.get("pep", {}).get("tenant")
            == "signed tenant claim equals snapshot tenant"
            and dependency.get("pep", {}).get("population")
            == "PAYROLL_INPUT_AUTHORIZED_WORKER_POPULATION_ONLY"
            and dependency.get("pep", {}).get("fieldPolicy")
            == "MINIMUM_PAYROLL_INPUT_FIELDS_ONLY"
        ),
        "DEPENDENCY_NOT_STRICTLY_READ_ONLY": (
            dependency.get("orderedDml") == []
            and dependency.get("writes") == "FORBIDDEN"
            and dependency.get("receiptAndOutbox")
            == "FORBIDDEN_READ_ONLY_DEPENDENCY"
        ),
        "DEPENDENCY_LATEST_OR_OFFSET_FALLBACK": (
            dependency.get("latestFallback") == "FORBIDDEN"
            and dependency.get("pagination", {}).get("arbitraryOffset") == "FORBIDDEN"
            and dependency.get("readPlan", {}).get("latestFallback") == "FORBIDDEN"
        ),
        "DEPENDENCY_STREAM_BOUNDS_INCOMPLETE": (
            response_schema.get("additionalProperties") is False
            and header_fields == list(PAYROLL_HEADER_FIELD_ORDER)
            and header_types == expected_header_types
            and all(row.get("required") is True for row in header_rows)
            and line_fields == list(PAYROLL_LINE_FIELD_ORDER)
            and line_types == expected_line_types
            and all(row.get("required") is True for row in line_rows)
            and lines.get("required") is True
            and lines.get("minItems") == 1
            and lines.get("maxItems") == 100000
            and lines.get("type") == "ARRAY_STREAM"
            and lines.get("itemAdditionalProperties") is False
            and lines.get("ordering") == "lineSequence ASC contiguous from 1"
            and dependency.get("transport") == expected_transport
        ),
        "DEPENDENCY_RESPONSE_FIELD_SEMANTICS_DRIFT": (
            header_by_name.get("effectiveTo", {}).get("nullable") is True
            and header_by_name.get("effectiveTo", {}).get("nullEncoding")
            == "EXPLICIT_JSON_NULL_INCLUDED_IN_CANONICAL_DIGEST"
            and all(
                row.get("nullable") is False
                for name, row in header_by_name.items() if name != "effectiveTo"
            )
            and line_by_name.get("effectiveTo", {}).get("nullable") is True
            and line_by_name.get("effectiveTo", {}).get("nullEncoding")
            == "EXPLICIT_JSON_NULL_INCLUDED_IN_CANONICAL_DIGEST"
            and all(
                row.get("nullable") is False
                for name, row in line_by_name.items() if name != "effectiveTo"
            )
            and line_by_name.get("currency", {}).get("pattern") == "^[A-Z]{3}$"
            and line_by_name.get("currency", {}).get("validation")
            == "ISO_4217_UPPERCASE_ALPHA3"
            and line_by_name.get("approvedAmount", {}).get("pattern")
            == r"^-?(?:0|[1-9][0-9]{0,14})(?:\.[0-9]{1,4})?$"
            and line_by_name.get("approvedAmount", {}).get("valueTypeRef")
            == "coding-readiness/decimal-value-types.v1.json#/valueTypes/PostedMoney"
            and line_by_name.get("approvedAmount", {}).get("sqlType")
            == "NUMERIC(19,4)"
            and line_by_name.get("approvedAmount", {}).get("exponentNotation")
            == "FORBIDDEN"
            and line_by_name.get("approvedAmount", {}).get("binaryFloatingPoint")
            == "FORBIDDEN"
            and line_by_name.get("approvedAmount", {}).get("negativeZero")
            == "FORBIDDEN"
            and line_by_name.get("approvedAmount", {}).get("implicitRounding")
            == "FORBIDDEN"
            and line_by_name.get("approvedAmount", {}).get("quantization")
            == "EXPLICIT_EFFECTIVE_CURRENCY_POLICY_BEFORE_SNAPSHOT_FREEZE"
            and line_by_name.get("lineSequence", {}).get("validation")
            == "ONE_BASED_STREAM_ORDINAL_CONTIGUOUS_NO_GAP_NO_DUPLICATE"
            and line_by_name.get("lineDigest", {}).get("validation")
            == (
                "SHA256_OF_VERSIONED_DOMAIN_SEPARATED_RFC8785_LINE_VALUE_ARRAY_"
                "EXCLUDING_LINE_DIGEST_WITH_EXPLICIT_NULL_AND_CANONICAL_POSTED_MONEY"
            )
        ),
        "DEPENDENCY_DIGEST_CANONICALIZATION_DRIFT": (
            dependency.get("digestCanonicalization")
            == _expected_payroll_digest_canonicalization()
        ),
        "DEPENDENCY_COUNT_SEQUENCE_DIGEST_INCOMPLETE": (
            streaming == expected_streaming
        ),
        "DEPENDENCY_PRIVACY_MINIMIZATION_INCOMPLETE": (
            dependency.get("privacy", {}).get("eventCarriesLines") is False
            and dependency.get("privacy", {}).get("arbitraryFieldExpansion")
            == "FORBIDDEN"
            and dependency.get("privacy", {}).get("minimumDisclosure")
            == "ONLY_FIELDS_REQUIRED_TO_FREEZE_PAYROLL_INPUT"
            and dependency.get("privacy", {}).get("logging")
            == "NO_LINE_VALUES_NO_PAY_AMOUNTS_NO_WORKER_IDENTIFIERS"
        ),
        "EVENT_DEPENDENCY_PIN_MISMATCH": (
            refetch.get("mode") == "EXACT_OWNER_DEPENDENCY"
            and refetch.get("dependencyContractId") == PAYROLL_DEPENDENCY_ID
            and refetch.get("dependencyContractSha256") == seal
            and refetch.get("ownerSession") == "HRIS-PER"
        ),
        "EVENT_LATEST_FALLBACK_ALLOWED": (
            refetch.get("latestFallback") == "FORBIDDEN"
        ),
        "EVENT_PAY_CONSUMER_OR_PURPOSE_MISSING": (
            refetch.get("consumerSessionAllowlist") == ["HRIS-PAY"]
            and refetch.get("purpose") == PAYROLL_PURPOSE
            and refetch.get("response")
            == "BOUNDED_STREAMING_HEADER_PLUS_1_TO_100000_ORDERED_LINES"
            and refetch.get("version")
            == "event.snapshotRevision exact immutable revision"
            and refetch.get("digest")
            == "event.payloadDigest exact complete-stream digest"
            and refetch.get("selectorTuple") == [
                "eventEnvelope.tenantId", "event.snapshotId", "event.snapshotRevision",
                "event.payloadDigest", f"CONSTANT:{PAYROLL_PURPOSE}",
            ]
            and refetch.get("tenantBinding") == {
                "eventEnvelopeTenant": "eventEnvelope.tenantId",
                "signedWorkloadTenant": "verifiedWorkloadContext.tenantId",
                "ownerRowTenant": "prf_cmp_approved_snapshots.tenant_id",
                "equality": "ALL_THREE_REQUIRED_EQUAL",
            }
            and refetch.get("payloadSufficiency")
            == "HEADER_DIGEST_INVALIDATION_TRIGGER_ONLY_NO_PAY_LINES"
            and pep.get("tenant")
            == (
                "eventEnvelope.tenantId equals signed workload tenant and owner row "
                "tenant"
            )
            and pep.get("purpose") == [PAYROLL_PURPOSE]
            and pep.get("population")
            == "PAYROLL_INPUT_AUTHORIZED_WORKER_POPULATION_ONLY"
            and pep.get("fieldExposure") == expected_refetch_exposure
            and pep.get("reauthorizeEveryCall") is True
            and pep.get("denyOnUnavailable") is True
        ),
        "EVENT_HEADER_NOT_EXACT_MINIMUM": (
            event_field_names == expected_event_names
            and event_field_types == PAYROLL_EVENT_FIELD_TYPES
            and all(row.get("required") is True for row in event_rows)
            and "lines" not in event_field_names
            and "tenantId" not in event_field_names
            and canonical_hash(event_rows)
            == PAYROLL_OPERATION_EVENT_FIELDS_SHA256
        ),
        "EVENT_LEAKS_PAYROLL_LINES": "lines" not in event_field_names,
        "EVENT_AUDIENCE_EXPOSURE_OPEN_OR_DRIFTED": (
            audience.get("classification") == "INTERNAL_DOMAIN"
            and audience.get("allowedConsumerSessions") == ["HRIS-PAY", "HRIS-PER"]
            and audience.get("allowedPurposes")
            == ["COMPENSATION_PLAN_PUBLISH", PAYROLL_PURPOSE]
            and audience_exposure.get("mode") == "EXACT_ALLOWLIST"
            and audience_exposure.get("fields") == expected_event_names
            and audience.get("consumerFieldExposure") == expected_consumer_exposure
            and audience.get("denyUnknownConsumerOrPurpose") is True
            and canonical_hash(audience) == PAYROLL_OPERATION_AUDIENCE_SHA256
        ),
        "EVENT_REFETCH_EXACT_FINGERPRINT_DRIFT": (
            canonical_hash(refetch) == PAYROLL_OPERATION_REFETCH_SHA256
        ),
    }
    defects.extend(name for name, passed in checks.items() if not passed)
    return defects


def event_refetch_findings(ssot: dict[str, Any], exact: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, int]]:
    ops = operation_index(ssot)
    bindings = binding_index(exact)
    findings: list[dict[str, Any]] = []
    stats: collections.Counter[str] = collections.Counter()
    for op in ssot.get("operations", []):
        for event in op.get("events", []):
            stats["publicEventsChecked"] += 1
            refetch = event.get("refetchContract") or {}
            mode = refetch.get("mode")
            if (
                event.get("eventName") == PAYROLL_EVENT_NAME
                or mode == "EXACT_OWNER_DEPENDENCY"
            ):
                defects = _payroll_dependency_defects(ssot, event, refetch)
                if not defects:
                    stats["exactOwnerDependencyRefetch"] += 1
                    continue
                stats["ownerDependencyRefetchDefects"] += 1
                findings.append(make_finding(
                    "EVENT_OWNER_DEPENDENCY_REFETCH_INCOMPLETE",
                    operation_id=op["operationId"], event_name=event.get("eventName"),
                    table=(event.get("aggregateEntityType") or "").removeprefix("table:"),
                    evidence={
                        "defects": defects,
                        "dependencyContractId": refetch.get("dependencyContractId"),
                        "refetchContract": refetch,
                    },
                    expected_correction_class=(
                        "RESTORE_EXACT_SEALED_READ_ONLY_PER_TO_PAY_SNAPSHOT_DEPENDENCY_"
                        "WITH_BOUNDED_ORDERED_STREAM_AND_HEADER_ONLY_EVENT"
                    ),
                    false_positive_guard=(
                        "The exception is limited to the exact compensation snapshot event; "
                        "it validates a sealed PAY-only service identity, tenant/purpose/field "
                        "PEP, exact revision+digest, bounded ordered streaming, zero writes/"
                        "outbox, and no pay lines in the event."
                    ),
                ))
                continue
            if mode == "FORBIDDEN":
                stats["forbiddenRefetch"] += 1
                continue
            endpoint = refetch.get("endpointOperationId")
            if not endpoint:
                stats["nonForbiddenWithoutEndpoint"] += 1
                findings.append(make_finding(
                    "EVENT_REFETCH_ENDPOINT_MISSING",
                    operation_id=op["operationId"], event_name=event.get("eventName"),
                    table=(event.get("aggregateEntityType") or "").removeprefix("table:"),
                    evidence={"refetchMode": mode, "refetchContract": refetch},
                    expected_correction_class="DECLARE_EXACT_HISTORICAL_DETAIL_QUERY_OR_SET_REFETCH_FORBIDDEN",
                    false_positive_guard="FORBIDDEN refetch events are accepted; only a non-FORBIDDEN contract without endpoint is rejected.",
                ))
                continue
            query = ops.get(endpoint)
            binding = bindings.get(endpoint, {})
            projection = binding.get("responseProjection") or {}
            aggregate = event.get("aggregateEntityType")
            refetch_entity = refetch.get("entityType")
            query_entity = projection.get("entity")
            sources = [table_entity(x) for x in projection.get("physicalSources", [])]
            request_ref_entities = {
                row.get("referenceContract", {}).get("entityType")
                for row in (query or {}).get("requestFields", [])
                if row.get("location") == "pathParameters" and row.get("referenceContract")
            }
            exact_identity_reentry = (
                query is not None and query.get("mode") == "QUERY"
                and aggregate == refetch_entity == query_entity
                and aggregate in request_ref_entities
            )
            if exact_identity_reentry:
                stats["exactReentry"] += 1
                continue
            stats["aggregateQueryMismatch"] += 1
            findings.append(make_finding(
                "EVENT_REFETCH_NOT_EXACT_AGGREGATE_REENTRY",
                operation_id=op["operationId"], event_name=event.get("eventName"),
                table=(aggregate or "").removeprefix("table:"),
                evidence={
                    "aggregateEntity": aggregate, "refetchEntity": refetch_entity,
                    "endpointOperationId": endpoint, "endpointExists": query is not None,
                    "endpointMode": (query or {}).get("mode"), "queryItemEntity": query_entity,
                    "queryPhysicalSources": projection.get("physicalSources", []),
                    "aggregateOnlyJoinedSource": aggregate in sources,
                    "queryPathReferenceEntities": sorted(x for x in request_ref_entities if x),
                },
                expected_correction_class="POINT_TO_DETAIL_QUERY_WHOSE_PATH_SELECTOR_AND_RESPONSE_ENTITY_EQUAL_EVENT_AGGREGATE",
                false_positive_guard=(
                    "A joined physical source alone is insufficient: the endpoint must accept the event aggregate public ID and return that same aggregate entity. Composite parent queries without a child selector cannot re-enter an event child identity."
                ),
            ))
    return findings, dict(stats)


def handler_refetch_findings(ssot: dict[str, Any], exact: dict[str, Any]) -> list[dict[str, Any]]:
    ops = operation_index(ssot)
    bindings = binding_index(exact)
    findings: list[dict[str, Any]] = []
    for handler in ssot.get("systemHandlers", []):
        events = [handler.get("event") or {}]
        if handler.get("handlerId") == "internal.workforceplan.simulation-result.consume":
            events.extend(handler.get("additionalEvents", []))
        for event in events:
            raw_refetch = event.get("refetchContract")
            refetch = raw_refetch if isinstance(raw_refetch, dict) else {}
            if not event:
                continue
            if refetch.get("mode") == "FORBIDDEN":
                if handler.get("handlerId") != "internal.workforceplan.simulation-result.consume":
                    continue
                event_fields = {row.get("name") for row in event.get("fields", [])}
                raw_owner = refetch.get("resultOwnerContract")
                owner = raw_owner if isinstance(raw_owner, dict) else {}
                required_owner_fields = set(WFP_RESULT_OWNER_REQUIRED_FIELDS)
                stale_hints = sorted(
                    set(refetch) & {"endpointOperationId", "entityType", "version", "asOf"}
                )
                defects: list[str] = []
                if refetch.get("aggregateLookup") != "FORBIDDEN":
                    defects.append("AGGREGATE_LOOKUP_NOT_FORBIDDEN")
                if refetch.get("latestFallback") != "FORBIDDEN":
                    defects.append("LATEST_FALLBACK_NOT_FORBIDDEN")
                if refetch.get("payloadSufficiency") != WFP_RESULT_OWNER_PAYLOAD_SUFFICIENCY:
                    defects.append("PAYLOAD_SUFFICIENCY_NOT_CLOSED")
                if stale_hints:
                    defects.append("STALE_REFETCH_HINT_PRESENT")
                if set(owner) != WFP_RESULT_OWNER_CONTRACT_KEYS:
                    defects.append("RESULT_OWNER_CONTRACT_NOT_CLOSED")
                if owner.get("requiredFields") != list(WFP_RESULT_OWNER_REQUIRED_FIELDS):
                    defects.append("RESULT_OWNER_REQUIRED_FIELDS_DRIFT")
                if not required_owner_fields <= event_fields:
                    defects.append("RESULT_OWNER_FIELDS_MISSING_FROM_EVENT")
                if owner.get("denyOnUnavailable") is not True:
                    defects.append("RESULT_OWNER_DENY_ON_UNAVAILABLE_MISSING")
                if owner.get("identity") != WFP_RESULT_OWNER_IDENTITY:
                    defects.append("RESULT_OWNER_EXACT_IDENTITY_DRIFT")
                if owner.get("validation") != WFP_RESULT_OWNER_VALIDATION:
                    defects.append("RESULT_OWNER_SIGNED_VALIDATION_DRIFT")
                if defects:
                    findings.append(make_finding(
                        "HANDLER_FORBIDDEN_REFETCH_PAYLOAD_CONTRACT_INCOMPLETE",
                        handler_id=handler.get("handlerId"),
                        event_name=event.get("eventName"),
                        table=(event.get("aggregateEntityType") or "").removeprefix("table:"),
                        evidence={
                            "defects": defects, "staleRefetchHints": stale_hints,
                            "eventFields": sorted(x for x in event_fields if x),
                            "resultOwnerContract": raw_owner,
                            "expectedResultOwnerContract": {
                                "requiredFields": list(WFP_RESULT_OWNER_REQUIRED_FIELDS),
                                "identity": WFP_RESULT_OWNER_IDENTITY,
                                "validation": WFP_RESULT_OWNER_VALIDATION,
                                "denyOnUnavailable": True,
                            },
                            "refetchContract": refetch,
                        },
                        expected_correction_class=(
                            "RESTORE_PAYLOAD_SUFFICIENT_FORBIDDEN_LOOKUP_WITH_EXACT_"
                            "SIGNED_RESULT_OWNER_PROOF_AND_NO_LATEST_FALLBACK"
                        ),
                        false_positive_guard=(
                            "FORBIDDEN is accepted only for both Workforce Planning terminal events when the closed payload carries the exact receipt/revision/schema/digest tuple with the reviewed signed-owner validation and deny-on-unavailable semantics, aggregate lookup/latest fallback are explicitly forbidden, and no endpoint/entity/version/asOf hint survives."
                        ),
                    ))
                continue
            endpoint = refetch.get("endpointOperationId")
            if not endpoint:
                continue
            query = ops.get(endpoint)
            projection = (bindings.get(endpoint, {}).get("responseProjection") or {})
            aggregate = event.get("aggregateEntityType")
            query_refs = {
                row.get("referenceContract", {}).get("entityType")
                for row in (query or {}).get("requestFields", [])
                if row.get("location") == "pathParameters" and row.get("referenceContract")
            }
            if (query and query.get("mode") == "QUERY" and aggregate == refetch.get("entityType")
                    and aggregate == projection.get("entity") and aggregate in query_refs):
                continue
            findings.append(make_finding(
                "HANDLER_EVENT_REFETCH_NOT_EXACT_AGGREGATE_REENTRY",
                handler_id=handler.get("handlerId"), event_name=event.get("eventName"),
                table=(aggregate or "").removeprefix("table:"),
                evidence={
                    "aggregateEntity": aggregate, "refetchEntity": refetch.get("entityType"),
                    "endpointOperationId": endpoint, "queryItemEntity": projection.get("entity"),
                    "queryPhysicalSources": projection.get("physicalSources", []),
                    "queryPathReferenceEntities": sorted(x for x in query_refs if x),
                },
                expected_correction_class="POINT_HANDLER_EVENT_TO_EXACT_HISTORICAL_AGGREGATE_DETAIL_QUERY_OR_CLOSE_PAYLOAD_SUFFICIENT_REFETCH_FORBIDDEN",
                false_positive_guard=(
                    "The same exact identity rule used for public events is applied to handler events; a query that merely joins the table is not an exact aggregate refetch. A FORBIDDEN alternative is accepted only by the independently checked closed-payload contract."
                ),
            ))
    return findings


def template_identity_findings(ssot: dict[str, Any], exact: dict[str, Any]) -> list[dict[str, Any]]:
    specs, _ = table_maps(exact)
    owner = {name: spec.get("capabilityId") for name, spec in specs.items()}
    findings: list[dict[str, Any]] = []
    for oid in ("modern.learning.assignment.cancel", "modern.learning.assignment.query"):
        op = operation_index(ssot).get(oid)
        if not op:
            continue
        foreign = []
        for field in op.get("requestFields", []):
            entity = field.get("referenceContract", {}).get("entityType", "")
            if entity.startswith("table:"):
                table = entity[6:]
                if owner.get(table) and owner[table] != op.get("capabilityId"):
                    foreign.append({"source": field.get("source"), "table": table, "ownerCapabilityId": owner[table]})
        if foreign:
            findings.append(make_finding(
                "LEARNING_ASSIGNMENT_USES_ONBOARDING_IDENTITY",
                operation_id=oid, table=foreign[0]["table"], field=foreign[0]["source"],
                evidence={"operationCapabilityId": op.get("capabilityId"), "foreignReferences": foreign, "aggregateRoot": op.get("aggregateRoot")},
                expected_correction_class="RETYPE_REQUEST_SELECTOR_AND_INPUT_EFFECT_TO_PRF_LRN_ASSIGNMENTS_PUBLIC_ID",
                false_positive_guard=(
                    "This is not a permitted cross-capability parent: the operation aggregate/input effect is prf_lrn_assignments while its path identity is owned by onboarding ppl_jny_assignments."
                ),
            ))
    return findings


def special_semantic_findings(ssot: dict[str, Any]) -> list[dict[str, Any]]:
    ops = operation_index(ssot)
    findings: list[dict[str, Any]] = []
    proposal = ops.get("modern.compplan.proposal.upsert")
    if proposal:
        body = sorted(request_body_names(proposal))
        pre = proposal.get("transition", {}).get("preStates", [])
        if "NONE" in pre and any(x != "NONE" for x in pre):
            findings.append(make_finding(
                "MIXED_CREATE_UPDATE_IDENTITY_AND_SEMANTICS",
                operation_id=proposal["operationId"], table="prf_cmp_proposals", field=["proposalId", "workerPublicId", "componentCode", "amount", "currencyCode", "effectiveDate"],
                evidence={"method": proposal.get("method"), "path": proposal.get("path"), "preStates": pre, "bodyFields": body, "insertPublicIdSource": next((r.get("assignments", {}).get("public_id") for r in proposal.get("orderedDml", []) if r.get("table") == "prf_cmp_proposals" and r.get("action") == "INSERT"), None)},
                expected_correction_class="SPLIT_POST_COLLECTION_CREATE_FROM_PATCH_OR_PUT_IDENTIFIED_UPDATE",
                false_positive_guard=(
                    "The same operation path contains proposalId, admits NONE and DRAFT, but its INSERT allocates a different server ID and has no compensation facts."
                ),
            ))
    metric = ops.get("modern.analytics.metric.create")
    if metric:
        body = request_body_names(metric)
        mixed = sorted(body & {"cohortDefinitionId", "anonymityThreshold", "asOf", "calculatedAt", "subjectCount"})
        if mixed:
            findings.append(make_finding(
                "ANALYTICS_METRIC_DEFINITION_MIXES_PROJECTION_RESULT_FACTS",
                operation_id=metric["operationId"], table="sys_hris_metric_projections", field=mixed,
                evidence={"currentBodyFields": sorted(body), "projectionFieldsOnMetricCreate": mixed},
                expected_correction_class="KEEP_METRIC_DEFINITION_INPUTS_ON_CREATE_MOVE_REQUEST_INPUTS_TO_PROJECTION_REQUEST_AND_RESULT_FACTS_TO_HANDLER",
                false_positive_guard=(
                    "calculatedAt and subjectCount are owner-result facts; asOf/cohort/anonymity are projection-request facts. None belongs to metric-definition creation."
                ),
            ))
    return findings


def listening_authority_findings(ssot: dict[str, Any], exact: dict[str, Any]) -> list[dict[str, Any]]:
    """Compare modern listening operations to the sealed stream-authority shape."""
    ops = operation_index(ssot)
    findings: list[dict[str, Any]] = []
    submit = ops.get("modern.listening.response.submit")
    if submit:
        body = request_body_names(submit)
        required_body = {"signedParticipationCredential", "responseToken", "answers"}
        missing_body = sorted(required_body - body)
        extra_body = sorted(body - required_body)
        path_fields = {
            row.get("name") for row in submit.get("requestFields", [])
            if row.get("location") == "pathParameters"
        }
        missing_path = sorted({"surveyId"} - path_fields)
        extra_path = sorted(path_fields - {"surveyId"})
        credential_field = next((
            row for row in submit.get("requestFields", [])
            if row.get("source") == "body.signedParticipationCredential"
        ), {})
        credential_resolution, credential_diagnostics = (
            _listening_credential_nested_resolution(submit, credential_field)
        )
        route_field = next((
            row for row in submit.get("requestFields", [])
            if row.get("source") == "pathParameters.surveyId"
        ), {})
        route_resolution, route_diagnostics = _listening_route_nested_resolution(
            submit, route_field
        )
        selectors = submit.get("selectors", [])
        selector_tables = {row.get("targetTable") for row in selectors}
        dml = [row for row in submit.get("orderedDml", []) if row.get("action") in WRITE_ACTIONS | {"UPDATE_CAS"}]
        dml_tables = {row.get("table") for row in dml}
        required_tables = {
            "sys_hris_listening_responses", "sys_hris_listening_answer_values",
            "sys_hris_listening_token_consumptions", "sys_hris_listening_protected_receipts",
        }
        response_assignments = next((row.get("assignments", {}) for row in dml if row.get("table") == "sys_hris_listening_responses"), {})
        required_response_fields = {
            "listening_admission_version_id", "reference_effective_at",
            "form_version_public_id", "form_artifact_digest",
            "consent_policy_version_public_id", "consent_evidence_digest",
            "response_key_public_id", "response_key_version", "response_token_hash",
        }
        missing_response_fields = sorted(required_response_fields - set(response_assignments))
        token_assignments = next((
            row.get("assignments", {}) for row in submit.get("orderedDml", [])
            if row.get("table") == "sys_hris_listening_token_consumptions"
            and row.get("role") == "ONE_TIME_TOKEN_CONSUMPTION"
        ), {})
        missing_token_fields = sorted({
            "listening_admission_version_id", "token_commitment",
            "credential_jti_commitment", "credential_digest",
            "non_revocation_proof_digest", "request_digest", "consumed_at",
        } - set(token_assignments))
        expected_roles = [
            "PROTECTED_TOKEN_RECEIPT_CLAIM", "LATEST_STABLE_ADMISSION_FENCE",
            "ONE_TIME_TOKEN_CONSUMPTION", "ANONYMOUS_RESPONSE_WITH_PER_RESPONSE_DEK",
            "ENCRYPTED_TYPED_ANSWER_VALUES", "TOKEN_CONSUMPTION_BIND_RESPONSE",
            "PROTECTED_TOKEN_RECEIPT_CLOSE",
        ]
        actual_roles = [row.get("role") for row in submit.get("orderedDml", [])]
        actual_steps = [row.get("step") for row in submit.get("orderedDml", [])]
        private_delivery = submit.get("transactionEnvelope", {}).get("privateDelivery")
        outbox_steps = [
            row for row in submit.get("orderedDml", [])
            if "outbox" in str(row.get("table", "")).lower()
            or "OUTBOX" in str(row.get("role", "")).upper()
        ]
        public_events = submit.get("events", [])
        anonymous = submit.get("anonymousBoundary", {})
        boundary_errors: list[str] = []
        if missing_body: boundary_errors.append("MISSING_CLOSED_BODY_FIELDS")
        if extra_body: boundary_errors.append("UNAUTHORIZED_EXTRA_BODY_FIELDS")
        if missing_path or extra_path: boundary_errors.append("ROUTE_SURVEY_IDENTITY_DRIFT")
        if not credential_resolution: boundary_errors.append("SIGNED_CREDENTIAL_NESTED_RESOLUTION_INCOMPLETE")
        if not route_resolution: boundary_errors.append("ROUTE_TO_SIGNED_CLAIM_TO_LOCKED_ADMISSION_EQUALITY_INCOMPLETE")
        if required_tables - dml_tables: boundary_errors.append("ATOMIC_TABLE_SET_INCOMPLETE")
        if missing_response_fields: boundary_errors.append("RESPONSE_SNAPSHOT_ASSIGNMENTS_INCOMPLETE")
        if missing_token_fields: boundary_errors.append("TOKEN_CREDENTIAL_PROOF_ASSIGNMENTS_INCOMPLETE")
        if actual_roles != expected_roles or actual_steps != list(range(1, 8)):
            boundary_errors.append("SEVEN_STEP_PRIVATE_TRANSACTION_ORDER_DRIFT")
        if private_delivery != "OWNER_LOCAL_RESPONSE_ONLY_BROKER_AND_PUBLIC_OUTBOX_FORBIDDEN":
            boundary_errors.append("PRIVATE_NO_BROKER_DELIVERY_FENCE_MISSING")
        if outbox_steps or public_events:
            boundary_errors.append("FORBIDDEN_PUBLIC_OUTBOX_OR_EVENT_PRESENT")
        if (
            anonymous.get("principalContextForbidden") is not True
            or anonymous.get("issuerCallbackFromProtectedEndpoint") != "FORBIDDEN"
            or anonymous.get("crossStreamCorrelationForbidden") is not True
        ):
            boundary_errors.append("ANONYMOUS_OWNER_BOUNDARY_INCOMPLETE")
        if boundary_errors:
            findings.append(make_finding(
                "LISTENING_PROTECTED_SUBMIT_ATOMIC_CONTRACT_INCOMPLETE",
                operation_id=submit["operationId"], table="sys_hris_listening_responses",
                field=sorted(
                    set(missing_body) | set(extra_body) | set(missing_path) | set(extra_path)
                    | set(missing_response_fields) | set(missing_token_fields)
                    | (required_tables - dml_tables) | set(boundary_errors)
                ),
                evidence={
                    "authoritySource": str(LISTENING_AUTHORITY_PATH),
                    "authorityInvariant": (
                        "CLOSED_SIGNED_CREDENTIAL_ROUTE_ADMISSION_FORM_CONSENT_BINDING_PLUS_"
                        "SEVEN_STEP_PRIVATE_NO_BROKER_RECEIPT_TRANSACTION"
                    ),
                    "currentBodyFields": sorted(body), "missingProtectedBodyFields": missing_body,
                    "extraProtectedBodyFields": extra_body,
                    "currentPathFields": sorted(x for x in path_fields if x),
                    "missingPathFields": missing_path, "extraPathFields": extra_path,
                    "credentialNestedResolution": credential_diagnostics,
                    "routeNestedResolution": route_diagnostics,
                    "currentSelectorTables": sorted(x for x in selector_tables if x),
                    "missingAdmissionLockSelector": not credential_resolution,
                    "currentDomainDmlTables": sorted(x for x in dml_tables if x),
                    "missingAtomicDmlTables": sorted(required_tables - dml_tables),
                    "missingResponseAssignments": missing_response_fields,
                    "missingTokenProofAssignments": missing_token_fields,
                    "expectedOrderedRoles": expected_roles, "actualOrderedRoles": actual_roles,
                    "actualStepNumbers": actual_steps,
                    "privateDelivery": private_delivery,
                    "forbiddenOutboxSteps": outbox_steps,
                    "forbiddenPublicEvents": public_events,
                    "boundaryErrors": boundary_errors,
                    "receiptAndOutboxTablesCurrentlyUsed": [row.get("table") for row in submit.get("orderedDml", []) if row.get("role") in {"COMMAND_RECEIPT", "TRANSACTIONAL_OUTBOX"}],
                },
                expected_correction_class=(
                    "RESTORE_CLOSED_SIGNED_CREDENTIAL_ROUTE_ADMISSION_FORM_CONSENT_BINDING_"
                    "AND_SEVEN_STEP_OWNER_LOCAL_PRIVATE_RECEIPT_TRANSACTION_NO_BROKER_OUTBOX"
                ),
                false_positive_guard=(
                    "The detector validates the closed request, typed nested credential claims, route-to-claim-to-lock equality, exact seven ordered roles, durable credential/token proof, and private no-broker fence. Adding a public outbox is itself a finding."
                ),
            ))

    create = ops.get("modern.listening.survey.create")
    revise = ops.get("modern.listening.survey.revise")
    if create and revise:
        create_body = request_body_names(create)
        revise_body = request_body_names(revise)
        version_produced = any(
            row.get("table") == "sys_hris_listening_survey_versions" and row.get("action") in WRITE_ACTIONS
            for op in (create, revise) for row in op.get("orderedDml", [])
        )
        typed_form_fields = {"formVersionRef", "privacyVersionRef", "retentionVersionRef", "questions", "contentSha256"}
        if not (create_body & typed_form_fields) or not (revise_body & typed_form_fields) or not version_produced:
            findings.append(make_finding(
                "LISTENING_SURVEY_FORM_CONTENT_AUTHORITY_MISSING",
                operation_id="modern.listening.survey.create", table="sys_hris_listening_survey_versions",
                field=sorted(typed_form_fields),
                evidence={
                    "authoritySource": str(LISTENING_AUTHORITY_PATH),
                    "authoritySnapshot": "surveyPublicId+formRevision+privacyRevision+retentionRevision+contentSha256 immutable snapshot",
                    "createBodyFields": sorted(create_body), "reviseBodyFields": sorted(revise_body),
                    "createWrites": [{"action": r.get("action"), "table": r.get("table"), "assignments": sorted((r.get("assignments") or {}).keys())} for r in create.get("orderedDml", []) if r.get("action") in WRITE_ACTIONS | {"UPDATE_CAS"}],
                    "reviseWrites": [{"action": r.get("action"), "table": r.get("table"), "assignments": sorted((r.get("assignments") or {}).keys())} for r in revise.get("orderedDml", []) if r.get("action") in WRITE_ACTIONS | {"UPDATE_CAS"}],
                    "questionOrFormTablesInExactSchema": sorted(spec["tableName"] for spec in exact.get("tableSpecifications", []) if re.search(r"(?:question|form)", spec["tableName"])),
                    "versionProducerExists": version_produced,
                },
                expected_correction_class="ADD_CLOSED_TYPED_FORM_OWNER_REFS_OR_NORMALIZED_QUESTION_VERSION_MODEL_AND_CREATE_DRAFT_VERSION",
                false_positive_guard=(
                    "A content_digest derived from no persisted or owner-refetched content is not content authority. The check accepts either closed owner-version references or normalized typed question/version storage."
                ),
            ))
    return findings


def audit(ssot: dict[str, Any], exact: dict[str, Any]) -> dict[str, Any]:
    findings: list[dict[str, Any]] = []
    raw, parent = exact_write_findings(ssot, exact)
    bodyless, bodyless_classification = bodyless_findings(ssot)
    ref_missing, selector_incomplete, ref_mismatch = selector_findings(ssot)
    persisted = declared_persistence_findings(ssot)
    ghosts = ghost_body_findings(ssot)
    learning_owner_proof = learning_owner_proof_findings(ssot)
    owner_dependencies = owner_dependency_closed_set_findings(ssot, exact)
    lifecycle = lifecycle_findings(ssot, exact)
    events, event_stats = event_refetch_findings(ssot, exact)
    handler_events = handler_refetch_findings(ssot, exact)
    identity = template_identity_findings(ssot, exact)
    specials = special_semantic_findings(ssot)
    listening = listening_authority_findings(ssot, exact)
    categories = {
        "exactWriteGaps": raw,
        "requiredParentFkGaps": parent,
        "bodylessBusinessCommands": bodyless,
        "referenceWithoutSelector": ref_missing,
        "incompleteSelectors": selector_incomplete,
        "referenceSelectorInputEffectMismatch": ref_mismatch,
        "declaredPersistedButUnwritten": persisted,
        "undeclaredGhostBodyUses": ghosts,
        "learningOwnerProofDerivation": learning_owner_proof,
        "ownerDependencyClosure": owner_dependencies,
        "lifecycleContradictions": lifecycle,
        "publicEventRefetch": events,
        "handlerEventRefetch": handler_events,
        "templateIdentityDrift": identity,
        "specialBusinessSemantics": specials,
        "listeningAuthority": listening,
    }
    for rows in categories.values():
        findings.extend(rows)
    findings.sort(key=lambda f: (f["code"], json.dumps(f["subject"], sort_keys=True)))
    by_op: dict[str, list[str]] = collections.defaultdict(list)
    for finding in findings:
        oid = finding["subject"].get("operationId")
        if oid:
            by_op[oid].append(finding["findingId"])
    decisions = []
    for op in sorted(ssot.get("operations", []), key=lambda row: row["operationId"]):
        body = sorted(request_body_names(op))
        decisions.append({
            "operationId": op["operationId"], "capabilityId": op.get("capabilityId"),
            "session": op.get("session"), "mode": op.get("mode"),
            "bodyFields": body, "selectorCount": len(op.get("selectors", [])),
            "domainWrites": [
                {"action": row.get("action"), "table": row.get("table")}
                for row in op.get("orderedDml", []) if row.get("action") in WRITE_ACTIONS | {"UPDATE_CAS"}
            ],
            "eventNames": [event.get("eventName") for event in op.get("events", [])],
            "findingIds": sorted(by_op.get(op["operationId"], [])),
            "decision": "FAIL" if by_op.get(op["operationId"]) else "NO_FINDING_UNDER_THIS_AUDIT",
        })
    return {
        "status": "FAIL" if findings else "PASS",
        "priorAuthorZeroDisposition": "REVOKED" if findings else "INDEPENDENTLY_CONFIRMED",
        "operationCoverage": {
            "expected": EXPECTED_OPERATION_COUNT,
            "actual": len(ssot.get("operations", [])),
            "exactIdsUnique": len({row["operationId"] for row in ssot.get("operations", [])}) == len(ssot.get("operations", [])),
        },
        "categoryCounts": {name: len(rows) for name, rows in categories.items()},
        "uniqueFindingCount": len(findings),
        "affectedOperationCount": len(by_op),
        "bodylessClassification": bodyless_classification,
        "eventRefetchStats": event_stats,
        "categories": categories,
        "findings": findings,
        "operationDecisions": decisions,
    }


def find_by(audit_result: dict[str, Any], code: str, **subject: Any) -> bool:
    for finding in audit_result["findings"]:
        if finding["code"] != code:
            continue
        if all(finding["subject"].get(key) == value for key, value in subject.items()):
            return True
    return False


def find_by_with_defect(
    audit_result: dict[str, Any], code: str, defect: str, **subject: Any,
) -> bool:
    for finding in audit_result["findings"]:
        if finding["code"] != code:
            continue
        if not all(finding["subject"].get(key) == value for key, value in subject.items()):
            continue
        if defect in finding.get("evidence", {}).get("defects", []):
            return True
    return False


def run_selftests(ssot: dict[str, Any], exact: dict[str, Any]) -> dict[str, Any]:
    """Mutation tests prove independent detectors fail on exact counterexamples.

    Every test targets a new or exact mutated subject rather than merely
    asserting an aggregate FAIL status, so it remains meaningful on both a
    failing historical candidate and a repaired successor projection.
    """
    tests: list[dict[str, Any]] = []

    def record(name: str, passed: bool, expected: dict[str, Any], detail: Any = None) -> None:
        tests.append({"name": name, "status": "PASS" if passed else "FAIL", "expected": expected, "detail": detail})

    # 1. Remove a required fact from a currently complete creator row.
    s = copy.deepcopy(ssot)
    op = operation_index(s)["modern.growth.profile.create"]
    row = next(r for r in op["orderedDml"] if r.get("table") == "prf_grw_profiles" and r.get("action") == "INSERT")
    removed = row["assignments"].pop("worker_public_id", None)
    result = audit(s, exact)
    record("remove-required-domain-assignment", removed is not None and find_by(result, "EXACT_NOT_NULL_NO_DEFAULT_WRITE_GAP", operationId="modern.growth.profile.create", table="prf_grw_profiles"), {"code": "EXACT_NOT_NULL_NO_DEFAULT_WRITE_GAP", "fieldContains": "worker_public_id"})

    # 2. Break a currently exact event refetch endpoint.
    s = copy.deepcopy(ssot)
    op = operation_index(s)["modern.opportunity.publish"]
    event = op["events"][0]
    original = event.get("refetchContract", {}).get("endpointOperationId")
    event["refetchContract"]["mode"] = "EXACT_HISTORICAL_VERSION"
    event["refetchContract"]["endpointOperationId"] = "modern.opportunity.application.query"
    result = audit(s, exact)
    record("misroute-event-refetch", original != "modern.opportunity.application.query" and find_by(result, "EVENT_REFETCH_NOT_EXACT_AGGREGATE_REENTRY", operationId="modern.opportunity.publish", eventName=event.get("eventName")), {"code": "EVENT_REFETCH_NOT_EXACT_AGGREGATE_REENTRY", "endpoint": "modern.opportunity.application.query"})

    # 3. Remove an explicit mature owner selector.
    s = copy.deepcopy(ssot)
    op = operation_index(s)["modern.ai.assist.create"]
    op["selectors"] = [x for x in op["selectors"] if x.get("source") != "body.instructionArtifactVersionId"]
    result = audit(s, exact)
    record("remove-reference-selector", find_by(result, "REFERENCE_WITHOUT_EXPLICIT_SELECTOR", operationId="modern.ai.assist.create", field="body.instructionArtifactVersionId"), {"code": "REFERENCE_WITHOUT_EXPLICIT_SELECTOR", "field": "body.instructionArtifactVersionId"})

    # 4. Point a correct reference input effect at an unrelated table.
    s = copy.deepcopy(ssot)
    op = operation_index(s)["modern.ai.assist.cancel"]
    effect = next(x for x in op["inputEffects"] if x.get("source") == "pathParameters.assistanceId")["effects"][0]
    effect["target"] = "sys_hris_ai_use_policies.public_id"
    result = audit(s, exact)
    record("misbind-reference-input-effect", find_by(result, "REFERENCE_SELECTOR_INPUT_EFFECT_TARGET_MISMATCH", operationId="modern.ai.assist.cancel", field="pathParameters.assistanceId"), {"code": "REFERENCE_SELECTOR_INPUT_EFFECT_TARGET_MISMATCH"})

    # 5. Delete declared body fields while their DML still consumes them.
    s = copy.deepcopy(ssot)
    op = operation_index(s)["modern.growth.profile.create"]
    op["requestFields"] = [x for x in op["requestFields"] if x.get("location") != "body"]
    result = audit(s, exact)
    record("remove-business-input-declarations", find_by(result, "UNDECLARED_BODY_SOURCE_USED", operationId="modern.growth.profile.create"), {"code": "UNDECLARED_BODY_SOURCE_USED"})

    # 6. Repair then re-break one lifecycle proof column to prove the check is
    # driven by exact schema nullability rather than only operation name.
    e = copy.deepcopy(exact)
    spec = next(x for x in e["tableSpecifications"] if x["tableName"] == "sys_hris_ai_policy_versions")
    proof = {x["name"]: x for x in spec["columns"] if x["name"] in PROOF_COLUMNS}
    for col in proof.values():
        col["nullable"] = True
    repaired = audit(ssot, e)
    absent_after_repair = not find_by(repaired, "LIFECYCLE_PROOF_REQUIRED_BEFORE_PROOF_EXISTS", operationId="modern.ai.policy.create", table="sys_hris_ai_policy_versions")
    proof["approval_receipt_public_id"]["nullable"] = False
    mutated = audit(ssot, e)
    present_after_mutation = find_by(mutated, "LIFECYCLE_PROOF_REQUIRED_BEFORE_PROOF_EXISTS", operationId="modern.ai.policy.create", table="sys_hris_ai_policy_versions")
    record("lifecycle-proof-nullability-mutation", absent_after_repair and present_after_mutation, {"code": "LIFECYCLE_PROOF_REQUIRED_BEFORE_PROOF_EXISTS", "fieldContains": "approval_receipt_public_id"})

    # 7. Remove one protected Listening atomic write and require the exact
    # missing table to be named.
    s = copy.deepcopy(ssot)
    op = operation_index(s)["modern.listening.response.submit"]
    op["orderedDml"] = [r for r in op["orderedDml"] if r.get("table") != "sys_hris_listening_token_consumptions"]
    result = audit(s, exact)
    f = next((x for x in result["findings"] if x["code"] == "LISTENING_PROTECTED_SUBMIT_ATOMIC_CONTRACT_INCOMPLETE"), None)
    record("remove-protected-token-consumption-write", bool(f and "sys_hris_listening_token_consumptions" in f["evidence"].get("missingAtomicDmlTables", [])), {"code": "LISTENING_PROTECTED_SUBMIT_ATOMIC_CONTRACT_INCOMPLETE", "table": "sys_hris_listening_token_consumptions"})

    # 8. The signed credential is a typed composite reference.  Removing its
    # nested admission selector must not be excused merely because an audience
    # selector remains.
    s = copy.deepcopy(ssot)
    op = operation_index(s)["modern.listening.response.submit"]
    op["selectors"] = [
        row for row in op["selectors"]
        if row.get("source") != "body.signedParticipationCredential.admissionPublicId"
    ]
    result = audit(s, exact)
    record(
        "remove-submit-credential-admission-claim-selector",
        find_by(result, "REFERENCE_WITHOUT_EXPLICIT_SELECTOR",
                operationId="modern.listening.response.submit",
                field="body.signedParticipationCredential"),
        {"code": "REFERENCE_WITHOUT_EXPLICIT_SELECTOR",
         "field": "body.signedParticipationCredential"},
    )

    # 9. A syntactically complete nested selector aimed at another table must
    # fail the composite credential proof.
    s = copy.deepcopy(ssot)
    op = operation_index(s)["modern.listening.response.submit"]
    selector = next(
        row for row in op["selectors"]
        if row.get("source") == "body.signedParticipationCredential.admissionPublicId"
    )
    selector["targetTable"] = "sys_hris_listening_surveys"
    selector["targetColumn"] = "public_id"
    result = audit(s, exact)
    record(
        "drift-submit-credential-admission-selector-target",
        find_by(result, "REFERENCE_WITHOUT_EXPLICIT_SELECTOR",
                operationId="modern.listening.response.submit",
                field="body.signedParticipationCredential"),
        {"code": "REFERENCE_WITHOUT_EXPLICIT_SELECTOR",
         "field": "body.signedParticipationCredential"},
    )

    # 10. The protected audience verifier is a separate mandatory proof leg.
    s = copy.deepcopy(ssot)
    op = operation_index(s)["modern.listening.response.submit"]
    op["selectors"] = [
        row for row in op["selectors"]
        if row.get("source") != "body.signedParticipationCredential.aud"
    ]
    result = audit(s, exact)
    record(
        "remove-submit-protected-audience-selector",
        find_by(result, "REFERENCE_WITHOUT_EXPLICIT_SELECTOR",
                operationId="modern.listening.response.submit",
                field="body.signedParticipationCredential"),
        {"code": "REFERENCE_WITHOUT_EXPLICIT_SELECTOR",
         "field": "body.signedParticipationCredential"},
    )

    # 11. Route identity must be bound to the signed survey claim and the same
    # locked admission; a generic route reference is insufficient.
    s = copy.deepcopy(ssot)
    op = operation_index(s)["modern.listening.response.submit"]
    effect = next(
        row for row in op["inputEffects"]
        if row.get("source") == "pathParameters.surveyId"
    )["effects"][0]
    effect["target"] = "LOCKED_ADMISSION.admission_public_id"
    result = audit(s, exact)
    record(
        "drift-submit-route-signed-claim-equality-target",
        find_by(result, "REFERENCE_WITHOUT_EXPLICIT_SELECTOR",
                operationId="modern.listening.response.submit",
                field="pathParameters.surveyId"),
        {"code": "REFERENCE_WITHOUT_EXPLICIT_SELECTOR",
         "field": "pathParameters.surveyId"},
    )

    # 12. Removing the form artifact digest from the closed credential schema
    # must invalidate the whole admission/form proof, not just schema lint.
    s = copy.deepcopy(ssot)
    op = operation_index(s)["modern.listening.response.submit"]
    credential = next(
        row for row in op["requestFields"]
        if row.get("source") == "body.signedParticipationCredential"
    )
    credential["valueSchema"]["fields"] = [
        row for row in credential["valueSchema"]["fields"]
        if row.get("name") != "formArtifactDigest"
    ]
    result = audit(s, exact)
    record(
        "remove-submit-credential-form-artifact-claim",
        find_by(result, "REFERENCE_WITHOUT_EXPLICIT_SELECTOR",
                operationId="modern.listening.response.submit",
                field="body.signedParticipationCredential"),
        {"code": "REFERENCE_WITHOUT_EXPLICIT_SELECTOR",
         "field": "body.signedParticipationCredential"},
    )

    # 13. The response endpoint is explicitly private-no-broker.  Adding an
    # outbox is a regression rather than a missing implementation step.
    s = copy.deepcopy(ssot)
    op = operation_index(s)["modern.listening.response.submit"]
    op["orderedDml"].append({
        "step": 8, "phase": "IN_TRANSACTION", "action": "APPEND",
        "table": "sys_hris_listening_protected_outbox", "role": "TRANSACTIONAL_OUTBOX",
        "assignments": {},
    })
    result = audit(s, exact)
    f = next((x for x in result["findings"] if x["code"] == "LISTENING_PROTECTED_SUBMIT_ATOMIC_CONTRACT_INCOMPLETE"), None)
    record(
        "reject-submit-public-or-broker-outbox",
        bool(f and "FORBIDDEN_PUBLIC_OUTBOX_OR_EVENT_PRESENT" in f["evidence"].get("boundaryErrors", [])),
        {"code": "LISTENING_PROTECTED_SUBMIT_ATOMIC_CONTRACT_INCOMPLETE",
         "boundaryError": "FORBIDDEN_PUBLIC_OUTBOX_OR_EVENT_PRESENT"},
    )

    # 14. Removing the explicit delivery fence is independently observable.
    s = copy.deepcopy(ssot)
    op = operation_index(s)["modern.listening.response.submit"]
    op["transactionEnvelope"].pop("privateDelivery", None)
    result = audit(s, exact)
    f = next((x for x in result["findings"] if x["code"] == "LISTENING_PROTECTED_SUBMIT_ATOMIC_CONTRACT_INCOMPLETE"), None)
    record(
        "remove-submit-private-no-broker-fence",
        bool(f and "PRIVATE_NO_BROKER_DELIVERY_FENCE_MISSING" in f["evidence"].get("boundaryErrors", [])),
        {"code": "LISTENING_PROTECTED_SUBMIT_ATOMIC_CONTRACT_INCOMPLETE",
         "boundaryError": "PRIVATE_NO_BROKER_DELIVERY_FENCE_MISSING"},
    )

    # 15. The active-form query uses the same nested credential proof.  Its
    # admission leg cannot be silently replaced by the audience verifier.
    s = copy.deepcopy(ssot)
    op = operation_index(s)["modern.listening.active.query"]
    op["selectors"] = [
        row for row in op["selectors"]
        if row.get("source")
        != "headers.X-Listening-Participation-Credential.admissionPublicId"
    ]
    result = audit(s, exact)
    record(
        "remove-active-query-credential-admission-selector",
        find_by(result, "REFERENCE_WITHOUT_EXPLICIT_SELECTOR",
                operationId="modern.listening.active.query",
                field="headers.X-Listening-Participation-Credential"),
        {"code": "REFERENCE_WITHOUT_EXPLICIT_SELECTOR",
         "field": "headers.X-Listening-Participation-Credential"},
    )

    # 16. Target drift on the active-query audience leg must also invalidate
    # the composite credential proof.
    s = copy.deepcopy(ssot)
    op = operation_index(s)["modern.listening.active.query"]
    selector = next(
        row for row in op["selectors"]
        if row.get("source") == "headers.X-Listening-Participation-Credential.aud"
    )
    selector["targetTable"] = "sys_hris_listening_admission_versions"
    result = audit(s, exact)
    record(
        "drift-active-query-protected-audience-target",
        find_by(result, "REFERENCE_WITHOUT_EXPLICIT_SELECTOR",
                operationId="modern.listening.active.query",
                field="headers.X-Listening-Participation-Credential"),
        {"code": "REFERENCE_WITHOUT_EXPLICIT_SELECTOR",
         "field": "headers.X-Listening-Participation-Credential"},
    )

    def valid_wfp_forbidden_refetch() -> dict[str, Any]:
        return {
            "mode": "FORBIDDEN",
            "reason": (
                "PAYLOAD_SUFFICIENT_MINIMUM_PRIVILEGE_NO_DEDICATED_"
                "SIMULATION_REQUEST_DETAIL_QUERY"
            ),
            "payloadSufficiency": WFP_RESULT_OWNER_PAYLOAD_SUFFICIENCY,
            "aggregateLookup": "FORBIDDEN", "latestFallback": "FORBIDDEN",
            "resultOwnerContract": {
                "requiredFields": list(WFP_RESULT_OWNER_REQUIRED_FIELDS),
                "identity": WFP_RESULT_OWNER_IDENTITY,
                "validation": WFP_RESULT_OWNER_VALIDATION,
                "denyOnUnavailable": True,
            },
        }

    # 17. A FORBIDDEN Workforce Planning refetch must not retain a disguised
    # endpoint/latest lookup hint.
    s = copy.deepcopy(ssot)
    handler = next(
        row for row in s["systemHandlers"]
        if row.get("handlerId") == "internal.workforceplan.simulation-result.consume"
    )
    handler["event"]["refetchContract"] = valid_wfp_forbidden_refetch()
    handler["event"]["refetchContract"]["endpointOperationId"] = (
        "modern.workforceplan.scenario.query"
    )
    result = audit(s, exact)
    record(
        "reject-forbidden-wfp-refetch-endpoint-hint",
        find_by(result, "HANDLER_FORBIDDEN_REFETCH_PAYLOAD_CONTRACT_INCOMPLETE",
                handlerId="internal.workforceplan.simulation-result.consume",
                eventName="WorkforceScenarioSimulated.v2"),
        {"code": "HANDLER_FORBIDDEN_REFETCH_PAYLOAD_CONTRACT_INCOMPLETE",
         "eventName": "WorkforceScenarioSimulated.v2"},
    )

    # 18. Payload sufficiency depends on the complete signed result owner tuple.
    s = copy.deepcopy(ssot)
    handler = next(
        row for row in s["systemHandlers"]
        if row.get("handlerId") == "internal.workforceplan.simulation-result.consume"
    )
    handler["additionalEvents"][0]["refetchContract"] = valid_wfp_forbidden_refetch()
    handler["additionalEvents"][0]["refetchContract"]["resultOwnerContract"][
        "requiredFields"
    ].remove("resultDigest")
    result = audit(s, exact)
    record(
        "remove-wfp-forbidden-refetch-result-proof-member",
        find_by(result, "HANDLER_FORBIDDEN_REFETCH_PAYLOAD_CONTRACT_INCOMPLETE",
                handlerId="internal.workforceplan.simulation-result.consume",
                eventName="WorkforceScenarioSimulationFailed.v2"),
        {"code": "HANDLER_FORBIDDEN_REFETCH_PAYLOAD_CONTRACT_INCOMPLETE",
         "eventName": "WorkforceScenarioSimulationFailed.v2"},
    )

    def set_valid_learning_owner_derivation(value: dict[str, Any]) -> dict[str, Any]:
        learning = operation_index(value)["modern.learning.completion.verify"]
        child = next(
            row for row in learning["orderedDml"]
            if row.get("table") == "prf_lrn_completion_skill_evidence_refs"
        )
        child["action"] = "APPEND_MANY"
        child["role"] = "TYPED_ORDERED_CHILD_REFERENCE"
        child["assignments"]["skill_evidence_public_id"] = (
            LEARNING_SKILL_EVIDENCE_OWNER_SOURCE
        )
        child["assignments"]["worker_skill_evidence_id"] = (
            LEARNING_WORKER_SKILL_EVIDENCE_SELECTOR
        )
        return child

    # 19. An ownerProof prefix is not authority to select an unreviewed sibling
    # member.  Reproduce the escaped rename while keeping the step otherwise valid.
    s = copy.deepcopy(ssot)
    child = set_valid_learning_owner_derivation(s)
    child_text = json.dumps(child, ensure_ascii=False)
    replacement = "ownerProof.body.evidencePublicId.unreviewedSkillEvidenceIds[*]"
    replacement_child = json.loads(child_text.replace(
        LEARNING_SKILL_EVIDENCE_OWNER_SOURCE, replacement
    ))
    learning = operation_index(s)["modern.learning.completion.verify"]
    learning["orderedDml"] = [
        replacement_child
        if row.get("table") == "prf_lrn_completion_skill_evidence_refs"
        else row
        for row in learning["orderedDml"]
    ]
    result = audit(s, exact)
    record(
        "reject-learning-owner-proof-member-rename",
        find_by_with_defect(
            result, "LEARNING_OWNER_PROOF_DERIVATION_DRIFT",
            "UNREVIEWED_OWNER_PROOF_MEMBER_PRESENT",
            operationId="modern.learning.completion.verify",
            table="prf_lrn_completion_skill_evidence_refs",
        ),
        {"code": "LEARNING_OWNER_PROOF_DERIVATION_DRIFT",
         "source": replacement},
    )

    # 20. Keeping the reviewed assignments does not authorize an additional
    # sibling owner-proof member in the same typed child write.
    s = copy.deepcopy(ssot)
    child = set_valid_learning_owner_derivation(s)
    child["assignments"]["unreviewed_skill_evidence_public_id"] = (
        "ownerProof.body.evidencePublicId.unreviewedSkillEvidenceIds[*]"
    )
    result = audit(s, exact)
    record(
        "reject-learning-owner-proof-sibling-member",
        find_by_with_defect(
            result, "LEARNING_OWNER_PROOF_DERIVATION_DRIFT",
            "UNREVIEWED_OWNER_PROOF_MEMBER_PRESENT",
            operationId="modern.learning.completion.verify",
            table="prf_lrn_completion_skill_evidence_refs",
        ),
        {"code": "LEARNING_OWNER_PROOF_DERIVATION_DRIFT",
         "defect": "UNREVIEWED_OWNER_PROOF_MEMBER_PRESENT"},
    )

    # 21. The successful terminal event may not replace cryptographic owner
    # validation with an explicit trust-unverified policy.
    s = copy.deepcopy(ssot)
    handler = next(
        row for row in s["systemHandlers"]
        if row.get("handlerId") == "internal.workforceplan.simulation-result.consume"
    )
    handler["event"]["refetchContract"] = valid_wfp_forbidden_refetch()
    handler["event"]["refetchContract"]["resultOwnerContract"][
        "validation"
    ] = "TRUST_UNVERIFIED_RESULT"
    result = audit(s, exact)
    record(
        "reject-wfp-success-unverified-result-trust",
        find_by_with_defect(
            result, "HANDLER_FORBIDDEN_REFETCH_PAYLOAD_CONTRACT_INCOMPLETE",
            "RESULT_OWNER_SIGNED_VALIDATION_DRIFT",
            handlerId="internal.workforceplan.simulation-result.consume",
            eventName="WorkforceScenarioSimulated.v2",
        ),
        {"code": "HANDLER_FORBIDDEN_REFETCH_PAYLOAD_CONTRACT_INCOMPLETE",
         "defect": "RESULT_OWNER_SIGNED_VALIDATION_DRIFT"},
    )

    # 22. The failure terminal event is governed by the identical closed result
    # owner tuple and rejects every alternate validation literal.
    s = copy.deepcopy(ssot)
    handler = next(
        row for row in s["systemHandlers"]
        if row.get("handlerId") == "internal.workforceplan.simulation-result.consume"
    )
    handler["additionalEvents"][0]["refetchContract"] = valid_wfp_forbidden_refetch()
    handler["additionalEvents"][0]["refetchContract"]["resultOwnerContract"][
        "validation"
    ] = "SIGNED_OWNER_RESULT_MATCHES_LATEST_RESULT"
    result = audit(s, exact)
    record(
        "reject-wfp-failure-result-validation-drift",
        find_by_with_defect(
            result, "HANDLER_FORBIDDEN_REFETCH_PAYLOAD_CONTRACT_INCOMPLETE",
            "RESULT_OWNER_SIGNED_VALIDATION_DRIFT",
            handlerId="internal.workforceplan.simulation-result.consume",
            eventName="WorkforceScenarioSimulationFailed.v2",
        ),
        {"code": "HANDLER_FORBIDDEN_REFETCH_PAYLOAD_CONTRACT_INCOMPLETE",
         "defect": "RESULT_OWNER_SIGNED_VALIDATION_DRIFT"},
    )

    # 23. A prose string that merely begins with the approved token is not the
    # reviewed payload-sufficiency contract for the successful terminal event.
    s = copy.deepcopy(ssot)
    handler = next(
        row for row in s["systemHandlers"]
        if row.get("handlerId") == "internal.workforceplan.simulation-result.consume"
    )
    handler["event"]["refetchContract"] = valid_wfp_forbidden_refetch()
    handler["event"]["refetchContract"]["payloadSufficiency"] = (
        "CLOSED_DURABLE_EVENT_ALLOWLIST_BUT_UNSIGNED_AND_LATEST_ALLOWED"
    )
    result = audit(s, exact)
    record(
        "reject-wfp-success-payload-sufficiency-prefix-bypass",
        find_by_with_defect(
            result, "HANDLER_FORBIDDEN_REFETCH_PAYLOAD_CONTRACT_INCOMPLETE",
            "PAYLOAD_SUFFICIENCY_NOT_CLOSED",
            handlerId="internal.workforceplan.simulation-result.consume",
            eventName="WorkforceScenarioSimulated.v2",
        ),
        {"code": "HANDLER_FORBIDDEN_REFETCH_PAYLOAD_CONTRACT_INCOMPLETE",
         "defect": "PAYLOAD_SUFFICIENCY_NOT_CLOSED"},
    )

    # 24. The failure event has the identical closed payload authority and may
    # not accept the same prefix-based suffix bypass.
    s = copy.deepcopy(ssot)
    handler = next(
        row for row in s["systemHandlers"]
        if row.get("handlerId") == "internal.workforceplan.simulation-result.consume"
    )
    handler["additionalEvents"][0]["refetchContract"] = valid_wfp_forbidden_refetch()
    handler["additionalEvents"][0]["refetchContract"]["payloadSufficiency"] = (
        "CLOSED_DURABLE_EVENT_ALLOWLIST_BUT_UNSIGNED_AND_LATEST_ALLOWED"
    )
    result = audit(s, exact)
    record(
        "reject-wfp-failure-payload-sufficiency-prefix-bypass",
        find_by_with_defect(
            result, "HANDLER_FORBIDDEN_REFETCH_PAYLOAD_CONTRACT_INCOMPLETE",
            "PAYLOAD_SUFFICIENCY_NOT_CLOSED",
            handlerId="internal.workforceplan.simulation-result.consume",
            eventName="WorkforceScenarioSimulationFailed.v2",
        ),
        {"code": "HANDLER_FORBIDDEN_REFETCH_PAYLOAD_CONTRACT_INCOMPLETE",
         "defect": "PAYLOAD_SUFFICIENCY_NOT_CLOSED"},
    )

    def payroll_dependency(value: dict[str, Any]) -> dict[str, Any]:
        return next(
            row for row in value.get("ownerDependencyContracts", [])
            if row.get("dependencyContractId") == PAYROLL_DEPENDENCY_ID
        )

    def payroll_event(value: dict[str, Any]) -> dict[str, Any]:
        return next(
            event for event in operation_index(value)[
                "modern.compplan.snapshot.publish"
            ].get("events", [])
            if event.get("eventName") == PAYROLL_EVENT_NAME
        )

    # 25. The dependency is a read model, never a second command/outbox path.
    s = copy.deepcopy(ssot)
    payroll_dependency(s)["writes"] = "ALLOWED"
    result = audit(s, exact)
    record(
        "reject-payroll-dependency-write",
        find_by_with_defect(
            result, "EVENT_OWNER_DEPENDENCY_REFETCH_INCOMPLETE",
            "DEPENDENCY_NOT_STRICTLY_READ_ONLY",
            operationId="modern.compplan.snapshot.publish",
            eventName=PAYROLL_EVENT_NAME,
        ),
        {"code": "EVENT_OWNER_DEPENDENCY_REFETCH_INCOMPLETE",
         "defect": "DEPENDENCY_NOT_STRICTLY_READ_ONLY"},
    )

    # 26. The event must pin the exact dependency bytes, not only its name.
    s = copy.deepcopy(ssot)
    payroll_event(s)["refetchContract"]["dependencyContractSha256"] = "0" * 64
    result = audit(s, exact)
    record(
        "reject-payroll-dependency-pin-drift",
        find_by_with_defect(
            result, "EVENT_OWNER_DEPENDENCY_REFETCH_INCOMPLETE",
            "EVENT_DEPENDENCY_PIN_MISMATCH",
            operationId="modern.compplan.snapshot.publish",
            eventName=PAYROLL_EVENT_NAME,
        ),
        {"code": "EVENT_OWNER_DEPENDENCY_REFETCH_INCOMPLETE",
         "defect": "EVENT_DEPENDENCY_PIN_MISMATCH"},
    )

    # 27. A latest revision fallback can silently change a payroll freeze.
    s = copy.deepcopy(ssot)
    payroll_dependency(s)["latestFallback"] = "ALLOWED"
    result = audit(s, exact)
    record(
        "reject-payroll-latest-fallback",
        find_by_with_defect(
            result, "EVENT_OWNER_DEPENDENCY_REFETCH_INCOMPLETE",
            "DEPENDENCY_LATEST_OR_OFFSET_FALLBACK",
            operationId="modern.compplan.snapshot.publish",
            eventName=PAYROLL_EVENT_NAME,
        ),
        {"code": "EVENT_OWNER_DEPENDENCY_REFETCH_INCOMPLETE",
         "defect": "DEPENDENCY_LATEST_OR_OFFSET_FALLBACK"},
    )

    # 28. Sensitive/high-cardinality lines stay behind the PAY-only owner PEP.
    s = copy.deepcopy(ssot)
    payroll_event(s)["fields"].append({
        "name": "lines", "type": "ARRAY", "required": True,
        "sourceKind": "PHYSICAL_POST_STATE",
        "source": "prf_cmp_approved_snapshot_lines.*",
    })
    result = audit(s, exact)
    record(
        "reject-payroll-lines-in-event",
        find_by_with_defect(
            result, "EVENT_OWNER_DEPENDENCY_REFETCH_INCOMPLETE",
            "EVENT_LEAKS_PAYROLL_LINES",
            operationId="modern.compplan.snapshot.publish",
            eventName=PAYROLL_EVENT_NAME,
        ),
        {"code": "EVENT_OWNER_DEPENDENCY_REFETCH_INCOMPLETE",
         "defect": "EVENT_LEAKS_PAYROLL_LINES"},
    )

    # 29-51. Every exact PAY owner-dependency/refetch boundary dimension that
    # previously admitted a near-miss gets its own independently observable
    # counterexample.  These are intentionally one-field mutations so a PASS
    # proves the named predicate, not merely another correlated failure.
    hostile_payroll_cases = [
        (
            "reject-payroll-refetch-mode-drift",
            lambda value: payroll_event(value)["refetchContract"].__setitem__(
                "mode", "EXACT_OPERATION"
            ),
            "EVENT_DEPENDENCY_PIN_MISMATCH",
        ),
        (
            "reject-payroll-refetch-owner-drift",
            lambda value: payroll_event(value)["refetchContract"].__setitem__(
                "ownerSession", "HRIS-SYS"
            ),
            "EVENT_DEPENDENCY_PIN_MISMATCH",
        ),
        (
            "reject-payroll-refetch-payload-sufficiency-drift",
            lambda value: payroll_event(value)["refetchContract"].__setitem__(
                "payloadSufficiency", "OPEN_EVENT_PAYLOAD"
            ),
            "EVENT_PAY_CONSUMER_OR_PURPOSE_MISSING",
        ),
        (
            "reject-payroll-refetch-response-drift",
            lambda value: payroll_event(value)["refetchContract"].__setitem__(
                "response", "UNBOUNDED_LINES"
            ),
            "EVENT_PAY_CONSUMER_OR_PURPOSE_MISSING",
        ),
        (
            "reject-payroll-refetch-version-drift",
            lambda value: payroll_event(value)["refetchContract"].__setitem__(
                "version", "latest available revision"
            ),
            "EVENT_PAY_CONSUMER_OR_PURPOSE_MISSING",
        ),
        (
            "reject-payroll-refetch-digest-drift",
            lambda value: payroll_event(value)["refetchContract"].__setitem__(
                "digest", "unchecked"
            ),
            "EVENT_PAY_CONSUMER_OR_PURPOSE_MISSING",
        ),
        (
            "reject-payroll-refetch-pep-tenant-drift",
            lambda value: payroll_event(value)["refetchContract"]["pep"].__setitem__(
                "tenant", "caller supplied tenant"
            ),
            "EVENT_PAY_CONSUMER_OR_PURPOSE_MISSING",
        ),
        (
            "reject-payroll-refetch-pep-purpose-drift",
            lambda value: payroll_event(value)["refetchContract"]["pep"].__setitem__(
                "purpose", ["ANY"]
            ),
            "EVENT_PAY_CONSUMER_OR_PURPOSE_MISSING",
        ),
        (
            "reject-payroll-refetch-pep-population-drift",
            lambda value: payroll_event(value)["refetchContract"]["pep"].__setitem__(
                "population", "ALL_WORKERS"
            ),
            "EVENT_PAY_CONSUMER_OR_PURPOSE_MISSING",
        ),
        (
            "reject-payroll-refetch-pep-field-drift",
            lambda value: payroll_event(value)["refetchContract"]["pep"].__setitem__(
                "fieldExposure", ["snapshotId"]
            ),
            "EVENT_PAY_CONSUMER_OR_PURPOSE_MISSING",
        ),
        (
            "reject-payroll-refetch-pep-reauthorize-drift",
            lambda value: payroll_event(value)["refetchContract"]["pep"].__setitem__(
                "reauthorizeEveryCall", False
            ),
            "EVENT_PAY_CONSUMER_OR_PURPOSE_MISSING",
        ),
        (
            "reject-payroll-refetch-pep-deny-drift",
            lambda value: payroll_event(value)["refetchContract"]["pep"].__setitem__(
                "denyOnUnavailable", False
            ),
            "EVENT_PAY_CONSUMER_OR_PURPOSE_MISSING",
        ),
        (
            "reject-payroll-event-audience-field-drift",
            lambda value: payroll_event(value)["audience"]["fieldExposure"][
                "fields"
            ].append("lines"),
            "EVENT_AUDIENCE_EXPOSURE_OPEN_OR_DRIFTED",
        ),
        (
            "reject-payroll-event-snapshot-id-removal",
            lambda value: payroll_event(value).__setitem__(
                "fields", [
                    row for row in payroll_event(value)["fields"]
                    if row.get("name") != "snapshotId"
                ]
            ),
            "EVENT_HEADER_NOT_EXACT_MINIMUM",
        ),
        (
            "reject-payroll-event-digest-type-drift",
            lambda value: next(
                row for row in payroll_event(value)["fields"]
                if row.get("name") == "payloadDigest"
            ).__setitem__("type", "STRING"),
            "EVENT_HEADER_NOT_EXACT_MINIMUM",
        ),
        (
            "reject-payroll-stream-max-header-drift",
            lambda value: payroll_dependency(value)["streamingValidation"].__setitem__(
                "maxHeaderBytes", 65537
            ),
            "DEPENDENCY_COUNT_SEQUENCE_DIGEST_INCOMPLETE",
        ),
        (
            "reject-payroll-stream-max-line-drift",
            lambda value: payroll_dependency(value)["streamingValidation"].__setitem__(
                "maxLineBytes", 4097
            ),
            "DEPENDENCY_COUNT_SEQUENCE_DIGEST_INCOMPLETE",
        ),
        (
            "reject-payroll-stream-byte-accounting-drift",
            lambda value: payroll_dependency(value)["streamingValidation"].__setitem__(
                "byteAccounting", "AFTER_ALLOCATION"
            ),
            "DEPENDENCY_COUNT_SEQUENCE_DIGEST_INCOMPLETE",
        ),
        (
            "reject-payroll-stream-backpressure-drift",
            lambda value: payroll_dependency(value)["transport"].__setitem__(
                "backpressure", "BUFFER_ALL"
            ),
            "DEPENDENCY_STREAM_BOUNDS_INCOMPLETE",
        ),
        (
            "reject-payroll-line-order-drift",
            lambda value: payroll_dependency(value)["responseSchema"]["lines"].__setitem__(
                "ordering", "lineSequence DESC"
            ),
            "DEPENDENCY_STREAM_BOUNDS_INCOMPLETE",
        ),
        (
            "reject-payroll-envelope-tenant-source-drift",
            lambda value: payroll_event(value)["refetchContract"][
                "selectorTuple"
            ].__setitem__(0, "event.tenantId"),
            "EVENT_PAY_CONSUMER_OR_PURPOSE_MISSING",
        ),
        (
            "reject-payroll-three-way-tenant-binding-drift",
            lambda value: payroll_event(value)["refetchContract"][
                "tenantBinding"
            ].__setitem__("ownerRowTenant", "caller.tenantId"),
            "EVENT_PAY_CONSUMER_OR_PURPOSE_MISSING",
        ),
        (
            "reject-payroll-consumer-field-expansion",
            lambda value: payroll_event(value)["audience"][
                "consumerFieldExposure"
            ]["HRIS-PAY"]["fields"].append("approvalInputDigest"),
            "EVENT_AUDIENCE_EXPOSURE_OPEN_OR_DRIFTED",
        ),
    ]
    for name, mutate, defect in hostile_payroll_cases:
        s = copy.deepcopy(ssot)
        mutate(s)
        result = audit(s, exact)
        record(
            name,
            find_by_with_defect(
                result, "EVENT_OWNER_DEPENDENCY_REFETCH_INCOMPLETE", defect,
                operationId="modern.compplan.snapshot.publish",
                eventName=PAYROLL_EVENT_NAME,
            ),
            {
                "code": "EVENT_OWNER_DEPENDENCY_REFETCH_INCOMPLETE",
                "defect": defect,
            },
        )

    # 52-78. Freeze the global dependency set and the previously implicit PAY
    # response/request semantics.  Dependency mutations are deliberately
    # self-resealed and their event pin refreshed: an independent audit must
    # reject an internally consistent but unreviewed successor, not only a
    # stale seal.
    s = copy.deepcopy(ssot)
    e = copy.deepcopy(exact)
    third = copy.deepcopy(s["ownerDependencyContracts"][0])
    third["dependencyContractId"] = "hostile.unreviewedOwnerDependency.v1"
    third["sealedPayloadSha256"] = canonical_hash({
        key: value for key, value in third.items()
        if key != "sealedPayloadSha256"
    })
    s["ownerDependencyContracts"].append(third)
    e["ownerDependencyContracts"] = copy.deepcopy(s["ownerDependencyContracts"])
    result = audit(s, e)
    record(
        "reject-third-global-owner-dependency",
        find_by(result, "OWNER_DEPENDENCY_CLOSED_SET_INCOMPLETE",
                field="ownerDependencyContracts"),
        {"code": "OWNER_DEPENDENCY_CLOSED_SET_INCOMPLETE",
         "defect": "GLOBAL_DEPENDENCY_IDS_OR_ORDER_NOT_EXACT_TWO"},
    )

    s = copy.deepcopy(ssot)
    e = copy.deepcopy(exact)
    s["ownerDependencyContracts"] = [
        row for row in s["ownerDependencyContracts"]
        if row.get("dependencyContractId") != LISTENING_DEPENDENCY_ID
    ]
    e["ownerDependencyContracts"] = copy.deepcopy(s["ownerDependencyContracts"])
    result = audit(s, e)
    record(
        "reject-missing-listening-owner-dependency",
        find_by(result, "OWNER_DEPENDENCY_CLOSED_SET_INCOMPLETE",
                field="ownerDependencyContracts"),
        {"code": "OWNER_DEPENDENCY_CLOSED_SET_INCOMPLETE",
         "defect": "LISTENING_LOCAL_DEPENDENCY_NOT_EXACT_ONE"},
    )

    s = copy.deepcopy(ssot)
    e = copy.deepcopy(exact)
    s["closedSetManifest"]["sealedPayloadSha256"] = "0" * 64
    e["closedSetManifest"] = copy.deepcopy(s["closedSetManifest"])
    result = audit(s, e)
    record(
        "reject-owner-dependency-manifest-pin-drift",
        find_by(result, "OWNER_DEPENDENCY_CLOSED_SET_INCOMPLETE",
                field="ownerDependencyContracts"),
        {"code": "OWNER_DEPENDENCY_CLOSED_SET_INCOMPLETE",
         "defect": "SSOT_EMBEDDED_MANIFEST_PIN_DRIFT"},
    )

    def reseal_payroll(value: dict[str, Any]) -> None:
        dependency = payroll_dependency(value)
        dependency["sealedPayloadSha256"] = canonical_hash({
            key: item for key, item in dependency.items()
            if key != "sealedPayloadSha256"
        })
        payroll_event(value)["refetchContract"]["dependencyContractSha256"] = (
            dependency["sealedPayloadSha256"]
        )

    exact_payroll_mutations = [
        (
            "reject-payroll-header-effective-to-nullability-drift",
            lambda value: next(
                row for row in payroll_dependency(value)["responseSchema"][
                    "headerFields"
                ] if row.get("name") == "effectiveTo"
            ).__setitem__("nullable", False),
            "DEPENDENCY_RESPONSE_FIELD_SEMANTICS_DRIFT",
        ),
        (
            "reject-payroll-line-effective-to-nullability-drift",
            lambda value: next(
                row for row in payroll_dependency(value)["responseSchema"]["lines"][
                    "itemFields"
                ] if row.get("name") == "effectiveTo"
            ).__setitem__("nullable", False),
            "DEPENDENCY_RESPONSE_FIELD_SEMANTICS_DRIFT",
        ),
        (
            "reject-payroll-currency-pattern-drift",
            lambda value: next(
                row for row in payroll_dependency(value)["responseSchema"]["lines"][
                    "itemFields"
                ] if row.get("name") == "currency"
            ).__setitem__("pattern", ".*"),
            "DEPENDENCY_RESPONSE_FIELD_SEMANTICS_DRIFT",
        ),
        (
            "reject-payroll-posted-money-negative-zero-drift",
            lambda value: next(
                row for row in payroll_dependency(value)["responseSchema"]["lines"][
                    "itemFields"
                ] if row.get("name") == "approvedAmount"
            ).__setitem__("negativeZero", "NORMALIZE_TO_ZERO"),
            "DEPENDENCY_RESPONSE_FIELD_SEMANTICS_DRIFT",
        ),
        (
            "reject-payroll-line-sequence-validation-drift",
            lambda value: next(
                row for row in payroll_dependency(value)["responseSchema"]["lines"][
                    "itemFields"
                ] if row.get("name") == "lineSequence"
            ).__setitem__("validation", "ANY_INTEGER"),
            "DEPENDENCY_RESPONSE_FIELD_SEMANTICS_DRIFT",
        ),
        (
            "reject-payroll-line-digest-validation-drift",
            lambda value: next(
                row for row in payroll_dependency(value)["responseSchema"]["lines"][
                    "itemFields"
                ] if row.get("name") == "lineDigest"
            ).__setitem__("validation", "UNCHECKED"),
            "DEPENDENCY_RESPONSE_FIELD_SEMANTICS_DRIFT",
        ),
        (
            "reject-payroll-line-domain-separator-drift",
            lambda value: payroll_dependency(value)["digestCanonicalization"][
                "lineDigest"
            ].__setitem__("domainSeparator", "DWP.HRIS.PAYROLL.SNAPSHOT.LINE.V2"),
            "DEPENDENCY_DIGEST_CANONICALIZATION_DRIFT",
        ),
        (
            "reject-payroll-digest-version-drift",
            lambda value: payroll_dependency(value)["digestCanonicalization"].__setitem__(
                "contractVersion", "DWP_HRIS_PAYROLL_SNAPSHOT_DIGEST_V2"
            ),
            "DEPENDENCY_DIGEST_CANONICALIZATION_DRIFT",
        ),
        (
            "reject-payroll-digest-encoding-drift",
            lambda value: payroll_dependency(value)["digestCanonicalization"].__setitem__(
                "encoding", "UTF-16"
            ),
            "DEPENDENCY_DIGEST_CANONICALIZATION_DRIFT",
        ),
        (
            "reject-payroll-bigint-number-canonicalization",
            lambda value: payroll_dependency(value)["digestCanonicalization"][
                "typedScalars"
            ].__setitem__("bigint", "RFC8785_JSON_NUMBER"),
            "DEPENDENCY_DIGEST_CANONICALIZATION_DRIFT",
        ),
        (
            "reject-payroll-line-field-order-drift",
            lambda value: payroll_dependency(value)["digestCanonicalization"][
                "lineDigest"
            ]["fieldOrder"].reverse(),
            "DEPENDENCY_DIGEST_CANONICALIZATION_DRIFT",
        ),
        (
            "reject-payroll-transport-byte-inclusion",
            lambda value: payroll_dependency(value)["digestCanonicalization"].__setitem__(
                "transportRepresentation", "INCLUDE_COMPRESSED_BYTES"
            ),
            "DEPENDENCY_DIGEST_CANONICALIZATION_DRIFT",
        ),
        (
            "reject-payroll-line-self-digest-injection",
            lambda value: payroll_dependency(value)["digestCanonicalization"][
                "lineDigest"
            ]["fieldOrder"].append("lineDigest"),
            "DEPENDENCY_DIGEST_CANONICALIZATION_DRIFT",
        ),
        (
            "reject-payroll-payload-self-digest-injection",
            lambda value: payroll_dependency(value)["digestCanonicalization"][
                "payloadDigest"
            ]["headerFieldOrder"].append("payloadDigest"),
            "DEPENDENCY_DIGEST_CANONICALIZATION_DRIFT",
        ),
        (
            "reject-payroll-line-digest-reorder",
            lambda value: payroll_dependency(value)["digestCanonicalization"][
                "payloadDigest"
            ].__setitem__("lineDigestOrder", "lineSequence DESC"),
            "DEPENDENCY_DIGEST_CANONICALIZATION_DRIFT",
        ),
        (
            "reject-payroll-empty-stream-acceptance",
            lambda value: payroll_dependency(value)["digestCanonicalization"][
                "closedInputValidation"
            ].__setitem__("zeroLines", "ACCEPT"),
            "DEPENDENCY_DIGEST_CANONICALIZATION_DRIFT",
        ),
        (
            "reject-payroll-one-line-boundary-drift",
            lambda value: payroll_dependency(value)["digestCanonicalization"][
                "closedInputValidation"
            ].__setitem__("oneLine", "REJECT"),
            "DEPENDENCY_DIGEST_CANONICALIZATION_DRIFT",
        ),
        (
            "reject-payroll-max-line-boundary-drift",
            lambda value: payroll_dependency(value)["digestCanonicalization"][
                "closedInputValidation"
            ].__setitem__("oneHundredThousandLines", "REJECT"),
            "DEPENDENCY_DIGEST_CANONICALIZATION_DRIFT",
        ),
        (
            "reject-payroll-duplicate-sequence-acceptance",
            lambda value: payroll_dependency(value)["digestCanonicalization"][
                "closedInputValidation"
            ].__setitem__("lineSequence", "ALLOW_DUPLICATE"),
            "DEPENDENCY_DIGEST_CANONICALIZATION_DRIFT",
        ),
        (
            "reject-payroll-null-absent-equivalence",
            lambda value: payroll_dependency(value)["digestCanonicalization"][
                "closedInputValidation"
            ].__setitem__("nullVsAbsent", "EQUIVALENT"),
            "DEPENDENCY_DIGEST_CANONICALIZATION_DRIFT",
        ),
        (
            "reject-payroll-decimal-alternate-spelling",
            lambda value: payroll_dependency(value)["digestCanonicalization"][
                "closedInputValidation"
            ].__setitem__("decimalAlternateSpelling", "NORMALIZE_AND_ACCEPT"),
            "DEPENDENCY_DIGEST_CANONICALIZATION_DRIFT",
        ),
        (
            "reject-payroll-duplicate-request-field-resealed",
            lambda value: payroll_dependency(value)["requestSchema"]["fields"].append(
                copy.deepcopy(payroll_dependency(value)["requestSchema"]["fields"][1])
            ),
            "DEPENDENCY_EXPECTED_SEAL_DRIFT",
        ),
        (
            "reject-payroll-selector-tenant-filter-drift-resealed",
            lambda value: payroll_dependency(value)["selectors"][0].__setitem__(
                "tenantFilter", "NONE"
            ),
            "DEPENDENCY_EXPECTED_SEAL_DRIFT",
        ),
        (
            "reject-payroll-read-plan-line-order-drift-resealed",
            lambda value: payroll_dependency(value)["readPlan"].__setitem__(
                "lineOrder", "line_sequence DESC"
            ),
            "DEPENDENCY_EXPECTED_SEAL_DRIFT",
        ),
    ]
    for name, mutate, defect in exact_payroll_mutations:
        s = copy.deepcopy(ssot)
        mutate(s)
        reseal_payroll(s)
        result = audit(s, exact)
        record(
            name,
            find_by_with_defect(
                result, "EVENT_OWNER_DEPENDENCY_REFETCH_INCOMPLETE", defect,
                operationId="modern.compplan.snapshot.publish",
                eventName=PAYROLL_EVENT_NAME,
            ),
            {"code": "EVENT_OWNER_DEPENDENCY_REFETCH_INCOMPLETE",
             "defect": defect},
        )

    return {
        "status": "PASS" if all(x["status"] == "PASS" for x in tests) else "FAIL",
        "testsRun": len(tests), "testsPassed": sum(x["status"] == "PASS" for x in tests),
        "tests": tests,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--ssot", type=Path, default=SSOT_PATH)
    parser.add_argument("--exact", type=Path, default=EXACT_PATH)
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    parser.add_argument("--selftest", action="store_true")
    parser.add_argument("--selftest-report", type=Path, default=DEFAULT_SELFTEST_REPORT)
    args = parser.parse_args()

    ssot = strict_load(args.ssot)
    exact = strict_load(args.exact)
    result = audit(ssot, exact)
    report = {
        "reportId": "DWP-HRIS-MODERN-OPERATION-SEMANTICS-INDEPENDENT-v1",
        "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
        "independence": {
            "authorGeneratorsImported": False, "authorValidatorsImported": False,
            "authorReadonlyComparisonReportUsedAsInput": False,
            "candidateFilesAreEvidenceOnly": True,
            "frozenRulesDefinedIn": str(Path(__file__).resolve()),
        },
        "inputs": {
            "operationSsot": {"path": str(args.ssot.resolve()), "sha256": file_sha(args.ssot)},
            "exactSchema": {"path": str(args.exact.resolve()), "sha256": file_sha(args.exact)},
            "listeningAuthority": {"path": str(LISTENING_AUTHORITY_PATH.resolve()), "sha256": file_sha(LISTENING_AUTHORITY_PATH)},
        },
        "falsePositivePolicy": [
            "No semantic equivalence by substring or prose marker.",
            "Defaulted/nullable columns and UPDATE_CAS are excluded from create-row completeness.",
            "State-only and frozen-owner-derived bodyless commands are explicitly separated.",
            "A query joining an event aggregate is not exact re-entry unless its path selects and response entity equals that aggregate.",
            "A child persistence effect cannot replace selection/CAS of the referenced parent root.",
            "Unavailable approval or verification proof may never be populated with fake/default values.",
        ],
        "gateAcceptanceCriteria": {
            "operationInventory": "exactly 199 unique operation IDs are audited and every operationDecision has zero findingIds",
            "writeCompleteness": "zero exact NOT NULL/no-default write gaps and zero required local parent-FK gaps",
            "businessInputs": "zero bodyless-business, ghost-body, mixed-upsert, and metric/projection semantic findings",
            "referenceExecution": "every scalar reference has one explicit complete typed selector; a closed signed credential must instead prove both exact nested admission and audience selectors plus route/claim/lock equality; selector/reference/inputEffect targets agree; every declared persisted input is assigned",
            "lifecycle": "zero pre-proof NOT NULL contradictions; proof tuples are state-conditional all-or-none or live only in immutable ledgers; every update-only version table has an initial producer",
            "eventReentry": "every non-FORBIDDEN public and handler event names an existing detail QUERY whose path identity and response entity exactly equal the event aggregate",
            "listening": "protected submit accepts only route surveyId + closed signedParticipationCredential + responseToken + typed answers, performs the exact seven-step owner-local receipt/admission/token/response/answer/bind/close transaction, and forbids broker/public outbox; survey create/revise persist closed typed form/version authority",
            "selftest": "all seventy-eight independent mutation tests PASS",
            "finalGate": "this report status PASS, route taxonomy report PASS, integrated independent static/physical report PASS, and PostgreSQL 16/18 executable fixtures PASS on identical reviewed bytes",
        },
        "audit": result,
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    selftest = None
    if args.selftest:
        selftest = run_selftests(ssot, exact)
        selftest_report = {
            "reportId": "DWP-HRIS-MODERN-OPERATION-SEMANTICS-MUTATION-SELFTEST-v1",
            "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
            "inputs": report["inputs"], "result": selftest,
        }
        args.selftest_report.parent.mkdir(parents=True, exist_ok=True)
        args.selftest_report.write_text(json.dumps(selftest_report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(json.dumps({
        "status": result["status"], "findingCount": result["uniqueFindingCount"],
        "affectedOperationCount": result["affectedOperationCount"],
        "categoryCounts": result["categoryCounts"],
        "report": str(args.report), "reportSha256": file_sha(args.report),
        "selftest": selftest,
        "selftestReport": str(args.selftest_report) if selftest else None,
        "selftestReportSha256": file_sha(args.selftest_report) if selftest else None,
    }, ensure_ascii=False, indent=2))
    return 0 if result["status"] == "PASS" and (selftest is None or selftest["status"] == "PASS") else 1


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
