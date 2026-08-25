import { expect, test } from '@playwright/test';

import budgets from '../scripts/runtime-performance-budgets.json' with { type: 'json' };
import { mockShellSession } from './support/shell-session';

type PerformanceState = {
  cls: number;
  routes: Array<Record<string, unknown>>;
};

test('authenticated shell and SPA transitions stay within the runtime budget', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium');
  await page.addInitScript(() => {
    const state: PerformanceState = { cls: 0, routes: [] };
    Object.assign(window, { __dwpPerformanceState: state });
    if (PerformanceObserver.supportedEntryTypes.includes('layout-shift')) {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
          if (!shift.hadRecentInput) state.cls += shift.value;
        }
      }).observe({ type: 'layout-shift', buffered: true });
    }
    window.addEventListener('dwp:route-performance', (event) => {
      state.routes.push({ ...(event as CustomEvent<Record<string, unknown>>).detail });
    });
  });
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    displayName: 'Mina Kim',
    jobTitle: 'Service designer',
  });

  await page.goto('/work');
  await expect(page.getByTestId('work-header')).toBeVisible();
  const shellReady = await page.evaluate(() => performance.now());
  expect(shellReady).toBeLessThanOrEqual(budgets.shellReadyMs);

  await expect.poll(() => page.evaluate(() => window.__dwpWebVitalsRegistered === true)).toBe(true);
  await page.waitForTimeout(250);
  const initialCls = await page.evaluate(
    () =>
      (window as typeof window & { __dwpPerformanceState: PerformanceState }).__dwpPerformanceState
        .cls
  );
  expect(initialCls).toBeLessThanOrEqual(budgets.cumulativeLayoutShift);

  await page.getByRole('link', { name: 'Unified work queue', exact: true }).click();
  await expect(page).toHaveURL(/\/work\/queue$/);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as typeof window & { __dwpPerformanceState: PerformanceState })
            .__dwpPerformanceState.routes.length
      )
    )
    .toBeGreaterThan(0);

  const routeMetric = await page.evaluate(() =>
    (
      window as typeof window & { __dwpPerformanceState: PerformanceState }
    ).__dwpPerformanceState.routes.at(-1)
  );
  expect(routeMetric).toMatchObject({
    name: 'route-transition',
    routeGroup: 'work',
    navigationType: 'link',
  });
  expect(routeMetric).not.toHaveProperty('pathname');
  expect(Number(routeMetric?.duration)).toBeLessThanOrEqual(budgets.routeTransitionMs);
});
