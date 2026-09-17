import { expect, test } from '@playwright/test';
import { fulfillSuccess } from './support/shell-session';
import {
  mockWorkHubFoundation,
  personalTaskRoute,
  WORK_HUB_FIXTURE,
} from './support/work-hub-foundation-fixtures';

test('05 a concurrent checklist update requires explicit review before a new version can be saved', async ({
  page,
}) => {
  await mockWorkHubFoundation(page, { designDetails: true });
  const taskId = WORK_HUB_FIXTURE.personalId;
  let task = {
    taskId,
    title: WORK_HUB_FIXTURE.personalTitle,
    description: 'Review the current customer handover.',
    priority: 'HIGH',
    status: 'OPEN',
    version: 4,
    source: null,
    sources: [],
    dueAt: null,
    createdAt: '2026-09-04T00:00:00Z',
    updatedAt: '2026-09-04T00:00:00Z',
    completedAt: null,
    checklist: [{ itemId: 'first', title: 'Review source material', completed: false }],
  };
  const writes: Array<Record<string, unknown>> = [];
  await page.route('**/api/platform/v1/workspace/work-hub/personal-tasks?*', (route) =>
    fulfillSuccess(route, { items: [task], page: 0, size: 100, totalElements: 1, hasMore: false })
  );
  await page.route(
    `**/api/platform/v1/workspace/work-hub/personal-tasks/${taskId}`,
    async (route) => {
      if (route.request().method() === 'PUT') {
        const body = route.request().postDataJSON();
        writes.push(body);
        if (body.version !== task.version) return route.fulfill({ status: 409 });
        task = { ...task, ...body, version: task.version + 1 };
      }
      return fulfillSuccess(route, task);
    }
  );
  await page.goto(personalTaskRoute());
  await page.getByRole('checkbox', { name: 'Toggle completion of Review source material' }).check();
  task = {
    ...task,
    version: 5,
    checklist: [
      ...task.checklist,
      { itemId: 'second', title: 'A concurrent checklist addition', completed: false },
    ],
  };
  await page.getByRole('button', { name: 'Save checklist', exact: true }).click();
  await expect(page.getByText('Latest saved checklist', { exact: true })).toBeVisible();
  await expect(page.getByText('A concurrent checklist addition', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save checklist', exact: true })).toBeDisabled();
  expect(writes).toHaveLength(0);
  await page
    .getByRole('button', { name: 'Reviewed: replace latest with my draft', exact: true })
    .click();
  expect(writes).toHaveLength(0);
  await page.getByRole('button', { name: 'Save checklist', exact: true }).click();
  await expect(page.getByText('Checklist saved.', { exact: true })).toBeVisible();
  expect(writes).toEqual([
    expect.objectContaining({
      version: 5,
      checklist: [{ itemId: 'first', title: 'Review source material', completed: true }],
    }),
  ]);
});

for (const width of [1440, 1280, 390, 320]) {
  test(`05 detail and 06 edit design evidence at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: width >= 1280 ? 1000 : 844 });
    await mockWorkHubFoundation(page, { designDetails: true, locale: 'ko' });
    await page.goto(personalTaskRoute());
    // The isolated product and its locale are lazy chunks on the shared development server.
    await expect(page.getByRole('heading', { name: '개인 할 일 내용' })).toBeVisible({
      timeout: 20_000,
    });
    await page.screenshot({
      path: testInfo.outputPath(`05-personal-detail-${width}.png`),
      fullPage: true,
    });
    const savedProgress = page.getByRole('progressbar').first();
    // Fixed mobile navigation can cover an element that is geometrically in the viewport.
    await savedProgress.evaluate((element) =>
      element.scrollIntoView({ block: 'center', behavior: 'instant' })
    );
    await expect(savedProgress).toBeInViewport({ ratio: 1 });
    await page.screenshot({
      path: testInfo.outputPath(`05-personal-progress-${width}.png`),
      fullPage: false,
    });
    await page.getByRole('button', { name: '원천 연결 편집', exact: true }).click();
    const editor = page.getByRole('dialog', { name: '개인 할 일 편집' });
    await expect(editor).toBeVisible();
    await expect(
      editor
        .getByRole('group', { name: '개인 할 일 작업 모드' })
        .getByRole('button', { name: 'C. 기존 할 일 수정' })
    ).toHaveAttribute('aria-pressed', 'true');
    await page.screenshot({
      path: testInfo.outputPath(`06-personal-edit-${width}.png`),
      fullPage: false,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      )
    ).toBeLessThanOrEqual(1);
  });
}

test('05 checklist and 06 multiple-source edits persist through actual task APIs; deletion is confirmed', async ({
  page,
}) => {
  const runtime = await mockWorkHubFoundation(page, { designDetails: true });
  await page.goto(personalTaskRoute());
  await expect(page.getByRole('heading', { name: 'Personal task details' })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByRole('progressbar').first()).toHaveAttribute('aria-valuenow', '50');
  await page.getByRole('checkbox', { name: 'Toggle completion of Draft and review' }).check();
  await expect(page.getByRole('progressbar').first()).toHaveAttribute('aria-valuenow', '50');
  await page
    .getByRole('textbox', { name: 'New checklist item' })
    .fill('Send the verified handover');
  await page.getByRole('button', { name: 'Add item', exact: true }).click();
  await page.getByRole('button', { name: 'Save checklist', exact: true }).click();
  await expect(page.getByText('Checklist saved.', { exact: true })).toBeVisible();
  await expect(page.getByRole('progressbar').first()).toHaveAttribute('aria-valuenow', '67');
  expect(runtime.mutations[0]?.body).toMatchObject({
    version: 4,
    checklist: [
      { title: 'Review source material', completed: true },
      { title: 'Draft and review', completed: true },
      { title: 'Send the verified handover', completed: false },
    ],
  });
  expect(runtime.mutations[0]?.idempotencyKey).toBeTruthy();
  expect(runtime.mutations[0]?.body).not.toHaveProperty('sourceReferences');

  await page.getByRole('button', { name: 'Edit source links', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Edit personal task' });
  await expect(editor.getByRole('textbox', { name: 'Checklist item 3', exact: true })).toHaveValue(
    'Send the verified handover'
  );
  await editor.getByRole('button', { name: WORK_HUB_FIXTURE.approvalTitle, exact: true }).click();
  await editor
    .getByRole('button', { name: WORK_HUB_FIXTURE.serviceDesignTitle, exact: true })
    .click();
  await editor.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(editor).not.toBeVisible();
  expect(runtime.mutations[1]?.body).toMatchObject({
    version: 5,
    sourceReferences: [
      {
        sourceSystem: 'APPROVAL_TASK',
        sourceReference: WORK_HUB_FIXTURE.approvalId,
        obligationKey: 'SECURITY_REVIEW',
      },
      { sourceSystem: 'SERVICE_REQUEST', sourceReference: WORK_HUB_FIXTURE.serviceId },
    ],
  });
  expect(runtime.mutations[1]?.body).not.toHaveProperty('sourceReference');
  expect(runtime.mutations[1]?.body).not.toHaveProperty('clearSourceReference');

  await page.getByRole('button', { name: 'Delete task', exact: true }).click();
  const preview = page.getByRole('dialog', { name: 'Delete this personal task?' });
  await expect(preview).toBeVisible();
  expect(runtime.mutations).toHaveLength(2);
  await preview.getByRole('button', { name: 'Delete task', exact: true }).click();
  await expect(page).toHaveURL(/\/work\/queue$/);
  expect(runtime.mutations[2]).toMatchObject({
    path: expect.stringContaining('/delete'),
    body: { version: 6 },
  });
  expect(runtime.mutations[2]?.idempotencyKey).toBeTruthy();
});

for (const width of [390, 320]) {
  test(`F01 personal task keyboard capture at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    const runtime = await mockWorkHubFoundation(page, { designDetails: true });
    await page.goto('/work/queue?compose=task');
    const editor = page.getByRole('dialog', { name: 'Add a personal task' });
    await expect(editor).toBeVisible({ timeout: 20_000 });
    await expect(
      editor
        .getByRole('group', { name: 'Personal task mode' })
        .getByRole('button', { name: 'A. Create new task' })
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(editor.locator('ol[aria-label="Personal task creation progress"]')).toHaveCount(0);
    await editor
      .getByRole('textbox', { name: 'Title', exact: false })
      .fill('Confirm the customer delivery plan');
    await editor
      .getByRole('textbox', { name: 'New checklist item' })
      .fill('Check delivery address');
    await editor.getByRole('textbox', { name: 'New checklist item' }).press('Enter');
    expect(runtime.creations).toHaveLength(0);
    await expect(
      editor.getByRole('textbox', { name: 'Checklist item 1', exact: true })
    ).toHaveValue('Check delivery address');
    // A reduced visual viewport exercises the same scroll/submit recovery needed with a keyboard.
    await page.setViewportSize({ width, height: 440 });
    await editor.getByRole('button', { name: 'Add task', exact: true }).scrollIntoViewIfNeeded();
    await expect(editor.getByRole('button', { name: 'Add task', exact: true })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
    await page.screenshot({
      path: testInfo.outputPath(`personal-capture-${width}-keyboard-reflow.png`),
      fullPage: false,
    });
    await editor.getByRole('button', { name: 'Add task', exact: true }).click();
    await expect(editor).not.toBeVisible();
    expect(runtime.creations[0]?.body).toMatchObject({
      title: 'Confirm the customer delivery plan',
      checklist: [{ title: 'Check delivery address', completed: false }],
    });
    expect(runtime.creations[0]?.idempotencyKey).toBeTruthy();
  });
}

test('05 read-only task disables status/checklist edits and hides task deletion', async ({
  page,
}) => {
  const runtime = await mockWorkHubFoundation(page, { designDetails: true, canUpdate: false });
  await page.goto(personalTaskRoute());
  await expect(page.getByRole('heading', { name: 'Personal task details' })).toBeVisible({
    timeout: 20_000,
  });
  await expect(
    page.getByRole('checkbox', { name: 'Toggle completion of Draft and review' })
  ).toBeDisabled();
  await expect(page.getByRole('textbox', { name: 'New checklist item' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Delete task', exact: true })).toHaveCount(0);
  expect(runtime.mutations).toHaveLength(0);
});

for (const appearance of ['zoom-200', 'dark-high-contrast'] as const) {
  test(`05 and 06 ${appearance} preserve readable progress and keyboard editing`, async ({
    page,
  }, testInfo) => {
    const zoomed = appearance === 'zoom-200';
    await page.setViewportSize({ width: zoomed ? 1280 : 390, height: zoomed ? 1000 : 844 });
    await mockWorkHubFoundation(page, {
      designDetails: true,
      locale: 'ko',
      mode: zoomed ? 'light' : 'dark',
      highContrast: !zoomed,
    });
    await page.emulateMedia({ reducedMotion: 'reduce', forcedColors: zoomed ? 'none' : 'active' });
    await page.goto(personalTaskRoute());
    if (zoomed)
      await page.evaluate(() => {
        document.documentElement.style.zoom = '2';
      });
    await expect(page.getByRole('button', { name: '업무 목록으로', exact: true })).toBeVisible({
      timeout: 20_000,
    });
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        })
    );
    const progress = page.getByRole('progressbar').first();
    await progress.scrollIntoViewIfNeeded();
    await expect(progress).toBeInViewport();
    await expect(progress).toHaveAttribute('aria-valuenow', '50');
    await page.screenshot({ path: testInfo.outputPath(`05-${appearance}.png`), fullPage: false });
    await page.getByRole('button', { name: '원천 연결 편집', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '개인 할 일 편집' });
    const title = dialog.getByRole('textbox', { name: '제목', exact: false });
    await expect(title).toBeFocused();
    await expect(dialog.getByText(/시간대:/)).toBeVisible();
    await title.fill('확대 및 고대비에서도 현재 작성 내용을 확인합니다');
    await page.screenshot({ path: testInfo.outputPath(`06-${appearance}.png`), fullPage: false });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
    await dialog.getByRole('button', { name: '변경 저장', exact: true }).click();
    await expect(dialog).not.toBeVisible();
  });
}
