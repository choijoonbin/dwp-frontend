import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

import {
  ASK_RUNTIME_FIXTURE,
  DEFAULT_APP_PERMISSIONS,
  mockAskRuntime,
  mockRuntimeNavigation,
} from './support/runtime-access';
import { createHomeOverviewFixture, fulfillSuccess } from './support/shell-session';

async function expectNoAutomaticAccessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  const summary = results.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    nodes: violation.nodes.map((node) => ({
      target: node.target,
      html: node.html,
      failureSummary: node.failureSummary,
      checks: node.any.map((check) => check.data),
    })),
  }));
  expect(summary).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  let personalPreference = {
    schemaVersion: 2 as const,
    customized: false,
    preferences: {
      appearance: { mode: 'system', density: 'standard' },
      accessibility: {
        highContrast: false,
        reduceMotion: false,
        underlineLinks: false,
        reduceTransparency: false,
      },
      regional: {
        timeZone: 'Asia/Seoul',
        dateFormat: 'LOCALE',
        timeFormat: '24_HOUR',
        firstDayOfWeek: 'MONDAY',
        numberFormat: 'LOCALE',
      },
    },
    managedPolicy: {
      scope: 'TENANT',
      source: 'TENANT_EXPERIENCE_POLICY',
      owner: 'TENANT_ADMINISTRATOR',
      managedPaths: [] as string[],
    },
    version: 0,
    updatedAt: null as string | null,
  };
  let homePreference = {
    schemaVersion: 2,
    surfaceKey: 'workspace-home',
    customized: false,
    layout: {
      appLayout: null,
      presentation: 'balanced' as const,
      widgets: [
        { widgetKey: 'announcements', visible: true, size: 'full' },
        { widgetKey: 'daily-brief', visible: true, size: 'medium' },
        { widgetKey: 'focus', visible: true, size: 'medium' },
        { widgetKey: 'schedule', visible: true, size: 'medium' },
        { widgetKey: 'activity', visible: true, size: 'medium' },
      ],
    },
    version: 0,
    updatedAt: null,
  };

  await mockRuntimeNavigation(page);

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
  await page.route('**/api/platform/v1/catalog/code-sets/**', (route) => {
    const codeSetKey = decodeURIComponent(
      new URL(route.request().url()).pathname.split('/').pop()!
    );
    const values: Record<string, string[]> = {
      'PLATFORM.HOME_WIDGET': ['announcements', 'daily-brief', 'focus', 'schedule', 'activity'],
      'PLATFORM.PREFERENCE.COLOR_MODE': ['system', 'light', 'dark'],
      'PLATFORM.PREFERENCE.DENSITY': ['compact', 'standard', 'comfortable'],
    };
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: {
          codeSetKey,
          schemaVersion: 1,
          values: (values[codeSetKey] ?? []).map((code) => ({ code, label: code })),
        },
      }),
    });
  });
  await page.route('**/api/platform/v1/announcements', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data: [] }),
    })
  );
  await page.route('**/api/platform/v1/communications**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: {
          featured: null,
          items: [],
          summary: { total: 0, unread: 0, required: 0, saved: 0 },
          generatedAt: '2026-08-11T00:20:00Z',
        },
      }),
    })
  );
  await page.route('**/api/platform/v1/home/overview**', (route) =>
    fulfillSuccess(route, createHomeOverviewFixture(['ADMIN']))
  );
  await page.route('**/api/platform/v1/home-preferences**', async (route) => {
    const request = route.request();
    if (request.method() === 'GET') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data: homePreference }),
      });
      return;
    }
    if (new URL(request.url()).pathname.endsWith('/reset')) {
      homePreference = {
        ...homePreference,
        customized: false,
        layout: {
          appLayout: null,
          presentation: 'balanced',
          widgets: homePreference.layout.widgets.map((widget) => ({ ...widget, visible: true })),
        },
        version: 0,
        updatedAt: null,
      };
    } else {
      const body = request.postDataJSON() as { layout: typeof homePreference.layout };
      const nextVersion = homePreference.customized ? homePreference.version + 1 : 0;
      homePreference = {
        ...homePreference,
        customized: true,
        layout: body.layout,
        version: nextVersion,
        updatedAt: '2026-08-10T04:00:00Z',
      };
    }
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data: homePreference }),
    });
  });
  await page.route('**/api/platform/v1/personal-preferences**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/platform/v1/personal-preferences/managed-policy') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'SUCCESS',
          message: 'OK',
          data: personalPreference.managedPolicy,
        }),
      });
      return;
    }
    if (path === '/api/platform/v1/personal-preferences/exceptions') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data: [] }),
      });
      return;
    }
    if (request.method() === 'GET') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data: personalPreference }),
      });
      return;
    }
    if (path.endsWith('/reset')) {
      personalPreference = {
        schemaVersion: 2,
        customized: false,
        preferences: {
          appearance: { mode: 'system', density: 'standard' },
          accessibility: {
            highContrast: false,
            reduceMotion: false,
            underlineLinks: false,
            reduceTransparency: false,
          },
          regional: {
            timeZone: 'Asia/Seoul',
            dateFormat: 'LOCALE',
            timeFormat: '24_HOUR',
            firstDayOfWeek: 'MONDAY',
            numberFormat: 'LOCALE',
          },
        },
        managedPolicy: personalPreference.managedPolicy,
        version: 0,
        updatedAt: null,
      };
    } else {
      const body = request.postDataJSON() as {
        patch: {
          appearance?: Partial<typeof personalPreference.preferences.appearance>;
          accessibility?: Partial<typeof personalPreference.preferences.accessibility>;
          regional?: Partial<typeof personalPreference.preferences.regional>;
        };
      };
      const nextVersion = personalPreference.customized ? personalPreference.version + 1 : 0;
      personalPreference = {
        ...personalPreference,
        customized: true,
        preferences: {
          appearance: {
            ...personalPreference.preferences.appearance,
            ...body.patch.appearance,
          },
          accessibility: {
            ...personalPreference.preferences.accessibility,
            ...body.patch.accessibility,
          },
          regional: {
            ...personalPreference.preferences.regional,
            ...body.patch.regional,
          },
        },
        version: nextVersion,
        updatedAt: '2026-08-10T04:00:00Z',
      };
    }
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data: personalPreference }),
    });
  });
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
  await page.route('**/api/auth/session/refresh', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: {
          rotated: true,
          idleExpiresAt: '2026-08-11T01:00:00Z',
          expiresAt: '2026-08-11T08:00:00Z',
        },
      }),
    })
  );
});

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
  await expect(page.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveAttribute(
    'href',
    '/assets/brand/dwp-mark.svg'
  );
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
    'href',
    '/assets/brand/dwp-touch-icon-180.png'
  );
  const faviconResponse = await page.request.get('/assets/brand/dwp-mark.svg');
  expect(faviconResponse.ok()).toBe(true);
  expect(faviconResponse.headers()['content-type']).toContain('image/svg+xml');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await page.getByRole('button', { name: 'Language' }).click();
  await page.getByRole('menuitemradio', { name: /^한국어/ }).click();
  await expect(page.getByRole('heading', { name: '로그인' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('dwp.locale'))).toBe('ko');
  await page.getByRole('button', { name: '언어' }).click();
  await page.getByRole('menuitemradio', { name: 'English' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  const password = page.getByRole('textbox', { name: /^Password/ });
  await password.fill('access-policy-test');
  await page.getByRole('button', { name: 'Show password' }).click();
  await expect(password).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Hide password' }).click();
  await expect(password).toHaveAttribute('type', 'password');
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.mouse.move(0, 0);
  await page.waitForTimeout(500);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await expect(page.locator('nav')).toHaveCount(0);
  await expectNoAutomaticAccessibilityViolations(page);
});

test('tenant policy promotes the configured SSO provider without hiding local access', async ({
  page,
}) => {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ERROR', errorCode: 'UNAUTHORIZED' }),
    })
  );
  await page.route('**/api/auth/policy', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: {
          tenantId: 1,
          defaultLoginType: 'SSO',
          allowedLoginTypes: ['LOCAL', 'SSO'],
          localLoginEnabled: true,
          ssoLoginEnabled: true,
          ssoProviderKey: 'entra-workforce',
          requireMfa: false,
        },
      }),
    })
  );
  await page.route('**/api/auth/idp', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: [
          {
            tenantId: 1,
            enabled: true,
            providerType: 'OIDC',
            providerKey: 'unrelated-provider',
          },
          {
            tenantId: 1,
            enabled: true,
            providerType: 'OIDC',
            providerKey: 'entra-workforce',
          },
        ],
      }),
    })
  );

  let requestedProvider = '';
  await page.route('**/api/auth/oidc/login?**', async (route) => {
    requestedProvider = new URL(route.request().url()).searchParams.get('providerKey') || '';
    await route.fulfill({ status: 204 });
  });

  await page.goto('/');
  const ssoButton = page.getByRole('button', { name: 'Sign in with organization SSO' });
  const localButton = page.getByRole('button', { name: 'Sign in', exact: true });

  await expect(ssoButton).toBeVisible();
  await expect(ssoButton).toHaveClass(/MuiButton-contained/);
  await expect(localButton).toHaveClass(/MuiButton-outlined/);
  expect(
    await ssoButton.evaluate((button) =>
      Boolean(
        button.compareDocumentPosition(document.querySelector('form')) &
          Node.DOCUMENT_POSITION_FOLLOWING
      )
    )
  ).toBe(true);

  await ssoButton.click();
  await expect.poll(() => requestedProvider).toBe('entra-workforce');
});

test('authenticated users enter a personal home before the business shell', async ({
  page,
}, testInfo) => {
  let preferredLocale = 'en';
  const currentUser = () => ({
    userId: 1,
    displayName: 'Admin',
    jobTitle: 'Platform administrator',
    email: 'admin@dwp.local',
    preferredLocale,
    tenantDefaultLocale: 'en',
    tenantId: 1,
    tenantCode: 'default',
    roles: ['ADMIN'],
  });
  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: currentUser(),
      }),
    });
  });
  await page.route('**/api/auth/me/locale', async (route) => {
    const body = route.request().postDataJSON() as { locale: string };
    preferredLocale = body.locale;
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data: currentUser() }),
    });
  });
  await page.route('**/api/auth/permissions', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: [
          ...DEFAULT_APP_PERMISSIONS,
          {
            resourceType: 'ADMIN',
            resourceKey: 'ADMIN.IDENTITY_DIRECTORY',
            permissionCode: 'VIEW',
            effect: 'ALLOW',
          },
        ],
      }),
    });
  });
  await page.route('**/api/auth/admin/identity/users**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: { content: [], page: 0, size: 100, totalElements: 0, totalPages: 0 },
      }),
    })
  );
  await page.route('**/api/auth/admin/identity/roles', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data: [] }),
    })
  );

  await page.goto('/');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('dwp.accessToken'))).toBeNull();
  if (testInfo.project.name === 'mobile') {
    await expect(page.getByRole('button', { name: 'Select workspace' })).toHaveCount(0);
  } else {
    await expect(page.getByRole('button', { name: 'Select workspace' })).toBeVisible();
  }
  await expect(page.getByRole('button', { name: 'Search' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Notifications' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Account' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Language' })).toHaveCount(0);
  const fullscreenControl = page.getByTestId('fullscreen-control');
  if (testInfo.project.name === 'mobile') {
    await expect(fullscreenControl).toBeHidden();
    await expect(page.getByText('Platform administrator', { exact: true })).toBeHidden();
  } else {
    await page.evaluate(() => {
      let fullscreenElement: Element | null = null;

      Object.defineProperty(document, 'fullscreenElement', {
        configurable: true,
        get: () => fullscreenElement,
      });
      Object.defineProperty(document.documentElement, 'requestFullscreen', {
        configurable: true,
        value: async () => {
          fullscreenElement = document.documentElement;
          document.dispatchEvent(new Event('fullscreenchange'));
        },
      });
      Object.defineProperty(document, 'exitFullscreen', {
        configurable: true,
        value: async () => {
          fullscreenElement = null;
          document.dispatchEvent(new Event('fullscreenchange'));
        },
      });
    });
    await expect(fullscreenControl).toBeVisible();
    await expect(fullscreenControl).toHaveAttribute('aria-label', 'Enter full screen');
    await fullscreenControl.click();
    await expect(fullscreenControl).toHaveAttribute('aria-label', 'Exit full screen');
    await expect(fullscreenControl).toHaveAttribute('aria-pressed', 'true');
    await fullscreenControl.click();
    await expect(fullscreenControl).toHaveAttribute('aria-label', 'Enter full screen');
    await expect(fullscreenControl).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByText('Platform administrator', { exact: true })).toBeVisible();
  }
  await expect(page.getByRole('heading', { name: 'Welcome back, Admin', level: 1 })).toBeVisible();
  await expect(page.getByTestId('personal-home-shell')).toBeVisible();
  await expect(page.getByTestId('desktop-sidebar')).toHaveCount(0);
  await expect(page.getByTestId('mobile-sidebar')).toHaveCount(0);
  await expectNoAutomaticAccessibilityViolations(page);

  await page.getByRole('button', { name: 'Search' }).click();
  const globalSearch = page.getByRole('dialog', { name: 'Search DWP' });
  await expect(globalSearch).toBeVisible();
  const globalSearchInput = globalSearch.getByRole('combobox', { name: 'Search DWP' });
  await expect(globalSearchInput).toBeFocused();
  await globalSearchInput.fill('software access');
  await expect(
    globalSearch.getByRole('option', { name: /Approve software access request/ })
  ).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await expect(globalSearch.getByRole('option').nth(1)).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowUp');
  await expect(globalSearch.getByRole('option').first()).toHaveAttribute('aria-selected', 'true');
  await expectNoAutomaticAccessibilityViolations(page);
  await page.keyboard.press('Escape');
  await expect(globalSearch).toHaveCount(0);
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
  });
  await expect(page.getByRole('dialog', { name: 'Search DWP' })).toBeVisible();
  await page.getByRole('button', { name: 'Close search' }).click();

  await page.getByRole('button', { name: 'Open Work' }).click();
  await expect(page).toHaveURL(/\/work/);
  const businessSidebar =
    testInfo.project.name === 'mobile'
      ? page.getByTestId('mobile-sidebar')
      : page.getByTestId('desktop-sidebar');
  if (testInfo.project.name === 'mobile') {
    await page.getByRole('button', { name: 'Open navigation' }).click();
  }
  await expect(businessSidebar.getByRole('link', { name: 'Digital Workplace home' })).toBeVisible();
  await expect(businessSidebar.getByText('Digital Workplace', { exact: true })).toBeVisible();
  await expect(businessSidebar.locator('img')).toHaveCount(0);
  if (testInfo.project.name === 'mobile') {
    await expect(page.getByText('Platform administrator', { exact: true })).toBeHidden();
  } else {
    await expect(page.getByText('Platform administrator', { exact: true })).toBeVisible();
  }
  await page.evaluate(() => {
    (window as typeof window & { __dwpSpaNavigationMarker?: string }).__dwpSpaNavigationMarker =
      'preserved';
  });
  await businessSidebar.getByRole('link', { name: 'Digital Workplace home' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as typeof window & { __dwpSpaNavigationMarker?: string }).__dwpSpaNavigationMarker
      )
    )
    .toBe('preserved');
  await expect(page.getByTestId('personal-home-shell')).toBeVisible();
  await expect(page.getByTestId('desktop-sidebar')).toHaveCount(0);

  const accountButton = page.getByRole('button', { name: 'Account' });
  await accountButton.click();
  const accountPanel = page.getByRole('dialog', { name: 'Account and session' });
  await expect(accountPanel).toHaveCSS('opacity', '1');
  await expect(page.getByText('admin@dwp.local', { exact: true })).toBeVisible();
  await expect(page.getByText('Workspace · default', { exact: true })).toBeVisible();
  const accountSettingsItem = page.getByRole('menuitem', { name: 'Account settings' });
  const administrationItem = page.getByRole('menuitem', { name: 'Administration console' });
  await expect(accountSettingsItem).toBeVisible();
  await expect(accountSettingsItem).toBeFocused();
  await expect(page.getByText('Profile, preferences, and security', { exact: true })).toBeVisible();
  await expect(administrationItem).toBeVisible();
  await expect(page.getByText('Users, policy, and system controls', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible();
  await expect(page.locator('[role="menuitem"]')).toHaveCount(2);
  await expectNoAutomaticAccessibilityViolations(page);

  await page.keyboard.press('ArrowDown');
  await expect(administrationItem).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('[role="menuitem"]')).toHaveCount(0);
  await expect(accountButton).toBeFocused();
  await accountButton.press('Enter');
  await expect(accountSettingsItem).toBeFocused();

  await accountSettingsItem.click();
  await expect(page).toHaveURL(/\/account\/profile/);
  await expect(page.locator('[role="menuitem"]')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
  await expect(page.getByTestId('account-shell')).toBeVisible();

  const settingsNavigation =
    testInfo.project.name === 'mobile'
      ? page.getByTestId('account-mobile-sidebar')
      : page.getByTestId('account-sidebar');

  if (testInfo.project.name === 'mobile') {
    await page.getByRole('button', { name: 'Open settings navigation' }).click();
  }

  await expect(settingsNavigation.getByRole('link', { name: 'Profile' })).toHaveAttribute(
    'aria-current',
    'page'
  );
  await settingsNavigation.getByRole('link', { name: 'Appearance' }).click();
  await expect(page).toHaveURL(/\/account\/settings\/appearance/);
  await expect(page.getByRole('group', { name: 'Color mode' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Interface density' })).toBeVisible();
  const preferenceSaved = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/platform/v1/personal-preferences' &&
      response.request().method() === 'PATCH' &&
      response.ok()
  );
  await page
    .getByRole('group', { name: 'Color mode' })
    .getByRole('button', { name: 'Dark' })
    .click();
  await expect(page.locator('html')).toHaveAttribute('data-color-scheme', 'dark');
  await expect(
    page.getByRole('group', { name: 'Color mode' }).getByRole('button', { name: 'Dark' })
  ).toBeEnabled();
  await preferenceSaved;
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Appearance' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-color-scheme', 'dark');
  await expect(
    page.getByRole('group', { name: 'Color mode' }).getByRole('button', {
      name: 'Dark',
      pressed: true,
    })
  ).toBeVisible();

  if (testInfo.project.name === 'mobile') {
    await page.getByRole('button', { name: 'Open settings navigation' }).click();
  }

  await expect(settingsNavigation.getByRole('link', { name: 'Appearance' })).toHaveAttribute(
    'aria-current',
    'page'
  );
  await settingsNavigation.getByRole('link', { name: 'Accessibility' }).click();
  await expect(page.getByRole('switch', { name: 'High contrast' })).toBeVisible();

  if (testInfo.project.name === 'mobile') {
    await page.getByRole('button', { name: 'Open settings navigation' }).click();
  }

  await settingsNavigation.getByRole('link', { name: 'Managed settings' }).click();
  await expect(page.getByText('Managed', { exact: true })).toHaveCount(3);
  await expectNoAutomaticAccessibilityViolations(page);

  if (testInfo.project.name === 'mobile') {
    await page.getByRole('button', { name: 'Open settings navigation' }).click();
    await expect(settingsNavigation.getByRole('link', { name: 'Profile' })).toBeVisible();
    await expect(
      settingsNavigation.getByRole('link', { name: 'Security & sessions' })
    ).toBeVisible();
    await expect(settingsNavigation.getByRole('link', { name: 'Home workspace' })).toBeVisible();
    await expect(settingsNavigation.getByRole('link', { name: 'Back to workspace' })).toBeVisible();
  } else {
    await expect(page.getByTestId('desktop-sidebar')).toHaveCount(0);
    await expect(settingsNavigation.getByRole('link', { name: 'Profile' })).toBeVisible();
    await expect(
      settingsNavigation.getByRole('link', { name: 'Security & sessions' })
    ).toBeVisible();
    await expect(settingsNavigation.getByRole('link', { name: 'Home workspace' })).toBeVisible();
    await expect(settingsNavigation.getByRole('link', { name: 'Back to workspace' })).toBeVisible();
    await expect(settingsNavigation.getByRole('link')).toHaveCount(9);
  }

  await settingsNavigation.getByRole('link', { name: 'Language & region' }).click();
  await page
    .getByRole('group', { name: 'Product language' })
    .getByRole('button', { name: '한국어' })
    .click();
  await expect(page.getByRole('heading', { name: '언어 및 지역' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: '언어 및 지역' })).toBeVisible();
  await expect(
    page.getByRole('group', { name: '제품 언어' }).getByRole('button', {
      name: '한국어',
      pressed: true,
    })
  ).toBeVisible();

  if (testInfo.project.name === 'mobile') {
    await page.getByRole('button', { name: '설정 탐색 열기' }).click();
  }
  await settingsNavigation.getByRole('link', { name: '워크스페이스로 돌아가기' }).click();
  await expect(
    page.getByRole('heading', { name: 'Admin님, 다시 오신 것을 환영합니다' })
  ).toBeVisible();
  await page.getByRole('button', { name: '업무 열기', exact: true }).click();
  await expect(page.getByRole('heading', { name: '업무', level: 1 })).toBeVisible();
  await page.goto('/admin/identity/access');
  await expect(page.getByRole('heading', { name: '사용자 접근 권한', level: 1 })).toBeVisible();

  let logoutRequested = false;
  let releaseLogout = () => undefined;
  const logoutGate = new Promise<void>((resolve) => {
    releaseLogout = resolve;
  });
  await page.route('**/api/auth/logout', async (route) => {
    logoutRequested = true;
    await logoutGate;
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data: null }),
    });
  });
  await page.getByRole('button', { name: '계정' }).click();
  await page.getByRole('button', { name: '로그아웃', exact: true }).click();
  await expect.poll(() => logoutRequested).toBe(true);
  await expect(page.locator('html')).toHaveAttribute('data-dwp-transition', 'session-exit');
  await expect(page).toHaveURL(/\/admin\/identity\/access/);
  await expect(page.getByRole('heading', { name: '사용자 접근 권한', level: 1 })).toBeVisible();
  releaseLogout();
  await expect(page).toHaveURL(/\/sign-in/);
  await expect(page.locator('html')).not.toHaveAttribute('data-dwp-transition');
});

test('tenant branding does not shift the home header while the logo loads', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'Desktop header geometry is verified here.');
  await page.setViewportSize({ width: 1920, height: 1080 });

  let signalBrandingRequest = () => undefined;
  let releaseBranding = () => undefined;
  const brandingRequested = new Promise<void>((resolve) => {
    signalBrandingRequest = resolve;
  });
  const brandingGate = new Promise<void>((resolve) => {
    releaseBranding = resolve;
  });

  await page.unroute('**/api/platform/v1/tenant-branding');
  await page.route('**/api/platform/v1/tenant-branding', async (route) => {
    signalBrandingRequest();
    await brandingGate;
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: {
          organizationName: 'SK AX',
          logoUrl: '/assets/brand/dwp-mark.svg',
          logoWidth: 34,
          logoHeight: 34,
          version: 1,
        },
      }),
    });
  });
  await page.route('**/assets/brand/dwp-mark.svg', (route) =>
    route.fulfill({ contentType: 'image/svg+xml', path: 'public/assets/brand/dwp-mark.svg' })
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
  await page.goto('/');
  await brandingRequested;
  const header = page.getByTestId('home-header');
  const productLabel = header.getByText('Digital Workplace', { exact: true });
  const workspaceMenu = header.getByRole('button', { name: 'Select workspace' });
  await expect(productLabel).toBeVisible();
  await expect(workspaceMenu).toBeVisible();
  const before = {
    product: await productLabel.boundingBox(),
    workspace: await workspaceMenu.boundingBox(),
  };

  releaseBranding();
  const brand = header.getByRole('link', { name: 'SK AX Digital Workplace home' });
  const tenantLogo = brand.getByTestId('tenant-brand-logo');
  await expect(brand).toBeVisible();
  await expect(tenantLogo).toBeVisible();
  const after = {
    product: await productLabel.boundingBox(),
    workspace: await workspaceMenu.boundingBox(),
    brand: await brand.boundingBox(),
    tenantLogo: await tenantLogo.boundingBox(),
  };

  expect(after.product?.x).toBeCloseTo(before.product?.x ?? 0, 1);
  expect(after.workspace?.x).toBeCloseTo(before.workspace?.x ?? 0, 1);
  expect(after.brand?.x ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(24);
  expect(after.tenantLogo?.x).toBeCloseTo(after.brand?.x ?? 0, 1);
  expect(after.tenantLogo?.height ?? 0).toBeGreaterThanOrEqual(38);
});

test('compact navigation reflows the desktop workspace canvas', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'Desktop inline navigation is not used on mobile.');

  await page.setViewportSize({ width: 1920, height: 1080 });
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
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: DEFAULT_APP_PERMISSIONS,
      }),
    })
  );

  await page.goto('/work');
  await expect(page.getByRole('heading', { name: 'Work', level: 1 })).toBeVisible();

  const readGeometry = () =>
    page.evaluate(() => {
      const header = document.querySelector('[data-testid="app-header"]');
      const main = document.querySelector('[data-testid="app-main"]');
      const canvas = document.querySelector('[data-dwp-page-canvas="workspace"]');
      const rectangle = (element: Element | null) => {
        const rect = element?.getBoundingClientRect();
        return rect
          ? {
              left: Math.round(rect.left),
              right: Math.round(rect.right),
              width: Math.round(rect.width),
            }
          : null;
      };
      return { header: rectangle(header), main: rectangle(main), canvas: rectangle(canvas) };
    });

  const expanded = await readGeometry();
  expect(expanded.header).toEqual({ left: 248, right: 1920, width: 1672 });
  expect(expanded.main).toEqual({ left: 248, right: 1920, width: 1672 });
  expect(expanded.canvas).toEqual({ left: 248, right: 1920, width: 1672 });

  await page.getByRole('button', { name: 'Collapse navigation' }).click();
  await expect(page.getByTestId('desktop-sidebar')).toHaveCSS('width', '72px');
  await expect(page.locator('[data-dwp-navigation-state="compact"]')).toBeVisible();
  await expect.poll(async () => (await readGeometry()).canvas?.width).toBe(1848);

  const compact = await readGeometry();
  expect(compact.header).toEqual({ left: 72, right: 1920, width: 1848 });
  expect(compact.main).toEqual({ left: 72, right: 1920, width: 1848 });
  expect(compact.canvas).toEqual({ left: 72, right: 1920, width: 1848 });
  expect((compact.canvas?.width ?? 0) - (expanded.canvas?.width ?? 0)).toBe(176);
});

test('personal home launcher can create, rename, persist, and reset folders', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === 'mobile',
    'Desktop pointer and menu behavior is covered here.'
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
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: DEFAULT_APP_PERMISSIONS,
      }),
    })
  );

  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Open Work' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open Administration' })).toHaveCount(0);

  const createStartWorkFolder = async () => {
    const workButton = page.getByRole('button', { name: 'Move Work', exact: true });
    await expect(workButton).toBeVisible();
    await workButton.scrollIntoViewIfNeeded();
    const workBounds = await workButton.boundingBox();
    expect(workBounds).not.toBeNull();
    const sourceX = (workBounds?.x ?? 0) + (workBounds?.width ?? 0) / 2;
    const sourceY = (workBounds?.y ?? 0) + (workBounds?.height ?? 0) / 2;
    await page.mouse.move(sourceX, sourceY);
    await page.mouse.down();
    await page.mouse.move(sourceX + 16, sourceY, { steps: 4 });
    await expect(page.locator('[data-launchpad-item="dwp-work"]')).toHaveCSS('opacity', '0.28');
    const askTargetBounds = await page.locator('[data-folder-target="dwp-ask"]').boundingBox();
    expect(askTargetBounds).not.toBeNull();
    await page.mouse.move(
      (askTargetBounds?.x ?? 0) + (askTargetBounds?.width ?? 0) / 2,
      (askTargetBounds?.y ?? 0) + (askTargetBounds?.height ?? 0) / 2,
      { steps: 12 }
    );
    await page.waitForTimeout(150);
    await page.mouse.up();
    const createDialog = page.getByRole('dialog', { name: 'Create folder' });
    await expect(createDialog.getByRole('textbox', { name: 'Folder name' })).toHaveValue(
      'Start work folder'
    );
    await createDialog.getByRole('button', { name: 'Create' }).click();
  };

  await page.getByRole('button', { name: 'Edit home' }).click();
  await expect(
    page.getByRole('button', { name: 'Move Administration', exact: true })
  ).toBeVisible();
  await createStartWorkFolder();

  await page.getByRole('button', { name: 'Open folder Start work folder' }).click();
  const folderDialog = page.getByRole('dialog', { name: 'Start work folder' });
  await expect(folderDialog.getByRole('button', { name: 'Open Work' })).toBeVisible();
  await expect(folderDialog.getByRole('button', { name: 'Open Ask DWP' })).toBeVisible();
  await folderDialog.getByRole('button', { name: 'Rename Start work folder' }).click();
  const renameDialog = page.getByRole('dialog', { name: 'Rename folder' });
  await renameDialog.getByRole('textbox', { name: 'Folder name' }).fill('Priority tools');
  await renameDialog.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('button', { name: 'Open folder Priority tools' })).toBeVisible();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Home view saved.')).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Open folder Priority tools' })).toBeVisible();

  await page.getByRole('button', { name: 'Edit home' }).click();
  await page.getByRole('button', { name: 'Reset to default', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open folder Priority tools' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Move Work', exact: true }).focus();
  await page.keyboard.press('Space');
  await page.waitForTimeout(100);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(100);
  await page.keyboard.press('Space');
  await expect
    .poll(() =>
      page
        .getByRole('list', { name: 'Start work apps' })
        .locator('[data-launchpad-item]')
        .evaluateAll((items) => items.map((item) => item.getAttribute('data-launchpad-item')))
    )
    .toEqual(['dwp-ask', 'dwp-work', 'dwp-activity']);
  await page.getByRole('button', { name: 'Reset to default', exact: true }).click();
  await expect
    .poll(() =>
      page
        .getByRole('list', { name: 'Start work apps' })
        .locator('[data-launchpad-item]')
        .evaluateAll((items) => items.map((item) => item.getAttribute('data-launchpad-item')))
    )
    .toEqual(['dwp-work', 'dwp-ask', 'dwp-activity']);

  await createStartWorkFolder();
  await expect(page.getByRole('button', { name: 'Open folder Start work folder' })).toBeVisible();
  await expect(page.getByText('Work was placed with Ask DWP.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('button', { name: 'Open folder Start work folder' }).click();
  await page
    .getByRole('dialog', { name: 'Start work folder' })
    .getByRole('button', { name: 'Open Work' })
    .click();
  await expect(page).toHaveURL(/\/work/);
});

test('personal home widgets persist user choices and restore governed defaults', async ({
  page,
}) => {
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
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: DEFAULT_APP_PERMISSIONS,
      }),
    })
  );

  await page.goto('/');
  await page.getByRole('button', { name: 'Edit home' }).click();
  await expect(page.getByRole('img', { name: 'Widget locked by your organization' })).toBeVisible();
  await page.getByRole('button', { name: 'Hide Live activity widget' }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Live activity' })).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Live activity' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Edit home' }).click();
  await page.getByRole('button', { name: 'Reset to default', exact: true }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Live activity' })).toBeVisible();
});

test('personal home launcher only exposes explicitly entitled apps when app permissions exist', async ({
  page,
}) => {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: {
          userId: 7,
          displayName: 'Min Kim',
          email: 'min@dwp.local',
          tenantId: 2,
          tenantCode: 'pilot',
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
        data: [
          {
            resourceType: 'APP',
            resourceKey: 'APP.WORK',
            permissionCode: 'VIEW',
            effect: 'ALLOW',
          },
        ],
      }),
    })
  );
  await page.route('**/api/platform/v1/workspace/apps', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data: [] }),
    })
  );

  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Open Work' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open Ask DWP' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Open Administration' })).toHaveCount(0);
  await expect(
    page.getByRole('region', { name: 'Frequent apps' }).getByRole('button', { name: /^Open / })
  ).toHaveCount(1);
  await expectNoAutomaticAccessibilityViolations(page);

  await page.getByRole('button', { name: 'Account' }).click();
  await expect(page.getByRole('menuitem', { name: 'Administration console' })).toHaveCount(0);
  await page.keyboard.press('Escape');

  await page.goto('/apps');
  await expect(page.getByRole('heading', { name: 'Apps', exact: true })).toBeVisible();
  await expect(page.getByText('No apps are available')).toBeVisible();

  await page.goto('/ask');
  await expect(page).toHaveURL(/\/403/);
  await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible();

  await page.goto('/admin');
  await expect(page).toHaveURL(/\/403/);
});

test('reference work hub connects Home, Work, Ask, Activity, and Apps', async ({
  page,
}, testInfo) => {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: {
          userId: 1,
          displayName: 'Admin User',
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
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: DEFAULT_APP_PERMISSIONS,
      }),
    })
  );
  await mockAskRuntime(page);

  const navigateTo = async (label: 'Work' | 'Ask' | 'Activity' | 'Apps') => {
    if (testInfo.project.name === 'mobile') {
      await page.getByRole('button', { name: 'Open navigation' }).click();
      await page
        .getByTestId('mobile-sidebar')
        .getByRole('link', { name: label, exact: true })
        .click();
      return;
    }
    await page
      .getByTestId('desktop-sidebar')
      .getByRole('link', { name: label, exact: true })
      .click();
  };

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome back, Admin' })).toBeVisible();
  await page.getByRole('button', { name: /Approve software access request/ }).click();
  await expect(page).toHaveURL(/\/work\?item=WK-1042/);
  await expect(page.getByRole('heading', { name: 'Work', exact: true })).toBeVisible();
  await expect(page.getByRole('grid', { name: 'Work queue' })).toBeVisible();
  await expect(page.getByText('WK-1042 / Approval / Owner: You')).toBeVisible();

  await navigateTo('Ask');
  await expect(page.getByRole('heading', { name: 'Ask DWP' })).toBeVisible();
  await page.getByRole('button', { name: 'Can I work remotely next Friday?' }).click();
  await expect(page.getByRole('heading', { name: 'Governed answer' })).toBeVisible();
  await expect(page.getByText('Verified answer', { exact: true })).toBeVisible();
  await expect(page.getByText(ASK_RUNTIME_FIXTURE.answer)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Verified sources (2)' })).toBeVisible();
  await expect(page.getByText('AUD-REF-1042')).toBeVisible();

  await navigateTo('Activity');
  await expect(page.getByRole('heading', { name: 'Activity', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Agents' }).click();
  await expect(
    page.getByRole('list', { name: 'Workspace activity' }).getByRole('listitem')
  ).toHaveCount(1);
  await page.getByRole('button', { name: 'All activity' }).click();
  await page.getByRole('button', { name: /External sharing blocked/ }).click();
  await expect(page.getByText('AUD-WRK-903')).toBeVisible();

  await navigateTo('Apps');
  await expect(page.getByRole('heading', { name: 'Apps', exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Search apps' }).fill('legacy');
  await expect(page.getByRole('region', { name: 'App filter' }).getByText('1 apps')).toBeVisible();
  await page.getByRole('button', { name: /^Legacy operations/ }).click();
  await expect(page.getByRole('alert')).toContainText(
    'Legacy operations can be used after an administrator connects SSO or a deep link.'
  );
  await expect(page.locator('.MuiAlert-root')).toHaveCSS('opacity', '1');
  await expectNoAutomaticAccessibilityViolations(page);
});

test('users can review and revoke another browser session', async ({ page }) => {
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
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: DEFAULT_APP_PERMISSIONS,
      }),
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
  await page.route('**/api/auth/admin/access/privileged/me/**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data: [] }),
    })
  );

  let sessions = [
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
  ];

  await page.route('**/api/auth/sessions/**', async (route) => {
    const sessionId = route.request().url().split('/').pop();
    sessions = sessions.filter((session) => session.sessionId !== sessionId);
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data: null }),
    });
  });
  await page.route('**/api/auth/sessions', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data: sessions }),
    });
  });

  await page.goto('/account/security');
  await expect(page.getByRole('heading', { name: 'Security & sessions' })).toBeVisible();
  const sessionList = page.getByRole('list', { name: 'Active browser sessions' });
  await expect(sessionList.getByRole('listitem')).toHaveCount(2);
  await expect(page.getByText('Chrome on macOS')).toBeVisible();
  const otherSession = sessionList
    .getByRole('listitem')
    .filter({ hasText: 'Microsoft Edge on Windows' });
  await otherSession.getByRole('button', { name: 'End session' }).click();

  const dialog = page.getByRole('dialog', { name: 'End this session?' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Sign out' }).click();
  await expect(sessionList.getByRole('listitem')).toHaveCount(1);
  await expect(page.getByText('Microsoft Edge on Windows')).toHaveCount(0);
  await expectNoAutomaticAccessibilityViolations(page);
});
