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
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const inspector = (page: Page) => page.getByRole('article');
const openWorkButton = (page: Page, title: string) =>
  page.getByRole('button', { name: `Open details for ${title}`, exact: true });

async function showWorkList(page: Page) {
  const back = inspector(page).getByRole('button', { name: 'Back to work list', exact: true });
  if (await back.isVisible()) await back.click();
}

async function selectWork(page: Page, title: string) {
  await showWorkList(page);
  await openWorkButton(page, title).click();
  await expect(inspector(page).getByRole('heading', { name: title, exact: true })).toBeVisible();
}

async function expectSelectedStatus(page: Page, status: string) {
  await expect(inspector(page).getByText(status, { exact: true }).first()).toBeVisible();
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
  ).toBeLessThanOrEqual(1);
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

test('source-owned approval and service work require their source apps', async ({
  page,
}, testInfo) => {
  const runtime = await mockWorkHubFoundation(page);
  await page.goto('/work/queue');
  for (const item of [
    { title: fixture.approvalTitle, path: `/approvals/inbox?task=${fixture.approvalId}` },
    { title: fixture.serviceTitle, path: `/services/requests/${fixture.serviceId}` },
  ]) {
    await showWorkList(page);
    const checkbox = page.getByRole('checkbox', {
      name: `Select ${item.title} for batch processing`,
      exact: true,
    });
    await expect(checkbox).toBeDisabled();
    await selectWork(page, item.title);
    await expect(inspector(page)).toContainText(sourceNotice);
    await expect(inspector(page).getByRole('button', { name: 'Complete' })).toHaveCount(0);
    await expect(inspector(page).getByRole('button', { name: 'Start' })).toHaveCount(0);
    await inspector(page).getByRole('button', { name: 'Open in source', exact: true }).click();
    await expect(page).toHaveURL(
      new RegExp(item.path.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&') + '$')
    );
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
  await page.goto(personalTaskRoute());
  await expect(inspector(page)).toContainText(fixture.personalTitle);
  runtime.holdNextMutation();
  await inspector(page).getByRole('button', { name: 'Start', exact: true }).click();
  await expect.poll(() => runtime.mutations.length).toBe(1);
  await expect(
    inspector(page).getByRole('button', { name: 'Processing', exact: true })
  ).toBeDisabled();
  await expect(page.getByText('The source confirmed the change', { exact: true })).toHaveCount(0);
  expect(runtime.mutations[0]).toMatchObject({
    path: `/api/platform/v1/workspace/work-hub/personal-tasks/${fixture.personalId}/status`,
    body: { version: 4, status: 'IN_PROGRESS' },
  });
  expect(runtime.mutations[0].idempotencyKey).toMatch(uuid);
  runtime.releaseMutation();
  await expectSelectedStatus(page, 'In progress');
  await expect(inspector(page).getByRole('button', { name: 'Start', exact: true })).toHaveCount(0);
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
  await page.goto('/work/queue');
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
  await page.goto('/work/queue');

  await expect.poll(() => runtime.failedSourceReads.length).toBeGreaterThanOrEqual(6);
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
  await expect(sourceStatus).toBeVisible();
  await expect(sourceStatus.getByText('Unavailable', { exact: true })).toHaveCount(6);
  await expect(
    sourceStatus.getByRole('button', { name: 'Refresh all sources', exact: true })
  ).toBeEnabled();
  await capture(page, testInfo, 'all-sources-unavailable');
});

test('a background refresh outage keeps the verified scope visible as degraded', async ({
  page,
}, testInfo) => {
  const runtime = await mockWorkHubFoundation(page);
  await page.goto(personalTaskRoute());
  await expect(
    inspector(page).getByRole('heading', { name: fixture.personalTitle, exact: true })
  ).toBeVisible();

  runtime.failFutureReads();
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect.poll(() => runtime.failedSourceReads.length).toBeGreaterThanOrEqual(6);
  await expect(
    page.getByRole('alert').getByText('Work sources unavailable', { exact: true })
  ).toBeVisible();
  await expect(page.getByText('Work could not be loaded', { exact: true })).toHaveCount(0);
  await expect(
    inspector(page).getByRole('heading', { name: fixture.personalTitle, exact: true })
  ).toBeVisible();

  await page.getByRole('button', { name: 'Source status', exact: true }).click();
  const sourceStatus = page.getByRole('dialog', { name: 'Work source status' });
  await expect(sourceStatus).toBeVisible();
  await expect(sourceStatus.getByText('Unavailable', { exact: true })).toHaveCount(6);
  await capture(page, testInfo, 'background-refresh-degraded');
});

test('canonical work links and personal task aliases resolve the requested item', async ({
  page,
}, testInfo) => {
  await mockWorkHubFoundation(page);
  await page.goto(personalTaskRoute(fixture.secondaryPersonalId));
  await expect(
    inspector(page).getByRole('heading', { name: fixture.secondaryTitle, exact: true })
  ).toBeVisible();
  await expect(
    inspector(page).getByRole('heading', { name: fixture.personalTitle, exact: true })
  ).toHaveCount(0);
  await page.goto(`/work/queue?personalTaskId=${fixture.personalId}`);
  await expect(
    inspector(page).getByRole('heading', { name: fixture.personalTitle, exact: true })
  ).toBeVisible();
  await capture(page, testInfo, 'canonical-personal-target');
});

test('returning from another app adopts the cached queue before a personal command', async ({
  page,
}, testInfo) => {
  const runtime = await mockWorkHubFoundation(page);
  await page.goto('/work/queue');
  await selectWork(page, fixture.approvalTitle);
  const reads = runtime.personalReads;
  await inspector(page).getByRole('button', { name: 'Open in source', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/approvals/inbox\\?task=${fixture.approvalId}$`));
  await page.goBack();
  await selectWork(page, fixture.personalTitle);
  expect(runtime.personalReads).toBe(reads);
  await inspector(page).getByRole('button', { name: 'Start', exact: true }).click();
  await expectSelectedStatus(page, 'In progress');
  expect(runtime.mutations).toHaveLength(1);
  await capture(page, testInfo, 'cached-return-personal-start');
});

test('view-only access exposes no personal mutation action', async ({ page }) => {
  const runtime = await mockWorkHubFoundation(page, { canUpdate: false });
  await page.goto(personalTaskRoute());
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
  await page.goto('/work/queue');
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
  await expect(review).toContainText('This batch runs in one source.');
  await review.getByRole('button', { name: 'Complete selected', exact: true }).click();

  const result = page.getByRole('dialog', { name: 'The batch change was confirmed' });
  await expect(result).toContainText(fixture.workspaceTitle);
  await expect(result).toContainText('Change confirmed by the source');
  expect(runtime.batchMutations).toHaveLength(1);
  await capture(page, testInfo, 'batch-confirmed-receipts');
});

test('retry after a lost response reuses the original command and receipt', async ({ page }) => {
  const runtime = await mockWorkHubFoundation(page, { loseFirstMutationResponse: true });
  await page.goto(personalTaskRoute());
  await inspector(page).getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.getByText('The result could not be confirmed', { exact: true })).toBeVisible();
  await expect(page.getByText('The source confirmed the change', { exact: true })).toHaveCount(0);
  await inspector(page).getByRole('button', { name: 'Start', exact: true }).click();
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
    await page.goto(entry);
    await expect(page).toHaveURL(
      (url) => url.pathname === '/work/queue' && url.search === expectedSearch
    );
    await expect(page.getByRole('heading', { name: 'Unified work queue', level: 1 })).toBeVisible();
  }

  const navigation = page.getByRole('navigation', { name: 'Work navigation' });
  await expect(navigation.getByRole('link')).toHaveCount(1);
  await expect(
    navigation.getByRole('link', { name: 'Unified work queue', exact: true })
  ).toHaveAttribute('href', '/work/queue');
  await expect(navigation.getByRole('link', { name: 'Work home', exact: true })).toHaveCount(0);
  await capture(page, testInfo, 'unified-work-ia-desktop');
});

test('390px source-owned decision returns to the filtered list with focus and state intact', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'The 390px contract runs once in Chromium.');
  await page.setViewportSize({ width: 390, height: 844 });
  await mockWorkHubFoundation(page);
  await page.goto('/work/queue?scope=ALL&q=project');

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

test('390px today plan returns focus to the control that opened it', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== 'chromium',
    'The 390px focus contract runs once in Chromium.'
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await mockWorkHubFoundation(page);
  await page.goto('/work/queue');

  const trigger = page.locator('button[data-work-plan-trigger]');
  await trigger.click();
  await expect(page.getByRole('heading', { name: "Today's execution plan" })).toBeVisible();
  await page.getByRole('button', { name: 'Back to work list', exact: true }).click();
  await expect(trigger).toBeFocused();
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
  await page.goto('/work/queue');
  await page.getByRole('button', { name: 'Add personal task', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: 'Add a personal task' });
  const title = '모바일에서 고객 인수인계 메모 정리';
  const titleField = dialog.getByRole('textbox', { name: 'Title' });
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
    await page.goto(personalTaskRoute());
    if ('zoom' in layout)
      await page.evaluate((zoom) => {
        document.documentElement.style.zoom = String(zoom);
      }, layout.zoom);
    await expect(inspector(page).getByRole('heading', { name: title, exact: true })).toBeVisible();
    const action = inspector(page).getByRole('button', { name: 'Start', exact: true });
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
  await page.goto(personalTaskRoute());
  const action = inspector(page).getByRole('button', { name: 'Start', exact: true });
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
