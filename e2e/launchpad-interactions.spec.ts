import { expect, test } from '@playwright/test';

import { mockShellSession } from './support/shell-session';
import { mockShellHomeReadModels } from './support/shell-spec-foundation';

import type { Locator } from '@playwright/test';

type LaunchpadPoint = Readonly<{ x: number; y: number }>;

async function readItemIds(list: Locator): Promise<(string | null)[]> {
  return list
    .locator('[data-launchpad-item]')
    .evaluateAll((items) => items.map((item) => item.getAttribute('data-launchpad-item')));
}

async function readTileCenter(tile: Locator): Promise<LaunchpadPoint> {
  await tile.scrollIntoViewIfNeeded();
  const bounds = await tile.boundingBox();
  if (!bounds) throw new Error('The launchpad tile does not have visible bounds.');
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
}

async function readReorderPoint(item: Locator): Promise<LaunchpadPoint> {
  const bounds = await item.boundingBox();
  if (!bounds) throw new Error('The launchpad reorder target does not have visible bounds.');
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height - 8 };
}

test.beforeEach(async ({ page }) => {
  await mockShellSession(page, ['ADMIN'], {
    displayName: 'Admin',
    jobTitle: 'Platform administrator',
  });
  await mockShellHomeReadModels(page);
});

test('long-press jitter is safe and the first intentional drag commits its exact preview', async ({
  page,
}, testInfo) => {
  test.slow();
  test.skip(testInfo.project.name === 'mobile', 'The compact mobile home omits the launchpad.');

  await page.setViewportSize({ width: 1920, height: 900 });
  await page.goto('/');

  const launchpad = page.locator('[data-launchpad-surface="page"]');
  const startWorkApps = page.locator('[data-launchpad-group-target="work"]');
  const defaultItems = ['dwp-work', 'dwp-ask', 'dwp-activity'];
  const openWork = page.getByRole('button', { name: 'Open Work', exact: true });
  await expect(openWork).toBeVisible();
  await expect.poll(() => readItemIds(startWorkApps)).toEqual(defaultItems);

  const jitterOrigin = await readTileCenter(openWork);
  await page.mouse.move(jitterOrigin.x, jitterOrigin.y);
  await page.mouse.down();
  try {
    await page.waitForTimeout(650);
    await expect(launchpad).toHaveAttribute('data-launchpad-editing', 'true');
    await page.mouse.move(jitterOrigin.x + 8, jitterOrigin.y, { steps: 4 });
    await expect(page.locator('[data-launchpad-drop-preview="true"]')).toHaveCount(0);
  } finally {
    await page.mouse.up();
  }
  await expect.poll(() => readItemIds(startWorkApps)).toEqual(defaultItems);

  await page.goto('/');
  await expect(launchpad).not.toHaveAttribute('data-launchpad-editing', 'true');
  await expect(openWork).toBeVisible();
  const workCenter = await readTileCenter(openWork);
  const activityReorderPoint = await readReorderPoint(
    page.locator('[data-launchpad-item="dwp-activity"]')
  );
  await page.mouse.move(workCenter.x, workCenter.y);
  await page.mouse.down();
  try {
    await page.waitForTimeout(650);
    await expect(launchpad).toHaveAttribute('data-launchpad-editing', 'true');
    await page.mouse.move(activityReorderPoint.x, activityReorderPoint.y, { steps: 18 });

    const previewItems = ['dwp-ask', 'dwp-activity', 'dwp-work'];
    await expect(
      page.locator('[data-launchpad-item="dwp-work"][data-launchpad-drop-preview="true"]')
    ).toBeVisible();
    await expect(page.locator('[data-launchpad-reorder-indicator="true"]')).toBeVisible();
    await expect.poll(() => readItemIds(startWorkApps)).toEqual(previewItems);
  } finally {
    await page.mouse.up();
  }

  const committedItems = ['dwp-ask', 'dwp-activity', 'dwp-work'];
  await expect.poll(() => readItemIds(startWorkApps)).toEqual(committedItems);
  await expect(page.locator('[data-launchpad-drop-preview="true"]')).toHaveCount(0);
  await expect(page.locator('[data-launchpad-reorder-indicator="true"]')).toHaveCount(0);

  const moveWorkCenter = await readTileCenter(
    page.locator('[data-launchpad-item="dwp-work"] [data-launchpad-tile]')
  );
  const askTargetCenter = await readTileCenter(page.locator('[data-folder-target="dwp-ask"]'));
  await page.mouse.move(moveWorkCenter.x, moveWorkCenter.y);
  await page.mouse.down();
  await page.mouse.move(askTargetCenter.x, askTargetCenter.y, { steps: 18 });
  await expect(launchpad).toHaveAttribute('data-launchpad-folder-candidate', 'dwp-ask');
  await expect(launchpad).toHaveAttribute('data-launchpad-folder-ready', 'dwp-ask');
  const askFolderTarget = page.locator('[data-folder-target="dwp-ask"]');
  await expect(askFolderTarget).toHaveAttribute('data-launchpad-folder-drop', 'ready');
  await expect(askFolderTarget.locator('[data-launchpad-folder-feedback="ready"]')).toContainText(
    'Release to create folder'
  );

  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(launchpad).not.toHaveAttribute('data-launchpad-folder-candidate');
  await expect(launchpad).not.toHaveAttribute('data-launchpad-folder-ready');
  await expect(page.getByRole('dialog', { name: 'Create folder' })).toHaveCount(0);
  await expect.poll(() => readItemIds(startWorkApps)).toEqual(committedItems);
});

test('visible app actions support precise keyboard reorder and folder setup', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'The compact mobile home omits the launchpad.');

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');

  const launchpad = page.locator('[data-launchpad-surface="page"]');
  const startWorkApps = page.locator('[data-launchpad-group-target="work"]');
  const workActions = page.locator('[data-launchpad-more-actions="dwp-work"]');
  await expect(workActions).toBeHidden();
  const editHome = page.locator('[data-home-edit-trigger]');
  await expect(editHome).toContainText('Edit home');
  await editHome.click();
  await expect(launchpad).toHaveAttribute('data-launchpad-editing', 'true');
  await expect(workActions).toBeVisible();
  await expect(workActions).toHaveAccessibleName('More actions for Work');

  await workActions.focus();
  await expect(workActions).toBeFocused();
  await page.keyboard.press('Enter');
  const actionsMenu = page.getByRole('menu', { name: 'Edit actions for Work' });
  await expect(actionsMenu).toBeVisible();
  await actionsMenu.getByRole('menuitem', { name: 'Move later' }).focus();
  await page.keyboard.press('Enter');
  await expect
    .poll(() => readItemIds(startWorkApps))
    .toEqual(['dwp-ask', 'dwp-work', 'dwp-activity']);

  await page.locator('[data-launchpad-more-actions="dwp-work"]').click();
  await page
    .getByRole('menu', { name: 'Edit actions for Work' })
    .getByRole('menuitem', { name: 'Create a folder with another app' })
    .click();
  const partnerDialog = page.getByRole('dialog', {
    name: 'Choose an app to group with Work',
  });
  await expect(partnerDialog).toBeVisible();
  await partnerDialog.getByRole('button', { name: 'Group with DWAI·ON Workspace' }).click();

  const createDialog = page.getByRole('dialog', { name: 'Create folder' });
  await expect(createDialog.getByRole('textbox', { name: 'Folder name' })).toHaveValue(
    'Start work folder'
  );
  await createDialog.getByRole('button', { name: 'Cancel' }).click();
  await expect
    .poll(() => readItemIds(startWorkApps))
    .toEqual(['dwp-ask', 'dwp-work', 'dwp-activity']);
});

test.describe('launchpad touch input', () => {
  test.use({ hasTouch: true, viewport: { width: 1280, height: 900 } });

  test('a sustained touch can enter edit mode and complete its first move', async ({
    page,
    browserName,
  }, testInfo) => {
    test.slow();
    test.skip(testInfo.project.name === 'mobile', 'The compact mobile home omits the launchpad.');
    test.skip(browserName !== 'chromium', 'The touch gesture uses Chromium input events.');

    await page.goto('/');

    const launchpad = page.locator('[data-launchpad-surface="page"]');
    const startWorkApps = page.locator('[data-launchpad-group-target="work"]');
    const workCenter = await readTileCenter(
      page.getByRole('button', { name: 'Open Work', exact: true })
    );
    const activityReorderPoint = await readReorderPoint(
      page.locator('[data-launchpad-item="dwp-activity"]')
    );
    const cdp = await page.context().newCDPSession(page);

    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ id: 1, x: workCenter.x, y: workCenter.y }],
    });
    try {
      await page.waitForTimeout(650);
      await expect(launchpad).toHaveAttribute('data-launchpad-editing', 'true');
      for (let step = 1; step <= 12; step += 1) {
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [
            {
              id: 1,
              x: workCenter.x + ((activityReorderPoint.x - workCenter.x) * step) / 12,
              y: workCenter.y + ((activityReorderPoint.y - workCenter.y) * step) / 12,
            },
          ],
        });
        await page.evaluate(
          () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
        );
      }
      await expect(page.locator('[data-launchpad-reorder-indicator="true"]')).toBeVisible();
      await expect
        .poll(() => readItemIds(startWorkApps))
        .toEqual(['dwp-ask', 'dwp-activity', 'dwp-work']);
    } finally {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await cdp.detach();
    }

    await expect
      .poll(() => readItemIds(startWorkApps))
      .toEqual(['dwp-ask', 'dwp-activity', 'dwp-work']);
    await expect(page.locator('[data-launchpad-drop-preview="true"]')).toHaveCount(0);
  });
});
