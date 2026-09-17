import { expect, test } from '@playwright/test';

import {
  captureConsoleMessages,
  collectReducedMotionEvidence,
  expectNoHorizontalOverflow,
  expectNoSeriousAccessibilityViolations,
  tabTo,
} from './support/accessibility';
import {
  FULL_PRODUCT_PERMISSIONS,
  fulfillSuccess,
  mockShellSession,
} from './support/shell-session';
import { routeCanonicalHomeWorkspaceApps } from './support/home-launchpad-contract-fixture';
import {
  createHomeWave2NewsOverviewFixture,
  routeHomeWave2WidgetCatalog,
} from './support/home-wave2-acceptance-fixtures';
import {
  HOME_WAVE2_FLOW_WIDGETS as FLOW_WIDGETS,
  HOME_WAVE2_MODE_LAYOUTS as MODE_LAYOUTS,
} from './support/home-wave2-state-fixtures';
import { routeHomeWave4ShadowRuntime } from './support/home-wave4-runtime-fixtures';

import type { Locator, Page } from '@playwright/test';

const FIXED_NOW = new Date('2026-08-11T00:30:00.000Z');
const OVERVIEW_ROUTE = '**/api/platform/v1/home/overview**';
test.setTimeout(120_000);
function freshOverview(requiredNotice = true) {
  const overview = createHomeWave2NewsOverviewFixture(['TENANT_ADMIN']);
  if (requiredNotice || overview.communications.status !== 'AVAILABLE') return overview;
  return {
    ...overview,
    communications: {
      ...overview.communications,
      data: {
        ...overview.communications.data,
        featured: overview.communications.data.featured
          ? {
              ...overview.communications.data.featured,
              acknowledgementRequired: false,
              acknowledgementDueAt: null,
            }
          : null,
        summary: { ...overview.communications.data.summary, required: 0 },
      },
    },
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
  await routeHomeWave2WidgetCatalog(page);
  await routeHomeWave4ShadowRuntime(page);
}

async function routeOverview(page: Page, data: unknown) {
  await page.route(OVERVIEW_ROUTE, (route) => fulfillSuccess(route, data));
}

async function stabilizeVisual(page: Page) {
  await page.evaluate(async () => {
    document.querySelectorAll('vite-plugin-checker-error-overlay').forEach((node) => node.remove());
    const style = document.createElement('style');
    style.dataset.wave2VisualStability = 'true';
    style.textContent =
      '[data-testid="dwaion-launcher"], [role="tooltip"] { visibility: hidden !important; }';
    document.head.append(style);
    await document.fonts.ready;
  });
}

async function captureEvidence(
  page: Page,
  canonicalId: string,
  fixtureId: string,
  include = '#dwp-main-content',
  maxDiffPixels?: number
) {
  test.info().annotations.push({ type: 'canonical-fixture', description: fixtureId });
  await stabilizeVisual(page);
  await expectNoHorizontalOverflow(page);
  await expectNoSeriousAccessibilityViolations(page, include);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await expect(page).toHaveScreenshot(`home-wave2-${canonicalId}.png`, {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
    maxDiffPixels,
    scale: 'css',
  });
}

async function captureViewportInteraction(
  page: Page,
  canonicalId: string,
  include = '#dwp-main-content'
) {
  await expectNoHorizontalOverflow(page);
  await expectNoSeriousAccessibilityViolations(page, include);
  await expect(page).toHaveScreenshot(`home-wave2-${canonicalId}-interaction.png`, {
    animations: 'disabled',
    caret: 'hide',
    fullPage: false,
    maxDiffPixels: 100,
    scale: 'css',
  });
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
  let version = 7;
  await page.route('**/api/platform/v1/home-preferences', (route) => {
    if (route.request().method() === 'PUT') {
      version = 8;
      return route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ERROR', message: 'Version conflict' }),
      });
    }
    return fulfillSuccess(
      route,
      classicPreference(version, version === 7 ? 'balanced' : 'focused')
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
    MZ_V1: {
      viewId: 'wave2-mz-preset',
      viewKey: 'mz-preset',
      surfaceKey: 'workspace-home',
      modeKey: 'MZ_V1',
      name: 'MZ AI Stage preset',
      isDefault: true,
      schemaVersion: 5,
      layout: { appLayout: null, presentation: 'expressive', widgets: FLOW_WIDGETS },
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
    MZ_V1: createDeviceLayouts(views.MZ_V1.viewId, 'compact'),
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
        experienceVariant: 'CLASSIC',
        personalCustomizationEnabled: true,
        governedZones: [],
        modeLayouts: MODE_LAYOUTS,
      },
      effectiveExperienceVariant: 'CLASSIC',
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
      /\/home-views\/(wave2-(classic|flow|mz)-preset)\/device-layouts(?:\/(DESKTOP_WIDE|DESKTOP_STANDARD|MOBILE_STANDARD|MOBILE_COMPACT))?$/u
    );
    if (deviceMatch) {
      const mode =
        deviceMatch[2] === 'classic' ? 'CLASSIC' : deviceMatch[2] === 'flow' ? 'FLOW_V1' : 'MZ_V1';
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

test('C10 renders the required-notice complete state in the first Classic viewport', async ({
  page,
}) => {
  const cases = [
    ['C10-D1440-EMPTY-r02', 'HOME_STATE_EMPTY_DESKTOP', false],
    ['C10-M390-EMPTY-r01', 'HOME_STATE_EMPTY_MOBILE', true],
  ] as const;

  for (const [canonicalId, fixtureId, mobile] of cases) {
    await page.unroute(OVERVIEW_ROUTE);
    await routeOverview(page, freshOverview(false));
    await configureViewport(page, mobile);
    await page.goto('/');
    const root = page.getByTestId('classic-home');
    await expect(root).toContainText(
      '2026 하반기 통합 디지털 워크플레이스 고도화 방향과 전사 적용 일정 안내'
    );
    await expect(root).not.toContainText('Leadership town hall questions and answers');
    const notice = page.locator('[data-classic-required-notice="complete"]');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText('필수 확인을 모두 완료했습니다');
    await expect(notice).toContainText('현재 확인할 필수 항목이 없습니다');
    const noticeBounds = await notice.boundingBox();
    expect((noticeBounds?.y ?? Infinity) + (noticeBounds?.height ?? Infinity)).toBeLessThanOrEqual(
      mobile ? 844 : 900
    );
    await captureEvidence(page, canonicalId, fixtureId);
  }
});

test('C11-C13 target the accepted organization resource and preserve unaffected cards', async ({
  page,
}) => {
  const cases = [
    [
      'C11-D1440-PARTIAL-r02',
      'HOME_STATE_PARTIAL_DESKTOP',
      'partial',
      'handbook',
      'DWP_KNOWLEDGE',
      false,
    ],
    [
      'C11-M390-PARTIAL-r02',
      'HOME_STATE_PARTIAL_MOBILE',
      'partial',
      'handbook',
      'DWP_KNOWLEDGE',
      true,
    ],
    [
      'C12-D1440-FORBIDDEN-r02',
      'HOME_STATE_FORBIDDEN_DESKTOP',
      'forbidden',
      'it',
      'DWP_IT_SUPPORT',
      false,
    ],
    [
      'C12-M390-FORBIDDEN-r04',
      'HOME_STATE_FORBIDDEN_MOBILE',
      'forbidden',
      'it',
      'DWP_IT_SUPPORT',
      true,
    ],
    [
      'C13-D1440-STALE-r02',
      'HOME_STATE_STALE_DESKTOP',
      'stale',
      'workplace',
      'DWP_WORKPLACE',
      false,
    ],
    ['C13-M390-STALE-r03', 'HOME_STATE_STALE_MOBILE', 'stale', 'workplace', 'DWP_WORKPLACE', true],
  ] as const;

  for (const [canonicalId, fixtureId, state, region, source, mobile] of cases) {
    await page.unroute(OVERVIEW_ROUTE);
    await routeOverview(page, freshOverview());
    await configureViewport(page, mobile);
    await page.goto(`/?wave2ResourceState=${state}`);
    const root = page.getByTestId('classic-home');
    await expect(page.getByTestId('personal-home-shell')).toHaveAttribute(
      'data-home-experience-mode',
      'CLASSIC'
    );
    await expect(root.locator('[data-launchpad-tile]')).toHaveCount(18);
    await expect(root).toContainText(
      '2026 하반기 통합 디지털 워크플레이스 고도화 방향과 전사 적용 일정 안내'
    );
    await expect(root).not.toContainText('Leadership town hall questions and answers');
    const regionState = root.locator(`[data-classic-resource-state-region="${region}"]`);
    await expect(regionState).toHaveAttribute('data-classic-resource-source', source);
    await expect(regionState.locator(`[data-home-content-state="${state}"]`)).toBeVisible();
    await expect(root.locator('[data-classic-resource-card]')).toHaveCount(
      state === 'forbidden' ? 3 : 4
    );
    const resourceOrder = await root
      .locator('[data-classic-resource-grid]')
      .locator(':scope > *')
      .evaluateAll((items) =>
        items.map(
          (item) =>
            item.getAttribute('data-classic-resource-state-region') ??
            item
              .querySelector('[data-classic-resource-card]')
              ?.getAttribute('data-classic-resource-card')
        )
      );
    expect(resourceOrder).toEqual(['handbook', 'onboarding', 'workplace', 'it']);
    if (state === 'partial' || state === 'stale') {
      await expect(regionState.locator('[data-home-content-preserved="true"]')).toBeVisible();
      await expect(regionState.locator('[data-home-state-last-success]')).toBeVisible();
    }
    await expect(root.locator('[data-classic-resource-state-notice]')).toHaveCount(0);
    if (state === 'forbidden') {
      const disabledApps = root.locator('[data-launchpad-app-disabled]');
      await expect(disabledApps).toHaveCount(3);
      expect(
        await disabledApps.evaluateAll((apps) =>
          apps.map((app) => app.getAttribute('data-launchpad-app-disabled')).sort()
        )
      ).toEqual(['dwp-admin', 'ref-app-erp', 'ref-app-legacy']);
      for (const app of await disabledApps.all()) {
        await expect(app).toBeDisabled();
        await expect(app).toHaveAttribute('tabindex', '-1');
        await expect(app).toHaveAttribute('aria-label', /사용 권한 필요/u);
      }
      const knowledge = root.locator(
        '[data-launchpad-item="ref-app-knowledge"] [data-launchpad-tile]'
      );
      await expect(knowledge).toBeEnabled();
      await expect(knowledge).not.toHaveAttribute('data-launchpad-app-disabled');
      await knowledge.focus();
      await expect(knowledge).toBeFocused();
      await expect(root.locator('[data-classic-resource-card="handbook"]')).toBeVisible();
    }
    await captureEvidence(page, canonicalId, fixtureId);
  }
});

test('C14 loading and refresh stay in the workplace resource slot', async ({ page }) => {
  const cases = [
    [
      'C14-D1440-INITIAL-LOADING-r02',
      'HOME_STATE_INITIAL_LOADING_DESKTOP',
      'initial-loading',
      false,
    ],
    ['C14-M390-INITIAL-LOADING-r02', 'HOME_STATE_INITIAL_LOADING_MOBILE', 'initial-loading', true],
    [
      'C14-D1440-BACKGROUND-REFRESH-r02',
      'HOME_STATE_BACKGROUND_REFRESH_DESKTOP',
      'background-refresh',
      false,
    ],
    [
      'C14-M390-BACKGROUND-REFRESH-r02',
      'HOME_STATE_BACKGROUND_REFRESH_MOBILE',
      'background-refresh',
      true,
    ],
  ] as const;

  for (const [canonicalId, fixtureId, state, mobile] of cases) {
    await page.unroute(OVERVIEW_ROUTE);
    await routeOverview(page, freshOverview());
    await configureViewport(page, mobile);
    await page.goto(`/?wave2ResourceState=${state}`);
    const root = page.getByTestId('classic-home');
    await expect(root.locator('[data-launchpad-tile]')).toHaveCount(18);
    await expect(root).toContainText(
      '2026 하반기 통합 디지털 워크플레이스 고도화 방향과 전사 적용 일정 안내'
    );
    await expect(root).not.toContainText('Leadership town hall questions and answers');
    const region = root.locator('[data-classic-resource-state-region="workplace"]');
    await expect(region).toHaveAttribute('data-classic-resource-source', 'DWP_WORKPLACE');
    const homeState = region.locator(`[data-home-content-state="${state}"]`);
    await expect(homeState).toHaveAttribute('aria-busy', 'true');
    await expect(homeState).toHaveAttribute(
      'data-home-content-preserved',
      state === 'background-refresh' ? 'true' : 'false'
    );
    const resourceOrder = await root
      .locator('[data-classic-resource-grid]')
      .locator(':scope > *')
      .evaluateAll((items) =>
        items.map(
          (item) =>
            item.getAttribute('data-classic-resource-state-region') ??
            item
              .querySelector('[data-classic-resource-card]')
              ?.getAttribute('data-classic-resource-card')
        )
      );
    expect(resourceOrder).toEqual(['handbook', 'onboarding', 'workplace', 'it']);
    await expect(root.locator('[data-classic-resource-state-notice]')).toHaveCount(0);
    await captureEvidence(page, canonicalId, fixtureId);
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
    await captureEvidence(page, canonicalId, fixtureId, '#dwp-main-content', 200);
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
  const missingCloseLabelWarnings = captureConsoleMessages(page, ['flow.conflict.closeDialog']);
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
    await expect(conflict.locator('[data-conflict-summary="draft"]')).toContainText('기준: v7');
    await expect(conflict.locator('[data-conflict-summary="server"]')).toContainText(
      '최신 저장본 (Version 8)'
    );
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
  expect(missingCloseLabelWarnings).toEqual([]);
});

test('C17 compares Classic, Flow, and MZ in the real Studio after isolated round-trips', async ({
  page,
}) => {
  const fixtureId = 'HOME_SPEC_MODE_PRESET';
  await page.unroute(OVERVIEW_ROUTE);
  await routeOverview(page, freshOverview());
  const runtime = await routeModeIsolatedHomeViews(page);
  const modeWrites: Array<Record<string, unknown>> = [];
  page.on('request', (request) => {
    if (
      request.method() === 'PUT' &&
      new URL(request.url()).pathname === '/api/platform/v1/home-preferences/current-mode'
    ) {
      modeWrites.push(request.postDataJSON() as Record<string, unknown>);
    }
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?wave2ModePreset=comparison');
  await expect(page.getByTestId('personal-home-shell')).toHaveAttribute(
    'data-home-experience-mode',
    'CLASSIC'
  );
  await page.getByRole('button', { name: '홈 설정', exact: true }).click();
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
            method === 'PUT' && path.endsWith('/wave2-classic-preset/device-layouts/MOBILE_COMPACT')
        ).length
    )
    .toBe(1);
  await expect
    .poll(
      () =>
        runtime.requests.filter(
          ({ method, path }) =>
            method === 'GET' && path.endsWith('/wave2-classic-preset/device-layouts')
        ).length
    )
    .toBeGreaterThanOrEqual(2);

  const roundTrip = await page.evaluate(async () => {
    const update = async (url: string, density: string, widgetOrder: string[]) => {
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify({
          overlay: {
            density,
            widgetOrder,
            widgetSizes: { schedule: 'medium' },
          },
          viewVersion: 3,
          version: 1,
        }),
      });
      if (!response.ok) throw new Error(`Device save failed: ${response.status}`);
    };
    await update(
      '/api/platform/v1/home-views/wave2-flow-preset/device-layouts/DESKTOP_STANDARD',
      'compact',
      ['daily-brief', 'schedule', 'focus']
    );
    await update(
      '/api/platform/v1/home-views/wave2-mz-preset/device-layouts/MOBILE_STANDARD',
      'comfortable',
      ['focus', 'daily-brief', 'schedule']
    );
    const read = async (viewId: string) => {
      const response = await fetch(`/api/platform/v1/home-views/${viewId}/device-layouts`);
      if (!response.ok) throw new Error(`Device requery failed: ${response.status}`);
      return response.json();
    };
    return {
      classic: await read('wave2-classic-preset'),
      flow: await read('wave2-flow-preset'),
      mz: await read('wave2-mz-preset'),
    };
  });
  expect(roundTrip.classic.data).toEqual(
    MODE_LAYOUTS.CLASSIC.deviceClasses.map((value) => runtime.layouts.CLASSIC[value])
  );
  expect(roundTrip.flow.data).toEqual(
    MODE_LAYOUTS.FLOW_V1.deviceClasses.map((value) => runtime.layouts.FLOW_V1[value])
  );
  expect(roundTrip.mz.data).toEqual(
    MODE_LAYOUTS.MZ_V1.deviceClasses.map((value) => runtime.layouts.MZ_V1[value])
  );
  expect(runtime.layouts.CLASSIC.MOBILE_COMPACT).not.toEqual(before.CLASSIC.MOBILE_COMPACT);
  expect(runtime.layouts.FLOW_V1.DESKTOP_STANDARD).not.toEqual(before.FLOW_V1.DESKTOP_STANDARD);
  for (const deviceClass of ['DESKTOP_WIDE', 'MOBILE_STANDARD', 'MOBILE_COMPACT'] as const) {
    expect(runtime.layouts.FLOW_V1[deviceClass]).toEqual(before.FLOW_V1[deviceClass]);
  }
  for (const deviceClass of ['DESKTOP_WIDE', 'DESKTOP_STANDARD', 'MOBILE_STANDARD'] as const) {
    expect(runtime.layouts.CLASSIC[deviceClass]).toEqual(before.CLASSIC[deviceClass]);
  }
  expect(runtime.layouts.MZ_V1.MOBILE_STANDARD).not.toEqual(before.MZ_V1.MOBILE_STANDARD);
  for (const deviceClass of ['DESKTOP_WIDE', 'DESKTOP_STANDARD', 'MOBILE_COMPACT'] as const) {
    expect(runtime.layouts.MZ_V1[deviceClass]).toEqual(before.MZ_V1[deviceClass]);
  }
  await dialog.getByRole('tab', { name: '홈 모드' }).click();
  const comparison = dialog.locator('[data-home-studio-mode-surface]');
  await expect(comparison).toBeVisible();
  await expect(comparison.locator('[data-home-mode-preset-comparison]')).toHaveAttribute(
    'data-current-mode',
    'CLASSIC'
  );
  await expect(comparison.locator('[data-home-mode-preset-comparison]')).toHaveAttribute(
    'data-selected-mode',
    'CLASSIC'
  );
  await expect(comparison.locator('[data-home-mode-preset-comparison]')).toHaveAttribute(
    'data-dirty',
    'false'
  );
  await expect(comparison.locator('[data-mode-choice]')).toHaveCount(3);
  await expect(comparison.locator('[data-mode-preview="CLASSIC"]')).toContainText(
    '사내 소식 · 경영 브리핑'
  );
  await expect(comparison.locator('[data-mode-preview="FLOW_V1"]')).toContainText('우선 대기 큐');
  await expect(comparison.locator('[data-mode-preview="MZ_V1"]')).toContainText(
    '근거 기반 AI Stage'
  );
  await expect(comparison.locator('[data-shared-app-id]')).toHaveCount(18);
  const flowMode = comparison.getByRole('radio', { name: /Flow 업무 홈/u });
  const classicMode = comparison.getByRole('radio', { name: /Classic 조직 포털/u });
  await classicMode.focus();
  await page.keyboard.press('Space');
  await expect(comparison.locator('[data-home-mode-preset-comparison]')).toHaveAttribute(
    'data-dirty',
    'false'
  );
  await expect(comparison.getByRole('button', { name: '변경 사항 적용하기' })).toBeDisabled();
  await flowMode.focus();
  await page.keyboard.press('Space');
  await expect(comparison.locator('[data-home-mode-preset-comparison]')).toHaveAttribute(
    'data-dirty',
    'true'
  );
  await expect(comparison.getByRole('button', { name: '변경 사항 적용하기' })).toBeEnabled();
  await captureViewportInteraction(page, 'C17-MODE-PRESET', '[role="dialog"]');
  await captureEvidence(page, 'C17-MODE-PRESET', fixtureId, '[role="dialog"]');
  await comparison.getByRole('button', { name: '변경 사항 적용하기' }).click();
  await expect(comparison.locator('[data-home-mode-preset-comparison]')).toHaveAttribute(
    'data-current-mode',
    'FLOW_V1'
  );
  await expect(comparison.locator('[data-home-mode-preset-comparison]')).toHaveAttribute(
    'data-dirty',
    'false'
  );
  await comparison.locator('[data-mode-choice="MZ_V1"] input[type="radio"]').click();
  await expect(comparison.locator('[data-home-mode-preset-comparison]')).toHaveAttribute(
    'data-dirty',
    'true'
  );
  await comparison.getByRole('button', { name: '변경 사항 적용하기' }).click();
  await expect(comparison.locator('[data-home-mode-preset-comparison]')).toHaveAttribute(
    'data-current-mode',
    'MZ_V1'
  );
  await expect.poll(() => modeWrites.length).toBe(2);
  expect(modeWrites).toEqual([
    { currentMode: 'FLOW_V1', version: 0 },
    { currentMode: 'MZ_V1', version: 1 },
  ]);
  for (const body of modeWrites) expect(body).not.toHaveProperty('layout');
  await comparison.getByRole('radio', { name: /Classic 조직 포털/u }).click();
  await expect(comparison.locator('[data-home-mode-preset-comparison]')).toHaveAttribute(
    'data-dirty',
    'true'
  );
  await comparison.getByRole('button', { name: '취소' }).click();
  await expect(comparison.locator('[data-home-mode-preset-comparison]')).toHaveAttribute(
    'data-selected-mode',
    'MZ_V1'
  );
});

test('C18 keeps the real Home keyboard path and disables motion', async ({ page }) => {
  const unexpectedRouterWarnings = captureConsoleMessages(
    page,
    ['blocker on a POP navigation'],
    ['warning']
  );
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
  await skipLink.focus();
  await expect(skipLink).toBeFocused();
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
  const sectionAction = page.locator('a[data-classic-resource-card]').first();
  await tabTo(page, sectionAction, 100);
  await expect(sectionAction).toBeFocused();
  const footerAction = page.locator('footer a').first();
  await tabTo(page, footerAction, 120);
  await expect(footerAction).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(footerAction).toBeFocused();
  await page.unroute('**/api/platform/v1/home-preferences');
  await routeConflictPreference(page);
  const conflictToolbar = await enterClassicEdit(page);
  await conflictToolbar.getByRole('button', { name: '저장', exact: true }).click();
  const conflictDialog = page.getByRole('dialog');
  await expect(conflictDialog).toBeVisible();

  const motion = await collectReducedMotionEvidence(page);
  expect(motion).toEqual({
    reduce: true,
    offenders: [],
    smoothScroll: false,
    autoRotatingCarousels: 0,
    shellVisible: true,
    dialogVisible: true,
  });
  await test.info().attach('HOME_SPEC_ACCESSIBILITY_SPEC-motion-scope.json', {
    body: Buffer.from(JSON.stringify(motion, null, 2)),
    contentType: 'application/json',
  });
  await captureViewportInteraction(page, 'C18-KEYBOARD-REDUCED-MOTION-SPEC-r02', 'body');
  await conflictDialog.getByRole('button', { name: '계속 편집' }).click();
  await conflictToolbar.getByRole('button', { name: '균형', exact: true }).click({ force: true });
  await expect(conflictToolbar).not.toHaveAttribute('data-home-content-state', 'dirty');
  await conflictToolbar.getByRole('button', { name: '변경 취소' }).click({ force: true });
  await expect(conflictToolbar).toHaveCount(0);
  expect(unexpectedRouterWarnings).toEqual([]);
  await page.goto('/home-wave2-state-spec.html?board=c18');
  const spec = page.getByTestId('home-wave2-c18-spec');
  await expect(spec).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', /^ko(?:-KR)?$/u);
  await expect(spec.getByRole('heading', { level: 2 })).toHaveCount(6);
  await expect(spec).toContainText(/9-Step Keyboard Navigation Sequence/u);
  await expect(spec).toContainText(/Exactly 6 State Variants Cards/u);
  await expect(spec).toContainText(/Standard Motion vs Reduced Motion/u);
  await expect(spec).toContainText(/Single Document Scroll & Geometry/u);
  await captureEvidence(page, 'C18-KEYBOARD-REDUCED-MOTION-SPEC-r02', fixtureId, 'body');
  expect(unexpectedRouterWarnings).toEqual([]);
});
test('the canonical state sheet renders all nine production primitives', async ({ page }) => {
  const fixtureId = 'HOME_STATE_ALL_STATES_DESKTOP';
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto('/home-wave2-state-spec.html?board=primitives');
  const root = page.getByTestId('home-wave2-state-spec');
  await expect(root).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', /^ko(?:-KR)?$/u);
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
  await page.goto('/home-wave2-state-spec.html');
  await expect(page.getByTestId('home-wave2-state-spec')).toContainText(
    /5 Core Component State Variants/u
  );
  await captureEvidence(
    page,
    'CLASSIC-STATE-COMPONENT-SPEC-A',
    fixtureId,
    '[data-testid="home-wave2-state-spec"]'
  );
});
