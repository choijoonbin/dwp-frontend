#!/usr/bin/env python3
"""Validate the sealed BASE-TFR-PER-009 semantic-closure carrier."""

from __future__ import annotations

import csv
import hashlib
import json
import pathlib
import subprocess
import sys
from typing import Any


FRONTEND = pathlib.Path(__file__).resolve().parents[5]
WORKSPACE = FRONTEND.parent
REPOSITORIES = {
    "dwp-frontend": FRONTEND,
    "dwp-backend": WORKSPACE / "dwp-backend",
    "dwp_agent": WORKSPACE / "dwp_agent",
}
CARRIER = pathlib.Path(__file__).resolve().parent
SEMANTIC_PATH = CARRIER / "semantic-dispositions/base-tfr-per-009.semantic-disposition.v1.json"
REVIEW_PATH = CARRIER / "independent-review.v1.json"
PEP_REGISTER_PATH = (
    FRONTEND
    / "docs/06-delivery/hris/recovery/hris-porting-blueprint-2026-09-09/coding-readiness/api-pep-binding-register.csv"
)

EXPECTED_STATES = [
    "DRAFT",
    "SUBMITTED",
    "RETURNED",
    "APPROVED",
    "ACTIVE",
    "COMPLETED",
    "CANCELLED",
]
EXPECTED_TRANSITIONS = [
    "create:EMPTY->DRAFT",
    "submit:DRAFT|RETURNED->SUBMITTED",
    "return:SUBMITTED->RETURNED",
    "approve:SUBMITTED->APPROVED",
    "activate:APPROVED->ACTIVE",
    "progress:ACTIVE->ACTIVE",
    "complete:ACTIVE->COMPLETED",
    "cancel:DRAFT|SUBMITTED|RETURNED|ACTIVE->CANCELLED",
]
EXPECTED_PER009_TRANSITIONS = EXPECTED_TRANSITIONS[:2]
EXPECTED_GOAL_FIELDS = ["goalId", "goalState", "revisionNo", "aggregateVersion"]
EXPECTED_EVENT_FIELDS = ["goalId", "ownerType", "ownerPublicId", "revisionNo", "state"]
EXPECTED_RECEIPT_STATES = [
    "ACCEPTED",
    "RUNNING",
    "SUCCEEDED",
    "FAILED",
    "RESULT_UNKNOWN",
    "QUARANTINED",
]
EXPECTED_CONTRACTS = {
    "PEP-PER-010": {
        "operationId": "createGoal",
        "browserPath": "/api/people/v1/hris/performance/goals",
        "ownerPath": "/v1/hris/performance/goals",
        "successStatus": 201,
    },
    "PEP-PER-011": {
        "operationId": "submitGoal",
        "browserPath": "/api/people/v1/hris/performance/goals/{goalId}/submit",
        "ownerPath": "/v1/hris/performance/goals/{goalId}/submit",
        "successStatus": 200,
    },
}


def load(path: pathlib.Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def digest(path: pathlib.Path) -> tuple[int, str]:
    data = path.read_bytes()
    return len(data), hashlib.sha256(data).hexdigest()


def require(condition: bool, message: str, failures: list[str]) -> None:
    if not condition:
        failures.append(message)


def git(repo: pathlib.Path, *args: str) -> str:
    return subprocess.run(
        ["git", "-C", str(repo), *args],
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()


def validate_pin(pin: dict[str, Any], failures: list[str]) -> None:
    repository = pin["repository"]
    require(repository in REPOSITORIES, f"unknown pin repository: {repository}", failures)
    if repository not in REPOSITORIES:
        return
    path = REPOSITORIES[repository] / pin["path"]
    require(path.is_file(), f"pinned artifact missing: {repository}:{pin['path']}", failures)
    if not path.is_file():
        return
    size, sha256 = digest(path)
    require(size == pin["bytes"], f"pinned byte drift: {repository}:{pin['path']}", failures)
    require(sha256 == pin["sha256"], f"pinned SHA-256 drift: {repository}:{pin['path']}", failures)
    if "blob" in pin:
        blob = git(REPOSITORIES[repository], "hash-object", str(path))
        require(blob == pin["blob"], f"pinned blob drift: {repository}:{pin['path']}", failures)


def validate_baseline(name: str, baseline: dict[str, Any], failures: list[str]) -> None:
    repo = REPOSITORIES[baseline["repository"]]
    commit = baseline["commit"]
    try:
        tree = git(repo, "rev-parse", f"{commit}^{{tree}}")
    except subprocess.CalledProcessError:
        failures.append(f"{name} baseline commit is unavailable")
        return
    require(tree == baseline["tree"], f"{name} baseline tree drift", failures)


def baseline_paths(repo: pathlib.Path, commit: str, prefix: str) -> list[str]:
    output = git(repo, "ls-tree", "-r", "--name-only", commit, "--", prefix)
    return [line for line in output.splitlines() if line]


def split_pipe(value: str) -> list[str]:
    return value.split("|") if value else []


def binding_from_register(row: dict[str, str]) -> dict[str, Any]:
    return {
        "contractId": row["binding_id"],
        "sourceAuthorizationAliases": split_pipe(row["source_authorization_alias"]),
        "canonicalAppEntitlement": row["canonical_app_entitlement"],
        "profilesAndDuties": [
            {"profile": pair.split(">", 1)[0], "duty": pair.split(">", 1)[1]}
            for pair in split_pipe(row["authorization_profiles"])
        ],
        "canonicalCapabilities": split_pipe(row["canonical_capability_keys"]),
        "canonicalResourceTypes": split_pipe(row["canonical_resource_types"]),
        "canonicalResourceKeys": split_pipe(row["canonical_resource_keys"]),
        "canonicalActions": split_pipe(row["canonical_actions"]),
        "canonicalPopulationTypes": split_pipe(row["canonical_population_types"]),
        "canonicalFieldGroupKeys": split_pipe(row["canonical_field_group_keys"]),
        "purposeCodes": split_pipe(row["purpose_codes"]),
        "pepLayers": split_pipe(row["pep_layers"]),
        "evidenceState": row["state"],
    }


def main() -> int:
    failures: list[str] = []
    for path in (SEMANTIC_PATH, REVIEW_PATH):
        require(path.is_file(), f"carrier artifact missing: {path.relative_to(FRONTEND)}", failures)
    if failures:
        print(json.dumps({"status": "FAIL", "failures": failures}, indent=2))
        return 1

    semantic = load(SEMANTIC_PATH)
    review = load(REVIEW_PATH)

    require(semantic.get("sliceId") == "BASE-TFR-PER-009", "semantic slice drift", failures)
    require(semantic.get("module") == "PER", "semantic module drift", failures)
    require(semantic.get("boundedContext") == "PERFORMANCE", "semantic bounded context drift", failures)
    require(semantic.get("sourceRef") == "TFR-PER-009", "semantic source ref drift", failures)
    require(
        semantic.get("sourceFamily")
        == {
            "sha256": "21fa3ac9605bfe264bea52502bd41e1a4608e0feec4e30ea2ecaf276c99b3286",
            "rowCount": 77,
        },
        "source family drift",
        failures,
    )
    require(semantic.get("immutability", {}).get("sealed") is True, "semantic is not sealed", failures)
    require(
        semantic.get("immutability", {}).get("amendmentPolicy")
        == "APPEND_ONLY_SUCCESSOR_WITH_NEW_ID_AND_SHA256",
        "semantic amendment policy drift",
        failures,
    )

    authority = semantic["authority"]
    require(authority["semanticClosureCommitAndPushAuthorized"] is True, "semantic carrier commit authority missing", failures)
    require(authority["boundedAuthorizationSuccessorPreparationEligible"] is True, "authorization successor eligibility missing", failures)
    for key in (
        "centralAuthorizationSuccessorIssued",
        "ownerPacketAuthorized",
        "startTokenAuthorized",
        "worktreeAuthorized",
        "migrationLeaseAuthorized",
        "sourceAuthoringAuthorized",
        "routeMenuOrTenantActivationAuthorized",
        "completionCreditAuthorized",
    ):
        require(authority[key] is False, f"authority escaped semantic closure: {key}", failures)

    basis = semantic["authorityBasis"]
    validate_baseline("frontend", basis["frontendBaseline"], failures)
    validate_baseline("backend", basis["backendBaseline"], failures)
    validate_baseline("agent", basis["agentBaseline"], failures)
    for pin in basis["acceptedEvidence"]:
        validate_pin(pin, failures)
    for pin in semantic["preservedPartialSurface"]["pins"]:
        validate_pin(pin, failures)

    backend = REPOSITORIES["dwp-backend"]
    backend_commit = basis["backendBaseline"]["commit"]
    require(
        baseline_paths(
            backend,
            backend_commit,
            "dwp-people-server/src/main/java/com/dwp/services/people/hris/performance/per009",
        )
        == [],
        "canonical PER-009 backend already existed at the pinned baseline",
        failures,
    )
    require(
        baseline_paths(
            backend,
            backend_commit,
            "dwp-people-server/src/main/resources/db/performance-migration/V21__per_base_tfr_per_009.sql",
        )
        == [],
        "PER-009 V21 already existed at the pinned baseline",
        failures,
    )

    aggregate = semantic["aggregate"]
    require(aggregate["states"] == EXPECTED_STATES, "Goal state set or order drift", failures)
    require(aggregate["initialState"] == "DRAFT", "Goal initial state drift", failures)
    require(aggregate["terminalStates"] == ["COMPLETED", "CANCELLED"], "Goal terminal states drift", failures)
    require(aggregate["transitions"] == EXPECTED_TRANSITIONS, "Goal transition matrix drift", failures)
    require(aggregate["per009OwnedTransitions"] == EXPECTED_PER009_TRANSITIONS, "PER-009 transition ownership drift", failures)
    require("RETURNED" in aggregate["returnedDecision"], "RETURNED decision missing", failures)
    require("AT_RISK" in aggregate["progressHealthSeparation"], "AT_RISK separation missing", failures)
    require("does not transition" in aggregate["automaticCompletionRule"], "automatic completion prohibition missing", failures)

    contracts = {item["contractId"]: item for item in semantic["commandContracts"]}
    require(set(contracts) == set(EXPECTED_CONTRACTS), "command contract set drift", failures)
    for contract_id, expected in EXPECTED_CONTRACTS.items():
        item = contracts[contract_id]
        require(item["method"] == "POST", f"{contract_id} method drift", failures)
        require(item["requiredRequestHeaders"] == ["Idempotency-Key", "If-Match"], f"{contract_id} header drift", failures)
        require(item["successBody"] == "Goal", f"{contract_id} success body drift", failures)
        require(item["implementationAuthorizedNow"] is False, f"{contract_id} source authority escaped", failures)
        for key, value in expected.items():
            require(item[key] == value, f"{contract_id} {key} drift", failures)
    require('literal "0"' in contracts["PEP-PER-010"]["ifMatchSemantics"], "create absent-version CAS drift", failures)
    require("does not require" in contracts["PEP-PER-010"]["weightRule"], "create improperly requires complete group weight", failures)
    require("1.000000" not in contracts["PEP-PER-010"]["weightRule"], "create still binds group total", failures)
    require(contracts["PEP-PER-011"]["allowedFromStates"] == ["DRAFT", "RETURNED"], "submit source states drift", failures)
    require("transaction-consistent" in contracts["PEP-PER-011"]["groupWeightGuard"], "submit group-weight consistency guard missing", failures)
    require("1.000000" in contracts["PEP-PER-011"]["groupWeightGuard"], "submit group-weight total drift", failures)
    require("does not append" in contracts["PEP-PER-011"]["revisionSemantics"], "submit incorrectly appends content revision", failures)
    require("preserves current revisionNo and contentHash" in contracts["PEP-PER-011"]["revisionSemantics"], "submit revision preservation drift", failures)

    response = semantic["publicGoalResponse"]
    require(response["closedBodyFields"] == EXPECTED_GOAL_FIELDS, "public Goal body drift", failures)
    require("X-DWP-Command-Receipt-Id" in response["requiredHeaders"], "receipt locator response header missing", failures)
    require("RESULT_UNKNOWN" in response["resultUnknownRule"], "result-unknown response rule missing", failures)

    receipt = semantic["idempotencyAndReceipt"]
    require(receipt["receiptTable"] == "hris_performance.prf_command_receipts", "receipt table drift", failures)
    require(receipt["outboxTable"] == "hris_performance.prf_outbox_events", "outbox table drift", failures)
    require(receipt["newGenericReceiptOrOutboxForbidden"] is True, "generic reliability table prohibition missing", failures)
    require(
        receipt["reservationTuple"]
        == ["tenantId", "subjectPrincipalPublicId", "originatingAction", "idempotencyKey"],
        "receipt reservation tuple drift",
        failures,
    )
    require(receipt["receiptStates"] == EXPECTED_RECEIPT_STATES, "receipt state set drift", failures)
    require(receipt["sameKeyDifferentDigest"] == "409_IDEMPOTENCY_KEY_REUSED", "idempotency mismatch result drift", failures)
    query = receipt["receiptQuery"]
    require(query["primaryOwner"] == "BASE-TFR-PER-011", "receipt query ownership drift", failures)
    require(query["reuseWithoutRecount"] is True, "receipt query recount prohibition missing", failures)

    event = semantic["eventContract"]
    require(event["eventType"] == "PerformanceGoalCommitted.v1", "event type drift", failures)
    require(event["payloadClosedSet"] == EXPECTED_EVENT_FIELDS, "event payload drift", failures)
    require(event["producedForFirstSuccess"] == ["create:DRAFT", "submit:SUBMITTED"], "event production boundary drift", failures)
    require("exactly one outbox" in event["atomicity"], "event atomicity drift", failures)
    require("Create inserts Goal plus immutable revisionNo 1" in event["atomicity"], "create revision atomicity drift", failures)
    require("submit references the existing immutable revision without inserting or changing it" in event["atomicity"], "submit revision atomicity drift", failures)
    require(event["replay"] == "Idempotent replay emits zero additional events.", "event replay drift", failures)

    auth = semantic["authorizationSuccessorRequirement"]
    require(auth["state"] == "BOUNDED_SUCCESSOR_REQUIRED_BEFORE_OWNER_PACKET", "authorization successor state drift", failures)
    require(auth["currentVersion"] == 62, "authorization baseline version drift", failures)
    require(len(auth["sevenLayers"]) == 7, "authorization layer count drift", failures)
    require("IAQ-038 remains owned by BASE-TFR-PER-008" in auth["ownershipBoundary"], "IAQ-038 ownership drift", failures)
    with PEP_REGISTER_PATH.open(encoding="utf-8", newline="") as source:
        register_rows = {
            row["binding_id"]: row
            for row in csv.DictReader(source)
            if row["binding_id"] in EXPECTED_CONTRACTS
        }
    require(set(register_rows) == set(EXPECTED_CONTRACTS), "PEP register row set drift", failures)
    expected_bindings = [binding_from_register(register_rows[contract_id]) for contract_id in EXPECTED_CONTRACTS]
    require(auth["exactBindings"] == expected_bindings, "exact PEP-PER-010/011 authorization matrix drift", failures)
    for contract_id, row in register_rows.items():
        require(row["source_operation_id"] == contracts[contract_id]["operationId"], f"{contract_id} register operation drift", failures)
        require(row["method"] == contracts[contract_id]["method"], f"{contract_id} register method drift", failures)
        require(row["browser_path"] == contracts[contract_id]["browserPath"], f"{contract_id} register browser path drift", failures)
        require(row["owner_path"] == contracts[contract_id]["ownerPath"], f"{contract_id} register owner path drift", failures)

    people_auth_path = backend / "dwp-people-server/src/main/resources/product-authorization/hcm-people-pep-v62.generated.json"
    people_auth_text = people_auth_path.read_text(encoding="utf-8")
    require("/api/people/v1/hris/performance/goals" not in people_auth_text, "canonical PER-009 route unexpectedly present in v62", failures)
    require("PEP-PER-010" not in people_auth_text, "PEP-PER-010 unexpectedly present in v62", failures)
    require("PEP-PER-011" not in people_auth_text, "PEP-PER-011 unexpectedly present in v62", failures)

    cutover = semantic["legacyAdapterCutover"]
    require(cutover["role"] == "PRESERVED_PROGRESS_ADAPTER_NOT_CANONICAL_CREATE_OR_SUBMIT", "legacy adapter role drift", failures)
    require(cutover["canonicalCreateSubmitAreSoleWritersForTheirOperations"] is True, "canonical sole-writer rule missing", failures)
    require(cutover["dualReadForbidden"] is True, "dual-read prohibition missing", failures)
    require(cutover["dualWriteForbidden"] is True, "dual-write prohibition missing", failures)
    require(cutover["legacyCompletionInferenceForbidden"] is True, "legacy completion inference prohibition missing", failures)

    migration = semantic["migrationDecision"]
    require(migration["observedHighWater"] == "V20", "migration high-water drift", failures)
    require(migration["candidateVersion"] == "V21", "migration candidate drift", failures)
    require(migration["leaseState"] == "NOT_ISSUED", "migration lease escaped", failures)
    require(migration["reservationAuthorizedNow"] is False, "migration reservation authority escaped", failures)
    require(migration["sourceAuthorizedNow"] is False, "migration source authority escaped", failures)
    require(
        migration["candidatePathAfterLease"]
        == "dwp-people-server/src/main/resources/db/performance-migration/V21__per_base_tfr_per_009.sql",
        "V21 candidate path drift",
        failures,
    )
    require(
        migration["exactCandidateTables"]
        == [
            "hris_performance.prf_goals",
            "hris_performance.prf_goal_revisions",
            "hris_performance.prf_goal_alignments",
        ],
        "V21 candidate table set drift",
        failures,
    )
    require(len(migration["forbiddenPaths"]) == 2, "forbidden migration path set drift", failures)

    acceptance = semantic["acceptanceConditions"]
    acceptance_ids = [item["id"] for item in acceptance]
    require(acceptance_ids == [f"PER009-AC-{number:02d}" for number in range(1, 13)], "acceptance ID set drift", failures)
    require(all(len(item["verificationTargets"]) >= 2 for item in acceptance), "acceptance verification targets missing", failures)
    acceptance_by_id = {item["id"]: item["criterion"] for item in acceptance}
    require("without requiring the group total" in acceptance_by_id["PER009-AC-03"], "AC-03 create weight boundary drift", failures)
    require("exactly 1.000000" in acceptance_by_id["PER009-AC-04"], "AC-04 submit group-weight guard drift", failures)
    require("without appending a revision" in acceptance_by_id["PER009-AC-04"], "AC-04 submit revision boundary drift", failures)
    require("submit atomically updates only state and aggregateVersion" in acceptance_by_id["PER009-AC-08"], "AC-08 submit atomic write-set drift", failures)
    require(semantic["acceptanceVerificationPolicy"]["targetedFirst"] is True, "targeted-first validation policy missing", failures)
    require(semantic["acceptanceVerificationPolicy"]["fullSuiteRequiredByThisClosure"] is False, "unnecessary full-suite requirement escaped", failures)

    require(review.get("sliceId") == "BASE-TFR-PER-009", "review slice drift", failures)
    require(review.get("module") == "PER", "review module drift", failures)
    require(review.get("immutability", {}).get("sealed") is True, "review is not sealed", failures)
    require(
        review.get("immutability", {}).get("amendmentPolicy")
        == "APPEND_ONLY_SUCCESSOR_WITH_NEW_ID_AND_SHA256",
        "review amendment policy drift",
        failures,
    )
    require(
        review.get("postResolutionSeverityCounts") == {"P0": 0, "P1": 0, "P2": 0},
        "review severity counts drift",
        failures,
    )
    require(
        {item["reviewer"] for item in review["independentReviewers"]}
        == {"per009_semantic_audit", "per009_current_surface", "per009_v21_allocator"},
        "independent reviewer set drift",
        failures,
    )
    semantic_size, semantic_sha = digest(SEMANTIC_PATH)
    require(
        review["reviewedArtifacts"]
        == [
            {
                "repository": "dwp-frontend",
                "path": str(SEMANTIC_PATH.relative_to(FRONTEND)),
                "bytes": semantic_size,
                "sha256": semantic_sha,
            }
        ],
        "independent review semantic pin drift",
        failures,
    )
    review_authority = review["authority"]
    require(review_authority["independentReviewComplete"] is True, "independent review incomplete", failures)
    require(review_authority["semanticCarrierCommitAndPushAuthorized"] is True, "review commit authority missing", failures)
    for key in (
        "centralAuthorizationSuccessorIssued",
        "ownerPacketAuthorized",
        "startTokenAuthorized",
        "worktreeAuthorized",
        "migrationLeaseAuthorized",
        "sourceAuthoringAuthorized",
        "completionCreditAuthorized",
    ):
        require(review_authority[key] is False, f"review authority escaped: {key}", failures)

    if failures:
        print(json.dumps({"status": "FAIL", "failureCount": len(failures), "failures": failures}, indent=2))
        return 1
    print(
        json.dumps(
            {
                "status": "PASS",
                "sliceId": "BASE-TFR-PER-009",
                "validatedArtifacts": 2,
                "acceptedEvidencePins": len(basis["acceptedEvidence"]),
                "preservedSurfacePins": len(semantic["preservedPartialSurface"]["pins"]),
                "acceptanceConditions": len(acceptance),
                "postResolutionSeverityCounts": review["postResolutionSeverityCounts"],
                "sourceAuthoringAuthorized": False,
                "nextAction": semantic["nextAuthorizedAction"]["action"],
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
