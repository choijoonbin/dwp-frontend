import { expect, test } from '@playwright/test';

import {
  FULL_PRODUCT_PERMISSIONS,
  fulfillSuccess,
  mockShellSession,
} from './support/shell-session';

test('calendar preserves a canonical Work handoff and offers an explicit return action', async ({
  page,
}) => {
  await mockShellSession(page, ['CALENDAR_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  await page.clock.setFixedTime(new Date('2026-08-11T00:20:00Z'));
  const returnTarget = '/work/queue?view=mine#task-task-42';
  const query = new URLSearchParams({
    date: '2026-08-11',
    returnTo: returnTarget,
  });

  await page.goto(`/calendar/schedule?${query.toString()}`);
  const returnAction = page.getByRole('button', { name: 'Return to work', exact: true });
  await expect(returnAction).toBeVisible();
  await returnAction.focus();
  await expect(returnAction).toBeFocused();

  if ((page.viewportSize()?.width ?? 0) >= 900) {
    await page
      .getByTestId('interactive-calendar')
      .getByRole('tab', { name: 'Month view', exact: true })
      .click();
  }
  expect(new URL(page.url()).searchParams.get('returnTo')).toBe(returnTarget);

  await returnAction.click();
  await expect(page).toHaveURL(new RegExp(`/work/queue\\?view=mine#task-task-42$`, 'u'));
});

test('calendar hides the Work return action without destination permission', async ({ page }) => {
  const calendarPermissions = FULL_PRODUCT_PERMISSIONS.filter(
    (permission) => permission.resourceKey !== 'APP.WORK'
  );
  await mockShellSession(page, ['CALENDAR_ADMIN'], {
    locale: 'en',
    permissions: calendarPermissions,
  });
  await page.clock.setFixedTime(new Date('2026-08-11T00:20:00Z'));

  await page.goto('/calendar/schedule?returnTo=%2Fwork%2Fqueue');
  await expect(page.getByRole('heading', { level: 1, name: 'Schedule' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Return to work', exact: true })).toHaveCount(0);
  expect(new URL(page.url()).pathname).toBe('/calendar/schedule');
});

test('calendar withdraws the Work return action after permission revocation', async ({ page }) => {
  await mockShellSession(page, ['CALENDAR_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  await page.clock.setFixedTime(new Date('2026-08-11T00:20:00Z'));
  await page.goto('/calendar/schedule?returnTo=%2Fwork%2Fqueue');

  const returnAction = page.getByRole('button', { name: 'Return to work', exact: true });
  await expect(returnAction).toBeVisible();
  await returnAction.focus();
  await expect(returnAction).toBeFocused();
  const revokedPermissions = FULL_PRODUCT_PERMISSIONS.filter(
    (permission) => permission.resourceKey !== 'APP.WORK'
  );
  await page.route('**/api/auth/permissions', (route) => fulfillSuccess(route, revokedPermissions));
  const authorityRefresh = page.waitForResponse(
    (response) => response.url().endsWith('/api/auth/permissions') && response.status() === 200
  );
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await authorityRefresh;
  await expect(returnAction).toHaveCount(0);
  expect(
    await page.evaluate(() => document.activeElement?.textContent?.includes('Return to work'))
  ).toBe(false);
  await page.keyboard.press('Tab');
  expect(
    await page.evaluate(() => document.activeElement?.textContent?.includes('Return to work'))
  ).toBe(false);
});

test('calendar hides encoded unsafe Work return aliases', async ({ page }) => {
  await mockShellSession(page, ['CALENDAR_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  for (const returnTo of ['/work/%5cadmin', '/work/queue?filter=%0A']) {
    await page.goto(`/calendar/schedule?returnTo=${encodeURIComponent(returnTo)}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Schedule' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Return to work', exact: true })).toHaveCount(0);
  }
});
