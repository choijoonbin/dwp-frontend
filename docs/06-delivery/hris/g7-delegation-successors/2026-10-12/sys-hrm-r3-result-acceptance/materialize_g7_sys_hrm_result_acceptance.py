#!/usr/bin/env python3
"""Materialize append-only SYS-007/HRM-010 result acceptance receipts.

This tool never modifies R2.  Its ``run-shared`` phase is the sole producer of
post-integration shared evidence: it executes the closed seven-command plan
once, without a shell, and writes deterministic evidence for a later carrier.
All other phases consume committed evidence and inspect exact Git objects.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timezone
from fnmatch import fnmatchcase
from pathlib import Path, PurePosixPath
from typing import Any, Callable, Iterable


HERE = Path(__file__).resolve().parent
DEFAULT_FRONTEND = HERE.parents[5]
DEFAULT_BACKEND = DEFAULT_FRONTEND.parent / "backend"
R3_ROOT_REL = Path(
    "docs/06-delivery/hris/g7-delegation-successors/2026-10-12/"
    "sys-hrm-r3-result-acceptance"
)
R2_ROOT_REL = Path(
    "docs/06-delivery/hris/g7-delegation-successors/2026-10-12/sys-hrm-r2"
)
R2_PROMOTION_REL = Path(
    "docs/06-delivery/hris/2026-10-12-g7-sys-hrm-promotion-receipt.v2.json"
)
R2_PROMOTION_CARRIER_COMMIT = "2fc4faa5d8631dda6a3cbabefeef9ba606feca52"
R2_PROMOTION_CARRIER_TREE = "06807365ae5d289eda8ca82a6cc5071abc315037"
R2_PROMOTION_RECEIPT_SHA256 = (
    "d09e250da60b797404109dca5342db7cb6806144b51e3f5c92cd2ebc9925d275"
)
TOOL_RELATIVE_PATHS = [
    "README.md",
    "contracts/module-test-evidence-input.schema.v3.json",
    "contracts/shared-verification-plan.schema.v3.json",
    "contracts/shared-verification-evidence-input.schema.v3.json",
    "contracts/result-admission-receipt.schema.v3.json",
    "contracts/integration-authorization-receipt.schema.v3.json",
    "contracts/closure-receipt.schema.v3.json",
    "control-prerequisites.patch",
    "materialize_g7_sys_hrm_result_acceptance.py",
    "validate_g7_sys_hrm_result_acceptance.py",
    "test_g7_sys_hrm_result_acceptance.py",
]
CENTRAL_BRANCHES = {
    "frontend": (
        "codex/hris-g1-integration-frontend-20261006",
        "origin/codex/hris-g1-integration-frontend-20261006",
    ),
    "backend": (
        "codex/hris-g1-integration-backend-20261006",
        "origin/codex/hris-g1-integration-backend-20261006",
    ),
}
DEFAULT_MODULE_ROOT = Path(
    "/Users/a10697/Work/DWP/.codex-worktrees/hris/g7-20261012-r2"
)
DEFAULT_MODULE_REPOS = {
    ("SYS", "frontend"): DEFAULT_MODULE_ROOT / "sys-007/frontend",
    ("SYS", "backend"): DEFAULT_MODULE_ROOT / "sys-007/backend",
    ("HRM", "frontend"): DEFAULT_MODULE_ROOT / "hrm-010/frontend",
    ("HRM", "backend"): DEFAULT_MODULE_ROOT / "hrm-010/backend",
}

MODULES = {
    "SYS": {
        "sliceId": "BASE-TFR-SYS-007",
        "tokenId": "G7-START-SYS-BASE-TFR-SYS-007-R2",
        "tokenPath": R2_ROOT_REL / "tokens/sys-007.start-token.v2.json",
        "migrationPath": (
            "dwp-platform-server/src/main/resources/db/migration/"
            "V325__create_hris_reference_configuration_lifecycle.sql"
        ),
    },
    "HRM": {
        "sliceId": "BASE-TFR-HRM-010",
        "tokenId": "G7-START-HRM-BASE-TFR-HRM-010-R2",
        "tokenPath": R2_ROOT_REL / "tokens/hrm-010.start-token.v2.json",
        "migrationPath": (
            "dwp-people-server/src/main/resources/db/migration/"
            "V54__create_employee_change_request_lifecycle.sql"
        ),
    },
}

EXPECTED_TEST_COMMANDS: dict[str, dict[str, Any]] = {
    "SYS_BACKEND_TARGETED": {
        "module": "SYS",
        "repo": "backend",
        "cwd": "backend",
        "argv": [
            "./gradlew",
            ":dwp-platform-server:test",
            "--tests",
            "*ReferenceConfiguration*",
            "--tests",
            "*SysIaEntryQueryContractTest",
            "-PhrisSlice=BASE-TFR-SYS-007",
            "--no-daemon",
        ],
    },
    "SYS_FRONTEND_TARGETED": {
        "module": "SYS",
        "repo": "frontend",
        "cwd": "frontend",
        "argv": [
            "yarn",
            "vitest",
            "run",
            "apps/dwp/src/features/hris/administration/reference-configuration",
        ],
    },
    "HRM_BACKEND_TARGETED": {
        "module": "HRM",
        "repo": "backend",
        "cwd": "backend",
        "argv": [
            "./gradlew",
            ":dwp-people-server:test",
            "--tests",
            "*EmployeeChange*",
            "--tests",
            "*HrmIaEntryQueryContractTest",
            "-PhrisSlice=BASE-TFR-HRM-010",
            "--no-daemon",
        ],
    },
    "HRM_FRONTEND_TARGETED": {
        "module": "HRM",
        "repo": "frontend",
        "cwd": "frontend",
        "argv": [
            "yarn",
            "vitest",
            "run",
            "apps/dwp/src/features/hris/employee-services/employee-change",
        ],
    },
}
EXPECTED_TEST_CLOSED_SET = list(EXPECTED_TEST_COMMANDS)
REQUIRED_SHARED_CATEGORIES = [
    "CONTRACT_AUTHORIZATION_SYNC",
    "SHARED_ROUTE_ACCESS",
    "TYPECHECK_ARCHITECTURE",
    "RESPONSIVE_ACCESSIBILITY",
]
EXPECTED_SHARED_BASIS = [
    "docs/06-delivery/hris/g7-delegation/2026-10-12/packets/sys-007.v1.json#/verificationBindings/controlOnlyAfterModuleResult",
    "docs/06-delivery/hris/g7-delegation/2026-10-12/packets/hrm-010.v1.json#/verificationBindings/controlOnlyAfterModuleResult",
]
SHARED_TEST_SOURCE_PATH = "e2e/hris-sys-hrm-responsive-accessibility.spec.ts"
SHARED_TEST_SOURCE_TEMPLATE_ID = "G7-SYS-HRM-RESPONSIVE-ACCESSIBILITY-V2"
CONTROL_PREREQUISITES_PATCH_PATH = (
    R3_ROOT_REL / "control-prerequisites.patch"
).as_posix()
CONTROL_PREREQUISITE_PATHS = [
    "apps/dwp/src/routes/product-route-contract-source.test.ts",
    "apps/dwp/src/routes/product-route-contract-source.ts",
    "apps/dwp/src/routes/product-route-contracts.generated.test.ts",
    "package.json",
    "scripts/internal-export-allowlist.json",
    "scripts/production-reachability-allowlist.json",
]
SHARED_TEST_SOURCE_BYTES = """import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { mockHcmProductSurfaceAuthority } from './support/product-surface-authority';
import { FULL_PRODUCT_PERMISSIONS, mockShellSession } from './support/shell-session';

const journeys = [
  {
    module: 'SYS',
    title:
      'SYS reference configuration integrated runtime is responsive and accessible',
    path: '/hr/settings/reference-data',
    workspace: 'hris-reference-configuration-workspace',
    apiPattern: '**/api/platform/v1/hris/workbench/settings-reference**',
    activeMarker: 'Reference configuration is unavailable',
  },
  {
    module: 'HRM',
    title:
      'HRM employee change integrated runtime is responsive and accessible',
    path: '/hr/operations/people/employee-change-requests',
    workspace: 'hris-employee-change-workspace',
    apiPattern: '**/api/people/v1/hris/workbench/operations/employee/change/requests**',
    activeMarker: 'Employee change requests',
  },
] as const;

const sourcePinAnnotations = [
  { type: 'g7-frontend-source-commit', environment: 'G7_FRONTEND_SOURCE_COMMIT' },
  { type: 'g7-frontend-source-tree', environment: 'G7_FRONTEND_SOURCE_TREE' },
  { type: 'g7-backend-source-commit', environment: 'G7_BACKEND_SOURCE_COMMIT' },
  { type: 'g7-backend-source-tree', environment: 'G7_BACKEND_SOURCE_TREE' },
] as const;

async function expectNoHorizontalOverflow(page: Page, path: string) {
  const geometry = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(geometry.content, `${path} must not overflow`).toBeLessThanOrEqual(
    geometry.viewport + 1
  );
}

for (const journey of journeys) {
  test(journey.title, async ({ page }) => {
    for (const pin of sourcePinAnnotations) {
      const description = process.env[pin.environment] ?? '';
      expect(description, `${pin.environment} must pin the exact runner source`).toMatch(
        /^[0-9a-f]{40}$/
      );
      test.info().annotations.push({ type: pin.type, description });
    }
    let ownerRequestCount = 0;
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mockShellSession(page, ['HR_ADMIN'], {
      locale: 'en',
      permissions: FULL_PRODUCT_PERMISSIONS,
      appearance: {
        mode: 'light',
        density: 'standard',
        highContrast: true,
        reduceMotion: true,
      },
    });
    await mockHcmProductSurfaceAuthority(page);
    await page.route(journey.apiPattern, (route) => {
      ownerRequestCount += 1;
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'ERROR',
          message: `${journey.module} owner data is unavailable for the resilience journey`,
          correlationId: `g7-${journey.module.toLowerCase()}-responsive-accessibility`,
        }),
      });
    });

    await page.goto(journey.path);
    const workspace = page.getByTestId(journey.workspace);
    await expect(workspace).toBeVisible();
    await expect(workspace).toHaveAttribute('data-runtime-state', 'ON');
    await expect(page.getByText(journey.activeMarker, { exact: true }).first()).toBeVisible();
    await expect
      .poll(() => ownerRequestCount, {
        message: `${journey.module} active runtime must issue its owner workbench request`,
      })
      .toBeGreaterThan(0);
    await page.addStyleTag({ content: ':root { font-size: 200% !important; }' });
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await expectNoHorizontalOverflow(page, journey.path);

    const accessibility = await new AxeBuilder({ page }).include('main').analyze();
    const blocking = accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    );
    expect(blocking, `${journey.path} must pass serious accessibility checks`).toEqual([]);
  });
}
""".encode("utf-8")
PLAYWRIGHT_COMMAND_ID = "CONTROL_RESPONSIVE_ACCESSIBILITY_PLAYWRIGHT"
PLAYWRIGHT_SPEC_TITLES = [
    "SYS reference configuration integrated runtime is responsive and accessible",
    "HRM employee change integrated runtime is responsive and accessible",
]
PLAYWRIGHT_PROJECTS = ["chromium", "mobile"]
PLAYWRIGHT_EXECUTION_PAIRS = [
    (project, title)
    for project in PLAYWRIGHT_PROJECTS
    for title in PLAYWRIGHT_SPEC_TITLES
]
SHARED_PROOF_KINDS = {
    "CONTROL_AUTHORIZATION_CHECK": "AUTHORIZATION_GENERATION_AND_SYNC_EXIT_ZERO",
    "CONTROL_BACKEND_OPENAPI_CHECK": "BACKEND_OPENAPI_APPROVED_SNAPSHOTS_EXIT_ZERO",
    "CONTROL_FRONTEND_OPENAPI_CHECK": "FRONTEND_OPENAPI_SYNC_EXIT_ZERO",
    "CONTROL_SHARED_ROUTE_ACCESS": "VITEST_EXACT_FOUR_ROUTE_ACCESS_TARGETS_EXIT_ZERO",
    "CONTROL_FRONTEND_TYPECHECK": "TYPESCRIPT_NO_EMIT_EXIT_ZERO",
    "CONTROL_FRONTEND_ARCHITECTURE": "ARCHITECTURE_CLOSED_SCRIPT_EXIT_ZERO",
    "CONTROL_RESPONSIVE_ACCESSIBILITY_PLAYWRIGHT": "PLAYWRIGHT_EXACT_INTEGRATED_JOURNEYS_EXIT_ZERO",
}
RUNNER_EXECUTION_MODE = "DIRECT_EXACT_ARGV_NO_SHELL"
SELF_TEST_EXECUTION_MODE = "SELF_TEST_STUB_SUBPROCESS"
RUNNER_GENESIS_SHA256 = "0" * 64
SOURCE_PIN_ENVIRONMENT = {
    "G7_FRONTEND_SOURCE_COMMIT": ("frontend", "commit"),
    "G7_FRONTEND_SOURCE_TREE": ("frontend", "tree"),
    "G7_BACKEND_SOURCE_COMMIT": ("backend", "commit"),
    "G7_BACKEND_SOURCE_TREE": ("backend", "tree"),
}
SOURCE_PIN_ANNOTATIONS = {
    "g7-frontend-source-commit": ("frontend", "commit"),
    "g7-frontend-source-tree": ("frontend", "tree"),
    "g7-backend-source-commit": ("backend", "commit"),
    "g7-backend-source-tree": ("backend", "tree"),
}
VITEST_COMMAND_ID = "CONTROL_SHARED_ROUTE_ACCESS"
VITEST_TARGETS = [
    "apps/dwp/src/routes/product-route-contracts.generated.test.ts",
    "apps/dwp/src/features/hris/shell/testing/hris-shell-navigation-contract.test.ts",
    "apps/dwp/src/features/hris/administration/reference-configuration/testing/hris-reference-configuration-workspace.test.tsx",
    "apps/dwp/src/features/hris/employee-services/employee-change/testing/hris-employee-change-workspace.test.tsx",
]
AUTHORIZATION_SUCCESS_PATTERN = (
    r"^PASS product surface authorization v1-v[1-9][0-9]* \([0-9a-f]{64}\); "
    r"[1-9][0-9]* PAGE routes closed\.$"
)
BACKEND_OPENAPI_SUCCESS_PATTERN = (
    r"^OpenAPI contracts verified: [1-9][0-9]* services, "
    r"[1-9][0-9]* public Gateway paths\.$"
)
FRONTEND_OPENAPI_SUCCESS_LINES = [
    "PASS generated Gateway API types match the approved OpenAPI snapshot.",
    "PASS generated Agent API types match the approved OpenAPI snapshot.",
]
ARCHITECTURE_SUCCESS_MARKERS = [
    ("APPROVAL_STITCH_SOURCE", r"^Approval Stitch source PASS: [1-9][0-9]* pairs, [0-9]+ rasters, [0-9]+ recorded fetch gaps; (?:source bytes, hashes, raster metadata and HTML tokens verified|source verification skipped \(APPROVAL_STITCH_SOURCE_DIR is not set\); tracked manifest verified)$"),
    ("APPROVAL_STITCH_EXTENSION", r"^Approval Stitch APR-17\.\.24 PASS: [1-9][0-9]* pairs; (?:source bytes, hashes, raster metadata and HTML tokens verified|source verification skipped \(APPROVAL_STITCH_EXTENSION_SOURCE_DIR is not set\); tracked manifest verified)$"),
    ("APPROVAL_TRACEABILITY", r"^Approval APR-17\.\.24 traceability PASS: [1-9][0-9]* frames, [1-9][0-9]* canonical areas, [0-9]+ supplemental areas, [1-9][0-9]* source states, [1-9][0-9]* viewport captures, [1-9][0-9]* supported commands, [0-9]+ unavailable controls, [1-9][0-9]* owner action contracts, [1-9][0-9]* high-risk routes$"),
    ("PRODUCT_AUTHORIZATION", AUTHORIZATION_SUCCESS_PATTERN),
    ("PRODUCT_INTERNAL_CLOSURE", r"^PASS internal closure [0-9]+/[1-9][0-9]* products, [0-9]+/[1-9][0-9]* PEP cells \([A-Z_]+\)\.$"),
    ("AUTHORIZATION_FIXTURES", r"^PASS [A-Za-z0-9._-]+ snapshot and generated TypeScript \([0-9a-f]{64}\)\.$"),
    ("APP_ARCHITECTURE", r"^PASS frontend application architecture: [1-9][0-9]* independent product applications, 1 independent platform shell, [1-9][0-9]* platform features, [1-9][0-9]* governed Product Surfaces, Gateway /api\.$"),
    ("ROUTE_COMPOSITION", r"^PASS route composition: [1-9][0-9]* independently deployed applications\.$"),
    ("FEATURE_BOUNDARIES", r"^PASS feature boundaries: product features do not import sibling implementations directly or through component re-export bridges\.$"),
    ("API_BOUNDARIES", r"^PASS API boundaries: frontend runtime calls are centralized through Gateway /api/\*\* clients\.$"),
    ("RELATIVE_IMPORT_CYCLES", r"^PASS relative import cycles: [1-9][0-9]* production modules checked\.$"),
    ("PRODUCTION_REACHABILITY", r"^PASS production reachability: [1-9][0-9]*/[1-9][0-9]* modules reachable from [1-9][0-9]* roots; [0-9]+ governed verification root\(s\)\.$"),
    ("INTERNAL_EXPORTS", r"^PASS internal exports: [1-9][0-9]* declarations checked; [0-9]+ exact documented exception\(s\)\.$"),
    ("SOURCE_SIZE", r"^PASS source-size budget: [1-9][0-9]* production files checked; [0-9]+ generated file\(s\) excluded; new files are limited to [1-9][0-9]* lines\.$"),
    ("MAINTENANCE_SOURCE_SIZE", r"^PASS maintenance source-size budget: [1-9][0-9]* test/tool files checked; [0-9]+ exact legacy exception\(s\); new files are limited to [1-9][0-9]* lines\.$"),
    ("READINESS_HEADER", r"^Product Surface production readiness evidence$"),
    ("READINESS_MANIFEST", r"^- manifest: product-surface-production-readiness\.v1$"),
    ("READINESS_STATUS", r"^- status: (?:READY|BLOCKED)$"),
    ("READINESS_COMPLETE", r"^- complete: [0-9]+/[1-9][0-9]*$"),
    ("READINESS_EXACT_PRODUCTS", r"^- exact product contracts: [0-9]+/[1-9][0-9]*$"),
    ("READINESS_INTERNAL_CLOSURE", r"^- internally closed products: [0-9]+/[1-9][0-9]*$"),
    ("READINESS_PEP", r"^- owner-service PEP cells: [0-9]+/[1-9][0-9]*$"),
    ("READINESS_RELEASE_CLOSURE", r"^- release-approved product closure: [0-9]+/12$"),
    ("READINESS_INTERNAL_PENDING", r"^- internal evidence pending: [0-9]+$"),
    ("READINESS_INCOMPLETE", r"^- incomplete release evidence: [0-9]+$"),
    ("READINESS_MODE", r"^- mode: schema and integrity only$"),
]
EXPECTED_SHARED_COMMANDS: list[dict[str, Any]] = [
    {
        "commandId": "CONTROL_AUTHORIZATION_CHECK",
        "category": "CONTRACT_AUTHORIZATION_SYNC",
        "repo": "frontend",
        "cwd": "frontend",
        "argv": ["corepack", "yarn", "authorization:check"],
    },
    {
        "commandId": "CONTROL_BACKEND_OPENAPI_CHECK",
        "category": "CONTRACT_AUTHORIZATION_SYNC",
        "repo": "backend",
        "cwd": "backend",
        "argv": [
            "python3",
            "scripts/export-openapi-contracts.py",
            "--check",
            "--approved-snapshots",
        ],
    },
    {
        "commandId": "CONTROL_FRONTEND_OPENAPI_CHECK",
        "category": "CONTRACT_AUTHORIZATION_SYNC",
        "repo": "frontend",
        "cwd": "frontend",
        "argv": ["corepack", "yarn", "openapi:check"],
    },
    {
        "commandId": "CONTROL_SHARED_ROUTE_ACCESS",
        "category": "SHARED_ROUTE_ACCESS",
        "repo": "frontend",
        "cwd": "frontend",
        "argv": [
            "corepack",
            "yarn",
            "vitest",
            "run",
            "apps/dwp/src/routes/product-route-contracts.generated.test.ts",
            "apps/dwp/src/features/hris/shell/testing/hris-shell-navigation-contract.test.ts",
            "apps/dwp/src/features/hris/administration/reference-configuration/testing/hris-reference-configuration-workspace.test.tsx",
            "apps/dwp/src/features/hris/employee-services/employee-change/testing/hris-employee-change-workspace.test.tsx",
            "--reporter=json",
        ],
    },
    {
        "commandId": "CONTROL_FRONTEND_TYPECHECK",
        "category": "TYPECHECK_ARCHITECTURE",
        "repo": "frontend",
        "cwd": "frontend",
        "argv": ["corepack", "yarn", "typecheck"],
    },
    {
        "commandId": "CONTROL_FRONTEND_ARCHITECTURE",
        "category": "TYPECHECK_ARCHITECTURE",
        "repo": "frontend",
        "cwd": "frontend",
        "argv": ["corepack", "yarn", "architecture:check"],
    },
    {
        "commandId": PLAYWRIGHT_COMMAND_ID,
        "category": "RESPONSIVE_ACCESSIBILITY",
        "repo": "frontend",
        "cwd": "frontend",
        "argv": [
            "env",
            "E2E_BASE_URL=http://127.0.0.1:4200",
            "E2E_REUSE_EXISTING_SERVER=false",
            "VITE_HRIS_REFERENCE_CONFIGURATION_ENABLED=true",
            "VITE_HRIS_EMPLOYEE_CHANGE_ENABLED=true",
            "corepack",
            "yarn",
            "playwright",
            "test",
            SHARED_TEST_SOURCE_PATH,
            "--project=chromium",
            "--project=mobile",
            "--workers=1",
            "--reporter=json",
        ],
    },
]
EXPECTED_SHARED_CLOSED_SET = [row["commandId"] for row in EXPECTED_SHARED_COMMANDS]
FRONTEND_CANONICAL_COMMAND_PATHS = [
    "package.json",
    "playwright.config.ts",
    "e2e/support/product-surface-authority.ts",
    "e2e/support/shell-session.ts",
    "scripts/sync-product-surface-authorization.mjs",
    "scripts/sync-openapi-contract.mjs",
    "scripts/sync-agent-openapi-contract.mjs",
    "scripts/check-approval-stitch-source.mjs",
    "scripts/check-approval-stitch-extension-source.mjs",
    "scripts/check-approval-admin-v2-design-traceability.mjs",
    "scripts/sync-product-surface-internal-closure.mjs",
    "scripts/sync-product-authorization-fixtures.mjs",
    "scripts/check-app-architecture.mjs",
    "scripts/generate-route-composition.mjs",
    "scripts/check-feature-boundaries.mjs",
    "scripts/check-api-boundaries.mjs",
    "scripts/check-relative-import-cycles.mjs",
    "scripts/check-production-reachability.mjs",
    "scripts/production-reachability-allowlist.json",
    "scripts/check-unused-internal-exports.mjs",
    "scripts/internal-export-allowlist.json",
    "scripts/check-source-size.mjs",
    "scripts/check-maintenance-source-size.mjs",
    "scripts/check-product-surface-production-readiness.mjs",
    "apps/dwp/src/routes/product-route-contract-source.ts",
    "apps/dwp/src/routes/product-route-contract-source.test.ts",
    "apps/dwp/src/routes/product-route-contracts.generated.test.ts",
    "apps/dwp/src/features/hris/shell/testing/hris-shell-navigation-contract.test.ts",
    "apps/dwp/src/features/hris/administration/reference-configuration/testing/hris-reference-configuration-workspace.test.tsx",
    "apps/dwp/src/features/hris/employee-services/employee-change/testing/hris-employee-change-workspace.test.tsx",
    SHARED_TEST_SOURCE_PATH,
]
BACKEND_CANONICAL_COMMAND_PATHS = ["scripts/export-openapi-contracts.py"]
CANONICAL_PACKAGE_SCRIPTS = {
    "authorization:check": "node scripts/sync-product-surface-authorization.mjs --check",
    "openapi:check": (
        "node scripts/sync-openapi-contract.mjs --check && "
        "node scripts/sync-agent-openapi-contract.mjs --check"
    ),
    "typecheck": "node --max-old-space-size=8192 ./node_modules/typescript/bin/tsc --noEmit",
    "architecture:check": (
        "node scripts/check-approval-stitch-source.mjs && "
        "node scripts/check-approval-stitch-extension-source.mjs && "
        "node scripts/check-approval-admin-v2-design-traceability.mjs && "
        "node scripts/sync-product-surface-authorization.mjs --check && "
        "node scripts/sync-product-surface-internal-closure.mjs --check && "
        "node scripts/sync-product-authorization-fixtures.mjs --check && "
        "node scripts/check-app-architecture.mjs && "
        "node scripts/generate-route-composition.mjs --check && "
        "node scripts/check-feature-boundaries.mjs && "
        "node scripts/check-api-boundaries.mjs && "
        "node scripts/check-relative-import-cycles.mjs && "
        "node scripts/check-production-reachability.mjs && "
        "node --max-old-space-size=8192 scripts/check-unused-internal-exports.mjs && "
        "node scripts/check-source-size.mjs && "
        "node scripts/check-maintenance-source-size.mjs && "
        "node scripts/check-product-surface-production-readiness.mjs"
    ),
}
CANONICAL_PACKAGE_DEPENDENCIES = [
    "@axe-core/playwright",
    "@playwright/test",
    "typescript",
    "vitest",
]
EMPTY_SHA256 = hashlib.sha256(b"").hexdigest()
RUN_ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]{2,63}$")
SHA1_RE = re.compile(r"^[0-9a-f]{40}$")
SHA256_RE = re.compile(r"^[0-9a-f]{64}$")


class GateError(RuntimeError):
    """Fail-closed validation error."""


def fail(message: str) -> None:
    raise GateError(message)


def canonical_bytes(value: Any) -> bytes:
    return json.dumps(
        value, sort_keys=True, separators=(",", ":"), ensure_ascii=False
    ).encode("utf-8")


def json_bytes(value: Any) -> bytes:
    return (json.dumps(value, indent=2, ensure_ascii=False) + "\n").encode("utf-8")


def sha256_bytes(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def sealed(payload: dict[str, Any]) -> dict[str, Any]:
    result = copy.deepcopy(payload)
    result.pop("sealedPayloadSha256", None)
    result["sealedPayloadSha256"] = sha256_bytes(canonical_bytes(result))
    return result


def verify_seal(value: dict[str, Any], label: str) -> None:
    digest = value.get("sealedPayloadSha256")
    unsealed = copy.deepcopy(value)
    unsealed.pop("sealedPayloadSha256", None)
    if not isinstance(digest, str) or digest != sha256_bytes(canonical_bytes(unsealed)):
        fail(f"{label}: invalid sealedPayloadSha256")


def expect_keys(value: dict[str, Any], keys: set[str], label: str) -> None:
    if set(value) != keys:
        fail(f"{label}: field set mismatch; expected {sorted(keys)}, got {sorted(value)}")


def run_git(repo: Path, *args: str, check: bool = True) -> bytes:
    completed = subprocess.run(
        ["git", "-C", str(repo), *args],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if check and completed.returncode != 0:
        detail = completed.stderr.decode("utf-8", "replace").strip()
        fail(f"git {' '.join(args)} failed in {repo}: {detail}")
    return completed.stdout


def git_text(repo: Path, *args: str) -> str:
    return run_git(repo, *args).decode("utf-8", "strict").strip()


def resolve_commit(repo: Path, revision: str) -> str:
    commit = git_text(repo, "rev-parse", "--verify", f"{revision}^{{commit}}")
    if not SHA1_RE.fullmatch(commit):
        fail(f"invalid commit resolution for {revision}: {commit}")
    return commit


def commit_tree(repo: Path, commit: str) -> str:
    tree = git_text(repo, "rev-parse", f"{commit}^{{tree}}")
    if not SHA1_RE.fullmatch(tree):
        fail(f"invalid tree for {commit}")
    return tree


def parse_time(value: str, label: str) -> datetime:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise GateError(f"{label}: invalid date-time {value!r}") from exc
    if parsed.tzinfo is None:
        fail(f"{label}: timezone is required")
    return parsed.astimezone(timezone.utc)


def iso_utc(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat(timespec="seconds").replace(
        "+00:00", "Z"
    )


def commit_time(repo: Path, commit: str) -> datetime:
    return parse_time(git_text(repo, "show", "-s", "--format=%cI", commit), commit)


def is_ancestor(repo: Path, ancestor: str, descendant: str) -> bool:
    completed = subprocess.run(
        ["git", "-C", str(repo), "merge-base", "--is-ancestor", ancestor, descendant],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    )
    if completed.returncode not in (0, 1):
        fail(f"cannot compare ancestry {ancestor}..{descendant} in {repo}")
    return completed.returncode == 0


def ensure_repo(repo: Path, label: str) -> Path:
    resolved = repo.resolve()
    if git_text(resolved, "rev-parse", "--is-inside-work-tree") != "true":
        fail(f"{label}: not a Git worktree: {resolved}")
    return resolved


def current_branch(repo: Path) -> str:
    branch = git_text(repo, "symbolic-ref", "--quiet", "--short", "HEAD")
    if not branch:
        fail(f"detached HEAD is not allowed: {repo}")
    return branch


def current_upstream(repo: Path) -> str:
    upstream = git_text(repo, "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}")
    if not upstream:
        fail(f"missing upstream: {repo}")
    return upstream


def assert_clean(repo: Path, label: str) -> None:
    if run_git(repo, "status", "--porcelain=v1", "-z"):
        fail(f"{label}: worktree must be clean")


def assert_pushed(repo: Path, commit: str, expected_upstream: str, label: str) -> None:
    upstream_commit = resolve_commit(repo, expected_upstream)
    if not is_ancestor(repo, commit, upstream_commit):
        fail(f"{label}: {commit} is not present in {expected_upstream}")


def live_pin(
    repo: Path,
    label: str,
    expected_branch: str,
    expected_upstream: str,
    *,
    exact_head: str | None = None,
) -> dict[str, Any]:
    repo = ensure_repo(repo, label)
    branch = current_branch(repo)
    upstream = current_upstream(repo)
    if branch != expected_branch:
        fail(f"{label}: branch {branch!r} != {expected_branch!r}")
    if upstream != expected_upstream:
        fail(f"{label}: upstream {upstream!r} != {expected_upstream!r}")
    assert_clean(repo, label)
    head = resolve_commit(repo, "HEAD")
    if exact_head is not None and head != resolve_commit(repo, exact_head):
        fail(f"{label}: HEAD {head} != required carrier {exact_head}")
    upstream_head = resolve_commit(repo, upstream)
    counts = git_text(repo, "rev-list", "--left-right", "--count", f"HEAD...{upstream}").split()
    if counts != ["0", "0"] or upstream_head != head:
        fail(f"{label}: branch must be exactly pushed (ahead/behind {counts})")
    return {
        "commit": head,
        "tree": commit_tree(repo, head),
        "branch": branch,
        "upstream": upstream,
        "clean": True,
        "upstreamMatched": True,
        "stateSha256": EMPTY_SHA256,
    }


def carrier_pin(
    repo: Path,
    commit: str,
    expected_branch: str,
    expected_upstream: str,
    label: str,
    *,
    require_current: bool,
) -> dict[str, Any]:
    resolved = resolve_commit(repo, commit)
    if require_current:
        pin = live_pin(
            repo,
            label,
            expected_branch,
            expected_upstream,
            exact_head=resolved,
        )
        return pin
    if current_branch(repo) != expected_branch or current_upstream(repo) != expected_upstream:
        fail(f"{label}: central branch/upstream changed")
    assert_pushed(repo, resolved, expected_upstream, label)
    return {
        "commit": resolved,
        "tree": commit_tree(repo, resolved),
        "branch": expected_branch,
        "upstream": expected_upstream,
        "clean": None,
        "upstreamMatched": True,
    }


def commit_parent(repo: Path, revision: str, label: str) -> str:
    resolved = resolve_commit(repo, revision)
    values = git_text(repo, "rev-list", "--parents", "-n", "1", resolved).split()
    if len(values) != 2 or values[0] != resolved:
        fail(f"{label}: carrier must have exactly one parent")
    return values[1]


def carrier_changes(repo: Path, parent: str, carrier: str) -> list[tuple[str, str]]:
    raw = run_git(repo, "diff", "--name-status", "--no-renames", "-z", parent, carrier)
    parts = [part.decode("utf-8", "surrogateescape") for part in raw.split(b"\0") if part]
    if len(parts) % 2:
        fail("carrier name-status output is malformed")
    return [(parts[index], parts[index + 1]) for index in range(0, len(parts), 2)]


def assert_exact_added_carrier(
    repo: Path,
    carrier: str,
    expected_paths: Iterable[str],
    label: str,
    *,
    expected_parent: str | None = None,
) -> str:
    resolved = resolve_commit(repo, carrier)
    parent = commit_parent(repo, resolved, label)
    if expected_parent is not None and parent != resolve_commit(repo, expected_parent):
        fail(f"{label}: carrier parent is not the required prior phase")
    if commit_time(repo, resolved) < commit_time(repo, parent):
        fail(f"{label}: carrier commit timestamp precedes its parent")
    expected = sorted(("A", safe_repo_path(path, label)) for path in expected_paths)
    actual = sorted(carrier_changes(repo, parent, resolved))
    if actual != expected:
        fail(f"{label}: exact added-file set mismatch; expected {expected}, got {actual}")
    return parent


def safe_repo_path(path_value: str, label: str) -> str:
    path = PurePosixPath(path_value)
    if path.is_absolute() or not path.parts or any(part in ("", ".", "..") for part in path.parts):
        fail(f"{label}: unsafe repository path {path_value!r}")
    return path.as_posix()


def run_root_rel(run_id: str) -> Path:
    if not RUN_ID_RE.fullmatch(run_id):
        fail("run id must match ^[a-z0-9][a-z0-9-]{2,63}$")
    return R3_ROOT_REL / "runs" / run_id


def require_run_path(run_id: str, path_value: str, label: str) -> str:
    safe = safe_repo_path(path_value, label)
    root = run_root_rel(run_id).as_posix() + "/"
    if not safe.startswith(root):
        fail(f"{label}: path must be below {root}")
    return safe


def reserved_receipt_paths(run_id: str) -> set[str]:
    root = run_root_rel(run_id)
    return {
        (root / "result-admission.v3.json").as_posix(),
        (root / "integration-authorization.v3.json").as_posix(),
        (root / "integrated-closure.v3.json").as_posix(),
    }


def assert_distinct_non_reserved_run_inputs(
    run_id: str, paths: Iterable[str], label: str
) -> list[str]:
    normalized = [require_run_path(run_id, value, label) for value in paths]
    if len(normalized) != len(set(normalized)):
        fail(f"{label}: input/evidence paths must be distinct")
    collisions = sorted(set(normalized) & reserved_receipt_paths(run_id))
    if collisions:
        fail(f"{label}: reserved receipt path collision: {collisions}")
    return normalized


def run_history_commits(repo: Path, run_id: str) -> set[str]:
    root = run_root_rel(run_id).as_posix()
    raw = run_git(repo, "rev-list", "--all", "--full-history", "--", root)
    commits = {
        line.decode("ascii")
        for line in raw.splitlines()
        if line
    }
    if not all(SHA1_RE.fullmatch(value) for value in commits):
        fail(f"{run_id}: invalid commit in run history")
    return commits


def assert_run_never_preexisted(repo: Path, run_id: str, input_carrier: str) -> None:
    input_commit = resolve_commit(repo, input_carrier)
    commits = run_history_commits(repo, run_id)
    if input_commit not in commits:
        fail(f"{run_id}: input carrier does not introduce the run path")
    for historical in commits:
        if historical != input_commit and not is_ancestor(repo, input_commit, historical):
            fail(
                f"{run_id}: run path existed before input carrier or on an unrelated "
                f"reachable authority ref at {historical}"
            )


def assert_exact_run_history(
    repo: Path, run_id: str, allowed_carriers: Iterable[str]
) -> None:
    expected = {resolve_commit(repo, value) for value in allowed_carriers}
    actual = run_history_commits(repo, run_id)
    if actual != expected:
        fail(
            f"{run_id}: run history carrier set mismatch; expected {sorted(expected)}, "
            f"got {sorted(actual)}"
        )


def tree_entry(repo: Path, commit: str, path_value: str) -> dict[str, Any] | None:
    path_value = safe_repo_path(path_value, "tree entry")
    raw = run_git(repo, "ls-tree", "--full-tree", "-z", commit, "--", path_value)
    records = [record for record in raw.split(b"\0") if record]
    if not records:
        return None
    if len(records) != 1 or b"\t" not in records[0]:
        fail(f"ambiguous tree entry for {path_value} at {commit}")
    metadata, raw_path = records[0].split(b"\t", 1)
    mode, object_type, blob = metadata.decode("ascii").split()
    decoded_path = raw_path.decode("utf-8", "surrogateescape")
    if decoded_path != path_value or object_type != "blob":
        fail(f"unsupported tree entry for {path_value} at {commit}")
    content = run_git(repo, "cat-file", "blob", blob)
    return {
        "mode": mode,
        "gitBlobSha1": blob,
        "bytes": len(content),
        "sha256": sha256_bytes(content),
    }


def git_file_pin(repo: Path, commit: str, path_value: str) -> tuple[dict[str, Any], bytes]:
    entry = tree_entry(repo, commit, path_value)
    if entry is None:
        fail(f"missing committed evidence {path_value} at {commit}")
    if entry["mode"] not in ("100644", "100755"):
        fail(f"evidence must be a regular file: {path_value}")
    raw = run_git(repo, "show", f"{commit}:{path_value}")
    if len(raw) != entry["bytes"] or sha256_bytes(raw) != entry["sha256"]:
        fail(f"Git blob mismatch for {path_value} at {commit}")
    return {
        "path": path_value,
        "gitBlobSha1": entry["gitBlobSha1"],
        "sha256": entry["sha256"],
        "bytes": entry["bytes"],
    }, raw


def parse_json_bytes(raw: bytes, label: str) -> dict[str, Any]:
    try:
        value = json.loads(raw)
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise GateError(f"{label}: invalid UTF-8 JSON") from exc
    if not isinstance(value, dict):
        fail(f"{label}: expected a JSON object")
    return value


def file_manifest(repo: Path, base: str, result: str) -> list[dict[str, Any]]:
    base = resolve_commit(repo, base)
    result = resolve_commit(repo, result)
    if not is_ancestor(repo, base, result):
        fail(f"result {result} is not a descendant of base {base}")
    raw_paths = run_git(repo, "diff", "--name-only", "--no-renames", "-z", base, result)
    paths = sorted(
        part.decode("utf-8", "surrogateescape")
        for part in raw_paths.split(b"\0")
        if part
    )
    output: list[dict[str, Any]] = []
    for path_value in paths:
        before = tree_entry(repo, base, path_value)
        after = tree_entry(repo, result, path_value)
        if before is None and after is not None:
            change = "ADD"
        elif before is not None and after is None:
            change = "DELETE"
        elif before is not None and after is not None:
            change = "MODIFY"
        else:
            fail(f"diff path has no before/after object: {path_value}")
        output.append(
            {"path": path_value, "change": change, "before": before, "after": after}
        )
    return output


def qualified_match(repo_name: str, path_value: str, qualified_pattern: str) -> bool:
    if ":" not in qualified_pattern:
        return False
    pattern_repo, pattern = qualified_pattern.split(":", 1)
    if pattern_repo != repo_name:
        return False
    if pattern.endswith("/**"):
        prefix = pattern[:-3].rstrip("/")
        return path_value == prefix or path_value.startswith(prefix + "/")
    return fnmatchcase(path_value, pattern)


def enforce_path_policy(
    repo_name: str,
    manifest: list[dict[str, Any]],
    allowed: list[str],
    protected: list[str],
    label: str,
) -> None:
    if not manifest:
        fail(f"{label}: empty result manifest is not an implementation result")
    for item in manifest:
        path_value = item["path"]
        if any(qualified_match(repo_name, path_value, p) for p in protected):
            fail(f"{label}: protected path changed: {repo_name}:{path_value}")
        if not any(qualified_match(repo_name, path_value, p) for p in allowed):
            fail(f"{label}: path is outside exact allowed set: {repo_name}:{path_value}")


def path_digest(value: Any) -> str:
    return sha256_bytes(canonical_bytes(value))


def recursive_tree_entries(repo: Path, revision: str) -> dict[str, tuple[str, str, str]]:
    raw = run_git(repo, "ls-tree", "-r", "--full-tree", "-z", revision)
    output: dict[str, tuple[str, str, str]] = {}
    for record in (item for item in raw.split(b"\0") if item):
        if b"\t" not in record:
            fail(f"malformed recursive tree entry at {revision}")
        metadata, raw_path = record.split(b"\t", 1)
        mode, kind, object_id = metadata.decode("ascii").split()
        path_value = raw_path.decode("utf-8", "surrogateescape")
        output[path_value] = (mode, kind, object_id)
    return output


def verify_tooling_carrier(frontend: Path, tooling_carrier: str) -> None:
    r2_commit = resolve_commit(frontend, R2_PROMOTION_CARRIER_COMMIT)
    if r2_commit != R2_PROMOTION_CARRIER_COMMIT:
        fail("R2 promotion carrier commit drifted")
    if commit_tree(frontend, r2_commit) != R2_PROMOTION_CARRIER_TREE:
        fail("R2 promotion carrier tree drifted")
    assert_pushed(
        frontend,
        r2_commit,
        CENTRAL_BRANCHES["frontend"][1],
        "exact R2 promotion carrier",
    )
    promotion_pin, _ = git_file_pin(frontend, r2_commit, R2_PROMOTION_REL.as_posix())
    if promotion_pin["sha256"] != R2_PROMOTION_RECEIPT_SHA256:
        fail("R2 promotion receipt blob drifted")
    tooling_commit = resolve_commit(frontend, tooling_carrier)
    assert_pushed(
        frontend,
        tooling_commit,
        CENTRAL_BRANCHES["frontend"][1],
        "R3 tooling carrier",
    )
    assert_exact_added_carrier(
        frontend,
        tooling_commit,
        [(R3_ROOT_REL / relative).as_posix() for relative in TOOL_RELATIVE_PATHS],
        "R3 tooling carrier",
        expected_parent=r2_commit,
    )
    before = recursive_tree_entries(frontend, r2_commit)
    after = recursive_tree_entries(frontend, tooling_commit)
    changed_existing = [
        path_value
        for path_value, entry_value in before.items()
        if after.get(path_value) != entry_value
    ]
    if changed_existing:
        fail(f"R3 tooling carrier changed R2 tree entries: {changed_existing}")


def verify_shared_test_source_carrier(
    frontend: Path,
    source_carrier: str,
    *,
    require_current: bool,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Verify the Control-only test source carrier without trusting a receipt."""
    branch, upstream = CENTRAL_BRANCHES["frontend"]
    state = carrier_pin(
        frontend,
        source_carrier,
        branch,
        upstream,
        "shared-test-source carrier",
        require_current=require_current,
    )
    tooling_carrier = commit_parent(
        frontend, state["commit"], "shared-test-source carrier"
    )
    expected_changes = sorted(
        [("M", path_value) for path_value in CONTROL_PREREQUISITE_PATHS]
        + [("A", SHARED_TEST_SOURCE_PATH)]
    )
    actual_changes = sorted(
        carrier_changes(frontend, tooling_carrier, state["commit"])
    )
    if actual_changes != expected_changes:
        fail(
            "shared-test-source carrier exact change set mismatch; "
            f"expected {expected_changes}, got {actual_changes}"
        )
    verify_tooling_carrier(frontend, tooling_carrier)
    patch_pin, patch_raw = git_file_pin(
        frontend, tooling_carrier, CONTROL_PREREQUISITES_PATCH_PATH
    )
    carrier_patch = run_git(
        frontend,
        "diff",
        "--full-index",
        "--no-ext-diff",
        "--no-renames",
        tooling_carrier,
        state["commit"],
        "--",
        *CONTROL_PREREQUISITE_PATHS,
    )
    if carrier_patch != patch_raw:
        fail("shared-test-source carrier Control prerequisite diff != pinned patch")
    source_pin, raw = git_file_pin(
        frontend, state["commit"], SHARED_TEST_SOURCE_PATH
    )
    if raw != SHARED_TEST_SOURCE_BYTES:
        fail("shared-test-source carrier does not contain the deterministic template")
    return {
        **source_pin,
        "templateId": SHARED_TEST_SOURCE_TEMPLATE_ID,
        "carrierCommit": state["commit"],
        "carrierTree": state["tree"],
        "toolingCarrierCommit": tooling_carrier,
        "toolingCarrierTree": commit_tree(frontend, tooling_carrier),
        "branch": branch,
        "upstream": upstream,
        "carrierPushed": True,
        "exactControlPrerequisites": {
            "patch": patch_pin,
            "modifiedPaths": CONTROL_PREREQUISITE_PATHS,
            "addedPaths": [SHARED_TEST_SOURCE_PATH],
            "carrierChangedPathsClosedSet": True,
            "patchMatchesModifiedDiff": True,
        },
        "sourceCarrierGate": {
            "status": "REQUIRED_BEFORE_INPUT_CARRIER",
            "requireCurrentHead": True,
            "requireClean": True,
            "requireExactUpstreamHead": True,
        },
    }, state


def verify_canonical_command_sources(
    frontend: Path,
    frontend_revision: str,
    backend: Path,
    backend_revision: str,
) -> None:
    """Fail if a canonical argv names a source or package script that is absent."""
    for path_value in FRONTEND_CANONICAL_COMMAND_PATHS:
        _, raw = git_file_pin(frontend, frontend_revision, path_value)
        if path_value == SHARED_TEST_SOURCE_PATH and raw != SHARED_TEST_SOURCE_BYTES:
            fail("canonical Playwright source bytes changed")
    for path_value in BACKEND_CANONICAL_COMMAND_PATHS:
        git_file_pin(backend, backend_revision, path_value)
    _, package_raw = git_file_pin(frontend, frontend_revision, "package.json")
    package = parse_json_bytes(package_raw, "canonical frontend package.json")
    scripts = package.get("scripts")
    if not isinstance(scripts, dict):
        fail("canonical frontend package scripts are missing")
    for name, expected in CANONICAL_PACKAGE_SCRIPTS.items():
        if scripts.get(name) != expected:
            fail(f"canonical frontend package script drifted: {name}")
    dependencies: dict[str, Any] = {}
    for field in ("dependencies", "devDependencies"):
        value = package.get(field, {})
        if isinstance(value, dict):
            dependencies.update(value)
    for name in CANONICAL_PACKAGE_DEPENDENCIES:
        if not isinstance(dependencies.get(name), str) or not dependencies[name]:
            fail(f"canonical frontend dependency is missing: {name}")


def verify_packet_test_commands(module: str, packet: dict[str, Any]) -> None:
    commands = packet.get("verificationBindings", {}).get("moduleCommands")
    if not isinstance(commands, list) or len(commands) != 2:
        fail(f"{module} predecessor packet test command set mismatch")
    expected_ids = [f"{module}_BACKEND_TARGETED", f"{module}_FRONTEND_TARGETED"]
    # Length is checked above; avoid zip(strict=...) so Control can run this on
    # the repository's older supported Python runtime as well.
    for command_id, row in zip(expected_ids, commands):
        expected = EXPECTED_TEST_COMMANDS[command_id]
        if not isinstance(row, dict):
            fail(f"{module} predecessor packet test command is invalid")
        if row.get("cwd") != expected["cwd"] or row.get("argv") != expected["argv"]:
            fail(f"{command_id}: hard-coded command differs from predecessor packet")
        if row.get("stage") != "TARGETED_MODULE":
            fail(f"{command_id}: predecessor stage mismatch")


def read_r2_authority(frontend: Path) -> dict[str, Any]:
    carrier = resolve_commit(frontend, R2_PROMOTION_CARRIER_COMMIT)
    if commit_tree(frontend, carrier) != R2_PROMOTION_CARRIER_TREE:
        fail("exact R2 promotion carrier tree mismatch")
    branch, upstream = CENTRAL_BRANCHES["frontend"]
    pin = carrier_pin(
        frontend, carrier, branch, upstream, "R2 promotion carrier", require_current=False
    )
    file_pin, raw = git_file_pin(frontend, carrier, R2_PROMOTION_REL.as_posix())
    if file_pin["sha256"] != R2_PROMOTION_RECEIPT_SHA256:
        fail("exact R2 promotion receipt SHA-256 mismatch")
    receipt = parse_json_bytes(raw, "R2 promotion receipt")
    verify_seal(receipt, "R2 promotion receipt")
    if receipt.get("schema") != "dwp.hris.g7-sys-hrm-promotion-receipt.v2":
        fail("unexpected R2 promotion schema")
    if receipt.get("status") != "PASS_SCOPED_DELEGATION":
        fail("R2 promotion is not passing")
    authority = receipt.get("authority")
    if not isinstance(authority, dict) or authority.get("integrationMergeAuthorized") is not False:
        fail("R2 must keep integrationMergeAuthorized=false")
    if receipt.get("activeTokenClosedSet") != [
        MODULES["SYS"]["tokenId"], MODULES["HRM"]["tokenId"]
    ]:
        fail("R2 active token closed set changed")
    bundle = receipt.get("bundleCommit")
    if not isinstance(bundle, dict):
        fail("R2 bundle commit missing")
    bundle_commit = resolve_commit(frontend, str(bundle.get("commit", "")))
    if commit_tree(frontend, bundle_commit) != bundle.get("tree"):
        fail("R2 bundle tree mismatch")
    tokens: dict[str, dict[str, Any]] = {}
    delegation_by_module = {
        item.get("module"): item
        for item in receipt.get("delegations", [])
        if isinstance(item, dict)
    }
    for module, spec in MODULES.items():
        delegation = delegation_by_module.get(module)
        if not isinstance(delegation, dict) or delegation.get("tokenId") != spec["tokenId"]:
            fail(f"R2 {module} delegation missing")
        token_path = spec["tokenPath"].as_posix()
        token_pin, token_raw = git_file_pin(frontend, bundle_commit, token_path)
        if token_pin["sha256"] != delegation.get("tokenSha256"):
            fail(f"R2 {module} token digest mismatch")
        token = parse_json_bytes(token_raw, f"R2 {module} token")
        verify_seal(token, f"R2 {module} token")
        if token.get("tokenId") != spec["tokenId"]:
            fail(f"R2 {module} token identity mismatch")
        token_authority = token.get("authority", {})
        if token_authority.get("integrationMergeAuthorized") is not False:
            fail(f"R2 {module} token unexpectedly authorizes integration")
        packet_path = safe_repo_path(str(token.get("packetPath", "")), f"{module} packet")
        packet_pin, packet_raw = git_file_pin(frontend, bundle_commit, packet_path)
        if packet_pin["sha256"] != token.get("packetFileSha256"):
            fail(f"R2 {module} predecessor packet digest mismatch")
        packet = parse_json_bytes(packet_raw, f"R2 {module} predecessor packet")
        verify_seal(packet, f"R2 {module} predecessor packet")
        if packet.get("packetId") != token.get("packetId"):
            fail(f"R2 {module} predecessor packet identity mismatch")
        verify_packet_test_commands(module, packet)
        tokens[module] = token
    return {
        "receipt": receipt,
        "receiptPin": {
            **file_pin,
            "carrierCommit": pin["commit"],
            "carrierTree": pin["tree"],
        },
        "bundleCommit": bundle_commit,
        "tokens": tokens,
    }


def expected_binding(token: dict[str, Any], repo_name: str) -> dict[str, Any]:
    bindings = [
        item
        for item in token.get("worktreeBindings", [])
        if isinstance(item, dict) and item.get("repo") == repo_name
    ]
    if len(bindings) != 1:
        fail(f"token has no unique {repo_name} worktree binding")
    return bindings[0]


def inspect_module_result(
    module: str,
    repo_name: str,
    repo: Path,
    token: dict[str, Any],
) -> dict[str, Any]:
    binding = expected_binding(token, repo_name)
    repo = ensure_repo(repo, f"{module} {repo_name}")
    if repo != Path(str(binding.get("absolute_path"))).resolve():
        fail(f"{module} {repo_name}: not the token-bound exact worktree")
    pin = live_pin(
        repo,
        f"{module} {repo_name}",
        str(binding.get("branch")),
        str(binding.get("upstream")),
    )
    base = token.get("executionBasePins", {}).get(repo_name)
    if not isinstance(base, dict):
        fail(f"{module} {repo_name}: execution base pin missing")
    base_commit = resolve_commit(repo, str(base.get("commit", "")))
    if commit_tree(repo, base_commit) != base.get("tree"):
        fail(f"{module} {repo_name}: base tree mismatch")
    if pin["commit"] == base_commit:
        fail(f"{module} {repo_name}: result commit still equals base")
    if commit_time(repo, pin["commit"]) < commit_time(repo, base_commit):
        fail(f"{module} {repo_name}: result commit timestamp precedes base")
    manifest = file_manifest(repo, base_commit, pin["commit"])
    allowed = token.get("effectiveAllowedPaths")
    protected = token.get("protectedPaths")
    if not isinstance(allowed, list) or not all(isinstance(v, str) for v in allowed):
        fail(f"{module}: invalid allowed path policy")
    if not isinstance(protected, list) or not all(isinstance(v, str) for v in protected):
        fail(f"{module}: invalid protected path policy")
    enforce_path_policy(repo_name, manifest, allowed, protected, f"{module} {repo_name}")
    expires_at = parse_time(str(token.get("expiresAt", "")), f"{module} expiry")
    if commit_time(repo, pin["commit"]) > expires_at:
        fail(f"{module} {repo_name}: result commit is after token expiry")
    return {
        "repo": repo_name,
        "absolutePath": str(repo),
        "branch": pin["branch"],
        "upstream": pin["upstream"],
        "basePin": {"commit": base_commit, "tree": base["tree"]},
        "resultPin": {"commit": pin["commit"], "tree": pin["tree"]},
        "clean": True,
        "upstreamMatched": True,
        "changedFiles": manifest,
        "changedFilesSha256": path_digest(manifest),
    }


def migration_evidence(
    module: str,
    backend_result: dict[str, Any],
    backend_repo: Path,
    token: dict[str, Any],
) -> dict[str, Any]:
    expected = MODULES[module]["migrationPath"]
    changed = {item["path"]: item for item in backend_result["changedFiles"]}
    token_authority = token.get("authority")
    if not isinstance(token_authority, dict):
        fail(f"{module} migration authority is missing")
    if module == "SYS":
        if token.get("migrationLeaseId") != "G7-LEASE-SYS-PLATFORM-V325-R2":
            fail("SYS exact V325 lease is not active")
        if (
            token_authority.get("migrationAuthorityMode") != "ADMITTED_EXACT_LEASE"
            or token_authority.get("migrationEditAuthorized") is not True
        ):
            fail("SYS V325 token migration authority mismatch")
        item = changed.get(expected)
        if item is None:
            return {
                "mode": "ADMITTED_EXACT_LEASE",
                "leaseId": token["migrationLeaseId"],
                "exactRelativePath": expected,
                "used": False,
                "status": "UNUSED",
                "artifact": None,
            }
        if item["change"] != "ADD" or item["before"] is not None or item["after"] is None:
            fail("SYS V325 must be a newly added exact leased migration")
        return {
            "mode": "ADMITTED_EXACT_LEASE",
            "leaseId": token["migrationLeaseId"],
            "exactRelativePath": expected,
            "used": True,
            "status": "USED_EXACT_V325",
            "artifact": item["after"],
        }
    prerequisite = token.get("controlOwnedMigrationPrerequisite")
    if not isinstance(prerequisite, dict):
        fail("HRM read-only V54 prerequisite missing")
    if (
        prerequisite.get("mode") != "CONTROL_BOOTSTRAP_READ_ONLY_PIN"
        or prerequisite.get("exactRelativePath") != expected
        or prerequisite.get("migrationEditAuthorized") is not False
    ):
        fail("HRM V54 prerequisite mode/path/edit authority changed")
    if (
        token_authority.get("migrationAuthorityMode")
        != "CONTROL_BOOTSTRAP_READ_ONLY_PIN"
        or token_authority.get("migrationEditAuthorized") is not False
    ):
        fail("HRM V54 token migration authority mismatch")
    if prerequisite.get("frozenBackendCommit") != backend_result["basePin"]["commit"]:
        fail("HRM V54 prerequisite frozen backend commit changed")
    if expected in changed:
        fail("HRM protected V54 changed in module result")
    entry = tree_entry(backend_repo, backend_result["resultPin"]["commit"], expected)
    if entry is None or entry["sha256"] != prerequisite.get("sha256"):
        fail("HRM V54 committed bytes differ from the read-only prerequisite")
    return {
        "mode": "CONTROL_BOOTSTRAP_READ_ONLY_PIN",
        "exactRelativePath": expected,
        "used": False,
        "status": "UNCHANGED_READ_ONLY_V54",
        "artifact": entry,
        "migrationEditAuthorized": False,
    }


def verify_output_pin(
    frontend: Path,
    carrier: str,
    output: Any,
    run_id: str,
    label: str,
    *,
    allow_empty: bool = False,
) -> bytes:
    if not isinstance(output, dict):
        fail(f"{label}: output pin missing")
    expect_keys(
        output,
        {"path", "gitBlobSha1", "sha256", "bytes", "redactionStatus"},
        f"{label} output",
    )
    path_value = require_run_path(run_id, str(output.get("path", "")), label)
    pin, raw = git_file_pin(frontend, carrier, path_value)
    if pin["bytes"] < 1 and not allow_empty:
        fail(f"{label}: output evidence is empty")
    for key in ("gitBlobSha1", "sha256", "bytes"):
        if output.get(key) != pin[key]:
            fail(f"{label}: output {key} mismatch")
    if output.get("redactionStatus") != "SANITIZED_NO_SECRET_OR_CUSTOMER_DATA":
        fail(f"{label}: output is not marked sanitized")
    return raw


def expected_playwright_summary(
    source_pins: dict[str, dict[str, str]],
) -> dict[str, Any]:
    return {
        "format": "PLAYWRIGHT_JSON_REPORT_V1",
        "specPath": SHARED_TEST_SOURCE_PATH,
        "workers": 1,
        "sourcePins": source_pins,
        "projects": [
            {"name": "chromium", "expected": 2, "passed": 2},
            {"name": "mobile", "expected": 2, "passed": 2},
        ],
        "total": {
            "expected": 4,
            "passed": 4,
            "unexpected": 0,
            "flaky": 0,
            "skipped": 0,
        },
        "stderrEmpty": True,
    }


def source_pin_environment(
    source_pins: dict[str, dict[str, str]],
) -> dict[str, str]:
    return {
        name: source_pins[repo_name][pin_name]
        for name, (repo_name, pin_name) in SOURCE_PIN_ENVIRONMENT.items()
    }


def source_pins_from_annotations(value: Any) -> dict[str, dict[str, str]]:
    if not isinstance(value, list) or len(value) != len(SOURCE_PIN_ANNOTATIONS):
        fail("Playwright JSON reporter source-pin annotations are incomplete")
    expected_types = list(SOURCE_PIN_ANNOTATIONS)
    if [row.get("type") for row in value if isinstance(row, dict)] != expected_types:
        fail("Playwright JSON reporter source-pin annotation set/order mismatch")
    pins = {"frontend": {}, "backend": {}}
    for row in value:
        if not isinstance(row, dict) or set(row) != {"type", "description"}:
            fail("Playwright JSON reporter source-pin annotation shape mismatch")
        description = row.get("description")
        if not isinstance(description, str) or not SHA1_RE.fullmatch(description):
            fail("Playwright JSON reporter source-pin annotation is not an object id")
        repo_name, pin_name = SOURCE_PIN_ANNOTATIONS[row["type"]]
        pins[repo_name][pin_name] = description
    return pins


def nonempty_output_lines(raw: bytes, label: str) -> list[str]:
    try:
        text_value = raw.decode("utf-8", "strict")
    except UnicodeDecodeError as exc:
        raise GateError(f"{label}: output is not UTF-8") from exc
    return [line.strip() for line in text_value.splitlines() if line.strip()]


def require_empty_stderr(raw: bytes, label: str) -> None:
    if raw.strip():
        fail(f"{label}: successful command emitted stderr")


def validate_vitest_json(raw: bytes, stderr_raw: bytes, frontend: Path) -> dict[str, Any]:
    require_empty_stderr(stderr_raw, "shared route/access Vitest")
    report = parse_json_bytes(raw, "shared route/access Vitest JSON output")
    required_counts = {
        "numTotalTestSuites",
        "numPassedTestSuites",
        "numFailedTestSuites",
        "numPendingTestSuites",
        "numTotalTests",
        "numPassedTests",
        "numFailedTests",
        "numPendingTests",
        "numTodoTests",
    }
    for key in required_counts:
        value = report.get(key)
        if not isinstance(value, int) or isinstance(value, bool) or value < 0:
            fail(f"shared route/access Vitest JSON has invalid {key}")
    if report.get("success") is not True:
        fail("shared route/access Vitest JSON is not successful")
    if report["numTotalTestSuites"] < 1 or report["numTotalTests"] < 1:
        fail("shared route/access Vitest JSON proves no executed tests")
    if report["numPassedTestSuites"] != report["numTotalTestSuites"] or any(
        report[key] != 0
        for key in ("numFailedTestSuites", "numPendingTestSuites")
    ):
        fail("shared route/access Vitest suite summary is not fully passing")
    if report["numPassedTests"] != report["numTotalTests"] or any(
        report[key] != 0
        for key in ("numFailedTests", "numPendingTests", "numTodoTests")
    ):
        fail("shared route/access Vitest test summary is not fully passing")
    results = report.get("testResults")
    if not isinstance(results, list) or len(results) != len(VITEST_TARGETS):
        fail("shared route/access Vitest did not report exactly four files")
    observed: list[str] = []
    frontend_prefix = frontend.resolve().as_posix().rstrip("/") + "/"
    for result in results:
        if not isinstance(result, dict):
            fail("shared route/access Vitest contains a non-object file result")
        name = str(result.get("name", "")).replace("\\", "/")
        if name.startswith(frontend_prefix):
            normalized = name[len(frontend_prefix):]
        elif name.startswith("/"):
            fail("shared route/access Vitest reported a file outside the frontend repo")
        else:
            normalized = PurePosixPath(name).as_posix()
        if normalized not in VITEST_TARGETS or normalized in observed:
            fail("shared route/access Vitest file closed set mismatch")
        observed.append(normalized)
        if result.get("status") != "passed":
            fail(f"shared route/access Vitest file did not pass: {normalized}")
        assertions = result.get("assertionResults")
        if not isinstance(assertions, list) or not assertions:
            fail(f"shared route/access Vitest file has no assertions: {normalized}")
        for assertion in assertions:
            if not isinstance(assertion, dict) or assertion.get("status") != "passed":
                fail(f"shared route/access Vitest assertion did not pass: {normalized}")
            if assertion.get("failureMessages", []) != []:
                fail(f"shared route/access Vitest assertion has failure output: {normalized}")
    if set(observed) != set(VITEST_TARGETS):
        fail("shared route/access Vitest exact requested files are incomplete")
    return {
        "format": "VITEST_JSON_REPORT_V1",
        "requestedFiles": VITEST_TARGETS,
        "fileCount": len(VITEST_TARGETS),
        "totalTests": report["numTotalTests"],
        "passedTests": report["numPassedTests"],
        "failedTests": report["numFailedTests"],
        "pendingTests": report["numPendingTests"],
        "todoTests": report["numTodoTests"],
        "stderrEmpty": True,
    }


def validate_non_playwright_semantics(
    command_id: str,
    stdout_raw: bytes,
    stderr_raw: bytes,
    frontend: Path,
) -> dict[str, Any]:
    if command_id == "CONTROL_AUTHORIZATION_CHECK":
        require_empty_stderr(stderr_raw, command_id)
        lines = nonempty_output_lines(stdout_raw, command_id)
        if len(lines) != 1 or not re.fullmatch(AUTHORIZATION_SUCCESS_PATTERN, lines[0]):
            fail(f"{command_id}: exact authorization success marker missing")
        return {
            "format": "AUTHORIZATION_CHECK_STDOUT_V1",
            "markers": ["PRODUCT_SURFACE_AUTHORIZATION"],
            "stderrEmpty": True,
        }
    if command_id == "CONTROL_BACKEND_OPENAPI_CHECK":
        require_empty_stderr(stderr_raw, command_id)
        lines = nonempty_output_lines(stdout_raw, command_id)
        if len(lines) != 1 or not re.fullmatch(BACKEND_OPENAPI_SUCCESS_PATTERN, lines[0]):
            fail(f"{command_id}: exact approved-snapshot success marker missing")
        return {
            "format": "BACKEND_OPENAPI_CHECK_STDOUT_V1",
            "markers": ["BACKEND_APPROVED_SNAPSHOTS"],
            "stderrEmpty": True,
        }
    if command_id == "CONTROL_FRONTEND_OPENAPI_CHECK":
        require_empty_stderr(stderr_raw, command_id)
        if nonempty_output_lines(stdout_raw, command_id) != FRONTEND_OPENAPI_SUCCESS_LINES:
            fail(f"{command_id}: Gateway/Agent marker closed set mismatch")
        return {
            "format": "FRONTEND_OPENAPI_CHECK_STDOUT_V1",
            "markers": ["GATEWAY_TYPES", "AGENT_TYPES"],
            "stderrEmpty": True,
        }
    if command_id == VITEST_COMMAND_ID:
        return validate_vitest_json(stdout_raw, stderr_raw, frontend)
    if command_id == "CONTROL_FRONTEND_TYPECHECK":
        if stdout_raw.strip() or stderr_raw.strip():
            fail("CONTROL_FRONTEND_TYPECHECK: tsc --noEmit success must be silent")
        return {
            "format": "TSC_NO_EMIT_SILENT_V1",
            "canonicalScript": CANONICAL_PACKAGE_SCRIPTS["typecheck"],
            "stdoutEmpty": True,
            "stderrEmpty": True,
        }
    if command_id == "CONTROL_FRONTEND_ARCHITECTURE":
        require_empty_stderr(stderr_raw, command_id)
        lines = nonempty_output_lines(stdout_raw, command_id)
        if len(lines) != len(ARCHITECTURE_SUCCESS_MARKERS):
            fail("CONTROL_FRONTEND_ARCHITECTURE: marker count mismatch")
        for line, (marker_id, pattern) in zip(lines, ARCHITECTURE_SUCCESS_MARKERS):
            if not re.fullmatch(pattern, line):
                fail(
                    "CONTROL_FRONTEND_ARCHITECTURE: exact marker/order mismatch at "
                    f"{marker_id}"
                )
        return {
            "format": "ARCHITECTURE_CLOSED_MARKERS_V1",
            "markers": [marker_id for marker_id, _ in ARCHITECTURE_SUCCESS_MARKERS],
            "markerCount": len(ARCHITECTURE_SUCCESS_MARKERS),
            "stderrEmpty": True,
        }
    fail(f"{command_id}: no non-Playwright semantic proof parser")


def validate_playwright_json(
    raw: bytes,
    source_pins: dict[str, dict[str, str]],
) -> dict[str, Any]:
    report = parse_json_bytes(raw, "Playwright JSON reporter output")
    for key in ("config", "errors", "stats", "suites"):
        if key not in report:
            fail(f"Playwright JSON reporter output is missing {key}")
    if report.get("errors") != []:
        fail("Playwright JSON reporter output contains top-level errors")
    config = report.get("config")
    if not isinstance(config, dict):
        fail("Playwright JSON reporter config is missing")
    workers = config.get("workers")
    if (
        config.get("version") != "1.58.0"
        or type(workers) is not int
        or workers != 1
    ):
        fail("Playwright JSON reporter output does not prove version 1.58.0/workers=1")
    if config.get("reporter") != [["json"]]:
        fail("Playwright JSON reporter config is not the exact JSON reporter")
    root_dir = str(config.get("rootDir", "")).replace("\\", "/").rstrip("/")
    if not root_dir or PurePosixPath(root_dir).name != "e2e":
        fail("Playwright JSON reporter config.rootDir is not the e2e directory")
    projects = config.get("projects")
    if not isinstance(projects, list) or len(projects) != len(PLAYWRIGHT_PROJECTS):
        fail("Playwright JSON reporter project count mismatch")
    for project, expected_name in zip(projects, PLAYWRIGHT_PROJECTS):
        if not isinstance(project, dict):
            fail("Playwright JSON reporter contains a non-object project")
        project_dir = str(project.get("testDir", "")).replace("\\", "/").rstrip("/")
        if (
            project.get("id") != expected_name
            or project.get("name") != expected_name
            or type(project.get("retries")) is not int
            or project.get("retries") != 0
            or type(project.get("repeatEach")) is not int
            or project.get("repeatEach") != 1
            or project_dir != root_dir
        ):
            fail("Playwright JSON reporter project contract mismatch")
    stats = report.get("stats")
    if not isinstance(stats, dict):
        fail("Playwright JSON reporter stats are missing")
    for key, expected in (
        ("expected", 4),
        ("skipped", 0),
        ("unexpected", 0),
        ("flaky", 0),
    ):
        value = stats.get(key)
        if type(value) is not int or value != expected:
            fail(f"Playwright JSON reporter stats.{key} != {expected}")
    root_suites = report.get("suites")
    if not isinstance(root_suites, list) or len(root_suites) != 1:
        fail("Playwright JSON reporter must contain exactly one root suite")
    root_suite = root_suites[0]
    if not isinstance(root_suite, dict):
        fail("Playwright JSON reporter root suite is not an object")
    allowed_files = {
        PurePosixPath(SHARED_TEST_SOURCE_PATH).name,
        SHARED_TEST_SOURCE_PATH,
    }
    if (
        root_suite.get("title") not in allowed_files
        or root_suite.get("file") not in allowed_files
        or root_suite.get("suites", []) != []
    ):
        fail("Playwright JSON reporter root suite is not the pinned spec")
    specs = root_suite.get("specs")
    if not isinstance(specs, list) or len(specs) != len(PLAYWRIGHT_EXECUTION_PAIRS):
        fail("Playwright JSON reporter must contain exactly four execution specs")
    reported_source_pins: dict[str, dict[str, str]] | None = None
    observed_pairs: list[tuple[str, str]] = []
    for spec, (expected_project, expected_title) in zip(
        specs, PLAYWRIGHT_EXECUTION_PAIRS
    ):
        if not isinstance(spec, dict):
            fail("Playwright JSON reporter contains a non-object spec")
        file_value = str(spec.get("file", "")).replace("\\", "/")
        if file_value not in allowed_files:
            fail("Playwright JSON reporter includes a result from another spec")
        title = spec.get("title")
        if title != expected_title or spec.get("ok") is not True:
            fail(f"Playwright JSON reporter spec did not pass: {title}")
        tests = spec.get("tests")
        if not isinstance(tests, list) or len(tests) != 1:
            fail(f"Playwright JSON reporter execution spec must contain one test: {title}")
        test = tests[0]
        if not isinstance(test, dict):
            fail("Playwright JSON reporter contains a non-object test")
        if (
            test.get("projectId") != expected_project
            or test.get("projectName") != expected_project
            or test.get("expectedStatus") != "passed"
            or test.get("status") != "expected"
        ):
            fail(f"Playwright JSON reporter project/status mismatch: {title}")
        observed_pairs.append((expected_project, title))
        annotated_pins = source_pins_from_annotations(test.get("annotations"))
        if reported_source_pins is None:
            reported_source_pins = annotated_pins
        elif annotated_pins != reported_source_pins:
            fail("Playwright JSON reporter source pins differ across executions")
        results = test.get("results")
        if not isinstance(results, list) or len(results) != 1:
            fail(f"Playwright JSON reporter must contain one clean execution: {title}")
        result = results[0]
        if not isinstance(result, dict):
            fail("Playwright JSON reporter execution is not an object")
        result_pins = source_pins_from_annotations(result.get("annotations"))
        if result_pins != annotated_pins:
            fail("Playwright JSON reporter result annotations differ from its test")
        if (
            result.get("status") != "passed"
            or result.get("errors") != []
            or result.get("stdout") != []
            or result.get("stderr") != []
            or type(result.get("retry")) is not int
            or result.get("retry") != 0
            or result.get("attachments") != []
        ):
            fail(f"Playwright JSON reporter execution is not a clean first-pass: {title}")
    if observed_pairs != PLAYWRIGHT_EXECUTION_PAIRS:
        fail("Playwright JSON reporter closed set mismatch")
    if reported_source_pins != source_pins:
        fail("Playwright JSON reporter source pins differ from runner source heads")
    return expected_playwright_summary(reported_source_pins)


def validate_module_test_input(
    value: dict[str, Any],
    frontend: Path,
    carrier: str,
    run_id: str,
    results_by_key: dict[tuple[str, str], dict[str, Any]],
    tokens: dict[str, dict[str, Any]],
) -> None:
    verify_seal(value, "module test evidence")
    expect_keys(
        value,
        {"schema", "evidenceId", "issuedBy", "authorityStatus", "closedSet", "results", "sealedPayloadSha256"},
        "module test evidence",
    )
    if value.get("schema") != "dwp.hris.g7-sys-hrm-module-test-evidence-input.v3":
        fail("module test evidence schema mismatch")
    if value.get("issuedBy") != "SYS_COMMON_INTEGRATION_CONTROL":
        fail("module test evidence issuer mismatch")
    if value.get("authorityStatus") != "CONTROL_AUTHORED_RESULT_EVIDENCE":
        fail("module test evidence authority status mismatch")
    if value.get("closedSet") != EXPECTED_TEST_CLOSED_SET:
        fail("module test evidence closed set differs from the four packet commands")
    rows = value.get("results")
    if not isinstance(rows, list) or len(rows) != len(EXPECTED_TEST_CLOSED_SET):
        fail("module test evidence must have exactly four results")
    by_id = {
        row.get("commandId"): row for row in rows if isinstance(row, dict)
    }
    if list(by_id) != EXPECTED_TEST_CLOSED_SET or len(by_id) != len(rows):
        fail("module test evidence result order/identity is not the closed set")
    for command_id, expected in EXPECTED_TEST_COMMANDS.items():
        row = by_id[command_id]
        expect_keys(
            row,
            {"commandId", "module", "repo", "cwd", "argv", "status", "exitCode", "resultCommit", "resultTree", "executedAt", "executionBinding", "output"},
            command_id,
        )
        for key in ("module", "repo", "cwd", "argv"):
            if row.get(key) != expected[key]:
                fail(f"{command_id}: {key} differs from predecessor packet")
        if (
            row.get("status") != "PASS"
            or type(row.get("exitCode")) is not int
            or row.get("exitCode") != 0
        ):
            fail(f"{command_id}: test result is not PASS/0")
        result = results_by_key[(expected["module"], expected["repo"])]
        if row.get("resultCommit") != result["resultPin"]["commit"]:
            fail(f"{command_id}: result commit mismatch")
        if row.get("resultTree") != result["resultPin"]["tree"]:
            fail(f"{command_id}: result tree mismatch")
        executed_at = parse_time(str(row.get("executedAt", "")), command_id)
        binding = row.get("executionBinding")
        if not isinstance(binding, dict):
            fail(f"{command_id}: execution binding is missing")
        expect_keys(
            binding,
            {"mode", "testedTree", "authorityStatus"},
            f"{command_id} execution binding",
        )
        if binding.get("testedTree") != result["resultPin"]["tree"]:
            fail(f"{command_id}: tested tree differs from the exact result tree")
        result_commit_time = commit_time(
            Path(str(result["absolutePath"])), result["resultPin"]["commit"]
        )
        base_commit_time = commit_time(
            Path(str(result["absolutePath"])), result["basePin"]["commit"]
        )
        token_issued_at = parse_time(
            str(tokens[expected["module"]].get("issuedAt", "")), "token issuance"
        )
        if executed_at < max(base_commit_time, token_issued_at):
            fail(f"{command_id}: evidence predates source preparation authority")
        if binding.get("mode") == "PRE_COMMIT_FINAL_TREE":
            if binding.get("authorityStatus") != "CONTROL_ASSERTED_WORKTREE_TREE_EQUALS_RESULT_TREE":
                fail(f"{command_id}: pre-commit tree assertion authority mismatch")
            if executed_at >= result_commit_time:
                fail(f"{command_id}: pre-commit evidence is not before result commit")
        elif binding.get("mode") == "POST_COMMIT_EXACT_RESULT":
            if binding.get("authorityStatus") != "GIT_COMMIT_BOUND_EXACT_RESULT":
                fail(f"{command_id}: post-commit binding authority mismatch")
            if executed_at < result_commit_time:
                fail(f"{command_id}: post-commit evidence predates result commit")
        else:
            fail(f"{command_id}: unsupported execution binding mode")
        if executed_at > commit_time(frontend, carrier):
            fail(f"{command_id}: evidence timestamp is after its carrier commit")
        if executed_at > parse_time(tokens[expected["module"]]["expiresAt"], "token expiry"):
            fail(f"{command_id}: evidence executed after token expiry")
        verify_output_pin(frontend, carrier, row.get("output"), run_id, command_id)


def validate_shared_plan(value: dict[str, Any]) -> None:
    verify_seal(value, "shared verification plan")
    expect_keys(
        value,
        {"schema", "planId", "issuedBy", "authorityStatus", "basis", "requiredCategories", "closedSet", "commands", "rerunPolicy", "sealedPayloadSha256"},
        "shared verification plan",
    )
    if value.get("schema") != "dwp.hris.g7-sys-hrm-shared-verification-plan.v3":
        fail("shared verification plan schema mismatch")
    if value.get("issuedBy") != "SYS_COMMON_INTEGRATION_CONTROL":
        fail("shared verification plan issuer mismatch")
    if value.get("authorityStatus") != "CONTROL_PROPOSAL_NOT_PREDECESSOR_AUTHORITY":
        fail("shared verification plan must be explicitly marked as a Control proposal")
    if value.get("requiredCategories") != REQUIRED_SHARED_CATEGORIES:
        fail("shared verification categories differ from predecessor requirements")
    if value.get("rerunPolicy") != "ONE_SHARED_BATCH_NO_PER_FIX_FULL_RERUN":
        fail("shared verification rerun policy mismatch")
    if value.get("basis") != EXPECTED_SHARED_BASIS:
        fail("shared verification plan predecessor basis mismatch")
    if value.get("closedSet") != EXPECTED_SHARED_CLOSED_SET:
        fail("shared verification plan command closed set is not canonical")
    if value.get("commands") != EXPECTED_SHARED_COMMANDS:
        fail("shared verification plan commands/order/argv are not canonical")


def expected_union(module_results: list[dict[str, Any]]) -> dict[str, Any]:
    union: dict[str, list[dict[str, Any]]] = {"frontend": [], "backend": []}
    seen: dict[tuple[str, str], str] = {}
    for module_result in module_results:
        module = module_result["module"]
        for worktree in module_result["worktrees"]:
            repo_name = worktree["repo"]
            for item in worktree["changedFiles"]:
                key = (repo_name, item["path"])
                if key in seen:
                    fail(
                        f"result overlap: {repo_name}:{item['path']} belongs to "
                        f"{seen[key]} and {module}"
                    )
                seen[key] = module
                union[repo_name].append({"module": module, **item})
    for values in union.values():
        values.sort(key=lambda item: (item["path"], item["module"]))
    return union


def build_admission(
    run_id: str,
    frontend: Path,
    backend: Path,
    module_repos: dict[tuple[str, str], Path],
    input_carrier: str,
    test_evidence_path: str,
    shared_plan_path: str,
    *,
    require_input_current: bool,
) -> dict[str, Any]:
    frontend = ensure_repo(frontend, "central frontend")
    backend = ensure_repo(backend, "central backend")
    branch, upstream = CENTRAL_BRANCHES["frontend"]
    input_pin = carrier_pin(
        frontend,
        input_carrier,
        branch,
        upstream,
        "Control input carrier",
        require_current=require_input_current,
    )
    test_evidence_path = require_run_path(run_id, test_evidence_path, "test evidence")
    shared_plan_path = require_run_path(run_id, shared_plan_path, "shared plan")
    assert_distinct_non_reserved_run_inputs(
        run_id,
        [test_evidence_path, shared_plan_path],
        "Control input evidence carrier",
    )
    evidence_pin, evidence_raw = git_file_pin(
        frontend, input_pin["commit"], test_evidence_path
    )
    plan_pin, plan_raw = git_file_pin(frontend, input_pin["commit"], shared_plan_path)
    evidence = parse_json_bytes(evidence_raw, "module test evidence")
    plan = parse_json_bytes(plan_raw, "shared verification plan")
    validate_shared_plan(plan)
    r2 = read_r2_authority(frontend)
    module_results: list[dict[str, Any]] = []
    results_by_key: dict[tuple[str, str], dict[str, Any]] = {}
    times = [commit_time(frontend, input_pin["commit"])]
    for module in ("SYS", "HRM"):
        token = r2["tokens"][module]
        worktrees: list[dict[str, Any]] = []
        for repo_name in ("frontend", "backend"):
            result = inspect_module_result(
                module, repo_name, module_repos[(module, repo_name)], token
            )
            worktrees.append(result)
            results_by_key[(module, repo_name)] = result
            times.append(
                commit_time(module_repos[(module, repo_name)], result["resultPin"]["commit"])
            )
        migration = migration_evidence(
            module,
            results_by_key[(module, "backend")],
            module_repos[(module, "backend")],
            token,
        )
        module_results.append(
            {
                "module": module,
                "sliceId": MODULES[module]["sliceId"],
                "tokenId": MODULES[module]["tokenId"],
                "tokenExpiresAt": token.get("expiresAt"),
                "pathPolicySha256": token.get("pathPolicySha256"),
                "worktrees": worktrees,
                "migration": migration,
            }
        )
    validate_module_test_input(
        evidence,
        frontend,
        input_pin["commit"],
        run_id,
        results_by_key,
        r2["tokens"],
    )
    evidence_output_paths = [
        str(row["output"]["path"])
        for row in evidence["results"]
    ]
    assert_distinct_non_reserved_run_inputs(
        run_id,
        [test_evidence_path, shared_plan_path, *evidence_output_paths],
        "Control input evidence carrier",
    )
    input_parent = assert_exact_added_carrier(
        frontend,
        input_pin["commit"],
        [test_evidence_path, shared_plan_path, *evidence_output_paths],
        "Control input evidence carrier",
    )
    shared_test_source, _ = verify_shared_test_source_carrier(
        frontend, input_parent, require_current=False
    )
    shared_test_source["inputCarrierDirectChild"] = True
    backend_bases = {
        result["basePin"]["commit"]
        for (_module, repo_name), result in results_by_key.items()
        if repo_name == "backend"
    }
    if len(backend_bases) != 1:
        fail("module results do not share one canonical backend execution base")
    verify_canonical_command_sources(
        frontend,
        input_pin["commit"],
        backend,
        next(iter(backend_bases)),
    )
    assert_run_never_preexisted(frontend, run_id, input_pin["commit"])
    if require_input_current:
        assert_exact_run_history(frontend, run_id, [input_pin["commit"]])
    for reserved in reserved_receipt_paths(run_id):
        if tree_entry(frontend, input_pin["commit"], reserved) is not None:
            fail(f"reserved receipt path already exists in input carrier: {reserved}")
    union = expected_union(module_results)
    toolchain = []
    for relative in TOOL_RELATIVE_PATHS:
        path_value = (R3_ROOT_REL / relative).as_posix()
        tool_pin, _ = git_file_pin(frontend, input_pin["commit"], path_value)
        toolchain.append(tool_pin)
    payload = {
        "schema": "dwp.hris.g7-sys-hrm-result-admission-receipt.v3",
        "receiptId": f"HRIS-G7-SYS-HRM-RESULT-ADMISSION-{run_id.upper()}",
        "runId": run_id,
        "status": "PASS_RESULTS_ADMITTED_PENDING_CARRIER",
        "issuedAt": iso_utc(max(times)),
        "issuedBy": "SYS_COMMON_INTEGRATION_CONTROL",
        "predecessor": {
            "r2PromotionReceipt": r2["receiptPin"],
            "activeTokenClosedSet": [
                MODULES["SYS"]["tokenId"], MODULES["HRM"]["tokenId"]
            ],
            "integrationMergeAuthorized": False,
        },
        "testEvidence": {
            **evidence_pin,
            "carrierCommit": input_pin["commit"],
            "carrierTree": input_pin["tree"],
            "evidenceId": evidence.get("evidenceId"),
            "closedSet": EXPECTED_TEST_CLOSED_SET,
        },
        "sharedVerificationPlan": {
            **plan_pin,
            "carrierCommit": input_pin["commit"],
            "carrierTree": input_pin["tree"],
            "planId": plan.get("planId"),
            "authorityStatus": "CONTROL_PROPOSAL_NOT_PREDECESSOR_AUTHORITY",
        },
        "sharedTestSource": shared_test_source,
        "toolchain": toolchain,
        "moduleResults": module_results,
        "expectedUnionSha256": path_digest(union),
        "authority": {
            "resultsAdmittedAfterCarrier": True,
            "integrationMergeAuthorized": False,
            "sharedControlPathChangeAuthorizedForModules": False,
            "customerDataAuthorized": False,
            "customerActivationAuthorized": False,
            "productionReleaseAuthorized": False,
        },
    }
    return sealed(payload)


def artifact_rel(run_id: str, name: str) -> Path:
    return run_root_rel(run_id) / name


def write_once(frontend: Path, relative: Path, value: dict[str, Any]) -> None:
    target = frontend / relative
    if target.exists() or target.is_symlink():
        fail(f"append-only artifact already exists: {relative}")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(json_bytes(value))


def write_bytes_once(frontend: Path, relative: Path, raw: bytes) -> None:
    target = frontend / relative
    if target.exists() or target.is_symlink():
        fail(f"append-only artifact already exists: {relative}")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(raw)


def prepare_shared_test_source(frontend: Path, tooling_carrier: str) -> list[Path]:
    frontend = ensure_repo(frontend, "central frontend")
    branch, upstream = CENTRAL_BRANCHES["frontend"]
    tooling_state = carrier_pin(
        frontend,
        tooling_carrier,
        branch,
        upstream,
        "R3 tooling carrier before shared-test source preparation",
        require_current=True,
    )
    verify_tooling_carrier(frontend, tooling_state["commit"])
    relative = Path(SHARED_TEST_SOURCE_PATH)
    if tree_entry(frontend, tooling_state["commit"], SHARED_TEST_SOURCE_PATH) is not None:
        fail("shared-test source already exists in the tooling carrier")
    patch_pin, patch_raw = git_file_pin(
        frontend,
        tooling_state["commit"],
        CONTROL_PREREQUISITES_PATCH_PATH,
    )
    if patch_pin["path"] != CONTROL_PREREQUISITES_PATCH_PATH:
        fail("Control prerequisite patch pin path mismatch")
    applied = subprocess.run(
        [
            "git",
            "-C",
            str(frontend),
            "apply",
            "--whitespace=nowarn",
            "-",
        ],
        input=patch_raw,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if applied.returncode != 0:
        detail = applied.stderr.decode("utf-8", "replace").strip()
        fail(f"pinned Control prerequisite patch did not apply: {detail}")
    raw_changes = run_git(
        frontend, "diff", "--name-status", "--no-renames", "-z"
    )
    parts = [
        item.decode("utf-8", "surrogateescape")
        for item in raw_changes.split(b"\0")
        if item
    ]
    if len(parts) % 2:
        fail("applied Control prerequisite patch produced malformed status")
    actual_changes = sorted(
        (parts[index], parts[index + 1]) for index in range(0, len(parts), 2)
    )
    expected_changes = sorted(
        ("M", path_value) for path_value in CONTROL_PREREQUISITE_PATHS
    )
    if actual_changes != expected_changes:
        fail(
            "applied Control prerequisite patch changed an unexpected path; "
            f"expected {expected_changes}, got {actual_changes}"
        )
    working_patch = run_git(
        frontend,
        "diff",
        "--full-index",
        "--no-ext-diff",
        "--no-renames",
        "--",
        *CONTROL_PREREQUISITE_PATHS,
    )
    if working_patch != patch_raw:
        fail("applied Control prerequisite diff != pinned patch")
    write_bytes_once(frontend, relative, SHARED_TEST_SOURCE_BYTES)
    return [*(Path(path_value) for path_value in CONTROL_PREREQUISITE_PATHS), relative]


def read_receipt_from_carrier(
    frontend: Path,
    carrier: str,
    relative: Path,
    label: str,
) -> tuple[dict[str, Any], dict[str, Any]]:
    pin, raw = git_file_pin(frontend, carrier, relative.as_posix())
    receipt = parse_json_bytes(raw, label)
    verify_seal(receipt, label)
    return receipt, pin


def module_repo_map_from_receipt(receipt: dict[str, Any]) -> dict[tuple[str, str], Path]:
    output: dict[tuple[str, str], Path] = {}
    for module_result in receipt.get("moduleResults", []):
        if not isinstance(module_result, dict):
            fail("invalid module result in admission receipt")
        module = module_result.get("module")
        for worktree in module_result.get("worktrees", []):
            if not isinstance(worktree, dict):
                fail("invalid worktree result in admission receipt")
            output[(module, worktree.get("repo"))] = Path(
                str(worktree.get("absolutePath", ""))
            )
    if set(output) != set(DEFAULT_MODULE_REPOS):
        fail("admission receipt does not contain the exact four module worktrees")
    return output


def rebuild_admission(
    frontend: Path,
    backend: Path,
    receipt: dict[str, Any],
) -> dict[str, Any]:
    test_pin = receipt.get("testEvidence", {})
    plan_pin = receipt.get("sharedVerificationPlan", {})
    return build_admission(
        str(receipt.get("runId", "")),
        frontend,
        backend,
        module_repo_map_from_receipt(receipt),
        str(test_pin.get("carrierCommit", "")),
        str(test_pin.get("path", "")),
        str(plan_pin.get("path", "")),
        require_input_current=False,
    )


def admission_from_carrier(
    run_id: str,
    frontend: Path,
    backend: Path,
    carrier: str,
    *,
    require_current: bool,
) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    branch, upstream = CENTRAL_BRANCHES["frontend"]
    carrier_state = carrier_pin(
        frontend,
        carrier,
        branch,
        upstream,
        "admission carrier",
        require_current=require_current,
    )
    receipt, receipt_pin = read_receipt_from_carrier(
        frontend,
        carrier_state["commit"],
        artifact_rel(run_id, "result-admission.v3.json"),
        "result admission receipt",
    )
    if receipt.get("schema") != "dwp.hris.g7-sys-hrm-result-admission-receipt.v3":
        fail("result admission receipt schema mismatch")
    if receipt.get("runId") != run_id or receipt.get("status") != "PASS_RESULTS_ADMITTED_PENDING_CARRIER":
        fail("result admission identity/status mismatch")
    if receipt.get("authority", {}).get("integrationMergeAuthorized") is not False:
        fail("result admission must not authorize integration")
    assert_exact_added_carrier(
        frontend,
        carrier_state["commit"],
        [artifact_rel(run_id, "result-admission.v3.json").as_posix()],
        "admission carrier",
        expected_parent=str(receipt.get("testEvidence", {}).get("carrierCommit", "")),
    )
    input_carrier = str(receipt.get("testEvidence", {}).get("carrierCommit", ""))
    assert_run_never_preexisted(frontend, run_id, input_carrier)
    if require_current:
        assert_exact_run_history(
            frontend, run_id, [input_carrier, carrier_state["commit"]]
        )
    rebuilt = rebuild_admission(frontend, backend, receipt)
    if canonical_bytes(receipt) != canonical_bytes(rebuilt):
        fail("result admission does not deterministically recompute")
    earliest_expiry = min(
        parse_time(str(row.get("tokenExpiresAt", "")), f"{row.get('module')} expiry")
        for row in receipt["moduleResults"]
    )
    if commit_time(frontend, carrier_state["commit"]) > earliest_expiry:
        fail("result admission carrier was committed after token expiry")
    return receipt, receipt_pin, carrier_state


def build_authorization(
    run_id: str,
    frontend: Path,
    backend: Path,
    admission_carrier: str,
    *,
    require_admission_current: bool,
    backend_pre_commit: str | None = None,
) -> dict[str, Any]:
    admission, admission_pin, carrier_state = admission_from_carrier(
        run_id,
        frontend,
        backend,
        admission_carrier,
        require_current=require_admission_current,
    )
    for reserved in (
        artifact_rel(run_id, "integration-authorization.v3.json").as_posix(),
        artifact_rel(run_id, "integrated-closure.v3.json").as_posix(),
    ):
        if tree_entry(frontend, carrier_state["commit"], reserved) is not None:
            fail(f"future reserved receipt path already exists: {reserved}")
    backend_branch, backend_upstream = CENTRAL_BRANCHES["backend"]
    if backend_pre_commit is None:
        backend_pre = live_pin(
            backend, "central backend pre-integration", backend_branch, backend_upstream
        )
    else:
        resolved_backend_pre = resolve_commit(backend, backend_pre_commit)
        assert_pushed(
            backend,
            resolved_backend_pre,
            backend_upstream,
            "central backend pre-integration",
        )
        backend_pre = {
            "commit": resolved_backend_pre,
            "tree": commit_tree(backend, resolved_backend_pre),
            "branch": backend_branch,
            "upstream": backend_upstream,
            "clean": True,
            "upstreamMatched": True,
            "stateSha256": EMPTY_SHA256,
        }
    backend_bases = {
        worktree["basePin"]["commit"]
        for module_result in admission["moduleResults"]
        for worktree in module_result["worktrees"]
        if worktree["repo"] == "backend"
    }
    if backend_bases != {backend_pre["commit"]}:
        fail("central backend pre-integration commit differs from module execution base")
    plan_ref = admission["sharedVerificationPlan"]
    plan_pin, plan_raw = git_file_pin(
        frontend, plan_ref["carrierCommit"], plan_ref["path"]
    )
    for key in ("gitBlobSha1", "sha256", "bytes"):
        if plan_pin[key] != plan_ref[key]:
            fail(f"shared verification plan {key} changed")
    plan = parse_json_bytes(plan_raw, "shared verification plan")
    validate_shared_plan(plan)
    authorized: list[dict[str, Any]] = []
    for module_result in admission["moduleResults"]:
        for worktree in module_result["worktrees"]:
            authorized.append(
                {
                    "module": module_result["module"],
                    "sliceId": module_result["sliceId"],
                    "tokenId": module_result["tokenId"],
                    "repo": worktree["repo"],
                    "commit": worktree["resultPin"]["commit"],
                    "tree": worktree["resultPin"]["tree"],
                    "changedFilesSha256": worktree["changedFilesSha256"],
                }
            )
    issued_at = max(
        commit_time(frontend, carrier_state["commit"]),
        commit_time(backend, backend_pre["commit"]),
    )
    payload = {
        "schema": "dwp.hris.g7-sys-hrm-integration-authorization-receipt.v3",
        "receiptId": f"HRIS-G7-SYS-HRM-INTEGRATION-AUTHORIZATION-{run_id.upper()}",
        "runId": run_id,
        "status": "PASS_INTEGRATION_AUTHORIZATION_PENDING_CARRIER",
        "issuedAt": iso_utc(issued_at),
        "issuedBy": "SYS_COMMON_INTEGRATION_CONTROL",
        "admission": {
            **admission_pin,
            "carrierCommit": carrier_state["commit"],
            "carrierTree": carrier_state["tree"],
            "receiptId": admission["receiptId"],
        },
        "authorizedResults": authorized,
        "expectedUnionSha256": admission["expectedUnionSha256"],
        "preIntegration": {
            "frontend": {
                "rule": "AUTHORIZATION_CARRIER_COMMIT_EXACT",
                "branch": CENTRAL_BRANCHES["frontend"][0],
                "upstream": CENTRAL_BRANCHES["frontend"][1],
            },
            "backend": backend_pre,
        },
        "sharedVerificationPlan": {
            **plan_ref,
            "closedSet": plan["closedSet"],
            "requiredCategories": REQUIRED_SHARED_CATEGORIES,
        },
        "sharedTestSource": admission["sharedTestSource"],
        "authority": {
            "beforeCarrier": {"integrationMergeAuthorized": False},
            "effectiveAfterCarrier": {
                "integrationMergeAuthorized": True,
                "exactResultsOnly": True,
                "frontendPreIntegrationRule": "AUTHORIZATION_CARRIER_COMMIT_EXACT",
                "backendPreIntegrationCommit": backend_pre["commit"],
            },
            "customerDataAuthorized": False,
            "customerActivationAuthorized": False,
            "productionReleaseAuthorized": False,
        },
    }
    return sealed(payload)


def authorization_from_carrier(
    run_id: str,
    frontend: Path,
    backend: Path,
    carrier: str,
    *,
    require_current: bool,
) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any], dict[str, Any]]:
    branch, upstream = CENTRAL_BRANCHES["frontend"]
    carrier_state = carrier_pin(
        frontend,
        carrier,
        branch,
        upstream,
        "authorization carrier",
        require_current=require_current,
    )
    receipt, receipt_pin = read_receipt_from_carrier(
        frontend,
        carrier_state["commit"],
        artifact_rel(run_id, "integration-authorization.v3.json"),
        "integration authorization receipt",
    )
    if receipt.get("schema") != "dwp.hris.g7-sys-hrm-integration-authorization-receipt.v3":
        fail("integration authorization schema mismatch")
    if receipt.get("runId") != run_id or receipt.get("status") != "PASS_INTEGRATION_AUTHORIZATION_PENDING_CARRIER":
        fail("integration authorization identity/status mismatch")
    authority = receipt.get("authority", {})
    if authority.get("beforeCarrier", {}).get("integrationMergeAuthorized") is not False:
        fail("authorization receipt grants authority before its carrier")
    if authority.get("effectiveAfterCarrier", {}).get("integrationMergeAuthorized") is not True:
        fail("authorization effective-after-carrier state missing")
    admission_ref = receipt.get("admission", {})
    assert_exact_added_carrier(
        frontend,
        carrier_state["commit"],
        [artifact_rel(run_id, "integration-authorization.v3.json").as_posix()],
        "authorization carrier",
        expected_parent=str(admission_ref.get("carrierCommit", "")),
    )
    admission, admission_pin, admission_carrier_state = admission_from_carrier(
        run_id,
        frontend,
        backend,
        str(admission_ref.get("carrierCommit", "")),
        require_current=False,
    )
    input_carrier = str(admission.get("testEvidence", {}).get("carrierCommit", ""))
    assert_run_never_preexisted(frontend, run_id, input_carrier)
    if require_current:
        assert_exact_run_history(
            frontend,
            run_id,
            [input_carrier, admission_carrier_state["commit"], carrier_state["commit"]],
        )
    for key in ("path", "gitBlobSha1", "sha256", "bytes"):
        if admission_ref.get(key) != admission_pin.get(key):
            fail(f"authorization admission {key} mismatch")
    if admission_ref.get("carrierTree") != admission_carrier_state["tree"]:
        fail("authorization admission carrier tree mismatch")
    expected = build_authorization(
        run_id,
        frontend,
        backend,
        admission_carrier_state["commit"],
        require_admission_current=False,
        backend_pre_commit=str(receipt.get("preIntegration", {}).get("backend", {}).get("commit", "")),
    )
    if canonical_bytes(receipt) != canonical_bytes(expected):
        fail("integration authorization does not deterministically recompute")
    earliest_expiry = min(
        parse_time(str(row.get("tokenExpiresAt", "")), f"{row.get('module')} expiry")
        for row in admission["moduleResults"]
    )
    if commit_time(frontend, carrier_state["commit"]) > earliest_expiry:
        fail("integration authorization carrier was committed after token expiry")
    return receipt, receipt_pin, carrier_state, admission


def expected_manifest_for_repo(
    admission: dict[str, Any], repo_name: str
) -> list[dict[str, Any]]:
    union = expected_union(admission["moduleResults"])[repo_name]
    return [
        {
            "path": item["path"],
            "change": item["change"],
            "before": item["before"],
            "after": item["after"],
        }
        for item in union
    ]


def central_integration_result(
    repo_name: str,
    repo: Path,
    pre_commit: str,
    integrated_commit: str,
    admission: dict[str, Any],
) -> dict[str, Any]:
    branch, upstream = CENTRAL_BRANCHES[repo_name]
    if current_branch(repo) != branch or current_upstream(repo) != upstream:
        fail(f"central {repo_name}: branch/upstream changed")
    pre = resolve_commit(repo, pre_commit)
    integrated = resolve_commit(repo, integrated_commit)
    if not is_ancestor(repo, pre, integrated):
        fail(f"central {repo_name}: integrated result does not descend from pre-integration")
    if commit_time(repo, integrated) < commit_time(repo, pre):
        fail(f"central {repo_name}: integrated commit timestamp precedes pre-integration")
    assert_pushed(repo, integrated, upstream, f"central {repo_name} integration")
    actual = file_manifest(repo, pre, integrated)
    expected = expected_manifest_for_repo(admission, repo_name)
    if canonical_bytes(actual) != canonical_bytes(expected):
        fail(f"central {repo_name}: integration diff is not the exact admitted union")
    return {
        "repo": repo_name,
        "preIntegration": {"commit": pre, "tree": commit_tree(repo, pre)},
        "integrated": {
            "commit": integrated,
            "tree": commit_tree(repo, integrated),
            "branch": branch,
            "upstream": upstream,
            "upstreamContainsCommit": True,
        },
        "changedFiles": actual,
        "changedFilesSha256": path_digest(actual),
    }


def local_output_pin(path_value: str, raw: bytes) -> dict[str, Any]:
    header = f"blob {len(raw)}\0".encode("ascii")
    return {
        "path": path_value,
        "gitBlobSha1": hashlib.sha1(header + raw).hexdigest(),
        "sha256": sha256_bytes(raw),
        "bytes": len(raw),
        "redactionStatus": "SANITIZED_NO_SECRET_OR_CUSTOMER_DATA",
    }


def expected_structured_result(
    command_id: str,
    source_pins: dict[str, dict[str, str]],
    stdout_raw: bytes,
    stderr_raw: bytes,
    exit_code: int,
    frontend: Path,
) -> dict[str, Any]:
    if type(exit_code) is not int or exit_code != 0:
        fail(f"{command_id}: semantic proof requires exit code zero")
    if command_id == PLAYWRIGHT_COMMAND_ID:
        require_empty_stderr(stderr_raw, "responsive/accessibility Playwright")
        report = validate_playwright_json(stdout_raw, source_pins)
    else:
        report = validate_non_playwright_semantics(
            command_id, stdout_raw, stderr_raw, frontend
        )
    return {
        "proofKind": SHARED_PROOF_KINDS[command_id],
        "sourcePins": source_pins,
        "exitCode": exit_code,
        "stdoutSha256": sha256_bytes(stdout_raw),
        "stderrSha256": sha256_bytes(stderr_raw),
        "report": report,
    }


def runner_record_digest(row: dict[str, Any]) -> str:
    material = copy.deepcopy(row)
    material.pop("recordSha256", None)
    return sha256_bytes(canonical_bytes(material))


def run_shared_batch(
    run_id: str,
    frontend: Path,
    backend: Path,
    authorization_carrier: str,
    frontend_integrated: str,
    backend_integrated: str,
    *,
    _test_argv_resolver: Callable[[dict[str, Any]], list[str]] | None = None,
    _test_clock: Callable[[], datetime] | None = None,
) -> Path:
    """Execute the exact shared plan once and write uncommitted carrier inputs.

    The underscore-prefixed hooks are deliberately absent from the CLI and are
    used only by the focused self-test to run real lightweight subprocesses.
    Their receipt is visibly marked and production validation rejects it.
    """
    frontend = ensure_repo(frontend, "central frontend shared runner")
    backend = ensure_repo(backend, "central backend shared runner")
    authorization, _, auth_state, admission = authorization_from_carrier(
        run_id, frontend, backend, authorization_carrier, require_current=False
    )
    backend_pre = authorization["preIntegration"]["backend"]["commit"]
    integration = {
        "frontend": central_integration_result(
            "frontend", frontend, auth_state["commit"], frontend_integrated, admission
        ),
        "backend": central_integration_result(
            "backend", backend, backend_pre, backend_integrated, admission
        ),
    }
    source_pins = {
        name: {
            "commit": integration[name]["integrated"]["commit"],
            "tree": integration[name]["integrated"]["tree"],
        }
        for name in ("frontend", "backend")
    }
    source_environment = source_pin_environment(source_pins)
    live_pin(
        frontend,
        "central frontend shared runner",
        CENTRAL_BRANCHES["frontend"][0],
        CENTRAL_BRANCHES["frontend"][1],
        exact_head=source_pins["frontend"]["commit"],
    )
    live_pin(
        backend,
        "central backend shared runner",
        CENTRAL_BRANCHES["backend"][0],
        CENTRAL_BRANCHES["backend"][1],
        exact_head=source_pins["backend"]["commit"],
    )
    verify_canonical_command_sources(
        frontend,
        source_pins["frontend"]["commit"],
        backend,
        source_pins["backend"]["commit"],
    )
    plan_ref = authorization["sharedVerificationPlan"]
    plan_pin, plan_raw = git_file_pin(frontend, plan_ref["carrierCommit"], plan_ref["path"])
    for key in ("path", "gitBlobSha1", "sha256", "bytes"):
        if plan_ref.get(key) != plan_pin[key]:
            fail(f"shared runner plan {key} mismatch")
    plan = parse_json_bytes(plan_raw, "shared runner plan")
    validate_shared_plan(plan)
    implementation_path = (R3_ROOT_REL / "materialize_g7_sys_hrm_result_acceptance.py").as_posix()
    implementation_pin, _ = git_file_pin(
        frontend, source_pins["frontend"]["commit"], implementation_path
    )
    evidence_path = artifact_rel(run_id, "shared-verification-evidence.v3.json")
    stream_paths: list[Path] = []
    for index, command in enumerate(EXPECTED_SHARED_COMMANDS, start=1):
        slug = command["commandId"].lower().replace("_", "-")
        stream_paths.extend(
            [
                artifact_rel(run_id, f"shared-runner/{index:02d}-{slug}.stdout"),
                artifact_rel(run_id, f"shared-runner/{index:02d}-{slug}.stderr"),
            ]
        )
    for relative in [evidence_path, *stream_paths]:
        if (frontend / relative).exists() or (frontend / relative).is_symlink():
            fail(f"append-only shared runner artifact already exists: {relative}")

    execution_mode = (
        SELF_TEST_EXECUTION_MODE if _test_argv_resolver is not None else RUNNER_EXECUTION_MODE
    )
    clock = _test_clock or (lambda: datetime.now(timezone.utc))
    records: list[dict[str, Any]] = []
    pending_files: list[tuple[Path, bytes]] = []
    previous = RUNNER_GENESIS_SHA256
    with tempfile.TemporaryDirectory(prefix="g7-sys-hrm-shared-runner-"):
        for index, command in enumerate(EXPECTED_SHARED_COMMANDS, start=1):
            repo = frontend if command["repo"] == "frontend" else backend
            logical_argv = list(command["argv"])
            actual_argv = (
                _test_argv_resolver(command)
                if _test_argv_resolver is not None
                else logical_argv
            )
            if not actual_argv or not all(isinstance(value, str) and value for value in actual_argv):
                fail(f"{command['commandId']}: invalid subprocess argv")
            started = clock()
            monotonic_start = time.monotonic_ns()
            completed = subprocess.run(
                actual_argv,
                cwd=repo,
                env={**os.environ, **source_environment},
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=False,
                shell=False,
            )
            elapsed_ms = max(0, (time.monotonic_ns() - monotonic_start) // 1_000_000)
            ended = clock()
            if ended < started:
                fail(f"{command['commandId']}: runner clock moved backwards")
            if completed.returncode != 0:
                detail = completed.stderr.decode("utf-8", "replace")[-1000:]
                fail(
                    f"{command['commandId']}: canonical command exited "
                    f"{completed.returncode}: {detail}"
                )
            # Commands may not mutate either exact clean/pushed source result.
            live_pin(
                frontend,
                f"{command['commandId']} frontend post-command",
                CENTRAL_BRANCHES["frontend"][0],
                CENTRAL_BRANCHES["frontend"][1],
                exact_head=source_pins["frontend"]["commit"],
            )
            live_pin(
                backend,
                f"{command['commandId']} backend post-command",
                CENTRAL_BRANCHES["backend"][0],
                CENTRAL_BRANCHES["backend"][1],
                exact_head=source_pins["backend"]["commit"],
            )
            slug = command["commandId"].lower().replace("_", "-")
            stdout_path = artifact_rel(
                run_id, f"shared-runner/{index:02d}-{slug}.stdout"
            )
            stderr_path = artifact_rel(
                run_id, f"shared-runner/{index:02d}-{slug}.stderr"
            )
            stdout_pin = local_output_pin(stdout_path.as_posix(), completed.stdout)
            stderr_pin = local_output_pin(stderr_path.as_posix(), completed.stderr)
            row = {
                "recordIndex": index,
                **copy.deepcopy(command),
                "executionMode": execution_mode,
                "startedAt": iso_utc(started),
                "completedAt": iso_utc(ended),
                "elapsedMs": elapsed_ms,
                "sourcePins": copy.deepcopy(source_pins),
                "status": "PASS",
                "exitCode": completed.returncode,
                "stdout": stdout_pin,
                "stderr": stderr_pin,
                "structuredResult": expected_structured_result(
                    command["commandId"],
                    source_pins,
                    completed.stdout,
                    completed.stderr,
                    completed.returncode,
                    frontend,
                ),
                "previousRecordSha256": previous,
            }
            row["recordSha256"] = runner_record_digest(row)
            previous = row["recordSha256"]
            records.append(row)
            pending_files.extend(
                [(stdout_path, completed.stdout), (stderr_path, completed.stderr)]
            )
    evidence = sealed(
        {
            "schema": "dwp.hris.g7-sys-hrm-shared-verification-evidence-input.v3",
            "evidenceId": f"HRIS-G7-SYS-HRM-SHARED-RUNNER-{run_id.upper()}",
            "issuedBy": "SYS_COMMON_INTEGRATION_CONTROL",
            "authorityStatus": "CONTROL_AUTHORED_POST_INTEGRATION_EVIDENCE",
            "plan": {
                key: plan_ref[key]
                for key in ("path", "gitBlobSha1", "sha256", "bytes")
            },
            "sourcePins": source_pins,
            "runner": {
                "implementation": implementation_pin,
                "executionMode": execution_mode,
                "argvDispatch": "DIRECT_LIST_NO_SHELL",
                "environmentDispatch": "INHERITED_PLUS_EXACT_SOURCE_PINS",
                "sourceEnvironment": source_environment,
                "commandCount": len(records),
                "genesisSha256": RUNNER_GENESIS_SHA256,
                "finalRecordSha256": previous,
            },
            "singleBatch": True,
            "closedSet": EXPECTED_SHARED_CLOSED_SET,
            "results": records,
            "startedAt": records[0]["startedAt"],
            "completedAt": records[-1]["completedAt"],
        }
    )
    for relative, raw in pending_files:
        write_bytes_once(frontend, relative, raw)
    write_once(frontend, evidence_path, evidence)
    return evidence_path


def validate_shared_evidence(
    value: dict[str, Any],
    frontend: Path,
    backend: Path,
    carrier: str,
    run_id: str,
    plan: dict[str, Any],
    plan_ref: dict[str, Any],
    source_pins: dict[str, dict[str, str]],
    *,
    allow_test_mode: bool = False,
) -> None:
    verify_seal(value, "shared Control verification evidence")
    expect_keys(
        value,
        {"schema", "evidenceId", "issuedBy", "authorityStatus", "plan", "sourcePins", "runner", "singleBatch", "closedSet", "results", "startedAt", "completedAt", "sealedPayloadSha256"},
        "shared Control verification evidence",
    )
    if value.get("schema") != "dwp.hris.g7-sys-hrm-shared-verification-evidence-input.v3":
        fail("shared Control evidence schema mismatch")
    if value.get("issuedBy") != "SYS_COMMON_INTEGRATION_CONTROL":
        fail("shared Control evidence issuer mismatch")
    if value.get("authorityStatus") != "CONTROL_AUTHORED_POST_INTEGRATION_EVIDENCE":
        fail("shared Control evidence authority status mismatch")
    if value.get("singleBatch") is not True:
        fail("shared Control verification must be captured as one batch")
    evidence_plan = value.get("plan")
    if not isinstance(evidence_plan, dict):
        fail("shared Control evidence plan pin missing")
    expect_keys(evidence_plan, {"path", "gitBlobSha1", "sha256", "bytes"}, "shared evidence plan")
    for key in ("path", "gitBlobSha1", "sha256", "bytes"):
        if evidence_plan.get(key) != plan_ref.get(key):
            fail(f"shared Control evidence plan {key} mismatch")
    if value.get("sourcePins") != source_pins:
        fail("shared Control evidence source pins mismatch")
    runner = value.get("runner")
    if not isinstance(runner, dict):
        fail("shared Control evidence runner receipt missing")
    expect_keys(
        runner,
        {"implementation", "executionMode", "argvDispatch", "environmentDispatch", "sourceEnvironment", "commandCount", "genesisSha256", "finalRecordSha256"},
        "shared Control runner",
    )
    mode = runner.get("executionMode")
    allowed_modes = {RUNNER_EXECUTION_MODE}
    if allow_test_mode:
        allowed_modes.add(SELF_TEST_EXECUTION_MODE)
    if mode not in allowed_modes:
        fail("shared Control runner was not a direct exact-argv production execution")
    if runner.get("argvDispatch") != "DIRECT_LIST_NO_SHELL":
        fail("shared Control runner used an unapproved argv dispatch")
    if runner.get("environmentDispatch") != "INHERITED_PLUS_EXACT_SOURCE_PINS":
        fail("shared Control runner used an unapproved environment dispatch")
    if runner.get("sourceEnvironment") != source_pin_environment(source_pins):
        fail("shared Control runner source environment differs from source heads")
    implementation_path = (
        R3_ROOT_REL / "materialize_g7_sys_hrm_result_acceptance.py"
    ).as_posix()
    implementation_pin, _ = git_file_pin(
        frontend, source_pins["frontend"]["commit"], implementation_path
    )
    if runner.get("implementation") != implementation_pin:
        fail("shared Control runner implementation pin mismatch")
    started = parse_time(str(value.get("startedAt", "")), "shared batch start")
    completed = parse_time(str(value.get("completedAt", "")), "shared batch completion")
    if completed < started:
        fail("shared batch completion precedes start")
    source_ready_at = max(
        commit_time(frontend, source_pins["frontend"]["commit"]),
        commit_time(backend, source_pins["backend"]["commit"]),
    )
    if started < source_ready_at:
        fail("shared batch started before both central source-result commits")
    if completed > commit_time(frontend, carrier):
        fail("shared batch completion is after its evidence carrier commit")
    if value.get("closedSet") != plan.get("closedSet"):
        fail("shared Control evidence closed set differs from proposed plan")
    results = value.get("results")
    if not isinstance(results, list) or len(results) != len(plan["commands"]):
        fail("shared Control evidence result count differs from plan")
    if [item.get("commandId") for item in results if isinstance(item, dict)] != plan["closedSet"]:
        fail("shared Control evidence result order/identity mismatch")
    if runner.get("commandCount") != len(results) or runner.get("genesisSha256") != RUNNER_GENESIS_SHA256:
        fail("shared Control runner count/genesis mismatch")
    previous = RUNNER_GENESIS_SHA256
    previous_completed = started
    for index, command in enumerate(plan["commands"], start=1):
        command_id = command["commandId"]
        row = results[index - 1]
        if not isinstance(row, dict):
            fail(f"shared result {command_id}: row is not an object")
        expect_keys(
            row,
            {"recordIndex", "commandId", "category", "repo", "cwd", "argv", "executionMode", "startedAt", "completedAt", "elapsedMs", "sourcePins", "status", "exitCode", "stdout", "stderr", "structuredResult", "previousRecordSha256", "recordSha256"},
            f"shared result {command_id}",
        )
        for key in ("category", "repo", "cwd", "argv"):
            if row.get(key) != command.get(key):
                fail(f"shared result {command_id}: {key} differs from plan")
        if (
            row.get("status") != "PASS"
            or type(row.get("exitCode")) is not int
            or row.get("exitCode") != 0
        ):
            fail(f"shared result {command_id}: not PASS/0")
        if row.get("recordIndex") != index or row.get("executionMode") != mode:
            fail(f"shared result {command_id}: runner index/mode mismatch")
        if row.get("sourcePins") != source_pins:
            fail(f"shared result {command_id}: source pins mismatch")
        row_started = parse_time(str(row.get("startedAt", "")), f"{command_id} start")
        row_completed = parse_time(str(row.get("completedAt", "")), f"{command_id} completion")
        if row_started < previous_completed or row_completed < row_started:
            fail(f"shared result {command_id}: non-monotonic runner timestamps")
        if not isinstance(row.get("elapsedMs"), int) or row["elapsedMs"] < 0:
            fail(f"shared result {command_id}: invalid elapsedMs")
        slug = command_id.lower().replace("_", "-")
        expected_stdout_path = artifact_rel(
            run_id, f"shared-runner/{index:02d}-{slug}.stdout"
        ).as_posix()
        expected_stderr_path = artifact_rel(
            run_id, f"shared-runner/{index:02d}-{slug}.stderr"
        ).as_posix()
        if row.get("stdout", {}).get("path") != expected_stdout_path:
            fail(f"shared result {command_id}: stdout path mismatch")
        if row.get("stderr", {}).get("path") != expected_stderr_path:
            fail(f"shared result {command_id}: stderr path mismatch")
        stdout_raw = verify_output_pin(
            frontend, carrier, row.get("stdout"), run_id, f"{command_id} stdout",
            allow_empty=True,
        )
        stderr_raw = verify_output_pin(
            frontend, carrier, row.get("stderr"), run_id, f"{command_id} stderr",
            allow_empty=True,
        )
        if row.get("previousRecordSha256") != previous:
            fail(f"shared result {command_id}: hash-chain predecessor mismatch")
        if row.get("recordSha256") != runner_record_digest(row):
            fail(f"shared result {command_id}: record digest mismatch")
        previous = row["recordSha256"]
        previous_completed = row_completed
        derived = expected_structured_result(
            command_id,
            row["sourcePins"],
            stdout_raw,
            stderr_raw,
            row["exitCode"],
            frontend,
        )
        if row.get("structuredResult") != derived:
            fail(f"shared result {command_id}: structured result mismatch")
        if not isinstance(derived["report"], dict):
            fail(f"shared result {command_id}: semantic report is missing")
    if previous_completed != completed or results[0]["startedAt"] != value.get("startedAt"):
        fail("shared Control runner batch boundary timestamps mismatch")
    if runner.get("finalRecordSha256") != previous:
        fail("shared Control runner final hash mismatch")


def build_closure(
    run_id: str,
    frontend: Path,
    backend: Path,
    authorization_carrier: str,
    frontend_integrated: str,
    backend_integrated: str,
    shared_evidence_path: str,
    shared_evidence_carrier: str,
    *,
    require_shared_current: bool,
    allow_test_mode: bool = False,
) -> dict[str, Any]:
    authorization, authorization_pin, auth_carrier_state, admission = authorization_from_carrier(
        run_id,
        frontend,
        backend,
        authorization_carrier,
        require_current=False,
    )
    branch, upstream = CENTRAL_BRANCHES["frontend"]
    shared_carrier_state = carrier_pin(
        frontend,
        shared_evidence_carrier,
        branch,
        upstream,
        "shared evidence carrier",
        require_current=require_shared_current,
    )
    live_pin(
        backend,
        "central backend integrated result",
        CENTRAL_BRANCHES["backend"][0],
        CENTRAL_BRANCHES["backend"][1],
        exact_head=backend_integrated,
    )
    shared_evidence_path = require_run_path(
        run_id, shared_evidence_path, "shared evidence"
    )
    expected_shared_path = artifact_rel(
        run_id, "shared-verification-evidence.v3.json"
    ).as_posix()
    if shared_evidence_path != expected_shared_path:
        fail("shared evidence path is not the exact runner output path")
    assert_distinct_non_reserved_run_inputs(
        run_id, [shared_evidence_path], "shared verification evidence carrier"
    )
    shared_pin, shared_raw = git_file_pin(
        frontend, shared_carrier_state["commit"], shared_evidence_path
    )
    shared_value = parse_json_bytes(shared_raw, "shared Control verification evidence")
    plan_ref = authorization["sharedVerificationPlan"]
    plan_pin, plan_raw = git_file_pin(
        frontend, plan_ref["carrierCommit"], plan_ref["path"]
    )
    for key in ("gitBlobSha1", "sha256", "bytes"):
        if plan_ref.get(key) != plan_pin[key]:
            fail(f"authorization shared plan {key} mismatch")
    plan = parse_json_bytes(plan_raw, "shared verification plan")
    validate_shared_plan(plan)
    backend_pre = authorization["preIntegration"]["backend"]["commit"]
    integration = {
        "frontend": central_integration_result(
            "frontend",
            frontend,
            auth_carrier_state["commit"],
            frontend_integrated,
            admission,
        ),
        "backend": central_integration_result(
            "backend", backend, backend_pre, backend_integrated, admission
        ),
    }
    source_pins = {
        repo_name: {
            "commit": integration[repo_name]["integrated"]["commit"],
            "tree": integration[repo_name]["integrated"]["tree"],
        }
        for repo_name in ("frontend", "backend")
    }
    verify_canonical_command_sources(
        frontend,
        source_pins["frontend"]["commit"],
        backend,
        source_pins["backend"]["commit"],
    )
    validate_shared_evidence(
        shared_value,
        frontend,
        backend,
        shared_carrier_state["commit"],
        run_id,
        plan,
        plan_ref,
        source_pins,
        allow_test_mode=allow_test_mode,
    )
    shared_output_paths = [
        str(row[stream]["path"])
        for row in shared_value["results"]
        for stream in ("stdout", "stderr")
    ]
    assert_distinct_non_reserved_run_inputs(
        run_id,
        [shared_evidence_path, *shared_output_paths],
        "shared verification evidence carrier",
    )
    assert_exact_added_carrier(
        frontend,
        shared_carrier_state["commit"],
        [shared_evidence_path, *shared_output_paths],
        "shared verification evidence carrier",
        expected_parent=integration["frontend"]["integrated"]["commit"],
    )
    if not is_ancestor(frontend, integration["frontend"]["integrated"]["commit"], shared_carrier_state["commit"]):
        fail("shared evidence carrier does not descend from frontend integration result")
    input_carrier = str(admission.get("testEvidence", {}).get("carrierCommit", ""))
    admission_carrier = str(authorization.get("admission", {}).get("carrierCommit", ""))
    assert_run_never_preexisted(frontend, run_id, input_carrier)
    if require_shared_current:
        assert_exact_run_history(
            frontend,
            run_id,
            [
                input_carrier,
                admission_carrier,
                auth_carrier_state["commit"],
                shared_carrier_state["commit"],
            ],
        )
    closure_path = artifact_rel(run_id, "integrated-closure.v3.json").as_posix()
    if tree_entry(frontend, shared_carrier_state["commit"], closure_path) is not None:
        fail(f"future reserved receipt path already exists: {closure_path}")
    earliest_expiry = min(
        parse_time(str(row.get("tokenExpiresAt", "")), f"{row.get('module')} expiry")
        for row in admission["moduleResults"]
    )
    for label, timestamp in (
        ("frontend integration", commit_time(frontend, integration["frontend"]["integrated"]["commit"])),
        ("backend integration", commit_time(backend, integration["backend"]["integrated"]["commit"])),
        ("shared evidence carrier", commit_time(frontend, shared_carrier_state["commit"])),
    ):
        if timestamp > earliest_expiry:
            fail(f"{label} was committed after token expiry")
    issued_at = max(
        commit_time(frontend, shared_carrier_state["commit"]),
        commit_time(frontend, integration["frontend"]["integrated"]["commit"]),
        commit_time(backend, integration["backend"]["integrated"]["commit"]),
    )
    payload = {
        "schema": "dwp.hris.g7-sys-hrm-integrated-closure-receipt.v3",
        "receiptId": f"HRIS-G7-SYS-HRM-INTEGRATED-CLOSURE-{run_id.upper()}",
        "runId": run_id,
        "status": "PASS_INTEGRATED_CLOSURE_PENDING_CARRIER",
        "issuedAt": iso_utc(issued_at),
        "issuedBy": "SYS_COMMON_INTEGRATION_CONTROL",
        "authorization": {
            **authorization_pin,
            "carrierCommit": auth_carrier_state["commit"],
            "carrierTree": auth_carrier_state["tree"],
            "receiptId": authorization["receiptId"],
        },
        "centralIntegration": {
            "expectedUnionSha256": admission["expectedUnionSha256"],
            "onlyExpectedUnionChanges": True,
            "repositories": integration,
        },
        "sharedControlVerification": {
            **shared_pin,
            "carrierCommit": shared_carrier_state["commit"],
            "carrierTree": shared_carrier_state["tree"],
            "evidenceId": shared_value.get("evidenceId"),
            "singleBatch": True,
            "planAuthorityStatus": "CONTROL_PROPOSAL_NOT_PREDECESSOR_AUTHORITY",
        },
        "tokenClosures": [
            {
                "module": "SYS",
                "sliceId": MODULES["SYS"]["sliceId"],
                "tokenId": MODULES["SYS"]["tokenId"],
                "stateAfterCarrier": "RESULT_INTEGRATED_CLOSED",
            },
            {
                "module": "HRM",
                "sliceId": MODULES["HRM"]["sliceId"],
                "tokenId": MODULES["HRM"]["tokenId"],
                "stateAfterCarrier": "RESULT_INTEGRATED_CLOSED",
            },
        ],
        "modPerCompplanReadiness": {
            "sliceId": "MOD-PER-COMPPLAN",
            "status": "CONTROL_PROPOSAL_READY_FOR_PACKET_PREPARATION",
            "authorityStatus": "CONTROL_PROPOSAL_NOT_CANONICAL_START_AUTHORITY",
            "implementationTokenIssued": False,
            "sourceChangeAuthorized": False,
            "payConsumerReady": False,
            "nextRequiredActions": [
                "author and independently validate an exact MOD-PER-COMPPLAN packet and path policy",
                "resolve exact migration authority and closed-set module verification commands",
                "issue a later append-only promotion receipt and start token before source changes",
                "keep BASE-TFR-PAY-016 withheld until the pushed MOD-PER-COMPPLAN producer result and named tests are pinned",
            ],
        },
        "authority": {
            "effectiveAfterCarrier": {
                "sysHrmTokensClosed": True,
                "modPerCompplanPacketPreparationMayBegin": True,
            },
            "integrationMergeAuthorized": False,
            "customerDataAuthorized": False,
            "customerActivationAuthorized": False,
            "productionReleaseAuthorized": False,
        },
    }
    return sealed(payload)


def add_common_repo_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--frontend", type=Path, default=DEFAULT_FRONTEND)
    parser.add_argument("--backend", type=Path, default=DEFAULT_BACKEND)
    parser.add_argument(
        "--sys-frontend", type=Path, default=DEFAULT_MODULE_REPOS[("SYS", "frontend")]
    )
    parser.add_argument(
        "--sys-backend", type=Path, default=DEFAULT_MODULE_REPOS[("SYS", "backend")]
    )
    parser.add_argument(
        "--hrm-frontend", type=Path, default=DEFAULT_MODULE_REPOS[("HRM", "frontend")]
    )
    parser.add_argument(
        "--hrm-backend", type=Path, default=DEFAULT_MODULE_REPOS[("HRM", "backend")]
    )


def module_repo_args(args: argparse.Namespace) -> dict[tuple[str, str], Path]:
    return {
        ("SYS", "frontend"): args.sys_frontend,
        ("SYS", "backend"): args.sys_backend,
        ("HRM", "frontend"): args.hrm_frontend,
        ("HRM", "backend"): args.hrm_backend,
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="phase", required=True)

    prepare_source = subparsers.add_parser(
        "prepare-source",
        help="apply the pinned Control patch and write the deterministic Playwright source",
    )
    prepare_source.add_argument("--frontend", type=Path, default=DEFAULT_FRONTEND)
    prepare_source.add_argument("--tooling-carrier", required=True)

    admit = subparsers.add_parser("admit", help="write result admission only")
    add_common_repo_args(admit)
    admit.add_argument("--run-id", required=True)
    admit.add_argument("--input-carrier", required=True)
    admit.add_argument("--test-evidence-path", required=True)
    admit.add_argument("--shared-plan-path", required=True)

    authorize = subparsers.add_parser(
        "authorize", help="write integration authorization only"
    )
    add_common_repo_args(authorize)
    authorize.add_argument("--run-id", required=True)
    authorize.add_argument("--admission-carrier", required=True)
    authorize.add_argument(
        "--backend-pre-commit",
        help="exact already-pushed backend module execution base",
    )

    run_shared = subparsers.add_parser(
        "run-shared",
        help="execute the canonical seven-command shared batch exactly once",
    )
    run_shared.add_argument("--frontend", type=Path, default=DEFAULT_FRONTEND)
    run_shared.add_argument("--backend", type=Path, default=DEFAULT_BACKEND)
    run_shared.add_argument("--run-id", required=True)
    run_shared.add_argument("--authorization-carrier", required=True)
    run_shared.add_argument("--frontend-integrated", required=True)
    run_shared.add_argument("--backend-integrated", required=True)

    close = subparsers.add_parser("close", help="write integrated closure only")
    add_common_repo_args(close)
    close.add_argument("--run-id", required=True)
    close.add_argument("--authorization-carrier", required=True)
    close.add_argument("--frontend-integrated", required=True)
    close.add_argument("--backend-integrated", required=True)
    close.add_argument("--shared-evidence-path", required=True)
    close.add_argument("--shared-evidence-carrier", required=True)

    subparsers.add_parser("sequence", help="print the exact carrier sequence")
    return parser


def print_sequence() -> None:
    print(
        "0 TOOLING: exact R2 promotion child; add/push exactly the 11 R3 files\n"
        "1 SOURCE: prepare-source; apply the pinned six-path Control patch and write the deterministic Playwright spec; commit/push exactly those seven paths; validator source\n"
        "2 INPUT: direct child of SOURCE; fresh run-id; add/push module evidence + logs + exact shared plan\n"
        "3 admit -> result-admission.v3.json (merge=false)\n"
        "4 commit/push admission; validator admission\n"
        "5 authorize -> integration-authorization.v3.json (effective only after carrier)\n"
        "6 commit/push authorization; validator authorization; then exact integration\n"
        "7 commit/push central FE/BE source results\n"
        "8 run-shared: execute exact argv once; write hash-chained stdout/stderr + evidence\n"
        "9 commit/push only runner evidence + exact streams\n"
        "10 close -> integrated-closure.v3.json\n"
        "11 commit/push closure; validator closure"
    )


def main(argv: Iterable[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if args.phase == "sequence":
        print_sequence()
        return 0
    if args.phase == "prepare-source":
        relatives = prepare_shared_test_source(args.frontend, args.tooling_carrier)
        print(json.dumps({
            "status": "PASS_PENDING_SOURCE_CARRIER",
            "phase": args.phase,
            "artifacts": [relative.as_posix() for relative in relatives],
            "templateId": SHARED_TEST_SOURCE_TEMPLATE_ID,
            "sha256": sha256_bytes(SHARED_TEST_SOURCE_BYTES),
        }))
        return 0
    frontend = ensure_repo(args.frontend, "central frontend")
    backend = ensure_repo(args.backend, "central backend")
    if args.phase == "run-shared":
        relative = run_shared_batch(
            args.run_id,
            frontend,
            backend,
            args.authorization_carrier,
            args.frontend_integrated,
            args.backend_integrated,
        )
        print(json.dumps({
            "status": "PASS_PENDING_SHARED_EVIDENCE_CARRIER",
            "phase": args.phase,
            "artifact": relative.as_posix(),
        }))
        return 0
    if args.phase == "admit":
        receipt = build_admission(
            args.run_id,
            frontend,
            backend,
            module_repo_args(args),
            args.input_carrier,
            args.test_evidence_path,
            args.shared_plan_path,
            require_input_current=True,
        )
        relative = artifact_rel(args.run_id, "result-admission.v3.json")
    elif args.phase == "authorize":
        receipt = build_authorization(
            args.run_id,
            frontend,
            backend,
            args.admission_carrier,
            require_admission_current=True,
            backend_pre_commit=args.backend_pre_commit,
        )
        relative = artifact_rel(args.run_id, "integration-authorization.v3.json")
    else:
        receipt = build_closure(
            args.run_id,
            frontend,
            backend,
            args.authorization_carrier,
            args.frontend_integrated,
            args.backend_integrated,
            args.shared_evidence_path,
            args.shared_evidence_carrier,
            require_shared_current=True,
        )
        relative = artifact_rel(args.run_id, "integrated-closure.v3.json")
    write_once(frontend, relative, receipt)
    print(json.dumps({"status": "PASS", "phase": args.phase, "artifact": relative.as_posix()}))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except GateError as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        raise SystemExit(1)
