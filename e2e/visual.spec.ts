import { expect, test, type Page } from '@playwright/test';

import {
  ASK_RUNTIME_FIXTURE,
  DEFAULT_APP_PERMISSIONS,
  mockAskRuntime,
  mockRuntimeNavigation,
  WORKSPACE_QUEUE_FIXTURE,
} from './support/runtime-access';

test.describe.configure({ mode: 'serial' });

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

async function mockAuthenticated(page: Page, locale = 'en') {
  await mockRuntimeNavigation(page);
  await page.route('**/api/auth/admin/access/privileged/me/**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data: [] }),
    })
  );
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: {
          userId: 1,
          displayName: 'Admin',
          jobTitle: 'Platform administrator',
          email: 'admin@dwp.local',
          preferredLocale: locale,
          tenantDefaultLocale: 'en',
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
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: DEFAULT_APP_PERMISSIONS,
      }),
    })
  );
  await page.route('**/api/platform/v1/home-experience', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: {
          headline: null,
          subheadline: null,
          backgroundPosition: 'CENTER',
          overlayOpacity: 18,
          backgroundUrl: null,
          version: 0,
        },
      }),
    })
  );
  await page.route('**/api/platform/v1/tenant-branding', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: { organizationName: null, logoUrl: null, version: 0 },
      }),
    })
  );
  await page.route('**/api/platform/v1/home-preferences', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: {
          schemaVersion: 1,
          customized: false,
          layout: {
            appLayout: null,
            widgets: [
              { widgetKey: 'announcements', visible: true },
              { widgetKey: 'daily-brief', visible: true },
              { widgetKey: 'focus', visible: true },
              { widgetKey: 'schedule', visible: true },
              { widgetKey: 'activity', visible: true },
            ],
          },
          version: 0,
          updatedAt: null,
        },
      }),
    })
  );
  await page.route('**/api/platform/v1/workspace/work-items', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: WORKSPACE_QUEUE_FIXTURE,
      }),
    })
  );
  await page.route('**/api/people/v1/org-chart**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: {
          organizations: [
            {
              organizationId: 'org-skax',
              organizationKey: 'SKAX',
              name: 'SKAX',
              organizationTypeName: 'Company',
              totalHeadcount: 42,
            },
          ],
        },
      }),
    })
  );
  await page.route('**/api/people/v1/people**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: { items: [], nextCursor: null, size: 20, hasMore: false, asOf: '2026-08-11' },
      }),
    })
  );
  await page.route('**/api/people/v1/org-chart**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: {
          asOf: '2026-08-11',
          company: { organizationId: 'org-skax', organizationKey: 'SKAX', name: 'SKAX' },
          scenario: null,
          metrics: {
            headcount: 0,
            activeHeadcount: 0,
            onLeaveHeadcount: 0,
            contingentHeadcount: 0,
            organizationCount: 1,
            managerCount: 0,
            openPositionCount: 0,
            locationCount: 0,
            plannedFte: 0,
            workforceCostAmount: 0,
            costCurrency: 'KRW',
          },
          organizations: [],
          people: [],
          positions: [],
          relationships: [],
          openPositions: [],
        },
      }),
    })
  );
  await page.route('**/api/platform/v1/personal-preferences**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: {
          schemaVersion: 1,
          customized: false,
          preferences: {
            appearance: {
              mode: 'system',
              density: 'standard',
            },
            accessibility: {
              highContrast: false,
              reduceMotion: false,
            },
          },
          version: 0,
          updatedAt: null,
        },
      }),
    })
  );
  await page.route('**/api/platform/v1/announcements', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data: [] }),
    })
  );
  await page.route('**/api/auth/csrf', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: { token: 'csrf-token', headerName: 'X-XSRF-TOKEN' },
      }),
    })
  );
  await mockAskRuntime(page);
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

async function mockIdentityAccess(page: Page) {
  await page.route('**/api/auth/admin/identity/users**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: {
          content: [
            {
              userId: 1,
              displayName: 'Administrator',
              email: 'admin@dwp.local',
              status: 'ACTIVE',
              mfaEnabled: false,
              roles: ['ADMIN'],
              roleManagement: { allowed: true, reason: 'ALLOWED' },
              accessRevision: 0,
              version: 0,
            },
          ],
          page: 0,
          size: 25,
          totalElements: 1,
          totalPages: 1,
        },
      }),
    })
  );
  await page.route('**/api/auth/admin/identity/roles', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: [
          {
            code: 'ADMIN',
            name: 'Administrator',
            description: 'Tenant administration',
            roleFamily: 'WORKSPACE',
            assignmentClass: 'DELEGATED',
            privileged: true,
            assignmentMode: 'DIRECT',
            conflictsWith: [],
            status: 'ACTIVE',
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
  await page.route('**/api/platform/v1/personal-preferences**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: {
          schemaVersion: 1,
          customized: true,
          preferences: {
            appearance: {
              mode: preference.mode,
              density: preference.density,
            },
            accessibility: {
              highContrast: preference.highContrast,
              reduceMotion: preference.reduceMotion,
            },
          },
          version: 1,
          updatedAt: '2026-08-11T00:00:00Z',
        },
      }),
    })
  );
}

async function setLocale(page: Page, locale: string) {
  await page.addInitScript((value) => {
    window.localStorage.setItem('dwp.locale', value);
  }, locale);
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
  await expect
    .poll(() =>
      page
        .getByTestId('auth-world-visual')
        .evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)
    )
    .toBe(true);
  await expect(page).toHaveScreenshot('sign-in.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
    maxDiffPixelRatio: 0.001,
  });
});

test('sign-in dark visual baseline', async ({ page }) => {
  await mockUnauthenticated(page);
  await setAppearance(page, {
    mode: 'dark',
    density: 'standard',
    highContrast: false,
    reduceMotion: true,
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await expect
    .poll(() =>
      page
        .getByTestId('auth-world-visual')
        .evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)
    )
    .toBe(true);
  await expect(page).toHaveScreenshot('sign-in-dark.png', {
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
  await expect(page).toHaveURL(/\/account\/settings\/appearance/);
  await expect(page.getByRole('heading', { name: 'Appearance' })).toBeVisible();
  await expect(page.getByTestId('account-shell')).toBeVisible();
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
  await expect(page).toHaveURL(/\/account\/settings\/appearance/);
  await expect(page.getByRole('heading', { name: 'Appearance' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-contrast', 'high');
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

test('administration access grid visual baseline', async ({ page }, testInfo) => {
  await mockAuthenticated(page);
  await mockIdentityAccess(page);
  await setAppearance(page, {
    mode: 'light',
    density: 'standard',
    highContrast: false,
    reduceMotion: true,
  });

  await page.goto('/admin/identity/access');
  await expect(page.getByRole('heading', { name: 'Identity access', level: 1 })).toBeVisible();

  if (testInfo.project.name === 'mobile') {
    await expect(
      page.getByRole('list', { name: 'Tenant users' }).getByRole('listitem')
    ).toHaveCount(1);
  } else {
    const grid = page.getByRole('grid', { name: 'Tenant users' });
    await expect(grid).toBeVisible();
    const [gridBox, headerBox, rowBox] = await Promise.all([
      grid.boundingBox(),
      grid.locator('.MuiDataGrid-columnHeaders').boundingBox(),
      grid.locator('.MuiDataGrid-row').first().boundingBox(),
    ]);
    expect(gridBox?.height).toBeLessThanOrEqual(108);
    expect(Math.round(headerBox?.height ?? 0)).toBe(Math.round(rowBox?.height ?? -1));
  }

  await expect(page).toHaveScreenshot('admin-access-grid.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
    maxDiffPixelRatio: 0.001,
  });
});

test('personal home reference visual baseline', async ({ page }) => {
  await mockAuthenticated(page);
  await setAppearance(page, {
    mode: 'light',
    density: 'standard',
    highContrast: false,
    reduceMotion: true,
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome back, Admin' })).toBeVisible();
  await expect(page.getByTestId('personal-home-shell')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Daily brief' })).toBeVisible();
  await expect(page).toHaveScreenshot('personal-home-reference.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
    maxDiffPixelRatio: 0.001,
  });
});

test('personal home Korean visual baseline', async ({ page }) => {
  await mockAuthenticated(page, 'ko');
  await setLocale(page, 'ko');
  await setAppearance(page, {
    mode: 'light',
    density: 'standard',
    highContrast: false,
    reduceMotion: true,
  });

  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Admin님, 다시 오신 것을 환영합니다' })
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: '일일 브리핑' })).toBeVisible();
  await expect(page).toHaveScreenshot('personal-home-reference-ko.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
    maxDiffPixelRatio: 0.001,
  });
});

test('account command panel visual baseline', async ({ page }) => {
  await mockAuthenticated(page);
  await setAppearance(page, {
    mode: 'light',
    density: 'standard',
    highContrast: false,
    reduceMotion: true,
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome back, Admin' })).toBeVisible();
  await page.getByRole('button', { name: 'Account' }).click();
  await expect(page.getByRole('menuitem', { name: 'Account settings' })).toBeVisible();
  await expect(page.getByText('admin@dwp.local', { exact: true })).toBeVisible();
  await expect(page).toHaveScreenshot('account-command-panel.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
    maxDiffPixelRatio: 0.001,
  });
});

test('account command panel dark high-contrast visual baseline', async ({ page }) => {
  await mockAuthenticated(page);
  await setAppearance(page, {
    mode: 'dark',
    density: 'standard',
    highContrast: true,
    reduceMotion: true,
  });

  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-color-scheme', 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-contrast', 'high');
  await expect(page.getByRole('heading', { name: 'Welcome back, Admin' })).toBeVisible();
  await page.getByRole('button', { name: 'Account' }).click();
  await expect(page.getByRole('menuitem', { name: 'Account settings' })).toBeVisible();
  await expect(page).toHaveScreenshot('account-command-panel-dark-high-contrast.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
    maxDiffPixelRatio: 0.001,
  });
});

test('personal home dark reference visual baseline', async ({ page }) => {
  await mockAuthenticated(page);
  await setAppearance(page, {
    mode: 'dark',
    density: 'standard',
    highContrast: false,
    reduceMotion: true,
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome back, Admin' })).toBeVisible();
  await expect(page.getByTestId('personal-home-shell')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Daily brief' })).toBeVisible();
  await expect(page).toHaveScreenshot('personal-home-reference-dark.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
    maxDiffPixelRatio: 0.001,
  });
});

test('global search command palette visual baseline', async ({ page }) => {
  await mockAuthenticated(page);
  await setAppearance(page, {
    mode: 'light',
    density: 'standard',
    highContrast: false,
    reduceMotion: true,
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page.getByRole('dialog', { name: 'Search DWP' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Search DWP' })).toBeFocused();
  await expect(page).toHaveScreenshot('global-search-command.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: false,
    maxDiffPixelRatio: 0.001,
  });
});

test('collapsed navigation visual baseline', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'Compact rail is a desktop navigation state.');
  await mockAuthenticated(page);
  await setAppearance(page, {
    mode: 'light',
    density: 'standard',
    highContrast: false,
    reduceMotion: true,
  });

  await page.goto('/apps');
  await expect(page.getByRole('heading', { name: 'Apps', exact: true })).toBeVisible();
  await expect(page.getByText('Legacy operations', { exact: true })).toBeVisible();
  await expect(page.getByTestId('desktop-sidebar')).toBeVisible();
  await page.getByRole('button', { name: 'Collapse navigation' }).click();
  await expect(page.getByTestId('desktop-sidebar')).toHaveCSS('width', '72px');
  await expect(page).toHaveScreenshot('navigation-collapsed.png', {
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

test('Work Korean visual baseline', async ({ page }) => {
  await mockAuthenticated(page, 'ko');
  await setLocale(page, 'ko');
  await setAppearance(page, {
    mode: 'light',
    density: 'standard',
    highContrast: false,
    reduceMotion: true,
  });

  await page.goto('/work?item=WK-1042');
  await expect(page.getByRole('heading', { name: '업무', exact: true })).toBeVisible();
  await expect(page.getByRole('grid', { name: '업무 목록' })).toBeVisible();
  await expect(page).toHaveScreenshot('work-reference-ko.png', {
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
  await expect(page.getByRole('heading', { name: 'Governed answer' })).toBeVisible();
  await expect(page.getByText(ASK_RUNTIME_FIXTURE.answer)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Verified sources (2)' })).toBeVisible();
  await expect(page.getByText('AUD-REF-1042')).toBeVisible();
  await expect(page).toHaveScreenshot('ask-reference.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
    maxDiffPixelRatio: 0.001,
  });
});

test('Activity reference visual baseline', async ({ page }) => {
  await mockAuthenticated(page);
  await setAppearance(page, {
    mode: 'light',
    density: 'standard',
    highContrast: false,
    reduceMotion: true,
  });

  await page.goto('/activity');
  await expect(page.getByRole('heading', { name: 'Activity', exact: true })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Workspace activity' })).toBeVisible();
  await expect(page).toHaveScreenshot('activity-reference.png', {
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
