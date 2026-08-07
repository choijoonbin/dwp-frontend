import { expect, test, type Page } from '@playwright/test';

const authPolicy = {
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
};

async function mockUnauthenticated(page: Page) {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ERROR', errorCode: 'UNAUTHORIZED' }),
    })
  );
  await page.route('**/api/auth/policy', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(authPolicy) })
  );
  await page.route('**/api/auth/idp', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data: [] }),
    })
  );
}

async function mockAuthenticated(page: Page) {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
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
    })
  );
  await page.route('**/api/auth/permissions', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data: [] }),
    })
  );
}

async function setAppearance(
  page: Page,
  preference: {
    mode: 'light' | 'dark';
    density: 'compact' | 'standard' | 'comfortable';
    highContrast: boolean;
    reduceMotion: boolean;
  }
) {
  await page.addInitScript((value) => {
    window.localStorage.setItem('dwp.appearance.v1', JSON.stringify(value));
  }, preference);
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('sign-in visual baseline', async ({ page }) => {
  await mockUnauthenticated(page);
  await setAppearance(page, {
    mode: 'light',
    density: 'standard',
    highContrast: false,
    reduceMotion: true,
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await expect(page).toHaveScreenshot('sign-in.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
    maxDiffPixelRatio: 0.001,
  });
});

test('preferences light visual baseline', async ({ page }) => {
  await mockAuthenticated(page);
  await setAppearance(page, {
    mode: 'light',
    density: 'standard',
    highContrast: false,
    reduceMotion: true,
  });

  await page.goto('/account/settings');
  await expect(page.getByRole('heading', { name: 'Preferences' })).toBeVisible();
  await expect(page.getByText('System UI')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Light', pressed: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Standard', pressed: true })).toBeVisible();
  await expect(page).toHaveScreenshot('preferences-light.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
    maxDiffPixelRatio: 0.001,
  });
});

test('preferences dark high-contrast visual baseline', async ({ page }) => {
  await mockAuthenticated(page);
  await setAppearance(page, {
    mode: 'dark',
    density: 'compact',
    highContrast: true,
    reduceMotion: true,
  });

  await page.goto('/account/settings');
  await expect(page.getByRole('heading', { name: 'Preferences' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-contrast', 'high');
  await expect(page.getByText('System UI')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Dark', pressed: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Compact', pressed: true })).toBeVisible();
  await expect(page).toHaveScreenshot('preferences-dark-high-contrast.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
    maxDiffPixelRatio: 0.001,
  });
});
