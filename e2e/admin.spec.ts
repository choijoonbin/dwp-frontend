import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { mockAuthenticatedRuntime } from './support/runtime-access';
import { FULL_PRODUCT_PERMISSIONS, mockShellSession } from './support/shell-session';

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
  effectiveRoles: string[];
  effectiveAccess: Array<{
    roleId: number;
    roleCode: string;
    roleName: string;
    privileged: boolean;
    sourceType: 'DIRECT' | 'GROUP';
    sourceId: number;
    sourceKey: string;
    sourceName: string;
    assignmentType: string;
    scopeType: string;
    scopeRef: string | null;
    validFrom: string | null;
    validTo: string | null;
    assignedAt: string;
  }>;
  lastSignInAt: string | null;
  activeSessionCount: number;
  roleManagement: {
    allowed: boolean;
    reason: 'ALLOWED' | 'SELF' | 'IDENTITY_INACTIVE' | 'PROTECTED_ROLE';
  };
  accessRevision: number;
  version: number;
};

function envelope(data: unknown) {
  return JSON.stringify({ status: 'SUCCESS', message: 'OK', success: true, data });
}

type AdminSessionOptions = {
  roles?: string[];
  permissions?: Array<{
    resourceType: string;
    resourceKey: string;
    permissionCode: string;
    effect: 'ALLOW' | 'DENY';
  }>;
};

const DEFAULT_ADMIN_PERMISSIONS = [
  {
    resourceType: 'APP',
    resourceKey: 'APP.ADMINISTRATION',
    permissionCode: 'VIEW',
    effect: 'ALLOW' as const,
  },
  {
    resourceType: 'ADMIN',
    resourceKey: 'ADMIN.API_MONITORING',
    permissionCode: 'VIEW',
    effect: 'ALLOW' as const,
  },
  {
    resourceType: 'ADMIN',
    resourceKey: 'ADMIN.AUDIT_VIEW',
    permissionCode: 'VIEW',
    effect: 'ALLOW' as const,
  },
];

async function mockAdminSession(page: Page, options: AdminSessionOptions = {}) {
  await mockAuthenticatedRuntime(page);
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
        identityPlane: 'TENANT',
        roles: options.roles ?? ['ADMIN'],
        resourceRoles: [],
      }),
    })
  );
  await page.route('**/api/auth/permissions', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: envelope(options.permissions ?? DEFAULT_ADMIN_PERMISSIONS),
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

test('tenant administrators govern fixed home zones without owning personal widgets', async ({
  page,
}) => {
  await mockAdminSession(page);
  await page.route('**/api/platform/v1/admin/home-experience', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: envelope({
        headline: null,
        subheadline: null,
        localizedContent: {},
        defaultLocale: 'en',
        backgroundPosition: 'RIGHT',
        overlayOpacity: 18,
        backgroundUrl: null,
        compositionPolicy: {
          schemaVersion: 1,
          personalCustomizationEnabled: true,
          governedZones: [
            {
              zoneKey: 'workspace-tools',
              placement: 'HERO',
              visible: true,
              size: 'full',
              sortOrder: 10,
            },
            {
              zoneKey: 'announcements',
              placement: 'CANVAS',
              visible: true,
              size: 'compact',
              sortOrder: 20,
            },
          ],
        },
        version: 8,
      }),
    })
  );

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/admin/experience/home-composition');
  await page.getByRole('tab', { name: 'Composition policy' }).click();

  await expect(
    page.getByRole('heading', { name: 'Home composition policy', level: 2 })
  ).toBeVisible();
  await expect(
    page.getByRole('switch', { name: 'Allow member home personalization' })
  ).toBeChecked();
  await expect(page.getByText('Company managed')).toHaveCount(1);
  await expect(page.getByText('Personal', { exact: true })).toHaveCount(2);
  await expect(page.getByText('Workspace tools', { exact: true })).toBeVisible();
  await expect(page.getByText('Command rail', { exact: true })).toBeVisible();

  const accessibility = await new AxeBuilder({ page }).include('main').analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);

  await page.setViewportSize({ width: 320, height: 720 });
  const mobileOverflow = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));
  expect(mobileOverflow.documentWidth).toBeLessThanOrEqual(mobileOverflow.viewport);
});

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
  await page.route('**/api/platform/v1/admin/audit-control/events**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: envelope({
        content: [
          {
            eventId: 'change-api-monitoring-1',
            occurredAt: '2026-08-10T11:16:00Z',
            ingestedAt: '2026-08-10T11:16:01Z',
            tenantId: 1,
            category: 'ADMIN_CHANGE',
            action: 'people.release.deployed',
            outcome: 'SUCCESS',
            severity: 'MEDIUM',
            riskScore: 38,
            actorType: 'SERVICE',
            actorId: 'release-orchestrator',
            actorRoles: ['SYSTEM'],
            sourceService: 'dwp-people-server',
            sourceModule: 'release-control',
            environment: 'test',
            targetType: 'SERVICE_RELEASE',
            targetId: 'people-2026.08.10.1',
            correlationId: 'release-people-1',
            beforeState: { version: '2026.08.09.2' },
            afterState: { version: '2026.08.10.1' },
            changedFields: ['version'],
            metadata: {},
            retentionClass: 'EXTENDED',
            recordHash: 'api-monitoring-change-e2e',
          },
        ],
        page: 0,
        size: 20,
        totalElements: 1,
        totalPages: 1,
      }),
    })
  );

  await page.goto('/admin/governance/api-monitoring');

  await expect(page.getByRole('heading', { name: 'API monitoring', level: 1 })).toBeVisible();
  await expect(page.getByText('1,284', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Change correlation' })).toBeVisible();
  await expect(page.getByRole('button', { name: /People release deployed/ })).toBeVisible();
  await expect(page.getByText('/api/people/v1/people', { exact: true }).first()).toBeVisible();
  if ((page.viewportSize()?.width ?? 0) < 900) {
    await page.getByRole('button').filter({ hasText: '/api/people/v1/people' }).click();
  } else {
    await page.getByRole('row').filter({ hasText: '/api/people/v1/people' }).last().click();
  }
  await expect(
    page.getByRole('heading', { name: 'Request trace', level: 2, exact: true })
  ).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('dwp-people-server', { exact: true })).toBeVisible();

  const accessibility = await new AxeBuilder({ page })
    .include('[data-testid="api-monitoring"]')
    .analyze();
  expect(accessibility.violations).toEqual([]);
});

test('tenant administrators configure and reset the personal home presentation', async ({
  page,
}) => {
  await mockShellSession(page, ['ADMIN'], { permissions: DEFAULT_ADMIN_PERMISSIONS });
  let homeExperience = {
    headline: null as string | null,
    subheadline: null as string | null,
    localizedContent: {
      fr: { headline: 'Bienvenue', subheadline: 'Commencez votre journée' },
    } as Record<string, { headline: string | null; subheadline: string | null }>,
    defaultLocale: 'ko',
    backgroundPosition: 'CENTER',
    backgroundFocalX: 23,
    backgroundFocalY: 37,
    mobileBackgroundFocalX: 78,
    mobileBackgroundFocalY: 64,
    contentAlignment: 'LEFT',
    overlayOpacity: 18,
    backgroundUrl: null as string | null,
    backgroundOriginalName: null as string | null,
    backgroundContentType: null as string | null,
    backgroundSizeBytes: null as number | null,
    backgroundWidth: null as number | null,
    backgroundHeight: null as number | null,
    launchpadConfiguration: { schemaVersion: 1, groups: [], placements: [] },
    compositionPolicy: {
      schemaVersion: 3,
      experienceVariant: 'FLOW_V1',
      personalCustomizationEnabled: true,
      governedZones: [],
    },
    version: 0,
  };
  let publishCount = 0;
  let releaseInitialHistoryRequest: (() => void) | undefined;
  const initialHistoryRequest = new Promise<void>((resolve) => {
    releaseInitialHistoryRequest = resolve;
  });

  await page.route('**/api/platform/v1/admin/home-experience**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && path.endsWith('/revisions')) {
      await initialHistoryRequest;
      await route.fulfill({
        contentType: 'application/json',
        body: envelope([
          {
            revisionId: 3,
            sourceVersion: 0,
            changeType: 'EXPERIENCE_PUBLISHED',
            headline: 'Prior home',
            backgroundOriginalName: null,
            backgroundWidth: null,
            backgroundHeight: null,
            localeCount: 3,
            affectedScopes: ['PRESENTATION', 'BACKGROUND_ASSET', 'LAUNCHPAD', 'COMPOSITION'],
            current: false,
            createdAt: '2026-08-27T00:00:00Z',
          },
        ]),
      });
      return;
    }
    if (request.method() === 'GET') {
      await route.fulfill({ contentType: 'application/json', body: envelope(homeExperience) });
      return;
    }
    if (request.method() === 'POST' && path.endsWith('/publish')) {
      publishCount += 1;
      expect(request.headers()['content-type']).toContain('multipart/form-data; boundary=');
      if (publishCount === 1) {
        homeExperience = {
          ...homeExperience,
          headline: 'One workspace, ready for action',
          subheadline: 'Your governed apps and priorities in one place.',
          localizedContent: {
            ...homeExperience.localizedContent,
            ko: {
              headline: 'One workspace, ready for action',
              subheadline: 'Your governed apps and priorities in one place.',
            },
          },
          contentAlignment: 'RIGHT',
          version: homeExperience.version + 1,
        };
      } else if (publishCount === 2) {
        homeExperience = {
          ...homeExperience,
          backgroundUrl: `/api/platform/v1/home-experience/background?v=${homeExperience.version + 1}`,
          backgroundOriginalName: 'agentic-workspace-hero-clean.png',
          backgroundContentType: 'image/png',
          backgroundSizeBytes: 1_492_965,
          backgroundWidth: 2176,
          backgroundHeight: 723,
          version: homeExperience.version + 1,
        };
      } else {
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
      }
      await route.fulfill({ contentType: 'application/json', body: envelope(homeExperience) });
      return;
    }
    if (path.endsWith('/background')) {
      homeExperience = {
        ...homeExperience,
        backgroundUrl: `/api/platform/v1/home-experience/background?v=${homeExperience.version + 1}`,
        backgroundOriginalName: 'agentic-workspace-hero-clean.png',
        backgroundContentType: 'image/png',
        backgroundSizeBytes: 1_492_965,
        backgroundWidth: 2176,
        backgroundHeight: 723,
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
      path: 'public/assets/home/default/agentic-workspace-hero-clean.png',
    })
  );

  await page.goto('/admin/experience/home-experience');
  await expect(page.getByRole('heading', { name: 'Home page settings', level: 1 })).toBeVisible();
  const workscapePreview = page.getByTestId('home-experience-preview');
  const previewFrame = page.getByTestId('home-experience-preview-frame');
  const expectPreviewGeometry = async (width: number, height: number, stageWidth: number) => {
    await expect(workscapePreview).toHaveCSS('max-width', `${stageWidth}px`);
    const geometry = await previewFrame.evaluate((frame) => {
      const workscape = frame.querySelector<HTMLElement>('[data-tenant-workscape-preview]');
      if (!workscape) throw new Error('Preview workscape is missing.');
      const frameBounds = frame.getBoundingClientRect();
      const workscapeBounds = workscape.getBoundingClientRect();
      return {
        frameWidth: frameBounds.width,
        frameHeight: frameBounds.height,
        workscapeWidth: workscapeBounds.width,
        workscapeHeight: workscapeBounds.height,
        contentWidth: workscape.clientWidth,
        contentHeight: workscape.clientHeight,
        scrollWidth: workscape.scrollWidth,
        scrollHeight: workscape.scrollHeight,
      };
    });
    expect(geometry.frameWidth / geometry.frameHeight).toBeCloseTo(width / height, 2);
    expect(geometry.frameWidth).toBeLessThanOrEqual(stageWidth);
    expect(Math.abs(geometry.workscapeWidth - geometry.frameWidth)).toBeLessThanOrEqual(1);
    expect(Math.abs(geometry.workscapeHeight - geometry.frameHeight)).toBeLessThanOrEqual(1);
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.contentWidth + 1);
    expect(geometry.scrollHeight).toBeLessThanOrEqual(geometry.contentHeight + 1);
  };
  await expect(workscapePreview).toHaveAttribute('data-preview-viewport', 'wide');
  await expectPreviewGeometry(1920, 312, 1320);
  await expect(workscapePreview.locator('[data-tenant-workscape-preview="wide"]')).toHaveAttribute(
    'data-tenant-background-focal-x',
    '23'
  );
  expect(
    await workscapePreview
      .locator('[data-tenant-workscape-preview="wide"]')
      .evaluate((workscape) => getComputedStyle(workscape, '::before').backgroundPosition)
  ).toBe('23% 37%');
  await expect(page.getByRole('button', { name: 'FR' })).toHaveCount(2);
  await page.getByRole('button', { name: 'History' }).click();
  await expect(page.getByText('Loading home publication history…')).toBeVisible();
  releaseInitialHistoryRequest?.();
  await page.getByRole('button', { name: 'Restore' }).click();
  await expect(
    page.getByRole('dialog', { name: 'Restore this complete home revision?' })
  ).toContainText('App dock');
  await expect(page.getByRole('dialog')).toContainText('Home composition policy');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('button', { name: 'Close home publication history' }).click();
  await page.getByRole('button', { name: 'Tablet 1024' }).click();
  await expect(workscapePreview).toHaveAttribute('data-preview-viewport', 'tablet');
  const tabletWorkscape = workscapePreview.locator('[data-tenant-workscape-preview="tablet"]');
  await expect(tabletWorkscape).toBeVisible();
  await expectPreviewGeometry(1024, 396, 820);
  await page.getByRole('button', { name: 'Mobile 390' }).click();
  await expect(workscapePreview).toHaveAttribute('data-preview-viewport', 'mobile');
  await expectPreviewGeometry(390, 340, 390);
  await expect(
    workscapePreview.locator('[data-tenant-workscape-preview="mobile"]')
  ).toHaveAttribute('data-tenant-background-focal-x', '78');
  await page.setViewportSize({ width: 320, height: 720 });
  await page.getByRole('button', { name: 'Wide 1920' }).click();
  const narrowWideWorkscape = workscapePreview.locator('[data-tenant-workscape-preview="wide"]');
  await expect(narrowWideWorkscape).toHaveAttribute('data-tenant-background-focal-x', '23');
  expect(
    await narrowWideWorkscape.evaluate(
      (workscape) => getComputedStyle(workscape, '::before').backgroundPosition
    )
  ).toBe('23% 37%');
  await page.getByRole('button', { name: 'Mobile 390' }).click();
  const narrowMobileWorkscape = workscapePreview.locator(
    '[data-tenant-workscape-preview="mobile"]'
  );
  await expect(narrowMobileWorkscape).toHaveAttribute('data-tenant-background-focal-x', '78');
  expect(
    await narrowMobileWorkscape.evaluate(
      (workscape) => getComputedStyle(workscape, '::before').backgroundPosition
    )
  ).toBe('78% 64%');
  for (const groupName of ['Preview viewport', 'Preview theme', 'Preview locale']) {
    const targetSizes = await page
      .getByRole('group', { name: groupName })
      .getByRole('button')
      .evaluateAll((buttons) =>
        buttons.map((button) => {
          const bounds = button.getBoundingClientRect();
          return { width: bounds.width, height: bounds.height };
        })
      );
    expect(targetSizes.every(({ width, height }) => width >= 44 && height >= 44)).toBe(true);
  }
  const mobilePreviewBounds = await workscapePreview.boundingBox();
  expect(mobilePreviewBounds).not.toBeNull();
  expect(mobilePreviewBounds!.x).toBeGreaterThanOrEqual(0);
  expect(mobilePreviewBounds!.x + mobilePreviewBounds!.width).toBeLessThanOrEqual(320);
  const mobileOverflow = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));
  expect(mobileOverflow.documentWidth).toBeLessThanOrEqual(mobileOverflow.viewport);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: 'Desktop 1440' }).click();
  await expect(workscapePreview.locator('[data-tenant-workscape-preview="desktop"]')).toBeVisible();
  await expectPreviewGeometry(1440, 326, 1120);
  await expect(workscapePreview.getByText('My apps')).toBeVisible();
  await expect(workscapePreview.getByText('The tenant-default app dock is empty.')).toBeVisible();
  await expect(page.getByText('Built-in DWP background', { exact: true })).toBeVisible();
  await page.getByLabel('Headline').fill('One workspace, ready for action');
  await page
    .getByLabel('Supporting message')
    .fill('Your governed apps and priorities in one place.');
  await expect(page.getByText('Unpublished changes', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Widget & layout settings' }).click();
  await expect(
    page.getByRole('alertdialog', { name: 'Keep your unpublished changes?' })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Keep editing' }).click();
  await page
    .getByRole('group', { name: 'Copy & app dock alignment' })
    .getByRole('button', { name: 'Right' })
    .click();
  await page.getByRole('button', { name: 'Publish complete change set' }).click();
  await expect(page.getByText('Home presentation published.', { exact: true })).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles({
    name: 'unsupported.gif',
    mimeType: 'image/gif',
    buffer: Buffer.from('not-an-image'),
  });
  await expect(
    page.getByRole('alert').filter({ hasText: 'Choose a PNG or JPEG file.' })
  ).toBeVisible();
  await page
    .locator('input[type="file"]')
    .setInputFiles('public/assets/home/default/agentic-workspace-hero-clean.png');
  await page.getByRole('button', { name: 'Publish complete change set' }).click();
  await expect(page.getByText('Home presentation published.', { exact: true })).toBeVisible();
  await expect(page.getByText('2176 x 723 / 1.4 MB')).toBeVisible();

  await page.getByRole('button', { name: 'Use built-in background' }).click();
  await page.getByRole('button', { name: 'Publish complete change set' }).click();
  await expect(page.getByText('Home presentation published.', { exact: true })).toBeVisible();
  await expect(page.getByText('Built-in DWP background', { exact: true })).toBeVisible();

  await expect(page).toHaveURL(/\/admin\/experience\/home-experience$/);
  await expect(page.getByRole('heading', { name: 'Home page settings', level: 1 })).toBeVisible();
  await expect(page.getByRole('alert')).toBeHidden({ timeout: 10_000 });
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);

  await page.getByLabel('Headline').fill('Draft that must not leak across navigation');
  await page.getByRole('button', { name: 'App dock settings' }).click();
  await expect(
    page.getByRole('alertdialog', { name: 'Keep your unpublished changes?' })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Discard and leave' }).click();
  await expect(page).toHaveURL(/\/admin\/experience\/home-apps$/);
});

test('brand and communications administrators manage co-branding and publish announcements', async ({
  page,
}) => {
  await mockAdminSession(page, {
    roles: ['ADMIN', 'COMMUNICATIONS_EDITOR', 'COMMUNICATIONS_PUBLISHER', 'WORKSPACE_MEMBER'],
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  let branding = {
    organizationName: null as string | null,
    accentColor: '#2457D6',
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
    if (request.method() === 'GET' && path.endsWith('/revisions')) {
      await route.fulfill({ contentType: 'application/json', body: envelope([]) });
      return;
    }
    if (request.method() === 'GET') {
      await route.fulfill({ contentType: 'application/json', body: envelope(branding) });
      return;
    }
    if (request.method() === 'PUT') {
      const body = request.postDataJSON() as {
        organizationName: string | null;
        accentColor: string;
      };
      branding = {
        ...branding,
        organizationName: body.organizationName,
        accentColor: body.accentColor,
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
  await page.getByRole('button', { name: 'Publish brand definition' }).click();
  await expect(page.getByText('Tenant brand definition published.', { exact: true })).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles('public/assets/brand/dwp-mark.svg');
  await page.getByRole('button', { name: 'Publish logo' }).click();
  await expect(page.getByText('Tenant logo uploaded.', { exact: true })).toBeVisible();
  await expect(page.getByText('dwp-mark.svg', { exact: true })).toBeVisible();

  await page.goto('/admin/experience/announcements');
  await expect(page.getByText('No announcements')).toBeVisible();
  await page.getByRole('button', { name: 'New content' }).first().click();
  await page.getByLabel('Title').fill('Planned maintenance');
  await page.getByLabel('Message').fill('The employee portal will be read-only from 22:00.');
  await page.getByRole('switch', { name: 'Pinned' }).check();
  await page.getByRole('button', { name: 'Create draft' }).click();
  await expect(page.getByText('Announcement draft created.', { exact: true })).toBeVisible();
  await expect(
    page
      .getByRole('row')
      .filter({ hasText: 'Planned maintenance' })
      .getByText('Draft', { exact: true })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Publish Planned maintenance' }).click();
  await expect(page.getByText('Announcement published.', { exact: true })).toBeVisible();
  await expect(
    page
      .getByRole('row')
      .filter({ hasText: 'Planned maintenance' })
      .getByText('Live', { exact: true })
  ).toBeVisible();
});

test('tenant administrators decide access reviews from immutable assignment evidence', async ({
  page,
}) => {
  await mockAdminSession(page);
  const campaignId = 'review-2026-q3';
  let campaign = {
    campaignId,
    name: 'Quarterly privileged access review',
    description: 'Certify privileged and inherited access before quarter close.',
    scopeType: 'TENANT' as const,
    scopeRef: null,
    reviewerStrategy: 'TENANT_ADMIN' as const,
    reviewerUserId: null,
    lifecycleState: 'ACTIVE' as const,
    dueAt: '2026-08-28T09:00:00Z',
    activatedAt: '2026-08-10T09:00:00Z',
    completedAt: null,
    totalItems: 1,
    pendingItems: 1,
    approvedItems: 0,
    revokedItems: 0,
    manualRemediationItems: 0,
    version: 1,
  };
  let reviewItem = {
    itemId: 'review-item-1',
    subjectUserId: 42,
    subjectDisplayName: 'Dana Kim',
    subjectEmail: 'dana.kim@example.com',
    roleId: 7,
    roleCode: 'HR_ADMIN',
    roleName: 'HR administrator',
    accessSourceType: 'GROUP' as const,
    accessSourceId: 44,
    sourceKey: 'ENG_MANAGERS',
    sourceDisplayName: 'Engineering managers',
    assignmentCreatedAt: '2026-03-12T09:00:00Z',
    subjectLastSignInAt: '2026-04-01T01:30:00Z',
    privileged: true,
    recommendation: 'REVIEW' as const,
    recommendationReason: 'PRIVILEGED_ROLE' as const,
    reviewerUserId: null,
    decision: 'PENDING' as 'PENDING' | 'REVOKE',
    decisionReason: null as string | null,
    decidedBy: null as number | null,
    decidedAt: null as string | null,
    remediationState: 'NOT_REQUIRED' as 'NOT_REQUIRED' | 'MANUAL_REQUIRED',
    version: 0,
  };
  let decisionPayload: Record<string, unknown> | null = null;

  await page.route('**/api/auth/admin/access/reviews**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && path === '/api/auth/admin/access/reviews') {
      await route.fulfill({ contentType: 'application/json', body: envelope([campaign]) });
      return;
    }
    if (request.method() === 'GET' && path === `/api/auth/admin/access/reviews/${campaignId}`) {
      await route.fulfill({
        contentType: 'application/json',
        body: envelope({ campaign, items: [reviewItem] }),
      });
      return;
    }
    if (
      request.method() === 'PUT' &&
      path === `/api/auth/admin/access/reviews/${campaignId}/items/${reviewItem.itemId}/decision`
    ) {
      decisionPayload = request.postDataJSON() as Record<string, unknown>;
      reviewItem = {
        ...reviewItem,
        decision: 'REVOKE',
        decisionReason: String(decisionPayload.reason),
        decidedBy: 1,
        decidedAt: '2026-08-12T03:00:00Z',
        remediationState: 'MANUAL_REQUIRED',
        version: 1,
      };
      campaign = {
        ...campaign,
        pendingItems: 0,
        revokedItems: 1,
        manualRemediationItems: 1,
        version: 2,
      };
      await route.fulfill({ contentType: 'application/json', body: envelope(reviewItem) });
      return;
    }
    await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });

  await page.goto('/admin/identity/access-reviews');
  await expect(page.getByRole('heading', { name: 'Access certification', level: 1 })).toBeVisible();
  await expect(
    page.getByText('Quarterly privileged access review', { exact: true }).first()
  ).toBeVisible();

  await page
    .getByRole('button', { name: /Review access for Dana Kim|Record decision/ })
    .first()
    .click();
  const dialog = page.getByRole('dialog', { name: 'Certify access' });
  await expect(dialog.getByText('Engineering managers', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Privileged role requires explicit review')).toBeVisible();
  await expect(dialog.getByText('Privileged', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Revoke' }).click();
  await dialog
    .getByLabel('Decision rationale')
    .fill('Remove inherited privileged access pending owner review.');
  await dialog.getByRole('button', { name: 'Record decision' }).click();

  await expect(page.getByText('Access decision recorded.', { exact: true })).toBeVisible();
  await expect(page.getByText('Revoke', { exact: true }).first()).toBeVisible();
  expect(decisionPayload).toEqual({
    decision: 'REVOKE',
    reason: 'Remove inherited privileged access pending owner review.',
    version: 0,
  });
});

test('identity administrators inspect SCIM readiness and provisioning evidence', async ({
  page,
}) => {
  await mockAdminSession(page, {
    roles: ['IDENTITY_ADMIN', 'WORKSPACE_MEMBER'],
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  const connector = {
    connectorId: 'scim-entra-1',
    connectorKey: 'entra-production',
    displayName: 'Microsoft Entra ID',
    tokenPrefix: 'dwp_scim_9f2a',
    allowedOperations: ['Users', 'Groups'],
    lifecycleState: 'ACTIVE' as const,
    lastUsedAt: '2026-08-12T01:45:00Z',
    health: 'ATTENTION' as const,
    events24h: 12,
    failedEvents24h: 2,
    lastSuccessAt: '2026-08-12T01:40:00Z',
    lastFailureAt: '2026-08-12T01:45:00Z',
    version: 3,
  };
  const events = [
    {
      eventId: 'scim-event-1',
      connectorId: connector.connectorId,
      connectorName: connector.displayName,
      operation: 'PATCH',
      resourceType: 'Group',
      resourceId: 'engineering-managers',
      outcome: 'FAILED' as const,
      correlationId: 'scim-correlation-1',
      summary: 'Group member reference could not be resolved',
      occurredAt: '2026-08-12T01:45:00Z',
    },
    {
      eventId: 'scim-event-2',
      connectorId: connector.connectorId,
      connectorName: connector.displayName,
      operation: 'POST',
      resourceType: 'User',
      resourceId: 'dana.kim@example.com',
      outcome: 'SUCCESS' as const,
      correlationId: 'scim-correlation-2',
      summary: 'User provisioned',
      occurredAt: '2026-08-12T01:40:00Z',
    },
  ];

  await page.route('**/api/auth/admin/provisioning/scim/connectors**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === 'GET' && path.endsWith('/events')) {
      await route.fulfill({ contentType: 'application/json', body: envelope(events) });
      return;
    }
    if (route.request().method() === 'GET') {
      await route.fulfill({ contentType: 'application/json', body: envelope([connector]) });
      return;
    }
    await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });

  await page.goto('/admin/identity/provisioning');
  await expect(
    page.getByRole('heading', { name: 'Identity provisioning', level: 1 })
  ).toBeVisible();
  await expect(page.getByText('Provisioning activation path', { exact: true })).toBeVisible();
  await expect(page.getByText('Microsoft Entra ID', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('2 failed', { exact: true })).toBeVisible();
  await expect(page.getByText('engineering-managers', { exact: true })).toBeVisible();

  await page.getByRole('row').filter({ hasText: 'entra-production' }).click();
  await expect(page.getByRole('heading', { name: 'Microsoft Entra ID', level: 2 })).toBeVisible();
  await expect(page.getByText('Activation readiness', { exact: true })).toBeVisible();
  await expect(page.getByText('Supported attribute contract', { exact: true })).toBeVisible();
  await expect(page.getByText('Recent connector evidence', { exact: true })).toBeVisible();
  await expect(page.getByText('Group PATCH', { exact: true })).toBeVisible();
  await expect(page.getByText('Group member reference could not be resolved')).toBeVisible();
  await expect(page.locator('input[value$="/api/auth/scim/v2"]')).toBeVisible();
});

test('delegated administrators manage identity, standards, registry, and audit', async ({
  page,
}, testInfo) => {
  await mockAdminSession(page, {
    roles: ['ADMIN', 'IDENTITY_ADMIN', 'APP_CATALOG_ADMIN', 'AUDIT_ADMIN', 'WORKSPACE_MEMBER'],
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  let detail: Detail | null = null;
  let registryEntry: RegistryEntry | null = null;
  const auditEvents: unknown[] = [];
  const identityAuditEvents: unknown[] = [];
  const identityRoles = [
    {
      code: 'WORKSPACE_MEMBER',
      name: 'Workspace member',
      description: 'Default workspace access',
      roleFamily: 'WORKSPACE',
      assignmentClass: 'BASELINE',
      privileged: false,
      assignmentMode: 'DIRECT',
      conflictsWith: [],
      status: 'ACTIVE',
    },
    {
      code: 'HR_ADMIN',
      name: 'HR administrator',
      description: 'Workforce administration',
      roleFamily: 'PEOPLE',
      assignmentClass: 'DELEGATED',
      privileged: true,
      assignmentMode: 'DIRECT',
      conflictsWith: ['AUDITOR'],
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
      effectiveRoles: ['ADMIN'],
      effectiveAccess: [
        {
          roleId: 1,
          roleCode: 'ADMIN',
          roleName: 'Tenant administrator',
          privileged: true,
          sourceType: 'DIRECT',
          sourceId: 1,
          sourceKey: 'ADMIN',
          sourceName: 'Direct assignment',
          assignmentType: 'DIRECT',
          scopeType: 'TENANT',
          scopeRef: null,
          validFrom: null,
          validTo: null,
          assignedAt: '2026-01-02T09:00:00Z',
        },
      ],
      lastSignInAt: '2026-08-08T08:30:00Z',
      activeSessionCount: 1,
      roleManagement: { allowed: false, reason: 'SELF' },
      accessRevision: 0,
      version: 0,
    },
    {
      userId: 2,
      displayName: 'Operations Lead',
      email: 'operations@dwp.local',
      status: 'ACTIVE',
      mfaEnabled: false,
      roles: ['WORKSPACE_MEMBER'],
      effectiveRoles: ['WORKSPACE_MEMBER', 'TEAM_LEAD'],
      effectiveAccess: [
        {
          roleId: 2,
          roleCode: 'WORKSPACE_MEMBER',
          roleName: 'Workspace member',
          privileged: false,
          sourceType: 'DIRECT',
          sourceId: 2,
          sourceKey: 'WORKSPACE_MEMBER',
          sourceName: 'Direct assignment',
          assignmentType: 'DIRECT',
          scopeType: 'TENANT',
          scopeRef: null,
          validFrom: null,
          validTo: null,
          assignedAt: '2026-02-01T09:00:00Z',
        },
        {
          roleId: 3,
          roleCode: 'TEAM_LEAD',
          roleName: 'Team lead',
          privileged: false,
          sourceType: 'GROUP',
          sourceId: 44,
          sourceKey: 'ENG_MANAGERS',
          sourceName: 'Engineering managers',
          assignmentType: 'GROUP',
          scopeType: 'ORGANIZATION_UNIT',
          scopeRef: 'engineering',
          validFrom: null,
          validTo: null,
          assignedAt: '2026-03-12T09:00:00Z',
        },
      ],
      lastSignInAt: '2026-08-07T23:40:00Z',
      activeSessionCount: 2,
      roleManagement: { allowed: true, reason: 'ALLOWED' },
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
        effectiveRoles: [...new Set([...body.roleCodes, 'TEAM_LEAD'])].sort(),
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
    if (request.method() === 'GET' && suffix === '/WORK_PRIORITY/audit-events') {
      const content = auditEvents.filter(
        (event) =>
          (event.targetType === 'REFERENCE_SET' && event.targetId === 'WORK_PRIORITY') ||
          (event.targetType === 'REFERENCE_ITEM' && event.targetId.startsWith('WORK_PRIORITY/'))
      );
      await route.fulfill({
        contentType: 'application/json',
        body: envelope({
          content,
          page: 0,
          size: 100,
          totalElements: content.length,
          totalPages: content.length ? 1 : 0,
        }),
      });
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

  await page.goto('/admin/identity/access');
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
    await expect(
      adminNavigation.getByRole('button', { name: 'Identity & access' })
    ).toHaveAttribute('aria-expanded', 'true');
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
  if (testInfo.project.name === 'mobile') {
    await page.getByRole('button', { name: 'Review effective access' }).last().click();
  } else {
    await page.getByRole('row').filter({ hasText: 'Operations Lead' }).click();
  }
  const accessInspector = page.getByRole('complementary', { name: 'Operations Lead' });
  await expect(
    accessInspector.getByRole('heading', { name: 'Operations Lead', level: 2 })
  ).toBeVisible();
  await expect(accessInspector).toContainText('Engineering managers');
  await expect(accessInspector).toContainText('Group');
  await expect(accessInspector).toContainText('2 access assignments');
  await page.getByRole('button', { name: 'Close access details' }).click();
  await page.getByRole('button', { name: 'Edit roles for Operations Lead' }).click();
  const accessDialog = page.getByRole('dialog', { name: 'Edit access' });
  await accessDialog.getByRole('checkbox', { name: /HR administrator/ }).check();
  await accessDialog
    .getByLabel('Change justification')
    .fill('Grant workforce administration duties.');
  await accessDialog.getByRole('button', { name: 'Save access' }).click();
  await expect(tenantUsers).toContainText('HR_ADMIN');

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

  await page.getByRole('button', { name: 'Activate', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Activate reference set?' })
    .getByRole('button', {
      name: 'Activate',
    })
    .click();
  await expect(page.getByText('Active').first()).toBeVisible();
  await page.getByRole('tab', { name: 'Change activity' }).click();
  await expect(page.getByText('Reference set activated', { exact: true })).toBeVisible();
  await expect(page.getByText('Reference value created', { exact: true })).toBeVisible();

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
  await expect(auditList).toContainText('Identity user roles replaced');
  await expect(auditList).toContainText('Reference set activated');
  await expect(auditList).toContainText('Registry entry activated');

  await expect(page.getByRole('alert')).toBeHidden({ timeout: 10_000 });
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});
