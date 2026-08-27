import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { FULL_PRODUCT_PERMISSIONS, mockShellSession } from './support/shell-session';

const CALENDAR_SURFACES = [
  { id: 'home', path: '/calendar/home' },
  { id: 'schedule', path: '/calendar/schedule' },
  { id: 'focus', path: '/calendar/focus' },
  { id: 'invitations', path: '/calendar/invitations' },
  { id: 'availability', path: '/calendar/availability' },
  { id: 'insights', path: '/calendar/insights' },
  { id: 'trash', path: '/calendar/trash' },
  { id: 'admin-overview', path: '/calendar/admin/overview' },
  { id: 'admin-company-calendars', path: '/calendar/admin/company-calendars' },
  { id: 'admin-policies', path: '/calendar/admin/policies' },
] as const;

async function prepareCalendarSurface(page: Page, path: string, appearance: 'dark' | 'light') {
  await page.clock.setFixedTime(new Date('2026-08-11T00:20:00Z'));
  await page.emulateMedia({
    colorScheme: appearance,
    forcedColors: 'none',
    reducedMotion: 'reduce',
  });
  await mockShellSession(page, ['CALENDAR_ADMIN'], {
    locale: 'ko',
    permissions: FULL_PRODUCT_PERMISSIONS,
    appearance: {
      mode: appearance,
      density: 'standard',
      highContrast: false,
      reduceMotion: true,
    },
  });
  await page.goto(path);
  const main = page.locator('#dwp-main-content');
  await expect(main).toBeVisible({ timeout: 15_000 });
  await expect(main.locator('h1').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.MuiSkeleton-root')).toHaveCount(0, { timeout: 15_000 });
  return main;
}

for (const surface of CALENDAR_SURFACES) {
  test(`calendar ${surface.id} preserves its dark premium baseline`, async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on('pageerror', (error) => runtimeErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(message.text());
    });

    const main = await prepareCalendarSurface(page, surface.path, 'dark');
    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(horizontalOverflow, `${surface.path} has horizontal overflow`).toBeLessThanOrEqual(1);
    expect(runtimeErrors, `${surface.path} emitted browser runtime errors`).toEqual([]);

    const accessibility = await new AxeBuilder({ page }).include('#dwp-main-content').analyze();
    expect(
      accessibility.violations.filter(
        (violation) => violation.impact === 'critical' || violation.impact === 'serious'
      )
    ).toEqual([]);
    await expect(main).toHaveScreenshot(`calendar-${surface.id}-dark.png`, {
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixelRatio: 0.002,
      timeout: 15_000,
    });
  });
}

test('calendar critical surfaces remain usable in forced colors', async ({ context }) => {
  for (const path of [
    '/calendar/home',
    '/calendar/schedule',
    '/calendar/admin/company-calendars',
  ]) {
    const page = await context.newPage();
    await prepareCalendarSurface(page, path, 'light');
    await page.emulateMedia({
      colorScheme: 'light',
      forcedColors: 'active',
      reducedMotion: 'reduce',
    });

    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(horizontalOverflow, `${path} has horizontal overflow`).toBeLessThanOrEqual(1);
    const accessibility = await new AxeBuilder({ page }).include('#dwp-main-content').analyze();
    expect(
      accessibility.violations.filter(
        (violation) => violation.impact === 'critical' || violation.impact === 'serious'
      )
    ).toEqual([]);
    await page.close();
  }
});
