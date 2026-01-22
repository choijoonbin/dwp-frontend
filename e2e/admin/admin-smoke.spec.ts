import { test, expect } from '@playwright/test';
import { ADMIN_ROUTES } from '../utils/routes';
import { ensureAuth } from '../utils/auth';
import { MOBILE_VIEWPORT, DESKTOP_VIEWPORT } from '../utils/viewports';

/**
 * Admin Core Pages Smoke Tests
 * 
 * Purpose: Minimal smoke tests for 8 Admin pages
 * - Page load & rendering
 * - Core elements exist
 * - Responsive (mobile + desktop)
 */

test.describe('Admin Smoke Tests - Desktop', () => {
  test.beforeEach(async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize(DESKTOP_VIEWPORT);
    
    // Ensure auth
    await ensureAuth(page);
  });

  test('Monitoring page loads and renders', async ({ page }) => {
    await page.goto(ADMIN_ROUTES.monitoring);
    await expect(page.getByTestId('page-admin-monitoring')).toBeVisible();
    const pageRoot = page.getByTestId('page-admin-monitoring');
    await expect(pageRoot).toContainText('통합 모니터링');
  });

  test('Users page loads and renders', async ({ page }) => {
    await page.goto(ADMIN_ROUTES.users);
    await expect(page.getByTestId('page-admin-users')).toBeVisible();
    const pageRoot = page.getByTestId('page-admin-users');
    await expect(pageRoot).toContainText('사용자 관리');
  });

  test('Roles page loads and renders', async ({ page }) => {
    await page.goto(ADMIN_ROUTES.roles);
    await expect(page.getByTestId('page-admin-roles')).toBeVisible();
    const pageRoot = page.getByTestId('page-admin-roles');
    await expect(pageRoot).toContainText('권한 관리');
  });

  test('Resources page loads and renders', async ({ page }) => {
    await page.goto(ADMIN_ROUTES.resources);
    await expect(page.getByTestId('page-admin-resources')).toBeVisible();
    const pageRoot = page.getByTestId('page-admin-resources');
    await expect(pageRoot).toContainText('리소스 관리');
  });

  test('Audit page loads and renders', async ({ page }) => {
    await page.goto(ADMIN_ROUTES.audit);
    await expect(page.getByTestId('page-admin-audit')).toBeVisible();
    const pageRoot = page.getByTestId('page-admin-audit');
    await expect(pageRoot).toContainText('감사 로그');
  });

  test('Codes page loads and renders', async ({ page }) => {
    await page.goto(ADMIN_ROUTES.codes);
    await expect(page.getByTestId('page-admin-codes')).toBeVisible();
    const pageRoot = page.getByTestId('page-admin-codes');
    await expect(pageRoot).toContainText('코드 관리');
  });

  test('Code Usages page loads and renders', async ({ page }) => {
    await page.goto(ADMIN_ROUTES.codeUsages);
    await expect(page.getByTestId('page-admin-code-usages')).toBeVisible();
    const pageRoot = page.getByTestId('page-admin-code-usages');
    // Check for either "코드 사용 매핑" or "코드 사용 정의"
    await expect(pageRoot).toContainText(/코드 사용 (매핑|정의)/);
  });

  test('Menus page loads and renders', async ({ page }) => {
    await page.goto(ADMIN_ROUTES.menus);
    await expect(page.getByTestId('page-admin-menus')).toBeVisible();
    const pageRoot = page.getByTestId('page-admin-menus');
    await expect(pageRoot).toContainText('메뉴 관리');
  });
});

test.describe('Admin Smoke Tests - Mobile', () => {
  test.beforeEach(async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize(MOBILE_VIEWPORT);
    
    // Ensure auth
    await ensureAuth(page);
  });

  test('Monitoring page loads on mobile', async ({ page }) => {
    await page.goto(ADMIN_ROUTES.monitoring);
    await expect(page.getByTestId('page-admin-monitoring')).toBeVisible();
    
    // Check no horizontal overflow
    const pageRoot = page.getByTestId('page-admin-monitoring');
    const box = await pageRoot.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.width).toBeLessThanOrEqual(MOBILE_VIEWPORT.width + 20);
    }
  });

  test('Users page loads on mobile', async ({ page }) => {
    await page.goto(ADMIN_ROUTES.users);
    await expect(page.getByTestId('page-admin-users')).toBeVisible();
    
    const pageRoot = page.getByTestId('page-admin-users');
    const box = await pageRoot.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.width).toBeLessThanOrEqual(MOBILE_VIEWPORT.width + 20);
    }
  });

  test('Roles page loads on mobile', async ({ page }) => {
    await page.goto(ADMIN_ROUTES.roles);
    await expect(page.getByTestId('page-admin-roles')).toBeVisible();
    
    const pageRoot = page.getByTestId('page-admin-roles');
    const box = await pageRoot.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.width).toBeLessThanOrEqual(MOBILE_VIEWPORT.width + 20);
    }
  });

  test('Resources page loads on mobile', async ({ page }) => {
    await page.goto(ADMIN_ROUTES.resources);
    await expect(page.getByTestId('page-admin-resources')).toBeVisible();
    
    const pageRoot = page.getByTestId('page-admin-resources');
    const box = await pageRoot.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.width).toBeLessThanOrEqual(MOBILE_VIEWPORT.width + 20);
    }
  });

  test('Audit page loads on mobile', async ({ page }) => {
    await page.goto(ADMIN_ROUTES.audit);
    await expect(page.getByTestId('page-admin-audit')).toBeVisible();
    
    const pageRoot = page.getByTestId('page-admin-audit');
    const box = await pageRoot.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.width).toBeLessThanOrEqual(MOBILE_VIEWPORT.width + 20);
    }
  });

  test('Codes page loads on mobile', async ({ page }) => {
    await page.goto(ADMIN_ROUTES.codes);
    await expect(page.getByTestId('page-admin-codes')).toBeVisible();
    
    const pageRoot = page.getByTestId('page-admin-codes');
    const box = await pageRoot.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.width).toBeLessThanOrEqual(MOBILE_VIEWPORT.width + 20);
    }
  });

  test('Code Usages page loads on mobile', async ({ page }) => {
    await page.goto(ADMIN_ROUTES.codeUsages);
    await expect(page.getByTestId('page-admin-code-usages')).toBeVisible();
    
    const pageRoot = page.getByTestId('page-admin-code-usages');
    const box = await pageRoot.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.width).toBeLessThanOrEqual(MOBILE_VIEWPORT.width + 20);
    }
  });

  test('Menus page loads on mobile', async ({ page }) => {
    await page.goto(ADMIN_ROUTES.menus);
    await expect(page.getByTestId('page-admin-menus')).toBeVisible();
    
    const pageRoot = page.getByTestId('page-admin-menus');
    const box = await pageRoot.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.width).toBeLessThanOrEqual(MOBILE_VIEWPORT.width + 20);
    }
  });
});

test.describe('Admin Table Overflow Check - Mobile', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await ensureAuth(page);
  });

  test('Pages with tables handle overflow correctly', async ({ page }) => {
    // Test pages that are known to have data tables
    const pagesWithTables = [
      { route: ADMIN_ROUTES.monitoring, name: 'Monitoring' },
      { route: ADMIN_ROUTES.users, name: 'Users' },
      { route: ADMIN_ROUTES.audit, name: 'Audit' },
    ];

    for (const { route, name } of pagesWithTables) {
      await page.goto(route);
      
      // Check document body doesn't overflow horizontally
      const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
      const bodyClientWidth = await page.evaluate(() => document.body.clientWidth);
      
      // Allow small margin (20px) for scrollbar
      expect(bodyScrollWidth).toBeLessThanOrEqual(bodyClientWidth + 20);
      
      console.log(`✅ ${name}: No horizontal overflow (scrollWidth: ${bodyScrollWidth}, clientWidth: ${bodyClientWidth})`);
    }
  });
});
