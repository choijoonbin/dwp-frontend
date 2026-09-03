import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import type { Locator, Page } from '@playwright/test';

import { mockShellSession } from './support/shell-session';

const reducedMotionAppearance = {
  mode: 'light',
  density: 'standard',
  highContrast: false,
  reduceMotion: true,
} as const;

type WorkspaceHomePreference = {
  layout: {
    widgets: Array<{
      widgetKey: string;
      visible: boolean;
    }>;
  };
  version: number;
};

type WorkspaceHomePreferenceUpdate = Pick<WorkspaceHomePreference, 'layout' | 'version'>;

function isWorkspaceHomePreferenceResponse(
  response: Parameters<Parameters<Page['waitForResponse']>[0]>[0],
  method: 'GET' | 'PUT'
) {
  return (
    new URL(response.url()).pathname === '/api/platform/v1/home-preferences' &&
    response.request().method() === method
  );
}

function widgetKeys(preference: WorkspaceHomePreference | WorkspaceHomePreferenceUpdate) {
  return preference.layout.widgets.map((widget) => widget.widgetKey);
}

function widgetVisibility(
  preference: WorkspaceHomePreference | WorkspaceHomePreferenceUpdate,
  widgetKey: string
) {
  return preference.layout.widgets.find((widget) => widget.widgetKey === widgetKey)?.visible;
}

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

async function ensureEditing(page: Page) {
  const editButton = page.getByRole('button', { name: 'Edit home' });
  const addButton = page.getByRole('button', { name: 'Add items' });
  await expect(editButton.or(addButton)).toBeVisible();
  if (await editButton.isVisible()) await editButton.click();
  else await expect(addButton).toBeVisible();
}

async function expectNoHorizontalOverflow(page: Page) {
  const widths = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(widths.scrollWidth).toBeLessThanOrEqual(widths.clientWidth);
}

async function expectMinimumTargetSize(targets: Locator, expectedCount: number, minimum = 44) {
  await expect(targets).toHaveCount(expectedCount);
  const sizes = await targets.evaluateAll((elements) =>
    elements.map((element) => {
      const bounds = element.getBoundingClientRect();
      return { width: bounds.width, height: bounds.height };
    })
  );
  for (const size of sizes) {
    expect(size.width).toBeGreaterThanOrEqual(minimum);
    expect(size.height).toBeGreaterThanOrEqual(minimum);
  }
}

test('opens the entitled app and widget library immediately without an empty restore state', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await startEditing(page);
  const dialog = await openItemLibrary(page);
  const items = dialog.locator('[data-home-gallery-item]');

  await expect(dialog.getByRole('tab', { name: /Library \d+/ })).toHaveAttribute(
    'aria-selected',
    'true'
  );
  await expect(dialog.getByText('Home item library preview', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('heading', { name: /Apps \d+/ })).toBeVisible();
  await expect(dialog.getByRole('heading', { name: /Widgets \d+/ })).toBeVisible();
  await expect(items.first()).toBeVisible();
  expect(await items.count()).toBeGreaterThanOrEqual(5);

  // The default member has no APP.CALENDAR entitlement. The catalog must not disclose it.
  await expect(dialog.locator('[data-home-gallery-item="widget:schedule"]')).toHaveCount(0);
  await expect(dialog.locator('[data-home-gallery-item="widget:activity"]')).toHaveAttribute(
    'data-home-gallery-state',
    'ADDED'
  );
  await expect(dialog.getByText('On home', { exact: true }).first()).toBeVisible();

  const search = dialog.getByLabel('Search apps and widgets');
  await search.fill('daily brief');
  await expect(dialog.locator('[data-home-gallery-item]')).toHaveCount(1);
  await expect(dialog.locator('[data-home-gallery-item="widget:daily-brief"]')).toBeVisible();
  await dialog.getByRole('button', { name: 'Reset filters' }).click();
  await expect(search).toBeFocused();

  await dialog.getByRole('button', { name: 'Widgets', exact: true }).click();
  expect(
    await dialog
      .locator('[data-home-gallery-item]')
      .evaluateAll((rows) => rows.map((row) => row.getAttribute('data-home-gallery-item')))
  ).toEqual(expect.arrayContaining(['widget:daily-brief', 'widget:focus', 'widget:activity']));
  await search.fill('a result that does not exist');
  const emptyState = dialog.locator('[data-home-gallery-empty]');
  await expect(emptyState).toHaveAccessibleName('No item matches this search and filter');
  await emptyState.getByRole('button', { name: 'Reset filters' }).click();
  await expect(search).toBeFocused();
  await expect(dialog.locator('[aria-live]')).toHaveCount(1);

  const accessibility = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
  await expect.soft(dialog).toHaveScreenshot('widget-library-default-1440.png', {
    animations: 'disabled',
  });
});

test('persists a hide and restore journey across reloads and restores focus safely', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const initialResponsePromise = page.waitForResponse((response) =>
    isWorkspaceHomePreferenceResponse(response, 'GET')
  );
  await page.goto('/');
  const initialPreference = (await (await initialResponsePromise).json())
    .data as WorkspaceHomePreference;
  expect(widgetVisibility(initialPreference, 'activity')).toBe(true);
  await page.getByRole('button', { name: 'Edit home' }).click();

  await page.getByRole('button', { name: 'Hide Live activity widget' }).click();
  const hideResponsePromise = page.waitForResponse((response) =>
    isWorkspaceHomePreferenceResponse(response, 'PUT')
  );
  await page.getByRole('button', { name: 'Save' }).click();
  const hideResponse = await hideResponsePromise;
  const hideRequest = hideResponse.request().postDataJSON() as WorkspaceHomePreferenceUpdate;
  const hiddenPreference = (await hideResponse.json()).data as WorkspaceHomePreference;
  const persistedWidgetKeys = widgetKeys(hideRequest);
  expect(hideRequest.version).toBe(initialPreference.version);
  expect(persistedWidgetKeys).toEqual([
    'command-rail',
    'schedule',
    'daily-brief',
    'focus',
    'activity',
  ]);
  expect(widgetVisibility(hideRequest, 'activity')).toBe(false);
  expect(hiddenPreference.version).toBe(initialPreference.version);
  expect(widgetKeys(hiddenPreference)).toEqual(persistedWidgetKeys);
  expect(widgetVisibility(hiddenPreference, 'activity')).toBe(false);
  await expect(page.getByText('Home view saved.')).toBeVisible();
  await expect(page).not.toHaveURL(/[?&]edit=home/u);
  await expect(page.getByRole('button', { name: 'Edit home' })).toBeVisible();

  const hiddenReloadPromise = page.waitForResponse((response) =>
    isWorkspaceHomePreferenceResponse(response, 'GET')
  );
  await page.reload();
  const hiddenReload = (await (await hiddenReloadPromise).json()).data as WorkspaceHomePreference;
  expect(hiddenReload.version).toBe(hiddenPreference.version);
  expect(widgetKeys(hiddenReload)).toEqual(persistedWidgetKeys);
  expect(widgetVisibility(hiddenReload, 'activity')).toBe(false);
  await ensureEditing(page);
  let dialog = await openItemLibrary(page);
  await expect(dialog.locator('[data-home-gallery-item="widget:activity"]')).toHaveAttribute(
    'data-home-gallery-state',
    'RESTORE'
  );

  await dialog.getByRole('tab', { name: 'Hidden 1' }).click();
  await dialog.getByRole('button', { name: 'Restore Live activity widget to home' }).click();
  await expect(dialog.locator('[data-home-gallery-empty]')).toBeFocused();
  await expect(dialog.locator('[data-home-gallery-empty]')).toHaveAccessibleName('No hidden items');
  await expect(dialog.locator('[aria-live]')).toHaveCount(1);
  await expect(dialog.getByRole('status')).toContainText(
    'Live activity was restored to the home draft.'
  );
  await dialog.getByRole('button', { name: 'Close the home item library' }).click();
  await expect(page.getByRole('button', { name: 'Add items' })).toBeFocused();
  const restoreResponsePromise = page.waitForResponse((response) =>
    isWorkspaceHomePreferenceResponse(response, 'PUT')
  );
  await page.getByRole('button', { name: 'Save' }).click();
  const restoreResponse = await restoreResponsePromise;
  const restoreRequest = restoreResponse.request().postDataJSON() as WorkspaceHomePreferenceUpdate;
  const restoredPreference = (await restoreResponse.json()).data as WorkspaceHomePreference;
  expect(restoreRequest.version).toBe(hiddenReload.version);
  expect(widgetKeys(restoreRequest)).toEqual(persistedWidgetKeys);
  expect(widgetVisibility(restoreRequest, 'activity')).toBe(true);
  expect(restoredPreference.version).toBe(hiddenReload.version + 1);
  expect(widgetKeys(restoredPreference)).toEqual(persistedWidgetKeys);
  expect(widgetVisibility(restoredPreference, 'activity')).toBe(true);
  await expect(page.getByText('Home view saved.')).toBeVisible();
  await expect(page).not.toHaveURL(/[?&]edit=home/u);
  await expect(page.getByRole('button', { name: 'Edit home' })).toBeVisible();

  const restoredReloadPromise = page.waitForResponse((response) =>
    isWorkspaceHomePreferenceResponse(response, 'GET')
  );
  await page.reload();
  const restoredReload = (await (await restoredReloadPromise).json())
    .data as WorkspaceHomePreference;
  expect(restoredReload.version).toBe(restoredPreference.version);
  expect(widgetKeys(restoredReload)).toEqual(persistedWidgetKeys);
  expect(widgetVisibility(restoredReload, 'activity')).toBe(true);
  await ensureEditing(page);
  dialog = await openItemLibrary(page);
  await expect(dialog.locator('[data-home-gallery-item="widget:activity"]')).toHaveAttribute(
    'data-home-gallery-state',
    'ADDED'
  );
  await expect(dialog.getByRole('tab', { name: 'Hidden 0' })).toBeVisible();
});

test('supports keyboard entry, Escape focus return, and 200 percent text sizing', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await startEditing(page);
  const addButton = page.getByRole('button', { name: 'Add items' });
  await addButton.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Add to home' });

  await expect(dialog.getByLabel('Search apps and widgets')).toBeFocused();
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  await expectNoHorizontalOverflow(page);

  const dialogOverflow = await dialog.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    clippedControls: Array.from(
      element.querySelectorAll<HTMLElement>('button, input, [role="tab"]')
    )
      .filter((control) => control.getClientRects().length > 0)
      .filter((control) => {
        const controlRect = control.getBoundingClientRect();
        const dialogRect = element.getBoundingClientRect();
        return controlRect.left < dialogRect.left - 1 || controlRect.right > dialogRect.right + 1;
      })
      .map((control) => control.getAttribute('aria-label') ?? control.textContent?.trim() ?? ''),
  }));
  expect(dialogOverflow.scrollWidth).toBeLessThanOrEqual(dialogOverflow.clientWidth + 1);
  expect(dialogOverflow.clippedControls).toEqual([]);

  const lastItem = dialog.locator('[data-home-gallery-item]').last();
  await lastItem.scrollIntoViewIfNeeded();
  await expect(lastItem).toBeInViewport();
  const lastItemReachable = await lastItem.evaluate((element) => {
    const scrollOwner = element.closest('.MuiDialogContent-root');
    if (!scrollOwner) return false;
    const itemRect = element.getBoundingClientRect();
    const ownerRect = scrollOwner.getBoundingClientRect();
    return itemRect.top >= ownerRect.top - 1 && itemRect.bottom <= ownerRect.bottom + 1;
  });
  expect(lastItemReachable).toBe(true);
  await page.keyboard.press('Escape');
  await expect(addButton).toBeFocused();
});

test('item library reflows without horizontal overflow on a 320px viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await startEditing(page);
  const dialog = await openItemLibrary(page);
  await expect(dialog.locator('[data-home-gallery-item]').first()).toBeVisible();

  const mobileFilterTargets = dialog
    .getByRole('group', { name: /Filter by (item type|home status)/ })
    .getByRole('button');
  await expectMinimumTargetSize(mobileFilterTargets, 6);

  const mobileChromeTargets = dialog.getByRole('button', {
    name: /^(Close the home item library|Return to home editing)$/,
  });
  await expectMinimumTargetSize(mobileChromeTargets, 2);
  const mobileStudioTarget = dialog.getByRole('button', { name: 'Home widget settings' });
  if ((await mobileStudioTarget.count()) > 0) {
    await expectMinimumTargetSize(mobileStudioTarget, 1);
  }

  await dialog.getByLabel('Search apps and widgets').fill('no matching home item');
  const mobileResetTargets = dialog.getByRole('button', { name: 'Reset filters' });
  await expectMinimumTargetSize(mobileResetTargets, 2);
  await mobileResetTargets.first().click();
  await expect(dialog.locator('[data-home-gallery-item]').first()).toBeVisible();

  await expectNoHorizontalOverflow(page);
  const footerAction = dialog.getByRole('button', { name: 'Return to home editing' });
  await expect(footerAction).toBeVisible();
  await expect.soft(dialog).toHaveScreenshot('widget-library-default-320.png', {
    animations: 'disabled',
  });

  const lastItem = dialog.locator('[data-home-gallery-item]').last();
  await lastItem.scrollIntoViewIfNeeded();
  await expect(lastItem).toBeInViewport();
  const lastItemBox = await lastItem.boundingBox();
  const footerBox = await dialog.locator('.MuiDialogActions-root').boundingBox();
  expect(lastItemBox).not.toBeNull();
  expect(footerBox).not.toBeNull();
  expect(lastItemBox!.y + lastItemBox!.height).toBeLessThanOrEqual(footerBox!.y + 1);
});

test('Korean item library preserves readable labels at 390px', async ({ page }) => {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    displayName: '김민아',
    appearance: reducedMotionAppearance,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: '홈 화면 편집' }).click();
  await page.getByRole('button', { name: '항목 추가' }).click();
  const dialog = page.getByRole('dialog', { name: '홈에 항목 추가' });

  await expect(dialog.getByRole('tab', { name: /라이브러리 \d+/ })).toHaveAttribute(
    'aria-selected',
    'true'
  );
  await expect(dialog.getByText('홈 항목 라이브러리 미리보기', { exact: true })).toBeVisible();
  await expect(dialog.locator('[data-home-gallery-item="widget:schedule"]')).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  await expect.soft(dialog).toHaveScreenshot('widget-library-default-ko-390.png', {
    animations: 'disabled',
  });
});

test('preserves structure and semantics in dark forced-colors mode', async ({ page }) => {
  await page.emulateMedia({
    colorScheme: 'dark',
    forcedColors: 'active',
    reducedMotion: 'reduce',
  });
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'en',
    displayName: 'Mina Kim',
    appearance: {
      mode: 'dark',
      density: 'standard',
      highContrast: true,
      reduceMotion: true,
    },
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await startEditing(page);
  const dialog = await openItemLibrary(page);

  await expect(dialog.getByRole('tab', { name: /Library \d+/ })).toHaveAttribute(
    'aria-selected',
    'true'
  );
  await expect(dialog.getByLabel('Search apps and widgets')).toBeFocused();
  await expect(dialog.locator('[aria-live]')).toHaveCount(1);
  await expectNoHorizontalOverflow(page);

  const forcedColorSelection = await dialog
    .getByRole('button', { name: 'All', exact: true })
    .first()
    .evaluate((element) => {
      const style = window.getComputedStyle(element);
      return {
        color: style.color,
        backgroundColor: style.backgroundColor,
        outlineStyle: style.outlineStyle,
        outlineWidth: Number.parseFloat(style.outlineWidth),
      };
    });
  expect(forcedColorSelection.color).not.toBe(forcedColorSelection.backgroundColor);
  expect(forcedColorSelection.outlineStyle).toBe('solid');
  expect(forcedColorSelection.outlineWidth).toBeGreaterThanOrEqual(2);
  const selectedTabOutline = await dialog
    .getByRole('tab', { name: /Library \d+/ })
    .evaluate((element) => window.getComputedStyle(element).outlineWidth);
  expect(Number.parseFloat(selectedTabOutline)).toBeGreaterThanOrEqual(2);

  const accessibility = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
  await page.addStyleTag({
    content: '[role="dialog"] input { caret-color: transparent !important; }',
  });
  await expect.soft(dialog).toHaveScreenshot('widget-library-forced-colors-1280.png', {
    animations: 'disabled',
  });
});
