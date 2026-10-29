import { expect, test } from '@playwright/test';

import { mockCalendarShellSession as mockShellSession } from './support/calendar-shell-session';
import { FULL_PRODUCT_PERMISSIONS } from './support/shell-session';

test('calendar remains read-only when Home deep-links a viewer without mutation grants', async ({
  page,
}) => {
  const readOnlyPermissions = FULL_PRODUCT_PERMISSIONS.filter(
    (permission) =>
      permission.resourceKey !== 'APP.CALENDAR' || permission.permissionCode === 'VIEW'
  );
  const mutationRequests: string[] = [];
  const evaluationRequests: string[] = [];
  page.on('request', (request) => {
    if (
      request.method() === 'POST' &&
      request.url().includes('/api/platform/v2/calendar/scheduling/evaluations') &&
      !request.url().includes('/hard-recheck')
    ) {
      evaluationRequests.push(`${request.method()} ${request.url()}`);
      return;
    }
    if (
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method()) &&
      request.url().includes('/api/platform/v1/calendar')
    ) {
      mutationRequests.push(`${request.method()} ${request.url()}`);
    }
  });

  await mockShellSession(page, [], { locale: 'en', permissions: readOnlyPermissions });
  await page.clock.setFixedTime(new Date('2026-08-11T00:20:00Z'));
  await page.setViewportSize({ width: 1440, height: 1000 });

  await page.goto('/calendar/schedule?create=focus');
  await expect(page.getByTestId('interactive-calendar')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add focus time', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'New event', exact: true })).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.goto('/calendar/home');
  await expect(page.getByRole('button', { name: 'New event', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Protect for focus' })).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Quick actions', exact: true })
    .and(page.locator('[aria-expanded]'))
    .click();
  const readOnlyCommands = page.getByRole('dialog', { name: 'Calendar quick actions' });
  await expect(readOnlyCommands).toBeVisible();
  for (const command of [
    'Create a new event',
    'Create focus time',
    'Create a task time block',
    'Create a time-away block',
  ]) {
    await expect(readOnlyCommands.getByRole('option', { name: command })).toHaveCount(0);
  }
  await page.keyboard.press('Escape');
  await expect(readOnlyCommands).toHaveCount(0);

  await page.goto('/calendar/insights');
  await expect(page.getByRole('button', { name: 'Protect focus time', exact: true })).toHaveCount(
    0
  );

  await page.goto('/calendar/availability');
  await page.getByRole('button', { name: 'Find available time', exact: true }).click();
  await expect(
    page.getByText('All required attendees are available within working hours.')
  ).toBeVisible();
  await expect(
    page.getByRole('button', {
      name: /All required attendees are available within working hours\./,
    })
  ).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(mutationRequests).toEqual([]);
  expect(evaluationRequests).toHaveLength(1);
});
