import { expect, test } from '@playwright/test';

import {
  captureConsoleMessages,
  expectMinimumTouchTargets,
  expectNoSeriousAccessibilityViolations,
} from './support/accessibility';
import {
  CANONICAL_HOME_APP_IDS_BY_GROUP,
  routeCanonicalHomeWorkspaceApps,
} from './support/home-launchpad-contract-fixture';
import {
  HOME_WAVE2_FIXED_NOW,
  remockHomeWave2ClassicSession,
  routeHomeWave2Flow,
  routeHomeWave2HealthyFlowContributions,
  routeHomeWave2NewsOverview,
  routeHomeWave2WidgetCatalog,
} from './support/home-wave2-acceptance-fixtures';
import { FULL_PRODUCT_PERMISSIONS, mockShellSession } from './support/shell-session';
import { routeHomeWave4ShadowRuntime } from './support/home-wave4-runtime-fixtures';

import type { Locator, Page } from '@playwright/test';

const FIXED_NOW = HOME_WAVE2_FIXED_NOW;
test.setTimeout(120_000);

const CLASSIC_MOBILE_NAVIGATION = [
  { label: '개요', route: '/' },
  { label: '좌석', route: '/workplace/explore?type=DESK' },
  { label: '회의실', route: '/workplace/rooms' },
  { label: '구성원', route: '/hr' },
  { label: '업무 현황', route: '/activity' },
] as const;

const FLOW_MOBILE_NAVIGATION = [
  { label: '오늘', route: '/' },
  { label: '일정', route: '/calendar' },
  { label: '스페이스', route: '/spaces' },
  { label: '할 일', route: '/work' },
  { label: '업무 현황', route: '/activity' },
] as const;

const CLASSIC_KO_APP_LABELS = [
  '업무',
  'DWAI·ON 워크스페이스',
  '활동',
  '전자결재',
  '알림 센터',
  '소식',
  '캘린더',
  '메일',
  'Space',
  '근무 공간',
  '메신저',
  '화상회의',
  '서비스 센터',
  '인사',
  '지식',
  '비즈니스 ERP',
  '레거시 업무',
  '관리',
] as const;

async function stabilizeVisual(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.evaluate(async () => {
    document.querySelectorAll('vite-plugin-checker-error-overlay').forEach((node) => node.remove());
    const auxiliaryStyle = document.createElement('style');
    auxiliaryStyle.dataset.wave2VisualStability = 'true';
    auxiliaryStyle.textContent =
      '[data-testid="dwaion-launcher"] { visibility: hidden !important; }';
    document.head.append(auxiliaryStyle);
    const auxiliaryLauncher = document.querySelector<HTMLElement>(
      '[data-testid="dwaion-launcher"]'
    );
    if (auxiliaryLauncher) auxiliaryLauncher.style.visibility = 'hidden';
    await document.fonts.ready;
    await Promise.all(
      Array.from(document.images).map(
        (image) =>
          image.complete ||
          new Promise<void>((resolve) => {
            image.addEventListener('load', () => resolve(), { once: true });
            image.addEventListener('error', () => resolve(), { once: true });
          })
      )
    );
  });
}

async function expectNoDocumentOrNestedScroll(root: Locator) {
  const geometry = await root.evaluate((node) => {
    const viewportWidth = document.documentElement.clientWidth;
    const rootBounds = node.getBoundingClientRect();
    const nestedScrollOwners = Array.from(
      node.querySelectorAll<HTMLElement>(
        '[data-workspace-widget-content], [data-launchpad-group-target], [data-flow-section]'
      )
    )
      .filter((element) => {
        const style = getComputedStyle(element);
        return (
          (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
          element.scrollHeight > element.clientHeight + 1
        );
      })
      .map(
        (element) =>
          element.getAttribute('data-workspace-widget') ??
          element.getAttribute('data-launchpad-group-target') ??
          element.getAttribute('data-flow-section') ??
          element.tagName
      );
    return {
      viewportWidth,
      documentWidth: document.documentElement.scrollWidth,
      rootLeft: rootBounds.left,
      rootRight: rootBounds.right,
      nestedScrollOwners,
    };
  });
  expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth + 1);
  expect(geometry.rootLeft).toBeGreaterThanOrEqual(-1);
  expect(geometry.rootRight).toBeLessThanOrEqual(geometry.viewportWidth + 1);
  expect(geometry.nestedScrollOwners).toEqual([]);
}

async function expectCanonicalClassicLaunchpad(root: Locator) {
  const actual = await root.locator('[data-launchpad-group-target]').evaluateAll((groups) =>
    groups.map((group) => ({
      groupKey: group.getAttribute('data-launchpad-group-target'),
      appIds: Array.from(group.querySelectorAll<HTMLElement>('[data-launchpad-item]')).map(
        (item) => item.dataset.launchpadItem
      ),
    }))
  );
  expect(actual).toEqual(CANONICAL_HOME_APP_IDS_BY_GROUP);
  expect(actual.flatMap((group) => group.appIds)).toHaveLength(18);

  const clippedItems = await root.locator('[data-launchpad-group-target]').evaluateAll((groups) =>
    groups.flatMap((group) => {
      const groupBounds = group.getBoundingClientRect();
      return Array.from(group.querySelectorAll<HTMLElement>('[data-launchpad-item]'))
        .filter((item) => {
          const bounds = item.getBoundingClientRect();
          return bounds.top < groupBounds.top - 1 || bounds.bottom > groupBounds.bottom + 1;
        })
        .map((item) => item.dataset.launchpadItem);
    })
  );
  expect(clippedItems).toEqual([]);
}

async function expectNoLaunchpadLabelClipping(root: Locator) {
  const clippedLabels = await root.locator('[data-launchpad-item-label]').evaluateAll((labels) =>
    labels
      .filter(
        (label) =>
          label.scrollWidth > label.clientWidth + 1 || label.scrollHeight > label.clientHeight + 1
      )
      .map((label) => ({
        label: label.textContent?.replace(/\s+/gu, ' ').trim(),
        clientWidth: label.clientWidth,
        scrollWidth: label.scrollWidth,
        clientHeight: label.clientHeight,
        scrollHeight: label.scrollHeight,
        fontSize: getComputedStyle(label).fontSize,
      }))
  );
  expect(clippedLabels).toEqual([]);
}

async function expectCanonicalFlowLaunchpad(root: Locator) {
  const actual = await root.locator('[data-flow-dock-group]').evaluateAll((groups) =>
    groups.map((group) => ({
      groupKey: group.getAttribute('data-flow-dock-group'),
      appIds: Array.from(group.querySelectorAll<HTMLElement>('[data-flow-dock-item]')).map(
        (item) => item.dataset.flowDockItem
      ),
    }))
  );
  expect(actual).toEqual(CANONICAL_HOME_APP_IDS_BY_GROUP);
  expect(actual.flatMap((group) => group.appIds)).toHaveLength(18);
}

async function expectMobileNavigation(
  navigation: Locator,
  expected: readonly { label: string; route: string }[],
  mode: 'CLASSIC' | 'FLOW_V1' | 'MZ_V1'
) {
  const actual = await navigation.locator('a').evaluateAll((items) =>
    items.map((item) => {
      const url = new URL((item as HTMLAnchorElement).href);
      return {
        label: item.textContent?.replace(/\s+/gu, ' ').trim(),
        route: `${url.pathname}${url.search}`,
        mode: item.getAttribute('data-home-mobile-navigation-mode'),
      };
    })
  );
  expect(actual).toEqual(expected.map((item) => ({ ...item, mode })));
}

async function expectSingleVisibleGlobalSearchTrigger(page: Page) {
  const searchSurface = page.locator('[data-shell-global-action="search"]');
  await expect(searchSurface).toBeVisible();
  await expect(searchSurface.getByRole('button')).toHaveCount(1);
}

async function expectFlowWideComposition(root: Locator) {
  const stage = root.getByTestId('flow-home-personal-sections');
  await expect(stage).toHaveAttribute('data-flow-read-template', 'adaptive-wide');
  await expect(stage).toHaveAttribute('data-flow-wide-composition', '38-34-28');
  const geometry = await stage.evaluate((node) => {
    const presentation = node.querySelector<HTMLElement>('[data-workspace-presentation]');
    const itemWidth = (key: string) =>
      node.querySelector<HTMLElement>(`[data-workspace-widget="${key}"]`)?.getBoundingClientRect()
        .width ?? 0;
    const width = presentation?.getBoundingClientRect().width ?? 0;
    return {
      computedColumns: presentation
        ? getComputedStyle(presentation).gridTemplateColumns.split(' ').length
        : 0,
      ratios: [
        itemWidth('action-queue') / width,
        itemWidth('today') / width,
        itemWidth('response-hub') / width,
      ],
    };
  });
  expect(geometry.computedColumns).toBe(100);
  expect(geometry.ratios[0]).toBeCloseTo(0.38, 1);
  expect(geometry.ratios[1]).toBeCloseTo(0.34, 1);
  expect(geometry.ratios[2]).toBeCloseTo(0.28, 1);
}

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Wave 2 canonical evidence uses Chromium.');
  await page.clock.setFixedTime(FIXED_NOW);
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' });
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
  await routeHomeWave2NewsOverview(page);
  await routeCanonicalHomeWorkspaceApps(page);
  await routeHomeWave2HealthyFlowContributions(page);
  await routeHomeWave2WidgetCatalog(page);
  await routeHomeWave4ShadowRuntime(page);
});

test('Classic compositions preserve the 18-app contract and document scroll at every edge', async ({
  page,
}) => {
  const cases = [
    {
      id: 'C01-D1440-BASE',
      fixtureId: 'WAVE2_C01-D1440-BASE',
      width: 1440,
      height: 900,
      widthClass: 'desktop-standard',
    },
    {
      id: 'C02-D1280-BASE',
      fixtureId: 'WAVE2_C02-D1280-BASE',
      width: 1280,
      height: 900,
      widthClass: 'desktop-standard',
    },
    {
      id: 'C03-M390-BASE',
      fixtureId: 'WAVE2_C03-M390-BASE',
      width: 390,
      height: 844,
      widthClass: 'mobile-standard',
    },
    {
      id: 'C04-M320-BASE',
      fixtureId: 'WAVE2_C04-M320-BASE',
      width: 320,
      height: 720,
      widthClass: 'mobile-compact',
    },
  ] as const;

  for (const item of cases) {
    test.info().annotations.push({ type: 'canonical-fixture', description: item.fixtureId });
    await page.setViewportSize({ width: item.width, height: item.height });
    await page.goto('/');
    const root = page.getByTestId('classic-home');
    await expect(root).toBeVisible();
    await expectSingleVisibleGlobalSearchTrigger(page);
    await expect(root).toHaveAttribute('data-home-ia', 'organization-portal');
    await expect(root).toHaveAttribute('data-home-scroll-contract', 'single-document');
    const main = page.getByTestId('personal-home-main');
    await expect(page.getByTestId('home-sidebar')).toHaveCount(0);
    if (item.width > 600) {
      await expect(page.getByTestId('personal-home-shell')).toHaveAttribute(
        'data-home-navigation-pattern',
        'drawer'
      );
      await expect
        .poll(async () => Math.round((await main.boundingBox())?.width ?? 0))
        .toBe(item.width);
      await expect(page.getByTestId('home-mobile-navigation-trigger')).toBeVisible();
      await expect(page.getByTestId('home-mobile-bottom-navigation')).toHaveCount(0);
    } else {
      await expect(page.getByTestId('personal-home-shell')).toHaveAttribute(
        'data-home-navigation-pattern',
        'bottom'
      );
      const mobileNavigation = page.getByTestId('home-mobile-bottom-navigation');
      await expect(mobileNavigation).toBeVisible();
      const mobileTargets = mobileNavigation.locator('a');
      await expect(mobileTargets).toHaveCount(5);
      await expectMobileNavigation(mobileNavigation, CLASSIC_MOBILE_NAVIGATION, 'CLASSIC');
      const targetSizes = await mobileTargets.evaluateAll((targets) =>
        targets.map((target) => {
          const bounds = target.getBoundingClientRect();
          return { width: bounds.width, height: bounds.height };
        })
      );
      expect(targetSizes.every(({ width, height }) => width >= 44 && height >= 44)).toBe(true);

      const lastFooterLink = page.locator('footer a:visible').last();
      await lastFooterLink.scrollIntoViewIfNeeded();
      await lastFooterLink.focus();
      await expect(lastFooterLink).toBeFocused();
      const focusGeometry = await lastFooterLink.evaluate((link) => {
        const navigation = document.querySelector<HTMLElement>(
          '[data-testid="home-mobile-bottom-navigation"]'
        );
        return {
          focusBottom: link.getBoundingClientRect().bottom,
          navigationTop: navigation?.getBoundingClientRect().top ?? 0,
        };
      });
      expect(focusGeometry.focusBottom).toBeLessThanOrEqual(focusGeometry.navigationTop + 1);
      await page.evaluate(() => window.scrollTo(0, 0));
    }
    await expect(page.locator('[data-home-available-width-class]')).toHaveAttribute(
      'data-home-available-width-class',
      item.widthClass
    );
    await expect(root.locator('[data-classic-primary-action]')).toBeVisible();
    await expectCanonicalClassicLaunchpad(root);
    await expectNoLaunchpadLabelClipping(root);
    const classicOrder = await root
      .locator(
        '[data-home-zone="workspace-tools"], [data-classic-secondary-news], [data-classic-organization-resources], [data-testid="home-workspace-grid"]'
      )
      .evaluateAll((nodes) =>
        nodes.map(
          (node) =>
            node.getAttribute('data-home-zone') ??
            (node.hasAttribute('data-classic-secondary-news')
              ? 'secondary-news'
              : node.hasAttribute('data-classic-organization-resources')
                ? 'organization-resources'
                : 'personal-flow')
        )
      );
    expect(classicOrder).toEqual([
      'workspace-tools',
      'secondary-news',
      'organization-resources',
      'personal-flow',
    ]);
    await expect(root.locator('[data-classic-resource-card]')).toHaveCount(4);
    const personalSummary = root.locator('[data-classic-personal-summary]');
    await expect(personalSummary).toBeVisible();
    await expect(personalSummary.locator('[data-classic-summary-card]')).toHaveCount(2);
    await expect(
      personalSummary.locator('[data-classic-summary-card="next-schedule"]')
    ).toBeVisible();
    await expect(
      personalSummary.locator('[data-classic-summary-card="priority-work"]')
    ).toBeVisible();
    await expect(root.locator('[data-workspace-widget-policy="PERSONAL"]')).toHaveCount(0);
    await expectNoDocumentOrNestedScroll(root);

    if (item.width <= 390) {
      const touchReport = {
        launchpad: await expectMinimumTouchTargets(
          root.locator('[data-launchpad-tile]'),
          `${item.id} launchpad`
        ),
        hero: await expectMinimumTouchTargets(
          root.locator('[data-home-action-placement="hero"] button, [data-classic-primary-action]'),
          `${item.id} hero actions`
        ),
        resources: await expectMinimumTouchTargets(
          root.locator('a[data-classic-resource-card]'),
          `${item.id} resource actions`
        ),
      };
      await test.info().attach(`${item.id}-touch-targets.json`, {
        body: Buffer.from(JSON.stringify(touchReport, null, 2)),
        contentType: 'application/json',
      });
    }

    await stabilizeVisual(page);
    await expectNoSeriousAccessibilityViolations(page, '[data-testid="classic-home"]');
    await expect(page).toHaveScreenshot(`home-wave2-${item.id}.png`, {
      animations: 'disabled',
      caret: 'hide',
      fullPage: true,
      scale: 'css',
    });
  }
});

test('HomeLayout keeps the root Home sidebar-free and exposes navigation from the header', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.goto('/');
  const main = page.getByTestId('personal-home-main');
  const root = page.getByTestId('classic-home');
  await expect(main).toHaveAttribute('data-home-layout-owner', 'home-layout');
  await expect(main).toHaveCSS('container-name', 'dwp-home-workspace');
  await expect(page.getByTestId('home-sidebar')).toHaveCount(0);
  await expect.poll(async () => Math.round((await main.boundingBox())?.width ?? 0)).toBe(1440);
  await expect
    .poll(async () => Number(await root.getAttribute('data-classic-home-available-width')))
    .toBe(1440);
  await expectNoDocumentOrNestedScroll(root);

  const navigationTrigger = page.getByTestId('home-mobile-navigation-trigger');
  await expect(navigationTrigger).toBeVisible();
  await navigationTrigger.click();
  const navigation = page.getByTestId('home-mobile-navigation');
  await expect(navigation).toBeVisible();
  await expect(navigation.locator('[data-testid^="home-navigation-item-"]')).toHaveCount(7);
  await navigation.getByRole('button', { name: '탐색 메뉴 닫기' }).click();
  await expect(navigation).toBeHidden();
  await expect(navigationTrigger).toBeFocused();
  await expectCanonicalClassicLaunchpad(root);
  await expectNoLaunchpadLabelClipping(root);
  await expectNoDocumentOrNestedScroll(root);
});

test('Flow base and personalized compositions keep personal-action IA and all approved apps', async ({
  page,
}) => {
  const cases = [
    {
      id: 'FLOW-BASE-DESKTOP-FINAL',
      fixtureId: 'WAVE2_FLOW-BASE-DESKTOP-FINAL',
      width: 1920,
      height: 1080,
      presentation: 'balanced',
    },
    {
      id: 'FLOW-BASE-MOBILE-FINAL',
      fixtureId: 'WAVE2_FLOW-BASE-MOBILE-FINAL',
      width: 390,
      height: 844,
      presentation: 'balanced',
    },
    {
      id: 'FLOW-PERSONALIZED-DESKTOP-FINAL',
      fixtureId: 'WAVE2_FLOW-PERSONALIZED-DESKTOP-FINAL',
      width: 1920,
      height: 1080,
      presentation: 'expressive',
    },
    {
      id: 'FLOW-PERSONALIZED-MOBILE-FINAL',
      fixtureId: 'WAVE2_FLOW-PERSONALIZED-MOBILE-FINAL',
      width: 390,
      height: 844,
      presentation: 'expressive',
    },
  ] as const;

  for (const item of cases) {
    test.info().annotations.push({ type: 'canonical-fixture', description: item.fixtureId });
    await page.unroute('**/api/platform/v1/home-experience');
    await page.unroute('**/api/platform/v1/home-preferences');
    await page.unroute('**/api/platform/v1/home-views**');
    await routeHomeWave2Flow(page, item.presentation);
    await page.unroute('**/api/platform/v2/home**');
    await routeHomeWave4ShadowRuntime(page, 'FLOW_V1');
    await page.setViewportSize({ width: item.width, height: item.height });
    await page.goto(
      item.presentation === 'expressive'
        ? '/?wave2FlowState=loaded'
        : item.width < 600
          ? '/?wave2FlowState=preview'
          : '/'
    );
    const root = page.getByTestId('flow-home');
    await expect(root).toBeVisible();
    await expect(root).toHaveAttribute('data-home-ia', 'personal-action');
    await expect(root).toHaveAttribute('data-home-scroll-contract', 'single-document');
    await expect(root).toHaveAttribute('data-flow-home-presentation', item.presentation);
    await expect(page.getByTestId('home-sidebar')).toHaveCount(0);
    if (item.width >= 1200) {
      await expect(page.getByTestId('personal-home-shell')).toHaveAttribute(
        'data-home-navigation-pattern',
        'drawer'
      );
      await expect
        .poll(async () =>
          Math.round((await page.getByTestId('personal-home-main').boundingBox())?.width ?? 0)
        )
        .toBe(item.width);
      await expect.poll(async () => Math.round((await root.boundingBox())?.width ?? 0)).toBe(1808);
    } else {
      const mobileNavigation = page.getByTestId('home-mobile-bottom-navigation');
      await expect(mobileNavigation).toBeVisible();
      await expect(mobileNavigation.locator('a')).toHaveCount(5);
      await expectMobileNavigation(mobileNavigation, FLOW_MOBILE_NAVIGATION, 'FLOW_V1');
      const touchReport: Record<string, unknown> = {
        navigation: await expectMinimumTouchTargets(
          mobileNavigation.locator('a'),
          `${item.id} mobile navigation`
        ),
        primaryAction: await expectMinimumTouchTargets(
          root.locator('[data-flow-primary-action-cta]'),
          `${item.id} primary action`
        ),
        launchpad: await expectMinimumTouchTargets(
          root.locator('[data-flow-dock-launch]'),
          `${item.id} launchpad`
        ),
      };
      if (item.presentation === 'expressive') {
        touchReport.futureWidgets = await expectMinimumTouchTargets(
          root.locator('[data-flow-future-widget] button'),
          `${item.id} future widget actions`
        );
      }
      await test.info().attach(`${item.id}-touch-targets.json`, {
        body: Buffer.from(JSON.stringify(touchReport, null, 2)),
        contentType: 'application/json',
      });
    }
    await expect(root.locator('[data-flow-primary-action]')).toBeVisible();
    await expect(root.locator('[data-flow-primary-action-cta]')).toBeVisible();
    await expect(root.locator('[data-flow-health-state]')).toHaveCount(0);
    if (item.width >= 900) {
      await expect(root.locator('[data-flow-linked-calendar-context]')).toBeVisible();
    }
    await expectCanonicalFlowLaunchpad(root);
    if (item.presentation === 'expressive') {
      const mesh = root.locator('[data-flow-future-widget-mesh]');
      await expect(mesh).toBeVisible();
      await expect(mesh).toHaveAttribute('data-flow-future-widget-count', '5');
      await expect(mesh.locator('[data-flow-future-widget]')).toHaveCount(5);
      await expect(mesh).toHaveAttribute(
        'data-flow-future-mobile-order',
        'meetings-space-ai-workplace-learning'
      );
      const futureOrder = await mesh
        .locator('[data-flow-future-widget]')
        .evaluateAll((widgets) =>
          widgets.map((widget) => widget.getAttribute('data-flow-future-widget'))
        );
      expect(futureOrder).toEqual([
        'meetings-prep-decisions',
        'space-change-feed',
        'dwaion-artifact',
        'workplace-booking',
        'learning-progress',
      ]);
      const futureGeometry = await mesh
        .locator('[data-flow-future-widget]')
        .evaluateAll((widgets) =>
          Object.fromEntries(
            widgets.map((widget) => {
              const bounds = widget.getBoundingClientRect();
              return [
                widget.getAttribute('data-flow-future-widget'),
                { left: bounds.left, top: bounds.top },
              ];
            })
          )
        );
      if (item.width === 1920) {
        expect(futureGeometry['space-change-feed']!.left).toBeLessThan(
          futureGeometry['meetings-prep-decisions']!.left
        );
        expect(futureGeometry['meetings-prep-decisions']!.left).toBeLessThan(
          futureGeometry['dwaion-artifact']!.left
        );
      } else {
        const mobileTopOrder = [
          'meetings-prep-decisions',
          'space-change-feed',
          'dwaion-artifact',
          'workplace-booking',
          'learning-progress',
        ].map((key) => futureGeometry[key]!.top);
        expect(mobileTopOrder).toEqual([...mobileTopOrder].sort((left, right) => left - right));
      }
      await expect(
        mesh.locator('[data-integration-boundary="WAVE4_PROVIDER_PROJECTION"]')
      ).toHaveCount(5);
      await expect(mesh.locator('[data-flow-provider-status="available"]')).toHaveCount(5);
      await expect(mesh.locator('[data-flow-provider-activation="fixture-only"]')).toHaveCount(5);
      await expect(mesh.getByRole('button')).toHaveCount(5);
      for (const action of await mesh.getByRole('button').all()) await expect(action).toBeEnabled();
      await expect(root.getByTestId('flow-home-personal-sections')).toHaveCount(0);
    } else {
      await expect(root.locator('[data-flow-meeting-prep]')).toBeVisible();
      await expect(root.locator('[data-flow-future-widget-mesh]')).toHaveCount(0);
      if (item.width === 1920) await expectFlowWideComposition(root);
      const baseSectionOrder = await root
        .locator(
          '[data-testid="flow-home-personal-sections"] [data-workspace-widget-policy="PERSONAL"]'
        )
        .evaluateAll((widgets) =>
          widgets.map((widget) => widget.getAttribute('data-workspace-widget'))
        );
      expect(baseSectionOrder).toEqual([
        'action-queue',
        'today',
        'response-hub',
        'request-tracker',
      ]);
      if (item.width < 600) {
        const mobileFlowOrder = await root
          .locator(
            '[data-flow-meeting-prep], [data-workspace-widget="action-queue"], [data-workspace-widget="today"], [data-workspace-widget="response-hub"], [data-flow-base-space-feed], [data-workspace-widget="request-tracker"]'
          )
          .evaluateAll((items) =>
            items.map(
              (element) =>
                element.getAttribute('data-workspace-widget') ??
                (element.hasAttribute('data-flow-meeting-prep')
                  ? 'meeting-prep'
                  : 'space-change-feed')
            )
          );
        expect(mobileFlowOrder).toEqual([
          'meeting-prep',
          'action-queue',
          'today',
          'response-hub',
          'space-change-feed',
          'request-tracker',
        ]);
        await expect(root.locator('[data-flow-base-space-feed] button')).toBeDisabled();
      } else if (item.width === 1920) {
        const rightColumn = await root.evaluate(() => {
          const response = document
            .querySelector<HTMLElement>('[data-workspace-widget="response-hub"]')!
            .getBoundingClientRect();
          const request = document
            .querySelector<HTMLElement>('[data-workspace-widget="request-tracker"]')!
            .getBoundingClientRect();
          return {
            sameLeft: Math.abs(response.left - request.left),
            sameWidth: Math.abs(response.width - request.width),
            followsResponse: request.top >= response.bottom - 1,
          };
        });
        expect(rightColumn.sameLeft).toBeLessThanOrEqual(1);
        expect(rightColumn.sameWidth).toBeLessThanOrEqual(1);
        expect(rightColumn.followsResponse).toBe(true);
      }
    }
    await expectNoDocumentOrNestedScroll(root);
    await stabilizeVisual(page);
    await expectNoSeriousAccessibilityViolations(page, '[data-testid="flow-home"]');
    await expect(page).toHaveScreenshot(`home-wave2-${item.id}.png`, {
      animations: 'disabled',
      caret: 'hide',
      fullPage: true,
      maxDiffPixelRatio: 0.01,
      scale: 'css',
    });

    if (item.id === 'FLOW-BASE-DESKTOP-FINAL') {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/');
      const standardRoot = page.getByTestId('flow-home');
      await expect(standardRoot).toBeVisible();
      await expect
        .poll(async () => Number(await standardRoot.getAttribute('data-flow-home-available-width')))
        .toBe(1440);
      await expect(standardRoot.getByTestId('flow-home-personal-sections')).toHaveAttribute(
        'data-flow-read-template',
        'adaptive-medium'
      );
      await expectNoDocumentOrNestedScroll(standardRoot);
    }
  }
});

test('Flow Studio owns panel scrolling, traps focus, and restores the launch point', async ({
  page,
}) => {
  const unsafeSelectorWarnings = captureConsoleMessages(page, [':first-child']);
  test.info().annotations.push({
    type: 'canonical-fixture',
    description: 'WAVE2_FLOW-EDITOR-DESKTOP',
  });
  await routeHomeWave2Flow(page, 'expressive', { studio: true });
  await page.unroute('**/api/platform/v2/home**');
  await routeHomeWave4ShadowRuntime(page, 'FLOW_V1');
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/?wave2FlowState=preview');

  const root = page.getByTestId('flow-home');
  await expect(root).toBeVisible();
  await expect(page.locator('[data-home-runtime-path]')).toHaveAttribute(
    'data-home-runtime-state',
    'shadow_compare'
  );
  await root.getByRole('button', { name: '홈 편집 옵션' }).click();
  await page.getByRole('menuitem', { name: /홈 설정/u }).click();

  const dialog = page.getByRole('dialog', { name: '나만의 업무 홈' });
  await expect(dialog).toBeVisible();
  const panel = dialog.locator('[data-home-editor-scroll-scope="active-panel"]');
  await expect(panel).toHaveAttribute(
    'data-home-editor-focus-contract',
    'dialog-trap-panel-focus-close-restore'
  );
  await panel.focus();
  await expect(panel).toBeFocused();

  const workbench = dialog.getByTestId('home-layout-studio-workbench');
  await expect(workbench).toBeVisible();
  await expect(workbench).toHaveAttribute('data-home-studio-catalog-count', '12');
  await expect(workbench).toHaveAttribute('data-home-studio-catalog-mode', 'shadow');
  await expect(workbench.locator('[data-home-studio-catalog-item]')).toHaveCount(12);
  const catalogIds = await workbench
    .locator('[data-home-studio-catalog-item]')
    .evaluateAll((items) => items.map((item) => item.getAttribute('data-home-studio-catalog-id')));
  expect(catalogIds.slice(0, 8)).toEqual([
    'meetings.next-prep',
    'meetings.decisions',
    'space.feed',
    'dwai.artifacts',
    'workplace.status',
    'hr.learning',
    'services.requests',
    'security.bulletin',
  ]);
  await expect(workbench.locator('[data-home-studio-native-renderer]')).toHaveCount(7);
  await expect(workbench.locator('[data-home-studio-renderer="projection"]')).toHaveCount(5);
  await expect(workbench.locator('[data-home-studio-projection-placeholder]')).toHaveCount(5);
  await expect(workbench.locator('[data-home-studio-canvas-ratio="38-34-28"]')).toBeVisible();
  await expect(workbench.locator('[data-home-studio-preview-density="compact"]')).toBeVisible();
  const commandPreview = workbench.locator('[data-home-studio-native-renderer="command-rail"]');
  await expect(commandPreview).toHaveAttribute('data-home-studio-preview-item-budget', '1');
  const commandPreviewGeometry = await commandPreview.evaluate((element) => {
    const rail = element.querySelector<HTMLElement>('[data-testid="home-priority-rail"]');
    const visibleItems = rail
      ? Array.from(rail.children).filter((item) => getComputedStyle(item).display !== 'none').length
      : 0;
    const clippedText = Array.from(element.querySelectorAll<HTMLElement>('.MuiTypography-root'))
      .filter((item) => getComputedStyle(item).display !== 'none' && item.offsetParent !== null)
      .filter((item) => item.scrollWidth > item.clientWidth + 1).length;
    return {
      columns: rail ? getComputedStyle(rail).gridTemplateColumns.split(' ').length : 0,
      visibleItems,
      clippedText,
    };
  });
  expect(commandPreviewGeometry).toEqual({ columns: 1, visibleItems: 1, clippedText: 0 });
  await expect(workbench.locator('[data-home-editor-scroll-scope="catalog"]')).toBeVisible();
  await expect(workbench.locator('[data-home-editor-scroll-scope="inspector"]')).toBeVisible();
  await expect(workbench.locator('[data-home-editor-scroll-scope="canvas"]')).toBeVisible();
  await expect(workbench.locator('[data-home-studio-inspector-field]')).toHaveCount(6);
  await expect(
    workbench.locator('[data-home-studio-inspector-field="supportedWidths"]')
  ).toContainText(/38%|34%|28%/u);
  await expect(workbench.locator('[data-home-studio-inspector-field="dataBudget"]')).toContainText(
    /freshness|Preview only/u
  );
  await expect(
    workbench.locator('[data-home-studio-inspector-field="targetRegion"]')
  ).not.toBeEmpty();

  await workbench.locator('[data-home-studio-catalog-item="schedule"]').click();
  const moveForward = workbench.getByRole('button', { name: '앞으로 이동' });
  await expect(moveForward).toBeEnabled();
  await moveForward.click();
  await expect(workbench.locator('[data-home-studio-dirty="true"]').first()).toBeVisible();
  await page.keyboard.press('Control+z');
  await expect(workbench.locator('[data-home-studio-dirty="false"]').first()).toBeVisible();
  await stabilizeVisual(page);
  await expectNoSeriousAccessibilityViolations(page, '[role="dialog"]');
  await expect(page).toHaveScreenshot('home-wave2-FLOW-EDITOR-DESKTOP.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
    maxDiffPixelRatio: 0.01,
    scale: 'css',
  });
  await expect(page).toHaveScreenshot('home-wave2-FLOW-EDITOR-DESKTOP-interaction.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: false,
    maxDiffPixelRatio: 0.01,
    scale: 'css',
  });
  expect(unsafeSelectorWarnings).toEqual([]);

  await dialog.getByRole('button', { name: '홈 스튜디오 닫기' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(root.locator('[data-home-edit-trigger]')).toBeFocused();
});

test('200% browser and text reflow keep the complete Home document usable', async ({ page }) => {
  test
    .info()
    .annotations.push(
      { type: 'canonical-fixture', description: 'HOME_SPEC_ZOOM_200' },
      { type: 'canonical-fixture', description: 'HOME_SPEC_TEXT_200' }
    );
  // Keep Playwright's screenshot surface aligned with the 720 CSS-pixel
  // viewport before applying the DPR=2 CDP metrics. Without this, Chromium
  // reports the correct zoom metrics but captures the stale 1280px surface.
  await page.setViewportSize({ width: 720, height: 450 });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 720,
    height: 450,
    screenWidth: 1440,
    screenHeight: 900,
    deviceScaleFactor: 2,
    mobile: false,
  });
  await page.goto('/');
  const browserZoomEvidence = await page.evaluate(() => ({
    cssViewport: { width: window.innerWidth, height: window.innerHeight },
    physicalViewport: {
      width: Math.round(window.innerWidth * window.devicePixelRatio),
      height: Math.round(window.innerHeight * window.devicePixelRatio),
    },
    devicePixelRatio: window.devicePixelRatio,
    screen: { width: window.screen.width, height: window.screen.height },
  }));
  expect(browserZoomEvidence).toEqual({
    cssViewport: { width: 720, height: 450 },
    physicalViewport: { width: 1440, height: 900 },
    devicePixelRatio: 2,
    screen: { width: 1440, height: 900 },
  });
  await test.info().attach('HOME_SPEC_ZOOM_200-browser-metrics.json', {
    body: Buffer.from(JSON.stringify(browserZoomEvidence, null, 2)),
    contentType: 'application/json',
  });
  let root = page.getByTestId('classic-home');
  await expect(root).toBeVisible();
  await expect(page.getByTestId('home-sidebar')).toBeHidden();
  await expect(page.getByTestId('home-mobile-bottom-navigation')).toBeHidden();
  const compactNavigationTrigger = page.getByTestId('home-mobile-navigation-trigger');
  await expect(compactNavigationTrigger).toBeVisible();
  const compactTriggerBounds = await compactNavigationTrigger.boundingBox();
  expect(compactTriggerBounds?.width ?? 0).toBeGreaterThanOrEqual(44);
  expect(compactTriggerBounds?.height ?? 0).toBeGreaterThanOrEqual(44);
  await compactNavigationTrigger.click();
  const compactNavigation = page.getByTestId('home-mobile-navigation');
  await expect(compactNavigation).toBeVisible();
  await expect(compactNavigation.locator('[data-testid^="home-navigation-item-"]')).toHaveCount(7);
  await compactNavigation.getByRole('button', { name: '탐색 메뉴 닫기' }).click();
  await expect(compactNavigation).toBeHidden();
  await expect(compactNavigationTrigger).toBeFocused();
  await expectCanonicalClassicLaunchpad(root);
  await expectNoDocumentOrNestedScroll(root);
  await stabilizeVisual(page);
  await expectNoSeriousAccessibilityViolations(page, '[data-testid="classic-home"]');
  await expect(page).toHaveScreenshot('home-wave2-C05-BROWSER-ZOOM-200-CSS720-r01.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
    scale: 'css',
  });

  await cdp.send('Emulation.clearDeviceMetricsOverride');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.evaluate(() => {
    document.documentElement.style.setProperty('font-size', '200%', 'important');
    window.dispatchEvent(new Event('resize'));
  });
  root = page.getByTestId('classic-home');
  await expect(page.getByTestId('personal-home-shell')).toHaveAttribute(
    'data-home-large-text',
    'true'
  );
  await expectNoDocumentOrNestedScroll(root);
  const appMeaning = await root.locator('[data-launchpad-item-label]').evaluateAll((labels) =>
    labels.map((label) => {
      const visibleLabel = Array.from(label.children).find(
        (child) => getComputedStyle(child).display !== 'none'
      );
      return {
        visibleText: visibleLabel?.textContent?.replace(/\s+/gu, ' ').trim(),
        horizontalClip: label.scrollWidth > label.clientWidth + 1,
        verticalClip: label.scrollHeight > label.clientHeight + 1,
      };
    })
  );
  expect(appMeaning.map(({ visibleText }) => visibleText)).toEqual(CLASSIC_KO_APP_LABELS);
  expect(
    appMeaning.filter(({ horizontalClip, verticalClip }) => horizontalClip || verticalClip)
  ).toEqual([]);
  const largeTextGroupColumns = await root
    .locator('[data-launchpad-group-target]')
    .evaluateAll((groups) =>
      groups.map((group) => getComputedStyle(group).gridTemplateColumns.split(' ').length)
    );
  expect(largeTextGroupColumns.every((count) => count <= 2)).toBe(true);
  await stabilizeVisual(page);
  await expectNoSeriousAccessibilityViolations(page, '[data-testid="classic-home"]');
  await expect(page).toHaveScreenshot('home-wave2-C06-TEXT-200-D1440-r04.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
    scale: 'css',
  });
});

test('long English content wraps without clipping or deleting its accessible meaning', async ({
  page,
}) => {
  test.info().annotations.push({
    type: 'canonical-fixture',
    description: 'HOME_SPEC_LONG_EN',
  });
  await remockHomeWave2ClassicSession(page, {
    locale: 'en',
    displayName: 'Alexandria Montgomery-Wellington',
    mode: 'light',
    longEnglish: true,
  });
  await routeHomeWave4ShadowRuntime(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  const root = page.getByTestId('classic-home');
  await expect(root).toBeVisible();
  await expectSingleVisibleGlobalSearchTrigger(page);
  await expect(root.locator('[data-classic-featured-news]')).toContainText(
    'Enterprise-wide digital workplace modernization'
  );
  await expectCanonicalClassicLaunchpad(root);
  await expectNoLaunchpadLabelClipping(root);
  await expectNoDocumentOrNestedScroll(root);
  await stabilizeVisual(page);
  await expectNoSeriousAccessibilityViolations(page, '[data-testid="classic-home"]');
  await expect(page).toHaveScreenshot('home-wave2-C07-LONG-EN-D1280-r02.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
    scale: 'css',
  });
});

test('dark and forced-color modes retain contrast, focus, and structure', async ({ page }) => {
  test
    .info()
    .annotations.push(
      { type: 'canonical-fixture', description: 'HOME_SPEC_DARK' },
      { type: 'canonical-fixture', description: 'HOME_SPEC_HIGH_CONTRAST' },
      { type: 'canonical-fixture', description: 'HOME_SPEC_ACCESSIBILITY_SPEC' }
    );
  await remockHomeWave2ClassicSession(page, {
    locale: 'ko',
    displayName: '김미나',
    mode: 'dark',
  });
  await routeHomeWave4ShadowRuntime(page);
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  let root = page.getByTestId('classic-home');
  await expect(root).toBeVisible();
  await expectNoDocumentOrNestedScroll(root);
  await stabilizeVisual(page);
  await expectNoSeriousAccessibilityViolations(page, '[data-testid="classic-home"]');
  await expect(page).toHaveScreenshot('home-wave2-C08-DARK-D1440-r02.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
    scale: 'css',
  });

  await remockHomeWave2ClassicSession(page, {
    locale: 'ko',
    displayName: '김미나',
    mode: 'dark',
    highContrast: true,
  });
  await routeHomeWave4ShadowRuntime(page);
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark', forcedColors: 'active' });
  await page.reload();
  root = page.getByTestId('classic-home');
  await expect(root).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toBeVisible();
  await stabilizeVisual(page);
  await expectNoSeriousAccessibilityViolations(page, '[data-testid="classic-home"]');
  await expect(page).toHaveScreenshot('home-wave2-C09-HIGH-CONTRAST-D1440-r04.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
    scale: 'css',
  });

  await expectNoDocumentOrNestedScroll(root);
});
