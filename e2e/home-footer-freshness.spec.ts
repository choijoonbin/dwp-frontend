import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

import {
  FULL_PRODUCT_PERMISSIONS,
  createHomeOverviewFixture,
  fulfillSuccess,
  mockShellSession,
} from './support/shell-session';
import { APPROVAL_HOME_FIXTURE, HR_HOME_FIXTURE } from './support/product-area-fixtures';
import { routeEmptyFlowExecutionSummaries } from './support/flow-home-provider-fixtures';
import { expectNoHorizontalDocumentOverflow } from './support/flow-home-layout-contracts';

const NOW = new Date('2026-08-11T00:30:00.000Z');
const scope = {
  en: 'Only data within your access permissions is shown.',
  ko: '접근 권한 내 데이터만 표시됩니다.',
};
type Scenario = 'flow' | 'classic' | 'loading' | 'error' | 'partial';

async function mockHome(page: Page, scenario: Scenario, locale: 'en' | 'ko' = 'en', dark = false) {
  await page.clock.setFixedTime(NOW);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale,
    permissions: FULL_PRODUCT_PERMISSIONS,
    appearance: {
      mode: dark ? 'dark' : 'light',
      density: 'standard',
      highContrast: false,
      reduceMotion: true,
    },
  });
  await routeEmptyFlowExecutionSummaries(page, NOW.toISOString());
  await page.route(/\/api\/approvals\/v1\/home(?:\?|$)/u, (route) =>
    fulfillSuccess(route, APPROVAL_HOME_FIXTURE)
  );
  await page.route('**/api/people/v1/hr/home', (route) => fulfillSuccess(route, HR_HOME_FIXTURE));
  await page.route('**/api/platform/v1/services/requests', (route) => fulfillSuccess(route, []));
  await page.route('**/api/platform/v1/workplace/bookings**', (route) => fulfillSuccess(route, []));
  await page.route('**/api/platform/v1/home-experience', (route) =>
    fulfillSuccess(route, {
      defaultLocale: locale,
      backgroundPosition: 'RIGHT',
      overlayOpacity: 18,
      backgroundUrl: null,
      launchpadConfiguration: { schemaVersion: 1, groups: [], placements: [] },
      compositionPolicy: {
        schemaVersion: 3,
        experienceVariant: scenario === 'classic' ? 'CLASSIC' : 'FLOW_V1',
        personalCustomizationEnabled: true,
        governedZones: [],
      },
      effectiveExperienceVariant: scenario === 'classic' ? 'CLASSIC' : 'FLOW_V1',
      advancedPersonalizationEnabled: false,
      composerEnabled: false,
      homePreferenceStore: 'LEGACY',
      version: 7,
    })
  );
  let release!: () => void;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/platform/v1/home-preferences', async (route) => {
    if (scenario === 'loading') await ready;
    if (scenario === 'error') {
      return route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
    }
    return route.fallback();
  });
  let requests = 0;
  let recovered = scenario !== 'partial';
  const overview = createHomeOverviewFixture(['WORKSPACE_MEMBER']);
  await page.route('**/api/platform/v1/home/overview**', (route) => {
    requests += 1;
    return fulfillSuccess(route, {
      ...overview,
      generatedAt: NOW.toISOString(),
      ...(recovered
        ? {}
        : { calendar: { ...overview.calendar, status: 'UNAVAILABLE', data: null } }),
    });
  });
  return {
    release,
    requestCount: () => requests,
    recover: () => {
      recovered = true;
    },
  };
}

async function expectScopeOnlyFooter(page: Page, locale: 'en' | 'ko') {
  const footer = page.locator('main footer');
  await expect(footer).toContainText(scope[locale]);
  await expect(footer).not.toContainText(/Last refreshed|마지막 새로고침|\d{1,2}:\d{2}/u);
  await expect(footer.locator('svg')).toHaveCount(0);
  await expect(footer.locator('a[href]')).toHaveCount(4);
  const overflow = await footer
    .locator('.MuiTypography-root')
    .evaluateAll((nodes) =>
      nodes
        .filter((node) => node.clientWidth > 0 && node.scrollWidth > node.clientWidth + 1)
        .map((node) => node.textContent)
    );
  expect(overflow).toEqual([]);
  await expectNoHorizontalDocumentOverflow(page, page.getByTestId('flow-home'));
  return footer;
}

async function captureFooter(footer: Locator, testInfo: TestInfo, name: string) {
  const path = testInfo.outputPath(`${name}.png`);
  await footer.screenshot({ path });
  await testInfo.attach(name, { path, contentType: 'image/png' });
}

for (const [width, locale] of [
  [1440, 'ko'],
  [1280, 'en'],
  [390, 'en'],
  [320, 'ko'],
] as const) {
  test(`Flow footer has no duplicate freshness at ${width}px in ${locale}`, async ({
    page,
    isMobile,
  }, testInfo) => {
    test.skip(isMobile !== width < 600, 'Use desktop or native mobile for its intended viewport.');
    await page.setViewportSize({ width, height: 900 });
    await mockHome(page, 'flow', locale);
    await page.goto('/');
    const header = page.locator('[data-flow-workscape]');
    await expect(header.getByRole('status').filter({ hasText: /\d{1,2}:\d{2}/u })).toHaveCount(1);
    const footer = await expectScopeOnlyFooter(page, locale);
    await captureFooter(footer, testInfo, `flow-footer-${width}-${locale}`);
  });
}

test('Flow footer remains readable at 200% text in dark and forced colors', async ({
  page,
  isMobile,
}, testInfo) => {
  test.skip(isMobile, 'The desktop accessibility matrix runs once.');
  await page.setViewportSize({ width: 1280, height: 900 });
  await mockHome(page, 'flow', 'ko', true);
  await page.goto('/');
  await expect(page.getByTestId('flow-home')).toBeVisible();
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.documentElement).fontSize))
    .toBe('32px');
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  await expect(page.getByTestId('flow-home')).toHaveAttribute('data-flow-large-text', 'true');
  await captureFooter(await expectScopeOnlyFooter(page, 'ko'), testInfo, 'flow-footer-dark-200');
  await page.emulateMedia({ forcedColors: 'active' });
  await captureFooter(await expectScopeOnlyFooter(page, 'ko'), testInfo, 'flow-footer-forced-200');
});

test('partial Flow health keeps its upper retry and timestamp without a footer duplicate', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'Health recovery is verified once.');
  const server = await mockHome(page, 'partial');
  await page.goto('/');
  const health = page.locator('[data-flow-health-strip]');
  await expect(health).toHaveAttribute('data-flow-health-state', 'partial');
  const retry = health.getByRole('button', { name: 'Reload work data' });
  await retry.focus();
  await expect(retry).toBeFocused();
  await expectScopeOnlyFooter(page, 'en');
  const requests = server.requestCount();
  server.recover();
  await retry.press('Enter');
  await expect.poll(server.requestCount).toBeGreaterThan(requests);
  await expect(page.locator('[data-flow-workscape]')).toContainText(/Updated \d{1,2}:\d{2}/u);
  await expectScopeOnlyFooter(page, 'en');
});

for (const scenario of ['classic', 'loading', 'error'] as const) {
  test(`${scenario} Home retains footer freshness when there is no ready Flow header`, async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'Fallback freshness ownership is verified once.');
    const server = await mockHome(page, scenario);
    await page.goto('/');
    if (scenario === 'classic') await expect(page.getByTestId('home-workspace-grid')).toBeVisible();
    if (scenario === 'loading')
      await expect(page.getByTestId('home-experience-bootstrap')).toBeVisible();
    if (scenario === 'error') await expect(page.getByTestId('home-experience-error')).toBeVisible();
    await expect(page.getByTestId('flow-home')).toHaveCount(0);
    const footer = page.locator('main footer');
    await expect(footer).toContainText(/Last refreshed \d{1,2}:\d{2}/u);
    await expect(footer).not.toContainText(scope.en);
    await expect(footer.locator('svg')).toHaveCount(1);
    if (scenario === 'loading') {
      server.release();
      await expectScopeOnlyFooter(page, 'en');
    }
  });
}
