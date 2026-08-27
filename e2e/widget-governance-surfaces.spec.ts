import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import type { Locator, Page } from '@playwright/test';

import { FULL_PRODUCT_PERMISSIONS, mockShellSession } from './support/shell-session';

const reducedMotionAppearance = {
  mode: 'light',
  density: 'standard',
  highContrast: false,
  reduceMotion: true,
} as const;

async function expectNoHorizontalOverflow(page: Page) {
  const width = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
    offenders: Array.from(document.querySelectorAll<HTMLElement>('body *'))
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return (
          rect.width > 0 &&
          (rect.left < -1 || rect.right > document.documentElement.clientWidth + 1)
        );
      })
      .slice(0, 8)
      .map((element) => ({
        tag: element.tagName,
        className: element.className,
        left: Math.round(element.getBoundingClientRect().left),
        right: Math.round(element.getBoundingClientRect().right),
        scrollWidth: element.scrollWidth,
        text: element.textContent?.trim().slice(0, 80),
      })),
  }));
  expect(width.scroll, JSON.stringify(width.offenders, null, 2)).toBeLessThanOrEqual(width.client);
}

async function expectCurrentDefinition({
  list,
  detail,
  label,
}: {
  list: Locator;
  detail: Locator;
  label: string;
}) {
  const current = list.locator('[aria-current="true"]');
  await expect(current).toHaveCount(1);
  await expect(current).toContainText(label);
  const detailId = await detail.getAttribute('id');
  expect(detailId).toBeTruthy();
  await expect(current).toHaveAttribute('aria-controls', detailId!);
}

async function expectWidgetSurfaceScreenshot({
  page,
  surface,
  name,
}: {
  page: Page;
  surface: Locator;
  name: string;
}) {
  await page.mouse.move(0, 0);
  const screenshotScopeStyle = await page.addStyleTag({
    content: `
      [data-dwp-shell],
      [data-testid='dwaion-launcher'] {
        visibility: hidden !important;
      }
    `,
  });
  try {
    await expect.soft(surface).toHaveScreenshot(name, { animations: 'disabled' });
  } finally {
    await screenshotScopeStyle.evaluate((element) => element.remove());
  }
}

test('tenant administration exposes a searchable read-only widget catalog', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockShellSession(page, ['ADMIN'], {
    locale: 'en',
    appearance: reducedMotionAppearance,
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/admin/experience/home-composition?tab=catalog');

  await expect(page.getByRole('tab', { name: 'Widget catalog' })).toHaveAttribute(
    'aria-selected',
    'true'
  );
  await expect(
    page.getByText('Built-in widget contracts in this build — development preview')
  ).toBeVisible();
  const tenantCatalog = page.getByRole('tabpanel', { name: 'Widget catalog' });
  const tenantDefinitionList = page.getByRole('list', {
    name: 'Tenant widget definition catalog',
  });
  await expect(tenantDefinitionList).toBeVisible();
  await expect(page.getByText('5 built-in definitions')).toBeVisible();
  await expect(page.getByText('Registered in current build')).toBeVisible();
  await expectCurrentDefinition({
    list: tenantDefinitionList,
    detail: page.getByRole('region', { name: 'Command rail' }),
    label: 'Command rail',
  });
  await expectWidgetSurfaceScreenshot({
    page,
    surface: tenantCatalog,
    name: 'tenant-widget-catalog-1440.png',
  });

  await page.getByLabel('Search widget catalog').fill('calendar');
  await expect(page.getByText('1 built-in definition')).toBeVisible();
  await expect(page.getByText('Schedule', { exact: true }).first()).toBeVisible();
  await expectCurrentDefinition({
    list: tenantDefinitionList,
    detail: page.getByRole('region', { name: 'Schedule' }),
    label: 'Schedule',
  });

  const accessibility = await new AxeBuilder({ page }).include('main').analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);

  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  await expectNoHorizontalOverflow(page);
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '';
  });

  await page.setViewportSize({ width: 320, height: 720 });
  await page.getByLabel('Search widget catalog').fill('');
  const tenantDailyBrief = tenantDefinitionList.getByRole('button', { name: /Daily brief/ });
  await tenantDailyBrief.focus();
  await tenantDailyBrief.press('Enter');
  const tenantDetailHeading = page.getByRole('heading', {
    name: 'Daily brief',
    exact: true,
    level: 2,
  });
  await expect(tenantDetailHeading).toBeFocused();
  await expect(tenantDetailHeading).toBeInViewport();
  await expectCurrentDefinition({
    list: tenantDefinitionList,
    detail: page.getByRole('region', { name: 'Daily brief' }),
    label: 'Daily brief',
  });
  await expectNoHorizontalOverflow(page);
});

test('tenant administrators review blueprint impact and recovery before lifecycle changes', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockShellSession(page, ['ADMIN'], {
    locale: 'en',
    appearance: reducedMotionAppearance,
    permissions: [
      ...FULL_PRODUCT_PERMISSIONS,
      {
        resourceType: 'ADMIN',
        resourceKey: 'ADMIN.HOME_TEMPLATE',
        permissionCode: 'MANAGE',
        effect: 'ALLOW',
      },
    ],
  });
  const lifecycleRequests: Array<{
    path: string;
    body: unknown;
    idempotencyKey: string | undefined;
  }> = [];
  await page.route('**/api/platform/v1/home-templates**', (route) => {
    const request = route.request();
    if (request.method() !== 'GET') {
      lifecycleRequests.push({
        path: new URL(request.url()).pathname,
        body: request.postDataJSON(),
        idempotencyKey: request.headers()['idempotency-key'],
      });
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'SUCCESS',
          message: 'OK',
          success: true,
          data: {},
        }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        success: true,
        data: [
          {
            templateId: '11111111-1111-4111-8111-111111111111',
            templateKey: 'quarterly-launch',
            name: 'Quarterly launch',
            audience: { type: 'ALL', values: [] },
            lifecycle: 'DRAFT',
            schemaVersion: 5,
            layout: {
              appLayout: null,
              presentation: 'balanced',
              widgets: [
                { widgetKey: 'activity', visible: true, size: 'medium' },
                { widgetKey: 'focus', visible: true, size: 'medium' },
              ],
            },
            version: 3,
            publishedAt: null,
            publishedBy: null,
            updatedAt: '2026-08-27T06:00:00Z',
          },
          {
            templateId: '22222222-2222-4222-8222-222222222222',
            templateKey: 'service-operations',
            name: 'Service operations',
            audience: { type: 'ROLE', values: ['Operations'] },
            lifecycle: 'PUBLISHED',
            schemaVersion: 5,
            layout: {
              appLayout: null,
              presentation: 'focused',
              widgets: [{ widgetKey: 'command-rail', visible: true, size: 'full' }],
            },
            version: 7,
            publishedAt: '2026-08-20T06:00:00Z',
            publishedBy: 41,
            updatedAt: '2026-08-20T06:00:00Z',
          },
        ],
      }),
    });
  });

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/admin/experience/home-composition?tab=blueprints');

  await expect(page.getByRole('tab', { name: 'Home blueprints' })).toHaveAttribute(
    'aria-selected',
    'true'
  );
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  let confirmation = page.getByRole('dialog', { name: 'Publish this home blueprint?' });
  await expect(confirmation).toContainText('Quarterly launch revision v3');
  await expect(confirmation).toContainText('All members');
  await expect(confirmation).toContainText('2 widgets');
  await expect(confirmation).toContainText('Existing personal homes do not change automatically');
  await expect(confirmation).toContainText('revoke this revision');
  await expectWidgetSurfaceScreenshot({
    page,
    surface: confirmation,
    name: 'tenant-home-blueprint-publish-confirm-1280.png',
  });
  await confirmation.getByRole('button', { name: 'Cancel' }).click();
  expect(lifecycleRequests).toEqual([]);

  await page.getByRole('button', { name: 'Revoke', exact: true }).click();
  confirmation = page.getByRole('alertdialog', { name: 'Revoke this home blueprint?' });
  await expect(confirmation).toContainText('Service operations revision v7');
  await expect(confirmation).toContainText('Operations');
  await expect(confirmation).toContainText('1-widget layout cannot be newly applied');
  await expect(confirmation).toContainText('Existing personal copies remain independent');
  await expect(confirmation).toContainText('create and publish a new revision');

  const accessibility = await new AxeBuilder({ page }).include('[role="alertdialog"]').analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
  await confirmation.getByRole('button', { name: 'Revoke blueprint' }).click();
  await expect.poll(() => lifecycleRequests.length).toBe(1);
  expect(lifecycleRequests[0]).toMatchObject({
    path: '/api/platform/v1/home-templates/22222222-2222-4222-8222-222222222222/revoke',
    body: { version: 7 },
  });
  expect(lifecycleRequests[0]?.idempotencyKey).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu
  );
  await expect(page.getByText('The home blueprint lifecycle was updated.')).toBeVisible();
});

test('provider control labels static widget contracts as a development preview', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockShellSession(page, ['PROVIDER_ADMIN'], {
    locale: 'en',
    appearance: reducedMotionAppearance,
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/provider/code-contracts?tab=widgets');

  await expect(page.getByRole('tab', { name: 'Widget definitions' })).toHaveAttribute(
    'aria-selected',
    'true'
  );
  await expect(page.getByText('Static widget contracts packaged with this build')).toBeVisible();
  const providerCatalog = page.getByRole('tabpanel', { name: 'Widget definitions' });
  const providerDefinitionList = page.getByRole('list', {
    name: 'Provider widget definition catalog',
  });
  await expect(providerDefinitionList).toBeVisible();
  await expect(page.getByText('5 registered build definitions')).toBeVisible();
  await expect(page.getByText('Static contract registered')).toBeVisible();
  await expect(page.getByText('Release review criteria')).toBeVisible();
  await expect(page.getByText('Target fail-closed revocation contract')).toBeVisible();
  await expectCurrentDefinition({
    list: providerDefinitionList,
    detail: page.getByRole('region', { name: 'Command rail' }),
    label: 'Command rail',
  });
  await providerDefinitionList.getByRole('button', { name: /Daily brief/ }).click();
  await expectCurrentDefinition({
    list: providerDefinitionList,
    detail: page.getByRole('region', { name: 'Daily brief' }),
    label: 'Daily brief',
  });
  await providerDefinitionList.getByRole('button', { name: /Command rail/ }).click();
  await expectCurrentDefinition({
    list: providerDefinitionList,
    detail: page.getByRole('region', { name: 'Command rail' }),
    label: 'Command rail',
  });
  await expectWidgetSurfaceScreenshot({
    page,
    surface: providerCatalog,
    name: 'provider-widget-catalog-1280.png',
  });

  const accessibility = await new AxeBuilder({ page }).include('main').analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);

  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  await expectNoHorizontalOverflow(page);
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '';
  });

  await page.setViewportSize({ width: 320, height: 720 });
  const providerDailyBrief = providerDefinitionList.getByRole('button', { name: /Daily brief/ });
  await providerDailyBrief.focus();
  await providerDailyBrief.press('Enter');
  const providerDetailHeading = page.getByRole('heading', {
    name: 'Daily brief',
    exact: true,
    level: 2,
  });
  await expect(providerDetailHeading).toBeFocused();
  await expect(providerDetailHeading).toBeInViewport();
  await expectCurrentDefinition({
    list: providerDefinitionList,
    detail: page.getByRole('region', { name: 'Daily brief' }),
    label: 'Daily brief',
  });
  await expectNoHorizontalOverflow(page);
});
