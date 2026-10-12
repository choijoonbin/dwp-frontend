import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { mockHcmProductSurfaceAuthority } from './support/product-surface-authority';
import { FULL_PRODUCT_PERMISSIONS, mockShellSession } from './support/shell-session';

const journeys = [
  {
    module: 'SYS',
    title:
      'SYS reference configuration integrated runtime is responsive and accessible',
    path: '/hr/settings/reference-data',
    workspace: 'hris-reference-configuration-workspace',
    apiPattern: '**/api/platform/v1/hris/workbench/settings-reference**',
    activeMarker: 'Reference configuration is unavailable',
  },
  {
    module: 'HRM',
    title:
      'HRM employee change integrated runtime is responsive and accessible',
    path: '/hr/operations/people/employee-change-requests',
    workspace: 'hris-employee-change-workspace',
    apiPattern: '**/api/people/v1/hris/workbench/operations/employee/change/requests**',
    activeMarker: 'Employee-change requests',
  },
] as const;

const sourcePinAnnotations = [
  { type: 'g7-frontend-source-commit', environment: 'G7_FRONTEND_SOURCE_COMMIT' },
  { type: 'g7-frontend-source-tree', environment: 'G7_FRONTEND_SOURCE_TREE' },
  { type: 'g7-backend-source-commit', environment: 'G7_BACKEND_SOURCE_COMMIT' },
  { type: 'g7-backend-source-tree', environment: 'G7_BACKEND_SOURCE_TREE' },
] as const;

async function expectNoHorizontalOverflow(page: Page, path: string) {
  const geometry = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(geometry.content, `${path} must not overflow`).toBeLessThanOrEqual(
    geometry.viewport + 1
  );
}

for (const journey of journeys) {
  test(journey.title, async ({ page }) => {
    for (const pin of sourcePinAnnotations) {
      const description = process.env[pin.environment] ?? '';
      expect(description, `${pin.environment} must pin the exact runner source`).toMatch(
        /^[0-9a-f]{40}$/
      );
      test.info().annotations.push({ type: pin.type, description });
    }
    let ownerRequestCount = 0;
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mockShellSession(page, ['HR_ADMIN'], {
      locale: 'en',
      permissions: FULL_PRODUCT_PERMISSIONS,
      appearance: {
        mode: 'light',
        density: 'standard',
        highContrast: true,
        reduceMotion: true,
      },
    });
    await mockHcmProductSurfaceAuthority(page);
    await page.route(journey.apiPattern, (route) => {
      ownerRequestCount += 1;
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'ERROR',
          message: `${journey.module} owner data is unavailable for the resilience journey`,
          correlationId: `g7-${journey.module.toLowerCase()}-responsive-accessibility`,
        }),
      });
    });

    await page.goto(journey.path);
    const workspace = page.getByTestId(journey.workspace);
    await expect(workspace).toBeVisible();
    await expect(workspace).toHaveAttribute('data-runtime-state', 'ON');
    await expect(page.getByText(journey.activeMarker, { exact: true }).first()).toBeVisible();
    await expect
      .poll(() => ownerRequestCount, {
        message: `${journey.module} active runtime must issue its owner workbench request`,
      })
      .toBeGreaterThan(0);
    await page.addStyleTag({ content: ':root { font-size: 200% !important; }' });
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await expectNoHorizontalOverflow(page, journey.path);

    const accessibility = await new AxeBuilder({ page }).include('main').analyze();
    const blocking = accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    );
    expect(blocking, `${journey.path} must pass serious accessibility checks`).toEqual([]);
  });
}
