import { mkdir } from 'node:fs/promises';

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

import { FULL_PRODUCT_PERMISSIONS, mockShellSession } from './support/shell-session';

const EVIDENCE_DIRECTORY =
  '/Users/a10697/Work/DWP/output/admin-settings-implementation-2026-09-17/screenshots';

const viewports = [
  { name: '1440', width: 1440, height: 900 },
  { name: '1280', width: 1280, height: 800 },
  { name: '390', width: 390, height: 844 },
  { name: '320', width: 320, height: 720 },
  // 1,440 physical pixels at 200% browser zoom expose a 720 CSS-pixel viewport.
  { name: 'zoom-200-equivalent', width: 720, height: 450 },
] as const;

const surfaces = [
  {
    key: 'personal-settings',
    path: '/account/settings',
    heading: 'Personal settings',
    roles: ['WORKSPACE_MEMBER'],
    identityPlane: 'TENANT',
  },
  {
    key: 'company-settings',
    path: '/admin',
    heading: 'Company settings',
    roles: ['TENANT_ADMIN'],
    identityPlane: 'TENANT',
  },
  {
    key: 'provider-feature-rollouts',
    path: '/provider/feature-rollouts',
    heading: 'Feature rollout control',
    roles: ['PROVIDER_ADMIN'],
    identityPlane: 'PROVIDER',
  },
] as const;

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

async function mockProviderSettings(
  page: Page,
  state:
    'observation-unsupported' | 'catalog-denied' | 'effective-error' = 'observation-unsupported'
) {
  await page.route('**/api/provider/v1/admin/settings**', async (route) => {
    const url = new URL(route.request().url());
    const effective = url.pathname.endsWith('/effective');

    if (!effective && state === 'catalog-denied') {
      return route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ERROR', message: 'Forbidden', data: null }),
      });
    }
    if (effective && state === 'effective-error') {
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ERROR', message: 'Owner unavailable', data: null }),
      });
    }
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
          decidedAt: '2026-09-17T01:00:00Z',
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
        publishAcceptedAt: '2026-09-17T01:00:00Z',
        latestObservationAt: null,
        stale: false,
      },
      reasonCode: 'RESOLVED',
      resolvedAt: '2026-09-17T01:01:00Z',
    });
  });
}

async function prepareSurface(page: Page, surface: (typeof surfaces)[number]) {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await mockShellSession(page, [...surface.roles], {
    identityPlane: surface.identityPlane,
    locale: 'en',
    permissions: [...FULL_PRODUCT_PERMISSIONS],
    appearance: {
      mode: 'light',
      density: 'standard',
      highContrast: false,
      reduceMotion: true,
    },
  });
  if (surface.identityPlane === 'PROVIDER') await mockProviderSettings(page);
}

async function expectNoHorizontalOverflow(page: Page, context: string) {
  const geometry = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(
    geometry.scrollWidth,
    `${context}: document width ${geometry.scrollWidth}px exceeds ${geometry.clientWidth}px`
  ).toBeLessThanOrEqual(geometry.clientWidth + 1);
}

async function expectKeyboardFocusInMain(page: Page, context: string) {
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });

  let focus: { tagName: string; label: string; visible: boolean; focusVisible: boolean } | null =
    null;
  for (let index = 0; index < 40; index += 1) {
    await page.keyboard.press('Tab');
    focus = await page.evaluate(() => {
      const active = document.activeElement;
      const main = document.querySelector('main');
      if (!(active instanceof HTMLElement) || !main?.contains(active)) return null;
      const rect = active.getBoundingClientRect();
      return {
        tagName: active.tagName,
        label:
          active.getAttribute('aria-label') ||
          active.textContent?.trim().slice(0, 120) ||
          active.getAttribute('name') ||
          '',
        visible: rect.width > 0 && rect.height > 0,
        focusVisible: active.matches(':focus-visible'),
      };
    });
    if (focus) break;
  }

  expect(focus, `${context}: keyboard navigation never reached the main content`).not.toBeNull();
  expect(focus?.visible, `${context}: focused control has no visible geometry`).toBe(true);
  expect(focus?.focusVisible, `${context}: focused control does not match :focus-visible`).toBe(
    true
  );
}

async function expectNoSeriousAccessibilityViolations(page: Page, context: string) {
  const result = await new AxeBuilder({ page }).include('main').analyze();
  const blocking = result.violations.filter(
    (violation) => violation.impact === 'critical' || violation.impact === 'serious'
  );
  expect(blocking, `${context}: serious or critical accessibility violations`).toEqual([]);
}

test.beforeAll(async () => {
  await mkdir(EVIDENCE_DIRECTORY, { recursive: true });
});

for (const surface of surfaces) {
  for (const viewport of viewports) {
    test(`${surface.key} is usable at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await prepareSurface(page, surface);
      await page.goto(surface.path);

      await expect(page.getByRole('heading', { name: surface.heading, level: 1 })).toBeVisible();
      if (surface.key === 'provider-feature-rollouts') {
        await expect(
          page.getByRole('heading', {
            name: 'Effective configuration and application state',
          })
        ).toBeVisible();
        await expect(page.getByText('Application observation unsupported')).toBeVisible();
        await expect(
          page.getByText(/no application receipt connector is available/i)
        ).toBeVisible();
      }

      await expectNoHorizontalOverflow(page, `${surface.key} ${viewport.name}`);
      await expectKeyboardFocusInMain(page, `${surface.key} ${viewport.name}`);
      await expectNoSeriousAccessibilityViolations(page, `${surface.key} ${viewport.name}`);
      await page.screenshot({
        path: `${EVIDENCE_DIRECTORY}/${surface.key}-${viewport.name}.png`,
        fullPage: true,
        animations: 'disabled',
      });
    });
  }
}

test('provider settings catalog shows a permission-safe state', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await mockShellSession(page, ['PROVIDER_ADMIN'], {
    identityPlane: 'PROVIDER',
    locale: 'en',
    permissions: [...FULL_PRODUCT_PERMISSIONS],
  });
  await mockProviderSettings(page, 'catalog-denied');

  await page.goto('/provider/feature-rollouts');
  await expect(
    page.getByText('You do not have permission to read the configuration catalog.')
  ).toBeVisible();
  await expect(
    page
      .getByText('You do not have permission to read the configuration catalog.')
      .getByRole('button', { name: 'Retry' })
  ).toHaveCount(0);
  await expectNoHorizontalOverflow(page, 'provider settings catalog permission state');
  await expectNoSeriousAccessibilityViolations(page, 'provider settings catalog permission state');
  await page.screenshot({
    path: `${EVIDENCE_DIRECTORY}/provider-settings-catalog-permission-denied.png`,
    fullPage: true,
    animations: 'disabled',
  });
});

test('provider settings keeps the catalog visible when effective resolution fails', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await mockShellSession(page, ['PROVIDER_ADMIN'], {
    identityPlane: 'PROVIDER',
    locale: 'en',
    permissions: [...FULL_PRODUCT_PERMISSIONS],
  });
  await mockProviderSettings(page, 'effective-error');

  await page.goto('/provider/feature-rollouts');
  await expect(page.getByRole('heading', { name: 'Governed workforce export' })).toBeVisible();
  await expect(page.getByText(/target setting could not be resolved/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
  await expectNoHorizontalOverflow(page, 'provider effective-setting error state');
  await expectNoSeriousAccessibilityViolations(page, 'provider effective-setting error state');
  await page.screenshot({
    path: `${EVIDENCE_DIRECTORY}/provider-settings-effective-error.png`,
    fullPage: true,
    animations: 'disabled',
  });
});
