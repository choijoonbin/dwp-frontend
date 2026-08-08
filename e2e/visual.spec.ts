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

async function mockSessions(page: Page) {
  await page.route('**/api/auth/sessions', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: [
          {
            sessionId: '11111111-1111-4111-8111-111111111111',
            current: true,
            ipAddress: '10.20.30.40',
            userAgent:
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0 Safari/537.36',
            startedAt: '2026-08-08T00:00:00Z',
            lastSeenAt: '2026-08-08T00:10:00Z',
            idleExpiresAt: '2026-08-08T00:40:00Z',
            expiresAt: '2026-08-08T08:00:00Z',
          },
          {
            sessionId: '22222222-2222-4222-8222-222222222222',
            current: false,
            ipAddress: '203.0.113.24',
            userAgent:
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36 Edg/126.0',
            startedAt: '2026-08-07T23:00:00Z',
            lastSeenAt: '2026-08-08T00:05:00Z',
            idleExpiresAt: '2026-08-08T00:35:00Z',
            expiresAt: '2026-08-08T07:00:00Z',
          },
        ],
      }),
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

test('security sessions visual baseline', async ({ page }) => {
  await mockAuthenticated(page);
  await mockSessions(page);
  await setAppearance(page, {
    mode: 'light',
    density: 'standard',
    highContrast: false,
    reduceMotion: true,
  });

  await page.goto('/account/security');
  await expect(page.getByRole('heading', { name: 'Security & sessions' })).toBeVisible();
  await expect(
    page.getByRole('list', { name: 'Active browser sessions' }).getByRole('listitem')
  ).toHaveCount(2);
  await expect(page).toHaveScreenshot('security-sessions.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
    maxDiffPixelRatio: 0.001,
  });
});

test('Today reference visual baseline', async ({ page }) => {
  await mockAuthenticated(page);
  await setAppearance(page, {
    mode: 'light',
    density: 'standard',
    highContrast: false,
    reduceMotion: true,
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Daily brief' })).toBeVisible();
  await expect(page).toHaveScreenshot('today-reference.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
    maxDiffPixelRatio: 0.001,
  });
});

test('Work reference visual baseline', async ({ page }) => {
  await mockAuthenticated(page);
  await setAppearance(page, {
    mode: 'light',
    density: 'standard',
    highContrast: false,
    reduceMotion: true,
  });

  await page.goto('/work?item=WK-1042');
  await expect(page.getByRole('heading', { name: 'Work', exact: true })).toBeVisible();
  await expect(page.getByRole('grid', { name: 'Work queue' })).toBeVisible();
  await expect(page).toHaveScreenshot('work-reference.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
    maxDiffPixelRatio: 0.001,
  });
});

test('Ask reference visual baseline', async ({ page }) => {
  await mockAuthenticated(page);
  await setAppearance(page, {
    mode: 'light',
    density: 'standard',
    highContrast: false,
    reduceMotion: true,
  });

  await page.goto('/ask');
  await page.getByRole('button', { name: 'Can I work remotely next Friday?' }).click();
  await expect(page.getByRole('heading', { name: 'Answer' })).toBeVisible();
  await expect(page).toHaveScreenshot('ask-reference.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
    maxDiffPixelRatio: 0.001,
  });
});

test('Apps reference visual baseline', async ({ page }) => {
  await mockAuthenticated(page);
  await setAppearance(page, {
    mode: 'light',
    density: 'standard',
    highContrast: false,
    reduceMotion: true,
  });

  await page.goto('/apps');
  await expect(page.getByRole('heading', { name: 'Apps', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Available apps' })).toBeVisible();
  await expect(page).toHaveScreenshot('apps-reference.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
    maxDiffPixelRatio: 0.001,
  });
});
