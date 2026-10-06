#!/usr/bin/env python3
"""Reviewed closed-set design for the modern HRIS G3 successor.

This module is an authored design input, not a generated artefact.  Counts are
never stored here: consumers derive them from the exact identifiers below.
The predecessor catalogue is intentionally kept separate so a missing or
duplicate operation cannot be hidden by adjusting a numeric constant.
"""

from __future__ import annotations

from typing import Final


DESIGN_ID: Final = "dwp.hris.modern.closed-set-design.v3"
PREDECESSOR_OPERATION_SSOT_SHA256: Final = (
    "ad3a28d37850b29ccafad41dcf78b4934694a3df1116d816b372a7ed26a58eb3"
)

# These public surfaces are removed for product/causal reasons, not merely
# renamed.  Analytics receives the explicit replacement shown below.
REMOVED_OPERATION_IDS: Final = frozenset({
    "modern.contingent.engagement.close",
    "modern.analytics.cohorts.query",
})

REPLACED_OPERATION_IDS: Final = {
    "modern.analytics.cohorts.query": "modern.analytics.projections.query",
}


HRM_NEW_COMMAND_EVENTS: Final = {
    "modern.recruiting.requisition.revise": ("RequisitionRevised.v2",),
    "modern.recruiting.requisition.lifecycle.change": (
        "RequisitionPaused.v2", "RequisitionResumed.v2", "RequisitionClosed.v2",
    ),
    "modern.recruiting.candidate.admit": ("CandidateAdmitted.v2",),
    "modern.recruiting.offer.respond": (
        "CandidateOfferAccepted.v2", "CandidateOfferDeclined.v2",
    ),
    "modern.recruiting.offer.withdraw": ("CandidateOfferWithdrawn.v2",),
    "modern.recruiting.hire.cancel": ("CandidateHireHandoffCancelled.v2",),
    "modern.onboarding.template.revise": ("OnboardingTemplateRevised.v2",),
    "modern.onboarding.template.retire": ("OnboardingTemplateRetired.v2",),
    "modern.onboarding.task.waive": ("OnboardingTaskWaived.v2",),
    "modern.workforceplan.scenario.revise": ("WorkforceScenarioRevised.v2",),
    "modern.workforceplan.scenario.cancel": ("WorkforceScenarioCancelled.v2",),
    "modern.benefits.plan.revise": ("BenefitPlanRevised.v2",),
    "modern.benefits.plan.retire": ("BenefitPlanRetired.v2",),
    "modern.benefits.enrollment.cancel": ("BenefitEnrollmentCancelled.v2",),
    "modern.benefits.lifeevent.decide": ("BenefitLifeEventDecisionRecorded.v2",),
    "modern.hrservice.case.cancel": ("HrServiceCaseCancelled.v2",),
    "modern.contingent.engagement.revise": ("ContingentEngagementRevised.v2",),
    "modern.contingent.engagement.reject": ("ContingentEngagementRejected.v2",),
    "modern.contingent.sponsor.reassign": ("ContingentSponsorReassigned.v2",),
}

HRM_NEW_QUERY_IDS: Final = frozenset({
    "modern.recruiting.requisition.query",
    "modern.recruiting.candidates.query",
    "modern.recruiting.candidate.query",
    "modern.onboarding.templates.query",
    "modern.onboarding.template.query",
    "modern.onboarding.assignments.query",
    "modern.onboarding.assignment.query",
    "modern.workforceplan.scenario.query",
    "modern.benefits.plans.query",
    "modern.benefits.plan.query",
    "modern.benefits.enrollments.query",
    "modern.benefits.enrollment.query",
    "modern.benefits.lifeevents.query",
    "modern.benefits.lifeevent.query",
    "modern.hrservice.cases.query",
    "modern.contingent.engagement.query",
})

PER_NEW_COMMAND_EVENTS: Final = {
    "modern.skills.taxonomy.revise": ("SkillsTaxonomyRevised.v2",),
    "modern.skills.taxonomy.retire": ("SkillsTaxonomyRetired.v2",),
    "modern.skills.evidence.record": ("WorkerSkillEvidenceRecorded.v2",),
    "modern.skills.evidence.revoke": ("WorkerSkillEvidenceRevoked.v2",),
    "modern.growth.evidence.unlink": ("GrowthEvidenceUnlinked.v2",),
    "modern.growth.export.request": ("GrowthPortabilityExportRequested.v2",),
    "modern.growth.export.cancel": ("GrowthPortabilityExportCancelled.v2",),
    "modern.learning.offering.revise": ("LearningOfferingRevised.v2",),
    "modern.learning.offering.retire": ("LearningOfferingRetired.v2",),
    "modern.learning.assignment.create": ("LearningAssignmentCreated.v2",),
    "modern.learning.assignment.cancel": ("LearningAssignmentCancelled.v2",),
    "modern.opportunity.revise": ("TalentOpportunityRevised.v2",),
    "modern.opportunity.close": ("TalentOpportunityClosed.v2",),
    "modern.opportunity.cancel": ("TalentOpportunityCancelled.v2",),
    "modern.opportunity.application.withdraw": (
        "TalentOpportunityApplicationWithdrawn.v2",
    ),
    "modern.succession.plan.revise": ("SuccessionPlanRevised.v2",),
    "modern.succession.plan.reject": ("SuccessionPlanRejected.v2",),
    "modern.succession.nomination.withdraw": ("SuccessionNominationWithdrawn.v2",),
    "modern.succession.readiness.record": ("SuccessionReadinessEvidenceRecorded.v2",),
    "modern.succession.plan.retire": ("SuccessionPlanRetired.v2",),
    "modern.compplan.cycle.revise": ("CompensationCycleRevised.v2",),
    "modern.compplan.proposal.upsert": ("CompensationProposalDrafted.v2",),
    "modern.compplan.cycle.cancel": ("CompensationCycleCancelled.v2",),
}

PER_NEW_QUERY_IDS: Final = frozenset({
    "modern.skills.taxonomy.query",
    "modern.skills.evidences.query",
    "modern.skills.evidence.query",
    "modern.growth.profiles.query",
    "modern.growth.profile.query",
    "modern.growth.exports.query",
    "modern.growth.export.query",
    "modern.learning.offering.query",
    "modern.learning.assignments.query",
    "modern.learning.assignment.query",
    "modern.opportunity.query",
    "modern.opportunity.applications.query",
    "modern.opportunity.application.query",
    "modern.succession.plan.query",
    "modern.compplan.cycle.query",
    "modern.compplan.proposals.query",
    "modern.compplan.proposal.query",
})

TIM_NEW_COMMAND_EVENTS: Final = {
    "modern.wfm.optimization.cancel": ("WorkforceScheduleOptimizationCancelled.v2",),
    "modern.wfm.schedule.cancel": ("WorkforceScheduleCandidateCancelled.v2",),
}

TIM_NEW_QUERY_IDS: Final = frozenset({
    "modern.wfm.forecast.query",
    "modern.wfm.optimization.query",
    "modern.wfm.candidates.query",
    "modern.wfm.candidate.query",
})

SYS_NEW_COMMAND_EVENTS: Final = {
    "modern.listening.survey.revise": ("EmployeeListeningSurveyRevised.v3",),
    "modern.analytics.metric.revise": ("PeopleMetricRevised.v2",),
    "modern.analytics.projection.request": ("PeopleMetricProjectionRequested.v2",),
    "modern.analytics.export.cancel": ("PeopleAnalyticsExportCancelled.v2",),
    "modern.ai.policy.revise": ("GovernedAiPolicyRevised.v2",),
    "modern.ai.evaluation.cancel": ("GovernedAiPolicyEvaluationCancelled.v2",),
    "modern.ai.assist.review": (
        "GovernedAiAssistanceConfirmed.v2", "GovernedAiAssistanceRejected.v2",
    ),
    "modern.ai.assist.revoke": ("GovernedAiAssistanceRevoked.v2",),
    "modern.ai.assist.cancel": ("GovernedAiAssistanceCancelled.v2",),
}

SYS_NEW_QUERY_IDS: Final = frozenset({
    "modern.listening.surveys.query",
    "modern.analytics.metric.query",
    "modern.analytics.projections.query",
    "modern.analytics.projection.query",
    "modern.analytics.exports.query",
    "modern.analytics.export.query",
    "modern.ai.policy.query",
    "modern.ai.evaluations.query",
    "modern.ai.evaluation.query",
    "modern.ai.assistances.query",
    "modern.ai.assistance.query",
})


NEW_COMMAND_EVENTS_BY_SESSION: Final = {
    "HRIS-HRM": HRM_NEW_COMMAND_EVENTS,
    "HRIS-PER": PER_NEW_COMMAND_EVENTS,
    "HRIS-TIM": TIM_NEW_COMMAND_EVENTS,
    "HRIS-SYS": SYS_NEW_COMMAND_EVENTS,
}

NEW_QUERY_IDS_BY_SESSION: Final = {
    "HRIS-HRM": HRM_NEW_QUERY_IDS,
    "HRIS-PER": PER_NEW_QUERY_IDS,
    "HRIS-TIM": TIM_NEW_QUERY_IDS,
    "HRIS-SYS": SYS_NEW_QUERY_IDS,
}


# Non-Listening owner handlers.  Listening contributes its eight exact local
# units directly from sys_listening_canonical_design.py.
NON_LISTENING_HANDLER_EVENTS: Final = {
    "internal.recruiting.offer.expire": "CandidateOfferExpired.v2",
    "internal.recruiting.hire-handoff.result.consume":
        "CandidateHireHandoffResultRecorded.v2",
    "internal.benefits.life-event.expire": "BenefitLifeEventExpired.v2",
    "internal.benefits.provider-result.consume": "BenefitProviderResultRecorded.v2",
    "internal.hrservice.sla-milestone.consume": "HrServiceSlaMilestoneRecorded.v2",
    "internal.contingent.access-grant-result.consume":
        "ContingentAccessGrantResultRecorded.v2",
    "internal.contingent.access-revoke-result.consume":
        "ContingentAccessRevokeResultRecorded.v2",
    "internal.contingent.access-expiry.initiate": "ContingentAccessExpiryInitiated.v2",
    "internal.growth.portability-export.result.consume":
        "GrowthPortabilityExportResultRecorded.v2",
    "internal.growth.portability-export.expire": "GrowthPortabilityExportExpired.v2",
    "internal.wfm.schedule-optimization.result.consume":
        "WorkforceScheduleOptimizationResultRecorded.v2",
    "internal.wfm.approval-result.consume": "WorkforceScheduleApprovalResultRecorded.v2",
    "internal.analytics.metric-projection.result.consume":
        "PeopleMetricProjectionResultRecorded.v2",
    "internal.analytics.export.result.consume": "PeopleAnalyticsExportResultRecorded.v2",
    "internal.analytics.export.expire": "PeopleAnalyticsExportExpired.v2",
    "internal.ai.assistance-result.consume": "GovernedAiAssistanceResultRecorded.v2",
    "internal.ai.policy-evaluation-result.consume":
        "GovernedAiPolicyEvaluationResultRecorded.v2",
    "internal.workforceplan.simulation-result.consume":
        "WorkforceScenarioSimulated.v2",
}

# One handler can close the exact same immutable async request with either a
# successful or failed signed owner result.  The primary event above is the
# success fact; this explicit companion set prevents failure from being hidden
# behind a generic result event or an event-name condition.
NON_LISTENING_HANDLER_ADDITIONAL_EVENTS: Final = {
    "internal.workforceplan.simulation-result.consume": (
        "WorkforceScenarioSimulationFailed.v2",
    ),
}


ADDED_TABLE_IDS: Final = frozenset({
    "ppl_rec_candidate_stage_history",
    "ppl_jny_assignment_revisions",
    "ppl_jny_assignment_task_revisions",
    "ppl_bnf_enrollment_decisions",
    "ppl_bnf_provider_requests",
    "ppl_cwk_classification_receipts",
    "ppl_cwk_access_requests",
    "prf_skl_skill_nodes",
    "prf_skl_skill_edges",
    "prf_skl_proficiency_levels",
    "prf_grw_portability_export_receipts",
    "prf_mkt_application_decisions",
    "tme_wfm_schedule_candidate_versions",
    "sys_hris_metric_projection_requests",
    "sys_hris_ai_assistance_requests",
    # Typed ordered children replace non-relational UUID arrays.  The four
    # publish ledgers are required because their owners otherwise had no
    # immutable version on which to retain the approval proof used to publish.
    "prf_grw_coaching_note_evidence_refs",
    "prf_grw_profile_revision_evidence_refs",
    "prf_lrn_completion_skill_evidence_refs",
    "sys_hris_analytics_export_projection_refs",
    "tme_wfm_schedule_candidate_time_group_refs",
    "ppl_rec_requisition_publish_receipts",
    "prf_lrn_offering_publish_receipts",
    "prf_mkt_opportunity_publish_receipts",
    "prf_suc_publish_receipts",
    # Global-HCM semantic closure: independently versioned definitions,
    # decisions, memberships and async results cannot be reconstructed from a
    # mutable aggregate row or an opaque digest.
    "ppl_rec_offer_decisions",
    "ppl_rec_requisition_versions",
    "ppl_jny_template_task_definitions",
    "ppl_wfp_simulation_requests",
    "ppl_bnf_enrollment_eligibility_receipts",
    "ppl_bnf_dependent_elections",
    "ppl_bnf_life_event_decisions",
    "ppl_cwk_access_receipts",
    "prf_lrn_offering_versions",
    "prf_lrn_capacity_ledger",
    "prf_mkt_opportunity_versions",
    "prf_cmp_proposal_versions",
    "prf_cmp_plan_proposal_refs",
    "tme_wfm_approval_receipts",
    "sys_hris_ai_assistance_reviews",
    "ppl_cwk_engagement_versions",
    "prf_suc_plan_versions",
})


# Reviewed 106->successor table-set delta introduced by this P0 repair.  Each
# row is an identity-preserving structure that cannot be represented by a
# scalar/UUID array or by a mutable aggregate without losing replay proof.
P0_TABLE_SCOPE_CHANGE: Final = {
    "prf_grw_coaching_note_evidence_refs": {
        "ownerSession": "HRIS-PER", "p0Class": "UUID_ARRAY_TO_TYPED_ORDERED_CHILD",
        "producer": "modern.growth.coaching.record",
        "consumers": ["modern.growth.profile.query", "modern.growth.profiles.query", "modern.growth.self.query"],
        "constraint": "parent+ordinal and parent+evidence unique; local parent/evidence FKs",
        "nonReplaceability": "ordered evidence identity and cardinality cannot be preserved in UUID[]",
    },
    "prf_grw_profile_revision_evidence_refs": {
        "ownerSession": "HRIS-PER", "p0Class": "UUID_ARRAY_TO_TYPED_ORDERED_CHILD",
        "producer": "modern.growth.profile.update",
        "consumers": ["modern.growth.profile.query", "modern.growth.profiles.query", "modern.growth.self.query"],
        "constraint": "parent+ordinal and parent+evidence unique; local parent/evidence FKs",
        "nonReplaceability": "ordered revision evidence identity cannot be preserved in UUID[]",
    },
    "prf_lrn_completion_skill_evidence_refs": {
        "ownerSession": "HRIS-PER", "p0Class": "UUID_ARRAY_TO_TYPED_ORDERED_CHILD",
        "producer": "modern.learning.completion.verify",
        "consumers": ["modern.learning.assignment.query", "modern.learning.assignments.query", "LearningCompletionVerified.v2"],
        "constraint": "parent+ordinal and parent+skill-evidence unique; local parent/evidence FKs",
        "nonReplaceability": "event replay needs ordered typed skill-evidence identities, not UUID[]",
    },
    "sys_hris_analytics_export_projection_refs": {
        "ownerSession": "HRIS-SYS", "p0Class": "UUID_ARRAY_TO_TYPED_ORDERED_CHILD",
        "producer": "modern.analytics.export.create",
        "consumers": ["modern.analytics.export.query", "modern.analytics.exports.query"],
        "constraint": "parent+ordinal and parent+projection unique; local parent/projection FKs",
        "nonReplaceability": "export projection order and referential closure cannot be enforced in UUID[]",
    },
    "tme_wfm_schedule_candidate_time_group_refs": {
        "ownerSession": "HRIS-TIM", "p0Class": "UUID_ARRAY_TO_TYPED_ORDERED_CHILD",
        "producer": "internal.wfm.schedule-optimization.result.consume",
        "consumers": ["modern.wfm.candidate.query", "modern.wfm.candidates.query"],
        "constraint": "parent+ordinal and parent+time-group unique; local parent FK and typed TIM.TimeGroup owner ref",
        "nonReplaceability": "candidate time-group order and duplicate rejection cannot be enforced in UUID[]",
    },
    "ppl_rec_requisition_publish_receipts": {
        "ownerSession": "HRIS-HRM", "p0Class": "IMMUTABLE_PUBLICATION_APPROVAL_LEDGER",
        "producer": "modern.recruiting.requisition.publish", "consumers": ["RequisitionPublished.v2"],
        "constraint": "local parent FK; parent+fact revision/ordinal unique; append-only typed approval tuple",
        "nonReplaceability": "mutable requisition has no immutable row for restart-safe publication proof",
    },
    "prf_lrn_offering_publish_receipts": {
        "ownerSession": "HRIS-PER", "p0Class": "IMMUTABLE_PUBLICATION_APPROVAL_LEDGER",
        "producer": "modern.learning.offering.publish", "consumers": ["LearningOfferingPublished.v2"],
        "constraint": "local parent FK; parent+fact revision/ordinal unique; append-only typed approval tuple",
        "nonReplaceability": "mutable offering has no immutable row for restart-safe publication proof",
    },
    "prf_mkt_opportunity_publish_receipts": {
        "ownerSession": "HRIS-PER", "p0Class": "IMMUTABLE_PUBLICATION_APPROVAL_LEDGER",
        "producer": "modern.opportunity.publish", "consumers": ["TalentOpportunityPublished.v2"],
        "constraint": "local parent FK; parent+fact revision/ordinal unique; append-only typed approval tuple",
        "nonReplaceability": "mutable opportunity has no immutable row for restart-safe publication proof",
    },
    "prf_suc_publish_receipts": {
        "ownerSession": "HRIS-PER", "p0Class": "IMMUTABLE_PUBLICATION_APPROVAL_LEDGER",
        "producer": "modern.succession.plan.publish", "consumers": ["SuccessionPlanPublished.v2"],
        "constraint": "local parent FK; parent+fact revision/ordinal unique; append-only typed approval tuple",
        "nonReplaceability": "mutable succession plan has no immutable row for restart-safe publication proof",
    },
    "ppl_rec_offer_decisions": {
        "ownerSession": "HRIS-HRM", "p0Class": "IMMUTABLE_SUBJECT_OR_PROXY_DECISION",
        "producer": "modern.recruiting.offer.respond", "consumers": ["modern.recruiting.candidate.query", "CandidateOfferAccepted.v2", "CandidateOfferDeclined.v2"],
        "constraint": "offer parent+decision revision unique; actor/source/delegation proof append-only",
        "nonReplaceability": "mutable offer status cannot reproduce who accepted or declined and under which delegation",
    },
    "ppl_rec_requisition_versions": {
        "ownerSession": "HRIS-HRM", "p0Class": "EFFECTIVE_DATED_IMMUTABLE_VERSION",
        "producer": "modern.recruiting.requisition.revise", "consumers": ["modern.recruiting.requisition.query"],
        "constraint": "parent+root version unique; visible base segments (segment_revision=1) have one effective_from boundary; corrections reuse the segment/effective_from and effective_to is NULL-only; dual predecessor lineage",
        "nonReplaceability": "a digest on the mutable requisition cannot provide correction/supersession history",
    },
    "ppl_jny_template_task_definitions": {
        "ownerSession": "HRIS-HRM", "p0Class": "TYPED_VERSIONED_TASK_DEFINITION",
        "producer": "modern.onboarding.template.create", "consumers": ["modern.onboarding.template.query", "modern.onboarding.assignment.query"],
        "constraint": "template version+task key/ordinal unique; local parent FK",
        "nonReplaceability": "actor, due, condition and evidence policy require typed independently addressable children",
    },
    "ppl_wfp_simulation_requests": {
        "ownerSession": "HRIS-HRM", "p0Class": "IMMUTABLE_ASYNC_SIMULATION_REQUEST_RESULT",
        "producer": "modern.workforceplan.scenario.simulate", "consumers": ["modern.workforceplan.scenario.query"],
        "constraint": "scenario revision+request revision unique; immutable result owner receipt",
        "nonReplaceability": "result digest alone cannot refetch or replay typed simulation output",
    },
    "ppl_bnf_enrollment_eligibility_receipts": {
        "ownerSession": "HRIS-HRM", "p0Class": "IMMUTABLE_ELIGIBILITY_DECISION",
        "producer": "modern.benefits.enrollment.submit", "consumers": ["modern.benefits.enrollment.query"],
        "constraint": "enrollment+decision revision unique; exact policy/snapshot receipt",
        "nonReplaceability": "eligibility at enrollment time cannot be recomputed from a later mutable policy",
    },
    "ppl_bnf_dependent_elections": {
        "ownerSession": "HRIS-HRM", "p0Class": "TYPED_DEPENDENT_ELECTION_CHILD",
        "producer": "modern.benefits.enrollment.submit", "consumers": ["modern.benefits.enrollment.query"],
        "constraint": "enrollment+ordinal and relationship token unique; local parent FK",
        "nonReplaceability": "dependent coverage cardinality and option association cannot be enforced in an opaque token array",
    },
    "ppl_bnf_life_event_decisions": {
        "ownerSession": "HRIS-HRM", "p0Class": "IMMUTABLE_SUBJECT_OR_PROXY_DECISION",
        "producer": "modern.benefits.lifeevent.decide", "consumers": ["modern.benefits.lifeevent.query"],
        "constraint": "life event+decision revision unique; actor/source/delegation proof append-only",
        "nonReplaceability": "life-event status does not retain decision authority and evidence",
    },
    "ppl_cwk_access_receipts": {
        "ownerSession": "HRIS-HRM", "p0Class": "IMMUTABLE_ACCESS_RESULT",
        "producer": "internal.contingent.access-grant-result.consume", "consumers": ["modern.contingent.engagement.query"],
        "constraint": "access request+result revision unique; local request/engagement FKs",
        "nonReplaceability": "grant and revoke owner results are distinct from expiry initiation and mutable engagement state",
    },
    "prf_lrn_offering_versions": {
        "ownerSession": "HRIS-PER", "p0Class": "IMMUTABLE_EXECUTABLE_OFFERING_VERSION",
        "producer": "modern.learning.offering.create", "consumers": ["modern.learning.catalog.query", "modern.learning.offering.query"],
        "constraint": "offering+root version unique; visible base segments (segment_revision=1) have one effective_from boundary; corrections reuse the segment/effective_from and effective_to is NULL-only; dual predecessor lineage",
        "nonReplaceability": "content, delivery, capacity, eligibility and skill mapping must remain exactly refetchable",
    },
    "prf_lrn_capacity_ledger": {
        "ownerSession": "HRIS-PER", "p0Class": "IMMUTABLE_CAPACITY_RESERVATION_LEDGER",
        "producer": "modern.learning.self.enroll", "consumers": ["modern.learning.assignment.query"],
        "constraint": "offering version+sequence unique; reservation identity idempotent",
        "nonReplaceability": "concurrent capacity and waitlist outcomes cannot be represented by an offering counter",
    },
    "prf_mkt_opportunity_versions": {
        "ownerSession": "HRIS-PER", "p0Class": "IMMUTABLE_OPPORTUNITY_CRITERIA_VERSION",
        "producer": "modern.opportunity.create", "consumers": ["modern.opportunity.catalog.query", "modern.opportunity.query"],
        "constraint": "opportunity+root version unique; visible base segments (segment_revision=1) have one effective_from boundary; corrections reuse the segment/effective_from and effective_to is NULL-only; dual predecessor lineage",
        "nonReplaceability": "criteria, capacity and skill mappings must be frozen for each application decision",
    },
    "prf_cmp_proposal_versions": {
        "ownerSession": "HRIS-PER", "p0Class": "IMMUTABLE_COMPENSATION_PROPOSAL_VERSION",
        "producer": "modern.compplan.proposal.upsert", "consumers": ["modern.compplan.proposal.query"],
        "constraint": "proposal+version unique; original Money and effective basis append-only",
        "nonReplaceability": "CAS on the proposal root cannot reconstruct approved historical money facts",
    },
    "prf_cmp_plan_proposal_refs": {
        "ownerSession": "HRIS-PER", "p0Class": "IMMUTABLE_APPROVED_PLAN_MEMBERSHIP",
        "producer": "modern.compplan.plan.approve", "consumers": ["modern.compplan.cycle.query"],
        "constraint": "plan revision+ordinal/proposal version unique; local plan/proposal FKs",
        "nonReplaceability": "an approved plan must freeze exact proposal identities and versions",
    },
    "tme_wfm_approval_receipts": {
        "ownerSession": "HRIS-TIM", "p0Class": "IMMUTABLE_SCHEDULE_APPROVAL_RESULT",
        "producer": "internal.wfm.approval-result.consume", "consumers": ["modern.wfm.candidate.query"],
        "constraint": "candidate revision+approval result revision unique; decision proof append-only",
        "nonReplaceability": "mutable approval request and candidate state cannot reproduce the signed approval result",
    },
    "sys_hris_ai_assistance_reviews": {
        "ownerSession": "HRIS-SYS", "p0Class": "IMMUTABLE_HUMAN_AI_REVIEW_DECISION",
        "producer": "modern.ai.assist.review", "consumers": ["modern.ai.assistance.query", "GovernedAiAssistanceConfirmed.v2", "GovernedAiAssistanceRejected.v2"],
        "constraint": "assistance+review revision unique; human actor/source/reason/delegation proof append-only",
        "nonReplaceability": "AI result provenance proves generation, not the distinct human confirmation or rejection decision",
    },
    "ppl_cwk_engagement_versions": {
        "ownerSession": "HRIS-HRM", "p0Class": "EFFECTIVE_DATED_IMMUTABLE_VERSION",
        "producer": "modern.contingent.engagement.revise", "consumers": ["modern.contingent.engagement.query"],
        "constraint": "engagement+root version unique; visible base segments (segment_revision=1) have one effective_from boundary; corrections reuse the segment/effective_from and effective_to is NULL-only; dual root/segment predecessor lineage",
        "nonReplaceability": "the stable engagement root cannot preserve past classification/access/effective revisions",
    },
    "prf_suc_plan_versions": {
        "ownerSession": "HRIS-PER", "p0Class": "RESTRICTED_EFFECTIVE_DATED_IMMUTABLE_VERSION",
        "producer": "modern.succession.plan.revise", "consumers": ["modern.succession.plan.query"],
        "constraint": "plan+root version unique; restricted visible base segments (segment_revision=1) have one effective_from boundary; corrections reuse the segment/effective_from and effective_to is NULL-only; dual predecessor lineage",
        "nonReplaceability": "the stable plan root cannot freeze audience policy, content and effective revision history",
    },
}


REVIEWED_106_TO_115_TABLE_IDS: Final = frozenset({
    "prf_grw_coaching_note_evidence_refs",
    "prf_grw_profile_revision_evidence_refs",
    "prf_lrn_completion_skill_evidence_refs",
    "sys_hris_analytics_export_projection_refs",
    "tme_wfm_schedule_candidate_time_group_refs",
    "ppl_rec_requisition_publish_receipts",
    "prf_lrn_offering_publish_receipts",
    "prf_mkt_opportunity_publish_receipts",
    "prf_suc_publish_receipts",
})
CURRENT_115_TO_131_TABLE_SCOPE_CHANGE: Final = {
    table_id: {
        **row,
        "producers": {
            "ppl_jny_template_task_definitions": [
                "modern.onboarding.template.create",
                "modern.onboarding.template.revise",
            ],
            "ppl_rec_requisition_versions": [
                "modern.recruiting.requisition.create",
                "modern.recruiting.requisition.lifecycle.change",
                "modern.recruiting.requisition.publish",
                "modern.recruiting.requisition.revise",
            ],
            "ppl_cwk_access_receipts": [
                "internal.contingent.access-grant-result.consume",
                "internal.contingent.access-revoke-result.consume",
            ],
            "ppl_cwk_engagement_versions": [
                "internal.contingent.access-expiry.initiate",
                "internal.contingent.access-grant-result.consume",
                "internal.contingent.access-revoke-result.consume",
                "modern.contingent.engagement.activate",
                "modern.contingent.engagement.create",
                "modern.contingent.engagement.offboard",
                "modern.contingent.engagement.reject",
                "modern.contingent.engagement.revise",
                "modern.contingent.engagement.submit",
                "modern.contingent.sponsor.reassign",
            ],
            "prf_lrn_offering_versions": [
                "modern.learning.offering.create",
                "modern.learning.offering.publish",
                "modern.learning.offering.retire",
                "modern.learning.offering.revise",
            ],
            "prf_lrn_capacity_ledger": [
                "modern.learning.assignment.cancel",
                "modern.learning.assignment.create",
                "modern.learning.self.enroll",
            ],
            "prf_mkt_opportunity_versions": [
                "modern.opportunity.cancel",
                "modern.opportunity.close",
                "modern.opportunity.create",
                "modern.opportunity.publish",
                "modern.opportunity.revise",
            ],
            "prf_suc_plan_versions": [
                "modern.succession.nomination.add",
                "modern.succession.nomination.withdraw",
                "modern.succession.plan.approve",
                "modern.succession.plan.create",
                "modern.succession.plan.publish",
                "modern.succession.plan.reject",
                "modern.succession.plan.retire",
                "modern.succession.plan.revise",
                "modern.succession.plan.submit",
                "modern.succession.readiness.record",
            ],
            "ppl_wfp_simulation_requests": [
                "modern.workforceplan.scenario.simulate",
                "internal.workforceplan.simulation-result.consume",
                "modern.workforceplan.scenario.cancel",
            ],
            "sys_hris_ai_assistance_reviews": [
                "modern.ai.assist.review",
                "modern.ai.assist.revoke",
            ],
        }.get(table_id, [row["producer"]]),
        "readConsumers": {
            "ppl_rec_offer_decisions": [
                "modern.recruiting.candidate.query",
                "modern.recruiting.candidates.query",
            ],
            "ppl_rec_requisition_versions": [
                "modern.recruiting.requisition.query",
                "modern.recruiting.requisitions.query",
            ],
            "ppl_jny_template_task_definitions": [
                "modern.onboarding.template.query", "modern.onboarding.templates.query",
                "modern.onboarding.assignment.query", "modern.onboarding.assignments.query",
                "modern.onboarding.self.query",
            ],
            "ppl_wfp_simulation_requests": [
                "modern.workforceplan.scenario.query", "modern.workforceplan.scenarios.query",
            ],
            "ppl_bnf_enrollment_eligibility_receipts": [
                "modern.benefits.enrollment.query", "modern.benefits.enrollments.query",
            ],
            "ppl_bnf_dependent_elections": [
                "modern.benefits.enrollment.query", "modern.benefits.enrollments.query",
            ],
            "ppl_bnf_life_event_decisions": [
                "modern.benefits.lifeevent.query", "modern.benefits.lifeevents.query",
            ],
            "ppl_cwk_access_receipts": [
                "modern.contingent.engagement.query",
                "modern.contingent.engagements.query",
            ],
            "ppl_cwk_engagement_versions": [
                "modern.contingent.engagement.query", "modern.contingent.engagements.query",
            ],
            "prf_lrn_offering_versions": [
                "modern.learning.offering.query", "modern.learning.catalog.query",
            ],
            "prf_lrn_capacity_ledger": [
                "modern.learning.assignment.query", "modern.learning.assignments.query",
            ],
            "prf_mkt_opportunity_versions": [
                "modern.opportunity.query", "modern.opportunity.catalog.query",
                "modern.opportunity.application.query",
                "modern.opportunity.applications.query",
            ],
            "prf_suc_plan_versions": [
                "modern.succession.plan.query", "modern.succession.plans.query",
            ],
            "prf_cmp_proposal_versions": [
                "modern.compplan.proposal.query", "modern.compplan.proposals.query",
            ],
            "prf_cmp_plan_proposal_refs": [
                "modern.compplan.cycle.query", "modern.compplan.cycles.query",
                "modern.compplan.proposal.query", "modern.compplan.proposals.query",
            ],
            "tme_wfm_approval_receipts": [
                "modern.wfm.candidate.query", "modern.wfm.candidates.query",
            ],
            "sys_hris_ai_assistance_reviews": [
                "modern.ai.assistance.query", "modern.ai.assistances.query",
            ],
        }[table_id],
        "requirementIds": {
            "ppl_rec_offer_decisions": ["P0-REC-001", "P1-DECISION-003"],
            "ppl_rec_requisition_versions": ["P0-REC-001", "P1-EFFECTIVE-004"],
            "ppl_jny_template_task_definitions": ["P0-ONB-001"],
            "ppl_wfp_simulation_requests": ["P0-WFP-001"],
            "ppl_bnf_enrollment_eligibility_receipts": ["P0-BNF-001"],
            "ppl_bnf_dependent_elections": ["P0-BNF-001"],
            "ppl_bnf_life_event_decisions": ["P0-BNF-001", "P1-DECISION-003"],
            "ppl_cwk_access_receipts": ["P0-CWK-001"],
            "ppl_cwk_engagement_versions": ["P0-CWK-001", "P1-EFFECTIVE-004"],
            "prf_lrn_offering_versions": ["P0-LRN-001", "P1-EFFECTIVE-004"],
            "prf_lrn_capacity_ledger": ["P0-LRN-001"],
            "prf_mkt_opportunity_versions": ["P0-MKT-001"],
            "prf_suc_plan_versions": ["P0-SUC-001", "P1-EFFECTIVE-004"],
            "prf_cmp_proposal_versions": ["P0-CMP-001"],
            "prf_cmp_plan_proposal_refs": ["P0-CMP-001"],
            "tme_wfm_approval_receipts": ["P0-WFM-001"],
            "sys_hris_ai_assistance_reviews": ["P0-AI-001"],
        }[table_id],
    }
    for table_id, row in P0_TABLE_SCOPE_CHANGE.items()
    if table_id not in REVIEWED_106_TO_115_TABLE_IDS
}
FROZEN_115_TABLE_SET_SHA256: Final = (
    "7a8805795efade4334baa3a6f91d6180b1a0bb4ecec118688e25e86cebd2f2cd"
)

# This orphan was present in the frozen 115-table baseline.  Listening has no
# producer or consumer for it; the same-owner analytics export lifecycle is
# already represented by sys_hris_analytics_export_receipts.  Preserve the
# baseline evidence and express the disposition as an explicit successor
# removal rather than silently retaining an unimplementable table.
CURRENT_115_REMOVED_TABLE_IDS: Final = frozenset({
    "sys_hris_listening_export_receipts",
})

LEGACY_LISTENING_TABLE_IDS: Final = frozenset({
    "sys_hris_listening_surveys",
    "sys_hris_listening_responses",
    "sys_hris_listening_cohort_results",
    "sys_hris_listening_actions",
})


# Public events removed from the predecessor event catalogue.  Existing events
# not named here remain in the successor (possibly with a version/name rewrite
# performed by the canonical projection).
REMOVED_PUBLIC_EVENT_IDS: Final = frozenset({
    "ContingentEngagementClosed.v2",
    "EmployeeListeningResponseSubmitted.v2",
    "CandidateHired.v2",
    "ContingentAccessExpired.v2",
    "WorkforceScheduleCandidateGenerated.v2",
    "GovernedAiPolicyEvaluationCompleted.v2",
})


# Existing command event names whose causal meaning changes without changing
# the operation identifier.  Every replacement is explicit.
REPLACED_PUBLIC_EVENT_IDS: Final = {
    "EmployeeListeningSurveyCreated.v2": "EmployeeListeningSurveyCreated.v3",
    "EmployeeListeningSurveyPublished.v2": "EmployeeListeningSurveyPublished.v3",
    "EmployeeListeningSurveyClosed.v2": "EmployeeListeningSurveyClosed.v3",
    "EmployeeListeningActionCreated.v2": "EmployeeListeningActionCreated.v3",
    "EmployeeListeningActionCompleted.v2": "EmployeeListeningActionCompleted.v3",
    "ContingentEngagementActivated.v2": "ContingentAccessGrantRequested.v2",
    "GovernedAiAssistanceProduced.v2": "GovernedAiAssistanceRequested.v2",
    "WorkforceScenarioSimulated.v2": "WorkforceScenarioSimulationRequested.v2",
}


PUBLISH_OPERATION_IDS: Final = frozenset({
    "modern.recruiting.requisition.publish",
    "modern.onboarding.template.publish",
    "modern.workforceplan.scenario.publish",
    "modern.benefits.plan.publish",
    "modern.skills.taxonomy.publish",
    "modern.learning.offering.publish",
    "modern.opportunity.publish",
    "modern.succession.plan.publish",
    "modern.compplan.snapshot.publish",
    "modern.wfm.schedule.publish",
    "modern.listening.survey.publish",
    "modern.analytics.metric.publish",
    "modern.ai.policy.publish",
})

DIRECT_APPROVAL_PUBLISH_IDS: Final = frozenset({
    "modern.recruiting.requisition.publish",
    "modern.onboarding.template.publish",
    "modern.benefits.plan.publish",
    "modern.skills.taxonomy.publish",
    "modern.learning.offering.publish",
    "modern.opportunity.publish",
    "modern.listening.survey.publish",
    "modern.analytics.metric.publish",
})

FROZEN_APPROVAL_PUBLISH_IDS: Final = frozenset({
    "modern.workforceplan.scenario.publish",
    "modern.succession.plan.publish",
    "modern.compplan.snapshot.publish",
})

SPECIAL_PROOF_PUBLISH_IDS: Final = frozenset({
    "modern.wfm.schedule.publish",
    "modern.ai.policy.publish",
})


def all_new_operation_ids() -> frozenset[str]:
    commands = {
        operation_id
        for operations in NEW_COMMAND_EVENTS_BY_SESSION.values()
        for operation_id in operations
    }
    queries = {
        operation_id
        for operations in NEW_QUERY_IDS_BY_SESSION.values()
        for operation_id in operations
    }
    return frozenset(commands | queries)


def session_for_new_operation(operation_id: str) -> str:
    matches = [
        session
        for session, operations in NEW_COMMAND_EVENTS_BY_SESSION.items()
        if operation_id in operations
    ] + [
        session
        for session, operations in NEW_QUERY_IDS_BY_SESSION.items()
        if operation_id in operations
    ]
    if len(matches) != 1:
        raise ValueError(f"new operation has non-exact session ownership: {operation_id}")
    return matches[0]


def mode_for_new_operation(operation_id: str) -> str:
    if any(operation_id in rows for rows in NEW_COMMAND_EVENTS_BY_SESSION.values()):
        return "COMMAND"
    if any(operation_id in rows for rows in NEW_QUERY_IDS_BY_SESSION.values()):
        return "QUERY"
    raise ValueError(f"unknown new operation: {operation_id}")


def events_for_new_operation(operation_id: str) -> tuple[str, ...]:
    for operations in NEW_COMMAND_EVENTS_BY_SESSION.values():
        if operation_id in operations:
            return operations[operation_id]
    if any(operation_id in rows for rows in NEW_QUERY_IDS_BY_SESSION.values()):
        return ()
    raise ValueError(f"unknown new operation: {operation_id}")


# Runtime metadata is deliberately operation-specific.  It is kept separate
# from the compact ID registry above so count closure can be reviewed without
# accidentally accepting a merely plausible path/root inferred from a name.
# Tuple: (template operation, path, aggregate root, state column, pre states,
# post states, post-state source, ordered business write tables).
NEW_COMMAND_RUNTIME: Final = {
    "modern.recruiting.requisition.revise": (
        "modern.recruiting.requisition.publish", "/api/people/v1/hris/recruiting/requisitions/{requisitionId}/revisions",
        "ppl_rec_requisitions", "status", ("DRAFT",), ("DRAFT",), "CONSTANT:DRAFT",
        ("ppl_rec_requisitions",)),
    "modern.recruiting.requisition.lifecycle.change": (
        "modern.recruiting.requisition.publish", "/api/people/v1/hris/recruiting/requisitions/{requisitionId}/lifecycle",
        "ppl_rec_requisitions", "status", ("OPEN", "PAUSED"), ("OPEN", "PAUSED", "CLOSED"), "body.targetState",
        ("ppl_rec_requisitions",)),
    "modern.recruiting.candidate.admit": (
        "modern.recruiting.candidate.stage", "/api/people/v1/hris/recruiting/requisitions/{requisitionId}/candidates",
        "ppl_rec_candidate_cases", "stage", ("NONE",), ("APPLIED",), "CONSTANT:APPLIED",
        ("ppl_rec_candidate_cases", "ppl_rec_candidate_stage_history")),
    "modern.recruiting.offer.respond": (
        "modern.recruiting.offer.issue", "/api/people/v1/hris/recruiting/offers/{offerId}/response",
        "ppl_rec_offers", "status", ("ISSUED",), ("ACCEPTED", "DECLINED"), "body.decision",
        ("ppl_rec_offers", "ppl_rec_candidate_cases")),
    "modern.recruiting.offer.withdraw": (
        "modern.recruiting.offer.issue", "/api/people/v1/hris/recruiting/offers/{offerId}/withdraw",
        "ppl_rec_offers", "status", ("ISSUED",), ("WITHDRAWN",), "CONSTANT:WITHDRAWN",
        ("ppl_rec_offers", "ppl_rec_candidate_cases")),
    "modern.recruiting.hire.cancel": (
        "modern.recruiting.hire.record", "/api/people/v1/hris/recruiting/hire-requests/{hireRequestId}/cancel",
        "ppl_rec_hire_requests", "status", ("REQUESTED",), ("CANCELLED",), "CONSTANT:CANCELLED",
        ("ppl_rec_hire_requests", "ppl_rec_candidate_cases")),
    "modern.onboarding.template.revise": (
        "modern.onboarding.template.publish", "/api/people/v1/hris/onboarding/templates/{templateId}/revisions",
        "ppl_jny_template_versions", "status", ("DRAFT",), ("DRAFT",), "CONSTANT:DRAFT",
        ("ppl_jny_templates", "ppl_jny_template_versions")),
    "modern.onboarding.template.retire": (
        "modern.onboarding.template.publish", "/api/people/v1/hris/onboarding/templates/{templateId}/retire",
        "ppl_jny_template_versions", "status", ("PUBLISHED",), ("RETIRED",), "CONSTANT:RETIRED",
        ("ppl_jny_templates", "ppl_jny_template_versions")),
    "modern.onboarding.task.waive": (
        "modern.onboarding.task.complete", "/api/people/v1/hris/onboarding/assignments/{assignmentId}/tasks/{taskId}/waive",
        "ppl_jny_assignment_tasks", "status", ("PENDING",), ("WAIVED",), "CONSTANT:WAIVED",
        ("ppl_jny_task_evidence", "ppl_jny_assignment_tasks", "ppl_jny_assignments")),
    "modern.workforceplan.scenario.revise": (
        "modern.workforceplan.scenario.simulate", "/api/people/v1/hris/workforce-planning/scenarios/{scenarioId}/revisions",
        "ppl_wfp_scenarios", "status", ("DRAFT", "SIMULATED"), ("DRAFT",), "CONSTANT:DRAFT",
        ("ppl_wfp_scenarios", "ppl_wfp_scenario_revisions")),
    "modern.workforceplan.scenario.cancel": (
        "modern.workforceplan.scenario.submit", "/api/people/v1/hris/workforce-planning/scenarios/{scenarioId}/cancel",
        "ppl_wfp_scenarios", "status", ("DRAFT", "SIMULATED", "PENDING_APPROVAL"), ("CANCELLED",), "CONSTANT:CANCELLED",
        ("ppl_wfp_scenarios", "ppl_wfp_scenario_revisions")),
    "modern.benefits.plan.revise": (
        "modern.benefits.plan.publish", "/api/people/v1/hris/benefits/plans/{planId}/revisions",
        "ppl_bnf_plan_versions", "status", ("DRAFT",), ("DRAFT",), "CONSTANT:DRAFT",
        ("ppl_bnf_plans", "ppl_bnf_plan_versions")),
    "modern.benefits.plan.retire": (
        "modern.benefits.plan.publish", "/api/people/v1/hris/benefits/plans/{planId}/retire",
        "ppl_bnf_plan_versions", "status", ("PUBLISHED",), ("RETIRED",), "CONSTANT:RETIRED",
        ("ppl_bnf_plans", "ppl_bnf_plan_versions")),
    "modern.benefits.enrollment.cancel": (
        "modern.benefits.enrollment.decide", "/api/people/v1/hris/benefits/enrollments/{enrollmentId}/cancel",
        "ppl_bnf_enrollments", "status", ("SUBMITTED", "ACTIVE"), ("CANCELLED",), "CONSTANT:CANCELLED",
        ("ppl_bnf_enrollments",)),
    "modern.benefits.lifeevent.decide": (
        "modern.benefits.enrollment.decide", "/api/people/v1/hris/benefits/life-events/{lifeEventId}/decision",
        "ppl_bnf_life_events", "status", ("PENDING",), ("VERIFIED", "REJECTED"), "body.decision",
        ("ppl_bnf_life_events",)),
    "modern.hrservice.case.cancel": (
        "modern.hrservice.case.resolve", "/api/people/v1/hris/hr-service/cases/{caseId}/cancel",
        "ppl_hrs_cases", "status", ("OPEN", "TRIAGED", "IN_PROGRESS", "WAITING"), ("CANCELLED",), "CONSTANT:CANCELLED",
        ("ppl_hrs_cases", "ppl_hrs_case_actions")),
    "modern.contingent.engagement.revise": (
        "modern.contingent.engagement.submit", "/api/people/v1/hris/contingent/engagements/{engagementId}/revisions",
        "ppl_cwk_engagements", "status", ("DRAFT",), ("DRAFT",), "CONSTANT:DRAFT",
        ("ppl_cwk_engagements",)),
    "modern.contingent.engagement.reject": (
        "modern.contingent.engagement.submit", "/api/people/v1/hris/contingent/engagements/{engagementId}/reject",
        "ppl_cwk_engagements", "status", ("PENDING_APPROVAL",), ("REJECTED",), "CONSTANT:REJECTED",
        ("ppl_cwk_engagements",)),
    "modern.contingent.sponsor.reassign": (
        "modern.contingent.engagement.submit", "/api/people/v1/hris/contingent/engagements/{engagementId}/sponsor",
        "ppl_cwk_engagements", "status", ("DRAFT", "PENDING_APPROVAL", "ACTIVE"), ("DRAFT", "PENDING_APPROVAL", "ACTIVE"), "LOCKED_PRE:ppl_cwk_engagements.status",
        ("ppl_cwk_engagements", "ppl_cwk_sponsor_assignments")),

    "modern.skills.taxonomy.revise": (
        "modern.skills.taxonomy.validate", "/api/performance/v1/hris/skills/taxonomies/{taxonomyId}/revisions",
        "prf_skl_taxonomy_versions", "status", ("DRAFT", "VALIDATED"), ("DRAFT",), "CONSTANT:DRAFT",
        ("prf_skl_taxonomies", "prf_skl_taxonomy_versions", "prf_skl_skill_nodes", "prf_skl_skill_edges", "prf_skl_proficiency_levels")),
    "modern.skills.taxonomy.retire": (
        "modern.skills.taxonomy.publish", "/api/performance/v1/hris/skills/taxonomies/{taxonomyId}/retire",
        "prf_skl_taxonomy_versions", "status", ("PUBLISHED",), ("RETIRED",), "CONSTANT:RETIRED",
        ("prf_skl_taxonomies", "prf_skl_taxonomy_versions")),
    "modern.skills.evidence.record": (
        "modern.skills.evidence.verify", "/api/performance/v1/hris/skills/evidence",
        "prf_skl_worker_evidence", "status", ("NONE",), ("PENDING",), "CONSTANT:PENDING",
        ("prf_skl_worker_evidence",)),
    "modern.skills.evidence.revoke": (
        "modern.skills.evidence.verify", "/api/performance/v1/hris/skills/evidence/{evidenceId}/revoke",
        "prf_skl_worker_evidence", "status", ("PENDING", "VERIFIED"), ("REVOKED",), "CONSTANT:REVOKED",
        ("prf_skl_worker_evidence",)),
    "modern.growth.evidence.unlink": (
        "modern.growth.evidence.link", "/api/performance/v1/hris/growth/profiles/{profileId}/evidence/{evidenceLinkId}",
        "prf_grw_profiles", "status", ("ACTIVE",), ("ACTIVE",), "CONSTANT:ACTIVE",
        ("prf_grw_profiles", "prf_grw_evidence_links")),
    "modern.growth.export.request": (
        "modern.growth.profile.archive", "/api/performance/v1/hris/growth/profiles/{profileId}/exports",
        "prf_grw_portability_export_receipts", "state", ("NONE",), ("REQUESTED",), "CONSTANT:REQUESTED",
        ("prf_grw_portability_export_receipts",)),
    "modern.growth.export.cancel": (
        "modern.growth.profile.archive", "/api/performance/v1/hris/growth/exports/{exportId}/cancel",
        "prf_grw_portability_export_receipts", "state", ("REQUESTED", "GENERATING"), ("CANCELLED",), "CONSTANT:CANCELLED",
        ("prf_grw_portability_export_receipts",)),
    "modern.learning.offering.revise": (
        "modern.learning.offering.publish", "/api/performance/v1/hris/learning/offerings/{offeringId}/revisions",
        "prf_lrn_offerings", "status", ("DRAFT",), ("DRAFT",), "CONSTANT:DRAFT",
        ("prf_lrn_offerings",)),
    "modern.learning.offering.retire": (
        "modern.learning.offering.publish", "/api/performance/v1/hris/learning/offerings/{offeringId}/retire",
        "prf_lrn_offerings", "status", ("PUBLISHED",), ("RETIRED",), "CONSTANT:RETIRED",
        ("prf_lrn_offerings",)),
    "modern.learning.assignment.create": (
        "modern.learning.self.enroll", "/api/performance/v1/hris/learning/assignments",
        "prf_lrn_assignments", "status", ("NONE",), ("ENROLLED",), "CONSTANT:ENROLLED",
        ("prf_lrn_assignments",)),
    "modern.learning.assignment.cancel": (
        "modern.learning.assignment.start", "/api/performance/v1/hris/learning/assignments/{assignmentId}/cancel",
        "prf_lrn_assignments", "status", ("ENROLLED", "IN_PROGRESS"), ("CANCELLED",), "CONSTANT:CANCELLED",
        ("prf_lrn_assignments",)),
    "modern.opportunity.revise": (
        "modern.opportunity.publish", "/api/performance/v1/hris/opportunities/{opportunityId}/revisions",
        "prf_mkt_opportunities", "status", ("DRAFT",), ("DRAFT",), "CONSTANT:DRAFT",
        ("prf_mkt_opportunities",)),
    "modern.opportunity.close": (
        "modern.opportunity.publish", "/api/performance/v1/hris/opportunities/{opportunityId}/close",
        "prf_mkt_opportunities", "status", ("OPEN",), ("CLOSED",), "CONSTANT:CLOSED",
        ("prf_mkt_opportunities",)),
    "modern.opportunity.cancel": (
        "modern.opportunity.publish", "/api/performance/v1/hris/opportunities/{opportunityId}/cancel",
        "prf_mkt_opportunities", "status", ("DRAFT", "OPEN"), ("CANCELLED",), "CONSTANT:CANCELLED",
        ("prf_mkt_opportunities",)),
    "modern.opportunity.application.withdraw": (
        "modern.opportunity.selection.record", "/api/performance/v1/hris/opportunity-applications/{applicationId}/withdraw",
        "prf_mkt_applications", "status", ("APPLIED", "SHORTLISTED"), ("WITHDRAWN",), "CONSTANT:WITHDRAWN",
        ("prf_mkt_applications",)),
    "modern.succession.plan.revise": (
        "modern.succession.plan.submit", "/api/performance/v1/hris/succession/plans/{planId}/revisions",
        "prf_suc_plans", "status", ("DRAFT",), ("DRAFT",), "CONSTANT:DRAFT",
        ("prf_suc_plans",)),
    "modern.succession.plan.reject": (
        "modern.succession.plan.approve", "/api/performance/v1/hris/succession/plans/{planId}/reject",
        "prf_suc_plans", "status", ("PENDING_APPROVAL",), ("REJECTED",), "CONSTANT:REJECTED",
        ("prf_suc_plans",)),
    "modern.succession.nomination.withdraw": (
        "modern.succession.nomination.add", "/api/performance/v1/hris/succession/plans/{planId}/nominations/{nominationId}/withdraw",
        "prf_suc_nominations", "status", ("ACTIVE",), ("WITHDRAWN",), "CONSTANT:WITHDRAWN",
        ("prf_suc_nominations", "prf_suc_plans")),
    "modern.succession.readiness.record": (
        "modern.succession.nomination.add", "/api/performance/v1/hris/succession/plans/{planId}/readiness-evidence",
        "prf_suc_plans", "status", ("DRAFT",), ("DRAFT",), "CONSTANT:DRAFT",
        ("prf_suc_readiness_evidence", "prf_suc_plans")),
    "modern.succession.plan.retire": (
        "modern.succession.plan.publish", "/api/performance/v1/hris/succession/plans/{planId}/retire",
        "prf_suc_plans", "status", ("PUBLISHED",), ("RETIRED",), "CONSTANT:RETIRED",
        ("prf_suc_plans",)),
    "modern.compplan.cycle.revise": (
        "modern.compplan.cycle.create", "/api/performance/v1/hris/compensation/cycles/{cycleId}/revisions",
        "prf_cmp_cycles", "status", ("DRAFT", "OPEN"), ("DRAFT", "OPEN"), "LOCKED_PRE:prf_cmp_cycles.status",
        ("prf_cmp_cycles",)),
    "modern.compplan.proposal.upsert": (
        "modern.compplan.proposal.submit", "/api/performance/v1/hris/compensation/cycles/{cycleId}/proposals/{proposalId}",
        "prf_cmp_proposals", "status", ("NONE", "DRAFT"), ("DRAFT",), "CONSTANT:DRAFT",
        ("prf_cmp_proposals",)),
    "modern.compplan.cycle.cancel": (
        "modern.compplan.cycle.create", "/api/performance/v1/hris/compensation/cycles/{cycleId}/cancel",
        "prf_cmp_cycles", "status", ("DRAFT", "OPEN"), ("CANCELLED",), "CONSTANT:CANCELLED",
        ("prf_cmp_cycles",)),

    "modern.wfm.optimization.cancel": (
        "modern.wfm.schedule.optimize", "/api/time/v1/hris/wfm/optimizations/{optimizationId}/cancel",
        "tme_wfm_optimization_requests", "status", ("REQUESTED", "RUNNING"), ("CANCELLED",), "CONSTANT:CANCELLED",
        ("tme_wfm_optimization_requests",)),
    "modern.wfm.schedule.cancel": (
        "modern.wfm.schedule.submit", "/api/time/v1/hris/wfm/schedule-candidates/{candidateId}/cancel",
        "tme_wfm_schedule_candidates", "status", ("CANDIDATE_GENERATED", "VALIDATED", "APPROVED"), ("CANCELLED",), "CONSTANT:CANCELLED",
        ("tme_wfm_schedule_candidates",)),

    "modern.listening.survey.revise": (
        "modern.listening.survey.create", "/api/platform/v1/hris/listening/surveys/{surveyId}/revisions",
        "sys_hris_listening_survey_versions", "state", ("DRAFT",), ("DRAFT",), "CONSTANT:DRAFT",
        ("sys_hris_listening_surveys", "sys_hris_listening_survey_versions")),
    "modern.analytics.metric.revise": (
        "modern.analytics.metric.validate", "/api/platform/v1/hris/analytics/metrics/{metricId}/revisions",
        "sys_hris_metric_versions", "status", ("DRAFT", "VALIDATED"), ("DRAFT",), "CONSTANT:DRAFT",
        ("sys_hris_metric_definitions", "sys_hris_metric_versions")),
    "modern.analytics.projection.request": (
        "modern.analytics.export.create", "/api/platform/v1/hris/analytics/metrics/{metricId}/projections",
        "sys_hris_metric_projection_requests", "state", ("NONE",), ("REQUESTED",), "CONSTANT:REQUESTED",
        ("sys_hris_metric_projection_requests",)),
    "modern.analytics.export.cancel": (
        "modern.analytics.export.create", "/api/platform/v1/hris/analytics/exports/{exportId}/cancel",
        "sys_hris_analytics_export_receipts", "status", ("REQUESTED", "GENERATING"), ("CANCELLED",), "CONSTANT:CANCELLED",
        ("sys_hris_analytics_export_receipts",)),
    "modern.ai.policy.revise": (
        "modern.ai.policy.create", "/api/platform/v1/hris/ai/policies/{policyId}/revisions",
        "sys_hris_ai_use_policies", "status", ("DRAFT", "EVALUATED"), ("DRAFT",), "CONSTANT:DRAFT",
        ("sys_hris_ai_use_policies", "sys_hris_ai_policy_versions")),
    "modern.ai.evaluation.cancel": (
        "modern.ai.policy.evaluate", "/api/platform/v1/hris/ai/evaluations/{evaluationId}/cancel",
        "sys_hris_ai_evaluation_requests", "status", ("REQUESTED", "RUNNING"), ("CANCELLED",), "CONSTANT:CANCELLED",
        ("sys_hris_ai_evaluation_requests",)),
    "modern.ai.assist.review": (
        "modern.ai.assist.create", "/api/platform/v1/hris/ai/assistances/{assistanceId}/review",
        "sys_hris_ai_assistance_requests", "state", ("PRODUCED",), ("CONFIRMED", "REJECTED"), "body.decision",
        ("sys_hris_ai_assistance_requests", "sys_hris_ai_provenance_receipts")),
    "modern.ai.assist.revoke": (
        "modern.ai.assist.create", "/api/platform/v1/hris/ai/assistances/{assistanceId}/revoke",
        "sys_hris_ai_assistance_requests", "state", ("CONFIRMED",), ("REVOKED",), "CONSTANT:REVOKED",
        ("sys_hris_ai_assistance_requests", "sys_hris_ai_provenance_receipts")),
    "modern.ai.assist.cancel": (
        "modern.ai.assist.create", "/api/platform/v1/hris/ai/assistances/{assistanceId}/cancel",
        "sys_hris_ai_assistance_requests", "state", ("REQUESTED", "RUNNING"), ("CANCELLED",), "CONSTANT:CANCELLED",
        ("sys_hris_ai_assistance_requests",)),
}


# Tuple: (template query, exact public path, physical projection tables).
NEW_QUERY_RUNTIME: Final = {
    "modern.recruiting.requisition.query": ("modern.recruiting.requisitions.query", "/api/people/v1/hris/recruiting/requisitions/{requisitionId}", ("ppl_rec_requisitions",)),
    "modern.recruiting.candidates.query": ("modern.recruiting.requisitions.query", "/api/people/v1/hris/recruiting/candidates", ("ppl_rec_candidate_cases", "ppl_rec_candidate_stage_history")),
    "modern.recruiting.candidate.query": ("modern.recruiting.requisitions.query", "/api/people/v1/hris/recruiting/candidates/{candidateCaseId}", ("ppl_rec_candidate_cases", "ppl_rec_candidate_stage_history", "ppl_rec_offers", "ppl_rec_hire_requests", "ppl_rec_hire_handoff_receipts")),
    "modern.onboarding.templates.query": ("modern.onboarding.self.query", "/api/people/v1/hris/onboarding/templates", ("ppl_jny_templates", "ppl_jny_template_versions")),
    "modern.onboarding.template.query": ("modern.onboarding.self.query", "/api/people/v1/hris/onboarding/templates/{templateId}", ("ppl_jny_templates", "ppl_jny_template_versions")),
    "modern.onboarding.assignments.query": ("modern.onboarding.self.query", "/api/people/v1/hris/onboarding/assignments", ("ppl_jny_assignments", "ppl_jny_assignment_tasks")),
    "modern.onboarding.assignment.query": ("modern.onboarding.self.query", "/api/people/v1/hris/onboarding/assignments/{assignmentId}", ("ppl_jny_assignments", "ppl_jny_assignment_tasks", "ppl_jny_task_evidence", "ppl_jny_assignment_revisions", "ppl_jny_assignment_task_revisions")),
    "modern.workforceplan.scenario.query": ("modern.workforceplan.scenarios.query", "/api/people/v1/hris/workforce-planning/scenarios/{scenarioId}", ("ppl_wfp_scenarios", "ppl_wfp_scenario_revisions", "ppl_wfp_publish_receipts")),
    "modern.benefits.plans.query": ("modern.benefits.self.plans.query", "/api/people/v1/hris/benefits/admin/plans", ("ppl_bnf_plans", "ppl_bnf_plan_versions")),
    "modern.benefits.plan.query": ("modern.benefits.self.plans.query", "/api/people/v1/hris/benefits/admin/plans/{planId}", ("ppl_bnf_plans", "ppl_bnf_plan_versions")),
    "modern.benefits.enrollments.query": ("modern.benefits.self.plans.query", "/api/people/v1/hris/benefits/enrollments", ("ppl_bnf_enrollments", "ppl_bnf_enrollment_decisions", "ppl_bnf_provider_requests", "ppl_bnf_provider_receipts")),
    "modern.benefits.enrollment.query": ("modern.benefits.self.plans.query", "/api/people/v1/hris/benefits/enrollments/{enrollmentId}", ("ppl_bnf_enrollments", "ppl_bnf_enrollment_decisions", "ppl_bnf_provider_requests", "ppl_bnf_provider_receipts")),
    "modern.benefits.lifeevents.query": ("modern.benefits.self.plans.query", "/api/people/v1/hris/benefits/life-events", ("ppl_bnf_life_events",)),
    "modern.benefits.lifeevent.query": ("modern.benefits.self.plans.query", "/api/people/v1/hris/benefits/life-events/{lifeEventId}", ("ppl_bnf_life_events",)),
    "modern.hrservice.cases.query": ("modern.hrservice.case.query", "/api/people/v1/hris/hr-service/cases", ("ppl_hrs_cases", "ppl_hrs_case_actions", "ppl_hrs_sla_receipts")),
    "modern.contingent.engagement.query": ("modern.contingent.engagements.query", "/api/people/v1/hris/contingent/engagements/{engagementId}", ("ppl_cwk_engagements", "ppl_cwk_sponsor_assignments", "ppl_cwk_classification_receipts", "ppl_cwk_access_requests", "ppl_cwk_access_expiry_receipts")),

    "modern.skills.taxonomy.query": ("modern.skills.taxonomies.query", "/api/performance/v1/hris/skills/taxonomies/{taxonomyId}", ("prf_skl_taxonomies", "prf_skl_taxonomy_versions", "prf_skl_skill_nodes", "prf_skl_skill_edges", "prf_skl_proficiency_levels")),
    "modern.skills.evidences.query": ("modern.skills.worker.query", "/api/performance/v1/hris/skills/evidence", ("prf_skl_worker_evidence",)),
    "modern.skills.evidence.query": ("modern.skills.worker.query", "/api/performance/v1/hris/skills/evidence/{evidenceId}", ("prf_skl_worker_evidence",)),
    "modern.growth.profiles.query": ("modern.growth.self.query", "/api/performance/v1/hris/growth/profiles", ("prf_grw_profiles", "prf_grw_profile_revisions", "prf_grw_profile_revision_evidence_refs", "prf_grw_aspirations", "prf_grw_evidence_links", "prf_grw_coaching_notes", "prf_grw_coaching_note_evidence_refs")),
    "modern.growth.profile.query": ("modern.growth.self.query", "/api/performance/v1/hris/growth/profiles/{profileId}", ("prf_grw_profiles", "prf_grw_profile_revisions", "prf_grw_profile_revision_evidence_refs", "prf_grw_aspirations", "prf_grw_evidence_links", "prf_grw_coaching_notes", "prf_grw_coaching_note_evidence_refs")),
    "modern.growth.exports.query": ("modern.growth.self.query", "/api/performance/v1/hris/growth/exports", ("prf_grw_portability_export_receipts",)),
    "modern.growth.export.query": ("modern.growth.self.query", "/api/performance/v1/hris/growth/exports/{exportId}", ("prf_grw_portability_export_receipts",)),
    "modern.learning.offering.query": ("modern.learning.catalog.query", "/api/performance/v1/hris/learning/offerings/{offeringId}", ("prf_lrn_offerings",)),
    "modern.learning.assignments.query": ("modern.learning.catalog.query", "/api/performance/v1/hris/learning/assignments", ("prf_lrn_assignments", "prf_lrn_completion_evidence", "prf_lrn_completion_skill_evidence_refs")),
    "modern.learning.assignment.query": ("modern.learning.catalog.query", "/api/performance/v1/hris/learning/assignments/{assignmentId}", ("prf_lrn_assignments", "prf_lrn_completion_evidence", "prf_lrn_completion_skill_evidence_refs")),
    "modern.opportunity.query": ("modern.opportunity.catalog.query", "/api/performance/v1/hris/opportunities/{opportunityId}", ("prf_mkt_opportunities",)),
    "modern.opportunity.applications.query": ("modern.opportunity.catalog.query", "/api/performance/v1/hris/opportunity-applications", ("prf_mkt_applications", "prf_mkt_match_explanations", "prf_mkt_application_decisions")),
    "modern.opportunity.application.query": ("modern.opportunity.catalog.query", "/api/performance/v1/hris/opportunity-applications/{applicationId}", ("prf_mkt_applications", "prf_mkt_match_explanations", "prf_mkt_application_decisions")),
    "modern.succession.plan.query": ("modern.succession.plans.query", "/api/performance/v1/hris/succession/plans/{planId}", ("prf_suc_plans", "prf_suc_nominations", "prf_suc_readiness_evidence")),
    "modern.compplan.cycle.query": ("modern.compplan.cycles.query", "/api/performance/v1/hris/compensation/cycles/{cycleId}", ("prf_cmp_cycles", "prf_cmp_budget_ledger", "prf_cmp_plans", "prf_cmp_approved_snapshots", "prf_cmp_approved_snapshot_lines")),
    "modern.compplan.proposals.query": ("modern.compplan.cycles.query", "/api/performance/v1/hris/compensation/cycles/{cycleId}/proposals", ("prf_cmp_proposals",)),
    "modern.compplan.proposal.query": ("modern.compplan.cycles.query", "/api/performance/v1/hris/compensation/proposals/{proposalId}", ("prf_cmp_proposals",)),

    "modern.wfm.forecast.query": ("modern.wfm.forecasts.query", "/api/time/v1/hris/wfm/forecasts/{forecastId}", ("tme_wfm_demand_forecasts", "tme_wfm_demand_lines")),
    "modern.wfm.optimization.query": ("modern.wfm.forecasts.query", "/api/time/v1/hris/wfm/optimizations/{optimizationId}", ("tme_wfm_optimization_requests",)),
    "modern.wfm.candidates.query": ("modern.wfm.forecasts.query", "/api/time/v1/hris/wfm/schedule-candidates", ("tme_wfm_schedule_candidates", "tme_wfm_schedule_candidate_versions", "tme_wfm_schedule_candidate_time_group_refs")),
    "modern.wfm.candidate.query": ("modern.wfm.forecasts.query", "/api/time/v1/hris/wfm/schedule-candidates/{candidateId}", ("tme_wfm_schedule_candidates", "tme_wfm_schedule_candidate_versions", "tme_wfm_schedule_candidate_time_group_refs", "tme_wfm_candidate_shift_lines", "tme_wfm_constraint_evaluation_receipts", "tme_wfm_constraint_violation_lines", "tme_wfm_fairness_measure_values", "tme_wfm_approval_requests", "tme_wfm_schedule_publish_ledger")),

    "modern.listening.surveys.query": ("modern.listening.active.query", "/api/platform/v1/hris/listening/admin/surveys", ("sys_hris_listening_surveys", "sys_hris_listening_survey_versions", "sys_hris_listening_admission_versions")),
    "modern.analytics.metric.query": ("modern.analytics.metrics.query", "/api/platform/v1/hris/analytics/metrics/{metricId}", ("sys_hris_metric_definitions", "sys_hris_metric_versions")),
    "modern.analytics.projections.query": ("modern.analytics.metrics.query", "/api/platform/v1/hris/analytics/projections", ("sys_hris_metric_projection_requests", "sys_hris_metric_projections")),
    "modern.analytics.projection.query": ("modern.analytics.metrics.query", "/api/platform/v1/hris/analytics/projections/{projectionId}", ("sys_hris_metric_projection_requests", "sys_hris_metric_projections")),
    "modern.analytics.exports.query": ("modern.analytics.metrics.query", "/api/platform/v1/hris/analytics/exports", ("sys_hris_analytics_export_receipts", "sys_hris_analytics_export_projection_refs")),
    "modern.analytics.export.query": ("modern.analytics.metrics.query", "/api/platform/v1/hris/analytics/exports/{exportId}", ("sys_hris_analytics_export_receipts", "sys_hris_analytics_export_projection_refs")),
    "modern.ai.policy.query": ("modern.ai.policies.query", "/api/platform/v1/hris/ai/policies/{policyId}", ("sys_hris_ai_use_policies", "sys_hris_ai_policy_versions")),
    "modern.ai.evaluations.query": ("modern.ai.policies.query", "/api/platform/v1/hris/ai/evaluations", ("sys_hris_ai_evaluation_requests", "sys_hris_ai_evaluation_receipts", "sys_hris_ai_policy_versions", "sys_hris_ai_use_policies")),
    "modern.ai.evaluation.query": ("modern.ai.policies.query", "/api/platform/v1/hris/ai/evaluations/{evaluationId}", ("sys_hris_ai_evaluation_requests", "sys_hris_ai_evaluation_receipts", "sys_hris_ai_policy_versions", "sys_hris_ai_use_policies")),
    "modern.ai.assistances.query": ("modern.ai.policies.query", "/api/platform/v1/hris/ai/assistances", ("sys_hris_ai_assistance_requests", "sys_hris_ai_provenance_receipts", "sys_hris_ai_policy_versions", "sys_hris_ai_use_policies")),
    "modern.ai.assistance.query": ("modern.ai.policies.query", "/api/platform/v1/hris/ai/assistances/{assistanceId}", ("sys_hris_ai_assistance_requests", "sys_hris_ai_provenance_receipts", "sys_hris_ai_policy_versions", "sys_hris_ai_use_policies")),
}


# The predecessor's original 18 queries had broad family read plans and no
# exact re-entry tuple.  These reviewed successor mappings are authored per
# public operation; they are intentionally not inferred from the predecessor.
EXISTING_QUERY_RUNTIME: Final = {
    "modern.ai.policies.query": ("sys_hris_ai_use_policies", "sys_hris_ai_policy_versions"),
    "modern.analytics.metrics.query": ("sys_hris_metric_definitions", "sys_hris_metric_versions"),
    "modern.benefits.self.plans.query": ("ppl_bnf_plans", "ppl_bnf_plan_versions", "ppl_bnf_enrollments"),
    "modern.compplan.cycles.query": ("prf_cmp_cycles", "prf_cmp_budget_ledger", "prf_cmp_plans", "prf_cmp_approved_snapshots"),
    "modern.contingent.engagements.query": ("ppl_cwk_engagements", "ppl_cwk_sponsor_assignments", "ppl_cwk_classification_receipts", "ppl_cwk_access_requests", "ppl_cwk_access_expiry_receipts"),
    "modern.growth.self.query": ("prf_grw_profiles", "prf_grw_profile_revisions", "prf_grw_profile_revision_evidence_refs", "prf_grw_aspirations", "prf_grw_evidence_links", "prf_grw_coaching_notes", "prf_grw_coaching_note_evidence_refs"),
    "modern.hrservice.case.query": ("ppl_hrs_cases", "ppl_hrs_case_actions", "ppl_hrs_sla_receipts"),
    "modern.learning.catalog.query": ("prf_lrn_offerings",),
    "modern.listening.active.query": ("sys_hris_listening_admission_versions",),
    "modern.listening.cohorts.query": ("sys_hris_listening_cohort_projections", "sys_hris_listening_lineage_receipts"),
    "modern.onboarding.self.query": ("ppl_jny_assignments", "ppl_jny_assignment_tasks", "ppl_jny_task_evidence"),
    "modern.opportunity.catalog.query": ("prf_mkt_opportunities",),
    "modern.recruiting.requisitions.query": ("ppl_rec_requisitions",),
    "modern.skills.taxonomies.query": ("prf_skl_taxonomies", "prf_skl_taxonomy_versions", "prf_skl_skill_nodes", "prf_skl_skill_edges", "prf_skl_proficiency_levels"),
    "modern.skills.worker.query": ("prf_skl_worker_evidence",),
    "modern.succession.plans.query": ("prf_suc_plans", "prf_suc_nominations", "prf_suc_readiness_evidence"),
    "modern.wfm.forecasts.query": ("tme_wfm_demand_forecasts", "tme_wfm_demand_lines"),
    "modern.workforceplan.scenarios.query": ("ppl_wfp_scenarios", "ppl_wfp_scenario_revisions", "ppl_wfp_publish_receipts"),
}
