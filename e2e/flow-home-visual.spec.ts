import { expect, test, type Locator, type Page } from '@playwright/test';

import {
  FULL_PRODUCT_PERMISSIONS,
  HOME_COMMUNICATIONS_FIXTURE,
  createHomeOverviewFixture,
  fulfillSuccess,
  mockShellSession,
} from './support/shell-session';
import { APPROVAL_HOME_FIXTURE, HR_HOME_FIXTURE } from './support/product-area-fixtures';

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
  experienceOverrides: Parameters<typeof flowExperience>[0] = {},
  visualOptions: Readonly<{
    colorScheme?: 'light' | 'dark';
    forcedColors?: 'active' | 'none';
  }> = {}
) {
  const colorScheme = visualOptions.colorScheme ?? 'light';
  await page.emulateMedia({
    reducedMotion: 'reduce',
    colorScheme,
    forcedColors: visualOptions.forcedColors ?? 'none',
  });
  await page.clock.setFixedTime(FLOW_VISUAL_NOW);
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    displayName: '김미나',
    jobTitle: '디지털 워크플레이스 담당자',
    permissions: FLOW_PERMISSIONS,
    appearance: {
      mode: colorScheme,
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
  await page.route('**/api/approvals/v1/home', (route) =>
    fulfillSuccess(route, { ...APPROVAL_HOME_FIXTURE, generatedAt: FLOW_VISUAL_NOW.toISOString() })
  );
  await page.route('**/api/people/v1/hr/home', (route) =>
    fulfillSuccess(route, { ...HR_HOME_FIXTURE, generatedAt: FLOW_VISUAL_NOW.toISOString() })
  );
  await page.route('**/api/platform/v1/services/requests', (route) => fulfillSuccess(route, []));
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

async function emulateReducedTransparency(page: Page, colorScheme: 'light' | 'dark') {
  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setEmulatedMedia', {
    media: '',
    features: [
      { name: 'prefers-color-scheme', value: colorScheme },
      { name: 'prefers-reduced-motion', value: 'reduce' },
      { name: 'prefers-reduced-transparency', value: 'reduce' },
    ],
  });
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

const WORKSCAPE_VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 320, height: 760 },
] as const;

const WORKSCAPE_POSITIONS = ['LEFT', 'CENTER', 'RIGHT'] as const;
const WORKSCAPE_SCHEMES = ['light', 'dark'] as const;
const WORKSCAPE_PHOTO = '/media/communications/workplace-improvement.jpg';

for (const viewport of WORKSCAPE_VIEWPORTS) {
  for (const backgroundPosition of WORKSCAPE_POSITIONS) {
    for (const colorScheme of WORKSCAPE_SCHEMES) {
      test(`Workscape matrix ${viewport.width} ${backgroundPosition} ${colorScheme}`, async ({
        page,
      }, testInfo) => {
        test.skip(testInfo.project.name !== 'chromium', 'The full matrix is captured in Chromium.');
        await page.setViewportSize(viewport);
        await mockFlowHome(
          page,
          viewport.width >= 1600 ? 'expressive' : 'balanced',
          {
            backgroundUrl: WORKSCAPE_PHOTO,
            backgroundPosition,
            overlayOpacity: 24,
          },
          { colorScheme }
        );

        await page.goto('/');
        const flowHome = page.getByTestId('flow-home');
        const workscape = flowHome.locator('[data-flow-workscape]');
        await expect(workscape).toHaveAttribute(
          'data-tenant-background-position',
          backgroundPosition.toLowerCase()
        );
        await expect(workscape).toHaveAttribute('data-tenant-image-opacity', '1');
        await expect(workscape.locator('[data-flow-health-strip]')).toHaveCount(0);
        await expectNoHorizontalOverflow(page);
        await waitForVisualState(page);

        const contract = await workscape.evaluate((surface) => {
          const frame = surface.querySelector<HTMLElement>('[data-flow-launch-deck-frame]')!;
          const copy = surface.querySelector<HTMLElement>('[data-flow-context-copy]')!;
          const dock = surface.querySelector<HTMLElement>('[data-flow-dock-shell]')!;
          const frameBounds = frame.getBoundingClientRect();
          const copyBounds = copy.getBoundingClientRect();
          const dockBounds = dock.getBoundingClientRect();
          const targets = Array.from(surface.querySelectorAll<HTMLElement>('button')).map(
            (target) => {
              const bounds = target.getBoundingClientRect();
              return { width: bounds.width, height: bounds.height };
            }
          );
          const appLabels = Array.from(
            surface.querySelectorAll<HTMLElement>(
              '[data-flow-dock-item] button .MuiTypography-root'
            )
          ).map((label) => ({
            text: label.textContent?.trim() ?? '',
            clipped: label.scrollWidth > label.clientWidth + 1,
          }));
          const appItemBounds = Array.from(
            surface.querySelectorAll<HTMLElement>('[data-flow-dock-item] button')
          ).map((item) => {
            const bounds = item.getBoundingClientRect();
            return {
              left: bounds.left,
              right: bounds.right,
              top: bounds.top,
              bottom: bounds.bottom,
            };
          });
          const groupLabels = Array.from(
            surface.querySelectorAll<HTMLElement>('[data-flow-dock-group] > .MuiTypography-root')
          )
            .filter((label) => window.getComputedStyle(label).display !== 'none')
            .map((label) => {
              const bounds = label.getBoundingClientRect();
              return {
                text: label.textContent?.trim() ?? '',
                clipped: label.scrollWidth > label.clientWidth + 1,
                bounds: {
                  left: bounds.left,
                  right: bounds.right,
                  top: bounds.top,
                  bottom: bounds.bottom,
                },
              };
            });
          const dockAction = surface
            .querySelector<HTMLElement>('[data-flow-dock-action]')!
            .getBoundingClientRect();
          return {
            frame: {
              left: frameBounds.left,
              right: frameBounds.right,
              width: frameBounds.width,
              center: frameBounds.left + frameBounds.width / 2,
            },
            copy: { left: copyBounds.left, right: copyBounds.right },
            dock: {
              left: dockBounds.left,
              right: dockBounds.right,
              width: dockBounds.width,
              center: dockBounds.left + dockBounds.width / 2,
              background: window.getComputedStyle(dock).backgroundColor,
              overflow: dock.scrollWidth - dock.clientWidth,
            },
            workscapeHeight: surface.getBoundingClientRect().height,
            targets,
            appLabels,
            appItemBounds,
            groupLabels,
            dockAction: {
              left: dockAction.left,
              right: dockAction.right,
              top: dockAction.top,
              bottom: dockAction.bottom,
            },
          };
        });

        expect(contract.dock.background).not.toBe('rgba(255, 255, 255, 0.94)');
        expect(contract.dock.background).not.toBe('rgba(0, 0, 0, 0)');
        expect(contract.dock.overflow).toBeLessThanOrEqual(1);
        expect(contract.targets.every((target) => target.width >= 44 && target.height >= 44)).toBe(
          true
        );
        expect(contract.appLabels.every((label) => label.text.length > 0 && !label.clipped)).toBe(
          true
        );
        expect(contract.groupLabels.every((label) => label.text.length > 0 && !label.clipped)).toBe(
          true
        );
        expect(
          contract.groupLabels.every(
            (label) =>
              label.bounds.right <= contract.dockAction.left ||
              label.bounds.left >= contract.dockAction.right ||
              label.bounds.bottom <= contract.dockAction.top ||
              label.bounds.top >= contract.dockAction.bottom
          )
        ).toBe(true);
        expect(
          contract.appItemBounds.every(
            (bounds) =>
              bounds.right <= contract.dockAction.left ||
              bounds.left >= contract.dockAction.right ||
              bounds.bottom <= contract.dockAction.top ||
              bounds.top >= contract.dockAction.bottom
          )
        ).toBe(true);
        expect(contract.workscapeHeight).toBeLessThanOrEqual(
          viewport.width >= 1200 ? 340 : viewport.width >= 900 ? 380 : 460
        );

        if (viewport.width >= 900 && backgroundPosition === 'RIGHT') {
          expect(Math.abs(contract.copy.left - contract.dock.left)).toBeLessThanOrEqual(2);
          expect(contract.frame.right - contract.dock.right).toBeGreaterThanOrEqual(
            contract.frame.width * 0.24
          );
        } else if (viewport.width >= 900 && backgroundPosition === 'LEFT') {
          expect(Math.abs(contract.copy.right - contract.dock.right)).toBeLessThanOrEqual(2);
          expect(contract.dock.left - contract.frame.left).toBeGreaterThanOrEqual(
            contract.frame.width * 0.24
          );
        } else if (viewport.width >= 900) {
          expect(Math.abs(contract.frame.center - contract.dock.center)).toBeLessThanOrEqual(2);
        } else {
          expect(Math.abs(contract.frame.width - contract.dock.width)).toBeLessThanOrEqual(2);
        }

        await expect(workscape).toHaveScreenshot(
          `flow-workscape-${viewport.width}-${backgroundPosition.toLowerCase()}-${colorScheme}.png`,
          {
            animations: 'disabled',
            caret: 'hide',
            scale: 'css',
            maxDiffPixelRatio: 0.001,
            timeout: 15_000,
          }
        );
      });
    }
  }
}

for (const viewport of WORKSCAPE_VIEWPORTS) {
  test(`Workscape forced colors ${viewport.width}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Forced colors are captured in Chromium.');
    await page.setViewportSize(viewport);
    await mockFlowHome(
      page,
      viewport.width >= 1600 ? 'expressive' : 'balanced',
      {
        backgroundUrl: WORKSCAPE_PHOTO,
        backgroundPosition: 'CENTER',
        overlayOpacity: 24,
      },
      { forcedColors: 'active' }
    );

    await page.goto('/');
    const workscape = page.getByTestId('flow-home').locator('[data-flow-workscape]');
    await waitForVisualState(page);
    const forcedContract = await workscape.evaluate((surface) => ({
      beforeDisplay: window.getComputedStyle(surface, '::before').display,
      afterDisplay: window.getComputedStyle(surface, '::after').display,
      dockBackground: window.getComputedStyle(
        surface.querySelector<HTMLElement>('[data-flow-dock-shell]')!
      ).backgroundColor,
    }));
    expect(forcedContract.beforeDisplay).toBe('none');
    expect(forcedContract.afterDisplay).toBe('none');
    expect(forcedContract.dockBackground).not.toBe('rgba(0, 0, 0, 0)');
    await expectNoHorizontalOverflow(page);
    await expect(workscape).toHaveScreenshot(`flow-workscape-${viewport.width}-forced-colors.png`, {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      maxDiffPixelRatio: 0.001,
      timeout: 15_000,
    });
  });
}

for (const viewport of [WORKSCAPE_VIEWPORTS[1], WORKSCAPE_VIEWPORTS[4]]) {
  for (const colorScheme of WORKSCAPE_SCHEMES) {
    test(`Workscape reduced transparency ${viewport.width} ${colorScheme}`, async ({
      page,
    }, testInfo) => {
      test.skip(
        testInfo.project.name !== 'chromium',
        'Reduced transparency is captured in Chromium.'
      );
      await page.setViewportSize(viewport);
      await mockFlowHome(
        page,
        'balanced',
        {
          backgroundUrl: WORKSCAPE_PHOTO,
          backgroundPosition: 'RIGHT',
          overlayOpacity: 24,
        },
        { colorScheme }
      );
      await emulateReducedTransparency(page, colorScheme);

      await page.goto('/');
      const workscape = page.getByTestId('flow-home').locator('[data-flow-workscape]');
      await waitForVisualState(page);
      const dockBackground = await workscape
        .locator('[data-flow-dock-shell]')
        .evaluate((dock) => window.getComputedStyle(dock).backgroundColor);
      expect(dockBackground).toBe(colorScheme === 'dark' ? 'rgb(7, 20, 38)' : 'rgb(16, 40, 77)');
      await expectNoHorizontalOverflow(page);
      await expect(workscape).toHaveScreenshot(
        `flow-workscape-${viewport.width}-reduced-transparency-${colorScheme}.png`,
        {
          animations: 'disabled',
          caret: 'hide',
          scale: 'css',
          maxDiffPixelRatio: 0.001,
          timeout: 15_000,
        }
      );
    });
  }
}

for (const viewport of [WORKSCAPE_VIEWPORTS[2], WORKSCAPE_VIEWPORTS[3]]) {
  for (const mode of ['dark', 'forced-colors'] as const) {
    test(`Flow Home full-page intermediate ${viewport.width} ${mode}`, async ({
      page,
    }, testInfo) => {
      test.skip(
        testInfo.project.name !== 'chromium',
        'Intermediate full-page accessibility coverage is captured in Chromium.'
      );
      await page.setViewportSize(viewport);
      await mockFlowHome(
        page,
        'balanced',
        {
          backgroundUrl: WORKSCAPE_PHOTO,
          backgroundPosition: 'RIGHT',
          overlayOpacity: 24,
        },
        mode === 'dark' ? { colorScheme: 'dark' } : { forcedColors: 'active' }
      );

      await page.goto('/');
      const flowHome = page.getByTestId('flow-home');
      await expect(flowHome).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await waitForVisualState(page);
      await expectDwaionClearOfHomeActions(page);
      await expect(page).toHaveScreenshot(
        `flow-home-purpose-${viewport.width}-${mode}-full-page.png`,
        {
          animations: 'disabled',
          caret: 'hide',
          fullPage: true,
          scale: 'css',
          maxDiffPixelRatio: 0.001,
          timeout: 15_000,
        }
      );
    });
  }
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
  expect(workscapeHeight).toBeLessThanOrEqual(340);
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
  expect(workscapeHeight).toBeLessThanOrEqual(340);
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
  expect(contract.workscapeHeight).toBeLessThanOrEqual(340);
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
