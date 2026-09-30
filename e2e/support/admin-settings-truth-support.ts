import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, type Route } from '@playwright/test';

export const ADMIN_SETTINGS_EVIDENCE_DIRECTORY =
  '/Users/a10697/Work/DWP/output/admin-settings-truth-audit-2026-09-17/screenshots';

export const ADMIN_SETTINGS_VIEWPORTS = [
  { name: '1440', width: 1440, height: 900 },
  { name: '1280', width: 1280, height: 800 },
  { name: '390', width: 390, height: 844 },
  { name: '320', width: 320, height: 800 },
  { name: '1440-200pct', width: 1440, height: 900, zoom: 2 },
] as const;

export function fulfillSuccess(route: Route, data: unknown) {
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data }),
  });
}

export async function expectNoHorizontalOverflow(page: Page, context: string) {
  const geometry = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(
    geometry.scrollWidth,
    `${context}: document width ${geometry.scrollWidth}px exceeds ${geometry.clientWidth}px`
  ).toBeLessThanOrEqual(geometry.clientWidth + 1);
}

export async function expectKeyboardFocus(page: Page) {
  await page.keyboard.press('Tab');
  expect(
    await page.evaluate(() => {
      const focused = document.activeElement;
      if (!focused || focused === document.body) return false;
      return focused.matches('a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
    })
  ).toBe(true);
}

export async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).include('#dwp-main-content').analyze();
  expect(
    results.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
}
