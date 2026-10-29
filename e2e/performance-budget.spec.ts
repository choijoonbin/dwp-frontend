import { expect, test } from '@playwright/test';

import budgets from '../scripts/runtime-performance-budgets.json' with { type: 'json' };
import { fulfill, mailOrganization, mockMailMember, thread } from './support/mail-fixtures';
import { FULL_PRODUCT_PERMISSIONS, mockShellSession } from './support/shell-session';

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

  await page.locator('a[href="/work/action-required"]').click();
  await expect(page).toHaveURL(/\/work\/action-required$/);
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

test('Mail inbox initial readiness and SPA navigation stay within the product budget', async ({
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
  await mockMailMember(page);
  const organization = mailOrganization();
  const item = thread('40000000-0000-0000-0000-000000000071', {
    subject: 'Performance budget review',
  });
  await page.route('**/api/platform/v1/mail/organization', (route) => fulfill(route, organization));
  await page.route('**/api/platform/v1/mail/home**', (route) =>
    fulfill(route, {
      accounts: organization.accounts,
      metrics: {
        unread: 1,
        urgent: 0,
        needsReply: 1,
        assigned: 0,
        snoozed: 0,
        activeProposals: 0,
      },
      focusQueue: [item],
      proposals: [],
      sharedInboxes: [],
      generatedAt: '2026-10-28T05:00:00.000Z',
    })
  );
  await page.route('**/api/platform/v1/mail/threads**', (route) =>
    fulfill(route, { items: [item], total: 1, page: 0, pageSize: 30 })
  );

  await page.goto('/mail/home');
  await expect(page.getByRole('heading', { name: 'Focus queue' })).toBeVisible();
  const mailReady = await page.evaluate(() => performance.now());
  expect(mailReady).toBeLessThanOrEqual(budgets.mailRouteReadyMs);
  await page.waitForTimeout(250);
  const cls = await page.evaluate(
    () =>
      (window as typeof window & { __dwpPerformanceState: PerformanceState }).__dwpPerformanceState
        .cls
  );
  expect(cls).toBeLessThanOrEqual(budgets.cumulativeLayoutShift);

  await page.locator('a[href="/mail/inbox"]').first().click();
  await expect(page).toHaveURL(/\/mail\/inbox$/u);
  await expect(page.getByRole('heading', { level: 1, name: 'Inbox' })).toBeVisible();
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
    routeGroup: 'mail',
    navigationType: 'link',
  });
  expect(routeMetric).not.toHaveProperty('pathname');
  expect(Number(routeMetric?.duration)).toBeLessThanOrEqual(budgets.routeTransitionMs);
});

test('Workplace member readiness and reservation navigation stay within product budgets', async ({
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
  await mockShellSession(page, ['TENANT_ADMIN'], {
    displayName: 'Mina Kim',
    jobTitle: 'Workplace operator',
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });

  await page.goto('/workplace/home');
  await expect(page.getByTestId('workplace-home-scope')).toBeVisible();
  const workplaceReady = await page.evaluate(() => performance.now());
  expect(workplaceReady).toBeLessThanOrEqual(budgets.workplaceRouteReadyMs);
  await page.waitForTimeout(250);
  const cls = await page.evaluate(
    () =>
      (window as typeof window & { __dwpPerformanceState: PerformanceState }).__dwpPerformanceState
        .cls
  );
  expect(cls).toBeLessThanOrEqual(budgets.cumulativeLayoutShift);

  await page.locator('a[href="/workplace/reservations"]').first().click();
  await expect(page).toHaveURL(/\/workplace\/reservations$/u);
  await expect(page.getByRole('heading', { level: 1, name: 'My reservations' })).toBeVisible();
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
    routeGroup: 'workplace-reservations',
    navigationType: 'link',
  });
  expect(routeMetric).not.toHaveProperty('pathname');
  expect(Number(routeMetric?.duration)).toBeLessThanOrEqual(budgets.workplaceRouteTransitionMs);
});
