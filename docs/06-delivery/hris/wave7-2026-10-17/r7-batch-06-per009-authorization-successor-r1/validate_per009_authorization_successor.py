#!/usr/bin/env python3
"""Validate the sealed PER-009 transport and central-authorization successor."""

from __future__ import annotations

import csv
import hashlib
import json
import pathlib
import re
import subprocess
import sys
from typing import Any


FRONTEND = pathlib.Path(__file__).resolve().parents[5]
WORKSPACE = FRONTEND.parent
BACKEND = WORKSPACE / "dwp-backend"
AGENT = WORKSPACE / "dwp_agent"
REPOSITORIES = {
    "dwp-frontend": FRONTEND,
    "dwp-backend": BACKEND,
    "dwp_agent": AGENT,
}
CARRIER_DIR = pathlib.Path(__file__).resolve().parent
SUCCESSOR_PATH = CARRIER_DIR / "per-009-transport-and-central-authorization-successor.v1.json"
REVIEW_PATH = CARRIER_DIR / "independent-review.v1.json"
PEP_REGISTER_PATH = (
    FRONTEND
    / "docs/06-delivery/hris/recovery/hris-porting-blueprint-2026-09-09/coding-readiness/api-pep-binding-register.csv"
)
BACKEND_BUNDLE_V62 = BACKEND / "contracts/product-authorization/product-surfaces-v1.bundle-v62.json"
PEOPLE_PROJECTION_V62 = (
    BACKEND
    / "dwp-people-server/src/main/resources/product-authorization/hcm-people-pep-v62.generated.json"
)
FRONTEND_MIRROR = FRONTEND / "architecture/product-surface-authorization.v1.json"

EXPECTED_BASELINES = {
    "frontendBaseline": {
        "repository": "dwp-frontend",
        "branch": "dwp-dev",
        "commit": "f5eaa06792a4949993f6cb8bd36474ceaf1d1830",
        "tree": "7ebe8f711396b5b1189dc079e2bffc75e23b2494",
    },
    "backendBaseline": {
        "repository": "dwp-backend",
        "branch": "dwp-dev",
        "commit": "699ef730f21a89200be6dfed6d2e34148014cd10",
        "tree": "3ea7866294cfd3bcb2ee950ff8b882f56f6f1317",
    },
    "agentBaseline": {
        "repository": "dwp_agent",
        "branch": "dwp-dev",
        "commit": "9beb5439cad065e7d919a98c9f9becb44481508a",
        "tree": "fe3880719360f4bdeff88bbbac1edc6f8affed88",
    },
}

EXPECTED_SEMANTIC_PINS = [
    {
        "repository": "dwp-frontend",
        "path": "docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-per009-semantic-closure-r1/semantic-dispositions/base-tfr-per-009.semantic-disposition.v1.json",
        "bytes": 30584,
        "sha256": "e41424fc75211adbd6558bfc7a379949fe182a40684c1f71450a97d6bea0d8e9",
    },
    {
        "repository": "dwp-frontend",
        "path": "docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-per009-semantic-closure-r1/independent-review.v1.json",
        "bytes": 8962,
        "sha256": "2d239b82be733104c89f6dea65d290ac6ab5a7399c75feb1a5f9602b3291b0a0",
    },
    {
        "repository": "dwp-frontend",
        "path": "docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-per009-semantic-closure-r1/validate_per009_semantic_disposition.py",
        "bytes": 21621,
        "sha256": "625722944a4e7b29eed1b71b59e75380e56d8f9be127e484666a0045a6fbc562",
    },
]

EXPECTED_EVIDENCE_PINS = [
    {
        "repository": "dwp-frontend",
        "path": "docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-preflight-r1/semantic-dependency-migration-preflight.v1.json",
        "bytes": 58498,
        "sha256": "33d95637c2887bfae43b2369370662c3a0d06d8e0420df05c868299da2b752dd",
    },
    {
        "repository": "dwp-frontend",
        "path": "docs/06-delivery/hris/wave7-2026-10-17/execution-roadmap-successor.v20.json",
        "bytes": 20200,
        "sha256": "c0bb60884e5d99758296ea6f4024bfc4bf557352bbffedf8aa9d8d0f19bacba1",
    },
    {
        "repository": "dwp-frontend",
        "path": "docs/06-delivery/hris/recovery/hris-porting-blueprint-2026-09-09/coding-readiness/api-pep-binding-register.csv",
        "bytes": 126576,
        "sha256": "0e38d724516a8b271069241ffa0fb6400984dc703758767de53cbaffb4f93da3",
    },
    {
        "repository": "dwp-backend",
        "path": "contracts/product-authorization/product-surfaces-v1.yaml",
        "bytes": 2617399,
        "sha256": "44ba64c17fb8d8bd389870172a92618f2350e6edff44c43f200563d569d84f71",
    },
    {
        "repository": "dwp-backend",
        "path": "contracts/product-authorization/product-surfaces-v1.bundle-v62.json",
        "bytes": 2769238,
        "sha256": "a9b38f542031866dd226d7296c643e9e934152ce7c801d5b618ae2fb97b0e8a5",
    },
    {
        "repository": "dwp-backend",
        "path": "scripts/generate-product-authorization-contracts.py",
        "bytes": 278969,
        "sha256": "f90c15d27f4cfc87ac8f76d2ef7ea46a1d09dd409ad3f9424fd9b19588054347",
    },
    {
        "repository": "dwp-backend",
        "path": "scripts/generate-product-authorization-fixtures.py",
        "bytes": 73973,
        "sha256": "82ee6d5f0a57852b728811254b86f5ba2d462bc20bf0f4b265ddfcfb3577d31f",
    },
    {
        "repository": "dwp-backend",
        "path": "scripts/tests/test_product_authorization_v62.py",
        "bytes": 9528,
        "sha256": "57d62962ae136dd8cd8dacfc6395b3d33ee8048eb95a9717f82537c3c40202cb",
    },
    {
        "repository": "dwp-backend",
        "path": "dwp-auth-server/src/main/resources/product-authorization/product-surfaces-v1.bundle-v62.generated.json",
        "bytes": 2769238,
        "sha256": "a9b38f542031866dd226d7296c643e9e934152ce7c801d5b618ae2fb97b0e8a5",
    },
    {
        "repository": "dwp-backend",
        "path": "dwp-people-server/src/main/resources/product-authorization/hcm-people-pep-v62.generated.json",
        "bytes": 397350,
        "sha256": "f2dd15d542194b065595fe7c507f6eff4624d6390c4d6c3519c02d1921f2fcf4",
    },
    {
        "repository": "dwp-backend",
        "path": "dwp-auth-server/src/main/resources/db/migration/V272__hrm013_identity_task_dispatch_inbox.sql",
        "bytes": 65449,
        "sha256": "6e9d1e25b99e98b7008dc2e1a6757a4fde1f91a0bcd3293e784fc12e35c753cb",
    },
]

V62_CHECKSUM = "cb370fd02a896452a64187fca8afb8bb3e3d281e490fba02e76f7a3c0d7f9770"
V61_CHECKSUM = "f7cf92a97f2fabf86f257010064a3183acf58f86cc2c9d7692a1555cab55aa24"
EXPECTED_V62_COUNTS = {
    "capabilities": 280,
    "accessPolicies": 24,
    "entitlementExpressions": 17,
    "predicatePolicies": 87,
    "routes": 1158,
    "PAGE": 162,
    "DATA": 349,
    "ACTION": 647,
}
EXPECTED_PEOPLE_V62_COUNTS = {
    "capabilities": 65,
    "accessPolicies": 5,
    "entitlementExpressions": 3,
    "predicatePolicies": 23,
    "routes": 136,
    "bindings": 163,
    "PAGE": 47,
    "DATA": 35,
    "ACTION": 54,
}
EXPECTED_V61_COUNTS = {
    "capabilities": 279,
    "accessPolicies": 24,
    "entitlementExpressions": 17,
    "predicatePolicies": 87,
    "routes": 1157,
    "PAGE": 162,
    "DATA": 349,
    "ACTION": 646,
}

EXPECTED_TRANSPORTS = [
    {
        "contractId": "PEP-PER-010",
        "operationId": "createGoal",
        "actionKey": "hris.action.per.create-goal",
        "method": "POST",
        "browserPath": "/api/people/v1/hris/performance/goals",
        "ownerPath": "/v1/hris/performance/goals",
        "ownerService": "dwp-people-server",
        "requiredHeaders": ["Idempotency-Key", "If-Match"],
        "ifMatchContract": 'Strong literal "0" absent-version CAS; missing, weak or nonzero values fail closed.',
        "closedRequestFields": [
            "cycleVersionId",
            "ownerType",
            "ownerPublicId",
            "title",
            "measurement",
            "weight",
            "periodStart",
            "periodEnd",
        ],
        "successStatus": 201,
        "successBodyClosedSet": ["goalId", "goalState", "revisionNo", "aggregateVersion"],
        "successHeaders": [
            "ETag",
            "X-DWP-Command-Receipt-Id",
            "X-Correlation-Id",
            "Cache-Control: private, no-store",
        ],
        "implementationAuthorizedNow": False,
    },
    {
        "contractId": "PEP-PER-011",
        "operationId": "submitGoal",
        "actionKey": "hris.action.per.submit-goal",
        "method": "POST",
        "browserPath": "/api/people/v1/hris/performance/goals/{goalId}/submit",
        "ownerPath": "/v1/hris/performance/goals/{goalId}/submit",
        "ownerService": "dwp-people-server",
        "requiredHeaders": ["Idempotency-Key", "If-Match"],
        "ifMatchContract": "Strong current aggregateVersion ETag; missing, weak or stale values fail closed.",
        "closedRequestFields": [],
        "successStatus": 200,
        "successBodyClosedSet": ["goalId", "goalState", "revisionNo", "aggregateVersion"],
        "successHeaders": [
            "ETag",
            "X-DWP-Command-Receipt-Id",
            "X-Correlation-Id",
            "Cache-Control: private, no-store",
        ],
        "implementationAuthorizedNow": False,
    },
]

EXPECTED_CAPABILITY_DECISION = {
    "newSelfCapability": {
        "contractKey": "per.goal.self.write",
        "productKey": "hcm",
        "surfaceKey": "hcm.personal",
        "resolvedCapabilityCode": "DATA.HRIS_PERFORMANCE_GOAL:UPDATE",
        "resourceKey": "DATA.HRIS_PERFORMANCE_GOAL",
        "action": "UPDATE",
        "mappingVersion": 1,
        "requiresProductEntitlement": True,
        "canonicalAppEntitlement": "APP.HCM:VIEW",
        "authorityMode": "PERMISSION_AND_RELATIONSHIP",
        "scopeResolver": "SELF",
        "riskTier": "MEDIUM",
        "activationPolicy": None,
        "responsibilityRequirement": "NOT_REQUIRED",
        "sodPolicyId": None,
        "legacySource": None,
        "sunsetAt": None,
        "owner": "People + HCM + Security",
        "policyVersion": 1,
        "lifecycleState": "ACTIVE",
        "routeContractKeys": [
            "route.hcm.performance.goal-create.action",
            "route.hcm.performance.goal-submit.action",
        ],
    },
    "reusedManagerCapability": {
        "contractKey": "hcm.team.performance.review",
        "existingResolvedCapabilityCode": "DATA.HRIS_PERFORMANCE_REVIEW:UPDATE",
        "existingResourceKey": "DATA.HRIS_PERFORMANCE_REVIEW",
        "existingAction": "UPDATE",
        "existingAuthorityMode": "PERMISSION_AND_RELATIONSHIP",
        "existingScopeResolver": "ASSIGNED_REVIEW_POPULATION",
        "existingRiskTier": "HIGH",
        "existingRequiresProductEntitlement": True,
        "existingActivationPolicy": None,
        "existingResponsibilityRequirement": "NOT_REQUIRED",
        "existingSodPolicyId": "NO_REVIEW_OUTSIDE_ASSIGNMENT",
        "requiredOwnerProfile": "HRIS_LINE_MANAGER",
        "requiredOwnerDuty": "HRIS_DUTY_MANAGER_PERFORMANCE_REVIEWER",
        "appendOnlyRouteContractKeys": [
            "route.hcm.performance.goal-create.action",
            "route.hcm.performance.goal-submit.action",
        ],
        "semanticMutationForbidden": True,
    },
    "separationRule": "Self and manager branches share routes but never union authority. When ownerPublicId equals the authenticated workerPublicId, only SELF may be evaluated. MANAGER requires ownerPublicId different from the authenticated workerPublicId plus a current assigned-manager population binding. If both branches appear valid, neither is complete, or branch selection is ambiguous, deny before effect; partial success across branches is forbidden.",
}

EXPECTED_PREDICATE_DECISION = {
    "predicatePolicyKey": "predicate.hcm-performance-goal-command.v1",
    "inputEvidenceSchemaKey": "PerformanceGoalCommandAuthorityEvidenceV1",
    "parameterSchemaKey": "predicate.hcm-performance-goal-command.v1.parameters.v1",
    "parameterSchema": {"type": "object", "properties": {}, "additionalProperties": False},
    "owner": "People + HCM + Security",
    "ownerServiceKey": "people",
    "policyVersion": 1,
    "lifecycleState": "ACTIVE",
    "targetBindingKinds": ["SELF", "OBJECT", "TARGET_POPULATION"],
    "routeContractKeys": [
        "route.hcm.performance.goal-create.action",
        "route.hcm.performance.goal-submit.action",
    ],
    "rule": "Resolve tenant and actor only from trusted context. SELF requires ownerType WORKER and ownerPublicId equal the authenticated worker. MANAGER requires a current assigned-manager population binding for the exact owner and cycle. Bind Goal or proposed Goal owner, cycleVersionId, PERFORMANCE_GOAL or PERFORMANCE_ASSIGNED field decisions and PERFORMANCE_GOAL purpose before effect. Unknown, stale, mixed-tenant, caller-supplied population, missing field decision or missing purpose denies without existence disclosure.",
    "callerTenantAccepted": False,
    "callerPopulationAccepted": False,
    "crossTenantResult": 404,
    "implementationAuthorizedNow": False,
}

PEP_LAYERS = [
    "GATEWAY_APP_ENTITLEMENT",
    "OWNER_API_OPERATION",
    "RESOURCE_POPULATION",
    "REPOSITORY_TENANT_PREDICATE",
    "FIELD_PROJECTION",
    "PURPOSE_POLICY",
    "AUDIT_DECISION",
]


def expected_branch(contract_id: str, branch: str) -> dict[str, Any]:
    submit = contract_id == "PEP-PER-011"
    if branch == "SELF":
        return {
            "contractId": contract_id,
            "branch": "SELF",
            "profile": "HRIS_EMPLOYEE",
            "duty": "HRIS_DUTY_SELF_GOAL_AUTHOR",
            "sourceAuthorizationAlias": "per.goal.self.write",
            "appEntitlement": "APP.HCM:VIEW",
            "capability": "per.goal.self.write",
            "resourceTypes": ["DATA"],
            "resourceKeys": ["DATA.HRIS_PERFORMANCE_GOAL"],
            "actions": ["UPDATE"],
            "populationTypes": ["SELF"],
            "fieldGroups": ["PERFORMANCE_GOAL"],
            "purposeCode": "PERFORMANCE_GOAL",
            "pepLayers": PEP_LAYERS,
            "targetBindingKinds": ["SELF", "OBJECT"],
            "predicatePolicyKeys": [
                "predicate.self-person.v1",
                "predicate.hcm-performance-goal-command.v1",
            ],
            "allowedOwnerTypes": ["WORKER"],
            "ownerBinding": (
                "loaded Goal ownerPublicId equals authenticated workerPublicId"
                if submit
                else "ownerPublicId equals authenticated workerPublicId"
            ),
            "effectAuthorizedByThisSuccessor": False,
        }
    return {
        "contractId": contract_id,
        "branch": "MANAGER",
        "profile": "HRIS_LINE_MANAGER",
        "duty": "HRIS_DUTY_MANAGER_PERFORMANCE_REVIEWER",
        "sourceAuthorizationAlias": "per.goal.team.approve",
        "appEntitlement": "APP.HCM:VIEW",
        "capability": "hcm.team.performance.review",
        "resourceTypes": ["DATA"],
        "resourceKeys": ["DATA.HRIS_PERFORMANCE_REVIEW"],
        "actions": ["UPDATE"],
        "populationTypes": ["ASSIGNED_REVIEW_POPULATION"],
        "fieldGroups": ["PERFORMANCE_ASSIGNED", "PERFORMANCE_GOAL"],
        "purposeCode": "PERFORMANCE_GOAL",
        "pepLayers": PEP_LAYERS,
        "targetBindingKinds": ["OBJECT", "TARGET_POPULATION"],
        "predicatePolicyKeys": [
            "predicate.team-target-population.v1",
            "predicate.hcm-performance-goal-command.v1",
        ],
        "allowedOwnerTypes": ["WORKER", "ORGANIZATION", "TEAM"],
        "ownerBinding": (
            "loaded Goal ownerPublicId differs from authenticated workerPublicId and the owner and cycle are inside the current assigned-manager population"
            if submit
            else "ownerPublicId differs from authenticated workerPublicId and the exact owner and cycle are inside the current assigned-manager population"
        ),
        "effectAuthorizedByThisSuccessor": False,
    }


EXPECTED_BRANCHES = [
    expected_branch("PEP-PER-010", "SELF"),
    expected_branch("PEP-PER-010", "MANAGER"),
    expected_branch("PEP-PER-011", "SELF"),
    expected_branch("PEP-PER-011", "MANAGER"),
]


def expected_route(contract_id: str) -> dict[str, Any]:
    create = contract_id == "PEP-PER-010"
    stem = "goal-create" if create else "goal-submit"
    route_key = f"route.hcm.performance.{stem}.action"
    browser_path = (
        "/api/people/v1/hris/performance/goals"
        if create
        else "/api/people/v1/hris/performance/goals/{goalId}/submit"
    )
    owner_path = (
        "/v1/hris/performance/goals"
        if create
        else "/v1/hris/performance/goals/{goalId}/submit"
    )
    binding_key = f"{route_key}.binding.01"
    return {
        "routeContractKey": route_key,
        "routeKind": "ACTION",
        "navigationContextId": "hcm.operations",
        "subject": {"type": "PRODUCT", "productKey": "hcm", "surfaceKey": "hcm.operations"},
        "uiRouteId": None,
        "uiRoutePattern": None,
        "sideEffectFree": None,
        "gatewayBinding": {
            "bindingKey": binding_key,
            "method": "POST",
            "path": browser_path,
            "pathParameterConstraints": {},
        },
        "servicePepBinding": {
            "bindingKey": binding_key,
            "method": "POST",
            "path": owner_path,
            "pathParameterConstraints": {},
            "serviceKey": "people",
        },
        "profiles": [
            {
                "profileKey": "manager-goal-author",
                "precedence": 300,
                "activeAccessModes": ["NORMAL", "ELEVATED"],
                "requiredCapability": "hcm.team.performance.review",
                "targetBindingKinds": ["OBJECT", "TARGET_POPULATION"],
                "predicatePolicyKeys": [
                    "predicate.team-target-population.v1",
                    "predicate.hcm-performance-goal-command.v1",
                ],
                "readOnly": False,
            },
            {
                "profileKey": "self-goal-author",
                "precedence": 200,
                "activeAccessModes": ["NORMAL", "ELEVATED"],
                "requiredCapability": "per.goal.self.write",
                "targetBindingKinds": ["SELF", "OBJECT"],
                "predicatePolicyKeys": [
                    "predicate.self-person.v1",
                    "predicate.hcm-performance-goal-command.v1",
                ],
                "readOnly": False,
            },
        ],
        "owner": "People + HCM + Security",
        "policyVersion": 1,
        "lifecycleState": "ACTIVE",
        "implementationAuthorizedNow": False,
    }


EXPECTED_ROUTES = [expected_route("PEP-PER-010"), expected_route("PEP-PER-011")]

EXPECTED_DEFAULT_OFF = {
    "featureKey": "HRIS_PER_GOAL_COMMANDS",
    "baselineState": "OFF",
    "globalActiveRows": 0,
    "tenantEnrollmentRows": 0,
    "routeMounts": 0,
    "menuEntries": 0,
    "providerActivations": 0,
    "defaultOffNetworkCalls": 0,
    "automaticImportEnabled": False,
    "bundleApprovalAuthorized": False,
    "bundleActivationAuthorized": False,
    "featureActivationAuthorized": False,
    "tenantEnrollmentAuthorized": False,
}

EXPECTED_ALLOWLIST = {
    "backendCanonical": [
        "contracts/product-authorization/product-surfaces-v1.yaml",
        "scripts/generate-product-authorization-contracts.py",
        "scripts/generate-product-authorization-fixtures.py",
        "scripts/tests/test_product_authorization_v62.py",
        "scripts/tests/test_product_authorization_v63.py",
        "dwp-auth-server/src/main/java/com/dwp/services/auth/service/ProductAuthorizationReleaseLineage.java",
        "dwp-auth-server/src/main/java/com/dwp/services/auth/service/ProductAuthorizationGateTopologyValidator.java",
        "dwp-gateway/src/main/java/com/dwp/gateway/filter/ProductSurfaceRoutePolicies.java",
        "dwp-auth-server/src/main/resources/db/migration/V273__declare_hris_per009_v63_authorization_seed.sql",
    ],
    "backendGenerated": [
        "contracts/product-authorization/product-surfaces-v1.bundle-v63.json",
        "contracts/product-authorization/product-surfaces-v1.json",
        "contracts/product-authorization/product-surfaces-v1.index.json",
        "contracts/product-authorization/pilot-fixtures.v1.generated.json",
        "dwp-auth-server/src/main/resources/product-authorization/product-surfaces-v1.bundle-v63.generated.json",
        "dwp-auth-server/src/main/resources/product-authorization/product-surfaces-v1.generated.json",
        "dwp-auth-server/src/main/resources/product-authorization/product-surfaces-v1.index.generated.json",
        "dwp-people-server/src/main/resources/product-authorization/hcm-people-pep-v63.generated.json",
        "dwp-time-server/src/main/resources/product-authorization/hcm-time-pep-v63.generated.json",
        "dwp-platform-server/src/main/resources/product-authorization/hcm-platform-pep-v63.generated.json",
        "dwp-payroll-server/src/main/resources/product-authorization/hcm-payroll-pep-v63.generated.json",
    ],
    "backendTargetedTests": [
        "dwp-auth-server/src/test/java/com/dwp/services/auth/service/ProductAuthorizationV63ContractTest.java",
        "dwp-auth-server/src/test/java/com/dwp/services/auth/service/ProductAuthorizationReleaseLineageTest.java",
        "dwp-auth-server/src/test/java/com/dwp/services/auth/service/ProductAuthorizationContractReleaseLineageTest.java",
        "dwp-auth-server/src/test/java/com/dwp/services/auth/config/ProductAuthorizationSeedLoaderTest.java",
        "dwp-auth-server/src/test/java/com/dwp/services/auth/support/PilotAuthorizationFixtureAdapter.java",
        "dwp-auth-server/src/test/java/com/dwp/services/auth/support/PilotAuthorizationFixtureAdapterTest.java",
        "dwp-auth-server/src/test/java/com/dwp/services/auth/repository/TenantFeatureActivationV273MigrationContractTest.java",
        "dwp-auth-server/src/test/java/com/dwp/services/auth/tenantfeatureactivation/TenantFeatureActivationV273PostgresTest.java",
        "dwp-gateway/src/test/java/com/dwp/gateway/productsurface/GeneratedProductRouteCatalogTest.java",
        "dwp-gateway/src/test/java/com/dwp/gateway/productsurface/GeneratedProductRouteTopologyTest.java",
        "dwp-gateway/src/test/java/com/dwp/gateway/ProductSurfaceDecisionContextFilterTest.java",
        "dwp-gateway/src/test/java/com/dwp/gateway/support/PilotAuthorizationFixtureAdapter.java",
        "dwp-gateway/src/test/java/com/dwp/gateway/support/PilotAuthorizationFixtureAdapterTest.java",
    ],
    "frontendCentralMirror": [
        "scripts/product-authorization-fixture-versions.mjs",
        "architecture/product-surface-authorization.v1.json",
        "architecture/pilot-fixtures.v1.generated.json",
        "libs/shared-utils/src/test-utils/pilot-authorization-fixtures.generated.ts",
        "apps/dwp/src/routes/product-surface-authorization.generated.ts",
    ],
    "frontendBytePreservedAndExecuted": [
        "scripts/sync-product-surface-authorization.mjs",
        "scripts/sync-product-authorization-fixtures.mjs",
        "architecture/product-page-routes.v1.json",
        "apps/dwp/src/routes/product-route-contracts.generated.test.ts",
    ],
    "explicitlyExcluded": [
        "dwp-people-server/src/main/java/com/dwp/services/people/hris/performance/per009/**",
        "dwp-people-server/src/test/java/com/dwp/services/people/hris/performance/per009/**",
        "dwp-people-server/src/main/resources/db/performance-migration/V21__per_base_tfr_per_009.sql",
        "apps/dwp/src/features/hris/performance/** PER-009 command implementation",
        "apps/dwp/src/features/hcm/hcm-navigation.ts",
        "apps/dwp/src/pages/hcm.tsx",
        "dwp-people-server/src/main/java/com/dwp/services/people/security/HcmV3PepRegistry.java",
        "dwp-people-server/src/main/java/com/dwp/services/people/security/HcmPeoplePepProjection.java",
        "dwp-people-server/src/main/java/com/dwp/services/people/security/HcmScopeSelectionValidator.java",
        "dwp-people-server/src/main/java/com/dwp/services/people/security/HcmProductSurfacePepFilter.java",
        "apps/dwp/src/routes/hris-w1-browser-firewall-contract.test.ts",
        "e2e/support/hris-w1-browser-firewall-contract.mjs",
        "sidebar, menu, route mount or tenant feature enrollment source",
        "approval-pilot-pep-v63.generated.json because v63 adds no Approval-owned route",
    ],
}

PLANNED_NEW_BACKEND_PATHS = {
    "scripts/tests/test_product_authorization_v63.py",
    "dwp-auth-server/src/main/resources/db/migration/V273__declare_hris_per009_v63_authorization_seed.sql",
    "contracts/product-authorization/product-surfaces-v1.bundle-v63.json",
    "dwp-auth-server/src/main/resources/product-authorization/product-surfaces-v1.bundle-v63.generated.json",
    "dwp-people-server/src/main/resources/product-authorization/hcm-people-pep-v63.generated.json",
    "dwp-time-server/src/main/resources/product-authorization/hcm-time-pep-v63.generated.json",
    "dwp-platform-server/src/main/resources/product-authorization/hcm-platform-pep-v63.generated.json",
    "dwp-payroll-server/src/main/resources/product-authorization/hcm-payroll-pep-v63.generated.json",
    "dwp-auth-server/src/test/java/com/dwp/services/auth/service/ProductAuthorizationV63ContractTest.java",
    "dwp-auth-server/src/test/java/com/dwp/services/auth/repository/TenantFeatureActivationV273MigrationContractTest.java",
    "dwp-auth-server/src/test/java/com/dwp/services/auth/tenantfeatureactivation/TenantFeatureActivationV273PostgresTest.java",
}

WRONG_NONEXISTENT_PEOPLE_TEST = (
    "dwp-people-server/src/test/java/com/dwp/services/people/security/GeneratedProductRouteCatalogTest.java"
)

FALSE_AUTHORITY_KEYS = [
    "boundedCentralImplementationAuthorized",
    "centralBackendWorktreeAuthorized",
    "centralFrontendWorktreeAuthorized",
    "centralExecutableTokenAuthorized",
    "backendSourceAuthoringAuthorized",
    "frontendMirrorSourceAuthoringAuthorized",
    "authV273SqlAuthoringAuthorized",
    "moduleOwnerPacketAuthorized",
    "moduleSourceAuthoringAuthorized",
    "moduleWorktreeAuthorized",
    "moduleStartTokenAuthorized",
    "performanceV21LeaseAuthorized",
    "routeOrMenuMountAuthorized",
    "featureEnablementAuthorized",
    "tenantEnrollmentAuthorized",
    "bundleApprovalAuthorized",
    "bundleActivationAuthorized",
    "productionReleaseAuthorized",
]

EXPECTED_NONCLAIMS = [
    "Product authorization v63 or Auth V273 source has been authored, generated, tested, committed, admitted, approved or activated.",
    "A central Backend or Frontend worktree or executable token exists.",
    "PEP-PER-010 or PEP-PER-011 has a runtime handler, owner PEP, persistence effect or command receipt connection.",
    "The Goal aggregate, PerformanceGoalCommitted.v1 producer or PERFORMANCE V21 exists.",
    "IAQ-038 or BASE:team-performance ownership moves from PER-008.",
    "The legacy personal-goal read or progress adapter is replaced, dual-read, dual-written or recounted.",
    "Any route, page, menu, provider, feature or tenant is mounted, enabled or enrolled.",
    "The v63 bundle is approved or active, automatic import is enabled, or a production release is authorized.",
    "PER-009, Batch 06, Wave 7 or HRIS is complete.",
]


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


def pin_key(pin: dict[str, Any]) -> tuple[str, str]:
    return str(pin.get("repository")), str(pin.get("path"))


def validate_pin_set(
    label: str,
    actual_pins: Any,
    expected_pins: list[dict[str, Any]],
    failures: list[str],
) -> None:
    require(isinstance(actual_pins, list), f"{label} pins are not a list", failures)
    if not isinstance(actual_pins, list):
        return
    actual_by_key = {pin_key(pin): pin for pin in actual_pins if isinstance(pin, dict)}
    expected_by_key = {pin_key(pin): pin for pin in expected_pins}
    require(set(actual_by_key) == set(expected_by_key), f"{label} pin path set drift", failures)
    for key, expected in expected_by_key.items():
        actual = actual_by_key.get(key)
        if actual is None:
            continue
        for field in ("bytes", "sha256"):
            require(actual.get(field) == expected[field], f"{label} pin {field} drift: {key}", failures)
        repo = REPOSITORIES.get(key[0])
        require(repo is not None, f"unknown pinned repository: {key[0]}", failures)
        if repo is None:
            continue
        path = repo / key[1]
        require(path.is_file(), f"pinned artifact missing: {key[0]}:{key[1]}", failures)
        if path.is_file():
            size, sha256 = digest(path)
            require(size == expected["bytes"], f"pinned artifact byte drift: {key}", failures)
            require(sha256 == expected["sha256"], f"pinned artifact SHA-256 drift: {key}", failures)


def validate_baselines(basis: dict[str, Any], failures: list[str]) -> None:
    for key, expected in EXPECTED_BASELINES.items():
        actual = basis.get(key)
        require(isinstance(actual, dict), f"missing authority baseline: {key}", failures)
        if not isinstance(actual, dict):
            continue
        for field, value in expected.items():
            require(actual.get(field) == value, f"{key} {field} drift", failures)
        require(actual.get("originMatchedAtAudit") is True, f"{key} origin audit pin missing", failures)
        repo = REPOSITORIES[expected["repository"]]
        try:
            local_commit = git(repo, "rev-parse", expected["branch"])
            origin_commit = git(repo, "rev-parse", f"origin/{expected['branch']}")
            tree = git(repo, "rev-parse", f"{expected['commit']}^{{tree}}")
        except subprocess.CalledProcessError as exc:
            failures.append(f"{key} git pin cannot be resolved: {exc.stderr.strip()}")
            continue
        require(local_commit == expected["commit"], f"{key} local dwp-dev drift", failures)
        require(origin_commit == expected["commit"], f"{key} origin/dwp-dev drift", failures)
        require(tree == expected["tree"], f"{key} commit tree drift", failures)


def registry_counts(bundle: dict[str, Any]) -> dict[str, int]:
    routes = bundle.get("routes", [])
    return {
        "capabilities": len(bundle.get("capabilities", [])),
        "accessPolicies": len(bundle.get("accessPolicies", [])),
        "entitlementExpressions": len(bundle.get("entitlementExpressions", [])),
        "predicatePolicies": len(bundle.get("predicatePolicies", [])),
        "routes": len(routes),
        "PAGE": sum(route.get("routeKind") == "PAGE" for route in routes),
        "DATA": sum(route.get("routeKind") == "DATA" for route in routes),
        "ACTION": sum(route.get("routeKind") == "ACTION" for route in routes),
    }


def validate_registry_lineage(successor: dict[str, Any], failures: list[str]) -> None:
    require(BACKEND_BUNDLE_V62.is_file(), "backend v62 bundle missing", failures)
    require(PEOPLE_PROJECTION_V62.is_file(), "People v62 projection missing", failures)
    if BACKEND_BUNDLE_V62.is_file():
        bundle = load(BACKEND_BUNDLE_V62)
        require(bundle.get("version") == 62, "backend bundle high-water is not v62", failures)
        require(bundle.get("bundleStatus") == "DRAFT", "backend v62 status is not DRAFT", failures)
        require(bundle.get("checksum") == V62_CHECKSUM, "backend v62 internal checksum drift", failures)
        require(registry_counts(bundle) == EXPECTED_V62_COUNTS, "backend v62 count drift", failures)
    if PEOPLE_PROJECTION_V62.is_file():
        people = load(PEOPLE_PROJECTION_V62)
        people_counts = registry_counts(people)
        people_counts["bindings"] = people.get("bindingPairCount")
        require(people.get("ownerServiceKey") == "people", "People v62 owner service drift", failures)
        require(
            people.get("registryRef")
            == {"bundleKey": "product-surfaces", "sha256": V62_CHECKSUM, "version": 62},
            "People v62 registry reference drift",
            failures,
        )
        require(people_counts == EXPECTED_PEOPLE_V62_COUNTS, "People v62 projection count drift", failures)
        require(people.get("projectedRouteContractCount") == 136, "People v62 projected route count drift", failures)
        require(people.get("sourceRegistryRouteCount") == 1158, "People v62 source route count drift", failures)
        require(
            people.get("routeKindCounts") == {"ACTION": 54, "DATA": 35, "PAGE": 47},
            "People v62 route-kind count drift",
            failures,
        )

    lineage = successor.get("productAuthorizationLineage", {})
    predecessor = lineage.get("predecessor")
    require(isinstance(predecessor, dict), "v62 predecessor declaration missing", failures)
    if isinstance(predecessor, dict):
        require(predecessor.get("version") == 62, "declared predecessor version drift", failures)
        require(predecessor.get("bundleStatus") == "DRAFT", "declared predecessor status drift", failures)
        require(predecessor.get("checksum") == V62_CHECKSUM, "declared predecessor checksum drift", failures)
        require(predecessor.get("counts") == EXPECTED_V62_COUNTS, "declared predecessor counts drift", failures)
        require(
            predecessor.get("peopleProjection") == EXPECTED_PEOPLE_V62_COUNTS,
            "declared People predecessor counts drift",
            failures,
        )
    reserved = lineage.get("successor")
    require(isinstance(reserved, dict), "v63 successor reservation missing", failures)
    if isinstance(reserved, dict):
        require(reserved.get("version") == 63, "reserved successor is not v63", failures)
        require(reserved.get("bundleStatus") == "DRAFT", "reserved successor is not DRAFT", failures)
        require(reserved.get("reservationState") == "RESERVED_NOT_ACTIVE", "v63 reservation state drift", failures)
        require(reserved.get("implementationAuthorizedNow") is False, "v63 implementation authority escaped", failures)
        require(
            reserved.get("expectedCounts")
            == {
                "capabilities": 281,
                "accessPolicies": 24,
                "entitlementExpressions": 17,
                "predicatePolicies": 88,
                "routes": 1160,
                "PAGE": 162,
                "DATA": 349,
                "ACTION": 649,
            },
            "v63 expected counts drift",
            failures,
        )
        require(
            reserved.get("expectedPeopleProjection")
            == {
                "capabilities": 66,
                "accessPolicies": 5,
                "entitlementExpressions": 3,
                "predicatePolicies": 24,
                "routes": 138,
                "bindings": 165,
                "PAGE": 47,
                "DATA": 35,
                "ACTION": 56,
            },
            "v63 expected People projection drift",
            failures,
        )
        require(
            reserved.get("unchangedServiceProjectionCounts")
            == {
                "time": {
                    "capabilities": 15, "accessPolicies": 0, "entitlementExpressions": 0,
                    "predicatePolicies": 9, "routes": 29, "bindings": 29,
                    "PAGE": 7, "DATA": 6, "ACTION": 16,
                },
                "platform": {
                    "capabilities": 24, "accessPolicies": 4, "entitlementExpressions": 3,
                    "predicatePolicies": 11, "routes": 89, "bindings": 90,
                    "PAGE": 8, "DATA": 24, "ACTION": 57,
                },
                "payroll": {
                    "capabilities": 17, "accessPolicies": 0, "entitlementExpressions": 0,
                    "predicatePolicies": 9, "routes": 41, "bindings": 41,
                    "PAGE": 5, "DATA": 14, "ACTION": 22,
                },
            },
            "v63 unchanged service projection counts drift",
            failures,
        )
        require(
            reserved.get("deltaExactly")
            == "one per.goal.self.write capability, one hcm-performance-goal-command predicate, two People ACTION route contracts, exact route-key appendage to the new self capability and existing hcm.team.performance.review capability, and no other semantic delta",
            "v63 exact delta drift",
            failures,
        )
        require(
            reserved.get("preservationRule")
            == "All v1 through v62 canonical and generated artifacts remain byte-identical. Existing descriptors may gain only deterministic reverse routeContractKeys where the generator derives them from the two new routes.",
            "v63 predecessor preservation rule drift",
            failures,
        )
        require(
            reserved.get("checksumRule")
            == "Generate the v63 checksum from canonical content. Placeholder checksums, hand-edited generated files and mutations of v1 through v62 are forbidden.",
            "v63 checksum rule drift",
            failures,
        )

    bundle_versions = []
    for path in (BACKEND / "contracts/product-authorization").glob("product-surfaces-v1.bundle-v*.json"):
        match = re.fullmatch(r"product-surfaces-v1\.bundle-v(\d+)\.json", path.name)
        if match:
            bundle_versions.append(int(match.group(1)))
    require(bundle_versions and max(bundle_versions) == 62, "backend bundle physical high-water is not v62", failures)

    forbidden_v63 = [
        BACKEND / "contracts/product-authorization/product-surfaces-v1.bundle-v63.json",
        BACKEND / "dwp-auth-server/src/main/resources/product-authorization/product-surfaces-v1.bundle-v63.generated.json",
        BACKEND / "dwp-people-server/src/main/resources/product-authorization/hcm-people-pep-v63.generated.json",
    ]
    for path in forbidden_v63:
        require(not path.exists(), f"v63 source already exists: {path.relative_to(BACKEND)}", failures)


def validate_frontend_mirror(successor: dict[str, Any], failures: list[str]) -> None:
    require(FRONTEND_MIRROR.is_file(), "frontend authorization mirror missing", failures)
    if not FRONTEND_MIRROR.is_file():
        return
    mirror = load(FRONTEND_MIRROR)
    latest = mirror.get("latestAlias", {})
    require(latest.get("version") == 61, "frontend latest alias is not v61", failures)
    require(latest.get("bundleStatus") == "DRAFT", "frontend v61 mirror status drift", failures)
    require(latest.get("checksum") == V61_CHECKSUM, "frontend v61 mirror checksum drift", failures)
    require(registry_counts(latest) == EXPECTED_V61_COUNTS, "frontend v61 mirror count drift", failures)
    bundles = mirror.get("bundles", [])
    require(len(bundles) == 61, "frontend mirror does not contain exactly v1-v61", failures)
    require(
        [bundle.get("version") for bundle in bundles] == list(range(1, 62)),
        "frontend mirror version sequence drift",
        failures,
    )
    if bundles:
        require(bundles[-1].get("checksum") == V61_CHECKSUM, "frontend last bundle checksum drift", failures)
        require(registry_counts(bundles[-1]) == EXPECTED_V61_COUNTS, "frontend last bundle count drift", failures)
    index = mirror.get("index", {})
    require(index.get("latestVersion") == 61, "frontend mirror index version drift", failures)
    require(index.get("latestChecksum") == V61_CHECKSUM, "frontend mirror index checksum drift", failures)
    require(index.get("latestArtifact") == "product-surfaces-v1.bundle-v61.json", "frontend mirror latest artifact drift", failures)
    require(len(index.get("versions", [])) == 61, "frontend mirror index version count drift", failures)

    declared = successor.get("frontendMirrorLineage", {})
    require(declared.get("observedBaselineVersion") == 61, "declared frontend mirror version drift", failures)
    require(declared.get("observedBaselineChecksum") == V61_CHECKSUM, "declared frontend mirror checksum drift", failures)
    require(declared.get("observedRegistryVersions") == 61, "declared frontend registry count drift", failures)
    require(declared.get("backendCanonicalHighWaterVersion") == 62, "declared backend high-water drift", failures)
    require(declared.get("backendCanonicalHighWaterChecksum") == V62_CHECKSUM, "declared backend checksum drift", failures)
    require(declared.get("successorTargetVersion") == 63, "declared frontend target drift", failures)
    mirror_bytes = FRONTEND_MIRROR.stat().st_size
    require(mirror_bytes == 79834507, "frontend observed snapshot byte drift", failures)
    require(declared.get("observedSnapshotBytes") == mirror_bytes, "declared frontend snapshot bytes drift", failures)
    require(declared.get("maximumSnapshotBytes") == 104857600, "frontend snapshot ceiling drift", failures)
    require(mirror_bytes < declared.get("maximumSnapshotBytes", 0), "frontend snapshot already exceeds sealed ceiling", failures)
    require(
        declared.get("catchUpRule")
        == "The future central frontend mirror must import the already-reviewed immutable v62 predecessor and the generated v63 successor in one deterministic lineage update. It must not skip v62, synthesize a replacement v62 checksum, or change any v1 through v61 mirror bytes after canonical normalization.",
        "frontend v62-v63 catch-up rule drift",
        failures,
    )
    require(
        declared.get("pageCatalogRule")
        == "Neither v62 nor v63 adds an HCM PAGE route for PER-009. Runtime page routes, catalog-only PAGE routes, legacy redirects, navigation and the HRIS browser-firewall PAGE counts remain unchanged.",
        "frontend PAGE preservation rule drift",
        failures,
    )
    require(
        declared.get("storageRule")
        == "If the deterministic v62 plus v63 snapshot would exceed 104857600 bytes, stop. Truncation, predecessor removal, history mutation or alternate serialization is forbidden; a separate storage-rollover successor is required.",
        "frontend rollover stop rule drift",
        failures,
    )
    require(declared.get("implementationAuthorizedNow") is False, "frontend mirror implementation authority escaped", failures)


def split_pipe(value: str) -> list[str]:
    return value.split("|") if value else []


def validate_pep_register(successor: dict[str, Any], failures: list[str]) -> None:
    require(PEP_REGISTER_PATH.is_file(), "PEP binding register missing", failures)
    if not PEP_REGISTER_PATH.is_file():
        return
    with PEP_REGISTER_PATH.open(newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    selected = [row for row in rows if row.get("binding_id") in {"PEP-PER-010", "PEP-PER-011"}]
    require(len(selected) == 2, "PEP register does not contain exactly PER-010 and PER-011", failures)
    by_id = {row["binding_id"]: row for row in selected}
    branch_rows = successor.get("authorizationBranchMatrix", [])
    require(branch_rows == EXPECTED_BRANCHES, "four-branch authorization matrix drift", failures)
    for transport in EXPECTED_TRANSPORTS:
        contract_id = transport["contractId"]
        row = by_id.get(contract_id)
        require(row is not None, f"PEP register row missing: {contract_id}", failures)
        if row is None:
            continue
        require(row["module"] == "PER", f"PEP module drift: {contract_id}", failures)
        require(row["source_operation_id"] == transport["operationId"], f"PEP operation drift: {contract_id}", failures)
        require(row["method"] == transport["method"], f"PEP method drift: {contract_id}", failures)
        require(row["contract_path"] == transport["browserPath"], f"PEP contract path drift: {contract_id}", failures)
        require(row["browser_path"] == transport["browserPath"], f"PEP browser path drift: {contract_id}", failures)
        require(row["owner_path"] == transport["ownerPath"], f"PEP owner path drift: {contract_id}", failures)
        require(row["owner_service"] == "dwp-people-server", f"PEP owner service drift: {contract_id}", failures)
        require(
            split_pipe(row["source_authorization_alias"])
            == ["per.goal.self.write", "per.goal.team.approve"],
            f"PEP source authorization alias drift: {contract_id}",
            failures,
        )
        require(row["canonical_app_entitlement"] == "APP.HCM:VIEW", f"PEP app entitlement drift: {contract_id}", failures)
        require(split_pipe(row["pep_layers"]) == PEP_LAYERS, f"PEP layer drift: {contract_id}", failures)
        require(row["state"] == "G3_BINDING_SPECIFIED_NOT_IMPLEMENTED", f"PEP state drift: {contract_id}", failures)

        branches = [branch for branch in branch_rows if branch.get("contractId") == contract_id]
        require({branch.get("branch") for branch in branches} == {"SELF", "MANAGER"}, f"PEP branch set drift: {contract_id}", failures)

        def union(field: str) -> set[str]:
            result: set[str] = set()
            for branch in branches:
                value = branch.get(field)
                if isinstance(value, list):
                    result.update(str(item) for item in value)
                elif value is not None:
                    result.add(str(value))
            return result

        require(
            {(branch.get("profile"), branch.get("duty")) for branch in branches}
            == {tuple(pair.split(">", 1)) for pair in split_pipe(row["authorization_profiles"])},
            f"PEP profile-duty union drift: {contract_id}",
            failures,
        )
        mappings = {
            "capability": "canonical_capability_keys",
            "resourceTypes": "canonical_resource_types",
            "resourceKeys": "canonical_resource_keys",
            "actions": "canonical_actions",
            "populationTypes": "canonical_population_types",
            "fieldGroups": "canonical_field_group_keys",
            "purposeCode": "purpose_codes",
        }
        for branch_field, csv_field in mappings.items():
            require(
                union(branch_field) == set(split_pipe(row[csv_field])),
                f"PEP {csv_field} union drift: {contract_id}",
                failures,
            )
        require(union("appEntitlement") == {row["canonical_app_entitlement"]}, f"PEP app branch union drift: {contract_id}", failures)


def validate_migration_reservation(successor: dict[str, Any], failures: list[str]) -> None:
    reservation = successor.get("authMigrationReservation", {})
    require(reservation.get("stream") == "AUTH", "Auth migration stream drift", failures)
    require(reservation.get("observedHighWater") == "V272", "Auth high-water declaration drift", failures)
    require(
        reservation.get("predecessor")
        == {
            "path": "dwp-auth-server/src/main/resources/db/migration/V272__hrm013_identity_task_dispatch_inbox.sql",
            "sha256": "6e9d1e25b99e98b7008dc2e1a6757a4fde1f91a0bcd3293e784fc12e35c753cb",
            "bytes": 65449,
        },
        "Auth V272 predecessor pin drift",
        failures,
    )
    require(reservation.get("candidateVersion") == "V273", "Auth candidate version drift", failures)
    require(
        reservation.get("candidatePath")
        == "dwp-auth-server/src/main/resources/db/migration/V273__declare_hris_per009_v63_authorization_seed.sql",
        "Auth V273 candidate path drift",
        failures,
    )
    require(reservation.get("reservationState") == "RESERVED_NOT_ACTIVE", "Auth V273 reservation state drift", failures)
    for key in ("physicalCollisionAtAudit", "leaseIssued", "sqlAuthoringAuthorized", "automaticImportEnabled"):
        require(reservation.get(key) is False, f"Auth reservation authority escaped: {key}", failures)
    require(reservation.get("implementationAuthorizedNow") is False, "Auth V273 implementation authority escaped", failures)
    require(
        reservation.get("bundle")
        == {
            "bundleKey": "product-surfaces",
            "version": 63,
            "artifact": "product-surfaces-v1.bundle-v63.generated.json",
            "intendedStatus": "DRAFT",
        },
        "Auth v63 bundle reservation drift",
        failures,
    )
    feature = reservation.get("feature", {})
    require(feature.get("featureKey") == "HRIS_PER_GOAL_COMMANDS", "reserved feature key drift", failures)
    require(feature.get("policyVersion") == 1, "reserved feature policy version drift", failures)
    require(feature.get("productKey") == "hcm", "reserved feature product drift", failures)
    require(feature.get("appResourceKey") == "APP.HCM", "reserved feature app resource drift", failures)
    require(feature.get("minimumBundleVersion") == 63, "reserved feature minimum version drift", failures)
    require(feature.get("baselineState") == "OFF", "reserved feature is not default OFF", failures)
    require(feature.get("ownerKey") == "PER", "reserved feature owner drift", failures)
    require(
        feature.get("routeOwnersAndBindings")
        == [
            "route.hcm.performance.goal-create.action",
            "route.hcm.performance.goal-submit.action",
        ],
        "reserved feature route owner set drift",
        failures,
    )
    require(feature.get("globalActiveRows") == 0, "reserved feature has global rows", failures)
    require(feature.get("tenantEnrollmentRows") == 0, "reserved feature has tenant rows", failures)
    expected_route_manifest = [
        {
            "routeContractKey": key,
            "featureKey": "HRIS_PER_GOAL_COMMANDS",
            "policyVersion": 1,
            "productKey": "hcm",
            "appResourceKey": "APP.HCM",
            "minimumBundleVersion": 63,
            "routeKind": "ACTION",
            "subjectType": "PRODUCT",
            "surfaceKey": "hcm.operations",
        }
        for key in (
            "route.hcm.performance.goal-create.action",
            "route.hcm.performance.goal-submit.action",
        )
    ]
    require(feature.get("exactRouteBindingManifest") == expected_route_manifest, "V273 exact route manifest drift", failures)

    catalog = reservation.get("catalogDecision", {})
    require(
        catalog.get("newResourceTemplates")
        == [{
            "resourceKey": "DATA.HRIS_PERFORMANCE_GOAL",
            "resourceType": "DATA",
            "displayName": "HRIS performance goal data",
            "requiredEntitlement": "core.people",
            "lifecycleState": "ACTIVE",
        }],
        "V273 Goal resource template drift",
        failures,
    )
    require(
        catalog.get("reusedResourceTemplates")
        == [{
            "resourceKey": "DATA.HRIS_PERFORMANCE_REVIEW",
            "resourceType": "DATA",
            "displayName": "HRIS performance assigned review",
            "requiredEntitlement": "core.people",
            "lifecycleState": "ACTIVE",
            "mutationForbidden": True,
        }],
        "V273 reused review resource drift",
        failures,
    )
    require(
        catalog.get("catalogOnlyDuties")
        == [
            {
                "dutyCode": "HRIS_DUTY_SELF_GOAL_AUTHOR",
                "productKey": "hcm",
                "legacyRoleCode": "WORKSPACE_MEMBER",
                "productResourceKey": "APP.HCM",
                "resourceKey": "DATA.HRIS_PERFORMANCE_GOAL",
                "auditPolicyException": False,
                "riskTier": "MEDIUM",
                "lifecycleState": "ACTIVE",
                "version": 0,
            },
            {
                "dutyCode": "HRIS_DUTY_MANAGER_PERFORMANCE_REVIEWER",
                "productKey": "hcm",
                "legacyRoleCode": "TALENT_ADMIN",
                "productResourceKey": "APP.HCM",
                "resourceKey": "DATA.HRIS_PERFORMANCE_REVIEW",
                "auditPolicyException": False,
                "riskTier": "HIGH",
                "lifecycleState": "ACTIVE",
                "version": 0,
            },
        ],
        "V273 catalog-only duty tuple drift",
        failures,
    )
    require(
        catalog.get("catalogOnlyDutyMappings")
        == [
            {
                "dutyCode": "HRIS_DUTY_SELF_GOAL_AUTHOR",
                "capabilityContractKey": "per.goal.self.write",
                "permissionResourceKey": "DATA.HRIS_PERFORMANCE_GOAL",
                "permissionCode": "UPDATE",
                "resolvedCapabilityCode": "DATA.HRIS_PERFORMANCE_GOAL:UPDATE",
            },
            {
                "dutyCode": "HRIS_DUTY_MANAGER_PERFORMANCE_REVIEWER",
                "capabilityContractKey": "hcm.team.performance.review",
                "permissionResourceKey": "DATA.HRIS_PERFORMANCE_REVIEW",
                "permissionCode": "UPDATE",
                "resolvedCapabilityCode": "DATA.HRIS_PERFORMANCE_REVIEW:UPDATE",
            },
        ],
        "V273 duty-capability-permission tuple drift",
        failures,
    )
    require(
        catalog.get("tenantResourceMaterialization")
        == {
            "resourceType": "DATA",
            "resourceKey": "DATA.HRIS_PERFORMANCE_GOAL",
            "name": "HRIS performance goal data",
            "enabled": True,
            "createdBy": 1,
            "updatedBy": 1,
            "cardinality": "exactly one row per tenant",
            "authorityMeaning": "catalog materialization only; it creates no principal, role or duty grant",
        },
        "V273 tenant Goal resource materialization drift",
        failures,
    )
    expected_zero_predicates = [
        "auth_product_authorization_bundle contains zero imported product-surfaces v63 rows",
        "auth_product_authorization_active contains no pointer to product-surfaces v63",
        "auth_product_authorization_activation_event contains zero v63 activation events",
        "auth_product_feature_activation_changes contains zero HRIS_PER_GOAL_COMMANDS rows",
        "com_tenant_feature_enrollment_changes contains zero HRIS_PER_GOAL_COMMANDS rows",
        "sys_tenant_role_permission_templates and com_role_permissions contain zero DATA.HRIS_PERFORMANCE_GOAL rows",
        "com_admin_scoped_duty_assignments and sys_admin_app_preset_duties contain zero rows for the two new duties",
        "com_admin_resource_set_members and com_principal_resource_grants contain zero DATA.HRIS_PERFORMANCE_GOAL rows",
        "sys_builtin_role_catalog and com_roles contain zero rows for HRIS_EMPLOYEE, HRIS_LINE_MANAGER, HRIS_PERFORMANCE_OPERATOR, EMPLOYEE or MANAGER compatibility roles",
        "V273 performs zero People Goal, business, owner-population or module-schema writes",
    ]
    require(catalog.get("zeroDerivedAuthorityPredicates") == expected_zero_predicates, "V273 zero-derived-authority closure drift", failures)
    require(
        catalog.get("legacyRoleEvidence")
        == "WORKSPACE_MEMBER is the existing v251 performance-review role grant used for employee self service; TALENT_ADMIN is the existing v251 performance-review grant and the v268 manager performance-workbench duty precedent. These values catalog compatibility only and create no role, membership, assignment or grant.",
        "V273 legacy-role evidence drift",
        failures,
    )
    require(
        catalog.get("reusedReviewGrantRule")
        == "V251's existing WORKSPACE_MEMBER, TALENT_ADMIN and HR_ADMIN UPDATE grants for DATA.HRIS_PERFORMANCE_REVIEW are immutable predecessors. V273 inserts, updates or deletes none of those templates or tenant role permissions.",
        "V251 review grant freeze drift",
        failures,
    )
    require(
        catalog.get("mayCreateExactly")
        == [
            "one immutable product-authorization v63 DRAFT release declaration with generated checksum and automatic import false",
            "one HRIS_PER_GOAL_COMMANDS policy-version-1 feature declaration with baseline OFF",
            "exactly two feature route-owner rows and two feature route-binding rows equal to exactRouteBindingManifest",
            "one DATA.HRIS_PERFORMANCE_GOAL resource template and tenant resource instances without any principal assignment",
            "exactly two scoped-duty catalog rows and two duty-capability mappings equal to the sealed catalogOnlyDuties and catalogOnlyDutyMappings",
            "an exact conflict proof that the reused DATA.HRIS_PERFORMANCE_REVIEW template is byte-semantic equivalent",
        ],
        "V273 may-create closed set drift",
        failures,
    )
    require(
        catalog.get("mustNotCreate")
        == [
            "feature activation or tenant enrollment",
            "static role permission template or com_role_permissions row",
            "builtin role, compatibility role, role membership or preset",
            "duty, responsibility or population assignment",
            "principal resource grant or admin resource-set membership",
            "broad permission grant, compatibility alias or implied cross-capability grant",
            "menu, shell mount, page component, owner API, Goal business row or module migration",
            "automatic bundle import or DRAFT-to-ACTIVE transition",
        ],
        "V273 must-not-create closed set drift",
        failures,
    )
    require(
        reservation.get("conflictRule")
        == "Every ON CONFLICT path accepts only an exact immutable tuple, including resource template, duty, duty-capability, route key, feature, policy version, product, app resource, minimum bundle version, route kind, subject type and surface. Exact reapplication is a no-op; any semantic drift aborts the transaction.",
        "V273 exact conflict rule drift",
        failures,
    )
    require(
        reservation.get("rule")
        == "V273 may declare only the generated v63 checksum, the exact catalogDecision, the default-OFF feature and the two exact route owner/binding tuples. It inserts no active bundle, tenant enrollment, role permission, principal grant, duty or population assignment, business row or automatic import.",
        "V273 reservation rule drift",
        failures,
    )

    migration_dir = BACKEND / "dwp-auth-server/src/main/resources/db/migration"
    versions: list[int] = []
    for path in migration_dir.glob("V*__*.sql"):
        match = re.match(r"V(\d+)__", path.name)
        if match:
            versions.append(int(match.group(1)))
    require(versions and max(versions) == 272, "physical Auth migration high-water is not V272", failures)
    v273 = migration_dir / "V273__declare_hris_per009_v63_authorization_seed.sql"
    require(not v273.exists(), "reserved V273 already exists", failures)


def validate_allowlist(successor: dict[str, Any], failures: list[str]) -> None:
    allowlist = successor.get("futureSourceAllowlist", {})
    for key, expected in EXPECTED_ALLOWLIST.items():
        require(allowlist.get(key) == expected, f"future source allowlist drift: {key}", failures)
    require(
        allowlist.get("state")
        == "ALLOWLIST_SEALED_IMPLEMENTATION_STILL_REQUIRES_SEPARATE_CLEAN_WORKTREES_AND_EXECUTABLE_TOKEN",
        "future source allowlist state drift",
        failures,
    )
    require(
        allowlist.get("scope") == "CENTRAL_V63_V273_GENERATION_AND_UNMOUNTED_FRONTEND_MIRROR_ONLY",
        "future source allowlist scope drift",
        failures,
    )
    flattened = {
        path
        for key in EXPECTED_ALLOWLIST
        for path in allowlist.get(key, [])
        if isinstance(path, str)
    }
    require(
        WRONG_NONEXISTENT_PEOPLE_TEST not in flattened,
        "nonexistent People GeneratedProductRouteCatalogTest was allowlisted",
        failures,
    )
    require(
        not (BACKEND / WRONG_NONEXISTENT_PEOPLE_TEST).exists(),
        "unexpected nonexistent People route-catalog test now exists",
        failures,
    )
    for key in ("backendCanonical", "backendGenerated", "backendTargetedTests"):
        for relative in allowlist.get(key, []):
            if relative in PLANNED_NEW_BACKEND_PATHS:
                require(not (BACKEND / relative).exists(), f"planned path exists before authority: {relative}", failures)
            else:
                require((BACKEND / relative).is_file(), f"required backend allowlist path missing: {relative}", failures)
    for key in ("frontendCentralMirror", "frontendBytePreservedAndExecuted"):
        for relative in allowlist.get(key, []):
            require((FRONTEND / relative).is_file(), f"required frontend allowlist path missing: {relative}", failures)
    require(
        allowlist.get("generatedFileRule")
        == "Generated artifacts are checked-in derived outputs, never independent authority. Only the canonical YAML and deterministic generators may produce them; manual editing is forbidden.",
        "generated-file authority rule drift",
        failures,
    )

    require(
        successor.get("frozenRuntimeBindings")
        == [
            "People HcmV3PepRegistry and HcmPeoplePepProjection remain bound to hcm-people-pep-v60.generated.json; the generated v63 People PEP is an unmounted artifact in the central phase.",
            "No PER-009 controller, handler, repository, receipt, outbox or Goal aggregate implementation is authorized by the central phase.",
            "Gateway may add only the two Goal route keys to the code-owned default-OFF tenant-feature governed set; it may not forward PER-009 purpose, population, field or owner-predicate evidence in this phase.",
            "People owner PEP and runtime v63 registry binding remain deferred to the separately tokenized module phase.",
            "No route, page, menu, navigation, provider, feature or tenant enrollment is mounted or enabled.",
        ],
        "central-phase frozen runtime bindings drift",
        failures,
    )
    deferred = successor.get("deferredOwnerRuntimeRequirements", {})
    require(deferred.get("state") == "SEALED_REQUIREMENTS_NOT_CENTRAL_SOURCE_AUTHORITY", "deferred owner state drift", failures)
    require(deferred.get("sourceAuthoringAuthorizedNow") is False, "deferred owner source authority escaped", failures)
    require(
        deferred.get("prerequisites")
        == [
            "the exact v63 and V273 central implementation is independently reviewed, admitted and committed",
            "the feature remains OFF with zero global activation and tenant enrollment",
            "the exact PERFORMANCE V21 manifest and lease are separately sealed",
            "an exact PER-009 owner packet, clean module worktrees and one-shot executable token exist",
        ],
        "deferred owner prerequisites drift",
        failures,
    )
    require(
        deferred.get("requiredPathsForLaterOwnerAuthority")
        == [
            "dwp-people-server/src/main/java/com/dwp/services/people/security/HcmV3PepRegistry.java",
            "dwp-people-server/src/main/java/com/dwp/services/people/security/HcmPeoplePepProjection.java",
            "dwp-people-server/src/main/java/com/dwp/services/people/security/HcmScopeSelectionValidator.java",
            "dwp-people-server/src/main/java/com/dwp/services/people/security/HcmProductSurfacePepFilter.java",
            "dwp-people-server/src/test/java/com/dwp/services/people/security/HcmV3PepRegistryTest.java",
            "dwp-people-server/src/test/java/com/dwp/services/people/security/HcmScopeSelectionValidatorPer009Test.java",
            "dwp-people-server/src/test/java/com/dwp/services/people/security/HcmProductSurfacePepFilterTest.java",
        ],
        "deferred owner runtime path closure drift",
        failures,
    )
    require(
        deferred.get("requiredProof")
        == [
            "the runtime registry binds only the admitted v63 People projection and its exact checksum",
            "both Goal routes expose exactly the manager and self profiles, capabilities, predicate sets, target binding kinds and method/path pairs sealed here",
            "the Goal predicate rejects mixed, incomplete, caller-supplied and cross-tenant evidence before effect",
            "SELF and MANAGER are target-disjoint; ambiguous or mixed-branch evidence fails closed",
            "default OFF and zero enrollment prevent every owner dispatch",
        ],
        "deferred owner required proof drift",
        failures,
    )
    central_paths = set(allowlist.get("backendCanonical", [])) | set(allowlist.get("backendTargetedTests", []))
    require(not central_paths.intersection(deferred.get("requiredPathsForLaterOwnerAuthority", [])), "deferred owner path leaked into central allowlist", failures)

    commands = successor.get("targetedVerificationForFutureImplementation", [])
    require(
        commands
        == [
            "python3 scripts/generate-product-authorization-contracts.py",
            "python3 scripts/generate-product-authorization-contracts.py --check",
            "python3 scripts/generate-product-authorization-fixtures.py --write",
            "python3 scripts/generate-product-authorization-fixtures.py --check",
            "python3 -m unittest scripts.tests.test_product_authorization_v62 scripts.tests.test_product_authorization_v63",
            "./gradlew productAuthorizationRegistryCheck pilotFixturesCheck",
            "targeted Auth v63 lineage, seed-loader, fixture-adapter and V273 static plus PostgreSQL tests",
            "targeted Gateway exact two-route topology and decision-context tests",
            "ProductAuthorizationGateTopologyValidator exact two-route ACTION, POST, binding, profile, capability, predicate and empty-step-up closure",
            "yarn authorization:sync",
            "yarn authorization:check ../dwp-backend/contracts/product-authorization",
            "yarn fixtures:sync",
            "yarn fixtures:check",
            "frontend v61 to immutable v62 to v63 mirror catch-up, page-catalog byte preservation and 104857600-byte ceiling",
            "negative matrix for missing app/profile/duty/capability/population/field/purpose, cross-tenant 404 and self-manager branch separation",
            "default-OFF zero-call and zero-enrollment assertions",
        ],
        "targeted verification closed set drift",
        failures,
    )
    for command in (
        "python3 scripts/generate-product-authorization-contracts.py",
        "python3 scripts/generate-product-authorization-contracts.py --check",
        "python3 scripts/generate-product-authorization-fixtures.py --write",
        "python3 scripts/generate-product-authorization-fixtures.py --check",
        "yarn authorization:sync",
        "yarn authorization:check ../dwp-backend/contracts/product-authorization",
        "yarn fixtures:sync",
        "yarn fixtures:check",
    ):
        require(command in commands, f"required targeted generation command missing: {command}", failures)
    require(not any("only if" in command for command in commands), "frontend mirror verification is still conditional", failures)


def validate_authority(successor: dict[str, Any], failures: list[str]) -> None:
    authority = successor.get("authority", {})
    require(authority.get("centralSuccessorDesignSealed") is True, "successor design is not sealed", failures)
    require(authority.get("productAuthorizationV63Reserved") is True, "v63 is not reserved", failures)
    require(authority.get("authV273Reserved") is True, "V273 is not reserved", failures)
    require(authority.get("independentReviewRequiredBeforeImplementation") is True, "review gate is not required", failures)
    for key in FALSE_AUTHORITY_KEYS:
        require(authority.get(key) is False, f"source/worktree/token/V21 authority escaped: {key}", failures)
    require(authority.get("featureDefaultOff") is True, "feature default-OFF flag drift", failures)
    for key in ("globalActiveRows", "tenantEnrollmentRows", "businessCompletionCredit"):
        require(authority.get(key) == 0, f"authority zero boundary drift: {key}", failures)
    require(successor.get("defaultOffBoundary") == EXPECTED_DEFAULT_OFF, "default-OFF zero boundary drift", failures)
    require(successor.get("nonClaims") == EXPECTED_NONCLAIMS, "successor non-claims drift", failures)
    require(
        successor.get("ownershipAndNoRecount")
        == {
            "per008Primary": {
                "sliceId": "BASE-TFR-PER-008",
                "node": "BASE:team-performance",
                "query": "IAQ-038",
                "route": "/hr/team/performance",
                "ownershipTransferred": False,
                "completionRecount": False,
            },
            "preservedLegacy": [
                "GET /api/people/v1/hr/talent",
                "PUT /api/people/v1/hr/talent/goals/{goalId}",
            ],
            "legacyAdapterReclassifiedAsCanonical": False,
            "dualReadAuthorized": False,
            "dualWriteAuthorized": False,
            "rule": "PER-008 may expose action provenance but does not implement or grant either PER-009 command. Existing goal read and progress behavior remains unchanged and receives no completion credit.",
        },
        "PER-008 ownership/no-recount boundary drift",
        failures,
    )

    for transport in successor.get("transportContracts", []):
        require(transport.get("implementationAuthorizedNow") is False, f"transport implementation authority escaped: {transport.get('contractId')}", failures)
    require(successor.get("predicateDecision", {}).get("implementationAuthorizedNow") is False, "predicate implementation authority escaped", failures)
    for route in successor.get("routeContracts", []):
        require(route.get("implementationAuthorizedNow") is False, f"route implementation authority escaped: {route.get('routeContractKey')}", failures)


def validate_review(successor: dict[str, Any], failures: list[str]) -> None:
    require(REVIEW_PATH.is_file(), f"independent review missing: {REVIEW_PATH.relative_to(FRONTEND)}", failures)
    if not REVIEW_PATH.is_file():
        return
    try:
        review = load(REVIEW_PATH)
    except (json.JSONDecodeError, OSError) as exc:
        failures.append(f"independent review cannot be loaded: {exc}")
        return
    require(review.get("sliceId") == "BASE-TFR-PER-009", "review slice drift", failures)
    require(review.get("immutability", {}).get("sealed") is True, "review is not sealed", failures)
    require(
        review.get("postResolutionSeverityCounts") == {"P0": 0, "P1": 0, "P2": 0},
        "review is not zero P0/P1/P2",
        failures,
    )
    size, sha256 = digest(SUCCESSOR_PATH)
    relative = SUCCESSOR_PATH.relative_to(FRONTEND).as_posix()
    exact_pin = {
        "repository": "dwp-frontend",
        "path": relative,
        "bytes": size,
        "sha256": sha256,
    }
    require(exact_pin in review.get("reviewedArtifacts", []), "review does not pin exact successor bytes and SHA-256", failures)
    validator_size, validator_sha256 = digest(pathlib.Path(__file__).resolve())
    validator_pin = {
        "repository": "dwp-frontend",
        "path": pathlib.Path(__file__).resolve().relative_to(FRONTEND).as_posix(),
        "bytes": validator_size,
        "sha256": validator_sha256,
    }
    require(validator_pin in review.get("reviewedArtifacts", []), "review does not pin exact validator bytes and SHA-256", failures)
    review_authority = review.get("authority", {})
    require(review_authority.get("independentReviewComplete") is True, "review completion authority missing", failures)
    require(review_authority.get("authorityCarrierCommitAndPushAuthorized") is True, "review carrier commit authority missing", failures)
    for key in FALSE_AUTHORITY_KEYS:
        if key in review_authority:
            require(review_authority.get(key) is False, f"review escaped authority: {key}", failures)

    successor_authority = successor.get("authority", {})
    require(
        successor_authority.get("independentReviewComplete") is False,
        "immutable predecessor successor incorrectly self-asserts independent review",
        failures,
    )
    require(
        successor_authority.get("authorityCarrierCommitAndPushAuthorized") is False,
        "immutable predecessor successor incorrectly self-authorizes carrier push",
        failures,
    )


def main() -> int:
    failures: list[str] = []
    require(SUCCESSOR_PATH.is_file(), "authorization successor missing", failures)
    if not SUCCESSOR_PATH.is_file():
        print(json.dumps({"status": "FAIL", "failures": failures}, indent=2))
        return 1
    try:
        successor = load(SUCCESSOR_PATH)
    except (json.JSONDecodeError, OSError) as exc:
        print(json.dumps({"status": "FAIL", "failures": [f"authorization successor cannot be loaded: {exc}"]}, indent=2))
        return 1

    require(successor.get("sliceId") == "BASE-TFR-PER-009", "successor slice drift", failures)
    require(successor.get("schema") == "dwp.hris.transport-central-authorization-successor.v1", "successor schema drift", failures)
    require(successor.get("successorId") == "R7-B06-PER009-TRANSPORT-CENTRAL-AUTHORIZATION-SUCCESSOR-R1", "successor id drift", failures)
    require(successor.get("module") == "PER", "successor module drift", failures)
    require(successor.get("moduleSession") == "HRIS-PER", "successor module session drift", failures)
    require(successor.get("boundedContext") == "PERFORMANCE", "successor bounded context drift", failures)
    require(successor.get("sourceRef") == "TFR-PER-009", "successor source ref drift", failures)
    require(
        successor.get("state")
        == "SEALED_EXACT_PEP010_PEP011_TRANSPORT_PRODUCT_AUTHORIZATION_V63_AUTH_V273_DEFAULT_OFF_ZERO_ENROLLMENT_INDEPENDENT_REVIEW_REQUIRED_SOURCE_WITHHELD",
        "successor state drift",
        failures,
    )
    require(
        successor.get("decision")
        == "RESERVE_ONE_APPEND_ONLY_PRODUCT_AUTHORIZATION_V63_AND_AUTH_V273_SUCCESSOR_FOR_EXACTLY_PEP_PER_010_AND_PEP_PER_011; PRESERVE_PER008_IAQ038_AND_LEGACY_GOAL_PROGRESS; KEEP_FEATURE_OFF_WITH_ZERO_ENROLLMENT_AND_WITHHOLD_ALL_SOURCE_PACKET_TOKEN_WORKTREE_AND_V21_AUTHORITY",
        "successor decision drift",
        failures,
    )
    require(
        successor.get("businessBoundary")
        == "Add only the canonical createGoal and submitGoal transport and authorization decisions required by PER-009. Do not implement Goal persistence, receipts, event production, V21, frontend commands, navigation, feature activation or tenant enrollment.",
        "successor business boundary drift",
        failures,
    )
    require(successor.get("immutability", {}).get("sealed") is True, "successor is not sealed", failures)
    require(
        successor.get("immutability", {}).get("amendmentPolicy")
        == "APPEND_ONLY_SUCCESSOR_WITH_NEW_ID_AND_SHA256",
        "successor amendment policy drift",
        failures,
    )

    basis = successor.get("authorityBasis", {})
    validate_baselines(basis, failures)
    validate_pin_set("semantic carrier", basis.get("semanticCarrier"), EXPECTED_SEMANTIC_PINS, failures)
    validate_pin_set("accepted evidence", basis.get("acceptedEvidence"), EXPECTED_EVIDENCE_PINS, failures)

    require(successor.get("transportContracts") == EXPECTED_TRANSPORTS, "exact two PER-009 transport contracts drift", failures)
    require(successor.get("capabilityDecision") == EXPECTED_CAPABILITY_DECISION, "PER-009 capability decision drift", failures)
    require(successor.get("predicateDecision") == EXPECTED_PREDICATE_DECISION, "PER-009 predicate decision drift", failures)
    require(successor.get("routeContracts") == EXPECTED_ROUTES, "exact two PER-009 route contracts drift", failures)
    expected_gate_criteria = [
        "The semantic carrier and this successor pass independent review with zero P0, P1 and P2 findings.",
        "The v63 delta is exactly one new self capability, one goal predicate and two People ACTION routes with no unrelated descriptor change.",
        "All canonical and generated v1 through v62 artifacts remain byte-identical and the v62 internal checksum remains unchanged.",
        "The four self and manager command branches equal the PEP register for source authorization alias, app, profile, duty, capability, resource, action, population, field, purpose and all seven ordered PEP layers.",
        "Browser and owner method/path pairs are exact, binding keys match, and neither route has a UI route or page mount.",
        "The generated v63 bundle and People projection equal the expected counts and Time, Platform and Payroll projections remain semantically unchanged.",
        "Generator and fixture checks are deterministic; latest aliases and indexes point to v63 without hand-edited generated bytes.",
        "V273 is collision-free, declares only DRAFT v63 and the default-OFF zero-enrollment feature, and leaves automatic import disabled.",
        "Missing app, profile, duty, capability, population, field, purpose, tenant or owner evidence denies; cross-tenant and out-of-population objects are opaque 404.",
        "Default OFF produces zero PER-009 calls and no route, menu, provider, feature or tenant activation.",
        "IAQ-038 and BASE:team-performance remain PER-008-owned, action provenance grants no handler authority, and legacy goal read/progress receives no semantic mutation or recount.",
        "Only after a separate central execution authority creates clean Backend and Frontend worktrees and one-shot tokens may allowlisted source be authored.",
    ]
    require(
        successor.get("implementationGates")
        == [
            {"id": f"PER009-AUTH-GATE-{number:02d}", "criterion": criterion}
            for number, criterion in enumerate(expected_gate_criteria, start=1)
        ],
        "exact twelve implementation gates drift",
        failures,
    )
    require(
        successor.get("sequencing")
        == [
            "independently review this exact transport and authorization successor",
            "commit and push only the authority carrier on frontend dwp-dev",
            "issue a separate clean central Backend and Frontend worktree authority plus one-shot tokens",
            "implement and admit product authorization v63, Auth V273 and any changed unmounted frontend authorization mirror",
            "issue a central integration receipt while feature remains OFF with zero enrollment",
            "only then seal the exact PERFORMANCE V21 manifest and central allocator supersession",
            "issue separate V21 lease, PER-009 owner packet, module worktrees and executable token",
            "implement Goal commands and the twelve PER-009 acceptance conditions",
        ],
        "successor sequencing drift",
        failures,
    )

    validate_registry_lineage(successor, failures)
    validate_frontend_mirror(successor, failures)
    validate_pep_register(successor, failures)
    validate_migration_reservation(successor, failures)
    validate_allowlist(successor, failures)
    validate_authority(successor, failures)
    validate_review(successor, failures)

    payload = {
        "status": "PASS" if not failures else "FAIL",
        "sliceId": successor.get("sliceId"),
        "successor": SUCCESSOR_PATH.relative_to(FRONTEND).as_posix(),
        "review": REVIEW_PATH.relative_to(FRONTEND).as_posix(),
        "failureCount": len(failures),
        "failures": failures,
    }
    print(json.dumps(payload, indent=2, ensure_ascii=False))
    return 0 if not failures else 1


if __name__ == "__main__":
    sys.exit(main())
