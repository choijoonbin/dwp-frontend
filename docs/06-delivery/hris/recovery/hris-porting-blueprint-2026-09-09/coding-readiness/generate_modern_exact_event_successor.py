#!/usr/bin/env python3
"""Compose exact schema and public-event successors from the closed operation SSOT.

The output is a design contract.  It intentionally describes physical fields,
tenant joins, response provenance and handler boundaries without claiming that
the corresponding G3 migrations or handlers have been implemented.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import re
from pathlib import Path
from typing import Any

from generate_modern_operation_ssot_successor import (
    AI_GOVERNANCE_REQUIRED_PROOFS,
    QUERY_CHILD_READ_CONTRACTS,
    compose as compose_operation_ssot,
)
from modern_closed_set_design import (
    ADDED_TABLE_IDS,
    CURRENT_115_REMOVED_TABLE_IDS,
    LEGACY_LISTENING_TABLE_IDS,
    PREDECESSOR_OPERATION_SSOT_SHA256,
)
from sys_listening_canonical_design import (
    LISTENING_SIGNATURE_ALGORITHMS,
    LISTENING_SIGNATURE_ALGORITHM_MAX_BYTES,
    LISTENING_SIGNATURE_MAX_BYTES,
    LISTENING_SIGNATURE_SERIALIZATION,
    build_static_design,
    composition_marker,
    stamp_canonical_document,
)


HERE = Path(__file__).resolve().parent
SSOT = HERE / "modern-capability-operation-causal-contract-ssot.v2.json"
MANIFEST = HERE / "modern-capability-closed-set-manifest.v3.json"
EXACT = HERE / "modern-capability-exact-schema-contracts.v1.json"
EVENTS = HERE / "modern-capability-event-payload-contracts.v1.json"
BINDINGS = HERE / "modern-capability-semantic-bindings.v1.json"
IDENTITIES = HERE / "modern-capability-public-identity-registry.v1.json"
EXACT_SUCCESSOR_PROJECTION_VERSION = "modern-exact-schema-source-v7-2026-09-16"
PREVIOUS_EXACT_SUCCESSOR_PROJECTION_VERSION = (
    "modern-exact-schema-source-v6-2026-09-16"
)

SESSION_RECEIPTS = {
    "HRIS-HRM": ("ppl_command_receipts", "command_receipt_id"),
    "HRIS-PER": ("prf_command_receipts", "command_receipt_id"),
    "HRIS-TIM": ("tme_command_receipts", "public_id"),
    "HRIS-SYS": ("sys_hris_command_receipts", "public_id"),
}

LISTENING_OWNER_BINDING_BY_STREAM = {
    "platform-hris-configuration": "PFX-SYS-LISTEN-CONFIGURATION",
    "platform-hris-listening-protected": "PFX-SYS-LISTEN-PROTECTED",
    "platform-hris-insights": "PFX-SYS-LISTEN-INSIGHTS",
    "auth-hris-participation-issuer": "PFX-SYS-LISTEN-ISSUER",
}

# These two owner-local predecessor links supplement the twelve links declared
# directly by the static Listening table registry.  Keep the complete set
# closed: accepting an extra same-looking FK can silently reintroduce a
# cross-stream repository dependency.
LISTENING_VERSION_CHAIN_FOREIGN_KEYS = {
    "sys_hris_listening_survey_versions": {
        "mode": "LOCAL_COMPOSITE_FK",
        "columns": [
            "tenant_id", "listening_survey_id",
            "predecessor_version_public_id", "predecessor_owner_revision",
        ],
        "target": "sys_hris_listening_survey_versions",
        "targetColumns": [
            "tenant_id", "listening_survey_id", "public_id", "owner_revision",
        ],
        "constraintId": "fk_sys_hris_listening_survey_versions_predecessor_v4",
    },
    "sys_hris_listening_admission_versions": {
        "mode": "LOCAL_COMPOSITE_FK",
        "columns": [
            "tenant_id", "admission_public_id",
            "predecessor_version_public_id", "predecessor_owner_revision",
        ],
        "target": "sys_hris_listening_admission_versions",
        "targetColumns": [
            "tenant_id", "admission_public_id", "public_id", "owner_revision",
        ],
        "constraintId": "fk_sys_hris_listening_admission_versions_predecessor_v4",
    },
}

TABLE_OWNER = {
    "ppl_rec_candidate_stage_history": ("HRIS.MODERN.RECRUITING_ATS", "HRIS-HRM", "ppl_rec_candidate_cases"),
    "ppl_jny_assignment_revisions": ("HRIS.MODERN.ONBOARDING", "HRIS-HRM", "ppl_jny_assignments"),
    "ppl_jny_assignment_task_revisions": ("HRIS.MODERN.ONBOARDING", "HRIS-HRM", "ppl_jny_assignment_tasks"),
    "ppl_bnf_enrollment_decisions": ("HRIS.MODERN.BENEFITS_ADMIN", "HRIS-HRM", "ppl_bnf_enrollments"),
    "ppl_bnf_provider_requests": ("HRIS.MODERN.BENEFITS_ADMIN", "HRIS-HRM", "ppl_bnf_enrollments"),
    "ppl_cwk_classification_receipts": ("HRIS.MODERN.CONTINGENT_WORKFORCE", "HRIS-HRM", "ppl_cwk_engagements"),
    "ppl_cwk_access_requests": ("HRIS.MODERN.CONTINGENT_WORKFORCE", "HRIS-HRM", "ppl_cwk_engagements"),
    "prf_skl_skill_nodes": ("HRIS.MODERN.SKILLS_ONTOLOGY", "HRIS-PER", "prf_skl_taxonomy_versions"),
    "prf_skl_skill_edges": ("HRIS.MODERN.SKILLS_ONTOLOGY", "HRIS-PER", "prf_skl_taxonomy_versions"),
    "prf_skl_proficiency_levels": ("HRIS.MODERN.SKILLS_ONTOLOGY", "HRIS-PER", "prf_skl_taxonomy_versions"),
    "prf_grw_portability_export_receipts": ("HRIS.MODERN.GROWTH_PROFILE", "HRIS-PER", "prf_grw_profiles"),
    "prf_mkt_application_decisions": ("HRIS.MODERN.INTERNAL_MARKETPLACE", "HRIS-PER", "prf_mkt_applications"),
    "tme_wfm_schedule_candidate_versions": ("HRIS.MODERN.ADVANCED_WFM", "HRIS-TIM", "tme_wfm_schedule_candidates"),
    "sys_hris_metric_projection_requests": ("HRIS.MODERN.PEOPLE_ANALYTICS", "HRIS-SYS", "sys_hris_metric_definitions"),
    "sys_hris_ai_assistance_requests": ("HRIS.MODERN.GOVERNED_AI", "HRIS-SYS", "sys_hris_ai_use_policies"),
    "ppl_rec_requisition_publish_receipts": ("HRIS.MODERN.RECRUITING_ATS", "HRIS-HRM", "ppl_rec_requisitions"),
    "prf_lrn_offering_publish_receipts": ("HRIS.MODERN.LEARNING", "HRIS-PER", "prf_lrn_offerings"),
    "prf_mkt_opportunity_publish_receipts": ("HRIS.MODERN.INTERNAL_MARKETPLACE", "HRIS-PER", "prf_mkt_opportunities"),
    "prf_suc_publish_receipts": ("HRIS.MODERN.SUCCESSION", "HRIS-PER", "prf_suc_plans"),
    "ppl_rec_offer_decisions": ("HRIS.MODERN.RECRUITING_ATS", "HRIS-HRM", "ppl_rec_offers"),
    "ppl_rec_requisition_versions": ("HRIS.MODERN.RECRUITING_ATS", "HRIS-HRM", "ppl_rec_requisitions"),
    "ppl_jny_template_task_definitions": ("HRIS.MODERN.ONBOARDING", "HRIS-HRM", "ppl_jny_template_versions"),
    "ppl_wfp_simulation_requests": ("HRIS.MODERN.WORKFORCE_PLANNING", "HRIS-HRM", "ppl_wfp_scenarios"),
    "ppl_bnf_enrollment_eligibility_receipts": ("HRIS.MODERN.BENEFITS_ADMIN", "HRIS-HRM", "ppl_bnf_enrollments"),
    "ppl_bnf_dependent_elections": ("HRIS.MODERN.BENEFITS_ADMIN", "HRIS-HRM", "ppl_bnf_enrollments"),
    "ppl_bnf_life_event_decisions": ("HRIS.MODERN.BENEFITS_ADMIN", "HRIS-HRM", "ppl_bnf_life_events"),
    "ppl_cwk_access_receipts": ("HRIS.MODERN.CONTINGENT_WORKFORCE", "HRIS-HRM", "ppl_cwk_access_requests"),
    "prf_lrn_offering_versions": ("HRIS.MODERN.LEARNING", "HRIS-PER", "prf_lrn_offerings"),
    "prf_lrn_capacity_ledger": ("HRIS.MODERN.LEARNING", "HRIS-PER", "prf_lrn_offerings"),
    "prf_mkt_opportunity_versions": ("HRIS.MODERN.INTERNAL_MARKETPLACE", "HRIS-PER", "prf_mkt_opportunities"),
    "prf_cmp_proposal_versions": ("HRIS.MODERN.COMPENSATION_PLANNING", "HRIS-PER", "prf_cmp_proposals"),
    "prf_cmp_plan_proposal_refs": ("HRIS.MODERN.COMPENSATION_PLANNING", "HRIS-PER", "prf_cmp_plans"),
    "tme_wfm_approval_receipts": ("HRIS.MODERN.ADVANCED_WFM", "HRIS-TIM", "tme_wfm_schedule_candidates"),
    "sys_hris_ai_assistance_reviews": ("HRIS.MODERN.GOVERNED_AI", "HRIS-SYS", "sys_hris_ai_assistance_requests"),
    "ppl_cwk_engagement_versions": ("HRIS.MODERN.CONTINGENT_WORKFORCE", "HRIS-HRM", "ppl_cwk_engagements"),
    "prf_suc_plan_versions": ("HRIS.MODERN.SUCCESSION", "HRIS-PER", "prf_suc_plans"),
}

STATE_VALUES = {
    "ppl_rec_candidate_stage_history": ("APPLIED", "SCREENING", "INTERVIEW", "OFFERED", "HIRE_PENDING", "HIRED", "REJECTED", "CLOSED"),
    "ppl_jny_assignment_revisions": ("ASSIGNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"),
    "ppl_jny_assignment_task_revisions": ("PENDING", "COMPLETED", "WAIVED", "CANCELLED"),
    "ppl_bnf_enrollment_decisions": ("APPROVED", "REJECTED", "SUPERSEDED"),
    "ppl_bnf_provider_requests": ("REQUESTED", "COMPLETED", "FAILED", "CANCELLED"),
    "ppl_cwk_classification_receipts": ("ELIGIBLE", "INELIGIBLE", "SUPERSEDED"),
    "ppl_cwk_access_requests": ("REQUESTED", "COMPLETED", "FAILED", "REVOKED"),
    "prf_skl_skill_nodes": ("ACTIVE", "RETIRED"),
    "prf_skl_skill_edges": ("ACTIVE", "RETIRED"),
    "prf_skl_proficiency_levels": ("ACTIVE", "RETIRED"),
    "prf_grw_portability_export_receipts": ("REQUESTED", "GENERATING", "COMPLETED", "FAILED", "EXPIRED", "CANCELLED"),
    "prf_mkt_application_decisions": ("SHORTLISTED", "SELECTED", "NOT_SELECTED", "SUPERSEDED"),
    "tme_wfm_schedule_candidate_versions": ("CANDIDATE_GENERATED", "VALIDATED", "REJECTED", "PENDING_APPROVAL", "APPROVED", "PUBLISHED", "CANCELLED"),
    "sys_hris_metric_projection_requests": ("REQUESTED", "RUNNING", "COMPLETED", "FAILED", "EXPIRED", "CANCELLED"),
    "sys_hris_ai_assistance_requests": ("REQUESTED", "RUNNING", "PRODUCED", "FAILED", "CONFIRMED", "REJECTED", "REVOKED", "CANCELLED"),
    "ppl_rec_requisition_publish_receipts": ("PUBLISHED",),
    "prf_lrn_offering_publish_receipts": ("PUBLISHED",),
    "prf_mkt_opportunity_publish_receipts": ("PUBLISHED",),
    "prf_suc_publish_receipts": ("PUBLISHED",),
    "ppl_rec_offer_decisions": ("ACCEPTED", "DECLINED", "SUPERSEDED"),
    "ppl_rec_requisition_versions": ("DRAFT", "OPEN", "PAUSED", "CLOSED"),
    "ppl_jny_template_task_definitions": ("ACTIVE", "RETIRED"),
    "ppl_wfp_simulation_requests": ("REQUESTED", "COMPLETED", "FAILED", "CANCELLED"),
    "ppl_bnf_enrollment_eligibility_receipts": ("ELIGIBLE", "INELIGIBLE"),
    "ppl_bnf_dependent_elections": ("ELECTED", "REMOVED"),
    "ppl_bnf_life_event_decisions": ("VERIFIED", "REJECTED", "SUPERSEDED"),
    "ppl_cwk_access_receipts": ("GRANTED", "DENIED", "REVOKED", "FAILED"),
    "prf_lrn_offering_versions": ("DRAFT", "PUBLISHED", "RETIRED"),
    "prf_lrn_capacity_ledger": ("RESERVED", "WAITLISTED", "RELEASED"),
    "prf_mkt_opportunity_versions": ("DRAFT", "OPEN", "CLOSED", "CANCELLED", "ARCHIVED"),
    "prf_cmp_proposal_versions": ("DRAFT", "SUBMITTED", "APPROVED", "REJECTED"),
    "prf_cmp_plan_proposal_refs": ("APPROVED", "SUPERSEDED"),
    "tme_wfm_approval_receipts": ("APPROVED", "REJECTED"),
    "sys_hris_ai_assistance_reviews": ("CONFIRMED", "REJECTED", "REVOKED"),
    "ppl_cwk_engagement_versions": ("DRAFT", "PENDING_APPROVAL", "ACTIVATION_PENDING", "ACTIVE", "OFFBOARDING", "ENDED", "REJECTED"),
    "prf_suc_plan_versions": ("DRAFT", "PENDING_APPROVAL", "APPROVED", "PUBLISHED", "REJECTED", "RETIRED"),
}

TYPED_ORDERED_CHILD_TABLES = {
    "prf_grw_coaching_note_evidence_refs": (
        "HRIS.MODERN.GROWTH_PROFILE", "HRIS-PER", "prf_grw_coaching_notes",
        "evidence_public_id", "table:prf_skl_worker_evidence"),
    "prf_grw_profile_revision_evidence_refs": (
        "HRIS.MODERN.GROWTH_PROFILE", "HRIS-PER", "prf_grw_profile_revisions",
        "evidence_public_id", "table:prf_skl_worker_evidence"),
    "prf_lrn_completion_skill_evidence_refs": (
        "HRIS.MODERN.LEARNING", "HRIS-PER", "prf_lrn_completion_evidence",
        "skill_evidence_public_id", "table:prf_skl_worker_evidence"),
    "sys_hris_analytics_export_projection_refs": (
        "HRIS.MODERN.PEOPLE_ANALYTICS", "HRIS-SYS", "sys_hris_analytics_export_receipts",
        "metric_projection_public_id", "table:sys_hris_metric_projections"),
    "tme_wfm_schedule_candidate_time_group_refs": (
        "HRIS.MODERN.ADVANCED_WFM", "HRIS-TIM", "tme_wfm_schedule_candidates",
        "time_group_public_id", "TIM.TimeGroup"),
}


# Closed, operation-family projections.  Each business field has one named
# durable source; no query may widen this allowlist at runtime.  Restricted
# subject/actor fields are present in the contract so the field-policy can
# omit or tokenize them, never because a generic row serializer exposed them.
QUERY_PROJECTION_FIELDS: dict[str, tuple[tuple[str, str, str, str], ...]] = {
    "ai.assistance": (
        ("useCase", "STRING", "sys_hris_ai_assistance_requests.use_case_key", "INTERNAL"),
        ("instructionArtifactVersionId", "UUID", "sys_hris_ai_assistance_requests.instruction_artifact_version_id", "RESTRICTED"),
        ("sourceProjectionBundleReceiptId", "UUID", "sys_hris_ai_assistance_requests.source_projection_bundle_receipt_id", "RESTRICTED"),
        ("resultProvenanceReceiptId", "UUID", "sys_hris_ai_provenance_receipts.public_id", "RESTRICTED"),
        ("humanConfirmationRequired", "BOOLEAN", "sys_hris_ai_provenance_receipts.human_confirmation_required", "INTERNAL"),
        ("humanReviewDecision", "STRING", "sys_hris_ai_assistance_reviews.decision", "RESTRICTED"),
        ("humanReviewReasonCode", "STRING", "sys_hris_ai_assistance_reviews.reason_code", "HIGHLY_RESTRICTED"),
    ),
    "ai.evaluation": (
        ("evaluationSuiteVersionId", "UUID", "sys_hris_ai_evaluation_receipts.evaluation_suite_version_id", "RESTRICTED"),
        ("evaluationOutcome", "STRING", "sys_hris_ai_evaluation_receipts.evaluation_outcome", "INTERNAL"),
        ("blockingFailureCount", "INTEGER", "sys_hris_ai_evaluation_receipts.blocking_failure_count", "INTERNAL"),
        ("evaluationReceiptId", "UUID", "sys_hris_ai_evaluation_receipts.public_id", "RESTRICTED"),
    ),
    "ai.polic": (
        ("useCase", "STRING", "sys_hris_ai_use_policies.use_case_key", "INTERNAL"),
        ("riskClassification", "STRING", "sys_hris_ai_use_policies.risk_classification", "RESTRICTED"),
        ("modelVersionId", "UUID", "sys_hris_ai_policy_versions.model_version_id", "RESTRICTED"),
        ("humanOversightAssignmentVersionId", "UUID", "sys_hris_ai_policy_versions.human_oversight_assignment_version_id", "RESTRICTED"),
        ("killSwitchEnabled", "BOOLEAN", "sys_hris_ai_use_policies.kill_switch_enabled", "INTERNAL"),
        ("governanceActivationReceiptId", "UUID", "sys_hris_ai_use_policies.governance_activation_receipt_id", "RESTRICTED"),
    ),
    "analytics.metric": (
        ("metricKey", "STRING", "sys_hris_metric_definitions.metric_key", "INTERNAL"),
        ("expressionAst", "OBJECT", "sys_hris_metric_versions.expression_ast", "RESTRICTED"),
        ("aggregationCode", "STRING", "sys_hris_metric_versions.aggregation_code", "INTERNAL"),
        ("unitCode", "STRING", "sys_hris_metric_versions.unit_code", "INTERNAL"),
        ("dimensionSchema", "OBJECT", "sys_hris_metric_versions.dimension_schema", "RESTRICTED"),
        ("sourceContracts", "ARRAY", "sys_hris_metric_versions.source_contracts", "RESTRICTED"),
    ),
    "analytics.projection": (
        ("metricVersionId", "UUID", "sys_hris_metric_projections.metric_version_id", "INTERNAL"),
        ("asOf", "TIMESTAMPTZ", "sys_hris_metric_projections.as_of", "INTERNAL"),
        ("cohortDefinitionId", "UUID", "sys_hris_metric_projections.cohort_definition_id", "RESTRICTED"),
        ("populationSnapshotPublicId", "UUID", "sys_hris_metric_projection_requests.population_snapshot_public_id", "RESTRICTED"),
        ("projectionValues", "ARRAY", "sys_hris_metric_projections.projection_values", "RESTRICTED"),
        ("lineageReceiptId", "UUID", "sys_hris_metric_projections.lineage_receipt_public_id", "RESTRICTED"),
        ("anonymityThreshold", "INTEGER", "sys_hris_metric_projections.anonymity_threshold", "INTERNAL"),
    ),
    "analytics.export": (
        ("projectionIds", "ARRAY", "sys_hris_analytics_export_projection_refs.metric_projection_public_id", "RESTRICTED"),
        ("objectRef", "STRING", "sys_hris_analytics_export_receipts.object_ref", "RESTRICTED"),
        ("objectDigest", "SHA256", "sys_hris_analytics_export_receipts.object_digest", "INTERNAL"),
        ("rowCount", "BIGINT", "sys_hris_analytics_export_receipts.row_count", "INTERNAL"),
        ("expiresAt", "TIMESTAMPTZ", "sys_hris_analytics_export_receipts.expires_at", "INTERNAL"),
    ),
    "benefits.plan": (
        ("displayName", "STRING", "ppl_bnf_plan_versions.display_name_snapshot", "INTERNAL"),
        ("effectiveFrom", "DATE", "ppl_bnf_plan_versions.effective_from", "INTERNAL"),
        ("coverageOptions", "ARRAY", "ppl_bnf_plan_versions.coverage_options", "RESTRICTED"),
        ("eligibilityPolicyVersionId", "UUID", "ppl_bnf_plan_versions.eligibility_policy_version_id", "RESTRICTED"),
        ("enrollmentWindowPolicyVersionId", "UUID", "ppl_bnf_plan_versions.enrollment_window_policy_version_id", "RESTRICTED"),
        ("providerConfigVersionId", "UUID", "ppl_bnf_plan_versions.provider_config_version_id", "RESTRICTED"),
        ("payrollTreatmentCode", "STRING", "ppl_bnf_plan_versions.payroll_treatment_code", "RESTRICTED"),
        ("payrollTreatmentCodeSetVersionId", "UUID", "ppl_bnf_plan_versions.payroll_treatment_code_set_version_id", "RESTRICTED"),
    ),
    "benefits.enrollment": (
        ("workerPublicId", "UUID", "ppl_bnf_enrollments.worker_public_id", "RESTRICTED"),
        ("planVersionId", "UUID", "ppl_bnf_enrollments.benefit_plan_version_id", "RESTRICTED"),
        ("coverageOptionCode", "STRING", "ppl_bnf_enrollments.coverage_option_code", "RESTRICTED"),
        ("eligibilityReceiptId", "UUID", "ppl_bnf_enrollment_eligibility_receipts.public_id", "RESTRICTED"),
        ("eligibilityOutcome", "STRING", "ppl_bnf_enrollment_eligibility_receipts.outcome", "RESTRICTED"),
        ("dependentElectionIds", "ARRAY", "ppl_bnf_dependent_elections.public_id", "RESTRICTED"),
        ("dependentCoverageOptionCodes", "ARRAY", "ppl_bnf_dependent_elections.coverage_option_code", "RESTRICTED"),
        ("providerStatus", "STRING", "ppl_bnf_provider_requests.state", "RESTRICTED"),
    ),
    "benefits.lifeevent": (
        ("workerPublicId", "UUID", "ppl_bnf_life_events.worker_public_id", "RESTRICTED"),
        ("eventType", "STRING", "ppl_bnf_life_events.event_type", "RESTRICTED"),
        ("eventDate", "DATE", "ppl_bnf_life_events.event_date", "RESTRICTED"),
        ("decisionStatus", "STRING", "ppl_bnf_life_events.status", "RESTRICTED"),
        ("evidenceArtifactRef", "STRING", "ppl_bnf_life_events.evidence_object_ref", "RESTRICTED"),
        ("decisionOutcome", "STRING", "ppl_bnf_life_event_decisions.decision", "RESTRICTED"),
        ("decisionReasonCode", "STRING", "ppl_bnf_life_event_decisions.reason_code", "HIGHLY_RESTRICTED"),
    ),
    "compplan.cycle": (
        ("displayName", "STRING", "prf_cmp_cycles.display_name", "RESTRICTED"),
        ("effectiveFrom", "DATE", "prf_cmp_cycles.effective_from", "INTERNAL"),
        ("budgetTotal", "DECIMAL", "prf_cmp_cycles.budget_total", "RESTRICTED"),
        ("currencyCode", "STRING", "prf_cmp_cycles.budget_currency", "RESTRICTED"),
        ("guidelinePolicyVersionId", "UUID", "prf_cmp_cycles.guideline_policy_version_id", "RESTRICTED"),
        ("populationSnapshotId", "UUID", "prf_cmp_cycles.population_snapshot_id", "RESTRICTED"),
        ("approvedProposalPublicIds", "ARRAY", "prf_cmp_plan_proposal_refs.proposal_public_id", "RESTRICTED"),
        ("approvedProposalVersions", "ARRAY", "prf_cmp_plan_proposal_refs.proposal_version", "RESTRICTED"),
    ),
    "compplan.proposal": (
        ("workerPublicId", "UUID", "prf_cmp_proposals.worker_public_id", "RESTRICTED"),
        ("assignmentPublicId", "UUID", "prf_cmp_proposals.assignment_public_id", "RESTRICTED"),
        ("componentCode", "STRING", "prf_cmp_proposals.component_code", "RESTRICTED"),
        ("amount", "DECIMAL", "prf_cmp_proposals.amount", "RESTRICTED"),
        ("currencyCode", "STRING", "prf_cmp_proposals.currency_code", "RESTRICTED"),
        ("effectiveDate", "DATE", "prf_cmp_proposals.effective_date", "RESTRICTED"),
        ("reasonCode", "STRING", "prf_cmp_proposals.reason_code", "RESTRICTED"),
        ("proposalVersion", "BIGINT", "prf_cmp_proposals.proposal_version", "INTERNAL"),
        ("componentCodeSetVersionId", "UUID", "prf_cmp_proposals.component_code_set_version_id", "RESTRICTED"),
        ("proposalHistoryVersions", "ARRAY", "prf_cmp_proposal_versions.proposal_version", "RESTRICTED"),
        ("proposalHistoricalAmounts", "ARRAY", "prf_cmp_proposal_versions.amount", "HIGHLY_RESTRICTED"),
        ("approvedPlanPublicIds", "ARRAY", "prf_cmp_plan_proposal_refs.plan_public_id", "RESTRICTED"),
        ("approvedPlanRevisions", "ARRAY", "prf_cmp_plan_proposal_refs.plan_revision", "RESTRICTED"),
    ),
    "contingent.engagement": (
        ("workerPublicId", "UUID", "ppl_cwk_engagement_versions.worker_public_id", "RESTRICTED"),
        ("vendorPublicId", "UUID", "ppl_cwk_engagement_versions.vendor_public_id", "RESTRICTED"),
        ("sponsorWorkerPublicId", "UUID", "ppl_cwk_engagement_versions.sponsor_worker_public_id", "RESTRICTED"),
        ("classificationCode", "STRING", "ppl_cwk_engagement_versions.classification_code", "RESTRICTED"),
        ("accessState", "STRING", "ppl_cwk_access_requests.state", "RESTRICTED"),
        ("effectiveFrom", "DATE", "ppl_cwk_engagement_versions.effective_from", "INTERNAL"),
        ("engagementRevision", "BIGINT", "ppl_cwk_engagement_versions.version_no", "INTERNAL"),
        ("engagementRevisionMode", "STRING", "ppl_cwk_engagement_versions.revision_mode", "INTERNAL"),
        ("accessReceiptIds", "ARRAY", "ppl_cwk_access_receipts.public_id", "RESTRICTED"),
        ("accessReceiptOutcomes", "ARRAY", "ppl_cwk_access_receipts.outcome", "RESTRICTED"),
    ),
    "growth.export": (
        ("profilePublicId", "UUID", "prf_grw_portability_export_receipts.parent_public_id", "RESTRICTED"),
        ("objectArtifactId", "UUID", "prf_grw_portability_export_receipts.result_public_id", "RESTRICTED"),
        ("payloadDigest", "SHA256", "prf_grw_portability_export_receipts.payload_digest", "INTERNAL"),
        ("expiresAt", "TIMESTAMPTZ", "prf_grw_portability_export_receipts.expires_at", "INTERNAL"),
    ),
    "growth.profile": (
        ("workerPublicId", "UUID", "prf_grw_profiles.worker_public_id", "RESTRICTED"),
        ("artifactPublicId", "UUID", "prf_grw_profile_revisions.artifact_public_id", "RESTRICTED"),
        ("artifactRevision", "BIGINT", "prf_grw_profile_revisions.artifact_revision", "RESTRICTED"),
        ("visibility", "STRING", "prf_grw_profiles.visibility", "RESTRICTED"),
        ("evidenceIds", "ARRAY", "prf_grw_profile_revision_evidence_refs.evidence_public_id", "RESTRICTED"),
        ("coachingArtifactIds", "ARRAY", "prf_grw_coaching_notes.coaching_artifact_public_id", "RESTRICTED"),
    ),
    "growth.self": (
        ("workerPublicId", "UUID", "prf_grw_profiles.worker_public_id", "RESTRICTED"),
        ("artifactPublicId", "UUID", "prf_grw_profile_revisions.artifact_public_id", "RESTRICTED"),
        ("visibility", "STRING", "prf_grw_profiles.visibility", "RESTRICTED"),
        ("evidenceIds", "ARRAY", "prf_grw_profile_revision_evidence_refs.evidence_public_id", "RESTRICTED"),
    ),
    "hrservice.case": (
        ("caseNumber", "STRING", "ppl_hrs_cases.case_number", "RESTRICTED"),
        ("caseType", "STRING", "ppl_hrs_cases.case_type", "RESTRICTED"),
        ("requesterWorkerPublicId", "UUID", "ppl_hrs_cases.requester_worker_public_id", "RESTRICTED"),
        ("queueKey", "STRING", "ppl_hrs_cases.queue_key", "RESTRICTED"),
        ("caseTypeCodeSetVersionId", "UUID", "ppl_hrs_cases.case_type_code_set_version_id", "RESTRICTED"),
        ("queueCodeSetVersionId", "UUID", "ppl_hrs_cases.queue_code_set_version_id", "RESTRICTED"),
        ("sensitivityClass", "STRING", "ppl_hrs_cases.sensitivity_class", "RESTRICTED"),
        ("contentArtifactIds", "ARRAY", "ppl_hrs_case_actions.content_artifact_public_id", "RESTRICTED"),
        ("actionTypes", "ARRAY", "ppl_hrs_case_actions.action_type", "RESTRICTED"),
        ("slaMilestones", "ARRAY", "ppl_hrs_sla_receipts.milestone", "RESTRICTED"),
    ),
    "learning.assignment": (
        ("workerPublicId", "UUID", "prf_lrn_assignments.worker_public_id", "RESTRICTED"),
        ("offeringVersionId", "UUID", "prf_lrn_assignments.offering_version_public_id", "RESTRICTED"),
        ("dueAt", "TIMESTAMPTZ", "prf_lrn_assignments.due_at", "INTERNAL"),
        ("assignmentSourceCode", "STRING", "prf_lrn_assignments.assignment_source_code", "RESTRICTED"),
        ("progressStatus", "STRING", "prf_lrn_assignments.status", "RESTRICTED"),
        ("completionEvidenceIds", "ARRAY", "prf_lrn_completion_evidence.public_id", "RESTRICTED"),
        ("capacityLedgerEntryTypes", "ARRAY", "prf_lrn_capacity_ledger.entry_type", "RESTRICTED"),
        ("capacityLedgerSequences", "ARRAY", "prf_lrn_capacity_ledger.entry_sequence", "RESTRICTED"),
    ),
    "learning.catalog": (
        ("offeringCode", "STRING", "prf_lrn_offerings.offering_code", "INTERNAL"),
        ("contentArtifactPublicId", "UUID", "prf_lrn_offering_versions.content_artifact_public_id", "RESTRICTED"),
        ("deliveryMode", "STRING", "prf_lrn_offering_versions.delivery_mode", "INTERNAL"),
        ("capacity", "INTEGER", "prf_lrn_offering_versions.capacity", "INTERNAL"),
        ("eligibilityPolicyVersionId", "UUID", "prf_lrn_offering_versions.eligibility_policy_version_id", "RESTRICTED"),
        ("skillMappings", "ARRAY", "prf_lrn_offering_versions.skill_mappings", "RESTRICTED"),
    ),
    "learning.offering": (
        ("displayName", "STRING", "prf_lrn_offering_versions.display_name", "INTERNAL"),
        ("contentArtifactPublicId", "UUID", "prf_lrn_offering_versions.content_artifact_public_id", "RESTRICTED"),
        ("deliveryMode", "STRING", "prf_lrn_offering_versions.delivery_mode", "INTERNAL"),
        ("capacity", "INTEGER", "prf_lrn_offering_versions.capacity", "INTERNAL"),
        ("eligibilityPolicyVersionId", "UUID", "prf_lrn_offering_versions.eligibility_policy_version_id", "RESTRICTED"),
        ("skillMappings", "ARRAY", "prf_lrn_offering_versions.skill_mappings", "RESTRICTED"),
    ),
    "listening.active": (
        ("surveyPublicId", "UUID", "sys_hris_listening_admission_versions.survey_public_id", "RESTRICTED"),
        ("formVersionPublicId", "UUID", "sys_hris_listening_admission_versions.form_version_public_id", "RESTRICTED"),
        ("opensAt", "TIMESTAMPTZ", "sys_hris_listening_admission_versions.opens_at", "INTERNAL"),
        ("closesAt", "TIMESTAMPTZ", "sys_hris_listening_admission_versions.closes_at", "INTERNAL"),
        ("admissionState", "STRING", "sys_hris_listening_admission_versions.state", "RESTRICTED"),
    ),
    "listening.cohort": (
        ("cohortPublicId", "UUID", "sys_hris_listening_cohort_projections.public_id", "RESTRICTED"),
        ("adequacyCategory", "STRING", "sys_hris_listening_cohort_projections.adequacy_category", "INTERNAL"),
        ("measureValues", "ARRAY", "sys_hris_listening_cohort_projections.measure_values", "RESTRICTED"),
        ("subjectCount", "INTEGER", "sys_hris_listening_cohort_projections.subject_count", "RESTRICTED"),
        ("anonymityThreshold", "INTEGER", "sys_hris_listening_cohort_projections.anonymity_threshold", "INTERNAL"),
        ("privacyBudgetReceiptId", "UUID", "sys_hris_listening_cohort_projections.privacy_budget_receipt_public_id", "RESTRICTED"),
        ("lineageReceiptId", "UUID", "sys_hris_listening_lineage_receipts.public_id", "RESTRICTED"),
    ),
    "listening.survey": (
        ("displayName", "STRING", "sys_hris_listening_surveys.display_name", "INTERNAL"),
        ("formVersionPublicId", "UUID", "sys_hris_listening_survey_versions.form_version_public_id", "RESTRICTED"),
        ("privacyVersionPublicId", "UUID", "sys_hris_listening_survey_versions.privacy_version_public_id", "RESTRICTED"),
        ("retentionVersionPublicId", "UUID", "sys_hris_listening_survey_versions.retention_version_public_id", "RESTRICTED"),
        ("opensAt", "TIMESTAMPTZ", "sys_hris_listening_surveys.opens_at", "INTERNAL"),
        ("closesAt", "TIMESTAMPTZ", "sys_hris_listening_surveys.closes_at", "INTERNAL"),
    ),
    "onboarding.template": (
        ("displayName", "STRING", "ppl_jny_template_versions.display_name_snapshot", "INTERNAL"),
        ("effectiveFrom", "DATE", "ppl_jny_template_versions.effective_from", "INTERNAL"),
        ("configScopePublicId", "UUID", "ppl_jny_template_versions.config_scope_public_id", "RESTRICTED"),
        ("taskDefinitions", "ARRAY", "ppl_jny_template_task_definitions.public_id", "RESTRICTED"),
        ("actorRules", "ARRAY", "ppl_jny_template_task_definitions.actor_rule", "RESTRICTED"),
        ("dueAnchors", "ARRAY", "ppl_jny_template_task_definitions.due_anchor_code", "INTERNAL"),
        ("completionSchemaRefs", "ARRAY", "ppl_jny_template_task_definitions.completion_schema_ref", "RESTRICTED"),
    ),
    "onboarding.assignment": (
        ("workerPublicId", "UUID", "ppl_jny_assignments.worker_public_id", "RESTRICTED"),
        ("templateVersionId", "UUID", "ppl_jny_assignments.journey_template_version_id", "RESTRICTED"),
        ("dueAt", "TIMESTAMPTZ", "ppl_jny_assignments.due_at", "INTERNAL"),
        ("taskInstances", "ARRAY", "ppl_jny_assignment_tasks.public_id", "RESTRICTED"),
        ("actorPublicIds", "ARRAY", "ppl_jny_assignment_tasks.actor_public_id", "RESTRICTED"),
        ("evidenceIds", "ARRAY", "ppl_jny_task_evidence.public_id", "RESTRICTED"),
        ("templateTaskKeys", "ARRAY", "ppl_jny_template_task_definitions.task_key", "RESTRICTED"),
        ("templateTaskRequiredFlags", "ARRAY", "ppl_jny_template_task_definitions.required_flag", "RESTRICTED"),
    ),
    "onboarding.self": (
        ("workerPublicId", "UUID", "ppl_jny_assignments.worker_public_id", "RESTRICTED"),
        ("templateVersionId", "UUID", "ppl_jny_assignments.journey_template_version_id", "RESTRICTED"),
        ("dueAt", "TIMESTAMPTZ", "ppl_jny_assignments.due_at", "INTERNAL"),
        ("taskInstances", "ARRAY", "ppl_jny_assignment_tasks.public_id", "RESTRICTED"),
        ("evidenceIds", "ARRAY", "ppl_jny_task_evidence.public_id", "RESTRICTED"),
        ("templateTaskKeys", "ARRAY", "ppl_jny_template_task_definitions.task_key", "RESTRICTED"),
        ("templateTaskRequiredFlags", "ARRAY", "ppl_jny_template_task_definitions.required_flag", "RESTRICTED"),
    ),
    "opportunity.application": (
        ("applicantWorkerPublicId", "UUID", "prf_mkt_applications.worker_public_id", "RESTRICTED"),
        ("opportunityVersionId", "UUID", "prf_mkt_applications.opportunity_version_public_id", "RESTRICTED"),
        ("consentReceiptId", "UUID", "prf_mkt_applications.consent_receipt_public_id", "RESTRICTED"),
        ("statementArtifactPublicId", "UUID", "prf_mkt_applications.statement_artifact_public_id", "RESTRICTED"),
        ("explanationArtifactPublicIds", "ARRAY", "prf_mkt_match_explanations.explanation_artifact_public_id", "RESTRICTED"),
        ("decisionReceiptIds", "ARRAY", "prf_mkt_application_decisions.approval_receipt_public_id", "RESTRICTED"),
        ("opportunityDisplayName", "STRING", "prf_mkt_opportunity_versions.display_name", "INTERNAL"),
        ("opportunityCriteriaArtifactPublicId", "UUID", "prf_mkt_opportunity_versions.criteria_artifact_public_id", "RESTRICTED"),
        ("opportunityOpenFrom", "TIMESTAMPTZ", "prf_mkt_opportunity_versions.open_from", "INTERNAL"),
        ("opportunityCloseAt", "TIMESTAMPTZ", "prf_mkt_opportunity_versions.close_at", "INTERNAL"),
    ),
    "opportunity.catalog": (
        ("displayName", "STRING", "prf_mkt_opportunities.display_name", "INTERNAL"),
        ("criteriaArtifactPublicId", "UUID", "prf_mkt_opportunity_versions.criteria_artifact_public_id", "RESTRICTED"),
        ("capacity", "INTEGER", "prf_mkt_opportunity_versions.capacity", "INTERNAL"),
        ("skillMappings", "ARRAY", "prf_mkt_opportunity_versions.skill_mappings", "RESTRICTED"),
        ("openFrom", "TIMESTAMPTZ", "prf_mkt_opportunities.open_from", "INTERNAL"),
        ("closeAt", "TIMESTAMPTZ", "prf_mkt_opportunities.close_at", "INTERNAL"),
    ),
    "opportunity.query": (
        ("displayName", "STRING", "prf_mkt_opportunity_versions.display_name", "INTERNAL"),
        ("criteriaArtifactPublicId", "UUID", "prf_mkt_opportunity_versions.criteria_artifact_public_id", "RESTRICTED"),
        ("capacity", "INTEGER", "prf_mkt_opportunity_versions.capacity", "INTERNAL"),
        ("skillMappings", "ARRAY", "prf_mkt_opportunity_versions.skill_mappings", "RESTRICTED"),
        ("openFrom", "TIMESTAMPTZ", "prf_mkt_opportunity_versions.open_from", "INTERNAL"),
        ("closeAt", "TIMESTAMPTZ", "prf_mkt_opportunity_versions.close_at", "INTERNAL"),
    ),
    "recruiting.candidate": (
        ("requisitionPublicId", "UUID", "ppl_rec_candidate_cases.requisition_id", "RESTRICTED"),
        ("sourceSystemId", "UUID", "ppl_rec_candidate_cases.source_system_id", "RESTRICTED"),
        ("candidatePersonToken", "UUID", "ppl_rec_candidate_cases.candidate_person_token", "HIGHLY_RESTRICTED"),
        ("consentExpiresAt", "TIMESTAMPTZ", "ppl_rec_candidate_cases.candidate_consent_expires_at", "RESTRICTED"),
        ("stageHistory", "ARRAY", "ppl_rec_candidate_stage_history.state", "RESTRICTED"),
        ("offerStatuses", "ARRAY", "ppl_rec_offers.status", "RESTRICTED"),
        ("hireHandoffReceiptIds", "ARRAY", "ppl_rec_hire_handoff_receipts.public_id", "RESTRICTED"),
        ("offerDecisionOutcomes", "ARRAY", "ppl_rec_offer_decisions.decision", "HIGHLY_RESTRICTED"),
        ("offerDecisionActorModes", "ARRAY", "ppl_rec_offer_decisions.actor_mode", "HIGHLY_RESTRICTED"),
    ),
    "recruiting.requisition": (
        ("requisitionCode", "STRING", "ppl_rec_requisition_versions.requisition_code", "INTERNAL"),
        ("title", "STRING", "ppl_rec_requisition_versions.title", "INTERNAL"),
        ("organizationPublicId", "UUID", "ppl_rec_requisition_versions.organization_public_id", "RESTRICTED"),
        ("positionPublicId", "UUID", "ppl_rec_requisition_versions.position_public_id", "RESTRICTED"),
        ("employmentType", "STRING", "ppl_rec_requisition_versions.employment_type", "INTERNAL"),
        ("employmentTypeCodeSetVersionId", "UUID", "ppl_rec_requisition_versions.employment_type_code_set_version_id", "INTERNAL"),
        ("targetStartDate", "DATE", "ppl_rec_requisition_versions.target_start_date", "INTERNAL"),
        ("revisionModes", "ARRAY", "ppl_rec_requisition_versions.revision_mode", "RESTRICTED"),
        ("revisionEffectiveFromDates", "ARRAY", "ppl_rec_requisition_versions.effective_from", "INTERNAL"),
    ),
    "skills.evidence": (
        ("workerPublicId", "UUID", "prf_skl_worker_evidence.worker_public_id", "RESTRICTED"),
        ("skillPublicId", "UUID", "prf_skl_worker_evidence.skill_public_id", "RESTRICTED"),
        ("taxonomyVersionPublicId", "UUID", "prf_skl_worker_evidence.taxonomy_version_public_id", "RESTRICTED"),
        ("proficiencyBandCode", "STRING", "prf_skl_worker_evidence.proficiency_level", "RESTRICTED"),
        ("sourceKey", "STRING", "prf_skl_worker_evidence.source_key", "RESTRICTED"),
        ("observedAt", "TIMESTAMPTZ", "prf_skl_worker_evidence.observed_at", "RESTRICTED"),
        ("consentReceiptPublicId", "UUID", "prf_skl_worker_evidence.consent_receipt_public_id", "RESTRICTED"),
    ),
    "skills.taxonom": (
        ("taxonomyKey", "STRING", "prf_skl_taxonomies.taxonomy_key", "INTERNAL"),
        ("effectiveFrom", "DATE", "prf_skl_taxonomy_versions.effective_from", "INTERNAL"),
        ("skillNodes", "ARRAY", "prf_skl_skill_nodes.skill_code", "INTERNAL"),
        ("skillEdges", "ARRAY", "prf_skl_skill_edges.edge_type_code", "INTERNAL"),
        ("proficiencyBands", "ARRAY", "prf_skl_proficiency_levels.level_code", "INTERNAL"),
    ),
    "skills.worker": (
        ("workerPublicId", "UUID", "prf_skl_worker_evidence.worker_public_id", "RESTRICTED"),
        ("skillPublicId", "UUID", "prf_skl_worker_evidence.skill_public_id", "RESTRICTED"),
        ("taxonomyVersionPublicId", "UUID", "prf_skl_worker_evidence.taxonomy_version_public_id", "RESTRICTED"),
        ("proficiencyBandCode", "STRING", "prf_skl_worker_evidence.proficiency_level", "RESTRICTED"),
        ("evidencePublicId", "UUID", "prf_skl_worker_evidence.public_id", "RESTRICTED"),
    ),
    "succession.plan": (
        ("displayName", "STRING", "prf_suc_plan_versions.display_name", "RESTRICTED"),
        ("keyPositionPublicId", "UUID", "prf_suc_plan_versions.key_position_public_id", "RESTRICTED"),
        ("audiencePolicyPublicId", "UUID", "prf_suc_plan_versions.audience_policy_public_id", "HIGHLY_RESTRICTED"),
        ("nominationPublicIds", "ARRAY", "prf_suc_nominations.public_id", "HIGHLY_RESTRICTED"),
        ("readinessEvidenceIds", "ARRAY", "prf_suc_readiness_evidence.evidence_public_id", "HIGHLY_RESTRICTED"),
        ("consentReceiptIds", "ARRAY", "prf_suc_nominations.consent_receipt_public_id", "HIGHLY_RESTRICTED"),
        ("planRevision", "BIGINT", "prf_suc_plan_versions.version_no", "HIGHLY_RESTRICTED"),
        ("contentArtifactPublicId", "UUID", "prf_suc_plan_versions.content_artifact_public_id", "HIGHLY_RESTRICTED"),
    ),
    "wfm.candidate": (
        ("forecastPublicId", "UUID", "tme_wfm_schedule_candidates.demand_forecast_id", "RESTRICTED"),
        ("candidateVersion", "BIGINT", "tme_wfm_schedule_candidates.candidate_revision", "RESTRICTED"),
        ("shiftLines", "ARRAY", "tme_wfm_candidate_shift_lines.public_id", "HIGHLY_RESTRICTED"),
        ("timeGroupIds", "ARRAY", "tme_wfm_schedule_candidate_time_group_refs.time_group_public_id", "RESTRICTED"),
        ("constraintReceiptIds", "ARRAY", "tme_wfm_constraint_evaluation_receipts.public_id", "RESTRICTED"),
        ("fairnessResults", "ARRAY", "tme_wfm_fairness_measure_values.result", "HIGHLY_RESTRICTED"),
        ("approvalReceiptIds", "ARRAY", "tme_wfm_approval_receipts.public_id", "RESTRICTED"),
        ("approvalOutcomes", "ARRAY", "tme_wfm_approval_receipts.outcome", "RESTRICTED"),
        ("publishReceiptIds", "ARRAY", "tme_wfm_schedule_publish_ledger.public_id", "RESTRICTED"),
    ),
    "wfm.forecast": (
        ("organizationPublicId", "UUID", "tme_wfm_demand_lines.organization_public_id", "RESTRICTED"),
        ("periodStart", "TIMESTAMPTZ", "tme_wfm_demand_forecasts.period_start", "INTERNAL"),
        ("periodEnd", "TIMESTAMPTZ", "tme_wfm_demand_forecasts.period_end", "INTERNAL"),
        ("demandLines", "ARRAY", "tme_wfm_demand_lines.public_id", "RESTRICTED"),
        ("demandUnitCode", "STRING", "tme_wfm_demand_lines.demand_unit_code", "INTERNAL"),
        ("demandUnitCodeSetVersionId", "UUID", "tme_wfm_demand_lines.demand_unit_code_set_version_id", "INTERNAL"),
        ("skillPublicIds", "ARRAY", "tme_wfm_demand_lines.skill_public_id", "RESTRICTED"),
    ),
    "wfm.optimization": (
        ("forecastPublicId", "UUID", "tme_wfm_optimization_requests.forecast_public_id", "RESTRICTED"),
        ("optimizationMode", "STRING", "tme_wfm_optimization_requests.optimization_mode", "INTERNAL"),
        ("availabilitySnapshotId", "UUID", "tme_wfm_optimization_requests.availability_snapshot_id", "RESTRICTED"),
        ("ruleSnapshotVersion", "BIGINT", "tme_wfm_optimization_requests.rule_version", "RESTRICTED"),
        ("status", "STRING", "tme_wfm_optimization_requests.status", "RESTRICTED"),
    ),
    "workforceplan.scenario": (
        ("displayName", "STRING", "ppl_wfp_scenarios.display_name", "RESTRICTED"),
        ("asOfDate", "DATE", "ppl_wfp_scenarios.as_of_date", "INTERNAL"),
        ("organizationSnapshotPublicId", "UUID", "ppl_wfp_scenario_revisions.organization_snapshot_public_id", "RESTRICTED"),
        ("inputSnapshotPublicId", "UUID", "ppl_wfp_scenario_revisions.input_snapshot_public_id", "RESTRICTED"),
        ("assumptionArtifactPublicId", "UUID", "ppl_wfp_scenario_revisions.assumption_artifact_public_id", "RESTRICTED"),
        ("unitCode", "STRING", "ppl_wfp_scenario_revisions.unit_code", "INTERNAL"),
        ("horizonStart", "DATE", "ppl_wfp_scenario_revisions.horizon_start", "INTERNAL"),
        ("simulationResultReceiptIds", "ARRAY", "ppl_wfp_simulation_requests.result_receipt_public_id", "RESTRICTED"),
        ("simulationResultDigests", "ARRAY", "ppl_wfp_simulation_requests.result_digest", "RESTRICTED"),
    ),
}


def render(value: dict[str, Any]) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2) + "\n"


def column(name: str, sql_type: str, *, nullable: bool = False,
           default: str | None = None, reference: str | None = None,
           serialization: str | None = None, max_bytes: int | None = None,
           allowed_algorithms: tuple[str, ...] | None = None) -> dict[str, Any]:
    result: dict[str, Any] = {
        "name": name, "sqlType": sql_type, "nullable": nullable, "default": default,
        "sensitivity": "RESTRICTED" if reference and sql_type == "UUID" else "INTERNAL",
        "tokenization": (
            "OPAQUE_PUBLIC_ID" if reference and sql_type == "UUID" else
            "NONREVERSIBLE_DIGEST" if name.endswith(("digest", "hash")) else "NONE"
        ),
        "source": "REVIEWED_MODERN_CLOSED_SET_V3",
    }
    if reference:
        result["referenceContract"] = {
            "entityType": reference,
            "idSpace": "INTERNAL_BIGINT" if sql_type == "BIGINT" else "PUBLIC_UUID",
        }
    if serialization is not None:
        result["serialization"] = serialization
    if max_bytes is not None:
        result["maxBytes"] = max_bytes
    if allowed_algorithms is not None:
        result["allowedAlgorithms"] = list(allowed_algorithms)
    return result


def _snake(name: str) -> str:
    return re.sub(r"(?<!^)(?=[A-Z])", "_", name).lower()


def _append_column(table: dict[str, Any], value: dict[str, Any]) -> None:
    table["columns"] = [
        row for row in table.get("columns", []) if row["name"] != value["name"]
    ]
    table["columns"].append(value)


def _protected_commitment_column(
    name: str, *, nullable: bool = False, sensitivity: str = "HIGHLY_RESTRICTED",
) -> dict[str, Any]:
    value = column(name, "CHAR(64)", nullable=nullable)
    value.update({
        "sensitivity": sensitivity,
        "tokenization": "OWNER_HMAC_NONREVERSIBLE_COMMITMENT",
        "logging": "FORBIDDEN",
        "cdcExposure": "FORBIDDEN_OUTSIDE_OWNER_SCHEMA",
    })
    return value


def _apply_ai_governance_tables(result: dict[str, dict[str, Any]]) -> None:
    """Materialize only typed pins to the central DWP AI-governance owner."""
    policy = result["sys_hris_ai_use_policies"]
    for value in (
        column("risk_classification", "VARCHAR(80)"),
        column(
            "governance_activation_receipt_id", "UUID", nullable=True,
            reference="DWP.AIGovernance.ActivationReceipt",
        ),
        column("governance_activation_receipt_revision", "BIGINT", nullable=True),
        column("governance_expires_at", "TIMESTAMPTZ", nullable=True),
        column("monitoring_status", "VARCHAR(40)", nullable=True),
        column("kill_switch_enabled", "BOOLEAN", default="FALSE"),
    ):
        _append_column(policy, value)

    versions = result["sys_hris_ai_policy_versions"]
    for proof in AI_GOVERNANCE_REQUIRED_PROOFS:
        _append_column(versions, column(
            _snake(proof["field"]), "UUID", reference=proof["entityType"]
        ))
    _append_column(versions, column("proof_set_digest", "CHAR(64)"))

    evaluation = result["sys_hris_ai_evaluation_requests"]
    removed = {
        "policy_version", "evaluation_suite_version", "fixture_set_digest", "model_route_key",
    }
    evaluation["columns"] = [
        row for row in evaluation.get("columns", []) if row["name"] not in removed
    ]
    evaluation["checks"] = [
        row for row in evaluation.get("checks", [])
        if not (set(row.get("columns", [])) & removed)
    ]
    for value in (
        column(
            "ai_policy_version_id", "BIGINT",
            reference="table:sys_hris_ai_policy_versions",
        ),
        column(
            "policy_public_id", "UUID",
            reference="table:sys_hris_ai_use_policies",
        ),
        column(
            "policy_version_public_id", "UUID",
            reference="table:sys_hris_ai_policy_versions",
        ),
        column(
            "evaluation_protocol_version_id", "UUID",
            reference="DWP.AIGovernance.EvaluationProtocolVersion",
        ),
        column(
            "dataset_manifest_version_id", "UUID",
            reference="DWP.AIGovernance.DatasetManifestVersion",
        ),
        column(
            "model_version_id", "UUID", reference="DWP.AIGovernance.ModelVersion",
        ),
    ):
        _append_column(evaluation, value)
    evaluation["foreignKeys"] = [
        row for row in evaluation.get("foreignKeys", [])
        if row.get("columns") != ["tenant_id", "ai_policy_version_id"]
    ]
    evaluation["foreignKeys"].append({
        "mode": "LOCAL_COMPOSITE_FK",
        "columns": ["tenant_id", "ai_policy_version_id"],
        "target": "sys_hris_ai_policy_versions",
        "targetColumns": ["tenant_id", "ai_policy_version_id"],
        "constraintId": "fk_sys_hris_ai_evaluation_requests_policy_version_v3",
    })

    assistance = result["sys_hris_ai_assistance_requests"]
    for value in (
        column("use_case_key", "VARCHAR(160)"),
        column(
            "ai_policy_version_id", "BIGINT",
            reference="table:sys_hris_ai_policy_versions",
        ),
        column(
            "instruction_artifact_version_id", "UUID",
            reference="DWP.Content.ProtectedInstructionArtifactVersion",
        ),
        column(
            "source_projection_bundle_receipt_id", "UUID",
            reference="DWP.DataGovernance.AuthorizedProjectionBundleReceipt",
        ),
        column(
            "governance_activation_receipt_id", "UUID",
            reference="DWP.AIGovernance.ActivationReceipt",
        ),
        column("governance_activation_receipt_revision", "BIGINT"),
        column(
            "human_oversight_assignment_version_id", "UUID",
            reference="DWP.AIGovernance.HumanOversightAssignmentVersion",
        ),
        column(
            "affected_person_disclosure_evidence_id", "UUID",
            reference="DWP.AIGovernance.AffectedPersonDisclosureEvidence",
        ),
        column(
            "kill_switch_control_version_id", "UUID",
            reference="DWP.AIGovernance.KillSwitchControlVersion",
        ),
        column("monitoring_expires_at", "TIMESTAMPTZ"),
        column("requested_at", "TIMESTAMPTZ"),
        column("request_digest", "CHAR(64)"),
    ):
        _append_column(assistance, value)

    provenance = result["sys_hris_ai_provenance_receipts"]
    provenance["columns"] = [
        row for row in provenance.get("columns", [])
        if row["name"] not in {
            "idempotency_key", "source_refs", "source_refs_digest", "model_route_key",
            "assistance_request_id", "governance_activation_receipt_id",
            "output_digest", "generated_at",
            "request_id", "activation_receipt_id", "response_digest", "produced_at",
        }
    ]
    provenance["checks"] = [
        row for row in provenance.get("checks", [])
        if not (
            set(row.get("columns", []))
            & {
                "idempotency_key", "source_refs", "source_refs_digest", "model_route_key",
                "assistance_request_id", "governance_activation_receipt_id",
                "output_digest", "generated_at",
                "request_id", "activation_receipt_id", "response_digest", "produced_at",
            }
        )
    ]
    for value in (
        column(
            "assistance_request_id", "BIGINT",
            reference="table:sys_hris_ai_assistance_requests",
        ),
        column(
            "model_version_id", "UUID", reference="DWP.AIGovernance.ModelVersion",
        ),
        column(
            "prompt_template_version_id", "UUID",
            reference="DWP.AIGovernance.PromptTemplateVersion",
        ),
        column(
            "dataset_manifest_version_id", "UUID",
            reference="DWP.AIGovernance.DatasetManifestVersion",
        ),
        column(
            "evaluation_protocol_version_id", "UUID",
            reference="DWP.AIGovernance.EvaluationProtocolVersion",
        ),
        column(
            "governance_activation_receipt_id", "UUID",
            reference="DWP.AIGovernance.ActivationReceipt",
        ),
        column(
            "affected_person_disclosure_evidence_id", "UUID",
            reference="DWP.AIGovernance.AffectedPersonDisclosureEvidence",
        ),
        column("output_digest", "CHAR(64)"),
        column("generated_at", "TIMESTAMPTZ"),
    ):
        _append_column(provenance, value)
    provenance["foreignKeys"] = [
        row for row in provenance.get("foreignKeys", [])
        if row.get("columns") not in (
            ["source_refs"], ["tenant_id", "assistance_request_id"],
            ["tenant_id", "request_id"],
        )
    ]
    provenance["foreignKeys"].append({
        "mode": "LOCAL_COMPOSITE_FK",
        "columns": ["tenant_id", "assistance_request_id"],
        "target": "sys_hris_ai_assistance_requests",
        "targetColumns": ["tenant_id", "record_id"],
        "constraintId": "fk_sys_hris_ai_provenance_receipts_assistance_v3",
    })
    provenance["resultProofContract"] = {
        "requestIdentity": "assistance_request_id is the exact local request row identity",
        "activationIdentity": (
            "governance_activation_receipt_id is the immutable central owner activation proof"
        ),
        "resultDigest": "output_digest is the digest of the canonical produced response bytes",
        "productionTime": "generated_at is the signed owner production timestamp",
        "sameTransactionAppend": True,
        "restartReplay": "RECONSTRUCT_FROM_IMMUTABLE_PROVENANCE_ROW",
    }

    for table in (policy, versions, evaluation, assistance, provenance):
        table["typedOwnerReferenceContracts"] = [
            {
                "column": value["name"],
                "entityType": value["referenceContract"]["entityType"],
                "idSpace": value["referenceContract"]["idSpace"],
                "proof": "tenant+purpose+population+exact revision/asOf; signed owner receipt",
            }
            for value in table.get("columns", [])
            if value.get("referenceContract", {}).get("entityType", "").startswith("DWP.")
        ]
        table["aiGovernanceOwnerBoundary"] = {
            "owner": "DWP-COMMON-AI-GOVERNANCE",
            "localMode": "TYPED_IMMUTABLE_REFERENCE_ONLY",
            "activation": "G6_FAIL_CLOSED_ON_MISSING_STALE_RETIRED_OR_CROSS_TENANT_PROOF",
            "centralRegistryDuplication": "FORBIDDEN",
        }


def _new_table(table_name: str) -> dict[str, Any]:
    if table_name in TYPED_ORDERED_CHILD_TABLES:
        capability, session, parent, child_column, child_entity = (
            TYPED_ORDERED_CHILD_TABLES[table_name]
        )
        local_child = child_entity.startswith("table:")
        child_table = child_entity.removeprefix("table:")
        foreign_keys = [{
            "mode": "LOCAL_COMPOSITE_FK",
            "columns": ["tenant_id", "parent_public_id"],
            "target": parent, "targetColumns": ["tenant_id", "public_id"],
            "constraintId": "fk_" + table_name + "_parent_v3",
        }]
        if local_child:
            foreign_keys.append({
                "mode": "LOCAL_COMPOSITE_FK",
                "columns": ["tenant_id", child_column],
                "target": child_table, "targetColumns": ["tenant_id", "public_id"],
                "constraintId": "fk_" + table_name + "_child_v3",
            })
        result = {
            "capabilityId": capability, "session": session,
            "tableName": table_name, "kind": "TYPED_ORDERED_CHILD_REFERENCE",
            "idColumn": {"name": "record_id", "sqlType": "BIGINT", "nullable": False,
                         "default": "IDENTITY", "exposure": "INTERNAL_ONLY"},
            "commonColumnsRef": "DWP_MODERN_TENANT_TABLE_V1",
            "columns": [
                column("parent_public_id", "UUID", reference="table:" + parent),
                column("ordinal", "INTEGER"),
                column(child_column, "UUID", reference=child_entity),
            ],
            "foreignKeys": foreign_keys,
            "uniqueKeys": [
                {"constraintId": "uk_" + table_name + "_ordinal",
                 "columns": ["tenant_id", "parent_public_id", "ordinal"]},
                {"constraintId": "uk_" + table_name + "_child",
                 "columns": ["tenant_id", "parent_public_id", child_column]},
            ],
            "checks": [{"constraintId": "ck_" + table_name + "_ordinal",
                        "expression": "ordinal BETWEEN 1 AND 100000",
                        "columns": ["ordinal"]}],
            "indexes": [{"indexId": "idx_" + table_name + "_child",
                         "columns": ["tenant_id", child_column], "unique": False}],
            "rowSecurity": "ENABLE_FORCE_DWP_TENANT_BIGINT_NOBYPASSRLS",
            "retentionPolicyRef": capability + ".RetentionPolicyVersion",
            "immutability": "APPEND_ONLY_ORDERED_TYPED_REFERENCE",
            "effectiveTime": "parent exact revision/asOf; no latest fallback",
            "collectionContract": {
                "ordinalTarget": table_name + ".ordinal",
                "deterministicOrderBy": "validated request order",
                "tieBreaker": child_column + " ASC",
                "bounds": "ordinal CHECK 1..100000 and exact parent-child uniqueness",
            },
        }
        if not local_child:
            result["typedOwnerReferenceContracts"] = [{
                "column": child_column, "entityType": child_entity,
                "idSpace": "PUBLIC_UUID",
                "proof": "tenant+purpose+population+exact revision/asOf",
            }]
        return result
    capability, session, parent = TABLE_OWNER[table_name]
    state_values = STATE_VALUES[table_name]
    columns = [
        column("parent_public_id", "UUID", reference="table:" + parent),
        column("parent_version", "BIGINT"),
        column("fact_revision", "BIGINT", default="1"),
        column("state", "VARCHAR(40)"),
        column("ordinal", "INTEGER", default="1"),
        column("payload_digest", "CHAR(64)"),
        column("reference_effective_at", "TIMESTAMPTZ"),
        column("result_public_id", "UUID", nullable=True, reference=capability + ".OwnerResult"),
        column("result_revision", "BIGINT", nullable=True),
        column("completed_at", "TIMESTAMPTZ", nullable=True),
    ]
    return {
        "capabilityId": capability, "session": session, "tableName": table_name,
        "kind": "IMMUTABLE_REVISION_OR_ASYNC_LEDGER",
        "idColumn": {"name": "record_id", "sqlType": "BIGINT", "nullable": False,
                     "default": "IDENTITY", "exposure": "INTERNAL_ONLY"},
        "commonColumnsRef": "DWP_MODERN_TENANT_TABLE_V1",
        "columns": columns,
        "foreignKeys": [{
            "mode": "LOCAL_COMPOSITE_FK", "columns": ["tenant_id", "parent_public_id"],
            "target": parent, "targetColumns": ["tenant_id", "public_id"],
            "constraintId": "fk_" + table_name + "_parent_v3",
        }],
        "uniqueKeys": [
            {"constraintId": "uk_" + table_name + "_tenant_public",
             "columns": ["tenant_id", "public_id"]},
            {"constraintId": "uk_" + table_name + "_parent_revision",
             "columns": ["tenant_id", "parent_public_id", "fact_revision"]},
            {"constraintId": "uk_" + table_name + "_parent_ordinal_revision",
             "columns": ["tenant_id", "parent_public_id", "fact_revision", "ordinal"]},
        ],
        "checks": [
            {"constraintId": "ck_" + table_name + "_state",
             "expression": "state IN (" + ",".join(repr(value) for value in state_values) + ")",
             "columns": ["state"]},
            {"constraintId": "ck_" + table_name + "_ordinal",
             "expression": "ordinal BETWEEN 1 AND 100000", "columns": ["ordinal"]},
            {"constraintId": "ck_" + table_name + "_result_pair",
             "expression": "(result_public_id IS NULL) = (result_revision IS NULL)",
             "columns": ["result_public_id", "result_revision"]},
        ],
        "indexes": [
            {"indexId": "idx_" + table_name + "_parent_state",
             "columns": ["tenant_id", "parent_public_id", "state"]},
            {"indexId": "idx_" + table_name + "_payload_digest",
             "columns": ["tenant_id", "payload_digest"], "unique": False},
        ],
        "rowSecurity": "ENABLE_FORCE_DWP_TENANT_BIGINT_NOBYPASSRLS",
        "retentionPolicyRef": capability + ".RetentionPolicyVersion",
        "immutability": "APPEND_ONLY_REVISION_OR_TERMINAL_ASYNC_STATUS",
        "effectiveTime": "reference_effective_at exact; no latest fallback",
        "collectionContract": {
            "ordinalTarget": table_name + ".ordinal",
            "deterministicOrderBy": "validated business key ASC",
            "tieBreaker": "canonical public_id ASC",
            "bounds": "CHECK intersection; unsupported predicate fail closed",
        },
    }


def _listening_table(source: dict[str, Any], existing: dict[str, Any] | None) -> dict[str, Any]:
    table_name = source["tableName"]
    row = copy.deepcopy(existing) if existing else {
        "capabilityId": "HRIS.MODERN.EMPLOYEE_LISTENING", "session": "HRIS-SYS",
        "tableName": table_name, "kind": "LISTENING_OWNER_LOCAL_TABLE",
        "idColumn": {"name": "record_id", "sqlType": "BIGINT", "nullable": False,
                     "default": "IDENTITY", "exposure": "INTERNAL_ONLY"},
        "commonColumnsRef": "DWP_MODERN_TENANT_TABLE_V1",
        "columns": [], "foreignKeys": [], "uniqueKeys": [], "checks": [], "indexes": [],
        "rowSecurity": "ENABLE_FORCE_DWP_TENANT_BIGINT_NOBYPASSRLS",
        "retentionPolicyRef": "SYS.ListeningRetentionPolicyVersion",
        "immutability": "OWNER_LOCAL_VERSIONED_OR_APPEND_ONLY",
        "effectiveTime": "owner revision/asOf exact; no latest fallback",
    }
    row.update({"capabilityId": "HRIS.MODERN.EMPLOYEE_LISTENING", "session": "HRIS-SYS",
                "tableName": table_name, "streamKey": source["streamKey"]})
    names = {item["name"] for item in row["columns"]}
    for item in (
        column("state", "VARCHAR(40)", default="'ACTIVE'"),
        column("owner_revision", "BIGINT", default="1"),
        column("payload_digest", "CHAR(64)"),
        column("reference_effective_at", "TIMESTAMPTZ"),
    ):
        if item["name"] not in names:
            row["columns"].append(item)
    row["uniqueKeys"] = [
        key for key in row.get("uniqueKeys", [])
        if not any(re.search(r"(?:digest|hash)", name, re.I) for name in key.get("columns", []))
    ]
    if not any(key.get("columns") == ["tenant_id", "public_id"] for key in row["uniqueKeys"]):
        row["uniqueKeys"].append({"constraintId": "uk_" + table_name + "_tenant_public",
                                  "columns": ["tenant_id", "public_id"]})
    local_id_column = row["idColumn"]["name"]
    if not any(key.get("columns") == ["tenant_id", local_id_column] for key in row["uniqueKeys"]):
        row["uniqueKeys"].append({
            "constraintId": "uk_" + table_name + "_tenant_local_id",
            "columns": ["tenant_id", local_id_column],
        })
    local_fks = []
    for index, foreign in enumerate(source.get("localForeignKeys", []), 1):
        local_fks.append({
            "mode": "LOCAL_COMPOSITE_FK", "columns": foreign["columns"],
            "target": foreign["targetTable"], "targetColumns": foreign["targetColumns"],
            "constraintId": "fk_" + table_name + f"_listening_{index}",
        })
    row["foreignKeys"] = local_fks
    row["crossSchemaForeignKeys"] = []
    return row


def _expected_listening_foreign_keys(
    listening_design: dict[str, Any],
) -> dict[str, list[dict[str, Any]]]:
    """Return the exact owner-local FK set accepted for the 23-table design."""
    expected: dict[str, list[dict[str, Any]]] = {
        row["tableName"]: [] for row in listening_design["tableOwnership"]
    }
    for source in listening_design["tableOwnership"]:
        table_name = source["tableName"]
        for index, foreign in enumerate(source.get("localForeignKeys", []), 1):
            expected[table_name].append({
                "mode": "LOCAL_COMPOSITE_FK",
                "columns": copy.deepcopy(foreign["columns"]),
                "target": foreign["targetTable"],
                "targetColumns": copy.deepcopy(foreign["targetColumns"]),
                "constraintId": "fk_" + table_name + f"_listening_{index}",
            })
    for table_name, foreign in LISTENING_VERSION_CHAIN_FOREIGN_KEYS.items():
        if table_name not in expected:
            raise ValueError(
                f"Listening predecessor FK table is not in the table registry: {table_name}"
            )
        expected[table_name].append(copy.deepcopy(foreign))
    return expected


def _temporal_arbitration_contract(
    parent_column: str, revision_column: str, root_table: str,
) -> dict[str, Any]:
    """Canonical, executable arbitration contract for all seven version ledgers."""
    return {
        "strategy": "DUAL_APPEND_ONLY_ROOT_AND_EFFECTIVE_SEGMENT_CHAINS",
        "rawHistoryExclusion": "NONE",
        "parentColumns": ["tenant_id", parent_column],
        "revisionColumn": revision_column,
        "rootVersionColumn": "root_version",
        "rootPredecessorPublicIdColumn": "root_predecessor_public_id",
        "rootPredecessorVersionColumn": "root_predecessor_version",
        "revisionModeColumn": "revision_mode",
        "effectiveSegmentPublicIdColumn": "effective_segment_public_id",
        "segmentRevisionColumn": "segment_revision",
        "segmentPredecessorPublicIdColumn": "segment_predecessor_public_id",
        "segmentPredecessorRevisionColumn": "segment_predecessor_revision",
        "effectiveFromColumn": "effective_from",
        "effectiveToColumn": "effective_to",
        "recordedAtColumn": "created_at",
        "rootTable": root_table,
        "rootAggregateVersionColumn": "aggregate_version",
        "rootCasRequired": True,
        "globalAppendRule": (
            "root_version=lockedRoot.aggregate_version+1;root_predecessor identifies "
            "the prior global append;root UPDATE_CAS and version APPEND are one transaction"
        ),
        "correctionRule": (
            "CORRECTION reuses the exact target segment id/effective_from and appends "
            "segment_revision=target+1 with the exact segment predecessor; no old row mutation"
        ),
        "lifecycleRule": (
            "LIFECYCLE appends the exact current segment tip with segment_revision+1;"
            "it never allocates a new effective segment"
        ),
        "futureSupersedeRule": (
            "SUPERSEDE allocates a new segment id at effective_from with segment_revision=1;"
            "prior rows and stored boundaries are never updated"
        ),
        "storedEffectiveToAuthority": "FORBIDDEN_NULL_ONLY",
        "derivedEffectiveTo": "NEXT_VISIBLE_BASE_SEGMENT_EFFECTIVE_FROM_OR_OPEN_END",
        "businessAsOfWinner": (
            "after systemAsOf filter, select base segment_revision=1 with maximum "
            "effective_from<=businessAsOf, then select maximum segment_revision only "
            "within that effective_segment_public_id"
        ),
        "stateWinner": (
            "after systemAsOf filter select maximum root_version across all rows; "
            "state/status and aggregate version come from this row even when a future "
            "content segment is not the businessAsOf content winner"
        ),
        "contentAndStateIdentity": (
            "contentRevisionPublicId=business segment winner public_id; "
            "stateRevisionPublicId=global state winner public_id; lifecycle rows persist "
            "content_revision_public_id naming the copied content source in the same "
            "effective segment and effective_from; content-changing rows point to self"
        ),
        "systemAsOfRule": (
            "FIRST_FILTER_created_at<=systemAsOf_THEN_DERIVE_VISIBLE_BASE_SEGMENTS_AND_NEXT_BOUNDARY"
        ),
        "concurrentSameExpectedVersion": "EXACTLY_ONE_SUCCESS",
        "intervalValidation": "effective_from IS NOT NULL AND effective_to IS NULL",
        "positiveFixtures": [
            "historical CORRECTION after a future SUPERSEDE changes only its target segment winner",
            "future SUPERSEDE appends a new segment; prior segment wins before derived boundary only",
        ],
        "negativeFixtures": [
            "correction target outside the named segment or nonlatest segment revision is rejected",
            "two writers with the same expected root version yield exactly one successful append+root CAS",
        ],
    }


def _normalize_tables(before: dict[str, Any], manifest: dict[str, Any]) -> list[dict[str, Any]]:
    current = {row["tableName"]: copy.deepcopy(row) for row in before["tableSpecifications"]}
    listening = build_static_design()
    result = {
        name: row for name, row in current.items()
        if name not in LEGACY_LISTENING_TABLE_IDS
        and name not in CURRENT_115_REMOVED_TABLE_IDS
    }
    for source in listening["tableOwnership"]:
        result[source["tableName"]] = _listening_table(source, current.get(source["tableName"]))
    for table_name in sorted(ADDED_TABLE_IDS):
        result[table_name] = _new_table(table_name)

    # One lifecycle column per aggregate.  Candidate uses `stage`; Listening
    # public operations and the static stream design use `status`.
    result["ppl_rec_candidate_cases"]["columns"] = [
        value for value in result["ppl_rec_candidate_cases"]["columns"]
        if value["name"] != "status"
    ]
    for name in (
        "sys_hris_listening_surveys", "sys_hris_listening_responses",
        "sys_hris_listening_actions",
    ):
        result[name]["columns"] = [
            value for value in result[name]["columns"] if value["name"] != "state"
        ]
        result[name]["checks"] = [
            value for value in result[name].get("checks", [])
            if "state" not in value.get("columns", [])
        ]
    surveys = result["sys_hris_listening_surveys"]
    surveys["checks"] = [
        value for value in surveys.get("checks", [])
        if "status" not in value.get("columns", [])
    ]
    surveys.setdefault("checks", []).append({
        "constraintId": "ck_sys_hris_listening_surveys_saga_state_v4",
        "expression": (
            "status IN ('DRAFT','PUBLISH_PENDING','PUBLISH_RETRYABLE','PUBLISHED',"
            "'CLOSE_PENDING','CLOSE_RETRYABLE','CLOSED')"
        ),
        "columns": ["status"],
    })
    survey_versions = result["sys_hris_listening_survey_versions"]
    for value in (
        column("predecessor_version_public_id", "UUID", nullable=True,
               reference="table:sys_hris_listening_survey_versions"),
        column("predecessor_owner_revision", "BIGINT", default="0"),
        column("admission_public_id", "UUID", nullable=True, reference="DWP.Listening.ProtectedAdmission"),
        column("admission_version_public_id", "UUID", nullable=True,
               reference="DWP.Listening.ProtectedAdmissionVersion"),
        column("admission_owner_version", "BIGINT", nullable=True),
        column("protected_receipt_public_id", "UUID", nullable=True, reference="DWP.Listening.OwnerPortReceipt"),
        column("request_message_id", "UUID", nullable=True, reference="DWP.Listening.OwnerPortMessage"),
        column("form_artifact_schema_version", "VARCHAR(80)"),
        column("form_artifact_digest", "CHAR(64)"),
        column("consent_policy_version_public_id", "UUID", reference="DWP.Consent.PolicyVersion"),
        column("token_policy_version_public_id", "UUID", reference="DWP.Listening.TokenPolicyVersion"),
    ):
        _append_column(survey_versions, value)
    survey_versions["checks"] = [
        value for value in survey_versions.get("checks", [])
        if "state" not in value.get("columns", [])
    ]
    survey_versions.setdefault("checks", []).append({
        "constraintId": "ck_sys_hris_listening_survey_versions_saga_state_v4",
        "expression": (
            "state IN ('DRAFT','PUBLISH_PENDING','PUBLISH_RETRYABLE','PUBLISHED',"
            "'CLOSE_PENDING','CLOSE_RETRYABLE','CLOSED')"
        ),
        "columns": ["state"],
    })
    survey_versions.setdefault("uniqueKeys", []).extend([
        {
            "constraintId": "uk_sys_hris_listening_survey_versions_owner_revision_v4",
            "columns": ["tenant_id", "listening_survey_id", "owner_revision"],
        },
        {
            "constraintId": "uk_sys_hris_listening_survey_versions_predecessor_target_v4",
            "columns": [
                "tenant_id", "listening_survey_id", "public_id", "owner_revision",
            ],
        },
    ])
    survey_versions.setdefault("foreignKeys", []).append({
        "mode": "LOCAL_COMPOSITE_FK",
        "columns": [
            "tenant_id", "listening_survey_id",
            "predecessor_version_public_id", "predecessor_owner_revision",
        ],
        "target": "sys_hris_listening_survey_versions",
        "targetColumns": [
            "tenant_id", "listening_survey_id", "public_id", "owner_revision",
        ],
        "constraintId": "fk_sys_hris_listening_survey_versions_predecessor_v4",
    })
    survey_versions.setdefault("checks", []).append({
        "constraintId": "ck_sys_hris_listening_survey_versions_predecessor_v4",
        "expression": (
            "((owner_revision=1 AND predecessor_version_public_id IS NULL "
            "AND predecessor_owner_revision=0) OR (owner_revision>1 "
            "AND predecessor_version_public_id IS NOT NULL "
            "AND predecessor_owner_revision=owner_revision-1))"
        ),
        "columns": [
            "owner_revision", "predecessor_version_public_id", "predecessor_owner_revision",
        ],
    })
    survey_versions["immutability"] = "APPEND_ONLY_ROOT_CAS_SERIALIZED_SURVEY_VERSION_CHAIN"

    # Action creation binds both the exact published survey version and the
    # static successor cohort projection.  The retired cohort-results
    # materialization is not an admissible selector or causal relation.
    listening_actions = result["sys_hris_listening_actions"]
    _append_column(listening_actions, column(
        "listening_survey_version_id", "BIGINT",
        reference="table:sys_hris_listening_survey_versions",
    ))
    _append_column(listening_actions, column(
        "cohort_projection_public_id", "UUID",
        reference="DWP.Listening.CohortProjectionVersion",
    ))
    _append_column(listening_actions, column("cohort_projection_revision", "BIGINT"))
    _append_column(listening_actions, column("cohort_projection_as_of", "TIMESTAMPTZ"))
    _append_column(listening_actions, column(
        "cohort_projection_lineage_receipt_public_id", "UUID",
        reference="DWP.Listening.CohortProjectionLineageReceipt",
    ))
    projection_column = next(
        row for row in listening_actions["columns"]
        if row["name"] == "cohort_projection_public_id"
    )
    projection_column["referenceContract"].update({
        "mode": "OPAQUE_CROSS_BOUNDARY_REFERENCE",
        "ownerStream": "platform-hris-insights",
        "versionColumn": "cohort_projection_revision",
        "asOfColumn": "cohort_projection_as_of",
        "ownerRefetch": (
            "exact signed privacy-safe projection owner port; tenant+purpose+version+asOf; "
            "fail closed on unavailable/stale/unauthorized"
        ),
    })
    listening_actions["foreignKeys"] = [
        row for row in listening_actions.get("foreignKeys", [])
        if row.get("target") != "sys_hris_listening_cohort_projections"
        and row.get("targetTable") != "sys_hris_listening_cohort_projections"
    ]
    listening_actions.setdefault("crossBoundaryReferences", []).append({
        "mode": "OPAQUE_CROSS_BOUNDARY_REFERENCE",
        "columns": [
            "tenant_id", "cohort_projection_public_id",
            "cohort_projection_revision", "cohort_projection_as_of",
            "cohort_projection_lineage_receipt_public_id",
        ],
        "ownerStream": "platform-hris-insights",
        "ownerEntityType": "DWP.Listening.CohortProjectionVersion",
        "ownerPort": "insights.refetchCohortProjectionVersion",
        "pep": "tenant+purpose+fieldPolicy+privacy threshold; fail closed",
        "physicalForeignKeyForbidden": True,
    })

    # Protected submission never stores Configuration's BIGINT survey key.
    # The signed admission-install port materializes an opaque survey public
    # identity+revision and all response DML remains protected-owner local.
    admissions = result["sys_hris_listening_admission_versions"]
    admissions["columns"] = [
        value for value in admissions.get("columns", [])
        if value["name"] not in {
            "parent_public_id", "token_policy_version_id", "cipher_key_version_id",
        }
    ]
    for value in (
        column("admission_public_id", "UUID", reference="DWP.Listening.ProtectedAdmission"),
        column("predecessor_version_public_id", "UUID", nullable=True,
               reference="table:sys_hris_listening_admission_versions"),
        column("predecessor_owner_revision", "BIGINT", default="0"),
        column("survey_public_id", "UUID", reference="DWP.Listening.SurveyPublicIdentity"),
        column("survey_revision", "BIGINT"),
        column("form_version_public_id", "UUID", reference="DWP.Listening.FormVersion"),
        column("form_artifact_schema_version", "VARCHAR(80)"),
        column("form_artifact_digest", "CHAR(64)"),
        column("question_definitions", "JSONB"),
        column("privacy_version_public_id", "UUID", reference="DWP.Listening.PrivacyPolicyVersion"),
        column("retention_version_public_id", "UUID", reference="DWP.Listening.RetentionPolicyVersion"),
        column("token_policy_version_public_id", "UUID", reference="DWP.Listening.TokenPolicyVersion"),
        column("consent_policy_version_public_id", "UUID", reference="DWP.Consent.PolicyVersion"),
        column("anonymity_threshold", "INTEGER"),
        column("epsilon_micros", "BIGINT"),
        column("privacy_budget_cap_epsilon_micros", "BIGINT"),
        column("measure_schema_version", "VARCHAR(80)"),
        column("measure_definition_digest", "CHAR(64)"),
        column("form_revision", "BIGINT"),
        column("privacy_revision", "BIGINT"),
        column("retention_revision", "BIGINT"),
        column("content_sha256", "CHAR(64)"),
        column("opens_at", "TIMESTAMPTZ"),
        column("closes_at", "TIMESTAMPTZ"),
        column("erase_after", "TIMESTAMPTZ"),
        column("protected_kek_policy_version_id", "UUID", reference="DWP.Listening.ProtectedKekPolicyVersion"),
    ):
        _append_column(admissions, value)
    admissions["uniqueKeys"] = [
        value for value in admissions.get("uniqueKeys", [])
        if value.get("columns") not in (
            ["tenant_id", "admission_public_id", "owner_revision"],
            ["tenant_id", "admission_public_id", "public_id", "owner_revision"],
        )
    ]
    admissions["uniqueKeys"].extend([
        {
            "constraintId": "uk_sys_hris_listening_admission_versions_stable_revision_v4",
            "columns": ["tenant_id", "admission_public_id", "owner_revision"],
        },
        {
            "constraintId": "uk_sys_hris_listening_admission_versions_predecessor_target_v4",
            "columns": [
                "tenant_id", "admission_public_id", "public_id", "owner_revision",
            ],
        },
    ])
    admissions["foreignKeys"] = [
        value for value in admissions.get("foreignKeys", [])
        if value.get("constraintId")
        != "fk_sys_hris_listening_admission_versions_predecessor_v4"
    ]
    admissions["foreignKeys"].append({
        "mode": "LOCAL_COMPOSITE_FK",
        "columns": [
            "tenant_id", "admission_public_id",
            "predecessor_version_public_id", "predecessor_owner_revision",
        ],
        "target": "sys_hris_listening_admission_versions",
        "targetColumns": [
            "tenant_id", "admission_public_id", "public_id", "owner_revision",
        ],
        "constraintId": "fk_sys_hris_listening_admission_versions_predecessor_v4",
    })
    admissions.setdefault("checks", []).extend([
        {
            "constraintId": "ck_sys_hris_listening_admission_versions_chain_v4",
            "expression": (
                "((owner_revision=1 AND predecessor_version_public_id IS NULL "
                "AND predecessor_owner_revision=0) OR (owner_revision>1 "
                "AND predecessor_version_public_id IS NOT NULL "
                "AND predecessor_owner_revision=owner_revision-1))"
            ),
            "columns": [
                "owner_revision", "predecessor_version_public_id",
                "predecessor_owner_revision",
            ],
            "nullSemantics": "REVISION_ONE_HAS_NO_PREDECESSOR;LATER_REVISIONS_REQUIRE_EXACT_SAME_ADMISSION_PREDECESSOR",
        },
        {
            "constraintId": "ck_sys_hris_listening_admission_versions_state_v4",
            "expression": "state IN ('ACTIVE','CLOSED')",
            "columns": ["state"],
        },
        {
            "constraintId": "ck_sys_hris_listening_admission_versions_privacy_budget_v4",
            "expression": (
                "anonymity_threshold>=5 AND epsilon_micros>0 "
                "AND privacy_budget_cap_epsilon_micros>=epsilon_micros"
            ),
            "columns": [
                "anonymity_threshold", "epsilon_micros",
                "privacy_budget_cap_epsilon_micros",
            ],
        },
    ])
    admissions["immutability"] = "APPEND_ONLY_STABLE_ADMISSION_PREDECESSOR_CHAIN"
    admissions["admissionResolution"] = {
        "stableIdentityColumn": "admission_public_id",
        "versionIdentityColumn": "public_id",
        "winner": "MAX(owner_revision) FOR tenant_id+admission_public_id",
        "submitFence": "LOCK_LATEST_VERSION_REQUIRE_ACTIVE_AND_EXACT_SIGNED_OWNER_REVISION",
        "closeRace": "SUBMIT_AND_CLOSE_SERIALIZE_ON_SAME_STABLE_ADMISSION_TIP",
        "historicalFallback": "FORBIDDEN",
    }
    admissions["signedIngressContract"] = {
        "messageName": "ListeningAdmissionInstallRequested.v1",
        "sourceStream": "platform-hris-configuration",
        "targetStream": "platform-hris-listening-protected",
        "identity": "tenantPublicId+surveyPublicId+admissionPublicId+owner revision",
        "versionAndAsOf": "form/privacy/retention revisions+opensAt+closesAt",
        "failure": "INVALID_SIGNATURE_OR_STALE_VERSION_ZERO_MUTATION",
    }
    responses = result["sys_hris_listening_responses"]
    responses["columns"] = [
        row for row in responses.get("columns", [])
        if row["name"] != "listening_survey_id"
    ]
    _append_column(responses, column(
        "survey_public_id", "UUID", reference="DWP.Listening.SurveyPublicIdentity",
    ))
    _append_column(responses, column("survey_revision", "BIGINT"))
    for value in (
        column("response_key_public_id", "UUID", reference="DWP.Listening.ProtectedResponseKey"),
        column("response_key_version", "BIGINT"),
        column("form_version_public_id", "UUID", reference="DWP.Listening.FormVersion"),
        column("form_artifact_digest", "CHAR(64)"),
        column("consent_policy_version_public_id", "UUID", reference="DWP.Consent.PolicyVersion"),
        _protected_commitment_column("consent_evidence_digest"),
    ):
        _append_column(responses, value)
    responses["foreignKeys"] = [
        row for row in responses.get("foreignKeys", [])
        if row.get("target") != "sys_hris_listening_surveys"
        and row.get("targetTable") != "sys_hris_listening_surveys"
    ]
    responses["indexes"] = [
        row for row in responses.get("indexes", [])
        if "listening_survey_id" not in row.get("columns", [])
    ]

    protected_receipts = result["sys_hris_listening_protected_receipts"]
    for value in protected_receipts.get("columns", []):
        if value["name"] == "listening_response_id":
            value["nullable"] = True
    for value in (
        column("receipt_kind", "VARCHAR(80)", nullable=True),
        column("admission_public_id", "UUID", nullable=True,
               reference="DWP.Listening.ProtectedAdmission"),
        _protected_commitment_column("token_commitment", nullable=True),
        column("request_digest", "CHAR(64)", nullable=True),
        column("response_public_id", "UUID", nullable=True, reference="table:sys_hris_listening_responses"),
        column("erasure_ticket_public_id", "UUID", nullable=True, reference="table:sys_hris_listening_erasure_tickets"),
        column("tombstone_digest", "CHAR(64)", nullable=True),
    ):
        _append_column(protected_receipts, value)
    answer_values = result["sys_hris_listening_answer_values"]
    for value in (
        column("question_key", "VARCHAR(160)"), column("answer_type", "VARCHAR(40)"),
        column("encrypted_answer", "BYTEA"),
        column("response_key_public_id", "UUID", reference="DWP.Listening.ProtectedResponseKey"),
        column("response_key_version", "BIGINT"),
    ):
        _append_column(answer_values, value)
    answer_values["columns"] = [
        value for value in answer_values["columns"]
        if value["name"] != "cipher_key_version_id"
    ]
    token_consumptions = result["sys_hris_listening_token_consumptions"]
    for value in (
        _protected_commitment_column("token_commitment"),
        _protected_commitment_column("credential_jti_commitment"),
        column("credential_digest", "CHAR(64)"),
        column("non_revocation_proof_digest", "CHAR(64)"),
        column("request_digest", "CHAR(64)"),
        column("response_public_id", "UUID", nullable=True, reference="table:sys_hris_listening_responses"),
        column("receipt_public_id", "UUID", nullable=True, reference="table:sys_hris_listening_protected_receipts"),
        column("consumed_at", "TIMESTAMPTZ", nullable=True),
        column("erasure_ticket_public_id", "UUID", nullable=True, reference="table:sys_hris_listening_erasure_tickets"),
        column("tombstone_digest", "CHAR(64)", nullable=True),
        column("erased_at", "TIMESTAMPTZ", nullable=True),
    ):
        _append_column(token_consumptions, value)
    token_consumptions.setdefault("checks", []).append({
        "constraintId": "ck_sys_hris_listening_token_consumptions_erasure_v4",
        "expression": (
            "((state='CONSUMED' AND consumed_at IS NOT NULL AND tombstone_digest IS NULL "
            "AND erased_at IS NULL) OR (state='ERASED' AND consumed_at IS NOT NULL "
            "AND erasure_ticket_public_id IS NOT NULL AND tombstone_digest IS NOT NULL "
            "AND erased_at IS NOT NULL))"
        ),
        "columns": ["state", "consumed_at", "erasure_ticket_public_id", "tombstone_digest", "erased_at"],
        "nullSemantics": "CONSUMED_HAS_REPLAY_DIGEST;ERASED_HAS_NONLINKABLE_TOMBSTONE_AND_NO_PAYLOAD_COMPARISON_ORACLE",
    })
    token_consumptions.setdefault("uniqueKeys", []).append({
        "constraintId": "uk_sys_hris_listening_token_consumptions_admission_token_v4",
        "columns": ["tenant_id", "listening_admission_version_id", "token_commitment"],
    })
    protected_receipts.setdefault("uniqueKeys", []).append({
        "constraintId": "uk_sys_hris_listening_protected_receipts_kind_idempotency_v4",
        "columns": [
            "tenant_id", "admission_public_id", "receipt_kind", "idempotency_key",
        ],
        "predicate": (
            "receipt_kind IS NOT NULL AND admission_public_id IS NOT NULL "
            "AND idempotency_key IS NOT NULL"
        ),
    })
    answer_values.setdefault("uniqueKeys", []).append({
        "constraintId": "uk_sys_hris_listening_answer_values_response_question_v4",
        "columns": ["tenant_id", "listening_response_id", "question_key"],
    })
    erasure_tickets = result["sys_hris_listening_erasure_tickets"]
    for value in (
        column("retention_policy_public_id", "UUID",
               reference="DWP.Listening.RetentionPolicyVersion"),
        column("retention_policy_revision", "BIGINT"),
        column("due_at", "TIMESTAMPTZ"),
        column("idempotency_key", "VARCHAR(240)"),
        column("request_digest", "CHAR(64)"),
        column("authority_type", "VARCHAR(80)"),
        column("authority_evidence_digest", "CHAR(64)"),
        column("authority_receipt_public_id", "UUID", nullable=True,
               reference="DWP.Privacy.ErasureAuthorityReceipt"),
        column("authority_receipt_revision", "BIGINT", nullable=True),
        column("attempt_no", "INTEGER", default="0"),
        column("response_key_public_id", "UUID", reference="DWP.Listening.ProtectedResponseKey"),
        column("response_key_version", "BIGINT"),
        column("token_consumption_public_id", "UUID", reference="table:sys_hris_listening_token_consumptions"),
        column("claim_lease_public_id", "UUID", nullable=True,
               reference="DWP.Listening.ErasureLease"),
        column("claim_lease_expires_at", "TIMESTAMPTZ", nullable=True),
        column("outcome", "VARCHAR(40)", nullable=True),
        column("failure_code", "VARCHAR(160)", nullable=True),
        column("erased_at", "TIMESTAMPTZ", nullable=True),
        column("tombstone_digest", "CHAR(64)", nullable=True),
        column("completed_at", "TIMESTAMPTZ", nullable=True),
    ):
        _append_column(erasure_tickets, value)
    erasure_tickets.setdefault("checks", []).extend([
        {
            "constraintId": "ck_sys_hris_listening_erasure_tickets_state_v3",
            "expression": "state IN ('REQUESTED','CLAIMED','COMPLETED','FAILED_RETRYABLE')",
            "columns": ["state"],
        },
        {
            "constraintId": "ck_sys_hris_listening_erasure_tickets_terminal_tombstone_v3",
            "expression": (
                "((state IN ('REQUESTED','CLAIMED','FAILED_RETRYABLE') AND erased_at IS NULL "
                "AND tombstone_digest IS NULL AND completed_at IS NULL) OR "
                "(state='COMPLETED' AND outcome='CRYPTO_SHREDDED' AND erased_at IS NOT NULL "
                "AND tombstone_digest IS NOT NULL AND completed_at IS NOT NULL))"
            ),
            "columns": ["state", "outcome", "erased_at", "tombstone_digest", "completed_at"],
            "nullSemantics": "TERMINAL_PROOF_REQUIRED_ONLY_AFTER_SUCCESSFUL_OWNER_LOCAL_CRYPTO_SHRED",
        },
    ])
    erasure_tickets.setdefault("checks", []).append({
        "constraintId": "ck_sys_hris_listening_erasure_tickets_claim_lease_v4",
        "expression": (
            "((state IN ('REQUESTED','FAILED_RETRYABLE') AND claim_lease_public_id IS NULL "
            "AND claim_lease_expires_at IS NULL) OR (state='CLAIMED' AND claim_lease_public_id IS NOT NULL "
            "AND claim_lease_expires_at IS NOT NULL) OR state='COMPLETED')"
        ),
        "columns": ["state", "claim_lease_public_id", "claim_lease_expires_at"],
        "nullSemantics": "LEASE_REQUIRED_ONLY_WHILE_CLAIMED;FAILED_RELEASES_LEASE_FOR_RETRY",
    })
    erasure_tickets.setdefault("checks", []).append({
        "constraintId": "ck_sys_hris_listening_erasure_tickets_authority_v4",
        "expression": (
            "authority_evidence_digest IS NOT NULL AND "
            "((authority_type='RETENTION_SCHEDULER' AND authority_receipt_public_id IS NULL "
            "AND authority_receipt_revision IS NULL) OR "
            "(authority_type='SIGNED_PRIVACY_WORKFLOW' AND authority_receipt_public_id IS NOT NULL "
            "AND authority_receipt_revision>0))"
        ),
        "columns": [
            "authority_type", "authority_evidence_digest",
            "authority_receipt_public_id", "authority_receipt_revision",
        ],
        "nullSemantics": (
            "EXACTLY_ONE_CLOSED_AUTHORITY_VARIANT_AND_DURABLE_NONREVERSIBLE_PROOF_DIGEST"
        ),
    })
    erasure_tickets.setdefault("uniqueKeys", []).append({
        "constraintId": "uk_sys_hris_listening_erasure_tickets_response_idempotency_v4",
        "columns": ["tenant_id", "listening_response_id", "idempotency_key"],
    })

    # Each inbox stores only the closed union of messages addressed to that
    # owner.  A broad cross-stream union would retain fields the owner must
    # never receive and would defeat the four-stream privacy boundary.
    message_member_columns = (
        column("tenant_public_id", "UUID", nullable=True, reference="DWP.Tenant"),
        column("survey_public_id", "UUID", nullable=True, reference="DWP.Listening.SurveyPublicIdentity"),
        column("admission_public_id", "UUID", nullable=True, reference="DWP.Listening.ProtectedAdmission"),
        column("admission_version_public_id", "UUID", nullable=True,
               reference="DWP.Listening.ProtectedAdmissionVersion"),
        column("receipt_public_id", "UUID", nullable=True, reference="DWP.Listening.OwnerPortReceipt"),
        column("cohort_package_public_id", "UUID", nullable=True, reference="DWP.Listening.CohortPackage"),
        column("projection_public_id", "UUID", nullable=True, reference="DWP.Listening.CohortProjectionVersion"),
        column("form_revision", "BIGINT", nullable=True),
        column("form_version_public_id", "UUID", nullable=True, reference="DWP.Listening.FormVersion"),
        column("form_artifact_schema_version", "VARCHAR(80)", nullable=True),
        column("form_artifact_digest", "CHAR(64)", nullable=True),
        column("question_definitions", "JSONB", nullable=True),
        column("privacy_version_public_id", "UUID", nullable=True, reference="DWP.Listening.PrivacyPolicyVersion"),
        column("retention_version_public_id", "UUID", nullable=True, reference="DWP.Listening.RetentionPolicyVersion"),
        column("token_policy_version_public_id", "UUID", nullable=True, reference="DWP.Listening.TokenPolicyVersion"),
        column("consent_policy_version_public_id", "UUID", nullable=True, reference="DWP.Consent.PolicyVersion"),
        column("privacy_revision", "BIGINT", nullable=True),
        column("retention_revision", "BIGINT", nullable=True),
        column("expected_owner_version", "BIGINT", nullable=True),
        column("owner_version", "BIGINT", nullable=True),
        column("policy_revision", "BIGINT", nullable=True),
        column("projection_version", "BIGINT", nullable=True),
        column("survey_revision", "BIGINT", nullable=True),
        column("content_sha256", "CHAR(64)", nullable=True),
        column("package_sha256", "CHAR(64)", nullable=True),
        column("opens_at", "TIMESTAMPTZ", nullable=True),
        column("closes_at", "TIMESTAMPTZ", nullable=True),
        column("occurred_at", "TIMESTAMPTZ", nullable=True),
        column("closed_at", "TIMESTAMPTZ", nullable=True),
        column("cutoff_at", "TIMESTAMPTZ", nullable=True),
        column("source_epoch", "TIMESTAMPTZ", nullable=True),
        column("erase_after", "TIMESTAMPTZ", nullable=True),
        column("idempotency_key", "VARCHAR(240)", nullable=True),
        column("message_name", "VARCHAR(200)", nullable=True),
        column("message_id", "UUID", nullable=True, reference="DWP.Listening.OwnerPortMessage"),
        column("request_message_id", "UUID", nullable=True, reference="DWP.Listening.OwnerPortMessage"),
        column("source_stream_key", "VARCHAR(160)", nullable=True),
        column("signing_key_id", "VARCHAR(240)", nullable=True),
        column("signature_algorithm", f"VARCHAR({LISTENING_SIGNATURE_ALGORITHM_MAX_BYTES})", nullable=True,
               max_bytes=LISTENING_SIGNATURE_ALGORITHM_MAX_BYTES,
               allowed_algorithms=LISTENING_SIGNATURE_ALGORITHMS),
        column("owner_signature", "VARCHAR(86)", nullable=True,
               serialization=LISTENING_SIGNATURE_SERIALIZATION,
               max_bytes=LISTENING_SIGNATURE_MAX_BYTES,
               allowed_algorithms=LISTENING_SIGNATURE_ALGORITHMS),
        column("message_status", "VARCHAR(80)", nullable=True),
        column("completed_at", "TIMESTAMPTZ", nullable=True),
        column("measure_schema_version", "VARCHAR(80)", nullable=True),
        column("measure_definition_digest", "CHAR(64)", nullable=True),
        column("epsilon_micros", "BIGINT", nullable=True),
        column("privacy_budget_cap_epsilon_micros", "BIGINT", nullable=True),
        column("adequacy_category", "VARCHAR(80)", nullable=True),
        column("measure_values", "JSONB", nullable=True),
        column("subject_count", "INTEGER", nullable=True),
        column("anonymity_threshold", "INTEGER", nullable=True),
        column("privacy_budget_receipt_public_id", "UUID", nullable=True, reference="DWP.Listening.PrivacyBudgetReceipt"),
    )
    envelope_members = {
        "tenant_public_id", "message_name", "message_id", "source_stream_key",
        "signing_key_id", "signature_algorithm", "owner_signature", "completed_at",
    }
    message_members_by_table = {
        "sys_hris_listening_operation_receipts": envelope_members | {
            "survey_public_id", "admission_public_id", "admission_version_public_id",
            "receipt_public_id", "owner_version", "request_message_id",
            "message_status", "occurred_at", "closed_at", "idempotency_key",
        },
        "sys_hris_listening_protected_receipts": envelope_members | {
            "survey_public_id", "survey_revision", "admission_public_id",
            "cohort_package_public_id", "projection_public_id", "projection_version",
            "receipt_public_id", "request_message_id", "message_status",
            "form_revision", "form_version_public_id", "form_artifact_schema_version",
            "form_artifact_digest", "question_definitions", "privacy_version_public_id",
            "privacy_revision", "retention_version_public_id", "retention_revision",
            "token_policy_version_public_id", "consent_policy_version_public_id",
            "expected_owner_version", "content_sha256", "opens_at", "closes_at",
            "erase_after", "idempotency_key", "anonymity_threshold",
            "epsilon_micros", "measure_schema_version", "measure_definition_digest",
            "privacy_budget_cap_epsilon_micros",
        },
        "sys_hris_listening_insights_inbox": envelope_members | {
            "survey_public_id", "cohort_package_public_id", "policy_revision",
            "source_epoch", "cutoff_at", "measure_schema_version", "measure_values",
            "measure_definition_digest",
            "package_sha256", "adequacy_category", "subject_count",
            "anonymity_threshold", "privacy_budget_receipt_public_id",
        },
    }
    all_message_members = {value["name"] for value in message_member_columns}
    member_definition = {value["name"]: value for value in message_member_columns}
    for table_name, allowed_members in message_members_by_table.items():
        table = result[table_name]
        table["columns"] = [
            value for value in table.get("columns", [])
            if value["name"] not in all_message_members or value["name"] in allowed_members
        ]
        for member_name in sorted(allowed_members):
            _append_column(table, copy.deepcopy(member_definition[member_name]))
        table["messagePayloadColumnAllowlist"] = sorted(allowed_members)
        table.setdefault("uniqueKeys", []).append({
            "constraintId": "uk_" + table_name + "_message_claim_v3",
            "columns": ["tenant_id", "message_name", "message_id"],
        })
        table["sealedMessageClaim"] = {
            "claimKey": "tenant_id+handler_id/message_name+message_id",
            "sameDigest": "RETURN_SEALED_FIRST_ACK_ZERO_WRITES",
            "differentDigest": "CONFLICT_ZERO_DOMAIN_ACK_OUTBOX_MUTATION",
            "signature": "source_stream_key active owner signing key",
        }
        table.setdefault("checks", []).append({
            "constraintId": "ck_" + table_name + "_message_envelope_all_or_none_v3",
            "columns": [
                "message_name", "message_id", "source_stream_key", "signing_key_id",
                "signature_algorithm", "owner_signature",
            ],
            "expression": (
                "((message_name IS NULL AND message_id IS NULL AND source_stream_key IS NULL "
                "AND signing_key_id IS NULL AND signature_algorithm IS NULL AND owner_signature IS NULL) OR "
                "(message_name IS NOT NULL AND message_id IS NOT NULL AND source_stream_key IS NOT NULL "
                "AND signing_key_id IS NOT NULL AND signature_algorithm IN ('ED25519','ECDSA_P256_SHA256') "
                "AND owner_signature IS NOT NULL))"
            ),
            "nullSemantics": "PUBLIC_COMMAND_RECEIPT_HAS_NO_MESSAGE_ENVELOPE;SIGNED_MESSAGE_CLAIM_REQUIRES_COMPLETE_ENVELOPE",
        })
    for value in (
        column("operation_id", "VARCHAR(240)", nullable=True),
        column("authorization_revision", "BIGINT", nullable=True),
        column("purpose_code", "VARCHAR(240)", nullable=True),
        column("population_scope_digest", "CHAR(64)", nullable=True),
        column("field_policy_revision", "BIGINT", nullable=True),
        column("lifecycle_state", "VARCHAR(40)", nullable=True),
        column("request_digest", "CHAR(64)", nullable=True),
        column("result_json", "JSONB", nullable=True),
        column("result_digest", "CHAR(64)", nullable=True),
        column("post_identity_json", "JSONB", nullable=True),
        column("completed_at", "TIMESTAMPTZ", nullable=True),
    ):
        _append_column(result["sys_hris_listening_operation_receipts"], value)
    result["sys_hris_listening_operation_receipts"].setdefault(
        "uniqueKeys", []
    ).append({
        "constraintId": "uk_sys_hris_listening_operation_receipts_command_claim_v4",
        "columns": ["tenant_id", "created_by", "operation_id", "idempotency_key"],
        "predicate": "operation_id IS NOT NULL AND idempotency_key IS NOT NULL",
    })
    _append_column(
        result["sys_hris_listening_protected_receipts"],
        column("completed_at", "TIMESTAMPTZ", nullable=True),
    )
    _append_column(
        result["sys_hris_listening_protected_receipts"],
        column("result_digest", "CHAR(64)", nullable=True),
    )
    for table_name, values in {
        "sys_hris_listening_cohort_projections": (
            column("survey_public_id", "UUID", reference="DWP.Listening.SurveyPublicIdentity"),
            column("cohort_package_public_id", "UUID", reference="DWP.Listening.CohortPackage"),
            column("policy_revision", "BIGINT"),
            column("source_epoch", "TIMESTAMPTZ"),
            column("cutoff_at", "TIMESTAMPTZ"),
            column("measure_schema_version", "VARCHAR(80)"),
            column("measure_definition_digest", "CHAR(64)"),
            column("package_sha256", "CHAR(64)"),
            column("adequacy_category", "VARCHAR(80)"),
            column("measure_values", "JSONB", nullable=True),
            column("subject_count", "INTEGER", nullable=True),
            column("anonymity_threshold", "INTEGER"),
            column("privacy_budget_receipt_public_id", "UUID", reference="DWP.Listening.PrivacyBudgetReceipt"),
        ),
        "sys_hris_listening_lineage_receipts": (
            column("survey_public_id", "UUID", reference="DWP.Listening.SurveyPublicIdentity"),
            column("cohort_package_public_id", "UUID", reference="DWP.Listening.CohortPackage"),
            column("policy_revision", "BIGINT"),
            column("source_epoch", "TIMESTAMPTZ"),
            column("cutoff_at", "TIMESTAMPTZ"),
            column("package_sha256", "CHAR(64)"),
            column("measure_schema_version", "VARCHAR(80)"),
            column("measure_definition_digest", "CHAR(64)"),
            column("adequacy_category", "VARCHAR(80)"),
            column("measure_values", "JSONB", nullable=True),
            column("subject_count", "INTEGER", nullable=True),
            column("anonymity_threshold", "INTEGER"),
            column("privacy_budget_receipt_public_id", "UUID", reference="DWP.Listening.PrivacyBudgetReceipt"),
        ),
        "sys_hris_listening_cohort_packages": (
            column("projection_public_id", "UUID", nullable=True, reference="DWP.Listening.CohortProjectionVersion"),
            column("projection_version", "BIGINT", nullable=True),
            column("receipt_public_id", "UUID", nullable=True, reference="DWP.Listening.OwnerPortReceipt"),
            column("survey_public_id", "UUID", reference="DWP.Listening.SurveyPublicIdentity"),
            column("admission_public_id", "UUID", reference="DWP.Listening.ProtectedAdmission"),
            column("policy_revision", "BIGINT"), column("source_epoch", "TIMESTAMPTZ"),
            column("cutoff_at", "TIMESTAMPTZ"), column("measure_schema_version", "VARCHAR(80)"),
            column("measure_definition_digest", "CHAR(64)"),
            column("measure_values", "JSONB", nullable=True), column("subject_count", "INTEGER"),
            column("anonymity_threshold", "INTEGER"),
            column("privacy_budget_receipt_public_id", "UUID", reference="DWP.Listening.PrivacyBudgetReceipt"),
            column("package_sha256", "CHAR(64)"), column("adequacy_category", "VARCHAR(80)"),
        ),
        "sys_hris_listening_cohort_budgets": (
            column("survey_public_id", "UUID", reference="DWP.Listening.SurveyPublicIdentity"),
            column("admission_public_id", "UUID", reference="DWP.Listening.ProtectedAdmission"),
            column("policy_revision", "BIGINT"), column("source_epoch", "TIMESTAMPTZ"),
            column("cutoff_at", "TIMESTAMPTZ"), column("measure_schema_version", "VARCHAR(80)"),
            column("measure_definition_digest", "CHAR(64)"),
            column("anonymity_threshold", "INTEGER"), column("epsilon_micros", "BIGINT"),
            column("budget_receipt_public_id", "UUID", reference="DWP.Listening.PrivacyBudgetReceipt"),
            column("release_sequence", "BIGINT"),
            column("cumulative_epsilon_micros", "BIGINT"),
            column("noise_seed_digest", "CHAR(64)"),
            column("idempotency_key", "VARCHAR(240)"), column("request_digest", "CHAR(64)"),
        ),
    }.items():
        for value in values:
            _append_column(result[table_name], value)
    cohort_budget = result["sys_hris_listening_cohort_budgets"]
    cohort_budget.setdefault("uniqueKeys", []).append({
        "constraintId": "uk_sys_hris_listening_cohort_budgets_build_scope_v4",
        "columns": [
            "tenant_id", "listening_admission_version_id", "policy_revision", "source_epoch",
            "cutoff_at", "measure_schema_version", "measure_definition_digest",
        ],
        "exception": "PROTECTED_PRIVACY_RELEASE_SCOPE",
    })
    cohort_budget.setdefault("uniqueKeys", []).append({
        "constraintId": "uk_sys_hris_listening_cohort_budgets_release_sequence_v4",
        "columns": ["tenant_id", "listening_admission_version_id", "release_sequence"],
    })
    cohort_budget.setdefault("checks", []).append({
        "constraintId": "ck_sys_hris_listening_cohort_budgets_privacy_v4",
        "expression": (
            "anonymity_threshold>=5 AND epsilon_micros>0 AND release_sequence>0 "
            "AND cumulative_epsilon_micros>=epsilon_micros"
        ),
        "columns": [
            "anonymity_threshold", "epsilon_micros", "release_sequence",
            "cumulative_epsilon_micros", "noise_seed_digest",
        ],
    })
    cohort_package = result["sys_hris_listening_cohort_packages"]
    cohort_package.setdefault("uniqueKeys", []).append({
        "constraintId": "uk_sys_hris_listening_cohort_packages_budget_v4",
        "columns": ["tenant_id", "listening_cohort_budget_id"],
    })
    cohort_package.setdefault("checks", []).append({
        "constraintId": "ck_sys_hris_listening_cohort_packages_adequacy_v4",
        "expression": (
            "subject_count>=0 AND anonymity_threshold>=5 AND ((state='READY' AND "
            "adequacy_category='ADEQUATE' AND subject_count>=anonymity_threshold AND "
            "measure_values IS NOT NULL) OR (state='SUPPRESSED' AND "
            "adequacy_category='SUPPRESSED' AND subject_count<anonymity_threshold AND "
            "(measure_values IS NULL OR measure_values='[]'::jsonb)))"
        ),
        "columns": [
            "state", "adequacy_category", "subject_count", "anonymity_threshold", "measure_values",
        ],
        "nullSemantics": "SUPPRESSED_NEVER_STORES_SMALL_CELL_VALUES;READY_REQUIRES_TYPED_MEASURES",
    })
    cohort_projection = result["sys_hris_listening_cohort_projections"]
    cohort_projection.setdefault("uniqueKeys", []).append({
        "constraintId": "uk_sys_hris_listening_cohort_projections_package_v4",
        "columns": ["tenant_id", "cohort_package_public_id"],
    })
    cohort_projection.setdefault("checks", []).append({
        "constraintId": "ck_sys_hris_listening_cohort_projections_adequacy_v4",
        "expression": (
            "anonymity_threshold>=5 AND ((adequacy_category='ADEQUATE' "
            "AND subject_count IS NOT NULL AND subject_count>=anonymity_threshold "
            "AND measure_values IS NOT NULL) OR (adequacy_category='SUPPRESSED' "
            "AND subject_count IS NULL AND (measure_values IS NULL OR measure_values='[]'::jsonb)))"
        ),
        "columns": ["adequacy_category", "subject_count", "anonymity_threshold", "measure_values"],
        "nullSemantics": "SUPPRESSED_OMITS_EXACT_SMALL_CELL_COUNT_AND_MEASURES;ADEQUATE_REQUIRES_COUNT_AT_LEAST_K",
    })
    lineage_receipt = result["sys_hris_listening_lineage_receipts"]
    lineage_receipt.setdefault("uniqueKeys", []).append({
        "constraintId": "uk_sys_hris_listening_lineage_receipts_projection_v4",
        "columns": ["tenant_id", "listening_cohort_projection_id"],
    })
    lineage_receipt.setdefault("checks", []).append({
        "constraintId": "ck_sys_hris_listening_lineage_receipts_adequacy_v4",
        "expression": (
            "anonymity_threshold>=5 AND ((adequacy_category='ADEQUATE' "
            "AND subject_count IS NOT NULL AND subject_count>=anonymity_threshold "
            "AND measure_values IS NOT NULL) OR (adequacy_category='SUPPRESSED' "
            "AND subject_count IS NULL AND (measure_values IS NULL OR measure_values='[]'::jsonb)))"
        ),
        "columns": ["adequacy_category", "subject_count", "anonymity_threshold", "measure_values"],
        "nullSemantics": (
            "SUPPRESSED_LINEAGE_OMITS_EXACT_SMALL_CELL_COUNT_AND_MEASURES;"
            "ADEQUATE_LINEAGE_REQUIRES_COUNT_AT_LEAST_K"
        ),
    })

    # The auth-owner issuer persists every claim used to mint, resolve and
    # revoke an anonymous participation credential.  Protected endpoints never
    # call this owner during submit and never persist the authenticated actor.
    for value in (
        column("subject_principal_public_id", "UUID", reference="DWP.Principal"),
        column("hris_entitlement_version_public_id", "UUID", reference="DWP.Authorization.EntitlementVersion"),
        column("persona_code", "VARCHAR(80)"), column("population_scope_digest", "CHAR(64)"),
        column("audience_snapshot_public_id", "UUID", reference="DWP.Population.ImmutableSnapshot"),
        column("survey_public_id", "UUID", reference="DWP.Listening.SurveyPublicIdentity"),
        column("survey_revision", "BIGINT"),
        column("admission_public_id", "UUID", reference="DWP.Listening.ProtectedAdmission"),
        column("admission_version_public_id", "UUID", reference="DWP.Listening.ProtectedAdmissionVersion"),
        column("admission_owner_version", "BIGINT"),
        column("form_version_public_id", "UUID", reference="DWP.Listening.FormVersion"),
        column("form_artifact_digest", "CHAR(64)"),
        column("privacy_version_public_id", "UUID", reference="DWP.Listening.PrivacyPolicyVersion"),
        column("retention_version_public_id", "UUID", reference="DWP.Listening.RetentionPolicyVersion"),
        column("token_policy_version_public_id", "UUID", reference="DWP.Listening.TokenPolicyVersion"),
        column("consent_policy_version_public_id", "UUID", reference="DWP.Consent.PolicyVersion"),
        column("consent_evidence_public_id", "UUID", reference="DWP.Consent.DecisionEvidence"),
        _protected_commitment_column(
            "consent_evidence_digest", sensitivity="RESTRICTED",
        ),
        column("valid_from", "TIMESTAMPTZ"), column("valid_to", "TIMESTAMPTZ"),
        column("idempotency_key", "VARCHAR(240)"), column("request_digest", "CHAR(64)"),
    ):
        _append_column(result["sys_hris_listening_eligibility_versions"], value)
    result["sys_hris_listening_eligibility_versions"].setdefault("uniqueKeys", []).append({
        "constraintId": "uk_sys_hris_listening_eligibility_versions_idempotency_v4",
        "columns": [
            "tenant_id", "subject_principal_public_id", "admission_public_id",
            "idempotency_key",
        ],
    })
    result["sys_hris_listening_eligibility_versions"].setdefault("checks", []).extend([
        {"constraintId": "ck_sys_hris_listening_eligibility_versions_window_v4",
         "expression": "valid_to>valid_from", "columns": ["valid_from", "valid_to"],
         "nullSemantics": "BOTH_REQUIRED_CLOSED_SHORT_LIVED_ELIGIBILITY_SNAPSHOT"},
        {"constraintId": "ck_sys_hris_listening_eligibility_versions_state_v4",
         "expression": "state IN ('ELIGIBLE','INELIGIBLE')", "columns": ["state"]},
    ])
    for value in (
        column("eligibility_version_public_id", "UUID", reference="table:sys_hris_listening_eligibility_versions"),
        _protected_commitment_column("opaque_jti_commitment"),
        _protected_commitment_column("token_commitment"),
        column("audience", "VARCHAR(240)"), column("issued_at", "TIMESTAMPTZ"),
        column("not_before", "TIMESTAMPTZ"), column("expires_at", "TIMESTAMPTZ"),
        column("signing_key_id", "VARCHAR(240)"),
        column("algorithm", f"VARCHAR({LISTENING_SIGNATURE_ALGORITHM_MAX_BYTES})",
               max_bytes=LISTENING_SIGNATURE_ALGORITHM_MAX_BYTES,
               allowed_algorithms=LISTENING_SIGNATURE_ALGORITHMS),
        column("credential_digest", "CHAR(64)"),
        column("credential_signature", "VARCHAR(86)",
               serialization=LISTENING_SIGNATURE_SERIALIZATION,
               max_bytes=LISTENING_SIGNATURE_MAX_BYTES,
               allowed_algorithms=LISTENING_SIGNATURE_ALGORITHMS),
        column("idempotency_key", "VARCHAR(240)"), column("request_digest", "CHAR(64)"),
    ):
        _append_column(result["sys_hris_listening_token_issuances"], value)
    result["sys_hris_listening_token_issuances"].setdefault("uniqueKeys", []).extend([
        {"constraintId": "uk_sys_hris_listening_token_issuances_jti_v4",
         "columns": ["tenant_id", "opaque_jti_commitment"]},
        {"constraintId": "uk_sys_hris_listening_token_issuances_token_v4",
         "columns": ["tenant_id", "token_commitment"]},
        {"constraintId": "uk_sys_hris_listening_token_issuances_idempotency_v4",
         "columns": ["tenant_id", "listening_eligibility_version_id", "idempotency_key"]},
    ])
    result["sys_hris_listening_token_issuances"].setdefault("checks", []).append({
        "constraintId": "ck_sys_hris_listening_token_issuances_window_v4",
        "expression": "issued_at<=not_before AND not_before<expires_at",
        "columns": ["issued_at", "not_before", "expires_at"],
    })
    result["sys_hris_listening_token_issuances"].setdefault("checks", []).append({
        "constraintId": "ck_sys_hris_listening_token_issuances_signature_v5",
        "expression": (
            "algorithm IN ('ED25519','ECDSA_P256_SHA256') "
            "AND credential_signature IS NOT NULL"
        ),
        "columns": ["algorithm", "credential_signature"],
        "nullSemantics": "ISSUANCE_CREDENTIAL_REQUIRES_ONE_CLOSED_ALGORITHM_AND_BOUNDED_SIGNATURE",
    })
    for value in (
        column("issuance_public_id", "UUID", reference="table:sys_hris_listening_token_issuances"),
        column("issuance_revision", "BIGINT"), column("reason_code", "VARCHAR(160)"),
        column("actor_mode", "VARCHAR(80)"),
        column("actor_public_id", "UUID", reference="DWP.Principal"),
        column("delegation_receipt_public_id", "UUID", nullable=True,
               reference="DWP.Authorization.DelegationReceipt"),
        column("revoked_at", "TIMESTAMPTZ"), column("idempotency_key", "VARCHAR(240)"),
        column("request_digest", "CHAR(64)"),
    ):
        _append_column(result["sys_hris_listening_token_revocations"], value)
    result["sys_hris_listening_token_revocations"].setdefault("uniqueKeys", []).extend([
        {"constraintId": "uk_sys_hris_listening_token_revocations_revision_v4",
         "columns": ["tenant_id", "listening_token_issuance_id", "owner_revision"]},
        {"constraintId": "uk_sys_hris_listening_token_revocations_idempotency_v4",
         "columns": ["tenant_id", "listening_token_issuance_id", "idempotency_key"]},
    ])
    for value in (
        column("receipt_kind", "VARCHAR(80)"), column("operation_name", "VARCHAR(160)"),
        column("idempotency_key", "VARCHAR(240)"), column("request_digest", "CHAR(64)"),
        column("result_digest", "CHAR(64)"),
        column("eligibility_version_public_id", "UUID", nullable=True,
               reference="table:sys_hris_listening_eligibility_versions"),
        column("issuance_public_id", "UUID", nullable=True,
               reference="table:sys_hris_listening_token_issuances"),
        column("revocation_public_id", "UUID", nullable=True,
               reference="table:sys_hris_listening_token_revocations"),
        column("completed_at", "TIMESTAMPTZ"),
    ):
        _append_column(result["sys_hris_listening_issuer_receipts"], value)
    result["sys_hris_listening_issuer_receipts"].setdefault("uniqueKeys", []).append({
        "constraintId": "uk_sys_hris_listening_issuer_receipts_idempotency_v4",
        "columns": ["tenant_id", "operation_name", "created_by", "idempotency_key"],
    })
    for value in (
        column("delivery_kind", "VARCHAR(80)"),
        column("message_id", "UUID", reference="DWP.Listening.PrivateDeliveryMessage"),
        column("payload", "JSONB"), column("delivered_at", "TIMESTAMPTZ", nullable=True),
    ):
        _append_column(result["sys_hris_listening_issuer_outbox"], value)
    result["sys_hris_listening_issuer_outbox"].setdefault("checks", []).append({
        "constraintId": "ck_sys_hris_listening_issuer_outbox_private_v4",
        "expression": "delivery_kind='OWNER_LOCAL_PRIVATE_BROKER_FORBIDDEN'",
        "columns": ["delivery_kind"],
    })
    result["sys_hris_listening_issuer_outbox"].setdefault("uniqueKeys", []).append({
        "constraintId": "uk_sys_hris_listening_issuer_outbox_message_v4",
        "columns": ["tenant_id", "message_id"],
    })
    for table_name in (
        "sys_hris_listening_domain_outbox",
        "sys_hris_listening_protected_outbox",
        "sys_hris_listening_insights_outbox",
    ):
        table = result[table_name]
        for value in (
            column("message_name", "VARCHAR(200)", nullable=True),
            column("message_id", "UUID", nullable=True, reference="DWP.Listening.OwnerPortMessage"),
            column("payload", "JSONB"),
            column("source_stream_key", "VARCHAR(160)", nullable=True),
            column("signing_key_id", "VARCHAR(240)", nullable=True),
            column("signature_algorithm", f"VARCHAR({LISTENING_SIGNATURE_ALGORITHM_MAX_BYTES})", nullable=True,
                   max_bytes=LISTENING_SIGNATURE_ALGORITHM_MAX_BYTES,
                   allowed_algorithms=LISTENING_SIGNATURE_ALGORITHMS),
            column("owner_signature", "VARCHAR(86)", nullable=True,
                   serialization=LISTENING_SIGNATURE_SERIALIZATION,
                   max_bytes=LISTENING_SIGNATURE_MAX_BYTES,
                   allowed_algorithms=LISTENING_SIGNATURE_ALGORITHMS),
            column("event_type", "VARCHAR(200)", nullable=True),
            column("occurred_at", "TIMESTAMPTZ", nullable=True),
        ):
            _append_column(table, value)
        table.setdefault("checks", []).append({
            "constraintId": "ck_" + table_name + "_closed_envelope_kind_v3",
            "columns": [
                "message_name", "message_id", "source_stream_key", "signing_key_id",
                "signature_algorithm", "owner_signature", "event_type", "occurred_at",
            ],
            "expression": (
                "((event_type IS NOT NULL AND occurred_at IS NOT NULL AND message_name IS NULL "
                "AND message_id IS NULL AND source_stream_key IS NULL AND signing_key_id IS NULL "
                "AND signature_algorithm IS NULL AND owner_signature IS NULL) OR "
                "(event_type IS NULL AND occurred_at IS NULL AND message_name IS NOT NULL "
                "AND message_id IS NOT NULL AND source_stream_key IS NOT NULL "
                "AND signing_key_id IS NOT NULL "
                "AND signature_algorithm IN ('ED25519','ECDSA_P256_SHA256') "
                "AND owner_signature IS NOT NULL))"
            ),
            "nullSemantics": "EXACTLY_ONE_OF_PUBLIC_DOMAIN_EVENT_OR_SIGNED_OWNER_PORT_MESSAGE",
        })
        table.setdefault("uniqueKeys", []).append({
            "constraintId": "uk_" + table_name + "_message_v4",
            "columns": ["tenant_id", "message_id"],
            "predicate": "message_id IS NOT NULL",
        })

    # UUID arrays are not relational identity.  Ordered typed child tables
    # above retain each reference, its ordinal and its owner/FK contract.
    array_replacements = {
        "prf_grw_coaching_notes": "evidence_refs",
        "prf_grw_profile_revisions": "evidence_refs",
        "prf_lrn_completion_evidence": "skill_evidence_ids",
        "sys_hris_analytics_export_receipts": "metric_projection_ids",
        "tme_wfm_schedule_candidates": "time_group_ids",
    }
    for table_name, old_column in array_replacements.items():
        table = result[table_name]
        table["columns"] = [row for row in table["columns"] if row["name"] != old_column]
        table["checks"] = [
            row for row in table.get("checks", [])
            if old_column not in row.get("columns", [])
        ]
        table["uniqueKeys"] = [
            row for row in table.get("uniqueKeys", [])
            if old_column not in row.get("columns", [])
        ]
        table["foreignKeys"] = [
            row for row in table.get("foreignKeys", [])
            if old_column not in row.get("columns", [])
        ]

    # Remove superseded proof FKs together with their retired columns and fix
    # the benefits local identity target to the exact target id column.
    result["ppl_wfp_publish_receipts"]["foreignKeys"] = [
        row for row in result["ppl_wfp_publish_receipts"].get("foreignKeys", [])
        if "approval_case_public_id" not in row.get("columns", [])
    ]
    result["prf_cmp_approved_snapshots"]["foreignKeys"] = [
        row for row in result["prf_cmp_approved_snapshots"].get("foreignKeys", [])
        if "approval_receipt_id" not in row.get("columns", [])
    ]
    for foreign in result["ppl_bnf_enrollments"].get("foreignKeys", []):
        if foreign.get("constraintId") == "fk_ppl_bnf_enrollments_life_event_id_v3":
            foreign["targetColumns"] = ["tenant_id", "benefit_life_event_id"]

    # The static Listening ownership design names semantic FK columns, while
    # several newly materialized tables use the generic record_id identity.
    # Materialize every source column and bind targetColumns to the actual
    # exact idColumn so no FK can point at an invented physical column.
    for table_name, table in result.items():
        if not table_name.startswith("sys_hris_listening_"):
            continue
        for foreign in table.get("foreignKeys", []):
            if foreign.get("mode") != "LOCAL_COMPOSITE_FK":
                continue
            target = result[foreign["target"]]
            source_columns = foreign.get("columns", [])
            for source_column in source_columns:
                if source_column == "tenant_id" or any(
                    value["name"] == source_column for value in table["columns"]
                ) or table["idColumn"]["name"] == source_column:
                    continue
                _append_column(table, column(
                    source_column, "BIGINT", reference="table:" + foreign["target"],
                ))
            if (
                len(foreign.get("targetColumns", [])) == 2
                and foreign["targetColumns"][1] != "public_id"
            ):
                foreign["targetColumns"] = ["tenant_id", target["idColumn"]["name"]]

    def add_check(table_name: str, constraint_id: str, expression: str,
                  columns: list[str]) -> None:
        table = result[table_name]
        table["checks"] = [
            row for row in table.get("checks", [])
            if row.get("constraintId") != constraint_id
        ]
        table["checks"].append({
            "constraintId": constraint_id, "expression": expression,
            "columns": columns,
            "nullSemantics": "OPEN_ENDED_END_ALLOWED;UNKNOWN_NEVER_USED_AS_VALIDITY",
        })

    interval_checks = (
        ("ppl_bnf_plan_versions", "effective", "effective_from", "effective_to", True),
        ("ppl_bnf_plan_versions", "valid", "valid_from", "valid_to", False),
        ("ppl_jny_template_versions", "effective", "effective_from", "effective_to", False),
        ("prf_grw_profiles", "valid", "valid_from", "valid_to", False),
        ("prf_skl_taxonomy_versions", "effective", "effective_from", "effective_to", False),
        ("sys_hris_ai_policy_versions", "effective", "effective_from", "effective_to", False),
        ("sys_hris_ai_use_policies", "valid", "valid_from", "valid_to", False),
        ("sys_hris_metric_versions", "effective", "effective_from", "effective_to", False),
        ("tme_wfm_schedule_candidates", "period", "period_start", "period_end", False),
    )
    for table_name, label, start, end, both_nullable in interval_checks:
        expression = (
            f"(({start} IS NULL AND {end} IS NULL) OR "
            f"({start} IS NOT NULL AND ({end} IS NULL OR {end} > {start})))"
            if both_nullable else f"{end} IS NULL OR {end} > {start}"
        )
        add_check(table_name, f"ck_{table_name}_{label}_interval_v3",
                  expression, [start, end])

    # Recurrence identity is explicit and temporal overlap is forbidden.  A
    # nullable start can no longer bypass either uniqueness or overlap rules.
    engagements = result["ppl_cwk_engagements"]
    next(row for row in engagements["columns"] if row["name"] == "effective_from")["nullable"] = False
    _append_column(engagements, column("engagement_occurrence_no", "BIGINT"))
    engagements["uniqueKeys"] = [
        row for row in engagements.get("uniqueKeys", [])
        if row.get("columns") != ["tenant_id", "worker_public_id", "effective_from"]
        and row.get("constraintId") != "uk_ppl_cwk_engagements_worker_occurrence_v3"
    ]
    engagements["uniqueKeys"].append({
        "constraintId": "uk_ppl_cwk_engagements_worker_occurrence_v3",
        "columns": ["tenant_id", "worker_public_id", "engagement_occurrence_no"],
    })
    add_check("ppl_cwk_engagements", "ck_ppl_cwk_engagements_occurrence_v3",
              "engagement_occurrence_no > 0", ["engagement_occurrence_no"])
    engagements["temporalExclusionConstraints"] = [{
        "constraintId": "ex_ppl_cwk_engagements_worker_period_v3",
        "partitionColumns": ["tenant_id", "worker_public_id"],
        "range": "daterange(effective_from,effective_to,'[)')",
        "operator": "&&", "rule": "NO_OVERLAP",
        "nullSemantics": "NULL_END_IS_OPEN_ENDED_INFINITY",
    }]
    sponsors = result["ppl_cwk_sponsor_assignments"]
    _append_column(sponsors, column("assignment_revision", "BIGINT"))
    sponsors["uniqueKeys"] = [{
        "constraintId": "uk_ppl_cwk_sponsor_assignments_revision_v3",
        "columns": ["tenant_id", "contingent_engagement_id", "assignment_revision"],
    }]
    add_check("ppl_cwk_sponsor_assignments", "ck_ppl_cwk_sponsor_assignments_revision_v3",
              "assignment_revision > 0", ["assignment_revision"])
    sponsors["temporalExclusionConstraints"] = [{
        "constraintId": "ex_ppl_cwk_sponsor_assignments_period_v3",
        "partitionColumns": ["tenant_id", "contingent_engagement_id"],
        "range": "daterange(valid_from,valid_to,'[)')", "operator": "&&",
        "rule": "NO_OVERLAP",
        "nullSemantics": "NULL_END_IS_OPEN_ENDED_INFINITY",
    }]

    # Select one WFM model for each previously duplicated concept.
    counter = result["tme_wfm_forecast_revision_counters"]
    counter["columns"] = [row for row in counter["columns"] if row["name"] != "current_revision"]
    counter["checks"] = [
        row for row in counter.get("checks", []) if "current_revision" not in row.get("columns", [])
    ]
    add_check("tme_wfm_forecast_revision_counters",
              "ck_tme_wfm_forecast_revision_counters_last_revision_v3",
              "last_revision > 0", ["last_revision"])
    fairness = result["tme_wfm_fairness_measure_values"]
    keep = {"constraint_evaluation_receipt_id", "measure_key", "measure_value",
            "accepted_bound", "result"}
    fairness["columns"] = [row for row in fairness["columns"] if row["name"] in keep]
    _append_column(fairness, column("ordinal", "INTEGER"))
    fairness["checks"] = [
        row for row in fairness.get("checks", [])
        if set(row.get("columns", [])) <= (keep | {"ordinal"})
        and not set(row.get("columns", [])) & {
            "line_sequence", "metric_code", "cohort_digest", "measured_value",
            "threshold_value", "outcome", "result_digest",
        }
    ]
    add_check("tme_wfm_fairness_measure_values",
              "ck_tme_wfm_fairness_measure_values_ordinal_v3",
              "ordinal BETWEEN 1 AND 100000", ["ordinal"])
    fairness["uniqueKeys"] = [{
        "constraintId": "uk_tme_wfm_fairness_measure_values_ordinal_v3",
        "columns": ["tenant_id", "constraint_evaluation_receipt_id", "ordinal"],
    }]

    # Every decision and publish proof is a typed physical fact.  The command
    # receipt is deliberately absent from this business-provenance shape.
    approval_targets = {
        "ppl_bnf_enrollment_decisions", "prf_cmp_plans",
        "prf_mkt_application_decisions", "ppl_rec_candidate_stage_history",
        "prf_suc_plans", "ppl_wfp_scenario_revisions",
        "ppl_rec_requisition_publish_receipts", "ppl_jny_template_versions",
        "ppl_wfp_publish_receipts", "ppl_bnf_plan_versions",
        "prf_skl_taxonomy_versions", "prf_lrn_offering_publish_receipts",
        "prf_mkt_opportunity_publish_receipts", "prf_suc_publish_receipts",
        "prf_cmp_approved_snapshots", "tme_wfm_schedule_publish_ledger",
        "sys_hris_listening_survey_versions", "sys_hris_metric_versions",
        "sys_hris_ai_policy_versions",
    }
    for table_name in approval_targets:
        table = result[table_name]
        for value in (
            column("approval_receipt_public_id", "UUID", reference="Approval.DecisionReceipt"),
            column("approval_receipt_revision", "BIGINT"),
            column("approval_outcome", "VARCHAR(40)"),
            column("approval_action", "VARCHAR(160)"),
            column("approval_input_digest", "CHAR(64)"),
            column("approval_purpose_code", "VARCHAR(160)"),
            column("approval_tenant_id", "BIGINT"),
        ):
            _append_column(table, value)
        add_check(table_name, "ck_" + table_name + "_approval_revision_v3",
                  "approval_receipt_revision > 0", ["approval_receipt_revision"])

    # Draft/general-history rows exist before approval.  Proof is therefore a
    # nullable all-or-none tuple with state/revision-kind REQUIRE/FORBID rules;
    # fake defaults are never used to satisfy DDL.
    approval_columns = [
        "approval_receipt_public_id", "approval_receipt_revision", "approval_outcome",
        "approval_action", "approval_input_digest", "approval_purpose_code",
        "approval_tenant_id",
    ]
    preproof_tables = {
        "sys_hris_ai_policy_versions", "sys_hris_metric_versions",
        "ppl_bnf_plan_versions", "ppl_jny_template_versions",
        "ppl_rec_candidate_stage_history", "prf_skl_taxonomy_versions",
        "prf_suc_plans", "ppl_wfp_scenario_revisions",
    }
    for table_name in preproof_tables:
        table = result[table_name]
        physical = {row["name"]: row for row in table["columns"]}
        for name in approval_columns:
            physical[name]["nullable"] = True
            physical[name]["default"] = None
        null_tuple = " AND ".join(name + " IS NULL" for name in approval_columns)
        full_tuple = " AND ".join(name + " IS NOT NULL" for name in approval_columns)
        add_check(
            table_name, "ck_" + table_name + "_approval_tuple_all_or_none_v3",
            f"(({null_tuple}) OR ({full_tuple}))", approval_columns,
        )
        table["proofLifecycleContract"] = {
            "tuple": approval_columns,
            "allOrNone": True,
            "preProofRule": "DRAFT/APPLIED/NON_APPROVAL_REVISION FORBIDS tuple",
            "postProofRule": "APPROVED/PUBLISHED/DECISION revision REQUIRES tuple",
            "fakeDefaultForbidden": True,
        }
    _append_column(result["ppl_wfp_scenario_revisions"], column(
        "revision_kind", "VARCHAR(40)", default="'GENERAL'"
    ))
    add_check(
        "ppl_wfp_scenario_revisions", "ck_ppl_wfp_scenario_revisions_proof_by_kind_v3",
        "revision_kind NOT IN ('APPROVED','PUBLISHED') OR approval_receipt_public_id IS NOT NULL",
        ["revision_kind", *approval_columns],
    )

    verification_columns = [
        "verification_receipt_public_id", "verification_reason_code", "verified_at",
        "verification_receipt_revision", "verification_outcome", "verification_action",
        "verification_input_digest", "verification_purpose_code", "verification_tenant_id",
    ]
    evidence = result["prf_skl_worker_evidence"]
    for name in verification_columns:
        value = next(row for row in evidence["columns"] if row["name"] == name)
        value["nullable"] = True
        value["default"] = None
    add_check(
        "prf_skl_worker_evidence", "ck_prf_skl_worker_evidence_verification_all_or_none_v3",
        "((status='PENDING' AND verification_receipt_public_id IS NULL) OR "
        "(status IN ('VERIFIED','REVOKED') AND verification_receipt_public_id IS NOT NULL))",
        ["status", *verification_columns],
    )

    extra_columns = {
        "tme_wfm_optimization_requests": [
            column("forecast_public_id", "UUID", reference="table:tme_wfm_demand_forecasts"),
        ],
        "prf_cmp_budget_ledger": [column("entry_type", "VARCHAR(40)")],
        "ppl_jny_task_evidence": [column("completion_code", "VARCHAR(80)")],
        "ppl_rec_hire_requests": [
            column("decision_outcome", "VARCHAR(40)"),
            column("decision_receipt_revision", "BIGINT"),
            column("decision_action", "VARCHAR(160)"),
            column("decision_input_digest", "CHAR(64)"),
            column("decision_purpose_code", "VARCHAR(160)"),
            column("decision_tenant_id", "BIGINT"),
        ],
        "prf_skl_worker_evidence": [
            column("verification_receipt_revision", "BIGINT"),
            column("verification_outcome", "VARCHAR(40)"),
            column("verification_action", "VARCHAR(160)"),
            column("verification_input_digest", "CHAR(64)"),
            column("verification_purpose_code", "VARCHAR(160)"),
            column("verification_tenant_id", "BIGINT"),
        ],
        "ppl_bnf_provider_receipts": [
            column("provider_request_id", "BIGINT", reference="table:ppl_bnf_provider_requests"),
            column("result_revision", "BIGINT"), column("outcome", "VARCHAR(40)"),
        ],
        "prf_grw_portability_export_receipts": [
            column("request_digest", "CHAR(64)"), column("requested_at", "TIMESTAMPTZ"),
        ],
    }
    for table_name, values in extra_columns.items():
        for value in values:
            _append_column(result[table_name], value)
    semantic_columns = {
        "ppl_rec_candidate_cases": [
            column("candidate_consent_receipt_public_id", "UUID", reference="DWP.Consent.DecisionReceipt"),
            column("candidate_consent_receipt_revision", "BIGINT"),
        ],
        "ppl_rec_hire_handoff_receipts": [
            column("request_digest", "CHAR(64)"), column("owner_result_outcome", "VARCHAR(40)"),
        ],
        "ppl_rec_offer_decisions": [
            column("offer_public_id", "UUID", reference="table:ppl_rec_offers"),
            column("decision", "VARCHAR(40)"), column("actor_mode", "VARCHAR(40)"),
            column("actor_public_id", "UUID", reference="DWP.Principal"),
            column("subject_public_id", "UUID", reference="DWP.Person"),
            column("delegation_receipt_public_id", "UUID", nullable=True, reference="DWP.Authorization.DelegationReceipt"),
            column("delegation_receipt_revision", "BIGINT", nullable=True),
            column("reason_code", "VARCHAR(160)"),
            column("decision_source_receipt_public_id", "UUID", nullable=True, reference="DWP.Authorization.DecisionReceipt"),
            column("decision_source_receipt_revision", "BIGINT", nullable=True),
        ],
        "ppl_rec_requisition_versions": [
            column("requisition_public_id", "UUID", reference="table:ppl_rec_requisitions"),
            column("revision_mode", "VARCHAR(40)"), column("effective_from", "DATE"),
            column("effective_to", "DATE", nullable=True), column("predecessor_revision", "BIGINT"),
            column("correction_reason_code", "VARCHAR(160)"), column("changed_fields", "JSONB"),
            column("employment_type_code_set_version_id", "UUID", reference="DWP.Configuration.CodeSetVersion"),
        ],
        "ppl_jny_template_task_definitions": [
            column("template_version_public_id", "UUID", reference="table:ppl_jny_template_versions"),
            column("task_key", "VARCHAR(160)"), column("title", "VARCHAR(240)"),
            column("task_type", "VARCHAR(80)"), column("actor_rule", "JSONB"),
            column("due_anchor_code", "VARCHAR(80)"), column("due_offset_seconds", "BIGINT"),
            column("condition_expression_version_id", "UUID", nullable=True, reference="DWP.Rules.ExpressionVersion"),
            column("completion_schema_ref", "VARCHAR(300)"), column("evidence_schema_ref", "VARCHAR(300)"),
            column("required_flag", "BOOLEAN"),
        ],
        "ppl_jny_assignment_tasks": [
            column("actor_public_id", "UUID", nullable=True, reference="DWP.Principal"),
            column("condition_snapshot_public_id", "UUID", nullable=True, reference="DWP.Rules.EvaluationReceipt"),
        ],
        "ppl_wfp_simulation_requests": [
            column("scenario_revision", "BIGINT"),
            column("input_snapshot_public_id", "UUID", reference="DWP.WorkforcePlanning.InputSnapshotVersion"),
            column("rule_version", "BIGINT"),
            column("deterministic_seed", "VARCHAR(160)"),
            column("request_digest", "CHAR(64)"),
            column("result_receipt_public_id", "UUID", nullable=True, reference="DWP.WorkforcePlanning.SimulationResultReceipt"),
            column("result_receipt_revision", "BIGINT", nullable=True),
            column("result_schema_version", "VARCHAR(80)", nullable=True),
            column("result_digest", "CHAR(64)", nullable=True),
        ],
        "ppl_bnf_enrollments": [
            column("coverage_option_code", "VARCHAR(120)"),
            column("eligibility_receipt_public_id", "UUID", reference="table:ppl_bnf_enrollment_eligibility_receipts"),
        ],
        "ppl_bnf_enrollment_eligibility_receipts": [
            column("enrollment_public_id", "UUID", reference="table:ppl_bnf_enrollments"),
            column("eligibility_policy_version_id", "UUID", reference="DWP.Benefits.EligibilityPolicyVersion"),
            column("population_snapshot_public_id", "UUID", reference="DWP.Population.ImmutableSnapshot"),
            column("decision_receipt_public_id", "UUID", reference="DWP.Rules.DecisionReceipt"),
            column("decision_receipt_revision", "BIGINT"), column("outcome", "VARCHAR(40)"),
        ],
        "ppl_bnf_dependent_elections": [
            column("enrollment_public_id", "UUID", reference="table:ppl_bnf_enrollments"),
            column("dependent_relationship_token", "UUID", reference="HRM.DependentRelationshipToken"),
            column("coverage_option_code", "VARCHAR(120)"), column("coverage_level_code", "VARCHAR(80)"),
        ],
        "ppl_bnf_life_event_decisions": [
            column("life_event_public_id", "UUID", reference="table:ppl_bnf_life_events"),
            column("decision", "VARCHAR(40)"), column("actor_mode", "VARCHAR(40)"),
            column("actor_public_id", "UUID", reference="DWP.Principal"),
            column("subject_public_id", "UUID", reference="HRM.Worker"),
            column("delegation_receipt_public_id", "UUID", nullable=True, reference="DWP.Authorization.DelegationReceipt"),
            column("delegation_receipt_revision", "BIGINT", nullable=True), column("reason_code", "VARCHAR(160)"),
            column("decision_source_receipt_public_id", "UUID", nullable=True, reference="DWP.Authorization.DecisionReceipt"),
            column("decision_source_receipt_revision", "BIGINT", nullable=True),
        ],
        "ppl_bnf_provider_requests": [
            column("enrollment_public_id", "UUID", reference="table:ppl_bnf_enrollments"),
            column("request_digest", "CHAR(64)"),
        ],
        "ppl_hrs_case_actions": [
            column("content_artifact_public_id", "UUID", nullable=True, reference="DWP.Content.EncryptedCaseArtifact"),
            column("content_artifact_revision", "BIGINT", nullable=True),
            column("content_artifact_schema_version", "VARCHAR(80)", nullable=True),
        ],
        "ppl_hrs_sla_receipts": [
            column("due_at", "TIMESTAMPTZ", nullable=True),
        ],
        "ppl_cwk_classification_receipts": [
            column("classification_code", "VARCHAR(80)"),
            column("classification_policy_version_id", "UUID", reference="DWP.Contingent.ClassificationPolicyVersion"),
            column("decision_receipt_public_id", "UUID", reference="DWP.Rules.DecisionReceipt"),
            column("decision_receipt_revision", "BIGINT"),
        ],
        "ppl_cwk_access_requests": [
            column("engagement_public_id", "UUID", reference="table:ppl_cwk_engagements"),
            column("access_package_public_id", "UUID", reference="DWP.Access.PackageVersion"),
            column("access_scope", "JSONB"), column("access_expires_at", "TIMESTAMPTZ"),
            column("request_digest", "CHAR(64)"),
        ],
        "ppl_cwk_access_receipts": [
            column("access_request_public_id", "UUID", reference="table:ppl_cwk_access_requests"),
            column("engagement_public_id", "UUID", reference="table:ppl_cwk_engagements"),
            column("grant_public_id", "UUID", nullable=True, reference="DWP.Access.Grant"),
            column("result_revision", "BIGINT"), column("outcome", "VARCHAR(40)"),
            column("result_digest", "CHAR(64)"), column("recorded_at", "TIMESTAMPTZ"),
        ],
        "prf_grw_evidence_links": [
            column("consent_receipt_public_id", "UUID", reference="DWP.Consent.DecisionReceipt"),
            column("consent_receipt_revision", "BIGINT"),
        ],
        "prf_grw_portability_export_receipts": [
            column("object_ref", "VARCHAR(1000)", nullable=True),
            column("object_schema_version", "VARCHAR(80)", nullable=True),
            column("object_digest", "CHAR(64)", nullable=True),
            column("expires_at", "TIMESTAMPTZ", nullable=True),
        ],
        "prf_lrn_offerings": [
            column("content_artifact_public_id", "UUID", nullable=True, reference="DWP.Content.LearningArtifactVersion"),
            column("content_artifact_revision", "BIGINT", nullable=True),
            column("delivery_mode", "VARCHAR(80)", nullable=True), column("capacity", "INTEGER", nullable=True),
            column("eligibility_policy_version_id", "UUID", nullable=True, reference="DWP.Learning.EligibilityPolicyVersion"),
            column("skill_mappings", "JSONB", nullable=True),
        ],
        "prf_lrn_offering_versions": [
            column("offering_public_id", "UUID", reference="table:prf_lrn_offerings"),
            column("version_no", "BIGINT"), column("effective_from", "DATE"), column("effective_to", "DATE", nullable=True),
            column("revision_mode", "VARCHAR(40)"), column("predecessor_revision", "BIGINT"),
            column("correction_reason_code", "VARCHAR(160)"),
            column("changed_fields", "JSONB"),
            column("content_artifact_public_id", "UUID", reference="DWP.Content.LearningArtifactVersion"),
            column("content_artifact_revision", "BIGINT"), column("content_artifact_schema_version", "VARCHAR(80)"),
            column("delivery_mode", "VARCHAR(80)"), column("session_schema", "JSONB"),
            column("capacity", "INTEGER"),
            column("eligibility_policy_version_id", "UUID", reference="DWP.Learning.EligibilityPolicyVersion"),
            column("skill_mappings", "JSONB"),
        ],
        "prf_lrn_capacity_ledger": [
            column("offering_version_public_id", "UUID", reference="table:prf_lrn_offering_versions"),
            column("assignment_public_id", "UUID", reference="table:prf_lrn_assignments"),
            column("entry_sequence", "BIGINT"), column("entry_type", "VARCHAR(40)"),
            column("quantity", "INTEGER"), column("recorded_at", "TIMESTAMPTZ"),
        ],
        "prf_lrn_assignments": [
            column("offering_version_public_id", "UUID", nullable=True, reference="table:prf_lrn_offering_versions"),
            column("offering_revision", "BIGINT", nullable=True),
            column("assignment_source_code", "VARCHAR(80)", nullable=True),
            column("assignment_source_policy_version_id", "UUID", nullable=True, reference="DWP.Learning.AssignmentSourcePolicyVersion"),
            column("consent_receipt_public_id", "UUID", nullable=True, reference="DWP.Consent.DecisionReceipt"),
        ],
        "prf_mkt_opportunities": [
            column("criteria_artifact_public_id", "UUID", nullable=True, reference="DWP.Content.OpportunityCriteriaArtifactVersion"),
            column("capacity", "INTEGER", nullable=True), column("skill_mappings", "JSONB", nullable=True),
        ],
        "prf_mkt_opportunity_versions": [
            column("opportunity_public_id", "UUID", reference="table:prf_mkt_opportunities"),
            column("version_no", "BIGINT"), column("revision_mode", "VARCHAR(40)"),
            column("effective_from", "TIMESTAMPTZ"), column("effective_to", "TIMESTAMPTZ", nullable=True),
            column("predecessor_revision", "BIGINT"), column("correction_reason_code", "VARCHAR(160)"),
            column("changed_fields", "JSONB"),
            column("criteria_artifact_public_id", "UUID", reference="DWP.Content.OpportunityCriteriaArtifactVersion"),
            column("criteria_artifact_revision", "BIGINT"), column("criteria_schema_version", "VARCHAR(80)"),
            column("capacity", "INTEGER"), column("skill_mappings", "JSONB"),
        ],
        "prf_mkt_applications": [
            column("opportunity_version_public_id", "UUID", nullable=True, reference="table:prf_mkt_opportunity_versions"),
            column("consent_receipt_public_id", "UUID", nullable=True, reference="DWP.Consent.DecisionReceipt"),
            column("statement_artifact_public_id", "UUID", nullable=True, reference="DWP.Content.ApplicationStatementArtifactVersion"),
            column("statement_artifact_revision", "BIGINT", nullable=True),
        ],
        "prf_mkt_application_decisions": [
            column("actor_public_id", "UUID", nullable=True, reference="DWP.Principal"),
            column("actor_mode", "VARCHAR(40)", nullable=True),
            column("subject_public_id", "UUID", nullable=True, reference="HRM.Worker"),
            column("delegation_receipt_public_id", "UUID", nullable=True, reference="DWP.Authorization.DelegationReceipt"),
            column("delegation_receipt_revision", "BIGINT", nullable=True),
            column("decision_source_receipt_public_id", "UUID", nullable=True, reference="DWP.Authorization.DecisionReceipt"),
            column("decision_source_receipt_revision", "BIGINT", nullable=True),
            column("reason_code", "VARCHAR(160)", nullable=True),
        ],
        "prf_grw_profile_revisions": [
            column("artifact_schema_version", "VARCHAR(80)", nullable=True),
        ],
        "ppl_jny_task_evidence": [
            column("authorization_receipt_public_id", "UUID", nullable=True, reference="DWP.Authorization.DecisionReceipt"),
            column("authorization_receipt_revision", "BIGINT", nullable=True),
        ],
        "prf_mkt_match_explanations": [
            column("explanation_artifact_public_id", "UUID", nullable=True, reference="DWP.Content.MatchExplanationArtifactVersion"),
            column("explanation_artifact_revision", "BIGINT", nullable=True),
        ],
        "prf_suc_nominations": [
            column("consent_receipt_public_id", "UUID", nullable=True, reference="DWP.Consent.DecisionReceipt"),
            column("consent_expires_at", "TIMESTAMPTZ", nullable=True),
            column("readiness_vocabulary_version_id", "UUID", reference="DWP.Configuration.VocabularyVersion"),
        ],
        "prf_suc_readiness_evidence": [
            column("review_due_at", "TIMESTAMPTZ", nullable=True),
            column("actor_mode", "VARCHAR(40)", nullable=True),
            column("actor_public_id", "UUID", nullable=True, reference="DWP.Principal"),
            column("subject_public_id", "UUID", nullable=True, reference="HRM.Worker"),
            column("delegation_receipt_public_id", "UUID", nullable=True, reference="DWP.Authorization.DelegationReceipt"),
            column("delegation_receipt_revision", "BIGINT", nullable=True),
            column("decision_source_receipt_public_id", "UUID", nullable=True, reference="DWP.Authorization.DecisionReceipt"),
            column("decision_source_receipt_revision", "BIGINT", nullable=True),
            column("reason_code", "VARCHAR(160)", nullable=True),
        ],
        "prf_cmp_proposals": [
            column("assignment_public_id", "UUID", reference="HRM.Assignment"),
            column("component_catalog_version_id", "UUID", reference="DWP.Compensation.ComponentCatalogVersion"),
            column("reason_code", "VARCHAR(160)"), column("proposal_version", "BIGINT", default="1"),
            column("component_code_set_version_id", "UUID", reference="DWP.Configuration.CodeSetVersion"),
            column("frequency_code", "VARCHAR(40)"), column("basis_code", "VARCHAR(40)"),
            column("fx_snapshot_public_id", "UUID", nullable=True, reference="DWP.Finance.FxSnapshot"),
        ],
        "prf_cmp_proposal_versions": [
            column("proposal_public_id", "UUID", reference="table:prf_cmp_proposals"),
            column("proposal_version", "BIGINT"), column("worker_public_id", "UUID", reference="HRM.Worker"),
            column("assignment_public_id", "UUID", reference="HRM.Assignment"), column("component_code", "VARCHAR(80)"),
            column("component_catalog_version_id", "UUID", reference="DWP.Compensation.ComponentCatalogVersion"),
            column("amount", "NUMERIC(19,4)"), column("currency_code", "CHAR(3)"),
            column("frequency_code", "VARCHAR(40)"), column("basis_code", "VARCHAR(40)"),
            column("fx_snapshot_public_id", "UUID", nullable=True, reference="DWP.Finance.FxSnapshot"),
            column("effective_date", "DATE"), column("reason_code", "VARCHAR(160)"),
        ],
        "prf_cmp_plan_proposal_refs": [
            column("plan_public_id", "UUID", reference="table:prf_cmp_plans"), column("plan_revision", "BIGINT"),
            column("proposal_public_id", "UUID", reference="table:prf_cmp_proposals"), column("proposal_version", "BIGINT"),
            column("typed_proposal_refs", "JSONB", nullable=True),
        ],
        "prf_cmp_approved_snapshot_lines": [
            column("source_proposal_public_id", "UUID", nullable=True, reference="table:prf_cmp_proposals"),
            column("source_proposal_version", "BIGINT", nullable=True),
            column("frequency_code", "VARCHAR(40)", nullable=True), column("basis_code", "VARCHAR(40)", nullable=True),
            column("fx_snapshot_public_id", "UUID", nullable=True, reference="DWP.Finance.FxSnapshot"),
            column("component_code_set_version_id", "UUID", nullable=True, reference="DWP.Configuration.CodeSetVersion"),
        ],
        "prf_cmp_budget_ledger": [
            column("frequency_code", "VARCHAR(40)", default="'CYCLE'"), column("basis_code", "VARCHAR(40)", default="'BUDGET'"),
            column("fx_snapshot_public_id", "UUID", nullable=True, reference="DWP.Finance.FxSnapshot"),
        ],
        "ppl_rec_offers": [
            column("frequency_code", "VARCHAR(40)"), column("basis_code", "VARCHAR(40)"),
            column("fx_snapshot_public_id", "UUID", nullable=True, reference="DWP.Finance.FxSnapshot"),
        ],
        "tme_wfm_optimization_requests": [
            column("optimization_mode", "VARCHAR(40)"),
            column("rule_snapshot_public_id", "UUID", reference="DWP.WFM.RuleSnapshotVersion"),
            column("algorithm_governance_receipt_id", "UUID", nullable=True, reference="DWP.AIGovernance.ActivationReceipt"),
            column("model_version_public_id", "UUID", nullable=True, reference="DWP.AIGovernance.ModelVersion"),
            column("result_public_id", "UUID", nullable=True, reference="DWP.WorkforceOptimizer.Result"),
            column("result_revision", "BIGINT", nullable=True),
            column("completed_at", "TIMESTAMPTZ", nullable=True),
        ],
        "tme_wfm_schedule_candidate_versions": [
            column("candidate_public_id", "UUID", reference="table:tme_wfm_schedule_candidates"),
            column("candidate_result_digest", "CHAR(64)"), column("optimizer_version_id", "UUID", reference="DWP.WorkforceOptimizer.Version"),
        ],
        "tme_wfm_candidate_shift_lines": [column("candidate_version", "BIGINT")],
        "tme_wfm_approval_receipts": [
            column("schedule_candidate_public_id", "UUID", reference="table:tme_wfm_schedule_candidates"),
            column("candidate_revision", "BIGINT"), column("decision_receipt_public_id", "UUID", reference="Approval.DecisionReceipt"),
            column("decision_receipt_revision", "BIGINT"), column("outcome", "VARCHAR(40)"),
            column("result_digest", "CHAR(64)"), column("recorded_at", "TIMESTAMPTZ"),
        ],
        "sys_hris_ai_assistance_reviews": [
            column("assistance_request_public_id", "UUID", reference="table:sys_hris_ai_assistance_requests"),
            column("subject_worker_public_id", "UUID", reference="HRM.Worker"),
            column("review_revision", "BIGINT"), column("decision", "VARCHAR(40)"),
            column("actor_public_id", "UUID", reference="DWP.Principal"), column("actor_mode", "VARCHAR(40)"),
            column("reason_code", "VARCHAR(160)"),
            column("delegation_receipt_public_id", "UUID", nullable=True, reference="DWP.Authorization.DelegationReceipt"),
            column("delegation_receipt_revision", "BIGINT", nullable=True),
            column("decision_source_receipt_public_id", "UUID", reference="DWP.Authorization.DecisionReceipt"),
            column("decision_source_receipt_revision", "BIGINT"),
            column("prior_review_public_id", "UUID", nullable=True, reference="table:sys_hris_ai_assistance_reviews"),
            column("prior_review_revision", "BIGINT", nullable=True),
        ],
        "ppl_cwk_engagement_versions": [
            column("engagement_public_id", "UUID", reference="table:ppl_cwk_engagements"),
            column("version_no", "BIGINT"), column("revision_mode", "VARCHAR(40)"),
            column("effective_from", "DATE"), column("effective_to", "DATE", nullable=True),
            column("predecessor_revision", "BIGINT"), column("correction_reason_code", "VARCHAR(160)"),
            column("changed_fields", "JSONB"), column("classification_policy_version_id", "UUID", reference="DWP.Contingent.ClassificationPolicyVersion"),
            column("access_package_public_id", "UUID", nullable=True, reference="DWP.Access.PackageVersion"),
        ],
        "prf_suc_plan_versions": [
            column("plan_public_id", "UUID", reference="table:prf_suc_plans"),
            column("version_no", "BIGINT"), column("revision_mode", "VARCHAR(40)"),
            column("effective_from", "DATE"), column("effective_to", "DATE", nullable=True),
            column("predecessor_revision", "BIGINT"), column("correction_reason_code", "VARCHAR(160)"),
            column("changed_fields", "JSONB"),
            column("audience_policy_public_id", "UUID", reference="DWP.Authorization.AudiencePolicyVersion"),
            column("audience_policy_revision", "BIGINT"),
            column("key_position_public_id", "UUID", reference="HRM.Position"),
            column("content_artifact_public_id", "UUID", reference="DWP.Content.RestrictedSuccessionPlanArtifactVersion"),
            column("content_artifact_revision", "BIGINT"), column("content_digest", "CHAR(64)"),
        ],
        "sys_hris_metric_versions": [
            column("expression_ast", "JSONB"), column("aggregation_code", "VARCHAR(80)"),
            column("unit_code", "VARCHAR(80)"), column("dimension_schema", "JSONB"),
            column("source_contracts", "JSONB"), column("unit_registry_version_id", "UUID", reference="DWP.Analytics.UnitRegistryVersion"),
        ],
        "sys_hris_metric_projections": [
            column("projection_request_public_id", "UUID", reference="table:sys_hris_metric_projection_requests"),
            column("projection_values", "JSONB"),
            column("lineage_receipt_public_id", "UUID", reference="DWP.Analytics.LineageReceipt"),
        ],
        "sys_hris_ai_assistance_requests": [
            column("subject_worker_public_id", "UUID", reference="HRM.Worker"),
        ],
        # Listening owner tables are fully defined by the static successor
        # overlay above.  Legacy broad-table aliases (parent_public_id,
        # token_policy_version_id, cipher_key_version_id, bucket_values and
        # privacy_budget_receipt_id) are deliberately not reintroduced here.
        "sys_hris_listening_admission_versions": [],
        "sys_hris_listening_answer_values": [],
        "sys_hris_listening_token_consumptions": [],
        "sys_hris_listening_cohort_projections": [],
        "sys_hris_metric_projection_requests": [
            column("metric_version_public_id", "UUID", reference="table:sys_hris_metric_versions"),
            column("as_of", "TIMESTAMPTZ"),
            column("cohort_definition_public_id", "UUID", reference="DWP.Analytics.CohortDefinitionVersion"),
            column("anonymity_threshold", "INTEGER"),
            column("population_snapshot_public_id", "UUID", nullable=True, reference="DWP.Population.ImmutableSnapshot"),
            column("purpose_code", "VARCHAR(160)", nullable=True),
        ],
        "sys_hris_analytics_export_receipts": [
            column("object_ref", "VARCHAR(1000)", nullable=True),
            column("object_schema_version", "VARCHAR(80)", nullable=True),
            column("completed_at", "TIMESTAMPTZ", nullable=True),
        ],
        "ppl_cwk_access_expiry_receipts": [
            column("access_request_id", "BIGINT", reference="table:ppl_cwk_access_requests"),
        ],
        "ppl_jny_template_versions": [
            column("config_scope_public_id", "UUID", nullable=True, reference="DWP.Configuration.ScopeVersion"),
            column("task_schema_version", "VARCHAR(80)", default="'ONBOARDING_TASK_V1'"),
            column("revision_mode", "VARCHAR(40)", nullable=True),
            column("correction_reason_code", "VARCHAR(160)", nullable=True),
            column("changed_fields", "JSONB", nullable=True),
            column("predecessor_revision", "BIGINT", nullable=True),
        ],
        "sys_hris_listening_survey_versions": [
            column("form_version_public_id", "UUID", reference="DWP.Listening.FormVersion"),
            column("privacy_version_public_id", "UUID", reference="DWP.Listening.PrivacyPolicyVersion"),
            column("retention_version_public_id", "UUID", reference="DWP.Listening.RetentionPolicyVersion"),
            column("content_sha256", "CHAR(64)"),
            column("question_definitions", "JSONB"),
            column("questions_schema_version", "VARCHAR(80)", default="'LISTENING_QUESTION_V1'"),
        ],
        "ppl_rec_requisitions": [
            column("target_start_date", "DATE", nullable=True),
            column("employment_type_code_set_version_id", "UUID", nullable=True, reference="DWP.Configuration.CodeSetVersion"),
        ],
        "ppl_bnf_plan_versions": [
            column("revision_mode", "VARCHAR(40)", nullable=True),
            column("predecessor_revision", "BIGINT", nullable=True),
            column("correction_reason_code", "VARCHAR(160)", nullable=True),
            column("changed_fields", "JSONB", nullable=True),
            column("payroll_treatment_code_set_version_id", "UUID", nullable=True, reference="DWP.Configuration.CodeSetVersion"),
        ],
        "ppl_hrs_cases": [
            column("requester_mode", "VARCHAR(40)", nullable=True),
            column("case_type_code_set_version_id", "UUID", nullable=True, reference="DWP.Configuration.CodeSetVersion"),
            column("queue_code_set_version_id", "UUID", nullable=True, reference="DWP.Configuration.CodeSetVersion"),
        ],
        "tme_wfm_demand_lines": [
            column("demand_unit_code_set_version_id", "UUID", nullable=True, reference="DWP.Configuration.CodeSetVersion"),
        ],
        "ppl_wfp_scenarios": [
            column("display_name", "VARCHAR(240)", nullable=True),
            column("effective_date", "DATE", nullable=True),
            column("valid_to", "DATE", nullable=True),
        ],
        "ppl_wfp_scenario_revisions": [
            column("config_version_public_id", "UUID", nullable=True, reference="DWP.WorkforcePlanning.ConfigurationVersion"),
            column("organization_snapshot_public_id", "UUID", nullable=True, reference="HRM.Organization.ImmutableSnapshot"),
            column("input_snapshot_public_id", "UUID", nullable=True, reference="DWP.WorkforcePlanning.InputSnapshotVersion"),
            column("assumption_artifact_public_id", "UUID", nullable=True, reference="DWP.Content.TypedWorkforceAssumptionArtifactVersion"),
            column("assumption_schema_version", "VARCHAR(80)", nullable=True),
            column("unit_code", "VARCHAR(40)", nullable=True),
            column("currency_code", "CHAR(3)", nullable=True),
            column("horizon_start", "DATE", nullable=True),
            column("horizon_end", "DATE", nullable=True),
            column("correction_reason_code", "VARCHAR(160)", nullable=True),
            column("simulation_result_receipt_public_id", "UUID", nullable=True, reference="DWP.WorkforcePlanning.SimulationResultReceipt"),
            column("simulation_result_receipt_revision", "BIGINT", nullable=True),
        ],
        "prf_skl_skill_nodes": [
            column("skill_code", "VARCHAR(160)"), column("label", "VARCHAR(240)"),
            column("locale_code", "VARCHAR(40)"),
        ],
        "prf_skl_skill_edges": [
            column("source_skill_public_id", "UUID", reference="table:prf_skl_skill_nodes"),
            column("target_skill_public_id", "UUID", reference="table:prf_skl_skill_nodes"),
            column("edge_type_code", "VARCHAR(80)"),
        ],
        "prf_skl_proficiency_levels": [
            column("level_code", "VARCHAR(80)"), column("label", "VARCHAR(240)"),
            column("rank_order", "INTEGER"),
        ],
        "prf_skl_worker_evidence": [
            column("taxonomy_version_public_id", "UUID", nullable=True, reference="table:prf_skl_taxonomy_versions"),
            column("consent_receipt_public_id", "UUID", nullable=True, reference="DWP.Consent.DecisionReceipt"),
            column("consent_receipt_revision", "BIGINT", nullable=True),
        ],
    }
    for table_name, values in semantic_columns.items():
        for value in values:
            _append_column(result[table_name], value)

    wfp_requests = result["ppl_wfp_simulation_requests"]
    wfp_requests["checks"] = [
        row for row in wfp_requests.get("checks", [])
        if row.get("constraintId") not in {
            "ck_ppl_wfp_simulation_requests_result_pair",
            "ck_ppl_wfp_simulation_requests_result_tuple_v3",
        }
    ]
    wfp_requests["checks"].append({
        "constraintId": "ck_ppl_wfp_simulation_requests_result_tuple_v3",
        "expression": (
            "((state='REQUESTED' AND result_public_id IS NULL AND result_revision IS NULL "
            "AND result_receipt_public_id IS NULL AND result_receipt_revision IS NULL "
            "AND result_schema_version IS NULL AND result_digest IS NULL AND completed_at IS NULL) "
            "OR (state IN ('COMPLETED','FAILED') AND result_public_id IS NOT NULL "
            "AND result_revision IS NOT NULL AND result_receipt_public_id IS NOT NULL "
            "AND result_receipt_revision IS NOT NULL AND result_schema_version IS NOT NULL "
            "AND result_digest IS NOT NULL AND completed_at IS NOT NULL) "
            "OR (state='CANCELLED' AND result_public_id IS NULL AND result_revision IS NULL "
            "AND result_receipt_public_id IS NULL AND result_receipt_revision IS NULL "
            "AND result_schema_version IS NULL AND result_digest IS NULL AND completed_at IS NOT NULL))"
        ),
        "columns": [
            "state", "result_public_id", "result_revision", "result_receipt_public_id",
            "result_receipt_revision", "result_schema_version", "result_digest", "completed_at",
        ],
    })
    wfp_requests["immutableColumns"] = [
        "tenant_id", "public_id", "parent_public_id", "parent_version", "fact_revision",
        "scenario_revision", "input_snapshot_public_id", "rule_version",
        "deterministic_seed", "request_digest", "payload_digest", "created_by",
        "created_at", "correlation_id", "reference_effective_at",
    ]
    wfp_requests["terminalCasContract"] = {
        "preState": "REQUESTED", "postStates": ["COMPLETED", "FAILED", "CANCELLED"],
        "expectedRows": "EXACTLY_ONE_OR_CANCEL_ZERO_IF_NO_ACTIVE_REQUEST",
        "terminalStateMutationForbidden": True,
        "inputPinMutationForbidden": True,
    }
    wfp_requests["immutability"] = (
        "IMMUTABLE_REQUEST_INPUT_PINS_WITH_EXACT_MONOTONIC_REQUESTED_TO_TERMINAL_CAS"
    )

    ai_reviews = result["sys_hris_ai_assistance_reviews"]
    ai_reviews.setdefault("foreignKeys", []).append({
        "mode": "LOCAL_COMPOSITE_FK",
        "columns": ["tenant_id", "prior_review_public_id"],
        "target": "sys_hris_ai_assistance_reviews",
        "targetColumns": ["tenant_id", "public_id"],
        "constraintId": "fk_sys_hris_ai_assistance_reviews_prior_review_v3",
    })
    ai_reviews.setdefault("checks", []).append({
        "constraintId": "ck_sys_hris_ai_assistance_reviews_revocation_link_v3",
        "expression": (
            "((decision='REVOKED' AND prior_review_public_id IS NOT NULL AND prior_review_revision IS NOT NULL) "
            "OR (decision IN ('CONFIRMED','REJECTED') AND prior_review_public_id IS NULL AND prior_review_revision IS NULL))"
        ),
        "columns": ["decision", "prior_review_public_id", "prior_review_revision"],
    })
    next(
        row for row in result["sys_hris_ai_assistance_reviews"]["columns"]
        if row["name"] == "reason_code"
    )["sensitivity"] = "HIGHLY_RESTRICTED"
    # Raw-history exclusion is intentionally absent on these immutable version
    # ledgers.  A correction is a new row with the same business interval and
    # an exact predecessor, while a future supersession may overlap the prior
    # row before it becomes applicable.  The owner root CAS serializes the
    # predecessor chain; reads arbitrate the winning revision at the requested
    # business/system time without mutating older rows.
    temporal_chains = (
        ("ppl_bnf_plan_versions", "benefit_plan_id", "version_no", "ppl_bnf_plans"),
        ("ppl_cwk_engagement_versions", "engagement_public_id", "version_no", "ppl_cwk_engagements"),
        ("ppl_jny_template_versions", "journey_template_id", "version_no", "ppl_jny_templates"),
        ("ppl_rec_requisition_versions", "requisition_public_id", "fact_revision", "ppl_rec_requisitions"),
        ("prf_lrn_offering_versions", "offering_public_id", "version_no", "prf_lrn_offerings"),
        ("prf_mkt_opportunity_versions", "opportunity_public_id", "version_no", "prf_mkt_opportunities"),
        ("prf_suc_plan_versions", "plan_public_id", "version_no", "prf_suc_plans"),
    )
    next(
        row for row in result["ppl_bnf_plan_versions"]["columns"]
        if row["name"] == "effective_from"
    )["nullable"] = False
    for table_name, parent_column, revision_column, root_table in temporal_chains:
        for required_column in (
            "revision_mode", "correction_reason_code", "changed_fields"
        ):
            next(
                row for row in result[table_name]["columns"]
                if row["name"] == required_column
            )["nullable"] = False
        _append_column(result[table_name], column(
            "predecessor_public_id", "UUID", nullable=True,
            reference="table:" + table_name,
        ))
        for value in (
            column("root_version", "BIGINT"),
            column(
                "effective_segment_public_id", "UUID",
                reference="DWP.EffectiveTime.Segment",
            ),
            column("segment_revision", "BIGINT"),
            column(
                "correction_target_public_id", "UUID", nullable=True,
                reference="table:" + table_name,
            ),
            column("correction_target_version", "BIGINT", nullable=True),
        ):
            _append_column(result[table_name], value)
        result[table_name].setdefault("foreignKeys", []).append({
            "mode": "LOCAL_COMPOSITE_FK",
            "columns": ["tenant_id", "predecessor_public_id"],
            "target": table_name,
            "targetColumns": ["tenant_id", "public_id"],
            "constraintId": "fk_" + table_name + "_predecessor_public_v3",
        })
        result[table_name].setdefault("foreignKeys", []).append({
            "mode": "LOCAL_COMPOSITE_FK",
            "columns": ["tenant_id", "correction_target_public_id"],
            "target": table_name,
            "targetColumns": ["tenant_id", "public_id"],
            "constraintId": "fk_" + table_name + "_correction_target_v3",
        })
        result[table_name].setdefault("uniqueKeys", []).extend((
            {
                "constraintId": "uk_" + table_name + "_root_version_v3",
                "columns": ["tenant_id", parent_column, "root_version"],
            },
            {
                "constraintId": "uk_" + table_name + "_segment_revision_v3",
                "columns": [
                    "tenant_id", parent_column,
                    "effective_segment_public_id", "segment_revision",
                ],
            },
            {
                "constraintId": "ck_" + table_name + "_root_predecessor_v3",
                "expression": (
                    "((root_version=1 AND predecessor_public_id IS NULL AND predecessor_revision=0) OR "
                    "(root_version>1 AND predecessor_public_id IS NOT NULL "
                    "AND predecessor_revision=root_version-1))"
                ),
                "columns": ["root_version", "predecessor_public_id", "predecessor_revision"],
            },
            {
                "constraintId": "ck_" + table_name + "_effective_segment_correction_v3",
                "expression": (
                    "((revision_mode IN ('CREATE','SUPERSEDE') AND segment_revision=1 "
                    "AND correction_target_public_id IS NULL AND correction_target_version IS NULL) OR "
                    "(revision_mode='CORRECTION' AND segment_revision>1 "
                    "AND correction_target_public_id IS NOT NULL AND correction_target_version>0))"
                ),
                "columns": [
                    "revision_mode", "effective_segment_public_id", "segment_revision",
                    "correction_target_public_id", "correction_target_version",
                ],
            },
        ))
        result[table_name].setdefault("checks", []).extend((
            {
                "constraintId": "ck_" + table_name + "_revision_mode_v3",
                "expression": "revision_mode IN ('CREATE','CORRECTION','SUPERSEDE')",
                "columns": ["revision_mode"],
            },
            {
                "constraintId": "ck_" + table_name + "_predecessor_chain_v3",
                "expression": (
                    "((revision_mode='CREATE' AND predecessor_public_id IS NULL AND predecessor_revision=0) OR "
                    "(revision_mode IN ('CORRECTION','SUPERSEDE') AND predecessor_public_id IS NOT NULL "
                    "AND predecessor_revision>0))"
                ),
                "columns": ["revision_mode", "predecessor_public_id", "predecessor_revision"],
            },
        ))
        result[table_name].pop("temporalExclusionConstraints", None)
        result[table_name]["temporalArbitration"] = {
            "strategy": "APPEND_ONLY_EFFECTIVE_SEGMENT_CHAIN",
            "rawHistoryExclusion": "NONE",
            "parentColumns": ["tenant_id", parent_column],
            "revisionColumn": revision_column,
            "predecessorColumn": "predecessor_revision",
            "predecessorPublicIdColumn": "predecessor_public_id",
            "rootVersionColumn": "root_version",
            "revisionModeColumn": "revision_mode",
            "effectiveSegmentPublicIdColumn": "effective_segment_public_id",
            "segmentRevisionColumn": "segment_revision",
            "correctionTargetPublicIdColumn": "correction_target_public_id",
            "correctionTargetVersionColumn": "correction_target_version",
            "effectiveFromColumn": "effective_from",
            "effectiveToColumn": "effective_to",
            "recordedAtColumn": "created_at",
            "rootTable": root_table,
            "rootAggregateVersionColumn": "aggregate_version",
            "rootCasRequired": True,
            "correctionRule": (
                "CORRECTION_REUSES_TARGET_EFFECTIVE_SEGMENT_PUBLIC_ID_AND_EFFECTIVE_FROM;"
                "APPENDS_NEXT_SEGMENT_REVISION;GLOBAL_PREDECESSOR_REMAINS_LATEST_ROOT_APPEND"
            ),
            "futureSupersedeRule": (
                "SUPERSEDE_ALLOCATES_NEW_EFFECTIVE_SEGMENT_PUBLIC_ID_AT_EFFECTIVE_FROM;"
                "OLDER_ROWS_ARE_NEVER_UPDATED"
            ),
            "storedEffectiveToAuthority": (
                "NON_AUTHORITATIVE_HINT_ONLY;BUSINESS_SEGMENT_END_IS_DERIVED_FROM_NEXT_"
                "VISIBLE_SEGMENT_EFFECTIVE_FROM;LAST_VISIBLE_SEGMENT_IS_OPEN"
            ),
            "businessAsOfWinner": (
                "AFTER_SYSTEM_ASOF_FILTER_SELECT_MAX_EFFECTIVE_FROM_SEGMENT_LE_BUSINESS_ASOF;"
                "THEN_SELECT_HIGHEST_SEGMENT_REVISION_WITHIN_ONLY_THAT_SEGMENT"
            ),
            "systemAsOfRule": (
                "FIRST_FILTER_created_at<=systemAsOf_THEN_DERIVE_VISIBLE_SEGMENTS_AND_NEXT_BOUNDARY"
            ),
            "concurrentSameExpectedVersion": "EXACTLY_ONE_SUCCESS",
            "intervalValidation": "effective_to IS NULL OR effective_to>effective_from",
            "positiveFixtures": [
                "historical CORRECTION after a future SUPERSEDE changes only its target segment winner",
                "future SUPERSEDE appends a new segment; prior segment wins before derived boundary only",
            ],
            "negativeFixtures": [
                "correction target outside the named segment or nonlatest segment revision is rejected",
                "two writers with the same expected root version yield exactly one successful append+root CAS",
            ],
        }
    export = result["sys_hris_analytics_export_receipts"]
    for name in ("object_digest", "row_count"):
        physical = next(row for row in export["columns"] if row["name"] == name)
        physical["nullable"] = True
        physical["default"] = None
    export["checks"] = [
        row for row in export.get("checks", [])
        if row.get("constraintId") not in {
            "ck_sys_hris_analytics_export_receipts_1",
            "ck_sys_hris_analytics_export_receipts_2",
        }
    ]
    add_check(
        "sys_hris_analytics_export_receipts",
        "ck_sys_hris_analytics_export_receipts_result_lifecycle_v3",
        "((status IN ('REQUESTED','GENERATING','FAILED') AND object_ref IS NULL AND "
        "object_schema_version IS NULL AND object_digest IS NULL AND row_count IS NULL AND completed_at IS NULL) OR "
        "(status='COMPLETED' AND object_ref IS NOT NULL AND object_schema_version IS NOT NULL AND "
        "object_digest IS NOT NULL AND row_count IS NOT NULL AND completed_at IS NOT NULL) OR "
        "(status='EXPIRED' AND object_ref='REVOKED' AND object_schema_version IS NOT NULL AND "
        "object_digest IS NOT NULL AND row_count IS NOT NULL AND completed_at IS NOT NULL))",
        ["status", "object_ref", "object_schema_version", "object_digest", "row_count", "completed_at"],
    )
    access_receipts = result["ppl_cwk_access_expiry_receipts"]
    for check in access_receipts.get("checks", []):
        if check.get("columns") == ["outcome"]:
            check["expression"] = (
                "outcome IN ('GRANTED','DENIED','REVOKED','REVOKE_FAILED','EXPIRED','NOT_FOUND','RETRY_REQUIRED')"
            )
    candidates = result["tme_wfm_schedule_candidates"]
    for check in candidates.get("checks", []):
        if check.get("columns") == ["status"]:
            check["expression"] = (
                "status IN ('GENERATED','VALIDATED','VALIDATION_FAILED','SUBMITTED','APPROVED',"
                "'REJECTED','PUBLISHED','CANCELLED')"
            )
    for table_name, state_column, expression in (
        ("ppl_rec_hire_requests", "status", "status IN ('PENDING','ACKNOWLEDGED','COMPLETED','FAILED','CANCELLED')"),
        ("ppl_cwk_access_requests", "state", "state IN ('REQUESTED','GRANTED','COMPLETED','FAILED','REVOKED','EXPIRED')"),
        ("ppl_hrs_sla_receipts", "outcome", "outcome IN ('MEASURED','MET','BREACHED','PAUSED','EXEMPT')"),
    ):
        for check in result[table_name].get("checks", []):
            if check.get("columns") == [state_column]:
                check["expression"] = expression
    for table_name, stale_columns in {
        "ppl_wfp_publish_receipts": {"approval_case_public_id"},
        "prf_cmp_approved_snapshots": {"approval_receipt_id", "approval_revision"},
        "prf_cmp_plans": {"approval_revision"},
    }.items():
        table = result[table_name]
        table["columns"] = [
            row for row in table["columns"] if row["name"] not in stale_columns
        ]
        table["checks"] = [
            row for row in table.get("checks", [])
            if not set(row.get("columns", [])) & stale_columns
        ]
    for index in result["prf_cmp_approved_snapshots"].get("indexes", []):
        index["columns"] = [
            "approval_receipt_public_id" if name == "approval_receipt_id" else name
            for name in index.get("columns", [])
        ]
    for key in result["prf_cmp_plans"].get("uniqueKeys", []):
        key["columns"] = [
            "approval_receipt_revision" if name == "approval_revision" else name
            for name in key.get("columns", [])
        ]
    for index in result["tme_wfm_fairness_measure_values"].get("indexes", []):
        index["columns"] = [
            "ordinal" if name == "line_sequence" else name
            for name in index.get("columns", [])
        ]

    provider_receipts = result["ppl_bnf_provider_receipts"]
    provider_requests = result["ppl_bnf_provider_requests"]
    if not any(
        row.get("columns") == ["tenant_id", "record_id"]
        for row in provider_requests.get("uniqueKeys", [])
    ):
        provider_requests.setdefault("uniqueKeys", []).append({
            "constraintId": "uk_ppl_bnf_provider_requests_tenant_internal_v3",
            "columns": ["tenant_id", "record_id"],
        })
    provider_receipts["foreignKeys"] = [
        row for row in provider_receipts.get("foreignKeys", [])
        if row.get("columns") != ["tenant_id", "provider_request_id"]
    ] + [{
        "mode": "LOCAL_COMPOSITE_FK",
        "columns": ["tenant_id", "provider_request_id"],
        "target": "ppl_bnf_provider_requests",
        "targetColumns": ["tenant_id", "record_id"],
        "constraintId": "fk_ppl_bnf_provider_receipts_request_v3",
    }]

    # Three missing tenant-local relations are causal integrity, not comments.
    local_fk_repairs = {
        "ppl_bnf_enrollments": (
            "life_event_id", "ppl_bnf_life_events", "benefit_life_event_id"
        ),
        "tme_wfm_schedule_candidates": ("optimization_request_id", "tme_wfm_optimization_requests", "optimization_request_id"),
        "tme_wfm_candidate_shift_lines": ("demand_forecast_id", "tme_wfm_demand_forecasts", "demand_forecast_id"),
    }
    for table_name, (column_name, target, target_column) in local_fk_repairs.items():
        table = result[table_name]
        table["foreignKeys"] = [
            row for row in table.get("foreignKeys", [])
            if row.get("columns") != ["tenant_id", column_name]
        ]
        table["foreignKeys"].append({
            "mode": "LOCAL_COMPOSITE_FK", "columns": ["tenant_id", column_name],
            "target": target, "targetColumns": ["tenant_id", target_column],
            "constraintId": "fk_" + table_name + "_" + column_name + "_v3",
        })

    # Same-owner relations use the physical BIGINT row identity.  Public UUIDs
    # remain available for API/event lineage but are never masqueraded as a
    # local FK target or assumed to be an implicit physical candidate key.
    internal_identity_fks = {
        ("ppl_cwk_access_requests", "fk_ppl_cwk_access_requests_parent_v3"):
            ("contingent_engagement_id", "ppl_cwk_engagements"),
        ("ppl_cwk_classification_receipts", "fk_ppl_cwk_classification_receipts_parent_v3"):
            ("contingent_engagement_id", "ppl_cwk_engagements"),
        ("ppl_cwk_engagement_versions", "fk_ppl_cwk_engagement_versions_parent_v3"):
            ("contingent_engagement_id", "ppl_cwk_engagements"),
        ("prf_grw_coaching_note_evidence_refs", "fk_prf_grw_coaching_note_evidence_refs_parent_v3"):
            ("growth_coaching_note_id", "prf_grw_coaching_notes"),
        ("prf_grw_coaching_note_evidence_refs", "fk_prf_grw_coaching_note_evidence_refs_child_v3"):
            ("worker_skill_evidence_id", "prf_skl_worker_evidence"),
        ("prf_grw_profile_revision_evidence_refs", "fk_prf_grw_profile_revision_evidence_refs_child_v3"):
            ("worker_skill_evidence_id", "prf_skl_worker_evidence"),
        ("prf_lrn_completion_skill_evidence_refs", "fk_prf_lrn_completion_skill_evidence_refs_parent_v3"):
            ("learning_completion_evidence_id", "prf_lrn_completion_evidence"),
        ("prf_lrn_completion_skill_evidence_refs", "fk_prf_lrn_completion_skill_evidence_refs_child_v3"):
            ("worker_skill_evidence_id", "prf_skl_worker_evidence"),
        ("prf_skl_proficiency_levels", "fk_prf_skl_proficiency_levels_parent_v3"):
            ("skill_taxonomy_version_id", "prf_skl_taxonomy_versions"),
        ("prf_skl_skill_edges", "fk_prf_skl_skill_edges_parent_v3"):
            ("skill_taxonomy_version_id", "prf_skl_taxonomy_versions"),
        ("prf_skl_skill_nodes", "fk_prf_skl_skill_nodes_parent_v3"):
            ("skill_taxonomy_version_id", "prf_skl_taxonomy_versions"),
        ("sys_hris_analytics_export_projection_refs", "fk_sys_hris_analytics_export_projection_refs_parent_v3"):
            ("analytics_export_receipt_id", "sys_hris_analytics_export_receipts"),
        ("sys_hris_analytics_export_projection_refs", "fk_sys_hris_analytics_export_projection_refs_child_v3"):
            ("metric_projection_id", "sys_hris_metric_projections"),
        ("tme_wfm_approval_receipts", "fk_tme_wfm_approval_receipts_parent_v3"):
            ("schedule_candidate_id", "tme_wfm_schedule_candidates"),
        ("tme_wfm_schedule_candidate_time_group_refs", "fk_tme_wfm_schedule_candidate_time_group_refs_parent_v3"):
            ("schedule_candidate_id", "tme_wfm_schedule_candidates"),
        ("tme_wfm_schedule_candidate_versions", "fk_tme_wfm_schedule_candidate_versions_parent_v3"):
            ("schedule_candidate_id", "tme_wfm_schedule_candidates"),
    }
    for (table_name, constraint_id), (source_column, target_table) in internal_identity_fks.items():
        table = result[table_name]
        target_id = result[target_table]["idColumn"]["name"]
        _append_column(table, column(source_column, "BIGINT", reference="table:" + target_table))
        table["foreignKeys"] = [
            row for row in table.get("foreignKeys", [])
            if row.get("constraintId") != constraint_id
        ]
        table["foreignKeys"].append({
            "mode": "LOCAL_COMPOSITE_FK",
            "columns": ["tenant_id", source_column],
            "target": target_table,
            "targetColumns": ["tenant_id", target_id],
            "constraintId": constraint_id,
        })

    # PostgreSQL requires the referenced column tuple itself to be a declared
    # candidate key. A globally unique surrogate inside a wider row is not a
    # substitute for the exact tenant-scoped tuple used by a composite FK.
    for source_table in result.values():
        for foreign in source_table.get("foreignKeys", []):
            if foreign.get("mode") != "LOCAL_COMPOSITE_FK":
                continue
            target_table = result[foreign["target"]]
            target_columns = foreign.get("targetColumns", [])
            if not any(
                key.get("columns") == target_columns
                for key in target_table.get("uniqueKeys", [])
            ):
                target_table.setdefault("uniqueKeys", []).append({
                    "constraintId": (
                        "uk_" + target_table["tableName"] + "_" +
                        "_".join(target_columns) + "_fk_target_v4"
                    ),
                    "columns": list(target_columns),
                    "rationale": "EXACT_LOCAL_COMPOSITE_FK_CANDIDATE_KEY",
                })

    typed_owner_repairs = {
        ("tme_wfm_approval_requests", "decision_receipt_public_id"):
            "Approval.DecisionReceipt",
        ("tme_wfm_approval_requests", "cancellation_receipt_public_id"):
            "Approval.DecisionReceipt",
        ("tme_wfm_candidate_shift_lines", "planning_input_snapshot_id"):
            "HRM.WorkforcePlanningInputSnapshot",
    }
    for (table_name, column_name), entity_type in typed_owner_repairs.items():
        table = result[table_name]
        physical = next(row for row in table["columns"] if row["name"] == column_name)
        physical["referenceContract"] = {
            "entityType": entity_type, "idSpace": "PUBLIC_UUID",
        }
        table["typedOwnerReferenceContracts"] = [
            row for row in table.get("typedOwnerReferenceContracts", [])
            if row.get("column") != column_name
        ]
        table["typedOwnerReferenceContracts"].append({
            "column": column_name, "entityType": entity_type,
            "idSpace": "PUBLIC_UUID",
            "proof": "tenant+purpose+population+exact immutable receipt/revision/asOf",
        })

    # Correlation and business digests are not identity. Idempotency keys are
    # deliberately different: their owner-scoped unique constraints are the
    # physical serialization point for CLAIM_OR_REPLAY. Preserve those keys,
    # while retaining only the protected one-time token digest exception.
    for table in result.values():
        table["uniqueKeys"] = [
            key for key in table.get("uniqueKeys", [])
            if not (
                any("correlation" in name for name in key.get("columns", []))
                or (
                    any(re.search(r"(?:digest|hash)", name, re.I) for name in key.get("columns", []))
                    and key.get("constraintId")
                    not in {
                        # This is not a digest-only identity.  The definition
                        # digest is one member of the complete protected-owner
                        # release scope, which is the serialization point that
                        # prevents a fresh idempotency key from spending the
                        # same privacy budget twice.
                        "uk_sys_hris_listening_cohort_budgets_build_scope_v4",
                    }
                )
            )
        ]
        if table["tableName"] == "sys_hris_listening_responses":
            table["uniqueKeys"].append({
                "constraintId": "uk_sys_hris_listening_response_token_commitment_v3",
                "columns": ["tenant_id", "survey_public_id", "response_token_hash"],
                "exception": "PROTECTED_ONE_TIME_TOKEN_COMMITMENT",
            })
        if table["tableName"] == "tme_wfm_approval_requests":
            table["columns"] = [
                col for col in table["columns"] if col["name"] != "approval_case_public_id"
            ]
    _apply_ai_governance_tables(result)
    # The survey form version is DRAFT on create/revise and receives approval
    # proof only on publish.  Skill evidence is PENDING before verification.
    for table_name, names in {
        "sys_hris_listening_survey_versions": approval_columns,
        "prf_skl_worker_evidence": verification_columns,
    }.items():
        values = {row["name"]: row for row in result[table_name]["columns"]}
        for name in names:
            values[name]["nullable"] = True
            values[name]["default"] = None
    for table_name, names in {
        "sys_hris_listening_survey_versions": approval_columns,
        "prf_skl_worker_evidence": verification_columns,
    }.items():
        null_tuple = " AND ".join(name + " IS NULL" for name in names)
        full_tuple = " AND ".join(name + " IS NOT NULL" for name in names)
        add_check(
            table_name, "ck_" + table_name + "_proof_tuple_all_or_none_v3",
            f"(({null_tuple}) OR ({full_tuple}))", list(names),
        )
    assistance = result["sys_hris_ai_assistance_requests"]
    if not any(
        key.get("columns") == ["tenant_id", "record_id"]
        for key in assistance.get("uniqueKeys", [])
    ):
        assistance["uniqueKeys"].append({
            "constraintId": "uk_sys_hris_ai_assistance_requests_tenant_internal_v3",
            "columns": ["tenant_id", "record_id"],
        })
    if set(result) != set(manifest["tableIds"]):
        raise ValueError("table specification set differs from manifest")
    return [result[name] for name in sorted(result)]


def _request_schema(operation: dict[str, Any]) -> dict[str, Any]:
    groups = {key: [] for key in ("pathParameters", "queryParameters", "headers", "body")}
    for field in operation.get("requestFields", []):
        groups[field["location"]].append({
            key: copy.deepcopy(value) for key, value in field.items()
            if key not in {"source", "location"}
        })
    result = {
        "schemaId": operation["operationId"] + ".Request.v3", "kind": "OBJECT",
        "additionalProperties": False, **groups,
        "validationRules": [
            "reject unknown fields and caller tenant/actor",
            "business public references require operation-specific owner/revision/asOf proof",
            "Idempotency-Key and X-Correlation-ID are excluded from canonical business digest",
        ],
    }


def _query_projection(operation_id: str) -> tuple[tuple[str, str, str, str], ...]:
    normalized = operation_id
    for plural, singular in (
        (".policies.", ".policy."), (".assistances.", ".assistance."),
        (".evaluations.", ".evaluation."), (".metrics.", ".metric."),
        (".projections.", ".projection."), (".exports.", ".export."),
        (".plans.", ".plan."), (".enrollments.", ".enrollment."),
        (".lifeevents.", ".lifeevent."), (".cycles.", ".cycle."),
        (".proposals.", ".proposal."), (".engagements.", ".engagement."),
        (".profiles.", ".profile."), (".cases.", ".case."),
        (".assignments.", ".assignment."), (".cohorts.", ".cohort."),
        (".surveys.", ".survey."), (".templates.", ".template."),
        (".applications.", ".application."), (".candidates.", ".candidate."),
        (".requisitions.", ".requisition."), (".evidences.", ".evidence."),
        (".taxonomies.", ".taxonomy."), (".forecasts.", ".forecast."),
        (".scenarios.", ".scenario."),
    ):
        normalized = normalized.replace(plural, singular)
    if "benefits.self.plan" in normalized:
        normalized = normalized.replace("benefits.self.plan", "benefits.plan")
    for marker, rows in QUERY_PROJECTION_FIELDS.items():
        if marker in normalized:
            return rows
    return ()


TEMPORAL_ROOT_QUERY_TABLES = {
    "modern.benefits.plan.query": "ppl_bnf_plan_versions",
    "modern.benefits.plans.query": "ppl_bnf_plan_versions",
    "modern.benefits.self.plans.query": "ppl_bnf_plan_versions",
    "modern.contingent.engagement.query": "ppl_cwk_engagement_versions",
    "modern.contingent.engagements.query": "ppl_cwk_engagement_versions",
    "modern.learning.offering.query": "prf_lrn_offering_versions",
    "modern.learning.catalog.query": "prf_lrn_offering_versions",
    "modern.onboarding.template.query": "ppl_jny_template_versions",
    "modern.onboarding.templates.query": "ppl_jny_template_versions",
    "modern.opportunity.query": "prf_mkt_opportunity_versions",
    "modern.opportunity.catalog.query": "prf_mkt_opportunity_versions",
    "modern.recruiting.requisition.query": "ppl_rec_requisition_versions",
    "modern.recruiting.requisitions.query": "ppl_rec_requisition_versions",
    "modern.succession.plan.query": "prf_suc_plan_versions",
    "modern.succession.plans.query": "prf_suc_plan_versions",
}

TEMPORAL_JOIN_QUERY_TABLES = {
    "modern.opportunity.application.query": "prf_mkt_opportunity_versions",
    "modern.opportunity.applications.query": "prf_mkt_opportunity_versions",
}


def _record_schema(operation: dict[str, Any], root: str) -> dict[str, Any]:
    projection = _query_projection(operation["operationId"]) if operation["mode"] == "QUERY" else ()
    if operation["mode"] == "QUERY" and not projection:
        raise ValueError(f"query projection is not explicit: {operation['operationId']}")
    state_column = operation.get("aggregateRoot", {}).get("stateColumn")
    if not state_column:
        state_column = RECORD_STATE_COLUMN.get(
            root, "state" if root.endswith(("_versions", "_requests")) else "status"
        )
    fields = [
        {"name": "publicId", "type": "UUID", "required": True,
         "validation": "canonical UUID", "sensitivity": "INTERNAL",
         "tokenization": "OPAQUE_PUBLIC_ID",
         "sourcePath": root + ".public_id",
         "referenceContract": {"entityType": "table:" + root, "idSpace": "PUBLIC_UUID"}},
        {"name": "aggregateVersion", "type": "BIGINT", "required": True,
         "validation": ">=1 exact owner revision", "sensitivity": "INTERNAL", "tokenization": "NONE",
         "sourcePath": root + ".aggregate_version"},
        {"name": "state", "type": "STRING", "required": True,
         "validation": "exact lifecycle state", "sensitivity": "INTERNAL", "tokenization": "NONE",
         "sourcePath": root + "." + state_column},
        {"name": "referenceEffectiveAt", "type": "TIMESTAMPTZ", "required": True,
         "validation": "exact owner as-of", "sensitivity": "INTERNAL", "tokenization": "NONE",
         "sourcePath": root + ".updated_at"},
        {"name": "fieldPolicyRevision", "type": "BIGINT", "required": True,
         "validation": "owner decision revision", "sensitivity": "INTERNAL", "tokenization": "NONE"},
    ]
    temporal_detail_table = TEMPORAL_ROOT_QUERY_TABLES.get(operation["operationId"])
    if temporal_detail_table:
        projection = (*projection, *(
            ("revisionPublicId", "UUID", temporal_detail_table + ".public_id", "RESTRICTED"),
            ("rootVersion", "BIGINT", temporal_detail_table + ".root_version", "INTERNAL"),
            ("effectiveSegmentPublicId", "UUID", temporal_detail_table + ".effective_segment_public_id", "RESTRICTED"),
            ("segmentRevision", "BIGINT", temporal_detail_table + ".segment_revision", "INTERNAL"),
            ("revisionMode", "STRING", temporal_detail_table + ".revision_mode", "INTERNAL"),
            ("segmentPredecessorPublicId", "UUID", temporal_detail_table + ".segment_predecessor_public_id", "RESTRICTED"),
            ("segmentPredecessorRevision", "BIGINT", temporal_detail_table + ".segment_predecessor_revision", "INTERNAL"),
            ("derivedEffectiveTo", "TIMESTAMPTZ", temporal_detail_table + ".effective_from", "INTERNAL"),
        ))
    else:
        temporal_join_table = TEMPORAL_JOIN_QUERY_TABLES.get(operation["operationId"])
        if temporal_join_table:
            projection = tuple(
                (
                    name, field_type,
                    ("CONTENT_WINNER:" + source_path if source_path.startswith(
                        temporal_join_table + "."
                    ) else source_path),
                    sensitivity,
                )
                for name, field_type, source_path, sensitivity in projection
            )
    seen_names = {field["name"] for field in fields}
    for name, field_type, source_path, sensitivity in projection:
        if name in seen_names:
            continue
        field = {
            "name": name, "type": field_type, "required": False,
            "validation": "exact owner-derived typed projection; no request echo or latest fallback",
            "sensitivity": sensitivity,
            "tokenization": "OPAQUE_PUBLIC_ID" if field_type == "UUID" else "NONE",
            "sourcePath": source_path,
            "fieldPolicy": {
                "authorizationCapability": operation["authorizationCapability"],
                "behavior": "ALLOW_OR_OMIT_OR_TOKENIZE_EXACT_FIELD",
                "unknownField": "OMIT", "denyOnUnavailable": True,
            },
        }
        if name == "derivedEffectiveTo":
            field["validation"] = (
                "server-derived from the next systemAsOf-visible base segment effective_from; "
                "null only for the last visible segment"
            )
        if operation["operationId"] == "modern.listening.cohorts.query" and name in {
            "measureValues", "subjectCount",
        }:
            field.update({
                "required": False,
                "condition": "adequacyCategory=ADEQUATE",
                "validation": (
                    "ADEQUATE_ONLY; SUPPRESSED rows omit the exact value to prevent "
                    "small-cell disclosure"
                ),
            })
        if field_type == "UUID":
            field["referenceContract"] = {
                "entityType": "table:" + source_path.split(".", 1)[0],
                "idSpace": "PUBLIC_UUID",
            }
        fields.append(field)
        seen_names.add(name)
    if temporal_detail_table:
        state_field_names = {
            "aggregateVersion", "state", "referenceEffectiveAt",
            "revisionPublicId", "rootVersion", "stateRevisionPublicId",
        }
        segment_lineage_field_names = {
            "effectiveSegmentPublicId", "segmentRevision", "revisionMode",
            "segmentPredecessorPublicId", "segmentPredecessorRevision",
        }
        for field in fields:
            source = field.get("sourcePath", "")
            if field["name"] == "publicId" or not source:
                continue
            if field["name"] in state_field_names:
                state_column_path = source.removeprefix("STATE_WINNER:")
                field["selectionModeSources"] = {
                    "UNQUALIFIED": "STATE_WINNER:" + state_column_path,
                    "STATE_HISTORY": "SELECTED_STATE_ROW:" + state_column_path,
                    "CONTENT_HISTORY": "STATE_WINNER:" + state_column_path,
                }
            elif (
                field["name"] in segment_lineage_field_names
                and source.startswith("CONTENT_WINNER:")
            ):
                column_path = source.removeprefix("CONTENT_WINNER:")
                field["selectionModeSources"] = {
                    "UNQUALIFIED": "CONTENT_WINNER:" + column_path,
                    # Exact state-history lineage describes the appended state
                    # row carried by the event, even when its content pointer
                    # dereferences a different immutable content row.
                    "STATE_HISTORY": "SELECTED_STATE_ROW:" + column_path,
                    "CONTENT_HISTORY": "SELECTED_CONTENT_ROW:" + column_path,
                }
            elif source.startswith("CONTENT_WINNER:"):
                content_column_path = source.removeprefix("CONTENT_WINNER:")
                field["selectionModeSources"] = {
                    "UNQUALIFIED": "CONTENT_WINNER:" + content_column_path,
                    "STATE_HISTORY": "CONTENT_ROW:" + content_column_path,
                    "CONTENT_HISTORY": "SELECTED_CONTENT_ROW:" + content_column_path,
                }
            elif field["name"] == "derivedEffectiveTo":
                field["selectionModeSources"] = {
                    "UNQUALIFIED": source,
                    "STATE_HISTORY": "DERIVED:NEXT_SYSTEM_ASOF_VISIBLE_BASE_FOR_SELECTED_STATE_SEGMENT:"
                                     + temporal_detail_table + ".effective_from",
                    "CONTENT_HISTORY": "DERIVED:NEXT_SYSTEM_ASOF_VISIBLE_BASE_FOR_SELECTED_CONTENT_SEGMENT:"
                                       + temporal_detail_table + ".effective_from",
                }
    result = {
        "schemaId": operation["operationId"] + ".Entity.v3", "kind": "OBJECT",
        "additionalProperties": False,
        "fields": fields,
    }
    if operation.get("exactHistoryTransport"):
        result["selectionModes"] = copy.deepcopy(
            operation["exactHistoryTransport"]["selectorModes"]
        )
        result["crossFieldRules"] = copy.deepcopy(
            operation["exactHistoryTransport"]["crossFieldRules"]
        )
    return result


def _child_schema(operation: dict[str, Any]) -> dict[str, Any]:
    return {
        "schemaId": operation["operationId"] + ".TypedChild.v3", "kind": "OBJECT",
        "additionalProperties": False,
        "fields": [
            {"name": "entityType", "type": "STRING", "required": True,
             "validation": "operation-specific closed entity allowlist", "sensitivity": "INTERNAL", "tokenization": "NONE"},
            {"name": "publicId", "type": "UUID", "required": True,
             "validation": "identity selected by entityType and operation contract",
             "sensitivity": "INTERNAL", "tokenization": "OPAQUE_PUBLIC_ID",
             "referenceContract": {"entityType": operation["capabilityId"] + ".TypedChild",
                                   "idSpace": "DISCRIMINATED_PUBLIC_UUID"}},
            {"name": "aggregateVersion", "type": "BIGINT", "required": True,
             "validation": ">=1", "sensitivity": "INTERNAL", "tokenization": "NONE"},
            {"name": "ordinal", "type": "INTEGER", "required": True,
             "validation": "1..100000 deterministic order", "sensitivity": "INTERNAL", "tokenization": "NONE"},
            {"name": "resultDigest", "type": "SHA256", "required": True,
             "validation": "server canonical digest", "sensitivity": "INTERNAL", "tokenization": "NONREVERSIBLE_DIGEST"},
        ],
    }


def _response_schema(operation: dict[str, Any], root: str, command: bool) -> dict[str, Any]:
    if command:
        receipt, _ = SESSION_RECEIPTS[operation["session"]]
        if operation.get("capabilityId") == "HRIS.MODERN.EMPLOYEE_LISTENING":
            stream = (operation.get("listeningAuthority") or {}).get("authoritativeStreamKey")
            receipt = {
                "platform-hris-configuration": "sys_hris_listening_operation_receipts",
                "platform-hris-listening-protected": "sys_hris_listening_protected_receipts",
                "platform-hris-insights": "sys_hris_listening_insights_inbox",
                "auth-hris-participation-issuer": "sys_hris_listening_issuer_receipts",
            }.get(stream, receipt)
        return {
            "schemaId": operation["operationId"] + ".Response.v3", "kind": "OBJECT",
            "additionalProperties": False,
            "fields": [
                {"name": "commandReceiptId", "type": "UUID", "required": True,
                 "validation": "sealed receipt public identity", "sensitivity": "INTERNAL",
                 "tokenization": "OPAQUE_PUBLIC_ID",
                 "referenceContract": {"entityType": "table:" + receipt, "idSpace": "PUBLIC_UUID"}},
                {"name": "status", "type": "STRING", "required": True,
                 "validation": "COMPLETED; ACCEPTED only for true async ingress", "sensitivity": "INTERNAL", "tokenization": "NONE"},
                {"name": "correlationId", "type": "UUID", "required": True,
                 "validation": "original sealed trace correlation", "sensitivity": "INTERNAL",
                 "tokenization": "OPAQUE_CORRELATION_ID", "traceContract": "Trace.Correlation"},
                {"name": "completedAt", "type": "TIMESTAMPTZ", "required": True,
                 "validation": "owner completion clock", "sensitivity": "INTERNAL", "tokenization": "NONE"},
                {"name": "resultDigest", "type": "SHA256", "required": True,
                 "validation": "digest of closed result JSON", "sensitivity": "INTERNAL", "tokenization": "NONREVERSIBLE_DIGEST"},
                {"name": "aggregatePublicId", "type": "UUID", "required": True,
                 "validation": "physical post identity", "sensitivity": "INTERNAL", "tokenization": "OPAQUE_PUBLIC_ID",
                 "referenceContract": {"entityType": "table:" + root, "idSpace": "PUBLIC_UUID"}},
                {"name": "aggregateVersion", "type": "BIGINT", "required": True,
                 "validation": "physical post version", "sensitivity": "INTERNAL", "tokenization": "NONE"},
                {"name": "childResults", "type": "ARRAY", "required": True,
                 "validation": "all downstream child identities in deterministic order",
                 "sensitivity": "INTERNAL", "tokenization": "NONE",
                 "itemSchemaRef": operation["operationId"] + ".TypedChild.v3"},
            ],
        }
    detail = bool(re.search(r"\{[^}]+\}$", operation["path"]))
    fields = [
        {"name": "item" if detail else "items", "type": "OBJECT" if detail else "ARRAY",
         "required": True, "validation": "tenant/purpose/population/field-policy projection",
         "sensitivity": "INTERNAL", "tokenization": "NONE",
         ("schemaRef" if detail else "itemSchemaRef"): operation["operationId"] + ".Entity.v3"},
        {"name": "referenceEffectiveAt", "type": "TIMESTAMPTZ", "required": True,
         "validation": "owner as-of", "sensitivity": "INTERNAL", "tokenization": "NONE"},
        {"name": "freshnessWatermark", "type": "TIMESTAMPTZ", "required": True,
         "validation": "owner projection watermark", "sensitivity": "INTERNAL", "tokenization": "NONE"},
        {"name": "fieldPolicyRevision", "type": "BIGINT", "required": True,
         "validation": "exact policy revision", "sensitivity": "INTERNAL", "tokenization": "NONE"},
    ]
    if not detail:
        fields.extend([
            {"name": "nextCursor", "type": "STRING", "required": False,
             "validation": "signed tenant/scope/purpose/asOf/sort cursor", "sensitivity": "INTERNAL", "tokenization": "NONE"},
            {"name": "hasMore", "type": "BOOLEAN", "required": True,
             "validation": "boolean", "sensitivity": "INTERNAL", "tokenization": "NONE"},
        ])
    return {"schemaId": operation["operationId"] + ".Response.v3", "kind": "OBJECT",
            "additionalProperties": False, "fields": fields}

RECORD_STATE_COLUMN = {
    "sys_hris_ai_evaluation_requests": "status",
    "prf_grw_portability_export_receipts": "state",
    "sys_hris_listening_cohort_projections": "state",
    "ppl_rec_candidate_cases": "stage",
    "tme_wfm_optimization_requests": "status",
}


def _operation_binding(operation: dict[str, Any], tables: set[str]) -> dict[str, Any]:
    writes = []
    for step in operation.get("orderedDml", []):
        table = step.get("table")
        if table in tables and step.get("role") not in {"COMMAND_RECEIPT", "TRANSACTIONAL_OUTBOX"}:
            if table not in writes:
                writes.append(table)
    reads = [table for table in operation.get("readPlan", {}).get("tables", []) if table in tables]
    root = operation.get("aggregateRoot", {}).get("table")
    if operation["mode"] == "COMMAND":
        for selector in operation.get("selectors", []):
            table = selector.get("targetTable")
            if table in tables and table not in writes and table not in reads:
                reads.append(table)
    return {
        "capabilityId": operation["capabilityId"], "session": operation["session"],
        "operationId": operation["operationId"], "method": operation["method"],
        "path": operation["path"], "action": operation["operationId"].upper().replace(".", "_"),
        "authorizationCapability": operation["authorizationCapability"],
        "scope": ["TENANT", "PURPOSE", "NAMED_POPULATION"], "mode": operation["mode"],
        "idempotency": "READ_SAFE" if operation["mode"] == "QUERY" else "SEALED_COMMAND_RECEIPT",
        "expectedVersion": "NOT_APPLICABLE" if operation["mode"] == "QUERY" else "REQUIRED_PARENT_OR_ROOT",
        "requestSchemaRef": operation["operationId"] + ".Request.v3",
        "responseSchemaRef": operation["operationId"] + ".Response.v3",
        "errorSchemaRefs": ["DwpProblem.v1", "AuthorizationProblem.v1", "ConcurrencyProblem.v1"],
        "requestSchema": _request_schema(operation),
        "readsTables": reads, "writesTables": writes,
        "stateTransitionIds": ([operation["transition"]["transitionId"]]
                               if operation["mode"] == "COMMAND" else []),
        "eventNames": [event["eventName"] for event in operation.get("events", [])],
        "aggregateRootTable": root,
        "responseProjection": copy.deepcopy(operation.get("readPlan", {}).get("projectionTuple")),
    }
    if temporal_detail_table:
        result["selectionModeContract"] = copy.deepcopy(
            operation["exactHistoryTransport"]
        )
    return result


def _lineage(operation: dict[str, Any], binding: dict[str, Any]) -> dict[str, Any]:
    root = binding.get("aggregateRootTable") or (binding["readsTables"][0] if binding["readsTables"] else None)
    receipt, receipt_id = SESSION_RECEIPTS[operation["session"]]
    receipt_state_column = "status"
    receipt_digest_column = "request_digest"
    receipt_caller_column = "caller_public_id"
    if operation.get("capabilityId") == "HRIS.MODERN.EMPLOYEE_LISTENING":
        stream = (operation.get("listeningAuthority") or {}).get("authoritativeStreamKey")
        if stream == "platform-hris-configuration":
            receipt, receipt_id, receipt_state_column = (
                "sys_hris_listening_operation_receipts", "public_id", "lifecycle_state"
            )
            receipt_caller_column = "created_by"
        elif stream == "platform-hris-listening-protected":
            receipt, receipt_id, receipt_state_column = (
                "sys_hris_listening_protected_receipts", "public_id", "state"
            )
            receipt_digest_column = "payload_digest"
            receipt_caller_column = "created_by"
    input_mappings = [{
        "source": field["source"], "type": field["type"],
        "sinks": copy.deepcopy(next(
            (row.get("effects", []) for row in operation.get("inputEffects", [])
             if row.get("source") == field["source"]), []
        )),
    } for field in operation.get("requestFields", [])]
    response = []
    if operation["mode"] == "COMMAND":
        sources = {
            "commandReceiptId": f"{receipt}.{receipt_id}",
            "status": f"{receipt}.{receipt_state_column}",
            "correlationId": f"{receipt}.correlation_id",
            "completedAt": f"{receipt}.completed_at",
            "resultDigest": f"{receipt}.result_digest",
            "aggregatePublicId": f"{root}.public_id",
            "aggregateVersion": f"{root}.aggregate_version",
            "childResults": "SEALED_COMMAND_RECEIPT.post_identity_json",
        }
    else:
        sources = {
            "item" if re.search(r"\{[^}]+\}$", operation["path"]) else "items":
                "EXACT_TYPED_PROJECTION:" + "+".join(binding["readsTables"]),
            "referenceEffectiveAt": "OWNER_PROJECTION.reference_effective_at",
            "freshnessWatermark": "OWNER_PROJECTION.freshness_watermark",
            "fieldPolicyRevision": "OWNER_FIELD_POLICY.revision",
            "nextCursor": "SERVER_SIGNED_KEYSET_CURSOR",
            "hasMore": "SERVER_DERIVE:limit+1",
        }
    for field, source in sources.items():
        response.append({
            "target": binding["responseSchemaRef"] + "." + field,
            "sourcePath": source,
            "sourceKind": (
                "SEALED_COMMAND_RECEIPT" if source.startswith((receipt, "SEALED_COMMAND_RECEIPT"))
                else "PHYSICAL_POST" if root and source.startswith(root + ".")
                else "IMMUTABLE_PROOF"
            ),
        })
    if operation["mode"] == "QUERY":
        record_path = "item" if re.search(r"\{[^}]+\}$", operation["path"]) else "items[*]"
        record_schema = _record_schema(operation, root)
        for field in record_schema["fields"]:
            source = field.get("sourcePath")
            if not source:
                continue
            lineage_row = {
                "target": binding["responseSchemaRef"] + "." + record_path + "." + field["name"],
                "sourcePath": source,
                "sourceKind": "PHYSICAL_POST_STATE",
            }
            if field.get("selectionModeSources"):
                lineage_row["selectionModeSources"] = copy.deepcopy(
                    field["selectionModeSources"]
                )
            response.append(lineage_row)
    event_sources = [{
        "target": event["eventName"] + "." + field["name"],
        "sourcePath": field["source"], "sourceKind": field["sourceKind"],
    } for event in operation.get("events", []) for field in event.get("fields", [])]
    mutation_sources = [{
        "target": f"{step['table']}.{column}", "sourcePath": source,
        "sourceKind": "REVIEWED_OPERATION_CAUSAL_SOURCE",
    } for step in operation.get("orderedDml", [])
      if step.get("table") in binding["writesTables"]
      for column, source in step.get("assignments", {}).items()]
    return {
        "operationId": operation["operationId"], "mode": operation["mode"],
        "inputMappings": input_mappings, "typedSources": [],
        "receiptContracts": ([] if operation["mode"] == "QUERY" else [{
            "receiptId": "receipt.owner", "table": receipt, "idColumn": receipt_id,
            "tenantColumn": "tenant_id", "idempotencyColumn": "idempotency_key",
            "requestDigestColumn": receipt_digest_column, "callerColumn": receipt_caller_column,
        }]),
        "writeSet": [{"table": table, "disposition": next(
            (step["action"] for step in operation.get("orderedDml", []) if step.get("table") == table),
            "UPDATE_CAS")}
            for table in binding["writesTables"]],
        "mutationFieldSources": mutation_sources, "requiredColumnSources": mutation_sources,
        "responseFieldSources": response, "eventFieldSources": event_sources,
        "mutationEvidence": {
            "stateTransitionIds": binding["stateTransitionIds"],
            "nonDigestDrivers": [field["source"] for field in operation.get("requestFields", [])
                                 if field.get("required") and "digest" not in field["name"].lower()
                                 and not field["source"].startswith("headers.")],
            "digestOnlyMutation": "FORBIDDEN" if operation["mode"] == "COMMAND" else "NOT_APPLICABLE",
        },
    }


def _event_schema(event: dict[str, Any], producer_id: str, capability: str,
                  session: str, handler: bool) -> dict[str, Any]:
    event_name = event["eventName"]
    event_type, version = event_name.rsplit(".v", 1)
    return {
        "eventName": event_name, "capabilityId": capability, "session": session,
        "eventType": event_type, "schemaVersion": int(version),
        "topic": "dwp.hris.modern." + event_type.lower() + ".v" + version,
        "payloadSchemaId": event_type + ".Payload.v" + version,
        "additionalProperties": False, "fields": copy.deepcopy(event["fields"]),
        "emittedByOperationIds": [] if handler else [producer_id],
        "emittedByInternalHandlerIds": [producer_id] if handler else [],
        "emissionCondition": event.get("condition", "ALWAYS"),
        "causalRule": "DURABLE_POST_OR_LOCKED_PRE_OR_IMMUTABLE_PROOF_ONLY",
        "deliveryPolicy": {
            "audience": "EXACT_ALLOWLIST",
            "classification": event["audience"].get("classification", "INTERNAL_DOMAIN"),
            "allowedConsumerSessions": event["audience"]["allowedConsumerSessions"],
            "allowedPurposeCodes": event["audience"]["allowedPurposes"],
            "pep": "SAME_BOUNDED_CONTEXT_EVENT_PEP_V3",
            "fieldAllowlist": [field["name"] for field in event["fields"]],
            "consumerFieldAllowlists": copy.deepcopy(
                event["audience"].get("consumerFieldExposure", {})
            ),
            "restrictedFields": [field["name"] for field in event["fields"]
                                 if field.get("sensitivity") in {"RESTRICTED", "CONFIDENTIAL"}],
            "denyUnknownConsumerOrPurpose": True,
        },
        "consumerRefetchPolicy": {
            "allowed": event["refetchContract"].get("mode") != "FORBIDDEN",
            **copy.deepcopy(event["refetchContract"]),
        },
    }


def _validate_ssot_physical_closure(
    ssot: dict[str, Any], exact: dict[str, Any],
) -> dict[str, int]:
    """Fail closed when causal references are not exact-schema addressable."""
    tables = {row["tableName"]: row for row in exact["tableSpecifications"]}
    common_columns = {
        row["name"] for row in exact["commonTableContract"]["columns"]
        if row["name"] != "__internal_id__"
    }
    physical_columns = {
        table_name: common_columns
        | {table["idColumn"]["name"]}
        | {row["name"] for row in table.get("columns", [])}
        for table_name, table in tables.items()
    }
    required_owner_unique_keys = {
        "sys_hris_listening_operation_receipts": {
            ("tenant_id", "message_name", "message_id"),
            ("tenant_id", "created_by", "operation_id", "idempotency_key"),
        },
        "sys_hris_listening_protected_receipts": {
            ("tenant_id", "message_name", "message_id"),
            ("tenant_id", "admission_public_id", "receipt_kind", "idempotency_key"),
        },
        "sys_hris_listening_insights_inbox": {
            ("tenant_id", "message_name", "message_id"),
        },
        "sys_hris_listening_token_consumptions": {
            ("tenant_id", "listening_admission_version_id", "token_commitment"),
        },
        "sys_hris_listening_cohort_budgets": {
            (
                "tenant_id", "listening_admission_version_id", "policy_revision",
                "source_epoch", "cutoff_at", "measure_schema_version",
                "measure_definition_digest",
            ),
            ("tenant_id", "listening_admission_version_id", "release_sequence"),
        },
        "sys_hris_listening_erasure_tickets": {
            ("tenant_id", "listening_response_id", "idempotency_key"),
        },
        "sys_hris_listening_eligibility_versions": {
            (
                "tenant_id", "subject_principal_public_id", "admission_public_id",
                "idempotency_key",
            ),
        },
        "sys_hris_listening_token_issuances": {
            ("tenant_id", "listening_eligibility_version_id", "idempotency_key"),
        },
        "sys_hris_listening_token_revocations": {
            ("tenant_id", "listening_token_issuance_id", "idempotency_key"),
        },
        "sys_hris_listening_issuer_receipts": {
            ("tenant_id", "operation_name", "created_by", "idempotency_key"),
        },
        "sys_hris_listening_answer_values": {
            ("tenant_id", "listening_response_id", "question_key"),
        },
        "sys_hris_listening_lineage_receipts": {
            ("tenant_id", "listening_cohort_projection_id"),
        },
    }
    for table_name, expected_keys in required_owner_unique_keys.items():
        observed = {
            tuple(key.get("columns", []))
            for key in tables[table_name].get("uniqueKeys", [])
        }
        if not expected_keys <= observed:
            raise ValueError(
                f"owner claim/replay candidate key missing: {table_name} "
                f"{sorted(expected_keys - observed)}"
            )
    common_types = {
        row["name"]: row["sqlType"] for row in exact["commonTableContract"]["columns"]
        if row["name"] != "__internal_id__"
    }
    physical_types = {
        table_name: {
            **common_types,
            table["idColumn"]["name"]: table["idColumn"]["sqlType"],
            **{row["name"]: row["sqlType"] for row in table.get("columns", [])},
        }
        for table_name, table in tables.items()
    }
    for table_name, table in tables.items():
        for family in ("uniqueKeys", "indexes", "checks"):
            for constraint in table.get(family, []):
                missing = set(constraint.get("columns", [])) - physical_columns[table_name]
                if missing:
                    raise ValueError(
                        f"{family} columns absent: {table_name} {sorted(missing)}"
                    )
        for foreign in table.get("foreignKeys", []):
            missing_source = set(foreign.get("columns", [])) - physical_columns[table_name]
            if missing_source:
                raise ValueError(
                    f"FK source columns absent: {table_name} {sorted(missing_source)}"
                )
            if foreign.get("mode") != "LOCAL_COMPOSITE_FK":
                continue
            target = foreign.get("target")
            if target not in physical_columns:
                raise ValueError(f"local FK target table absent: {table_name} {target}")
            missing_target = set(foreign.get("targetColumns", [])) - physical_columns[target]
            if missing_target:
                raise ValueError(
                    f"FK target columns absent: {table_name}->{target} {sorted(missing_target)}"
                )
            source_stream = table.get("streamKey")
            target_stream = tables[target].get("streamKey")
            if source_stream and target_stream and source_stream != target_stream:
                raise ValueError(
                    f"cross-stream LOCAL_COMPOSITE_FK forbidden: {table_name}({source_stream})->"
                    f"{target}({target_stream})"
                )
            target_columns = foreign.get("targetColumns", [])
            if not any(
                key.get("columns") == target_columns
                for key in tables[target].get("uniqueKeys", [])
            ):
                raise ValueError(
                    f"local FK target is not an exact candidate key: {table_name}->{target} "
                    f"{target_columns}"
                )
            for source_column, target_column in zip(
                foreign.get("columns", []), target_columns,
            ):
                if physical_types[table_name][source_column] != physical_types[target][target_column]:
                    raise ValueError(
                        f"local FK SQL type mismatch: {table_name}.{source_column} "
                        f"{physical_types[table_name][source_column]} -> {target}.{target_column} "
                        f"{physical_types[target][target_column]}"
                    )
    listening_actions = tables.get("sys_hris_listening_actions", {})
    opaque_refs = listening_actions.get("crossBoundaryReferences", [])
    if not any(
        row.get("mode") == "OPAQUE_CROSS_BOUNDARY_REFERENCE"
        and row.get("ownerStream") == "platform-hris-insights"
        and row.get("physicalForeignKeyForbidden") is True
        for row in opaque_refs
    ):
        raise ValueError("Listening action cohort projection lacks exact opaque owner-port reference")
    common = {
        row["name"] for row in exact["commonTableContract"]["columns"]
        if row["name"] != "__internal_id__"
    }
    columns = {
        name: common
        | {table["idColumn"]["name"]}
        | {row["name"] for row in table.get("columns", [])}
        for name, table in tables.items()
    }
    required_insert_columns = {
        name: {
            row["name"] for row in exact["commonTableContract"]["columns"]
            if row["name"] != "__internal_id__"
            and row.get("nullable") is False and row.get("default") is None
        } | {
            row["name"] for row in table.get("columns", [])
            if row.get("nullable") is False and row.get("default") is None
        }
        for name, table in tables.items()
    }
    errors: list[str] = []
    counts = {
        "commandsChecked": 0, "handlersChecked": 0, "dmlAssignmentsChecked": 0,
        "ownerPortsChecked": 0,
        "ownerPortResponseSourcesChecked": 0,
        "aggregateRootsChecked": 0, "stateSinksChecked": 0,
        "selectorsChecked": 0, "querySourcesChecked": 0,
        "eventSourcesChecked": 0, "mismatches": 0,
    }

    def require_table_column(label: str, table: str, column_name: str) -> None:
        if table not in columns:
            errors.append(f"{label}: unknown table {table}")
        elif column_name not in columns[table]:
            errors.append(f"{label}: unknown column {table}.{column_name}")

    def require_insert_columns(label: str, step: dict[str, Any]) -> None:
        if step.get("action") not in {
            "INSERT", "APPEND", "INSERT_MANY", "APPEND_MANY", "CLAIM_OR_REPLAY",
            "APPEND_PRIVATE_ONLY", "APPEND_SEALED_OWNER_RECEIPT",
            "APPEND_PRIVATE_OWNER_DELIVERY", "APPEND_SIGNED_OWNER_OUTBOX",
        }:
            return
        table = step.get("table", "")
        if table not in required_insert_columns:
            return
        missing = required_insert_columns[table] - set(step.get("assignments", {}))
        if missing:
            errors.append(f"{label}: missing required columns {table}.{sorted(missing)}")

    def physical_source(label: str, value: str) -> None:
        if " via " in value:
            errors.append(f"{label}: non-addressable source expression {value}")
            return
        match = re.fullmatch(
            r"(?:LOCKED_PRE:|LOCKED_POST:)?([a-z][a-z0-9_]*)\.([a-z][a-z0-9_]*)",
            value,
        )
        if not match:
            errors.append(f"{label}: non-addressable physical source {value}")
            return
        require_table_column(label, match.group(1), match.group(2))

    def event_sources(producer_id: str, event: dict[str, Any]) -> None:
        entity = event.get("aggregateEntityType", "")
        if entity.startswith("table:") and entity.removeprefix("table:") not in tables:
            errors.append(f"{producer_id}.{event['eventName']}: unknown aggregate table {entity}")
        for field in event.get("fields", []):
            kind = field.get("sourceKind")
            if kind == "DERIVED_DOMAIN_FACT":
                continue
            if field.get("name") == "correlationId" and kind in {
                "SEALED_COMMAND_RECEIPT", "IMMUTABLE_OWNER_PROOF",
            }:
                # Command/inbox receipts are transaction controls, outside the
                # domain table closed set; only correlation may source them.
                if not re.fullmatch(
                    r"(?:(?:ppl|prf|tme|sys_hris)_(?:command|domain_inbox)_receipts|"
                    r"sys_hris_listening_(?:operation_receipts|protected_receipts|insights_inbox))\.correlation_id",
                    str(field.get("source", "")),
                ):
                    errors.append(
                        f"{producer_id}.{event['eventName']}.correlationId: invalid control source"
                    )
                continue
            if kind in {
                "PHYSICAL_POST_STATE", "LOCKED_PRE_STATE", "IMMUTABLE_OWNER_PROOF", "IMMUTABLE_PROOF",
                "TYPED_ORDERED_CHILD_PROJECTION",
            }:
                counts["eventSourcesChecked"] += 1
                physical_source(
                    f"{producer_id}.{event['eventName']}.{field['name']}",
                    str(field.get("source", "")),
                )
                order = field.get("collectionOrderSource")
                if order:
                    physical_source(
                        f"{producer_id}.{event['eventName']}.{field['name']}.order",
                        str(order).removesuffix(" ASC").removesuffix(" DESC"),
                    )

    def aggregate(label: str, root: dict[str, Any]) -> None:
        if not root:
            return
        counts["aggregateRootsChecked"] += 1
        table = root.get("table")
        for key in ("publicIdColumn", "versionColumn", "stateColumn"):
            column_name = root.get(key)
            if column_name:
                require_table_column(f"{label}.{key}", table, column_name)

    for operation in ssot["operations"]:
        operation_id = operation["operationId"]
        if operation["mode"] == "COMMAND":
            counts["commandsChecked"] += 1
            for step in operation.get("orderedDml", []):
                if step.get("role") in {"COMMAND_RECEIPT", "TRANSACTIONAL_OUTBOX"}:
                    continue
                if step.get("action") == "CALL_OWNER_PORT" and not step.get("assignments"):
                    continue
                table = step.get("table", "")
                if table not in columns:
                    errors.append(f"{operation_id}.orderedDml: unknown table {table}")
                    continue
                for column_name in step.get("assignments", {}):
                    counts["dmlAssignmentsChecked"] += 1
                    require_table_column(
                        f"{operation_id}.orderedDml", table, column_name,
                    )
                require_insert_columns(operation_id + ".orderedDml", step)
            aggregate(operation_id + ".aggregateRoot", operation.get("aggregateRoot", {}))
            transition = operation.get("transition", {})
            sink = transition.get("physicalPostStateSink") or transition.get("stateSink")
            if sink:
                counts["stateSinksChecked"] += 1
                physical_source(operation_id + ".stateSink", sink)
            for selector in operation.get("selectors", []):
                table = str(selector.get("targetTable", ""))
                if table.startswith("OWNER_PORT::"):
                    continue
                counts["selectorsChecked"] += 1
                require_table_column(
                    operation_id + ".selector", table,
                    str(selector.get("targetColumn", "")),
                )
        else:
            projection = operation.get("readPlan", {}).get("projectionTuple", {})
            for table in projection.get("physicalSources", []):
                counts["querySourcesChecked"] += 1
                if table not in tables:
                    errors.append(f"{operation_id}.readPlan: unknown table {table}")
        for event in operation.get("events", []):
            event_sources(operation_id, event)

    for handler in ssot["systemHandlers"]:
        handler_id = handler["handlerId"]
        counts["handlersChecked"] += 1
        aggregate(handler_id + ".aggregateRoot", handler.get("aggregateRoot", {}))
        for table in handler.get("readsTables", []):
            if table not in tables:
                errors.append(f"{handler_id}.readsTables: unknown table {table}")
        for step in handler.get("writes", []):
            table = step.get("table", "")
            if table not in columns:
                errors.append(f"{handler_id}.writes: unknown table {table}")
                continue
            for column_name in step.get("assignments", {}):
                counts["dmlAssignmentsChecked"] += 1
                require_table_column(f"{handler_id}.writes", table, column_name)
            require_insert_columns(handler_id + ".writes", step)
        if handler.get("event"):
            event_sources(handler_id, handler["event"])
        for additional_event in handler.get("additionalEvents", []):
            event_sources(handler_id, additional_event)

    for owner_port in ssot.get("ownerPortOperationContracts", []):
        port_name = owner_port["ownerPortOperation"]
        counts["ownerPortsChecked"] += 1
        for selector in owner_port.get("selectors", []):
            table = str(selector.get("targetTable", ""))
            if table.startswith(("OWNER_PORT::", "AUTH_OWNER_PORT::")):
                continue
            if table in columns:
                require_table_column(
                    port_name + ".selector", table,
                    str(selector.get("targetColumn", "")),
                )
        for step in owner_port.get("orderedDml", []):
            table = str(step.get("table", ""))
            if not table or table.startswith(("OWNER_PORT::", "AUTH_OWNER_PORT::")):
                continue
            if table not in columns:
                errors.append(f"{port_name}.orderedDml: unknown table {table}")
                continue
            for column_name in step.get("assignments", {}):
                counts["dmlAssignmentsChecked"] += 1
                require_table_column(port_name + ".orderedDml", table, column_name)
            require_insert_columns(port_name + ".orderedDml", step)
        for field_name, source in owner_port.get("responseFieldSources", {}).items():
            source = str(source)
            candidates: list[str] = []
            if source.startswith("SIGNED_PROJECTION:"):
                candidates = source.removeprefix("SIGNED_PROJECTION:").split("+")
            else:
                candidate = source.split(" IF ", 1)[0]
                if re.fullmatch(r"[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*", candidate):
                    candidates = [candidate]
            for candidate in candidates:
                counts["ownerPortResponseSourcesChecked"] += 1
                if "." in candidate:
                    table, column_name = candidate.split(".", 1)
                    require_table_column(
                        f"{port_name}.responseFieldSources.{field_name}", table, column_name,
                    )
                elif candidate not in tables:
                    errors.append(
                        f"{port_name}.responseFieldSources.{field_name}: unknown projection table {candidate}"
                    )

    counts["mismatches"] = len(errors)
    if errors:
        raise ValueError(
            "operation/handler physical closure mismatch (first 20):\n" +
            "\n".join(errors[:20])
        )
    return counts


def _validate_generated_response_source_columns(exact: dict[str, Any]) -> int:
    """Resolve every generated physical response source to an exact column."""
    common = {
        row["name"] for row in exact["commonTableContract"]["columns"]
        if row["name"] != "__internal_id__"
    }
    columns = {
        table["tableName"]: common
        | {table["idColumn"]["name"]}
        | {row["name"] for row in table.get("columns", [])}
        for table in exact["tableSpecifications"]
    }
    checked = 0

    def check(label: str, source: Any) -> None:
        nonlocal checked
        if not isinstance(source, str):
            return
        normalized = re.sub(
            r"^(?:STATE_WINNER:|CONTENT_WINNER:|SELECTED_STATE_ROW:|CONTENT_ROW:|SELECTED_CONTENT_ROW:)",
            "", source,
        )
        normalized = re.sub(
            r"^DERIVED:NEXT_SYSTEM_ASOF_VISIBLE_BASE(?:_FOR_SELECTED_(?:STATE|CONTENT)_SEGMENT)?:",
            "", normalized,
        )
        match = re.fullmatch(r"([a-z][a-z0-9_]*)\.([a-z][a-z0-9_]*)", normalized)
        if not match:
            return
        checked += 1
        table_name, column_name = match.groups()
        if table_name not in columns or column_name not in columns[table_name]:
            raise ValueError(
                f"generated response source column absent: {label} -> {source}"
            )

    for schema in exact.get("recordSchemas", []):
        for field in schema.get("fields", []):
            check(schema["schemaId"] + "." + field.get("name", "?"), field.get("sourcePath"))
            for mode, source in field.get("selectionModeSources", {}).items():
                check(
                    schema["schemaId"] + "." + field.get("name", "?") + "." + mode,
                    source,
                )
    for lineage in exact.get("operationFieldLineage", []):
        if lineage.get("mode") != "QUERY":
            continue
        for field in lineage.get("responseFieldSources", []):
            check(lineage["operationId"] + "." + field.get("target", "?"), field.get("sourcePath"))
            for mode, source in field.get("selectionModeSources", {}).items():
                check(
                    lineage["operationId"] + "." + field.get("target", "?")
                    + "." + mode,
                    source,
                )
    return checked


def _compose_event_contract(
    ssot: dict[str, Any], manifest: dict[str, Any], listening_design: dict[str, Any],
    source_events: dict[str, Any],
) -> dict[str, Any]:
    """Rebuild the event projection from the operation SSOT as a fixed point."""
    event_contract = copy.deepcopy(source_events)
    schemas = []
    for operation in ssot["operations"]:
        for event in operation.get("events", []):
            schemas.append(_event_schema(
                event, operation["operationId"], operation["capabilityId"],
                operation["session"], False,
            ))
    for handler in ssot["systemHandlers"]:
        if handler.get("event"):
            schemas.append(_event_schema(
                handler["event"], handler["handlerId"], handler["capabilityId"],
                handler["session"], True,
            ))
        for additional_event in handler.get("additionalEvents", []):
            schemas.append(_event_schema(
                additional_event, handler["handlerId"], handler["capabilityId"],
                handler["session"], True,
            ))
    if len(schemas) != len({row["eventName"] for row in schemas}):
        raise ValueError("event schema producer identity is not unique")
    event_contract["eventPayloadSchemas"] = sorted(
        schemas, key=lambda row: row["eventName"]
    )
    event_contract["internalEventHandlers"] = copy.deepcopy(ssot["systemHandlers"])
    message_type_overrides = {
        "questionDefinitions": "ARRAY", "measureValues": "ARRAY",
        "subjectCount": "INTEGER", "anonymityThreshold": "INTEGER",
        "epsilonMicros": "BIGINT", "privacyBudgetCapEpsilonMicros": "BIGINT",
        "measureDefinitionDigest": "SHA256",
        "privacyBudgetReceiptPublicId": "UUID", "adequacyCategory": "STRING",
        "formArtifactSchemaVersion": "STRING", "measureSchemaVersion": "STRING",
    }
    event_contract["ownerPortMessageSchemas"] = [{
        "messageName": message["messageName"], "additionalProperties": False,
        "sourceStreamKey": message["from"], "targetStreamKey": message["to"],
        "deliveryClass": "SIGNED_INTERNAL_OWNER_PORT_MESSAGE",
        "envelopeAuth": copy.deepcopy(message["envelopeAuth"]),
        "fields": [{
            "name": field,
            "type": message_type_overrides.get(
                field,
                "UUID" if field.endswith(("PublicId", "Id")) else
                "SHA256" if field.endswith(("Sha256", "Digest")) else
                "TIMESTAMPTZ" if field.endswith(("At", "Epoch")) else
                "BIGINT" if field.endswith(("Revision", "Version")) else "STRING",
            ),
            "required": True,
        } for field in message["fieldAllowlist"]],
    } for message in listening_design["eventOwnership"]["internalPortMessages"]]
    cohort_ingest_contract = next(
        row for row in ssot["ownerPortOperationContracts"]
        if row["ownerPortOperation"] == "insights.ingestCohortPackage"
    )
    cohort_ingest_fields = {
        row["name"]: row
        for row in cohort_ingest_contract["requestSchema"]["fields"]
    }
    ready_message = next(
        row for row in event_contract["ownerPortMessageSchemas"]
        if row["messageName"] == "ListeningCohortPackageReady.v1"
    )
    for field in ready_message["fields"]:
        canonical = cohort_ingest_fields.get(field["name"])
        if canonical:
            field.update(copy.deepcopy(canonical))
    ready_message["crossFieldRules"] = [
        "ADEQUATE requires subjectCount>=anonymityThreshold and non-empty typed measureValues",
        "SUPPRESSED forbids subjectCount and measureValues; package digest cannot encode exact sub-threshold count",
    ]
    event_contract["privateReceiptSchemas"] = [{
        "receiptName": name,
        "deliveryClass": "OWNER_LOCAL_PRIVATE_BROKER_FORBIDDEN",
    } for name in listening_design["eventOwnership"]["privateReceiptOnly"]]
    event_contract["scope"] = {
        "operations": manifest["scope"]["operations"],
        "commands": manifest["scope"]["commands"],
        "queries": manifest["scope"]["queries"],
        "events": len(schemas),
        "internalConsumerHandlers": len(ssot["systemHandlers"]),
        "ownerPortMessageSchemas": len(event_contract["ownerPortMessageSchemas"]),
        "privateReceiptSchemas": len(event_contract["privateReceiptSchemas"]),
        "implementationState": "NOT_STARTED_G3",
        "productionState": "NOT_AUTHORIZED_G6",
    }
    event_contract["closedSetManifest"] = copy.deepcopy(ssot["closedSetManifest"])
    event_contract["policies"] = {
        "durableBusinessSourceAllowlist": [
            "PHYSICAL_POST_STATE", "LOCKED_PRE_STATE", "IMMUTABLE_OWNER_PROOF",
        ],
        "transientOwnerRefetchOrAckInPayload": "FORBIDDEN",
        "restartReplay": "BYTE_IDENTICAL_FROM_DURABLE_FACTS",
        "rawListeningResponseEvent": "FORBIDDEN",
    }
    stamp_canonical_document(event_contract, "eventPayloads")
    return event_contract


def _validate_true_positive_exact_query_lineage(
    ssot: dict[str, Any], exact: dict[str, Any],
) -> None:
    """Bind executable child reads to exact response schema/lineage rows."""

    operations = {row["operationId"]: row for row in ssot.get("operations", [])}
    bindings = {
        row["operationId"]: row for row in exact.get("operationBindings", [])
    }
    schemas = {row["schemaId"]: row for row in exact.get("recordSchemas", [])}
    lineages = {
        row["operationId"]: row
        for row in exact.get("operationFieldLineage", [])
    }
    columns = {
        row["tableName"]: {column["name"] for column in row.get("columns", [])}
        for row in exact.get("tableSpecifications", [])
    }
    for operation_id, expected_contracts in QUERY_CHILD_READ_CONTRACTS.items():
        operation = operations.get(operation_id, {})
        binding = bindings.get(operation_id, {})
        read_plan = operation.get("readPlan", {})
        read_tables = set(read_plan.get("tables", []))
        physical_sources = set(
            read_plan.get("projectionTuple", {}).get("physicalSources", [])
        )
        if read_plan.get("joinContracts") != list(expected_contracts):
            raise ValueError(f"exact query join contract drift: {operation_id}")
        if set(binding.get("readsTables", [])) != read_tables:
            raise ValueError(f"exact query executable read binding drift: {operation_id}")
        schema = schemas.get(operation_id + ".Entity.v3", {})
        fields = {
            row.get("name"): row for row in schema.get("fields", [])
            if row.get("name")
        }
        response_schema = binding.get("responseSchemaRef", "")
        record_path = (
            "item" if re.search(r"\{[^}]+\}$", str(binding.get("path", "")))
            else "items[*]"
        )
        lineage_rows = lineages.get(operation_id, {}).get(
            "responseFieldSources", []
        )
        lineage_by_target: dict[str, list[dict[str, Any]]] = {}
        for row in lineage_rows:
            lineage_by_target.setdefault(str(row.get("target", "")), []).append(row)
        for contract in expected_contracts:
            child_table = contract["childTable"]
            if child_table not in read_tables or child_table not in physical_sources:
                raise ValueError(f"exact child source is not executable: {operation_id}")
            if not str(contract.get("selectionRule", "")).endswith(
                "LATEST_MAX_FALLBACK_FORBIDDEN"
            ):
                raise ValueError(f"exact child query permits latest fallback: {operation_id}")
            for field_name, source_path in contract["fieldSources"].items():
                table_name, column_name = source_path.split(".", 1)
                if table_name != child_table or column_name not in columns.get(table_name, set()):
                    raise ValueError(
                        f"exact child response source column drift: "
                        f"{operation_id}.{field_name}"
                    )
                field = fields.get(field_name, {})
                field_policy = field.get("fieldPolicy", {})
                if (
                    field.get("sourcePath") != source_path
                    or field.get("required") is not False
                    or field_policy.get("authorizationCapability")
                    != operation.get("authorizationCapability")
                    or field_policy.get("behavior")
                    != "ALLOW_OR_OMIT_OR_TOKENIZE_EXACT_FIELD"
                    or field_policy.get("unknownField") != "OMIT"
                    or field_policy.get("denyOnUnavailable") is not True
                ):
                    raise ValueError(
                        f"exact child response field/policy drift: "
                        f"{operation_id}.{field_name}"
                    )
                target = f"{response_schema}.{record_path}.{field_name}"
                expected_lineage = {
                    "target": target,
                    "sourcePath": source_path,
                    "sourceKind": "PHYSICAL_POST_STATE",
                }
                if lineage_by_target.get(target) != [expected_lineage]:
                    raise ValueError(
                        f"exact child response lineage drift: "
                        f"{operation_id}.{field_name}"
                    )


def _run_true_positive_exact_query_hostile_selftests(
    ssot: dict[str, Any], exact: dict[str, Any],
) -> None:
    """Prove the source oracle rejects each reviewed G01/G10 bypass."""

    first_operation_id = sorted(QUERY_CHILD_READ_CONTRACTS)[0]
    last_operation_id = sorted(QUERY_CHILD_READ_CONTRACTS)[-1]

    def operation(value: dict[str, Any], operation_id: str) -> dict[str, Any]:
        return next(
            row for row in value["operations"]
            if row["operationId"] == operation_id
        )

    mutations = []

    def missing_read_table(ssot_value: dict[str, Any], _: dict[str, Any]) -> None:
        row = operation(ssot_value, first_operation_id)
        child = row["readPlan"]["joinContracts"][0]["childTable"]
        row["readPlan"]["tables"].remove(child)

    mutations.append(("missing-read-table", missing_read_table))

    def missing_physical_source(ssot_value: dict[str, Any], _: dict[str, Any]) -> None:
        row = operation(ssot_value, last_operation_id)
        child = row["readPlan"]["joinContracts"][0]["childTable"]
        row["readPlan"]["projectionTuple"]["physicalSources"].remove(child)

    mutations.append(("missing-physical-source", missing_physical_source))

    def tenant_join_relaxed(ssot_value: dict[str, Any], _: dict[str, Any]) -> None:
        operation(ssot_value, first_operation_id)["readPlan"]["joinContracts"][0][
            "tenantPredicate"
        ] = "child.tenant_id IS NOT NULL"

    mutations.append(("tenant-join-relaxed", tenant_join_relaxed))

    def wrong_source_column(_: dict[str, Any], exact_value: dict[str, Any]) -> None:
        contract = QUERY_CHILD_READ_CONTRACTS[last_operation_id][0]
        field_name = sorted(contract["fieldSources"])[0]
        schema = next(
            row for row in exact_value["recordSchemas"]
            if row["schemaId"] == last_operation_id + ".Entity.v3"
        )
        next(
            row for row in schema["fields"] if row["name"] == field_name
        )["sourcePath"] = contract["childTable"] + ".latest_value"

    mutations.append(("wrong-source-column", wrong_source_column))

    def latest_fallback_enabled(ssot_value: dict[str, Any], _: dict[str, Any]) -> None:
        operation(ssot_value, last_operation_id)["readPlan"]["joinContracts"][0][
            "selectionRule"
        ] = "MAX_CREATED_AT_LATEST_FALLBACK_ALLOWED"

    mutations.append(("latest-fallback-enabled", latest_fallback_enabled))

    undetected = []
    for name, mutate in mutations:
        hostile_ssot = copy.deepcopy(ssot)
        hostile_exact = copy.deepcopy(exact)
        mutate(hostile_ssot, hostile_exact)
        try:
            _validate_true_positive_exact_query_lineage(hostile_ssot, hostile_exact)
        except ValueError:
            continue
        undetected.append(name)
    if undetected:
        raise ValueError(
            "true-positive exact query hostile selftests undetected: "
            + ", ".join(undetected)
        )


def compose_exact_from_ssot(
    before: dict[str, Any],
    ssot: dict[str, Any],
    manifest: dict[str, Any],
    *,
    source_events: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, Any]]:
    listening_design = build_static_design()
    if (
        before.get("sourceProjectionVersion") == EXACT_SUCCESSOR_PROJECTION_VERSION
        and before.get("closedSetManifest", {}).get("manifestId")
        == manifest["manifestId"]
        and before.get("listeningCanonicalComposition")
        == composition_marker("exactSchemas")
    ):
        exact = copy.deepcopy(before)
        _validate_true_positive_exact_query_lineage(ssot, exact)
        _run_true_positive_exact_query_hostile_selftests(ssot, exact)
        return exact, _compose_event_contract(
            ssot, manifest, listening_design, source_events,
        )
    if (
        before.get("sourceProjectionVersion")
        == PREVIOUS_EXACT_SUCCESSOR_PROJECTION_VERSION
        and before.get("closedSetManifest", {}).get("manifestId")
        == manifest["manifestId"]
        and before.get("listeningCanonicalComposition")
        == composition_marker("exactSchemas")
    ):
        exact = copy.deepcopy(before)
        exact["ownerDependencyContracts"] = copy.deepcopy(
            ssot["ownerDependencyContracts"]
        )
        exact.setdefault("scope", {})["ownerDependencyContracts"] = len(
            ssot["ownerDependencyContracts"]
        )
        exact["closedSetManifest"] = copy.deepcopy(ssot["closedSetManifest"])
        exact["sourceProjectionVersion"] = EXACT_SUCCESSOR_PROJECTION_VERSION
        stamp_canonical_document(exact, "exactSchemas")
        _validate_true_positive_exact_query_lineage(ssot, exact)
        _run_true_positive_exact_query_hostile_selftests(ssot, exact)
        return exact, _compose_event_contract(
            ssot, manifest, listening_design, source_events,
        )
    exact = copy.deepcopy(before)
    exact["tableSpecifications"] = _normalize_tables(before, manifest)
    listening_table_stream = {
        row["tableName"]: row["streamKey"]
        for row in listening_design["tableOwnership"]
    }
    listening_streams = {
        row["streamKey"]: row for row in listening_design["authorityStreams"]
    }
    default_owner = {
        "HRIS-HRM": ("PFX-HRM-PEOPLE", "public", "dwp-people-server"),
        "HRIS-PER": ("PFX-PER-PERFORMANCE", "hris_performance", "dwp-people-server"),
        "HRIS-TIM": ("PFX-TIM-TIME", "public", "dwp-time-server"),
    }
    for table in exact["tableSpecifications"]:
        table_name = table["tableName"]
        if table_name in listening_table_stream:
            stream_key = listening_table_stream[table_name]
            stream = listening_streams[stream_key]
            table.update({
                "streamKey": stream_key,
                "ownerBindingId": LISTENING_OWNER_BINDING_BY_STREAM[stream_key],
                "physicalSchema": stream["databaseSchema"],
                "ownerService": stream["ownerService"],
            })
        elif table["session"] in default_owner:
            binding, schema, service = default_owner[table["session"]]
            table.update({
                "streamKey": binding, "ownerBindingId": binding,
                "physicalSchema": schema, "ownerService": service,
            })
        elif table["capabilityId"] == "HRIS.MODERN.GOVERNED_AI":
            table.update({
                "streamKey": "PFX-SYS-CONFIGURATION",
                "ownerBindingId": "PFX-SYS-CONFIGURATION",
                "physicalSchema": "hris_configuration",
                "ownerService": "dwp-platform-server",
            })
        elif table["capabilityId"] == "HRIS.MODERN.PEOPLE_ANALYTICS":
            table.update({
                "streamKey": "PFX-SYS-INSIGHTS",
                "ownerBindingId": "PFX-SYS-INSIGHTS",
                "physicalSchema": "hris_insights",
                "ownerService": "dwp-platform-server",
            })
        else:
            raise ValueError(f"owner/schema binding unresolved: {table_name}")
    exact["ownerBoundaryInputs"] = copy.deepcopy(manifest["ownerBoundaryInputs"])
    exact["physicalClosureValidation"] = _validate_ssot_physical_closure(ssot, exact)
    table_ids = {row["tableName"] for row in exact["tableSpecifications"]}
    bindings = [_operation_binding(row, table_ids) for row in ssot["operations"]]
    exact["operationBindings"] = bindings
    exact["operationFieldLineage"] = [
        _lineage(operation, binding)
        for operation, binding in zip(ssot["operations"], bindings)
    ]
    record_schemas = []
    response_schemas = []
    for operation, binding in zip(ssot["operations"], bindings):
        root = binding.get("aggregateRootTable") or binding["readsTables"][0]
        record_schemas.extend([_record_schema(operation, root), _child_schema(operation)])
        response_schema = _response_schema(operation, root, operation["mode"] == "COMMAND")
        if operation.get("responseContract"):
            if operation["responseContract"].get("responseSchema") != response_schema:
                raise ValueError(
                    f"public owner-port/exact response schema drift: {operation['operationId']}"
                )
            response_prefix = operation["operationId"] + ".Response.v3."
            expected_response_names = {
                field["name"] for field in response_schema["fields"]
            }
            lineage_sources = {
                name: next(
                    row["sourcePath"]
                    for row in _lineage(operation, binding)["responseFieldSources"]
                    if row["target"] == response_prefix + name
                )
                for name in expected_response_names
            }
            if operation["responseContract"].get("responseFieldSources") != lineage_sources:
                raise ValueError(
                    f"public owner-port/exact response lineage drift: {operation['operationId']}"
                )
        response_schemas.append(response_schema)
    exact["recordSchemas"] = record_schemas
    exact["responseSchemas"] = response_schemas
    exact["internalConsumerHandlers"] = copy.deepcopy(ssot["systemHandlers"])
    exact["ownerPortOperationContracts"] = copy.deepcopy(
        ssot["ownerPortOperationContracts"]
    )
    exact["ownerDependencyContracts"] = copy.deepcopy(
        ssot["ownerDependencyContracts"]
    )
    exact["ownerPortSchemas"] = sorted(
        [
            {
                "ownerPortOperation": row["ownerPortOperation"],
                "streamKey": row["streamKey"],
                "requestSchema": copy.deepcopy(row["requestSchema"]),
                "responseSchema": copy.deepcopy(row["responseSchema"]),
                "responseFieldSources": copy.deepcopy(row["responseFieldSources"]),
                "responseExecutionBinding": copy.deepcopy(row["responseExecutionBinding"]),
                "selectors": copy.deepcopy(row["selectors"]),
                "orderedDml": copy.deepcopy(row["orderedDml"]),
                "pep": copy.deepcopy(row["pep"]),
                "receiptAndOutbox": copy.deepcopy(row["receiptAndOutbox"]),
            }
            for row in ssot["ownerPortOperationContracts"]
        ],
        key=lambda row: row["ownerPortOperation"],
    )
    exact["scope"].update({
        "operations": manifest["scope"]["operations"],
        "commands": manifest["scope"]["commands"],
        "queries": manifest["scope"]["queries"],
        "tableSpecifications": manifest["scope"]["tableSpecifications"],
        "physicalTables": len(exact["tableSpecifications"]),
        "internalConsumerHandlers": len(ssot["systemHandlers"]),
        "ownerPortOperationContracts": len(ssot["ownerPortOperationContracts"]),
        "ownerDependencyContracts": len(ssot["ownerDependencyContracts"]),
        "ownerPortSchemas": len(exact["ownerPortSchemas"]),
        "responseSchemas": len(response_schemas),
        "implementationState": "NOT_STARTED_G3", "productionState": "NOT_AUTHORIZED_G6",
    })
    exact["policies"].update({
        "closedResponseSourceAllowlist": ["PHYSICAL_POST", "SEALED_COMMAND_RECEIPT", "IMMUTABLE_PROOF"],
        "queryProjectionTuple": "operation+response+entity+physicalSource+PEP+purpose+population+fieldPolicy+asOf+freshness+cursor",
        "identityColumnExhaustion": "EVERY_REFERENCE_LIKE_COLUMN_EXACTLY_ONE_OF_PK_CONTROL_LOCAL_FK_TYPED_OWNER_REF",
        "digestUnique": "ZERO_EXCEPT_PROTECTED_LISTENING_TOKEN_COMMITMENT",
    })
    exact["physicalClosureValidation"]["generatedResponseSourcesChecked"] = (
        _validate_generated_response_source_columns(exact)
    )
    exact["closedSetManifest"] = copy.deepcopy(ssot["closedSetManifest"])
    exact["sourceProjectionVersion"] = EXACT_SUCCESSOR_PROJECTION_VERSION
    stamp_canonical_document(exact, "exactSchemas")

    event_contract = copy.deepcopy(source_events)
    schemas = []
    for operation in ssot["operations"]:
        for event in operation.get("events", []):
            schemas.append(_event_schema(event, operation["operationId"],
                                         operation["capabilityId"], operation["session"], False))
    for handler in ssot["systemHandlers"]:
        if handler.get("event"):
            schemas.append(_event_schema(handler["event"], handler["handlerId"],
                                         handler["capabilityId"], handler["session"], True))
        for additional_event in handler.get("additionalEvents", []):
            schemas.append(_event_schema(additional_event, handler["handlerId"],
                                         handler["capabilityId"], handler["session"], True))
    if len(schemas) != len({row["eventName"] for row in schemas}):
        raise ValueError("event schema producer identity is not unique")
    event_contract["eventPayloadSchemas"] = sorted(schemas, key=lambda row: row["eventName"])
    event_contract["internalEventHandlers"] = copy.deepcopy(ssot["systemHandlers"])
    message_type_overrides = {
        "questionDefinitions": "ARRAY", "measureValues": "ARRAY",
        "subjectCount": "INTEGER", "anonymityThreshold": "INTEGER",
        "epsilonMicros": "BIGINT", "privacyBudgetCapEpsilonMicros": "BIGINT",
        "measureDefinitionDigest": "SHA256",
        "privacyBudgetReceiptPublicId": "UUID", "adequacyCategory": "STRING",
        "formArtifactSchemaVersion": "STRING", "measureSchemaVersion": "STRING",
    }
    event_contract["ownerPortMessageSchemas"] = [
        {
            "messageName": message["messageName"], "additionalProperties": False,
            "sourceStreamKey": message["from"], "targetStreamKey": message["to"],
            "deliveryClass": "SIGNED_INTERNAL_OWNER_PORT_MESSAGE",
            "envelopeAuth": copy.deepcopy(message["envelopeAuth"]),
            "fields": [
                {
                    "name": field,
                    "type": message_type_overrides.get(
                        field,
                        "UUID" if field.endswith(("PublicId", "Id")) else
                        "SHA256" if field.endswith(("Sha256", "Digest")) else
                        "TIMESTAMPTZ" if field.endswith(("At", "Epoch")) else
                        "BIGINT" if field.endswith(("Revision", "Version")) else "STRING",
                    ),
                    "required": True,
                }
                for field in message["fieldAllowlist"]
            ],
        }
        for message in listening_design["eventOwnership"]["internalPortMessages"]
    ]
    cohort_ingest_contract = next(
        row for row in ssot["ownerPortOperationContracts"]
        if row["ownerPortOperation"] == "insights.ingestCohortPackage"
    )
    cohort_ingest_fields = {
        row["name"]: row for row in cohort_ingest_contract["requestSchema"]["fields"]
    }
    ready_message = next(
        row for row in event_contract["ownerPortMessageSchemas"]
        if row["messageName"] == "ListeningCohortPackageReady.v1"
    )
    for field in ready_message["fields"]:
        canonical = cohort_ingest_fields.get(field["name"])
        if canonical:
            field.update(copy.deepcopy(canonical))
    ready_message["crossFieldRules"] = [
        "ADEQUATE requires subjectCount>=anonymityThreshold and non-empty typed measureValues",
        "SUPPRESSED forbids subjectCount and measureValues; package digest cannot encode exact sub-threshold count",
    ]
    event_contract["privateReceiptSchemas"] = [
        {"receiptName": name, "deliveryClass": "OWNER_LOCAL_PRIVATE_BROKER_FORBIDDEN"}
        for name in listening_design["eventOwnership"]["privateReceiptOnly"]
    ]
    event_contract["scope"] = {
        "operations": manifest["scope"]["operations"],
        "commands": manifest["scope"]["commands"],
        "queries": manifest["scope"]["queries"],
        "events": len(schemas), "internalConsumerHandlers": len(ssot["systemHandlers"]),
        "ownerPortMessageSchemas": len(event_contract["ownerPortMessageSchemas"]),
        "privateReceiptSchemas": len(event_contract["privateReceiptSchemas"]),
        "implementationState": "NOT_STARTED_G3", "productionState": "NOT_AUTHORIZED_G6",
    }
    event_contract["closedSetManifest"] = copy.deepcopy(ssot["closedSetManifest"])
    event_contract["policies"] = {
        "durableBusinessSourceAllowlist": ["PHYSICAL_POST_STATE", "LOCKED_PRE_STATE", "IMMUTABLE_OWNER_PROOF"],
        "transientOwnerRefetchOrAckInPayload": "FORBIDDEN",
        "restartReplay": "BYTE_IDENTICAL_FROM_DURABLE_FACTS",
        "rawListeningResponseEvent": "FORBIDDEN",
    }
    stamp_canonical_document(event_contract, "eventPayloads")
    # Keep one source of truth for event projection so predecessor and
    # successor exact inputs produce byte-identical event contracts.
    event_contract = _compose_event_contract(
        ssot, manifest, listening_design, source_events,
    )
    _validate_true_positive_exact_query_lineage(ssot, exact)
    _run_true_positive_exact_query_hostile_selftests(ssot, exact)
    return exact, event_contract


def compose_exact(
    before: dict[str, Any],
    predecessor_ssot: dict[str, Any],
    manifest: dict[str, Any],
    *,
    source_events: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, Any]]:
    return compose_exact_from_ssot(
        before, compose_operation_ssot(predecessor_ssot, manifest), manifest,
        source_events=source_events,
    )


def _canonical_document_sha256(value: dict[str, Any]) -> str:
    return hashlib.sha256(render(value).encode("utf-8")).hexdigest()


def _sealed_payload_sha256(value: dict[str, Any]) -> str:
    payload = {
        key: item for key, item in value.items()
        if key != "sealedPayloadSha256"
    }
    encoded = json.dumps(
        payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _registry_core_sha256(value: dict[str, Any]) -> str:
    payload = {
        key: item for key, item in value.items()
        if key not in {"sealedPayloadSha256", "canonicalContractPins"}
    }
    encoded = json.dumps(
        payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _apply_and_validate_registry_overlay(
    expected_exact: dict[str, Any],
    expected_events: dict[str, Any],
    exact: dict[str, Any],
    events: dict[str, Any],
    semantic: dict[str, Any] | None,
    identities: dict[str, Any] | None,
    allow_source_registry_overlay: bool,
) -> None:
    """Bind the exact/event oracle to the independently sealed registries.

    The canonical-five composer adds reciprocal registry metadata after the
    exact/event projection is built.  Validation must reproduce that overlay
    from the registry bytes; copying the candidate's pins would make a pin
    mutation self-certifying.
    """
    reciprocal_keys = {
        "semanticBindingRegistry", "publicIdentityRegistry",
        "independentRegistryCorePins",
    }
    has_overlay = bool(reciprocal_keys & set(exact)) or (
        "independentRegistryCorePins" in events
    )
    if semantic is None or identities is None:
        if semantic is not None or identities is not None:
            raise ValueError("semantic and identity registries must be supplied together")
        if has_overlay and not allow_source_registry_overlay:
            raise ValueError(
                "reciprocal registry-enriched exact/event validation requires "
                "explicit semantic and identity registry inputs"
            )
        return

    for registry, expected_id in (
        (semantic, "dwp.hris.modern.operation-semantic-bindings.v1"),
        (identities, "dwp.hris.modern.public-identities.v1"),
    ):
        if registry.get("registryId") != expected_id:
            raise ValueError(f"registry identity drift: {expected_id}")
        if registry.get("sealedPayloadSha256") != _sealed_payload_sha256(registry):
            raise ValueError(f"registry sealed payload drift: {expected_id}")

    core_pins = {
        BINDINGS.name: _registry_core_sha256(semantic),
        IDENTITIES.name: _registry_core_sha256(identities),
    }
    expected_refs = {
        "semanticBindingRegistry": {
            "registryId": semantic["registryId"],
            "schemaVersion": semantic["schemaVersion"],
            "path": BINDINGS.name,
            "status": semantic["status"],
        },
        "publicIdentityRegistry": {
            "registryId": identities["registryId"],
            "schemaVersion": identities["schemaVersion"],
            "path": IDENTITIES.name,
            "status": identities["status"],
        },
    }
    expected_exact.update(copy.deepcopy(expected_refs))
    expected_exact["independentRegistryCorePins"] = dict(sorted(core_pins.items()))
    expected_events["independentRegistryCorePins"] = dict(sorted(core_pins.items()))

    canonical_pins = {
        EXACT.name: _canonical_document_sha256(exact),
        EVENTS.name: _canonical_document_sha256(events),
    }
    if semantic.get("canonicalContractPins") != canonical_pins:
        raise ValueError("semantic registry exact/event reciprocal byte pins drift")
    if identities.get("canonicalContractPins") != canonical_pins:
        raise ValueError("identity registry exact/event reciprocal byte pins drift")


def _validate_compensation_snapshot_approval_source(
    exact: dict[str, Any], events: dict[str, Any],
) -> None:
    """Require the frozen approval proof rather than a caller supplied UUID."""
    operation_id = "modern.compplan.snapshot.publish"
    operation = next(
        row for row in exact["operationBindings"]
        if row["operationId"] == operation_id
    )
    request_names = {
        field["name"] for field in operation["requestSchema"]["body"]
    }
    if "approvalReceiptId" in request_names:
        raise ValueError(
            "compensation snapshot publish must use the locked approved-plan "
            "proof, not caller approvalReceiptId"
        )

    expected_sources = {
        "approval_receipt_public_id":
            "LOCKED_PRE:prf_cmp_plans.approval_receipt_public_id",
        "approval_receipt_revision":
            "LOCKED_PRE:prf_cmp_plans.approval_receipt_revision",
        "approval_outcome": "LOCKED_PRE:prf_cmp_plans.approval_outcome",
        "approval_action": "LOCKED_PRE:prf_cmp_plans.approval_action",
        "approval_input_digest":
            "LOCKED_PRE:prf_cmp_plans.approval_input_digest",
        "approval_purpose_code":
            "LOCKED_PRE:prf_cmp_plans.approval_purpose_code",
        "approval_tenant_id":
            "LOCKED_PRE:prf_cmp_plans.approval_tenant_id",
    }
    lineage = next(
        row for row in exact["operationFieldLineage"]
        if row["operationId"] == operation_id
    )
    mutation_sources = {
        row["target"]: row["sourcePath"]
        for row in lineage["mutationFieldSources"]
    }
    for column, source in expected_sources.items():
        target = "prf_cmp_approved_snapshots." + column
        if mutation_sources.get(target) != source:
            raise ValueError(
                f"compensation frozen approval proof source drift: {target}"
            )

    event = next(
        row for row in events["eventPayloadSchemas"]
        if row["eventName"] == "ApprovedCompensationPlanSnapshotPublished.v2"
    )
    event_fields = {row["name"]: row for row in event["fields"]}
    approval_event = event_fields.get("approvalReceiptId")
    if (
        approval_event is None
        or approval_event.get("sourceKind") != "IMMUTABLE_OWNER_PROOF"
        or approval_event.get("source")
        != "prf_cmp_approved_snapshots.approval_receipt_public_id"
    ):
        raise ValueError("compensation approvalReceiptId durable event source drift")


def _validate_listening_signature_contracts(exact: dict[str, Any]) -> None:
    """Keep authority wire rules and all seven persisted signatures inseparable."""
    design = build_static_design()
    expected_profile = {
        "serialization": LISTENING_SIGNATURE_SERIALIZATION,
        "maxBytes": LISTENING_SIGNATURE_MAX_BYTES,
        "allowedAlgorithms": list(LISTENING_SIGNATURE_ALGORITHMS),
        "ed25519Encoding": "RAW_FIXED_64_BYTE_SIGNATURE",
        "ecdsaP256Encoding": "IEEE_P1363_FIXED_64_BYTE_R_CONCAT_S;ASN1_DER_FORBIDDEN",
        "algorithmMaxBytes": LISTENING_SIGNATURE_ALGORITHM_MAX_BYTES,
        "algorithmValidation": "ED25519|ECDSA_P256_SHA256",
    }
    if design.get("signatureProfile") != expected_profile:
        raise ValueError("Listening static signature profile drift")

    typed_fields: list[dict[str, Any]] = []

    def visit(value: Any) -> None:
        if isinstance(value, list):
            for item in value:
                visit(item)
        elif isinstance(value, dict):
            if value.get("type") == "STRING" and value.get("name") in {
                "ownerSignature", "signature", "signatureAlgorithm", "alg", "algorithm",
            }:
                typed_fields.append(value)
            for child in value.values():
                visit(child)

    visit(design)
    for field in typed_fields:
        if field["name"] in {"ownerSignature", "signature"}:
            expected = {
                "serialization": LISTENING_SIGNATURE_SERIALIZATION,
                "maxBytes": LISTENING_SIGNATURE_MAX_BYTES,
                "allowedAlgorithms": list(LISTENING_SIGNATURE_ALGORITHMS),
                "ed25519Encoding": "RAW_FIXED_64_BYTE_SIGNATURE",
                "ecdsaEncoding": "IEEE_P1363_FIXED_64_BYTE_R_CONCAT_S;ASN1_DER_FORBIDDEN",
                "validation": (
                    "BASE64URL_UNPADDED_P1363_FIXED_64_BYTE_SIGNATURE;"
                    "ED25519|ECDSA_P256_SHA256"
                ),
            }
        else:
            expected = {
                "maxBytes": 17,
                "allowedValues": list(LISTENING_SIGNATURE_ALGORITHMS),
                "validation": "ED25519|ECDSA_P256_SHA256",
            }
        if any(field.get(key) != value for key, value in expected.items()):
            raise ValueError(f"Listening authority signature field drift: {field['name']}")

    tables = {
        row["tableName"]: row for row in exact["tableSpecifications"]
    }
    expected_signature_fields = {
        "sys_hris_listening_operation_receipts": {"owner_signature": True},
        "sys_hris_listening_protected_receipts": {"owner_signature": True},
        "sys_hris_listening_insights_inbox": {"owner_signature": True},
        "sys_hris_listening_domain_outbox": {"owner_signature": True},
        "sys_hris_listening_protected_outbox": {"owner_signature": True},
        "sys_hris_listening_insights_outbox": {"owner_signature": True},
        "sys_hris_listening_token_issuances": {"credential_signature": False},
    }
    observed_signature_fields = 0
    for table_name, field_expectations in expected_signature_fields.items():
        table = tables.get(table_name)
        if table is None:
            raise ValueError(f"Listening signature table missing: {table_name}")
        columns = {row["name"]: row for row in table.get("columns", [])}
        for column_name, nullable in field_expectations.items():
            column_value = columns.get(column_name)
            expected_column = {
                "sqlType": "VARCHAR(86)",
                "nullable": nullable,
                "serialization": LISTENING_SIGNATURE_SERIALIZATION,
                "maxBytes": LISTENING_SIGNATURE_MAX_BYTES,
                "allowedAlgorithms": list(LISTENING_SIGNATURE_ALGORITHMS),
            }
            if column_value is None or any(
                column_value.get(key) != value
                for key, value in expected_column.items()
            ):
                raise ValueError(
                    f"Listening signature physical storage drift: "
                    f"{table_name}.{column_name}"
                )
            observed_signature_fields += 1
        algorithm_column = (
            "algorithm" if table_name == "sys_hris_listening_token_issuances"
            else "signature_algorithm"
        )
        algorithm_value = columns.get(algorithm_column)
        if algorithm_value is None or any(
            algorithm_value.get(key) != value
            for key, value in {
                "sqlType": f"VARCHAR({LISTENING_SIGNATURE_ALGORITHM_MAX_BYTES})",
                "maxBytes": LISTENING_SIGNATURE_ALGORITHM_MAX_BYTES,
                "allowedAlgorithms": list(LISTENING_SIGNATURE_ALGORITHMS),
            }.items()
        ):
            raise ValueError(
                f"Listening signature algorithm storage drift: "
                f"{table_name}.{algorithm_column}"
            )
    if observed_signature_fields != 7:
        raise ValueError("Listening persisted signature field cardinality drift")

    algorithm_clause = "IN ('ED25519','ECDSA_P256_SHA256')"
    for table_name in expected_signature_fields:
        checks = tables[table_name].get("checks", [])
        if table_name == "sys_hris_listening_token_issuances":
            expected_check = {
                "constraintId": "ck_sys_hris_listening_token_issuances_signature_v5",
                "expression": (
                    "algorithm IN ('ED25519','ECDSA_P256_SHA256') "
                    "AND credential_signature IS NOT NULL"
                ),
                "columns": ["algorithm", "credential_signature"],
                "nullSemantics": "ISSUANCE_CREDENTIAL_REQUIRES_ONE_CLOSED_ALGORITHM_AND_BOUNDED_SIGNATURE",
            }
            if expected_check not in checks:
                raise ValueError("Listening issuance signature CHECK drift")
        elif not any(
            "signature_algorithm " + algorithm_clause in row.get("expression", "")
            and "owner_signature IS NOT NULL" in row.get("expression", "")
            for row in checks
        ):
            raise ValueError(f"Listening signed-message CHECK drift: {table_name}")


def validate(
    exact: dict[str, Any],
    events: dict[str, Any],
    manifest: dict[str, Any],
    *,
    source_ssot: dict[str, Any] | None = None,
    source_exact: dict[str, Any] | None = None,
    source_events: dict[str, Any] | None = None,
    semantic: dict[str, Any] | None = None,
    identities: dict[str, Any] | None = None,
    allow_source_registry_overlay: bool = False,
) -> None:
    if {row["operationId"] for row in exact["operationBindings"]} != {
        row["operationId"] for row in manifest["operations"]
    }:
        raise ValueError("exact operation set differs from manifest")
    if {row["tableName"] for row in exact["tableSpecifications"]} != set(manifest["tableIds"]):
        raise ValueError("exact table set differs from manifest")
    table_map = {
        table["tableName"]: {
            value["name"]: value for value in table.get("columns", [])
        }
        for table in exact["tableSpecifications"]
    }
    protected_commitments = {
        "sys_hris_listening_protected_receipts": {
            "token_commitment": "HIGHLY_RESTRICTED",
        },
        "sys_hris_listening_token_consumptions": {
            "token_commitment": "HIGHLY_RESTRICTED",
            "credential_jti_commitment": "HIGHLY_RESTRICTED",
        },
        "sys_hris_listening_token_issuances": {
            "opaque_jti_commitment": "HIGHLY_RESTRICTED",
            "token_commitment": "HIGHLY_RESTRICTED",
        },
        "sys_hris_listening_responses": {
            "consent_evidence_digest": "HIGHLY_RESTRICTED",
        },
        "sys_hris_listening_eligibility_versions": {
            "consent_evidence_digest": "RESTRICTED",
        },
    }
    for table_name, column_sensitivity in protected_commitments.items():
        if table_name not in table_map:
            raise ValueError(
                f"protected credential commitment table missing: {table_name}"
            )
        for column_name, expected_sensitivity in column_sensitivity.items():
            value = table_map[table_name].get(column_name)
            if value is None:
                raise ValueError(
                    f"protected credential commitment column missing: "
                    f"{table_name}.{column_name}"
                )
            if (
                value.get("sensitivity") != expected_sensitivity
                or value.get("tokenization")
                != "OWNER_HMAC_NONREVERSIBLE_COMMITMENT"
                or value.get("logging") != "FORBIDDEN"
                or value.get("cdcExposure") != "FORBIDDEN_OUTSIDE_OWNER_SCHEMA"
            ):
                raise ValueError(
                    f"protected credential commitment classification drift: "
                    f"{table_name}.{column_name}"
                )
    if {row["eventName"] for row in events["eventPayloadSchemas"]} != set(manifest["publicEventIds"]):
        raise ValueError("event payload set differs from manifest")
    if exact["scope"].get("physicalTables") != len(exact["tableSpecifications"]):
        raise ValueError("exact physical table scope is not source-derived")
    if exact["scope"].get("internalConsumerHandlers") != len(exact["internalConsumerHandlers"]):
        raise ValueError("exact handler scope is not source-derived")
    closure = exact.get("physicalClosureValidation", {})
    if closure.get("mismatches") != 0:
        raise ValueError("exact operation/handler physical closure did not pass")
    if closure.get("commandsChecked") != exact["scope"]["commands"]:
        raise ValueError("exact physical closure command coverage drift")
    if closure.get("handlersChecked") != exact["scope"]["internalConsumerHandlers"]:
        raise ValueError("exact physical closure handler coverage drift")
    observed_response_sources = _validate_generated_response_source_columns(exact)
    if closure.get("generatedResponseSourcesChecked") != observed_response_sources:
        raise ValueError("generated response/lineage physical-source coverage drift")
    if exact.get("listeningCanonicalComposition") != composition_marker("exactSchemas"):
        raise ValueError("exact Listening marker drift")
    if events.get("listeningCanonicalComposition") != composition_marker("eventPayloads"):
        raise ValueError("event Listening marker drift")
    aliases = [
        row["responseSchemaRef"] for row in exact["operationBindings"]
        if row["responseSchemaRef"] != row["operationId"] + ".Response.v3"
    ]
    if aliases:
        raise ValueError(f"response schema alias reuse survived: {aliases[:3]}")
    for table in exact["tableSpecifications"]:
        for key in table.get("uniqueKeys", []):
            digest_columns = [name for name in key.get("columns", [])
                              if re.search(r"(?:digest|hash)", name, re.I)]
            if digest_columns and key.get("exception") not in {
                "PROTECTED_ONE_TIME_TOKEN_COMMITMENT",
                "PROTECTED_PRIVACY_RELEASE_SCOPE",
            }:
                raise ValueError(f"business digest unique survived: {table['tableName']} {key}")
    allowed = {"PHYSICAL_POST_STATE", "LOCKED_PRE_STATE", "DERIVED_DOMAIN_FACT",
               "SEALED_COMMAND_RECEIPT", "IMMUTABLE_OWNER_PROOF",
               "TYPED_ORDERED_CHILD_PROJECTION"}
    for schema in events["eventPayloadSchemas"]:
        for field in schema["fields"]:
            if field["name"] not in {"occurredAt", "correlationId"} and field["sourceKind"] not in allowed:
                raise ValueError(f"event transient source survived: {schema['eventName']}.{field['name']}")
    dependency_id = "compensation.resolveApprovedSnapshotForPayroll.v1"
    dependencies = exact.get("ownerDependencyContracts", [])
    if len(dependencies) != 2 or len({
        row.get("dependencyContractId") for row in dependencies
    }) != 2:
        raise ValueError("owner dependency exact closed set is not two unique contracts")
    payroll_dependency = next((
        row for row in dependencies
        if row.get("dependencyContractId") == dependency_id
    ), None)
    payroll_event = next((
        row for row in events["eventPayloadSchemas"]
        if row.get("eventName") == "ApprovedCompensationPlanSnapshotPublished.v2"
    ), None)
    if payroll_dependency is None or payroll_event is None:
        raise ValueError("PAY snapshot owner dependency or event projection missing")
    dependency_body = {
        key: value for key, value in payroll_dependency.items()
        if key != "sealedPayloadSha256"
    }
    dependency_seal = hashlib.sha256(json.dumps(
        dependency_body, ensure_ascii=False, sort_keys=True, separators=(",", ":"),
    ).encode("utf-8")).hexdigest()
    refetch = payroll_event.get("consumerRefetchPolicy", {})
    line_fields = {
        field.get("name")
        for field in payroll_dependency.get("responseSchema", {}).get(
            "lines", {}
        ).get("itemFields", [])
    }
    event_field_names = [
        field.get("name") for field in payroll_event.get("fields", [])
    ]
    event_field_types = {
        field.get("name"): field.get("type")
        for field in payroll_event.get("fields", [])
    }
    expected_event_field_types = {
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
    expected_consumer_fields = {
        "HRIS-PAY": {
            "purpose": ["HRIS_APPROVED_COMPENSATION_PLAN_SNAPSHOT_REFETCH"],
            "mode": "EXACT_ALLOWLIST",
            "fields": [
                "snapshotId", "snapshotRevision", "payloadDigest", "lineCount",
            ],
        },
        "HRIS-PER": {
            "purpose": ["COMPENSATION_PLAN_PUBLISH"],
            "mode": "EXACT_ALLOWLIST",
            "fields": list(expected_event_field_types),
        },
    }
    if (
        payroll_dependency.get("sealedPayloadSha256") != dependency_seal
        or payroll_dependency.get("writes") != "FORBIDDEN"
        or payroll_dependency.get("receiptAndOutbox")
        != "FORBIDDEN_READ_ONLY_DEPENDENCY"
        or payroll_dependency.get("latestFallback") != "FORBIDDEN"
        or payroll_dependency.get("responseSchema", {}).get("lines", {}).get(
            "maxItems"
        ) != 100000
        or line_fields != {
            "lineId", "lineSequence", "workerId", "assignmentId",
            "componentCode", "currency", "approvedAmount", "effectiveFrom",
            "effectiveTo", "lineDigest",
        }
        or refetch.get("allowed") is not True
        or refetch.get("mode") != "EXACT_OWNER_DEPENDENCY"
        or refetch.get("dependencyContractId") != dependency_id
        or refetch.get("dependencyContractSha256") != dependency_seal
        or refetch.get("latestFallback") != "FORBIDDEN"
        or refetch.get("selectorTuple") != [
            "eventEnvelope.tenantId", "event.snapshotId",
            "event.snapshotRevision", "event.payloadDigest",
            "CONSTANT:HRIS_APPROVED_COMPENSATION_PLAN_SNAPSHOT_REFETCH",
        ]
        or refetch.get("tenantBinding") != {
            "eventEnvelopeTenant": "eventEnvelope.tenantId",
            "signedWorkloadTenant": "verifiedWorkloadContext.tenantId",
            "ownerRowTenant": "prf_cmp_approved_snapshots.tenant_id",
            "equality": "ALL_THREE_REQUIRED_EQUAL",
        }
        or "HRIS-PAY" not in payroll_event.get("deliveryPolicy", {}).get(
            "allowedConsumerSessions", []
        )
        or payroll_event.get("deliveryPolicy", {}).get(
            "consumerFieldAllowlists"
        ) != expected_consumer_fields
        or event_field_names != list(expected_event_field_types)
        or event_field_types != expected_event_field_types
        or "lines" in {field.get("name") for field in payroll_event.get("fields", [])}
    ):
        raise ValueError("PAY snapshot exact/event owner-dependency projection drift")
    tables = {row["tableName"]: row for row in exact["tableSpecifications"]}
    common_columns = {
        row["name"] for row in exact["commonTableContract"]["columns"]
        if row["name"] != "__internal_id__"
    }
    physical_columns = {
        table_name: common_columns
        | {table["idColumn"]["name"]}
        | {row["name"] for row in table.get("columns", [])}
        for table_name, table in tables.items()
    }
    listening_design = build_static_design()
    listening_ownership = {
        row["tableName"]: row for row in listening_design["tableOwnership"]
    }
    listening_streams = {
        row["streamKey"]: row for row in listening_design["authorityStreams"]
    }
    observed_listening_tables = {
        name for name, table in tables.items()
        if table.get("capabilityId") == "HRIS.MODERN.EMPLOYEE_LISTENING"
    }
    if observed_listening_tables != set(listening_ownership) or len(
        listening_ownership
    ) != 23:
        raise ValueError(
            "Listening exact table ownership set drift: "
            f"expected={len(listening_ownership)} observed={len(observed_listening_tables)}"
        )
    for table_name, ownership in listening_ownership.items():
        table = tables[table_name]
        stream_key = ownership["streamKey"]
        stream = listening_streams[stream_key]
        expected_owner = {
            "capabilityId": "HRIS.MODERN.EMPLOYEE_LISTENING",
            "session": "HRIS-SYS",
            "streamKey": stream_key,
            "ownerBindingId": LISTENING_OWNER_BINDING_BY_STREAM[stream_key],
            "physicalSchema": stream["databaseSchema"],
            "ownerService": stream["ownerService"],
        }
        observed_owner = {key: table.get(key) for key in expected_owner}
        if observed_owner != expected_owner:
            raise ValueError(
                f"Listening table stream/schema/owner binding drift: {table_name} "
                f"expected={expected_owner} observed={observed_owner}"
            )
        if table.get("crossSchemaForeignKeys") != []:
            raise ValueError(
                f"Listening cross-schema physical FK survived: {table_name}"
            )

    expected_listening_fks = _expected_listening_foreign_keys(listening_design)
    if sum(map(len, expected_listening_fks.values())) != 14:
        raise ValueError("Listening closed FK authority is not the exact 14-link set")

    def canonical_rows(rows: list[dict[str, Any]]) -> list[str]:
        return sorted(
            json.dumps(row, sort_keys=True, separators=(",", ":")) for row in rows
        )

    common_types = {
        row["name"]: row["sqlType"]
        for row in exact["commonTableContract"]["columns"]
        if row["name"] != "__internal_id__"
    }
    listening_column_types = {
        table_name: {
            **common_types,
            table["idColumn"]["name"]: table["idColumn"]["sqlType"],
            **{row["name"]: row["sqlType"] for row in table.get("columns", [])},
        }
        for table_name, table in tables.items()
        if table_name in listening_ownership
    }
    for table_name, expected_fks in expected_listening_fks.items():
        actual_fks = tables[table_name].get("foreignKeys", [])
        if canonical_rows(actual_fks) != canonical_rows(expected_fks):
            raise ValueError(
                f"Listening closed local FK set drift: {table_name} "
                f"expected={expected_fks} observed={actual_fks}"
            )
        for foreign in actual_fks:
            target_name = foreign["target"]
            if target_name not in listening_ownership:
                raise ValueError(
                    f"Listening FK targets a non-Listening table: {table_name}->{target_name}"
                )
            source_table = tables[table_name]
            target_table = tables[target_name]
            if (
                source_table["streamKey"] != target_table["streamKey"]
                or source_table["physicalSchema"] != target_table["physicalSchema"]
                or source_table["ownerBindingId"] != target_table["ownerBindingId"]
            ):
                raise ValueError(
                    f"Listening FK crosses an owner/schema boundary: {table_name}->{target_name}"
                )
            source_types = [
                listening_column_types[table_name].get(name)
                for name in foreign["columns"]
            ]
            target_types = [
                listening_column_types[target_name].get(name)
                for name in foreign["targetColumns"]
            ]
            if None in source_types or None in target_types or source_types != target_types:
                raise ValueError(
                    f"Listening FK column/type mismatch: {table_name}.{foreign['constraintId']}"
                )
            target_candidates = {
                tuple(row.get("columns", []))
                for row in target_table.get("uniqueKeys", [])
            }
            if tuple(foreign["targetColumns"]) not in target_candidates:
                raise ValueError(
                    f"Listening FK target is not an exact candidate key: "
                    f"{table_name}.{foreign['constraintId']}"
                )
    aliases = {
        "ppl_rec_candidate_cases": {"stage", "status"},
        "sys_hris_listening_surveys": {"state", "status"},
        "sys_hris_listening_responses": {"state", "status"},
        "sys_hris_listening_actions": {"state", "status"},
    }
    for table_name, candidates in aliases.items():
        observed = {row["name"] for row in tables[table_name]["columns"]} & candidates
        expected = {"stage"} if table_name == "ppl_rec_candidate_cases" else {"status"}
        if observed != expected:
            raise ValueError(f"duplicate lifecycle aliases survived: {table_name} {observed}")
    interval_pairs = {
        "ppl_bnf_plan_versions": {("effective_from", "effective_to"), ("valid_from", "valid_to")},
        "ppl_jny_template_versions": {("effective_from", "effective_to")},
        "prf_grw_profiles": {("valid_from", "valid_to")},
        "prf_skl_taxonomy_versions": {("effective_from", "effective_to")},
        "sys_hris_ai_policy_versions": {("effective_from", "effective_to")},
        "sys_hris_ai_use_policies": {("valid_from", "valid_to")},
        "sys_hris_metric_versions": {("effective_from", "effective_to")},
        "tme_wfm_schedule_candidates": {("period_start", "period_end")},
    }
    for table_name, pairs in interval_pairs.items():
        checks = tables[table_name].get("checks", [])
        for pair in pairs:
            matches = [row for row in checks if set(row.get("columns", [])) == set(pair)]
            if not matches or not any(
                ">" in row.get("expression", "") and row.get("nullSemantics")
                for row in matches
            ):
                raise ValueError(f"strict interval check missing: {table_name} {pair}")
    temporal_dual_chain_tables = {
        "ppl_bnf_plan_versions": ("benefit_plan_id", "version_no", "ppl_bnf_plans"),
        "ppl_cwk_engagement_versions": ("engagement_public_id", "version_no", "ppl_cwk_engagements"),
        "ppl_jny_template_versions": ("journey_template_id", "version_no", "ppl_jny_templates"),
        "ppl_rec_requisition_versions": ("requisition_public_id", "fact_revision", "ppl_rec_requisitions"),
        "prf_lrn_offering_versions": ("offering_public_id", "version_no", "prf_lrn_offerings"),
        "prf_mkt_opportunity_versions": ("opportunity_public_id", "version_no", "prf_mkt_opportunities"),
        "prf_suc_plan_versions": ("plan_public_id", "version_no", "prf_suc_plans"),
    }
    chain_columns = {
        "root_version", "root_predecessor_public_id", "root_predecessor_version",
        "effective_segment_public_id", "segment_revision",
        "segment_predecessor_public_id", "segment_predecessor_revision",
        "content_revision_public_id",
    }
    legacy_chain_aliases = {
        "predecessor_revision", "predecessor_public_id",
        "correction_target_public_id", "correction_target_version",
    }
    for table_name, (parent_column, revision_column, root_table) in temporal_dual_chain_tables.items():
        table = tables[table_name]
        columns = {row["name"]: row for row in table["columns"]}
        if not chain_columns <= set(columns) or legacy_chain_aliases & set(columns):
            raise ValueError(f"dual temporal schema columns drift: {table_name}")
        for name in chain_columns - {
            "root_predecessor_public_id", "segment_predecessor_public_id",
        }:
            if columns[name].get("nullable") is not False:
                raise ValueError(f"dual temporal required column is nullable: {table_name}.{name}")
        if columns["root_predecessor_public_id"].get("nullable") is not True or columns[
            "segment_predecessor_public_id"
        ].get("nullable") is not True:
            raise ValueError(f"dual temporal predecessor nullability drift: {table_name}")
        arbitration = table.get("temporalArbitration", {})
        expected_arbitration = _temporal_arbitration_contract(
            parent_column, revision_column, root_table,
        )
        if arbitration != expected_arbitration:
            raise ValueError(f"dual temporal arbitration missing: {table_name}")
        if (
            arbitration.get("rootTable") != root_table
            or arbitration.get("storedEffectiveToAuthority") != "FORBIDDEN_NULL_ONLY"
            or table.get("temporalExclusionConstraints")
        ):
            raise ValueError(f"dual temporal root/boundary contract drift: {table_name}")
        expected_segment_fk = [
            "tenant_id", parent_column, "effective_segment_public_id", "effective_from",
            "segment_predecessor_public_id", "segment_predecessor_revision",
        ]
        if not any(
            row.get("columns") == expected_segment_fk
            and row.get("targetColumns") == [
                "tenant_id", parent_column, "effective_segment_public_id", "effective_from",
                "public_id", "segment_revision",
            ]
            for row in table.get("foreignKeys", [])
        ):
            raise ValueError(f"segment predecessor parent/interval FK drift: {table_name}")
        if not any(
            row.get("columns") == [
                "tenant_id", parent_column, "effective_segment_public_id",
                "effective_from", "content_revision_public_id",
            ]
            and row.get("targetColumns") == [
                "tenant_id", parent_column, "effective_segment_public_id",
                "effective_from", "public_id",
            ]
            for row in table.get("foreignKeys", [])
        ):
            raise ValueError(f"content revision parent FK drift: {table_name}")
        if not any(
            row.get("columns") == ["tenant_id", parent_column, "effective_from"]
            and row.get("predicate") == "segment_revision=1"
            for row in table.get("uniqueKeys", [])
        ):
            raise ValueError(f"base effective segment uniqueness missing: {table_name}")
        if not any(
            row.get("columns") == ["tenant_id", parent_column, "root_version"]
            for row in table.get("uniqueKeys", [])
        ):
            raise ValueError(f"global root version uniqueness missing: {table_name}")
        effective_to = columns["effective_to"]
        if (
            effective_to.get("nullable") is not True
            or effective_to.get("default") is not None
            or not any(
                row.get("columns") == ["effective_to"]
                and row.get("expression") == "effective_to IS NULL"
                for row in table.get("checks", [])
            )
        ):
            raise ValueError(f"derived effective_to null-only schema drift: {table_name}")
        required_checks = {
            frozenset((revision_column, "root_version")),
            frozenset(("effective_to",)),
        }
        observed_checks = {
            frozenset(row.get("columns", [])) for row in table.get("checks", [])
        }
        if not required_checks <= observed_checks:
            raise ValueError(f"dual temporal alias/null-only checks missing: {table_name}")
    schemas_by_id = {row["schemaId"]: row for row in exact["recordSchemas"]}
    bindings_by_operation = {
        row["operationId"]: row for row in exact["operationBindings"]
    }
    lineage_by_operation: dict[str, dict[str, Any]] = {}
    for lineage in exact.get("operationFieldLineage", []):
        operation_id = lineage.get("operationId")
        if operation_id in lineage_by_operation:
            raise ValueError(f"duplicate operation field lineage: {operation_id}")
        lineage_by_operation[operation_id] = lineage
    if set(lineage_by_operation) != set(bindings_by_operation):
        raise ValueError("operation field lineage closed set differs from operation bindings")
    for operation_id, binding in bindings_by_operation.items():
        if binding.get("mode") != "QUERY":
            continue
        schema = schemas_by_id[operation_id + ".Entity.v3"]
        record_path = (
            "item" if re.search(r"\{[^}]+\}$", binding["path"]) else "items[*]"
        )
        prefix = binding["responseSchemaRef"] + "." + record_path + "."
        expected_rows: dict[str, dict[str, Any]] = {}
        for field in schema["fields"]:
            source = field.get("sourcePath")
            if not source:
                continue
            target = prefix + field["name"]
            expected = {
                "target": target,
                "sourcePath": source,
                "sourceKind": "PHYSICAL_POST_STATE",
            }
            if field.get("selectionModeSources"):
                expected["selectionModeSources"] = copy.deepcopy(
                    field["selectionModeSources"]
                )
            expected_rows[target] = expected
        actual_rows_list = [
            row for row in lineage_by_operation[operation_id].get(
                "responseFieldSources", []
            )
            if row.get("target", "").startswith(prefix)
        ]
        actual_rows = {row.get("target"): row for row in actual_rows_list}
        if (
            len(actual_rows) != len(actual_rows_list)
            or actual_rows != expected_rows
        ):
            raise ValueError(
                f"query operationFieldLineage/record schema projection drift: {operation_id}"
            )
    for operation_id, table_name in TEMPORAL_ROOT_QUERY_TABLES.items():
        schema = schemas_by_id[operation_id + ".Entity.v3"]
        fields = {row["name"]: row for row in schema["fields"]}
        if not {
            "contentRevisionPublicId", "stateRevisionPublicId", "derivedEffectiveTo",
        } <= set(fields):
            raise ValueError(f"temporal query winner identity fields missing: {operation_id}")
        if (
            not fields["aggregateVersion"].get("sourcePath", "").startswith("STATE_WINNER:")
            or not fields["state"].get("sourcePath", "").startswith("STATE_WINNER:")
            or not fields["referenceEffectiveAt"].get("sourcePath", "").startswith("STATE_WINNER:")
            or fields["contentRevisionPublicId"].get("sourcePath")
            != "CONTENT_WINNER:" + table_name + ".public_id"
            or fields["stateRevisionPublicId"].get("sourcePath")
            != "STATE_WINNER:" + table_name + ".public_id"
        ):
            raise ValueError(f"temporal query state/content winner split drift: {operation_id}")
        if any(
            row.get("sourcePath", "").startswith(table_name + ".")
            for row in schema["fields"]
        ):
            raise ValueError(f"plain temporal version source bypassed winner: {operation_id}")
        request_schema = bindings_by_operation[operation_id]["requestSchema"]
        request_names = {
            row["name"] for section in ("pathParameters", "queryParameters", "headers", "body")
            for row in request_schema.get(section, [])
        }
        if not {
            "systemAsOf", "revisionPublicId", "rootVersion", "contentRevisionPublicId",
        } <= request_names:
            raise ValueError(f"temporal query lacks closed exact-history transport: {operation_id}")
        if (
            set(request_schema.get("selectionModes", {}))
            != {"UNQUALIFIED", "STATE_HISTORY", "CONTENT_HISTORY"}
            or len(request_schema.get("crossFieldRules", [])) < 5
        ):
            raise ValueError(f"temporal query exact-history mode rules missing: {operation_id}")
        for field in schema["fields"]:
            if field["name"] == "publicId" or not field.get("sourcePath"):
                continue
            source = field.get("sourcePath", "")
            if not (
                source.startswith(("STATE_WINNER:", "CONTENT_WINNER:", "DERIVED:"))
            ):
                continue
            if set(field.get("selectionModeSources", {})) != {
                "UNQUALIFIED", "STATE_HISTORY", "CONTENT_HISTORY",
            }:
                raise ValueError(
                    f"temporal response field lacks mode-dependent lineage: {operation_id}.{field['name']}"
                )
            if (
                operation_id in TEMPORAL_EXACT_HISTORY_QUERY_IDS
                and field["name"] in {
                    "effectiveSegmentPublicId", "segmentRevision", "revisionMode",
                    "segmentPredecessorPublicId", "segmentPredecessorRevision",
                }
                and not field.get("selectionModeSources", {}).get(
                    "STATE_HISTORY", ""
                ).startswith("SELECTED_STATE_ROW:")
            ):
                raise ValueError(
                    f"state-history segment lineage does not come from selected state row: "
                    f"{operation_id}.{field['name']}"
                )
    for operation_id, table_name in TEMPORAL_JOIN_QUERY_TABLES.items():
        schema = schemas_by_id[operation_id + ".Entity.v3"]
        sources = [row.get("sourcePath", "") for row in schema["fields"]]
        if (
            sum(source.startswith("CONTENT_WINNER:" + table_name + ".") for source in sources) < 2
            or any(source.startswith(table_name + ".") for source in sources)
        ):
            raise ValueError(f"joined temporal content winner lineage drift: {operation_id}")
        request_schema = bindings_by_operation[operation_id]["requestSchema"]
        request_names = {
            row["name"] for section in ("pathParameters", "queryParameters", "headers", "body")
            for row in request_schema.get(section, [])
        }
        if "systemAsOf" not in request_names:
            raise ValueError(f"joined temporal query lacks systemAsOf: {operation_id}")
    cohort_schema = schemas_by_id["modern.listening.cohorts.query.Entity.v3"]
    cohort_fields = {row["name"]: row for row in cohort_schema["fields"]}
    for field_name in ("measureValues", "subjectCount"):
        field = cohort_fields.get(field_name, {})
        if (
            field.get("required") is not False
            or field.get("condition") != "adequacyCategory=ADEQUATE"
            or "SUPPRESSED" not in field.get("validation", "")
        ):
            raise ValueError(
                f"Listening suppressed cohort leaks exact {field_name}"
            )
    array_replacements = {
        "prf_grw_coaching_notes": "evidence_refs",
        "prf_grw_profile_revisions": "evidence_refs",
        "prf_lrn_completion_evidence": "skill_evidence_ids",
        "sys_hris_analytics_export_receipts": "metric_projection_ids",
        "tme_wfm_schedule_candidates": "time_group_ids",
    }
    for table_name, column_name in array_replacements.items():
        if any(row["name"] == column_name for row in tables[table_name]["columns"]):
            raise ValueError(f"UUID array survived typed-child normalization: {table_name}.{column_name}")
    for table_name in TYPED_ORDERED_CHILD_TABLES:
        table = tables[table_name]
        names = {row["name"] for row in table["columns"]}
        if "ordinal" not in names or table.get("kind") != "TYPED_ORDERED_CHILD_REFERENCE":
            raise ValueError(f"typed ordered child contract incomplete: {table_name}")
    recurrence_contracts = {
        "ppl_cwk_engagements": (
            {"tenant_id", "worker_public_id", "engagement_occurrence_no"},
            {"tenant_id", "worker_public_id"},
        ),
        "ppl_cwk_sponsor_assignments": (
            {"tenant_id", "contingent_engagement_id", "assignment_revision"},
            {"tenant_id", "contingent_engagement_id"},
        ),
    }
    for table_name, (recurrence_key, temporal_partition) in recurrence_contracts.items():
        table = tables[table_name]
        if not any(set(row.get("columns", [])) == recurrence_key
                   for row in table.get("uniqueKeys", [])):
            raise ValueError(f"recurrence identity key missing: {table_name}")
        if not any(
            set(row.get("partitionColumns", [])) == temporal_partition
            and row.get("operator") == "&&" and row.get("rule") == "NO_OVERLAP"
            for row in table.get("temporalExclusionConstraints", [])
        ):
            raise ValueError(f"temporal non-overlap missing: {table_name}")
    for table_name, start in (
        ("ppl_cwk_engagements", "effective_from"),
        ("ppl_cwk_sponsor_assignments", "valid_from"),
    ):
        start_column = next(row for row in tables[table_name]["columns"] if row["name"] == start)
        if start_column.get("nullable"):
            raise ValueError(f"recurrence start must be strict: {table_name}.{start}")
    approval_columns = {
        "approval_receipt_public_id", "approval_receipt_revision", "approval_outcome",
        "approval_action", "approval_input_digest", "approval_purpose_code",
        "approval_tenant_id",
    }
    for table_name in (
        "ppl_rec_requisition_publish_receipts", "ppl_jny_template_versions",
        "ppl_wfp_publish_receipts", "ppl_bnf_plan_versions",
        "prf_skl_taxonomy_versions", "prf_lrn_offering_publish_receipts",
        "prf_mkt_opportunity_publish_receipts", "prf_suc_publish_receipts",
        "prf_cmp_approved_snapshots", "tme_wfm_schedule_publish_ledger",
        "sys_hris_listening_survey_versions", "sys_hris_metric_versions",
        "sys_hris_ai_policy_versions",
    ):
        if not approval_columns <= {row["name"] for row in tables[table_name]["columns"]}:
            raise ValueError(f"publish approval proof schema incomplete: {table_name}")
    counter_columns = {row["name"] for row in tables["tme_wfm_forecast_revision_counters"]["columns"]}
    if {"current_revision", "last_revision"} <= counter_columns or "last_revision" not in counter_columns:
        raise ValueError("WFM forecast revision aliases survived")
    fairness_columns = {row["name"] for row in tables["tme_wfm_fairness_measure_values"]["columns"]}
    if fairness_columns != {
        "constraint_evaluation_receipt_id", "measure_key", "measure_value",
        "accepted_bound", "result", "ordinal",
    }:
        raise ValueError("WFM fairness parallel tuples survived")
    provenance = tables["sys_hris_ai_provenance_receipts"]
    frozen_ai_result_columns = {
        "assistance_request_id", "model_version_id", "prompt_template_version_id",
        "dataset_manifest_version_id", "evaluation_protocol_version_id",
        "governance_activation_receipt_id",
        "affected_person_disclosure_evidence_id", "output_digest", "generated_at",
    }
    if not frozen_ai_result_columns <= physical_columns[provenance["tableName"]]:
        raise ValueError("AI assistance immutable result proof schema incomplete")
    if provenance.get("resultProofContract", {}).get("sameTransactionAppend") is not True:
        raise ValueError("AI assistance result proof semantics are not explicit")


def main() -> int:
    parser = argparse.ArgumentParser()
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--preview", action="store_true")
    group.add_argument("--write", action="store_true")
    group.add_argument("--check", action="store_true")
    parser.add_argument(
        "--candidate-dir", type=Path,
        help="validate one canonical-five candidate without reading candidate roles from live files",
    )
    parser.add_argument(
        "--source-exact", type=Path,
        help="explicit exact projection seed (defaults to the live predecessor for candidate checks)",
    )
    parser.add_argument(
        "--source-events", type=Path,
        help="explicit event projection seed (defaults to the live predecessor for candidate checks)",
    )
    args = parser.parse_args()
    if args.candidate_dir and not args.check:
        parser.error("--candidate-dir is validation-only and requires --check")

    candidate_dir = args.candidate_dir
    manifest_path = candidate_dir / MANIFEST.name if candidate_dir else MANIFEST
    ssot_path = candidate_dir / SSOT.name if candidate_dir else SSOT
    exact_path = candidate_dir / EXACT.name if candidate_dir else EXACT
    events_path = candidate_dir / EVENTS.name if candidate_dir else EVENTS
    bindings_path = candidate_dir / BINDINGS.name if candidate_dir else BINDINGS
    identities_path = candidate_dir / IDENTITIES.name if candidate_dir else IDENTITIES
    for path in (manifest_path, ssot_path, exact_path, events_path):
        if not path.is_file():
            raise ValueError(f"exact/event validation input missing: {path}")

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    ssot_bytes = ssot_path.read_bytes()
    predecessor = json.loads(ssot_bytes)
    before_exact_path = args.source_exact or (EXACT if candidate_dir else exact_path)
    before_events_path = args.source_events or (EVENTS if candidate_dir else events_path)
    if not before_exact_path.is_file():
        raise ValueError(f"exact projection source missing: {before_exact_path}")
    if not before_events_path.is_file():
        raise ValueError(f"event projection source missing: {before_events_path}")
    before_exact = json.loads(before_exact_path.read_text(encoding="utf-8"))
    before_events = json.loads(before_events_path.read_text(encoding="utf-8"))

    if candidate_dir:
        candidate_exact = json.loads(exact_path.read_text(encoding="utf-8"))
        candidate_events = json.loads(events_path.read_text(encoding="utf-8"))
        if not bindings_path.is_file() or not identities_path.is_file():
            raise ValueError("candidate reciprocal semantic/identity registries are missing")
        semantic = json.loads(bindings_path.read_text(encoding="utf-8"))
        identities = json.loads(identities_path.read_text(encoding="utf-8"))
        validate(
            candidate_exact, candidate_events, manifest,
            source_ssot=predecessor,
            source_exact=before_exact,
            source_events=before_events,
            semantic=semantic,
            identities=identities,
        )
        print(
            "MODERN_EXACT_EVENT_CANDIDATE_CHECK=PASS"
            f" path={candidate_dir}"
            f" operations={len(candidate_exact['operationBindings'])}"
            f" tables={len(candidate_exact['tableSpecifications'])}"
            f" events={len(candidate_events['eventPayloadSchemas'])}"
        )
        return 0

    if hashlib.sha256(ssot_bytes).hexdigest() == PREDECESSOR_OPERATION_SSOT_SHA256:
        expected_exact, expected_events = compose_exact(
            before_exact, predecessor, manifest, source_events=before_events,
        )
        expected_ssot = compose_operation_ssot(predecessor, manifest)
    elif predecessor.get("closedSetManifest", {}).get("manifestId") == manifest["manifestId"]:
        expected_ssot = compose_operation_ssot(predecessor, manifest)
        expected_exact, expected_events = compose_exact_from_ssot(
            before_exact, expected_ssot, manifest, source_events=before_events,
        )
    else:
        raise ValueError("exact/event inputs are neither sealed predecessor nor this successor")
    validate(
        expected_exact, expected_events, manifest,
        source_ssot=expected_ssot,
        source_exact=before_exact,
        source_events=before_events,
        allow_source_registry_overlay=True,
    )
    exact_bytes = render(expected_exact).encode("utf-8")
    event_bytes = render(expected_events).encode("utf-8")
    if args.preview:
        print(
            "MODERN_EXACT_EVENT_SUCCESSOR_PREVIEW=PASS"
            f" operations={len(expected_exact['operationBindings'])}"
            f" tables={len(expected_exact['tableSpecifications'])}"
            f" responses={len(expected_exact['responseSchemas'])}"
            f" events={len(expected_events['eventPayloadSchemas'])}"
            f" exactSha256={hashlib.sha256(exact_bytes).hexdigest()}"
            f" eventSha256={hashlib.sha256(event_bytes).hexdigest()}"
        )
        return 0
    if args.write:
        EXACT.write_bytes(exact_bytes)
        EVENTS.write_bytes(event_bytes)
    if EXACT.read_bytes() != exact_bytes or EVENTS.read_bytes() != event_bytes:
        raise ValueError("generated exact/event bytes mismatch")
    print("MODERN_EXACT_EVENT_SUCCESSOR_CHECK=PASS")
    return 0

    _validate_compensation_snapshot_approval_source(exact, events)
    _validate_listening_signature_contracts(exact)

    # Require byte-equivalent deterministic reprojection from the pinned
    # generator inputs.  Targeted structural checks above explain common
    # failures; this final oracle prevents any nested schema/FK/arbitration/
    # lineage/event mutation from escaping merely because a future explicit
    # check forgot one field.
    if source_ssot is None or source_exact is None or source_events is None:
        raise ValueError(
            "deterministic exact/event validation requires explicit source_ssot "
            "source_exact and source_events inputs; implicit live-file rereads "
            "are forbidden"
        )
    expected_ssot = compose_operation_ssot(source_ssot, manifest)
    expected_exact, expected_events = compose_exact_from_ssot(
        source_exact, expected_ssot, manifest, source_events=source_events,
    )
    _apply_and_validate_registry_overlay(
        expected_exact, expected_events, exact, events, semantic, identities,
        allow_source_registry_overlay,
    )
    if exact != expected_exact or events != expected_events:
        raise ValueError(
            "exact/event contracts differ from deterministic source reprojection"
        )
    if exact.get("sourceProjectionVersion") != EXACT_SUCCESSOR_PROJECTION_VERSION:
        raise ValueError("exact successor source projection version drift")
    second_exact, second_events = compose_exact_from_ssot(
        expected_exact, expected_ssot, manifest, source_events=expected_events,
    )
    _apply_and_validate_registry_overlay(
        second_exact, second_events, exact, events, semantic, identities,
        allow_source_registry_overlay,
    )
    if second_exact != expected_exact or second_events != expected_events:
        raise ValueError("exact/event successor is not a composition fixed point")


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
