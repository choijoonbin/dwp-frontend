import { isolateWorkplaceDevelopmentUpdates } from './support/workplace-runtime-isolation';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { CALENDAR_BOOKINGS_FIXTURE } from './support/product-area-fixtures';
import {
  FULL_PRODUCT_PERMISSIONS,
  fulfillSuccess,
  mockShellSession,
} from './support/shell-session';
import type { CalendarPolicy } from '@dwp-frontend/shared-utils';

test.beforeEach(async ({ page }) => {
  await isolateWorkplaceDevelopmentUpdates(page);
  await page.clock.setFixedTime(new Date('2026-08-12T00:00:00Z'));
  await mockShellSession(page, ['TENANT_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
});

test('room policy saves Calendar values only after the changed values are reviewed', async ({
  page,
}, testInfo) => {
  const saved: CalendarPolicy[] = [];
  await page.route('**/api/platform/v1/admin/rooms/policy', async (route) => {
    const policy = route.request().postDataJSON() as CalendarPolicy;
    saved.push(policy);
    return fulfillSuccess(route, { ...policy, version: policy.version + 1 });
  });
  await page.goto('/workplace/admin/meeting-policy');
  const buffer = page.getByRole('spinbutton', { name: 'Default buffer between bookings (min)' });
  await expect(buffer).toHaveValue('10');
  await buffer.fill('15');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const review = page.getByRole('dialog');
  await expect(review).toBeVisible();
  await expect(review.getByText('10', { exact: false })).toBeVisible();
  expect(saved).toHaveLength(0);
  await review.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(() => saved.length).toBe(1);
  expect(saved[0]).toMatchObject({ defaultBufferMinutes: 15, version: 4 });
  for (const width of [1440, 1280, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(buffer).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width
    );
    await page.screenshot({
      path: testInfo.outputPath(`room-policy-${width}.png`),
      fullPage: true,
    });
  }
  const accessibility = await new AxeBuilder({ page }).include('main').analyze();
  expect(
    accessibility.violations.filter((v) => ['critical', 'serious'].includes(v.impact ?? ''))
  ).toEqual([]);
});

test('room operations avoids zero-count failure states and preserves the approval owner version', async ({
  page,
}, testInfo) => {
  let unavailable = true;
  const writes: unknown[] = [];
  await page.route('**/api/platform/v1/admin/rooms/bookings/pending', (route) =>
    unavailable
      ? route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, message: 'Denied' }),
        })
      : fulfillSuccess(route, CALENDAR_BOOKINGS_FIXTURE)
  );
  await page.route('**/api/platform/v1/admin/rooms/bookings/*/decision', (route) => {
    writes.push(route.request().postDataJSON());
    return fulfillSuccess(route, {
      ...CALENDAR_BOOKINGS_FIXTURE[0],
      status: 'APPROVED',
      version: 2,
    });
  });
  await page.goto('/workplace/admin/meeting-operations');
  await expect(page.getByText('Room operations could not be loaded.').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Approve', exact: true })).toHaveCount(0);
  await expect(page.getByText('—', { exact: true }).first()).toBeVisible();
  unavailable = false;
  await page.getByRole('alert').first().getByRole('button').click();
  await page.getByRole('button', { name: 'Approve', exact: true }).click();
  const approval = page.getByRole('dialog');
  await approval.getByRole('textbox').fill('Reviewed resource and meeting time.');
  await approval.getByRole('button', { name: 'Approve', exact: true }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0]).toEqual({
    decision: 'APPROVE',
    note: 'Reviewed resource and meeting time.',
    version: CALENDAR_BOOKINGS_FIXTURE[0].version,
  });
  await page.setViewportSize({ width: 320, height: 1000 });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.screenshot({
    path: testInfo.outputPath('room-operations-320-text-200.png'),
    fullPage: true,
  });
});
