#!/usr/bin/env python3
"""Independent fail-closed validator for SYS/HRM R3 result acceptance.

This validator intentionally does not import the materializer.  It repeats the
authority constants and recomputes seals, Git blobs, carrier parents, path
manifests, migration use, evidence closed sets, integration union, and closure.
It never executes application tests; it independently verifies the exact
runner transcript produced by the materializer's production-only CLI phase.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from fnmatch import fnmatchcase
from pathlib import Path, PurePosixPath
from typing import Any, Iterable


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
CENTRAL = {
    "frontend": {
        "branch": "codex/hris-g1-integration-frontend-20261006",
        "upstream": "origin/codex/hris-g1-integration-frontend-20261006",
    },
    "backend": {
        "branch": "codex/hris-g1-integration-backend-20261006",
        "upstream": "origin/codex/hris-g1-integration-backend-20261006",
    },
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
EXPECTED_TESTS: dict[str, dict[str, Any]] = {
    "SYS_BACKEND_TARGETED": {
        "module": "SYS", "repo": "backend", "cwd": "backend",
        "argv": ["./gradlew", ":dwp-platform-server:test", "--tests", "*ReferenceConfiguration*", "--tests", "*SysIaEntryQueryContractTest", "-PhrisSlice=BASE-TFR-SYS-007", "--no-daemon"],
    },
    "SYS_FRONTEND_TARGETED": {
        "module": "SYS", "repo": "frontend", "cwd": "frontend",
        "argv": ["yarn", "vitest", "run", "apps/dwp/src/features/hris/administration/reference-configuration"],
    },
    "HRM_BACKEND_TARGETED": {
        "module": "HRM", "repo": "backend", "cwd": "backend",
        "argv": ["./gradlew", ":dwp-people-server:test", "--tests", "*EmployeeChange*", "--tests", "*HrmIaEntryQueryContractTest", "-PhrisSlice=BASE-TFR-HRM-010", "--no-daemon"],
    },
    "HRM_FRONTEND_TARGETED": {
        "module": "HRM", "repo": "frontend", "cwd": "frontend",
        "argv": ["yarn", "vitest", "run", "apps/dwp/src/features/hris/employee-services/employee-change"],
    },
}
TEST_CLOSED_SET = list(EXPECTED_TESTS)
SHARED_CATEGORIES = [
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
        "argv": ["python3", "scripts/export-openapi-contracts.py", "--check", "--approved-snapshots"],
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
            "corepack", "yarn", "vitest", "run",
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
            "env", "E2E_BASE_URL=http://127.0.0.1:4200",
            "E2E_REUSE_EXISTING_SERVER=false",
            "VITE_HRIS_REFERENCE_CONFIGURATION_ENABLED=true",
            "VITE_HRIS_EMPLOYEE_CHANGE_ENABLED=true",
            "corepack", "yarn", "playwright", "test", SHARED_TEST_SOURCE_PATH,
            "--project=chromium", "--project=mobile", "--workers=1", "--reporter=json",
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


class ValidationError(RuntimeError):
    pass


def fail(message: str) -> None:
    raise ValidationError(message)


def canonical_bytes(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def sha256(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def check_seal(value: dict[str, Any], label: str) -> None:
    actual = value.get("sealedPayloadSha256")
    payload = copy.deepcopy(value)
    payload.pop("sealedPayloadSha256", None)
    if actual != sha256(canonical_bytes(payload)):
        fail(f"{label}: seal mismatch")


def expect_keys(value: dict[str, Any], keys: set[str], label: str) -> None:
    if set(value) != keys:
        fail(f"{label}: field set mismatch; expected {sorted(keys)}, got {sorted(value)}")


def git(repo: Path, *args: str, check: bool = True) -> bytes:
    process = subprocess.run(
        ["git", "-C", str(repo), *args],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if check and process.returncode:
        fail(
            f"git {' '.join(args)} failed in {repo}: "
            f"{process.stderr.decode('utf-8', 'replace').strip()}"
        )
    return process.stdout


def text(repo: Path, *args: str) -> str:
    return git(repo, *args).decode("utf-8", "strict").strip()


def ensure_repo(path: Path, label: str) -> Path:
    path = path.resolve()
    if text(path, "rev-parse", "--is-inside-work-tree") != "true":
        fail(f"{label}: not a Git worktree")
    return path


def commit(repo: Path, revision: str) -> str:
    result = text(repo, "rev-parse", "--verify", f"{revision}^{{commit}}")
    if not SHA1_RE.fullmatch(result):
        fail(f"invalid commit {revision!r}")
    return result


def tree(repo: Path, revision: str) -> str:
    result = text(repo, "rev-parse", f"{revision}^{{tree}}")
    if not SHA1_RE.fullmatch(result):
        fail(f"invalid tree for {revision}")
    return result


def branch(repo: Path) -> str:
    return text(repo, "symbolic-ref", "--quiet", "--short", "HEAD")


def upstream(repo: Path) -> str:
    return text(repo, "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}")


def ancestor(repo: Path, older: str, newer: str) -> bool:
    process = subprocess.run(
        ["git", "-C", str(repo), "merge-base", "--is-ancestor", older, newer],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    )
    if process.returncode not in (0, 1):
        fail(f"ancestry check failed: {older}..{newer}")
    return process.returncode == 0


def parse_time(value: str, label: str) -> datetime:
    try:
        result = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValidationError(f"{label}: invalid timestamp") from exc
    if result.tzinfo is None:
        fail(f"{label}: timezone missing")
    return result.astimezone(timezone.utc)


def commit_time(repo: Path, revision: str) -> datetime:
    return parse_time(text(repo, "show", "-s", "--format=%cI", revision), revision)


def iso(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def safe_path(value: str, label: str) -> str:
    path = PurePosixPath(value)
    if path.is_absolute() or not path.parts or any(part in ("", ".", "..") for part in path.parts):
        fail(f"{label}: unsafe path {value!r}")
    return path.as_posix()


def run_root(run_id: str) -> Path:
    if not RUN_ID_RE.fullmatch(run_id):
        fail("invalid run id")
    return R3_ROOT_REL / "runs" / run_id


def require_run_path(run_id: str, value: str, label: str) -> str:
    value = safe_path(value, label)
    prefix = run_root(run_id).as_posix() + "/"
    if not value.startswith(prefix):
        fail(f"{label}: path is outside run directory")
    return value


def reserved_receipt_paths(run_id: str) -> set[str]:
    root = run_root(run_id)
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
    raw = git(
        repo,
        "rev-list",
        "--all",
        "--full-history",
        "--",
        run_root(run_id).as_posix(),
    )
    commits = {line.decode("ascii") for line in raw.splitlines() if line}
    if not all(SHA1_RE.fullmatch(value) for value in commits):
        fail(f"{run_id}: invalid commit in run history")
    return commits


def assert_run_never_preexisted(repo: Path, run_id: str, input_carrier: str) -> None:
    input_commit = commit(repo, input_carrier)
    commits = run_history_commits(repo, run_id)
    if input_commit not in commits:
        fail(f"{run_id}: input carrier does not introduce the run path")
    for historical in commits:
        if historical != input_commit and not ancestor(repo, input_commit, historical):
            fail(
                f"{run_id}: run path existed before input carrier or on an unrelated "
                f"reachable authority ref at {historical}"
            )


def assert_exact_run_history(
    repo: Path, run_id: str, allowed_carriers: Iterable[str]
) -> None:
    expected = {commit(repo, value) for value in allowed_carriers}
    actual = run_history_commits(repo, run_id)
    if actual != expected:
        fail(
            f"{run_id}: run history carrier set mismatch; expected {sorted(expected)}, "
            f"got {sorted(actual)}"
        )


def entry(repo: Path, revision: str, path_value: str) -> dict[str, Any] | None:
    path_value = safe_path(path_value, "tree path")
    raw = git(repo, "ls-tree", "--full-tree", "-z", revision, "--", path_value)
    rows = [row for row in raw.split(b"\0") if row]
    if not rows:
        return None
    if len(rows) != 1 or b"\t" not in rows[0]:
        fail(f"ambiguous tree path {path_value}")
    metadata, raw_path = rows[0].split(b"\t", 1)
    mode, kind, object_id = metadata.decode("ascii").split()
    if raw_path.decode("utf-8", "surrogateescape") != path_value or kind != "blob":
        fail(f"unsupported tree object {path_value}")
    content = git(repo, "cat-file", "blob", object_id)
    return {
        "mode": mode,
        "gitBlobSha1": object_id,
        "bytes": len(content),
        "sha256": sha256(content),
    }


def file_pin(repo: Path, revision: str, path_value: str) -> tuple[dict[str, Any], bytes]:
    object_entry = entry(repo, revision, path_value)
    if object_entry is None or object_entry["mode"] not in ("100644", "100755"):
        fail(f"missing regular committed file {path_value} at {revision}")
    raw = git(repo, "show", f"{revision}:{path_value}")
    if sha256(raw) != object_entry["sha256"] or len(raw) != object_entry["bytes"]:
        fail(f"committed file pin mismatch: {path_value}")
    return {
        "path": path_value,
        "gitBlobSha1": object_entry["gitBlobSha1"],
        "sha256": object_entry["sha256"],
        "bytes": object_entry["bytes"],
    }, raw


def json_object(raw: bytes, label: str) -> dict[str, Any]:
    try:
        value = json.loads(raw)
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValidationError(f"{label}: invalid JSON") from exc
    if not isinstance(value, dict):
        fail(f"{label}: JSON root is not an object")
    return value


def pushed(repo: Path, revision: str, expected_upstream: str, label: str) -> None:
    resolved = commit(repo, revision)
    upstream_commit = commit(repo, expected_upstream)
    if not ancestor(repo, resolved, upstream_commit):
        fail(f"{label}: commit is not pushed to {expected_upstream}")


def carrier_state(
    repo: Path,
    revision: str,
    repo_name: str,
    label: str,
    require_current: bool,
) -> dict[str, str]:
    expected = CENTRAL[repo_name]
    if branch(repo) != expected["branch"] or upstream(repo) != expected["upstream"]:
        fail(f"{label}: central branch/upstream mismatch")
    resolved = commit(repo, revision)
    pushed(repo, resolved, expected["upstream"], label)
    if require_current:
        if commit(repo, "HEAD") != resolved:
            fail(f"{label}: supplied carrier is not current HEAD")
        if git(repo, "status", "--porcelain=v1", "-z"):
            fail(f"{label}: worktree is dirty")
        if commit(repo, expected["upstream"]) != resolved:
            fail(f"{label}: current carrier is not exact upstream head")
    return {"commit": resolved, "tree": tree(repo, resolved)}


def assert_carrier_shape(repo: Path, carrier: str, parent: str, artifact: str, label: str) -> None:
    carrier = commit(repo, carrier)
    parent = commit(repo, parent)
    ancestry = text(repo, "rev-list", "--parents", "-n", "1", carrier).split()
    if ancestry != [carrier, parent]:
        fail(f"{label}: carrier must be a single-parent commit directly after {parent}")
    if commit_time(repo, carrier) < commit_time(repo, parent):
        fail(f"{label}: carrier commit timestamp precedes its parent")
    raw = git(repo, "diff", "--name-status", "--no-renames", "-z", parent, carrier)
    parts = [part.decode("utf-8", "surrogateescape") for part in raw.split(b"\0") if part]
    if parts != ["A", artifact]:
        fail(f"{label}: carrier sole diff must add {artifact}; got {parts}")


def assert_exact_added_carrier(
    repo: Path,
    carrier_revision: str,
    expected_paths: Iterable[str],
    label: str,
    *,
    expected_parent: str | None = None,
) -> str:
    resolved = commit(repo, carrier_revision)
    ancestry = text(repo, "rev-list", "--parents", "-n", "1", resolved).split()
    if len(ancestry) != 2 or ancestry[0] != resolved:
        fail(f"{label}: carrier must have exactly one parent")
    parent = ancestry[1]
    if expected_parent is not None and parent != commit(repo, expected_parent):
        fail(f"{label}: carrier parent mismatch")
    if commit_time(repo, resolved) < commit_time(repo, parent):
        fail(f"{label}: carrier timestamp precedes parent")
    raw = git(repo, "diff", "--name-status", "--no-renames", "-z", parent, resolved)
    parts = [item.decode("utf-8", "surrogateescape") for item in raw.split(b"\0") if item]
    if len(parts) % 2:
        fail(f"{label}: malformed name-status output")
    actual = sorted((parts[index], parts[index + 1]) for index in range(0, len(parts), 2))
    expected = sorted(("A", safe_path(path, label)) for path in expected_paths)
    if actual != expected:
        fail(f"{label}: exact added-file set mismatch; expected {expected}, got {actual}")
    return parent


def changed_manifest(repo: Path, base: str, result: str) -> list[dict[str, Any]]:
    base = commit(repo, base)
    result = commit(repo, result)
    if not ancestor(repo, base, result):
        fail("result is not descendant of base")
    raw = git(repo, "diff", "--name-only", "--no-renames", "-z", base, result)
    paths = sorted(
        item.decode("utf-8", "surrogateescape")
        for item in raw.split(b"\0")
        if item
    )
    output: list[dict[str, Any]] = []
    for path_value in paths:
        before = entry(repo, base, path_value)
        after = entry(repo, result, path_value)
        if before is None and after is not None:
            change = "ADD"
        elif before is not None and after is None:
            change = "DELETE"
        elif before is not None and after is not None:
            change = "MODIFY"
        else:
            fail(f"invalid changed path {path_value}")
        output.append({"path": path_value, "change": change, "before": before, "after": after})
    return output


def pattern_matches(repo_name: str, path_value: str, qualified: str) -> bool:
    if ":" not in qualified:
        return False
    owner, pattern = qualified.split(":", 1)
    if owner != repo_name:
        return False
    if pattern.endswith("/**"):
        prefix = pattern[:-3].rstrip("/")
        return path_value == prefix or path_value.startswith(prefix + "/")
    return fnmatchcase(path_value, pattern)


def policy_check(
    repo_name: str,
    manifest: list[dict[str, Any]],
    allowed: list[str],
    protected: list[str],
    label: str,
) -> None:
    if not manifest:
        fail(f"{label}: empty implementation result")
    for item in manifest:
        path_value = item["path"]
        if any(pattern_matches(repo_name, path_value, value) for value in protected):
            fail(f"{label}: protected path changed {path_value}")
        if not any(pattern_matches(repo_name, path_value, value) for value in allowed):
            fail(f"{label}: path outside allowed set {path_value}")


def pin_equals(actual: dict[str, Any], expected: dict[str, Any], label: str) -> None:
    for key in ("path", "gitBlobSha1", "sha256", "bytes"):
        if actual.get(key) != expected.get(key):
            fail(f"{label}: {key} mismatch")


def verify_packet_test_commands(module: str, packet: dict[str, Any]) -> None:
    commands = packet.get("verificationBindings", {}).get("moduleCommands")
    if not isinstance(commands, list) or len(commands) != 2:
        fail(f"{module} packet command set mismatch")
    expected_ids = [f"{module}_BACKEND_TARGETED", f"{module}_FRONTEND_TARGETED"]
    # Length is checked above; avoid zip(strict=...) for the supported older
    # Python runtime while preserving the exact two-row pairing.
    for command_id, row in zip(expected_ids, commands):
        expected = EXPECTED_TESTS[command_id]
        if not isinstance(row, dict) or row.get("cwd") != expected["cwd"] or row.get("argv") != expected["argv"] or row.get("stage") != "TARGETED_MODULE":
            fail(f"{command_id}: validator constant differs from predecessor packet")


def recursive_tree_entries(repo: Path, revision: str) -> dict[str, tuple[str, str, str]]:
    raw = git(repo, "ls-tree", "-r", "--full-tree", "-z", revision)
    output: dict[str, tuple[str, str, str]] = {}
    for record in (item for item in raw.split(b"\0") if item):
        if b"\t" not in record:
            fail(f"malformed recursive tree entry at {revision}")
        metadata, raw_path = record.split(b"\t", 1)
        mode, kind, object_id = metadata.decode("ascii").split()
        output[raw_path.decode("utf-8", "surrogateescape")] = (
            mode,
            kind,
            object_id,
        )
    return output


def verify_tooling_carrier(frontend: Path, tooling_carrier: str) -> None:
    r2_commit = commit(frontend, R2_PROMOTION_CARRIER_COMMIT)
    if r2_commit != R2_PROMOTION_CARRIER_COMMIT:
        fail("R2 promotion carrier commit drifted")
    if tree(frontend, r2_commit) != R2_PROMOTION_CARRIER_TREE:
        fail("R2 promotion carrier tree drifted")
    pushed(frontend, r2_commit, CENTRAL["frontend"]["upstream"], "exact R2 promotion carrier")
    promotion_pin, _ = file_pin(frontend, r2_commit, R2_PROMOTION_REL.as_posix())
    if promotion_pin["sha256"] != R2_PROMOTION_RECEIPT_SHA256:
        fail("R2 promotion receipt blob drifted")
    tooling_commit = commit(frontend, tooling_carrier)
    pushed(frontend, tooling_commit, CENTRAL["frontend"]["upstream"], "R3 tooling carrier")
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
) -> tuple[dict[str, Any], dict[str, str]]:
    """Independently verify the exact Control-owned Playwright source carrier."""
    state = carrier_state(
        frontend,
        source_carrier,
        "frontend",
        "shared-test-source carrier",
        require_current,
    )
    ancestry = text(
        frontend, "rev-list", "--parents", "-n", "1", state["commit"]
    ).split()
    if len(ancestry) != 2 or ancestry[0] != state["commit"]:
        fail("shared-test-source carrier must have exactly one parent")
    tooling_carrier = ancestry[1]
    if commit_time(frontend, state["commit"]) < commit_time(frontend, tooling_carrier):
        fail("shared-test-source carrier timestamp precedes tooling carrier")
    raw_changes = git(
        frontend,
        "diff",
        "--name-status",
        "--no-renames",
        "-z",
        tooling_carrier,
        state["commit"],
    )
    parts = [
        item.decode("utf-8", "surrogateescape")
        for item in raw_changes.split(b"\0")
        if item
    ]
    if len(parts) % 2:
        fail("shared-test-source carrier malformed name-status output")
    actual_changes = sorted(
        (parts[index], parts[index + 1]) for index in range(0, len(parts), 2)
    )
    expected_changes = sorted(
        [("M", path_value) for path_value in CONTROL_PREREQUISITE_PATHS]
        + [("A", SHARED_TEST_SOURCE_PATH)]
    )
    if actual_changes != expected_changes:
        fail(
            "shared-test-source carrier exact change set mismatch; "
            f"expected {expected_changes}, got {actual_changes}"
        )
    verify_tooling_carrier(frontend, tooling_carrier)
    patch_pin, patch_raw = file_pin(
        frontend, tooling_carrier, CONTROL_PREREQUISITES_PATCH_PATH
    )
    carrier_patch = git(
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
    source_pin, raw = file_pin(frontend, state["commit"], SHARED_TEST_SOURCE_PATH)
    if raw != SHARED_TEST_SOURCE_BYTES:
        fail("shared-test-source carrier does not contain the deterministic template")
    return {
        **source_pin,
        "templateId": SHARED_TEST_SOURCE_TEMPLATE_ID,
        "carrierCommit": state["commit"],
        "carrierTree": state["tree"],
        "toolingCarrierCommit": tooling_carrier,
        "toolingCarrierTree": tree(frontend, tooling_carrier),
        "branch": CENTRAL["frontend"]["branch"],
        "upstream": CENTRAL["frontend"]["upstream"],
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
    for path_value in FRONTEND_CANONICAL_COMMAND_PATHS:
        _, raw = file_pin(frontend, frontend_revision, path_value)
        if path_value == SHARED_TEST_SOURCE_PATH and raw != SHARED_TEST_SOURCE_BYTES:
            fail("canonical Playwright source bytes changed")
    for path_value in BACKEND_CANONICAL_COMMAND_PATHS:
        file_pin(backend, backend_revision, path_value)
    _, package_raw = file_pin(frontend, frontend_revision, "package.json")
    package = json_object(package_raw, "canonical frontend package.json")
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


def read_r2(frontend: Path, embedded_pin: dict[str, Any]) -> dict[str, dict[str, Any]]:
    if embedded_pin.get("path") != R2_PROMOTION_REL.as_posix():
        fail("R2 promotion receipt path mismatch")
    carrier = commit(frontend, str(embedded_pin.get("carrierCommit", "")))
    if carrier != commit(frontend, R2_PROMOTION_CARRIER_COMMIT):
        fail("embedded R2 promotion carrier is not the exact frozen carrier")
    if tree(frontend, carrier) != R2_PROMOTION_CARRIER_TREE:
        fail("exact R2 promotion carrier tree mismatch")
    pushed(frontend, carrier, CENTRAL["frontend"]["upstream"], "R2 promotion")
    if embedded_pin.get("carrierTree") != tree(frontend, carrier):
        fail("R2 promotion carrier tree mismatch")
    actual_pin, raw = file_pin(frontend, carrier, R2_PROMOTION_REL.as_posix())
    pin_equals(actual_pin, embedded_pin, "R2 promotion")
    if actual_pin["sha256"] != R2_PROMOTION_RECEIPT_SHA256:
        fail("exact R2 promotion receipt SHA-256 mismatch")
    receipt = json_object(raw, "R2 promotion")
    check_seal(receipt, "R2 promotion")
    if receipt.get("schema") != "dwp.hris.g7-sys-hrm-promotion-receipt.v2" or receipt.get("status") != "PASS_SCOPED_DELEGATION":
        fail("R2 promotion identity/status mismatch")
    if receipt.get("activeTokenClosedSet") != [MODULES["SYS"]["tokenId"], MODULES["HRM"]["tokenId"]]:
        fail("R2 active token set mismatch")
    if receipt.get("authority", {}).get("integrationMergeAuthorized") is not False:
        fail("R2 unexpectedly authorizes integration")
    bundle = receipt.get("bundleCommit", {})
    bundle_commit = commit(frontend, str(bundle.get("commit", "")))
    if bundle.get("tree") != tree(frontend, bundle_commit):
        fail("R2 bundle tree mismatch")
    delegations = {
        item.get("module"): item
        for item in receipt.get("delegations", [])
        if isinstance(item, dict)
    }
    tokens: dict[str, dict[str, Any]] = {}
    for module, spec in MODULES.items():
        delegation = delegations.get(module)
        if not isinstance(delegation, dict) or delegation.get("tokenId") != spec["tokenId"]:
            fail(f"R2 {module} delegation mismatch")
        token_pin, token_raw = file_pin(frontend, bundle_commit, spec["tokenPath"].as_posix())
        if token_pin["sha256"] != delegation.get("tokenSha256"):
            fail(f"R2 {module} token digest mismatch")
        token = json_object(token_raw, f"R2 {module} token")
        check_seal(token, f"R2 {module} token")
        if token.get("tokenId") != spec["tokenId"]:
            fail(f"R2 {module} token id mismatch")
        if token.get("authority", {}).get("integrationMergeAuthorized") is not False:
            fail(f"R2 {module} token unexpectedly authorizes integration")
        packet_path = safe_path(str(token.get("packetPath", "")), f"{module} packet")
        packet_pin, packet_raw = file_pin(frontend, bundle_commit, packet_path)
        if packet_pin["sha256"] != token.get("packetFileSha256"):
            fail(f"R2 {module} predecessor packet digest mismatch")
        packet = json_object(packet_raw, f"R2 {module} predecessor packet")
        check_seal(packet, f"R2 {module} predecessor packet")
        if packet.get("packetId") != token.get("packetId"):
            fail(f"R2 {module} predecessor packet identity mismatch")
        verify_packet_test_commands(module, packet)
        tokens[module] = token
    return tokens


def worktree_binding(token: dict[str, Any], repo_name: str) -> dict[str, Any]:
    rows = [
        item for item in token.get("worktreeBindings", [])
        if isinstance(item, dict) and item.get("repo") == repo_name
    ]
    if len(rows) != 1:
        fail(f"token {repo_name} binding missing")
    return rows[0]


def verify_module_result(
    module_result: dict[str, Any],
    tokens: dict[str, dict[str, Any]],
) -> tuple[dict[tuple[str, str], dict[str, Any]], list[datetime]]:
    module = module_result.get("module")
    expect_keys(
        module_result,
        {"module", "sliceId", "tokenId", "tokenExpiresAt", "pathPolicySha256", "worktrees", "migration"},
        "module result",
    )
    if module not in MODULES:
        fail("unknown module result")
    spec = MODULES[module]
    if module_result.get("sliceId") != spec["sliceId"] or module_result.get("tokenId") != spec["tokenId"]:
        fail(f"{module}: result identity mismatch")
    token = tokens[module]
    if module_result.get("tokenExpiresAt") != token.get("expiresAt"):
        fail(f"{module}: token expiry pin mismatch")
    if module_result.get("pathPolicySha256") != token.get("pathPolicySha256"):
        fail(f"{module}: path policy digest mismatch")
    allowed = token.get("effectiveAllowedPaths")
    protected = token.get("protectedPaths")
    if not isinstance(allowed, list) or not isinstance(protected, list):
        fail(f"{module}: invalid token path policy")
    outputs: dict[tuple[str, str], dict[str, Any]] = {}
    times: list[datetime] = []
    worktrees = module_result.get("worktrees")
    if not isinstance(worktrees, list) or [row.get("repo") for row in worktrees if isinstance(row, dict)] != ["frontend", "backend"]:
        fail(f"{module}: worktree result order/set mismatch")
    for row in worktrees:
        expect_keys(
            row,
            {"repo", "absolutePath", "branch", "upstream", "basePin", "resultPin", "clean", "upstreamMatched", "changedFiles", "changedFilesSha256"},
            f"{module} worktree result",
        )
        repo_name = row["repo"]
        binding = worktree_binding(token, repo_name)
        repo = ensure_repo(Path(str(row.get("absolutePath", ""))), f"{module} {repo_name}")
        if repo != Path(str(binding.get("absolute_path"))).resolve():
            fail(f"{module} {repo_name}: not exact token worktree")
        if row.get("absolutePath") != str(repo) or row.get("branch") != binding.get("branch") or row.get("upstream") != binding.get("upstream"):
            fail(f"{module} {repo_name}: receipt worktree binding mismatch")
        if branch(repo) != binding.get("branch") or upstream(repo) != binding.get("upstream"):
            fail(f"{module} {repo_name}: branch/upstream mismatch")
        if git(repo, "status", "--porcelain=v1", "-z"):
            fail(f"{module} {repo_name}: worktree dirty")
        result_commit = commit(repo, str(row.get("resultPin", {}).get("commit", "")))
        if commit(repo, "HEAD") != result_commit or commit(repo, binding["upstream"]) != result_commit:
            fail(f"{module} {repo_name}: result is not exact clean/pushed HEAD")
        if row["resultPin"].get("tree") != tree(repo, result_commit):
            fail(f"{module} {repo_name}: result tree mismatch")
        base = token.get("executionBasePins", {}).get(repo_name, {})
        base_commit = commit(repo, str(base.get("commit", "")))
        if base.get("tree") != tree(repo, base_commit) or row.get("basePin") != {"commit": base_commit, "tree": base["tree"]}:
            fail(f"{module} {repo_name}: base pin mismatch")
        if commit_time(repo, result_commit) < commit_time(repo, base_commit):
            fail(f"{module} {repo_name}: result timestamp precedes base")
        manifest = changed_manifest(repo, base_commit, result_commit)
        policy_check(repo_name, manifest, allowed, protected, f"{module} {repo_name}")
        if row.get("changedFiles") != manifest or row.get("changedFilesSha256") != sha256(canonical_bytes(manifest)):
            fail(f"{module} {repo_name}: changed-file manifest mismatch")
        if row.get("clean") is not True or row.get("upstreamMatched") is not True:
            fail(f"{module} {repo_name}: clean/pushed assertion missing")
        if commit_time(repo, result_commit) > parse_time(token["expiresAt"], f"{module} expiry"):
            fail(f"{module} {repo_name}: commit after token expiry")
        outputs[(module, repo_name)] = {"row": row, "repo": repo}
        times.append(commit_time(repo, result_commit))
    backend_info = outputs[(module, "backend")]
    migration = module_result.get("migration")
    path_value = spec["migrationPath"]
    changed = {item["path"]: item for item in backend_info["row"]["changedFiles"]}
    token_authority = token.get("authority")
    if not isinstance(token_authority, dict):
        fail(f"{module}: migration authority missing")
    if module == "SYS":
        if token.get("migrationLeaseId") != "G7-LEASE-SYS-PLATFORM-V325-R2":
            fail("SYS exact V325 lease id mismatch")
        if (
            token_authority.get("migrationAuthorityMode") != "ADMITTED_EXACT_LEASE"
            or token_authority.get("migrationEditAuthorized") is not True
        ):
            fail("SYS V325 token migration authority mismatch")
        item = changed.get(path_value)
        if item is None:
            expected_migration = {
                "mode": "ADMITTED_EXACT_LEASE", "leaseId": "G7-LEASE-SYS-PLATFORM-V325-R2",
                "exactRelativePath": path_value, "used": False, "status": "UNUSED", "artifact": None,
            }
        else:
            if item["change"] != "ADD" or item["before"] is not None or item["after"] is None:
                fail("SYS V325 is not an exact added lease file")
            expected_migration = {
                "mode": "ADMITTED_EXACT_LEASE", "leaseId": "G7-LEASE-SYS-PLATFORM-V325-R2",
                "exactRelativePath": path_value, "used": True, "status": "USED_EXACT_V325", "artifact": item["after"],
            }
    else:
        prerequisite = token.get("controlOwnedMigrationPrerequisite", {})
        if not isinstance(prerequisite, dict):
            fail("HRM V54 prerequisite missing")
        if (
            prerequisite.get("mode") != "CONTROL_BOOTSTRAP_READ_ONLY_PIN"
            or prerequisite.get("exactRelativePath") != path_value
            or prerequisite.get("migrationEditAuthorized") is not False
        ):
            fail("HRM V54 prerequisite mode/path/edit authority mismatch")
        if (
            token_authority.get("migrationAuthorityMode")
            != "CONTROL_BOOTSTRAP_READ_ONLY_PIN"
            or token_authority.get("migrationEditAuthorized") is not False
        ):
            fail("HRM V54 token migration authority mismatch")
        if prerequisite.get("frozenBackendCommit") != backend_info["row"]["basePin"]["commit"]:
            fail("HRM V54 prerequisite frozen backend commit mismatch")
        if path_value in changed:
            fail("HRM protected V54 was changed")
        artifact = entry(backend_info["repo"], backend_info["row"]["resultPin"]["commit"], path_value)
        if artifact is None or artifact["sha256"] != prerequisite.get("sha256"):
            fail("HRM V54 read-only pin mismatch")
        expected_migration = {
            "mode": "CONTROL_BOOTSTRAP_READ_ONLY_PIN", "exactRelativePath": path_value,
            "used": False, "status": "UNCHANGED_READ_ONLY_V54", "artifact": artifact,
            "migrationEditAuthorized": False,
        }
    if migration != expected_migration:
        fail(f"{module}: migration used/unused evidence mismatch")
    return outputs, times


def verify_output(
    frontend: Path,
    carrier: str,
    run_id: str,
    output: Any,
    label: str,
    *,
    allow_empty: bool = False,
) -> bytes:
    if not isinstance(output, dict):
        fail(f"{label}: output pin missing")
    expect_keys(output, {"path", "gitBlobSha1", "sha256", "bytes", "redactionStatus"}, f"{label} output")
    output_path = require_run_path(run_id, str(output.get("path", "")), label)
    actual, raw = file_pin(frontend, carrier, output_path)
    if actual["bytes"] < 1 and not allow_empty:
        fail(f"{label}: output evidence is empty")
    pin_equals(actual, output, label)
    if output.get("redactionStatus") != "SANITIZED_NO_SECRET_OR_CUSTOMER_DATA":
        fail(f"{label}: output is not sanitized")
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
    rows: dict[str, str] = {}
    for annotation in value:
        if not isinstance(annotation, dict) or set(annotation) != {"type", "description"}:
            fail("Playwright JSON reporter source-pin annotation shape mismatch")
        annotation_type = annotation.get("type")
        description = annotation.get("description")
        if annotation_type in rows or annotation_type not in SOURCE_PIN_ANNOTATIONS:
            fail("Playwright JSON reporter source-pin annotation set mismatch")
        if not isinstance(description, str) or not SHA1_RE.fullmatch(description):
            fail("Playwright JSON reporter source-pin annotation is not an object id")
        rows[annotation_type] = description
    if list(rows) != list(SOURCE_PIN_ANNOTATIONS):
        fail("Playwright JSON reporter source-pin annotation order mismatch")
    pins = {"frontend": {}, "backend": {}}
    for annotation_type, description in rows.items():
        repo_name, pin_name = SOURCE_PIN_ANNOTATIONS[annotation_type]
        pins[repo_name][pin_name] = description
    return pins


def semantic_lines(raw: bytes, label: str) -> list[str]:
    try:
        decoded = raw.decode("utf-8", "strict")
    except UnicodeDecodeError as exc:
        raise ValidationError(f"{label}: output is not UTF-8") from exc
    return [line.strip() for line in decoded.splitlines() if line.strip()]


def assert_silent_stderr(raw: bytes, label: str) -> None:
    if raw.strip():
        fail(f"{label}: successful command emitted stderr")


def verify_vitest_report(
    raw: bytes,
    stderr_raw: bytes,
    frontend: Path,
) -> dict[str, Any]:
    assert_silent_stderr(stderr_raw, "route/access Vitest")
    report = json_object(raw, "route/access Vitest JSON output")
    count_names = (
        "numTotalTestSuites",
        "numPassedTestSuites",
        "numFailedTestSuites",
        "numPendingTestSuites",
        "numTotalTests",
        "numPassedTests",
        "numFailedTests",
        "numPendingTests",
        "numTodoTests",
    )
    counts: dict[str, int] = {}
    for name in count_names:
        candidate = report.get(name)
        if not isinstance(candidate, int) or isinstance(candidate, bool) or candidate < 0:
            fail(f"route/access Vitest JSON has invalid {name}")
        counts[name] = candidate
    if report.get("success") is not True:
        fail("route/access Vitest JSON does not declare success")
    if counts["numTotalTestSuites"] < 1 or counts["numTotalTests"] < 1:
        fail("route/access Vitest JSON has no executed tests")
    if (
        counts["numPassedTestSuites"] != counts["numTotalTestSuites"]
        or counts["numFailedTestSuites"]
        or counts["numPendingTestSuites"]
    ):
        fail("route/access Vitest suite counts are not all passing")
    if (
        counts["numPassedTests"] != counts["numTotalTests"]
        or counts["numFailedTests"]
        or counts["numPendingTests"]
        or counts["numTodoTests"]
    ):
        fail("route/access Vitest test counts are not all passing")
    file_results = report.get("testResults")
    if not isinstance(file_results, list) or len(file_results) != 4:
        fail("route/access Vitest file-result count is not four")
    allowed = set(VITEST_TARGETS)
    seen: set[str] = set()
    absolute_prefix = frontend.resolve().as_posix().rstrip("/") + "/"
    for file_result in file_results:
        if not isinstance(file_result, dict):
            fail("route/access Vitest file result is not an object")
        raw_name = str(file_result.get("name", "")).replace("\\", "/")
        if raw_name.startswith(absolute_prefix):
            relative_name = raw_name[len(absolute_prefix):]
        elif raw_name.startswith("/"):
            fail("route/access Vitest file is outside the pinned frontend checkout")
        else:
            relative_name = PurePosixPath(raw_name).as_posix()
        if relative_name not in allowed or relative_name in seen:
            fail("route/access Vitest contains an unknown or duplicate file")
        seen.add(relative_name)
        if file_result.get("status") != "passed":
            fail(f"route/access Vitest file failed: {relative_name}")
        assertions = file_result.get("assertionResults")
        if not isinstance(assertions, list) or len(assertions) == 0:
            fail(f"route/access Vitest file has no assertion evidence: {relative_name}")
        for assertion in assertions:
            if not isinstance(assertion, dict) or assertion.get("status") != "passed":
                fail(f"route/access Vitest has a non-passing assertion: {relative_name}")
            if assertion.get("failureMessages", []) != []:
                fail(f"route/access Vitest assertion contains failures: {relative_name}")
    if seen != allowed:
        fail("route/access Vitest requested-file closed set is incomplete")
    return {
        "format": "VITEST_JSON_REPORT_V1",
        "requestedFiles": VITEST_TARGETS,
        "fileCount": 4,
        "totalTests": counts["numTotalTests"],
        "passedTests": counts["numPassedTests"],
        "failedTests": counts["numFailedTests"],
        "pendingTests": counts["numPendingTests"],
        "todoTests": counts["numTodoTests"],
        "stderrEmpty": True,
    }


def verify_non_playwright_semantics(
    command_id: str,
    stdout_raw: bytes,
    stderr_raw: bytes,
    frontend: Path,
) -> dict[str, Any]:
    if command_id == "CONTROL_AUTHORIZATION_CHECK":
        assert_silent_stderr(stderr_raw, command_id)
        lines = semantic_lines(stdout_raw, command_id)
        if len(lines) != 1 or re.fullmatch(AUTHORIZATION_SUCCESS_PATTERN, lines[0]) is None:
            fail(f"{command_id}: authorization marker mismatch")
        return {
            "format": "AUTHORIZATION_CHECK_STDOUT_V1",
            "markers": ["PRODUCT_SURFACE_AUTHORIZATION"],
            "stderrEmpty": True,
        }
    if command_id == "CONTROL_BACKEND_OPENAPI_CHECK":
        assert_silent_stderr(stderr_raw, command_id)
        lines = semantic_lines(stdout_raw, command_id)
        if len(lines) != 1 or re.fullmatch(BACKEND_OPENAPI_SUCCESS_PATTERN, lines[0]) is None:
            fail(f"{command_id}: approved-snapshot marker mismatch")
        return {
            "format": "BACKEND_OPENAPI_CHECK_STDOUT_V1",
            "markers": ["BACKEND_APPROVED_SNAPSHOTS"],
            "stderrEmpty": True,
        }
    if command_id == "CONTROL_FRONTEND_OPENAPI_CHECK":
        assert_silent_stderr(stderr_raw, command_id)
        if semantic_lines(stdout_raw, command_id) != FRONTEND_OPENAPI_SUCCESS_LINES:
            fail(f"{command_id}: Gateway/Agent marker set mismatch")
        return {
            "format": "FRONTEND_OPENAPI_CHECK_STDOUT_V1",
            "markers": ["GATEWAY_TYPES", "AGENT_TYPES"],
            "stderrEmpty": True,
        }
    if command_id == VITEST_COMMAND_ID:
        return verify_vitest_report(stdout_raw, stderr_raw, frontend)
    if command_id == "CONTROL_FRONTEND_TYPECHECK":
        if stdout_raw.strip() or stderr_raw.strip():
            fail("CONTROL_FRONTEND_TYPECHECK: successful tsc --noEmit must be silent")
        return {
            "format": "TSC_NO_EMIT_SILENT_V1",
            "canonicalScript": CANONICAL_PACKAGE_SCRIPTS["typecheck"],
            "stdoutEmpty": True,
            "stderrEmpty": True,
        }
    if command_id == "CONTROL_FRONTEND_ARCHITECTURE":
        assert_silent_stderr(stderr_raw, command_id)
        lines = semantic_lines(stdout_raw, command_id)
        if len(lines) != len(ARCHITECTURE_SUCCESS_MARKERS):
            fail("CONTROL_FRONTEND_ARCHITECTURE: marker count mismatch")
        for index, (marker_id, pattern) in enumerate(ARCHITECTURE_SUCCESS_MARKERS):
            if re.fullmatch(pattern, lines[index]) is None:
                fail(
                    "CONTROL_FRONTEND_ARCHITECTURE: marker sequence mismatch at "
                    f"{marker_id}"
                )
        return {
            "format": "ARCHITECTURE_CLOSED_MARKERS_V1",
            "markers": [marker_id for marker_id, _ in ARCHITECTURE_SUCCESS_MARKERS],
            "markerCount": len(ARCHITECTURE_SUCCESS_MARKERS),
            "stderrEmpty": True,
        }
    fail(f"{command_id}: missing independent semantic parser")


def verify_playwright_report(
    raw: bytes,
    source_pins: dict[str, dict[str, str]],
) -> dict[str, Any]:
    report = json_object(raw, "Playwright JSON reporter output")
    if not {"config", "errors", "stats", "suites"}.issubset(report):
        fail("Playwright JSON reporter output is missing required sections")
    if report.get("errors") != []:
        fail("Playwright JSON reporter output contains top-level errors")
    config = report.get("config")
    if not isinstance(config, dict) or config.get("workers") != 1:
        fail("Playwright JSON reporter output does not prove workers=1")
    root_dir = str(config.get("rootDir", "")).replace("\\", "/").rstrip("/")
    if not root_dir or PurePosixPath(root_dir).name != "e2e":
        fail("Playwright JSON reporter config.rootDir is not the e2e directory")
    projects = config.get("projects")
    if not isinstance(projects, list) or len(projects) != 2:
        fail("Playwright JSON reporter project count mismatch")
    names = []
    for project in projects:
        if not isinstance(project, dict):
            fail("Playwright JSON reporter project is not an object")
        names.append(project.get("name"))
    if names != ["chromium", "mobile"]:
        fail("Playwright JSON reporter projects are not chromium+mobile")
    stats = report.get("stats")
    if not isinstance(stats, dict) or {
        key: stats.get(key)
        for key in ("expected", "skipped", "unexpected", "flaky")
    } != {"expected": 4, "skipped": 0, "unexpected": 0, "flaky": 0}:
        fail("Playwright JSON reporter stats do not prove four clean passes")

    specs: list[dict[str, Any]] = []

    def walk(value: Any) -> None:
        if not isinstance(value, list):
            fail("Playwright JSON reporter suites are not an array")
        for suite in value:
            if not isinstance(suite, dict):
                fail("Playwright JSON reporter suite is not an object")
            suite_specs = suite.get("specs", [])
            children = suite.get("suites", [])
            if not isinstance(suite_specs, list):
                fail("Playwright JSON reporter specs are not an array")
            for spec in suite_specs:
                if not isinstance(spec, dict):
                    fail("Playwright JSON reporter spec is not an object")
                specs.append(spec)
            walk(children)

    walk(report.get("suites"))
    if len(specs) != 2:
        fail("Playwright JSON reporter does not contain exactly two journeys")
    titles: list[str] = []
    counts = {"chromium": 0, "mobile": 0}
    report_source_pins: dict[str, dict[str, str]] | None = None
    for spec in specs:
        file_value = str(spec.get("file", "")).replace("\\", "/")
        if file_value not in {
            PurePosixPath(SHARED_TEST_SOURCE_PATH).name,
            SHARED_TEST_SOURCE_PATH,
        }:
            fail("Playwright JSON reporter contains an unpinned spec")
        title = spec.get("title")
        if title not in PLAYWRIGHT_SPEC_TITLES or title in titles:
            fail("Playwright JSON reporter journey title mismatch")
        titles.append(title)
        if spec.get("ok") is not True:
            fail(f"Playwright JSON reporter journey did not pass: {title}")
        tests = spec.get("tests")
        if not isinstance(tests, list) or len(tests) != 2:
            fail(f"Playwright JSON reporter project coverage mismatch: {title}")
        per_spec: list[str] = []
        for test in tests:
            if not isinstance(test, dict):
                fail("Playwright JSON reporter test is not an object")
            project_name = test.get("projectName")
            if project_name not in counts or project_name in per_spec:
                fail(f"Playwright JSON reporter duplicate/unknown project: {title}")
            per_spec.append(project_name)
            if test.get("status") != "expected":
                fail(f"Playwright JSON reporter test status is not expected: {title}")
            execution_source_pins = source_pins_from_annotations(test.get("annotations"))
            if report_source_pins is None:
                report_source_pins = execution_source_pins
            elif execution_source_pins != report_source_pins:
                fail("Playwright JSON reporter source pins differ across executions")
            executions = test.get("results")
            if not isinstance(executions, list) or not executions:
                fail(f"Playwright JSON reporter test has no execution: {title}")
            for execution in executions:
                if not isinstance(execution, dict):
                    fail("Playwright JSON reporter execution is not an object")
                if execution.get("status") != "passed" or execution.get("errors", []) != []:
                    fail(f"Playwright JSON reporter execution did not pass cleanly: {title}")
            counts[project_name] += 1
        if per_spec != ["chromium", "mobile"]:
            fail(f"Playwright JSON reporter project order mismatch: {title}")
    if titles != PLAYWRIGHT_SPEC_TITLES or counts != {"chromium": 2, "mobile": 2}:
        fail("Playwright JSON reporter closed set mismatch")
    if report_source_pins != source_pins:
        fail("Playwright JSON reporter source pins differ from runner source heads")
    return expected_playwright_summary(report_source_pins)


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
    return {
        "proofKind": SHARED_PROOF_KINDS[command_id],
        "sourcePins": source_pins,
        "exitCode": exit_code,
        "stdoutSha256": sha256(stdout_raw),
        "stderrSha256": sha256(stderr_raw),
        "report": (
            verify_playwright_report(stdout_raw, source_pins)
            if command_id == PLAYWRIGHT_COMMAND_ID
            else verify_non_playwright_semantics(
                command_id, stdout_raw, stderr_raw, frontend
            )
        ),
    }


def runner_record_digest(row: dict[str, Any]) -> str:
    material = copy.deepcopy(row)
    material.pop("recordSha256", None)
    return sha256(canonical_bytes(material))


def verify_plan(value: dict[str, Any]) -> None:
    check_seal(value, "shared plan")
    expect_keys(
        value,
        {"schema", "planId", "issuedBy", "authorityStatus", "basis", "requiredCategories", "closedSet", "commands", "rerunPolicy", "sealedPayloadSha256"},
        "shared plan",
    )
    if value.get("schema") != "dwp.hris.g7-sys-hrm-shared-verification-plan.v3":
        fail("shared plan schema mismatch")
    if value.get("issuedBy") != "SYS_COMMON_INTEGRATION_CONTROL" or value.get("authorityStatus") != "CONTROL_PROPOSAL_NOT_PREDECESSOR_AUTHORITY":
        fail("shared plan authority labeling mismatch")
    if value.get("requiredCategories") != SHARED_CATEGORIES:
        fail("shared plan category closed set mismatch")
    if value.get("rerunPolicy") != "ONE_SHARED_BATCH_NO_PER_FIX_FULL_RERUN":
        fail("shared plan rerun policy mismatch")
    if value.get("basis") != EXPECTED_SHARED_BASIS:
        fail("shared plan predecessor basis mismatch")
    if value.get("closedSet") != EXPECTED_SHARED_CLOSED_SET:
        fail("shared plan command closed set is not canonical")
    if value.get("commands") != EXPECTED_SHARED_COMMANDS:
        fail("shared plan commands/order/argv are not canonical")


def verify_module_evidence(
    value: dict[str, Any],
    frontend: Path,
    carrier: str,
    run_id: str,
    result_info: dict[tuple[str, str], dict[str, Any]],
    tokens: dict[str, dict[str, Any]],
) -> None:
    check_seal(value, "module test evidence")
    expect_keys(
        value,
        {"schema", "evidenceId", "issuedBy", "authorityStatus", "closedSet", "results", "sealedPayloadSha256"},
        "module test evidence",
    )
    if value.get("schema") != "dwp.hris.g7-sys-hrm-module-test-evidence-input.v3":
        fail("module evidence schema mismatch")
    if value.get("issuedBy") != "SYS_COMMON_INTEGRATION_CONTROL" or value.get("authorityStatus") != "CONTROL_AUTHORED_RESULT_EVIDENCE":
        fail("module evidence authority mismatch")
    if value.get("closedSet") != TEST_CLOSED_SET:
        fail("module evidence command closed set mismatch")
    rows = value.get("results")
    if not isinstance(rows, list) or len(rows) != 4:
        fail("module evidence result count mismatch")
    by_id = {row.get("commandId"): row for row in rows if isinstance(row, dict)}
    if list(by_id) != TEST_CLOSED_SET or len(by_id) != 4:
        fail("module evidence result order/identity mismatch")
    for command_id, expected in EXPECTED_TESTS.items():
        row = by_id[command_id]
        expect_keys(
            row,
            {"commandId", "module", "repo", "cwd", "argv", "status", "exitCode", "resultCommit", "resultTree", "executedAt", "executionBinding", "output"},
            command_id,
        )
        for key in ("module", "repo", "cwd", "argv"):
            if row.get(key) != expected[key]:
                fail(f"{command_id}: {key} mismatch")
        if (
            row.get("status") != "PASS"
            or type(row.get("exitCode")) is not int
            or row.get("exitCode") != 0
        ):
            fail(f"{command_id}: not PASS/0")
        result_row = result_info[(expected["module"], expected["repo"])]["row"]
        if row.get("resultCommit") != result_row["resultPin"]["commit"] or row.get("resultTree") != result_row["resultPin"]["tree"]:
            fail(f"{command_id}: result pin mismatch")
        executed_at = parse_time(str(row.get("executedAt", "")), command_id)
        result_repo = result_info[(expected["module"], expected["repo"])]["repo"]
        binding = row.get("executionBinding")
        expect_keys(
            binding if isinstance(binding, dict) else {},
            {"mode", "testedTree", "authorityStatus"},
            f"{command_id} execution binding",
        )
        if binding.get("testedTree") != result_row["resultPin"]["tree"]:
            fail(f"{command_id}: tested tree is not the exact result tree")
        result_commit_time = commit_time(result_repo, result_row["resultPin"]["commit"])
        source_ready_at = max(
            commit_time(result_repo, result_row["basePin"]["commit"]),
            parse_time(str(tokens[expected["module"]].get("issuedAt", "")), "token issuance"),
        )
        if executed_at < source_ready_at:
            fail(f"{command_id}: evidence predates source preparation authority")
        if binding.get("mode") == "PRE_COMMIT_FINAL_TREE":
            if binding.get("authorityStatus") != "CONTROL_ASSERTED_WORKTREE_TREE_EQUALS_RESULT_TREE":
                fail(f"{command_id}: pre-commit assertion authority mismatch")
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
            fail(f"{command_id}: evidence timestamp is after carrier commit")
        if executed_at > parse_time(tokens[expected["module"]]["expiresAt"], "token expiry"):
            fail(f"{command_id}: executed after token expiry")
        verify_output(frontend, carrier, run_id, row.get("output"), command_id)


def union_from_admission(admission: dict[str, Any]) -> dict[str, list[dict[str, Any]]]:
    result: dict[str, list[dict[str, Any]]] = {"frontend": [], "backend": []}
    seen: set[tuple[str, str]] = set()
    for module_result in admission["moduleResults"]:
        for worktree in module_result["worktrees"]:
            repo_name = worktree["repo"]
            for item in worktree["changedFiles"]:
                key = (repo_name, item["path"])
                if key in seen:
                    fail(f"overlapping admitted result path {repo_name}:{item['path']}")
                seen.add(key)
                result[repo_name].append({"module": module_result["module"], **item})
    for rows in result.values():
        rows.sort(key=lambda row: (row["path"], row["module"]))
    return result


def verify_admission(
    frontend: Path,
    backend: Path,
    run_id: str,
    carrier_revision: str,
    *,
    require_current: bool,
) -> tuple[dict[str, Any], dict[str, Any], dict[str, str]]:
    state = carrier_state(frontend, carrier_revision, "frontend", "admission carrier", require_current)
    artifact = (run_root(run_id) / "result-admission.v3.json").as_posix()
    pin, raw = file_pin(frontend, state["commit"], artifact)
    receipt = json_object(raw, "admission receipt")
    check_seal(receipt, "admission receipt")
    expect_keys(
        receipt,
        {"schema", "receiptId", "runId", "status", "issuedAt", "issuedBy", "predecessor", "testEvidence", "sharedVerificationPlan", "sharedTestSource", "toolchain", "moduleResults", "expectedUnionSha256", "authority", "sealedPayloadSha256"},
        "admission receipt",
    )
    if receipt.get("schema") != "dwp.hris.g7-sys-hrm-result-admission-receipt.v3" or receipt.get("receiptId") != f"HRIS-G7-SYS-HRM-RESULT-ADMISSION-{run_id.upper()}" or receipt.get("runId") != run_id or receipt.get("status") != "PASS_RESULTS_ADMITTED_PENDING_CARRIER":
        fail("admission identity/status mismatch")
    if receipt.get("issuedBy") != "SYS_COMMON_INTEGRATION_CONTROL" or receipt.get("authority", {}).get("integrationMergeAuthorized") is not False:
        fail("admission authority mismatch")
    expect_keys(receipt.get("predecessor", {}), {"r2PromotionReceipt", "activeTokenClosedSet", "integrationMergeAuthorized"}, "admission predecessor")
    expected_admission_authority = {
        "resultsAdmittedAfterCarrier": True,
        "integrationMergeAuthorized": False,
        "sharedControlPathChangeAuthorizedForModules": False,
        "customerDataAuthorized": False,
        "customerActivationAuthorized": False,
        "productionReleaseAuthorized": False,
    }
    if receipt.get("authority") != expected_admission_authority:
        fail("admission authority field set/value mismatch")
    evidence_ref = receipt.get("testEvidence", {})
    plan_ref = receipt.get("sharedVerificationPlan", {})
    expect_keys(evidence_ref, {"path", "gitBlobSha1", "sha256", "bytes", "carrierCommit", "carrierTree", "evidenceId", "closedSet"}, "admission test evidence ref")
    expect_keys(plan_ref, {"path", "gitBlobSha1", "sha256", "bytes", "carrierCommit", "carrierTree", "planId", "authorityStatus"}, "admission shared plan ref")
    evidence_path = require_run_path(run_id, str(evidence_ref.get("path", "")), "module evidence")
    plan_path = require_run_path(run_id, str(plan_ref.get("path", "")), "shared plan")
    assert_distinct_non_reserved_run_inputs(
        run_id,
        [evidence_path, plan_path],
        "Control input evidence carrier",
    )
    input_carrier = commit(frontend, str(evidence_ref.get("carrierCommit", "")))
    if plan_ref.get("carrierCommit") != input_carrier or evidence_ref.get("carrierTree") != tree(frontend, input_carrier) or plan_ref.get("carrierTree") != tree(frontend, input_carrier):
        fail("admission input carrier pins mismatch")
    assert_carrier_shape(frontend, state["commit"], input_carrier, artifact, "admission carrier")
    tokens = read_r2(frontend, receipt.get("predecessor", {}).get("r2PromotionReceipt", {}))
    if receipt.get("predecessor", {}).get("activeTokenClosedSet") != [MODULES["SYS"]["tokenId"], MODULES["HRM"]["tokenId"]] or receipt.get("predecessor", {}).get("integrationMergeAuthorized") is not False:
        fail("admission predecessor state mismatch")
    module_results = receipt.get("moduleResults")
    if not isinstance(module_results, list) or [row.get("module") for row in module_results if isinstance(row, dict)] != ["SYS", "HRM"]:
        fail("admission module result closed set mismatch")
    result_info: dict[tuple[str, str], dict[str, Any]] = {}
    times = [commit_time(frontend, input_carrier)]
    for module_result in module_results:
        info, module_times = verify_module_result(module_result, tokens)
        result_info.update(info)
        times.extend(module_times)
    backend_bases = {
        info["row"]["basePin"]["commit"]
        for (module, repo_name), info in result_info.items()
        if repo_name == "backend"
    }
    if len(backend_bases) != 1:
        fail("module results do not share one canonical backend execution base")
    actual_evidence_pin, evidence_raw = file_pin(frontend, input_carrier, evidence_path)
    pin_equals(actual_evidence_pin, evidence_ref, "module evidence")
    evidence = json_object(evidence_raw, "module evidence")
    verify_module_evidence(evidence, frontend, input_carrier, run_id, result_info, tokens)
    if evidence_ref.get("evidenceId") != evidence.get("evidenceId") or evidence_ref.get("closedSet") != TEST_CLOSED_SET:
        fail("admission module evidence metadata mismatch")
    actual_plan_pin, plan_raw = file_pin(frontend, input_carrier, plan_path)
    pin_equals(actual_plan_pin, plan_ref, "shared plan")
    plan = json_object(plan_raw, "shared plan")
    verify_plan(plan)
    evidence_output_paths = [str(row["output"]["path"]) for row in evidence["results"]]
    assert_distinct_non_reserved_run_inputs(
        run_id,
        [evidence_path, plan_path, *evidence_output_paths],
        "Control input evidence carrier",
    )
    input_parent = assert_exact_added_carrier(
        frontend,
        input_carrier,
        [evidence_path, plan_path, *evidence_output_paths],
        "Control input evidence carrier",
    )
    expected_source, _ = verify_shared_test_source_carrier(
        frontend, input_parent, require_current=False
    )
    expected_source["inputCarrierDirectChild"] = True
    source_ref = receipt.get("sharedTestSource")
    if source_ref != expected_source:
        fail("admission shared-test-source pin/gate metadata mismatch")
    verify_canonical_command_sources(
        frontend,
        input_carrier,
        backend,
        next(iter(backend_bases)),
    )
    assert_run_never_preexisted(frontend, run_id, input_carrier)
    if require_current:
        assert_exact_run_history(frontend, run_id, [input_carrier, state["commit"]])
        for future_name in (
            "integration-authorization.v3.json",
            "integrated-closure.v3.json",
        ):
            future_path = (run_root(run_id) / future_name).as_posix()
            if entry(frontend, state["commit"], future_path) is not None:
                fail(f"future reserved receipt path already exists: {future_path}")
    expected_toolchain = []
    for relative in TOOL_RELATIVE_PATHS:
        tool_pin, _ = file_pin(
            frontend,
            input_carrier,
            (R3_ROOT_REL / relative).as_posix(),
        )
        expected_toolchain.append(tool_pin)
    if receipt.get("toolchain") != expected_toolchain:
        fail("admission tool/schema pin set mismatch")
    if plan_ref.get("planId") != plan.get("planId") or plan_ref.get("authorityStatus") != "CONTROL_PROPOSAL_NOT_PREDECESSOR_AUTHORITY":
        fail("admission shared plan metadata mismatch")
    union = union_from_admission(receipt)
    if receipt.get("expectedUnionSha256") != sha256(canonical_bytes(union)):
        fail("admission expected union digest mismatch")
    if receipt.get("issuedAt") != iso(max(times)):
        fail("admission issuedAt is not deterministic")
    earliest_expiry = min(parse_time(tokens[module]["expiresAt"], f"{module} expiry") for module in ("SYS", "HRM"))
    if commit_time(frontend, state["commit"]) > earliest_expiry:
        fail("admission carrier was committed after token expiry")
    return receipt, pin, state


def authorized_results(admission: dict[str, Any]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for module_result in admission["moduleResults"]:
        for worktree in module_result["worktrees"]:
            rows.append({
                "module": module_result["module"], "sliceId": module_result["sliceId"],
                "tokenId": module_result["tokenId"], "repo": worktree["repo"],
                "commit": worktree["resultPin"]["commit"], "tree": worktree["resultPin"]["tree"],
                "changedFilesSha256": worktree["changedFilesSha256"],
            })
    return rows


def verify_authorization(
    frontend: Path,
    backend: Path,
    run_id: str,
    carrier_revision: str,
    *,
    require_current: bool,
) -> tuple[dict[str, Any], dict[str, Any], dict[str, str], dict[str, Any]]:
    state = carrier_state(frontend, carrier_revision, "frontend", "authorization carrier", require_current)
    artifact = (run_root(run_id) / "integration-authorization.v3.json").as_posix()
    pin, raw = file_pin(frontend, state["commit"], artifact)
    receipt = json_object(raw, "authorization receipt")
    check_seal(receipt, "authorization receipt")
    expect_keys(
        receipt,
        {"schema", "receiptId", "runId", "status", "issuedAt", "issuedBy", "admission", "authorizedResults", "expectedUnionSha256", "preIntegration", "sharedVerificationPlan", "sharedTestSource", "authority", "sealedPayloadSha256"},
        "authorization receipt",
    )
    if receipt.get("schema") != "dwp.hris.g7-sys-hrm-integration-authorization-receipt.v3" or receipt.get("receiptId") != f"HRIS-G7-SYS-HRM-INTEGRATION-AUTHORIZATION-{run_id.upper()}" or receipt.get("runId") != run_id or receipt.get("status") != "PASS_INTEGRATION_AUTHORIZATION_PENDING_CARRIER":
        fail("authorization identity/status mismatch")
    if receipt.get("issuedBy") != "SYS_COMMON_INTEGRATION_CONTROL":
        fail("authorization issuer mismatch")
    admission_ref = receipt.get("admission", {})
    expect_keys(admission_ref, {"path", "gitBlobSha1", "sha256", "bytes", "carrierCommit", "carrierTree", "receiptId"}, "authorization admission ref")
    admission_carrier = commit(frontend, str(admission_ref.get("carrierCommit", "")))
    assert_carrier_shape(frontend, state["commit"], admission_carrier, artifact, "authorization carrier")
    admission, admission_pin, admission_state = verify_admission(
        frontend, backend, run_id, admission_carrier, require_current=False
    )
    input_carrier = str(admission.get("testEvidence", {}).get("carrierCommit", ""))
    assert_run_never_preexisted(frontend, run_id, input_carrier)
    if require_current:
        assert_exact_run_history(
            frontend,
            run_id,
            [input_carrier, admission_carrier, state["commit"]],
        )
        closure_path = (run_root(run_id) / "integrated-closure.v3.json").as_posix()
        if entry(frontend, state["commit"], closure_path) is not None:
            fail(f"future reserved receipt path already exists: {closure_path}")
    pin_equals(admission_pin, admission_ref, "authorization admission")
    if admission_ref.get("carrierTree") != admission_state["tree"] or admission_ref.get("receiptId") != admission.get("receiptId"):
        fail("authorization admission carrier metadata mismatch")
    if receipt.get("authorizedResults") != authorized_results(admission):
        fail("authorization exact result set mismatch")
    if receipt.get("expectedUnionSha256") != admission.get("expectedUnionSha256"):
        fail("authorization union digest mismatch")
    pre = receipt.get("preIntegration", {})
    expect_keys(pre, {"frontend", "backend"}, "authorization pre-integration")
    if pre.get("frontend") != {
        "rule": "AUTHORIZATION_CARRIER_COMMIT_EXACT",
        "branch": CENTRAL["frontend"]["branch"],
        "upstream": CENTRAL["frontend"]["upstream"],
    }:
        fail("authorization frontend self-reference rule mismatch")
    backend_pre = pre.get("backend")
    if not isinstance(backend_pre, dict):
        fail("authorization backend pre-integration pin missing")
    backend_pre_commit = commit(backend, str(backend_pre.get("commit", "")))
    expected_backend_pin = {
        "commit": backend_pre_commit,
        "tree": tree(backend, backend_pre_commit),
        "branch": CENTRAL["backend"]["branch"],
        "upstream": CENTRAL["backend"]["upstream"],
        "clean": True,
        "upstreamMatched": True,
        "stateSha256": EMPTY_SHA256,
    }
    if backend_pre != expected_backend_pin:
        fail("authorization backend pre-integration pin mismatch")
    backend_bases = {
        worktree["basePin"]["commit"]
        for module_result in admission["moduleResults"]
        for worktree in module_result["worktrees"]
        if worktree["repo"] == "backend"
    }
    if backend_bases != {backend_pre_commit}:
        fail("authorization backend pre-integration differs from module base")
    pushed(backend, backend_pre_commit, CENTRAL["backend"]["upstream"], "backend pre-integration")
    plan_ref = receipt.get("sharedVerificationPlan", {})
    expect_keys(plan_ref, {"path", "gitBlobSha1", "sha256", "bytes", "carrierCommit", "carrierTree", "planId", "authorityStatus", "closedSet", "requiredCategories"}, "authorization shared plan ref")
    admission_plan_ref = admission["sharedVerificationPlan"]
    for key in ("path", "gitBlobSha1", "sha256", "bytes", "carrierCommit", "carrierTree", "planId", "authorityStatus"):
        if plan_ref.get(key) != admission_plan_ref.get(key):
            fail(f"authorization plan {key} mismatch")
    plan_pin, plan_raw = file_pin(frontend, plan_ref["carrierCommit"], plan_ref["path"])
    pin_equals(plan_pin, plan_ref, "authorization plan")
    plan = json_object(plan_raw, "authorization plan")
    verify_plan(plan)
    if plan_ref.get("closedSet") != plan["closedSet"] or plan_ref.get("requiredCategories") != SHARED_CATEGORIES:
        fail("authorization plan closed set/category mismatch")
    if receipt.get("sharedTestSource") != admission.get("sharedTestSource"):
        fail("authorization shared-test-source pin differs from admission")
    authority = receipt.get("authority", {})
    expect_keys(authority, {"beforeCarrier", "effectiveAfterCarrier", "customerDataAuthorized", "customerActivationAuthorized", "productionReleaseAuthorized"}, "authorization authority")
    if authority.get("beforeCarrier") != {"integrationMergeAuthorized": False}:
        fail("authorization grants merge before carrier")
    effective = authority.get("effectiveAfterCarrier", {})
    if effective != {
        "integrationMergeAuthorized": True,
        "exactResultsOnly": True,
        "frontendPreIntegrationRule": "AUTHORIZATION_CARRIER_COMMIT_EXACT",
        "backendPreIntegrationCommit": backend_pre_commit,
    }:
        fail("authorization effective-after-carrier scope mismatch")
    for key in ("customerDataAuthorized", "customerActivationAuthorized", "productionReleaseAuthorized"):
        if authority.get(key) is not False:
            fail(f"authorization must keep {key}=false")
    expected_issued = max(commit_time(frontend, admission_carrier), commit_time(backend, backend_pre_commit))
    if receipt.get("issuedAt") != iso(expected_issued):
        fail("authorization issuedAt is not deterministic")
    earliest_expiry = min(
        parse_time(str(row.get("tokenExpiresAt", "")), f"{row.get('module')} expiry")
        for row in admission["moduleResults"]
    )
    if commit_time(frontend, state["commit"]) > earliest_expiry:
        fail("authorization carrier was committed after token expiry")
    return receipt, pin, state, admission


def expected_repo_manifest(admission: dict[str, Any], repo_name: str) -> list[dict[str, Any]]:
    return [
        {"path": row["path"], "change": row["change"], "before": row["before"], "after": row["after"]}
        for row in union_from_admission(admission)[repo_name]
    ]


def verify_integrated_repo(
    repo_name: str,
    repo: Path,
    value: dict[str, Any],
    expected_pre: str,
    admission: dict[str, Any],
) -> None:
    expect_keys(value, {"repo", "preIntegration", "integrated", "changedFiles", "changedFilesSha256"}, f"central {repo_name} integration")
    pre = commit(repo, expected_pre)
    integrated = commit(repo, str(value.get("integrated", {}).get("commit", "")))
    if value.get("repo") != repo_name:
        fail(f"central {repo_name}: repo label mismatch")
    if value.get("preIntegration") != {"commit": pre, "tree": tree(repo, pre)}:
        fail(f"central {repo_name}: pre-integration pin mismatch")
    if not ancestor(repo, pre, integrated):
        fail(f"central {repo_name}: integration ancestry mismatch")
    if commit_time(repo, integrated) < commit_time(repo, pre):
        fail(f"central {repo_name}: integration timestamp precedes pre-integration")
    pushed(repo, integrated, CENTRAL[repo_name]["upstream"], f"central {repo_name} integration")
    expected_integrated = {
        "commit": integrated,
        "tree": tree(repo, integrated),
        "branch": CENTRAL[repo_name]["branch"],
        "upstream": CENTRAL[repo_name]["upstream"],
        "upstreamContainsCommit": True,
    }
    if value.get("integrated") != expected_integrated:
        fail(f"central {repo_name}: integrated pin mismatch")
    manifest = changed_manifest(repo, pre, integrated)
    expected = expected_repo_manifest(admission, repo_name)
    if manifest != expected:
        fail(f"central {repo_name}: diff differs from exact result union")
    if value.get("changedFiles") != manifest or value.get("changedFilesSha256") != sha256(canonical_bytes(manifest)):
        fail(f"central {repo_name}: closure manifest mismatch")


def verify_shared_evidence(
    frontend: Path,
    backend: Path,
    run_id: str,
    carrier: str,
    reference: dict[str, Any],
    plan: dict[str, Any],
    plan_ref: dict[str, Any],
    source_pins: dict[str, dict[str, str]],
    *,
    allow_test_mode: bool = False,
) -> None:
    path_value = require_run_path(run_id, str(reference.get("path", "")), "shared evidence")
    pin, raw = file_pin(frontend, carrier, path_value)
    pin_equals(pin, reference, "shared evidence")
    value = json_object(raw, "shared evidence")
    check_seal(value, "shared evidence")
    expect_keys(
        value,
        {"schema", "evidenceId", "issuedBy", "authorityStatus", "plan", "sourcePins", "runner", "singleBatch", "closedSet", "results", "startedAt", "completedAt", "sealedPayloadSha256"},
        "shared evidence",
    )
    if value.get("schema") != "dwp.hris.g7-sys-hrm-shared-verification-evidence-input.v3":
        fail("shared evidence schema mismatch")
    if value.get("issuedBy") != "SYS_COMMON_INTEGRATION_CONTROL" or value.get("authorityStatus") != "CONTROL_AUTHORED_POST_INTEGRATION_EVIDENCE":
        fail("shared evidence authority mismatch")
    if reference.get("evidenceId") != value.get("evidenceId"):
        fail("shared evidence identity mismatch")
    if value.get("singleBatch") is not True or reference.get("singleBatch") is not True:
        fail("shared verification was not one batch")
    evidence_plan = value.get("plan")
    if not isinstance(evidence_plan, dict):
        fail("shared evidence plan pin missing")
    expect_keys(evidence_plan, {"path", "gitBlobSha1", "sha256", "bytes"}, "shared evidence plan")
    pin_equals({key: plan_ref[key] for key in ("path", "gitBlobSha1", "sha256", "bytes")}, evidence_plan, "shared evidence plan")
    if value.get("sourcePins") != source_pins:
        fail("shared evidence source pins mismatch")
    runner = value.get("runner")
    if not isinstance(runner, dict):
        fail("shared evidence runner receipt missing")
    expect_keys(
        runner,
        {"implementation", "executionMode", "argvDispatch", "environmentDispatch", "sourceEnvironment", "commandCount", "genesisSha256", "finalRecordSha256"},
        "shared runner",
    )
    modes = {RUNNER_EXECUTION_MODE}
    if allow_test_mode:
        modes.add(SELF_TEST_EXECUTION_MODE)
    if runner.get("executionMode") not in modes:
        fail("shared runner execution mode is not production exact argv")
    if runner.get("argvDispatch") != "DIRECT_LIST_NO_SHELL":
        fail("shared runner argv dispatch mismatch")
    if runner.get("environmentDispatch") != "INHERITED_PLUS_EXACT_SOURCE_PINS":
        fail("shared runner environment dispatch mismatch")
    if runner.get("sourceEnvironment") != source_pin_environment(source_pins):
        fail("shared runner source environment differs from source heads")
    implementation_path = (
        R3_ROOT_REL / "materialize_g7_sys_hrm_result_acceptance.py"
    ).as_posix()
    implementation_pin, _ = file_pin(
        frontend, source_pins["frontend"]["commit"], implementation_path
    )
    if runner.get("implementation") != implementation_pin:
        fail("shared runner implementation pin mismatch")
    if value.get("closedSet") != plan["closedSet"]:
        fail("shared evidence closed set mismatch")
    if parse_time(str(value.get("completedAt", "")), "shared completion") < parse_time(str(value.get("startedAt", "")), "shared start"):
        fail("shared verification completion precedes start")
    started = parse_time(str(value.get("startedAt", "")), "shared start")
    completed = parse_time(str(value.get("completedAt", "")), "shared completion")
    source_ready_at = max(
        commit_time(frontend, source_pins["frontend"]["commit"]),
        commit_time(backend, source_pins["backend"]["commit"]),
    )
    if started < source_ready_at:
        fail("shared verification started before source-result commits")
    if completed > commit_time(frontend, carrier):
        fail("shared verification completed after evidence carrier commit")
    rows = value.get("results")
    if not isinstance(rows, list) or len(rows) != len(plan["commands"]):
        fail("shared evidence result count mismatch")
    if [row.get("commandId") for row in rows if isinstance(row, dict)] != plan["closedSet"]:
        fail("shared evidence result closed set mismatch")
    if runner.get("commandCount") != len(rows) or runner.get("genesisSha256") != RUNNER_GENESIS_SHA256:
        fail("shared runner count/genesis mismatch")
    previous = RUNNER_GENESIS_SHA256
    previous_completed = started
    for index, command in enumerate(plan["commands"], start=1):
        row = rows[index - 1]
        if not isinstance(row, dict):
            fail(f"shared evidence {command['commandId']}: row is not an object")
        expect_keys(row, {"recordIndex", "commandId", "category", "repo", "cwd", "argv", "executionMode", "startedAt", "completedAt", "elapsedMs", "sourcePins", "status", "exitCode", "stdout", "stderr", "structuredResult", "previousRecordSha256", "recordSha256"}, f"shared evidence {command['commandId']}")
        for key in ("category", "repo", "cwd", "argv"):
            if row.get(key) != command.get(key):
                fail(f"shared evidence {command['commandId']}: {key} mismatch")
        if (
            row.get("status") != "PASS"
            or type(row.get("exitCode")) is not int
            or row.get("exitCode") != 0
        ):
            fail(f"shared evidence {command['commandId']}: not PASS/0")
        if row.get("recordIndex") != index or row.get("executionMode") != runner.get("executionMode"):
            fail(f"shared evidence {command['commandId']}: runner index/mode mismatch")
        if row.get("sourcePins") != source_pins:
            fail(f"shared evidence {command['commandId']}: source pins mismatch")
        row_started = parse_time(str(row.get("startedAt", "")), f"{command['commandId']} start")
        row_completed = parse_time(str(row.get("completedAt", "")), f"{command['commandId']} completion")
        if row_started < previous_completed or row_completed < row_started:
            fail(f"shared evidence {command['commandId']}: runner timestamps are not monotonic")
        if not isinstance(row.get("elapsedMs"), int) or row["elapsedMs"] < 0:
            fail(f"shared evidence {command['commandId']}: invalid elapsedMs")
        slug = command["commandId"].lower().replace("_", "-")
        expected_stdout_path = (
            run_root(run_id) / f"shared-runner/{index:02d}-{slug}.stdout"
        ).as_posix()
        expected_stderr_path = (
            run_root(run_id) / f"shared-runner/{index:02d}-{slug}.stderr"
        ).as_posix()
        if row.get("stdout", {}).get("path") != expected_stdout_path:
            fail(f"shared evidence {command['commandId']}: stdout path mismatch")
        if row.get("stderr", {}).get("path") != expected_stderr_path:
            fail(f"shared evidence {command['commandId']}: stderr path mismatch")
        stdout_raw = verify_output(
            frontend, carrier, run_id, row.get("stdout"), f"{command['commandId']} stdout",
            allow_empty=True,
        )
        stderr_raw = verify_output(
            frontend, carrier, run_id, row.get("stderr"), f"{command['commandId']} stderr",
            allow_empty=True,
        )
        if row.get("previousRecordSha256") != previous:
            fail(f"shared evidence {command['commandId']}: hash predecessor mismatch")
        if row.get("recordSha256") != runner_record_digest(row):
            fail(f"shared evidence {command['commandId']}: record digest mismatch")
        previous = row["recordSha256"]
        previous_completed = row_completed
        derived = expected_structured_result(
            command["commandId"],
            row["sourcePins"],
            stdout_raw,
            stderr_raw,
            row["exitCode"],
            frontend,
        )
        if row.get("structuredResult") != derived:
            fail(f"shared evidence {command['commandId']}: structured result mismatch")
        if not isinstance(derived["report"], dict):
            fail(f"shared evidence {command['commandId']}: semantic report is missing")
    if previous_completed != completed or rows[0]["startedAt"] != value.get("startedAt"):
        fail("shared runner batch timestamps mismatch")
    if runner.get("finalRecordSha256") != previous:
        fail("shared runner final hash mismatch")


def verify_closure(
    frontend: Path,
    backend: Path,
    run_id: str,
    carrier_revision: str,
    *,
    allow_test_mode: bool = False,
) -> dict[str, Any]:
    state = carrier_state(frontend, carrier_revision, "frontend", "closure carrier", True)
    artifact = (run_root(run_id) / "integrated-closure.v3.json").as_posix()
    pin, raw = file_pin(frontend, state["commit"], artifact)
    receipt = json_object(raw, "closure receipt")
    check_seal(receipt, "closure receipt")
    expect_keys(
        receipt,
        {"schema", "receiptId", "runId", "status", "issuedAt", "issuedBy", "authorization", "centralIntegration", "sharedControlVerification", "tokenClosures", "modPerCompplanReadiness", "authority", "sealedPayloadSha256"},
        "closure receipt",
    )
    if receipt.get("schema") != "dwp.hris.g7-sys-hrm-integrated-closure-receipt.v3" or receipt.get("receiptId") != f"HRIS-G7-SYS-HRM-INTEGRATED-CLOSURE-{run_id.upper()}" or receipt.get("runId") != run_id or receipt.get("status") != "PASS_INTEGRATED_CLOSURE_PENDING_CARRIER":
        fail("closure identity/status mismatch")
    if receipt.get("issuedBy") != "SYS_COMMON_INTEGRATION_CONTROL":
        fail("closure issuer mismatch")
    authorization_ref = receipt.get("authorization", {})
    expect_keys(authorization_ref, {"path", "gitBlobSha1", "sha256", "bytes", "carrierCommit", "carrierTree", "receiptId"}, "closure authorization ref")
    authorization_carrier = commit(frontend, str(authorization_ref.get("carrierCommit", "")))
    authorization, authorization_pin, authorization_state, admission = verify_authorization(
        frontend, backend, run_id, authorization_carrier, require_current=False
    )
    pin_equals(authorization_pin, authorization_ref, "closure authorization")
    if authorization_ref.get("carrierTree") != authorization_state["tree"] or authorization_ref.get("receiptId") != authorization.get("receiptId"):
        fail("closure authorization carrier metadata mismatch")
    shared_ref = receipt.get("sharedControlVerification", {})
    expect_keys(shared_ref, {"path", "gitBlobSha1", "sha256", "bytes", "carrierCommit", "carrierTree", "evidenceId", "singleBatch", "planAuthorityStatus"}, "closure shared evidence ref")
    shared_path = require_run_path(run_id, str(shared_ref.get("path", "")), "shared evidence")
    expected_shared_path = (
        run_root(run_id) / "shared-verification-evidence.v3.json"
    ).as_posix()
    if shared_path != expected_shared_path:
        fail("shared evidence path is not the exact runner output path")
    assert_distinct_non_reserved_run_inputs(
        run_id,
        [shared_path],
        "shared evidence carrier",
    )
    shared_carrier = commit(frontend, str(shared_ref.get("carrierCommit", "")))
    if shared_ref.get("carrierTree") != tree(frontend, shared_carrier):
        fail("closure shared evidence carrier tree mismatch")
    pushed(frontend, shared_carrier, CENTRAL["frontend"]["upstream"], "shared evidence carrier")
    assert_carrier_shape(frontend, state["commit"], shared_carrier, artifact, "closure carrier")
    integration = receipt.get("centralIntegration", {})
    expect_keys(integration, {"expectedUnionSha256", "onlyExpectedUnionChanges", "repositories"}, "closure central integration")
    if integration.get("expectedUnionSha256") != admission.get("expectedUnionSha256") or integration.get("onlyExpectedUnionChanges") is not True:
        fail("closure integration union declaration mismatch")
    repositories = integration.get("repositories", {})
    if set(repositories) != {"frontend", "backend"}:
        fail("closure central repository set mismatch")
    verify_integrated_repo("frontend", frontend, repositories["frontend"], authorization_state["commit"], admission)
    backend_pre = authorization["preIntegration"]["backend"]["commit"]
    verify_integrated_repo("backend", backend, repositories["backend"], backend_pre, admission)
    frontend_integrated = repositories["frontend"]["integrated"]
    backend_integrated = repositories["backend"]["integrated"]
    if branch(backend) != CENTRAL["backend"]["branch"] or upstream(backend) != CENTRAL["backend"]["upstream"]:
        fail("central backend branch/upstream changed at closure")
    if git(backend, "status", "--porcelain=v1", "-z"):
        fail("central backend worktree is dirty at closure")
    if commit(backend, "HEAD") != backend_integrated["commit"] or commit(backend, CENTRAL["backend"]["upstream"]) != backend_integrated["commit"]:
        fail("central backend source-result commit is not exact clean/pushed HEAD")
    if not ancestor(frontend, frontend_integrated["commit"], shared_carrier):
        fail("shared evidence carrier does not descend from frontend source result")
    plan_ref = authorization["sharedVerificationPlan"]
    plan_pin, plan_raw = file_pin(frontend, plan_ref["carrierCommit"], plan_ref["path"])
    pin_equals(plan_pin, plan_ref, "closure shared plan")
    plan = json_object(plan_raw, "closure shared plan")
    verify_plan(plan)
    source_pins = {
        "frontend": {"commit": frontend_integrated["commit"], "tree": frontend_integrated["tree"]},
        "backend": {"commit": backend_integrated["commit"], "tree": backend_integrated["tree"]},
    }
    verify_canonical_command_sources(
        frontend,
        source_pins["frontend"]["commit"],
        backend,
        source_pins["backend"]["commit"],
    )
    verify_shared_evidence(
        frontend,
        backend,
        run_id,
        shared_carrier,
        shared_ref,
        plan,
        plan_ref,
        source_pins,
        allow_test_mode=allow_test_mode,
    )
    _, shared_raw = file_pin(frontend, shared_carrier, shared_path)
    shared_value = json_object(shared_raw, "shared evidence")
    shared_output_paths = [
        str(row[stream]["path"])
        for row in shared_value["results"]
        for stream in ("stdout", "stderr")
    ]
    assert_distinct_non_reserved_run_inputs(
        run_id,
        [shared_path, *shared_output_paths],
        "shared evidence carrier",
    )
    assert_exact_added_carrier(
        frontend,
        shared_carrier,
        [shared_path, *shared_output_paths],
        "shared evidence carrier",
        expected_parent=frontend_integrated["commit"],
    )
    input_carrier = str(admission.get("testEvidence", {}).get("carrierCommit", ""))
    admission_carrier = str(authorization.get("admission", {}).get("carrierCommit", ""))
    assert_run_never_preexisted(frontend, run_id, input_carrier)
    assert_exact_run_history(
        frontend,
        run_id,
        [
            input_carrier,
            admission_carrier,
            authorization_carrier,
            shared_carrier,
            state["commit"],
        ],
    )
    if shared_ref.get("planAuthorityStatus") != "CONTROL_PROPOSAL_NOT_PREDECESSOR_AUTHORITY":
        fail("closure shared plan authority status missing")
    expected_closures = [
        {"module": "SYS", "sliceId": MODULES["SYS"]["sliceId"], "tokenId": MODULES["SYS"]["tokenId"], "stateAfterCarrier": "RESULT_INTEGRATED_CLOSED"},
        {"module": "HRM", "sliceId": MODULES["HRM"]["sliceId"], "tokenId": MODULES["HRM"]["tokenId"], "stateAfterCarrier": "RESULT_INTEGRATED_CLOSED"},
    ]
    if receipt.get("tokenClosures") != expected_closures:
        fail("closure token closed set mismatch")
    readiness = receipt.get("modPerCompplanReadiness", {})
    expect_keys(readiness, {"sliceId", "status", "authorityStatus", "implementationTokenIssued", "sourceChangeAuthorized", "payConsumerReady", "nextRequiredActions"}, "MOD-PER-COMPPLAN readiness")
    if readiness.get("sliceId") != "MOD-PER-COMPPLAN" or readiness.get("status") != "CONTROL_PROPOSAL_READY_FOR_PACKET_PREPARATION" or readiness.get("authorityStatus") != "CONTROL_PROPOSAL_NOT_CANONICAL_START_AUTHORITY":
        fail("MOD-PER-COMPPLAN readiness is not explicitly proposal-only")
    if readiness.get("implementationTokenIssued") is not False or readiness.get("sourceChangeAuthorized") is not False or readiness.get("payConsumerReady") is not False:
        fail("MOD-PER-COMPPLAN proposal overstates authority/readiness")
    if not isinstance(readiness.get("nextRequiredActions"), list) or len(readiness["nextRequiredActions"]) < 3:
        fail("MOD-PER-COMPPLAN proposal lacks required next actions")
    authority = receipt.get("authority", {})
    expect_keys(authority, {"effectiveAfterCarrier", "integrationMergeAuthorized", "customerDataAuthorized", "customerActivationAuthorized", "productionReleaseAuthorized"}, "closure authority")
    if authority.get("effectiveAfterCarrier") != {"sysHrmTokensClosed": True, "modPerCompplanPacketPreparationMayBegin": True}:
        fail("closure effective-after-carrier state mismatch")
    for key in ("integrationMergeAuthorized", "customerDataAuthorized", "customerActivationAuthorized", "productionReleaseAuthorized"):
        if authority.get(key) is not False:
            fail(f"closure must keep {key}=false")
    expected_issued = max(
        commit_time(frontend, shared_carrier),
        commit_time(frontend, frontend_integrated["commit"]),
        commit_time(backend, backend_integrated["commit"]),
    )
    if receipt.get("issuedAt") != iso(expected_issued):
        fail("closure issuedAt is not deterministic")
    earliest_expiry = min(
        parse_time(str(row.get("tokenExpiresAt", "")), f"{row.get('module')} expiry")
        for row in admission["moduleResults"]
    )
    for label, timestamp in (
        ("frontend integration", commit_time(frontend, frontend_integrated["commit"])),
        ("backend integration", commit_time(backend, backend_integrated["commit"])),
        ("shared evidence carrier", commit_time(frontend, shared_carrier)),
        ("closure carrier", commit_time(frontend, state["commit"])),
    ):
        if timestamp > earliest_expiry:
            fail(f"{label} was committed after token expiry")
    return {"receipt": receipt, "pin": pin, "carrier": state}


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(description=__doc__)
    sub = root.add_subparsers(dest="phase", required=True)
    source = sub.add_parser("source")
    source.add_argument("--carrier", required=True)
    source.add_argument("--frontend", type=Path, default=DEFAULT_FRONTEND)
    for phase in ("admission", "authorization", "closure"):
        item = sub.add_parser(phase)
        item.add_argument("--run-id", required=True)
        item.add_argument("--carrier", required=True)
        item.add_argument("--frontend", type=Path, default=DEFAULT_FRONTEND)
        item.add_argument("--backend", type=Path, default=DEFAULT_BACKEND)
    return root


def main(argv: Iterable[str] | None = None) -> int:
    args = parser().parse_args(argv)
    frontend = ensure_repo(args.frontend, "central frontend")
    if args.phase == "source":
        source_pin, state = verify_shared_test_source_carrier(
            frontend, args.carrier, require_current=True
        )
        print(json.dumps({
            "status": "PASS",
            "phase": "source",
            "templateId": source_pin["templateId"],
            "carrierCommit": state["commit"],
            "carrierTree": state["tree"],
            "sourceSha256": source_pin["sha256"],
        }))
        return 0
    backend = ensure_repo(args.backend, "central backend")
    if args.phase == "admission":
        receipt, pin, state = verify_admission(frontend, backend, args.run_id, args.carrier, require_current=True)
    elif args.phase == "authorization":
        receipt, pin, state, _ = verify_authorization(frontend, backend, args.run_id, args.carrier, require_current=True)
    else:
        result = verify_closure(frontend, backend, args.run_id, args.carrier)
        receipt, pin, state = result["receipt"], result["pin"], result["carrier"]
    print(json.dumps({
        "status": "PASS", "phase": args.phase, "runId": args.run_id,
        "receiptId": receipt["receiptId"], "carrierCommit": state["commit"],
        "carrierTree": state["tree"], "receiptSha256": pin["sha256"],
    }))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except ValidationError as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        raise SystemExit(1)
