import { expect, test } from '@playwright/test';

import { mockWorkHubFoundation, personalTaskRoute } from './support/work-hub-foundation-fixtures';

import type { Page } from '@playwright/test';

const personalTaskCreateEndpoint = '**/api/platform/v1/workspace/work-hub/personal-tasks';

async function expectNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
  ).toBeLessThanOrEqual(1);
}

test('mobile FormDialog actions keep 44px targets through busy and forced-colors reflow', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'The mobile target contract runs once.');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  await mockWorkHubFoundation(page, { designDetails: true, highContrast: true });

  let releaseMutation: (() => void) | undefined;
  await page.route(personalTaskCreateEndpoint, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    await new Promise<void>((resolve) => {
      releaseMutation = resolve;
    });
    await route.fallback();
  });

  await page.goto('/work/queue?compose=task');
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  const dialog = page.getByRole('dialog', { name: 'Add a personal task' });
  await expect(dialog).toBeVisible({ timeout: 20_000 });
  const cancel = dialog.getByRole('button', { name: 'Cancel', exact: true });
  const submit = dialog.locator('button[type="submit"]');

  for (const action of [cancel, submit]) {
    const bounds = await action.boundingBox();
    expect(bounds?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(bounds?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
  await dialog.getByRole('textbox', { name: 'Title', exact: false }).fill('Verify mobile target');
  await expect(submit).toBeEnabled();
  await submit.focus();
  await expect(submit).toBeFocused();
  expect(await submit.evaluate((element) => element.matches(':focus-visible'))).toBe(true);
  await expectNoHorizontalOverflow(page);

  await submit.click();
  await expect(submit).toBeDisabled();
  await expect(submit).toHaveAttribute('aria-busy', 'true');
  await expect(cancel).toBeDisabled();
  const busyBounds = await submit.boundingBox();
  expect(busyBounds?.height ?? 0).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true);

  expect(typeof releaseMutation).toBe('function');
  releaseMutation?.();
  await expect(dialog).toHaveCount(0);

  await page.goto(personalTaskRoute());
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  await page
    .getByRole('article')
    .getByRole('button', { name: 'Schedule work time', exact: true })
    .click();
  const scheduleDialog = page.getByRole('dialog', { name: 'Schedule work time', exact: true });
  await expect(scheduleDialog).toBeVisible();
  for (const action of [
    scheduleDialog.getByRole('button', { name: 'Cancel', exact: true }),
    scheduleDialog.getByRole('button', {
      name: 'Reserve focus time in personal Calendar (Direct)',
      exact: true,
    }),
  ]) {
    const bounds = await action.boundingBox();
    expect(bounds?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(bounds?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
  await expectNoHorizontalOverflow(page);
});

test('desktop FormDialog retains the compact theme density', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'The desktop density contract runs once.');
  await page.setViewportSize({ width: 1280, height: 800 });
  await mockWorkHubFoundation(page);
  await page.goto('/work/queue?compose=task');
  const dialog = page.getByRole('dialog', { name: 'Add a personal task' });
  await expect(dialog).toBeVisible({ timeout: 20_000 });
  const submit = dialog.locator('button[type="submit"]');
  const bounds = await submit.boundingBox();
  expect(bounds?.height ?? 0).toBeGreaterThan(0);
  expect(bounds?.height ?? 0).toBeLessThan(44);
});

test('wide coarse-pointer FormDialog keeps 44px footer targets without forcing full-screen', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'The coarse-pointer contract runs once.');
  await page.setViewportSize({ width: 1024, height: 768 });
  await mockWorkHubFoundation(page);
  await page.goto('/work/queue?compose=task');
  expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
  const dialog = page.getByRole('dialog', { name: 'Add a personal task' });
  await expect(dialog).toBeVisible({ timeout: 20_000 });
  for (const action of [
    dialog.getByRole('button', { name: 'Cancel', exact: true }),
    dialog.locator('button[type="submit"]'),
  ]) {
    const bounds = await action.boundingBox();
    expect(bounds?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(bounds?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
});
