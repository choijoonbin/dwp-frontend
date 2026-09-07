import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { WORKSPACE_QUEUE_FIXTURE } from './support/runtime-access';
import { fulfillSuccess, mockShellSession } from './support/shell-session';

import type { Page, Route } from '@playwright/test';

type QueueItem = Omit<(typeof WORKSPACE_QUEUE_FIXTURE.items)[number], 'type' | 'sourceSystem'> & {
  type: string;
  sourceSystem: string;
  capabilities: { canStart: boolean; canComplete: boolean; canWait: boolean };
};

function summary(items: QueueItem[]) {
  return {
    total: items.length,
    dueSoon: items.filter((item) => item.status === 'DUE_SOON').length,
    inProgress: items.filter((item) => item.status === 'IN_PROGRESS').length,
    waiting: items.filter((item) => item.status === 'WAITING').length,
    completed: items.filter((item) => item.status === 'COMPLETED').length,
  };
}

async function mockWorkQueue(page: Page, conflict = false) {
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
  await page.route('**/api/platform/v1/workspace/work-hub/personal-tasks?*', (route) =>
    fulfillSuccess(route, { items: [], page: 0, size: 100, totalElements: 0, hasMore: false })
  );
  await page.route('**/api/approvals/v1/tasks?*', (route) => fulfillSuccess(route, []));
  await page.route('**/api/approvals/v1/requests?*', (route) => fulfillSuccess(route, []));
  await page.route('**/api/platform/v1/services/requests?*', (route) => fulfillSuccess(route, []));

  await page.route('**/api/platform/v1/workspace/work-items', (route) =>
    fulfillSuccess(route, {
      summary: summary(items),
      items,
      generatedAt: '2026-08-12T07:00:00Z',
    })
  );
  await page.route('**/api/platform/v1/workspace/work-items/batch/status', (route: Route) => {
    if (conflict) {
      return route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ERROR', code: 'E1009', message: 'Version conflict' }),
      });
    }
    const payload = route.request().postDataJSON() as {
      status: QueueItem['status'];
      items: Array<{ workItemId: string; version: number }>;
    };
    const selected = new Map(payload.items.map((item) => [item.workItemId, item.version]));
    const updated: QueueItem[] = [];
    items = items.map((item) => {
      const version = selected.get(item.workItemId);
      if (version === undefined) return item;
      const next = { ...item, status: payload.status, version: version + 1 };
      updated.push(next);
      return next;
    });
    return fulfillSuccess(route, updated);
  });
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'en',
    displayName: 'Mina Kim',
    appearance: { mode: 'light', density: 'standard', highContrast: false, reduceMotion: true },
  });
});

test('work operators review and complete a governed multi-item selection', async ({ page }) => {
  await mockWorkQueue(page);
  await page.goto('/work/queue');

  await expect(page.getByRole('heading', { name: '2 verified work items' })).toBeVisible();
  const accessRequest = page.getByRole('checkbox', {
    name: 'Select Approve software access request for batch processing',
    exact: true,
  });
  const briefingNotes = page.getByRole('checkbox', {
    name: 'Select Review customer briefing notes for batch processing',
    exact: true,
  });
  await accessRequest.check();
  await briefingNotes.check();
  await expect(accessRequest).toBeChecked();
  await expect(briefingNotes).toBeChecked();

  await page.getByRole('button', { name: 'Complete selected', exact: true }).click();
  const review = page.getByRole('dialog', { name: 'Complete the selected work?' });
  await expect(review).toContainText('2 selected');
  await expect(review).toContainText('2 to run');
  await expect(review).toContainText('This batch runs in one source.');
  await expect(review).toContainText('Approve software access request');
  await expect(review).toContainText('Review customer briefing notes');
  await review.getByRole('button', { name: 'Complete selected', exact: true }).click();

  const result = page.getByRole('dialog', { name: 'The batch change was confirmed' });
  await expect(result).toContainText('The source confirmed 2 work item changes.');
  await expect(result).toContainText('Approve software access request');
  await expect(result).toContainText('Review customer briefing notes');
  await expect(result.getByText('Change confirmed by the source', { exact: true })).toHaveCount(2);
  await result.getByRole('button', { name: 'Close', exact: true }).last().click();

  const accessibility = await new AxeBuilder({ page }).include('main').analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
});

test('work batch conflicts surface an unknown result and clear stale selection', async ({
  page,
}) => {
  await mockWorkQueue(page, true);
  await page.goto('/work/queue');

  const accessRequest = page.getByRole('checkbox', {
    name: 'Select Approve software access request for batch processing',
    exact: true,
  });
  await accessRequest.check();
  await page.getByRole('button', { name: 'Start selected', exact: true }).click();
  const review = page.getByRole('dialog', { name: 'Start the selected work?' });
  await review.getByRole('button', { name: 'Start selected', exact: true }).click();

  const result = page.getByRole('dialog', { name: 'The batch result could not be confirmed' });
  await expect(result).toContainText('Refresh each source result before issuing a new command.');
  await expect(result).toContainText('Approve software access request');
  await expect(result).toContainText('Result needs verification');
  await result.getByRole('button', { name: 'Close', exact: true }).last().click();
  await expect(accessRequest).not.toBeChecked();
});
