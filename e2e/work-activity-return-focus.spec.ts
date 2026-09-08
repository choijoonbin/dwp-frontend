import { expect, test } from '@playwright/test';

import { DEFAULT_APP_PERMISSIONS } from './support/runtime-access';
import { fulfillSuccess } from './support/shell-session';
import {
  mockWorkHubFoundation,
  personalTaskRoute,
  WORK_HUB_FIXTURE as work,
} from './support/work-hub-foundation-fixtures';

import type { Page } from '@playwright/test';

const postgresWorkItemId = '10420000-0000-0000-0000-000000000001';

type WorkSecurity = {
  activityRevoked: boolean;
  permissionReads: number;
  roles: string[];
  userId: number;
  userReads: number;
  version: number;
};

async function mockNativeWorkItem(page: Page, security: WorkSecurity) {
  await page.route('**/api/platform/v1/workspace/work-items', (route) =>
    fulfillSuccess(route, {
      summary: { total: 1, dueSoon: 0, inProgress: 1, waiting: 0, completed: 0 },
      items: [
        {
          workItemId: postgresWorkItemId,
          id: 'WK-2026-0904-001',
          title: work.workspaceTitle,
          summary: 'A PostgreSQL-backed native task with governed Activity history.',
          type: 'TASK',
          priority: 'MEDIUM',
          status: 'IN_PROGRESS',
          owner: 'Mina Kim',
          sourceSystem: 'WORKSPACE',
          sourceReference: null,
          sourceRoute: null,
          reason: null,
          version: security.version,
          updatedAt: '2026-09-04T00:00:00Z',
          capabilities: { canStart: true, canComplete: true, canWait: true },
        },
      ],
      generatedAt: '2026-09-07T08:01:00Z',
    })
  );
}

async function mockActivityShell(page: Page) {
  const coverage = {
    supportedObjectTypes: ['WORK_ITEM'],
    excludedProvenance: ['SAMPLE', 'QUARANTINED'],
    includesLegacy: true,
    includesUsage: false,
    sourceScope: 'WORKSPACE',
  };
  await page.route('**/api/agent/v1/activity/**', (route) => {
    const summary = new URL(route.request().url()).pathname.endsWith('/executions/summary');
    return route.fulfill({
      json: {
        data: summary
          ? {
              total: 0,
              running: 0,
              needsInput: 0,
              policyBlocked: 0,
              completed: 0,
              failed: 0,
              cancelled: 0,
              unknown: 0,
              generatedAt: '2026-09-07T08:01:00Z',
              coverage: { ...coverage, supportedObjectTypes: [], sourceScope: 'DWAI_ON' },
            }
          : {
              events: [],
              generatedAt: '2026-09-07T08:01:00Z',
              snapshotAt: '2026-09-07T08:01:00Z',
              coverage: { ...coverage, supportedObjectTypes: [], sourceScope: 'DWAI_ON' },
              hasMore: false,
              nextCursor: null,
              startCursor: null,
            },
      },
    });
  });
  await page.route('**/api/platform/v1/workspace/activity**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/sources/status')) {
      return route.fulfill({
        json: { data: { observedAt: '2026-09-07T08:01:00Z', sources: [] } },
      });
    }
    if (path.endsWith('/executions/summary')) {
      return route.fulfill({
        json: {
          data: {
            total: 0,
            running: 0,
            needsInput: 0,
            policyBlocked: 0,
            completed: 0,
            failed: 0,
            cancelled: 0,
            unknown: 0,
            generatedAt: '2026-09-07T08:01:00Z',
            coverage,
          },
        },
      });
    }
    return route.fulfill({
      json: {
        data: {
          events: [],
          generatedAt: '2026-09-07T08:01:00Z',
          snapshotAt: '2026-09-07T08:01:00Z',
          coverage,
          hasMore: false,
          nextCursor: null,
          startCursor: null,
        },
      },
    });
  });
}

async function mockMutableSecurity(page: Page, security: WorkSecurity) {
  await page.route('**/api/auth/permissions', (route) => {
    security.permissionReads += 1;
    return fulfillSuccess(
      route,
      DEFAULT_APP_PERMISSIONS.filter(
        (permission) => !security.activityRevoked || permission.resourceKey !== 'APP.ACTIVITY'
      )
    );
  });
  await page.route('**/api/auth/me', (route) => {
    security.userReads += 1;
    return fulfillSuccess(route, {
      userId: security.userId,
      personPublicId: `person-${security.userId}`,
      displayName: 'Mina Kim',
      jobTitle: 'Tenant administrator',
      email: `user-${security.userId}@dwp.local`,
      tenantId: 1,
      tenantCode: 'default',
      tenantName: 'SKAX',
      identityPlane: 'TENANT',
      preferredLocale: 'en',
      tenantDefaultLocale: 'en',
      roles: security.roles,
      groups: [],
      resourceRoles: [],
    });
  });
}

async function setup(page: Page) {
  const security: WorkSecurity = {
    activityRevoked: false,
    permissionReads: 0,
    roles: ['WORKSPACE_MEMBER'],
    userId: 1,
    userReads: 0,
    version: 1,
  };
  const runtime = await mockWorkHubFoundation(page, { nativeWorkspace: true });
  await mockNativeWorkItem(page, security);
  await mockActivityShell(page);
  await mockMutableSecurity(page, security);
  return { runtime, security };
}

async function openActivity(page: Page) {
  await page.goto('/work/queue?q=verified');
  await page
    .getByRole('button', { name: `Open details for ${work.workspaceTitle}`, exact: true })
    .click();
  const heading = page.getByRole('heading', { name: work.workspaceTitle, exact: true });
  await expect(heading).toBeVisible();
  const returnTo = `${new URL(page.url()).pathname}${new URL(page.url()).search}`;
  await page.locator('[data-work-activity-trigger]').click();
  await expect(page).toHaveURL(
    (url) =>
      url.pathname === '/activity/timeline' &&
      url.searchParams.get('objectType') === 'WORK_ITEM' &&
      url.searchParams.get('objectId') === postgresWorkItemId
  );
  await expect(page.getByRole('heading', { name: 'Activity', exact: true })).toBeVisible();
  return returnTo;
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
  ).toBeLessThanOrEqual(1);
}

for (const viewport of [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
  { width: 320, height: 568 },
]) {
  test(`${viewport.width}px browser back restores exact Work Activity trigger focus`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    const { runtime } = await setup(page);
    const returnTo = await openActivity(page);
    const reads = runtime.personalReads;

    await page.goBack();

    await expect(page).toHaveURL((url) => `${url.pathname}${url.search}${url.hash}` === returnTo);
    await expect(
      page.getByRole('heading', { name: work.workspaceTitle, exact: true })
    ).toBeVisible();
    await expect(page.locator('[data-work-activity-trigger]')).toBeFocused();
    expect(runtime.personalReads).toBeGreaterThan(reads);
    await expectNoHorizontalOverflow(page);
    await page.screenshot({
      path: testInfo.outputPath(`activity-return-focus-${viewport.width}.png`),
      fullPage: true,
    });
  });
}

test('a 20KB+ owner scope preserves the governed Activity handoff and return focus', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { security } = await setup(page);
  security.roles = Array.from(
    { length: 240 },
    (_, index) => `JOONBIN_SCOPE_${index}_${'x'.repeat(80)}`
  );
  expect(JSON.stringify(security.roles).length).toBeGreaterThan(20_000);

  const returnTo = await openActivity(page);
  await page.goBack();

  await expect(page).toHaveURL((url) => `${url.pathname}${url.search}${url.hash}` === returnTo);
  await expect(page.locator('[data-work-activity-trigger]')).toBeFocused();
});

test('an APP.ACTIVITY revoke consumes the return intent without focus or re-navigation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { security } = await setup(page);
  const returnTo = await openActivity(page);
  const permissionReads = security.permissionReads;
  security.activityRevoked = true;
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect.poll(() => security.permissionReads).toBeGreaterThan(permissionReads);

  await page.goBack();

  await expect(page).toHaveURL((url) => `${url.pathname}${url.search}${url.hash}` === returnTo);
  await expect(page.locator('[data-work-activity-trigger]')).toHaveCount(0);
  await expect(page).toHaveURL((url) => url.pathname.startsWith('/work/'));
});

test('a tenant user switch consumes the previous owner focus intent', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { security } = await setup(page);
  const returnTo = await openActivity(page);
  const userReads = security.userReads;
  security.userId = 2;
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect.poll(() => security.userReads).toBeGreaterThan(userReads);

  await page.goBack();

  await expect(page).toHaveURL((url) => `${url.pathname}${url.search}${url.hash}` === returnTo);
  const trigger = page.locator('[data-work-activity-trigger]');
  await expect(trigger).toBeVisible();
  await expect(trigger).not.toBeFocused();
});

test('a refreshed item version consumes stale focus intent', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  const { security } = await setup(page);
  const returnTo = await openActivity(page);
  security.version += 1;

  await page.goBack();

  await expect(page).toHaveURL((url) => `${url.pathname}${url.search}${url.hash}` === returnTo);
  const trigger = page.locator('[data-work-activity-trigger]');
  await expect(trigger).toBeVisible();
  await expect(trigger).not.toBeFocused();
});

test('a different selected item consumes the prior Activity intent without navigation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await setup(page);
  await openActivity(page);
  const otherWork = personalTaskRoute(work.secondaryPersonalId);

  await page.goto(otherWork);

  await expect(page).toHaveURL(otherWork);
  await expect(page.getByRole('heading', { name: work.secondaryTitle, exact: true })).toBeVisible();
  await expect(page.locator('[data-work-activity-trigger]')).toHaveCount(0);
  await page.waitForTimeout(100);
  await expect(page).toHaveURL(otherWork);
});
