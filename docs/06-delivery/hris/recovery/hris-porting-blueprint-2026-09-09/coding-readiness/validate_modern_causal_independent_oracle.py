#!/usr/bin/env python3
"""Independent hostile validator for the modern HRIS causal design.

This validator deliberately does not import either candidate Python module.
Its authority is the sealed reviewer-owned JSON oracle and fixture inventory.
The candidate is treated as untrusted input and may only be read as JSON/text.
"""

from __future__ import annotations

import argparse
import ast
import copy
import csv
import datetime as dt
import hashlib
import json
import os
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Iterable

from modern_causal_successor_profile import (
    LEGACY_PROFILE,
    SUCCESSOR_PROFILE,
    SuccessorProfileError,
    create_only_text,
    hostile_self_test as successor_profile_hostile_self_test,
    pending_successor_inputs,
    profile_metadata,
    require_profile,
    successor_paths,
    verify_predecessor_pins,
)


BASE = Path(__file__).resolve().parent
ROOT = BASE.parent
ORACLE_PATH = BASE / "modern-causal-independent-oracle.v1.json"
FIXTURE_PATH = BASE / "modern-causal-independent-pg-fixtures.v1.json"
CANDIDATE_PATH = BASE / "modern-capability-causal-state-contracts.v2.json"
CANDIDATE_EXACT_PATH = BASE / "modern-capability-exact-schema-contracts.v1.json"
CANDIDATE_EVENTS_PATH = BASE / "modern-capability-event-payload-contracts.v1.json"
CANDIDATE_LINEAGE_PATH = BASE / "modern-capability-event-successor-lineage.v2.json"
CANDIDATE_OWNERSHIP_PATH = BASE / "g3-contract-primary-ownership-register.csv"
CANDIDATE_SSOT_PATH = BASE / "modern-capability-operation-causal-contract-ssot.v2.json"
CANDIDATE_SEMANTIC_PATH = BASE / "modern-capability-semantic-bindings.v1.json"
CANDIDATE_IDENTITY_PATH = BASE / "modern-capability-public-identity-registry.v1.json"
LISTENING_SUCCESSOR_AUTHORITY_PATH = BASE / "sys-listening-stream-authority-successor.v1.json"
PG_EVIDENCE_PATH = BASE / "reports/modern-causal-independent-pg-evidence.v2.json"
PG_RUNNER_PATH = BASE / "run_modern_causal_independent_pg_fixtures.py"
FINAL_VERIFIER_PATH = BASE / "validate_modern_causal_final_endorsement.py"
SOURCE_AUTHORITY_PATH = BASE / "modern-causal-final-source-authority-manifest.v1.json"
CONTROL_INTAKE_PATH = ROOT / "g0/control-evidence-intake/modern-causal-final-endorsement.v1.json"
DESIGN_FINDINGS_PATH = BASE / "reports/modern-causal-independent-design-findings.v1.json"
HISTORICAL_FAIL_PATH = BASE / "reports/modern-causal-independent-historical-fail.v1.json"
HISTORICAL_FAIL_MD_PATH = BASE / "reports/modern-causal-independent-historical-fail.v1.md"
BUILDER_PATH = BASE / "build_modern_causal_independent_oracle.py"
REVIEW_INVENTORY_PATH = BASE / "modern-causal-independent-review-inventory.v1.json"
REVIEW_FINALIZATION_PATH = BASE / "modern-causal-independent-reviewed-finalization.v1.json"
ACTIVE_PROFILE = LEGACY_PROFILE
ACTIVE_PROFILE_METADATA = profile_metadata(ACTIVE_PROFILE, BASE, ROOT)


def configure_profile(name: str) -> dict[str, Any]:
    """Route only the explicitly selected artifact chain.

    ``legacy-v1`` keeps historical oracle/reproduction behavior.  The
    successor profile never aliases missing v2/v3 artifacts back to those
    predecessor paths.
    """
    global ACTIVE_PROFILE, ACTIVE_PROFILE_METADATA
    global ORACLE_PATH, FIXTURE_PATH, LISTENING_SUCCESSOR_AUTHORITY_PATH
    global PG_EVIDENCE_PATH, SOURCE_AUTHORITY_PATH, CONTROL_INTAKE_PATH
    global DESIGN_FINDINGS_PATH, REVIEW_INVENTORY_PATH, REVIEW_FINALIZATION_PATH
    name = require_profile(name)
    ACTIVE_PROFILE = name
    if name == SUCCESSOR_PROFILE:
        paths = successor_paths(BASE, ROOT)
        ORACLE_PATH = paths["oracle"]
        FIXTURE_PATH = paths["fixture"]
        LISTENING_SUCCESSOR_AUTHORITY_PATH = paths["listeningAuthority"]
        PG_EVIDENCE_PATH = paths["pgEvidence"]
        SOURCE_AUTHORITY_PATH = paths["sourceAuthority"]
        CONTROL_INTAKE_PATH = paths["controlIntake"]
        DESIGN_FINDINGS_PATH = paths["designFindings"]
        REVIEW_INVENTORY_PATH = paths["reviewInventory"]
        REVIEW_FINALIZATION_PATH = paths["reviewFinalization"]
    else:
        ORACLE_PATH = BASE / "modern-causal-independent-oracle.v1.json"
        FIXTURE_PATH = BASE / "modern-causal-independent-pg-fixtures.v1.json"
        LISTENING_SUCCESSOR_AUTHORITY_PATH = BASE / "sys-listening-stream-authority-successor.v1.json"
        PG_EVIDENCE_PATH = BASE / "reports/modern-causal-independent-pg-evidence.v2.json"
        SOURCE_AUTHORITY_PATH = BASE / "modern-causal-final-source-authority-manifest.v1.json"
        CONTROL_INTAKE_PATH = ROOT / "g0/control-evidence-intake/modern-causal-final-endorsement.v1.json"
        DESIGN_FINDINGS_PATH = BASE / "reports/modern-causal-independent-design-findings.v1.json"
        REVIEW_INVENTORY_PATH = BASE / "modern-causal-independent-review-inventory.v1.json"
        REVIEW_FINALIZATION_PATH = BASE / "modern-causal-independent-reviewed-finalization.v1.json"
    ACTIVE_PROFILE_METADATA = profile_metadata(ACTIVE_PROFILE, BASE, ROOT)
    return ACTIVE_PROFILE_METADATA


def successor_preflight() -> dict[str, Any]:
    paths = successor_paths(BASE, ROOT)
    stage_state = successor_stage_state(BASE, ROOT)
    return {
        "profile": ACTIVE_PROFILE,
        "activeGateChain": ACTIVE_PROFILE_METADATA["activeGateChain"],
        "canonicalCounts": ACTIVE_PROFILE_METADATA["canonicalCounts"],
        "policy": ACTIVE_PROFILE_METADATA["policy"],
        "successorArtifacts": {
            key: str(value.relative_to(ROOT)) for key, value in paths.items()
        },
        "missingSuccessorInputs": pending_successor_inputs(BASE, ROOT, stage="review-input"),
        "stageState": stage_state,
        "acceptedLivePreflight": (
            __import__("modern_causal_successor_profile", fromlist=["accepted_live_preflight"])
            .accepted_live_preflight(BASE, ROOT)
        ),
        "predecessorPinFailures": verify_predecessor_pins(ROOT),
        "predecessorDisposition": ACTIVE_PROFILE_METADATA.get("predecessorDisposition"),
    }
DEPENDENCY_REGISTER_PATH = BASE / "module-dependency-register.csv"
XCON_REGISTER_PATH = BASE / "cross-module-contract-register.csv"
XCON_BINDING_REGISTER_PATH = BASE / "cross-module-schema-binding-register.csv"
XCON_SCHEMA_PATH = BASE / "cross-module-canonical-schemas.v1.json"
TRACE_REGISTER_PATH = BASE / "modern-capability-trace-register.csv"
SLICE_REGISTER_PATH = BASE / "g3-slice-code-go-register.csv"
PER_MODERN_CONTRACT_PATH = ROOT / "session-evidence/per/g3-modern-capability-contracts.v2.json"
PAY_MODERN_CONSUMER_PATH = ROOT / "session-evidence/pay/g3-modern-capability-consumer-contracts.v1.json"

COMPENSATION_PREDECESSOR = "CompensationPlanApproved.v1"
COMPENSATION_SNAPSHOT = "ApprovedCompensationPlanSnapshot.v1"
COMPENSATION_EVENT_V2 = "ApprovedCompensationPlanSnapshotPublished.v2"
COMPENSATION_CAPABILITY = "HRIS.MODERN.COMPENSATION_PLANNING"
COMPENSATION_EVENT_FIELDS = {
    "aggregateId", "fromState", "toState", "aggregateVersion", "occurredAt",
    "correlationId", "planId", "cycleId", "approvalRevision",
    "approvalReceiptId", "effectiveDate", "snapshotId", "lineCount",
    "snapshotRevision", "sourceVersion", "payloadDigest",
}

FINAL_FROZEN_SUBJECT_PINS = {
    "operationSsot": "ac5ab13730c77267d6d7433b9e567560f0511c18d9255e879a7bb1c6c2286790",
    "exact": "5c5fa702c137f879f83f6aa0af918f6ec3769b4c0171d5c2db43fd894ccee76a",
    "events": "12a14952c99da6a8a1dd4d27fb3f46b9f0e3a36a02fa06530c170b66b9211cc3",
    "causal": "17123b521bef00561d42370f0f7f23f23faaadf714fdd4e36b2ecb9239a004f0",
    "lineage": "fc2f28f9a1c401394683c38df3413b2f121662531c6ea9f77dd52579b73320e4",
    "ownership": "11f51f88e25ff01666f347467c82d2e825a81091926cff03f141fd750b476e9b",
    "semanticBindings": "89bf690a7087c878c81e84ce6fcda4c63c29f2a4a5fbd5a61fc45d7862ee360a",
    "publicIdentity": "91de0006d977fcc579f4ec49bed0aca14c4e71fc91a934e064e815cf9d7439b8",
}

# Reviewer-owned physical authority.  These are checked-in owner migrations,
# not tables synthesized by the causal candidate or by this validator.
BASE_TRANSACTION_DDL = {
    "HRIS-HRM-RECEIPT-INBOX": {
        "path": "session-evidence/hrm/g2-readiness/physical-schema-blueprint.sql",
        "sha256": "dbe18b0a2700bac21088391d2d9c13d155d30058b44843aeed033d3333896969",
    },
    "HRIS-HRM-OUTBOX": {
        "path": "../../dwp-backend/dwp-people-server/src/main/resources/db/migration/V1__create_workforce_projection.sql",
        "sha256": "1d5d10b46be944669efca74e7af8e3d5cd6d09f9b388f2de4accd83a18d1a40e",
    },
    "HRIS-PER": {
        "path": "session-evidence/per/g2-readiness/physical-schema.sql",
        "sha256": "0099544d7a5fa22bd4b565664b21e5f8f1a68288cce16cdbec83a212f5e70d44",
    },
    "HRIS-TIM": {
        "path": "session-evidence/tim/g2-physical-schema.sql",
        "sha256": "01325e939dc1d116d53067d0332f348146d13c2be6a1e314357e82d3e2769a80",
    },
    "HRIS-SYS-RECEIPT": {
        "path": "session-evidence/sys/g2-physical-schema.sql",
        "sha256": "e1d47e863e9883f37507f381c9a0c328725832d02c0ee1b426a6f709b86e2821",
    },
    "HRIS-SYS-INBOX-OUTBOX": {
        "path": "../../dwp-backend/dwp-core/src/main/resources/db/migration/R__create_domain_event_delivery_ledger.sql",
        "sha256": "e7123a27e6d35c991f8f49045f0f92205ff417bfbcf89a2b9a32f9ad0f479e42",
    },
}

PHYSICAL_TRANSACTION_PROFILES = {
    "HRIS-HRM": {
        "receiptTable": "ppl_command_receipts", "outboxTable": "sys_people_outbox_events",
        "inboxTable": "ppl_domain_inbox_receipts", "ddlKeys": ["HRIS-HRM-RECEIPT-INBOX", "HRIS-HRM-OUTBOX"],
        "resultColumn": ("result_reference", "JSONB"), "digestColumn": "request_hash",
        "statusColumns": ("lifecycle_state", "result_code"),
        "guard": ("ppl_guard_command_receipt_originating_auth", "trg_ppl_command_receipt_originating_auth"),
    },
    "HRIS-PER": {
        "receiptTable": "prf_command_receipts", "outboxTable": "prf_outbox_events",
        "inboxTable": "prf_inbox_receipts", "ddlKeys": ["HRIS-PER"],
        "resultColumn": ("result_ref", "UUID"), "digestColumn": "request_hash",
        "statusColumns": ("receipt_state", "response_code"),
        "guard": ("prf_guard_command_receipt_originating_auth", "trg_prf_command_receipt_originating_auth"),
    },
    "HRIS-TIM": {
        "receiptTable": "tme_command_receipts", "outboxTable": "tme_outbox_events",
        "inboxTable": "tme_inbox_receipts", "ddlKeys": ["HRIS-TIM"],
        "resultColumn": ("result_ref", "UUID"), "digestColumn": "request_digest",
        "statusColumns": ("status",),
        "guard": ("tme_guard_command_receipt_seal", "tr_tme_command_receipt_seal"),
    },
    "HRIS-SYS": {
        "receiptTable": "sys_hris_command_receipts", "outboxTable": "sys_domain_event_outbox",
        "inboxTable": "sys_domain_event_inbox", "ddlKeys": ["HRIS-SYS-RECEIPT", "HRIS-SYS-INBOX-OUTBOX"],
        "resultColumn": ("result_ref", "VARCHAR(500)"), "digestColumn": "request_digest",
        "statusColumns": ("status", "result_ref"),
        "guard": ("sys_hris_guard_command_receipt_seal", "tr_sys_hris_command_receipt_seal"),
    },
}

EXPECTED_HANDLER_ASSIGNMENTS = {
    "internal.recruiting.hire-handoff.acknowledge": {
        "ppl_rec_hire_handoff_receipts": {
            "tenant_id", "created_by", "correlation_id", "candidate_case_id", "decision_revision",
            "payload_digest", "recorded_at", "worker_public_id", "offer_id", "effective_date",
            "employment_public_id", "assignment_public_id", "owner_aggregate_version",
            "owner_acknowledgement_id",
        },
        "ppl_rec_hire_requests": {
            "status", "acknowledged_at", "owner_acknowledgement_id", "aggregate_version",
            "updated_at", "updated_by", "correlation_id",
        },
        "ppl_rec_candidate_cases": {
            "stage", "aggregate_version", "updated_at", "updated_by", "correlation_id",
        },
    },
    "internal.contingent.access-expiry.enforce": {
        "ppl_cwk_access_expiry_receipts": {
            "tenant_id", "created_by", "correlation_id", "contingent_engagement_id",
            "grant_public_id", "grant_revision", "outcome", "payload_digest", "receipt_digest",
            "recorded_at",
        },
        "ppl_cwk_engagements": {
            "status", "offboarded_at", "aggregate_version", "updated_at", "updated_by", "correlation_id",
        },
    },
    "internal.wfm.schedule-optimization.complete": {
        "tme_wfm_schedule_candidates": {
            "tenant_id", "created_by", "correlation_id", "availability_snapshot_id",
            "candidate_digest", "candidate_revision", "demand_forecast_id", "period_end",
            "period_start", "status", "optimization_request_id", "input_snapshot_id", "shift_line_count",
        },
        "tme_wfm_candidate_shift_lines": {
            "tenant_id", "created_by", "correlation_id", "schedule_candidate_id", "line_sequence",
            "worker_public_id", "assignment_public_id", "worksite_public_id", "position_public_id",
            "line_digest", "demand_forecast_id", "line_key", "demand_line_key", "starts_at", "ends_at",
            "required_skills", "local_work_date", "time_zone", "tzdb_version", "start_offset_seconds",
            "end_offset_seconds", "segments", "calendar_snapshot_ref", "work_rule_snapshot_ref",
            "break_duration_seconds", "planning_input_snapshot_id",
        },
        "tme_wfm_constraint_evaluation_receipts": {
            "tenant_id", "created_by", "correlation_id", "blocking_violation_count", "evaluated_at",
            "evaluation_revision", "fairness_metric_count", "result_digest", "schedule_candidate_id",
            "validation_suite_version", "input_digest", "policy_version_public_id", "candidate_digest",
            "candidate_revision", "planning_input_snapshot_id", "policy_digest", "policy_revision",
            "validation_status",
        },
        "tme_wfm_optimization_requests": {
            "status", "aggregate_version", "updated_at", "updated_by", "correlation_id",
        },
    },
    "internal.ai.policy-evaluation.complete": {
        "sys_hris_ai_evaluation_receipts": {
            "tenant_id", "created_by", "correlation_id", "ai_policy_version_id",
            "blocking_failure_count", "evaluated_at", "evaluation_revision",
            "evaluation_suite_version_id", "payload_digest", "result_digest",
            "ai_evaluation_request_id", "evaluation_outcome",
        },
        "sys_hris_ai_use_policies": {
            "status", "aggregate_version", "updated_at", "updated_by", "correlation_id",
        },
        "sys_hris_ai_evaluation_requests": {
            "status", "aggregate_version", "updated_at", "updated_by", "correlation_id",
        },
    },
}

TRANSACTION_SQL_TYPES = re.compile(
    r"^(UUID|BIGSERIAL|BIGINT|INTEGER|SMALLINT|BOOLEAN|JSONB|TEXT|DATE|"
    r"TIMESTAMPTZ|TIMESTAMP|CHAR\s*\(\s*\d+\s*\)|VARCHAR\s*\(\s*\d+\s*\))(?=\s|$)",
    re.I,
)

REVIEW_ARTIFACT_PINS = {
    REVIEW_INVENTORY_PATH.name: {
        "fileSha256": "496f0f42db3106331f5631bc2094a8d25759328a4bc5f83f296df382e923b84f",
        "sealedPayloadSha256": "6ce5b973cdfd5d249d2831c46bac80632602590061b776335efae01fddda3b21",
    },
    REVIEW_FINALIZATION_PATH.name: {
        "fileSha256": "345cbb222998856b8ea97efaf4cead89530bb51916b268c68c1532e5261c6992",
        "sealedPayloadSha256": "a0843ff8c79632f2c96a124995e38f3e4ca9cae4b5e99b27b92ada04b36e6619",
    },
}

FORBIDDEN_EDGE_KEYS = {
    ("modern.recruiting.hire.record", "ppl_rec_hire_handoff_receipts"),
    ("modern.learning.offering.create", "prf_lrn_assignments"),
    ("modern.opportunity.create", "prf_mkt_applications"),
    ("modern.wfm.schedule.optimize", "tme_wfm_schedule_publish_ledger"),
    ("modern.wfm.schedule.submit", "tme_wfm_constraint_evaluation_receipts"),
}

CONTROL_EVENT_REQUEST_FIELDS = {
    "headers.X-Correlation-ID",
}

LISTENING_CAPABILITY = "HRIS.MODERN.EMPLOYEE_LISTENING"
LISTENING_SUCCESSOR_AUTHORITY_ID = "dwp.hris.sys.listening.stream-authority-successor.v1"
LISTENING_PREDECESSOR_PUBLIC_EVENTS = {
    "EmployeeListeningResponseSubmitted.v2",
    "EmployeeListeningSurveyCreated.v2",
    "EmployeeListeningSurveyPublished.v2",
    "EmployeeListeningSurveyClosed.v2",
    "EmployeeListeningActionCreated.v2",
    "EmployeeListeningActionCompleted.v2",
}
LISTENING_SUCCESSOR_PUBLIC_EVENT_STREAMS = {
    "EmployeeListeningSurveyCreated.v3": "platform-hris-configuration",
    "EmployeeListeningSurveyPublished.v3": "platform-hris-configuration",
    "EmployeeListeningSurveyClosed.v3": "platform-hris-configuration",
    "EmployeeListeningActionCreated.v3": "platform-hris-configuration",
    "EmployeeListeningActionCompleted.v3": "platform-hris-configuration",
    "EmployeeListeningCohortProjectionPublished.v1": "platform-hris-insights",
}
LISTENING_SUCCESSOR_PAYLOAD_CLASSES = {
    "EmployeeListeningSurveyCreated.v3": "CONFIGURATION_METADATA_ONLY",
    "EmployeeListeningSurveyPublished.v3": "CONFIGURATION_METADATA_AND_PROTECTED_RECEIPT_REF_ONLY",
    "EmployeeListeningSurveyClosed.v3": "CONFIGURATION_METADATA_AND_PROTECTED_RECEIPT_REF_ONLY",
    "EmployeeListeningActionCreated.v3": "ACTION_METADATA_ONLY",
    "EmployeeListeningActionCompleted.v3": "ACTION_METADATA_ONLY",
    "EmployeeListeningCohortProjectionPublished.v1": "PRIVACY_SAFE_AGGREGATE_LINEAGE_ONLY",
}
LISTENING_SUCCESSOR_INTERNAL_MESSAGES = {
    "ListeningAdmissionInstallRequested.v1",
    "ListeningAdmissionInstallReceipt.v1",
    "ListeningAdmissionCloseRequested.v1",
    "ListeningAdmissionCloseReceipt.v1",
    "ListeningCohortPackageReady.v1",
    "ListeningCohortProjectionReceipt.v1",
}
LISTENING_STATIC_DESIGN_ID = "dwp.hris.sys.listening.canonical-static-design.v1"
LISTENING_STATIC_DESIGN_DIGEST = (
    "e51930fec782a3958b90ac665c38e964158ed5857859db513baf189153c62634"
)
LISTENING_CANONICAL_INPUTS = (
    (
        "operationCausal",
        "coding-readiness/modern-capability-operation-causal-contract-ssot.v2.json",
        CANDIDATE_SSOT_PATH,
    ),
    (
        "semanticBindings",
        "coding-readiness/modern-capability-semantic-bindings.v1.json",
        CANDIDATE_SEMANTIC_PATH,
    ),
    (
        "publicIdentities",
        "coding-readiness/modern-capability-public-identity-registry.v1.json",
        CANDIDATE_IDENTITY_PATH,
    ),
    (
        "exactSchemas",
        "coding-readiness/modern-capability-exact-schema-contracts.v1.json",
        CANDIDATE_EXACT_PATH,
    ),
    (
        "eventPayloads",
        "coding-readiness/modern-capability-event-payload-contracts.v1.json",
        CANDIDATE_EVENTS_PATH,
    ),
)


# Frozen predecessor public-event boundary.  This is deliberately duplicated
# here rather than imported from the builder or candidate register.  The
# candidate/oracle files remain sealed predecessor inputs; the effective G3
# ownership and trace boundary is formed below by the independently reviewed
# SYS listening successor ceremony.
INDEPENDENT_PUBLIC_EVENT_OWNER_SESSIONS = dict(
    line.split("|", 1) for line in """
ApprovedCompensationPlanSnapshotPublished.v2|HRIS-PER
BenefitEnrollmentDecided.v2|HRIS-HRM
BenefitEnrollmentSubmitted.v2|HRIS-HRM
BenefitLifeEventSubmitted.v2|HRIS-HRM
BenefitPlanCreated.v2|HRIS-HRM
BenefitPlanPublished.v2|HRIS-HRM
CandidateHireHandoffRequested.v2|HRIS-HRM
CandidateHired.v2|HRIS-HRM
CandidateOfferIssued.v2|HRIS-HRM
CandidateStageChanged.v2|HRIS-HRM
CompensationBudgetAllocated.v2|HRIS-PER
CompensationCycleCreated.v2|HRIS-PER
CompensationPlanApprovalRecorded.v2|HRIS-PER
CompensationProposalSubmitted.v2|HRIS-PER
ContingentAccessExpired.v2|HRIS-HRM
ContingentEngagementActivated.v2|HRIS-HRM
ContingentEngagementClosed.v2|HRIS-HRM
ContingentEngagementCreated.v2|HRIS-HRM
ContingentEngagementOffboardingStarted.v2|HRIS-HRM
ContingentEngagementSubmitted.v2|HRIS-HRM
EmployeeListeningActionCompleted.v2|HRIS-SYS
EmployeeListeningActionCreated.v2|HRIS-SYS
EmployeeListeningResponseSubmitted.v2|HRIS-SYS
EmployeeListeningSurveyClosed.v2|HRIS-SYS
EmployeeListeningSurveyCreated.v2|HRIS-SYS
EmployeeListeningSurveyPublished.v2|HRIS-SYS
GovernedAiAssistanceProduced.v2|HRIS-SYS
GovernedAiPolicyCreated.v2|HRIS-SYS
GovernedAiPolicyEvaluationCompleted.v2|HRIS-SYS
GovernedAiPolicyEvaluationRequested.v2|HRIS-SYS
GovernedAiPolicyPublished.v2|HRIS-SYS
GovernedAiPolicyRetired.v2|HRIS-SYS
GovernedAiPolicySuspended.v2|HRIS-SYS
GrowthCoachingRecorded.v2|HRIS-PER
GrowthEvidenceLinked.v2|HRIS-PER
GrowthProfileArchived.v2|HRIS-PER
GrowthProfileCreated.v2|HRIS-PER
GrowthProfileUpdated.v2|HRIS-PER
HrServiceCaseAssigned.v2|HRIS-HRM
HrServiceCaseCreated.v2|HRIS-HRM
HrServiceCaseResolved.v2|HRIS-HRM
HrServiceCaseResponseRecorded.v2|HRIS-HRM
HrServiceCaseTriaged.v2|HRIS-HRM
LearningAssignmentStarted.v2|HRIS-PER
LearningCompletionVerified.v2|HRIS-PER
LearningEnrollmentCreated.v2|HRIS-PER
LearningOfferingCreated.v2|HRIS-PER
LearningOfferingPublished.v2|HRIS-PER
OnboardingJourneyAssigned.v2|HRIS-HRM
OnboardingJourneyCancelled.v2|HRIS-HRM
OnboardingJourneyCompleted.v2|HRIS-HRM
OnboardingTaskCompleted.v2|HRIS-HRM
OnboardingTemplateCreated.v2|HRIS-HRM
OnboardingTemplatePublished.v2|HRIS-HRM
PeopleAnalyticsExportRequested.v2|HRIS-SYS
PeopleMetricCreated.v2|HRIS-SYS
PeopleMetricPublished.v2|HRIS-SYS
PeopleMetricRetired.v2|HRIS-SYS
PeopleMetricValidated.v2|HRIS-SYS
RequisitionCreated.v2|HRIS-HRM
RequisitionPublished.v2|HRIS-HRM
SkillsTaxonomyCreated.v2|HRIS-PER
SkillsTaxonomyPublished.v2|HRIS-PER
SkillsTaxonomyValidated.v2|HRIS-PER
SuccessionNominationAdded.v2|HRIS-PER
SuccessionPlanApproved.v2|HRIS-PER
SuccessionPlanCreated.v2|HRIS-PER
SuccessionPlanPublished.v2|HRIS-PER
SuccessionPlanSubmitted.v2|HRIS-PER
TalentOpportunityApplicationShortlisted.v2|HRIS-PER
TalentOpportunityApplicationSubmitted.v2|HRIS-PER
TalentOpportunityCreated.v2|HRIS-PER
TalentOpportunityPublished.v2|HRIS-PER
TalentOpportunitySelectionRecorded.v2|HRIS-PER
WorkerSkillEvidenceVerified.v2|HRIS-PER
WorkforceDemandForecastCreated.v2|HRIS-TIM
WorkforceScenarioCreated.v2|HRIS-HRM
WorkforceScenarioDecisionRecorded.v2|HRIS-HRM
WorkforceScenarioPublished.v2|HRIS-HRM
WorkforceScenarioSimulated.v2|HRIS-HRM
WorkforceScenarioSubmitted.v2|HRIS-HRM
WorkforceScheduleCandidateGenerated.v2|HRIS-TIM
WorkforceScheduleCandidateSubmitted.v2|HRIS-TIM
WorkforceScheduleOptimizationRequested.v2|HRIS-TIM
WorkforceSchedulePublished.v2|HRIS-TIM
WorkforceScheduleValidationCompleted.v2|HRIS-TIM
""".strip().splitlines()
)

# Effective G3 public-event boundary.  Only the six explicitly superseded SYS
# listening contracts are replaced.  The cohort projection is intentionally a
# new v1 contract, so a blanket ``*.v2`` check would reject the privacy-safe
# successor and turn semantic versioning into an accidental policy rule.
INDEPENDENT_ACTIVE_PUBLIC_EVENT_OWNER_SESSIONS = {
    **{
        event_name: owner_session
        for event_name, owner_session in INDEPENDENT_PUBLIC_EVENT_OWNER_SESSIONS.items()
        if event_name not in LISTENING_PREDECESSOR_PUBLIC_EVENTS
    },
    **{event_name: "HRIS-SYS" for event_name in LISTENING_SUCCESSOR_PUBLIC_EVENT_STREAMS},
}
INDEPENDENT_ACTIVE_TRACE_CONTRACTS = (
    set(INDEPENDENT_ACTIVE_PUBLIC_EVENT_OWNER_SESSIONS)
    | LISTENING_SUCCESSOR_INTERNAL_MESSAGES
)


# Independently duplicated review authority.  These values are deliberately
# not imported from the builder or candidate generator, so changing either
# implementation cannot teach this validator a new expected answer.
INDEPENDENT_EXPECTED_TABLES = {
    "ppl_bnf_enrollments", "ppl_bnf_life_events", "ppl_bnf_plan_versions", "ppl_bnf_plans",
    "ppl_bnf_provider_receipts", "ppl_cwk_access_expiry_receipts", "ppl_cwk_engagements",
    "ppl_cwk_sponsor_assignments", "ppl_hrs_case_actions", "ppl_hrs_cases", "ppl_hrs_sla_receipts",
    "ppl_jny_assignment_tasks", "ppl_jny_assignments", "ppl_jny_task_evidence",
    "ppl_jny_template_versions", "ppl_jny_templates", "ppl_rec_candidate_cases",
    "ppl_rec_hire_handoff_receipts", "ppl_rec_hire_requests", "ppl_rec_offers", "ppl_rec_requisitions",
    "ppl_wfp_publish_receipts", "ppl_wfp_scenario_revisions", "ppl_wfp_scenarios",
    "prf_cmp_approved_snapshot_lines", "prf_cmp_approved_snapshots", "prf_cmp_budget_ledger",
    "prf_cmp_cycles", "prf_cmp_plans", "prf_cmp_proposals", "prf_grw_aspirations", "prf_grw_coaching_notes",
    "prf_grw_evidence_links", "prf_grw_profile_revisions", "prf_grw_profiles", "prf_lrn_assignments",
    "prf_lrn_completion_evidence", "prf_lrn_offerings", "prf_mkt_applications",
    "prf_mkt_match_explanations", "prf_mkt_opportunities", "prf_skl_taxonomies",
    "prf_skl_taxonomy_versions", "prf_skl_worker_evidence", "prf_suc_nominations", "prf_suc_plans",
    "prf_suc_readiness_evidence", "sys_hris_ai_evaluation_receipts", "sys_hris_ai_evaluation_requests",
    "sys_hris_ai_policy_versions", "sys_hris_ai_provenance_receipts", "sys_hris_ai_use_policies",
    "sys_hris_analytics_export_receipts", "sys_hris_listening_actions", "sys_hris_listening_cohort_results",
    "sys_hris_listening_responses", "sys_hris_listening_surveys", "sys_hris_metric_definitions",
    "sys_hris_metric_projections", "sys_hris_metric_versions", "tme_wfm_constraint_evaluation_receipts",
    "tme_wfm_approval_requests", "tme_wfm_candidate_shift_lines", "tme_wfm_constraint_violation_lines", "tme_wfm_demand_forecasts",
    "tme_wfm_demand_lines", "tme_wfm_fairness_measure_values", "tme_wfm_forecast_revision_counters",
    "tme_wfm_optimization_requests", "tme_wfm_schedule_candidates", "tme_wfm_schedule_publish_ledger",
}

INDEPENDENT_REQUIRED_DELTAS = {
    "ppl_rec_hire_requests": ({"candidate_case_id": "BIGINT", "offer_id": "BIGINT",
        "effective_date": "DATE", "human_decision_receipt_public_id": "UUID",
        "reason_code": "VARCHAR(80)", "candidate_version": "BIGINT",
        "request_digest": "CHAR(64)", "status": "VARCHAR(40)"},
        ("status", {"PENDING", "ACKNOWLEDGED", "FAILED", "CANCELLED"})),
    "ppl_jny_template_versions": ({"journey_template_id": "BIGINT", "version_no": "BIGINT",
        "status": "VARCHAR(40)", "task_definitions": "JSONB", "content_digest": "CHAR(64)"},
        ("status", {"DRAFT", "PUBLISHED", "RETIRED"})),
    "ppl_jny_assignment_tasks": ({"journey_assignment_id": "BIGINT", "task_key": "VARCHAR(160)",
        "task_order": "INTEGER", "required_flag": "BOOLEAN", "status": "VARCHAR(40)"},
        ("status", {"PENDING", "COMPLETED", "CANCELLED"})),
    "ppl_bnf_plan_versions": ({"benefit_plan_id": "BIGINT", "version_no": "BIGINT",
        "status": "VARCHAR(40)", "eligibility_policy_version_id": "UUID",
        "enrollment_window_policy_version_id": "UUID", "valid_from": "DATE", "valid_to": "DATE",
        "coverage_options": "JSONB", "coverage_configuration_digest": "CHAR(64)",
        "delivery_mode": "VARCHAR(40)", "provider_config_version_id": "UUID",
        "payroll_treatment_code": "VARCHAR(80)", "approval_receipt_public_id": "UUID",
        "content_digest": "CHAR(64)"},
        ("status", {"DRAFT", "PUBLISHED", "RETIRED"})),
    "ppl_bnf_enrollments": ({"benefit_plan_id": "BIGINT", "benefit_plan_version_id": "BIGINT",
        "worker_public_id": "UUID", "coverage_level": "VARCHAR(40)", "effective_from": "DATE",
        "effective_to": "DATE", "dependent_tokens": "JSONB", "life_event_id": "BIGINT",
        "submission_digest": "CHAR(64)", "decision_receipt_public_id": "UUID",
        "last_reason_code": "VARCHAR(80)", "status": "VARCHAR(40)"},
        ("status", {"SUBMITTED", "ACTIVE", "REJECTED", "CANCELLED"})),
    "ppl_jny_assignments": ({"journey_template_id": "BIGINT", "journey_template_version_id": "BIGINT",
        "worker_public_id": "UUID", "assigned_at": "TIMESTAMPTZ", "due_at": "TIMESTAMPTZ",
        "assignment_revision": "BIGINT", "completed_at": "TIMESTAMPTZ", "status": "VARCHAR(40)"},
        ("status", {"ASSIGNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"})),
    "prf_grw_profile_revisions": ({"growth_profile_id": "BIGINT", "profile_revision": "BIGINT",
        "artifact_public_id": "UUID", "artifact_revision": "BIGINT", "visibility": "VARCHAR(40)",
        "evidence_refs_digest": "CHAR(64)", "recorded_at": "TIMESTAMPTZ"}, None),
    "prf_grw_coaching_notes": ({"growth_profile_id": "BIGINT", "coach_principal_public_id": "UUID",
        "artifact_public_id": "UUID", "artifact_revision": "BIGINT", "employee_visible": "BOOLEAN",
        "occurred_at": "TIMESTAMPTZ", "evidence_refs_digest": "CHAR(64)", "status": "VARCHAR(40)"},
        ("status", {"RECORDED"})),
    "prf_skl_worker_evidence": ({"verification_receipt_public_id": "UUID",
        "verification_reason_code": "VARCHAR(80)", "verified_at": "TIMESTAMPTZ",
        "status": "VARCHAR(40)"}, ("status", {"PENDING", "VERIFIED", "REVOKED"})),
    "prf_lrn_offerings": ({"offering_code": "VARCHAR(40)", "display_name": "VARCHAR(240)",
        "provider_public_id": "UUID", "valid_from": "DATE", "valid_to": "DATE",
        "status": "VARCHAR(40)"}, ("status", {"DRAFT", "PUBLISHED", "RETIRED"})),
    "prf_lrn_assignments": ({"learning_offering_id": "BIGINT", "worker_public_id": "UUID",
        "assigned_at": "TIMESTAMPTZ", "assignment_revision": "BIGINT", "effective_from": "DATE",
        "consent_revision": "BIGINT", "started_at": "TIMESTAMPTZ", "completed_at": "TIMESTAMPTZ",
        "status": "VARCHAR(40)"}, ("status", {"ENROLLED", "IN_PROGRESS", "COMPLETED", "CANCELLED"})),
    "prf_lrn_completion_evidence": ({"learning_assignment_id": "BIGINT", "completion_revision": "BIGINT",
        "source_receipt_id": "UUID", "source_revision": "BIGINT", "evidence_digest": "CHAR(64)",
        "payload_digest": "CHAR(64)", "completed_at": "TIMESTAMPTZ", "verified_at": "TIMESTAMPTZ",
        "skill_evidence_ids": "UUID[]"}, None),
    "prf_mkt_applications": ({"internal_opportunity_id": "BIGINT", "worker_public_id": "UUID",
        "applied_at": "TIMESTAMPTZ", "application_statement_digest": "CHAR(64)",
        "consent_revision": "BIGINT", "status": "VARCHAR(40)"},
        ("status", {"APPLIED", "SHORTLISTED", "SELECTED", "NOT_SELECTED", "WITHDRAWN"})),
    "prf_cmp_plans": ({"compensation_cycle_id": "BIGINT", "cycle_public_id": "UUID",
        "approval_receipt_public_id": "UUID", "approval_revision": "BIGINT",
        "approval_outcome": "VARCHAR(40)", "plan_revision": "BIGINT", "content_digest": "CHAR(64)",
        "approved_at": "TIMESTAMPTZ", "status": "VARCHAR(40)"},
        ("status", {"APPROVED", "SUPERSEDED", "RETIRED"})),
    "prf_cmp_approved_snapshots": ({"compensation_plan_id": "BIGINT", "plan_public_id": "UUID",
        "cycle_public_id": "UUID", "approval_receipt_id": "UUID", "approval_revision": "BIGINT",
        "effective_from": "DATE", "snapshot_revision": "BIGINT", "source_version": "BIGINT",
        "line_count": "INTEGER", "payload_digest": "CHAR(64)", "status": "VARCHAR(40)"},
        ("status", {"PUBLISHED", "SUPERSEDED"})),
    "tme_wfm_forecast_revision_counters": ({"forecast_key": "VARCHAR(160)", "last_revision": "BIGINT"}, None),
    "tme_wfm_demand_lines": ({"demand_forecast_id": "BIGINT", "line_sequence": "INTEGER",
        "interval_start": "TIMESTAMPTZ", "interval_end": "TIMESTAMPTZ",
        "required_headcount": "NUMERIC(12,4)", "demand_unit_code": "VARCHAR(40)",
        "skill_public_id": "UUID", "organization_public_id": "UUID",
        "line_digest": "CHAR(64)"}, None),
    "tme_wfm_constraint_violation_lines": ({"constraint_evaluation_receipt_id": "BIGINT",
        "rule_key": "VARCHAR(160)", "severity": "VARCHAR(40)", "shift_line_key": "VARCHAR(160)",
        "demand_line_key": "VARCHAR(160)", "expected_value": "JSONB", "actual_value": "JSONB"},
        ("severity", {"BLOCKING", "WARNING"})),
    "tme_wfm_fairness_measure_values": ({"constraint_evaluation_receipt_id": "BIGINT",
        "measure_key": "VARCHAR(160)", "measure_value": "JSONB", "accepted_bound": "JSONB",
        "result": "VARCHAR(40)"}, ("result", {"WITHIN_BOUND", "OUTSIDE_BOUND", "UNDEFINED"})),
    "tme_wfm_approval_requests": ({"schedule_candidate_id": "BIGINT", "candidate_revision": "BIGINT",
        "candidate_digest": "CHAR(64)", "constraint_evaluation_receipt_id": "BIGINT",
        "status": "VARCHAR(40)", "approval_case_public_id": "UUID",
        "decision_receipt_public_id": "UUID", "cancellation_receipt_public_id": "UUID"},
        ("status", {"REQUESTED", "ACKNOWLEDGED", "APPROVED", "DENIED", "CANCELLED", "RESULT_UNKNOWN"})),
    "tme_wfm_candidate_shift_lines": ({"schedule_candidate_id": "BIGINT", "demand_forecast_id": "BIGINT",
        "line_key": "VARCHAR(160)", "demand_line_key": "VARCHAR(160)", "worker_public_id": "UUID",
        "assignment_public_id": "UUID", "worksite_public_id": "UUID", "starts_at": "TIMESTAMPTZ",
        "ends_at": "TIMESTAMPTZ", "required_skills": "JSONB", "local_work_date": "DATE",
        "time_zone": "VARCHAR(64)", "tzdb_version": "VARCHAR(64)", "start_offset_seconds": "INTEGER",
        "end_offset_seconds": "INTEGER", "segments": "JSONB", "calendar_snapshot_ref": "JSONB",
        "work_rule_snapshot_ref": "JSONB", "break_duration_seconds": "BIGINT",
        "planning_input_snapshot_id": "UUID"}, None),
    "tme_wfm_optimization_requests": ({"demand_forecast_id": "BIGINT", "input_snapshot_id": "UUID",
        "rule_version": "BIGINT", "deterministic_seed": "VARCHAR(160)", "fairness_evaluation_id": "UUID",
        "availability_snapshot_id": "UUID", "period_start": "TIMESTAMPTZ", "period_end": "TIMESTAMPTZ",
        "request_digest": "CHAR(64)", "requested_at": "TIMESTAMPTZ", "status": "VARCHAR(40)"},
        ("status", {"REQUESTED", "COMPLETED", "FAILED", "CANCELLED"})),
    "tme_wfm_schedule_candidates": ({"optimization_request_id": "BIGINT", "demand_forecast_id": "BIGINT",
        "candidate_revision": "BIGINT", "input_snapshot_id": "UUID", "availability_snapshot_id": "UUID",
        "constraint_policy_version": "BIGINT", "period_start": "TIMESTAMPTZ", "period_end": "TIMESTAMPTZ",
        "candidate_digest": "CHAR(64)", "shift_line_count": "INTEGER", "status": "VARCHAR(40)"},
        ("status", {"GENERATED", "VALIDATED", "VALIDATION_FAILED", "SUBMITTED", "REJECTED",
                    "PUBLISHED", "CANCELLED"})),
    "prf_skl_taxonomy_versions": ({"status": "VARCHAR(40)"},
        ("status", {"DRAFT", "VALIDATED", "PUBLISHED", "RETIRED"})),
    "sys_hris_metric_versions": ({"status": "VARCHAR(40)"},
        ("status", {"DRAFT", "VALIDATED", "PUBLISHED", "RETIRED"})),
    "sys_hris_analytics_export_receipts": ({"purpose_code": "VARCHAR(160)"}, None),
}

INDEPENDENT_ADDITIONAL_REQUIRED_COLUMNS = {
    "ppl_rec_requisitions": {"employment_type": "VARCHAR(40)", "content_digest": "CHAR(64)"},
    "ppl_rec_offers": {"offer_version": "BIGINT", "expires_at": "TIMESTAMPTZ",
                       "compensation_policy_version_id": "UUID", "valid_from": "DATE"},
    "ppl_rec_candidate_cases": {"pending_offer_id": "BIGINT", "last_reason_code": "VARCHAR(80)"},
    "ppl_jny_template_versions": {"effective_from": "DATE", "effective_to": "DATE"},
    "ppl_jny_assignments": {"cancelled_at": "TIMESTAMPTZ"},
    "ppl_wfp_scenarios": {"valid_to": "DATE"},
    "ppl_wfp_scenario_revisions": {"rule_version": "BIGINT", "deterministic_seed": "VARCHAR(160)"},
    "ppl_hrs_cases": {"sensitivity_class": "VARCHAR(40)", "queue_key": "VARCHAR(160)",
                      "sla_policy_version": "BIGINT", "resolution_code": "VARCHAR(80)"},
    "ppl_cwk_engagements": {"submission_digest": "CHAR(64)", "effective_from": "DATE",
                            "offboarded_at": "TIMESTAMPTZ", "closed_at": "TIMESTAMPTZ"},
    "prf_skl_taxonomy_versions": {"validation_suite_version": "BIGINT",
                                  "validation_input_digest": "CHAR(64)",
                                  "effective_from": "DATE", "content_digest": "CHAR(64)"},
    "prf_grw_profiles": {"profile_key": "VARCHAR(160)", "valid_to": "DATE",
                         "last_reason_code": "VARCHAR(80)"},
    "prf_lrn_offerings": {"content_digest": "CHAR(64)"},
    "prf_mkt_opportunities": {"content_digest": "CHAR(64)"},
    "prf_suc_nominations": {"evidence_digest": "CHAR(64)"},
    "prf_suc_plans": {"valid_to": "DATE", "submission_digest": "CHAR(64)",
                      "submission_effective_date": "DATE", "content_digest": "CHAR(64)"},
    "prf_cmp_proposals": {"submission_digest": "CHAR(64)", "effective_from": "DATE"},
    "tme_wfm_constraint_evaluation_receipts": {"validation_suite_version": "BIGINT",
                                                "input_digest": "CHAR(64)",
                                                "policy_version_public_id": "UUID"},
    "tme_wfm_approval_requests": {"submission_digest": "CHAR(64)", "effective_date": "DATE"},
    "tme_wfm_schedule_publish_ledger": {"effective_from": "DATE", "payload_digest": "CHAR(64)"},
    "sys_hris_listening_surveys": {"content_digest": "CHAR(64)", "closed_at": "TIMESTAMPTZ"},
    "sys_hris_listening_actions": {"completion_evidence_digest": "CHAR(64)"},
    "sys_hris_metric_versions": {"validation_suite_version": "BIGINT",
                                 "validation_input_digest": "CHAR(64)"},
    "sys_hris_ai_use_policies": {"suspended_at": "TIMESTAMPTZ"},
}
for _table_name, _columns in INDEPENDENT_ADDITIONAL_REQUIRED_COLUMNS.items():
    _existing_columns, _existing_check = INDEPENDENT_REQUIRED_DELTAS.get(_table_name, ({}, None))
    INDEPENDENT_REQUIRED_DELTAS[_table_name] = ({**_existing_columns, **_columns}, _existing_check)

INDEPENDENT_STATE_SINKS = {
    "modern.onboarding.template.create": ("ppl_jny_template_versions", "status"),
    "modern.onboarding.template.publish": ("ppl_jny_template_versions", "status"),
    "modern.onboarding.task.complete": ("ppl_jny_assignment_tasks", "status"),
    "modern.benefits.plan.create": ("ppl_bnf_plan_versions", "status"),
    "modern.benefits.plan.publish": ("ppl_bnf_plan_versions", "status"),
    "modern.skills.taxonomy.create": ("prf_skl_taxonomy_versions", "status"),
    "modern.skills.taxonomy.validate": ("prf_skl_taxonomy_versions", "status"),
    "modern.skills.taxonomy.publish": ("prf_skl_taxonomy_versions", "status"),
    "modern.analytics.metric.create": ("sys_hris_metric_versions", "status"),
    "modern.analytics.metric.validate": ("sys_hris_metric_versions", "status"),
    "modern.analytics.metric.publish": ("sys_hris_metric_versions", "status"),
}


# Independently reviewed emitted-fact subjects.  These intentionally differ
# from their public command CAS roots; a generator cannot pass by inheriting
# the first write or command root into every event.
INDEPENDENT_EVENT_ROOTS = {
    "CandidateHireHandoffRequested.v2": "ppl_rec_hire_requests",
    "OnboardingJourneyCompleted.v2": "ppl_jny_assignments",
    "CompensationPlanApprovalRecorded.v2": "prf_cmp_plans",
    "ApprovedCompensationPlanSnapshotPublished.v2": "prf_cmp_approved_snapshots",
    "WorkforceScheduleCandidateGenerated.v2": "tme_wfm_schedule_candidates",
}

INDEPENDENT_CRITICAL_EVENT_SOURCES = {
    "CandidateHireHandoffRequested.v2": {
        "aggregateId": "ppl_rec_hire_requests.public_id",
        "hireRequestId": "ppl_rec_hire_requests.public_id",
        "candidateCaseId": "ppl_rec_candidate_cases.public_id",
        "offerId": "ppl_rec_offers.public_id",
        "humanDecisionReceiptId": "ppl_rec_hire_requests.human_decision_receipt_public_id",
    },
    "CandidateHired.v2": {
        "candidateCaseId": "ppl_rec_candidate_cases.public_id",
        "offerId": "ppl_rec_offers.public_id",
        "workerPublicId": "ppl_rec_hire_handoff_receipts.worker_public_id",
        "employmentPublicId": "ppl_rec_hire_handoff_receipts.employment_public_id",
        "assignmentPublicId": "ppl_rec_hire_handoff_receipts.assignment_public_id",
        "hireHandoffReceiptId": "ppl_rec_hire_handoff_receipts.public_id",
    },
    "OnboardingTemplateCreated.v2": {
        "templateVersionId": "ppl_jny_template_versions.public_id",
        "templateId": "ppl_jny_templates.public_id",
        "validFrom": "ppl_jny_template_versions.effective_from",
        "contentDigest": "ppl_jny_template_versions.content_digest",
    },
    "OnboardingTemplatePublished.v2": {
        "templateVersionId": "ppl_jny_template_versions.public_id",
        "templateId": "ppl_jny_templates.public_id",
        "validFrom": "ppl_jny_template_versions.effective_from",
        "contentDigest": "ppl_jny_template_versions.content_digest",
    },
    "OnboardingJourneyCompleted.v2": {
        "aggregateId": "ppl_jny_assignments.public_id",
        "assignmentId": "ppl_jny_assignments.public_id",
        "workerPublicId": "ppl_jny_assignments.worker_public_id",
    },
    "CompensationPlanApprovalRecorded.v2": {
        "aggregateId": "prf_cmp_plans.public_id",
        "planId": "prf_cmp_plans.public_id",
        "cycleId": "prf_cmp_cycles.public_id",
    },
    "ApprovedCompensationPlanSnapshotPublished.v2": {
        "aggregateId": "prf_cmp_approved_snapshots.public_id",
        "snapshotId": "prf_cmp_approved_snapshots.public_id",
        "planId": "prf_cmp_approved_snapshots.plan_public_id",
        "cycleId": "prf_cmp_approved_snapshots.cycle_public_id",
        "lineCount": "prf_cmp_approved_snapshots.line_count",
        "payloadDigest": "prf_cmp_approved_snapshots.payload_digest",
    },
    "WorkforceScheduleCandidateGenerated.v2": {
        "aggregateId": "tme_wfm_schedule_candidates.public_id",
        "candidatePublicId": "tme_wfm_schedule_candidates.public_id",
        "candidateRevision": "tme_wfm_schedule_candidates.candidate_revision",
        "candidateDigest": "tme_wfm_schedule_candidates.candidate_digest",
    },
    "WorkforceSchedulePublished.v2": {
        "candidateRevision": "tme_wfm_schedule_candidates.candidate_revision",
        "candidateDigest": "tme_wfm_schedule_candidates.candidate_digest",
        "payloadDigest": "tme_wfm_schedule_publish_ledger.payload_digest",
    },
}


# Hand-reviewed causal corrections that are intentionally duplicated here
# instead of imported from the builder.  These prevent a re-sealed but
# semantically regressed oracle from certifying the exact defects found during
# the hostile review (parent-state-as-new-root, create-as-update, and immutable
# evidence overwrite).
INDEPENDENT_CAUSAL_CORRECTIONS = {
    "modern.skills.evidence.verify": {
        "root": ("prf_skl_worker_evidence", "status"),
        "transition": (("PENDING",), ("VERIFIED",)),
        "body": {"body.evidenceDigest", "body.sourceRevision", "body.verificationReceiptId", "body.reasonCode"},
        "domain": [("UPDATE_CAS", "prf_skl_worker_evidence")],
        "requiredAssignments": {"prf_skl_worker_evidence": {"status", "verification_receipt_public_id",
                                                               "verification_reason_code", "verified_at"}},
        "forbiddenAssignments": {"prf_skl_worker_evidence": {"evidence_digest", "source_revision",
                                                                "observed_at", "proficiency_level",
                                                                "skill_public_id", "source_key", "worker_public_id"}},
    },
    "modern.learning.offering.create": {
        "root": ("prf_lrn_offerings", "status"),
        "transition": (("NONE",), ("DRAFT",)),
        "body": {"body.businessKey", "body.displayName", "body.effectiveFrom", "body.effectiveTo",
                 "body.providerPublicId"},
        "domain": [("INSERT", "prf_lrn_offerings")],
        "requiredAssignments": {"prf_lrn_offerings": {"offering_code", "display_name", "provider_public_id",
                                                        "valid_from", "status"}},
        "forbiddenAssignments": {},
    },
    "modern.learning.offering.publish": {
        "root": ("prf_lrn_offerings", "status"),
        "transition": (("DRAFT",), ("PUBLISHED",)),
        "domain": [("UPDATE_CAS", "prf_lrn_offerings")],
    },
    "modern.learning.self.enroll": {
        "root": ("prf_lrn_assignments", "status"),
        "transition": (("NONE",), ("ENROLLED",)),
        "body": {"body.offeringId", "body.effectiveFrom", "body.consentRevision", "body.workerPublicId"},
        "domain": [("INSERT", "prf_lrn_assignments")],
        "requiredAssignments": {"prf_lrn_assignments": {"learning_offering_id", "worker_public_id",
                                                          "assigned_at", "assignment_revision", "effective_from",
                                                          "consent_revision", "status"}},
        "requiredSelector": ("body.offeringId", "prf_lrn_offerings", "public_id", "RELATED_PARENT"),
        "forbiddenAssignments": {},
    },
    "modern.learning.completion.verify": {
        "root": ("prf_lrn_assignments", "status"),
        "transition": (("IN_PROGRESS",), ("COMPLETED",)),
        "domain": [("UPDATE_CAS", "prf_lrn_assignments"), ("APPEND", "prf_lrn_completion_evidence")],
        "requiredAssignments": {"prf_lrn_completion_evidence": {"learning_assignment_id", "completion_revision",
                                                                  "source_receipt_id", "source_revision",
                                                                  "evidence_digest", "payload_digest",
                                                                  "completed_at", "verified_at"}},
        "forbiddenAssignments": {},
    },
    "modern.opportunity.apply": {
        "root": ("prf_mkt_applications", "status"),
        "transition": (("NONE",), ("APPLIED",)),
        "body": {"body.consentRevision", "body.applicationStatementDigest", "body.workerPublicId"},
        "domain": [("INSERT", "prf_mkt_applications")],
        "requiredAssignments": {"prf_mkt_applications": {"internal_opportunity_id", "worker_public_id",
                                                           "applied_at", "application_statement_digest",
                                                           "consent_revision", "status"}},
        "requiredSelector": ("pathParameters.opportunityId", "prf_mkt_opportunities", "public_id", "RELATED_PARENT"),
        "forbiddenAssignments": {},
    },
    "modern.benefits.enrollment.decide": {
        "root": ("ppl_bnf_enrollments", "status"),
        "transition": (("SUBMITTED",), ("ACTIVE", "REJECTED")),
        "domain": [("UPDATE_CAS", "ppl_bnf_enrollments")],
    },
}


class Findings:
    def __init__(self) -> None:
        self.rows: list[dict[str, str]] = []

    def add(self, code: str, subject: str, detail: str) -> None:
        self.rows.append({"code": code, "subject": subject, "detail": detail})

    def has(self, code: str) -> bool:
        return any(row["code"] == code for row in self.rows)

    def count(self, prefix: str | None = None) -> int:
        if prefix is None:
            return len(self.rows)
        return sum(row["code"].startswith(prefix) for row in self.rows)


def load(path: Path) -> dict[str, Any]:
    raw = path.read_bytes()
    if raw.startswith(b"\xef\xbb\xbf"):
        raise ValueError(f"BOM forbidden: {path}")
    def pairs(values: list[tuple[str, Any]]) -> dict[str, Any]:
        result: dict[str, Any] = {}
        for key, value in values:
            if key in result:
                raise ValueError(f"duplicate JSON key {key}: {path}")
            result[key] = value
        return result
    def reject_float(value: str) -> None:
        raise ValueError(f"floating/exponent JSON number forbidden ({value}): {path}")
    value = json.loads(raw.decode("utf-8"), object_pairs_hook=pairs,
                       parse_float=reject_float, parse_constant=reject_float)
    if not isinstance(value, dict):
        raise ValueError(f"top-level JSON object required: {path}")
    return value


def canonical_hash(document: dict[str, Any]) -> str:
    payload = {key: value for key, value in document.items() if key != "sealedPayloadSha256"}
    raw = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(raw).hexdigest()


def canonical_value_hash(value: Any) -> str:
    raw = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"),
                     allow_nan=False).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def evidence_core_hash(document: dict[str, Any]) -> str:
    return canonical_value_hash({
        key: copy.deepcopy(value) for key, value in document.items()
        if key not in {"sealedPayloadSha256", "secondReviewer"}
    })


def file_hash(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def check_listening_successor_authority(authority: dict[str, Any]) -> Findings:
    """Validate the canonical-five-derived summary without trusting its writer."""
    findings = Findings()
    if LISTENING_SUCCESSOR_AUTHORITY_PATH.is_symlink():
        findings.add(
            "C-LISTENING-SUCCESSOR-AUTHORITY-FILE",
            LISTENING_SUCCESSOR_AUTHORITY_PATH.name,
            "symlink authority is forbidden",
        )
        return findings
    canonical_file = (
        json.dumps(authority, ensure_ascii=False, sort_keys=True, indent=2) + "\n"
    ).encode("utf-8")
    if LISTENING_SUCCESSOR_AUTHORITY_PATH.read_bytes() != canonical_file:
        findings.add(
            "C-LISTENING-SUCCESSOR-AUTHORITY-FILE",
            LISTENING_SUCCESSOR_AUTHORITY_PATH.name,
            "authority bytes are not canonical JSON with exactly one trailing LF",
        )
    if (
        authority.get("contractId") != LISTENING_SUCCESSOR_AUTHORITY_ID
        or authority.get("schemaVersion") != 1
        or authority.get("ownerSession") != "HRIS-SYS"
        or authority.get("status") != "CANONICAL_G3_START_AUTHORITY_NOT_IMPLEMENTED"
        or authority.get("scope") != "GENERIC_GLOBAL_PRODUCT_CORE_SYS_EMPLOYEE_LISTENING_BOUNDARY"
    ):
        findings.add(
            "C-LISTENING-SUCCESSOR-AUTHORITY-IDENTITY",
            LISTENING_SUCCESSOR_AUTHORITY_PATH.name,
            "identity/version/owner/status/scope drift",
        )
    if canonical_hash(authority) != authority.get("sealedPayloadSha256"):
        findings.add(
            "C-LISTENING-SUCCESSOR-AUTHORITY-SEAL",
            LISTENING_SUCCESSOR_AUTHORITY_PATH.name,
            "sealedPayloadSha256 does not match the canonical payload",
        )

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
        or precedence.get("requiredConsumerBehavior")
        != "RESOLVE_LISTENING_FROM_CANONICAL_FIVE_THEN_VERIFY_THIS_DERIVED_SUMMARY"
        or precedence.get("reverseReferenceFromCanonicalFiveAllowed") is not False
        or "predecessorPins" in precedence
        or "historicalPredecessor" in precedence
    ):
        findings.add(
            "C-LISTENING-SUCCESSOR-PRECEDENCE",
            LISTENING_SUCCESSOR_AUTHORITY_PATH.name,
            "canonical-five-primary/derived-summary precedence drift",
        )

    input_rows = precedence.get("authoritativeInputs", [])
    expected_roles = [row[0] for row in LISTENING_CANONICAL_INPUTS]
    expected_paths = [row[1] for row in LISTENING_CANONICAL_INPUTS]
    if (
        not isinstance(input_rows, list)
        or len(input_rows) != 5
        or [str(row.get("role", "")) for row in input_rows] != expected_roles
        or [str(row.get("path", "")) for row in input_rows] != expected_paths
    ):
        findings.add(
            "C-LISTENING-CANONICAL-INPUT-SET",
            LISTENING_SUCCESSOR_AUTHORITY_PATH.name,
            "expected exact ordered canonical five authoritative inputs",
        )
    else:
        for row, (role, relative, path) in zip(
            input_rows, LISTENING_CANONICAL_INPUTS, strict=True
        ):
            expected_digest = str(row.get("fileSha256", ""))
            if (
                not path.is_file()
                or path.is_symlink()
                or not re.fullmatch(r"[a-f0-9]{64}", expected_digest)
                or file_hash(path) != expected_digest
                or row.get("byteCount") != len(path.read_bytes())
                or row.get("precedence") != "PRIMARY_CANONICAL_INPUT"
            ):
                findings.add(
                    "C-LISTENING-CANONICAL-INPUT",
                    relative,
                    "missing, unsafe, malformed, or stale canonical input",
                )
                continue
            try:
                canonical = load(path)
            except Exception as exc:
                findings.add(
                    "C-LISTENING-CANONICAL-INPUT",
                    relative,
                    f"unreadable canonical input: {type(exc).__name__}:{exc}",
                )
                continue
            marker = canonical.get("listeningCanonicalComposition", {})
            if marker != {
                "designId": LISTENING_STATIC_DESIGN_ID,
                "designSha256": LISTENING_STATIC_DESIGN_DIGEST,
                "role": role,
                "authorityMode": "PRIMARY_CANONICAL_FIVE_ROWS",
                "dependencyDirection": (
                    "STATIC_DESIGN_TO_CANONICAL_FIVE_TO_DERIVED_SUMMARY"
                ),
                "derivedSummaryDependency": "FORBIDDEN",
            }:
                findings.add(
                    "C-LISTENING-CANONICAL-COMPOSITION",
                    relative,
                    "canonical composition marker drift",
                )
            serialized = json.dumps(canonical, ensure_ascii=False, sort_keys=True)
            if any(token in serialized for token in (
                LISTENING_SUCCESSOR_AUTHORITY_ID,
                LISTENING_SUCCESSOR_AUTHORITY_PATH.name,
                "canonicalSuccessorOverlay",
                '"predecessorPins"',
                '"historicalPredecessor"',
            )):
                findings.add(
                    "C-LISTENING-CANONICAL-REVERSE-REFERENCE",
                    relative,
                    "canonical input points to a derived or mutable successor",
                )
    generated = precedence.get("generatedSummary", {})
    if (
        generated.get("sourceDesignId") != LISTENING_STATIC_DESIGN_ID
        or generated.get("sourceDesignSha256")
        != LISTENING_STATIC_DESIGN_DIGEST
        or generated.get("canonicalInputCount") != 5
        or generated.get("activePrecedence")
        != "CANONICAL_FIVE_ROWS_THEN_DERIVED_SUMMARY"
        or generated.get("canonicalInputSetSha256")
        != hashlib.sha256(json.dumps(
            input_rows if isinstance(input_rows, list) else [],
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        ).encode("utf-8")).hexdigest()
    ):
        findings.add(
            "C-LISTENING-CANONICAL-INPUT-SET-DIGEST",
            LISTENING_SUCCESSOR_AUTHORITY_PATH.name,
            "static design or canonical input set digest drift",
        )

    event_rows = authority.get("eventOwnership", {}).get("canonicalPublicEvents", [])
    grouped_events: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in event_rows if isinstance(event_rows, list) else []:
        if isinstance(row, dict):
            grouped_events[str(row.get("eventName", ""))].append(row)
    expected_events = set(LISTENING_SUCCESSOR_PUBLIC_EVENT_STREAMS)
    if set(grouped_events) != expected_events or any(
        len(rows) != 1 for rows in grouped_events.values()
    ):
        findings.add(
            "C-LISTENING-SUCCESSOR-EVENT-SET",
            LISTENING_SUCCESSOR_AUTHORITY_PATH.name,
            f"expected={sorted(expected_events)} got={sorted(grouped_events)}",
        )
    for event_name in expected_events:
        rows = grouped_events.get(event_name, [])
        if len(rows) != 1:
            continue
        row = rows[0]
        if row != {
            "eventName": event_name,
            "streamKey": LISTENING_SUCCESSOR_PUBLIC_EVENT_STREAMS[event_name],
            "payloadClass": LISTENING_SUCCESSOR_PAYLOAD_CLASSES[event_name],
        }:
            findings.add(
                "C-LISTENING-SUCCESSOR-EVENT-CONTRACT",
                event_name,
                str(row),
            )
    event_ownership = authority.get("eventOwnership", {})
    internal_rows = event_ownership.get("internalPortMessages", [])
    internal_names = [
        str(row.get("messageName", ""))
        for row in internal_rows if isinstance(row, dict)
    ] if isinstance(internal_rows, list) else []
    if (
        "EmployeeListeningResponseSubmitted.v2"
        not in set(event_ownership.get("publicBrokerForbidden", []))
        or authority.get("exactCounts", {}).get("canonicalPublicEvents") != 6
        or authority.get("exactCounts", {}).get("internalPortMessages") != 6
        or len(internal_names) != 6
        or set(internal_names) != LISTENING_SUCCESSOR_INTERNAL_MESSAGES
        or "coding-readiness/modern-capability-trace-register.csv"
        not in set(authority.get("requiredCanonicalConsumers", []))
    ):
        findings.add(
            "C-LISTENING-SUCCESSOR-CEREMONY",
            LISTENING_SUCCESSOR_AUTHORITY_PATH.name,
            "raw-response prohibition/event-message count/trace consumer binding drift",
        )
    return findings


def hostile_listening_successor_authority_tests(
    authority: dict[str, Any],
) -> Findings:
    """Prove the narrow overlay cannot be broadened or silently detached."""
    findings = Findings()
    baseline = check_listening_successor_authority(authority)
    if baseline.rows:
        findings.add(
            "SELF-TEST-LISTENING-SUCCESSOR-BASELINE",
            LISTENING_SUCCESSOR_AUTHORITY_PATH.name,
            str(baseline.rows[:5]),
        )
        return findings

    cases: list[tuple[str, str, Any]] = [
        (
            "historical-role-broadened",
            "C-LISTENING-SUCCESSOR-PRECEDENCE",
            lambda doc: doc["canonicalPrecedence"].update(
                {"legacyArtifactRole": "ACTIVE_RUNTIME_INPUT"}
            ),
        ),
        (
            "canonical-input-stale",
            "C-LISTENING-CANONICAL-INPUT",
            lambda doc: doc["canonicalPrecedence"]["authoritativeInputs"][0].update(
                {"fileSha256": "0" * 64}
            ),
        ),
        (
            "mutable-predecessor-pins-restored",
            "C-LISTENING-SUCCESSOR-PRECEDENCE",
            lambda doc: doc["canonicalPrecedence"].update(
                {"predecessorPins": []}
            ),
        ),
        (
            "virtual-historical-predecessor",
            "C-LISTENING-SUCCESSOR-PRECEDENCE",
            lambda doc: doc["canonicalPrecedence"].update(
                {"historicalPredecessor": {"path": "fake.json", "sha256": "0" * 64}}
            ),
        ),
        (
            "canonical-input-set-digest-stale",
            "C-LISTENING-CANONICAL-INPUT-SET-DIGEST",
            lambda doc: doc["canonicalPrecedence"]["generatedSummary"].update(
                {"canonicalInputSetSha256": "0" * 64}
            ),
        ),
        (
            "cohort-version-substituted",
            "C-LISTENING-SUCCESSOR-EVENT-SET",
            lambda doc: next(
                row
                for row in doc["eventOwnership"]["canonicalPublicEvents"]
                if row["eventName"]
                == "EmployeeListeningCohortProjectionPublished.v1"
            ).update({"eventName": "EmployeeListeningCohortProjectionPublished.v2"}),
        ),
        (
            "raw-response-broker-reenabled",
            "C-LISTENING-SUCCESSOR-CEREMONY",
            lambda doc: doc["eventOwnership"]["publicBrokerForbidden"].remove(
                "EmployeeListeningResponseSubmitted.v2"
            ),
        ),
    ]
    for name, expected_code, mutate in cases:
        candidate = copy.deepcopy(authority)
        try:
            mutate(candidate)
            candidate["sealedPayloadSha256"] = canonical_hash(candidate)
            result = check_listening_successor_authority(candidate)
        except Exception as exc:
            findings.add(
                "SELF-TEST-LISTENING-SUCCESSOR-CRASH",
                name,
                f"{type(exc).__name__}:{exc}",
            )
            continue
        if not result.has(expected_code):
            findings.add(
                "SELF-TEST-LISTENING-SUCCESSOR-FALSE-PASS",
                name,
                f"expected={expected_code} got={sorted({row['code'] for row in result.rows})}",
            )
    return findings


def atomic_write_text(path: Path, payload: str) -> None:
    """Publish reports as one filesystem replacement, never as partial JSON."""
    if ACTIVE_PROFILE == SUCCESSOR_PROFILE:
        create_only_text(path, payload)
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    try:
        with temporary.open("w", encoding="utf-8") as stream:
            stream.write(payload)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def flatten_strings(value: Any) -> Iterable[str]:
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for child in value.values():
            yield from flatten_strings(child)
    elif isinstance(value, list):
        for child in value:
            yield from flatten_strings(child)


def contains_reviewed(expected: Any, actual: Any) -> bool:
    """True only when every reviewer-owned value is preserved exactly.

    Candidate-only explanatory metadata may be added, but it cannot replace or
    weaken any nested reviewer decision.
    """
    if isinstance(expected, dict):
        return isinstance(actual, dict) and all(
            key in actual and contains_reviewed(value, actual[key]) for key, value in expected.items()
        )
    if isinstance(expected, list):
        return isinstance(actual, list) and expected == actual
    return expected == actual


def load_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8", newline="") as stream:
        return list(csv.DictReader(stream))


def pipe_values(value: Any) -> set[str]:
    return {item for item in str(value or "").split("|") if item}


def unique_row(
    rows: Any, key: str, value: str, findings: Findings, subject: str,
) -> dict[str, Any]:
    matches = [row for row in rows if isinstance(row, dict) and row.get(key) == value] \
        if isinstance(rows, list) else []
    if len(matches) != 1:
        findings.add("C-COMP-V2-CARDINALITY", subject,
                     f"expected one {key}={value}, got={len(matches)}")
        return {}
    return matches[0]


def load_compensation_v2_cross_authority_state(
    event_registry: dict[str, Any], lineage: dict[str, Any],
    ownership_rows: list[dict[str, str]],
) -> dict[str, Any]:
    """Read the active PER->PAY boundary without importing its producer validator."""
    return {
        "dependency": load_csv(DEPENDENCY_REGISTER_PATH),
        "xcon": load_csv(XCON_REGISTER_PATH),
        "binding": load_csv(XCON_BINDING_REGISTER_PATH),
        "schema": load(XCON_SCHEMA_PATH),
        "trace": load_csv(TRACE_REGISTER_PATH),
        "slices": load_csv(SLICE_REGISTER_PATH),
        "per": load(PER_MODERN_CONTRACT_PATH),
        "pay": load(PAY_MODERN_CONSUMER_PATH),
        "events": event_registry,
        "lineage": lineage,
        "ownership": ownership_rows,
    }


def check_compensation_v2_cross_authority_state(state: dict[str, Any]) -> Findings:
    """Independently enforce the post-snapshot-commit v2-only PAY trigger.

    The dedicated central validator is useful corroboration, but it is not an
    authority imported by this check.  These decisions are duplicated here so
    replacing or weakening that validator cannot make the independent design
    review pass.
    """
    findings = Findings()
    lineage = unique_row(
        state.get("lineage", {}).get("lineage", []), "predecessorEvent",
        COMPENSATION_PREDECESSOR, findings, "lineage.CompensationPlanApproved.v1",
    )
    if (
        lineage.get("disposition") != "SUPERSEDED"
        or lineage.get("successorEvents") != [COMPENSATION_EVENT_V2]
        or lineage.get("runtimeDualPublish", {}).get("required") is not False
        or lineage.get("consumerMigration", {}).get("orphanConsumerCount") != 0
    ):
        findings.add(
            "C-COMP-V2-LINEAGE", COMPENSATION_PREDECESSOR,
            "must be historical-only, single-successor v2, no dual publish/orphans",
        )
    successor_rows = lineage.get("successorContracts", [])
    successor = successor_rows[0] if isinstance(successor_rows, list) and len(successor_rows) == 1 else {}
    if (
        successor.get("eventName") != COMPENSATION_EVENT_V2
        or successor.get("producerOperationId") != "modern.compplan.snapshot.publish"
        or successor.get("producerSession") != "HRIS-PER"
        or set(successor.get("payloadFields", [])) != COMPENSATION_EVENT_FIELDS
        or set(successor.get("requiredPayloadFields", [])) != COMPENSATION_EVENT_FIELDS
        or set(successor.get("allowedConsumerSessions", [])) != {"HRIS-PER", "HRIS-PAY"}
        or successor.get("pep") != "SVC-PEP-PER-001"
    ):
        findings.add("C-COMP-V2-SUCCESSOR", COMPENSATION_EVENT_V2,
                     "lineage successor producer/fields/audience/PEP drift")

    event_rows = state.get("events", {}).get("eventPayloadSchemas", [])
    event = unique_row(event_rows, "eventName", COMPENSATION_EVENT_V2,
                       findings, "eventPayloadSchemas")
    delivery = event.get("deliveryPolicy", {})
    if (
        event.get("capabilityId") != COMPENSATION_CAPABILITY
        or event.get("session") != "HRIS-PER"
        or event.get("schemaVersion") != 2
        or {row.get("name") for row in event.get("fields", [])} != COMPENSATION_EVENT_FIELDS
        or event.get("emittedByOperationIds") != ["modern.compplan.snapshot.publish"]
        or set(delivery.get("fieldAllowlist", [])) != COMPENSATION_EVENT_FIELDS
        or set(delivery.get("allowedConsumerSessions", [])) != {"HRIS-PER", "HRIS-PAY"}
        or delivery.get("denyUnknownConsumerOrPurpose") is not True
    ):
        findings.add("C-COMP-V2-EVENT", COMPENSATION_EVENT_V2,
                     "v2 payload/source/audience closed contract drift")

    dependency = unique_row(state.get("dependency"), "dependency_id", "DEP-019",
                            findings, "DEP-019")
    if (
        dependency.get("producer") != "PER"
        or dependency.get("consumer") != "PAY"
        or dependency.get("delivery_mode") != "SNAPSHOT_AND_EVENT"
        or pipe_values(dependency.get("contract"))
        != {COMPENSATION_SNAPSHOT, COMPENSATION_EVENT_V2}
        or COMPENSATION_PREDECESSOR in str(dependency)
    ):
        findings.add("C-COMP-V2-DEPENDENCY", "DEP-019",
                     "must expose snapshot v1 plus post-commit event v2 only")

    xcon = unique_row(state.get("xcon"), "contract_id", "XCON-021",
                      findings, "XCON-021")
    if (
        xcon.get("dependency_id") != "DEP-019"
        or xcon.get("contract_kind") != "EVENT"
        or xcon.get("canonical_name") != COMPENSATION_EVENT_V2
        or xcon.get("producer_session") != "HRIS-PER"
        or pipe_values(xcon.get("consumer_sessions")) != {"HRIS-PAY"}
        or pipe_values(xcon.get("required_fields")) != COMPENSATION_EVENT_FIELDS
        or xcon.get("producer_evidence")
        != "../session-evidence/per/g3-modern-capability-contracts.v2.json"
        or xcon.get("consumer_evidence")
        != "../session-evidence/pay/g3-modern-capability-consumer-contracts.v1.json"
        or COMPENSATION_PREDECESSOR in str(xcon)
    ):
        findings.add("C-COMP-V2-XCON", "XCON-021",
                     "producer/consumer/name/fields/evidence drift")

    binding = unique_row(state.get("binding"), "contract_id", "XCON-021",
                         findings, "XSC-021")
    expected_import = (
        "com.dwp.contracts.hris.xcon.v1."
        "Xcon021ApprovedCompensationPlanSnapshotPublishedV2"
    )
    if (
        binding.get("binding_id") != "XSC-021"
        or binding.get("dependency_id") != "DEP-019"
        or binding.get("canonical_name") != COMPENSATION_EVENT_V2
        or binding.get("canonical_generated_import") != expected_import
        or binding.get("producer_generated_import") != expected_import
        or binding.get("consumer_generated_imports") != f"HRIS-PAY:{expected_import}"
        or binding.get("producer_evidence_required_ref")
        != "../session-evidence/per/g3-modern-capability-contracts.v2.json#/capabilities/5/events/4/payloadRequired"
        or binding.get("consumer_evidence_required_refs")
        != "HRIS-PAY:../session-evidence/pay/g3-modern-capability-consumer-contracts.v1.json#/consumedModernCapabilities/0/invalidationEvent/payloadRequired"
        or COMPENSATION_PREDECESSOR in str(binding)
    ):
        findings.add("C-COMP-V2-BINDING", "XSC-021",
                     "generated type/evidence binding is not v2-only")

    schema = state.get("schema", {}).get("$defs", {}).get("XCON_021", {})
    if (
        schema.get("title") != COMPENSATION_EVENT_V2
        or set(schema.get("properties", {})) != COMPENSATION_EVENT_FIELDS
        or set(schema.get("required", [])) != COMPENSATION_EVENT_FIELDS
        or schema.get("additionalProperties") is not False
        or schema.get("x-causal-contract") != {
            "emission": "POST_SNAPSHOT_HEADER_AND_ALL_ORDERED_LINES_COMMIT",
            "runtimeVersion": "V2_ONLY",
            "dualPublish": "FORBIDDEN",
            "payTrigger": "THIS_EVENT_ONLY",
        }
    ):
        findings.add("C-COMP-V2-SCHEMA", "#/$defs/XCON_021",
                     "closed 16-field post-commit v2 schema drift")

    expected_comp_events = {
        "ApprovedCompensationPlanSnapshotPublished.v2",
        "CompensationBudgetAllocated.v2", "CompensationCycleCreated.v2",
        "CompensationPlanApprovalRecorded.v2", "CompensationProposalSubmitted.v2",
    }
    trace_rows = state.get("trace", [])
    trace = unique_row(trace_rows, "capability_id", COMPENSATION_CAPABILITY,
                       findings, "modern-capability-trace-register")
    trace_event_refs = {
        item for item in pipe_values(trace.get("api_event_contracts"))
        if not item.startswith("/")
    }
    all_trace_event_refs = {
        item for row in trace_rows for item in pipe_values(row.get("api_event_contracts"))
        if not item.startswith("/")
    } if isinstance(trace_rows, list) else set()
    if (
        len(trace_rows) != 16
        or trace_event_refs != expected_comp_events
        or any(not item.endswith(".v2") for item in trace_event_refs)
        or all_trace_event_refs != INDEPENDENT_ACTIVE_TRACE_CONTRACTS
        or COMPENSATION_PREDECESSOR in all_trace_event_refs
    ):
        findings.add("C-COMP-V2-TRACE", COMPENSATION_CAPABILITY,
                     "compensation is not v2-only or the 16-capability trace does not close to 86 public events plus 6 listening port messages")

    per_capability = unique_row(
        state.get("per", {}).get("capabilities", []), "capabilityId",
        COMPENSATION_CAPABILITY, findings, "PER compensation producer",
    )
    per_event = unique_row(per_capability.get("events", []), "name", COMPENSATION_EVENT_V2,
                           findings, "PER compensation event")
    snapshot_operation = unique_row(
        per_capability.get("operations", []), "operationId",
        "modern.compplan.snapshot.publish", findings, "PER snapshot publish operation",
    )
    if (
        per_event.get("version") != 2
        or set(per_event.get("payloadRequired", [])) != COMPENSATION_EVENT_FIELDS
        or per_event.get("emissionCondition") != "ALWAYS"
        or snapshot_operation.get("emits") != [COMPENSATION_EVENT_V2]
        or any(COMPENSATION_PREDECESSOR in operation.get("emits", [])
               for operation in per_capability.get("operations", []))
    ):
        findings.add("C-COMP-V2-PRODUCER", "HRIS-PER",
                     "only snapshot.publish may emit the exact v2 event")

    pay_consumers = state.get("pay", {}).get("consumedModernCapabilities", [])
    pay = unique_row(pay_consumers, "capabilityId", COMPENSATION_CAPABILITY,
                     findings, "PAY compensation consumer")
    pay_event = pay.get("invalidationEvent", {})
    action = str(pay_event.get("consumerAction", ""))
    if (
        pay.get("producerSession") != "HRIS-PER"
        or pay.get("dependencyId") != "DEP-019"
        or pay_event.get("name") != COMPENSATION_EVENT_V2
        or pay_event.get("version") != 2
        or set(pay_event.get("payloadRequired", [])) != COMPENSATION_EVENT_FIELDS
        or "snapshotId and snapshotRevision" not in action
        or "dual publish is forbidden" not in action
    ):
        findings.add("C-COMP-V2-CONSUMER", "HRIS-PAY",
                     "PAY must dedupe v2 and refetch exact snapshot revision")

    owner_rows = state.get("ownership", [])
    owner_kind_counts = Counter(row.get("contract_kind", "") for row in owner_rows)
    expected_kind_counts = {
        "PUBLIC_PEP": 175, "INTERNAL_SERVICE_PEP": 11, "XCON_PRODUCER": 21,
        "SYS_G2_CONTRACT": 84, "BASE_EVENT": 48, "MODERN_OPERATION": 100,
        "MODERN_EVENT": 86,
    }
    predecessor_names = {
        row.get("predecessorEvent")
        for row in state.get("lineage", {}).get("lineage", [])
        if isinstance(row, dict)
    }
    v2_owner = [row for row in owner_rows if row.get("contract_id") == COMPENSATION_EVENT_V2]
    residual = [row for row in owner_rows if row.get("contract_kind") == "BASE_EVENT"
                and row.get("contract_id", "").partition(":")[2] in predecessor_names]
    if (
        len(owner_rows) != 525 or dict(owner_kind_counts) != expected_kind_counts
        or residual or len(v2_owner) != 1
        or v2_owner[0].get("contract_kind") != "MODERN_EVENT"
        or v2_owner[0].get("owner_session") != "HRIS-PER"
        or v2_owner[0].get("primary_slice_id") != "MOD-PER-COMPPLAN"
    ):
        findings.add("C-COMP-V2-OWNERSHIP", "primary ownership",
                     f"rows={len(owner_rows)} kinds={dict(owner_kind_counts)} residual={len(residual)}")

    active_slices = [row for row in state.get("slices", [])
                     if row.get("gate_status") == "OPEN_G3_CODE"]
    active_fields = (
        "api_event_contract_refs", "primary_contract_refs", "related_contract_refs",
        "produced_xcon_refs", "consumed_xcon_refs",
    )
    active_refs = {
        item for row in active_slices for field in active_fields
        for item in pipe_values(row.get(field))
    }
    primary_slices = [row.get("slice_id") for row in active_slices
                      if COMPENSATION_EVENT_V2 in pipe_values(row.get("primary_contract_refs"))]
    if (
        COMPENSATION_PREDECESSOR in active_refs
        or f"EVT-PER:{COMPENSATION_PREDECESSOR}" in active_refs
        or primary_slices != ["MOD-PER-COMPPLAN"]
    ):
        findings.add("C-COMP-V2-SLICE", "active G3 slices",
                     f"primary={primary_slices} predecessorActive={COMPENSATION_PREDECESSOR in active_refs}")
    return findings


def check_compensation_v2_cross_authority(
    event_registry: dict[str, Any], lineage: dict[str, Any],
    ownership_rows: list[dict[str, str]],
) -> Findings:
    findings = Findings()
    required = (
        DEPENDENCY_REGISTER_PATH, XCON_REGISTER_PATH, XCON_BINDING_REGISTER_PATH,
        XCON_SCHEMA_PATH, TRACE_REGISTER_PATH, SLICE_REGISTER_PATH,
        PER_MODERN_CONTRACT_PATH, PAY_MODERN_CONSUMER_PATH,
    )
    missing = [str(path) for path in required if not path.is_file() or path.is_symlink()]
    if missing:
        findings.add("C-COMP-V2-AUTHORITY-FILE", "cross-authority", str(missing))
        return findings
    try:
        state = load_compensation_v2_cross_authority_state(
            event_registry, lineage, ownership_rows,
        )
        findings.rows.extend(check_compensation_v2_cross_authority_state(state).rows)
    except (OSError, ValueError, KeyError, TypeError, json.JSONDecodeError) as exc:
        findings.add("C-COMP-V2-AUTHORITY-READ", "cross-authority",
                     f"{type(exc).__name__}:{exc}")
    return findings


def hostile_compensation_v2_cross_authority_tests(
    event_registry: dict[str, Any], lineage: dict[str, Any],
    ownership_rows: list[dict[str, str]],
) -> Findings:
    findings = Findings()
    try:
        baseline = load_compensation_v2_cross_authority_state(
            event_registry, lineage, ownership_rows,
        )
    except (OSError, ValueError, KeyError, TypeError, json.JSONDecodeError) as exc:
        findings.add("SELF-TEST-COMP-V2-BASELINE", "cross-authority",
                     f"{type(exc).__name__}:{exc}")
        return findings
    baseline_findings = check_compensation_v2_cross_authority_state(baseline)
    if baseline_findings.rows:
        findings.add("SELF-TEST-COMP-V2-BASELINE", "cross-authority",
                     str(baseline_findings.rows[:5]))
        return findings

    def row(state: dict[str, Any], group: str, key: str, value: str) -> dict[str, Any]:
        return next(item for item in state[group] if item.get(key) == value)

    cases: list[tuple[str, str, Any]] = [
        (
            "dependency-predecessor-reactivation", "C-COMP-V2-DEPENDENCY",
            lambda state: row(state, "dependency", "dependency_id", "DEP-019").update({
                "contract": f"{COMPENSATION_SNAPSHOT}|{COMPENSATION_PREDECESSOR}",
            }),
        ),
        (
            "lineage-dual-publish", "C-COMP-V2-LINEAGE",
            lambda state: next(item for item in state["lineage"]["lineage"]
                               if item["predecessorEvent"] == COMPENSATION_PREDECESSOR)
            ["runtimeDualPublish"].update({"required": True}),
        ),
        (
            "xcon-predecessor", "C-COMP-V2-XCON",
            lambda state: row(state, "xcon", "contract_id", "XCON-021").update({
                "canonical_name": COMPENSATION_PREDECESSOR,
            }),
        ),
        (
            "binding-predecessor", "C-COMP-V2-BINDING",
            lambda state: row(state, "binding", "contract_id", "XCON-021").update({
                "canonical_name": COMPENSATION_PREDECESSOR,
            }),
        ),
        (
            "schema-predecessor", "C-COMP-V2-SCHEMA",
            lambda state: state["schema"]["$defs"]["XCON_021"].update({
                "title": COMPENSATION_PREDECESSOR,
            }),
        ),
        (
            "trace-predecessor", "C-COMP-V2-TRACE",
            lambda state: row(state, "trace", "capability_id", COMPENSATION_CAPABILITY).update({
                "api_event_contracts": row(
                    state, "trace", "capability_id", COMPENSATION_CAPABILITY,
                )["api_event_contracts"].replace(
                    COMPENSATION_EVENT_V2, COMPENSATION_PREDECESSOR,
                ),
            }),
        ),
        (
            "pay-predecessor", "C-COMP-V2-CONSUMER",
            lambda state: state["pay"]["consumedModernCapabilities"][0]
            ["invalidationEvent"].update({"name": COMPENSATION_PREDECESSOR}),
        ),
        (
            "producer-required-field", "C-COMP-V2-PRODUCER",
            lambda state: next(event for capability in state["per"]["capabilities"]
                               if capability["capabilityId"] == COMPENSATION_CAPABILITY
                               for event in capability["events"]
                               if event["name"] == COMPENSATION_EVENT_V2)
            ["payloadRequired"].remove("snapshotRevision"),
        ),
        (
            "ownership-predecessor", "C-COMP-V2-OWNERSHIP",
            lambda state: state["ownership"].append({
                "contract_id": f"EVT-PER:{COMPENSATION_PREDECESSOR}",
                "contract_kind": "BASE_EVENT", "owner_session": "HRIS-PER",
                "primary_slice_id": "MOD-PER-COMPPLAN",
                "source_semantic_ref": f"EVT-PER:{COMPENSATION_PREDECESSOR}",
                "source_register_ref": f"G2_EVENT_CONTRACT#EVT-PER:{COMPENSATION_PREDECESSOR}",
                "rationale": "TARGET_FAMILY_SEMANTIC_OWNER",
                "status": "SEALED_G3_PRIMARY_OWNER",
            }),
        ),
    ]
    for name, expected_code, mutate in cases:
        state = copy.deepcopy(baseline)
        try:
            mutate(state)
            result = check_compensation_v2_cross_authority_state(state)
        except Exception as exc:
            findings.add("SELF-TEST-COMP-V2-CRASH", name,
                         f"{type(exc).__name__}:{exc}")
            continue
        if not result.has(expected_code):
            findings.add("SELF-TEST-COMP-V2-FALSE-PASS", name,
                         f"expected={expected_code} got={sorted({item['code'] for item in result.rows})}")
    return findings


def ddl_path(relative: str) -> Path:
    return (ROOT / relative).resolve()


def extract_create_table(sql: str, table: str) -> str:
    match = re.search(
        rf"\bCREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+{re.escape(table)}\s*\(",
        sql, re.I,
    )
    if not match:
        raise ValueError(f"missing physical CREATE TABLE {table}")
    start, index, depth, quote_mark = match.start(), match.end() - 1, 0, None
    while index < len(sql):
        char = sql[index]
        if quote_mark:
            if char == quote_mark:
                if index + 1 < len(sql) and sql[index + 1] == quote_mark:
                    index += 1
                else:
                    quote_mark = None
        elif char in {"'", '"'}:
            quote_mark = char
        elif char == "(":
            depth += 1
        elif char == ")":
            depth -= 1
            if depth == 0:
                semicolon = sql.find(";", index)
                if semicolon < 0:
                    raise ValueError(f"unterminated CREATE TABLE {table}")
                return sql[start:semicolon + 1]
        index += 1
    raise ValueError(f"unterminated CREATE TABLE {table}")


def parse_ddl_columns(statement: str) -> dict[str, dict[str, Any]]:
    columns: dict[str, dict[str, Any]] = {}
    for line in statement.splitlines()[1:]:
        stripped = line.strip().rstrip(",")
        if not stripped or stripped.upper().startswith(
                ("CONSTRAINT ", "PRIMARY ", "UNIQUE ", "FOREIGN ", "CHECK ")):
            continue
        match = re.match(r"([a-z][a-z0-9_]*)\s+(.+)$", stripped, re.I)
        if not match:
            continue
        name, remainder = match.groups()
        type_match = TRANSACTION_SQL_TYPES.match(remainder)
        if not type_match:
            continue
        sql_type = re.sub(r"\s+", "", type_match.group(1).upper())
        generated = sql_type == "BIGSERIAL" or "GENERATED " in remainder.upper()
        if sql_type == "BIGSERIAL":
            sql_type = "BIGINT"
        tail = remainder[type_match.end():]
        columns[name] = {
            "sqlType": sql_type,
            "nullable": "NOT NULL" not in tail.upper() and "PRIMARY KEY" not in tail.upper(),
            "default": generated or bool(re.search(r"\bDEFAULT\b", tail, re.I)),
        }
    return columns


def load_physical_transaction_contracts(
) -> tuple[dict[str, dict[str, dict[str, Any]]], dict[str, str]]:
    source_sql: dict[str, str] = {}
    for key, source in BASE_TRANSACTION_DDL.items():
        path = ddl_path(source["path"])
        if not path.is_file() or file_hash(path) != source["sha256"]:
            raise ValueError(f"checked-in DDL pin mismatch {key}:{path}")
        source_sql[key] = path.read_text(encoding="utf-8")
    tables: dict[str, dict[str, dict[str, Any]]] = {}
    statements: dict[str, str] = {}
    for profile in PHYSICAL_TRANSACTION_PROFILES.values():
        for role in ("receiptTable", "outboxTable", "inboxTable"):
            table = profile[role]
            matches: list[str] = []
            for key in profile["ddlKeys"]:
                try:
                    matches.append(extract_create_table(source_sql[key], table))
                except ValueError:
                    pass
            if len(matches) != 1:
                raise ValueError(f"{table}: expected exactly one checked-in CREATE TABLE, got {len(matches)}")
            statements[table] = matches[0]
            tables[table] = parse_ddl_columns(matches[0])
            if not tables[table]:
                raise ValueError(f"{table}: physical column parser returned empty set")
    if len(tables) != 12:
        raise ValueError(f"expected 12 distinct physical transaction tables, got {len(tables)}")
    for session, profile in PHYSICAL_TRANSACTION_PROFILES.items():
        function_name, trigger_name = profile["guard"]
        owner_sql = "\n".join(source_sql[key] for key in profile["ddlKeys"])
        if not re.search(rf"\bCREATE\s+OR\s+REPLACE\s+FUNCTION\s+{re.escape(function_name)}\s*\(\)", owner_sql, re.I):
            raise ValueError(f"{session}: checked-in receipt guard function missing")
        if not re.search(rf"\bCREATE\s+TRIGGER\s+{re.escape(trigger_name)}\b", owner_sql, re.I):
            raise ValueError(f"{session}: checked-in receipt guard trigger missing")
    return tables, statements


def assignment_index(step: dict[str, Any]) -> dict[str, str]:
    rows = step.get("assignments", [])
    if not isinstance(rows, list):
        return {}
    return {str(row.get("column")): str(row.get("sourcePath")) for row in rows}


def expanded_profile_assignments(
    template: dict[str, Any], target: dict[str, Any], event: dict[str, Any] | None = None,
) -> dict[str, str]:
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
    result: dict[str, str] = {}
    for column, raw in template.items():
        source = str(raw)
        for token, value in replacements.items():
            source = source.replace(token, value)
        result[str(column)] = source
    return result


def check_physical_transaction_infrastructure(
    oracle: dict[str, Any], candidate: dict[str, Any], ssot: dict[str, Any], findings: Findings,
) -> None:
    try:
        physical, _ = load_physical_transaction_contracts()
    except (OSError, ValueError) as exc:
        findings.add("C-TRANSACTION-PHYSICAL-DDL", "baseDdlSources", str(exc))
        return
    reviewed = oracle.get("transactionInfrastructure", {})
    if reviewed.get("baseDdlSources") != BASE_TRANSACTION_DDL or reviewed.get("expectedPhysicalTableCount") != 12:
        findings.add("C-TRANSACTION-REVIEW-AUTHORITY", "oracle.transactionInfrastructure",
                     "reviewer physical DDL source set/count drift")
    reviewed_sessions = reviewed.get("sessions", {})
    for session, expected in PHYSICAL_TRANSACTION_PROFILES.items():
        row = reviewed_sessions.get(session, {})
        if any(row.get(key) != expected[key] for key in ("receiptTable", "outboxTable", "inboxTable")):
            findings.add("C-TRANSACTION-REVIEW-PROFILE", session, str(row))
        result_name, result_type = expected["resultColumn"]
        if row.get("resultColumn") != {"name": result_name, "sqlType": result_type}:
            findings.add("C-TRANSACTION-REVIEW-RESULT-TYPE", session, str(row.get("resultColumn")))
        physical_result = physical.get(expected["receiptTable"], {}).get(result_name, {})
        if physical_result.get("sqlType") != result_type:
            findings.add("C-TRANSACTION-PHYSICAL-RESULT-TYPE", session, str(physical_result))

    infrastructure = candidate.get("transactionInfrastructure", {})
    if infrastructure != ssot.get("transactionInfrastructure"):
        findings.add("C-TRANSACTION-SSOT-PROJECTION", "transactionInfrastructure",
                     "causal projection differs from frozen operation SSOT")
    expected_paths = {key: value["path"] for key, value in BASE_TRANSACTION_DDL.items()}
    if (infrastructure.get("policy") !=
            "USE_EXISTING_OWNER_RECEIPT_AND_OUTBOX_PHYSICAL_DDL_WITH_OPERATION_SCOPED_EXACT_ASSIGNMENTS"
            or infrastructure.get("baseDdlSources") != expected_paths):
        findings.add("C-TRANSACTION-INFRASTRUCTURE", "transactionInfrastructure",
                     "policy or checked-in DDL source closed set differs")
    profiles = infrastructure.get("sessions", {})
    if set(profiles) != set(PHYSICAL_TRANSACTION_PROFILES):
        findings.add("C-TRANSACTION-PROFILE-CLOSED-SET", "sessions", str(sorted(profiles)))
        return
    for session, expected in PHYSICAL_TRANSACTION_PROFILES.items():
        profile = profiles[session]
        for key in ("receiptTable", "outboxTable", "inboxTable"):
            if profile.get(key) != expected[key]:
                findings.add("C-TRANSACTION-PROFILE-TABLE", f"{session}:{key}", str(profile.get(key)))
        receipt = expected["receiptTable"]
        decision_expected = {
            "ruleId": f"{receipt}.originating_action",
            "inputDigestOrRef": f"{receipt}.{expected['digestColumn']}",
            "outcome": "+".join(f"{receipt}.{column}" for column in expected["statusColumns"]),
            "decisionVersion": f"{receipt}.authorization_revision+{receipt}.field_policy_revision",
        }
        if profile.get("decisionAuditBindings") != decision_expected:
            findings.add("C-DECISION-PHYSICAL-BINDINGS", session,
                         f"expected={decision_expected} got={profile.get('decisionAuditBindings')}")
        for assignment_key, table_key in (
            ("receiptClaimAssignments", "receiptTable"),
            ("receiptCompleteAssignments", "receiptTable"),
            ("outboxAssignments", "outboxTable"),
            ("inboxClaimAssignments", "inboxTable"),
            ("inboxCompleteAssignments", "inboxTable"),
        ):
            assignments = profile.get(assignment_key)
            if assignments is None:
                continue
            table = expected[table_key]
            unknown = set(assignments) - set(physical.get(table, {}))
            if unknown:
                findings.add("C-TRANSACTION-ASSIGNMENT-PHYSICAL", f"{session}:{assignment_key}",
                             f"{table}:{sorted(unknown)}")
            if assignment_key in {"receiptClaimAssignments", "outboxAssignments", "inboxClaimAssignments"}:
                required = {name for name, spec in physical.get(table, {}).items()
                            if spec["nullable"] is False and not spec["default"]}
                if not required <= set(assignments):
                    findings.add("C-TRANSACTION-ASSIGNMENT-REQUIRED", f"{session}:{assignment_key}",
                                 f"{table}:{sorted(required-set(assignments))}")

    operation_rows = candidate.get("operations", [])
    for operation in operation_rows:
        operation_id = str(operation.get("operationId"))
        if operation.get("mode") != "COMMAND":
            if operation.get("transactionEnvelope"):
                findings.add("C-QUERY-TRANSACTION-ENVELOPE", operation_id, "query has command envelope")
            continue
        session = operation.get("session")
        profile = profiles.get(session, {})
        envelope = operation.get("transactionEnvelope", {})
        steps = envelope.get("steps", [])
        ordered = operation.get("orderedDml", [])
        if (envelope.get("operationBinding") != operation_id
                or envelope.get("sameTransaction") is not True
                or len(steps) != len(ordered) + 3
                or [step.get("step") for step in steps] != list(range(1, len(steps) + 1))):
            findings.add("C-COMMAND-TX-ENVELOPE-PHYSICAL", operation_id, "step count/order/binding differs")
            continue
        if (steps[0].get("stage") != "CLAIM_OR_REPLAY_COMMAND_RECEIPT"
                or steps[-2].get("stage") != "COMPLETE_COMMAND_RECEIPT"
                or steps[-1].get("stage") != "APPEND_CAUSAL_OUTBOX_LAST"
                or steps[0].get("table") != profile.get("receiptTable")
                or steps[-2].get("table") != profile.get("receiptTable")
                or steps[-1].get("table") != profile.get("outboxTable")):
            findings.add("C-COMMAND-TX-ORDER-PHYSICAL", operation_id, "receipt/domain/outbox boundary differs")
        expected_maps = (
            expanded_profile_assignments(profile.get("receiptClaimAssignments", {}), operation),
            expanded_profile_assignments(profile.get("receiptCompleteAssignments", {}), operation),
            expanded_profile_assignments(profile.get("outboxAssignments", {}), operation),
        )
        for step, expected_map, code in (
            (steps[0], expected_maps[0], "CLAIM"),
            (steps[-2], expected_maps[1], "COMPLETE"),
            (steps[-1], expected_maps[2], "OUTBOX"),
        ):
            actual_map = assignment_index(step)
            table = str(step.get("table"))
            if actual_map != expected_map:
                findings.add("C-COMMAND-TX-ASSIGNMENT", f"{operation_id}:{code}",
                             f"expected={expected_map} got={actual_map}")
            if set(actual_map) - set(physical.get(table, {})):
                findings.add("C-COMMAND-TX-PHANTOM-COLUMN", f"{operation_id}:{code}",
                             str(sorted(set(actual_map)-set(physical.get(table, {})))))
        for dml, step in zip(ordered, steps[1:-2]):
            if (step.get("stage") != "DOMAIN_DML" or step.get("table") != dml.get("table")
                    or step.get("disposition") != dml.get("disposition")
                    or step.get("assignments") != dml.get("assignments")):
                findings.add("C-COMMAND-TX-DOMAIN-BINDING", operation_id, str(step))

    for handler in candidate.get("internalConsumerHandlers", []):
        handler_id = str(handler.get("handlerId"))
        profile = profiles.get(handler.get("session"), {})
        envelope = handler.get("transactionEnvelope", {})
        steps, ordered = envelope.get("steps", []), handler.get("orderedDml", [])
        if (envelope.get("operationBinding") != handler_id or envelope.get("sameTransaction") is not True
                or len(steps) != len(ordered) + 3
                or [step.get("step") for step in steps] != list(range(1, len(steps) + 1))):
            findings.add("C-HANDLER-TX-ENVELOPE-PHYSICAL", handler_id, "step count/order/binding differs")
            continue
        event = handler.get("eventContract", {})
        expected_maps = (
            expanded_profile_assignments(profile.get("inboxClaimAssignments", {}), handler, event),
            expanded_profile_assignments(profile.get("inboxCompleteAssignments", {}), handler, event),
            expanded_profile_assignments(profile.get("outboxAssignments", {}), handler, event),
        )
        for step, expected_map, code in (
            (steps[0], expected_maps[0], "INBOX_CLAIM"),
            (steps[-2], expected_maps[1], "INBOX_COMPLETE"),
            (steps[-1], expected_maps[2], "OUTBOX"),
        ):
            actual_map = assignment_index(step)
            table = str(step.get("table"))
            if actual_map != expected_map:
                findings.add("C-HANDLER-TX-ASSIGNMENT", f"{handler_id}:{code}",
                             f"expected={expected_map} got={actual_map}")
            if set(actual_map) - set(physical.get(table, {})):
                findings.add("C-HANDLER-TX-PHANTOM-COLUMN", f"{handler_id}:{code}",
                             str(sorted(set(actual_map)-set(physical.get(table, {})))))
        actual_handler_assignments = {
            str(dml.get("table")): set(candidate_assignment_map(dml)) for dml in ordered
        }
        expected_handler_assignments = EXPECTED_HANDLER_ASSIGNMENTS.get(handler_id, {})
        if actual_handler_assignments != expected_handler_assignments:
            findings.add("C-HANDLER-PHYSICAL-ASSIGNMENTS", handler_id,
                         f"expected={expected_handler_assignments} got={actual_handler_assignments}")
        for dml, step in zip(ordered, steps[1:-2]):
            if (step.get("stage") != "DOMAIN_DML" or step.get("table") != dml.get("table")
                    or step.get("disposition") != dml.get("disposition")
                    or step.get("assignments") != dml.get("assignments")):
                findings.add("C-HANDLER-TX-DOMAIN-BINDING", handler_id, str(step))

    serialized = json.dumps({"candidate": candidate, "ssot": ssot}, ensure_ascii=False)
    forbidden_patterns = (
        r"result_ref\s*(?:->|#>)", r"result_ref\.decision", r"result_reference\.decision",
        r"result_reference\s*(?:->|#>)\s*['\"]decision",
    )
    for pattern in forbidden_patterns:
        if re.search(pattern, serialized, re.I):
            findings.add("C-DECISION-RESULT-REF-JSON-MISUSE", pattern,
                         "decision receipt must use structured authorization-seal columns")


def op_index(document: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {row["operationId"]: row for row in document.get("operations", [])}


def candidate_event_index(document: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {row["eventName"]: row for row in document.get("eventPayloadSchemas", [])}


def request_sources(operation: dict[str, Any]) -> list[str]:
    return [row["source"] for row in operation.get("requestFields", [])]


def candidate_assignment_map(step: dict[str, Any]) -> dict[str, str]:
    rows = step.get("assignments", [])
    if isinstance(rows, dict):
        return {str(key): str(value) for key, value in rows.items()}
    result = {}
    for row in rows:
        target = row.get("target", "")
        result[target.rsplit(".", 1)[-1]] = str(row.get("sourcePath") or row.get("source") or row)
    return result


def referenced_request_sources(value: Any) -> set[str]:
    text = " ".join(flatten_strings(value))
    return {f"{section}.{name}" for section, name in
            re.findall(r"(?:^|[^A-Za-z0-9_])(?:successor\.|selector\.|ownerRefetch\.|resolve\.)?"
                       r"(body|pathParameters|queryParameters|headers)\.([A-Za-z0-9_-]+)", text)}


def candidate_event_names(operation: dict[str, Any]) -> list[str]:
    return [row.get("eventName", "") for row in operation.get("causalEvents", [])]


def exact_table_index(exact: dict[str, Any]) -> dict[str, dict[str, Any]]:
    common = exact.get("commonTableContract", {}).get("columns", [])
    result = {}
    for table in exact.get("tableSpecifications", []):
        columns = [table.get("idColumn", {}), *common, *table.get("columns", [])]
        result[table["tableName"]] = {**table, "_columns": {row.get("name"): row for row in columns if row.get("name")}}
    return result


def check_post_state_ddl(operation_id: str, target: dict[str, Any], tables: dict[str, dict[str, Any]],
                         findings: Findings) -> None:
    root = target.get("aggregateRoot", {})
    table_name = root.get("table")
    table = tables.get(table_name)
    if table is None:
        findings.add("C-DDL-ROOT-TABLE", operation_id, str(table_name))
        return
    for column_name in (root.get("publicIdColumn"), root.get("versionColumn"), root.get("stateColumn")):
        if column_name not in table["_columns"]:
            findings.add("C-DDL-ROOT-COLUMN", f"{operation_id}:{table_name}", str(column_name))
    state_column = root.get("stateColumn")
    post_states = target.get("transition", {}).get("postStates", [])
    accepting_checks = [row for row in table.get("checks", []) if state_column in row.get("columns", [])]
    if not accepting_checks:
        findings.add("C-DDL-STATE-CHECK", f"{operation_id}:{table_name}.{state_column}", "named CHECK absent")
    else:
        expression = " ".join(str(row.get("expression", "")) for row in accepting_checks)
        missing = [state for state in post_states if state != "NONE" and f"'{state}'" not in expression]
        if missing:
            findings.add("C-DDL-POST-STATE", f"{operation_id}:{table_name}.{state_column}",
                         f"missing={missing} checks={expression}")


def check_hashes(oracle: dict[str, Any], fixture: dict[str, Any], findings: Findings) -> None:
    if ACTIVE_PROFILE == SUCCESSOR_PROFILE:
        check_successor_hashes(oracle, fixture, findings)
        return
    if canonical_hash(oracle) != oracle.get("sealedPayloadSha256"):
        findings.add("O-SEAL", "oracle", "sealedPayloadSha256 does not match canonical payload")
    if canonical_hash(fixture) != fixture.get("sealedPayloadSha256"):
        findings.add("F-SEAL", "fixture", "sealedPayloadSha256 does not match canonical payload")
    if fixture.get("oracle", {}).get("sealedPayloadSha256") != oracle.get("sealedPayloadSha256"):
        findings.add("F-ORACLE-PIN", "fixture", "fixture is not pinned to this oracle seal")
    for name, pin in REVIEW_ARTIFACT_PINS.items():
        path = BASE / name
        if not path.is_file() or file_hash(path) != pin["fileSha256"]:
            findings.add("O-REVIEW-INPUT-BYTE-PIN", name, "missing or byte SHA drift")
            continue
        review_document = load(path)
        if (review_document.get("sealedPayloadSha256") != pin["sealedPayloadSha256"]
                or canonical_hash(review_document) != pin["sealedPayloadSha256"]):
            findings.add("O-REVIEW-INPUT-SEMANTIC-PIN", name, "canonical seal drift")
    intermediate = oracle.get("reviewedIntermediateInput", {})
    if (intermediate.get("fileSha256") != REVIEW_ARTIFACT_PINS[REVIEW_INVENTORY_PATH.name]["fileSha256"]
            or intermediate.get("authority") !=
            "REVIEWED_INTERMEDIATE_INPUT; EXPLICIT_REVIEWER_CORRECTIONS_REQUIRED"):
        findings.add("O-REVIEW-INPUT-CLASSIFICATION", "oracle", str(intermediate))
    baseline = oracle.get("preRemediationEvidence", {})
    baseline_path = ROOT / baseline.get("path", "")
    if (not baseline_path.is_file() or file_hash(baseline_path) != baseline.get("sha256")
            or baseline.get("semantics") != "PRE_REMEDIATION_INVENTORY_BASELINE; NOT_EXPECTED_OUTPUT_AUTHORITY"):
        findings.add("O-PRE-REMEDIATION-PIN", "oracle", str(baseline))
    for key, pin in oracle.get("sourcePinsAtReview", {}).items():
        path = ROOT / pin["path"]
        if not path.exists():
            findings.add("O-SOURCE-MISSING", key, pin["path"])
        if (len(str(pin.get("sha256", ""))) != 64
                or any(char not in "0123456789abcdef" for char in str(pin.get("sha256", "")))):
            findings.add("O-SOURCE-PIN", key, "review-time SHA-256 is missing or malformed")
        if pin.get("pinSemantics") != "HISTORICAL_REVIEW_INPUT_NOT_LIVE_CANDIDATE_AUTHORITY":
            findings.add("O-SOURCE-PIN-SEMANTICS", key, str(pin.get("pinSemantics")))
        if key in {"exact", "events", "semantic", "identity"} and pin.get("authority") != "INVENTORY_EVIDENCE_ONLY_NOT_EXPECTED_SEMANTIC_AUTHORITY":
            findings.add("O-SOURCE-AUTHORITY", key, str(pin.get("authority")))


def check_successor_hashes(
    oracle: dict[str, Any], fixture: dict[str, Any], findings: Findings,
) -> None:
    """Check successor seals and accepted-live byte bindings only."""
    if canonical_hash(oracle) != oracle.get("sealedPayloadSha256"):
        findings.add("O-SUCCESSOR-SEAL", "oracle", "successor oracle semantic seal mismatch")
    if canonical_hash(fixture) != fixture.get("sealedPayloadSha256"):
        findings.add("F-SUCCESSOR-SEAL", "fixture", "successor fixture semantic seal mismatch")
    if fixture.get("oracle", {}).get("sealedPayloadSha256") != oracle.get("sealedPayloadSha256"):
        findings.add("F-SUCCESSOR-ORACLE-PIN", "fixture", "fixture is not pinned to successor oracle")
    try:
        accepted = verify_accepted_live_canonical(BASE, ROOT)
    except (OSError, SuccessorProfileError, ValueError, KeyError, TypeError) as exc:
        findings.add("O-SUCCESSOR-ACCEPTED-LIVE", SUCCESSOR_ACCEPTED_LIVE_MANIFEST, str(exc))
        return
    review = oracle.get("reviewedIntermediateInput", {})
    if review.get("manifest", {}).get("fileSha256") != accepted["manifestFileSha256"]:
        findings.add("O-SUCCESSOR-MANIFEST-PIN", "oracle.reviewedIntermediateInput", "accepted-live manifest bytes drift")
    if review.get("independentAcceptance", {}).get("fileSha256") != accepted["acceptanceFileSha256"]:
        findings.add("O-SUCCESSOR-ACCEPTANCE-PIN", "oracle.reviewedIntermediateInput", "independent acceptance bytes drift")
    if review.get("authority") != "INDEPENDENT_LIVE_CANONICAL_ACCEPTANCE" or review.get("candidateAsOracle") is not False:
        findings.add("O-SUCCESSOR-REVIEW-AUTHORITY", "oracle.reviewedIntermediateInput", str(review))
    source_pins = oracle.get("sourcePinsAtReview", {})
    for key, ref in accepted["sourceRefs"].items():
        if source_pins.get(key, {}).get("path") != ref["path"] or source_pins.get(key, {}).get("sha256") != ref["fileSha256"]:
            findings.add("O-SUCCESSOR-SOURCE-PIN", key, f"expected={ref} actual={source_pins.get(key)}")
    finalization = oracle.get("reviewedFinalization", {})
    if finalization.get("path") != REVIEW_FINALIZATION_PATH.name:
        findings.add("O-SUCCESSOR-FINALIZATION-PATH", "oracle.reviewedFinalization", str(finalization))
    if not REVIEW_FINALIZATION_PATH.is_file() or not REVIEW_INVENTORY_PATH.is_file():
        findings.add("O-SUCCESSOR-REVIEW-INPUT-MISSING", "review-input", "v2 review pair is absent")
    else:
        try:
            inventory = load(REVIEW_INVENTORY_PATH)
            overlay = load(REVIEW_FINALIZATION_PATH)
            if canonical_hash(inventory) != inventory.get("sealedPayloadSha256"):
                findings.add("O-SUCCESSOR-REVIEW-INVENTORY-SEAL", REVIEW_INVENTORY_PATH.name, "invalid")
            if canonical_hash(overlay) != overlay.get("sealedPayloadSha256"):
                findings.add("O-SUCCESSOR-REVIEW-FINALIZATION-SEAL", REVIEW_FINALIZATION_PATH.name, "invalid")
            if overlay.get("baseInventory", {}).get("fileSha256") != file_hash(REVIEW_INVENTORY_PATH):
                findings.add("O-SUCCESSOR-REVIEW-BYTE-BINDING", REVIEW_FINALIZATION_PATH.name, "inventory bytes not exact-pinned")
            if overlay.get("acceptedLiveCanonical", {}).get("candidateAsOracle") is not False:
                findings.add("O-SUCCESSOR-REVIEW-CANDIDATE-AUTHORITY", REVIEW_FINALIZATION_PATH.name, "candidate authority is not explicitly false")
        except (OSError, ValueError, KeyError, TypeError) as exc:
            findings.add("O-SUCCESSOR-REVIEW-INPUT", "review-input", str(exc))


def check_successor_oracle(
    oracle: dict[str, Any], fixture: dict[str, Any], findings: Findings,
) -> None:
    """Validate the source-derived v2 oracle without legacy assumptions."""
    expected = dict(SUCCESSOR_CANONICAL_COUNTS)
    profile = oracle.get("successorProfile", {})
    if profile.get("sourceDerivedCounts") != expected:
        findings.add("O-SUCCESSOR-COUNT-PROFILE", "oracle.successorProfile", str(profile.get("sourceDerivedCounts")))
    operations = oracle.get("operations", [])
    commands = [row for row in operations if row.get("mode") == "COMMAND"]
    queries = [row for row in operations if row.get("mode") == "QUERY"]
    ids = [row.get("operationId") for row in operations]
    if (len(operations), len(commands), len(queries), len(set(ids))) != (
        expected["publicOperations"], expected["commands"], expected["queries"], expected["publicOperations"]
    ):
        findings.add("O-SUCCESSOR-SCOPE", "oracle.operations", f"all={len(operations)} commands={len(commands)} queries={len(queries)}")
    for row in commands:
        if not isinstance(row.get("orderedDml"), list) or not row.get("orderedDml"):
            findings.add("O-SUCCESSOR-COMMAND-DML", row.get("operationId", ""), "accepted-live orderedDml missing")
        if not isinstance(row.get("transactionEnvelope"), dict):
            findings.add("O-SUCCESSOR-COMMAND-ENVELOPE", row.get("operationId", ""), "transaction envelope missing")
    for row in queries:
        plan = row.get("readPlan", {})
        if row.get("orderedDml") not in ([], None) or any(plan.get(key) is not True for key in (
            "writesForbidden", "receiptsForbidden", "outboxForbidden"
        )):
            findings.add("O-SUCCESSOR-QUERY-WRITE", row.get("operationId", ""), "query is not read-only")
    handlers = oracle.get("systemHandlers", [])
    if len(handlers) != expected["systemHandlers"] or len({row.get("handlerId") for row in handlers}) != expected["systemHandlers"]:
        findings.add("O-SUCCESSOR-HANDLER-CLOSURE", "oracle.systemHandlers", str(len(handlers)))
    event_rows = oracle.get("publicEventOwnership", {}).get("events", [])
    if len(event_rows) != expected["publicEvents"] or len({row.get("eventName") for row in event_rows}) != expected["publicEvents"]:
        findings.add("O-SUCCESSOR-EVENT-CLOSURE", "publicEventOwnership.events", str(len(event_rows)))
    try:
        accepted = verify_accepted_live_canonical(BASE, ROOT)
        event_registry = load(accepted["sources"]["events"])
        registry_names = {row.get("eventName") for row in event_registry.get("eventPayloadSchemas", [])}
        if {row.get("eventName") for row in event_rows} != registry_names:
            findings.add("O-SUCCESSOR-EVENT-REGISTRY", "publicEventOwnership.events", "registry set differs")
        owner_counts = Counter(row.get("primaryOwnerSession") for row in event_rows)
        declared_counts = oracle.get("publicEventOwnership", {}).get("expectedOwnerCountsBySession", {})
        if dict(sorted(owner_counts.items())) != dict(sorted(declared_counts.items())):
            findings.add("O-SUCCESSOR-EVENT-OWNER-COUNTS", "publicEventOwnership", str(declared_counts))
        listening = load(accepted["sources"]["listeningAuthority"])
        if listening.get("schemaVersion") != 2 or not str(listening.get("contractId", "")).endswith(".v2"):
            findings.add("O-SUCCESSOR-LISTENING-V2", "listeningAuthority", str(listening.get("contractId")))
        if canonical_hash(listening) != listening.get("sealedPayloadSha256"):
            findings.add("O-SUCCESSOR-LISTENING-SEAL", "listeningAuthority", "semantic seal mismatch")
    except (OSError, ValueError, KeyError, TypeError, SuccessorProfileError) as exc:
        findings.add("O-SUCCESSOR-LIVE-SOURCE", "accepted-live", str(exc))
    tables = oracle.get("schemaOracle", {}).get("expectedTables", [])
    if (oracle.get("schemaOracle", {}).get("expectedTableCountDerived") != expected["tableSpecifications"]
            or len(tables) != expected["tableSpecifications"] or len(set(tables)) != len(tables)):
        findings.add("O-SUCCESSOR-TABLE-CLOSURE", "schemaOracle", str(len(tables)))
    timing = oracle.get("criticalTimingContracts", [])
    if not timing or timing[0].get("authoritativeProducer") != "modern.compplan.snapshot.publish" or timing[0].get("forbiddenProducer") != "modern.compplan.plan.approve":
        findings.add("O-SUCCESSOR-PAY-PRODUCER", "criticalTimingContracts", str(timing))


def check_successor_fixture(
    fixture: dict[str, Any], oracle: dict[str, Any], findings: Findings,
) -> None:
    """Check every successor fixture count from its own source-derived rows."""
    expected = dict(SUCCESSOR_CANONICAL_COUNTS)
    rows = fixture.get("edgeInventory", {}).get("rows", [])
    commands = [row for row in oracle.get("operations", []) if row.get("mode") == "COMMAND"]
    queries = [row for row in oracle.get("operations", []) if row.get("mode") == "QUERY"]
    handlers = oracle.get("systemHandlers", [])
    derived = fixture.get("successorProfile", {}).get("derivedScenarioCounts", {})
    command_faults = sum(max(1, len(row.get("orderedDml", []))) + 1 for row in commands)
    handler_faults = sum(max(1, len(row.get("orderedDml", []))) + 1 for row in handlers)
    decision_receipts = sum(
        1 for row in commands if any("decision" in json.dumps(step, sort_keys=True).lower()
                                     for step in row.get("orderedDml", []))
    )
    actual = {
        **expected,
        "edges": len(rows),
        "committedEdges": sum(row.get("classification") == "COMMITTED_EDGE" for row in rows),
        "forbiddenEdges": sum(row.get("classification") == "FORBIDDEN_EDGE" for row in rows),
        "operationTransactions": len(commands),
        "queryCases": len(queries) * 6,
        "commandRollbackFaults": command_faults,
        "handlerRollbackFaults": handler_faults,
        "sameTransactionDecisionReceipts": decision_receipts,
    }
    if fixture.get("edgeInventory", {}).get("total") != len(rows) or fixture.get("edgeInventory", {}).get("committed") != actual["committedEdges"] or fixture.get("edgeInventory", {}).get("forbidden") != actual["forbiddenEdges"]:
        findings.add("F-SUCCESSOR-EDGE-COUNTS", "edgeInventory", str(fixture.get("edgeInventory")))
    if derived != actual:
        findings.add("F-SUCCESSOR-DERIVED-COUNTS", "successorProfile.derivedScenarioCounts", f"expected={actual} actual={derived}")
    if len(fixture.get("allCommandCasScenarios", [])) != len(commands):
        findings.add("F-SUCCESSOR-COMMAND-COUNT", "allCommandCasScenarios", str(len(fixture.get("allCommandCasScenarios", []))))
    if len(fixture.get("allQueryReadOnlyScenarios", [])) != len(queries):
        findings.add("F-SUCCESSOR-QUERY-COUNT", "allQueryReadOnlyScenarios", str(len(fixture.get("allQueryReadOnlyScenarios", []))))
    if {row.get("handlerId") for row in fixture.get("internalHandlerTransactions", [])} != {row.get("handlerId") for row in handlers}:
        findings.add("F-SUCCESSOR-HANDLER-CLOSURE", "internalHandlerTransactions", "handler IDs differ")
    if fixture.get("requiredEvidence", {}).get("expectedScenarioCounts") != actual:
        findings.add("F-SUCCESSOR-EVIDENCE-COUNTS", "requiredEvidence.expectedScenarioCounts", str(fixture.get("requiredEvidence", {}).get("expectedScenarioCounts")))
    if fixture.get("schemaVersion") != 2 or fixture.get("fixtureId") != "dwp.hris.modern.causal-independent-pg-fixtures.v2":
        findings.add("F-SUCCESSOR-IDENTITY", "fixture", str(fixture.get("fixtureId")))


def check_builder_independence(findings: Findings) -> None:
    """Prove the final CLI path cannot consult mutable candidate artifacts."""
    try:
        tree = ast.parse(BUILDER_PATH.read_text(encoding="utf-8"))
    except Exception as exc:  # pragma: no cover - fail closed on audit host errors
        findings.add("O-BUILDER-AST", BUILDER_PATH.name, str(exc))
        return
    build_node = next((node for node in tree.body if isinstance(node, ast.FunctionDef)
                       and node.name == "build_oracle"), None)
    if build_node is None:
        findings.add("O-BUILDER-FINALIZER", BUILDER_PATH.name, "build_oracle missing")
        return
    names = {node.id for node in ast.walk(build_node) if isinstance(node, ast.Name)}
    forbidden = names & {"SOURCE_PATHS", "build_unsealed_draft_from_evidence_for_review_only",
                         "module_transitions", "stable_event_sources", "table_columns"}
    string_literals = {node.value for node in ast.walk(build_node)
                       if isinstance(node, ast.Constant) and isinstance(node.value, str)}
    if forbidden or any("modern-capability-" in value for value in string_literals):
        findings.add("O-BUILDER-LIVE-CANDIDATE", "build_oracle", f"forbidden={sorted(forbidden)}")
    required = {"REVIEW_INVENTORY_PATH", "REVIEW_FINALIZATION_PATH", "REVIEWED_INTERMEDIATE_INPUT",
                "REVIEWED_FINALIZATION"}
    if not required <= names:
        findings.add("O-BUILDER-FROZEN-INPUT", "build_oracle", f"missing={sorted(required-names)}")


def check_selectors(operation: dict[str, Any], findings: Findings) -> None:
    required = {
        "source", "selectorType", "entityType", "idSpace", "sourceType", "targetTable",
        "targetColumn", "targetSqlType", "operator", "cardinality", "tenantFilter",
        "purposeFilter", "versionRule", "asOfRule", "causalJoin", "failure",
    }
    seen = set()
    for selector in operation.get("selectors", []):
        subject = f"{operation['operationId']}:{selector.get('source')}"
        missing = sorted(required - set(selector))
        if missing:
            findings.add("O-SELECTOR-SHAPE", subject, "missing " + ",".join(missing))
        key = (selector.get("source"), selector.get("targetTable"), selector.get("targetColumn"))
        if key in seen:
            findings.add("O-SELECTOR-DUP", subject, str(key))
        seen.add(key)
        if selector.get("cardinality") not in {"EXACTLY_ONE", "ZERO_OR_ONE", "ONE_TO_MANY_ORDER_INDEPENDENT"}:
            findings.add("O-SELECTOR-CARDINALITY", subject, str(selector.get("cardinality")))
        for field in ("targetTable", "targetColumn", "selectorType", "tenantFilter", "purposeFilter",
                      "versionRule", "asOfRule", "causalJoin"):
            if selector.get(field) in (None, "", [], {}):
                findings.add("O-SELECTOR-EMPTY", subject, field)


def check_input_effects(operation: dict[str, Any], findings: Findings) -> None:
    expected = request_sources(operation)
    actual = [row.get("source") for row in operation.get("inputEffects", [])]
    if Counter(expected) != Counter(actual):
        findings.add("O-INPUT-CLOSURE", operation["operationId"], f"request={expected} effects={actual}")
    forbidden_only = {"TRANSITION_GUARD", "DECISION_INPUT", "REQUEST_DIGEST", "VALIDATION_ONLY"}
    assigned_targets = {
        f"{step.get('table')}.{column}"
        for step in operation.get("orderedDml", [])
        for column in (step.get("assignments") or {})
        if step.get("table")
    }
    written_tables = {
        step.get("table") for step in operation.get("orderedDml", [])
        if step.get("role") not in {"COMMAND_RECEIPT", "TRANSACTIONAL_OUTBOX"}
    }
    for row in operation.get("inputEffects", []):
        subject = f"{operation['operationId']}:{row.get('source')}"
        effects = row.get("effects", [])
        if not effects:
            findings.add("O-INPUT-NO-EFFECT", subject, "empty effects")
            continue
        kinds = {str(effect.get("kind", "")).upper() for effect in effects}
        if kinds and kinds <= forbidden_only:
            findings.add("O-INPUT-GUARD-ONLY", subject, ",".join(sorted(kinds)))
        if not row.get("required"):
            absence = row.get("absenceSemantics", {})
            if absence.get("mode") != "EXPLICIT_ABSENT_BRANCH" or not absence.get("mustTestAbsentAndPresent"):
                findings.add("O-OPTIONAL-BRANCH", subject, "optional field lacks absent/present contract")
        for effect in effects:
            kind = effect.get("kind")
            if kind in {"PERSISTED_COLUMN", "PERSISTED_BUSINESS_FACT", "PERSISTED_DERIVED_DIGEST"}:
                target = effect.get("target")
                if target not in assigned_targets:
                    findings.add("O-INPUT-EFFECT-DML-BINDING", subject,
                                 f"{kind} target {target} is not assigned by ordered DML")
            if kind == "PERSISTED_TYPED_OBJECT":
                missing_targets = set(effect.get("targets", [])) - assigned_targets
                if missing_targets:
                    findings.add("O-INPUT-EFFECT-DML-BINDING", subject,
                                 f"typed targets not assigned: {sorted(missing_targets)}")
            if kind == "APPEND_TYPED_COLLECTION" and effect.get("target") not in written_tables:
                findings.add("O-INPUT-EFFECT-DML-BINDING", subject,
                             f"typed collection table not written: {effect.get('target')}")
            if kind == "PERSISTED_DECISION_RECEIPT":
                fields = effect.get("requiredFields", {})
                missing = {"ruleId", "inputDigestOrRef", "outcome", "decisionVersion"} - set(fields)
                if missing or not effect.get("sameTransaction") or not effect.get("mutationDependency"):
                    findings.add("O-DECISION-RECEIPT", subject,
                                 f"missing={sorted(missing)} sameTx={effect.get('sameTransaction')}")
            if kind == "FORBIDDEN_CALLER_ASSERTION" and not effect.get("candidateRequestMustRemoveOrReplace"):
                findings.add("O-FORBIDDEN-INPUT", subject, "missing mandatory request successor")
    if operation.get("mode") == "QUERY":
        text = " ".join(flatten_strings(operation.get("inputEffects", []))).lower()
        if any(token in text for token in ("outbox", "receipt", "mutation", "write")):
            findings.add("O-QUERY-EFFECT-WRITE", operation["operationId"], "query effect references write/receipt/outbox")


def check_dml(operation: dict[str, Any], findings: Findings) -> None:
    steps = operation.get("orderedDml", [])
    if operation.get("mode") == "QUERY":
        if steps or operation.get("events"):
            findings.add("O-QUERY-MUTATES", operation["operationId"], "query has DML/events")
        plan = operation.get("readPlan", {})
        if not all(plan.get(key) is True for key in ("writesForbidden", "receiptsForbidden", "outboxForbidden")):
            findings.add("O-QUERY-READ-PLAN", operation["operationId"], "read-only flags not all true")
        return
    if [row.get("step") for row in steps] != list(range(1, len(steps) + 1)):
        findings.add("O-DML-ORDER", operation["operationId"], "steps are not contiguous")
    if len(steps) < 4:
        findings.add("O-DML-INCOMPLETE", operation["operationId"], "missing receipt/domain/outbox stages")
        return
    if steps[0].get("action") != "CLAIM_OR_REPLAY" or steps[0].get("role") != "COMMAND_RECEIPT":
        findings.add("O-DML-RECEIPT-FIRST", operation["operationId"], str(steps[0]))
    if steps[-1].get("action") != "APPEND_EVENTS" or steps[-1].get("role") != "TRANSACTIONAL_OUTBOX":
        findings.add("O-DML-OUTBOX-LAST", operation["operationId"], str(steps[-1]))
    if not any(row.get("action") == "COMPLETE_RECEIPT" for row in steps):
        findings.add("O-DML-RECEIPT-COMPLETE", operation["operationId"], "no receipt finalization")
    envelope = operation.get("transactionEnvelope", {})
    envelope_text = json.dumps(envelope, ensure_ascii=False, sort_keys=True).lower().replace("_", "")
    required_envelope_tokens = (
        "one database transaction", "claim", "identicaldigest", "differentdigest", "replay",
        "receipt", "mutation", "complete", "outbox", "rollback", "aftercommit",
    )
    if not envelope or not all(token.replace(" ", "") in envelope_text.replace(" ", "")
                               for token in required_envelope_tokens):
        findings.add("O-TX-ENVELOPE", operation["operationId"],
                     "claim/replay/conflict/mutation/complete/outbox/rollback/after-commit closure absent")
    if envelope.get("operationBinding") != operation.get("operationId"):
        findings.add("O-TX-ENVELOPE-BINDING", operation["operationId"], str(envelope.get("operationBinding")))
    serialized = json.dumps(steps, ensure_ascii=False)
    if "__oracle_error__" in serialized or "REVIEW_REQUIRED" in serialized:
        findings.add("O-DML-PLACEHOLDER", operation["operationId"], "unresolved assignment marker")
    domain_steps = [row for row in steps if row.get("role") not in {"COMMAND_RECEIPT", "TRANSACTIONAL_OUTBOX"}]
    if not domain_steps:
        findings.add("O-DML-NO-DOMAIN", operation["operationId"], "command has no physical/owner-port effect")
    root = operation.get("aggregateRoot", {}).get("table")
    root_steps = [row for row in domain_steps if row.get("table") == root]
    if operation.get("transition", {}).get("preStates") != ["NONE"]:
        if not any(row.get("action") == "UPDATE_CAS" for row in root_steps):
            findings.add("O-DML-NO-ROOT-CAS", operation["operationId"], str(root))
    immutable = {"tenant_id", "public_id", "created_at", "created_by", "correlation_id"}
    request_set = set(request_sources(operation))
    for step in domain_steps:
        if not step.get("assignments") and step.get("action") != "CALL_OWNER_PORT":
            findings.add("O-DML-NO-ASSIGNMENTS", f"{operation['operationId']}:{step.get('table')}", step.get("action", ""))
        if str(step.get("action", "")).startswith("UPDATE"):
            bad = immutable & set(step.get("assignments", {}))
            if bad:
                findings.add("O-DML-IMMUTABLE-UPDATE", f"{operation['operationId']}:{step.get('table')}", ",".join(sorted(bad)))
        if not step.get("failureInjectionAssertion"):
            findings.add("O-DML-NO-ROLLBACK-PROBE", f"{operation['operationId']}:{step.get('step')}", "")
        phantom = referenced_request_sources(step.get("assignments", {})) - request_set
        if phantom:
            findings.add("O-DML-PHANTOM-REQUEST", f"{operation['operationId']}:{step.get('table')}",
                         ",".join(sorted(phantom)))
    decision_sources = {
        row.get("source") for row in operation.get("inputEffects", [])
        if any(effect.get("kind") == "PERSISTED_DECISION_RECEIPT" for effect in row.get("effects", []))
    }
    if decision_sources:
        root_steps = [row for row in domain_steps if row.get("table") == operation.get("aggregateRoot", {}).get("table")]
        if not root_steps or not any(decision_sources <= set(row.get("decisionDependencies", [])) for row in root_steps):
            findings.add("O-DECISION-MUTATION-DEPENDENCY", operation["operationId"],
                         f"expected decision inputs={sorted(decision_sources)}")
        completion = next((row for row in steps if row.get("action") == "COMPLETE_RECEIPT"), {})
        persisted = completion.get("assignments", {}).get("decision_receipts", [])
        if len(persisted) < len(decision_sources):
            findings.add("O-DECISION-SAME-TX-PERSISTENCE", operation["operationId"],
                         f"expected>={len(decision_sources)} got={len(persisted)}")


def check_event(operation: dict[str, Any], event: dict[str, Any], findings: Findings) -> None:
    subject = f"{operation['operationId']}:{event.get('eventName')}"
    if not str(event.get("eventName", "")).endswith(".v2"):
        findings.add("O-EVENT-NOT-V2", subject, "successor event must be v2")
    fields = event.get("fields", [])
    names = [row.get("name") for row in fields]
    if not fields or len(names) != len(set(names)):
        findings.add("O-EVENT-FIELDS", subject, "empty or duplicate fields")
    required_base = {"aggregateId", "fromState", "toState", "aggregateVersion", "occurredAt", "correlationId"}
    if not required_base <= set(names):
        findings.add("O-EVENT-BASE", subject, f"missing={sorted(required_base-set(names))}")
    for field in fields:
        source = str(field.get("source", ""))
        if not source or source.startswith(("request.", "body.", "sourceRequestField", "decision_input")):
            findings.add("O-EVENT-REQUEST-MIRROR", f"{subject}:{field.get('name')}", source)
        if source.startswith("ownerRefetch.table:") or "__oracle_error__" in source:
            findings.add("O-EVENT-FABRICATED-SOURCE", f"{subject}:{field.get('name')}", source)
        if not field.get("type") or field.get("required") is not True:
            findings.add("O-EVENT-FIELD-TYPE", f"{subject}:{field.get('name')}",
                         f"type={field.get('type')} required={field.get('required')}")
        if field.get("sourceKind") not in {
                "PHYSICAL_POST_STATE", "LOCKED_PRE_STATE", "DERIVED_DOMAIN_FACT",
                "OWNER_TRANSACTION_CLOCK", "TRACE_CONTEXT", "OWNER_REFETCH", "OWNER_ACK"}:
            findings.add("O-EVENT-SOURCE-KIND", f"{subject}:{field.get('name')}",
                         str(field.get("sourceKind")))
        lower_name = str(field.get("name", "")).lower()
        if ((lower_name.endswith("id") or lower_name.endswith("publicid"))
                and field.get("type") != "UUID"):
            findings.add("O-EVENT-PUBLIC-ID-TYPE", f"{subject}:{field.get('name')}",
                         f"type={field.get('type')} source={source}")
        if "__internal_id__" in source:
            findings.add("O-EVENT-INTERNAL-ID", f"{subject}:{field.get('name')}", source)
        if field.get("name") == "occurredAt" and "transaction" not in source.lower():
            findings.add("O-EVENT-TIME", subject, source)
    expected_root = INDEPENDENT_EVENT_ROOTS.get(event.get("eventName"))
    aggregate_source = next((row.get("source") for row in fields if row.get("name") == "aggregateId"), None)
    if expected_root and (event.get("aggregateEntityType") != "table:" + expected_root
                          or aggregate_source != expected_root + ".public_id"):
        findings.add("O-EVENT-FACT-ROOT", subject,
                     f"expected={expected_root} entity={event.get('aggregateEntityType')} source={aggregate_source}")
    expected_sources = INDEPENDENT_CRITICAL_EVENT_SOURCES.get(event.get("eventName"), {})
    actual_sources = {row.get("name"): row.get("source") for row in fields}
    for field_name, expected_source in expected_sources.items():
        if actual_sources.get(field_name) != expected_source:
            findings.add("O-EVENT-CRITICAL-SOURCE", f"{subject}:{field_name}",
                         f"expected={expected_source} got={actual_sources.get(field_name)}")
    audience = event.get("audience", {})
    if not audience.get("allowedConsumerSessions") or not audience.get("allowedPurposes"):
        findings.add("O-EVENT-AUDIENCE", subject, "consumer/purpose allowlist missing")
    exposure = audience.get("fieldExposure", {})
    if exposure.get("mode") != "EXACT_ALLOWLIST" or set(exposure.get("fields", [])) != set(names):
        findings.add("O-EVENT-EXPOSURE", subject, "field allowlist differs from payload")
    refetch = event.get("refetchContract", {})
    if refetch.get("allowed") is True:
        findings.add("O-EVENT-BLANKET-REFETCH", subject, "blanket allowed=true is forbidden")
    pep = refetch.get("pep", {})
    mode = refetch.get("mode")
    refetch_fields = refetch.get("allowedFields", [])
    pep_fields = pep.get("fieldExposure")
    if (mode not in {"FORBIDDEN", "FIELD_ALLOWLIST"} or not pep.get("tenant") or not pep.get("purpose")
            or not pep.get("consumerSessionAllowlist") or pep_fields is None
            or set(pep_fields) != set(refetch_fields)
            or (mode == "FORBIDDEN" and (refetch_fields or refetch.get("endpoint")))
            or (mode == "FIELD_ALLOWLIST" and (not refetch_fields or not refetch.get("endpoint")))
            or not pep.get("reauthorizeEveryCall") or not pep.get("denyOnUnavailable")):
        findings.add("O-EVENT-REFETCH-PEP", subject, "incomplete tenant/purpose/consumer/field PEP")
    if event.get("rawRequestMirroringForbidden") is not True:
        findings.add("O-EVENT-RAW-RULE", subject, "raw request mirror prohibition absent")


def check_lineage(oracle: dict[str, Any], findings: Findings) -> None:
    rows = oracle.get("eventSuccessorLineage", [])
    if len(rows) != 32 or len({row.get("predecessorEvent") for row in rows}) != 32:
        findings.add("O-LINEAGE-COUNT", "lineage", f"rows={len(rows)}")
    known = {event["eventName"] for op in oracle.get("operations", []) for event in op.get("events", [])}
    for handler in oracle.get("systemHandlers", []):
        if handler.get("event"):
            known.add(handler["event"]["eventName"])
        if handler.get("eventName"):
            known.add(handler["eventName"])
    for row in rows:
        subject = row.get("predecessorEvent", "")
        if row.get("disposition") not in {"PRESERVED", "SPLIT", "SUPERSEDED"}:
            findings.add("O-LINEAGE-DISPOSITION", subject, str(row.get("disposition")))
        missing = set(row.get("successorEvents", [])) - known
        if missing:
            findings.add("O-LINEAGE-ORPHAN", subject, ",".join(sorted(missing)))
        required_updates = {"AsyncAPI", "g3-contract-primary-ownership-register.csv",
                            "modern-capability-trace-register.csv", "all producer/consumer contract tests"}
        if set(row.get("registryUpdateSet", [])) != required_updates:
            findings.add("O-LINEAGE-REGISTRY", subject, "registry/AsyncAPI/trace/consumer update closure missing")
        dual = row.get("runtimeDualPublish", {})
        if dual.get("required") is not False or "NOT_STARTED_G3" not in dual.get("reason", ""):
            findings.add("O-LINEAGE-DUAL-PUBLISH", subject, str(dual))
        if row.get("orphanForbidden") is not True:
            findings.add("O-LINEAGE-ORPHAN-RULE", subject, "orphanForbidden != true")
        contracts = {item.get("eventName"): item for item in row.get("successorContracts", [])}
        if set(contracts) != set(row.get("successorEvents", [])):
            findings.add("O-LINEAGE-CONTRACT-CLOSURE", subject,
                         f"successors={row.get('successorEvents')} contracts={sorted(contracts)}")
        for event_name, contract in contracts.items():
            if not (contract.get("producerOperationId") or contract.get("producerHandlerId")):
                findings.add("O-LINEAGE-PRODUCER", f"{subject}:{event_name}", "producer absent")
            if (not contract.get("producerSession") or not contract.get("payloadFields")
                    or not contract.get("allowedConsumerSessions") or not contract.get("purposeCodes")
                    or contract.get("refetchMode") not in {"FORBIDDEN", "FIELD_ALLOWLIST"}
                    or "refetchFieldExposure" not in contract):
                findings.add("O-LINEAGE-COMPATIBILITY", f"{subject}:{event_name}", str(contract))


def check_value_objects(oracle: dict[str, Any], findings: Findings) -> None:
    schemas = oracle.get("valueObjects", {})
    referenced = {
        field.get("schemaRef") or field.get("itemSchemaRef")
        for operation in oracle.get("operations", [])
        for field in operation.get("requestFields", [])
        if field.get("schemaRef") or field.get("itemSchemaRef")
    }
    if referenced != set(schemas):
        findings.add("O-VALUE-OBJECT-CLOSURE", "valueObjects",
                     f"referenced={sorted(referenced)} defined={sorted(schemas)}")
    for schema_id, schema in schemas.items():
        fields = schema.get("fields", [])
        names = [row.get("name") for row in fields]
        if schema.get("kind") != "OBJECT" or schema.get("additionalProperties") is not False or not fields:
            findings.add("O-VALUE-OBJECT-SHAPE", schema_id, str(schema))
        if len(names) != len(set(names)):
            findings.add("O-VALUE-OBJECT-DUP", schema_id, str(names))
        for field in fields:
            if not field.get("name") or not field.get("type") or "required" not in field:
                findings.add("O-VALUE-OBJECT-FIELD", schema_id, str(field))


def check_schema_oracle(oracle: dict[str, Any], findings: Findings) -> None:
    schema = oracle.get("schemaOracle", {})
    tables = schema.get("expectedTables", [])
    if (schema.get("closure") != "EXACT_SET_NO_OMITTED_OR_UNREVIEWED_EXTRA_PRODUCER_TABLE"
            or set(tables) != INDEPENDENT_EXPECTED_TABLES
            or len(tables) != len(INDEPENDENT_EXPECTED_TABLES)
            or schema.get("expectedTableCountDerived") != len(INDEPENDENT_EXPECTED_TABLES)):
        findings.add("O-SCHEMA-CLOSED-SET", "schemaOracle",
                     f"expected={len(INDEPENDENT_EXPECTED_TABLES)} got={schema.get('expectedTableCountDerived')} "
                     f"missing={sorted(INDEPENDENT_EXPECTED_TABLES-set(tables))} "
                     f"extra={sorted(set(tables)-INDEPENDENT_EXPECTED_TABLES)}")
    actual_deltas = schema.get("requiredTableColumnCheckDeltas", {})
    if set(actual_deltas) != set(INDEPENDENT_REQUIRED_DELTAS):
        findings.add("O-SCHEMA-DELTA-CLOSURE", "schemaOracle",
                     f"expected={sorted(INDEPENDENT_REQUIRED_DELTAS)} got={sorted(actual_deltas)}")
    for table, (columns, state_check) in INDEPENDENT_REQUIRED_DELTAS.items():
        actual = actual_deltas.get(table, {})
        if actual.get("requiredColumns") != columns:
            findings.add("O-SCHEMA-DELTA-COLUMNS", table,
                         f"expected={columns} got={actual.get('requiredColumns')}")
        expected_check = None if state_check is None else {
            "column": state_check[0], "allowed": sorted(state_check[1])
        }
        actual_check = actual.get("stateCheck")
        if expected_check is None:
            if actual_check is not None:
                findings.add("O-SCHEMA-DELTA-CHECK", table, f"unexpected={actual_check}")
        elif (actual_check or {}).get("column") != expected_check["column"] \
                or set((actual_check or {}).get("allowed", [])) != set(expected_check["allowed"]):
            findings.add("O-SCHEMA-DELTA-CHECK", table,
                         f"expected={expected_check} got={actual_check}")
    state_sinks = schema.get("stateSinkOperationDeltas", {})
    if (set(state_sinks) != set(INDEPENDENT_STATE_SINKS)
            or schema.get("stateSinkOperationCountDerived") != len(INDEPENDENT_STATE_SINKS)):
        findings.add("O-STATE-SINK-COUNT", "schemaOracle",
                     f"expected={len(INDEPENDENT_STATE_SINKS)} got={schema.get('stateSinkOperationCountDerived')}")
    operations = op_index(oracle)
    dml_tables = {
        step.get("table")
        for operation in operations.values()
        for step in operation.get("orderedDml", [])
        if step.get("role") not in {"COMMAND_RECEIPT", "TRANSACTIONAL_OUTBOX"}
        and step.get("action") != "CALL_OWNER_PORT" and step.get("table")
    }
    handler_tables = {write.get("table") for handler in oracle.get("systemHandlers", [])
                      for write in handler.get("writes", [])}
    missing_physical = (dml_tables | handler_tables) - INDEPENDENT_EXPECTED_TABLES
    if missing_physical:
        findings.add("O-SCHEMA-DML-CLOSURE", "schemaOracle", f"missing={sorted(missing_physical)}")
    for operation_id, (table, column) in INDEPENDENT_STATE_SINKS.items():
        delta = state_sinks.get(operation_id, {})
        root = operations.get(operation_id, {}).get("aggregateRoot", {})
        transition = operations.get(operation_id, {}).get("transition", {})
        if (delta.get("table"), delta.get("column")) != (table, column):
            findings.add("O-STATE-SINK-DELTA", operation_id,
                         f"expected={table}.{column} got={delta.get('table')}.{delta.get('column')}")
        if (root.get("table"), root.get("stateColumn")) != (table, column) \
                or transition.get("physicalPostStateSink") != f"{table}.{column}":
            findings.add("O-STATE-SINK-ROOT", operation_id,
                         f"root={root} sink={transition.get('physicalPostStateSink')}")


def check_critical_semantics(oracle: dict[str, Any], findings: Findings) -> None:
    ops = op_index(oracle)
    for operation_id, expected in INDEPENDENT_CAUSAL_CORRECTIONS.items():
        operation = ops.get(operation_id, {})
        root = operation.get("aggregateRoot", {})
        if (root.get("table"), root.get("stateColumn")) != expected["root"]:
            findings.add("O-CAUSAL-ROOT", operation_id,
                         f"expected={expected['root']} got={(root.get('table'), root.get('stateColumn'))}")
        transition = operation.get("transition", {})
        actual_transition = (tuple(transition.get("preStates", [])), tuple(transition.get("postStates", [])))
        if actual_transition != expected["transition"]:
            findings.add("O-CAUSAL-TRANSITION", operation_id,
                         f"expected={expected['transition']} got={actual_transition}")
        if "body" in expected:
            actual_body = {row.get("source") for row in operation.get("requestFields", [])
                           if row.get("location") == "body"}
            if actual_body != expected["body"]:
                findings.add("O-CAUSAL-REQUEST", operation_id,
                             f"expected={sorted(expected['body'])} got={sorted(actual_body)}")
        domain_steps = [row for row in operation.get("orderedDml", [])
                        if row.get("role") not in {"COMMAND_RECEIPT", "TRANSACTIONAL_OUTBOX"}]
        actual_domain = [(row.get("action"), row.get("table")) for row in domain_steps]
        if actual_domain != expected["domain"]:
            findings.add("O-CAUSAL-DML", operation_id,
                         f"expected={expected['domain']} got={actual_domain}")
        by_table = {row.get("table"): set(row.get("assignments", {})) for row in domain_steps}
        for table, columns in expected.get("requiredAssignments", {}).items():
            missing = columns - by_table.get(table, set())
            if missing:
                findings.add("O-CAUSAL-DML-ASSIGNMENTS", f"{operation_id}:{table}",
                             f"missing={sorted(missing)}")
        for table, columns in expected.get("forbiddenAssignments", {}).items():
            overwritten = columns & by_table.get(table, set())
            if overwritten:
                findings.add("O-CAUSAL-IMMUTABLE-OVERWRITE", f"{operation_id}:{table}",
                             f"forbidden={sorted(overwritten)}")
        required_selector = expected.get("requiredSelector")
        if required_selector:
            selector_keys = {(row.get("source"), row.get("targetTable"), row.get("targetColumn"),
                              row.get("selectorType")) for row in operation.get("selectors", [])}
            if required_selector not in selector_keys:
                findings.add("O-CAUSAL-PARENT-SELECTOR", operation_id,
                             f"expected={required_selector} got={sorted(selector_keys)}")
    hire = ops.get("modern.recruiting.hire.record", {})
    hire_tables = {row.get("table") for row in hire.get("orderedDml", [])}
    if "ppl_rec_hire_handoff_receipts" in hire_tables or "ppl_rec_hire_requests" not in hire_tables:
        findings.add("O-HIRE-TWO-PHASE", "modern.recruiting.hire.record", str(sorted(hire_tables)))
    if hire.get("transition", {}).get("postStates") != ["HIRE_PENDING"]:
        findings.add("O-HIRE-PENDING", "modern.recruiting.hire.record", str(hire.get("transition")))
    handlers = {row.get("handlerId"): row for row in oracle.get("systemHandlers", [])}
    hire_handler = handlers.get("internal.recruiting.hire-handoff.acknowledge", {})
    hire_handler_text = " ".join(flatten_strings(hire_handler))
    for token in ("ppl_rec_hire_handoff_receipts", "ppl_rec_hire_requests",
                  "PENDING->ACKNOWLEDGED", "HIRE_PENDING->HIRED", "CandidateHired.v2"):
        if token not in hire_handler_text:
            findings.add("O-HIRE-HANDLER", "internal.recruiting.hire-handoff.acknowledge", token)
    expected_hire_writes = {
        ("APPEND", "ppl_rec_hire_handoff_receipts"),
        ("UPDATE_CAS", "ppl_rec_hire_requests"),
        ("UPDATE_CAS", "ppl_rec_candidate_cases"),
    }
    actual_hire_writes = {(row.get("action"), row.get("table"))
                          for row in hire_handler.get("writes", [])}
    if actual_hire_writes != expected_hire_writes or len(hire_handler.get("writes", [])) != 3:
        findings.add("O-HIRE-HANDLER-WRITES", "internal.recruiting.hire-handoff.acknowledge",
                     f"expected={sorted(expected_hire_writes)} actual={sorted(actual_hire_writes)}")
    onboarding = ops.get("modern.onboarding.task.complete", {})
    names = {row.get("eventName"): row.get("condition") for row in onboarding.get("events", [])}
    if names.get("OnboardingTaskCompleted.v2") != "ALWAYS" or names.get("OnboardingJourneyCompleted.v2") != "ALL_REQUIRED_TASKS_COMPLETE":
        findings.add("O-ONBOARDING-CONDITIONAL", "modern.onboarding.task.complete", str(names))
    timing = next((row for row in oracle.get("criticalTimingContracts", [])
                   if row.get("contractId") == "PAY-COMPENSATION-SNAPSHOT-TIMING"), {})
    if (timing.get("forbiddenProducer") != "modern.compplan.plan.approve"
            or timing.get("authoritativeProducer") != "modern.compplan.snapshot.publish"
            or "ApprovedCompensationPlanSnapshotPublished.v2" not in " ".join(flatten_strings(timing))):
        findings.add("O-PAY-TIMING", "PAY-COMPENSATION-SNAPSHOT-TIMING", str(timing))
    plan_identity = timing.get("approvalPlanIdentity", {})
    if (plan_identity.get("table"), plan_identity.get("publicIdColumn"),
            plan_identity.get("distinctFromCycle")) != ("prf_cmp_plans", "public_id", True):
        findings.add("O-PAY-PLAN-IDENTITY", "PAY-COMPENSATION-SNAPSHOT-TIMING", str(plan_identity))
    approve_names = candidate_event_names({"causalEvents": ops.get("modern.compplan.plan.approve", {}).get("events", [])})
    snapshot_names = candidate_event_names({"causalEvents": ops.get("modern.compplan.snapshot.publish", {}).get("events", [])})
    if "ApprovedCompensationPlanSnapshotPublished.v2" in approve_names or "ApprovedCompensationPlanSnapshotPublished.v2" not in snapshot_names:
        findings.add("O-PAY-EVENT-PRODUCER", "compensation", f"approve={approve_names} snapshot={snapshot_names}")
    snapshot = ops.get("modern.compplan.snapshot.publish", {})
    approve = ops.get("modern.compplan.plan.approve", {})
    approve_dml = {(row.get("action"), row.get("table"), row.get("role"))
                   for row in approve.get("orderedDml", [])}
    if ("INSERT", "prf_cmp_plans", "IMMUTABLE_APPROVED_PLAN_HEADER") not in approve_dml:
        findings.add("O-PAY-PLAN-HEADER", "modern.compplan.plan.approve", str(sorted(approve_dml)))
    approve_event = next((event for event in approve.get("events", [])
                          if event.get("eventName") == "CompensationPlanApprovalRecorded.v2"), {})
    approve_sources = {field.get("name"): field.get("source") for field in approve_event.get("fields", [])}
    if (approve_sources.get("planId") != "prf_cmp_plans.public_id"
            or approve_sources.get("cycleId") != "prf_cmp_cycles.public_id"
            or approve_sources.get("planId") == approve_sources.get("cycleId")):
        findings.add("O-PAY-PLAN-CYCLE-SUBSTITUTION", "CompensationPlanApprovalRecorded.v2", str(approve_sources))
    roles = [row.get("role") for row in snapshot.get("orderedDml", [])]
    if not all(role in roles for role in ("CONCURRENCY_ROOT", "IMMUTABLE_HEADER", "IMMUTABLE_LINES")):
        findings.add("O-PAY-ATOMIC-SNAPSHOT", "modern.compplan.snapshot.publish", str(roles))
    plan_selector = next((row for row in snapshot.get("selectors", [])
                          if row.get("source") == "body.planPublicId"), {})
    if (plan_selector.get("targetTable"), plan_selector.get("targetColumn"), plan_selector.get("selectorType")) != \
            ("prf_cmp_plans", "public_id", "RELATED_PARENT"):
        findings.add("O-PAY-SNAPSHOT-PLAN-SELECTOR", "modern.compplan.snapshot.publish", str(plan_selector))
    identity = next((row for row in snapshot.get("identityConstraints", [])
                     if row.get("kind") == "PAIRWISE_DISTINCT_TYPED_IDENTITIES"), {})
    if set(identity.get("fields", [])) != {"snapshotId", "planId", "cycleId"}:
        findings.add("O-PAY-IDENTITY-DISTINCT", "modern.compplan.snapshot.publish", str(identity))
    if not all(handler in handlers for handler in (
        "internal.contingent.access-expiry.enforce",
        "internal.wfm.schedule-optimization.complete",
        "internal.ai.policy-evaluation.complete",
    )):
        findings.add("O-SYSTEM-HANDLERS", "systemHandlers", str(sorted(handlers)))


def check_fixture(fixture: dict[str, Any], oracle: dict[str, Any], findings: Findings) -> None:
    inventory = fixture.get("edgeInventory", {})
    rows = inventory.get("rows", [])
    counts = Counter(row.get("classification") for row in rows)
    if (inventory.get("total"), inventory.get("committed"), inventory.get("forbidden"), len(rows)) != (58, 53, 5, 58):
        findings.add("F-EDGE-COUNT", "edgeInventory", str({**inventory, "rows": len(rows)}))
    if counts != Counter({"COMMITTED_EDGE": 53, "FORBIDDEN_EDGE": 5}):
        findings.add("F-EDGE-CLASS", "edgeInventory", str(counts))
    keys = {(row.get("operationId"), row.get("table")) for row in rows if row.get("classification") == "FORBIDDEN_EDGE"}
    if keys != FORBIDDEN_EDGE_KEYS:
        findings.add("F-FORBIDDEN-SET", "edgeInventory", f"expected={FORBIDDEN_EDGE_KEYS} actual={keys}")
    if len({row.get("operationId") for row in rows}) != 45 or inventory.get("operationTransactions") != 45:
        findings.add("F-OP-CLOSURE", "edgeInventory", "45 unique operation transactions required")
    for row in rows:
        assertions = " ".join(row.get("postgresAssertions", []))
        expected_owner = ("internal.wfm.schedule-optimization.complete"
                          if row.get("operationId") == "modern.wfm.schedule.optimize"
                          and row.get("table") in {"tme_wfm_schedule_candidates",
                                                   "tme_wfm_constraint_evaluation_receipts"}
                          else row.get("operationId"))
        if row.get("transactionOwner") != expected_owner:
            findings.add("F-EDGE-OWNER", row.get("edgeId", ""),
                         f"expected={expected_owner} got={row.get('transactionOwner')}")
        if row.get("classification") == "FORBIDDEN_EDGE":
            for token in ("rowCount", "no outbox", "unchanged", "must not contain"):
                if token not in assertions:
                    findings.add("F-FORBIDDEN-ASSERT", row.get("edgeId", ""), token)
    commands = [row for row in oracle.get("operations", []) if row.get("mode") == "COMMAND"]
    queries = [row for row in oracle.get("operations", []) if row.get("mode") == "QUERY"]
    if len(fixture.get("allCommandCasScenarios", [])) != len(commands) or len(commands) != 81:
        findings.add("F-COMMAND-COUNT", "allCommandCasScenarios", str(len(fixture.get("allCommandCasScenarios", []))))
    if len(fixture.get("allQueryReadOnlyScenarios", [])) != len(queries) or len(queries) != 19:
        findings.add("F-QUERY-COUNT", "allQueryReadOnlyScenarios", str(len(fixture.get("allQueryReadOnlyScenarios", []))))
    if fixture.get("postgresMajors") != [16, 18]:
        findings.add("F-PG-MAJORS", "postgresMajors", str(fixture.get("postgresMajors")))
    required_cases = {"identical-replay", "different-digest-conflict", "stale-If-Match", "foreign-tenant",
                      "wrong-purpose", "owner-proof-unavailable", "failure-after-each-ordered-step"}
    for row in fixture.get("allCommandCasScenarios", []):
        if not required_cases <= set(row.get("cases", [])):
            findings.add("F-COMMAND-CASES", row.get("operationId", ""), str(row.get("cases")))
    if {row.get("operationId") for row in fixture.get("allCommandCasScenarios", [])} != {
            row.get("operationId") for row in commands}:
        findings.add("F-COMMAND-CLOSURE", "allCommandCasScenarios", "operation IDs differ from sealed oracle")
    if {row.get("operationId") for row in fixture.get("allQueryReadOnlyScenarios", [])} != {
            row.get("operationId") for row in queries}:
        findings.add("F-QUERY-CLOSURE", "allQueryReadOnlyScenarios", "operation IDs differ from sealed oracle")
    expected_handlers = {
        "internal.recruiting.hire-handoff.acknowledge",
        "internal.contingent.access-expiry.enforce",
        "internal.wfm.schedule-optimization.complete",
        "internal.ai.policy-evaluation.complete",
    }
    handler_rows = fixture.get("internalHandlerTransactions", [])
    if {row.get("handlerId") for row in handler_rows} != expected_handlers:
        findings.add("F-HANDLER-CLOSURE", "internalHandlerTransactions", str(handler_rows))
    handler_cases = {"minimum-valid", "identical-replay", "different-result-digest-conflict",
                     "owner-proof-unavailable", "failure-after-inbox-and-each-domain/outbox-step"}
    for row in handler_rows:
        if set(row.get("cases", [])) != handler_cases:
            findings.add("F-HANDLER-CASES", str(row.get("handlerId")), str(row.get("cases")))
    required_evidence = fixture.get("requiredEvidence", {})
    if required_evidence.get("expectedScenarioCounts") != {
        "commands": 81, "queries": 19, "queryCases": 114, "edges": 58,
        "handlers": 4, "commandRollbackFaults": 372, "handlerRollbackFaults": 20,
        "sameTransactionDecisionReceipts": 14,
    }:
        findings.add("F-EVIDENCE-COUNTS", "requiredEvidence", str(required_evidence.get("expectedScenarioCounts")))
    if required_evidence.get("executionControl") != {
        "semaphore": "hris-verification", "directRunnerMustAcquire": True,
        "parentHeldModeRequiresNameAndParentPidAttestation": True,
        "checkMustNotModifyEvidenceBytes": True,
    }:
        findings.add("F-EXECUTION-CONTROL", "requiredEvidence", str(required_evidence.get("executionControl")))


def check_public_event_ownership(oracle: dict[str, Any], findings: Findings) -> None:
    expected = INDEPENDENT_PUBLIC_EVENT_OWNER_SESSIONS
    if len(expected) != 86 or Counter(expected.values()) != Counter(
            {"HRIS-HRM": 33, "HRIS-PER": 29, "HRIS-SYS": 18, "HRIS-TIM": 6}):
        findings.add("O-OWNERSHIP-INDEPENDENT-CONSTANT", "validator", "reviewer expected set is malformed")
    produced: dict[str, tuple[str, str, str]] = {}
    for operation in oracle.get("operations", []):
        for event in operation.get("events", []):
            name = event.get("eventName")
            if name in produced:
                findings.add("O-OWNERSHIP-DUPLICATE-PRODUCER", str(name), str(produced[name]))
            produced[name] = (operation.get("session"), "PUBLIC_COMMAND", operation.get("operationId"))
    for handler in oracle.get("systemHandlers", []):
        event = handler.get("event") or {}
        name = event.get("eventName")
        if not name:
            continue
        if name in produced:
            findings.add("O-OWNERSHIP-DUPLICATE-PRODUCER", str(name), str(produced[name]))
        produced[name] = (event.get("refetchContract", {}).get("ownerSession"),
                          "INTERNAL_TRIGGER_PUBLIC_EVENT", handler.get("handlerId"))
    if set(produced) != set(expected):
        findings.add("O-OWNERSHIP-PUBLIC-SET", "public v2 events",
                     f"missing={sorted(set(expected)-set(produced))} extra={sorted(set(produced)-set(expected))}")
    for name, owner_session in expected.items():
        if produced.get(name, (None,))[0] != owner_session:
            findings.add("O-OWNERSHIP-PRODUCER-SESSION", name,
                         f"expected={owner_session} actual={produced.get(name)}")
    contract = oracle.get("publicEventOwnership", {})
    if (contract.get("expectedOwnedEventCount") != 86
            or contract.get("expectedOwnerCountsBySession") !=
            {"HRIS-HRM": 33, "HRIS-PER": 29, "HRIS-TIM": 6, "HRIS-SYS": 18}):
        findings.add("O-OWNERSHIP-COUNT", "publicEventOwnership", str(contract.get("expectedOwnerCountsBySession")))
    migration = contract.get("registerMigration", {})
    if (migration.get("currentModernEventRows") != 32
            or migration.get("currentRowsRole") != "V1_PREDECESSOR_OWNERSHIP_EVIDENCE_ONLY"
            or migration.get("unownedSuccessorAllowed") is not False
            or migration.get("duplicateOwnerAllowed") is not False):
        findings.add("O-OWNERSHIP-REGISTER-MIGRATION", "publicEventOwnership", str(migration))
    entries = contract.get("events", [])
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in entries:
        grouped[str(row.get("eventName"))].append(row)
    if set(grouped) != set(expected):
        findings.add("O-OWNERSHIP-REGISTER-SET", "publicEventOwnership.events",
                     f"missing={sorted(set(expected)-set(grouped))} extra={sorted(set(grouped)-set(expected))}")
    for name, expected_session in expected.items():
        rows = grouped.get(name, [])
        if len(rows) != 1:
            findings.add("O-OWNERSHIP-CARDINALITY", name, f"rows={len(rows)}")
            continue
        row = rows[0]
        actual = produced.get(name, (None, None, None))
        if (row.get("primaryOwnerSession"), row.get("producerKind"), row.get("producerId"),
                row.get("contractBoundary"), row.get("ownershipCardinality")) != \
                (expected_session, actual[1], actual[2], "PUBLIC_ASYNCAPI_EVENT", "EXACTLY_ONE"):
            findings.add("O-OWNERSHIP-BINDING", name, f"entry={row} produced={actual}")


def check_oracle(oracle: dict[str, Any], fixture: dict[str, Any]) -> Findings:
    findings = Findings()
    if ACTIVE_PROFILE == SUCCESSOR_PROFILE:
        check_hashes(oracle, fixture, findings)
        check_successor_oracle(oracle, fixture, findings)
        check_successor_fixture(fixture, oracle, findings)
        return findings
    check_hashes(oracle, fixture, findings)
    check_builder_independence(findings)
    operations = oracle.get("operations", [])
    commands = [row for row in operations if row.get("mode") == "COMMAND"]
    queries = [row for row in operations if row.get("mode") == "QUERY"]
    if (len(operations), len(commands), len(queries), len({row.get("operationId") for row in operations})) != (100, 81, 19, 100):
        findings.add("O-SCOPE", "operations", f"all={len(operations)} command={len(commands)} query={len(queries)}")
    primary = [row.get("events", [{}])[0].get("eventName") for row in commands]
    if len(primary) != 81 or len(set(primary)) != 81:
        findings.add("O-PRIMARY-EVENTS", "commands", f"primary={len(primary)} unique={len(set(primary))}")
    all_events = [event.get("eventName") for row in commands for event in row.get("events", [])]
    all_events.extend(handler.get("event", {}).get("eventName") for handler in oracle.get("systemHandlers", []))
    if len(all_events) != 86 or len(set(all_events)) != 86:
        findings.add("O-EVENT-SEMANTIC-COUNT", "events", f"rows={len(all_events)} unique={len(set(all_events))}")
    for operation in operations:
        check_selectors(operation, findings)
        check_input_effects(operation, findings)
        check_dml(operation, findings)
        for event in operation.get("events", []):
            check_event(operation, event, findings)
    for handler in oracle.get("systemHandlers", []):
        if handler.get("event"):
            check_event({"operationId": handler.get("handlerId", "handler")}, handler["event"], findings)
    check_public_event_ownership(oracle, findings)
    check_lineage(oracle, findings)
    check_value_objects(oracle, findings)
    check_schema_oracle(oracle, findings)
    check_critical_semantics(oracle, findings)
    check_fixture(fixture, oracle, findings)
    return findings


def candidate_request_map(exact: dict[str, Any]) -> dict[str, dict[str, dict[str, Any]]]:
    result: dict[str, dict[str, dict[str, Any]]] = {}
    for operation in exact.get("operationBindings", []):
        rows: dict[str, dict[str, Any]] = {}
        for section in ("pathParameters", "queryParameters", "headers", "body"):
            for field in operation.get("requestSchema", {}).get(section, []):
                rows[f"{section}.{field['name']}"] = field
        result[operation["operationId"]] = rows
    return result


def check_refetch_contract(findings: Findings, code: str, subject: str,
                           expected: dict[str, Any], actual: dict[str, Any]) -> None:
    """Require the full reviewer-owned refetch PEP, not a named policy placeholder."""
    expected_projection = {
        "mode": expected.get("mode"),
        "ownerSession": expected.get("ownerSession"),
        "entityType": expected.get("entityType"),
        "endpoint": expected.get("endpoint"),
        "allowedConsumerSessions": expected.get("pep", {}).get("consumerSessionAllowlist", []),
        "purposeCodes": expected.get("pep", {}).get("purpose", []),
        "fieldAllowlist": expected.get("allowedFields", []),
        "pepContract": expected.get("pep"),
        "version": expected.get("version"),
        "asOf": expected.get("asOf"),
    }
    actual_projection = {
        "mode": actual.get("mode"),
        "ownerSession": actual.get("ownerSession"),
        "entityType": actual.get("entityType"),
        "endpoint": actual.get("endpoint"),
        "allowedConsumerSessions": actual.get("allowedConsumerSessions", []),
        "purposeCodes": actual.get("purposeCodes", []),
        "fieldAllowlist": actual.get("fieldAllowlist", actual.get("allowedFields", [])),
        "pepContract": actual.get("pepContract"),
        "version": actual.get("version"),
        "asOf": actual.get("asOf"),
    }
    expected_allowed = expected.get("mode") != "FORBIDDEN"
    if actual.get("allowed") is not expected_allowed or actual_projection != expected_projection:
        findings.add(code, subject,
                     f"expectedAllowed={expected_allowed} expected={expected_projection} got={actual_projection}")


def check_candidate(oracle: dict[str, Any], candidate: dict[str, Any], exact: dict[str, Any],
                    event_registry: dict[str, Any], lineage: dict[str, Any],
                    ownership_rows: list[dict[str, str]], ssot: dict[str, Any],
                    semantic: dict[str, Any], public_identity: dict[str, Any]) -> Findings:
    findings = Findings()
    subject_paths = {
        "operationSsot": CANDIDATE_SSOT_PATH,
        "exact": CANDIDATE_EXACT_PATH,
        "events": CANDIDATE_EVENTS_PATH,
        "causal": CANDIDATE_PATH,
        "lineage": CANDIDATE_LINEAGE_PATH,
        "ownership": CANDIDATE_OWNERSHIP_PATH,
        "semanticBindings": CANDIDATE_SEMANTIC_PATH,
        "publicIdentity": CANDIDATE_IDENTITY_PATH,
    }
    for label, expected_hash in FINAL_FROZEN_SUBJECT_PINS.items():
        path = subject_paths[label]
        actual_hash = file_hash(path) if path.is_file() else None
        if actual_hash != expected_hash:
            findings.add("C-FROZEN-SUBJECT-PIN", label,
                         f"expected={expected_hash} got={actual_hash}")
    if oracle.get("finalFrozenReviewSubject", {}).get("pins") != FINAL_FROZEN_SUBJECT_PINS:
        findings.add("C-FROZEN-REVIEW-SUBJECT", "oracle.finalFrozenReviewSubject",
                     "frozen subject pin set differs from independent code authority")
    for label, document in (("semanticBindings", semantic), ("publicIdentity", public_identity)):
        if canonical_hash(document) != document.get("sealedPayloadSha256"):
            findings.add("C-FROZEN-SUBJECT-SEMANTIC-SEAL", label, "invalid semantic seal")
    check_physical_transaction_infrastructure(oracle, candidate, ssot, findings)
    expected = op_index(oracle)
    actual = op_index(candidate)
    if set(expected) != set(actual):
        findings.add("C-OP-CLOSURE", "candidate", f"missing={sorted(set(expected)-set(actual))} extra={sorted(set(actual)-set(expected))}")
    request_map = candidate_request_map(exact)
    event_by_name = candidate_event_index(event_registry)
    registry_rows = event_registry.get("eventPayloadSchemas", [])
    if (len(registry_rows) != len(INDEPENDENT_PUBLIC_EVENT_OWNER_SESSIONS)
            or set(event_by_name) != set(INDEPENDENT_PUBLIC_EVENT_OWNER_SESSIONS)):
        findings.add(
            "C-EVENT-REGISTRY-CLOSED-SET",
            "eventPayloadSchemas",
            f"expected={len(INDEPENDENT_PUBLIC_EVENT_OWNER_SESSIONS)} gotRows={len(registry_rows)} "
            f"gotUnique={len(event_by_name)} "
            f"missing={sorted(set(INDEPENDENT_PUBLIC_EVENT_OWNER_SESSIONS)-set(event_by_name))} "
            f"extra={sorted(set(event_by_name)-set(INDEPENDENT_PUBLIC_EVENT_OWNER_SESSIONS))}",
        )
    table_index = exact_table_index(exact)
    exact_operations = {row.get("operationId"): row for row in exact.get("operationBindings", [])}
    record_schemas = {row.get("schemaId"): row for row in exact.get("recordSchemas", [])}
    actual_table_names = set(table_index)
    if actual_table_names != INDEPENDENT_EXPECTED_TABLES:
        findings.add("C-DDL-CLOSED-SET", "tableSpecifications",
                     f"expected={len(INDEPENDENT_EXPECTED_TABLES)} got={len(actual_table_names)} "
                     f"missing={sorted(INDEPENDENT_EXPECTED_TABLES-actual_table_names)} "
                     f"extra={sorted(actual_table_names-INDEPENDENT_EXPECTED_TABLES)}")
    for table_name, (expected_columns, state_check) in INDEPENDENT_REQUIRED_DELTAS.items():
        table = table_index.get(table_name)
        if table is None:
            findings.add("C-DDL-DELTA-TABLE", table_name, "required independent schema delta absent")
            continue
        for column_name, sql_type in expected_columns.items():
            column = table["_columns"].get(column_name)
            if column is None:
                findings.add("C-DDL-DELTA-COLUMN", f"{table_name}.{column_name}", sql_type)
            elif str(column.get("sqlType", "")).upper() != sql_type:
                findings.add("C-DDL-DELTA-TYPE", f"{table_name}.{column_name}",
                             f"expected={sql_type} got={column.get('sqlType')}")
        if state_check:
            column_name, allowed = state_check
            expressions = " ".join(str(row.get("expression", "")) for row in table.get("checks", [])
                                   if column_name in row.get("columns", []))
            if not expressions:
                findings.add("C-DDL-DELTA-CHECK", f"{table_name}.{column_name}", "named CHECK absent")
            else:
                missing = sorted(state for state in allowed if f"'{state}'" not in expressions)
                if missing:
                    findings.add("C-DDL-DELTA-CHECK", f"{table_name}.{column_name}",
                                 f"missing={missing} expression={expressions}")
    for schema_id, expected_schema in oracle.get("valueObjects", {}).items():
        actual_schema = record_schemas.get(schema_id)
        if actual_schema is None:
            findings.add("C-VALUE-OBJECT-MISSING", schema_id, "reviewed nested request schema absent")
            continue
        if actual_schema.get("kind") != "OBJECT" or actual_schema.get("additionalProperties") is not False:
            findings.add("C-VALUE-OBJECT-SHAPE", schema_id, "must be a closed OBJECT")
        expected_fields = {row["name"]: row for row in expected_schema.get("fields", [])}
        actual_fields = {row.get("name"): row for row in actual_schema.get("fields", [])}
        if set(expected_fields) != set(actual_fields):
            findings.add("C-VALUE-OBJECT-FIELDS", schema_id,
                         f"expected={sorted(expected_fields)} got={sorted(actual_fields)}")
        for name in sorted(set(expected_fields) & set(actual_fields)):
            for key in ("type", "required", "wireType"):
                if expected_fields[name].get(key) != actual_fields[name].get(key):
                    findings.add("C-VALUE-OBJECT-FIELD", f"{schema_id}:{name}",
                                 f"{key}: expected={expected_fields[name].get(key)} got={actual_fields[name].get(key)}")
            expected_ref = expected_fields[name].get("referenceContract") or {}
            actual_ref = actual_fields[name].get("referenceContract") or {}
            if expected_ref != actual_ref:
                findings.add("C-VALUE-OBJECT-REFERENCE", f"{schema_id}:{name}",
                             f"expected={expected_ref} got={actual_ref}")
        forbidden_client_fields = set(expected_schema.get("serverGeneratedFields", [])) & set(actual_fields)
        if forbidden_client_fields:
            findings.add("C-VALUE-OBJECT-SERVER-FIELDS", schema_id,
                         ",".join(sorted(forbidden_client_fields)))
    for operation_id, target in expected.items():
        row = actual.get(operation_id)
        if row is None:
            continue
        if row.get("mode") != target.get("mode"):
            findings.add("C-MODE", operation_id, f"expected {target.get('mode')} got {row.get('mode')}")
        actual_request = request_map.get(operation_id, {})
        target_request = {item["source"]: item for item in target.get("requestFields", [])}
        if set(actual_request) != set(target_request):
            findings.add("C-REQUEST-SUCCESSOR", operation_id,
                         f"expected={sorted(target_request)} got={sorted(actual_request)}")
        for source in sorted(set(actual_request) & set(target_request)):
            expected_field = target_request[source]
            actual_field = actual_request[source]
            for key in ("type", "required", "sensitivity", "tokenization", "schemaRef", "itemSchemaRef",
                        "minItems", "maxItems", "uniqueBy", "canonicalOrder"):
                if actual_field.get(key) != expected_field.get(key):
                    findings.add("C-REQUEST-FIELD", f"{operation_id}:{source}",
                                 f"{key}: expected={expected_field.get(key)} got={actual_field.get(key)}")
            expected_ref = expected_field.get("referenceContract") or {}
            actual_ref = actual_field.get("referenceContract") or {}
            if expected_ref != actual_ref:
                findings.add("C-REQUEST-REFERENCE", f"{operation_id}:{source}",
                             f"expected={expected_ref} got={actual_ref}")
        for forbidden in target.get("forbiddenRequestFields", []):
            if forbidden.get("source") in actual_request:
                findings.add("C-FORBIDDEN-CALLER-FIELD", f"{operation_id}:{forbidden['source']}",
                             forbidden.get("reason", "must be removed"))
        if target.get("mode") == "QUERY":
            text = " ".join(flatten_strings(row)).lower()
            if any(token in text for token in ("outbox", "command_receipt", "receipt write", "writesTables".lower())):
                findings.add("C-QUERY-WRITE-REFERENCE", operation_id, "query contract mentions receipt/outbox/write")
            exact_operation = exact_operations.get(operation_id, {})
            if exact_operation.get("writesTables") or row.get("writeTables") or row.get("orderedDml") or row.get("causalEvents"):
                findings.add("C-QUERY-MUTATION", operation_id,
                             f"exact={exact_operation.get('writesTables')} causal={row.get('writeTables')}")
            expected_selectors = target.get("selectors", [])
            actual_selectors = row.get("targetSelectors", row.get("selectors", []))
            selector_keys = ("source", "selectorType", "entityType", "idSpace", "sourceType", "targetTable",
                             "targetColumn", "targetSqlType", "operator", "cardinality", "tenantFilter",
                             "purposeFilter", "versionRule", "asOfRule", "causalJoin", "failure")
            expected_selector_keys = {tuple(item.get(key) for key in selector_keys) for item in expected_selectors}
            actual_selector_keys = {tuple(item.get(key) for key in selector_keys) for item in actual_selectors}
            if expected_selector_keys != actual_selector_keys:
                findings.add("C-QUERY-SELECTORS", operation_id,
                             f"expected={sorted(expected_selector_keys)} got={sorted(actual_selector_keys)}")
            read_plan = row.get("readPlan", {})
            target_plan = target.get("readPlan", {})
            if (set(read_plan.get("tables", [])) != set(target_plan.get("tables", []))
                    or not all(read_plan.get(key) is True for key in ("writesForbidden", "receiptsForbidden", "outboxForbidden"))
                    or not read_plan.get("pagination") or not read_plan.get("effectiveTime")):
                findings.add("C-QUERY-READ-PLAN", operation_id, str(read_plan))
            uses = {item.get("source"): item for item in row.get("requiredInputUses", row.get("inputEffects", []))}
            for expected_effect in target.get("inputEffects", []):
                source = expected_effect.get("source")
                actual_effect = uses.get(source)
                if actual_effect is None:
                    findings.add("C-QUERY-INPUT-MISSING", f"{operation_id}:{source}", "")
                elif not expected_effect.get("required"):
                    absence = actual_effect.get("absenceSemantics", {})
                    if absence.get("mode") != "EXPLICIT_ABSENT_BRANCH" or not absence.get("mustTestAbsentAndPresent"):
                        findings.add("C-QUERY-OPTIONAL-BRANCH", f"{operation_id}:{source}", "")
            continue
        check_post_state_ddl(operation_id, target, table_index, findings)
        root = row.get("aggregateRoot", {})
        target_root = target.get("aggregateRoot", {})
        for key in ("table", "publicIdColumn", "versionColumn", "stateColumn"):
            if root.get(key) != target_root.get(key):
                findings.add("C-ROOT", operation_id, f"{key}: expected {target_root.get(key)} got {root.get(key)}")
        candidate_selectors = root.get("selectors", row.get("selectors", []))
        target_selectors = target.get("selectors", [])
        selector_keys = ("source", "selectorType", "entityType", "idSpace", "sourceType", "targetTable",
                         "targetColumn", "targetSqlType", "operator", "cardinality", "tenantFilter",
                         "purposeFilter", "versionRule", "asOfRule", "causalJoin", "failure")
        target_keys = {tuple(x.get(key) if not isinstance(x.get(key), (dict, list))
                             else json.dumps(x.get(key), sort_keys=True) for key in selector_keys)
                       for x in target_selectors}
        candidate_keys = {tuple(x.get(key) if not isinstance(x.get(key), (dict, list))
                                else json.dumps(x.get(key), sort_keys=True) for key in selector_keys)
                          for x in candidate_selectors}
        if target_keys != candidate_keys:
            findings.add("C-SELECTORS", operation_id, f"expected={sorted(target_keys)} got={sorted(candidate_keys)}")
        selector_required = {"source", "selectorType", "entityType", "idSpace", "sourceType", "targetTable",
                             "targetColumn", "targetSqlType", "operator", "cardinality", "tenantFilter",
                             "purposeFilter", "versionRule", "asOfRule", "causalJoin"}
        for selector in candidate_selectors:
            missing = sorted(selector_required - set(selector))
            if missing or any(selector.get(key) in (None, "", [], {}) for key in selector_required):
                findings.add("C-SELECTOR-SHAPE", f"{operation_id}:{selector.get('source')}",
                             f"missing={missing}")
            target_table = selector.get("targetTable")
            target_column = selector.get("targetColumn")
            if target_table in table_index and target_column in table_index[target_table]["_columns"]:
                physical_type = table_index[target_table]["_columns"][target_column].get("sqlType")
                if selector.get("targetSqlType") != physical_type:
                    findings.add("C-SELECTOR-PHYSICAL-TYPE", f"{operation_id}:{selector.get('source')}",
                                 f"selector={selector.get('targetSqlType')} ddl={physical_type}")
        target_transition = target.get("transition", {})
        transition = row.get("transition", {})
        for key in ("preStates", "postStates", "physicalPostStateSink"):
            if transition.get(key) != target_transition.get(key):
                findings.add("C-TRANSITION", operation_id, f"{key}: expected {target_transition.get(key)} got {transition.get(key)}")
        expected_identity = target.get("identityConstraints", [])
        actual_identity = row.get("identityConstraints", row.get("publicIdentityConstraints", []))
        for constraint in expected_identity:
            kind = constraint.get("kind")
            if kind == "PATH_BODY_EQUALITY":
                matched = any(item.get("kind") == kind and item.get("left") == constraint.get("left")
                              and item.get("right") == constraint.get("right") for item in actual_identity)
            elif kind == "PAIRWISE_DISTINCT_TYPED_IDENTITIES":
                matched = any(item.get("kind") == kind
                              and set(item.get("fields", [])) == set(constraint.get("fields", []))
                              for item in actual_identity)
            else:
                matched = constraint in actual_identity
            if not matched:
                findings.add("C-PUBLIC-IDENTITY", operation_id, str(constraint))
        uses = {item.get("source"): item for item in row.get("requiredInputUses", row.get("inputEffects", []))}
        for target_effect in target.get("inputEffects", []):
            source = target_effect["source"]
            candidate_effect = uses.get(source)
            if candidate_effect is None:
                findings.add("C-INPUT-MISSING", f"{operation_id}:{source}", "")
                continue
            text = " ".join(flatten_strings(candidate_effect)).lower()
            if not target_effect.get("required"):
                absence = candidate_effect.get("absenceSemantics", {})
                if (absence.get("mode") != "EXPLICIT_ABSENT_BRANCH"
                        or not absence.get("mustTestAbsentAndPresent")):
                    findings.add("C-OPTIONAL-BRANCH", f"{operation_id}:{source}",
                                 "absent/present semantics not executable")
            if any(token in text for token in ("decision_input", "guard-only", "guard only")):
                findings.add("C-INPUT-GENERIC", f"{operation_id}:{source}", text[:300])
            expected_effects = target_effect.get("effects", [])
            actual_effects = candidate_effect.get("effects", [])
            expected_signatures = {(effect.get("kind"), effect.get("target")) for effect in expected_effects}
            actual_signatures = {(effect.get("kind"), effect.get("target")) for effect in actual_effects}
            if expected_signatures != actual_signatures:
                findings.add("C-INPUT-EFFECT-SET", f"{operation_id}:{source}",
                             f"expected={sorted(expected_signatures)} got={sorted(actual_signatures)}")
            for expected_effect in expected_effects:
                actual_effect = next((effect for effect in actual_effects
                                      if (effect.get("kind"), effect.get("target")) ==
                                      (expected_effect.get("kind"), expected_effect.get("target"))), None)
                if actual_effect is not None:
                    # physicalStorage/scalarResultRefJsonOperatorsForbidden are
                    # reviewer assertions about how the independently checked
                    # base receipt DDL must be used.  They are not candidate
                    # serialization fields.  The candidate instead has to
                    # provide exact physicalFieldBindings, checked below.
                    reviewed_effect = {
                        key: value for key, value in expected_effect.items()
                        if key not in {
                            "physicalStorage", "scalarResultRefJsonOperatorsForbidden",
                        }
                    }
                    if not contains_reviewed(reviewed_effect, actual_effect):
                        findings.add("C-INPUT-EFFECT-CONTRACT", f"{operation_id}:{source}",
                                     f"expected={reviewed_effect} got={actual_effect}")
            target_has_decision = any(x.get("kind") == "PERSISTED_DECISION_RECEIPT" for x in target_effect.get("effects", []))
            if target_has_decision:
                if not all(token in text for token in ("rule", "input", "outcome", "decision", "mutation")) or "sametransaction" not in text.replace("_", ""):
                    findings.add("C-DECISION-RECEIPT", f"{operation_id}:{source}", "same-tx rule/input/outcome/version/mutation proof absent")
                receipt_profile = candidate.get("transactionInfrastructure", {}).get(
                    "sessions", {}).get(row.get("session"), {})
                actual_decision = next(
                    (effect for effect in candidate_effect.get("effects", [])
                     if effect.get("kind") == "PERSISTED_DECISION_RECEIPT"), {}
                )
                if (actual_decision.get("physicalFieldBindings") !=
                        receipt_profile.get("decisionAuditBindings")):
                    findings.add("C-DECISION-RECEIPT-PHYSICAL", f"{operation_id}:{source}",
                                 "effect is not bound to the session's physical authorization-seal tuple")
        target_domain = [(step.get("action"), step.get("table"), step.get("role"), step.get("assignments", {}))
                         for step in target.get("orderedDml", [])
                         if step.get("role") not in {"COMMAND_RECEIPT", "TRANSACTIONAL_OUTBOX"}]
        candidate_domain = [(step.get("disposition") or step.get("action"), step.get("table"), step.get("role"),
                             candidate_assignment_map(step)) for step in row.get("orderedDml", [])
                            if step.get("role") not in {"COMMAND_RECEIPT", "TRANSACTIONAL_OUTBOX"}]
        candidate_domain_tables = {table for action, table, role, assignments in candidate_domain
                                   if action != "CALL_OWNER_PORT" and table}
        declared_causal_writes = set(row.get("writeTables", []))
        declared_exact_writes = set(exact_operations.get(operation_id, {}).get("writesTables", []))
        if declared_causal_writes != candidate_domain_tables:
            findings.add("C-WRITE-DML-CAUSALITY", operation_id,
                         f"writeTables={sorted(declared_causal_writes)} dml={sorted(candidate_domain_tables)}")
        if declared_exact_writes != candidate_domain_tables:
            findings.add("C-EXACT-DML-CAUSALITY", operation_id,
                         f"exact={sorted(declared_exact_writes)} dml={sorted(candidate_domain_tables)}")
        selector_reads = {selector.get("targetTable") for selector in candidate_selectors
                          if selector.get("targetTable") in table_index
                          and selector.get("selectorType") not in {"GENERATED_ROOT"}}
        declared_reads = set(exact_operations.get(operation_id, {}).get("readsTables", []))
        if not selector_reads <= (declared_reads | declared_exact_writes):
            findings.add("C-READ-SELECTOR-CAUSALITY", operation_id,
                         f"missingReads={sorted(selector_reads-(declared_reads|declared_exact_writes))}")
        target_shape = [(a.replace("UPDATE_CAS", "UPDATE"), t, role) for a, t, role, _ in target_domain]
        candidate_shape = [((a or "").replace("UPDATE_CAS", "UPDATE"), t, role)
                           for a, t, role, _ in candidate_domain]
        if target_shape != candidate_shape:
            findings.add("C-DML-SHAPE", operation_id, f"expected={target_shape} got={candidate_shape}")
        if target_shape == candidate_shape:
            for index, ((action, table, role, assignments), candidate_step) in enumerate(
                    zip(target_domain, candidate_domain), 1):
                candidate_assignments = candidate_step[3]
                if assignments != candidate_assignments:
                    findings.add("C-DML-ASSIGNMENTS", f"{operation_id}:{index}:{table}",
                                 f"expected={assignments} got={candidate_assignments}")
        for action, table, role, assignments in candidate_domain:
            if action == "CALL_OWNER_PORT" or not table:
                continue
            table_spec = table_index.get(table)
            if table_spec is None:
                findings.add("C-DDL-DML-TABLE", f"{operation_id}:{table}", str(action))
                continue
            unknown_columns = set(assignments) - set(table_spec["_columns"])
            if unknown_columns:
                findings.add("C-DDL-DML-COLUMN", f"{operation_id}:{table}", ",".join(sorted(unknown_columns)))
            phantom = referenced_request_sources(assignments) - set(actual_request)
            if phantom:
                findings.add("C-DML-PHANTOM-REQUEST", f"{operation_id}:{table}",
                             ",".join(sorted(phantom)))
        optional_sources = {source for source, field in actual_request.items() if not field.get("required")}
        for step in row.get("orderedDml", []):
            action = (step.get("disposition") or step.get("action") or "").upper()
            assignment_columns = set(candidate_assignment_map(step))
            if action.startswith("UPDATE"):
                immutable_updates = assignment_columns & {"tenant_id", "public_id", "created_at", "created_by", "correlation_id"}
                if immutable_updates:
                    findings.add("C-DML-IMMUTABLE-UPDATE", f"{operation_id}:{step.get('table')}",
                                 ",".join(sorted(immutable_updates)))
            for assignment in step.get("assignments", []):
                source_path = assignment.get("sourcePath") or assignment.get("source")
                target_path = assignment.get("target", "")
                if source_path not in optional_sources or "." not in target_path:
                    continue
                table, column = target_path.split(".", 1)
                column_spec = table_index.get(table, {}).get("_columns", {}).get(column, {})
                if column_spec and column_spec.get("nullable") is False and column_spec.get("default") is None:
                    findings.add("C-OPTIONAL-NOT-NULL", f"{operation_id}:{source_path}", target_path)
        envelope = row.get("transactionEnvelope", {})
        envelope_text = json.dumps(envelope, ensure_ascii=False, sort_keys=True).lower()
        required_envelope_tokens = ("claim", "replay", "complete", "receipt", "outbox", "same", "rollback")
        if not envelope or not all(token in envelope_text for token in required_envelope_tokens):
            findings.add("C-TX-ENVELOPE", operation_id,
                         "operation-scoped receipt claim/replay, completion, same-tx outbox and rollback contract absent")
        elif not contains_reviewed(target.get("transactionEnvelope", {}), envelope):
            findings.add("C-TX-ENVELOPE-EXACT", operation_id,
                         f"expected={target.get('transactionEnvelope')} got={envelope}")
        expected_names = [event.get("eventName") for event in target.get("events", [])]
        got_names = candidate_event_names(row)
        if expected_names != got_names:
            findings.add("C-EVENT-NAMES", operation_id, f"expected={expected_names} got={got_names}")
        for target_event in target.get("events", []):
            candidate_event = next((event for event in row.get("causalEvents", [])
                                    if event.get("eventName") == target_event["eventName"]), None)
            if candidate_event is None:
                continue
            policy = candidate_event.get("deliveryPolicy", {})
            expected_fields = [field.get("name") for field in target_event.get("fields", [])]
            candidate_fields = candidate_event.get("payloadFields", [])
            if candidate_fields != expected_fields:
                findings.add("C-EVENT-FIELDS", f"{operation_id}:{target_event['eventName']}",
                             f"expected={expected_fields} got={candidate_fields}")
            expected_audience = target_event.get("audience", {})
            if (set(policy.get("allowedConsumerSessions", [])) != set(expected_audience.get("allowedConsumerSessions", []))
                    or set(policy.get("allowedPurposeCodes", [])) != set(expected_audience.get("allowedPurposes", []))
                    or set(policy.get("fieldAllowlist", [])) != set(expected_fields)
                    or policy.get("denyUnknownConsumerOrPurpose") is not True
                    or not policy.get("pep")):
                findings.add("C-EVENT-AUDIENCE", f"{operation_id}:{target_event['eventName']}", "")
            source_rows = {item.get("field"): item for item in candidate_event.get("payloadFieldSources", [])}
            for expected_field in target_event.get("fields", []):
                field_name = expected_field.get("name")
                source_row = source_rows.get(field_name)
                if source_row is None:
                    findings.add("C-EVENT-SOURCE-MISSING", f"{operation_id}:{target_event['eventName']}:{field_name}", "")
                    continue
                candidate_source = str(source_row.get("source", ""))
                expected_source = str(expected_field.get("source", ""))
                if candidate_source != expected_source:
                    findings.add("C-EVENT-SOURCE", f"{operation_id}:{target_event['eventName']}:{field_name}",
                                 f"expected={expected_source} got={candidate_source}")
                if (source_row.get("sourceKind") in {"VALIDATED_REQUEST", "REQUEST", "SOURCE_REQUEST_FIELD"}
                        and field_name != "correlationId"):
                    findings.add("C-EVENT-REQUEST-MIRROR", f"{operation_id}:{target_event['eventName']}:{field_name}",
                                 candidate_source)
            refetch = candidate_event.get("consumerRefetch", {})
            expected_refetch = target_event.get("refetchContract", {})
            check_refetch_contract(findings, "C-EVENT-REFETCH-CONTRACT",
                                   f"{operation_id}:{target_event['eventName']}", expected_refetch, refetch)
            registry = event_by_name.get(target_event["eventName"])
            if registry is None:
                findings.add("C-EVENT-REGISTRY-ORPHAN", target_event["eventName"], operation_id)
            else:
                registry_rows = registry.get("fields", [])
                registry_fields = [field.get("name") for field in registry_rows]
                if registry_fields != expected_fields:
                    findings.add("C-EVENT-REGISTRY-FIELDS", target_event["eventName"],
                                 f"expected={expected_fields} got={registry_fields}")
                expected_types = {field.get("name"): field.get("type") for field in target_event.get("fields", [])}
                registry_types = {field.get("name"): field.get("type") for field in registry_rows}
                if expected_types != registry_types:
                    findings.add("C-EVENT-REGISTRY-TYPES", target_event["eventName"],
                                 f"expected={expected_types} got={registry_types}")
                registry_policy = registry.get("deliveryPolicy", {})
                if (set(registry_policy.get("allowedConsumerSessions", [])) !=
                        set(expected_audience.get("allowedConsumerSessions", []))
                        or set(registry_policy.get("allowedPurposeCodes", [])) !=
                        set(expected_audience.get("allowedPurposes", []))
                        or set(registry_policy.get("fieldAllowlist", [])) != set(expected_fields)
                        or registry_policy.get("denyUnknownConsumerOrPurpose") is not True
                        or not registry_policy.get("pep")):
                    findings.add("C-EVENT-REGISTRY-AUDIENCE", target_event["eventName"],
                                 str(registry_policy))
    # Explicit forbidden edges must remain absent from both writesTables and DML.
    for operation_id, table in FORBIDDEN_EDGE_KEYS:
        row = actual.get(operation_id, {})
        mentioned = table in row.get("writeTables", []) or any(step.get("table") == table for step in row.get("orderedDml", []))
        if mentioned:
            findings.add("C-FORBIDDEN-EDGE", f"{operation_id}:{table}", "candidate reintroduced forbidden coupling")
    target_handlers = {row.get("handlerId") for row in oracle.get("systemHandlers", [])}
    actual_handlers = {row.get("handlerId") for row in candidate.get("internalConsumerHandlers", [])}
    if target_handlers != actual_handlers:
        findings.add("C-HANDLERS", "internalConsumerHandlers",
                     f"missing={sorted(target_handlers-actual_handlers)} extra={sorted(actual_handlers-target_handlers)}")
    target_handler_rows = {row.get("handlerId"): row for row in oracle.get("systemHandlers", [])}
    actual_handler_rows = {row.get("handlerId"): row for row in candidate.get("internalConsumerHandlers", [])}
    standard_event_fields = {"aggregateId", "fromState", "toState", "aggregateVersion", "occurredAt", "correlationId"}
    for handler_id, expected_handler in target_handler_rows.items():
        actual_handler = actual_handler_rows.get(handler_id)
        if actual_handler is None:
            continue
        expected_root = expected_handler.get("aggregateRoot", {})
        actual_root = actual_handler.get("aggregateRoot", {})
        for key in ("table", "stateColumn"):
            actual_value = actual_root.get(key) if actual_root else (
                actual_handler.get("aggregateRootTable") if key == "table" else actual_handler.get("stateColumn"))
            if actual_value != expected_root.get(key):
                findings.add("C-HANDLER-ROOT", handler_id,
                             f"{key}: expected={expected_root.get(key)} got={actual_value}")
        for key in ("preStates", "postStates"):
            if actual_handler.get(key) != expected_root.get(key):
                findings.add("C-HANDLER-TRANSITION", handler_id,
                             f"{key}: expected={expected_root.get(key)} got={actual_handler.get(key)}")
        expected_writes = {(row["table"], row["action"].replace("UPDATE_CAS", "UPDATE"))
                           for row in expected_handler.get("writes", [])}
        actual_writes = {(table, action) for table, action in actual_handler.get("writeDispositions", {}).items()}
        if expected_writes != actual_writes:
            findings.add("C-HANDLER-WRITES", handler_id,
                         f"expected={sorted(expected_writes)} got={sorted(actual_writes)}")
        expected_event = expected_handler.get("event", {})
        event_name = expected_event.get("eventName")
        if actual_handler.get("emits") != [event_name]:
            findings.add("C-HANDLER-EVENT", handler_id,
                         f"expected={[event_name]} got={actual_handler.get('emits')}")
        expected_facts = {field["name"]: field["source"] for field in expected_event.get("fields", [])
                          if field["name"] not in standard_event_fields}
        actual_facts = dict(actual_handler.get("facts", []))
        if expected_facts != actual_facts:
            findings.add("C-HANDLER-FACTS", handler_id,
                         f"expected={expected_facts} got={actual_facts}")
        expected_audience = expected_event.get("audience", {})
        policy = actual_handler.get("policy", {})
        if (set(policy.get("allowedConsumerSessions", [])) != set(expected_audience.get("allowedConsumerSessions", []))
                or set(policy.get("purposeCodes", [])) != set(expected_audience.get("allowedPurposes", []))
                or not policy.get("pep") or policy.get("refetchAllowed") is not False):
            findings.add("C-HANDLER-AUDIENCE", handler_id, str(policy))
        idempotency = actual_handler.get("idempotency", {})
        if not idempotency.get("key") or not idempotency.get("scope") or not idempotency.get("duplicateResult"):
            findings.add("C-HANDLER-IDEMPOTENCY", handler_id, str(idempotency))
        transaction_text = " ".join(actual_handler.get("orderedTransactionSteps", [])) + " " + str(actual_handler.get("failureSemantics", ""))
        for table, _ in expected_writes:
            if table not in transaction_text:
                findings.add("C-HANDLER-ORDERED-DML", handler_id, table)
        if event_name not in transaction_text or "ROLL" not in transaction_text.upper() or "ATOMIC" not in transaction_text.upper():
            findings.add("C-HANDLER-ATOMICITY", handler_id, transaction_text)
        registry = event_by_name.get(event_name)
        expected_fields = [field["name"] for field in expected_event.get("fields", [])]
        if registry is None:
            findings.add("C-HANDLER-EVENT-REGISTRY", handler_id, str(event_name))
        elif [field.get("name") for field in registry.get("fields", [])] != expected_fields:
            findings.add("C-HANDLER-EVENT-FIELDS", handler_id,
                         f"expected={expected_fields} got={[field.get('name') for field in registry.get('fields', [])]}")

    # Public event schemas form an absolute closed boundary.  Validate every
    # schema—including handler-produced facts—against the reviewer-owned PEP
    # and primary-owner map, rather than accepting a policy name as proof.
    expected_public_events: dict[str, dict[str, Any]] = {}
    for operation in oracle.get("operations", []):
        for event in operation.get("events", []):
            expected_public_events[event["eventName"]] = event
    for handler in oracle.get("systemHandlers", []):
        event = handler.get("event", {})
        if event.get("eventName"):
            expected_public_events[event["eventName"]] = event
    if set(expected_public_events) != set(INDEPENDENT_PUBLIC_EVENT_OWNER_SESSIONS):
        findings.add("C-INDEPENDENT-EVENT-BOUNDARY", "reviewerOwnerMap",
                     f"oracle={len(expected_public_events)} ownerMap={len(INDEPENDENT_PUBLIC_EVENT_OWNER_SESSIONS)}")
    for event_name, expected_event in expected_public_events.items():
        registry = event_by_name.get(event_name)
        if registry is None:
            continue
        expected_owner = INDEPENDENT_PUBLIC_EVENT_OWNER_SESSIONS[event_name]
        if registry.get("session") != expected_owner:
            findings.add("C-EVENT-REGISTRY-OWNER", event_name,
                         f"expected={expected_owner} got={registry.get('session')}")
        expected_fields = {row["name"]: row for row in expected_event.get("fields", [])}
        actual_fields = {row.get("name"): row for row in registry.get("fields", [])}
        for field_name, expected_field in expected_fields.items():
            actual_field = actual_fields.get(field_name)
            if actual_field is not None and not contains_reviewed(expected_field, actual_field):
                findings.add("C-EVENT-REGISTRY-FIELD-CONTRACT", f"{event_name}:{field_name}",
                             f"expected={expected_field} got={actual_field}")
        expected_audience = expected_event.get("audience", {})
        delivery = registry.get("deliveryPolicy", {})
        if (delivery.get("classification") != expected_audience.get("classification")
                or set(delivery.get("allowedConsumerSessions", [])) !=
                   set(expected_audience.get("allowedConsumerSessions", []))
                or set(delivery.get("allowedPurposeCodes", [])) !=
                   set(expected_audience.get("allowedPurposes", []))
                or set(delivery.get("fieldAllowlist", [])) != set(expected_fields)
                or delivery.get("denyUnknownConsumerOrPurpose") is not True
                or not delivery.get("pep")):
            findings.add("C-EVENT-REGISTRY-AUDIENCE-ABSOLUTE", event_name, str(delivery))
        check_refetch_contract(findings, "C-EVENT-REGISTRY-REFETCH-CONTRACT", event_name,
                               expected_event.get("refetchContract", {}),
                               registry.get("consumerRefetchPolicy", {}))

    if len(ownership_rows) != 525:
        findings.add("C-OWNERSHIP-TOTAL", "g3-contract-primary-ownership-register.csv",
                     f"expected=525 got={len(ownership_rows)}")
    modern_owner_rows = [row for row in ownership_rows if row.get("contract_kind") == "MODERN_EVENT"]
    owner_counts = Counter(row.get("contract_id") for row in modern_owner_rows)
    if (len(modern_owner_rows) != 86
            or set(owner_counts) != set(INDEPENDENT_ACTIVE_PUBLIC_EVENT_OWNER_SESSIONS)
            or any(count != 1 for count in owner_counts.values())):
        findings.add("C-OWNERSHIP-EVENT-CLOSED-SET", "MODERN_EVENT",
                     f"expectedRows=86 gotRows={len(modern_owner_rows)} "
                     f"missing={sorted(set(INDEPENDENT_ACTIVE_PUBLIC_EVENT_OWNER_SESSIONS)-set(owner_counts))} "
                     f"extra={sorted(set(owner_counts)-set(INDEPENDENT_ACTIVE_PUBLIC_EVENT_OWNER_SESSIONS))} "
                     f"duplicates={sorted(name for name, count in owner_counts.items() if count != 1)}")
    legacy_modern = sorted(row.get("contract_id", "") for row in modern_owner_rows
                           if row.get("contract_id", "").endswith(".v1")
                           and row.get("contract_id")
                           not in LISTENING_SUCCESSOR_PUBLIC_EVENT_STREAMS)
    if legacy_modern:
        findings.add("C-OWNERSHIP-V1-RESIDUAL", "MODERN_EVENT", str(legacy_modern))
    owner_by_event = {row.get("contract_id"): row for row in modern_owner_rows}
    for event_name, owner_session in INDEPENDENT_ACTIVE_PUBLIC_EVENT_OWNER_SESSIONS.items():
        owner_row = owner_by_event.get(event_name)
        if owner_row is None:
            continue
        is_listening_successor = event_name in LISTENING_SUCCESSOR_PUBLIC_EVENT_STREAMS
        expected_register_ref = (
            f"{LISTENING_SUCCESSOR_AUTHORITY_PATH.name}#{event_name}"
            if is_listening_successor
            else f"{CANDIDATE_EVENTS_PATH.name}#{event_name}"
        )
        if (owner_row.get("owner_session") != owner_session
                or owner_row.get("status") != "SEALED_G3_PRIMARY_OWNER"
                or owner_row.get("source_register_ref") != expected_register_ref
                or not owner_row.get("primary_slice_id")
                or not owner_row.get("source_semantic_ref")
                or (is_listening_successor and (
                    owner_row.get("primary_slice_id") != "MOD-SYS-LISTEN"
                    or owner_row.get("source_semantic_ref") != LISTENING_CAPABILITY
                    or owner_row.get("rationale")
                    != "LISTENING_SUCCESSOR_STREAM_AUTHORITY_OWNER"
                ))):
            findings.add("C-OWNERSHIP-EVENT-ROW", event_name,
                         f"expectedOwner={owner_session} expectedRef={expected_register_ref} got={owner_row}")
    # Compare all 32 predecessor mappings, not just arithmetic totals.
    target_lineage = {row["predecessorEvent"]: row for row in oracle.get("eventSuccessorLineage", [])}
    actual_lineage = {row.get("predecessorEvent"): row for row in lineage.get("lineage", [])}
    if set(target_lineage) != set(actual_lineage):
        findings.add("C-LINEAGE-CLOSURE", "lineage", f"expected={len(target_lineage)} got={len(actual_lineage)}")
    for name, target_row in target_lineage.items():
        actual_row = actual_lineage.get(name, {})
        if actual_row.get("disposition") != target_row.get("disposition") or actual_row.get("successorEvents") != target_row.get("successorEvents"):
            findings.add("C-LINEAGE-MAP", name,
                         f"expected={target_row.get('successorEvents')} got={actual_row.get('successorEvents')}")
        actual_contracts = {row.get("eventName"): row for row in actual_row.get("successorContracts", [])}
        if set(actual_contracts) != set(actual_row.get("successorEvents", [])):
            findings.add("C-LINEAGE-CONTRACT-SET", name,
                         f"contracts={sorted(actual_contracts)} successors={actual_row.get('successorEvents')}")
        for expected_contract in target_row.get("successorContracts", []):
            event_name = expected_contract["eventName"]
            actual_contract = actual_contracts.get(event_name)
            if actual_contract is None:
                findings.add("C-LINEAGE-CONTRACT", f"{name}:{event_name}", "successor contract absent")
                continue
            for key in ("producerOperationId", "producerHandlerId", "producerSession"):
                expected_value = expected_contract.get(key)
                if expected_value is not None and actual_contract.get(key) != expected_value:
                    findings.add("C-LINEAGE-PRODUCER", f"{name}:{event_name}",
                                 f"{key}: expected={expected_value} got={actual_contract.get(key)}")
            if (actual_contract.get("payloadFields") != expected_contract.get("payloadFields")
                    or set(actual_contract.get("allowedConsumerSessions", [])) != set(expected_contract.get("allowedConsumerSessions", []))
                    or set(actual_contract.get("purposeCodes", [])) != set(expected_contract.get("purposeCodes", []))
                    or actual_contract.get("refetchMode") != expected_contract.get("refetchMode")
                    or set(actual_contract.get("refetchFieldExposure", [])) !=
                       set(expected_contract.get("refetchFieldExposure", []))):
                findings.add("C-LINEAGE-FIELD-CONSUMER", f"{name}:{event_name}",
                             "payload/audience/purpose differs from sealed successor")
        updates = " ".join(actual_row.get("registryUpdateSet", [])).lower()
        if not all(token in updates for token in ("asyncapi", "ownership", "trace", "producer", "consumer")):
            findings.add("C-LINEAGE-REGISTRY", name, actual_row.get("registryUpdateSet", []).__repr__())
        if actual_row.get("consumerMigration", {}).get("orphanConsumerCount") != 0:
            findings.add("C-LINEAGE-ORPHAN", name, str(actual_row.get("consumerMigration")))
        dual = actual_row.get("runtimeDualPublish", {})
        if dual.get("required") is not False or "NOT_STARTED_G3" not in str(dual.get("reason", "")):
            findings.add("C-LINEAGE-DUAL-PUBLISH", name, str(dual))
    findings.rows.extend(check_compensation_v2_cross_authority(
        event_registry, lineage, ownership_rows,
    ).rows)
    return findings


def check_pg_evidence(oracle: dict[str, Any], fixture: dict[str, Any]) -> Findings:
    """Validate only current v2 evidence and every live authority/tool byte.

    This is deliberately independent from the runner's writer.  It does not
    execute or import runner code and rejects the historical v1 evidence shape.
    """
    findings = Findings()
    if not PG_EVIDENCE_PATH.is_file() or PG_EVIDENCE_PATH.is_symlink():
        findings.add("P0-PG-EVIDENCE-MISSING", "PG16+PG18", str(PG_EVIDENCE_PATH))
        return findings
    try:
        evidence = load(PG_EVIDENCE_PATH)
    except (OSError, ValueError, json.JSONDecodeError) as error:
        findings.add("P0-PG-EVIDENCE-JSON", "evidence", str(error))
        return findings
    canonical_file = json.dumps(
        evidence, ensure_ascii=False, sort_keys=True, separators=(",", ":"),
        allow_nan=False,
    ).encode("utf-8") + b"\n"
    if PG_EVIDENCE_PATH.read_bytes() != canonical_file:
        findings.add("P0-PG-EVIDENCE-CANONICAL", "evidence", "canonical JSON+LF required")
    expected_top = {
        "evidenceId", "schemaVersion", "technicalStatus", "gatePolicy", "generatedAt",
        "producerPrincipalIds", "oracleSha256", "oracleFileSha256", "fixtureSha256",
        "fixtureFileSha256", "builderFileSha256", "runnerFileSha256",
        "verifierFileSha256", "independentValidatorFileSha256", "trustedToolRoot",
        "sourceAuthority", "controlIntake", "expectedProjection", "candidateHashes",
        "runs", "executionComparison", "hostSemaphore", "secondReviewer",
        "sealedPayloadSha256",
    }
    if set(evidence) != expected_top:
        findings.add("P0-PG-EVIDENCE-SHAPE", "evidence",
                     f"missing={sorted(expected_top-set(evidence))} extra={sorted(set(evidence)-expected_top)}")
    if (evidence.get("evidenceId") != "dwp.hris.modern.causal-independent-pg-evidence.v2"
            or type(evidence.get("schemaVersion")) is not int or evidence.get("schemaVersion") != 2
            or evidence.get("technicalStatus") != "PASS"
            or evidence.get("gatePolicy") != "INTERNAL_REVIEW_WORKFLOW_AND_CONTROL_INTAKE_REQUIRED"):
        findings.add("P0-PG-EVIDENCE-IDENTITY", "evidence", "current v2 identity/status/policy required")
    core = evidence_core_hash(evidence)
    if core != evidence.get("sealedPayloadSha256"):
        findings.add("P0-PG-EVIDENCE-SEAL", "evidence", f"stored={evidence.get('sealedPayloadSha256')} current={core}")
    expected_pins = {
        "oracleSha256": oracle.get("sealedPayloadSha256"),
        "oracleFileSha256": file_hash(ORACLE_PATH),
        "fixtureSha256": fixture.get("sealedPayloadSha256"),
        "fixtureFileSha256": file_hash(FIXTURE_PATH),
        "builderFileSha256": file_hash(BUILDER_PATH),
        "runnerFileSha256": file_hash(PG_RUNNER_PATH),
        "verifierFileSha256": file_hash(FINAL_VERIFIER_PATH),
        "independentValidatorFileSha256": file_hash(Path(__file__)),
    }
    for key, expected in expected_pins.items():
        if evidence.get(key) != expected:
            findings.add("P0-PG-CURRENT-PIN", key, f"evidence={evidence.get(key)} current={expected}")
    candidate_paths = {
        "causal": CANDIDATE_PATH, "exact": CANDIDATE_EXACT_PATH,
        "events": CANDIDATE_EVENTS_PATH, "lineage": CANDIDATE_LINEAGE_PATH,
        "ownership": CANDIDATE_OWNERSHIP_PATH,
    }
    candidate_rows = evidence.get("candidateHashes", {})
    if set(candidate_rows) != set(candidate_paths):
        findings.add("P0-PG-CANDIDATE-PIN-SET", "candidateHashes", str(sorted(candidate_rows)))
    for label, path in candidate_paths.items():
        row = candidate_rows.get(label, {})
        expected_keys = {"path", "fileSha256"} | (
            {"sealedPayloadSha256"} if label in {"causal", "lineage"} else set()
        )
        if set(row) != expected_keys or row.get("path") != path.name:
            findings.add("P0-PG-CANDIDATE-PIN-SHAPE", label, str(row))
            continue
        current = file_hash(path) if path.is_file() else None
        if row.get("fileSha256") != current or current != FINAL_FROZEN_SUBJECT_PINS[label]:
            findings.add("P0-PG-CANDIDATE-PIN", label,
                         f"evidence={row.get('fileSha256')} current={current}")
        if label in {"causal", "lineage"} and path.is_file():
            document = load(path)
            seal = canonical_hash(document)
            if row.get("sealedPayloadSha256") != seal or document.get("sealedPayloadSha256") != seal:
                findings.add("P0-PG-CANDIDATE-SEMANTIC-PIN", label, str(row))
    refs = {
        "sourceAuthority": (SOURCE_AUTHORITY_PATH, "modern-causal-final-source-authority-manifest.v1.json"),
        "controlIntake": (CONTROL_INTAKE_PATH,
                          "g0/control-evidence-intake/modern-causal-final-endorsement.v1.json"),
    }
    loaded_refs: dict[str, dict[str, Any]] = {}
    for label, (path, expected_path) in refs.items():
        row = evidence.get(label, {})
        if set(row) != {"path", "fileSha256", "sealedPayloadSha256"} or row.get("path") != expected_path:
            findings.add("P0-PG-AUTHORITY-REF-SHAPE", label, str(row))
            continue
        if not path.is_file() or path.is_symlink():
            findings.add("P0-PG-AUTHORITY-MISSING", label, str(path))
            continue
        document = load(path)
        loaded_refs[label] = document
        seal = canonical_hash(document)
        if (row.get("fileSha256") != file_hash(path)
                or row.get("sealedPayloadSha256") != seal
                or document.get("sealedPayloadSha256") != seal):
            findings.add("P0-PG-AUTHORITY-PIN", label, str(row))
    if loaded_refs:
        trusted = evidence.get("trustedToolRoot")
        if (set(trusted or {}) != {"rootId", "rootDigest"}
                or any(document.get("trustedToolRoot") != trusted
                       for document in loaded_refs.values())):
            findings.add("P0-PG-TRUSTED-ROOT", "evidence", str(trusted))
    semaphore = evidence.get("hostSemaphore", {})
    if semaphore != {"name": "hris-verification", "protected": True,
                     "acquisition": semaphore.get("acquisition")} or semaphore.get(
                         "acquisition") not in {"DIRECT", "PARENT_HELD"}:
        findings.add("P0-PG-HOST-SEMAPHORE", "evidence", str(semaphore))

    expected_commands = sorted(row["operationId"] for row in oracle["operations"]
                               if row["mode"] == "COMMAND")
    expected_queries = sorted(row["operationId"] for row in oracle["operations"]
                              if row["mode"] == "QUERY")
    expected_edges = sorted(row["edgeId"] for row in fixture["edgeInventory"]["rows"])
    expected_handlers = sorted(row["handlerId"] for row in oracle["systemHandlers"])
    expected_decisions = sorted({
        row["operationId"] for row in oracle["operations"] if row["mode"] == "COMMAND"
        if any(effect.get("kind") == "PERSISTED_DECISION_RECEIPT"
               for use in row.get("inputEffects", []) for effect in use.get("effects", []))
    })
    expected_tables = oracle["schemaOracle"]["expectedTables"]
    comparable_keys = (
        "schemaHash", "operationResults81", "queryResults19", "edgeResults58",
        "handlerResults4", "rollbackFaultResults", "handlerRollbackFaultResults",
        "receiptOutboxReplayResults", "tenantPurposeStaleConflictResults",
        "decisionReceiptResults", "conditionalEventResults", "criticalLifecycleResults",
        "forbiddenEdgeResults", "scenarioCounts", "schemaProjection", "failures",
    )
    runs_list = evidence.get("runs")
    if not isinstance(runs_list, list) or len(runs_list) != 2:
        findings.add("P0-PG-RUN-SET", "runs", str(runs_list))
        runs_list = []
    runs = {row.get("postgresMajor"): row for row in runs_list if isinstance(row, dict)}
    run_hashes: dict[int, str] = {}
    run_keys = {
        "postgresMajor", "serverVersion", "serverVersionNum", "image", "schemaHash",
        "operationResults81", "queryResults19", "edgeResults58", "handlerResults4",
        "rollbackFaultResults", "handlerRollbackFaultResults", "receiptOutboxReplayResults",
        "tenantPurposeStaleConflictResults", "decisionReceiptResults", "conditionalEventResults",
        "criticalLifecycleResults", "forbiddenEdgeResults", "scenarioCounts",
        "schemaProjection", "executionReceipt", "failures",
    }
    for major in (16, 18):
        run = runs.get(major)
        if not isinstance(run, dict):
            findings.add("P0-PG-MAJOR-MISSING", str(major), "")
            continue
        if set(run) != run_keys:
            findings.add("P0-PG-RUN-SHAPE", str(major),
                         f"missing={sorted(run_keys-set(run))} extra={sorted(set(run)-run_keys)}")
        if (type(run.get("serverVersionNum")) is not int
                or run["serverVersionNum"] // 10000 != major
                or run.get("image") != {16: "postgres:16", 18: "postgres:18.4"}[major]):
            findings.add("P0-PG-ENGINE", str(major),
                         f"version={run.get('serverVersionNum')} image={run.get('image')}")
        result_contracts = (
            ("operationResults81", "operationId", expected_commands),
            ("queryResults19", "operationId", expected_queries),
            ("edgeResults58", "edgeId", expected_edges),
            ("handlerResults4", "handlerId", expected_handlers),
            ("decisionReceiptResults", "operationId", expected_decisions),
        )
        for key, id_key, expected_ids in result_contracts:
            rows = run.get(key, [])
            ids = [row.get(id_key) for row in rows] if isinstance(rows, list) else []
            if ids != expected_ids or any(row.get("status") != "PASS" for row in rows):
                findings.add("P0-PG-ID-RESULT-CLOSURE", f"PG{major}:{key}",
                             f"expected={canonical_value_hash(expected_ids)} actual={canonical_value_hash(ids)}")
        query_cases = sorted([
            "minimum-valid", "optional-absent", "optional-present", "foreign-tenant",
            "wrong-purpose", "cursor-scope-mismatch",
        ])
        if any(row.get("databaseDiff") != "EMPTY" or row.get("cases") != query_cases
               for row in run.get("queryResults19", [])):
            findings.add("P0-PG-QUERY-READ-ONLY", str(major), "case/diff mismatch")
        replay = run.get("receiptOutboxReplayResults", [])
        if ([row.get("operationId") for row in replay] != expected_commands
                or any(row.get("identicalReplay") != "PASS"
                       or row.get("differentDigestConflict") != "PASS"
                       or row.get("duplicateDomainRows") != 0
                       or row.get("duplicateOutboxRows") != 0 for row in replay)):
            findings.add("P0-PG-REPLAY", str(major), f"rows={len(replay)}")
        negatives = run.get("tenantPurposeStaleConflictResults", [])
        if ([row.get("operationId") for row in negatives] != expected_commands
                or any(any(row.get(key) != "PASS" for key in (
                    "foreignTenant", "wrongPurpose", "staleCas", "ownerProofUnavailable"
                )) for row in negatives)):
            findings.add("P0-PG-NEGATIVES", str(major), f"rows={len(negatives)}")
        if run.get("rollbackFaultResults") != {
            "faultPoints": 372, "status": "PASS", "receiptDomainOutboxAtomic": True,
        }:
            findings.add("P0-PG-ROLLBACK", str(major), str(run.get("rollbackFaultResults")))
        if run.get("handlerRollbackFaultResults") != {
            "faultPoints": 20, "status": "PASS", "inboxDomainOutboxAtomic": True,
        }:
            findings.add("P0-PG-HANDLER-ROLLBACK", str(major), str(run.get("handlerRollbackFaultResults")))
        if any(row.get("sameTransaction") is not True or row.get("fields") != [
            "decisionVersion", "inputDigestOrRef", "outcome", "ruleId"
        ] for row in run.get("decisionReceiptResults", [])):
            findings.add("P0-PG-DECISION-RECEIPTS", str(major), "structured tuple mismatch")
        if run.get("conditionalEventResults") != {
            "operationId": "modern.onboarding.task.complete",
            "lastRequiredTask": "PRIMARY_AND_JOURNEY_COMPLETED",
            "nonLastRequiredTask": "PRIMARY_ONLY", "status": "PASS",
        }:
            findings.add("P0-PG-CONDITIONAL-EVENT", str(major), str(run.get("conditionalEventResults")))
        if run.get("criticalLifecycleResults") != {
            "recruitingTwoStepHire": "PASS",
            "compensationSnapshotTimingAndDistinctIds": "PASS",
        }:
            findings.add("P0-PG-CRITICAL-LIFECYCLE", str(major), str(run.get("criticalLifecycleResults")))
        if run.get("forbiddenEdgeResults") != {
            "expected": 5, "passed": 5, "rowCountZero": True,
            "outboxAbsent": True, "preexistingRowsUnchanged": True,
        }:
            findings.add("P0-PG-FORBIDDEN", str(major), str(run.get("forbiddenEdgeResults")))
        expected_counts = {
            "rollbackFaultCount": 372, "handlerRollbackFaultCount": 20,
            "commandCount": 81, "queryCount": 19, "queryCaseCount": 114,
            "decisionReceiptCount": 14, "edgeCount": 58, "handlerCount": 4,
            "markers": 875,
        }
        counts = run.get("scenarioCounts", {})
        if any(counts.get(key) != value for key, value in expected_counts.items()) or counts.get(
                "schemaHash") != run.get("schemaHash"):
            findings.add("P0-PG-SCENARIO-COUNT", str(major), str(counts))
        projection = run.get("schemaProjection", {})
        schema_object = {
            "closure": "EXACT_SET_NO_OMITTED_OR_UNREVIEWED_EXTRA_PRODUCER_TABLE",
            "expectedTableCount": 71, "expectedTables": expected_tables,
        }
        projection_hash = canonical_value_hash(schema_object)
        if projection != {
            "closure": schema_object["closure"], "expectedTableCount": 71,
            "observedTables": expected_tables, "oracleProjectionSha256": projection_hash,
            "observedProjectionSha256": projection_hash,
        }:
            findings.add("P0-PG-SCHEMA-PROJECTION", str(major), str(projection))
        receipt = run.get("executionReceipt", {})
        receipt_keys = {"imageId", "repoDigest", "containerId", "argv", "argvSha256",
                        "stdoutSha256", "stderrSha256", "exitCode", "startedAt", "endedAt"}
        argv = receipt.get("argv")
        if (set(receipt) != receipt_keys
                or not re.fullmatch(r"sha256:[0-9a-f]{64}", str(receipt.get("imageId")))
                or not re.fullmatch(r"postgres@sha256:[0-9a-f]{64}", str(receipt.get("repoDigest")))
                or not re.fullmatch(r"[0-9a-f]{64}", str(receipt.get("containerId")))
                or not isinstance(argv, list) or receipt.get("argvSha256") != canonical_value_hash(argv)
                or receipt.get("exitCode") != 0):
            findings.add("P0-PG-EXECUTION-PROVENANCE", str(major), str(receipt))
        if run.get("failures") != 0:
            findings.add("P0-PG-FAILURES", str(major), str(run.get("failures")))
        if all(key in run for key in comparable_keys):
            run_hashes[major] = canonical_value_hash({key: run[key] for key in comparable_keys})
    comparison = evidence.get("executionComparison", {})
    if (set(comparison) != {"projectionId", "pg16PayloadSha256", "pg18PayloadSha256",
                           "comparableExecutionPayloadSha256"}
            or comparison.get("projectionId") != "dwp.hris.modern-causal.pg-semantic-result.v1"
            or run_hashes.get(16) != run_hashes.get(18)
            or comparison.get("pg16PayloadSha256") != run_hashes.get(16)
            or comparison.get("pg18PayloadSha256") != run_hashes.get(18)
            or comparison.get("comparableExecutionPayloadSha256") != run_hashes.get(16)):
        findings.add("P0-PG-COMPARISON", "PG16/PG18", f"runs={run_hashes} stored={comparison}")
    reviewer = evidence.get("secondReviewer", {})
    if reviewer.get("signed") is not True:
        findings.add("P0-PG-SECOND-REVIEW", "evidence", "independent hostile review signature absent")
    return findings


def hostile_self_tests(oracle: dict[str, Any], fixture: dict[str, Any]) -> Findings:
    findings = Findings()
    mutations: list[tuple[str, Any]] = []
    command_index = next(i for i, row in enumerate(oracle["operations"]) if row["mode"] == "COMMAND" and row["selectors"])
    query_index = next(i for i, row in enumerate(oracle["operations"]) if row["mode"] == "QUERY")
    event_index = next(i for i, row in enumerate(oracle["operations"]) if row.get("events"))
    mutations.append(("selector-target", lambda d, f: d["operations"][command_index]["selectors"][0].pop("targetColumn")))
    mutations.append(("query-write", lambda d, f: d["operations"][query_index]["orderedDml"].append({"step": 1})))
    mutations.append(("guard-only", lambda d, f: d["operations"][command_index]["inputEffects"][0].update(
        {"effects": [{"kind": "TRANSITION_GUARD"}]})))
    mutations.append(("blanket-refetch", lambda d, f: d["operations"][event_index]["events"][0]["refetchContract"].update(
        {"allowed": True, "pep": {}})))
    mutations.append(("raw-event", lambda d, f: d["operations"][event_index]["events"][0]["fields"][0].update(
        {"source": "body.rawSensitiveText"})))
    mutations.append(("dml-order", lambda d, f: d["operations"][command_index]["orderedDml"].pop(0)))
    mutations.append(("lineage-orphan", lambda d, f: d["eventSuccessorLineage"][0]["successorEvents"].append("Orphan.v2")))
    mutations.append(("pay-timing", lambda d, f: d["criticalTimingContracts"][0].update(
        {"authoritativeProducer": "modern.compplan.plan.approve"})))
    mutations.append(("forbidden-edge", lambda d, f: f["edgeInventory"]["rows"][0].update(
        {"classification": "FORBIDDEN_EDGE"})))
    mutations.append(("schema-closed-set", lambda d, f: d["schemaOracle"]["expectedTables"].pop()))
    mutations.append(("schema-missing", lambda d, f: d.pop("schemaOracle")))
    mutations.append(("schema-stale-empty", lambda d, f: d.update({"schemaOracle": {}})))
    mutations.append(("state-sink", lambda d, f: d["schemaOracle"]["stateSinkOperationDeltas"].pop(
        "modern.onboarding.task.complete")))
    mutations.append(("command-envelope", lambda d, f: d["operations"][command_index].pop(
        "transactionEnvelope")))
    mutations.append(("hire-request-ack", lambda d, f: next(
        row for row in d["systemHandlers"]
        if row["handlerId"] == "internal.recruiting.hire-handoff.acknowledge")["writes"].pop(1)))
    mutations.append(("lineage-audience", lambda d, f: d["eventSuccessorLineage"][0]
                      ["successorContracts"][0].update({"allowedConsumerSessions": []})))
    mutations.append(("onboarding-phantom-source", lambda d, f: next(
        field for operation in d["operations"]
        if operation["operationId"] == "modern.onboarding.template.create"
        for event in operation["events"] if event["eventName"] == "OnboardingTemplateCreated.v2"
        for field in event["fields"] if field["name"] == "validFrom"
    ).update({"source": "ppl_jny_template_versions.valid_from"})))
    for name, mutate in mutations:
        doc = copy.deepcopy(oracle)
        fix = copy.deepcopy(fixture)
        try:
            mutate(doc, fix)
        except (KeyError, IndexError, StopIteration, TypeError) as exc:
            findings.add("SELF-TEST-BASELINE-INCOMPLETE", name,
                         f"hostile mutation could not run against baseline: {type(exc).__name__}: {exc}")
            continue
        # Reseal so the semantic checker, not only the hash check, must reject it.
        doc["sealedPayloadSha256"] = canonical_hash(doc)
        fix["oracle"]["sealedPayloadSha256"] = doc["sealedPayloadSha256"]
        fix["sealedPayloadSha256"] = canonical_hash(fix)
        result = check_oracle(doc, fix)
        semantic = [row for row in result.rows if row["code"] not in {"O-SOURCE-DRIFT"}]
        if not semantic:
            findings.add("SELF-TEST-FALSE-PASS", name, "mutated oracle was accepted")
    return findings


def hostile_candidate_self_tests(oracle: dict[str, Any]) -> Findings:
    """Prove the frozen-candidate comparison rejects the previously missed P0s."""
    findings = Findings()
    baseline = (
        load(CANDIDATE_PATH), load(CANDIDATE_EXACT_PATH), load(CANDIDATE_EVENTS_PATH),
        load(CANDIDATE_LINEAGE_PATH), load_csv(CANDIDATE_OWNERSHIP_PATH),
        load(CANDIDATE_SSOT_PATH), load(CANDIDATE_SEMANTIC_PATH), load(CANDIDATE_IDENTITY_PATH),
    )
    cases: list[tuple[str, str, Any]] = []

    def table(document: dict[str, Any], name: str) -> dict[str, Any]:
        return next(row for row in document["tableSpecifications"] if row["tableName"] == name)

    def operation(document: dict[str, Any], operation_id: str) -> dict[str, Any]:
        return next(row for row in document["operations"] if row["operationId"] == operation_id)

    def handler(document: dict[str, Any], handler_id: str) -> dict[str, Any]:
        return next(row for row in document["internalConsumerHandlers"] if row["handlerId"] == handler_id)

    cases.append(("onboarding-task-order", "C-DDL-DELTA-COLUMN", lambda values:
                  table(values[1], "ppl_jny_assignment_tasks")["columns"].remove(next(
                      row for row in table(values[1], "ppl_jny_assignment_tasks")["columns"]
                      if row["name"] == "task_order"))))
    cases.append(("wfm-demand-line", "C-DDL-DELTA-COLUMN", lambda values:
                  table(values[1], "tme_wfm_demand_lines")["columns"].remove(next(
                      row for row in table(values[1], "tme_wfm_demand_lines")["columns"]
                      if row["name"] == "required_headcount"))))
    cases.append(("handler-physical-assignment", "C-HANDLER-PHYSICAL-ASSIGNMENTS", lambda values:
                  next(dml for dml in handler(values[0], "internal.recruiting.hire-handoff.acknowledge")["orderedDml"]
                       if dml["table"] == "ppl_rec_hire_handoff_receipts")["assignments"].pop()))
    cases.append(("event-semantic-referent", "C-EVENT-REGISTRY-FIELD-CONTRACT", lambda values:
                  next(field for event in values[2]["eventPayloadSchemas"] for field in event["fields"]
                       if field.get("referenceContract"))["referenceContract"].update(
                           {"entityType": "table:wrong_referent"})))
    cases.append(("command-claim-assignment", "C-COMMAND-TX-ASSIGNMENT", lambda values:
                  next(row for row in values[0]["operations"] if row["mode"] == "COMMAND")
                  ["transactionEnvelope"]["steps"][0]["assignments"].pop()))

    def mutate_decision(values: list[Any]) -> None:
        row = next(row for row in values[0]["operations"]
                   if any(effect.get("kind") == "PERSISTED_DECISION_RECEIPT"
                          for use in row.get("requiredInputUses", []) for effect in use.get("effects", [])))
        effect = next(effect for use in row["requiredInputUses"] for effect in use["effects"]
                      if effect.get("kind") == "PERSISTED_DECISION_RECEIPT")
        effect["physicalFieldBindings"]["ruleId"] = effect["target"] + ".result_ref"
    cases.append(("decision-result-ref-substitution", "C-DECISION-RECEIPT-PHYSICAL", mutate_decision))
    def mutate_query_write(values: list[Any]) -> None:
        row = next(row for row in values[0]["operations"] if row["mode"] == "QUERY")
        row.setdefault("orderedDml", []).append(
            {"table": "ppl_rec_requisitions", "disposition": "UPDATE"})
    cases.append(("query-write", "C-QUERY-MUTATION", mutate_query_write))
    cases.append(("handler-inbox-assignment", "C-HANDLER-TX-ASSIGNMENT", lambda values:
                  handler(values[0], "internal.wfm.schedule-optimization.complete")
                  ["transactionEnvelope"]["steps"][0]["assignments"].pop()))
    cases.append((
        "unapproved-v1-active-owner",
        "C-OWNERSHIP-V1-RESIDUAL",
        lambda values: next(
            row for row in values[4]
            if row.get("contract_kind") == "MODERN_EVENT"
            and row.get("contract_id")
            not in LISTENING_SUCCESSOR_PUBLIC_EVENT_STREAMS
        ).update({"contract_id": "UnapprovedModernEvent.v1"}),
    ))
    cases.append((
        "listening-successor-owner-source",
        "C-OWNERSHIP-EVENT-ROW",
        lambda values: next(
            row for row in values[4]
            if row.get("contract_id")
            == "EmployeeListeningCohortProjectionPublished.v1"
        ).update({
            "source_register_ref": (
                f"{CANDIDATE_EVENTS_PATH.name}#"
                "EmployeeListeningCohortProjectionPublished.v1"
            )
        }),
    ))

    for name, expected_code, mutate in cases:
        values = [copy.deepcopy(value) for value in baseline]
        try:
            mutate(values)
            result = check_candidate(oracle, *values)
        except Exception as exc:  # malformed hostile input must be a typed FAIL, never a validator crash
            findings.add("SELF-TEST-CANDIDATE-CRASH", name, f"{type(exc).__name__}: {exc}")
            continue
        if not result.has(expected_code):
            findings.add("SELF-TEST-CANDIDATE-FALSE-PASS", name,
                         f"expected={expected_code} got={sorted({row['code'] for row in result.rows})}")
    return findings


def render(findings: list[dict[str, str]], compact: bool, *, mode: str | None = None) -> None:
    counts = Counter(row["code"] for row in findings)
    if compact:
        payload: dict[str, Any] = {
            "status": "PASS" if not findings else "FAIL", "errors": len(findings),
            "byCode": dict(sorted(counts.items())),
        }
        if mode == "ORACLE_ONLY":
            payload.update({
                "schema": "dwp.hris.modern.causal-independent-oracle-check.v1",
                "mode": "ORACLE_ONLY",
            })
        elif mode == "SUCCESSOR_V2_ORACLE":
            payload.update({
                "schema": "dwp.hris.modern.causal-independent-successor-oracle-check.v2",
                "mode": "SUCCESSOR_V2_ORACLE",
                "profile": SUCCESSOR_PROFILE,
                "canonicalCounts": dict(SUCCESSOR_CANONICAL_COUNTS),
            })
        elif mode == "CURRENT_V2_EVIDENCE":
            payload.update({
                "schema": "dwp.hris.modern.causal-independent-evidence-check.v2",
                "mode": "CURRENT_V2_EVIDENCE",
                "evidenceId": "dwp.hris.modern.causal-independent-pg-evidence.v2",
                "evidencePath": "reports/modern-causal-independent-pg-evidence.v2.json",
                "evidenceFileSha256": file_hash(PG_EVIDENCE_PATH) if PG_EVIDENCE_PATH.is_file() else None,
            })
        elif mode == "CURRENT_V3_EVIDENCE":
            payload.update({
                "schema": "dwp.hris.modern.causal-independent-evidence-check.v3",
                "mode": "CURRENT_V3_EVIDENCE",
                "evidenceId": "dwp.hris.modern.causal-independent-pg-evidence.v3",
                "evidencePath": "reports/modern-causal-independent-pg-evidence.v3.json",
                "evidenceFileSha256": file_hash(PG_EVIDENCE_PATH) if PG_EVIDENCE_PATH.is_file() else None,
            })
        print(json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")))
        return
    for row in findings:
        print(f"[{row['code']}] {row['subject']}: {row['detail']}")
        print(f"MODERN_CAUSAL_INDEPENDENT_ORACLE={'PASS' if not findings else 'FAIL'} errors={len(findings)}")


def accepted_live_design_hash_rows() -> dict[str, dict[str, str]]:
    """Return design-report pins from the accepted-live manifest only."""
    accepted = verify_accepted_live_canonical(BASE, ROOT)
    rows: dict[str, dict[str, str]] = {}
    for key, path in accepted["sources"].items():
        rows[key] = {
            "path": str(path.relative_to(BASE)),
            "sha256": file_hash(path),
        }
    return rows


def write_machine_report(path: Path, findings: list[dict[str, str]], oracle: dict[str, Any],
                         fixture: dict[str, Any]) -> None:
    by_code = Counter(row["code"] for row in findings)
    grouped: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in findings:
        subject = row.get("subject", "")
        operation_id = subject.split(":", 1)[0] if subject.startswith("modern.") else None
        grouped[row["code"]].append({**row, **({"operationId": operation_id} if operation_id else {})})
    candidate_hashes = {}
    for label, candidate_path in (
        ("causal", CANDIDATE_PATH), ("exact", CANDIDATE_EXACT_PATH),
        ("events", CANDIDATE_EVENTS_PATH), ("lineage", CANDIDATE_LINEAGE_PATH),
        ("ownership", CANDIDATE_OWNERSHIP_PATH),
    ):
        if candidate_path.exists():
            candidate_hashes[label] = {"path": candidate_path.name, "sha256": file_hash(candidate_path)}
    if ACTIVE_PROFILE == SUCCESSOR_PROFILE:
        accepted_hashes = accepted_live_design_hash_rows()
        document = {
            "reportId": "dwp.hris.modern.causal-independent-design-findings.v2",
            "schemaVersion": 2,
            "profile": SUCCESSOR_PROFILE,
            "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
            "status": "PASS" if not findings else "FAIL",
            "gate": "SEALED_FAIL_UNTIL_ZERO_DESIGN_FINDINGS_AND_PG16_PG18_EVIDENCE",
            "oracleSha256": oracle.get("sealedPayloadSha256"),
            "fixtureSha256": fixture.get("sealedPayloadSha256"),
            "acceptedLiveSourceHashes": accepted_hashes,
            "sourceDerivedCounts": dict(SUCCESSOR_CANONICAL_COUNTS),
            "counts": {"total": len(findings), "byCode": dict(sorted(by_code.items()))},
            "findingsByCategory": dict(sorted(grouped.items())),
            "findings": findings,
            "sealedPayloadSha256": "",
        }
        document["sealedPayloadSha256"] = canonical_hash(document)
        atomic_write_text(path, json.dumps(document, ensure_ascii=False, indent=2) + "\n")
        return
    document = {
        "reportId": "dwp.hris.modern.causal-independent-design-findings.v1",
        "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
        "status": "PASS" if not findings else "FAIL",
        "gate": "SEALED_FAIL_UNTIL_ZERO_DESIGN_FINDINGS_AND_PG16_PG18_EVIDENCE",
        "oracleSha256": oracle.get("sealedPayloadSha256"),
        "fixtureSha256": fixture.get("sealedPayloadSha256"),
        "candidateHashes": candidate_hashes,
        "counts": {"total": len(findings), "byCode": dict(sorted(by_code.items()))},
        "findingsByCategory": dict(sorted(grouped.items())),
        "findings": findings,
    }
    atomic_write_text(path, json.dumps(document, ensure_ascii=False, indent=2) + "\n")


def write_historical_fail_report(findings: list[dict[str, str]], historical: dict[str, Any]) -> None:
    p0_prefixes = ("O-EVENT", "O-INPUT", "O-DML", "O-TX", "O-SCHEMA", "O-STATE",
                   "O-CAUSAL", "O-HIRE", "O-PAY", "O-OWNERSHIP", "O-LINEAGE")
    classified = []
    for row in findings:
        severity = "P0" if row["code"].startswith(p0_prefixes) else "P1"
        classified.append({**row, "severity": severity})
    by_severity = Counter(row["severity"] for row in classified)
    by_code = Counter(row["code"] for row in classified)
    affected_by_code: dict[str, list[str]] = defaultdict(list)
    for row in classified:
        if row["subject"] not in affected_by_code[row["code"]]:
            affected_by_code[row["code"]].append(row["subject"])
    document = {
        "reportId": "dwp.hris.modern.causal-independent-historical-fail.v1",
        "status": "EXPECTED_FAIL_REPRODUCED",
        "purpose": "immutable reviewed-intermediate regression proving the independent validator rejects the prior false-pass design",
        "historicalInput": {
            "path": REVIEW_INVENTORY_PATH.name,
            "fileSha256": REVIEW_ARTIFACT_PINS[REVIEW_INVENTORY_PATH.name]["fileSha256"],
            "sealedPayloadSha256": historical.get("sealedPayloadSha256"),
            "classification": "REVIEWED_INTERMEDIATE_INPUT_NOT_EXPECTED_OUTPUT_AUTHORITY",
        },
        "counts": {"total": len(classified), "bySeverity": dict(sorted(by_severity.items())),
                   "byCode": dict(sorted(by_code.items()))},
        "affectedSubjectsByCode": {key: sorted(values) for key, values in sorted(affected_by_code.items())},
        "findings": classified,
    }
    document["sealedPayloadSha256"] = canonical_hash(document)
    HISTORICAL_FAIL_PATH.parent.mkdir(parents=True, exist_ok=True)
    atomic_write_text(HISTORICAL_FAIL_PATH, json.dumps(document, ensure_ascii=False, indent=2) + "\n")
    lines = [
        "# Modern causal independent historical FAIL reproduction",
        "",
        f"- Status: `EXPECTED_FAIL_REPRODUCED`",
        f"- Frozen input file SHA-256: `{document['historicalInput']['fileSha256']}`",
        f"- Findings: `{len(classified)}` (`P0={by_severity.get('P0', 0)}`, `P1={by_severity.get('P1', 0)}`)",
        "- Acceptance: the frozen reviewed-intermediate must remain rejected; the sealed final oracle must return zero findings.",
        "",
        "## Exact categories",
        "",
        "| Severity | Code | Count | Affected subjects |",
        "|---|---|---:|---:|",
    ]
    for code, count in sorted(by_code.items()):
        severity = "P0" if code.startswith(p0_prefixes) else "P1"
        lines.append(f"| {severity} | `{code}` | {count} | {len(affected_by_code[code])} |")
    lines += ["", "The JSON companion contains every finding and exact affected subject.", ""]
    atomic_write_text(HISTORICAL_FAIL_MD_PATH, "\n".join(lines))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--oracle-only", action="store_true", help="validate only the sealed reviewer oracle and fixture")
    parser.add_argument("--design-only", action="store_true", help="skip mandatory PostgreSQL evidence check")
    parser.add_argument("--compact", action="store_true")
    parser.add_argument("--self-test", action="store_true",
                        help="run hostile semantic mutations (also enabled by default)")
    parser.add_argument("--historical-fail", action="store_true",
                        help="reproduce and write the immutable pre-finalization FAIL evidence")
    parser.add_argument("--skip-self-tests", action="store_true")
    parser.add_argument("--report", type=Path,
                        help="write a machine-readable candidate mismatch report (default for --design-only)")
    args = parser.parse_args()

    oracle = load(ORACLE_PATH)
    fixture = load(FIXTURE_PATH)
    if args.historical_fail:
        historical = load(REVIEW_INVENTORY_PATH)
        historical_fixture = copy.deepcopy(fixture)
        historical_fixture["oracle"]["sealedPayloadSha256"] = historical.get("sealedPayloadSha256")
        historical_fixture["sealedPayloadSha256"] = canonical_hash(historical_fixture)
        historical_findings = check_oracle(historical, historical_fixture).rows
        if not historical_findings:
            print("MODERN_CAUSAL_HISTORICAL_FAIL_REPRODUCTION=FAIL errors=0")
            return 1
        write_historical_fail_report(historical_findings, historical)
        counts = Counter(row["code"] for row in historical_findings)
        print(f"MODERN_CAUSAL_HISTORICAL_FAIL_REPRODUCTION=PASS errors={len(historical_findings)} "
              f"categories={len(counts)}")
        return 0
    all_findings = check_oracle(oracle, fixture).rows
    if not args.skip_self_tests:
        all_findings.extend(hostile_self_tests(oracle, fixture).rows)
    if not args.oracle_only:
        required = (CANDIDATE_PATH, CANDIDATE_EXACT_PATH, CANDIDATE_EVENTS_PATH,
                    CANDIDATE_LINEAGE_PATH, CANDIDATE_OWNERSHIP_PATH)
        for path in required:
            if not path.exists():
                all_findings.append({"code": "C-FILE-MISSING", "subject": path.name, "detail": str(path)})
        if all(path.exists() for path in required):
            all_findings.extend(check_candidate(oracle, load(CANDIDATE_PATH), load(CANDIDATE_EXACT_PATH),
                                                load(CANDIDATE_EVENTS_PATH), load(CANDIDATE_LINEAGE_PATH),
                                                load_csv(CANDIDATE_OWNERSHIP_PATH)).rows)
        if not args.design_only:
            all_findings.extend(check_pg_evidence(fixture).rows)
    report_path = args.report or (DESIGN_FINDINGS_PATH if args.design_only and not args.oracle_only else None)
    if report_path:
        write_machine_report(report_path, all_findings, oracle, fixture)
    receipt_mode = (
        "SUCCESSOR_V2_ORACLE" if ACTIVE_PROFILE == SUCCESSOR_PROFILE else
        "ORACLE_ONLY" if args.oracle_only else
        "CURRENT_V2_EVIDENCE" if not args.design_only else None
    )
    render(all_findings, args.compact, mode=receipt_mode)
    return 0 if not all_findings else 1


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
