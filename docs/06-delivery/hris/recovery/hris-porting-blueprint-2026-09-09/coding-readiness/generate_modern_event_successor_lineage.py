#!/usr/bin/env python3
"""Build the reviewed 32-event v1 -> operation-fact v2 migration register.

This is a candidate-owned lineage, not the independent acceptance oracle.  It
exists so the G3 modules, AsyncAPI work allocation and downstream consumers do
not silently retain one of the broad/polymorphic predecessor event names.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
from pathlib import Path

from modern_causal_candidate_projection import load_candidate_ssot


HERE = Path(__file__).resolve().parent
EVENTS = HERE / "modern-capability-event-payload-contracts.v1.json"
OUTPUT = HERE / "modern-capability-event-successor-lineage.v2.json"
LISTENING_SUMMARY = HERE / "sys-listening-stream-authority-successor.v1.json"
LISTENING_SUMMARY_ID = "dwp.hris.sys.listening.stream-authority-successor.v1"


SUCCESSORS: dict[str, tuple[str, ...]] = {
    "CandidateHired.v1": ("CandidateHired.v2",),
    "CandidateStageChanged.v1": ("CandidateStageChanged.v2", "CandidateOfferIssued.v2", "CandidateHireHandoffRequested.v2"),
    "OnboardingJourneyChanged.v1": ("OnboardingJourneyAssigned.v2", "OnboardingTaskCompleted.v2", "OnboardingJourneyCancelled.v2"),
    "OnboardingJourneyCompleted.v1": ("OnboardingJourneyCompleted.v2",),
    "WorkforceScenarioChanged.v1": ("WorkforceScenarioCreated.v2", "WorkforceScenarioSimulated.v2", "WorkforceScenarioSubmitted.v2", "WorkforceScenarioDecisionRecorded.v2"),
    "WorkforcePlanPublished.v1": ("WorkforceScenarioPublished.v2",),
    "BenefitAdministrationChanged.v1": ("BenefitPlanCreated.v2", "BenefitPlanPublished.v2", "BenefitLifeEventSubmitted.v2"),
    "BenefitEnrollmentChanged.v1": ("BenefitEnrollmentSubmitted.v2", "BenefitEnrollmentDecided.v2"),
    "HrCaseChanged.v1": ("HrServiceCaseCreated.v2", "HrServiceCaseTriaged.v2", "HrServiceCaseAssigned.v2", "HrServiceCaseResponseRecorded.v2"),
    "HrCaseResolved.v1": ("HrServiceCaseResolved.v2",),
    "ContingentEngagementChanged.v1": ("ContingentEngagementCreated.v2", "ContingentEngagementSubmitted.v2", "ContingentEngagementActivated.v2", "ContingentEngagementOffboardingStarted.v2", "ContingentEngagementClosed.v2"),
    "ContingentAccessExpired.v1": ("ContingentAccessExpired.v2",),
    "SkillsTaxonomyPublished.v1": ("SkillsTaxonomyPublished.v2",),
    "WorkerSkillEvidenceVerified.v1": ("WorkerSkillEvidenceVerified.v2",),
    "GrowthProfileChanged.v1": ("GrowthProfileCreated.v2", "GrowthProfileUpdated.v2", "GrowthCoachingRecorded.v2", "GrowthProfileArchived.v2"),
    "GrowthEvidenceLinked.v1": ("GrowthEvidenceLinked.v2",),
    "LearningAssignmentChanged.v1": ("LearningEnrollmentCreated.v2", "LearningAssignmentStarted.v2"),
    "LearningCompletionVerified.v1": ("LearningCompletionVerified.v2",),
    "OpportunityApplicationChanged.v1": ("TalentOpportunityApplicationSubmitted.v2", "TalentOpportunityApplicationShortlisted.v2"),
    "OpportunitySelectionRecorded.v1": ("TalentOpportunitySelectionRecorded.v2",),
    "SuccessionPlanChanged.v1": ("SuccessionPlanCreated.v2", "SuccessionNominationAdded.v2", "SuccessionPlanSubmitted.v2", "SuccessionPlanApproved.v2"),
    "SuccessionPlanPublished.v1": ("SuccessionPlanPublished.v2",),
    "CompensationPlanChanged.v1": ("CompensationCycleCreated.v2", "CompensationBudgetAllocated.v2", "CompensationProposalSubmitted.v2", "CompensationPlanApprovalRecorded.v2"),
    "CompensationPlanApproved.v1": ("ApprovedCompensationPlanSnapshotPublished.v2",),
    "ListeningProgramChanged.v1": ("EmployeeListeningSurveyCreated.v3", "EmployeeListeningSurveyPublished.v3", "EmployeeListeningSurveyClosed.v3", "EmployeeListeningActionCreated.v3", "EmployeeListeningActionCompleted.v3"),
    "ListeningSurveyPublished.v1": ("EmployeeListeningSurveyPublished.v3",),
    "MetricDefinitionPublished.v1": ("PeopleMetricPublished.v2",),
    "MetricProjectionChanged.v1": ("PeopleMetricPublished.v2",),
    "AiAssistanceProduced.v1": ("GovernedAiAssistanceProduced.v2",),
    "AiPolicyChanged.v1": ("GovernedAiPolicyCreated.v2", "GovernedAiPolicyEvaluationRequested.v2", "GovernedAiPolicyEvaluationCompleted.v2", "GovernedAiPolicyPublished.v2", "GovernedAiPolicySuspended.v2", "GovernedAiPolicyRetired.v2"),
    "WorkforceScheduleCandidateGenerated.v1": ("WorkforceScheduleCandidateGenerated.v2",),
    "WorkforceSchedulePublished.v1": ("WorkforceSchedulePublished.v2",),
}


REVIEW_NOTES = {
    "CandidateHired.v1": "CandidateHired is no longer command-authored; only the idempotent HRM owner-ack handler may emit it after worker/employment/assignment verification.",
    "CandidateStageChanged.v1": "Offer and hire-pending facts are split from generic stage change so a consumer never infers an offer or worker from a stage token.",
    "OnboardingJourneyChanged.v1": "Assignment, task completion and cancellation are independent aggregate facts; final journey completion is a separate conditional event.",
    "BenefitAdministrationChanged.v1": "The polymorphic caseId payload is removed; planId and lifeEventId remain distinct typed identity spaces.",
    "CompensationPlanApproved.v1": "PAY notification moves exclusively to immutable snapshot header plus 1..N lines commit; plan approval alone is not payroll-consumable.",
    "MetricProjectionChanged.v1": "Projection publication is represented by PeopleMetricPublished with the exact projection identity/revision/digest from the same transaction.",
    "AiPolicyChanged.v1": "Policy lifecycle actions are split into explicit facts; suspended is a committed kill-switch outcome, not an inferred label.",
    "WorkforceScheduleCandidateGenerated.v1": "Optimization produces a candidate only; publish-ledger creation remains exclusively owned by the publish command.",
}


def render(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2) + "\n"


def build() -> dict:
    events_doc = json.loads(EVENTS.read_text(encoding="utf-8"))
    listening_summary = json.loads(LISTENING_SUMMARY.read_text(encoding="utf-8"))
    listening_body = {
        key: value for key, value in listening_summary.items()
        if key != "sealedPayloadSha256"
    }
    listening_seal = hashlib.sha256(json.dumps(
        listening_body, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode()).hexdigest()
    if (
        listening_summary.get("contractId") != LISTENING_SUMMARY_ID
        or listening_summary.get("status")
        != "CANONICAL_G3_START_AUTHORITY_NOT_IMPLEMENTED"
        or listening_summary.get("sealedPayloadSha256") != listening_seal
        or listening_summary.get("canonicalPrecedence", {}).get("mode")
        != "CANONICAL_FIVE_PRIMARY_DERIVED_SUMMARY_ONLY"
    ):
        raise ValueError("derived Listening summary is missing, stale, or unsealed")
    schemas = {row["eventName"]: row for row in events_doc["eventPayloadSchemas"]}
    reviewed_rows = {
        row["predecessorEvent"]: row
        for row in load_candidate_ssot()["eventSuccessorLineage"]
    }
    if len(SUCCESSORS) != 32:
        raise ValueError(f"stable predecessor scope drift: {len(SUCCESSORS)}")
    if set(reviewed_rows) != set(SUCCESSORS):
        raise ValueError("reviewed predecessor lineage closed-set drift")
    missing = sorted({name for names in SUCCESSORS.values() for name in names} - set(schemas))
    if missing:
        raise ValueError("successor schema missing: " + ", ".join(missing))
    rows = []
    covered: set[str] = set()
    for predecessor, static_successors in sorted(SUCCESSORS.items()):
        reviewed = reviewed_rows[predecessor]
        successor_names = tuple(reviewed["successorEvents"])
        if successor_names != static_successors:
            raise ValueError(f"reviewed/static successor map drift: {predecessor}")
        covered.update(successor_names)
        successor_contracts = []
        consumer_sessions: set[str] = set()
        reviewed_contracts = {
            row["eventName"]: row for row in reviewed["successorContracts"]
        }
        if set(reviewed_contracts) != set(successor_names):
            raise ValueError(f"reviewed successor contract closure drift: {predecessor}")
        for name in successor_names:
            schema = schemas[name]
            policy = schema["consumerRefetchPolicy"]
            reviewed_contract = copy.deepcopy(reviewed_contracts[name])
            if (
                reviewed_contract["payloadFields"] != [field["name"] for field in schema["fields"]]
                or set(reviewed_contract["allowedConsumerSessions"])
                != set(policy["allowedConsumerSessions"])
                or set(reviewed_contract["purposeCodes"]) != set(policy["purposeCodes"])
            ):
                raise ValueError(f"reviewed lineage/event schema drift: {predecessor} -> {name}")
            consumer_sessions.update(reviewed_contract["allowedConsumerSessions"])
            reviewed_contract.update({
                "schemaRef": EVENTS.name + "#" + name,
                "requiredPayloadFields": [field["name"] for field in schema["fields"] if field.get("required")],
                "pep": policy["pep"],
            })
            successor_contracts.append(reviewed_contract)
        rows.append({
            "predecessorEvent": predecessor,
            "disposition": reviewed["disposition"],
            "successorEvents": list(successor_names),
            "successorContracts": successor_contracts,
            "fieldCompatibility": {
                "wireCompatibility": "BREAKING_MAJOR_VERSION_EXPLICIT",
                "commonCausalFields": ["aggregateId", "fromState", "toState", "aggregateVersion", "occurredAt", "correlationId"],
                "businessFieldRule": "Only fields listed in each successor payload schema exist; UUID fields retain exact entity/idSpace and may not be positionally substituted.",
                "silentFieldDropAllowed": False,
                "lossAssessment": "NO_RUNTIME_DATA_LOSS_BECAUSE_PREDECESSOR_IS_NOT_STARTED_G3; semantic narrowing/splitting is intentional and must be compiled against the v2 schema before activation.",
                "reviewNote": REVIEW_NOTES.get(predecessor, "Broad predecessor fact is replaced by explicit operation-level committed business fact(s)."),
            },
            "consumerMigration": {
                "allowedConsumerSessions": sorted(consumer_sessions),
                "orphanConsumerCount": 0,
                "unknownConsumerPolicy": "DENY",
            },
            "registryUpdateSet": copy.deepcopy(reviewed["registryUpdateSet"]),
            "runtimeDualPublish": {
                "required": False,
                "reason": "All predecessor producers remain NOT_STARTED_G3 and production remains NOT_AUTHORIZED_G6; no deployed consumer may exist.",
                "activationPrecondition": "Re-evaluate if any predecessor is implemented or observed before G6.",
            },
        })
    introduced = sorted(set(schemas) - covered)
    document = {
        "contractId": "dwp.hris.modern.event-successor-lineage.v2",
        "schemaVersion": 2,
        "status": "SEALED_G3_DESIGN_NOT_IMPLEMENTED",
        "scope": {
            "predecessorEvents": len(rows), "successorEventSchemas": len(schemas),
            "successorEventsMappedFromV1": len(covered), "newOperationFactsWithoutV1Predecessor": len(introduced),
            "orphanPredecessorConsumers": 0,
            "implementationState": "NOT_STARTED_G3", "productionState": "NOT_AUTHORIZED_G6",
        },
        "policies": {
            "implicitRename": "FORBIDDEN", "implicitDeletion": "FORBIDDEN",
            "wireCompatibility": "MAJOR_VERSION_EXPLICIT",
            "consumerActivation": "ALL_REGISTERED_CONSUMERS_MUST_COMPILE_AND_PASS_CONTRACT_TESTS_BEFORE_G6",
        },
        "lineage": rows,
        "introducedV2Events": introduced,
        "canonicalDerivedSummaries": {
            "sysListeningStreamSummary": {
                "contractId": LISTENING_SUMMARY_ID,
                "path": LISTENING_SUMMARY.name,
                "fileSha256": hashlib.sha256(LISTENING_SUMMARY.read_bytes()).hexdigest(),
                "sealedPayloadSha256": listening_seal,
                "canonicalInputSetSha256": listening_summary["canonicalPrecedence"]
                ["generatedSummary"]["canonicalInputSetSha256"],
                "capabilityId": "HRIS.MODERN.EMPLOYEE_LISTENING",
                "authorityMode": "DERIVED_SUMMARY_OF_CANONICAL_FIVE",
                "canonicalRowsRole": "PRIMARY_ACTIVE_EVENT_AUTHORITY",
            }
        },
    }
    body = json.dumps(document, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
    document["sealedPayloadSha256"] = hashlib.sha256(body).hexdigest()
    return document


def main() -> int:
    parser = argparse.ArgumentParser()
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--write", action="store_true")
    group.add_argument("--check", action="store_true")
    args = parser.parse_args()
    expected = render(build())
    if args.write:
        OUTPUT.write_text(expected, encoding="utf-8")
        print("MODERN_EVENT_SUCCESSOR_LINEAGE_GENERATE=PASS predecessors=32 orphanConsumers=0")
        return 0
    ok = OUTPUT.is_file() and OUTPUT.read_text(encoding="utf-8") == expected
    print("MODERN_EVENT_SUCCESSOR_LINEAGE_CHECK=" + ("PASS" if ok else "FAIL"))
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
