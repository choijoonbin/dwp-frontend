import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { FULL_PRODUCT_PERMISSIONS, mockShellSession } from './support/shell-session';

test('calendar supports governed range creation and drag rescheduling', async ({ page }) => {
  await mockShellSession(page, ['CALENDAR_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  await page.clock.setFixedTime(new Date('2026-08-18T01:00:00Z'));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/calendar/schedule');

  const calendar = page.getByTestId('interactive-calendar');
  await expect(calendar).toBeVisible();
  await calendar.getByRole('button', { name: 'Previous Week' }).click();

  const movableEvent = calendar.getByText('Protected focus time', { exact: true }).first();
  await expect(movableEvent).toBeVisible();
  const eventBox = await movableEvent.boundingBox();
  expect(eventBox).not.toBeNull();

  const updateRequest = page.waitForRequest(
    (request) =>
      request.method() === 'PUT' &&
      request.url().includes('/api/platform/v1/calendar/events/calendar-event-focus')
  );
  await page.mouse.move(eventBox!.x + eventBox!.width / 2, eventBox!.y + eventBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    eventBox!.x + eventBox!.width / 2,
    eventBox!.y + eventBox!.height / 2 + 90,
    { steps: 12 }
  );
  await page.mouse.up();

  const request = await updateRequest;
  const payload = request.postDataJSON() as { startsAt: string; endsAt: string; version: number };
  expect(Date.parse(payload.endsAt)).toBeGreaterThan(Date.parse(payload.startsAt));
  expect(payload.version).toBe(CALENDAR_FOCUS_VERSION);

  const lockedRecurringEvent = calendar.getByText('Digital workplace operating review', {
    exact: true,
  });
  await expect(lockedRecurringEvent).toBeVisible();

  const accessibility = await new AxeBuilder({ page })
    .include('[data-testid="interactive-calendar"]')
    .analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
});

test('calendar remains read-only when Home deep-links a viewer without mutation grants', async ({
  page,
}) => {
  const readOnlyPermissions = FULL_PRODUCT_PERMISSIONS.filter(
    (permission) =>
      permission.resourceKey !== 'APP.CALENDAR' || permission.permissionCode === 'VIEW'
  );
  const mutationRequests: string[] = [];
  page.on('request', (request) => {
    if (
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method()) &&
      request.url().includes('/api/platform/v1/calendar')
    ) {
      mutationRequests.push(`${request.method()} ${request.url()}`);
    }
  });

  await mockShellSession(page, [], { locale: 'en', permissions: readOnlyPermissions });
  await page.setViewportSize({ width: 1440, height: 1000 });

  await page.goto('/calendar/schedule?create=focus');
  await expect(page.getByTestId('interactive-calendar')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add focus time', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'New event', exact: true })).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.goto('/calendar/home');
  await expect(page.getByRole('button', { name: 'New event', exact: true })).toHaveCount(0);

  await page.goto('/calendar/insights');
  await expect(page.getByRole('button', { name: 'Protect focus time', exact: true })).toHaveCount(
    0
  );

  await page.goto('/calendar/availability');
  await page.getByRole('button', { name: 'Find available time', exact: true }).click();
  await expect(
    page.getByText('All participants are available and focus time is preserved.')
  ).toBeVisible();
  await expect(
    page.getByRole('button', {
      name: /All participants are available and focus time is preserved\./,
    })
  ).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(mutationRequests).toEqual([]);
});

const CALENDAR_FOCUS_VERSION = 2;
