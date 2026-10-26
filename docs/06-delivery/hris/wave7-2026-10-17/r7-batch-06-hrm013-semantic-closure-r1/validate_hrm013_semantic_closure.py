#!/usr/bin/env python3
"""Validate the sealed BASE-TFR-HRM-013 semantic and central-authority carrier."""

from __future__ import annotations

import hashlib
import json
import pathlib
import sys
from typing import Any


ROOT = pathlib.Path(__file__).resolve().parents[5]
CARRIER = pathlib.Path(__file__).resolve().parent
SEMANTIC_PATH = CARRIER / "semantic-dispositions/base-tfr-hrm-013.semantic-disposition.v1.json"
CONTRACT_PATH = CARRIER / "contract-successors/base-tfr-hrm-013.contract-successor.v1.json"
MIGRATION_PATH = CARRIER / "migration-manifests/base-tfr-hrm-013.people-v61-schema-manifest.v1.json"
AUTH_PATH = CARRIER / "hrm-013-central-contract-authorization-successor.v1.json"
REVIEW_PATH = CARRIER / "independent-review.v1.json"

EXPECTED_STATES = [
    "DRAFT",
    "TASKS_ACTIVE",
    "READY_TO_PUBLISH",
    "PUBLISHED",
    "CORRECTION_REQUIRED",
    "CANCELLED",
]
EXPECTED_TRANSITIONS = [
    "create:EMPTY->DRAFT",
    "activate:DRAFT->TASKS_ACTIVE",
    "task.receive:TASKS_ACTIVE->TASKS_ACTIVE|READY_TO_PUBLISH",
    "publish:READY_TO_PUBLISH->PUBLISHED",
    "reconcile:PUBLISHED->CORRECTION_REQUIRED",
    "cancel:DRAFT|TASKS_ACTIVE->CANCELLED",
]
EXPECTED_NON_CREATE_OPERATIONS = {
    "activate",
    "task.receive",
    "publish",
    "reconcile",
    "cancel",
}
EXPECTED_EVENT_FIELDS = [
    "casePublicId",
    "workerPublicId",
    "relationshipPublicId",
    "separationType",
    "effectiveDate",
]
EXPECTED_EVENT_CONSUMERS = ["HRIS-PER", "HRIS-TIM", "HRIS-PAY"]
EXPECTED_NEW_TABLES = {
    "ppl_separation_cases",
    "ppl_separation_tasks",
    "ppl_separation_callbacks",
}
EXPECTED_EVENT_TYPES = {
    "HIRE",
    "CONCURRENT_EMPLOYMENT",
    "REHIRE",
    "TERMINATION",
    "CORRECTION",
}
EXPECTED_ROUTE_KEYS = [
    "route.hcm.operations.exit-return.page",
    "route.hcm.operations.exit-return.data",
    "route.hcm.operations.separation-case.action",
]


def load(path: pathlib.Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def digest(path: pathlib.Path) -> tuple[int, str]:
    data = path.read_bytes()
    return len(data), hashlib.sha256(data).hexdigest()


def require(condition: bool, message: str, failures: list[str]) -> None:
    if not condition:
        failures.append(message)


def validate_pin(pin: dict[str, Any], failures: list[str]) -> None:
    path = ROOT / pin["path"]
    require(path.is_file(), f"pinned artifact missing: {pin['path']}", failures)
    if path.is_file():
        size, sha256 = digest(path)
        require(size == pin["bytes"], f"pinned byte drift: {pin['path']}", failures)
        require(sha256 == pin["sha256"], f"pinned SHA-256 drift: {pin['path']}", failures)


def main() -> int:
    failures: list[str] = []
    for path in (SEMANTIC_PATH, CONTRACT_PATH, MIGRATION_PATH, AUTH_PATH, REVIEW_PATH):
        require(path.is_file(), f"carrier artifact missing: {path.relative_to(ROOT)}", failures)
    if failures:
        print(json.dumps({"status": "FAIL", "failures": failures}, indent=2))
        return 1

    semantic = load(SEMANTIC_PATH)
    contract = load(CONTRACT_PATH)
    migration = load(MIGRATION_PATH)
    auth = load(AUTH_PATH)
    review = load(REVIEW_PATH)
    documents = (semantic, contract, migration, auth)

    for index, document in enumerate(documents, start=1):
        require(document.get("sliceId") == "BASE-TFR-HRM-013", f"document {index} slice drift", failures)
        require(document.get("module") == "HRM", f"document {index} module drift", failures)
        require(document.get("immutability", {}).get("sealed") is True, f"document {index} is not sealed", failures)
        require(
            document.get("immutability", {}).get("amendmentPolicy")
            == "APPEND_ONLY_SUCCESSOR_WITH_NEW_ID_AND_SHA256",
            f"document {index} amendment policy drift",
            failures,
        )
    require(review.get("sliceId") == "BASE-TFR-HRM-013", "review slice drift", failures)
    require(review.get("module") == "HRM", "review module drift", failures)
    require(review.get("immutability", {}).get("sealed") is True, "review is not sealed", failures)
    require(
        review.get("state")
        == "INDEPENDENTLY_REVIEWED_PASS_ZERO_P0_ZERO_P1_ZERO_P2_CARRIER_MAY_COMMIT_AND_PUSH_CENTRAL_WORKTREE_TOKEN_PREPARATION_ELIGIBLE",
        "review state drift",
        failures,
    )

    for pin in [
        semantic["authorityBasis"]["batch06Preflight"],
        semantic["authorityBasis"]["r7c0Reclassification"],
        *semantic["authorityBasis"]["acceptedEvidence"],
    ]:
        validate_pin(pin, failures)

    semantic_size, semantic_sha = digest(SEMANTIC_PATH)
    contract_size, contract_sha = digest(CONTRACT_PATH)
    migration_size, migration_sha = digest(MIGRATION_PATH)
    auth_size, auth_sha = digest(AUTH_PATH)
    for owner, reference, size, sha in (
        ("contract", contract["semanticDisposition"], semantic_size, semantic_sha),
        ("migration", migration["semanticDisposition"], semantic_size, semantic_sha),
        ("authorization.semantic", auth["authorityBasis"]["semanticDisposition"], semantic_size, semantic_sha),
        ("authorization.contract", auth["authorityBasis"]["contractSuccessor"], contract_size, contract_sha),
        ("authorization.migration", auth["authorityBasis"]["peopleV61SchemaManifest"], migration_size, migration_sha),
    ):
        require(reference["bytes"] == size, f"{owner} reference byte drift", failures)
        require(reference["sha256"] == sha, f"{owner} reference SHA-256 drift", failures)

    reviewed_artifacts = review["reviewedArtifacts"]
    expected_review_paths = [
        str(SEMANTIC_PATH.relative_to(ROOT)),
        str(CONTRACT_PATH.relative_to(ROOT)),
        str(MIGRATION_PATH.relative_to(ROOT)),
        str(AUTH_PATH.relative_to(ROOT)),
    ]
    require([item["path"] for item in reviewed_artifacts] == expected_review_paths, "reviewed artifact path set drift", failures)
    for item, (size, sha) in zip(
        reviewed_artifacts,
        ((semantic_size, semantic_sha), (contract_size, contract_sha), (migration_size, migration_sha), (auth_size, auth_sha)),
    ):
        require(item["bytes"] == size, f"review byte drift: {item['path']}", failures)
        require(item["sha256"] == sha, f"review SHA-256 drift: {item['path']}", failures)
    require(review["postResolutionSeverityCounts"] == {"P0": 0, "P1": 0, "P2": 0}, "review severity count drift", failures)
    require(review["authority"]["independentReviewComplete"] is True, "independent review is not complete", failures)
    require(review["authority"]["authorityCarrierCommitAndPushAuthorized"] is True, "carrier commit authority missing", failures)
    require(review["authority"]["centralSourceAuthoringAuthorizedNow"] is False, "central source authority escaped review", failures)

    scope = semantic["scopeDecision"]
    require(scope["code"] == "POST_SEPARATION_REHIRE_OR_CORRECTION_ONLY", "scope decision drift", failures)
    require("ppl_employment_absence_periods" in scope["excluded"], "absence table is not excluded", failures)
    require("LEAVE or RETURN employment-event authoring" in scope["excluded"], "general LEAVE/RETURN is not excluded", failures)
    require("leave of absence" in scope["returnEligibilityMeaning"], "RETURN_ELIGIBILITY boundary is not explicit", failures)

    aggregate = semantic["aggregate"]
    require(aggregate["states"] == EXPECTED_STATES, "SeparationCase state set or order drift", failures)
    require(aggregate["transitions"] == EXPECTED_TRANSITIONS, "SeparationCase transition set or order drift", failures)

    operations = {item["operation"]: item for item in semantic["operationClassification"]}
    require(set(operations) == {"create", *EXPECTED_NON_CREATE_OPERATIONS}, "operation classification cardinality drift", failures)
    create = operations["create"]
    require(create["classification"] == "PUBLIC_GATEWAY_PEP", "create is not the sole public PEP", failures)
    require(create["pepId"] == "PEP-HRM-013", "create PEP drift", failures)
    require(create["actionKey"] == "hris.action.hrm.create-separation-case", "create action key drift", failures)
    require(create["method"] == "POST", "create method drift", failures)
    require(create["browserPath"] == "/api/people/v1/hris/separation-cases", "create browser path drift", failures)
    require(create["ownerPath"] == "/v1/hris/separation-cases", "create owner path drift", failures)
    require(create["capability"] == "hcm.operations.separation.manage", "create capability drift", failures)
    for operation in EXPECTED_NON_CREATE_OPERATIONS:
        item = operations[operation]
        require(item["classification"].startswith("TRUSTED_INTERNAL_"), f"{operation} is not trusted-internal", failures)
        require(item.get("publicRoute") is None, f"{operation} invented a public route", failures)
        require(item.get("implementationAuthorizedNow") is False, f"{operation} implementation authority escaped", failures)
    waiver = semantic["waiverClassification"]
    require(waiver["classification"] == "TRUSTED_INTERNAL_APPROVAL_CALLBACK", "waiver classification drift", failures)
    require(waiver["publicRoute"] is None, "waiver invented a public route", failures)
    require(waiver["implementationAuthorizedNow"] is False, "waiver implementation authority escaped", failures)

    idem = semantic["idempotencyAndConcurrency"]
    require(
        idem["publicCommandKey"]
        == ["tenantId", "commandType", "onBehalfOfSubjectPublicId", "originatingAction", "idempotencyKey"],
        "idempotency tuple drift",
        failures,
    )
    require(idem["sameKeySameHash"].startswith("RETURN_ORIGINAL"), "same-hash replay drift", failures)
    require(idem["sameKeyDifferentHash"] == "409_IDEMPOTENCY_KEY_REUSED", "mismatch status drift", failures)
    require(
        idem["callbackUniqueness"] == ["tenantId", "callerWorkloadId", "callbackEventId"],
        "callback uniqueness drift",
        failures,
    )
    require("before business-row reads" in idem["guardOrder"], "callback guard order is not fail closed", failures)

    publication = semantic["publicationBoundary"]
    require(publication["eventContractId"] == "XCON-028", "semantic event ID drift", failures)
    require(publication["eventType"] == "WorkerSeparated.v1", "semantic event type drift", failures)
    require(publication["designConsumers"] == EXPECTED_EVENT_CONSUMERS, "semantic event consumer drift", failures)
    require(publication["payloadClosedSet"] == EXPECTED_EVENT_FIELDS, "semantic event payload drift", failures)
    require(len(publication["atomicWriteSet"]) == 5, "atomic publish write-set drift", failures)

    acceptance_ids = [item["id"] for item in semantic["acceptanceConditions"]]
    require(acceptance_ids == [f"HRM013-AC-{number:02d}" for number in range(1, 13)], "acceptance ID set drift", failures)
    verification_plan = semantic["acceptanceVerificationPlan"]
    require(list(verification_plan) == acceptance_ids, "acceptance verification map drift", failures)
    require(all(len(targets) >= 2 for targets in verification_plan.values()), "acceptance verification target missing", failures)

    query = contract["entryQuery"]
    require(query["queryId"] == "IAQ-011", "IAQ ID drift", failures)
    require(query["method"] == "GET", "IAQ method drift", failures)
    require(query["browserPath"] == "/api/people/v1/hris/workbench/operations/exit/return", "IAQ browser path drift", failures)
    require(query["ownerPath"] == "/v1/hris/workbench/operations/exit/return", "IAQ owner path drift", failures)
    require(query["canonicalRoute"] == "/hr/operations/people/exit-return", "IAQ canonical route drift", failures)
    require(query["capability"] == "hcm.operations.people.view", "IAQ read capability drift", failures)
    require(query["fieldGroups"] == ["SEPARATION_CASE", "RETURN_ELIGIBILITY", "APPROVAL_STATUS"], "IAQ field groups drift", failures)
    require("preliminary PEP-HRM-013" in query["actionExposureRule"], "IAQ action exposure lacks preliminary PEP", failures)
    require("all required field decisions are VIEW" in query["actionExposureRule"], "IAQ action exposure lacks field-decision guard", failures)
    require(contract["internalOperationBoundary"]["publicOrBrowserRoutes"] == [], "public non-create route escaped", failures)
    require(
        all(
            item["transport"] != "PUBLIC_GATEWAY_PEP"
            for item in contract["internalOperationBoundary"]["operations"]
        ),
        "internal operation reclassified as public",
        failures,
    )
    event = contract["eventContract"]
    require(event["contractId"] == "XCON-028", "contract event ID drift", failures)
    require(event["consumers"] == EXPECTED_EVENT_CONSUMERS, "contract event consumer drift", failures)
    require(event["businessPayload"]["required"] == EXPECTED_EVENT_FIELDS, "contract event business payload drift", failures)
    require(event["canonicalData"]["businessFields"] == EXPECTED_EVENT_FIELDS, "canonical event business field drift", failures)
    require(len(event["canonicalData"]["required"]) == 14, "canonical event data field count drift", failures)
    require(len(event["envelopeDataEqualities"]) == 8, "event equality count drift", failures)
    require(event["productionPublishBindings"] == 0, "production event binding escaped", failures)
    require(event["consumerSubscriptions"] == 0, "consumer subscription escaped", failures)

    new_tables = {item["name"] for item in migration["newTables"]}
    require(new_tables == EXPECTED_NEW_TABLES, "V61 new table set drift", failures)
    require(migration["migration"]["observedHighWater"] == "V60", "People high-water drift", failures)
    require(migration["migration"]["candidateVersion"] == "V61", "People candidate version drift", failures)
    require(migration["migration"]["leaseState"] == "NOT_ISSUED", "People V61 lease escaped", failures)
    event_delta = migration["assignmentEventDelta"]
    require(set(event_delta["replaceEventTypeCheckWithExactSet"]) == EXPECTED_EVENT_TYPES, "assignment-event discriminator drift", failures)
    require(event_delta["forbiddenDiscriminators"] == ["LEAVE", "RETURN"], "LEAVE/RETURN exclusion drift", failures)
    require("ppl_employment_absence_periods" in migration["explicitlyExcluded"], "V61 absence persistence escaped", failures)
    callback_table = next(item for item in migration["newTables"] if item["name"] == "ppl_separation_callbacks")
    require(
        "outcome IN ACCEPTED|REJECTED|QUARANTINED" in callback_table["checks"],
        "callback persisted outcome drift",
        failures,
    )
    require("response or telemetry disposition" in callback_table["replayRule"], "callback replay disposition drift", failures)
    require("REPLAY_NOOP" not in "|".join(callback_table["checks"]), "REPLAY_NOOP cannot be a persisted outcome", failures)
    require(set(migration["rowLevelSecurity"]["tables"]) == EXPECTED_NEW_TABLES, "V61 RLS table set drift", failures)
    require(migration["rowLevelSecurity"]["enable"] is True, "V61 RLS is not enabled", failures)
    require(migration["rowLevelSecurity"]["force"] is True, "V61 RLS is not forced", failures)

    lineage = auth["productAuthorizationLineage"]
    require(lineage["predecessor"]["version"] == 60, "authorization predecessor drift", failures)
    require(lineage["successor"]["version"] == 61, "authorization successor drift", failures)
    require(lineage["successor"]["reservationState"] == "RESERVED_NOT_ACTIVE", "product authorization v61 reservation drift", failures)
    require(lineage["successor"]["expectedCounts"] == {
        "capabilities": 279,
        "accessPolicies": 24,
        "entitlementExpressions": 17,
        "predicatePolicies": 87,
        "routes": 1157,
        "PAGE": 162,
        "DATA": 349,
        "ACTION": 646,
    }, "authorization v61 exact count drift", failures)
    capability = auth["capabilityDecision"]["newWriteCapability"]
    require(capability["contractKey"] == "hcm.operations.separation.manage", "write capability drift", failures)
    require(capability["resourceKey"] == "ACTION.HRIS_SEPARATION_CASE", "write resource drift", failures)
    require(capability["action"] == "MANAGE", "write permission drift", failures)
    require(capability["requiredResponsibilityCode"] == "HRIS_DUTY_SEPARATION_MAKER", "maker duty drift", failures)
    require(capability["riskTier"] == "CRITICAL", "write risk tier drift", failures)
    require(capability["activationPolicy"] == "STEPUP-MGMT-HIGH-V1", "step-up policy drift", failures)
    require(capability["responsibilityRequirement"] == "REQUIRED", "responsibility requirement drift", failures)
    require(capability["sodPolicyId"] == "NO_APPROVE_OWN_CHANGE", "SoD policy drift", failures)
    require(capability["owner"] == "People + HCM + Security", "capability owner drift", failures)
    require(capability["policyVersion"] == 1, "capability policy version drift", failures)
    require(capability["lifecycleState"] == "ACTIVE", "capability lifecycle drift", failures)
    require(capability["legacySource"] is None and capability["sunsetAt"] is None, "capability legacy or sunset drift", failures)
    predicate = auth["predicateDecision"]
    require(predicate["inputEvidenceSchemaKey"] == "HcmSeparationCaseScopeEvidenceV1", "predicate evidence schema drift", failures)
    require(predicate["parameterSchemaKey"] == "predicate.hcm-separation-case-scope.v1.parameters.v1", "predicate parameter key drift", failures)
    require(
        predicate["parameterSchema"] == {"type": "object", "properties": {}, "additionalProperties": False},
        "predicate parameter schema is not closed and empty",
        failures,
    )
    routes = auth["routeContracts"]
    require([item["routeContractKey"] for item in routes] == EXPECTED_ROUTE_KEYS, "route contract set or order drift", failures)
    require([item["routeKind"] for item in routes] == ["PAGE", "DATA", "ACTION"], "route kind drift", failures)
    for route in routes[:2]:
        require(route["gatewayPurposeCode"] == "HR_OPERATIONS", f"{route['routeContractKey']} gateway purpose drift", failures)
        require(route["ownerPurposeCode"] == "HR_OPERATIONS", f"{route['routeContractKey']} owner purpose drift", failures)
        exposure = route["responseProjection"].get("actionExposureRule", "")
        require("preliminary PEP-HRM-013" in exposure, f"{route['routeContractKey']} action exposure lacks preliminary PEP", failures)
        require("all three response field groups are VIEW" in exposure, f"{route['routeContractKey']} action exposure lacks field guard", failures)
        require("no nonterminal separation case" in exposure, f"{route['routeContractKey']} action exposure lacks eligibility guard", failures)
    require(routes[2]["gatewayPurposeCode"] == "HR_LIFECYCLE", "ACTION gateway purpose drift", failures)
    require(routes[2]["ownerPurposeCode"] == "SEPARATION_CASE", "ACTION owner purpose drift", failures)
    require(routes[2]["stepUp"]["freshnessRequired"] is True, "fresh step-up is not required", failures)
    auth_seed = auth["authV270Reservation"]
    require(auth_seed["predecessor"]["path"].split("/")[-1].startswith("V269__"), "Auth predecessor drift", failures)
    require(auth_seed["candidatePath"].split("/")[-1].startswith("V270__"), "Auth candidate drift", failures)
    require(auth_seed["state"] == "RESERVED_NOT_ACTIVE", "Auth V270 reservation drift", failures)
    feature = auth_seed["feature"]
    require(feature["featureKey"] == "HRIS_HRM_EXIT_RETURN_WORKBENCH", "feature key drift", failures)
    require(feature["baselineState"] == "OFF", "feature baseline escaped OFF", failures)
    require(feature["globalActiveRows"] == 0, "global activation rows escaped", failures)
    require(feature["tenantEnrollmentRows"] == 0, "tenant enrollment rows escaped", failures)
    require(feature["routeOwnersAndBindings"] == EXPECTED_ROUTE_KEYS, "feature route binding drift", failures)

    forbidden_true_keys = {
        "moduleOwnerPacketAuthorized",
        "moduleSourceAuthoringAuthorized",
        "moduleWorktreeAuthorized",
        "moduleStartTokenAuthorized",
        "peopleV61ReservationAuthorized",
        "peopleV61LeaseActive",
        "peopleV61SqlAuthoringAuthorized",
        "internalCallbackServiceBindingAuthorized",
        "routeOrMenuMountAuthorized",
        "featureEnablementAuthorized",
        "tenantEnrollmentAuthorized",
        "productionBindingAuthorized",
        "productionReleaseAuthorized",
        "laterBatch06LaneAuthorized",
    }
    for key in forbidden_true_keys:
        require(auth["authority"].get(key) is False, f"forbidden authority escaped: {key}", failures)
    require(auth["authority"]["featureDefaultOff"] is True, "feature default-off declaration drift", failures)
    require(auth["authority"]["productAuthorizationV61Reserved"] is True, "product authorization v61 is not reserved", failures)
    require(auth["authority"]["authV270Reserved"] is True, "Auth V270 is not reserved", failures)
    require(auth["authority"]["globalActiveRows"] == 0, "authority global activation drift", failures)
    require(auth["authority"]["tenantEnrollmentRows"] == 0, "authority tenant enrollment drift", failures)

    result = {
        "schema": "dwp.hris.wave7.r7-batch-06-hrm013-semantic-closure-validation.v1",
        "status": "PASS" if not failures else "FAIL",
        "checks": {
            "documents": 4,
            "independentReviews": 1,
            "acceptedEvidencePins": len(semantic["authorityBasis"]["acceptedEvidence"]) + 2,
            "states": len(aggregate["states"]),
            "transitions": len(aggregate["transitions"]),
            "operations": len(operations),
            "acceptanceConditions": len(acceptance_ids),
            "eventPayloadFields": len(event["businessPayload"]["required"]),
            "v61NewTables": len(new_tables),
            "authorizationRoutes": len(routes),
            "featureDefault": feature["baselineState"],
            "tenantEnrollments": feature["tenantEnrollmentRows"],
            "peopleV61Lease": migration["migration"]["leaseState"],
        },
        "failures": failures,
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if not failures else 1


if __name__ == "__main__":
    sys.exit(main())
