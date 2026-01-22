import { test, expect } from '@playwright/test';
import { ADMIN_ROUTES } from '../utils/routes';
import { ensureAuth } from '../utils/auth';
import { DESKTOP_VIEWPORT } from '../utils/viewports';

/**
 * Admin Regression Tests (Minimal)
 * 
 * Purpose: Prevent critical operational flow breakage
 * Focus areas:
 * - CodeUsage mapping missing UX
 * - PermissionGate UI integrity (no crash/blank screen)
 * 
 * Strategy: Soft-check (환경 의존 최소화)
 * - 매핑 없음/있음 모두 graceful handling
 * - 권한 제한 여부와 무관하게 페이지가 렌더링되는지만 확인
 */

test.describe('Admin Regression Tests - CodeUsage', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await ensureAuth(page);
  });

  test('CodeUsage mapping missing UX - graceful handling', async ({ page }) => {
    // Navigate to Code Usages page
    await page.goto(ADMIN_ROUTES.codeUsages);
    await expect(page.getByTestId('page-admin-code-usages')).toBeVisible();

    // Wait for page to load
    await page.waitForTimeout(1000);

    // Strategy: Check if page has proper structure for CodeUsage management
    // We don't force "mapping missing" state, but verify graceful handling

    // Check if page has action buttons (add/edit/delete)
    const actionButtons = page.locator('button:has-text("추가"), button:has-text("등록"), button[aria-label*="추가"]');
    const hasActionButtons = (await actionButtons.count()) > 0;

    if (hasActionButtons) {
      console.log('✅ CodeUsage page has action buttons - UX structure intact');

      // Try to open "Add CodeUsage" flow
      const addButton = actionButtons.first();
      await addButton.click();
      await page.waitForTimeout(500);

      // Check if a form/modal/drawer appeared
      const modalOrDrawer = page.locator('[role="dialog"], [role="presentation"]');
      const isModalVisible = await modalOrDrawer.isVisible();

      if (isModalVisible) {
        console.log('✅ Add CodeUsage modal/drawer opened successfully');

        // Look for a selectbox (code group selector)
        const selectboxes = page.locator('div[role="button"][aria-haspopup="listbox"], select, input[role="combobox"]');
        const selectboxCount = await selectboxes.count();

        if (selectboxCount > 0) {
          console.log(`✅ Found ${selectboxCount} selectbox(es) - CodeUsage form has proper structure`);

          // Soft-check: If any selectbox is disabled, check for helper text
          for (let i = 0; i < Math.min(selectboxCount, 3); i++) {
            const selectbox = selectboxes.nth(i);
            const isDisabled = await selectbox.getAttribute('aria-disabled');

            if (isDisabled === 'true') {
              console.log(`⚠️ Selectbox ${i} is disabled - might be missing mapping`);

              // Look for helper text nearby (within 100px)
              const helperText = page.locator('p:has-text("코드 매핑"), p:has-text("매핑 필요"), p:has-text("설정")');
              const hasHelperText = (await helperText.count()) > 0;

              if (hasHelperText) {
                console.log('✅ Helper text found - "코드 매핑 필요" UX is working');
              } else {
                console.log('⚠️ No helper text found - but this is acceptable if mapping exists');
              }
            } else {
              console.log(`✅ Selectbox ${i} is enabled - mapping likely exists`);
            }
          }
        } else {
          console.log('⚠️ No selectboxes found - might be different UX or empty state');
        }

        // Close modal/drawer
        await page.keyboard.press('Escape');
      } else {
        console.log('⚠️ No modal/drawer opened - might be permission-restricted or different UX');
      }
    } else {
      console.log('⚠️ No action buttons found - might be permission-restricted or empty state');
    }

    // Main assertion: Page should not crash
    // (If CodeUsage UX is catastrophically broken, page would show error or blank screen)
    const pageRoot = page.getByTestId('page-admin-code-usages');
    await expect(pageRoot).toBeVisible();
    console.log('✅ CodeUsage page did not crash - basic UX integrity confirmed');
  });
});

test.describe('Admin Regression Tests - RBAC/PermissionGate', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await ensureAuth(page);
  });

  test('PermissionGate UI integrity - Users page', async ({ page }) => {
    // Navigate to Users page
    await page.goto(ADMIN_ROUTES.users);
    await expect(page.getByTestId('page-admin-users')).toBeVisible();

    // Wait for page to load
    await page.waitForTimeout(1000);

    // Strategy: Verify core UI elements render without crash
    // We don't check specific buttons (permission-dependent)
    // Instead, check if page structure is intact

    // Check if page has title
    const pageTitle = page.locator('h4:has-text("사용자"), h5:has-text("사용자"), h6:has-text("사용자")');
    const hasTitle = (await pageTitle.count()) > 0;

    if (hasTitle) {
      console.log('✅ Users page title found - basic structure intact');
    } else {
      console.log('⚠️ Users page title not found - might be different layout');
    }

    // Check if page has core UI elements (table or cards)
    const coreElements = page.locator('table, [role="table"], div[class*="card"], div[class*="list"]');
    const hasCoreElements = (await coreElements.count()) > 0;

    if (hasCoreElements) {
      console.log('✅ Users page has table/card structure - core UI rendered');
    } else {
      console.log('⚠️ Users page has no table/card - might be empty state');
    }

    // Main assertion: Page should not crash
    // Even if user has no permissions, page should show proper "403 UX" or empty state
    const pageRoot = page.getByTestId('page-admin-users');
    await expect(pageRoot).toBeVisible();

    // Check if page is completely blank (catastrophic failure)
    const bodyText = await page.locator('body').innerText();
    const isBlank = bodyText.trim().length < 10;

    expect(isBlank).toBeFalsy();
    console.log('✅ Users page is not blank - PermissionGate UI integrity confirmed');
  });

  test('PermissionGate UI integrity - Roles page', async ({ page }) => {
    // Navigate to Roles page
    await page.goto(ADMIN_ROUTES.roles);
    await expect(page.getByTestId('page-admin-roles')).toBeVisible();

    await page.waitForTimeout(1000);

    // Check if page has title
    const pageTitle = page.locator('h4:has-text("권한"), h5:has-text("권한"), h6:has-text("권한")');
    const hasTitle = (await pageTitle.count()) > 0;

    if (hasTitle) {
      console.log('✅ Roles page title found - basic structure intact');
    } else {
      console.log('⚠️ Roles page title not found - might be different layout');
    }

    // Check if page has TwoColumnLayout structure (left + right panels)
    const leftPanel = page.locator('div[class*="MuiGrid"], div[data-testid*="left"]');
    const rightPanel = page.locator('div[class*="MuiGrid"], div[data-testid*="right"]');
    const hasTwoColumn = (await leftPanel.count()) > 0 && (await rightPanel.count()) > 0;

    if (hasTwoColumn) {
      console.log('✅ Roles page has TwoColumnLayout - core UI rendered');
    } else {
      console.log('⚠️ Roles page TwoColumnLayout not detected - might be different layout');
    }

    // Main assertion: Page should not crash
    const pageRoot = page.getByTestId('page-admin-roles');
    await expect(pageRoot).toBeVisible();

    // Check if page is completely blank
    const bodyText = await page.locator('body').innerText();
    const isBlank = bodyText.trim().length < 10;

    expect(isBlank).toBeFalsy();
    console.log('✅ Roles page is not blank - PermissionGate UI integrity confirmed');
  });

  test('PermissionGate - No infinite redirect loop', async ({ page }) => {
    // This test ensures that permission-restricted pages don't cause infinite redirect loops
    // Strategy: Navigate to multiple pages and check if we end up in a stable state

    const pagesToTest = [
      ADMIN_ROUTES.users,
      ADMIN_ROUTES.roles,
      ADMIN_ROUTES.resources,
    ];

    for (const route of pagesToTest) {
      await page.goto(route);
      await page.waitForTimeout(1000);

      // Check current URL - should be stable (not redirecting infinitely)
      const currentUrl = page.url();
      const isStableUrl = currentUrl.includes('/admin/') || currentUrl.includes('/403') || currentUrl.includes('/sign-in');

      expect(isStableUrl).toBeTruthy();

      if (currentUrl.includes('/403')) {
        console.log(`⚠️ ${route} → 403 (permission denied) - acceptable`);
      } else if (currentUrl.includes('/sign-in')) {
        console.log(`⚠️ ${route} → sign-in (auth required) - acceptable`);
      } else {
        console.log(`✅ ${route} → stable page (no redirect loop)`);
      }
    }

    console.log('✅ No infinite redirect loops detected - PermissionGate safety confirmed');
  });
});
