import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

type Item = {
  code: string;
  lifecycleState: 'DRAFT' | 'ACTIVE' | 'RETIRED';
  sortOrder: number;
  parentCode: string | null;
  validFrom: string | null;
  validTo: string | null;
  labels: Array<{ locale: string; label: string; description?: string | null }>;
  version: number;
};

type Detail = {
  setKey: string;
  name: string;
  description: string;
  lifecycleState: 'DRAFT' | 'ACTIVE' | 'RETIRED';
  revision: number;
  version: number;
  items: Item[];
};

type RegistryEntry = {
  registryType: 'APP' | 'CONNECTOR' | 'AGENT' | 'TOOL' | 'POLICY';
  entryKey: string;
  revision: number;
  name: string;
  description: string;
  ownerRef: string;
  riskTier: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  artifactVersion: string;
  lifecycleState: 'DRAFT' | 'ACTIVE' | 'RETIRED';
  version: number;
};

type IdentityUser = {
  userId: number;
  displayName: string;
  email: string;
  status: 'ACTIVE' | 'INACTIVE';
  mfaEnabled: boolean;
  roles: string[];
  accessRevision: number;
  version: number;
};

function envelope(data: unknown) {
  return JSON.stringify({ status: 'SUCCESS', message: 'OK', success: true, data });
}

async function mockAdminSession(page: Page) {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: envelope({
        userId: 1,
        displayName: 'Admin User',
        jobTitle: 'Platform administrator',
        email: 'admin@dwp.local',
        tenantId: 1,
        tenantCode: 'default',
        roles: ['ADMIN'],
      }),
    })
  );
  await page.route('**/api/auth/permissions', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: envelope([
        {
          resourceType: 'APP',
          resourceKey: 'APP.ADMINISTRATION',
          permissionCode: 'VIEW',
          effect: 'ALLOW',
        },
        {
          resourceType: 'ADMIN',
          resourceKey: 'ADMIN.API_MONITORING',
          permissionCode: 'VIEW',
          effect: 'ALLOW',
        },
      ]),
    })
  );
  await page.route('**/api/auth/csrf', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: envelope({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }),
    })
  );
  await page.route('**/api/platform/v1/tenant-branding', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: envelope({ organizationName: null, logoUrl: null, version: 0 }),
    })
  );
  await page.route('**/api/platform/v1/personal-preferences**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: envelope({
        schemaVersion: 1,
        customized: false,
        preferences: {
          appearance: { mode: 'system', density: 'standard' },
          accessibility: { highContrast: false, reduceMotion: false },
        },
        version: 0,
        updatedAt: null,
      }),
    })
  );
}

test('tenant administrators monitor API health and inspect a distributed trace', async ({
  page,
}) => {
  await mockAdminSession(page);
  const gatewayEvent = {
    historyId: '10000000-0000-0000-0000-000000000001',
    occurredAt: '2026-08-10T12:00:00Z',
    completedAt: '2026-08-10T12:00:00.084Z',
    ingestedAt: '2026-08-10T12:00:01Z',
    tenantId: 1,
    actorType: 'USER',
    actorId: '1',
    authType: 'SESSION',
    serviceName: 'dwp-gateway',
    serviceVersion: '0.1.0',
    serviceInstance: 'local',
    environment: 'test',
    observationPoint: 'GATEWAY',
    routeId: 'people-server',
    httpMethod: 'GET',
    routeTemplate: '/api/people/v1/people',
    requestPath: '/api/people/v1/people',
    httpScheme: 'http',
    httpProtocol: 'HTTP',
    statusCode: 200,
    outcome: 'SUCCESS',
    durationMs: 84,
    requestSizeBytes: 0,
    responseSizeBytes: 1240,
    correlationId: 'api-monitoring-e2e',
    traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
    spanId: '00f067aa0ba902b7',
    parentSpanId: null,
    clientAddressHash: 'a'.repeat(64),
    userAgentFamily: 'CHROMIUM',
    userAgentHash: 'b'.repeat(64),
    errorType: null,
    capturePolicyVersion: 'dwp-api-history-v1',
  };
  const serviceEvent = {
    ...gatewayEvent,
    historyId: '10000000-0000-0000-0000-000000000002',
    serviceName: 'dwp-people-server',
    observationPoint: 'SERVICE',
    routeId: null,
    routeTemplate: '/v1/people',
    requestPath: '/v1/people',
    durationMs: 31,
    spanId: '05e3ac9a4f6e3b90',
    parentSpanId: gatewayEvent.spanId,
  };

  await page.route('**/api/platform/v1/admin/api-history/overview**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: envelope({
        window: 'H24',
        observationPoint: 'GATEWAY',
        from: '2026-08-09T12:00:00Z',
        to: '2026-08-10T12:00:00Z',
        generatedAt: '2026-08-10T12:00:01Z',
        summary: {
          totalRequests: 1284,
          successfulRequests: 1242,
          clientErrorRequests: 32,
          serverErrorRequests: 10,
          errorRate: 0.78,
          p50DurationMs: 42,
          p95DurationMs: 184,
          p99DurationMs: 426,
          requestsPerMinute: 0.9,
          activeRoutesOrServices: 18,
        },
        trend: [
          {
            bucket: '2026-08-10T11:00:00Z',
            totalRequests: 54,
            clientErrors: 2,
            serverErrors: 1,
            p95DurationMs: 176,
          },
          {
            bucket: '2026-08-10T12:00:00Z',
            totalRequests: 68,
            clientErrors: 1,
            serverErrors: 0,
            p95DurationMs: 184,
          },
        ],
        topRoutes: [
          {
            routeId: 'people-server',
            serviceName: 'dwp-gateway',
            httpMethod: 'GET',
            routeTemplate: '/api/people/v1/people',
            totalRequests: 241,
            serverErrors: 1,
            errorRate: 0.41,
            p95DurationMs: 184,
          },
        ],
        statusDistribution: [
          { statusFamily: '2xx', count: 1242 },
          { statusFamily: '4xx', count: 32 },
          { statusFamily: '5xx', count: 10 },
        ],
      }),
    })
  );
  await page.route('**/api/platform/v1/admin/api-history/events**', (route) => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({
      contentType: 'application/json',
      body: envelope(
        path.endsWith(gatewayEvent.historyId)
          ? { selected: gatewayEvent, trace: [gatewayEvent, serviceEvent] }
          : { content: [gatewayEvent], nextCursor: null, size: 50 }
      ),
    });
  });

  await page.goto('/admin/governance/api-monitoring');

  await expect(page.getByRole('heading', { name: 'API monitoring', level: 1 })).toBeVisible();
  await expect(page.getByText('1,284', { exact: true })).toBeVisible();
  await expect(page.getByText('/api/people/v1/people', { exact: true }).first()).toBeVisible();
  await page.getByText('/api/people/v1/people', { exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'Request trace', level: 2 })).toBeVisible();
  await expect(page.getByText('dwp-people-server', { exact: true })).toBeVisible();

  const accessibility = await new AxeBuilder({ page })
    .include('[data-testid="api-monitoring"]')
    .analyze();
  expect(accessibility.violations).toEqual([]);
});

test('tenant administrators configure and reset the personal home presentation', async ({
  page,
}) => {
  await mockAdminSession(page);
  let homeExperience = {
    headline: null as string | null,
    subheadline: null as string | null,
    backgroundPosition: 'CENTER',
    overlayOpacity: 18,
    backgroundUrl: null as string | null,
    backgroundOriginalName: null as string | null,
    backgroundContentType: null as string | null,
    backgroundSizeBytes: null as number | null,
    backgroundWidth: null as number | null,
    backgroundHeight: null as number | null,
    version: 0,
  };

  await page.route('**/api/platform/v1/admin/home-experience**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET') {
      await route.fulfill({ contentType: 'application/json', body: envelope(homeExperience) });
      return;
    }
    if (request.method() === 'PUT') {
      const body = request.postDataJSON() as typeof homeExperience;
      homeExperience = { ...homeExperience, ...body, version: homeExperience.version + 1 };
      await route.fulfill({ contentType: 'application/json', body: envelope(homeExperience) });
      return;
    }
    if (path.endsWith('/background/reset')) {
      homeExperience = {
        ...homeExperience,
        backgroundUrl: null,
        backgroundOriginalName: null,
        backgroundContentType: null,
        backgroundSizeBytes: null,
        backgroundWidth: null,
        backgroundHeight: null,
        version: homeExperience.version + 1,
      };
      await route.fulfill({ contentType: 'application/json', body: envelope(homeExperience) });
      return;
    }
    if (path.endsWith('/background')) {
      homeExperience = {
        ...homeExperience,
        backgroundUrl: `/api/platform/v1/home-experience/background?v=${homeExperience.version + 1}`,
        backgroundOriginalName: 'agentic-workspace-hero.png',
        backgroundContentType: 'image/png',
        backgroundSizeBytes: 1_314_998,
        backgroundWidth: 1909,
        backgroundHeight: 494,
        version: homeExperience.version + 1,
      };
      await route.fulfill({ contentType: 'application/json', body: envelope(homeExperience) });
      return;
    }
    await route.fulfill({ status: 404 });
  });
  await page.route('**/api/platform/v1/home-experience/background**', (route) =>
    route.fulfill({
      contentType: 'image/png',
      path: 'public/assets/home/default/agentic-workspace-hero.png',
    })
  );

  await page.goto('/admin/experience/home-experience');
  await expect(page.getByRole('heading', { name: 'Home experience', level: 1 })).toBeVisible();
  await expect(page.getByText('Default background', { exact: true })).toBeVisible();
  await page.getByLabel('Headline').fill('One workspace, ready for action');
  await page
    .getByLabel('Supporting message')
    .fill('Your governed apps and priorities in one place.');
  await page.getByRole('button', { name: 'Right' }).click();
  await page.getByRole('button', { name: 'Save presentation' }).click();
  await expect(page.getByText('Home experience settings saved.', { exact: true })).toBeVisible();

  await page
    .locator('input[type="file"]')
    .setInputFiles('public/assets/home/default/agentic-workspace-hero.png');
  await page.getByRole('button', { name: 'Upload background' }).click();
  await expect(page.getByText('Home background uploaded.', { exact: true })).toBeVisible();
  await expect(page.getByText('Custom background', { exact: true })).toBeVisible();
  await expect(page.getByText('1909 x 494 / 1.3 MB')).toBeVisible();

  await page.getByRole('button', { name: 'Restore default' }).click();
  await expect(
    page.getByText('The default home background was restored.', { exact: true })
  ).toBeVisible();
  await expect(page.getByText('Default background', { exact: true })).toBeVisible();

  await expect(page.getByRole('alert')).toBeHidden({ timeout: 10_000 });
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});

test('tenant administrators manage co-branding and publish home announcements', async ({
  page,
}) => {
  await mockAdminSession(page);
  let branding = {
    organizationName: null as string | null,
    logoUrl: null as string | null,
    logoOriginalName: null as string | null,
    logoContentType: null as string | null,
    logoSizeBytes: null as number | null,
    logoWidth: null as number | null,
    logoHeight: null as number | null,
    version: 0,
  };
  let announcements: Array<{
    announcementId: number;
    title: string;
    message: string;
    severity: 'INFO';
    audienceType: 'ALL';
    audienceValue: null;
    startsAt: null;
    endsAt: null;
    pinned: boolean;
    actionLabel: null;
    actionUrl: null;
    lifecycleState: 'DRAFT' | 'PUBLISHED';
    publishedAt: string | null;
    publishedBy: number | null;
    version: number;
  }> = [];

  await page.route('**/api/platform/v1/admin/tenant-branding**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET') {
      await route.fulfill({ contentType: 'application/json', body: envelope(branding) });
      return;
    }
    if (request.method() === 'PUT') {
      const body = request.postDataJSON() as { organizationName: string | null };
      branding = {
        ...branding,
        organizationName: body.organizationName,
        version: branding.version + 1,
      };
    } else if (path.endsWith('/logo/reset')) {
      branding = {
        ...branding,
        logoUrl: null,
        logoOriginalName: null,
        logoContentType: null,
        logoSizeBytes: null,
        logoWidth: null,
        logoHeight: null,
        version: branding.version + 1,
      };
    } else if (path.endsWith('/logo')) {
      branding = {
        ...branding,
        logoUrl: `/api/platform/v1/tenant-branding/logo?v=${branding.version + 1}`,
        logoOriginalName: 'dwp-mark.svg',
        logoContentType: 'image/svg+xml',
        logoSizeBytes: 512,
        logoWidth: 48,
        logoHeight: 48,
        version: branding.version + 1,
      };
    }
    await route.fulfill({ contentType: 'application/json', body: envelope(branding) });
  });
  await page.route('**/api/platform/v1/tenant-branding/logo**', (route) =>
    route.fulfill({ contentType: 'image/svg+xml', path: 'public/assets/brand/dwp-mark.svg' })
  );
  await page.route('**/api/platform/v1/admin/announcements**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET') {
      await route.fulfill({ contentType: 'application/json', body: envelope(announcements) });
      return;
    }
    if (request.method() === 'POST' && path.endsWith('/publish')) {
      announcements = announcements.map((announcement) => ({
        ...announcement,
        lifecycleState: 'PUBLISHED',
        publishedAt: '2026-08-10T04:00:00Z',
        publishedBy: 1,
        version: announcement.version + 1,
      }));
    } else if (request.method() === 'POST' && path.endsWith('/announcements')) {
      const body = request.postDataJSON() as {
        definition: { title: string; message: string; pinned: boolean };
      };
      announcements = [
        {
          announcementId: 1,
          title: body.definition.title,
          message: body.definition.message,
          severity: 'INFO',
          audienceType: 'ALL',
          audienceValue: null,
          startsAt: null,
          endsAt: null,
          pinned: body.definition.pinned,
          actionLabel: null,
          actionUrl: null,
          lifecycleState: 'DRAFT',
          publishedAt: null,
          publishedBy: null,
          version: 0,
        },
      ];
    }
    await route.fulfill({ contentType: 'application/json', body: envelope(announcements[0]) });
  });

  await page.goto('/admin/experience/branding');
  await page.getByLabel('Organization name').fill('Northstar Semiconductor');
  await page.getByRole('button', { name: 'Save branding' }).click();
  await expect(page.getByText('Tenant branding saved.', { exact: true })).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles('public/assets/brand/dwp-mark.svg');
  await page.getByRole('button', { name: 'Upload logo' }).click();
  await expect(page.getByText('Tenant logo uploaded.', { exact: true })).toBeVisible();
  await expect(page.getByText('Custom logo', { exact: true })).toBeVisible();

  await page.goto('/admin/experience/announcements');
  await expect(page.getByText('No announcements')).toBeVisible();
  await page.getByRole('button', { name: 'New announcement' }).click();
  await page.getByLabel('Title').fill('Planned maintenance');
  await page.getByLabel('Message').fill('The employee portal will be read-only from 22:00.');
  await page.getByRole('switch', { name: 'Pinned' }).check();
  await page.getByRole('button', { name: 'Create draft' }).click();
  await expect(page.getByText('Announcement draft created.', { exact: true })).toBeVisible();
  await expect(page.getByText('Draft', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Publish Planned maintenance' }).click();
  await expect(page.getByText('Announcement published.', { exact: true })).toBeVisible();
  await expect(page.getByText('Published', { exact: true })).toBeVisible();
});

test('tenant administrators manage standards, registry, and audit', async ({ page }, testInfo) => {
  await mockAdminSession(page);
  let detail: Detail | null = null;
  let registryEntry: RegistryEntry | null = null;
  const auditEvents: unknown[] = [];
  const identityAuditEvents: unknown[] = [];
  const identityRoles = [
    {
      code: 'ADMIN',
      name: 'Administrator',
      description: 'Tenant administration',
      status: 'ACTIVE',
    },
    {
      code: 'EMPLOYEE',
      name: 'Employee',
      description: 'Workspace member',
      status: 'ACTIVE',
    },
  ];
  const identityUsers: IdentityUser[] = [
    {
      userId: 1,
      displayName: 'Admin User',
      email: 'admin@dwp.local',
      status: 'ACTIVE',
      mfaEnabled: true,
      roles: ['ADMIN'],
      accessRevision: 0,
      version: 0,
    },
    {
      userId: 2,
      displayName: 'Operations Lead',
      email: 'operations@dwp.local',
      status: 'ACTIVE',
      mfaEnabled: false,
      roles: ['EMPLOYEE'],
      accessRevision: 0,
      version: 0,
    },
  ];

  await page.route('**/api/auth/admin/identity/users**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const suffix = url.pathname.replace('/api/auth/admin/identity/users', '');
    if (request.method() === 'GET' && suffix === '') {
      await route.fulfill({
        contentType: 'application/json',
        body: envelope({
          content: identityUsers,
          page: 0,
          size: 100,
          totalElements: identityUsers.length,
          totalPages: 1,
        }),
      });
      return;
    }
    if (request.method() === 'PUT' && suffix === '/2/roles') {
      const body = request.postDataJSON() as { roleCodes: string[] };
      identityUsers[1] = {
        ...identityUsers[1],
        roles: [...body.roleCodes].sort(),
        accessRevision: identityUsers[1].accessRevision + 1,
        version: identityUsers[1].version + 1,
      };
      identityAuditEvents.unshift({
        auditEventId: 'audit-identity-role',
        actorType: 'USER',
        actorId: 1,
        action: 'identity.user-roles.replaced',
        targetType: 'USER_ACCESS',
        targetId: '2',
        outcome: 'SUCCESS',
        correlationId: 'corr-identity-role',
        occurredAt: '2026-08-08T09:05:00Z',
      });
      await route.fulfill({ contentType: 'application/json', body: envelope(identityUsers[1]) });
      return;
    }
    await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });

  await page.route('**/api/auth/admin/identity/roles', (route) =>
    route.fulfill({ contentType: 'application/json', body: envelope(identityRoles) })
  );

  await page.route('**/api/auth/admin/identity/audit-events**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: envelope({
        content: identityAuditEvents,
        page: 0,
        size: 100,
        totalElements: identityAuditEvents.length,
        totalPages: 1,
      }),
    })
  );

  await page.route('**/api/platform/v1/admin/reference-sets**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const suffix = url.pathname.replace('/api/platform/v1/admin/reference-sets', '');
    const body = request.postDataJSON() as Record<string, unknown> | null;

    if (request.method() === 'GET' && suffix === '') {
      const content = detail
        ? [{ ...detail, itemCount: detail.items.length, items: undefined }]
        : [];
      await route.fulfill({
        contentType: 'application/json',
        body: envelope({
          content,
          page: 0,
          size: 100,
          totalElements: content.length,
          totalPages: 1,
        }),
      });
      return;
    }
    if (request.method() === 'POST' && suffix === '') {
      detail = {
        setKey: String(body?.setKey),
        name: String(body?.name),
        description: String(body?.description || ''),
        lifecycleState: 'DRAFT',
        revision: 1,
        version: 0,
        items: [],
      };
      auditEvents.unshift({
        auditEventId: 'audit-create-set',
        actorType: 'USER',
        actorId: 1,
        action: 'reference-set.created',
        targetType: 'REFERENCE_SET',
        targetId: detail.setKey,
        outcome: 'SUCCESS',
        correlationId: 'corr-create-set',
        occurredAt: '2026-08-08T09:00:00Z',
      });
      await route.fulfill({ contentType: 'application/json', body: envelope(detail) });
      return;
    }
    if (request.method() === 'GET' && suffix === '/WORK_PRIORITY') {
      await route.fulfill({ contentType: 'application/json', body: envelope(detail) });
      return;
    }
    if (request.method() === 'POST' && suffix === '/WORK_PRIORITY/items' && detail) {
      const item: Item = {
        code: String(body?.code),
        lifecycleState: 'DRAFT',
        sortOrder: Number(body?.sortOrder),
        parentCode: null,
        validFrom: null,
        validTo: null,
        labels: (body?.labels as Item['labels']) || [],
        version: 0,
      };
      detail = { ...detail, revision: 2, version: 1, items: [item] };
      auditEvents.unshift({
        auditEventId: 'audit-create-item',
        actorType: 'USER',
        actorId: 1,
        action: 'reference-item.created',
        targetType: 'REFERENCE_ITEM',
        targetId: 'WORK_PRIORITY/HIGH',
        outcome: 'SUCCESS',
        correlationId: 'corr-create-item',
        occurredAt: '2026-08-08T09:01:00Z',
      });
      await route.fulfill({ contentType: 'application/json', body: envelope(detail) });
      return;
    }
    if (request.method() === 'POST' && suffix === '/WORK_PRIORITY/activate' && detail) {
      detail = {
        ...detail,
        lifecycleState: 'ACTIVE',
        revision: 3,
        version: 2,
        items: detail.items.map((item) => ({
          ...item,
          lifecycleState: 'ACTIVE',
          version: item.version + 1,
        })),
      };
      auditEvents.unshift({
        auditEventId: 'audit-activate-set',
        actorType: 'USER',
        actorId: 1,
        action: 'reference-set.activated',
        targetType: 'REFERENCE_SET',
        targetId: 'WORK_PRIORITY',
        outcome: 'SUCCESS',
        correlationId: 'corr-activate-set',
        occurredAt: '2026-08-08T09:02:00Z',
      });
      await route.fulfill({ contentType: 'application/json', body: envelope(detail) });
      return;
    }
    await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });

  await page.route('**/api/platform/v1/admin/registry-entries**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const suffix = url.pathname.replace('/api/platform/v1/admin/registry-entries', '');
    const body = request.postDataJSON() as Record<string, unknown> | null;

    if (request.method() === 'GET' && suffix === '') {
      const content = registryEntry ? [registryEntry] : [];
      await route.fulfill({
        contentType: 'application/json',
        body: envelope({
          content,
          page: 0,
          size: 100,
          totalElements: content.length,
          totalPages: 1,
        }),
      });
      return;
    }
    if (request.method() === 'POST' && suffix === '') {
      registryEntry = {
        registryType: body?.registryType as RegistryEntry['registryType'],
        entryKey: String(body?.entryKey),
        revision: 1,
        name: String(body?.name),
        description: String(body?.description || ''),
        ownerRef: String(body?.ownerRef),
        riskTier: body?.riskTier as RegistryEntry['riskTier'],
        artifactVersion: String(body?.artifactVersion),
        lifecycleState: 'DRAFT',
        version: 0,
      };
      auditEvents.unshift({
        auditEventId: 'audit-create-registry',
        actorType: 'USER',
        actorId: 1,
        action: 'registry-entry.created',
        targetType: 'REGISTRY_ENTRY',
        targetId: 'AGENT/DAILY_BRIEF@1',
        outcome: 'SUCCESS',
        correlationId: 'corr-create-registry',
        occurredAt: '2026-08-08T09:03:00Z',
      });
      await route.fulfill({ contentType: 'application/json', body: envelope(registryEntry) });
      return;
    }
    if (
      request.method() === 'POST' &&
      suffix === '/AGENT/DAILY_BRIEF/revisions/1/activate' &&
      registryEntry
    ) {
      registryEntry = { ...registryEntry, lifecycleState: 'ACTIVE', version: 1 };
      auditEvents.unshift({
        auditEventId: 'audit-activate-registry',
        actorType: 'USER',
        actorId: 1,
        action: 'registry-entry.activated',
        targetType: 'REGISTRY_ENTRY',
        targetId: 'AGENT/DAILY_BRIEF@1',
        outcome: 'SUCCESS',
        correlationId: 'corr-activate-registry',
        occurredAt: '2026-08-08T09:04:00Z',
      });
      await route.fulfill({ contentType: 'application/json', body: envelope(registryEntry) });
      return;
    }
    await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });

  await page.route('**/api/platform/v1/admin/audit-events**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: envelope({
        content: auditEvents,
        page: 0,
        size: 100,
        totalElements: auditEvents.length,
        totalPages: 1,
      }),
    })
  );

  await page.goto('/admin');
  await expect(page.getByTestId('admin-shell')).toBeVisible();
  await expect(page.getByTestId('desktop-sidebar')).toHaveCount(0);
  const adminSidebar =
    testInfo.project.name === 'mobile'
      ? page.getByTestId('admin-mobile-sidebar')
      : page.getByTestId('admin-sidebar');
  if (testInfo.project.name === 'mobile') {
    await page.getByRole('button', { name: 'Open administration navigation' }).click();
    await expect(
      adminSidebar.getByRole('navigation', {
        name: 'Administration navigation',
      })
    ).toBeVisible();
  } else {
    const adminNavigation = adminSidebar.getByRole('navigation', {
      name: 'Administration navigation',
    });
    await expect(adminNavigation).toBeVisible();
    await expect(adminNavigation.getByRole('button', { name: 'People & access' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    await expect(adminNavigation.getByRole('link', { name: 'Access control' })).toHaveAttribute(
      'aria-current',
      'page'
    );
  }
  const adminBrandLink = adminSidebar.getByRole('link', { name: 'Digital Workplace home' });
  await expect(adminBrandLink).toContainText('Control Center');
  await expect(adminBrandLink).toContainText('Digital Workplace');
  if (testInfo.project.name === 'mobile') {
    await page.keyboard.press('Escape');
  }
  await expect(page.getByRole('heading', { name: 'Identity access', level: 1 })).toBeVisible();
  const tenantUsers =
    testInfo.project.name === 'mobile'
      ? page.getByRole('list', { name: 'Tenant users' })
      : page.getByRole('grid', { name: 'Tenant users' });
  await expect(tenantUsers).toContainText('Operations Lead');
  await expect(page.getByRole('button', { name: 'Edit roles for Admin User' })).toBeDisabled();
  await page.getByRole('button', { name: 'Edit roles for Operations Lead' }).click();
  const accessDialog = page.getByRole('dialog', { name: 'Edit access' });
  await accessDialog.getByRole('checkbox', { name: /Administrator/ }).check();
  await accessDialog.getByRole('button', { name: 'Save access' }).click();
  await expect(tenantUsers).toContainText('ADMIN');

  await page.goto('/admin/platform/reference-data');
  await expect(page.getByText('No reference sets')).toBeVisible();

  await page.getByRole('button', { name: 'New reference set' }).click();
  await page.getByLabel('Set key').fill('WORK_PRIORITY');
  await page.getByLabel('Name').fill('Work priority');
  await page.getByRole('button', { name: 'Create set' }).click();
  await expect(
    page.getByLabel('Reference set detail').getByRole('heading', { name: 'Work priority' })
  ).toBeVisible();

  await page.getByRole('button', { name: 'New reference item' }).click();
  const itemDialog = page.getByRole('dialog', { name: 'New reference item' });
  await itemDialog.getByRole('textbox', { name: 'Code', exact: true }).fill('HIGH');
  await itemDialog.getByLabel('Sort order').fill('10');
  await itemDialog.getByRole('textbox', { name: 'Label', exact: true }).first().fill('높음');
  await itemDialog.getByRole('button', { name: 'Create item' }).click();
  const referenceItems =
    testInfo.project.name === 'mobile'
      ? page.getByRole('list', { name: 'Reference items' })
      : page.getByRole('grid', { name: 'Reference items' });
  await expect(referenceItems).toContainText('HIGH');

  await page.getByRole('button', { name: 'Activate reference set' }).click();
  await page
    .getByRole('dialog', { name: 'Activate reference set?' })
    .getByRole('button', {
      name: 'Activate',
    })
    .click();
  await expect(page.getByText('Active').first()).toBeVisible();

  await page.goto('/admin/platform/registry');
  const registryEntries =
    testInfo.project.name === 'mobile'
      ? page.getByRole('list', { name: 'Product registry entries' })
      : page.getByRole('grid', { name: 'Product registry entries' });
  await expect(registryEntries).toContainText('No registry entries');
  await page.getByRole('button', { name: 'New registry entry' }).click();
  const registryDialog = page.getByRole('dialog', { name: 'New registry entry' });
  await registryDialog.getByLabel('Registry type').click();
  await page.getByRole('option', { name: 'Agent' }).click();
  await registryDialog.getByLabel('Registry key').fill('DAILY_BRIEF');
  await registryDialog.getByLabel('Name').fill('Daily brief');
  await registryDialog.getByLabel('Owner reference').fill('team:ai-platform');
  await registryDialog.getByRole('button', { name: 'Create draft' }).click();
  await expect(registryEntries).toContainText('DAILY_BRIEF');
  await page.getByRole('button', { name: 'Activate DAILY_BRIEF' }).click();
  await page
    .getByRole('dialog', { name: 'Activate DAILY_BRIEF?' })
    .getByRole('button', { name: 'Activate' })
    .click();
  await expect(registryEntries).toContainText('Active');

  await page.goto('/admin/governance/audit');
  const auditList =
    testInfo.project.name === 'mobile'
      ? page.getByRole('list', { name: 'Administration audit events' })
      : page.getByRole('grid', { name: 'Administration audit events' });
  await expect(auditList).toContainText('Identity User Roles Replaced');
  await expect(auditList).toContainText('Reference Set Activated');
  await expect(auditList).toContainText('Registry Entry Activated');

  await expect(page.getByRole('alert')).toBeHidden({ timeout: 10_000 });
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});
