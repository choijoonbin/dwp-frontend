#!/usr/bin/env python3
"""Materialize and validate the canonical modern HRIS semantic lineage graph.

The old catalogue had structurally complete rows whose sources were labels such
as ``aggregate.foo`` and synthetic columns such as ``table.items``.  This
normalizer keeps the independently registered operation scope unchanged and
rebuilds only semantic metadata from the exact request, table, G2 receipt and
event contracts.  The output deliberately remains a G3 design contract; it is
not implementation or production evidence.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import pathlib
import re
import sys
from typing import Any

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent
EXACT = HERE / "modern-capability-exact-schema-contracts.v1.json"
EVENTS = HERE / "modern-capability-event-payload-contracts.v1.json"
BINDINGS = HERE / "modern-capability-semantic-bindings.v1.json"
IDENTITIES = HERE / "modern-capability-public-identity-registry.v1.json"
SSOT = HERE / "modern-capability-operation-causal-contract-ssot.v2.json"
MANIFEST = HERE / "modern-capability-closed-set-manifest.v3.json"

sys.path.insert(0, str(HERE))
from validate_modern_semantic_field_lineage import (  # noqa: E402
    Identity,
    SemanticValidator,
    SEALED_REGISTRY_PAYLOAD_PINS,
    business_type,
    declared_identity,
    load_base_tables,
    normalize_type,
    semantic_binding_view,
    types_compatible,
)
from modern_causal_successor import (  # noqa: E402
    STATE,
    apply_exact_source_successor,
    expanded_request_fields,
    state_column_for,
)
from sys_listening_canonical_design import (  # noqa: E402
    stamp_canonical_document,
)


RECEIPTS = {
    "HRIS-HRM": {
        "table": "ppl_command_receipts", "id": "command_receipt_id",
        "idempotency": "idempotency_key", "digest": "request_hash",
        "caller": "actor_public_id", "status": "lifecycle_state",
        "aggregate": "target_public_id", "time": "completed_at",
        "fallbackTime": "created_at", "correlation": "correlation_id",
    },
    "HRIS-PER": {
        "table": "prf_command_receipts", "id": "command_receipt_id",
        "idempotency": "idempotency_key", "digest": "request_hash",
        "caller": "actor_user_id", "status": "receipt_state",
        "aggregate": "aggregate_id", "time": "completed_at",
        "fallbackTime": "created_at", "correlation": None,
    },
    "HRIS-TIM": {
        "table": "tme_command_receipts", "id": "public_id",
        "idempotency": "idempotency_key", "digest": "request_digest",
        "caller": "subject_principal_public_id", "status": "status",
        "aggregate": "aggregate_public_id", "revision": "aggregate_revision",
        "time": "completed_at", "fallbackTime": "created_at",
        "correlation": "correlation_id",
    },
    "HRIS-SYS": {
        "table": "sys_hris_command_receipts", "id": "public_id",
        "idempotency": "idempotency_key", "digest": "request_digest",
        "caller": "subject_principal_public_id", "status": "status",
        "aggregate": "aggregate_public_id", "revision": "aggregate_revision",
        "time": "completed_at", "fallbackTime": "created_at",
        "correlation": "correlation_id",
    },
}


# Request names are the public semantic vocabulary.  Ambiguous names are
# resolved below by operation family, never by “first UUID in the URL”.
FIELD_ENTITIES = {
    "actionId": "table:sys_hris_listening_actions",
    "applicationId": "table:prf_mkt_applications",
    "approvalReceiptId": "Approval.DecisionReceipt",
    "audienceSnapshotId": "HRM.Access",
    "benefitPlanId": "table:ppl_bnf_plans",
    "candidateCaseId": "table:ppl_rec_candidate_cases",
    "candidateId": "table:tme_wfm_schedule_candidates",
    "caseId": "table:ppl_hrs_cases",
    "cohortResultId": "table:sys_hris_listening_cohort_results",
    "cohortDefinitionId": "HRM.Access",
    "configScopePublicId": "SYS.Config",
    "configurationScopeId": "SYS.Config",
    "configVersionId": "SYS.Config",
    "consentPolicyVersionId": "SYS.Config",
    "cycleId": "table:prf_cmp_cycles",
    "decisionReceiptId": "Approval.DecisionReceipt",
    "engagementId": "table:ppl_cwk_engagements",
    "eligibilityPolicyVersionId": "SYS.Config",
    "evidenceId": "PER.Evidence",
    "enrollmentId": "table:ppl_bnf_enrollments",
    "explanationId": "table:prf_mkt_match_explanations",
    "forecastId": "table:tme_wfm_demand_forecasts",
    "fairnessEvaluationId": "SYS.AIFairnessEvaluation",
    "hireHandoffId": "table:ppl_rec_hire_handoff_receipts",
    "humanDecisionReceiptId": "Approval.DecisionReceipt",
    "guidelinePolicyVersionId": "SYS.Config",
    "journeyTemplateId": "table:ppl_jny_templates",
    "keyPositionPublicId": "HRM.Position",
    "metricId": "table:sys_hris_metric_definitions",
    "metricProjectionIds": "table:sys_hris_metric_projections",
    "nonRetaliationReviewReceiptId": "Compliance.NonRetaliationReviewReceipt",
    "offeringId": "table:prf_lrn_offerings",
    "offerId": "table:ppl_rec_offers",
    "opportunityId": "table:prf_mkt_opportunities",
    "organizationPublicId": "HRM.Organization",
    "ownerPrincipalId": "Auth.Principal",
    "ownerOrgPublicId": "HRM.Organization",
    "organizationSnapshotId": "HRM.Organization",
    "policyId": "table:sys_hris_ai_use_policies",
    "policyVersionId": "SYS.Config",
    "positionPublicId": "HRM.Position",
    "publishLedgerId": "table:tme_wfm_schedule_publish_ledger",
    "publishReceiptId": "table:ppl_wfp_publish_receipts",
    "profileId": "table:prf_grw_profiles",
    "providerPublicId": "SYS.Connector",
    "proposalId": "table:prf_cmp_proposals",
    "requisitionId": "table:ppl_rec_requisitions",
    "scenarioId": "table:ppl_wfp_scenarios",
    "skillId": "PER.Skill",
    "skillPublicId": "PER.Skill",
    "slaPolicyVersionId": "SYS.Config",
    "slaReceiptId": "table:ppl_hrs_sla_receipts",
    "sponsorWorkerPublicId": "HRM.Worker",
    "ruleVersionId": "SYS.Config",
    "schedulePeriodPublicId": "TIM.SchedulePeriod",
    "sourceReferenceIds": "Owner.AuthorizedProjection",
    "sourceSystemId": "SYS.Connector",
    "surveyId": "table:sys_hris_listening_surveys",
    "taskId": "HRM.OnboardingTask",
    "taxonomyId": "table:prf_skl_taxonomies",
    "templateId": "table:ppl_jny_templates",
    "templateVersionId": "HRM.JourneyTemplateVersion",
    "useCaseKey": "SYS.AIUseCase",
    "workerId": "HRM.Worker",
    "workerPublicId": "HRM.Worker",
    "knowledgeSourceRefs": "HR.KnowledgeSource",
    "evidenceRefs": "SkillsOrLearning",
    "requesterWorkerPublicId": "HRM.Worker",
    "populationSnapshotId": "HRM.Workforce",
    "demandSourceId": "SYS.Connector",
    "vendorPublicId": "external vendor registry",
    "worksitePublicId": "HRM.Location",
}

OP_FIELD_ENTITIES = {
    ("modern.ai.kill.switch", "useCaseKey"): None,
    ("modern.onboarding.task.complete", "assignmentId"): "table:ppl_jny_assignments",
    ("modern.onboarding.task.complete", "taskId"): "table:ppl_jny_assignment_tasks",
    ("modern.onboarding.journey.cancel", "assignmentId"): "table:ppl_jny_assignments",
    ("modern.learning.assignment.start", "assignmentId"): "table:prf_lrn_assignments",
    ("modern.learning.completion.verify", "assignmentId"): "table:prf_lrn_assignments",
    ("modern.benefits.plan.publish", "planId"): "table:ppl_bnf_plans",
    ("modern.succession.nomination.add", "planId"): "table:prf_suc_plans",
    ("modern.succession.plan.submit", "planId"): "table:prf_suc_plans",
    ("modern.succession.plan.approve", "planId"): "table:prf_suc_plans",
    ("modern.succession.plan.publish", "planId"): "table:prf_suc_plans",
    ("modern.skills.evidence.verify", "evidenceId"): "table:prf_skl_worker_evidence",
    ("modern.skills.evidence.verify", "evidencePublicId"): "PER.SkillEvidence",
    ("modern.growth.evidence.link", "evidencePublicId"): "SkillsOrLearning",
    ("modern.learning.completion.verify", "evidencePublicId"): "Learning.ProviderEvidence",
    ("modern.workforceplan.scenario.simulate", "inputSnapshotId"): "HRM.WorkforcePlanningInputSnapshot",
    ("modern.wfm.schedule.optimize", "inputSnapshotId"): "HRM.WorkforcePlanningInputSnapshot",
    ("modern.compplan.plan.approve", "planId"): "table:prf_cmp_cycles",
    ("modern.compplan.snapshot.publish", "planId"): "table:prf_cmp_cycles",
    ("modern.compplan.snapshot.publish", "planPublicId"): "PER.CompensationPlan",
    ("modern.compplan.snapshot.publish", "cyclePublicId"): "table:prf_cmp_cycles",
    ("modern.wfm.schedule.submit", "evaluationReceiptId"):
        "table:tme_wfm_constraint_evaluation_receipts",
}

# Reviewed cross-owner facts carried by public events.  Each entry names the
# owner field and the exact tenant-bound request selectors used for refetch or
# acknowledgement; opaque string aliases are never accepted as provenance.
OWNER_EVENT_FACT_CONTRACTS = {
    ("CompensationPlanApprovalRecorded.v2", "approvalReceiptId"):
        ("Approval.DecisionReceipt", "publicId", "hcm.compensation.approve", ["body.approvalReceiptId"]),
    ("CompensationPlanApprovalRecorded.v2", "approvalRevision"):
        ("Approval.DecisionReceipt", "decisionVersion", "hcm.compensation.approve", ["body.approvalReceiptId"]),
    ("WorkforceScheduleOptimizationRequested.v2", "forecastId"):
        ("TIM.DemandForecast", "publicId", "hcm.wfm.optimize", ["pathParameters.forecastId"]),
    ("WorkforceSchedulePublished.v2", "canonicalSchedulePeriodPublicId"):
        ("TIM.SchedulePeriod", "publicId", "hcm.wfm.publish", ["pathParameters.candidateId", "body.approvalReceiptId"]),
    ("WorkforceSchedulePublished.v2", "approvalReceiptPublicId"):
        ("Approval.DecisionReceipt", "publicId", "hcm.wfm.publish", ["body.approvalReceiptId"]),
    ("GovernedAiPolicyEvaluationRequested.v2", "policyId"):
        ("SYS.AiUsePolicy", "publicId", "hcm.ai.policy.manage", ["pathParameters.policyId"]),
}


# Closed request collections that are persisted in a native JSONB column use
# one reviewed canonical serialization.  The request ARRAY is never presented
# as if it were directly SQL-compatible with JSONB.
PERSISTED_REQUEST_TRANSFORMS = {
    ("modern.benefits.plan.create", "ppl_bnf_plan_versions.coverage_options"): {
        "source": "body.coverageOptions",
        "rule": "CANONICALIZE_CLOSED_BENEFIT_COVERAGE_OPTION_ARRAY_TO_JSONB",
    },
}


# UUID columns that are intentional cross-owner/public projections but were not
# represented as FK rows in the v1 table catalogue. Their identities come from
# owner contracts; a UUID-shaped column name is never accepted as proof.
PHYSICAL_COLUMN_ENTITIES = {
    ("ppl_rec_candidate_cases", "source_system_id"): "SYS.Connector",
    ("ppl_rec_candidate_cases", "hire_decision_receipt_id"): "Approval.DecisionReceipt",
    ("ppl_rec_hire_requests", "human_decision_receipt_public_id"): "Approval.DecisionReceipt",
    ("ppl_rec_hire_handoff_receipts", "employment_public_id"): "HRM.Employment",
    ("ppl_rec_hire_handoff_receipts", "assignment_public_id"): "HRM.Assignment",
    ("ppl_rec_hire_handoff_receipts", "owner_acknowledgement_id"): "HRM.HireProvisioningAcknowledgement",
    ("ppl_cwk_engagements", "sponsor_worker_public_id"): "HRM.Worker",
    ("ppl_bnf_plan_versions", "enrollment_window_policy_version_id"): "SYS.Config",
    ("ppl_bnf_plan_versions", "provider_config_version_id"): "SYS.ConnectorConfig",
    ("ppl_bnf_plan_versions", "approval_receipt_public_id"): "Approval.DecisionReceipt",
    ("ppl_bnf_enrollments", "decision_receipt_public_id"): "Approval.DecisionReceipt",
    ("prf_skl_worker_evidence", "verification_receipt_public_id"): "Skills.EvidenceVerificationReceipt",
    ("prf_grw_coaching_notes", "artifact_public_id"): "Content.ImmutableArtifact",
    ("prf_cmp_approved_snapshots", "plan_public_id"): "PER.CompensationPlan",
    ("prf_cmp_approved_snapshots", "cycle_public_id"): "table:prf_cmp_cycles",
    ("tme_wfm_schedule_publish_ledger", "schedule_period_public_id"): "TIM.SchedulePeriod",
    ("tme_wfm_schedule_publish_ledger", "canonical_schedule_period_public_id"): "TIM.SchedulePeriod",
    ("tme_wfm_schedule_publish_ledger", "approval_receipt_public_id"): "Approval.DecisionReceipt",
    ("tme_wfm_schedule_publish_ledger", "published_by"): "Auth.Principal",
    ("tme_wfm_constraint_evaluation_receipts", "planning_input_snapshot_id"): "HRM.WorkforcePlanningInputSnapshot",
    ("tme_wfm_optimization_requests", "input_snapshot_id"): "HRM.WorkforcePlanningInputSnapshot",
    ("tme_wfm_constraint_evaluation_receipts", "policy_version_public_id"): "SYS.Config",
    ("sys_hris_metric_versions", "approval_receipt_public_id"): "Approval.DecisionReceipt",
    ("prf_lrn_completion_evidence", "skill_evidence_ids"): "PER.SkillEvidence",
    ("tme_wfm_schedule_candidates", "time_group_ids"): "TIM.TimeGroup",
    ("tme_wfm_schedule_candidates", "input_snapshot_id"): "HRM.WorkforcePlanningInputSnapshot",
    ("sys_hris_listening_responses", "respondent_public_id"): "HRM.Worker",
    ("sys_hris_ai_provenance_receipts", "source_refs"): "Owner.AuthorizedProjection",
    ("prf_grw_profile_revisions", "artifact_public_id"): "Content.ImmutableArtifact",
    ("prf_grw_profile_revisions", "evidence_refs"): "SkillsOrLearning.Evidence",
}


# Early drafts used broad domain labels for a few cross-boundary UUIDs.  These
# corrections are part of the versioned physical contract: request, storage and
# public lineage must name one exact owner identity rather than mutually
# incompatible aliases.
OPAQUE_TARGET_CORRECTIONS = {
    ("prf_grw_profile_revisions", "artifact_public_id"): "Content.ImmutableArtifact",
    ("prf_cmp_approved_snapshots", "approval_receipt_id"): "Approval.DecisionReceipt",
    ("tme_wfm_schedule_publish_ledger", "approval_receipt_id"): "Approval.DecisionReceipt",
    ("sys_hris_analytics_export_receipts", "metric_projection_ids"): "table:sys_hris_metric_projections",
    ("prf_lrn_completion_evidence", "source_receipt_id"): "Learning.ProviderEvidence",
    ("sys_hris_ai_provenance_receipts", "source_refs"): "Owner.AuthorizedProjection",
}


# A capability record describes one stable business row even when wrapped by a
# command response. Select its root by schema shape, not write-list position.
RECORD_ROOT_TABLES = {
    "HRIS.MODERN.RECRUITING_ATS.Record.v1": "ppl_rec_requisitions",
    "HRIS.MODERN.ONBOARDING.Record.v1": "ppl_jny_templates",
    "HRIS.MODERN.WORKFORCE_PLANNING.Record.v1": "ppl_wfp_scenarios",
    "HRIS.MODERN.BENEFITS_ADMIN.Record.v1": "ppl_bnf_plans",
    "HRIS.MODERN.HR_SERVICE_DELIVERY.Record.v1": "ppl_hrs_cases",
    "HRIS.MODERN.CONTINGENT_WORKFORCE.Record.v1": "ppl_cwk_engagements",
    "HRIS.MODERN.SKILLS_ONTOLOGY.Record.v1": "prf_skl_taxonomies",
    "HRIS.MODERN.GROWTH_PROFILE.Record.v1": "prf_grw_profiles",
    "HRIS.MODERN.LEARNING.Record.v1": "prf_lrn_offerings",
    "HRIS.MODERN.INTERNAL_MARKETPLACE.Record.v1": "prf_mkt_opportunities",
    "HRIS.MODERN.SUCCESSION.Record.v1": "prf_suc_plans",
    "HRIS.MODERN.COMPENSATION_PLANNING.Record.v1": "prf_cmp_cycles",
    "HRIS.MODERN.ADVANCED_WFM.Record.v1": "tme_wfm_demand_forecasts",
    "HRIS.MODERN.EMPLOYEE_LISTENING.Record.v1": "sys_hris_listening_surveys",
    "HRIS.MODERN.PEOPLE_ANALYTICS.Record.v1": "sys_hris_metric_definitions",
    "HRIS.MODERN.GOVERNED_AI.Record.v1": "sys_hris_ai_use_policies",
    "ApprovedCompensationPlanLine.v1": "prf_cmp_approved_snapshot_lines",
}


NON_UUID_OWNER_REFERENCES = {
    ("ppl_rec_candidate_cases", "candidate_person_token"),
    ("ppl_jny_task_evidence", "object_ref"),
    ("ppl_bnf_life_events", "evidence_object_ref"),
    ("sys_hris_listening_responses", "response_token_hash"),
}


# These are vocabulary equivalences, not fuzzy matches.  Each entry is narrow
# enough to be reviewed as a public-field -> physical-column rename.  The
# materialized operation registry records the exact operation/target/source
# triple; this list is never a fallback for a merely compatible type.
REQUEST_COLUMN_ALIASES = {
    "as_of_date": ("effectiveFrom",),
    "configuration_scope_id": ("configurationScopeId",),
    "config_scope_public_id": ("configScopePublicId",),
    "due_at": ("dueAt",),
    "demand_forecast_id": ("forecastId",),
    "effective_date": ("effectiveDate", "effectiveFrom"),
    "effective_from": ("effectiveFrom", "effectiveDate", "validFrom"),
    "event_date": ("occurredOn",),
    "org_public_id": ("organizationPublicId",),
    "recorded_at": ("completedAt",),
    "starts_at": ("intervalStart",),
    "ends_at": ("intervalEnd",),
    "stage": ("targetStage",),
    "valid_from": ("effectiveFrom", "targetStartDate"),
    "valid_to": ("effectiveTo", "validTo"),
    "version_no": ("version",),
    "currency_code": ("currency",),
    "pending_offer_id": ("offerId",),
    "compensation_plan_id": ("planPublicId",),
    "compensation_cycle_id": ("cycleId",),
    "last_source_digest": ("sourceDigest",),
    "current_revision": ("forecastRevision",),
    "interval_start": ("intervalStart",),
    "interval_end": ("intervalEnd",),
    "required_headcount": ("requiredHeadcount",),
    "demand_unit_code": ("demandUnitCode",),
    "hire_decision_receipt_id": ("humanDecisionReceiptId",),
    "human_decision_receipt_public_id": ("humanDecisionReceiptId",),
    "journey_template_version_id": ("templateVersionId",),
    "task_definitions": ("tasks",),
    "hire_effective_date": ("effectiveDate",),
    "last_reason_code": ("reasonCode",),
    "visibility": ("visibility",),
    "artifact_public_id": ("artifactPublicId",),
    "coaching_artifact_public_id": ("artifactPublicId", "coachingArtifactPublicId"),
    "constraint_evaluation_receipt_id": ("evaluationReceiptId",),
    "source_receipt_id": ("evidencePublicId",),
    "source_refs": ("sourceReferenceIds",),
    "approval_receipt_public_id": ("approvalReceiptId",),
    "policy_version_public_id": ("policyVersionId",),
    "planning_input_snapshot_id": ("inputSnapshotId",),
}

BUSINESS_KEY_COLUMNS = {
    "action_key", "case_number", "cycle_code", "engagement_code", "forecast_key",
    "metric_key", "offering_code", "opportunity_code", "plan_code", "plan_key",
    "profile_key", "scenario_key", "survey_key", "taxonomy_key", "template_key",
}

# Event vocabulary equivalences are similarly explicit.  The generator fails
# if neither one of these exact aliases nor a reviewed computation below can
# provide a field.
EVENT_COLUMN_ALIASES = {
    "approval_revision": ("snapshot_revision",),
    "aspiration_revision": ("revision_no",),
    "case_type": ("case_type",),
    "consent_policy_version": ("consent_policy_version",),
    "effective_date": ("effective_date", "effective_from", "valid_from", "event_date"),
    "ended_at": ("effective_to",),
    "mapping_digest": ("mapping_digest", "content_digest"),
    "metric_version": ("version_no",),
    "published_at": ("published_at", "recorded_at"),
    "schedule_period_end": ("period_end",),
    "schedule_period_start": ("period_start",),
    "sla_due_at": ("due_at",),
    "sla_outcome": ("outcome",),
    "taxonomy_version": ("version_no",),
    "verified_at": ("verified_at", "observed_at"),
    "budget_currency": ("budget_currency", "currency_code"),
    "cohort_count": ("subject_count",),
    "constraint_policy_version": ("constraint_policy_version", "policy_version"),
    "coverage_level": ("coverage_level",),
    "lineage_digest": ("lineage_digest",),
    "impact_digest": ("payload_digest", "result_digest"),
    "model_route_key": ("model_route_key",),
    "projection_revision": ("projection_revision",),
    "provenance_type": ("provenance_type",),
    "receipt_digest": ("receipt_digest",),
}

EVENT_REQUEST_ALIASES = {
    "endedAt": ("effectiveAt",),
}


# Table-level mutation semantics are explicit because an operation can update
# its aggregate root while appending an immutable evidence/revision row.  Any
# command/table pair not listed here is UPDATE; NONE->state transitions insert
# every allocated table.  The resulting disposition is sealed per operation.
INSERT_TABLES_BY_OPERATION = {
    "modern.onboarding.template.create": {"ppl_jny_templates", "ppl_jny_template_versions"},
    "modern.onboarding.journey.assign": {"ppl_jny_assignments", "ppl_jny_assignment_tasks"},
    "modern.benefits.plan.create": {"ppl_bnf_plans", "ppl_bnf_plan_versions"},
    "modern.recruiting.offer.issue": {"ppl_rec_offers"},
    "modern.recruiting.hire.record": {"ppl_rec_hire_requests"},
    "modern.workforceplan.scenario.create": {"ppl_wfp_scenario_revisions"},
    "modern.benefits.enrollment.submit": {"ppl_bnf_enrollments"},
    "modern.benefits.lifeevent.submit": {"ppl_bnf_life_events"},
    "modern.learning.self.enroll": {"prf_lrn_assignments"},
    "modern.opportunity.apply": {"prf_mkt_applications"},
    "modern.listening.response.submit": {"sys_hris_listening_responses"},
    "modern.ai.assist.create": {"sys_hris_ai_provenance_receipts"},
    "modern.wfm.schedule.optimize": {"tme_wfm_optimization_requests"},
    "modern.ai.policy.evaluate": {"sys_hris_ai_evaluation_requests"},
    "modern.hrservice.case.create": {"ppl_hrs_case_actions"},
    "modern.skills.taxonomy.create": {"prf_skl_taxonomies", "prf_skl_taxonomy_versions"},
    "modern.growth.profile.create": {"prf_grw_aspirations"},
    "modern.analytics.metric.create": {
        "sys_hris_metric_definitions", "sys_hris_metric_versions",
        "sys_hris_metric_projections",
    },
    "modern.ai.policy.create": {"sys_hris_ai_policy_versions"},
    "modern.wfm.schedule.submit": {"tme_wfm_approval_requests"},
}

APPEND_TABLES_BY_OPERATION = {
    "modern.onboarding.task.complete": {"ppl_jny_task_evidence"},
    "modern.workforceplan.scenario.simulate": {"ppl_wfp_scenario_revisions"},
    "modern.workforceplan.scenario.submit": {"ppl_wfp_scenario_revisions"},
    "modern.workforceplan.scenario.approve": {"ppl_wfp_scenario_revisions"},
    "modern.workforceplan.scenario.publish": {"ppl_wfp_publish_receipts", "ppl_wfp_scenario_revisions"},
    "modern.hrservice.case.triage": {"ppl_hrs_case_actions"},
    "modern.hrservice.case.assign": {"ppl_hrs_case_actions"},
    "modern.hrservice.case.respond": {"ppl_hrs_case_actions"},
    "modern.hrservice.case.resolve": {"ppl_hrs_case_actions"},
    "modern.growth.evidence.link": {"prf_grw_evidence_links"},
    "modern.growth.coaching.record": {"prf_grw_coaching_notes"},
    "modern.growth.profile.update": {"prf_grw_profile_revisions"},
    "modern.learning.completion.verify": {"prf_lrn_completion_evidence"},
    "modern.opportunity.shortlist": {"prf_mkt_match_explanations"},
    "modern.succession.nomination.add": {"prf_suc_nominations"},
    "modern.compplan.budget.allocate": {"prf_cmp_budget_ledger"},
    "modern.compplan.plan.approve": {"prf_cmp_plans"},
    "modern.compplan.snapshot.publish": {"prf_cmp_approved_snapshots", "prf_cmp_approved_snapshot_lines"},
    "modern.wfm.forecast.create": {"tme_wfm_demand_lines"},
    "modern.wfm.schedule.validate": {"tme_wfm_constraint_evaluation_receipts"},
    "modern.wfm.schedule.publish": {"tme_wfm_schedule_publish_ledger"},
    "modern.listening.action.create": {"sys_hris_listening_actions"},
    "modern.analytics.export.create": {"sys_hris_analytics_export_receipts"},
}

APPEND_MANY_TABLES_BY_OPERATION = {
    "modern.onboarding.journey.assign": {"ppl_jny_assignment_tasks"},
    "modern.compplan.snapshot.publish": {"prf_cmp_approved_snapshot_lines"},
    "modern.wfm.forecast.create": {"tme_wfm_demand_lines"},
    "modern.wfm.schedule.validate": {
        "tme_wfm_constraint_violation_lines", "tme_wfm_fairness_measure_values",
    },
}

UPSERT_CAS_TABLES_BY_OPERATION = {
    "modern.wfm.forecast.create": {"tme_wfm_forecast_revision_counters"},
}


# Columns required to retain an emitted, externally observable value are part
# of the G3 schema contract.  They are not implementation/migration evidence.
# Defaults describe deterministic initial state so create commands do not ask a
# caller to manufacture calculated event output.
SUPPLEMENTAL_COLUMNS = {
    "ppl_bnf_enrollments": [
        {"name": "coverage_level", "sqlType": "VARCHAR(40)", "nullable": False,
         "default": "'UNSELECTED'"},
    ],
    "ppl_hrs_cases": [
        {"name": "case_type", "sqlType": "VARCHAR(40)", "nullable": False,
         "default": "'GENERAL'"},
    ],
    "ppl_cwk_engagements": [
        {"name": "classification_code", "sqlType": "VARCHAR(40)", "nullable": False,
         "default": "'UNCLASSIFIED'"},
        {"name": "access_expires_at", "sqlType": "TIMESTAMPTZ", "nullable": True,
         "default": None},
    ],
    "prf_skl_taxonomy_versions": [
        {"name": "skill_count", "sqlType": "INTEGER", "nullable": False, "default": "0"},
    ],
    "prf_skl_worker_evidence": [
        {"name": "provenance_type", "sqlType": "VARCHAR(40)", "nullable": False,
         "default": "'DECLARED'"},
    ],
    "prf_grw_evidence_links": [
        {"name": "evidence_type", "sqlType": "VARCHAR(40)", "nullable": False,
         "default": "'OWNER_REFERENCE'"},
    ],
    "prf_suc_plans": [
        {"name": "audience_policy_revision", "sqlType": "BIGINT", "nullable": False,
         "default": "1"},
        {"name": "published_at", "sqlType": "TIMESTAMPTZ", "nullable": True,
         "default": None},
    ],
    "prf_lrn_completion_evidence": [
        {"name": "skill_evidence_ids", "sqlType": "UUID[]", "nullable": True,
         "default": None,
         "referenceContract": {"entityType": "PER.SkillEvidence", "idSpace": "PUBLIC_UUID"}},
    ],
    "prf_cmp_cycles": [
        {"name": "budget_currency", "sqlType": "CHAR(3)", "nullable": False,
         "default": "'KRW'"},
        {"name": "budget_total", "sqlType": "NUMERIC(19,4)", "nullable": False,
         "default": "0"},
        {"name": "allocated_total", "sqlType": "NUMERIC(19,4)", "nullable": False,
         "default": "0"},
    ],
    "tme_wfm_schedule_candidates": [
        {"name": "constraint_policy_version", "sqlType": "BIGINT", "nullable": False,
         "default": "1"},
        {"name": "coverage_score", "sqlType": "NUMERIC(9,6)", "nullable": False,
         "default": "0"},
        {"name": "time_group_ids", "sqlType": "UUID[]", "nullable": True,
         "default": None,
         "referenceContract": {"entityType": "TIM.TimeGroup", "idSpace": "PUBLIC_UUID"}},
    ],
    "sys_hris_listening_surveys": [
        {"name": "audience_digest", "sqlType": "CHAR(64)", "nullable": False,
         "default": "repeat('0', 64)"},
        {"name": "consent_policy_version", "sqlType": "BIGINT", "nullable": False,
         "default": "1"},
    ],
    "sys_hris_ai_provenance_receipts": [
        {"name": "model_route_key", "sqlType": "VARCHAR(160)", "nullable": False,
         "default": "'policy.default'"},
        {"name": "human_confirmation_required", "sqlType": "BOOLEAN", "nullable": False,
         "default": "TRUE"},
    ],
}


def ensure_semantic_columns(doc: dict[str, Any]) -> None:
    tables = {table["tableName"]: table for table in doc["tableSpecifications"]}
    for table_name, columns in SUPPLEMENTAL_COLUMNS.items():
        table = tables[table_name]
        existing = {column["name"]: column for column in table["columns"]}
        for raw_column in columns:
            column = copy.deepcopy(raw_column)
            is_public_reference = normalize_type(column["sqlType"]) in {"UUID", "UUID[]"}
            column.setdefault("sensitivity", "RESTRICTED" if is_public_reference else "INTERNAL")
            column.setdefault("tokenization", "OPAQUE_PUBLIC_ID" if is_public_reference else "NONE")
            column.setdefault("source", "SEMANTIC_EVENT_STATE_COLUMN")
            if column["name"] in existing:
                for key, value in column.items():
                    if key == "referenceContract" and key not in existing[column["name"]]:
                        existing[column["name"]][key] = copy.deepcopy(value)
                    elif key not in existing[column["name"]]:
                        existing[column["name"]][key] = copy.deepcopy(value)
                    elif existing[column["name"]].get(key) != value:
                        raise ValueError(
                            f"supplemental semantic column drift: {table_name}.{column['name']} {key}"
                        )
            else:
                table["columns"].append(copy.deepcopy(column))


EVENT_FIELD_TYPE_CORRECTIONS = {
    ("WorkerSkillEvidenceVerified.v1", "proficiencyLevel"): "INTEGER",
}


def normalize_event_field_types(events: dict[str, Any]) -> None:
    for schema in events["eventPayloadSchemas"]:
        for field in schema["fields"]:
            corrected = EVENT_FIELD_TYPE_CORRECTIONS.get((schema["eventName"], field["name"]))
            if corrected:
                field["type"] = corrected


def snake(name: str) -> str:
    return re.sub(r"(?<!^)(?=[A-Z])", "_", name).replace("-", "_").lower()


def camel(name: str) -> str:
    parts = name.split("_")
    return parts[0] + "".join(part[:1].upper() + part[1:] for part in parts[1:])


def contract(identity: Identity) -> dict[str, str]:
    return {"entityType": identity.entity_type, "idSpace": identity.id_space}


def binding(identity: Identity, source_kind: str) -> dict[str, Any]:
    return {
        "sourceKind": source_kind,
        "entityType": identity.entity_type,
        "idSpace": identity.id_space,
        "tenantBound": True,
        "ownerValidated": True,
    }


def request_entity(operation_id: str, name: str) -> str | None:
    if (operation_id, name) in OP_FIELD_ENTITIES:
        return OP_FIELD_ENTITIES[(operation_id, name)]
    if name == "planId":
        if ".benefits." in operation_id:
            return "table:ppl_bnf_plans"
        if ".compplan." in operation_id:
            return "table:prf_cmp_cycles"
        return "table:prf_suc_plans"
    if name == "assignmentId":
        return "table:ppl_jny_assignments" if ".onboarding." in operation_id else "table:prf_lrn_assignments"
    if name == "inputSnapshotId":
        # Workforce planning and WFM optimization both consume the canonical
        # owner-issued planning snapshot.  AvailabilitySnapshot is a related
        # PER projection, not an interchangeable public-id space.
        if ".workforceplan." in operation_id or ".wfm." in operation_id:
            return "HRM.WorkforcePlanningInputSnapshot"
        return "HRM_PER.AvailabilitySnapshot"
    return FIELD_ENTITIES.get(name)


def request_fields(operation: dict[str, Any],
                   schemas: dict[str, dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return expanded_request_fields(operation, schemas)


def rule(prefix: str, operation_id: str, target: str) -> str:
    digest = hashlib.sha256(f"{operation_id}|{target}".encode()).hexdigest()[:12].upper()
    clean = re.sub(r"[^A-Z0-9]+", "_", prefix.upper()).strip("_")[:90]
    return f"{clean}_{digest}"


class OperationBuilder:
    def __init__(self, doc: dict[str, Any], events: dict[str, Any], operation: dict[str, Any],
                 semantic: SemanticValidator, schemas: dict[str, dict[str, Any]],
                 event_schemas: dict[str, dict[str, Any]], create_operations: set[str],
                 transitions: dict[str, dict[str, str]]) -> None:
        self.doc, self.events, self.op, self.semantic = doc, events, operation, semantic
        self.schemas, self.event_schemas = schemas, event_schemas
        self.operation_id = operation["operationId"]
        self.is_create = self.operation_id in create_operations
        self.transition = transitions.get(self.operation_id)
        self.tables = semantic.tables
        self.allowed = list(dict.fromkeys(operation.get("readsTables", []) + operation.get("writesTables", [])))
        self.main = (operation.get("aggregateRootTable")
                     or (operation.get("writesTables") or operation.get("readsTables") or [])[0])
        self.typed: list[dict[str, Any]] = []
        self.typed_by_source: dict[str, dict[str, Any]] = {}
        self.request_sinks: dict[str, list[dict[str, Any]]] = {}
        self.response_identities: dict[tuple[str, str], Identity] = {}
        self.event_identities: dict[tuple[str, str], Identity] = {}

    def write_disposition(self, table_name: str) -> str:
        if table_name not in self.op.get("writesTables", []):
            raise ValueError(f"write disposition requested for non-write table: {self.operation_id} {table_name}")
        if table_name in APPEND_MANY_TABLES_BY_OPERATION.get(self.operation_id, set()):
            return "APPEND_MANY"
        if table_name in UPSERT_CAS_TABLES_BY_OPERATION.get(self.operation_id, set()):
            return "UPSERT_CAS"
        if table_name in INSERT_TABLES_BY_OPERATION.get(self.operation_id, set()):
            return "INSERT"
        if table_name in APPEND_TABLES_BY_OPERATION.get(self.operation_id, set()):
            return "APPEND"
        if self.is_create and table_name == self.main:
            return "INSERT"
        return "UPDATE"

    def add_typed(self, label: str, value_type: str, kind: str, inputs: list[str],
                  prefix: str, identity: Identity | None = None,
                  origin: str = "AGGREGATE_EXISTING", **extra: Any) -> str:
        source = "derived." + re.sub(r"[^A-Za-z0-9_]", "_", label)
        if source in self.typed_by_source:
            return source
        row: dict[str, Any] = {
            "source": source,
            "type": value_type,
            "kind": kind,
            "ruleId": rule(prefix, self.operation_id, label),
            "inputs": list(dict.fromkeys(inputs)),
        }
        if identity is not None:
            row["referenceContract"] = contract(identity)
            row["semanticBinding"] = binding(identity, origin)
        row.update(extra)
        self.typed.append(row)
        self.typed_by_source[source] = row
        return source

    def value(self, ref: str) -> tuple[str, Identity | None]:
        if ref.startswith(("pathParameters.", "queryParameters.", "headers.", "body.")):
            field = request_fields(self.op, self.schemas).get(ref, {})
            return str(field.get("type", "")), declared_identity(field)
        if ref == "principal.tenantId":
            return "BIGINT", None
        if ref == "principal.publicId":
            return "UUID", Identity("Auth.Principal", "PUBLIC_UUID")
        if ref == "authorization.scopeRevision":
            return "BIGINT", None
        if ref == "ownerClock.now":
            return "TIMESTAMPTZ", None
        if ref == "ownerClock.localDate":
            return "DATE", None
        if ref in self.typed_by_source:
            row = self.typed_by_source[ref]
            return row["type"], declared_identity(row)
        if "." in ref:
            table, column = ref.split(".", 1)
            if table in self.tables and column in self.tables[table]["columns"]:
                return self.tables[table]["columns"][column]["sqlType"], self.semantic.physical_identity(table, column)
        return "", None

    def matching_request(self, column: str, value_type: str, identity: Identity | None) -> str | None:
        """Return only an exact name or a reviewed vocabulary alias.

        Type-only, substring and "same UUID entity" scoring used to bind an
        unrelated request field when a command happened to have the right wire
        type.  Ambiguity is now fatal and every accepted alias is materialized
        in the sealed per-operation binding registry.
        """
        names = {camel(column)}
        names.update(REQUEST_COLUMN_ALIASES.get(column, ()))
        if column in BUSINESS_KEY_COLUMNS:
            names.add("businessKey")
        candidates: list[str] = []
        for ref, field in request_fields(self.op, self.schemas).items():
            if ref.startswith("headers.") or field.get("name") not in names:
                continue
            source_type, source_identity = self.value(ref)
            compatible = types_compatible(source_type, value_type)
            if identity is not None and identity.id_space == "INTERNAL_BIGINT":
                compatible = (
                    source_identity == identity
                    or (normalize_type(source_type) == "UUID"
                        and source_identity == Identity(identity.entity_type, "PUBLIC_UUID"))
                )
            elif identity is not None:
                compatible = compatible and source_identity == identity
            if compatible:
                candidates.append(ref)
        # A top-level scalar is the aggregate/header assignment.  A same-named
        # member inside a reviewed ARRAY/OBJECT belongs to its child/value
        # object and must not make the header binding ambiguous.
        top_level = [ref for ref in candidates if ref.count(".") == 1]
        if len(top_level) == 1:
            return top_level[0]
        if len(candidates) > 1:
            raise ValueError(
                f"ambiguous explicit request alias: {self.operation_id} {column} {sorted(candidates)}"
            )
        return candidates[0] if candidates else None

    def add_exact_body_field(self, column: str, value_type: str,
                             identity: Identity | None = None) -> str:
        """Close a genuine command-input gap without borrowing another field."""
        name = camel(column)
        body = self.op["requestSchema"]["body"]
        existing = next((field for field in body if field["name"] == name), None)
        normalized = normalize_type(value_type)
        if normalized in {"UUID[]", "ARRAY<UUID>"}:
            wire_type = "ARRAY"
        elif normalized == "CHAR(64)":
            wire_type = "SHA256"
        elif re.fullmatch(r"(?:VAR)?CHAR\(\d+\)|TEXT", normalized):
            wire_type = "STRING"
        elif normalized.startswith("NUMERIC("):
            wire_type = normalized.replace("NUMERIC(", "DECIMAL(")
        else:
            wire_type = normalized
        if existing is None:
            existing = {
                "name": name, "type": wire_type, "required": True,
                "validation": "exact owner-domain value required for the persisted field; no inferred alias",
                "sensitivity": "RESTRICTED", "tokenization": "NONE",
            }
            if wire_type == "ARRAY":
                existing.update({"itemType": "UUID", "minItems": 0, "maxItems": 500,
                                 "uniqueItems": True, "canonicalOrder": "UUID_BYTE_ASC"})
            body.append(existing)
        if identity is not None:
            public_identity = Identity(identity.entity_type, "PUBLIC_UUID")
            existing["referenceContract"] = contract(public_identity)
            existing["tokenization"] = "OPAQUE_PUBLIC_ID"
        return "body." + name

    def transition_source(self, phase: str, value_type: str = "STRING") -> str:
        if self.transition is None:
            raise ValueError(f"state source requested without a transition: {self.operation_id}")
        phase_key = "from" if phase == "PRE" else "to"
        state = self.transition[phase_key]
        root_spec = self.tables[self.main]["spec"]
        state_column = state_column_for(root_spec, self.operation_id)
        inputs = [f"{self.main}.{state_column}"]
        return self.add_typed(
            f"transition_{phase.lower()}_state", value_type, "TRANSITION_STATE", inputs,
            ("REFETCH_POST_COMMIT_PHYSICAL_STATE_ACCEPTED_BY_CHECK"
             if phase == "POST" else "REFETCH_LOCKED_PRE_TRANSITION_PHYSICAL_STATE"),
            transitionId=self.transition["transitionId"], phase=phase, state=state,
        )

    def physical_source(self, target: str, original: str) -> tuple[str, Identity | None, dict[str, Any] | None]:
        table_name, column = target.split(".", 1)
        field = self.tables[table_name]["columns"][column]
        value_type = field["sqlType"]
        identity = self.semantic.physical_identity(table_name, column)
        request = request_fields(self.op, self.schemas)

        if column == "tenant_id":
            return "principal.tenantId", None, None
        if column == "correlation_id":
            return "headers.X-Correlation-ID", None, None
        if column == "created_by" and self.write_disposition(table_name) == "UPDATE":
            return self.add_typed(
                "snapshot_" + table_name + "_created_by", value_type, "AGGREGATE_SNAPSHOT",
                [target, "principal.tenantId"], "PRESERVE_ORIGINAL_CREATOR_ON_UPDATE",
                Identity("Auth.Principal", "PUBLIC_UUID"), "REFETCHED_SNAPSHOT",
            ), Identity("Auth.Principal", "PUBLIC_UUID"), None
        if column in {"created_by", "updated_by", "actor_public_id", "owner_principal_id", "requester_principal_id"}:
            return "principal.publicId", Identity("Auth.Principal", "PUBLIC_UUID"), None

        persisted_transform = PERSISTED_REQUEST_TRANSFORMS.get((self.operation_id, target))
        if persisted_transform:
            request_source = persisted_transform["source"]
            member_prefix = request_source + "[]."
            inputs = [request_source] + sorted(
                ref for ref in request if ref.startswith(member_prefix)
            )
            source = self.add_typed(
                "canonical_" + table_name + "_" + column,
                value_type,
                "DOMAIN_DERIVATION",
                inputs,
                persisted_transform["rule"],
                canonicalization="RFC8785_JSON_ARRAY_PRESERVE_VALIDATED_REQUEST_ORDER",
            )
            return source, None, None

        # Reviewed successor assignments whose semantics cannot be recovered
        # from a column-name alias.  These bind nested value-object members,
        # owner-clock values, immutable owner snapshots, and server-derived
        # collection facts without inventing additional caller fields.
        exact_request_overrides = {
            ("modern.onboarding.template.create", "ppl_jny_template_versions.task_definitions"):
                "body.tasks",
            ("modern.onboarding.journey.assign", "ppl_jny_assignments.journey_template_version_id"):
                "body.templateVersionId",
            ("modern.growth.profile.update", "prf_grw_profile_revisions.artifact_public_id"):
                "body.profilePatch.artifactPublicId",
            ("modern.wfm.forecast.create", "tme_wfm_demand_lines.interval_start"):
                "body.demandLines[].intervalStart",
            ("modern.wfm.forecast.create", "tme_wfm_demand_lines.interval_end"):
                "body.demandLines[].intervalEnd",
            ("modern.analytics.export.create", "sys_hris_analytics_export_receipts.idempotency_key"):
                "headers.Idempotency-Key",
            ("modern.ai.assist.create", "sys_hris_ai_provenance_receipts.idempotency_key"):
                "headers.Idempotency-Key",
            ("modern.ai.assist.create", "sys_hris_ai_provenance_receipts.source_refs"):
                "body.sourceReferenceIds",
            ("modern.ai.policy.create", "sys_hris_ai_policy_versions.effective_from"):
                "body.validFrom",
        }
        exact_request = exact_request_overrides.get((self.operation_id, target))
        if exact_request:
            source_type, source_identity = self.value(exact_request)
            if identity is not None and identity.id_space == "INTERNAL_BIGINT":
                parent = identity.entity_type.removeprefix("table:")
                internal = self.tables[parent]["spec"]["idColumn"]["name"]
                return exact_request, identity, {
                    "kind": "TENANT_BOUND_PUBLIC_TO_LOCAL_INTERNAL",
                    "table": parent,
                    "publicColumn": "public_id",
                    "internalColumn": internal,
                    "tenantSource": "principal.tenantId",
                }
            if types_compatible(source_type, value_type):
                return exact_request, identity or source_identity, None
            return self.add_typed(
                "reviewed_assignment_" + table_name + "_" + column,
                value_type,
                "DOMAIN_DERIVATION",
                [exact_request],
                "PROJECT_REVIEWED_NESTED_OR_COLLECTION_ASSIGNMENT_WITHOUT_CALLER_FIELD_SYNTHESIS",
                identity or source_identity,
                "VALIDATED_REQUEST" if (identity or source_identity) else "AGGREGATE_EXISTING",
            ), identity or source_identity, None

        if self.operation_id == "modern.onboarding.journey.assign" and table_name == "ppl_jny_assignment_tasks":
            if column == "task_key":
                return self.add_typed(
                    "assigned_template_task_key", value_type, "OWNER_REFETCH_RESULT",
                    ["body.templateVersionId", "principal.tenantId"],
                    "EXPAND_EXACT_LOCKED_TEMPLATE_VERSION_TASK_KEYS",
                    ownerEntity="table:ppl_jny_template_versions", ownerField="tasks[].taskKey",
                    purpose="hcm.onboarding.assign",
                ), None, None
            if column == "task_order":
                return self.add_typed(
                    "assigned_template_task_order", value_type, "ARRAY_ORDINAL",
                    ["body.templateVersionId", "principal.tenantId"],
                    "ASSIGN_CONTIGUOUS_ONE_BASED_ORDER_FROM_LOCKED_TEMPLATE_TASK_ARRAY",
                    initialValue=1, maximum=10000,
                    ownerEntity="table:ppl_jny_template_versions", ownerField="tasks[]",
                    purpose="hcm.onboarding.assign",
                ), None, None

        if (self.operation_id == "modern.hrservice.case.create"
                and target == "ppl_hrs_case_actions.action_type"):
            return self.add_typed(
                "case_created_action_type", value_type, "DOMAIN_CONSTANT", [],
                "SET_INITIAL_HR_CASE_ACTION_TYPE", value="CASE_CREATED",
            ), None, None

        if (self.operation_id == "modern.opportunity.apply"
                and target == "prf_mkt_applications.applied_at"):
            return "ownerClock.now", None, None

        if self.operation_id == "modern.wfm.forecast.create" and table_name == "tme_wfm_demand_lines":
            if column == "line_key":
                return self.add_typed(
                    "forecast_demand_line_key", value_type, "DOMAIN_DERIVATION",
                    ["body.demandLines[].intervalStart", "body.demandLines[].intervalEnd",
                     "body.demandLines[].demandUnitCode", "body.demandLines[].skillPublicId",
                     "body.demandLines[].organizationPublicId"],
                    "DERIVE_STABLE_DEMAND_LINE_KEY_FROM_CANONICAL_TYPED_LINE",
                    optionalInputEncoding="EXPLICIT_NULL_SENTINEL_WITH_FIELD_TAG",
                ), None, None
            if column == "required_skills":
                return self.add_typed(
                    "forecast_required_skill_projection", value_type, "DOMAIN_DERIVATION",
                    ["body.demandLines[].demandUnitCode", "body.demandLines[].skillPublicId",
                     "body.demandLines[].organizationPublicId"],
                    "PROJECT_CLOSED_TYPED_DEMAND_SKILL_REQUIREMENT_OBJECT",
                    optionalInputEncoding="EXPLICIT_NULL_SENTINEL_WITH_FIELD_TAG",
                ), None, None

        if (self.operation_id == "modern.analytics.export.create"
                and target == "sys_hris_analytics_export_receipts.row_count"):
            return self.add_typed(
                "authorized_export_row_count", value_type, "OWNER_REFETCH_RESULT",
                ["body.metricProjectionIds", "principal.tenantId", "principal.publicId"],
                "COUNT_AUTHORIZED_EXPORTED_PROJECTION_ROWS_AFTER_FIELD_POLICY",
                ownerEntity="table:sys_hris_metric_projections",
                ownerField="authorizedExport.rowCount", purpose="hcm.analytics.export",
            ), None, None

        if (self.operation_id == "modern.compplan.plan.approve"
                and table_name == "prf_cmp_plans"):
            if column == "compensation_cycle_id":
                return "pathParameters.cycleId", identity, {
                    "kind": "TENANT_BOUND_PUBLIC_TO_LOCAL_INTERNAL",
                    "table": "prf_cmp_cycles", "publicColumn": "public_id",
                    "internalColumn": "compensation_cycle_id",
                    "tenantSource": "principal.tenantId",
                }
            if column == "cycle_public_id":
                return "pathParameters.cycleId", identity, None
            if column == "approval_receipt_public_id":
                return "body.approvalReceiptId", identity, None
            if column == "approval_revision":
                return self.add_typed(
                    "approved_plan_approval_revision", value_type, "OWNER_REFETCH_RESULT",
                    ["body.approvalReceiptId", "principal.tenantId"],
                    "REFETCH_EXACT_APPROVAL_DECISION_VERSION_UNDER_TENANT_PURPOSE_POLICY",
                    ownerEntity="Approval.DecisionReceipt", ownerField="decisionVersion",
                    purpose="hcm.compensation.plan.approve",
                ), None, None
            if column == "reason_code":
                return "body.reasonCode", None, None
            if column == "approval_outcome":
                return self.add_typed(
                    "approved_plan_outcome", value_type, "DOMAIN_CONSTANT", [],
                    "SET_APPROVED_PLAN_OUTCOME_AFTER_APPROVAL_RECEIPT_VERIFICATION",
                    value="APPROVED",
                ), None, None
            if column == "plan_revision":
                return self.add_typed(
                    "approved_plan_revision", value_type, "VERSION_COUNTER",
                    ["prf_cmp_cycles.aggregate_version"],
                    "ALLOCATE_PLAN_REVISION_UNDER_LOCKED_CYCLE",
                    strategy="MAX_PLUS_ONE_UNDER_CYCLE_LOCK",
                ), None, None
            if column == "content_digest":
                return self.add_typed(
                    "approved_plan_content_digest", value_type, "CANONICAL_DIGEST",
                    ["prf_cmp_cycles.public_id", "prf_cmp_cycles.aggregate_version",
                     "body.approvalReceiptId", "body.reasonCode"],
                    "DIGEST_LOCKED_CYCLE_APPROVED_PROPOSALS_BUDGET_AND_APPROVAL_RECEIPT",
                    digestPurpose=target,
                ), None, None

        if self.operation_id == "modern.wfm.forecast.create":
            if table_name == "tme_wfm_forecast_revision_counters":
                if column == "current_revision":
                    return self.add_typed(
                        "forecast_allocated_revision", value_type, "VERSION_COUNTER",
                        ["tme_wfm_forecast_revision_counters.current_revision", "body.businessKey",
                         "principal.tenantId"],
                        "ATOMIC_INCREMENT_TENANT_FORECAST_KEY_REVISION_COUNTER",
                        strategy="INSERT_ONE_OR_LOCK_AND_INCREMENT",
                    ), None, None
                if column == "last_source_digest":
                    return "body.sourceDigest", None, None
            if table_name == "tme_wfm_demand_forecasts" and column == "forecast_revision":
                return self.add_typed(
                    "forecast_header_revision", value_type, "AGGREGATE_SNAPSHOT",
                    ["tme_wfm_forecast_revision_counters.current_revision"],
                    "CAPTURE_SAME_TRANSACTION_ALLOCATED_FORECAST_REVISION",
                ), None, None
            if table_name == "tme_wfm_demand_lines":
                line_sources = {
                    "interval_start": "body.demandLines[].intervalStart",
                    "interval_end": "body.demandLines[].intervalEnd",
                    "required_headcount": "body.demandLines[].requiredHeadcount",
                    "demand_unit_code": "body.demandLines[].demandUnitCode",
                    "skill_public_id": "body.demandLines[].skillPublicId",
                    "organization_public_id": "body.demandLines[].organizationPublicId",
                }
                if column in line_sources:
                    return line_sources[column], identity, None
                if column == "line_sequence":
                    return self.add_typed(
                        "forecast_demand_line_sequence", value_type, "ARRAY_ORDINAL",
                        ["body.demandLines"],
                        "ASSIGN_CONTIGUOUS_ONE_BASED_SEQUENCE_FROM_VALIDATED_DEMAND_ARRAY",
                        initialValue=1, maximum=100000,
                    ), None, None
                if column == "line_digest":
                    return self.add_typed(
                        "forecast_demand_line_digest", value_type, "CANONICAL_DIGEST",
                        ["body.demandLines[].intervalStart", "body.demandLines[].intervalEnd",
                         "body.demandLines[].requiredHeadcount", "body.demandLines[].demandUnitCode",
                         "body.demandLines[].skillPublicId", "body.demandLines[].organizationPublicId"],
                        "SHA256_CANONICAL_VALIDATED_FORECAST_DEMAND_LINE",
                        digestPurpose=target,
                        optionalInputEncoding="EXPLICIT_NULL_SENTINEL_WITH_FIELD_TAG",
                    ), None, None

        if (self.operation_id == "modern.wfm.schedule.validate"
                and table_name in {"tme_wfm_constraint_violation_lines",
                                   "tme_wfm_fairness_measure_values"}):
            if column == "constraint_evaluation_receipt_id":
                return ("tme_wfm_constraint_evaluation_receipts.constraint_evaluation_receipt_id",
                        identity, None)
            return self.add_typed(
                "constraint_engine_" + table_name + "_" + column,
                value_type, "OWNER_ENGINE_RESULT",
                ["tme_wfm_schedule_candidates.candidate_digest", "body.validationSuiteVersion",
                 "body.inputSnapshotId", "body.policyVersionId", "body.inputDigest"],
                "CAPTURE_REGISTERED_CONSTRAINT_ENGINE_NORMALIZED_RESULT_COLLECTION_FIELD",
                engineOutput=table_name + "." + column,
                **({"maximum": 100000} if column == "line_sequence" else {}),
            ), identity, None

        # Compensation publication is a header + 1..N immutable line write.
        # Header facts come from top-level fields/locked cycle state; line facts
        # come only from the closed array item. Identity, sequence, counts and
        # digests are generated by the owner and are never caller controlled.
        if self.operation_id == "modern.compplan.snapshot.publish":
            if table_name == "prf_cmp_cycles" and column not in {"status", "state", "stage"}:
                return self.add_typed(
                    "snapshot_prf_cmp_cycles_" + column, value_type, "AGGREGATE_SNAPSHOT",
                    [target, "principal.tenantId"],
                    "REFETCH_LOCKED_APPROVED_CYCLE_FIELD_WITHOUT_CALLER_OVERWRITE",
                    identity, "REFETCHED_SNAPSHOT" if identity else "AGGREGATE_EXISTING",
                ), identity, None
            if table_name == "prf_cmp_approved_snapshots":
                header_sources = {
                    "effective_from": "body.effectiveFrom",
                    "plan_public_id": "body.planPublicId",
                    "cycle_public_id": "body.cyclePublicId",
                }
                if column in header_sources:
                    return header_sources[column], identity, None
                if column == "approval_receipt_id":
                    return "prf_cmp_plans.approval_receipt_public_id", identity, None
                if column == "approval_revision":
                    return self.add_typed(
                        "approved_snapshot_approval_revision", value_type, "AGGREGATE_SNAPSHOT",
                        ["prf_cmp_plans.approval_revision", "body.planPublicId",
                         "principal.tenantId"],
                        "CAPTURE_EXACT_APPROVED_PLAN_REVISION_FOR_SNAPSHOT",
                    ), None, None
                if column == "compensation_cycle_id":
                    return "pathParameters.cycleId", identity, {
                        "kind": "TENANT_BOUND_PUBLIC_TO_LOCAL_INTERNAL",
                        "table": "prf_cmp_cycles", "publicColumn": "public_id",
                        "internalColumn": "compensation_cycle_id",
                        "tenantSource": "principal.tenantId",
                    }
                if column == "line_count":
                    return self.add_typed(
                        "approved_snapshot_line_count", value_type, "COLLECTION_CARDINALITY",
                        ["body.lines"], "COUNT_VALIDATED_APPROVED_COMPENSATION_LINES",
                        bounds={"minimum": 1, "maximum": 100000},
                    ), None, None
                if column == "snapshot_revision":
                    return self.add_typed(
                        "approved_snapshot_revision", value_type, "VERSION_COUNTER",
                        ["prf_cmp_cycles.aggregate_version", "principal.tenantId"],
                        "ALLOCATE_NEXT_SNAPSHOT_REVISION_UNDER_CYCLE_LOCK",
                        strategy="MAX_PLUS_ONE_UNDER_CYCLE_LOCK",
                    ), None, None
                if column == "source_version":
                    return self.add_typed(
                        "approved_snapshot_source_version", value_type, "AGGREGATE_SNAPSHOT",
                        ["prf_cmp_cycles.aggregate_version"],
                        "CAPTURE_LOCKED_APPROVED_CYCLE_VERSION",
                    ), None, None
                if column == "payload_digest":
                    return self.add_typed(
                        "approved_snapshot_payload_digest", value_type, "CANONICAL_DIGEST",
                        ["body.approvalReceiptId", "body.effectiveFrom", "body.planPublicId",
                         "body.cyclePublicId", "body.lines", "body.contentDigest"],
                        "RECOMPUTE_CANONICAL_HEADER_ORDERED_LINES_AND_CURRENCY_TOTALS_DIGEST_AND_COMPARE_ASSERTION",
                        digestPurpose=target, callerAssertion="body.contentDigest",
                    ), None, None
                if column == "effective_to":
                    return self.add_typed(
                        "approved_snapshot_effective_to", value_type, "COLLECTION_AGGREGATE",
                        ["body.lines[].effectiveTo"],
                        "NULL_IF_ANY_LINE_OPEN_ENDED_ELSE_MAX_VALIDATED_LINE_EFFECTIVE_TO",
                    ), None, None
            if table_name == "prf_cmp_approved_snapshot_lines":
                line_sources = {
                    "worker_public_id": "body.lines[].workerPublicId",
                    "assignment_public_id": "body.lines[].assignmentPublicId",
                    "component_code": "body.lines[].componentCode",
                    "currency_code": "body.lines[].currencyCode",
                    "approved_amount": "body.lines[].approvedAmount",
                    "effective_from": "body.lines[].effectiveFrom",
                    "effective_to": "body.lines[].effectiveTo",
                }
                if column in line_sources:
                    return line_sources[column], identity, None
                if column == "line_sequence":
                    return self.add_typed(
                        "approved_snapshot_line_sequence", value_type, "ARRAY_ORDINAL",
                        ["body.lines"], "ASSIGN_CONTIGUOUS_ONE_BASED_SEQUENCE_FROM_VALIDATED_ARRAY_ORDER",
                        initialValue=1, maximum=100000,
                    ), None, None
                if column == "line_digest":
                    return self.add_typed(
                        "approved_snapshot_line_digest", value_type, "CANONICAL_DIGEST",
                        ["body.lines[].workerPublicId", "body.lines[].assignmentPublicId",
                         "body.lines[].componentCode", "body.lines[].currencyCode",
                         "body.lines[].approvedAmount", "body.lines[].effectiveFrom",
                         "body.lines[].effectiveTo"],
                        "SHA256_CANONICAL_VALIDATED_COMPENSATION_LINE_AFTER_DECIMAL_NORMALIZATION",
                        digestPurpose=target,
                        optionalInputEncoding="EXPLICIT_NULL_SENTINEL_WITH_FIELD_TAG",
                    ), None, None

        # Constraint result counts are registered-engine output. They cannot be
        # supplied by the validation caller and are captured with the exact
        # engine receipt in the same transaction.
        if (self.operation_id == "modern.wfm.schedule.validate"
                and table_name == "tme_wfm_constraint_evaluation_receipts"
                and column in {"blocking_violation_count", "fairness_metric_count"}):
            return self.add_typed(
                "constraint_engine_" + column, value_type, "OWNER_ENGINE_RESULT",
                ["body.validationSuiteVersion", "body.inputSnapshotId", "body.policyVersionId",
                 "body.inputDigest", "tme_wfm_schedule_candidates.candidate_digest"],
                "CAPTURE_REGISTERED_CONSTRAINT_ENGINE_RESULT_AFTER_INPUT_DIGEST_RECOMPUTE",
                engineOutput=column,
            ), None, None

        if (self.operation_id == "modern.wfm.schedule.validate"
                and table_name == "tme_wfm_constraint_evaluation_receipts"):
            locked_candidate_sources = {
                "candidate_revision": "tme_wfm_schedule_candidates.candidate_revision",
                "candidate_digest": "tme_wfm_schedule_candidates.candidate_digest",
                "planning_input_snapshot_id": "tme_wfm_schedule_candidates.input_snapshot_id",
            }
            if column in locked_candidate_sources:
                source_ref = locked_candidate_sources[column]
                return self.add_typed(
                    "validated_" + column, value_type, "AGGREGATE_SNAPSHOT",
                    [source_ref, "principal.tenantId"],
                    "CAPTURE_EXACT_LOCKED_SCHEDULE_CANDIDATE_FACT_FOR_VALIDATION_RECEIPT",
                    identity, "REFETCHED_SNAPSHOT" if identity else "AGGREGATE_EXISTING",
                ), identity, None
            owner_policy_fields = {
                "policy_revision": "revision",
                "policy_digest": "contentSha256",
            }
            if column in owner_policy_fields:
                return self.add_typed(
                    "validated_" + column, value_type, "OWNER_REFETCH_RESULT",
                    ["body.policyVersionId", "principal.tenantId"],
                    "CAPTURE_EXACT_TENANT_PURPOSE_BOUND_CONSTRAINT_POLICY_FACT",
                    ownerEntity="SYS.Config", ownerField=owner_policy_fields[column],
                    purpose="hcm.wfm.validate",
                ), None, None
            if column == "validation_status":
                return self.add_typed(
                    "constraint_engine_validation_status", value_type, "OWNER_ENGINE_RESULT",
                    ["body.validationSuiteVersion", "body.inputDigest",
                     "tme_wfm_schedule_candidates.candidate_digest"],
                    "CAPTURE_REGISTERED_CONSTRAINT_ENGINE_PASS_OR_FAIL_OUTCOME",
                    engineOutput="validationStatus",
                ), None, None

        if (self.operation_id == "modern.wfm.schedule.publish"
                and table_name == "tme_wfm_schedule_publish_ledger"):
            candidate_sources = {
                "candidate_revision": "tme_wfm_schedule_candidates.candidate_revision",
                "candidate_digest": "tme_wfm_schedule_candidates.candidate_digest",
            }
            if column in candidate_sources:
                return self.add_typed(
                    "published_" + column, value_type, "AGGREGATE_SNAPSHOT",
                    [candidate_sources[column], "principal.tenantId"],
                    "CAPTURE_EXACT_LOCKED_APPROVED_SCHEDULE_CANDIDATE_FACT",
                ), None, None
            if column == "approval_receipt_public_id":
                return "body.approvalReceiptId", identity, None
            if column == "canonical_schedule_period_public_id":
                owner_identity = Identity("TIM.SchedulePeriod", "PUBLIC_UUID")
                return self.add_typed(
                    "canonical_schedule_period_owner_ack", value_type, "OWNER_REFETCH_RESULT",
                    ["pathParameters.candidateId", "body.approvalReceiptId", "principal.tenantId"],
                    "CAPTURE_CANONICAL_SCHEDULE_PUBLICATION_OWNER_ACK_ID",
                    owner_identity, "REFETCHED_SNAPSHOT",
                    ownerEntity="TIM.SchedulePeriod", ownerField="publicId",
                    purpose="hcm.wfm.publish",
                ), owner_identity, None
            if column == "published_by":
                return "principal.publicId", Identity("Auth.Principal", "PUBLIC_UUID"), None

        if (self.operation_id == "modern.analytics.metric.publish"
                and table_name == "sys_hris_metric_versions"):
            if column == "approval_receipt_public_id":
                return "body.approvalReceiptId", identity, None
            if column == "published_at":
                return "ownerClock.now", None, None

        if (self.operation_id == "modern.wfm.schedule.submit"
                and table_name == "tme_wfm_approval_requests"):
            if column == "candidate_revision":
                return self.add_typed(
                    "submitted_candidate_revision", value_type, "AGGREGATE_SNAPSHOT",
                    ["tme_wfm_schedule_candidates.candidate_revision", "headers.If-Match"],
                    "CAPTURE_EXACT_LOCKED_VALIDATED_CANDIDATE_REVISION",
                ), None, None
            if column == "candidate_digest":
                return self.add_typed(
                    "submitted_candidate_digest", value_type, "AGGREGATE_SNAPSHOT",
                    ["tme_wfm_schedule_candidates.candidate_digest"],
                    "CAPTURE_EXACT_LOCKED_VALIDATED_CANDIDATE_DIGEST",
                ), None, None
            if column == "submission_digest":
                return self.add_typed(
                    "verified_submission_digest", value_type, "CANONICAL_DIGEST",
                    ["tme_wfm_schedule_candidates.candidate_digest", "body.evaluationReceiptId",
                     "body.submissionDigest"],
                    "RECOMPUTE_CANDIDATE_AND_PASSING_EVALUATION_SUBMISSION_DIGEST_AND_COMPARE_ASSERTION",
                    callerAssertion="body.submissionDigest", digestPurpose=target,
                ), None, None

        direct = self.matching_request(column, value_type, identity)
        if direct and request.get(direct, {}).get("required") is False:
            disposition = self.write_disposition(table_name)
            if disposition == "UPDATE":
                # Optional patch input is not a valid source for a NOT NULL
                # sink by itself.  The owner locks and re-fetches the current
                # value and applies the optional replacement atomically.
                source = self.add_typed(
                    "optional_update_" + table_name + "_" + column,
                    value_type, "AGGREGATE_SNAPSHOT",
                    [direct, target, "principal.tenantId"],
                    "COALESCE_VALIDATED_OPTIONAL_PATCH_WITH_LOCKED_EXISTING_VALUE",
                    identity, "REFETCHED_SNAPSHOT" if identity else "AGGREGATE_EXISTING",
                )
                return source, identity, None
            if field.get("nullable") is False:
                raise ValueError(
                    f"optional request cannot feed required insert sink: {self.operation_id} {direct} -> {target}"
                )
        if direct:
            source_type, source_identity = self.value(direct)
            if identity is not None and identity.id_space == "INTERNAL_BIGINT":
                parent = identity.entity_type.removeprefix("table:")
                if parent not in self.op["readsTables"] and parent not in self.op["writesTables"]:
                    self.op["readsTables"].append(parent)
                    self.allowed.append(parent)
                spec = self.tables[parent].get("spec", {})
                internal = spec.get("idColumn", {}).get("name")
                resolution = {
                    "kind": "TENANT_BOUND_PUBLIC_TO_LOCAL_INTERNAL",
                    "table": parent,
                    "publicColumn": "public_id",
                    "internalColumn": internal,
                    "tenantSource": "principal.tenantId",
                }
                return direct, identity, resolution
            if types_compatible(source_type, value_type):
                return direct, identity or source_identity, None
            source = self.add_typed(
                "bind_" + table_name + "_" + column, value_type, "DOMAIN_DERIVATION", [direct],
                "VALIDATE_AND_CANONICALIZE_REQUEST_FOR_COLUMN", identity,
                "VALIDATED_REQUEST" if identity else "AGGREGATE_EXISTING",
            )
            return source, identity, None

        if identity is None and re.search(r"(?:^|_)(?:status|state|stage)$", column) and self.transition:
            return self.transition_source("POST", value_type), None, None

        # A child row may refer to a parent created in the same owner
        # transaction; use the actual generated local parent identity.
        if identity is not None and identity.id_space == "INTERNAL_BIGINT":
            parent = identity.entity_type.removeprefix("table:")
            if parent in self.allowed:
                internal = self.tables[parent].get("spec", {}).get("idColumn", {}).get("name")
                if internal and internal in self.tables[parent]["columns"]:
                    return f"{parent}.{internal}", identity, None

        # Existing aggregate fields are re-fetched in the tenant/owner CAS
        # transaction.  This is also used for preserved immutable parent refs.
        missing_business_insert = bool(
            identity is not None and original == "headers.X-Correlation-ID"
        )
        disposition = self.write_disposition(table_name)
        if disposition == "UPDATE" and not missing_business_insert:
            source = self.add_typed(
                "snapshot_" + table_name + "_" + column, value_type, "AGGREGATE_SNAPSHOT",
                [target, "principal.tenantId"], "REFETCH_TENANT_OWNER_COLUMN_BEFORE_TRANSITION",
                identity, "REFETCHED_SNAPSHOT" if identity else "AGGREGATE_EXISTING",
            )
            return source, identity, None

        if identity is not None:
            if identity == Identity("HRM.Worker", "PUBLIC_UUID") and "recruiting.hire.record" in self.operation_id:
                source = self.add_typed(
                    "generated_worker_public_id", "UUID", "GENERATED_BUSINESS_ID", [],
                    "OWNER_ALLOCATE_WORKER_UUID_ONCE_AFTER_APPROVED_HIRE", identity,
                    "GENERATED_BUSINESS_ID",
                    generation={"algorithm": "UUID_V7", "issuer": "OWNER",
                                "lifecycle": "CREATED_ONCE_REPLAY_STABLE", "persistedAt": target},
                )
                return source, identity, None
            # Missing external/version references are explicit inputs in the
            # successor contract.  Never substitute correlation or another ID.
            name = camel(column)
            body = self.op["requestSchema"]["body"]
            existing = next((field for field in body if field["name"] == name), None)
            if existing is None:
                body.append({
                    "name": name,
                    "type": "ARRAY" if normalize_type(value_type) == "UUID[]" else "UUID",
                    **({"itemType": "UUID", "minItems": 1, "maxItems": 200,
                        "uniqueItems": True, "canonicalOrder": "UUID_BYTE_ASC"}
                       if normalize_type(value_type) == "UUID[]" else {}),
                    "required": True,
                    "validation": "owner-issued public reference; same tenant, purpose and effective version required",
                    "sensitivity": "RESTRICTED",
                    "tokenization": "OPAQUE_PUBLIC_ID",
                    "referenceContract": contract(Identity(identity.entity_type, "PUBLIC_UUID")),
                })
            else:
                existing["referenceContract"] = contract(Identity(identity.entity_type, "PUBLIC_UUID"))
            ref = "body." + name
            if normalize_type(value_type) == "UUID[]":
                source = self.add_typed(
                    "canonical_" + column, "UUID[]", "DOMAIN_DERIVATION", [ref],
                    "VALIDATE_DEDUPLICATE_AND_BYTE_SORT_OWNER_UUID_ARRAY", identity, "VALIDATED_REQUEST",
                )
                return source, identity, None
            return ref, identity, None

        if normalize_type(value_type) == "TIMESTAMPTZ":
            date_names = {camel(column), *REQUEST_COLUMN_ALIASES.get(column, ())}
            date_refs = [
                ref for ref, request_field in request.items()
                if request_field.get("name") in date_names
                and normalize_type(request_field.get("type", "")) == "DATE"
            ]
            if len(date_refs) == 1:
                source = self.add_typed(
                    "instant_" + table_name + "_" + column, "TIMESTAMPTZ", "DOMAIN_TRANSFORM",
                    date_refs, "RESOLVE_DATE_AT_TENANT_POLICY_START_OF_DAY",
                    transformId="DATE_TO_TENANT_START_INSTANT_V1",
                )
                return source, None, None

        # New rows never borrow an arbitrary same-typed request field.  Values
        # with defined owner semantics have a closed transform; all other gaps
        # become an exact, target-named request field.
        inputs = [ref for ref, field in request.items()
                  if not ref.startswith("headers.X-Correlation") and field.get("required")]
        lower = column.lower()
        if re.search(r"(?:digest|hash)$", lower):
            source = self.add_typed(
                "digest_" + table_name + "_" + column, value_type, "CANONICAL_DIGEST",
                inputs or ["principal.tenantId"],
                "SHA256_CANONICAL_VALIDATED_COMMAND_FOR_PERSISTED_PAYLOAD",
                digestPurpose=target,
            )
            return source, None, None
        elif re.search(r"(?:revision|version|_no|_sequence)$", lower):
            version_inputs = [target, "principal.tenantId"] if disposition == "APPEND" else []
            source = self.add_typed(
                "version_" + table_name + "_" + column, value_type, "VERSION_COUNTER", version_inputs,
                ("ALLOCATE_NEXT_OWNER_SEQUENCE_UNDER_AGGREGATE_LOCK"
                 if disposition == "APPEND" else "INITIALIZE_OWNER_VERSION_COUNTER_AT_ONE"),
                **({"strategy": "MAX_PLUS_ONE_UNDER_OWNER_LOCK"} if disposition == "APPEND"
                   else {"initialValue": 1}),
            )
            return source, None, None
        elif re.search(
                r"(?:assigned|opened|recorded|generated|submitted|published|evaluated|completed|verified|requested|acknowledged)_at$",
                lower):
            source = self.add_typed(
                "clock_" + table_name + "_" + column, value_type, "OWNER_CLOCK_VALUE",
                ["ownerClock.now"], "CAPTURE_OWNER_TRANSACTION_CLOCK_FOR_PERSISTED_TIMESTAMP",
                clock="TRANSACTION_NOW",
            )
            return source, None, None
        return self.add_exact_body_field(column, value_type), None, None

    def source_row(self, target: str, value_type: str, source: str,
                   identity: Identity | None = None, *, physical: bool = False,
                   origin: str | None = None, resolution: dict[str, Any] | None = None) -> dict[str, Any]:
        row: dict[str, Any] = {
            "target": target,
            "sqlType" if physical else "type": value_type,
            "sourcePath" if physical else "source": source,
            "sourceKind": "OBJECT_REFERENCE_RESOLUTION" if identity else "AGGREGATE_DERIVATION",
            "derivation": rule("EXACT_TYPED_OWNER_FIELD_PROJECTION", self.operation_id, target),
        }
        if identity is not None:
            source_type, source_identity = self.value(source)
            if origin is None:
                typed_binding = self.typed_by_source.get(source, {}).get("semanticBinding")
                if (isinstance(typed_binding, dict)
                        and Identity(typed_binding.get("entityType", ""), typed_binding.get("idSpace", "")) == identity
                        and typed_binding.get("sourceKind") in {
                            "AUTHENTICATED_PRINCIPAL", "VALIDATED_REQUEST", "REFETCHED_SNAPSHOT",
                            "AGGREGATE_EXISTING", "GENERATED_BUSINESS_ID",
                        }):
                    origin = typed_binding["sourceKind"]
                elif source.startswith(("pathParameters.", "queryParameters.", "body.")):
                    origin = "VALIDATED_REQUEST"
                elif source.startswith("principal."):
                    origin = "AUTHENTICATED_PRINCIPAL"
                elif source_identity == identity:
                    origin = "AGGREGATE_EXISTING"
                else:
                    origin = "REFETCHED_SNAPSHOT"
            row["semanticBinding"] = binding(identity, origin)
        if resolution:
            row["resolution"] = resolution
        return row

    def build_required_columns(self, old: dict[str, Any]) -> list[dict[str, Any]]:
        old_by_target = {row["target"]: row for row in old.get("requiredColumnSources", [])}
        rows: list[dict[str, Any]] = []
        for table_name in self.op.get("writesTables", []):
            disposition = self.write_disposition(table_name)
            for column, field in self.tables[table_name]["columns"].items():
                if field.get("nullable") is not False or field.get("default") is not None:
                    continue
                target = f"{table_name}.{column}"
                if disposition == "UPDATE":
                    # Existing NOT NULL columns are feasibility inputs to an
                    # UPDATE, not caller assignments.  Read them from the
                    # locked tenant row; true request-driven changes are
                    # materialized separately by build_direct_request_mutations.
                    identity = self.semantic.physical_identity(table_name, column)
                    resolution = None
                    if column == "tenant_id":
                        source = "principal.tenantId"
                    elif column == "correlation_id":
                        # Correlation is trace metadata, never a business UUID;
                        # it need not acquire an artificial entity identity.
                        source = "headers.X-Correlation-ID"
                    else:
                        source = self.add_typed(
                            "locked_required_" + table_name + "_" + column,
                            field["sqlType"], "AGGREGATE_SNAPSHOT",
                            [target, "principal.tenantId"],
                            "PRESERVE_LOCKED_REQUIRED_COLUMN_ON_UPDATE",
                            identity, "REFETCHED_SNAPSHOT" if identity else "AGGREGATE_EXISTING",
                        )
                else:
                    source, identity, resolution = self.physical_source(
                        target, old_by_target.get(target, {}).get("sourcePath", "")
                    )
                row = self.source_row(target, field["sqlType"], source, identity,
                                      physical=True, resolution=resolution)
                rows.append(row)
                if disposition != "UPDATE" and source.startswith(("pathParameters.", "body.")):
                    sink = {"kind": "TABLE_COLUMN", "target": target}
                    if identity is not None:
                        sink["semanticBinding"] = binding(identity, "VALIDATED_REQUEST")
                    if resolution:
                        sink["resolution"] = resolution
                    self.request_sinks.setdefault(source, []).append(sink)
                elif disposition != "UPDATE" and source in self.typed_by_source:
                    transform = PERSISTED_REQUEST_TRANSFORMS.get((self.operation_id, target))
                    if transform:
                        request_source = transform["source"]
                        self.request_sinks.setdefault(request_source, []).append({
                            "kind": "TABLE_COLUMN",
                            "target": target,
                            "valueSource": source,
                            "transformationRuleId": self.typed_by_source[source]["ruleId"],
                        })
        return rows

    def build_direct_request_mutations(self, required: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Persist exact request fields even when the target column is nullable.

        Required-column lineage only covers NOT NULL/no-default feasibility.
        Business fields such as a transition reason or visibility can target a
        nullable audit column and still need a concrete mutation/effect edge.
        """
        existing = {row["target"] for row in required}
        rows: list[dict[str, Any]] = []
        root_state = state_column_for(self.tables[self.main]["spec"], self.operation_id)
        for table_name in self.op.get("writesTables", []):
            internal_id = self.tables[table_name]["spec"].get("idColumn", {}).get("name")
            for column, field in self.tables[table_name]["columns"].items():
                target = f"{table_name}.{column}"
                if (column == internal_id or target in existing
                        or (table_name == self.main and column == root_state)):
                    continue
                if (self.write_disposition(table_name) == "UPDATE"
                        and "IMMUTABLE_EVIDENCE_FACTS" in
                            self.tables[table_name]["spec"].get("immutability", "")):
                    # Verification is a state/version CAS. Evidence identity,
                    # provenance and payload columns remain immutable and are
                    # only compared as decision inputs.
                    continue
                if (self.operation_id == "modern.compplan.snapshot.publish"
                        and table_name == "prf_cmp_cycles"):
                    # Publishing a snapshot changes only the cycle state/version;
                    # a line-level optional effectiveTo must never overwrite the
                    # locked cycle's own effective range.
                    continue
                if (self.operation_id == "modern.compplan.snapshot.publish"
                        and table_name == "prf_cmp_approved_snapshots"
                        and column == "effective_to"):
                    source, identity, resolution = self.physical_source(target, "")
                    rows.append(self.source_row(target, field["sqlType"], source, identity,
                                                physical=True, resolution=resolution))
                    continue
                identity = self.semantic.physical_identity(table_name, column)
                source = self.matching_request(column, field["sqlType"], identity)
                if source is None:
                    continue
                resolution = None
                if identity is not None and identity.id_space == "INTERNAL_BIGINT":
                    resolved_source, _resolved_identity, resolution = self.physical_source(target, "")
                    if resolved_source != source:
                        raise ValueError(
                            f"direct mutation resolution drift: {self.operation_id} {target}"
                        )
                row = self.source_row(target, field["sqlType"], source, identity,
                                      physical=True, resolution=resolution)
                rows.append(row)
                sink: dict[str, Any] = {"kind": "TABLE_COLUMN", "target": target}
                if identity is not None:
                    sink["semanticBinding"] = binding(identity, "VALIDATED_REQUEST")
                if resolution:
                    sink["resolution"] = resolution
                self.request_sinks.setdefault(source, []).append(sink)
        return rows

    def annotate_requests(self) -> None:
        for section in ("pathParameters", "queryParameters", "body"):
            for field in self.op["requestSchema"][section]:
                if business_type(field):
                    entity = request_entity(self.operation_id, field["name"])
                    if entity and not field.get("referenceContract"):
                        field["referenceContract"] = contract(Identity(entity, "PUBLIC_UUID"))

    def build_input_mappings(self) -> list[dict[str, Any]]:
        rows = []
        expanded = request_fields(self.op, self.schemas)
        for ref, field in expanded.items():
            trace = ref == "headers.X-Correlation-ID"
            sinks = copy.deepcopy(self.request_sinks.get(ref, []))
            if not sinks and (field.get("schemaRef") or field.get("itemSchemaRef")):
                # The container is validated as a closed value object or
                # collection, but it is not itself assignable to every scalar
                # member column.  Each expanded member has its own exact sink;
                # this row records collection/object validation and prevents an
                # OBJECT/ARRAY -> scalar edge from becoming self-certifying.
                nested_prefix = ref + ("[]." if field.get("itemSchemaRef") else ".")
                member_sources = sorted(
                    nested_ref for nested_ref in self.request_sinks
                    if nested_ref.startswith(nested_prefix)
                )
                sinks = [{
                    "kind": "CLOSED_MEMBER_SET_VALIDATION",
                    "target": "requestSchema." + (field.get("schemaRef") or field.get("itemSchemaRef")),
                    "memberSources": member_sources,
                }]
            if not sinks:
                if ref.startswith("queryParameters."):
                    sinks = [{"kind": "READ_FILTER", "target": "queryFilter." + field["name"]}]
                elif ref.startswith("headers."):
                    sinks = [{"kind": "COMMAND_CONTROL", "target": "control." + field["name"]}]
                else:
                    sinks = [{"kind": "TRANSITION_GUARD", "target": self.operation_id + "." + field["name"]}]
            rows.append({
                "source": ref,
                "type": field["type"],
                "required": field["required"],
                "validation": field["validation"],
                "derivation": rule("VALIDATE_EXACT_REQUEST_FIELD", self.operation_id, ref),
                "aggregateTarget": self.operation_id + "." + field["name"],
                "objectReferenceMode": "TRACE_METADATA" if trace else (
                    "OPAQUE_PUBLIC_UUID" if business_type(field) else "NONE"
                ),
                "sinks": sinks,
            })
        return rows

    def select_actual(self, field: dict[str, Any], preferred: str | None = None,
                      tables: list[str] | None = None) -> tuple[str, Identity | None] | None:
        names = [snake(field["name"])]
        aliases = {
            "receipt_id": ["public_id", "command_receipt_id"],
            "aggregate_id": ["public_id"],
            "aggregate_version": ["aggregate_version", "aggregate_revision"],
            "occurred_at": ["completed_at", "created_at", "recorded_at", "generated_at"],
            "payload_digest": ["payload_digest", "request_digest", "request_hash", "input_digest"],
            "line_id": ["public_id"],
            "worker_id": ["worker_public_id"],
            "assignment_id": ["assignment_public_id"],
            "plan_id": ["public_id"],
            "cycle_id": ["public_id"],
            "snapshot_id": ["public_id"],
            "currency": ["currency_code", "budget_currency"],
        }
        aliases.update({key: list(value) for key, value in EVENT_COLUMN_ALIASES.items()})
        names.extend(aliases.get(names[0], []))
        ordered = list(tables or self.allowed)
        if preferred in ordered:
            ordered.remove(preferred)
            ordered.insert(0, preferred)
        for name in names:
            for table_name in ordered:
                column = self.tables[table_name]["columns"].get(name)
                if column and types_compatible(column["sqlType"], field["type"]):
                    return f"{table_name}.{name}", self.semantic.physical_identity(table_name, name)
        return None

    def capability_tables(self) -> list[str]:
        capability = self.op.get("capabilityId")
        return [
            table_name for table_name, table in self.tables.items()
            if not table.get("base") and table.get("spec", {}).get("capabilityId") == capability
        ]

    def select_event_actual(self, field: dict[str, Any]) -> tuple[str, Identity | None] | None:
        # A same-named column elsewhere in the capability is not causal proof.
        # Event projection is restricted to the operation's declared read/write
        # set; expanding reads as a side effect is forbidden.
        return self.select_actual(field, self.main, list(self.allowed))

    def aggregate_metric(self, label: str, value_type: str, table_name: str,
                         function: str, filter_ref: str) -> str:
        if table_name not in self.tables:
            raise ValueError(f"metric table missing: {self.operation_id} {table_name}")
        if self.tables[table_name].get("spec", {}).get("capabilityId") != self.op.get("capabilityId"):
            raise ValueError(f"metric table crosses capability: {self.operation_id} {table_name}")
        if table_name not in self.op["readsTables"] and table_name not in self.op["writesTables"]:
            self.op["readsTables"].append(table_name)
            self.allowed.append(table_name)
        public_ref = f"{table_name}.public_id"
        return self.add_typed(
            label, value_type, "AGGREGATE_COMPUTATION", [public_ref, filter_ref],
            f"{function}_TENANT_OWNER_ROWS_FOR_EVENT_FIELD",
            computation={"function": function, "table": table_name,
                         "tenantSource": "principal.tenantId", "filterSource": filter_ref},
        )

    def projection(self, label: str, value_type: str, schema_ref: str, preferred: str,
                   kind: str) -> str:
        schema = self.schemas[schema_ref]
        root = RECORD_ROOT_TABLES.get(schema_ref, preferred)
        if root not in self.allowed:
            table = self.tables.get(root)
            if table is None or table.get("owner") != self.op["session"]:
                raise ValueError(f"record root outside owner boundary: {self.operation_id} {schema_ref} {root}")
            self.op["readsTables"].append(root)
            self.allowed.append(root)
        projection_tables = [root] + [table for table in self.allowed if table != root]
        mappings: list[dict[str, Any]] = []
        inputs: list[str] = []
        for field in schema["fields"]:
            found = self.select_actual(field, root, projection_tables)
            if found is None:
                base = f"{root}.public_id"
                source = self.add_typed(
                    f"projection_{label}_{field['name']}", field["type"], "DOMAIN_DERIVATION",
                    [base], "PROJECT_EXACT_RECORD_FIELD_FROM_OWNER_ROW",
                )
                identity = None
            else:
                source, identity = found
            self.identity_for_response(schema_ref, field, identity)
            inputs.append(source)
            mappings.append(self.source_row(f"{schema_ref}.{field['name']}", field["type"], source, identity))
        extra = {"itemSchemaRef" if value_type == "ARRAY" else "schemaRef": schema_ref,
                 "fieldSources": mappings}
        return self.add_typed(label, value_type, kind, inputs,
                              "PROJECT_AUTHORIZED_OWNER_ROWS_TO_CLOSED_SCHEMA", **extra)

    def identity_for_response(self, schema_id: str, field: dict[str, Any], identity: Identity | None) -> None:
        if identity is not None and business_type(field):
            self.response_identities[(schema_id, field["name"])] = identity

    def receipt_response(self, schema: dict[str, Any], field: dict[str, Any]) -> tuple[str, Identity | None]:
        spec = RECEIPTS[self.op["session"]]
        table = spec["table"]
        name = field["name"]
        receipt_identity = Identity("table:" + table, "PUBLIC_UUID")
        main_identity = Identity("table:" + self.main, "PUBLIC_UUID")
        if name == "receiptId":
            ref = f"{table}.{spec['id']}"
            return self.add_typed(
                "command_receipt_id", "UUID", "COMMAND_RECEIPT", [ref],
                "PROJECT_CALLER_BOUND_OWNER_COMMAND_RECEIPT_ID", receipt_identity,
                "AGGREGATE_EXISTING", receiptRef="receipt.owner",
            ), receipt_identity
        if name == "status":
            return f"{table}.{spec['status']}", None
        if name == "aggregateId":
            ref = f"{self.main}.public_id"
            if self.is_create:
                return self.add_typed(
                    "generated_primary_aggregate_id", "UUID", "GENERATED_BUSINESS_ID", [],
                    "OWNER_ALLOCATE_PRIMARY_AGGREGATE_UUID_ONCE", main_identity,
                    "GENERATED_BUSINESS_ID",
                    generation={"algorithm": "UUID_V7", "issuer": "OWNER",
                                "lifecycle": "CREATED_ONCE_REPLAY_STABLE", "persistedAt": ref},
                ), main_identity
            return self.add_typed(
                "post_transition_aggregate_id", "UUID", "AGGREGATE_SNAPSHOT", [ref],
                "REFETCH_POST_TRANSITION_AGGREGATE_PUBLIC_ID", main_identity, "REFETCHED_SNAPSHOT",
            ), main_identity
        if name == "aggregateVersion":
            revision = spec.get("revision")
            return (f"{table}.{revision}" if revision else f"{self.main}.aggregate_version"), None
        if name == "correlationId":
            return (f"{table}.{spec['correlation']}" if spec.get("correlation") else "headers.X-Correlation-ID"), None
        if name == "occurredAt":
            return f"{table}.{spec['time']}", None
        if name == "payloadDigest":
            return f"{table}.{spec['digest']}", None
        raise ValueError(f"unsupported receipt field {schema['schemaId']}.{name}")

    def build_response(self, old: dict[str, Any]) -> list[dict[str, Any]]:
        schema = self.schemas[self.op["responseSchemaRef"]]
        old_sources = {row["target"]: row.get("source", "") for row in old.get("responseFieldSources", [])}
        preferred = None
        for ref in old_sources.values():
            table = ref.split(".", 1)[0]
            if table in self.allowed:
                preferred = table
                break
        preferred = preferred or self.main
        is_receipt = {field["name"] for field in schema["fields"]} == {
            "receiptId", "status", "aggregateId", "aggregateVersion",
            "correlationId", "occurredAt", "payloadDigest",
        }
        rows = []
        for field in schema["fields"]:
            target = f"{schema['schemaId']}.{field['name']}"
            compensation_snapshot_sources = {
                "snapshotId": ("prf_cmp_approved_snapshots.public_id",
                               Identity("table:prf_cmp_approved_snapshots", "PUBLIC_UUID")),
                "planId": ("prf_cmp_approved_snapshots.plan_public_id",
                           Identity("PER.CompensationPlan", "PUBLIC_UUID")),
                "cycleId": ("prf_cmp_approved_snapshots.cycle_public_id",
                            Identity("table:prf_cmp_cycles", "PUBLIC_UUID")),
            }
            if (schema["schemaId"] == "ApprovedCompensationPlanSnapshot.v1"
                    and field["name"] in compensation_snapshot_sources):
                source, identity = compensation_snapshot_sources[field["name"]]
            elif is_receipt:
                source, identity = self.receipt_response(schema, field)
            elif field.get("itemSchemaRef") or field.get("schemaRef"):
                schema_ref = field.get("itemSchemaRef") or field.get("schemaRef")
                kind = "QUERY_RESULT" if self.op["mode"] == "QUERY" else "AGGREGATE_SNAPSHOT"
                source = self.projection("response_" + field["name"], field["type"], schema_ref, preferred, kind)
                identity = None
            elif field["name"] == "nextCursor":
                as_of = self.ensure_as_of()
                cursor_inputs = ["principal.tenantId", "principal.publicId", "authorization.scopeRevision", as_of,
                                 f"{preferred}.public_id"]
                if "queryParameters.cursor" in request_fields(self.op, self.schemas):
                    cursor_inputs.append("queryParameters.cursor")
                source = self.add_typed("page_cursor", "STRING", "PAGE_CURSOR", cursor_inputs,
                                        "SIGN_TENANT_CALLER_SCOPE_ASOF_KEYSET_CURSOR")
                identity = None
            elif field["name"] == "hasMore":
                source = self.add_typed("page_has_more", "BOOLEAN", "PAGE_HAS_MORE",
                                        ["queryParameters.limit", f"{preferred}.public_id"],
                                        "COMPARE_AUTHORIZED_LIMIT_PLUS_ONE_RESULT")
                identity = None
            elif field["name"] == "asOf":
                source, identity = self.ensure_as_of(), None
            elif field["name"] == "scopeRevision":
                source = self.add_typed("scope_revision", "BIGINT", "AUTHORIZATION_SCOPE_REVISION",
                                        ["authorization.scopeRevision"],
                                        "PROJECT_CURRENT_OWNER_AUTHORIZATION_SCOPE_REVISION")
                identity = None
            elif field["name"] == "payloadDigest":
                inputs = [f"{preferred}.public_id"]
                for table_name in self.allowed:
                    if "payload_digest" in self.tables[table_name]["columns"]:
                        inputs.append(f"{table_name}.payload_digest")
                source = self.add_typed("response_payload_digest", "SHA256", "DOMAIN_DERIVATION", inputs,
                                        "HASH_CANONICAL_AUTHORIZED_RESPONSE_PROJECTION")
                identity = None
            else:
                found = self.select_actual(field, preferred)
                if found:
                    source, identity = found
                else:
                    source = self.add_typed("response_" + field["name"], field["type"], "DOMAIN_DERIVATION",
                                            [f"{preferred}.public_id"],
                                            "PROJECT_EXACT_RESPONSE_FIELD_FROM_OWNER_SNAPSHOT")
                    identity = None
            self.identity_for_response(schema["schemaId"], field, identity)
            rows.append(self.source_row(target, field["type"], source, identity))
        return rows

    def ensure_as_of(self) -> str:
        if "derived.owner_as_of" in self.typed_by_source:
            return "derived.owner_as_of"
        inputs = ["ownerClock.now"]
        for ref in request_fields(self.op, self.schemas):
            if ref.endswith(".asOf"):
                inputs.append(ref)
        return self.add_typed("owner_as_of", "TIMESTAMPTZ", "OWNER_AS_OF", inputs,
                              "FREEZE_VALIDATED_REQUEST_ASOF_OR_OWNER_TRANSACTION_CLOCK")

    def event_source(self, event_name: str, field: dict[str, Any]) -> tuple[str, Identity | None]:
        name = field["name"]
        event_label = "event_" + snake(event_name.replace(".", "_")) + "_" + snake(name)
        declared_request_source = field.get("sourceRequestField")
        if declared_request_source:
            request = request_fields(self.op, self.schemas)
            if declared_request_source not in request:
                raise ValueError(
                    f"declared event request source missing: {self.operation_id} "
                    f"{event_name}.{name} <- {declared_request_source}"
                )
            request_field = request[declared_request_source]
            if not types_compatible(request_field["type"], field["type"]):
                raise ValueError(
                    f"declared event request source type mismatch: {self.operation_id} "
                    f"{event_name}.{name}"
                )
            identity = declared_identity(request_field)
            if name == "correlationId":
                return declared_request_source, None
            source = self.add_typed(
                event_label, field["type"], "AGGREGATE_SNAPSHOT",
                [f"{self.main}.public_id", declared_request_source],
                "CAPTURE_EXACT_VALIDATED_REQUEST_FIELD_IN_POST_TRANSITION_EVENT",
                identity, "VALIDATED_REQUEST" if identity else "AGGREGATE_EXISTING",
            )
            return source, identity
        # A locked PRE fact can also name its physical column, but its causal
        # meaning is the transition snapshot.  Resolve that phase before the
        # general physical-source branch so PRE is never relabelled as POST.
        if field.get("sourceTransitionPhase"):
            transition_root = field.get("sourceTransitionRootTable")
            if transition_root and transition_root != self.main:
                if transition_root not in self.allowed:
                    raise ValueError(
                        f"conditional event transition root outside operation access: "
                        f"{self.operation_id} {event_name} {transition_root}"
                    )
                state_column = state_column_for(self.tables[transition_root]["spec"], self.operation_id)
                return self.add_typed(
                    event_label, field["type"], "AGGREGATE_SNAPSHOT",
                    [f"{transition_root}.{state_column}"],
                    ("CAPTURE_LOCKED_CONDITIONAL_AGGREGATE_PRE_STATE"
                     if field["sourceTransitionPhase"] == "PRE"
                     else "CAPTURE_COMMITTED_CONDITIONAL_AGGREGATE_POST_STATE"),
                    transitionRootTable=transition_root,
                    transitionStateColumn=state_column,
                    phase=field["sourceTransitionPhase"],
                    states=list(field.get("sourceTransitionStates", [])),
                ), None
            return self.transition_source(field["sourceTransitionPhase"], field["type"]), None
        declared_physical_source = field.get("sourcePhysicalField")
        if declared_physical_source:
            source_table = declared_physical_source.split(".", 1)[0]
            if source_table not in self.op.get("readsTables", []) + self.op.get("writesTables", []):
                raise ValueError(
                    f"event physical source is not declared read/write: {self.operation_id} "
                    f"{event_name}.{name} <- {declared_physical_source}"
                )
            value_type, identity = self.value(declared_physical_source)
            if not types_compatible(value_type, field["type"]):
                raise ValueError(
                    f"event physical source type mismatch: {self.operation_id} "
                    f"{event_name}.{name}"
                )
            source = self.add_typed(
                event_label, value_type, "AGGREGATE_SNAPSHOT",
                [f"{self.main}.public_id", declared_physical_source],
                "PROJECT_DECLARED_SAME_TRANSACTION_PHYSICAL_EVENT_FACT",
                identity, "REFETCHED_SNAPSHOT",
            )
            return source, identity
        owner_context = field.get("sourceOwnerContext")
        if owner_context in {"ownerClock.transactionNow", "context.ownerClock.transactionNow"}:
            return self.add_typed(
                event_label, field["type"], "OWNER_CLOCK_VALUE",
                ["ownerClock.now"], "CAPTURE_OWNER_TRANSACTION_CLOCK_FOR_CAUSAL_EVENT",
                clock="TRANSACTION_NOW",
            ), None
        if owner_context == "context.correlationId":
            return "context.correlationId", None
        if isinstance(owner_context, str) and owner_context.startswith("CONSTANT:"):
            return self.add_typed(
                event_label, field["type"], "DOMAIN_CONSTANT", [],
                "CAPTURE_REVIEWED_DOMAIN_CONSTANT_FOR_CAUSAL_EVENT",
                constantValue=owner_context.removeprefix("CONSTANT:"),
            ), None
        reviewed_owner_fact = OWNER_EVENT_FACT_CONTRACTS.get((event_name, name))
        if reviewed_owner_fact:
            owner_entity, owner_field, purpose, selectors = reviewed_owner_fact
            identity = None
            reference = field.get("referenceContract") or {}
            if reference.get("entityType") and reference.get("idSpace"):
                identity = Identity(reference["entityType"], reference["idSpace"])
            return self.add_typed(
                event_label, field["type"], "OWNER_REFETCH_RESULT",
                ["principal.tenantId", *selectors],
                "REFETCH_EXACT_TENANT_PURPOSE_VERSION_BOUND_EVENT_FACT",
                identity,
                "REFETCHED_SNAPSHOT" if identity else "AGGREGATE_EXISTING",
                ownerEntity=owner_entity, ownerField=owner_field, purpose=purpose,
            ), identity
        if owner_context:
            owner_source = str(owner_context)
            reference = field.get("referenceContract") or {}
            identity = (
                Identity(reference["entityType"], reference["idSpace"])
                if reference.get("entityType") and reference.get("idSpace")
                else None
            )
            return self.add_typed(
                event_label,
                field["type"],
                "OWNER_REFETCHED_FACT",
                [owner_source],
                "CAPTURE_EXACT_TENANT_PURPOSE_VERSION_BOUND_OWNER_FACT",
                identity,
                "REFETCHED_SNAPSHOT" if identity else "AGGREGATE_EXISTING",
            ), identity
        if name == "correlationId":
            # Correlation is trace metadata, never a business UUID and never an
            # aggregate/entity selector.
            return "headers.X-Correlation-ID", None
        main_public = f"{self.main}.public_id"
        main_identity = Identity("table:" + self.main, "PUBLIC_UUID")
        entity_name = request_entity(self.operation_id, name)
        if name == "aggregateId":
            entity_name = main_identity.entity_type
        if event_name == "BenefitAdministrationChanged.v1" and name == "caseId":
            entity_name = main_identity.entity_type
        if name == "journeyAssignmentId":
            entity_name = "table:ppl_jny_assignments"
        elif name == "offerId":
            entity_name = "table:ppl_rec_offers"
        elif name == "completionId":
            entity_name = "table:prf_lrn_completion_evidence"
        elif name == "assistanceReceiptId":
            entity_name = "table:sys_hris_ai_provenance_receipts"
        elif name == "snapshotId":
            entity_name = "table:prf_cmp_approved_snapshots"
        elif name == "keyPositionId":
            entity_name = "HRM.Position"
        elif name == "skillId":
            entity_name = "PER.Skill"
        if normalize_type(field["type"]) == "UUID" and entity_name:
            desired = Identity(entity_name, "PUBLIC_UUID")
            candidates: list[str] = []
            for ref in request_fields(self.op, self.schemas):
                if self.value(ref)[1] == desired:
                    candidates.append(ref)
            for table_name in list(self.allowed):
                for column in self.tables[table_name]["columns"]:
                    ref = f"{table_name}.{column}"
                    if self.value(ref)[1] == desired:
                        candidates.append(ref)
            if desired == main_identity:
                candidates.insert(0, main_public)
            if not candidates and entity_name.startswith("table:"):
                owner_table = entity_name.removeprefix("table:")
                owner_spec = self.tables.get(owner_table, {}).get("spec", {})
                if (owner_table in self.tables
                        and self.tables[owner_table].get("owner") == self.op["session"]
                        and owner_spec.get("capabilityId") == self.op.get("capabilityId")):
                    if owner_table not in self.op["readsTables"] and owner_table not in self.op["writesTables"]:
                        self.op["readsTables"].append(owner_table)
                        self.allowed.append(owner_table)
                    candidates.append(owner_table + ".public_id")
            if not candidates:
                # Cross-boundary event references must be explicit validated
                # command inputs; an unrelated UUID can never substitute.
                request_name = name if name.endswith("Id") else name + "Id"
                body = self.op["requestSchema"]["body"]
                existing = next((item for item in body if item["name"] == request_name), None)
                if existing is None:
                    body.append({
                        "name": request_name, "type": "UUID", "required": True,
                        "validation": "owner-issued event reference; tenant, purpose and aggregate relationship verified",
                        "sensitivity": "RESTRICTED", "tokenization": "OPAQUE_PUBLIC_ID",
                        "referenceContract": contract(desired),
                    })
                else:
                    existing["referenceContract"] = contract(desired)
                candidates.append("body." + request_name)
            source = self.add_typed(
                event_label, "UUID", "AGGREGATE_SNAPSHOT", [main_public, candidates[0]],
                "PROJECT_EXACT_POST_TRANSITION_BUSINESS_REFERENCE", desired,
                ("VALIDATED_REQUEST"
                 if candidates[0].startswith(("pathParameters.", "queryParameters.", "body."))
                 else "REFETCHED_SNAPSHOT"),
            )
            return source, desired
        if name == "aggregateVersion":
            return f"{self.main}.aggregate_version", None
        if name in {"fromState", "fromStage"}:
            return self.transition_source("PRE", field["type"]), None
        if name in {"toState", "toStage"}:
            return self.transition_source("POST", field["type"]), None
        # Prefer an exact request field, then a real owner table column.
        accepted_request_names = {name, *EVENT_REQUEST_ALIASES.get(name, ())}
        for ref, request_field in request_fields(self.op, self.schemas).items():
            if request_field["name"] in accepted_request_names and types_compatible(request_field["type"], field["type"]):
                identity = declared_identity(request_field)
                inputs = [main_public, ref]
                source = self.add_typed(
                    event_label, field["type"], "AGGREGATE_SNAPSHOT", inputs,
                    "CAPTURE_VALIDATED_COMMAND_IN_POST_TRANSITION_SNAPSHOT", identity,
                    "VALIDATED_REQUEST" if identity else "AGGREGATE_EXISTING",
                )
                return source, identity
        found = self.select_event_actual(field)
        if found:
            ref, identity = found
            source = self.add_typed(
                event_label, field["type"], "AGGREGATE_SNAPSHOT", [main_public, ref],
                "PROJECT_POST_TRANSITION_OWNER_SNAPSHOT_FIELD", identity, "REFETCHED_SNAPSHOT",
            )
            return source, identity

        metric_specs = {
            "completedTaskCount": ("ppl_jny_task_evidence", "COUNT_COMPLETED_TASKS"),
            "nominationCount": ("prf_suc_nominations", "COUNT_ACTIVE_NOMINATIONS"),
            "revokedGrantCount": ("ppl_cwk_access_expiry_receipts", "COUNT_REVOKED_GRANTS"),
            "unreconciledGrantCount": ("ppl_cwk_access_expiry_receipts", "COUNT_UNRECONCILED_GRANTS"),
        }
        if name in metric_specs:
            table_name, function = metric_specs[name]
            return self.aggregate_metric(
                event_label, field["type"], table_name, function, main_public
            ), None

        # Public DATE event fields are deliberately projected in the tenant's
        # policy timezone from an exact persisted instant; this is not a
        # permissive string/date coercion.
        if name in {"schedulePeriodStart", "schedulePeriodEnd"}:
            column = "period_start" if name.endswith("Start") else "period_end"
            candidates = [
                f"{table_name}.{column}" for table_name in self.capability_tables()
                if column in self.tables[table_name]["columns"]
                and normalize_type(self.tables[table_name]["columns"][column]["sqlType"]) == "TIMESTAMPTZ"
            ]
            if not candidates:
                raise ValueError(f"event date source missing: {self.operation_id} {name}")
            ref = candidates[0]
            table_name = ref.split(".", 1)[0]
            if table_name not in self.op["readsTables"] and table_name not in self.op["writesTables"]:
                self.op["readsTables"].append(table_name)
                self.allowed.append(table_name)
            return self.add_typed(
                event_label, "DATE", "DOMAIN_TRANSFORM", [ref],
                "PROJECT_PERSISTED_INSTANT_TO_TENANT_POLICY_LOCAL_DATE",
                transformId="TIMESTAMPTZ_TO_TENANT_LOCAL_DATE_V1",
            ), None

        if name == "asOf":
            candidates = [
                f"{table_name}.as_of" for table_name in self.capability_tables()
                if "as_of" in self.tables[table_name]["columns"]
            ]
            if not candidates:
                raise ValueError(f"event asOf source missing: {self.operation_id}")
            ref = candidates[0]
            table_name = ref.split(".", 1)[0]
            if table_name not in self.op["readsTables"] and table_name not in self.op["writesTables"]:
                self.op["readsTables"].append(table_name)
                self.allowed.append(table_name)
            return self.add_typed(
                event_label, field["type"], "DOMAIN_TRANSFORM", [ref],
                "SERIALIZE_PERSISTED_ASOF_AS_CANONICAL_RFC3339",
                transformId="TIMESTAMPTZ_TO_RFC3339_V1",
            ), None

        raise ValueError(
            f"unresolved explicit event binding: {self.operation_id} {event_name}.{name}"
        )

    def build_events(self) -> list[dict[str, Any]]:
        rows = []
        for event_name in self.op.get("eventNames", []):
            schema = self.event_schemas[event_name]
            for field in schema["fields"]:
                source, identity = self.event_source(event_name, field)
                if identity is not None and business_type(field):
                    self.event_identities[(event_name, field["name"])] = identity
                row = self.source_row(f"{event_name}.{field['name']}", field["type"], source, identity)
                row["sourceKind"] = "AGGREGATE_SNAPSHOT"
                row["sourcePath"] = row.pop("source")
                rows.append(row)
        return rows

    def build(self, old: dict[str, Any]) -> tuple[dict[str, Any], dict, dict]:
        self.annotate_requests()
        required = self.build_required_columns(old) if self.op["mode"] == "COMMAND" else []
        direct_mutations = self.build_direct_request_mutations(required) if self.op["mode"] == "COMMAND" else []
        # New explicit owner-reference fields may have been added while column
        # lineage was built; annotate them before request graph materialization.
        self.annotate_requests()
        response = self.build_response(old)
        event_rows = self.build_events() if self.op["mode"] == "COMMAND" else []
        receipt_contracts = []
        if self.op["mode"] == "COMMAND":
            spec = RECEIPTS[self.op["session"]]
            receipt_contracts = [{
                "receiptId": "receipt.owner", "table": spec["table"], "idColumn": spec["id"],
                "tenantColumn": "tenant_id", "idempotencyColumn": spec["idempotency"],
                "requestDigestColumn": spec["digest"], "callerColumn": spec["caller"],
            }]
        mutation_fields = list(direct_mutations)
        if self.op["mode"] == "COMMAND":
            state_column = state_column_for(self.tables[self.main]["spec"], self.operation_id)
            target = f"{self.main}.{state_column}"
            field = self.tables[self.main]["columns"][state_column]
            mutation_fields.append(self.source_row(
                target, field["sqlType"], self.transition_source("POST", field["sqlType"]),
                physical=True,
            ))
            version_target = f"{self.main}.aggregate_version"
            root_disposition = self.write_disposition(self.main)
            if root_disposition in {"INSERT", "APPEND", "APPEND_MANY"}:
                version_source = self.add_typed(
                    "root_initial_aggregate_version", "BIGINT", "VERSION_COUNTER", [],
                    "INITIALIZE_NEW_AGGREGATE_VERSION_AT_ONE", initialValue=1,
                )
            else:
                version_inputs = [version_target]
                if self.op.get("expectedVersion") == "REQUIRED":
                    version_inputs.append("headers.If-Match")
                version_source = self.add_typed(
                    "root_next_aggregate_version", "BIGINT", "VERSION_COUNTER", version_inputs,
                    "CAS_INCREMENT_LOCKED_AGGREGATE_VERSION_BY_ONE",
                    strategy="EXPECTED_VERSION_PLUS_ONE",
                )
            mutation_fields.append(self.source_row(
                version_target, "BIGINT", version_source, physical=True,
            ))
            # Every physical aggregate/ledger row touched by the command gets
            # an explicit version assignment.  The common DDL default is zero
            # only a storage fallback and must never leak into a committed
            # event or owner-refetch contract.
            for table_name in self.op.get("writesTables", []):
                if table_name == self.main:
                    continue
                target = f"{table_name}.aggregate_version"
                disposition = self.write_disposition(table_name)
                if disposition in {"INSERT", "APPEND", "APPEND_MANY"}:
                    source = self.add_typed(
                        "initial_aggregate_version_" + table_name, "BIGINT", "VERSION_COUNTER", [],
                        "INITIALIZE_NEW_WRITTEN_ROW_AGGREGATE_VERSION_AT_ONE", initialValue=1,
                    )
                else:
                    source = self.add_typed(
                        "next_aggregate_version_" + table_name, "BIGINT", "VERSION_COUNTER", [target],
                        "INCREMENT_LOCKED_WRITTEN_ROW_AGGREGATE_VERSION_BY_ONE",
                        strategy=("INSERT_ONE_OR_EXISTING_PLUS_ONE"
                                  if disposition == "UPSERT_CAS" else "LOCKED_VERSION_PLUS_ONE"),
                    )
                mutation_fields.append(self.source_row(target, "BIGINT", source, physical=True))
        lineage = {
            "operationId": self.operation_id,
            "mode": self.op["mode"],
            "inputMappings": self.build_input_mappings(),
            "typedSources": self.typed,
            "receiptContracts": receipt_contracts,
            "writeSet": [
                {"table": table_name, "disposition": self.write_disposition(table_name)}
                for table_name in self.op.get("writesTables", [])
            ],
            "mutationFieldSources": mutation_fields,
            "requiredColumnSources": required,
            "responseFieldSources": response,
            "eventFieldSources": event_rows,
            "mutationEvidence": {
                "stateTransitionIds": self.op.get("stateTransitionIds", []),
                "nonDigestDrivers": [
                    ref for ref, field in request_fields(self.op, self.schemas).items()
                    if field.get("required") and not ref.startswith("headers.")
                    and re.search(r"(?:digest|hash)", field["name"], re.I) is None
                ] if self.op["mode"] == "COMMAND" else [],
                "digestOnlyMutation": "FORBIDDEN" if self.op["mode"] == "COMMAND" else "NOT_APPLICABLE",
            },
        }
        return lineage, self.response_identities, self.event_identities


def clear_generated_identity(fields: list[dict[str, Any]]) -> None:
    for field in fields:
        field.pop("referenceContract", None)
        field.pop("referenceContractByOperation", None)


def set_schema_identity(fields: list[dict[str, Any]], name: str,
                        variants: dict[str, Identity]) -> None:
    field = next(item for item in fields if item["name"] == name)
    unique = set(variants.values())
    if len(unique) == 1:
        field["referenceContract"] = contract(next(iter(unique)))
    else:
        field["referenceContractByOperation"] = {
            operation_id: contract(identity) for operation_id, identity in sorted(variants.items())
        }


def normalize_non_uuid_owner_references(doc: dict[str, Any]) -> None:
    """Separate token/object handles from public UUID relationship contracts."""
    tables = {table["tableName"]: table for table in doc["tableSpecifications"]}
    for table_name, column_name in sorted(NON_UUID_OWNER_REFERENCES):
        table = tables[table_name]
        column = next(column for column in table["columns"] if column["name"] == column_name)
        if normalize_type(column["sqlType"]) in {"UUID", "UUID[]", "BIGINT"}:
            raise ValueError(f"non-UUID owner reference has identity-shaped type: {table_name}.{column_name}")
        matches = [
            fk for fk in table["foreignKeys"]
            if fk.get("mode") == "OPAQUE_CROSS_BOUNDARY_REFERENCE"
            and fk.get("columns") == [column_name]
        ]
        existing = [
            ref for ref in table.get("nonUuidOwnerReferences", [])
            if ref.get("columns") == [column_name]
        ]
        if len(matches) + len(existing) != 1:
            raise ValueError(f"non-UUID owner reference is not exact: {table_name}.{column_name}")
        if matches:
            fk = matches[0]
            table["foreignKeys"] = [candidate for candidate in table["foreignKeys"] if candidate is not fk]
            table.setdefault("nonUuidOwnerReferences", []).append({
                "referenceId": fk.get("constraintId"),
                "mode": "OPAQUE_TOKEN_OR_OBJECT_HANDLE",
                "columns": [column_name],
                "target": fk["target"],
                "identitySemantics": "NONE_NON_UUID",
                "validation": "tenant and purpose bound owner resolution; never interpreted as a public business UUID",
            })
        table["nonUuidOwnerReferences"] = sorted(
            table.get("nonUuidOwnerReferences", []), key=lambda ref: tuple(ref.get("columns", []))
        )


def normalize_operation_table_boundaries(doc: dict[str, Any]) -> None:
    """Remove stale direct reads across capability ownership boundaries."""
    capabilities = {table["tableName"]: table["capabilityId"] for table in doc["tableSpecifications"]}
    for operation in doc["operationBindings"]:
        capability = operation["capabilityId"]
        invalid_writes = [
            table for table in operation.get("writesTables", [])
            if capabilities.get(table) != capability
        ]
        if invalid_writes:
            raise ValueError(f"cross-capability writes are forbidden: {operation['operationId']} {invalid_writes}")
        operation["readsTables"] = [
            table for table in operation.get("readsTables", [])
            if capabilities.get(table) == capability
        ]


def normalize_opaque_reference_targets(doc: dict[str, Any]) -> None:
    """Replace legacy broad labels with exact, reviewable owner identities."""
    for table in doc["tableSpecifications"]:
        table_name = table["tableName"]
        for foreign_key in table.get("foreignKeys", []):
            if foreign_key.get("mode") != "OPAQUE_CROSS_BOUNDARY_REFERENCE":
                continue
            columns = foreign_key.get("columns", [])
            if len(columns) != 1:
                continue
            corrected = OPAQUE_TARGET_CORRECTIONS.get((table_name, columns[0]))
            if corrected:
                foreign_key["target"] = corrected


def materialize(doc: dict[str, Any], events: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    doc, events = copy.deepcopy(doc), copy.deepcopy(events)
    apply_exact_source_successor(doc, events)
    ensure_semantic_columns(doc)
    normalize_opaque_reference_targets(doc)
    normalize_event_field_types(events)
    normalize_non_uuid_owner_references(doc)
    normalize_operation_table_boundaries(doc)
    doc["fieldLineageScope"].pop("semanticContract", None)
    doc["fieldLineageScope"].pop("typedSourcePolicy", None)
    authored_request_value_objects = {
        "GrowthProfilePatch.v1", "CoachingNoteContent.v1",
        "ApprovedCompensationSnapshotLine.v1", "WorkforceDemandLine.v1",
    }
    for schema in doc["recordSchemas"] + doc["responseSchemas"]:
        if schema["schemaId"] not in authored_request_value_objects:
            clear_generated_identity(schema["fields"])
    # Request and event identities are reviewed fields of the operation-level
    # candidate SSOT.  They are not generator guesses and must survive lineage
    # projection; clearing them here previously forced a second heuristic pass
    # to reconstruct (and occasionally substitute) business identities.
    for table in doc["tableSpecifications"]:
        for column in table["columns"]:
            column.pop("referenceContract", None)
    old = {row["operationId"]: row for row in doc["operationFieldLineage"]}

    # Physical reference annotations are documentary; independent FK targets
    # remain the identity oracle used by the validator.
    tables_by_name = {table["tableName"]: table for table in doc["tableSpecifications"]}
    for (table_name, column_name), entity in PHYSICAL_COLUMN_ENTITIES.items():
        column = next(
            column for column in tables_by_name[table_name]["columns"]
            if column["name"] == column_name
        )
        column["referenceContract"] = contract(Identity(entity, "PUBLIC_UUID"))
    semantic = SemanticValidator(doc, events, load_base_tables())
    for table in doc["tableSpecifications"]:
        for column in table["columns"]:
            identity = semantic.physical_identity(table["tableName"], column["name"])
            if identity is not None and normalize_type(column["sqlType"]) in {"UUID", "UUID[]", "BIGINT"}:
                column["referenceContract"] = contract(identity)

    # Candidate materialization is driven by the explicit operation-level
    # successor, never by the module files it will later regenerate.  The
    # independent reviewer owns a separate immutable oracle/validator.
    exact_operations = {row["operationId"]: row for row in doc["operationBindings"]}
    transitions = {
        operation_id: {
            "transitionId": exact_operations[operation_id]["stateTransitionIds"][0],
            "from": "|".join(before), "to": "|".join(after),
        }
        for operation_id, (before, after, _source) in STATE.items()
    }
    creates = {operation_id for operation_id, (before, _after, _source) in STATE.items()
               if before == ("NONE",)}

    schemas = {schema["schemaId"]: schema for schema in doc["recordSchemas"] + doc["responseSchemas"]}
    event_schemas = {schema["eventName"]: schema for schema in events["eventPayloadSchemas"]}
    lineages = []
    response_variants: dict[tuple[str, str], dict[str, Identity]] = {}
    event_variants: dict[tuple[str, str], dict[str, Identity]] = {}
    # Rebuild semantic table view after physical annotations.
    semantic = SemanticValidator(doc, events, load_base_tables())
    for operation in doc["operationBindings"]:
        builder = OperationBuilder(doc, events, operation, semantic, schemas, event_schemas,
                                   creates, transitions)
        lineage, response_ids, event_ids = builder.build(old[operation["operationId"]])
        lineages.append(lineage)
        for key, identity in response_ids.items():
            response_variants.setdefault(key, {})[operation["operationId"]] = identity
        for key, identity in event_ids.items():
            event_variants.setdefault(key, {})[operation["operationId"]] = identity
    doc["operationFieldLineage"] = lineages

    # Every UUID business field must have an independent schema identity.  For
    # shared receipts/events this is exact per operation.
    response_users: dict[str, set[str]] = {}
    event_users: dict[str, set[str]] = {}

    def add_response_user(schema_id: str, operation_id: str, seen: set[str]) -> None:
        if schema_id in seen:
            return
        seen.add(schema_id)
        response_users.setdefault(schema_id, set()).add(operation_id)
        for field in schemas[schema_id]["fields"]:
            nested = field.get("itemSchemaRef") or field.get("schemaRef")
            if nested:
                add_response_user(nested, operation_id, seen)

    for operation in doc["operationBindings"]:
        add_response_user(operation["responseSchemaRef"], operation["operationId"], set())
        for event_name in operation["eventNames"]:
            event_users.setdefault(event_name, set()).add(operation["operationId"])
    for (schema_id, field_name), variants in response_variants.items():
        users = response_users[schema_id]
        if set(variants) != users:
            # Non-business users of a shared schema are impossible for the same
            # UUID field; fail generation rather than inventing an identity.
            missing = sorted(users - set(variants))
            raise ValueError(f"missing response identity variants {schema_id}.{field_name}: {missing}")
        set_schema_identity(schemas[schema_id]["fields"], field_name, variants)
    for (event_name, field_name), variants in event_variants.items():
        users = event_users[event_name]
        if set(variants) != users:
            raise ValueError(f"missing event identity variants {event_name}.{field_name}")
        set_schema_identity(event_schemas[event_name]["fields"], field_name, variants)

    return doc, events


def materialize_subset(doc: dict[str, Any], events: dict[str, Any], selected: set[str]) -> tuple[dict[str, Any], dict[str, Any]]:
    """Write a reviewable representative slice before whole-catalogue expansion."""
    doc, events = copy.deepcopy(doc), copy.deepcopy(events)
    operations = {row["operationId"]: row for row in doc["operationBindings"]}
    unknown = selected - operations.keys()
    if unknown:
        raise ValueError("unknown operation(s): " + ", ".join(sorted(unknown)))
    old = {row["operationId"]: row for row in doc["operationFieldLineage"]}
    schemas = {schema["schemaId"]: schema for schema in doc["recordSchemas"] + doc["responseSchemas"]}
    event_schemas = {schema["eventName"]: schema for schema in events["eventPayloadSchemas"]}
    semantic = SemanticValidator(doc, events, load_base_tables())
    replacements: dict[str, dict[str, Any]] = {}
    for operation_id in sorted(selected):
        operation = operations[operation_id]
        clear_generated_identity(operation["requestSchema"]["pathParameters"])
        clear_generated_identity(operation["requestSchema"]["queryParameters"])
        clear_generated_identity(operation["requestSchema"]["headers"])
        clear_generated_identity(operation["requestSchema"]["body"])
        response = schemas[operation["responseSchemaRef"]]
        clear_generated_identity(response["fields"])
        for field in response["fields"]:
            nested = field.get("itemSchemaRef") or field.get("schemaRef")
            if nested:
                clear_generated_identity(schemas[nested]["fields"])
        builder = OperationBuilder(doc, events, operation, semantic, schemas, event_schemas,
                                   set(), {})
        lineage, response_ids, _ = builder.build(old[operation_id])
        replacements[operation_id] = lineage
        for (schema_id, field_name), identity in response_ids.items():
            field = next(item for item in schemas[schema_id]["fields"] if item["name"] == field_name)
            field["referenceContract"] = contract(identity)
    doc["operationFieldLineage"] = [replacements.get(row["operationId"], row) for row in doc["operationFieldLineage"]]
    return doc, events


def render(value: dict[str, Any]) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2) + "\n"


def sealed_digest(value: dict[str, Any]) -> str:
    payload = {key: item for key, item in value.items() if key != "sealedPayloadSha256"}
    encoded = json.dumps(payload, ensure_ascii=False, sort_keys=True,
                         separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def registry_core_digest(value: dict[str, Any]) -> str:
    """Stable registry-side digest used for reciprocal, acyclic pinning.

    The canonical files pin this review core; registries separately pin the
    exact canonical bytes.  Excluding only those reciprocal/hash-envelope
    fields avoids an impossible circular full-file hash while still sealing all
    operation bindings or public identities.
    """
    payload = {
        key: item for key, item in value.items()
        if key not in {"sealedPayloadSha256", "canonicalContractPins"}
    }
    encoded = json.dumps(payload, ensure_ascii=False, sort_keys=True,
                         separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def canonical_contract_pins(doc: dict[str, Any], events: dict[str, Any]) -> dict[str, str]:
    """Hash the exact canonical JSON bytes emitted by this generator.

    The registries are independent review oracles, so each one pins both source
    contracts instead of trusting a same-run in-memory graph implicitly.
    """
    return {
        EXACT.name: hashlib.sha256(render(doc).encode("utf-8")).hexdigest(),
        EVENTS.name: hashlib.sha256(render(events).encode("utf-8")).hexdigest(),
    }


def binding_registry(doc: dict[str, Any], contract_pins: dict[str, str]) -> dict[str, Any]:
    operations = {row["operationId"]: row for row in doc["operationBindings"]}
    lineages = {row["operationId"]: row for row in doc["operationFieldLineage"]}
    if set(operations) != set(lineages):
        raise ValueError("cannot seal a non-closed operation lineage graph")
    schemas = {schema["schemaId"]: schema
               for schema in doc["recordSchemas"] + doc["responseSchemas"]}
    rows = [semantic_binding_view(operations[operation_id], lineages[operation_id], schemas)
            for operation_id in sorted(operations)]
    registry = {
        "registryId": "dwp.hris.modern.operation-semantic-bindings.v1",
        "schemaVersion": 1,
        "status": "SEALED_G3_DESIGN_NOT_IMPLEMENTED",
        "scope": {"operations": len(rows), "implementationState": "NOT_STARTED_G3",
                  "productionState": "NOT_AUTHORIZED_G6"},
        "canonicalContractPins": dict(sorted(contract_pins.items())),
        "operations": rows,
    }
    stamp_canonical_document(registry, "semanticBindings")
    registry["sealedPayloadSha256"] = sealed_digest(registry)
    return registry


def identity_registry(doc: dict[str, Any], events: dict[str, Any],
                      contract_pins: dict[str, str]) -> dict[str, Any]:
    schemas = {schema["schemaId"]: schema for schema in doc["recordSchemas"] + doc["responseSchemas"]}
    event_schemas = {schema["eventName"]: schema for schema in events["eventPayloadSchemas"]}
    semantic = SemanticValidator(doc, events, load_base_tables())
    physical: dict[str, dict[str, str]] = {}
    for table_name, table in semantic.tables.items():
        for column_name, field in table["columns"].items():
            identity = semantic.physical_identity(table_name, column_name)
            if (identity is not None and identity.id_space == "PUBLIC_UUID"
                    and normalize_type(field.get("sqlType", "")) in {"UUID", "UUID[]"}):
                physical[f"{table_name}.{column_name}"] = contract(identity)
    for lineage in doc["operationFieldLineage"]:
        for receipt in lineage.get("receiptContracts", []):
            physical[f"{receipt['table']}.{receipt['idColumn']}"] = contract(
                Identity("table:" + receipt["table"], "PUBLIC_UUID")
            )

    requests: dict[str, dict[str, dict[str, str]]] = {}
    responses: dict[str, dict[str, dict[str, str]]] = {}
    event_fields: dict[str, dict[str, dict[str, str]]] = {}

    def visit_schema(operation_id: str, schema_id: str, seen: set[str]) -> None:
        if schema_id in seen:
            return
        seen.add(schema_id)
        schema = schemas[schema_id]
        for field in schema["fields"]:
            if business_type(field):
                identity = declared_identity(field, operation_id)
                if identity is None:
                    raise ValueError(f"unsealed response identity: {operation_id} {schema_id}.{field['name']}")
                responses.setdefault(operation_id, {})[f"{schema_id}.{field['name']}"] = contract(identity)
            nested = field.get("itemSchemaRef") or field.get("schemaRef")
            if nested:
                visit_schema(operation_id, nested, seen)

    for operation in doc["operationBindings"]:
        operation_id = operation["operationId"]
        for ref, field in request_fields(operation, schemas).items():
            if business_type(field) and not ref.startswith("headers."):
                identity = declared_identity(field)
                if identity is None:
                    raise ValueError(f"unsealed request identity: {operation_id} {ref}")
                requests.setdefault(operation_id, {})[ref] = contract(identity)
        visit_schema(operation_id, operation["responseSchemaRef"], set())
        for event_name in operation["eventNames"]:
            for field in event_schemas[event_name]["fields"]:
                if business_type(field):
                    identity = declared_identity(field, operation_id)
                    if identity is None:
                        raise ValueError(f"unsealed event identity: {operation_id} {event_name}.{field['name']}")
                    event_fields.setdefault(operation_id, {})[
                        f"{event_name}.{field['name']}"
                    ] = contract(identity)
    registry = {
        "registryId": "dwp.hris.modern.public-identities.v1",
        "schemaVersion": 1,
        "status": "SEALED_G3_DESIGN_NOT_IMPLEMENTED",
        "scope": {"operations": len(doc["operationBindings"]),
                  "implementationState": "NOT_STARTED_G3",
                  "productionState": "NOT_AUTHORIZED_G6"},
        "canonicalContractPins": dict(sorted(contract_pins.items())),
        "physicalColumns": dict(sorted(physical.items())),
        "requestFieldsByOperation": {key: dict(sorted(value.items())) for key, value in sorted(requests.items())},
        "responseFieldsByOperation": {key: dict(sorted(value.items())) for key, value in sorted(responses.items())},
        "eventFieldsByOperation": {key: dict(sorted(value.items())) for key, value in sorted(event_fields.items())},
    }
    stamp_canonical_document(registry, "publicIdentities")
    registry["sealedPayloadSha256"] = sealed_digest(registry)
    return registry


def semantic_audit_counts(doc: dict[str, Any]) -> dict[str, int]:
    unregistered_request_fallbacks = 0
    generic_event_fallbacks = 0
    explicit_bindings = 0
    for lineage in doc["operationFieldLineage"]:
        explicit_bindings += sum(len(lineage.get(key, [])) for key in (
            "inputMappings", "mutationFieldSources", "requiredColumnSources",
            "responseFieldSources", "eventFieldSources"
        ))
        for row in lineage.get("requiredColumnSources", []):
            source = row.get("sourcePath", "")
            if not source.startswith(("pathParameters.", "body.")):
                continue
            column = row.get("target", ".").split(".", 1)[-1]
            # Nested typed request value objects are still explicit reviewed
            # bindings.  Compare the terminal member (and strip the ARRAY
            # marker) instead of treating the whole dotted path as a fallback.
            request_name = source.rsplit(".", 1)[-1].removeprefix("[]")
            accepted = {camel(column), *REQUEST_COLUMN_ALIASES.get(column, ())}
            if column == "cycle_public_id":
                accepted.add("cycleId")
            if column in BUSINESS_KEY_COLUMNS:
                accepted.add("businessKey")
            if request_name not in accepted:
                unregistered_request_fallbacks += 1
        for source in lineage.get("typedSources", []):
            if str(source.get("ruleId", "")).startswith(
                    "DERIVE_EVENT_FIELD_FROM_POST_TRANSITION_OWNER_SNAPSHOT"):
                generic_event_fallbacks += 1
    return {
        "unregisteredRequestFallbacks": unregistered_request_fallbacks,
        "genericEventFallbacks": generic_event_fallbacks,
        "explicitBindings": explicit_bindings,
    }


def validate_successor_canonical(
    canonical_dir: pathlib.Path,
    *,
    source_exact_path: pathlib.Path,
    source_events_path: pathlib.Path,
    write: bool,
) -> int:
    """Validate the registry-enriched successor as one explicit byte set.

    This is intentionally separate from the historical 100-operation
    materializer below.  The successor registries are composed by the
    canonical-five generator; replaying the legacy heuristic materializer
    would both re-open reviewed decisions and couple validation to live files.
    """
    from generate_modern_exact_event_successor import validate as validate_exact_event
    from generate_modern_semantic_identity_successor import (
        compose_all as compose_semantic_identity,
        render as render_successor,
        validate as validate_semantic_identity,
    )

    paths = {
        "manifest": canonical_dir / MANIFEST.name,
        "ssot": canonical_dir / SSOT.name,
        "exact": canonical_dir / EXACT.name,
        "events": canonical_dir / EVENTS.name,
        "semantic": canonical_dir / BINDINGS.name,
        "identities": canonical_dir / IDENTITIES.name,
    }
    for role, path in paths.items():
        if not path.is_file():
            raise ValueError(f"successor canonical {role} input missing: {path}")
    for role, path in (
        ("source exact", source_exact_path),
        ("source events", source_events_path),
    ):
        if not path.is_file():
            raise ValueError(f"successor {role} input missing: {path}")

    manifest = json.loads(paths["manifest"].read_text(encoding="utf-8"))
    ssot_bytes = paths["ssot"].read_bytes()
    ssot = json.loads(ssot_bytes)
    exact = json.loads(paths["exact"].read_text(encoding="utf-8"))
    events = json.loads(paths["events"].read_text(encoding="utf-8"))
    semantic = json.loads(paths["semantic"].read_text(encoding="utf-8"))
    identities = json.loads(paths["identities"].read_text(encoding="utf-8"))
    source_exact = json.loads(source_exact_path.read_text(encoding="utf-8"))
    source_events = json.loads(source_events_path.read_text(encoding="utf-8"))

    validate_exact_event(
        exact, events, manifest,
        source_ssot=ssot,
        source_exact=source_exact,
        source_events=source_events,
        semantic=semantic,
        identities=identities,
    )
    expected = compose_semantic_identity(
        exact, events, ssot, hashlib.sha256(ssot_bytes).hexdigest(), manifest,
    )
    validate_semantic_identity(*expected, manifest)
    current = (exact, events, semantic, identities)
    mismatches = [
        path.name for path, observed, projected in zip(
            (paths["exact"], paths["events"], paths["semantic"], paths["identities"]),
            current, expected,
        )
        if render_successor(observed) != render_successor(projected)
    ]
    if mismatches and not write:
        raise ValueError(
            "successor semantic/identity fixed-point mismatch: "
            + ", ".join(mismatches)
        )
    if write:
        if canonical_dir != HERE:
            raise ValueError("candidate validation never writes candidate canonical bytes")
        for path, value in zip(
            (EXACT, EVENTS, BINDINGS, IDENTITIES), expected,
        ):
            path.write_text(render_successor(value), encoding="utf-8")

    exact_successor = expected[0]
    explicit_bindings = 0
    unregistered_request_fallbacks = 0
    generic_event_fallbacks = 0
    forbidden_source_markers = {
        "TYPE_ONLY_REQUEST_FALLBACK", "SUBSTRING_REQUEST_FALLBACK",
        "GENERIC_EVENT_SOURCE_FALLBACK", "DERIVE_EVENT_FIELD_FROM_POST_TRANSITION_OWNER_SNAPSHOT",
    }
    for lineage in exact_successor["operationFieldLineage"]:
        explicit_bindings += sum(len(lineage.get(key, [])) for key in (
            "inputMappings", "mutationFieldSources", "requiredColumnSources",
            "responseFieldSources", "eventFieldSources",
        ))
        mutation_rows = {
            (row["target"], row.get("sourcePath"), row.get("sourceKind"))
            for row in lineage.get("mutationFieldSources", [])
        }
        for row in lineage.get("requiredColumnSources", []):
            if (
                row["target"], row.get("sourcePath"), row.get("sourceKind")
            ) not in mutation_rows:
                unregistered_request_fallbacks += 1
        for collection in (
            "inputMappings", "mutationFieldSources", "requiredColumnSources",
            "responseFieldSources", "eventFieldSources", "typedSources",
        ):
            for row in lineage.get(collection, []):
                encoded = json.dumps(row, sort_keys=True)
                if any(marker in encoded for marker in forbidden_source_markers):
                    if collection == "eventFieldSources" or "EVENT" in encoded:
                        generic_event_fallbacks += 1
                    else:
                        unregistered_request_fallbacks += 1
    audit = {
        "unregisteredRequestFallbacks": unregistered_request_fallbacks,
        "genericEventFallbacks": generic_event_fallbacks,
        "explicitBindings": explicit_bindings,
    }
    if audit["unregisteredRequestFallbacks"] or audit["genericEventFallbacks"]:
        raise ValueError(
            "successor semantic fallback audit failed: "
            + json.dumps(audit, sort_keys=True)
        )
    print(
        "MODERN_SEMANTIC_LINEAGE_GENERATOR_CHECK=PASS"
        f" typeFallbacks={audit['unregisteredRequestFallbacks']}"
        f" eventFallbacks={audit['genericEventFallbacks']}"
        f" explicitBindings={audit['explicitBindings']}"
        f" operations={len(expected[0]['operationBindings'])}"
        f" events={len(expected[1]['eventPayloadSchemas'])}"
        f" tables={len(expected[0]['tableSpecifications'])}"
        " mode=SUCCESSOR_CANONICAL_FIXED_POINT"
    )
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--operation", action="append", default=[])
    parser.add_argument("--bootstrap-registries", action="store_true")
    parser.add_argument("--reseal-registries", action="store_true")
    parser.add_argument("--candidate-dir", type=pathlib.Path)
    parser.add_argument("--source-exact", type=pathlib.Path)
    parser.add_argument("--source-events", type=pathlib.Path)
    args = parser.parse_args()
    if args.write == args.check:
        parser.error("choose exactly one of --write or --check")
    canonical_dir = args.candidate_dir or HERE
    exact_path = canonical_dir / EXACT.name
    events_path = canonical_dir / EVENTS.name
    before_doc = json.loads(exact_path.read_text(encoding="utf-8"))
    before_events = json.loads(events_path.read_text(encoding="utf-8"))
    successor_mode = args.candidate_dir is not None or len(
        before_doc.get("operationBindings", [])
    ) != 100
    if successor_mode:
        if args.operation or args.bootstrap_registries or args.reseal_registries:
            parser.error(
                "successor canonical validation forbids legacy operation filters "
                "and registry bootstrap/reseal flags"
            )
        if args.candidate_dir and args.write:
            parser.error("--candidate-dir is validation-only and requires --check")
        return validate_successor_canonical(
            canonical_dir,
            source_exact_path=args.source_exact or (EXACT if args.candidate_dir else exact_path),
            source_events_path=args.source_events or (EVENTS if args.candidate_dir else events_path),
            write=args.write,
        )
    after_doc, after_events = (
        materialize_subset(before_doc, before_events, set(args.operation))
        if args.operation else materialize(before_doc, before_events)
    )
    # Listening is composed into the canonical files before the derived SYS
    # summary is allowed to read or pin them.  This stamp is sourced only from
    # shared static design and never reads the generated summary artifact.
    stamp_canonical_document(after_doc, "exactSchemas")
    stamp_canonical_document(after_events, "eventPayloads")
    after_doc["semanticBindingRegistry"] = {
        "registryId": "dwp.hris.modern.operation-semantic-bindings.v1",
        "schemaVersion": 1, "path": BINDINGS.name, "status": "SEALED_G3_DESIGN_NOT_IMPLEMENTED",
    }
    after_doc["publicIdentityRegistry"] = {
        "registryId": "dwp.hris.modern.public-identities.v1",
        "schemaVersion": 1, "path": IDENTITIES.name, "status": "SEALED_G3_DESIGN_NOT_IMPLEMENTED",
    }
    provisional_bindings = binding_registry(after_doc, {})
    provisional_identities = identity_registry(after_doc, after_events, {})
    reciprocal_pins = {
        BINDINGS.name: registry_core_digest(provisional_bindings),
        IDENTITIES.name: registry_core_digest(provisional_identities),
    }
    after_doc["independentRegistryCorePins"] = dict(sorted(reciprocal_pins.items()))
    after_events["independentRegistryCorePins"] = dict(sorted(reciprocal_pins.items()))
    contract_pins = canonical_contract_pins(after_doc, after_events)
    expected_bindings = binding_registry(after_doc, contract_pins)
    expected_identities = identity_registry(after_doc, after_events, contract_pins)
    audit = semantic_audit_counts(after_doc)
    if audit["unregisteredRequestFallbacks"] or audit["genericEventFallbacks"]:
        raise ValueError("semantic fallback audit failed: " + json.dumps(audit, sort_keys=True))
    for registry in (expected_bindings, expected_identities):
        registry_id = registry["registryId"]
        if registry["sealedPayloadSha256"] != SEALED_REGISTRY_PAYLOAD_PINS.get(registry_id):
            raise ValueError(
                f"generated registry differs from code-reviewed seal: {registry_id}; review and update pin"
            )
    if args.write:
        if args.bootstrap_registries and args.reseal_registries:
            raise ValueError("choose bootstrap or explicit reseal, not both")
        if args.bootstrap_registries:
            if BINDINGS.exists() or IDENTITIES.exists():
                raise ValueError("bootstrap refuses to overwrite an existing sealed registry")
            BINDINGS.write_text(render(expected_bindings), encoding="utf-8")
            IDENTITIES.write_text(render(expected_identities), encoding="utf-8")
        elif args.reseal_registries:
            if not BINDINGS.exists() or not IDENTITIES.exists():
                raise ValueError("reseal requires both existing registries")
            BINDINGS.write_text(render(expected_bindings), encoding="utf-8")
            IDENTITIES.write_text(render(expected_identities), encoding="utf-8")
        elif not BINDINGS.exists() or not IDENTITIES.exists():
            raise ValueError("sealed registries are missing; use one-time --bootstrap-registries")
        else:
            current_bindings = json.loads(BINDINGS.read_text(encoding="utf-8"))
            current_identities = json.loads(IDENTITIES.read_text(encoding="utf-8"))
            if current_bindings != expected_bindings or current_identities != expected_identities:
                raise ValueError("generated graph differs from sealed registries; explicit review/reseal required")
        EXACT.write_text(render(after_doc), encoding="utf-8")
        EVENTS.write_text(render(after_events), encoding="utf-8")
        print(f"MODERN_SEMANTIC_LINEAGE_GENERATE=PASS operations={len(after_doc['operationBindings'])} "
              f"typedSources={sum(len(row.get('typedSources', [])) for row in after_doc['operationFieldLineage'])} "
              f"typeFallbacks={audit['unregisteredRequestFallbacks']} "
              f"eventFallbacks={audit['genericEventFallbacks']} explicitBindings={audit['explicitBindings']}")
        return 0
    current_doc, current_events = render(before_doc), render(before_events)
    expected_doc, expected_events = render(after_doc), render(after_events)
    current_bindings = json.loads(BINDINGS.read_text(encoding="utf-8")) if BINDINGS.exists() else None
    current_identities = json.loads(IDENTITIES.read_text(encoding="utf-8")) if IDENTITIES.exists() else None
    ok = (current_doc == expected_doc and current_events == expected_events
          and current_bindings == expected_bindings and current_identities == expected_identities)
    print("MODERN_SEMANTIC_LINEAGE_GENERATOR_CHECK=" + ("PASS" if ok else "FAIL")
          + f" typeFallbacks={audit['unregisteredRequestFallbacks']}"
          + f" eventFallbacks={audit['genericEventFallbacks']}"
          + f" explicitBindings={audit['explicitBindings']}")
    return 0 if ok else 1


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
