import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

import {
  FULL_PRODUCT_PERMISSIONS,
  HOME_COMMUNICATIONS_FIXTURE,
  createHomeOverviewFixture,
  fulfillSuccess,
  mockShellSession,
} from './support/shell-session';
import {
  APPROVAL_HOME_FIXTURE,
  HR_HOME_FIXTURE,
  HR_SERVICE_REQUESTS_FIXTURE,
} from './support/product-area-fixtures';

const FLOW_FIXTURE_NOW = new Date('2026-08-11T00:30:00.000Z');
const MINIMUM_ACTION_TARGET_PX = 44;

const FLOW_SECTION_KEYS = [
  'app-dock',
  'purpose-action',
  'purpose-timeline',
  'purpose-response',
  'purpose-request',
  'purpose-pulse',
] as const;

const PURPOSE_WIDGET_KEYS = {
  action: 'action-queue',
  timeline: 'today',
  response: 'response-hub',
  request: 'request-tracker',
  pulse: 'role-pulse',
} as const;

const FLOW_PERMISSIONS = [
  ...FULL_PRODUCT_PERMISSIONS,
  {
    resourceType: 'APP',
    resourceKey: 'APP.NOTIFICATIONS',
    permissionCode: 'VIEW',
    effect: 'ALLOW' as const,
  },
  {
    resourceType: 'APP',
    resourceKey: 'APP.MESSAGING',
    permissionCode: 'VIEW',
    effect: 'ALLOW' as const,
  },
];

const FLOW_POLICY = {
  schemaVersion: 3,
  experienceVariant: 'FLOW_V1',
  personalCustomizationEnabled: true,
  governedZones: [
    {
      zoneKey: 'announcements',
      placement: 'CANVAS',
      visible: true,
      size: 'full',
      height: 'short',
      sortOrder: 20,
    },
  ],
};

const DEFAULT_HOME_PREFERENCE = {
  schemaVersion: 5,
  surfaceKey: 'workspace-home',
  customized: false,
  layout: {
    appLayout: null,
    presentation: 'balanced',
    widgets: [
      { widgetKey: 'command-rail', visible: true, size: 'large', height: 'standard' },
      { widgetKey: 'schedule', visible: true, size: 'compact', height: 'standard' },
      { widgetKey: 'daily-brief', visible: true, size: 'compact', height: 'standard' },
      { widgetKey: 'focus', visible: true, size: 'compact', height: 'standard' },
      { widgetKey: 'activity', visible: true, size: 'compact', height: 'standard' },
    ],
  },
  version: 0,
};

function defaultHomeView(version = 3) {
  return {
    viewId: 'home-view-default',
    viewKey: 'default',
    surfaceKey: 'workspace-home',
    name: 'My home',
    isDefault: true,
    schemaVersion: 5,
    layout: DEFAULT_HOME_PREFERENCE.layout,
    version,
    customized: true,
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-25T00:00:00Z',
    widgetConfigurations: {},
  };
}

function flowExperience(overrides: Record<string, unknown> = {}) {
  return {
    headline: null,
    subheadline: null,
    localizedContent: {},
    defaultLocale: 'en',
    backgroundPosition: 'RIGHT',
    overlayOpacity: 18,
    backgroundUrl: null,
    launchpadConfiguration: { schemaVersion: 1, groups: [], placements: [] },
    compositionPolicy: FLOW_POLICY,
    effectiveExperienceVariant: 'FLOW_V1',
    advancedPersonalizationEnabled: false,
    composerEnabled: false,
    homePreferenceStore: 'LEGACY',
    version: 7,
    ...overrides,
  };
}

function overviewWithCommunications(
  communications: Record<string, unknown> = HOME_COMMUNICATIONS_FIXTURE
) {
  const overview = createHomeOverviewFixture(['WORKSPACE_MEMBER']);
  const generatedAt = FLOW_FIXTURE_NOW.toISOString();
  return {
    ...overview,
    work: { ...overview.work, generatedAt, data: { ...overview.work.data, generatedAt } },
    calendar: {
      ...overview.calendar,
      generatedAt,
      data: { ...overview.calendar.data, generatedAt },
    },
    activity: {
      ...overview.activity,
      generatedAt,
      data: { ...overview.activity.data, generatedAt },
    },
    communications: {
      status: 'AVAILABLE' as const,
      source: 'DWP_COMMUNICATIONS',
      generatedAt,
      data: { ...communications, generatedAt },
      reason: null,
    },
    recommendationSection: { ...overview.recommendationSection, generatedAt },
    generatedAt,
  };
}

const REQUIRED_COMMUNICATIONS_FIXTURE = {
  ...HOME_COMMUNICATIONS_FIXTURE,
  featured: {
    ...HOME_COMMUNICATIONS_FIXTURE.featured,
    severity: 'CRITICAL' as const,
    acknowledgementRequired: true,
    acknowledgementDueAt: '2026-08-11T08:00:00Z',
  },
  summary: { ...HOME_COMMUNICATIONS_FIXTURE.summary, required: 1 },
};

function purpose(flowHome: Locator, key: keyof typeof PURPOSE_WIDGET_KEYS) {
  return flowHome.locator(`[data-flow-section="purpose-${key}"]`);
}

function purposeFrame(flowHome: Locator, key: keyof typeof PURPOSE_WIDGET_KEYS) {
  return flowHome.locator(`[data-workspace-widget="${PURPOSE_WIDGET_KEYS[key]}"]`);
}

async function routeFlowExperience(page: Page, overrides: Record<string, unknown> = {}) {
  await page.route('**/api/platform/v1/home-experience', (route) =>
    fulfillSuccess(route, flowExperience(overrides))
  );
}

async function routeDefaultPreference(page: Page) {
  await page.route('**/api/platform/v1/home-preferences**', (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && path.endsWith('/home-preferences')) {
      return fulfillSuccess(route, DEFAULT_HOME_PREFERENCE);
    }
    return route.fallback();
  });
}

async function movePointerInside(page: Page, target: Locator) {
  const bounds = await target.boundingBox();
  const viewport = page.viewportSize();
  expect(bounds).not.toBeNull();
  expect(viewport).not.toBeNull();
  if (!bounds || !viewport) throw new Error('Target and viewport geometry are required.');

  const visibleTop = Math.max(16, bounds.y + 1);
  const visibleBottom = Math.min(viewport.height - 16, bounds.y + bounds.height - 1);
  expect(visibleBottom).toBeGreaterThan(visibleTop);
  await page.mouse.move(
    Math.min(viewport.width - 16, Math.max(16, bounds.x + bounds.width / 2)),
    visibleTop + (visibleBottom - visibleTop) / 2
  );
}

async function expectWheelToReachDocument(page: Page, section: Locator) {
  const scrollSetup = await section.evaluate((node) => {
    const bounds = node.getBoundingClientRect();
    const absoluteTop = bounds.top + window.scrollY;
    const absoluteBottom = bounds.bottom + window.scrollY;
    const viewportHeight = window.innerHeight;
    const maxScroll = Math.max(
      0,
      document.documentElement.scrollHeight - document.documentElement.clientHeight
    );
    const lowerBound = Math.max(72, absoluteTop - viewportHeight + 32);
    const upperBound = Math.min(maxScroll - 72, absoluteBottom - 32);
    return {
      maxScroll,
      targetScroll: Math.min(upperBound, Math.max(lowerBound, absoluteTop - viewportHeight * 0.35)),
      hasBidirectionalRoom: lowerBound <= upperBound,
    };
  });

  expect(scrollSetup.maxScroll).toBeGreaterThan(144);
  expect(scrollSetup.hasBidirectionalRoom).toBe(true);
  await page.evaluate((scrollY) => window.scrollTo(0, scrollY), scrollSetup.targetScroll);
  await movePointerInside(page, section);

  const beforeDown = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, 96);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(beforeDown);

  await movePointerInside(page, section);
  const beforeUp = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, -96);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(beforeUp);
}

async function expectNoHorizontalDocumentOverflow(page: Page, flowHome: Locator) {
  const geometry = await flowHome.evaluate((root) => {
    const viewportWidth = document.documentElement.clientWidth;
    const rootBounds = root.getBoundingClientRect();
    const collectOverflow = (nodes: HTMLElement[]) =>
      nodes
        .filter((node) => {
          const style = window.getComputedStyle(node);
          const bounds = node.getBoundingClientRect();
          return (
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            bounds.width > 0 &&
            (bounds.left < -1 || bounds.right > viewportWidth + 1)
          );
        })
        .slice(0, 20)
        .map((node) => ({
          name:
            node.getAttribute('data-flow-section') ??
            node.getAttribute('data-workspace-widget') ??
            node.getAttribute('aria-label') ??
            node.tagName,
          className: node.className,
          parentClassName: node.parentElement?.className ?? '',
          html: node.outerHTML.slice(0, 320),
          bounds: (() => {
            const bounds = node.getBoundingClientRect();
            return { left: bounds.left, right: bounds.right, width: bounds.width };
          })(),
        }));
    const offenders = collectOverflow(
      Array.from(
        root.querySelectorAll<HTMLElement>(
          '[data-flow-section], [data-workspace-widget], a[href], button, summary'
        )
      )
    );
    const diagnosticOffenders = collectOverflow(
      Array.from(document.body.querySelectorAll<HTMLElement>('*'))
    );
    return {
      viewportWidth,
      documentWidth: document.documentElement.scrollWidth,
      rootLeft: rootBounds.left,
      rootRight: rootBounds.right,
      offenders,
      diagnosticOffenders,
    };
  });

  expect(
    geometry.documentWidth,
    `Horizontal overflow geometry: ${JSON.stringify(geometry)}`
  ).toBeLessThanOrEqual(geometry.viewportWidth + 1);
  expect(geometry.rootLeft).toBeGreaterThanOrEqual(-1);
  expect(geometry.rootRight).toBeLessThanOrEqual(geometry.viewportWidth + 1);
  expect(geometry.offenders).toEqual([]);
}

async function expectMinimumTargets(root: Locator, selector: string) {
  const targets = await root.locator(selector).evaluateAll((nodes) =>
    nodes
      .filter((node) => {
        const element = node as HTMLElement;
        const style = window.getComputedStyle(element);
        const bounds = element.getBoundingClientRect();
        return (
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          bounds.width > 0 &&
          bounds.height > 0
        );
      })
      .map((node) => {
        const bounds = (node as HTMLElement).getBoundingClientRect();
        return {
          label: (node as HTMLElement).getAttribute('aria-label') ?? node.textContent?.trim(),
          width: bounds.width,
          height: bounds.height,
        };
      })
  );
  expect(targets.length).toBeGreaterThan(0);
  expect(
    targets.filter(
      ({ width, height }) =>
        width + 0.1 < MINIMUM_ACTION_TARGET_PX || height + 0.1 < MINIMUM_ACTION_TARGET_PX
    )
  ).toEqual([]);
}

async function expectDwaionBottomAnchor(page: Page) {
  const launcher = page.getByTestId('dwaion-launcher');
  const [bounds, viewport] = await Promise.all([launcher.boundingBox(), page.viewportSize()]);
  expect(bounds).not.toBeNull();
  expect(viewport).not.toBeNull();
  if (!bounds || !viewport) return;
  if (viewport.width < 900) {
    expect(bounds.width).toBeCloseTo(44, 0);
    expect(bounds.height).toBeCloseTo(44, 0);
    await expect(launcher).toHaveCSS('position', 'relative');
    await expect(launcher).toHaveAttribute('data-shell-auxiliary-placement', 'header');
    return;
  }
  expect(bounds.width).toBeCloseTo(56, 0);
  expect(bounds.height).toBeCloseTo(56, 0);
  expect(viewport.width - bounds.x - bounds.width).toBeCloseTo(24, 0);
  expect(viewport.height - bounds.y - bounds.height).toBeCloseTo(24, 0);
  await expect(launcher).toHaveCSS('position', 'fixed');
  await expect(launcher).toHaveAttribute('data-shell-auxiliary-placement', 'floating');
}

async function expectDwaionFixedAcrossDocumentScroll(page: Page) {
  const launcher = page.getByTestId('dwaion-launcher');
  const settle = () =>
    page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        )
    );
  await page.evaluate(() => window.scrollTo(0, 0));
  await settle();
  const initial = await launcher.boundingBox();
  const maxScroll = await page.evaluate(() =>
    Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
  );
  expect(initial).not.toBeNull();
  expect(maxScroll).toBeGreaterThan(0);
  if (!initial) return;

  for (const ratio of [0.35, 0.7, 1]) {
    await page.evaluate((nextY) => window.scrollTo(0, nextY), Math.round(maxScroll * ratio));
    await settle();
    const current = await launcher.boundingBox();
    expect(current).not.toBeNull();
    if (!current) continue;
    expect(Math.abs(current.x - initial.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(current.y - initial.y)).toBeLessThanOrEqual(1);
  }
}

async function expectNoInternalVerticalScroll(flowHome: Locator) {
  const traps = await flowHome.evaluate((root) =>
    Array.from(root.querySelectorAll<HTMLElement>('*'))
      .filter((node) => {
        const overflow = window.getComputedStyle(node).overflowY;
        return (
          (overflow === 'auto' || overflow === 'scroll') &&
          node.scrollHeight > node.clientHeight + 1
        );
      })
      .map(
        (node) =>
          node.getAttribute('data-flow-section') ??
          node.getAttribute('data-workspace-widget') ??
          node.tagName
      )
  );
  expect(traps).toEqual([]);
}

async function expectPurposeDesktopGrid(flowHome: Locator) {
  for (const [purposeKey, widgetKey] of Object.entries(PURPOSE_WIDGET_KEYS)) {
    await expect(flowHome.locator(`[data-workspace-widget="${widgetKey}"]`)).toBeVisible();
    await expect(flowHome.locator(`[data-flow-section="purpose-${purposeKey}"]`)).toBeVisible();
  }

  await expect(purposeFrame(flowHome, 'action')).toHaveAttribute(
    'data-workspace-widget-size',
    'large'
  );
  for (const key of ['timeline', 'response', 'request', 'pulse'] as const) {
    await expect(purposeFrame(flowHome, key)).toHaveAttribute(
      'data-workspace-widget-size',
      'compact'
    );
  }

  const geometry = await flowHome.getByTestId('flow-home-personal-sections').evaluate((root) => {
    const rect = (widgetKey: string) => {
      const node = root.querySelector<HTMLElement>(`[data-workspace-widget="${widgetKey}"]`);
      if (!node) return null;
      const bounds = node.getBoundingClientRect();
      const content = node.querySelector<HTMLElement>('[data-workspace-widget-content]');
      const surface = node.querySelector<HTMLElement>('[data-flow-section]');
      return {
        left: bounds.left,
        right: bounds.right,
        top: bounds.top,
        bottom: bounds.bottom,
        width: bounds.width,
        height: bounds.height,
        contentClientHeight: content?.clientHeight ?? 0,
        contentScrollHeight: content?.scrollHeight ?? 0,
        surfaceBottom: surface?.getBoundingClientRect().bottom ?? bounds.bottom,
      };
    };
    return {
      action: rect('action-queue'),
      timeline: rect('today'),
      response: rect('response-hub'),
      request: rect('request-tracker'),
      pulse: rect('role-pulse'),
    };
  });

  expect(geometry.action).not.toBeNull();
  expect(geometry.timeline).not.toBeNull();
  expect(geometry.response).not.toBeNull();
  expect(geometry.request).not.toBeNull();
  expect(geometry.pulse).not.toBeNull();
  const { action, timeline, response, request, pulse } = geometry;
  if (!action || !timeline || !response || !request || !pulse) return;

  expect(Math.abs(action.top - timeline.top)).toBeLessThanOrEqual(2);
  expect(action.width / timeline.width).toBeGreaterThan(1.9);
  expect(action.width / timeline.width).toBeLessThan(2.1);
  expect(timeline.left).toBeGreaterThanOrEqual(action.right);

  expect(Math.abs(response.top - request.top)).toBeLessThanOrEqual(2);
  expect(Math.abs(request.top - pulse.top)).toBeLessThanOrEqual(2);
  expect(Math.abs(response.width - request.width)).toBeLessThanOrEqual(2);
  expect(Math.abs(request.width - pulse.width)).toBeLessThanOrEqual(2);
  expect(response.top).toBeGreaterThanOrEqual(Math.max(action.bottom, timeline.bottom));

  for (const widget of [action, timeline, response, request, pulse]) {
    expect(widget.contentScrollHeight).toBeLessThanOrEqual(widget.contentClientHeight + 1);
    expect(Math.abs(widget.bottom - widget.surfaceBottom)).toBeLessThanOrEqual(2);
    expect(widget.height).toBeLessThanOrEqual(304);
  }
}

async function expectSeriousAxeViolationsToBeEmpty(page: Page, selector: string) {
  const accessibility = await new AxeBuilder({ page }).include(selector).analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
}

function emptyHomeOverview() {
  const overview = createHomeOverviewFixture(['WORKSPACE_MEMBER']);
  const generatedAt = FLOW_FIXTURE_NOW.toISOString();
  return {
    ...overview,
    generatedAt,
    work: {
      ...overview.work,
      generatedAt,
      data: {
        ...overview.work.data,
        generatedAt,
        items: [],
        summary: { total: 0, dueSoon: 0, inProgress: 0, waiting: 0, completed: 0 },
      },
    },
    calendar: {
      ...overview.calendar,
      generatedAt,
      data: {
        ...overview.calendar.data,
        generatedAt,
        today: [],
        upcoming: [],
        metrics: {
          ...overview.calendar.data.metrics,
          eventCount: 0,
          focusMinutes: 0,
          focusTargetMinutes: 0,
          conflictCount: 0,
          awaitingResponseCount: 0,
        },
      },
    },
    activity: {
      ...overview.activity,
      generatedAt,
      data: { ...overview.activity.data, generatedAt, events: [] },
    },
    communications: {
      ...overview.communications,
      generatedAt,
      data: {
        featured: null,
        items: [],
        actionableItems: [],
        summary: { total: 0, unread: 0, required: 0, saved: 0 },
        generatedAt,
      },
    },
  };
}

function workOverviewWithCount(count: number) {
  const overview = emptyHomeOverview();
  const source = createHomeOverviewFixture(['WORKSPACE_MEMBER']).work.data.items[0]!;
  const items = Array.from({ length: count }, (_, index) => ({
    ...source,
    workItemId: `10420000-0000-0000-0000-${String(index + 1).padStart(12, '0')}`,
    id: `WK-CONTENT-${index + 1}`,
    title: `Purpose queue item ${index + 1}`,
    sourceReference: `PURPOSE-${index + 1}`,
    dueAt: new Date(FLOW_FIXTURE_NOW.getTime() + (index + 1) * 60 * 60 * 1000).toISOString(),
  }));
  return {
    ...overview,
    work: {
      ...overview.work,
      data: {
        ...overview.work.data,
        items,
        summary: { total: count, dueSoon: count, inProgress: 0, waiting: 0, completed: 0 },
      },
    },
  };
}

function emptyApprovalHome() {
  return {
    ...APPROVAL_HOME_FIXTURE,
    generatedAt: FLOW_FIXTURE_NOW.toISOString(),
    focusQueue: [],
    recentRequests: [],
    adminPulse: {
      ...APPROVAL_HOME_FIXTURE.adminPulse,
      overdueTasks: 0,
      failedIntegrations: 0,
    },
  };
}

function emptyHrHome() {
  return {
    ...HR_HOME_FIXTURE,
    generatedAt: FLOW_FIXTURE_NOW.toISOString(),
    time: null,
    openBenefitWindowCount: 0,
    requiredLearningCount: 0,
    teamPendingCount: 0,
  };
}

async function routeEmptyExternalContributions(
  page: Page,
  options: { approvals?: 'empty' | 'unavailable'; services?: readonly unknown[] } = {}
) {
  await page.route(/\/api\/approvals\/v1\/home(?:\?|$)/u, (route) => {
    if (options.approvals === 'unavailable') {
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ERROR', message: 'Approvals temporarily unavailable' }),
      });
    }
    return fulfillSuccess(route, emptyApprovalHome());
  });
  await page.route('**/api/people/v1/hr/home', (route) => fulfillSuccess(route, emptyHrHome()));
  await page.route('**/api/platform/v1/services/requests', (route) =>
    fulfillSuccess(route, options.services ?? [])
  );
  await page.route('**/api/platform/v1/workplace/bookings**', (route) => fulfillSuccess(route, []));
  await page.route('**/api/notifications/v1/summary/by-app', (route) =>
    fulfillSuccess(route, {
      partial: false,
      unavailableSources: [],
      apps: [],
      changeVersion: '0',
      counterVersion: '0',
      generatedAt: FLOW_FIXTURE_NOW.toISOString(),
    })
  );
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.setFixedTime(FLOW_FIXTURE_NOW);
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'en',
    displayName: 'Mina Kim',
    permissions: FLOW_PERMISSIONS,
  });
  await routeFlowExperience(page);
  await routeDefaultPreference(page);
  await routeEmptyExternalContributions(page);
  await page.route('**/api/platform/v1/workplace/bookings**', (route) => fulfillSuccess(route, []));
  await page.route('**/api/notifications/v1/summary/by-app', (route) =>
    fulfillSuccess(route, {
      partial: false,
      unavailableSources: [],
      apps: [
        {
          appKey: 'approvals',
          totalUnread: 7,
          actionableUnread: 3,
          urgentUnread: 1,
          lastActivityAt: FLOW_FIXTURE_NOW.toISOString(),
        },
        {
          appKey: 'messaging',
          totalUnread: 4,
          actionableUnread: 1,
          urgentUnread: 0,
          lastActivityAt: FLOW_FIXTURE_NOW.toISOString(),
        },
      ],
      changeVersion: '11',
      counterVersion: '11',
      generatedAt: FLOW_FIXTURE_NOW.toISOString(),
    })
  );
});

test('Flow Home exposes the purpose-led 8+4 and 4+4+4 hierarchy without scroll traps', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'chromium',
    'Desktop geometry and mouse-wheel ownership run in Chromium; mobile reflow has a separate matrix.'
  );
  await page.route('**/api/platform/v1/home/overview**', (route) =>
    fulfillSuccess(route, overviewWithCommunications())
  );
  await page.setViewportSize({ width: 1440, height: 720 });
  await page.goto('/');

  const flowHome = page.getByTestId('flow-home');
  const workscape = flowHome.locator('[data-flow-workscape]');
  await expect(flowHome).toBeVisible();
  await expect(flowHome.getByTestId('flow-home-personal-sections')).toHaveAttribute(
    'data-flow-layout-contract',
    'purpose-widgets'
  );
  const independentSurfaceContract = await flowHome
    .getByTestId('flow-home-personal-sections')
    .evaluate((stage) => {
      const grid = stage.querySelector<HTMLElement>('[data-workspace-presentation]')!;
      const section = stage.querySelector<HTMLElement>(
        '[data-workspace-widget-content] > section'
      )!;
      const actionSurface = stage.querySelector<HTMLElement>(
        '[data-workspace-widget="action-queue"] [data-flow-section]'
      )!;
      const timelineSurface = stage.querySelector<HTMLElement>(
        '[data-workspace-widget="today"] [data-flow-section]'
      )!;
      const gridStyle = window.getComputedStyle(grid);
      const sectionStyle = window.getComputedStyle(section);
      const actionBounds = actionSurface.getBoundingClientRect();
      const timelineBounds = timelineSurface.getBoundingClientRect();
      return {
        rowGap: gridStyle.rowGap,
        gridBorder: gridStyle.borderTopWidth,
        sectionBorder: sectionStyle.borderTopWidth,
        sectionRadius: Number.parseFloat(sectionStyle.borderTopLeftRadius),
        adjacentSurfaceGap: timelineBounds.left - actionBounds.right,
      };
    });
  expect(independentSurfaceContract).toMatchObject({
    rowGap: '16px',
    gridBorder: '0px',
    sectionBorder: '1px',
  });
  expect(independentSurfaceContract.sectionRadius).toBeGreaterThanOrEqual(12);
  expect(independentSurfaceContract.adjacentSurfaceGap).toBeGreaterThanOrEqual(14);
  expect(independentSurfaceContract.adjacentSurfaceGap).toBeLessThanOrEqual(18);
  await expect(workscape.locator('[data-flow-dock-shell]')).toHaveAttribute(
    'data-flow-dock-item-limit',
    '8'
  );
  const dockDistribution = await workscape
    .locator('[data-flow-dock-group]')
    .evaluateAll((groups) =>
      groups.map((group) => group.querySelectorAll('[data-flow-dock-item]').length)
    );
  expect(dockDistribution).toHaveLength(4);
  expect(dockDistribution.reduce((total, count) => total + count, 0)).toBe(8);
  expect(Math.min(...dockDistribution)).toBeGreaterThanOrEqual(1);
  expect(Math.max(...dockDistribution) - Math.min(...dockDistribution)).toBeLessThanOrEqual(1);
  const workscapeHeight = (await workscape.boundingBox())?.height ?? Number.POSITIVE_INFINITY;
  expect(workscapeHeight).toBeGreaterThanOrEqual(240);
  expect(workscapeHeight).toBeLessThanOrEqual(340);
  const launchDeckContract = await workscape.evaluate((surface) => {
    const copy = surface.querySelector<HTMLElement>('[data-flow-context-copy]')!;
    const dock = surface.querySelector<HTMLElement>('[data-flow-dock-shell]')!;
    const copyBounds = copy.getBoundingClientRect();
    const dockBounds = dock.getBoundingClientRect();
    return {
      inlineStartDelta: Math.abs(copyBounds.left - dockBounds.left),
      dockBackground: window.getComputedStyle(dock).backgroundColor,
      horizontalOverflow: dock.scrollWidth - dock.clientWidth,
    };
  });
  expect(launchDeckContract.inlineStartDelta).toBeLessThanOrEqual(2);
  expect(launchDeckContract.dockBackground).not.toBe('rgba(255, 255, 255, 0.94)');
  expect(launchDeckContract.horizontalOverflow).toBeLessThanOrEqual(1);
  await expect(workscape.getByText(/8 more$/)).toBeVisible();
  await expect(workscape.getByText(/^\+8$/)).toHaveCount(0);
  await expect(workscape.getByText(/Some sources are unavailable/i)).toHaveCount(0);

  const nextActionCue = purpose(flowHome, 'action').locator('[data-home-recommendation-cue]');
  await expect(nextActionCue).toBeVisible();
  await expect(nextActionCue).toHaveAttribute('aria-haspopup', 'dialog');
  await expectMinimumTargets(purpose(flowHome, 'action'), '[data-home-recommendation-cue]');

  const rolePulse = purpose(flowHome, 'pulse');
  await expect(rolePulse.locator('[data-home-role-insight]')).toBeVisible();
  const roleTextRows = rolePulse.locator('[data-home-contribution]');
  await expect(roleTextRows.filter({ hasText: 'Open work' })).toHaveCount(0);
  await expect(roleTextRows.filter({ hasText: 'Focus time today' })).toHaveCount(0);
  await expect(roleTextRows.filter({ hasText: 'Activity needs attention' })).toHaveCount(0);

  const order = await flowHome
    .locator('[data-flow-section]')
    .evaluateAll((sections) =>
      sections.map((section) => section.getAttribute('data-flow-section'))
    );
  expect(order).toEqual([...FLOW_SECTION_KEYS, 'updates']);

  await expectPurposeDesktopGrid(flowHome);
  await expectNoInternalVerticalScroll(flowHome);
  await expectNoHorizontalDocumentOverflow(page, flowHome);
  await expectDwaionBottomAnchor(page);
  await expectMinimumTargets(
    flowHome,
    '[data-flow-dock-item] button, [data-home-contribution], [data-testid="dwaion-launcher"]'
  );

  for (const sectionKey of FLOW_SECTION_KEYS) {
    await expectWheelToReachDocument(page, flowHome.locator(`[data-flow-section="${sectionKey}"]`));
  }
  await expectSeriousAxeViolationsToBeEmpty(page, '[data-testid="flow-home"]');
});

test('tenant image focal points remain independent from hero content alignment', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'The Workscape contract runs once in Chromium.');
  await routeFlowExperience(page, {
    backgroundUrl: '/media/communications/workplace-improvement.jpg',
    backgroundPosition: 'RIGHT',
    backgroundFocalX: 74,
    backgroundFocalY: 28,
    mobileBackgroundFocalX: 61,
    mobileBackgroundFocalY: 40,
    contentAlignment: 'RIGHT',
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');

  const workscape = page.getByTestId('flow-home').locator('[data-flow-workscape]');
  await expect(workscape).toHaveAttribute('data-tenant-background-focal-x', '74');
  await expect(workscape).toHaveAttribute('data-tenant-background-focal-y', '28');
  await expect(workscape).toHaveAttribute('data-tenant-content-alignment', 'right');
  const alignment = await workscape.evaluate((surface) => {
    const frame = surface.querySelector<HTMLElement>('[data-flow-hero-surface]')!;
    const copy = surface.querySelector<HTMLElement>('[data-flow-context-copy]')!;
    const dock = surface.querySelector<HTMLElement>('[data-flow-dock-shell]')!;
    const frameBounds = frame.getBoundingClientRect();
    const copyBounds = copy.getBoundingClientRect();
    const dockBounds = dock.getBoundingClientRect();
    return {
      copyDockEndDelta: Math.abs(copyBounds.right - dockBounds.right),
      dockFromFrameStart: dockBounds.left - frameBounds.left,
      frameWidth: frameBounds.width,
    };
  });
  expect(alignment.copyDockEndDelta).toBeLessThanOrEqual(2);
  expect(alignment.dockFromFrameStart).toBeGreaterThan(alignment.frameWidth * 0.2);
});

test('Dock lift responds only to pointer intent and is removed for reduced motion', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Motion policy runs once in Chromium.');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');

  const launch = page.getByTestId('flow-home').locator('[data-flow-dock-launch]').first();
  const idle = await launch.evaluate((node) => {
    const style = window.getComputedStyle(node);
    return { transform: style.transform, transition: style.transitionProperty };
  });
  expect(idle.transform).toBe('none');
  expect(idle.transition).toContain('transform');
  await launch.hover();
  await expect
    .poll(() => launch.evaluate((node) => window.getComputedStyle(node).transform))
    .not.toBe('none');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.mouse.move(0, 0);
  await launch.hover();
  const reduced = await launch.evaluate((node) => {
    const style = window.getComputedStyle(node);
    return { transform: style.transform, duration: style.transitionDuration };
  });
  expect(reduced.transform).toBe('none');
  expect(Number.parseFloat(reduced.duration)).toBeLessThanOrEqual(0.00001);
});

test('Expressive Wide composes a 7+5 primary tier, 4+4+4 support tier, and 6+3+3 news row', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Wide geometry runs once in Chromium.');
  await page.route('**/api/platform/v1/home-preferences**', (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && path.endsWith('/home-preferences')) {
      return fulfillSuccess(route, {
        ...DEFAULT_HOME_PREFERENCE,
        layout: { ...DEFAULT_HOME_PREFERENCE.layout, presentation: 'expressive' },
      });
    }
    return route.fallback();
  });
  await page.route('**/api/platform/v1/home/overview**', (route) =>
    fulfillSuccess(route, overviewWithCommunications())
  );
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');

  const flowHome = page.getByTestId('flow-home');
  const stage = flowHome.getByTestId('flow-home-personal-sections');
  await expect(stage).toHaveAttribute('data-flow-read-template', 'adaptive-wide');
  await expect(stage).toHaveAttribute('data-flow-adaptive-applied', 'true');
  await expect(stage).toHaveAttribute('data-flow-adaptive-first-section', 'today');
  await expect(stage).toHaveAttribute('data-flow-wide-composition', '7-5/4-4-4');
  for (const key of ['response-hub', 'request-tracker', 'role-pulse']) {
    await expect(
      stage.locator(`[data-workspace-widget="${key}"] [data-home-support-stack="true"]`)
    ).toBeVisible();
  }
  const roleInsight = stage.locator(
    '[data-workspace-widget="role-pulse"] [data-home-role-insight]'
  );
  await expect(roleInsight).toBeVisible();
  await expect(roleInsight).toHaveAttribute('role', 'region');
  await expect(roleInsight.locator('[data-home-role-lens]')).toHaveCount(4);
  for (const signalKey of ['open-work', 'focus-time', 'schedule-load', 'activity-attention']) {
    const lens = roleInsight.locator(`[data-home-role-lens="${signalKey}"]`);
    await expect(lens).toBeVisible();
    await expect(lens).toHaveAttribute('href', /\/.+/u);
    await expect(lens.locator('[data-home-role-value]')).not.toHaveText(/NaN|undefined/u);
  }
  const scheduleSeries = roleInsight.locator(
    '[data-home-role-lens="schedule-load"] [data-home-role-series]'
  );
  await expect(scheduleSeries).toBeVisible();
  expect(await scheduleSeries.locator(':scope > *').count()).toBeGreaterThan(0);
  const roleHeaderContract = await stage
    .locator('[data-workspace-widget="role-pulse"] [data-flow-section="purpose-pulse"]')
    .evaluate((section) => {
      const heading = section.querySelector<HTMLElement>('#flow-purpose-pulse-heading')!;
      const insight = section.querySelector<HTMLElement>('[data-home-role-insight]')!;
      const headingBounds = heading.getBoundingClientRect();
      const insightBounds = insight.getBoundingClientRect();
      return {
        insightAfterHeading: insightBounds.top >= headingBounds.bottom,
      };
    });
  expect(roleHeaderContract.insightAfterHeading).toBe(true);
  await expect(
    stage.locator('[data-workspace-widget="request-tracker"] [data-home-request-empty-journey]')
  ).toBeVisible();

  const geometry = await stage.evaluate((root) => {
    const bounds = (key: string) => {
      const box = root
        .querySelector<HTMLElement>(`[data-workspace-widget="${key}"]`)!
        .getBoundingClientRect();
      return {
        left: box.left,
        right: box.right,
        top: box.top,
        bottom: box.bottom,
        width: box.width,
      };
    };
    const grid = root.querySelector<HTMLElement>('[data-workspace-presentation]')!;
    return {
      gridWidth: grid.getBoundingClientRect().width,
      action: bounds('action-queue'),
      first: bounds('today'),
      support: [bounds('response-hub'), bounds('request-tracker'), bounds('role-pulse')],
    };
  });
  const [supportOne, supportTwo, supportThree] = geometry.support;
  expect(supportOne).toBeDefined();
  expect(supportTwo).toBeDefined();
  expect(supportThree).toBeDefined();
  if (!supportOne || !supportTwo || !supportThree) return;
  expect(geometry.action.width / geometry.gridWidth).toBeGreaterThan(0.56);
  expect(geometry.action.width / geometry.gridWidth).toBeLessThan(0.6);
  expect(geometry.first.width / geometry.gridWidth).toBeGreaterThan(0.39);
  expect(geometry.first.width / geometry.gridWidth).toBeLessThan(0.43);
  expect(supportOne.width / geometry.gridWidth).toBeGreaterThan(0.31);
  expect(supportOne.width / geometry.gridWidth).toBeLessThan(0.35);
  expect(Math.abs(geometry.action.top - geometry.first.top)).toBeLessThanOrEqual(2);
  expect(supportOne.top).toBeGreaterThanOrEqual(
    Math.max(geometry.action.bottom, geometry.first.bottom)
  );
  expect(Math.abs(supportOne.top - supportTwo.top)).toBeLessThanOrEqual(2);
  expect(Math.abs(supportTwo.top - supportThree.top)).toBeLessThanOrEqual(2);
  expect(supportTwo.left).toBeGreaterThanOrEqual(supportOne.right);
  expect(supportThree.left).toBeGreaterThanOrEqual(supportTwo.right);

  const workscapeAlignment = await flowHome.locator('[data-flow-workscape]').evaluate((surface) => {
    const copy = surface
      .querySelector<HTMLElement>('[data-flow-context-copy]')!
      .getBoundingClientRect();
    const dock = surface
      .querySelector<HTMLElement>('[data-flow-dock-shell]')!
      .getBoundingClientRect();
    const firstWork = document
      .querySelector<HTMLElement>('[data-workspace-widget="action-queue"] [data-flow-section]')!
      .getBoundingClientRect();
    return {
      copyDockDelta: Math.abs(copy.left - dock.left),
      heroBodyDelta: Math.abs(copy.left - firstWork.left),
    };
  });
  expect(workscapeAlignment.copyDockDelta).toBeLessThanOrEqual(2);
  expect(workscapeAlignment.heroBodyDelta).toBeLessThanOrEqual(64);

  const updates = flowHome.locator('[data-flow-section="updates"]');
  await expect(updates).toHaveAttribute('data-flow-updates-layout', 'wide-6-3-3');
  await expect(updates).toHaveAttribute('data-flow-updates-visible-count', '3');
  await expect(updates.locator('[data-news-secondary-link-cue]')).toHaveCount(2);
  const newsGeometry = await updates.evaluate((root) => {
    const rect = (node: Element) => {
      const box = node.getBoundingClientRect();
      return {
        left: box.left,
        right: box.right,
        top: box.top,
        bottom: box.bottom,
        width: box.width,
      };
    };
    return {
      featured: rect(root.querySelector<HTMLElement>('[data-news-featured]')!),
      secondary: Array.from(root.querySelectorAll<HTMLElement>('[data-news-secondary-card]')).map(
        rect
      ),
    };
  });
  expect(newsGeometry.secondary).toHaveLength(2);
  const [newsTwo, newsThree] = newsGeometry.secondary;
  expect(newsTwo).toBeDefined();
  expect(newsThree).toBeDefined();
  if (!newsTwo || !newsThree) return;
  expect(Math.abs(newsGeometry.featured.top - newsTwo.top)).toBeLessThanOrEqual(2);
  expect(Math.abs(newsTwo.top - newsThree.top)).toBeLessThanOrEqual(2);
  expect(newsGeometry.featured.width / newsTwo.width).toBeGreaterThan(1.9);
  expect(newsGeometry.featured.width / newsTwo.width).toBeLessThan(2.1);
  expect(Math.abs(newsTwo.width - newsThree.width)).toBeLessThanOrEqual(2);

  await expectNoInternalVerticalScroll(flowHome);
  await expectNoHorizontalDocumentOverflow(page, flowHome);
  await expectSeriousAxeViolationsToBeEmpty(page, '[data-testid="flow-home"]');
});

test('Cold reload reserves the Expressive Wide geometry without flashing surplus Dock tiles', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Initial-frame behavior runs once in Chromium.');

  let releasePreference!: () => void;
  const preferenceRelease = new Promise<void>((resolve) => {
    releasePreference = resolve;
  });
  let markPreferenceStarted!: () => void;
  const preferenceStarted = new Promise<void>((resolve) => {
    markPreferenceStarted = resolve;
  });
  let preferenceRequestCount = 0;

  await page.route('**/api/platform/v1/home-preferences**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() !== 'GET' || !path.endsWith('/home-preferences')) {
      return route.fallback();
    }
    preferenceRequestCount += 1;
    if (preferenceRequestCount > 1) {
      markPreferenceStarted();
      await preferenceRelease;
    }
    return fulfillSuccess(route, {
      ...DEFAULT_HOME_PREFERENCE,
      layout: { ...DEFAULT_HOME_PREFERENCE.layout, presentation: 'expressive' },
    });
  });
  await page.route('**/api/platform/v1/home/overview**', (route) =>
    fulfillSuccess(route, overviewWithCommunications())
  );
  await page.addInitScript(() => {
    const observedStates: string[] = [];
    Object.defineProperty(window, '__flowHomeInitialStates', {
      configurable: true,
      value: observedStates,
    });
    const sampleFrame = () => {
      const home = document.querySelector<HTMLElement>('[data-testid="flow-home"]');
      if (home) {
        const stage = home.querySelector<HTMLElement>('[data-flow-read-template]');
        const state = `${home.dataset.flowHomePresentation ?? 'unknown'}:${
          stage?.dataset.flowReadTemplate ?? 'unknown'
        }`;
        if (observedStates.at(-1) !== state) observedStates.push(state);
      }
      requestAnimationFrame(sampleFrame);
    };
    requestAnimationFrame(sampleFrame);
  });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  await expect(page.getByTestId('flow-home')).toHaveAttribute(
    'data-flow-home-presentation',
    'expressive'
  );
  await expect(page.getByTestId('flow-home-personal-sections')).toHaveAttribute(
    'data-flow-read-template',
    'adaptive-wide'
  );

  await page.reload({ waitUntil: 'domcontentloaded' });
  await preferenceStarted;
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      })
  );

  await expect(page.getByTestId('home-experience-bootstrap')).toHaveAttribute(
    'data-home-bootstrap-state',
    'layout'
  );
  await expect(page.getByTestId('flow-home')).toHaveCount(0);
  const loadingDock = page.locator('[data-home-loading-dock]');
  await expect(loadingDock).toBeVisible();
  const loadingSkeleton = page.getByTestId('home-loading-skeleton');
  await expect(loadingSkeleton).toHaveAttribute('data-home-loading-presentation', 'expressive');
  await expect(loadingSkeleton).toHaveAttribute('data-home-loading-read-template', 'adaptive-wide');
  await expect(page.locator('[data-home-loading-widgets]')).toHaveAttribute(
    'data-home-loading-grid-contract',
    '7-5/4-4-4'
  );
  await expect(page.locator('[data-home-loading-dock-item]:visible')).toHaveCount(12);
  const loadingGrid = await page.locator('[data-home-loading-widgets]').evaluate((root) => {
    const rect = (key: string) => {
      const bounds = root
        .querySelector<HTMLElement>(`[data-home-loading-widget="${key}"]`)!
        .getBoundingClientRect();
      return { top: bounds.top, width: bounds.width };
    };
    return {
      action: rect('action-queue'),
      first: rect('today'),
      support: [rect('response-hub'), rect('request-tracker'), rect('role-pulse')],
    };
  });
  expect(loadingGrid.action.width / loadingGrid.first.width).toBeGreaterThan(1.35);
  expect(loadingGrid.action.width / loadingGrid.first.width).toBeLessThan(1.45);
  expect(Math.abs(loadingGrid.action.top - loadingGrid.first.top)).toBeLessThanOrEqual(2);
  expect(
    Math.abs(loadingGrid.support[0]!.width - loadingGrid.support[1]!.width)
  ).toBeLessThanOrEqual(2);
  expect(
    Math.abs(loadingGrid.support[1]!.width - loadingGrid.support[2]!.width)
  ).toBeLessThanOrEqual(2);
  const loadingDockBounds = await loadingDock.boundingBox();
  expect(loadingDockBounds).not.toBeNull();

  releasePreference();
  const flowHome = page.getByTestId('flow-home');
  await expect(flowHome).toHaveAttribute('data-flow-home-presentation', 'expressive');
  await expect(flowHome.getByTestId('flow-home-personal-sections')).toHaveAttribute(
    'data-flow-read-template',
    'adaptive-wide'
  );
  await expect(page.getByTestId('home-experience-bootstrap')).toHaveCount(0);
  const resolvedDock = flowHome.locator('[data-flow-dock-shell]');
  await expect(resolvedDock).toHaveAttribute('data-flow-dock-item-limit', '12');
  await expect(resolvedDock.locator('[data-flow-dock-item]')).toHaveCount(12);
  const resolvedDockBounds = await resolvedDock.boundingBox();
  expect(resolvedDockBounds).not.toBeNull();
  if (loadingDockBounds && resolvedDockBounds) {
    expect(Math.abs(loadingDockBounds.width - resolvedDockBounds.width)).toBeLessThanOrEqual(2);
    expect(Math.abs(loadingDockBounds.height - resolvedDockBounds.height)).toBeLessThanOrEqual(4);
  }
  const observedStates = await page.evaluate(
    () =>
      (
        window as typeof window & {
          __flowHomeInitialStates?: string[];
        }
      ).__flowHomeInitialStates ?? []
  );
  expect(observedStates).not.toContain('balanced:standard');
  expect(observedStates.at(0)).toBe('expressive:adaptive-wide');
});

test('Cold reload keeps the loading and resolved Home single-column at 200% text', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Initial large-text geometry runs once.');
  let releasePreference!: () => void;
  const preferenceRelease = new Promise<void>((resolve) => {
    releasePreference = resolve;
  });
  let markPreferenceStarted!: () => void;
  const preferenceStarted = new Promise<void>((resolve) => {
    markPreferenceStarted = resolve;
  });
  let preferenceRequestCount = 0;
  await page.route('**/api/platform/v1/home-preferences**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() !== 'GET' || !path.endsWith('/home-preferences')) {
      return route.fallback();
    }
    preferenceRequestCount += 1;
    if (preferenceRequestCount > 1) {
      markPreferenceStarted();
      await preferenceRelease;
    }
    return fulfillSuccess(route, {
      ...DEFAULT_HOME_PREFERENCE,
      layout: { ...DEFAULT_HOME_PREFERENCE.layout, presentation: 'expressive' },
    });
  });
  await page.route(/^http:\/\/localhost:\d+\/$/, async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    await route.fulfill({
      response,
      body: body.replace(
        '<head>',
        '<head><style data-home-large-text-probe>html { font-size: 32px !important; }</style>'
      ),
    });
  });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');
  const initialHome = page.getByTestId('flow-home');
  await expect(initialHome).toHaveAttribute('data-flow-large-text', 'true');
  await expect(initialHome.getByTestId('flow-home-personal-sections')).toHaveAttribute(
    'data-flow-read-template',
    'single-column'
  );

  await page.reload({ waitUntil: 'domcontentloaded' });
  await preferenceStarted;
  const skeleton = page.getByTestId('home-loading-skeleton');
  await expect(skeleton).toHaveAttribute('data-home-loading-read-template', 'single-column');
  await expect(page.locator('[data-home-loading-widgets]')).toHaveAttribute(
    'data-home-loading-grid-contract',
    'single-column'
  );
  const loadingColumns = await page
    .locator('[data-home-loading-widgets]')
    .locator('[data-home-loading-widget]')
    .evaluateAll((widgets) =>
      widgets.map((widget) => {
        const bounds = widget.getBoundingClientRect();
        return { top: bounds.top, width: bounds.width };
      })
    );
  expect(new Set(loadingColumns.map(({ top }) => Math.round(top))).size).toBe(
    loadingColumns.length
  );
  expect(
    Math.max(...loadingColumns.map(({ width }) => width)) -
      Math.min(...loadingColumns.map(({ width }) => width))
  ).toBeLessThanOrEqual(2);

  releasePreference();
  const resolvedHome = page.getByTestId('flow-home');
  await expect(resolvedHome).toHaveAttribute('data-flow-large-text', 'true');
  await expect(resolvedHome.getByTestId('flow-home-personal-sections')).toHaveAttribute(
    'data-flow-read-template',
    'single-column'
  );
  await expectNoHorizontalDocumentOverflow(page, resolvedHome);
});

test('the evidence-backed action cue stays singular and supports reversible relevance feedback', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Recommendation interaction runs once.');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');

  const cue = page.locator('[data-home-recommendation-cue]');
  await expect(cue).toHaveCount(1);
  await cue.click();
  const dialog = page.getByRole('dialog', { name: 'Review work approaching its deadline' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(/signals.*confidence/i);
  await dialog.getByRole('button', { name: 'This recommendation is not relevant' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(cue).toHaveCount(0);
});

test('Expressive Wide keeps a personalized widget order out of the adaptive template', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Wide personalization runs once in Chromium.');
  const [command, schedule, response, request, pulse] = DEFAULT_HOME_PREFERENCE.layout.widgets;
  await page.route('**/api/platform/v1/home-preferences**', (route) => {
    const requestCall = route.request();
    const path = new URL(requestCall.url()).pathname;
    if (requestCall.method() === 'GET' && path.endsWith('/home-preferences')) {
      return fulfillSuccess(route, {
        ...DEFAULT_HOME_PREFERENCE,
        customized: true,
        layout: {
          ...DEFAULT_HOME_PREFERENCE.layout,
          presentation: 'expressive',
          widgets: [command!, response!, schedule!, request!, pulse!],
        },
      });
    }
    return route.fallback();
  });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');

  const stage = page.getByTestId('flow-home-personal-sections');
  await expect(stage).toHaveAttribute('data-flow-read-template', 'personalized');
  await expect(stage).toHaveAttribute('data-flow-adaptive-applied', 'false');
  const personalOrder = await stage
    .locator('[data-workspace-widget-policy="PERSONAL"]')
    .evaluateAll((widgets) =>
      widgets.map((widget) => widget.getAttribute('data-workspace-widget'))
    );
  expect(personalOrder).toEqual(['response-hub', 'today', 'request-tracker', 'role-pulse']);
});

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 900, height: 800 },
  { width: 390, height: 844 },
  { width: 320, height: 720 },
] as const) {
  test(`Flow Home at ${viewport.width}px reflows purpose widgets without horizontal overflow`, async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'chromium',
      'The responsive width matrix runs once in Chromium.'
    );
    await page.setViewportSize(viewport);
    await page.goto('/');

    const flowHome = page.getByTestId('flow-home');
    await expect(flowHome).toBeVisible();
    await expectNoHorizontalDocumentOverflow(page, flowHome);
    await expectNoInternalVerticalScroll(flowHome);
    await expectDwaionBottomAnchor(page);

    const overflowTriggers = flowHome.locator('[data-home-purpose-overflow-trigger]:visible');
    const overflowTriggerGeometry = await overflowTriggers.evaluateAll((buttons) =>
      buttons.map((button) => {
        const element = button as HTMLElement;
        const bounds = element.getBoundingClientRect();
        return {
          label: element.innerText.trim(),
          width: bounds.width,
          height: bounds.height,
          clippedVertically: element.scrollHeight > element.clientHeight + 1,
          whiteSpace: window.getComputedStyle(element).whiteSpace,
        };
      })
    );
    expect(
      overflowTriggerGeometry.every(
        (trigger) =>
          trigger.width >= 44 &&
          trigger.height >= 44 &&
          !trigger.clippedVertically &&
          trigger.whiteSpace === 'nowrap'
      )
    ).toBe(true);
    if (viewport.width < 600) {
      expect(overflowTriggerGeometry.every((trigger) => /^\+\d+$/u.test(trigger.label))).toBe(true);
    }

    const geometry = await flowHome.getByTestId('flow-home-personal-sections').evaluate((root) => {
      const grid = root.querySelector<HTMLElement>('[data-workspace-presentation]');
      const items = Array.from(
        root.querySelectorAll<HTMLElement>('[data-workspace-widget]')
      ).filter((item) => item.offsetParent !== null);
      const gridBounds = grid?.getBoundingClientRect();
      return {
        gridColumns: grid ? window.getComputedStyle(grid).gridTemplateColumns.split(' ').length : 0,
        gridLeft: gridBounds?.left ?? 0,
        gridRight: gridBounds?.right ?? 0,
        items: items.map((item) => {
          const bounds = item.getBoundingClientRect();
          return {
            key: item.getAttribute('data-workspace-widget'),
            left: bounds.left,
            right: bounds.right,
            top: bounds.top,
            bottom: bounds.bottom,
          };
        }),
      };
    });

    if (viewport.width >= 1200) {
      await expectPurposeDesktopGrid(flowHome);
    } else if (viewport.width >= 900) {
      await expect(flowHome.getByTestId('flow-home-personal-sections')).toHaveAttribute(
        'data-flow-read-template',
        'adaptive-medium'
      );
      const [action, first, second, third, fourth] = geometry.items;
      expect(action).toBeDefined();
      expect(first).toBeDefined();
      expect(second).toBeDefined();
      expect(third).toBeDefined();
      expect(fourth).toBeDefined();
      if (!action || !first || !second || !third || !fourth) return;
      expect(Math.abs(action.left - geometry.gridLeft)).toBeLessThanOrEqual(2);
      expect(Math.abs(action.right - geometry.gridRight)).toBeLessThanOrEqual(2);
      expect(Math.abs(first.top - second.top)).toBeLessThanOrEqual(2);
      expect(Math.abs(first.left - geometry.gridLeft)).toBeLessThanOrEqual(2);
      expect(Math.abs(second.right - geometry.gridRight)).toBeLessThanOrEqual(2);
      expect(Math.abs(third.top - fourth.top)).toBeLessThanOrEqual(2);
      expect(Math.abs(third.left - geometry.gridLeft)).toBeLessThanOrEqual(2);
      expect(Math.abs(fourth.right - geometry.gridRight)).toBeLessThanOrEqual(2);
    } else {
      expect(geometry.gridColumns).toBe(1);
      for (const widget of geometry.items) {
        expect(Math.abs(widget.left - geometry.gridLeft)).toBeLessThanOrEqual(2);
        expect(Math.abs(widget.right - geometry.gridRight)).toBeLessThanOrEqual(2);
      }
      for (let index = 1; index < geometry.items.length; index += 1) {
        expect(geometry.items[index]!.top).toBeGreaterThanOrEqual(
          geometry.items[index - 1]!.bottom
        );
      }
    }

    if (viewport.width < 600) {
      await expect(flowHome.locator('[data-flow-dock-item]')).toHaveCount(4);
      const firstContribution = purpose(flowHome, 'action')
        .locator('[data-home-contribution]')
        .first();
      await expect(firstContribution).toBeVisible();
      const bounds = await firstContribution.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(viewport.height);
    }
  });
}

test('purpose widgets adapt coherently for zero, one, and many items', async ({ page }) => {
  let count = 0;
  await routeEmptyExternalContributions(page);
  await page.route('**/api/platform/v1/home/overview**', (route) =>
    fulfillSuccess(route, workOverviewWithCount(count))
  );
  await page.setViewportSize({ width: 1440, height: 900 });

  for (const expectedCount of [0, 1, 5]) {
    count = expectedCount;
    await page.goto('/');
    const flowHome = page.getByTestId('flow-home');
    const action = purpose(flowHome, 'action');
    await expect(action).toHaveAttribute(
      'data-home-content-state',
      expectedCount === 0 ? 'empty' : 'available'
    );
    // Height changes information density, not the set of visible records.
    // The standard action budget remains three rows with explicit overflow.
    await expect(action.locator('[role="listitem"]')).toHaveCount(Math.min(expectedCount, 3));

    if (expectedCount === 0) {
      await expect(action).toContainText('Nothing needs action right now');
      for (const key of ['timeline', 'response', 'request', 'pulse'] as const) {
        await expect(purpose(flowHome, key)).toHaveAttribute('data-home-content-state', 'empty');
      }
    } else if (expectedCount === 1) {
      await expect(action.getByText('Purpose queue item 1', { exact: true })).toBeVisible();
    } else {
      await expect(action.getByText('Purpose queue item 3', { exact: true })).toBeVisible();
      await expect(action.getByText('Purpose queue item 4', { exact: true })).toHaveCount(0);
      await expect(action.getByRole('link', { name: /View all/ })).toContainText(
        'View all · 2 more'
      );
    }

    await expectNoInternalVerticalScroll(flowHome);
  }
});

test('mixed-source overflow stays reachable without inventing a unified route', async ({
  page,
}, testInfo) => {
  await routeEmptyExternalContributions(page);
  await page.route(/\/api\/approvals\/v1\/home(?:\?|$)/u, (route) =>
    fulfillSuccess(route, { ...APPROVAL_HOME_FIXTURE, administrator: false })
  );
  await page.route('**/api/platform/v1/home/overview**', (route) =>
    fulfillSuccess(route, workOverviewWithCount(4))
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');

  const action = purpose(page.getByTestId('flow-home'), 'action');
  await expect(action.locator('[role="listitem"]')).toHaveCount(3);
  await expect(action.getByRole('link', { name: /View all/ })).toHaveCount(0);

  const overflowTrigger = action.getByRole('button', { name: 'View 2 more' });
  await expect(overflowTrigger).toContainText('View 2 more');
  await overflowTrigger.click();

  const dialog = page.getByRole('dialog', { name: 'View 2 more' });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('[role="listitem"]')).toHaveCount(2);
  const safeLinks = dialog.locator('a[href]');
  const routes = await safeLinks.evaluateAll((links) =>
    links.map((link) => link.getAttribute('href'))
  );
  expect(routes).toHaveLength(2);
  expect(
    routes.every((route) => route?.startsWith('/work/') || route?.startsWith('/approvals/'))
  ).toBe(true);
  const closeButton = dialog.getByRole('button', { name: 'Close' });
  await closeButton.focus();
  await expect(closeButton).toBeFocused();
  if (testInfo.project.name === 'mobile') {
    // Mobile Chromium does not include anchors in sequential keyboard focus.
    // Direct focus still verifies the route remains an operable focus target;
    // desktop Chromium verifies the actual Tab order below.
    await safeLinks.first().focus();
  } else {
    await closeButton.press('Tab');
  }
  await expect(safeLinks.first()).toBeFocused();
  await expectSeriousAxeViolationsToBeEmpty(page, '[role="dialog"]');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(overflowTrigger).toBeFocused();
});

test('one failed app provider keeps valid work visible and discloses the partial state', async ({
  page,
}) => {
  await routeEmptyExternalContributions(page, { approvals: 'unavailable' });
  await page.route('**/api/platform/v1/home/overview**', (route) =>
    fulfillSuccess(route, workOverviewWithCount(2))
  );
  await page.goto('/');

  const flowHome = page.getByTestId('flow-home');
  const action = purpose(flowHome, 'action');
  const response = purpose(flowHome, 'response');
  await expect(action).toHaveAttribute('data-home-content-state', 'partial');
  await expect(action.locator('[data-home-contribution]')).toHaveCount(2);
  await expect(action.getByText('Purpose queue item 1', { exact: true })).toBeVisible();
  await expect(response).toHaveAttribute('data-home-content-state', 'partial');
  await expect(response).toContainText('Some data is delayed');
  await expect(response.getByRole('button', { name: 'Try again' })).toBeVisible();
  await expect(response).not.toContainText('No responses are waiting');
  const healthStrip = flowHome.locator('[data-flow-health-strip]');
  await expect(healthStrip).toHaveAttribute('data-flow-health-state', 'partial');
  await expect(healthStrip).toHaveAttribute('data-flow-health-domains', 'approvals');
  await expect(healthStrip).toContainText(
    'Approvals could not be loaded. Other work information and apps remain available.'
  );
  await expect(healthStrip.getByRole('button', { name: 'Reload work data' })).toBeVisible();
  await expectSeriousAxeViolationsToBeEmpty(page, '[data-testid="flow-home"]');
});

test('health details use the freshest successful provider time when the overview is unavailable', async ({
  page,
}) => {
  let overviewAttempts = 0;
  await page.route('**/api/platform/v1/home/overview**', (route) => {
    overviewAttempts += 1;
    return route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ERROR', message: 'Overview temporarily unavailable' }),
    });
  });
  await page.goto('/');

  const unavailableNotice = page
    .getByTestId('flow-home')
    .locator('[data-flow-section="required-notice"]');
  await expect(unavailableNotice).toHaveAttribute('data-flow-notice-tone', 'unavailable');
  const noticeRetry = unavailableNotice.getByRole('button', { name: 'Try again' });
  await expectMinimumTargets(unavailableNotice, 'button');
  await noticeRetry.focus();
  await expect(noticeRetry).toBeFocused();
  await noticeRetry.press('Enter');
  await expect.poll(() => overviewAttempts).toBeGreaterThan(1);

  const healthStrip = page.getByTestId('flow-home').locator('[data-flow-health-strip]');
  await expect(healthStrip).toHaveAttribute('data-flow-health-state', 'unavailable');
  const detailsTrigger = healthStrip.getByRole('button', {
    name: 'View work information status',
  });
  await detailsTrigger.click();
  const details = page.getByRole('region', { name: 'Work information status' });
  await expect(details).toBeVisible();
  await expect(details).not.toContainText('As of -');
  await expect(details).toContainText(/As of .*\d/);
  await page.keyboard.press('Escape');
  await expect(details).toHaveCount(0);
  await expect(detailsTrigger).toBeFocused();
});

test('a successful partial notification summary never masquerades as an empty response queue', async ({
  page,
}) => {
  await routeEmptyExternalContributions(page);
  await page.route('**/api/notifications/v1/summary/by-app', (route) =>
    fulfillSuccess(route, {
      partial: true,
      unavailableSources: ['messaging'],
      apps: [],
      changeVersion: 'partial-1',
      counterVersion: 'partial-1',
      generatedAt: FLOW_FIXTURE_NOW.toISOString(),
    })
  );
  await page.route('**/api/platform/v1/home/overview**', (route) =>
    fulfillSuccess(route, emptyHomeOverview())
  );
  await page.goto('/');

  const response = purpose(page.getByTestId('flow-home'), 'response');
  await expect(response).toHaveAttribute('data-home-content-state', 'partial');
  await expect(response).toContainText('Some data is delayed');
  await expect(response).not.toContainText('No responses are waiting');
  const healthStrip = page.getByTestId('flow-home').locator('[data-flow-health-strip]');
  await expect(healthStrip).toHaveAttribute('data-flow-health-state', 'partial');
  await expect(healthStrip).toHaveAttribute('data-flow-health-domains', 'notifications');
  await expect(healthStrip).toContainText(
    'Notifications could not be loaded. Other work information and apps remain available.'
  );
});

test('HCM domain fallback zeroes remain partial rather than confirmed pulse data', async ({
  page,
}) => {
  await routeEmptyExternalContributions(page);
  await page.route('**/api/people/v1/hr/home', (route) =>
    fulfillSuccess(route, {
      ...emptyHrHome(),
      domainStates: {
        ...emptyHrHome().domainStates,
        TIME: {
          availability: 'UNAVAILABLE',
          dataOrigin: 'NONE',
          reasonCode: 'SOURCE_TIMEOUT',
        },
      },
    })
  );
  await page.route('**/api/platform/v1/home/overview**', (route) =>
    fulfillSuccess(route, emptyHomeOverview())
  );
  await page.goto('/');

  const pulse = purpose(page.getByTestId('flow-home'), 'pulse');
  await expect(pulse).toHaveAttribute('data-home-content-state', 'partial');
  await expect(pulse).toContainText('Some data is delayed');
  await expect(pulse.locator('[data-home-role-insight]')).toBeVisible();
  await expect(pulse.locator('[data-home-purpose-status]')).toHaveCount(0);
  await expect(pulse).not.toContainText('No work signals right now');
});

test('required notices interrupt once while normal News remains the trailing governed zone', async ({
  page,
}) => {
  await page.route('**/api/platform/v1/home/overview**', (route) =>
    fulfillSuccess(route, overviewWithCommunications(REQUIRED_COMMUNICATIONS_FIXTURE))
  );
  await page.goto('/');

  const flowHome = page.getByTestId('flow-home');
  const required = flowHome.locator('[data-flow-section="required-notice"]');
  const updates = flowHome.locator('[data-flow-section="updates"]');
  await expect(required).toBeVisible();
  await expect(required).toContainText(HOME_COMMUNICATIONS_FIXTURE.featured.title);
  await expect(updates).toBeVisible();
  await expect(
    updates.getByText(HOME_COMMUNICATIONS_FIXTURE.featured.title, { exact: true })
  ).toHaveCount(0);

  const order = await flowHome
    .locator('[data-flow-section]')
    .evaluateAll((sections) =>
      sections.map((section) => section.getAttribute('data-flow-section'))
    );
  expect(order).toEqual([
    'app-dock',
    'required-notice',
    'purpose-action',
    'purpose-timeline',
    'purpose-response',
    'purpose-request',
    'purpose-pulse',
    'updates',
  ]);

  const [requiredBounds, stageBounds, actionBounds, updatesBounds, pulseBounds] = await Promise.all(
    [
      required.boundingBox(),
      flowHome.locator('[data-testid="flow-home-personal-sections"]').boundingBox(),
      purpose(flowHome, 'action').boundingBox(),
      updates.boundingBox(),
      purpose(flowHome, 'pulse').boundingBox(),
    ]
  );
  expect(requiredBounds).not.toBeNull();
  expect(stageBounds).not.toBeNull();
  expect(actionBounds).not.toBeNull();
  expect(updatesBounds).not.toBeNull();
  expect(pulseBounds).not.toBeNull();
  if (requiredBounds && stageBounds && actionBounds && updatesBounds && pulseBounds) {
    expect(Math.abs(requiredBounds.width - stageBounds.width)).toBeLessThanOrEqual(1);
    expect(requiredBounds.y + requiredBounds.height).toBeLessThanOrEqual(actionBounds.y + 1);
    expect(pulseBounds.y + pulseBounds.height).toBeLessThanOrEqual(updatesBounds.y + 1);
  }

  const review = required.getByRole('link', { name: 'Review' });
  await expect(review).toHaveAttribute('href', '/communications/required/4101');
  await expectMinimumTargets(required, '[data-flow-required-cta]');
  await review.focus();
  await expect(review).toBeFocused();
  await expectSeriousAxeViolationsToBeEmpty(page, '[data-flow-section="required-notice"]');
  await review.press('Enter');
  await expect(page).toHaveURL(/\/communications\/required\/4101$/u);
});

test('a required notice remains visible when the organization hides general News', async ({
  page,
}) => {
  await routeFlowExperience(page, {
    compositionPolicy: {
      ...FLOW_POLICY,
      governedZones: FLOW_POLICY.governedZones.map((zone) => ({ ...zone, visible: false })),
    },
  });
  await page.route('**/api/platform/v1/home/overview**', (route) =>
    fulfillSuccess(route, overviewWithCommunications(REQUIRED_COMMUNICATIONS_FIXTURE))
  );
  await page.goto('/');

  const flowHome = page.getByTestId('flow-home');
  await expect(flowHome.locator('[data-flow-section="required-notice"]')).toBeVisible();
  await expect(flowHome.locator('[data-flow-section="updates"]')).toHaveCount(0);
  await expect(flowHome.locator('[data-workspace-widget="announcements"]')).toHaveCount(0);
});

test('tenant imagery remains colourful behind a bounded, readable app Dock', async ({ page }) => {
  await routeFlowExperience(page, {
    backgroundUrl: '/media/communications/workplace-improvement.jpg',
    backgroundPosition: 'RIGHT',
    overlayOpacity: 24,
  });
  await page.route('**/api/platform/v1/home/overview**', (route) =>
    fulfillSuccess(route, overviewWithCommunications())
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');

  const flowHome = page.getByTestId('flow-home');
  const workscape = flowHome.locator('[data-flow-workscape]');
  const dock = workscape.locator('[data-flow-dock-shell]');
  await expect(workscape).toHaveAttribute('data-tenant-image-opacity', '1');
  const visualContract = await workscape.evaluate((surface) => {
    const dock = surface.querySelector<HTMLElement>('[data-flow-dock-shell]');
    const surfaceBounds = surface.getBoundingClientRect();
    const dockBounds = dock?.getBoundingClientRect();
    return {
      imageOpacity: window.getComputedStyle(surface, '::before').opacity,
      workscapeHeight: surfaceBounds.height,
      dockWidth: dockBounds?.width ?? 0,
      workscapeWidth: surfaceBounds.width,
      dockBackground: dock ? window.getComputedStyle(dock).backgroundColor : '',
    };
  });
  expect(visualContract.imageOpacity).toBe('1');
  expect(visualContract.workscapeHeight).toBeLessThanOrEqual(340);
  expect(visualContract.dockWidth / visualContract.workscapeWidth).toBeLessThanOrEqual(0.82);
  expect(visualContract.dockBackground).not.toBe('rgba(0, 0, 0, 0)');
  await expect(dock.locator('[data-flow-dock-item]')).toHaveCount(8);
});

test('read mode collapses sparse saved footprints while edit mode exposes semantic height controls', async ({
  page,
}) => {
  await routeEmptyExternalContributions(page);
  await page.route('**/api/platform/v1/home/overview**', (route) =>
    fulfillSuccess(route, emptyHomeOverview())
  );
  await page.route('**/api/platform/v1/home-preferences**', (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && path.endsWith('/home-preferences')) {
      return fulfillSuccess(route, {
        ...DEFAULT_HOME_PREFERENCE,
        customized: true,
        layout: {
          ...DEFAULT_HOME_PREFERENCE.layout,
          widgets: DEFAULT_HOME_PREFERENCE.layout.widgets.map((widget) =>
            widget.widgetKey === 'focus' ? { ...widget, size: 'full', height: 'tall' } : widget
          ),
        },
        version: 3,
      });
    }
    return route.fallback();
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');

  const frame = page.locator('[data-workspace-widget="request-tracker"]');
  await expect(frame).toHaveAttribute('data-workspace-widget-size', 'full');
  await expect(frame).toHaveAttribute('data-workspace-widget-height', 'tall');
  const readHeight = (await frame.boundingBox())?.height ?? Number.POSITIVE_INFINITY;
  expect(readHeight).toBeLessThanOrEqual(208);

  await page.getByRole('button', { name: 'Edit home' }).click();
  await expect.poll(async () => Math.round((await frame.boundingBox())?.height ?? 0)).toBe(348);
  await frame.locator('[data-widget-footprint-trigger]').click();
  const picker = page.getByRole('dialog', { name: 'My requests widget size' });
  await expect(picker.locator('[data-widget-height-option="tall"]')).toHaveAttribute(
    'aria-pressed',
    'true'
  );

  const heights: number[] = [];
  for (const height of ['short', 'standard', 'tall'] as const) {
    await picker.locator(`[data-widget-height-option="${height}"]`).click();
    await expect(frame).toHaveAttribute('data-workspace-widget-height', height);
    heights.push(Math.round((await frame.boundingBox())?.height ?? 0));
    const content = await frame
      .locator('[data-workspace-widget-content]')
      .evaluate((node) => ({ clientHeight: node.clientHeight, scrollHeight: node.scrollHeight }));
    expect(content.scrollHeight).toBeLessThanOrEqual(content.clientHeight + 1);
  }
  expect(heights).toEqual([212, 276, 348]);

  // Leave a real draft delta so cancelling exercises the discard path as well
  // as the responsive height contract above.
  await picker.locator('[data-widget-height-option="standard"]').click();
  await expect(frame).toHaveAttribute('data-workspace-widget-height', 'standard');

  await page.keyboard.press('Escape');
  await page
    .locator('[data-workspace-composer-placement="floating"]')
    .getByRole('button', { name: 'Cancel changes' })
    .click();
  const discard = page.getByRole('alertdialog');
  await discard.getByRole('button', { name: 'Discard changes' }).click();
  await expect(frame).toHaveAttribute('data-workspace-widget-height', 'tall');
  expect((await frame.boundingBox())?.height ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(208);
});

test('role overview keeps all four visual signals across short, standard, and tall heights', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Role height geometry runs once in Chromium.');
  await page.route('**/api/platform/v1/home/overview**', (route) =>
    fulfillSuccess(route, overviewWithCommunications())
  );
  await page.route('**/api/people/v1/hr/home', (route) =>
    fulfillSuccess(route, { ...HR_HOME_FIXTURE, generatedAt: FLOW_FIXTURE_NOW.toISOString() })
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Edit home' }).click();

  const frame = page.locator('[data-workspace-widget="role-pulse"]');
  await frame.locator('[data-widget-footprint-trigger]').click();
  const picker = page
    .locator('[role="dialog"]')
    .filter({ has: page.locator('[data-widget-height-option]') });
  await expect(picker).toBeVisible();

  for (const height of ['short', 'standard', 'tall'] as const) {
    await picker.locator(`[data-widget-height-option="${height}"]`).click();
    await expect(frame).toHaveAttribute('data-workspace-widget-height', height);
    const insight = frame.locator('[data-home-role-insight]');
    await expect(insight).toHaveAttribute('data-home-role-density', height);
    await expect(insight).toHaveAttribute('data-home-role-layout', '2x2');
    await expect(insight.locator('[data-home-role-lens]')).toHaveCount(4);
    await expect(insight.locator('[data-home-role-detail]')).toHaveCount(height === 'tall' ? 4 : 0);
    const content = await frame
      .locator('[data-workspace-widget-content]')
      .evaluate((node) => ({ clientHeight: node.clientHeight, scrollHeight: node.scrollHeight }));
    expect(content.scrollHeight, `${height} role content clipping`).toBeLessThanOrEqual(
      content.clientHeight + 1
    );
  }

  await picker.locator('[data-widget-height-option="short"]').click();
  await expect(frame.locator('[data-home-role-compact-exception="true"]')).toBeVisible();
  await expect(frame.locator('[data-home-role-exception-summary]')).toHaveCount(1);
});

test('the editor explains governed ownership and keeps personal resize and move controls', async ({
  page,
}) => {
  await page.route('**/api/platform/v1/home/overview**', (route) =>
    fulfillSuccess(route, overviewWithCommunications())
  );
  await page.setViewportSize({ width: 1440, height: 720 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Edit home' }).click();

  const flowHome = page.getByTestId('flow-home');
  const action = purposeFrame(flowHome, 'action');
  const news = flowHome.locator('[data-workspace-widget="announcements"]');
  const today = purposeFrame(flowHome, 'timeline');
  await expect(flowHome.getByTestId('flow-home-personal-sections')).toHaveAttribute(
    'data-flow-read-template',
    'editing'
  );
  await expect(action).toHaveAttribute('data-workspace-widget-policy', 'GOVERNED');
  await expect(action).toHaveAttribute('data-workspace-widget-governance', 'SYSTEM');
  await expect(news).toHaveAttribute('data-workspace-widget-policy', 'GOVERNED');
  await expect(news).toHaveAttribute('data-workspace-widget-governance', 'ORGANIZATION');
  await expect(today).toHaveAttribute('data-workspace-widget-policy', 'PERSONAL');
  await expect(action.locator('button[aria-label^="Move "]')).toHaveCount(0);
  await expect(news.locator('button[aria-label^="Move "]')).toHaveCount(0);
  await expect(today.locator('button[aria-label="Move Today\'s schedule widget"]')).toBeVisible();
  await expect(today.locator('[data-widget-footprint-trigger]')).toBeVisible();
  expect(
    await today
      .locator('[data-workspace-widget-content] > section')
      .evaluate((section) => window.getComputedStyle(section).borderTopWidth)
  ).toBe('1px');
  await expect(action.locator('[data-workspace-widget-content]')).toHaveAttribute('inert', '');
  await expect(news.locator('[data-workspace-widget-content]')).toHaveAttribute('inert', '');
  await expectMinimumTargets(
    flowHome,
    '[data-workspace-widget-policy="PERSONAL"] button, [data-workspace-composer-placement="floating"] button'
  );
  await expectSeriousAxeViolationsToBeEmpty(page, '[data-testid="flow-home"]');
});

test('long-pressing a personal purpose widget enters the existing Home editor', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');

  const widget = page.locator('[data-workspace-widget="today"]');
  const toolbar = page.locator('[data-workspace-composer-placement="floating"]');
  await expect(widget).toHaveAttribute('data-workspace-widget-long-press', 'enabled');
  const bounds = await widget.boundingBox();
  expect(bounds).not.toBeNull();
  if (!bounds) throw new Error('Widget geometry is required for the long-press scenario.');
  const pointer = {
    pointerId: 41,
    pointerType: 'touch',
    isPrimary: true,
    button: 0,
    buttons: 1,
    clientX: bounds.x + Math.min(40, bounds.width / 2),
    clientY: bounds.y + Math.min(40, bounds.height / 2),
  };

  await widget.dispatchEvent('pointerdown', pointer);
  await page.waitForTimeout(600);
  await widget.dispatchEvent('pointerup', { ...pointer, buttons: 0 });

  await expect(toolbar).toBeVisible();
  await expect(page.locator('[data-workspace-widget-motion="settle"]')).toHaveCount(4);
  await toolbar.getByRole('button', { name: 'Cancel changes' }).click();
  await expect(widget).toHaveAttribute('data-workspace-widget-long-press', 'enabled');
});

test('keyboard move controls reorder only personal purpose widgets and cancel restores the draft', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  const editTrigger = page.getByRole('button', { name: 'Edit home' });
  await editTrigger.click();

  const flowHome = page.getByTestId('flow-home');
  const personal = flowHome.locator('[data-workspace-widget-policy="PERSONAL"]');
  const governed = flowHome.locator('[data-workspace-widget-policy="GOVERNED"]');
  const order = () =>
    personal.evaluateAll((widgets) =>
      widgets.map((widget) => widget.getAttribute('data-workspace-widget'))
    );
  const governedOrder = () =>
    governed.evaluateAll((widgets) =>
      widgets.map((widget) => widget.getAttribute('data-workspace-widget'))
    );
  const original = await order();
  const originalGoverned = await governedOrder();
  const moveEarlier = flowHome.getByRole('button', {
    name: 'Move My requests widget earlier',
    exact: true,
  });

  await moveEarlier.focus();
  await moveEarlier.press('Enter');
  const movedOrder = ['today', 'request-tracker', 'response-hub', 'role-pulse'];
  await expect.poll(order).toEqual(movedOrder);
  await expect.poll(governedOrder).toEqual(originalGoverned);

  const toolbar = page.locator('[data-workspace-composer-placement="floating"]');
  await toolbar.getByRole('button', { name: 'Undo last change' }).click();
  await expect.poll(order).toEqual(original);
  await toolbar.getByRole('button', { name: 'Redo change' }).click();
  await expect.poll(order).toEqual(movedOrder);

  await toolbar.getByRole('button', { name: 'Cancel changes' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Discard changes' }).click();
  await expect.poll(order).toEqual(original);
  await expect(editTrigger).toBeFocused();
});

test('pointer drag reorders only personal purpose widgets and cancel restores the draft', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Pointer drag is verified once in Chromium.');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  const editTrigger = page.getByRole('button', { name: 'Edit home' });
  await editTrigger.click();

  const flowHome = page.getByTestId('flow-home');
  const personal = flowHome.locator('[data-workspace-widget-policy="PERSONAL"]');
  const governed = flowHome.locator('[data-workspace-widget-policy="GOVERNED"]');
  const order = () =>
    personal.evaluateAll((widgets) =>
      widgets.map((widget) => widget.getAttribute('data-workspace-widget'))
    );
  const governedOrder = () =>
    governed.evaluateAll((widgets) =>
      widgets.map((widget) => widget.getAttribute('data-workspace-widget'))
    );
  const original = await order();
  const originalGoverned = await governedOrder();
  const sourceFrame = purposeFrame(flowHome, 'timeline');
  const sourceHandle = sourceFrame.getByRole('button', {
    name: "Move Today's schedule widget",
    exact: true,
  });
  const targetFrame = purposeFrame(flowHome, 'response');
  const [sourceBounds, targetBounds] = await Promise.all([
    sourceHandle.boundingBox(),
    targetFrame.boundingBox(),
  ]);
  expect(sourceBounds).not.toBeNull();
  expect(targetBounds).not.toBeNull();
  if (!sourceBounds || !targetBounds) return;

  const sourceX = sourceBounds.x + sourceBounds.width / 2;
  const sourceY = sourceBounds.y + sourceBounds.height / 2;
  await page.mouse.move(sourceX, sourceY);
  await page.mouse.down();
  try {
    await page.mouse.move(sourceX + 10, sourceY, { steps: 3 });
    await expect(sourceFrame).toHaveAttribute('data-widget-drop-preview', 'true');
    await expect(sourceFrame.locator('[data-widget-drop-slot]')).toBeVisible();
    await page.mouse.move(
      targetBounds.x + targetBounds.width / 2,
      targetBounds.y + targetBounds.height / 2,
      { steps: 16 }
    );
    await expect.poll(order).not.toEqual(original);
  } finally {
    await page.mouse.up();
  }

  await expect.poll(order).toEqual(['response-hub', 'request-tracker', 'today', 'role-pulse']);
  await expect.poll(governedOrder).toEqual(originalGoverned);
  await expect(sourceFrame.locator('[data-widget-drop-slot]')).toHaveCount(0);

  const toolbar = page.locator('[data-workspace-composer-placement="floating"]');
  await toolbar.getByRole('button', { name: 'Cancel changes' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Discard changes' }).click();
  await expect.poll(order).toEqual(original);
  await expect(editTrigger).toBeFocused();
});

test('mobile preview keeps semantic DOM order while rendering every purpose widget full width', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Edit home' }).click();
  const toolbar = page.locator('[data-workspace-composer-placement="floating"]');
  await toolbar.getByRole('button', { name: 'Mobile preview' }).click();

  const flowHome = page.getByTestId('flow-home');
  await expect(flowHome).toHaveAttribute('data-preview-device', 'mobile');
  await expect
    .poll(async () => Math.round((await flowHome.boundingBox())?.width ?? Number.POSITIVE_INFINITY))
    .toBeLessThanOrEqual(390);
  // Edit mode expands the Dock into its existing reorderable launchpad. The
  // 4-item mobile read-mode budget is covered by the responsive matrix above.
  await expect(flowHome.locator('[data-flow-dock-item]')).toHaveCount(0);
  await expect(flowHome.locator('[data-launchpad-item]')).toHaveCount(16);
  const layout = await flowHome.getByTestId('flow-home-personal-sections').evaluate((root) => {
    const grid = root.querySelector<HTMLElement>('[data-workspace-presentation]')!;
    const gridBounds = grid.getBoundingClientRect();
    return {
      columns: window.getComputedStyle(grid).gridTemplateColumns.split(' ').length,
      keys: Array.from(grid.querySelectorAll<HTMLElement>('[data-workspace-widget]')).map(
        (widget) => widget.getAttribute('data-workspace-widget')
      ),
      widths: Array.from(grid.querySelectorAll<HTMLElement>('[data-workspace-widget]')).map(
        (widget) => {
          const bounds = widget.getBoundingClientRect();
          return {
            leftGap: Math.abs(bounds.left - gridBounds.left),
            rightGap: Math.abs(bounds.right - gridBounds.right),
          };
        }
      ),
    };
  });
  expect(layout.columns).toBe(1);
  expect(layout.keys).toEqual([
    'action-queue',
    'today',
    'response-hub',
    'request-tracker',
    'role-pulse',
    'announcements',
  ]);
  expect(layout.widths.every(({ leftGap, rightGap }) => leftGap <= 2 && rightGap <= 2)).toBe(true);
  await expectNoHorizontalDocumentOverflow(page, flowHome);
  await toolbar.getByRole('button', { name: 'Cancel changes' }).click();
});

test('DWAI·ON uses stable compact and desktop anchors through document scrolling', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto('/');
  await expectDwaionBottomAnchor(page);
  await expectDwaionFixedAcrossDocumentScroll(page);

  await page.setViewportSize({ width: 1024, height: 700 });
  await page.reload();
  await expectDwaionBottomAnchor(page);
  await expectDwaionFixedAcrossDocumentScroll(page);
});

test('DWAI·ON reserves space only for a purpose widget it actually intersects', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Launcher collision geometry runs once.');
  // Keep the floating launcher in the same vertical lane as the primary row.
  // A tall viewport can legitimately place every purpose widget above it.
  await page.setViewportSize({ width: 1440, height: 720 });
  await page.goto('/');

  const stage = page.getByTestId('flow-home-personal-sections');
  await expect(stage.locator('[data-workspace-widget]')).not.toHaveCount(0);
  const collisionContract = await stage.evaluate((root) => {
    const launcher = document.querySelector<HTMLElement>('[data-testid="dwaion-launcher"]')!;
    const launcherRect = launcher.getBoundingClientRect();
    const stageRect = root.getBoundingClientRect();
    const widgets = Array.from(root.querySelectorAll<HTMLElement>('[data-workspace-widget]')).map(
      (widget) => {
        const rect = widget.getBoundingClientRect();
        const expected =
          rect.right >= stageRect.right - 24 &&
          rect.bottom >= launcherRect.top - 16 &&
          rect.top <= launcherRect.bottom + 16;
        return {
          key: widget.dataset.workspaceWidget,
          expected,
          marked: widget.dataset.flowLauncherEdge === 'true',
        };
      }
    );
    return {
      mismatches: widgets.filter(({ expected, marked }) => expected !== marked),
      marked: widgets.filter(({ marked }) => marked).length,
      unmarked: widgets.filter(({ marked }) => !marked).length,
    };
  });
  expect(collisionContract.mismatches).toEqual([]);
  expect(collisionContract.marked).toBeGreaterThan(0);
  expect(collisionContract.unmarked).toBeGreaterThan(0);
});

test('200% text, dark mode, and forced colours preserve a one-column readable Home', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'chromium',
    'Theme, zoom, and forced-colour rendering run once in Chromium.'
  );
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.goto('/');
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });

  const flowHome = page.getByTestId('flow-home');
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.documentElement).fontSize))
    .toBe('32px');
  await expect(flowHome).toHaveAttribute('data-flow-large-text', 'true');
  const darkGrid = await flowHome
    .locator('[data-workspace-presentation]')
    .evaluate((grid) => window.getComputedStyle(grid).gridTemplateColumns.split(' ').length);
  expect(darkGrid).toBe(1);
  await expectNoHorizontalDocumentOverflow(page, flowHome);
  await expectNoInternalVerticalScroll(flowHome);
  await expectDwaionBottomAnchor(page);
  await expectSeriousAxeViolationsToBeEmpty(page, '[data-testid="flow-home"]');

  await page.emulateMedia({
    colorScheme: 'light',
    forcedColors: 'active',
    reducedMotion: 'reduce',
  });
  await page.reload();
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  await expect(flowHome).toHaveAttribute('data-flow-large-text', 'true');
  await expectNoHorizontalDocumentOverflow(page, flowHome);
  await expectNoInternalVerticalScroll(flowHome);
  const forcedColorContract = await flowHome.locator('[data-flow-workscape]').evaluate((node) => ({
    beforeDisplay: window.getComputedStyle(node, '::before').display,
    afterDisplay: window.getComputedStyle(node, '::after').display,
    borderColor: window.getComputedStyle(node).borderColor,
  }));
  expect(forcedColorContract.beforeDisplay).toBe('none');
  expect(forcedColorContract.afterDisplay).toBe('none');
  expect(forcedColorContract.borderColor).not.toBe('rgba(0, 0, 0, 0)');
  await expectDwaionBottomAnchor(page);
});

test('a requested Flow policy fails closed without the server-resolved variant', async ({
  page,
}) => {
  const experience = flowExperience();
  delete experience.effectiveExperienceVariant;
  await page.route('**/api/platform/v1/home-experience', (route) =>
    fulfillSuccess(route, experience)
  );
  await page.goto('/');

  await expect(page.getByTestId('flow-home')).toHaveCount(0);
  await expect(page.getByTestId('home-hero')).toBeVisible();
});

test('notification badges fail closed when a successful summary becomes stale', async ({
  page,
}) => {
  await page.route('**/api/notifications/v1/summary/by-app', (route) =>
    fulfillSuccess(route, {
      partial: false,
      unavailableSources: [],
      apps: [
        {
          appKey: 'approvals',
          totalUnread: 7,
          actionableUnread: 3,
          urgentUnread: 1,
          lastActivityAt: FLOW_FIXTURE_NOW.toISOString(),
        },
      ],
      changeVersion: '12',
      counterVersion: '12',
      generatedAt: FLOW_FIXTURE_NOW.toISOString(),
    })
  );
  await page.goto('/');

  const flowHome = page.getByTestId('flow-home');
  const freshUrgentBadge = flowHome.locator(
    '[data-badge-intent="urgent"]:visible, [data-hidden-notification-intent="urgent"]:visible'
  );
  await expect(freshUrgentBadge).toHaveCount(1);
  const freshUrgentCount = Number((await freshUrgentBadge.textContent())?.replace(/\D/gu, '') ?? 0);
  expect(freshUrgentCount).toBeGreaterThanOrEqual(1);

  await page.clock.setFixedTime(new Date(FLOW_FIXTURE_NOW.getTime() + 31_000));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(
    flowHome.locator('[data-badge-intent]:visible, [data-hidden-notification-intent]:visible')
  ).toHaveCount(0);
});

test('saved height and width choices round-trip through the existing legacy preference API', async ({
  page,
}) => {
  let serverPreference = {
    ...DEFAULT_HOME_PREFERENCE,
    customized: true,
    version: 3,
  };
  let savedBody: { layout: typeof DEFAULT_HOME_PREFERENCE.layout; version: number } | null = null;
  await page.route('**/api/platform/v1/home-preferences**', (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && path.endsWith('/home-preferences')) {
      return fulfillSuccess(route, serverPreference);
    }
    if (request.method() === 'PUT' && path.endsWith('/home-preferences')) {
      savedBody = request.postDataJSON() as typeof savedBody;
      serverPreference = {
        ...serverPreference,
        layout: savedBody!.layout,
        version: serverPreference.version + 1,
      };
      return fulfillSuccess(route, serverPreference);
    }
    return route.fallback();
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Edit home' }).click();

  const widget = page.locator('[data-workspace-widget="request-tracker"]');
  await widget.locator('[data-widget-footprint-trigger]').click();
  const picker = page.getByRole('dialog', { name: 'My requests widget size' });
  await picker.locator('[data-widget-footprint-option="full"]').click();
  await picker.locator('[data-widget-height-option="tall"]').click();
  await page.keyboard.press('Escape');
  await page
    .locator('[data-workspace-composer-placement="floating"]')
    .getByRole('button', { name: 'Save' })
    .click();

  await expect.poll(() => savedBody).not.toBeNull();
  expect(savedBody!.version).toBe(3);
  expect(savedBody!.layout.widgets.find((widget) => widget.widgetKey === 'focus')).toMatchObject({
    visible: true,
    size: 'full',
    height: 'tall',
  });

  await page.reload();
  await expect(widget).toHaveAttribute('data-workspace-widget-size', 'full');
  await expect(widget).toHaveAttribute('data-workspace-widget-height', 'tall');
});

test('VIEWS editing and save stay available when the inactive legacy store fails', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Store isolation is covered once on desktop.');
  let legacyRequests = 0;
  let saved = false;
  let view = defaultHomeView();
  await routeFlowExperience(page, {
    advancedPersonalizationEnabled: true,
    composerEnabled: true,
    homePreferenceStore: 'VIEWS',
  });
  await page.route('**/api/platform/v1/home-preferences**', async (route) => {
    legacyRequests += 1;
    await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
  });
  await page.route('**/api/platform/v1/home-views**', (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && path.endsWith('/home-view-default/device-layouts')) {
      return fulfillSuccess(route, []);
    }
    if (request.method() === 'GET' && path.endsWith('/home-views')) {
      return fulfillSuccess(route, [view]);
    }
    if (request.method() === 'PUT' && path.endsWith('/home-views/home-view-default')) {
      const payload = request.postDataJSON() as { layout: typeof view.layout };
      view = { ...view, layout: payload.layout, version: view.version + 1 };
      saved = true;
      return fulfillSuccess(route, view);
    }
    return route.fallback();
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  const experienceReady = page.waitForResponse(
    (response) =>
      response.url().includes('/api/platform/v1/home-experience') && response.status() === 200
  );
  const viewsReady = page.waitForResponse(
    (response) =>
      response.url().includes('/api/platform/v1/home-views') && response.status() === 200
  );
  await page.goto('/');
  await Promise.all([experienceReady, viewsReady]);
  await expect(page.getByRole('button', { name: 'Edit home' })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Home edit options' })).toBeVisible();
  await page.getByRole('button', { name: 'Home edit options' }).click();
  await expect(page.getByRole('menuitem', { name: /Arrange screen/ })).toBeVisible();
  await page.getByRole('menuitem', { name: /Home settings/ }).click();
  await expect(page.getByRole('dialog', { name: 'My work home' })).toBeVisible();
  await page.getByRole('button', { name: 'Close home studio' }).click();
  await page.getByRole('button', { name: 'Edit home' }).click();
  const widget = page.locator('[data-workspace-widget="request-tracker"]');
  await widget.locator('[data-widget-footprint-trigger]').click();
  await page
    .getByRole('dialog', { name: 'My requests widget size' })
    .locator('[data-widget-height-option="tall"]')
    .click();
  await page.keyboard.press('Escape');
  await page
    .locator('[data-workspace-composer-placement="floating"]')
    .getByRole('button', { name: 'Save' })
    .click();

  await expect.poll(() => saved).toBe(true);
  expect(legacyRequests).toBe(0);
});

test('LEGACY editing and save stay available when the inactive VIEWS store fails', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Store isolation is covered once on desktop.');
  let viewsRequests = 0;
  let saved = false;
  let preference = { ...DEFAULT_HOME_PREFERENCE, customized: true, version: 3 };
  await routeFlowExperience(page, {
    advancedPersonalizationEnabled: true,
    composerEnabled: true,
    homePreferenceStore: 'LEGACY',
  });
  await page.route('**/api/platform/v1/home-views**', async (route) => {
    viewsRequests += 1;
    await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
  });
  await page.route('**/api/platform/v1/home-preferences**', (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && path.endsWith('/home-preferences')) {
      return fulfillSuccess(route, preference);
    }
    if (request.method() === 'PUT' && path.endsWith('/home-preferences')) {
      const payload = request.postDataJSON() as { layout: typeof preference.layout };
      preference = { ...preference, layout: payload.layout, version: preference.version + 1 };
      saved = true;
      return fulfillSuccess(route, preference);
    }
    return route.fallback();
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Home Studio' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Edit home' }).click();
  const widget = page.locator('[data-workspace-widget="request-tracker"]');
  await widget.locator('[data-widget-footprint-trigger]').click();
  await page
    .getByRole('dialog', { name: 'My requests widget size' })
    .locator('[data-widget-height-option="tall"]')
    .click();
  await page.keyboard.press('Escape');
  await page
    .locator('[data-workspace-composer-placement="floating"]')
    .getByRole('button', { name: 'Save' })
    .click();

  await expect.poll(() => saved).toBe(true);
  expect(viewsRequests).toBe(0);
});

test('an unrelated LEGACY home edit preserves opaque app layout placements', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Opaque persistence is covered once on desktop.');
  const opaqueAppLayout = {
    version: 1 as const,
    groups: {
      work: ['future-top-level', 'folder-mixed', 'dwp-activity'],
      future_group: ['future-group-app', 'folder-future'],
    },
    folders: {
      'folder-mixed': {
        id: 'folder-mixed',
        name: 'Mixed tools',
        groupId: 'work',
        appIds: ['dwp-work', 'future-folder-app'],
      },
      'folder-future': {
        id: 'folder-future',
        name: 'Future tools',
        groupId: 'future_group',
        appIds: ['future-folder-a', 'future-folder-b'],
      },
    },
    hiddenAppIds: ['future-hidden-app'],
  };
  let savedAppLayout: unknown = null;
  let preference = {
    ...DEFAULT_HOME_PREFERENCE,
    customized: true,
    version: 4,
    layout: { ...DEFAULT_HOME_PREFERENCE.layout, appLayout: opaqueAppLayout },
  };
  await routeFlowExperience(page, {
    advancedPersonalizationEnabled: true,
    composerEnabled: true,
    homePreferenceStore: 'LEGACY',
  });
  await page.route('**/api/platform/v1/home-preferences**', (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && path.endsWith('/home-preferences')) {
      return fulfillSuccess(route, preference);
    }
    if (request.method() === 'PUT' && path.endsWith('/home-preferences')) {
      const payload = request.postDataJSON() as {
        layout: typeof preference.layout;
        version: number;
      };
      savedAppLayout = payload.layout.appLayout;
      preference = {
        ...preference,
        layout: payload.layout,
        version: preference.version + 1,
      };
      return fulfillSuccess(route, preference);
    }
    return route.fallback();
  });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Edit home' }).click();
  const widget = page.locator('[data-workspace-widget="request-tracker"]');
  await widget.locator('[data-widget-footprint-trigger]').click();
  await page
    .getByRole('dialog', { name: 'My requests widget size' })
    .locator('[data-widget-height-option="tall"]')
    .click();
  await page.keyboard.press('Escape');
  await page
    .locator('[data-workspace-composer-placement="floating"]')
    .getByRole('button', { name: 'Save' })
    .click();

  await expect.poll(() => savedAppLayout).not.toBeNull();
  expect(savedAppLayout).toEqual(opaqueAppLayout);
});

test('an entitlement granted during editing cannot delete its canonical app placement', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Live authority refresh is covered once.');
  const canonicalAppLayout = {
    version: 1 as const,
    groups: {
      work: ['dwp-work', 'dwp-approvals'],
      connect: [],
      services: [],
      systems: [],
    },
    folders: {},
    hiddenAppIds: [],
  };
  let granted = false;
  let permissionRequests = 0;
  let savedAppLayout: typeof canonicalAppLayout | null = null;
  let preference = {
    ...DEFAULT_HOME_PREFERENCE,
    customized: true,
    version: 3,
    layout: { ...DEFAULT_HOME_PREFERENCE.layout, appLayout: canonicalAppLayout },
  };
  await page.route('**/api/auth/permissions', (route) => {
    permissionRequests += 1;
    return fulfillSuccess(
      route,
      granted
        ? FLOW_PERMISSIONS
        : FLOW_PERMISSIONS.filter((permission) => permission.resourceKey !== 'APP.APPROVALS')
    );
  });
  await page.route('**/api/platform/v1/home-preferences**', (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && path.endsWith('/home-preferences')) {
      return fulfillSuccess(route, preference);
    }
    if (request.method() === 'PUT' && path.endsWith('/home-preferences')) {
      const payload = request.postDataJSON() as { layout: typeof preference.layout };
      savedAppLayout = payload.layout.appLayout;
      preference = { ...preference, layout: payload.layout, version: preference.version + 1 };
      return fulfillSuccess(route, preference);
    }
    return route.fallback();
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Open Approvals/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Edit home' }).click();

  granted = true;
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect.poll(() => permissionRequests).toBeGreaterThan(1);
  await expect(page.getByRole('button', { name: /Open Approvals/ })).toHaveCount(0);

  const widget = page.locator('[data-workspace-widget="request-tracker"]');
  await widget.locator('[data-widget-footprint-trigger]').click();
  await page
    .getByRole('dialog', { name: 'My requests widget size' })
    .locator('[data-widget-height-option="tall"]')
    .click();
  await page.keyboard.press('Escape');
  await page
    .locator('[data-workspace-composer-placement="floating"]')
    .getByRole('button', { name: 'Save' })
    .click();

  await expect.poll(() => savedAppLayout).not.toBeNull();
  expect(savedAppLayout!.groups.work).toContain('dwp-approvals');
});

test('an entitlement revoked during editing stays hidden without deleting its placement', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Live authority refresh is covered once.');
  const canonicalAppLayout = {
    version: 1 as const,
    groups: {
      work: ['dwp-work', 'dwp-approvals'],
      connect: [],
      services: [],
      systems: [],
    },
    folders: {},
    hiddenAppIds: [],
  };
  let revoked = false;
  let permissionRequests = 0;
  let savedAppLayout: typeof canonicalAppLayout | null = null;
  let preference = {
    ...DEFAULT_HOME_PREFERENCE,
    customized: true,
    version: 3,
    layout: { ...DEFAULT_HOME_PREFERENCE.layout, appLayout: canonicalAppLayout },
  };
  await page.route('**/api/auth/permissions', (route) => {
    permissionRequests += 1;
    return fulfillSuccess(
      route,
      revoked
        ? FLOW_PERMISSIONS.filter((permission) => permission.resourceKey !== 'APP.APPROVALS')
        : FLOW_PERMISSIONS
    );
  });
  await page.route('**/api/platform/v1/home-preferences**', (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && path.endsWith('/home-preferences')) {
      return fulfillSuccess(route, preference);
    }
    if (request.method() === 'PUT' && path.endsWith('/home-preferences')) {
      const payload = request.postDataJSON() as { layout: typeof preference.layout };
      savedAppLayout = payload.layout.appLayout;
      preference = { ...preference, layout: payload.layout, version: preference.version + 1 };
      return fulfillSuccess(route, preference);
    }
    return route.fallback();
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Open Approvals/ })).toBeVisible();
  await page.getByRole('button', { name: 'Edit home' }).click();

  revoked = true;
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect.poll(() => permissionRequests).toBeGreaterThan(1);
  await expect(page.getByRole('button', { name: /Open Approvals/ })).toHaveCount(0);

  const widget = page.locator('[data-workspace-widget="request-tracker"]');
  await widget.locator('[data-widget-footprint-trigger]').click();
  await page
    .getByRole('dialog', { name: 'My requests widget size' })
    .locator('[data-widget-height-option="tall"]')
    .click();
  await page.keyboard.press('Escape');
  await page
    .locator('[data-workspace-composer-placement="floating"]')
    .getByRole('button', { name: 'Save' })
    .click();

  await expect.poll(() => savedAppLayout).not.toBeNull();
  expect(savedAppLayout!.groups.work).toContain('dwp-approvals');
});

test('a multi-item request widget preserves its information hierarchy across height choices', async ({
  page,
}) => {
  const source = HR_SERVICE_REQUESTS_FIXTURE[0]!;
  const services = Array.from({ length: 4 }, (_, index) => ({
    ...source,
    requestId: `service-request-purpose-${index + 1}`,
    requestNumber: `SR-PURPOSE-${index + 1}`,
    summary: `Tracked request ${index + 1}`,
    status: 'IN_PROGRESS' as const,
    updatedAt: FLOW_FIXTURE_NOW.toISOString(),
    slaDueAt: new Date(FLOW_FIXTURE_NOW.getTime() + (index + 1) * 3_600_000).toISOString(),
  }));
  await routeEmptyExternalContributions(page, { services });
  await page.route('**/api/platform/v1/home/overview**', (route) =>
    fulfillSuccess(route, emptyHomeOverview())
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Edit home' }).click();

  const frame = page.locator('[data-workspace-widget="request-tracker"]');
  const section = purpose(page.getByTestId('flow-home'), 'request');
  await frame.locator('[data-widget-footprint-trigger]').click();
  const picker = page.getByRole('dialog', { name: 'My requests widget size' });
  for (const height of ['short', 'standard', 'tall'] as const) {
    await picker.locator(`[data-widget-height-option="${height}"]`).click();
    await expect(frame).toHaveAttribute('data-workspace-widget-height', height);
    await expect(section).toHaveAttribute('data-home-content-density', height);
    await expect(section.locator('[role="listitem"]')).toHaveCount(3);
    await expect(section.locator('[role="listitem"] h3')).toHaveText([
      'Tracked request 1',
      'Tracked request 2',
      'Tracked request 3',
    ]);
    // Widget content is intentionally inert while editing, so assert its
    // visible semantic copy through DOM structure instead of the a11y tree.
    await expect(section.locator('h2')).toHaveText('My requests');
    const sectionDescription = section.getByText(
      'The current stage of approvals and service requests you submitted.'
    );
    if (height === 'short') {
      await expect(sectionDescription).toBeHidden();
    } else {
      await expect(sectionDescription).toBeVisible();
    }
    const content = await frame.locator('[data-workspace-widget-content]').evaluate((node) => {
      const contentBounds = node.getBoundingClientRect();
      const rows = Array.from(node.querySelectorAll<HTMLElement>('[data-home-contribution]')).map(
        (row) => {
          const bounds = row.getBoundingClientRect();
          return {
            top: bounds.top,
            bottom: bounds.bottom,
            height: bounds.height,
            fullyVisible:
              bounds.top >= contentBounds.top - 1 && bounds.bottom <= contentBounds.bottom + 1,
          };
        }
      );
      return { clientHeight: node.clientHeight, scrollHeight: node.scrollHeight, rows };
    });
    expect(content.scrollHeight).toBeLessThanOrEqual(content.clientHeight + 1);
    expect(content.rows).toHaveLength(3);
    const rowsDoNotOverlap = content.rows.every(
      (row, index, rows) => index === rows.length - 1 || row.bottom <= rows[index + 1]!.top + 1
    );
    expect(
      content.rows.every((row) => row.fullyVisible && row.height >= 31) && rowsDoNotOverlap,
      `Rows must remain fully visible inside the ${height} editing footprint: ${JSON.stringify(
        content.rows
      )}`
    ).toBe(true);
  }
});
