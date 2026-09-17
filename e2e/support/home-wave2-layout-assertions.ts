import { expect } from '@playwright/test';

import { CANONICAL_HOME_APP_IDS_BY_GROUP } from './home-launchpad-contract-fixture';

import type { Locator, Page } from '@playwright/test';

export const CLASSIC_HOME_MOBILE_NAVIGATION = [
  { label: '개요', route: '/' },
  { label: '좌석', route: '/workplace/explore?type=DESK' },
  { label: '회의실', route: '/workplace/rooms' },
  { label: '구성원', route: '/hr' },
  { label: '업무 현황', route: '/activity' },
] as const;

export const FLOW_HOME_MOBILE_NAVIGATION = [
  { label: '오늘', route: '/' },
  { label: '일정', route: '/calendar' },
  { label: '스페이스', route: '/spaces' },
  { label: '할 일', route: '/work' },
  { label: '업무 현황', route: '/activity' },
] as const;

export const CLASSIC_HOME_KO_APP_LABELS = [
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

export async function stabilizeHomeWave2Visual(page: Page) {
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

export async function expectCanonicalFlowLaunchpad(root: Locator) {
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

export async function expectNoLaunchpadDecorationCrossTileOverlap(
  root: Locator,
  presentation: 'balanced' | 'focused' | 'expressive'
) {
  const geometry = await root.locator('[data-launchpad-group-target]').evaluateAll((groups) => {
    type Bounds = ReturnType<HTMLElement['getBoundingClientRect']>;
    type DecorationKind = 'badge' | 'glyph' | 'management';
    const visible = (node: HTMLElement) => {
      const bounds = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return bounds.width > 0 && bounds.height > 0 && style.display !== 'none';
    };
    const sameRow = (left: Bounds, right: Bounds) => Math.abs(left.top - right.top) <= 1.5;
    const intersects = (left: Bounds, right: Bounds) =>
      left.left < right.right - 0.5 &&
      left.right > right.left + 0.5 &&
      left.top < right.bottom - 0.5 &&
      left.bottom > right.top + 0.5;
    const counts: Record<DecorationKind, number> = { badge: 0, glyph: 0, management: 0 };
    const collisions: string[] = [];

    for (const group of groups) {
      const items = Array.from(
        group.querySelectorAll<HTMLElement>(':scope > [data-launchpad-item]')
      ).filter(visible);
      const itemBounds = items.map((item) => ({
        id: item.dataset.launchpadItem ?? 'unknown',
        item,
        bounds: item.getBoundingClientRect(),
      }));

      for (const owner of itemBounds) {
        const decorations: { kind: DecorationKind; node: HTMLElement }[] = [
          ...Array.from(owner.item.querySelectorAll<HTMLElement>('[data-launchpad-glyph]')).map(
            (node) => ({ kind: 'glyph' as const, node })
          ),
          ...Array.from(owner.item.querySelectorAll<HTMLElement>('[data-launchpad-badge]')).map(
            (node) => ({ kind: 'badge' as const, node })
          ),
          ...Array.from(
            owner.item.querySelectorAll<HTMLElement>(
              ':scope > button:not([data-launchpad-tile]):not([data-launchpad-remove-control])'
            )
          ).map((node) => ({ kind: 'management' as const, node })),
        ].filter(({ node }) => visible(node));

        for (const decoration of decorations) {
          counts[decoration.kind] += 1;
          const bounds = decoration.node.getBoundingClientRect();
          for (const neighbour of itemBounds) {
            if (neighbour.item === owner.item || !sameRow(owner.bounds, neighbour.bounds)) continue;
            if (intersects(bounds, neighbour.bounds)) {
              collisions.push(`${decoration.kind}:${owner.id}->${neighbour.id}`);
            }
          }
        }
      }
    }

    return { collisions, counts };
  });

  expect(geometry.counts.glyph, `${presentation}: glyph geometry must be exercised`).toBe(18);
  expect(
    geometry.counts.badge,
    `${presentation}: badge geometry must be exercised`
  ).toBeGreaterThan(0);
  expect(
    geometry.counts.management,
    `${presentation}: management overlay geometry must be exercised`
  ).toBeGreaterThan(0);
  expect(
    geometry.collisions,
    `${presentation}: launchpad decorations must stay clear of same-row neighbouring tiles`
  ).toEqual([]);
}

export async function expectHomeMobileNavigation(
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

export async function expectSingleVisibleGlobalSearchTrigger(page: Page) {
  const searchSurface = page.locator('[data-shell-global-action="search"]');
  await expect(searchSurface).toBeVisible();
  await expect(searchSurface.getByRole('button')).toHaveCount(1);
}

export async function expectFlowWideComposition(root: Locator) {
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

export async function expectNoDocumentOrNestedScroll(root: Locator) {
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

export async function expectCanonicalClassicLaunchpad(root: Locator) {
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

export async function expectNoLaunchpadLabelClipping(root: Locator) {
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
