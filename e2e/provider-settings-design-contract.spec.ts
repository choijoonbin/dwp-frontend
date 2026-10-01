import { mkdir } from 'node:fs/promises';

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route, type TestInfo } from '@playwright/test';

import { FULL_PRODUCT_PERMISSIONS, mockShellSession } from './support/shell-session';

const EVIDENCE_DIRECTORY =
  '/Users/a10697/Work/DWP/output/admin-settings-provider-truth-audit-2026-09-17/screenshots';

const settingDefinition = {
  settingId: 'feature-rollout.WORKFORCE_EXPORT_V2',
  displayName: 'Governed workforce export',
  description: 'Controls the governed workforce export experience for each tenant.',
  owner: {
    service: 'dwp-provider-server',
    domain: 'feature-rollout',
    readPermission: 'FEATURE_ROLLOUT_READ',
    managementPath: '/provider/feature-rollouts',
  },
  supportedScopes: ['TENANT'],
  validation: {
    valueType: 'BOOLEAN',
    schemaVersion: '1',
    schema: { type: 'boolean' },
    ownerRevalidatesOnWrite: true,
  },
  sensitivity: 'INTERNAL',
  change: {
    riskTier: 'L2',
    workflow: 'APPROVE_AND_ACTIVATE',
    approvalRequired: true,
    activationRequired: true,
  },
  lifecycleState: 'ACTIVE',
  definitionVersion: 1,
} as const;

function success(route: Route, data: unknown) {
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data }),
  });
}

async function expectNoSeriousAxeViolations(page: Page, selector = '#dwp-main-content') {
  const audit = await new AxeBuilder({ page }).include(selector).analyze();
  expect(
    audit.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))
  ).toEqual([]);
}

const resourceCommitment = {
  providerTenantId: 'tenant-skax',
  tenantKey: 'skax-prod',
  tenantDisplayName: 'SKAX Production',
  resourceKey: 'API_CALLS',
  unit: 'REQUEST',
  quotaLimit: 100000,
  budgetLimit: null,
  currencyCode: null,
  controlMode: 'SOFT_ALERT',
  controlScope: 'INTERNAL_ONLY',
  controlPeriod: {
    startsAt: '2026-08-01T00:00:00Z',
    endsAt: '2026-09-01T00:00:00Z',
    state: 'ACTIVE',
  },
  sourceSystem: 'PROVIDER_CONTROL',
  externalFeedState: 'UNAVAILABLE',
  internalEvidenceFreshness: {
    state: 'CURRENT_PERIOD_EVIDENCE',
    latestOccurredAt: '2026-08-10T23:55:00Z',
    latestRecordedAt: '2026-08-10T23:56:00Z',
    entryCount: 1,
  },
  totals: {
    allocated: 50000,
    released: 0,
    adjusted: 0,
    allocationBalance: 50000,
    meteredInternalEvidence: 25000,
    remainingQuota: 75000,
    budgetReserved: 0,
    budgetReleased: 0,
    budgetSpentInternalEvidence: 0,
    budgetReservationBalance: 0,
    remainingBudget: null,
    quotaControlState: 'WITHIN_LIMIT',
    budgetControlState: 'NOT_CONFIGURED',
  },
  activeOverride: null,
  lifecycleState: 'ACTIVE',
  version: 3,
  updatedAt: '2026-08-10T23:56:00Z',
};

const lifecycleRequest = {
  lifecycleRequestId: '66000000-0000-0000-0000-000000000001',
  providerTenantId: 'tenant-skax',
  tenantKey: 'skax-prod',
  tenantDisplayName: 'SKAX Production',
  requestedAction: 'PURGE',
  lifecycleState: 'PENDING_APPROVAL',
  holdEvaluationState: 'OWNER_VERIFICATION_REQUIRED',
  holdEvidenceRefs: [],
  executionState: 'OWNER_HANDOFF_REQUIRED',
  justification: 'Customer contract and recovery window ended',
  requestedBy: 1,
  submittedBy: 1,
  approvedBy: null,
  submittedAt: '2026-08-10T23:30:00Z',
  approvedAt: null,
  decisionReason: null as string | null,
  version: 2,
  createdAt: '2026-08-10T23:00:00Z',
  updatedAt: '2026-08-10T23:30:00Z',
};

const artifactCompatibility = {
  schema: {
    state: 'PASSED',
    currentVersion: '2.4.2',
    targetVersion: '2.5.0',
    migrationState: 'ADDITIVE_ONLY',
  },
  clients: [{ clientType: 'WEB', minimumVersion: '2.4', state: 'PASSED' }],
  dependencies: [
    {
      dependencyKey: 'identity-api',
      requiredVersion: '2.1',
      observedVersion: '2.1',
      state: 'PASSED',
    },
  ],
  capabilities: { added: ['typed-governance'], removed: [], increased: [] },
  rollbackReadiness: { state: 'READY', reasons: [], executionBoundary: 'INTERNAL_PLAN_ONLY' },
};

function artifactManifest(
  artifactId: string,
  productKey: string,
  artifactVersion: string,
  createdBy: number
) {
  return {
    artifactId,
    productKey,
    artifactType: 'SERVICE',
    artifactVersion,
    manifestSchemaVersion: 1,
    declaredDigest: 'a'.repeat(64),
    manifest: {
      entrypoint: 'service-main',
      packageReference: `registry://workspace/${artifactVersion}`,
      changeSummary: 'Adds typed governance controls',
    },
    compatibilityPolicy: {
      schema: {
        currentVersion: '2.4.2',
        targetVersion: artifactVersion,
        migrationState: 'ADDITIVE_ONLY',
      },
      clients: [{ clientType: 'WEB', minimumVersion: '2.4' }],
      dependencies: [{ dependencyKey: 'identity-api', requiredVersion: '2.1' }],
      capabilities: { allowAdded: true, allowRemoved: false, allowIncreased: false },
      rollback: { required: true, strategy: 'TRAFFIC_REVERT' },
    },
    compatibilityState: 'COMPATIBLE',
    compatibilityEvidence: {},
    compatibility: artifactCompatibility,
    signatureState: 'UNAVAILABLE',
    distributionState: 'UNAVAILABLE',
    lifecycleState: 'REVIEW_REQUIRED',
    createdBy,
    updatedBy: createdBy,
    createdAt: '2026-08-10T22:00:00Z',
    updatedAt: '2026-08-10T23:00:00Z',
    version: 2,
    reviews: [],
    reviewsLimit: 50,
    reviewsHasMore: false,
  };
}

async function mockProviderGovernance(page: Page) {
  let currentLifecycleRequest = lifecycleRequest;
  await page.route('**/api/provider/v1/admin/resource-governance/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/commitments')) {
      return success(route, { items: [resourceCommitment], limit: 100, hasMore: false });
    }
    if (path.endsWith('/commitment-changes')) {
      return success(route, { items: [], limit: 100, hasMore: false });
    }
    if (path.endsWith('/lifecycle-requests')) {
      return success(route, { items: [currentLifecycleRequest], limit: 100, hasMore: false });
    }
    if (path.endsWith(`/lifecycle-requests/${lifecycleRequest.lifecycleRequestId}/cancel`)) {
      expect(route.request().postDataJSON()).toEqual({
        version: currentLifecycleRequest.version,
        reason: 'Customer retained the tenant',
      });
      currentLifecycleRequest = {
        ...currentLifecycleRequest,
        lifecycleState: 'CANCELLED',
        executionState: 'NOT_REQUIRED',
        decisionReason: 'Customer retained the tenant',
        version: currentLifecycleRequest.version + 1,
        updatedAt: '2026-08-11T00:00:00Z',
      };
      return success(route, currentLifecycleRequest);
    }
    if (path.endsWith('/ledger')) {
      return success(route, {
        items: [
          {
            ledgerEntryId: '63000000-0000-0000-0000-000000000001',
            providerTenantId: 'tenant-skax',
            resourceKey: 'API_CALLS',
            entryType: 'METER',
            amount: 25000,
            unit: 'REQUEST',
            currencyCode: null,
            controlPeriodStartsAt: '2026-08-01T00:00:00Z',
            controlPeriodEndsAt: '2026-09-01T00:00:00Z',
            occurredAt: '2026-08-10T23:55:00Z',
            recordedAt: '2026-08-10T23:56:00Z',
            recordedBy: 2,
            evidenceRef: 'internal-meter-20260810',
            reason: 'Daily internal usage observation',
            idempotencyKey: 'meter-20260810',
          },
        ],
        limit: 100,
        hasMore: false,
      });
    }
    return route.fulfill({ status: 404 });
  });

  await page.route('**/api/provider/v1/admin/artifact-governance/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/manifests')) {
      return success(route, {
        items: [
          artifactManifest('64000000-0000-0000-0000-000000000001', 'WORKSPACE_CORE', '2.5.0', 1),
          {
            ...artifactManifest(
              '64000000-0000-0000-0000-000000000002',
              'WORKSPACE_AGENT',
              '2.6.0',
              2
            ),
            reviewsHasMore: true,
          },
        ],
        limit: 100,
        hasMore: false,
      });
    }
    if (path.endsWith('/rollout-plans')) {
      return success(route, {
        items: [
          {
            rolloutPlanId: '65000000-0000-0000-0000-000000000001',
            artifactId: '64000000-0000-0000-0000-000000000001',
            productKey: 'WORKSPACE_CORE',
            artifactVersion: '2.5.0',
            name: 'Workspace core pilot',
            targetScope: {
              environmentKey: 'production',
              tenantKeys: ['skax-prod'],
              cohortKeys: ['pilot'],
              targetPercentage: 10,
            },
            stages: [
              {
                stageKey: 'pilot',
                targetPercentage: 10,
                minimumObservationMinutes: 60,
                approvalGate: true,
              },
            ],
            rollbackPlan: {
              strategy: 'TRAFFIC_REVERT',
              targetVersion: '2.4.2',
              dataHandling: 'PRESERVE_CURRENT_SCHEMA',
              validationChecks: ['service-health'],
              manualSteps: [],
            },
            rollbackFeasibility: 'DECLARED',
            rollbackReadiness: {
              state: 'READY',
              reasons: [],
              executionBoundary: 'INTERNAL_PLAN_ONLY',
            },
            executorState: 'EXTERNAL_EXECUTOR_UNAVAILABLE',
            lifecycleState: 'PENDING_APPROVAL',
            reason: 'Controlled pilot',
            requestedBy: 1,
            approvedBy: null,
            decisionReason: null,
            submittedAt: '2026-08-10T23:00:00Z',
            approvedAt: null,
            createdAt: '2026-08-10T22:30:00Z',
            updatedAt: '2026-08-10T23:00:00Z',
            version: 2,
            evidence: [],
            evidenceLimit: 50,
            evidenceHasMore: true,
          },
        ],
        limit: 100,
        hasMore: false,
      });
    }
    return route.fulfill({ status: 404 });
  });
}

async function mockProviderSettings(page: Page) {
  await page.route('**/api/provider/v1/admin/settings**', async (route) => {
    const url = new URL(route.request().url());
    const effective = url.pathname.endsWith('/effective');
    if (!effective) return success(route, [settingDefinition]);

    return success(route, {
      settingId: settingDefinition.settingId,
      resolutionState: 'RESOLVED',
      definition: settingDefinition,
      target: {
        scopeType: 'TENANT',
        scopeId: url.searchParams.get('scopeId') ?? 'tenant-skax',
        environment: url.searchParams.get('environment') ?? 'production',
      },
      effectiveValue: true,
      effectiveVersion: 'rollout:3',
      provenance: [
        {
          precedence: 100,
          sourceType: 'ACTIVE_ROLLOUT',
          sourceScope: 'TENANT',
          sourceId: 'WORKFORCE_EXPORT_V2:revision-3',
          version: '3',
          locked: true,
          decisionCode: 'ROLLOUT_MATCH',
          decidedAt: '2026-08-11T00:00:00Z',
        },
      ],
      applicationStatus: {
        state: 'OBSERVATION_UNSUPPORTED',
        desiredState: 'PUBLISHED',
        desiredVersion: 'rollout:3',
        publishedVersion: 'rollout:3',
        uniformlyObservedVersion: null,
        expectedTargetCount: 0,
        observedTargetCount: 0,
        convergedTargetCount: 0,
        failedTargetCount: 0,
        driftedTargetCount: 0,
        publishAcceptedAt: '2026-08-11T00:00:00Z',
        latestObservationAt: null,
        stale: false,
      },
      reasonCode: 'RESOLVED',
      resolvedAt: '2026-08-11T00:01:00Z',
    });
  });
}

async function capture(page: Page, testInfo: TestInfo, name: string) {
  const viewport = testInfo.project.name === 'mobile' ? '390' : '1440';
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    // Full-page stitching can paint the normally off-canvas skip link between scroll segments.
    // Keep the evidence aligned with the unfocused state users see on page load.
    const skipLink = document.querySelector<HTMLElement>('a[href="#dwp-main-content"]');
    if (skipLink) skipLink.style.visibility = 'hidden';
    // The shared development server can inject vite-plugin-checker's diagnostics badge when
    // another dirty-worktree task has an unrelated lint error. It is not part of the product UI.
    for (const button of document.querySelectorAll('button')) {
      if (/❗.*\d+.*⚠.*\d+/.test(button.textContent ?? '')) {
        button.style.visibility = 'hidden';
      }
    }
  });
  await page.screenshot({
    path: `${EVIDENCE_DIRECTORY}/${name}-${viewport}.png`,
    fullPage: true,
    animations: 'disabled',
  });
}

type ProviderEvidenceVariant = {
  name: string;
  viewport: { width: number; height: number };
  mode: 'light' | 'dark';
  highContrast: boolean;
  forcedColors?: 'active';
  zoom?: number;
};

const PROVIDER_EVIDENCE_VARIANTS: ProviderEvidenceVariant[] = [
  {
    name: 'desktop-1440',
    viewport: { width: 1440, height: 900 },
    mode: 'light',
    highContrast: false,
  },
  {
    name: 'desktop-1280-dark',
    viewport: { width: 1280, height: 900 },
    mode: 'dark',
    highContrast: false,
  },
  {
    name: 'mobile-390-high-contrast',
    viewport: { width: 390, height: 844 },
    mode: 'light',
    highContrast: true,
    forcedColors: 'active',
  },
  {
    name: 'mobile-320',
    viewport: { width: 320, height: 740 },
    mode: 'light',
    highContrast: false,
  },
  {
    name: 'css-zoom-200',
    viewport: { width: 1280, height: 900 },
    mode: 'light',
    highContrast: false,
    zoom: 2,
  },
];

async function configureEvidenceVariant(page: Page, variant: ProviderEvidenceVariant) {
  await page.setViewportSize(variant.viewport);
  await page.emulateMedia({
    colorScheme: variant.mode,
    forcedColors: variant.forcedColors ?? 'none',
    reducedMotion: 'reduce',
  });
  await page.addInitScript(
    ({ mode, highContrast }) => {
      const appearance = {
        mode,
        density: 'standard',
        highContrast,
        reduceMotion: true,
      };
      window.localStorage.setItem('dwp.appearance.v1', JSON.stringify(appearance));
      window.localStorage.setItem(
        'dwp.provider-realm-preference.v2:realm:DWP_PROVIDER:user:1',
        JSON.stringify({
          preferences: {
            appearance: { mode, density: 'standard' },
            accessibility: {
              highContrast,
              reduceMotion: true,
              underlineLinks: false,
              reduceTransparency: false,
            },
          },
          updatedAt: '2026-08-11T00:00:00Z',
        })
      );
    },
    { mode: variant.mode, highContrast: variant.highContrast }
  );
  if (variant.zoom) {
    await page.addInitScript((zoom) => {
      const applyZoom = () => {
        document.documentElement.style.zoom = String(zoom);
      };
      if (document.documentElement) applyZoom();
      else document.addEventListener('DOMContentLoaded', applyZoom, { once: true });
    }, variant.zoom);
  }
}

async function captureMatrixEvidence(
  page: Page,
  testInfo: TestInfo,
  journey: string,
  variant: ProviderEvidenceVariant
) {
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    const skipLink = document.querySelector<HTMLElement>('a[href="#dwp-main-content"]');
    if (skipLink) skipLink.style.visibility = 'hidden';
    for (const button of document.querySelectorAll('button')) {
      if (/❗.*\d+.*⚠.*\d+/.test(button.textContent ?? '')) {
        button.style.visibility = 'hidden';
      }
    }
  });
  const evidencePath = `${EVIDENCE_DIRECTORY}/${journey}-${variant.name}.png`;
  await page.screenshot({ path: evidencePath, fullPage: true, animations: 'disabled' });
  await testInfo.attach(`${journey}-${variant.name}`, {
    path: evidencePath,
    contentType: 'image/png',
  });
}

async function expectNoHorizontalOverflow(page: Page, name: string) {
  const geometry = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(
    geometry.content,
    `${name}: document width ${geometry.content}px exceeds ${geometry.viewport}px`
  ).toBeLessThanOrEqual(geometry.viewport + 1);
}

test.beforeAll(async () => {
  await mkdir(EVIDENCE_DIRECTORY, { recursive: true });
});

test.beforeEach(async ({ page }, testInfo) => {
  await page.clock.install({ time: new Date('2026-08-11T00:00:00Z') });
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.setViewportSize(
    testInfo.project.name === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 900 }
  );
  await mockShellSession(page, ['PROVIDER_ADMIN'], {
    identityPlane: 'PROVIDER',
    locale: 'en',
    permissions: [...FULL_PRODUCT_PERMISSIONS],
    appearance: {
      mode: 'light',
      density: 'standard',
      highContrast: false,
      reduceMotion: true,
    },
  });
  await mockProviderSettings(page);
  await mockProviderGovernance(page);
});

test('S09 command center binds the headline to operational evidence', async ({
  page,
}, testInfo) => {
  await page.goto('/provider/overview');

  await expect(page.getByRole('heading', { name: 'Operations command center' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Operations command scope' })).toContainText(
    'All customer environments'
  );
  await expect(page.getByRole('heading', { name: 'Operational review is required' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Global operating metrics' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Priority action queue' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Service portfolio health' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Service reliability and error budget' })
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Deployment cell capacity' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Recent privileged activity' })).toBeVisible();
  const reviewFilter = page.getByRole('button', { name: 'Review', exact: true });
  await reviewFilter.focus();
  await reviewFilter.press('Space');
  await expect(page.getByText('Tenant upgrade', { exact: true })).toBeVisible();
  await expectNoSeriousAxeViolations(page);
  await expectNoHorizontalOverflow(page, 'S09');
  await capture(page, testInfo, 'S09-command-center');
});

test('S10 tenant and commercial views separate assignments from metered usage', async ({
  page,
}, testInfo) => {
  await page.goto('/provider/tenants/tenant-skax?tab=entitlements');

  await expect(page.getByRole('heading', { name: 'SKAX Production', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Tenant 360 scope' })).toContainText(
    'ap-northeast-2 / Dedicated bridge'
  );
  await expect(
    page.getByRole('heading', { name: 'The tenant meets operational readiness criteria' })
  ).toBeVisible();
  await expect(page.getByText('Product access for SKAX Production')).toBeVisible();
  await expectNoHorizontalOverflow(page, 'S10 tenant detail');
  await capture(page, testInfo, 'S10-tenant-entitlements');

  await page.goto('/provider/commercial');
  await expect(
    page.getByRole('heading', { name: 'Subscriptions & entitlements', exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Customer subscriptions & renewals' })
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Service plan portfolio' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Entitlement adoption' })).toBeVisible();
  await expect(
    page.getByText(
      /Measured usage, cost, and budget are unavailable until an authoritative metering source is connected/
    )
  ).toBeVisible();
  await expectNoHorizontalOverflow(page, 'S10 commercial');
  await capture(page, testInfo, 'S10-commercial-boundary');

  await page.goto('/provider/resource-governance');
  await expect(page.getByRole('heading', { name: 'Resource commitments', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Resource change review queue' })).toBeVisible();
  await expect(page.getByText(/provider-owned internal evidence/i)).toBeVisible();
  const resourceRow = page.getByRole('row', { name: /API_CALLS/ });
  await resourceRow.getByRole('gridcell').first().focus();
  await resourceRow.getByRole('gridcell').first().press('Enter');
  await expect(page.getByRole('heading', { name: 'API_CALLS', exact: true })).toBeVisible();
  await expectNoSeriousAxeViolations(page);
  await expectNoHorizontalOverflow(page, 'S10 resource governance');
});

test('S10 labels a bounded resource ledger as partial evidence', async ({ page }) => {
  await page.route(
    '**/api/provider/v1/admin/resource-governance/tenants/*/commitments/*/ledger?*',
    (route) =>
      success(route, {
        items: [
          {
            ledgerEntryId: '63000000-0000-0000-0000-000000000001',
            entryType: 'METER',
            amount: 25000,
            unit: 'REQUEST',
            evidenceRef: 'internal-meter-20260810',
            reason: 'Daily internal usage observation',
            occurredAt: '2026-08-10T23:55:00Z',
          },
        ],
        limit: 100,
        hasMore: true,
      })
  );

  await page.goto('/provider/resource-governance');
  await page
    .getByRole('row', { name: /API_CALLS/ })
    .getByRole('gridcell')
    .first()
    .press('Enter');
  await expect(page.getByText(/Showing the newest 1 ledger entries/)).toBeVisible();
});

test('S10 request owner cancels a current tenant lifecycle request with audit reason', async ({
  page,
}, testInfo) => {
  await page.goto('/provider/resource-governance');

  const lifecycleSection = page.getByRole('heading', {
    name: 'Tenant retirement and purge governance',
  });
  await expect(lifecycleSection).toBeVisible();
  await page.getByRole('button', { name: 'Cancel request', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Cancel tenant lifecycle request' })
  ).toBeVisible();
  await page.getByRole('textbox', { name: 'Reason' }).fill('Customer retained the tenant');
  await page.getByRole('button', { name: 'Cancel request', exact: true }).click();

  await expect(page.getByText('Cancelled', { exact: true })).toBeVisible();
  await expect(page.getByText(/No owner execution required/)).toBeVisible();
  await expect(page.getByText(/Recorded reason: Customer retained the tenant/)).toBeVisible();
  await expectNoSeriousAxeViolations(page);
  await expectNoHorizontalOverflow(page, 'S10 lifecycle cancellation');
  await capture(page, testInfo, 'S10-lifecycle-cancellation');
});

test('S11 exposes effective value, provenance, and unsupported observation honestly', async ({
  page,
}, testInfo) => {
  await page.goto('/provider/feature-rollouts');

  await expect(
    page.getByRole('heading', { name: 'Effective configuration and application state' })
  ).toBeVisible();
  await expect(page.getByText('Desired state', { exact: true })).toBeVisible();
  await expect(page.getByText('Current effective value', { exact: true })).toBeVisible();
  await expect(page.getByText('Observed application', { exact: true })).toBeVisible();
  await expect(page.getByText('Value provenance', { exact: true })).toBeVisible();
  await expect(page.getByText('Application observation unsupported')).toBeVisible();
  await expect(page.getByText(/no application receipt connector is available/i)).toBeVisible();
  await expectNoHorizontalOverflow(page, 'S11');
  await capture(page, testInfo, 'S11-effective-configuration');
});

test('S12 preserves rollout, incident, and time-bound support control paths', async ({
  page,
}, testInfo) => {
  await page.goto('/provider/feature-rollouts');
  await expect(page.getByRole('heading', { name: 'Rollout revisions' })).toBeVisible();
  const rolloutRow = page.getByRole('row', { name: /Pilot ring rollout/ });
  await expect(rolloutRow).toBeVisible();
  await rolloutRow.getByRole('gridcell').first().focus();
  await rolloutRow.getByRole('gridcell').first().press('Enter');
  await expect(page.getByRole('heading', { name: 'Pilot ring rollout' })).toBeVisible();
  await expect(
    page.getByText(/different authorized operator must approve or reject/i)
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Approve rollout' })).toHaveCount(0);
  await expectNoSeriousAxeViolations(page);

  await page.goto('/provider/health');
  await expect(
    page.getByRole('heading', { name: 'Service operations', exact: true })
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Customer-impacting incidents' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Service health matrix' })).toBeVisible();
  await expect(page.getByText('Workspace latency elevated in Seoul cell')).toBeVisible();
  await expectNoHorizontalOverflow(page, 'S12 incidents');
  await capture(page, testInfo, 'S12-incidents');

  await page.goto('/provider/support');
  await expect(
    page.getByRole('heading', { name: 'Privileged support', exact: true })
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Support access lifecycle' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Active and historical sessions' })).toBeVisible();
  await expect(
    page.getByText('Preview redacted tenant experience configuration').first()
  ).toBeVisible();
  await expectNoHorizontalOverflow(page, 'S12 support');
  await capture(page, testInfo, 'S12-support-access');
});

test('S15 stages configuration while keeping software distribution unavailable', async ({
  page,
}, testInfo) => {
  await page.goto('/provider/feature-rollouts');

  await expect(
    page.getByRole('region', { name: 'Feature rollout operating boundary' })
  ).toContainText('External execution');
  await expect(
    page.getByRole('region', { name: 'Feature rollout operating boundary' })
  ).toContainText('Locked until D-13 approval');
  await expect(
    page.getByText(
      /Application binaries, packages, and database schemas cannot be distributed here/
    )
  ).toBeVisible();
  await page.getByRole('row', { name: /Pilot ring rollout/ }).click();
  await expect(page.getByRole('heading', { name: 'Pilot ring rollout' })).toBeVisible();
  await expect(page.getByText('Stages and health gates')).toBeVisible();
  await expect(page.getByText('External execution locked')).toBeVisible();
  await expect(
    page.getByRole('button', { name: /deploy application|deploy package|run schema/i })
  ).toHaveCount(0);
  await expectNoHorizontalOverflow(page, 'S15');
  await capture(page, testInfo, 'S15-configuration-rollout-boundary');

  await page.goto('/provider/artifact-governance');
  await expect(
    page.getByText(
      /registry signing, package distribution, and deployment execution are unavailable/i
    )
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /deploy application|deploy package|run schema/i })
  ).toHaveCount(0);
  await expect(
    page.getByText(/manifest json|compatibility policy json|target scope json/i)
  ).toHaveCount(0);
  await expect(
    page.getByText(/different authorized operator must review this artifact/i)
  ).toBeVisible();
  await expect(
    page.getByText(/different authorized operator must decide this rollout plan/i)
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Approve artifact' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Approve rollout plan' })).toHaveCount(0);
  await expect(
    page.getByText(/Showing 0 evidence records from the owner limit of 50/)
  ).toBeVisible();
  const artifactButton = page.getByRole('button', { name: /WORKSPACE_AGENT · 2\.6\.0/ });
  await artifactButton.focus();
  await artifactButton.press('Space');
  await expect(
    page.getByRole('heading', { name: 'WORKSPACE_AGENT · 2.6.0', exact: true })
  ).toBeVisible();
  await expect(page.getByText(/Showing 0 reviews from the owner limit of 50/)).toBeVisible();
  await expectNoSeriousAxeViolations(page);
  await expectNoHorizontalOverflow(page, 'S15 artifact governance');
});

test('S16 keeps plan, approval, execution, and evidence as separate states', async ({
  page,
}, testInfo) => {
  await page.goto('/provider/operations');

  await expect(page.getByRole('heading', { name: 'Change control', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Change approval queue' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Control path' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Change execution ledger' })).toBeVisible();
  const operationRow = page.getByRole('row', { name: /operation-1/ });
  await operationRow.getByRole('gridcell').first().focus();
  await operationRow.getByRole('gridcell').first().press('Enter');

  const review = page.getByRole('dialog', { name: 'Review change plan' });
  await expect(review).toBeVisible();
  await expect(review.getByText('Execution impact')).toBeVisible();
  await expect(review.getByText('Approval gates')).toBeVisible();
  await expect(review.getByRole('heading', { name: 'Execution evidence' })).toBeVisible();
  await expect(review.getByText('Execution steps')).toBeVisible();
  await expect(review.getByText('Immutable plan hash')).toBeVisible();
  await expectNoSeriousAxeViolations(page, '[role="dialog"]');
  await expectNoHorizontalOverflow(page, 'S16');
  await capture(page, testInfo, 'S16-governed-change-review');
});

test('S15 preserves cached artifact evidence when rollout plans fail', async ({ page }) => {
  await page.route('**/api/provider/v1/admin/artifact-governance/rollout-plans', async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ERROR', message: 'owner unavailable' }),
    });
  });

  await page.goto('/provider/artifact-governance');

  await expect(page.getByText('WORKSPACE_CORE · 2.5.0').first()).toBeVisible();
  await expect(page.getByText(/rollout plans could not be loaded/i)).toBeVisible();
  await expect(page.getByText('Unavailable', { exact: true }).first()).toBeVisible();
  await expectNoSeriousAxeViolations(page);
});

for (const variant of PROVIDER_EVIDENCE_VARIANTS) {
  test(`Provider settings evidence matrix renders S09-S16 at ${variant.name}`, async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'chromium',
      'The canonical evidence matrix is captured once in Chromium.'
    );
    test.setTimeout(240_000);
    await configureEvidenceVariant(page, variant);

    const expectVariantApplied = async () => {
      await expect(page.locator('html')).toHaveAttribute('data-color-scheme', variant.mode);
      await expect(page.locator('html')).toHaveAttribute(
        'data-contrast',
        variant.highContrast ? 'high' : 'standard'
      );
      if (variant.zoom) {
        expect(await page.evaluate(() => document.documentElement.style.zoom)).toBe(
          String(variant.zoom)
        );
      }
    };

    await test.step('S09 command center', async () => {
      await page.goto('/provider/overview');
      await expectVariantApplied();
      await expect(page.getByRole('heading', { name: 'Operations command center' })).toBeVisible();
      const reviewFilter = page.getByRole('button', { name: 'Review', exact: true });
      await reviewFilter.focus();
      await reviewFilter.press('Space');
      await expect(page.getByText('Tenant upgrade', { exact: true })).toBeVisible();
      await expectNoSeriousAxeViolations(page);
      await expectNoHorizontalOverflow(page, `S09 ${variant.name}`);
      await captureMatrixEvidence(page, testInfo, 'S09-command-center', variant);
    });

    await test.step('S10 resource commitment governance', async () => {
      await page.goto('/provider/resource-governance');
      await expectVariantApplied();
      await expect(
        page.getByRole('heading', { name: 'Resource commitments', level: 1 })
      ).toBeVisible();
      const resourceRow = page.getByRole('row', { name: /API_CALLS/ });
      await expect(resourceRow).toBeVisible();
      const resourceCell = resourceRow.getByRole('gridcell').first();
      await resourceCell.focus();
      await resourceCell.press('Enter');
      await expect(page.getByRole('heading', { name: 'API_CALLS', exact: true })).toBeVisible();
      await expectNoSeriousAxeViolations(page);
      await expectNoHorizontalOverflow(page, `S10 ${variant.name}`);
      await captureMatrixEvidence(page, testInfo, 'S10-resource-governance', variant);
    });

    await test.step('S10 tenant detail and entitlement governance', async () => {
      await page.goto('/provider/tenants');
      await expectVariantApplied();
      const tenantRow = page.getByRole('row', { name: /SKAX Production/ });
      await expect(tenantRow).toBeVisible();
      const tenantCell = tenantRow.getByRole('gridcell').nth(1);
      await tenantCell.focus();
      await tenantCell.press('Enter');
      await expect(page).toHaveURL(/\/provider\/tenants\/tenant-skax$/);
      await page.goto('/provider/tenants/tenant-skax?tab=entitlements');
      await expect(
        page.getByRole('heading', { name: 'SKAX Production', exact: true })
      ).toBeVisible();
      await expect(page.getByText('Product access for SKAX Production')).toBeVisible();
      await expectNoSeriousAxeViolations(page);
      await expectNoHorizontalOverflow(page, `S10 tenant detail ${variant.name}`);
      await captureMatrixEvidence(page, testInfo, 'S10-tenant-entitlements', variant);
    });

    await test.step('S10 commercial renewal governance', async () => {
      await page.goto('/provider/commercial');
      await expectVariantApplied();
      await expect(
        page.getByRole('heading', { name: 'Customer subscriptions & renewals' })
      ).toBeVisible();
      const publishedRenewal = page.getByRole('row').filter({ hasText: 'Revision 1' });
      await expect(publishedRenewal).toBeVisible();
      const renewalCell = publishedRenewal.getByRole('gridcell').first();
      await renewalCell.focus();
      await renewalCell.press('Enter');
      await expect(page.getByRole('complementary').filter({ hasText: 'Revision 1' })).toContainText(
        'Published'
      );
      await expectNoSeriousAxeViolations(page);
      await expectNoHorizontalOverflow(page, `S10 commercial ${variant.name}`);
      await captureMatrixEvidence(page, testInfo, 'S10-commercial-renewals', variant);
    });

    await test.step('S11 effective settings resolution', async () => {
      await page.goto('/provider/feature-rollouts');
      await expectVariantApplied();
      await expect(
        page.getByRole('heading', { name: 'Effective configuration and application state' })
      ).toBeVisible();
      await expect(page.getByText('Application observation unsupported')).toBeVisible();
      await expectNoSeriousAxeViolations(page);
      await expectNoHorizontalOverflow(page, `S11 ${variant.name}`);
      await captureMatrixEvidence(page, testInfo, 'S11-settings-resolution', variant);
    });

    await test.step('S12 governed feature rollout', async () => {
      await page.goto('/provider/feature-rollouts');
      await expectVariantApplied();
      const rolloutRow = page.getByRole('row', { name: /Pilot ring rollout/ });
      await expect(rolloutRow).toBeVisible();
      const rolloutCell = rolloutRow.getByRole('gridcell').first();
      await rolloutCell.focus();
      await rolloutCell.press('Enter');
      await expect(page.getByRole('heading', { name: 'Pilot ring rollout' })).toBeVisible();
      await expect(
        page.getByText(/different authorized operator must approve or reject/i)
      ).toBeVisible();
      await expectNoSeriousAxeViolations(page);
      await expectNoHorizontalOverflow(page, `S12 ${variant.name}`);
      await captureMatrixEvidence(page, testInfo, 'S12-feature-rollout', variant);
    });

    await test.step('S12 incident and reliability governance', async () => {
      await page.goto('/provider/health');
      await expectVariantApplied();
      await expect(
        page.getByRole('heading', { name: 'Service operations', exact: true })
      ).toBeVisible();
      const updateIncident = page.getByRole('button', { name: 'Update state' }).first();
      await updateIncident.focus();
      await updateIncident.press('Space');
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.keyboard.press('Escape');
      await expectNoSeriousAxeViolations(page);
      await expectNoHorizontalOverflow(page, `S12 health ${variant.name}`);
      await captureMatrixEvidence(page, testInfo, 'S12-service-health', variant);
    });

    await test.step('S12 privileged support governance', async () => {
      await page.goto('/provider/support');
      await expectVariantApplied();
      await expect(
        page.getByRole('heading', { name: 'Privileged support', exact: true })
      ).toBeVisible();
      const approveSupport = page.getByRole('button', { name: 'Approve', exact: true }).first();
      await approveSupport.focus();
      await approveSupport.press('Enter');
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.keyboard.press('Escape');
      await expectNoSeriousAxeViolations(page);
      await expectNoHorizontalOverflow(page, `S12 support ${variant.name}`);
      await captureMatrixEvidence(page, testInfo, 'S12-privileged-support', variant);
    });

    await test.step('S15 artifact governance', async () => {
      await page.goto('/provider/artifact-governance');
      await expectVariantApplied();
      await expect(
        page.getByRole('heading', { name: 'Artifact & rollout governance', level: 1 })
      ).toBeVisible();
      const artifactButton = page.getByRole('button', { name: /WORKSPACE_AGENT · 2\.6\.0/ });
      await expect(artifactButton).toBeVisible();
      await artifactButton.focus();
      await artifactButton.press('Space');
      await expect(
        page.getByRole('heading', { name: 'WORKSPACE_AGENT · 2.6.0', exact: true })
      ).toBeVisible();
      await expectNoSeriousAxeViolations(page);
      await expectNoHorizontalOverflow(page, `S15 ${variant.name}`);
      await captureMatrixEvidence(page, testInfo, 'S15-artifact-governance', variant);
    });

    await test.step('S16 governed operation review', async () => {
      await page.goto('/provider/operations');
      await expectVariantApplied();
      await expect(
        page.getByRole('heading', { name: 'Change control', exact: true })
      ).toBeVisible();
      const operationRow = page.getByRole('row', { name: /operation-1/ });
      await expect(operationRow).toBeVisible();
      const operationCell = operationRow.getByRole('gridcell').first();
      await operationCell.focus();
      await operationCell.press('Enter');
      await expect(page.getByRole('dialog', { name: 'Review change plan' })).toBeVisible();
      await expectNoSeriousAxeViolations(page, '[role="dialog"]');
      await expectNoHorizontalOverflow(page, `S16 ${variant.name}`);
      await captureMatrixEvidence(page, testInfo, 'S16-operation-review', variant);
    });
  });
}
