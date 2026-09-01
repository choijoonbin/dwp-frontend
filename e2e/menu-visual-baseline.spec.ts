import fs from 'node:fs';
import path from 'node:path';

import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { PRODUCT_MENU_ROUTES } from '../apps/dwp/src/routes/product-menu-manifest';
import { exerciseGovernedMenuRoute } from './support/menu-route-harness';
import {
  MENU_VISUAL_BASELINE_INVENTORY,
  type MenuVisualProject,
} from './support/menu-visual-baseline-inventory';
import {
  MENU_VISUAL_BASELINE_EXCEPTIONS,
  validateMenuVisualBaselinePolicy,
} from './support/menu-visual-baseline-policy';

test.describe.configure({ mode: 'parallel' });

const routeById = new Map(PRODUCT_MENU_ROUTES.map((route) => [route.id, route]));
const baselineRouteIds = [...new Set(MENU_VISUAL_BASELINE_INVENTORY.map((entry) => entry.routeId))];
const APPROVED_BASELINE_FLOOR = { routes: 86, chromium: 86, mobile: 85 } as const;

test('checked-in menu baseline inventory matches the current route manifest and snapshots', () => {
  const keys = MENU_VISUAL_BASELINE_INVENTORY.map(
    (entry) => `${entry.routeId}:${entry.project}:${entry.fileName}`
  );
  expect(new Set(keys).size, 'visual inventory contains duplicate entries').toBe(keys.length);
  expect(
    baselineRouteIds.length,
    'approved menu visual route coverage regressed'
  ).toBeGreaterThanOrEqual(APPROVED_BASELINE_FLOOR.routes);
  for (const project of ['chromium', 'mobile'] as const) {
    const projectBaselineCount = MENU_VISUAL_BASELINE_INVENTORY.filter(
      (entry) => entry.project === project
    ).length;
    expect(
      projectBaselineCount,
      `approved ${project} menu visual coverage regressed`
    ).toBeGreaterThanOrEqual(APPROVED_BASELINE_FLOOR[project]);
  }
  for (const entry of MENU_VISUAL_BASELINE_INVENTORY) {
    expect(routeById.has(entry.routeId), `unknown visual route ${entry.routeId}`).toBe(true);
  }
  const snapshotDirectory = path.resolve(
    process.cwd(),
    'e2e/menu-visual-baseline.spec.ts-snapshots'
  );
  const checkedInSnapshots = fs
    .readdirSync(snapshotDirectory)
    .filter((fileName) => fileName.endsWith('.png'))
    .sort();
  const governedSnapshots = MENU_VISUAL_BASELINE_INVENTORY.map((entry) => entry.fileName).sort();
  expect(checkedInSnapshots, 'snapshot inventory has missing or orphan files').toEqual(
    governedSnapshots
  );
});

test('every menu route and viewport has exactly one governed visual disposition', () => {
  expect(
    validateMenuVisualBaselinePolicy({
      manifestRouteIds: PRODUCT_MENU_ROUTES.map((route) => route.id),
      baselines: MENU_VISUAL_BASELINE_INVENTORY,
      exceptions: MENU_VISUAL_BASELINE_EXCEPTIONS,
      today: new Date().toISOString().slice(0, 10),
    })
  ).toEqual([]);
});

test('menu visual disposition validation fails closed', () => {
  const baseline = {
    routeId: 'covered',
    project: 'chromium' as const,
    fileName: 'covered-chromium-darwin.png',
  };
  expect(
    validateMenuVisualBaselinePolicy({
      manifestRouteIds: ['covered', 'missing'],
      baselines: [baseline, baseline, { ...baseline, routeId: 'stale' }],
      exceptions: [
        {
          routeId: 'covered',
          projects: ['chromium'],
          owner: '',
          reason: '',
          reviewBy: '2025-02-29',
        },
        {
          routeId: 'stale',
          projects: ['mobile', 'mobile'],
          owner: '@dwp/test-owner',
          reason:
            'This deliberately stale exception proves that unknown and duplicate coverage cannot pass.',
          reviewBy: '2026-01-01',
        },
      ],
      today: '2026-09-01',
    })
  ).toEqual(
    expect.arrayContaining([
      'duplicate visual baseline coverage: covered:chromium',
      'stale visual baseline route: stale',
      'visual baseline and non-visual exception overlap: covered:chromium',
      'non-visual exception owner is missing or invalid: covered',
      'non-visual exception reason is missing or too short: covered',
      'non-visual exception review date is invalid: covered',
      'stale non-visual exception route: stale',
      'duplicate non-visual exception coverage: stale:mobile',
      'non-visual exception review is overdue: stale (2026-01-01)',
      'menu visual coverage is unclassified: covered:mobile',
      'menu visual coverage is unclassified: missing:chromium',
      'menu visual coverage is unclassified: missing:mobile',
    ])
  );
});

for (const routeId of baselineRouteIds) {
  const productRoute = routeById.get(routeId);
  if (!productRoute) throw new Error(`Visual inventory references an unknown route: ${routeId}`);
  test(`${productRoute.id} keeps its approved visual baseline`, async ({ page }, testInfo) => {
    const project = testInfo.project.name as MenuVisualProject;
    const baseline = MENU_VISUAL_BASELINE_INVENTORY.find(
      (entry) => entry.routeId === productRoute.id && entry.project === project
    );
    test.skip(!baseline, `${productRoute.id} has no approved ${project} pixel baseline`);
    await exerciseGovernedMenuRoute(page, testInfo, productRoute, {
      allowFixtureTransportErrors: false,
    });
    const accessibility = await new AxeBuilder({ page }).include('#dwp-main-content').analyze();
    const blockingViolations = accessibility.violations.filter((violation) =>
      ['serious', 'critical'].includes(violation.impact ?? '')
    );
    expect(
      blockingViolations,
      `${productRoute.id}:${project} has serious or critical accessibility violations`
    ).toEqual([]);
    await expect(page).toHaveScreenshot(`${productRoute.id}.png`, {
      animations: 'disabled',
      caret: 'hide',
      fullPage: false,
      maxDiffPixelRatio: 0.002,
      timeout: 15_000,
    });
  });
}
