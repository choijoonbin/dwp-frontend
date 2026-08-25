import { expect, test, type Locator, type Page } from '@playwright/test';

import {
  FULL_PRODUCT_PERMISSIONS,
  HOME_COMMUNICATIONS_FIXTURE,
  createHomeOverviewFixture,
  fulfillSuccess,
  mockShellSession,
} from './support/shell-session';

test.describe.configure({ mode: 'serial' });

const FLOW_VISUAL_NOW = new Date('2026-08-11T00:30:00.000Z');

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

const canonicalWidgets = [
  { widgetKey: 'command-rail', visible: true, size: 'large', height: 'standard' },
  { widgetKey: 'schedule', visible: true, size: 'compact', height: 'standard' },
  { widgetKey: 'daily-brief', visible: true, size: 'compact', height: 'standard' },
  { widgetKey: 'focus', visible: true, size: 'compact', height: 'standard' },
  { widgetKey: 'activity', visible: true, size: 'compact', height: 'standard' },
] as const;

function flowExperience(
  overrides: Partial<{
    backgroundPosition: 'LEFT' | 'CENTER' | 'RIGHT';
    overlayOpacity: number;
    backgroundUrl: string | null;
  }> = {}
) {
  return {
    headline: null,
    subheadline: null,
    localizedContent: {},
    defaultLocale: 'ko',
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

function flowOverview() {
  const overview = createHomeOverviewFixture(['WORKSPACE_MEMBER']);
  const generatedAt = FLOW_VISUAL_NOW.toISOString();
  return {
    ...overview,
    work: { ...overview.work, generatedAt, data: { ...overview.work.data, generatedAt } },
    calendar: {
      ...overview.calendar,
      generatedAt,
      data: { ...overview.calendar.data, generatedAt },
    },
    communications: {
      status: 'AVAILABLE' as const,
      source: 'DWP_COMMUNICATIONS',
      generatedAt,
      data: { ...HOME_COMMUNICATIONS_FIXTURE, generatedAt },
      reason: null,
    },
    activity: {
      ...overview.activity,
      generatedAt,
      data: { ...overview.activity.data, generatedAt },
    },
    recommendationSection: { ...overview.recommendationSection, generatedAt },
    generatedAt,
  };
}

async function mockFlowHome(
  page: Page,
  presentation: 'focused' | 'balanced' | 'expressive',
  experienceOverrides: Parameters<typeof flowExperience>[0] = {}
) {
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' });
  await page.clock.setFixedTime(FLOW_VISUAL_NOW);
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    displayName: '김미나',
    jobTitle: '디지털 워크플레이스 담당자',
    permissions: FLOW_PERMISSIONS,
    appearance: {
      mode: 'light',
      density: 'standard',
      highContrast: false,
      reduceMotion: true,
    },
  });
  await page.route('**/api/platform/v1/home-experience', (route) =>
    fulfillSuccess(route, flowExperience(experienceOverrides))
  );
  await page.route('**/api/platform/v1/home/overview**', (route) =>
    fulfillSuccess(route, flowOverview())
  );
  await page.route('**/api/platform/v1/home-preferences**', (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() !== 'GET' || !path.endsWith('/home-preferences')) {
      return route.fallback();
    }
    return fulfillSuccess(route, {
      schemaVersion: 5,
      surfaceKey: 'workspace-home',
      customized: presentation === 'expressive',
      layout: {
        appLayout: null,
        presentation,
        widgets: canonicalWidgets,
      },
      version: 3,
    });
  });
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
          lastActivityAt: FLOW_VISUAL_NOW.toISOString(),
        },
        {
          appKey: 'messaging',
          totalUnread: 4,
          actionableUnread: 1,
          urgentUnread: 0,
          lastActivityAt: FLOW_VISUAL_NOW.toISOString(),
        },
      ],
      changeVersion: '11',
      counterVersion: '11',
      generatedAt: FLOW_VISUAL_NOW.toISOString(),
    })
  );
}

async function waitForVisualState(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      Array.from(document.images).map(async (image) => {
        if (!image.complete) {
          await new Promise<void>((resolve) => {
            image.addEventListener('load', () => resolve(), { once: true });
            image.addEventListener('error', () => resolve(), { once: true });
          });
        }
        await image.decode().catch(() => undefined);
      })
    );
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
    (document.activeElement as HTMLElement | null)?.blur();
    window.scrollTo(0, 0);
  });

  const launcher = page.getByTestId('dwaion-launcher');
  await expect(launcher).toBeVisible();
  await expect
    .poll(
      async () => {
        const first = await launcher.boundingBox();
        await page.waitForTimeout(100);
        const second = await launcher.boundingBox();
        return JSON.stringify(first) === JSON.stringify(second);
      },
      { timeout: 5_000, message: 'DWAI launcher fixed position should settle before capture' }
    )
    .toBe(true);
  const [bounds, viewport] = await Promise.all([launcher.boundingBox(), page.viewportSize()]);
  expect(bounds).not.toBeNull();
  expect(viewport).not.toBeNull();
  if (!bounds || !viewport) return;
  const compact = viewport.width < 600;
  const expectedInset = compact ? 16 : 24;
  const expectedSize = compact ? 48 : 56;
  expect(bounds.width).toBeCloseTo(expectedSize, 0);
  expect(bounds.height).toBeCloseTo(expectedSize, 0);
  expect(viewport.width - bounds.x - bounds.width).toBeCloseTo(expectedInset, 0);
  expect(viewport.height - bounds.y - bounds.height).toBeCloseTo(expectedInset, 0);
  await expect(launcher).toHaveCSS('position', 'fixed');
}

async function expectDwaionClearOfHomeActions(page: Page) {
  const scrollRange = await page.evaluate(
    () => document.documentElement.scrollHeight - window.innerHeight
  );
  const scrollPositions = [...new Set([0, 0.33, 0.66, 1].map((ratio) => scrollRange * ratio))];

  for (const top of scrollPositions) {
    await page.evaluate(async (scrollTop) => {
      window.scrollTo(0, scrollTop);
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
    }, top);
    const geometry = await page.evaluate(() => {
      const launcher = document.querySelector<HTMLElement>('[data-testid="dwaion-launcher"]');
      if (!launcher) return { launcher: null, collisions: ['launcher missing'] };
      const launcherRect = launcher.getBoundingClientRect();
      const clearance = 8;
      const collisions = Array.from(
        document.querySelectorAll<HTMLElement>('#dwp-main-content a, #dwp-main-content button')
      )
        .filter((element) => {
          const style = window.getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return (
            style.visibility !== 'hidden' &&
            style.display !== 'none' &&
            rect.width > 0 &&
            rect.height > 0 &&
            rect.bottom > 0 &&
            rect.top < window.innerHeight
          );
        })
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          return !(
            rect.right <= launcherRect.left - clearance ||
            rect.left >= launcherRect.right + clearance ||
            rect.bottom <= launcherRect.top - clearance ||
            rect.top >= launcherRect.bottom + clearance
          );
        })
        .map(
          (element) =>
            element.getAttribute('aria-label') ||
            element.getAttribute('data-home-contribution') ||
            element.textContent?.trim().slice(0, 60) ||
            element.tagName
        );
      return {
        launcher: {
          left: launcherRect.left,
          right: launcherRect.right,
          top: launcherRect.top,
          bottom: launcherRect.bottom,
        },
        collisions,
      };
    });
    expect(geometry.launcher).not.toBeNull();
    expect(geometry.collisions, `DWAI collision at scrollTop ${Math.round(top)}`).toEqual([]);
  }

  await page.evaluate(() => window.scrollTo(0, 0));
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
      )
    )
    .toBe(true);
}

async function expectDesktopPurposeComposition(flowHome: Locator) {
  const stage = flowHome.getByTestId('flow-home-personal-sections');
  await expect(stage).toHaveAttribute('data-flow-layout-contract', 'purpose-widgets');
  await expect(stage.locator('[data-workspace-widget="action-queue"]')).toHaveAttribute(
    'data-workspace-widget-size',
    'large'
  );
  for (const key of ['today', 'response-hub', 'request-tracker', 'role-pulse']) {
    await expect(stage.locator(`[data-workspace-widget="${key}"]`)).toHaveAttribute(
      'data-workspace-widget-size',
      'compact'
    );
  }

  const geometry = await stage.evaluate((root) => {
    const rect = (key: string) => {
      const node = root.querySelector<HTMLElement>(`[data-workspace-widget="${key}"]`)!;
      const bounds = node.getBoundingClientRect();
      return {
        left: bounds.left,
        right: bounds.right,
        top: bounds.top,
        bottom: bounds.bottom,
        width: bounds.width,
      };
    };
    return {
      action: rect('action-queue'),
      today: rect('today'),
      response: rect('response-hub'),
      request: rect('request-tracker'),
      pulse: rect('role-pulse'),
    };
  });
  expect(Math.abs(geometry.action.top - geometry.today.top)).toBeLessThanOrEqual(2);
  expect(Math.abs(geometry.action.bottom - geometry.today.bottom)).toBeLessThanOrEqual(2);
  expect(geometry.action.width / geometry.today.width).toBeGreaterThan(1.9);
  expect(Math.abs(geometry.response.top - geometry.request.top)).toBeLessThanOrEqual(2);
  expect(Math.abs(geometry.request.top - geometry.pulse.top)).toBeLessThanOrEqual(2);
  expect(Math.abs(geometry.response.bottom - geometry.request.bottom)).toBeLessThanOrEqual(2);
  expect(Math.abs(geometry.request.bottom - geometry.pulse.bottom)).toBeLessThanOrEqual(2);
  expect(Math.abs(geometry.response.width - geometry.request.width)).toBeLessThanOrEqual(2);
  expect(Math.abs(geometry.request.width - geometry.pulse.width)).toBeLessThanOrEqual(2);
}

test('Flow Home purpose-led Korean desktop 1440 visual baseline', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Desktop baseline uses the Chromium project.');
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockFlowHome(page, 'balanced');

  await page.goto('/');
  const flowHome = page.getByTestId('flow-home');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
  await expect(flowHome).toHaveAttribute('data-flow-home-presentation', 'balanced');
  await expect(flowHome.locator('[data-flow-section^="purpose-"]')).toHaveCount(5);
  await expectDesktopPurposeComposition(flowHome);
  const workscapeHeight =
    (await flowHome.locator('[data-flow-workscape]').boundingBox())?.height ??
    Number.POSITIVE_INFINITY;
  expect(workscapeHeight).toBeLessThanOrEqual(280);
  await expectNoHorizontalOverflow(page);
  await waitForVisualState(page);
  await expectDwaionClearOfHomeActions(page);

  await expect(page).toHaveScreenshot('flow-home-purpose-balanced-ko-1440.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
    scale: 'css',
    maxDiffPixelRatio: 0.001,
    timeout: 15_000,
  });
});

test('Flow Home focused Korean desktop 1440 visual baseline', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Desktop baseline uses the Chromium project.');
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockFlowHome(page, 'focused');

  await page.goto('/');
  const flowHome = page.getByTestId('flow-home');
  await expect(flowHome).toHaveAttribute('data-flow-home-presentation', 'focused');
  await expectDesktopPurposeComposition(flowHome);
  const frame = await flowHome.boundingBox();
  expect(frame?.width ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(1281);
  expect(frame?.x ?? 0).toBeGreaterThanOrEqual(79);
  await expectNoHorizontalOverflow(page);
  await waitForVisualState(page);
  await expectDwaionClearOfHomeActions(page);

  await expect(page).toHaveScreenshot('flow-home-purpose-focused-ko-1440.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
    scale: 'css',
    maxDiffPixelRatio: 0.001,
    timeout: 15_000,
  });
});

test('Flow Home expressive Korean desktop 1440 visual baseline', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Desktop baseline uses the Chromium project.');
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockFlowHome(page, 'expressive');

  await page.goto('/');
  const flowHome = page.getByTestId('flow-home');
  await expect(flowHome).toHaveAttribute('data-flow-home-presentation', 'expressive');
  await expect(flowHome.locator('[data-flow-dock-shell]')).toHaveAttribute(
    'data-flow-dock-item-limit',
    '10'
  );
  await expectDesktopPurposeComposition(flowHome);
  const workscape = await flowHome.locator('[data-flow-workscape]').boundingBox();
  expect(workscape?.x ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(21);
  await expectNoHorizontalOverflow(page);
  await waitForVisualState(page);
  await expectDwaionClearOfHomeActions(page);

  await expect(page).toHaveScreenshot('flow-home-purpose-expressive-ko-1440.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
    scale: 'css',
    maxDiffPixelRatio: 0.001,
    timeout: 15_000,
  });
});

test('Flow Home expressive Korean desktop 1920 visual baseline', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Desktop baseline uses the Chromium project.');
  await page.setViewportSize({ width: 1920, height: 1080 });
  await mockFlowHome(page, 'expressive');

  await page.goto('/');
  const flowHome = page.getByTestId('flow-home');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
  await expect(flowHome).toHaveAttribute('data-flow-home-presentation', 'expressive');
  await expect(flowHome.locator('[data-flow-dock-shell]')).toHaveAttribute(
    'data-flow-dock-item-limit',
    '12'
  );
  await expectDesktopPurposeComposition(flowHome);
  const priorityLayout = flowHome.locator(
    '[data-workspace-widget="action-queue"] [data-home-purpose-list="featured-queue"]'
  );
  await expect(priorityLayout).toBeVisible();
  expect(
    await priorityLayout.evaluate(
      (list) => window.getComputedStyle(list).gridTemplateColumns.split(' ').length
    )
  ).toBe(2);
  const workscapeHeight =
    (await flowHome.locator('[data-flow-workscape]').boundingBox())?.height ??
    Number.POSITIVE_INFINITY;
  expect(workscapeHeight).toBeLessThanOrEqual(280);
  await expectNoHorizontalOverflow(page);
  await waitForVisualState(page);
  await expectDwaionClearOfHomeActions(page);

  await expect(page).toHaveScreenshot('flow-home-purpose-expressive-ko-1920.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
    scale: 'css',
    maxDiffPixelRatio: 0.001,
    timeout: 15_000,
  });
});

test('Flow Home tenant photo keeps brand colour and a readable launch deck', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Desktop baseline uses the Chromium project.');
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockFlowHome(page, 'balanced', {
    backgroundUrl: '/media/communications/workplace-improvement.jpg',
    backgroundPosition: 'RIGHT',
    overlayOpacity: 24,
  });

  await page.goto('/');
  const workscape = page.getByTestId('flow-home').locator('[data-flow-workscape]');
  await expect(workscape).toHaveAttribute('data-tenant-image-opacity', '1');
  const contract = await workscape.evaluate((surface) => {
    const dock = surface.querySelector<HTMLElement>('[data-flow-dock-shell]')!;
    return {
      imageOpacity: window.getComputedStyle(surface, '::before').opacity,
      workscapeHeight: surface.getBoundingClientRect().height,
      dockBackground: window.getComputedStyle(dock).backgroundColor,
    };
  });
  expect(contract.imageOpacity).toBe('1');
  expect(contract.workscapeHeight).toBeLessThanOrEqual(280);
  expect(contract.dockBackground).not.toBe('rgba(0, 0, 0, 0)');
  await expectNoHorizontalOverflow(page);
  await waitForVisualState(page);
  await expectDwaionClearOfHomeActions(page);

  await expect(workscape).toHaveScreenshot('flow-home-purpose-tenant-photo-workscape-ko-1440.png', {
    animations: 'disabled',
    caret: 'hide',
    scale: 'css',
    maxDiffPixelRatio: 0.001,
    timeout: 15_000,
  });
});

test('Flow Home purpose-led Korean mobile 390 visual baseline', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Mobile baseline uses the mobile project.');
  await page.setViewportSize({ width: 390, height: 844 });
  await mockFlowHome(page, 'balanced');

  await page.goto('/');
  const flowHome = page.getByTestId('flow-home');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
  await expect(flowHome).toHaveAttribute('data-flow-home-presentation', 'balanced');
  await expect(flowHome.locator('[data-flow-section^="purpose-"]')).toHaveCount(5);
  await expect(flowHome.locator('[data-flow-dock-item]')).toHaveCount(4);
  const columns = await flowHome
    .locator('[data-workspace-presentation]')
    .evaluate((grid) => window.getComputedStyle(grid).gridTemplateColumns.split(' ').length);
  expect(columns).toBe(1);
  await expectNoHorizontalOverflow(page);
  await waitForVisualState(page);
  await expectDwaionClearOfHomeActions(page);

  await expect(page).toHaveScreenshot('flow-home-purpose-balanced-ko-390.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
    scale: 'css',
    maxDiffPixelRatio: 0.001,
    timeout: 15_000,
  });
});
