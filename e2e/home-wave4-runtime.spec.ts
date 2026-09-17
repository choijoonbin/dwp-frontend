import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  collectReducedMotionEvidence,
  expectMinimumTouchTargets,
  expectNoHorizontalOverflow,
  expectNoSeriousAccessibilityViolations,
  tabTo,
} from './support/accessibility';
import {
  createHomeWave4ExpressiveFlowModel,
  createHomeWave4Model,
  createHomeWave4NativeBindingDriftModel,
  createHomeWave4UnsafeRouteModel,
  HOME_V2_BACKEND_BINDING_CATALOG_REVISION,
  HOME_V2_ROUTE,
  homeWave4ResponseBody,
  homeWave4ResponseHeaders,
  withHomeWave6Runtime,
} from './support/home-wave4-runtime-fixtures';
import { FULL_PRODUCT_PERMISSIONS, mockShellSession } from './support/shell-session';
import { HOME_WIDGET_BINDING_CATALOG_REVISION } from '../apps/dwp/src/features/home/runtime/widget-registry-runtime';

import type { Page, Request, Route } from '@playwright/test';
import type {
  HomeDeviceClass,
  HomeExperienceVariant,
  HomeV2ReadModel,
  HomeV2RuntimeMode,
} from '@dwp-frontend/shared-utils';

test.setTimeout(120_000);

const FIXED_NOW = new Date('2026-09-16T00:00:30Z');
const EVIDENCE_DIRECTORY = path.resolve('.artifacts/wave4-frontend-gate');
const THREE_MODE_EVIDENCE_DIRECTORY = path.resolve('.artifacts/home-three-mode-integration');
const DEVICE_CLASSES = new Set<HomeDeviceClass>([
  'DESKTOP_WIDE',
  'DESKTOP_STANDARD',
  'MOBILE_STANDARD',
  'MOBILE_COMPACT',
]);
const FORBIDDEN_IDENTITY_QUERY_KEYS = [
  'contextScopeKey',
  'tenantId',
  'userId',
  'personPublicId',
  'permissions',
  'roles',
  'groupRefs',
  'decisionRevision',
] as const;

const LEGACY_HOME_ENDPOINTS = [
  ['/api/platform/v1/home/overview', 'home-overview'],
  ['/api/platform/v1/home-experience', 'home-experience'],
  ['/api/platform/v1/workspace/apps', 'workspace-apps'],
  ['/api/notifications/v1/summary/by-app', 'notification-app-summary'],
  ['/api/platform/v1/widget-catalog/', 'widget-registry'],
  ['/api/platform/v1/home-views', 'home-views'],
  ['/api/platform/v1/catalog/code-sets/PLATFORM.HOME_WIDGET', 'home-widget-code-set'],
  ['/api/platform/v1/workspace/work-hub/', 'work-hub-home'],
  ['/api/approvals/v1/home', 'approval-home-contribution'],
  ['/api/people/v1/hr/home', 'hr-home-contribution'],
  ['/api/platform/v1/services/requests', 'services-home-contribution'],
  ['/api/platform/v1/workplace/bookings', 'workplace-home-contribution'],
] as const;

const HOME_CONTROL_PLANE_ENDPOINTS = [
  ['/api/platform/v1/home-preferences', 'home-mode-preferences'],
] as const;

type V2RequestReceipt = Readonly<{
  deviceClass: HomeDeviceClass;
  etag: string | null;
  forbiddenIdentityQueryKeys: readonly string[];
  ifNoneMatch: string | null;
  mode: HomeExperienceVariant;
  ownerBindingCatalogRevisions: readonly string[];
  queryKeys: readonly string[];
  runtimeMode: HomeV2RuntimeMode | 'NONE';
  status: 200 | 304 | 503;
}>;

type NetworkEvidence = Readonly<{
  controlPlane: Map<string, number>;
  legacy: Map<string, number>;
  v2: V2RequestReceipt[];
}>;

function observeReactRuntimeErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => {
    if (!error.message.includes('ResizeObserver loop completed with undelivered notifications')) {
      errors.push(error.message);
    }
  });
  page.on('console', (message) => {
    if (message.type() === 'error' && message.text().includes('Maximum update depth exceeded')) {
      errors.push(message.text());
    }
  });
  return errors;
}

function legacyEndpoint(request: Request): string | null {
  const path = new URL(request.url()).pathname;
  return LEGACY_HOME_ENDPOINTS.find(([prefix]) => path.startsWith(prefix))?.[1] ?? null;
}

function observeHomeNetwork(page: Page): NetworkEvidence {
  const controlPlane = new Map<string, number>(
    HOME_CONTROL_PLANE_ENDPOINTS.map(([, label]) => [label, 0])
  );
  const legacy = new Map<string, number>(LEGACY_HOME_ENDPOINTS.map(([, label]) => [label, 0]));
  const v2: V2RequestReceipt[] = [];
  page.on('request', (request) => {
    const requestPath = new URL(request.url()).pathname;
    const controlPlaneEndpoint = HOME_CONTROL_PLANE_ENDPOINTS.find(([prefix]) =>
      requestPath.startsWith(prefix)
    )?.[1];
    if (controlPlaneEndpoint) {
      controlPlane.set(controlPlaneEndpoint, (controlPlane.get(controlPlaneEndpoint) ?? 0) + 1);
    }
    const endpoint = legacyEndpoint(request);
    if (endpoint) legacy.set(endpoint, (legacy.get(endpoint) ?? 0) + 1);
  });
  return { controlPlane, legacy, v2 };
}

function homeRuntimeRoot(page: Page) {
  return page.locator('[data-home-runtime-path]');
}

async function prepareSession(
  page: Page,
  appearance: 'light' | 'dark' = 'light',
  includeDwaionArtifacts = false
): Promise<void> {
  await page.clock.setFixedTime(FIXED_NOW);
  await page.emulateMedia({ colorScheme: appearance, reducedMotion: 'reduce' });
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'en',
    permissions: includeDwaionArtifacts
      ? [
          ...FULL_PRODUCT_PERMISSIONS,
          {
            resourceType: 'APP',
            resourceKey: 'APP.DWAION_ARTIFACTS',
            permissionCode: 'VIEW',
            effect: 'ALLOW',
          },
        ]
      : FULL_PRODUCT_PERMISSIONS,
    appearance: {
      mode: 'system',
      density: 'standard',
      highContrast: false,
      reduceMotion: true,
    },
  });
}

async function routeHomeV2(
  page: Page,
  evidence: NetworkEvidence,
  options: Readonly<{
    mode: HomeExperienceVariant;
    modelFactory?: (
      input: Readonly<{
        deviceClass: HomeDeviceClass;
        marker: string;
        mode: HomeExperienceVariant;
      }>
    ) => HomeV2ReadModel;
    runtimeMode: HomeV2RuntimeMode | (() => HomeV2RuntimeMode);
  }>
): Promise<void> {
  await page.route(HOME_V2_ROUTE, async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const candidate = url.searchParams.get('deviceClass');
    if (!candidate || !DEVICE_CLASSES.has(candidate as HomeDeviceClass)) {
      return route.fulfill({ status: 400, contentType: 'application/json', body: '{}' });
    }
    const deviceClass = candidate as HomeDeviceClass;
    const marker = `${options.mode.toLowerCase()}-${deviceClass.toLowerCase()}`;
    const runtimeMode =
      typeof options.runtimeMode === 'function' ? options.runtimeMode() : options.runtimeMode;
    const runtimeState = runtimeMode === 'SHADOW' ? 'SHADOW_COMPARE' : 'READ_ONLY_ACTIVE';
    const rolloutRevision = `wave6-${runtimeState.toLowerCase()}-r1`;
    const etag = `"wave4-${marker}-${runtimeState.toLowerCase()}"`;
    const ifNoneMatch = request.headers()['if-none-match'] ?? null;
    const notModified = ifNoneMatch === etag;
    const model = withHomeWave6Runtime(
      (options.modelFactory ?? createHomeWave4Model)({
        deviceClass,
        marker,
        mode: options.mode,
      }),
      runtimeState,
      { rolloutRevision }
    );
    const ownerBindingCatalogRevisions = [
      ...new Set(
        model.widgets
          .filter((widget) => !widget.definitionKey.startsWith('core.'))
          .map((widget) => widget.rendererBindingRevision)
      ),
    ];
    evidence.v2.push({
      deviceClass,
      etag,
      forbiddenIdentityQueryKeys: FORBIDDEN_IDENTITY_QUERY_KEYS.filter((key) =>
        url.searchParams.has(key)
      ),
      ifNoneMatch,
      mode: options.mode,
      ownerBindingCatalogRevisions,
      queryKeys: [...new Set(url.searchParams.keys())].sort(),
      runtimeMode,
      status: notModified ? 304 : 200,
    });
    const headers = homeWave4ResponseHeaders(runtimeMode, etag, {
      runtimeState,
      rolloutRevision,
    });
    if (notModified) return route.fulfill({ status: 304, headers });
    return route.fulfill({
      status: 200,
      headers,
      contentType: 'application/json',
      body: homeWave4ResponseBody(model),
    });
  });
}

function totalLegacyRequests(evidence: NetworkEvidence): number {
  return [...evidence.legacy.values()].reduce((total, value) => total + value, 0);
}

async function attachNetworkEvidence(evidence: NetworkEvidence, name: string): Promise<void> {
  const target = path.join(EVIDENCE_DIRECTORY, name);
  await mkdir(EVIDENCE_DIRECTORY, { recursive: true });
  await writeFile(
    target,
    `${JSON.stringify(
      {
        controlPlane: Object.fromEntries(evidence.controlPlane),
        legacy: Object.fromEntries(evidence.legacy),
        legacyTotal: totalLegacyRequests(evidence),
        v2: evidence.v2,
      },
      null,
      2
    )}\n`
  );
  await test.info().attach(name, { path: target, contentType: 'application/json' });
}

async function attachRuntimeEvidence(
  page: Page,
  name: string,
  runtimeErrors: readonly string[]
): Promise<void> {
  const runtime = homeRuntimeRoot(page);
  const attributes = await runtime.evaluate((element) =>
    Object.fromEntries(
      [...element.attributes]
        .filter(({ name: attributeName }) => attributeName.startsWith('data-home-'))
        .map(({ name: attributeName, value }) => [attributeName, value])
    )
  );
  const owner = page.locator('[data-home-owner-widget-region]');
  const ownerAttributes =
    (await owner.count()) === 1
      ? await owner.evaluate((element) =>
          Object.fromEntries(
            [...element.attributes]
              .filter(({ name: attributeName }) => attributeName.startsWith('data-home-'))
              .map(({ name: attributeName, value }) => [attributeName, value])
          )
        )
      : null;
  const target = path.join(EVIDENCE_DIRECTORY, name);
  await mkdir(EVIDENCE_DIRECTORY, { recursive: true });
  await writeFile(
    target,
    `${JSON.stringify(
      {
        console: { maximumUpdateDepthOrPageErrors: runtimeErrors },
        runtime: attributes,
        owner: ownerAttributes,
      },
      null,
      2
    )}\n`
  );
  await test.info().attach(name, { path: target, contentType: 'application/json' });
}

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Wave 4 owns an explicit Chromium matrix.');
  await prepareSession(page, 'light', testInfo.title.includes('ACTIVE expressive Flow'));
});

test('ACTIVE owns the page, suppresses legacy fanout, reuses 304, and isolates a device scope', async ({
  page,
}) => {
  const runtimeErrors = observeReactRuntimeErrors(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  const evidence = observeHomeNetwork(page);
  await routeHomeV2(page, evidence, { mode: 'CLASSIC', runtimeMode: 'ACTIVE' });
  await page.goto('/');

  const runtime = homeRuntimeRoot(page);
  await expect(runtime).toHaveAttribute('data-home-runtime-path', 'v2');
  await expect(runtime).toHaveAttribute('data-home-legacy-fanout', 'disabled');
  await expect(runtime).toHaveAttribute('data-home-runtime-http-status', '200');
  await expect(runtime).toHaveAttribute('data-home-runtime-partial', 'true');
  await expect(runtime).toHaveAttribute('data-home-runtime-unavailable-count', '2');
  await expect(runtime).toHaveAttribute(
    'data-home-runtime-widget-state-counts',
    'available:2,empty:1,partial:1,forbidden:1,unavailable:1,stale:1'
  );
  expect(HOME_WIDGET_BINDING_CATALOG_REVISION).toBe(HOME_V2_BACKEND_BINDING_CATALOG_REVISION);
  expect(evidence.v2[0]).toMatchObject({
    forbiddenIdentityQueryKeys: [],
    ownerBindingCatalogRevisions: [HOME_V2_BACKEND_BINDING_CATALOG_REVISION],
    queryKeys: ['deviceClass', 'timeZone'],
  });
  await expect.poll(() => totalLegacyRequests(evidence)).toBe(0);
  await expect
    .poll(() => evidence.controlPlane.get('home-mode-preferences') ?? 0)
    .toBeGreaterThan(0);

  const region = page.locator('[data-home-owner-widget-region="classic"]');
  await expect(region).toHaveAttribute('data-home-owner-composition-scope', 'owner-subset');
  await expect(region).toHaveAttribute('data-home-owner-widget-count', '6');
  expect(
    await region
      .locator('[data-home-owner-placement]')
      .evaluateAll((placements) =>
        placements.map((placement) => placement.getAttribute('data-home-owner-placement'))
      )
  ).toEqual([
    'meetings.next-prep',
    'approval.focus-queue',
    'hr.edu',
    'approval.my-requests',
    'space.change-feed',
    'messaging.response-queue',
  ]);
  await expect(region.locator('[data-home-owner-placement="meetings.next-prep"]')).toHaveAttribute(
    'data-home-owner-placement-size',
    'full'
  );
  await expect(region.locator('[data-owner-widget="approval.focus-queue"]')).toContainText(
    'Verified approval classic-desktop_standard'
  );
  await expect(page.getByText('Verified native work classic-desktop_standard')).toBeVisible();
  await expect(region.locator('[data-home-content-state="partial"]')).toContainText(
    'Verified meeting classic-desktop_standard'
  );
  await expect(region.locator('[data-home-content-state="forbidden"]')).toBeVisible();
  await expect(region.locator('[data-home-content-state="widget-error"]')).toBeVisible();
  await expect(region.locator('[data-home-content-state="stale"]')).toBeVisible();

  const badge = page.locator('[data-launchpad-item="dwp-approvals"] [data-launchpad-badge]');
  await expect(badge).toHaveText('7');
  const sourceButton = region
    .locator('[data-owner-widget="approval.focus-queue"]')
    .getByRole('button');
  await tabTo(page, sourceButton, 240);
  await expect(sourceButton).toBeFocused();
  await expectMinimumTouchTargets(region.getByRole('button'), 'Wave 4 owner widget actions');

  const partialRetry = region
    .locator('[data-home-owner-placement="meetings.next-prep"]')
    .locator('[data-home-content-state="partial"]')
    .getByRole('button', { name: 'Try again' });
  await partialRetry.click();
  await expect(runtime).toHaveAttribute('data-home-runtime-http-status', '304');
  await expect(runtime).toHaveAttribute('data-home-runtime-not-modified', 'true');
  await expect(region).toContainText('Verified meeting classic-desktop_standard');
  const desktopConditional = evidence.v2.find(
    (receipt) =>
      receipt.deviceClass === 'DESKTOP_STANDARD' &&
      receipt.status === 304 &&
      receipt.ifNoneMatch === receipt.etag
  );
  expect(desktopConditional).toBeDefined();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(runtime).toHaveAttribute('data-home-device-class', 'MOBILE_STANDARD');
  await expect(region).toContainText('Verified approval classic-mobile_standard');
  await expect(region).not.toContainText('Verified approval classic-desktop_standard');
  const firstMobileRequest = evidence.v2.find(
    (receipt) => receipt.deviceClass === 'MOBILE_STANDARD'
  );
  expect(firstMobileRequest).toMatchObject({ ifNoneMatch: null, status: 200 });
  expect(evidence.v2.every((receipt) => receipt.forbiddenIdentityQueryKeys.length === 0)).toBe(
    true
  );
  await expect(runtime).toHaveAttribute('data-home-runtime-not-modified', 'false');
  await expect.poll(() => totalLegacyRequests(evidence)).toBe(0);
  expect(runtimeErrors).toEqual([]);

  await attachNetworkEvidence(evidence, 'wave4-active-network-receipt.json');
  await attachRuntimeEvidence(page, 'wave4-active-dom-receipt.json', runtimeErrors);
  await sourceButton.click();
  await expect(page).toHaveURL(/\/approvals\/home$/u);
});

test('ACTIVE expressive Flow projects five exact runtime slots once and keeps Studio closed', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const evidence = observeHomeNetwork(page);
  await routeHomeV2(page, evidence, {
    mode: 'FLOW_V1',
    runtimeMode: 'ACTIVE',
    modelFactory: createHomeWave4ExpressiveFlowModel,
  });
  await page.goto('/');

  const runtime = homeRuntimeRoot(page);
  await expect(runtime).toHaveAttribute('data-home-runtime-path', 'v2');
  await expect(runtime).toHaveAttribute('data-home-mode', 'FLOW_V1');
  await expect(runtime).toHaveAttribute('data-home-personal-customization-enabled', 'false');
  await expect(page.locator('[data-home-edit-trigger]')).toHaveCount(0);

  const mesh = page.locator('[data-flow-future-widget-mesh]');
  await expect(mesh).toHaveAttribute('data-flow-future-widget-count', '5');
  await expect(mesh).toHaveAttribute('data-flow-runtime-projection-count', '5');
  const expected = {
    'meetings-prep-decisions': 'available',
    'space-change-feed': 'available',
    'dwaion-artifact': 'unavailable',
    'workplace-booking': 'available',
    'learning-progress': 'stale',
  } as const;
  for (const [key, state] of Object.entries(expected)) {
    const surface = mesh.locator(`[data-flow-future-widget="${key}"]`);
    await expect(surface).toHaveCount(1);
    await expect(surface).toHaveAttribute('data-flow-provider-activation', 'active-runtime');
    await expect(surface).toHaveAttribute('data-flow-provider-status', state);
    await expect(surface.locator('article')).toHaveCount(0);
    await expect(surface.locator('h3')).toHaveCount(1);
  }
  await expect(mesh).toContainText('Verified meeting flow_v1-desktop_standard');
  await expect(mesh).toContainText('Verified Space change flow_v1-desktop_standard');
  await expect(mesh).toContainText('Verified focus booth flow_v1-desktop_standard');
  await expect(mesh).not.toContainText('H2 2026 operating strategy draft');
  await expect(
    mesh.locator('[data-flow-future-widget="dwaion-artifact"]').getByRole('button')
  ).toHaveCount(0);

  const region = page.locator('[data-home-owner-widget-region="flow"]');
  await expect(region).toHaveAttribute('data-home-owner-widget-count', '3');
  for (const definitionKey of [
    'meetings.next-prep',
    'space.change-feed',
    'hr.edu',
    'workplace.booking',
    'dwaion.artifact',
  ]) {
    await expect(region.locator(`[data-home-owner-placement="${definitionKey}"]`)).toHaveCount(0);
  }
  await test.info().attach('wave4-active-expressive-desktop.png', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(runtime).toHaveAttribute('data-home-device-class', 'MOBILE_STANDARD');
  await expect(mesh).toHaveAttribute(
    'data-flow-future-mobile-order',
    'meetings-space-ai-workplace-learning'
  );
  await expect(mesh).toContainText('Verified focus booth flow_v1-mobile_standard');
  await expectNoHorizontalOverflow(page);
  await test.info().attach('wave4-active-expressive-mobile.png', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
  expect(evidence.v2.every((receipt) => receipt.forbiddenIdentityQueryKeys.length === 0)).toBe(
    true
  );
});

test('ACTIVE MZ renders an independent grounded AI Stage on desktop and mobile', async ({
  page,
}) => {
  await mockShellSession(page, ['TENANT_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
    appearance: {
      mode: 'system',
      density: 'standard',
      highContrast: false,
      reduceMotion: true,
    },
  });
  const runtimeErrors = observeReactRuntimeErrors(page);
  const evidence = observeHomeNetwork(page);
  await routeHomeV2(page, evidence, { mode: 'MZ_V1', runtimeMode: 'ACTIVE' });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');

  const runtime = homeRuntimeRoot(page);
  const root = page.getByTestId('mz-home');
  await expect(runtime).toHaveAttribute('data-home-runtime-path', 'v2');
  await expect(runtime).toHaveAttribute('data-home-mode', 'MZ_V1');
  await expect(root).toBeVisible();
  await expect(root).toHaveAttribute('data-home-experience-surface', 'MZ_V1');
  await expect(root).toHaveAttribute('data-home-ia', 'ai-intent-stage');
  await expect(root).toHaveAttribute('data-home-scroll-contract', 'single-document');
  await expect(page.getByTestId('classic-home')).toHaveCount(0);
  await expect(page.getByTestId('flow-home')).toHaveCount(0);

  const workscape = root.locator('[data-mz-workscape]');
  await expect(workscape).toBeVisible();
  await expect(workscape).not.toHaveCSS('background-image', 'none');
  const firstCompositionOrder = await workscape
    .locator(
      ':scope > [data-mz-context-brief], :scope > [data-mz-compact-launcher], :scope > [data-testid="mz-ai-stage"], :scope > [data-mz-required-rail]'
    )
    .evaluateAll((nodes) =>
      nodes.map((node) =>
        node.hasAttribute('data-mz-context-brief')
          ? 'context'
          : node.hasAttribute('data-mz-compact-launcher')
            ? 'launcher'
            : node.hasAttribute('data-testid')
              ? 'stage'
              : 'required'
      )
    );
  expect(firstCompositionOrder.slice(0, 3)).toEqual(['context', 'launcher', 'stage']);
  if (firstCompositionOrder.length === 4) expect(firstCompositionOrder[3]).toBe('required');

  const compactLauncher = root.locator('[data-mz-compact-launcher]');
  await expect(compactLauncher).toHaveAttribute('data-mz-approved-app-count', '18');
  await expect(compactLauncher.locator('[data-flow-dock-item]')).toHaveCount(6);
  const stage = root.getByTestId('mz-ai-stage');
  await expect(stage).toHaveAttribute('data-mz-stage-contract', 'intent-grounding-review-handoff');
  await expect(stage).toHaveAttribute('data-mz-execution-boundary', 'dwaion-review-required');
  await expect(stage.locator('[data-mz-grounded-starter]')).not.toHaveCount(0);
  const initialStarterIds = await stage
    .locator('[data-mz-grounded-starter]')
    .evaluateAll((items) => items.map((item) => item.getAttribute('data-mz-grounded-starter')));
  await stage.locator('[data-mz-context-scene="meeting"]').click();
  const meetingStarterIds = await stage
    .locator('[data-mz-grounded-starter]')
    .evaluateAll((items) => items.map((item) => item.getAttribute('data-mz-grounded-starter')));
  expect(meetingStarterIds).not.toEqual(initialStarterIds);

  const grounded = root.locator('[data-mz-grounded-workspace]');
  await expect(grounded).toBeVisible();
  await expect(grounded).toHaveAttribute('data-mz-grounding-state', /.+/u);
  await expect(root.locator('[data-mz-operational-lanes] [data-mz-lane]')).toHaveCount(3);
  await expect(root.locator('[data-flow-future-widget-mesh]')).toBeVisible();
  await expect(root.locator('[data-mz-relevant-context]')).toBeVisible();
  const fullFallback = root.locator('[data-flow-dock-shell]');
  await expect(fullFallback).toHaveAttribute('data-flow-dock-visible-count', '18');
  await expectNoHorizontalOverflow(page);
  await expectNoSeriousAccessibilityViolations(page, '[data-testid="mz-home"]');

  await mkdir(THREE_MODE_EVIDENCE_DIRECTORY, { recursive: true });
  const desktopScreenshot = path.join(THREE_MODE_EVIDENCE_DIRECTORY, 'mz-active-desktop-1920.png');
  await page.screenshot({ path: desktopScreenshot, fullPage: true, animations: 'disabled' });
  await test.info().attach('mz-active-desktop-1920.png', {
    path: desktopScreenshot,
    contentType: 'image/png',
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(runtime).toHaveAttribute('data-home-device-class', 'MOBILE_STANDARD');
  await expect(root).toHaveAttribute('data-mz-responsive-class', 'mobile');
  await expect(root.locator('[data-mz-workscape]')).toBeVisible();
  await expect(root.locator('[data-flow-dock-shell]')).toHaveAttribute(
    'data-flow-dock-visible-count',
    '18'
  );
  await expectNoHorizontalOverflow(page);
  await expectMinimumTouchTargets(
    root.locator('button:visible, a:visible'),
    'MZ mobile interactive controls'
  );
  const mobileScreenshot = path.join(THREE_MODE_EVIDENCE_DIRECTORY, 'mz-active-mobile-390.png');
  await page.screenshot({ path: mobileScreenshot, fullPage: true, animations: 'disabled' });
  await test.info().attach('mz-active-mobile-390.png', {
    path: mobileScreenshot,
    contentType: 'image/png',
  });
  expect(runtimeErrors).toEqual([]);
  expect(evidence.v2.every((receipt) => receipt.mode === 'MZ_V1')).toBe(true);
});

for (const dwaionState of ['AVAILABLE', 'EMPTY', 'PARTIAL', 'UNAVAILABLE'] as const) {
  test(`ACTIVE expressive Flow renders DWAI·ON ${dwaionState} with its exact v1.1 contract`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const evidence = observeHomeNetwork(page);
    await routeHomeV2(page, evidence, {
      mode: 'FLOW_V1',
      runtimeMode: 'ACTIVE',
      modelFactory: (input) => createHomeWave4ExpressiveFlowModel({ ...input, dwaionState }),
    });
    await page.goto('/');

    const surface = page.locator('[data-flow-future-widget="dwaion-artifact"]');
    await expect(surface).toHaveCount(1);
    await expect(surface).toHaveAttribute('data-flow-provider-status', dwaionState.toLowerCase());
    await expect(surface.locator('article')).toHaveCount(0);
    await expect(surface.locator('h3')).toHaveCount(1);

    const sourceAction = surface.getByRole('button', { name: 'Open source' });
    if (dwaionState === 'UNAVAILABLE') {
      await expect(surface).not.toContainText('Verified DWAI·ON artifact');
      await expect(sourceAction).toHaveCount(0);
      return;
    }

    if (dwaionState === 'EMPTY') {
      await expect(surface.locator('[data-home-content-state="empty"]')).toBeVisible();
      await expect(surface).not.toContainText('Verified DWAI·ON artifact');
      await expect(sourceAction).toBeVisible();
      await sourceAction.click();
      await expect(page).toHaveURL(/\/dwaion\/artifacts$/u);
      return;
    }

    await expect(surface).toContainText('Verified DWAI·ON artifact flow_v1-desktop_standard');
    await expect(surface).toContainText('Visible artifacts');
    await expect(surface).toContainText('DOCUMENT · DRAFT · r3');
    await expect(sourceAction).toBeVisible();
    if (dwaionState === 'PARTIAL') {
      await expect(surface.locator('[data-home-content-state="partial"]')).toBeVisible();
      return;
    }

    await sourceAction.click();
    await expect(page).toHaveURL(/\/dwaion\/artifacts$/u);
  });
}

test('SHADOW keeps the legacy requests and legacy UI authoritative', async ({ page }) => {
  const runtimeErrors = observeReactRuntimeErrors(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  const evidence = observeHomeNetwork(page);
  await routeHomeV2(page, evidence, { mode: 'CLASSIC', runtimeMode: 'SHADOW' });
  await page.goto('/');

  const runtime = homeRuntimeRoot(page);
  await expect(runtime).toHaveAttribute('data-home-runtime-path', 'legacy');
  await expect(runtime).toHaveAttribute('data-home-legacy-fanout', 'enabled');
  await expect(page.getByTestId('classic-home')).toBeVisible();
  await expect(page.locator('[data-home-owner-widget-region]')).toHaveCount(0);
  await expect.poll(() => evidence.legacy.get('home-overview') ?? 0).toBeGreaterThan(0);
  await expect.poll(() => evidence.legacy.get('home-experience') ?? 0).toBeGreaterThan(0);
  await expect.poll(() => evidence.legacy.get('workspace-apps') ?? 0).toBeGreaterThan(0);
  expect(totalLegacyRequests(evidence)).toBeGreaterThan(0);
  expect(runtimeErrors).toEqual([]);
  await attachNetworkEvidence(evidence, 'wave4-shadow-network-receipt.json');
  await attachRuntimeEvidence(page, 'wave4-shadow-dom-receipt.json', runtimeErrors);
});

test('ACTIVE transitions to SHADOW through a fresh decision receipt and restores legacy fanout', async ({
  page,
}) => {
  const runtimeErrors = observeReactRuntimeErrors(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  const evidence = observeHomeNetwork(page);
  let runtimeMode: HomeV2RuntimeMode = 'ACTIVE';
  await routeHomeV2(page, evidence, {
    mode: 'CLASSIC',
    runtimeMode: () => runtimeMode,
  });
  await page.goto('/');

  const runtime = homeRuntimeRoot(page);
  await expect(runtime).toHaveAttribute('data-home-runtime-path', 'v2');
  await expect.poll(() => totalLegacyRequests(evidence)).toBe(0);

  runtimeMode = 'SHADOW';
  await page
    .locator('[data-home-owner-placement="meetings.next-prep"]')
    .getByRole('button', { name: 'Try again' })
    .click();

  await expect(runtime).toHaveAttribute('data-home-runtime-path', 'legacy');
  await expect(runtime).toHaveAttribute('data-home-legacy-fanout', 'enabled');
  await expect(runtime).toHaveAttribute('data-home-runtime-http-status', '200');
  await expect(page.locator('[data-home-owner-widget-region]')).toHaveCount(0);
  await expect(page.getByTestId('classic-home')).toBeVisible();
  await expect.poll(() => evidence.legacy.get('home-overview') ?? 0).toBeGreaterThan(0);
  expect(
    evidence.v2.some(
      (receipt) =>
        receipt.runtimeMode === 'SHADOW' &&
        receipt.status === 200 &&
        receipt.ifNoneMatch !== receipt.etag
    )
  ).toBe(true);
  expect(runtimeErrors).toEqual([]);
  await attachNetworkEvidence(evidence, 'wave4-active-to-shadow-network-receipt.json');
  await attachRuntimeEvidence(page, 'wave4-active-to-shadow-dom-receipt.json', runtimeErrors);
});

test('a cold broker kill switch fails closed without legacy permission fanout', async ({
  page,
}) => {
  const runtimeErrors = observeReactRuntimeErrors(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  const evidence = observeHomeNetwork(page);
  await page.route(HOME_V2_ROUTE, async (route) => {
    const url = new URL(route.request().url());
    const candidate = url.searchParams.get('deviceClass') as HomeDeviceClass;
    evidence.v2.push({
      deviceClass: candidate,
      etag: null,
      forbiddenIdentityQueryKeys: FORBIDDEN_IDENTITY_QUERY_KEYS.filter((key) =>
        url.searchParams.has(key)
      ),
      ifNoneMatch: route.request().headers()['if-none-match'] ?? null,
      mode: 'CLASSIC',
      ownerBindingCatalogRevisions: [],
      queryKeys: [...new Set(url.searchParams.keys())].sort(),
      runtimeMode: 'NONE',
      status: 503,
    });
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ERROR', message: 'Home Runtime v2 is disabled.' }),
    });
  });
  await page.goto('/');

  const runtime = homeRuntimeRoot(page);
  await expect(runtime).toHaveAttribute('data-home-runtime-path', 'error');
  await expect(runtime).toHaveAttribute('data-home-legacy-fanout', 'disabled');
  await expect(page.getByTestId('home-experience-error')).toBeVisible();
  await expect(page.locator('[data-home-owner-widget-region]')).toHaveCount(0);
  await expect.poll(() => totalLegacyRequests(evidence)).toBe(0);
  expect(evidence.v2.length).toBeGreaterThan(0);
  expect(
    evidence.v2.every(
      (receipt) =>
        receipt.forbiddenIdentityQueryKeys.length === 0 &&
        receipt.queryKeys.join(',') === 'deviceClass,timeZone' &&
        receipt.status === 503
    )
  ).toBe(true);
  expect(runtimeErrors).toEqual([]);
  await attachNetworkEvidence(evidence, 'wave4-kill-switch-network-receipt.json');
  await attachRuntimeEvidence(page, 'wave4-kill-switch-dom-receipt.json', runtimeErrors);
});

test('ACTIVE fails a drifted native renderer tuple closed before provider data reaches the DOM', async ({
  page,
}) => {
  const runtimeErrors = observeReactRuntimeErrors(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  const evidence = observeHomeNetwork(page);
  await routeHomeV2(page, evidence, {
    mode: 'CLASSIC',
    runtimeMode: 'ACTIVE',
    modelFactory: createHomeWave4NativeBindingDriftModel,
  });
  await page.goto('/');

  const runtime = homeRuntimeRoot(page);
  await expect(runtime).toHaveAttribute('data-home-runtime-path', 'v2');
  await expect(runtime).toHaveAttribute('data-home-legacy-fanout', 'disabled');
  await expect(page.getByText(/UNTRUSTED NATIVE PAYLOAD/u)).toHaveCount(0);
  await expect(page.getByText('UNTRUSTED_NATIVE_TUPLE_SOURCE')).toHaveCount(0);
  const nativeFailure = page.locator('[data-home-content-state="widget-error"]').first();
  await expect(nativeFailure).toBeVisible();
  await expect(nativeFailure).toContainText('The affected widget stopped safely');
  await expect(nativeFailure).not.toContainText('{{widget}}');
  await expect.poll(() => totalLegacyRequests(evidence)).toBe(0);
  expect(evidence.v2.every((receipt) => receipt.forbiddenIdentityQueryKeys.length === 0)).toBe(
    true
  );
  expect(runtimeErrors).toEqual([]);
  await attachNetworkEvidence(evidence, 'wave4-native-tuple-drift-network-receipt.json');
  await attachRuntimeEvidence(page, 'wave4-native-tuple-drift-dom-receipt.json', runtimeErrors);
});

test('ACTIVE rejects double-encoded route traversal without enabling legacy or navigation', async ({
  page,
}) => {
  const runtimeErrors = observeReactRuntimeErrors(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  const evidence = observeHomeNetwork(page);
  await routeHomeV2(page, evidence, {
    mode: 'CLASSIC',
    runtimeMode: 'ACTIVE',
    modelFactory: createHomeWave4UnsafeRouteModel,
  });
  await page.goto('/');

  const runtime = homeRuntimeRoot(page);
  await expect(runtime).toHaveAttribute('data-home-runtime-path', 'error');
  await expect(runtime).toHaveAttribute('data-home-legacy-fanout', 'disabled');
  await expect(page.getByTestId('home-experience-error')).toBeVisible();
  await expect(page.locator('[data-home-owner-widget-region]')).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/u);
  await expect.poll(() => totalLegacyRequests(evidence)).toBe(0);
  expect(evidence.v2.every((receipt) => receipt.forbiddenIdentityQueryKeys.length === 0)).toBe(
    true
  );
  expect(runtimeErrors).toEqual([]);
  await attachNetworkEvidence(evidence, 'wave4-unsafe-route-network-receipt.json');
  await attachRuntimeEvidence(page, 'wave4-unsafe-route-dom-receipt.json', runtimeErrors);
});

const RESPONSIVE_CASES = [
  {
    id: 'classic-d1440',
    viewport: { width: 1440, height: 900 },
    mode: 'CLASSIC',
    deviceClass: 'DESKTOP_STANDARD',
    surface: 'classic-home',
    colorScheme: 'light',
    largeText: false,
  },
  {
    id: 'flow-d1280-dark',
    viewport: { width: 1280, height: 800 },
    mode: 'FLOW_V1',
    deviceClass: 'DESKTOP_STANDARD',
    surface: 'flow-home',
    colorScheme: 'dark',
    largeText: false,
  },
  {
    id: 'classic-m390',
    viewport: { width: 390, height: 844 },
    mode: 'CLASSIC',
    deviceClass: 'MOBILE_STANDARD',
    surface: 'classic-home',
    colorScheme: 'light',
    largeText: false,
  },
  {
    id: 'flow-m320-text-200',
    viewport: { width: 320, height: 568 },
    mode: 'FLOW_V1',
    deviceClass: 'MOBILE_COMPACT',
    surface: 'flow-home',
    colorScheme: 'light',
    largeText: true,
  },
] as const satisfies readonly Readonly<{
  id: string;
  viewport: Readonly<{ width: number; height: number }>;
  mode: HomeExperienceVariant;
  deviceClass: HomeDeviceClass;
  surface: 'classic-home' | 'flow-home';
  colorScheme: 'light' | 'dark';
  largeText: boolean;
}>[];

for (const scenario of RESPONSIVE_CASES) {
  test(`ACTIVE ${scenario.id} preserves responsive, reduced-motion, and a11y contracts`, async ({
    page,
  }) => {
    const runtimeErrors = observeReactRuntimeErrors(page);
    await page.setViewportSize(scenario.viewport);
    await page.emulateMedia({ colorScheme: scenario.colorScheme, reducedMotion: 'reduce' });
    const evidence = observeHomeNetwork(page);
    await routeHomeV2(page, evidence, { mode: scenario.mode, runtimeMode: 'ACTIVE' });
    if (scenario.largeText) {
      await page.route(/^http:\/\/(?:localhost|127\.0\.0\.1):\d+\/$/u, async (route) => {
        const response = await route.fetch();
        const body = await response.text();
        await route.fulfill({
          response,
          body: body.replace(
            '<head>',
            '<head><style data-wave4-large-text>html { font-size: 200% !important; }</style>'
          ),
        });
      });
    }
    await page.goto('/');

    const runtime = homeRuntimeRoot(page);
    await expect(runtime).toHaveAttribute('data-home-runtime-path', 'v2');
    await expect(runtime).toHaveAttribute('data-home-device-class', scenario.deviceClass);
    await expect(runtime).toHaveAttribute('data-home-mode', scenario.mode);
    await expect(page.getByTestId(scenario.surface)).toBeVisible();
    await expect(page.getByTestId('personal-home-shell')).toHaveAttribute(
      'data-home-experience-mode',
      scenario.mode
    );
    if (scenario.largeText) {
      await expect(page.getByTestId('personal-home-shell')).toHaveAttribute(
        'data-home-large-text',
        'true'
      );
    }
    await expect.poll(() => totalLegacyRequests(evidence)).toBe(0);
    await expectNoHorizontalOverflow(page);
    await expectNoSeriousAccessibilityViolations(page, '#dwp-main-content');
    const motion = await collectReducedMotionEvidence(page);
    expect(motion).toMatchObject({
      reduce: true,
      offenders: [],
      smoothScroll: false,
      shellVisible: true,
    });
    await expectMinimumTouchTargets(
      page.locator('[data-home-owner-widget-region] button'),
      `Wave 4 ${scenario.id}`
    );
    const expectedMarker = `${scenario.mode.toLowerCase()}-${scenario.deviceClass.toLowerCase()}`;
    const ownerRegion = page.locator(
      `[data-home-owner-widget-region="${scenario.mode === 'FLOW_V1' ? 'flow' : 'classic'}"]`
    );
    await expect(page.getByTestId('home-experience-bootstrap')).toHaveCount(0);
    await expect(ownerRegion).toHaveAttribute('data-home-owner-widget-count', '6');
    await expect(ownerRegion.locator('[data-owner-widget="approval.focus-queue"]')).toContainText(
      `Verified approval ${expectedMarker}`
    );
    expect(runtimeErrors).toEqual([]);
    const screenshotPath = path.join(EVIDENCE_DIRECTORY, `wave4-${scenario.id}.png`);
    const ownerScreenshotPath = path.join(
      EVIDENCE_DIRECTORY,
      `wave4-${scenario.id}-owner-states.png`
    );
    await mkdir(EVIDENCE_DIRECTORY, { recursive: true });
    await page.screenshot({
      path: screenshotPath,
      animations: 'disabled',
      fullPage: false,
    });
    await test.info().attach(`wave4-${scenario.id}.png`, {
      path: screenshotPath,
      contentType: 'image/png',
    });
    await ownerRegion.screenshot({
      path: ownerScreenshotPath,
      animations: 'disabled',
    });
    await test.info().attach(`wave4-${scenario.id}-owner-states.png`, {
      path: ownerScreenshotPath,
      contentType: 'image/png',
    });
    await attachNetworkEvidence(evidence, `wave4-${scenario.id}-network.json`);
    await attachRuntimeEvidence(page, `wave4-${scenario.id}-dom.json`, runtimeErrors);
  });
}
