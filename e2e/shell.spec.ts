import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

import {
  ASK_RUNTIME_FIXTURE,
  DEFAULT_APP_PERMISSIONS,
  mockAskRuntime,
  mockRuntimeNavigation,
} from './support/runtime-access';
import { mockAuthenticatedAdminSession } from './support/authenticated-admin-session';
import { createHomeOverviewFixture, fulfillSuccess } from './support/shell-session';
import { APPROVAL_HOME_FIXTURE, HR_HOME_FIXTURE } from './support/product-area-fixtures';

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
    schemaVersion: 4,
    surfaceKey: 'workspace-home',
    customized: false,
    layout: {
      appLayout: null,
      presentation: 'balanced' as const,
      widgets: [
        { widgetKey: 'activity', visible: true, size: 'quarter' },
        { widgetKey: 'focus', visible: true, size: 'medium' },
        { widgetKey: 'schedule', visible: true, size: 'quarter' },
        { widgetKey: 'daily-brief', visible: true, size: 'full' },
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
          compositionPolicy: {
            schemaVersion: 1,
            personalCustomizationEnabled: true,
            governedZones: [
              {
                zoneKey: 'announcements',
                placement: 'CANVAS',
                visible: true,
                size: 'compact',
                sortOrder: 20,
              },
            ],
          },
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
      'PLATFORM.HOME_WIDGET': ['command-rail', 'activity', 'focus', 'schedule', 'daily-brief'],
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
          widgets: [
            { widgetKey: 'activity', visible: true, size: 'quarter' },
            { widgetKey: 'focus', visible: true, size: 'medium' },
            { widgetKey: 'schedule', visible: true, size: 'quarter' },
            { widgetKey: 'daily-brief', visible: true, size: 'full' },
          ],
        },
        version: 0,
        updatedAt: null,
      };
    } else {
      const body = request.postDataJSON() as { layout: typeof homePreference.layout };
      const allowedSizes: Record<string, readonly string[]> = {
        'command-rail': ['large', 'full'],
        'daily-brief': ['large', 'full'],
        focus: ['quarter', 'compact', 'medium', 'large', 'full'],
        schedule: ['fifth', 'quarter', 'compact', 'medium'],
        activity: ['fifth', 'quarter', 'compact', 'medium'],
      };
      const invalidWidget = body.layout.widgets.find(
        (widget) => !allowedSizes[widget.widgetKey]?.includes(widget.size)
      );
      if (invalidWidget) {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'ERROR',
            message: `Widget size is not allowed: ${invalidWidget.widgetKey}/${invalidWidget.size}`,
          }),
        });
        return;
      }
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
  await page.route('**/api/notifications/v1/summary**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/summary/by-app')) {
      return fulfillSuccess(route, {
        partial: false,
        unavailableSources: [],
        apps: [],
        changeVersion: '0',
        counterVersion: '0',
        generatedAt: '2026-08-11T00:00:00Z',
      });
    }
    return fulfillSuccess(route, {
      partial: false,
      unavailableSources: [],
      message: null,
      actionableUnread: 0,
      totalUnread: 0,
      viewCounts: { PRIORITY: 0, ALL: 0, MENTIONS: 0, SAVED: 0, SNOOZED: 0, DONE: 0 },
      changeVersion: '0',
      counterVersion: '0',
      generatedAt: '2026-08-11T00:00:00Z',
    });
  });
  await page.route('**/api/notifications/v1/me/delivery-profile', (route) =>
    fulfillSuccess(route, {
      channels: { IN_APP: true },
      quietHours: {
        enabled: false,
        start: '22:00',
        end: '07:00',
        timeZone: 'Asia/Seoul',
        days: [1, 2, 3, 4, 5, 6, 7],
        allowUrgentBypass: true,
      },
      digest: { mode: 'OFF', deliveryTime: '09:00', dayOfWeek: null },
      presentation: { bannerMode: 'SMART', previewMode: 'FULL' },
      version: '0',
      updatedAt: '2026-08-11T00:00:00Z',
    })
  );
  await page.route('**/api/notifications/v1/me/effective-settings', (route) =>
    fulfillSuccess(route, {
      partial: false,
      unavailableSources: [],
      globalChannels: {},
      apps: [],
      generatedAt: '2026-08-11T00:00:00Z',
    })
  );
  await page.route('**/api/notifications/v1/stream**', (route) =>
    route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
      body: ': connected\n\n',
    })
  );
  await page.route('**/api/approvals/v1/home', (route) =>
    fulfillSuccess(route, APPROVAL_HOME_FIXTURE)
  );
  await page.route('**/api/people/v1/hr/home', (route) => fulfillSuccess(route, HR_HOME_FIXTURE));
  await page.route('**/api/platform/v1/services/requests', (route) => fulfillSuccess(route, []));
  await page.route('**/api/platform/v1/workplace/bookings**', (route) => fulfillSuccess(route, []));
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
          localLoginAvailable: true,
          ssoLoginAvailable: false,
          preferredLoginType: 'LOCAL',
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

test('local sign-in submits browser-autofilled credentials once and waits for tenant branding', async ({
  page,
}) => {
  let authenticated = false;
  let loginRequestCount = 0;
  let submittedCredentials: Record<string, unknown> | null = null;
  let signalBrandingRequest = () => undefined;
  let releaseBranding = () => undefined;
  const brandingRequested = new Promise<void>((resolve) => {
    signalBrandingRequest = resolve;
  });
  const brandingGate = new Promise<void>((resolve) => {
    releaseBranding = resolve;
  });

  await page.route('**/api/auth/me', (route) =>
    route.fulfill(
      authenticated
        ? {
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
                identityPlane: 'TENANT',
                roles: ['ADMIN'],
              },
            }),
          }
        : {
            status: 401,
            contentType: 'application/json',
            body: JSON.stringify({ status: 'ERROR', errorCode: 'UNAUTHORIZED' }),
          }
    )
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
  await page.route('**/api/auth/policy', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: {
          localLoginAvailable: true,
          ssoLoginAvailable: false,
          preferredLoginType: 'LOCAL',
        },
      }),
    })
  );
  await page.route('**/api/auth/login', (route) => {
    loginRequestCount += 1;
    submittedCredentials = route.request().postDataJSON() as Record<string, unknown>;
    authenticated = true;
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data: {} }),
    });
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
        data: { organizationName: 'SK AX', logoUrl: null, version: 1 },
      }),
    });
  });

  await page.goto('/');
  await expect(page).toHaveURL(/\/sign-in/);
  const signInForm = page.locator('#dwp-sign-in-form');
  const emailInput = page.locator('#dwp-email');
  const passwordInput = page.locator('#dwp-password');
  await expect(emailInput).toBeVisible();
  await expect(passwordInput).toBeVisible();
  await expect(emailInput).not.toBeFocused();
  await expect(signInForm).toHaveAttribute('name', 'dwp-sign-in');
  await expect(signInForm).toHaveAttribute('method', 'post');
  await expect(signInForm).toHaveAttribute('action', '/api/auth/login');
  await expect(signInForm).toHaveAttribute('autocomplete', 'on');
  await expect(emailInput).toHaveAttribute('autocomplete', 'username');
  await expect(passwordInput).toHaveAttribute('autocomplete', 'current-password');
  await page.evaluate(() => {
    const state = window as typeof window & {
      __dwpShellBootObserved?: boolean;
      __dwpShellBootObserver?: MutationObserver;
    };
    state.__dwpShellBootObserved = false;
    state.__dwpShellBootObserver = new MutationObserver(() => {
      if (document.querySelector('[data-testid="shell-boot-screen"]')) {
        state.__dwpShellBootObserved = true;
      }
    });
    state.__dwpShellBootObserver.observe(document.body, { childList: true, subtree: true });
  });

  await page.evaluate(
    ({ email, password }) => {
      const emailInput = document.querySelector<HTMLInputElement>('#dwp-email');
      const passwordInput = document.querySelector<HTMLInputElement>('#dwp-password');
      if (!emailInput || !passwordInput) throw new Error('Sign-in inputs were not rendered.');
      emailInput.value = email;
      passwordInput.value = password;
    },
    { email: 'admin@dwp.local', password: 'access-policy-test' }
  );
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await brandingRequested;
  await page.evaluate(() => {
    const form = document.querySelector<HTMLFormElement>('#dwp-sign-in-form');
    if (!form) throw new Error('Sign-in form was not rendered.');
    form.requestSubmit();
    form.requestSubmit();
  });

  expect(loginRequestCount).toBe(1);
  expect(submittedCredentials).toMatchObject({
    email: 'admin@dwp.local',
    password: 'access-policy-test',
  });

  await expect(page).toHaveURL(/\/sign-in/);
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await expect(page.getByTestId('shell-boot-screen')).toHaveCount(0);
  await expect(page.getByTestId('home-header')).toHaveCount(0);

  releaseBranding();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId('home-header')).toBeVisible();
  expect(
    await page.evaluate(() => {
      const state = window as typeof window & {
        __dwpShellBootObserved?: boolean;
        __dwpShellBootObserver?: MutationObserver;
      };
      state.__dwpShellBootObserver?.disconnect();
      return state.__dwpShellBootObserved;
    })
  ).toBe(false);
});

test('tenant policy promotes SSO without exposing the configured provider key', async ({
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
          localLoginAvailable: true,
          ssoLoginAvailable: true,
          preferredLoginType: 'SSO',
        },
      }),
    })
  );

  let oidcQuery = new URLSearchParams();
  await page.route('**/api/auth/oidc/login?**', async (route) => {
    oidcQuery = new URL(route.request().url()).searchParams;
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
  await expect.poll(() => oidcQuery.get('tenantId')).toBe('1');
  expect(oidcQuery.has('providerKey')).toBe(false);
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
    identityPlane: 'TENANT',
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
            resourceType: 'APP',
            resourceKey: 'APP.NOTIFICATIONS',
            permissionCode: 'VIEW',
            effect: 'ALLOW',
          },
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
  await expect(page.getByTestId('home-header').locator('nav')).toHaveCount(0);
  if (testInfo.project.name === 'mobile') {
    await expect(page.getByTestId('shell-workspace-identity')).toBeHidden();
  } else {
    await expect(page.getByTestId('shell-workspace-identity')).toBeVisible();
  }
  await expect(page.getByRole('button', { name: 'Select workspace' })).toHaveCount(0);
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

  if (testInfo.project.name === 'mobile') {
    await page.getByRole('button', { name: 'Open priority in Work' }).click();
  } else {
    await page.getByRole('button', { name: 'Open Work' }).click();
  }
  await expect(page).toHaveURL(/\/work/);
  const businessSidebar =
    testInfo.project.name === 'mobile'
      ? page.getByTestId('work-mobile-sidebar')
      : page.getByTestId('work-sidebar');
  if (testInfo.project.name === 'mobile') {
    await page.getByTestId('work-mobile-navigation-trigger').click();
  }
  await expect(businessSidebar.getByRole('link', { name: 'Back to personal home' })).toBeVisible();
  await expect(businessSidebar.getByRole('link', { name: 'DWAI·ON', exact: true })).toHaveCount(0);
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
  await businessSidebar.getByRole('link', { name: 'Back to personal home' }).click();
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
    await expect(settingsNavigation.getByRole('link')).toHaveCount(10);
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
  if (testInfo.project.name === 'mobile') {
    await page.getByRole('button', { name: '업무에서 우선 항목 열기', exact: true }).click();
  } else {
    await page.getByRole('button', { name: '업무 열기', exact: true }).click();
  }
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

test('home mounts its final logo-bearing header only after tenant branding resolves', async ({
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
  await mockAuthenticatedAdminSession(page);
  await page.goto('/');
  await brandingRequested;
  await expect(page.getByTestId('shell-boot-screen')).toBeVisible();
  await expect(page.getByTestId('home-header')).toHaveCount(0);

  releaseBranding();
  const header = page.getByTestId('home-header');
  const brand = header.getByRole('link', { name: 'SK AX Digital Workplace home' });
  const tenantLogo = brand.getByTestId('tenant-brand-logo');
  await expect(page.getByTestId('shell-boot-screen')).toHaveCount(0);
  await expect(brand).toBeVisible();
  await expect(tenantLogo).toBeVisible();
  await expect(header.getByText('Digital Workplace', { exact: true })).toBeVisible();
  await expect(header.getByTestId('shell-workspace-identity')).toBeVisible();
  await expect(header.getByRole('button', { name: 'Select workspace' })).toHaveCount(0);
  expect((await tenantLogo.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(38);
});

test('home falls back to the tenant name when branding has no logo', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'Desktop header hydration is verified here.');
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
        data: { organizationName: 'SK AX', logoUrl: null, version: 1 },
      }),
    });
  });
  await mockAuthenticatedAdminSession(page);

  await page.goto('/');
  await brandingRequested;
  await expect(page.getByTestId('shell-boot-screen')).toBeVisible();
  await expect(page.getByTestId('home-header')).toHaveCount(0);

  releaseBranding();
  const header = page.getByTestId('home-header');
  const brand = header.getByRole('link', { name: 'SK AX Digital Workplace home' });
  await expect(page.getByTestId('shell-boot-screen')).toHaveCount(0);
  await expect(brand).toBeVisible();
  await expect(brand.getByTestId('tenant-brand-logo')).toHaveCount(0);
  await expect(brand).toContainText('Digital Workplace');
  await expect(brand.getByTestId('tenant-brand-name-fallback')).toHaveText('SK AX');
  await expect(header.getByTestId('shell-workspace-identity')).toBeVisible();
  await expect(header.getByRole('button', { name: 'Select workspace' })).toHaveCount(0);
});

test('workspace widget surfaces use the governed responsive visual gap', async ({
  page,
}, testInfo) => {
  if (testInfo.project.name !== 'mobile') {
    await page.setViewportSize({ width: 1920, height: 1080 });
  }
  await mockAuthenticatedAdminSession(page);
  await page.goto('/');

  const canvas = page.locator('[data-workspace-presentation]');
  const widgets = canvas.locator('[data-workspace-widget]');
  await expect(canvas).toBeVisible();
  await expect(widgets.first()).toBeVisible();

  const layout = await canvas.evaluate((element) => {
    const style = window.getComputedStyle(element);
    const boxes = Array.from(element.querySelectorAll<HTMLElement>('[data-workspace-widget]'))
      .map((widget) => {
        const bounds = widget.getBoundingClientRect();
        return {
          key: widget.dataset.workspaceWidget ?? '',
          x: bounds.x,
          y: bounds.y,
          right: bounds.right,
          bottom: bounds.bottom,
          width: bounds.width,
          height: bounds.height,
        };
      })
      .filter((bounds) => bounds.width > 0 && bounds.height > 0);
    return {
      rowGap: Number.parseFloat(style.rowGap),
      columnGap: Number.parseFloat(style.columnGap),
      boxes,
    };
  });
  const expectedGap = testInfo.project.name === 'mobile' ? 16 : 24;
  expect(layout.rowGap).toBeCloseTo(expectedGap, 0);
  expect(layout.columnGap).toBeCloseTo(testInfo.project.name === 'mobile' ? 0 : 2, 0);
  expect(layout.boxes.length).toBeGreaterThanOrEqual(4);

  for (let index = 0; index < layout.boxes.length; index += 1) {
    const current = layout.boxes[index];
    if (!current) continue;
    for (const candidate of layout.boxes.slice(index + 1)) {
      const overlapsHorizontally = current.x < candidate.right && candidate.x < current.right;
      const overlapsVertically = current.y < candidate.bottom && candidate.y < current.bottom;
      expect(
        overlapsHorizontally && overlapsVertically,
        `${current.key} and ${candidate.key} must not overlap`
      ).toBe(false);
    }
  }

  if (testInfo.project.name !== 'mobile') {
    const horizontalSurfaceGaps = await canvas.evaluate((element) => {
      const surfaces = Array.from(element.querySelectorAll<HTMLElement>('[data-workspace-widget]'))
        .map((widget) => {
          const surface = widget.querySelector<HTMLElement>(
            ':scope > [data-workspace-widget-content] > section'
          );
          const bounds = surface?.getBoundingClientRect();
          return bounds
            ? { x: bounds.x, y: bounds.y, right: bounds.right, bottom: bounds.bottom }
            : null;
        })
        .filter(
          (bounds): bounds is { x: number; y: number; right: number; bottom: number } =>
            bounds !== null
        );
      return surfaces.flatMap((left, index) =>
        surfaces.slice(index + 1).flatMap((right) => {
          const sameRow = Math.abs(left.y - right.y) < 2;
          if (!sameRow) return [];
          return right.x >= left.right ? [right.x - left.right] : [left.x - right.right];
        })
      );
    });
    expect(horizontalSurfaceGaps.some((gap) => Math.abs(gap - expectedGap) < 1)).toBe(true);
  }
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
          personPublicId: 'person-session-user',
          displayName: 'Admin',
          jobTitle: 'Platform administrator',
          email: 'admin@dwp.local',
          tenantId: 1,
          tenantCode: 'default',
          tenantName: 'SKAX',
          identityPlane: 'TENANT',
          preferredLocale: 'en',
          tenantDefaultLocale: 'en',
          roles: ['ADMIN'],
          groups: [],
          resourceRoles: [],
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
      const shell = document.querySelector('[data-testid="work-shell"]');
      const header = document.querySelector('[data-testid="work-header"]');
      const main = shell?.querySelector('main') ?? null;
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
  await expect(page.getByTestId('work-sidebar')).toHaveCSS('width', '72px');
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
          personPublicId: 'person-session-user',
          displayName: 'Admin',
          jobTitle: 'Platform administrator',
          email: 'admin@dwp.local',
          tenantId: 1,
          tenantCode: 'default',
          tenantName: 'SKAX',
          identityPlane: 'TENANT',
          preferredLocale: 'en',
          tenantDefaultLocale: 'en',
          roles: ['ADMIN'],
          groups: [],
          resourceRoles: [],
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
  const launchpad = page.locator('[data-launchpad-surface="page"]');
  const openWorkButton = page.getByRole('button', { name: 'Open Work' });
  await expect(openWorkButton).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open Administration' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit home' })).toBeEnabled();

  await openWorkButton.scrollIntoViewIfNeeded();
  const openWorkBounds = await openWorkButton.boundingBox();
  expect(openWorkBounds).not.toBeNull();
  await page.mouse.move(
    (openWorkBounds?.x ?? 0) + (openWorkBounds?.width ?? 0) / 2,
    (openWorkBounds?.y ?? 0) + (openWorkBounds?.height ?? 0) / 2
  );
  await page.mouse.down();
  try {
    await page.waitForTimeout(650);
    await expect(launchpad).toHaveAttribute('data-launchpad-editing', 'true');
    await expect(page.getByRole('button', { name: 'Move Work', exact: true })).toBeVisible();
    const composerToolbar = page.locator('[data-workspace-composer-placement="floating"]');
    await expect(composerToolbar).toBeVisible();
    const toolbarGeometry = await composerToolbar.evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return {
        bottom: Math.round(rect.bottom),
        left: Math.round(rect.left),
        position: window.getComputedStyle(node).position,
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth,
        right: Math.round(rect.right),
        top: Math.round(rect.top),
      };
    });
    expect(toolbarGeometry.position).toBe('fixed');
    expect(toolbarGeometry.top).toBeGreaterThanOrEqual(0);
    expect(toolbarGeometry.bottom).toBeLessThan(toolbarGeometry.viewportHeight);
    expect(toolbarGeometry.left).toBeGreaterThanOrEqual(0);
    expect(toolbarGeometry.right).toBeLessThanOrEqual(toolbarGeometry.viewportWidth);
    const iconMotion = await launchpad
      .locator('[data-launchpad-glyph]')
      .first()
      .evaluate((node) => {
        const style = window.getComputedStyle(node);
        return {
          animationName: style.animationName,
          iterationCount: style.animationIterationCount,
        };
      });
    expect(iconMotion.animationName).not.toBe('none');
    expect(iconMotion.iterationCount).toBe('1');

    const editingWorkButton = page.getByRole('button', { name: 'Move Work', exact: true });
    const editingWorkItem = editingWorkButton.locator('..');
    const removeWorkButton = editingWorkItem.getByRole('button', {
      name: 'Remove Work from home',
    });
    await expect(removeWorkButton).toHaveAttribute('data-launchpad-remove-control', 'minus');
    const editControlGeometry = await editingWorkItem.evaluate((item) => {
      const frame = item.querySelector<HTMLElement>('[data-launchpad-edit-frame]');
      const glyph = item.querySelector<HTMLElement>('[data-launchpad-glyph]');
      const removeControl = item.querySelector<HTMLElement>('[data-launchpad-remove-control]');
      if (!frame || !glyph || !removeControl) return null;

      const frameBounds = frame.getBoundingClientRect();
      const removeBounds = removeControl.getBoundingClientRect();
      const glyphTop = frame.clientTop + glyph.offsetTop;
      const glyphLeft = frame.clientLeft + glyph.offsetLeft;
      return {
        frame: [frame.offsetWidth, frame.offsetHeight],
        glyphInsets: [
          glyphTop,
          frame.offsetWidth - glyphLeft - glyph.offsetWidth,
          frame.offsetHeight - glyphTop - glyph.offsetHeight,
          glyphLeft,
        ],
        removeOverlapsTopLeft:
          removeBounds.top < frameBounds.top && removeBounds.left < frameBounds.left,
        removeCenterDeltaX: Math.round(
          removeBounds.left + removeBounds.width / 2 - frameBounds.left
        ),
      };
    });
    expect(editControlGeometry).toEqual({
      frame: [60, 60],
      glyphInsets: [4, 4, 4, 4],
      removeOverlapsTopLeft: true,
      removeCenterDeltaX: 0,
    });
  } finally {
    await page.mouse.up();
  }
  await expect(page.getByRole('dialog', { name: 'Create folder' })).toHaveCount(0);

  const activityButton = page.getByRole('button', { name: 'Move Activity', exact: true });
  const activityBounds = await activityButton.boundingBox();
  const askFrameBounds = await page.locator('[data-folder-target="dwp-ask"]').boundingBox();
  expect(activityBounds).not.toBeNull();
  expect(askFrameBounds).not.toBeNull();
  await page.mouse.move(
    (activityBounds?.x ?? 0) + (activityBounds?.width ?? 0) / 2,
    (activityBounds?.y ?? 0) + (activityBounds?.height ?? 0) / 2
  );
  await page.mouse.down();
  await page.mouse.move((askFrameBounds?.x ?? 0) - 2, (askFrameBounds?.y ?? 0) + 30, {
    steps: 12,
  });
  await page.mouse.up();
  await expect(page.getByRole('dialog', { name: 'Create folder' })).toHaveCount(0);
  await expect
    .poll(() =>
      page
        .getByRole('list', { name: 'Start work apps' })
        .locator('[data-launchpad-item]')
        .evaluateAll((items) => items.map((item) => item.getAttribute('data-launchpad-item')))
    )
    .toEqual(['dwp-work', 'dwp-activity', 'dwp-ask']);
  await page.getByRole('button', { name: 'Reset to default', exact: true }).click();

  const initialConnectItemIds = await page
    .getByRole('list', { name: 'Connect apps' })
    .locator('[data-launchpad-item]')
    .evaluateAll((items) => items.map((item) => item.getAttribute('data-launchpad-item')));
  const expectedConnectItemIds = [...initialConnectItemIds];
  const mailIndex = expectedConnectItemIds.indexOf('ref-app-mail');
  expect(mailIndex).toBeGreaterThanOrEqual(0);
  expectedConnectItemIds.splice(mailIndex, 0, 'ref-app-service');
  const serviceButton = page.getByRole('button', { name: 'Move Services', exact: true });
  const serviceBounds = await serviceButton.boundingBox();
  const mailFrameBounds = await page.locator('[data-folder-target="ref-app-mail"]').boundingBox();
  expect(serviceBounds).not.toBeNull();
  expect(mailFrameBounds).not.toBeNull();
  await page.mouse.move(
    (serviceBounds?.x ?? 0) + (serviceBounds?.width ?? 0) / 2,
    (serviceBounds?.y ?? 0) + (serviceBounds?.height ?? 0) / 2
  );
  await page.mouse.down();
  await page.mouse.move((mailFrameBounds?.x ?? 0) - 2, (mailFrameBounds?.y ?? 0) + 30, {
    steps: 12,
  });

  const serviceDropPreview = page.locator(
    '[data-launchpad-item="ref-app-service"][data-launchpad-drop-preview="true"]'
  );
  await expect(serviceDropPreview).toHaveAttribute('data-launchpad-group-id', 'connect');
  await expect
    .poll(() =>
      page
        .getByRole('list', { name: 'Connect apps' })
        .locator('[data-launchpad-item]')
        .evaluateAll((items) => items.map((item) => item.getAttribute('data-launchpad-item')))
    )
    .toEqual(expectedConnectItemIds);
  await expect
    .poll(() =>
      page
        .getByRole('list', { name: 'People & services apps' })
        .locator('[data-launchpad-item]')
        .evaluateAll((items) => items.map((item) => item.getAttribute('data-launchpad-item')))
    )
    .toEqual(['ref-app-people']);
  await page.mouse.up();
  await expect(page.getByRole('dialog', { name: 'Create folder' })).toHaveCount(0);
  await expect(serviceDropPreview).toHaveCount(0);
  await expect
    .poll(() =>
      page
        .getByRole('list', { name: 'Connect apps' })
        .locator('[data-launchpad-item]')
        .evaluateAll((items) => items.map((item) => item.getAttribute('data-launchpad-item')))
    )
    .toEqual(expectedConnectItemIds);
  await page.getByRole('button', { name: 'Reset to default', exact: true }).click();

  const createStartWorkFolder = async () => {
    const workButton = page.getByRole('button', { name: 'Move Work', exact: true });
    await expect(workButton).toBeVisible();
    await workButton.scrollIntoViewIfNeeded();
    const workBounds = await workButton.boundingBox();
    expect(workBounds).not.toBeNull();
    const sourceX = (workBounds?.x ?? 0) + (workBounds?.width ?? 0) / 2;
    const sourceY = (workBounds?.y ?? 0) + (workBounds?.height ?? 0) / 2;
    const askTargetBounds = await page.locator('[data-folder-target="dwp-ask"]').boundingBox();
    expect(askTargetBounds).not.toBeNull();
    await page.mouse.move(sourceX, sourceY);
    await page.mouse.down();
    await page.mouse.move(sourceX + 16, sourceY, { steps: 4 });
    await expect(page.locator('[data-launchpad-item="dwp-work"]')).toHaveAttribute(
      'data-launchpad-drop-preview',
      'true'
    );
    await page.mouse.move(
      (askTargetBounds?.x ?? 0) + (askTargetBounds?.width ?? 0) / 2,
      (askTargetBounds?.y ?? 0) + (askTargetBounds?.height ?? 0) / 2,
      { steps: 12 }
    );
    await page.waitForTimeout(300);
    await page.mouse.up();
    const createDialog = page.getByRole('dialog', { name: 'Create folder' });
    await expect(createDialog.getByRole('textbox', { name: 'Folder name' })).toHaveValue(
      'Start work folder'
    );
    await createDialog.getByRole('button', { name: 'Create' }).click();
  };

  await expect(
    page.getByRole('button', { name: 'Move Administration', exact: true })
  ).toBeVisible();
  await createStartWorkFolder();

  await page.getByRole('button', { name: 'Open folder Start work folder' }).click();
  const folderDialog = page.getByRole('dialog', { name: 'Start work folder' });
  await expect(folderDialog.getByRole('button', { name: 'Open Work' })).toBeVisible();
  await expect(folderDialog.getByRole('button', { name: 'Open DWAI·ON Workspace' })).toBeVisible();
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
  await expect(
    page.getByText('Work was placed with DWAI·ON Workspace.', { exact: true })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('button', { name: 'Open folder Start work folder' }).click();
  await page
    .getByRole('dialog', { name: 'Start work folder' })
    .getByRole('button', { name: 'Open Work' })
    .click();
  await expect(page).toHaveURL(/\/work/);
});

test('cross-group app drag commits the blank slot shown in the preview', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'Desktop pointer behavior is covered here.');

  await page.setViewportSize({ width: 1920, height: 900 });
  await mockAuthenticatedAdminSession(page);
  await page.route('**/api/auth/permissions', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: [
          ...DEFAULT_APP_PERMISSIONS,
          {
            resourceType: 'APP',
            resourceKey: 'APP.CALENDAR',
            permissionCode: 'VIEW',
            effect: 'ALLOW',
          },
        ],
      }),
    })
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'Edit home', exact: true }).click();

  const connectApps = page.getByRole('list', { name: 'Connect apps' });
  const serviceButton = page.getByRole('button', { name: 'Move Services', exact: true });
  const initialConnectItems = await connectApps
    .locator('[data-launchpad-item]')
    .evaluateAll((items) => items.map((item) => item.getAttribute('data-launchpad-item')));
  const blankSlot = await connectApps.evaluate((list) => {
    const items = Array.from(list.querySelectorAll<HTMLElement>(':scope > [data-launchpad-item]'));
    const firstItem = items[0];
    if (!firstItem) return null;

    const listStyle = window.getComputedStyle(list);
    const columnCount = listStyle.gridTemplateColumns.split(' ').filter(Boolean).length;
    if (columnCount < 1) return null;

    const firstBounds = firstItem.getBoundingClientRect();
    const listBounds = list.getBoundingClientRect();
    const columnGap = Number.parseFloat(listStyle.columnGap) || 0;
    const rowGap = Number.parseFloat(listStyle.rowGap) || 0;
    const columnWidth = (listBounds.width - Math.max(0, columnCount - 1) * columnGap) / columnCount;
    const targetIndex = items.length;
    const targetColumn = targetIndex % columnCount;
    const targetRow = Math.floor(targetIndex / columnCount);
    return {
      x: listBounds.left + targetColumn * (columnWidth + columnGap) + columnWidth / 2,
      y: firstBounds.top + firstBounds.height / 2 + targetRow * (firstBounds.height + rowGap),
    };
  });
  const serviceBounds = await serviceButton.boundingBox();
  expect(blankSlot).not.toBeNull();
  expect(serviceBounds).not.toBeNull();

  await page.mouse.move(
    (serviceBounds?.x ?? 0) + (serviceBounds?.width ?? 0) / 2,
    (serviceBounds?.y ?? 0) + (serviceBounds?.height ?? 0) / 2
  );
  await page.mouse.down();
  try {
    await page.mouse.move(blankSlot?.x ?? 0, blankSlot?.y ?? 0, { steps: 18 });
    const previewItems = [...initialConnectItems, 'ref-app-service'];
    await expect(
      page.locator('[data-launchpad-item="ref-app-service"][data-launchpad-drop-preview="true"]')
    ).toHaveAttribute('data-launchpad-group-id', 'connect');
    await expect
      .poll(() =>
        connectApps
          .locator('[data-launchpad-item]')
          .evaluateAll((items) => items.map((item) => item.getAttribute('data-launchpad-item')))
      )
      .toEqual(previewItems);
  } finally {
    await page.mouse.up();
  }

  await expect
    .poll(() =>
      connectApps
        .locator('[data-launchpad-item]')
        .evaluateAll((items) => items.map((item) => item.getAttribute('data-launchpad-item')))
    )
    .toEqual([...initialConnectItems, 'ref-app-service']);
  await expect(page.getByRole('dialog', { name: 'Create folder' })).toHaveCount(0);
});

test('personal home widgets persist user choices and restore governed defaults', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'The compact mobile home omits widget editing.');
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
          identityPlane: 'TENANT',
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
  await expect(page.getByText(/Announcements.*Organization managed.*fixed position/)).toBeVisible();
  await expect(page.locator('[data-workspace-widget="announcements"]')).toHaveAttribute(
    'data-workspace-widget-policy',
    'GOVERNED'
  );
  const activityWidget = page.locator('[data-workspace-widget="activity"]');
  const activityFootprint = activityWidget.locator('[data-widget-footprint-trigger]');
  await expect(activityFootprint).toHaveAttribute('aria-label', 'Select Live activity widget size');
  await expect(activityFootprint).toHaveAttribute('data-widget-footprint-trigger', 'quarter');
  await activityFootprint.click();
  const footprintPicker = page.getByRole('dialog', { name: 'Live activity widget size' });
  await expect(footprintPicker.locator('[data-widget-footprint-option]')).toHaveCount(4);
  await expect
    .poll(() =>
      footprintPicker
        .locator('[data-widget-footprint-option]')
        .evaluateAll((options) =>
          options.map((option) => option.getAttribute('data-widget-footprint-option'))
        )
    )
    .toEqual(['fifth', 'quarter', 'compact', 'medium']);
  await footprintPicker.getByRole('button', { name: 'Fit 5 widgets per row' }).click();
  await expect(activityFootprint).toHaveAttribute('data-widget-footprint-trigger', 'fifth');
  await page.keyboard.press('Escape');
  await expect(footprintPicker).toHaveCount(0);
  await page.getByRole('button', { name: 'Hide Live activity widget' }).click();
  const savedPreference = page.waitForRequest(
    (request) =>
      request.method() === 'PUT' &&
      new URL(request.url()).pathname === '/api/platform/v1/home-preferences'
  );
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const savedLayout = (
    (await savedPreference).postDataJSON() as {
      layout: { widgets: Array<{ widgetKey: string; size: string }> };
    }
  ).layout;
  expect(savedLayout.widgets.map((widget) => widget.widgetKey)).toEqual([
    'command-rail',
    'activity',
    'schedule',
    'daily-brief',
    'focus',
  ]);
  expect(savedLayout.widgets.find((widget) => widget.widgetKey === 'activity')?.size).toBe('fifth');
  await expect(page.getByRole('button', { name: 'Edit home', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Live activity' })).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Live activity' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Edit home' }).click();
  await page.getByRole('button', { name: 'Reset to default', exact: true }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Live activity' })).toBeVisible();
});

test('widget drag exposes an exact destination footprint before the layout changes', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'The compact mobile home omits widget editing.');
  await page.setViewportSize({ width: 1920, height: 1440 });
  await mockAuthenticatedAdminSession(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Edit home' }).click();

  const scheduleWidget = page.locator('[data-workspace-widget="schedule"]');
  const activityWidget = page.locator('[data-workspace-widget="activity"]');
  const personalWidgets = page.locator('[data-workspace-widget-policy="PERSONAL"]');
  const initialWidgetOrder = await personalWidgets.evaluateAll((widgets) =>
    widgets.map((widget) => widget.getAttribute('data-workspace-widget') ?? '')
  );
  const expectedWidgetOrder = [...initialWidgetOrder];
  const scheduleIndex = expectedWidgetOrder.indexOf('schedule');
  const activityIndex = expectedWidgetOrder.indexOf('activity');
  expect(scheduleIndex).toBeGreaterThanOrEqual(0);
  expect(activityIndex).toBeGreaterThanOrEqual(0);
  const [movedSchedule] = expectedWidgetOrder.splice(scheduleIndex, 1);
  if (movedSchedule) expectedWidgetOrder.splice(activityIndex, 0, movedSchedule);
  const scheduleHandle = scheduleWidget.getByRole('button', {
    name: 'Move Schedule widget',
    exact: true,
  });
  const [scheduleBounds, activityBounds, handleBounds] = await Promise.all([
    scheduleWidget.boundingBox(),
    activityWidget.boundingBox(),
    scheduleHandle.boundingBox(),
  ]);
  expect(scheduleBounds).not.toBeNull();
  expect(activityBounds).not.toBeNull();
  expect(handleBounds).not.toBeNull();
  if (!scheduleBounds || !activityBounds || !handleBounds) return;

  await page.mouse.move(
    handleBounds.x + handleBounds.width / 2,
    handleBounds.y + handleBounds.height / 2
  );
  await page.mouse.down();
  try {
    await page.mouse.move(
      activityBounds.x + activityBounds.width / 2,
      activityBounds.y + activityBounds.height / 2,
      { steps: 14 }
    );

    await expect(scheduleWidget).toHaveAttribute('data-widget-drop-preview', 'true');
    await expect(scheduleWidget.locator('[data-widget-drop-slot]')).toBeVisible();
    await expect(page.locator('[data-widget-drag-overlay]')).toBeVisible();
    await expect
      .poll(async () => {
        const [preview, displaced] = await Promise.all([
          scheduleWidget.boundingBox(),
          activityWidget.boundingBox(),
        ]);
        if (!preview || !displaced) return Number.POSITIVE_INFINITY;
        const overlapWidth = Math.max(
          0,
          Math.min(preview.x + preview.width, displaced.x + displaced.width) -
            Math.max(preview.x, displaced.x)
        );
        const overlapHeight = Math.max(
          0,
          Math.min(preview.y + preview.height, displaced.y + displaced.height) -
            Math.max(preview.y, displaced.y)
        );
        return overlapWidth * overlapHeight;
      })
      .toBe(0);

    const previewBounds = await scheduleWidget.boundingBox();
    expect(previewBounds).not.toBeNull();
    if (!previewBounds) return;
    expect(previewBounds.width).toBeCloseTo(scheduleBounds.width, 0);
    expect(previewBounds.height).toBeCloseTo(scheduleBounds.height, 0);
    expect(previewBounds.x).toBeCloseTo(activityBounds.x, 0);
    expect(previewBounds.y).toBeCloseTo(activityBounds.y, 0);
  } finally {
    await page.mouse.up();
  }

  await expect(scheduleWidget).not.toHaveAttribute('data-widget-drop-preview', 'true');
  await expect(page.locator('[data-widget-drag-overlay]')).toHaveCount(0);
  await expect
    .poll(() =>
      personalWidgets.evaluateAll((widgets) =>
        widgets.map((widget) => widget.getAttribute('data-workspace-widget'))
      )
    )
    .toEqual(expectedWidgetOrder);
});

test('personal home launcher only exposes explicitly entitled apps when app permissions exist', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'The compact mobile home omits the launchpad.');
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
          identityPlane: 'TENANT',
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
  await expect(page.getByRole('button', { name: 'Open DWAI·ON Workspace' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Open Administration' })).toHaveCount(0);
  await expect(
    page.getByRole('region', { name: 'Work tools' }).getByRole('button', { name: /^Open / })
  ).toHaveCount(1);
  await expectNoAutomaticAccessibilityViolations(page);

  await page.getByRole('button', { name: 'Account' }).click();
  await expect(page.getByRole('menuitem', { name: 'Administration console' })).toHaveCount(0);
  await page.keyboard.press('Escape');

  await page.goto('/apps');
  await expect(page.getByRole('heading', { name: 'Apps', exact: true })).toBeVisible();
  await expect(page.getByText('No apps are available')).toBeVisible();

  await page.goto('/dwaion');
  await expect(page).toHaveURL(/\/403/);
  await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible();

  await page.goto('/admin');
  await expect(page).toHaveURL(/\/403/);
});

test('reference work hub connects Home, Work, DWAI·ON, Activity, and Apps', async ({
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
          identityPlane: 'TENANT',
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

  const navigateTo = async (label: 'Work' | 'Activity' | 'Apps') => {
    if (new URL(page.url()).pathname !== '/') {
      if (testInfo.project.name === 'mobile') {
        await page.getByRole('button', { name: 'Open navigation' }).click();
      }
      await page.getByRole('link', { name: 'Back to personal home' }).click();
      await expect(page.getByRole('heading', { name: 'Welcome back, Admin' })).toBeVisible();
    }
    await page
      .getByRole('button', { name: label === 'Apps' ? 'All apps' : `Open ${label}` })
      .click();
  };

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome back, Admin' })).toBeVisible();
  await page.getByRole('button', { name: 'Open priority in Work' }).click();
  await expect(page).toHaveURL(/\/work\/queue\?item=WK-1042/);
  await expect(page.getByRole('heading', { name: 'Work', exact: true })).toBeVisible();
  await expect(page.getByRole('grid', { name: 'Work queue' })).toBeVisible();
  await expect(page.getByText('WK-1042 / Approval / Owner: You')).toBeVisible();

  const workSidebar =
    testInfo.project.name === 'mobile'
      ? page.getByTestId('work-mobile-sidebar')
      : page.getByTestId('work-sidebar');
  if (testInfo.project.name === 'mobile') {
    await page.getByTestId('work-mobile-navigation-trigger').click();
  }
  await expect(workSidebar.getByRole('link', { name: 'DWAI·ON', exact: true })).toHaveCount(0);
  await expect(workSidebar.getByRole('link', { name: 'Back to personal home' })).toBeVisible();
  if (testInfo.project.name === 'mobile') {
    await workSidebar.getByRole('button', { name: 'Close navigation' }).click();
  }
  await page
    .getByTestId('dwaion-launcher')
    .getByRole('button', { name: 'Open DWAI·ON', exact: true })
    .click();
  await expect(
    page.getByRole('dialog', { name: 'DWAI·ON conversation and support panel' })
  ).toBeVisible();
  await page.getByRole('textbox', { name: 'Ask DWAI·ON' }).fill('Can I work remotely next Friday?');
  await page.getByRole('button', { name: 'Send question' }).click();
  await expect(page.getByTestId('dwaion-answer')).toBeVisible();
  await expect(page.getByText(ASK_RUNTIME_FIXTURE.answer)).toBeVisible();
  await expect(page.getByText('2 sources reviewed', { exact: true })).toBeVisible();
  await expect(page.getByText('Policy allowed', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close DWAI·ON' }).click();

  await navigateTo('Activity');
  await expect(page.getByRole('heading', { name: 'Activity home', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Open full timeline' }).click();
  await expect(page).toHaveURL(/\/activity\/timeline/);
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
          identityPlane: 'TENANT',
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
  await page.route('**/api/auth/me/policy', (route) =>
    route.fulfill({
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
          requireMfa: true,
        },
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
