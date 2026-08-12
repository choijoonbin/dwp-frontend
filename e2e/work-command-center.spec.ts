import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { WORKSPACE_QUEUE_FIXTURE } from './support/runtime-access';
import { fulfillSuccess, mockShellSession } from './support/shell-session';

import type { Page, Route } from '@playwright/test';

type QueueItem = (typeof WORKSPACE_QUEUE_FIXTURE.items)[number];

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
  let items: QueueItem[] = WORKSPACE_QUEUE_FIXTURE.items.map((item) => ({ ...item }));

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
  await page.goto('/work');

  await expect(page.getByText('4 active sources')).toBeVisible();
  await page
    .getByRole('row', { name: /WK-1042/ })
    .getByRole('checkbox')
    .check();
  await page
    .getByRole('row', { name: /WK-1043/ })
    .getByRole('checkbox')
    .check();
  await expect(page.getByText('2 work items selected')).toBeVisible();

  await page.getByRole('button', { name: 'Complete selected' }).click();
  const dialog = page.getByRole('dialog', { name: 'Complete selected work?' });
  await expect(dialog).toContainText(
    'Mark 2 selected work items complete. Completed work cannot be reopened from this queue.'
  );
  await dialog.getByRole('button', { name: 'Complete selected' }).click();

  await expect(page.getByText('2 work items were updated.')).toBeVisible();
  await expect(page.getByText('2 work items selected')).toHaveCount(0);
  await expect(page.getByRole('row', { name: /WK-1042/ })).toContainText('Completed');
  await expect(page.getByRole('row', { name: /WK-1043/ })).toContainText('Completed');

  const accessibility = await new AxeBuilder({ page }).include('main').analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
});

test('work batch updates preserve the selection when an optimistic version conflicts', async ({
  page,
}) => {
  await mockWorkQueue(page, true);
  await page.goto('/work');

  await page
    .getByRole('row', { name: /WK-1042/ })
    .getByRole('checkbox')
    .check();
  await page.getByRole('button', { name: 'Start selected' }).click();
  const dialog = page.getByRole('dialog', { name: 'Start selected work?' });
  await dialog.getByRole('button', { name: 'Start selected' }).click();

  await expect(
    page.getByText(
      'The selected work could not be updated. Refresh the queue and review any version conflicts.'
    )
  ).toBeVisible();
  await expect(dialog).toBeVisible();
  await expect(page.getByText('1 work items selected')).toBeVisible();
});
