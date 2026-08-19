import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { FULL_PRODUCT_PERMISSIONS, mockShellSession } from './support/shell-session';

test('calendar supports governed range creation and drag rescheduling', async ({ page }) => {
  await mockShellSession(page, ['CALENDAR_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
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

const CALENDAR_FOCUS_VERSION = 2;
