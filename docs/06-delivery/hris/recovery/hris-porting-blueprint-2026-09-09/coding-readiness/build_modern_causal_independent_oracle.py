#!/usr/bin/env python3
"""Build the reviewer-owned modern causal oracle and PostgreSQL fixture inventory.

This builder is intentionally independent from modern_causal_successor.py and
generate_modern_causal_successor.py.  It reads the reviewed transport, lineage,
identity, module and remediation documents as evidence, then applies the
explicit decisions in this file.  Candidate code must never import or rewrite
the resulting oracle.
"""

from __future__ import annotations

import argparse
import copy
import csv
import datetime as dt
import hashlib
import json
import re
from pathlib import Path
from typing import Any

from modern_causal_successor_profile import (
    LEGACY_PROFILE,
    SUCCESSOR_PROFILE,
    SUCCESSOR_CANONICAL_COUNTS,
    SUCCESSOR_OWNER_DEPENDENCY_PINS,
    SUCCESSOR_CLOSED_SET_MANIFEST_PIN,
    SUCCESSOR_ARTIFACTS,
    SUCCESSOR_IDS,
    SUCCESSOR_ACCEPTED_LIVE_MANIFEST,
    SUCCESSOR_INDEPENDENT_ACCEPTANCE,
    SUCCESSOR_POLICY,
    SuccessorProfileError,
    create_only_json,
    hostile_self_test as successor_profile_hostile_self_test,
    pending_successor_inputs,
    profile_metadata,
    require_profile,
    successor_paths,
    successor_owner_dependency_receipt,
    verify_successor_owner_dependencies,
    verify_successor_owner_dependency_receipt,
    verify_successor_closed_set_manifest_reference,
    successor_stage_state,
    successor_target_failures,
    verify_predecessor_pins,
)


BASE = Path(__file__).resolve().parent
ROOT = BASE.parent
ORACLE_PATH = BASE / "modern-causal-independent-oracle.v1.json"
FIXTURE_PATH = BASE / "modern-causal-independent-pg-fixtures.v1.json"
REVIEW_INVENTORY_PATH = BASE / "modern-causal-independent-review-inventory.v1.json"
REVIEW_FINALIZATION_PATH = BASE / "modern-causal-independent-reviewed-finalization.v1.json"
ACTIVE_PROFILE = LEGACY_PROFILE
ACTIVE_PROFILE_METADATA = profile_metadata(ACTIVE_PROFILE, BASE, ROOT)


def configure_profile(name: str) -> dict[str, Any]:
    """Select the historical chain or the pending collision-free successor chain."""
    global ACTIVE_PROFILE, ACTIVE_PROFILE_METADATA
    global ORACLE_PATH, FIXTURE_PATH, REVIEW_INVENTORY_PATH, REVIEW_FINALIZATION_PATH
    name = require_profile(name)
    ACTIVE_PROFILE = name
    if name == SUCCESSOR_PROFILE:
        paths = successor_paths(BASE, ROOT)
        ORACLE_PATH = paths["oracle"]
        FIXTURE_PATH = paths["fixture"]
        REVIEW_INVENTORY_PATH = paths["reviewInventory"]
        REVIEW_FINALIZATION_PATH = paths["reviewFinalization"]
    else:
        ORACLE_PATH = BASE / "modern-causal-independent-oracle.v1.json"
        FIXTURE_PATH = BASE / "modern-causal-independent-pg-fixtures.v1.json"
        REVIEW_INVENTORY_PATH = BASE / "modern-causal-independent-review-inventory.v1.json"
        REVIEW_FINALIZATION_PATH = BASE / "modern-causal-independent-reviewed-finalization.v1.json"
    ACTIVE_PROFILE_METADATA = profile_metadata(ACTIVE_PROFILE, BASE, ROOT)
    # These dictionaries are consumed by the historical ceremony as well as
    # the new profile.  Paths may change, but the predecessor bytes/seals are
    # never relaxed or re-derived from candidate material.
    REVIEWED_INTERMEDIATE_INPUT["path"] = REVIEW_INVENTORY_PATH.name
    REVIEWED_FINALIZATION["path"] = REVIEW_FINALIZATION_PATH.name
    return ACTIVE_PROFILE_METADATA


def successor_preflight() -> dict[str, Any]:
    """Describe why successor generation is pending without writing artifacts."""
    paths = successor_paths(BASE, ROOT)
    stage_state = successor_stage_state(BASE, ROOT)
    missing = pending_successor_inputs(BASE, ROOT, stage="review-input")
    predecessor_failures = verify_predecessor_pins(ROOT)
    return {
        "profile": ACTIVE_PROFILE,
        "status": "PENDING_ACCEPTED_CANONICAL_TRANSITION" if missing else "READY",
        "activeGateChain": ACTIVE_PROFILE_METADATA["activeGateChain"],
        "canonicalCounts": ACTIVE_PROFILE_METADATA["canonicalCounts"],
        "policy": ACTIVE_PROFILE_METADATA["policy"],
        "successorArtifacts": {key: str(value.relative_to(ROOT)) for key, value in paths.items()},
        "missingSuccessorInputs": missing,
        "stageState": stage_state,
        "acceptedLivePreflight": (
            __import__("modern_causal_successor_profile", fromlist=["accepted_live_preflight"])
            .accepted_live_preflight(BASE, ROOT)
        ),
        "predecessorPinFailures": predecessor_failures,
        "successorTargetFailures": successor_target_failures(BASE, ROOT),
        "predecessorDisposition": ACTIVE_PROFILE_METADATA.get("predecessorDisposition"),
    }


# This is the sealed independent intermediate inventory captured before the
# final reviewer corrections.  It is intentionally distinct from the older
# historical c179/737/dfc/546 provenance pins below.  The finalizer is allowed
# to read this exact byte sequence and the explicit reviewer decisions in this
# file; it must never read a later candidate as expected semantic authority.
REVIEWED_INTERMEDIATE_INPUT = {
    "path": REVIEW_INVENTORY_PATH.name,
    "fileSha256": "496f0f42db3106331f5631bc2094a8d25759328a4bc5f83f296df382e923b84f",
    "sealedPayloadSha256": "6ce5b973cdfd5d249d2831c46bac80632602590061b776335efae01fddda3b21",
    "capturedAt": "2026-09-15T05:26:38+09:00",
    "authority": "REVIEWED_INTERMEDIATE_INPUT; EXPLICIT_REVIEWER_CORRECTIONS_REQUIRED",
}

REVIEWED_FINALIZATION = {
    "path": REVIEW_FINALIZATION_PATH.name,
    "fileSha256": "345cbb222998856b8ea97efaf4cead89530bb51916b268c68c1532e5261c6992",
    "sealedPayloadSha256": "a0843ff8c79632f2c96a124995e38f3e4ca9cae4b5e99b27b92ada04b36e6619",
}

# Third and final reviewer ceremony.  The predecessor is the already sealed
# referent-corrected overlay.  The ceremony below applies only explicit review
# decisions recorded in this file: it never imports or opens the candidate
# generator, SSOT, exact/event output, or candidate validator.
AUTHORIZED_FINAL_FROZEN_REVIEW_PREDECESSOR = {
    "fileSha256": "f0481bfe146d20cedd2a88242c6fa94f1d1d7dd3395915e1d18902a2ee1e85d0",
    "sealedPayloadSha256": "507a5c42ecc93e155a1d326584013277826b21dfd881ac1522e68246610d8441",
}

# Frozen candidate bytes are review subjects, never expected-value authority.
# They are recorded so a later audit can prove which immutable snapshot the
# explicit decisions below were made against.
FINAL_FROZEN_REVIEW_SUBJECT_PINS = {
    "operationSsot": "b852bc8e8aa630779cb3cc29432ed8adf11bbbc4c27edadb2bfa031331a6e212",
    "exact": "5c5fa702c137f879f83f6aa0af918f6ec3769b4c0171d5c2db43fd894ccee76a",
    "events": "12a14952c99da6a8a1dd4d27fb3f46b9f0e3a36a02fa06530c170b66b9211cc3",
    "causal": "d45e2b944848a2b2d671471a368f4320f90ae6fb41d74622d2fad03dccff4d76",
    "lineage": "1cef1d132869213841d049b2cfacd63a94593e0de281a03f4773eefceb5cd748",
    "ownership": "b2a6f6bbfdad4dda8b17962fe95638b2c95c7435968904936b1d87ff21010ec1",
    "semanticBindings": "89bf690a7087c878c81e84ce6fcda4c63c29f2a4a5fbd5a61fc45d7862ee360a",
    "publicIdentity": "91de0006d977fcc579f4ec49bed0aca14c4e71fc91a934e064e815cf9d7439b8",
}

# Explicit fourth reviewer ceremony: the only reviewed-subject change is the
# central v2-only compensation authority removing one superseded v1 BASE_EVENT
# owner.  The modern operation/event/exact/causal bytes remain unchanged.
AUTHORIZED_V2_OWNERSHIP_REVIEW_PREDECESSOR = {
    "fileSha256": "977579beea6105ddd5bec916736e07c6e4179c12a6ecda217590f4ce4d4fdae3",
    "sealedPayloadSha256": "af1d14d0269ce8a2439d8e5c5fbac2c9b6b11645a7f01a4245b92ed3ae290011",
    "priorOwnershipSha256": "8a6619638e2e42d14b18205cde20a12b0132316c92057814d97198feeb8ccd1c",
    "currentOwnershipSha256": "b2a6f6bbfdad4dda8b17962fe95638b2c95c7435968904936b1d87ff21010ec1",
}

# Fifth reviewer ceremony.  The exact, already sealed finalization below is
# the sole semantic predecessor for the analytics-export lifecycle decision.
# Candidate artifacts are immutable review subjects only; the correction
# function never opens them or derives an expected value from them.
AUTHORIZED_ANALYTICS_EXPORT_LIFECYCLE_REVIEW_PREDECESSOR = {
    "fileSha256": "a8d761cea7a5e8b4269152284ba73b5981a32009d3c849bb362d634ee3779b51",
    "sealedPayloadSha256": "f5677c412c0a471ebda0ad7daf8ab6be6fc3805f29e54bd06541cac46d6a6497",
}

# Byte pins for the corrected candidate review subject.  These literals record
# which candidate snapshot was inspected; they are provenance, never oracle
# input.  The semantic correction itself is independently encoded and closed-
# set checked in make_explicit_analytics_export_lifecycle_correction().
ANALYTICS_EXPORT_LIFECYCLE_REVIEW_SUBJECT_PINS = {
    "operationSsot": "ac5ab13730c77267d6d7433b9e567560f0511c18d9255e879a7bb1c6c2286790",
    "exact": "5c5fa702c137f879f83f6aa0af918f6ec3769b4c0171d5c2db43fd894ccee76a",
    "events": "12a14952c99da6a8a1dd4d27fb3f46b9f0e3a36a02fa06530c170b66b9211cc3",
    "causal": "5eaecafca37701fc34176c9c1f704df2a7d159a8ca0569970e362bb1c30112d6",
    "lineage": "f22cb8d45e9bd76dc52d6822d43aa2c78a60a3f2bd15415613dfbdb9d0e7a455",
    "ownership": "11f51f88e25ff01666f347467c82d2e825a81091926cff03f141fd750b476e9b",
    "semanticBindings": "89bf690a7087c878c81e84ce6fcda4c63c29f2a4a5fbd5a61fc45d7862ee360a",
    "publicIdentity": "91de0006d977fcc579f4ec49bed0aca14c4e71fc91a934e064e815cf9d7439b8",
}

# The lifecycle correction changes the SSOT predecessor pin carried by the
# separately governed listening authority.  Deterministically regenerating
# that successor changes only the causal and event-lineage review-subject
# bytes below.  This second one-way closure records those final bytes without
# changing or re-deriving the semantic reviewer decision.
AUTHORIZED_ANALYTICS_EXPORT_SUCCESSOR_CLOSURE_PREDECESSOR = {
    "fileSha256": "36d320bf108bc6c4a6051646e59210c4a641f2a39f0737ebb22ea8e4e0b41335",
    "sealedPayloadSha256": "806219463997c5eb6bbfddb52b588c60307f23327688aca03672d616f061fc70",
}
ANALYTICS_EXPORT_SUCCESSOR_CLOSURE_REVIEW_SUBJECT_PINS = {
    **ANALYTICS_EXPORT_LIFECYCLE_REVIEW_SUBJECT_PINS,
    "causal": "17123b521bef00561d42370f0f7f23f23faaadf714fdd4e36b2ecb9239a004f0",
    "lineage": "fc2f28f9a1c401394683c38df3413b2f121662531c6ea9f77dd52579b73320e4",
}

REVIEWED_TRANSACTION_INFRASTRUCTURE = {
    "policy": (
        "EXECUTE_CHECKED_IN_OWNER_RECEIPT_INBOX_OUTBOX_DDL; "
        "SCALAR_RESULT_REF_IS_NEVER_JSON; AUTHORIZATION_DECISION_IS_A "
        "STRUCTURED_TUPLE_OF_PHYSICAL_SEAL_COLUMNS"
    ),
    "expectedPhysicalTableCount": 12,
    "baseDdlSources": {
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
    },
    "sessions": {
        "HRIS-HRM": {
            "receiptTable": "ppl_command_receipts", "outboxTable": "sys_people_outbox_events",
            "inboxTable": "ppl_domain_inbox_receipts",
            "resultColumn": {"name": "result_reference", "sqlType": "JSONB"},
            "requestDigestColumn": "request_hash", "statusColumn": "lifecycle_state",
            "outcomeColumn": "result_code",
            "guardFunction": "ppl_guard_command_receipt_originating_auth",
            "guardTrigger": "trg_ppl_command_receipt_originating_auth",
        },
        "HRIS-PER": {
            "receiptTable": "prf_command_receipts", "outboxTable": "prf_outbox_events",
            "inboxTable": "prf_inbox_receipts",
            "resultColumn": {"name": "result_ref", "sqlType": "UUID"},
            "requestDigestColumn": "request_hash", "statusColumn": "receipt_state",
            "outcomeColumn": "response_code",
            "guardFunction": "prf_guard_command_receipt_originating_auth",
            "guardTrigger": "trg_prf_command_receipt_originating_auth",
        },
        "HRIS-TIM": {
            "receiptTable": "tme_command_receipts", "outboxTable": "tme_outbox_events",
            "inboxTable": "tme_inbox_receipts",
            "resultColumn": {"name": "result_ref", "sqlType": "UUID"},
            "requestDigestColumn": "request_digest", "statusColumn": "status",
            "outcomeColumn": "status",
            "guardFunction": "tme_guard_command_receipt_seal",
            "guardTrigger": "tr_tme_command_receipt_seal",
        },
        "HRIS-SYS": {
            "receiptTable": "sys_hris_command_receipts", "outboxTable": "sys_domain_event_outbox",
            "inboxTable": "sys_domain_event_inbox",
            "resultColumn": {"name": "result_ref", "sqlType": "VARCHAR(500)"},
            "requestDigestColumn": "request_digest", "statusColumn": "status",
            "outcomeColumn": "status+result_ref",
            "guardFunction": "sys_hris_guard_command_receipt_seal",
            "guardTrigger": "tr_sys_hris_command_receipt_seal",
        },
    },
    "decisionReceiptTuple": {
        "ruleId": "originating_action",
        "inputDigestOrRef": "SESSION_REQUEST_DIGEST_COLUMN",
        "outcome": "SESSION_STATUS_PLUS_OPTIONAL_OUTCOME_COLUMN",
        "decisionVersion": "authorization_revision+field_policy_revision",
        "sameTransaction": True,
        "scalarResultRefJsonOperatorsForbidden": True,
    },
}

FINAL_EVENT_REFERENT_CORRECTIONS = {
    "ppl_bnf_enrollments.decision_receipt_public_id":
        {"entityType": "Approval.DecisionReceipt", "idSpace": "PUBLIC_UUID"},
    "prf_skl_worker_evidence.verification_receipt_public_id":
        {"entityType": "Skills.EvidenceVerificationReceipt", "idSpace": "PUBLIC_UUID"},
    "prf_grw_coaching_notes.artifact_public_id":
        {"entityType": "Content.ImmutableArtifact", "idSpace": "PUBLIC_UUID"},
    "prf_cmp_approved_snapshots.plan_public_id":
        {"entityType": "PER.CompensationPlan", "idSpace": "PUBLIC_UUID"},
    "ppl_rec_hire_handoff_receipts.worker_public_id":
        {"entityType": "HRM.Worker", "idSpace": "PUBLIC_UUID"},
    "ppl_rec_hire_handoff_receipts.employment_public_id":
        {"entityType": "HRM.Employment", "idSpace": "PUBLIC_UUID"},
    "ppl_rec_hire_handoff_receipts.assignment_public_id":
        {"entityType": "HRM.Assignment", "idSpace": "PUBLIC_UUID"},
    "ppl_cwk_access_expiry_receipts.public_id":
        {"entityType": "Auth.ProductAccess", "idSpace": "PUBLIC_UUID"},
    "ppl_cwk_access_expiry_receipts.grant_public_id":
        {"entityType": "Auth.ProductAccess", "idSpace": "PUBLIC_UUID"},
    "tme_wfm_schedule_candidates.availability_snapshot_id":
        {"entityType": "HRM_PER.AvailabilitySnapshot", "idSpace": "PUBLIC_UUID"},
}

# One explicitly authorized correction ceremony may transform only this exact
# already-reviewed overlay.  The correction implementation below never opens
# any live candidate source.  Once the file has changed, a second invocation
# fails closed because the predecessor byte hash no longer matches.
AUTHORIZED_REVIEW_CORRECTION_PREDECESSOR = {
    "fileSha256": "acdbb37959854a7a65a34113cf55c19727cc7531d19b552761c7c66f4e1c6ff9",
    "sealedPayloadSha256": "429a0e07d54eabd562af230cca285d81155d6f450f3c70257886303b2225dbed",
}

# Second, explicitly authorized reviewer correction.  This exact predecessor
# already contains the onboarding effective-interval correction.  It may be
# transformed once to distinguish an event field's semantic ID referent from
# the table/column that supplied its committed value.  No candidate file is
# read by that ceremony.
AUTHORIZED_EVENT_IDENTITY_CORRECTION_PREDECESSOR = {
    "fileSha256": "5a79821abbcc28325cec729146a175749275eaa7f5633d694ea7d7478fb17b8b",
    "sealedPayloadSha256": "7f38f15694228f8592454c85531d1f803aa9d5b5d5f9ac10584e050824414f92",
}

# Sources whose referent cannot be recovered from a public operation's
# persisted-input effect (for example, owner acknowledgements and facts that
# predate the verified transition).  These are explicit reviewer decisions;
# source provenance remains in event field `source` and is never substituted
# for the identity type below.
EVENT_REFERENT_OVERRIDES = {
    "ppl_rec_hire_requests.human_decision_receipt_public_id":
        {"entityType": "Approval.DecisionReceipt", "idSpace": "PUBLIC_UUID"},
    "ppl_hrs_case_actions.actor_public_id":
        {"entityType": "Auth.Principal", "idSpace": "PUBLIC_UUID"},
    "prf_skl_worker_evidence.worker_public_id":
        {"entityType": "HRM.Worker", "idSpace": "PUBLIC_UUID"},
    "prf_skl_worker_evidence.skill_public_id":
        {"entityType": "published taxonomy", "idSpace": "PUBLIC_UUID"},
    "prf_grw_profile_revisions.artifact_public_id":
        {"entityType": "Content.ImmutableArtifact", "idSpace": "PUBLIC_UUID"},
    "prf_lrn_completion_evidence.skill_evidence_ids":
        {"entityType": "PER.SkillEvidence", "idSpace": "PUBLIC_UUID"},
    "prf_cmp_proposals.worker_public_id":
        {"entityType": "HRM.Worker", "idSpace": "PUBLIC_UUID"},
    "ownerRefetch.Approval.DecisionReceipt.publicId":
        {"entityType": "Approval.DecisionReceipt", "idSpace": "PUBLIC_UUID"},
    "prf_cmp_approved_snapshots.approval_receipt_id":
        {"entityType": "Approval.DecisionReceipt", "idSpace": "PUBLIC_UUID"},
    "ownerRefetch.TIM.DemandForecast.publicId":
        {"entityType": "TIM.DemandForecast", "idSpace": "PUBLIC_UUID"},
    "tme_wfm_optimization_requests.input_snapshot_id":
        {"entityType": "HRM.WorkforcePlanningInputSnapshot", "idSpace": "PUBLIC_UUID"},
    "ownerAck.canonicalSchedulePeriodPublicId":
        {"entityType": "TIM.SchedulePeriod", "idSpace": "PUBLIC_UUID"},
    "sys_hris_listening_actions.owner_principal_id":
        {"entityType": "Auth.Principal", "idSpace": "PUBLIC_UUID"},
    "ownerRefetch.SYS.AiUsePolicy.publicId":
        {"entityType": "SYS.AiUsePolicy", "idSpace": "PUBLIC_UUID"},
}


SOURCE_PATHS = {
    "exact": BASE / "modern-capability-exact-schema-contracts.v1.json",
    "events": BASE / "modern-capability-event-payload-contracts.v1.json",
    "semantic": BASE / "modern-capability-semantic-bindings.v1.json",
    "identity": BASE / "modern-capability-public-identity-registry.v1.json",
    "ownership": BASE / "g3-contract-primary-ownership-register.csv",
    "trace": BASE / "modern-capability-trace-register.csv",
    "crossModule": BASE / "cross-module-contract-register.csv",
    "canonicalSchemas": BASE / "cross-module-canonical-schemas.v1.json",
    "hrmModule": ROOT / "session-evidence/hrm/g3-modern-capability-contracts.v1.json",
    "perModule": ROOT / "session-evidence/per/g3-modern-capability-contracts.v1.json",
    "timModule": ROOT / "session-evidence/tim/g3-modern-capability-contracts.v1.json",
    "sysModule": ROOT / "session-evidence/sys/g3-modern-capability-contracts.v1.json",
    "hrmRemediation": BASE / "semantic-remediation/hrm-modern-remediation.v1.json",
    "perRemediation": BASE / "semantic-remediation/per-modern-remediation.v1.json",
    "timWfm": BASE / "semantic-remediation/tim-wfm-exact.proposal.v1.json",
    "sysListening": BASE / "semantic-remediation/sys-listening-admission-exact.proposal.v1.json",
    "sysAnalyticsAi": BASE / "semantic-remediation/sys-analytics-ai-exact.proposal.v1.json",
    "priorHostileAudit": BASE / "reports/modern-causal-semantic-independent-audit-2026-09-15.json",
}


# Frozen before the causal remediation began.  These hashes prove which
# inventory was inspected; they are deliberately not recomputed from the
# mutable candidate.  Expected semantics live in the reviewer decisions below.
PRE_REMEDIATION_INVENTORY_PINS = {
    "exact": "c179789e093906a882231a298dac7e9fadd04db89a25e26c1c053b321038d0d1",
    "events": "737650c7a9ff6e0e1a6bc2a11769006fdbd66d89223a8effcc446dc600d79f0c",
    "semantic": "dfc70f9600b68e8539b2b2dcf1cdb7932cb3cdcdc28b94bdf35903ddc08dcc25",
    "identity": "5463efa1c3b4644721e33107e095f6c0724e9800d5b8b1dbd97e0f2a54e7a48c",
}
PRE_REMEDIATION_EVIDENCE = {
    "capturedAt": "2026-09-15T03:46:27+09:00",
    "path": "coding-readiness/reports/modern-causal-semantic-independent-audit-2026-09-15.json",
    "sha256": "6055df71de1a4ed4186c36c20903a3abdb3a6a17dae95d8296d70245e05b22cf",
    "semantics": "PRE_REMEDIATION_INVENTORY_BASELINE; NOT_EXPECTED_OUTPUT_AUTHORITY",
}


# Closed producer-table inventory derived from the reviewed 16 capability
# ownership set plus the explicit causal deltas below.  The count is computed
# from this set; no candidate-reported table count is authoritative.
EXPECTED_PHYSICAL_TABLES = {
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


REQUIRED_TABLE_DELTAS = {
    "ppl_rec_hire_requests": {
        "requiredColumns": {"candidate_case_id": "BIGINT", "offer_id": "BIGINT", "effective_date": "DATE",
                            "human_decision_receipt_public_id": "UUID", "reason_code": "VARCHAR(80)",
                            "candidate_version": "BIGINT", "request_digest": "CHAR(64)",
                            "status": "VARCHAR(40)"},
        "stateCheck": {"column": "status", "allowed": ["PENDING", "ACKNOWLEDGED", "FAILED", "CANCELLED"]},
    },
    "ppl_jny_template_versions": {
        "requiredColumns": {"journey_template_id": "BIGINT", "version_no": "BIGINT", "status": "VARCHAR(40)",
                            "task_definitions": "JSONB", "content_digest": "CHAR(64)"},
        "stateCheck": {"column": "status", "allowed": ["DRAFT", "PUBLISHED", "RETIRED"]},
    },
    "ppl_jny_assignment_tasks": {
        "requiredColumns": {"journey_assignment_id": "BIGINT", "task_key": "VARCHAR(160)",
                            "required_flag": "BOOLEAN", "status": "VARCHAR(40)"},
        "stateCheck": {"column": "status", "allowed": ["PENDING", "COMPLETED", "CANCELLED"]},
    },
    "ppl_bnf_plan_versions": {
        "requiredColumns": {"benefit_plan_id": "BIGINT", "version_no": "BIGINT", "status": "VARCHAR(40)",
                            "eligibility_policy_version_id": "UUID", "enrollment_window_policy_version_id": "UUID",
                            "valid_from": "DATE", "valid_to": "DATE", "coverage_options": "JSONB",
                            "coverage_configuration_digest": "CHAR(64)", "delivery_mode": "VARCHAR(40)",
                            "provider_config_version_id": "UUID", "payroll_treatment_code": "VARCHAR(80)",
                            "approval_receipt_public_id": "UUID", "content_digest": "CHAR(64)"},
        "stateCheck": {"column": "status", "allowed": ["DRAFT", "PUBLISHED", "RETIRED"]},
    },
    "ppl_bnf_enrollments": {
        "requiredColumns": {"benefit_plan_id": "BIGINT", "benefit_plan_version_id": "BIGINT",
                            "worker_public_id": "UUID", "coverage_level": "VARCHAR(40)",
                            "effective_from": "DATE", "effective_to": "DATE", "dependent_tokens": "JSONB",
                            "life_event_id": "BIGINT", "submission_digest": "CHAR(64)",
                            "decision_receipt_public_id": "UUID", "last_reason_code": "VARCHAR(80)",
                            "status": "VARCHAR(40)"},
        "stateCheck": {"column": "status", "allowed": ["SUBMITTED", "ACTIVE", "REJECTED", "CANCELLED"]},
    },
    "ppl_jny_assignments": {
        "requiredColumns": {"journey_template_id": "BIGINT", "journey_template_version_id": "BIGINT",
                            "worker_public_id": "UUID", "assigned_at": "TIMESTAMPTZ", "due_at": "TIMESTAMPTZ",
                            "assignment_revision": "BIGINT", "completed_at": "TIMESTAMPTZ",
                            "status": "VARCHAR(40)"},
        "stateCheck": {"column": "status", "allowed": ["ASSIGNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]},
    },
    "prf_grw_profile_revisions": {
        "requiredColumns": {"growth_profile_id": "BIGINT", "profile_revision": "BIGINT",
                            "artifact_public_id": "UUID", "artifact_revision": "BIGINT",
                            "visibility": "VARCHAR(40)", "evidence_refs_digest": "CHAR(64)",
                            "recorded_at": "TIMESTAMPTZ"},
    },
    "prf_grw_coaching_notes": {
        "requiredColumns": {"growth_profile_id": "BIGINT", "coach_principal_public_id": "UUID",
                            "artifact_public_id": "UUID", "artifact_revision": "BIGINT",
                            "employee_visible": "BOOLEAN", "occurred_at": "TIMESTAMPTZ",
                            "evidence_refs_digest": "CHAR(64)", "status": "VARCHAR(40)"},
        "stateCheck": {"column": "status", "allowed": ["RECORDED"]},
    },
    "prf_skl_worker_evidence": {
        "requiredColumns": {"verification_receipt_public_id": "UUID",
                            "verification_reason_code": "VARCHAR(80)",
                            "verified_at": "TIMESTAMPTZ", "status": "VARCHAR(40)"},
        "stateCheck": {"column": "status", "allowed": ["PENDING", "VERIFIED", "REVOKED"]},
    },
    "prf_lrn_offerings": {
        "requiredColumns": {"offering_code": "VARCHAR(40)", "display_name": "VARCHAR(240)",
                            "provider_public_id": "UUID", "valid_from": "DATE", "valid_to": "DATE",
                            "status": "VARCHAR(40)"},
        "stateCheck": {"column": "status", "allowed": ["DRAFT", "PUBLISHED", "RETIRED"]},
    },
    "prf_lrn_assignments": {
        "requiredColumns": {"learning_offering_id": "BIGINT", "worker_public_id": "UUID",
                            "assigned_at": "TIMESTAMPTZ", "assignment_revision": "BIGINT",
                            "effective_from": "DATE", "consent_revision": "BIGINT",
                            "started_at": "TIMESTAMPTZ", "completed_at": "TIMESTAMPTZ",
                            "status": "VARCHAR(40)"},
        "stateCheck": {"column": "status", "allowed": ["ENROLLED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]},
    },
    "prf_lrn_completion_evidence": {
        "requiredColumns": {"learning_assignment_id": "BIGINT", "completion_revision": "BIGINT",
                            "source_receipt_id": "UUID", "source_revision": "BIGINT",
                            "evidence_digest": "CHAR(64)", "payload_digest": "CHAR(64)",
                            "completed_at": "TIMESTAMPTZ", "verified_at": "TIMESTAMPTZ",
                            "skill_evidence_ids": "UUID[]"},
    },
    "prf_mkt_applications": {
        "requiredColumns": {"internal_opportunity_id": "BIGINT", "worker_public_id": "UUID",
                            "applied_at": "TIMESTAMPTZ", "application_statement_digest": "CHAR(64)",
                            "consent_revision": "BIGINT", "status": "VARCHAR(40)"},
        "stateCheck": {"column": "status", "allowed": ["APPLIED", "SHORTLISTED", "SELECTED",
                                                           "NOT_SELECTED", "WITHDRAWN"]},
    },
    "prf_cmp_plans": {
        "requiredColumns": {"compensation_cycle_id": "BIGINT", "cycle_public_id": "UUID",
                            "approval_receipt_public_id": "UUID", "approval_revision": "BIGINT",
                            "approval_outcome": "VARCHAR(40)", "plan_revision": "BIGINT",
                            "content_digest": "CHAR(64)", "approved_at": "TIMESTAMPTZ",
                            "status": "VARCHAR(40)"},
        "stateCheck": {"column": "status", "allowed": ["APPROVED", "SUPERSEDED", "RETIRED"]},
    },
    "prf_cmp_approved_snapshots": {
        "requiredColumns": {"compensation_plan_id": "BIGINT", "plan_public_id": "UUID",
                            "cycle_public_id": "UUID", "approval_receipt_id": "UUID",
                            "approval_revision": "BIGINT", "effective_from": "DATE",
                            "snapshot_revision": "BIGINT", "source_version": "BIGINT", "line_count": "INTEGER",
                            "payload_digest": "CHAR(64)", "status": "VARCHAR(40)"},
        "stateCheck": {"column": "status", "allowed": ["PUBLISHED", "SUPERSEDED"]},
    },
    "tme_wfm_forecast_revision_counters": {
        "requiredColumns": {"forecast_key": "VARCHAR(160)", "last_revision": "BIGINT"},
    },
    "tme_wfm_demand_lines": {
        "requiredColumns": {"demand_forecast_id": "BIGINT", "line_key": "VARCHAR(160)",
                            "starts_at": "TIMESTAMPTZ", "ends_at": "TIMESTAMPTZ",
                            "required_headcount": "NUMERIC(12,4)", "required_skills": "JSONB"},
    },
    "tme_wfm_constraint_violation_lines": {
        "requiredColumns": {"constraint_evaluation_receipt_id": "BIGINT", "rule_key": "VARCHAR(160)",
                            "severity": "VARCHAR(40)", "shift_line_key": "VARCHAR(160)",
                            "demand_line_key": "VARCHAR(160)", "expected_value": "JSONB",
                            "actual_value": "JSONB"},
        "stateCheck": {"column": "severity", "allowed": ["BLOCKING", "WARNING"]},
    },
    "tme_wfm_fairness_measure_values": {
        "requiredColumns": {"constraint_evaluation_receipt_id": "BIGINT", "measure_key": "VARCHAR(160)",
                            "measure_value": "JSONB", "accepted_bound": "JSONB", "result": "VARCHAR(40)"},
        "stateCheck": {"column": "result", "allowed": ["WITHIN_BOUND", "OUTSIDE_BOUND", "UNDEFINED"]},
    },
    "tme_wfm_approval_requests": {
        "requiredColumns": {"schedule_candidate_id": "BIGINT", "candidate_revision": "BIGINT",
                            "candidate_digest": "CHAR(64)", "constraint_evaluation_receipt_id": "BIGINT",
                            "status": "VARCHAR(40)", "approval_case_public_id": "UUID",
                            "decision_receipt_public_id": "UUID", "cancellation_receipt_public_id": "UUID"},
        "stateCheck": {"column": "status", "allowed": ["REQUESTED", "ACKNOWLEDGED", "APPROVED",
                                                       "DENIED", "CANCELLED", "RESULT_UNKNOWN"]},
    },
    "tme_wfm_candidate_shift_lines": {
        "requiredColumns": {"schedule_candidate_id": "BIGINT", "demand_forecast_id": "BIGINT",
                            "line_key": "VARCHAR(160)", "demand_line_key": "VARCHAR(160)",
                            "worker_public_id": "UUID", "assignment_public_id": "UUID",
                            "worksite_public_id": "UUID", "starts_at": "TIMESTAMPTZ", "ends_at": "TIMESTAMPTZ",
                            "required_skills": "JSONB", "local_work_date": "DATE", "time_zone": "VARCHAR(64)",
                            "tzdb_version": "VARCHAR(64)", "start_offset_seconds": "INTEGER",
                            "end_offset_seconds": "INTEGER", "segments": "JSONB",
                            "calendar_snapshot_ref": "JSONB", "work_rule_snapshot_ref": "JSONB",
                            "break_duration_seconds": "BIGINT", "planning_input_snapshot_id": "UUID"},
    },
    "tme_wfm_optimization_requests": {
        "requiredColumns": {"demand_forecast_id": "BIGINT", "input_snapshot_id": "UUID",
                            "rule_version": "BIGINT", "deterministic_seed": "VARCHAR(160)",
                            "fairness_evaluation_id": "UUID", "availability_snapshot_id": "UUID",
                            "period_start": "TIMESTAMPTZ", "period_end": "TIMESTAMPTZ",
                            "request_digest": "CHAR(64)", "requested_at": "TIMESTAMPTZ",
                            "status": "VARCHAR(40)"},
        "stateCheck": {"column": "status", "allowed": ["REQUESTED", "COMPLETED", "FAILED", "CANCELLED"]},
    },
    "tme_wfm_schedule_candidates": {
        "requiredColumns": {"optimization_request_id": "BIGINT", "demand_forecast_id": "BIGINT",
                            "candidate_revision": "BIGINT", "input_snapshot_id": "UUID",
                            "availability_snapshot_id": "UUID", "constraint_policy_version": "BIGINT",
                            "period_start": "TIMESTAMPTZ", "period_end": "TIMESTAMPTZ",
                            "candidate_digest": "CHAR(64)", "shift_line_count": "INTEGER",
                            "status": "VARCHAR(40)"},
        "stateCheck": {"column": "status", "allowed": ["GENERATED", "VALIDATED", "VALIDATION_FAILED",
                                                       "SUBMITTED", "REJECTED", "PUBLISHED", "CANCELLED"]},
    },
    "prf_skl_taxonomy_versions": {
        "requiredColumns": {"status": "VARCHAR(40)"},
        "stateCheck": {"column": "status", "allowed": ["DRAFT", "VALIDATED", "PUBLISHED", "RETIRED"]},
    },
    "sys_hris_metric_versions": {
        "requiredColumns": {"status": "VARCHAR(40)"},
        "stateCheck": {"column": "status", "allowed": ["DRAFT", "VALIDATED", "PUBLISHED", "RETIRED"]},
    },
    "sys_hris_analytics_export_receipts": {
        "requiredColumns": {"purpose_code": "VARCHAR(160)"},
    },
}

# Physical columns introduced by the reviewer-level causal bindings.  Keeping
# them in the schema oracle makes every DML sink bidirectionally checkable
# against DDL instead of allowing an implicit JSON/generic-column escape hatch.
ADDITIONAL_REQUIRED_COLUMNS = {
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
for _table_name, _columns in ADDITIONAL_REQUIRED_COLUMNS.items():
    REQUIRED_TABLE_DELTAS.setdefault(_table_name, {"requiredColumns": {}})["requiredColumns"].update(_columns)


# Operation-level state-sink proof.  The count is derived from this explicit
# set and not from the candidate's table or transition totals.  Several
# operations intentionally share the same physical version table and CHECK.
STATE_SINK_OPERATION_DELTAS = {
    "modern.onboarding.template.create": {
        "table": "ppl_jny_template_versions", "column": "status",
        "sqlType": "VARCHAR(40)", "allowed": ["DRAFT", "PUBLISHED", "RETIRED"],
    },
    "modern.onboarding.template.publish": {
        "table": "ppl_jny_template_versions", "column": "status",
        "sqlType": "VARCHAR(40)", "allowed": ["DRAFT", "PUBLISHED", "RETIRED"],
    },
    "modern.onboarding.task.complete": {
        "table": "ppl_jny_assignment_tasks", "column": "status",
        "sqlType": "VARCHAR(40)", "allowed": ["PENDING", "COMPLETED", "CANCELLED"],
    },
    "modern.benefits.plan.create": {
        "table": "ppl_bnf_plan_versions", "column": "status",
        "sqlType": "VARCHAR(40)", "allowed": ["DRAFT", "PUBLISHED", "RETIRED"],
    },
    "modern.benefits.plan.publish": {
        "table": "ppl_bnf_plan_versions", "column": "status",
        "sqlType": "VARCHAR(40)", "allowed": ["DRAFT", "PUBLISHED", "RETIRED"],
    },
    "modern.skills.taxonomy.create": {
        "table": "prf_skl_taxonomy_versions", "column": "status",
        "sqlType": "VARCHAR(40)", "allowed": ["DRAFT", "VALIDATED", "PUBLISHED", "RETIRED"],
    },
    "modern.skills.taxonomy.validate": {
        "table": "prf_skl_taxonomy_versions", "column": "status",
        "sqlType": "VARCHAR(40)", "allowed": ["DRAFT", "VALIDATED", "PUBLISHED", "RETIRED"],
    },
    "modern.skills.taxonomy.publish": {
        "table": "prf_skl_taxonomy_versions", "column": "status",
        "sqlType": "VARCHAR(40)", "allowed": ["DRAFT", "VALIDATED", "PUBLISHED", "RETIRED"],
    },
    "modern.analytics.metric.create": {
        "table": "sys_hris_metric_versions", "column": "status",
        "sqlType": "VARCHAR(40)", "allowed": ["DRAFT", "VALIDATED", "PUBLISHED", "RETIRED"],
    },
    "modern.analytics.metric.validate": {
        "table": "sys_hris_metric_versions", "column": "status",
        "sqlType": "VARCHAR(40)", "allowed": ["DRAFT", "VALIDATED", "PUBLISHED", "RETIRED"],
    },
    "modern.analytics.metric.publish": {
        "table": "sys_hris_metric_versions", "column": "status",
        "sqlType": "VARCHAR(40)", "allowed": ["DRAFT", "VALIDATED", "PUBLISHED", "RETIRED"],
    },
}


# These are review decisions, not inferred from the first table in writesTables.
ROOT_OVERRIDES = {
    "modern.recruiting.offer.issue": ("ppl_rec_candidate_cases", "stage"),
    "modern.recruiting.hire.record": ("ppl_rec_candidate_cases", "stage"),
    "modern.onboarding.template.create": ("ppl_jny_template_versions", "status"),
    "modern.onboarding.template.publish": ("ppl_jny_template_versions", "status"),
    "modern.onboarding.task.complete": ("ppl_jny_assignment_tasks", "status"),
    "modern.benefits.plan.create": ("ppl_bnf_plan_versions", "status"),
    "modern.benefits.plan.publish": ("ppl_bnf_plan_versions", "status"),
    "modern.skills.taxonomy.create": ("prf_skl_taxonomy_versions", "status"),
    "modern.skills.taxonomy.validate": ("prf_skl_taxonomy_versions", "status"),
    "modern.skills.taxonomy.publish": ("prf_skl_taxonomy_versions", "status"),
    "modern.compplan.proposal.submit": ("prf_cmp_proposals", "status"),
    "modern.compplan.snapshot.publish": ("prf_cmp_cycles", "status"),
    "modern.wfm.schedule.optimize": ("tme_wfm_optimization_requests", "status"),
    "modern.growth.profile.update": ("prf_grw_profiles", "status"),
    "modern.growth.coaching.record": ("prf_grw_profiles", "status"),
    "modern.analytics.metric.create": ("sys_hris_metric_versions", "status"),
    "modern.analytics.metric.validate": ("sys_hris_metric_versions", "status"),
    "modern.analytics.metric.publish": ("sys_hris_metric_versions", "status"),
    "modern.ai.policy.evaluate": ("sys_hris_ai_evaluation_requests", "status"),
    "modern.ai.kill.switch": ("sys_hris_ai_use_policies", "status"),
}


# Exact lifecycle corrections that cannot be accepted from the current candidate.
TRANSITION_OVERRIDES = {
    "modern.recruiting.candidate.stage": {
        "preStates": ["APPLIED", "SCREENING", "INTERVIEW"],
        "postStates": ["SCREENING", "INTERVIEW", "REJECTED", "CLOSED"],
        "postStateSource": "body.targetStage",
        "note": "OFFERED is owned by offer.issue and HIRED by the idempotent owner-ack handler.",
    },
    "modern.recruiting.offer.issue": {
        "preStates": ["INTERVIEW"], "postStates": ["OFFERED"],
        "postStateSource": "CONSTANT:OFFERED",
        "note": "Candidate CAS is the concurrency root; offer ISSUED is an inserted child fact.",
    },
    "modern.recruiting.hire.record": {
        "preStates": ["OFFERED"], "postStates": ["HIRE_PENDING"],
        "postStateSource": "CONSTANT:HIRE_PENDING",
        "note": "The public command requests a handoff; it cannot claim HIRED.",
    },
    "modern.onboarding.template.publish": {
        "preStates": ["DRAFT"], "postStates": ["PUBLISHED"],
        "postStateSource": "CONSTANT:PUBLISHED",
    },
    "modern.onboarding.task.complete": {
        "preStates": ["PENDING"], "postStates": ["COMPLETED", "CANCELLED"],
        "postStateSource": "OWNER_TASK_RULE_REDUCTION",
        "note": "Task is the CAS root; assignment state is reduced after the task/evidence write.",
    },
    "modern.growth.profile.update": {
        "preStates": ["DRAFT", "ACTIVE"], "postStates": ["ACTIVE"],
        "postStateSource": "CONSTANT:ACTIVE",
        "note": "The profile is the CAS root; no bulk aspiration overwrite is allowed.",
    },
    "modern.growth.coaching.record": {
        "preStates": ["ACTIVE"], "postStates": ["ACTIVE"],
        "postStateSource": "CONSTANT:ACTIVE",
        "note": "Append a typed coaching-note fact and fence it with the profile CAS.",
    },
    "modern.growth.profile.archive": {
        "preStates": ["DRAFT", "ACTIVE"], "postStates": ["ARCHIVED"],
        "postStateSource": "CONSTANT:ARCHIVED",
        "note": "Archive only the profile root; child aspirations remain immutable history.",
    },
    "modern.compplan.proposal.submit": {
        "preStates": ["DRAFT"], "postStates": ["SUBMITTED"],
        "postStateSource": "CONSTANT:SUBMITTED",
        "note": "A proposal submit does not advance the entire compensation cycle.",
    },
    "modern.benefits.plan.publish": {
        "preStates": ["DRAFT"], "postStates": ["PUBLISHED"],
        "postStateSource": "CONSTANT:PUBLISHED",
    },
    "modern.benefits.enrollment.decide": {
        "preStates": ["SUBMITTED"], "postStates": ["ACTIVE", "REJECTED"],
        "postStateSource": "MAP:body.decision APPROVE->ACTIVE REJECT->REJECTED",
        "note": "Decision vocabulary and persisted enrollment lifecycle are explicit; APPROVED is not an enrollment state.",
    },
    "modern.skills.evidence.verify": {
        "preStates": ["PENDING"], "postStates": ["VERIFIED"],
        "postStateSource": "VERIFIED_OWNER_RECEIPT",
        "note": "Verification changes only lifecycle/audit columns; immutable evidence facts are compared, never caller-overwritten.",
    },
    "modern.learning.offering.create": {
        "preStates": ["NONE"], "postStates": ["DRAFT"],
        "postStateSource": "CONSTANT:DRAFT",
    },
    "modern.learning.offering.publish": {
        "preStates": ["DRAFT"], "postStates": ["PUBLISHED"],
        "postStateSource": "CONSTANT:PUBLISHED",
    },
    "modern.learning.self.enroll": {
        "preStates": ["NONE"], "postStates": ["ENROLLED"],
        "postStateSource": "CONSTANT:ENROLLED",
        "note": "The assignment is a new aggregate; the selected offering is a PUBLISHED related parent, never the root pre-state.",
    },
    "modern.opportunity.apply": {
        "preStates": ["NONE"], "postStates": ["APPLIED"],
        "postStateSource": "CONSTANT:APPLIED",
        "note": "The application is a new aggregate; the opportunity OPEN state is an exact related-parent guard.",
    },
    "modern.compplan.snapshot.publish": {
        "preStates": ["APPROVED"], "postStates": ["PUBLISHED"],
        "postStateSource": "CONSTANT:PUBLISHED",
        "note": "Cycle is CAS root; immutable snapshot header and exactly N lines are children.",
    },
    "modern.wfm.schedule.optimize": {
        "preStates": ["NONE"], "postStates": ["REQUESTED"],
        "postStateSource": "CONSTANT:REQUESTED",
        "note": "The public command persists only a recoverable request; solver result facts belong to the completion handler.",
    },
    "modern.wfm.schedule.validate": {
        "preStates": ["GENERATED", "VALIDATED", "VALIDATION_FAILED"],
        "postStates": ["VALIDATED", "VALIDATION_FAILED"],
        "postStateSource": "ENGINE_CONSTRAINT_EVALUATION",
    },
    "modern.wfm.schedule.submit": {
        "preStates": ["VALIDATED"], "postStates": ["SUBMITTED"],
        "postStateSource": "CONSTANT:SUBMITTED",
    },
    "modern.wfm.schedule.publish": {
        "preStates": ["SUBMITTED"], "postStates": ["PUBLISHED"],
        "postStateSource": "APPROVED_OWNER_PUBLICATION",
    },
    "modern.analytics.metric.publish": {
        "preStates": ["VALIDATED"], "postStates": ["PUBLISHED"],
        "postStateSource": "CONSTANT:PUBLISHED",
    },
    "modern.analytics.metric.retire": {
        "preStates": ["PUBLISHED"], "postStates": ["RETIRED"],
        "postStateSource": "CONSTANT:RETIRED",
    },
    "modern.ai.policy.evaluate": {
        "preStates": ["NONE"], "postStates": ["REQUESTED"],
        "postStateSource": "CONSTANT:REQUESTED",
        "note": "The public command persists only an evaluation request; the owner-result handler records receipt and policy outcome.",
    },
    "modern.ai.policy.publish": {
        "preStates": ["EVALUATED"], "postStates": ["ACTIVE"],
        "postStateSource": "CONSTANT:ACTIVE",
    },
    "modern.ai.policy.retire": {
        "preStates": ["DRAFT", "EVALUATED", "ACTIVE", "SUSPENDED"], "postStates": ["RETIRED"],
        "postStateSource": "CONSTANT:RETIRED",
    },
}


VERSION_TARGETS = {
    "modern.onboarding.template.publish": ("ppl_jny_template_versions", "version_no"),
    "modern.benefits.plan.publish": ("ppl_bnf_plan_versions", "version_no"),
    "modern.skills.taxonomy.validate": ("prf_skl_taxonomy_versions", "version_no"),
    "modern.skills.taxonomy.publish": ("prf_skl_taxonomy_versions", "version_no"),
    "modern.analytics.metric.validate": ("sys_hris_metric_versions", "version_no"),
    "modern.analytics.metric.publish": ("sys_hris_metric_versions", "version_no"),
}


PATH_BODY_EQUALITY = {
    "modern.compplan.snapshot.publish": [("pathParameters.cycleId", "body.cyclePublicId")],
}


# Caller fields that purport to be engine/canonical-output facts.  Their names
# remain in the audited request inventory so the validator can require removal
# or replacement with typed owner inputs rather than silently dropping them.
FORBIDDEN_CALLER_ASSERTIONS = {
    ("modern.growth.profile.update", "body.changeSetDigest"):
        "replace with a typed profilePatch or immutable artifact publicId+revision; a digest alone cannot describe a mutation",
    ("modern.growth.coaching.record", "body.changeSetDigest"):
        "replace with typed CoachingNote content or immutable artifact publicId+revision; a digest alone cannot create a note",
    ("modern.compplan.snapshot.publish", "body.lineCount"):
        "derive from the validated lines[] collection and persisted rows",
    ("modern.compplan.snapshot.publish", "body.workerPublicId"):
        "move into each typed lines[] item and owner-refetch worker",
    ("modern.compplan.snapshot.publish", "body.assignmentPublicId"):
        "move into each typed lines[] item and owner-refetch assignment",
    ("modern.compplan.snapshot.publish", "body.componentCode"):
        "move into each typed lines[] item and validate configured component version",
    ("modern.compplan.snapshot.publish", "body.currencyCode"):
        "move into each typed lines[] item and validate currency authority",
    ("modern.compplan.snapshot.publish", "body.approvedAmount"):
        "move into each typed lines[] item and recompute total/digest",
    ("modern.wfm.schedule.optimize", "body.blockingViolationCount"):
        "solver/evaluation owner computes after optimization",
    ("modern.wfm.schedule.optimize", "body.fairnessMetricCount"):
        "solver/evaluation owner computes after optimization",
    ("modern.wfm.schedule.validate", "body.blockingViolationCount"):
        "constraint engine computes and persists immutable evaluation lines",
    ("modern.wfm.schedule.validate", "body.fairnessMetricCount"):
        "fairness engine computes and persists immutable measure rows",
    ("modern.wfm.schedule.submit", "body.blockingViolationCount"):
        "refetch immutable candidate evaluation receipt",
    ("modern.wfm.schedule.submit", "body.fairnessMetricCount"):
        "refetch immutable candidate evaluation receipt",
}


# Reviewer-authored request successors.  These replace caller-authored output
# claims with typed business input or owner-produced immutable references.
REQUEST_BODY_OVERRIDES: dict[str, list[dict[str, Any]]] = {
    "modern.onboarding.template.create": [
        {"name": "businessKey", "type": "STRING", "required": True,
         "sensitivity": "INTERNAL", "tokenization": "NONE"},
        {"name": "displayName", "type": "STRING", "required": True,
         "sensitivity": "INTERNAL", "tokenization": "NONE"},
        {"name": "effectiveFrom", "type": "DATE", "required": True,
         "sensitivity": "INTERNAL", "tokenization": "NONE"},
        {"name": "effectiveTo", "type": "DATE", "required": False,
         "sensitivity": "INTERNAL", "tokenization": "NONE"},
        {"name": "configScopePublicId", "type": "UUID", "required": True,
         "sensitivity": "RESTRICTED", "tokenization": "OPAQUE_PUBLIC_ID",
         "referenceContract": {"entityType": "SYS.Config", "idSpace": "PUBLIC_UUID"}},
        {"name": "tasks", "type": "ARRAY", "itemSchemaRef": "OnboardingTemplateTask.v1",
         "required": True, "minItems": 1, "maxItems": 500, "uniqueBy": ["taskKey"],
         "canonicalOrder": "taskKey", "sensitivity": "INTERNAL", "tokenization": "NONE"},
    ],
    "modern.onboarding.journey.assign": [
        {"name": "workerPublicId", "type": "UUID", "required": True,
         "sensitivity": "RESTRICTED", "tokenization": "OPAQUE_PUBLIC_ID",
         "referenceContract": {"entityType": "HRM.Worker", "idSpace": "PUBLIC_UUID"}},
        {"name": "templateVersionId", "type": "UUID", "required": True,
         "sensitivity": "INTERNAL", "tokenization": "OPAQUE_PUBLIC_ID",
         "referenceContract": {"entityType": "table:ppl_jny_template_versions", "idSpace": "PUBLIC_UUID"}},
        {"name": "dueAt", "type": "TIMESTAMPTZ", "required": True,
         "sensitivity": "INTERNAL", "tokenization": "NONE"},
    ],
    "modern.skills.evidence.verify": [
        {"name": "evidenceDigest", "type": "SHA256", "required": True,
         "validation": "must equal the locked pending evidence digest; never overwrites evidence content",
         "sensitivity": "INTERNAL", "tokenization": "NONREVERSIBLE_DIGEST"},
        {"name": "sourceRevision", "type": "BIGINT", "required": True,
         "validation": ">0 and must equal the locked pending evidence source revision",
         "sensitivity": "INTERNAL", "tokenization": "NONE"},
        {"name": "verificationReceiptId", "type": "UUID", "required": True,
         "validation": "VERIFIED owner receipt bound to evidenceId, digest, source revision, tenant and purpose",
         "sensitivity": "RESTRICTED", "tokenization": "OPAQUE_PUBLIC_ID",
         "referenceContract": {"entityType": "Skills.EvidenceVerificationReceipt", "idSpace": "PUBLIC_UUID"}},
        {"name": "reasonCode", "type": "STRING", "required": True,
         "validation": "registered non-free-text verification reason code",
         "sensitivity": "INTERNAL", "tokenization": "NONE"},
    ],
    "modern.learning.offering.create": [
        {"name": "businessKey", "type": "STRING", "required": True,
         "sensitivity": "INTERNAL", "tokenization": "NONE"},
        {"name": "displayName", "type": "STRING", "required": True,
         "sensitivity": "INTERNAL", "tokenization": "NONE"},
        {"name": "effectiveFrom", "type": "DATE", "required": True,
         "sensitivity": "INTERNAL", "tokenization": "NONE"},
        {"name": "effectiveTo", "type": "DATE", "required": False,
         "sensitivity": "INTERNAL", "tokenization": "NONE"},
        {"name": "providerPublicId", "type": "UUID", "required": True,
         "sensitivity": "RESTRICTED", "tokenization": "OPAQUE_PUBLIC_ID",
         "referenceContract": {"entityType": "SYS.Connector", "idSpace": "PUBLIC_UUID"}},
    ],
    "modern.learning.self.enroll": [
        {"name": "offeringId", "type": "UUID", "required": True,
         "validation": "exact tenant-local PUBLISHED offering",
         "sensitivity": "INTERNAL", "tokenization": "OPAQUE_PUBLIC_ID",
         "referenceContract": {"entityType": "table:prf_lrn_offerings", "idSpace": "PUBLIC_UUID"}},
        {"name": "effectiveFrom", "type": "DATE", "required": True,
         "validation": "business-effective enrollment date within offering availability",
         "sensitivity": "INTERNAL", "tokenization": "NONE"},
        {"name": "consentRevision", "type": "BIGINT", "required": True,
         "validation": ">0 exact consent text/version accepted by the worker",
         "sensitivity": "INTERNAL", "tokenization": "NONE"},
        {"name": "workerPublicId", "type": "UUID", "required": True,
         "validation": "must equal self principal worker unless an explicitly authorized proxy scope is used",
         "sensitivity": "RESTRICTED", "tokenization": "OPAQUE_PUBLIC_ID",
         "referenceContract": {"entityType": "HRM.Worker", "idSpace": "PUBLIC_UUID"}},
    ],
    "modern.opportunity.apply": [
        {"name": "consentRevision", "type": "BIGINT", "required": True,
         "validation": ">0 exact application-consent version",
         "sensitivity": "INTERNAL", "tokenization": "NONE"},
        {"name": "applicationStatementDigest", "type": "SHA256", "required": True,
         "validation": "digest of separately governed immutable application statement artifact",
         "sensitivity": "INTERNAL", "tokenization": "NONREVERSIBLE_DIGEST"},
        {"name": "workerPublicId", "type": "UUID", "required": True,
         "validation": "must equal self principal worker unless an explicitly authorized proxy scope is used",
         "sensitivity": "RESTRICTED", "tokenization": "OPAQUE_PUBLIC_ID",
         "referenceContract": {"entityType": "HRM.Worker", "idSpace": "PUBLIC_UUID"}},
    ],
    "modern.benefits.plan.create": [
        {"name": "businessKey", "type": "STRING", "required": True,
         "sensitivity": "INTERNAL", "tokenization": "NONE"},
        {"name": "displayName", "type": "STRING", "required": True,
         "sensitivity": "INTERNAL", "tokenization": "NONE"},
        {"name": "effectiveFrom", "type": "DATE", "required": True,
         "sensitivity": "INTERNAL", "tokenization": "NONE"},
        {"name": "effectiveTo", "type": "DATE", "required": False,
         "sensitivity": "INTERNAL", "tokenization": "NONE"},
        {"name": "eligibilityPolicyVersionId", "type": "UUID", "required": True,
         "sensitivity": "RESTRICTED", "tokenization": "OPAQUE_PUBLIC_ID",
         "referenceContract": {"entityType": "SYS.Config", "idSpace": "PUBLIC_UUID"}},
        {"name": "enrollmentWindowPolicyVersionId", "type": "UUID", "required": True,
         "sensitivity": "RESTRICTED", "tokenization": "OPAQUE_PUBLIC_ID",
         "referenceContract": {"entityType": "SYS.Config", "idSpace": "PUBLIC_UUID"}},
        {"name": "coverageOptions", "type": "ARRAY", "itemSchemaRef": "BenefitCoverageOption.v1",
         "required": True, "minItems": 1, "maxItems": 100, "uniqueBy": ["coverageOptionCode"],
         "canonicalOrder": "coverageOptionCode", "sensitivity": "CONFIDENTIAL",
         "tokenization": "ENVELOPE_ENCRYPTION_AT_REST"},
        {"name": "deliveryMode", "type": "STRING", "required": True,
         "sensitivity": "INTERNAL", "tokenization": "NONE"},
        {"name": "providerConfigVersionId", "type": "UUID", "required": False,
         "sensitivity": "RESTRICTED", "tokenization": "OPAQUE_PUBLIC_ID",
         "referenceContract": {"entityType": "SYS.ConnectorConfig", "idSpace": "PUBLIC_UUID"}},
        {"name": "payrollTreatmentCode", "type": "STRING", "required": True,
         "sensitivity": "INTERNAL", "tokenization": "NONE"},
    ],
    "modern.benefits.enrollment.submit": [
        {"name": "coverageOptionCode", "type": "STRING", "required": True,
         "sensitivity": "INTERNAL", "tokenization": "NONE"},
        {"name": "benefitPlanId", "type": "UUID", "required": True,
         "sensitivity": "INTERNAL", "tokenization": "OPAQUE_PUBLIC_ID",
         "referenceContract": {"entityType": "table:ppl_bnf_plans", "idSpace": "PUBLIC_UUID"}},
        {"name": "benefitPlanVersionId", "type": "UUID", "required": True,
         "sensitivity": "INTERNAL", "tokenization": "OPAQUE_PUBLIC_ID",
         "referenceContract": {"entityType": "table:ppl_bnf_plan_versions", "idSpace": "PUBLIC_UUID"}},
        {"name": "submissionDigest", "type": "SHA256", "required": True,
         "sensitivity": "INTERNAL", "tokenization": "NONREVERSIBLE_DIGEST"},
        {"name": "effectiveDate", "type": "DATE", "required": True,
         "sensitivity": "INTERNAL", "tokenization": "NONE"},
        {"name": "workerPublicId", "type": "UUID", "required": True,
         "sensitivity": "RESTRICTED", "tokenization": "OPAQUE_PUBLIC_ID",
         "referenceContract": {"entityType": "HRM.Worker", "idSpace": "PUBLIC_UUID"}},
        {"name": "dependentTokens", "type": "ARRAY<STRING>", "required": False,
         "sensitivity": "CONFIDENTIAL", "tokenization": "NONREVERSIBLE_TOKEN"},
        {"name": "lifeEventId", "type": "UUID", "required": False,
         "sensitivity": "RESTRICTED", "tokenization": "OPAQUE_PUBLIC_ID",
         "referenceContract": {"entityType": "table:ppl_bnf_life_events", "idSpace": "PUBLIC_UUID"}},
    ],
    "modern.benefits.lifeevent.submit": [
        {"name": "workerPublicId", "type": "UUID", "required": True, "sensitivity": "RESTRICTED",
         "tokenization": "OPAQUE_PUBLIC_ID", "referenceContract": {"entityType": "HRM.Worker", "idSpace": "PUBLIC_UUID"}},
        {"name": "eventType", "type": "STRING", "required": True, "sensitivity": "CONFIDENTIAL", "tokenization": "NONE"},
        {"name": "eventDate", "type": "DATE", "required": True, "sensitivity": "CONFIDENTIAL", "tokenization": "NONE"},
        {"name": "evidenceObjectRef", "type": "STRING", "required": False, "sensitivity": "CONFIDENTIAL",
         "tokenization": "ENVELOPE_ENCRYPTION_AT_REST"},
        {"name": "sourceRecordKey", "type": "STRING", "required": True, "sensitivity": "RESTRICTED",
         "tokenization": "NONREVERSIBLE_TOKEN"},
        {"name": "submissionDigest", "type": "SHA256", "required": True, "sensitivity": "INTERNAL",
         "tokenization": "NONREVERSIBLE_DIGEST"},
    ],
    "modern.hrservice.case.create": [
        {"name": "businessKey", "type": "STRING", "required": True, "sensitivity": "INTERNAL", "tokenization": "NONE"},
        {"name": "displayName", "type": "STRING", "required": True, "sensitivity": "CONFIDENTIAL",
         "tokenization": "ENVELOPE_ENCRYPTION_AT_REST"},
        {"name": "requesterWorkerPublicId", "type": "UUID", "required": True, "sensitivity": "RESTRICTED",
         "tokenization": "OPAQUE_PUBLIC_ID", "referenceContract": {"entityType": "HRM.Worker", "idSpace": "PUBLIC_UUID"}},
        {"name": "slaPolicyVersionId", "type": "UUID", "required": True, "sensitivity": "INTERNAL",
         "tokenization": "OPAQUE_PUBLIC_ID", "referenceContract": {"entityType": "SYS.Config", "idSpace": "PUBLIC_UUID"}},
        {"name": "queueKey", "type": "STRING", "required": True, "sensitivity": "INTERNAL", "tokenization": "NONE"},
        {"name": "sensitivityClass", "type": "STRING", "required": True, "sensitivity": "INTERNAL", "tokenization": "NONE"},
        {"name": "caseType", "type": "STRING", "required": True, "sensitivity": "INTERNAL", "tokenization": "NONE"},
    ],
    "modern.growth.profile.update": [
        {"name": "profilePatch", "type": "OBJECT", "schemaRef": "GrowthProfilePatch.v1", "required": True,
         "validation": "closed object: artifactPublicId UUID, artifactRevision BIGINT>0, visibility SELF|EMPLOYEE_VISIBLE",
         "sensitivity": "RESTRICTED", "tokenization": "OPAQUE_PUBLIC_ID"},
        {"name": "evidenceRefs", "type": "ARRAY<UUID>", "required": False,
         "validation": "0..100 consented immutable evidence public IDs; set semantics and canonical sort",
         "sensitivity": "RESTRICTED", "tokenization": "OPAQUE_PUBLIC_ID",
         "referenceContract": {"entityType": "SkillsOrLearning.Evidence", "idSpace": "PUBLIC_UUID"}},
    ],
    "modern.growth.coaching.record": [
        {"name": "content", "type": "OBJECT", "schemaRef": "CoachingNoteContent.v1", "required": True,
         "validation": "closed object: coachPrincipalPublicId, artifactPublicId, artifactRevision>0, employeeVisible boolean, occurredAt",
         "sensitivity": "CONFIDENTIAL", "tokenization": "ENVELOPE_ENCRYPTION_AT_REST"},
        {"name": "evidenceRefs", "type": "ARRAY<UUID>", "required": False,
         "validation": "0..100 consented immutable evidence public IDs; set semantics and canonical sort",
         "sensitivity": "RESTRICTED", "tokenization": "OPAQUE_PUBLIC_ID",
         "referenceContract": {"entityType": "SkillsOrLearning.Evidence", "idSpace": "PUBLIC_UUID"}},
    ],
    "modern.opportunity.create": [
        {"name": "businessKey", "type": "STRING", "required": True, "sensitivity": "INTERNAL", "tokenization": "NONE"},
        {"name": "displayName", "type": "STRING", "required": True, "sensitivity": "INTERNAL", "tokenization": "NONE"},
        {"name": "ownerOrgPublicId", "type": "UUID", "required": True, "sensitivity": "RESTRICTED",
         "tokenization": "OPAQUE_PUBLIC_ID", "referenceContract": {"entityType": "HRM.Organization", "idSpace": "PUBLIC_UUID"}},
        {"name": "openFrom", "type": "TIMESTAMPTZ", "required": True, "sensitivity": "INTERNAL", "tokenization": "NONE"},
        {"name": "closeAt", "type": "TIMESTAMPTZ", "required": False, "sensitivity": "INTERNAL", "tokenization": "NONE"},
    ],
    "modern.compplan.snapshot.publish": [
        {"name": "approvalReceiptId", "type": "UUID", "required": True,
         "validation": "APPROVED, target-bound, tenant/purpose/version exact",
         "sensitivity": "RESTRICTED", "tokenization": "OPAQUE_PUBLIC_ID",
         "referenceContract": {"entityType": "Approval.DecisionReceipt", "idSpace": "PUBLIC_UUID"}},
        {"name": "effectiveFrom", "type": "DATE", "required": True,
         "validation": "ISO-8601 business date", "sensitivity": "INTERNAL", "tokenization": "NONE"},
        {"name": "contentDigest", "type": "SHA256", "required": True,
         "validation": "recomputed canonical header+ordered-lines digest; 64 lowercase hex",
         "sensitivity": "INTERNAL", "tokenization": "NONREVERSIBLE_DIGEST"},
        {"name": "planPublicId", "type": "UUID", "required": True,
         "validation": "owner-issued plan public ID, tenant/purpose/effective version exact",
         "sensitivity": "RESTRICTED", "tokenization": "OPAQUE_PUBLIC_ID",
         "referenceContract": {"entityType": "PER.CompensationPlan", "idSpace": "PUBLIC_UUID"}},
        {"name": "cyclePublicId", "type": "UUID", "required": True,
         "validation": "must equal path cycleId after typed resolution",
         "sensitivity": "RESTRICTED", "tokenization": "OPAQUE_PUBLIC_ID",
         "referenceContract": {"entityType": "table:prf_cmp_cycles", "idSpace": "PUBLIC_UUID"}},
        {"name": "lines", "type": "ARRAY", "itemSchemaRef": "ApprovedCompensationSnapshotLine.v1", "required": True,
         "validation": "1..100000 closed typed items; stable canonical order; worker+assignment+component unique",
         "sensitivity": "CONFIDENTIAL", "tokenization": "ENVELOPE_ENCRYPTION_AT_REST",
         "minItems": 1, "maxItems": 100000,
         "uniqueBy": ["workerPublicId", "assignmentPublicId", "componentCode"],
         "canonicalOrder": "workerPublicId,assignmentPublicId,componentCode,effectiveFrom"},
    ],
    "modern.wfm.forecast.create": [
        {"name": "businessKey", "type": "STRING", "required": True,
         "sensitivity": "INTERNAL", "tokenization": "NONE"},
        {"name": "displayName", "type": "STRING", "required": True,
         "sensitivity": "INTERNAL", "tokenization": "NONE"},
        {"name": "worksitePublicId", "type": "UUID", "required": True,
         "sensitivity": "RESTRICTED", "tokenization": "OPAQUE_PUBLIC_ID",
         "referenceContract": {"entityType": "HRM.Location", "idSpace": "PUBLIC_UUID"}},
        {"name": "periodStart", "type": "TIMESTAMPTZ", "required": True,
         "sensitivity": "INTERNAL", "tokenization": "NONE"},
        {"name": "periodEnd", "type": "TIMESTAMPTZ", "required": True,
         "sensitivity": "INTERNAL", "tokenization": "NONE"},
        {"name": "sourceDigest", "type": "SHA256", "required": True,
         "sensitivity": "INTERNAL", "tokenization": "NONREVERSIBLE_DIGEST"},
        {"name": "demandSourceId", "type": "UUID", "required": True,
         "sensitivity": "RESTRICTED", "tokenization": "OPAQUE_PUBLIC_ID",
         "referenceContract": {"entityType": "SYS.Connector", "idSpace": "PUBLIC_UUID"}},
        {"name": "sourceTimezone", "type": "STRING", "required": True,
         "sensitivity": "INTERNAL", "tokenization": "NONE"},
        {"name": "demandLines", "type": "ARRAY", "itemSchemaRef": "WorkforceDemandLine.v1",
         "required": True, "minItems": 1, "maxItems": 100000,
         "uniqueBy": ["intervalStart", "intervalEnd", "demandUnitCode", "skillPublicId", "organizationPublicId"],
         "canonicalOrder": "request order stabilized as server line sequence",
         "sensitivity": "RESTRICTED", "tokenization": "FIELD_LEVEL_POLICY"},
    ],
    "modern.wfm.schedule.optimize": [
        {"name": "inputSnapshotId", "type": "UUID", "required": True,
         "validation": "tenant-bound immutable planning input snapshot",
         "sensitivity": "RESTRICTED", "tokenization": "OPAQUE_PUBLIC_ID",
         "referenceContract": {"entityType": "HRM.WorkforcePlanningInputSnapshot", "idSpace": "PUBLIC_UUID"}},
        {"name": "ruleVersion", "type": "BIGINT", "required": True,
         "validation": ">0 exact registered rule version", "sensitivity": "INTERNAL", "tokenization": "NONE"},
        {"name": "deterministicSeed", "type": "STRING", "required": True,
         "validation": "1..160 non-secret stable replay seed", "sensitivity": "INTERNAL", "tokenization": "NONE"},
        {"name": "fairnessEvaluationId", "type": "UUID", "required": True,
         "validation": "owner-issued immutable pre-run fairness policy/evaluation reference",
         "sensitivity": "RESTRICTED", "tokenization": "OPAQUE_PUBLIC_ID",
         "referenceContract": {"entityType": "SYS.AIFairnessEvaluation", "idSpace": "PUBLIC_UUID"}},
        {"name": "availabilitySnapshotId", "type": "UUID", "required": True,
         "validation": "owner-issued immutable availability snapshot, tenant/purpose/version exact",
         "sensitivity": "RESTRICTED", "tokenization": "OPAQUE_PUBLIC_ID",
         "referenceContract": {"entityType": "HRM_PER.AvailabilitySnapshot", "idSpace": "PUBLIC_UUID"}},
        {"name": "periodStart", "type": "TIMESTAMPTZ", "required": True,
         "validation": "inclusive instant", "sensitivity": "INTERNAL", "tokenization": "NONE"},
        {"name": "periodEnd", "type": "TIMESTAMPTZ", "required": True,
         "validation": "strictly after periodStart", "sensitivity": "INTERNAL", "tokenization": "NONE"},
    ],
    "modern.wfm.schedule.validate": [
        {"name": "validationSuiteVersion", "type": "BIGINT", "required": True,
         "validation": ">0 exact registered suite", "sensitivity": "INTERNAL", "tokenization": "NONE"},
        {"name": "inputDigest", "type": "SHA256", "required": True,
         "validation": "recompute from candidate+snapshot+policy; 64 lowercase hex",
         "sensitivity": "INTERNAL", "tokenization": "NONREVERSIBLE_DIGEST"},
        {"name": "inputSnapshotId", "type": "UUID", "required": True,
         "validation": "exact immutable availability/planning snapshot",
         "sensitivity": "RESTRICTED", "tokenization": "OPAQUE_PUBLIC_ID",
         "referenceContract": {"entityType": "HRM_PER.AvailabilitySnapshot", "idSpace": "PUBLIC_UUID"}},
        {"name": "policyVersionId", "type": "UUID", "required": True,
         "validation": "exact registered constraint policy version",
         "sensitivity": "RESTRICTED", "tokenization": "OPAQUE_PUBLIC_ID",
         "referenceContract": {"entityType": "SYS.Config", "idSpace": "PUBLIC_UUID"}},
    ],
    "modern.wfm.schedule.submit": [
        {"name": "evaluationReceiptId", "type": "UUID", "required": True,
         "validation": "latest exact immutable passing evaluation for this candidate revision",
         "sensitivity": "RESTRICTED", "tokenization": "OPAQUE_PUBLIC_ID",
         "referenceContract": {"entityType": "table:tme_wfm_constraint_evaluation_receipts", "idSpace": "PUBLIC_UUID"}},
        {"name": "submissionDigest", "type": "SHA256", "required": True,
         "validation": "recomputed candidate+evaluation+effective-date digest; 64 lowercase hex",
         "sensitivity": "INTERNAL", "tokenization": "NONREVERSIBLE_DIGEST"},
        {"name": "effectiveDate", "type": "DATE", "required": False,
         "validation": "ISO-8601 business date; absent uses candidate period start date",
         "sensitivity": "INTERNAL", "tokenization": "NONE"},
    ],
    "modern.ai.policy.publish": [
        {"name": "approvalReceiptId", "type": "UUID", "required": True,
         "validation": "APPROVED and target-bound to exact policy version",
         "sensitivity": "RESTRICTED", "tokenization": "OPAQUE_PUBLIC_ID",
         "referenceContract": {"entityType": "Approval.DecisionReceipt", "idSpace": "PUBLIC_UUID"}},
        {"name": "effectiveFrom", "type": "TIMESTAMPTZ", "required": True,
         "validation": "RFC3339 activation instant", "sensitivity": "INTERNAL", "tokenization": "NONE"},
        {"name": "contentDigest", "type": "SHA256", "required": True,
         "validation": "recomputed exact policy-version content digest; 64 lowercase hex",
         "sensitivity": "INTERNAL", "tokenization": "NONREVERSIBLE_DIGEST"},
    ],
    "modern.analytics.export.create": [
        {"name": "metricProjectionIds", "type": "ARRAY<UUID>", "required": True,
         "minItems": 1, "maxItems": 200, "uniqueBy": ["value"], "canonicalOrder": "UUID_BYTE_ASC",
         "sensitivity": "RESTRICTED", "tokenization": "OPAQUE_PUBLIC_ID",
         "referenceContract": {"entityType": "table:sys_hris_metric_projections", "idSpace": "PUBLIC_UUID"}},
        {"name": "purposeCode", "type": "STRING", "required": True, "sensitivity": "INTERNAL", "tokenization": "NONE"},
        {"name": "expiresAt", "type": "TIMESTAMPTZ", "required": True, "sensitivity": "INTERNAL", "tokenization": "NONE"},
    ],
    "modern.ai.assist.create": [
        {"name": "useCaseKey", "type": "STRING", "required": True, "sensitivity": "INTERNAL", "tokenization": "NONE"},
        {"name": "sourceReferenceIds", "type": "ARRAY<UUID>", "required": True,
         "minItems": 1, "maxItems": 200, "uniqueBy": ["value"], "canonicalOrder": "UUID_BYTE_ASC",
         "sensitivity": "RESTRICTED", "tokenization": "OPAQUE_PUBLIC_ID",
         "referenceContract": {"entityType": "Owner.AuthorizedProjection", "idSpace": "PUBLIC_UUID"}},
        {"name": "instructionDigest", "type": "SHA256", "required": True, "sensitivity": "INTERNAL",
         "tokenization": "NONREVERSIBLE_DIGEST"},
        {"name": "humanConfirmation", "type": "BOOLEAN", "required": True, "sensitivity": "INTERNAL", "tokenization": "NONE"},
    ],
    "modern.ai.policy.create": [
        {"name": "displayName", "type": "STRING", "required": True, "sensitivity": "INTERNAL", "tokenization": "NONE"},
        {"name": "useCaseKey", "type": "STRING", "required": True, "sensitivity": "INTERNAL", "tokenization": "NONE"},
        {"name": "validFrom", "type": "TIMESTAMPTZ", "required": True, "sensitivity": "INTERNAL", "tokenization": "NONE"},
        {"name": "validTo", "type": "TIMESTAMPTZ", "required": False, "sensitivity": "INTERNAL", "tokenization": "NONE"},
        {"name": "humanControlMode", "type": "STRING", "required": True, "sensitivity": "INTERNAL", "tokenization": "NONE"},
    ],
}

# Remove generic CRUD-era effective-date/output fields where the domain already
# has a stronger clock or an owner-generated result.  These are explicit
# reviewer decisions, not projections from the mutable candidate.
REQUEST_BODY_OVERRIDES.update({
    "modern.wfm.schedule.publish": [
        {"name": "approvalReceiptId", "type": "UUID", "required": True,
         "validation": "APPROVED and bound to the exact candidate revision and digest",
         "sensitivity": "RESTRICTED", "tokenization": "OPAQUE_PUBLIC_ID",
         "referenceContract": {"entityType": "Approval.DecisionReceipt", "idSpace": "PUBLIC_UUID"}},
        {"name": "effectiveFrom", "type": "DATE", "required": True,
         "validation": "canonical schedule business-effective date",
         "sensitivity": "INTERNAL", "tokenization": "NONE"},
        {"name": "contentDigest", "type": "SHA256", "required": True,
         "validation": "recomputed candidate revision plus canonical schedule payload digest",
         "sensitivity": "INTERNAL", "tokenization": "NONREVERSIBLE_DIGEST"},
    ],
    "modern.opportunity.publish": [
        {"name": "approvalReceiptId", "type": "UUID", "required": True,
         "validation": "APPROVED and target-bound to the exact opportunity revision",
         "sensitivity": "RESTRICTED", "tokenization": "OPAQUE_PUBLIC_ID",
         "referenceContract": {"entityType": "Approval.DecisionReceipt", "idSpace": "PUBLIC_UUID"}},
        {"name": "contentDigest", "type": "SHA256", "required": True,
         "validation": "must equal the immutable draft opportunity content digest",
         "sensitivity": "INTERNAL", "tokenization": "NONREVERSIBLE_DIGEST"},
    ],
    "modern.listening.response.submit": [
        {"name": "submissionDigest", "type": "SHA256", "required": True,
         "validation": "digest of the separately encrypted response payload; raw response is never in the event",
         "sensitivity": "INTERNAL", "tokenization": "NONREVERSIBLE_DIGEST"},
        {"name": "eraseAfter", "type": "TIMESTAMPTZ", "required": True,
         "validation": "retention-policy-derived erasure instant",
         "sensitivity": "RESTRICTED", "tokenization": "NONE"},
    ],
    "modern.listening.survey.create": [
        {"name": "businessKey", "type": "STRING", "required": True,
         "sensitivity": "INTERNAL", "tokenization": "NONE"},
        {"name": "displayName", "type": "STRING", "required": True,
         "sensitivity": "INTERNAL", "tokenization": "NONE"},
        {"name": "audienceSnapshotId", "type": "UUID", "required": True,
         "sensitivity": "RESTRICTED", "tokenization": "OPAQUE_PUBLIC_ID",
         "referenceContract": {"entityType": "HRM.Access", "idSpace": "PUBLIC_UUID"}},
        {"name": "consentPolicyVersionId", "type": "UUID", "required": True,
         "sensitivity": "RESTRICTED", "tokenization": "OPAQUE_PUBLIC_ID",
         "referenceContract": {"entityType": "SYS.Config", "idSpace": "PUBLIC_UUID"}},
        {"name": "anonymityThreshold", "type": "INTEGER", "required": True,
         "sensitivity": "RESTRICTED", "tokenization": "NONE"},
        {"name": "opensAt", "type": "TIMESTAMPTZ", "required": True,
         "sensitivity": "INTERNAL", "tokenization": "NONE"},
        {"name": "closesAt", "type": "TIMESTAMPTZ", "required": True,
         "sensitivity": "INTERNAL", "tokenization": "NONE"},
    ],
    "modern.listening.survey.publish": [
        {"name": "approvalReceiptId", "type": "UUID", "required": True,
         "validation": "APPROVED and target-bound to the exact survey revision",
         "sensitivity": "RESTRICTED", "tokenization": "OPAQUE_PUBLIC_ID",
         "referenceContract": {"entityType": "Approval.DecisionReceipt", "idSpace": "PUBLIC_UUID"}},
        {"name": "contentDigest", "type": "SHA256", "required": True,
         "validation": "must equal the immutable survey definition digest",
         "sensitivity": "INTERNAL", "tokenization": "NONREVERSIBLE_DIGEST"},
    ],
    "modern.listening.action.create": [
        {"name": "businessKey", "type": "STRING", "required": True,
         "sensitivity": "INTERNAL", "tokenization": "NONE"},
        {"name": "displayName", "type": "STRING", "required": True,
         "sensitivity": "INTERNAL", "tokenization": "NONE"},
        {"name": "cohortResultId", "type": "UUID", "required": True,
         "sensitivity": "RESTRICTED", "tokenization": "OPAQUE_PUBLIC_ID",
         "referenceContract": {"entityType": "table:sys_hris_listening_cohort_results", "idSpace": "PUBLIC_UUID"}},
        {"name": "ownerPrincipalId", "type": "UUID", "required": True,
         "sensitivity": "RESTRICTED", "tokenization": "OPAQUE_PUBLIC_ID",
         "referenceContract": {"entityType": "Auth.Principal", "idSpace": "PUBLIC_UUID"}},
        {"name": "dueAt", "type": "TIMESTAMPTZ", "required": True,
         "sensitivity": "INTERNAL", "tokenization": "NONE"},
    ],
})


REVIEWED_INPUT_EFFECT_OVERRIDES: dict[tuple[str, str], list[dict[str, Any]]] = {
    ("modern.skills.evidence.verify", "body.evidenceDigest"): [{
        "kind": "LOCKED_FACT_MATCH", "target": "prf_skl_worker_evidence.evidence_digest",
        "operator": "CONSTANT_TIME_EQUAL", "onMismatch": "409 EVIDENCE_CONTENT_CONFLICT",
        "observableAssertion": "a changed digest rejects with zero root/outbox mutation; it never replaces evidence content",
    }],
    ("modern.skills.evidence.verify", "body.sourceRevision"): [{
        "kind": "LOCKED_FACT_MATCH", "target": "prf_skl_worker_evidence.source_revision",
        "operator": "=", "onMismatch": "409 EVIDENCE_SOURCE_REVISION_CONFLICT",
        "observableAssertion": "a changed revision rejects with zero root/outbox mutation",
    }],
    ("modern.skills.evidence.verify", "body.verificationReceiptId"): [
        {"kind": "OWNER_REFETCH", "target": "Skills.EvidenceVerificationReceipt.publicId",
         "selectorType": "OWNER_PORT", "cardinality": "EXACTLY_ONE",
         "pep": {"tenant": "authenticatedPrincipal.tenantId", "purpose": "hcm.skills.evidence.verify",
                 "fieldExposure": ["publicId", "evidencePublicId", "evidenceDigest", "sourceRevision",
                                   "outcome", "decisionVersion", "verifiedAt"],
                 "denyOnUnavailable": True}},
        {"kind": "PERSISTED_COLUMN", "target": "prf_skl_worker_evidence.verification_receipt_public_id"},
        {"kind": "PERSISTED_DECISION_RECEIPT",
         "target": "prf_command_receipts.result_reference.decisionReceipt",
         "requiredFields": {"ruleId": "SKILL_EVIDENCE_OWNER_VERIFICATION_V1",
                            "inputDigestOrRef": "body.verificationReceiptId",
                            "outcome": "VERIFIED", "decisionVersion": "owner receipt decisionVersion"},
         "mutationDependency": "PENDING->VERIFIED CAS requires the persisted, target-bound owner receipt",
         "sameTransaction": True},
    ],
    ("modern.skills.evidence.verify", "body.reasonCode"): [{
        "kind": "PERSISTED_COLUMN", "target": "prf_skl_worker_evidence.verification_reason_code",
        "observableAssertion": "registered code is retained with the verification audit fact",
    }],
    ("modern.learning.completion.verify", "body.sourceRevision"): [{
        "kind": "PERSISTED_COLUMN", "target": "prf_lrn_completion_evidence.source_revision",
        "observableAssertion": "the exact owner evidence revision is retained in the immutable completion evidence row",
    }],
    ("modern.opportunity.apply", "body.applicationStatementDigest"): [{
        "kind": "PERSISTED_DERIVED_DIGEST", "target": "prf_mkt_applications.application_statement_digest",
        "rule": "constant-time compare to the separately governed immutable statement artifact digest, then persist",
    }],
    ("modern.growth.profile.update", "body.profilePatch"): [{
        "kind": "PERSISTED_TYPED_OBJECT",
        "targets": ["prf_grw_profile_revisions.artifact_public_id", "prf_grw_profile_revisions.artifact_revision",
                    "prf_grw_profile_revisions.visibility"],
        "observableAssertion": "changing any typed member changes the immutable revision or is rejected",
    }],
    ("modern.growth.profile.update", "body.evidenceRefs"): [
        {"kind": "OWNER_REFETCH", "target": "SkillsOrLearning.Evidence.publicId[]",
         "cardinality": "ZERO_TO_100_SET", "pep": {"tenant": "authenticatedPrincipal.tenantId",
         "purpose": "hcm.growth.profile.update", "fieldExposure": ["publicId", "revision", "consentStatus"],
         "denyOnUnavailable": True}},
        {"kind": "PERSISTED_DERIVED_DIGEST", "target": "prf_grw_profile_revisions.evidence_refs_digest",
         "rule": "canonical sort exact verified public IDs then SHA-256"},
    ],
    ("modern.growth.coaching.record", "body.content"): [{
        "kind": "PERSISTED_TYPED_OBJECT",
        "targets": ["prf_grw_coaching_notes.coach_principal_public_id", "prf_grw_coaching_notes.artifact_public_id",
                    "prf_grw_coaching_notes.artifact_revision", "prf_grw_coaching_notes.employee_visible",
                    "prf_grw_coaching_notes.occurred_at"],
        "observableAssertion": "content is an immutable encrypted artifact reference, never only a digest",
    }],
    ("modern.growth.coaching.record", "body.evidenceRefs"): [
        {"kind": "OWNER_REFETCH", "target": "SkillsOrLearning.Evidence.publicId[]",
         "cardinality": "ZERO_TO_100_SET", "pep": {"tenant": "authenticatedPrincipal.tenantId",
         "purpose": "hcm.growth.coaching.record", "fieldExposure": ["publicId", "revision", "consentStatus"],
         "denyOnUnavailable": True}},
        {"kind": "PERSISTED_DERIVED_DIGEST", "target": "prf_grw_coaching_notes.evidence_refs_digest",
         "rule": "canonical sort exact verified public IDs then SHA-256"},
    ],
    ("modern.compplan.snapshot.publish", "body.lines"): [{
        "kind": "APPEND_TYPED_COLLECTION",
        "target": "prf_cmp_approved_snapshot_lines",
        "cardinality": "EXACT_REQUEST_ITEM_COUNT_1_TO_100000",
        "observableAssertion": "header line_count equals committed rows and every typed item has a canonical line digest",
    }],
    ("modern.wfm.schedule.submit", "body.evaluationReceiptId"): [{
        "kind": "OWNER_REFETCH",
        "target": "tme_wfm_constraint_evaluation_receipts.public_id",
        "selectorType": "RELATED_PARENT",
        "cardinality": "EXACTLY_ONE",
        "pep": {"tenant": "authenticatedPrincipal.tenantId", "purpose": "hcm.wfm.submit",
                "fieldExposure": ["schedule_candidate_id", "evaluation_revision", "result_digest", "blocking_violation_count"],
                "denyOnUnavailable": True},
    }],
    ("modern.wfm.forecast.create", "body.demandLines"): [{
        "kind": "APPEND_TYPED_COLLECTION", "target": "tme_wfm_demand_lines",
        "cardinality": "EXACT_REQUEST_ITEM_COUNT_1_TO_100000",
        "observableAssertion": "every validated line becomes one immutable row in canonical request order; header source digest binds the exact line set",
    }],
}

# Exact per-input physical bindings adjudicated by the reviewer.  ``PERSIST``
# means the command writes the supplied/recomputed fact in its transaction;
# ``MATCH`` means it locks an already persisted immutable fact and the domain
# mutation is conditional on an exact comparison.  This closed map exists to
# prevent generic ``aggregate.someInput`` labels from passing as causality.
REVIEWED_PERSISTENCE_BINDINGS: dict[tuple[str, str], list[dict[str, str]]] = {
    ("modern.recruiting.requisition.create", "body.employmentType"): [
        {"mode": "PERSIST", "target": "ppl_rec_requisitions.employment_type"}],
    ("modern.recruiting.requisition.publish", "body.effectiveFrom"): [
        {"mode": "MATCH", "target": "ppl_rec_requisitions.valid_from"}],
    ("modern.recruiting.requisition.publish", "body.contentDigest"): [
        {"mode": "PERSIST", "target": "ppl_rec_requisitions.content_digest",
         "expression": "DERIVE_AND_COMPARE:body.contentDigest"}],
    ("modern.recruiting.offer.issue", "body.offerVersion"): [
        {"mode": "PERSIST", "target": "ppl_rec_offers.offer_version"}],
    ("modern.recruiting.offer.issue", "body.expiresAt"): [
        {"mode": "PERSIST", "target": "ppl_rec_offers.expires_at"}],
    ("modern.recruiting.offer.issue", "body.compensationPolicyVersionId"): [
        {"mode": "PERSIST", "target": "ppl_rec_offers.compensation_policy_version_id"}],
    ("modern.recruiting.offer.issue", "body.validFrom"): [
        {"mode": "PERSIST", "target": "ppl_rec_offers.valid_from"}],
    ("modern.recruiting.hire.record", "body.reasonCode"): [
        {"mode": "PERSIST", "target": "ppl_rec_hire_requests.reason_code"},
        {"mode": "PERSIST", "target": "ppl_rec_candidate_cases.last_reason_code"}],
    ("modern.recruiting.hire.record", "body.humanDecisionReceiptId"): [
        {"mode": "PERSIST", "target": "ppl_rec_hire_requests.human_decision_receipt_public_id",
         "expression": "ownerRefetch.body.humanDecisionReceiptId.publicId"}],
    ("modern.recruiting.hire.record", "body.offerId"): [
        {"mode": "PERSIST", "target": "ppl_rec_hire_requests.offer_id",
         "expression": "selector.body.offerId.internalId"},
        {"mode": "PERSIST", "target": "ppl_rec_candidate_cases.pending_offer_id",
         "expression": "selector.body.offerId.internalId"}],
    ("modern.onboarding.template.create", "body.effectiveFrom"): [
        {"mode": "PERSIST", "target": "ppl_jny_templates.valid_from"},
        {"mode": "PERSIST", "target": "ppl_jny_template_versions.effective_from"}],
    ("modern.onboarding.template.create", "body.effectiveTo"): [
        {"mode": "PERSIST", "target": "ppl_jny_templates.valid_to"},
        {"mode": "PERSIST", "target": "ppl_jny_template_versions.effective_to"}],
    ("modern.onboarding.template.publish", "body.effectiveFrom"): [
        {"mode": "MATCH", "target": "ppl_jny_template_versions.effective_from"}],
    ("modern.onboarding.template.publish", "body.contentDigest"): [
        {"mode": "MATCH", "target": "ppl_jny_template_versions.content_digest"}],
    ("modern.onboarding.journey.cancel", "body.effectiveAt"): [
        {"mode": "PERSIST", "target": "ppl_jny_assignments.cancelled_at"}],
    ("modern.workforceplan.scenario.create", "body.effectiveTo"): [
        {"mode": "PERSIST", "target": "ppl_wfp_scenarios.valid_to"}],
    ("modern.workforceplan.scenario.simulate", "body.ruleVersion"): [
        {"mode": "PERSIST", "target": "ppl_wfp_scenario_revisions.rule_version"}],
    ("modern.workforceplan.scenario.simulate", "body.deterministicSeed"): [
        {"mode": "PERSIST", "target": "ppl_wfp_scenario_revisions.deterministic_seed"}],
    ("modern.workforceplan.scenario.submit", "body.submissionDigest"): [
        {"mode": "PERSIST", "target": "ppl_wfp_scenario_revisions.payload_digest",
         "expression": "DERIVE_AND_COMPARE:body.submissionDigest"}],
    ("modern.workforceplan.scenario.publish", "body.contentDigest"): [
        {"mode": "PERSIST", "target": "ppl_wfp_publish_receipts.payload_digest",
         "expression": "DERIVE_AND_COMPARE:body.contentDigest"}],
    ("modern.benefits.plan.publish", "body.effectiveFrom"): [
        {"mode": "MATCH", "target": "ppl_bnf_plan_versions.valid_from"}],
    ("modern.benefits.plan.publish", "body.contentDigest"): [
        {"mode": "MATCH", "target": "ppl_bnf_plan_versions.content_digest"}],
    ("modern.benefits.enrollment.submit", "body.submissionDigest"): [
        {"mode": "PERSIST", "target": "ppl_bnf_enrollments.submission_digest",
         "expression": "DERIVE_AND_COMPARE:body.submissionDigest"}],
    ("modern.benefits.lifeevent.submit", "body.submissionDigest"): [
        {"mode": "PERSIST", "target": "ppl_bnf_life_events.payload_digest",
         "expression": "DERIVE_AND_COMPARE:body.submissionDigest"}],
    ("modern.hrservice.case.triage", "body.sensitivityClass"): [
        {"mode": "PERSIST", "target": "ppl_hrs_cases.sensitivity_class"}],
    ("modern.hrservice.case.triage", "body.queueKey"): [
        {"mode": "PERSIST", "target": "ppl_hrs_cases.queue_key"}],
    ("modern.hrservice.case.triage", "body.slaPolicyVersion"): [
        {"mode": "PERSIST", "target": "ppl_hrs_cases.sla_policy_version"}],
    ("modern.hrservice.case.assign", "body.actionPayloadDigest"): [
        {"mode": "PERSIST", "target": "ppl_hrs_case_actions.payload_digest",
         "expression": "DERIVE_AND_COMPARE:body.actionPayloadDigest"}],
    ("modern.hrservice.case.assign", "body.effectiveAt"): [
        {"mode": "PERSIST", "target": "ppl_hrs_case_actions.recorded_at",
         "expression": "COALESCE(body.effectiveAt,context.ownerClock.transactionNow)"}],
    ("modern.hrservice.case.respond", "body.responseDigest"): [
        {"mode": "PERSIST", "target": "ppl_hrs_case_actions.payload_digest",
         "expression": "DERIVE_AND_COMPARE:body.responseDigest"}],
    ("modern.hrservice.case.resolve", "body.resolutionCode"): [
        {"mode": "PERSIST", "target": "ppl_hrs_cases.resolution_code"}],
    ("modern.hrservice.case.resolve", "body.responseDigest"): [
        {"mode": "PERSIST", "target": "ppl_hrs_case_actions.payload_digest",
         "expression": "DERIVE_AND_COMPARE:body.responseDigest"}],
    ("modern.contingent.engagement.submit", "body.submissionDigest"): [
        {"mode": "PERSIST", "target": "ppl_cwk_engagements.submission_digest",
         "expression": "DERIVE_AND_COMPARE:body.submissionDigest"}],
    ("modern.contingent.engagement.submit", "body.effectiveDate"): [
        {"mode": "PERSIST", "target": "ppl_cwk_engagements.effective_from"}],
    ("modern.contingent.engagement.offboard", "body.effectiveAt"): [
        {"mode": "PERSIST", "target": "ppl_cwk_engagements.offboarded_at"}],
    ("modern.contingent.engagement.close", "body.effectiveAt"): [
        {"mode": "PERSIST", "target": "ppl_cwk_engagements.closed_at"}],
    ("modern.skills.taxonomy.validate", "body.validationSuiteVersion"): [
        {"mode": "PERSIST", "target": "prf_skl_taxonomy_versions.validation_suite_version"}],
    ("modern.skills.taxonomy.validate", "body.inputDigest"): [
        {"mode": "PERSIST", "target": "prf_skl_taxonomy_versions.validation_input_digest",
         "expression": "DERIVE_AND_COMPARE:body.inputDigest"}],
    ("modern.skills.taxonomy.publish", "body.effectiveFrom"): [
        {"mode": "MATCH", "target": "prf_skl_taxonomy_versions.effective_from"}],
    ("modern.skills.taxonomy.publish", "body.contentDigest"): [
        {"mode": "MATCH", "target": "prf_skl_taxonomy_versions.content_digest"}],
    ("modern.growth.profile.create", "body.businessKey"): [
        {"mode": "PERSIST", "target": "prf_grw_profiles.profile_key"}],
    ("modern.growth.profile.create", "body.effectiveTo"): [
        {"mode": "PERSIST", "target": "prf_grw_profiles.valid_to"}],
    ("modern.growth.evidence.link", "body.evidenceDigest"): [
        {"mode": "PERSIST", "target": "prf_grw_evidence_links.payload_digest",
         "expression": "DERIVE_AND_COMPARE:body.evidenceDigest"}],
    ("modern.growth.profile.archive", "body.reasonCode"): [
        {"mode": "PERSIST", "target": "prf_grw_profiles.last_reason_code"}],
    ("modern.learning.offering.create", "body.effectiveTo"): [
        {"mode": "PERSIST", "target": "prf_lrn_offerings.valid_to"}],
    ("modern.learning.offering.publish", "body.effectiveFrom"): [
        {"mode": "MATCH", "target": "prf_lrn_offerings.valid_from"}],
    ("modern.learning.offering.publish", "body.contentDigest"): [
        {"mode": "MATCH", "target": "prf_lrn_offerings.content_digest"}],
    ("modern.learning.assignment.start", "body.startedAt"): [
        {"mode": "PERSIST", "target": "prf_lrn_assignments.started_at"}],
    ("modern.opportunity.publish", "body.contentDigest"): [
        {"mode": "MATCH", "target": "prf_mkt_opportunities.content_digest"}],
    ("modern.succession.plan.create", "body.effectiveTo"): [
        {"mode": "PERSIST", "target": "prf_suc_plans.valid_to"}],
    ("modern.succession.nomination.add", "body.evidenceDigest"): [
        {"mode": "PERSIST", "target": "prf_suc_nominations.evidence_digest",
         "expression": "DERIVE_AND_COMPARE:body.evidenceDigest"}],
    ("modern.succession.plan.submit", "body.submissionDigest"): [
        {"mode": "PERSIST", "target": "prf_suc_plans.submission_digest",
         "expression": "DERIVE_AND_COMPARE:body.submissionDigest"}],
    ("modern.succession.plan.submit", "body.effectiveDate"): [
        {"mode": "PERSIST", "target": "prf_suc_plans.submission_effective_date"}],
    ("modern.succession.plan.publish", "body.effectiveFrom"): [
        {"mode": "MATCH", "target": "prf_suc_plans.valid_from"}],
    ("modern.succession.plan.publish", "body.contentDigest"): [
        {"mode": "PERSIST", "target": "prf_suc_plans.content_digest",
         "expression": "DERIVE_AND_COMPARE:body.contentDigest"}],
    ("modern.compplan.proposal.submit", "body.submissionDigest"): [
        {"mode": "PERSIST", "target": "prf_cmp_proposals.submission_digest",
         "expression": "DERIVE_AND_COMPARE:body.submissionDigest"}],
    ("modern.compplan.proposal.submit", "body.effectiveDate"): [
        {"mode": "PERSIST", "target": "prf_cmp_proposals.effective_from",
         "expression": "COALESCE(body.effectiveDate,locked.effective_from)"}],
    ("modern.compplan.snapshot.publish", "body.contentDigest"): [
        {"mode": "PERSIST", "target": "prf_cmp_approved_snapshots.payload_digest",
         "expression": "DERIVE_AND_COMPARE:body.contentDigest canonical-header-lines"}],
    ("modern.wfm.forecast.create", "body.sourceDigest"): [
        {"mode": "PERSIST", "target": "tme_wfm_demand_forecasts.source_digest",
         "expression": "DERIVE_AND_COMPARE:body.sourceDigest+owner source"}],
    ("modern.wfm.schedule.validate", "body.validationSuiteVersion"): [
        {"mode": "PERSIST", "target": "tme_wfm_constraint_evaluation_receipts.validation_suite_version"}],
    ("modern.wfm.schedule.validate", "body.inputDigest"): [
        {"mode": "PERSIST", "target": "tme_wfm_constraint_evaluation_receipts.input_digest",
         "expression": "DERIVE_AND_COMPARE:body.inputDigest"}],
    ("modern.wfm.schedule.validate", "body.policyVersionId"): [
        {"mode": "PERSIST", "target": "tme_wfm_constraint_evaluation_receipts.policy_version_public_id",
         "expression": "ownerRefetch.body.policyVersionId.publicId"}],
    ("modern.wfm.schedule.submit", "body.submissionDigest"): [
        {"mode": "PERSIST", "target": "tme_wfm_approval_requests.submission_digest",
         "expression": "DERIVE_AND_COMPARE:body.submissionDigest"}],
    ("modern.wfm.schedule.submit", "body.effectiveDate"): [
        {"mode": "PERSIST", "target": "tme_wfm_approval_requests.effective_date",
         "expression": "COALESCE(body.effectiveDate,locked.candidate_period_start_date)"}],
    ("modern.wfm.schedule.publish", "body.approvalReceiptId"): [
        {"mode": "PERSIST", "target": "tme_wfm_schedule_publish_ledger.approval_receipt_public_id",
         "expression": "ownerRefetch.body.approvalReceiptId.publicId"}],
    ("modern.wfm.schedule.publish", "body.effectiveFrom"): [
        {"mode": "PERSIST", "target": "tme_wfm_schedule_publish_ledger.effective_from"}],
    ("modern.wfm.schedule.publish", "body.contentDigest"): [
        {"mode": "PERSIST", "target": "tme_wfm_schedule_publish_ledger.payload_digest",
         "expression": "DERIVE_AND_COMPARE:body.contentDigest"}],
    ("modern.listening.response.submit", "body.submissionDigest"): [
        {"mode": "PERSIST", "target": "sys_hris_listening_responses.payload_digest",
         "expression": "DERIVE_AND_COMPARE:body.submissionDigest"}],
    ("modern.listening.survey.publish", "body.contentDigest"): [
        {"mode": "MATCH", "target": "sys_hris_listening_surveys.content_digest"}],
    ("modern.listening.survey.close", "body.effectiveAt"): [
        {"mode": "PERSIST", "target": "sys_hris_listening_surveys.closed_at"}],
    ("modern.listening.action.complete", "body.completionEvidenceDigest"): [
        {"mode": "PERSIST", "target": "sys_hris_listening_actions.completion_evidence_digest",
         "expression": "DERIVE_AND_COMPARE:body.completionEvidenceDigest"}],
    ("modern.analytics.metric.validate", "body.validationSuiteVersion"): [
        {"mode": "PERSIST", "target": "sys_hris_metric_versions.validation_suite_version"}],
    ("modern.analytics.metric.validate", "body.inputDigest"): [
        {"mode": "PERSIST", "target": "sys_hris_metric_versions.validation_input_digest",
         "expression": "DERIVE_AND_COMPARE:body.inputDigest"}],
    ("modern.analytics.metric.publish", "body.contentDigest"): [
        {"mode": "PERSIST", "target": "sys_hris_metric_versions.payload_digest",
         "expression": "DERIVE_AND_COMPARE:body.contentDigest"}],
    ("modern.ai.assist.create", "body.instructionDigest"): [
        {"mode": "PERSIST", "target": "sys_hris_ai_provenance_receipts.input_digest",
         "expression": "DERIVE_AND_COMPARE:body.instructionDigest+source refs+policy version"}],
    ("modern.ai.policy.publish", "body.contentDigest"): [
        {"mode": "PERSIST", "target": "sys_hris_ai_policy_versions.payload_digest",
         "expression": "DERIVE_AND_COMPARE:body.contentDigest+owner approval receipt"}],
    ("modern.ai.kill.switch", "body.effectiveAt"): [
        {"mode": "PERSIST", "target": "sys_hris_ai_use_policies.suspended_at"}],
}


# Derived columns needed before a later MATCH-style publication command.  They
# are computed by the creating owner, never supplied by a caller as an output.
REVIEWED_DML_AUGMENTS: dict[str, list[dict[str, str]]] = {
    "modern.learning.offering.create": [
        {"target": "prf_lrn_offerings.content_digest", "expression": "DERIVE:canonical-offering-content"}],
    "modern.opportunity.create": [
        {"target": "prf_mkt_opportunities.content_digest", "expression": "DERIVE:canonical-opportunity-content"}],
    "modern.listening.survey.create": [
        {"target": "sys_hris_listening_surveys.content_digest", "expression": "DERIVE:canonical-survey-definition"}],
}


REVIEWED_VALUE_OBJECTS = {
    "OnboardingTemplateTask.v1": {
        "kind": "OBJECT", "additionalProperties": False,
        "fields": [
            {"name": "taskKey", "type": "STRING", "required": True},
            {"name": "title", "type": "STRING", "required": True},
            {"name": "taskType", "type": "STRING", "required": True},
            {"name": "requiredFlag", "type": "BOOLEAN", "required": True},
            {"name": "dueOffsetDays", "type": "INTEGER", "required": False},
            {"name": "completionMode", "type": "STRING", "required": True},
        ],
    },
    "BenefitCoverageOption.v1": {
        "kind": "OBJECT", "additionalProperties": False,
        "fields": [
            {"name": "coverageOptionCode", "type": "STRING", "required": True},
            {"name": "displayName", "type": "STRING", "required": True},
            {"name": "employeeContribution", "type": "DECIMAL(19,4)", "wireType": "STRING", "required": True},
            {"name": "employerContribution", "type": "DECIMAL(19,4)", "wireType": "STRING", "required": True},
            {"name": "currencyCode", "type": "STRING", "required": True},
            {"name": "payrollComponentCode", "type": "STRING", "required": True},
        ],
    },
    "GrowthProfilePatch.v1": {
        "kind": "OBJECT", "additionalProperties": False,
        "fields": [
            {"name": "artifactPublicId", "type": "UUID", "required": True,
             "referenceContract": {"entityType": "Content.ImmutableArtifact", "idSpace": "PUBLIC_UUID"}},
            {"name": "artifactRevision", "type": "BIGINT", "required": True},
            {"name": "visibility", "type": "STRING", "required": True},
        ],
    },
    "CoachingNoteContent.v1": {
        "kind": "OBJECT", "additionalProperties": False,
        "fields": [
            {"name": "coachPrincipalPublicId", "type": "UUID", "required": True,
             "referenceContract": {"entityType": "Auth.Principal", "idSpace": "PUBLIC_UUID"}},
            {"name": "artifactPublicId", "type": "UUID", "required": True,
             "referenceContract": {"entityType": "Content.ImmutableArtifact", "idSpace": "PUBLIC_UUID"}},
            {"name": "artifactRevision", "type": "BIGINT", "required": True},
            {"name": "employeeVisible", "type": "BOOLEAN", "required": True},
            {"name": "occurredAt", "type": "TIMESTAMPTZ", "required": True},
        ],
    },
    "ApprovedCompensationSnapshotLine.v1": {
        "kind": "OBJECT", "additionalProperties": False,
        "fields": [
            {"name": "workerPublicId", "type": "UUID", "required": True,
             "referenceContract": {"entityType": "HRM.Worker", "idSpace": "PUBLIC_UUID"}},
            {"name": "assignmentPublicId", "type": "UUID", "required": True,
             "referenceContract": {"entityType": "HRM.Assignment", "idSpace": "PUBLIC_UUID"}},
            {"name": "componentCode", "type": "STRING", "required": True},
            {"name": "currencyCode", "type": "STRING", "required": True},
            {"name": "approvedAmount", "type": "DECIMAL(19,4)", "wireType": "STRING", "required": True},
            {"name": "effectiveFrom", "type": "DATE", "required": True},
            {"name": "effectiveTo", "type": "DATE", "required": False},
        ],
        "serverGeneratedFields": ["publicId", "lineSequence", "lineDigest"],
    },
    "WorkforceDemandLine.v1": {
        "kind": "OBJECT", "additionalProperties": False,
        "fields": [
            {"name": "intervalStart", "type": "TIMESTAMPTZ", "required": True},
            {"name": "intervalEnd", "type": "TIMESTAMPTZ", "required": True},
            {"name": "requiredHeadcount", "type": "DECIMAL(12,4)", "wireType": "STRING", "required": True},
            {"name": "demandUnitCode", "type": "STRING", "required": True},
            {"name": "skillPublicId", "type": "UUID", "required": False,
             "referenceContract": {"entityType": "PER.Skill", "idSpace": "PUBLIC_UUID"}},
            {"name": "organizationPublicId", "type": "UUID", "required": False,
             "referenceContract": {"entityType": "HRM.Organization", "idSpace": "PUBLIC_UUID"}},
        ],
    },
}


DECISION_NAMES = {
    "decision", "reasonCode", "humanConfirmation", "completionCode", "visibility",
    "portabilityExportRequested", "selectionCode", "ledgerEntryType", "lifeEventType",
    "coverageOptionCode", "targetStage",
}


CRITICAL_DML: dict[str, list[dict[str, Any]]] = {
    "modern.benefits.lifeevent.submit": [
        {"action": "INSERT", "table": "ppl_bnf_life_events", "role": "CONCURRENCY_ROOT",
         "assignments": {"worker_public_id": "ownerRefetch.body.workerPublicId.publicId",
                         "event_type": "body.eventType", "event_date": "body.eventDate",
                         "evidence_object_ref": "body.evidenceObjectRef IF PRESENT",
                         "source_record_key": "body.sourceRecordKey",
                         "payload_digest": "DERIVE_AND_COMPARE:body.submissionDigest canonical-life-event",
                         "status": "CONSTANT:SUBMITTED", "aggregate_version": "CONSTANT:1"}},
    ],
    "modern.hrservice.case.create": [
        {"action": "INSERT", "table": "ppl_hrs_cases", "role": "CONCURRENCY_ROOT",
         "assignments": {"case_number": "body.businessKey", "display_name": "body.displayName encrypted",
                         "requester_worker_public_id": "ownerRefetch.body.requesterWorkerPublicId.publicId",
                         "sla_policy_version_id": "ownerRefetch.body.slaPolicyVersionId.publicId",
                         "queue_key": "body.queueKey", "sensitivity_class": "body.sensitivityClass",
                         "case_type": "body.caseType", "opened_at": "context.ownerClock.transactionNow",
                         "status": "CONSTANT:OPEN", "aggregate_version": "CONSTANT:1"}},
        {"action": "APPEND", "table": "ppl_hrs_case_actions", "role": "INITIAL_ACTION",
         "assignments": {"hr_case_id": "previous.ppl_hrs_cases.internalId",
                         "action_sequence": "CONSTANT:1", "action_type": "CONSTANT:CASE_CREATED",
                         "actor_public_id": "authenticatedPrincipal.publicId",
                         "payload_digest": "DERIVE:canonical-created-case-fact",
                         "recorded_at": "context.ownerClock.transactionNow", "aggregate_version": "CONSTANT:1"}},
    ],
    "modern.opportunity.create": [
        {"action": "INSERT", "table": "prf_mkt_opportunities", "role": "CONCURRENCY_ROOT",
         "assignments": {"opportunity_code": "body.businessKey", "display_name": "body.displayName",
                         "owner_org_public_id": "ownerRefetch.body.ownerOrgPublicId.publicId",
                         "open_from": "body.openFrom", "close_at": "body.closeAt IF PRESENT",
                         "status": "CONSTANT:DRAFT", "aggregate_version": "CONSTANT:1"}},
    ],
    "modern.analytics.export.create": [
        {"action": "APPEND", "table": "sys_hris_analytics_export_receipts", "role": "CONCURRENCY_ROOT",
         "assignments": {"metric_projection_ids": "SORTED:body.metricProjectionIds",
                         "metric_projection_ids_digest": "DERIVE:canonical body.metricProjectionIds",
                         "purpose_code": "body.purposeCode", "expires_at": "body.expiresAt",
                         "idempotency_key": "headers.Idempotency-Key",
                         "requested_at": "context.ownerClock.transactionNow",
                         "requester_principal_id": "authenticatedPrincipal.publicId",
                         "row_count": "DERIVE:authorized projection export rows",
                         "object_digest": "DERIVE:encrypted export object",
                         "payload_digest": "DERIVE:canonical export receipt",
                         "status": "CONSTANT:REQUESTED", "aggregate_version": "CONSTANT:1"}},
    ],
    "modern.ai.assist.create": [
        {"action": "INSERT", "table": "sys_hris_ai_provenance_receipts", "role": "CONCURRENCY_ROOT",
         "assignments": {"use_case_key": "body.useCaseKey",
                         "source_refs": "SORTED:ownerRefetch.body.sourceReferenceIds.publicIds",
                         "source_refs_digest": "DERIVE:canonical source refs",
                         "input_digest": "DERIVE_AND_COMPARE:body.instructionDigest+source refs+policy version",
                         "output_digest": "DERIVE:governed model output",
                         "payload_digest": "DERIVE:canonical provenance receipt",
                         "policy_version": "ownerRefetch.body.useCaseKey.activePolicyVersion",
                         "model_route_key": "ownerRefetch.body.useCaseKey.approvedModelRouteKey",
                         "human_confirmation_required": "body.humanConfirmation",
                         "raw_prompt_stored": "CONSTANT:false",
                         "generated_at": "context.ownerClock.transactionNow",
                         "requester_principal_id": "authenticatedPrincipal.publicId",
                         "idempotency_key": "headers.Idempotency-Key",
                         "status": "CONSTANT:PRODUCED", "aggregate_version": "CONSTANT:1"}},
    ],
    "modern.ai.policy.create": [
        {"action": "INSERT", "table": "sys_hris_ai_use_policies", "role": "CONCURRENCY_ROOT",
         "assignments": {"display_name": "body.displayName", "use_case_key": "body.useCaseKey",
                         "valid_from": "body.validFrom", "valid_to": "body.validTo IF PRESENT",
                         "owner_principal_id": "authenticatedPrincipal.publicId",
                         "policy_version": "CONSTANT:1", "status": "CONSTANT:DRAFT",
                         "aggregate_version": "CONSTANT:1"}},
        {"action": "INSERT", "table": "sys_hris_ai_policy_versions", "role": "POLICY_VERSION",
         "assignments": {"ai_use_policy_id": "previous.sys_hris_ai_use_policies.internalId",
                         "effective_from": "body.validFrom", "effective_to": "body.validTo IF PRESENT",
                         "human_control_mode": "body.humanControlMode",
                         "policy_digest": "DERIVE:canonical policy version",
                         "payload_digest": "DERIVE:canonical policy version row",
                         "version_no": "CONSTANT:1", "aggregate_version": "CONSTANT:1"}},
    ],
    "modern.recruiting.offer.issue": [
        {"action": "UPDATE_CAS", "table": "ppl_rec_candidate_cases", "role": "CONCURRENCY_ROOT",
         "assignments": {"stage": "CONSTANT:OFFERED", "aggregate_version": "PRE+1"}},
        {"action": "INSERT", "table": "ppl_rec_offers", "role": "OFFER_FACT",
         "assignments": {"candidate_case_id": "selector.pathParameters.candidateCaseId.internalId",
                         "currency_code": "body.currency", "amount": "body.amount",
                         "status": "CONSTANT:ISSUED"}},
    ],
    "modern.recruiting.hire.record": [
        {"action": "UPDATE_CAS", "table": "ppl_rec_candidate_cases", "role": "CONCURRENCY_ROOT",
         "assignments": {"stage": "CONSTANT:HIRE_PENDING", "aggregate_version": "PRE+1"}},
        {"action": "INSERT", "table": "ppl_rec_hire_requests", "role": "OWNER_HANDOFF_REQUEST",
         "assignments": {"candidate_case_id": "selector.pathParameters.candidateCaseId.internalId",
                         "offer_id": "selector.body.offerId.internalId",
                         "effective_date": "body.effectiveDate", "status": "CONSTANT:PENDING",
                         "request_digest": "DERIVE:canonical-hire-proposal"}},
    ],
    "modern.skills.evidence.verify": [
        {"action": "UPDATE_CAS", "table": "prf_skl_worker_evidence", "role": "CONCURRENCY_ROOT",
         "assignments": {"status": "CONSTANT:VERIFIED",
                         "verification_receipt_public_id": "ownerRefetch.body.verificationReceiptId.publicId",
                         "verification_reason_code": "body.reasonCode",
                         "verified_at": "ownerRefetch.body.verificationReceiptId.verifiedAt",
                         "aggregate_version": "PRE+1"},
         "guards": ["locked.status = PENDING", "body.evidenceDigest = locked.evidence_digest",
                    "body.sourceRevision = locked.source_revision",
                    "owner receipt evidencePublicId/digest/sourceRevision/outcome = locked root/VERIFIED"]},
    ],
    "modern.learning.offering.create": [
        {"action": "INSERT", "table": "prf_lrn_offerings", "role": "CONCURRENCY_ROOT",
         "assignments": {"offering_code": "body.businessKey", "display_name": "body.displayName",
                         "provider_public_id": "ownerRefetch.body.providerPublicId.publicId",
                         "valid_from": "body.effectiveFrom", "valid_to": "body.effectiveTo IF PRESENT",
                         "status": "CONSTANT:DRAFT"}},
    ],
    "modern.learning.self.enroll": [
        {"action": "INSERT", "table": "prf_lrn_assignments", "role": "CONCURRENCY_ROOT",
         "assignments": {"learning_offering_id": "selector.body.offeringId.internalId",
                         "worker_public_id": "ownerRefetch.body.workerPublicId.publicId",
                         "assigned_at": "context.ownerClock.transactionNow",
                         "assignment_revision": "CONSTANT:1", "effective_from": "body.effectiveFrom",
                         "consent_revision": "body.consentRevision", "status": "CONSTANT:ENROLLED"},
         "guards": ["selected offering.status = PUBLISHED",
                    "effectiveFrom within selected offering half-open validity",
                    "worker self/proxy authorization re-evaluated"]},
    ],
    "modern.learning.completion.verify": [
        {"action": "UPDATE_CAS", "table": "prf_lrn_assignments", "role": "CONCURRENCY_ROOT",
         "assignments": {"status": "CONSTANT:COMPLETED",
                         "completed_at": "ownerRefetch.body.evidencePublicId.completedAt",
                         "assignment_revision": "PRE+1", "aggregate_version": "PRE+1"}},
        {"action": "APPEND", "table": "prf_lrn_completion_evidence", "role": "IMMUTABLE_COMPLETION_EVIDENCE",
         "assignments": {"learning_assignment_id": "selector.pathParameters.assignmentId.internalId",
                         "completion_revision": "locked.prf_lrn_assignments.assignment_revision+1",
                         "source_receipt_id": "ownerRefetch.body.evidencePublicId.publicId",
                         "source_revision": "body.sourceRevision",
                         "evidence_digest": "DERIVE_AND_COMPARE:body.evidenceDigest",
                         "payload_digest": "ownerRefetch.body.evidencePublicId.payloadDigest",
                         "completed_at": "ownerRefetch.body.evidencePublicId.completedAt",
                         "verified_at": "context.ownerClock.transactionNow",
                         "skill_evidence_ids": "ownerRefetch.body.evidencePublicId.skillEvidenceIds"},
         "guards": ["owner evidence digest/revision/assignment match", "owner verification status is VERIFIED"]},
    ],
    "modern.opportunity.apply": [
        {"action": "INSERT", "table": "prf_mkt_applications", "role": "CONCURRENCY_ROOT",
         "assignments": {"internal_opportunity_id": "selector.pathParameters.opportunityId.internalId",
                         "worker_public_id": "ownerRefetch.body.workerPublicId.publicId",
                         "applied_at": "context.ownerClock.transactionNow",
                         "application_statement_digest": "DERIVE_AND_COMPARE:body.applicationStatementDigest",
                         "consent_revision": "body.consentRevision", "status": "CONSTANT:APPLIED"},
         "guards": ["selected opportunity.status = OPEN", "selected opportunity availability includes owner clock",
                    "worker self/proxy authorization re-evaluated"]},
    ],
    "modern.onboarding.template.create": [
        {"action": "INSERT", "table": "ppl_jny_templates", "role": "TEMPLATE_IDENTITY",
         "assignments": {"template_key": "body.businessKey", "display_name": "body.displayName",
                         "config_scope_public_id": "ownerRefetch.body.configScopePublicId.publicId",
                         "valid_from": "body.effectiveFrom", "valid_to": "body.effectiveTo",
                         "status": "CONSTANT:DRAFT"}},
        {"action": "INSERT", "table": "ppl_jny_template_versions", "role": "VERSION_ROOT",
         "assignments": {"journey_template_id": "previous.ppl_jny_templates.internalId",
                         "version_no": "CONSTANT:1", "status": "CONSTANT:DRAFT",
                         "effective_from": "body.effectiveFrom",
                         "effective_to": "body.effectiveTo",
                         "task_definitions": "body.tasks",
                         "content_digest": "DERIVE:canonical-body.tasks"}},
    ],
    "modern.onboarding.template.publish": [
        {"action": "UPDATE_CAS", "table": "ppl_jny_template_versions", "role": "CONCURRENCY_ROOT",
         "assignments": {"status": "CONSTANT:PUBLISHED", "aggregate_version": "PRE+1"}},
    ],
    "modern.onboarding.journey.assign": [
        {"action": "INSERT", "table": "ppl_jny_assignments", "role": "ASSIGNMENT_ROOT",
         "assignments": {"journey_template_id": "selector.body.templateVersionId.journey_template_id",
                         "journey_template_version_id": "selector.body.templateVersionId.internalId",
                         "worker_public_id": "ownerRefetch.body.workerPublicId.publicId",
                         "assigned_at": "context.ownerClock.transactionNow", "due_at": "body.dueAt",
                         "assignment_revision": "CONSTANT:1", "status": "CONSTANT:ASSIGNED"}},
        {"action": "INSERT_MANY", "table": "ppl_jny_assignment_tasks", "role": "SNAPSHOTTED_TASKS",
         "assignments": {"journey_assignment_id": "previous.ppl_jny_assignments.internalId",
                         "task_key": "locked.templateVersion.tasks[*].taskKey",
                         "required_flag": "locked.templateVersion.tasks[*].requiredFlag",
                         "status": "CONSTANT:PENDING"}},
    ],
    "modern.onboarding.task.complete": [
        {"action": "UPDATE_CAS", "table": "ppl_jny_assignment_tasks", "role": "CONCURRENCY_ROOT",
         "assignments": {"status": "DERIVE:task-post-status", "aggregate_version": "PRE+1"}},
        {"action": "APPEND", "table": "ppl_jny_task_evidence", "role": "IMMUTABLE_EVIDENCE",
         "assignments": {"journey_assignment_id": "selector.pathParameters.assignmentId.internalId",
                         "task_key": "locked.ppl_jny_assignment_tasks.task_key",
                         "completion_revision": "locked.ppl_jny_assignment_tasks.aggregate_version+1",
                         "evidence_digest": "DERIVE_AND_COMPARE:body.evidenceDigest+body.objectRef",
                         "object_ref": "body.objectRef", "payload_digest": "body.evidenceDigest",
                         "recorded_at": "body.completedAt"}},
        {"action": "UPDATE_CAS", "table": "ppl_jny_assignments", "role": "PARENT_REDUCTION",
         "assignments": {"status": "DERIVE:all-required-tasks-complete", "aggregate_version": "PRE+1"}},
    ],
    "modern.benefits.plan.create": [
        {"action": "INSERT", "table": "ppl_bnf_plans", "role": "PLAN_IDENTITY",
         "assignments": {"plan_code": "body.businessKey", "display_name": "body.displayName",
                         "eligibility_policy_version_id": "ownerRefetch.body.eligibilityPolicyVersionId.publicId",
                         "valid_from": "body.effectiveFrom", "valid_to": "body.effectiveTo",
                         "status": "CONSTANT:DRAFT"}},
        {"action": "INSERT", "table": "ppl_bnf_plan_versions", "role": "VERSION_ROOT",
         "assignments": {"benefit_plan_id": "previous.ppl_bnf_plans.internalId", "version_no": "CONSTANT:1",
                         "eligibility_policy_version_id": "ownerRefetch.body.eligibilityPolicyVersionId.publicId",
                         "enrollment_window_policy_version_id": "ownerRefetch.body.enrollmentWindowPolicyVersionId.publicId",
                         "valid_from": "body.effectiveFrom", "valid_to": "body.effectiveTo",
                         "coverage_options": "body.coverageOptions",
                         "coverage_configuration_digest": "DERIVE:canonical-body.coverageOptions",
                         "delivery_mode": "body.deliveryMode",
                         "provider_config_version_id": "ownerRefetch.body.providerConfigVersionId.publicId IF PRESENT",
                         "payroll_treatment_code": "body.payrollTreatmentCode", "status": "CONSTANT:DRAFT",
                         "content_digest": "DERIVE:canonical-version-content"}},
    ],
    "modern.benefits.plan.publish": [
        {"action": "UPDATE_CAS", "table": "ppl_bnf_plan_versions", "role": "CONCURRENCY_ROOT",
         "assignments": {"status": "CONSTANT:PUBLISHED", "aggregate_version": "PRE+1"}},
    ],
    "modern.benefits.enrollment.submit": [
        {"action": "INSERT", "table": "ppl_bnf_enrollments", "role": "ENROLLMENT_ROOT",
         "assignments": {"benefit_plan_id": "selector.body.benefitPlanId.internalId",
                         "benefit_plan_version_id": "selector.body.benefitPlanVersionId.internalId",
                         "worker_public_id": "ownerRefetch.body.workerPublicId.publicId",
                         "coverage_level": "body.coverageOptionCode", "effective_from": "body.effectiveDate",
                         "dependent_tokens": "body.dependentTokens IF PRESENT",
                         "life_event_id": "selector.body.lifeEventId.internalId IF PRESENT",
                         "submission_digest": "DERIVE_AND_COMPARE:body.submissionDigest",
                         "status": "CONSTANT:SUBMITTED"}},
    ],
    "modern.growth.profile.update": [
        {"action": "APPEND", "table": "prf_grw_profile_revisions", "role": "IMMUTABLE_PROFILE_REVISION",
         "assignments": {"growth_profile_id": "selector.pathParameters.profileId.internalId",
                         "profile_revision": "locked.prf_grw_profiles.profile_version+1",
                         "artifact_public_id": "successor.body.profilePatch.artifactPublicId",
                         "artifact_revision": "successor.body.profilePatch.artifactRevision",
                         "visibility": "successor.body.profilePatch.visibility",
                         "evidence_refs_digest": "DERIVE:canonical-sorted-evidence-refs",
                         "recorded_at": "context.ownerClock.transactionNow"}},
        {"action": "UPDATE_CAS", "table": "prf_grw_profiles", "role": "CONCURRENCY_ROOT",
         "assignments": {"status": "CONSTANT:ACTIVE", "profile_version": "PRE+1",
                         "aggregate_version": "PRE+1"}},
    ],
    "modern.growth.coaching.record": [
        {"action": "INSERT", "table": "prf_grw_coaching_notes", "role": "IMMUTABLE_COACHING_NOTE",
         "assignments": {"growth_profile_id": "selector.pathParameters.profileId.internalId",
                         "coach_principal_public_id": "successor.body.content.coachPrincipalPublicId",
                         "artifact_public_id": "successor.body.content.artifactPublicId",
                         "artifact_revision": "successor.body.content.artifactRevision",
                         "employee_visible": "successor.body.content.employeeVisible",
                         "occurred_at": "successor.body.content.occurredAt",
                         "evidence_refs_digest": "DERIVE:canonical-sorted-body.evidenceRefs",
                         "status": "CONSTANT:RECORDED"}},
        {"action": "UPDATE_CAS", "table": "prf_grw_profiles", "role": "CONCURRENCY_ROOT",
         "assignments": {"status": "CONSTANT:ACTIVE", "profile_version": "PRE+1",
                         "aggregate_version": "PRE+1"}},
    ],
    "modern.growth.profile.archive": [
        {"action": "UPDATE_CAS", "table": "prf_grw_profiles", "role": "CONCURRENCY_ROOT",
         "assignments": {"status": "CONSTANT:ARCHIVED", "archived_at": "context.ownerClock.transactionNow",
                         "profile_version": "PRE+1", "aggregate_version": "PRE+1"}},
    ],
    "modern.compplan.proposal.submit": [
        {"action": "UPDATE_CAS", "table": "prf_cmp_proposals", "role": "CONCURRENCY_ROOT",
         "assignments": {"status": "CONSTANT:SUBMITTED", "submitted_at": "context.ownerClock.transactionNow",
                         "effective_from": "COALESCE(body.effectiveDate,locked.effective_from)",
                         "aggregate_version": "PRE+1"}},
    ],
    "modern.compplan.plan.approve": [
        {"action": "UPDATE_CAS", "table": "prf_cmp_cycles", "role": "CONCURRENCY_ROOT",
         "assignments": {"status": "CONSTANT:APPROVED", "last_reason_code": "body.reasonCode",
                         "aggregate_version": "PRE+1"}},
        {"action": "INSERT", "table": "prf_cmp_plans", "role": "IMMUTABLE_APPROVED_PLAN_HEADER",
         "assignments": {"compensation_cycle_id": "selector.pathParameters.cycleId.internalId",
                         "cycle_public_id": "selector.pathParameters.cycleId.publicId",
                         "approval_receipt_public_id": "ownerRefetch.body.approvalReceiptId.publicId",
                         "approval_revision": "ownerRefetch.body.approvalReceiptId.decisionVersion",
                         "approval_outcome": "ownerRefetch.body.approvalReceiptId.outcome APPROVED",
                         "plan_revision": "ALLOCATE:cycle-approved-plan-revision+1",
                         "content_digest": "DERIVE:canonical-cycle-proposals+approval-receipt",
                         "approved_at": "context.ownerClock.transactionNow", "status": "CONSTANT:APPROVED"}},
    ],
    "modern.compplan.snapshot.publish": [
        {"action": "UPDATE_CAS", "table": "prf_cmp_cycles", "role": "CONCURRENCY_ROOT",
         "assignments": {"status": "CONSTANT:PUBLISHED", "aggregate_version": "PRE+1"}},
        {"action": "INSERT", "table": "prf_cmp_approved_snapshots", "role": "IMMUTABLE_HEADER",
         "assignments": {"compensation_cycle_id": "selector.pathParameters.cycleId.internalId",
                         "compensation_plan_id": "selector.body.planPublicId.internalId",
                         "cycle_public_id": "selector.pathParameters.cycleId.publicId",
                         "plan_public_id": "selector.body.planPublicId.publicId",
                         "approval_receipt_id": "ownerRefetch.body.approvalReceiptId.publicId",
                         "approval_revision": "ownerRefetch.body.approvalReceiptId.decisionVersion",
                         "effective_from": "body.effectiveFrom",
                         "recorded_at": "context.ownerClock.transactionNow",
                         "snapshot_revision": "ALLOCATE:locked-cycle-snapshot-revision+1",
                         "source_version": "locked.prf_cmp_plans.plan_revision",
                         "line_count": "DERIVE:validated-lines-row-count",
                         "payload_digest": "DERIVE_AND_COMPARE:body.contentDigest canonical-header-lines",
                         "status": "CONSTANT:PUBLISHED"}},
        {"action": "APPEND_MANY", "table": "prf_cmp_approved_snapshot_lines", "role": "IMMUTABLE_LINES",
         "assignments": {"approved_compensation_snapshot_id": "previous.prf_cmp_approved_snapshots.internalId",
                         "line_sequence": "DERIVE:stable-canonical-line-order",
                         "worker_public_id": "successor.body.lines[*].workerPublicId owner-refetched",
                         "assignment_public_id": "successor.body.lines[*].assignmentPublicId owner-refetched",
                         "component_code": "successor.body.lines[*].componentCode configured version",
                         "currency_code": "successor.body.lines[*].currencyCode currency authority",
                         "approved_amount": "successor.body.lines[*].approvedAmount NUMERIC(19,4)",
                         "effective_from": "successor.body.lines[*].effectiveFrom",
                         "effective_to": "successor.body.lines[*].effectiveTo",
                         "line_digest": "DERIVE:canonical-typed-line-digest"}},
    ],
    "modern.wfm.forecast.create": [
        {"action": "UPSERT", "table": "tme_wfm_forecast_revision_counters", "role": "REVISION_COUNTER",
         "assignments": {"forecast_key": "body.businessKey", "last_revision": "ALLOCATE:locked-last+1"}},
        {"action": "INSERT", "table": "tme_wfm_demand_forecasts", "role": "FORECAST_ROOT",
         "assignments": {"forecast_key": "body.businessKey", "display_name": "body.displayName",
                         "worksite_public_id": "ownerRefetch.body.worksitePublicId.publicId",
                         "demand_source_id": "ownerRefetch.body.demandSourceId.publicId",
                         "source_timezone": "body.sourceTimezone", "period_start": "body.periodStart",
                         "period_end": "body.periodEnd", "forecast_revision": "previous.counter.last_revision",
                         "source_digest": "DERIVE_AND_COMPARE:body.sourceDigest+ownerRefetch.body.demandSourceId",
                         "status": "CONSTANT:DRAFT", "aggregate_version": "CONSTANT:1"}},
        {"action": "INSERT_MANY", "table": "tme_wfm_demand_lines", "role": "TYPED_DEMAND_LINES",
         "assignments": {"demand_forecast_id": "previous.tme_wfm_demand_forecasts.internalId",
                         "line_key": "DERIVE:canonical body.demandLines[*] identity",
                         "starts_at": "body.demandLines[*].intervalStart",
                         "ends_at": "body.demandLines[*].intervalEnd",
                         "required_headcount": "body.demandLines[*].requiredHeadcount",
                         "required_skills": "DERIVE:typed body.demandLines[*] demandUnitCode+skillPublicId+organizationPublicId"}},
    ],
    "modern.wfm.schedule.optimize": [
        {"action": "INSERT", "table": "tme_wfm_optimization_requests", "role": "ASYNC_REQUEST_ROOT",
         "assignments": {"demand_forecast_id": "selector.pathParameters.forecastId.internalId",
                         "input_snapshot_id": "ownerRefetch.body.inputSnapshotId.publicId",
                         "rule_version": "body.ruleVersion",
                         "deterministic_seed": "body.deterministicSeed",
                         "fairness_evaluation_id": "ownerRefetch.body.fairnessEvaluationId.publicId",
                         "availability_snapshot_id": "ownerRefetch.body.availabilitySnapshotId.publicId",
                         "period_start": "body.periodStart",
                         "period_end": "body.periodEnd",
                         "request_digest": "DERIVE:canonical-forecast+snapshots+rule+period+seed",
                         "status": "CONSTANT:REQUESTED"}},
    ],
    "modern.wfm.schedule.validate": [
        {"action": "APPEND", "table": "tme_wfm_constraint_evaluation_receipts", "role": "EVALUATION_RECEIPT",
         "assignments": {"schedule_candidate_id": "selector.pathParameters.candidateId.internalId",
                         "candidate_revision": "locked.candidate_revision",
                         "candidate_digest": "locked.candidate_digest",
                         "evaluation_revision": "locked.last_evaluation_revision+1",
                         "policy_version_public_id": "ownerRefetch.constraintPolicyRef.publicId",
                         "policy_revision": "ownerRefetch.constraintPolicyRef.revision",
                         "policy_digest": "ownerRefetch.constraintPolicyRef.contentSha256",
                         "planning_input_snapshot_id": "locked.planning_input_snapshot_id",
                         "evaluated_at": "context.ownerClock.transactionNow",
                         "validation_status": "ENGINE:PASS_OR_FAIL",
                         "blocking_violation_count": "ENGINE:count(blocking lines)",
                         "fairness_metric_count": "ENGINE:count(fairness values)",
                         "result_digest": "DERIVE:canonical-evaluation-result"}},
        {"action": "APPEND_MANY", "table": "tme_wfm_constraint_violation_lines", "role": "VIOLATION_LINES",
         "assignments": {"constraint_evaluation_receipt_id": "previous.evaluationReceipt.internalId",
                         "rule_key": "ENGINE:violations[*].ruleKey", "severity": "ENGINE:violations[*].severity",
                         "shift_line_key": "ENGINE:violations[*].shiftLineKey",
                         "demand_line_key": "ENGINE:violations[*].demandLineKey",
                         "expected_value": "ENGINE:violations[*].expectedValue",
                         "actual_value": "ENGINE:violations[*].actualValue"}},
        {"action": "APPEND_MANY", "table": "tme_wfm_fairness_measure_values", "role": "FAIRNESS_VALUES",
         "assignments": {"constraint_evaluation_receipt_id": "previous.evaluationReceipt.internalId",
                         "measure_key": "ENGINE:fairnessMeasures[*].measureKey",
                         "measure_value": "ENGINE:fairnessMeasures[*].measureValue",
                         "accepted_bound": "ENGINE:fairnessMeasures[*].acceptedBound",
                         "result": "ENGINE:fairnessMeasures[*].result"}},
        {"action": "UPDATE_CAS", "table": "tme_wfm_schedule_candidates", "role": "CONCURRENCY_ROOT",
         "assignments": {"status": "DERIVE:blocking-violations", "aggregate_version": "PRE+1"}},
    ],
    "modern.wfm.schedule.submit": [
        {"action": "UPDATE_CAS", "table": "tme_wfm_schedule_candidates", "role": "CONCURRENCY_ROOT",
         "assignments": {"status": "CONSTANT:SUBMITTED", "aggregate_version": "PRE+1"}},
        {"action": "INSERT", "table": "tme_wfm_approval_requests", "role": "APPROVAL_REQUEST",
         "assignments": {"schedule_candidate_id": "selector.pathParameters.candidateId.internalId",
                         "candidate_revision": "locked.candidate_revision",
                         "constraint_evaluation_receipt_id": "ownerRefetch.body.evaluationReceiptId.internalId",
                         "candidate_digest": "locked.candidate_digest", "status": "CONSTANT:REQUESTED"}},
    ],
    "modern.wfm.schedule.publish": [
        {"action": "CALL_OWNER_PORT", "table": "TIM.CanonicalSchedulePublicationPort.v1", "role": "CANONICAL_PUBLICATION"},
        {"action": "APPEND", "table": "tme_wfm_schedule_publish_ledger", "role": "PUBLICATION_LEDGER",
         "assignments": {"schedule_candidate_id": "selector.pathParameters.candidateId.internalId",
                         "candidate_revision": "locked.candidate_revision",
                         "candidate_digest": "locked.candidate_digest",
                         "approval_receipt_public_id": "ownerRefetch.approvalReceiptPublicId.publicId",
                         "canonical_schedule_period_public_id": "ownerAck.canonicalSchedulePeriodPublicId",
                         "published_at": "context.ownerClock.transactionNow",
                         "published_by": "authenticatedPrincipal.publicId"}},
        {"action": "UPDATE_CAS", "table": "tme_wfm_schedule_candidates", "role": "CONCURRENCY_ROOT",
         "assignments": {"status": "CONSTANT:PUBLISHED", "aggregate_version": "PRE+1"}},
    ],
    "modern.analytics.metric.publish": [
        {"action": "UPDATE_CAS", "table": "sys_hris_metric_versions", "role": "CONCURRENCY_ROOT",
         "assignments": {"status": "CONSTANT:PUBLISHED",
                         "approval_receipt_public_id": "ownerRefetch.body.approvalReceiptId.publicId",
                         "effective_from": "body.effectiveFrom",
                         "payload_digest": "DERIVE_AND_COMPARE:body.contentDigest",
                         "published_at": "context.ownerClock.transactionNow",
                         "aggregate_version": "PRE+1"}},
    ],
    "modern.analytics.metric.retire": [
        {"action": "UPDATE_CAS", "table": "sys_hris_metric_definitions", "role": "CONCURRENCY_ROOT",
         "assignments": {"status": "CONSTANT:RETIRED", "valid_to": "body.effectiveAt",
                         "last_reason_code": "body.reasonCode", "aggregate_version": "PRE+1"}},
        {"action": "UPDATE", "table": "sys_hris_metric_versions", "role": "ACTIVE_VERSION_CLOSE",
         "assignments": {"effective_to": "body.effectiveAt"}},
    ],
    "modern.ai.policy.evaluate": [
        {"action": "INSERT", "table": "sys_hris_ai_evaluation_requests", "role": "ASYNC_REQUEST_ROOT",
         "assignments": {"ai_use_policy_id": "selector.pathParameters.policyId.internalId",
                         "policy_version": "locked.sys_hris_ai_use_policies.policy_version",
                         "evaluation_suite_version": "body.evaluationSuiteVersion",
                         "fixture_set_digest": "body.fixtureSetDigest",
                         "model_route_key": "body.modelRouteKey",
                         "request_digest": "DERIVE:canonical-policy-version+suite+fixture+model-route",
                         "status": "CONSTANT:REQUESTED"}},
    ],
    "modern.ai.policy.publish": [
        {"action": "UPDATE_CAS", "table": "sys_hris_ai_use_policies", "role": "CONCURRENCY_ROOT",
         "assignments": {"status": "CONSTANT:ACTIVE",
                         "valid_from": "body.effectiveFrom",
                         "aggregate_version": "PRE+1"}},
        {"action": "UPDATE", "table": "sys_hris_ai_policy_versions", "role": "SELECTED_VERSION_ACTIVATION",
         "assignments": {"effective_from": "body.effectiveFrom",
                         "payload_digest": "DERIVE_AND_COMPARE:body.contentDigest+ownerRefetch.body.approvalReceiptId"}},
    ],
    "modern.ai.policy.retire": [
        {"action": "UPDATE_CAS", "table": "sys_hris_ai_use_policies", "role": "CONCURRENCY_ROOT",
         "assignments": {"status": "CONSTANT:RETIRED", "valid_to": "body.effectiveAt",
                         "last_reason_code": "body.reasonCode", "aggregate_version": "PRE+1"}},
        {"action": "UPDATE", "table": "sys_hris_ai_policy_versions", "role": "ACTIVE_VERSION_CLOSE",
         "assignments": {"effective_to": "body.effectiveAt"}},
    ],
}


FORCED_INSERT = {
    ("modern.workforceplan.scenario.create", "ppl_wfp_scenario_revisions"),
    ("modern.hrservice.case.create", "ppl_hrs_case_actions"),
    ("modern.skills.taxonomy.create", "prf_skl_taxonomy_versions"),
    ("modern.growth.profile.create", "prf_grw_aspirations"),
    ("modern.analytics.metric.create", "sys_hris_metric_versions"),
    ("modern.ai.policy.create", "sys_hris_ai_policy_versions"),
    ("modern.learning.self.enroll", "prf_lrn_assignments"),
    ("modern.opportunity.apply", "prf_mkt_applications"),
}


FORBIDDEN_EDGE_REASONS = {
    ("modern.recruiting.hire.record", "ppl_rec_hire_handoff_receipts"):
        "owner ack, not the public request transaction, creates the receipt and CandidateHired fact",
    ("modern.learning.offering.create", "prf_lrn_assignments"):
        "creating a catalog offering cannot enroll or assign a worker",
    ("modern.opportunity.create", "prf_mkt_applications"):
        "creating an opportunity cannot create an application",
    ("modern.wfm.schedule.optimize", "tme_wfm_schedule_publish_ledger"):
        "optimization cannot publish a canonical schedule",
    ("modern.wfm.schedule.submit", "tme_wfm_constraint_evaluation_receipts"):
        "submission must select the exact existing passing evaluation receipt; it cannot fabricate a new validation fact",
}


# Reviewer-owned operation-specific vocabulary.  It is intentionally written
# here rather than imported from the candidate implementation.
PRIMARY_EVENT_NAMES = {
    "modern.recruiting.requisition.create": "RequisitionCreated.v2",
    "modern.recruiting.requisition.publish": "RequisitionPublished.v2",
    "modern.recruiting.candidate.stage": "CandidateStageChanged.v2",
    "modern.recruiting.offer.issue": "CandidateOfferIssued.v2",
    "modern.recruiting.hire.record": "CandidateHireHandoffRequested.v2",
    "modern.onboarding.template.create": "OnboardingTemplateCreated.v2",
    "modern.onboarding.template.publish": "OnboardingTemplatePublished.v2",
    "modern.onboarding.journey.assign": "OnboardingJourneyAssigned.v2",
    "modern.onboarding.task.complete": "OnboardingTaskCompleted.v2",
    "modern.onboarding.journey.cancel": "OnboardingJourneyCancelled.v2",
    "modern.workforceplan.scenario.create": "WorkforceScenarioCreated.v2",
    "modern.workforceplan.scenario.simulate": "WorkforceScenarioSimulated.v2",
    "modern.workforceplan.scenario.submit": "WorkforceScenarioSubmitted.v2",
    "modern.workforceplan.scenario.approve": "WorkforceScenarioDecisionRecorded.v2",
    "modern.workforceplan.scenario.publish": "WorkforceScenarioPublished.v2",
    "modern.benefits.plan.create": "BenefitPlanCreated.v2",
    "modern.benefits.plan.publish": "BenefitPlanPublished.v2",
    "modern.benefits.enrollment.submit": "BenefitEnrollmentSubmitted.v2",
    "modern.benefits.lifeevent.submit": "BenefitLifeEventSubmitted.v2",
    "modern.benefits.enrollment.decide": "BenefitEnrollmentDecided.v2",
    "modern.hrservice.case.create": "HrServiceCaseCreated.v2",
    "modern.hrservice.case.triage": "HrServiceCaseTriaged.v2",
    "modern.hrservice.case.assign": "HrServiceCaseAssigned.v2",
    "modern.hrservice.case.respond": "HrServiceCaseResponseRecorded.v2",
    "modern.hrservice.case.resolve": "HrServiceCaseResolved.v2",
    "modern.contingent.engagement.create": "ContingentEngagementCreated.v2",
    "modern.contingent.engagement.submit": "ContingentEngagementSubmitted.v2",
    "modern.contingent.engagement.activate": "ContingentEngagementActivated.v2",
    "modern.contingent.engagement.offboard": "ContingentEngagementOffboardingStarted.v2",
    "modern.contingent.engagement.close": "ContingentEngagementClosed.v2",
    "modern.skills.taxonomy.create": "SkillsTaxonomyCreated.v2",
    "modern.skills.taxonomy.validate": "SkillsTaxonomyValidated.v2",
    "modern.skills.taxonomy.publish": "SkillsTaxonomyPublished.v2",
    "modern.skills.evidence.verify": "WorkerSkillEvidenceVerified.v2",
    "modern.growth.profile.create": "GrowthProfileCreated.v2",
    "modern.growth.profile.update": "GrowthProfileUpdated.v2",
    "modern.growth.evidence.link": "GrowthEvidenceLinked.v2",
    "modern.growth.coaching.record": "GrowthCoachingRecorded.v2",
    "modern.growth.profile.archive": "GrowthProfileArchived.v2",
    "modern.learning.offering.create": "LearningOfferingCreated.v2",
    "modern.learning.offering.publish": "LearningOfferingPublished.v2",
    "modern.learning.self.enroll": "LearningEnrollmentCreated.v2",
    "modern.learning.assignment.start": "LearningAssignmentStarted.v2",
    "modern.learning.completion.verify": "LearningCompletionVerified.v2",
    "modern.opportunity.create": "TalentOpportunityCreated.v2",
    "modern.opportunity.publish": "TalentOpportunityPublished.v2",
    "modern.opportunity.apply": "TalentOpportunityApplicationSubmitted.v2",
    "modern.opportunity.shortlist": "TalentOpportunityApplicationShortlisted.v2",
    "modern.opportunity.selection.record": "TalentOpportunitySelectionRecorded.v2",
    "modern.succession.plan.create": "SuccessionPlanCreated.v2",
    "modern.succession.nomination.add": "SuccessionNominationAdded.v2",
    "modern.succession.plan.submit": "SuccessionPlanSubmitted.v2",
    "modern.succession.plan.approve": "SuccessionPlanApproved.v2",
    "modern.succession.plan.publish": "SuccessionPlanPublished.v2",
    "modern.compplan.cycle.create": "CompensationCycleCreated.v2",
    "modern.compplan.budget.allocate": "CompensationBudgetAllocated.v2",
    "modern.compplan.proposal.submit": "CompensationProposalSubmitted.v2",
    "modern.compplan.plan.approve": "CompensationPlanApprovalRecorded.v2",
    "modern.compplan.snapshot.publish": "ApprovedCompensationPlanSnapshotPublished.v2",
    "modern.wfm.forecast.create": "WorkforceDemandForecastCreated.v2",
    "modern.wfm.schedule.optimize": "WorkforceScheduleOptimizationRequested.v2",
    "modern.wfm.schedule.validate": "WorkforceScheduleValidationCompleted.v2",
    "modern.wfm.schedule.submit": "WorkforceScheduleCandidateSubmitted.v2",
    "modern.wfm.schedule.publish": "WorkforceSchedulePublished.v2",
    "modern.listening.response.submit": "EmployeeListeningResponseSubmitted.v2",
    "modern.listening.survey.create": "EmployeeListeningSurveyCreated.v2",
    "modern.listening.survey.publish": "EmployeeListeningSurveyPublished.v2",
    "modern.listening.survey.close": "EmployeeListeningSurveyClosed.v2",
    "modern.listening.action.create": "EmployeeListeningActionCreated.v2",
    "modern.listening.action.complete": "EmployeeListeningActionCompleted.v2",
    "modern.analytics.metric.create": "PeopleMetricCreated.v2",
    "modern.analytics.metric.validate": "PeopleMetricValidated.v2",
    "modern.analytics.metric.publish": "PeopleMetricPublished.v2",
    "modern.analytics.export.create": "PeopleAnalyticsExportRequested.v2",
    "modern.analytics.metric.retire": "PeopleMetricRetired.v2",
    "modern.ai.assist.create": "GovernedAiAssistanceProduced.v2",
    "modern.ai.policy.create": "GovernedAiPolicyCreated.v2",
    "modern.ai.policy.evaluate": "GovernedAiPolicyEvaluationRequested.v2",
    "modern.ai.policy.publish": "GovernedAiPolicyPublished.v2",
    "modern.ai.kill.switch": "GovernedAiPolicySuspended.v2",
    "modern.ai.policy.retire": "GovernedAiPolicyRetired.v2",
}


EVENT_OVERRIDES: dict[str, list[dict[str, Any]]] = {
    "modern.onboarding.task.complete": [
        {"name": "OnboardingTaskCompleted.v2", "condition": "ALWAYS"},
        {"name": "OnboardingJourneyCompleted.v2", "condition": "ALL_REQUIRED_TASKS_COMPLETE"},
    ],
    "modern.wfm.schedule.optimize": [
        {"name": "WorkforceScheduleOptimizationRequested.v2", "condition": "ALWAYS"},
    ],
    "modern.wfm.schedule.publish": [
        {"name": "WorkforceSchedulePublished.v2", "condition": "OWNER_PUBLICATION_ACKNOWLEDGED"},
    ],
}


CRITICAL_EVENT_FIELDS = {
    "CandidateHireHandoffRequested.v2": {
        "hireRequestId": "ppl_rec_hire_requests.public_id",
        "candidateCaseId": "ppl_rec_candidate_cases.public_id",
        "offerId": "ppl_rec_offers.public_id",
        "requestedEffectiveDate": "ppl_rec_hire_requests.effective_date",
        "candidateVersion": "ppl_rec_candidate_cases.aggregate_version",
    },
    "CandidateHired.v2": {
        "hireRequestId": "ppl_rec_hire_requests.public_id",
        "candidateCaseId": "ppl_rec_candidate_cases.public_id",
        "offerId": "ppl_rec_offers.public_id",
        "workerPublicId": "ppl_rec_hire_handoff_receipts.worker_public_id",
        "employmentPublicId": "ppl_rec_hire_handoff_receipts.employment_public_id",
        "assignmentPublicId": "ppl_rec_hire_handoff_receipts.assignment_public_id",
        "effectiveDate": "ppl_rec_hire_handoff_receipts.effective_date",
        "hireHandoffReceiptId": "ppl_rec_hire_handoff_receipts.public_id",
        "ownerAggregateVersion": "ppl_rec_hire_handoff_receipts.owner_aggregate_version",
        "handoffPayloadDigest": "ppl_rec_hire_handoff_receipts.payload_digest",
    },
    "ContingentAccessExpired.v2": {
        "engagementId": "ppl_cwk_engagements.public_id",
        "workerPublicId": "ppl_cwk_engagements.worker_public_id",
        "accessExpiresAt": "ppl_cwk_engagements.access_expires_at",
        "accessExpiryReceiptId": "ppl_cwk_access_expiry_receipts.public_id",
        "grantPublicId": "ppl_cwk_access_expiry_receipts.grant_public_id",
        "grantRevision": "ppl_cwk_access_expiry_receipts.grant_revision",
        "outcome": "ppl_cwk_access_expiry_receipts.outcome",
        "receiptDigest": "ppl_cwk_access_expiry_receipts.receipt_digest",
    },
    "OnboardingTaskCompleted.v2": {
        "taskId": "ppl_jny_assignment_tasks.public_id",
        "assignmentId": "ppl_jny_assignments.public_id",
        "taskStatus": "ppl_jny_assignment_tasks.status",
        "evidenceDigest": "ppl_jny_task_evidence.payload_digest",
        "taskVersion": "ppl_jny_assignment_tasks.aggregate_version",
    },
    "OnboardingJourneyCompleted.v2": {
        "assignmentId": "ppl_jny_assignments.public_id",
        "workerPublicId": "ppl_jny_assignments.worker_public_id",
        "templateVersionId": "ppl_jny_template_versions.public_id",
        "completedAt": "ppl_jny_assignments.completed_at",
        "completionRevision": "ppl_jny_assignments.assignment_revision",
        "aggregateVersion": "ppl_jny_assignments.aggregate_version",
    },
    "CompensationPlanApprovalRecorded.v2": {
        "planId": "prf_cmp_plans.public_id",
        "cycleId": "prf_cmp_cycles.public_id",
        "approvalReceiptId": "ownerRefetch.Approval.DecisionReceipt.publicId",
        "approvalRevision": "ownerRefetch.Approval.DecisionReceipt.decisionVersion",
        "approvalOutcome": "prf_cmp_plans.approval_outcome",
        "planRevision": "prf_cmp_plans.plan_revision",
        "contentDigest": "prf_cmp_plans.content_digest",
        "reasonCode": "prf_cmp_cycles.last_reason_code",
        "cycleVersion": "prf_cmp_cycles.aggregate_version",
    },
    "ApprovedCompensationPlanSnapshotPublished.v2": {
        "planId": "prf_cmp_approved_snapshots.plan_public_id",
        "cycleId": "prf_cmp_approved_snapshots.cycle_public_id",
        "approvalRevision": "prf_cmp_approved_snapshots.approval_revision",
        "approvalReceiptId": "prf_cmp_approved_snapshots.approval_receipt_id",
        "effectiveDate": "prf_cmp_approved_snapshots.effective_from",
        "snapshotId": "prf_cmp_approved_snapshots.public_id",
        "lineCount": "prf_cmp_approved_snapshots.line_count",
        "snapshotRevision": "prf_cmp_approved_snapshots.aggregate_version",
        "sourceVersion": "prf_cmp_approved_snapshots.source_version",
        "payloadDigest": "prf_cmp_approved_snapshots.payload_digest",
    },
    "WorkforceScheduleOptimizationRequested.v2": {
        "optimizationRequestId": "tme_wfm_optimization_requests.public_id",
        "forecastId": "ownerRefetch.TIM.DemandForecast.publicId",
        "inputSnapshotId": "tme_wfm_optimization_requests.input_snapshot_id",
        "ruleVersion": "tme_wfm_optimization_requests.rule_version",
        "fairnessEvaluationId": "tme_wfm_optimization_requests.fairness_evaluation_id",
        "availabilitySnapshotId": "tme_wfm_optimization_requests.availability_snapshot_id",
        "periodStart": "tme_wfm_optimization_requests.period_start",
        "periodEnd": "tme_wfm_optimization_requests.period_end",
        "requestDigest": "tme_wfm_optimization_requests.request_digest",
    },
    "WorkforceScheduleCandidateGenerated.v2": {
        "optimizationRequestId": "tme_wfm_optimization_requests.public_id",
        "forecastId": "tme_wfm_demand_forecasts.public_id",
        "candidatePublicId": "tme_wfm_schedule_candidates.public_id",
        "candidateRevision": "tme_wfm_schedule_candidates.candidate_revision",
        "candidateDigest": "tme_wfm_schedule_candidates.candidate_digest",
        "shiftLineCount": "tme_wfm_schedule_candidates.shift_line_count",
        "periodStart": "tme_wfm_schedule_candidates.period_start",
        "periodEnd": "tme_wfm_schedule_candidates.period_end",
        "availabilitySnapshotId": "tme_wfm_schedule_candidates.availability_snapshot_id",
        "evaluationReceiptId": "tme_wfm_constraint_evaluation_receipts.public_id",
        "resultDigest": "tme_wfm_constraint_evaluation_receipts.result_digest",
    },
    "WorkforceSchedulePublished.v2": {
        "publicationPublicId": "tme_wfm_schedule_publish_ledger.public_id",
        "candidatePublicId": "tme_wfm_schedule_candidates.public_id",
        "candidateRevision": "tme_wfm_schedule_candidates.candidate_revision",
        "canonicalSchedulePeriodPublicId": "ownerAck.canonicalSchedulePeriodPublicId",
        "approvalReceiptPublicId": "ownerRefetch.Approval.DecisionReceipt.publicId",
        "candidateDigest": "tme_wfm_schedule_candidates.candidate_digest",
        "payloadDigest": "tme_wfm_schedule_publish_ledger.payload_digest",
    },
    "GovernedAiPolicyEvaluationRequested.v2": {
        "evaluationRequestId": "sys_hris_ai_evaluation_requests.public_id",
        "policyId": "ownerRefetch.SYS.AiUsePolicy.publicId",
        "policyVersion": "sys_hris_ai_evaluation_requests.policy_version",
        "evaluationSuiteVersion": "sys_hris_ai_evaluation_requests.evaluation_suite_version",
        "fixtureSetDigest": "sys_hris_ai_evaluation_requests.fixture_set_digest",
        "modelRouteKey": "sys_hris_ai_evaluation_requests.model_route_key",
        "requestDigest": "sys_hris_ai_evaluation_requests.request_digest",
    },
    "GovernedAiPolicyEvaluationCompleted.v2": {
        "evaluationRequestId": "sys_hris_ai_evaluation_requests.public_id",
        "policyId": "sys_hris_ai_use_policies.public_id",
        "policyVersion": "sys_hris_ai_evaluation_requests.policy_version",
        "evaluationReceiptId": "sys_hris_ai_evaluation_receipts.public_id",
        "evaluationOutcome": "sys_hris_ai_evaluation_receipts.evaluation_outcome",
        "blockingFailureCount": "sys_hris_ai_evaluation_receipts.blocking_failure_count",
        "resultDigest": "sys_hris_ai_evaluation_receipts.result_digest",
    },
}


# A reviewed field-source map is deliberately explicit.  Stable event names
# cannot fall back to camelCase-to-column guessing: that previously exposed
# private BIGINT surrogate keys and fabricated `ownerRefetch.table:*` paths.
# Sources below are committed rows, locked owner reads, or named owner
# acknowledgements; none are caller request mirrors.
REVIEWED_EVENT_FIELD_SOURCES: dict[str, dict[str, str]] = {
    **CRITICAL_EVENT_FIELDS,
    "RequisitionCreated.v2": {
        "organizationPublicId": "ppl_rec_requisitions.organization_public_id",
        "positionPublicId": "ppl_rec_requisitions.position_public_id",
        "requisitionCode": "ppl_rec_requisitions.requisition_code",
        "validFrom": "ppl_rec_requisitions.valid_from",
    },
    "RequisitionPublished.v2": {
        "requisitionId": "ppl_rec_requisitions.public_id",
        "organizationPublicId": "ppl_rec_requisitions.organization_public_id",
        "positionPublicId": "ppl_rec_requisitions.position_public_id",
    },
    "CandidateStageChanged.v2": {
        "candidateCaseId": "ppl_rec_candidate_cases.public_id",
        "requisitionId": "ppl_rec_requisitions.public_id",
        "recordedAt": "ppl_rec_candidate_cases.recorded_at",
    },
    "CandidateOfferIssued.v2": {
        "candidateCaseId": "ppl_rec_candidate_cases.public_id",
        "offerId": "ppl_rec_offers.public_id",
        "offerVersion": "ppl_rec_offers.offer_version",
        "expiresAt": "ppl_rec_offers.expires_at",
        "validFrom": "ppl_rec_offers.valid_from",
    },
    "CandidateHireHandoffRequested.v2": {
        "hireRequestId": "ppl_rec_hire_requests.public_id",
        "candidateCaseId": "ppl_rec_candidate_cases.public_id",
        "offerId": "ppl_rec_offers.public_id",
        "effectiveDate": "ppl_rec_hire_requests.effective_date",
        "humanDecisionReceiptId": "ppl_rec_hire_requests.human_decision_receipt_public_id",
        "candidateVersion": "ppl_rec_hire_requests.candidate_version",
        "requestDigest": "ppl_rec_hire_requests.request_digest",
    },
    "OnboardingTemplateCreated.v2": {
        "templateVersionId": "ppl_jny_template_versions.public_id",
        "templateId": "ppl_jny_templates.public_id",
        "templateKey": "ppl_jny_templates.template_key",
        "configurationScopeId": "ppl_jny_templates.config_scope_public_id",
        "version": "ppl_jny_template_versions.version_no",
        "validFrom": "ppl_jny_template_versions.effective_from",
        "contentDigest": "ppl_jny_template_versions.content_digest",
    },
    "OnboardingTemplatePublished.v2": {
        "templateVersionId": "ppl_jny_template_versions.public_id",
        "templateId": "ppl_jny_templates.public_id",
        "templateKey": "ppl_jny_templates.template_key",
        "version": "ppl_jny_template_versions.version_no",
        "validFrom": "ppl_jny_template_versions.effective_from",
        "contentDigest": "ppl_jny_template_versions.content_digest",
    },
    "OnboardingJourneyAssigned.v2": {
        "assignmentId": "ppl_jny_assignments.public_id",
        "workerPublicId": "ppl_jny_assignments.worker_public_id",
        "templateId": "ppl_jny_templates.public_id",
        "templateVersionId": "ppl_jny_template_versions.public_id",
        "assignmentRevision": "ppl_jny_assignments.assignment_revision",
        "assignedAt": "ppl_jny_assignments.assigned_at",
        "dueAt": "ppl_jny_assignments.due_at",
    },
    "OnboardingTaskCompleted.v2": {
        "taskId": "ppl_jny_assignment_tasks.public_id",
        "assignmentId": "ppl_jny_assignments.public_id",
        "taskEvidenceId": "ppl_jny_task_evidence.public_id",
        "taskKey": "ppl_jny_assignment_tasks.task_key",
        "taskStatus": "ppl_jny_assignment_tasks.status",
        "taskVersion": "ppl_jny_assignment_tasks.aggregate_version",
        "completionRevision": "ppl_jny_task_evidence.completion_revision",
        "evidenceDigest": "ppl_jny_task_evidence.evidence_digest",
        "recordedAt": "ppl_jny_task_evidence.recorded_at",
    },
    "OnboardingJourneyCompleted.v2": {
        "assignmentId": "ppl_jny_assignments.public_id",
        "workerPublicId": "ppl_jny_assignments.worker_public_id",
        "templateVersionId": "ppl_jny_template_versions.public_id",
        "assignmentRevision": "ppl_jny_assignments.assignment_revision",
        "completedAt": "ppl_jny_assignments.completed_at",
    },
    "OnboardingJourneyCancelled.v2": {
        "assignmentId": "ppl_jny_assignments.public_id",
        "workerPublicId": "ppl_jny_assignments.worker_public_id",
        "assignmentRevision": "ppl_jny_assignments.assignment_revision",
    },
    "WorkforceScenarioCreated.v2": {
        "scenarioId": "ppl_wfp_scenarios.public_id",
        "scenarioKey": "ppl_wfp_scenarios.scenario_key",
        "organizationSnapshotId": "ppl_wfp_scenarios.organization_snapshot_id",
        "inputDigest": "ppl_wfp_scenarios.input_digest",
        "revision": "ppl_wfp_scenario_revisions.revision_no",
        "payloadDigest": "ppl_wfp_scenario_revisions.payload_digest",
    },
    "WorkforceScenarioSimulated.v2": {
        "scenarioId": "ppl_wfp_scenarios.public_id",
        "revision": "ppl_wfp_scenario_revisions.revision_no",
        "resultDigest": "ppl_wfp_scenario_revisions.result_digest",
        "payloadDigest": "ppl_wfp_scenario_revisions.payload_digest",
    },
    "WorkforceScenarioSubmitted.v2": {
        "scenarioId": "ppl_wfp_scenarios.public_id",
        "revision": "ppl_wfp_scenario_revisions.revision_no",
        "resultDigest": "ppl_wfp_scenario_revisions.result_digest",
    },
    "WorkforceScenarioDecisionRecorded.v2": {
        "scenarioId": "ppl_wfp_scenarios.public_id",
        "revision": "ppl_wfp_scenario_revisions.revision_no",
        "resultDigest": "ppl_wfp_scenario_revisions.result_digest",
    },
    "WorkforceScenarioPublished.v2": {
        "scenarioId": "ppl_wfp_scenarios.public_id",
        "publishReceiptId": "ppl_wfp_publish_receipts.public_id",
        "approvedRevision": "ppl_wfp_publish_receipts.approved_revision",
        "effectiveDate": "ppl_wfp_publish_receipts.effective_date",
        "payloadDigest": "ppl_wfp_publish_receipts.payload_digest",
    },
    "BenefitPlanCreated.v2": {
        "planVersionId": "ppl_bnf_plan_versions.public_id",
        "planId": "ppl_bnf_plans.public_id",
        "planCode": "ppl_bnf_plans.plan_code",
        "version": "ppl_bnf_plan_versions.version_no",
        "eligibilityPolicyVersionId": "ppl_bnf_plan_versions.eligibility_policy_version_id",
        "validFrom": "ppl_bnf_plan_versions.valid_from",
        "contentDigest": "ppl_bnf_plan_versions.content_digest",
    },
    "BenefitPlanPublished.v2": {
        "planVersionId": "ppl_bnf_plan_versions.public_id",
        "planId": "ppl_bnf_plans.public_id",
        "planCode": "ppl_bnf_plans.plan_code",
        "version": "ppl_bnf_plan_versions.version_no",
        "eligibilityPolicyVersionId": "ppl_bnf_plan_versions.eligibility_policy_version_id",
        "validFrom": "ppl_bnf_plan_versions.valid_from",
        "contentDigest": "ppl_bnf_plan_versions.content_digest",
    },
    "BenefitEnrollmentSubmitted.v2": {
        "enrollmentId": "ppl_bnf_enrollments.public_id",
        "planId": "ppl_bnf_plans.public_id",
        "planVersionId": "ppl_bnf_plan_versions.public_id",
        "workerPublicId": "ppl_bnf_enrollments.worker_public_id",
        "coverageLevel": "ppl_bnf_enrollments.coverage_level",
        "effectiveFrom": "ppl_bnf_enrollments.effective_from",
        "submissionDigest": "ppl_bnf_enrollments.submission_digest",
    },
    "BenefitLifeEventSubmitted.v2": {
        "lifeEventId": "ppl_bnf_life_events.public_id",
        "workerPublicId": "ppl_bnf_life_events.worker_public_id",
        "eventType": "ppl_bnf_life_events.event_type",
        "eventDate": "ppl_bnf_life_events.event_date",
        "payloadDigest": "ppl_bnf_life_events.payload_digest",
    },
    "BenefitEnrollmentDecided.v2": {
        "enrollmentId": "ppl_bnf_enrollments.public_id",
        "planId": "ppl_bnf_plans.public_id",
        "planVersionId": "ppl_bnf_plan_versions.public_id",
        "workerPublicId": "ppl_bnf_enrollments.worker_public_id",
        "effectiveFrom": "ppl_bnf_enrollments.effective_from",
        "decisionReceiptId": "ppl_bnf_enrollments.decision_receipt_public_id",
        "reasonCode": "ppl_bnf_enrollments.last_reason_code",
    },
    "HrServiceCaseCreated.v2": {
        "caseId": "ppl_hrs_cases.public_id", "caseNumber": "ppl_hrs_cases.case_number",
        "requesterWorkerPublicId": "ppl_hrs_cases.requester_worker_public_id",
        "caseType": "ppl_hrs_cases.case_type", "sensitivityClass": "ppl_hrs_cases.sensitivity_class",
        "dueAt": "ppl_hrs_cases.due_at",
    },
    "HrServiceCaseTriaged.v2": {
        "caseId": "ppl_hrs_cases.public_id", "caseNumber": "ppl_hrs_cases.case_number",
        "dueAt": "ppl_hrs_cases.due_at", "actionId": "ppl_hrs_case_actions.public_id",
        "actionType": "ppl_hrs_case_actions.action_type", "payloadDigest": "ppl_hrs_case_actions.payload_digest",
    },
    "HrServiceCaseAssigned.v2": {
        "caseId": "ppl_hrs_cases.public_id", "actionId": "ppl_hrs_case_actions.public_id",
        "actorPublicId": "ppl_hrs_case_actions.actor_public_id",
        "payloadDigest": "ppl_hrs_case_actions.payload_digest",
    },
    "HrServiceCaseResponseRecorded.v2": {
        "caseId": "ppl_hrs_cases.public_id", "actionId": "ppl_hrs_case_actions.public_id",
        "actionType": "ppl_hrs_case_actions.action_type", "payloadDigest": "ppl_hrs_case_actions.payload_digest",
        "recordedAt": "ppl_hrs_case_actions.recorded_at",
    },
    "HrServiceCaseResolved.v2": {
        "caseId": "ppl_hrs_cases.public_id", "caseNumber": "ppl_hrs_cases.case_number",
        "resolvedAt": "ppl_hrs_cases.resolved_at", "actionId": "ppl_hrs_case_actions.public_id",
        "payloadDigest": "ppl_hrs_case_actions.payload_digest",
    },
    "ContingentEngagementCreated.v2": {
        "engagementId": "ppl_cwk_engagements.public_id", "engagementCode": "ppl_cwk_engagements.engagement_code",
        "workerPublicId": "ppl_cwk_engagements.worker_public_id", "vendorPublicId": "ppl_cwk_engagements.vendor_public_id",
        "sponsorWorkerPublicId": "ppl_cwk_engagements.sponsor_worker_public_id",
        "effectiveFrom": "ppl_cwk_engagements.effective_from",
    },
    "ContingentEngagementSubmitted.v2": {
        "engagementId": "ppl_cwk_engagements.public_id", "workerPublicId": "ppl_cwk_engagements.worker_public_id",
        "vendorPublicId": "ppl_cwk_engagements.vendor_public_id",
    },
    "ContingentEngagementActivated.v2": {
        "engagementId": "ppl_cwk_engagements.public_id", "workerPublicId": "ppl_cwk_engagements.worker_public_id",
        "accessExpiresAt": "ppl_cwk_engagements.access_expires_at",
    },
    "ContingentEngagementOffboardingStarted.v2": {
        "engagementId": "ppl_cwk_engagements.public_id", "workerPublicId": "ppl_cwk_engagements.worker_public_id",
        "effectiveTo": "ppl_cwk_engagements.effective_to",
    },
    "ContingentEngagementClosed.v2": {
        "engagementId": "ppl_cwk_engagements.public_id", "workerPublicId": "ppl_cwk_engagements.worker_public_id",
        "effectiveTo": "ppl_cwk_engagements.effective_to",
    },
    "SkillsTaxonomyCreated.v2": {
        "taxonomyId": "prf_skl_taxonomies.public_id", "taxonomyKey": "prf_skl_taxonomies.taxonomy_key",
        "version": "prf_skl_taxonomy_versions.version_no", "contentDigest": "prf_skl_taxonomy_versions.content_digest",
        "skillCount": "prf_skl_taxonomy_versions.skill_count",
    },
    "SkillsTaxonomyValidated.v2": {
        "taxonomyId": "prf_skl_taxonomies.public_id", "version": "prf_skl_taxonomy_versions.version_no",
        "contentDigest": "prf_skl_taxonomy_versions.content_digest", "skillCount": "prf_skl_taxonomy_versions.skill_count",
    },
    "SkillsTaxonomyPublished.v2": {
        "taxonomyId": "prf_skl_taxonomies.public_id", "version": "prf_skl_taxonomy_versions.version_no",
        "contentDigest": "prf_skl_taxonomy_versions.content_digest", "skillCount": "prf_skl_taxonomy_versions.skill_count",
        "effectiveFrom": "prf_skl_taxonomy_versions.effective_from",
    },
    "WorkerSkillEvidenceVerified.v2": {
        "evidenceId": "prf_skl_worker_evidence.public_id", "workerPublicId": "prf_skl_worker_evidence.worker_public_id",
        "skillPublicId": "prf_skl_worker_evidence.skill_public_id",
        "proficiencyLevel": "prf_skl_worker_evidence.proficiency_level",
        "provenanceType": "prf_skl_worker_evidence.provenance_type",
        "evidenceDigest": "prf_skl_worker_evidence.evidence_digest",
        "verificationReceiptId": "prf_skl_worker_evidence.verification_receipt_public_id",
    },
    "GrowthProfileCreated.v2": {
        "profileId": "prf_grw_profiles.public_id", "workerPublicId": "prf_grw_profiles.worker_public_id",
        "profileVersion": "prf_grw_profiles.profile_version", "validFrom": "prf_grw_profiles.valid_from",
    },
    "GrowthProfileUpdated.v2": {
        "profileId": "prf_grw_profiles.public_id", "workerPublicId": "prf_grw_profiles.worker_public_id",
        "profileVersion": "prf_grw_profiles.profile_version", "profileRevisionId": "prf_grw_profile_revisions.public_id",
        "artifactPublicId": "prf_grw_profile_revisions.artifact_public_id",
        "artifactRevision": "prf_grw_profile_revisions.artifact_revision",
        "visibility": "prf_grw_profile_revisions.visibility",
        "evidenceRefsDigest": "prf_grw_profile_revisions.evidence_refs_digest",
    },
    "GrowthEvidenceLinked.v2": {
        "profileId": "prf_grw_profiles.public_id", "workerPublicId": "prf_grw_profiles.worker_public_id",
        "evidenceLinkId": "prf_grw_evidence_links.public_id",
        "evidencePublicId": "prf_grw_evidence_links.evidence_public_id",
        "evidenceType": "prf_grw_evidence_links.evidence_type",
        "sourceRevision": "prf_grw_evidence_links.source_revision",
        "consentRevision": "prf_grw_evidence_links.consent_revision",
    },
    "GrowthCoachingRecorded.v2": {
        "profileId": "prf_grw_profiles.public_id", "workerPublicId": "prf_grw_profiles.worker_public_id",
        "profileVersion": "prf_grw_profiles.profile_version", "coachingNoteId": "prf_grw_coaching_notes.public_id",
        "artifactPublicId": "prf_grw_coaching_notes.artifact_public_id",
        "artifactRevision": "prf_grw_coaching_notes.artifact_revision",
        "employeeVisible": "prf_grw_coaching_notes.employee_visible",
        "recordedAt": "prf_grw_coaching_notes.occurred_at",
        "evidenceRefsDigest": "prf_grw_coaching_notes.evidence_refs_digest",
    },
    "GrowthProfileArchived.v2": {
        "profileId": "prf_grw_profiles.public_id", "workerPublicId": "prf_grw_profiles.worker_public_id",
        "archivedAt": "prf_grw_profiles.archived_at",
    },
    "LearningOfferingCreated.v2": {
        "offeringId": "prf_lrn_offerings.public_id", "offeringCode": "prf_lrn_offerings.offering_code",
        "providerPublicId": "prf_lrn_offerings.provider_public_id", "validFrom": "prf_lrn_offerings.valid_from",
    },
    "LearningOfferingPublished.v2": {
        "offeringId": "prf_lrn_offerings.public_id", "offeringCode": "prf_lrn_offerings.offering_code",
        "providerPublicId": "prf_lrn_offerings.provider_public_id",
    },
    "LearningEnrollmentCreated.v2": {
        "assignmentId": "prf_lrn_assignments.public_id", "workerPublicId": "prf_lrn_assignments.worker_public_id",
        "offeringId": "prf_lrn_offerings.public_id", "assignmentRevision": "prf_lrn_assignments.assignment_revision",
        "assignedAt": "prf_lrn_assignments.assigned_at",
    },
    "LearningAssignmentStarted.v2": {
        "assignmentId": "prf_lrn_assignments.public_id", "workerPublicId": "prf_lrn_assignments.worker_public_id",
        "offeringId": "prf_lrn_offerings.public_id", "assignmentRevision": "prf_lrn_assignments.assignment_revision",
        "startedAt": "prf_lrn_assignments.started_at",
    },
    "LearningCompletionVerified.v2": {
        "assignmentId": "prf_lrn_assignments.public_id", "workerPublicId": "prf_lrn_assignments.worker_public_id",
        "completionId": "prf_lrn_completion_evidence.public_id",
        "completedAt": "prf_lrn_completion_evidence.completed_at",
        "evidenceDigest": "prf_lrn_completion_evidence.evidence_digest",
        "skillEvidenceIds": "prf_lrn_completion_evidence.skill_evidence_ids",
    },
    "TalentOpportunityCreated.v2": {
        "opportunityId": "prf_mkt_opportunities.public_id", "opportunityCode": "prf_mkt_opportunities.opportunity_code",
        "ownerOrgPublicId": "prf_mkt_opportunities.owner_org_public_id", "openFrom": "prf_mkt_opportunities.open_from",
    },
    "TalentOpportunityPublished.v2": {
        "opportunityId": "prf_mkt_opportunities.public_id", "opportunityCode": "prf_mkt_opportunities.opportunity_code",
        "ownerOrgPublicId": "prf_mkt_opportunities.owner_org_public_id",
    },
    "TalentOpportunityApplicationSubmitted.v2": {
        "applicationId": "prf_mkt_applications.public_id", "opportunityId": "prf_mkt_opportunities.public_id",
        "workerPublicId": "prf_mkt_applications.worker_public_id", "appliedAt": "prf_mkt_applications.applied_at",
        "applicationStatementDigest": "prf_mkt_applications.application_statement_digest",
        "consentRevision": "prf_mkt_applications.consent_revision",
    },
    "TalentOpportunityApplicationShortlisted.v2": {
        "applicationId": "prf_mkt_applications.public_id", "opportunityId": "prf_mkt_opportunities.public_id",
        "workerPublicId": "prf_mkt_applications.worker_public_id", "explanationId": "prf_mkt_match_explanations.public_id",
        "payloadDigest": "prf_mkt_match_explanations.payload_digest",
    },
    "TalentOpportunitySelectionRecorded.v2": {
        "applicationId": "prf_mkt_applications.public_id", "opportunityId": "prf_mkt_opportunities.public_id",
        "workerPublicId": "prf_mkt_applications.worker_public_id",
    },
    "SuccessionPlanCreated.v2": {
        "planId": "prf_suc_plans.public_id", "planKey": "prf_suc_plans.plan_key",
        "keyPositionPublicId": "prf_suc_plans.key_position_public_id", "planVersion": "prf_suc_plans.plan_version",
    },
    "SuccessionNominationAdded.v2": {
        "planId": "prf_suc_plans.public_id", "nominationId": "prf_suc_nominations.public_id",
        "workerPublicId": "prf_suc_nominations.worker_public_id", "readinessCode": "prf_suc_nominations.readiness_code",
        "nominationRevision": "prf_suc_nominations.nomination_revision",
    },
    "SuccessionPlanSubmitted.v2": {
        "planId": "prf_suc_plans.public_id", "keyPositionPublicId": "prf_suc_plans.key_position_public_id",
        "planVersion": "prf_suc_plans.plan_version",
    },
    "SuccessionPlanApproved.v2": {
        "planId": "prf_suc_plans.public_id", "keyPositionPublicId": "prf_suc_plans.key_position_public_id",
        "planVersion": "prf_suc_plans.plan_version",
    },
    "SuccessionPlanPublished.v2": {
        "planId": "prf_suc_plans.public_id", "keyPositionPublicId": "prf_suc_plans.key_position_public_id",
        "planVersion": "prf_suc_plans.plan_version", "audiencePolicyRevision": "prf_suc_plans.audience_policy_revision",
        "publishedAt": "prf_suc_plans.published_at",
    },
    "CompensationCycleCreated.v2": {
        "cycleId": "prf_cmp_cycles.public_id", "cycleCode": "prf_cmp_cycles.cycle_code",
        "budgetCurrency": "prf_cmp_cycles.budget_currency", "budgetTotal": "prf_cmp_cycles.budget_total",
        "populationSnapshotId": "prf_cmp_cycles.population_snapshot_id",
    },
    "CompensationBudgetAllocated.v2": {
        "cycleId": "prf_cmp_cycles.public_id", "ledgerEntryId": "prf_cmp_budget_ledger.public_id",
        "payloadDigest": "prf_cmp_budget_ledger.payload_digest",
    },
    "CompensationProposalSubmitted.v2": {
        "cycleId": "prf_cmp_cycles.public_id", "proposalId": "prf_cmp_proposals.public_id",
        "workerPublicId": "prf_cmp_proposals.worker_public_id", "componentCode": "prf_cmp_proposals.component_code",
        "submissionDigest": "prf_cmp_proposals.submission_digest", "submittedAt": "prf_cmp_proposals.submitted_at",
    },
    "WorkforceDemandForecastCreated.v2": {
        "forecastId": "tme_wfm_demand_forecasts.public_id", "forecastKey": "tme_wfm_demand_forecasts.forecast_key",
        "forecastRevision": "tme_wfm_demand_forecasts.forecast_revision",
        "periodStart": "tme_wfm_demand_forecasts.period_start", "periodEnd": "tme_wfm_demand_forecasts.period_end",
        "sourceDigest": "tme_wfm_demand_forecasts.source_digest",
        "worksitePublicId": "tme_wfm_demand_forecasts.worksite_public_id",
    },
    "WorkforceScheduleValidationCompleted.v2": {
        "candidatePublicId": "tme_wfm_schedule_candidates.public_id",
        "candidateRevision": "tme_wfm_schedule_candidates.candidate_revision",
        "candidateDigest": "tme_wfm_schedule_candidates.candidate_digest",
        "evaluationReceiptId": "tme_wfm_constraint_evaluation_receipts.public_id",
        "blockingViolationCount": "tme_wfm_constraint_evaluation_receipts.blocking_violation_count",
        "fairnessMetricCount": "tme_wfm_constraint_evaluation_receipts.fairness_metric_count",
        "resultDigest": "tme_wfm_constraint_evaluation_receipts.result_digest",
    },
    "WorkforceScheduleCandidateSubmitted.v2": {
        "candidatePublicId": "tme_wfm_schedule_candidates.public_id",
        "candidateRevision": "tme_wfm_schedule_candidates.candidate_revision",
        "candidateDigest": "tme_wfm_schedule_candidates.candidate_digest",
    },
    "EmployeeListeningResponseSubmitted.v2": {
        "responseId": "sys_hris_listening_responses.public_id", "surveyId": "sys_hris_listening_surveys.public_id",
        "responseDigest": "sys_hris_listening_responses.response_digest",
        "submittedAt": "sys_hris_listening_responses.submitted_at", "eraseAfter": "sys_hris_listening_responses.erase_after",
    },
    "EmployeeListeningSurveyCreated.v2": {
        "surveyId": "sys_hris_listening_surveys.public_id", "surveyKey": "sys_hris_listening_surveys.survey_key",
        "surveyVersion": "sys_hris_listening_surveys.survey_version",
        "audienceSnapshotId": "sys_hris_listening_surveys.audience_snapshot_id",
        "anonymityThreshold": "sys_hris_listening_surveys.anonymity_threshold",
    },
    "EmployeeListeningSurveyPublished.v2": {
        "surveyId": "sys_hris_listening_surveys.public_id", "surveyVersion": "sys_hris_listening_surveys.survey_version",
        "audienceDigest": "sys_hris_listening_surveys.audience_digest", "opensAt": "sys_hris_listening_surveys.opens_at",
        "closesAt": "sys_hris_listening_surveys.closes_at",
    },
    "EmployeeListeningSurveyClosed.v2": {
        "surveyId": "sys_hris_listening_surveys.public_id", "surveyVersion": "sys_hris_listening_surveys.survey_version",
        "closesAt": "sys_hris_listening_surveys.closes_at",
    },
    "EmployeeListeningActionCreated.v2": {
        "actionId": "sys_hris_listening_actions.public_id", "surveyId": "sys_hris_listening_surveys.public_id",
        "actionKey": "sys_hris_listening_actions.action_key",
        "ownerPrincipalId": "sys_hris_listening_actions.owner_principal_id",
        "dueAt": "sys_hris_listening_actions.due_at", "payloadDigest": "sys_hris_listening_actions.payload_digest",
    },
    "EmployeeListeningActionCompleted.v2": {
        "actionId": "sys_hris_listening_actions.public_id", "completedAt": "sys_hris_listening_actions.completed_at",
        "payloadDigest": "sys_hris_listening_actions.payload_digest",
    },
    "PeopleMetricCreated.v2": {
        "metricId": "sys_hris_metric_definitions.public_id", "metricKey": "sys_hris_metric_definitions.metric_key",
        "version": "sys_hris_metric_versions.version_no", "definitionDigest": "sys_hris_metric_versions.definition_digest",
        "lineageDigest": "sys_hris_metric_versions.lineage_digest",
    },
    "PeopleMetricValidated.v2": {
        "metricId": "sys_hris_metric_definitions.public_id", "version": "sys_hris_metric_versions.version_no",
        "definitionDigest": "sys_hris_metric_versions.definition_digest",
        "lineageDigest": "sys_hris_metric_versions.lineage_digest",
    },
    "PeopleMetricPublished.v2": {
        "metricId": "sys_hris_metric_definitions.public_id", "version": "sys_hris_metric_versions.version_no",
        "projectionId": "sys_hris_metric_projections.public_id",
        "projectionRevision": "sys_hris_metric_projections.projection_revision",
        "subjectCount": "sys_hris_metric_projections.subject_count",
        "payloadDigest": "sys_hris_metric_projections.payload_digest",
    },
    "PeopleAnalyticsExportRequested.v2": {
        "exportReceiptId": "sys_hris_analytics_export_receipts.public_id",
        "metricProjectionIdsDigest": "sys_hris_analytics_export_receipts.metric_projection_ids_digest",
        "objectDigest": "sys_hris_analytics_export_receipts.object_digest",
        "rowCount": "sys_hris_analytics_export_receipts.row_count",
        "requestedAt": "sys_hris_analytics_export_receipts.requested_at",
    },
    "PeopleMetricRetired.v2": {
        "metricId": "sys_hris_metric_definitions.public_id", "metricKey": "sys_hris_metric_definitions.metric_key",
    },
    "GovernedAiAssistanceProduced.v2": {
        "assistanceReceiptId": "sys_hris_ai_provenance_receipts.public_id",
        "useCaseKey": "sys_hris_ai_provenance_receipts.use_case_key",
        "policyVersion": "sys_hris_ai_provenance_receipts.policy_version",
        "inputDigest": "sys_hris_ai_provenance_receipts.input_digest",
        "outputDigest": "sys_hris_ai_provenance_receipts.output_digest",
        "sourceRefsDigest": "sys_hris_ai_provenance_receipts.source_refs_digest",
        "modelRouteKey": "sys_hris_ai_provenance_receipts.model_route_key",
    },
    "GovernedAiPolicyCreated.v2": {
        "policyId": "sys_hris_ai_use_policies.public_id", "useCaseKey": "sys_hris_ai_use_policies.use_case_key",
        "policyVersion": "sys_hris_ai_policy_versions.version_no",
        "humanControlMode": "sys_hris_ai_policy_versions.human_control_mode",
        "policyDigest": "sys_hris_ai_policy_versions.policy_digest",
    },
    "GovernedAiPolicyPublished.v2": {
        "policyId": "sys_hris_ai_use_policies.public_id", "useCaseKey": "sys_hris_ai_use_policies.use_case_key",
        "policyVersion": "sys_hris_ai_policy_versions.version_no", "policyDigest": "sys_hris_ai_policy_versions.policy_digest",
    },
    "GovernedAiPolicySuspended.v2": {
        "policyId": "sys_hris_ai_use_policies.public_id", "useCaseKey": "sys_hris_ai_use_policies.use_case_key",
        "policyVersion": "sys_hris_ai_use_policies.policy_version",
    },
    "GovernedAiPolicyRetired.v2": {
        "policyId": "sys_hris_ai_use_policies.public_id", "useCaseKey": "sys_hris_ai_use_policies.use_case_key",
        "policyVersion": "sys_hris_ai_use_policies.policy_version",
    },
}


# Some emitted facts have a subject aggregate distinct from the public command
# concurrency root.  The outbox aggregate_id and canonical base fields bind to
# this fact root, never to the first write or the command root by accident.
EVENT_AGGREGATE_OVERRIDES = {
    "CandidateHireHandoffRequested.v2": {
        "table": "ppl_rec_hire_requests", "stateSink": "ppl_rec_hire_requests.status",
        "fromStateSource": "CONSTANT:NONE", "toStateSource": "ppl_rec_hire_requests.status",
    },
    "OnboardingJourneyCompleted.v2": {
        "table": "ppl_jny_assignments", "stateSink": "ppl_jny_assignments.status",
        "fromStateSource": "LOCKED_PRE:ppl_jny_assignments.status",
        "toStateSource": "ppl_jny_assignments.status",
    },
    "CompensationPlanApprovalRecorded.v2": {
        "table": "prf_cmp_plans", "stateSink": "prf_cmp_plans.status",
        "fromStateSource": "CONSTANT:NONE", "toStateSource": "prf_cmp_plans.status",
    },
    "ApprovedCompensationPlanSnapshotPublished.v2": {
        "table": "prf_cmp_approved_snapshots", "stateSink": "prf_cmp_approved_snapshots.status",
        "fromStateSource": "CONSTANT:NONE", "toStateSource": "prf_cmp_approved_snapshots.status",
    },
    "WorkforceScheduleCandidateGenerated.v2": {
        "table": "tme_wfm_schedule_candidates", "stateSink": "tme_wfm_schedule_candidates.status",
        "fromStateSource": "CONSTANT:NONE", "toStateSource": "tme_wfm_schedule_candidates.status",
    },
}


EVENT_AUDIENCE_OVERRIDES = {
    "OnboardingJourneyAssigned.v2": {
        "consumerSessions": ["HRIS-HRM"],
        "purposes": ["hcm.onboarding.assign", "HRIS_ONBOARDING_WORKFLOW_REFETCH"],
        "refetch": {"mode": "FIELD_ALLOWLIST", "ownerSession": "HRIS-HRM",
                    "endpoint": "/internal/hris-people/v1/onboarding/assignments/{assignmentId}",
                    "version": "assignmentId+assignmentRevision exact; no latest fallback",
                    "allowedFields": ["assignmentId", "assignmentRevision", "workerPublicId",
                                      "templateId", "templateVersionId", "assignedAt", "dueAt",
                                      "status", "tasks.publicId", "tasks.taskKey", "tasks.requiredFlag",
                                      "tasks.status"]},
    },
    "OnboardingTaskCompleted.v2": {
        "consumerSessions": ["HRIS-HRM"],
        "purposes": ["hcm.onboarding.task.complete", "HRIS_ONBOARDING_TASK_REFETCH"],
        "refetch": {"mode": "FIELD_ALLOWLIST", "ownerSession": "HRIS-HRM",
                    "endpoint": "/internal/hris-people/v1/onboarding/assignments/{assignmentId}/tasks/{taskId}",
                    "version": "taskId+taskVersion exact; no latest fallback",
                    "allowedFields": ["taskId", "taskVersion", "assignmentId", "taskKey", "requiredFlag",
                                      "status", "completionCode", "completedAt", "evidenceDigest"]},
    },
    "OnboardingJourneyCompleted.v2": {
        "consumerSessions": ["HRIS-HRM"],
        "purposes": ["hcm.onboarding.task.complete", "HRIS_ONBOARDING_COMPLETION_REFETCH"],
        "refetch": {"mode": "FIELD_ALLOWLIST", "ownerSession": "HRIS-HRM",
                    "endpoint": "/internal/hris-people/v1/onboarding/assignments/{assignmentId}",
                    "version": "assignmentId+completionRevision exact; no latest fallback",
                    "allowedFields": ["assignmentId", "completionRevision", "workerPublicId",
                                      "templateVersionId", "completedAt", "status",
                                      "requiredTaskCount", "completedRequiredTaskCount"]},
    },
    "BenefitPlanPublished.v2": {
        "consumerSessions": ["HRIS-HRM", "HRIS-PAY"],
        "purposes": ["hcm.benefits.plan.publish", "HRIS_BENEFIT_PLAN_REFETCH"],
        "refetch": {"mode": "FIELD_ALLOWLIST", "ownerSession": "HRIS-HRM",
                    "endpoint": "/internal/hris-people/v1/benefit-plans/{planId}",
                    "version": "planId+aggregateVersion exact; no latest fallback",
                    "allowedFields": ["planId", "planCode", "aggregateVersion", "status", "validFrom",
                                      "validTo", "eligibilityPolicyVersionId", "coverageConfigurationDigest",
                                      "payrollTreatmentCode"]},
    },
    "BenefitEnrollmentDecided.v2": {
        "consumerSessions": ["HRIS-HRM", "HRIS-PAY"],
        "purposes": ["hcm.benefits.enrollment.decide", "HRIS_BENEFIT_ENROLLMENT_PAYROLL_REFETCH"],
        "refetch": {"mode": "FIELD_ALLOWLIST", "ownerSession": "HRIS-HRM",
                    "endpoint": "/internal/hris-people/v1/benefit-enrollments/{enrollmentId}",
                    "version": "enrollmentId+aggregateVersion exact; no latest fallback",
                    "allowedFields": ["enrollmentId", "aggregateVersion", "planId", "workerPublicId",
                                      "coverageLevel", "effectiveFrom", "effectiveTo", "status",
                                      "payrollTreatmentCode"]},
    },
    "WorkforceScheduleCandidateGenerated.v2": {
        "consumerSessions": ["HRIS-TIM"],
        "purposes": ["hcm.wfm.optimize", "HRIS_WFM_CANDIDATE_REFETCH"],
        "refetch": {"mode": "FIELD_ALLOWLIST", "ownerSession": "HRIS-TIM",
                    "endpoint": "/internal/hris-time/v1/wfm/schedule-candidates/{candidatePublicId}",
                    "version": "candidatePublicId+candidateRevision exact; no latest fallback",
                    "allowedFields": ["candidatePublicId", "candidateRevision", "candidateDigest",
                                      "optimizationRequestId", "forecastId", "inputSnapshotId",
                                      "availabilitySnapshotId", "periodStart", "periodEnd", "shiftLineCount",
                                      "shiftLines.lineKey", "shiftLines.demandLineKey", "shiftLines.workerPublicId",
                                      "shiftLines.assignmentPublicId", "shiftLines.worksitePublicId",
                                      "shiftLines.startsAt", "shiftLines.endsAt", "shiftLines.localWorkDate",
                                      "shiftLines.timeZone", "shiftLines.tzdbVersion",
                                      "shiftLines.startOffsetSeconds", "shiftLines.endOffsetSeconds",
                                      "shiftLines.segments", "shiftLines.calendarSnapshotRef",
                                      "shiftLines.workRuleSnapshotRef", "shiftLines.breakDurationSeconds"]},
    },
    "ApprovedCompensationPlanSnapshotPublished.v2": {
        "consumerSessions": ["HRIS-PER", "HRIS-PAY"],
        "purposes": ["COMPENSATION_PLAN_PUBLISH", "HRIS_APPROVED_COMPENSATION_PLAN_SNAPSHOT_REFETCH"],
        "refetch": {
            "mode": "FIELD_ALLOWLIST",
            "ownerSession": "HRIS-PER",
            "endpoint": "/internal/hris-performance/v1/approved-compensation-plan-snapshots/{snapshotId}",
            "version": "snapshotId+snapshotRevision exact; no latest fallback",
            "allowedFields": [
                "snapshotId", "snapshotRevision", "planId", "cycleId", "approvalRevision",
                "effectiveDate", "lineCount", "payloadDigest", "lines.workerPublicId",
                "lines.assignmentPublicId", "lines.componentCode", "lines.currencyCode",
                "lines.approvedAmount", "lines.effectiveFrom", "lines.effectiveTo", "lines.lineDigest",
            ],
        },
    },
}


STABLE_SUCCESSOR_MAP = {
    "AiAssistanceProduced.v1": ["GovernedAiAssistanceProduced.v2"],
    "AiPolicyChanged.v1": ["GovernedAiPolicyCreated.v2", "GovernedAiPolicyEvaluationRequested.v2",
                            "GovernedAiPolicyEvaluationCompleted.v2", "GovernedAiPolicyPublished.v2",
                            "GovernedAiPolicySuspended.v2", "GovernedAiPolicyRetired.v2"],
    "BenefitAdministrationChanged.v1": ["BenefitPlanCreated.v2", "BenefitPlanPublished.v2",
                                         "BenefitLifeEventSubmitted.v2"],
    "BenefitEnrollmentChanged.v1": ["BenefitEnrollmentSubmitted.v2", "BenefitEnrollmentDecided.v2"],
    "CandidateHired.v1": ["CandidateHired.v2"],
    "CandidateStageChanged.v1": ["CandidateStageChanged.v2", "CandidateOfferIssued.v2",
                                  "CandidateHireHandoffRequested.v2"],
    "CompensationPlanApproved.v1": ["ApprovedCompensationPlanSnapshotPublished.v2"],
    "CompensationPlanChanged.v1": ["CompensationCycleCreated.v2", "CompensationBudgetAllocated.v2",
                                    "CompensationProposalSubmitted.v2", "CompensationPlanApprovalRecorded.v2"],
    "ContingentAccessExpired.v1": ["ContingentAccessExpired.v2"],
    "ContingentEngagementChanged.v1": ["ContingentEngagementCreated.v2", "ContingentEngagementSubmitted.v2",
                                       "ContingentEngagementActivated.v2", "ContingentEngagementOffboardingStarted.v2",
                                       "ContingentEngagementClosed.v2"],
    "GrowthEvidenceLinked.v1": ["GrowthEvidenceLinked.v2"],
    "GrowthProfileChanged.v1": ["GrowthProfileCreated.v2", "GrowthProfileUpdated.v2",
                                 "GrowthCoachingRecorded.v2", "GrowthProfileArchived.v2"],
    "HrCaseChanged.v1": ["HrServiceCaseCreated.v2", "HrServiceCaseTriaged.v2",
                         "HrServiceCaseAssigned.v2", "HrServiceCaseResponseRecorded.v2"],
    "HrCaseResolved.v1": ["HrServiceCaseResolved.v2"],
    "LearningAssignmentChanged.v1": ["LearningEnrollmentCreated.v2", "LearningAssignmentStarted.v2"],
    "LearningCompletionVerified.v1": ["LearningCompletionVerified.v2"],
    "ListeningProgramChanged.v1": ["EmployeeListeningSurveyCreated.v2", "EmployeeListeningSurveyPublished.v2",
                                    "EmployeeListeningSurveyClosed.v2", "EmployeeListeningActionCreated.v2",
                                    "EmployeeListeningActionCompleted.v2"],
    "ListeningSurveyPublished.v1": ["EmployeeListeningSurveyPublished.v2"],
    "MetricDefinitionPublished.v1": ["PeopleMetricPublished.v2"],
    "MetricProjectionChanged.v1": ["PeopleMetricPublished.v2"],
    "OnboardingJourneyChanged.v1": ["OnboardingJourneyAssigned.v2", "OnboardingTaskCompleted.v2",
                                      "OnboardingJourneyCancelled.v2"],
    "OnboardingJourneyCompleted.v1": ["OnboardingJourneyCompleted.v2"],
    "OpportunityApplicationChanged.v1": ["TalentOpportunityApplicationSubmitted.v2",
                                           "TalentOpportunityApplicationShortlisted.v2"],
    "OpportunitySelectionRecorded.v1": ["TalentOpportunitySelectionRecorded.v2"],
    "SkillsTaxonomyPublished.v1": ["SkillsTaxonomyPublished.v2"],
    "SuccessionPlanChanged.v1": ["SuccessionPlanCreated.v2", "SuccessionNominationAdded.v2",
                                  "SuccessionPlanSubmitted.v2", "SuccessionPlanApproved.v2"],
    "SuccessionPlanPublished.v1": ["SuccessionPlanPublished.v2"],
    "WorkerSkillEvidenceVerified.v1": ["WorkerSkillEvidenceVerified.v2"],
    "WorkforcePlanPublished.v1": ["WorkforceScenarioPublished.v2"],
    "WorkforceScenarioChanged.v1": ["WorkforceScenarioCreated.v2", "WorkforceScenarioSimulated.v2",
                                     "WorkforceScenarioSubmitted.v2", "WorkforceScenarioDecisionRecorded.v2"],
    "WorkforceScheduleCandidateGenerated.v1": ["WorkforceScheduleCandidateGenerated.v2"],
    "WorkforceSchedulePublished.v1": ["WorkforceSchedulePublished.v2"],
}


FIXED_EDGE_INVENTORY = [
    "modern.recruiting.requisition.create|INSERT|ppl_rec_requisitions",
    "modern.recruiting.offer.issue|INSERT|ppl_rec_offers",
    "modern.recruiting.hire.record|APPEND|ppl_rec_hire_handoff_receipts",
    "modern.onboarding.template.create|INSERT|ppl_jny_templates",
    "modern.onboarding.journey.assign|INSERT|ppl_jny_assignments",
    "modern.onboarding.task.complete|APPEND|ppl_jny_task_evidence",
    "modern.workforceplan.scenario.create|INSERT|ppl_wfp_scenarios",
    "modern.workforceplan.scenario.create|INSERT|ppl_wfp_scenario_revisions",
    "modern.workforceplan.scenario.simulate|APPEND|ppl_wfp_scenario_revisions",
    "modern.workforceplan.scenario.submit|APPEND|ppl_wfp_scenario_revisions",
    "modern.workforceplan.scenario.approve|APPEND|ppl_wfp_scenario_revisions",
    "modern.workforceplan.scenario.publish|APPEND|ppl_wfp_publish_receipts",
    "modern.workforceplan.scenario.publish|APPEND|ppl_wfp_scenario_revisions",
    "modern.benefits.plan.create|INSERT|ppl_bnf_plans",
    "modern.benefits.enrollment.submit|INSERT|ppl_bnf_enrollments",
    "modern.benefits.lifeevent.submit|INSERT|ppl_bnf_life_events",
    "modern.hrservice.case.create|INSERT|ppl_hrs_cases",
    "modern.hrservice.case.create|INSERT|ppl_hrs_case_actions",
    "modern.hrservice.case.triage|APPEND|ppl_hrs_case_actions",
    "modern.hrservice.case.assign|APPEND|ppl_hrs_case_actions",
    "modern.hrservice.case.respond|APPEND|ppl_hrs_case_actions",
    "modern.hrservice.case.resolve|APPEND|ppl_hrs_case_actions",
    "modern.contingent.engagement.create|INSERT|ppl_cwk_engagements",
    "modern.skills.taxonomy.create|INSERT|prf_skl_taxonomies",
    "modern.skills.taxonomy.create|INSERT|prf_skl_taxonomy_versions",
    "modern.growth.profile.create|INSERT|prf_grw_profiles",
    "modern.growth.profile.create|INSERT|prf_grw_aspirations",
    "modern.growth.evidence.link|APPEND|prf_grw_evidence_links",
    "modern.learning.offering.create|INSERT|prf_lrn_offerings",
    "modern.learning.offering.create|INSERT|prf_lrn_assignments",
    "modern.learning.self.enroll|INSERT|prf_lrn_assignments",
    "modern.opportunity.create|INSERT|prf_mkt_opportunities",
    "modern.opportunity.create|INSERT|prf_mkt_applications",
    "modern.opportunity.apply|INSERT|prf_mkt_applications",
    "modern.opportunity.shortlist|APPEND|prf_mkt_match_explanations",
    "modern.succession.plan.create|INSERT|prf_suc_plans",
    "modern.succession.nomination.add|APPEND|prf_suc_nominations",
    "modern.compplan.cycle.create|INSERT|prf_cmp_cycles",
    "modern.compplan.budget.allocate|APPEND|prf_cmp_budget_ledger",
    "modern.compplan.snapshot.publish|APPEND|prf_cmp_approved_snapshots",
    "modern.compplan.snapshot.publish|APPEND|prf_cmp_approved_snapshot_lines",
    "modern.wfm.forecast.create|INSERT|tme_wfm_demand_forecasts",
    "modern.wfm.schedule.optimize|INSERT|tme_wfm_schedule_candidates",
    "modern.wfm.schedule.optimize|APPEND|tme_wfm_constraint_evaluation_receipts",
    "modern.wfm.schedule.optimize|APPEND|tme_wfm_schedule_publish_ledger",
    "modern.wfm.schedule.validate|APPEND|tme_wfm_constraint_evaluation_receipts",
    "modern.wfm.schedule.submit|APPEND|tme_wfm_constraint_evaluation_receipts",
    "modern.wfm.schedule.publish|APPEND|tme_wfm_schedule_publish_ledger",
    "modern.listening.response.submit|INSERT|sys_hris_listening_responses",
    "modern.listening.survey.create|INSERT|sys_hris_listening_surveys",
    "modern.listening.action.create|APPEND|sys_hris_listening_actions",
    "modern.analytics.metric.create|INSERT|sys_hris_metric_definitions",
    "modern.analytics.metric.create|INSERT|sys_hris_metric_versions",
    "modern.analytics.metric.create|INSERT|sys_hris_metric_projections",
    "modern.analytics.export.create|APPEND|sys_hris_analytics_export_receipts",
    "modern.ai.assist.create|INSERT|sys_hris_ai_provenance_receipts",
    "modern.ai.policy.create|INSERT|sys_hris_ai_use_policies",
    "modern.ai.policy.create|INSERT|sys_hris_ai_policy_versions",
]


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def canonical_hash(document: dict[str, Any]) -> str:
    payload = {key: value for key, value in document.items() if key != "sealedPayloadSha256"}
    raw = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(raw).hexdigest()


def snake(name: str) -> str:
    return re.sub(r"(?<!^)(?=[A-Z])", "_", name).lower()


def table_columns(exact: dict[str, Any]) -> dict[str, dict[str, dict[str, Any]]]:
    common = exact["commonTableContract"]["columns"]
    result = {}
    for table in exact["tableSpecifications"]:
        result[table["tableName"]] = {
            row["name"]: row for row in [table["idColumn"], *common, *table["columns"]]
        }
    # The immutable intermediate predates reviewer-required physical deltas.
    # Merge only the explicit delta set above so type/source validation never
    # depends on a later mutable candidate DDL.
    common_by_name = {row["name"]: row for row in common}
    for table_name, delta in REQUIRED_TABLE_DELTAS.items():
        table = result.setdefault(table_name, {name: dict(row) for name, row in common_by_name.items()})
        table.setdefault("public_id", {"name": "public_id", "sqlType": "UUID"})
        table.setdefault("aggregate_version", {"name": "aggregate_version", "sqlType": "BIGINT"})
        for column_name, sql_type in delta.get("requiredColumns", {}).items():
            table[column_name] = {"name": column_name, "sqlType": sql_type}
    return result


def module_transitions() -> dict[str, dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {}
    for key in ("hrmModule", "perModule", "timModule", "sysModule"):
        document = load_json(SOURCE_PATHS[key])
        for capability in document["capabilities"]:
            for machine in capability["stateMachines"]:
                for transition in machine["transitions"]:
                    operation_id = transition["operationId"]
                    pre = transition.get("preStates") or str(transition.get("from", "")).split("|")
                    post = transition.get("postStates") or str(transition.get("to", "")).split("|")
                    result[operation_id] = {
                        "transitionId": transition["transitionId"],
                        "preStates": [item for item in pre if item],
                        "postStates": [item for item in post if item],
                        "postStateSource": transition.get("postStateSource", "REVIEWED_DOMAIN_RULE"),
                        "root": transition.get("aggregateRootTable"),
                        "stateColumn": transition.get("stateColumn"),
                    }
    return result


def stable_event_sources() -> dict[str, dict[str, Any]]:
    result = {}
    for key in ("hrmModule", "perModule", "timModule", "sysModule"):
        document = load_json(SOURCE_PATHS[key])
        transition_ops = {
            transition["transitionId"]: transition["operationId"]
            for capability in document["capabilities"]
            for machine in capability["stateMachines"]
            for transition in machine["transitions"]
        }
        for capability in document["capabilities"]:
            for event in capability["events"]:
                result[event["name"]] = {
                    "payloadFields": list(event.get("payloadRequired", [])),
                    "producerOperations": [transition_ops.get(item, item) for item in event.get("emittedOn", [])],
                }
    return result


def receipt_table(session: str) -> str:
    return {
        "HRIS-HRM": "ppl_command_receipts",
        "HRIS-PER": "prf_command_receipts",
        "HRIS-TIM": "tme_command_receipts",
        "HRIS-SYS": "sys_hris_command_receipts",
    }[session]


def outbox_table(session: str) -> str:
    return {
        "HRIS-HRM": "ppl_outbox_events",
        "HRIS-PER": "prf_outbox_events",
        "HRIS-TIM": "tme_outbox_events",
        "HRIS-SYS": "sys_hris_outbox_events",
    }[session]


def find_state_column(columns: dict[str, dict[str, dict[str, Any]]], table: str) -> str:
    for name in ("status", "state", "stage"):
        if name in columns.get(table, {}):
            return name
    return "status"


def request_fields(operation: dict[str, Any]) -> list[dict[str, Any]]:
    rows = []
    for section in ("pathParameters", "queryParameters", "headers", "body"):
        section_fields = (REQUEST_BODY_OVERRIDES[operation["operationId"]]
                          if section == "body" and operation["operationId"] in REQUEST_BODY_OVERRIDES
                          else operation["requestSchema"].get(section, []))
        for field in section_fields:
            rows.append({
                "source": f"{section}.{field['name']}",
                "name": field["name"],
                "location": section,
                "type": field["type"],
                "required": bool(field.get("required")),
                "sensitivity": field.get("sensitivity", "INTERNAL"),
                "tokenization": field.get("tokenization", "NONE"),
                **({"referenceContract": field["referenceContract"]} if field.get("referenceContract") else {}),
                **({key: field[key] for key in ("schemaRef", "itemSchemaRef", "minItems", "maxItems",
                                                "uniqueBy", "canonicalOrder") if key in field}),
            })
    return rows


def selector_for_field(operation: dict[str, Any], field: dict[str, Any], root: str | None,
                       columns: dict[str, dict[str, dict[str, Any]]]) -> dict[str, Any] | None:
    source = field["source"]
    reference = field.get("referenceContract") or {}
    entity = reference.get("entityType")
    is_path = field["location"] == "pathParameters"
    if not (is_path or entity):
        return None
    if field["name"].lower() in {"version", "versionno", "revision"}:
        target_table, target_column = VERSION_TARGETS[operation["operationId"]]
        selector_type = "VERSION"
        entity = "table:" + target_table
        id_space = "OWNER_VERSION"
        target_type = columns.get(target_table, {}).get(target_column, {}).get("sqlType", "BIGINT")
        join = "parent public UUID + exact positive version_no"
    elif operation["operationId"] == "modern.ai.kill.switch" and field["name"] == "useCaseKey":
        target_table, target_column, target_type = "sys_hris_ai_use_policies", "use_case_key", "VARCHAR(160)"
        selector_type, entity, id_space = "NATURAL_KEY", "table:sys_hris_ai_use_policies", "NATURAL_KEY"
        join = "tenant + canonical use_case_key"
    elif entity == "HRM.OnboardingTask":
        target_table, target_column, target_type = "ppl_jny_assignment_tasks", "public_id", "UUID"
        selector_type, entity, id_space = "RELATED_PARENT", "table:ppl_jny_assignment_tasks", "PUBLIC_UUID"
        join = "task.journey_assignment_id = selected assignment.internal_id"
    elif operation["operationId"] == "modern.compplan.snapshot.publish" and field["name"] == "planPublicId":
        target_table, target_column, target_type = "prf_cmp_plans", "public_id", "UUID"
        selector_type, entity, id_space = "RELATED_PARENT", "table:prf_cmp_plans", "PUBLIC_UUID"
        join = "plan.compensation_cycle_id = selected cycle.internal_id AND plan.status = APPROVED"
    elif isinstance(entity, str) and entity.startswith("table:"):
        target_table, target_column = entity.removeprefix("table:"), "public_id"
        target_type = columns.get(target_table, {}).get(target_column, {}).get("sqlType", "UUID")
        selector_type = ("QUERY_TARGET" if operation["mode"] == "QUERY" else
                         "ROOT_TARGET" if target_table == root else "RELATED_PARENT")
        id_space = reference.get("idSpace", "PUBLIC_UUID")
        join = ("same root" if target_table == root else
                f"explicit tenant-local FK/path from {root or 'query projection'} to {target_table}")
    elif entity:
        target_table, target_column, target_type = "OWNER_PORT::" + entity, "publicId", field["type"]
        selector_type, id_space = "OWNER_PORT", reference.get("idSpace", "PUBLIC_UUID")
        join = f"typed {entity} owner response bound to caller tenant/purpose/version/asOf"
    elif is_path:
        target_table, target_column, target_type = root or "QUERY_PROJECTION", snake(field["name"]), field["type"]
        selector_type, entity, id_space = "NATURAL_KEY", "table:" + target_table, "NATURAL_KEY"
        join = f"tenant + exact {target_column}"
    else:
        return None
    return {
        "source": source,
        "selectorType": selector_type,
        "entityType": entity,
        "idSpace": id_space,
        "sourceType": field["type"],
        "targetTable": target_table,
        "targetColumn": target_column,
        "targetSqlType": target_type,
        "operator": "=",
        "cardinality": "ONE_TO_MANY_ORDER_INDEPENDENT" if str(field["type"]).startswith("ARRAY") else "EXACTLY_ONE",
        "tenantFilter": "tenant_id = authenticatedPrincipal.tenantId",
        "purposeFilter": operation["authorizationCapability"],
        "versionRule": "EXACT_REQUESTED_VERSION_OR_OWNER_CURRENT_FENCE_NO_LATEST_FALLBACK",
        "asOfRule": "REQUEST_ASOF_OR_OWNER_TRANSACTION_TIME",
        "causalJoin": join,
        "failure": "403 wrong tenant/purpose; 404 opaque unknown; 409 wrong parent/version/cardinality; 503 owner proof unavailable",
    }


def direct_mappings(lineage: dict[str, Any]) -> dict[str, list[dict[str, Any]]]:
    result = {}
    for mapping in lineage.get("inputMappings", []):
        result[mapping["source"]] = list(mapping.get("sinks", []))
    # Required-column lineage is a more precise persisted dataflow than a
    # TRANSITION_GUARD label.  Merge its exact sourcePath without accepting a
    # candidate-generated decision_input alias.
    for row in lineage.get("requiredColumnSources", []):
        source = row.get("sourcePath")
        if isinstance(source, str) and source.startswith(("pathParameters.", "queryParameters.", "headers.", "body.")):
            sink = {"kind": "TABLE_COLUMN", "target": row["target"],
                    **({"resolution": row["semanticBinding"]} if row.get("semanticBinding") else {})}
            if sink not in result.setdefault(source, []):
                result[source].append(sink)
    return result


def input_effect(operation: dict[str, Any], field: dict[str, Any], selector: dict[str, Any] | None,
                 mappings: dict[str, list[dict[str, Any]]], root: str | None) -> dict[str, Any]:
    source = field["source"]
    base = {
        "source": source, "type": field["type"], "required": field["required"],
        "sensitivity": field["sensitivity"],
        "requestDigestMember": operation["mode"] == "COMMAND" and source not in {"headers.X-Correlation-ID"},
    }
    if not field["required"]:
        base["absenceSemantics"] = {
            "mode": "EXPLICIT_ABSENT_BRANCH",
            "rule": "no synthetic value; apply documented default or omit nullable/conditional effect",
            "mustTestAbsentAndPresent": True,
        }
    reviewed = REVIEWED_INPUT_EFFECT_OVERRIDES.get((operation["operationId"], source))
    if reviewed is not None:
        return {**base, "effects": reviewed}
    if operation["mode"] == "QUERY":
        if source == "headers.X-Correlation-ID":
            effects = [{"kind": "OBSERVABILITY_CONTEXT", "target": "requestContext.correlationId"}]
        elif selector:
            effects = [{"kind": "QUERY_FILTER", "target": f"{selector['targetTable']}.{selector['targetColumn']}",
                        "selectorType": selector["selectorType"]}]
        elif field["name"] == "asOf":
            effects = [{"kind": "OWNER_EFFECTIVE_TIME_FILTER", "target": "readPlan.asOf"}]
        elif field["name"] == "cursor":
            effects = [{"kind": "PAGINATION_CURSOR_FILTER", "target": "readPlan.cursor",
                        "binding": "tenant+caller+scope+purpose+asOf+sort"}]
        elif field["name"] == "limit":
            effects = [{"kind": "QUERY_LIMIT", "target": "readPlan.limit", "range": "1..200", "default": 50}]
        else:
            effects = [{"kind": "QUERY_FILTER", "target": "readPlan." + snake(field["name"])}]
        return {**base, "effects": effects}
    if source == "headers.X-Correlation-ID":
        return {**base, "effects": [
            {"kind": "OBSERVABILITY_CONTEXT", "target": "requestContext.correlationId"},
            {"kind": "PERSISTED_CONTROL", "target": outbox_table(operation["session"]) + ".correlation_id"},
        ]}
    if source == "headers.Idempotency-Key":
        return {**base, "effects": [{
            "kind": "IDEMPOTENCY_CLAIM", "target": receipt_table(operation["session"]),
            "uniqueKey": "tenant+caller+operation+idempotencyKey", "conflictKey": "canonicalRequestDigest",
        }]}
    if source == "headers.If-Match":
        return {**base, "effects": [{
            "kind": "ROOT_CAS_FILTER", "target": f"{root}.aggregate_version",
            "operator": "=", "rowCount": "EXACTLY_ONE_OR_409_STALE",
        }]}
    if (operation["operationId"], source) in FORBIDDEN_CALLER_ASSERTIONS:
        return {**base, "effects": [{
            "kind": "FORBIDDEN_CALLER_ASSERTION",
            "replacement": FORBIDDEN_CALLER_ASSERTIONS[(operation["operationId"], source)],
            "candidateRequestMustRemoveOrReplace": True,
        }]}
    effects: list[dict[str, Any]] = []
    if selector:
        effects.append({
            "kind": "ENTITY_SELECTOR" if selector["selectorType"] != "OWNER_PORT" else "OWNER_REFETCH",
            "target": f"{selector['targetTable']}.{selector['targetColumn']}",
            "selectorType": selector["selectorType"], "cardinality": selector["cardinality"],
            "pep": {"tenant": "authenticatedPrincipal.tenantId", "purpose": operation["authorizationCapability"],
                    "fieldExposure": "MINIMUM_REQUIRED_FIELDS", "denyOnUnavailable": True},
        })
    table_sinks = [sink for sink in mappings.get(source, []) if sink.get("kind") == "TABLE_COLUMN"]
    for sink in table_sinks:
        effects.append({"kind": "PERSISTED_COLUMN", "target": sink["target"],
                        **({"resolution": sink["resolution"]} if sink.get("resolution") else {})})
    if effects:
        return {**base, "effects": effects}
    name = field["name"]
    if name in DECISION_NAMES or "decision" in name.lower() or "receipt" in name.lower() or "approval" in name.lower():
        effects.append({
            "kind": "PERSISTED_DECISION_RECEIPT",
            "target": receipt_table(operation["session"]) + ".result_reference.decisionReceipt",
            "requiredFields": {
                "ruleId": "REGISTERED_RULE_FOR:" + operation["operationId"] + ":" + source,
                "inputDigestOrRef": source,
                "outcome": "EXPLICIT_ALLOW_DENY_OR_DOMAIN_OUTCOME",
                "decisionVersion": "IMMUTABLE_MONOTONIC_VERSION",
            },
            "mutationDependency": f"{root}.state/version write is conditional on this persisted outcome",
            "sameTransaction": True,
        })
    elif "digest" in name.lower():
        effects.append({
            "kind": "PERSISTED_DERIVED_DIGEST", "target": f"{root}.payload_digest_or_version_digest",
            "rule": "recompute canonical digest and constant-time compare; persist computed value",
        })
    else:
        effects.append({
            "kind": "PERSISTED_BUSINESS_FACT", "target": f"{root}.{snake(name)}",
            "schemaRequirement": "typed column or immutable child/value-object field must exist",
            "observableAssertion": "mutating this input changes the persisted typed fact or produces a domain rejection",
        })
    return {**base, "effects": effects}


def build_dml(operation: dict[str, Any], lineage: dict[str, Any], root: str,
              transition: dict[str, Any], effects: list[dict[str, Any]]) -> list[dict[str, Any]]:
    steps: list[dict[str, Any]] = [{
        "step": 1, "phase": "IN_TRANSACTION", "action": "CLAIM_OR_REPLAY",
        "table": receipt_table(operation["session"]), "role": "COMMAND_RECEIPT",
        "selector": "tenant+caller+operation+idempotencyKey",
        "assignments": {"request_digest": "canonical validated request excluding correlation"},
        "expectedRows": "ONE_NEW_OR_ONE_IDENTICAL_REPLAY",
        "failureInjectionAssertion": "no business/outbox write survives",
    }]
    insert_by_table: dict[str, dict[str, str]] = {}
    mutation_by_table: dict[str, dict[str, str]] = {}
    for item in lineage.get("requiredColumnSources", []):
        if "." in item.get("target", ""):
            table, column = item["target"].split(".", 1)
            insert_by_table.setdefault(table, {})[column] = item.get("sourcePath") or item.get("source") or item.get("derivation") or "REVIEW_REQUIRED"
    for item in lineage.get("mutationFieldSources", []):
        if "." in item.get("target", ""):
            table, column = item["target"].split(".", 1)
            source = item.get("sourcePath") or item.get("source") or item.get("derivation") or "REVIEW_REQUIRED"
            mutation_by_table.setdefault(table, {})[column] = source
            insert_by_table.setdefault(table, {})[column] = source
    for mapping in lineage.get("inputMappings", []):
        for sink in mapping.get("sinks", []):
            if sink.get("kind") == "TABLE_COLUMN" and "." in sink.get("target", ""):
                table, column = sink["target"].split(".", 1)
                mutation_by_table.setdefault(table, {})[column] = mapping["source"]
                insert_by_table.setdefault(table, {})[column] = mapping["source"]
    domain = CRITICAL_DML.get(operation["operationId"])
    if domain is None:
        domain = []
        for write in lineage.get("writeSet", []):
            table = write["table"]
            if (operation["operationId"], table) in FORBIDDEN_EDGE_REASONS:
                continue
            action = write.get("disposition", "UPDATE")
            if (operation["operationId"], table) in FORCED_INSERT:
                action = "INSERT"
            if table == root and transition["preStates"] != ["NONE"]:
                action = "UPDATE_CAS"
            domain.append({"action": action, "table": table,
                           "role": "CONCURRENCY_ROOT" if table == root else "RELATED_WRITE",
                           "assignments": {}})
    # Do not merge remediation/candidate assignments here.  Earlier drafts did
    # so and silently introduced body fields that did not exist in the public
    # request.  The independent oracle accepts only lineage mappings plus the
    # explicit CRITICAL_DML reviewer decisions above.
    hrm_assignments: dict[str, dict[str, Any]] = {}
    for row in domain:
        step = dict(row)
        update_action = row["action"].startswith("UPDATE")
        assignments = ({} if operation["operationId"] in CRITICAL_DML else
                       dict((mutation_by_table if update_action else insert_by_table).get(row["table"], {})))
        assignments.update(hrm_assignments.get(row["table"], {}))
        assignments.update(row.get("assignments", {}))
        if row["action"] in {"INSERT", "INSERT_MANY", "APPEND", "APPEND_MANY", "UPSERT"}:
            assignments.setdefault("tenant_id", "authenticatedPrincipal.tenantId")
            assignments.setdefault("created_by", "authenticatedPrincipal.publicId")
            assignments.setdefault("correlation_id", "headers.X-Correlation-ID")
            if row.get("role") in {"CONCURRENCY_ROOT", "VERSION_ROOT", "ASSIGNMENT_ROOT", "FORECAST_ROOT",
                                   "ASYNC_REQUEST_ROOT", "ENROLLMENT_ROOT", "IMMUTABLE_APPROVED_PLAN_HEADER",
                                   "IMMUTABLE_HEADER", "TEMPLATE_IDENTITY", "PLAN_IDENTITY"}:
                assignments.setdefault("aggregate_version", "CONSTANT:1")
        if not assignments and row["action"] != "CALL_OWNER_PORT":
            assignments = {"__oracle_error__": "EXACT_COLUMN_SOURCE_MAP_REQUIRED_BEFORE_G3"}
        if update_action:
            for immutable in ("tenant_id", "public_id", "created_at", "created_by", "correlation_id"):
                assignments.pop(immutable, None)
            assignments.setdefault("updated_at", "context.ownerClock.transactionNow")
            assignments.setdefault("updated_by", "authenticatedPrincipal.publicId")
            if row["table"] == root:
                state_column = transition["physicalPostStateSink"].split(".", 1)[1]
                assignments.setdefault(state_column, transition["postStateSource"])
                assignments.setdefault("aggregate_version", "PRE+1")
        step["assignments"] = assignments
        step.update({
            "step": len(steps) + 1,
            "phase": "IN_TRANSACTION",
            "selector": ("tenant+exact public/version/parent selector+If-Match" if "UPDATE" in row["action"]
                         else "owner-generated replay-stable identity + exact parent selectors"),
            "expectedRows": ("EXACTLY_ONE" if row["action"] not in {"INSERT_MANY", "APPEND_MANY", "CALL_OWNER_PORT"}
                             else "EXACTLY_VALIDATED_COLLECTION_CARDINALITY"),
            "failureInjectionAssertion": "all earlier domain/control rows and outbox roll back",
        })
        steps.append(step)
    decision_effects = [effect for item in effects for effect in item["effects"]
                        if effect["kind"] == "PERSISTED_DECISION_RECEIPT"]
    decision_sources = [item["source"] for item in effects
                        if any(effect["kind"] == "PERSISTED_DECISION_RECEIPT" for effect in item["effects"])]
    for step in steps:
        if step.get("table") == root and step.get("role") != "COMMAND_RECEIPT" and decision_sources:
            step["decisionDependencies"] = decision_sources
    steps.append({
        "step": len(steps) + 1, "phase": "IN_TRANSACTION", "action": "COMPLETE_RECEIPT",
        "table": receipt_table(operation["session"]), "role": "COMMAND_RECEIPT",
        "selector": "claimed receipt row",
        "assignments": {
            "result_reference": "closed typed response with exact aggregate IDs/versions",
            "decision_receipts": decision_effects,
        },
        "expectedRows": "EXACTLY_ONE", "mutationDependency": "references committed domain result",
        "failureInjectionAssertion": "domain rows and outbox roll back",
    })
    steps.append({
        "step": len(steps) + 1, "phase": "IN_TRANSACTION", "action": "APPEND_EVENTS",
        "table": outbox_table(operation["session"]), "role": "TRANSACTIONAL_OUTBOX",
        "selector": "one row per actually matched unconditional/conditional event",
        "assignments": {"aggregate_id": "post-state subject public ID", "payload": "canonical committed fact",
                        "correlation_id": "headers.X-Correlation-ID"},
        "expectedRows": "PRIMARY_FACTS_PLUS_TRUE_CONDITIONAL_FACTS",
        "failureInjectionAssertion": "domain rows and receipt roll back",
    })
    return steps


def apply_reviewed_persistence_bindings(operation_id: str, effects: list[dict[str, Any]],
                                        dml: list[dict[str, Any]]) -> None:
    """Materialize the explicit per-operation reviewer bindings above."""
    by_table = {step.get("table"): step for step in dml
                if step.get("role") not in {"COMMAND_RECEIPT", "TRANSACTIONAL_OUTBOX"}}
    for augment in REVIEWED_DML_AUGMENTS.get(operation_id, []):
        table, column = augment["target"].split(".", 1)
        if table not in by_table:
            raise ValueError(f"reviewed DML augment table missing for {operation_id}: {table}")
        by_table[table].setdefault("assignments", {})[column] = augment["expression"]
    effect_by_source = {row["source"]: row for row in effects}
    persisted_kinds = {"PERSISTED_COLUMN", "PERSISTED_BUSINESS_FACT", "PERSISTED_DERIVED_DIGEST"}
    for (bound_operation, source), bindings in REVIEWED_PERSISTENCE_BINDINGS.items():
        if bound_operation != operation_id or source not in effect_by_source:
            continue
        input_row = effect_by_source[source]
        retained = [effect for effect in input_row.get("effects", [])
                    if effect.get("kind") not in persisted_kinds]
        replacement: list[dict[str, Any]] = []
        for binding in bindings:
            target = binding["target"]
            if binding["mode"] == "MATCH":
                replacement.append({
                    "kind": "LOCKED_FACT_MATCH", "target": target,
                    "operator": "CONSTANT_TIME_EQUAL" if "Digest" in source else "=",
                    "onMismatch": "409 LOCKED_FACT_CONFLICT",
                    "observableAssertion": "changed input rejects before root/receipt/outbox commit",
                    "mutationDependency": f"{operation_id} domain mutation is conditional on this exact locked match",
                })
                continue
            table, column = target.split(".", 1)
            if table not in by_table:
                raise ValueError(f"reviewed persistence table missing for {operation_id}:{source}: {table}")
            expression = binding.get("expression", source)
            if not input_row.get("required") and expression == source:
                expression += " IF PRESENT"
            by_table[table].setdefault("assignments", {})[column] = expression
            prior_kind = next((effect.get("kind") for effect in input_row.get("effects", [])
                               if effect.get("kind") in persisted_kinds), "PERSISTED_BUSINESS_FACT")
            replacement.append({
                "kind": prior_kind, "target": target,
                "observableAssertion": "mutating this input changes the exact persisted fact or rejects the command",
            })
        input_row["effects"] = retained + replacement


def bind_effects_to_reviewed_dml(effects: list[dict[str, Any]], dml: list[dict[str, Any]]) -> None:
    """Replace fallback effect labels with the exact reviewed physical sink.

    The input lineage sometimes named a generic aggregate property while its
    reviewed DML already carried the real table/column source.  The oracle must
    not preserve that ambiguity.  This pass only follows an exact request-source
    assignment already present in reviewer-owned DML; it never invents a sink
    from a candidate writesTables list.
    """
    targets_by_source: dict[str, list[str]] = {}
    for step in dml:
        table = step.get("table")
        if not table or step.get("role") in {"COMMAND_RECEIPT", "TRANSACTIONAL_OUTBOX"}:
            continue
        for column, source in (step.get("assignments") or {}).items():
            if isinstance(source, str) and source.startswith(("body.", "pathParameters.",
                                                               "queryParameters.", "headers.")):
                targets_by_source.setdefault(source, []).append(f"{table}.{column}")
    for input_row in effects:
        exact_targets = list(dict.fromkeys(targets_by_source.get(input_row["source"], [])))
        if not exact_targets:
            continue
        rewritten: list[dict[str, Any]] = []
        for effect in input_row.get("effects", []):
            if effect.get("kind") in {"PERSISTED_COLUMN", "PERSISTED_BUSINESS_FACT",
                                      "PERSISTED_DERIVED_DIGEST"}:
                for target in exact_targets:
                    rewritten.append({**effect, "target": target})
            else:
                rewritten.append(effect)
        # Avoid duplicate lineage sinks while preserving the order in which the
        # independently reviewed DML exposes them.
        seen: set[str] = set()
        input_row["effects"] = []
        for effect in rewritten:
            fingerprint = json.dumps(effect, ensure_ascii=False, sort_keys=True)
            if fingerprint not in seen:
                seen.add(fingerprint)
                input_row["effects"].append(effect)


def default_event_name(operation: dict[str, Any]) -> str:
    return PRIMARY_EVENT_NAMES[operation["operationId"]]


def allowed_consumers(event_name: str, session: str, cross_rows: list[dict[str, str]]) -> list[str]:
    consumers = {session}
    for row in cross_rows:
        if row.get("canonical_name") == event_name:
            consumers.update(item for item in row.get("consumer_sessions", "").split("|") if item)
    return sorted(consumers)


def event_source_kind(source: str, field_name: str) -> str:
    if field_name == "occurredAt":
        return "OWNER_TRANSACTION_CLOCK"
    if field_name == "correlationId":
        return "TRACE_CONTEXT"
    if source.startswith("LOCKED_PRE:"):
        return "LOCKED_PRE_STATE"
    if source.startswith("CONSTANT:"):
        return "DERIVED_DOMAIN_FACT"
    if source.startswith("ownerRefetch."):
        return "OWNER_REFETCH"
    if source.startswith("ownerAck."):
        return "OWNER_ACK"
    if "." in source:
        return "PHYSICAL_POST_STATE"
    return "__oracle_error__"


def event_wire_type(field_name: str, source: str,
                    columns: dict[str, dict[str, dict[str, Any]]]) -> str:
    canonical = {
        "aggregateId": "UUID", "fromState": "STRING", "toState": "STRING",
        "aggregateVersion": "BIGINT", "occurredAt": "TIMESTAMPTZ", "correlationId": "UUID",
    }
    if field_name in canonical:
        return canonical[field_name]
    if "." in source and not source.startswith(("ownerRefetch.", "ownerAck.")):
        table_name, column_name = source.split(".", 1)
        sql_type = str(columns.get(table_name, {}).get(column_name, {}).get("sqlType", "")).upper()
        if sql_type:
            if sql_type == "CHAR(64)" and ("digest" in field_name.lower() or "hash" in field_name.lower()):
                return "SHA256"
            if sql_type.startswith("VARCHAR") or sql_type.startswith("CHAR") or sql_type == "TEXT":
                return "STRING"
            if sql_type.startswith("NUMERIC") or sql_type.startswith("DECIMAL"):
                return sql_type
            if sql_type == "JSONB":
                return "JSON"
            if sql_type.endswith("[]"):
                return "ARRAY<" + sql_type[:-2] + ">"
            return sql_type
    lower = field_name.lower()
    if lower.endswith("digest") or lower.endswith("hash"):
        return "SHA256"
    if lower.endswith("at"):
        return "TIMESTAMPTZ"
    if lower.endswith("date") or lower in {"validfrom", "validto", "effectivefrom", "effectiveto"}:
        return "DATE"
    if lower.endswith("count") or lower in {"proficiencylevel"}:
        return "INTEGER"
    if lower.endswith("version") or lower.endswith("revision"):
        return "BIGINT"
    if lower.endswith("ids"):
        return "ARRAY<UUID>"
    if lower.endswith("id") or lower.endswith("publicid"):
        return "UUID"
    if lower.startswith("is") or lower.endswith("flag") or lower.endswith("visible"):
        return "BOOLEAN"
    return "STRING"


def event_field(field_name: str, source: str,
                columns: dict[str, dict[str, dict[str, Any]]]) -> dict[str, Any]:
    wire_type = event_wire_type(field_name, source, columns)
    lower = field_name.lower()
    restricted = any(token in lower for token in (
        "worker", "employment", "assignment", "person", "principal", "respondent", "candidatecase",
    ))
    sensitivity = "RESTRICTED" if restricted else "INTERNAL"
    tokenization = ("OPAQUE_PUBLIC_ID" if wire_type == "UUID"
                    else "NONREVERSIBLE_DIGEST" if wire_type == "SHA256" else "NONE")
    row: dict[str, Any] = {
        "name": field_name,
        "type": wire_type,
        "required": True,
        "sourceKind": event_source_kind(source, field_name),
        "source": source,
        "sensitivity": sensitivity,
        "tokenization": tokenization,
        "validation": "exact committed owner fact under the stated emission condition",
    }
    if wire_type == "UUID" and "." in source and not source.startswith(("ownerRefetch.", "ownerAck.")):
        table_name, column_name = source.split(".", 1)
        row["referenceContract"] = {
            "entityType": "table:" + table_name,
            "idSpace": "PUBLIC_UUID" if column_name == "public_id" or column_name.endswith("_public_id")
            else "OWNER_PUBLIC_UUID",
        }
    return row


def build_event(operation: dict[str, Any], root: str, transition: dict[str, Any], spec: dict[str, Any],
                stable: dict[str, dict[str, Any]], cross_rows: list[dict[str, str]],
                columns: dict[str, dict[str, dict[str, Any]]]) -> dict[str, Any]:
    name = spec["name"]
    stable_fields = stable.get(name, {}).get("payloadFields", [])
    fact = EVENT_AGGREGATE_OVERRIDES.get(name, {})
    fact_root = fact.get("table", root)
    state_sink = fact.get("stateSink", transition["physicalPostStateSink"])
    from_source = fact.get("fromStateSource", "LOCKED_PRE:" + state_sink)
    to_source = fact.get("toStateSource", state_sink)
    base_sources = {
        "aggregateId": fact_root + ".public_id",
        "fromState": from_source,
        "toState": to_source,
        "aggregateVersion": fact_root + ".aggregate_version",
        "occurredAt": "context.ownerClock.transactionNow",
        "correlationId": "context.correlationId",
    }
    fields = [event_field(field_name, source, columns) for field_name, source in base_sources.items()]
    source_map = REVIEWED_EVENT_FIELD_SOURCES.get(name, {})
    stable_extras = [field for field in stable_fields if field not in base_sources]
    unresolved = sorted(set(stable_extras) - set(source_map))
    for field_name in unresolved:
        source_map = {**source_map, field_name: "__oracle_error__:UNRESOLVED_STABLE_FIELD"}
    fields.extend(event_field(field_name, source, columns) for field_name, source in source_map.items()
                  if field_name not in base_sources)
    allowed_fields = sorted({field["name"] for field in fields})
    audience_override = EVENT_AUDIENCE_OVERRIDES.get(name, {})
    consumers = audience_override.get("consumerSessions") or allowed_consumers(name, operation["session"], cross_rows)
    purposes = audience_override.get("purposes") or [operation["authorizationCapability"]]
    refetch_override = audience_override.get("refetch", {})
    return {
        "eventName": name,
        "condition": spec["condition"],
        "aggregateEntityType": "table:" + fact_root,
        "emission": {
            "outboxWrite": "SAME_TRANSACTION_AFTER_DOMAIN_AND_RECEIPT_RESULT",
            "brokerPublish": "AFTER_COMMIT_ONLY",
            "rollback": "NO_OUTBOX_OR_PUBLISH_ON_FAILURE",
        },
        "fields": fields,
        "rawRequestMirroringForbidden": True,
        "audience": {
            "classification": "INTERNAL_DOMAIN",
            "allowedConsumerSessions": consumers,
            "allowedPurposes": purposes,
            "fieldExposure": {"mode": "EXACT_ALLOWLIST", "fields": allowed_fields},
            "denyUnknownConsumerOrPurpose": True,
        },
        "refetchContract": {
            "mode": refetch_override.get("mode", "FORBIDDEN"),
            "ownerSession": refetch_override.get("ownerSession", operation["session"]),
            "entityType": "table:" + fact_root,
            **({"endpoint": refetch_override["endpoint"]} if refetch_override.get("endpoint") else {}),
            "allowedFields": refetch_override.get("allowedFields", []),
            "pep": {"tenant": "event.tenantId", "purpose": purposes,
                    "consumerSessionAllowlist": consumers,
                    "fieldExposure": refetch_override.get("allowedFields", []),
                    "reauthorizeEveryCall": True, "denyOnUnavailable": True},
            "version": refetch_override.get("version", "event.aggregateVersion exact; no latest fallback"),
            "asOf": "event.occurredAt",
        },
    }


def command_transaction_envelope(operation_id: str, session: str) -> dict[str, Any]:
    """Reviewer-owned transaction invariant shared by every public command."""
    return {
        "scope": "ONE_DATABASE_TRANSACTION_PER_COMMAND_ATTEMPT",
        "receiptTable": receipt_table(session),
        "claim": {
            "key": "tenantId+callerPrincipalId+operationId+idempotencyKey",
            "digest": "canonical validated business request excluding correlationId",
            "new": "insert IN_PROGRESS receipt and continue",
        },
        "replay": {
            "identicalDigest": "return the same completed receipt result/public IDs/versions; zero writes/outbox",
            "differentDigest": "409 IDEMPOTENCY_CONFLICT; zero writes/outbox",
            "inProgress": "409 RETRY_LATER or deterministic lease recovery; never execute domain DML twice",
        },
        "mutation": "all ordered domain DML depends on the claimed receipt and all persisted decision outcomes",
        "complete": "persist closed result reference and decision receipts only after every domain assertion succeeds",
        "outbox": "append only the committed primary/conditional facts in the same transaction after receipt completion",
        "rollback": "any failure after claim or after any ordered step rolls back receipt, domain, decision and outbox rows",
        "afterCommit": "AFTER_COMMIT_ONLY broker publication after database commit",
        "operationBinding": operation_id,
    }


def build_unsealed_draft_from_evidence_for_review_only() -> dict[str, Any]:
    exact = load_json(SOURCE_PATHS["exact"])
    columns = table_columns(exact)
    transitions = module_transitions()
    stable = stable_event_sources()
    with SOURCE_PATHS["crossModule"].open(newline="", encoding="utf-8") as stream:
        cross_rows = list(csv.DictReader(stream))
    operations = []
    lineages = {row["operationId"]: row for row in exact["operationFieldLineage"]}
    for operation in exact["operationBindings"]:
        operation_id = operation["operationId"]
        fields = request_fields(operation)
        if operation["mode"] == "QUERY":
            selectors = [selector for field in fields
                         if (selector := selector_for_field(operation, field, None, columns))]
            effects = [input_effect(operation, field,
                                    next((item for item in selectors if item["source"] == field["source"]), None),
                                    direct_mappings(lineages[operation_id]), None) for field in fields]
            operations.append({
                "operationId": operation_id, "capabilityId": operation["capabilityId"],
                "session": operation["session"], "mode": "QUERY", "method": operation["method"],
                "path": operation["path"], "authorizationCapability": operation["authorizationCapability"],
                "requestFields": fields, "inputEffects": effects, "selectors": selectors,
                "readPlan": {"tables": operation.get("readsTables", []), "selectors": selectors,
                             "effectiveTime": "query.asOf or owner transaction time",
                             "pagination": "tenant+caller+scope+purpose+asOf+sort-bound cursor",
                             "writesForbidden": True, "receiptsForbidden": True, "outboxForbidden": True},
                "orderedDml": [], "events": [],
            })
            continue
        candidate_transition = transitions.get(operation_id, {})
        root = (ROOT_OVERRIDES.get(operation_id, (None, None))[0]
                or candidate_transition.get("root")
                or operation.get("writesTables", [None])[0])
        state_column = (ROOT_OVERRIDES.get(operation_id, (None, None))[1]
                        or candidate_transition.get("stateColumn")
                        or find_state_column(columns, root))
        transition = {
            "transitionId": candidate_transition.get("transitionId", operation_id + ".reviewed-transition"),
            "preStates": candidate_transition.get("preStates", ["NONE"]),
            "postStates": candidate_transition.get("postStates", ["REVIEW_REQUIRED"]),
            "postStateSource": candidate_transition.get("postStateSource", "REVIEWED_DOMAIN_RULE"),
            "physicalPostStateSink": root + "." + state_column,
            "checkCompatibility": "ALL_POST_STATES_MUST_BE_ACCEPTED_BY_NAMED_DDL_CHECK",
        }
        transition.update(TRANSITION_OVERRIDES.get(operation_id, {}))
        selectors = [selector for field in fields
                     if (selector := selector_for_field(operation, field, root, columns))]
        if transition["preStates"] == ["NONE"] and not any(item["selectorType"] == "ROOT_TARGET" for item in selectors):
            selectors.append({
                "source": "OWNER_GENERATED_UUID_V7", "selectorType": "GENERATED_ROOT",
                "entityType": "table:" + root, "idSpace": "PUBLIC_UUID", "sourceType": "UUID",
                "targetTable": root, "targetColumn": "public_id", "targetSqlType": "UUID",
                "operator": "ALLOCATE_ONCE", "cardinality": "EXACTLY_ONE",
                "tenantFilter": "tenant_id = authenticatedPrincipal.tenantId",
                "purposeFilter": operation["authorizationCapability"],
                "versionRule": "IDEMPOTENT_REPLAY_RETURNS_SAME_ID_AND_VERSION",
                "asOfRule": "OWNER_TRANSACTION_TIME", "causalJoin": "NEW_ROOT_IDENTITY",
                "failure": "allocation/receipt conflict rolls back",
            })
        mappings = direct_mappings(lineages[operation_id])
        effects = [input_effect(operation, field,
                                next((item for item in selectors if item["source"] == field["source"]), None),
                                mappings, root) for field in fields]
        event_specs = EVENT_OVERRIDES.get(operation_id, [{"name": default_event_name(operation), "condition": "ALWAYS"}])
        event_rows = [build_event(operation, root, transition, spec, stable, cross_rows, columns) for spec in event_specs]
        dml = build_dml(operation, lineages[operation_id], root, transition, effects)
        apply_reviewed_persistence_bindings(operation_id, effects, dml)
        bind_effects_to_reviewed_dml(effects, dml)
        operations.append({
            "operationId": operation_id, "capabilityId": operation["capabilityId"],
            "session": operation["session"], "mode": "COMMAND", "method": operation["method"],
            "path": operation["path"], "authorizationCapability": operation["authorizationCapability"],
            "requestFields": fields, "inputEffects": effects, "selectors": selectors,
            "forbiddenRequestFields": [
                {"source": source, "reason": reason}
                for (forbidden_operation, source), reason in FORBIDDEN_CALLER_ASSERTIONS.items()
                if forbidden_operation == operation_id
            ],
            "aggregateRoot": {"table": root, "publicIdColumn": "public_id",
                              "versionColumn": "aggregate_version", "stateColumn": state_column,
                              "choice": "REVIEWED_LIFECYCLE_ROOT_NOT_FIRST_WRITE"},
            "transition": transition,
            "transactionEnvelope": command_transaction_envelope(operation_id, operation["session"]),
            "orderedDml": dml,
            "events": event_rows,
            "identityConstraints": [
                {"kind": "PATH_BODY_EQUALITY", "left": left, "right": right, "onMismatch": "409"}
                for left, right in PATH_BODY_EQUALITY.get(operation_id, [])
            ] + ([{
                "kind": "PAIRWISE_DISTINCT_TYPED_IDENTITIES",
                "fields": ["snapshotId", "planId", "cycleId"],
                "sources": ["prf_cmp_approved_snapshots.public_id", "prf_cmp_approved_snapshots.plan_public_id",
                            "prf_cmp_approved_snapshots.cycle_public_id"],
            }] if operation_id == "modern.compplan.snapshot.publish" else [{
                "kind": "PAIRWISE_DISTINCT_TYPED_IDENTITIES",
                "fields": ["planId", "cycleId"],
                "sources": ["prf_cmp_plans.public_id", "prf_cmp_cycles.public_id"],
            }] if operation_id == "modern.compplan.plan.approve" else []),
        })
    stable_names = sorted(STABLE_SUCCESSOR_MAP)
    lineage_rows = []
    for name in stable_names:
        successors = STABLE_SUCCESSOR_MAP[name]
        if name in successors:
            disposition = "PRESERVED"
        elif len(successors) > 1:
            disposition = "SPLIT"
        else:
            disposition = "SUPERSEDED"
        lineage_rows.append({
            "predecessorEvent": name, "disposition": disposition, "successorEvents": successors,
            "producerConsumerCompatibility": "ALL_REGISTERED_PRODUCERS_CONSUMERS_AND_REQUIRED_FIELDS_EXPLICITLY_MAPPED",
            "registryUpdateSet": ["AsyncAPI", "g3-contract-primary-ownership-register.csv",
                                  "modern-capability-trace-register.csv", "all producer/consumer contract tests"],
            "runtimeDualPublish": {"required": False,
                                   "reason": "Allowed only while predecessor is NOT_STARTED_G3 and no deployed consumer exists; re-evaluate at activation."},
            "orphanForbidden": True,
        })
    document = {
        "oracleId": (
            "dwp.hris.modern.causal-independent-oracle.v2"
            if ACTIVE_PROFILE == SUCCESSOR_PROFILE
            else "dwp.hris.modern.causal-independent-oracle.v1"
        ),
        "schemaVersion": 2 if ACTIVE_PROFILE == SUCCESSOR_PROFILE else 1,
        "status": "SEALED_REVIEW_AUTHORITY_G3_NOT_IMPLEMENTED",
        "ownership": {"role": "INDEPENDENT_REVIEWER", "candidateMayGenerateOrRewrite": False,
                      "candidateModulesForbiddenImports": ["modern_causal_successor.py", "generate_modern_causal_successor.py"],
                      "updateRule": "SEALED_DIGEST_CHANGES_ONLY_BY_EXPLICIT_REVIEWER --review-update; candidate drift never rewrites v1"},
        "preRemediationEvidence": PRE_REMEDIATION_EVIDENCE,
        "reviewedIntermediateInput": REVIEWED_INTERMEDIATE_INPUT,
        "sourcePinsAtReview": {key: {"path": str(path.relative_to(ROOT)),
                                            "sha256": PRE_REMEDIATION_INVENTORY_PINS.get(key, sha256(path)),
                                            "capturedAt": (PRE_REMEDIATION_EVIDENCE["capturedAt"]
                                                           if key in PRE_REMEDIATION_INVENTORY_PINS else "ORACLE_REVIEW_DRAFT"),
                                            "authority": ("INVENTORY_EVIDENCE_ONLY_NOT_EXPECTED_SEMANTIC_AUTHORITY"
                                                          if key in {"exact", "events", "semantic", "identity"}
                                                          else "REVIEW_INPUT_EVIDENCE"),
                                            "pinSemantics": "HISTORICAL_REVIEW_INPUT_NOT_LIVE_CANDIDATE_AUTHORITY"}
                               for key, path in SOURCE_PATHS.items()},
        "scope": {"operations": 100, "commands": 81, "queries": 19,
                  "commandCausedPrimaryFactsMinimum": 81,
                  "conditionalOrSystemFactsAllowedAboveMinimum": True,
                  "conditionalCommandFacts": 1,
                  "systemHandlerFacts": 4,
                  "reviewedSuccessorEventSchemas": 86,
                  "stablePredecessorEvents": 32},
        "policies": {
            "selector": "EXACT_TYPED_TARGET_COLUMN_CARDINALITY_TENANT_PURPOSE_VERSION_ASOF_JOIN",
            "inputEffect": "NO_GUARD_OR_REQUEST_DIGEST_ONLY_EFFECT",
            "decision": "POLICY_OR_CONFIRMATION_ONLY_INPUT_REQUIRES_SAME_TX_PERSISTED_DECISION_RECEIPT_AND_MUTATION_DEPENDENCY",
            "query": "READ_PLAN_ONLY_NO_RECEIPT_OUTBOX_OR_MUTATION",
            "dml": "ORDERED_ASSIGNMENTS_SELECTORS_ROW_COUNTS_CAS_RECEIPT_OUTBOX_AND_STEP_ROLLBACK",
            "event": "COMMITTED_FACT_OR_EXPLICIT_TYPED_OWNER_REFETCH; RAW_SENSITIVE_REQUEST_MIRROR_FORBIDDEN",
            "audience": "EXPLICIT_CONSUMER_SESSION_PURPOSE_PEP_AND_FIELD_ALLOWLIST; BLANKET_REFETCH_FORBIDDEN",
            "optional": "ABSENT_AND_PRESENT_BRANCH; NO_OPTIONAL_TO_REQUIRED_WITHOUT_TOTAL_DEFAULT_OR_CONDITIONAL_SCHEMA",
            "identity": "PATH_BODY_EQUALITY_AND_TYPED_PUBLIC_ID_DISTINCTNESS",
        },
        "valueObjects": REVIEWED_VALUE_OBJECTS,
        "schemaOracle": {
            "closure": "EXACT_SET_NO_OMITTED_OR_UNREVIEWED_EXTRA_PRODUCER_TABLE",
            "expectedTableCountDerived": len(EXPECTED_PHYSICAL_TABLES),
            "expectedTables": sorted(EXPECTED_PHYSICAL_TABLES),
            "requiredTableColumnCheckDeltas": REQUIRED_TABLE_DELTAS,
            "stateSinkOperationCountDerived": len(STATE_SINK_OPERATION_DELTAS),
            "stateSinkOperationDeltas": STATE_SINK_OPERATION_DELTAS,
        },
        "operations": operations,
        "systemHandlers": [
            {
                "handlerId": "internal.recruiting.hire-handoff.acknowledge",
                "trigger": "verified HRM HireWorker owner result for a persisted PENDING hire request",
                "aggregateRoot": {"table": "ppl_rec_candidate_cases", "stateColumn": "stage",
                                  "preStates": ["HIRE_PENDING"], "postStates": ["HIRED"]},
                "writes": [
                    {"action": "APPEND", "table": "ppl_rec_hire_handoff_receipts"},
                    {"action": "UPDATE_CAS", "table": "ppl_rec_hire_requests"},
                    {"action": "UPDATE_CAS", "table": "ppl_rec_candidate_cases"},
                ],
                "idempotency": "tenant+hireRequestPublicId+ownerReceiptPublicId+ownerResultDigest",
                "orderedDml": [
                    "lock pending hire request and candidate HIRE_PENDING",
                    "validate worker/employment/assignment refs with HRM owner PEP/purpose/version",
                    "APPEND ppl_rec_hire_handoff_receipts",
                    "UPDATE_CAS hire request PENDING->ACKNOWLEDGED",
                    "UPDATE_CAS candidate HIRE_PENDING->HIRED",
                    "APPEND CandidateHired.v2 outbox",
                ],
                "event": build_event(
                    {"session": "HRIS-HRM", "authorizationCapability": "hcm.recruiting.hire-owner-ack"},
                    "ppl_rec_candidate_cases",
                    {"physicalPostStateSink": "ppl_rec_candidate_cases.stage"},
                    {"name": "CandidateHired.v2", "condition": "VERIFIED_OWNER_ACK"}, stable, cross_rows, columns),
                "retry": "same owner result is no-op/replays same receipt; conflicting result quarantined",
                "reconciliation": "PENDING timeout is recoverable and never fabricates worker ID or HIRED",
                "rollback": "receipt, candidate CAS and outbox are atomic",
            },
            {
                "handlerId": "internal.contingent.access-expiry.enforce",
                "trigger": "owner clock reaches persisted access expiry under active engagement policy",
                "aggregateRoot": {"table": "ppl_cwk_engagements", "stateColumn": "status",
                                  "preStates": ["ACTIVE", "OFFBOARDING"], "postStates": ["OFFBOARDING"]},
                "writes": [
                    {"action": "APPEND", "table": "ppl_cwk_access_expiry_receipts"},
                    {"action": "UPDATE_CAS", "table": "ppl_cwk_engagements"},
                ],
                "idempotency": "tenant+engagementPublicId+accessGrantRevision+expiryInstant",
                "orderedDml": [
                    "lock due tenant-bound engagement in ACTIVE or OFFBOARDING",
                    "verify exact access-owner grant revocation acknowledgement",
                    "APPEND ppl_cwk_access_expiry_receipts",
                    "UPDATE_CAS engagement to OFFBOARDING and increment aggregate_version",
                    "APPEND ContingentAccessExpired.v2 outbox",
                ],
                "event": build_event(
                    {"session": "HRIS-HRM", "authorizationCapability": "hcm.contingent.access-expiry"},
                    "ppl_cwk_engagements",
                    {"physicalPostStateSink": "ppl_cwk_engagements.status"},
                    {"name": "ContingentAccessExpired.v2", "condition": "DUE_AND_VERIFIED_REVOCATION_ACK"},
                    stable, cross_rows, columns),
                "retry": "same grant revision replays; conflicting result is quarantined",
                "reconciliation": "due engagement remains recoverable until one terminal expiry receipt exists",
                "rollback": "scheduler claim, receipt, engagement CAS and outbox are atomic",
            },
            {
                "handlerId": "internal.wfm.schedule-optimization.complete",
                "trigger": "verified deterministic solver-owner result for a persisted REQUESTED optimization request",
                "aggregateRoot": {"table": "tme_wfm_optimization_requests", "stateColumn": "status",
                                  "preStates": ["REQUESTED"], "postStates": ["COMPLETED"]},
                "writes": [
                    {"action": "INSERT", "table": "tme_wfm_schedule_candidates"},
                    {"action": "APPEND_MANY", "table": "tme_wfm_candidate_shift_lines"},
                    {"action": "APPEND", "table": "tme_wfm_constraint_evaluation_receipts"},
                    {"action": "UPDATE_CAS", "table": "tme_wfm_optimization_requests"},
                ],
                "idempotency": "tenant+optimizationRequestId+optimizationOwnerResultId+resultDigest",
                "orderedDml": [
                    "lock tenant-bound optimization request in REQUESTED",
                    "validate owner result/request digest and all frozen input snapshot revisions",
                    "INSERT exactly one tme_wfm_schedule_candidates result root",
                    "APPEND exactly verified result cardinality tme_wfm_candidate_shift_lines with canonical ordering",
                    "APPEND exactly one tme_wfm_constraint_evaluation_receipts result receipt",
                    "UPDATE_CAS optimization request REQUESTED->COMPLETED",
                    "APPEND WorkforceScheduleCandidateGenerated.v2 outbox",
                ],
                "event": build_event(
                    {"session": "HRIS-TIM", "authorizationCapability": "hcm.wfm.optimize"},
                    "tme_wfm_optimization_requests",
                    {"physicalPostStateSink": "tme_wfm_optimization_requests.status"},
                    {"name": "WorkforceScheduleCandidateGenerated.v2", "condition": "VERIFIED_SOLVER_COMPLETION"},
                    stable, cross_rows, columns),
                "retry": "same result replays; different result digest is quarantined",
                "reconciliation": "REQUESTED remains recoverable; failure never fabricates a candidate",
                "rollback": "inbox, candidate, evaluation receipt, request CAS and outbox are atomic",
            },
            {
                "handlerId": "internal.ai.policy-evaluation.complete",
                "trigger": "verified AI evaluation-owner result for a persisted REQUESTED evaluation request",
                "aggregateRoot": {"table": "sys_hris_ai_evaluation_requests", "stateColumn": "status",
                                  "preStates": ["REQUESTED"], "postStates": ["COMPLETED"]},
                "writes": [
                    {"action": "APPEND", "table": "sys_hris_ai_evaluation_receipts"},
                    {"action": "UPDATE_CAS", "table": "sys_hris_ai_use_policies"},
                    {"action": "UPDATE_CAS", "table": "sys_hris_ai_evaluation_requests"},
                ],
                "idempotency": "tenant+evaluationRequestPublicId+ownerResultPublicId+resultDigest",
                "orderedDml": [
                    "lock tenant-bound evaluation request in REQUESTED and its exact policy version",
                    "validate exact policy/model/suite/fixture refs and recompute result digest",
                    "APPEND sys_hris_ai_evaluation_receipts",
                    "UPDATE_CAS policy from outcome: PASSED->EVALUATED; FAILED remains DRAFT",
                    "UPDATE_CAS evaluation request REQUESTED->COMPLETED",
                    "APPEND GovernedAiPolicyEvaluationCompleted.v2 outbox",
                ],
                "event": build_event(
                    {"session": "HRIS-SYS", "authorizationCapability": "hcm.ai.policy.manage"},
                    "sys_hris_ai_evaluation_requests",
                    {"physicalPostStateSink": "sys_hris_ai_evaluation_requests.status"},
                    {"name": "GovernedAiPolicyEvaluationCompleted.v2", "condition": "VERIFIED_EVALUATION_OWNER_ACK"},
                    stable, cross_rows, columns),
                "retry": "same owner result replays; conflicting result quarantined",
                "reconciliation": "REQUESTED remains recoverable; conflicting or failed owner result cannot publish a policy",
                "rollback": "inbox, evaluation receipt, policy/request CAS and outbox are atomic",
            },
        ],
        "criticalTimingContracts": [
            {
                "contractId": "PAY-COMPENSATION-SNAPSHOT-TIMING",
                "forbiddenProducer": "modern.compplan.plan.approve",
                "forbiddenAtApproval": ["ApprovedCompensationPlanSnapshotPublished.v2",
                                        "any PAY-consumable snapshot event"],
                "approvalEvent": "CompensationPlanApprovalRecorded.v2",
                "approvalPlanIdentity": {
                    "table": "prf_cmp_plans", "publicIdColumn": "public_id",
                    "cycleReference": "prf_cmp_plans.compensation_cycle_id -> prf_cmp_cycles.compensation_cycle_id",
                    "creation": "server-generated replay-stable UUID in plan.approve transaction",
                    "distinctFromCycle": True,
                },
                "authoritativeProducer": "modern.compplan.snapshot.publish",
                "precondition": "cycle APPROVED + exact APPROVED prf_cmp_plans public ID + matching target-bound approval receipt",
                "atomicWrites": ["cycle APPROVED->PUBLISHED CAS", "snapshot header", "exactly N snapshot lines",
                                 "command receipt", "ApprovedCompensationPlanSnapshotPublished.v2 outbox"],
                "requiredEventFields": ["snapshotId", "planId", "cycleId", "lineCount", "payloadDigest",
                                        "approvalRevision", "snapshotRevision", "effectiveDate"],
                "consumer": {"session": "HRIS-PAY", "mode": "exact snapshotId/revision refetch",
                             "pep": "tenant+purpose+field allowlist; no latest fallback"},
                "identityRule": "snapshotId, planId and cycleId are typed, pairwise-distinct public identities",
                "negative": "approval-only transaction cannot start PAY consumption or expose a fabricated snapshotId",
            },
        ],
        "eventSuccessorLineage": lineage_rows,
        "negativeRules": [
            "reject any selector without targetTable/targetColumn/selectorType/cardinality",
            "reject any query effect referring to receipt/outbox/write",
            "reject guard, decision_input or request digest as the sole business effect",
            "reject policy/confirmation effect without persisted decision receipt and mutation dependency",
            "reject sourceRequestField or raw request mirroring for RESTRICTED/CONFIDENTIAL event data",
            "reject blanket refetch.allowed=true or missing consumer/purpose/field PEP allowlist",
            "reject event occurredAt from aggregate created_at or domain completed_at",
            "reject exactly-one-event-per-command as a universal invariant",
            "reject missing conditional journey-completed or system-handler stable facts",
            "reject any orphan among 32 stable predecessor events",
            "reject CompensationPlanApproved/PAY consumption from plan.approve before immutable snapshot commit",
        ],
        "sealedPayloadSha256": "",
    }
    event_contracts: dict[str, dict[str, Any]] = {}
    for operation in document["operations"]:
        for event in operation.get("events", []):
            event_contracts[event["eventName"]] = {
                "eventName": event["eventName"],
                "producerOperationId": operation["operationId"],
                "producerSession": operation["session"],
                "payloadFields": [field["name"] for field in event["fields"]],
                "allowedConsumerSessions": event["audience"]["allowedConsumerSessions"],
                "purposeCodes": event["audience"]["allowedPurposes"],
                "refetchMode": event["refetchContract"]["mode"],
                "refetchFieldExposure": event["refetchContract"]["allowedFields"],
            }
    for handler in document["systemHandlers"]:
        event = handler.get("event")
        if event:
            event_contracts[event["eventName"]] = {
                "eventName": event["eventName"],
                "producerHandlerId": handler["handlerId"],
                "producerSession": event["refetchContract"]["ownerSession"],
                "payloadFields": [field["name"] for field in event["fields"]],
                "allowedConsumerSessions": event["audience"]["allowedConsumerSessions"],
                "purposeCodes": event["audience"]["allowedPurposes"],
                "refetchMode": event["refetchContract"]["mode"],
                "refetchFieldExposure": event["refetchContract"]["allowedFields"],
            }
    ownership_rows = []
    for operation in document["operations"]:
        for event in operation.get("events", []):
            ownership_rows.append({
                "eventName": event["eventName"],
                "primaryOwnerSession": operation["session"],
                "producerKind": "PUBLIC_COMMAND",
                "producerId": operation["operationId"],
                "contractBoundary": "PUBLIC_ASYNCAPI_EVENT",
                "ownershipCardinality": "EXACTLY_ONE",
            })
    for handler in document["systemHandlers"]:
        event = handler.get("event")
        if event:
            ownership_rows.append({
                "eventName": event["eventName"],
                "primaryOwnerSession": event["refetchContract"]["ownerSession"],
                "producerKind": "INTERNAL_TRIGGER_PUBLIC_EVENT",
                "producerId": handler["handlerId"],
                "contractBoundary": "PUBLIC_ASYNCAPI_EVENT",
                "ownershipCardinality": "EXACTLY_ONE",
            })
    document["publicEventOwnership"] = {
        "boundaryDecision": (
            "All 86 reviewed v2 schemas are public contracts because they are appended to a transactional "
            "outbox, have an explicit AsyncAPI audience, and may cross process/session boundaries.  An "
            "internal handler describes trigger ownership only; its emitted event is not an internal schema."
        ),
        "expectedOwnedEventCount": 86,
        "expectedOwnerCountsBySession": {"HRIS-HRM": 33, "HRIS-PER": 29, "HRIS-TIM": 6, "HRIS-SYS": 18},
        "registerMigration": {
            "currentModernEventRows": 32,
            "currentRowsRole": "V1_PREDECESSOR_OWNERSHIP_EVIDENCE_ONLY",
            "requiredAction": "supersede via 32 lineage mappings and register every reviewed v2 schema exactly once",
            "unownedSuccessorAllowed": False,
            "duplicateOwnerAllowed": False,
        },
        "events": sorted(ownership_rows, key=lambda row: row["eventName"]),
    }
    for lineage_row in document["eventSuccessorLineage"]:
        lineage_row["successorContracts"] = [event_contracts[name] for name in lineage_row["successorEvents"]]
    if ACTIVE_PROFILE == SUCCESSOR_PROFILE:
        expected = ACTIVE_PROFILE_METADATA["canonicalCounts"]
        observed = {
            "publicOperations": len(document.get("operations", [])),
            "commands": sum(row.get("mode") == "COMMAND" for row in document.get("operations", [])),
            "queries": sum(row.get("mode") == "QUERY" for row in document.get("operations", [])),
            "systemHandlers": len(document.get("systemHandlers", [])),
            "publicEvents": len(document.get("publicEventOwnership", {}).get("events", [])),
            "tableSpecifications": len(document.get("schemaOracle", {}).get("expectedTables", [])),
        }
        if any(observed.get(key) != expected.get(key) for key in observed):
            raise SuccessorProfileError(
                f"successor oracle source-derived closure pending: expected={expected} observed={observed}"
            )
        document["successorProfile"] = {
            "name": ACTIVE_PROFILE,
            "activeGateChain": ACTIVE_PROFILE_METADATA["activeGateChain"],
            "predecessorDisposition": ACTIVE_PROFILE_METADATA["predecessorDisposition"],
            "predecessorPins": ACTIVE_PROFILE_METADATA["predecessorPins"],
            "sourceDerivedCounts": expected,
            "policy": ACTIVE_PROFILE_METADATA["policy"],
        }
    document["sealedPayloadSha256"] = canonical_hash(document)
    return document


def _successor_source_bundle() -> dict[str, Any]:
    """Load only the independently accepted live source closure.

    The successor producer is intentionally unable to resolve a candidate
    directory.  The accepted-live manifest is the authority boundary and its
    helper verifies the complete eight-file closure before any source bytes
    are opened.
    """
    from modern_causal_successor_profile import verify_accepted_live_canonical

    accepted = verify_accepted_live_canonical(BASE, ROOT)
    documents = {
        key: load_json(path)
        for key, path in accepted["sources"].items()
    }
    return {"accepted": accepted, "documents": documents}


def _successor_event_ownership(
    event_document: dict[str, Any],
    operation_rows: list[dict[str, Any]],
    handler_rows: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Expand the accepted event registry into one owner row per event."""
    operations = {row.get("operationId"): row for row in operation_rows}
    handlers = {row.get("handlerId"): row for row in handler_rows}
    rows: list[dict[str, Any]] = []
    for event in event_document.get("eventPayloadSchemas", []):
        name = event.get("eventName")
        operation_ids = list(event.get("emittedByOperationIds") or [])
        handler_ids = list(event.get("emittedByInternalHandlerIds") or [])
        if operation_ids:
            producer_id = operation_ids[0]
            producer = operations.get(producer_id)
            if producer is None:
                raise SuccessorProfileError(
                    f"accepted event registry references unknown operation: {name}:{producer_id}"
                )
            producer_kind = "PUBLIC_COMMAND"
            session = producer.get("session")
        elif handler_ids:
            producer_id = handler_ids[0]
            producer = handlers.get(producer_id)
            if producer is None:
                raise SuccessorProfileError(
                    f"accepted event registry references unknown handler: {name}:{producer_id}"
                )
            producer_kind = "INTERNAL_TRIGGER_PUBLIC_EVENT"
            session = producer.get("session")
        else:
            raise SuccessorProfileError(
                f"accepted event registry event has no independently declared producer: {name}"
            )
        rows.append({
            "eventName": name,
            "primaryOwnerSession": session,
            "producerKind": producer_kind,
            "producerId": producer_id,
            "producerCandidates": operation_ids or handler_ids,
            "contractBoundary": "PUBLIC_ASYNCAPI_EVENT",
            "ownershipCardinality": "EXACTLY_ONE",
            "schemaVersion": event.get("schemaVersion"),
            "payloadSchemaId": event.get("payloadSchemaId"),
            "emissionCondition": event.get("emissionCondition"),
            "allowedConsumerSessions": sorted(
                set(event.get("consumerRefetchPolicy", {}).get("allowedConsumerSessions", []))
                | set(event.get("allowedConsumerSessions", []))
            ),
        })
    names = [row["eventName"] for row in rows]
    if len(names) != len(set(names)):
        raise SuccessorProfileError("accepted event registry contains duplicate public event names")
    return sorted(rows, key=lambda row: row["eventName"])


def build_successor_review_inventory() -> dict[str, Any]:
    """Produce the reviewer-owned v2 inventory from accepted live canonical.

    This is the explicit review-input producer required by P0-02.  It is
    create-only and binds its source pins to the accepted live manifest and an
    independent acceptance record.  No candidate bytes or candidate path are
    consulted, and the PAY producer remains the existing SSOT authority.
    """
    bundle = _successor_source_bundle()
    accepted = bundle["accepted"]
    docs = bundle["documents"]
    ssot = copy.deepcopy(docs["operationSsot"])
    exact = docs["exact"]
    events = docs["events"]
    listening = docs["listeningAuthority"]
    closed_set = docs["closedSet"]
    dependency_receipt = verify_successor_owner_dependencies(
        ssot, label="accepted-live operation SSOT ownerDependencyContracts"
    )
    if dependency_receipt["dependencyContractSeals"] != SUCCESSOR_OWNER_DEPENDENCY_PINS:
        raise SuccessorProfileError("successor owner-dependency seal pin map drift")
    if accepted.get("closedSetManifestPin") != SUCCESSOR_CLOSED_SET_MANIFEST_PIN:
        raise SuccessorProfileError("successor closed-set manifest pin drift")
    for key in ("operationSsot", "exact", "semanticBindings"):
        verify_successor_closed_set_manifest_reference(
            docs[key], label=f"accepted-live {key}.closedSetManifest"
        )
    operations = ssot.get("operations", [])
    handlers = ssot.get("systemHandlers", [])
    expected = dict(SUCCESSOR_CANONICAL_COUNTS)
    observed = {
        "publicOperations": len(operations),
        "commands": sum(row.get("mode") == "COMMAND" for row in operations),
        "queries": sum(row.get("mode") == "QUERY" for row in operations),
        "systemHandlers": len(handlers),
        "publicEvents": len(events.get("eventPayloadSchemas", [])),
        "tableSpecifications": len(exact.get("tableSpecifications", [])),
        "ownerPortOperationContracts": len(ssot.get("ownerPortOperationContracts", [])),
        "ownerDependencyContracts": len(ssot.get("ownerDependencyContracts", [])),
    }
    if observed != expected:
        raise SuccessorProfileError(
            f"accepted live source counts are not the v4 closure: expected={expected} observed={observed}"
        )
    ownership_rows = _successor_event_ownership(events, operations, handlers)
    if len(ownership_rows) != expected["publicEvents"]:
        raise SuccessorProfileError("successor event ownership is not a complete closed set")
    owner_counts: dict[str, int] = {}
    for row in ownership_rows:
        owner_counts[row["primaryOwnerSession"]] = owner_counts.get(row["primaryOwnerSession"], 0) + 1

    inventory = ssot
    inventory["oracleId"] = SUCCESSOR_IDS["oracle"]
    inventory["schemaVersion"] = 2
    inventory["status"] = "SEALED_SUCCESSOR_REVIEW_INVENTORY_ACCEPTED_LIVE_NOT_IMPLEMENTED"
    inventory["ownership"] = {
        "role": "INDEPENDENT_REVIEWER",
        "candidateMayGenerateOrRewrite": False,
        "candidateDirectoriesForbidden": True,
        "candidateAsOracle": False,
        "forbiddenAuthorityInputs": ["candidate", "candidate-dir", "runtime_candidate_import"],
        "updateRule": "CREATE_NEW_ONLY; EXPLICIT_REVIEWER_FINALIZATION_REQUIRED; ACCEPTED_LIVE_BYTES_PINNED",
    }
    inventory["reviewedIntermediateInput"] = {
        "kind": "ACCEPTED_LIVE_CANONICAL_REVIEW_INPUT",
        "manifest": {
            "path": SUCCESSOR_ACCEPTED_LIVE_MANIFEST,
            "fileSha256": accepted["manifestFileSha256"],
            "sealedPayloadSha256": accepted["manifest"].get("sealedPayloadSha256"),
        },
        "independentAcceptance": {
            "path": SUCCESSOR_INDEPENDENT_ACCEPTANCE,
            "fileSha256": accepted["acceptanceFileSha256"],
            "sealedPayloadSha256": accepted["acceptance"].get("sealedPayloadSha256"),
        },
        "authority": "INDEPENDENT_LIVE_CANONICAL_ACCEPTANCE",
        "candidateAsOracle": False,
    }
    inventory["sourcePinsAtReview"] = {
        key: {
            "path": ref["path"],
            "sha256": ref["fileSha256"],
            "authority": "ACCEPTED_LIVE_CANONICAL_SOURCE_ONLY",
        }
        for key, ref in accepted["sourceRefs"].items()
    }
    inventory["scope"] = {
        **dict(inventory.get("scope", {})),
        **expected,
        "stablePredecessorEvents": "SOURCE_DERIVED",
    }
    inventory["schemaOracle"] = {
        **dict(inventory.get("schemaOracle", {})),
        "closure": "EXACT_ACCEPTED_LIVE_TABLE_SPECIFICATION_SET",
        "expectedTableCountDerived": len(exact["tableSpecifications"]),
        "expectedTables": sorted(row["tableName"] for row in exact["tableSpecifications"]),
        "tableSpecifications": copy.deepcopy(exact["tableSpecifications"]),
        "source": "accepted-live:modern-capability-exact-schema-contracts.v1.json",
    }
    inventory["publicEventOwnership"] = {
        **dict(inventory.get("publicEventOwnership", {})),
        "boundaryDecision": "All 157 accepted-live event schemas are public transactional contracts; ownership is registry-derived and exactly one.",
        "expectedOwnedEventCount": expected["publicEvents"],
        "expectedOwnerCountsBySession": dict(sorted(owner_counts.items())),
        "events": ownership_rows,
        "source": "accepted-live:modern-capability-event-payload-contracts.v1.json",
    }
    inventory["eventPayloadSchemas"] = copy.deepcopy(events["eventPayloadSchemas"])
    inventory["acceptedLiveCanonical"] = {
        "manifestPath": SUCCESSOR_ACCEPTED_LIVE_MANIFEST,
        "manifestFileSha256": accepted["manifestFileSha256"],
        "independentAcceptancePath": SUCCESSOR_INDEPENDENT_ACCEPTANCE,
        "independentAcceptanceFileSha256": accepted["acceptanceFileSha256"],
        "listeningAuthorityContractId": listening.get("contractId"),
        "closedSetManifestId": closed_set.get("manifestId"),
        "closedSetManifestPin": dict(SUCCESSOR_CLOSED_SET_MANIFEST_PIN),
        "ownerDependencyReceipt": dependency_receipt,
    }
    inventory["successorProfile"] = {
        "name": ACTIVE_PROFILE,
        "activeGateChain": "successor-v2-accepted-live-review-input",
        "sourceDerivedCounts": expected,
        "policy": dict(SUCCESSOR_POLICY),
        "predecessorDisposition": ACTIVE_PROFILE_METADATA["predecessorDisposition"],
        "predecessorPins": dict(ACTIVE_PROFILE_METADATA["predecessorPins"]),
        "ownerDependencyReceipt": dependency_receipt,
        "closedSetManifestPin": dict(SUCCESSOR_CLOSED_SET_MANIFEST_PIN),
        "payProducerAuthority": "SSOT_CRITICAL_TIMING_CONTRACT_ONLY; NO_NEW_PRODUCER_INVENTED",
    }
    inventory["sealedPayloadSha256"] = canonical_hash(inventory)
    return inventory


def build_successor_review_finalization(inventory: dict[str, Any]) -> dict[str, Any]:
    """Create the independently reviewable finalization overlay for v2."""
    inventory_seal = inventory.get("sealedPayloadSha256")
    if not inventory_seal or canonical_hash(inventory) != inventory_seal:
        raise SuccessorProfileError("successor review inventory must be sealed before finalization")
    dependency_receipt = verify_successor_owner_dependencies(
        inventory, label="successor review inventory ownerDependencyContracts"
    )
    verify_successor_owner_dependency_receipt(
        inventory.get("successorProfile", {}).get("ownerDependencyReceipt"),
        label="successor review inventory ownerDependencyReceipt",
    )
    if inventory.get("acceptedLiveCanonical", {}).get("closedSetManifestPin") != SUCCESSOR_CLOSED_SET_MANIFEST_PIN:
        raise SuccessorProfileError("successor review inventory closed-set manifest pin drift")
    if inventory.get("successorProfile", {}).get("closedSetManifestPin") != SUCCESSOR_CLOSED_SET_MANIFEST_PIN:
        raise SuccessorProfileError("successor review inventory profile manifest pin drift")
    bundle = _successor_source_bundle()
    accepted = bundle["accepted"]
    overlay = {
        "overlayId": "dwp.hris.modern.causal-independent-reviewed-finalization.v2",
        "schemaVersion": 2,
        "status": "SEALED_SUCCESSOR_REVIEW_FINALIZATION_INDEPENDENT_ACCEPTANCE",
        "baseInventory": {
            "path": REVIEW_INVENTORY_PATH.name,
            "fileSha256": sha256(REVIEW_INVENTORY_PATH) if REVIEW_INVENTORY_PATH.is_file() else "PENDING_CREATE_ONLY_INPUT",
            "sealedPayloadSha256": inventory_seal,
        },
        "acceptedLiveCanonical": {
            "manifest": {
                "path": SUCCESSOR_ACCEPTED_LIVE_MANIFEST,
                "fileSha256": accepted["manifestFileSha256"],
                "sealedPayloadSha256": accepted["manifest"].get("sealedPayloadSha256"),
            },
            "independentAcceptance": {
                "path": SUCCESSOR_INDEPENDENT_ACCEPTANCE,
                "fileSha256": accepted["acceptanceFileSha256"],
                "sealedPayloadSha256": accepted["acceptance"].get("sealedPayloadSha256"),
            },
            "candidateAsOracle": False,
            "authority": "INDEPENDENT_LIVE_CANONICAL_ACCEPTANCE",
        },
        "reviewDecision": {
            "accepted": True,
            "reviewerRole": "INDEPENDENT_REVIEWER",
            "independentAcceptanceRequired": True,
            "sourceAuthority": "ACCEPTED_LIVE_CANONICAL_ONLY",
            "counts": dict(SUCCESSOR_CANONICAL_COUNTS),
            "ownerDependencyReceipt": dependency_receipt,
            "closedSetManifestPin": dict(SUCCESSOR_CLOSED_SET_MANIFEST_PIN),
            "payProducerAuthority": "PRESERVE_SSOT_CRITICAL_TIMING_CONTRACT",
        },
        "successorLineage": {
            "predecessorArtifactsRemainPinned": True,
            "predecessorPins": dict(ACTIVE_PROFILE_METADATA["predecessorPins"]),
            "outputSet": dict(SUCCESSOR_ARTIFACTS),
        },
        "sealedPayloadSha256": "",
    }
    overlay["sealedPayloadSha256"] = canonical_hash(overlay)
    return overlay


def _successor_json_bytes(document: dict[str, Any]) -> bytes:
    return (json.dumps(document, ensure_ascii=False, sort_keys=True,
                       separators=(",", ":"), allow_nan=False).encode("utf-8") + b"\n")


def write_successor_review_inputs() -> tuple[dict[str, Any], dict[str, Any]]:
    """Create the v2 review-input pair atomically and create-only."""
    inventory = build_successor_review_inventory()
    # The overlay binds the exact bytes that are about to be published.  Build
    # it once to obtain the source/decision fields, then set the real file pin
    # before sealing and commit both targets together.
    finalization = build_successor_review_finalization(inventory)
    finalization["baseInventory"]["fileSha256"] = hashlib.sha256(
        _successor_json_bytes(inventory)
    ).hexdigest()
    finalization["sealedPayloadSha256"] = canonical_hash(finalization)
    from modern_causal_successor_profile import create_only_pair

    create_only_pair([
        (REVIEW_INVENTORY_PATH, _successor_json_bytes(inventory)),
        (REVIEW_FINALIZATION_PATH, _successor_json_bytes(finalization)),
    ])
    return inventory, finalization


def _successor_verified_review_inputs() -> tuple[dict[str, Any], dict[str, Any]]:
    """Read v2 review inputs and bind them to accepted live canonical."""
    inventory = load_json(REVIEW_INVENTORY_PATH)
    finalization = load_json(REVIEW_FINALIZATION_PATH)
    if inventory.get("sealedPayloadSha256") != canonical_hash(inventory):
        raise SystemExit("successor review inventory semantic seal drift")
    if finalization.get("sealedPayloadSha256") != canonical_hash(finalization):
        raise SystemExit("successor review finalization semantic seal drift")
    if finalization.get("baseInventory", {}).get("fileSha256") != sha256(REVIEW_INVENTORY_PATH):
        raise SystemExit("successor review finalization inventory byte binding drift")
    if finalization.get("baseInventory", {}).get("sealedPayloadSha256") != inventory.get("sealedPayloadSha256"):
        raise SystemExit("successor review finalization inventory seal binding drift")
    try:
        dependency_receipt = verify_successor_owner_dependencies(
            inventory, label="successor review inventory ownerDependencyContracts"
        )
        verify_successor_owner_dependency_receipt(
            inventory.get("successorProfile", {}).get("ownerDependencyReceipt"),
            label="successor review inventory ownerDependencyReceipt",
        )
        verify_successor_owner_dependency_receipt(
            finalization.get("reviewDecision", {}).get("ownerDependencyReceipt"),
            label="successor review finalization ownerDependencyReceipt",
        )
        if inventory.get("acceptedLiveCanonical", {}).get("closedSetManifestPin") != SUCCESSOR_CLOSED_SET_MANIFEST_PIN:
            raise SuccessorProfileError("successor review inventory closed-set manifest pin drift")
        if inventory.get("successorProfile", {}).get("closedSetManifestPin") != SUCCESSOR_CLOSED_SET_MANIFEST_PIN:
            raise SuccessorProfileError("successor review inventory profile manifest pin drift")
        if finalization.get("reviewDecision", {}).get("closedSetManifestPin") != SUCCESSOR_CLOSED_SET_MANIFEST_PIN:
            raise SuccessorProfileError("successor review finalization manifest pin drift")
    except SuccessorProfileError as exc:
        raise SystemExit(str(exc)) from exc
    accepted = _successor_source_bundle()["accepted"]
    binding = finalization.get("acceptedLiveCanonical", {})
    if (
        binding.get("manifest", {}).get("fileSha256") != accepted["manifestFileSha256"]
        or binding.get("independentAcceptance", {}).get("fileSha256") != accepted["acceptanceFileSha256"]
        or binding.get("candidateAsOracle") is not False
    ):
        raise SystemExit("successor review finalization accepted-live binding drift")
    if inventory.get("scope", {}).get("operations") != SUCCESSOR_CANONICAL_COUNTS["publicOperations"]:
        raise SystemExit("successor review inventory count drift")
    if dependency_receipt["ownerDependencyContracts"] != SUCCESSOR_CANONICAL_COUNTS[
        "ownerDependencyContracts"
    ]:
        raise SystemExit("successor review inventory owner-dependency count drift")
    return inventory, finalization


def _load_and_verify_review_artifact(path: Path, file_sha: str, payload_sha: str) -> dict[str, Any]:
    if not path.is_file():
        raise SystemExit(f"missing sealed reviewer input: {path}")
    actual_file_sha = sha256(path)
    if actual_file_sha != file_sha:
        raise SystemExit(f"reviewer input byte drift: {path.name} expected={file_sha} got={actual_file_sha}")
    document = load_json(path)
    if document.get("sealedPayloadSha256") != payload_sha or canonical_hash(document) != payload_sha:
        raise SystemExit(f"reviewer input semantic seal drift: {path.name}")
    return document


def build_oracle() -> dict[str, Any]:
    """Finalize exclusively from frozen reviewer artifacts.

    The live exact/event/semantic/identity candidate files are deliberately not
    opened here.  The older source-building function remains only as an
    auditable record of how the intermediate reviewer inventory was assembled;
    it is not reachable from the final CLI.
    """
    if ACTIVE_PROFILE == SUCCESSOR_PROFILE:
        inventory, finalization = _successor_verified_review_inputs()
        document = copy.deepcopy(inventory)
        document["reviewedFinalization"] = {
            "path": REVIEW_FINALIZATION_PATH.name,
            "fileSha256": sha256(REVIEW_FINALIZATION_PATH),
            "sealedPayloadSha256": finalization["sealedPayloadSha256"],
            "status": finalization["status"],
            "independentAcceptance": finalization["acceptedLiveCanonical"],
        }
        document["status"] = "SEALED_SUCCESSOR_ORACLE_REVIEW_AUTHORITY_NOT_IMPLEMENTED"
        document["oracleId"] = SUCCESSOR_IDS["oracle"]
        document["schemaVersion"] = 2
        document["sealedPayloadSha256"] = canonical_hash(document)
        return document
    document = _load_and_verify_review_artifact(
        REVIEW_INVENTORY_PATH,
        REVIEWED_INTERMEDIATE_INPUT["fileSha256"],
        REVIEWED_INTERMEDIATE_INPUT["sealedPayloadSha256"],
    )
    overlay = _load_and_verify_review_artifact(
        REVIEW_FINALIZATION_PATH,
        REVIEWED_FINALIZATION["fileSha256"],
        REVIEWED_FINALIZATION["sealedPayloadSha256"],
    )
    if overlay.get("baseInventory", {}).get("fileSha256") != REVIEWED_INTERMEDIATE_INPUT["fileSha256"]:
        raise SystemExit("review finalization targets a different intermediate inventory")
    for key in overlay.get("topLevelRemove", []):
        document.pop(key, None)
    for key, value in overlay.get("topLevelSet", {}).items():
        document[key] = value
    operations = {row["operationId"]: row for row in document.get("operations", [])}
    patches = overlay.get("operationPatches", {})
    unknown = set(patches) - set(operations)
    if unknown:
        raise SystemExit(f"review finalization contains unknown operations: {sorted(unknown)}")
    for operation_id, patch in patches.items():
        row = operations[operation_id]
        for key in patch.get("remove", []):
            row.pop(key, None)
        row.update(patch.get("set", {}))
    document["sealedPayloadSha256"] = canonical_hash(document)
    return document


def _successor_domain_edge_rows(oracle: dict[str, Any]) -> list[dict[str, Any]]:
    """Derive the successor edge inventory from the sealed oracle DML."""
    rows: list[dict[str, Any]] = []
    seen: set[tuple[str, str, str]] = set()
    for operation in oracle.get("operations", []):
        if operation.get("mode") != "COMMAND":
            continue
        operation_id = operation["operationId"]
        for step in operation.get("orderedDml", []):
            if not isinstance(step, dict) or not step.get("table"):
                continue
            table = step["table"]
            action = step.get("action", "UNSPECIFIED")
            role = str(step.get("role", ""))
            if "RECEIPT" in role or "OUTBOX" in role or table.endswith("outbox_events"):
                continue
            key = (operation_id, action, table)
            if key in seen:
                continue
            seen.add(key)
            reason = FORBIDDEN_EDGE_REASONS.get((operation_id, table))
            rows.append({
                "edgeId": f"{operation_id}|{action}|{table}",
                "operationId": operation_id,
                "action": action,
                "table": table,
                "classification": "FORBIDDEN_EDGE" if reason else "COMMITTED_EDGE",
                "transactionOwner": operation_id,
                "reason": reason or "accepted-live ordered domain DML edge",
                "sourceStep": step.get("step"),
                "postgresAssertions": (
                    [
                        "rowCount(table)=0 for rows attributable to this command",
                        "no outbox event for forbidden lifecycle",
                        "all pre-existing table rows byte-for-byte unchanged",
                    ]
                    if reason
                    else [
                        "minimum-valid transaction commits exactly expected row cardinality",
                        "stored typed values equal accepted-live input/derivation sources",
                        "receipt and outbox refer to exact committed public IDs and versions",
                    ]
                ),
            })
    return rows


def build_successor_fixtures(oracle: dict[str, Any]) -> dict[str, Any]:
    """Build source-derived v2 PG scenarios without legacy count literals."""
    expected = dict(SUCCESSOR_CANONICAL_COUNTS)
    dependency_receipt = verify_successor_owner_dependencies(
        oracle, label="successor oracle ownerDependencyContracts"
    )
    verify_successor_owner_dependency_receipt(
        oracle.get("successorProfile", {}).get("ownerDependencyReceipt"),
        label="successor oracle ownerDependencyReceipt",
    )
    if oracle.get("successorProfile", {}).get("closedSetManifestPin") != SUCCESSOR_CLOSED_SET_MANIFEST_PIN:
        raise SuccessorProfileError("successor oracle closed-set manifest pin drift")
    commands = [row for row in oracle.get("operations", []) if row.get("mode") == "COMMAND"]
    queries = [row for row in oracle.get("operations", []) if row.get("mode") == "QUERY"]
    handlers = list(oracle.get("systemHandlers", []))
    edges = _successor_domain_edge_rows(oracle)
    committed = sum(row["classification"] == "COMMITTED_EDGE" for row in edges)
    forbidden = sum(row["classification"] == "FORBIDDEN_EDGE" for row in edges)
    query_case_rows = [
        {
            "operationId": row["operationId"],
            "cases": ["minimum-valid", "optional-absent", "optional-present",
                      "foreign-tenant", "wrong-purpose", "cursor-scope-mismatch"],
            "assert": "database diff is empty; no receipt/outbox/domain write",
        }
        for row in queries
    ]
    command_fault_points = sum(
        max(1, len(row.get("orderedDml", []))) + 1 for row in commands
    )
    handler_fault_points = sum(
        max(1, len(row.get("orderedDml", []))) + 1 for row in handlers
    )
    decision_receipts = sum(
        1
        for row in commands
        if any(
            "decision" in json.dumps(step, sort_keys=True).lower()
            for step in row.get("orderedDml", [])
        )
    )
    derived = {
        **expected,
        "edges": len(edges),
        "committedEdges": committed,
        "forbiddenEdges": forbidden,
        "operationTransactions": len(commands),
        "queryCases": sum(len(row["cases"]) for row in query_case_rows),
        "commandRollbackFaults": command_fault_points,
        "handlerRollbackFaults": handler_fault_points,
        "sameTransactionDecisionReceipts": decision_receipts,
    }
    document = {
        "fixtureId": SUCCESSOR_IDS["fixture"],
        "schemaVersion": 2,
        "status": "SEALED_SUCCESSOR_EXECUTION_REQUIREMENT_NOT_EXECUTED",
        "successorProfile": {
            "name": ACTIVE_PROFILE,
            "sourceDerivedCounts": expected,
            "derivedScenarioCounts": derived,
            "predecessorDisposition": ACTIVE_PROFILE_METADATA["predecessorDisposition"],
            "predecessorPins": ACTIVE_PROFILE_METADATA["predecessorPins"],
            "policy": ACTIVE_PROFILE_METADATA["policy"],
            "ownerDependencyReceipt": dependency_receipt,
            "closedSetManifestPin": dict(SUCCESSOR_CLOSED_SET_MANIFEST_PIN),
        },
        "oracle": {"path": ORACLE_PATH.name, "sealedPayloadSha256": oracle["sealedPayloadSha256"]},
        "postgresMajors": [16, 18],
        "isolation": "ONE_FRESH_SCHEMA_AND_ONE_EXPLICIT_TRANSACTION_PER_SCENARIO",
        "edgeInventory": {
            "total": len(edges), "committed": committed, "forbidden": forbidden,
            "operationTransactions": len(commands), "rows": edges,
        },
        "operationTransactions": [
            {
                "operationId": row["operationId"],
                "postgresVersions": [16, 18],
                "seed": "exact accepted-live tenant, principal, root, related parent, version and owner-refetch fixture rows",
                "execute": "the real accepted-live orderedDml plan from the sealed successor oracle",
                "assert": [
                    "exact per-step row counts and assignments",
                    "root physical post-state and exactly-one version increment",
                    "secondary rows and immutable append contents",
                    "real command receipt result and transactional outbox payload/subject",
                    "after-commit publication only",
                ],
            }
            for row in commands
        ],
        "allCommandCasScenarios": [
            {
                "operationId": row["operationId"],
                "root": row.get("aggregateRoot", {}).get("table"),
                "postStateSink": row.get("transition", {}).get("physicalPostStateSink"),
                "cases": ["minimum-valid", "identical-replay", "different-digest-conflict",
                           "stale-If-Match", "foreign-tenant", "wrong-purpose", "owner-proof-unavailable",
                           "failure-after-each-ordered-step"],
            }
            for row in commands
        ],
        "allQueryReadOnlyScenarios": query_case_rows,
        "internalHandlerTransactions": [
            {
                "handlerId": row["handlerId"],
                "postgresVersions": [16, 18],
                "cases": ["minimum-valid", "identical-replay", "different-result-digest-conflict",
                           "owner-proof-unavailable", "failure-after-inbox-and-each-domain/outbox-step"],
                "assert": "source inbox claim and all domain writes are one transaction",
            }
            for row in handlers
        ],
        "replayContract": {
            "identical": "same receipt, response, public IDs and versions; zero duplicate domain/outbox rows",
            "differentDigest": "409 and zero mutations",
            "correlationVariance": "does not change business digest or identity; trace is recorded separately",
        },
        "rollbackContract": {
            "faultPoints": "after receipt claim, after every domain DML/owner ack, after receipt completion, after every outbox append",
            "assert": "aggregate, secondary rows, receipt completion and outbox all return to pre-transaction state",
        },
        "eventAssertions": {
            "primaryMinimum": oracle.get("scope", {}).get("commandCausedPrimaryFactsMinimum"),
            "publicEventSchemas": expected["publicEvents"],
            "conditional": "source-derived event emission conditions; no universal one-event-per-command rule",
            "systemHandlers": [row.get("handlerId") for row in handlers],
            "privacyNegative": "mutating sensitive request text never causes raw value to appear in event/outbox/log",
            "audienceNegative": "unknown consumer/session/purpose/field request is denied by refetch PEP",
        },
        "requiredEvidence": {
            "perPostgresMajor": [
                "server_version", "schema_hash", "fixture_hash", "oracle_hash",
                "operation_results_source_derived", "query_results_source_derived",
                "edge_results_source_derived", "rollback_fault_results_source_derived",
                "handler_results_source_derived", "handler_rollback_fault_results_source_derived",
                "receipt_outbox_replay_results", "decision_receipts_source_derived",
            ],
            "expectedScenarioCounts": derived,
            "executionControl": {
                "semaphore": "hris-verification",
                "directRunnerMustAcquire": True,
                "parentHeldModeRequiresNameAndParentPidAttestation": True,
                "checkMustNotModifyEvidenceBytes": True,
            },
            "currentEvidenceStatus": "MISSING",
            "gateRule": "no successor PASS until both majors have zero failures and a second reviewer signs hashes",
        },
        "sealedPayloadSha256": "",
    }
    document["sealedPayloadSha256"] = canonical_hash(document)
    return document


def build_fixtures(oracle: dict[str, Any]) -> dict[str, Any]:
    if ACTIVE_PROFILE == SUCCESSOR_PROFILE:
        return build_successor_fixtures(oracle)
    edge_rows = []
    for value in FIXED_EDGE_INVENTORY:
        operation_id, disposition, table = value.split("|", 2)
        reason = FORBIDDEN_EDGE_REASONS.get((operation_id, table))
        edge_rows.append({
            "edgeId": value,
            "operationId": operation_id,
            "legacyDisposition": disposition,
            "table": table,
            "classification": "FORBIDDEN_EDGE" if reason else "COMMITTED_EDGE",
            "transactionOwner": ("internal.wfm.schedule-optimization.complete"
                                   if operation_id == "modern.wfm.schedule.optimize"
                                   and table in {"tme_wfm_schedule_candidates", "tme_wfm_constraint_evaluation_receipts"}
                                   else operation_id),
            "reason": reason or "reviewed domain insert/append edge",
            "postgresAssertions": ([
                "rowCount(table)=0 for rows attributable to this command",
                "no outbox event for forbidden lifecycle",
                "all pre-existing table rows byte-for-byte unchanged",
                "candidate writesTables/orderedDml must not contain this edge",
            ] if reason else [
                "minimum-valid transaction commits exactly expected row cardinality",
                "stored typed values equal reviewed input/derivation sources",
                "receipt and outbox refer to exact committed public IDs and versions",
            ]),
        })
    commands = [row for row in oracle["operations"] if row["mode"] == "COMMAND"]
    queries = [row for row in oracle["operations"] if row["mode"] == "QUERY"]
    transaction_ops = sorted({row["operationId"] for row in edge_rows})
    document = {
        "fixtureId": (
            "dwp.hris.modern.causal-independent-pg-fixtures.v2"
            if ACTIVE_PROFILE == SUCCESSOR_PROFILE
            else "dwp.hris.modern.causal-independent-pg-fixtures.v1"
        ),
        "schemaVersion": 2 if ACTIVE_PROFILE == SUCCESSOR_PROFILE else 1,
        "status": "SEALED_EXECUTION_REQUIREMENT_NOT_EXECUTED",
        "oracle": {"path": ORACLE_PATH.name, "sealedPayloadSha256": oracle["sealedPayloadSha256"]},
        "postgresMajors": [16, 18],
        "isolation": "ONE_FRESH_SCHEMA_AND_ONE_EXPLICIT_TRANSACTION_PER_SCENARIO",
        "edgeInventory": {"total": 58, "committed": 53, "forbidden": 5,
                          "operationTransactions": 45, "rows": edge_rows},
        "operationTransactions": [{
            "operationId": operation_id,
            "postgresVersions": [16, 18],
            "seed": "exact tenant, principal, root, related parent, version and owner-refetch fixture rows",
            "execute": "the real orderedDml plan from the sealed oracle; no broad synthetic UPDATE",
            "assert": [
                "exact per-step row counts and assignments",
                "root physical post-state and exactly-one version increment",
                "secondary rows and immutable append contents",
                "real command receipt result and transactional outbox payload/subject",
                "after-commit publication only",
            ],
        } for operation_id in transaction_ops],
        "allCommandCasScenarios": [{
            "operationId": row["operationId"], "root": row["aggregateRoot"]["table"],
            "postStateSink": row["transition"]["physicalPostStateSink"],
            "cases": ["minimum-valid", "identical-replay", "different-digest-conflict", "stale-If-Match",
                      "foreign-tenant", "wrong-purpose", "owner-proof-unavailable",
                      "failure-after-each-ordered-step"],
        } for row in commands],
        "allQueryReadOnlyScenarios": [{
            "operationId": row["operationId"],
            "cases": ["minimum-valid", "optional-absent", "optional-present", "foreign-tenant",
                      "wrong-purpose", "cursor-scope-mismatch"],
            "assert": "database diff is empty; no receipt/outbox/domain write",
        } for row in queries],
        "internalHandlerTransactions": [{
            "handlerId": row["handlerId"],
            "postgresVersions": [16, 18],
            "cases": ["minimum-valid", "identical-replay", "different-result-digest-conflict",
                      "owner-proof-unavailable", "failure-after-inbox-and-each-domain/outbox-step"],
            "assert": ["source inbox claim and all domain writes are one transaction",
                       "event aggregate ID/version exactly matches committed handler fact root",
                       "identical owner result emits no duplicate domain/outbox row",
                       "conflicting result preserves the first inbox/domain/outbox result",
                       "every injected fault restores inbox, domain rows and outbox to pre-state"],
        } for row in oracle["systemHandlers"]],
        "replayContract": {
            "identical": "same receipt, response, public IDs and versions; zero duplicate domain/outbox rows",
            "differentDigest": "409 and zero mutations",
            "correlationVariance": "does not change business digest or identity; trace is recorded separately",
        },
        "rollbackContract": {
            "faultPoints": "after receipt claim, after every domain DML/owner ack, after receipt completion, after every outbox append",
            "assert": "aggregate, secondary rows, receipt completion and outbox all return to pre-transaction state",
        },
        "eventAssertions": {
            "primaryMinimum": 81,
            "conditional": ["OnboardingJourneyCompleted.v2 only when last required task commits"],
            "systemHandlers": [
                "CandidateHired.v2 only after verified HRM owner ack",
                "ContingentAccessExpired.v2 only from due scheduler plus verified access-owner ack",
                "WorkforceScheduleCandidateGenerated.v2 only from optimization completion handler",
                "GovernedAiPolicyEvaluationCompleted.v2 only from evaluation completion handler",
            ],
            "privacyNegative": "mutating sensitive request text never causes raw value to appear in event/outbox/log",
            "audienceNegative": "unknown consumer/session/purpose/field request is denied by refetch PEP",
        },
        "requiredEvidence": {
            "perPostgresMajor": ["server_version", "schema_hash", "fixture_hash", "oracle_hash",
                                 "operation_results_81", "query_results_19", "edge_results_58",
                                 "rollback_fault_results_372", "handler_results_4",
                                 "handler_rollback_fault_results_20", "receipt_outbox_replay_results",
                                 "query_case_results_114", "decision_receipts_14",
                                 "conditional_onboarding_two_branch_result",
                                 "two_step_hire_and_compensation_timing_results"],
            "expectedScenarioCounts": {
                "commands": 81, "queries": 19, "queryCases": 114, "edges": 58,
                "handlers": 4, "commandRollbackFaults": 372, "handlerRollbackFaults": 20,
                "sameTransactionDecisionReceipts": 14,
            },
            "executionControl": {
                "semaphore": "hris-verification",
                "directRunnerMustAcquire": True,
                "parentHeldModeRequiresNameAndParentPidAttestation": True,
                "checkMustNotModifyEvidenceBytes": True,
            },
            "currentEvidenceStatus": "MISSING",
            "gateRule": "no G3 PASS until both majors have zero failures and a second reviewer signs hashes",
        },
        "sealedPayloadSha256": "",
    }
    if ACTIVE_PROFILE == SUCCESSOR_PROFILE:
        document["successorProfile"] = {
            "name": ACTIVE_PROFILE,
            "predecessorDisposition": ACTIVE_PROFILE_METADATA["predecessorDisposition"],
            "predecessorPins": ACTIVE_PROFILE_METADATA["predecessorPins"],
            "sourceDerivedCounts": ACTIVE_PROFILE_METADATA["canonicalCounts"],
            "policy": ACTIVE_PROFILE_METADATA["policy"],
        }
    document["sealedPayloadSha256"] = canonical_hash(document)
    return document


def atomic_write_json(path: Path, document: dict[str, Any]) -> None:
    # Reviewer oracle, fixture, and review-overlay bytes are sealed.  Every
    # publication profile therefore uses no-replace creation; ``--check`` and
    # historical reproduction remain read-only.
    create_only_json(path, document)


def make_review_finalization() -> dict[str, Any]:
    """Create the one-way reviewer overlay from the sealed intermediate.

    This function is reachable only through the explicit --review-update
    ceremony.  Normal --write/--check never call it or open mutable candidate
    JSON.  Its output contains the complete reviewer decisions so subsequent
    builds require only the two immutable review artifacts.
    """
    base = _load_and_verify_review_artifact(
        REVIEW_INVENTORY_PATH,
        REVIEWED_INTERMEDIATE_INPUT["fileSha256"],
        REVIEWED_INTERMEDIATE_INPUT["sealedPayloadSha256"],
    )
    desired = build_unsealed_draft_from_evidence_for_review_only()
    base_operations = {row["operationId"]: row for row in base.get("operations", [])}
    desired_operations = {row["operationId"]: row for row in desired.get("operations", [])}
    if set(base_operations) != set(desired_operations) or len(desired_operations) != 100:
        raise SystemExit("review finalization operation inventory is not the sealed 100-operation set")
    excluded = {"operations", "sealedPayloadSha256"}
    overlay = {
        "overlayId": "dwp.hris.modern.causal-independent-reviewed-finalization.v1",
        "schemaVersion": 1,
        "status": "SEALED_REVIEWER_DECISIONS",
        "baseInventory": {
            "path": REVIEW_INVENTORY_PATH.name,
            "fileSha256": REVIEWED_INTERMEDIATE_INPUT["fileSha256"],
            "sealedPayloadSha256": REVIEWED_INTERMEDIATE_INPUT["sealedPayloadSha256"],
        },
        "provenance": {
            "finalizedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
            "authority": "EXPLICIT_INDEPENDENT_REVIEWER_DECISIONS; NOT_CANDIDATE_GENERATED_AUTHORITY",
            "reviewedIntermediateClassification": "REVIEWED_INTERMEDIATE_INPUT",
            "historicalPinsClassification": "PROVENANCE_ONLY_NOT_EXPECTED_OUTPUT_AUTHORITY",
            "postFreezeRule": "normal builder paths read only baseInventory plus this exact sealed overlay",
        },
        "topLevelSet": {key: value for key, value in desired.items() if key not in excluded},
        "topLevelRemove": sorted(set(base) - set(desired) - {"sealedPayloadSha256"}),
        "operationPatches": {
            operation_id: {
                "remove": sorted(set(base_operations[operation_id]) - set(row)),
                "set": {key: value for key, value in row.items() if key != "operationId"},
            }
            for operation_id, row in sorted(desired_operations.items())
        },
        "sealedPayloadSha256": "",
    }
    overlay["sealedPayloadSha256"] = canonical_hash(overlay)
    return overlay


def make_explicit_onboarding_effective_date_correction() -> dict[str, Any]:
    """Correct one reviewed phantom event source without consulting candidates.

    The predecessor overlay and immutable intermediate are the only inputs.
    `ppl_jny_template_versions.effective_from/effective_to` is the authoritative
    version interval; introducing a second version-level `valid_from` spelling
    would create two facts for one concept and is therefore forbidden.
    """
    predecessor = _load_and_verify_review_artifact(
        REVIEW_FINALIZATION_PATH,
        AUTHORIZED_REVIEW_CORRECTION_PREDECESSOR["fileSha256"],
        AUTHORIZED_REVIEW_CORRECTION_PREDECESSOR["sealedPayloadSha256"],
    )
    base = _load_and_verify_review_artifact(
        REVIEW_INVENTORY_PATH,
        REVIEWED_INTERMEDIATE_INPUT["fileSha256"],
        REVIEWED_INTERMEDIATE_INPUT["sealedPayloadSha256"],
    )
    desired = build_oracle()

    version_delta = desired["schemaOracle"]["requiredTableColumnCheckDeltas"][
        "ppl_jny_template_versions"
    ]["requiredColumns"]
    version_delta["effective_from"] = "DATE"
    version_delta["effective_to"] = "DATE"

    operations = {row["operationId"]: row for row in desired["operations"]}
    create = operations["modern.onboarding.template.create"]
    publish = operations["modern.onboarding.template.publish"]
    version_insert = next(
        step for step in create["orderedDml"]
        if step.get("table") == "ppl_jny_template_versions" and step.get("action") == "INSERT"
    )
    version_insert["assignments"]["effective_from"] = "body.effectiveFrom"
    version_insert["assignments"]["effective_to"] = "body.effectiveTo IF PRESENT"

    for source, target in (
        ("body.effectiveFrom", "ppl_jny_template_versions.effective_from"),
        ("body.effectiveTo", "ppl_jny_template_versions.effective_to"),
    ):
        input_effect = next(row for row in create["inputEffects"] if row["source"] == source)
        if not any(effect.get("target") == target for effect in input_effect["effects"]):
            input_effect["effects"].append({"kind": "PERSISTED_COLUMN", "target": target})

    publish_effect = next(
        row for row in publish["inputEffects"] if row["source"] == "body.effectiveFrom"
    )
    locked_match = next(
        effect for effect in publish_effect["effects"] if effect["kind"] == "LOCKED_FACT_MATCH"
    )
    locked_match["target"] = "ppl_jny_template_versions.effective_from"

    for operation, event_name in (
        (create, "OnboardingTemplateCreated.v2"),
        (publish, "OnboardingTemplatePublished.v2"),
    ):
        event = next(event for event in operation["events"] if event["eventName"] == event_name)
        valid_from = next(field for field in event["fields"] if field["name"] == "validFrom")
        valid_from["source"] = "ppl_jny_template_versions.effective_from"
        valid_from["sourceKind"] = "PHYSICAL_POST_STATE"

    desired["sealedPayloadSha256"] = canonical_hash(desired)
    base_operations = {row["operationId"]: row for row in base["operations"]}
    desired_operations = {row["operationId"]: row for row in desired["operations"]}
    excluded = {"operations", "sealedPayloadSha256"}
    overlay = {
        "overlayId": predecessor["overlayId"],
        "schemaVersion": predecessor["schemaVersion"],
        "status": "SEALED_REVIEWER_DECISIONS",
        "baseInventory": predecessor["baseInventory"],
        "provenance": {
            **predecessor["provenance"],
            "correctedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
            "correctionId": "ONBOARDING-VERSION-EFFECTIVE-INTERVAL-CANONICALIZATION-1",
            "predecessorFileSha256": AUTHORIZED_REVIEW_CORRECTION_PREDECESSOR["fileSha256"],
            "correctionAuthority": (
                "EXPLICIT_INDEPENDENT_REVIEWER_DECISION_FROM_FROZEN_PREDECESSOR; "
                "NO_LIVE_CANDIDATE_INPUT"
            ),
            "decision": (
                "canonical version interval is ppl_jny_template_versions.effective_from/effective_to; "
                "duplicate version.valid_from is forbidden"
            ),
        },
        "topLevelSet": {key: value for key, value in desired.items() if key not in excluded},
        "topLevelRemove": sorted(set(base) - set(desired) - {"sealedPayloadSha256"}),
        "operationPatches": {
            operation_id: {
                "remove": sorted(set(base_operations[operation_id]) - set(row)),
                "set": {key: value for key, value in row.items() if key != "operationId"},
            }
            for operation_id, row in sorted(desired_operations.items())
        },
        "sealedPayloadSha256": "",
    }
    overlay["sealedPayloadSha256"] = canonical_hash(overlay)
    return overlay


def make_explicit_event_referent_identity_correction() -> dict[str, Any]:
    """Correct source-table/identity conflation from an immutable predecessor.

    The event `source` remains the physical/owner provenance.  Its
    `referenceContract` identifies what the value refers to.  Persisted-input
    referents are recovered from already-reviewed input-effect resolutions;
    the small owner/pre-existing fact set is fixed by EVENT_REFERENT_OVERRIDES.
    This function does not open any live candidate artifact.
    """
    predecessor = _load_and_verify_review_artifact(
        REVIEW_FINALIZATION_PATH,
        AUTHORIZED_EVENT_IDENTITY_CORRECTION_PREDECESSOR["fileSha256"],
        AUTHORIZED_EVENT_IDENTITY_CORRECTION_PREDECESSOR["sealedPayloadSha256"],
    )
    base = _load_and_verify_review_artifact(
        REVIEW_INVENTORY_PATH,
        REVIEWED_INTERMEDIATE_INPUT["fileSha256"],
        REVIEWED_INTERMEDIATE_INPUT["sealedPayloadSha256"],
    )
    desired = build_oracle()

    # Collapse the 52 intermediate duplicated (kind,target) effects without
    # losing their reviewed detail.  Candidate implementations must expose one
    # unambiguous observable effect per signature.
    duplicate_count = 0
    for operation in desired["operations"]:
        for input_effect in operation.get("inputEffects", []):
            merged: dict[tuple[Any, Any], dict[str, Any]] = {}
            order: list[tuple[Any, Any]] = []
            for effect in input_effect.get("effects", []):
                key = (effect.get("kind"), effect.get("target"))
                if key not in merged:
                    merged[key] = dict(effect)
                    order.append(key)
                    continue
                duplicate_count += 1
                for field_name, field_value in effect.items():
                    if isinstance(field_value, dict) and isinstance(merged[key].get(field_name), dict):
                        merged[key][field_name] = {**merged[key][field_name], **field_value}
                    elif field_name not in merged[key] or merged[key][field_name] in (None, "", [], {}):
                        merged[key][field_name] = field_value
            input_effect["effects"] = [merged[key] for key in order]
    if duplicate_count != 52:
        raise SystemExit(f"reviewed input-effect duplicate closure changed: expected=52 got={duplicate_count}")

    # inputSnapshotId and availabilitySnapshotId are intentionally distinct.
    wfm = next(row for row in desired["operations"]
               if row["operationId"] == "modern.wfm.schedule.optimize")
    wfm_input = next(row for row in wfm["inputEffects"]
                     if row["source"] == "body.inputSnapshotId")
    wfm_persist = next(row for row in wfm_input["effects"]
                       if row.get("kind") == "PERSISTED_COLUMN"
                       and row.get("target") == "tme_wfm_optimization_requests.input_snapshot_id")
    wfm_persist["resolution"] = {
        "sourceKind": "VALIDATED_REQUEST",
        "entityType": "HRM.WorkforcePlanningInputSnapshot",
        "idSpace": "PUBLIC_UUID",
        "tenantBound": True,
        "ownerValidated": True,
    }

    referent_by_source: dict[str, dict[str, str]] = {}
    for operation in desired["operations"]:
        for input_effect in operation.get("inputEffects", []):
            for effect in input_effect.get("effects", []):
                if effect.get("kind") != "PERSISTED_COLUMN":
                    continue
                resolution = effect.get("resolution", {})
                if resolution.get("entityType") and resolution.get("idSpace"):
                    referent_by_source[effect["target"]] = {
                        "entityType": resolution["entityType"],
                        "idSpace": resolution["idSpace"],
                    }
    referent_by_source.update(EVENT_REFERENT_OVERRIDES)

    changed_fields = 0
    all_events = [event for operation in desired["operations"] for event in operation.get("events", [])]
    all_events.extend(handler["event"] for handler in desired.get("systemHandlers", []))
    for event in all_events:
        for field in event.get("fields", []):
            expected_reference = referent_by_source.get(field.get("source"))
            if expected_reference and field.get("referenceContract") != expected_reference:
                field["referenceContract"] = dict(expected_reference)
                changed_fields += 1
    if changed_fields != 67:
        raise SystemExit(f"event referent correction closure changed: expected=67 got={changed_fields}")

    desired["sealedPayloadSha256"] = canonical_hash(desired)
    base_operations = {row["operationId"]: row for row in base["operations"]}
    desired_operations = {row["operationId"]: row for row in desired["operations"]}
    excluded = {"operations", "sealedPayloadSha256"}
    overlay = {
        "overlayId": predecessor["overlayId"],
        "schemaVersion": predecessor["schemaVersion"],
        "status": "SEALED_REVIEWER_DECISIONS",
        "baseInventory": predecessor["baseInventory"],
        "provenance": {
            **predecessor["provenance"],
            "identityCorrectedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
            "identityCorrectionId": "EVENT-REFERENT-VS-SOURCE-PROVENANCE-AND-WFM-SNAPSHOT-1",
            "identityCorrectionPredecessorFileSha256":
                AUTHORIZED_EVENT_IDENTITY_CORRECTION_PREDECESSOR["fileSha256"],
            "identityCorrectionAuthority": (
                "EXPLICIT_INDEPENDENT_REVIEWER_DECISION_FROM_FROZEN_PREDECESSOR; "
                "NO_LIVE_CANDIDATE_INPUT"
            ),
            "identityDecision": (
                "event source is committed provenance; referenceContract is the distinct semantic referent; "
                "WFM planning-input and availability snapshots remain distinct"
            ),
        },
        "topLevelSet": {key: value for key, value in desired.items() if key not in excluded},
        "topLevelRemove": sorted(set(base) - set(desired) - {"sealedPayloadSha256"}),
        "operationPatches": {
            operation_id: {
                "remove": sorted(set(base_operations[operation_id]) - set(row)),
                "set": {key: value for key, value in row.items() if key != "operationId"},
            }
            for operation_id, row in sorted(desired_operations.items())
        },
        "sealedPayloadSha256": "",
    }
    overlay["sealedPayloadSha256"] = canonical_hash(overlay)
    return overlay


def make_explicit_final_frozen_review_correction() -> dict[str, Any]:
    """Apply the final independently adjudicated physical corrections once.

    This ceremony starts from the exact sealed reviewer overlay, not from any
    live candidate artifact.  Every transformation below is an explicit
    decision: canonical WFM columns, onboarding task order, checked-in owner
    transaction tables, structured scalar-column decision receipts, and the
    final ten source-provenance/semantic-referent distinctions.
    """
    predecessor = _load_and_verify_review_artifact(
        REVIEW_FINALIZATION_PATH,
        AUTHORIZED_FINAL_FROZEN_REVIEW_PREDECESSOR["fileSha256"],
        AUTHORIZED_FINAL_FROZEN_REVIEW_PREDECESSOR["sealedPayloadSha256"],
    )
    base = _load_and_verify_review_artifact(
        REVIEW_INVENTORY_PATH,
        REVIEWED_INTERMEDIATE_INPUT["fileSha256"],
        REVIEWED_INTERMEDIATE_INPUT["sealedPayloadSha256"],
    )
    desired = build_oracle()
    desired["finalFrozenReviewSubject"] = {
        "classification": "IMMUTABLE_REVIEW_SUBJECT_NOT_EXPECTED_VALUE_AUTHORITY",
        "reviewedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
        "pins": FINAL_FROZEN_REVIEW_SUBJECT_PINS,
    }
    desired["transactionInfrastructure"] = REVIEWED_TRANSACTION_INFRASTRUCTURE

    deltas = desired["schemaOracle"]["requiredTableColumnCheckDeltas"]
    deltas["ppl_jny_assignment_tasks"]["requiredColumns"]["task_order"] = "INTEGER"
    demand = deltas["tme_wfm_demand_lines"]["requiredColumns"]
    for obsolete in ("line_key", "starts_at", "ends_at", "required_skills"):
        demand.pop(obsolete, None)
    demand.update({
        "demand_forecast_id": "BIGINT",
        "line_sequence": "INTEGER",
        "interval_start": "TIMESTAMPTZ",
        "interval_end": "TIMESTAMPTZ",
        "required_headcount": "NUMERIC(12,4)",
        "demand_unit_code": "VARCHAR(40)",
        "skill_public_id": "UUID",
        "organization_public_id": "UUID",
        "line_digest": "CHAR(64)",
    })

    operations = {row["operationId"]: row for row in desired["operations"]}
    correlation_replacements = 0
    decision_replacements = 0
    for operation in operations.values():
        for input_effect in operation.get("inputEffects", []):
            for effect in input_effect.get("effects", []):
                target = effect.get("target")
                if target == "ppl_outbox_events.correlation_id":
                    effect["target"] = "sys_people_outbox_events.correlation_id"
                    correlation_replacements += 1
                elif target == "sys_hris_outbox_events.correlation_id":
                    effect["target"] = "sys_domain_event_outbox.correlation_id"
                    correlation_replacements += 1
                if (effect.get("kind") == "PERSISTED_DECISION_RECEIPT"
                        and isinstance(effect.get("target"), str)
                        and effect["target"].endswith(".result_reference.decisionReceipt")):
                    receipt = effect["target"].split(".", 1)[0]
                    effect["target"] = receipt
                    effect["physicalStorage"] = (
                        "STRUCTURED_AUTHORIZATION_SEAL_COLUMNS; RESULT_REF_IS_ONLY_THE_TYPED_ROOT_RESPONSE"
                    )
                    effect["scalarResultRefJsonOperatorsForbidden"] = True
                    decision_replacements += 1
    if (correlation_replacements, decision_replacements) != (47, 14):
        raise SystemExit(
            "final physical effect correction closure changed: "
            f"correlation={correlation_replacements} decision={decision_replacements}"
        )

    onboarding = operations["modern.onboarding.journey.assign"]
    task_insert = next(step for step in onboarding["orderedDml"]
                       if step.get("table") == "ppl_jny_assignment_tasks")
    task_insert["assignments"]["task_order"] = "locked.templateVersion.tasks[*].taskOrder"

    forecast = operations["modern.wfm.forecast.create"]
    demand_insert = next(step for step in forecast["orderedDml"]
                         if step.get("table") == "tme_wfm_demand_lines")
    demand_insert["assignments"] = {
        "demand_forecast_id": "previous.tme_wfm_demand_forecasts.internalId",
        "line_sequence": "SERVER_GENERATED:stable validated request order starting at 1",
        "interval_start": "body.demandLines[*].intervalStart",
        "interval_end": "body.demandLines[*].intervalEnd",
        "required_headcount": "body.demandLines[*].requiredHeadcount",
        "demand_unit_code": "body.demandLines[*].demandUnitCode",
        "skill_public_id": "body.demandLines[*].skillPublicId IF PRESENT",
        "organization_public_id": "body.demandLines[*].organizationPublicId IF PRESENT",
        "line_digest": "SERVER_DERIVE:canonical validated line fields plus line_sequence SHA-256",
        "tenant_id": "authenticatedPrincipal.tenantId",
        "created_by": "authenticatedPrincipal.publicId",
        "correlation_id": "headers.X-Correlation-ID",
    }

    publish = operations["modern.wfm.schedule.publish"]
    before = len(publish["orderedDml"])
    publish["orderedDml"] = [step for step in publish["orderedDml"]
                             if step.get("action") != "CALL_OWNER_PORT"]
    if len(publish["orderedDml"]) != before - 1:
        raise SystemExit("expected exactly one obsolete WFM publication owner-port step")
    for step_number, step in enumerate(publish["orderedDml"], 1):
        step["step"] = step_number

    corrected_referents = 0
    all_events = [event for operation in operations.values()
                  for event in operation.get("events", [])]
    all_events.extend(handler["event"] for handler in desired.get("systemHandlers", []))
    for event in all_events:
        for field in event.get("fields", []):
            expected_reference = FINAL_EVENT_REFERENT_CORRECTIONS.get(field.get("source"))
            if expected_reference and field.get("referenceContract") != expected_reference:
                field["referenceContract"] = dict(expected_reference)
                corrected_referents += 1
    if corrected_referents != 10:
        raise SystemExit(
            f"final event referent correction closure changed: expected=10 got={corrected_referents}"
        )

    negative = desired.setdefault("negativeRules", [])
    for rule in (
        "reject obsolete WFM demand-line aliases line_key/starts_at/ends_at/required_skills",
        "reject JSON operators on PER/TIM/SYS scalar result_ref columns",
        "reject any command transaction profile not backed by the exact checked-in owner DDL and receipt guard",
        "reject handler DML assignment not mapped to a physical typed column and verified owner-result source",
    ):
        if rule not in negative:
            negative.append(rule)

    desired["sealedPayloadSha256"] = canonical_hash(desired)
    base_operations = {row["operationId"]: row for row in base["operations"]}
    desired_operations = {row["operationId"]: row for row in desired["operations"]}
    excluded = {"operations", "sealedPayloadSha256"}
    overlay = {
        "overlayId": predecessor["overlayId"],
        "schemaVersion": predecessor["schemaVersion"],
        "status": "SEALED_REVIEWER_DECISIONS",
        "baseInventory": predecessor["baseInventory"],
        "provenance": {
            **predecessor["provenance"],
            "finalFrozenReviewedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
            "finalFrozenCorrectionId": "FINAL-PHYSICAL-TRANSACTION-WFM-REFERENT-CLOSURE-1",
            "finalFrozenCorrectionPredecessorFileSha256":
                AUTHORIZED_FINAL_FROZEN_REVIEW_PREDECESSOR["fileSha256"],
            "finalFrozenCorrectionAuthority": (
                "EXPLICIT_INDEPENDENT_REVIEWER_DECISIONS_FROM_FROZEN_PREDECESSOR; "
                "NO_LIVE_CANDIDATE_INPUT"
            ),
        },
        "topLevelSet": {key: value for key, value in desired.items() if key not in excluded},
        "topLevelRemove": sorted(set(base) - set(desired) - {"sealedPayloadSha256"}),
        "operationPatches": {
            operation_id: {
                "remove": sorted(set(base_operations[operation_id]) - set(row)),
                "set": {key: value for key, value in row.items() if key != "operationId"},
            }
            for operation_id, row in sorted(desired_operations.items())
        },
        "sealedPayloadSha256": "",
    }
    overlay["sealedPayloadSha256"] = canonical_hash(overlay)
    return overlay


def make_explicit_v2_ownership_review_correction() -> dict[str, Any]:
    """Record the independently adjudicated 526->525 ownership correction.

    This transformation consumes only the exact sealed reviewer predecessor
    and the literal decision above.  It never reads the live ownership CSV or
    any candidate-generated document as expected-value authority.
    """
    predecessor = _load_and_verify_review_artifact(
        REVIEW_FINALIZATION_PATH,
        AUTHORIZED_V2_OWNERSHIP_REVIEW_PREDECESSOR["fileSha256"],
        AUTHORIZED_V2_OWNERSHIP_REVIEW_PREDECESSOR["sealedPayloadSha256"],
    )
    corrected = copy.deepcopy(predecessor)
    subject = corrected.get("topLevelSet", {}).get("finalFrozenReviewSubject")
    if not isinstance(subject, dict) or not isinstance(subject.get("pins"), dict):
        raise SystemExit("review finalization lacks frozen subject pin block")
    pins = subject["pins"]
    if pins.get("ownership") != AUTHORIZED_V2_OWNERSHIP_REVIEW_PREDECESSOR[
            "priorOwnershipSha256"]:
        raise SystemExit("review finalization ownership predecessor pin differs")
    if {key: value for key, value in pins.items() if key != "ownership"} != {
            key: value for key, value in FINAL_FROZEN_REVIEW_SUBJECT_PINS.items()
            if key != "ownership"}:
        raise SystemExit("non-ownership frozen subject pin drift")
    pins["ownership"] = AUTHORIZED_V2_OWNERSHIP_REVIEW_PREDECESSOR[
        "currentOwnershipSha256"]
    subject["reviewedAt"] = dt.datetime.now(dt.timezone.utc).isoformat()
    provenance = corrected.setdefault("provenance", {})
    provenance.update({
        "v2OwnershipReviewedAt": subject["reviewedAt"],
        "v2OwnershipCorrectionId": "COMPENSATION-SNAPSHOT-V2-ONLY-OWNERSHIP-525",
        "v2OwnershipCorrectionPredecessorFileSha256":
            AUTHORIZED_V2_OWNERSHIP_REVIEW_PREDECESSOR["fileSha256"],
        "v2OwnershipCorrectionAuthority": (
            "EXPLICIT_INDEPENDENT_REVIEWER_DECISION_FROM_SEALED_PREDECESSOR; "
            "SUPERSEDED_COMPENSATION_V1_BASE_EVENT_REMOVED; NO_LIVE_CANDIDATE_INPUT"
        ),
    })
    corrected["sealedPayloadSha256"] = canonical_hash(corrected)
    return corrected


def make_explicit_analytics_export_lifecycle_correction() -> dict[str, Any]:
    """Correct the export receipt initial state from one sealed predecessor.

    The reviewed transition already requires NONE -> REQUESTED and the
    physical exact-schema check admits REQUESTED but never READY.  This
    one-way ceremony therefore changes exactly one DML assignment in the
    sealed overlay.  Candidate files are not opened and cannot act as an
    expected-value oracle.
    """
    predecessor = _load_and_verify_review_artifact(
        REVIEW_FINALIZATION_PATH,
        AUTHORIZED_ANALYTICS_EXPORT_LIFECYCLE_REVIEW_PREDECESSOR["fileSha256"],
        AUTHORIZED_ANALYTICS_EXPORT_LIFECYCLE_REVIEW_PREDECESSOR["sealedPayloadSha256"],
    )
    corrected = copy.deepcopy(predecessor)
    patch = corrected.get("operationPatches", {}).get(
        "modern.analytics.export.create", {}
    ).get("set", {})
    transition = patch.get("transition")
    expected_transition = {
        "transitionId": "MOD-SYS-ANALYTICS-TR-004",
        "preStates": ["NONE"],
        "postStates": ["REQUESTED"],
        "postStateSource": "CONSTANT",
        "physicalPostStateSink": "sys_hris_analytics_export_receipts.status",
        "checkCompatibility": "ALL_POST_STATES_MUST_BE_ACCEPTED_BY_NAMED_DDL_CHECK",
    }
    if transition != expected_transition:
        raise SystemExit("analytics export reviewed transition predecessor drift")
    domain_steps = [
        step for step in patch.get("orderedDml", [])
        if step.get("table") == "sys_hris_analytics_export_receipts"
    ]
    if len(domain_steps) != 1:
        raise SystemExit("analytics export lifecycle correction requires one exact domain step")
    domain_step = domain_steps[0]
    if (
        domain_step.get("action") != "APPEND"
        or domain_step.get("role") != "CONCURRENCY_ROOT"
        or domain_step.get("assignments", {}).get("status") != "CONSTANT:READY"
    ):
        raise SystemExit("analytics export lifecycle predecessor assignment drift")
    ready_assignments = [
        (operation_id, step.get("table"), key)
        for operation_id, operation_patch in corrected.get("operationPatches", {}).items()
        for step in operation_patch.get("set", {}).get("orderedDml", [])
        for key, value in step.get("assignments", {}).items()
        if value == "CONSTANT:READY"
    ]
    if ready_assignments != [
        ("modern.analytics.export.create", "sys_hris_analytics_export_receipts", "status")
    ]:
        raise SystemExit(
            "analytics export lifecycle READY correction closure changed: "
            f"got={ready_assignments}"
        )
    domain_step["assignments"]["status"] = "CONSTANT:REQUESTED"

    subject = corrected.get("topLevelSet", {}).get("finalFrozenReviewSubject")
    if (
        not isinstance(subject, dict)
        or subject.get("classification")
        != "IMMUTABLE_REVIEW_SUBJECT_NOT_EXPECTED_VALUE_AUTHORITY"
        or subject.get("pins") != FINAL_FROZEN_REVIEW_SUBJECT_PINS
    ):
        raise SystemExit("analytics export lifecycle review-subject predecessor drift")
    reviewed_at = dt.datetime.now(dt.timezone.utc).isoformat()
    subject["reviewedAt"] = reviewed_at
    subject["pins"] = dict(ANALYTICS_EXPORT_LIFECYCLE_REVIEW_SUBJECT_PINS)
    provenance = corrected.setdefault("provenance", {})
    provenance.update({
        "analyticsExportLifecycleReviewedAt": reviewed_at,
        "analyticsExportLifecycleCorrectionId":
            "ANALYTICS-EXPORT-RECEIPT-REQUESTED-INITIAL-STATE-1",
        "analyticsExportLifecycleCorrectionPredecessorFileSha256":
            AUTHORIZED_ANALYTICS_EXPORT_LIFECYCLE_REVIEW_PREDECESSOR["fileSha256"],
        "analyticsExportLifecycleCorrectionAuthority": (
            "EXPLICIT_INDEPENDENT_REVIEWER_DECISION_FROM_SEALED_PREDECESSOR; "
            "TRANSITION_AND_PHYSICAL_CHECK_REQUIRE_REQUESTED; NO_LIVE_CANDIDATE_INPUT"
        ),
        "analyticsExportLifecycleDecision": (
            "modern.analytics.export.create persists REQUESTED as its initial receipt state; "
            "READY is not a legal physical lifecycle token"
        ),
    })
    corrected["sealedPayloadSha256"] = canonical_hash(corrected)
    return corrected


def make_explicit_analytics_export_successor_closure() -> dict[str, Any]:
    """Pin deterministic successor bytes without revisiting oracle semantics."""
    predecessor = _load_and_verify_review_artifact(
        REVIEW_FINALIZATION_PATH,
        AUTHORIZED_ANALYTICS_EXPORT_SUCCESSOR_CLOSURE_PREDECESSOR["fileSha256"],
        AUTHORIZED_ANALYTICS_EXPORT_SUCCESSOR_CLOSURE_PREDECESSOR[
            "sealedPayloadSha256"
        ],
    )
    corrected = copy.deepcopy(predecessor)
    export_patch = corrected.get("operationPatches", {}).get(
        "modern.analytics.export.create", {}
    ).get("set", {})
    export_steps = [
        step for step in export_patch.get("orderedDml", [])
        if step.get("table") == "sys_hris_analytics_export_receipts"
    ]
    if (
        corrected.get("provenance", {}).get("analyticsExportLifecycleCorrectionId")
        != "ANALYTICS-EXPORT-RECEIPT-REQUESTED-INITIAL-STATE-1"
        or export_patch.get("transition", {}).get("postStates") != ["REQUESTED"]
        or len(export_steps) != 1
        or export_steps[0].get("assignments", {}).get("status")
        != "CONSTANT:REQUESTED"
    ):
        raise SystemExit("analytics export successor closure semantic predecessor drift")
    subject = corrected.get("topLevelSet", {}).get("finalFrozenReviewSubject")
    if (
        not isinstance(subject, dict)
        or subject.get("pins") != ANALYTICS_EXPORT_LIFECYCLE_REVIEW_SUBJECT_PINS
    ):
        raise SystemExit("analytics export successor closure subject predecessor drift")
    changed_pin_keys = {
        key for key in ANALYTICS_EXPORT_SUCCESSOR_CLOSURE_REVIEW_SUBJECT_PINS
        if ANALYTICS_EXPORT_SUCCESSOR_CLOSURE_REVIEW_SUBJECT_PINS[key]
        != ANALYTICS_EXPORT_LIFECYCLE_REVIEW_SUBJECT_PINS[key]
    }
    if changed_pin_keys != {"causal", "lineage"}:
        raise SystemExit(
            "analytics export successor closure pin delta changed: "
            f"got={sorted(changed_pin_keys)}"
        )
    reviewed_at = dt.datetime.now(dt.timezone.utc).isoformat()
    subject["reviewedAt"] = reviewed_at
    subject["pins"] = dict(ANALYTICS_EXPORT_SUCCESSOR_CLOSURE_REVIEW_SUBJECT_PINS)
    provenance = corrected.setdefault("provenance", {})
    provenance.update({
        "analyticsExportSuccessorClosureReviewedAt": reviewed_at,
        "analyticsExportSuccessorClosureId":
            "ANALYTICS-EXPORT-LIFECYCLE-DETERMINISTIC-SUCCESSOR-PINS-1",
        "analyticsExportSuccessorClosurePredecessorFileSha256":
            AUTHORIZED_ANALYTICS_EXPORT_SUCCESSOR_CLOSURE_PREDECESSOR["fileSha256"],
        "analyticsExportSuccessorClosureAuthority": (
            "RECORD_FINAL_DETERMINISTIC_CAUSAL_AND_EVENT_LINEAGE_REVIEW_SUBJECT_BYTES; "
            "NO_SEMANTIC_REDERIVATION; NO_CANDIDATE_EXPECTED_VALUE_AUTHORITY"
        ),
    })
    corrected["sealedPayloadSha256"] = canonical_hash(corrected)
    return corrected


def builder_self_test() -> list[str]:
    failures: list[str] = []
    before = build_oracle()
    original_paths = dict(SOURCE_PATHS)
    try:
        for key in SOURCE_PATHS:
            SOURCE_PATHS[key] = BASE / ("__hostile_missing_candidate__" + key)
        after = build_oracle()
    finally:
        SOURCE_PATHS.clear()
        SOURCE_PATHS.update(original_paths)
    if canonical_hash(before) != canonical_hash(after):
        failures.append("live candidate path mutation changed frozen oracle")
    hostile = json.loads(json.dumps(before))
    hostile["scope"]["operations"] = 99
    if canonical_hash(hostile) == before.get("sealedPayloadSha256"):
        failures.append("semantic mutation retained oracle seal")
    finalization = load_json(REVIEW_FINALIZATION_PATH)
    hostile_overlay = json.loads(json.dumps(finalization))
    hostile_overlay["status"] = "HOSTILE_MUTATION"
    if canonical_hash(hostile_overlay) == REVIEWED_FINALIZATION["sealedPayloadSha256"]:
        failures.append("review overlay mutation retained expected pin")
    export = next(
        row for row in before["operations"]
        if row["operationId"] == "modern.analytics.export.create"
    )
    export_steps = [
        step for step in export["orderedDml"]
        if step.get("table") == "sys_hris_analytics_export_receipts"
    ]
    if (
        len(export_steps) != 1
        or export_steps[0].get("assignments", {}).get("status")
        != "CONSTANT:REQUESTED"
        or export.get("transition", {}).get("postStates") != ["REQUESTED"]
    ):
        failures.append("analytics export initial state is not closed to REQUESTED")
    if (
        before.get("finalFrozenReviewSubject", {}).get("pins")
        != ANALYTICS_EXPORT_SUCCESSOR_CLOSURE_REVIEW_SUBJECT_PINS
    ):
        failures.append("analytics export deterministic successor subject pins are not frozen")
    return failures


def successor_builder_self_test() -> list[str]:
    """Test only successor controls; never publish a successor artifact."""
    failures = list(successor_profile_hostile_self_test(BASE, ROOT))
    # Review-input/oracle generation carries a pinned global Listening + PAY
    # dependency receipt.  Hostile mutations stay in memory and cannot create
    # or replace a successor artifact.
    for field, mutate in (
        ("ownerDependencyContracts", lambda value: value.__setitem__("ownerDependencyContracts", 1)),
        ("dependencyContractIds", lambda value: value["dependencyContractIds"].reverse()),
        ("dependencyContractSeals", lambda value: value["dependencyContractSeals"].__setitem__(
            "compensation.resolveApprovedSnapshotForPayroll.v1", "0" * 64
        )),
    ):
        receipt = successor_owner_dependency_receipt()
        try:
            mutate(receipt)
            verify_successor_owner_dependency_receipt(receipt, label=f"self-test.{field}")
        except (SuccessorProfileError, TypeError, ValueError):
            continue
        failures.append("owner-dependency-receipt-mutation-false-pass:" + field)
    preflight = successor_preflight()
    if not preflight.get("stageState", {}).get("acyclic"):
        failures.append("successor-stage-graph-is-cyclic")
    if preflight["predecessorPinFailures"]:
        failures.append(
            "predecessor-pin-drift:" + ",".join(preflight["predecessorPinFailures"])
        )
    if preflight["successorTargetFailures"]:
        failures.append("successor-target-failure:" + ",".join(preflight["successorTargetFailures"]))
    paths = successor_paths(BASE, ROOT)
    occupied = [key for key, path in paths.items() if path.exists() or path.is_symlink()]
    if occupied:
        failures.append("successor-targets-occupied:" + ",".join(sorted(occupied)))
    if preflight["canonicalCounts"] != {
        "publicOperations": 199, "commands": 133, "queries": 66,
        "systemHandlers": 27, "publicEvents": 157, "tableSpecifications": 131,
        "ownerPortOperationContracts": 18, "ownerDependencyContracts": 2,
    }:
        failures.append("source-derived-count-profile-drift")
    return failures


def main() -> int:
    parser = argparse.ArgumentParser()
    actions = parser.add_mutually_exclusive_group()
    actions.add_argument("--write", action="store_true",
                         help="atomically write oracle and fixture from the two frozen reviewer artifacts")
    actions.add_argument("--check", action="store_true",
                         help="non-mutating exact check of frozen inputs and generated artifact bytes (default)")
    actions.add_argument("--self-test", action="store_true",
                         help="non-mutating hostile seal and live-candidate independence tests")
    actions.add_argument("--prepare-review-input", action="store_true",
                         help="create-only publish the independently accepted-live v2 review inventory/finalization pair")
    parser.add_argument(
        "--review-update", action="store_true",
        help="one-time reviewer ceremony to replace the finalization overlay; not a normal build path",
    )
    parser.add_argument(
        "--profile", choices=(LEGACY_PROFILE, SUCCESSOR_PROFILE), default=LEGACY_PROFILE,
        help=("artifact chain profile; legacy-v1 preserves historical checks, "
              "successor-v2 is create-new-only and pending accepted canonical transition"),
    )
    args = parser.parse_args()
    try:
        configure_profile(args.profile)
    except (SuccessorProfileError, ValueError) as error:
        print(f"MODERN_CAUSAL_ORACLE_PROFILE=FAIL detail={type(error).__name__}:{error}")
        return 1
    if args.review_update:
        if ACTIVE_PROFILE != LEGACY_PROFILE:
            print("MODERN_CAUSAL_ORACLE_REVIEW_UPDATE=FAIL reason=SUCCESSOR_REVIEW_UPDATE_DISABLED")
            return 1
        actual = sha256(REVIEW_FINALIZATION_PATH) if REVIEW_FINALIZATION_PATH.is_file() else "MISSING"
        if actual != AUTHORIZED_ANALYTICS_EXPORT_SUCCESSOR_CLOSURE_PREDECESSOR["fileSha256"]:
            print("MODERN_CAUSAL_ORACLE_REVIEW_UPDATE=FAIL reason=AUTHORIZED_PREDECESSOR_MISMATCH")
            return 1
        corrected = make_explicit_analytics_export_successor_closure()
        atomic_write_json(REVIEW_FINALIZATION_PATH, corrected)
        print("MODERN_CAUSAL_ORACLE_REVIEW_UPDATE=PASS correction="
              "ANALYTICS-EXPORT-LIFECYCLE-DETERMINISTIC-SUCCESSOR-PINS-1")
        return 0
    if ACTIVE_PROFILE == SUCCESSOR_PROFILE:
        if args.self_test:
            failures = successor_builder_self_test()
            print(
                "MODERN_CAUSAL_ORACLE_SUCCESSOR_SELF_TEST="
                f"{'PASS' if not failures else 'FAIL'} tests=6 failures={len(failures)}"
            )
            for failure in failures:
                print(f"[SELF-TEST] {failure}")
            return 0 if not failures else 1
        preflight = successor_preflight()
        if args.prepare_review_input:
            stage_missing = pending_successor_inputs(BASE, ROOT, stage="review-input")
            target_failures = successor_target_failures(
                BASE, ROOT, keys=("reviewInventory", "reviewFinalization")
            )
            if stage_missing or preflight["predecessorPinFailures"] or target_failures:
                print(
                    "MODERN_CAUSAL_ORACLE_SUCCESSOR_REVIEW_INPUT=FAIL "
                    "reason=PENDING_ACCEPTED_CANONICAL_TRANSITION "
                    f"missing={','.join(stage_missing)} "
                    f"pinFailures={len(preflight['predecessorPinFailures'])} "
                    f"targetFailures={len(target_failures)}"
                )
                return 1
            try:
                inventory, finalization = write_successor_review_inputs()
            except (OSError, SuccessorProfileError, ValueError, KeyError, TypeError) as error:
                print(
                    "MODERN_CAUSAL_ORACLE_SUCCESSOR_REVIEW_INPUT=FAIL "
                    f"reason={type(error).__name__}:{error}"
                )
                return 1
            print(
                "MODERN_CAUSAL_ORACLE_SUCCESSOR_REVIEW_INPUT=PASS "
                f"operations={len(inventory['operations'])} "
                f"events={inventory['scope']['publicEvents']} "
                f"finalizationSeal={finalization['sealedPayloadSha256']}"
            )
            return 0
        if args.write:
            # Oracle generation starts only after the separate reviewer-owned
            # input stage.  It never falls back to the sealed v1 artifacts or
            # creates a target already occupied by an attacker/predecessor.
            stage_missing = pending_successor_inputs(BASE, ROOT, stage="oracle")
            target_failures = successor_target_failures(
                BASE, ROOT, keys=("oracle", "fixture")
            )
            if (stage_missing or preflight["predecessorPinFailures"] or target_failures
                    or preflight["acceptedLivePreflight"].get("status") != "READY"):
                print(
                    "MODERN_CAUSAL_ORACLE_SUCCESSOR_WRITE=FAIL "
                    "reason=PENDING_ACCEPTED_CANONICAL_TRANSITION "
                    f"missing={','.join(stage_missing)} "
                    f"pinFailures={len(preflight['predecessorPinFailures'])} "
                    f"targetFailures={len(target_failures)}"
                )
                return 1
        else:
            stage_missing = pending_successor_inputs(BASE, ROOT, stage="oracle")
            if stage_missing:
                print(
                    "MODERN_CAUSAL_ORACLE_SUCCESSOR_CHECK=FAIL "
                    "reason=PENDING_ACCEPTED_CANONICAL_TRANSITION "
                    f"missing={','.join(stage_missing)} "
                    f"targetFailures={len(preflight['successorTargetFailures'])}"
                )
                return 1
    oracle = build_oracle()
    fixtures = build_fixtures(oracle)
    if args.self_test:
        failures = builder_self_test()
        print(f"MODERN_CAUSAL_ORACLE_SELF_TEST={'PASS' if not failures else 'FAIL'} tests=5 failures={len(failures)}")
        for failure in failures:
            print(f"[SELF-TEST] {failure}")
        return 0 if not failures else 1
    if args.write:
        if ACTIVE_PROFILE == SUCCESSOR_PROFILE:
            from modern_causal_successor_profile import create_only_pair
            create_only_pair([
                (ORACLE_PATH, _successor_json_bytes(oracle)),
                (FIXTURE_PATH, _successor_json_bytes(fixtures)),
            ])
        else:
            atomic_write_json(ORACLE_PATH, oracle)
            atomic_write_json(FIXTURE_PATH, fixtures)
        print(f"MODERN_CAUSAL_ORACLE_WRITE=PASS operations={len(oracle['operations'])} "
              f"edges={len(fixtures['edgeInventory']['rows'])}")
        return 0
    missing = [path.name for path in (ORACLE_PATH, FIXTURE_PATH) if not path.is_file()]
    if missing:
        print(f"MODERN_CAUSAL_ORACLE_CHECK=FAIL missing={','.join(missing)}")
        return 1
    actual_oracle = load_json(ORACLE_PATH)
    actual_fixture = load_json(FIXTURE_PATH)
    failures = []
    if actual_oracle != oracle:
        failures.append("oracle bytes/semantics differ from frozen build")
    if actual_fixture != fixtures:
        failures.append("fixture bytes/semantics differ from frozen build")
    print(f"MODERN_CAUSAL_ORACLE_CHECK={'PASS' if not failures else 'FAIL'} "
          f"operations={len(oracle['operations'])} edges={len(fixtures['edgeInventory']['rows'])} "
          f"failures={len(failures)}")
    for failure in failures:
        print(f"[CHECK] {failure}")
    if failures:
        return 1
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
