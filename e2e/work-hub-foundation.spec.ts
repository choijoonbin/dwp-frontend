import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import {
  mockWorkHubFoundation,
  personalTaskRoute,
  WORK_HUB_FIXTURE as fixture,
} from './support/work-hub-foundation-fixtures';

import type { Page, TestInfo } from '@playwright/test';

const sourceNotice = 'The source app owns the final state. Opening it does not complete the work.';
const partialNotice =
  'Only verified work is shown. Review each source to understand what may be missing.';
const contractedSourceNames = [
  'DWP work',
  'Assigned work',
  'Personal tasks',
  'Pending approvals',
  'Completed approvals',
  'Information requests',
  'Service requests',
] as const;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const inspector = (page: Page) => page.getByRole('article');
const openWorkButton = (page: Page, title: string) =>
  page.getByRole('button', { name: `Open details for ${title}`, exact: true });

/** Wait for the lazy Work page to mount before checking the interaction itself. */
async function openWorkPage(page: Page, url: string) {
  await page.goto(url);
  await expect(page.getByRole('main').getByRole('heading').first()).toBeVisible({
    timeout: 20_000,
  });
}

async function showWorkList(page: Page) {
  const back = inspector(page).getByRole('button', { name: 'Back to work list', exact: true });
  const list = page.locator('ul[aria-label="Unified work list"]');
  await expect.poll(async () => (await back.isVisible()) || (await list.isVisible())).toBe(true);
  if (await back.isVisible()) {
    await back.click({ timeout: 2_000 }).catch(async (error: unknown) => {
      if (!(await list.isVisible())) throw error;
    });
  }
  await expect(list).toBeVisible();
}

async function openSourceStatus(page: Page) {
  const direct = page.getByRole('button', { name: 'Source status', exact: true });
  if (await direct.isVisible()) {
    await direct.click();
    return;
  }
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await page.getByRole('button', { name: 'Source connections', exact: true }).click();
}

async function expectEveryContractedSourceUnavailable(page: Page) {
  const sourceStatus = page.getByRole('dialog', { name: 'Work source status' });
  await expect(sourceStatus).toBeVisible();
  for (const sourceName of contractedSourceNames) {
    await expect(sourceStatus.getByText(sourceName, { exact: true })).toBeVisible();
  }
  await expect(sourceStatus.getByText('Unavailable', { exact: true })).toHaveCount(
    contractedSourceNames.length
  );
}

async function selectWork(page: Page, title: string) {
  await showWorkList(page);
  await openWorkButton(page, title).click();
  await expect(inspector(page).getByRole('heading', { name: title, exact: true })).toBeVisible();
}

async function expectSelectedStatus(page: Page, status: string) {
  await expect(inspector(page).getByRole('button', { name: status, exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
  ).toBeLessThanOrEqual(1);
}

async function storedBatchReceipt(page: Page) {
  return page.evaluate(() => {
    const value = window.sessionStorage.getItem('dwp.work.batch-report.v3');
    if (!value) return null;
    const report = JSON.parse(value) as {
      receipts?: Array<{ idempotencyKey?: string; reason?: string; state?: string }>;
      schema?: number;
    };
    const receipt = report.receipts?.[0];
    return receipt
      ? {
          idempotencyKey: receipt.idempotencyKey,
          schema: report.schema,
          state: receipt.state,
          ...(receipt.reason ? { reason: receipt.reason } : {}),
        }
      : null;
  });
}

async function capture(page: Page, testInfo: TestInfo, name: string, preserveFocus = false) {
  if (!preserveFocus) {
    await page.evaluate(async () => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      for (const element of document.querySelectorAll('*')) {
        if (element instanceof HTMLElement && element.scrollTop > 0) element.scrollTop = 0;
      }
      window.scrollTo(0, 0);
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      );
    });
  }
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: false, animations: 'disabled' });
  await testInfo.attach(name, { path, contentType: 'image/png' });
  if (!preserveFocus) {
    const fullPath = testInfo.outputPath(`${name}-full.png`);
    await page.screenshot({ path: fullPath, fullPage: true, animations: 'disabled' });
    await testInfo.attach(`${name}-full`, { path: fullPath, contentType: 'image/png' });
  }
}

test('source-owned approval and service detail preserve source ownership', async ({
  page,
}, testInfo) => {
  const runtime = await mockWorkHubFoundation(page);
  await openWorkPage(page, '/work/queue');
  for (const item of [
    {
      title: fixture.approvalTitle,
      path: `/approvals/inbox?task=${fixture.approvalId}`,
      approval: true,
    },
    { title: fixture.serviceTitle, path: `/services/my/${fixture.serviceId}`, approval: false },
  ]) {
    await showWorkList(page);
    const checkbox = page.getByRole('checkbox', {
      name: `Select ${item.title} for batch processing`,
      exact: true,
    });
    await expect(checkbox).toHaveCount(0);
    await selectWork(page, item.title);
    await expect(inspector(page)).toContainText(sourceNotice);
    await expect(inspector(page).getByRole('button', { name: 'Complete' })).toHaveCount(0);
    await expect(inspector(page).getByRole('button', { name: 'Start' })).toHaveCount(0);
    const returnTo = new URL(page.url());
    const expectedReturnTo = `${returnTo.pathname}${returnTo.search}${returnTo.hash}`;
    await inspector(page).getByRole('button', { name: 'Open in source', exact: true }).click();
    await expect(page).toHaveURL((url) => {
      const expected = new URL(item.path, url.origin);
      if (url.pathname !== expected.pathname) return false;
      return item.approval
        ? url.searchParams.get('task') === fixture.approvalId &&
            url.searchParams.get('returnTo') === expectedReturnTo
        : `${url.pathname}${url.search}` === item.path;
    });
    await page.goBack();
  }
  expect(runtime.forbiddenWorkspaceMutations).toEqual([]);
  expect(runtime.mutations).toEqual([]);
  await capture(page, testInfo, 'source-owned-service-return');
});

test('personal start and completion wait for source confirmation with versioned UUID commands', async ({
  page,
}, testInfo) => {
  const runtime = await mockWorkHubFoundation(page);
  await openWorkPage(page, personalTaskRoute());
  await expect(inspector(page)).toContainText(fixture.personalTitle);
  runtime.holdNextMutation();
  await inspector(page).getByRole('button', { name: 'In progress', exact: true }).click();
  await expect.poll(() => runtime.mutations.length).toBe(1);
  await expect(
    inspector(page).getByRole('button', { name: 'In progress', exact: true })
  ).toBeDisabled();
  await expect(page.getByText('The source confirmed the change', { exact: true })).toHaveCount(0);
  expect(runtime.mutations[0]).toMatchObject({
    path: `/api/platform/v1/workspace/work-hub/personal-tasks/${fixture.personalId}/status`,
    body: { version: 4, status: 'IN_PROGRESS' },
  });
  expect(runtime.mutations[0].idempotencyKey).toMatch(uuid);
  runtime.releaseMutation();
  await expectSelectedStatus(page, 'In progress');
  await expect(
    inspector(page).getByRole('button', { name: 'In progress', exact: true })
  ).toBeDisabled();
  await inspector(page).getByRole('button', { name: 'Complete', exact: true }).click();
  await expectSelectedStatus(page, 'Completed');
  expect(runtime.mutations[1]).toMatchObject({
    path: `/api/platform/v1/workspace/work-hub/personal-tasks/${fixture.personalId}/complete`,
    body: { version: 5 },
  });
  expect(runtime.mutations[1].idempotencyKey).toMatch(uuid);
  expect(runtime.mutations[1].idempotencyKey).not.toBe(runtime.mutations[0].idempotencyKey);
  await expect(inspector(page).getByRole('button', { name: 'Complete', exact: true })).toHaveCount(
    0
  );
  expect(runtime.forbiddenWorkspaceMutations).toEqual([]);
  await capture(page, testInfo, 'personal-completion-confirmed');
});

test('partial source failure remains visible when the verified subset is empty', async ({
  page,
}, testInfo) => {
  await mockWorkHubFoundation(page, { personal: false, sourceOwned: false, failServices: true });
  await openWorkPage(page, '/work/queue');
  await expect(page.getByText(partialNotice, { exact: true })).toBeVisible();
  await expect(page.getByText('There is no verified work right now', { exact: true })).toHaveCount(
    0
  );
  await expect(page.getByText('Snapshot verified', { exact: true })).toHaveCount(0);
  await capture(page, testInfo, 'partial-empty-subset');
});

test('an all-source outage cannot masquerade as an empty queue and retains recovery controls', async ({
  page,
}, testInfo) => {
  const runtime = await mockWorkHubFoundation(page, { failAllSources: true });
  await openWorkPage(page, '/work/queue');

  await expect
    .poll(() => runtime.failedSourceReads.length)
    .toBeGreaterThanOrEqual(contractedSourceNames.length);
  await expect(page.getByText('Work could not be loaded', { exact: true })).toBeVisible();
  await expect(page.getByText('There is no verified work right now', { exact: true })).toHaveCount(
    0
  );
  await expect(page.getByText('Snapshot verified', { exact: true })).toHaveCount(0);
  await expect(page.locator('ul[aria-label="Unified work list"]')).toHaveCount(0);
  const unavailable = page.getByRole('alert').filter({ hasText: 'Work could not be loaded' });
  await expect(unavailable.getByRole('button', { name: 'Try again', exact: true })).toBeEnabled();

  await unavailable.getByRole('button', { name: 'Source status', exact: true }).click();
  const sourceStatus = page.getByRole('dialog', { name: 'Work source status' });
  await expectEveryContractedSourceUnavailable(page);
  await expect(
    sourceStatus.getByRole('button', { name: 'Refresh all sources', exact: true })
  ).toBeEnabled();
  await capture(page, testInfo, 'all-sources-unavailable');
});

test('a background refresh outage keeps the verified scope visible as degraded', async ({
  page,
}, testInfo) => {
  const runtime = await mockWorkHubFoundation(page);
  await openWorkPage(page, personalTaskRoute());
  await expect(
    inspector(page).getByRole('heading', { name: fixture.personalTitle, exact: true })
  ).toBeVisible();

  runtime.failFutureReads();
  const retry = page.getByRole('button', { name: 'Try again', exact: true });
  const returnedToList = !(await retry.isVisible());
  if (returnedToList) await showWorkList(page);
  await retry.click();
  await expect
    .poll(() => runtime.failedSourceReads.length)
    .toBeGreaterThanOrEqual(contractedSourceNames.length);
  await expect(
    page.getByRole('alert').getByText('Work sources unavailable', { exact: true })
  ).toBeVisible();
  await expect(page.getByText('Work could not be loaded', { exact: true })).toHaveCount(0);
  await openSourceStatus(page);
  const sourceStatus = page.getByRole('dialog', { name: 'Work source status' });
  await expectEveryContractedSourceUnavailable(page);
  await sourceStatus.getByRole('button', { name: 'Close', exact: true }).click();
  if (returnedToList) await selectWork(page, fixture.personalTitle);
  await expect(
    inspector(page).getByRole('heading', { name: fixture.personalTitle, exact: true })
  ).toBeVisible();
  const mutationsBeforeBlockedCommands = {
    creations: runtime.creations.length,
    mutations: runtime.mutations.length,
    planSaves: runtime.planSaves.length,
    sourceMutations: runtime.sourceMutations.length,
  };
  const complete = inspector(page).getByRole('button', { name: 'Complete', exact: true }).first();
  await expect(complete).toBeDisabled();
  await expect(
    inspector(page).getByRole('button', { name: 'Ask DWAI·ON', exact: true })
  ).toBeDisabled();
  await complete.click({ force: true });
  await showWorkList(page);
  await expect(page.getByRole('button', { name: 'Select work', exact: true })).toBeDisabled();
  const retainedRow = page.locator('li').filter({ hasText: fixture.personalTitle });
  const quickAction = retainedRow.getByRole('button', { name: 'Start', exact: true });
  await expect(quickAction).toBeDisabled();
  await quickAction.click({ force: true });
  expect({
    creations: runtime.creations.length,
    mutations: runtime.mutations.length,
    planSaves: runtime.planSaves.length,
    sourceMutations: runtime.sourceMutations.length,
  }).toEqual(mutationsBeforeBlockedCommands);
  await capture(page, testInfo, 'background-refresh-degraded');
});

test('canonical work links and personal task aliases resolve the requested item', async ({
  page,
}, testInfo) => {
  await mockWorkHubFoundation(page);
  await openWorkPage(page, personalTaskRoute(fixture.secondaryPersonalId));
  await expect(
    inspector(page).getByRole('heading', { name: fixture.secondaryTitle, exact: true })
  ).toBeVisible();
  await expect(
    inspector(page).getByRole('heading', { name: fixture.personalTitle, exact: true })
  ).toHaveCount(0);
  await openWorkPage(page, `/work/queue?personalTaskId=${fixture.personalId}`);
  await expect(
    inspector(page).getByRole('heading', { name: fixture.personalTitle, exact: true })
  ).toBeVisible();
  await capture(page, testInfo, 'canonical-personal-target');
});

test('returning from another app revalidates the queue before a personal command', async ({
  page,
}, testInfo) => {
  const runtime = await mockWorkHubFoundation(page);
  await openWorkPage(page, '/work/queue');
  await selectWork(page, fixture.approvalTitle);
  const reads = runtime.personalReads;
  const workUrl = new URL(page.url());
  const returnTo = `${workUrl.pathname}${workUrl.search}${workUrl.hash}`;
  await inspector(page).getByRole('button', { name: 'Open in source', exact: true }).click();
  await expect(page).toHaveURL(
    (url) =>
      url.pathname === '/approvals/inbox' &&
      url.searchParams.get('task') === fixture.approvalId &&
      url.searchParams.get('returnTo') === returnTo
  );
  await page.getByRole('button', { name: 'Return to work', exact: true }).click();
  await expect(page).toHaveURL((url) => `${url.pathname}${url.search}${url.hash}` === returnTo);
  await expect(
    inspector(page).getByRole('heading', { name: fixture.approvalTitle, exact: true })
  ).toBeVisible();
  await expect(page.locator('[data-work-source-trigger]')).toBeFocused();
  expect(runtime.personalReads).toBeGreaterThan(reads);
  await selectWork(page, fixture.personalTitle);
  await inspector(page).getByRole('button', { name: 'In progress', exact: true }).click();
  await expectSelectedStatus(page, 'In progress');
  expect(runtime.mutations).toHaveLength(1);
  await capture(page, testInfo, 'cached-return-personal-start');
});

test('view-only access exposes no personal mutation action', async ({ page }) => {
  const runtime = await mockWorkHubFoundation(page, { canUpdate: false });
  await openWorkPage(page, personalTaskRoute());
  await expect(inspector(page)).toContainText(fixture.personalTitle);
  await expect(inspector(page).getByRole('button', { name: 'Start', exact: true })).toHaveCount(0);
  await expect(inspector(page).getByRole('button', { name: 'Complete', exact: true })).toHaveCount(
    0
  );
  await expect(
    inspector(page).getByRole('button', { name: 'Schedule work time', exact: true })
  ).toHaveCount(0);
  expect(runtime.mutations).toEqual([]);
});

test('atomic batch review shows targets and item-level confirmed receipts', async ({
  page,
}, testInfo) => {
  const runtime = await mockWorkHubFoundation(page, {
    personal: false,
    sourceOwned: false,
    nativeWorkspace: true,
  });
  await openWorkPage(page, '/work/queue');
  await page.getByRole('button', { name: 'Select work', exact: true }).click();
  await page
    .getByRole('checkbox', {
      name: `Select ${fixture.workspaceTitle} for batch processing`,
      exact: true,
    })
    .check();
  await page.getByRole('button', { name: 'Complete selected', exact: true }).click();

  const review = page.getByRole('dialog', { name: 'Complete the selected work?' });
  await expect(review).toContainText(fixture.workspaceTitle);
  await expect(review).toContainText('1 to run');
  await expect(review).toContainText('Workspace work follows its atomic batch policy.');
  await review.getByRole('button', { name: 'Complete selected', exact: true }).click();

  const result = page.getByRole('dialog', { name: 'Batch results' });
  await expect(result).toContainText(fixture.workspaceTitle);
  await expect(result).toContainText('The source confirmed the update and new version.');
  expect(runtime.batchMutations).toHaveLength(1);
  await capture(page, testInfo, 'batch-confirmed-receipts');
});

test('batch receipts survive all Work views, reload, and source-panel history', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'chromium',
    'The desktop source-panel history contract runs once.'
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockWorkHubFoundation(page, {
    personal: false,
    sourceOwned: false,
    nativeWorkspace: true,
  });
  await openWorkPage(page, '/work/queue');
  await page.getByRole('button', { name: 'Select work', exact: true }).click();
  await page
    .getByRole('checkbox', {
      name: `Select ${fixture.workspaceTitle} for batch processing`,
      exact: true,
    })
    .check();
  await page.getByRole('button', { name: 'Complete selected', exact: true }).click();
  const review = page.getByRole('dialog', { name: 'Complete the selected work?' });
  await review.getByRole('button', { name: 'Complete selected', exact: true }).click();
  const result = page.getByRole('dialog', { name: 'Batch results' });
  await expect(result).toContainText('The source confirmed the update and new version.');
  await result
    .getByRole('button', { name: 'Close', exact: true })
    .filter({ hasText: 'Close' })
    .click();
  const reopen = page.getByRole('button', { name: 'View latest batch results', exact: true });
  await expect(reopen).toBeVisible();

  for (const view of [
    'action-required',
    'day-plan',
    'in-progress',
    'awaiting-response',
    'completed',
  ]) {
    await page.getByTestId('work-sidebar').getByTestId(`work-navigation-item-${view}`).click();
    await expect(page).toHaveURL((url) => url.pathname === `/work/${view}`);
    await expect(reopen).toBeVisible();
  }

  await reopen.click();
  await expect(page.getByRole('dialog', { name: 'Batch results' })).toContainText(
    'The source confirmed the update and new version.'
  );
  await page
    .getByRole('dialog', { name: 'Batch results' })
    .getByRole('button', { name: 'Close', exact: true })
    .filter({ hasText: 'Close' })
    .click();

  await page.reload();
  await expect(page.getByRole('main').getByRole('heading').first()).toBeVisible({
    timeout: 20_000,
  });
  await expect(page).toHaveURL((url) => url.pathname === '/work/completed');
  await expect(reopen).toBeVisible();

  const sourceNavigation = page.getByRole('button', {
    name: 'Source connections',
    exact: true,
  });
  await sourceNavigation.click();
  await expect(page).toHaveURL((url) => url.searchParams.get('panel') === 'sources');
  await expect(page.getByRole('dialog', { name: 'Source status' })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL((url) => !url.searchParams.has('panel'));
  await expect(page.getByRole('dialog', { name: 'Source status' })).toHaveCount(0);
  await expect(reopen).toBeVisible();

  await sourceNavigation.click();
  const sourceStatus = page.getByRole('dialog', { name: 'Source status' });
  await sourceStatus
    .getByRole('button', { name: 'View latest batch results (1)', exact: true })
    .click();
  await expect(page).toHaveURL((url) => !url.searchParams.has('panel'));
  await expect(page.getByRole('dialog', { name: 'Batch results' })).toContainText(
    'The source confirmed the update and new version.'
  );
});

test('an in-flight personal batch keeps its command identity after a Work menu remount', async ({
  page,
}, testInfo) => {
  const runtime = await mockWorkHubFoundation(page);
  runtime.holdNextMutation();
  await openWorkPage(page, '/work/queue');
  await page.getByRole('button', { name: 'Select work', exact: true }).click();
  await page
    .getByRole('checkbox', {
      name: `Select ${fixture.personalTitle} for batch processing`,
      exact: true,
    })
    .check();
  await page.getByRole('button', { name: 'Start selected', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Start the selected work?' })
    .getByRole('button', { name: 'Start selected', exact: true })
    .click();

  await expect.poll(() => runtime.mutations.length).toBe(1);
  const originalKey = runtime.mutations[0]?.idempotencyKey;
  expect(originalKey).toMatch(uuid);
  await expect
    .poll(() => storedBatchReceipt(page))
    .toEqual({
      idempotencyKey: originalKey,
      schema: 3,
      state: 'UNKNOWN',
    });

  // The busy confirmation dialog intentionally owns focus. Dispatching a click on the actual Work
  // navigation control exercises React Router's path transition and the owner-boundary remount.
  const actionRequiredNavigation = page
    .getByTestId('work-sidebar')
    .getByTestId('work-navigation-item-action-required');
  await actionRequiredNavigation.dispatchEvent('click');
  await expect(page).toHaveURL((url) => url.pathname === '/work/action-required');
  await expect(page.getByRole('main').getByRole('heading').first()).toBeVisible();
  await expect
    .poll(() => storedBatchReceipt(page))
    .toEqual({
      idempotencyKey: originalKey,
      reason: 'CANCELLED',
      schema: 3,
      state: 'UNKNOWN',
    });
  runtime.releaseMutation();

  const queueNavigation = page
    .getByTestId('work-sidebar')
    .getByTestId('work-navigation-item-queue');
  await queueNavigation.dispatchEvent('click');
  await expect(page).toHaveURL((url) => url.pathname === '/work/queue');
  const reopen = page.getByRole('button', { name: 'View latest batch results', exact: true });
  await expect(reopen).toBeVisible();
  await reopen.click();

  const result = page.getByRole('dialog', { name: 'Batch results' });
  await expect(result).toContainText(fixture.personalTitle);
  await expect(result.getByText('Unconfirmed', { exact: true }).first()).toBeVisible();
  await expect(result).toContainText(
    'The session changed or this page closed after this request was sent. Check the source status before creating a new request.'
  );
  await expect(
    result.getByRole('button', { name: 'Recheck unconfirmed personal tasks', exact: true })
  ).toHaveCount(0);
  expect(runtime.mutations).toHaveLength(1);
  expect(runtime.mutations[0]?.idempotencyKey).toBe(originalKey);
  await expect
    .poll(() => storedBatchReceipt(page))
    .toEqual({
      idempotencyKey: originalKey,
      reason: 'CANCELLED',
      schema: 3,
      state: 'UNKNOWN',
    });
  await capture(page, testInfo, 'in-flight-personal-batch-route-receipt');
});

test('the route-backed personal task composer closes on browser back', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'The desktop URL history contract runs once.');
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockWorkHubFoundation(page);
  await openWorkPage(page, '/work/queue?q=policy');
  await page
    .getByTestId('work-sidebar')
    .getByRole('button', { name: 'Add personal task', exact: true })
    .click();
  await expect(page).toHaveURL(
    (url) => url.searchParams.get('q') === 'policy' && url.searchParams.get('compose') === 'task'
  );
  await expect(page.getByRole('dialog', { name: 'Add a personal task' })).toBeVisible();

  await page.goBack();

  await expect(page).toHaveURL(
    (url) => url.searchParams.get('q') === 'policy' && !url.searchParams.has('compose')
  );
  await expect(page.getByRole('dialog', { name: 'Add a personal task' })).toHaveCount(0);
});

test('a create receipt survives Work menu movement without a duplicate POST', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'The desktop route-remount contract runs once.');
  await page.setViewportSize({ width: 1440, height: 900 });
  const runtime = await mockWorkHubFoundation(page);
  await openWorkPage(page, '/work/queue');
  await page
    .getByTestId('work-sidebar')
    .getByRole('button', { name: 'Add personal task', exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Add a personal task' });
  const title = 'Recover the route-moved creation receipt';
  await dialog.getByRole('textbox', { name: 'Title', exact: true }).fill(title);
  runtime.holdNextMutation();
  await dialog.getByRole('button', { name: 'Add task', exact: true }).click();
  await expect.poll(() => runtime.creations.length).toBe(1);
  const originalKey = runtime.creations[0]?.idempotencyKey;
  expect(originalKey).toMatch(uuid);
  const storedIntent = await page.evaluate(() =>
    window.sessionStorage.getItem('dwp.work.personal-create-intents.v2')
  );
  expect(storedIntent).toContain(originalKey);
  expect(storedIntent).not.toContain(title);

  await page.getByTestId('work-navigation-item-completed').dispatchEvent('click');
  await expect(page).toHaveURL(/\/work\/completed/u);
  await expect(dialog).toHaveCount(0);
  runtime.releaseMutation();

  await expect(page.getByText('The personal task was saved', { exact: true })).toBeVisible();
  expect(runtime.creations).toHaveLength(1);
  expect(runtime.creations[0]?.idempotencyKey).toBe(originalKey);
  await expect
    .poll(() =>
      page.evaluate(() => window.sessionStorage.getItem('dwp.work.personal-create-intents.v2'))
    )
    .toBeNull();

  await page.getByTestId('work-navigation-item-queue').click();
  await expect(openWorkButton(page, title)).toBeVisible();
  await capture(page, testInfo, 'route-moved-personal-create-receipt');
});

test('a create plus today-plan intent survives Work menu movement exactly once', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'The desktop route-remount contract runs once.');
  await page.setViewportSize({ width: 1440, height: 900 });
  const runtime = await mockWorkHubFoundation(page);
  await openWorkPage(page, '/work/queue');
  await page
    .getByTestId('work-sidebar')
    .getByRole('button', { name: 'Add personal task', exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Add a personal task' });
  const title = 'Carry the route-moved task into today';
  const createKey = 'c4444444-4444-4444-8444-444444444444';
  const planKey = 'c5555555-5555-4555-8555-555555555555';
  await page.evaluate(
    ({ create, plan }) => {
      const expected = [create, plan];
      const fallback = window.crypto.randomUUID.bind(window.crypto);
      Object.defineProperty(window.crypto, 'randomUUID', {
        configurable: true,
        value: () => expected.shift() ?? fallback(),
      });
    },
    { create: createKey, plan: planKey }
  );
  await dialog.getByRole('textbox', { name: 'Title', exact: true }).fill(title);
  await dialog.getByRole('checkbox', { name: /Add to today's plan/u }).check();
  await expect(dialog.getByRole('checkbox', { name: /Add to today's plan/u })).toBeChecked();

  runtime.holdNextMutation();
  await dialog.getByRole('button', { name: 'Add task', exact: true }).click();
  await expect.poll(() => runtime.creations.length).toBe(1);
  expect(runtime.creations[0]?.idempotencyKey).toBe(createKey);

  await page.getByTestId('work-navigation-item-completed').dispatchEvent('click');
  await expect(page).toHaveURL(/\/work\/completed/u);
  await expect(dialog).toHaveCount(0);
  runtime.releaseMutation();

  await expect(page.getByText('The personal task was saved', { exact: true })).toBeVisible();
  await expect.poll(() => runtime.planSaves.length).toBe(1);
  expect(runtime.creations).toHaveLength(1);
  expect(runtime.creations[0]?.idempotencyKey).toBe(createKey);
  expect(runtime.planSaves[0]).toMatchObject({
    version: 0,
    items: [
      {
        sourceSystem: 'PERSONAL_TASK',
        sourceReference: 'b3333333-3333-4333-8333-333333333333',
      },
    ],
  });
  expect(runtime.planSaves[0]?.idempotencyKey).toBe(planKey);

  await page.getByTestId('work-navigation-item-day-plan').click();
  await expect(page).toHaveURL(/\/work\/day-plan/u);
  await expect(
    page
      .getByTestId('work-today-plan-page')
      .getByRole('button', { name: `Remove ${title} from the plan`, exact: true })
  ).toBeVisible();
});

test('batch selection is discarded when the work view changes', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'The desktop navigation contract runs once.');
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockWorkHubFoundation(page, {
    personal: false,
    sourceOwned: false,
    nativeWorkspace: true,
  });
  await openWorkPage(page, '/work/queue?select=1');
  const checkbox = page.getByRole('checkbox', {
    name: `Select ${fixture.workspaceTitle} for batch processing`,
    exact: true,
  });
  await checkbox.check();

  await page.getByTestId('work-navigation-item-completed').click();
  await expect(page).toHaveURL(/\/work\/completed/u);
  await page.getByTestId('work-navigation-item-queue').click();
  await expect(page).toHaveURL(/\/work\/queue/u);
  await expect(page).not.toHaveURL(/[?&]select=1(?:&|$)/u);
  await expect(checkbox).toHaveCount(0);
});

test('retry after a lost response reuses the original command and receipt', async ({ page }) => {
  const runtime = await mockWorkHubFoundation(page, { loseFirstMutationResponse: true });
  await openWorkPage(page, personalTaskRoute());
  await inspector(page).getByRole('button', { name: 'In progress', exact: true }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'The result could not be confirmed' })
  ).toBeVisible();
  await expect(page.getByText('The source confirmed the change', { exact: true })).toHaveCount(0);
  await inspector(page).getByRole('button', { name: 'In progress', exact: true }).click();
  await expectSelectedStatus(page, 'In progress');
  expect(runtime.mutations).toHaveLength(2);
  expect(runtime.mutations[1]).toEqual(runtime.mutations[0]);
  expect(runtime.mutations[1].body.version).toBe(4);
});

test('desktop legacy entries converge on the unified queue and retain compatibility state', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'The desktop IA contract runs once in Chromium.');
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockWorkHubFoundation(page);

  for (const entry of [
    `/work?scope=ALL&item=${fixture.approvalId}`,
    `/work/home?scope=ALL&personalTaskId=${fixture.personalId}`,
    '/work/retired-view?scope=WAITING&source=SERVICE_REQUEST',
  ]) {
    const expectedSearch = new URL(entry, 'http://dwp.test').search;
    await openWorkPage(page, entry);
    await expect(page).toHaveURL(
      (url) => url.pathname === '/work/queue' && url.search === expectedSearch
    );
    await expect(page.getByRole('heading', { name: 'Unified work inbox', level: 1 })).toBeVisible();
  }

  const navigation = page.getByRole('navigation', { name: 'Work navigation' });
  await expect(navigation.getByRole('link')).toHaveCount(6);
  await expect(navigation.getByTestId('work-navigation-item-queue')).toHaveAttribute(
    'href',
    /\/work\/queue/
  );
  await expect(navigation.getByRole('link', { name: 'Work home', exact: true })).toHaveCount(0);
  await capture(page, testInfo, 'unified-work-ia-desktop');
});

test('390px source-owned handoff returns to the filtered list with focus and state intact', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'The 390px contract runs once in Chromium.');
  await page.setViewportSize({ width: 390, height: 844 });
  const runtime = await mockWorkHubFoundation(page);
  await openWorkPage(page, '/work/queue?scope=ALL&q=project');

  const list = page.locator('ul[aria-label="Unified work list"]');
  const opener = openWorkButton(page, fixture.approvalTitle);
  await expect(list).toBeVisible();
  await opener.click();
  await expect(list).toBeHidden();
  await expect(
    inspector(page).getByRole('heading', { name: fixture.approvalTitle, exact: true })
  ).toBeVisible();
  await expect(inspector(page)).toContainText(sourceNotice);
  await expect(
    inspector(page).getByRole('button', { name: 'Open in source', exact: true })
  ).toBeVisible();
  await expect(inspector(page).getByRole('button', { name: 'Start', exact: true })).toHaveCount(0);
  await expect(inspector(page).getByRole('button', { name: 'Complete', exact: true })).toHaveCount(
    0
  );
  await expect(page).toHaveURL((url) => {
    return (
      url.pathname === '/work/queue' &&
      url.searchParams.get('scope') === 'ALL' &&
      url.searchParams.get('q') === 'project' &&
      url.searchParams.get('work')?.startsWith('APPROVAL_TASK:') === true
    );
  });

  const reads = runtime.personalReads;
  const selectedUrl = new URL(page.url());
  const returnTo = `${selectedUrl.pathname}${selectedUrl.search}${selectedUrl.hash}`;
  await inspector(page).getByRole('button', { name: 'Open in source', exact: true }).click();
  await expect(page).toHaveURL(
    (url) =>
      url.pathname === '/approvals/inbox' &&
      url.searchParams.get('task') === fixture.approvalId &&
      url.searchParams.get('returnTo') === returnTo
  );
  await page.getByRole('button', { name: 'Return to work', exact: true }).click();
  await expect(page).toHaveURL((url) => `${url.pathname}${url.search}${url.hash}` === returnTo);
  await expect(
    inspector(page).getByRole('heading', { name: fixture.approvalTitle, exact: true })
  ).toBeVisible();
  await expect(page.locator('[data-work-source-trigger]')).toBeFocused();
  expect(runtime.personalReads).toBeGreaterThan(reads);

  await inspector(page).getByRole('button', { name: 'Back to work list', exact: true }).click();
  await expect(list).toBeVisible();
  await expect(page).toHaveURL((url) => {
    return (
      url.pathname === '/work/queue' &&
      url.searchParams.get('scope') === 'ALL' &&
      url.searchParams.get('q') === 'project' &&
      !url.searchParams.has('work')
    );
  });
  await expect(opener).toBeFocused();
  await expectNoHorizontalOverflow(page);
  await capture(page, testInfo, 'source-authority-390', true);
});

test('390px today plan has its own route and returns to the queue', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Run the narrow navigation contract once.');
  await page.setViewportSize({ width: 390, height: 844 });
  await mockWorkHubFoundation(page);
  await openWorkPage(page, '/work/queue');
  await page.getByTestId('work-mobile-navigation-trigger').click();
  await page
    .getByTestId('work-mobile-sidebar')
    .getByTestId('work-navigation-item-day-plan')
    .click();
  await expect(page).toHaveURL(/\/work\/day-plan/);
  await expect(page.getByTestId('work-today-plan-page')).toBeVisible();
  await page.getByRole('button', { name: 'Back to work list', exact: true }).click();
  await expect(page).toHaveURL(/\/work\/queue/);
  await expect(page.getByRole('list', { name: 'Unified work list' })).toBeVisible();
});

test('320px personal task capture stays operable when the input viewport contracts', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'chromium',
    'The 320px input contract runs once in Chromium.'
  );
  await page.setViewportSize({ width: 320, height: 568 });
  const runtime = await mockWorkHubFoundation(page);
  await openWorkPage(page, '/work/queue');
  await page
    .locator('#dwp-main-content')
    .getByRole('button', { name: 'Add personal task', exact: true })
    .click();

  const dialog = page.getByRole('dialog', { name: 'Add a personal task' });
  const title = '모바일에서 고객 인수인계 메모 정리';
  const titleField = dialog.getByRole('textbox', { name: 'Title', exact: true });
  await expect(titleField).toBeFocused();
  await titleField.fill(title);
  await dialog
    .getByRole('textbox', { name: 'Description' })
    .fill('가상 키보드가 열린 작은 화면에서도 입력 내용과 저장 동선을 유지합니다.');

  await page.setViewportSize({ width: 320, height: 360 });
  const submit = dialog.getByRole('button', { name: 'Add task', exact: true });
  await expect(dialog).toBeVisible();
  await expect(submit).toBeInViewport();
  await submit.focus();
  await expect(submit).toBeFocused();
  await expectNoHorizontalOverflow(page);
  await capture(page, testInfo, 'personal-task-keyboard-320', true);
  await submit.click();

  await expect(dialog).toHaveCount(0);
  await expect(inspector(page).getByRole('heading', { name: title, exact: true })).toBeVisible();
  await showWorkList(page);
  await expect(openWorkButton(page, title)).toBeVisible();
  expect(runtime.creations).toHaveLength(1);
  expect(runtime.creations[0]).toMatchObject({
    body: {
      title,
      description: '가상 키보드가 열린 작은 화면에서도 입력 내용과 저장 동선을 유지합니다.',
      priority: 'NORMAL',
      dueAt: null,
    },
  });
  expect(runtime.creations[0].idempotencyKey).toMatch(uuid);
});

const layouts = [
  { name: '1440-light', width: 1440, height: 900, mode: 'light' as const },
  { name: '1280-dark', width: 1280, height: 800, mode: 'dark' as const },
  { name: '390-light', width: 390, height: 844, mode: 'light' as const },
  { name: '320-dark', width: 320, height: 568, mode: 'dark' as const },
  { name: '320-long-labels', width: 320, height: 568, mode: 'light' as const, longLabels: true },
  {
    name: '1280-forced-colors',
    width: 1280,
    height: 800,
    mode: 'light' as const,
    forcedColors: true,
  },
  { name: '1280-200-percent', width: 1280, height: 800, mode: 'light' as const, zoom: 2 },
];

for (const layout of layouts) {
  test(`unified queue remains usable at ${layout.name}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: layout.width, height: layout.height });
    const title =
      'longLabels' in layout
        ? '고객 전환을 위한 승인 근거와 인수인계 자료를 검토하고 담당자에게 전달합니다 — Review customer handover evidence and delivery responsibilities'
        : fixture.personalTitle;
    await mockWorkHubFoundation(page, {
      mode: layout.mode,
      highContrast: 'forcedColors' in layout,
      personalTitle: title,
    });
    if ('forcedColors' in layout)
      await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
    await openWorkPage(page, personalTaskRoute());
    if ('zoom' in layout)
      await page.evaluate((zoom) => {
        document.documentElement.style.zoom = String(zoom);
      }, layout.zoom);
    await expect(inspector(page).getByRole('heading', { name: title, exact: true })).toBeVisible();
    const action = inspector(page).getByRole('button', { name: 'In progress', exact: true });
    await expect(action).toBeEnabled();
    await action.scrollIntoViewIfNeeded();
    await expect(action).toBeInViewport();
    await capture(page, testInfo, layout.name);
    await expectNoHorizontalOverflow(page);
    const accessibility = await new AxeBuilder({ page }).include('main').analyze();
    expect(
      accessibility.violations.filter(
        (violation) => violation.impact === 'critical' || violation.impact === 'serious'
      )
    ).toEqual([]);
  });
}

test('keyboard activation keeps visible focus and completes a personal start', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await mockWorkHubFoundation(page);
  await openWorkPage(page, personalTaskRoute());
  const action = inspector(page).getByRole('button', { name: 'In progress', exact: true });
  await expect(action).toBeEnabled();
  for (let index = 0; index < 80; index += 1) {
    await page.keyboard.press('Tab');
    if (await action.evaluate((element) => element === document.activeElement)) break;
  }
  await expect(action).toBeFocused();
  expect(await action.evaluate((element) => element.matches(':focus-visible'))).toBe(true);
  await capture(page, testInfo, 'keyboard-visible-focus', true);
  await page.keyboard.press('Enter');
  await expectSelectedStatus(page, 'In progress');
});
