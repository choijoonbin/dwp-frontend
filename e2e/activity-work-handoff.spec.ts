import { expect, test } from '@playwright/test';

import {
  mockWorkHubFoundation,
  WORK_HUB_FIXTURE as work,
} from './support/work-hub-foundation-fixtures';
import {
  FULL_PRODUCT_PERMISSIONS,
  fulfillSuccess,
  mockShellSession,
} from './support/shell-session';

import type { Page } from '@playwright/test';

const activityEventId = 'a3333333-3333-3333-8333-333333333333';
const activityTitle = 'Verified workspace handover completed';
// Platform stores opaque identifiers in PostgreSQL uuid columns and does not promise RFC bits.
const postgresWorkItemId = '10420000-0000-0000-0000-000000000001';
const workDisplayId = 'ACTIVITY-LOCAL-01';
const highPrivilegePermissions = FULL_PRODUCT_PERMISSIONS;
const highPrivilegeResourceRoles = Array.from({ length: 8 }, (_, index) => ({
  responsibilityCode: 'TENANT_PRODUCT_ADMIN',
  resourceType: 'APP',
  resourceKey: `APP.GOVERNED_PRODUCT_${index.toString().padStart(3, '0')}`,
  resourceSetId: `resource-set-${index.toString().padStart(3, '0')}`,
  resourceSetKey: `APP.GOVERNED_PRODUCT_${index.toString().padStart(3, '0')}`,
}));
const serializedHighPrivilegeOwner = JSON.stringify({
  identity: ['TENANT', 1, 900018, 'person-joonbin-sk'],
  roles: ['WORKSPACE_MEMBER'],
  groups: [],
  resourceRoles: highPrivilegeResourceRoles.map((role) => JSON.stringify(role)).sort(),
  legacyRoleFallbackAllowed: false,
  permissions: highPrivilegePermissions.map((permission) => JSON.stringify(permission)).sort(),
});

async function mockHighPrivilegeWorkSession(page: Page) {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    userId: 900018,
    personPublicId: 'person-joonbin-sk',
    displayName: 'Joonbin Choi',
    email: 'joonbin@sk.com',
    permissions: highPrivilegePermissions,
    resourceRoles: highPrivilegeResourceRoles,
  });
}

async function mockPostgresNativeWorkItem(page: Page) {
  await page.route('**/api/platform/v1/workspace/work-items', (route) =>
    fulfillSuccess(route, {
      summary: { total: 1, dueSoon: 0, inProgress: 1, waiting: 0, completed: 0 },
      items: [
        {
          workItemId: postgresWorkItemId,
          id: workDisplayId,
          title: work.workspaceTitle,
          summary: 'A PostgreSQL-backed native task with an opaque canonical UUID.',
          type: 'TASK',
          priority: 'MEDIUM',
          status: 'IN_PROGRESS',
          owner: 'Mina Kim',
          sourceSystem: 'DWP_WORKSPACE',
          sourceReference: null,
          sourceRoute: null,
          reason: null,
          version: 1,
          updatedAt: '2026-09-04T00:00:00Z',
          capabilities: { canStart: true, canComplete: true, canWait: true },
        },
      ],
      generatedAt: '2026-09-07T08:01:00Z',
    })
  );
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
  ).toBeLessThanOrEqual(1);
}

async function mockWorkActivityLedger(page: Page) {
  const requests: URL[] = [];
  const coverage = {
    supportedObjectTypes: ['WORK_ITEM'],
    excludedProvenance: ['SAMPLE', 'QUARANTINED'],
    includesLegacy: true,
    includesUsage: false,
    sourceScope: 'WORKSPACE',
  };
  const event = {
    id: activityEventId,
    occurredAt: '2026-09-07T08:00:00Z',
    actor: 'PERSON',
    actorName: 'Mina Kim',
    state: 'COMPLETED',
    title: activityTitle,
    summary: 'The exact native Work item was completed and linked to its audit receipt.',
    objectType: 'WORK_ITEM',
    objectId: postgresWorkItemId,
    objectLabel: work.workspaceTitle,
    source: 'DWP Workspace',
    sourceAccess: 'AVAILABLE',
    sourceRoute: `/work?item=${workDisplayId}`,
    eventKind: 'CHANGE',
    workStatus: 'COMPLETED',
    dataProvenance: 'LIVE',
    auditStatus: 'LEGACY_UNLINKED',
    auditRecordId: null,
    auditId: null,
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
    const url = new URL(route.request().url());
    requests.push(url);
    if (url.pathname.endsWith('/sources/status')) {
      return route.fulfill({
        json: { data: { observedAt: '2026-09-07T08:01:00Z', sources: [] } },
      });
    }
    if (url.pathname.endsWith('/evidence')) {
      return route.fulfill({ status: 404, json: { errorCode: 'RESOURCE_NOT_FOUND' } });
    }
    if (url.pathname.endsWith('/executions/summary')) {
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
    if (url.pathname.includes('/events/')) return route.fulfill({ json: { data: event } });
    const exactWorkScope =
      url.searchParams.get('objectType') === 'WORK_ITEM' &&
      url.searchParams.get('objectId') === postgresWorkItemId;
    return route.fulfill({
      json: {
        data: {
          events: exactWorkScope ? [event] : [],
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
  return requests;
}

for (const viewport of [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
  { width: 320, height: 568 },
]) {
  test(`${viewport.width}px Work and Activity preserve an exact governed handoff`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await mockWorkHubFoundation(page, { nativeWorkspace: true });
    await mockHighPrivilegeWorkSession(page);
    await mockPostgresNativeWorkItem(page);
    const activityRequests = await mockWorkActivityLedger(page);
    expect(serializedHighPrivilegeOwner.length).toBeGreaterThan(16_384);

    await page.goto('/work/queue?q=verified');
    const opener = page.getByRole('button', {
      name: `Open details for ${work.workspaceTitle}`,
      exact: true,
    });
    await opener.click();
    const detailHeading = page.getByRole('heading', { name: work.workspaceTitle, exact: true });
    await expect(detailHeading).toBeVisible();
    const workUrl = page.url();
    const activity = page.getByRole('button', { name: 'Activity for this work', exact: true });
    await expect(activity).toBeVisible();
    await activity.focus();
    await activity.click();

    await expect(page).toHaveURL(
      (url) =>
        url.pathname === '/activity/timeline' &&
        url.searchParams.get('objectType') === 'WORK_ITEM' &&
        url.searchParams.get('objectId') === postgresWorkItemId
    );
    await expect(page.getByText(activityTitle, { exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    expect(
      activityRequests.some(
        (url) =>
          url.pathname.endsWith('/activity') &&
          url.searchParams.get('objectType') === 'WORK_ITEM' &&
          url.searchParams.get('objectId') === postgresWorkItemId
      )
    ).toBe(true);

    await page.screenshot({
      path: testInfo.outputPath(`work-activity-postgres-uuid-${viewport.width}.png`),
      fullPage: true,
    });

    await page.goBack();
    await expect(page).toHaveURL(workUrl);
    await expect(detailHeading).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expect(
      page.getByRole('button', { name: 'Activity for this work', exact: true })
    ).toBeFocused();

    await page.getByRole('button', { name: 'Activity for this work', exact: true }).click();
    await page.getByText(activityTitle, { exact: true }).click();
    const signal = page.getByRole('complementary', { name: 'Signal detail' });
    await expect(signal.getByText(activityTitle, { exact: true })).toBeVisible();
    await signal.getByRole('button', { name: 'Open source', exact: true }).click();
    await expect(page).toHaveURL(
      (url) => url.pathname === '/work/queue' && url.searchParams.get('item') === workDisplayId
    );
    await expect(detailHeading).toBeVisible();
    await expectNoHorizontalOverflow(page);
    if (viewport.width < 900) {
      await expect(detailHeading).toBeFocused();
    } else {
      await expect(
        page.locator('#dwp-main-content h1[data-route-focus-target="true"]')
      ).toBeFocused();
    }
  });
}
