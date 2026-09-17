import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { mockCalendarShellSession as mockShellSession } from './support/calendar-shell-session';
import { FULL_PRODUCT_PERMISSIONS } from './support/shell-session';

test('calendar expands the planning canvas and turns insight recommendations into actions', async ({
  page,
}) => {
  await mockShellSession(page, ['CALENDAR_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  await page.clock.setFixedTime(new Date('2026-08-11T00:20:00Z'));
  await page.setViewportSize({ width: 1440, height: 1000 });
  const insightWindows: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    const weeks = url.searchParams.get('insightWeeks');
    if (url.pathname.endsWith('/api/platform/v1/calendar/home') && weeks) {
      insightWindows.push(weeks);
    }
  });
  await page.goto('/calendar/schedule');

  const calendar = page.getByTestId('interactive-calendar');
  const sourcePanel = page.getByTestId('calendar-source-panel');
  await expect(calendar).toBeVisible();
  await expect(sourcePanel).toBeVisible();
  const widthWithSources = (await calendar.boundingBox())?.width ?? 0;

  const hidePanel = page.getByRole('button', { name: 'Hide calendar panel', exact: true });
  await expect(hidePanel).toHaveAttribute('aria-expanded', 'true');
  await hidePanel.click();
  await expect(sourcePanel).toBeHidden();
  const widthWithoutSources = (await calendar.boundingBox())?.width ?? 0;
  expect(widthWithoutSources).toBeGreaterThan(widthWithSources + 200);

  const showPanel = page.getByRole('button', { name: 'Show calendar panel', exact: true });
  await expect(showPanel).toHaveAttribute('aria-expanded', 'false');
  await showPanel.click();
  await expect(sourcePanel).toBeVisible();

  await page.goto('/calendar/insights');
  await expect(page.getByTestId('calendar-insights-content')).toBeVisible();
  await expect(page.getByText('Last 4 weeks', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Analyze the last 8 weeks', exact: true }).click();
  await expect(page.getByText('Last 8 weeks', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Analyze the last 12 weeks', exact: true }).click();
  await expect(page.getByText('Last 12 weeks', { exact: true })).toBeVisible();
  expect(insightWindows).toEqual(expect.arrayContaining(['4', '8', '12']));

  const boundaryRecommendation = page.getByRole('button', {
    name: /Work boundary.*Open schedule/u,
  });
  await expect(boundaryRecommendation).toBeVisible();
  await boundaryRecommendation.click();
  await expect(page).toHaveURL(/\/calendar\/schedule/u);

  await page.goto('/calendar/insights');
  await page.getByRole('button', { name: /Focus.*Protect focus time/u }).click();
  await expect(page.getByRole('dialog', { name: 'Create a new event' })).toBeVisible();

  const accessibility = await new AxeBuilder({ page }).include('#dwp-main-content').analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
});

test('calendar insights keeps period and recommendation actions usable at 320px and 200% text', async ({
  page,
}) => {
  await mockShellSession(page, ['CALENDAR_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  await page.clock.setFixedTime(new Date('2026-08-11T00:20:00Z'));
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/calendar/insights');
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });

  const insights = page.getByTestId('calendar-insights-content');
  await expect(insights).toBeVisible();
  const twelveWeeks = page.getByRole('button', {
    name: 'Analyze the last 12 weeks',
    exact: true,
  });
  await twelveWeeks.scrollIntoViewIfNeeded();
  await expect(twelveWeeks).toBeVisible();
  await twelveWeeks.click();
  await expect(page.getByText('Last 12 weeks', { exact: true })).toBeVisible();

  const focusAction = page.getByRole('button', { name: 'Protect focus time', exact: true }).first();
  await focusAction.scrollIntoViewIfNeeded();
  const actionBounds = await focusAction.boundingBox();
  expect(actionBounds).not.toBeNull();
  expect(actionBounds!.x).toBeGreaterThanOrEqual(0);
  expect(actionBounds!.x + actionBounds!.width).toBeLessThanOrEqual(320);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
    )
  ).toBe(true);

  const accessibility = await new AxeBuilder({ page }).include('#dwp-main-content').analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
});

test('calendar saves personal defaults and keeps delegation separate from sharing', async ({
  page,
}) => {
  await mockShellSession(page, ['CALENDAR_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  await page.clock.setFixedTime(new Date('2026-08-11T00:20:00Z'));
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto('/calendar/settings');

  await expect(page.getByRole('heading', { level: 1, name: 'Calendar settings' })).toBeVisible();
  await page.getByLabel('Default event length', { exact: true }).click();
  await page.getByRole('option', { name: '45 minutes', exact: true }).click();
  await expect(page.getByText('You have unsaved changes', { exact: true })).toBeVisible();
  const saveRequest = page.waitForRequest(
    (request) =>
      request.method() === 'PUT' &&
      new URL(request.url()).pathname === '/api/platform/v1/calendar/settings'
  );
  await page.getByRole('button', { name: 'Save settings', exact: true }).click();
  expect((await saveRequest).postDataJSON()).toMatchObject({
    defaultEventMinutes: 45,
    speedyMeetingMode: 'FIVE_TEN',
    defaultBufferMinutes: 10,
    defaultVisibility: 'PRIVATE',
    defaultReminderMinutes: 10,
    version: 3,
  });
  await expect(page.getByText('No unsaved changes', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Assign delegate', exact: true }).click();
  const delegation = page.getByRole('dialog', { name: 'Assign a new delegate' });
  await expect(delegation).toContainText('Delegation permits someone to act on your behalf.');
  await expect(delegation).toContainText(
    'Access to private event details is never included automatically.'
  );
  await delegation.getByRole('button', { name: 'Close', exact: true }).click();

  const accessibility = await new AxeBuilder({ page }).include('#dwp-main-content').analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
});
