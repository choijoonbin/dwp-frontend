import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';

import type { ProductMenuRoute } from '../../apps/dwp/src/routes/product-menu-manifest';
import { FULL_PRODUCT_PERMISSIONS, mockShellSession } from './shell-session';

const isExpectedFixtureTransportError = (text: string) =>
  text.includes('Failed to load resource') && text.includes('503');

function rolesForMenuRoute(productRoute: ProductMenuRoute): string[] {
  if (productRoute.shell === 'provider') return ['PROVIDER_ADMIN'];
  const roles = ['ADMIN', 'HR_ADMIN', 'PEOPLE_ADMIN', 'APP_CATALOG_ADMIN'];
  if (productRoute.shell === 'hcm' && productRoute.taskKind === 'team') roles.push('MANAGER');
  return roles;
}

export async function exerciseGovernedMenuRoute(
  page: Page,
  testInfo: TestInfo,
  productRoute: ProductMenuRoute,
  options: { allowFixtureTransportErrors?: boolean } = {}
): Promise<Locator> {
  const pageErrors: string[] = [];
  const javascriptConsoleErrors: string[] = [];
  const javascriptConsoleWarnings: string[] = [];
  const fixtureTransportFailures: string[] = [];
  let expectedFixtureTransportErrors = 0;
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('response', (response) => {
    if (response.status() !== 503) return;
    const requestUrl = new URL(response.url());
    fixtureTransportFailures.push(`${response.request().method()} ${requestUrl.pathname}`);
  });
  page.on('console', (message) => {
    if (message.type() === 'warning') {
      javascriptConsoleWarnings.push(message.text());
      return;
    }
    if (message.type() !== 'error') return;
    if (isExpectedFixtureTransportError(message.text())) {
      expectedFixtureTransportErrors += 1;
      return;
    }
    javascriptConsoleErrors.push(message.text());
  });
  await page.clock.install({
    time: new Date(
      productRoute.shell === 'provider' ? '2026-08-11T00:00:30Z' : '2026-08-11T00:20:00Z'
    ),
  });
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' });
  await mockShellSession(page, rolesForMenuRoute(productRoute), {
    locale: 'ko',
    displayName: productRoute.shell === 'provider' ? 'Provider Admin' : '박현우',
    jobTitle: productRoute.shell === 'provider' ? 'Platform operations lead' : '회사 관리자',
    permissions: FULL_PRODUCT_PERMISSIONS,
    appearance: { mode: 'light', density: 'standard', highContrast: false, reduceMotion: true },
  });
  await page.goto(productRoute.path);
  await page.waitForLoadState('domcontentloaded');
  await expect
    .poll(() => new URL(page.url()).pathname, {
      message: `${productRoute.id} redirected away from its canonical menu route`,
    })
    .toBe(productRoute.path);
  const productMain = page.locator('#dwp-main-content');
  await expect(productMain).toBeVisible({ timeout: 15_000 });
  await expect(page).not.toHaveURL(/\/(403|404)(?:$|\?)/);
  await expect(productMain.locator('h1').first()).toBeVisible({ timeout: 15_000 });
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.MuiSkeleton-root')).toHaveCount(0, { timeout: 15_000 });
  if (
    testInfo.project.name === 'mobile' &&
    productRoute.shell === 'approvals' &&
    productRoute.plane === 'management'
  ) {
    const compatibilityTenant = page.getByTestId('product-surface-compatibility-tenant');
    await expect(compatibilityTenant).toBeVisible();
    await expect(compatibilityTenant).toHaveText('SKAX');
  }
  if (productRoute.id === 'provider.overview') {
    await expect(page.getByRole('status')).toContainText('자동 갱신 중', { timeout: 15_000 });
  }
  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(horizontalOverflow, `${productRoute.path} has horizontal overflow`).toBeLessThanOrEqual(1);
  expect(pageErrors, `${productRoute.path} emitted page errors`).toEqual([]);
  expect(javascriptConsoleErrors, `${productRoute.path} emitted JavaScript console errors`).toEqual(
    []
  );
  expect(
    javascriptConsoleWarnings,
    `${productRoute.path} emitted JavaScript console warnings`
  ).toEqual([]);
  if (expectedFixtureTransportErrors > 0 || fixtureTransportFailures.length > 0) {
    const failureCount = Math.max(expectedFixtureTransportErrors, fixtureTransportFailures.length);
    const failureSummary = [...new Set(fixtureTransportFailures)].join(', ') || 'unknown endpoint';
    expect(
      options.allowFixtureTransportErrors ?? false,
      `${productRoute.path} rendered an approved-state baseline with ${failureCount} fixture transport error(s): ${failureSummary}`
    ).toBe(true);
    testInfo.annotations.push({
      type: 'expected-fixture-transport-error',
      description: `${failureCount} raw 503 response(s): ${failureSummary}`,
    });
  }
  testInfo.annotations.push({
    type: 'menu-contract',
    description: `${productRoute.shell}:${productRoute.path}`,
  });
  return productMain;
}
