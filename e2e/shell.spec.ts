import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function expectNoAutomaticAccessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  const summary = results.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    nodes: violation.nodes.map((node) => ({ target: node.target, html: node.html })),
  }));
  expect(summary).toEqual([]);
}

test('unauthenticated users see the login shell without business navigation', async ({ page }) => {
  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ERROR', errorCode: 'UNAUTHORIZED' }),
    });
  });
  await page.route('**/api/auth/policy', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: {
          tenantId: 1,
          defaultLoginType: 'LOCAL',
          allowedLoginTypes: ['LOCAL'],
          localLoginEnabled: true,
          ssoLoginEnabled: false,
          requireMfa: false,
        },
      }),
    });
  });
  await page.route('**/api/auth/idp', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data: [] }),
    });
  });

  await page.goto('/');
  await expect(page).toHaveURL(/\/sign-in/);
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await expect(page.locator('nav')).toHaveCount(0);
  await expectNoAutomaticAccessibilityViolations(page);
});

test('authenticated users keep the common shell without business navigation', async ({
  page,
}, testInfo) => {
  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: {
          userId: 1,
          displayName: 'Admin',
          email: 'admin@dwp.local',
          tenantId: 1,
          tenantCode: 'default',
          roles: ['ADMIN'],
        },
      }),
    });
  });
  await page.route('**/api/auth/permissions', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data: [] }),
    });
  });

  await page.goto('/');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('dwp.accessToken'))).toBeNull();
  await expect(page.getByRole('button', { name: 'Select workspace' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Search' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Notifications' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Account' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'DWP', level: 1 })).toBeVisible();
  await expectNoAutomaticAccessibilityViolations(page);

  await page.getByRole('button', { name: 'Account' }).click();
  await expect(page.getByRole('menuitem', { name: 'Home' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Profile' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Preferences' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Security & sessions' })).toBeVisible();
  await page.getByRole('menuitem', { name: 'Dark mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-color-scheme', 'dark');
  await expect(page.locator('[role="menuitem"]')).toHaveCount(0);
  await expectNoAutomaticAccessibilityViolations(page);

  await page.getByRole('button', { name: 'Account' }).click();
  await page.getByRole('menuitem', { name: 'Preferences' }).click();
  await expect(page).toHaveURL(/\/account\/settings/);
  await expect(page.locator('[role="menuitem"]')).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Color mode' })).toBeVisible();
  await expect(page.getByRole('switch', { name: 'High contrast' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Interface density' })).toBeVisible();
  await expect(page.getByText('Managed')).toHaveCount(3);
  await expectNoAutomaticAccessibilityViolations(page);

  if (testInfo.project.name === 'mobile') {
    await page.getByRole('button', { name: 'Open navigation' }).click();
    const sidebar = page.getByTestId('mobile-sidebar');
    await expect(sidebar.getByRole('link', { name: 'Digital Workplace home' })).toBeVisible();
    await expect(sidebar.getByRole('link')).toHaveCount(1);
  } else {
    const sidebar = page.getByTestId('desktop-sidebar');
    await expect(sidebar.getByRole('link', { name: 'Digital Workplace home' })).toBeVisible();
    await expect(sidebar.getByRole('link')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Collapse navigation' })).toBeVisible();
  }
});
