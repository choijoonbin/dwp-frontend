#!/usr/bin/env python3
"""Independently validate the append-only SYS/HRM G7 R2 successor.

This file intentionally does not import the R2 materializer.  It repeats the
authority constants and validates raw predecessor hashes, Control completion,
live Git state, the vacant SYS lease plus read-only HRM migration pin,
generated artifacts, and the two-phase
promotion receipt as one fail-closed audit.  It never runs application tests.
"""

from __future__ import annotations

import argparse
import copy
import csv
import hashlib
import io
import json
import re
import subprocess
import sys
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any


HERE = Path(__file__).resolve().parent
DEFAULT_FRONTEND = HERE.parents[5]
DEFAULT_BACKEND = DEFAULT_FRONTEND.parent / "backend"
DEFAULT_WORKTREE_ROOT = Path(
    "/Users/a10697/Work/DWP/.codex-worktrees/hris/g7-20261012-r2"
)
HRIS_REL = Path("docs/06-delivery/hris")
PREDECESSOR_ROOT_REL = HRIS_REL / "g7-delegation/2026-10-12"
SUCCESSOR_ROOT_REL = (
    HRIS_REL / "g7-delegation-successors/2026-10-12/sys-hrm-r2"
)
CONTROL_RECEIPT_REL = SUCCESSOR_ROOT_REL / "control-bootstrap-completion.v2.json"
PROMOTION_RECEIPT_REL = (
    HRIS_REL / "2026-10-12-g7-sys-hrm-promotion-receipt.v2.json"
)

EMPTY_SHA256 = hashlib.sha256(b"").hexdigest()
ACTIVATION_RECEIPT_ID = "HRIS-G7-SYS-HRM-PROMOTION-20261012-R2"
CONTROL_RECEIPT_ID = "HRIS-G7-SYS-HRM-CONTROL-BOOTSTRAP-20261012-R2"
CONTROL_EVIDENCE_SCHEMA = "dwp.hris.g7-control-request-evidence.v1"
CONTROL_VALIDITY = timedelta(days=7)
CONTROL_RESULT_ANCESTORS = {
    "frontend": "430dffa4755e6978654358e12cd90aa9a138464f",
    "backend": "37b7f63e4cafd44be8f803888a378758e7afdccd",
}

PREDECESSOR_PINS = {
    "manifest": {
        "path": str(PREDECESSOR_ROOT_REL / "manifest.v1.json"),
        "sha256": "711cd8e282ed70be7fc8471adde26e96602ab697abf7b8eba568db568f220c07",
    },
    "promotionReceipt": {
        "path": str(
            HRIS_REL / "2026-10-12-g7-evidence-promotion-and-delegation-receipt.json"
        ),
        "sha256": "80bc8a7da69e3bb3fc733be28a02d8db4f5c2f5652bc3fb80659ae37437bf93b",
    },
    "migrationLeaseRegister": {
        "path": str(PREDECESSOR_ROOT_REL / "migration-leases.v1.json"),
        "sha256": "4df1f5375fd82549ee022f935184044074d7306b848d97238033296a83ab54b5",
    },
}

ACTIVE_TOKEN_CLOSED_SET = [
    "G7-START-SYS-BASE-TFR-SYS-007-R2",
    "G7-START-HRM-BASE-TFR-HRM-010-R2",
]
CLOSED_PREDECESSOR_TOKENS = [
    {
        "tokenId": "G7-START-PER-BASE-TFR-PER-006-R1",
        "state": "RESULT_INTEGRATED_CLOSED",
    },
    {
        "tokenId": "G7-START-TIM-BASE-TFR-TIM-006-R1",
        "state": "RESULT_INTEGRATED_CLOSED",
    },
]
CONTROL_REQUESTS = [
    "G7-CR-SYS-007-AUTH-PEP-R1",
    "G7-CR-SYS-007-CONTRACT-GATEWAY-R1",
    "G7-CR-SYS-007-SHELL-ROUTE-R1",
    "G7-CR-SYS-007-SECURITY-BRIDGE-R1",
    "G7-CR-HRM-010-EVENT-CONTRACT-R1",
    "G7-CR-HRM-010-AUTH-PEP-R1",
    "G7-CR-HRM-010-CONTRACT-GATEWAY-R1",
    "G7-CR-HRM-010-SHELL-ROUTE-R1",
    "G7-CR-HRM-010-APPROVAL-CALLBACK-R1",
    "G7-CR-HRM-010-APPROVAL-CASE-HANDOFF-R1",
]

# Independent copy of the immutable committed-blob evidence map.  Tuple item 0
# is the artifact closure and tuple item 1 is the semantic marker closure.
CONTROL_EVIDENCE_SPECS: dict[
    str,
    tuple[tuple[tuple[str, str], ...], tuple[tuple[str, str, str], ...]],
] = {
    "G7-CR-SYS-007-AUTH-PEP-R1": (
        (
            ("backend", "contracts/product-authorization/product-surfaces-v1.bundle-v37.json"),
            ("backend", "dwp-platform-server/src/main/resources/product-authorization/hcm-platform-pep-v37.generated.json"),
            ("backend", "dwp-platform-server/src/main/java/com/dwp/services/platform/security/HcmPlatformPepRegistry.java"),
            ("backend", "dwp-platform-server/src/test/java/com/dwp/services/platform/security/HcmPlatformPepSecurityContractTest.java"),
        ),
        (
            ("backend", "contracts/product-authorization/product-surfaces-v1.bundle-v37.json", "hcm.configuration.workbench.view"),
            ("backend", "dwp-platform-server/src/test/java/com/dwp/services/platform/security/HcmPlatformPepSecurityContractTest.java", "genericRoleOrNearbyAdminPathCannotBypassExactRegistry"),
        ),
    ),
    "G7-CR-SYS-007-CONTRACT-GATEWAY-R1": (
        (
            ("backend", "contracts/openapi/platform.json"),
            ("backend", "contracts/openapi/gateway-public.json"),
            ("backend", "scripts/tests/test_export_openapi_contracts.py"),
            ("frontend", "libs/api-contracts/openapi/gateway-public.json"),
            ("frontend", "libs/api-contracts/src/gateway-public.ts"),
        ),
        (
            ("backend", "contracts/openapi/gateway-public.json", "/api/platform/v1/hris/workbench/settings-reference"),
            ("frontend", "libs/api-contracts/src/gateway-public.ts", "/api/platform/v1/admin/hris/configurations"),
        ),
    ),
    "G7-CR-SYS-007-SHELL-ROUTE-R1": (
        (
            ("frontend", "apps/dwp/src/features/hcm/hcm-navigation.ts"),
            ("frontend", "apps/dwp/src/features/hris/shell/model/catalog/settings.ts"),
            ("frontend", "apps/dwp/src/features/hris/shell/testing/hris-shell-navigation-contract.test.ts"),
            ("frontend", "apps/dwp/src/pages/hcm.tsx"),
            ("frontend", "apps/dwp/src/features/hris/administration/reference-configuration/testing/hris-reference-configuration-workspace.test.tsx"),
        ),
        (
            ("frontend", "apps/dwp/src/pages/hcm.tsx", "'settings-reference': <HrisReferenceConfigurationWorkspace />"),
            ("frontend", "apps/dwp/src/features/hris/shell/testing/hris-shell-navigation-contract.test.ts", "/hr/settings/reference-data"),
        ),
    ),
    "G7-CR-SYS-007-SECURITY-BRIDGE-R1": (
        (
            ("backend", "dwp-platform-server/src/main/resources/product-authorization/hcm-platform-pep-v37.generated.json"),
            ("backend", "dwp-platform-server/src/main/java/com/dwp/services/platform/security/HcmPlatformPepRegistry.java"),
            ("backend", "dwp-platform-server/src/main/java/com/dwp/services/platform/security/PlatformSecurityFilter.java"),
            ("backend", "dwp-platform-server/src/test/java/com/dwp/services/platform/security/HcmPlatformPepSecurityContractTest.java"),
        ),
        (
            ("backend", "dwp-platform-server/src/main/java/com/dwp/services/platform/security/HcmPlatformPepRegistry.java", "never generic /v1/admin"),
            ("backend", "dwp-platform-server/src/test/java/com/dwp/services/platform/security/HcmPlatformPepSecurityContractTest.java", "/v1/admin/hris/configurations-admin"),
        ),
    ),
    "G7-CR-HRM-010-EVENT-CONTRACT-R1": (
        (
            ("backend", "contracts/asyncapi/domain-events.yaml"),
            ("backend", "contracts/hris/canonical/schemas/cross-module-canonical-schemas.v1.json"),
            ("backend", "dwp-platform-contracts/src/main/java/com/dwp/contracts/hris/xcon/v1/Xcon022EmployeeChangeAppliedV1.java"),
            ("backend", "dwp-platform-contracts/src/test/java/com/dwp/platform/contract/Xcon022EmployeeChangeAppliedAsyncApiContractTest.java"),
        ),
        (
            ("backend", "contracts/asyncapi/domain-events.yaml", "EmployeeChangeApplied.v1"),
            ("backend", "dwp-platform-contracts/src/main/java/com/dwp/contracts/hris/xcon/v1/Xcon022EmployeeChangeAppliedV1.java", "XCON_022"),
        ),
    ),
    "G7-CR-HRM-010-AUTH-PEP-R1": (
        (
            ("backend", "contracts/product-authorization/product-surfaces-v1.bundle-v37.json"),
            ("backend", "dwp-people-server/src/main/resources/product-authorization/hcm-people-pep-v37.generated.json"),
            ("backend", "dwp-people-server/src/main/java/com/dwp/services/people/security/HcmV3PepRegistry.java"),
            ("backend", "dwp-people-server/src/test/java/com/dwp/services/people/security/HcmV3PepRegistryTest.java"),
        ),
        (
            ("backend", "contracts/product-authorization/product-surfaces-v1.bundle-v37.json", "route.hcm.operations.employee-change-request-apply.action"),
            ("backend", "dwp-people-server/src/test/java/com/dwp/services/people/security/HcmV3PepRegistryTest.java", "/v1/hris/employee-change-requests/{requestPublicId}/apply"),
        ),
    ),
    "G7-CR-HRM-010-CONTRACT-GATEWAY-R1": (
        (
            ("backend", "contracts/openapi/people.json"),
            ("backend", "contracts/openapi/gateway-public.json"),
            ("backend", "contracts/openapi/hris-wave1-design-time.json"),
            ("backend", "scripts/tests/test_export_openapi_contracts.py"),
            ("frontend", "libs/api-contracts/openapi/gateway-public.json"),
            ("frontend", "libs/api-contracts/src/gateway-public.ts"),
        ),
        (
            ("backend", "contracts/openapi/gateway-public.json", "/api/people/v1/hris/workbench/operations/employee/change/requests"),
            ("backend", "contracts/openapi/people.json", "/v1/hris/employee-change-requests"),
            ("frontend", "libs/api-contracts/src/gateway-public.ts", "/api/people/v1/hris/workbench/operations/employee/change/requests"),
        ),
    ),
    "G7-CR-HRM-010-SHELL-ROUTE-R1": (
        (
            ("frontend", "apps/dwp/src/features/hcm/hcm-navigation.ts"),
            ("frontend", "apps/dwp/src/features/hris/shell/model/catalog/hr-operations.ts"),
            ("frontend", "apps/dwp/src/features/hris/shell/testing/hris-shell-navigation-contract.test.ts"),
            ("frontend", "apps/dwp/src/pages/hcm.tsx"),
        ),
        (
            ("frontend", "apps/dwp/src/features/hris/shell/model/catalog/hr-operations.ts", "/hr/operations/people/employee-change-requests"),
            ("frontend", "apps/dwp/src/pages/hcm.tsx", "'employee-change-requests':"),
        ),
    ),
    "G7-CR-HRM-010-APPROVAL-CALLBACK-R1": (
        (
            ("backend", "contracts/in-process/hris/approval-employee-change-bridge.v2.json"),
            ("backend", "dwp-platform-contracts/src/main/java/com/dwp/platform/contracts/hris/approval/v2/HrisWorkloadProofV2.java"),
            ("backend", "dwp-platform-contracts/src/test/java/com/dwp/platform/contract/HrisApprovalBridgeV2Test.java"),
            ("backend", "dwp-people-server/src/main/java/com/dwp/services/people/security/HrisEmployeeChangeSecurityBridge.java"),
            ("backend", "dwp-people-server/src/test/java/com/dwp/services/people/security/HrisEmployeeChangeSecurityBridgeTest.java"),
        ),
        (
            ("backend", "contracts/in-process/hris/approval-employee-change-bridge.v2.json", "/internal/hris-people/v1/employee-change-requests/{requestPublicId}/approval-decisions"),
            ("backend", "dwp-people-server/src/test/java/com/dwp/services/people/security/HrisEmployeeChangeSecurityBridgeTest.java", "approvalCallbackBypassesBrowserAuthOnlyWhenFeatureAndExactPathAreEnabled"),
        ),
    ),
    "G7-CR-HRM-010-APPROVAL-CASE-HANDOFF-R1": (
        (
            ("backend", "contracts/in-process/hris/approval-employee-change-bridge.v2.json"),
            ("backend", "dwp-people-server/src/main/java/com/dwp/services/people/hris/employeeservice/employeechange/approvalbridge/EmployeeChangeApprovalRequestOutbox.java"),
            ("backend", "dwp-people-server/src/main/java/com/dwp/services/people/hris/employeeservice/employeechange/approvalbridge/EmployeeChangeApprovalRequestRelay.java"),
            ("backend", "dwp-people-server/src/test/java/com/dwp/services/people/hris/employeeservice/employeechange/approvalbridge/EmployeeChangeApprovalRequestRelayPostgresTest.java"),
            ("backend", "dwp-approval-server/src/test/java/com/dwp/services/approval/hrisbridge/HrisApprovalDecisionRelayTest.java"),
        ),
        (
            ("backend", "contracts/in-process/hris/approval-employee-change-bridge.v2.json", "/internal/hris-approval/v1/approval-requests"),
            ("backend", "dwp-people-server/src/test/java/com/dwp/services/people/hris/employeeservice/employeechange/approvalbridge/EmployeeChangeApprovalRequestRelayPostgresTest.java", "ppl_employee_change_approval_request_outbox"),
        ),
    ),
}

CENTRAL_REPOSITORIES = {
    "frontend": (
        "codex/hris-g1-integration-frontend-20261006",
        "origin/codex/hris-g1-integration-frontend-20261006",
    ),
    "backend": (
        "codex/hris-g1-integration-backend-20261006",
        "origin/codex/hris-g1-integration-backend-20261006",
    ),
}

MODULES: dict[str, dict[str, Any]] = {
    "SYS": {
        "sliceId": "BASE-TFR-SYS-007",
        "sessionId": "HRIS-SYS",
        "packetId": "G7-PACKET-SYS-BASE-TFR-SYS-007-R1",
        "packetPath": str(PREDECESSOR_ROOT_REL / "packets/sys-007.v1.json"),
        "packetSha256": "13c9e32ddd24b20805060e9b1e1ebdf1549d0619fc7c9b32f4543e72556bfd4e",
        "pathPolicySha256": "c8b56ea099ba546c434fc8d3f6bf2fe8a84f5bddc37d76dd2b372ac3c3fdda74",
        "dependencyPinsSha256": "9630aa6033139fb3982cc30fdb8294a7e7a7669531dbbb41130265972a04c233",
        "tokenId": "G7-START-SYS-BASE-TFR-SYS-007-R2",
        "tokenRelativePath": "tokens/sys-007.start-token.v2.json",
        "migrationAuthorityMode": "ADMITTED_EXACT_LEASE",
        "leaseId": "G7-LEASE-SYS-PLATFORM-V325-R2",
        "predecessorLeaseId": "G7-LEASE-SYS-PLATFORM-V325-R1",
        "predecessorLeaseDigestSha256": "f79ea16e8fa389bc44eec07e975a9351b44d5df6d30434bfec85ce6aa5206cc8",
        "stream": "PLATFORM_MAIN",
        "streamRoot": "dwp-platform-server/src/main/resources/db/migration",
        "highWater": 324,
        "version": 325,
        "migrationPath": "dwp-platform-server/src/main/resources/db/migration/V325__create_hris_reference_configuration_lifecycle.sql",
        "schemaEffect": [
            "reference configuration lifecycle set and version records",
            "evaluation evidence and immutable command receipts",
            "outbox and audit controls; no duplicate raw reference-data store",
        ],
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
        "worktreeSlug": "sys-007",
    },
    "HRM": {
        "sliceId": "BASE-TFR-HRM-010",
        "sessionId": "HRIS-HRM",
        "packetId": "G7-PACKET-HRM-BASE-TFR-HRM-010-R1",
        "packetPath": str(PREDECESSOR_ROOT_REL / "packets/hrm-010.v1.json"),
        "packetSha256": "95c151eb2b277518d31cc9733175c7f2e05fc0c73da37fa9f861d58eef9b8a65",
        "pathPolicySha256": "1b9eef240654dcb21663615bbcf57a1285feaec6d47128be55d8a5b1173a2380",
        "dependencyPinsSha256": "c985183adb748fca02559695cf293fd4da96602099523da3d871d115612ecfb9",
        "tokenId": "G7-START-HRM-BASE-TFR-HRM-010-R2",
        "tokenRelativePath": "tokens/hrm-010.start-token.v2.json",
        "migrationAuthorityMode": "CONTROL_BOOTSTRAP_READ_ONLY_PIN",
        "predecessorLeaseId": "G7-LEASE-HRM-PEOPLE-V54-R1",
        "predecessorLeaseDigestSha256": "f4a459ab472198008decb1f1e2d43b4108f2eb6f6e3e716113100a2a24cc0add",
        "stream": "PEOPLE_MAIN",
        "streamRoot": "dwp-people-server/src/main/resources/db/migration",
        "highWater": 54,
        "version": 54,
        "migrationPath": "dwp-people-server/src/main/resources/db/migration/V54__create_employee_change_request_lifecycle.sql",
        "schemaEffect": [
            "employee-change request and frozen patch evidence",
            "approval decision inbox and immutable command receipts",
            "transactional outbox; no assignment-proposal table changes",
        ],
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
        "additionalProtectedPaths": [
            "backend:dwp-people-server/src/main/resources/db/migration/V54__create_employee_change_request_lifecycle.sql",
        ],
        "worktreeSlug": "hrm-010",
    },
}

TOOL_RELATIVE_PATHS = [
    "contracts/g7-control-bootstrap-completion.schema.v2.json",
    "contracts/g7-start-token.schema.v2.json",
    "contracts/g7-migration-lease-delta.schema.v2.json",
    "contracts/g7-successor-state.schema.v2.json",
    "contracts/g7-successor-manifest.schema.v2.json",
    "contracts/g7-promotion-receipt.schema.v2.json",
    "materialize_g7_sys_hrm_successor.py",
    "validate_g7_sys_hrm_successor.py",
    "test_g7_sys_hrm_successor.py",
]

CSV_FIELDS = [
    "module",
    "slice_id",
    "token_id",
    "repo",
    "absolute_path",
    "branch",
    "upstream",
    "head",
    "tree",
    "state_sha256",
    "clean",
    "ahead",
    "behind",
    "state",
]

AUTHORITY_CARRIER_PATHS = {
    str(CONTROL_RECEIPT_REL),
    str(SUCCESSOR_ROOT_REL / "migration-leases.delta.v2.json"),
    str(SUCCESSOR_ROOT_REL / "registers/module-worktrees.active.v2.csv"),
    str(SUCCESSOR_ROOT_REL / MODULES["SYS"]["tokenRelativePath"]),
    str(SUCCESSOR_ROOT_REL / MODULES["HRM"]["tokenRelativePath"]),
    str(SUCCESSOR_ROOT_REL / "state/delegation-after-sys-hrm-promotion.v2.json"),
    str(SUCCESSOR_ROOT_REL / "manifest.v2.json"),
    str(PROMOTION_RECEIPT_REL),
}

REPOSITORY_PIN_KEYS = {
    "commit",
    "tree",
    "stateSha256",
    "branch",
    "upstream",
    "clean",
    "upstreamMatched",
}

BUNDLE_RELATIVE_PATHS = [
    "migration-leases.delta.v2.json",
    "registers/module-worktrees.active.v2.csv",
    MODULES["SYS"]["tokenRelativePath"],
    MODULES["HRM"]["tokenRelativePath"],
    "state/delegation-after-sys-hrm-promotion.v2.json",
    "manifest.v2.json",
]

CONTROL_FILE_CLOSED_SET = {
    *TOOL_RELATIVE_PATHS,
    str(CONTROL_RECEIPT_REL.relative_to(SUCCESSOR_ROOT_REL)),
}

BUNDLE_FILE_CLOSED_SET = {
    *CONTROL_FILE_CLOSED_SET,
    *BUNDLE_RELATIVE_PATHS,
}


class Audit:
    def __init__(self) -> None:
        self.errors: list[str] = []
        self.checks = 0

    def require(self, condition: bool, message: str) -> None:
        self.checks += 1
        if not condition:
            self.errors.append(message)

    def equal(self, actual: Any, expected: Any, message: str) -> None:
        self.require(actual == expected, f"{message}: expected={expected!r}, actual={actual!r}")

    def exact_keys(
        self, value: Any, expected: set[str], message: str
    ) -> None:
        self.require(isinstance(value, dict), f"{message} is not an object")
        if isinstance(value, dict):
            self.equal(set(value), expected, f"{message} field closed set")

    def finish(self) -> None:
        if self.errors:
            for error in self.errors:
                print(f"FAIL: {error}", file=sys.stderr)
            raise SystemExit(
                f"G7 SYS/HRM R2 validation failed: {len(self.errors)} error(s), {self.checks} checks"
            )
        print(f"PASS: G7 SYS/HRM R2 independent validation ({self.checks} checks)")


def sha256_bytes(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def canonical_bytes(value: Any) -> bytes:
    return json.dumps(
        value, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")


def read_json(path: Path, audit: Audit) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:  # noqa: BLE001 - aggregate every artifact error
        audit.require(False, f"cannot parse JSON {path}: {exc}")
        return {}
    audit.require(isinstance(value, dict), f"JSON root is not an object: {path}")
    return value if isinstance(value, dict) else {}


def verify_seal(value: dict[str, Any], label: str, audit: Audit) -> None:
    body = copy.deepcopy(value)
    actual = body.pop("sealedPayloadSha256", None)
    expected = sha256_bytes(canonical_bytes(body))
    audit.equal(actual, expected, f"{label} canonical seal")


def parse_instant(value: Any, label: str, audit: Audit) -> datetime | None:
    if not isinstance(value, str):
        audit.require(False, f"{label} is not a string")
        return None
    try:
        result = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        audit.require(False, f"{label} is not ISO-8601")
        return None
    audit.require(result.tzinfo is not None, f"{label} has no offset")
    return result


def verify_successor_inventory(frontend: Path, phase: str, audit: Audit) -> None:
    root = frontend / SUCCESSOR_ROOT_REL
    audit.require(root.is_dir(), "R2 successor root missing")
    if root.is_dir():
        actual = {
            str(path.relative_to(root))
            for path in root.rglob("*")
            if path.is_file()
            and "__pycache__" not in path.relative_to(root).parts
            and path.suffix != ".pyc"
        }
        expected = (
            CONTROL_FILE_CLOSED_SET if phase == "control" else BUNDLE_FILE_CLOSED_SET
        )
        audit.equal(actual, expected, "R2 successor file inventory")
    promotion_exists = (frontend / PROMOTION_RECEIPT_REL).is_file()
    audit.equal(
        promotion_exists,
        phase == "promotion",
        "promotion receipt phase boundary",
    )


def run_git(root: Path, args: list[str]) -> tuple[int, bytes]:
    try:
        process = subprocess.run(
            ["git", *args],
            cwd=root,
            check=False,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
    except OSError:
        return 1, b""
    return process.returncode, process.stdout


def git_text(root: Path, args: list[str], label: str, audit: Audit) -> str:
    code, raw = run_git(root, args)
    audit.equal(code, 0, f"{label} command")
    return raw.decode("utf-8", errors="replace").strip() if code == 0 else ""


def inspect_repository(
    root: Path, branch: str, upstream: str, label: str, audit: Audit
) -> dict[str, Any]:
    audit.require(root.is_dir(), f"{label} path missing: {root}")
    if not root.is_dir():
        return {}
    actual_branch = git_text(root, ["branch", "--show-current"], f"{label} branch", audit)
    actual_upstream = git_text(
        root, ["rev-parse", "--abbrev-ref", "@{upstream}"], f"{label} upstream", audit
    )
    head = git_text(root, ["rev-parse", "HEAD^{commit}"], f"{label} head", audit)
    tree = git_text(root, ["rev-parse", "HEAD^{tree}"], f"{label} tree", audit)
    upstream_head = git_text(
        root, ["rev-parse", "@{upstream}^{commit}"], f"{label} upstream head", audit
    )
    code, status = run_git(root, ["status", "--porcelain=v1", "--untracked-files=all"])
    audit.equal(code, 0, f"{label} status command")
    counts = git_text(
        root,
        ["rev-list", "--left-right", "--count", "HEAD...@{upstream}"],
        f"{label} ahead/behind",
        audit,
    )
    audit.equal(actual_branch, branch, f"{label} exact branch")
    audit.equal(actual_upstream, upstream, f"{label} exact upstream")
    audit.equal(status, b"", f"{label} clean status")
    audit.equal(head, upstream_head, f"{label} pushed head")
    audit.equal(counts, "0\t0", f"{label} ahead/behind counts")
    return {
        "commit": head,
        "tree": tree,
        "stateSha256": sha256_bytes(status),
        "branch": actual_branch,
        "upstream": actual_upstream,
        "clean": status == b"",
        "upstreamMatched": head == upstream_head,
    }


def verify_predecessors(frontend: Path, audit: Audit) -> None:
    for label, pin in PREDECESSOR_PINS.items():
        path = frontend / pin["path"]
        audit.require(path.is_file(), f"predecessor {label} missing")
        if path.is_file():
            audit.equal(
                sha256_bytes(path.read_bytes()),
                pin["sha256"],
                f"predecessor {label} raw hash",
            )
    for module, spec in MODULES.items():
        path = frontend / spec["packetPath"]
        audit.require(path.is_file(), f"{module} predecessor packet missing")
        if not path.is_file():
            continue
        audit.equal(
            sha256_bytes(path.read_bytes()),
            spec["packetSha256"],
            f"{module} predecessor packet raw hash",
        )
        packet = read_json(path, audit)
        verify_seal(packet, f"{module} predecessor packet", audit)
        audit.equal(packet.get("packetId"), spec["packetId"], f"{module} packet ID")
        audit.equal(
            packet.get("lifecycleState"),
            "PACKET_PREPARED_START_WITHHELD",
            f"{module} predecessor state",
        )
        audit.equal(packet.get("startTokenId"), None, f"{module} predecessor token")
        audit.equal(
            packet.get("pathPolicy", {}).get("allowedPaths"),
            spec["allowedPaths"],
            f"{module} allowed paths",
        )
        audit.equal(
            packet.get("pathPolicy", {}).get("protectedPaths"),
            spec["protectedPaths"],
            f"{module} protected paths",
        )
        audit.equal(
            packet.get("pathPolicySha256"),
            spec["pathPolicySha256"],
            f"{module} path policy hash",
        )
        audit.equal(
            packet.get("dependencyPinsSha256"),
            spec["dependencyPinsSha256"],
            f"{module} dependency pins hash",
        )
        audit.require(
            packet.get("authority", {}).get("sourceChangeAuthorized") is False,
            f"{module} predecessor authority leak",
        )


def committed_blob_evidence(
    root: Path,
    commit: str,
    repo: str,
    relative_path: str,
    audit: Audit,
) -> tuple[dict[str, Any], bytes]:
    code, listing_raw = run_git(
        root,
        ["ls-tree", "--full-tree", commit, "--", relative_path],
    )
    audit.equal(code, 0, f"{repo}:{relative_path} committed tree lookup")
    lines = listing_raw.decode("utf-8", errors="replace").strip().splitlines()
    audit.equal(len(lines), 1, f"{repo}:{relative_path} exact committed blob count")
    mode = object_type = object_id = listed_path = ""
    if len(lines) == 1 and "\t" in lines[0]:
        metadata, listed_path = lines[0].split("\t", 1)
        parts = metadata.split()
        if len(parts) == 3:
            mode, object_type, object_id = parts
    audit.equal(listed_path, relative_path, f"{repo}:{relative_path} exact committed path")
    audit.require(mode in {"100644", "100755"}, f"{repo}:{relative_path} regular blob mode")
    audit.equal(object_type, "blob", f"{repo}:{relative_path} object type")
    code, raw = run_git(root, ["cat-file", "blob", f"{commit}:{relative_path}"])
    audit.equal(code, 0, f"{repo}:{relative_path} committed blob read")
    return (
        {
            "repo": repo,
            "path": relative_path,
            "gitBlobSha1": object_id,
            "byteLength": len(raw),
            "contentSha256": sha256_bytes(raw),
        },
        raw,
    )


def expected_control_request_results(
    frontend: Path,
    backend: Path,
    pins: dict[str, dict[str, Any]],
    audit: Audit,
) -> list[dict[str, Any]]:
    audit.equal(list(CONTROL_EVIDENCE_SPECS), CONTROL_REQUESTS, "Control evidence request closed set")
    roots = {"frontend": frontend, "backend": backend}
    results: list[dict[str, Any]] = []
    for request_id in CONTROL_REQUESTS:
        declared, markers = CONTROL_EVIDENCE_SPECS[request_id]
        ordered = sorted(declared)
        audit.equal(len(ordered), len(set(ordered)), f"{request_id} unique evidence paths")
        artifacts: list[dict[str, Any]] = []
        raws: dict[tuple[str, str], bytes] = {}
        for repo, relative_path in ordered:
            artifact, raw = committed_blob_evidence(
                roots[repo], str(pins.get(repo, {}).get("commit", "")), repo, relative_path, audit
            )
            artifacts.append(artifact)
            raws[(repo, relative_path)] = raw
        for repo, relative_path, marker in markers:
            audit.require(
                marker.encode("utf-8") in raws.get((repo, relative_path), b""),
                f"{request_id} semantic marker {marker!r} in {repo}:{relative_path}",
            )
        evidence = {"schema": CONTROL_EVIDENCE_SCHEMA, "artifacts": artifacts}
        digest_payload = {
            "schema": CONTROL_EVIDENCE_SCHEMA,
            "requestId": request_id,
            "artifacts": artifacts,
        }
        results.append(
            {
                "requestId": request_id,
                "module": "SYS" if request_id in CONTROL_REQUESTS[:4] else "HRM",
                "status": "PASS",
                "evidence": evidence,
                "evidenceSha256": sha256_bytes(canonical_bytes(digest_payload)),
            }
        )
    return results


def expected_control_window(
    frontend: Path,
    backend: Path,
    pins: dict[str, dict[str, Any]],
    audit: Audit,
) -> tuple[str, str]:
    instants: list[datetime] = []
    for repo, root in (("frontend", frontend), ("backend", backend)):
        value = git_text(
            root,
            ["show", "-s", "--format=%cI", str(pins.get(repo, {}).get("commit", ""))],
            f"{repo} source-result commit time",
            audit,
        )
        parsed = parse_instant(value, f"{repo} source-result commit time", audit)
        if parsed is not None:
            instants.append(parsed)
    if len(instants) != 2:
        return "", ""
    issued = max(instants).astimezone(timezone.utc).replace(microsecond=0)
    expires = issued + CONTROL_VALIDITY

    def render(value: datetime) -> str:
        return value.isoformat(timespec="seconds").replace("+00:00", "Z")

    return render(issued), render(expires)


def expected_control_verification(
    pins: dict[str, dict[str, Any]], request_results: list[dict[str, Any]]
) -> list[dict[str, str]]:
    payloads = [
        ("CONTROL_RESULT_ANCESTORS", {"requiredAncestors": CONTROL_RESULT_ANCESTORS}),
        ("CENTRAL_REPOSITORIES_CLEAN_PUSHED", {"repositoryPins": pins}),
        ("CONTROL_REQUEST_EVIDENCE_CLOSED_SET", {"requestResults": request_results}),
        (
            "PREDECESSOR_AUTHORITY_PINS_UNCHANGED",
            {
                "predecessorPins": PREDECESSOR_PINS,
                "packetPins": {
                    module: {"path": spec["packetPath"], "sha256": spec["packetSha256"]}
                    for module, spec in MODULES.items()
                },
            },
        ),
    ]
    return [
        {
            "checkId": check_id,
            "result": "PASS",
            "algorithm": "SHA-256/CANONICAL-JSON",
            "evidenceSha256": sha256_bytes(canonical_bytes(payload)),
        }
        for check_id, payload in payloads
    ]


def verify_control_receipt(
    frontend: Path,
    backend: Path,
    live_pins: dict[str, dict[str, Any]],
    audit: Audit,
) -> tuple[dict[str, Any], bytes]:
    path = frontend / CONTROL_RECEIPT_REL
    audit.require(path.is_file(), "Control bootstrap completion receipt missing")
    if not path.is_file():
        return {}, b""
    raw = path.read_bytes()
    receipt = read_json(path, audit)
    verify_seal(receipt, "Control completion receipt", audit)
    audit.exact_keys(
        receipt,
        {
            "schema",
            "receiptId",
            "status",
            "issuedAt",
            "expiresAt",
            "issuedBy",
            "frontendPin",
            "backendPin",
            "requestResults",
            "verification",
            "authority",
            "sealedPayloadSha256",
        },
        "Control completion receipt",
    )
    audit.equal(
        receipt.get("schema"),
        "dwp.hris.g7-control-bootstrap-completion.v2",
        "Control receipt schema",
    )
    audit.equal(receipt.get("receiptId"), CONTROL_RECEIPT_ID, "Control receipt ID")
    audit.equal(
        receipt.get("issuedBy"),
        "SYS_COMMON_INTEGRATION_CONTROL",
        "Control receipt issuer",
    )
    audit.equal(
        receipt.get("status"),
        "PASS_SYS_HRM_CONTROL_BOOTSTRAP",
        "Control receipt status",
    )
    frontend_source_pin = receipt.get("frontendPin", {})
    backend_source_pin = receipt.get("backendPin", {})
    audit.require(isinstance(frontend_source_pin, dict), "Control frontend source pin absent")
    audit.require(isinstance(backend_source_pin, dict), "Control backend source pin absent")
    if isinstance(frontend_source_pin, dict):
        verify_frontend_authority_carrier(
            frontend, frontend_source_pin, live_pins["frontend"], audit
        )
    audit.equal(backend_source_pin, live_pins["backend"], "Control backend pin")
    source_pins = {
        "frontend": frontend_source_pin if isinstance(frontend_source_pin, dict) else {},
        "backend": backend_source_pin if isinstance(backend_source_pin, dict) else {},
    }
    for repo, root in (("frontend", frontend), ("backend", backend)):
        commit = str(source_pins[repo].get("commit", ""))
        code, _raw = run_git(
            root,
            ["merge-base", "--is-ancestor", CONTROL_RESULT_ANCESTORS[repo], commit],
        )
        audit.equal(code, 0, f"{repo} final Control result ancestry")
    issued = parse_instant(receipt.get("issuedAt"), "Control issuedAt", audit)
    expires = parse_instant(receipt.get("expiresAt"), "Control expiresAt", audit)
    if issued is not None and expires is not None:
        audit.require(expires > issued, "Control receipt expiry is not after issue")
        audit.equal(expires - issued, CONTROL_VALIDITY, "Control receipt exact seven-day validity")
    expected_issued, expected_expires = expected_control_window(
        frontend, backend, source_pins, audit
    )
    audit.equal(receipt.get("issuedAt"), expected_issued, "Control deterministic issuedAt")
    audit.equal(receipt.get("expiresAt"), expected_expires, "Control deterministic expiresAt")
    results = receipt.get("requestResults", [])
    audit.require(isinstance(results, list), "Control requestResults is not a list")
    if isinstance(results, list):
        audit.equal(
            [row.get("requestId") for row in results if isinstance(row, dict)],
            CONTROL_REQUESTS,
            "Control request closed set and order",
        )
        for row in results:
            if isinstance(row, dict):
                audit.exact_keys(
                    row,
                    {"requestId", "module", "status", "evidence", "evidenceSha256"},
                    f"{row.get('requestId')} result",
                )
                expected_module = (
                    "SYS" if row.get("requestId") in CONTROL_REQUESTS[:4] else "HRM"
                )
                audit.equal(
                    row.get("module"),
                    expected_module,
                    f"{row.get('requestId')} module",
                )
                audit.equal(row.get("status"), "PASS", f"{row.get('requestId')} status")
                audit.require(
                    re.fullmatch(r"[0-9a-f]{64}", str(row.get("evidenceSha256", "")))
                    is not None,
                    f"{row.get('requestId')} evidence hash",
                )
    expected_results = expected_control_request_results(
        frontend, backend, source_pins, audit
    )
    audit.equal(results, expected_results, "Control committed request evidence")
    verification = receipt.get("verification", [])
    audit.require(isinstance(verification, list) and bool(verification), "Control verification empty")
    if isinstance(verification, list):
        audit.require(
            all(isinstance(row, dict) and row.get("result") == "PASS" for row in verification),
            "Control verification contains non-PASS result",
        )
        for index, row in enumerate(verification):
            if isinstance(row, dict):
                audit.exact_keys(
                    row,
                    {"checkId", "result", "algorithm", "evidenceSha256"},
                    f"Control verification[{index}]",
                )
    audit.equal(
        verification,
        expected_control_verification(source_pins, expected_results),
        "Control deterministic verification facts",
    )
    expected_authority = {
        "controlBootstrapComplete": True,
        "moduleSourceChangeAuthorized": False,
        "sharedControlPathChangeAuthorizedForModules": False,
        "integrationMergeAuthorized": False,
        "customerDataAuthorized": False,
        "customerActivationAuthorized": False,
        "productionReleaseAuthorized": False,
    }
    audit.equal(receipt.get("authority"), expected_authority, "Control fail-closed authority")
    return receipt, raw


def verify_frontend_authority_carrier(
    frontend: Path,
    source_pin: dict[str, Any],
    live_pin: dict[str, Any],
    audit: Audit,
) -> None:
    audit.exact_keys(
        source_pin,
        REPOSITORY_PIN_KEYS,
        "Control frontend source repository pin",
    )
    expected_shape = {
        "branch": CENTRAL_REPOSITORIES["frontend"][0],
        "upstream": CENTRAL_REPOSITORIES["frontend"][1],
        "clean": True,
        "upstreamMatched": True,
        "stateSha256": EMPTY_SHA256,
    }
    for key, expected in expected_shape.items():
        audit.equal(source_pin.get(key), expected, f"Control frontend source pin {key}")
    commit = str(source_pin.get("commit", ""))
    tree = str(source_pin.get("tree", ""))
    audit.require(re.fullmatch(r"[0-9a-f]{40}", commit) is not None, "Control frontend source commit invalid")
    audit.require(re.fullmatch(r"[0-9a-f]{40}", tree) is not None, "Control frontend source tree invalid")
    if re.fullmatch(r"[0-9a-f]{40}", commit):
        actual_tree = git_text(
            frontend,
            ["rev-parse", f"{commit}^{{tree}}"],
            "Control frontend source tree",
            audit,
        )
        audit.equal(actual_tree, tree, "Control frontend source tree pin")
        for relative_path in sorted(AUTHORITY_CARRIER_PATHS):
            code, source_listing = run_git(
                frontend,
                [
                    "ls-tree",
                    "-r",
                    "--name-only",
                    commit,
                    "--",
                    relative_path,
                ],
            )
            audit.equal(
                code,
                0,
                f"Control source authority absence lookup {relative_path}",
            )
            audit.equal(
                source_listing,
                b"",
                f"Control source authority path absent {relative_path}",
            )
        code, _raw = run_git(frontend, ["merge-base", "--is-ancestor", commit, "HEAD"])
        audit.equal(code, 0, "Control frontend source is ancestor of authority carrier")
        code, changed_raw = run_git(frontend, ["diff", "--name-only", f"{commit}..HEAD"])
        audit.equal(code, 0, "Control frontend authority carrier diff command")
        changed = changed_raw.decode("utf-8", errors="replace").splitlines()
        unexpected = sorted(set(changed) - AUTHORITY_CARRIER_PATHS)
        audit.equal(unexpected, [], "Control frontend authority carrier path boundary")
    audit.equal(live_pin.get("branch"), source_pin.get("branch"), "frontend carrier/source branch")


def verify_migration_boundaries(
    backend: Path, backend_pin: dict[str, Any], audit: Audit
) -> dict[str, dict[str, Any]]:
    commit = str(backend_pin.get("commit", ""))
    audit.require(
        re.fullmatch(r"[0-9a-f]{40}", commit) is not None,
        "Control backend commit pin invalid",
    )
    result: dict[str, dict[str, Any]] = {}
    for module, spec in MODULES.items():
        root = backend / spec["streamRoot"]
        audit.require(root.is_dir(), f"{module} migration root missing")
        versions = []
        if root.is_dir():
            for path in root.iterdir():
                match = re.fullmatch(r"V([0-9]+)__.+\.sql", path.name)
                if match and path.is_file():
                    versions.append(int(match.group(1)))
        audit.equal(max(versions, default=0), spec["highWater"], f"{module} high-water")
        target = backend / spec["migrationPath"]
        if spec["migrationAuthorityMode"] == "ADMITTED_EXACT_LEASE":
            audit.require(not target.exists(), f"{module} leased migration path occupied")
            continue

        audit.require(target.is_file(), f"{module} Control-owned migration missing")
        code, committed_raw = run_git(
            backend, ["show", f"{commit}:{spec['migrationPath']}"]
        )
        audit.equal(code, 0, f"{module} Control-owned migration commit lookup")
        working_raw = target.read_bytes() if target.is_file() else b""
        audit.equal(
            working_raw,
            committed_raw,
            f"{module} Control-owned migration pinned bytes",
        )
        result[module] = {
            "mode": "CONTROL_BOOTSTRAP_READ_ONLY_PIN",
            "exactRelativePath": spec["migrationPath"],
            "sha256": sha256_bytes(committed_raw),
            "frozenBackendCommit": commit,
            "state": "CONTROL_BOOTSTRAP_CONSUMED_READ_ONLY",
            "migrationEditAuthorized": False,
        }
    return result


def expected_worktree_identity(
    module: str, repo: str, worktree_root: Path
) -> tuple[Path, str, str]:
    slug = MODULES[module]["worktreeSlug"]
    branch = f"codex/hris-g7-{slug}-{repo}-20261012-r2"
    return worktree_root / slug / repo, branch, f"origin/{branch}"


def verify_register_and_worktrees(
    frontend: Path,
    worktree_root: Path,
    central_pins: dict[str, dict[str, Any]],
    audit: Audit,
) -> tuple[list[dict[str, str]], bytes]:
    path = frontend / SUCCESSOR_ROOT_REL / "registers/module-worktrees.active.v2.csv"
    audit.require(path.is_file(), "R2 active worktree register missing")
    if not path.is_file():
        return [], b""
    raw = path.read_bytes()
    try:
        reader = csv.DictReader(io.StringIO(raw.decode("utf-8")))
        rows = list(reader)
        fields = reader.fieldnames
    except Exception as exc:  # noqa: BLE001
        audit.require(False, f"cannot parse worktree register: {exc}")
        return [], raw
    audit.equal(fields, CSV_FIELDS, "worktree register header")
    audit.equal(len(rows), 4, "active worktree row count")
    audit.equal(Counter(row.get("module") for row in rows), Counter({"SYS": 2, "HRM": 2}), "worktree modules")
    audit.equal(Counter(row.get("repo") for row in rows), Counter({"frontend": 2, "backend": 2}), "worktree repositories")
    expected_order = [(module, repo) for module in MODULES for repo in ("frontend", "backend")]
    audit.equal([(row.get("module"), row.get("repo")) for row in rows], expected_order, "worktree row order")
    for row in rows:
        module = row.get("module", "")
        repo = row.get("repo", "")
        if module not in MODULES or repo not in CENTRAL_REPOSITORIES:
            continue
        root, branch, upstream = expected_worktree_identity(module, repo, worktree_root)
        pin = inspect_repository(root, branch, upstream, f"{module} {repo} worktree", audit)
        expected = {
            "module": module,
            "slice_id": MODULES[module]["sliceId"],
            "token_id": MODULES[module]["tokenId"],
            "repo": repo,
            "absolute_path": str(root),
            "branch": branch,
            "upstream": upstream,
            "head": pin.get("commit"),
            "tree": pin.get("tree"),
            "state_sha256": pin.get("stateSha256"),
            "clean": "true",
            "ahead": "0",
            "behind": "0",
            "state": "CREATED_PUSHED_CLEAN",
        }
        audit.equal(row, expected, f"{module} {repo} register/live binding")
        audit.equal(pin.get("commit"), central_pins[repo].get("commit"), f"{module} {repo} Control base commit")
        audit.equal(pin.get("tree"), central_pins[repo].get("tree"), f"{module} {repo} Control base tree")
    return rows, raw


def verify_lease_delta(
    frontend: Path,
    backend_pin: dict[str, Any],
    migration_prerequisites: dict[str, dict[str, Any]],
    control: dict[str, Any],
    audit: Audit,
) -> tuple[dict[str, Any], bytes]:
    path = frontend / SUCCESSOR_ROOT_REL / "migration-leases.delta.v2.json"
    audit.require(path.is_file(), "R2 lease delta missing")
    if not path.is_file():
        return {}, b""
    raw = path.read_bytes()
    delta = read_json(path, audit)
    verify_seal(delta, "R2 lease delta", audit)
    audit.exact_keys(
        delta,
        {
            "schema",
            "issuedAt",
            "predecessorRegister",
            "leases",
            "closedPredecessorLeases",
            "historicalRangesAreAuthority",
            "openEndedVersionsAllowed",
            "sealedPayloadSha256",
        },
        "R2 lease delta",
    )
    audit.equal(delta.get("schema"), "dwp.hris.g7-migration-lease-delta.v2", "lease delta schema")
    audit.equal(delta.get("issuedAt"), control.get("issuedAt"), "lease delta issuedAt")
    audit.equal(delta.get("predecessorRegister"), PREDECESSOR_PINS["migrationLeaseRegister"], "lease predecessor pin")
    leases = delta.get("leases", [])
    audit.equal([row.get("module") for row in leases if isinstance(row, dict)], ["SYS"], "lease module order")
    by_module = {row.get("module"): row for row in leases if isinstance(row, dict)}
    spec = MODULES["SYS"]
    lease = by_module.get("SYS", {})
    verify_seal(lease, "SYS R2 lease", audit)
    audit.exact_keys(
        lease,
        {
            "leaseId",
            "supersedesLeaseId",
            "supersededLeaseDigestSha256",
            "module",
            "sliceId",
            "stream",
            "streamRoot",
            "frozenBackendCommit",
            "frozenHighWater",
            "version",
            "exactRelativePath",
            "schemaEffect",
            "status",
            "ownerTokenId",
            "reservedForPacketId",
            "issuedAt",
            "expiresAt",
            "invalidationConditions",
            "migrationAdmissionAuthorized",
            "sealedPayloadSha256",
        },
        "SYS R2 lease",
    )
    expected = {
        "leaseId": spec["leaseId"],
        "supersedesLeaseId": spec["predecessorLeaseId"],
        "supersededLeaseDigestSha256": spec["predecessorLeaseDigestSha256"],
        "module": "SYS",
        "sliceId": spec["sliceId"],
        "stream": spec["stream"],
        "streamRoot": spec["streamRoot"],
        "frozenBackendCommit": backend_pin.get("commit"),
        "frozenHighWater": spec["highWater"],
        "version": spec["version"],
        "exactRelativePath": spec["migrationPath"],
        "schemaEffect": spec["schemaEffect"],
        "status": "ADMITTED_DOMAIN_AUTHORING",
        "ownerTokenId": spec["tokenId"],
        "reservedForPacketId": spec["packetId"],
        "issuedAt": control.get("issuedAt"),
        "expiresAt": control.get("expiresAt"),
        "invalidationConditions": [
            "final Control backend commit or migration high-water changes",
            "another migration claims the exact version or path",
            "the R2 token expires, is revoked, or changes scope",
        ],
        "migrationAdmissionAuthorized": True,
    }
    for key, value in expected.items():
        audit.equal(lease.get(key), value, f"SYS lease {key}")
    hrm_prerequisite = migration_prerequisites.get("HRM", {})
    expected_closed = [
        {
            "leaseId": MODULES["SYS"]["predecessorLeaseId"],
            "state": "SUPERSEDED_UNCONSUMED",
            "successorLeaseId": MODULES["SYS"]["leaseId"],
        },
        {
            "leaseId": MODULES["HRM"]["predecessorLeaseId"],
            "state": "CONSUMED_BY_CONTROL_BOOTSTRAP",
            "consumedByBackendCommit": hrm_prerequisite.get("frozenBackendCommit"),
            "exactRelativePath": hrm_prerequisite.get("exactRelativePath"),
            "migrationSha256": hrm_prerequisite.get("sha256"),
            "successorLeaseId": None,
        },
    ]
    audit.equal(delta.get("closedPredecessorLeases"), expected_closed, "closed predecessor leases")
    audit.require(delta.get("historicalRangesAreAuthority") is False, "historical lease range became authority")
    audit.require(delta.get("openEndedVersionsAllowed") is False, "open-ended migration versions allowed")
    return delta, raw


def expected_domain_authority(module: str) -> dict[str, Any]:
    spec = MODULES[module]
    return {
        "domainAuthoringOnly": True,
        "exactWorktreesOnly": True,
        "exactAllowedPathsOnly": True,
        "migrationAuthorityMode": spec["migrationAuthorityMode"],
        "migrationEditAuthorized": spec["migrationAuthorityMode"]
        == "ADMITTED_EXACT_LEASE",
        "commitAndPushTokenBranchesAuthorized": True,
        "sharedControlPathChangeAuthorized": False,
        "integrationMergeAuthorized": False,
        "customerDataAuthorized": False,
        "customerActivationAuthorized": False,
        "productionReleaseAuthorized": False,
    }


def verify_effective_boundary(
    module: str,
    token: dict[str, Any],
    central_pins: dict[str, dict[str, Any]],
    control: dict[str, Any],
    control_raw: bytes,
    register_rows: list[dict[str, str]],
    lease: dict[str, Any],
    migration_prerequisite: dict[str, Any],
    audit: Audit,
) -> None:
    spec = MODULES[module]
    common_fields = {
        "schema",
        "tokenId",
        "packetId",
        "packetPath",
        "packetFileSha256",
        "sliceId",
        "module",
        "sessionId",
        "issuedAt",
        "issuedBy",
        "expiresAt",
        "activationReceiptId",
        "state",
        "predecessorAuthority",
        "executionBasePins",
        "worktreeBindings",
        "effectiveAllowedPaths",
        "protectedPaths",
        "pathPolicySha256",
        "dependencyPinsSha256",
        "controlBootstrapReceiptSha256",
        "permittedAction",
        "invalidationConditions",
        "authority",
        "sealedPayloadSha256",
    }
    migration_fields = (
        {"migrationLeaseId", "migrationLeaseSha256"}
        if spec["migrationAuthorityMode"] == "ADMITTED_EXACT_LEASE"
        else {"controlOwnedMigrationPrerequisite"}
    )
    audit.exact_keys(token, common_fields | migration_fields, f"{module} token")
    expected_allowed = list(spec["allowedPaths"])
    if spec["migrationAuthorityMode"] == "ADMITTED_EXACT_LEASE":
        expected_allowed.append(f"backend:{spec['migrationPath']}")
    expected_protected = [
        *spec["protectedPaths"],
        *spec.get("additionalProtectedPaths", []),
    ]
    audit.equal(token.get("module"), module, f"{module} token module")
    audit.equal(
        token.get("schema"),
        "dwp.hris.g7-module-start-token.v2",
        f"{module} token schema",
    )
    audit.equal(token.get("tokenId"), spec["tokenId"], f"{module} token ID")
    audit.equal(token.get("packetId"), spec["packetId"], f"{module} token packet ID")
    audit.equal(token.get("packetPath"), spec["packetPath"], f"{module} packet path")
    audit.equal(token.get("packetFileSha256"), spec["packetSha256"], f"{module} packet raw hash")
    audit.equal(token.get("sliceId"), spec["sliceId"], f"{module} slice ID")
    audit.equal(token.get("sessionId"), spec["sessionId"], f"{module} session ID")
    audit.equal(token.get("issuedAt"), control.get("issuedAt"), f"{module} issuedAt")
    audit.equal(
        token.get("issuedBy"),
        "SYS_COMMON_INTEGRATION_CONTROL",
        f"{module} issuer",
    )
    audit.equal(token.get("expiresAt"), control.get("expiresAt"), f"{module} expiresAt")
    audit.equal(token.get("state"), "ISSUED_PENDING_PROMOTION_RECEIPT", f"{module} token state")
    audit.equal(token.get("activationReceiptId"), ACTIVATION_RECEIPT_ID, f"{module} activation receipt")
    audit.equal(token.get("executionBasePins"), central_pins, f"{module} execution base pins")
    audit.equal(token.get("effectiveAllowedPaths"), expected_allowed, f"{module} effective allowed paths")
    audit.equal(token.get("protectedPaths"), expected_protected, f"{module} protected paths")
    audit.equal(token.get("pathPolicySha256"), spec["pathPolicySha256"], f"{module} path policy hash")
    audit.equal(token.get("dependencyPinsSha256"), spec["dependencyPinsSha256"], f"{module} dependency pins")
    audit.equal(token.get("controlBootstrapReceiptSha256"), sha256_bytes(control_raw), f"{module} Control receipt hash")
    audit.equal(
        token.get("permittedAction"),
        "START_DOMAIN_MODULE_IMPLEMENTATION",
        f"{module} permitted action",
    )
    audit.equal(
        token.get("invalidationConditions"),
        [
            "promotion receipt does not list this exact token in the active closed set",
            "packet, token, Control receipt, worktree, migration authority, or execution base pin changes",
            "worktree is dirty, unpublished, ahead/behind, or on another branch",
            "an effective allowed-path or common-Control boundary is crossed",
            "the pinned migration boundary changes",
            "token expires or is revoked",
        ],
        f"{module} invalidation conditions",
    )
    if spec["migrationAuthorityMode"] == "ADMITTED_EXACT_LEASE":
        audit.equal(token.get("migrationLeaseId"), spec["leaseId"], f"{module} lease ID")
        audit.equal(token.get("migrationLeaseSha256"), lease.get("sealedPayloadSha256"), f"{module} lease seal")
        audit.equal(
            token.get("controlOwnedMigrationPrerequisite"),
            None,
            f"{module} Control migration prerequisite absent",
        )
    else:
        audit.equal(token.get("migrationLeaseId"), None, f"{module} lease ID absent")
        audit.equal(token.get("migrationLeaseSha256"), None, f"{module} lease seal absent")
        audit.equal(
            token.get("controlOwnedMigrationPrerequisite"),
            migration_prerequisite,
            f"{module} Control migration prerequisite",
        )
    expected_rows = [row for row in register_rows if row.get("module") == module]
    audit.equal(token.get("worktreeBindings"), expected_rows, f"{module} worktree bindings")
    audit.equal(token.get("authority"), expected_domain_authority(module), f"{module} authority")
    predecessor = token.get("predecessorAuthority", {})
    audit.equal(
        predecessor,
        {
            "receiptId": "HRIS-G7-EVIDENCE-PROMOTION-DELEGATION-20261012-R1",
            "receiptSha256": PREDECESSOR_PINS["promotionReceipt"]["sha256"],
            "packetLifecycleState": "PACKET_PREPARED_START_WITHHELD",
            "effectiveLifecycleStateAfterPromotion": "PACKET_AUTHORIZED_DOMAIN_AUTHORING",
            "overriddenFields": [
                "lifecycleState",
                "startTokenId",
                "basePins.frontend",
                "basePins.backend",
                "migrationLease",
                "authority.sourceChangeAuthorized",
                "authority.domainAuthoringOnly",
                "authority.commitAndPushTokenBranchesAuthorized",
            ],
        },
        f"{module} predecessor authority",
    )


def verify_tokens(
    frontend: Path,
    central_pins: dict[str, dict[str, Any]],
    control: dict[str, Any],
    control_raw: bytes,
    register_rows: list[dict[str, str]],
    lease_delta: dict[str, Any],
    migration_prerequisites: dict[str, dict[str, Any]],
    audit: Audit,
) -> tuple[dict[str, dict[str, Any]], dict[str, bytes]]:
    leases = {row.get("module"): row for row in lease_delta.get("leases", []) if isinstance(row, dict)}
    tokens = {}
    raws = {}
    for module, spec in MODULES.items():
        path = frontend / SUCCESSOR_ROOT_REL / spec["tokenRelativePath"]
        audit.require(path.is_file(), f"{module} R2 token missing")
        if not path.is_file():
            continue
        raw = path.read_bytes()
        token = read_json(path, audit)
        verify_seal(token, f"{module} R2 token", audit)
        audit.equal(token.get("schema"), "dwp.hris.g7-module-start-token.v2", f"{module} token schema")
        verify_effective_boundary(
            module,
            token,
            central_pins,
            control,
            control_raw,
            register_rows,
            leases.get(module, {}),
            migration_prerequisites.get(module, {}),
            audit,
        )
        tokens[module] = token
        raws[module] = raw
    return tokens, raws


def verify_state(
    frontend: Path,
    tokens: dict[str, dict[str, Any]],
    control: dict[str, Any],
    audit: Audit,
) -> tuple[dict[str, Any], bytes]:
    path = frontend / SUCCESSOR_ROOT_REL / "state/delegation-after-sys-hrm-promotion.v2.json"
    audit.require(path.is_file(), "R2 successor state missing")
    if not path.is_file():
        return {}, b""
    raw = path.read_bytes()
    state = read_json(path, audit)
    verify_seal(state, "R2 successor state", audit)
    audit.exact_keys(
        state,
        {
            "schema",
            "stateId",
            "state",
            "issuedAt",
            "activationReceiptId",
            "predecessor",
            "effectiveDelegations",
            "closedPredecessorTokens",
            "activeTokenClosedSetAfterPromotion",
            "withheld",
            "authority",
            "sealedPayloadSha256",
        },
        "R2 successor state",
    )
    audit.equal(state.get("schema"), "dwp.hris.g7-sys-hrm-successor-state.v2", "state schema")
    audit.equal(
        state.get("stateId"),
        "HRIS-G7-SYS-HRM-DELEGATION-STATE-20261012-R2",
        "state ID",
    )
    audit.equal(state.get("state"), "BUNDLE_SEALED_PENDING_PROMOTION_RECEIPT", "pre-promotion state")
    audit.equal(state.get("issuedAt"), control.get("issuedAt"), "state issuedAt")
    audit.equal(state.get("activationReceiptId"), ACTIVATION_RECEIPT_ID, "state activation receipt")
    audit.equal(state.get("predecessor"), {"manifest": PREDECESSOR_PINS["manifest"], "promotionReceipt": PREDECESSOR_PINS["promotionReceipt"]}, "state predecessor pins")
    audit.equal(state.get("closedPredecessorTokens"), CLOSED_PREDECESSOR_TOKENS, "state closed predecessor tokens")
    audit.equal(state.get("activeTokenClosedSetAfterPromotion"), ACTIVE_TOKEN_CLOSED_SET, "state active token closed set")
    expected_modules = [module for module in MODULES if module in tokens]
    delegations = state.get("effectiveDelegations", [])
    audit.equal([row.get("module") for row in delegations], expected_modules, "state effective delegation order")
    by_module = {row.get("module"): row for row in delegations if isinstance(row, dict)}
    for module in expected_modules:
        spec = MODULES[module]
        row = by_module.get(module, {})
        audit.equal(
            row.get("migrationAuthorityMode"),
            spec["migrationAuthorityMode"],
            f"{module} state migration mode",
        )
        expected_authority = (
            {"leaseId": spec["leaseId"]}
            if spec["migrationAuthorityMode"] == "ADMITTED_EXACT_LEASE"
            else tokens[module].get("controlOwnedMigrationPrerequisite")
        )
        audit.equal(
            row.get("migrationAuthority"),
            expected_authority,
            f"{module} state migration authority",
        )
        audit.equal(
            row,
            {
                "module": module,
                "sliceId": spec["sliceId"],
                "packetId": spec["packetId"],
                "predecessorPacketSha256": spec["packetSha256"],
                "effectivePacketStateAfterPromotion": "PACKET_AUTHORIZED_DOMAIN_AUTHORING",
                "tokenId": tokens[module]["tokenId"],
                "migrationAuthorityMode": spec["migrationAuthorityMode"],
                "migrationAuthority": expected_authority,
                "authority": "DOMAIN_AUTHORING_ONLY",
            },
            f"{module} state delegation",
        )
    audit.equal(
        state.get("withheld"),
        [
            {"module": "PAY", "state": "WITHHELD_PRODUCER_AND_NAMED_TESTS_REQUIRED"},
            {"module": "AGENT", "state": "NO_CANONICAL_SLICE_NO_PACKET"},
        ],
        "state withheld closed set",
    )
    audit.equal(
        state.get("authority"),
        {
            "moduleParallelDevelopmentAuthorizedAfterPromotion": True,
            "authorizedModulesAfterPromotion": ["SYS", "HRM"],
            "migrationAdmissionAuthorized": [MODULES["SYS"]["leaseId"]],
            "sharedControlPathChangeAuthorizedForModules": False,
            "integrationMergeAuthorized": False,
            "customerDataAuthorized": False,
            "customerActivationAuthorized": False,
            "productionReleaseAuthorized": False,
        },
        "state authority closed set",
    )
    return state, raw


def verify_manifest(
    frontend: Path,
    central_pins: dict[str, dict[str, Any]],
    control: dict[str, Any],
    control_raw: bytes,
    artifact_raws: dict[str, bytes],
    audit: Audit,
) -> tuple[dict[str, Any], bytes]:
    path = frontend / SUCCESSOR_ROOT_REL / "manifest.v2.json"
    audit.require(path.is_file(), "R2 manifest missing")
    if not path.is_file():
        return {}, b""
    raw = path.read_bytes()
    manifest = read_json(path, audit)
    verify_seal(manifest, "R2 manifest", audit)
    audit.exact_keys(
        manifest,
        {
            "schema",
            "manifestId",
            "issuedAt",
            "predecessorPins",
            "controlBootstrapReceipt",
            "executionBasePins",
            "activeTokenClosedSetAfterPromotion",
            "artifacts",
            "toolPins",
            "artifactCount",
            "sealedPayloadSha256",
        },
        "R2 manifest",
    )
    audit.equal(manifest.get("schema"), "dwp.hris.g7-sys-hrm-successor-manifest.v2", "manifest schema")
    audit.equal(
        manifest.get("manifestId"),
        "HRIS-G7-SYS-HRM-SUCCESSOR-MANIFEST-20261012-R2",
        "manifest ID",
    )
    audit.equal(manifest.get("issuedAt"), control.get("issuedAt"), "manifest issuedAt")
    audit.equal(manifest.get("predecessorPins"), PREDECESSOR_PINS, "manifest predecessor pins")
    audit.equal(manifest.get("executionBasePins"), central_pins, "manifest execution pins")
    audit.equal(manifest.get("activeTokenClosedSetAfterPromotion"), ACTIVE_TOKEN_CLOSED_SET, "manifest active token closed set")
    expected_control = {
        "path": str(CONTROL_RECEIPT_REL),
        "bytes": len(control_raw),
        "sha256": sha256_bytes(control_raw),
    }
    audit.equal(manifest.get("controlBootstrapReceipt"), expected_control, "manifest Control receipt pin")
    artifacts = manifest.get("artifacts", [])
    audit.equal(len(artifacts), 5, "manifest artifact list count")
    audit.equal(manifest.get("artifactCount"), 5, "manifest artifact count")
    actual_by_path = {row.get("path"): row for row in artifacts if isinstance(row, dict)}
    audit.equal(len(actual_by_path), len(artifacts), "manifest artifact path uniqueness")
    audit.equal(set(actual_by_path), set(artifact_raws), "manifest artifact closed set")
    for artifact_path, artifact_raw in artifact_raws.items():
        audit.equal(
            actual_by_path.get(artifact_path),
            {
                "path": artifact_path,
                "bytes": len(artifact_raw),
                "sha256": sha256_bytes(artifact_raw),
            },
            f"manifest artifact pin {artifact_path}",
        )
    tools = manifest.get("toolPins", [])
    actual_tools = {row.get("path"): row for row in tools if isinstance(row, dict)}
    audit.equal(len(tools), len(TOOL_RELATIVE_PATHS), "manifest tool list count")
    audit.equal(len(actual_tools), len(tools), "manifest tool path uniqueness")
    expected_paths = {str(SUCCESSOR_ROOT_REL / relative) for relative in TOOL_RELATIVE_PATHS}
    audit.equal(set(actual_tools), expected_paths, "manifest tool/schema closed set")
    for relative in TOOL_RELATIVE_PATHS:
        tool_path = frontend / SUCCESSOR_ROOT_REL / relative
        audit.require(tool_path.is_file(), f"manifest tool missing: {relative}")
        if tool_path.is_file():
            tool_raw = tool_path.read_bytes()
            key = str(SUCCESSOR_ROOT_REL / relative)
            audit.equal(
                actual_tools.get(key),
                {"path": key, "bytes": len(tool_raw), "sha256": sha256_bytes(tool_raw)},
                f"manifest tool pin {relative}",
            )
    return manifest, raw


def verify_promotion(
    frontend: Path,
    manifest_raw: bytes,
    tokens: dict[str, dict[str, Any]],
    token_raws: dict[str, bytes],
    control: dict[str, Any],
    audit: Audit,
) -> None:
    path = frontend / PROMOTION_RECEIPT_REL
    audit.require(path.is_file(), "R2 promotion receipt missing")
    if not path.is_file():
        return
    receipt_raw = path.read_bytes()
    receipt = read_json(path, audit)
    verify_seal(receipt, "R2 promotion receipt", audit)
    audit.exact_keys(
        receipt,
        {
            "schema",
            "receiptId",
            "issuedAt",
            "issuedBy",
            "status",
            "decision",
            "predecessor",
            "bundleCommit",
            "delegations",
            "closedPredecessorTokens",
            "activeTokenClosedSet",
            "authority",
            "sealedPayloadSha256",
        },
        "R2 promotion receipt",
    )
    audit.equal(receipt.get("schema"), "dwp.hris.g7-sys-hrm-promotion-receipt.v2", "promotion schema")
    audit.equal(receipt.get("receiptId"), ACTIVATION_RECEIPT_ID, "promotion receipt ID")
    audit.equal(receipt.get("issuedAt"), control.get("issuedAt"), "promotion issuedAt")
    audit.equal(
        receipt.get("issuedBy"),
        "SYS_COMMON_INTEGRATION_CONTROL",
        "promotion issuer",
    )
    audit.equal(receipt.get("status"), "PASS_SCOPED_DELEGATION", "promotion status")
    audit.equal(
        receipt.get("decision"),
        "SYS_HRM_DOMAIN_AUTHORING_AUTHORIZED_PER_TIM_PREDECESSOR_TOKENS_CLOSED",
        "promotion decision",
    )
    audit.equal(receipt.get("closedPredecessorTokens"), CLOSED_PREDECESSOR_TOKENS, "promotion closed predecessor tokens")
    audit.equal(receipt.get("activeTokenClosedSet"), ACTIVE_TOKEN_CLOSED_SET, "promotion active token closed set")
    audit.equal(
        receipt.get("predecessor"),
        {
            "manifest": PREDECESSOR_PINS["manifest"],
            "promotionReceipt": PREDECESSOR_PINS["promotionReceipt"],
        },
        "promotion predecessor pins",
    )
    delegations = receipt.get("delegations", [])
    audit.equal([row.get("module") for row in delegations if isinstance(row, dict)], ["SYS", "HRM"], "promotion delegation order")
    by_module = {row.get("module"): row for row in delegations if isinstance(row, dict)}
    for module, spec in MODULES.items():
        row = by_module.get(module, {})
        audit.equal(row.get("tokenId"), spec["tokenId"], f"{module} promotion token")
        audit.equal(row.get("tokenSha256"), sha256_bytes(token_raws.get(module, b"")), f"{module} promotion token hash")
        audit.equal(row.get("packetSha256"), spec["packetSha256"], f"{module} promotion packet hash")
        audit.equal(
            row.get("migrationAuthorityMode"),
            spec["migrationAuthorityMode"],
            f"{module} promotion migration mode",
        )
        if spec["migrationAuthorityMode"] == "ADMITTED_EXACT_LEASE":
            audit.equal(row.get("migrationLeaseId"), spec["leaseId"], f"{module} promotion lease")
            audit.equal(
                row.get("migrationLeaseSha256"),
                tokens.get(module, {}).get("migrationLeaseSha256"),
                f"{module} promotion lease seal",
            )
            audit.equal(
                row.get("controlOwnedMigrationPrerequisite"),
                None,
                f"{module} promotion Control prerequisite absent",
            )
        else:
            audit.equal(row.get("migrationLeaseId"), None, f"{module} promotion lease absent")
            audit.equal(
                row.get("migrationLeaseSha256"),
                None,
                f"{module} promotion lease seal absent",
            )
            audit.equal(
                row.get("controlOwnedMigrationPrerequisite"),
                tokens.get(module, {}).get("controlOwnedMigrationPrerequisite"),
                f"{module} promotion Control prerequisite",
            )
        audit.equal(row.get("worktrees"), tokens.get(module, {}).get("worktreeBindings"), f"{module} promotion worktrees")
        expected_row = {
            "module": module,
            "sliceId": spec["sliceId"],
            "packetId": spec["packetId"],
            "packetSha256": spec["packetSha256"],
            "tokenId": spec["tokenId"],
            "tokenPath": str(SUCCESSOR_ROOT_REL / spec["tokenRelativePath"]),
            "tokenSha256": sha256_bytes(token_raws.get(module, b"")),
            "migrationAuthorityMode": spec["migrationAuthorityMode"],
            "worktrees": tokens.get(module, {}).get("worktreeBindings"),
            "effectivePacketState": "PACKET_AUTHORIZED_DOMAIN_AUTHORING",
            "authority": "DOMAIN_AUTHORING_ONLY",
        }
        if spec["migrationAuthorityMode"] == "ADMITTED_EXACT_LEASE":
            expected_row["migrationLeaseId"] = spec["leaseId"]
            expected_row["migrationLeaseSha256"] = tokens.get(module, {}).get(
                "migrationLeaseSha256"
            )
        else:
            expected_row["controlOwnedMigrationPrerequisite"] = tokens.get(
                module, {}
            ).get("controlOwnedMigrationPrerequisite")
        audit.equal(row, expected_row, f"{module} promotion delegation")
    audit.equal(
        receipt.get("authority"),
        {
            "moduleParallelDevelopmentAuthorized": True,
            "authorizedModules": ["SYS", "HRM"],
            "authorizedSlices": [
                MODULES["SYS"]["sliceId"],
                MODULES["HRM"]["sliceId"],
            ],
            "startTokensIssued": ACTIVE_TOKEN_CLOSED_SET,
            "migrationAdmissionAuthorized": [MODULES["SYS"]["leaseId"]],
            "sharedControlPathChangeAuthorizedForModules": False,
            "integrationMergeAuthorized": False,
            "customerDataAuthorized": False,
            "customerActivationAuthorized": False,
            "productionReleaseAuthorized": False,
        },
        "promotion authority closed set",
    )
    bundle = receipt.get("bundleCommit", {})
    audit.exact_keys(
        bundle,
        {
            "commit",
            "tree",
            "manifestPath",
            "manifestSha256",
            "selfReferenceRule",
        },
        "promotion bundle commit",
    )
    commit = bundle.get("commit", "")
    tree = bundle.get("tree", "")
    audit.require(re.fullmatch(r"[0-9a-f]{40}", commit) is not None, "promotion bundle commit invalid")
    audit.require(re.fullmatch(r"[0-9a-f]{40}", tree) is not None, "promotion bundle tree invalid")
    actual_tree = git_text(frontend, ["rev-parse", f"{commit}^{{tree}}"], "promotion bundle tree", audit)
    audit.equal(actual_tree, tree, "promotion bundle tree pin")
    code, committed_manifest = run_git(
        frontend, ["show", f"{commit}:{SUCCESSOR_ROOT_REL / 'manifest.v2.json'}"]
    )
    audit.equal(code, 0, "promotion committed manifest command")
    audit.equal(committed_manifest, manifest_raw, "promotion committed manifest bytes")
    audit.equal(bundle.get("manifestSha256"), sha256_bytes(manifest_raw), "promotion manifest hash")
    audit.equal(
        bundle.get("manifestPath"),
        str(SUCCESSOR_ROOT_REL / "manifest.v2.json"),
        "promotion manifest path",
    )
    audit.equal(
        bundle.get("selfReferenceRule"),
        "The promotion receipt is carried by a later commit and pins the immutable R2 bundle commit.",
        "promotion self-reference rule",
    )
    code, _ = run_git(frontend, ["merge-base", "--is-ancestor", str(commit), "HEAD"])
    audit.equal(code, 0, "promotion bundle commit ancestry")
    current_head = git_text(frontend, ["rev-parse", "HEAD^{commit}"], "promotion carrier head", audit)
    audit.require(current_head != commit, "promotion receipt is not carried by a later commit")
    code, receipt_in_bundle = run_git(
        frontend,
        ["ls-tree", "-r", "--name-only", str(commit), "--", str(PROMOTION_RECEIPT_REL)],
    )
    audit.equal(code, 0, "promotion receipt bundle lookup")
    audit.equal(receipt_in_bundle, b"", "promotion receipt absent from bundle commit")
    code, committed_receipt = run_git(frontend, ["show", f"HEAD:{PROMOTION_RECEIPT_REL}"])
    audit.equal(code, 0, "promotion receipt carrier lookup")
    audit.equal(committed_receipt, receipt_raw, "promotion receipt carrier bytes")


def verify_static_contract() -> None:
    """Small pure invariant used by self-tests as well as CLI startup."""
    if list(MODULES) != ["SYS", "HRM"]:
        raise AssertionError("module order must remain SYS, HRM")
    if list(CONTROL_EVIDENCE_SPECS) != CONTROL_REQUESTS:
        raise AssertionError("Control evidence request closed set drift")
    for request_id, (artifacts, markers) in CONTROL_EVIDENCE_SPECS.items():
        if len(artifacts) != len(set(artifacts)):
            raise AssertionError(f"{request_id} duplicate evidence artifact")
        if any((repo, path) not in artifacts for repo, path, _marker in markers):
            raise AssertionError(f"{request_id} marker escaped evidence closure")
    if ACTIVE_TOKEN_CLOSED_SET != [MODULES["SYS"]["tokenId"], MODULES["HRM"]["tokenId"]]:
        raise AssertionError("active token closed set drift")
    for module, spec in MODULES.items():
        effective = list(spec["allowedPaths"])
        if spec["migrationAuthorityMode"] == "ADMITTED_EXACT_LEASE":
            effective.append(f"backend:{spec['migrationPath']}")
        expected_count = 4 if module == "SYS" else 3
        if len(effective) != expected_count or len(set(effective)) != expected_count:
            raise AssertionError(f"{module} effective path boundary drift")
        protected = [
            *spec["protectedPaths"],
            *spec.get("additionalProtectedPaths", []),
        ]
        if any(path in effective for path in protected):
            raise AssertionError(f"{module} protected path admitted")
    if MODULES["HRM"].get("leaseId") is not None:
        raise AssertionError("HRM must not receive an R2 migration lease")
    if MODULES["SYS"].get("leaseId") != "G7-LEASE-SYS-PLATFORM-V325-R2":
        raise AssertionError("SYS exact V325 lease drift")
    sys_migration_path = f"backend:{MODULES['SYS']['migrationPath']}"
    sys_effective = [*MODULES["SYS"]["allowedPaths"], sys_migration_path]
    if sys_effective.count(sys_migration_path) != 1:
        raise AssertionError("SYS V325 exact path is not admitted")
    if (
        f"backend:{MODULES['HRM']['migrationPath']}"
        not in MODULES["HRM"].get("additionalProtectedPaths", [])
    ):
        raise AssertionError("HRM V54 must be an exact protected path")


def main() -> int:
    verify_static_contract()
    parser = argparse.ArgumentParser(
        description="Independently validate the Control, bundle, or promotion carrier phase."
    )
    parser.add_argument(
        "--phase", choices=("control", "bundle", "promotion"), default="bundle"
    )
    parser.add_argument("--frontend-root", type=Path, default=DEFAULT_FRONTEND)
    parser.add_argument("--backend-root", type=Path, default=DEFAULT_BACKEND)
    parser.add_argument("--worktree-root", type=Path, default=DEFAULT_WORKTREE_ROOT)
    args = parser.parse_args()

    frontend = args.frontend_root.resolve()
    backend = args.backend_root.resolve()
    worktree_root = args.worktree_root.resolve()
    audit = Audit()

    verify_successor_inventory(frontend, args.phase, audit)
    verify_predecessors(frontend, audit)
    live_pins = {
        repo: inspect_repository(
            frontend if repo == "frontend" else backend,
            CENTRAL_REPOSITORIES[repo][0],
            CENTRAL_REPOSITORIES[repo][1],
            f"central {repo}",
            audit,
        )
        for repo in ("frontend", "backend")
    }
    control, control_raw = verify_control_receipt(frontend, backend, live_pins, audit)
    execution_pins = {
        "frontend": control.get("frontendPin", live_pins["frontend"]),
        "backend": control.get("backendPin", live_pins["backend"]),
    }
    migration_prerequisites = verify_migration_boundaries(
        backend, execution_pins["backend"], audit
    )
    if args.phase == "control":
        audit.finish()
        return 0
    register_rows, register_raw = verify_register_and_worktrees(
        frontend, worktree_root, execution_pins, audit
    )
    lease_delta, lease_raw = verify_lease_delta(
        frontend,
        execution_pins["backend"],
        migration_prerequisites,
        control,
        audit,
    )
    tokens, token_raws = verify_tokens(
        frontend,
        execution_pins,
        control,
        control_raw,
        register_rows,
        lease_delta,
        migration_prerequisites,
        audit,
    )
    _state, state_raw = verify_state(frontend, tokens, control, audit)
    artifact_raws = {
        str(SUCCESSOR_ROOT_REL / "migration-leases.delta.v2.json"): lease_raw,
        str(SUCCESSOR_ROOT_REL / "registers/module-worktrees.active.v2.csv"): register_raw,
        str(SUCCESSOR_ROOT_REL / MODULES["SYS"]["tokenRelativePath"]): token_raws.get("SYS", b""),
        str(SUCCESSOR_ROOT_REL / MODULES["HRM"]["tokenRelativePath"]): token_raws.get("HRM", b""),
        str(SUCCESSOR_ROOT_REL / "state/delegation-after-sys-hrm-promotion.v2.json"): state_raw,
    }
    _manifest, manifest_raw = verify_manifest(
        frontend, execution_pins, control, control_raw, artifact_raws, audit
    )
    if args.phase == "promotion":
        verify_promotion(
            frontend, manifest_raw, tokens, token_raws, control, audit
        )
    audit.finish()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
