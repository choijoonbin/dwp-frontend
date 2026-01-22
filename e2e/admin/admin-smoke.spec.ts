import { test, expect } from '@playwright/test';
import { ADMIN_ROUTES } from '../utils/routes';
import { ensureAuth } from '../utils/auth';
import { MOBILE_VIEWPORT, DESKTOP_VIEWPORT } from '../utils/viewports';

/**
 * Admin Core Pages Smoke Tests
 * 
 * Purpose: Minimal smoke tests for 4 core Admin pages
 * - Page load & rendering
 * - Core elements exist
 * - Responsive (mobile + desktop)
 */

test.describe('Admin Smoke Tests - Desktop', () => {
  test.beforeEach(async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize(DESKTOP_VIEWPORT);
    
    // Ensure auth (TODO: implement actual auth)
    await ensureAuth(page);
  });

  test('Monitoring page loads and renders', async ({ page }) => {
    // Navigate
    await page.goto(ADMIN_ROUTES.monitoring);
    
    // Check page root
    await expect(page.getByTestId('page-admin-monitoring')).toBeVisible();
    
    // Check core elements (either filter-bar or data exists)
    // Note: We don't enforce strict component existence yet (phase 1 smoke)
    const pageRoot = page.getByTestId('page-admin-monitoring');
    await expect(pageRoot).toContainText('통합 모니터링');
  });

  test('Users page loads and renders', async ({ page }) => {
    // Navigate
    await page.goto(ADMIN_ROUTES.users);
    
    // Check page root
    await expect(page.getByTestId('page-admin-users')).toBeVisible();
    
    // Check core elements
    const pageRoot = page.getByTestId('page-admin-users');
    await expect(pageRoot).toContainText('사용자 관리');
  });

  test('Roles page loads and renders', async ({ page }) => {
    // Navigate
    await page.goto(ADMIN_ROUTES.roles);
    
    // Check page root
    await expect(page.getByTestId('page-admin-roles')).toBeVisible();
    
    // Check core elements
    const pageRoot = page.getByTestId('page-admin-roles');
    await expect(pageRoot).toContainText('권한 관리');
  });

  test('Resources page loads and renders', async ({ page }) => {
    // Navigate
    await page.goto(ADMIN_ROUTES.resources);
    
    // Check page root
    await expect(page.getByTestId('page-admin-resources')).toBeVisible();
    
    // Check core elements
    const pageRoot = page.getByTestId('page-admin-resources');
    await expect(pageRoot).toContainText('리소스 관리');
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
    
    // Check page root
    await expect(page.getByTestId('page-admin-monitoring')).toBeVisible();
    
    // Check no horizontal overflow (page should fit in viewport)
    const pageRoot = page.getByTestId('page-admin-monitoring');
    const box = await pageRoot.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      // Page width should not exceed viewport width (+ small margin for scrollbar)
      expect(box.width).toBeLessThanOrEqual(MOBILE_VIEWPORT.width + 20);
    }
  });

  test('Users page loads on mobile', async ({ page }) => {
    await page.goto(ADMIN_ROUTES.users);
    
    // Check page root
    await expect(page.getByTestId('page-admin-users')).toBeVisible();
    
    // Check responsive layout (should not overflow)
    const pageRoot = page.getByTestId('page-admin-users');
    const box = await pageRoot.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.width).toBeLessThanOrEqual(MOBILE_VIEWPORT.width + 20);
    }
  });

  test('Roles page loads on mobile', async ({ page }) => {
    await page.goto(ADMIN_ROUTES.roles);
    
    // Check page root
    await expect(page.getByTestId('page-admin-roles')).toBeVisible();
    
    // Check responsive layout
    const pageRoot = page.getByTestId('page-admin-roles');
    const box = await pageRoot.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.width).toBeLessThanOrEqual(MOBILE_VIEWPORT.width + 20);
    }
  });

  test('Resources page loads on mobile', async ({ page }) => {
    await page.goto(ADMIN_ROUTES.resources);
    
    // Check page root
    await expect(page.getByTestId('page-admin-resources')).toBeVisible();
    
    // Check responsive layout
    const pageRoot = page.getByTestId('page-admin-resources');
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

  test('Monitoring table has overflow container', async ({ page }) => {
    await page.goto(ADMIN_ROUTES.monitoring);
    await expect(page.getByTestId('page-admin-monitoring')).toBeVisible();
    
    // TODO: Add more specific table overflow checks when data-table testid is added
    // For now, just verify page loads without breaking mobile layout
  });

  test('Users table has overflow container or card layout', async ({ page }) => {
    await page.goto(ADMIN_ROUTES.users);
    await expect(page.getByTestId('page-admin-users')).toBeVisible();
    
    // Users page should have either table with overflow or card layout on mobile
    // TODO: Add specific checks when data-table testid is added
  });
});
