import { expect, test } from '@playwright/test';

import { fulfillSuccess, mockShellSession } from './support/shell-session';

test.beforeEach(async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize(
    testInfo.project.name === 'mobile' ? { width: 320, height: 720 } : { width: 1280, height: 800 }
  );
  await mockShellSession(page, ['PROVIDER_ADMIN'], {
    locale: 'en',
    appearance: {
      mode: 'light',
      density: 'standard',
      highContrast: false,
      reduceMotion: true,
    },
  });
});

test('provider search isolates source failure, audits evidence, and restores tenant route', async ({
  page,
}) => {
  const auditRequests: Array<Record<string, unknown>> = [];
  await page.route('**/api/platform/v1/search/audit', async (route) => {
    auditRequests.push(route.request().postDataJSON() as Record<string, unknown>);
    await fulfillSuccess(route, {
      eventId: `search-audit-${auditRequests.length}`,
      queryDigest: 'a'.repeat(64),
    });
  });
  await page.route('**/api/provider/v1/admin/audit-events**', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ERROR', message: 'Audit source unavailable' }),
    })
  );

  await page.goto('/provider/overview');
  await page.getByRole('button', { name: 'Search' }).click();
  const dialog = page.getByRole('dialog', { name: 'Search DWP' });
  const input = dialog.getByRole('combobox', { name: 'Search DWP' });
  await input.fill('SKAX Production');

  await expect(dialog.getByText(/Unavailable sources: Provider audit/)).toBeVisible();
  const tenantResult = dialog
    .getByRole('option', { name: /SKAX Production/ })
    .filter({ hasText: 'Provider tenants' });
  await expect(tenantResult).toContainText('Provider tenants');
  await expect.poll(() => auditRequests.some((request) => request.phase === 'QUERY')).toBe(true);

  await tenantResult.click();
  await expect(page).toHaveURL(/\/provider\/tenants\/tenant-skax$/);
  await expect
    .poll(() => auditRequests.some((request) => request.phase === 'SELECTION'))
    .toBe(true);
  expect(auditRequests.find((request) => request.phase === 'QUERY')?.query).toBe('SKAX Production');
  expect(auditRequests.find((request) => request.phase === 'QUERY')?.sources).toContain(
    'PROVIDER_TENANTS'
  );
});

test('provider audit and catalog results open recoverable deep links', async ({ page }) => {
  await page.goto('/provider/overview');
  await page.getByRole('button', { name: 'Search' }).click();
  let dialog = page.getByRole('dialog', { name: 'Search DWP' });
  await dialog.getByRole('combobox', { name: 'Search DWP' }).fill('corr-support-1');
  await dialog.getByRole('option', { name: /Support session started/ }).click();

  await expect(page).toHaveURL(/\/provider\/audit\?event=provider-audit-1$/);
  await expect(page.getByRole('dialog', { name: 'Audit event details' })).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();

  await page.getByRole('button', { name: 'Search' }).click();
  dialog = page.getByRole('dialog', { name: 'Search DWP' });
  await dialog.getByRole('combobox', { name: 'Search DWP' }).fill('sys_audit_events');
  await dialog
    .getByRole('option', { name: /sys_audit_events/ })
    .filter({ hasText: 'Provider data catalog' })
    .click();

  await expect(page).toHaveURL(
    /\/provider\/data-governance\?tab=catalog&asset=platform.public.sys_audit_events$/
  );
  await expect(page.getByText('Immutable tenant audit evidence')).toBeVisible();
});
