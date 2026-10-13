import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type TestInfo } from '@playwright/test';

import { mockHcmProductSurfaceAuthority } from './support/product-surface-authority';
import { routeHomeWave4ShadowRuntime } from './support/home-wave4-runtime-fixtures';
import { FULL_PRODUCT_PERMISSIONS, mockShellSession } from './support/shell-session';

const journeys = [
  {
    id: 'employment-documents',
    path: '/hr/me/employment-documents',
    apiPattern: '**/api/people/v1/hris/workbench/self-service/employment-documents**',
    workspace: '[data-workspace="employment-documents"]',
    settledText: null,
  },
  {
    id: 'employment-assignments',
    path: '/hr/operations/people/employment-assignments',
    apiPattern: '**/api/people/v1/hris/workbench/operations/employment/assignments**',
    workspace: '[data-workspace="employment-assignments"]',
    settledText: null,
  },
  {
    id: 'time-interpretation',
    path: '/hr/operations/time/interpretation',
    apiPattern: '**/api/time/v1/hris/workbench/time-interpretation**',
    workspace: '[data-testid="hris-time-interpretation-operations-workspace"]',
    settledText: 'Unavailable',
  },
  {
    id: 'payroll-configuration',
    path: '/hr/settings/payroll',
    apiPattern: '**/api/payroll/v1/workbench/settings-payroll**',
    workspace: '[data-testid="hris-payroll-configuration-workspace"]',
    settledText: 'Payroll configuration is unavailable',
  },
] as const;

const viewports = [
  { id: 'd1440', width: 1440, height: 900 },
  { id: 'd1280', width: 1280, height: 800 },
  { id: 'm390', width: 390, height: 844 },
  { id: 'm320', width: 320, height: 700 },
] as const;

async function expectNoHorizontalOverflow(page: Page, path: string) {
  const geometry = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(geometry.content, `${path} must not overflow`).toBeLessThanOrEqual(geometry.viewport + 1);
}

async function attachScreenshot(page: Page, testInfo: TestInfo, name: string) {
  await testInfo.attach(name, {
    body: await page.screenshot({ fullPage: true, animations: 'disabled' }),
    contentType: 'image/png',
  });
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await mockShellSession(page, ['HR_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
    appearance: {
      mode: 'system',
      density: 'standard',
      highContrast: true,
      reduceMotion: true,
    },
  });
  await mockHcmProductSurfaceAuthority(page);
});

for (const journey of journeys) {
  test(`${journey.id} canonical route mounts its owner-backed fail-closed workspace`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewports[0]);
    let ownerRequestCount = 0;
    await page.route(journey.apiPattern, (route) => {
      ownerRequestCount += 1;
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'ERROR',
          message: 'The synthetic owner is unavailable for shared-wiring evidence.',
          correlationId: `wave2-${journey.id}`,
        }),
      });
    });

    await page.goto(journey.path);

    const workspace = page.locator(journey.workspace);
    await expect(workspace).toBeVisible();
    await expect
      .poll(() => ownerRequestCount, {
        message: `${journey.path} must issue its exact owner workbench request`,
      })
      .toBeGreaterThan(0);
    if (journey.settledText) {
      await expect(page.getByText(journey.settledText, { exact: true }).first()).toBeVisible();
    } else {
      await expect(workspace).toHaveAttribute('data-state', 'error');
    }

    await page.keyboard.press('Tab');
    await expect(page.locator(':focus-visible').first()).toBeVisible();

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await expect(workspace).toBeVisible();
      await expectNoHorizontalOverflow(page, `${journey.path}@${viewport.id}`);
      await attachScreenshot(page, testInfo, `${journey.id}-${viewport.id}-light-high-contrast`);
    }

    await page.setViewportSize(viewports[0]);
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    await expect(workspace).toBeVisible();
    await expectNoHorizontalOverflow(page, `${journey.path}@dark`);
    await attachScreenshot(page, testInfo, `${journey.id}-d1440-dark-high-contrast`);

    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
    await page.addStyleTag({ content: ':root { font-size: 200% !important; }' });
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await expectNoHorizontalOverflow(page, `${journey.path}@200-percent-text`);
    const accessibility = await new AxeBuilder({ page }).include('main').analyze();
    const blocking = accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    );
    expect(blocking, `${journey.path} must pass serious accessibility checks`).toEqual([]);
    await attachScreenshot(page, testInfo, `${journey.id}-d1440-200-percent-text`);
  });
}

test('workspace home exposes the product app as HRIS and never as exact 인사', async ({
  page,
}, testInfo) => {
  await mockShellSession(page, ['HR_ADMIN'], {
    locale: 'ko',
    permissions: FULL_PRODUCT_PERMISSIONS,
    appearance: {
      mode: 'system',
      density: 'standard',
      highContrast: true,
      reduceMotion: true,
    },
  });
  await routeHomeWave4ShadowRuntime(page);
  await page.setViewportSize(viewports[0]);
  await page.goto('/');

  await expect(page.getByRole('button', { name: 'HRIS 열기', exact: true })).toHaveCount(1);
  await expect(page.getByRole('button', { name: '인사 열기', exact: true })).toHaveCount(0);
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await expectNoHorizontalOverflow(page, `/@${viewport.id}`);
    await attachScreenshot(page, testInfo, `home-hris-label-${viewport.id}`);
  }
});
