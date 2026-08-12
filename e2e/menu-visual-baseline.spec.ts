import { expect, test } from '@playwright/test';

import { PRODUCT_MENU_ROUTES } from '../apps/dwp/src/routes/product-menu-manifest';
import { FULL_PRODUCT_PERMISSIONS, mockShellSession } from './support/shell-session';

test.describe.configure({ mode: 'parallel' });

for (const productRoute of PRODUCT_MENU_ROUTES) {
  test(`${productRoute.id} keeps its governed menu baseline`, async ({ page }, testInfo) => {
    const runtimeErrors: string[] = [];
    page.on('pageerror', (error) => runtimeErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(message.text());
    });

    await page.clock.install({ time: new Date('2026-08-11T00:20:00Z') });
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' });
    await mockShellSession(
      page,
      productRoute.shell === 'provider'
        ? ['PROVIDER_ADMIN']
        : ['ADMIN', 'HR_ADMIN', 'PEOPLE_ADMIN'],
      {
        locale: 'ko',
        displayName: productRoute.shell === 'provider' ? 'Provider Admin' : '박현우',
        jobTitle: productRoute.shell === 'provider' ? 'Platform operations lead' : '회사 관리자',
        permissions: FULL_PRODUCT_PERMISSIONS,
        appearance: {
          mode: 'light',
          density: 'standard',
          highContrast: false,
          reduceMotion: true,
        },
      }
    );

    await page.goto(productRoute.path);
    await page.waitForLoadState('domcontentloaded');
    const productMain = page.locator('#dwp-main-content');
    await expect(productMain).toBeVisible({ timeout: 15_000 });
    await expect(page).not.toHaveURL(/\/(403|404)(?:$|\?)/);
    await expect(productMain.locator('h1').first()).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.MuiSkeleton-root')).toHaveCount(0, { timeout: 15_000 });
    if (productRoute.id === 'provider.overview') {
      await expect(page.getByRole('status')).toContainText('자동 갱신 중', { timeout: 15_000 });
    }

    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(horizontalOverflow, `${productRoute.path} has horizontal overflow`).toBeLessThanOrEqual(
      1
    );
    expect(runtimeErrors, `${productRoute.path} emitted browser runtime errors`).toEqual([]);

    await expect(page).toHaveScreenshot(`${productRoute.id}.png`, {
      animations: 'disabled',
      caret: 'hide',
      fullPage: false,
      maxDiffPixelRatio: 0.002,
      timeout: 15_000,
    });

    testInfo.annotations.push({
      type: 'menu-contract',
      description: `${productRoute.shell}:${productRoute.path}`,
    });
  });
}
