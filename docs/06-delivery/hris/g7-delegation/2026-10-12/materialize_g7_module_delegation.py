#!/usr/bin/env python3
"""Materialize the immutable HRIS G7 delegation bundle and promotion receipt.

The bundle is intentionally evidence-only.  It never edits application code or
re-runs W1.  Phase ``bundle`` creates the sealed inputs for commit A.  Phase
``promotion`` is run after commit A and creates a receipt that activates only
the release-ready PER/TIM tokens without introducing a commit/hash cycle.
"""

from __future__ import annotations

import argparse
import copy
import csv
import hashlib
import io
import json
from collections import Counter
from pathlib import Path
from typing import Any


HERE = Path(__file__).resolve().parent
HRIS_ROOT = HERE.parents[1]
FRONTEND_ROOT = HERE.parents[4]
BACKEND_ROOT = FRONTEND_ROOT.parent / "backend"
AGENT_ROOT = Path("/Users/a10697/Work/DWP/dwp_agent")

PREFLIGHT = HRIS_ROOT / "2026-10-07-g7-module-delegation-preflight.json"
G5_RECEIPT = HRIS_ROOT / "2026-10-12-g5-integrated-stabilization-freeze-receipt.json"
STALE_OVERLAY = HRIS_ROOT / "current-slice-integration-status.v1.csv"
STALE_OVERLAY_EVIDENCE = HRIS_ROOT / "current-slice-integration-status.v1.evidence.json"
G6_RECEIPT = HRIS_ROOT / "2026-10-12-g6-w1-successor-receipt.json"
PROMOTION_RECEIPT = HRIS_ROOT / "2026-10-12-g7-evidence-promotion-and-delegation-receipt.json"
ROADMAP = HRIS_ROOT / "2026-10-12-g7-integration-roadmap-status.md"

PLAN = HERE / "delegation-plan.v1.json"
PACKET_SCHEMA = HERE / "contracts/g7-module-work-packet.schema.json"
TOKEN_SCHEMA = HERE / "contracts/g7-start-token.schema.json"
RECEIPT_SCHEMA = HERE / "contracts/g7-promotion-receipt.schema.json"
OVERLAY = HERE / "successor-slice-overlay.v1.csv"
OVERLAY_EVIDENCE = HERE / "successor-slice-overlay.evidence.v1.json"
LEASES = HERE / "migration-leases.v1.json"
CONTROL_REQUESTS = HERE / "control-requests.v1.json"
WORKTREES = HERE / "registers/module-worktrees.v1.csv"
CURRENT_STATE = HERE / "state/current-delegation.v1.json"
MANIFEST = HERE / "manifest.v1.json"
VALIDATOR = HERE / "validate_g7_module_delegation.py"

ISSUED_AT = "2026-10-12T10:45:00+09:00"
EXPIRES_AT = "2026-10-19T10:45:00+09:00"
PROMOTION_RECEIPT_ID = "HRIS-G7-EVIDENCE-PROMOTION-DELEGATION-20261012-R1"
EMPTY_STATE_SHA = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"

PINS = {
    "frontend": {
        "commit": "4546024ca9036f217c1d13ddb0622c21a3264b60",
        "tree": "8f2a3068f9efbca5daf77a5fdf7f0d7d1670976c",
        "stateSha256": EMPTY_STATE_SHA,
        "branch": "codex/hris-g1-integration-frontend-20261006",
        "upstream": "origin/codex/hris-g1-integration-frontend-20261006",
        "clean": True,
        "upstreamMatched": True,
    },
    "frontendSourceResult": {
        "commit": "c05ffa3f9d647968fdcb224ec51f811c7d2cc538",
        "tree": "761dd5e5ba232992dbac3a11fcd73ad2de787f24",
    },
    "backend": {
        "commit": "c0d72ca8e26a6e2a0b3885b62c0aa0e3ad7b1329",
        "tree": "099c88ee32c584764802f3efd77c23364c65b8c4",
        "stateSha256": EMPTY_STATE_SHA,
        "branch": "codex/hris-g1-integration-backend-20261006",
        "upstream": "origin/codex/hris-g1-integration-backend-20261006",
        "clean": True,
        "upstreamMatched": True,
    },
    "agent": {
        "commit": "1d46fc4ab49c604efb7464574c49d13ee453e059",
        "tree": "0b9a8dbfd828478ee825452e5aca8688c83e37ab",
        "stateSha256": EMPTY_STATE_SHA,
        "branch": "dwp-dev",
        "upstream": "origin/dwp-dev",
        "clean": True,
        "upstreamMatched": True,
        "hrisModuleSliceAuthority": False,
    },
}

AUTHORIZATION = {
    "version": 34,
    "semanticChecksum": "852d20e1e639e1a7170f02b5714d21d8c51a9eb8ff5ac32d8b7940b82d6be83b",
    "bundleSha256": "8edd29e91a915fc035028c44af4055673bf5e53c7a5ca77e2af381d69bc60135",
    "indexSha256": "9b47d5aac66ce2f8b035b49fbc5f77f2715f9e08a5733e4fe3739bbcba5bff28",
}

GATEWAY = {
    "sha256": "325fd7acfcf0ed42cd03db0105003c6a53d8434467e594e023d227c64b734856",
    "paths": 1664,
    "operations": 1904,
    "schemas": 3682,
    "frontendBackendBytesEqual": True,
}

EXPECTED_SHA = {
    "preflight": "5a95ded883cc520be5cf3705b26348972801f19f4565d65a2896e5515bf02e29",
    "g5Receipt": "4a5a3505414dbec26ea4ef35eb4b4371c9c765272a39285298f3374090ec58ae",
    "staleOverlay": "603f81f13f5168825468c18d9f5a04e4ca389288a121fe1ad33c21b2ff6812de",
    "staleOverlayEvidence": "d17ed348749715c660fae624e05e1df7dbee6adf6c4679c73b7c9883eab25047",
    "g3Manifest": "af5238d3610e96aeb12ce6376d37175d77ef65372be135369b9a5faeabe2de8e",
    "g3Ownership": "2ef33aaf3534859b92a5d68267ddadf3aab1fe94c8dab4fe321992740b3c3629",
    "sliceRegister": "fb646668329e93ca0b83b74e2a3e43619954cec1cb2f6770029677edbc8d5725",
    "dependencyRegister": "b8f1a11d1a32cf6f5a9a99ff73066b7e65787319ac18cf0d2b4891d22587c348",
    "targetFamily": "3e3618ff3ac150da8c9c7cbd3b1018e30e69652f28f3dbd8c87edb7df6a83819",
    "informationArchitecture": "ab506a2bb2f80c8ab81a4b9d575374d6bda83b312d11dce07495d4812bdf4686",
    "apiPep": "0e38d724516a8b271069241ffa0fb6400984dc703758767de53cbaffb4f93da3",
    "iaApiSuccessor": "5f47efd33a1d5aa3d11a4d9fd5716cd4e35650e9fec0868ecb77c8c90a4cd988",
    "iaRuntimeSuccessor": "fcdfd1a26d8fca2c8d9a2a8279a3c5a99844ba827aefe47cbac2210b8753f77a",
    "iaProjectionSchemas": "b185accd712216c39bf8a66f70cbbf0092a27a8c2c5e3d7457ecd4d511afa048",
    "iaActionKeys": "19a12600eb11e4d6c7c6098ad7f44f8afb544a1d9c698c3d2305e9e8150b5b7e",
}

G6_RAW = {
    "runDirectory": "output/hris-w1-synthetic-20261012t005606z-dd1c1db1",
    "runId": "w1-20261012t005606z-dd1c1db1",
    "result": {
        "bytes": 54891,
        "sha256": "0a4675a69a658b0fc7695877a267ff36f18b0a5820c865a9b55c2195d79969b1",
    },
    "manifest": {
        "bytes": 8918,
        "sha256": "fe1b549f3f31a9e14ec75e9c3c23b0f194b0a911e9b5bef5a21dbee80018f877",
    },
    "runtime": {
        "bytes": 21468,
        "sha256": "ff83fd941e7433ef9245d8b8f6de35e4722a710a7b32cdc3443152766a6ad145",
    },
    "frontendExecutableSha256": "05b6815688b061c7237d3ced2180215f268e3cb47cddb9bcea2b482765449048",
    "frontendCoreSha256": "f125751ee95d36ac9b0850ef8478d30ecae10c57c89bcc55f9f001d5d961a5f2",
    "backendRunnerSha256": "1a65e1a639f381bfb32094014691d07c4bad016098d4b4c4e7ae57284e60368b",
}

PRIOR_INTEGRATED = {
    "BASE-TFR-SYS-004",
    "BASE-TFR-HRM-004",
    "BASE-TFR-PER-005",
    "BASE-TFR-PAY-007",
    "BASE-TFR-TIM-016",
}
AUTHORIZED_SLICES = {"BASE-TFR-PER-006", "BASE-TFR-TIM-006"}
PREPARED_WITHHELD_SLICES = {"BASE-TFR-SYS-007", "BASE-TFR-HRM-010"}
DEPENDENCY_HELD_SLICES = {"MOD-PER-COMPPLAN", "BASE-TFR-PAY-016"}

OVERLAY_EXTRA_FIELDS = [
    "g7_classification",
    "g7_authority",
    "g7_packet_id",
    "g7_start_token_id",
    "g7_dependency_result_pins",
    "g7_producer_result_pins",
    "g7_migration_lease_id",
    "g7_touch_policy_digest",
    "g7_evidence_refs",
    "g7_authority_note",
]


def sha256_bytes(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def file_sha(path: Path) -> str:
    return sha256_bytes(path.read_bytes())


def repo_path(path: Path) -> str:
    return path.resolve().relative_to(FRONTEND_ROOT.resolve()).as_posix()


def json_bytes(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def canonical_bytes(value: Any) -> bytes:
    return json.dumps(
        value, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")


def sealed(value: dict[str, Any]) -> dict[str, Any]:
    result = copy.deepcopy(value)
    result.pop("sealedPayloadSha256", None)
    result["sealedPayloadSha256"] = sha256_bytes(canonical_bytes(result))
    return result


def pin(path: Path) -> dict[str, Any]:
    raw = path.read_bytes()
    return {"path": repo_path(path), "bytes": len(raw), "sha256": sha256_bytes(raw)}


def read_json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"JSON root must be an object: {path}")
    return value


def packet_id(module: str, slice_id: str) -> str:
    return f"G7-PACKET-{module}-{slice_id}-R1"


def token_id(module: str, slice_id: str) -> str:
    return f"G7-START-{module}-{slice_id}-R1"


def module_configuration() -> dict[str, dict[str, Any]]:
    return {
        "SYS": {
            "sliceId": "BASE-TFR-SYS-007",
            "sessionId": "HRIS-SYS",
            "lifecycleState": "PACKET_PREPARED_START_WITHHELD",
            "sourceChangeAuthorized": False,
            "migrationLeaseId": "G7-LEASE-SYS-PLATFORM-V325-R1",
            "migration": {
                "stream": "PLATFORM_MAIN",
                "streamRoot": "dwp-platform-server/src/main/resources/db/migration",
                "frozenHighWater": 324,
                "version": 325,
                "exactRelativePath": "dwp-platform-server/src/main/resources/db/migration/V325__create_hris_reference_configuration_lifecycle.sql",
                "status": "RESERVED_CONTROL_ONLY",
                "schemaEffect": [
                    "reference configuration lifecycle set and version records",
                    "evaluation evidence and immutable command receipts",
                    "outbox and audit controls; no duplicate raw reference-data store",
                ],
            },
            "allowedPaths": [
                "backend:dwp-platform-server/src/main/java/com/dwp/services/platform/hrisconfiguration/referenceconfiguration/**",
                "backend:dwp-platform-server/src/test/java/com/dwp/services/platform/hrisconfiguration/referenceconfiguration/**",
                "frontend:apps/dwp/src/features/hris/administration/reference-configuration/**",
            ],
            "protectedPaths": [
                "backend:dwp-platform-server/src/main/java/com/dwp/services/platform/hrisconfiguration/HrisConfigurationProjectionController.java",
                "backend:dwp-platform-server/src/main/java/com/dwp/services/platform/hrisconfiguration/HrisConfigurationProjectionDtos.java",
                "backend:dwp-platform-server/src/main/java/com/dwp/services/platform/hrisconfiguration/HrisConfigurationProjectionService.java",
                "backend:dwp-platform-server/src/test/java/com/dwp/services/platform/hrisconfiguration/HrisConfigurationProjectionControllerContractTest.java",
                "backend:dwp-platform-server/src/test/java/com/dwp/services/platform/hrisconfiguration/HrisConfigurationProjectionServiceTest.java",
                "backend:dwp-platform-server/src/main/java/com/dwp/services/platform/reference/**",
                "backend:dwp-people-server/src/main/java/com/dwp/services/people/workforce/WorkforceReference*",
                "frontend:apps/dwp/src/features/workforce/workforce-reference-data.tsx",
                "frontend:apps/dwp/src/features/admin/reference-data-*.ts*",
                "frontend:apps/dwp/src/features/hris/administration/system-access/**",
            ],
            "controlRequestIds": [
                "G7-CR-SYS-007-AUTH-PEP-R1",
                "G7-CR-SYS-007-CONTRACT-GATEWAY-R1",
                "G7-CR-SYS-007-SHELL-ROUTE-R1",
                "G7-CR-SYS-007-SECURITY-BRIDGE-R1",
            ],
            "releaseConditions": [
                "Pin product-authorization successor and generated Platform PEP/auth fixtures for IAQ-052 and all eleven PEP operations.",
                "Pin Gateway/OpenAPI/contract export and frontend sync without changing the frozen source contract semantics.",
                "Pin the shared /hr/settings/reference-data route, navigation, shell and i18n composition; keep /hr/data/reference distinct.",
                "Pin any exact PlatformSecurityFilter bridge as a Control-owned change; broad /v1/admin bypass is forbidden.",
            ],
            "featureFlag": "dwp.hris.reference-configuration.enabled",
            "userOutcome": {
                "primaryUser": "HRIS configuration administrator",
                "operationalQuestion": "Which reference-configuration version is safe to publish, retire or roll back?",
                "primaryAction": "validate, simulate, approve, publish, retire or roll back a version",
                "outcome": "an immutable lifecycle receipt while domain content remains with its existing owner",
                "pageArchetype": "studio",
            },
            "systemOfRecord": "dwp-platform-server owns lifecycle metadata and content references only; existing domain-content owners remain authoritative.",
            "moduleCommands": [
                ["./gradlew", ":dwp-platform-server:test", "--tests", "*ReferenceConfiguration*", "--tests", "*SysIaEntryQueryContractTest", "-PhrisSlice=BASE-TFR-SYS-007", "--no-daemon"],
                ["yarn", "vitest", "run", "apps/dwp/src/features/hris/administration/reference-configuration"],
            ],
        },
        "HRM": {
            "sliceId": "BASE-TFR-HRM-010",
            "sessionId": "HRIS-HRM",
            "lifecycleState": "PACKET_PREPARED_START_WITHHELD",
            "sourceChangeAuthorized": False,
            "migrationLeaseId": "G7-LEASE-HRM-PEOPLE-V54-R1",
            "migration": {
                "stream": "PEOPLE_MAIN",
                "streamRoot": "dwp-people-server/src/main/resources/db/migration",
                "frozenHighWater": 53,
                "version": 54,
                "exactRelativePath": "dwp-people-server/src/main/resources/db/migration/V54__create_employee_change_request_lifecycle.sql",
                "status": "RESERVED_CONTROL_ONLY",
                "schemaEffect": [
                    "employee-change request and frozen patch evidence",
                    "approval decision inbox and immutable command receipts",
                    "transactional outbox; no assignment-proposal table changes",
                ],
            },
            "allowedPaths": [
                "backend:dwp-people-server/src/main/java/com/dwp/services/people/hris/employeeservice/employeechange/**",
                "backend:dwp-people-server/src/test/java/com/dwp/services/people/hris/employeeservice/employeechange/**",
                "frontend:apps/dwp/src/features/hris/employee-services/employee-change/**",
            ],
            "protectedPaths": [
                "backend:dwp-people-server/src/main/java/com/dwp/services/people/hr/assignment/**",
                "backend:dwp-people-server/src/main/resources/db/migration/V53__create_assignment_change_proposals.sql",
                "backend:dwp-people-server/src/main/java/com/dwp/services/people/hris/people/**",
                "frontend:apps/dwp/src/features/hris/employment/assignment-proposal-*.ts*",
                "frontend:libs/shared-utils/src/api/assignment-proposal-api.ts",
                "frontend:apps/dwp/src/features/hris/people/**",
                "backend:dwp-people-server/src/main/java/com/dwp/services/people/security/PeopleSecurityFilter.java",
                "backend:dwp-people-server/src/test/java/com/dwp/services/people/security/PeopleSecurityFilterTest.java",
            ],
            "controlRequestIds": [
                "G7-CR-HRM-010-EVENT-CONTRACT-R1",
                "G7-CR-HRM-010-AUTH-PEP-R1",
                "G7-CR-HRM-010-CONTRACT-GATEWAY-R1",
                "G7-CR-HRM-010-SHELL-ROUTE-R1",
                "G7-CR-HRM-010-APPROVAL-CALLBACK-R1",
                "G7-CR-HRM-010-APPROVAL-CASE-HANDOFF-R1",
            ],
            "releaseConditions": [
                "Pin generated EmployeeChangeApplied.v1 contracts and provider/consumer tests; local shadow DTO/event types are forbidden.",
                "Pin product authorization, canonical /api/people/v1 forwarding and shared shell/route/i18n composition; no /api/hris/v1 alias.",
                "Pin the Approval-to-People callback producer with workload identity, tenant revalidation, purpose binding, inbox idempotency and no-self-approval.",
                "Define and pin a People-to-Approval create/submit owner contract including owner path, workload auth, tenant/purpose, idempotency and failure semantics; browser APIs and user credentials are forbidden substitutes.",
                "Pin the exact PeopleSecurityFilter bridge as a Control-owned file change.",
            ],
            "featureFlag": "dwp.hris.employee-change.enabled",
            "userOutcome": {
                "primaryUser": "HR operations specialist and independent approver",
                "operationalQuestion": "Which employee changes are ready to submit, decide and apply?",
                "primaryAction": "create, submit, independently decide and apply an employee change",
                "outcome": "an effective employee change with immutable evidence and no self-approval",
                "pageArchetype": "workflow",
            },
            "systemOfRecord": "dwp-people-server employee-change family; assignment proposals and People 360 remain separate protected owners.",
            "moduleCommands": [
                ["./gradlew", ":dwp-people-server:test", "--tests", "*EmployeeChange*", "--tests", "*HrmIaEntryQueryContractTest", "-PhrisSlice=BASE-TFR-HRM-010", "--no-daemon"],
                ["yarn", "vitest", "run", "apps/dwp/src/features/hris/employee-services/employee-change"],
            ],
        },
        "PER": {
            "sliceId": "BASE-TFR-PER-006",
            "sessionId": "HRIS-PER",
            "lifecycleState": "PACKET_AUTHORIZED_DOMAIN_AUTHORING",
            "sourceChangeAuthorized": True,
            "migrationLeaseId": "G7-LEASE-PER-PERFORMANCE-V2-R1",
            "migration": {
                "stream": "PEOPLE_PERFORMANCE",
                "streamRoot": "dwp-people-server/src/main/resources/db/performance-migration",
                "frozenHighWater": 1,
                "version": 2,
                "exactRelativePath": "dwp-people-server/src/main/resources/db/performance-migration/V2__per_create_population_freeze.sql",
                "status": "ADMITTED_DOMAIN_AUTHORING",
                "schemaEffect": [
                    "immutable population freeze and member/reviewer snapshots",
                    "tenant RLS, append-only guards, foreign keys and deterministic indexes",
                    "receipt/outbox integration without changing V1 preview semantics",
                ],
            },
            "allowedPaths": [
                "backend:dwp-people-server/src/main/java/com/dwp/services/people/hr/performance/populationfreeze/**",
                "backend:dwp-people-server/src/test/java/com/dwp/services/people/hr/performance/populationfreeze/**",
                "backend:dwp-people-server/src/main/resources/db/performance-migration/V2__per_create_population_freeze.sql",
                "frontend:apps/dwp/src/features/hris/performance/population-freeze/**",
            ],
            "protectedPaths": [
                "backend:dwp-people-server/src/main/java/com/dwp/services/people/hr/performance/PerformanceParticipantPreviewService.java",
                "backend:dwp-people-server/src/main/java/com/dwp/services/people/hr/performance/PerformancePopulationRuleEvaluator.java",
                "backend:dwp-people-server/src/main/java/com/dwp/services/people/hr/performance/PerformanceCycleService.java",
                "backend:dwp-people-server/src/main/java/com/dwp/services/people/hr/performance/PerformanceCycleCommandRepository.java",
                "backend:dwp-people-server/src/main/java/com/dwp/services/people/hr/performance/PerformanceCycleDtos.java",
                "backend:dwp-people-server/src/main/java/com/dwp/services/people/hr/performance/PerformanceCycleController.java",
                "backend:dwp-people-server/src/main/resources/db/performance-migration/V1__per_create_evaluation_cycle_foundation.sql",
                "frontend:apps/dwp/src/features/hris/performance/api/performance-cycle-api.ts",
                "frontend:apps/dwp/src/features/hris/performance/model/performance-cycle-contract.ts",
                "frontend:apps/dwp/src/features/hris/performance/index.ts",
            ],
            "controlRequestIds": [
                "G7-CR-PER-006-AUTH-PEP-R1",
                "G7-CR-PER-006-CONTRACT-GATEWAY-R1",
                "G7-CR-PER-006-SHELL-ROUTE-R1",
                "G7-CR-PER-006-INTEGRATION-VERIFY-R1",
            ],
            "releaseConditions": [],
            "featureFlag": "dwp.hris.performance.population-freeze.enabled",
            "userOutcome": {
                "primaryUser": "performance operations lead",
                "operationalQuestion": "Is the reviewed participant population complete and safe to freeze?",
                "primaryAction": "inspect the existing preview and freeze the exact population revision",
                "outcome": "an immutable population snapshot, receipt and PerformancePopulationFrozen.v1 fact",
                "pageArchetype": "studio",
            },
            "systemOfRecord": "dwp-people-server performance owner; the existing preview remains authoritative and unchanged.",
            "moduleCommands": [
                ["./gradlew", ":dwp-people-server:test", "--tests", "com.dwp.services.people.hr.performance.populationfreeze.*"],
                ["./gradlew", ":dwp-people-server:test", "--tests", "*PerformanceParticipantPreviewServiceTest", "--tests", "*PerformanceCycleServiceTest"],
                ["yarn", "vitest", "run", "apps/dwp/src/features/hris/performance/population-freeze", "apps/dwp/src/features/hris/performance/api/performance-cycle-api.test.ts", "apps/dwp/src/features/hris/performance/model/performance-cycle-contract.test.ts"],
            ],
        },
        "TIM": {
            "sliceId": "BASE-TFR-TIM-006",
            "sessionId": "HRIS-TIM",
            "lifecycleState": "PACKET_AUTHORIZED_DOMAIN_AUTHORING",
            "sourceChangeAuthorized": True,
            "migrationLeaseId": "G7-LEASE-TIM-TIME-V8-R1",
            "migration": {
                "stream": "TIME_MAIN",
                "streamRoot": "dwp-time-server/src/main/resources/db/migration",
                "frozenHighWater": 7,
                "version": 8,
                "exactRelativePath": "dwp-time-server/src/main/resources/db/migration/V8__tim_create_clock_ingestion.sql",
                "status": "ADMITTED_DOMAIN_AUTHORING",
                "schemaEffect": [
                    "immutable clock source, event, corrective void and finding records",
                    "tenant RLS, append-only guards, one-void-per-event uniqueness and provenance/order indexes",
                    "receipt, outbox, audit and projection storage without touching work-regime or absence tables",
                ],
            },
            "allowedPaths": [
                "backend:dwp-time-server/src/main/java/com/dwp/services/time/clockingestion/**",
                "backend:dwp-time-server/src/test/java/com/dwp/services/time/clockingestion/**",
                "backend:dwp-time-server/src/main/resources/db/migration/V8__tim_create_clock_ingestion.sql",
                "frontend:apps/dwp/src/features/hris/time/clock-ingestion/**",
            ],
            "protectedPaths": [
                "backend:dwp-time-server/src/main/java/com/dwp/services/time/workregime/**",
                "backend:dwp-time-server/src/main/java/com/dwp/services/time/absence/**",
                "backend:dwp-time-server/src/main/resources/db/migration/V1__tim_create_work_regime_foundation.sql",
                "backend:dwp-time-server/src/main/resources/db/migration/V2__tim_create_target_population_authority_projection.sql",
                "backend:dwp-time-server/src/main/resources/db/migration/V3__tim_create_command_target_authority_evidence.sql",
                "backend:dwp-time-server/src/main/resources/db/migration/V4__tim_harden_sod_and_projection_locks.sql",
                "backend:dwp-time-server/src/main/resources/db/migration/V5__tim_authorize_projection_publisher.sql",
                "backend:dwp-time-server/src/main/resources/db/migration/V6__tim_adopt_derived_hcm_scope_keys.sql",
                "backend:dwp-time-server/src/main/resources/db/migration/V7__tim_harden_owner_trigger_boundaries.sql",
                "frontend:apps/dwp/src/features/hris/time/api/hris-time-work-plan-*.ts",
                "frontend:apps/dwp/src/features/hris/time/components/hris-time-work-plan-studio.tsx",
                "frontend:apps/dwp/src/features/hris/time/model/hris-time-work-plan-*.ts",
            ],
            "controlRequestIds": [
                "G7-CR-TIM-006-AUTH-PEP-R1",
                "G7-CR-TIM-006-CONTRACT-GATEWAY-R1",
                "G7-CR-TIM-006-SHELL-ROUTES-R1",
                "G7-CR-TIM-006-INTEGRATION-VERIFY-R1",
            ],
            "releaseConditions": [],
            "featureFlag": "dwp.hris.time.clock-ingestion.enabled",
            "userOutcome": {
                "primaryUser": "time operations specialist",
                "operationalQuestion": "Which clock events were accepted, rejected or require a corrective void?",
                "primaryAction": "ingest a provenance-bound clock event or append an authorized void",
                "outcome": "ordered immutable clock evidence and ClockEventRecorded.v1 publication",
                "pageArchetype": "command center",
            },
            "systemOfRecord": "dwp-time-server clock-ingestion family; work-regime and absence owners remain protected.",
            "moduleCommands": [
                ["./gradlew", ":dwp-time-server:test", "--tests", "com.dwp.services.time.clockingestion.*"],
                ["yarn", "vitest", "run", "apps/dwp/src/features/hris/time/clock-ingestion"],
            ],
        },
    }


MODULE_SOURCE_EVIDENCE = {
    "PER": [
        ("docs/06-delivery/hris/recovery/hris-porting-blueprint-2026-09-09/session-evidence/per/g2-readiness/api-event-contracts.yaml", "559c345"),
        ("docs/06-delivery/hris/recovery/hris-porting-blueprint-2026-09-09/session-evidence/per/g2-readiness/physical-schema.sql", "009954"),
        ("docs/06-delivery/hris/recovery/hris-porting-blueprint-2026-09-09/session-evidence/per/g2-readiness/authorization-field-policy.md", "494733"),
        ("docs/06-delivery/hris/recovery/hris-porting-blueprint-2026-09-09/session-evidence/per/g2-readiness/state-guard-idempotency-recovery.md", "ab6000"),
    ],
    "TIM": [
        ("docs/06-delivery/hris/recovery/hris-porting-blueprint-2026-09-09/session-evidence/tim/g2-api-event-contracts.json", "125136"),
        ("docs/06-delivery/hris/recovery/hris-porting-blueprint-2026-09-09/session-evidence/tim/g2-physical-schema.sql", "01325e"),
        ("docs/06-delivery/hris/recovery/hris-porting-blueprint-2026-09-09/session-evidence/tim/g2-authorization.md", "205779"),
        ("docs/06-delivery/hris/recovery/hris-porting-blueprint-2026-09-09/session-evidence/tim/g2-runtime-controls.md", "9d55b2"),
    ],
}


def common_control_paths(preflight: dict[str, Any]) -> list[str]:
    paths: list[str] = []
    for repo in ("backend", "frontend"):
        paths.extend(
            f"{repo}:{path}"
            for path in preflight["commonControlOnlyPaths"][repo]
        )
    return paths


def build_g6_receipt(g6_root: Path) -> dict[str, Any]:
    result_path = g6_root / "result.json"
    manifest_path = g6_root / "checkpoint/manifest.json"
    runtime_path = g6_root / "runtime.json"
    for path, expected in (
        (result_path, G6_RAW["result"]),
        (manifest_path, G6_RAW["manifest"]),
        (runtime_path, G6_RAW["runtime"]),
    ):
        raw = path.read_bytes()
        if len(raw) != expected["bytes"] or sha256_bytes(raw) != expected["sha256"]:
            raise ValueError(f"G6 raw evidence drift: {path}")
    result = read_json(result_path)
    checkpoint = read_json(manifest_path)
    phase_counts = Counter(phase["status"] for phase in result["phases"])
    assertion_counts = Counter(item["status"] for item in checkpoint["assertions"])
    if result["runId"] != G6_RAW["runId"] or phase_counts != {"PASS": 28}:
        raise ValueError("G6 result is not the exact 28/28 PASS run")
    if checkpoint["runId"] != G6_RAW["runId"] or assertion_counts != {"PASS": 15}:
        raise ValueError("G6 checkpoint is not the exact 15/15 PASS run")
    secret_phases = {
        phase["name"]: phase
        for phase in result["phases"]
        if phase["name"] in {"evidence-secret-scan", "final-result-secret-scan"}
    }
    return sealed({
        "schema": "dwp.hris.g6-w1-successor-receipt.v1",
        "receiptId": "HRIS-G6-W1-SUCCESSOR-RECEIPT-20261012-R1",
        "issuedAt": ISSUED_AT,
        "issuedBy": "SYS_COMMON_INTEGRATION_CONTROL",
        "status": "PASS",
        "decision": "G7_EVIDENCE_PROMOTION_AUTHORIZED",
        "completionMeaning": "The exactly-once full-mode W1 successor passed on the frozen frontend/backend pair with 28/28 phases, 15/15 checkpoint assertions, verified rollback and clean teardown.",
        "sourcePins": PINS,
        "rawEvidence": {
            "locator": f"backend:{G6_RAW['runDirectory']}",
            "result": {"path": "result.json", **G6_RAW["result"]},
            "checkpointManifest": {"path": "checkpoint/manifest.json", **G6_RAW["manifest"]},
            "runtime": {"path": "runtime.json", **G6_RAW["runtime"]},
        },
        "execution": {
            "runId": result["runId"],
            "scope": result["scope"],
            "executionCount": 1,
            "startedAt": result["startedAt"],
            "finishedAt": result["finishedAt"],
            "phasesPassed": 28,
            "phasesTotal": 28,
            "status": result["status"],
        },
        "checkpoint": {
            "status": checkpoint["status"],
            "assertionsPassed": 15,
            "assertionsTotal": 15,
            "frontendCommit": checkpoint["provenance"]["frontend"]["gitHead"],
            "frontendClean": checkpoint["provenance"]["frontend"]["clean"],
            "activeAuthorization": checkpoint["activeBundle"],
            "rawHarDeleted": checkpoint["provenance"]["browser"]["rawHarDeleted"],
        },
        "rollbackAndCleanup": {
            "rollbackComplete": result["rollbackComplete"],
            "activeBundleAtFinish": result["activeBundleAtFinish"],
            "teardownVerifiedClean": result["teardown"]["verifiedClean"],
            "errors": result["teardown"]["errors"],
            "residuals": result["teardown"]["residuals"],
        },
        "security": {
            "syntheticOnly": result["syntheticOnly"],
            "customerDataUsed": result["customerDataUsed"],
            "productionActivationPerformed": result["productionActivationPerformed"],
            "evidenceSecretScanFindings": secret_phases["evidence-secret-scan"]["details"]["findings"],
            "finalResultSecretScanFindings": secret_phases["final-result-secret-scan"]["details"]["findings"],
        },
        "executables": {
            "frontendExecutableSha256": G6_RAW["frontendExecutableSha256"],
            "frontendCoreSha256": G6_RAW["frontendCoreSha256"],
            "backendRunnerSha256": G6_RAW["backendRunnerSha256"],
            "gatewayOpenApi": GATEWAY,
        },
        "authority": {
            "g6Complete": True,
            "g7EvidencePromotionAuthorized": True,
            "modulePacketIssuanceAuthorized": False,
            "moduleParallelDevelopmentAuthorized": False,
            "migrationAdmissionAuthorized": False,
            "customerActivationAuthorized": False,
            "productionReleaseAuthorized": False,
            "startTokensIssued": [],
        },
        "exclusions": [
            "This receipt does not itself issue a module packet, start token or migration admission.",
            "This receipt does not authorize customer data, customer activation or production release.",
            "The W1 run is not re-executed by G7.",
        ],
        "nextGate": {
            "id": "G7_EVIDENCE_PROMOTION_AND_DELEGATION_DECISION",
            "status": "AUTHORIZED",
        },
    })


def schemas() -> dict[Path, bytes]:
    packet = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "$id": "dwp.hris.g7-module-work-packet.schema.v1",
        "type": "object",
        "required": ["schema", "packetId", "module", "slice", "lifecycleState", "basePins", "pathPolicy", "migrationLease", "authority", "sealedPayloadSha256"],
        "properties": {
            "schema": {"const": "dwp.hris.g7-module-work-packet.v1"},
            "lifecycleState": {"enum": ["PACKET_PREPARED_START_WITHHELD", "PACKET_AUTHORIZED_DOMAIN_AUTHORING"]},
            "startTokenId": {"type": ["string", "null"]},
            "sealedPayloadSha256": {"type": "string", "pattern": "^[0-9a-f]{64}$"},
        },
        "allOf": [{
            "if": {"properties": {"lifecycleState": {"const": "PACKET_AUTHORIZED_DOMAIN_AUTHORING"}}},
            "then": {"properties": {"startTokenId": {"type": "string"}}},
            "else": {"properties": {"startTokenId": {"type": "null"}}},
        }],
        "additionalProperties": True,
    }
    token = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "$id": "dwp.hris.g7-start-token.schema.v1",
        "type": "object",
        "required": ["schema", "tokenId", "packetId", "packetFileSha256", "sliceId", "module", "state", "worktreeBindings", "authority", "sealedPayloadSha256"],
        "properties": {
            "schema": {"const": "dwp.hris.g7-module-start-token.v1"},
            "state": {"const": "ISSUED_PENDING_PROMOTION_RECEIPT"},
            "module": {"enum": ["PER", "TIM"]},
            "sealedPayloadSha256": {"type": "string", "pattern": "^[0-9a-f]{64}$"},
        },
        "additionalProperties": True,
    }
    receipt = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "$id": "dwp.hris.g7-promotion-receipt.schema.v1",
        "type": "object",
        "required": ["schema", "receiptId", "status", "bundleCommit", "delegations", "withheld", "authority", "sealedPayloadSha256"],
        "properties": {
            "schema": {"const": "dwp.hris.g7-evidence-promotion-and-delegation-receipt.v1"},
            "status": {"const": "PASS_SCOPED_DELEGATION"},
            "sealedPayloadSha256": {"type": "string", "pattern": "^[0-9a-f]{64}$"},
        },
        "additionalProperties": True,
    }
    return {
        PACKET_SCHEMA: json_bytes(packet),
        TOKEN_SCHEMA: json_bytes(token),
        RECEIPT_SCHEMA: json_bytes(receipt),
    }


def control_requests(config: dict[str, dict[str, Any]]) -> dict[str, Any]:
    descriptions = {
        "G7-CR-SYS-007-AUTH-PEP-R1": "Publish product-authorization successor and generated Platform PEP/auth fixtures for IAQ-052 and the eleven SYS lifecycle operations.",
        "G7-CR-SYS-007-CONTRACT-GATEWAY-R1": "Publish Gateway/OpenAPI/contract export and frontend API sync for canonical Platform paths.",
        "G7-CR-SYS-007-SHELL-ROUTE-R1": "Compose /hr/settings/reference-data in shared navigation, shell, page and i18n without relabeling /hr/data/reference.",
        "G7-CR-SYS-007-SECURITY-BRIDGE-R1": "Implement only the exact generated Platform security bridge; generic admin bypass remains forbidden.",
        "G7-CR-HRM-010-EVENT-CONTRACT-R1": "Generate and pin EmployeeChangeApplied.v1 plus provider/consumer tests and OpenAPI/AsyncAPI/frontend sync.",
        "G7-CR-HRM-010-AUTH-PEP-R1": "Publish product authorization and People PEP fixtures for IAQ-009 and create/submit/apply operations.",
        "G7-CR-HRM-010-CONTRACT-GATEWAY-R1": "Publish canonical /api/people/v1 Gateway projection with no /api/hris/v1 alias.",
        "G7-CR-HRM-010-SHELL-ROUTE-R1": "Compose the employee-change workflow in shared navigation, shell, page and i18n.",
        "G7-CR-HRM-010-APPROVAL-CALLBACK-R1": "Implement the Approval-to-People callback producer/client and exact workload/tenant/purpose security bridge.",
        "G7-CR-HRM-010-APPROVAL-CASE-HANDOFF-R1": "Define and implement the missing People-to-Approval approval-case create/submit owner contract and provider/consumer tests.",
        "G7-CR-PER-006-AUTH-PEP-R1": "Publish additive performance population-freeze product authorization and People PEP projections.",
        "G7-CR-PER-006-CONTRACT-GATEWAY-R1": "After the module result, export OpenAPI/AsyncAPI/Gateway and sync generated frontend contracts.",
        "G7-CR-PER-006-SHELL-ROUTE-R1": "After the module result, mount /hr/operations/performance/review-operations through Control-owned shell paths.",
        "G7-CR-PER-006-INTEGRATION-VERIFY-R1": "Run focused shared route/access/contract checks after module result integration.",
        "G7-CR-TIM-006-AUTH-PEP-R1": "Publish additive clock-ingestion product authorization and Time PEP projections.",
        "G7-CR-TIM-006-CONTRACT-GATEWAY-R1": "After the module result, export OpenAPI/AsyncAPI/Gateway and sync generated frontend contracts.",
        "G7-CR-TIM-006-SHELL-ROUTES-R1": "After the module result, mount clock-ingestion and time-exceptions routes through Control-owned shell paths.",
        "G7-CR-TIM-006-INTEGRATION-VERIFY-R1": "Run focused shared route/access/contract checks after module result integration.",
    }
    requests = []
    for module, spec in config.items():
        for request_id in spec["controlRequestIds"]:
            requests.append({
                "requestId": request_id,
                "module": module,
                "sliceId": spec["sliceId"],
                "owner": "SYS_COMMON_INTEGRATION_CONTROL",
                "state": "PRE_START_REQUIRED_NOT_IMPLEMENTED" if module in {"SYS", "HRM"} else "ISSUED_POST_MODULE_RESULT_REQUIRED",
                "description": descriptions[request_id],
                "moduleDirectEditAuthorized": False,
                "customerActivationAuthorized": False,
                "productionReleaseAuthorized": False,
            })
    return sealed({
        "schema": "dwp.hris.g7-control-request-register.v1",
        "issuedAt": ISSUED_AT,
        "issuedBy": "SYS_COMMON_INTEGRATION_CONTROL",
        "requests": requests,
        "rule": "Request IDs assign common-path work to Control; they never grant module agents direct access to common paths.",
    })


def migration_leases(config: dict[str, dict[str, Any]]) -> dict[str, Any]:
    rows = []
    for module, spec in config.items():
        migration = spec["migration"]
        rows.append(sealed({
            "leaseId": spec["migrationLeaseId"],
            "module": module,
            "sliceId": spec["sliceId"],
            "stream": migration["stream"],
            "streamRoot": migration["streamRoot"],
            "frozenBackendCommit": PINS["backend"]["commit"],
            "frozenHighWater": migration["frozenHighWater"],
            "version": migration["version"],
            "exactRelativePath": migration["exactRelativePath"],
            "schemaEffect": migration["schemaEffect"],
            "status": migration["status"],
            "ownerTokenId": token_id(module, spec["sliceId"]) if spec["sourceChangeAuthorized"] else None,
            "reservedForPacketId": packet_id(module, spec["sliceId"]),
            "issuedAt": ISSUED_AT,
            "expiresAt": EXPIRES_AT,
            "invalidationConditions": [
                "frozen backend base commit or migration high-water changes",
                "another migration claims the exact version or path",
                "packet or token expires, is revoked or changes scope",
            ],
            "migrationAdmissionAuthorized": spec["sourceChangeAuthorized"],
        }))
    return sealed({
        "schema": "dwp.hris.g7-migration-lease-register.v1",
        "issuedAt": ISSUED_AT,
        "leases": rows,
        "historicalRangesAreAuthority": False,
        "openEndedVersionsAllowed": False,
    })


def dependency_pins(candidate: dict[str, Any]) -> list[dict[str, Any]]:
    rows = []
    for dependency_id in candidate["dependencyIds"]:
        if dependency_id in {"DEP-001", "DEP-002"}:
            result_pin = f"AUTHORIZATION_V34:{AUTHORIZATION['semanticChecksum']}"
        elif dependency_id in {"DEP-003", "DEP-016"}:
            result_pin = f"BACKEND_G5:{PINS['backend']['commit']}|G6:{G6_RAW['runId']}"
        elif dependency_id == "DEP-006":
            result_pin = f"CONNECTOR_POLICY_BASE:{PINS['backend']['commit']}|G6:{G6_RAW['runId']}"
        elif dependency_id == "DEP-004":
            result_pin = f"CONFIG_LIFECYCLE_CONTRACT_BASE:{PINS['backend']['commit']}"
        else:
            result_pin = f"FROZEN_BASE:{PINS['backend']['commit']}"
        rows.append({
            "dependencyId": dependency_id,
            "state": "READY_AT_FROZEN_BASE",
            "authoritySha256": EXPECTED_SHA["dependencyRegister"],
            "resultPin": result_pin,
        })
    return rows


def module_source_pins(module: str) -> list[dict[str, Any]]:
    result = []
    for path_string, expected_prefix in MODULE_SOURCE_EVIDENCE.get(module, []):
        path = FRONTEND_ROOT / path_string
        actual = file_sha(path)
        if not actual.startswith(expected_prefix):
            raise ValueError(f"module source evidence drift: {path_string}")
        result.append({"path": path_string, "bytes": path.stat().st_size, "sha256": actual})
    return result


def packet_acceptance(module: str) -> list[dict[str, Any]]:
    common = [
        {"id": "AC-AUTHZ", "criterion": "Bound capability, population and field decisions allow only the intended tenant scope; denied cases disclose no protected data."},
        {"id": "AC-IDEMPOTENCY", "criterion": "A repeated idempotency key with the same digest returns the original receipt and a mismatched payload fails closed."},
        {"id": "AC-RECOVERY", "criterion": "A worker crash or replay cannot duplicate the immutable receipt or published fact."},
        {"id": "AC-MIGRATION", "criterion": "Clean install and upgrade through the exact leased migration pass with tenant RLS/backfill and forward-fix evidence."},
        {"id": "AC-FLAG", "criterion": "The feature flag is default OFF; disabled tenants receive the canonical unavailable/denied state."},
        {"id": "AC-TELEMETRY", "criterion": "Correlation, audit and failure telemetry contain no raw sensitive identifiers."},
    ]
    specific = {
        "SYS": [
            {"id": "AC-SYS-OWNER", "criterion": "Lifecycle metadata stores only a content reference and digest; no second raw reference-data writer is introduced."},
            {"id": "AC-SYS-LIFECYCLE", "criterion": "Validate, simulate, submit, approve, schedule, publish, rollback and retire preserve immutable evidence and SoD."},
        ],
        "HRM": [
            {"id": "AC-HRM-GOLDEN", "criterion": "Create, submit, independent decision and apply complete with a single immutable EmployeeChangeApplied.v1 fact."},
            {"id": "AC-HRM-NO-SELF", "criterion": "Requester self-approval, stale evidence and cross-tenant decisions fail closed."},
        ],
        "PER": [
            {"id": "AC-PER-PREVIEW", "criterion": "The existing preview remains byte/semantic compatible and is never mutated by freeze."},
            {"id": "AC-PER-FREEZE", "criterion": "Freeze binds cycle/workforce revisions and content hash, persists immutable members/reviewers and publishes PerformancePopulationFrozen.v1 transactionally."},
        ],
        "TIM": [
            {"id": "AC-TIM-PROVENANCE", "criterion": "Clock ingest binds instant, local time, IANA zone, UTC offset, DST resolution, tzdb/rule version, source and device provenance."},
            {"id": "AC-TIM-VOID", "criterion": "A void is a step-up-protected corrective append-only fact; the original clock event is never updated or deleted."},
        ],
    }
    return common + specific[module]


def build_packets(
    preflight: dict[str, Any],
    config: dict[str, dict[str, Any]],
    controls_sha: str,
    leases_obj: dict[str, Any],
    g6_receipt_sha: str,
) -> tuple[dict[str, dict[str, Any]], dict[str, bytes]]:
    candidates = {row["module"]: row for row in preflight["candidates"]}
    control_only = common_control_paths(preflight)
    lease_by_module = {row["module"]: row for row in leases_obj["leases"]}
    objects: dict[str, dict[str, Any]] = {}
    rendered: dict[str, bytes] = {}
    for module in ("SYS", "HRM", "PER", "TIM"):
        spec = config[module]
        candidate = candidates[module]
        path_policy = {
            "allowedPaths": spec["allowedPaths"],
            "protectedPaths": spec["protectedPaths"],
            "commonControlOnlyPaths": control_only,
            "existingBridgeFilesAllocatedToModule": [],
            "outsideAllowedPathAction": "STOP_AND_RAISE_CONTROL_REQUEST",
        }
        path_policy_sha = sha256_bytes(canonical_bytes(path_policy))
        dependencies = dependency_pins(candidate)
        dependency_sha = sha256_bytes(canonical_bytes(dependencies))
        lease = lease_by_module[module]
        lease_sha = sha256_bytes(canonical_bytes({k: v for k, v in lease.items() if k != "sealedPayloadSha256"}))
        start_id = token_id(module, spec["sliceId"]) if spec["sourceChangeAuthorized"] else None
        packet = sealed({
            "schema": "dwp.hris.g7-module-work-packet.v1",
            "packetId": packet_id(module, spec["sliceId"]),
            "revision": 1,
            "issuedAt": ISSUED_AT,
            "issuedBy": "SYS_COMMON_INTEGRATION_CONTROL",
            "expiresAt": EXPIRES_AT,
            "lifecycleState": spec["lifecycleState"],
            "sessionId": spec["sessionId"],
            "module": module,
            "slice": {
                "sliceId": spec["sliceId"],
                "sourceRef": candidate["sourceRef"],
                "sourceFamilySha256": candidate["sourceFamilySha256"],
                "sourceRowCount": candidate["sourceRowCount"],
                "workDefinition": candidate["workDefinition"],
                "priorIntegratedSlice": candidate["priorSlice"],
                "primaryContractRefs": candidate["primaryContractRefs"],
                "operationBindings": candidate["operationBindings"],
            },
            "owners": {
                "ownerAgent": spec["sessionId"],
                "reviewer": "SYS_COMMON_INTEGRATION_CONTROL",
                "controlOwner": "SYS_COMMON_INTEGRATION_CONTROL",
                "singleWriterRequired": True,
            },
            "userOutcome": spec["userOutcome"],
            "basePins": PINS,
            "contractPins": {
                "authorization": AUTHORIZATION,
                "gatewayOpenApi": GATEWAY,
                "preflightSha256": EXPECTED_SHA["preflight"],
                "g5ReceiptSha256": EXPECTED_SHA["g5Receipt"],
                "g6ReceiptSha256": g6_receipt_sha,
                "g3ManifestSha256": EXPECTED_SHA["g3Manifest"],
                "g3OwnershipSha256": EXPECTED_SHA["g3Ownership"],
                "acceptedIaApiSuccessorSha256": EXPECTED_SHA["iaApiSuccessor"],
                "acceptedIaRuntimeSuccessorSha256": EXPECTED_SHA["iaRuntimeSuccessor"],
                "acceptedIaProjectionSchemaSha256": EXPECTED_SHA["iaProjectionSchemas"],
                "acceptedIaActionKeySha256": EXPECTED_SHA["iaActionKeys"],
                "moduleSourceEvidence": module_source_pins(module),
            },
            "dependencies": dependencies,
            "dependencyPinsSha256": dependency_sha,
            "producerResultPins": [],
            "scope": {
                "included": [candidate["workDefinition"], *spec["allowedPaths"]],
                "excluded": [
                    "shared/generated/Gateway/navigation/shell work owned by Control",
                    "customer data, customer activation and production release",
                    "capabilities outside the canonical slice and operation bindings",
                ],
            },
            "pathPolicy": path_policy,
            "pathPolicySha256": path_policy_sha,
            "centralControlRequests": {
                "registerSha256": controls_sha,
                "requestIds": spec["controlRequestIds"],
                "moduleMayImplement": False,
            },
            "migrationLease": {
                "leaseId": spec["migrationLeaseId"],
                "leaseDigestSha256": lease_sha,
                "status": lease["status"],
                "stream": lease["stream"],
                "version": lease["version"],
                "exactRelativePath": lease["exactRelativePath"],
                "migrationAdmissionAuthorized": lease["migrationAdmissionAuthorized"],
            },
            "runtimeSecurityRollout": {
                "ownerService": candidate["operationBindings"][0]["ownerService"],
                "systemOfRecord": spec["systemOfRecord"],
                "tenantPopulationBoundary": "Owner-side trusted tenant, population and field decisions; negative and cross-tenant cases fail closed.",
                "permissionSoDStepUp": "Use only the pinned G3 primary contract bindings; command, approval and corrective actions require their exact duty/SoD/step-up decisions.",
                "idempotencyVersionAudit": "Idempotency key plus payload digest, optimistic version/CAS, immutable receipt and transactional outbox.",
                "dataOriginMaskingRetention": "SOURCE/REFERENCE provenance is explicit; raw sensitive identifiers never enter logs, cursors or cross-owner events.",
                "featureFlag": {"key": spec["featureFlag"], "default": "OFF", "activationAuthority": "NOT_GRANTED"},
                "partialEmptyDeniedStates": "Loading, empty, partial failure, stale, denied and unavailable are distinct and accessible.",
            },
            "acceptanceCriteria": packet_acceptance(module),
            "verificationBindings": {
                "policy": "Run changed-cluster tests first, collect all failures in the cluster, then run one module batch; do not rerun broad suites per fix.",
                "moduleCommands": [
                    {"cwd": "backend" if command[0] == "./gradlew" else "frontend", "argv": command, "stage": "TARGETED_MODULE"}
                    for command in spec["moduleCommands"]
                ],
                "controlOnlyAfterModuleResult": [
                    "product authorization generation/check",
                    "OpenAPI/AsyncAPI export and frontend synchronization",
                    "focused shared route/access tests and one typecheck/architecture batch",
                    "new focused responsive/accessibility Playwright journeys",
                ],
                "fullW1OrPromotionRunInModulePacket": False,
            },
            "deliverables": [
                "separate frontend and backend result commits on the token-bound branches",
                "exact changed-file manifest proving path-policy compliance",
                "targeted command results and evidence locators",
                "migration lease used/unused status",
                "Control request handoff without direct shared-path edits",
            ],
            "releaseConditions": spec["releaseConditions"],
            "stopConditions": [
                "base pin, clean state, worktree branch or upstream diverges",
                "an edit outside the allowed path set is required",
                "the migration version/path is occupied, expired or changed",
                "a shared/generated/Gateway/shell/authorization change is required directly",
                "a tenant, SoR, dependency, contract or rollback invariant is ambiguous",
            ],
            "authority": {
                "sourceChangeAuthorized": spec["sourceChangeAuthorized"],
                "domainAuthoringOnly": spec["sourceChangeAuthorized"],
                "commitAndPushTokenBranchesAuthorized": spec["sourceChangeAuthorized"],
                "sharedControlPathChangeAuthorized": False,
                "integrationMergeAuthorized": False,
                "customerDataAuthorized": False,
                "customerActivationAuthorized": False,
                "productionReleaseAuthorized": False,
            },
            "startTokenId": start_id,
        })
        path = HERE / f"packets/{module.lower()}-{candidate['sourceRef'].split('-')[-1].lower()}.v1.json"
        objects[module] = packet
        rendered[repo_path(path)] = json_bytes(packet)
    return objects, rendered


def worktree_rows() -> list[dict[str, str]]:
    root = "/Users/a10697/Work/DWP/.codex-worktrees/hris/g7-20261012"
    rows = []
    for module, short, slice_id in (("PER", "per-006", "BASE-TFR-PER-006"), ("TIM", "tim-006", "BASE-TFR-TIM-006")):
        for repo in ("frontend", "backend"):
            base = PINS[repo]
            branch = f"codex/hris-g7-{short}-{repo}-20261012"
            rows.append({
                "module": module,
                "slice_id": slice_id,
                "token_id": token_id(module, slice_id),
                "repo": repo,
                "absolute_path": f"{root}/{short}/{repo}",
                "branch": branch,
                "upstream": f"origin/{branch}",
                "head": base["commit"],
                "tree": base["tree"],
                "state_sha256": EMPTY_STATE_SHA,
                "clean": "true",
                "ahead": "0",
                "behind": "0",
                "state": "CREATED_PUSHED_CLEAN",
            })
    return rows


def render_worktrees(rows: list[dict[str, str]]) -> bytes:
    buffer = io.StringIO(newline="")
    writer = csv.DictWriter(buffer, fieldnames=list(rows[0]), lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
    return buffer.getvalue().encode("utf-8")


def build_tokens(
    packets: dict[str, dict[str, Any]],
    packet_rendered: dict[str, bytes],
    lease_obj: dict[str, Any],
    worktrees: list[dict[str, str]],
) -> tuple[dict[str, dict[str, Any]], dict[str, bytes]]:
    leases_by_module = {row["module"]: row for row in lease_obj["leases"]}
    objects = {}
    rendered = {}
    for module in ("PER", "TIM"):
        packet = packets[module]
        packet_path = next(path for path in packet_rendered if f"/{module.lower()}-" in path)
        packet_raw = packet_rendered[packet_path]
        lease = leases_by_module[module]
        bindings = [row for row in worktrees if row["module"] == module]
        token = sealed({
            "schema": "dwp.hris.g7-module-start-token.v1",
            "tokenId": packet["startTokenId"],
            "packetId": packet["packetId"],
            "packetPath": packet_path,
            "packetFileSha256": sha256_bytes(packet_raw),
            "sliceId": packet["slice"]["sliceId"],
            "module": module,
            "sessionId": packet["sessionId"],
            "issuedAt": ISSUED_AT,
            "issuedBy": "SYS_COMMON_INTEGRATION_CONTROL",
            "expiresAt": EXPIRES_AT,
            "activationReceiptId": PROMOTION_RECEIPT_ID,
            "state": "ISSUED_PENDING_PROMOTION_RECEIPT",
            "basePins": PINS,
            "worktreeBindings": bindings,
            "pathPolicySha256": packet["pathPolicySha256"],
            "dependencyPinsSha256": packet["dependencyPinsSha256"],
            "migrationLeaseSha256": packet["migrationLease"]["leaseDigestSha256"],
            "migrationLeaseId": lease["leaseId"],
            "permittedAction": "START_DOMAIN_MODULE_IMPLEMENTATION",
            "invalidationConditions": [
                "promotion receipt does not list this exact token as active",
                "packet/token/worktree/lease digest or base pin changes",
                "worktree is dirty, unpublished, ahead/behind or on another branch",
                "an allowed-path or common-Control boundary is crossed",
                "token expires or is revoked",
            ],
            "authority": {
                "domainAuthoringOnly": True,
                "exactWorktreesOnly": True,
                "exactAllowedPathsOnly": True,
                "exactMigrationLeaseOnly": True,
                "commitAndPushTokenBranchesAuthorized": True,
                "sharedControlPathChangeAuthorized": False,
                "integrationMergeAuthorized": False,
                "customerDataAuthorized": False,
                "customerActivationAuthorized": False,
                "productionReleaseAuthorized": False,
            },
        })
        path = HERE / f"tokens/{module.lower()}-006.start-token.v1.json"
        objects[module] = token
        rendered[repo_path(path)] = json_bytes(token)
    return objects, rendered


def build_overlay(
    packet_objects: dict[str, dict[str, Any]],
    token_objects: dict[str, dict[str, Any]],
    g6_receipt_sha: str,
) -> tuple[bytes, dict[str, Any]]:
    with STALE_OVERLAY.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        original_fields = list(reader.fieldnames or [])
        rows = list(reader)
    output = io.StringIO(newline="")
    writer = csv.DictWriter(output, fieldnames=original_fields + OVERLAY_EXTRA_FIELDS, lineterminator="\n")
    writer.writeheader()
    by_slice = {packet["slice"]["sliceId"]: packet for packet in packet_objects.values()}
    by_token_slice = {token["sliceId"]: token for token in token_objects.values()}
    for row in rows:
        slice_id = row["slice_id"]
        extra = {field: "NONE" for field in OVERLAY_EXTRA_FIELDS}
        if slice_id in PRIOR_INTEGRATED:
            extra.update({
                "g7_classification": "INTEGRATED_FROZEN_G5_G6",
                "g7_authority": "FROZEN_EVIDENCE_ONLY",
                "g7_dependency_result_pins": f"G5:{EXPECTED_SHA['g5Receipt']}|G6:{g6_receipt_sha}",
                "g7_evidence_refs": f"FE:{PINS['frontend']['commit']}|BE:{PINS['backend']['commit']}|G6:{G6_RAW['runId']}",
                "g7_authority_note": "PROMOTED_AS_PRIOR_INTEGRATED_EVIDENCE_NOT_A_NEW_START_TOKEN",
            })
        elif slice_id in AUTHORIZED_SLICES:
            packet = by_slice[slice_id]
            token = by_token_slice[slice_id]
            extra.update({
                "g7_classification": "AUTHORIZED_DOMAIN_AUTHORING",
                "g7_authority": "TOKEN_BOUND_DOMAIN_AUTHORING_ONLY",
                "g7_packet_id": packet["packetId"],
                "g7_start_token_id": token["tokenId"],
                "g7_dependency_result_pins": packet["dependencyPinsSha256"],
                "g7_producer_result_pins": "NO_EXTERNAL_PRODUCER_RESULT_REQUIRED",
                "g7_migration_lease_id": packet["migrationLease"]["leaseId"],
                "g7_touch_policy_digest": packet["pathPolicySha256"],
                "g7_evidence_refs": f"G5:{EXPECTED_SHA['g5Receipt']}|G6:{g6_receipt_sha}|PREFLIGHT:{EXPECTED_SHA['preflight']}",
                "g7_authority_note": "COMMON_CONTROL_PATHS_AND_INTEGRATION_MERGE_REMAIN_FORBIDDEN",
            })
        elif slice_id in PREPARED_WITHHELD_SLICES:
            packet = by_slice[slice_id]
            extra.update({
                "g7_classification": "PACKET_PREPARED_START_WITHHELD",
                "g7_authority": "SOURCE_CHANGE_WITHHELD_CONTROL_BOOTSTRAP_REQUIRED",
                "g7_packet_id": packet["packetId"],
                "g7_start_token_id": "NONE",
                "g7_dependency_result_pins": packet["dependencyPinsSha256"],
                "g7_producer_result_pins": "CONTROL_RESULT_PINS_REQUIRED",
                "g7_migration_lease_id": packet["migrationLease"]["leaseId"],
                "g7_touch_policy_digest": packet["pathPolicySha256"],
                "g7_evidence_refs": f"G5:{EXPECTED_SHA['g5Receipt']}|G6:{g6_receipt_sha}|PREFLIGHT:{EXPECTED_SHA['preflight']}",
                "g7_authority_note": "NO_SOURCE_EDIT_OR_WORKTREE_TOKEN_UNTIL_RELEASE_CONDITIONS_ARE_PINNED",
            })
        elif slice_id == "MOD-PER-COMPPLAN":
            extra.update({
                "g7_classification": "WITHHELD_PRODUCER_NOT_IMPLEMENTED",
                "g7_authority": "NO_AUTHORITY",
                "g7_producer_result_pins": "MOD-PER-COMPPLAN_RESULT_COMMIT_ABSENT",
                "g7_evidence_refs": f"PREFLIGHT:{EXPECTED_SHA['preflight']}",
                "g7_authority_note": "IMPLEMENT_AND_PIN_CANONICAL_PRODUCER_BEFORE_PAY_CONSUMER",
            })
        elif slice_id == "BASE-TFR-PAY-016":
            extra.update({
                "g7_classification": "WITHHELD_PRODUCER_AND_NAMED_TESTS_REQUIRED",
                "g7_authority": "NO_AUTHORITY",
                "g7_dependency_result_pins": "KEEP:DEP-001|DEP-002|DEP-003|DEP-016|DEP-019;DROP_TO_OTHER_PAY_SLICES:DEP-007|DEP-008|DEP-009",
                "g7_producer_result_pins": "MOD-PER-COMPPLAN|SVC-PEP-PER-001|XCON-020|XCON-021:ABSENT",
                "g7_evidence_refs": f"PREFLIGHT:{EXPECTED_SHA['preflight']}",
                "g7_authority_note": "NO_PACKET_TOKEN_OR_MIGRATION_LEASE",
            })
        elif row["disposition"] == "RETIRED":
            extra.update({
                "g7_classification": "RETIRED_UNCHANGED",
                "g7_authority": "NO_AUTHORITY",
                "g7_authority_note": "CARRIED_FORWARD_RETIRED",
            })
        else:
            extra.update({
                "g7_classification": "QUEUED_NOT_SELECTED",
                "g7_authority": "NO_AUTHORITY",
                "g7_authority_note": "CARRIED_FORWARD_NO_G7_PACKET_OR_TOKEN",
            })
        writer.writerow({**row, **extra})
    raw = output.getvalue().encode("utf-8")
    ordered_ids = [row["slice_id"] for row in rows]
    evidence = sealed({
        "schema": "dwp.hris.g7-successor-slice-overlay-evidence.v1",
        "issuedAt": ISSUED_AT,
        "sourceOverlay": {
            "path": repo_path(STALE_OVERLAY),
            "sha256": EXPECTED_SHA["staleOverlay"],
            "evidencePath": repo_path(STALE_OVERLAY_EVIDENCE),
            "evidenceSha256": EXPECTED_SHA["staleOverlayEvidence"],
            "immutable": True,
        },
        "successorOverlay": {
            "path": repo_path(OVERLAY),
            "bytes": len(raw),
            "sha256": sha256_bytes(raw),
            "rows": len(rows),
            "uniqueSliceIds": len(set(ordered_ids)),
            "orderedSliceIdSha256": sha256_bytes(("\n".join(ordered_ids) + "\n").encode()),
            "sortedSliceIdSetSha256": sha256_bytes(("\n".join(sorted(ordered_ids)) + "\n").encode()),
            "moduleCounts": dict(sorted(Counter(row["module"] for row in rows).items())),
            "sourceKindCounts": dict(sorted(Counter(row["source_kind"] for row in rows).items())),
            "classificationCounts": dict(sorted(Counter(
                ("INTEGRATED_FROZEN_G5_G6" if row["slice_id"] in PRIOR_INTEGRATED else
                 "AUTHORIZED_DOMAIN_AUTHORING" if row["slice_id"] in AUTHORIZED_SLICES else
                 "PACKET_PREPARED_START_WITHHELD" if row["slice_id"] in PREPARED_WITHHELD_SLICES else
                 "WITHHELD_PRODUCER_NOT_IMPLEMENTED" if row["slice_id"] == "MOD-PER-COMPPLAN" else
                 "WITHHELD_PRODUCER_AND_NAMED_TESTS_REQUIRED" if row["slice_id"] == "BASE-TFR-PAY-016" else
                 "RETIRED_UNCHANGED" if row["disposition"] == "RETIRED" else
                 "QUEUED_NOT_SELECTED") for row in rows
            ).items())),
        },
        "transitionRule": "All pre-G7 columns and row order remain byte-value equivalent after CSV parsing; only the ten g7_* columns are appended.",
        "newSliceIdsAllowed": False,
        "missingSliceIdsAllowed": False,
        "duplicateSliceIdsAllowed": False,
    })
    return raw, evidence


def packet_path(module: str, candidate: dict[str, Any]) -> str:
    return repo_path(HERE / f"packets/{module.lower()}-{candidate['sourceRef'].split('-')[-1].lower()}.v1.json")


def build_bundle(g6_root: Path) -> dict[Path, bytes]:
    if file_sha(PREFLIGHT) != EXPECTED_SHA["preflight"]:
        raise ValueError("G7 preflight drift")
    if file_sha(G5_RECEIPT) != EXPECTED_SHA["g5Receipt"]:
        raise ValueError("G5 receipt drift")
    if file_sha(STALE_OVERLAY) != EXPECTED_SHA["staleOverlay"]:
        raise ValueError("stale overlay drift")
    if file_sha(STALE_OVERLAY_EVIDENCE) != EXPECTED_SHA["staleOverlayEvidence"]:
        raise ValueError("stale overlay evidence drift")
    preflight = read_json(PREFLIGHT)
    if preflight["state"] != "PREPARED_BLOCKED_PENDING_G5_G6_PROMOTION":
        raise ValueError("preflight is not the immutable read-only input")
    for authority in preflight["inputAuthorities"]:
        source = FRONTEND_ROOT / authority["path"]
        if file_sha(source) != authority["sha256"]:
            raise ValueError(f"preflight input authority drift: {authority['id']}")
    config = module_configuration()
    g6 = build_g6_receipt(g6_root)
    g6_raw = json_bytes(g6)
    g6_sha = sha256_bytes(g6_raw)
    controls = control_requests(config)
    controls_raw = json_bytes(controls)
    leases = migration_leases(config)
    leases_raw = json_bytes(leases)
    packet_objects, packet_rendered = build_packets(
        preflight, config, sha256_bytes(controls_raw), leases, g6_sha
    )
    worktrees = worktree_rows()
    worktrees_raw = render_worktrees(worktrees)
    token_objects, token_rendered = build_tokens(
        packet_objects, packet_rendered, leases, worktrees
    )
    overlay_raw, overlay_evidence = build_overlay(packet_objects, token_objects, g6_sha)
    overlay_evidence_raw = json_bytes(overlay_evidence)
    candidates = {row["module"]: row for row in preflight["candidates"]}
    pay = candidates["PAY"]
    plan = sealed({
        "schema": "dwp.hris.g7-delegation-plan.v1",
        "planId": "HRIS-G7-DELEGATION-PLAN-20261012-R1",
        "issuedAt": ISSUED_AT,
        "issuedBy": "SYS_COMMON_INTEGRATION_CONTROL",
        "state": "BUNDLE_SEALED_PENDING_PROMOTION_RECEIPT",
        "frozenEvidence": {
            "g5Receipt": {"path": repo_path(G5_RECEIPT), "sha256": EXPECTED_SHA["g5Receipt"]},
            "g6Receipt": {"path": repo_path(G6_RECEIPT), "sha256": g6_sha},
            "frontend": PINS["frontend"],
            "backend": PINS["backend"],
            "agent": PINS["agent"],
            "gatewayOpenApi": GATEWAY,
            "authorization": AUTHORIZATION,
        },
        "decisions": [
            {"module": module, "sliceId": config[module]["sliceId"], "packetId": packet_objects[module]["packetId"], "packetState": packet_objects[module]["lifecycleState"], "tokenId": packet_objects[module]["startTokenId"], "sourceChangeAuthorizedAfterPromotion": config[module]["sourceChangeAuthorized"]}
            for module in ("SYS", "HRM", "PER", "TIM")
        ],
        "activeTokenClosedSetAfterPromotion": [token_objects[module]["tokenId"] for module in ("PER", "TIM")],
        "withheld": [
            {
                "module": "SYS",
                "sliceId": "BASE-TFR-SYS-007",
                "state": "PACKET_PREPARED_START_WITHHELD",
                "packetId": packet_objects["SYS"]["packetId"],
                "packetIssued": True,
                "tokenIssued": False,
                "migrationLeaseId": config["SYS"]["migrationLeaseId"],
                "migrationLeaseStatus": "RESERVED_CONTROL_ONLY",
                "releaseConditions": config["SYS"]["releaseConditions"],
            },
            {
                "module": "HRM",
                "sliceId": "BASE-TFR-HRM-010",
                "state": "PACKET_PREPARED_START_WITHHELD",
                "packetId": packet_objects["HRM"]["packetId"],
                "packetIssued": True,
                "tokenIssued": False,
                "migrationLeaseId": config["HRM"]["migrationLeaseId"],
                "migrationLeaseStatus": "RESERVED_CONTROL_ONLY",
                "releaseConditions": config["HRM"]["releaseConditions"],
            },
            {
                "module": "PAY",
                "sliceId": pay["sliceId"],
                "state": "WITHHELD_PRODUCER_AND_NAMED_TESTS_REQUIRED",
                "dependencyResolution": {
                    "keep": ["DEP-001", "DEP-002", "DEP-003", "DEP-016", "DEP-019"],
                    "dropFromThisSlice": {
                        "DEP-007": "owned by PAY-021 HRM projection consumption",
                        "DEP-008": "owned by PAY-021 HRM protected-data projection consumption",
                        "DEP-009": "owned by PAY-020 closed-time payroll calculation",
                    },
                },
                "operationBindings": pay["operationBindings"],
                "producerBinding": pay["producerBinding"],
                "releaseConditions": [
                    "Pin a pushed MOD-PER-COMPPLAN runtime result commit.",
                    "Implement and pin SVC-PEP-PER-001 plus immutable XCON-020 ordered lines.",
                    "Publish XCON-021 v2 only after snapshot commit; v1 and dual publish are forbidden.",
                    "Implement the named PayIaEntryQueryContractTest invariant methods before packet issuance.",
                ],
                "packetIssued": False,
                "tokenIssued": False,
                "migrationLeaseIssued": False,
            },
            {
                "module": "AGENT",
                "sliceId": None,
                "state": "NO_CANONICAL_SLICE_NO_PACKET",
                "releaseConditions": [
                    "Pin deterministic owner APIs/actions and tool contracts.",
                    "Add a canonical Agent work definition in a later authority revision with delegated identity, PEP and receipt semantics.",
                ],
                "packetIssued": False,
                "tokenIssued": False,
                "systemOfRecordAuthorized": False,
                "directDatabaseWriterAuthorized": False,
            },
        ],
        "codeReexecutionPerformed": False,
        "applicationSourceChanged": False,
        "customerActivationAuthorized": False,
        "productionReleaseAuthorized": False,
    })
    plan_raw = json_bytes(plan)
    current = sealed({
        "schema": "dwp.hris.g7-current-delegation-state.v1",
        "asOf": ISSUED_AT,
        "state": "PENDING_PROMOTION_RECEIPT",
        "authorizedAfterPromotion": [
            {"module": module, "sliceId": token_objects[module]["sliceId"], "packetId": token_objects[module]["packetId"], "tokenId": token_objects[module]["tokenId"], "authority": "DOMAIN_AUTHORING_ONLY"}
            for module in ("PER", "TIM")
        ],
        "preparedStartWithheld": [
            {"module": module, "sliceId": config[module]["sliceId"], "packetId": packet_objects[module]["packetId"], "tokenId": None, "sourceChangeAuthorized": False}
            for module in ("SYS", "HRM")
        ],
        "noPacketNoToken": ["BASE-TFR-PAY-016", "AGENT"],
        "worktreeRegister": {"path": repo_path(WORKTREES), "sha256": sha256_bytes(worktrees_raw), "rows": len(worktrees)},
        "activationReceiptId": PROMOTION_RECEIPT_ID,
    })
    current_raw = json_bytes(current)

    outputs: dict[Path, bytes] = {
        G6_RECEIPT: g6_raw,
        PLAN: plan_raw,
        CONTROL_REQUESTS: controls_raw,
        LEASES: leases_raw,
        WORKTREES: worktrees_raw,
        OVERLAY: overlay_raw,
        OVERLAY_EVIDENCE: overlay_evidence_raw,
        CURRENT_STATE: current_raw,
        **{FRONTEND_ROOT / path: raw for path, raw in packet_rendered.items()},
        **{FRONTEND_ROOT / path: raw for path, raw in token_rendered.items()},
        **schemas(),
    }
    artifact_entries = []
    for path in sorted(outputs, key=lambda item: repo_path(item)):
        raw = outputs[path]
        artifact_entries.append({"path": repo_path(path), "bytes": len(raw), "sha256": sha256_bytes(raw)})
    sources = [pin(PREFLIGHT), pin(G5_RECEIPT), pin(STALE_OVERLAY), pin(STALE_OVERLAY_EVIDENCE)]
    sources.extend({"path": authority["path"], "bytes": (FRONTEND_ROOT / authority["path"]).stat().st_size, "sha256": authority["sha256"]} for authority in preflight["inputAuthorities"])
    deduped_sources = {item["path"]: item for item in sources}
    manifest = sealed({
        "schema": "dwp.hris.g7-delegation-manifest.v1",
        "issuedAt": ISSUED_AT,
        "sourcePins": [deduped_sources[key] for key in sorted(deduped_sources)],
        "toolPins": [pin(HERE / "materialize_g7_module_delegation.py"), pin(VALIDATOR)],
        "artifacts": artifact_entries,
        "artifactCount": len(artifact_entries),
        "activeTokenCandidates": [token_objects[module]["tokenId"] for module in ("PER", "TIM")],
        "packetCount": 4,
        "tokenCount": 2,
        "overlayRows": 102,
        "codeReexecutionPerformed": False,
    })
    outputs[MANIFEST] = json_bytes(manifest)
    return outputs


def promotion_markdown(receipt: dict[str, Any]) -> str:
    return f"""# 2026-10-12 HRIS G7 통합 로드맵 상태 Successor

> 상태: G7 evidence promotion complete; PER/TIM domain authoring authorized; SYS/HRM/PAY/Agent withheld
>
> 기준일: 2026-10-12
>
> 판정: [G7 Evidence Promotion and Delegation Receipt](2026-10-12-g7-evidence-promotion-and-delegation-receipt.json)

G6 W1은 frozen Frontend `{PINS['frontend']['commit']}`, Backend `{PINS['backend']['commit']}` 조합에서
full mode 정확히 1회 실행되어 28/28 phase와 15/15 checkpoint assertion을 통과했다. G7은 이 실행을
재실행하지 않고 raw SHA-256을 별도 G6 receipt로 승격했다.

## G7 판정

| 모듈 | Slice | 상태 | 현재 허용 범위 |
| --- | --- | --- | --- |
| PER | `BASE-TFR-PER-006` | `AUTHORIZED` | token-bound 새 child 경로와 Performance V2 migration의 domain authoring만 |
| TIM | `BASE-TFR-TIM-006` | `AUTHORIZED` | token-bound 새 child 경로와 Time V8 migration의 domain authoring만 |
| SYS | `BASE-TFR-SYS-007` | `START_WITHHELD` | packet/Platform V325 예약만; Control bootstrap 결과 pin 전 소스 변경 금지 |
| HRM | `BASE-TFR-HRM-010` | `START_WITHHELD` | packet/People V54 예약만; event·양방향 Approval handoff pin 전 소스 변경 금지 |
| PAY | `BASE-TFR-PAY-016` | `WITHHELD` | `MOD-PER-COMPPLAN` producer result와 named test 전 packet/token/lease 없음 |
| Agent | 없음 | `WITHHELD` | canonical slice와 deterministic owner tool contract 전 packet/token 없음 |

PER/TIM token은 공통 경로 편집, 중앙 integration merge, customer data, activation 또는 production release를
허용하지 않는다. Frontend와 Backend는 각각 전용 pushed branch/worktree에서 단일 writer로 작업한다.
공통 authorization, generated contract, Gateway, route, shell, i18n 작업은 module result 이후 Control request로
한 번에 처리한다.

## 검증 효율화

G7에서는 application code와 W1을 다시 실행하지 않았다. 검증은 input/raw hash, Git object/tree/clean/upstream,
102행 closed set, packet/token/lease 1:1 결박, migration high-water, path overlap 및 manifest seal만 수행했다.
모듈 구현도 변경 cluster test를 먼저 실행하고 실패를 일괄 수정한 뒤 module batch를 한 번 수행한다.

## 다음 실행 순서

1. `HRIS-PER`가 `BASE-TFR-PER-006` packet/token으로 population freeze vertical slice를 구현한다.
2. `HRIS-TIM`이 `BASE-TFR-TIM-006` packet/token으로 clock ingestion/void vertical slice를 병렬 구현한다.
3. 각 module result commit과 targeted evidence가 준비되면 Control lane이 해당 CR을 한 묶음으로 통합한다.
4. SYS/HRM은 별도 중앙 Control bootstrap이 계약 result pin을 만든 뒤에만 새 promotion receipt/token을 받는다.
5. PAY는 `MOD-PER-COMPPLAN`이 완료된 뒤 재분류하며 Agent는 canonical work definition이 생길 때까지 보류한다.

이 문서의 bundle commit은 `{receipt['bundleCommit']['commit']}`이며 final promotion receipt가 PER/TIM token만
활성화한다. 과거 G3 code-go token과 stale G1 overlay는 현재 작업 권한이 아니다.
"""


def build_promotion(bundle_commit: str, bundle_tree: str) -> dict[Path, bytes]:
    manifest = read_json(MANIFEST)
    plan = read_json(PLAN)
    overlay_evidence = read_json(OVERLAY_EVIDENCE)
    leases = read_json(LEASES)
    packets = {module: read_json(path) for module, path in {
        "SYS": HERE / "packets/sys-007.v1.json",
        "HRM": HERE / "packets/hrm-010.v1.json",
        "PER": HERE / "packets/per-006.v1.json",
        "TIM": HERE / "packets/tim-006.v1.json",
    }.items()}
    tokens = {module: read_json(HERE / f"tokens/{module.lower()}-006.start-token.v1.json") for module in ("PER", "TIM")}
    receipt = sealed({
        "schema": "dwp.hris.g7-evidence-promotion-and-delegation-receipt.v1",
        "receiptId": PROMOTION_RECEIPT_ID,
        "issuedAt": ISSUED_AT,
        "issuedBy": "SYS_COMMON_INTEGRATION_CONTROL",
        "status": "PASS_SCOPED_DELEGATION",
        "decision": "PER_TIM_DOMAIN_AUTHORING_AUTHORIZED_SYS_HRM_PAY_AGENT_WITHHELD",
        "completionMeaning": "G5/G6 evidence and the immutable 102-row successor are promoted. Only PER-006 and TIM-006 satisfy start conditions, have exact worktrees and admitted migration leases, and receive domain-authoring tokens. Other modules remain fail-closed.",
        "requiredFrozenEvidenceResolved": {
            "g5Receipt": {"path": repo_path(G5_RECEIPT), "sha256": EXPECTED_SHA["g5Receipt"]},
            "g6Receipt": pin(G6_RECEIPT),
            "frontend": PINS["frontend"],
            "frontendSourceResult": PINS["frontendSourceResult"],
            "backend": PINS["backend"],
            "agent": PINS["agent"],
            "gatewayOpenApi": GATEWAY,
            "authorization": AUTHORIZATION,
            "g6ExecutionCount": 1,
        },
        "bundleCommit": {
            "commit": bundle_commit,
            "tree": bundle_tree,
            "manifestPath": repo_path(MANIFEST),
            "manifestSha256": file_sha(MANIFEST),
            "selfReferenceRule": "The promotion receipt is carried by the following commit and therefore pins the immutable bundle commit, not its own carrier commit.",
        },
        "overlay": overlay_evidence["successorOverlay"],
        "delegations": [
            {
                "module": module,
                "sliceId": tokens[module]["sliceId"],
                "packetId": tokens[module]["packetId"],
                "packetPath": tokens[module]["packetPath"],
                "packetSha256": tokens[module]["packetFileSha256"],
                "tokenId": tokens[module]["tokenId"],
                "tokenPath": repo_path(HERE / f"tokens/{module.lower()}-006.start-token.v1.json"),
                "tokenSha256": file_sha(HERE / f"tokens/{module.lower()}-006.start-token.v1.json"),
                "migrationLeaseId": tokens[module]["migrationLeaseId"],
                "worktrees": tokens[module]["worktreeBindings"],
                "authority": "DOMAIN_AUTHORING_ONLY",
            }
            for module in ("PER", "TIM")
        ],
        "preparedStartWithheld": [
            {
                "module": module,
                "sliceId": packets[module]["slice"]["sliceId"],
                "packetId": packets[module]["packetId"],
                "packetSha256": file_sha(HERE / f"packets/{module.lower()}-{packets[module]['slice']['sourceRef'].split('-')[-1].lower()}.v1.json"),
                "tokenId": None,
                "migrationLeaseId": packets[module]["migrationLease"]["leaseId"],
                "migrationLeaseStatus": packets[module]["migrationLease"]["status"],
                "releaseConditions": packets[module]["releaseConditions"],
                "sourceChangeAuthorized": False,
            }
            for module in ("SYS", "HRM")
        ],
        "withheld": plan["withheld"],
        "migrationLeases": {
            "path": repo_path(LEASES),
            "sha256": file_sha(LEASES),
            "issued": [row["leaseId"] for row in leases["leases"]],
            "admittedForModuleAuthoring": [row["leaseId"] for row in leases["leases"] if row["migrationAdmissionAuthorized"]],
        },
        "authority": {
            "g7EvidencePromotionComplete": True,
            "g7DelegationDecisionComplete": True,
            "modulePacketPreparationComplete": True,
            "moduleParallelDevelopmentAuthorized": True,
            "authorizedModules": ["PER", "TIM"],
            "authorizedSlices": ["BASE-TFR-PER-006", "BASE-TFR-TIM-006"],
            "startTokensIssued": [tokens[module]["tokenId"] for module in ("PER", "TIM")],
            "startTokensWithheld": ["BASE-TFR-SYS-007", "BASE-TFR-HRM-010", "BASE-TFR-PAY-016", "AGENT"],
            "migrationAdmissionAuthorized": ["G7-LEASE-PER-PERFORMANCE-V2-R1", "G7-LEASE-TIM-TIME-V8-R1"],
            "sharedControlPathChangeAuthorizedForModules": False,
            "integrationMergeAuthorized": False,
            "customerDataAuthorized": False,
            "customerActivationAuthorized": False,
            "productionReleaseAuthorized": False,
        },
        "codeReexecutionPerformed": False,
        "applicationSourceChanged": False,
        "exclusions": [
            "No G5 gate or G6 W1 command was re-run.",
            "No SYS, HRM, PAY or Agent source-change token is issued.",
            "No common-Control path, integration merge, customer activation or production release is authorized.",
        ],
        "nextStage": {
            "id": "POST_G7_MODULE_VERTICAL_SLICE_IMPLEMENTATION",
            "authorizedParallelModules": ["PER", "TIM"],
            "centralPrerequisiteTrack": "SYS_HRM_CONTROL_BOOTSTRAP_AND_FRESH_PROMOTION",
        },
    })
    return {
        PROMOTION_RECEIPT: json_bytes(receipt),
        ROADMAP: promotion_markdown(receipt).encode("utf-8"),
    }


def write_outputs(outputs: dict[Path, bytes], check: bool) -> None:
    mismatches = []
    for path, raw in outputs.items():
        if check:
            if not path.exists() or path.read_bytes() != raw:
                mismatches.append(repo_path(path))
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(raw)
    if mismatches:
        raise ValueError("generated artifact drift: " + ", ".join(sorted(mismatches)))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("phase", choices=("bundle", "promotion", "check-bundle", "check-promotion"))
    parser.add_argument("--g6-evidence-root", type=Path, default=BACKEND_ROOT / G6_RAW["runDirectory"])
    parser.add_argument("--bundle-commit")
    parser.add_argument("--bundle-tree")
    args = parser.parse_args()
    if args.phase in {"bundle", "check-bundle"}:
        write_outputs(build_bundle(args.g6_evidence_root.resolve()), args.phase == "check-bundle")
    else:
        if not args.bundle_commit or not args.bundle_tree:
            parser.error("promotion phases require --bundle-commit and --bundle-tree")
        write_outputs(
            build_promotion(args.bundle_commit, args.bundle_tree),
            args.phase == "check-promotion",
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
