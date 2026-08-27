import { expect, test } from '@playwright/test';

import { mockShellSession } from './support/shell-session';

import type { Page, Route } from '@playwright/test';

const unavailableBody = JSON.stringify({
  success: false,
  code: 'PROVIDER_DEPENDENCY_UNAVAILABLE',
  message: 'Unavailable',
});

async function fulfillUnavailable(route: Route) {
  await route.fulfill({
    status: 503,
    contentType: 'application/json',
    body: unavailableBody,
  });
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        content: document.documentElement.scrollWidth,
      }))
    )
    .toEqual(
      expect.objectContaining({
        viewport: expect.any(Number),
        content: expect.any(Number),
      })
    );

  const geometry = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(geometry.content).toBeLessThanOrEqual(geometry.viewport);
}

test.beforeEach(async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize(
    testInfo.project.name === 'mobile' ? { width: 320, height: 720 } : { width: 1280, height: 800 }
  );
  await mockShellSession(page, ['PROVIDER_ADMIN'], {
    identityPlane: 'PROVIDER',
    locale: 'en',
    appearance: {
      mode: 'light',
      density: 'standard',
      highContrast: false,
      reduceMotion: true,
    },
  });
});

test('command center isolates a reliability outage without inventing a zero-risk signal', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-08-11T00:00:30Z'));
  await page.route('**/api/provider/v1/admin/reliability-control', fulfillUnavailable);

  await page.goto('/provider/overview');

  await expect(page.getByRole('heading', { name: 'Operations command center' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Global operating metrics' })).toBeVisible();
  await expect(page.getByText('Reliability snapshot is unavailable')).toBeVisible();
  await expect(
    page.getByText(
      'Only reliability details are unavailable. Other operational information remains available.'
    )
  ).toBeVisible();
  await expect(page.getByText('1 support access · unavailable at-risk SLOs')).toBeVisible();
  await expect(page.getByText('0 at-risk SLOs', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('tenant estate remains usable while onboarding catalogs are unavailable and retryable', async ({
  page,
}) => {
  let entitlementRequests = 0;
  let regionRequests = 0;
  await page.route('**/api/provider/v1/admin/entitlements', async (route) => {
    entitlementRequests += 1;
    await fulfillUnavailable(route);
  });
  await page.route('**/api/provider/v1/admin/regions', async (route) => {
    regionRequests += 1;
    await fulfillUnavailable(route);
  });

  await page.goto('/provider/tenants');

  await expect(page.getByRole('heading', { name: 'Tenant estate', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Customer estate scope' })).toContainText(
    '12 companies · 18 tenants'
  );
  await expect(page.getByRole('row', { name: /SKAX Production/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Onboard company' })).toBeDisabled();

  const catalogAlert = page.getByRole('alert').filter({
    hasText:
      'The customer estate remains available, but onboarding is disabled until the entitlement and region catalogs recover.',
  });
  await expect(catalogAlert).toBeVisible();
  const initialEntitlementRequests = entitlementRequests;
  const initialRegionRequests = regionRequests;
  await catalogAlert.getByRole('button', { name: 'Retry' }).click();
  await expect.poll(() => entitlementRequests).toBeGreaterThan(initialEntitlementRequests);
  await expect.poll(() => regionRequests).toBeGreaterThan(initialRegionRequests);
  await expect(page.getByRole('row', { name: /SKAX Production/ })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('tenant 360 localizes entitlement and support-ledger outages to their tabs', async ({
  page,
}) => {
  await page.route('**/api/provider/v1/admin/entitlements', fulfillUnavailable);
  await page.route('**/api/provider/v1/admin/support-sessions*', fulfillUnavailable);

  await page.goto('/provider/tenants/tenant-skax?tab=entitlements');

  await expect(page.getByRole('heading', { name: 'SKAX Production', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Tenant 360 scope' })).toContainText(
    'ap-northeast-2 / Bridge'
  );
  await expect(page.getByRole('region', { name: 'Tenant readiness signals' })).toBeVisible();
  await expect(page.getByText('Support session count unavailable')).toBeVisible();
  await expect(page.getByText('Product access for SKAX Production')).toBeVisible();
  await expect(
    page.getByRole('alert').filter({
      hasText:
        'The governed entitlement catalog is unavailable. Existing tenant state remains visible, but entitlement changes are disabled.',
    })
  ).toBeVisible();

  await page.getByRole('tab', { name: 'Support access' }).click();
  await expect(page).toHaveURL(/tab=support/);
  await expect(page.getByRole('heading', { name: 'SKAX Production', exact: true })).toBeVisible();
  await expect(page.getByText('Tenant support sessions')).toBeVisible();
  await expect(
    page.getByRole('alert').filter({
      hasText:
        'The privileged support ledger is unavailable. Other tenant detail remains available.',
    })
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('comparison resolves off-page tenant IDs and preserves recovery controls across total and partial failure', async ({
  page,
}) => {
  const requestedTenantIds = new Set<string>();
  let skaxAvailable = false;
  await page.route('**/api/provider/v1/admin/tenants/*', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const tenantId = decodeURIComponent(path.slice(path.lastIndexOf('/') + 1));
    if (!['tenant-skax', 'tenant-acme'].includes(tenantId)) return route.fallback();
    requestedTenantIds.add(tenantId);
    if (tenantId === 'tenant-skax' && skaxAvailable) return route.fallback();
    await fulfillUnavailable(route);
  });

  await page.goto('/provider/tenants?page=5&compare=tenant-skax,tenant-acme');

  await expect(page.getByRole('row', { name: /Tenant 101 Production/ })).toBeVisible();
  const comparison = page.getByRole('region', { name: 'Tenant operations comparison' });
  await expect(comparison).toBeVisible();
  await expect(
    comparison.getByText(
      'None of the selected tenant records are available. Clear the comparison or retry later.'
    )
  ).toBeVisible();
  await expect(comparison.getByText('One or more selected tenants are unavailable')).toBeVisible();
  await expect(comparison.getByRole('button', { name: 'Clear comparison' })).toBeVisible();
  await expect(comparison.getByText('SKAX Production', { exact: true })).toHaveCount(0);
  await expect.poll(() => [...requestedTenantIds].sort()).toEqual(['tenant-acme', 'tenant-skax']);

  skaxAvailable = true;
  await page.reload();

  await expect(page.getByRole('row', { name: /Tenant 101 Production/ })).toBeVisible();
  await expect(
    comparison.getByText(
      '1 of 2 selected tenant records are available. The available comparison remains visible.'
    )
  ).toBeVisible();
  await expect(comparison.getByText('One or more selected tenants are unavailable')).toBeVisible();
  await expect(comparison.getByText('SKAX Production', { exact: true })).toBeVisible();
  await expect(comparison.getByText('Acme Production', { exact: true })).toHaveCount(0);
  await expect(comparison.getByRole('button', { name: 'Clear comparison' })).toBeVisible();

  await comparison.getByRole('button', { name: 'Clear comparison' }).click();
  await expect(page).not.toHaveURL(/(?:\?|&)compare=/);
  await expect(page.getByRole('region', { name: 'Tenant operations comparison' })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});
