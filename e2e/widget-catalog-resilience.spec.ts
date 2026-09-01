import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import type { Locator, Page } from '@playwright/test';

import { fulfillSuccess, mockShellSession } from './support/shell-session';

const reducedMotionAppearance = {
  mode: 'light',
  density: 'standard',
  highContrast: false,
  reduceMotion: true,
} as const;

type WorkspaceHomePreference = {
  schemaVersion: 5;
  surfaceKey: 'workspace-home';
  customized: boolean;
  layout: {
    appLayout: Record<string, unknown> | null;
    presentation: 'balanced' | 'expressive' | 'focused';
    widgets: Array<{
      widgetKey: string;
      visible: boolean;
      size: 'quarter' | 'medium' | 'full';
    }>;
  };
  version: number;
  updatedAt: string | null;
};

const concurrentHomePreference: WorkspaceHomePreference = {
  schemaVersion: 5,
  surfaceKey: 'workspace-home',
  customized: true,
  layout: {
    appLayout: null,
    presentation: 'focused',
    widgets: [
      { widgetKey: 'activity', visible: true, size: 'quarter' },
      { widgetKey: 'focus', visible: true, size: 'quarter' },
      { widgetKey: 'schedule', visible: true, size: 'quarter' },
      { widgetKey: 'daily-brief', visible: true, size: 'full' },
    ],
  },
  version: 1,
  updatedAt: '2026-08-28T01:00:00Z',
};

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'en',
    displayName: 'Mina Kim',
    appearance: reducedMotionAppearance,
  });
});

async function startEditing(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Edit home' }).click();
}

async function openItemLibrary(page: Page) {
  await page.getByRole('button', { name: 'Add items' }).click();
  return page.getByRole('dialog', { name: 'Add to home' });
}

async function expectActivityState(page: Page, state: 'ADDED' | 'RESTORE') {
  const dialog = await openItemLibrary(page);
  await expect(dialog.locator('[data-home-gallery-item="widget:activity"]')).toHaveAttribute(
    'data-home-gallery-state',
    state
  );
  return dialog;
}

async function failNextHomePreferenceSave(page: Page) {
  let failureCount = 0;
  await page.route('**/api/platform/v1/home-preferences', async (route) => {
    if (route.request().method() !== 'PUT' || failureCount > 0) {
      await route.fallback();
      return;
    }
    failureCount += 1;
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ERROR',
        message: 'Temporary save failure',
      }),
    });
  });
  return {
    get count() {
      return failureCount;
    },
  };
}

async function routeConcurrentHomePreference(page: Page) {
  let serverPreference = structuredClone(concurrentHomePreference);
  let conflictCount = 0;
  const submittedVersions: number[] = [];
  const submittedLayouts: WorkspaceHomePreference['layout'][] = [];
  await page.route('**/api/platform/v1/home-preferences', async (route) => {
    const request = route.request();
    if (request.method() === 'GET') {
      await fulfillSuccess(route, serverPreference);
      return;
    }
    if (request.method() !== 'PUT') {
      await route.fallback();
      return;
    }
    const body = request.postDataJSON() as {
      layout: WorkspaceHomePreference['layout'];
      version: number;
    };
    submittedVersions.push(body.version);
    submittedLayouts.push(structuredClone(body.layout));
    if (conflictCount === 0) {
      conflictCount += 1;
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ERROR', message: 'Version conflict' }),
      });
      return;
    }
    if (body.version !== serverPreference.version) {
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ERROR', message: 'Version conflict' }),
      });
      return;
    }
    serverPreference = {
      ...serverPreference,
      layout: body.layout,
      version: serverPreference.version + 1,
      updatedAt: '2026-08-28T01:01:00Z',
    };
    await fulfillSuccess(route, serverPreference);
  });
  return {
    submittedLayouts,
    submittedVersions,
    get conflictCount() {
      return conflictCount;
    },
    get serverVersion() {
      return serverPreference.version;
    },
  };
}

async function expectNoHorizontalOverflow(page: Page) {
  const widths = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(widths.scrollWidth).toBeLessThanOrEqual(widths.clientWidth);
}

async function expectAccessibleDialogWithoutOverflow(page: Page, dialog: Locator) {
  await expectNoHorizontalOverflow(page);
  const dialogWidths = await dialog.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(dialogWidths.scrollWidth).toBeLessThanOrEqual(dialogWidths.clientWidth + 1);
  const accessibility = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
}

test('keeps a hidden widget draft after a 500 and persists it on retry', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await startEditing(page);
  const injectedFailure = await failNextHomePreferenceSave(page);

  await page.getByRole('button', { name: 'Hide Live activity widget' }).click();
  const saveButton = page.getByRole('button', { name: 'Save' });
  await saveButton.click();

  await expect(page.getByText('The home preference could not be saved.')).toBeVisible();
  expect(injectedFailure.count).toBe(1);
  await expect(saveButton).toBeEnabled();
  let dialog = await expectActivityState(page, 'RESTORE');
  await dialog.getByRole('button', { name: 'Close the home item library' }).click();
  await expect(dialog).toBeHidden();

  await saveButton.focus();
  await expect(saveButton).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Home view saved.')).toBeVisible();

  await page.reload();
  await page.getByRole('button', { name: 'Edit home' }).click();
  dialog = await expectActivityState(page, 'RESTORE');
  await expect(dialog.getByRole('tab', { name: 'Hidden 1' })).toBeVisible();
});

test('discards a gallery draft only after confirmation without mutating the saved home', async ({
  page,
}) => {
  await startEditing(page);
  let saveCount = 0;
  await page.route('**/api/platform/v1/home-preferences', async (route) => {
    if (route.request().method() === 'PUT') saveCount += 1;
    await route.fallback();
  });

  await page.getByRole('button', { name: 'Hide Live activity widget' }).click();
  let dialog = await expectActivityState(page, 'RESTORE');
  await dialog.getByRole('button', { name: 'Close the home item library' }).click();

  const cancelButton = page.getByRole('button', { name: 'Cancel changes' });
  await cancelButton.click();
  const confirmation = page.getByRole('alertdialog', { name: 'Discard your home changes?' });
  await confirmation.getByRole('button', { name: 'Keep editing' }).click();
  await expect(cancelButton).toBeFocused();
  dialog = await expectActivityState(page, 'RESTORE');
  await dialog.getByRole('button', { name: 'Close the home item library' }).click();

  await cancelButton.click();
  await confirmation.getByRole('button', { name: 'Discard changes' }).click();
  await expect(page.getByRole('button', { name: 'Edit home' })).toBeVisible();
  expect(saveCount).toBe(0);

  await page.reload();
  await startEditing(page);
  await expectActivityState(page, 'ADDED');
});

test('keeps a hidden widget draft when a 409 conflict is dismissed', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await startEditing(page);
  const conflictState = await routeConcurrentHomePreference(page);

  await page.getByRole('button', { name: 'Hide Live activity widget' }).click();
  await page.getByRole('button', { name: 'Save' }).click();

  const conflict = page.getByRole('dialog', { name: 'Your home changed in another session' });
  await expect(conflict).toBeVisible();
  expect(conflictState.conflictCount).toBe(1);
  expect(conflictState.submittedVersions).toEqual([0]);
  await expect(conflict.getByText(/My draft: 1 change/)).toBeVisible();
  await expect(conflict.getByText('Latest version: 1')).toBeVisible();
  await expect(
    page.getByText('A newer home version was found. Your draft has been kept.')
  ).toBeVisible();
  expect(await conflict.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await expectAccessibleDialogWithoutOverflow(page, conflict);
  const content = conflict.locator('.MuiDialogContent-root');
  const contentExtent = await content.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
  expect(contentExtent.scrollHeight).toBeGreaterThan(contentExtent.clientHeight);
  await content.focus();
  await expect(content).toBeFocused();
  const initialScrollTop = await content.evaluate((element) => element.scrollTop);
  await page.keyboard.press('PageDown');
  await expect
    .poll(() => content.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(initialScrollTop);

  const reloadButton = conflict.getByRole('button', { name: 'Reload latest' });
  const keepEditingButton = conflict.getByRole('button', { name: 'Keep editing' });
  const reapplyButton = conflict.getByRole('button', { name: 'Reapply my draft' });
  await page.keyboard.press('Tab');
  await expect(reloadButton).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(keepEditingButton).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(reapplyButton).toBeFocused();
  await page.keyboard.press('Escape');

  await expect(conflict).toBeHidden();
  const saveButton = page.getByRole('button', { name: 'Save' });
  await expect(saveButton).toBeFocused();
  await expect(saveButton).toBeEnabled();
  await expectActivityState(page, 'RESTORE');
});

test('reapplies a widget draft after a 409 without overwriting the latest home', async ({
  page,
}) => {
  await startEditing(page);
  const conflictState = await routeConcurrentHomePreference(page);

  await page.getByRole('button', { name: 'Hide Live activity widget' }).click();
  await page.getByRole('button', { name: 'Save' }).click();

  const conflict = page.getByRole('dialog', { name: 'Your home changed in another session' });
  await expect(conflict).toBeVisible();
  expect(conflictState.conflictCount).toBe(1);
  expect(conflictState.submittedVersions).toEqual([0]);
  const reapplyButton = conflict.getByRole('button', { name: 'Reapply my draft' });
  await reapplyButton.focus();
  await page.keyboard.press('Enter');
  await expect(conflict).toBeHidden();

  const saveButton = page.getByRole('button', { name: 'Save' });
  await expect(saveButton).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Home view saved.')).toBeVisible();
  expect(conflictState.submittedVersions).toEqual([0, 1]);
  expect(conflictState.submittedLayouts[1]?.presentation).toBe('focused');
  expect(conflictState.submittedLayouts[1]?.widgets).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ widgetKey: 'activity', visible: false }),
      expect.objectContaining({ widgetKey: 'focus', visible: true, size: 'quarter' }),
    ])
  );
  expect(conflictState.submittedLayouts[1]?.widgets.map((widget) => widget.widgetKey)).toEqual([
    'activity',
    'focus',
    'schedule',
    'daily-brief',
    'command-rail',
  ]);
  expect(conflictState.serverVersion).toBe(2);

  await page.reload();
  await page.getByRole('button', { name: 'Edit home' }).click();
  await expectActivityState(page, 'RESTORE');
});

test('restores a widget by keyboard and returns focus at 320px without accessibility regressions', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await startEditing(page);

  const hideButton = page.getByRole('button', { name: 'Hide Live activity widget' });
  await hideButton.focus();
  await page.keyboard.press('Enter');

  const addButton = page.getByRole('button', { name: 'Add items' });
  await addButton.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Add to home' });
  await expect(dialog.getByLabel('Search apps and widgets')).toBeFocused();

  await expectAccessibleDialogWithoutOverflow(page, dialog);

  const hiddenTab = dialog.getByRole('tab', { name: 'Hidden 1' });
  await hiddenTab.focus();
  await page.keyboard.press('Enter');
  const restoreButton = dialog.getByRole('button', {
    name: 'Restore Live activity widget to home',
  });
  await restoreButton.focus();
  await page.keyboard.press('Enter');

  const emptyState = dialog.locator('[data-home-gallery-empty]');
  await expect(emptyState).toBeFocused();
  await expect(emptyState).toHaveAccessibleName('No hidden items');
  await expect(dialog.getByRole('status')).toContainText(
    'Live activity was restored to the home draft.'
  );

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(addButton).toBeFocused();

  const saveButton = page.getByRole('button', { name: 'Save' });
  await expect(saveButton).toBeDisabled();
});
