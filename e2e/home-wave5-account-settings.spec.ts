import { expect, test } from '@playwright/test';

import {
  FULL_PRODUCT_PERMISSIONS,
  fulfillSuccess,
  mockShellSession,
} from './support/shell-session';
import { widgetRegistryEffectiveCatalog, widgetRegistryReadiness } from './support/widget-registry';

import type { Page, Route } from '@playwright/test';

test.setTimeout(90_000);

const NOW = '2026-09-16T01:00:00Z';
type WidgetPreference = {
  widgetKey: string;
  visible: boolean;
  size: 'compact' | 'large' | 'medium';
  height: 'short' | 'standard';
};

const WIDGETS: readonly WidgetPreference[] = [
  { widgetKey: 'command-rail', visible: true, size: 'large', height: 'standard' },
  { widgetKey: 'schedule', visible: true, size: 'compact', height: 'standard' },
  { widgetKey: 'daily-brief', visible: true, size: 'compact', height: 'standard' },
  { widgetKey: 'focus', visible: true, size: 'compact', height: 'standard' },
  { widgetKey: 'activity', visible: true, size: 'compact', height: 'standard' },
  { widgetKey: 'focus-balance', visible: true, size: 'medium', height: 'short' },
  { widgetKey: 'meeting-load', visible: true, size: 'medium', height: 'short' },
] as const;

function layout(
  presentation: 'balanced' | 'focused' | 'expressive' = 'balanced',
  widgets: readonly WidgetPreference[] = WIDGETS
) {
  return { appLayout: null, presentation, widgets: widgets.map((widget) => ({ ...widget })) };
}

function homeView(
  viewId: string,
  name: string,
  version: number,
  isDefault: boolean,
  presentation: 'balanced' | 'focused' | 'expressive' = 'balanced'
) {
  return {
    viewId,
    viewKey: viewId,
    surfaceKey: 'workspace-home',
    modeKey: 'FLOW_V1',
    name,
    isDefault,
    schemaVersion: 5,
    layout: layout(presentation),
    version,
    customized: true,
    createdAt: NOW,
    updatedAt: NOW,
    widgetConfigurations: {},
  };
}

function unavailableOverviewSection(source: string) {
  return { status: 'UNAVAILABLE', source, generatedAt: NOW, data: null, reason: 'TEST_FIXTURE' };
}

function hundredDefinitionCatalog() {
  const base = widgetRegistryEffectiveCatalog();
  const nativeItems = base.contexts[0]!.items;
  const partnerItems = Array.from({ length: 93 }, (_, offset) => {
    const index = offset + 7;
    return {
      definitionId: `70000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      definitionKey: `partner.widget-${index}`,
      legacyWidgetKey: null,
      resolvedVersionId: `80000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      semanticVersion: '1.0.0',
      effectiveState: 'AVAILABLE' as const,
      reasonCodes: ['AVAILABLE' as const],
      placementCapabilities: { canAdd: true, canHide: true, canMove: true, canResize: true },
      addedInstanceCount: index < 30 ? 1 : 0,
    };
  });
  return {
    ...base,
    catalogRevision: 'catalog-100',
    hostContext: { ...base.hostContext, resolvedHostMode: 'FLOW' as const },
    contexts: [
      {
        ...base.contexts[0]!,
        placementContext: 'FLOW_PERSONAL' as const,
        capabilities: {
          ...base.contexts[0]!.capabilities,
          libraryRead: true,
          legacyPlacementWrite: false,
          instanceV6Write: false,
        },
        items: [...nativeItems, ...partnerItems],
      },
    ],
  };
}

type AccountHomeRouteOptions = Readonly<{
  catalog?: ReturnType<typeof widgetRegistryEffectiveCatalog>;
  emptyViews?: boolean;
  widgets?: readonly WidgetPreference[];
}>;

async function routeAccountHome(page: Page, options: AccountHomeRouteOptions = {}) {
  const defaultView = {
    ...homeView('view-default', 'My home', 5, true),
    layout: layout('balanced', options.widgets),
  };
  const state = {
    views: options.emptyViews ? [] : [defaultView],
    conflictCount: 0,
    submittedDraft: null as null | Record<string, unknown>,
    reappliedDraft: null as null | Record<string, unknown>,
    restoredRevision: null as null | string,
  };

  await page.route('**/api/platform/v1/widget-catalog/readiness', (route) =>
    fulfillSuccess(route, widgetRegistryReadiness())
  );
  await page.route('**/api/platform/v1/widget-catalog/effective**', (route) => {
    const catalog = options.catalog ?? widgetRegistryEffectiveCatalog();
    return fulfillSuccess(route, {
      ...catalog,
      hostContext: { ...catalog.hostContext, resolvedHostMode: 'FLOW' },
      contexts: catalog.contexts.map((context) => ({
        ...context,
        placementContext: 'FLOW_PERSONAL',
        capabilities: {
          ...context.capabilities,
          legacyPlacementWrite: true,
        },
      })),
    });
  });

  await page.route('**/api/platform/v1/home-experience', (route) =>
    fulfillSuccess(route, {
      headline: null,
      subheadline: null,
      localizedContent: {},
      defaultLocale: 'en',
      backgroundPosition: 'RIGHT',
      overlayOpacity: 18,
      backgroundUrl: null,
      launchpadConfiguration: { schemaVersion: 1, groups: [], placements: [] },
      compositionPolicy: {
        schemaVersion: 4,
        experienceVariant: 'FLOW_V1',
        personalCustomizationEnabled: true,
        governedZones: [],
        modeLayouts: {
          CLASSIC: {
            layoutScope: 'MODE_SCOPED_VIEW',
            deviceClasses: [
              'DESKTOP_WIDE',
              'DESKTOP_STANDARD',
              'MOBILE_STANDARD',
              'MOBILE_COMPACT',
            ],
          },
          FLOW_V1: {
            layoutScope: 'MODE_SCOPED_VIEW',
            deviceClasses: [
              'DESKTOP_WIDE',
              'DESKTOP_STANDARD',
              'MOBILE_STANDARD',
              'MOBILE_COMPACT',
            ],
          },
        },
      },
      effectiveExperienceVariant: 'FLOW_V1',
      advancedPersonalizationEnabled: true,
      composerEnabled: false,
      homePreferenceStore: 'VIEWS',
      homeContractCapabilities: [
        'HOME_COMPOSITION_V4',
        'MODE_SCOPED_HOME_VIEWS',
        'FOUR_DEVICE_LAYOUTS',
      ],
      version: 9,
      updatedAt: NOW,
    })
  );
  await page.route('**/api/platform/v1/home-preferences', (route) =>
    fulfillSuccess(route, {
      schemaVersion: 5,
      surfaceKey: 'workspace-home',
      customized: true,
      allowedModes: ['CLASSIC', 'FLOW_V1', 'MZ_V1'],
      enabledModes: ['CLASSIC', 'FLOW_V1', 'MZ_V1'],
      disabledModeReasons: {},
      defaultMode: 'CLASSIC',
      currentMode: 'FLOW_V1',
      warnings: [],
      layout: layout(),
      version: 1,
      updatedAt: NOW,
    })
  );
  await page.route('**/api/platform/v1/home/overview**', (route) =>
    fulfillSuccess(route, {
      audience: { profile: 'MEMBER', ruleVersion: 'wave5-test', reasons: [] },
      work: unavailableOverviewSection('WORK'),
      calendar: unavailableOverviewSection('CALENDAR'),
      communications: unavailableOverviewSection('COMMUNICATIONS'),
      activity: unavailableOverviewSection('ACTIVITY'),
      recommendations: unavailableOverviewSection('RECOMMENDATIONS'),
      generatedAt: NOW,
    })
  );
  await page.route('**/api/platform/v1/home-templates**', (route) => fulfillSuccess(route, []));
  await page.route('**/api/platform/v1/home-views**', async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (request.method() === 'GET' && path.endsWith('/home-views')) {
      return fulfillSuccess(route, state.views);
    }
    if (request.method() === 'POST' && path.endsWith('/home-views')) {
      const requestBody = request.postDataJSON() as {
        name: string;
        viewKey: string;
        modeKey?: 'CLASSIC' | 'FLOW_V1' | 'MZ_V1';
        makeDefault: boolean;
        layout: ReturnType<typeof layout>;
      };
      const created = {
        ...homeView('view-keyboard', requestBody.name, 0, requestBody.makeDefault),
        viewKey: requestBody.viewKey,
        modeKey: requestBody.modeKey ?? 'FLOW_V1',
        layout: requestBody.layout,
      };
      state.views.push(created);
      return fulfillSuccess(route, created);
    }
    if (request.method() === 'GET' && path.endsWith('/device-layouts')) {
      return fulfillSuccess(route, []);
    }
    if (request.method() === 'GET' && path.endsWith('/revisions')) {
      const viewId = path.split('/').at(-2)!;
      return fulfillSuccess(route, [
        {
          revisionId: 'revision-wave5-1',
          viewId,
          revisionNumber: 1,
          source: 'USER',
          changeSummary: 'created',
          schemaVersion: 5,
          snapshot: {
            snapshotVersion: 1,
            legacyLayoutOnly: false,
            view: { name: 'Keyboard home', modeKey: 'FLOW_V1', schemaVersion: 5, layout: layout() },
            widgetConfigurations: {},
            deviceLayouts: {},
          },
          createdAt: NOW,
          createdBy: 42,
        },
      ]);
    }
    const restoreMatch = path.match(
      /^\/api\/platform\/v1\/home-views\/([^/]+)\/revisions\/([^/]+)\/restore$/u
    );
    if (request.method() === 'POST' && restoreMatch) {
      state.restoredRevision = restoreMatch[2]!;
      const current = state.views.find((view) => view.viewId === restoreMatch[1])!;
      const restored = { ...current, version: current.version + 1, updatedAt: NOW };
      state.views = state.views.map((view) => (view.viewId === restored.viewId ? restored : view));
      return fulfillSuccess(route, restored);
    }
    if (request.method() === 'PUT' && path.endsWith('/home-views/view-keyboard')) {
      const requestBody = request.postDataJSON() as Record<string, unknown> & {
        version: number;
        layout: ReturnType<typeof layout>;
      };
      if (state.conflictCount === 0) {
        state.conflictCount += 1;
        state.submittedDraft = requestBody;
        const latest = {
          ...homeView('view-keyboard', 'Keyboard home', 2, false, 'focused'),
          viewKey: state.views.find((view) => view.viewId === 'view-keyboard')!.viewKey,
        };
        state.views = state.views.map((view) => (view.viewId === latest.viewId ? latest : view));
        return route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'ERROR',
            success: false,
            message: 'Home view changed.',
            errorCode: 'HOME_VIEW_VERSION_CONFLICT',
            data: {
              operation: 'UPDATE_VIEW',
              expectedVersion: 1,
              actualVersion: 2,
              submittedDraft: requestBody,
              latestView: latest,
              expectedDeviceVersion: null,
              actualDeviceVersion: null,
              latestDeviceLayout: null,
              changedFields: ['layout.presentation'],
            },
          }),
        });
      }
      state.reappliedDraft = requestBody;
      const current = state.views.find((view) => view.viewId === 'view-keyboard')!;
      const saved = {
        ...current,
        layout: requestBody.layout,
        version: 3,
        updatedAt: NOW,
      };
      state.views = state.views.map((view) => (view.viewId === saved.viewId ? saved : view));
      return fulfillSuccess(route, saved);
    }
    return route.fallback();
  });
  return state;
}

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Wave 5 Account evidence runs once on desktop.');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
});

test('keyboard-only create, edit, conflict reapply, and revision restore preserve the draft', async ({
  page,
}) => {
  const state = await routeAccountHome(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/account/settings/home/views');

  const name = page.getByLabel('New home name');
  await name.focus();
  await page.keyboard.type('Keyboard home');
  await page.keyboard.press('Enter');
  const createdRow = page.locator('li').filter({ hasText: 'Keyboard home' });
  await expect(createdRow).toBeVisible();
  const edit = createdRow.getByRole('button', { name: 'Edit layout' });
  await edit.press('Enter');
  await expect(page).toHaveURL(/\/account\/settings\/home\/layout$/u);

  const hide = page.getByRole('button', { name: 'Hide' });
  await hide.press('Enter');
  await expect(page.locator('[data-home-studio-dirty="true"]').first()).toBeVisible();
  await page.keyboard.press('Control+s');

  const conflict = page.getByRole('dialog', { name: 'Your home changed in another session' });
  await expect(conflict).toBeVisible();
  await expect(conflict.getByText('Safely preserved in this work tab')).toBeVisible();
  expect(state.submittedDraft).not.toBeNull();
  const reapply = conflict.getByRole('button', { name: 'Reapply my draft' });
  await reapply.press('Enter');
  await expect(conflict).toHaveCount(0);
  await expect(page.locator('[data-home-studio-dirty="false"]').first()).toBeVisible();
  expect(state.reappliedDraft).toMatchObject({ version: 2 });
  expect((state.reappliedDraft!.layout as ReturnType<typeof layout>).presentation).toBe('focused');
  expect(
    (state.reappliedDraft!.layout as ReturnType<typeof layout>).widgets.map(
      (widget) => widget.widgetKey
    )
  ).toEqual([
    'command-rail',
    'schedule',
    'daily-brief',
    'focus',
    'activity',
    'focus-balance',
    'meeting-load',
  ]);
  expect(
    (state.reappliedDraft!.layout as ReturnType<typeof layout>).widgets.find(
      (widget) => widget.widgetKey === 'command-rail'
    )?.visible
  ).toBe(false);

  const history = page.getByRole('tab', { name: 'Version history' });
  await history.press('Enter');
  await expect(page).toHaveURL(/\/account\/settings\/home\/history$/u);
  const restore = page.getByRole('button', { name: 'Restore this version' });
  await restore.press('Enter');
  const confirmation = page.getByRole('dialog', { name: 'Restore this version' });
  await confirmation.getByRole('button', { name: 'Restore this version' }).press('Enter');
  await expect.poll(() => state.restoredRevision).toBe('revision-wave5-1');
  await expect(page.getByText('The selected version was restored as a new version.')).toBeVisible();
});

test('every Account Home route supports direct entry and hard refresh', async ({ page }) => {
  await routeAccountHome(page);
  await page.goto('/account/settings/home');
  await expect(page).toHaveURL(/\/account\/settings\/home\/overview$/u);
  await expect(page.getByRole('tab', { name: 'Overview' })).toHaveAttribute(
    'aria-selected',
    'true'
  );
  await page.reload();
  await expect(page).toHaveURL(/\/account\/settings\/home\/overview$/u);

  const sections = [
    ['overview', 'Overview'],
    ['views', 'My homes'],
    ['layout', 'Layout studio'],
    ['appearance', 'Layout style'],
    ['devices', 'Device views'],
    ['templates', 'Templates'],
    ['suggestions', 'AI proposal'],
    ['history', 'Version history'],
  ] as const;

  for (const [path, tabName] of sections) {
    await page.goto(`/account/settings/home/${path}`);
    await expect(page.getByRole('tab', { name: tabName })).toHaveAttribute('aria-selected', 'true');
    await page.reload();
    await expect(page.getByRole('tab', { name: tabName })).toHaveAttribute('aria-selected', 'true');
  }
});

test('an empty mode creates its default view on the first appearance save and keeps it after navigation', async ({
  page,
}) => {
  const state = await routeAccountHome(page, { emptyViews: true });
  await page.goto('/account/settings/home/appearance');

  const focused = page.locator('[data-appearance-option="focused"]');
  await expect(focused).toBeEnabled();
  await focused.click();
  await expect.poll(() => state.views.length).toBe(1);
  expect(state.views[0]).toMatchObject({
    isDefault: true,
    modeKey: 'FLOW_V1',
    version: 0,
    layout: { presentation: 'focused' },
  });

  await page.reload();
  await expect(focused).toHaveAttribute('aria-checked', 'true');
  await page.goto('/account/settings/home/overview');
  await expect(page.getByTestId('account-home-overview')).toContainText('My work home');
});

test('Account personalization is the single Home mode switcher and lists all three modes', async ({
  page,
}) => {
  await routeAccountHome(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/account/settings/home/overview');

  await page.getByRole('tab', { name: 'Home mode' }).click();
  const choices = page.locator('[data-mode-choice]');
  await expect(choices).toHaveCount(3);
  await expect(choices.nth(0)).toHaveAttribute('data-mode-choice', 'CLASSIC');
  await expect(choices.nth(1)).toHaveAttribute('data-mode-choice', 'FLOW_V1');
  await expect(choices.nth(2)).toHaveAttribute('data-mode-choice', 'MZ_V1');
  await expect(choices.nth(0)).toContainText('Classic organization portal');
  await expect(choices.nth(1)).toContainText('Flow work home');
  await expect(choices.nth(2)).toContainText('AI Stage');
  await expect(choices.nth(2)).not.toContainText('MZ');
});

test('100-definition effective catalog stays bounded at the 30-instance editor ceiling', async ({
  page,
}, testInfo) => {
  const ceilingWidgets: WidgetPreference[] = [
    ...WIDGETS.map((widget) => ({ ...widget })),
    ...Array.from({ length: 23 }, (_, offset) => ({
      widgetKey: `partner.widget-${offset + 7}`,
      visible: true,
      size: 'compact' as const,
      height: 'standard' as const,
    })),
  ];
  await routeAccountHome(page, { catalog: hundredDefinitionCatalog(), widgets: ceilingWidgets });
  await page.setViewportSize({ width: 1440, height: 1000 });

  const navigationStartedAt = Date.now();
  await page.goto('/account/settings/home/layout');
  const workbench = page.getByTestId('home-layout-studio-workbench');
  await expect(workbench).toHaveAttribute('data-home-studio-catalog-count', '100');
  const navigationMs = Date.now() - navigationStartedAt;
  expect(navigationMs).toBeLessThanOrEqual(5_000);
  await expect(workbench).toHaveAttribute('data-home-studio-catalog-virtualized', 'true');
  await expect(workbench).toHaveAttribute('data-home-studio-catalog-rendered-count', '14');
  await expect(workbench).toHaveAttribute('data-home-studio-instance-cap', '30');
  await expect(workbench).toHaveAttribute('data-home-studio-instance-count', '30');
  await expect(workbench).toHaveAttribute('data-home-studio-unsupported-instance-count', '23');
  await expect(page.locator('[data-home-studio-catalog-item]')).toHaveCount(14);

  const catalogViewport = page.locator('[data-home-studio-catalog-viewport]');
  await expect(catalogViewport).toHaveAttribute(
    'aria-label',
    'Widget catalog results. Use Page Up, Page Down, Home, or End to browse.'
  );
  await catalogViewport.press('End');
  await expect(page.locator('[data-home-studio-catalog-id="partner.widget-99"]')).toBeVisible();
  await catalogViewport.press('Home');

  const searchStartedAt = Date.now();
  const search = page.getByRole('textbox', { name: 'Search widgets' });
  await search.pressSequentially('partner.widget-99');
  const target = page.locator('[data-home-studio-catalog-id="partner.widget-99"]');
  await expect(target).toHaveCount(1);
  await target.press('Enter');
  await expect(page.getByText('partner.widget-99', { exact: true }).first()).toBeVisible();
  const searchSelectionMs = Date.now() - searchStartedAt;
  expect(searchSelectionMs).toBeLessThanOrEqual(1_000);
  await expect(page.getByRole('button', { name: 'Add to Home' })).toBeDisabled();
  await expect(target).toHaveAttribute('data-home-studio-reason-codes', 'AVAILABLE');

  await testInfo.attach('home-wave5-editor-performance.json', {
    contentType: 'application/json',
    body: Buffer.from(
      JSON.stringify(
        {
          catalogDefinitions: 100,
          instanceCeiling: 30,
          renderedCatalogRows: 14,
          preservedUnsupportedInstances: 23,
          navigationMs,
          searchSelectionMs,
          budgets: { navigationMs: 5_000, searchSelectionMs: 1_000 },
        },
        null,
        2
      )
    ),
  });
});
