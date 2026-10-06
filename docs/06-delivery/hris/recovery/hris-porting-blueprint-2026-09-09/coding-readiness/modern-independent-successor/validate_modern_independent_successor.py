#!/usr/bin/env python3
"""Reviewer-owned validator for the modern HRIS successor.

The validator deliberately imports no candidate generator or candidate
validator.  JSON and SQL artifacts are treated as hostile inputs.  A PASS is
possible only with a sealed reviewer-owned oracle and zero findings.
"""

from __future__ import annotations

import argparse
import copy
import datetime as dt
import hashlib
import json
import re
import sys
from collections import Counter
from pathlib import Path
from typing import Any, Iterable

import audit_modern_operation_semantics as operation_semantics


HERE = Path(__file__).resolve().parent
READINESS = HERE.parent

PATHS = {
    "manifest": READINESS / "modern-capability-closed-set-manifest.v3.json",
    "ssot": READINESS / "modern-capability-operation-causal-contract-ssot.v2.json",
    "semantic": READINESS / "modern-capability-semantic-bindings.v1.json",
    "exact": READINESS / "modern-capability-exact-schema-contracts.v1.json",
    "events": READINESS / "modern-capability-event-payload-contracts.v1.json",
    "identity": READINESS / "modern-capability-public-identity-registry.v1.json",
    "causal": READINESS / "modern-capability-causal-state-contracts.v2.json",
    "physicalQueries": READINESS / "modern-physical-successor/modern-query-projection-physical-contracts.v3.json",
    "physicalHandlers": READINESS / "modern-physical-successor/modern-owner-handler-physical-contracts.v3.json",
}

SQL_PATHS = {
    "HRIS-HRM": READINESS / "modern-physical-successor/hrm-modern-forward-ddl.v3.sql",
    "HRIS-PER": READINESS / "modern-physical-successor/per-modern-forward-ddl.v3.sql",
    "HRIS-TIM": READINESS / "modern-physical-successor/tim-modern-forward-ddl.v3.sql",
    "HRIS-SYS": READINESS / "modern-physical-successor/sys-modern-forward-ddl.v3.sql",
}

ORACLE_PATH = HERE / "reviewed-successor-oracle.v1.json"
TABLE_SCOPE_ORACLE_PATH = HERE / "approved-table-scope-change-oracle.v1.json"
DEFAULT_REPORT = HERE / "reports/modern-independent-successor-static-latest.v1.json"

EXPECTED_COUNTS = {
    "operations": 199,
    "commands": 133,
    "queries": 66,
    "handlers": 25,
    "publicEvents": 155,
    "tables": 115,
}

EXPECTED_SESSIONS = frozenset({"HRIS-HRM", "HRIS-PER", "HRIS-TIM", "HRIS-SYS"})

APPROVED_TABLE_SCOPE_DELTA = {
    "prf_grw_coaching_note_evidence_refs": (
        "HRIS-PER", "NORMALIZE_UUID_ARRAY_TO_TYPED_ORDERED_CHILD", "modern.growth.coaching.record",
    ),
    "prf_grw_profile_revision_evidence_refs": (
        "HRIS-PER", "NORMALIZE_UUID_ARRAY_TO_TYPED_ORDERED_CHILD", "modern.growth.profile.update",
    ),
    "prf_lrn_completion_skill_evidence_refs": (
        "HRIS-PER", "NORMALIZE_UUID_ARRAY_TO_TYPED_ORDERED_CHILD", "modern.learning.completion.verify",
    ),
    "sys_hris_analytics_export_projection_refs": (
        "HRIS-SYS", "NORMALIZE_UUID_ARRAY_TO_TYPED_ORDERED_CHILD", "modern.analytics.export.create",
    ),
    "tme_wfm_schedule_candidate_time_group_refs": (
        "HRIS-TIM", "NORMALIZE_UUID_ARRAY_TO_TYPED_ORDERED_CHILD",
        "internal.wfm.schedule-optimization.result.consume",
    ),
    "ppl_rec_requisition_publish_receipts": (
        "HRIS-HRM", "IMMUTABLE_PUBLICATION_APPROVAL_LEDGER",
        "modern.recruiting.requisition.publish",
    ),
    "prf_lrn_offering_publish_receipts": (
        "HRIS-PER", "IMMUTABLE_PUBLICATION_APPROVAL_LEDGER", "modern.learning.offering.publish",
    ),
    "prf_mkt_opportunity_publish_receipts": (
        "HRIS-PER", "IMMUTABLE_PUBLICATION_APPROVAL_LEDGER", "modern.opportunity.publish",
    ),
    "prf_suc_publish_receipts": (
        "HRIS-PER", "IMMUTABLE_PUBLICATION_APPROVAL_LEDGER", "modern.succession.plan.publish",
    ),
}

# The exact 27 defects found in the predecessor review.  Five additional root
# creators were admitted by the successor review and are tracked separately so
# a count change cannot hide loss of the original cases.
HISTORICAL_CREATE_NONE = frozenset({
    "modern.ai.assist.create",
    "modern.ai.policy.create",
    "modern.ai.policy.evaluate",
    "modern.analytics.export.create",
    "modern.analytics.metric.create",
    "modern.benefits.enrollment.submit",
    "modern.benefits.lifeevent.submit",
    "modern.benefits.plan.create",
    "modern.compplan.cycle.create",
    "modern.contingent.engagement.create",
    "modern.growth.profile.create",
    "modern.hrservice.case.create",
    "modern.learning.offering.create",
    "modern.learning.self.enroll",
    "modern.listening.action.create",
    "modern.listening.response.submit",
    "modern.listening.survey.create",
    "modern.onboarding.journey.assign",
    "modern.onboarding.template.create",
    "modern.opportunity.apply",
    "modern.opportunity.create",
    "modern.recruiting.requisition.create",
    "modern.skills.taxonomy.create",
    "modern.succession.plan.create",
    "modern.wfm.forecast.create",
    "modern.wfm.schedule.optimize",
    "modern.workforceplan.scenario.create",
})

SUCCESSOR_CREATE_NONE = frozenset({
    "modern.analytics.projection.request",
    "modern.growth.export.request",
    "modern.learning.assignment.create",
    "modern.recruiting.candidate.admit",
    "modern.skills.evidence.record",
})

MIXED_CREATE_UPDATE = {
    "modern.compplan.proposal.upsert": ("prf_cmp_proposals", {"NONE", "DRAFT"}),
}

PROVENANCE_REPLACEMENT_OPERATIONS = frozenset({
    "modern.benefits.enrollment.decide",
    "modern.benefits.enrollment.submit",
    "modern.compplan.budget.allocate",
    "modern.compplan.plan.approve",
    "modern.growth.profile.archive",
    "modern.onboarding.task.complete",
    "modern.opportunity.selection.record",
    "modern.opportunity.shortlist",
    "modern.recruiting.candidate.stage",
    "modern.recruiting.hire.record",
    "modern.skills.evidence.verify",
    "modern.succession.plan.approve",
    "modern.workforceplan.scenario.approve",
})

# Frozen reviewer semantics: the predecessor's fourteen decision/provenance
# operations plus two successor operations whose newly introduced receipt
# shortcuts were independently found.  Marker count and positive replacement
# proof are deliberately separate invariants.
BUSINESS_PROVENANCE_CONTRACTS: dict[str, tuple[dict[str, Any], ...]] = {
    "modern.ai.assist.create": ({
        "table": "sys_hris_ai_assistance_requests", "actions": {"INSERT"},
        "assignments": {
            "state", "request_digest", "requested_at", "payload_digest",
            "instruction_artifact_version_id", "source_projection_bundle_receipt_id",
            "governance_activation_receipt_id", "governance_activation_receipt_revision",
            "affected_person_disclosure_evidence_id",
            "human_oversight_assignment_version_id", "kill_switch_control_version_id",
            "monitoring_expires_at",
        },
    },),
    "modern.benefits.enrollment.decide": ({
        "table": "ppl_bnf_enrollment_decisions", "actions": {"APPEND", "INSERT"},
        "assignments": {
            "parent_public_id", "parent_version", "state", "payload_digest",
            "approval_receipt_public_id", "approval_receipt_revision",
            "approval_outcome", "approval_action", "approval_input_digest",
            "approval_purpose_code", "approval_tenant_id",
        },
    },),
    "modern.benefits.enrollment.submit": ({
        "table": "ppl_bnf_enrollments", "actions": {"INSERT"},
        "assignments": {
            "benefit_plan_id", "benefit_plan_version_id", "coverage_level",
            "worker_public_id", "effective_from", "submission_digest", "status",
        },
    },),
    "modern.benefits.lifeevent.submit": ({
        "table": "ppl_bnf_life_events", "actions": {"INSERT"},
        "assignments": {
            "worker_public_id", "event_type", "event_date", "source_record_key",
            "payload_digest", "status",
        },
    },),
    "modern.compplan.budget.allocate": ({
        "table": "prf_cmp_budget_ledger", "actions": {"APPEND", "INSERT"},
        "assignments": {
            "compensation_cycle_id", "org_public_id", "amount", "currency_code",
            "entry_type", "entry_sequence", "payload_digest", "recorded_at",
        },
    },),
    "modern.compplan.plan.approve": ({
        "table": "prf_cmp_plans", "actions": {"INSERT", "APPEND"},
        "assignments": {
            "approval_receipt_public_id", "approval_receipt_revision",
            "approval_outcome", "approval_action", "approval_input_digest",
            "approval_purpose_code", "approval_tenant_id", "content_digest",
            "plan_revision", "approved_at", "status",
        },
    },),
    "modern.growth.profile.archive": ({
        "table": "prf_grw_profiles", "actions": {"UPDATE_CAS"},
        "assignments": {"status", "archived_at", "last_reason_code", "aggregate_version"},
    },),
    "modern.learning.self.enroll": ({
        "table": "prf_lrn_assignments", "actions": {"INSERT"},
        "assignments": {
            "learning_offering_id", "worker_public_id", "effective_from",
            "consent_revision", "assignment_revision", "status", "assigned_at",
        },
    },),
    "modern.onboarding.task.complete": ({
        "table": "ppl_jny_task_evidence", "actions": {"APPEND", "INSERT"},
        "assignments": {
            "journey_assignment_id", "task_key", "completion_code",
            "completion_revision", "evidence_digest", "payload_digest", "recorded_at",
        },
    },),
    "modern.opportunity.selection.record": ({
        "table": "prf_mkt_application_decisions", "actions": {"APPEND", "INSERT"},
        "assignments": {
            "parent_public_id", "parent_version", "state", "payload_digest",
            "approval_receipt_public_id", "approval_receipt_revision",
            "approval_outcome", "approval_action", "approval_input_digest",
            "approval_purpose_code", "approval_tenant_id",
        },
    },),
    "modern.opportunity.shortlist": (
        {
            "table": "prf_mkt_application_decisions", "actions": {"APPEND", "INSERT"},
            "assignments": {
                "parent_public_id", "parent_version", "state", "payload_digest",
                "approval_receipt_public_id", "approval_receipt_revision",
                "approval_outcome", "approval_action", "approval_input_digest",
                "approval_purpose_code", "approval_tenant_id",
            },
        },
        {
            "table": "prf_mkt_match_explanations", "actions": {"APPEND", "INSERT"},
            "assignments": {
                "opportunity_application_id", "model_policy_version_id",
                "input_revision", "policy_revision", "payload_digest",
                "prohibited_attribute_count", "generated_at",
            },
        },
    ),
    "modern.recruiting.candidate.stage": ({
        "table": "ppl_rec_candidate_stage_history", "actions": {"APPEND", "INSERT"},
        "assignments": {
            "parent_public_id", "parent_version", "state", "payload_digest",
            "approval_receipt_public_id", "approval_receipt_revision",
            "approval_outcome", "approval_action", "approval_input_digest",
            "approval_purpose_code", "approval_tenant_id",
        },
    },),
    "modern.recruiting.hire.record": ({
        "table": "ppl_rec_hire_requests", "actions": {"INSERT"},
        "assignments": {
            "candidate_case_id", "offer_id", "effective_date", "request_digest",
            "human_decision_receipt_public_id", "decision_receipt_revision",
            "decision_outcome", "decision_action", "decision_input_digest",
            "decision_purpose_code", "decision_tenant_id", "status",
        },
    },),
    "modern.skills.evidence.verify": ({
        "table": "prf_skl_worker_evidence", "actions": {"UPDATE_CAS"},
        "assignments": {
            "status", "verification_receipt_public_id", "verification_receipt_revision",
            "verification_outcome", "verification_action", "verification_input_digest",
            "verification_purpose_code", "verification_tenant_id", "verified_at",
            "aggregate_version",
        },
    },),
    "modern.succession.plan.approve": ({
        "table": "prf_suc_plans", "actions": {"UPDATE_CAS"},
        "assignments": {
            "status", "approval_receipt_public_id", "approval_receipt_revision",
            "approval_outcome", "approval_action", "approval_input_digest",
            "approval_purpose_code", "approval_tenant_id", "aggregate_version",
        },
    },),
    "modern.workforceplan.scenario.approve": ({
        "table": "ppl_wfp_scenario_revisions", "actions": {"APPEND", "INSERT"},
        "assignments": {
            "workforce_scenario_id", "revision_no", "payload_digest", "result_digest",
            "approval_receipt_public_id", "approval_receipt_revision",
            "approval_outcome", "approval_action", "approval_input_digest",
            "approval_purpose_code", "approval_tenant_id", "recorded_at",
        },
    },),
}

ASYNC_PROVENANCE_CONTRACTS = {
    "modern.growth.export.request": {
        "requestTable": "prf_grw_portability_export_receipts",
        "requestAssignments": {
            "public_id", "parent_public_id", "parent_version", "state",
            "request_digest", "payload_digest", "requested_at",
        },
        "requestedEvent": "GrowthPortabilityExportRequested.v2",
        "handlerId": "internal.growth.portability-export.result.consume",
        "handlerTable": "prf_grw_portability_export_receipts",
        "handlerAssignments": {
            "state", "aggregate_version", "result_public_id", "result_revision",
            "payload_digest", "completed_at",
        },
    },
    "modern.ai.assist.create": {
        "requestTable": "sys_hris_ai_assistance_requests",
        "requestAssignments": {
            "public_id", "state", "request_digest", "payload_digest", "requested_at",
            "instruction_artifact_version_id", "source_projection_bundle_receipt_id",
            "governance_activation_receipt_id", "affected_person_disclosure_evidence_id",
        },
        "requestedEvent": "GovernedAiAssistanceRequested.v2",
        "handlerId": "internal.ai.assistance-result.consume",
        "handlerTable": "sys_hris_ai_provenance_receipts",
        "handlerAssignments": {
            "assistance_request_id", "input_digest", "output_digest", "payload_digest",
            "model_version_id", "prompt_template_version_id",
            "dataset_manifest_version_id", "evaluation_protocol_version_id",
            "governance_activation_receipt_id", "affected_person_disclosure_evidence_id",
            "human_confirmation_required", "status", "generated_at",
        },
    },
}

# Reviewer-owned AI-governance vocabulary.  These constants are intentionally
# duplicated here instead of imported from either canonical author generator or
# the physical-author implementation.  A typo or weakened local string alias
# therefore fails the independent comparison.
AI_GOVERNANCE_OPERATION_IDS = frozenset({
    "modern.ai.assist.cancel",
    "modern.ai.assist.create",
    "modern.ai.assist.review",
    "modern.ai.assist.revoke",
    "modern.ai.assistance.query",
    "modern.ai.assistances.query",
    "modern.ai.evaluation.cancel",
    "modern.ai.evaluation.query",
    "modern.ai.evaluations.query",
    "modern.ai.kill.switch",
    "modern.ai.policies.query",
    "modern.ai.policy.create",
    "modern.ai.policy.evaluate",
    "modern.ai.policy.publish",
    "modern.ai.policy.query",
    "modern.ai.policy.retire",
    "modern.ai.policy.revise",
})

AI_GOVERNANCE_PROOF_TYPES = {
    "useCaseRegistrationVersionId": "DWP.AIGovernance.UseCaseRegistrationVersion",
    "riskClassificationVersionId": "DWP.AIGovernance.RiskClassificationVersion",
    "modelVersionId": "DWP.AIGovernance.ModelVersion",
    "promptTemplateVersionId": "DWP.AIGovernance.PromptTemplateVersion",
    "datasetManifestVersionId": "DWP.AIGovernance.DatasetManifestVersion",
    "evaluationProtocolVersionId": "DWP.AIGovernance.EvaluationProtocolVersion",
    "purposePolicyVersionId": "DWP.AIGovernance.PurposePolicyVersion",
    "populationPolicyVersionId": "DWP.AIGovernance.PopulationPolicyVersion",
    "humanOversightAssignmentVersionId": "DWP.AIGovernance.HumanOversightAssignmentVersion",
    "affectedPersonDisclosurePlanVersionId": "DWP.AIGovernance.AffectedPersonDisclosurePlanVersion",
    "impactAssessmentVersionId": "DWP.AIGovernance.ImpactAssessmentVersion",
    "conformityAssessmentVersionId": "DWP.AIGovernance.ConformityAssessmentVersion",
    "incidentResponsePlanVersionId": "DWP.AIGovernance.IncidentResponsePlanVersion",
    "rollbackPlanVersionId": "DWP.AIGovernance.RollbackPlanVersion",
    "monitoringPolicyVersionId": "DWP.AIGovernance.MonitoringPolicyVersion",
    "killSwitchControlVersionId": "DWP.AIGovernance.KillSwitchControlVersion",
}

AI_GOVERNANCE_POLICY_COLUMNS = {
    "use_case_registration_version_id": "DWP.AIGovernance.UseCaseRegistrationVersion",
    "risk_classification_version_id": "DWP.AIGovernance.RiskClassificationVersion",
    "model_version_id": "DWP.AIGovernance.ModelVersion",
    "prompt_template_version_id": "DWP.AIGovernance.PromptTemplateVersion",
    "dataset_manifest_version_id": "DWP.AIGovernance.DatasetManifestVersion",
    "evaluation_protocol_version_id": "DWP.AIGovernance.EvaluationProtocolVersion",
    "purpose_policy_version_id": "DWP.AIGovernance.PurposePolicyVersion",
    "population_policy_version_id": "DWP.AIGovernance.PopulationPolicyVersion",
    "human_oversight_assignment_version_id": "DWP.AIGovernance.HumanOversightAssignmentVersion",
    "affected_person_disclosure_plan_version_id": "DWP.AIGovernance.AffectedPersonDisclosurePlanVersion",
    "impact_assessment_version_id": "DWP.AIGovernance.ImpactAssessmentVersion",
    "conformity_assessment_version_id": "DWP.AIGovernance.ConformityAssessmentVersion",
    "incident_response_plan_version_id": "DWP.AIGovernance.IncidentResponsePlanVersion",
    "rollback_plan_version_id": "DWP.AIGovernance.RollbackPlanVersion",
    "monitoring_policy_version_id": "DWP.AIGovernance.MonitoringPolicyVersion",
    "kill_switch_control_version_id": "DWP.AIGovernance.KillSwitchControlVersion",
}

AI_TYPED_CENTRAL_TABLE_REFERENCES = {
    "sys_hris_ai_policy_versions": AI_GOVERNANCE_POLICY_COLUMNS,
    "sys_hris_ai_assistance_requests": {
        "governance_activation_receipt_id": "DWP.AIGovernance.ActivationReceipt",
        "human_oversight_assignment_version_id": "DWP.AIGovernance.HumanOversightAssignmentVersion",
        "affected_person_disclosure_evidence_id": "DWP.AIGovernance.AffectedPersonDisclosureEvidence",
        "kill_switch_control_version_id": "DWP.AIGovernance.KillSwitchControlVersion",
    },
    "sys_hris_ai_evaluation_requests": {
        "evaluation_protocol_version_id": "DWP.AIGovernance.EvaluationProtocolVersion",
        "dataset_manifest_version_id": "DWP.AIGovernance.DatasetManifestVersion",
        "model_version_id": "DWP.AIGovernance.ModelVersion",
    },
    "sys_hris_ai_provenance_receipts": {
        "model_version_id": "DWP.AIGovernance.ModelVersion",
        "prompt_template_version_id": "DWP.AIGovernance.PromptTemplateVersion",
        "dataset_manifest_version_id": "DWP.AIGovernance.DatasetManifestVersion",
        "evaluation_protocol_version_id": "DWP.AIGovernance.EvaluationProtocolVersion",
        "governance_activation_receipt_id": "DWP.AIGovernance.ActivationReceipt",
        "affected_person_disclosure_evidence_id": "DWP.AIGovernance.AffectedPersonDisclosureEvidence",
    },
    "sys_hris_ai_use_policies": {
        "governance_activation_receipt_id": "DWP.AIGovernance.ActivationReceipt",
    },
}

PUBLISH_OPERATIONS = frozenset({
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

PUBLISH_PROOF_TABLES = {
    "modern.ai.policy.publish": "sys_hris_ai_policy_versions",
    "modern.analytics.metric.publish": "sys_hris_metric_versions",
    "modern.benefits.plan.publish": "ppl_bnf_plan_versions",
    "modern.compplan.snapshot.publish": "prf_cmp_approved_snapshots",
    "modern.learning.offering.publish": "prf_lrn_offering_publish_receipts",
    "modern.listening.survey.publish": "sys_hris_listening_survey_versions",
    "modern.onboarding.template.publish": "ppl_jny_template_versions",
    "modern.opportunity.publish": "prf_mkt_opportunity_publish_receipts",
    "modern.recruiting.requisition.publish": "ppl_rec_requisition_publish_receipts",
    "modern.skills.taxonomy.publish": "prf_skl_taxonomy_versions",
    "modern.succession.plan.publish": "prf_suc_publish_receipts",
    "modern.wfm.schedule.publish": "tme_wfm_schedule_publish_ledger",
    "modern.workforceplan.scenario.publish": "ppl_wfp_publish_receipts",
}

PUBLISH_APPROVAL_PROOF_COLUMNS = frozenset({
    "approval_receipt_public_id", "approval_receipt_revision", "approval_outcome",
    "approval_action", "approval_input_digest", "approval_purpose_code",
    "approval_tenant_id",
})

IMMUTABLE_PUBLICATION_LEDGER_EVENTS = {
    "modern.recruiting.requisition.publish": (
        "ppl_rec_requisition_publish_receipts", "RequisitionPublished.v2",
    ),
    "modern.learning.offering.publish": (
        "prf_lrn_offering_publish_receipts", "LearningOfferingPublished.v2",
    ),
    "modern.opportunity.publish": (
        "prf_mkt_opportunity_publish_receipts", "TalentOpportunityPublished.v2",
    ),
    "modern.succession.plan.publish": (
        "prf_suc_publish_receipts", "SuccessionPlanPublished.v2",
    ),
}

WRITER_ZERO_PRODUCERS = {
    "ppl_bnf_provider_receipts": frozenset({"internal.benefits.provider-result.consume"}),
    "ppl_hrs_sla_receipts": frozenset({"internal.hrservice.sla-milestone.consume"}),
    "ppl_cwk_sponsor_assignments": frozenset({
        "modern.contingent.engagement.create", "modern.contingent.sponsor.reassign",
    }),
    "prf_suc_readiness_evidence": frozenset({"modern.succession.readiness.record"}),
    # The legacy direct table is forbidden; the exact successor table is used.
    "sys_hris_listening_cohort_projections": frozenset({
        "internal.listening.insights.cohort-package.consume",
    }),
}

UPDATE_ONLY_PRODUCERS = {
    "ppl_rec_candidate_cases": "modern.recruiting.candidate.admit",
    "prf_skl_worker_evidence": "modern.skills.evidence.record",
    "prf_cmp_proposals": "modern.compplan.proposal.upsert",
}

PRIVATE_INTERNAL_PROJECTIONS = frozenset({
    "sys.listening.protected.response.private",
    "sys.listening.protected.erasure.internal",
})

INTERVAL_PAIRS = (
    ("effective_from", "effective_to"),
    ("valid_from", "valid_to"),
    ("starts_at", "ends_at"),
    ("shift_start", "shift_end"),
    ("period_start", "period_end"),
    ("horizon_start", "horizon_end"),
    ("interval_start", "interval_end"),
    ("work_interval_start", "work_interval_end"),
    ("opens_at", "closes_at"),
)

ALLOWED_RESPONSE_SOURCE_KINDS = frozenset({
    "PHYSICAL_POST", "PHYSICAL_POST_STATE", "SEALED_COMMAND_RECEIPT", "IMMUTABLE_PROOF",
})

ALLOWED_EVENT_SOURCE_KINDS = frozenset({
    "PHYSICAL_POST", "PHYSICAL_POST_STATE", "LOCKED_PRE_STATE",
    "SEALED_COMMAND_RECEIPT", "IMMUTABLE_PROOF", "IMMUTABLE_OWNER_PROOF",
    "DERIVED_DOMAIN_FACT", "TYPED_ORDERED_CHILD_PROJECTION",
})

TRANSIENT_SOURCE = re.compile(
    r"^(?:headers|body|pathParameters|queryParameters|request|ownerRefetch|ownerAck|handlerContext)\.",
    re.IGNORECASE,
)

REFERENCE_COLUMN = re.compile(
    r"(?:^|_)(?:id|public_id|version_id|snapshot_id|receipt_id)$|"
    r"_(?:public_id|version_id|snapshot_id|receipt_id)$"
)


class StrictJsonError(ValueError):
    pass


def reject_duplicate_pairs(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise StrictJsonError(f"duplicate JSON key: {key}")
        result[key] = value
    return result


def reject_number(value: str) -> None:
    raise StrictJsonError(f"floating/non-finite JSON number forbidden: {value}")


def canonical_bytes(value: Any) -> bytes:
    return json.dumps(
        value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False,
    ).encode("utf-8")


def sha256(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def file_sha256(path: Path) -> str:
    return sha256(path.read_bytes())


def load_strict_json(path: Path, require_seal: bool = False) -> dict[str, Any]:
    raw = path.read_bytes()
    if raw.startswith(b"\xef\xbb\xbf"):
        raise StrictJsonError(f"BOM forbidden: {path}")
    value = json.loads(
        raw.decode("utf-8"),
        object_pairs_hook=reject_duplicate_pairs,
        parse_float=reject_number,
        parse_constant=reject_number,
    )
    if not isinstance(value, dict):
        raise StrictJsonError(f"top-level object required: {path}")
    declared = value.get("sealedPayloadSha256")
    if declared is not None:
        actual = sha256(canonical_bytes({k: v for k, v in value.items() if k != "sealedPayloadSha256"}))
        if declared != actual:
            raise StrictJsonError(f"semantic seal mismatch: {path}")
    elif require_seal:
        raise StrictJsonError(f"semantic seal required: {path}")
    return value


def finding(code: str, subject: str, detail: str, **evidence: Any) -> dict[str, Any]:
    row: dict[str, Any] = {"code": code, "subject": subject, "detail": detail}
    if evidence:
        row["evidence"] = evidence
    return row


def list_ids(rows: Iterable[dict[str, Any]], key: str) -> list[str]:
    return [str(row.get(key, "")) for row in rows]


def check_exact_set(
    findings: list[dict[str, Any]], code: str, subject: str,
    actual: Iterable[str], expected: set[str] | frozenset[str],
) -> None:
    values = list(actual)
    unique = set(values)
    if unique != set(expected) or len(values) != len(unique):
        findings.append(finding(
            code, subject, "exact closed set mismatch",
            actualCount=len(values), uniqueCount=len(unique), expectedCount=len(expected),
            missing=sorted(set(expected) - unique), extra=sorted(unique - set(expected)),
            duplicates=sorted(k for k, count in Counter(values).items() if count > 1),
        ))


def normalize_ws(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip()).lower()


def table_expected_columns(exact: dict[str, Any], table: dict[str, Any]) -> dict[str, dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for raw in exact.get("commonTableContract", {}).get("columns", []):
        item = copy.deepcopy(raw)
        if item.get("name") == "__internal_id__":
            item["name"] = table.get("idColumn", {}).get("name")
            item["sqlType"] = table.get("idColumn", {}).get("sqlType", item.get("sqlType"))
            item["nullable"] = table.get("idColumn", {}).get("nullable", item.get("nullable"))
            item["default"] = table.get("idColumn", {}).get("default", item.get("default"))
        rows.append(item)
    rows.extend(copy.deepcopy(table.get("columns", [])))
    return {str(row.get("name")): row for row in rows if row.get("name")}


def iter_nested(value: Any, path: str = "") -> Iterable[tuple[str, Any]]:
    yield path, value
    if isinstance(value, dict):
        for key, child in value.items():
            yield from iter_nested(child, f"{path}/{key}")
    elif isinstance(value, list):
        for index, child in enumerate(value):
            yield from iter_nested(child, f"{path}/{index}")


def parse_create_tables(sql: str) -> dict[str, dict[str, Any]]:
    """Parse strict CREATE TABLE blocks without executing candidate code."""
    result: dict[str, dict[str, Any]] = {}
    pattern = re.compile(
        r"\bCREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS)(?P<schema>[a-z][a-z0-9_]*)\."
        r"(?P<table>(?:ppl|prf|tme|sys)_[a-z0-9_]+)\s*\(", re.IGNORECASE,
    )
    for match in pattern.finditer(sql):
        index = match.end() - 1
        depth = 0
        quote: str | None = None
        dollar: str | None = None
        while index < len(sql):
            if dollar:
                if sql.startswith(dollar, index):
                    index += len(dollar)
                    dollar = None
                    continue
                index += 1
                continue
            char = sql[index]
            if quote:
                if char == quote:
                    if index + 1 < len(sql) and sql[index + 1] == quote:
                        index += 2
                        continue
                    quote = None
                index += 1
                continue
            dm = re.match(r"\$[A-Za-z_0-9]*\$", sql[index:])
            if dm:
                dollar = dm.group(0)
                index += len(dollar)
                continue
            if char in "'\"":
                quote = char
            elif char == "(":
                depth += 1
            elif char == ")":
                depth -= 1
                if depth == 0:
                    break
            index += 1
        if depth != 0:
            continue
        body = sql[match.end():index]
        parts: list[str] = []
        start = 0
        level = 0
        in_quote = False
        cursor = 0
        while cursor < len(body):
            char = body[cursor]
            if char == "'":
                if in_quote and cursor + 1 < len(body) and body[cursor + 1] == "'":
                    cursor += 2
                    continue
                in_quote = not in_quote
            elif not in_quote:
                if char == "(":
                    level += 1
                elif char == ")":
                    level -= 1
                elif char == "," and level == 0:
                    parts.append(body[start:cursor].strip())
                    start = cursor + 1
            cursor += 1
        parts.append(body[start:].strip())
        columns: dict[str, str] = {}
        constraints: list[str] = []
        for part in parts:
            if not part:
                continue
            cm = re.match(r'"?([a-z][a-z0-9_]*)"?\s+(.+)$', part, re.I | re.S)
            if not cm:
                constraints.append(part)
                continue
            name = cm.group(1).lower()
            if name in {"constraint", "primary", "unique", "foreign", "check", "exclude"}:
                constraints.append(part)
            else:
                columns[name] = cm.group(2).strip()
        table_name = match.group("table").lower()
        if table_name in result:
            result[table_name]["duplicate"] = True
        result[table_name] = {
            "schema": match.group("schema").lower(),
            "columns": columns,
            "constraints": constraints,
            "block": sql[match.start():index + 1],
            "duplicate": result.get(table_name, {}).get("duplicate", False),
        }
    return result


def candidate_operation_maps(docs: dict[str, dict[str, Any]]) -> dict[str, dict[str, dict[str, Any]]]:
    return {
        "manifest": {x["operationId"]: x for x in docs["manifest"].get("operations", [])},
        "ssot": {x["operationId"]: x for x in docs["ssot"].get("operations", [])},
        "causal": {x["operationId"]: x for x in docs["causal"].get("operations", [])},
        "semantic": {x["operationId"]: x for x in docs["semantic"].get("operations", [])},
        "exact": {x["operationId"]: x for x in docs["exact"].get("operationBindings", [])},
        "lineage": {x["operationId"]: x for x in docs["exact"].get("operationFieldLineage", [])},
        "physical": {x["operationId"]: x for x in docs["physicalQueries"].get("operationPhysicalContracts", [])},
    }


def validate_inventory(docs: dict[str, dict[str, Any]], findings: list[dict[str, Any]], oracle: dict[str, Any] | None) -> None:
    manifest = docs["manifest"]
    scope = manifest.get("scope", {})
    for key, expected in EXPECTED_COUNTS.items():
        scope_key = "tableSpecifications" if key == "tables" else key
        if scope.get(scope_key) != expected:
            findings.append(finding(
                "C-INVENTORY-COUNT", f"manifest.scope.{scope_key}",
                f"expected {expected}, got {scope.get(scope_key)!r}",
            ))
    operation_rows = manifest.get("operations", [])
    operation_ids = list_ids(operation_rows, "operationId")
    handler_ids = [str(x) for x in manifest.get("handlerIds", [])]
    event_ids = [str(x) for x in manifest.get("publicEventIds", [])]
    table_ids = [str(x) for x in manifest.get("tableIds", [])]
    for code, subject, values, expected in (
        ("C-OPERATION-COUNT", "manifest.operations", operation_ids, 199),
        ("C-HANDLER-COUNT", "manifest.handlerIds", handler_ids, 25),
        ("C-EVENT-COUNT", "manifest.publicEventIds", event_ids, 155),
        ("C-TABLE-COUNT", "manifest.tableIds", table_ids, EXPECTED_COUNTS["tables"]),
    ):
        if len(values) != expected or len(set(values)) != expected:
            findings.append(finding(
                code, subject, "count, uniqueness or identity closure mismatch",
                count=len(values), unique=len(set(values)), expected=expected,
                duplicates=sorted(k for k, count in Counter(values).items() if count > 1),
            ))
    modes = Counter(str(row.get("mode")) for row in operation_rows)
    if modes != Counter({"COMMAND": 133, "QUERY": 66}):
        findings.append(finding("C-OPERATION-MODE-COUNT", "manifest.operations", "mode count mismatch", actual=dict(modes)))
    if any(row.get("session") not in EXPECTED_SESSIONS for row in operation_rows):
        findings.append(finding("C-OPERATION-OWNER", "manifest.operations", "unknown owner session"))

    if oracle is not None:
        expected = oracle.get("inventory", {})
        check_exact_set(findings, "C-ORACLE-OPERATION-SET", "manifest.operations", operation_ids, set(expected.get("operationIds", [])))
        check_exact_set(findings, "C-ORACLE-HANDLER-SET", "manifest.handlerIds", handler_ids, set(expected.get("handlerIds", [])))
        check_exact_set(findings, "C-ORACLE-EVENT-SET", "manifest.publicEventIds", event_ids, set(expected.get("publicEventIds", [])))
        check_exact_set(findings, "C-ORACLE-TABLE-SET", "manifest.tableIds", table_ids, set(expected.get("tableIds", [])))
        expected_owners = expected.get("operationOwnerMode", {})
        actual_owners = {row.get("operationId"): [row.get("session"), row.get("mode")] for row in operation_rows}
        if actual_owners != expected_owners:
            findings.append(finding(
                "C-ORACLE-OWNER-MODE", "manifest.operations", "exact operation owner/mode mapping drift",
                missing=sorted(set(expected_owners) - set(actual_owners)),
                extra=sorted(set(actual_owners) - set(expected_owners)),
                changed=sorted(k for k in set(expected_owners) & set(actual_owners) if expected_owners[k] != actual_owners[k]),
            ))


def validate_table_scope_change(
    docs: dict[str, dict[str, Any]], scope_oracle: dict[str, Any] | None,
    findings: list[dict[str, Any]],
) -> None:
    if scope_oracle is None:
        findings.append(finding(
            "C-TABLE-SCOPE-ORACLE-MISSING", str(TABLE_SCOPE_ORACLE_PATH),
            "approved ADR-HRIS-034 table-scope oracle is unavailable",
        ))
        return
    if not (
        scope_oracle.get("status") == "FROZEN_APPROVED_TABLE_SCOPE_CHANGE"
        and scope_oracle.get("architectureDecision")
        == "architecture-decision-register.csv#ADR-HRIS-034"
        and scope_oracle.get("predecessorTableCount") == 106
        and scope_oracle.get("deltaCount") == 9
        and scope_oracle.get("successorTableCount") == 115
        and scope_oracle.get("missingOrExtraDisposition") == "FAIL_CLOSED"
    ):
        findings.append(finding(
            "C-TABLE-SCOPE-ORACLE-HEADER", str(TABLE_SCOPE_ORACLE_PATH),
            "approved 106 + exact-nine = 115 scope header drift",
        ))
    oracle_rows = scope_oracle.get("delta", [])
    actual_oracle = {
        str(row.get("tableId")): (
            str(row.get("session")), str(row.get("reason")), str(row.get("producer")),
        )
        for row in oracle_rows if isinstance(row, dict)
    }
    if (
        len(oracle_rows) != 9
        or len(actual_oracle) != 9
        or actual_oracle != APPROVED_TABLE_SCOPE_DELTA
    ):
        findings.append(finding(
            "C-TABLE-SCOPE-ORACLE-DELTA", str(TABLE_SCOPE_ORACLE_PATH),
            "approved exact-nine table delta identities or provenance drift",
            missing=sorted(set(APPROVED_TABLE_SCOPE_DELTA) - set(actual_oracle)),
            extra=sorted(set(actual_oracle) - set(APPROVED_TABLE_SCOPE_DELTA)),
            changed=sorted(
                key for key in set(APPROVED_TABLE_SCOPE_DELTA) & set(actual_oracle)
                if APPROVED_TABLE_SCOPE_DELTA[key] != actual_oracle[key]
            ),
        ))
    manifest_tables = set(docs["manifest"].get("tableIds", []))
    missing_delta = set(APPROVED_TABLE_SCOPE_DELTA) - manifest_tables
    if missing_delta:
        findings.append(finding(
            "C-TABLE-SCOPE-CANDIDATE-DELTA", "manifest.tableIds",
            "approved successor table delta is incomplete", missing=sorted(missing_delta),
        ))
    manifest_scope_change = docs["manifest"].get("tableScopeChange") or {}
    if not (
        manifest_scope_change.get("previousTableSpecifications") == 106
        and manifest_scope_change.get("activeTableSpecifications") == 115
        and manifest_scope_change.get("deltaCount") == 9
        and manifest_scope_change.get("reason")
        == "P0_TYPED_ORDERED_CHILDREN_AND_IMMUTABLE_PUBLICATION_PROOF_LEDGERS"
    ):
        findings.append(finding(
            "C-TABLE-SCOPE-MANIFEST-HEADER", "manifest.tableScopeChange",
            "candidate does not reproduce the approved 106 + exact-nine = 115 scope decision",
            actual={key: manifest_scope_change.get(key) for key in (
                "previousTableSpecifications", "activeTableSpecifications", "deltaCount", "reason",
            )},
        ))
    manifest_delta_rows = manifest_scope_change.get("rows") or {}
    check_exact_set(
        findings, "C-TABLE-SCOPE-MANIFEST-DELTA", "manifest.tableScopeChange.rows",
        manifest_delta_rows, set(APPROVED_TABLE_SCOPE_DELTA),
    )
    for table_name, (session, reason, producer) in APPROVED_TABLE_SCOPE_DELTA.items():
        row = manifest_delta_rows.get(table_name, {})
        expected_class = (
            "UUID_ARRAY_TO_TYPED_ORDERED_CHILD"
            if reason == "NORMALIZE_UUID_ARRAY_TO_TYPED_ORDERED_CHILD"
            else reason
        )
        if not (
            row.get("ownerSession") == session
            and row.get("p0Class") == expected_class
            and row.get("producer") == producer
            and isinstance(row.get("consumers"), list) and row.get("consumers")
            and str(row.get("constraint", "")).strip()
            and str(row.get("nonReplaceability", "")).strip()
        ):
            findings.append(finding(
                "C-TABLE-SCOPE-MANIFEST-PROVENANCE", table_name,
                "candidate table-scope row lacks exact owner/class/producer/consumer/constraint rationale",
                expected={"ownerSession": session, "p0Class": expected_class, "producer": producer},
                actual=row,
            ))
    table_specs = {
        row["tableName"]: row for row in docs["exact"].get("tableSpecifications", [])
    }
    operations = {row["operationId"]: row for row in docs["ssot"].get("operations", [])}
    handlers = {row["handlerId"]: row for row in docs["ssot"].get("systemHandlers", [])}
    for table_name, (session, reason, producer) in APPROVED_TABLE_SCOPE_DELTA.items():
        table = table_specs.get(table_name, {})
        if table.get("session") != session:
            findings.append(finding(
                "C-TABLE-SCOPE-OWNER", table_name,
                "approved delta table owner session drift", expected=session, actual=table.get("session"),
            ))
        producer_rows = (
            handlers.get(producer, {}).get("writes", [])
            if producer.startswith("internal.")
            else operations.get(producer, {}).get("orderedDml", [])
        )
        expected_action = "APPEND_MANY" if reason.startswith("NORMALIZE_") else "APPEND"
        matching_writes = [
            row for row in producer_rows
            if row.get("table") == table_name and row.get("action") == expected_action
        ]
        if not matching_writes:
            findings.append(finding(
                "C-TABLE-SCOPE-PRODUCER", f"{producer}:{table_name}",
                "approved delta table lacks its exact producer/action",
                expectedAction=expected_action,
            ))
        if reason.startswith("NORMALIZE_"):
            columns = set(table_expected_columns(docs["exact"], table)) if table else set()
            unique_sets = {
                tuple(str(value) for value in row.get("columns", []))
                for row in table.get("uniqueKeys", [])
            }
            has_parent_ordinal = any(
                {"tenant_id", "parent_public_id", "ordinal"} <= set(values)
                for values in unique_sets
            )
            has_parent_child = any(
                {"tenant_id", "parent_public_id"} <= set(values)
                and "ordinal" not in values and len(values) >= 3
                for values in unique_sets
            )
            checks = normalize_ws(" ".join(
                str(row.get("expression", "")) for row in table.get("checks", [])
            ))
            if not (
                {"parent_public_id", "ordinal"} <= columns
                and has_parent_ordinal and has_parent_child
                and "ordinal" in checks
            ):
                findings.append(finding(
                    "C-TABLE-SCOPE-NORMALIZED-CHILD", table_name,
                    "typed ordered child lacks parent/ordinal/child uniqueness or ordinal check",
                    columns=sorted(columns), uniqueKeys=[list(values) for values in sorted(unique_sets)],
                ))
            query_reentry = [
                operation_id for operation_id, operation in operations.items()
                if operation.get("mode") == "QUERY" and table_name in json.dumps(operation)
            ]
            event_reentry = [
                str(event.get("eventName"))
                for operation in operations.values() for event in operation.get("events", [])
                if table_name in json.dumps(event)
            ]
            if not query_reentry and not event_reentry:
                findings.append(finding(
                    "C-TABLE-SCOPE-REENTRY", table_name,
                    "normalized child has no query or public-event re-entry path",
                ))
    array_columns = [
        f"{table_name}.{column.get('name')}"
        for table_name, table in table_specs.items()
        for column in table_expected_columns(docs["exact"], table).values()
        if str(column.get("sqlType", "")).upper().endswith("[]")
    ]
    if array_columns:
        findings.append(finding(
            "C-TABLE-SCOPE-UUID-ARRAY-RESIDUE", "exact.tableSpecifications",
            "approved normalization scope requires zero physical array columns",
            columns=sorted(array_columns),
        ))
    adr_path = READINESS / "architecture-decision-register.csv"
    try:
        adr_matches = [
            line for line in adr_path.read_text(encoding="utf-8").splitlines()
            if line.startswith("ADR-HRIS-034,")
        ]
    except Exception:
        adr_matches = []
    if len(adr_matches) != 1 or ",DECIDED," not in adr_matches[0] or "115 physical tables" not in adr_matches[0]:
        findings.append(finding(
            "C-TABLE-SCOPE-ADR", str(adr_path),
            "ADR-HRIS-034 exact decided 115-table authorization is unavailable or duplicated",
            matches=adr_matches,
        ))


def validate_canonical_closure(docs: dict[str, dict[str, Any]], findings: list[dict[str, Any]]) -> None:
    maps = candidate_operation_maps(docs)
    expected_ops = set(maps["manifest"])
    for name, rows in maps.items():
        check_exact_set(findings, "C-CANONICAL-OPERATION-CLOSURE", name, rows, expected_ops)

    manifest = docs["manifest"]
    expected_handlers = set(manifest.get("handlerIds", []))
    expected_tables = set(manifest.get("tableIds", []))
    expected_events = set(manifest.get("publicEventIds", []))
    handler_sets = {
        "ssot": list_ids(docs["ssot"].get("systemHandlers", []), "handlerId"),
        "causal": list_ids(docs["causal"].get("internalConsumerHandlers", []), "handlerId"),
        "exact": list_ids(docs["exact"].get("internalConsumerHandlers", []), "handlerId"),
        "events": list_ids(docs["events"].get("internalEventHandlers", []), "handlerId"),
        "physicalHandlers": list_ids(docs["physicalHandlers"].get("handlers", []), "handlerId"),
    }
    for name, values in handler_sets.items():
        check_exact_set(findings, "C-CANONICAL-HANDLER-CLOSURE", name, values, expected_handlers)
    check_exact_set(
        findings, "C-CANONICAL-TABLE-CLOSURE", "exact.tableSpecifications",
        list_ids(docs["exact"].get("tableSpecifications", []), "tableName"), expected_tables,
    )
    check_exact_set(
        findings, "C-CANONICAL-EVENT-CLOSURE", "events.eventPayloadSchemas",
        list_ids(docs["events"].get("eventPayloadSchemas", []), "eventName"), expected_events,
    )
    check_exact_set(
        findings, "C-CANONICAL-EVENT-CLOSURE", "identity.eventProducerByName",
        docs["identity"].get("eventProducerByName", {}).keys(), expected_events,
    )

    ssot_events: set[str] = set()
    for operation in docs["ssot"].get("operations", []):
        ssot_events.update(str(event.get("eventName")) for event in operation.get("events", []))
    for handler in docs["ssot"].get("systemHandlers", []):
        if isinstance(handler.get("event"), dict):
            ssot_events.add(str(handler["event"].get("eventName")))
    if ssot_events != expected_events:
        findings.append(finding(
            "C-SSOT-EVENT-PRODUCER-CLOSURE", "ssot operations+handlers",
            "event producers do not close the manifest public-event set",
            missing=sorted(expected_events - ssot_events), extra=sorted(ssot_events - expected_events),
        ))

    for operation_id in sorted(expected_ops):
        manifest_row = maps["manifest"].get(operation_id, {})
        ssot_row = maps["ssot"].get(operation_id, {})
        causal_row = maps["causal"].get(operation_id, {})
        for name, row in (("ssot", ssot_row), ("causal", causal_row), ("semantic", maps["semantic"].get(operation_id, {})), ("exact", maps["exact"].get(operation_id, {}))):
            for key in ("session", "mode"):
                if row.get(key) != manifest_row.get(key):
                    findings.append(finding(
                        "C-OPERATION-OWNER-MODE-DRIFT", operation_id,
                        f"{name}.{key} differs from manifest", expected=manifest_row.get(key), actual=row.get(key),
                    ))
        manifest_events = set(manifest_row.get("eventIds", []))
        ssot_operation_events = {event.get("eventName") for event in ssot_row.get("events", [])}
        causal_events = {event.get("eventName") for event in causal_row.get("causalEvents", [])}
        if manifest_events != ssot_operation_events:
            findings.append(finding(
                "C-MANIFEST-OPERATION-EVENT-CLOSURE", operation_id,
                "manifest operation eventIds differ from canonical SSOT",
                manifest=sorted(manifest_events), ssot=sorted(ssot_operation_events),
            ))
        if causal_events != ssot_operation_events:
            findings.append(finding(
                "C-CAUSAL-OPERATION-EVENT-CLOSURE", operation_id,
                "causal projection event set differs from SSOT",
                causal=sorted(causal_events), ssot=sorted(ssot_operation_events),
            ))


def validate_queries(docs: dict[str, dict[str, Any]], findings: list[dict[str, Any]]) -> None:
    maps = candidate_operation_maps(docs)
    response_schemas = {row.get("schemaId"): row for row in docs["exact"].get("responseSchemas", [])}
    response_refs: list[str] = []
    required_read_keys = {
        "projectionTuple", "tenantPep", "purpose", "population", "asOf", "freshness", "pagination",
        "writesForbidden", "receiptsForbidden", "outboxForbidden",
    }
    required_tuple_keys = {"queryOperation", "responseSchema", "entity", "physicalSources", "pep"}
    required_physical_keys = {
        "responseSchema", "itemEntity", "physicalJoins", "tenantPep", "purpose", "population",
        "asOf", "freshness", "cursor",
    }
    for operation_id, operation in maps["ssot"].items():
        if operation.get("mode") != "QUERY":
            continue
        read_plan = operation.get("readPlan") or {}
        missing = sorted(required_read_keys - set(read_plan))
        projection = read_plan.get("projectionTuple") or {}
        tuple_missing = sorted(required_tuple_keys - set(projection))
        if missing or tuple_missing:
            findings.append(finding(
                "C-QUERY-EXACT-TUPLE", operation_id,
                "query lacks an operation-specific closed projection tuple",
                missingReadPlanMembers=missing, missingProjectionMembers=tuple_missing,
            ))
        if operation.get("orderedDml") or operation.get("events"):
            findings.append(finding("C-QUERY-MUTATION", operation_id, "query declares DML or events"))
        if not all(read_plan.get(key) is True for key in ("writesForbidden", "receiptsForbidden", "outboxForbidden")):
            findings.append(finding("C-QUERY-FAIL-CLOSED", operation_id, "query write/receipt/outbox fence incomplete"))

        exact = maps["exact"].get(operation_id, {})
        response_ref = exact.get("responseSchemaRef")
        response_refs.append(str(response_ref))
        if response_ref != f"{operation_id}.Response.v3" or response_ref not in response_schemas:
            findings.append(finding(
                "C-QUERY-RESPONSE-SCHEMA", operation_id,
                "query must own one dedicated closed response schema", responseSchemaRef=response_ref,
            ))
        exact_projection = exact.get("responseProjection") or {}
        if set(required_tuple_keys) - set(exact_projection):
            findings.append(finding(
                "C-QUERY-EXACT-BINDING", operation_id,
                "exact operation binding lacks the closed response projection",
                missing=sorted(required_tuple_keys - set(exact_projection)),
            ))
        if projection and exact_projection and projection != exact_projection:
            findings.append(finding(
                "C-QUERY-CANONICAL-PROJECTION-DRIFT", operation_id,
                "SSOT read projection differs from exact-schema projection",
            ))

        physical = maps["physical"].get(operation_id, {})
        physical_query = physical.get("queryContract") or {}
        missing_physical = sorted(required_physical_keys - set(physical_query))
        if missing_physical:
            findings.append(finding(
                "C-QUERY-PHYSICAL-TUPLE", operation_id,
                "physical query contract lacks required operation-specific members",
                missing=missing_physical,
            ))
        if physical.get("writeTables") or physical.get("writePlan") or physical.get("queryMutationPolicy") != "NO_RECEIPT_NO_OUTBOX_NO_DML":
            findings.append(finding("C-QUERY-PHYSICAL-MUTATION", operation_id, "physical query mutation fence drift"))

    if len(response_refs) != 66 or len(set(response_refs)) != 66:
        findings.append(finding(
            "C-QUERY-RESPONSE-ALIAS", "exact.responseSchemas",
            "66 queries must have 66 dedicated response schemas",
            count=len(response_refs), unique=len(set(response_refs)),
        ))


def validate_commands_and_lineage(docs: dict[str, dict[str, Any]], findings: list[dict[str, Any]]) -> None:
    ssot = {row["operationId"]: row for row in docs["ssot"].get("operations", [])}
    lineages = {row["operationId"]: row for row in docs["exact"].get("operationFieldLineage", [])}
    tables = set(docs["manifest"].get("tableIds", []))
    pdr_occurrences: list[tuple[str, str]] = []
    for operation_id, operation in ssot.items():
        if operation.get("mode") != "COMMAND":
            continue
        fields = {row.get("source"): row for row in operation.get("requestFields", [])}
        for source in ("headers.Idempotency-Key", "headers.X-Correlation-ID"):
            if source not in fields or fields[source].get("requestDigestMember") is not False:
                findings.append(finding(
                    "C-IDEMPOTENCY-DIGEST-SEPARATION", operation_id,
                    f"{source} must be present and excluded from the canonical business digest",
                ))
        envelope = operation.get("transactionEnvelope") or {}
        if envelope.get("idempotencyTuple") != "tenant+caller+operation+Idempotency-Key":
            findings.append(finding("C-IDEMPOTENCY-TUPLE", operation_id, "idempotency tuple drift"))
        excludes = normalize_ws(" ".join(str(x) for x in envelope.get("canonicalRequestDigestExcludes", [])))
        if not all(token in excludes for token in ("idempotency", "correlation", "authorization", "purpose", "population")):
            findings.append(finding("C-BUSINESS-DIGEST-EXCLUSIONS", operation_id, "digest exclusions incomplete"))
        dml = operation.get("orderedDml", [])
        if not dml or dml[0].get("action") != "CLAIM_OR_REPLAY" or dml[-1].get("action") != "APPEND_EVENTS":
            findings.append(finding(
                "C-COMMAND-TRANSACTION-ORDER", operation_id,
                "expected claim first and transactional outbox last",
            ))
        if not any(row.get("action") == "COMPLETE_RECEIPT" for row in dml):
            findings.append(finding("C-COMMAND-CLOSED-RECEIPT", operation_id, "closed receipt step missing"))

        for path, value in iter_nested(operation):
            if isinstance(value, dict) and value.get("kind") == "PERSISTED_DECISION_RECEIPT":
                pdr_occurrences.append((operation_id, path))

        lineage = lineages.get(operation_id, {})
        for row in lineage.get("responseFieldSources", []):
            source_kind = row.get("sourceKind")
            source_path = str(row.get("sourcePath", ""))
            if source_kind not in ALLOWED_RESPONSE_SOURCE_KINDS or TRANSIENT_SOURCE.match(source_path):
                findings.append(finding(
                    "C-TRANSIENT-RESPONSE-SOURCE", f"{operation_id}:{row.get('target')}",
                    "response field is not reconstructed from committed post-state, sealed receipt or immutable proof",
                    sourceKind=source_kind, sourcePath=source_path,
                ))
        for row in lineage.get("eventFieldSources", []):
            source_kind = row.get("sourceKind")
            source_path = str(row.get("sourcePath", ""))
            if source_kind not in ALLOWED_EVENT_SOURCE_KINDS or TRANSIENT_SOURCE.match(source_path):
                findings.append(finding(
                    "C-TRANSIENT-EVENT-SOURCE", f"{operation_id}:{row.get('target')}",
                    "event field is not reconstructable from durable causal facts",
                    sourceKind=source_kind, sourcePath=source_path,
                ))

    if pdr_occurrences:
        findings.append(finding(
            "C-PERSISTED-DECISION-RECEIPT-FORBIDDEN", "ssot.operations",
            "command/auth receipt is still used as business provenance",
            count=len(pdr_occurrences), occurrences=[{"operationId": op, "path": path} for op, path in pdr_occurrences],
        ))
    missing_reviewed = PROVENANCE_REPLACEMENT_OPERATIONS - {op for op, _ in pdr_occurrences}
    # A zero PDR result is terminally correct; this set is only useful while the
    # bad marker remains and must not force it to remain.
    if pdr_occurrences and missing_reviewed:
        findings.append(finding(
            "C-PROVENANCE-REVIEW-MATRIX", "ssot.operations",
            "current PDR occurrence set differs from the independently reviewed replacement matrix",
            missing=sorted(missing_reviewed),
        ))

    for operation_id in sorted(HISTORICAL_CREATE_NONE | SUCCESSOR_CREATE_NONE):
        operation = ssot.get(operation_id, {})
        transition = operation.get("transition") or {}
        if transition.get("preStates") != ["NONE"]:
            findings.append(finding(
                "C-CREATE-NONE-PRESTATE", operation_id,
                "root creation must have the exact non-existent pre-state NONE",
                actual=transition.get("preStates"),
            ))
        root = (operation.get("aggregateRoot") or {}).get("table")
        domain_steps = [row for row in operation.get("orderedDml", []) if row.get("table") in tables]
        if not any(row.get("table") == root and row.get("action") in {"INSERT", "APPEND", "UPSERT"} for row in domain_steps):
            findings.append(finding("C-CREATE-ROOT-INSERT", operation_id, "NONE transition lacks a root insert/append"))
        for event in operation.get("events", []):
            from_state = next((row for row in event.get("fields", []) if row.get("name") == "fromState"), None)
            if from_state and not (
                from_state.get("sourceKind") == "DERIVED_DOMAIN_FACT" and from_state.get("source") == "CONSTANT:NONE"
            ):
                findings.append(finding(
                    "C-CREATE-EVENT-NONE", f"{operation_id}:{event.get('eventName')}",
                    "create event reads a phantom pre-state",
                    actual=from_state,
                ))

    for operation_id, (table, expected_states) in MIXED_CREATE_UPDATE.items():
        operation = ssot.get(operation_id, {})
        states = set((operation.get("transition") or {}).get("preStates", []))
        actions = {(row.get("action"), row.get("table")) for row in operation.get("orderedDml", [])}
        if states != expected_states or not ({("INSERT", table), ("UPDATE_CAS", table)} <= actions):
            findings.append(finding(
                "C-MIXED-UPSERT-BRANCH", operation_id,
                "mixed NONE/DRAFT command must declare independent INSERT and UPDATE_CAS branches",
                preStates=sorted(states), actions=sorted([list(x) for x in actions if x[1] == table]),
            ))


def handler_write_tables(handler: dict[str, Any]) -> set[str]:
    if isinstance(handler.get("writes"), list):
        return {str(row.get("table")) for row in handler["writes"] if isinstance(row, dict)}
    if isinstance(handler.get("domainWriteTables"), list):
        return {str(x) for x in handler["domainWriteTables"]}
    return set()


def operation_write_tables(operation: dict[str, Any], table_ids: set[str]) -> set[str]:
    return {str(row.get("table")) for row in operation.get("orderedDml", []) if row.get("table") in table_ids}


def validate_business_provenance(docs: dict[str, dict[str, Any]], findings: list[dict[str, Any]]) -> None:
    operations = {row["operationId"]: row for row in docs["ssot"].get("operations", [])}
    handlers = {row["handlerId"]: row for row in docs["ssot"].get("systemHandlers", [])}
    exact_tables = {
        row["tableName"]: row for row in docs["exact"].get("tableSpecifications", [])
    }
    if len(BUSINESS_PROVENANCE_CONTRACTS) != 16:
        findings.append(finding(
            "C-BUSINESS-PROVENANCE-ORACLE", "reviewer frozen constants",
            "the independently reviewed provenance operation set is not exact 16",
            actual=len(BUSINESS_PROVENANCE_CONTRACTS),
        ))
    for operation_id, contracts in BUSINESS_PROVENANCE_CONTRACTS.items():
        operation = operations.get(operation_id, {})
        dml = operation.get("orderedDml", [])
        for contract in contracts:
            table = str(contract["table"])
            acceptable_actions = set(contract["actions"])
            required_assignments = set(contract["assignments"])
            candidates = [
                row for row in dml
                if row.get("table") == table and row.get("action") in acceptable_actions
            ]
            complete = [
                row for row in candidates
                if required_assignments <= set((row.get("assignments") or {}).keys())
            ]
            if not complete:
                findings.append(finding(
                    "C-BUSINESS-PROVENANCE-DURABLE-WRITE", f"{operation_id}:{table}",
                    "operation lacks its frozen durable business-fact/proof write",
                    acceptableActions=sorted(acceptable_actions),
                    requiredAssignments=sorted(required_assignments),
                    observed=[{
                        "action": row.get("action"),
                        "assignments": sorted((row.get("assignments") or {}).keys()),
                    } for row in candidates],
                ))
                continue
            row = complete[0]
            if row.get("phase") != "IN_TRANSACTION":
                findings.append(finding(
                    "C-BUSINESS-PROVENANCE-TRANSACTION", f"{operation_id}:{table}",
                    "durable business provenance is not explicitly in the owner transaction",
                    phase=row.get("phase"),
                ))
            assignments_text = normalize_ws(json.dumps(row.get("assignments", {}), ensure_ascii=False))
            if "command_receipts" in assignments_text:
                findings.append(finding(
                    "C-BUSINESS-PROVENANCE-RECEIPT-SOURCE", f"{operation_id}:{table}",
                    "business proof assignments still derive from a command receipt",
                ))
            table_spec = exact_tables.get(table, {})
            table_columns = set(table_expected_columns(docs["exact"], table_spec)) if table_spec else set()
            if not required_assignments <= table_columns:
                findings.append(finding(
                    "C-BUSINESS-PROVENANCE-SCHEMA", f"{operation_id}:{table}",
                    "canonical exact table lacks fields required by the durable proof",
                    missing=sorted(required_assignments - table_columns),
                ))

    archive = operations.get("modern.growth.profile.archive", {})
    archive_sources = {
        str(row.get("source")) for row in archive.get("requestFields", [])
    } | {
        str(row.get("source")) for row in archive.get("inputEffects", [])
    }
    if "body.portabilityExportRequested" in archive_sources:
        findings.append(finding(
            "C-GROWTH-ARCHIVE-PORTABILITY-BOOLEAN", "modern.growth.profile.archive",
            "archive still couples a portability-export boolean instead of a separate async intent",
        ))
    if any(
        row.get("table") == "prf_grw_portability_export_receipts"
        for row in archive.get("orderedDml", [])
    ):
        findings.append(finding(
            "C-GROWTH-ARCHIVE-PORTABILITY-WRITE", "modern.growth.profile.archive",
            "archive command writes the export ledger; modern.growth.export.request must own it",
        ))

    for operation_id, contract in ASYNC_PROVENANCE_CONTRACTS.items():
        operation = operations.get(operation_id, {})
        request_steps = [
            row for row in operation.get("orderedDml", [])
            if row.get("table") == contract["requestTable"]
            and row.get("action") in {"INSERT", "APPEND"}
        ]
        request_required = set(contract["requestAssignments"])
        if not any(
            request_required <= set((row.get("assignments") or {}).keys())
            and row.get("phase") == "IN_TRANSACTION"
            for row in request_steps
        ):
            findings.append(finding(
                "C-ASYNC-REQUEST-DURABILITY", operation_id,
                "async command lacks a replay-stable committed request-intent row",
                table=contract["requestTable"], requiredAssignments=sorted(request_required),
            ))
        events = {str(row.get("eventName")) for row in operation.get("events", [])}
        requested_event = str(contract["requestedEvent"])
        if requested_event not in events or any(
            token in event.lower() for event in events for token in ("produced", "completed", "resultrecorded")
        ):
            findings.append(finding(
                "C-ASYNC-REQUEST-EVENT-BOUNDARY", operation_id,
                "create/request must publish only intent-stage semantics, never a completion claim",
                required=requested_event, actual=sorted(events),
            ))
        handler_id = str(contract["handlerId"])
        handler = handlers.get(handler_id, {})
        handler_rows = [
            row for row in handler.get("writes", [])
            if row.get("table") == contract["handlerTable"]
            and row.get("action") in {"INSERT", "APPEND", "UPDATE_CAS"}
        ]
        handler_required = set(contract["handlerAssignments"])
        if not any(
            handler_required <= set((row.get("assignments") or {}).keys())
            for row in handler_rows
        ):
            findings.append(finding(
                "C-ASYNC-RESULT-PROOF", f"{operation_id}:{handler_id}",
                "completion handler lacks its exact durable result/provenance proof",
                table=contract["handlerTable"], requiredAssignments=sorted(handler_required),
                observed=[{
                    "action": row.get("action"),
                    "assignments": sorted((row.get("assignments") or {}).keys()),
                } for row in handler_rows],
            ))
        table_spec = exact_tables.get(str(contract["handlerTable"]), {})
        table_columns = set(table_expected_columns(docs["exact"], table_spec)) if table_spec else set()
        if not handler_required <= table_columns:
            findings.append(finding(
                "C-ASYNC-RESULT-PROOF-SCHEMA", f"{operation_id}:{contract['handlerTable']}",
                "result/provenance table lacks the frozen completion-proof fields",
                missing=sorted(handler_required - table_columns),
            ))


def validate_producers_handlers(docs: dict[str, dict[str, Any]], findings: list[dict[str, Any]]) -> None:
    ssot_ops = {row["operationId"]: row for row in docs["ssot"].get("operations", [])}
    ssot_handlers = {row["handlerId"]: row for row in docs["ssot"].get("systemHandlers", [])}
    physical_handlers = {row["handlerId"]: row for row in docs["physicalHandlers"].get("handlers", [])}
    table_ids = set(docs["manifest"].get("tableIds", []))

    for table, producers in WRITER_ZERO_PRODUCERS.items():
        if not any(
            table in (
                handler_write_tables(ssot_handlers.get(producer, {}))
                if producer.startswith("internal.")
                else operation_write_tables(ssot_ops.get(producer, {}), table_ids)
            )
            for producer in producers
        ):
            findings.append(finding(
                "C-WRITER-ZERO-PRODUCER", table,
                "no reviewed successor producer writes the formerly writer-zero table",
                producers=sorted(producers),
            ))
    for table, producer in UPDATE_ONLY_PRODUCERS.items():
        operation = ssot_ops.get(producer, {})
        actions = {row.get("action") for row in operation.get("orderedDml", []) if row.get("table") == table}
        expected = {"INSERT"}
        if producer.endswith("proposal.upsert"):
            expected.add("UPDATE_CAS")
        if not expected <= actions:
            findings.append(finding(
                "C-UPDATE-ONLY-PRODUCER", f"{producer}:{table}",
                "successor does not contain the required first-write branch",
                expectedActions=sorted(expected), actualActions=sorted(str(x) for x in actions),
            ))

    generic_step_order = [
        "CLAIM_INBOX first",
        "LOCK aggregate tenant+public_id+version",
        "VALIDATE signed owner result and exact subject/version/digest",
        "UPDATE_CAS domain",
        "COMPLETE_INBOX closed result/resultDigest/post identity+version",
        "APPEND_OUTBOX last",
    ]
    listening_transaction = {
        "stepOrder": "CLAIM_INBOX_FIRST_DOMAIN_CAS_CLOSED_ACK_OUTBOX_LAST",
        "sameTransaction": True,
        "sameEventSameDigest": "RETURN_SEALED_FIRST_RESULT_ZERO_WRITES",
        "sameEventDifferentDigest": "QUARANTINE_ZERO_DOMAIN_ACK_OUTBOX_WRITES",
        "faultInjection": "ANY_STEP_ROLLS_BACK_INBOX_DOMAIN_ACK_OUTBOX",
    }
    for handler_id, handler in ssot_handlers.items():
        physical = physical_handlers.get(handler_id, {})
        structured = handler.get("structuredTransaction") or {}
        if handler.get("orderedDml") is not None:
            if (
                handler.get("orderedDml") != generic_step_order
                or (handler.get("rollback") or {}).get("rule")
                != "ANY_STEP_FAULT_ROLLS_BACK_INBOX_DOMAIN_ACK_AND_OUTBOX"
                or (handler.get("event") or {}).get("emission") != {
                    "outboxWrite": "SAME_TRANSACTION_AFTER_DOMAIN_AND_CLOSED_RECEIPT",
                    "brokerPublish": "AFTER_COMMIT_ONLY",
                    "rollback": "NO_OUTBOX_OR_PUBLISH_ON_FAILURE",
                }
            ):
                findings.append(finding(
                    "C-HANDLER-ATOMIC-STAGES", handler_id,
                    "generic handler lacks the exact claim/lock/validate/domain-CAS/closed-ack/outbox atomic sequence",
                    orderedDml=handler.get("orderedDml"), rollback=handler.get("rollback"),
                    emission=(handler.get("event") or {}).get("emission"),
                ))
            idempotency = handler.get("idempotency") or {}
            expected_idempotency = {
                "scope": "tenant+handler+eventId",
                "claimKey": "tenant+handler+eventId",
                "storedPayloadDigest": "handlerContext.payloadDigest",
                "sameDigest": "RETURN_SEALED_FIRST_RESULT_ZERO_WRITES",
                "differentDigest": "CONFLICT_ZERO_DOMAIN_ACK_OUTBOX_MUTATION",
                "claimOrder": "CLAIM_INBOX_BEFORE_DOMAIN_READ_OR_WRITE",
            }
            if idempotency != expected_idempotency:
                findings.append(finding(
                    "C-HANDLER-IDEMPOTENCY-CONFLICT", handler_id,
                    "claim identity must exclude digest, then compare the stored digest for replay/conflict",
                    expected=expected_idempotency,
                    actual=idempotency,
                ))
        elif structured != listening_transaction:
            findings.append(finding(
                "C-HANDLER-ATOMIC-STAGES", handler_id,
                "specialized handler lacks the exact structured atomic/replay/conflict/rollback contract",
                expected=listening_transaction, actual=structured,
            ))
        a_writes = handler_write_tables(handler)
        b_writes = handler_write_tables(physical)
        if a_writes != b_writes:
            findings.append(finding(
                "C-HANDLER-PHYSICAL-WRITE-DRIFT", handler_id,
                "canonical and physical handler domain write sets differ",
                canonical=sorted(a_writes), physical=sorted(b_writes),
            ))
        if physical.get("atomicStages") != ["INBOX_CLAIM", "DOMAIN_CAS", "CLOSED_ACK", "OUTBOX_APPEND"]:
            findings.append(finding("C-HANDLER-PHYSICAL-STAGES", handler_id, "physical handler stage order drift"))
        if physical.get("sameDigestReplay") != "RETURN_SEALED_FIRST_ACK_NO_DOMAIN_OR_OUTBOX_WRITE":
            findings.append(finding("C-HANDLER-PHYSICAL-REPLAY", handler_id, "physical same-digest replay drift"))
        if physical.get("differentDigestReplay") != "CONFLICT_NO_MUTATION":
            findings.append(finding("C-HANDLER-PHYSICAL-CONFLICT", handler_id, "physical conflict drift"))


def validate_tables(docs: dict[str, dict[str, Any]], findings: list[dict[str, Any]]) -> None:
    exact = docs["exact"]
    table_specs = {row["tableName"]: row for row in exact.get("tableSpecifications", [])}
    lifecycle_names = {
        "state", "status", "stage", "lifecycle_state", "handoff_state", "approval_state",
    }
    for table_name, table in table_specs.items():
        columns = table_expected_columns(exact, table)
        column_names = set(columns)
        lifecycle = sorted(column_names & lifecycle_names)
        if len(lifecycle) > 1:
            findings.append(finding(
                "C-SINGLE-LIFECYCLE-COLUMN", table_name,
                "aggregate has multiple business lifecycle columns", columns=lifecycle,
            ))
        checks_text = normalize_ws(" ".join(str(row.get("expression", "")) for row in table.get("checks", [])))
        for start, end in INTERVAL_PAIRS:
            if {start, end} <= column_names and not (start in checks_text and end in checks_text):
                findings.append(finding(
                    "C-INTERVAL-PAIR-CHECK", table_name,
                    "half-open interval pair lacks an end > start/null-open check",
                    start=start, end=end,
                ))
        for column in columns.values():
            name = str(column.get("name"))
            if str(column.get("sqlType", "")).upper().endswith("[]"):
                findings.append(finding(
                    "C-TYPED-ORDINAL-COLLECTION", f"{table_name}.{name}",
                    "array reference must be normalized into a typed ordinal child relation",
                ))
        fk_columns = {str(column) for row in table.get("foreignKeys", []) for column in row.get("columns", [])}
        exemptions = {"tenant_id", "public_id", "correlation_id", str(table.get("idColumn", {}).get("name"))}
        for column in columns.values():
            name = str(column.get("name"))
            # Correlation IDs are trace tokens, while approval/decision/
            # verification tenant IDs are an immutable copy of the already
            # typed row tenant used for exact proof matching.  Neither is a
            # foreign entity identity.  Their equality/trace semantics are
            # validated separately from local FK/opaque-owner identities.
            proof_tenant_copy = name.endswith("_tenant_id")
            if (
                REFERENCE_COLUMN.search(name)
                and name not in exemptions
                and not proof_tenant_copy
                and name not in fk_columns
                and not column.get("referenceContract")
            ):
                findings.append(finding(
                    "C-TYPED-IDENTITY-OR-FK", f"{table_name}.{name}",
                    "reference-like column has neither a local composite FK nor an exact typed owner reference",
                ))
        for unique in table.get("uniqueKeys", []):
            unique_columns = [str(x).lower() for x in unique.get("columns", [])]
            forbidden = [x for x in unique_columns if any(token in x for token in ("correlation", "sha256", "digest", "hash"))]
            exception = str(unique.get("exception", ""))
            if forbidden and exception not in {"PROTECTED_ONE_TIME_TOKEN_COMMITMENT", "IMMUTABLE_CONTENT_ADDRESS"}:
                findings.append(finding(
                    "C-CORRELATION-HASH-UNIQUE", f"{table_name}:{unique.get('constraintId')}",
                    "correlation/hash/digest must not be business identity", columns=forbidden,
                ))

    recurrence_checks = {
        "ppl_jny_assignments": {"occurrence_key", "assignment_revision"},
        "prf_lrn_assignments": {"occurrence_key", "assignment_revision"},
        "ppl_cwk_engagements": {
            "occurrence_key", "contract_public_id", "engagement_occurrence_no",
        },
        "ppl_cwk_sponsor_assignments": {"assignment_revision", "correction_ordinal"},
    }
    for table_name, alternatives in recurrence_checks.items():
        table = table_specs.get(table_name, {})
        columns = set(table_expected_columns(exact, table)) if table else set()
        if not (columns & alternatives):
            findings.append(finding(
                "C-RECURRENCE-IDENTITY", table_name,
                "recurring aggregate/history lacks an occurrence or correction identity",
                acceptable=sorted(alternatives),
            ))

    duplicate_pairs = {
        "tme_wfm_forecast_revision_counters": ({"current_revision", "last_revision"},),
        "tme_wfm_fairness_measure_values": (
            {"metric_code", "measure_key"}, {"measured_value", "measure_value"},
            {"threshold_value", "accepted_bound"}, {"outcome", "result"},
        ),
    }
    for table_name, groups in duplicate_pairs.items():
        table = table_specs.get(table_name, {})
        columns = set(table_expected_columns(exact, table)) if table else set()
        for group in groups:
            if group <= columns:
                findings.append(finding(
                    "C-DUPLICATE-PHYSICAL-SEMANTIC", table_name,
                    "two columns model the same semantic fact", columns=sorted(group),
                ))


def validate_ai_governance(docs: dict[str, dict[str, Any]], findings: list[dict[str, Any]]) -> None:
    """Fail closed on local aliases for centrally governed AI proof identities."""
    operations = {row["operationId"]: row for row in docs["ssot"].get("operations", [])}
    actual_ai_operations = {operation_id for operation_id in operations if operation_id.startswith("modern.ai.")}
    check_exact_set(
        findings, "C-AI-GOVERNANCE-OPERATION-SET", "ssot modern.ai operations",
        actual_ai_operations, AI_GOVERNANCE_OPERATION_IDS,
    )
    expected_proofs = dict(AI_GOVERNANCE_PROOF_TYPES)
    for operation_id in sorted(AI_GOVERNANCE_OPERATION_IDS):
        boundary = operations.get(operation_id, {}).get("aiGovernanceBoundary") or {}
        rows = boundary.get("requiredProofs", [])
        actual_proofs = {
            str(row.get("field")): str(row.get("entityType"))
            for row in rows if isinstance(row, dict)
        }
        if (
            len(rows) != len(expected_proofs)
            or len(actual_proofs) != len(expected_proofs)
            or actual_proofs != expected_proofs
        ):
            findings.append(finding(
                "C-AI-GOVERNANCE-PROOF-TYPES", operation_id,
                "AI operation lacks the exact sixteen centrally owned typed proof revisions",
                missing=sorted(set(expected_proofs) - set(actual_proofs)),
                extra=sorted(set(actual_proofs) - set(expected_proofs)),
                changed=sorted(
                    key for key in set(expected_proofs) & set(actual_proofs)
                    if expected_proofs[key] != actual_proofs[key]
                ),
                rowCount=len(rows),
            ))
        if (
            boundary.get("owner") != "DWP-COMMON-AI-GOVERNANCE"
            or boundary.get("useCase") != "EMPLOYMENT_HRIS"
            or boundary.get("riskClassification") != "OWNER_CLASSIFIED_FAIL_CLOSED"
            or boundary.get("activationGate")
            != "G6_FAIL_CLOSED_WHEN_ANY_PROOF_MISSING_STALE_RETIRED_OR_CROSS_TENANT"
        ):
            findings.append(finding(
                "C-AI-GOVERNANCE-FAIL-CLOSED-BOUNDARY", operation_id,
                "central owner/use-case/risk/activation boundary drift",
            ))
        activation = boundary.get("activationReceipt") or {}
        if not (
            activation.get("field") == "governanceActivationReceiptId"
            and activation.get("entityType") == "DWP.AIGovernance.ActivationReceipt"
            and "all artifact revisions" in str(activation.get("exactMatch", ""))
        ):
            findings.append(finding(
                "C-AI-GOVERNANCE-ACTIVATION-RECEIPT", operation_id,
                "exact central activation receipt contract is absent or locally aliased",
                actual=activation,
            ))
        disclosure = boundary.get("affectedPersonDisclosureEvidence") or {}
        if disclosure != {
            "field": "affectedPersonDisclosureEvidenceId",
            "entityType": "DWP.AIGovernance.AffectedPersonDisclosureEvidence",
            "requiredBeforeEmploymentAssistanceExposure": True,
        }:
            findings.append(finding(
                "C-AI-GOVERNANCE-DISCLOSURE-EVIDENCE", operation_id,
                "affected-person disclosure evidence is not exact and fail closed",
                actual=disclosure,
            ))

    for operation_id in ("modern.ai.policy.create", "modern.ai.policy.revise"):
        request_fields = {
            str(row.get("source")): row
            for row in operations.get(operation_id, {}).get("requestFields", [])
            if isinstance(row, dict)
        }
        for field_name, entity_type in expected_proofs.items():
            source = f"body.{field_name}"
            row = request_fields.get(source, {})
            reference = row.get("referenceContract") or {}
            if not (
                row.get("type") == "UUID"
                and row.get("required") is True
                and reference == {"entityType": entity_type, "idSpace": "PUBLIC_UUID"}
            ):
                findings.append(finding(
                    "C-AI-POLICY-REQUEST-TYPED-PROOF", f"{operation_id}:{source}",
                    "policy mutation request lacks an exact required central-governance UUID proof",
                    expectedEntityType=entity_type, actual=row,
                ))

    table_specs = {
        row["tableName"]: row for row in docs["exact"].get("tableSpecifications", [])
    }
    for table_name, expected_columns in AI_TYPED_CENTRAL_TABLE_REFERENCES.items():
        table = table_specs.get(table_name, {})
        columns = table_expected_columns(docs["exact"], table) if table else {}
        for column_name, entity_type in expected_columns.items():
            column = columns.get(column_name, {})
            reference = column.get("referenceContract") or {}
            if not (
                column.get("sqlType") == "UUID"
                and reference == {"entityType": entity_type, "idSpace": "PUBLIC_UUID"}
            ):
                findings.append(finding(
                    "C-AI-PHYSICAL-TYPED-CENTRAL-REFERENCE", f"{table_name}.{column_name}",
                    "canonical physical column is not the exact central-governance UUID identity",
                    expectedEntityType=entity_type, actual=column,
                ))


def validate_publication(docs: dict[str, dict[str, Any]], findings: list[dict[str, Any]]) -> None:
    operations = {row["operationId"]: row for row in docs["ssot"].get("operations", [])}
    table_specs = {row["tableName"]: row for row in docs["exact"].get("tableSpecifications", [])}
    if set(PUBLISH_PROOF_TABLES) != set(PUBLISH_OPERATIONS):
        findings.append(finding(
            "C-PUBLICATION-REVIEWER-ORACLE", "reviewer frozen constants",
            "publication operation-to-proof-table oracle is not exact thirteen",
        ))
    for operation_id in sorted(PUBLISH_OPERATIONS):
        operation = operations.get(operation_id, {})
        proof_table = PUBLISH_PROOF_TABLES.get(operation_id)
        required_columns = set(PUBLISH_APPROVAL_PROOF_COLUMNS)
        exact_table = table_specs.get(proof_table, {})
        exact_columns = set(table_expected_columns(docs["exact"], exact_table)) if exact_table else set()
        if not proof_table or not required_columns <= exact_columns:
            findings.append(finding(
                "C-CANONICAL-PUBLICATION-PROOF-SCHEMA", operation_id,
                "frozen publication proof table/columns are absent from canonical exact schema",
                proofTable=proof_table, missingColumns=sorted(required_columns - exact_columns),
            ))
        proof_steps = [
            row
            for row in operation.get("orderedDml", [])
            if row.get("table") == proof_table
            and "IMMUTABLE_PUBLISH_APPROVAL_PROOF" in str(row.get("role", ""))
        ]
        complete_steps = [
            row for row in proof_steps
            if required_columns <= set((row.get("assignments") or {}))
            and row.get("phase") == "IN_TRANSACTION"
            and row.get("action") in {"APPEND", "INSERT", "UPDATE", "UPDATE_CAS"}
        ]
        if not complete_steps:
            findings.append(finding(
                "C-CANONICAL-PUBLICATION-PROOF-DML", operation_id,
                "publish command lacks one same-transaction immutable approval-proof write",
                proofTable=proof_table, requiredAssignments=sorted(required_columns),
                observed=[{
                    "action": row.get("action"), "role": row.get("role"),
                    "phase": row.get("phase"),
                    "assignments": sorted((row.get("assignments") or {}).keys()),
                } for row in proof_steps],
            ))
        else:
            contract = complete_steps[0].get("approvalProofContract") or {}
            if not (
                contract.get("kind") == "TYPED_IMMUTABLE_APPROVAL_DECISION_PROOF"
                and set(contract.get("requiredColumns", [])) == required_columns
                and contract.get("restartReplay")
                == "RECONSTRUCT_WITHOUT_COMMAND_RECEIPT_OR_OWNER_REFETCH"
            ):
                findings.append(finding(
                    "C-CANONICAL-PUBLICATION-PROOF-CONTRACT", operation_id,
                    "publication write lacks its closed typed immutable/restart proof contract",
                    actual=contract,
                ))

    ledger_event_field_columns = {
        "approvalReceiptId": "approval_receipt_public_id",
        "approvalReceiptRevision": "approval_receipt_revision",
        "approvalOutcome": "approval_outcome",
        "approvalAction": "approval_action",
        "approvalInputDigest": "approval_input_digest",
        "approvalPurposeCode": "approval_purpose_code",
        "approvalTenantId": "approval_tenant_id",
        "publishedParentId": "parent_public_id",
        "publishedParentVersion": "parent_version",
        "publicationProofDigest": "payload_digest",
    }
    for operation_id, (table_name, event_name) in IMMUTABLE_PUBLICATION_LEDGER_EVENTS.items():
        events = {
            str(row.get("eventName")): row
            for row in operations.get(operation_id, {}).get("events", [])
        }
        event = events.get(event_name, {})
        fields = {
            str(row.get("name")): row for row in event.get("fields", [])
            if isinstance(row, dict)
        }
        bad_fields = []
        for field_name, column_name in ledger_event_field_columns.items():
            row = fields.get(field_name, {})
            if not (
                row.get("required") is True
                and row.get("sourceKind") == "IMMUTABLE_OWNER_PROOF"
                and row.get("source") == f"{table_name}.{column_name}"
            ):
                bad_fields.append(field_name)
        if bad_fields:
            findings.append(finding(
                "C-PUBLICATION-LEDGER-EVENT-PROOF", f"{operation_id}:{event_name}",
                "mutable-root publication event lacks its exact ten-field immutable ledger proof",
                table=table_name, missingOrChanged=sorted(bad_fields),
            ))

    # The independently checked canonical proof above must also be reproduced
    # by the separately authored physical contract.  Keep physical drift under
    # its own code so an unavailable/stale B candidate cannot masquerade as an
    # A canonical failure.
    physical = docs["physicalQueries"].get("hardeningPlans", {}).get("directPublicationProof", {})
    physical_rows_list = physical.get("contracts", [])
    physical_rows = {
        row.get("operationId"): row for row in physical_rows_list if isinstance(row, dict)
    }
    check_exact_set(
        findings, "C-PHYSICAL-PUBLICATION-OPERATION-SET", "physical.directPublicationProof",
        physical_rows, PUBLISH_OPERATIONS,
    )
    for operation_id in sorted(PUBLISH_OPERATIONS & set(physical_rows)):
        row = physical_rows[operation_id]
        if (
            row.get("proofTableId") != PUBLISH_PROOF_TABLES[operation_id]
            or set(row.get("proofColumns", [])) != set(PUBLISH_APPROVAL_PROOF_COLUMNS)
            or row.get("immutability") != "APPEND_ONLY_LEDGER_OR_WRITE_ONCE_TRIGGER"
            or row.get("ownerRefetch") != "TYPED_PURPOSE_VERSION_AS_OF_RECEIPT_REQUIRED"
        ):
            findings.append(finding(
                "C-PHYSICAL-PUBLICATION-PROOF-DRIFT", operation_id,
                "physical proof contract differs from the frozen canonical publication proof",
                expectedTable=PUBLISH_PROOF_TABLES[operation_id],
                expectedColumns=sorted(PUBLISH_APPROVAL_PROOF_COLUMNS), actual=row,
            ))


def validate_reentry(docs: dict[str, dict[str, Any]], findings: list[dict[str, Any]]) -> None:
    physical = docs["physicalQueries"]
    excluded = physical.get("excludedPrivateInternalProjections", [])
    check_exact_set(
        findings, "C-PRIVATE-PROJECTION-SET", "physical.excludedPrivateInternalProjections",
        list_ids(excluded, "projectionId"), PRIVATE_INTERNAL_PROJECTIONS,
    )
    projections = physical.get("reentryProjections", [])
    if len(projections) != 44 or len(set(list_ids(projections, "projectionId"))) != 44:
        findings.append(finding(
            "C-REENTRY-PROJECTION-COUNT", "physical.reentryProjections",
            "expected exact 44 public authorized re-entry projections",
            count=len(projections), unique=len(set(list_ids(projections, "projectionId"))),
        ))
    manifest_queries = {
        row.get("operationId") for row in docs["manifest"].get("operations", []) if row.get("mode") == "QUERY"
    }
    mapped_queries: set[str] = set()
    for projection in projections:
        operation_ids = set(projection.get("queryOperationIds", []))
        if not operation_ids:
            findings.append(finding(
                "C-REENTRY-PROJECTION-NO-QUERY", str(projection.get("projectionId")),
                "public re-entry projection has no explicit authorized query",
            ))
        mapped_queries.update(operation_ids)
        for key in (
            "readTables", "rootTable", "tenantFilter", "purposeFilter", "versionSelector",
            "asOfSelector", "pagination", "mutationPolicy", "privacy", "reentryGuarantee",
        ):
            if not projection.get(key):
                findings.append(finding(
                    "C-REENTRY-PROJECTION-SHAPE", str(projection.get("projectionId")),
                    f"projection member missing: {key}",
                ))
    if mapped_queries != manifest_queries:
        findings.append(finding(
            "C-QUERY-REENTRY-CLOSURE", "physical.reentryProjections",
            "66-query set is not exactly covered by the 44 re-entry projections",
            missing=sorted(manifest_queries - mapped_queries), extra=sorted(mapped_queries - manifest_queries),
        ))


def validate_physical_schema(docs: dict[str, dict[str, Any]], findings: list[dict[str, Any]], sql_texts: dict[str, str]) -> None:
    exact = docs["exact"]
    exact_tables = {row["tableName"]: row for row in exact.get("tableSpecifications", [])}
    physical = docs["physicalQueries"]
    physical_tables = {row["tableId"]: row for row in physical.get("tablePhysicalContracts", [])}
    check_exact_set(
        findings, "C-PHYSICAL-TABLE-CLOSURE", "physical.tablePhysicalContracts",
        physical_tables, set(exact_tables),
    )
    parsed_by_table: dict[str, dict[str, Any]] = {}
    table_session: dict[str, str] = {}
    for session, text in sql_texts.items():
        parsed = parse_create_tables(text)
        for table_name, row in parsed.items():
            if table_name in parsed_by_table:
                findings.append(finding("C-SQL-DUPLICATE-TABLE", table_name, "table occurs in more than one owner SQL"))
            parsed_by_table[table_name] = row
            table_session[table_name] = session

        if re.search(r"\bCREATE\s+(?:TABLE|INDEX|POLICY|TRIGGER|FUNCTION|SCHEMA)\s+IF\s+NOT\s+EXISTS\b", text, re.I):
            findings.append(finding("C-SQL-STRICT-COLLISION", session, "IF NOT EXISTS masks an allocation collision"))
        if re.search(r"\bCREATE\s+OR\s+REPLACE\s+(?:FUNCTION|VIEW|PROCEDURE)\b", text, re.I):
            findings.append(finding("C-SQL-STRICT-COLLISION", session, "CREATE OR REPLACE masks an allocation collision"))
        if re.search(r"\bDROP\s+(?:TABLE|SCHEMA|FUNCTION|VIEW|POLICY|TRIGGER)\b", text, re.I):
            findings.append(finding("C-SQL-DESTRUCTIVE", session, "forward design contains DROP"))
        if re.search(r"\bGRANT\s+[^;]*\bDELETE\b", text, re.I | re.S):
            findings.append(finding("C-SQL-DELETE-GRANT", session, "DELETE is granted to an application role"))
        if re.search(r"\bGRANT\s+[^;]*\bON\s+ALL\s+TABLES\b", text, re.I | re.S):
            findings.append(finding("C-SQL-BLANKET-GRANT", session, "blanket ALL TABLES grant is forbidden"))
        if re.search(r"\bALTER\s+DEFAULT\s+PRIVILEGES\b[^;]*\bGRANT\b", text, re.I | re.S):
            findings.append(finding("C-SQL-DEFAULT-GRANT", session, "future/default privilege grant is forbidden"))
        if not re.search(r"\bSET\s+LOCAL\s+ROLE\s+dwp_hris_[a-z0-9_]+_owner\b", text, re.I):
            findings.append(finding(
                "C-SQL-NOINHERIT-SET-ROLE", session,
                "migration does not SET LOCAL ROLE to the exact owner under NOINHERIT membership",
            ))
        if not re.search(r"pg_has_role\s*\(\s*session_user\s*,[^,]+,\s*'MEMBER'\s*\)", text, re.I):
            findings.append(finding(
                "C-SQL-MIGRATOR-MEMBERSHIP", session,
                "migration does not fail closed on exact migrator-to-owner membership",
            ))
        if not all(token in text.lower() for token in ("rolsuper", "rolinherit", "rolbypassrls")):
            findings.append(finding("C-SQL-ROLE-ATTRIBUTES", session, "role attribute preflight incomplete"))

    check_exact_set(findings, "C-SQL-TABLE-CLOSURE", "four physical SQL files", parsed_by_table, set(exact_tables))

    for table_name, exact_table in exact_tables.items():
        expected_columns = table_expected_columns(exact, exact_table)
        physical_row = physical_tables.get(table_name, {})
        physical_columns = set(physical_row.get("columns", []))
        if physical_columns != set(expected_columns):
            findings.append(finding(
                "C-PHYSICAL-CANONICAL-COLUMN-DRIFT", table_name,
                "physical JSON column set differs from canonical exact schema",
                missing=sorted(set(expected_columns) - physical_columns),
                extra=sorted(physical_columns - set(expected_columns)),
            ))
        parsed = parsed_by_table.get(table_name, {})
        sql_columns = set((parsed.get("columns") or {}).keys())
        if sql_columns != set(expected_columns):
            findings.append(finding(
                "C-SQL-CANONICAL-COLUMN-DRIFT", table_name,
                "physical SQL column set differs from canonical exact schema",
                missing=sorted(set(expected_columns) - sql_columns),
                extra=sorted(sql_columns - set(expected_columns)),
            ))
        ai_central_columns = set(AI_TYPED_CENTRAL_TABLE_REFERENCES.get(table_name, {}))
        if ai_central_columns:
            declared_typed = set(physical_row.get("typedCrossOwnerReferenceColumns", []))
            if not ai_central_columns <= declared_typed:
                findings.append(finding(
                    "C-AI-PHYSICAL-CONTRACT-TYPED-CENTRAL-REFERENCE", table_name,
                    "physical table contract omits centrally governed AI reference columns",
                    missing=sorted(ai_central_columns - declared_typed),
                    declared=sorted(declared_typed),
                ))
            non_uuid_sql = sorted(
                column_name for column_name in ai_central_columns
                if column_name in sql_columns
                and not re.match(
                    r"^uuid(?:\s|$)",
                    normalize_ws(str((parsed.get("columns") or {}).get(column_name, ""))),
                )
            )
            if non_uuid_sql:
                findings.append(finding(
                    "C-AI-SQL-TYPED-CENTRAL-REFERENCE", table_name,
                    "central-governance references are not materialized as UUID columns",
                    columns=non_uuid_sql,
                ))
        expected_schema = physical_row.get("ownerSchema")
        if parsed and parsed.get("schema") != expected_schema:
            findings.append(finding(
                "C-SQL-OWNER-SCHEMA", table_name, "SQL schema differs from physical owner schema",
                expected=expected_schema, actual=parsed.get("schema"),
            ))
        if parsed:
            block = str(parsed.get("block", ""))
            full_sql = sql_texts.get(table_session.get(table_name, ""), "")
            qualified = f"{parsed.get('schema')}.{table_name}"
            for marker, code in (
                (f"ALTER TABLE {qualified} ENABLE ROW LEVEL SECURITY", "C-SQL-RLS-ENABLE"),
                (f"ALTER TABLE {qualified} FORCE ROW LEVEL SECURITY", "C-SQL-RLS-FORCE"),
                (f"CREATE POLICY tenant_isolation ON {qualified}", "C-SQL-RLS-POLICY"),
            ):
                if normalize_ws(marker) not in normalize_ws(full_sql):
                    findings.append(finding(code, table_name, f"missing {marker}"))
            if parsed.get("duplicate"):
                findings.append(finding("C-SQL-DUPLICATE-CREATE", table_name, "duplicate strict CREATE TABLE"))

    # Candidate JSON must map operations and handler writes byte-independently.
    ssot_ops = {row["operationId"]: row for row in docs["ssot"].get("operations", [])}
    physical_ops = {row["operationId"]: row for row in physical.get("operationPhysicalContracts", [])}
    table_ids = set(exact_tables)
    for operation_id, operation in ssot_ops.items():
        candidate = physical_ops.get(operation_id, {})
        canonical_writes = operation_write_tables(operation, table_ids)
        if canonical_writes != set(candidate.get("writeTables", [])):
            findings.append(finding(
                "C-OPERATION-PHYSICAL-WRITE-DRIFT", operation_id,
                "canonical and physical operation write sets differ",
                canonical=sorted(canonical_writes), physical=sorted(candidate.get("writeTables", [])),
            ))
        canonical_events = {row.get("eventName") for row in operation.get("events", [])}
        if canonical_events != set(candidate.get("publicEventIds", [])):
            findings.append(finding(
                "C-OPERATION-PHYSICAL-EVENT-DRIFT", operation_id,
                "canonical and physical operation event sets differ",
                canonical=sorted(canonical_events), physical=sorted(candidate.get("publicEventIds", [])),
            ))

    sql_joined = "\n".join(sql_texts.values())
    if re.search(r"\bGRANT\s+EXECUTE\s+ON\s+(?:FUNCTION|PROCEDURE)\s+[^;]+\bTO\s+[^;]*(?:runtime|reader|handler|PUBLIC)", sql_joined, re.I | re.S):
        findings.append(finding(
            "C-TRIGGER-FUNCTION-EXECUTE-BOUNDARY", "four physical SQL files",
            "PUBLIC/runtime/reader/handler has direct trigger/procedure execution",
        ))


def validate_oracle_pins(oracle: dict[str, Any] | None, findings: list[dict[str, Any]]) -> None:
    if oracle is None:
        findings.append(finding(
            "C-FROZEN-ORACLE-MISSING", str(ORACLE_PATH),
            "reviewer-owned frozen oracle has not been sealed",
        ))
        return
    if oracle.get("status") != "FROZEN_REVIEWED_SUCCESSOR_ORACLE":
        findings.append(finding("C-FROZEN-ORACLE-STATUS", str(ORACLE_PATH), "oracle status drift"))
    for name, expected_hash in oracle.get("candidateFileSha256", {}).items():
        path = PATHS.get(name)
        if path is None or not path.exists() or file_sha256(path) != expected_hash:
            findings.append(finding(
                "C-FROZEN-CANDIDATE-PIN", name, "candidate file bytes differ from frozen review",
                expected=expected_hash, actual=file_sha256(path) if path and path.exists() else None,
            ))
    for session, expected_hash in oracle.get("sqlFileSha256", {}).items():
        path = SQL_PATHS.get(session)
        if path is None or not path.exists() or file_sha256(path) != expected_hash:
            findings.append(finding(
                "C-FROZEN-SQL-PIN", session, "SQL bytes differ from frozen review",
                expected=expected_hash, actual=file_sha256(path) if path and path.exists() else None,
            ))


def validate_loaded_candidate(
    docs: dict[str, dict[str, Any]], sql_texts: dict[str, str],
    oracle: dict[str, Any] | None, scope_oracle: dict[str, Any] | None,
    *, require_candidate_oracle: bool,
) -> list[dict[str, Any]]:
    """Evaluate already parsed hostile inputs without touching candidate files."""
    findings: list[dict[str, Any]] = []
    validate_inventory(docs, findings, oracle)
    validate_table_scope_change(docs, scope_oracle, findings)
    validate_canonical_closure(docs, findings)
    validate_queries(docs, findings)
    validate_commands_and_lineage(docs, findings)
    validate_business_provenance(docs, findings)
    validate_producers_handlers(docs, findings)
    validate_tables(docs, findings)
    validate_ai_governance(docs, findings)
    validate_publication(docs, findings)
    validate_reentry(docs, findings)
    validate_physical_schema(docs, findings, sql_texts)
    # Reviewer-owned business semantics are evaluated from the already parsed
    # hostile candidate.  No author generator/validator constants are imported.
    semantic_result = operation_semantics.audit(docs["ssot"], docs["exact"])
    for row in semantic_result["findings"]:
        subject = row.get("subject", {})
        subject_text = "|".join(
            str(subject[key]) for key in (
                "operationId", "handlerId", "eventName", "table", "field",
            ) if key in subject
        ) or row["findingId"]
        findings.append(finding(
            f"C-SEMANTIC-{row['code']}", subject_text,
            "independent operation/business semantic invariant failed",
            semanticFindingId=row["findingId"], severity=row["severity"],
            exactSubject=subject, semanticEvidence=row.get("evidence", {}),
            falsePositiveGuard=row["falsePositiveGuard"],
            expectedCorrectionClass=row["expectedCorrectionClass"],
        ))
    if require_candidate_oracle:
        validate_oracle_pins(oracle, findings)
    return findings


def run_validation(allow_unfrozen: bool = False) -> dict[str, Any]:
    findings: list[dict[str, Any]] = []
    docs: dict[str, dict[str, Any]] = {}
    for name, path in PATHS.items():
        try:
            docs[name] = load_strict_json(path, require_seal=(name == "manifest"))
        except Exception as exc:
            findings.append(finding("C-STRICT-JSON", str(path), str(exc)))
            docs[name] = {}
    sql_texts: dict[str, str] = {}
    for session, path in SQL_PATHS.items():
        try:
            sql_texts[session] = path.read_text(encoding="utf-8")
        except Exception as exc:
            findings.append(finding("C-SQL-READ", str(path), str(exc)))
            sql_texts[session] = ""
    oracle: dict[str, Any] | None = None
    try:
        if ORACLE_PATH.exists():
            oracle = load_strict_json(ORACLE_PATH, require_seal=True)
    except Exception as exc:
        findings.append(finding("C-FROZEN-ORACLE-STRICT-JSON", str(ORACLE_PATH), str(exc)))
    scope_oracle: dict[str, Any] | None = None
    try:
        scope_oracle = load_strict_json(TABLE_SCOPE_ORACLE_PATH, require_seal=True)
    except Exception as exc:
        findings.append(finding(
            "C-TABLE-SCOPE-ORACLE-STRICT-JSON", str(TABLE_SCOPE_ORACLE_PATH), str(exc),
        ))

    findings.extend(validate_loaded_candidate(
        docs, sql_texts, oracle, scope_oracle,
        require_candidate_oracle=not allow_unfrozen,
    ))

    counts = Counter(row["code"] for row in findings)
    candidate_hashes = {
        name: file_sha256(path) for name, path in PATHS.items() if path.exists()
    }
    sql_hashes = {
        session: file_sha256(path) for session, path in SQL_PATHS.items() if path.exists()
    }
    return {
        "reportId": "dwp.hris.modern-independent-successor.static-validation.v1",
        "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
        "status": "PASS" if not findings else "FAIL",
        "oracleMode": "FROZEN" if oracle else "UNFROZEN_DEVELOPMENT_AUDIT",
        "candidateFileSha256": candidate_hashes,
        "sqlFileSha256": sql_hashes,
        "counts": {"findings": len(findings), "byCode": dict(sorted(counts.items()))},
        "findings": findings,
    }


def self_test() -> dict[str, Any]:
    cases: list[tuple[str, bool]] = []

    sample = {"a": 1, "sealedPayloadSha256": "bad"}
    cases.append(("semantic-seal-mutation", sha256(canonical_bytes({"a": 1})) != sample["sealedPayloadSha256"]))
    cases.append(("historical-create-exact-27", len(HISTORICAL_CREATE_NONE) == 27))
    cases.append(("successor-create-exact-5", len(SUCCESSOR_CREATE_NONE) == 5))
    cases.append(("approved-table-scope-delta-exact-9", len(APPROVED_TABLE_SCOPE_DELTA) == 9))
    cases.append(("publication-exact-13", len(PUBLISH_OPERATIONS) == 13))
    cases.append(("provenance-review-exact-13-plus-async", len(PROVENANCE_REPLACEMENT_OPERATIONS) == 13))
    cases.append(("business-provenance-positive-exact-16", len(BUSINESS_PROVENANCE_CONTRACTS) == 16))
    cases.append(("async-provenance-exact-2", len(ASYNC_PROVENANCE_CONTRACTS) == 2))
    cases.append(("ai-governance-operation-exact-17", len(AI_GOVERNANCE_OPERATION_IDS) == 17))
    cases.append(("ai-governance-proof-type-exact-16", len(AI_GOVERNANCE_PROOF_TYPES) == 16))
    cases.append(("ai-governance-policy-column-exact-16", len(AI_GOVERNANCE_POLICY_COLUMNS) == 16))
    cases.append(("writer-zero-exact-5", len(WRITER_ZERO_PRODUCERS) == 5))
    cases.append(("update-only-exact-3", len(UPDATE_ONLY_PRODUCERS) == 3))
    cases.append(("private-leaf-exact-2", len(PRIVATE_INTERNAL_PROJECTIONS) == 2))
    cases.append(("transient-response-detected", bool(TRANSIENT_SOURCE.match("headers.X-Correlation-ID"))))
    cases.append(("durable-response-accepted", not bool(TRANSIENT_SOURCE.match("ppl_command_receipts.correlation_id"))))
    cases.append(("reference-column-detected", bool(REFERENCE_COLUMN.search("approval_receipt_id"))))
    cases.append(("strict-create-parse", "sys_x" in parse_create_tables("CREATE TABLE s.sys_x (tenant_id BIGINT);")))
    cases.append(("if-not-exists-rejected-by-parser", "sys_x" not in parse_create_tables("CREATE TABLE IF NOT EXISTS s.sys_x (tenant_id BIGINT);")))
    cases.append(("duplicate-json-rejected", False))
    try:
        json.loads('{"x":1,"x":2}', object_pairs_hook=reject_duplicate_pairs)
    except StrictJsonError:
        cases[-1] = ("duplicate-json-rejected", True)

    semantic_mutation: dict[str, Any]
    try:
        semantic_mutation = operation_semantics.run_selftests(
            load_strict_json(PATHS["ssot"]), load_strict_json(PATHS["exact"]),
        )
        cases.append((
            "operation-semantics-mutation-selftest",
            semantic_mutation.get("status") == "PASS"
            and semantic_mutation.get("testsRun")
            == semantic_mutation.get("testsPassed") == 78,
        ))
    except Exception as exc:
        semantic_mutation = {"status": "FAIL", "error": repr(exc)}
        cases.append(("operation-semantics-mutation-selftest", False))

    failed = [name for name, passed in cases if not passed]
    return {
        "reportId": "dwp.hris.modern-independent-successor.self-test.v1",
        "status": "PASS" if not failed else "FAIL",
        "cases": len(cases),
        "passed": len(cases) - len(failed),
        "failed": failed,
        "operationSemanticsMutationSelftest": semantic_mutation,
    }


def write_json(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(canonical_bytes(value) + b"\n")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--allow-unfrozen", action="store_true", help="development audit; never returns gate PASS")
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--write-report", nargs="?", const=str(DEFAULT_REPORT))
    parser.add_argument("--compact", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        report = self_test()
    else:
        report = run_validation(allow_unfrozen=args.allow_unfrozen)
    if args.write_report:
        write_json(Path(args.write_report), report)
    if args.compact:
        print(json.dumps(report, ensure_ascii=False, separators=(",", ":")))
    else:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["status"] == "PASS" else 1


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
