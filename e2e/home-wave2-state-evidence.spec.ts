import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import {
  FULL_PRODUCT_PERMISSIONS,
  HOME_COMMUNICATIONS_FIXTURE,
  createHomeOverviewFixture,
  fulfillSuccess,
  mockShellSession,
} from './support/shell-session';
import { routeCanonicalHomeWorkspaceApps } from './support/home-launchpad-contract-fixture';

import type { Locator, Page } from '@playwright/test';

const FIXED_NOW = new Date('2026-08-11T00:30:00.000Z');
const OVERVIEW_ROUTE = '**/api/platform/v1/home/overview**';

test.setTimeout(120_000);

const MODE_LAYOUTS = {
  CLASSIC: {
    layoutScope: 'MODE_SCOPED_VIEW',
    deviceClasses: ['DESKTOP_WIDE', 'DESKTOP_STANDARD', 'MOBILE_STANDARD', 'MOBILE_COMPACT'],
  },
  FLOW_V1: {
    layoutScope: 'MODE_SCOPED_VIEW',
    deviceClasses: ['DESKTOP_WIDE', 'DESKTOP_STANDARD', 'MOBILE_STANDARD', 'MOBILE_COMPACT'],
  },
} as const;

const FLOW_WIDGETS = [
  { widgetKey: 'command-rail', visible: true, size: 'large', height: 'standard' },
  { widgetKey: 'schedule', visible: true, size: 'compact', height: 'standard' },
  { widgetKey: 'daily-brief', visible: true, size: 'compact', height: 'standard' },
  { widgetKey: 'focus', visible: true, size: 'compact', height: 'standard' },
  { widgetKey: 'activity', visible: false, size: 'compact', height: 'standard' },
  { widgetKey: 'focus-balance', visible: false, size: 'medium', height: 'short' },
  { widgetKey: 'meeting-load', visible: false, size: 'medium', height: 'short' },
] as const;

function freshOverview() {
  const base = createHomeOverviewFixture(['TENANT_ADMIN']);
  const generatedAt = FIXED_NOW.toISOString();
  return {
    ...base,
    work: {
      ...base.work,
      generatedAt,
      data: { ...base.work.data, generatedAt },
    },
    calendar: {
      ...base.calendar,
      generatedAt,
      data: { ...base.calendar.data, generatedAt },
    },
    communications: {
      status: 'AVAILABLE' as const,
      source: 'DWP_COMMUNICATIONS',
      generatedAt,
      data: { ...HOME_COMMUNICATIONS_FIXTURE, generatedAt },
      reason: null,
    },
    activity: {
      ...base.activity,
      generatedAt,
      data: { ...base.activity.data, generatedAt },
    },
    generatedAt,
  };
}

function overviewForState(state: 'empty' | 'partial' | 'forbidden' | 'stale') {
  const overview = freshOverview();
  if (state === 'empty') {
    return {
      ...overview,
      work: {
        ...overview.work,
        data: {
          ...overview.work.data,
          items: [],
          summary: { total: 0, dueSoon: 0, inProgress: 0, waiting: 0, completed: 0 },
        },
      },
      calendar: {
        ...overview.calendar,
        data: { ...overview.calendar.data, nextEvent: null, today: [], attention: [] },
      },
    };
  }
  if (state === 'partial') {
    return {
      ...overview,
      calendar: {
        status: 'UNAVAILABLE' as const,
        source: 'DWP_CALENDAR',
        generatedAt: FIXED_NOW.toISOString(),
        data: null,
        reason: 'UPSTREAM_UNAVAILABLE',
      },
    };
  }
  if (state === 'forbidden') {
    return {
      ...overview,
      work: {
        status: 'FORBIDDEN' as const,
        source: 'DWP_WORKSPACE',
        generatedAt: FIXED_NOW.toISOString(),
        data: null,
        reason: 'PERMISSION_REQUIRED',
      },
      calendar: {
        status: 'FORBIDDEN' as const,
        source: 'DWP_CALENDAR',
        generatedAt: FIXED_NOW.toISOString(),
        data: null,
        reason: 'PERMISSION_REQUIRED',
      },
    };
  }
  const staleAt = '2026-08-10T23:00:00.000Z';
  return {
    ...overview,
    work: { ...overview.work, generatedAt: staleAt },
    calendar: { ...overview.calendar, generatedAt: staleAt },
  };
}

async function prepareClassic(page: Page) {
  await page.clock.setFixedTime(FIXED_NOW);
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await mockShellSession(page, ['TENANT_ADMIN'], {
    locale: 'ko',
    displayName: '김미나',
    permissions: FULL_PRODUCT_PERMISSIONS,
    appearance: {
      mode: 'light',
      density: 'standard',
      highContrast: false,
      reduceMotion: true,
    },
  });
  await page.route('**/api/platform/v1/home-experience', (route) =>
    fulfillSuccess(route, {
      headline: null,
      subheadline: null,
      localizedContent: {},
      defaultLocale: 'ko',
      backgroundPosition: 'CENTER',
      overlayOpacity: 18,
      backgroundUrl: null,
      compositionPolicy: {
        schemaVersion: 3,
        experienceVariant: 'CLASSIC',
        personalCustomizationEnabled: true,
        governedZones: [
          {
            zoneKey: 'workspace-tools',
            placement: 'HERO',
            visible: true,
            size: 'full',
            sortOrder: 10,
          },
          {
            zoneKey: 'announcements',
            placement: 'CANVAS',
            visible: true,
            size: 'compact',
            sortOrder: 20,
          },
        ],
      },
      effectiveExperienceVariant: 'CLASSIC',
      advancedPersonalizationEnabled: false,
      composerEnabled: false,
      homePreferenceStore: 'LEGACY',
      homeContractCapabilities: [],
      version: 7,
    })
  );
  await routeCanonicalHomeWorkspaceApps(page);
}

async function routeOverview(page: Page, data: unknown) {
  await page.route(OVERVIEW_ROUTE, (route) => fulfillSuccess(route, data));
}

async function stabilizeVisual(page: Page) {
  await page.evaluate(async () => {
    document.querySelectorAll('vite-plugin-checker-error-overlay').forEach((node) => node.remove());
    const style = document.createElement('style');
    style.dataset.wave2VisualStability = 'true';
    style.textContent = '[data-testid="dwaion-launcher"] { visibility: hidden !important; }';
    document.head.append(style);
    await document.fonts.ready;
  });
}

async function expectNoHorizontalOverflow(page: Page) {
  const geometry = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(geometry.document).toBeLessThanOrEqual(geometry.viewport + 1);
}

async function expectNoSeriousAxeViolations(page: Page, include: string) {
  const result = await new AxeBuilder({ page }).include(include).analyze();
  expect(
    result.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
}

async function captureEvidence(
  page: Page,
  canonicalId: string,
  fixtureId: string,
  include = '#dwp-main-content'
) {
  test.info().annotations.push({ type: 'canonical-fixture', description: fixtureId });
  await stabilizeVisual(page);
  await expectNoHorizontalOverflow(page);
  await expectNoSeriousAxeViolations(page, include);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await expect(page).toHaveScreenshot(`home-wave2-${canonicalId}.png`, {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
    scale: 'css',
  });
}

async function captureViewportInteraction(
  page: Page,
  canonicalId: string,
  include = '#dwp-main-content'
) {
  await expectNoHorizontalOverflow(page);
  await expectNoSeriousAxeViolations(page, include);
  await expect(page).toHaveScreenshot(`home-wave2-${canonicalId}-interaction.png`, {
    animations: 'disabled',
    caret: 'hide',
    fullPage: false,
    maxDiffPixels: 100,
    scale: 'css',
  });
}

async function tabTo(page: Page, target: Locator, maximumTabs = 120, reverse = false) {
  for (let attempt = 0; attempt < maximumTabs; attempt += 1) {
    if (await target.evaluate((node) => node === document.activeElement)) return;
    await page.keyboard.press(reverse ? 'Shift+Tab' : 'Tab');
  }
  throw new Error(`Keyboard traversal did not reach ${await target.getAttribute('data-testid')}.`);
}

async function expectFocusableAboveToolbar(target: Locator, toolbar: Locator) {
  await target.evaluate((node) => node.scrollIntoView({ block: 'center', inline: 'nearest' }));
  await target.focus();
  await expect(target).toBeFocused();
  const geometry = await target.evaluate(
    (node, toolbarElement) => {
      const targetBounds = node.getBoundingClientRect();
      const toolbarBounds = (toolbarElement as HTMLElement).getBoundingClientRect();
      return {
        targetTop: targetBounds.top,
        targetBottom: targetBounds.bottom,
        toolbarTop: toolbarBounds.top,
        viewportHeight: window.innerHeight,
      };
    },
    await toolbar.elementHandle()
  );
  expect(geometry.targetTop).toBeGreaterThanOrEqual(0);
  expect(geometry.targetBottom).toBeLessThanOrEqual(geometry.toolbarTop + 1);
  expect(geometry.toolbarTop).toBeLessThan(geometry.viewportHeight);
}

async function configureViewport(page: Page, mobile: boolean) {
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 });
}

function classicPreference(version: number, presentation: 'balanced' | 'focused') {
  return {
    schemaVersion: 4,
    surfaceKey: 'workspace-home',
    customized: true,
    layout: { appLayout: null, presentation, widgets: FLOW_WIDGETS },
    version,
    updatedAt: FIXED_NOW.toISOString(),
  };
}

async function routeConflictPreference(page: Page) {
  let version = 1;
  await page.route('**/api/platform/v1/home-preferences', (route) => {
    if (route.request().method() === 'PUT') {
      version = 2;
      return route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ERROR', message: 'Version conflict' }),
      });
    }
    return fulfillSuccess(
      route,
      classicPreference(version, version === 1 ? 'balanced' : 'focused')
    );
  });
}

async function routeStablePreference(page: Page) {
  let preference = classicPreference(1, 'balanced');
  await page.route('**/api/platform/v1/home-preferences', (route) => {
    if (route.request().method() === 'PUT') {
      const payload = route.request().postDataJSON() as ReturnType<typeof classicPreference>;
      preference = {
        ...payload,
        version: preference.version + 1,
        updatedAt: FIXED_NOW.toISOString(),
      };
    }
    return fulfillSuccess(route, preference);
  });
}

async function enterClassicEdit(page: Page) {
  await page.goto('/?edit=home');
  const home = page.locator('[data-home-persisted-source-state]');
  await expect(home).toHaveAttribute('data-home-personal-customization-enabled', 'true');
  await expect(home).toHaveAttribute('data-home-persisted-source-state', 'ready');
  await expect(home).toHaveAttribute('data-home-editor-state', 'ready');
  await expect(page).toHaveURL(/(?:\?|&)edit=home(?:&|$)/u);
  const toolbar = page.locator('[data-workspace-composer-placement="floating"]');
  await expect(toolbar).toBeVisible();
  await toolbar.getByRole('button', { name: '집중', exact: true }).click();
  await expect(toolbar).toHaveAttribute('data-home-content-state', 'dirty');
  await expect(toolbar).toHaveAttribute('data-home-draft-preserved', 'true');
  return toolbar;
}

type EvidenceDeviceClass = (typeof MODE_LAYOUTS)['CLASSIC']['deviceClasses'][number];

const createDeviceLayouts = (viewId: string, density: 'comfortable' | 'compact' = 'comfortable') =>
  Object.fromEntries(
    MODE_LAYOUTS.CLASSIC.deviceClasses.map((deviceClass, index) => [
      deviceClass,
      {
        deviceLayoutId: `${viewId}-${deviceClass}`,
        viewId,
        deviceClass,
        overlay: {
          density,
          widgetOrder: ['schedule', 'daily-brief', 'focus'],
          widgetSizes: { schedule: index % 2 === 0 ? 'large' : 'compact' },
        },
        version: 1,
        viewVersion: 3,
        updatedAt: FIXED_NOW.toISOString(),
      },
    ])
  ) as Record<EvidenceDeviceClass, Record<string, unknown>>;

async function routeModeIsolatedHomeViews(page: Page) {
  const views = {
    CLASSIC: {
      viewId: 'wave2-classic-preset',
      viewKey: 'classic-preset',
      surfaceKey: 'workspace-home',
      modeKey: 'CLASSIC',
      name: 'Classic preset',
      isDefault: true,
      schemaVersion: 5,
      layout: { appLayout: null, presentation: 'focused', widgets: FLOW_WIDGETS },
      version: 3,
      customized: true,
      createdAt: '2026-08-01T00:00:00Z',
      updatedAt: FIXED_NOW.toISOString(),
      widgetConfigurations: {},
    },
    FLOW_V1: {
      viewId: 'wave2-flow-preset',
      viewKey: 'flow-preset',
      surfaceKey: 'workspace-home',
      modeKey: 'FLOW_V1',
      name: 'Flow preset',
      isDefault: true,
      schemaVersion: 5,
      layout: { appLayout: null, presentation: 'balanced', widgets: FLOW_WIDGETS },
      version: 3,
      customized: true,
      createdAt: '2026-08-01T00:00:00Z',
      updatedAt: FIXED_NOW.toISOString(),
      widgetConfigurations: {},
    },
  };
  const layouts = {
    CLASSIC: createDeviceLayouts(views.CLASSIC.viewId),
    FLOW_V1: createDeviceLayouts(views.FLOW_V1.viewId),
  };
  const requests: Array<{ method: string; modeKey: string | null; path: string }> = [];
  await page.route('**/api/platform/v1/home-experience', (route) =>
    fulfillSuccess(route, {
      headline: null,
      subheadline: null,
      localizedContent: {},
      defaultLocale: 'ko',
      backgroundPosition: 'RIGHT',
      overlayOpacity: 18,
      backgroundUrl: null,
      compositionPolicy: {
        schemaVersion: 4,
        experienceVariant: 'FLOW_V1',
        personalCustomizationEnabled: true,
        governedZones: [],
        modeLayouts: MODE_LAYOUTS,
      },
      effectiveExperienceVariant: 'FLOW_V1',
      advancedPersonalizationEnabled: true,
      composerEnabled: true,
      homePreferenceStore: 'VIEWS',
      homeContractCapabilities: [
        'HOME_COMPOSITION_V4',
        'MODE_SCOPED_HOME_VIEWS',
        'FOUR_DEVICE_LAYOUTS',
      ],
      version: 7,
    })
  );
  await page.route('**/api/platform/v1/home-views**', (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    requests.push({ method: request.method(), modeKey: url.searchParams.get('modeKey'), path });
    const collectionMatch = path.endsWith('/home-views');
    if (collectionMatch) {
      const modeKey = url.searchParams.get('modeKey') as keyof typeof views | null;
      return fulfillSuccess(route, modeKey && views[modeKey] ? [views[modeKey]] : []);
    }
    const deviceMatch = path.match(
      /\/home-views\/(wave2-(classic|flow)-preset)\/device-layouts(?:\/(DESKTOP_WIDE|DESKTOP_STANDARD|MOBILE_STANDARD|MOBILE_COMPACT))?$/u
    );
    if (deviceMatch) {
      const mode = deviceMatch[2] === 'classic' ? 'CLASSIC' : 'FLOW_V1';
      const deviceClass = deviceMatch[3] as EvidenceDeviceClass | undefined;
      if (request.method() === 'GET' && !deviceClass) {
        return fulfillSuccess(
          route,
          MODE_LAYOUTS[mode].deviceClasses.map((value) => layouts[mode][value])
        );
      }
      if (request.method() === 'PUT' && deviceClass) {
        const body = request.postDataJSON() as {
          overlay: Record<string, unknown>;
          viewVersion: number;
          version: number | null;
        };
        const previous = layouts[mode][deviceClass];
        views[mode].version += 1;
        const next = {
          ...previous,
          overlay: body.overlay,
          version: Number(previous.version) + 1,
          viewVersion: views[mode].version,
          updatedAt: FIXED_NOW.toISOString(),
        };
        layouts[mode][deviceClass] = next;
        return fulfillSuccess(route, next);
      }
    }
    if (path.endsWith('/revisions')) return fulfillSuccess(route, []);
    return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });
  await page.route('**/api/platform/v1/home-templates**', (route) => fulfillSuccess(route, []));
  return { layouts, requests, views };
}

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Wave 2 evidence uses canonical Chromium.');
  await prepareClassic(page);
});

test('C10-C13 render the real Classic Home state contract on desktop and mobile', async ({
  page,
}) => {
  const cases = [
    ['C10-D1440-EMPTY-r02', 'HOME_STATE_EMPTY_DESKTOP', 'empty', false],
    ['C10-M390-EMPTY-r01', 'HOME_STATE_EMPTY_MOBILE', 'empty', true],
    ['C11-D1440-PARTIAL-r02', 'HOME_STATE_PARTIAL_DESKTOP', 'partial', false],
    ['C11-M390-PARTIAL-r02', 'HOME_STATE_PARTIAL_MOBILE', 'partial', true],
    ['C12-D1440-FORBIDDEN-r02', 'HOME_STATE_FORBIDDEN_DESKTOP', 'forbidden', false],
    ['C12-M390-FORBIDDEN-r04', 'HOME_STATE_FORBIDDEN_MOBILE', 'forbidden', true],
    ['C13-D1440-STALE-r02', 'HOME_STATE_STALE_DESKTOP', 'stale', false],
    ['C13-M390-STALE-r03', 'HOME_STATE_STALE_MOBILE', 'stale', true],
  ] as const;

  for (const [canonicalId, fixtureId, state, mobile] of cases) {
    await page.unroute(OVERVIEW_ROUTE);
    await routeOverview(page, overviewForState(state));
    await configureViewport(page, mobile);
    await page.goto('/');
    const homeState = page
      .getByTestId('home-workspace-grid')
      .locator(`[data-home-content-state="${state}"]`);
    await expect(homeState).toBeVisible();
    if (state === 'empty') {
      const action = homeState.getByRole('button', { name: '새로 확인' });
      await expect(action).toBeVisible();
      expect((await action.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
    if (state === 'partial' || state === 'stale') {
      await expect(homeState).toHaveAttribute('data-home-content-preserved', 'true');
      await expect(homeState.locator('[data-classic-personal-summary]')).toBeVisible();
      await expect(homeState.locator('[data-home-state-sources]')).toBeVisible();
      await expect(homeState.getByRole('button', { name: '다시 시도' })).toBeVisible();
    }
    await captureEvidence(page, canonicalId, fixtureId);
  }
});

test('C14 initial loading keeps the two-card geometry on desktop and mobile', async ({ page }) => {
  const cases = [
    ['C14-D1440-INITIAL-LOADING-r02', 'HOME_STATE_INITIAL_LOADING_DESKTOP', false],
    ['C14-M390-INITIAL-LOADING-r02', 'HOME_STATE_INITIAL_LOADING_MOBILE', true],
  ] as const;

  for (const [canonicalId, fixtureId, mobile] of cases) {
    await page.unroute(OVERVIEW_ROUTE);
    let releaseRequest: (() => void) | undefined;
    await page.route(OVERVIEW_ROUTE, async (route) => {
      await new Promise<void>((resolve) => {
        releaseRequest = resolve;
      });
      await fulfillSuccess(route, freshOverview());
    });
    await configureViewport(page, mobile);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const layout = page.locator('[data-classic-summary-loading-layout]');
    await expect(layout).toBeVisible();
    await expect(layout.locator('[data-home-content-state="initial-loading"]')).toHaveCount(2);
    await captureEvidence(page, canonicalId, fixtureId);
    releaseRequest?.();
    await expect(layout).toHaveCount(0);
  }
});

test('C14 background refresh preserves verified content on desktop and mobile', async ({
  page,
}) => {
  const cases = [
    ['C14-D1440-BACKGROUND-REFRESH-r02', 'HOME_STATE_BACKGROUND_REFRESH_DESKTOP', false],
    ['C14-M390-BACKGROUND-REFRESH-r02', 'HOME_STATE_BACKGROUND_REFRESH_MOBILE', true],
  ] as const;

  for (const [canonicalId, fixtureId, mobile] of cases) {
    await page.unroute(OVERVIEW_ROUTE);
    let requestCount = 0;
    let releaseRefresh: (() => void) | undefined;
    await page.route(OVERVIEW_ROUTE, async (route) => {
      requestCount += 1;
      if (requestCount > 1) {
        await new Promise<void>((resolve) => {
          releaseRefresh = resolve;
        });
      }
      await fulfillSuccess(route, requestCount > 1 ? freshOverview() : overviewForState('stale'));
    });
    await configureViewport(page, mobile);
    await page.goto('/');
    const summary = page.getByTestId('home-workspace-grid');
    await summary
      .locator('[data-home-content-state="stale"]')
      .getByRole('button', { name: '다시 시도' })
      .click();
    const refreshing = summary.locator('[data-home-content-state="background-refresh"]');
    await expect(refreshing).toBeVisible();
    await expect(refreshing).toHaveAttribute('aria-busy', 'true');
    await expect(refreshing).toHaveAttribute('data-home-content-preserved', 'true');
    await expect(refreshing.locator('[data-classic-personal-summary]')).toBeVisible();
    await captureEvidence(page, canonicalId, fixtureId);
    releaseRefresh?.();
    await expect(refreshing).toHaveCount(0);
  }
});

test('C15 dirty editing remains visible and keyboard reachable on desktop and mobile', async ({
  page,
}) => {
  const cases = [
    ['C15-D1440-EDITOR-DIRTY-r01', 'HOME_STATE_DIRTY_DESKTOP', false],
    ['C15-M390-EDITOR-DIRTY-r01', 'HOME_STATE_DIRTY_MOBILE', true],
  ] as const;

  for (const [canonicalId, fixtureId, mobile] of cases) {
    await page.unroute(OVERVIEW_ROUTE);
    await routeOverview(page, freshOverview());
    await page.unroute('**/api/platform/v1/home-preferences');
    await routeStablePreference(page);
    await configureViewport(page, mobile);
    await page.goto('/');
    const toolbar = await enterClassicEdit(page);
    const save = toolbar.getByRole('button', { name: '저장', exact: true });
    const cancel = toolbar.getByRole('button', { name: '변경 취소' });
    await expect(save).toBeEnabled();
    await expect(cancel).toBeEnabled();
    expect((await save.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect((await cancel.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    if (mobile) {
      await expect(page.getByTestId('home-mobile-bottom-navigation')).toBeHidden();
      const focusTargets = [
        page.locator('[data-launchpad-tile]').first(),
        page.locator('[data-workspace-widget] [data-widget-footprint-trigger]').first(),
        page.locator('footer a').first(),
      ];
      for (const target of focusTargets) await expectFocusableAboveToolbar(target, toolbar);
      await captureViewportInteraction(page, canonicalId);
    } else {
      await save.focus();
      await expect(save).toBeFocused();
      await captureViewportInteraction(page, canonicalId);
    }
    await captureEvidence(page, canonicalId, fixtureId);
    if (mobile) {
      await toolbar.getByRole('button', { name: '생동감', exact: true }).click({ force: true });
      await expect(toolbar).toHaveAttribute('data-home-content-state', 'dirty');
      await cancel.click({ force: true });
      const discard = page.getByRole('alertdialog', { name: '홈 화면 변경을 취소할까요?' });
      await expect(discard).toBeVisible();
      await discard.getByRole('button', { name: '변경 취소' }).click();
      await expect(toolbar).toHaveCount(0);

      await page.setViewportSize({ width: 320, height: 568 });
      const compactToolbar = await enterClassicEdit(page);
      await expect(page.getByTestId('home-mobile-bottom-navigation')).toBeHidden();
      await expectFocusableAboveToolbar(
        page.locator('[data-launchpad-tile]').first(),
        compactToolbar
      );
      await expectFocusableAboveToolbar(page.locator('footer a').first(), compactToolbar);
      await compactToolbar
        .getByRole('button', { name: '생동감', exact: true })
        .click({ force: true });
      await expect(compactToolbar).toHaveAttribute('data-home-content-state', 'dirty');
      await compactToolbar.getByRole('button', { name: '변경 취소' }).click({ force: true });
      await page
        .getByRole('alertdialog', { name: '홈 화면 변경을 취소할까요?' })
        .getByRole('button', { name: '변경 취소' })
        .click();
      await expect(compactToolbar).toHaveCount(0);
    } else {
      await save.click();
      await expect(toolbar).toHaveCount(0);
    }
  }
});

test('C16 an actual 409 shows the conflict dialog and preserves the draft', async ({ page }) => {
  const cases = [
    ['C16-D1440-SAVE-CONFLICT-r02', 'HOME_STATE_CONFLICT_DESKTOP', false],
    ['C16-M390-SAVE-CONFLICT-r02', 'HOME_STATE_CONFLICT_MOBILE', true],
  ] as const;

  for (const [canonicalId, fixtureId, mobile] of cases) {
    await page.unroute(OVERVIEW_ROUTE);
    await routeOverview(page, freshOverview());
    await page.unroute('**/api/platform/v1/home-preferences');
    await routeConflictPreference(page);
    await configureViewport(page, mobile);
    await page.goto('/');
    const toolbar = await enterClassicEdit(page);
    await toolbar.getByRole('button', { name: '저장', exact: true }).click();
    const conflict = page.locator('[data-home-content-state="conflict"]');
    await expect(conflict).toBeVisible();
    await expect(conflict).toHaveAttribute('data-home-draft-preserved', 'true');
    await expect(toolbar).toHaveAttribute('data-home-content-state', 'dirty');
    await expect(toolbar.locator('[aria-label="집중"]')).toHaveAttribute('aria-pressed', 'true');
    const dialog = page.getByRole('dialog');
    const keepEditing = dialog.getByRole('button', { name: '계속 편집' });
    const saveTrigger = toolbar.getByRole('button', { name: '저장', exact: true });
    await tabTo(page, keepEditing, 8);
    await expect(keepEditing).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(dialog.locator(':focus')).toHaveCount(1);
    await page.keyboard.press('Tab');
    await expect(keepEditing).toBeFocused();
    await captureViewportInteraction(page, canonicalId, '[role="dialog"]');
    await captureEvidence(page, canonicalId, fixtureId);
    await page.keyboard.press('Enter');
    await expect(dialog).toHaveCount(0);
    await expect(saveTrigger).toBeFocused();
    await toolbar.getByRole('button', { name: '균형', exact: true }).click({ force: true });
    await expect(toolbar).not.toHaveAttribute('data-home-content-state', 'dirty');
    await toolbar.getByRole('button', { name: '변경 취소' }).click({ force: true });
    await expect(toolbar).toHaveCount(0);
  }
});

test('C17 round-trips isolated Classic and Flow overlays through the real device API', async ({
  page,
}) => {
  const fixtureId = 'HOME_SPEC_MODE_PRESET';
  await page.unroute(OVERVIEW_ROUTE);
  await routeOverview(page, freshOverview());
  const runtime = await routeModeIsolatedHomeViews(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.getByTestId('personal-home-shell')).toHaveAttribute(
    'data-home-experience-mode',
    'FLOW_V1'
  );
  await page.getByRole('button', { name: '홈 편집 옵션' }).click();
  await page.getByRole('menuitem', { name: /홈 설정/u }).click();
  const dialog = page.getByRole('dialog', { name: '나만의 업무 홈' });
  await dialog.getByRole('tab', { name: '기기별 보기' }).click();
  const options = dialog.locator('[data-home-device-class-option]');
  await expect(options).toHaveCount(4);
  expect(
    await options.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('value')))
  ).toEqual(['DESKTOP_WIDE', 'DESKTOP_STANDARD', 'MOBILE_STANDARD', 'MOBILE_COMPACT']);
  for (const option of await options.all()) {
    await option.focus();
    await page.keyboard.press('Space');
    await expect(option).toHaveAttribute('aria-pressed', 'true');
  }
  const before = structuredClone(runtime.layouts);
  await dialog.locator('[data-home-device-class-option="MOBILE_COMPACT"]').click();
  await dialog.getByRole('button', { name: '간결하게' }).click();
  await dialog.getByRole('button', { name: '저장', exact: true }).click();
  await expect
    .poll(
      () =>
        runtime.requests.filter(
          ({ method, path }) =>
            method === 'PUT' && path.endsWith('/wave2-flow-preset/device-layouts/MOBILE_COMPACT')
        ).length
    )
    .toBe(1);
  await expect
    .poll(
      () =>
        runtime.requests.filter(
          ({ method, path }) =>
            method === 'GET' && path.endsWith('/wave2-flow-preset/device-layouts')
        ).length
    )
    .toBeGreaterThanOrEqual(2);

  const roundTrip = await page.evaluate(async () => {
    const update = await fetch(
      '/api/platform/v1/home-views/wave2-classic-preset/device-layouts/DESKTOP_STANDARD',
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'b946e9d5-53c3-4f19-a2cf-2e17d279af7f',
        },
        body: JSON.stringify({
          overlay: {
            density: 'compact',
            widgetOrder: ['daily-brief', 'schedule', 'focus'],
            widgetSizes: { schedule: 'medium' },
          },
          viewVersion: 3,
          version: 1,
        }),
      }
    );
    if (!update.ok) throw new Error(`Classic device save failed: ${update.status}`);
    const read = async (viewId: string) => {
      const response = await fetch(`/api/platform/v1/home-views/${viewId}/device-layouts`);
      if (!response.ok) throw new Error(`Device requery failed: ${response.status}`);
      return response.json();
    };
    return {
      classic: await read('wave2-classic-preset'),
      flow: await read('wave2-flow-preset'),
    };
  });
  expect(roundTrip.classic.data).toEqual(
    MODE_LAYOUTS.CLASSIC.deviceClasses.map((value) => runtime.layouts.CLASSIC[value])
  );
  expect(roundTrip.flow.data).toEqual(
    MODE_LAYOUTS.FLOW_V1.deviceClasses.map((value) => runtime.layouts.FLOW_V1[value])
  );
  expect(runtime.layouts.FLOW_V1.MOBILE_COMPACT).not.toEqual(before.FLOW_V1.MOBILE_COMPACT);
  expect(runtime.layouts.CLASSIC.DESKTOP_STANDARD).not.toEqual(before.CLASSIC.DESKTOP_STANDARD);
  for (const deviceClass of ['DESKTOP_WIDE', 'DESKTOP_STANDARD', 'MOBILE_STANDARD'] as const) {
    expect(runtime.layouts.FLOW_V1[deviceClass]).toEqual(before.FLOW_V1[deviceClass]);
  }
  for (const deviceClass of ['DESKTOP_WIDE', 'MOBILE_STANDARD', 'MOBILE_COMPACT'] as const) {
    expect(runtime.layouts.CLASSIC[deviceClass]).toEqual(before.CLASSIC[deviceClass]);
  }
  await dialog.locator('[data-home-device-class-option="MOBILE_COMPACT"]').click();
  await expect(dialog.getByRole('button', { name: '간결하게' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await captureViewportInteraction(page, 'C17-MODE-PRESET', '[role="dialog"]');
  await captureEvidence(page, 'C17-MODE-PRESET', fixtureId, '[role="dialog"]');
});

test('C18 keeps the real Home keyboard path and disables motion', async ({ page }) => {
  const fixtureId = 'HOME_SPEC_ACCESSIBILITY_SPEC';
  await page.unroute(OVERVIEW_ROUTE);
  await routeOverview(page, freshOverview());
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const skipLink = page.getByRole('link', { name: '본문으로 건너뛰기' }).first();
  await tabTo(page, skipLink, 3);
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('personal-home-main')).toBeFocused();
  await page.goto('/');
  const modeControl = page.getByTestId('desktop-navigation-toggle');
  await tabTo(page, modeControl, 8);
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('personal-home-shell')).toHaveAttribute(
    'data-dwp-navigation-state',
    'compact'
  );
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('personal-home-shell')).toHaveAttribute(
    'data-dwp-navigation-state',
    'expanded'
  );
  const firstApp = page.locator('[data-launchpad-tile]').first();
  await tabTo(page, firstApp, 80);
  await expect(firstApp).toBeFocused();
  expect((await firstApp.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(firstApp).toBeFocused();
  const sectionAction = page.locator('[data-classic-resource-card] a').first();
  await tabTo(page, sectionAction, 100);
  await expect(sectionAction).toBeFocused();
  const footerAction = page.locator('footer a').first();
  await tabTo(page, footerAction, 120);
  await expect(footerAction).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(footerAction).toBeFocused();
  const motion = await page.evaluate(() => ({
    reduce: matchMedia('(prefers-reduced-motion: reduce)').matches,
    animations: Array.from(document.querySelectorAll<HTMLElement>('#dwp-main-content *')).filter(
      (element) => {
        const style = getComputedStyle(element);
        return style.animationName !== 'none' && parseFloat(style.animationDuration) > 0.001;
      }
    ).length,
    transitions: Array.from(document.querySelectorAll<HTMLElement>('#dwp-main-content *')).filter(
      (element) => parseFloat(getComputedStyle(element).transitionDuration) > 0.001
    ).length,
    smoothScroll: [document.documentElement, document.body].some(
      (element) => getComputedStyle(element).scrollBehavior === 'smooth'
    ),
    carousel: document
      .querySelector('[data-testid="home-news-carousel"]')
      ?.getAttribute('data-news-auto-rotation'),
  }));
  expect(motion).toEqual({
    reduce: true,
    animations: 0,
    transitions: 0,
    smoothScroll: false,
    carousel: 'paused-reduced-motion',
  });
  await captureViewportInteraction(page, 'C18-KEYBOARD-REDUCED-MOTION-SPEC-r02');
  await captureEvidence(page, 'C18-KEYBOARD-REDUCED-MOTION-SPEC-r02', fixtureId);
});

test('the canonical state sheet renders all nine production primitives', async ({ page }) => {
  const fixtureId = 'HOME_STATE_ALL_STATES_DESKTOP';
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto('/home-wave2-state-spec.html');
  const root = page.getByTestId('home-wave2-state-spec');
  await expect(root).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ko-KR');
  await expect(root.locator('[data-state-spec-kind]')).toHaveCount(9);
  for (const kind of [
    'initial-loading',
    'background-refresh',
    'empty',
    'partial',
    'forbidden',
    'stale',
    'widget-error',
    'dirty',
    'conflict',
  ]) {
    await expect(root.locator(`[data-home-content-state="${kind}"]`)).toBeVisible();
    await expect(root.locator(`[data-state-spec-contract="${kind}"]`)).toContainText(
      /콘텐츠 차단.*검증 콘텐츠 유지.*영향 원천.*마지막 성공.*다음 동작/su
    );
  }
  await expect(root).not.toContainText('{{');
  const actions = root.getByRole('button');
  await actions.first().focus();
  await expect(actions.first()).toBeFocused();
  await captureEvidence(
    page,
    'CLASSIC-STATE-COMPONENT-SPEC-A',
    fixtureId,
    '[data-testid="home-wave2-state-spec"]'
  );
});
