import { isolateWorkplaceDevelopmentUpdates } from './support/workplace-runtime-isolation';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { resolveMenuRouteWorkplaceFixture } from './support/menu-route-workplace-fixtures';
import {
  locationFloor,
  locationResource,
  locationSite,
} from './support/workplace-location-fixtures';

import {
  FULL_PRODUCT_PERMISSIONS,
  fulfillSuccess,
  mockShellSession,
} from './support/shell-session';

import type {
  WorkplaceCollaborationOverview,
  WorkplaceExploreResponse,
  WorkplaceWorkPlanInput,
} from '@dwp-frontend/shared-utils';
import type { Page } from '@playwright/test';

const GROUP_REF = '70000000-0000-0000-0000-000000000001';
const PREFIX = '/api/platform/v1/workplace/experience/collaboration';

async function mockCollaboration(page: Page, rejectFirstPlan = false, seeded = false) {
  const overview: WorkplaceCollaborationOverview = {
    ownPlans: [],
    sharedPlans: [],
    shareableGroups: [{ groupRef: GROUP_REF, displayName: 'Design team' }],
    preference: { optIn: false, visibility: 'PRIVATE', version: 0 },
    policy: { sharingEnabled: true, maximumVisibility: 'SITE', version: 0 },
    actualPresence: {
      kind: 'ACTUAL_PRESENCE',
      provider: null,
      status: 'NOT_CONFIGURED',
      configurationReference: null,
      lastVerifiedAt: null,
      version: 0,
    },
    generatedAt: '2026-08-19T00:00:00Z',
  };
  const plans: WorkplaceWorkPlanInput[] = [];
  if (seeded) {
    overview.preference = { optIn: true, visibility: 'SITE', version: 3 };
    overview.ownPlans = [
      {
        planId: '50000000-0000-0000-0000-000000000001',
        planDate: '2026-08-19',
        mode: 'REMOTE',
        siteId: null,
        floorId: null,
        resourceId: null,
        groupRef: GROUP_REF,
        visibility: 'SITE',
        version: 2,
      },
    ];
    overview.sharedPlans = [
      {
        planId: '50000000-0000-0000-0000-000000000002',
        planDate: '2026-08-19',
        mode: 'REMOTE',
        siteId: null,
        floorId: null,
        resourceId: null,
        visibility: 'SITE',
        userId: 12,
        displayName: 'Fixture colleague with a shared plan',
        source: 'WORK_PLAN',
      },
    ];
  }
  const preferences: unknown[] = [];
  let overviewReads = 0;
  let revocations = 0;
  await page.route('**/api/platform/v1/workplace/experience/collaboration/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === `${PREFIX}/overview`) {
      overviewReads += 1;
      return fulfillSuccess(route, overview);
    }
    if (path === `${PREFIX}/work-plans` && request.method() === 'POST') {
      const input = request.postDataJSON() as WorkplaceWorkPlanInput;
      plans.push(input);
      if (rejectFirstPlan && plans.length === 1) {
        overview.ownPlans = [{ ...input, planId: 'plan-1', version: 5 }];
        return route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, message: 'The work plan changed.' }),
        });
      }
      const plan = { ...input, planId: 'plan-1', version: (input.version ?? -1) + 1 };
      overview.ownPlans = [plan];
      return fulfillSuccess(route, plan);
    }
    if (path === `${PREFIX}/sharing-preference` && request.method() === 'PUT') {
      const input = request.postDataJSON() as WorkplaceCollaborationOverview['preference'];
      preferences.push(input);
      overview.preference = { ...input, version: input.version + 1 };
      return fulfillSuccess(route, overview.preference);
    }
    if (path === `${PREFIX}/sharing-preference` && request.method() === 'DELETE') {
      expect(new URL(request.url()).searchParams.get('version')).toBe(
        String(overview.preference.version)
      );
      revocations += 1;
      overview.preference = {
        optIn: false,
        visibility: 'PRIVATE',
        version: overview.preference.version + 1,
      };
      overview.ownPlans = overview.ownPlans.map((plan) => ({
        ...plan,
        visibility: 'PRIVATE',
        version: plan.version + 1,
      }));
      return fulfillSuccess(route, overview.preference);
    }
    return route.fallback();
  });
  return {
    overview,
    plans,
    preferences,
    overviewReads: () => overviewReads,
    revocations: () => revocations,
  };
}

async function selectRemotePlan(page: Page) {
  const form = page.getByTestId('workplace-team-plan-form');
  await form.getByRole('combobox').first().click();
  await page.getByRole('option').nth(1).click();
  await expect(page.getByRole('listbox')).toHaveCount(0);
  return form;
}

test.beforeEach(async ({ page }) => {
  // A reused dev server must not reset command state via hot reload during assertions.
  await isolateWorkplaceDevelopmentUpdates(page);
  await page.clock.setFixedTime(new Date('2026-08-19T00:00:00Z'));
  await mockShellSession(page, ['TENANT_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
});

test('a disclosed colleague floor opens actual dated discovery and disappears when catalog authority is revoked', async ({
  page,
}) => {
  const fixture = await mockCollaboration(page, false, true);
  const catalog = {
    ...(resolveMenuRouteWorkplaceFixture('GET', '/api/platform/v1/workplace/explore')
      ?.data as WorkplaceExploreResponse),
    sites: [locationSite],
    floors: [locationFloor],
    selectedFloor: locationFloor,
    resources: [locationResource],
  } as WorkplaceExploreResponse;
  const floor = catalog?.selectedFloor;
  if (!floor) throw new Error('Canonical native floor fixture required');
  fixture.overview.policy.maximumVisibility = 'RESOURCE';
  fixture.overview.preference.visibility = 'FLOOR';
  const base = fixture.overview.sharedPlans[0];
  fixture.overview.sharedPlans = [
    {
      ...base,
      visibility: 'FLOOR',
      mode: 'OFFICE',
      siteId: floor.siteId,
      floorId: floor.floorId,
      resourceId: null,
    },
    {
      ...base,
      planId: '50000000-0000-0000-0000-000000000019',
      userId: 13,
      visibility: 'SITE',
      mode: 'OFFICE',
      siteId: floor.siteId,
      floorId: null,
      resourceId: null,
    },
  ];
  const reads: URL[] = [];
  await page.route('**/api/platform/v1/workplace/explore*', (route) => {
    reads.push(new URL(route.request().url()));
    return fulfillSuccess(route, catalog);
  });
  await page.goto('/workplace/home?view=team');
  const action = page.getByRole('link', { name: 'Find spaces on the same floor', exact: true });
  await expect(action).toHaveCount(1);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(action).toBeVisible();
    const target = new URL((await action.getAttribute('href'))!, 'https://dwp.test');
    expect(Object.fromEntries(target.searchParams)).toEqual({
      v: '1',
      date: '2026-08-19',
      tz: catalog.sites.find((site) => site.siteId === floor.siteId)!.timeZone,
      sites: floor.siteId,
      floors: floor.floorId,
      types: 'ALL',
    });
  }
  await action.click();
  await expect(page).toHaveURL(/\/workplace\/find\?/u);
  await expect.poll(() => reads.at(-1)?.searchParams.get('floorId')).toBe(floor.floorId);
  await page.goto('/workplace/home?view=team');
  await expect(action).toHaveCount(1);
  await page.route('**/api/platform/v1/workplace/explore*', (route) =>
    route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: '{"success":false,"message":"Catalog authority revoked"}',
    })
  );
  await page.reload();
  await expect(action).toHaveCount(0, { timeout: 10_000 });
});

test('team plans require saved consent and a verified group and can revoke their disclosure', async ({
  page,
}, testInfo) => {
  const fixture = await mockCollaboration(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/workplace/home?view=team');
  const planForm = await selectRemotePlan(page);
  await expect(planForm.getByRole('combobox')).toHaveCount(2);
  const sharing = page.getByTestId('workplace-team-sharing-form');
  await sharing.getByRole('switch').check();
  await page.getByTestId('workplace-team-save-preference').click();
  await expect.poll(() => fixture.preferences.length).toBe(1);
  await expect(page.getByTestId('workplace-team-save-plan')).toBeEnabled();
  await planForm.getByRole('combobox').nth(1).click();
  await page.getByRole('option').nth(1).click();
  await expect(planForm.getByRole('combobox')).toHaveCount(3);
  await page.getByTestId('workplace-team-save-plan').click();
  await expect.poll(() => fixture.plans.length).toBe(1);
  expect(fixture.plans[0]).toMatchObject({
    planDate: '2026-08-19',
    mode: 'REMOTE',
    siteId: null,
    floorId: null,
    resourceId: null,
    groupRef: GROUP_REF,
    visibility: 'SITE',
    version: null,
  });
  await expect(page.getByTestId('workplace-team-revoke')).toBeEnabled();
  await page.getByTestId('workplace-team-revoke').click();
  await page.getByRole('alertdialog').getByRole('button').last().click();
  await expect.poll(() => fixture.revocations()).toBe(1);
  await expect(sharing.getByRole('switch')).not.toBeChecked();
  await expect(page.getByTestId('workplace-team-revoke')).toHaveCount(0);
  await expect(page.getByTestId('workplace-team-revoke-complete')).toBeVisible();
  await expect(page.getByTestId('workplace-team-revoke-complete')).toContainText(
    'Work plan sharing is revoked'
  );
  expect(fixture.overview.ownPlans[0]?.visibility).toBe('PRIVATE');
  await expect(page.getByText('Sharing revoked.', { exact: true })).toHaveCount(0, {
    timeout: 10_000,
  });
  for (const width of [1440, 1280, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    const sidebar =
      width >= 1280 ? await page.locator('aside[id$="-desktop-navigation"]').boundingBox() : null;
    await expect
      .poll(async () => Math.round((await page.locator('main').boundingBox())?.x ?? -1))
      .toBe(Math.round(sidebar?.width ?? 0));
    await expect(page.getByTestId('workplace-team-save-plan')).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      width: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));
    expect(dimensions.content, `team at ${width}px`).toBeLessThanOrEqual(dimensions.width);
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      window.scrollTo(0, 0);
    });
    await page.screenshot({
      path: testInfo.outputPath(`workplace-team-${width}.png`),
      fullPage: true,
    });
  }
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  const zoom = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(zoom.content).toBeLessThanOrEqual(zoom.width);
  const accessibility = await new AxeBuilder({ page }).include('main').analyze();
  expect(
    accessibility.violations.filter((violation) =>
      ['critical', 'serious'].includes(violation.impact ?? '')
    )
  ).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath('workplace-team-320-text-200.png'),
    fullPage: true,
  });
});

test('team plan conflicts preserve input and require a fresh version before another write', async ({
  page,
}) => {
  const fixture = await mockCollaboration(page, true);
  await page.goto('/workplace/home?view=team');
  await selectRemotePlan(page);
  await page.getByTestId('workplace-team-save-plan').click();
  await expect.poll(() => fixture.plans.length).toBe(1);
  await expect(page.getByTestId('workplace-team-save-plan')).toBeDisabled();
  expect(fixture.overviewReads()).toBe(1);
  await page.getByRole('alert').getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByTestId('workplace-team-save-plan')).toBeEnabled();
  await page.getByTestId('workplace-team-save-plan').click();
  await expect.poll(() => fixture.plans.length).toBe(2);
  expect(fixture.plans[1]).toMatchObject({ mode: 'REMOTE', visibility: 'PRIVATE', version: 5 });
});

test('team displays returned persisted own and shared work plans with explicit planned-data context', async ({
  page,
}, testInfo) => {
  await mockCollaboration(page, false, true);
  await page.goto('/workplace/home?view=team');
  await expect(
    page.getByTestId('workplace-team-plan-form').getByRole('combobox').first()
  ).toContainText('Remote');
  await expect(
    page
      .getByText('Fixture colleague with a shared plan', { exact: true })
      .filter({ visible: true })
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Shared work plans', exact: true })).toBeVisible();
  await expect(page.getByTestId('workplace-team-sharing-form').getByRole('switch')).toBeChecked();
  for (const width of [1440, 1280, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    const sidebar =
      width >= 1280 ? await page.locator('aside[id$="-desktop-navigation"]').boundingBox() : null;
    await expect
      .poll(async () => Math.round((await page.locator('main').boundingBox())?.x ?? -1))
      .toBe(Math.round(sidebar?.width ?? 0));
    await expect(
      page
        .getByText('Fixture colleague with a shared plan', { exact: true })
        .filter({ visible: true })
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width
    );
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      window.scrollTo(0, 0);
    });
    await page.screenshot({
      path: testInfo.outputPath(`workplace-team-returned-data-${width}-loaded.png`),
      fullPage: true,
    });
  }
});

test('the desktop colleague-day matrix maps only returned public plans and removes all rows after authoritative denial', async ({
  page,
}, testInfo) => {
  const fixture = await mockCollaboration(page, false, true);
  const base = fixture.overview.sharedPlans[0];
  if (!base) throw new Error('A returned shared work plan is required');
  fixture.overview.sharedPlans = [
    {
      ...base,
      planId: '50000000-0000-0000-0000-000000000011',
      userId: 12,
      displayName: 'Shared colleague A',
      planDate: '2026-08-17',
      mode: 'REMOTE',
    },
    {
      ...base,
      planId: '50000000-0000-0000-0000-000000000012',
      userId: 12,
      displayName: 'Shared colleague A',
      planDate: '2026-08-19',
      mode: 'OFFICE',
    },
    {
      ...base,
      planId: '50000000-0000-0000-0000-000000000013',
      userId: 13,
      displayName: '공유 계획을 등록한 긴 이름의 동료 B',
      planDate: '2026-08-18',
      mode: 'OFF',
    },
    {
      ...base,
      planId: '50000000-0000-0000-0000-000000000014',
      userId: 13,
      displayName: '공유 계획을 등록한 긴 이름의 동료 B',
      planDate: '2026-08-23',
      mode: 'REMOTE',
    },
    {
      ...base,
      planId: '50000000-0000-0000-0000-000000000015',
      userId: 99,
      displayName: 'Private colleague must stay hidden',
      planDate: '2026-08-19',
      visibility: 'PRIVATE',
    },
    {
      ...base,
      planId: '50000000-0000-0000-0000-000000000016',
      userId: 100,
      displayName: 'Unverified presence must stay hidden',
      planDate: '2026-08-19',
      source: 'ACTUAL_PRESENCE' as 'WORK_PLAN',
    },
    {
      ...base,
      planId: '50000000-0000-0000-0000-000000000017',
      userId: 101,
      displayName: 'Another week must stay hidden',
      planDate: '2026-08-24',
    },
  ];
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/workplace/home?view=team');
  const matrix = page.getByRole('table', { name: 'Shared colleague plans by day', exact: true });
  await expect(matrix).toBeVisible();
  await expect(matrix.getByRole('row')).toHaveCount(3);
  await expect(matrix.getByRole('columnheader')).toHaveCount(7);
  await expect(matrix.getByRole('columnheader').nth(1)).toHaveText('Mon, 8/17');
  await expect(matrix.getByRole('columnheader').nth(6)).toHaveText('Sun, 8/23');
  const first = matrix
    .getByRole('row')
    .filter({ has: page.getByRole('rowheader', { name: 'Shared colleague A', exact: true }) });
  await expect(first.getByRole('cell').nth(0)).toHaveText('Remote');
  await expect(first.getByRole('cell').nth(1)).toHaveText('No shared plan');
  await expect(first.getByRole('cell').nth(2)).toHaveText('Office');
  const second = matrix.getByRole('row').filter({
    has: page.getByRole('rowheader', {
      name: '공유 계획을 등록한 긴 이름의 동료 B',
      exact: true,
    }),
  });
  await expect(second.getByRole('cell').nth(1)).toHaveText('Off');
  await expect(second.getByRole('cell').nth(5)).toHaveText('Remote');
  for (const hidden of [
    'Private colleague must stay hidden',
    'Unverified presence must stay hidden',
    'Another week must stay hidden',
  ])
    await expect(page.getByText(hidden, { exact: true })).toHaveCount(0);
  for (const width of [1440, 1280, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    const sidebar =
      width >= 1280 ? await page.locator('aside[id$="-desktop-navigation"]').boundingBox() : null;
    await expect
      .poll(async () => Math.round((await page.locator('main').boundingBox())?.x ?? -1))
      .toBe(Math.round(sidebar?.width ?? 0));
    if (width >= 1280) await expect(matrix).toBeVisible();
    else {
      await expect(matrix).toBeHidden();
      await expect(
        page.getByRole('listitem').filter({ hasText: 'Shared colleague A' })
      ).toHaveCount(2);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width
    );
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      window.scrollTo(0, 0);
    });
    await page.screenshot({
      path: testInfo.outputPath(`workplace-team-matrix-${width}-loaded.png`),
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 1280, height: 1000 });
  const axe = await new AxeBuilder({ page }).include('main').analyze();
  expect(
    axe.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))
  ).toEqual([]);
  await page.route('**/api/platform/v1/workplace/experience/collaboration/overview*', (route) =>
    route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: '{"success":false,"message":"Sharing access was revoked."}',
    })
  );
  // Advance the configured native read interval; a focus event alone does not make a fresh read stale.
  await page.clock.fastForward(60_001);
  await expect(
    page.getByRole('table', { name: 'Shared colleague plans by day', exact: true })
  ).toHaveCount(0, { timeout: 10_000 });
  await expect(page.getByText('Shared colleague A', { exact: true })).toHaveCount(0);
  await expect(page.getByText('공유 계획을 등록한 긴 이름의 동료 B', { exact: true })).toHaveCount(
    0
  );
});
