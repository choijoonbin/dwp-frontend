#!/usr/bin/env python3
"""Independent operation route/persona taxonomy audit for modern HRIS v3.

This reviewer-owned program deliberately imports no author generator or
author validator.  The capability route families and the exceptional
operation decisions below are frozen from the existing DWP public route,
runtime-owner, authorization-persona and listening stream-authority
contracts.  Candidate JSON is only input evidence.
"""

from __future__ import annotations

import argparse
import collections
import datetime as dt
import hashlib
import json
from pathlib import Path
from typing import Any


HERE = Path(__file__).resolve().parent
READINESS = HERE.parent
SSOT = READINESS / "modern-capability-operation-causal-contract-ssot.v2.json"
DEFAULT_REPORT = HERE / "reports/modern-route-taxonomy-independent-latest.v1.json"

EXPECTED_OPERATION_COUNT = 199
EXPECTED_CAPABILITY_COUNTS = {
    "HRIS.MODERN.ADVANCED_WFM": 12,
    "HRIS.MODERN.BENEFITS_ADMIN": 16,
    "HRIS.MODERN.COMPENSATION_PLANNING": 12,
    "HRIS.MODERN.CONTINGENT_WORKFORCE": 9,
    "HRIS.MODERN.EMPLOYEE_LISTENING": 10,
    "HRIS.MODERN.GOVERNED_AI": 17,
    "HRIS.MODERN.GROWTH_PROFILE": 13,
    "HRIS.MODERN.HR_SERVICE_DELIVERY": 8,
    "HRIS.MODERN.INTERNAL_MARKETPLACE": 13,
    "HRIS.MODERN.LEARNING": 13,
    "HRIS.MODERN.ONBOARDING": 13,
    "HRIS.MODERN.PEOPLE_ANALYTICS": 14,
    "HRIS.MODERN.RECRUITING_ATS": 15,
    "HRIS.MODERN.SKILLS_ONTOLOGY": 13,
    "HRIS.MODERN.SUCCESSION": 12,
    "HRIS.MODERN.WORKFORCE_PLANNING": 9,
}

# These are reviewer-frozen route families, not values imported from a
# candidate manifest.  HRIS-SYS deliberately has separate end-user and admin
# control-plane families where the persona contract requires it.
AUTHORITATIVE_FAMILIES = {
    "HRIS.MODERN.SKILLS_ONTOLOGY": (
        "/api/people/v1/hris/performance/skills",
    ),
    "HRIS.MODERN.GROWTH_PROFILE": (
        "/api/people/v1/hris/performance/growth-profiles",
    ),
    "HRIS.MODERN.RECRUITING_ATS": (
        "/api/people/v1/hris/recruiting",
    ),
    "HRIS.MODERN.ONBOARDING": (
        "/api/people/v1/hris/onboarding",
    ),
    "HRIS.MODERN.LEARNING": (
        "/api/people/v1/hris/performance/learning",
    ),
    "HRIS.MODERN.INTERNAL_MARKETPLACE": (
        "/api/people/v1/hris/performance/opportunities",
    ),
    "HRIS.MODERN.SUCCESSION": (
        "/api/people/v1/hris/performance/succession",
    ),
    "HRIS.MODERN.WORKFORCE_PLANNING": (
        "/api/people/v1/hris/workforce-planning",
    ),
    "HRIS.MODERN.COMPENSATION_PLANNING": (
        "/api/people/v1/hris/performance/compensation-planning",
    ),
    "HRIS.MODERN.BENEFITS_ADMIN": (
        "/api/people/v1/hris/benefits",
    ),
    "HRIS.MODERN.HR_SERVICE_DELIVERY": (
        "/api/people/v1/hris/hr-services",
    ),
    "HRIS.MODERN.EMPLOYEE_LISTENING": (
        "/api/platform/v1/hris/listening",
        "/api/platform/v1/admin/hris/listening",
    ),
    "HRIS.MODERN.ADVANCED_WFM": (
        "/api/time/v1/workforce-management",
    ),
    "HRIS.MODERN.CONTINGENT_WORKFORCE": (
        "/api/people/v1/hris/contingent-workforce",
    ),
    "HRIS.MODERN.PEOPLE_ANALYTICS": (
        "/api/platform/v1/admin/hris/people-analytics",
    ),
    "HRIS.MODERN.GOVERNED_AI": (
        "/api/platform/v1/hris/ai-assistance",
        "/api/platform/v1/admin/hris/ai-governance",
    ),
}

# Exact in-family semantic corrections that cannot be discovered from a
# prefix alone.  They are based on one aggregate having one public noun and on
# explicit self/admin separation.  In particular, the listening revisions
# agree with the independent static stream-authority operation contract.
PATH_OVERRIDES = {
    "modern.benefits.lifeevent.decide":
        "/api/people/v1/hris/benefits/life-events/{lifeEventId}/decisions",
    "modern.benefits.plan.query":
        "/api/people/v1/hris/benefits/plans/{planId}",
    "modern.benefits.plans.query":
        "/api/people/v1/hris/benefits/plans",
    "modern.growth.evidence.unlink":
        "/api/people/v1/hris/performance/growth-profiles/{profileId}/evidence-links/{evidenceLinkId}/unlink",
    "modern.listening.cohorts.query":
        "/api/platform/v1/admin/hris/listening/surveys/{surveyId}/cohort-projections",
    "modern.listening.survey.revise":
        "/api/platform/v1/admin/hris/listening/surveys/{surveyId}",
    "modern.listening.surveys.query":
        "/api/platform/v1/admin/hris/listening/surveys",
    "modern.onboarding.assignment.query":
        "/api/people/v1/hris/onboarding/journey-assignments/{assignmentId}",
    "modern.onboarding.assignments.query":
        "/api/people/v1/hris/onboarding/journey-assignments",
    "modern.onboarding.task.waive":
        "/api/people/v1/hris/onboarding/journey-assignments/{assignmentId}/tasks/{taskId}/waive",
    "modern.recruiting.candidate.query":
        "/api/people/v1/hris/recruiting/candidate-cases/{candidateCaseId}",
    "modern.recruiting.candidates.query":
        "/api/people/v1/hris/recruiting/candidate-cases",
}

METHOD_OVERRIDES = {
    "modern.listening.survey.revise": "PATCH",
}

# Querying an administrative definition/receipt must use the same capability
# boundary as managing it.  Conversely an employee's own AI assistance result
# must not require the AI policy administrator role.
AUTH_OVERRIDES = {
    "modern.ai.assistance.query": "hcm.ai.assist.use",
    "modern.ai.assistances.query": "hcm.ai.assist.use",
    "modern.analytics.export.query": "hcm.analytics.export",
    "modern.analytics.exports.query": "hcm.analytics.export",
    "modern.benefits.plan.query": "hcm.benefits.operate",
    "modern.benefits.plans.query": "hcm.benefits.operate",
    "modern.listening.surveys.query": "hcm.listening.manage",
}

PERSONA_BY_AUTH = {
    "hcm.ai.assist.use": "END_USER_OR_DELEGATED_OPERATOR",
    "hcm.ai.kill-switch.execute": "SETTINGS_ADMIN",
    "hcm.ai.policy.manage": "SETTINGS_ADMIN",
    "hcm.analytics.export": "OPERATIONS",
    "hcm.analytics.metric.manage": "SETTINGS_ADMIN",
    "hcm.analytics.metric.view": "MANAGER_OR_OPERATIONS_OR_AUDIT",
    "hcm.benefits.operate": "OPERATIONS",
    "hcm.benefits.self.enroll": "EMPLOYEE_SELF",
    "hcm.benefits.self.view": "EMPLOYEE_SELF",
    "hcm.listening.cohort.view": "OPERATIONS_OR_AUDIT",
    "hcm.listening.manage": "SETTINGS_ADMIN",
    "hcm.listening.respond": "EMPLOYEE_SELF",
}


def strict_load(path: Path) -> dict[str, Any]:
    def pairs(values: list[tuple[str, Any]]) -> dict[str, Any]:
        out: dict[str, Any] = {}
        for key, value in values:
            if key in out:
                raise ValueError(f"duplicate JSON key {key!r} in {path}")
            out[key] = value
        return out

    return json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=pairs)


def in_family(path: str, families: tuple[str, ...]) -> bool:
    return any(path == root or path.startswith(root + "/") for root in families)


def proposed_path(operation_id: str, current: str) -> str:
    if operation_id in PATH_OVERRIDES:
        return PATH_OVERRIDES[operation_id]

    value = current
    if value.startswith("/api/performance/v1/hris/"):
        value = value.replace(
            "/api/performance/v1/hris/",
            "/api/people/v1/hris/performance/",
            1,
        )
        value = value.replace(
            "/performance/compensation/",
            "/performance/compensation-planning/",
            1,
        )
        value = value.replace(
            "/performance/growth/profiles/",
            "/performance/growth-profiles/",
            1,
        )
        if value.endswith("/performance/growth/profiles"):
            value = value.replace(
                "/performance/growth/profiles",
                "/performance/growth-profiles",
                1,
            )
        value = value.replace(
            "/performance/growth/exports",
            "/performance/growth-profiles/exports",
            1,
        )
        value = value.replace(
            "/performance/opportunity-applications",
            "/performance/opportunities/applications",
            1,
        )

    value = value.replace(
        "/api/people/v1/hris/hr-service/",
        "/api/people/v1/hris/hr-services/",
        1,
    )
    value = value.replace(
        "/api/people/v1/hris/contingent/",
        "/api/people/v1/hris/contingent-workforce/",
        1,
    )

    value = value.replace(
        "/api/time/v1/hris/wfm/forecasts/",
        "/api/time/v1/workforce-management/demand-forecasts/",
        1,
    )
    value = value.replace(
        "/api/time/v1/hris/wfm/optimizations/",
        "/api/time/v1/workforce-management/schedule-optimizations/",
        1,
    )
    value = value.replace(
        "/api/time/v1/hris/wfm/schedule-candidates",
        "/api/time/v1/workforce-management/schedule-candidates",
        1,
    )

    value = value.replace(
        "/api/platform/v1/hris/analytics/",
        "/api/platform/v1/admin/hris/people-analytics/",
        1,
    )
    value = value.replace(
        "/api/platform/v1/hris/ai/assistances",
        "/api/platform/v1/hris/ai-assistance",
        1,
    )
    value = value.replace(
        "/api/platform/v1/hris/ai/evaluations",
        "/api/platform/v1/admin/hris/ai-governance/evaluations",
        1,
    )
    value = value.replace(
        "/api/platform/v1/hris/ai/policies",
        "/api/platform/v1/admin/hris/ai-governance/policies",
        1,
    )
    return value


def rationale(operation_id: str, current_path: str, current_auth: str) -> list[str]:
    reasons: list[str] = []
    if current_path.startswith("/api/performance/v1/hris/"):
        reasons.append("WRONG_RUNTIME_PUBLIC_PREFIX_DWP_PEOPLE_OWNER")
    if "/hr-service/" in current_path or "/contingent/" in current_path:
        reasons.append("SINGULAR_OR_ABBREVIATED_ALIAS_SPLITS_ONE_AGGREGATE")
    if current_path.startswith("/api/time/v1/hris/wfm/"):
        reasons.append("ABBREVIATED_WFM_ALIAS_OUTSIDE_TIME_PUBLIC_CONTRACT")
    if current_path.startswith("/api/platform/v1/hris/analytics/"):
        reasons.append("ADMIN_ANALYTICS_AGGREGATE_EXPOSED_THROUGH_USER_ALIAS")
    if current_path.startswith("/api/platform/v1/hris/ai/"):
        reasons.append("AI_PERSONAL_OR_ADMIN_RESOURCE_EXPOSED_THROUGH_THIRD_ALIAS")
    if operation_id.startswith("modern.onboarding.assignment") or operation_id == "modern.onboarding.task.waive":
        reasons.append("JOURNEY_ASSIGNMENT_AGGREGATE_NOUN_DRIFT")
    if operation_id.startswith("modern.recruiting.candidate") and operation_id.endswith("query"):
        reasons.append("CANDIDATE_CASE_AGGREGATE_NOUN_DRIFT")
    if operation_id in {"modern.benefits.plan.query", "modern.benefits.plans.query"}:
        reasons.append("ADMIN_PLAN_QUERY_MUST_REENTER_PLAN_AGGREGATE_AND_OPERATIONS_PEP")
    if operation_id == "modern.benefits.lifeevent.decide":
        reasons.append("DECISION_LEDGER_COLLECTION_NOUN_MUST_BE_PLURAL")
    if operation_id == "modern.growth.evidence.unlink":
        reasons.append("EVIDENCE_LINK_ID_MUST_ADDRESS_EVIDENCE_LINK_RESOURCE")
    if operation_id == "modern.listening.surveys.query":
        reasons.append("CONFIGURATION_INVENTORY_QUERY_MUST_USE_ADMIN_MANAGE_BOUNDARY")
    if operation_id == "modern.listening.survey.revise":
        reasons.append("STATIC_STREAM_AUTHORITY_REQUIRES_ADMIN_PATCH_DRAFT_CAS")
    if operation_id == "modern.listening.cohorts.query":
        reasons.append("SUCCESSOR_IS_PRIVACY_SAFE_COHORT_PROJECTION_NOT_RETIRED_RESULT_MATERIALIZATION")
    if operation_id in {"modern.ai.assistance.query", "modern.ai.assistances.query"}:
        reasons.append("SELF_ASSISTANCE_QUERY_MUST_NOT_REQUIRE_POLICY_ADMIN")
    if operation_id in {"modern.analytics.export.query", "modern.analytics.exports.query"}:
        reasons.append("EXPORT_RECEIPT_QUERY_REQUIRES_EXPORT_PURPOSE_NOT_GENERIC_METRIC_VIEW")
    if not reasons and current_auth in AUTH_OVERRIDES:
        reasons.append("AUTHORIZATION_PERSONA_DRIFT")
    return reasons


def audit(path: Path) -> dict[str, Any]:
    document = strict_load(path)
    operations = document.get("operations", [])
    ids = [row.get("operationId") for row in operations]
    duplicate_ids = sorted(k for k, v in collections.Counter(ids).items() if v > 1)
    capability_counts = collections.Counter(row.get("capabilityId") for row in operations)
    inventory_errors: list[dict[str, Any]] = []
    if len(operations) != EXPECTED_OPERATION_COUNT:
        inventory_errors.append({
            "code": "ROUTE-INV-COUNT",
            "expected": EXPECTED_OPERATION_COUNT,
            "actual": len(operations),
        })
    if duplicate_ids:
        inventory_errors.append({"code": "ROUTE-INV-DUPLICATE-ID", "ids": duplicate_ids})
    if dict(sorted(capability_counts.items())) != EXPECTED_CAPABILITY_COUNTS:
        inventory_errors.append({
            "code": "ROUTE-INV-CAPABILITY-COUNT",
            "expected": EXPECTED_CAPABILITY_COUNTS,
            "actual": dict(sorted(capability_counts.items())),
        })

    decisions: list[dict[str, Any]] = []
    route_keys: dict[tuple[str, str], list[str]] = collections.defaultdict(list)
    for row in sorted(operations, key=lambda item: item["operationId"]):
        operation_id = row["operationId"]
        capability = row["capabilityId"]
        current_path = row["path"]
        current_method = row["method"]
        current_auth = row["authorizationCapability"]
        expected_path = proposed_path(operation_id, current_path)
        expected_method = METHOD_OVERRIDES.get(operation_id, current_method)
        expected_auth = AUTH_OVERRIDES.get(operation_id, current_auth)
        current_outside = not in_family(current_path, AUTHORITATIVE_FAMILIES[capability])
        proposed_outside = not in_family(expected_path, AUTHORITATIVE_FAMILIES[capability])
        changed = (
            current_path != expected_path
            or current_method != expected_method
            or current_auth != expected_auth
        )
        reasons = rationale(operation_id, current_path, current_auth)
        if current_outside:
            reasons.insert(0, "OUTSIDE_FROZEN_CAPABILITY_ROUTE_FAMILY")
        if changed and not reasons:
            reasons.append("ONE_AGGREGATE_ONE_PUBLIC_ROUTE_NORMALIZATION")
        classification = "KEEP_INTENTIONAL_BOUNDARY"
        if changed:
            classification = (
                "P0_NORMALIZE_OUT_OF_FAMILY"
                if current_outside else "P0_NORMALIZE_IN_FAMILY_SEMANTICS"
            )
        if proposed_outside:
            classification = "P0_PROPOSAL_OUTSIDE_AUTHORITY"
        route_keys[(expected_method, expected_path)].append(operation_id)
        decisions.append({
            "operationId": operation_id,
            "capabilityId": capability,
            "mode": row["mode"],
            "current": {
                "method": current_method,
                "path": current_path,
                "authorizationCapability": current_auth,
                "persona": PERSONA_BY_AUTH.get(current_auth, "CAPABILITY_REGISTER_DEFINED"),
                "insideAuthoritativeFamily": not current_outside,
            },
            "proposed": {
                "method": expected_method,
                "path": expected_path,
                "authorizationCapability": expected_auth,
                "persona": PERSONA_BY_AUTH.get(expected_auth, "CAPABILITY_REGISTER_DEFINED"),
                "insideAuthoritativeFamily": not proposed_outside,
            },
            "classification": classification,
            "reasons": reasons,
        })

    collisions = [
        {"method": method, "path": route, "operationIds": sorted(op_ids)}
        for (method, route), op_ids in sorted(route_keys.items())
        if len(op_ids) > 1
    ]
    changed = [row for row in decisions if row["classification"].startswith("P0_")]
    outside = [row for row in decisions if not row["current"]["insideAuthoritativeFamily"]]
    auth_changes = [
        row for row in decisions
        if row["current"]["authorizationCapability"]
        != row["proposed"]["authorizationCapability"]
    ]
    method_changes = [
        row for row in decisions
        if row["current"]["method"] != row["proposed"]["method"]
    ]
    proposal_outside = [
        row for row in decisions if not row["proposed"]["insideAuthoritativeFamily"]
    ]

    findings = []
    findings.extend(inventory_errors)
    findings.extend({
        "code": "ROUTE-P0-NORMALIZATION",
        "operationId": row["operationId"],
        "classification": row["classification"],
        "current": row["current"],
        "proposed": row["proposed"],
        "reasons": row["reasons"],
    } for row in changed)
    findings.extend({"code": "ROUTE-P0-PROPOSED-COLLISION", **row} for row in collisions)
    findings.extend({
        "code": "ROUTE-P0-PROPOSAL-OUTSIDE-AUTHORITY",
        "operationId": row["operationId"],
        "path": row["proposed"]["path"],
    } for row in proposal_outside)

    return {
        "reportId": "dwp.hris.modern.route-taxonomy.independent.v1",
        "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
        "status": "FAIL" if findings else "PASS",
        "candidate": {
            "path": str(path),
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            "treatedAs": "UNTRUSTED_AUTHOR_CANDIDATE",
        },
        "reviewBasis": {
            "targetRuntime": {
                "HRIS-HRM": "dwp-people-server",
                "HRIS-PER": "dwp-people-server/hris/performance",
                "HRIS-TIM": "dwp-time-server",
                "HRIS-SYS": "dwp-platform-server",
            },
            "routeFamilies": AUTHORITATIVE_FAMILIES,
            "boundaryDecisions": [
                "LISTENING_RESPOND_IS_USER; LISTENING_MANAGE_AND_COHORT_ARE_ADMIN",
                "AI_ASSISTANCE_IS_USER_OR_DELEGATED_OPERATOR; AI_POLICY_EVALUATION_AND_KILL_SWITCH_ARE_ADMIN",
                "PEOPLE_ANALYTICS_CURRENT_CONTROL_PLANE_IS_ADMIN; FUTURE_END_USER_DASHBOARDS_REQUIRE_NEW_READ_ONLY_OPERATION_IDS",
                "PEOPLE_AND_TIME_SERVER_ROUTES_USE_OWNER_AUTHORIZATION_PEP_WITHOUT_PARALLEL_ALIAS_ROOTS",
            ],
            "authorGeneratorImported": False,
            "authorValidatorImported": False,
        },
        "summary": {
            "operations": len(decisions),
            "outOfAuthoritativeFamily": len(outside),
            "normalizationRequired": len(changed),
            "inFamilySemanticNormalization": len(changed) - len(outside),
            "authorizationCorrections": len(auth_changes),
            "methodCorrections": len(method_changes),
            "proposedRouteCollisions": len(collisions),
            "proposedOutsideAuthority": len(proposal_outside),
            "findingCount": len(findings),
        },
        "outOfFamilyByCapability": dict(sorted(collections.Counter(
            row["capabilityId"] for row in outside
        ).items())),
        "normalizationByCapability": dict(sorted(collections.Counter(
            row["capabilityId"] for row in changed
        ).items())),
        "authorizationCorrections": [{
            "operationId": row["operationId"],
            "current": row["current"]["authorizationCapability"],
            "proposed": row["proposed"]["authorizationCapability"],
            "currentPersona": row["current"]["persona"],
            "proposedPersona": row["proposed"]["persona"],
        } for row in auth_changes],
        "methodCorrections": [{
            "operationId": row["operationId"],
            "current": row["current"]["method"],
            "proposed": row["proposed"]["method"],
        } for row in method_changes],
        "operationDecisions": decisions,
        "findings": findings,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--ssot", type=Path, default=SSOT)
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    args = parser.parse_args()
    report = audit(args.ssot)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(
        json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(json.dumps({"status": report["status"], **report["summary"]}, sort_keys=True))
    return 1 if report["status"] != "PASS" else 0


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
