import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type TestInfo } from '@playwright/test';

import { HR_PAY_FIXTURE } from './support/product-area-fixtures';
import { mockHcmProductSurfaceAuthority } from './support/product-surface-authority';
import { fulfillSuccess, mockShellSession } from './support/shell-session';

// Browser/DOM preparation only. All identity, current scope and source APIs are explicit mocks.
// No native payroll calculation/payment, server authorization or secure-download completion claim.
async function prepare(page: Page, testInfo: TestInfo) {
  const locale = testInfo.project.name.includes('-ko-') ? 'ko' : 'en';
  const mode = testInfo.project.name.includes('-dark') ? 'dark' : 'light';
  const highContrast = testInfo.project.name.includes('highcontrast');
  const reduceMotion = highContrast || testInfo.project.name.includes('text200');
  await page.clock.setFixedTime(new Date('2026-08-24T12:00:00Z'));
  await page.route('**/*', (route) => {
    const request = new URL(route.request().url());
    const base = new URL(testInfo.project.use.baseURL!);
    if (request.origin !== base.origin || request.pathname.startsWith('/api/')) {
      return route.abort('blockedbyclient');
    }
    return route.continue();
  });
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale,
    displayName: 'HRIS browser fixture employee',
    appearance: { mode, density: 'standard', highContrast, reduceMotion },
  });
  await mockHcmProductSurfaceAuthority(page);
  return { locale, text200: testInfo.project.name.includes('text200') };
}

async function assertReflow(page: Page) {
  const sizes = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(sizes.document).toBeLessThanOrEqual(sizes.viewport + 1);
}

test('actual PAY route keeps its governed source projection across viewport and preference variants', async ({
  page,
}, testInfo) => {
  const { locale, text200 } = await prepare(page, testInfo);
  const sourceName =
    locale === 'ko'
      ? '연구·개발 및 해외법인 구성원의 정기 급여 원천 상태 확인'
      : 'Regular payroll source status for research and international employees';
  await page.route('**/api/people/v1/hr/pay**', (route) =>
    fulfillSuccess(route, {
      ...HR_PAY_FIXTURE,
      nextCycle: {
        ...HR_PAY_FIXTURE.nextCycle,
        name: sourceName,
        bankAccount: 'SENSITIVE-EXTRA-MUST-NOT-RENDER',
      },
    })
  );
  const request = page.waitForRequest(
    (value) => new URL(value.url()).pathname === '/api/people/v1/hr/pay'
  );
  await page.goto('/hr/pay');
  expect(new URL((await request).url()).searchParams.getAll('contextScopeKey')).toEqual([
    'scope:hcm:self',
  ]);
  const workspace = page.getByTestId('hris-payroll-workspace');
  await expect(workspace).toBeVisible();
  await expect(workspace.getByText(sourceName, { exact: true })).toBeVisible();
  await expect(workspace).toContainText('REFERENCE');
  await expect(workspace).not.toContainText('SENSITIVE-EXTRA-MUST-NOT-RENDER');
  await expect(workspace.getByRole('button')).toHaveCount(0);
  if (text200) {
    // Text enlargement/reflow is automated; this is NOT native browser zoom or screen-reader signoff.
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });
    await expect(workspace.getByText(sourceName, { exact: true })).toBeVisible();
  }
  await assertReflow(page);
  const accessibility = await new AxeBuilder({ page })
    .include('[data-testid="hris-payroll-workspace"]')
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await page.keyboard.press('Tab');
  await expect.poll(() => page.evaluate(() => document.activeElement?.tagName)).not.toBe('BODY');
  await page.screenshot({ path: testInfo.outputPath('pay-source-projection.png'), fullPage: true });
});

test('source permission denial removes the PAY workspace without claiming empty or successful data', async ({
  page,
}, testInfo) => {
  await prepare(page, testInfo);
  await page.route('**/api/people/v1/hr/pay**', (route) =>
    route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ERROR', message: 'Fixture source permission denied' }),
    })
  );
  await page.goto('/hr/pay');
  await expect(page.locator('[data-query-state="permission"]')).toBeVisible();
  await expect(page.getByTestId('hris-payroll-workspace')).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText(HR_PAY_FIXTURE.nextCycle.name);
  await assertReflow(page);
  await page.screenshot({
    path: testInfo.outputPath('pay-source-permission-denied.png'),
    fullPage: true,
  });
});
