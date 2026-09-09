import { expect, test } from '@playwright/test';

import { mockApprovalProductSurfaceAuthority } from './support/product-surface-authority';
import { WORKSPACE_QUEUE_FIXTURE } from './support/runtime-access';
import { fulfillSuccess, mockShellSession } from './support/shell-session';
import {
  mockWorkHubFoundation,
  WORK_HUB_FIXTURE as fixture,
} from './support/work-hub-foundation-fixtures';

import type { Page, Route } from '@playwright/test';

type SourceReadKey =
  | 'workspace'
  | 'approval-inbox'
  | 'approval-completed'
  | 'approval-needs-info'
  | 'services'
  | 'personal';

const emptySourceReads = (): Record<SourceReadKey, number> => ({
  workspace: 0,
  'approval-inbox': 0,
  'approval-completed': 0,
  'approval-needs-info': 0,
  services: 0,
  personal: 0,
});

function sourceReadKey(rawUrl: string): SourceReadKey | null {
  const url = new URL(rawUrl);
  if (url.pathname === '/api/platform/v1/workspace/work-items') return 'workspace';
  if (url.pathname === '/api/approvals/v1/tasks')
    return url.searchParams.get('view') === 'COMPLETED' ? 'approval-completed' : 'approval-inbox';
  if (url.pathname === '/api/approvals/v1/requests') return 'approval-needs-info';
  if (url.pathname === '/api/platform/v1/services/requests') return 'services';
  if (url.pathname === '/api/platform/v1/workspace/work-hub/personal-tasks') return 'personal';
  return null;
}

async function openSourceStatus(page: Page) {
  const direct = page.getByRole('button', { name: 'Source status', exact: true });
  if (await direct.isVisible()) {
    await direct.click();
  } else {
    await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
    await page.getByRole('button', { name: 'Source connections', exact: true }).click();
  }
  const dialog = page.getByRole('dialog', { name: 'Work source status', exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}

test('a source-scoped refresh reads only that owner and preserves neighbouring projections', async ({
  page,
}) => {
  const reads = emptySourceReads();
  let emptyService = false;
  await mockWorkHubFoundation(page, { nativeWorkspace: true });
  page.on('request', (request) => {
    if (request.method() !== 'GET') return;
    const key = sourceReadKey(request.url());
    if (key) reads[key] += 1;
  });
  await page.route('**/api/platform/v1/services/requests*', async (route) => {
    const request = route.request();
    if (
      request.method() !== 'GET' ||
      new URL(request.url()).pathname !== '/api/platform/v1/services/requests' ||
      !emptyService
    )
      return route.fallback();
    return fulfillSuccess(route, []);
  });

  await page.goto('/work/queue');
  await expect(
    page.getByRole('button', { name: `Open details for ${fixture.serviceTitle}`, exact: true })
  ).toBeVisible({ timeout: 20_000 });
  const dialog = await openSourceStatus(page);
  const before = { ...reads };
  emptyService = true;

  const retryService = dialog.getByRole('button', {
    name: 'Refresh Service requests',
    exact: true,
  });
  await retryService.click();
  await expect.poll(() => reads.services).toBe(before.services + 1);
  await expect(retryService).toBeEnabled();
  expect(reads).toEqual({ ...before, services: before.services + 1 });

  await dialog.getByRole('button', { name: 'Close', exact: true }).last().click();
  await expect(
    page.getByRole('button', { name: `Open details for ${fixture.serviceTitle}`, exact: true })
  ).toHaveCount(0);
  for (const title of [fixture.personalTitle, fixture.approvalTitle, fixture.workspaceTitle]) {
    await expect(
      page.getByRole('button', { name: `Open details for ${title}`, exact: true })
    ).toBeVisible();
  }
});

test('source status owner links navigate to each contracted source route', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'The route ownership contract runs once.');
  await mockWorkHubFoundation(page);
  await mockApprovalProductSurfaceAuthority(page);

  for (const path of [
    '/approvals/inbox',
    '/approvals/completed',
    '/approvals/requests/needs-info',
    '/services/my',
  ]) {
    await page.goto('/work/queue?panel=sources');
    const dialog = page.getByRole('dialog', { name: 'Work source status', exact: true });
    await expect(dialog).toBeVisible({ timeout: 20_000 });
    const link = dialog.locator(`a[href="${path}"]`);
    await expect(link).toHaveAccessibleName('Open source app');
    await link.click();
    await expect(page).toHaveURL((url) => url.pathname === path);
  }
});

type QueueItem = Omit<(typeof WORKSPACE_QUEUE_FIXTURE.items)[number], 'type' | 'sourceSystem'> & {
  type: string;
  sourceSystem: string;
  capabilities: { canStart: boolean; canComplete: boolean; canWait: boolean };
};

type CurrentReviewState = 'current' | 'missing' | 'forbidden';

function queueSummary(items: QueueItem[]) {
  return {
    total: items.length,
    dueSoon: items.filter((item) => item.status === 'DUE_SOON').length,
    inProgress: items.filter((item) => item.status === 'IN_PROGRESS').length,
    waiting: items.filter((item) => item.status === 'WAITING').length,
    completed: items.filter((item) => item.status === 'COMPLETED').length,
  };
}

async function mockConflictBatch(page: Page, reviewState: CurrentReviewState) {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'en',
    displayName: 'Mina Kim',
    appearance: { mode: 'light', density: 'standard', highContrast: false, reduceMotion: true },
  });
  let conflicted = false;
  let workspaceReads = 0;
  const selectedId = WORKSPACE_QUEUE_FIXTURE.items[0].workItemId;
  const currentTitle = `${WORKSPACE_QUEUE_FIXTURE.items[0].title} (current)`;
  let items: QueueItem[] = WORKSPACE_QUEUE_FIXTURE.items.map((item) => ({
    ...item,
    type: 'TASK',
    sourceSystem: 'WORKSPACE',
    capabilities: {
      canStart: item.status !== 'IN_PROGRESS' && item.status !== 'COMPLETED',
      canComplete: item.status !== 'COMPLETED',
      canWait: item.status !== 'COMPLETED',
    },
  }));

  await page.route('**/api/platform/v1/workspace/work-hub/personal-tasks*', (route) =>
    fulfillSuccess(route, { items: [], page: 0, size: 100, totalElements: 0, hasMore: false })
  );
  await page.route('**/api/approvals/v1/tasks*', (route) => fulfillSuccess(route, []));
  await page.route('**/api/approvals/v1/requests*', (route) => fulfillSuccess(route, []));
  await page.route('**/api/platform/v1/services/requests*', (route) => fulfillSuccess(route, []));
  await page.route('**/api/platform/v1/workspace/work-items', (route) => {
    workspaceReads += 1;
    if (conflicted && reviewState === 'forbidden')
      return route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ERROR', message: 'Workspace access was revoked' }),
      });
    const visible =
      conflicted && reviewState === 'missing'
        ? items.filter((item) => item.workItemId !== selectedId)
        : items;
    return fulfillSuccess(route, {
      summary: queueSummary(visible),
      items: visible,
      generatedAt: '2026-09-08T07:00:00Z',
    });
  });
  await page.route('**/api/platform/v1/workspace/work-items/batch/status', (route: Route) => {
    conflicted = true;
    if (reviewState === 'current') {
      items = items.map((item) =>
        item.workItemId === selectedId
          ? { ...item, title: currentTitle, version: item.version + 1 }
          : item
      );
    }
    return route.fulfill({
      status: 409,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ERROR', code: 'E1009', message: 'Version conflict' }),
    });
  });

  return {
    currentTitle,
    get workspaceReads() {
      return workspaceReads;
    },
  };
}

async function openConflictedBatch(page: Page) {
  await page.goto('/work/queue');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Unified work inbox', exact: true })
  ).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Select work', exact: true }).click();
  await page
    .getByRole('checkbox', {
      name: 'Select Approve software access request for batch processing',
      exact: true,
    })
    .check();
  await page.getByRole('button', { name: 'Start selected', exact: true }).click();
  const review = page.getByRole('dialog', { name: 'Start the selected work?', exact: true });
  await review.getByRole('button', { name: 'Start selected', exact: true }).click();
  const result = page.getByRole('dialog', { name: 'Batch results', exact: true });
  await expect(result.getByText('Version conflict 1', { exact: true })).toBeVisible();
  return result;
}

test('batch conflict review reads again and opens the current source item', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'The current-item recovery contract runs once.');
  const runtime = await mockConflictBatch(page, 'current');
  const result = await openConflictedBatch(page);
  const readsBeforeReview = runtime.workspaceReads;

  await result
    .getByRole('button', {
      name: `Review current work: ${runtime.currentTitle}`,
      exact: true,
    })
    .click();

  await expect.poll(() => runtime.workspaceReads).toBeGreaterThan(readsBeforeReview);
  await expect(result).toHaveCount(0);
  await expect(
    page.getByRole('article').getByRole('heading', { name: runtime.currentTitle, exact: true })
  ).toBeVisible();
});

for (const reviewState of ['missing', 'forbidden'] as const) {
  test(`batch conflict review fails closed when current work is ${reviewState}`, async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'The fail-closed recovery contract runs once.');
    const runtime = await mockConflictBatch(page, reviewState);
    const result = await openConflictedBatch(page);
    const readsBeforeReview = runtime.workspaceReads;

    await result
      .getByRole('button', {
        name: 'Review current work: Approve software access request',
        exact: true,
      })
      .click();

    await expect.poll(() => runtime.workspaceReads).toBeGreaterThan(readsBeforeReview);
    await expect(result).toContainText(
      'Current work could not be verified. Check the source status and access, then try again.'
    );
    await expect(
      page
        .getByRole('article')
        .getByRole('heading', { name: 'Approve software access request', exact: true })
    ).toHaveCount(0);
  });
}
