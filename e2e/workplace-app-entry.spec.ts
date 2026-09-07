import { expect, test } from '@playwright/test';

import {
  FULL_PRODUCT_PERMISSIONS,
  fulfillSuccess,
  mockShellSession,
} from './support/shell-session';
import { WORKSPACE_APPS_FIXTURE } from './support/runtime-access';

test.beforeEach(async ({ page }) => {
  await mockShellSession(page, ['TENANT_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
});

for (const source of ['fallback', 'catalog'] as const) {
  test(`the home Workplace app opens Workplace home using the ${source} route`, async ({
    page,
  }, testInfo) => {
    const app = {
      ...WORKSPACE_APPS_FIXTURE[0],
      id: 'dwp-rooms',
      name: 'Workplace',
      resourceKey: 'APP.WORKPLACE',
      launchTarget: '/workplace/home',
      iconKey: 'workplace',
    };
    await page.route('**/api/platform/v1/workspace/apps', (route) =>
      fulfillSuccess(route, source === 'catalog' ? [app] : [])
    );
    let launches = 0;
    await page.route('**/api/platform/v1/workspace/apps/dwp-rooms/launch', (route) => {
      launches += 1;
      return fulfillSuccess(route, {
        appId: app.id,
        launchMode: 'NATIVE',
        launchTarget: app.launchTarget,
        launchedAt: new Date().toISOString(),
      });
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'Open Workplace', exact: true }).click();
    await expect(page).toHaveURL(/\/workplace\/home(?:\?|$)/u);
    await expect(page.getByTestId('workplace-day-brief')).toBeVisible();
    expect(launches).toBe(source === 'catalog' ? 1 : 0);
    await page.screenshot({ path: testInfo.outputPath(`workplace-home-${source}.png`) });

    await page.goto('/workplace/explore');
    await expect(page).toHaveURL(/\/workplace\/explore(?:\?|$)/u);
  });
}
