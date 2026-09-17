import { mkdir } from 'node:fs/promises';

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
  await expectNoHorizontalOverflow(page, 'S09');
  await capture(page, testInfo, 'S09-command-center');
});

test('S10 tenant and commercial views separate assignments from metered usage', async ({
  page,
}, testInfo) => {
  await page.goto('/provider/tenants/tenant-skax?tab=entitlements');

  await expect(page.getByRole('heading', { name: 'SKAX Production', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Tenant 360 scope' })).toContainText(
    'ap-northeast-2 / Bridge'
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
  await expect(page.getByRole('row', { name: /Pilot ring rollout/ })).toBeVisible();

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
});

test('S16 keeps plan, approval, execution, and evidence as separate states', async ({
  page,
}, testInfo) => {
  await page.goto('/provider/operations');

  await expect(page.getByRole('heading', { name: 'Change control', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Change approval queue' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Control path' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Change execution ledger' })).toBeVisible();
  await page.getByRole('row', { name: /operation-1/ }).click();

  const review = page.getByRole('dialog', { name: 'Review change plan' });
  await expect(review).toBeVisible();
  await expect(review.getByText('Execution impact')).toBeVisible();
  await expect(review.getByText('Approval gates')).toBeVisible();
  await expect(review.getByText('Execution evidence')).toBeVisible();
  await expect(review.getByText('Execution steps')).toBeVisible();
  await expect(review.getByText('Immutable plan hash')).toBeVisible();
  await expectNoHorizontalOverflow(page, 'S16');
  await capture(page, testInfo, 'S16-governed-change-review');
});
