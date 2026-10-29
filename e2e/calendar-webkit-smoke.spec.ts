import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { mockCalendarShellSession as mockShellSession } from './support/calendar-shell-session';
import { FULL_PRODUCT_PERMISSIONS } from './support/shell-session';

test('Calendar remains keyboard-safe, overflow-free, and error-free in WebKit', async ({
  page,
}, testInfo) => {
  const runtimeErrors: string[] = [];
  const httpFailures: string[] = [];
  page.on('pageerror', (error) => {
    // WebKit promotes this standards-defined ResizeObserver delivery warning to pageerror while
    // Chromium reports it only to the console. It does not indicate an unhandled application error.
    if (error.message === 'ResizeObserver loop completed with undelivered notifications.') return;
    runtimeErrors.push(error.message);
  });
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) {
      runtimeErrors.push(message.text());
    }
  });
  page.on('response', (response) => {
    if (response.status() >= 500) httpFailures.push(`${response.status()} ${response.url()}`);
  });
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await mockShellSession(page, ['CALENDAR_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });

  await page.goto('/calendar/schedule?view=week&date=2026-08-11');
  const calendar = page.getByTestId('interactive-calendar');
  await expect(calendar).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Digital workplace operating review', { exact: true })).toBeVisible();

  const event = calendar.getByRole('button', { name: /Digital workplace operating review/u });
  await event.focus();
  await expect(event).toBeFocused();
  await event.press('Enter');
  const inspector = page.getByRole('dialog', { name: 'Digital workplace operating review' });
  await expect(inspector).toBeVisible();
  await inspector.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(inspector).toBeHidden();

  const viewportWidth = page.viewportSize()?.width ?? 0;
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
    )
  ).toBe(true);
  expect(viewportWidth).toBeGreaterThan(0);
  expect(await page.evaluate(() => navigator.userAgent)).toContain('AppleWebKit');

  if (testInfo.project.name === 'webkit-mobile') {
    const navigation = page.getByTestId('calendar-mobile-navigation');
    await expect(navigation).toBeVisible();
    const bounds = await navigation.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewportWidth);
  }

  const accessibility = await new AxeBuilder({ page }).include('#dwp-main-content').analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
  expect(runtimeErrors).toEqual([]);
  expect(httpFailures).toEqual([]);
});
