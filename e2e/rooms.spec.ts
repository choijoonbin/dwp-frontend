import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { FULL_PRODUCT_PERMISSIONS, mockShellSession } from './support/shell-session';

test.beforeEach(async ({ page }) => {
  await mockShellSession(page, ['CALENDAR_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
});

test('members can find and book an available room without Calendar app API coupling', async ({
  page,
}) => {
  const calendarApiCalls: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/platform/v1/calendar/')) {
      calendarApiCalls.push(request.url());
    }
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/rooms/find');

  await expect(page.getByRole('heading', { name: 'Find a room', level: 1 })).toBeVisible();
  await expect(page.getByText('Focus 08', { exact: true })).toBeVisible();
  await expect(page.getByText('Collaboration studio 12', { exact: true })).toBeVisible();

  await page
    .getByRole('button', { name: /Book Focus 08 at/ })
    .first()
    .click();
  const dialog = page.getByRole('dialog', { name: 'Book a room' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Meeting subject').fill('Rooms architecture review');
  await dialog.getByRole('button', { name: 'Book', exact: true }).click();
  await expect(dialog).toBeHidden();
  expect(calendarApiCalls).toEqual([]);

  const accessibility = await new AxeBuilder({ page }).include('main').analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
});

test('room operations expose user and delegated administrator workflows', async ({ page }) => {
  await page.goto('/rooms/my-bookings');
  await expect(page.getByRole('heading', { name: 'My room bookings', level: 1 })).toBeVisible();
  await expect(page.getByText('Enterprise room booking review')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancel booking' })).toBeVisible();

  await page.goto('/rooms/admin/resources');
  await expect(page.getByRole('heading', { name: 'Room management', level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add room' })).toBeVisible();
  await expect(page.getByText('Focus 08', { exact: true })).toBeVisible();

  await page.goto('/rooms/admin/operations');
  await expect(page.getByRole('heading', { name: 'Room operations', level: 1 })).toBeVisible();
  await expect(page.getByText('Quarterly people town hall')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Approve' })).toBeVisible();
});

test('room discovery contains wide timelines inside the mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/rooms/find');
  await expect(page.getByRole('heading', { name: 'Find a room', level: 1 })).toBeVisible();

  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewport);
  await expect(page.getByRole('group', { name: 'Availability for Focus 08' })).toBeVisible();
});
