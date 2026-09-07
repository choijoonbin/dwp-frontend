import { expect, test, type Locator, type Page } from '@playwright/test';

import {
  FULL_PRODUCT_PERMISSIONS,
  fulfillSuccess,
  mockShellSession,
} from './support/shell-session';
import { APPROVAL_HOME_FIXTURE, HR_HOME_FIXTURE } from './support/product-area-fixtures';
import { routeEmptyFlowExecutionSummaries } from './support/flow-home-provider-fixtures';
import {
  expectFiveColumnDockAlignment,
  expectNoHorizontalDocumentOverflow,
  waitForFlowHomeNavigation,
} from './support/flow-home-layout-contracts';
import { expectDesktopPurposeComposition } from './support/flow-home-wide-widget-contract';

type Store = 'LEGACY' | 'VIEWS';
type Presentation = 'balanced' | 'expressive';
const NOW = new Date('2026-08-11T00:30:00.000Z');

async function mockPresentationStore(page: Page, store: Store) {
  await page.clock.setFixedTime(NOW);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
    appearance: { mode: 'light', density: 'standard', highContrast: false, reduceMotion: true },
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
      defaultLocale: 'en',
      backgroundPosition: 'RIGHT',
      overlayOpacity: 18,
      backgroundUrl: null,
      launchpadConfiguration: { schemaVersion: 1, groups: [], placements: [] },
      compositionPolicy: {
        schemaVersion: 3,
        experienceVariant: 'FLOW_V1',
        personalCustomizationEnabled: true,
        governedZones: [],
      },
      effectiveExperienceVariant: 'FLOW_V1',
      advancedPersonalizationEnabled: store === 'VIEWS',
      composerEnabled: store === 'VIEWS',
      homePreferenceStore: store,
      version: 7,
    })
  );
  let layout = {
    appLayout: null,
    presentation: 'balanced' as Presentation,
    widgets: [
      { widgetKey: 'command-rail', visible: true, size: 'large', height: 'standard' },
      { widgetKey: 'schedule', visible: true, size: 'compact', height: 'standard' },
      { widgetKey: 'daily-brief', visible: true, size: 'compact', height: 'standard' },
      { widgetKey: 'focus', visible: true, size: 'compact', height: 'standard' },
      { widgetKey: 'activity', visible: true, size: 'compact', height: 'standard' },
      { widgetKey: 'focus-balance', visible: true, size: 'medium', height: 'short' },
      { widgetKey: 'meeting-load', visible: true, size: 'medium', height: 'short' },
    ],
  };
  let version = 3;
  let readGate = Promise.resolve();
  const saves: Presentation[] = [];
  const inactiveRequests: string[] = [];
  const record = () => ({
    schemaVersion: 5,
    surfaceKey: 'workspace-home',
    customized: true,
    layout,
    version,
    ...(store === 'VIEWS'
      ? {
          viewId: 'wide-view',
          viewKey: 'default',
          name: 'My home',
          isDefault: true,
          widgetConfigurations: {},
        }
      : {}),
  });
  await page.route(/\/api\/platform\/v1\/home-(?:preferences|views)(?:\/|\?|$)/u, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const active =
      store === 'VIEWS' ? path.includes('/home-views') : path.endsWith('/home-preferences');
    if (!active) inactiveRequests.push(`${request.method()} ${path}`);
    if (path.endsWith('/device-layouts')) return fulfillSuccess(route, []);
    if (request.method() === 'PUT') {
      const payload = request.postDataJSON() as { layout: typeof layout; version: number };
      expect(payload.version).toBe(version);
      layout = payload.layout;
      saves.push(layout.presentation);
      version += 1;
      return fulfillSuccess(route, record());
    }
    if (request.method() === 'GET') {
      await readGate;
      return fulfillSuccess(route, store === 'VIEWS' ? [record()] : record());
    }
    return route.fallback();
  });
  return {
    saves,
    inactiveRequests,
    pauseReads: () => {
      let release!: () => void;
      readGate = new Promise<void>((resolve) => {
        release = resolve;
      });
      return release;
    },
  };
}

async function shellWidth(flowHome: Locator) {
  return flowHome.evaluate((element) => element.getBoundingClientRect().width);
}

async function expectReadContracts(page: Page) {
  const flowHome = page.getByTestId('flow-home');
  await expectDesktopPurposeComposition(flowHome);
  await expectFiveColumnDockAlignment(
    flowHome.locator('[data-flow-dock-group] > ul'),
    'data-flow-dock-item'
  );
  await expectNoHorizontalDocumentOverflow(page, flowHome);
}

for (const width of [1920, 2560]) {
  for (const store of ['LEGACY', 'VIEWS'] as const) {
    test(`${store} Wide changes actual width immediately and persists at ${width}px`, async ({
      page,
      isMobile,
    }, testInfo) => {
      test.skip(isMobile, 'Wide presentation is a desktop workspace contract.');
      await page.setViewportSize({ width, height: 1080 });
      const server = await mockPresentationStore(page, store);
      await page.goto('/');
      const flowHome = page.getByTestId('flow-home');
      await expect(flowHome).toHaveAttribute('data-flow-home-presentation', 'balanced');
      await expectReadContracts(page);
      const balancedWidth = await shellWidth(flowHome);
      expect(balancedWidth).toBe(1680);
      const toolbar = page.locator('[data-workspace-composer-placement="floating"]');
      const wide = toolbar.getByRole('button', { name: 'Wide', exact: true });
      await page.getByRole('button', { name: 'Edit home' }).click();
      await waitForFlowHomeNavigation(page, true);
      await wide.click();
      await expect(wide).toHaveAttribute('aria-pressed', 'true');
      await expect(flowHome).toHaveAttribute('data-flow-home-presentation', 'expressive');
      await expect.poll(() => shellWidth(flowHome)).toBeGreaterThan(balancedWidth + 200);
      const wideWidth = await shellWidth(flowHome);
      expect(wideWidth).toBe(width);
      await expectFiveColumnDockAlignment(
        flowHome.locator('[data-launchpad-group-target]'),
        'data-launchpad-item'
      );
      await expectNoHorizontalDocumentOverflow(page, flowHome);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        fullPage: true,
        path: testInfo.outputPath(`wide-edit-${store.toLowerCase()}-${width}.png`),
      });
      expect(server.saves).toEqual([]);

      await toolbar.getByRole('button', { name: 'Cancel changes' }).click();
      await page.getByRole('alertdialog').getByRole('button', { name: 'Discard changes' }).click();
      await waitForFlowHomeNavigation(page, false);
      await expect(flowHome).toHaveAttribute('data-flow-home-presentation', 'balanced');
      await expect.poll(() => shellWidth(flowHome)).toBe(balancedWidth);
      expect(server.saves).toEqual([]);
      await page.getByRole('button', { name: 'Edit home' }).click();
      await waitForFlowHomeNavigation(page, true);
      await wide.click();
      await expect.poll(() => shellWidth(flowHome)).toBe(wideWidth);
      await toolbar.getByRole('button', { name: 'Save' }).click();
      await expect.poll(() => server.saves).toEqual(['expressive']);
      await waitForFlowHomeNavigation(page, false);
      const release = server.pauseReads();
      await page.reload({ waitUntil: 'domcontentloaded' });
      const skeleton = page.getByTestId('home-loading-skeleton');
      await expect(page.getByTestId('home-experience-bootstrap')).toBeVisible();
      await expect(skeleton).toBeVisible();
      await expect(skeleton).toHaveAttribute('data-home-loading-presentation', 'expressive');
      await expect(skeleton).toHaveCSS('max-width', '2560px');
      expect(await shellWidth(skeleton)).toBe(width);
      const loadingDock = await page.locator('[data-home-loading-dock]').boundingBox();
      expect(loadingDock).not.toBeNull();
      release();
      await expect(flowHome).toHaveAttribute('data-flow-home-presentation', 'expressive');
      await expect.poll(() => shellWidth(flowHome)).toBe(wideWidth);
      await expectReadContracts(page);
      const resolvedDock = await flowHome.locator('[data-flow-dock-shell]').boundingBox();
      expect(resolvedDock).not.toBeNull();
      if (!loadingDock || !resolvedDock) throw new Error('Both Dock phases must have bounds.');
      expect(Math.abs(loadingDock.x - resolvedDock.x)).toBeLessThanOrEqual(2);
      expect(Math.abs(loadingDock.width - resolvedDock.width)).toBeLessThanOrEqual(2);
      expect(Math.abs(loadingDock.height - resolvedDock.height)).toBeLessThanOrEqual(4);
      expect(server.inactiveRequests).toEqual([]);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        fullPage: true,
        path: testInfo.outputPath(`wide-read-${store.toLowerCase()}-${width}.png`),
      });
    });
  }
}
