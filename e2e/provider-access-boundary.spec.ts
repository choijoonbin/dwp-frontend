import { expect, test } from '@playwright/test';

import { mockShellSession } from './support/shell-session';

async function mockProvider(page: Parameters<typeof mockShellSession>[0], roles: string[]) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockShellSession(page, roles, {
    identityPlane: 'PROVIDER',
    locale: 'en',
    displayName: 'Provider Operator',
    appearance: {
      mode: 'light',
      density: 'standard',
      highContrast: false,
      reduceMotion: true,
    },
  });
}

async function mockProviderOperator(
  page: Parameters<typeof mockShellSession>[0],
  role: string,
  permissions: string[]
) {
  await page.route('**/api/provider/v1/admin/me', (route) =>
    route.fulfill({
      json: {
        data: {
          operatorId: 1,
          authUserId: 1,
          displayName: 'Least-privilege Provider Approver',
          roles: [role],
          permissions,
        },
      },
    })
  );
}

async function mockActiveDiagnosis(page: Parameters<typeof mockShellSession>[0], scopes: string[]) {
  let active = true;
  await page.route('**/api/provider/v1/admin/support-session-context', (route) =>
    route.fulfill({
      json: {
        data: active
          ? {
              supportSessionId: 'support-preview-12345678',
              tenantId: 'tenant-skax',
              tenantKey: 'skax-production',
              environmentKey: 'production',
              dataRegion: 'ap-northeast-2',
              tenantName: 'SKAX Production',
              scopes,
              accessMode: 'STANDARD',
              expiresAt: '2099-08-26T03:00:00.000Z',
              version: 1,
            }
          : null,
      },
    })
  );
  await page.route(
    '**/api/provider/v1/admin/support-sessions/support-preview-12345678/revoke',
    (route) => {
      active = false;
      return route.fulfill({
        json: {
          data: {
            supportSessionId: 'support-preview-12345678',
            version: 2,
            state: 'REVOKED',
          },
        },
      });
    }
  );
}

const tenantExperiencePreview = {
  contractVersion: 'tenant-experience-preview.v1',
  previewMode: 'TENANT_CONFIGURATION_ONLY',
  generatedAt: '2026-08-26T02:55:00.000Z',
  branding: {
    organizationName: 'SKAX',
    accentColor: '#2457D6',
    logoConfigured: true,
    logoWidth: 160,
    logoHeight: 40,
    version: 3,
  },
  home: {
    headline: 'Work together',
    subheadline: 'A fixed configuration synthesis',
    localizedContent: {},
    defaultLocale: 'en',
    backgroundConfigured: true,
    backgroundPosition: 'CENTER',
    backgroundFocalX: 50,
    backgroundFocalY: 50,
    mobileBackgroundFocalX: 50,
    mobileBackgroundFocalY: 50,
    contentAlignment: 'LEFT',
    overlayOpacity: 20,
    backgroundWidth: 1920,
    backgroundHeight: 640,
    launchpadConfiguration: {
      schemaVersion: 1,
      groups: [
        {
          groupKey: 'work',
          labels: { ko: '업무', en: 'Work' },
          descriptions: {},
          sortOrder: 1,
          enabled: true,
        },
      ],
      placements: [{ resourceKey: 'APP.MAIL', groupKey: 'work', sortOrder: 1 }],
    },
    compositionPolicy: {
      schemaVersion: 3,
      experienceVariant: 'FLOW_V1',
      personalCustomizationEnabled: true,
      governedZones: [
        {
          zoneKey: 'announcements',
          placement: 'CANVAS',
          visible: true,
          size: 'compact',
          height: 'short',
          sortOrder: 20,
        },
      ],
    },
    effectiveExperienceVariant: 'FLOW_V1',
    version: 7,
  },
  excludedData: [
    'USER_PERSONALIZATION',
    'USER_CONTENT',
    'WORKFORCE_DATA',
    'LIVE_ANNOUNCEMENTS',
    'ASSET_LOCATIONS',
    'AUDIT_ACTOR_METADATA',
  ],
};

async function mockTenantExperiencePreview(page: Parameters<typeof mockShellSession>[0]) {
  await page.route('**/api/platform/v1/admin/tenant-experience-preview', (route) =>
    route.fulfill({ json: { data: tenantExperiencePreview } })
  );
}

for (const invalidIdentity of [
  { label: 'missing plane', roles: ['WORKSPACE_MEMBER'], identityPlane: null },
  { label: 'unknown plane', roles: ['WORKSPACE_MEMBER'], identityPlane: 'UNKNOWN' },
  {
    label: 'mixed provider and tenant roles',
    roles: ['PROVIDER_SUPPORT', 'TENANT_ADMIN'],
    identityPlane: 'PROVIDER',
  },
] as const) {
  test(`invalid identity contract (${invalidIdentity.label}) fails closed before tenant APIs`, async ({
    page,
  }) => {
    await mockShellSession(page, [...invalidIdentity.roles], {
      identityPlane: invalidIdentity.identityPlane,
      locale: 'en',
    });
    const protectedRequests: string[] = [];
    page.on('request', (request) => {
      const pathname = new URL(request.url()).pathname;
      if (
        pathname === '/api/auth/permissions' ||
        pathname.startsWith('/api/platform/v1/personal-preferences') ||
        pathname.startsWith('/api/platform/v1/tenant-branding') ||
        pathname.startsWith('/api/auth/product-surface-contexts')
      ) {
        protectedRequests.push(pathname);
      }
    });

    await page.goto('/admin');

    await expect(page).toHaveURL(/\/sign-in(?:\?|$)/);
    await expect(page.getByRole('textbox', { name: 'Email' })).toBeVisible();
    expect(protectedRequests).toEqual([]);
  });
}

for (const persona of [
  {
    role: 'PROVIDER_RELEASE_APPROVER',
    permissions: ['FEATURE_ROLLOUT_READ', 'FEATURE_ROLLOUT_APPROVE'],
    destination: '/provider/feature-rollouts',
    heading: 'Feature rollout control',
  },
  {
    role: 'PROVIDER_DATA_APPROVER',
    permissions: ['DATA_GOVERNANCE_READ', 'DATA_GOVERNANCE_APPROVE'],
    destination: '/provider/data-governance',
    heading: 'Data assets & flow',
  },
] as const) {
  test(`${persona.role} enters and returns to its first readable Provider surface`, async ({
    page,
  }, testInfo) => {
    await mockProvider(page, [persona.role]);
    await mockProviderOperator(page, persona.role, [...persona.permissions]);
    const estateRequests: string[] = [];
    page.on('request', (request) => {
      const path = new URL(request.url()).pathname;
      if (path === '/api/provider/v1/admin/tenants') estateRequests.push(path);
    });

    await page.goto('/');

    await expect(page).toHaveURL(new RegExp(`${persona.destination}$`));
    await expect(page.getByRole('heading', { name: persona.heading, level: 1 })).toBeVisible();

    await page.goto('/account/settings/appearance');
    const mobile = testInfo.project.name === 'mobile';
    const accountNavigation = page.getByTestId(
      mobile ? 'account-mobile-sidebar' : 'account-sidebar'
    );
    if (mobile) {
      const openSettingsNavigation = page.getByTestId('account-mobile-navigation-trigger');
      await openSettingsNavigation.focus();
      await openSettingsNavigation.press('Enter');
      await expect(accountNavigation).toBeVisible();
    }
    const backToProvider = accountNavigation.getByRole('link', {
      name: 'Back to Provider Control Plane',
    });
    await expect(backToProvider).toBeVisible();
    await expect(backToProvider).toHaveAttribute('href', '/provider');
    await backToProvider.focus();
    await backToProvider.press('Enter');
    await expect(page).toHaveURL(new RegExp(`${persona.destination}$`));
    expect(estateRequests).toEqual([]);
  });
}

test('roleless provider account settings stay local and hide tenant-owned destinations', async ({
  page,
}) => {
  await mockProvider(page, []);
  const legacyProviderPreferenceKey = 'dwp.provider-preference.v1:provider:1:1';
  const providerPreferenceKey = 'dwp.provider-realm-preference.v2:realm:DWP_PROVIDER:user:1';
  const otherProviderPreferenceKey = 'dwp.provider-preference.v1:provider:1:99';
  const tenantRegional = JSON.stringify({
    timeZone: 'America/New_York',
    dateFormat: 'month_first',
    timeFormat: '12_hour',
    firstDayOfWeek: 'sunday',
    numberFormat: 'comma_decimal',
  });
  await page.addInitScript(
    ({ storageKey, otherStorageKey, regional }) => {
      if (window.sessionStorage.getItem('provider-preference-seeded')) return;
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({ preferences: { tenantHome: { copiedFromTenant: true } } })
      );
      window.localStorage.setItem(otherStorageKey, '{"owner":"other-provider"}');
      window.localStorage.setItem('dwp.regional.v2', regional);
      window.sessionStorage.setItem('provider-preference-seeded', 'true');
    },
    {
      storageKey: legacyProviderPreferenceKey,
      otherStorageKey: otherProviderPreferenceKey,
      regional: tenantRegional,
    }
  );
  const tenantScopedRequests: string[] = [];
  page.on('request', (request) => {
    const pathname = new URL(request.url()).pathname;
    if (
      pathname.startsWith('/api/platform/v1/personal-preferences') ||
      pathname.startsWith('/api/platform/v1/tenant-branding') ||
      pathname.startsWith('/api/auth/policy') ||
      pathname.startsWith('/api/auth/me/policy') ||
      pathname.startsWith('/api/auth/idp') ||
      pathname.startsWith('/api/auth/product-surface-contexts') ||
      pathname.startsWith('/api/notifications/')
    ) {
      tenantScopedRequests.push(pathname);
    }
  });

  await page.goto('/account/settings/home');

  await expect(page).toHaveURL(/\/account\/settings\/appearance$/);
  await expect(page.getByTestId('account-header')).toHaveAttribute(
    'data-dwp-shell-scope',
    'provider'
  );
  await expect(page.getByTestId('shell-workspace-identity')).toHaveCount(0);
  const accountTrigger = page.getByRole('button', {
    name: /^Account: Provider Operator,/,
  });
  await expect(accountTrigger).toBeVisible();
  await accountTrigger.click();
  await expect(page.getByText('Access · Provider access pending', { exact: true })).toBeVisible();
  await expect(page.getByText('Access · Workspace member', { exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(accountTrigger).toBeFocused();
  await expect(page.getByRole('heading', { name: 'Appearance', level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Home workspace' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Notifications' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Managed settings' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Search DWP' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /notifications/i })).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem('dwp.regional.v2')))
    .toBe(tenantRegional);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.timeZone))
    .toBe('system');
  const providerNamespacesAfterLoad = await page.evaluate((storageKey) => {
    const stored = JSON.parse(window.localStorage.getItem(storageKey) ?? '{}') as {
      preferences?: Record<string, unknown>;
    };
    return Object.keys(stored.preferences ?? {}).sort();
  }, providerPreferenceKey);
  expect(providerNamespacesAfterLoad).toEqual(['accessibility', 'appearance', 'regional']);
  expect(
    await page.evaluate(
      (storageKey) => window.localStorage.getItem(storageKey),
      legacyProviderPreferenceKey
    )
  ).toBeNull();

  await page.getByRole('button', { name: 'Dark' }).click();
  await expect(page.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true');
  const providerPreferenceNamespaces = await page.evaluate((storageKey) => {
    const stored = JSON.parse(window.localStorage.getItem(storageKey) ?? '{}') as {
      preferences?: Record<string, unknown>;
    };
    return Object.keys(stored.preferences ?? {}).sort();
  }, providerPreferenceKey);
  expect(providerPreferenceNamespaces).toEqual(['accessibility', 'appearance', 'regional']);
  expect(await page.evaluate(() => window.localStorage.getItem('dwp.regional.v2'))).toBe(
    tenantRegional
  );
  expect(
    await page.evaluate(
      (storageKey) => window.localStorage.getItem(storageKey),
      otherProviderPreferenceKey
    )
  ).toBe('{"owner":"other-provider"}');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Reset preferences' }).click();
  await expect(page.getByRole('button', { name: 'System' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );

  await page.goto('/account/profile');
  await expect(page.getByText('DWP provider control plane', { exact: true })).toBeVisible();
  await expect(page.getByText('Tenant record', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Auth / identity directory', { exact: true })).toHaveCount(2);
  await expect(page.getByText('Provider operator directory', { exact: true })).toHaveCount(0);

  await page.goto('/account/security');
  await expect(page.getByText(/DWP provider identity realm/)).toBeVisible();
  await expect(page.getByText('Provider managed', { exact: true })).toBeVisible();
  await expect(page.getByText('Tenant managed', { exact: true })).toHaveCount(0);
  expect(tenantScopedRequests).toEqual([]);
});

test('roleless provider sees access pending without issuing tenant API requests', async ({
  page,
}) => {
  await mockProvider(page, []);
  const tenantRequests: string[] = [];
  page.on('request', (request) => {
    const pathname = new URL(request.url()).pathname;
    if (
      pathname.startsWith('/api/platform/') ||
      pathname.startsWith('/api/notifications/') ||
      pathname === '/api/auth/product-surface-contexts'
    ) {
      tenantRequests.push(pathname);
    }
  });

  await page.goto('/provider/overview');

  await expect(
    page.getByRole('heading', { name: 'Provider access is awaiting assignment' })
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open account settings' })).toBeVisible();
  expect(tenantRequests).toEqual([]);
});

test('durable provider plane blocks tenant admin routes without an active session', async ({
  page,
}) => {
  await mockProvider(page, ['PROVIDER_ADMIN']);

  await page.goto('/admin');

  await expect(page).toHaveURL(/\/provider\/overview$/);
  await expect(page.getByRole('heading', { name: 'Operations command center' })).toBeVisible();
});

test('dedicated preview scope renders only the redacted aggregate configuration', async ({
  page,
}) => {
  await mockProvider(page, ['PROVIDER_SUPPORT']);
  await mockActiveDiagnosis(page, ['TENANT_EXPERIENCE_PREVIEW']);
  const requestedTenantData: string[] = [];
  let productAuthorityRequests = 0;
  page.on('request', (request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.startsWith('/api/platform/v1/admin/')) requestedTenantData.push(pathname);
    if (pathname === '/api/auth/product-surface-contexts') productAuthorityRequests += 1;
  });
  await mockTenantExperiencePreview(page);

  await page.goto('/provider/tenants/tenant-skax/experience-preview');

  await expect(
    page.getByRole('heading', { name: 'Tenant experience configuration preview' })
  ).toBeVisible();
  await expect(page.getByRole('region', { name: 'Active tenant diagnosis session' })).toContainText(
    'SKAX Production'
  );
  const watermark = page.getByTestId('tenant-configuration-preview-watermark');
  await expect(watermark).toContainText('CONFIG ONLY · ASSETS REDACTED · NOT CUSTOMER UI');
  await expect(watermark).toContainText('skax-production / production');
  await expect(watermark).toContainText('Branding v3 · Home v7');
  await expect(watermark).toContainText('Generated · 2026-08-26T02:55:00.000Z');
  await expect(page.getByText('Logo asset redacted')).toBeVisible();
  await expect(page.getByText(/Excluded by contract:/)).toContainText('USER_PERSONALIZATION');
  expect(requestedTenantData.length).toBeGreaterThan(0);
  expect(new Set(requestedTenantData)).toEqual(
    new Set(['/api/platform/v1/admin/tenant-experience-preview'])
  );
  expect(productAuthorityRequests).toBe(0);
  const previewRequestCount = requestedTenantData.length;

  await page.goto('/admin');
  await expect(page).toHaveURL(/\/provider\/overview$/);
  expect(requestedTenantData).toHaveLength(previewRequestCount);
});

test('invalid preview contract is withheld before any tenant configuration renders', async ({
  page,
}) => {
  await mockProvider(page, ['PROVIDER_SUPPORT']);
  await mockActiveDiagnosis(page, ['TENANT_EXPERIENCE_PREVIEW']);
  await page.route('**/api/platform/v1/admin/tenant-experience-preview', (route) =>
    route.fulfill({
      json: {
        data: {
          ...tenantExperiencePreview,
          tenantUserContent: 'must-not-render',
        },
      },
    })
  );

  await page.goto('/provider/tenants/tenant-skax/experience-preview');

  await expect(page.getByText('The complete configuration could not be verified')).toBeVisible();
  await expect(page.getByTestId('tenant-configuration-preview-watermark')).toHaveCount(0);
  await expect(page.getByText('must-not-render')).toHaveCount(0);
  await expect(page.getByText('Work together')).toHaveCount(0);
});

test('active diagnosis remains globally visible and keyboard-revocable', async ({ page }) => {
  await mockProvider(page, ['PROVIDER_SUPPORT']);
  await mockActiveDiagnosis(page, ['TENANT_EXPERIENCE_PREVIEW']);

  await page.goto('/provider/overview');

  const supportBar = page.getByRole('region', { name: 'Active tenant diagnosis session' });
  await expect(supportBar).toContainText('SKAX Production');
  await expect(supportBar).toContainText('Tenant · skax-production');
  await expect(supportBar).toContainText('Remaining ·');
  await expect(supportBar.getByRole('button', { name: 'Revoke support session' })).toBeVisible();
  await supportBar.getByRole('button', { name: 'Revoke support session' }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/provider\/support$/);
  await expect(page.getByRole('region', { name: 'Active tenant diagnosis session' })).toHaveCount(
    0
  );
});

test('preview-only diagnosis cannot unlock tenant workspace routes', async ({ page }) => {
  await mockProvider(page, ['PROVIDER_SUPPORT']);
  await mockActiveDiagnosis(page, ['TENANT_EXPERIENCE_PREVIEW']);

  await page.goto('/');
  await expect(page).toHaveURL(/\/provider\/overview$/);

  await page.goto('/apps');
  await expect(page).toHaveURL(/\/provider\/overview$/);

  await page.goto('/notifications/home');
  await expect(page).toHaveURL(/\/provider\/overview$/);
});

test('active diagnosis redirects provider account routes to the governed session', async ({
  page,
}) => {
  await mockProvider(page, ['PROVIDER_SUPPORT']);
  await mockActiveDiagnosis(page, ['TENANT_EXPERIENCE_PREVIEW']);

  for (const path of ['/account/profile', '/account/security', '/account/settings/appearance']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/provider\/support$/);
    await expect(
      page.getByRole('region', { name: 'Active tenant diagnosis session' })
    ).toContainText('SKAX Production');
  }
});

test('preview keeps the active diagnosis visible and allows direct revocation', async ({
  page,
}) => {
  await mockProvider(page, ['PROVIDER_SUPPORT']);
  await mockActiveDiagnosis(page, ['TENANT_EXPERIENCE_PREVIEW']);
  await mockTenantExperiencePreview(page);

  await page.goto('/provider/tenants/tenant-skax/experience-preview');

  const diagnosis = page.getByRole('region', { name: 'Active tenant diagnosis session' });
  await expect(diagnosis).toBeVisible();
  await expect(diagnosis).toContainText('SKAX Production');
  await expect(diagnosis).toContainText('Tenant · skax-production');
  await expect(diagnosis).toContainText('Environment · production');
  await expect(diagnosis).toContainText('Region · ap-northeast-2');
  await expect(diagnosis).toContainText('Session · support-');
  await expect(diagnosis).toContainText('Remaining ·');
  await expect(diagnosis).toContainText('Preview redacted tenant experience configuration');
  await diagnosis.getByRole('button', { name: 'Revoke support session' }).click();

  await expect(page).toHaveURL(/\/provider\/support$/);
  await expect(page.getByRole('button', { name: 'Start tenant diagnosis' })).toBeVisible();
});

test('configuration-read scope cannot call the dedicated experience preview endpoint', async ({
  page,
}) => {
  await mockProvider(page, ['PROVIDER_SUPPORT']);
  await mockActiveDiagnosis(page, ['TENANT_CONFIGURATION_READ']);
  let previewRequests = 0;
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/platform/v1/admin/tenant-experience-preview') {
      previewRequests += 1;
    }
  });

  await page.goto('/provider/tenants/tenant-skax/experience-preview');

  await expect(
    page.getByRole('heading', { name: 'Configuration preview is outside the approved scope' })
  ).toBeVisible();
  expect(previewRequests).toBe(0);
});

test('retired configuration and workforce scopes never unlock tenant admin or product routes', async ({
  page,
}) => {
  await mockProvider(page, ['PROVIDER_SUPPORT']);
  await mockActiveDiagnosis(page, ['TENANT_CONFIGURATION_READ', 'WORKFORCE_READ']);
  let productAuthorityRequests = 0;
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/auth/product-surface-contexts') {
      productAuthorityRequests += 1;
    }
  });

  await page.goto('/admin');
  await expect(page).toHaveURL(/\/provider\/overview$/);

  await page.goto('/hr/directory');
  await expect(page).toHaveURL(/\/provider\/overview$/);
  expect(productAuthorityRequests).toBe(0);
});

test('provider support exposes only the independently reviewed diagnosis flow', async ({
  page,
}) => {
  await mockProvider(page, ['PROVIDER_ADMIN']);
  const supportWrites: string[] = [];
  page.on('request', (request) => {
    const pathname = new URL(request.url()).pathname;
    if (request.method() === 'POST' && pathname.startsWith('/api/provider/v1/admin/support-')) {
      supportWrites.push(pathname);
    }
  });

  await page.goto('/provider/support');
  await page.getByRole('button', { name: 'Start tenant diagnosis' }).first().click();

  await expect(page.getByRole('button', { name: 'Submit for review' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Activate emergency access' })).toHaveCount(0);
  await expect(page.getByText('Emergency access', { exact: true })).toHaveCount(0);
  const dialog = page.getByRole('dialog');
  await expect(
    dialog.getByRole('checkbox', {
      name: /Preview redacted tenant experience configuration/,
    })
  ).toBeVisible();
  await expect(dialog.getByRole('checkbox', { name: /tenant configuration/i })).toHaveCount(0);
  await expect(dialog.getByRole('checkbox', { name: /workforce/i })).toHaveCount(0);

  await page.getByRole('combobox', { name: 'Tenant' }).click();
  await page.getByRole('option', { name: /SKAX Production/ }).click();
  await page.getByLabel('Business justification').fill('Diagnose an approved support case.');
  await page.getByLabel('Customer approval reference').fill('SKAX-CASE-2408');
  await page.getByRole('button', { name: 'Submit for review' }).click();

  await expect
    .poll(() => supportWrites)
    .toEqual(['/api/provider/v1/admin/support-access-requests']);
});
