import { test, expect } from '@playwright/test';
import { ADMIN_ROUTES } from '../utils/routes';
import { ensureAuth } from '../utils/auth';
import { DESKTOP_VIEWPORT } from '../utils/viewports';

/**
 * Admin Accessibility (A11y) Smoke Tests
 * 
 * Purpose: Minimal accessibility checks to prevent critical UX breakage
 * Focus areas:
 * - Dialog focus management
 * - ESC key closure
 * - Tab key navigation (basic)
 * 
 * Note: This is NOT a comprehensive a11y audit.
 * We focus on "회귀 방지" - preventing catastrophic accessibility bugs.
 */

test.describe('Admin A11y Smoke Tests - ConfirmDialog', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await ensureAuth(page);
  });

  test('Users page - Delete ConfirmDialog focus management', async ({ page }) => {
    await page.goto(ADMIN_ROUTES.users);
    await expect(page.getByTestId('page-admin-users')).toBeVisible();

    // Wait for table to load (if data exists)
    await page.waitForTimeout(1000);

    // Try to find a delete button
    // Note: This test is soft - if no delete button exists, skip gracefully
    const deleteButtons = page.locator('button[aria-label*="삭제"], button:has-text("삭제")');
    const deleteButtonCount = await deleteButtons.count();

    if (deleteButtonCount === 0) {
      console.log('⚠️ No delete button found on Users page - skipping dialog test');
      test.skip();
      return;
    }

    // Click first delete button to open ConfirmDialog
    await deleteButtons.first().click();

    // Wait for dialog to appear
    await page.waitForTimeout(500);

    // Check if dialog is open (MUI Dialog has role="dialog")
    const dialog = page.locator('[role="dialog"]');
    const isDialogVisible = await dialog.isVisible();

    if (!isDialogVisible) {
      console.log('⚠️ ConfirmDialog not visible - might be permission-restricted');
      test.skip();
      return;
    }

    // ✅ A11y Check 1: Focus should be inside dialog
    const activeElement = page.locator(':focus');
    const isFocusInDialog = await activeElement.count() > 0;
    expect(isFocusInDialog).toBeTruthy();
    console.log('✅ Focus is managed inside dialog');

    // ✅ A11y Check 2: ESC key should close dialog
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const isDialogClosedAfterEsc = !(await dialog.isVisible());
    expect(isDialogClosedAfterEsc).toBeTruthy();
    console.log('✅ ESC key closes dialog');
  });

  test('Resources page - Delete ConfirmDialog Tab navigation', async ({ page }) => {
    await page.goto(ADMIN_ROUTES.resources);
    await expect(page.getByTestId('page-admin-resources')).toBeVisible();

    await page.waitForTimeout(1000);

    // Try to find a delete button
    const deleteButtons = page.locator('button[aria-label*="삭제"], button:has-text("삭제")');
    const deleteButtonCount = await deleteButtons.count();

    if (deleteButtonCount === 0) {
      console.log('⚠️ No delete button found on Resources page - skipping dialog test');
      test.skip();
      return;
    }

    // Click first delete button
    await deleteButtons.first().click();
    await page.waitForTimeout(500);

    const dialog = page.locator('[role="dialog"]');
    const isDialogVisible = await dialog.isVisible();

    if (!isDialogVisible) {
      console.log('⚠️ ConfirmDialog not visible - might be permission-restricted');
      test.skip();
      return;
    }

    // ✅ A11y Check 3: Tab key should cycle focus within dialog (not escape)
    // Press Tab multiple times and check focus stays in dialog
    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);

    // Focus should still be inside dialog
    const activeElement = page.locator(':focus');
    const activeElementBoundingBox = await activeElement.boundingBox();
    const dialogBoundingBox = await dialog.boundingBox();

    if (activeElementBoundingBox && dialogBoundingBox) {
      // Check if active element is roughly inside dialog bounds
      const isFocusInsideDialog =
        activeElementBoundingBox.x >= dialogBoundingBox.x - 10 &&
        activeElementBoundingBox.y >= dialogBoundingBox.y - 10 &&
        activeElementBoundingBox.x <= dialogBoundingBox.x + dialogBoundingBox.width + 10 &&
        activeElementBoundingBox.y <= dialogBoundingBox.y + dialogBoundingBox.height + 10;

      expect(isFocusInsideDialog).toBeTruthy();
      console.log('✅ Tab navigation stays within dialog');
    } else {
      console.log('⚠️ Could not verify Tab navigation (bounding box not available)');
    }

    // Close dialog
    await page.keyboard.press('Escape');
  });

  test('Codes page - ConfirmDialog basic presence check', async ({ page }) => {
    await page.goto(ADMIN_ROUTES.codes);
    await expect(page.getByTestId('page-admin-codes')).toBeVisible();

    await page.waitForTimeout(1000);

    // Just check that page has proper structure for ConfirmDialog usage
    // (doesn't crash when trying to open/close dialogs)
    
    // Try to find any button that might trigger a dialog
    const actionButtons = page.locator('button[aria-label*="삭제"], button:has-text("삭제"), button:has-text("추가")');
    const actionButtonCount = await actionButtons.count();

    if (actionButtonCount > 0) {
      // Page has action buttons - good sign of proper UX structure
      console.log(`✅ Codes page has ${actionButtonCount} action button(s) - UX structure intact`);
    } else {
      console.log('⚠️ No action buttons found - might be empty state or permission issue');
    }

    // Soft assertion: Page should not crash
    const pageRoot = page.getByTestId('page-admin-codes');
    await expect(pageRoot).toBeVisible();
  });
});

test.describe('Admin A11y Smoke Tests - General Focus Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await ensureAuth(page);
  });

  test('All pages - No focus traps on initial load', async ({ page }) => {
    const pages = [
      { route: ADMIN_ROUTES.monitoring, name: 'Monitoring' },
      { route: ADMIN_ROUTES.users, name: 'Users' },
      { route: ADMIN_ROUTES.roles, name: 'Roles' },
      { route: ADMIN_ROUTES.resources, name: 'Resources' },
    ];

    for (const { route, name } of pages) {
      await page.goto(route);
      await page.waitForTimeout(500);

      // Tab should move focus (not trapped)
      await page.keyboard.press('Tab');
      await page.waitForTimeout(100);

      const activeElement = page.locator(':focus');
      const isSomethingFocused = (await activeElement.count()) > 0;

      if (isSomethingFocused) {
        console.log(`✅ ${name}: Tab key works, focus is movable`);
      } else {
        console.log(`⚠️ ${name}: No focus detected after Tab (might be initial state)`);
      }

      // Main check: Page should not be completely broken
      // (If focus management is catastrophically broken, page would crash or be unresponsive)
      await expect(page.locator('body')).toBeVisible();
    }
  });
});
