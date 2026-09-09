import { expect, test } from '@playwright/test';

import {
  mockWorkHubFoundation,
  personalTaskRoute,
  WORK_HUB_FIXTURE,
} from './support/work-hub-foundation-fixtures';

test.beforeEach(async ({ page }) => {
  // Both configured browser projects exercise physical keyboard input on the full Work layout.
  await page.setViewportSize({ width: 1440, height: 1000 });
});

test('Alt+Shift+N opens a personal task and saves through the existing create command', async ({
  page,
}, testInfo) => {
  const runtime = await mockWorkHubFoundation(page, { designDetails: true });
  await page.goto('/work/queue');
  const create = page
    .locator('#dwp-main-content')
    .getByRole('button', { name: 'Add personal task', exact: true });
  await expect(create).toBeVisible({ timeout: 20_000 });
  await expect(create).toHaveAttribute('aria-keyshortcuts', /Alt\+Shift\+N/);
  await create.focus();
  // The browser-safe alternative is tested; reserved Cmd/Ctrl+N may open a browser window.
  await page.keyboard.press('Alt+Shift+KeyN');
  const editor = page.getByRole('dialog', { name: 'Add a personal task', exact: true });
  await expect(editor).toBeVisible();
  expect(runtime.creations).toHaveLength(0);
  await editor
    .getByRole('textbox', { name: 'Title', exact: false })
    .fill('Keyboard-created handover follow-up');
  await page.screenshot({ path: testInfo.outputPath('work-keyboard-create.png'), fullPage: false });
  await editor.getByRole('button', { name: 'Add task', exact: true }).click();
  await expect(editor).not.toBeVisible();
  expect(runtime.creations).toEqual([
    expect.objectContaining({
      body: expect.objectContaining({ title: 'Keyboard-created handover follow-up' }),
      idempotencyKey: expect.any(String),
    }),
  ]);
  expect(runtime.mutations).toHaveLength(0);
});

test('focused personal detail E edits the selected task and C completes its saved version', async ({
  page,
}, testInfo) => {
  const runtime = await mockWorkHubFoundation(page, { designDetails: true });
  await page.goto(personalTaskRoute());
  const detail = page.getByRole('region', {
    name: 'Personal task keyboard shortcut region',
    exact: true,
  });
  await expect(detail).toBeVisible({ timeout: 20_000 });
  await expect(detail.getByRole('button', { name: 'Edit', exact: true })).toBeEnabled();
  await detail.focus();
  await expect(detail).toBeFocused();
  await page.keyboard.press('e');
  const editor = page.getByRole('dialog', { name: 'Edit personal task', exact: true });
  await expect(editor).toBeVisible();
  const title = editor.getByRole('textbox', { name: 'Title', exact: false });
  await expect(title).toHaveValue(WORK_HUB_FIXTURE.personalTitle);
  await title.fill('Keyboard-reviewed handover notes');
  await editor.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(editor).not.toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Keyboard-reviewed handover notes', exact: true })
  ).toBeVisible();
  await expect(detail.getByRole('button', { name: 'Edit', exact: true })).toBeEnabled();
  expect(runtime.mutations).toEqual([
    expect.objectContaining({
      path: expect.stringContaining(`/${WORK_HUB_FIXTURE.personalId}`),
      body: expect.objectContaining({ version: 4, title: 'Keyboard-reviewed handover notes' }),
      idempotencyKey: expect.any(String),
    }),
  ]);
  await detail.focus();
  await page.keyboard.press('c');
  await expect(page.getByText('Task status updated.', { exact: true })).toBeVisible();
  expect(runtime.mutations).toHaveLength(2);
  expect(runtime.mutations[1]).toMatchObject({
    path: expect.stringContaining(`/${WORK_HUB_FIXTURE.personalId}/complete`),
    body: { version: 5 },
    idempotencyKey: expect.any(String),
  });
  expect(runtime.sourceMutations).toHaveLength(0);
  expect(runtime.forbiddenWorkspaceMutations).toHaveLength(0);
  await page.screenshot({
    path: testInfo.outputPath('work-keyboard-complete.png'),
    fullPage: false,
  });
});

test('outside focus, typing, and an open dialog leave personal shortcut commands inactive', async ({
  page,
}) => {
  const runtime = await mockWorkHubFoundation(page, { designDetails: true });
  await page.goto(personalTaskRoute());
  const detail = page.getByRole('region', {
    name: 'Personal task keyboard shortcut region',
    exact: true,
  });
  await expect(detail).toBeVisible({ timeout: 20_000 });
  const input = detail.getByRole('textbox', { name: 'New checklist item', exact: true });
  await input.focus();
  await page.keyboard.press('c');
  await page.keyboard.press('e');
  await expect(input).toHaveValue('ce');
  await page.keyboard.press('Alt+Shift+KeyN');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(runtime.mutations).toHaveLength(0);
  expect(runtime.creations).toHaveLength(0);
  await input.fill('');
  await page
    .locator('#dwp-main-content')
    .getByRole('button', { name: 'Add personal task', exact: true })
    .focus();
  await page.keyboard.press('c');
  await page.keyboard.press('e');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(runtime.mutations).toHaveLength(0);

  await detail.getByRole('button', { name: 'Delete task', exact: true }).click();
  const preview = page.getByRole('dialog', { name: 'Delete this personal task?', exact: true });
  await expect(preview).toBeVisible();
  const cancel = preview.getByRole('button', { name: 'Cancel', exact: true });
  await cancel.focus();
  await page.keyboard.press('c');
  await page.keyboard.press('e');
  await page.keyboard.press('Alt+Shift+KeyN');
  await expect(preview).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  expect(runtime.mutations).toHaveLength(0);
  expect(runtime.creations).toHaveLength(0);
  await page.keyboard.press('Escape');
  await expect(preview).not.toBeVisible();
});

test('personal shortcuts do not operate without update permission', async ({ page }) => {
  const runtime = await mockWorkHubFoundation(page, { designDetails: true, canUpdate: false });
  await page.goto(personalTaskRoute());
  const detail = page.getByRole('region', {
    name: 'Personal task keyboard shortcut region',
    exact: true,
  });
  await expect(detail).toBeVisible({ timeout: 20_000 });
  await expect(detail.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0);
  await detail.focus();
  await page.keyboard.press('e');
  await page.keyboard.press('c');
  await page.keyboard.press('Alt+Shift+KeyN');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(runtime.mutations).toHaveLength(0);
  expect(runtime.creations).toHaveLength(0);
});
