#!/usr/bin/env python3
"""Authoritative causal/state normalization for the modern HRIS G3 design.

The first modern contract revision proved field shape and type closure, but it
allowed a capability-wide state machine/event name to be reused by unrelated
aggregates.  This module is the deliberately boring source of truth used by
both generators and validators: one command, one aggregate root, one physical
post-state sink, and one past-tense business fact.  It remains design-only;
nothing here claims G3 implementation or G6 production activation.
"""

from __future__ import annotations

import copy
import re
from typing import Any


COMMAND_WRITES: dict[str, list[str]] = {
    "modern.recruiting.requisition.create": ["ppl_rec_requisitions"],
    "modern.recruiting.requisition.publish": ["ppl_rec_requisitions"],
    "modern.recruiting.candidate.stage": ["ppl_rec_candidate_cases"],
    "modern.recruiting.offer.issue": ["ppl_rec_candidate_cases", "ppl_rec_offers"],
    "modern.recruiting.hire.record": ["ppl_rec_candidate_cases", "ppl_rec_hire_requests"],
    "modern.onboarding.template.create": ["ppl_jny_templates", "ppl_jny_template_versions"],
    "modern.onboarding.template.publish": ["ppl_jny_template_versions"],
    "modern.onboarding.journey.assign": ["ppl_jny_assignments", "ppl_jny_assignment_tasks"],
    "modern.onboarding.task.complete": ["ppl_jny_task_evidence", "ppl_jny_assignment_tasks", "ppl_jny_assignments"],
    "modern.onboarding.journey.cancel": ["ppl_jny_assignments"],
    "modern.workforceplan.scenario.create": ["ppl_wfp_scenarios", "ppl_wfp_scenario_revisions"],
    "modern.workforceplan.scenario.simulate": ["ppl_wfp_scenarios", "ppl_wfp_scenario_revisions"],
    "modern.workforceplan.scenario.submit": ["ppl_wfp_scenarios", "ppl_wfp_scenario_revisions"],
    "modern.workforceplan.scenario.approve": ["ppl_wfp_scenarios", "ppl_wfp_scenario_revisions"],
    "modern.workforceplan.scenario.publish": ["ppl_wfp_scenarios", "ppl_wfp_scenario_revisions", "ppl_wfp_publish_receipts"],
    "modern.benefits.plan.create": ["ppl_bnf_plans", "ppl_bnf_plan_versions"],
    "modern.benefits.plan.publish": ["ppl_bnf_plan_versions"],
    "modern.benefits.enrollment.submit": ["ppl_bnf_enrollments"],
    "modern.benefits.lifeevent.submit": ["ppl_bnf_life_events"],
    "modern.benefits.enrollment.decide": ["ppl_bnf_enrollments"],
    "modern.hrservice.case.create": ["ppl_hrs_cases", "ppl_hrs_case_actions"],
    "modern.hrservice.case.triage": ["ppl_hrs_cases", "ppl_hrs_case_actions"],
    "modern.hrservice.case.assign": ["ppl_hrs_cases", "ppl_hrs_case_actions"],
    "modern.hrservice.case.respond": ["ppl_hrs_cases", "ppl_hrs_case_actions"],
    "modern.hrservice.case.resolve": ["ppl_hrs_cases", "ppl_hrs_case_actions"],
    "modern.contingent.engagement.create": ["ppl_cwk_engagements"],
    "modern.contingent.engagement.submit": ["ppl_cwk_engagements"],
    "modern.contingent.engagement.activate": ["ppl_cwk_engagements"],
    "modern.contingent.engagement.offboard": ["ppl_cwk_engagements"],
    "modern.contingent.engagement.close": ["ppl_cwk_engagements"],
    "modern.skills.taxonomy.create": ["prf_skl_taxonomies", "prf_skl_taxonomy_versions"],
    "modern.skills.taxonomy.validate": ["prf_skl_taxonomies", "prf_skl_taxonomy_versions"],
    "modern.skills.taxonomy.publish": ["prf_skl_taxonomies", "prf_skl_taxonomy_versions"],
    "modern.skills.evidence.verify": ["prf_skl_worker_evidence"],
    "modern.growth.profile.create": ["prf_grw_profiles", "prf_grw_aspirations"],
    "modern.growth.profile.update": ["prf_grw_profile_revisions", "prf_grw_profiles"],
    "modern.growth.evidence.link": ["prf_grw_profiles", "prf_grw_evidence_links"],
    "modern.growth.coaching.record": ["prf_grw_profiles", "prf_grw_coaching_notes"],
    "modern.growth.profile.archive": ["prf_grw_profiles"],
    "modern.learning.offering.create": ["prf_lrn_offerings"],
    "modern.learning.offering.publish": ["prf_lrn_offerings"],
    "modern.learning.self.enroll": ["prf_lrn_assignments"],
    "modern.learning.assignment.start": ["prf_lrn_assignments"],
    "modern.learning.completion.verify": ["prf_lrn_assignments", "prf_lrn_completion_evidence"],
    "modern.opportunity.create": ["prf_mkt_opportunities"],
    "modern.opportunity.publish": ["prf_mkt_opportunities"],
    "modern.opportunity.apply": ["prf_mkt_applications"],
    "modern.opportunity.shortlist": ["prf_mkt_applications", "prf_mkt_match_explanations"],
    "modern.opportunity.selection.record": ["prf_mkt_applications"],
    "modern.succession.plan.create": ["prf_suc_plans"],
    "modern.succession.nomination.add": ["prf_suc_plans", "prf_suc_nominations"],
    "modern.succession.plan.submit": ["prf_suc_plans"],
    "modern.succession.plan.approve": ["prf_suc_plans"],
    "modern.succession.plan.publish": ["prf_suc_plans"],
    "modern.compplan.cycle.create": ["prf_cmp_cycles"],
    "modern.compplan.budget.allocate": ["prf_cmp_cycles", "prf_cmp_budget_ledger"],
    "modern.compplan.proposal.submit": ["prf_cmp_proposals"],
    "modern.compplan.plan.approve": ["prf_cmp_cycles", "prf_cmp_plans"],
    "modern.compplan.snapshot.publish": ["prf_cmp_cycles", "prf_cmp_approved_snapshots", "prf_cmp_approved_snapshot_lines"],
    "modern.wfm.forecast.create": ["tme_wfm_forecast_revision_counters", "tme_wfm_demand_forecasts", "tme_wfm_demand_lines"],
    "modern.wfm.schedule.optimize": ["tme_wfm_optimization_requests"],
    "modern.wfm.schedule.validate": ["tme_wfm_schedule_candidates", "tme_wfm_constraint_evaluation_receipts", "tme_wfm_constraint_violation_lines", "tme_wfm_fairness_measure_values"],
    "modern.wfm.schedule.submit": ["tme_wfm_schedule_candidates", "tme_wfm_approval_requests"],
    "modern.wfm.schedule.publish": ["tme_wfm_schedule_candidates", "tme_wfm_schedule_publish_ledger"],
    "modern.listening.response.submit": ["sys_hris_listening_responses"],
    "modern.listening.survey.create": ["sys_hris_listening_surveys"],
    "modern.listening.survey.publish": ["sys_hris_listening_surveys"],
    "modern.listening.survey.close": ["sys_hris_listening_surveys"],
    "modern.listening.action.create": ["sys_hris_listening_actions"],
    "modern.listening.action.complete": ["sys_hris_listening_actions"],
    "modern.analytics.metric.create": ["sys_hris_metric_definitions", "sys_hris_metric_versions", "sys_hris_metric_projections"],
    "modern.analytics.metric.validate": ["sys_hris_metric_definitions", "sys_hris_metric_versions"],
    "modern.analytics.metric.publish": ["sys_hris_metric_definitions", "sys_hris_metric_versions", "sys_hris_metric_projections"],
    "modern.analytics.export.create": ["sys_hris_analytics_export_receipts"],
    # Retire is version-less at the public boundary and therefore retires the
    # metric definition root.  It must not silently select/mutate whichever
    # version happens to be current.
    "modern.analytics.metric.retire": ["sys_hris_metric_definitions"],
    "modern.ai.assist.create": ["sys_hris_ai_provenance_receipts"],
    "modern.ai.policy.create": ["sys_hris_ai_use_policies", "sys_hris_ai_policy_versions"],
    "modern.ai.policy.evaluate": ["sys_hris_ai_evaluation_requests"],
    "modern.ai.policy.publish": ["sys_hris_ai_use_policies", "sys_hris_ai_policy_versions"],
    "modern.ai.kill.switch": ["sys_hris_ai_use_policies"],
    "modern.ai.policy.retire": ["sys_hris_ai_use_policies", "sys_hris_ai_policy_versions"],
}


# Aggregate identity is an operation-level decision and is deliberately
# independent of DML ordering.  Parent identity rows often must be inserted
# before a version/task root, while the version/task row owns lifecycle CAS.
AGGREGATE_ROOT_OVERRIDES: dict[str, str] = {
    "modern.onboarding.template.create": "ppl_jny_template_versions",
    "modern.onboarding.template.publish": "ppl_jny_template_versions",
    "modern.onboarding.task.complete": "ppl_jny_assignment_tasks",
    "modern.benefits.plan.create": "ppl_bnf_plan_versions",
    "modern.benefits.plan.publish": "ppl_bnf_plan_versions",
    "modern.skills.taxonomy.create": "prf_skl_taxonomy_versions",
    "modern.skills.taxonomy.validate": "prf_skl_taxonomy_versions",
    "modern.skills.taxonomy.publish": "prf_skl_taxonomy_versions",
    "modern.growth.profile.update": "prf_grw_profiles",
    "modern.analytics.metric.create": "sys_hris_metric_versions",
    "modern.analytics.metric.validate": "sys_hris_metric_versions",
    "modern.analytics.metric.publish": "sys_hris_metric_versions",
    "modern.wfm.forecast.create": "tme_wfm_demand_forecasts",
}


def aggregate_root_for(operation_id: str) -> str:
    if operation_id not in COMMAND_WRITES:
        raise KeyError(f"unknown command aggregate root: {operation_id}")
    root = AGGREGATE_ROOT_OVERRIDES.get(operation_id, COMMAND_WRITES[operation_id][0])
    if root not in COMMAND_WRITES[operation_id]:
        raise ValueError(f"aggregate root is not in operation write set: {operation_id} {root}")
    return root


# Explicit roots and state outcomes are intentionally not inferred from event
# names. Multiple outcomes are finite CHECK-compatible sets, never an alias
# such as SCREENING_OR_INTERVIEW that cannot be persisted.
STATE: dict[str, tuple[tuple[str, ...], tuple[str, ...], str]] = {
    "modern.recruiting.requisition.create": (("NONE",), ("DRAFT",), "CONSTANT"),
    "modern.recruiting.requisition.publish": (("DRAFT",), ("OPEN",), "CONSTANT"),
    "modern.recruiting.candidate.stage": (("APPLIED", "SCREENING", "INTERVIEW"), ("SCREENING", "INTERVIEW", "REJECTED", "CLOSED"), "body.targetStage"),
    "modern.recruiting.offer.issue": (("INTERVIEW",), ("OFFERED",), "CONSTANT"),
    "modern.recruiting.hire.record": (("OFFERED",), ("HIRE_PENDING",), "CONSTANT"),
    "modern.onboarding.template.create": (("NONE",), ("DRAFT",), "CONSTANT"),
    "modern.onboarding.template.publish": (("DRAFT",), ("PUBLISHED",), "CONSTANT"),
    "modern.onboarding.journey.assign": (("NONE",), ("ASSIGNED",), "CONSTANT"),
    "modern.onboarding.task.complete": (("PENDING",), ("COMPLETED",), "CONSTANT"),
    "modern.onboarding.journey.cancel": (("ASSIGNED", "IN_PROGRESS"), ("CANCELLED",), "CONSTANT"),
    "modern.workforceplan.scenario.create": (("NONE",), ("DRAFT",), "CONSTANT"),
    "modern.workforceplan.scenario.simulate": (("DRAFT", "SIMULATED"), ("SIMULATED",), "CONSTANT"),
    "modern.workforceplan.scenario.submit": (("SIMULATED",), ("PENDING_APPROVAL",), "CONSTANT"),
    "modern.workforceplan.scenario.approve": (("PENDING_APPROVAL",), ("APPROVED", "REJECTED"), "body.decision"),
    "modern.workforceplan.scenario.publish": (("APPROVED",), ("PUBLISHED",), "CONSTANT"),
    "modern.benefits.plan.create": (("NONE",), ("DRAFT",), "CONSTANT"),
    "modern.benefits.plan.publish": (("DRAFT",), ("PUBLISHED",), "CONSTANT"),
    "modern.benefits.enrollment.submit": (("NONE",), ("SUBMITTED",), "CONSTANT"),
    "modern.benefits.lifeevent.submit": (("NONE",), ("PENDING",), "CONSTANT"),
    "modern.benefits.enrollment.decide": (("SUBMITTED",), ("ACTIVE", "REJECTED"), "body.decision"),
    "modern.hrservice.case.create": (("NONE",), ("OPEN",), "CONSTANT"),
    "modern.hrservice.case.triage": (("OPEN",), ("TRIAGED",), "CONSTANT"),
    "modern.hrservice.case.assign": (("TRIAGED",), ("IN_PROGRESS",), "CONSTANT"),
    "modern.hrservice.case.respond": (("OPEN", "TRIAGED", "IN_PROGRESS", "WAITING"), ("IN_PROGRESS", "WAITING"), "OWNER_RESPONSE_DISPOSITION"),
    "modern.hrservice.case.resolve": (("IN_PROGRESS", "WAITING"), ("RESOLVED",), "CONSTANT"),
    "modern.contingent.engagement.create": (("NONE",), ("DRAFT",), "CONSTANT"),
    "modern.contingent.engagement.submit": (("DRAFT",), ("PENDING_APPROVAL",), "CONSTANT"),
    "modern.contingent.engagement.activate": (("PENDING_APPROVAL",), ("ACTIVE",), "CONSTANT"),
    "modern.contingent.engagement.offboard": (("ACTIVE",), ("OFFBOARDING",), "CONSTANT"),
    "modern.contingent.engagement.close": (("OFFBOARDING",), ("ENDED",), "CONSTANT"),
    "modern.skills.taxonomy.create": (("NONE",), ("DRAFT",), "CONSTANT"),
    "modern.skills.taxonomy.validate": (("DRAFT",), ("VALIDATED",), "CONSTANT"),
    "modern.skills.taxonomy.publish": (("VALIDATED",), ("PUBLISHED",), "CONSTANT"),
    "modern.skills.evidence.verify": (("PENDING",), ("VERIFIED",), "CONSTANT"),
    "modern.growth.profile.create": (("NONE",), ("DRAFT",), "CONSTANT"),
    "modern.growth.profile.update": (("DRAFT", "ACTIVE"), ("ACTIVE",), "CONSTANT"),
    "modern.growth.evidence.link": (("DRAFT", "ACTIVE"), ("ACTIVE",), "CONSTANT"),
    "modern.growth.coaching.record": (("ACTIVE",), ("ACTIVE",), "CONSTANT"),
    "modern.growth.profile.archive": (("DRAFT", "ACTIVE"), ("ARCHIVED",), "CONSTANT"),
    "modern.learning.offering.create": (("NONE",), ("DRAFT",), "CONSTANT"),
    "modern.learning.offering.publish": (("DRAFT",), ("PUBLISHED",), "CONSTANT"),
    "modern.learning.self.enroll": (("NONE",), ("ENROLLED",), "CONSTANT"),
    "modern.learning.assignment.start": (("ENROLLED",), ("IN_PROGRESS",), "CONSTANT"),
    "modern.learning.completion.verify": (("IN_PROGRESS",), ("COMPLETED",), "CONSTANT"),
    "modern.opportunity.create": (("NONE",), ("DRAFT",), "CONSTANT"),
    "modern.opportunity.publish": (("DRAFT",), ("OPEN",), "CONSTANT"),
    "modern.opportunity.apply": (("NONE",), ("APPLIED",), "CONSTANT"),
    "modern.opportunity.shortlist": (("APPLIED",), ("SHORTLISTED",), "CONSTANT"),
    "modern.opportunity.selection.record": (("APPLIED", "SHORTLISTED"), ("SELECTED", "NOT_SELECTED"), "body.decision"),
    "modern.succession.plan.create": (("NONE",), ("DRAFT",), "CONSTANT"),
    "modern.succession.nomination.add": (("DRAFT",), ("DRAFT",), "CONSTANT"),
    "modern.succession.plan.submit": (("DRAFT",), ("PENDING_APPROVAL",), "CONSTANT"),
    "modern.succession.plan.approve": (("PENDING_APPROVAL",), ("APPROVED",), "CONSTANT"),
    "modern.succession.plan.publish": (("APPROVED",), ("PUBLISHED",), "CONSTANT"),
    "modern.compplan.cycle.create": (("NONE",), ("DRAFT",), "CONSTANT"),
    "modern.compplan.budget.allocate": (("DRAFT", "OPEN"), ("OPEN",), "CONSTANT"),
    "modern.compplan.proposal.submit": (("DRAFT",), ("SUBMITTED",), "CONSTANT"),
    "modern.compplan.plan.approve": (("OPEN", "PROPOSAL_REVIEW"), ("APPROVED",), "CONSTANT"),
    "modern.compplan.snapshot.publish": (("APPROVED",), ("PUBLISHED",), "CONSTANT"),
    "modern.wfm.forecast.create": (("NONE",), ("DRAFT",), "CONSTANT"),
    "modern.wfm.schedule.optimize": (("NONE",), ("REQUESTED",), "CONSTANT"),
    "modern.wfm.schedule.validate": (("CANDIDATE_GENERATED",), ("VALIDATED", "REJECTED"), "OWNER_CONSTRAINT_EVALUATION"),
    "modern.wfm.schedule.submit": (("VALIDATED",), ("PENDING_APPROVAL",), "CONSTANT"),
    "modern.wfm.schedule.publish": (("PENDING_APPROVAL",), ("PUBLISHED",), "CONSTANT"),
    "modern.listening.response.submit": (("NONE",), ("SUBMITTED",), "CONSTANT"),
    "modern.listening.survey.create": (("NONE",), ("DRAFT",), "CONSTANT"),
    "modern.listening.survey.publish": (("DRAFT",), ("PUBLISHED",), "CONSTANT"),
    "modern.listening.survey.close": (("PUBLISHED",), ("CLOSED",), "CONSTANT"),
    "modern.listening.action.create": (("NONE",), ("OPEN",), "CONSTANT"),
    "modern.listening.action.complete": (("OPEN", "IN_PROGRESS"), ("COMPLETED",), "CONSTANT"),
    "modern.analytics.metric.create": (("NONE",), ("DRAFT",), "CONSTANT"),
    "modern.analytics.metric.validate": (("DRAFT",), ("VALIDATED",), "CONSTANT"),
    "modern.analytics.metric.publish": (("VALIDATED",), ("PUBLISHED",), "CONSTANT"),
    "modern.analytics.export.create": (("NONE",), ("REQUESTED",), "CONSTANT"),
    "modern.analytics.metric.retire": (("PUBLISHED",), ("RETIRED",), "CONSTANT"),
    "modern.ai.assist.create": (("NONE",), ("PRODUCED",), "CONSTANT"),
    "modern.ai.policy.create": (("NONE",), ("DRAFT",), "CONSTANT"),
    "modern.ai.policy.evaluate": (("NONE",), ("REQUESTED",), "CONSTANT"),
    "modern.ai.policy.publish": (("EVALUATED",), ("ACTIVE",), "CONSTANT"),
    "modern.ai.kill.switch": (("ACTIVE",), ("SUSPENDED",), "CONSTANT"),
    "modern.ai.policy.retire": (("DRAFT", "EVALUATED", "ACTIVE", "SUSPENDED"), ("RETIRED",), "CONSTANT"),
}


READ_OVERRIDES: dict[str, list[str]] = {
    "modern.recruiting.requisition.create": [],
    "modern.recruiting.requisition.publish": [],
    "modern.onboarding.template.create": [],
    "modern.onboarding.template.publish": ["ppl_jny_templates", "ppl_jny_template_versions"],
    "modern.benefits.plan.create": [],
    "modern.benefits.plan.publish": ["ppl_bnf_plans", "ppl_bnf_plan_versions"],
    "modern.learning.offering.create": [],
    "modern.learning.offering.publish": [],
    "modern.learning.self.enroll": ["prf_lrn_offerings"],
    "modern.learning.completion.verify": ["prf_lrn_offerings"],
    "modern.opportunity.create": [],
    "modern.opportunity.publish": [],
    "modern.opportunity.apply": ["prf_mkt_opportunities"],
    "modern.opportunity.shortlist": ["prf_mkt_applications", "prf_mkt_opportunities"],
    "modern.opportunity.selection.record": ["prf_mkt_applications", "prf_mkt_opportunities"],
    "modern.compplan.proposal.submit": ["prf_cmp_proposals", "prf_cmp_cycles"],
    "modern.compplan.plan.approve": ["prf_cmp_proposals", "prf_cmp_budget_ledger"],
    "modern.compplan.snapshot.publish": ["prf_cmp_cycles", "prf_cmp_plans", "prf_cmp_proposals"],
    "modern.wfm.forecast.create": [],
    "modern.wfm.schedule.optimize": ["tme_wfm_demand_forecasts"],
    "modern.wfm.schedule.validate": ["tme_wfm_schedule_candidates"],
    "modern.wfm.schedule.submit": ["tme_wfm_schedule_candidates"],
    "modern.wfm.schedule.publish": ["tme_wfm_schedule_candidates"],
    "modern.listening.response.submit": ["sys_hris_listening_surveys"],
    "modern.listening.action.create": ["sys_hris_listening_surveys"],
    "modern.listening.action.complete": ["sys_hris_listening_actions"],
    "modern.analytics.export.create": ["sys_hris_metric_definitions", "sys_hris_metric_versions", "sys_hris_metric_projections"],
    "modern.ai.policy.evaluate": ["sys_hris_ai_use_policies", "sys_hris_ai_policy_versions"],
}


STATE_TABLE_CORRECTIONS: dict[str, tuple[str, tuple[str, ...]]] = {
    "ppl_jny_assignments": ("ASSIGNED", ("ASSIGNED", "IN_PROGRESS", "COMPLETED", "CANCELLED")),
    "ppl_bnf_enrollments": ("SUBMITTED", ("SUBMITTED", "ACTIVE", "REJECTED", "CANCELLED")),
    "ppl_bnf_life_events": ("PENDING", ("PENDING", "VERIFIED", "REJECTED", "EXPIRED")),
    "ppl_hrs_cases": ("OPEN", ("OPEN", "TRIAGED", "IN_PROGRESS", "WAITING", "RESOLVED", "CANCELLED")),
    "prf_lrn_assignments": ("ENROLLED", ("ENROLLED", "IN_PROGRESS", "COMPLETED", "CANCELLED")),
    "prf_mkt_applications": ("APPLIED", ("APPLIED", "SHORTLISTED", "SELECTED", "NOT_SELECTED", "WITHDRAWN")),
    "tme_wfm_schedule_candidates": ("CANDIDATE_GENERATED", ("CANDIDATE_GENERATED", "VALIDATED", "PENDING_APPROVAL", "PUBLISHED", "REJECTED")),
    "sys_hris_listening_actions": ("OPEN", ("OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED")),
}


NEW_STATE_COLUMNS: dict[str, tuple[str, tuple[str, ...]]] = {
    "prf_skl_worker_evidence": ("PENDING", ("PENDING", "VERIFIED", "REVOKED")),
    "prf_cmp_approved_snapshots": ("PUBLISHED", ("PUBLISHED", "SUPERSEDED")),
    "sys_hris_listening_responses": ("SUBMITTED", ("SUBMITTED", "WITHDRAWN", "ANONYMIZED")),
    "sys_hris_analytics_export_receipts": ("REQUESTED", ("REQUESTED", "GENERATING", "COMPLETED", "FAILED", "EXPIRED")),
    "sys_hris_ai_provenance_receipts": ("PRODUCED", ("PRODUCED", "CONFIRMED", "REJECTED", "REVOKED")),
}


NULLABLE_COLUMN_CORRECTIONS = {
    ("ppl_cwk_engagements", "effective_to"),
    ("prf_cmp_cycles", "effective_to"),
}


# Fields whose public event name is intentionally different from the request
# spelling.  The mapping is explicit so a similarly-shaped identifier is never
# selected by name or position.  In particular, compensation snapshot, plan
# and cycle identities remain three different identities.
# Hand-reviewed event facts.  Each entry is ``(publicField, physicalSource)``.
# Sources are limited to an operation write or a declared owner read joined to
# that write.  Empty entries intentionally rely on aggregateId/version owner
# refetch; they are still reviewed and are not generator defaults.
EVENT_FACT_SOURCES: dict[str, list[tuple[str, str]]] = {
    "modern.recruiting.requisition.create": [("organizationPublicId", "ppl_rec_requisitions.organization_public_id"), ("positionPublicId", "ppl_rec_requisitions.position_public_id"), ("requisitionCode", "ppl_rec_requisitions.requisition_code"), ("validFrom", "ppl_rec_requisitions.valid_from")],
    "modern.recruiting.requisition.publish": [("requisitionId", "ppl_rec_requisitions.public_id"), ("organizationPublicId", "ppl_rec_requisitions.organization_public_id"), ("positionPublicId", "ppl_rec_requisitions.position_public_id")],
    "modern.recruiting.candidate.stage": [("candidateCaseId", "ppl_rec_candidate_cases.public_id"), ("requisitionId", "ppl_rec_requisitions.public_id"), ("recordedAt", "ppl_rec_candidate_cases.recorded_at")],
    "modern.recruiting.offer.issue": [("candidateCaseId", "ppl_rec_candidate_cases.public_id"), ("offerId", "ppl_rec_offers.public_id"), ("offerVersion", "ppl_rec_offers.offer_version"), ("expiresAt", "ppl_rec_offers.expires_at"), ("validFrom", "ppl_rec_offers.valid_from")],
    "modern.recruiting.hire.record": [("hireRequestId", "ppl_rec_hire_requests.public_id"), ("candidateCaseId", "ppl_rec_candidate_cases.public_id"), ("offerId", "ppl_rec_offers.public_id"), ("effectiveDate", "ppl_rec_hire_requests.effective_date"), ("humanDecisionReceiptId", "ppl_rec_hire_requests.human_decision_receipt_id"), ("requestDigest", "ppl_rec_hire_requests.request_digest")],
    "modern.onboarding.template.create": [("templateId", "ppl_jny_templates.public_id"), ("templateKey", "ppl_jny_templates.template_key"), ("configurationScopeId", "ppl_jny_templates.config_scope_public_id"), ("validFrom", "ppl_jny_templates.valid_from")],
    "modern.onboarding.template.publish": [("templateId", "ppl_jny_templates.public_id"), ("templateKey", "ppl_jny_templates.template_key"), ("validFrom", "ppl_jny_templates.valid_from")],
    "modern.onboarding.journey.assign": [("assignmentId", "ppl_jny_assignments.public_id"), ("workerPublicId", "ppl_jny_assignments.worker_public_id"), ("templateId", "ppl_jny_templates.public_id"), ("assignmentRevision", "ppl_jny_assignments.assignment_revision"), ("assignedAt", "ppl_jny_assignments.assigned_at"), ("dueAt", "ppl_jny_assignments.due_at")],
    "modern.onboarding.task.complete": [("assignmentId", "ppl_jny_assignments.public_id"), ("taskEvidenceId", "ppl_jny_task_evidence.public_id"), ("taskKey", "ppl_jny_task_evidence.task_key"), ("completionRevision", "ppl_jny_task_evidence.completion_revision"), ("evidenceDigest", "ppl_jny_task_evidence.evidence_digest"), ("recordedAt", "ppl_jny_task_evidence.recorded_at")],
    "modern.onboarding.journey.cancel": [("assignmentId", "ppl_jny_assignments.public_id"), ("workerPublicId", "ppl_jny_assignments.worker_public_id"), ("assignmentRevision", "ppl_jny_assignments.assignment_revision")],
    "modern.workforceplan.scenario.create": [("scenarioId", "ppl_wfp_scenarios.public_id"), ("scenarioKey", "ppl_wfp_scenarios.scenario_key"), ("organizationSnapshotId", "ppl_wfp_scenarios.organization_snapshot_id"), ("inputDigest", "ppl_wfp_scenarios.input_digest"), ("revision", "ppl_wfp_scenario_revisions.revision_no"), ("payloadDigest", "ppl_wfp_scenario_revisions.payload_digest")],
    "modern.workforceplan.scenario.simulate": [("scenarioId", "ppl_wfp_scenarios.public_id"), ("revision", "ppl_wfp_scenario_revisions.revision_no"), ("resultDigest", "ppl_wfp_scenario_revisions.result_digest"), ("payloadDigest", "ppl_wfp_scenario_revisions.payload_digest")],
    "modern.workforceplan.scenario.submit": [("scenarioId", "ppl_wfp_scenarios.public_id"), ("revision", "ppl_wfp_scenario_revisions.revision_no"), ("resultDigest", "ppl_wfp_scenario_revisions.result_digest")],
    "modern.workforceplan.scenario.approve": [("scenarioId", "ppl_wfp_scenarios.public_id"), ("revision", "ppl_wfp_scenario_revisions.revision_no"), ("resultDigest", "ppl_wfp_scenario_revisions.result_digest")],
    "modern.workforceplan.scenario.publish": [("scenarioId", "ppl_wfp_scenarios.public_id"), ("publishReceiptId", "ppl_wfp_publish_receipts.public_id"), ("approvedRevision", "ppl_wfp_publish_receipts.approved_revision"), ("effectiveDate", "ppl_wfp_publish_receipts.effective_date"), ("payloadDigest", "ppl_wfp_publish_receipts.payload_digest")],
    "modern.benefits.plan.create": [("planId", "ppl_bnf_plans.public_id"), ("planCode", "ppl_bnf_plans.plan_code"), ("eligibilityPolicyVersionId", "ppl_bnf_plans.eligibility_policy_version_id"), ("validFrom", "ppl_bnf_plans.valid_from")],
    "modern.benefits.plan.publish": [("planId", "ppl_bnf_plans.public_id"), ("planCode", "ppl_bnf_plans.plan_code"), ("eligibilityPolicyVersionId", "ppl_bnf_plans.eligibility_policy_version_id"), ("validFrom", "ppl_bnf_plans.valid_from")],
    "modern.benefits.enrollment.submit": [("enrollmentId", "ppl_bnf_enrollments.public_id"), ("planId", "ppl_bnf_plans.public_id"), ("workerPublicId", "ppl_bnf_enrollments.worker_public_id"), ("effectiveFrom", "ppl_bnf_enrollments.effective_from")],
    "modern.benefits.lifeevent.submit": [("lifeEventId", "ppl_bnf_life_events.public_id"), ("workerPublicId", "ppl_bnf_life_events.worker_public_id"), ("eventType", "ppl_bnf_life_events.event_type"), ("eventDate", "ppl_bnf_life_events.event_date"), ("payloadDigest", "ppl_bnf_life_events.payload_digest")],
    "modern.benefits.enrollment.decide": [("enrollmentId", "ppl_bnf_enrollments.public_id"), ("planId", "ppl_bnf_plans.public_id"), ("workerPublicId", "ppl_bnf_enrollments.worker_public_id"), ("effectiveFrom", "ppl_bnf_enrollments.effective_from")],
    "modern.hrservice.case.create": [("caseId", "ppl_hrs_cases.public_id"), ("caseNumber", "ppl_hrs_cases.case_number"), ("requesterWorkerPublicId", "ppl_hrs_cases.requester_worker_public_id"), ("caseType", "ppl_hrs_cases.case_type"), ("sensitivityClass", "ppl_hrs_cases.sensitivity_class"), ("dueAt", "ppl_hrs_cases.due_at")],
    "modern.hrservice.case.triage": [("caseId", "ppl_hrs_cases.public_id"), ("caseNumber", "ppl_hrs_cases.case_number"), ("dueAt", "ppl_hrs_cases.due_at"), ("actionId", "ppl_hrs_case_actions.public_id"), ("actionType", "ppl_hrs_case_actions.action_type"), ("payloadDigest", "ppl_hrs_case_actions.payload_digest")],
    "modern.hrservice.case.assign": [("caseId", "ppl_hrs_cases.public_id"), ("actionId", "ppl_hrs_case_actions.public_id"), ("actorPublicId", "ppl_hrs_case_actions.actor_public_id"), ("payloadDigest", "ppl_hrs_case_actions.payload_digest")],
    "modern.hrservice.case.respond": [("caseId", "ppl_hrs_cases.public_id"), ("actionId", "ppl_hrs_case_actions.public_id"), ("actionType", "ppl_hrs_case_actions.action_type"), ("payloadDigest", "ppl_hrs_case_actions.payload_digest"), ("recordedAt", "ppl_hrs_case_actions.recorded_at")],
    "modern.hrservice.case.resolve": [("caseId", "ppl_hrs_cases.public_id"), ("caseNumber", "ppl_hrs_cases.case_number"), ("resolvedAt", "ppl_hrs_cases.resolved_at"), ("actionId", "ppl_hrs_case_actions.public_id"), ("payloadDigest", "ppl_hrs_case_actions.payload_digest")],
    "modern.contingent.engagement.create": [("engagementId", "ppl_cwk_engagements.public_id"), ("engagementCode", "ppl_cwk_engagements.engagement_code"), ("workerPublicId", "ppl_cwk_engagements.worker_public_id"), ("vendorPublicId", "ppl_cwk_engagements.vendor_public_id"), ("sponsorWorkerPublicId", "ppl_cwk_engagements.sponsor_worker_public_id"), ("effectiveFrom", "ppl_cwk_engagements.effective_from")],
    "modern.contingent.engagement.submit": [("engagementId", "ppl_cwk_engagements.public_id"), ("workerPublicId", "ppl_cwk_engagements.worker_public_id"), ("vendorPublicId", "ppl_cwk_engagements.vendor_public_id")],
    "modern.contingent.engagement.activate": [("engagementId", "ppl_cwk_engagements.public_id"), ("workerPublicId", "ppl_cwk_engagements.worker_public_id"), ("accessExpiresAt", "ppl_cwk_engagements.access_expires_at")],
    "modern.contingent.engagement.offboard": [("engagementId", "ppl_cwk_engagements.public_id"), ("workerPublicId", "ppl_cwk_engagements.worker_public_id"), ("effectiveTo", "ppl_cwk_engagements.effective_to")],
    "modern.contingent.engagement.close": [("engagementId", "ppl_cwk_engagements.public_id"), ("workerPublicId", "ppl_cwk_engagements.worker_public_id"), ("effectiveTo", "ppl_cwk_engagements.effective_to")],
    "modern.skills.taxonomy.create": [("taxonomyId", "prf_skl_taxonomies.public_id"), ("taxonomyKey", "prf_skl_taxonomies.taxonomy_key"), ("version", "prf_skl_taxonomy_versions.version_no"), ("contentDigest", "prf_skl_taxonomy_versions.content_digest"), ("skillCount", "prf_skl_taxonomy_versions.skill_count")],
    "modern.skills.taxonomy.validate": [("taxonomyId", "prf_skl_taxonomies.public_id"), ("version", "prf_skl_taxonomy_versions.version_no"), ("contentDigest", "prf_skl_taxonomy_versions.content_digest"), ("skillCount", "prf_skl_taxonomy_versions.skill_count")],
    "modern.skills.taxonomy.publish": [("taxonomyId", "prf_skl_taxonomies.public_id"), ("version", "prf_skl_taxonomy_versions.version_no"), ("contentDigest", "prf_skl_taxonomy_versions.content_digest"), ("skillCount", "prf_skl_taxonomy_versions.skill_count"), ("effectiveFrom", "prf_skl_taxonomy_versions.effective_from")],
    "modern.skills.evidence.verify": [("evidenceId", "prf_skl_worker_evidence.public_id"), ("workerPublicId", "prf_skl_worker_evidence.worker_public_id"), ("skillPublicId", "prf_skl_worker_evidence.skill_public_id"), ("proficiencyLevel", "prf_skl_worker_evidence.proficiency_level"), ("provenanceType", "prf_skl_worker_evidence.provenance_type"), ("evidenceDigest", "prf_skl_worker_evidence.evidence_digest")],
    "modern.growth.profile.create": [("profileId", "prf_grw_profiles.public_id"), ("workerPublicId", "prf_grw_profiles.worker_public_id"), ("profileVersion", "prf_grw_profiles.profile_version"), ("validFrom", "prf_grw_profiles.valid_from")],
    "modern.growth.profile.update": [("profileId", "prf_grw_profiles.public_id"), ("workerPublicId", "prf_grw_profiles.worker_public_id"), ("profileVersion", "prf_grw_profiles.profile_version"), ("artifactPublicId", "prf_grw_profile_revisions.artifact_public_id"), ("artifactRevision", "prf_grw_profile_revisions.artifact_revision"), ("contentDigest", "prf_grw_profile_revisions.content_digest")],
    "modern.growth.evidence.link": [("profileId", "prf_grw_profiles.public_id"), ("workerPublicId", "prf_grw_profiles.worker_public_id"), ("evidenceLinkId", "prf_grw_evidence_links.public_id"), ("evidencePublicId", "prf_grw_evidence_links.evidence_public_id"), ("evidenceType", "prf_grw_evidence_links.evidence_type"), ("sourceRevision", "prf_grw_evidence_links.source_revision"), ("consentRevision", "prf_grw_evidence_links.consent_revision")],
    "modern.growth.coaching.record": [("profileId", "prf_grw_profiles.public_id"), ("workerPublicId", "prf_grw_profiles.worker_public_id"), ("profileVersion", "prf_grw_profiles.profile_version"), ("coachingNoteId", "prf_grw_coaching_notes.public_id"), ("coachingArtifactPublicId", "prf_grw_coaching_notes.coaching_artifact_public_id"), ("artifactRevision", "prf_grw_coaching_notes.artifact_revision"), ("contentDigest", "prf_grw_coaching_notes.content_digest"), ("recordedAt", "prf_grw_coaching_notes.recorded_at")],
    "modern.growth.profile.archive": [("profileId", "prf_grw_profiles.public_id"), ("workerPublicId", "prf_grw_profiles.worker_public_id"), ("archivedAt", "prf_grw_profiles.archived_at")],
    "modern.learning.offering.create": [("offeringId", "prf_lrn_offerings.public_id"), ("offeringCode", "prf_lrn_offerings.offering_code"), ("providerPublicId", "prf_lrn_offerings.provider_public_id"), ("validFrom", "prf_lrn_offerings.valid_from")],
    "modern.learning.offering.publish": [("offeringId", "prf_lrn_offerings.public_id"), ("offeringCode", "prf_lrn_offerings.offering_code"), ("providerPublicId", "prf_lrn_offerings.provider_public_id")],
    "modern.learning.self.enroll": [("assignmentId", "prf_lrn_assignments.public_id"), ("workerPublicId", "prf_lrn_assignments.worker_public_id"), ("offeringId", "prf_lrn_offerings.public_id"), ("assignmentRevision", "prf_lrn_assignments.assignment_revision"), ("assignedAt", "prf_lrn_assignments.assigned_at")],
    "modern.learning.assignment.start": [("assignmentId", "prf_lrn_assignments.public_id"), ("workerPublicId", "prf_lrn_assignments.worker_public_id"), ("offeringId", "prf_lrn_offerings.public_id"), ("assignmentRevision", "prf_lrn_assignments.assignment_revision")],
    "modern.learning.completion.verify": [("assignmentId", "prf_lrn_assignments.public_id"), ("workerPublicId", "prf_lrn_assignments.worker_public_id"), ("completionId", "prf_lrn_completion_evidence.public_id"), ("completedAt", "prf_lrn_completion_evidence.completed_at"), ("evidenceDigest", "prf_lrn_completion_evidence.evidence_digest"), ("skillEvidenceIds", "prf_lrn_completion_evidence.skill_evidence_ids")],
    "modern.opportunity.create": [("opportunityId", "prf_mkt_opportunities.public_id"), ("opportunityCode", "prf_mkt_opportunities.opportunity_code"), ("ownerOrgPublicId", "prf_mkt_opportunities.owner_org_public_id"), ("openFrom", "prf_mkt_opportunities.open_from")],
    "modern.opportunity.publish": [("opportunityId", "prf_mkt_opportunities.public_id"), ("opportunityCode", "prf_mkt_opportunities.opportunity_code"), ("ownerOrgPublicId", "prf_mkt_opportunities.owner_org_public_id")],
    "modern.opportunity.apply": [("applicationId", "prf_mkt_applications.public_id"), ("opportunityId", "prf_mkt_opportunities.public_id"), ("workerPublicId", "prf_mkt_applications.worker_public_id"), ("appliedAt", "prf_mkt_applications.applied_at")],
    "modern.opportunity.shortlist": [("applicationId", "prf_mkt_applications.public_id"), ("opportunityId", "prf_mkt_opportunities.public_id"), ("workerPublicId", "prf_mkt_applications.worker_public_id"), ("explanationId", "prf_mkt_match_explanations.public_id"), ("payloadDigest", "prf_mkt_match_explanations.payload_digest")],
    "modern.opportunity.selection.record": [("applicationId", "prf_mkt_applications.public_id"), ("opportunityId", "prf_mkt_opportunities.public_id"), ("workerPublicId", "prf_mkt_applications.worker_public_id")],
    "modern.succession.plan.create": [("planId", "prf_suc_plans.public_id"), ("planKey", "prf_suc_plans.plan_key"), ("keyPositionPublicId", "prf_suc_plans.key_position_public_id"), ("planVersion", "prf_suc_plans.plan_version")],
    "modern.succession.nomination.add": [("planId", "prf_suc_plans.public_id"), ("nominationId", "prf_suc_nominations.public_id"), ("workerPublicId", "prf_suc_nominations.worker_public_id"), ("nominationRevision", "prf_suc_nominations.nomination_revision")],
    "modern.succession.plan.submit": [("planId", "prf_suc_plans.public_id"), ("keyPositionPublicId", "prf_suc_plans.key_position_public_id"), ("planVersion", "prf_suc_plans.plan_version")],
    "modern.succession.plan.approve": [("planId", "prf_suc_plans.public_id"), ("keyPositionPublicId", "prf_suc_plans.key_position_public_id"), ("planVersion", "prf_suc_plans.plan_version")],
    "modern.succession.plan.publish": [("planId", "prf_suc_plans.public_id"), ("keyPositionPublicId", "prf_suc_plans.key_position_public_id"), ("planVersion", "prf_suc_plans.plan_version"), ("audiencePolicyRevision", "prf_suc_plans.audience_policy_revision"), ("publishedAt", "prf_suc_plans.published_at")],
    "modern.compplan.cycle.create": [("cycleId", "prf_cmp_cycles.public_id"), ("cycleCode", "prf_cmp_cycles.cycle_code"), ("populationSnapshotId", "prf_cmp_cycles.population_snapshot_id")],
    "modern.compplan.budget.allocate": [("cycleId", "prf_cmp_cycles.public_id"), ("ledgerEntryId", "prf_cmp_budget_ledger.public_id"), ("payloadDigest", "prf_cmp_budget_ledger.payload_digest")],
    "modern.compplan.proposal.submit": [("cycleId", "prf_cmp_cycles.public_id"), ("proposalId", "prf_cmp_proposals.public_id"), ("workerPublicId", "prf_cmp_proposals.worker_public_id"), ("componentCode", "prf_cmp_proposals.component_code"), ("submissionDigest", "prf_cmp_proposals.submission_digest"), ("submittedAt", "prf_cmp_proposals.submitted_at")],
    "modern.compplan.plan.approve": [("planId", "prf_cmp_plans.public_id"), ("cycleId", "prf_cmp_plans.cycle_public_id"), ("approvalReceiptId", "prf_cmp_plans.approval_receipt_public_id"), ("approvalRevision", "prf_cmp_plans.approval_revision"), ("approvalOutcome", "prf_cmp_plans.approval_outcome"), ("planRevision", "prf_cmp_plans.plan_revision"), ("cycleVersion", "prf_cmp_cycles.aggregate_version"), ("reasonCode", "prf_cmp_plans.reason_code")],
    "modern.compplan.snapshot.publish": [("planId", "prf_cmp_approved_snapshots.plan_public_id"), ("cycleId", "prf_cmp_approved_snapshots.cycle_public_id"), ("approvalRevision", "prf_cmp_approved_snapshots.approval_revision"), ("approvalReceiptId", "prf_cmp_approved_snapshots.approval_receipt_id"), ("effectiveDate", "prf_cmp_approved_snapshots.effective_from"), ("snapshotId", "prf_cmp_approved_snapshots.public_id"), ("sourceVersion", "prf_cmp_approved_snapshots.source_version"), ("lineCount", "prf_cmp_approved_snapshots.line_count"), ("payloadDigest", "prf_cmp_approved_snapshots.payload_digest")],
    "modern.wfm.forecast.create": [("forecastId", "tme_wfm_demand_forecasts.public_id"), ("forecastKey", "tme_wfm_demand_forecasts.forecast_key"), ("forecastRevision", "tme_wfm_demand_forecasts.forecast_revision"), ("periodStart", "tme_wfm_demand_forecasts.period_start"), ("periodEnd", "tme_wfm_demand_forecasts.period_end"), ("sourceDigest", "tme_wfm_demand_forecasts.source_digest"), ("worksitePublicId", "tme_wfm_demand_forecasts.worksite_public_id")],
    "modern.wfm.schedule.optimize": [("optimizationRequestId", "tme_wfm_optimization_requests.public_id"), ("forecastId", "tme_wfm_demand_forecasts.public_id"), ("inputSnapshotId", "tme_wfm_optimization_requests.input_snapshot_id"), ("ruleVersion", "tme_wfm_optimization_requests.rule_version"), ("fairnessEvaluationId", "tme_wfm_optimization_requests.fairness_evaluation_id"), ("availabilitySnapshotId", "tme_wfm_optimization_requests.availability_snapshot_id"), ("periodStart", "tme_wfm_optimization_requests.period_start"), ("periodEnd", "tme_wfm_optimization_requests.period_end"), ("requestDigest", "tme_wfm_optimization_requests.request_digest")],
    "modern.wfm.schedule.validate": [("candidatePublicId", "tme_wfm_schedule_candidates.public_id"), ("candidateRevision", "tme_wfm_schedule_candidates.candidate_revision"), ("candidateDigest", "tme_wfm_schedule_candidates.candidate_digest"), ("evaluationReceiptId", "tme_wfm_constraint_evaluation_receipts.public_id"), ("blockingViolationCount", "tme_wfm_constraint_evaluation_receipts.blocking_violation_count"), ("fairnessMetricCount", "tme_wfm_constraint_evaluation_receipts.fairness_metric_count"), ("resultDigest", "tme_wfm_constraint_evaluation_receipts.result_digest")],
    "modern.wfm.schedule.submit": [("candidatePublicId", "tme_wfm_schedule_candidates.public_id"), ("candidateRevision", "tme_wfm_schedule_candidates.candidate_revision"), ("candidateDigest", "tme_wfm_schedule_candidates.candidate_digest")],
    "modern.wfm.schedule.publish": [("publicationPublicId", "tme_wfm_schedule_publish_ledger.public_id"), ("candidatePublicId", "tme_wfm_schedule_candidates.public_id"), ("candidateRevision", "tme_wfm_schedule_publish_ledger.candidate_revision"), ("canonicalSchedulePeriodPublicId", "tme_wfm_schedule_publish_ledger.schedule_period_public_id"), ("approvalReceiptPublicId", "tme_wfm_schedule_publish_ledger.approval_receipt_id"), ("candidateDigest", "tme_wfm_schedule_candidates.candidate_digest"), ("payloadDigest", "tme_wfm_schedule_publish_ledger.payload_digest")],
    "modern.listening.response.submit": [("responseId", "sys_hris_listening_responses.public_id"), ("surveyId", "sys_hris_listening_surveys.public_id"), ("responseDigest", "sys_hris_listening_responses.response_digest"), ("submittedAt", "sys_hris_listening_responses.submitted_at"), ("eraseAfter", "sys_hris_listening_responses.erase_after")],
    "modern.listening.survey.create": [("surveyId", "sys_hris_listening_surveys.public_id"), ("surveyKey", "sys_hris_listening_surveys.survey_key"), ("surveyVersion", "sys_hris_listening_surveys.survey_version"), ("audienceSnapshotId", "sys_hris_listening_surveys.audience_snapshot_id"), ("anonymityThreshold", "sys_hris_listening_surveys.anonymity_threshold")],
    "modern.listening.survey.publish": [("surveyId", "sys_hris_listening_surveys.public_id"), ("surveyVersion", "sys_hris_listening_surveys.survey_version"), ("audienceDigest", "sys_hris_listening_surveys.audience_digest"), ("opensAt", "sys_hris_listening_surveys.opens_at"), ("closesAt", "sys_hris_listening_surveys.closes_at")],
    "modern.listening.survey.close": [("surveyId", "sys_hris_listening_surveys.public_id"), ("surveyVersion", "sys_hris_listening_surveys.survey_version"), ("closesAt", "sys_hris_listening_surveys.closes_at")],
    "modern.listening.action.create": [("actionId", "sys_hris_listening_actions.public_id"), ("surveyId", "sys_hris_listening_surveys.public_id"), ("actionKey", "sys_hris_listening_actions.action_key"), ("ownerPrincipalId", "sys_hris_listening_actions.owner_principal_id"), ("dueAt", "sys_hris_listening_actions.due_at"), ("payloadDigest", "sys_hris_listening_actions.payload_digest")],
    "modern.listening.action.complete": [("actionId", "sys_hris_listening_actions.public_id"), ("completedAt", "sys_hris_listening_actions.completed_at"), ("payloadDigest", "sys_hris_listening_actions.payload_digest")],
    "modern.analytics.metric.create": [("metricId", "sys_hris_metric_definitions.public_id"), ("metricKey", "sys_hris_metric_definitions.metric_key"), ("version", "sys_hris_metric_versions.version_no"), ("definitionDigest", "sys_hris_metric_versions.definition_digest"), ("lineageDigest", "sys_hris_metric_versions.lineage_digest")],
    "modern.analytics.metric.validate": [("metricId", "sys_hris_metric_definitions.public_id"), ("version", "sys_hris_metric_versions.version_no"), ("definitionDigest", "sys_hris_metric_versions.definition_digest"), ("lineageDigest", "sys_hris_metric_versions.lineage_digest")],
    "modern.analytics.metric.publish": [("metricId", "sys_hris_metric_definitions.public_id"), ("version", "sys_hris_metric_versions.version_no"), ("projectionId", "sys_hris_metric_projections.public_id"), ("projectionRevision", "sys_hris_metric_projections.projection_revision"), ("subjectCount", "sys_hris_metric_projections.subject_count"), ("payloadDigest", "sys_hris_metric_projections.payload_digest")],
    "modern.analytics.export.create": [("exportReceiptId", "sys_hris_analytics_export_receipts.public_id"), ("metricProjectionIdsDigest", "sys_hris_analytics_export_receipts.metric_projection_ids_digest"), ("objectDigest", "sys_hris_analytics_export_receipts.object_digest"), ("rowCount", "sys_hris_analytics_export_receipts.row_count"), ("requestedAt", "sys_hris_analytics_export_receipts.requested_at")],
    "modern.analytics.metric.retire": [("metricId", "sys_hris_metric_definitions.public_id"), ("metricKey", "sys_hris_metric_definitions.metric_key")],
    "modern.ai.assist.create": [("assistanceReceiptId", "sys_hris_ai_provenance_receipts.public_id"), ("useCaseKey", "sys_hris_ai_provenance_receipts.use_case_key"), ("policyVersion", "sys_hris_ai_provenance_receipts.policy_version"), ("inputDigest", "sys_hris_ai_provenance_receipts.input_digest"), ("outputDigest", "sys_hris_ai_provenance_receipts.output_digest"), ("sourceRefsDigest", "sys_hris_ai_provenance_receipts.source_refs_digest"), ("modelRouteKey", "sys_hris_ai_provenance_receipts.model_route_key")],
    "modern.ai.policy.create": [("policyId", "sys_hris_ai_use_policies.public_id"), ("useCaseKey", "sys_hris_ai_use_policies.use_case_key"), ("policyVersion", "sys_hris_ai_use_policies.policy_version"), ("humanControlMode", "sys_hris_ai_policy_versions.human_control_mode"), ("policyDigest", "sys_hris_ai_policy_versions.policy_digest")],
    "modern.ai.policy.evaluate": [("evaluationRequestId", "sys_hris_ai_evaluation_requests.public_id"), ("policyId", "sys_hris_ai_use_policies.public_id"), ("policyVersion", "sys_hris_ai_evaluation_requests.policy_version"), ("evaluationSuiteVersion", "sys_hris_ai_evaluation_requests.evaluation_suite_version"), ("fixtureSetDigest", "sys_hris_ai_evaluation_requests.fixture_set_digest"), ("modelRouteKey", "sys_hris_ai_evaluation_requests.model_route_key"), ("requestDigest", "sys_hris_ai_evaluation_requests.request_digest")],
    "modern.ai.policy.publish": [("policyId", "sys_hris_ai_use_policies.public_id"), ("useCaseKey", "sys_hris_ai_use_policies.use_case_key"), ("policyVersion", "sys_hris_ai_use_policies.policy_version"), ("policyDigest", "sys_hris_ai_policy_versions.policy_digest")],
    "modern.ai.kill.switch": [("policyId", "sys_hris_ai_use_policies.public_id"), ("useCaseKey", "sys_hris_ai_use_policies.use_case_key"), ("policyVersion", "sys_hris_ai_use_policies.policy_version")],
    "modern.ai.policy.retire": [("policyId", "sys_hris_ai_use_policies.public_id"), ("useCaseKey", "sys_hris_ai_use_policies.use_case_key"), ("policyVersion", "sys_hris_ai_use_policies.policy_version")],
}


EVENT_CONSUMER_POLICIES: dict[str, dict[str, Any]] = {
    "modern.recruiting.requisition.create": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-HRM'], 'purposeCodes': ['hcm.recruiting.operate'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.recruiting.requisition.publish": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-HRM'], 'purposeCodes': ['hcm.recruiting.decide'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.recruiting.candidate.stage": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-HRM'], 'purposeCodes': ['hcm.recruiting.operate'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.recruiting.offer.issue": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-HRM'], 'purposeCodes': ['hcm.recruiting.decide'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.recruiting.hire.record": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-HRM'], 'purposeCodes': ['hcm.recruiting.decide'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.onboarding.template.create": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-HRM'], 'purposeCodes': ['hcm.onboarding.operate'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.onboarding.template.publish": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-HRM'], 'purposeCodes': ['hcm.onboarding.operate'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.onboarding.journey.assign": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-HRM'], 'purposeCodes': ['hcm.onboarding.operate'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.onboarding.task.complete": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-HRM'], 'purposeCodes': ['hcm.onboarding.task.complete'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.onboarding.journey.cancel": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-HRM'], 'purposeCodes': ['hcm.onboarding.operate'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.workforceplan.scenario.create": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-HRM'], 'purposeCodes': ['hcm.workforce.plan.model'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.workforceplan.scenario.simulate": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-HRM'], 'purposeCodes': ['hcm.workforce.plan.model'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.workforceplan.scenario.submit": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-HRM'], 'purposeCodes': ['hcm.workforce.plan.model'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.workforceplan.scenario.approve": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-HRM'], 'purposeCodes': ['hcm.workforce.plan.publish'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.workforceplan.scenario.publish": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-HRM'], 'purposeCodes': ['hcm.workforce.plan.publish'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.benefits.plan.create": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-HRM'], 'purposeCodes': ['hcm.benefits.operate'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.benefits.plan.publish": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-HRM'], 'purposeCodes': ['hcm.benefits.operate'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.benefits.enrollment.submit": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-HRM'], 'purposeCodes': ['hcm.benefits.self.enroll'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.benefits.lifeevent.submit": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-HRM'], 'purposeCodes': ['hcm.benefits.self.enroll'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.benefits.enrollment.decide": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-HRM'], 'purposeCodes': ['hcm.benefits.operate'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.hrservice.case.create": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-HRM'], 'purposeCodes': ['hcm.hrservice.self.create'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.hrservice.case.triage": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-HRM'], 'purposeCodes': ['hcm.hrservice.case.work'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.hrservice.case.assign": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-HRM'], 'purposeCodes': ['hcm.hrservice.restricted.assign'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.hrservice.case.respond": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-HRM'], 'purposeCodes': ['hcm.hrservice.case.work'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.hrservice.case.resolve": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-HRM'], 'purposeCodes': ['hcm.hrservice.case.work'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.contingent.engagement.create": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-HRM'], 'purposeCodes': ['hcm.contingent.operate'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.contingent.engagement.submit": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-HRM'], 'purposeCodes': ['hcm.contingent.operate'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.contingent.engagement.activate": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-HRM'], 'purposeCodes': ['hcm.contingent.operate'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.contingent.engagement.offboard": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-HRM'], 'purposeCodes': ['hcm.contingent.offboard'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.contingent.engagement.close": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-HRM'], 'purposeCodes': ['hcm.contingent.offboard'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.skills.taxonomy.create": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-PER'], 'purposeCodes': ['hcm.skills.manage'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.skills.taxonomy.validate": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-PER'], 'purposeCodes': ['hcm.skills.manage'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.skills.taxonomy.publish": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-PER'], 'purposeCodes': ['hcm.skills.manage'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.skills.evidence.verify": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-PER'], 'purposeCodes': ['hcm.skills.evidence.verify'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.growth.profile.create": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-PER'], 'purposeCodes': ['hcm.growth.self.manage'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.growth.profile.update": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-PER'], 'purposeCodes': ['hcm.growth.self.manage'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.growth.evidence.link": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-PER'], 'purposeCodes': ['hcm.growth.self.manage'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.growth.coaching.record": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-PER'], 'purposeCodes': ['hcm.growth.manager.coach'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.growth.profile.archive": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-PER'], 'purposeCodes': ['hcm.growth.self.manage'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.learning.offering.create": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-PER'], 'purposeCodes': ['hcm.learning.operate'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.learning.offering.publish": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-PER'], 'purposeCodes': ['hcm.learning.operate'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.learning.self.enroll": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-PER'], 'purposeCodes': ['hcm.learning.self.enroll'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.learning.assignment.start": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-PER'], 'purposeCodes': ['hcm.learning.self.enroll'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.learning.completion.verify": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-PER'], 'purposeCodes': ['hcm.learning.operate'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.opportunity.create": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-PER'], 'purposeCodes': ['hcm.opportunity.operate'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.opportunity.publish": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-PER'], 'purposeCodes': ['hcm.opportunity.operate'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.opportunity.apply": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-PER'], 'purposeCodes': ['hcm.opportunity.self.apply'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.opportunity.shortlist": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-PER'], 'purposeCodes': ['hcm.opportunity.operate'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.opportunity.selection.record": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-PER'], 'purposeCodes': ['hcm.opportunity.operate'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.succession.plan.create": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-PER'], 'purposeCodes': ['hcm.succession.manage'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.succession.nomination.add": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-PER'], 'purposeCodes': ['hcm.succession.manage'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.succession.plan.submit": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-PER'], 'purposeCodes': ['hcm.succession.manage'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.succession.plan.approve": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-PER'], 'purposeCodes': ['hcm.succession.publish'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.succession.plan.publish": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-PER'], 'purposeCodes': ['hcm.succession.publish'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.compplan.cycle.create": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-PER'], 'purposeCodes': ['hcm.compensation.plan.propose'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.compplan.budget.allocate": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-PER'], 'purposeCodes': ['hcm.compensation.plan.propose'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.compplan.proposal.submit": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-PER'], 'purposeCodes': ['hcm.compensation.plan.propose'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.compplan.plan.approve": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-PER'], 'purposeCodes': ['hcm.compensation.plan.approve'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.compplan.snapshot.publish": {
        'refetchAllowed': True,
        'ownerRefetchEndpoint': '/internal/hris-performance/v1/approved-compensation-plan-snapshots/{snapshotId}',
        'allowedConsumerSessions': ['HRIS-PER', 'HRIS-PAY'],
        'purposeCodes': ['COMPENSATION_PLAN_PUBLISH',
                         'HRIS_APPROVED_COMPENSATION_PLAN_SNAPSHOT_REFETCH'],
        'pep': 'SVC-PEP-PER-001',
        'refetchAllowedFields': [
            'snapshotId', 'planId', 'cycleId', 'approvalRevision',
            'approvalReceiptId', 'effectiveDate', 'sourceVersion', 'lineCount',
            'payloadDigest', 'lines',
        ],
    },
    "modern.wfm.forecast.create": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-TIM'], 'purposeCodes': ['hcm.wfm.optimize'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.wfm.schedule.optimize": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-TIM'], 'purposeCodes': ['hcm.wfm.optimize'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.wfm.schedule.validate": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-TIM'], 'purposeCodes': ['hcm.wfm.optimize'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.wfm.schedule.submit": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-TIM'], 'purposeCodes': ['hcm.wfm.optimize'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.wfm.schedule.publish": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-TIM'], 'purposeCodes': ['hcm.wfm.publish'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.listening.response.submit": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-SYS'], 'purposeCodes': ['hcm.listening.respond'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.listening.survey.create": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-SYS'], 'purposeCodes': ['hcm.listening.manage'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.listening.survey.publish": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-SYS'], 'purposeCodes': ['hcm.listening.manage'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.listening.survey.close": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-SYS'], 'purposeCodes': ['hcm.listening.manage'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.listening.action.create": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-SYS'], 'purposeCodes': ['hcm.listening.manage'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.listening.action.complete": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-SYS'], 'purposeCodes': ['hcm.listening.manage'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.analytics.metric.create": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-SYS'], 'purposeCodes': ['hcm.analytics.metric.manage'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.analytics.metric.validate": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-SYS'], 'purposeCodes': ['hcm.analytics.metric.manage'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.analytics.metric.publish": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-SYS'], 'purposeCodes': ['hcm.analytics.metric.manage'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.analytics.export.create": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-SYS'], 'purposeCodes': ['hcm.analytics.export'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.analytics.metric.retire": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-SYS'], 'purposeCodes': ['hcm.analytics.metric.manage'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.ai.assist.create": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-SYS'], 'purposeCodes': ['hcm.ai.assist.use'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.ai.policy.create": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-SYS'], 'purposeCodes': ['hcm.ai.policy.manage'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.ai.policy.evaluate": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-SYS'], 'purposeCodes': ['hcm.ai.policy.manage'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.ai.policy.publish": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-SYS'], 'purposeCodes': ['hcm.ai.policy.manage'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.ai.kill.switch": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-SYS'], 'purposeCodes': ['hcm.ai.kill-switch.execute'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
    "modern.ai.policy.retire": {'refetchAllowed': False, 'ownerRefetchEndpoint': None, 'allowedConsumerSessions': ['HRIS-SYS'], 'purposeCodes': ['hcm.ai.policy.manage'], 'pep': 'SAME_BOUNDED_CONTEXT_EVENT_PEP_V1'},
}


# The public API has 81 command-caused primary facts, but those facts are not
# the whole event vocabulary.  These explicitly reviewed contracts represent
# (a) a conditional second fact and (b) facts produced only after an owner or
# scheduler handler has completed its own transaction.  They are deliberately
# separate from COMMAND_WRITES so a public command can never impersonate an
# owner acknowledgement or a timed system action.
CONDITIONAL_COMMAND_EVENTS: dict[str, list[dict[str, Any]]] = {
    "modern.onboarding.task.complete": [{
        "eventType": "OnboardingJourneyCompleted",
        "rootTable": "ppl_jny_assignments",
        "preStates": ["IN_PROGRESS"], "postStates": ["COMPLETED"],
        "facts": [
            ("assignmentId", "ppl_jny_assignments.public_id"),
            ("workerPublicId", "ppl_jny_assignments.worker_public_id"),
            ("assignmentRevision", "ppl_jny_assignments.assignment_revision"),
        ],
        "condition": (
            "AFTER task evidence commit, emit only when the tenant-bound template projection proves "
            "every required task complete and the same CAS advances assignment status to COMPLETED"
        ),
        "policy": {
            "refetchAllowed": False, "ownerRefetchEndpoint": None,
            "allowedConsumerSessions": ["HRIS-HRM"],
            "purposeCodes": ["hcm.onboarding.task.complete"],
            "pep": "SAME_BOUNDED_CONTEXT_EVENT_PEP_V1",
        },
    }],
}


# A command may CAS one owner aggregate and atomically create a distinct
# immutable event aggregate.  Compensation publication is the reviewed case:
# the cycle is the command lock/CAS root, while PAY consumes the committed
# snapshot identity.  Keeping this explicit prevents snapshotId/planId/cycleId
# from being collapsed merely because all three are UUID-shaped.
EVENT_AGGREGATE_ROOT_OVERRIDES: dict[str, dict[str, Any]] = {
    "modern.recruiting.hire.record": {
        "rootTable": "ppl_rec_hire_requests",
        "preStates": ["NONE"], "postStates": ["REQUESTED"],
    },
    "modern.compplan.plan.approve": {
        "rootTable": "prf_cmp_plans",
        "preStates": ["NONE"], "postStates": ["APPROVED"],
    },
    "modern.compplan.snapshot.publish": {
        "rootTable": "prf_cmp_approved_snapshots",
        "preStates": ["NONE"], "postStates": ["PUBLISHED"],
    },
}


INTERNAL_EVENT_HANDLERS: dict[str, dict[str, Any]] = {
    "internal.recruiting.hire-handoff.acknowledge": {
        "handlerId": "internal.recruiting.hire-handoff.acknowledge",
        "capabilityId": "HRIS.MODERN.RECRUITING_ATS",
        "session": "HRIS-HRM",
        "trigger": "HRM.WorkerHireProvisioningAcknowledged.v1",
        "aggregateRootTable": "ppl_rec_candidate_cases",
        "readsTables": ["ppl_rec_candidate_cases", "ppl_rec_offers", "ppl_rec_hire_requests"],
        "writesTables": ["ppl_rec_hire_handoff_receipts", "ppl_rec_candidate_cases",
                         "ppl_rec_hire_requests"],
        "writeDispositions": {"ppl_rec_hire_handoff_receipts": "APPEND",
                              "ppl_rec_candidate_cases": "UPDATE",
                              "ppl_rec_hire_requests": "UPDATE"},
        "stateColumn": "stage", "preStates": ["HIRE_PENDING"], "postStates": ["HIRED"],
        "transitionId": "MOD-HRM-REC-TR-HIRE-ACK-V2",
        "eventType": "CandidateHired",
        "facts": [
            ("hireRequestId", "ppl_rec_hire_requests.public_id"),
            ("candidateCaseId", "ppl_rec_candidate_cases.public_id"),
            ("offerId", "ppl_rec_offers.public_id"),
            ("workerPublicId", "ppl_rec_hire_handoff_receipts.worker_public_id"),
            ("employmentPublicId", "ppl_rec_hire_handoff_receipts.employment_public_id"),
            ("assignmentPublicId", "ppl_rec_hire_handoff_receipts.assignment_public_id"),
            ("effectiveDate", "ppl_rec_hire_handoff_receipts.effective_date"),
            ("hireHandoffReceiptId", "ppl_rec_hire_handoff_receipts.public_id"),
            ("ownerAggregateVersion", "ppl_rec_hire_handoff_receipts.owner_aggregate_version"),
            ("handoffPayloadDigest", "ppl_rec_hire_handoff_receipts.payload_digest"),
        ],
        "policy": {
            "refetchAllowed": False, "ownerRefetchEndpoint": None,
            "allowedConsumerSessions": ["HRIS-HRM"],
            "purposeCodes": ["hcm.recruiting.hire-owner-ack"],
            "pep": "SAME_BOUNDED_CONTEXT_EVENT_PEP_V1",
        },
        "idempotency": {
            "key": "ownerHandoffAcknowledgementId", "scope": "tenantId+candidateCaseId",
            "duplicateResult": "RETURN_EXISTING_HANDOFF_RECEIPT_AND_EVENT_ID_WITHOUT_REPLAYING_MUTATION",
        },
        "ownerAssertions": [
            "workerPublicId, employmentPublicId and assignmentPublicId resolve in HRM owner tenant",
            "ownerAggregateVersion is exact and not stale",
            "acknowledged offer/effective date equal the HIRE_PENDING candidate facts",
        ],
        "orderedTransactionSteps": [
            "claim the tenant-bound REQUESTED hire request by public_id and owner acknowledgement id",
            "lock its candidate by candidate_case_id and require stage=HIRE_PENDING",
            "resolve the request offer_id to the same-tenant issued offer",
            "validate owner worker/employment/assignment refs and owner version",
            "append one ppl_rec_hire_handoff_receipts row keyed by owner acknowledgement",
            "CAS candidate HIRE_PENDING->HIRED and request REQUESTED->ACKNOWLEDGED; increment both aggregate versions",
            "append CandidateHired.v2 to outbox from the committed receipt/root snapshot",
            "commit inbox acknowledgement, receipt, root and outbox atomically",
        ],
        "failureSemantics": "ANY_STEP_FAILURE_ROLLS_BACK_RECEIPT_ROOT_OUTBOX_AND_INBOX; RETRY_IS_IDEMPOTENT",
        "reconcile": "owner acknowledgement may be replayed from durable inbox until one terminal receipt exists",
    },
    "internal.contingent.access-expiry.enforce": {
        "handlerId": "internal.contingent.access-expiry.enforce",
        "capabilityId": "HRIS.MODERN.CONTINGENT_WORKFORCE",
        "session": "HRIS-HRM",
        "trigger": "OWNER_SCHEDULER_DUE_ACCESS_EXPIRY_V1",
        "aggregateRootTable": "ppl_cwk_engagements",
        "readsTables": ["ppl_cwk_engagements"],
        "writesTables": ["ppl_cwk_access_expiry_receipts", "ppl_cwk_engagements"],
        "writeDispositions": {"ppl_cwk_access_expiry_receipts": "APPEND", "ppl_cwk_engagements": "UPDATE"},
        "stateColumn": "status", "preStates": ["ACTIVE", "OFFBOARDING"],
        "postStates": ["OFFBOARDING"],
        "transitionId": "MOD-HRM-CWK-TR-ACCESS-EXPIRY-V2",
        "eventType": "ContingentAccessExpired",
        "facts": [
            ("engagementId", "ppl_cwk_engagements.public_id"),
            ("workerPublicId", "ppl_cwk_engagements.worker_public_id"),
            ("accessExpiresAt", "ppl_cwk_engagements.access_expires_at"),
            ("accessExpiryReceiptId", "ppl_cwk_access_expiry_receipts.public_id"),
            ("grantPublicId", "ppl_cwk_access_expiry_receipts.grant_public_id"),
            ("grantRevision", "ppl_cwk_access_expiry_receipts.grant_revision"),
            ("outcome", "ppl_cwk_access_expiry_receipts.outcome"),
            ("receiptDigest", "ppl_cwk_access_expiry_receipts.receipt_digest"),
        ],
        "policy": {
            "refetchAllowed": False, "ownerRefetchEndpoint": None,
            "allowedConsumerSessions": ["HRIS-HRM"],
            "purposeCodes": ["hcm.contingent.access-expiry"],
            "pep": "SAME_BOUNDED_CONTEXT_EVENT_PEP_V1",
        },
        "idempotency": {
            "key": "grantPublicId+grantRevision", "scope": "tenantId+engagementId",
            "duplicateResult": "RETURN_EXISTING_ACCESS_EXPIRY_RECEIPT_WITHOUT_REVOKING_TWICE",
        },
        "ownerAssertions": [
            "scheduler time is at or after access_expires_at",
            "grant belongs to the same worker, tenant and contingent engagement",
            "access owner confirms the exact revoked grant revision",
        ],
        "orderedTransactionSteps": [
            "lock due tenant-bound engagement and require ACTIVE or OFFBOARDING",
            "validate access-owner revocation acknowledgement and grant revision",
            "append one ppl_cwk_access_expiry_receipts row",
            "CAS engagement to OFFBOARDING and increment aggregate_version",
            "append ContingentAccessExpired.v2 to outbox from committed owner facts",
            "commit scheduler claim, receipt, root and outbox atomically",
        ],
        "failureSemantics": "ANY_STEP_FAILURE_ROLLS_BACK_RECEIPT_ROOT_OUTBOX_AND_SCHEDULER_CLAIM; RETRY_IS_IDEMPOTENT",
        "reconcile": "due items remain claimable until a terminal receipt for the grant revision exists",
    },
    "internal.wfm.schedule-optimization.complete": {
        "handlerId": "internal.wfm.schedule-optimization.complete",
        "capabilityId": "HRIS.MODERN.ADVANCED_WFM", "session": "HRIS-TIM",
        "trigger": "TIM.ScheduleOptimizationOwnerCompleted.v1",
        "aggregateRootTable": "tme_wfm_optimization_requests",
        "readsTables": ["tme_wfm_optimization_requests", "tme_wfm_demand_forecasts"],
        "writesTables": ["tme_wfm_schedule_candidates", "tme_wfm_candidate_shift_lines",
                         "tme_wfm_constraint_evaluation_receipts", "tme_wfm_constraint_violation_lines",
                         "tme_wfm_fairness_measure_values", "tme_wfm_optimization_requests"],
        "writeDispositions": {"tme_wfm_schedule_candidates": "INSERT",
                              "tme_wfm_candidate_shift_lines": "APPEND_MANY",
                              "tme_wfm_constraint_evaluation_receipts": "APPEND",
                              "tme_wfm_constraint_violation_lines": "APPEND_MANY",
                              "tme_wfm_fairness_measure_values": "APPEND_MANY",
                              "tme_wfm_optimization_requests": "UPDATE"},
        "stateColumn": "status", "preStates": ["REQUESTED"], "postStates": ["COMPLETED"],
        "transitionId": "MOD-TIM-WFM-TR-OPTIMIZATION-ACK-V2",
        "eventType": "WorkforceScheduleCandidateGenerated",
        "facts": [
            ("optimizationRequestId", "tme_wfm_optimization_requests.public_id"),
            ("forecastId", "tme_wfm_demand_forecasts.public_id"),
            ("candidatePublicId", "tme_wfm_schedule_candidates.public_id"),
            ("candidateRevision", "tme_wfm_schedule_candidates.candidate_revision"),
            ("candidateDigest", "tme_wfm_schedule_candidates.candidate_digest"),
            ("periodStart", "tme_wfm_schedule_candidates.period_start"),
            ("periodEnd", "tme_wfm_schedule_candidates.period_end"),
            ("availabilitySnapshotId", "tme_wfm_schedule_candidates.availability_snapshot_id"),
            ("evaluationReceiptId", "tme_wfm_constraint_evaluation_receipts.public_id"),
            ("resultDigest", "tme_wfm_constraint_evaluation_receipts.result_digest"),
        ],
        "policy": {"refetchAllowed": False, "ownerRefetchEndpoint": None,
                   "allowedConsumerSessions": ["HRIS-TIM"], "purposeCodes": ["hcm.wfm.optimize"],
                   "pep": "SAME_BOUNDED_CONTEXT_EVENT_PEP_V1"},
        "idempotency": {"key": "optimizationOwnerResultId", "scope": "tenantId+optimizationRequestId",
                        "duplicateResult": "RETURN_EXISTING_CANDIDATE_AND_RECEIPT_WITHOUT_RERUNNING_SOLVER"},
        "ownerAssertions": [
            "optimization request is REQUESTED and owner result references its exact request digest",
            "forecast and availability/input snapshots are tenant-bound and revision compatible",
            "candidate and constraint result digests are recomputed before commit",
        ],
        "orderedTransactionSteps": [
            "lock tenant-bound optimization request by public_id and require REQUESTED",
            "verify solver owner result/request digest and all owner snapshot revisions",
            "insert one schedule candidate and append its constraint evaluation receipt",
            "CAS optimization request REQUESTED->COMPLETED and increment aggregate_version",
            "append WorkforceScheduleCandidateGenerated.v2 from committed result rows",
            "commit inbox, candidate, receipt, request and outbox atomically",
        ],
        "failureSemantics": "ANY_STEP_FAILURE_ROLLS_BACK_RESULT_ROWS_ROOT_OUTBOX_AND_INBOX; RETRY_IS_IDEMPOTENT",
        "reconcile": "REQUESTED remains recoverable; failed solver results are quarantined without fabricated candidate",
    },
    "internal.ai.policy-evaluation.complete": {
        "handlerId": "internal.ai.policy-evaluation.complete",
        "capabilityId": "HRIS.MODERN.GOVERNED_AI", "session": "HRIS-SYS",
        "trigger": "SYS.GovernedAiEvaluationOwnerCompleted.v1",
        "aggregateRootTable": "sys_hris_ai_evaluation_requests",
        "readsTables": ["sys_hris_ai_evaluation_requests", "sys_hris_ai_use_policies", "sys_hris_ai_policy_versions"],
        "writesTables": ["sys_hris_ai_evaluation_receipts", "sys_hris_ai_use_policies", "sys_hris_ai_evaluation_requests"],
        "writeDispositions": {"sys_hris_ai_evaluation_receipts": "APPEND", "sys_hris_ai_use_policies": "UPDATE", "sys_hris_ai_evaluation_requests": "UPDATE"},
        "stateColumn": "status", "preStates": ["REQUESTED"], "postStates": ["COMPLETED"],
        "transitionId": "MOD-SYS-AI-TR-EVALUATION-ACK-V2",
        "eventType": "GovernedAiPolicyEvaluationCompleted",
        "facts": [
            ("evaluationRequestId", "sys_hris_ai_evaluation_requests.public_id"),
            ("policyId", "sys_hris_ai_use_policies.public_id"),
            ("policyVersion", "sys_hris_ai_evaluation_requests.policy_version"),
            ("evaluationReceiptId", "sys_hris_ai_evaluation_receipts.public_id"),
            ("evaluationOutcome", "sys_hris_ai_evaluation_receipts.evaluation_outcome"),
            ("blockingFailureCount", "sys_hris_ai_evaluation_receipts.blocking_failure_count"),
            ("resultDigest", "sys_hris_ai_evaluation_receipts.result_digest"),
        ],
        "policy": {"refetchAllowed": False, "ownerRefetchEndpoint": None,
                   "allowedConsumerSessions": ["HRIS-SYS"], "purposeCodes": ["hcm.ai.policy.manage"],
                   "pep": "SAME_BOUNDED_CONTEXT_EVENT_PEP_V1"},
        "idempotency": {"key": "evaluationOwnerResultId", "scope": "tenantId+evaluationRequestId",
                        "duplicateResult": "RETURN_EXISTING_EVALUATION_RECEIPT_WITHOUT_REAPPLYING_POLICY_STATE"},
        "ownerAssertions": [
            "evaluation request is REQUESTED and owner result matches request/policy version digests",
            "blocking failure count and result digest are produced by the registered evaluation owner",
            "policy becomes EVALUATED only for PASSED; FAILED remains non-publishable",
        ],
        "additionalCas": {"table": "sys_hris_ai_use_policies", "preStates": ["DRAFT", "EVALUATED"],
                          "postStateByOutcome": {"PASSED": "EVALUATED", "FAILED": "DRAFT"}},
        "orderedTransactionSteps": [
            "lock tenant-bound evaluation request by public_id and require REQUESTED",
            "verify owner result, policy version, suite version and request digest",
            "append one AI evaluation receipt with PASSED or FAILED outcome",
            "CAS policy lifecycle from the verified outcome; failed result cannot publish",
            "CAS evaluation request REQUESTED->COMPLETED and increment aggregate_version",
            "append GovernedAiPolicyEvaluationCompleted.v2 from committed receipt/root rows",
            "commit inbox, receipt, policy, request and outbox atomically",
        ],
        "failureSemantics": "ANY_STEP_FAILURE_ROLLS_BACK_RECEIPT_POLICY_ROOT_OUTBOX_AND_INBOX; RETRY_IS_IDEMPOTENT",
        "reconcile": "REQUESTED remains recoverable; conflicting owner results are quarantined",
    },
}


# Handler DML is authored explicitly rather than inferred from event fields.
# This is the async equivalent of command field lineage: every created/result
# row has a source, while existing roots update only state/version/ack facts.
INTERNAL_HANDLER_WRITE_ASSIGNMENTS: dict[str, dict[str, dict[str, str]]] = {
    "internal.recruiting.hire-handoff.acknowledge": {
        "ppl_rec_hire_handoff_receipts": {
            "tenant_id": "ownerContext.tenantId",
            "created_by": "ownerContext.principalPublicId",
            "correlation_id": "handlerContext.causationCorrelationId",
            "candidate_case_id": "ppl_rec_hire_requests.candidate_case_id",
            "decision_revision": "ownerRefetch.approvalDecisionRevision",
            "payload_digest": "derived.canonicalHireHandoffPayloadDigest",
            "recorded_at": "ownerClock.transactionNow",
            "worker_public_id": "ownerResult.workerPublicId",
            "offer_id": "ppl_rec_hire_requests.offer_id",
            "effective_date": "ppl_rec_hire_requests.effective_date",
            "employment_public_id": "ownerResult.employmentPublicId",
            "assignment_public_id": "ownerResult.assignmentPublicId",
            "owner_aggregate_version": "ownerResult.workerAggregateVersion",
            "owner_acknowledgement_id": "handlerContext.ownerResultId",
            "aggregate_version": "constant.1",
        },
        "ppl_rec_candidate_cases": {
            "stage": "constant.HIRED",
            "aggregate_version": "derived.candidateExpectedVersionPlusOne",
        },
        "ppl_rec_hire_requests": {
            "status": "constant.ACKNOWLEDGED",
            "acknowledged_at": "ownerClock.transactionNow",
            "owner_acknowledgement_id": "handlerContext.ownerResultId",
            "aggregate_version": "derived.hireRequestExpectedVersionPlusOne",
        },
    },
    "internal.contingent.access-expiry.enforce": {
        "ppl_cwk_access_expiry_receipts": {
            "tenant_id": "ownerContext.tenantId", "created_by": "ownerContext.principalPublicId",
            "correlation_id": "handlerContext.causationCorrelationId",
            "contingent_engagement_id": "ppl_cwk_engagements.contingent_engagement_id",
            "grant_public_id": "ownerResult.grantPublicId",
            "grant_revision": "ownerResult.grantRevision", "outcome": "ownerResult.outcome",
            "payload_digest": "ownerResult.payloadDigest",
            "receipt_digest": "derived.canonicalAccessExpiryReceiptDigest",
            "recorded_at": "ownerClock.transactionNow", "aggregate_version": "constant.1",
        },
        "ppl_cwk_engagements": {
            "status": "constant.OFFBOARDING",
            "aggregate_version": "derived.engagementExpectedVersionPlusOne",
        },
    },
    "internal.wfm.schedule-optimization.complete": {
        "tme_wfm_schedule_candidates": {
            "tenant_id": "ownerContext.tenantId", "created_by": "ownerContext.principalPublicId",
            "correlation_id": "handlerContext.causationCorrelationId",
            "availability_snapshot_id": "tme_wfm_optimization_requests.availability_snapshot_id",
            "candidate_digest": "derived.recomputedCandidateDigest",
            "candidate_revision": "derived.nextCandidateRevisionUnderForecastLock",
            "demand_forecast_id": "tme_wfm_optimization_requests.demand_forecast_id",
            "period_end": "tme_wfm_optimization_requests.period_end",
            "period_start": "tme_wfm_optimization_requests.period_start",
            "status": "constant.CANDIDATE_GENERATED", "aggregate_version": "constant.1",
        },
        "tme_wfm_candidate_shift_lines": {
            "tenant_id": "ownerContext.tenantId", "created_by": "ownerContext.principalPublicId",
            "correlation_id": "handlerContext.causationCorrelationId",
            "schedule_candidate_id": "tme_wfm_schedule_candidates.schedule_candidate_id",
            "line_sequence": "derived.ownerShiftResultArrayIndexPlusOne",
            "worker_public_id": "ownerResult.shiftLines[].workerPublicId",
            "assignment_public_id": "ownerResult.shiftLines[].assignmentPublicId",
            "shift_start": "ownerResult.shiftLines[].shiftStart",
            "shift_end": "ownerResult.shiftLines[].shiftEnd",
            "worksite_public_id": "ownerResult.shiftLines[].worksitePublicId",
            "position_public_id": "ownerResult.shiftLines[].positionPublicId",
            "line_digest": "derived.recomputedShiftLineDigest", "aggregate_version": "constant.1",
        },
        "tme_wfm_constraint_evaluation_receipts": {
            "tenant_id": "ownerContext.tenantId", "created_by": "ownerContext.principalPublicId",
            "correlation_id": "handlerContext.causationCorrelationId",
            "blocking_violation_count": "derived.countBlockingConstraintViolations",
            "evaluated_at": "ownerClock.transactionNow", "evaluation_revision": "constant.1",
            "fairness_metric_count": "derived.countFairnessMeasures",
            "payload_digest": "derived.recomputedConstraintPayloadDigest",
            "policy_version_id": "ownerResult.constraintPolicyVersionId",
            "result_digest": "derived.recomputedConstraintResultDigest",
            "schedule_candidate_id": "tme_wfm_schedule_candidates.schedule_candidate_id",
            "aggregate_version": "constant.1",
        },
        "tme_wfm_constraint_violation_lines": {
            "tenant_id": "ownerContext.tenantId", "created_by": "ownerContext.principalPublicId",
            "correlation_id": "handlerContext.causationCorrelationId",
            "constraint_evaluation_receipt_id": "tme_wfm_constraint_evaluation_receipts.constraint_evaluation_receipt_id",
            "line_sequence": "derived.ownerViolationArrayIndexPlusOne",
            "constraint_code": "ownerResult.constraintViolations[].constraintCode",
            "severity": "ownerResult.constraintViolations[].severity",
            "subject_reference_digest": "derived.tokenizedViolationSubjectDigest",
            "result_digest": "derived.recomputedViolationLineDigest", "aggregate_version": "constant.1",
        },
        "tme_wfm_fairness_measure_values": {
            "tenant_id": "ownerContext.tenantId", "created_by": "ownerContext.principalPublicId",
            "correlation_id": "handlerContext.causationCorrelationId",
            "constraint_evaluation_receipt_id": "tme_wfm_constraint_evaluation_receipts.constraint_evaluation_receipt_id",
            "line_sequence": "derived.ownerFairnessArrayIndexPlusOne",
            "metric_code": "ownerResult.fairnessMeasures[].metricCode",
            "cohort_digest": "derived.tokenizedCohortDigest",
            "measured_value": "ownerResult.fairnessMeasures[].measuredValue",
            "outcome": "ownerResult.fairnessMeasures[].outcome",
            "result_digest": "derived.recomputedFairnessLineDigest", "aggregate_version": "constant.1",
        },
        "tme_wfm_optimization_requests": {
            "status": "constant.COMPLETED",
            "aggregate_version": "derived.optimizationRequestExpectedVersionPlusOne",
        },
    },
    "internal.ai.policy-evaluation.complete": {
        "sys_hris_ai_evaluation_receipts": {
            "tenant_id": "ownerContext.tenantId", "created_by": "ownerContext.principalPublicId",
            "correlation_id": "handlerContext.causationCorrelationId",
            "ai_policy_version_id": "ownerRefetch.aiPolicyVersionInternalId",
            "blocking_failure_count": "ownerResult.blockingFailureCount",
            "evaluated_at": "ownerClock.transactionNow", "evaluation_revision": "constant.1",
            "evaluation_suite_version_id": "ownerResult.evaluationSuiteVersionId",
            "payload_digest": "derived.recomputedEvaluationPayloadDigest",
            "result_digest": "derived.recomputedEvaluationResultDigest",
            "ai_evaluation_request_id": "sys_hris_ai_evaluation_requests.ai_evaluation_request_id",
            "evaluation_outcome": "ownerResult.evaluationOutcome", "aggregate_version": "constant.1",
        },
        "sys_hris_ai_use_policies": {
            "status": "derived.policyStateFromVerifiedEvaluationOutcome",
            "aggregate_version": "derived.policyExpectedVersionPlusOne",
        },
        "sys_hris_ai_evaluation_requests": {
            "status": "constant.COMPLETED",
            "aggregate_version": "derived.evaluationRequestExpectedVersionPlusOne",
        },
    },
}


INTERNAL_HANDLER_ROW_COUNTS: dict[tuple[str, str], str] = {
    ("internal.wfm.schedule-optimization.complete", "tme_wfm_candidate_shift_lines"):
        "EXACTLY_ownerResult.shiftLines.length_BETWEEN_1_AND_100000",
    ("internal.wfm.schedule-optimization.complete", "tme_wfm_constraint_violation_lines"):
        "EXACTLY_ownerResult.constraintViolations.length_BETWEEN_0_AND_100000",
    ("internal.wfm.schedule-optimization.complete", "tme_wfm_fairness_measure_values"):
        "EXACTLY_ownerResult.fairnessMeasures.length_BETWEEN_0_AND_100000",
}


EVENT_REQUIRED_OVERRIDES = {
    ("modern.recruiting.hire.record", "offerId"),
    ("modern.recruiting.hire.record", "effectiveDate"),
    ("modern.recruiting.hire.record", "humanDecisionReceiptId"),
    ("modern.compplan.proposal.submit", "submissionDigest"),
    ("modern.compplan.proposal.submit", "submittedAt"),
    ("modern.growth.profile.update", "artifactPublicId"),
    ("modern.growth.profile.update", "artifactRevision"),
}


STATE_COLUMN_OVERRIDES = {
    "modern.recruiting.candidate.stage": "stage",
    "modern.recruiting.offer.issue": "stage",
    "modern.recruiting.hire.record": "stage",
}


EXPECTED_VERSION_TARGETS = {
    # These commands create an asynchronous request root while locking the
    # parent aggregate version named in the path.
    "modern.wfm.schedule.optimize": "tme_wfm_demand_forecasts.aggregate_version",
    "modern.ai.policy.evaluate": "sys_hris_ai_use_policies.aggregate_version",
}


RECEIPT_DECISION_COLUMNS = {
    "HRIS-HRM": {"table": "ppl_command_receipts", "digest": "request_hash",
                 "outcome": "lifecycle_state", "decisionVersion": "field_policy_revision"},
    "HRIS-PER": {"table": "prf_command_receipts", "digest": "request_hash",
                 "outcome": "receipt_state", "decisionVersion": "field_policy_revision"},
    "HRIS-TIM": {"table": "tme_command_receipts", "digest": "request_digest",
                 "outcome": "status", "decisionVersion": "field_policy_revision"},
    "HRIS-SYS": {"table": "sys_hris_command_receipts", "digest": "request_digest",
                 "outcome": "status", "decisionVersion": "field_policy_revision"},
}


COMMAND_TRANSACTION_INFRA = {
    "HRIS-HRM": {"receiptTable": "ppl_command_receipts",
                 "idempotencyColumn": "idempotency_key", "digestColumn": "request_hash",
                 "statusColumn": "lifecycle_state", "outboxTable": "sys_people_outbox_events"},
    "HRIS-PER": {"receiptTable": "prf_command_receipts",
                 "idempotencyColumn": "idempotency_key", "digestColumn": "request_hash",
                 "statusColumn": "receipt_state", "outboxTable": "prf_outbox_events"},
    "HRIS-TIM": {"receiptTable": "tme_command_receipts",
                 "idempotencyColumn": "idempotency_key", "digestColumn": "request_digest",
                 "statusColumn": "status", "outboxTable": "tme_outbox_events"},
    "HRIS-SYS": {"receiptTable": "sys_hris_command_receipts",
                 "idempotencyColumn": "idempotency_key", "digestColumn": "request_digest",
                 "statusColumn": "status", "outboxTable": "sys_domain_event_outbox"},
}


def state_column_for(table: dict[str, Any], operation_id: str | None = None) -> str:
    names = {column["name"] for column in table["columns"]}
    override = STATE_COLUMN_OVERRIDES.get(operation_id or "")
    # An operation can emit from a distinct same-transaction event aggregate
    # (hire request / approved plan / snapshot).  The operation override only
    # applies to a table that actually owns that named state column.
    if override and override in names:
        return override
    for name in ("status", "state", "stage"):
        if name in names:
            return name
    raise ValueError(f"aggregate root has no physical state column: {table['tableName']}")


EVENT_TYPES: dict[str, str] = {
    "modern.recruiting.requisition.create": "RequisitionCreated",
    "modern.recruiting.requisition.publish": "RequisitionPublished",
    "modern.recruiting.candidate.stage": "CandidateStageChanged",
    "modern.recruiting.offer.issue": "CandidateOfferIssued",
    "modern.recruiting.hire.record": "CandidateHireHandoffRequested",
    "modern.onboarding.template.create": "OnboardingTemplateCreated",
    "modern.onboarding.template.publish": "OnboardingTemplatePublished",
    "modern.onboarding.journey.assign": "OnboardingJourneyAssigned",
    "modern.onboarding.task.complete": "OnboardingTaskCompleted",
    "modern.onboarding.journey.cancel": "OnboardingJourneyCancelled",
    "modern.workforceplan.scenario.create": "WorkforceScenarioCreated",
    "modern.workforceplan.scenario.simulate": "WorkforceScenarioSimulated",
    "modern.workforceplan.scenario.submit": "WorkforceScenarioSubmitted",
    "modern.workforceplan.scenario.approve": "WorkforceScenarioDecisionRecorded",
    "modern.workforceplan.scenario.publish": "WorkforceScenarioPublished",
    "modern.benefits.plan.create": "BenefitPlanCreated",
    "modern.benefits.plan.publish": "BenefitPlanPublished",
    "modern.benefits.enrollment.submit": "BenefitEnrollmentSubmitted",
    "modern.benefits.lifeevent.submit": "BenefitLifeEventSubmitted",
    "modern.benefits.enrollment.decide": "BenefitEnrollmentDecided",
    "modern.hrservice.case.create": "HrServiceCaseCreated",
    "modern.hrservice.case.triage": "HrServiceCaseTriaged",
    "modern.hrservice.case.assign": "HrServiceCaseAssigned",
    "modern.hrservice.case.respond": "HrServiceCaseResponseRecorded",
    "modern.hrservice.case.resolve": "HrServiceCaseResolved",
    "modern.contingent.engagement.create": "ContingentEngagementCreated",
    "modern.contingent.engagement.submit": "ContingentEngagementSubmitted",
    "modern.contingent.engagement.activate": "ContingentEngagementActivated",
    "modern.contingent.engagement.offboard": "ContingentEngagementOffboardingStarted",
    "modern.contingent.engagement.close": "ContingentEngagementClosed",
    "modern.skills.taxonomy.create": "SkillsTaxonomyCreated",
    "modern.skills.taxonomy.validate": "SkillsTaxonomyValidated",
    "modern.skills.taxonomy.publish": "SkillsTaxonomyPublished",
    "modern.skills.evidence.verify": "WorkerSkillEvidenceVerified",
    "modern.growth.profile.create": "GrowthProfileCreated",
    "modern.growth.profile.update": "GrowthProfileUpdated",
    "modern.growth.evidence.link": "GrowthEvidenceLinked",
    "modern.growth.coaching.record": "GrowthCoachingRecorded",
    "modern.growth.profile.archive": "GrowthProfileArchived",
    "modern.learning.offering.create": "LearningOfferingCreated",
    "modern.learning.offering.publish": "LearningOfferingPublished",
    "modern.learning.self.enroll": "LearningEnrollmentCreated",
    "modern.learning.assignment.start": "LearningAssignmentStarted",
    "modern.learning.completion.verify": "LearningCompletionVerified",
    "modern.opportunity.create": "TalentOpportunityCreated",
    "modern.opportunity.publish": "TalentOpportunityPublished",
    "modern.opportunity.apply": "TalentOpportunityApplicationSubmitted",
    "modern.opportunity.shortlist": "TalentOpportunityApplicationShortlisted",
    "modern.opportunity.selection.record": "TalentOpportunitySelectionRecorded",
    "modern.succession.plan.create": "SuccessionPlanCreated",
    "modern.succession.nomination.add": "SuccessionNominationAdded",
    "modern.succession.plan.submit": "SuccessionPlanSubmitted",
    "modern.succession.plan.approve": "SuccessionPlanApproved",
    "modern.succession.plan.publish": "SuccessionPlanPublished",
    "modern.compplan.cycle.create": "CompensationCycleCreated",
    "modern.compplan.budget.allocate": "CompensationBudgetAllocated",
    "modern.compplan.proposal.submit": "CompensationProposalSubmitted",
    "modern.compplan.plan.approve": "CompensationPlanApprovalRecorded",
    "modern.compplan.snapshot.publish": "ApprovedCompensationPlanSnapshotPublished",
    "modern.wfm.forecast.create": "WorkforceDemandForecastCreated",
    "modern.wfm.schedule.optimize": "WorkforceScheduleOptimizationRequested",
    "modern.wfm.schedule.validate": "WorkforceScheduleValidationCompleted",
    "modern.wfm.schedule.submit": "WorkforceScheduleCandidateSubmitted",
    "modern.wfm.schedule.publish": "WorkforceSchedulePublished",
    "modern.listening.response.submit": "EmployeeListeningResponseSubmitted",
    "modern.listening.survey.create": "EmployeeListeningSurveyCreated",
    "modern.listening.survey.publish": "EmployeeListeningSurveyPublished",
    "modern.listening.survey.close": "EmployeeListeningSurveyClosed",
    "modern.listening.action.create": "EmployeeListeningActionCreated",
    "modern.listening.action.complete": "EmployeeListeningActionCompleted",
    "modern.analytics.metric.create": "PeopleMetricCreated",
    "modern.analytics.metric.validate": "PeopleMetricValidated",
    "modern.analytics.metric.publish": "PeopleMetricPublished",
    "modern.analytics.export.create": "PeopleAnalyticsExportRequested",
    "modern.analytics.metric.retire": "PeopleMetricRetired",
    "modern.ai.assist.create": "GovernedAiAssistanceProduced",
    "modern.ai.policy.create": "GovernedAiPolicyCreated",
    "modern.ai.policy.evaluate": "GovernedAiPolicyEvaluationRequested",
    "modern.ai.policy.publish": "GovernedAiPolicyPublished",
    "modern.ai.kill.switch": "GovernedAiPolicySuspended",
    "modern.ai.policy.retire": "GovernedAiPolicyRetired",
}


def event_type(operation_id: str) -> str:
    return EVENT_TYPES[operation_id]


def event_name(operation_id: str) -> str:
    return event_type(operation_id) + ".v2"


def event_topic(operation_id: str) -> str:
    fact = event_type(operation_id)
    kebab = re.sub(r"(?<!^)(?=[A-Z])", "-", fact).lower()
    return f"dwp.hris.modern.{kebab}.v2"


def expanded_request_fields(operation: dict[str, Any],
                            schemas: dict[str, dict[str, Any]]) -> dict[str, dict[str, Any]]:
    """Return top-level and closed nested request members with exact wire paths.

    OBJECT/ARRAY containers remain inputs in their own right, while their
    closed value-object members are materialized as ``body.x.y`` or
    ``body.x[].y``.  This prevents an opaque object label from concealing
    request fields that never reach a persisted fact or policy decision.
    """
    rows: dict[str, dict[str, Any]] = {}
    for section in ("pathParameters", "queryParameters", "headers", "body"):
        for field in operation["requestSchema"][section]:
            source = f"{section}.{field['name']}"
            rows[source] = field
            schema_ref = field.get("schemaRef") or field.get("itemSchemaRef")
            if not schema_ref:
                continue
            if schema_ref not in schemas:
                raise ValueError(
                    f"request value-object schema missing: {operation['operationId']} {source} {schema_ref}"
                )
            member_prefix = source + ("[]" if field.get("itemSchemaRef") else "")
            for member in schemas[schema_ref]["fields"]:
                nested = copy.deepcopy(member)
                # A member cannot be required when its containing object is
                # optional.  Required array item members are still mandatory
                # for every item when the array is present.
                nested["required"] = bool(field.get("required") and member.get("required"))
                nested["containerSource"] = source
                nested["schemaRef"] = schema_ref
                rows[f"{member_prefix}.{member['name']}"] = nested
    return rows


def apply_exact_source_successor(doc: dict[str, Any], events: dict[str, Any]) -> None:
    """Normalize physical defaults, operation ownership and event vocabulary."""
    tables = {table["tableName"]: table for table in doc["tableSpecifications"]}
    for table_name, (initial, allowed) in STATE_TABLE_CORRECTIONS.items():
        table = tables[table_name]
        column = next(column for column in table["columns"] if column["name"] == "status")
        column["default"] = repr(initial)
        checks = [check for check in table["checks"] if "status" not in check.get("columns", [])]
        checks.append({
            "constraintId": f"ck_{table_name}_causal_status_v2",
            "expression": "status IN (" + ",".join(repr(item) for item in allowed) + ")",
            "columns": ["status"],
        })
        table["checks"] = checks
    for table_name, (initial, allowed) in NEW_STATE_COLUMNS.items():
        table = tables[table_name]
        existing = next((column for column in table["columns"] if column["name"] == "status"), None)
        row = {
            "name": "status", "sqlType": "VARCHAR(40)", "nullable": False,
            "default": repr(initial), "sensitivity": "INTERNAL",
            "tokenization": "NONE", "source": "CAUSAL_AGGREGATE_STATE_V2",
        }
        if existing is None:
            table["columns"].append(row)
        else:
            existing.update(row)
        table["checks"] = [check for check in table["checks"] if "status" not in check.get("columns", [])]
        table["checks"].append({
            "constraintId": f"ck_{table_name}_causal_status_v2",
            "expression": "status IN (" + ",".join(repr(item) for item in allowed) + ")",
            "columns": ["status"],
        })
    forecast = tables["tme_wfm_demand_forecasts"]
    forecast["checks"] = [check for check in forecast["checks"] if "status" not in check.get("columns", [])]
    forecast["checks"].append({
        "constraintId": "ck_tme_wfm_demand_forecasts_causal_status_v2",
        "expression": "status IN ('DRAFT','SUPERSEDED')", "columns": ["status"],
    })
    for table_name, column_name in NULLABLE_COLUMN_CORRECTIONS:
        column = next(column for column in tables[table_name]["columns"] if column["name"] == column_name)
        column["nullable"] = True

    def ensure_column(table_name: str, column: dict[str, Any]) -> None:
        column = copy.deepcopy(column)
        column.setdefault("default", None)
        existing = next((row for row in tables[table_name]["columns"]
                         if row["name"] == column["name"]), None)
        if existing is None:
            tables[table_name]["columns"].append(column)
        else:
            existing.update(column)

    def business_column(name: str, sql_type: str, *, nullable: bool = False,
                        default: Any = None, sensitivity: str = "INTERNAL",
                        tokenization: str = "NONE",
                        reference: dict[str, str] | None = None) -> dict[str, Any]:
        column: dict[str, Any] = {
            "name": name, "sqlType": sql_type, "nullable": nullable, "default": default,
            "sensitivity": sensitivity, "tokenization": tokenization,
            "source": "CAUSAL_SUCCESSOR_BUSINESS_COLUMN_V2",
        }
        if reference:
            column["referenceContract"] = reference
        return column

    def ensure_table(table: dict[str, Any]) -> None:
        existing = next((row for row in doc["tableSpecifications"]
                         if row["tableName"] == table["tableName"]), None)
        if existing is None:
            doc["tableSpecifications"].append(copy.deepcopy(table))
            tables[table["tableName"]] = doc["tableSpecifications"][-1]
        else:
            existing.update(copy.deepcopy(table))

    def ensure_record_schema(schema: dict[str, Any]) -> None:
        existing = next((row for row in doc["recordSchemas"]
                         if row["schemaId"] == schema["schemaId"]), None)
        if existing is None:
            doc["recordSchemas"].append(copy.deepcopy(schema))
        else:
            existing.clear()
            existing.update(copy.deepcopy(schema))

    def ensure_fk(table_name: str, foreign_key: dict[str, Any]) -> None:
        """Install one reviewed physical reference without duplicate aliases."""
        rows = tables[table_name]["foreignKeys"]
        constraint_id = foreign_key["constraintId"]
        existing = next((row for row in rows
                         if row.get("constraintId") == constraint_id), None)
        if existing is None:
            rows.append(copy.deepcopy(foreign_key))
        else:
            existing.clear()
            existing.update(copy.deepcopy(foreign_key))

    # Versioned definitions are the lifecycle roots.  Identity/catalog parent
    # rows do not impersonate a draft/publish state machine.
    ensure_table({
        "capabilityId": "HRIS.MODERN.ONBOARDING", "session": "HRIS-HRM",
        "tableName": "ppl_jny_template_versions", "kind": "VERSIONED_DEFINITION_ROOT",
        "idColumn": {"name": "journey_template_version_id", "sqlType": "BIGINT",
                     "nullable": False, "default": "IDENTITY", "exposure": "INTERNAL_ONLY"},
        "commonColumnsRef": "DWP_MODERN_TENANT_TABLE_V1",
        "columns": [
            business_column("journey_template_id", "BIGINT", reference={"entityType": "table:ppl_jny_templates", "idSpace": "INTERNAL_BIGINT"}),
            business_column("version_no", "BIGINT"),
            business_column("effective_from", "DATE"),
            business_column("effective_to", "DATE", nullable=True),
            business_column("task_manifest_digest", "CHAR(64)", tokenization="NONREVERSIBLE_DIGEST"),
            business_column("task_count", "INTEGER", default="0"),
            business_column("status", "VARCHAR(40)", default="'DRAFT'"),
        ],
        "foreignKeys": [{"mode": "LOCAL_COMPOSITE_FK", "columns": ["tenant_id", "journey_template_id"],
                         "target": "ppl_jny_templates", "targetColumns": ["tenant_id", "journey_template_id"],
                         "constraintId": "fk_ppl_jny_template_versions_template_v2"}],
        "uniqueKeys": [
            {"constraintId": "uk_ppl_jny_template_versions_parent_version_v2", "columns": ["tenant_id", "journey_template_id", "version_no"]},
            {"constraintId": "uk_ppl_jny_template_versions_tenant_internal_v2", "columns": ["tenant_id", "journey_template_version_id"]},
            {"constraintId": "uk_ppl_jny_template_versions_public_v2", "columns": ["tenant_id", "public_id"]},
        ],
        "checks": [
            {"constraintId": "ck_ppl_jny_template_versions_version_v2", "expression": "version_no > 0", "columns": ["version_no"]},
            {"constraintId": "ck_ppl_jny_template_versions_task_count_v2", "expression": "task_count >= 0", "columns": ["task_count"]},
            {"constraintId": "ck_ppl_jny_template_versions_status_v2", "expression": "status IN ('DRAFT','PUBLISHED','RETIRED')", "columns": ["status"]},
        ],
        "indexes": [{"indexId": "idx_ppl_jny_template_versions_status_v2", "columns": ["tenant_id", "journey_template_id", "status"]}],
        "rowSecurity": "ENABLE_FORCE_DWP_TENANT_BIGINT_NOBYPASSRLS",
        "retentionPolicyRef": "JOURNEY_TEMPLATE_RETENTION_POLICY_REF",
        "immutability": "VERSION_CONTENT_IMMUTABLE_STATEFUL_LIFECYCLE",
        "effectiveTime": "effective_from DATE NOT NULL; effective_to DATE NULL",
    })
    ensure_table({
        "capabilityId": "HRIS.MODERN.ONBOARDING", "session": "HRIS-HRM",
        "tableName": "ppl_jny_assignment_tasks", "kind": "ASSIGNMENT_TASK_ROOT",
        "idColumn": {"name": "journey_assignment_task_id", "sqlType": "BIGINT",
                     "nullable": False, "default": "IDENTITY", "exposure": "INTERNAL_ONLY"},
        "commonColumnsRef": "DWP_MODERN_TENANT_TABLE_V1",
        "columns": [
            business_column("journey_assignment_id", "BIGINT", reference={"entityType": "table:ppl_jny_assignments", "idSpace": "INTERNAL_BIGINT"}),
            business_column("task_key", "VARCHAR(160)"),
            business_column("task_order", "INTEGER"),
            business_column("required_flag", "BOOLEAN", default="TRUE"),
            business_column("due_at", "TIMESTAMPTZ", nullable=True),
            business_column("completed_at", "TIMESTAMPTZ", nullable=True),
            business_column("status", "VARCHAR(40)", default="'PENDING'"),
        ],
        "foreignKeys": [{"mode": "LOCAL_COMPOSITE_FK", "columns": ["tenant_id", "journey_assignment_id"],
                         "target": "ppl_jny_assignments", "targetColumns": ["tenant_id", "journey_assignment_id"],
                         "constraintId": "fk_ppl_jny_assignment_tasks_assignment_v2"}],
        "uniqueKeys": [
            {"constraintId": "uk_ppl_jny_assignment_tasks_key_v2", "columns": ["tenant_id", "journey_assignment_id", "task_key"]},
            {"constraintId": "uk_ppl_jny_assignment_tasks_tenant_internal_v2", "columns": ["tenant_id", "journey_assignment_task_id"]},
            {"constraintId": "uk_ppl_jny_assignment_tasks_public_v2", "columns": ["tenant_id", "public_id"]},
        ],
        "checks": [
            {"constraintId": "ck_ppl_jny_assignment_tasks_order_v2", "expression": "task_order > 0", "columns": ["task_order"]},
            {"constraintId": "ck_ppl_jny_assignment_tasks_status_v2", "expression": "status IN ('PENDING','COMPLETED','CANCELLED')", "columns": ["status"]},
        ],
        "indexes": [{"indexId": "idx_ppl_jny_assignment_tasks_status_v2", "columns": ["tenant_id", "journey_assignment_id", "status"]}],
        "rowSecurity": "ENABLE_FORCE_DWP_TENANT_BIGINT_NOBYPASSRLS",
        "retentionPolicyRef": "ONBOARDING_ASSIGNMENT_RETENTION_POLICY_REF",
        "immutability": "STATEFUL_ASSIGNMENT_TASK",
        "effectiveTime": "due_at TIMESTAMPTZ NULL; completed_at TIMESTAMPTZ NULL",
    })
    ensure_table({
        "capabilityId": "HRIS.MODERN.BENEFITS_ADMIN", "session": "HRIS-HRM",
        "tableName": "ppl_bnf_plan_versions", "kind": "VERSIONED_DEFINITION_ROOT",
        "idColumn": {"name": "benefit_plan_version_id", "sqlType": "BIGINT",
                     "nullable": False, "default": "IDENTITY", "exposure": "INTERNAL_ONLY"},
        "commonColumnsRef": "DWP_MODERN_TENANT_TABLE_V1",
        "columns": [
            business_column("benefit_plan_id", "BIGINT", reference={"entityType": "table:ppl_bnf_plans", "idSpace": "INTERNAL_BIGINT"}),
            business_column("version_no", "BIGINT"),
            business_column("eligibility_policy_version_id", "UUID", sensitivity="RESTRICTED", tokenization="OPAQUE_PUBLIC_ID", reference={"entityType": "SYS.Config", "idSpace": "PUBLIC_UUID"}),
            business_column("effective_from", "DATE"),
            business_column("effective_to", "DATE", nullable=True),
            business_column("content_digest", "CHAR(64)", tokenization="NONREVERSIBLE_DIGEST"),
            business_column("status", "VARCHAR(40)", default="'DRAFT'"),
        ],
        "foreignKeys": [
            {"mode": "LOCAL_COMPOSITE_FK", "columns": ["tenant_id", "benefit_plan_id"],
             "target": "ppl_bnf_plans", "targetColumns": ["tenant_id", "benefit_plan_id"],
             "constraintId": "fk_ppl_bnf_plan_versions_plan_v2"},
            {"mode": "OPAQUE_CROSS_BOUNDARY_REFERENCE", "columns": ["eligibility_policy_version_id"],
             "target": "SYS.Config", "constraintId": "fk_ppl_bnf_plan_versions_policy_v2"},
        ],
        "uniqueKeys": [
            {"constraintId": "uk_ppl_bnf_plan_versions_parent_version_v2", "columns": ["tenant_id", "benefit_plan_id", "version_no"]},
            {"constraintId": "uk_ppl_bnf_plan_versions_tenant_internal_v2", "columns": ["tenant_id", "benefit_plan_version_id"]},
            {"constraintId": "uk_ppl_bnf_plan_versions_public_v2", "columns": ["tenant_id", "public_id"]},
        ],
        "checks": [
            {"constraintId": "ck_ppl_bnf_plan_versions_version_v2", "expression": "version_no > 0", "columns": ["version_no"]},
            {"constraintId": "ck_ppl_bnf_plan_versions_status_v2", "expression": "status IN ('DRAFT','PUBLISHED','RETIRED')", "columns": ["status"]},
        ],
        "indexes": [{"indexId": "idx_ppl_bnf_plan_versions_status_v2", "columns": ["tenant_id", "benefit_plan_id", "status"]}],
        "rowSecurity": "ENABLE_FORCE_DWP_TENANT_BIGINT_NOBYPASSRLS",
        "retentionPolicyRef": "BENEFIT_PLAN_RETENTION_POLICY_REF",
        "immutability": "VERSION_CONTENT_IMMUTABLE_STATEFUL_LIFECYCLE",
        "effectiveTime": "effective_from DATE NOT NULL; effective_to DATE NULL",
    })

    ensure_table({
        "capabilityId": "HRIS.MODERN.GROWTH_PROFILE", "session": "HRIS-PER",
        "tableName": "prf_grw_profile_revisions", "kind": "IMMUTABLE_PROFILE_REVISION",
        "idColumn": {"name": "growth_profile_revision_id", "sqlType": "BIGINT",
                     "nullable": False, "default": "IDENTITY", "exposure": "INTERNAL_ONLY"},
        "commonColumnsRef": "DWP_MODERN_TENANT_TABLE_V1",
        "columns": [
            business_column("growth_profile_id", "BIGINT", reference={"entityType": "table:prf_grw_profiles", "idSpace": "INTERNAL_BIGINT"}),
            business_column("profile_revision", "BIGINT"),
            business_column("artifact_public_id", "UUID", sensitivity="RESTRICTED", tokenization="OPAQUE_PUBLIC_ID", reference={"entityType": "PER.GrowthProfileArtifact", "idSpace": "PUBLIC_UUID"}),
            business_column("artifact_revision", "BIGINT"),
            business_column("visibility", "VARCHAR(40)"),
            business_column("evidence_refs", "UUID[]", nullable=True, sensitivity="RESTRICTED", tokenization="OPAQUE_PUBLIC_ID", reference={"entityType": "SkillsOrLearning", "idSpace": "PUBLIC_UUID"}),
            business_column("content_digest", "CHAR(64)", tokenization="NONREVERSIBLE_DIGEST"),
            business_column("recorded_at", "TIMESTAMPTZ", default="CURRENT_TIMESTAMP"),
        ],
        "foreignKeys": [
            {"mode": "LOCAL_COMPOSITE_FK", "columns": ["tenant_id", "growth_profile_id"],
             "target": "prf_grw_profiles", "targetColumns": ["tenant_id", "growth_profile_id"],
             "constraintId": "fk_prf_grw_profile_revisions_profile_v2"},
            {"mode": "OPAQUE_CROSS_BOUNDARY_REFERENCE", "columns": ["artifact_public_id"],
             "target": "PER.GrowthProfileArtifact", "constraintId": "fk_prf_grw_profile_revisions_artifact_v2"},
        ],
        "uniqueKeys": [
            {"constraintId": "uk_prf_grw_profile_revisions_revision_v2", "columns": ["tenant_id", "growth_profile_id", "profile_revision"]},
            {"constraintId": "uk_prf_grw_profile_revisions_public_v2", "columns": ["tenant_id", "public_id"]},
        ],
        "checks": [
            {"constraintId": "ck_prf_grw_profile_revisions_revision_v2", "expression": "profile_revision > 0", "columns": ["profile_revision"]},
            {"constraintId": "ck_prf_grw_profile_revisions_artifact_revision_v2", "expression": "artifact_revision > 0", "columns": ["artifact_revision"]},
        ],
        "indexes": [{"indexId": "idx_prf_grw_profile_revisions_profile_v2", "columns": ["tenant_id", "growth_profile_id", "profile_revision"]}],
        "rowSecurity": "ENABLE_FORCE_DWP_TENANT_BIGINT_NOBYPASSRLS",
        "retentionPolicyRef": "GROWTH_PROFILE_RETENTION_POLICY_REF",
        "immutability": "APPEND_ONLY_NO_UPDATE_DELETE",
        "effectiveTime": "recorded_at TIMESTAMPTZ NOT NULL",
    })

    # Approval creates a distinct immutable plan header.  The cycle remains
    # the concurrency root, but planId is never an alias of cycleId and later
    # snapshot publication must resolve this exact tenant-bound plan.
    ensure_table({
        "capabilityId": "HRIS.MODERN.COMPENSATION_PLANNING", "session": "HRIS-PER",
        "tableName": "prf_cmp_plans", "kind": "IMMUTABLE_APPROVED_PLAN_HEADER",
        "idColumn": {"name": "compensation_plan_id", "sqlType": "BIGINT",
                     "nullable": False, "default": "IDENTITY", "exposure": "INTERNAL_ONLY"},
        "commonColumnsRef": "DWP_MODERN_TENANT_TABLE_V1",
        "columns": [
            business_column("compensation_cycle_id", "BIGINT", reference={"entityType": "table:prf_cmp_cycles", "idSpace": "INTERNAL_BIGINT"}),
            business_column("cycle_public_id", "UUID", sensitivity="INTERNAL", tokenization="OPAQUE_PUBLIC_ID", reference={"entityType": "table:prf_cmp_cycles", "idSpace": "PUBLIC_UUID"}),
            business_column("approval_receipt_public_id", "UUID", sensitivity="RESTRICTED", tokenization="OPAQUE_PUBLIC_ID", reference={"entityType": "Approval.DecisionReceipt", "idSpace": "PUBLIC_UUID"}),
            business_column("approval_revision", "BIGINT"),
            business_column("approval_outcome", "VARCHAR(40)", default="'APPROVED'"),
            business_column("plan_revision", "BIGINT"),
            business_column("reason_code", "VARCHAR(160)"),
            business_column("content_digest", "CHAR(64)", tokenization="NONREVERSIBLE_DIGEST"),
            business_column("approved_at", "TIMESTAMPTZ", default="CURRENT_TIMESTAMP"),
            business_column("status", "VARCHAR(40)", default="'APPROVED'"),
        ],
        "foreignKeys": [
            {"mode": "LOCAL_COMPOSITE_FK", "columns": ["tenant_id", "compensation_cycle_id"],
             "target": "prf_cmp_cycles", "targetColumns": ["tenant_id", "compensation_cycle_id"],
             "constraintId": "fk_prf_cmp_plans_cycle_v2"},
            {"mode": "LOCAL_COMPOSITE_FK", "columns": ["tenant_id", "cycle_public_id"],
             "target": "prf_cmp_cycles", "targetColumns": ["tenant_id", "public_id"],
             "constraintId": "fk_prf_cmp_plans_cycle_public_v2"},
            {"mode": "OPAQUE_CROSS_BOUNDARY_REFERENCE", "columns": ["approval_receipt_public_id"],
             "target": "Approval.DecisionReceipt", "constraintId": "fk_prf_cmp_plans_approval_v2"},
        ],
        "uniqueKeys": [
            {"constraintId": "uk_prf_cmp_plans_tenant_internal_v2", "columns": ["tenant_id", "compensation_plan_id"]},
            {"constraintId": "uk_prf_cmp_plans_public_v2", "columns": ["tenant_id", "public_id"]},
            {"constraintId": "uk_prf_cmp_plans_cycle_revision_v2", "columns": ["tenant_id", "compensation_cycle_id", "approval_revision"]},
            {"constraintId": "uk_prf_cmp_plans_approval_receipt_v2", "columns": ["tenant_id", "approval_receipt_public_id"]},
        ],
        "checks": [
            {"constraintId": "ck_prf_cmp_plans_revision_v2", "expression": "approval_revision > 0", "columns": ["approval_revision"]},
            {"constraintId": "ck_prf_cmp_plans_plan_revision_v2", "expression": "plan_revision > 0", "columns": ["plan_revision"]},
            {"constraintId": "ck_prf_cmp_plans_outcome_v2", "expression": "approval_outcome = 'APPROVED'", "columns": ["approval_outcome"]},
            {"constraintId": "ck_prf_cmp_plans_digest_v2", "expression": "content_digest ~ '^[0-9a-f]{64}$'", "columns": ["content_digest"]},
            {"constraintId": "ck_prf_cmp_plans_status_v2", "expression": "status IN ('APPROVED','SUPERSEDED')", "columns": ["status"]},
        ],
        "indexes": [{"indexId": "idx_prf_cmp_plans_cycle_status_v2", "columns": ["tenant_id", "compensation_cycle_id", "status"]}],
        "rowSecurity": "ENABLE_FORCE_DWP_TENANT_BIGINT_NOBYPASSRLS",
        "retentionPolicyRef": "PAYROLL_INPUT_RETENTION_POLICY_REF",
        "immutability": "APPEND_ONLY_SUPERSESSION",
        "effectiveTime": "approved_at TIMESTAMPTZ NOT NULL",
    })
    ensure_column("prf_cmp_approved_snapshots", business_column(
        "compensation_plan_id", "BIGINT",
        reference={"entityType": "table:prf_cmp_plans", "idSpace": "INTERNAL_BIGINT"},
    ))
    ensure_column("prf_cmp_approved_snapshots", business_column(
        "approval_revision", "BIGINT",
    ))
    snapshot_table = tables["prf_cmp_approved_snapshots"]
    snapshot_plan_public = next(column for column in snapshot_table["columns"]
                                if column["name"] == "plan_public_id")
    snapshot_plan_public["referenceContract"] = {
        "entityType": "table:prf_cmp_plans", "idSpace": "PUBLIC_UUID",
    }
    if not any(fk.get("constraintId") == "fk_prf_cmp_approved_snapshots_plan_v2"
               for fk in snapshot_table["foreignKeys"]):
        snapshot_table["foreignKeys"].append({
            "mode": "LOCAL_COMPOSITE_FK", "columns": ["tenant_id", "compensation_plan_id"],
            "target": "prf_cmp_plans", "targetColumns": ["tenant_id", "compensation_plan_id"],
            "constraintId": "fk_prf_cmp_approved_snapshots_plan_v2",
        })

    version_state_contracts = {
        "ppl_jny_template_versions": ("DRAFT", ("DRAFT", "PUBLISHED", "RETIRED")),
        "ppl_bnf_plan_versions": ("DRAFT", ("DRAFT", "PUBLISHED", "RETIRED")),
        "prf_skl_taxonomy_versions": ("DRAFT", ("DRAFT", "VALIDATED", "PUBLISHED", "RETIRED")),
        "sys_hris_metric_versions": ("DRAFT", ("DRAFT", "VALIDATED", "PUBLISHED", "RETIRED")),
    }
    for table_name, (initial, allowed) in version_state_contracts.items():
        ensure_column(table_name, {
            "name": "status", "sqlType": "VARCHAR(40)", "nullable": False,
            "default": repr(initial), "sensitivity": "INTERNAL", "tokenization": "NONE",
            "source": "VERSION_ROOT_CAUSAL_STATE_V2",
        })
        table = tables[table_name]
        table["checks"] = [check for check in table["checks"]
                           if "status" not in check.get("columns", [])]
        table["checks"].append({
            "constraintId": f"ck_{table_name}_causal_status_v2",
            "expression": "status IN (" + ",".join(repr(item) for item in allowed) + ")",
            "columns": ["status"],
        })
        internal_id = table["idColumn"]["name"]
        if not any(key.get("columns") == ["tenant_id", internal_id]
                   for key in table["uniqueKeys"]):
            table["uniqueKeys"].append({
                "constraintId": f"uk_{table_name}_tenant_internal_v2",
                "columns": ["tenant_id", internal_id],
            })

    # Public version IDs are resolved to owner-local surrogate keys under the
    # tenant predicate. Cross-boundary UUIDs remain opaque owner references;
    # they are never accepted merely because their SQL shape is UUID.
    ensure_fk("ppl_jny_assignments", {
        "mode": "LOCAL_COMPOSITE_FK",
        "columns": ["tenant_id", "journey_template_version_id"],
        "target": "ppl_jny_template_versions",
        "targetColumns": ["tenant_id", "journey_template_version_id"],
        "constraintId": "fk_ppl_jny_assignments_template_version_v2",
    })
    ensure_fk("ppl_bnf_enrollments", {
        "mode": "LOCAL_COMPOSITE_FK",
        "columns": ["tenant_id", "benefit_plan_version_id"],
        "target": "ppl_bnf_plan_versions",
        "targetColumns": ["tenant_id", "benefit_plan_version_id"],
        "constraintId": "fk_ppl_bnf_enrollments_plan_version_v2",
    })
    for table_name, column_name, target, constraint_id in (
        ("ppl_bnf_plan_versions", "enrollment_window_policy_version_id", "SYS.Config",
         "fk_ppl_bnf_plan_versions_enrollment_window_policy_v2"),
        ("ppl_bnf_plan_versions", "provider_config_version_id", "SYS.ConnectorConfig",
         "fk_ppl_bnf_plan_versions_provider_config_v2"),
        ("ppl_bnf_plan_versions", "approval_receipt_public_id", "Approval.DecisionReceipt",
         "fk_ppl_bnf_plan_versions_approval_receipt_v2"),
        ("ppl_bnf_enrollments", "decision_receipt_public_id", "Approval.DecisionReceipt",
         "fk_ppl_bnf_enrollments_decision_receipt_v2"),
        ("prf_skl_worker_evidence", "verification_receipt_public_id", "Skills.EvidenceVerificationReceipt",
         "fk_prf_skl_worker_evidence_verification_receipt_v2"),
        ("prf_grw_coaching_notes", "artifact_public_id", "Content.ImmutableArtifact",
         "fk_prf_grw_coaching_notes_content_artifact_v2"),
        ("tme_wfm_schedule_publish_ledger", "published_by", "Auth.Principal",
         "fk_tme_wfm_schedule_publish_ledger_publisher_v2"),
    ):
        ensure_fk(table_name, {
            "mode": "OPAQUE_CROSS_BOUNDARY_REFERENCE",
            "columns": [column_name],
            "target": target,
            "constraintId": constraint_id,
        })

    ensure_column("ppl_rec_hire_handoff_receipts", {
        "name": "candidate_case_id", "sqlType": "BIGINT", "nullable": False,
        "sensitivity": "INTERNAL", "tokenization": "NONE",
        "source": "CAUSAL_BUSINESS_FACT_V2",
        "referenceContract": {"entityType": "table:ppl_rec_candidate_cases", "idSpace": "INTERNAL_BIGINT"},
    })
    ensure_column("ppl_jny_task_evidence", {
        "name": "journey_assignment_task_id", "sqlType": "BIGINT", "nullable": False,
        "sensitivity": "INTERNAL", "tokenization": "NONE",
        "source": "CAUSAL_BUSINESS_FACT_V2",
        "referenceContract": {"entityType": "table:ppl_jny_assignment_tasks", "idSpace": "INTERNAL_BIGINT"},
    })
    task_evidence_fks = tables["ppl_jny_task_evidence"]["foreignKeys"]
    if not any(fk.get("constraintId") == "fk_ppl_jny_task_evidence_task_v2"
               for fk in task_evidence_fks):
        task_evidence_fks.append({
            "mode": "LOCAL_COMPOSITE_FK", "columns": ["tenant_id", "journey_assignment_task_id"],
            "target": "ppl_jny_assignment_tasks", "targetColumns": ["tenant_id", "journey_assignment_task_id"],
            "constraintId": "fk_ppl_jny_task_evidence_task_v2",
        })

    # Immutable coaching notes prevent a profile update/archive command from
    # bulk-mutating every aspiration child merely because they share a UUID
    # shape or aggregate family.
    ensure_table({
        "capabilityId": "HRIS.MODERN.GROWTH_PROFILE", "session": "HRIS-PER",
        "tableName": "prf_grw_coaching_notes", "kind": "IMMUTABLE_COACHING_NOTE_LEDGER",
        "idColumn": {"name": "growth_coaching_note_id", "sqlType": "BIGINT",
                     "nullable": False, "default": "IDENTITY", "exposure": "INTERNAL_ONLY"},
        "commonColumnsRef": "DWP_MODERN_TENANT_TABLE_V1",
        "columns": [
            business_column("growth_profile_id", "BIGINT", reference={"entityType": "table:prf_grw_profiles", "idSpace": "INTERNAL_BIGINT"}),
            business_column("note_revision", "BIGINT"),
            business_column("coach_principal_public_id", "UUID", sensitivity="RESTRICTED",
                            tokenization="OPAQUE_PUBLIC_ID", reference={"entityType": "Auth.Principal", "idSpace": "PUBLIC_UUID"}),
            business_column("coaching_artifact_public_id", "UUID", sensitivity="RESTRICTED",
                            tokenization="OPAQUE_PUBLIC_ID", reference={"entityType": "PER.GrowthCoachingArtifact", "idSpace": "PUBLIC_UUID"}),
            business_column("artifact_revision", "BIGINT"),
            business_column("employee_visible", "BOOLEAN"),
            business_column("occurred_at", "TIMESTAMPTZ"),
            business_column("content_digest", "CHAR(64)", tokenization="NONREVERSIBLE_DIGEST"),
            business_column("evidence_refs", "UUID[]", nullable=True, sensitivity="RESTRICTED",
                            tokenization="OPAQUE_PUBLIC_ID", reference={"entityType": "SkillsOrLearning", "idSpace": "PUBLIC_UUID"}),
            business_column("recorded_at", "TIMESTAMPTZ", default="CURRENT_TIMESTAMP"),
        ],
        "foreignKeys": [
            {"mode": "LOCAL_COMPOSITE_FK", "columns": ["tenant_id", "growth_profile_id"],
             "target": "prf_grw_profiles", "constraintId": "fk_prf_grw_coaching_notes_profile_v2",
             "targetColumns": ["tenant_id", "growth_profile_id"]},
            {"mode": "OPAQUE_CROSS_BOUNDARY_REFERENCE", "columns": ["evidence_refs"],
             "target": "SkillsOrLearning", "constraintId": "fk_prf_grw_coaching_notes_evidence_v2"},
            {"mode": "OPAQUE_CROSS_BOUNDARY_REFERENCE", "columns": ["coaching_artifact_public_id"],
             "target": "PER.GrowthCoachingArtifact", "constraintId": "fk_prf_grw_coaching_notes_artifact_v2"},
            {"mode": "OPAQUE_CROSS_BOUNDARY_REFERENCE", "columns": ["artifact_public_id"],
             "target": "Content.ImmutableArtifact", "constraintId": "fk_prf_grw_coaching_notes_content_artifact_v2"},
            {"mode": "OPAQUE_CROSS_BOUNDARY_REFERENCE", "columns": ["coach_principal_public_id"],
             "target": "Auth.Principal", "constraintId": "fk_prf_grw_coaching_notes_coach_v2"},
        ],
        "uniqueKeys": [
            {"constraintId": "uk_prf_grw_coaching_notes_revision_v2",
             "columns": ["tenant_id", "growth_profile_id", "note_revision"]},
            {"constraintId": "uk_prf_grw_coaching_notes_artifact_v2",
             "columns": ["tenant_id", "growth_profile_id", "coaching_artifact_public_id", "artifact_revision"]},
        ],
        "checks": [
            {"constraintId": "ck_prf_grw_coaching_notes_revision_v2",
             "expression": "note_revision > 0", "columns": ["note_revision"]},
            {"constraintId": "ck_prf_grw_coaching_notes_artifact_revision_v2",
             "expression": "artifact_revision > 0", "columns": ["artifact_revision"]},
            {"constraintId": "ck_prf_grw_coaching_notes_digest_v2",
             "expression": "content_digest ~ '^[0-9a-f]{64}$'", "columns": ["content_digest"]},
        ],
        "indexes": [{"indexId": "idx_prf_grw_coaching_notes_profile_v2",
                     "columns": ["tenant_id", "growth_profile_id", "recorded_at"]}],
        "rowSecurity": "ENABLE_FORCE_DWP_TENANT_BIGINT_NOBYPASSRLS",
        "retentionPolicyRef": "WORKER_TALENT_CONSENT_RETENTION_POLICY_REF",
        "immutability": "APPEND_ONLY", "effectiveTime": "recorded_at TIMESTAMPTZ NOT NULL",
    })

    # Demand forecast creation is header + ordered lines with a per-business-
    # key revision allocator.  This avoids a caller-selected revision and
    # preserves each source bucket as a typed, auditable fact.
    ensure_table({
        "capabilityId": "HRIS.MODERN.ADVANCED_WFM", "session": "HRIS-TIM",
        "tableName": "tme_wfm_forecast_revision_counters", "kind": "FORECAST_REVISION_ALLOCATOR",
        "idColumn": {"name": "forecast_revision_counter_id", "sqlType": "BIGINT",
                     "nullable": False, "default": "IDENTITY", "exposure": "INTERNAL_ONLY"},
        "commonColumnsRef": "DWP_MODERN_TENANT_TABLE_V1",
        "columns": [
            business_column("forecast_key", "VARCHAR(160)"),
            business_column("current_revision", "BIGINT"),
            business_column("last_source_digest", "CHAR(64)", tokenization="NONREVERSIBLE_DIGEST"),
            business_column("allocated_at", "TIMESTAMPTZ", default="CURRENT_TIMESTAMP"),
        ],
        "foreignKeys": [],
        "uniqueKeys": [
            {"constraintId": "uk_tme_wfm_forecast_revision_counters_key_v2", "columns": ["tenant_id", "forecast_key"]},
            {"constraintId": "uk_tme_wfm_forecast_revision_counters_internal_v2", "columns": ["tenant_id", "forecast_revision_counter_id"]},
        ],
        "checks": [
            {"constraintId": "ck_tme_wfm_forecast_revision_counters_revision_v2", "expression": "current_revision > 0", "columns": ["current_revision"]},
            {"constraintId": "ck_tme_wfm_forecast_revision_counters_digest_v2", "expression": "last_source_digest ~ '^[0-9a-f]{64}$'", "columns": ["last_source_digest"]},
        ],
        "indexes": [{"indexId": "idx_tme_wfm_forecast_revision_counters_allocated_v2", "columns": ["tenant_id", "allocated_at"]}],
        "rowSecurity": "ENABLE_FORCE_DWP_TENANT_BIGINT_NOBYPASSRLS",
        "retentionPolicyRef": "WFM_PLANNING_RETENTION_POLICY_REF",
        "immutability": "UPSERT_WITH_SERIALIZABLE_KEY_LOCK",
        "effectiveTime": "allocated_at TIMESTAMPTZ NOT NULL",
    })
    ensure_table({
        "capabilityId": "HRIS.MODERN.ADVANCED_WFM", "session": "HRIS-TIM",
        "tableName": "tme_wfm_demand_lines", "kind": "IMMUTABLE_FORECAST_DEMAND_LINE",
        "idColumn": {"name": "demand_line_id", "sqlType": "BIGINT",
                     "nullable": False, "default": "IDENTITY", "exposure": "INTERNAL_ONLY"},
        "commonColumnsRef": "DWP_MODERN_TENANT_TABLE_V1",
        "columns": [
            business_column("demand_forecast_id", "BIGINT", reference={"entityType": "table:tme_wfm_demand_forecasts", "idSpace": "INTERNAL_BIGINT"}),
            business_column("line_sequence", "INTEGER"),
            business_column("interval_start", "TIMESTAMPTZ"),
            business_column("interval_end", "TIMESTAMPTZ"),
            business_column("required_headcount", "NUMERIC(12,4)"),
            business_column("demand_unit_code", "VARCHAR(40)"),
            business_column("skill_public_id", "UUID", nullable=True, sensitivity="RESTRICTED", tokenization="OPAQUE_PUBLIC_ID", reference={"entityType": "PER.Skill", "idSpace": "PUBLIC_UUID"}),
            business_column("organization_public_id", "UUID", nullable=True, sensitivity="RESTRICTED", tokenization="OPAQUE_PUBLIC_ID", reference={"entityType": "HRM.Organization", "idSpace": "PUBLIC_UUID"}),
            business_column("line_digest", "CHAR(64)", tokenization="NONREVERSIBLE_DIGEST"),
        ],
        "foreignKeys": [
            {"mode": "LOCAL_COMPOSITE_FK", "columns": ["tenant_id", "demand_forecast_id"],
             "target": "tme_wfm_demand_forecasts", "targetColumns": ["tenant_id", "demand_forecast_id"],
             "constraintId": "fk_tme_wfm_demand_lines_forecast_v2"},
            {"mode": "OPAQUE_CROSS_BOUNDARY_REFERENCE", "columns": ["skill_public_id"],
             "target": "PER.Skill", "constraintId": "fk_tme_wfm_demand_lines_skill_v2"},
            {"mode": "OPAQUE_CROSS_BOUNDARY_REFERENCE", "columns": ["organization_public_id"],
             "target": "HRM.Organization", "constraintId": "fk_tme_wfm_demand_lines_org_v2"},
        ],
        "uniqueKeys": [
            {"constraintId": "uk_tme_wfm_demand_lines_sequence_v2", "columns": ["tenant_id", "demand_forecast_id", "line_sequence"]},
            {"constraintId": "uk_tme_wfm_demand_lines_public_v2", "columns": ["tenant_id", "public_id"]},
        ],
        "checks": [
            {"constraintId": "ck_tme_wfm_demand_lines_sequence_v2", "expression": "line_sequence > 0", "columns": ["line_sequence"]},
            {"constraintId": "ck_tme_wfm_demand_lines_interval_v2", "expression": "interval_end > interval_start", "columns": ["interval_start", "interval_end"]},
            {"constraintId": "ck_tme_wfm_demand_lines_headcount_v2", "expression": "required_headcount >= 0", "columns": ["required_headcount"]},
            {"constraintId": "ck_tme_wfm_demand_lines_digest_v2", "expression": "line_digest ~ '^[0-9a-f]{64}$'", "columns": ["line_digest"]},
        ],
        "indexes": [{"indexId": "idx_tme_wfm_demand_lines_interval_v2", "columns": ["tenant_id", "demand_forecast_id", "interval_start"]}],
        "rowSecurity": "ENABLE_FORCE_DWP_TENANT_BIGINT_NOBYPASSRLS",
        "retentionPolicyRef": "WFM_PLANNING_RETENTION_POLICY_REF",
        "immutability": "APPEND_ONLY", "effectiveTime": "interval_start/interval_end half-open range",
    })
    ensure_table({
        "capabilityId": "HRIS.MODERN.ADVANCED_WFM", "session": "HRIS-TIM",
        "tableName": "tme_wfm_constraint_violation_lines", "kind": "IMMUTABLE_CONSTRAINT_RESULT_LINE",
        "idColumn": {"name": "constraint_violation_line_id", "sqlType": "BIGINT",
                     "nullable": False, "default": "IDENTITY", "exposure": "INTERNAL_ONLY"},
        "commonColumnsRef": "DWP_MODERN_TENANT_TABLE_V1",
        "columns": [
            business_column("constraint_evaluation_receipt_id", "BIGINT", reference={"entityType": "table:tme_wfm_constraint_evaluation_receipts", "idSpace": "INTERNAL_BIGINT"}),
            business_column("line_sequence", "INTEGER"),
            business_column("constraint_code", "VARCHAR(160)"),
            business_column("severity", "VARCHAR(40)"),
            business_column("subject_reference_digest", "CHAR(64)", tokenization="NONREVERSIBLE_DIGEST"),
            business_column("result_digest", "CHAR(64)", tokenization="NONREVERSIBLE_DIGEST"),
        ],
        "foreignKeys": [{"mode": "LOCAL_COMPOSITE_FK", "columns": ["tenant_id", "constraint_evaluation_receipt_id"],
                         "target": "tme_wfm_constraint_evaluation_receipts", "targetColumns": ["tenant_id", "constraint_evaluation_receipt_id"],
                         "constraintId": "fk_tme_wfm_constraint_violation_lines_receipt_v2"}],
        "uniqueKeys": [
            {"constraintId": "uk_tme_wfm_constraint_violation_lines_sequence_v2", "columns": ["tenant_id", "constraint_evaluation_receipt_id", "line_sequence"]},
            {"constraintId": "uk_tme_wfm_constraint_violation_lines_public_v2", "columns": ["tenant_id", "public_id"]},
        ],
        "checks": [
            {"constraintId": "ck_tme_wfm_constraint_violation_lines_sequence_v2", "expression": "line_sequence > 0", "columns": ["line_sequence"]},
            {"constraintId": "ck_tme_wfm_constraint_violation_lines_severity_v2", "expression": "severity IN ('INFO','WARNING','BLOCKING')", "columns": ["severity"]},
            {"constraintId": "ck_tme_wfm_constraint_violation_lines_subject_digest_v2", "expression": "subject_reference_digest ~ '^[0-9a-f]{64}$'", "columns": ["subject_reference_digest"]},
            {"constraintId": "ck_tme_wfm_constraint_violation_lines_result_digest_v2", "expression": "result_digest ~ '^[0-9a-f]{64}$'", "columns": ["result_digest"]},
        ],
        "indexes": [{"indexId": "idx_tme_wfm_constraint_violation_lines_receipt_v2", "columns": ["tenant_id", "constraint_evaluation_receipt_id", "line_sequence"]}],
        "rowSecurity": "ENABLE_FORCE_DWP_TENANT_BIGINT_NOBYPASSRLS",
        "retentionPolicyRef": "WFM_FAIRNESS_AUDIT_RETENTION_POLICY_REF",
        "immutability": "APPEND_ONLY", "effectiveTime": "inherits evaluation receipt evaluated_at",
    })
    ensure_table({
        "capabilityId": "HRIS.MODERN.ADVANCED_WFM", "session": "HRIS-TIM",
        "tableName": "tme_wfm_candidate_shift_lines", "kind": "IMMUTABLE_SCHEDULE_CANDIDATE_SHIFT",
        "idColumn": {"name": "candidate_shift_line_id", "sqlType": "BIGINT",
                     "nullable": False, "default": "IDENTITY", "exposure": "INTERNAL_ONLY"},
        "commonColumnsRef": "DWP_MODERN_TENANT_TABLE_V1",
        "columns": [
            business_column("schedule_candidate_id", "BIGINT", reference={"entityType": "table:tme_wfm_schedule_candidates", "idSpace": "INTERNAL_BIGINT"}),
            business_column("line_sequence", "INTEGER"),
            business_column("worker_public_id", "UUID", sensitivity="RESTRICTED", tokenization="OPAQUE_PUBLIC_ID", reference={"entityType": "HRM.Worker", "idSpace": "PUBLIC_UUID"}),
            business_column("assignment_public_id", "UUID", sensitivity="RESTRICTED", tokenization="OPAQUE_PUBLIC_ID", reference={"entityType": "HRM.Assignment", "idSpace": "PUBLIC_UUID"}),
            business_column("shift_start", "TIMESTAMPTZ"),
            business_column("shift_end", "TIMESTAMPTZ"),
            business_column("worksite_public_id", "UUID", sensitivity="RESTRICTED", tokenization="OPAQUE_PUBLIC_ID", reference={"entityType": "HRM.Location", "idSpace": "PUBLIC_UUID"}),
            business_column("position_public_id", "UUID", nullable=True, sensitivity="RESTRICTED", tokenization="OPAQUE_PUBLIC_ID", reference={"entityType": "HRM.Position", "idSpace": "PUBLIC_UUID"}),
            business_column("line_digest", "CHAR(64)", tokenization="NONREVERSIBLE_DIGEST"),
        ],
        "foreignKeys": [
            {"mode": "LOCAL_COMPOSITE_FK", "columns": ["tenant_id", "schedule_candidate_id"],
             "target": "tme_wfm_schedule_candidates", "targetColumns": ["tenant_id", "schedule_candidate_id"],
             "constraintId": "fk_tme_wfm_candidate_shift_lines_candidate_v2"},
            {"mode": "OPAQUE_CROSS_BOUNDARY_REFERENCE", "columns": ["worker_public_id"], "target": "HRM.Worker", "constraintId": "fk_tme_wfm_candidate_shift_lines_worker_v2"},
            {"mode": "OPAQUE_CROSS_BOUNDARY_REFERENCE", "columns": ["assignment_public_id"], "target": "HRM.Assignment", "constraintId": "fk_tme_wfm_candidate_shift_lines_assignment_v2"},
            {"mode": "OPAQUE_CROSS_BOUNDARY_REFERENCE", "columns": ["worksite_public_id"], "target": "HRM.Location", "constraintId": "fk_tme_wfm_candidate_shift_lines_worksite_v2"},
            {"mode": "OPAQUE_CROSS_BOUNDARY_REFERENCE", "columns": ["position_public_id"], "target": "HRM.Position", "constraintId": "fk_tme_wfm_candidate_shift_lines_position_v2"},
        ],
        "uniqueKeys": [
            {"constraintId": "uk_tme_wfm_candidate_shift_lines_sequence_v2", "columns": ["tenant_id", "schedule_candidate_id", "line_sequence"]},
            {"constraintId": "uk_tme_wfm_candidate_shift_lines_public_v2", "columns": ["tenant_id", "public_id"]},
        ],
        "checks": [
            {"constraintId": "ck_tme_wfm_candidate_shift_lines_sequence_v2", "expression": "line_sequence > 0", "columns": ["line_sequence"]},
            {"constraintId": "ck_tme_wfm_candidate_shift_lines_interval_v2", "expression": "shift_end > shift_start", "columns": ["shift_start", "shift_end"]},
            {"constraintId": "ck_tme_wfm_candidate_shift_lines_digest_v2", "expression": "line_digest ~ '^[0-9a-f]{64}$'", "columns": ["line_digest"]},
        ],
        "indexes": [{"indexId": "idx_tme_wfm_candidate_shift_lines_candidate_v2", "columns": ["tenant_id", "schedule_candidate_id", "shift_start"]}],
        "rowSecurity": "ENABLE_FORCE_DWP_TENANT_BIGINT_NOBYPASSRLS",
        "retentionPolicyRef": "WFM_PLANNING_RETENTION_POLICY_REF",
        "immutability": "APPEND_ONLY", "effectiveTime": "shift_start/shift_end half-open range",
    })
    ensure_table({
        "capabilityId": "HRIS.MODERN.ADVANCED_WFM", "session": "HRIS-TIM",
        "tableName": "tme_wfm_fairness_measure_values", "kind": "IMMUTABLE_FAIRNESS_RESULT_LINE",
        "idColumn": {"name": "fairness_measure_value_id", "sqlType": "BIGINT",
                     "nullable": False, "default": "IDENTITY", "exposure": "INTERNAL_ONLY"},
        "commonColumnsRef": "DWP_MODERN_TENANT_TABLE_V1",
        "columns": [
            business_column("constraint_evaluation_receipt_id", "BIGINT", reference={"entityType": "table:tme_wfm_constraint_evaluation_receipts", "idSpace": "INTERNAL_BIGINT"}),
            business_column("line_sequence", "INTEGER"),
            business_column("metric_code", "VARCHAR(160)"),
            business_column("cohort_digest", "CHAR(64)", tokenization="NONREVERSIBLE_DIGEST"),
            business_column("measured_value", "NUMERIC(19,6)"),
            business_column("threshold_value", "NUMERIC(19,6)", nullable=True),
            business_column("outcome", "VARCHAR(40)"),
            business_column("result_digest", "CHAR(64)", tokenization="NONREVERSIBLE_DIGEST"),
        ],
        "foreignKeys": [{"mode": "LOCAL_COMPOSITE_FK", "columns": ["tenant_id", "constraint_evaluation_receipt_id"],
                         "target": "tme_wfm_constraint_evaluation_receipts", "targetColumns": ["tenant_id", "constraint_evaluation_receipt_id"],
                         "constraintId": "fk_tme_wfm_fairness_measure_values_receipt_v2"}],
        "uniqueKeys": [
            {"constraintId": "uk_tme_wfm_fairness_measure_values_sequence_v2", "columns": ["tenant_id", "constraint_evaluation_receipt_id", "line_sequence"]},
            {"constraintId": "uk_tme_wfm_fairness_measure_values_public_v2", "columns": ["tenant_id", "public_id"]},
        ],
        "checks": [
            {"constraintId": "ck_tme_wfm_fairness_measure_values_sequence_v2", "expression": "line_sequence > 0", "columns": ["line_sequence"]},
            {"constraintId": "ck_tme_wfm_fairness_measure_values_outcome_v2", "expression": "outcome IN ('PASS','WARN','FAIL')", "columns": ["outcome"]},
            {"constraintId": "ck_tme_wfm_fairness_measure_values_cohort_digest_v2", "expression": "cohort_digest ~ '^[0-9a-f]{64}$'", "columns": ["cohort_digest"]},
            {"constraintId": "ck_tme_wfm_fairness_measure_values_result_digest_v2", "expression": "result_digest ~ '^[0-9a-f]{64}$'", "columns": ["result_digest"]},
        ],
        "indexes": [{"indexId": "idx_tme_wfm_fairness_measure_values_receipt_v2", "columns": ["tenant_id", "constraint_evaluation_receipt_id", "line_sequence"]}],
        "rowSecurity": "ENABLE_FORCE_DWP_TENANT_BIGINT_NOBYPASSRLS",
        "retentionPolicyRef": "WFM_FAIRNESS_AUDIT_RETENTION_POLICY_REF",
        "immutability": "APPEND_ONLY", "effectiveTime": "inherits evaluation receipt evaluated_at",
    })

    # Solver output is asynchronous.  The public command stores only an
    # immutable request root; the solver completion handler below owns
    # candidate/evaluation creation.
    ensure_table({
        "capabilityId": "HRIS.MODERN.ADVANCED_WFM", "session": "HRIS-TIM",
        "tableName": "tme_wfm_optimization_requests", "kind": "ASYNC_OPTIMIZATION_REQUEST_ROOT",
        "idColumn": {"name": "optimization_request_id", "sqlType": "BIGINT",
                     "nullable": False, "default": "IDENTITY", "exposure": "INTERNAL_ONLY"},
        "commonColumnsRef": "DWP_MODERN_TENANT_TABLE_V1",
        "columns": [
            business_column("demand_forecast_id", "BIGINT", reference={"entityType": "table:tme_wfm_demand_forecasts", "idSpace": "INTERNAL_BIGINT"}),
            business_column("input_snapshot_id", "UUID", sensitivity="RESTRICTED", tokenization="OPAQUE_PUBLIC_ID", reference={"entityType": "HRM_PER.AvailabilitySnapshot", "idSpace": "PUBLIC_UUID"}),
            business_column("rule_version", "BIGINT"),
            business_column("deterministic_seed", "VARCHAR(160)"),
            business_column("fairness_evaluation_id", "UUID", sensitivity="RESTRICTED", tokenization="OPAQUE_PUBLIC_ID", reference={"entityType": "SYS.AIFairnessEvaluation", "idSpace": "PUBLIC_UUID"}),
            business_column("availability_snapshot_id", "UUID", sensitivity="RESTRICTED", tokenization="OPAQUE_PUBLIC_ID", reference={"entityType": "HRM_PER.AvailabilitySnapshot", "idSpace": "PUBLIC_UUID"}),
            business_column("period_start", "TIMESTAMPTZ"),
            business_column("period_end", "TIMESTAMPTZ"),
            business_column("request_digest", "CHAR(64)", tokenization="NONREVERSIBLE_DIGEST"),
            business_column("requested_at", "TIMESTAMPTZ", default="CURRENT_TIMESTAMP"),
            business_column("status", "VARCHAR(40)", default="'REQUESTED'"),
        ],
        "foreignKeys": [
            {"mode": "LOCAL_COMPOSITE_FK", "columns": ["tenant_id", "demand_forecast_id"],
             "target": "tme_wfm_demand_forecasts", "constraintId": "fk_tme_wfm_optimization_requests_forecast_v2",
             "targetColumns": ["tenant_id", "demand_forecast_id"]},
            {"mode": "OPAQUE_CROSS_BOUNDARY_REFERENCE", "columns": ["input_snapshot_id"],
             "target": "HRM.WorkforcePlanningInputSnapshot", "constraintId": "fk_tme_wfm_optimization_requests_input_v2"},
            {"mode": "OPAQUE_CROSS_BOUNDARY_REFERENCE", "columns": ["fairness_evaluation_id"],
             "target": "SYS.AIFairnessEvaluation", "constraintId": "fk_tme_wfm_optimization_requests_fairness_v2"},
            {"mode": "OPAQUE_CROSS_BOUNDARY_REFERENCE", "columns": ["availability_snapshot_id"],
             "target": "HRM_PER.AvailabilitySnapshot", "constraintId": "fk_tme_wfm_optimization_requests_availability_v2"},
        ],
        "uniqueKeys": [{"constraintId": "uk_tme_wfm_optimization_requests_digest_v2",
                        "columns": ["tenant_id", "demand_forecast_id", "request_digest"]}],
        "checks": [
            {"constraintId": "ck_tme_wfm_optimization_requests_period_v2",
             "expression": "period_end > period_start", "columns": ["period_start", "period_end"]},
            {"constraintId": "ck_tme_wfm_optimization_requests_rule_v2",
             "expression": "rule_version > 0", "columns": ["rule_version"]},
            {"constraintId": "ck_tme_wfm_optimization_requests_digest_v2",
             "expression": "request_digest ~ '^[0-9a-f]{64}$'", "columns": ["request_digest"]},
            {"constraintId": "ck_tme_wfm_optimization_requests_status_v2",
             "expression": "status IN ('REQUESTED','COMPLETED','FAILED','CANCELLED')", "columns": ["status"]},
        ],
        "indexes": [{"indexId": "idx_tme_wfm_optimization_requests_status_v2",
                     "columns": ["tenant_id", "status", "requested_at"]}],
        "rowSecurity": "ENABLE_FORCE_DWP_TENANT_BIGINT_NOBYPASSRLS",
        "retentionPolicyRef": "WFM_FAIRNESS_AUDIT_RETENTION_POLICY_REF",
        "immutability": "STATEFUL_REQUEST_ROOT", "effectiveTime": "requested_at TIMESTAMPTZ NOT NULL",
    })

    ensure_table({
        "capabilityId": "HRIS.MODERN.ADVANCED_WFM", "session": "HRIS-TIM",
        "tableName": "tme_wfm_approval_requests", "kind": "IMMUTABLE_APPROVAL_REQUEST",
        "idColumn": {"name": "wfm_approval_request_id", "sqlType": "BIGINT",
                     "nullable": False, "default": "IDENTITY", "exposure": "INTERNAL_ONLY"},
        "commonColumnsRef": "DWP_MODERN_TENANT_TABLE_V1",
        "columns": [
            business_column("schedule_candidate_id", "BIGINT", reference={"entityType": "table:tme_wfm_schedule_candidates", "idSpace": "INTERNAL_BIGINT"}),
            business_column("candidate_revision", "BIGINT"),
            business_column("constraint_evaluation_receipt_id", "BIGINT", reference={"entityType": "table:tme_wfm_constraint_evaluation_receipts", "idSpace": "INTERNAL_BIGINT"}),
            business_column("candidate_digest", "CHAR(64)", tokenization="NONREVERSIBLE_DIGEST"),
            business_column("submission_digest", "CHAR(64)", tokenization="NONREVERSIBLE_DIGEST"),
            business_column("effective_date", "DATE", nullable=True),
            business_column("requested_at", "TIMESTAMPTZ", default="CURRENT_TIMESTAMP"),
            business_column("status", "VARCHAR(40)", default="'REQUESTED'"),
        ],
        "foreignKeys": [
            {"mode": "LOCAL_COMPOSITE_FK", "columns": ["tenant_id", "schedule_candidate_id"],
             "target": "tme_wfm_schedule_candidates", "targetColumns": ["tenant_id", "schedule_candidate_id"],
             "constraintId": "fk_tme_wfm_approval_requests_candidate_v2"},
            {"mode": "LOCAL_COMPOSITE_FK", "columns": ["tenant_id", "constraint_evaluation_receipt_id"],
             "target": "tme_wfm_constraint_evaluation_receipts", "targetColumns": ["tenant_id", "constraint_evaluation_receipt_id"],
             "constraintId": "fk_tme_wfm_approval_requests_evaluation_v2"},
        ],
        "uniqueKeys": [
            {"constraintId": "uk_tme_wfm_approval_requests_candidate_revision_v2", "columns": ["tenant_id", "schedule_candidate_id", "candidate_revision"]},
            {"constraintId": "uk_tme_wfm_approval_requests_public_v2", "columns": ["tenant_id", "public_id"]},
        ],
        "checks": [
            {"constraintId": "ck_tme_wfm_approval_requests_revision_v2", "expression": "candidate_revision > 0", "columns": ["candidate_revision"]},
            {"constraintId": "ck_tme_wfm_approval_requests_submission_digest_v2", "expression": "submission_digest ~ '^[0-9a-f]{64}$'", "columns": ["submission_digest"]},
            {"constraintId": "ck_tme_wfm_approval_requests_status_v2", "expression": "status IN ('REQUESTED','APPROVED','REJECTED','CANCELLED')", "columns": ["status"]},
        ],
        "indexes": [{"indexId": "idx_tme_wfm_approval_requests_status_v2", "columns": ["tenant_id", "status", "requested_at"]}],
        "rowSecurity": "ENABLE_FORCE_DWP_TENANT_BIGINT_NOBYPASSRLS",
        "retentionPolicyRef": "WFM_APPROVAL_RETENTION_POLICY_REF",
        "immutability": "APPEND_ONLY_REQUEST_STATUS_OWNER_ACK",
        "effectiveTime": "requested_at TIMESTAMPTZ NOT NULL",
    })

    # The ATS command records an owner-directed hire request.  It deliberately
    # has its own identity and lifecycle: a candidate/offer/approval tuple is
    # not an HRM provisioning receipt, and the public command cannot advance a
    # candidate to HIRED before HRM acknowledges the created worker records.
    ensure_table({
        "capabilityId": "HRIS.MODERN.RECRUITING_ATS", "session": "HRIS-HRM",
        "tableName": "ppl_rec_hire_requests", "kind": "ASYNC_HIRE_REQUEST_ROOT",
        "idColumn": {"name": "hire_request_id", "sqlType": "BIGINT",
                     "nullable": False, "default": "IDENTITY", "exposure": "INTERNAL_ONLY"},
        "commonColumnsRef": "DWP_MODERN_TENANT_TABLE_V1",
        "columns": [
            business_column("candidate_case_id", "BIGINT", reference={
                "entityType": "table:ppl_rec_candidate_cases", "idSpace": "INTERNAL_BIGINT"}),
            business_column("offer_id", "BIGINT", reference={
                "entityType": "table:ppl_rec_offers", "idSpace": "INTERNAL_BIGINT"}),
            business_column("effective_date", "DATE"),
            business_column("human_decision_receipt_id", "UUID", sensitivity="RESTRICTED",
                            tokenization="OPAQUE_PUBLIC_ID", reference={
                                "entityType": "Approval.DecisionReceipt", "idSpace": "PUBLIC_UUID"}),
            business_column("request_digest", "CHAR(64)", tokenization="NONREVERSIBLE_DIGEST"),
            business_column("requested_at", "TIMESTAMPTZ", default="CURRENT_TIMESTAMP"),
            business_column("acknowledged_at", "TIMESTAMPTZ", nullable=True),
            business_column("owner_acknowledgement_id", "UUID", nullable=True,
                            sensitivity="RESTRICTED", tokenization="OPAQUE_PUBLIC_ID", reference={
                                "entityType": "HRM.HireProvisioningAcknowledgement",
                                "idSpace": "PUBLIC_UUID"}),
            business_column("status", "VARCHAR(40)", default="'REQUESTED'"),
        ],
        "foreignKeys": [
            {"mode": "LOCAL_COMPOSITE_FK", "columns": ["tenant_id", "candidate_case_id"],
             "target": "ppl_rec_candidate_cases", "targetColumns": ["tenant_id", "candidate_case_id"],
             "constraintId": "fk_ppl_rec_hire_requests_candidate_v2"},
            {"mode": "LOCAL_COMPOSITE_FK", "columns": ["tenant_id", "offer_id"],
             "target": "ppl_rec_offers", "targetColumns": ["tenant_id", "offer_id"],
             "constraintId": "fk_ppl_rec_hire_requests_offer_v2"},
            {"mode": "OPAQUE_CROSS_BOUNDARY_REFERENCE", "columns": ["human_decision_receipt_id"],
             "target": "Approval.DecisionReceipt",
             "constraintId": "fk_ppl_rec_hire_requests_decision_v2"},
            {"mode": "OPAQUE_CROSS_BOUNDARY_REFERENCE", "columns": ["owner_acknowledgement_id"],
             "target": "HRM.HireProvisioningAcknowledgement",
             "constraintId": "fk_ppl_rec_hire_requests_owner_ack_v2"},
        ],
        "uniqueKeys": [
            {"constraintId": "uk_ppl_rec_hire_requests_tenant_internal_v2",
             "columns": ["tenant_id", "hire_request_id"]},
            {"constraintId": "uk_ppl_rec_hire_requests_public_v2",
             "columns": ["tenant_id", "public_id"]},
            {"constraintId": "uk_ppl_rec_hire_requests_business_digest_v2",
             "columns": ["tenant_id", "candidate_case_id", "offer_id", "request_digest"]},
            {"constraintId": "uk_ppl_rec_hire_requests_owner_ack_v2",
             "columns": ["tenant_id", "owner_acknowledgement_id"]},
        ],
        "checks": [
            {"constraintId": "ck_ppl_rec_hire_requests_digest_v2",
             "expression": "request_digest ~ '^[0-9a-f]{64}$'", "columns": ["request_digest"]},
            {"constraintId": "ck_ppl_rec_hire_requests_status_v2",
             "expression": "status IN ('REQUESTED','ACKNOWLEDGED','FAILED','CANCELLED')",
             "columns": ["status"]},
            {"constraintId": "ck_ppl_rec_hire_requests_ack_v2",
             "expression": "status <> 'ACKNOWLEDGED' OR (acknowledged_at IS NOT NULL AND owner_acknowledgement_id IS NOT NULL)",
             "columns": ["status", "acknowledged_at", "owner_acknowledgement_id"]},
        ],
        "indexes": [
            {"indexId": "idx_ppl_rec_hire_requests_candidate_status_v2",
             "columns": ["tenant_id", "candidate_case_id", "status", "requested_at"]},
        ],
        "rowSecurity": "ENABLE_FORCE_DWP_TENANT_BIGINT_NOBYPASSRLS",
        "retentionPolicyRef": "CANDIDATE_HIRE_HANDOFF_RETENTION_POLICY_REF",
        "immutability": "STATEFUL_REQUEST_ROOT_OWNER_ACK_ONLY",
        "effectiveTime": "requested_at TIMESTAMPTZ NOT NULL; acknowledged_at TIMESTAMPTZ NULL",
    })

    # AI evaluation follows the same request/result boundary; model evaluation
    # output and result counts cannot be supplied by the policy author request.
    ensure_table({
        "capabilityId": "HRIS.MODERN.GOVERNED_AI", "session": "HRIS-SYS",
        "tableName": "sys_hris_ai_evaluation_requests", "kind": "ASYNC_AI_EVALUATION_REQUEST_ROOT",
        "idColumn": {"name": "ai_evaluation_request_id", "sqlType": "BIGINT",
                     "nullable": False, "default": "IDENTITY", "exposure": "INTERNAL_ONLY"},
        "commonColumnsRef": "DWP_MODERN_TENANT_TABLE_V1",
        "columns": [
            business_column("ai_use_policy_id", "BIGINT", reference={"entityType": "table:sys_hris_ai_use_policies", "idSpace": "INTERNAL_BIGINT"}),
            business_column("policy_version", "BIGINT"),
            business_column("evaluation_suite_version", "BIGINT"),
            business_column("fixture_set_digest", "CHAR(64)", tokenization="NONREVERSIBLE_DIGEST"),
            business_column("model_route_key", "VARCHAR(160)"),
            business_column("request_digest", "CHAR(64)", tokenization="NONREVERSIBLE_DIGEST"),
            business_column("requested_at", "TIMESTAMPTZ", default="CURRENT_TIMESTAMP"),
            business_column("status", "VARCHAR(40)", default="'REQUESTED'"),
        ],
        "foreignKeys": [{"mode": "LOCAL_COMPOSITE_FK", "columns": ["tenant_id", "ai_use_policy_id"],
                         "target": "sys_hris_ai_use_policies",
                         "constraintId": "fk_sys_hris_ai_evaluation_requests_policy_v2",
                         "targetColumns": ["tenant_id", "ai_use_policy_id"]}],
        "uniqueKeys": [{"constraintId": "uk_sys_hris_ai_evaluation_requests_digest_v2",
                        "columns": ["tenant_id", "ai_use_policy_id", "policy_version", "request_digest"]}],
        "checks": [
            {"constraintId": "ck_sys_hris_ai_evaluation_requests_policy_version_v2",
             "expression": "policy_version > 0", "columns": ["policy_version"]},
            {"constraintId": "ck_sys_hris_ai_evaluation_requests_suite_version_v2",
             "expression": "evaluation_suite_version > 0", "columns": ["evaluation_suite_version"]},
            {"constraintId": "ck_sys_hris_ai_evaluation_requests_digest_v2",
             "expression": "request_digest ~ '^[0-9a-f]{64}$'", "columns": ["request_digest"]},
            {"constraintId": "ck_sys_hris_ai_evaluation_requests_status_v2",
             "expression": "status IN ('REQUESTED','COMPLETED','FAILED','CANCELLED')", "columns": ["status"]},
        ],
        "indexes": [{"indexId": "idx_sys_hris_ai_evaluation_requests_status_v2",
                     "columns": ["tenant_id", "status", "requested_at"]}],
        "rowSecurity": "ENABLE_FORCE_DWP_TENANT_BIGINT_NOBYPASSRLS",
        "retentionPolicyRef": "AI_EVALUATION_RETENTION_POLICY_REF",
        "immutability": "STATEFUL_REQUEST_ROOT", "effectiveTime": "requested_at TIMESTAMPTZ NOT NULL",
    })

    ensure_column("sys_hris_ai_evaluation_receipts", {
        "name": "ai_evaluation_request_id", "sqlType": "BIGINT", "nullable": False,
        "sensitivity": "INTERNAL", "tokenization": "NONE",
        "source": "CAUSAL_BUSINESS_FACT_V2",
        "referenceContract": {"entityType": "table:sys_hris_ai_evaluation_requests", "idSpace": "INTERNAL_BIGINT"},
    })
    ensure_column("sys_hris_ai_evaluation_receipts", {
        "name": "evaluation_outcome", "sqlType": "VARCHAR(40)", "nullable": False,
        "sensitivity": "INTERNAL", "tokenization": "NONE", "source": "CAUSAL_BUSINESS_FACT_V2",
    })
    request_keys = tables["sys_hris_ai_evaluation_requests"]["uniqueKeys"]
    if not any(key.get("columns") == ["tenant_id", "ai_evaluation_request_id"]
               for key in request_keys):
        request_keys.append({
            "constraintId": "uk_sys_hris_ai_evaluation_requests_tenant_internal_v2",
            "columns": ["tenant_id", "ai_evaluation_request_id"],
        })
    eval_receipt = tables["sys_hris_ai_evaluation_receipts"]
    if not any(fk.get("constraintId") == "fk_sys_hris_ai_evaluation_receipts_request_v2"
               for fk in eval_receipt["foreignKeys"]):
        eval_receipt["foreignKeys"].append({
            "mode": "LOCAL_COMPOSITE_FK", "columns": ["tenant_id", "ai_evaluation_request_id"],
            "target": "sys_hris_ai_evaluation_requests",
            "constraintId": "fk_sys_hris_ai_evaluation_receipts_request_v2",
            "targetColumns": ["tenant_id", "ai_evaluation_request_id"],
        })
    if not any(check.get("constraintId") == "ck_sys_hris_ai_evaluation_receipts_outcome_v2"
               for check in eval_receipt["checks"]):
        eval_receipt["checks"].append({
            "constraintId": "ck_sys_hris_ai_evaluation_receipts_outcome_v2",
            "expression": "evaluation_outcome IN ('PASSED','FAILED')", "columns": ["evaluation_outcome"],
        })
    ensure_column("prf_grw_profiles", {
        "name": "change_set_digest", "sqlType": "CHAR(64)", "nullable": True,
        "sensitivity": "INTERNAL", "tokenization": "NONREVERSIBLE_DIGEST",
        "source": "CAUSAL_BUSINESS_FACT_V2",
    })
    ensure_column("prf_cmp_proposals", {
        "name": "submission_digest", "sqlType": "CHAR(64)", "nullable": True,
        "sensitivity": "INTERNAL", "tokenization": "NONREVERSIBLE_DIGEST",
        "source": "CAUSAL_BUSINESS_FACT_V2",
    })
    proposal = tables["prf_cmp_proposals"]
    if not any(check.get("constraintId") == "ck_prf_cmp_proposals_submitted_facts_v2"
               for check in proposal["checks"]):
        proposal["checks"].append({
            "constraintId": "ck_prf_cmp_proposals_submitted_facts_v2",
            "expression": "status <> 'SUBMITTED' OR (submission_digest IS NOT NULL AND submitted_at IS NOT NULL)",
            "columns": ["status", "submission_digest", "submitted_at"],
        })
    doc["scope"]["physicalTables"] = len(doc["tableSpecifications"])

    # Offer economics and the accepted-offer/effective-date handoff are
    # durable business facts.  They cannot exist only as transition guards or
    # caller-echo event fields.
    ensure_column("ppl_rec_offers", {
        "name": "currency_code", "sqlType": "CHAR(3)", "nullable": False,
        "sensitivity": "CONFIDENTIAL", "tokenization": "NONE",
        "source": "CAUSAL_BUSINESS_FACT_V2",
    })
    ensure_column("ppl_rec_offers", {
        "name": "amount", "sqlType": "NUMERIC(19,4)", "nullable": False,
        "sensitivity": "CONFIDENTIAL", "tokenization": "ENVELOPE_ENCRYPTION_AT_REST",
        "source": "CAUSAL_BUSINESS_FACT_V2",
    })
    # Recording a hire is a request to the HRM owner, not proof that a worker
    # exists.  Persist the accepted offer and decision facts on the candidate
    # while it is HIRE_PENDING; only the owner acknowledgement handler below
    # may append the handoff receipt and advance the candidate to HIRED.
    ensure_column("ppl_rec_candidate_cases", {
        "name": "pending_offer_id", "sqlType": "BIGINT", "nullable": True,
        "sensitivity": "INTERNAL", "tokenization": "NONE",
        "source": "CAUSAL_BUSINESS_FACT_V2",
        "referenceContract": {"entityType": "table:ppl_rec_offers", "idSpace": "INTERNAL_BIGINT"},
    })
    ensure_column("ppl_rec_candidate_cases", {
        "name": "hire_effective_date", "sqlType": "DATE", "nullable": True,
        "sensitivity": "INTERNAL", "tokenization": "NONE",
        "source": "CAUSAL_BUSINESS_FACT_V2",
    })
    ensure_column("ppl_rec_candidate_cases", {
        "name": "hire_decision_receipt_id", "sqlType": "UUID", "nullable": True,
        "sensitivity": "RESTRICTED", "tokenization": "OPAQUE_PUBLIC_ID",
        "source": "CAUSAL_BUSINESS_FACT_V2",
        "referenceContract": {"entityType": "Approval.DecisionReceipt", "idSpace": "PUBLIC_UUID"},
    })
    offer_keys = tables["ppl_rec_offers"]["uniqueKeys"]
    if not any(key.get("columns") == ["tenant_id", "offer_id"] for key in offer_keys):
        offer_keys.append({
            "constraintId": "uk_ppl_rec_offers_tenant_internal_v2",
            "columns": ["tenant_id", "offer_id"],
        })
    candidate_fks = tables["ppl_rec_candidate_cases"]["foreignKeys"]
    if not any(fk.get("constraintId") == "fk_ppl_rec_candidate_cases_pending_offer_v2"
               for fk in candidate_fks):
        candidate_fks.append({
            "mode": "LOCAL_COMPOSITE_FK", "columns": ["tenant_id", "pending_offer_id"],
            "target": "ppl_rec_offers", "constraintId": "fk_ppl_rec_candidate_cases_pending_offer_v2",
            "targetColumns": ["tenant_id", "offer_id"],
        })
    candidate = tables["ppl_rec_candidate_cases"]
    candidate["checks"] = [check for check in candidate["checks"]
                           if "stage" not in check.get("columns", [])]
    candidate["checks"].append({
        "constraintId": "ck_ppl_rec_candidate_cases_causal_stage_v2",
        "expression": "stage IN ('APPLIED','SCREENING','INTERVIEW','OFFERED','HIRE_PENDING','HIRED','REJECTED','CLOSED')",
        "columns": ["stage"],
    })
    ensure_column("ppl_rec_hire_handoff_receipts", {
        "name": "offer_id", "sqlType": "BIGINT", "nullable": False,
        "sensitivity": "INTERNAL", "tokenization": "NONE",
        "source": "CAUSAL_BUSINESS_FACT_V2",
        "referenceContract": {"entityType": "table:ppl_rec_offers", "idSpace": "INTERNAL_BIGINT"},
    })
    ensure_column("ppl_rec_hire_handoff_receipts", {
        "name": "effective_date", "sqlType": "DATE", "nullable": False,
        "sensitivity": "INTERNAL", "tokenization": "NONE",
        "source": "CAUSAL_BUSINESS_FACT_V2",
    })
    for column_name, entity in (
        ("employment_public_id", "HRM.Employment"),
        ("assignment_public_id", "HRM.Assignment"),
    ):
        ensure_column("ppl_rec_hire_handoff_receipts", {
            "name": column_name, "sqlType": "UUID", "nullable": False,
            "sensitivity": "RESTRICTED", "tokenization": "OPAQUE_PUBLIC_ID",
            "source": "CAUSAL_BUSINESS_FACT_V2",
            "referenceContract": {"entityType": entity, "idSpace": "PUBLIC_UUID"},
        })
    ensure_column("ppl_rec_hire_handoff_receipts", {
        "name": "owner_aggregate_version", "sqlType": "BIGINT", "nullable": False,
        "sensitivity": "INTERNAL", "tokenization": "NONE",
        "source": "CAUSAL_BUSINESS_FACT_V2",
    })
    ensure_column("ppl_rec_hire_handoff_receipts", {
        "name": "owner_acknowledgement_id", "sqlType": "UUID", "nullable": False,
        "sensitivity": "INTERNAL", "tokenization": "OPAQUE_PUBLIC_ID",
        "source": "CAUSAL_BUSINESS_FACT_V2",
        "referenceContract": {"entityType": "HRM.HireProvisioningAcknowledgement", "idSpace": "PUBLIC_UUID"},
    })
    handoff_fks = tables["ppl_rec_hire_handoff_receipts"]["foreignKeys"]
    if not any(fk.get("constraintId") == "fk_ppl_rec_hire_handoff_receipts_offer_v2" for fk in handoff_fks):
        handoff_fks.append({
            "mode": "LOCAL_COMPOSITE_FK", "columns": ["tenant_id", "offer_id"],
            "target": "ppl_rec_offers", "constraintId": "fk_ppl_rec_hire_handoff_receipts_offer_v2",
            "targetColumns": ["tenant_id", "offer_id"],
        })
    handoff_unique = tables["ppl_rec_hire_handoff_receipts"]["uniqueKeys"]
    if not any(key.get("constraintId") == "uk_ppl_rec_hire_handoff_owner_ack_v2"
               for key in handoff_unique):
        handoff_unique.append({
            "constraintId": "uk_ppl_rec_hire_handoff_owner_ack_v2",
            "columns": ["tenant_id", "owner_acknowledgement_id"],
        })
    access_unique = tables["ppl_cwk_access_expiry_receipts"]["uniqueKeys"]
    if not any(key.get("constraintId") == "uk_ppl_cwk_access_expiry_grant_revision_v2"
               for key in access_unique):
        access_unique.append({
            "constraintId": "uk_ppl_cwk_access_expiry_grant_revision_v2",
            "columns": ["tenant_id", "contingent_engagement_id", "grant_public_id", "grant_revision"],
        })

    ensure_column("ppl_rec_requisitions", {
        "name": "title", "sqlType": "VARCHAR(240)", "nullable": False,
        "sensitivity": "INTERNAL", "tokenization": "NONE", "source": "CAUSAL_BUSINESS_FACT_V2",
    })
    display_name_tables = (
        "ppl_jny_templates", "ppl_wfp_scenarios", "ppl_bnf_plans", "ppl_hrs_cases",
        "ppl_cwk_engagements", "prf_skl_taxonomies", "prf_grw_profiles", "prf_lrn_offerings",
        "prf_mkt_opportunities", "prf_suc_plans", "prf_cmp_cycles", "tme_wfm_demand_forecasts",
        "sys_hris_listening_surveys", "sys_hris_listening_actions", "sys_hris_metric_definitions",
        "sys_hris_analytics_export_receipts", "sys_hris_ai_provenance_receipts", "sys_hris_ai_use_policies",
    )
    for table_name in display_name_tables:
        ensure_column(table_name, {
            "name": "display_name", "sqlType": "VARCHAR(240)", "nullable": False,
            "sensitivity": "INTERNAL", "tokenization": "NONE", "source": "CAUSAL_BUSINESS_FACT_V2",
        })
    reason_tables = (
        "ppl_rec_candidate_cases", "ppl_jny_assignments", "ppl_wfp_scenarios", "ppl_bnf_enrollments",
        "ppl_cwk_engagements", "prf_grw_profiles", "prf_mkt_applications", "prf_suc_plans",
        "prf_cmp_cycles", "sys_hris_listening_surveys", "sys_hris_metric_definitions",
        "sys_hris_ai_use_policies",
    )
    for table_name in reason_tables:
        ensure_column(table_name, {
            "name": "last_reason_code", "sqlType": "VARCHAR(80)", "nullable": True,
            "sensitivity": "INTERNAL", "tokenization": "NONE", "source": "CAUSAL_BUSINESS_FACT_V2",
        })
    for table_name in ("ppl_hrs_case_actions", "prf_grw_profiles"):
        ensure_column(table_name, {
            "name": "visibility", "sqlType": "VARCHAR(40)", "nullable": True,
            "sensitivity": "INTERNAL", "tokenization": "NONE", "source": "CAUSAL_BUSINESS_FACT_V2",
        })

    # Three public identities are intentionally different. A compensation plan
    # is a distinct local approved-plan header, the cycle is the concurrency root, and the
    # snapshot is a newly generated immutable header identity.
    snapshot = tables["prf_cmp_approved_snapshots"]
    next(column for column in snapshot["columns"] if column["name"] == "plan_public_id")["referenceContract"] = {
        "entityType": "table:prf_cmp_plans", "idSpace": "PUBLIC_UUID"
    }
    next(column for column in snapshot["columns"] if column["name"] == "cycle_public_id")["referenceContract"] = {
        "entityType": "table:prf_cmp_cycles", "idSpace": "PUBLIC_UUID"
    }

    # Every local composite FK has an executable tenant+surrogate candidate
    # key.  This is physical DDL, not a documentation-only relationship.
    for child in tables.values():
        for fk in child.get("foreignKeys", []):
            if fk.get("mode") != "LOCAL_COMPOSITE_FK":
                continue
            parent = tables[fk["target"]]
            target_columns = list(fk["targetColumns"])
            if not any(key.get("columns") == target_columns for key in parent["uniqueKeys"]):
                parent["uniqueKeys"].append({
                    "constraintId": f"uk_{parent['tableName']}_tenant_internal_causal_v2",
                    "columns": target_columns,
                })

    operations = {operation["operationId"]: operation for operation in doc["operationBindings"]}

    def body_field(name: str, value_type: str, *, required: bool = True,
                   sensitivity: str = "INTERNAL", tokenization: str = "NONE",
                   reference: dict[str, str] | None = None,
                   validation: str = "validated typed owner-domain value") -> dict[str, Any]:
        field: dict[str, Any] = {
            "name": name, "type": value_type, "required": required,
            "validation": validation, "sensitivity": sensitivity,
            "tokenization": tokenization,
        }
        if reference:
            field["referenceContract"] = reference
        return field

    # Closed request value objects expose every business member to lineage and
    # reject the prior digest-only/single-line shortcuts.
    ensure_record_schema({
        "schemaId": "GrowthProfilePatch.v1", "kind": "OBJECT",
        "additionalProperties": False,
        "fields": [
            body_field("artifactPublicId", "UUID", sensitivity="RESTRICTED",
                       tokenization="OPAQUE_PUBLIC_ID",
                       reference={"entityType": "PER.GrowthProfileArtifact", "idSpace": "PUBLIC_UUID"},
                       validation="owner-issued immutable growth artifact; tenant and purpose bound"),
            body_field("artifactRevision", "BIGINT", validation="> 0 exact artifact revision"),
            body_field("visibility", "STRING", validation="published growth visibility code"),
        ],
    })
    ensure_record_schema({
        "schemaId": "CoachingNoteContent.v1", "kind": "OBJECT",
        "additionalProperties": False,
        "fields": [
            body_field("coachPrincipalPublicId", "UUID", sensitivity="RESTRICTED",
                       tokenization="OPAQUE_PUBLIC_ID",
                       reference={"entityType": "Auth.Principal", "idSpace": "PUBLIC_UUID"},
                       validation="authorized coach principal; tenant and manager relationship bound"),
            body_field("artifactPublicId", "UUID", sensitivity="RESTRICTED",
                       tokenization="OPAQUE_PUBLIC_ID",
                       reference={"entityType": "PER.GrowthCoachingArtifact", "idSpace": "PUBLIC_UUID"},
                       validation="owner-issued immutable coaching artifact; tenant and purpose bound"),
            body_field("artifactRevision", "BIGINT", validation="> 0 exact artifact revision"),
            body_field("employeeVisible", "BOOLEAN"),
            body_field("occurredAt", "TIMESTAMPTZ", validation="not after owner transaction time"),
        ],
    })
    ensure_record_schema({
        "schemaId": "ApprovedCompensationSnapshotLine.v1", "kind": "OBJECT",
        "additionalProperties": False,
        "fields": [
            body_field("workerPublicId", "UUID", sensitivity="RESTRICTED",
                       tokenization="OPAQUE_PUBLIC_ID",
                       reference={"entityType": "HRM.Worker", "idSpace": "PUBLIC_UUID"},
                       validation="tenant-bound active worker in the approved cycle population"),
            body_field("assignmentPublicId", "UUID", sensitivity="RESTRICTED",
                       tokenization="OPAQUE_PUBLIC_ID",
                       reference={"entityType": "HRM.Assignment", "idSpace": "PUBLIC_UUID"},
                       validation="tenant-bound assignment belonging to worker and cycle population"),
            body_field("componentCode", "STRING", validation="1..40 stable compensation component code"),
            body_field("currencyCode", "STRING", sensitivity="CONFIDENTIAL",
                       validation="ISO 4217 uppercase alpha-3"),
            {**body_field("approvedAmount", "DECIMAL(19,4)", sensitivity="CONFIDENTIAL",
                          validation="canonical decimal string scale <=4; >=0; no binary float"),
             "wireType": "STRING",
             "valueTypeRef": "coding-readiness/decimal-value-types.v1.json#/valueTypes/PostedMoney"},
            body_field("effectiveFrom", "DATE", validation="ISO-8601 business date"),
            body_field("effectiveTo", "DATE", required=False,
                       validation="null or later than effectiveFrom"),
        ],
    })
    ensure_record_schema({
        "schemaId": "WorkforceDemandLine.v1", "kind": "OBJECT",
        "additionalProperties": False,
        "fields": [
            body_field("intervalStart", "TIMESTAMPTZ", validation="RFC3339 instant before intervalEnd"),
            body_field("intervalEnd", "TIMESTAMPTZ", validation="RFC3339 instant after intervalStart"),
            {**body_field("requiredHeadcount", "DECIMAL(12,4)",
                          validation="canonical decimal string scale <=4 and >=0"),
             "wireType": "STRING"},
            body_field("demandUnitCode", "STRING", validation="1..40 published demand unit code"),
            body_field("skillPublicId", "UUID", required=False, sensitivity="RESTRICTED",
                       tokenization="OPAQUE_PUBLIC_ID",
                       reference={"entityType": "PER.Skill", "idSpace": "PUBLIC_UUID"}),
            body_field("organizationPublicId", "UUID", required=False, sensitivity="RESTRICTED",
                       tokenization="OPAQUE_PUBLIC_ID",
                       reference={"entityType": "HRM.Organization", "idSpace": "PUBLIC_UUID"}),
        ],
    })

    # A growth mutation persists a typed, owner-refetchable artifact identity
    # and revision.  A caller-provided digest alone is never the business fact.
    growth_update = operations["modern.growth.profile.update"]["requestSchema"]["body"]
    growth_update[:] = [
        {**body_field("profilePatch", "OBJECT",
                      validation="closed GrowthProfilePatch.v1 object; unknown members rejected"),
         "schemaRef": "GrowthProfilePatch.v1"},
        body_field("evidenceRefs", "ARRAY<UUID>", required=False,
                   sensitivity="RESTRICTED", tokenization="OPAQUE_PUBLIC_ID",
                   reference={"entityType": "SkillsOrLearning", "idSpace": "PUBLIC_UUID"},
                   validation="0..500 owner-authorized evidence references; canonical UUID byte order"),
    ]
    coaching = operations["modern.growth.coaching.record"]["requestSchema"]["body"]
    coaching[:] = [
        {**body_field("content", "OBJECT",
                      validation="closed CoachingNoteContent.v1 object; unknown members rejected"),
         "schemaRef": "CoachingNoteContent.v1"},
        body_field("evidenceRefs", "ARRAY<UUID>", required=False,
                   sensitivity="RESTRICTED", tokenization="OPAQUE_PUBLIC_ID",
                   reference={"entityType": "SkillsOrLearning", "idSpace": "PUBLIC_UUID"},
                   validation="0..500 owner-authorized evidence references; canonical UUID byte order"),
    ]

    # Snapshot publication accepts a closed set of approved line facts, while
    # line identity, order, per-line digest, lineCount and aggregate digest are
    # always generated/recomputed by the owner. Caller-provided variants are
    # not part of the wire contract.
    snapshot_body = operations["modern.compplan.snapshot.publish"]["requestSchema"]["body"]
    existing_snapshot = {field["name"]: field for field in snapshot_body}
    frozen_request_fields = {"planPublicId", "cyclePublicId", "lines"}
    missing_frozen_fields = frozen_request_fields - set(existing_snapshot)
    if missing_frozen_fields:
        raise ValueError(
            "compensation snapshot publish request is missing reviewed fields: "
            + ",".join(sorted(missing_frozen_fields))
        )
    existing_snapshot["planPublicId"]["referenceContract"] = {
        "entityType": "table:prf_cmp_plans", "idSpace": "PUBLIC_UUID",
    }
    legacy_caller_proof_fields = {
        "approvalReceiptId", "effectiveFrom", "contentDigest",
    }
    if legacy_caller_proof_fields <= set(existing_snapshot):
        snapshot_body[:] = [
            existing_snapshot["approvalReceiptId"], existing_snapshot["effectiveFrom"],
            {**existing_snapshot["contentDigest"],
             "validation": "caller assertion only; owner recomputes canonical header+ordered-line digest and rejects mismatch"},
            existing_snapshot["planPublicId"], existing_snapshot["cyclePublicId"],
            {
                "name": "lines", "type": "ARRAY", "required": True,
                "validation": "1..100000 closed approved compensation lines; caller line ID/order/digest/count forbidden",
                "sensitivity": "HIGHLY_RESTRICTED", "tokenization": "FIELD_LEVEL_POLICY",
                "itemSchemaRef": "ApprovedCompensationSnapshotLine.v1",
                "minItems": 1, "maxItems": 100000,
                "canonicalOrder": "REQUEST_ARRAY_ORDER_STABILIZED_AS_SERVER_LINE_SEQUENCE",
                "uniqueBy": ["workerPublicId", "assignmentPublicId", "componentCode", "effectiveFrom"],
            },
        ]
    elif legacy_caller_proof_fields & set(existing_snapshot):
        raise ValueError(
            "compensation snapshot publish has a partial caller approval-proof "
            "contract; either the complete historical triple or the frozen "
            "approved-plan proof model is required"
        )
    else:
        # The accepted successor freezes approval proof on the locked approved
        # plan and copies the complete tuple to the snapshot.  Its absence from
        # the caller body is intentional, but every durable source is required.
        proof_columns = {
            "approval_receipt_public_id", "approval_receipt_revision",
            "approval_outcome", "approval_action", "approval_input_digest",
            "approval_purpose_code", "approval_tenant_id",
        }
        table_columns = {
            table_name: {column["name"] for column in tables[table_name]["columns"]}
            for table_name in ("prf_cmp_plans", "prf_cmp_approved_snapshots")
        }
        for table_name, columns in table_columns.items():
            missing = proof_columns - columns
            if missing:
                raise ValueError(
                    f"compensation frozen approval proof source incomplete: "
                    f"{table_name} missing={sorted(missing)}"
                )
        snapshot_body[:] = [
            existing_snapshot["planPublicId"],
            existing_snapshot["cyclePublicId"],
            existing_snapshot["lines"],
        ]
    snapshot_request = operations["modern.compplan.snapshot.publish"]["requestSchema"]
    snapshot_request["crossFieldRules"] = [
        "body.cyclePublicId MUST equal pathParameters.cycleId after canonical UUID normalization",
        "every line effective range MUST be within the approved cycle and match the worker-assignment relationship",
        *(
            ["body.contentDigest MUST equal the server recomputation over canonical header, ordered lines and per-currency totals"]
            if "contentDigest" in existing_snapshot else
            ["server payloadDigest MUST be recomputed from the locked approved-plan proof, canonical header, ordered lines and per-currency totals"]
        ),
    ]
    snapshot_request["serverDerivedFields"] = {
        "snapshotId": "UUID_V7 generated once and replay-stable",
        "snapshotRevision": "next revision under locked cycle aggregate",
        "lines[].lineId": "UUID_V7 generated once per validated line and replay-stable",
        "lines[].lineSequence": "validated request array index + 1; contiguous 1..lineCount",
        "lines[].lineDigest": "SHA-256 over canonical normalized line fields",
        "lineCount": "validated lines length",
        "currencyTotals": "sum canonical approvedAmount grouped by currencyCode; compared with approved proposals",
        "payloadDigest": "SHA-256 over canonical header, ordered line digests and currencyTotals",
    }

    plan_approve = operations["modern.compplan.plan.approve"]["requestSchema"]
    next(field for field in plan_approve["body"] if field["name"] == "decision")["validation"] = (
        "exact APPROVE decision for this endpoint; rejection uses the approval workflow without creating a plan"
    )
    plan_approve["serverDerivedFields"] = {
        "planId": "UUID_V7 generated once for the immutable approved-plan header and replay-stable",
        "approvalRevision": "exact version refetched from approvalReceiptId under tenant/purpose policy",
        "contentDigest": "server canonical digest of cycle version, approved proposals and budget ledger",
    }

    forecast = operations["modern.wfm.forecast.create"]["requestSchema"]
    forecast["body"] = [
        body_field("businessKey", "STRING", validation="1..160 tenant-unique forecast key"),
        body_field("displayName", "STRING", validation="1..240 locale-neutral fallback characters"),
        body_field("worksitePublicId", "UUID", sensitivity="RESTRICTED", tokenization="OPAQUE_PUBLIC_ID",
                   reference={"entityType": "HRM.Location", "idSpace": "PUBLIC_UUID"}),
        body_field("periodStart", "TIMESTAMPTZ", validation="RFC3339 instant before periodEnd"),
        body_field("periodEnd", "TIMESTAMPTZ", validation="RFC3339 instant after periodStart"),
        body_field("sourceDigest", "SHA256", validation="caller assertion; server recomputes canonical header and lines"),
        body_field("demandSourceId", "UUID", sensitivity="RESTRICTED", tokenization="OPAQUE_PUBLIC_ID",
                   reference={"entityType": "SYS.Connector", "idSpace": "PUBLIC_UUID"}),
        body_field("sourceTimezone", "STRING", validation="IANA timezone used by source buckets"),
        {
            "name": "demandLines", "type": "ARRAY", "required": True,
            "validation": "1..100000 closed demand bucket lines; caller line ID/order/digest forbidden",
            "sensitivity": "RESTRICTED", "tokenization": "FIELD_LEVEL_POLICY",
            "itemSchemaRef": "WorkforceDemandLine.v1", "minItems": 1, "maxItems": 100000,
            "canonicalOrder": "REQUEST_ARRAY_ORDER_STABILIZED_AS_SERVER_LINE_SEQUENCE",
            "uniqueBy": ["intervalStart", "intervalEnd", "demandUnitCode", "skillPublicId", "organizationPublicId"],
        },
    ]
    forecast["crossFieldRules"] = [
        "each line interval MUST be within periodStart/periodEnd and intervalEnd > intervalStart",
        "body.sourceDigest MUST equal server recomputation over canonical header and ordered line digests",
    ]
    forecast["serverDerivedFields"] = {
        "forecastRevision": "atomic tenant+businessKey revision counter allocation",
        "demandLines[].lineId": "UUID_V7 generated once and replay-stable",
        "demandLines[].lineSequence": "validated request array index + 1",
        "demandLines[].lineDigest": "SHA-256 over canonical normalized line members",
    }

    # Validation engines own result counts and publication ports own canonical
    # schedule IDs.  Public callers may supply fences/inputs, never outputs.
    validate_body = operations["modern.wfm.schedule.validate"]["requestSchema"]["body"]
    validate_body[:] = [field for field in validate_body
                        if field["name"] not in {"blockingViolationCount", "fairnessMetricCount",
                                                "fairnessEvaluationId"}]
    suite_field = next(field for field in validate_body
                       if field["name"] in {"validationSuiteVersion", "suiteVersion"})
    suite_field["name"] = "suiteVersion"
    validate_request = operations["modern.wfm.schedule.validate"]["requestSchema"]
    validate_request["serverDerivedFields"] = {
        "inputDigest": "server recomputes candidate + immutable input snapshot + policy + suite digest and compares caller assertion",
        "blockingViolationCount": "registered constraint engine result; caller field forbidden",
        "fairnessMetricCount": "registered constraint engine result; caller field forbidden",
        "resultDigest": "server digest of normalized engine result",
        "evaluationReceiptId": "owner UUID generated once and replay-stable",
    }
    submit_body = operations["modern.wfm.schedule.submit"]["requestSchema"]["body"]
    existing_submit = {field["name"]: field for field in submit_body}
    submit_body[:] = [
        body_field("evaluationReceiptId", "UUID", sensitivity="RESTRICTED",
                   tokenization="OPAQUE_PUBLIC_ID",
                   reference={"entityType": "table:tme_wfm_constraint_evaluation_receipts",
                              "idSpace": "PUBLIC_UUID"},
                   validation="exact tenant-bound passing evaluation receipt for candidate revision"),
        {**existing_submit["submissionDigest"],
         "validation": "caller assertion; owner recomputes candidate+passing-evaluation submission digest"},
        existing_submit["effectiveDate"],
    ]
    submit_request = operations["modern.wfm.schedule.submit"]["requestSchema"]
    submit_request["crossFieldRules"] = [
        "evaluationReceiptId MUST resolve to PASSED for the exact candidateId and If-Match candidate revision",
        "submissionDigest MUST equal the owner recomputation over candidate and evaluation receipt digests",
    ]
    submit_request["serverDerivedFields"] = {
        "approvalRequestId": "owner UUID generated once and replay-stable",
        "candidateRevision": "locked candidate aggregate version/revision",
        "candidateDigest": "locked candidate digest",
    }
    publish_body = operations["modern.wfm.schedule.publish"]["requestSchema"]["body"]
    publish_body[:] = [field for field in publish_body
                       if field["name"] in {"approvalReceiptId", "effectiveFrom", "contentDigest",
                                            "schedulePeriodPublicId"}]

    onboarding_create = operations["modern.onboarding.template.create"]["requestSchema"]["body"]
    onboarding_create[:] = [field for field in onboarding_create
                            if field["name"] not in {
                                "templateVersionId", "version", "taskManifestDigest"
                            }]
    onboarding_create.extend([
        body_field("version", "BIGINT", validation="> 0 immutable template version"),
        body_field("taskManifestDigest", "SHA256", validation="canonical digest of validated task definitions"),
    ])
    onboarding_publish = operations["modern.onboarding.template.publish"]["requestSchema"]["body"]
    onboarding_publish[:] = [field for field in onboarding_publish
                             if field["name"] != "templateVersionId"]
    benefits_create = operations["modern.benefits.plan.create"]["requestSchema"]["body"]
    benefits_create[:] = [field for field in benefits_create if field["name"] not in {
        "workerPublicId", "version", "contentDigest"
    }]
    benefits_create.extend([
        body_field("version", "BIGINT", validation="> 0 immutable plan version"),
        body_field("contentDigest", "SHA256", validation="canonical plan definition digest"),
    ])
    benefits_publish = operations["modern.benefits.plan.publish"]["requestSchema"]["body"]
    benefits_publish[:] = [field for field in benefits_publish if field["name"] != "workerPublicId"]
    skills_create = operations["modern.skills.taxonomy.create"]["requestSchema"]["body"]
    skills_create[:] = [field for field in skills_create
                        if field["name"] not in {"version", "contentDigest"}]
    skills_create.extend([
        body_field("version", "BIGINT", validation="> 0 immutable taxonomy version"),
        body_field("contentDigest", "SHA256", validation="canonical taxonomy content digest"),
    ])

    # Verification mutates only verification state/version.  The immutable
    # evidence facts are compared under the command decision receipt and are
    # never rewritten from caller input.
    skills_verify = operations["modern.skills.evidence.verify"]["requestSchema"]["body"]
    skills_verify[:] = [field for field in skills_verify
                        if field["name"] in {"evidenceDigest", "sourceRevision"}]
    next(field for field in skills_verify if field["name"] == "evidenceDigest")["validation"] = (
        "must equal the locked immutable evidence_digest; comparison outcome is persisted in the command decision receipt"
    )
    next(field for field in skills_verify if field["name"] == "sourceRevision")["validation"] = (
        "must equal the locked immutable source_revision; comparison outcome is persisted in the command decision receipt"
    )
    tables["prf_skl_worker_evidence"]["immutability"] = (
        "IMMUTABLE_EVIDENCE_FACTS; STATUS_AND_AGGREGATE_VERSION_CAS_ONLY"
    )

    # Learning offering authoring is not worker-specific.  Enrollment creates
    # a new assignment only after selecting one exact published offering.
    offering_create = operations["modern.learning.offering.create"]["requestSchema"]["body"]
    offering_create[:] = [field for field in offering_create if field["name"] != "workerPublicId"]
    self_enroll = operations["modern.learning.self.enroll"]["requestSchema"]["body"]
    self_enroll[:] = [field for field in self_enroll if field["name"] != "selectionCode"]
    if not any(field["name"] == "offeringId" for field in self_enroll):
        self_enroll.insert(0, body_field(
            "offeringId", "UUID", sensitivity="RESTRICTED", tokenization="OPAQUE_PUBLIC_ID",
            reference={"entityType": "table:prf_lrn_offerings", "idSpace": "PUBLIC_UUID"},
            validation="exact PUBLISHED offering in the same tenant and effective enrollment window",
        ))

    # The path owns opportunity identity; accepting the same UUID again in the
    # body permits contradictory selectors.  Application identity is generated
    # once and the root pre-state is NONE.
    opportunity_apply = operations["modern.opportunity.apply"]["requestSchema"]["body"]
    opportunity_apply[:] = [field for field in opportunity_apply if field["name"] != "opportunityId"]

    # Route selectors identify the local version/task roots, not generic owner
    # UUIDs with the same shape.
    assignment_body = operations["modern.onboarding.journey.assign"]["requestSchema"]["body"]
    next(field for field in assignment_body if field["name"] == "templateVersionId")[
        "referenceContract"] = {"entityType": "table:ppl_jny_template_versions", "idSpace": "PUBLIC_UUID"}
    task_path = operations["modern.onboarding.task.complete"]["requestSchema"]["pathParameters"]
    next(field for field in task_path if field["name"] == "taskId")["referenceContract"] = {
        "entityType": "table:ppl_jny_assignment_tasks", "idSpace": "PUBLIC_UUID"
    }

    # Hiring must identify the accepted offer explicitly.  Candidate identity,
    # correlation and approval receipt are not aliases for an offer.
    hire = operations["modern.recruiting.hire.record"]
    next(field for field in hire["requestSchema"]["body"]
         if field["name"] == "decision")["validation"] = (
        "exact HIRED decision; rejection is a candidate-stage transition and cannot create a hire request"
    )
    if not any(field["name"] == "offerId" for field in hire["requestSchema"]["body"]):
        hire["requestSchema"]["body"].append({
            "name": "offerId", "type": "UUID", "required": True,
            "validation": "issued offer for the selected candidate case; same tenant and purpose",
            "sensitivity": "RESTRICTED", "tokenization": "OPAQUE_PUBLIC_ID",
            "referenceContract": {"entityType": "table:ppl_rec_offers", "idSpace": "PUBLIC_UUID"},
        })

    # This route is keyed by a stable use-case key stored on the policy root,
    # not by an unrelated UUID-shaped external identity.
    kill = operations["modern.ai.kill.switch"]
    use_case = next(field for field in kill["requestSchema"]["pathParameters"]
                    if field["name"] == "useCaseKey")
    use_case.update({
        "type": "STRING", "validation": "1..160 stable AI use-case key",
        "sensitivity": "INTERNAL", "tokenization": "NONE",
    })
    use_case.pop("referenceContract", None)
    budget_body = operations["modern.compplan.budget.allocate"]["requestSchema"]["body"]
    if any(field["name"] == "currency" for field in budget_body):
        budget_body[:] = [field for field in budget_body if field["name"] != "currencyCode"]
    # Solver outputs, constraint results, approval receipts and canonical
    # schedule identities are never accepted from the optimization requester.
    optimize_body = operations["modern.wfm.schedule.optimize"]["requestSchema"]["body"]
    optimize_output_only = {
        "blockingViolationCount", "fairnessMetricCount", "policyVersionId",
        "approvalReceiptId", "schedulePeriodPublicId",
    }
    optimize_body[:] = [field for field in optimize_body
                        if field["name"] not in optimize_output_only]
    if set(COMMAND_WRITES) != {key for key, value in operations.items() if value["mode"] == "COMMAND"}:
        raise ValueError("command scope drift from causal successor")
    for operation_id, writes in COMMAND_WRITES.items():
        operation = operations[operation_id]
        operation["writesTables"] = list(writes)
        operation["readsTables"] = list(READ_OVERRIDES.get(operation_id, operation.get("readsTables", [])))
        operation["eventNames"] = [event_name(operation_id)]
        operation["aggregateRootTable"] = aggregate_root_for(operation_id)

    payloads = []
    for operation_id in sorted(COMMAND_WRITES):
        operation = operations[operation_id]
        event_root_override = EVENT_AGGREGATE_ROOT_OVERRIDES.get(operation_id)
        root = tables[(event_root_override or {}).get("rootTable", aggregate_root_for(operation_id))]
        root_identity = {"entityType": "table:" + root["tableName"], "idSpace": "PUBLIC_UUID"}
        fields = [
            {"name": "aggregateId", "type": "UUID", "required": True,
             "validation": "exact post-commit aggregate-root public UUID",
             "sensitivity": "INTERNAL", "tokenization": "OPAQUE_PUBLIC_ID",
             "referenceContract": root_identity,
             "sourcePhysicalField": root["tableName"] + ".public_id"},
            {"name": "fromState", "type": "STRING", "required": True,
             "validation": "registered pre-state or NONE", "sensitivity": "INTERNAL", "tokenization": "NONE",
             "sourceTransitionPhase": "PRE",
             **({"sourceTransitionRootTable": root["tableName"],
                 "sourceTransitionStates": event_root_override["preStates"]}
                if event_root_override else {})},
            {"name": "toState", "type": "STRING", "required": True,
             "validation": "exact physical post-state accepted by table CHECK", "sensitivity": "INTERNAL", "tokenization": "NONE",
             "sourceTransitionPhase": "POST",
             **({"sourceTransitionRootTable": root["tableName"],
                 "sourceTransitionStates": event_root_override["postStates"]}
                if event_root_override else {})},
            {"name": "aggregateVersion", "type": "BIGINT", "required": True,
             "validation": ">= 1 post-commit CAS version", "sensitivity": "INTERNAL", "tokenization": "NONE",
             "sourcePhysicalField": root["tableName"] + ".aggregate_version"},
            {"name": "occurredAt", "type": "TIMESTAMPTZ", "required": True,
             "validation": "owner transaction clock", "sensitivity": "INTERNAL", "tokenization": "NONE",
             "sourceOwnerContext": "ownerClock.transactionNow"},
            {"name": "correlationId", "type": "UUID", "required": True,
             "validation": "command correlation only; never business identity", "sensitivity": "INTERNAL", "tokenization": "NONE",
             "sourceRequestField": "headers.X-Correlation-ID"},
        ]
        used_names = {field["name"] for field in fields}
        if operation_id not in EVENT_FACT_SOURCES:
            raise ValueError(f"unreviewed causal event payload: {operation_id}")
        common_columns = {row["name"]: row for row in doc["commonTableContract"]["columns"]}
        for public_name, physical_source in EVENT_FACT_SOURCES[operation_id]:
            if public_name in used_names:
                raise ValueError(f"duplicate causal event field: {operation_id} {public_name}")
            source_table, source_column = physical_source.split(".", 1)
            if source_table not in operation["writesTables"] + operation["readsTables"]:
                raise ValueError(
                    f"causal event source is not declared read/write: {operation_id} {physical_source}"
                )
            source_spec = next((row for row in tables[source_table]["columns"]
                                if row["name"] == source_column), None)
            if source_spec is None:
                source_spec = common_columns.get(source_column)
            if source_spec is None:
                raise ValueError(f"causal event physical field missing: {operation_id} {physical_source}")
            sql_type = source_spec["sqlType"].upper()
            if sql_type == "UUID[]":
                event_type_name = "ARRAY"
            elif sql_type.startswith(("VARCHAR", "CHAR", "TEXT")):
                event_type_name = "SHA256" if source_column.endswith(("digest", "hash")) else "STRING"
            elif sql_type.startswith(("NUMERIC", "DECIMAL")):
                event_type_name = sql_type
            else:
                event_type_name = sql_type
            event_field: dict[str, Any] = {
                "name": public_name, "type": event_type_name,
                "required": (source_spec.get("nullable") is False
                             or (operation_id, public_name) in EVENT_REQUIRED_OVERRIDES),
                "validation": "exact committed owner field; no caller echo or same-type substitution",
                "sensitivity": source_spec.get("sensitivity", "INTERNAL"),
                "tokenization": source_spec.get("tokenization", "NONE"),
                "sourcePhysicalField": physical_source,
                "sourceResolution": ("SAME_TRANSACTION_WRITE"
                                     if source_table in operation["writesTables"]
                                     else "TENANT_BOUND_DECLARED_READ_REFETCH"),
                "exposure": "OWNER_SCOPED_OUTBOX_WITH_FIELD_SENSITIVITY_ENFORCEMENT",
            }
            if event_type_name == "ARRAY":
                event_field["itemType"] = "UUID"
            reference = source_spec.get("referenceContract")
            if source_column == "public_id":
                reference = {"entityType": "table:" + source_table, "idSpace": "PUBLIC_UUID"}
            if reference:
                event_field["referenceContract"] = copy.deepcopy(reference)
            fields.append(event_field)
            used_names.add(public_name)
        consumer_policy = EVENT_CONSUMER_POLICIES.get(operation_id)
        if consumer_policy is None:
            raise ValueError(f"unreviewed event consumer policy: {operation_id}")
        payloads.append({
            "eventName": event_name(operation_id),
            "capabilityId": operation["capabilityId"],
            "session": operation["session"],
            "eventType": event_type(operation_id),
            "schemaVersion": 2,
            "topic": event_topic(operation_id),
            "payloadSchemaId": event_type(operation_id) + ".Payload.v2",
            "additionalProperties": False,
            "fields": fields,
            "deliveryPolicy": {
                "audience": ("EXPLICIT_CROSS_SESSION_ALLOWLIST" if len(consumer_policy["allowedConsumerSessions"]) > 1
                             else "SAME_BOUNDED_CONTEXT_ONLY"),
                "allowedConsumerSessions": list(consumer_policy["allowedConsumerSessions"]),
                "allowedPurposeCodes": list(consumer_policy["purposeCodes"]),
                "pep": consumer_policy["pep"],
                "fieldAllowlist": [field["name"] for field in fields],
                "restrictedFields": [field["name"] for field in fields
                                     if field["sensitivity"] in {
                                         "RESTRICTED", "CONFIDENTIAL", "HIGHLY_RESTRICTED"}],
                "sensitivePayloadRule": "NO_RAW_PII_OR_PAY_AMOUNTS; OPAQUE_IDS_NONREVERSIBLE_DIGESTS_AND_SAME_CONTEXT_CAS_FACTS_ONLY",
            },
            "consumerRefetchPolicy": copy.deepcopy(consumer_policy),
            "emittedOnTransitionIds": list(operation["stateTransitionIds"]),
            "emittedByOperationIds": [operation_id],
            "causalRule": "SAME_TRANSACTION_POST_COMMIT_ROOT_SNAPSHOT_ONLY",
        })

    def build_additional_payload(*, event_type_name: str, capability_id: str, session: str,
                                 root_name: str, facts: list[tuple[str, str]],
                                 policy: dict[str, Any], allowed_sources: set[str],
                                 transition_ids: list[str], emitted_by_operations: list[str],
                                 emitted_by_handlers: list[str], condition: str,
                                 request_correlation: bool,
                                 pre_states: list[str], post_states: list[str]) -> dict[str, Any]:
        root = tables[root_name]
        common_columns = {row["name"]: row for row in doc["commonTableContract"]["columns"]}
        fields: list[dict[str, Any]] = [
            {"name": "aggregateId", "type": "UUID", "required": True,
             "validation": "exact post-commit aggregate-root public UUID",
             "sensitivity": "INTERNAL", "tokenization": "OPAQUE_PUBLIC_ID",
             "referenceContract": {"entityType": "table:" + root_name, "idSpace": "PUBLIC_UUID"},
             "sourcePhysicalField": root_name + ".public_id"},
            {"name": "fromState", "type": "STRING", "required": True,
             "validation": "registered pre-state", "sensitivity": "INTERNAL", "tokenization": "NONE",
             "sourceTransitionPhase": "PRE", "sourceTransitionRootTable": root_name,
             "sourceTransitionStates": list(pre_states)},
            {"name": "toState", "type": "STRING", "required": True,
             "validation": "exact physical post-state accepted by table CHECK",
             "sensitivity": "INTERNAL", "tokenization": "NONE", "sourceTransitionPhase": "POST",
             "sourceTransitionRootTable": root_name, "sourceTransitionStates": list(post_states)},
            {"name": "aggregateVersion", "type": "BIGINT", "required": True,
             "validation": ">= 1 post-commit CAS version", "sensitivity": "INTERNAL", "tokenization": "NONE",
             "sourcePhysicalField": root_name + ".aggregate_version"},
            {"name": "occurredAt", "type": "TIMESTAMPTZ", "required": True,
             "validation": "owner transaction clock", "sensitivity": "INTERNAL", "tokenization": "NONE",
             "sourceOwnerContext": "ownerClock.transactionNow"},
            {"name": "correlationId", "type": "UUID", "required": True,
             "validation": "causation correlation only; never business identity",
             "sensitivity": "INTERNAL", "tokenization": "NONE",
             **({"sourceRequestField": "headers.X-Correlation-ID"} if request_correlation else
                {"sourceOwnerContext": "handlerContext.causationCorrelationId"})},
        ]
        used = {field["name"] for field in fields}
        for public_name, physical_source in facts:
            if public_name in used:
                raise ValueError(f"duplicate additional event field: {event_type_name} {public_name}")
            source_table, source_column = physical_source.split(".", 1)
            if source_table not in allowed_sources:
                raise ValueError(
                    f"additional event source not in reviewed transaction: {event_type_name} {physical_source}"
                )
            source_spec = next((row for row in tables[source_table]["columns"]
                                if row["name"] == source_column), None) or common_columns.get(source_column)
            if source_spec is None:
                raise ValueError(f"additional event field source missing: {event_type_name} {physical_source}")
            sql_type = source_spec["sqlType"].upper()
            if sql_type == "UUID[]":
                public_type = "ARRAY"
            elif sql_type.startswith(("VARCHAR", "CHAR", "TEXT")):
                public_type = "SHA256" if source_column.endswith(("digest", "hash")) else "STRING"
            elif sql_type.startswith(("NUMERIC", "DECIMAL")):
                public_type = sql_type
            else:
                public_type = sql_type
            field: dict[str, Any] = {
                "name": public_name, "type": public_type, "required": True,
                "validation": "exact committed owner field under the stated event condition",
                "sensitivity": source_spec.get("sensitivity", "INTERNAL"),
                "tokenization": source_spec.get("tokenization", "NONE"),
                "sourcePhysicalField": physical_source,
                "sourceResolution": "SAME_TRANSACTION_WRITE_OR_LOCKED_OWNER_READ",
                "exposure": "OWNER_SCOPED_OUTBOX_WITH_FIELD_SENSITIVITY_ENFORCEMENT",
            }
            if public_type == "ARRAY":
                field["itemType"] = "UUID"
            reference = source_spec.get("referenceContract")
            if source_column == "public_id":
                reference = {"entityType": "table:" + source_table, "idSpace": "PUBLIC_UUID"}
            if reference:
                field["referenceContract"] = copy.deepcopy(reference)
            fields.append(field)
            used.add(public_name)
        event_name_value = event_type_name + ".v2"
        topic_value = "dwp.hris.modern." + re.sub(r"(?<!^)(?=[A-Z])", "-", event_type_name).lower() + ".v2"
        return {
            "eventName": event_name_value, "capabilityId": capability_id, "session": session,
            "eventType": event_type_name, "schemaVersion": 2, "topic": topic_value,
            "payloadSchemaId": event_type_name + ".Payload.v2", "additionalProperties": False,
            "fields": fields,
            "deliveryPolicy": {
                "audience": ("EXPLICIT_CROSS_SESSION_ALLOWLIST"
                             if len(policy["allowedConsumerSessions"]) > 1 else "SAME_BOUNDED_CONTEXT_ONLY"),
                "allowedConsumerSessions": list(policy["allowedConsumerSessions"]),
                "allowedPurposeCodes": list(policy["purposeCodes"]), "pep": policy["pep"],
                "fieldAllowlist": [field["name"] for field in fields],
                "restrictedFields": [field["name"] for field in fields
                                     if field["sensitivity"] in {
                                         "RESTRICTED", "CONFIDENTIAL", "HIGHLY_RESTRICTED"}],
                "sensitivePayloadRule": "NO_RAW_PII_OR_PAY_AMOUNTS; OPAQUE_IDS_NONREVERSIBLE_DIGESTS_AND_SAME_CONTEXT_CAS_FACTS_ONLY",
            },
            "consumerRefetchPolicy": copy.deepcopy(policy),
            "emittedOnTransitionIds": transition_ids,
            "emittedByOperationIds": emitted_by_operations,
            "emittedByInternalHandlerIds": emitted_by_handlers,
            "emissionCondition": condition,
            "causalRule": "SAME_TRANSACTION_POST_COMMIT_ROOT_SNAPSHOT_ONLY",
        }

    for operation_id, additions in CONDITIONAL_COMMAND_EVENTS.items():
        operation = operations[operation_id]
        for addition in additions:
            additional_name = addition["eventType"] + ".v2"
            operation["eventNames"].append(additional_name)
            payloads.append(build_additional_payload(
                event_type_name=addition["eventType"], capability_id=operation["capabilityId"],
                session=operation["session"], root_name=addition["rootTable"], facts=addition["facts"],
                policy=addition["policy"],
                allowed_sources=set(operation["readsTables"] + operation["writesTables"]),
                transition_ids=list(operation["stateTransitionIds"]),
                emitted_by_operations=[operation_id], emitted_by_handlers=[],
                condition=addition["condition"], request_correlation=True,
                pre_states=addition["preStates"], post_states=addition["postStates"],
            ))

    materialized_handlers: list[dict[str, Any]] = []
    for handler_id, handler in INTERNAL_EVENT_HANDLERS.items():
        payloads.append(build_additional_payload(
            event_type_name=handler["eventType"], capability_id=handler["capabilityId"],
            session=handler["session"], root_name=handler["aggregateRootTable"], facts=handler["facts"],
            policy=handler["policy"],
            allowed_sources=set(handler["readsTables"] + handler["writesTables"]),
            transition_ids=[handler["transitionId"]], emitted_by_operations=[],
            emitted_by_handlers=[handler_id],
            condition="ONLY_AFTER_ALL_OWNER_OR_SCHEDULER_ASSERTIONS_AND_DML_STEPS_SUCCEED",
            request_correlation=False,
            pre_states=handler["preStates"], post_states=handler["postStates"],
        ))
        materialized = copy.deepcopy(handler)
        materialized["emits"] = [handler["eventType"] + ".v2"]
        materialized["aggregateRoot"] = {
            "table": handler["aggregateRootTable"], "publicIdColumn": "public_id",
            "versionColumn": "aggregate_version", "stateColumn": handler["stateColumn"],
            "tenantFilter": "tenant_id = ownerContext.tenantId",
            "versionFilter": "aggregate_version = handlerContext.expectedAggregateVersion",
        }
        materialized_handlers.append(materialized)
    doc["internalConsumerHandlers"] = materialized_handlers
    doc["scope"]["internalConsumerHandlers"] = len(materialized_handlers)
    events["internalEventHandlers"] = [
        {"handlerId": handler["handlerId"], "trigger": handler["trigger"],
         "eventName": handler["eventType"] + ".v2", "session": handler["session"]}
        for handler in materialized_handlers
    ]
    events["scope"]["publicCommandPrimaryEvents"] = len(COMMAND_WRITES)
    events["scope"]["conditionalCommandEvents"] = sum(map(len, CONDITIONAL_COMMAND_EVENTS.values()))
    events["scope"]["internalHandlerEvents"] = len(materialized_handlers)
    events["scope"]["events"] = len(payloads)
    events["eventPayloadSchemas"] = payloads


def apply_module_successor(doc: dict[str, Any], exact: dict[str, Any]) -> None:
    """Project exact operation ownership into a module's human-facing SSOT."""
    exact_ops = {operation["operationId"]: operation for operation in exact["operationBindings"]}
    exact_tables = {table["tableName"]: table for table in exact["tableSpecifications"]}
    for capability in doc["capabilities"]:
        commands = [operation for operation in capability["operations"] if operation["mode"] == "COMMAND"]
        transitions = {
            transition["operationId"]: transition
            for machine in capability["stateMachines"]
            for transition in machine["transitions"]
        }
        new_transitions = []
        new_events = []
        for operation in capability["operations"]:
            operation_id = operation["operationId"]
            exact_operation = exact_ops[operation_id]
            operation["readsTables"] = list(exact_operation.get("readsTables", []))
            operation["writesTables"] = list(exact_operation.get("writesTables", []))
            if operation["mode"] == "QUERY":
                continue
            root_name = exact_operation["aggregateRootTable"]
            state_column = state_column_for(exact_tables[root_name], operation_id)
            before, after, source = STATE[operation_id]
            transition = transitions[operation_id]
            transition.update({
                "from": "|".join(before), "to": "|".join(after),
                "aggregateRootTable": root_name, "stateColumn": state_column,
                "preStates": list(before), "postStates": list(after),
                "postStateSource": source,
                "postStateSink": f"{root_name}.{state_column}",
                "guard": "tenant/root selector, expected version, authorization population, owner policy and exact post-state CHECK",
            })
            new_transitions.append(transition)
            operation["aggregateRootTable"] = root_name
            operation["transitionIds"] = [transition["transitionId"]]
            operation["emits"] = list(exact_operation["eventNames"])
            for emitted_name in operation["emits"]:
                event = (next(schema for schema in exact.get("_causalEventSchemas", [])
                              if schema["eventName"] == emitted_name)
                         if exact.get("_causalEventSchemas") else None)
                event_type_name = emitted_name.rsplit(".v", 1)[0]
                event_root = root_name
                if event:
                    aggregate_field = next(
                        field for field in event["fields"] if field["name"] == "aggregateId"
                    )
                    physical = aggregate_field.get("sourcePhysicalField", "")
                    if isinstance(physical, str) and physical.endswith(".public_id"):
                        event_root = physical.split(".", 1)[0]
                new_events.append({
                    "name": emitted_name, "type": event_type_name,
                    "version": 2, "topic": (event["topic"] if event else event_topic(operation_id)),
                    "aggregate": "table:" + event_root,
                    "aggregateRootTable": event_root,
                    "payloadRequired": ([field["name"] for field in event["fields"] if field.get("required")]
                                        if event else ["aggregateId", "fromState", "toState", "aggregateVersion", "occurredAt", "correlationId"]),
                    "emittedOn": [transition["transitionId"]],
                    "emissionCondition": (event.get("emissionCondition") if event else None),
                    "causalRule": "SAME_TRANSACTION_POST_COMMIT_ROOT_SNAPSHOT_ONLY",
                })
        internal_handlers = [copy.deepcopy(handler) for handler in exact.get("internalConsumerHandlers", [])
                             if handler["capabilityId"] == capability["capabilityId"]]
        for handler in internal_handlers:
            new_transitions.append({
                "transitionId": handler["transitionId"], "operationId": handler["handlerId"],
                "from": "|".join(handler["preStates"]), "to": "|".join(handler["postStates"]),
                "aggregateRootTable": handler["aggregateRootTable"],
                "stateColumn": handler["stateColumn"], "preStates": list(handler["preStates"]),
                "postStates": list(handler["postStates"]), "postStateSource": "OWNER_OR_SCHEDULER_ACK",
                "postStateSink": handler["aggregateRootTable"] + "." + handler["stateColumn"],
                "guard": "; ".join(handler["ownerAssertions"]),
            })
            event = next(schema for schema in exact.get("_causalEventSchemas", [])
                         if schema["eventName"] == handler["emits"][0])
            event_root = handler["aggregateRootTable"]
            aggregate_field = next(
                field for field in event["fields"] if field["name"] == "aggregateId"
            )
            physical = aggregate_field.get("sourcePhysicalField", "")
            if isinstance(physical, str) and physical.endswith(".public_id"):
                event_root = physical.split(".", 1)[0]
            new_events.append({
                "name": event["eventName"], "type": event["eventType"], "version": 2,
                "topic": event["topic"], "aggregate": "table:" + event_root,
                "aggregateRootTable": event_root,
                "payloadRequired": [field["name"] for field in event["fields"] if field.get("required")],
                "emittedOn": [handler["transitionId"]],
                "emittedByInternalHandler": handler["handlerId"],
                "causalRule": "SAME_TRANSACTION_POST_COMMIT_ROOT_SNAPSHOT_ONLY",
            })
        capability["internalConsumerHandlers"] = internal_handlers
        capability["stateMachines"] = [{
            "stateMachineId": capability["stateMachines"][0]["stateMachineId"],
            "aggregate": "OPERATION_SCOPED_PHYSICAL_ROOTS_V2",
            "initialState": "SEE_EACH_TRANSITION_PRE_STATES",
            "terminalStates": sorted(
                {state for operation in commands for state in STATE[operation["operationId"]][1]}
                | {state for handler in internal_handlers for state in handler["postStates"]}
            ),
            "transitions": new_transitions,
        }]
        capability["events"] = new_events
        module_table_names = {table["name"] for table in capability["tables"]}
        for exact_table in exact["tableSpecifications"]:
            if (exact_table["capabilityId"] != capability["capabilityId"]
                    or exact_table["tableName"] in module_table_names):
                continue
            capability["tables"].append({
                "name": exact_table["tableName"], "kind": exact_table["kind"],
                "idColumn": exact_table["idColumn"]["name"],
                "effectiveTime": exact_table["effectiveTime"],
                "immutability": exact_table["immutability"],
                "foreignKeyBoundaries": [
                    f"{fk['mode']}:{'|'.join(fk['columns'])}->{fk['target']}"
                    for fk in exact_table["foreignKeys"]
                ],
                "uniqueKeys": ["(" + ",".join(key["columns"]) + ")"
                               for key in exact_table["uniqueKeys"]],
                "checks": [check["expression"] for check in exact_table["checks"]],
                "indexes": ["(" + ",".join(index["columns"]) + ")"
                            for index in exact_table["indexes"]],
                "retentionClass": exact_table["retentionPolicyRef"],
                "rowSecurity": "INHERIT_EXACT_DEFAULT",
            })
            module_table_names.add(exact_table["tableName"])
        table_docs = {table["name"]: table for table in capability["tables"]}
        for table_name, module_table in table_docs.items():
            exact_table = exact_tables[table_name]
            # The exact physical contract is the only table-shape successor.
            # Project existing as well as newly introduced tables so a legacy
            # prose row cannot retain stale immutability/FK/lifecycle claims.
            module_table.update({
                "kind": exact_table["kind"],
                "idColumn": exact_table["idColumn"]["name"],
                "effectiveTime": exact_table["effectiveTime"],
                "immutability": exact_table["immutability"],
                "foreignKeyBoundaries": [
                    f"{fk['mode']}:{'|'.join(fk['columns'])}->{fk['target']}"
                    for fk in exact_table["foreignKeys"]
                ],
                "uniqueKeys": ["(" + ",".join(key["columns"]) + ")"
                               for key in exact_table["uniqueKeys"]],
                "checks": [check["expression"] for check in exact_table["checks"]],
                "indexes": ["(" + ",".join(index["columns"]) + ")"
                            for index in exact_table["indexes"]],
                "retentionClass": exact_table["retentionPolicyRef"],
                "rowSecurity": "INHERIT_EXACT_DEFAULT",
            })


def build_causal_contract(doc: dict[str, Any], events: dict[str, Any]) -> dict[str, Any]:
    tables = {table["tableName"]: table for table in doc["tableSpecifications"]}
    schemas = {schema["schemaId"]: schema
               for schema in doc["recordSchemas"] + doc["responseSchemas"]}
    lineages = {row["operationId"]: row for row in doc["operationFieldLineage"]}
    event_schemas = {row["eventName"]: row for row in events["eventPayloadSchemas"]}
    rows = []
    for operation in sorted(doc["operationBindings"], key=lambda row: row["operationId"]):
        operation_id = operation["operationId"]
        request_fields = expanded_request_fields(operation, schemas)
        if operation["mode"] == "QUERY":
            lineage = lineages[operation_id]
            selectors = _selectors(operation, request_fields, None, lineage, tables, doc["commonTableContract"])
            read_plan = {
                "tables": list(operation.get("readsTables", [])),
                "writesForbidden": True, "receiptsForbidden": True,
                "outboxForbidden": True, "eventsForbidden": True,
                "transactionMode": "READ_ONLY",
                "pagination": {
                    "mode": "SIGNED_KEYSET_CURSOR",
                    "stableTieBreaker": operation["readsTables"][0] + ".public_id",
                    "defaultLimit": 50, "maximumLimit": 200,
                },
                "effectiveTime": {
                    "source": "queryParameters.asOf OR ownerClock.transactionNow",
                    "rule": "APPLY_EACH_TABLE_DECLARED_EFFECTIVE_TIME_PREDICATE",
                },
            }
            rows.append({
                "operationId": operation_id, "mode": "QUERY",
                "targetSelectors": selectors,
                "requiredInputUses": _input_uses(
                    operation, request_fields, None, lineage, None, selectors
                ),
                "mutationFieldSet": [], "causalEvents": [],
                "readPlan": read_plan,
            })
            continue
        root_name = operation["aggregateRootTable"]
        state_column = state_column_for(tables[root_name], operation_id)
        before, after, transition_source = STATE[operation_id]
        lineage = lineages[operation_id]
        selectors = _selectors(
            operation, request_fields, root_name, lineage, tables, doc["commonTableContract"]
        )
        required_columns = [row["target"] for row in lineage["requiredColumnSources"]]
        physical_mutations = [row["target"] for row in lineage.get("mutationFieldSources", [])]
        mutation_fields = sorted(set(required_columns + physical_mutations + [f"{root_name}.{state_column}"]))
        operation_events = [event_schemas[name] for name in operation["eventNames"]]
        primary_event = event_schemas[event_name(operation_id)]
        input_uses = _input_uses(operation, request_fields, root_name, lineage, primary_event, selectors)

        def causal_event(event: dict[str, Any]) -> dict[str, Any]:
            aggregate_field = next(field for field in event["fields"]
                                   if field["name"] == "aggregateId")
            aggregate_physical = aggregate_field.get("sourcePhysicalField")
            if not isinstance(aggregate_physical, str) or not aggregate_physical.endswith(".public_id"):
                raise ValueError(f"event aggregate is not an exact physical public ID: {event['eventName']}")
            event_root = aggregate_physical.split(".", 1)[0]
            version_field = next(field for field in event["fields"]
                                 if field["name"] == "aggregateVersion")
            version_physical = version_field.get("sourcePhysicalField")
            state_field = next(field for field in event["fields"]
                               if field["name"] in {"toState", "toStage"})
            state_root = state_field.get("sourceTransitionRootTable") or event_root
            event_state_column = state_column_for(tables[state_root], operation_id)
            foreign_references = _event_foreign_references(
                event, event_root, operation, selectors, tables
            )
            payload_sources = []
            for field in event["fields"]:
                physical = field.get("sourcePhysicalField")
                source_table = physical.split(".", 1)[0] if physical else None
                payload_source = {
                    "field": field["name"],
                    "source": (field.get("sourceRequestField") or physical
                               or ("transition." + field["sourceTransitionPhase"].lower()
                                   if field.get("sourceTransitionPhase") else field.get("sourceOwnerContext"))),
                    "sourceKind": ("VALIDATED_REQUEST" if field.get("sourceRequestField") else
                                   "SAME_TRANSACTION_WRITE" if source_table in operation["writesTables"] else
                                   "DECLARED_OWNER_REFETCH" if physical else
                                   "TRANSITION_SNAPSHOT" if field.get("sourceTransitionPhase") else
                                   "OWNER_TRANSACTION_CONTEXT"),
                }
                if source_table and source_table != event_root:
                    payload_source["causalJoin"] = _relation_join(
                        event_root, source_table, operation, tables
                    )
                    payload_source["tenantFilter"] = "tenant_id = principal.tenantId"
                    payload_source["cardinality"] = "EXACTLY_ONE"
                payload_sources.append(payload_source)
            return {
                "eventName": event["eventName"], "eventType": event["eventType"],
                "aggregateEntityType": "table:" + event_root,
                "aggregateIdSource": aggregate_physical,
                "aggregateVersionSource": version_physical,
                "postStateSource": f"{state_root}.{event_state_column}",
                "emissionBoundary": "AFTER_COMMIT_OUTBOX_SAME_TRANSACTION",
                "emissionCondition": event.get("emissionCondition", "ALWAYS_AFTER_SUCCESSFUL_COMMAND_COMMIT"),
                "foreignBusinessReferences": foreign_references,
                "payloadFields": [field["name"] for field in event["fields"]],
                "payloadFieldSources": payload_sources,
                "deliveryPolicy": copy.deepcopy(event["deliveryPolicy"]),
                "consumerRefetch": {
                    "allowed": event["consumerRefetchPolicy"]["refetchAllowed"],
                    "endpoint": event["consumerRefetchPolicy"]["ownerRefetchEndpoint"],
                    "allowedConsumerSessions": list(event["consumerRefetchPolicy"]["allowedConsumerSessions"]),
                    "purposeCodes": list(event["consumerRefetchPolicy"]["purposeCodes"]),
                    "pep": event["consumerRefetchPolicy"]["pep"],
                    "ownerKey": ({"entityType": "table:" + event_root, "field": "aggregateId"}
                                 if event["consumerRefetchPolicy"]["refetchAllowed"] else None),
                    "versionField": ("aggregateVersion"
                                     if event["consumerRefetchPolicy"]["refetchAllowed"] else None),
                    "fieldAllowlist": list(
                        event["consumerRefetchPolicy"].get("refetchAllowedFields", [])
                    ),
                    "rule": ("REFETCH_EXACT_OWNER_VERSION_OR_REJECT_STALE_OR_MISSING"
                             if event["consumerRefetchPolicy"]["refetchAllowed"]
                             else "CROSS_SESSION_REFETCH_FORBIDDEN; SAME_CONTEXT_OWNER_QUERY_REQUIRES_CURRENT_AUTHORIZATION"),
                },
            }

        dispositions = {item["table"]: item["disposition"] for item in lineage["writeSet"]}
        assignments_by_table: dict[str, list[dict[str, Any]]] = {
            table_name: [] for table_name in operation["writesTables"]
        }
        required_sources = lineage["requiredColumnSources"]
        mutation_sources = lineage.get("mutationFieldSources", [])
        mutation_targets = {source["target"] for source in mutation_sources}
        dml_sources = [
            source for source in required_sources
            if dispositions[source["target"].split(".", 1)[0]] != "UPDATE"
            and source["target"] not in mutation_targets
        ] + list(mutation_sources)
        for field_source in dml_sources:
            table_name = field_source["target"].split(".", 1)[0]
            if table_name in assignments_by_table:
                assignments_by_table[table_name].append({
                    "target": field_source["target"], "sourcePath": field_source["sourcePath"],
                    "sourceKind": field_source["sourceKind"], "sqlType": field_source["sqlType"],
                })
        cas_target = EXPECTED_VERSION_TARGETS.get(
            operation_id, f"{root_name}.aggregate_version"
        )
        cas_table = cas_target.split(".", 1)[0]
        ordered_dml = [
            {"step": index, "table": table_name, "disposition": dispositions[table_name],
             "assignments": sorted(assignments_by_table[table_name], key=lambda row: row["target"]),
             "tenantPredicate": "tenant_id = principal.tenantId",
             "rootCasPredicate": (
                 cas_target + " = headers.If-Match"
                 if operation["expectedVersion"] == "REQUIRED"
                 and table_name == cas_table
                 else None
             )}
            for index, table_name in enumerate(operation["writesTables"], 1)
        ]
        infra = COMMAND_TRANSACTION_INFRA[operation["session"]]
        transaction_steps: list[dict[str, Any]] = [{
            "step": 1, "stage": "CLAIM_OR_REPLAY_COMMAND_RECEIPT",
            "table": infra["receiptTable"], "disposition": "CLAIM_OR_REPLAY",
            "key": ("tenant_id+caller+" + infra["idempotencyColumn"]),
            "requestDigestColumn": infra["digestColumn"],
            "sameTransaction": True, "rowCount": "ZERO_OR_ONE_NEW; EXACTLY_ONE_LOCKED_RESULT",
            "replay": "MATCHING_DIGEST_RETURNS_EXISTING_RESULT_WITH_ZERO_DOMAIN_AND_OUTBOX_WRITES",
            "conflict": "SAME_KEY_DIFFERENT_DIGEST_REJECTED_WITH_ZERO_DOMAIN_AND_OUTBOX_WRITES",
            "failureAfterStep": "ROLLBACK_ALL_STEPS_AND_LEAVE_NO_NEW_RECEIPT",
        }]
        append_many_row_counts = {
            ("modern.compplan.snapshot.publish", "prf_cmp_approved_snapshot_lines"):
                "EXACTLY_body.lines.length_BETWEEN_1_AND_100000",
            ("modern.wfm.forecast.create", "tme_wfm_demand_lines"):
                "EXACTLY_body.demandLines.length_BETWEEN_1_AND_100000",
            ("modern.wfm.schedule.validate", "tme_wfm_constraint_violation_lines"):
                "EXACTLY_ownerEngineResult.constraintViolations.length_BETWEEN_0_AND_100000",
            ("modern.wfm.schedule.validate", "tme_wfm_fairness_measure_values"):
                "EXACTLY_ownerEngineResult.fairnessMeasures.length_BETWEEN_0_AND_100000",
        }
        for domain in ordered_dml:
            disposition = domain["disposition"]
            if disposition == "APPEND_MANY":
                row_count = append_many_row_counts.get((operation_id, domain["table"]))
                if row_count is None:
                    raise ValueError(
                        f"unreviewed APPEND_MANY row cardinality: {operation_id} {domain['table']}"
                    )
            elif disposition == "UPSERT_CAS":
                row_count = "EXACTLY_ONE_INSERTED_OR_LOCKED_AND_INCREMENTED"
            else:
                row_count = "EXACTLY_ONE"
            transaction_steps.append({
                "step": len(transaction_steps) + 1, "stage": "DOMAIN_DML",
                "table": domain["table"], "disposition": disposition,
                "rowCount": row_count, "assignments": copy.deepcopy(domain["assignments"]),
                "tenantPredicate": domain["tenantPredicate"],
                "rootCasPredicate": domain["rootCasPredicate"],
                "sameTransaction": True,
                "failureAfterStep": "ROLLBACK_RECEIPT_AND_ALL_PRIOR_DOMAIN_STEPS_AND_WRITE_NO_OUTBOX",
            })
        transaction_steps.append({
            "step": len(transaction_steps) + 1, "stage": "COMPLETE_COMMAND_RECEIPT",
            "table": infra["receiptTable"], "disposition": "UPDATE_TO_TERMINAL_SUCCESS",
            "statusColumn": infra["statusColumn"], "resultReference": root_name + ".public_id",
            "resultVersion": root_name + ".aggregate_version", "rowCount": "EXACTLY_ONE",
            "sameTransaction": True,
            "failureAfterStep": "ROLLBACK_RECEIPT_DOMAIN_AND_WRITE_NO_OUTBOX",
        })
        transaction_steps.append({
            "step": len(transaction_steps) + 1, "stage": "APPEND_CAUSAL_OUTBOX_LAST",
            "table": infra["outboxTable"], "disposition": "APPEND",
            "events": [
                {"eventName": event["eventName"],
                 "rowCount": ("ZERO_OR_ONE_WHEN_CONDITION_TRUE"
                              if event.get("emissionCondition") else "EXACTLY_ONE"),
                 "condition": event.get("emissionCondition", "ALWAYS_AFTER_SUCCESSFUL_COMMAND")}
                for event in operation_events
            ],
            "sameTransaction": True,
            "failureAfterStep": "ROLLBACK_OUTBOX_RECEIPT_AND_ALL_DOMAIN_WRITES",
        })
        transaction_envelope = {
            "operationBinding": operation_id,
            "isolation": "OWNER_COMMAND_TRANSACTION",
            "receiptTable": infra["receiptTable"], "outboxTable": infra["outboxTable"],
            "steps": transaction_steps,
            "stepOrder": "RECEIPT_CLAIM_FIRST_DOMAIN_DML_THEN_RECEIPT_COMPLETION_OUTBOX_LAST",
            "sameTransaction": True,
            "transactionBoundary": "ONE_DATABASE_TRANSACTION; OUTBOX_DISPATCH_ONLY_AFTER_COMMIT",
            "atomicity": "ANY_STEP_FAILURE_ROLLS_BACK_RECEIPT_DOMAIN_STATE_VERSION_AND_OUTBOX",
            "idempotentReplay": "MATCHED_COMPLETED_RECEIPT_RETURNS_SAME_ROOT_VERSION_WITH_ZERO_NEW_WRITES",
            "staleVersion": "CAS_FAILURE_ROLLS_BACK_RECEIPT_CLAIM_AND_ALL_SIDE_EFFECTS",
            "tenantMismatch": "ZERO_ROWS_MUTATED_ZERO_RECEIPT_COMPLETION_ZERO_OUTBOX",
        }
        rows.append({
            "operationId": operation_id, "mode": "COMMAND",
            "aggregateRoot": {
                "table": root_name, "publicIdColumn": "public_id",
                "versionColumn": "aggregate_version", "stateColumn": state_column,
                "selectors": selectors,
                "tenantFilter": "tenant_id = principal.tenantId",
                "versionFilter": (root_name + ".aggregate_version = headers.If-Match"
                                  if operation["expectedVersion"] == "REQUIRED"
                                  and cas_table == root_name else "CREATE_ROOT_VERSION_ONE_OR_OWNER_LOCK"),
                "relatedAggregateCasFilter": (cas_target + " = headers.If-Match"
                                              if operation["expectedVersion"] == "REQUIRED"
                                              and cas_table != root_name else None),
            },
            "writeTables": list(operation["writesTables"]),
            "orderedDml": ordered_dml,
            "transactionEnvelope": transaction_envelope,
            "mutationFieldSet": mutation_fields,
            "transition": {
                "transitionId": operation["stateTransitionIds"][0],
                "preStates": list(before), "postStates": list(after),
                "postStateSource": transition_source,
                "physicalPostStateSink": f"{root_name}.{state_column}",
                "checkConstraintIds": [
                    check["constraintId"] for check in tables[root_name]["checks"]
                    if state_column in check.get("columns", [])
                ],
            },
            "requiredInputUses": input_uses,
            "causalEvents": [causal_event(event) for event in operation_events],
        })
    internal_handlers = []
    for handler in doc.get("internalConsumerHandlers", []):
        event = event_schemas[handler["emits"][0]]
        root_name = handler["aggregateRootTable"]
        handler_id = handler["handlerId"]
        authored_assignments = INTERNAL_HANDLER_WRITE_ASSIGNMENTS.get(handler_id)
        if authored_assignments is None:
            raise ValueError(f"unreviewed internal handler DML: {handler_id}")
        if set(authored_assignments) != set(handler["writesTables"]):
            raise ValueError(
                f"internal handler assignment/write-set drift: {handler_id} "
                f"assignments={sorted(authored_assignments)} writes={sorted(handler['writesTables'])}"
            )
        handler_domain_steps: list[dict[str, Any]] = []
        for index, table_name in enumerate(handler["writesTables"], 1):
            disposition = handler["writeDispositions"][table_name]
            column_specs = _all_columns(tables[table_name], doc["commonTableContract"])
            assignments = authored_assignments[table_name]
            unknown = set(assignments) - set(column_specs)
            if unknown:
                raise ValueError(
                    f"internal handler assignment targets absent columns: {handler_id} "
                    f"{table_name} {sorted(unknown)}"
                )
            if disposition in {"INSERT", "APPEND", "APPEND_MANY"}:
                required = {
                    name for name, spec in column_specs.items()
                    if name != tables[table_name]["idColumn"]["name"]
                    and spec.get("nullable") is False and spec.get("default") is None
                }
                missing = required - set(assignments)
                if missing:
                    raise ValueError(
                        f"internal handler required insert assignments missing: {handler_id} "
                        f"{table_name} {sorted(missing)}"
                    )
            row_count = INTERNAL_HANDLER_ROW_COUNTS.get((handler_id, table_name), "EXACTLY_ONE")
            handler_domain_steps.append({
                "step": index, "table": table_name, "disposition": disposition,
                "assignments": [
                    {"target": f"{table_name}.{column}", "sourcePath": source,
                     "sqlType": column_specs[column]["sqlType"]}
                    for column, source in sorted(assignments.items())
                ],
                "rowCount": row_count,
                "tenantPredicate": "tenant_id = ownerContext.tenantId",
                "rootCasPredicate": (
                    f"{table_name}.aggregate_version = handlerContext.expectedAggregateVersion"
                    if table_name == root_name and disposition == "UPDATE" else
                    f"{table_name}.aggregate_version = handlerContext.expectedRelatedVersion"
                    if disposition == "UPDATE" else None
                ),
                "sameTransaction": True,
                "failureAfterStep": "ROLLBACK_INBOX_AND_ALL_PRIOR_DOMAIN_STEPS_AND_WRITE_NO_OUTBOX",
            })
        infra = COMMAND_TRANSACTION_INFRA[handler["session"]]
        envelope_steps: list[dict[str, Any]] = [{
            "step": 1, "stage": "CLAIM_OR_REPLAY_DURABLE_OWNER_INBOX",
            "contract": "DWP_EVENT_INBOX_V1", "physicalOwner": handler["session"],
            "key": handler["idempotency"]["scope"] + "+" + handler["idempotency"]["key"],
            "trigger": handler["trigger"], "payloadDigest": "handlerContext.ownerResultDigest",
            "sameTransaction": True,
            "replay": handler["idempotency"]["duplicateResult"],
            "conflict": "SAME_INBOX_KEY_DIFFERENT_DIGEST_QUARANTINED_WITH_ZERO_DOMAIN_OR_OUTBOX_WRITES",
            "failureAfterStep": "ROLLBACK_NEW_INBOX_CLAIM",
        }]
        for domain in handler_domain_steps:
            envelope_steps.append({
                **copy.deepcopy(domain), "step": len(envelope_steps) + 1,
                "stage": "HANDLER_DOMAIN_DML",
            })
        envelope_steps.append({
            "step": len(envelope_steps) + 1, "stage": "COMPLETE_DURABLE_OWNER_INBOX",
            "contract": "DWP_EVENT_INBOX_V1", "disposition": "MARK_PROCESSED_WITH_RESULT_REFERENCE",
            "resultReference": root_name + ".public_id",
            "resultVersion": root_name + ".aggregate_version",
            "sameTransaction": True,
            "failureAfterStep": "ROLLBACK_INBOX_DOMAIN_STATE_VERSION_AND_WRITE_NO_OUTBOX",
        })
        envelope_steps.append({
            "step": len(envelope_steps) + 1, "stage": "APPEND_CAUSAL_OUTBOX_LAST",
            "table": infra["outboxTable"], "disposition": "APPEND",
            "eventName": event["eventName"], "rowCount": "EXACTLY_ONE",
            "sameTransaction": True,
            "failureAfterStep": "ROLLBACK_INBOX_DOMAIN_STATE_VERSION_AND_OUTBOX",
        })
        handler_envelope = {
            "operationBinding": handler_id,
            "transactionBoundary": "ONE_DATABASE_TRANSACTION; OUTBOX_DISPATCH_ONLY_AFTER_COMMIT",
            "inboxContract": "DWP_EVENT_INBOX_V1", "outboxTable": infra["outboxTable"],
            "steps": envelope_steps,
            "stepOrder": "INBOX_CLAIM_FIRST_DOMAIN_DML_THEN_INBOX_COMPLETION_OUTBOX_LAST",
            "sameTransaction": True,
            "atomicity": "ANY_STEP_FAILURE_ROLLS_BACK_INBOX_DOMAIN_STATE_VERSION_AND_OUTBOX",
            "idempotentReplay": handler["idempotency"]["duplicateResult"],
            "staleVersion": "ANY_ROOT_OR_RELATED_CAS_FAILURE_ROLLS_BACK_ALL_EFFECTS",
            "tenantMismatch": "ZERO_ROWS_MUTATED_ZERO_INBOX_COMPLETION_ZERO_OUTBOX",
        }
        internal_handlers.append({
            **copy.deepcopy(handler),
            "orderedDml": handler_domain_steps,
            "transactionEnvelope": handler_envelope,
            "eventContract": {
                "eventName": event["eventName"],
                "payloadFieldSources": [
                    {"field": field["name"],
                     "source": (field.get("sourcePhysicalField") or field.get("sourceOwnerContext")
                                or ("transition." + field["sourceTransitionPhase"].lower()
                                    if field.get("sourceTransitionPhase") else None))}
                    for field in event["fields"]
                ],
                "deliveryPolicy": copy.deepcopy(event["deliveryPolicy"]),
                "consumerRefetch": copy.deepcopy(event["consumerRefetchPolicy"]),
            },
        })
    return {
        "contractId": "dwp.hris.modern.operation-causal-state.v2",
        "schemaVersion": 2,
        "status": "SEALED_G3_DESIGN_NOT_IMPLEMENTED",
        "scope": {
            "operations": len(rows), "commands": len(COMMAND_WRITES),
            "queries": len(rows) - len(COMMAND_WRITES),
            "publicCommandPrimaryEvents": len(COMMAND_WRITES),
            "conditionalCommandEvents": sum(map(len, CONDITIONAL_COMMAND_EVENTS.values())),
            "internalHandlerEvents": len(internal_handlers),
            "causalEvents": len(event_schemas),
            "internalConsumerHandlers": len(internal_handlers),
            "implementationState": "NOT_STARTED_G3", "productionState": "NOT_AUTHORIZED_G6",
        },
        "policies": {
            "commandAggregate": "ONE_EXACT_PHYSICAL_ROOT",
            "postState": "ONE_EXACT_PHYSICAL_STATUS_STATE_OR_STAGE_SINK_ACCEPTED_BY_CHECK",
            "event": "AT_LEAST_ONE_REVIEWED_PRIMARY_COMMAND_FACT_PLUS_EXPLICIT_CONDITIONAL_OR_INTERNAL_FACTS_WITH_EXACT_CAUSAL_SOURCES",
            "selectors": "TENANT_PURPOSE_OWNER_BOUND_NO_IMPLICIT_FIRST",
            "requiredInputs": "EVERY_REQUIRED_INPUT_HAS_PERSISTED_EVENT_POLICY_OR_QUERY_EFFECT; NAMED_GUARDS_ARE_NOT_EFFECTS",
            "optionalInputs": "OPTIONAL_NEVER_DIRECTLY_FEEDS_NOT_NULL_OR_REQUIRED_EVENT",
        },
        "operations": rows,
        "internalConsumerHandlers": internal_handlers,
    }


def _all_columns(table: dict[str, Any], common: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {row["name"]: row for row in [table["idColumn"], *common["columns"], *table["columns"]]}


def _relation_join(root: str | None, target: str, operation: dict[str, Any],
                   tables: dict[str, dict[str, Any]]) -> dict[str, Any]:
    if root == target:
        return {"kind": "ROOT_IDENTITY", "fromTable": root, "fromColumn": "public_id",
                "toTable": target, "toColumn": "public_id"}
    candidates = list(dict.fromkeys(operation.get("writesTables", []) + operation.get("readsTables", [])))
    for source_table in candidates:
        if source_table not in tables:
            continue
        for fk in tables[source_table].get("foreignKeys", []):
            if fk.get("mode") == "LOCAL_COMPOSITE_FK" and fk.get("target") == target:
                return {"kind": "LOCAL_COMPOSITE_FK", "fromTable": source_table,
                        "fromColumns": fk["columns"], "toTable": target,
                        "toColumns": fk["targetColumns"], "constraintId": fk["constraintId"]}
    if root and target in tables:
        for fk in tables[target].get("foreignKeys", []):
            if fk.get("mode") == "LOCAL_COMPOSITE_FK" and fk.get("target") == root:
                return {"kind": "REVERSE_LOCAL_COMPOSITE_FK", "fromTable": target,
                        "fromColumns": fk["columns"], "toTable": root,
                        "toColumns": fk["targetColumns"], "constraintId": fk["constraintId"]}
    return {"kind": "EXPLICIT_OWNER_RELATIONSHIP", "fromEntity": "table:" + root if root else "QUERY",
            "toEntity": "table:" + target, "tenantBound": True,
            "purpose": operation["authorizationCapability"]}


def _selectors(operation: dict[str, Any], request_fields: dict[str, dict[str, Any]],
               root: str | None, lineage: dict[str, Any], tables: dict[str, dict[str, Any]],
               common: dict[str, Any]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    input_mappings = {row["source"]: row for row in lineage.get("inputMappings", [])}
    dispositions = {row["table"]: row["disposition"] for row in lineage.get("writeSet", [])}
    for source, field in request_fields.items():
        if not source.startswith("pathParameters."):
            continue
        reference = field.get("referenceContract") or {}
        entity = reference.get("entityType")
        table_target = entity.removeprefix("table:") if isinstance(entity, str) and entity.startswith("table:") else None
        mapping = input_mappings.get(source, {})
        column_targets = [sink["target"] for sink in mapping.get("sinks", [])
                          if sink.get("kind") == "TABLE_COLUMN" and "." in sink.get("target", "")]
        is_version = field["name"].lower() in {"version", "versionno", "revision"}
        if is_version:
            if column_targets:
                target_table, target_column = column_targets[0].split(".", 1)
            elif root:
                target_table, target_column = root, "aggregate_version"
            else:
                raise ValueError(f"query version selector lacks physical target: {operation['operationId']} {source}")
            target_sql = _all_columns(tables[target_table], common)[target_column]["sqlType"]
            row = {
                "source": source, "selectorType": "VERSION", "entityType": "table:" + target_table,
                "idSpace": "OWNER_VERSION", "sourceType": field["type"],
                "targetTable": target_table, "targetColumn": target_column, "targetSqlType": target_sql,
                "operator": "=", "cardinality": "EXACTLY_ONE", "tenantFilter": "tenant_id = principal.tenantId",
                "purposeFilter": operation["authorizationCapability"], "versionRule": "EXACT_VERSION_NO_OR_AGGREGATE_VERSION",
                "asOfRule": "OWNER_TRANSACTION_TIME", "causalJoin": _relation_join(root, target_table, operation, tables),
            }
            rows.append(row)
            continue
        if table_target:
            target_table, target_column, target_sql = table_target, "public_id", "UUID"
            if root == target_table:
                selector_type = "ROOT_TARGET"
            elif root and dispositions.get(root) in {"INSERT", "APPEND"}:
                selector_type = "CREATE_CHILD_CAUSAL_PARENT"
            elif operation["mode"] == "QUERY":
                selector_type = "QUERY_TARGET"
            else:
                selector_type = "RELATED_AGGREGATE"
            causal_join = _relation_join(root, target_table, operation, tables)
        elif entity:
            target_table, target_column, target_sql = "OWNER::" + entity, "public_id", field["type"]
            selector_type = "OWNER_REFERENCE"
            causal_join = {"kind": "OWNER_API_RELATIONSHIP", "ownerEntity": entity,
                           "rootContext": "table:" + root if root else "QUERY",
                           "tenantBound": True, "purpose": operation["authorizationCapability"]}
        else:
            if not root:
                raise ValueError(f"untyped query path selector: {operation['operationId']} {source}")
            candidates = [field["name"], re.sub(r"(?<!^)(?=[A-Z])", "_", field["name"]).lower()]
            columns = _all_columns(tables[root], common)
            target_column = next((name for name in candidates if name in columns), None)
            if target_column is None:
                raise ValueError(f"untyped root path selector lacks column: {operation['operationId']} {source}")
            target_table, target_sql = root, columns[target_column]["sqlType"]
            selector_type = "ROOT_NATURAL_KEY"
            causal_join = {"kind": "ROOT_NATURAL_KEY", "fromTable": root,
                           "fromColumn": target_column, "toTable": root, "toColumn": target_column}
        rows.append({
            "source": source, "selectorType": selector_type, "entityType": entity or "table:" + target_table,
            "idSpace": reference.get("idSpace") or "NATURAL_KEY", "sourceType": field["type"],
            "targetTable": target_table, "targetColumn": target_column, "targetSqlType": target_sql,
            "operator": "=", "cardinality": "EXACTLY_ONE", "tenantFilter": "tenant_id = principal.tenantId",
            "purposeFilter": operation["authorizationCapability"], "versionRule": "OWNER_CURRENT_OR_EXPLICIT_VERSION",
            "asOfRule": "OWNER_TRANSACTION_TIME", "causalJoin": causal_join,
        })
    if root and dispositions.get(root) in {"INSERT", "APPEND"}:
        rows.append({
            "source": "OWNER_GENERATED_UUID_V7", "entityType": "table:" + root,
            "idSpace": "PUBLIC_UUID", "selectorType": "GENERATED_ROOT",
            "sourceType": "UUID", "targetTable": root, "targetColumn": "public_id", "targetSqlType": "UUID",
            "operator": "ALLOCATE_ONCE", "cardinality": "EXACTLY_ONE",
            "tenantFilter": "tenant_id = principal.tenantId", "purposeFilter": operation["authorizationCapability"],
            "versionRule": "IDEMPOTENCY_REPLAY_RETURNS_SAME_ROOT_AND_VERSION", "asOfRule": "OWNER_TRANSACTION_TIME",
            "causalJoin": {"kind": "NEW_ROOT_IDENTITY", "persistedAt": root + ".public_id",
                           "receiptBound": True},
        })
    return rows


def _input_uses(operation: dict[str, Any], fields: dict[str, dict[str, Any]], root: str | None,
                lineage: dict[str, Any], event: dict[str, Any] | None,
                selectors: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    input_mappings = {row["source"]: row for row in lineage.get("inputMappings", [])}
    selector_by_source = {row["source"]: row for row in selectors}
    receipt = RECEIPT_DECISION_COLUMNS.get(operation.get("session", ""))
    state_target = (next((row["target"] for row in lineage.get("mutationFieldSources", [])
                          if root and row["target"].startswith(root + ".")
                          and row["sourcePath"].startswith("derived.transition_post_state")), None)
                    if root else None)
    for source, field in fields.items():
        if not field.get("required") and operation["mode"] != "QUERY":
            continue
        effects: list[dict[str, Any]] = []
        if operation["mode"] == "QUERY" and source == "headers.X-Correlation-ID":
            effects.append({"kind": "OBSERVABILITY_TRACE_CONTEXT", "target": "request_context.correlation_id"})
        elif source == "headers.X-Correlation-ID":
            effects.append({"kind": "EVENT_FIELD", "target": event["eventName"] + ".correlationId"})
        elif source == "headers.Idempotency-Key":
            infra = COMMAND_TRANSACTION_INFRA[operation["session"]]
            effects.append({"kind": "COMMAND_CONTROL",
                            "target": (infra["receiptTable"] + ".(tenant_id,caller," +
                                       infra["idempotencyColumn"] + "," + infra["digestColumn"] + ")")})
        elif source == "headers.If-Match":
            effects.append({"kind": "ROOT_CAS_FILTER",
                            "target": EXPECTED_VERSION_TARGETS.get(
                                operation["operationId"], f"{root}.aggregate_version"
                            ), "operator": "="})
        elif operation["mode"] == "QUERY":
            selector = selector_by_source.get(source)
            if selector:
                effects.append({"kind": "QUERY_FILTER",
                                "target": selector["targetTable"] + "." + selector["targetColumn"],
                                "operator": selector["operator"], "selectorType": selector["selectorType"]})
            elif source == "queryParameters.asOf":
                effects.append({
                    "kind": "QUERY_ASOF_FILTER",
                    "target": "readPlan.effectiveTime",
                    "operator": "CONTAINS_OR_PRECEDES_AS_DECLARED_BY_EACH_TABLE",
                    "tables": list(operation.get("readsTables", [])),
                })
            elif source == "queryParameters.cursor":
                effects.append({
                    "kind": "QUERY_CURSOR_FILTER",
                    "target": operation["readsTables"][0] + ".public_id",
                    "operator": "KEYSET_AFTER_VERIFIED_SIGNED_CURSOR",
                })
            elif source == "queryParameters.limit":
                effects.append({
                    "kind": "QUERY_RESULT_LIMIT", "target": "readPlan.pagination.maximumLimit",
                    "operator": "MIN_VALIDATED_REQUEST_OR_DEFAULT",
                })
            elif source.startswith("queryParameters."):
                raise ValueError(f"query parameter lacks exact physical filter: {operation['operationId']} {source}")
        else:
            mapping = input_mappings.get(source, {})
            for sink in mapping.get("sinks", []):
                if sink.get("kind") == "TABLE_COLUMN":
                    effects.append({"kind": "PERSISTED_COLUMN", "target": sink["target"],
                                    **({"resolution": sink["resolution"]} if sink.get("resolution") else {})})
            selector = selector_by_source.get(source)
            if selector:
                effects.append({"kind": "ENTITY_SELECTOR",
                                "target": selector["targetTable"] + "." + selector["targetColumn"],
                                "selectorType": selector["selectorType"], "cardinality": selector["cardinality"]})
            if field.get("referenceContract"):
                observable = next((effect["target"] for effect in effects
                                   if effect["kind"] in {"PERSISTED_COLUMN", "ENTITY_SELECTOR"}), None)
                if observable:
                    effects.append({
                        "kind": "POLICY_DECISION",
                        "ruleId": "RESOLVE_OWNER_REFERENCE_TENANT_PURPOSE_VERSION_ASOF",
                        "target": observable,
                        "entityType": field["referenceContract"]["entityType"],
                    })
        # Guard-only business values are accepted only through an individually
        # identified policy assertion whose digest, outcome and policy version
        # are persisted in the same command receipt.  The state mutation is
        # causally conditional on that receipt outcome; a renamed
        # ``decision_input`` label is deliberately insufficient.
        business_effects = [effect for effect in effects if effect["kind"] in {
            "PERSISTED_COLUMN", "ENTITY_SELECTOR", "QUERY_FILTER", "EVENT_FIELD"
        }]
        if operation["mode"] == "COMMAND" and not source.startswith("headers.") and not business_effects:
            if not receipt or not state_target:
                raise ValueError(f"policy receipt unavailable: {operation['operationId']} {source}")
            slug = re.sub(r"[^A-Za-z0-9]+", "_", operation["operationId"] + "_" + source).upper()
            effects.append({
                "kind": "PERSISTED_DECISION_RECEIPT", "ruleId": slug + "_V1",
                "inputEvidenceSink": receipt["table"] + "." + receipt["digest"],
                "outcomeSink": receipt["table"] + "." + receipt["outcome"],
                "decisionVersionSink": receipt["table"] + "." + receipt["decisionVersion"],
                "mutationDependency": state_target + " only when receipt outcome is SUCCEEDED/ACCEPTED",
                "target": state_target,
                "assertion": field["validation"],
            })
        if not effects:
            raise ValueError(f"required input has no observable effect: {operation['operationId']} {source}")
        row = {
            "source": source, "effects": effects,
            "required": bool(field.get("required")),
            "requestDigestMember": (operation["mode"] == "COMMAND"
                                    and source not in {"headers.X-Correlation-ID", "headers.Idempotency-Key"}),
            "causalEffect": "OBSERVABLE_EFFECT_SET_NO_GUARD_ONLY_FALLBACK",
        }
        if operation["mode"] == "QUERY" and not field.get("required"):
            row["absenceSemantics"] = {
                "mode": "EXPLICIT_ABSENT_BRANCH", "mustTestAbsentAndPresent": True,
                "absentBehavior": (
                    "USE_OWNER_TRANSACTION_TIME" if source == "queryParameters.asOf" else
                    "START_FIRST_KEYSET_PAGE" if source == "queryParameters.cursor" else
                    "USE_DEFAULT_LIMIT_50"
                ),
            }
        rows.append(row)
    return rows


def _event_foreign_references(event: dict[str, Any], root: str,
                              operation: dict[str, Any], selectors: list[dict[str, Any]],
                              tables: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    selector_by_source = {row["source"]: row for row in selectors}
    rows: list[dict[str, Any]] = []
    for field in event["fields"]:
        reference = field.get("referenceContract") or {}
        entity = reference.get("entityType")
        if not entity or entity == "table:" + root or field["name"] == "aggregateId":
            continue
        source_request = field.get("sourceRequestField")
        source_physical = field.get("sourcePhysicalField")
        selector = selector_by_source.get(source_request)
        if source_physical:
            source_table = source_physical.split(".", 1)[0]
            source_kind = ("SAME_TRANSACTION_WRITE" if source_table in operation.get("writesTables", [])
                           else "DECLARED_READ_REFETCH")
            resolution = {"source": source_physical, "tenantBound": True,
                          "cardinality": "EXACTLY_ONE", "versionRule": "SAME_TRANSACTION_VERSION",
                          "asOfRule": "OWNER_TRANSACTION_TIME",
                          "causalJoin": _relation_join(root, source_table, operation, tables)}
        elif selector:
            source_kind = "VALIDATED_REQUEST_SELECTOR"
            resolution = {"source": source_request, "targetTable": selector["targetTable"],
                          "targetColumn": selector["targetColumn"], "tenantBound": True,
                          "purpose": operation["authorizationCapability"], "cardinality": selector["cardinality"],
                          "versionRule": selector["versionRule"], "asOfRule": selector["asOfRule"],
                          "causalJoin": selector["causalJoin"]}
        else:
            source_kind = "VALIDATED_REQUEST_OWNER_REFERENCE"
            resolution = {"source": source_request, "ownerEntity": entity, "tenantBound": True,
                          "purpose": operation["authorizationCapability"], "cardinality": "EXACTLY_ONE",
                          "versionRule": "OWNER_CURRENT_OR_EXPLICIT_VERSION", "asOfRule": "OWNER_TRANSACTION_TIME"}
        rows.append({"field": field["name"], "entityType": entity,
                     "idSpace": reference.get("idSpace"), "sourceKind": source_kind,
                     "resolution": resolution})
    return rows


# The procedural discovery above remains useful for bootstrapping tables and
# compatibility metadata.  The final operation behavior is projected from the
# explicit candidate-owned reviewed SSOT; the independent oracle is never
# imported or read by this module.
_bootstrap_apply_exact_source_successor = apply_exact_source_successor


def apply_exact_source_successor(doc: dict[str, Any], events: dict[str, Any]) -> None:
    from modern_causal_candidate_projection import (
        apply_reviewed_exact_projection,
        load_candidate_ssot,
    )

    _bootstrap_apply_exact_source_successor(doc, events)
    apply_reviewed_exact_projection(doc, events)
    for operation in load_candidate_ssot()["operations"]:
        if operation["mode"] != "COMMAND":
            continue
        transition = operation["transition"]
        STATE[operation["operationId"]] = (
            tuple(transition["preStates"]),
            tuple(transition["postStates"]),
            transition["postStateSource"],
        )


def build_causal_contract(doc: dict[str, Any], events: dict[str, Any]) -> dict[str, Any]:
    from modern_causal_candidate_projection import build_reviewed_causal_contract

    return build_reviewed_causal_contract(doc, events)
