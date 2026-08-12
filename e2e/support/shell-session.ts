import {
  DEFAULT_APP_PERMISSIONS,
  WORKSPACE_ACTIVITY_FIXTURE,
  WORKSPACE_APPS_FIXTURE,
  WORKSPACE_QUEUE_FIXTURE,
} from './runtime-access';

import type { Page, Route } from '@playwright/test';

type Appearance = {
  mode: 'system' | 'light' | 'dark';
  density: 'compact' | 'standard' | 'comfortable';
  highContrast: boolean;
  reduceMotion: boolean;
};

type ShellSessionOptions = {
  locale?: 'en' | 'ko';
  displayName?: string;
  jobTitle?: string;
  appearance?: Appearance;
  permissions?: Array<{
    resourceType: string;
    resourceKey: string;
    permissionCode: string;
    effect: 'ALLOW' | 'DENY';
  }>;
};

export const FULL_PRODUCT_PERMISSIONS = [
  ...DEFAULT_APP_PERMISSIONS,
  {
    resourceType: 'APP',
    resourceKey: 'APP.WORKFORCE_MANAGEMENT',
    permissionCode: 'VIEW',
    effect: 'ALLOW' as const,
  },
  ...[
    ['ADMIN.API_MONITORING', 'VIEW'],
    ['ADMIN.AUDIT_VIEW', 'VIEW'],
    ['ADMIN.AUDIT_INVESTIGATE', 'UPDATE'],
    ['ADMIN.AUDIT_CONFIGURE', 'MANAGE'],
    ['ADMIN.AUDIT_EXPORT', 'EXPORT'],
    ['ADMIN.PRODUCTIVITY_CONNECTOR', 'MANAGE'],
  ].map(([resourceKey, permissionCode]) => ({
    resourceType: 'ADMIN',
    resourceKey,
    permissionCode,
    effect: 'ALLOW' as const,
  })),
];

export const NAVIGATION_TREE_FIXTURE = [
  {
    navigationItemId: 1,
    navigationKey: 'workspace',
    itemType: 'GROUP',
    parentNavigationItemId: null,
    registryEntryKey: null,
    route: null,
    iconKey: 'layout-grid',
    requiredResourceKey: null,
    requiredPermissionCode: 'VIEW',
    sortOrder: 0,
    lifecycleState: 'ACTIVE',
    version: 1,
    labels: [
      { locale: 'ko', label: '워크스페이스', description: '개인 업무 공간' },
      { locale: 'en', label: 'Workspace', description: 'Personal work area' },
    ],
    children: [
      {
        navigationItemId: 2,
        navigationKey: 'work',
        itemType: 'APP',
        parentNavigationItemId: 1,
        registryEntryKey: 'DWP_WORK',
        route: '/work',
        iconKey: 'briefcase',
        requiredResourceKey: 'APP.WORK',
        requiredPermissionCode: 'VIEW',
        sortOrder: 0,
        lifecycleState: 'ACTIVE',
        version: 1,
        labels: [
          { locale: 'ko', label: '업무', description: '우선 업무와 승인' },
          { locale: 'en', label: 'Work', description: 'Priorities and approvals' },
        ],
        children: [],
      },
    ],
  },
] as const;

export const NAVIGATION_VALIDATION_FIXTURE = {
  valid: true,
  errorCount: 0,
  warningCount: 0,
  issues: [],
  checkedAt: '2026-08-11T00:15:00Z',
};

export const NAVIGATION_REVISION_FIXTURE = {
  navigationRevisionId: '61000000-0000-0000-0000-000000000001',
  revisionNumber: 1,
  lifecycleState: 'PUBLISHED',
  baselineRevisionId: null,
  baselineTreeHash: 'navigation-baseline-fixture',
  tree: NAVIGATION_TREE_FIXTURE,
  validation: NAVIGATION_VALIDATION_FIXTURE,
  diff: { added: 0, removed: 0, changed: 0, reordered: 0, lifecycleChanged: 0 },
  changeSummary: 'Initial governed navigation baseline',
  version: 1,
  createdAt: '2026-08-10T00:00:00Z',
  createdBy: 1,
  updatedAt: '2026-08-11T00:15:00Z',
  publishedAt: '2026-08-11T00:15:00Z',
  publishedBy: 1,
};

export const CATALOG_ENTITIES_FIXTURE = [
  {
    ref: 'APP:DWP_WORK',
    kind: 'APP',
    key: 'DWP_WORK',
    name: 'DWP Work',
    description: 'Governed priorities and approvals workspace.',
    ownerRef: 'SERVICE:dwp-platform-server',
    lifecycleState: 'ACTIVE',
    riskTier: 'MEDIUM',
    scope: 'TENANT',
    revision: 1,
    metadata: {},
  },
  {
    ref: 'SERVICE:dwp-platform-server',
    kind: 'SERVICE',
    key: 'dwp-platform-server',
    name: 'DWP Platform Service',
    description: 'Tenant experience and workspace control plane.',
    ownerRef: 'TEAM:platform',
    lifecycleState: 'ACTIVE',
    riskTier: 'HIGH',
    scope: 'GLOBAL_PRODUCT',
    revision: 1,
    metadata: {},
  },
] as const;

export const CATALOG_RELATION_FIXTURE = {
  relationId: null,
  sourceRef: 'SERVICE:dwp-platform-server',
  targetRef: 'APP:DWP_WORK',
  relationType: 'PRODUCES',
  relationOrigin: 'DISCOVERED',
  criticality: 'OPERATIONAL',
  evidenceRef: 'workspace registry',
  metadata: {},
  lifecycleState: 'ACTIVE',
  version: 0,
} as const;

const PROVIDER_TENANT_FIXTURE = {
  tenantId: 'tenant-skax',
  organizationId: 'organization-skax',
  organizationKey: 'SKAX',
  organizationName: 'SKAX',
  tenantKey: 'skax-production',
  displayName: 'SKAX Production',
  environmentKey: 'production',
  serviceTier: 'ENTERPRISE',
  dataRegion: 'ap-northeast-2',
  isolationModel: 'BRIDGE',
  defaultLocale: 'ko-KR',
  timeZone: 'Asia/Seoul',
  lifecycleState: 'ACTIVE',
  onboardingState: 'COMPLETED',
  authTenantId: 1,
  schemaVersion: 31,
  configuration: '{}',
  version: 4,
  createdAt: '2026-01-10T00:00:00Z',
  updatedAt: '2026-08-11T00:00:00Z',
  subscription: {
    subscriptionId: 'subscription-skax',
    planKey: 'enterprise',
    planVersion: 3,
    planName: 'Enterprise',
    lifecycleState: 'ACTIVE',
    startsAt: '2026-01-01T00:00:00Z',
    endsAt: '2027-01-01T00:00:00Z',
    contractReference: 'SKAX-2026-001',
    version: 2,
  },
  entitlements: [
    {
      entitlementId: 1,
      entitlementKey: 'workforce-management',
      name: 'Workforce management',
      entitlementType: 'APPLICATION',
      lifecycleState: 'ACTIVE',
      configuration: '{}',
      version: 1,
    },
  ],
  services: [
    {
      serviceInstanceId: 'service-skax-identity',
      serviceKey: 'identity',
      serviceName: 'Identity service',
      deploymentCell: 'seoul-1',
      dataRegion: 'ap-northeast-2',
      lifecycleState: 'READY',
      externalResourceId: 'identity-skax',
      appliedSchemaVersion: 31,
      healthSnapshot: '{"state":"HEALTHY"}',
      lastReconciledAt: '2026-08-11T00:00:00Z',
      version: 3,
    },
  ],
  domains: [
    {
      domainId: 'domain-skax',
      domainName: 'sk.com',
      domainType: 'CORPORATE',
      verificationMethod: 'DNS_TXT',
      verificationState: 'VERIFIED',
      primaryDomain: true,
      verifiedAt: '2026-01-10T00:00:00Z',
      lastCheckedAt: '2026-08-11T00:00:00Z',
      version: 1,
    },
  ],
  administrators: [
    {
      tenantAdministratorId: 'administrator-skax',
      authUserId: 1,
      email: 'hyunwoo.park@sk.com',
      displayName: 'Park Hyunwoo',
      roleCode: 'TENANT_ADMIN',
      lifecycleState: 'ACTIVE',
      primaryAdministrator: true,
      activatedAt: '2026-01-10T00:00:00Z',
      version: 1,
    },
  ],
};

const PROVIDER_SECOND_TENANT_FIXTURE = {
  ...PROVIDER_TENANT_FIXTURE,
  tenantId: 'tenant-acme',
  organizationId: 'organization-acme',
  organizationKey: 'ACME',
  organizationName: 'Acme Group',
  tenantKey: 'acme-production',
  displayName: 'Acme Production',
  serviceTier: 'REGULATED',
  dataRegion: 'us-east-1',
  isolationModel: 'SILO',
  authTenantId: 2,
  subscription: {
    ...PROVIDER_TENANT_FIXTURE.subscription,
    subscriptionId: 'subscription-acme',
    planKey: 'regulated',
    planName: 'Regulated enterprise',
    contractReference: 'ACME-2026-001',
  },
  services: PROVIDER_TENANT_FIXTURE.services.map((service) => ({
    ...service,
    serviceInstanceId: 'service-acme-identity',
    deploymentCell: 'virginia-1',
    dataRegion: 'us-east-1',
    lifecycleState: 'DEGRADED',
    externalResourceId: 'identity-acme',
  })),
  domains: [],
  administrators: [],
};

function workforceOverviewChartFixture(asOf: string) {
  const current = asOf >= '2026-08-01';
  const openPositionCount = current ? 12 : 9;
  const organizations = [
    {
      organizationId: 'org-skax',
      organizationKey: 'SKAX',
      name: 'SKAX',
      organizationType: 'COMPANY',
      organizationTypeName: 'Company',
      parentOrganizationId: null,
      directHeadcount: 0,
      totalHeadcount: current ? 186 : 178,
      managerCount: current ? 31 : 29,
      openPositionCount,
      childOrganizationCount: 4,
      directMemberIds: [],
      layerDepth: 0,
      averageManagerSpan: 5.7,
      contingentHeadcount: current ? 24 : 22,
      healthStatus: 'HEALTHY',
      healthSignals: [],
    },
    {
      organizationId: 'org-ai-platform',
      organizationKey: 'AI_PLATFORM',
      name: 'AI Platform',
      organizationType: 'DIVISION',
      organizationTypeName: 'Division',
      parentOrganizationId: 'org-skax',
      directHeadcount: 52,
      totalHeadcount: 52,
      managerCount: 4,
      openPositionCount: 5,
      childOrganizationCount: 1,
      directMemberIds: [],
      layerDepth: 1,
      averageManagerSpan: 13,
      contingentHeadcount: 9,
      healthStatus: 'CRITICAL',
      healthSignals: ['WIDE_MANAGER_SPAN', 'HIGH_VACANCY_RATIO'],
    },
    {
      organizationId: 'org-digital-workplace',
      organizationKey: 'DIGITAL_WORKPLACE',
      name: 'Digital Workplace',
      organizationType: 'DIVISION',
      organizationTypeName: 'Division',
      parentOrganizationId: 'org-skax',
      directHeadcount: 48,
      totalHeadcount: 48,
      managerCount: 9,
      openPositionCount: 3,
      childOrganizationCount: 0,
      directMemberIds: [],
      layerDepth: 1,
      averageManagerSpan: 3.2,
      contingentHeadcount: 7,
      healthStatus: 'ATTENTION',
      healthSignals: ['NARROW_MANAGER_SPAN'],
    },
    {
      organizationId: 'org-cloud-platform',
      organizationKey: 'CLOUD_PLATFORM',
      name: 'Cloud Platform',
      organizationType: 'DIVISION',
      organizationTypeName: 'Division',
      parentOrganizationId: 'org-skax',
      directHeadcount: 38,
      totalHeadcount: 38,
      managerCount: 8,
      openPositionCount: 2,
      childOrganizationCount: 0,
      directMemberIds: [],
      layerDepth: 1,
      averageManagerSpan: 5.4,
      contingentHeadcount: 4,
      healthStatus: 'HEALTHY',
      healthSignals: [],
    },
    {
      organizationId: 'org-corporate-services',
      organizationKey: 'CORPORATE_SERVICES',
      name: 'Corporate Services',
      organizationType: 'DIVISION',
      organizationTypeName: 'Division',
      parentOrganizationId: 'org-skax',
      directHeadcount: 26,
      totalHeadcount: 26,
      managerCount: 6,
      openPositionCount: 1,
      childOrganizationCount: 0,
      directMemberIds: [],
      layerDepth: 1,
      averageManagerSpan: 4.3,
      contingentHeadcount: 2,
      healthStatus: 'HEALTHY',
      healthSignals: [],
    },
    {
      organizationId: 'org-data-governance',
      organizationKey: 'DATA_GOVERNANCE',
      name: 'Data Governance',
      organizationType: 'TEAM',
      organizationTypeName: 'Team',
      parentOrganizationId: 'org-ai-platform',
      directHeadcount: 22,
      totalHeadcount: 22,
      managerCount: 2,
      openPositionCount: 1,
      childOrganizationCount: 0,
      directMemberIds: [],
      layerDepth: 2,
      averageManagerSpan: 11,
      contingentHeadcount: 2,
      healthStatus: 'ATTENTION',
      healthSignals: ['WIDE_MANAGER_SPAN'],
    },
  ];
  const positions = Array.from({ length: 30 }, (_value, index) => ({
    positionId: `position-${index + 1}`,
    positionKey: `POS-${String(index + 1).padStart(3, '0')}`,
    title: index < openPositionCount ? `Open role ${index + 1}` : `Filled role ${index + 1}`,
    organizationId: index < 10 ? 'org-ai-platform' : 'org-digital-workplace',
    reportsToPositionId: index === 0 ? null : 'position-1',
    status: index < openPositionCount ? 'OPEN' : 'FILLED',
    positionType: 'REGULAR',
    criticality: index === 0 ? 'CRITICAL' : index < 3 ? 'HIGH' : 'STANDARD',
    budgetedFte: 1,
    annualCostAmount: 120000000,
    costCurrency: 'KRW',
    incumbentPersonIds: index < openPositionCount ? [] : [`person-${index + 1}`],
    subordinatePositionCount: index === 0 ? 8 : 0,
  }));
  const openPositions = positions.slice(0, openPositionCount).map((position) => ({
    positionId: position.positionId,
    positionKey: position.positionKey,
    title: position.title,
    organizationId: position.organizationId,
    jobProfileName: 'Digital product professional',
    locationName: 'Seoul',
    availabilityDate: asOf,
    budgetedFte: 1,
    annualCostAmount: position.annualCostAmount,
    costCurrency: 'KRW',
    criticality: position.criticality,
  }));

  return {
    asOf,
    company: { organizationId: 'org-skax', organizationKey: 'SKAX', name: 'SKAX' },
    scenario: null,
    metrics: {
      headcount: current ? 186 : 178,
      activeHeadcount: current ? 178 : 171,
      onLeaveHeadcount: current ? 8 : 7,
      contingentHeadcount: current ? 24 : 22,
      organizationCount: organizations.length,
      managerCount: current ? 31 : 29,
      openPositionCount,
      locationCount: 4,
      plannedFte: current ? 192.5 : 183,
      workforceCostAmount: current ? 21800000000 : 20500000000,
      costCurrency: 'KRW',
    },
    analysis: {
      healthScore: current ? 84 : 80,
      dataQualityScore: current ? 92 : 88,
      averageManagerSpan: current ? 5.7 : 5.4,
      maximumLayers: 3,
      managerRatioPercent: current ? 17.4 : 16.9,
      contingentRatioPercent: current ? 12.9 : 12.4,
      narrowSpanManagerCount: 2,
      wideSpanManagerCount: 3,
      singleReportManagerCount: 1,
      missingManagerCount: current ? 1 : 2,
      missingGradeCount: current ? 2 : 3,
      orphanOrganizationCount: 0,
      policy: {
        minimumManagerSpan: 3,
        maximumManagerSpan: 12,
        maximumLayers: 8,
        maximumContingentPercent: 20,
        maximumVacancyPercent: 15,
      },
      signals: [
        {
          code: 'WIDE_MANAGER_SPAN',
          severity: 'CRITICAL',
          count: 3,
          organizationId: 'org-ai-platform',
        },
        {
          code: 'HIGH_VACANCY_RATIO',
          severity: 'WARNING',
          count: openPositionCount,
          organizationId: 'org-ai-platform',
        },
        {
          code: 'NARROW_MANAGER_SPAN',
          severity: 'WARNING',
          count: 2,
          organizationId: 'org-digital-workplace',
        },
      ],
    },
    organizations,
    people: [],
    positions,
    relationships: organizations
      .filter((organization) => organization.parentOrganizationId)
      .map((organization) => ({
        childOrganizationId: organization.organizationId,
        parentOrganizationId: organization.parentOrganizationId,
        relationshipType: 'SUPERVISORY',
        primaryRelationship: true,
      })),
    openPositions,
  };
}

export function fulfillSuccess(route: Route, data: unknown) {
  return route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data }),
  });
}

export async function mockShellSession(
  page: Page,
  roles: string[],
  options: ShellSessionOptions = {}
) {
  const provider = roles.some((role) => role.startsWith('PROVIDER_'));
  const locale = options.locale ?? 'en';
  const appearance = options.appearance ?? {
    mode: 'system',
    density: 'standard',
    highContrast: false,
    reduceMotion: false,
  };
  const defaultPersonalPreference = {
    schemaVersion: 2 as const,
    customized: true,
    preferences: {
      appearance: { mode: appearance.mode, density: appearance.density },
      accessibility: {
        highContrast: appearance.highContrast,
        reduceMotion: appearance.reduceMotion,
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
    version: 1,
    updatedAt: '2026-08-11T00:00:00Z' as string | null,
  };
  let personalPreference = structuredClone(defaultPersonalPreference);

  await page.route('**/api/**', (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (!path.startsWith('/api/')) return route.continue();

    if (path === '/api/auth/me') {
      return fulfillSuccess(route, {
        userId: 1,
        displayName: options.displayName ?? (provider ? 'Provider Admin' : 'Tenant Admin'),
        jobTitle:
          options.jobTitle ?? (provider ? 'Platform operations lead' : 'Tenant administrator'),
        email: provider ? 'provider.admin@dwp.local' : 'tenant.admin@dwp.local',
        tenantId: 1,
        tenantCode: 'default',
        tenantName: 'SKAX',
        preferredLocale: locale,
        tenantDefaultLocale: locale,
        roles,
      });
    }
    if (path === '/api/auth/permissions') {
      return fulfillSuccess(
        route,
        provider ? [] : (options.permissions ?? DEFAULT_APP_PERMISSIONS)
      );
    }
    if (path === '/api/auth/csrf') {
      return fulfillSuccess(route, { token: 'visual-csrf-token', headerName: 'X-XSRF-TOKEN' });
    }
    if (path === '/api/auth/session/refresh') {
      return fulfillSuccess(route, {
        rotated: true,
        idleExpiresAt: '2026-08-11T01:00:00Z',
        expiresAt: '2026-08-11T08:00:00Z',
      });
    }
    if (path === '/api/auth/policy') {
      return fulfillSuccess(route, {
        tenantId: 1,
        defaultLoginType: 'LOCAL',
        allowedLoginTypes: ['LOCAL'],
        localLoginEnabled: true,
        ssoLoginEnabled: false,
        ssoProviderKey: null,
        requireMfa: true,
      });
    }
    if (path.startsWith('/api/platform/v1/personal-preferences')) {
      const request = route.request();
      if (request.method() === 'GET') return fulfillSuccess(route, personalPreference);

      const body = request.postDataJSON() as {
        patch?: {
          appearance?: Partial<typeof personalPreference.preferences.appearance>;
          accessibility?: Partial<typeof personalPreference.preferences.accessibility>;
          regional?: Partial<typeof personalPreference.preferences.regional>;
        };
        version: number;
      };
      if (body.version !== personalPreference.version) {
        return route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'ERROR', errorCode: 'OPTIMISTIC_LOCK_FAILED' }),
        });
      }

      if (path.endsWith('/reset')) {
        personalPreference = {
          ...structuredClone(defaultPersonalPreference),
          customized: false,
          version: personalPreference.version + 1,
          updatedAt: '2026-08-11T00:10:00Z',
        };
      } else {
        personalPreference = {
          ...personalPreference,
          customized: true,
          preferences: {
            appearance: {
              ...personalPreference.preferences.appearance,
              ...body.patch?.appearance,
            },
            accessibility: {
              ...personalPreference.preferences.accessibility,
              ...body.patch?.accessibility,
            },
            regional: {
              ...personalPreference.preferences.regional,
              ...body.patch?.regional,
            },
          },
          version: personalPreference.version + 1,
          updatedAt: '2026-08-11T00:10:00Z',
        };
      }
      return fulfillSuccess(route, personalPreference);
    }
    if (path === '/api/platform/v1/workspace/work-items') {
      return fulfillSuccess(route, WORKSPACE_QUEUE_FIXTURE);
    }
    if (path === '/api/platform/v1/workspace/activity') {
      return fulfillSuccess(route, WORKSPACE_ACTIVITY_FIXTURE);
    }
    if (path === '/api/platform/v1/workspace/apps') {
      return fulfillSuccess(route, WORKSPACE_APPS_FIXTURE);
    }
    if (path === '/api/platform/v1/workspace/saved-views') {
      return fulfillSuccess(route, []);
    }
    if (path.startsWith('/api/platform/v1/catalog/code-sets/')) {
      const codeSetKey = decodeURIComponent(path.split('/').pop() ?? '');
      return fulfillSuccess(route, { codeSetKey, schemaVersion: 1, values: [] });
    }
    if (
      path === '/api/platform/v1/admin/tenant-branding/revisions' ||
      path === '/api/platform/v1/admin/home-experience/revisions'
    ) {
      return fulfillSuccess(route, []);
    }
    if (
      path.startsWith('/api/platform/v1/tenant-branding') ||
      path.startsWith('/api/platform/v1/admin/tenant-branding')
    ) {
      return fulfillSuccess(route, {
        organizationName: 'SKAX',
        accentColor: '#2457D6',
        logoUrl: null,
        version: 0,
      });
    }
    if (path === '/api/platform/v1/home-experience') {
      return fulfillSuccess(route, {
        headline: null,
        subheadline: null,
        localizedContent: {},
        defaultLocale: 'ko',
        backgroundPosition: 'CENTER',
        overlayOpacity: 18,
        backgroundUrl: null,
        version: 0,
      });
    }
    if (path === '/api/platform/v1/home-preferences') {
      return fulfillSuccess(route, {
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
      });
    }
    if (path === '/api/platform/v1/announcements') {
      return fulfillSuccess(route, []);
    }
    if (path === '/api/people/v1/people') {
      return fulfillSuccess(route, {
        items: [],
        nextCursor: null,
        size: 100,
        hasMore: false,
        asOf: '2026-08-11',
      });
    }
    if (path === '/api/people/v1/workforce/people') {
      return fulfillSuccess(route, {
        items: [],
        nextCursor: null,
        size: 100,
        hasMore: false,
        asOf: '2026-08-11',
      });
    }
    if (path === '/api/people/v1/org-chart') {
      return fulfillSuccess(route, {
        asOf: '2026-08-11',
        company: {
          organizationId: 'org-skax',
          organizationKey: 'SKAX',
          name: 'SKAX',
        },
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
        analysis: {
          healthScore: 100,
          dataQualityScore: 100,
          averageManagerSpan: 0,
          maximumLayers: 1,
          managerRatioPercent: 0,
          contingentRatioPercent: 0,
          narrowSpanManagerCount: 0,
          wideSpanManagerCount: 0,
          singleReportManagerCount: 0,
          missingManagerCount: 0,
          missingGradeCount: 0,
          orphanOrganizationCount: 0,
          policy: {
            minimumManagerSpan: 3,
            maximumManagerSpan: 12,
            maximumLayers: 8,
            maximumContingentPercent: 20,
            maximumVacancyPercent: 15,
          },
          signals: [],
        },
        organizations: [],
        people: [],
        positions: [],
        relationships: [],
        openPositions: [],
      });
    }
    if (path === '/api/people/v1/workforce/organization/chart') {
      if (url.searchParams.get('depth') === '12') {
        return fulfillSuccess(
          route,
          workforceOverviewChartFixture(url.searchParams.get('asOf') ?? '2026-08-11')
        );
      }
      return fulfillSuccess(route, {
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
        analysis: {
          healthScore: 100,
          dataQualityScore: 100,
          averageManagerSpan: 0,
          maximumLayers: 1,
          managerRatioPercent: 0,
          contingentRatioPercent: 0,
          narrowSpanManagerCount: 0,
          wideSpanManagerCount: 0,
          singleReportManagerCount: 0,
          missingManagerCount: 0,
          missingGradeCount: 0,
          orphanOrganizationCount: 0,
          policy: {
            minimumManagerSpan: 3,
            maximumManagerSpan: 12,
            maximumLayers: 8,
            maximumContingentPercent: 20,
            maximumVacancyPercent: 15,
          },
          signals: [],
        },
        organizations: [],
        people: [],
        positions: [],
        relationships: [],
        openPositions: [],
      });
    }
    if (path === '/api/people/v1/workforce/organization/intelligence') {
      return fulfillSuccess(route, {
        asOf: '2026-08-11',
        healthScore: 100,
        dataQualityScore: 100,
        averageManagerSpan: 0,
        maximumLayers: 1,
        managerRatioPercent: 0,
        contingentRatioPercent: 0,
        narrowSpanManagerCount: 0,
        wideSpanManagerCount: 0,
        singleReportManagerCount: 0,
        missingManagerCount: 0,
        missingGradeCount: 0,
        orphanOrganizationCount: 0,
        policy: {
          minimumManagerSpan: 3,
          maximumManagerSpan: 12,
          maximumLayers: 8,
          maximumContingentPercent: 20,
          maximumVacancyPercent: 15,
        },
        signals: [],
      });
    }
    if (path === '/api/people/v1/workforce/organization/scenarios') {
      return fulfillSuccess(route, [
        {
          scenarioId: 'scenario-ai-growth',
          scenarioKey: 'AI_GROWTH_2027',
          name: 'AI growth plan',
          description: 'Capacity and leadership changes for the next operating plan.',
          baselineDate: '2026-08-01',
          effectiveDate: '2027-01-01',
          lifecycleState: 'DRAFT',
          version: 2,
          changes: [],
        },
      ]);
    }
    if (path === '/api/people/v1/workforce/reference-data') {
      return fulfillSuccess(route, []);
    }
    if (path === '/api/people/v1/workforce/data-operations/hris/sync-runs') {
      if (url.searchParams.get('size') !== '20') {
        return fulfillSuccess(route, []);
      }
      return fulfillSuccess(route, [
        {
          syncRunId: 'sync-workday-20260811',
          sourceKey: 'WORKDAY_PRODUCTION',
          syncMode: 'DELTA',
          lifecycleState: 'SUCCEEDED',
          requestedWatermark: '2026-08-10T23:00:00Z',
          committedWatermark: '2026-08-11T00:00:00Z',
          readCount: 186,
          createdCount: 4,
          updatedCount: 11,
          rejectedCount: 2,
          connectorInstanceId: 'workday-production',
          mappingProfileId: 'workday-v3',
          retryOfSyncRunId: null,
          pageCount: 2,
          unchangedCount: 169,
          failureCode: null,
          redactedFailureMessage: null,
          startedAt: '2026-08-11T00:05:00Z',
          completedAt: '2026-08-11T00:06:12Z',
        },
      ]);
    }
    if (path.startsWith('/api/people/v1/workforce/data-operations/hris/')) {
      return fulfillSuccess(route, []);
    }
    if (path === '/api/auth/sessions' || path === '/api/auth/idp') {
      return fulfillSuccess(route, []);
    }
    if (path === '/api/auth/admin/identity/users') {
      return fulfillSuccess(route, {
        content: [],
        page: 0,
        size: 25,
        totalElements: 0,
        totalPages: 0,
      });
    }
    if (path === '/api/auth/admin/identity/roles') {
      return fulfillSuccess(route, []);
    }
    if (path.startsWith('/api/auth/admin/access/governance/')) {
      return fulfillSuccess(route, []);
    }
    if (path === '/api/auth/admin/access/reviews') {
      return fulfillSuccess(route, []);
    }
    if (path === '/api/auth/admin/provisioning/scim/connectors') {
      return fulfillSuccess(route, []);
    }
    if (path === '/api/auth/admin/provisioning/scim/connectors/events') {
      return fulfillSuccess(route, []);
    }
    if (path === '/api/platform/v1/admin/announcements') {
      return fulfillSuccess(route, []);
    }
    if (path === '/api/platform/v1/admin/home-experience') {
      return fulfillSuccess(route, {
        headline: null,
        subheadline: null,
        localizedContent: {},
        defaultLocale: 'ko',
        backgroundPosition: 'CENTER',
        overlayOpacity: 18,
        backgroundUrl: null,
        version: 0,
      });
    }
    if (path === '/api/platform/v1/admin/reference-sets') {
      return fulfillSuccess(route, {
        content: [],
        page: 0,
        size: 100,
        totalElements: 0,
        totalPages: 0,
      });
    }
    if (path === '/api/platform/v1/admin/registry-entries') {
      return fulfillSuccess(route, {
        content: [],
        page: 0,
        size: 100,
        totalElements: 0,
        totalPages: 0,
      });
    }
    if (path === '/api/platform/v1/admin/app-access-requests') {
      return fulfillSuccess(route, []);
    }
    if (path === '/api/platform/v1/admin/navigation/studio') {
      return fulfillSuccess(route, {
        published: NAVIGATION_REVISION_FIXTURE,
        draft: null,
        history: [NAVIGATION_REVISION_FIXTURE],
        currentTree: NAVIGATION_TREE_FIXTURE,
        currentValidation: NAVIGATION_VALIDATION_FIXTURE,
      });
    }
    if (path === '/api/platform/v1/admin/catalog') {
      return fulfillSuccess(route, {
        entityCount: CATALOG_ENTITIES_FIXTURE.length,
        relationCount: 1,
        declaredRelationCount: 0,
        orphanCount: 0,
        criticalRelationCount: 0,
        entitiesByKind: { APP: 1, SERVICE: 1 },
        entitiesByLifecycle: { ACTIVE: 2 },
        entities: CATALOG_ENTITIES_FIXTURE,
        generatedAt: '2026-08-11T00:20:00Z',
      });
    }
    if (path === '/api/platform/v1/admin/catalog/graph') {
      return fulfillSuccess(route, {
        focusRef: url.searchParams.get('focusRef'),
        nodes: CATALOG_ENTITIES_FIXTURE.map((entity) => ({
          entity,
          incomingCount: entity.kind === 'APP' ? 1 : 0,
          outgoingCount: entity.kind === 'SERVICE' ? 1 : 0,
          orphan: false,
        })),
        relations: [CATALOG_RELATION_FIXTURE],
        truncated: false,
        generatedAt: '2026-08-11T00:20:00Z',
      });
    }
    if (path === '/api/platform/v1/admin/navigation') {
      return fulfillSuccess(route, []);
    }
    if (path === '/api/platform/v1/admin/integrations/productivity/overview') {
      const connector = {
        connectorId: 'connector-microsoft-graph',
        connectorKey: 'microsoft-graph',
        displayName: 'Microsoft 365',
        providerType: 'MICROSOFT_GRAPH',
        authMode: 'DELEGATED',
        providerTenantId: 'skax.onmicrosoft.com',
        clientId: 'dwp-enterprise-client',
        credentialReference: 'vault://productivity/microsoft-graph',
        redirectUri: 'https://dwp.skax.co.kr/oauth/microsoft/callback',
        requestedScopes: ['Mail.Read', 'Calendars.Read'],
        capabilities: ['MAIL', 'CALENDAR'],
        lifecycleState: 'ACTIVE',
        healthState: 'HEALTHY',
        policyState: 'APPROVED',
        lastConfigurationCheckAt: '2026-08-11T00:00:00Z',
        lastSuccessfulSyncAt: '2026-08-10T23:58:00Z',
        consecutiveFailures: 0,
        version: 3,
      };
      return fulfillSuccess(route, {
        connectors: 1,
        activeConnectors: 1,
        connectedSubjects: 1248,
        staleStreams: 3,
        failedRuns24h: 2,
        lastSuccessfulSyncAt: '2026-08-10T23:58:00Z',
        connectorHealth: [connector],
        recentRuns: [
          {
            runId: 'productivity-run-1',
            connectorId: connector.connectorId,
            userId: 1,
            resourceKind: 'CALENDAR',
            syncMode: 'DELTA',
            runState: 'SUCCEEDED',
            startedAt: '2026-08-10T23:57:00Z',
            completedAt: '2026-08-10T23:58:00Z',
            upsertCount: 18,
            deleteCount: 1,
            skipCount: 4,
            errorCount: 0,
            partialResult: false,
            correlationId: 'corr-productivity-1',
          },
        ],
      });
    }
    if (path === '/api/platform/v1/admin/integrations/productivity/subjects') {
      return fulfillSuccess(route, [
        {
          subjectId: 'subject-1',
          connectorId: 'connector-microsoft-graph',
          userId: 1,
          consentState: 'CONNECTED',
          grantedScopes: ['Mail.Read', 'Calendars.Read'],
          tokenExpiresAt: '2026-08-11T01:00:00Z',
          lastSuccessfulSyncAt: '2026-08-10T23:58:00Z',
        },
      ]);
    }
    if (path === '/api/platform/v1/admin/integrations/productivity/runs') {
      return fulfillSuccess(route, [
        {
          runId: 'productivity-run-1',
          connectorId: 'connector-microsoft-graph',
          userId: 1,
          resourceKind: 'CALENDAR',
          syncMode: 'DELTA',
          runState: 'SUCCEEDED',
          startedAt: '2026-08-10T23:57:00Z',
          completedAt: '2026-08-10T23:58:00Z',
          upsertCount: 18,
          deleteCount: 1,
          skipCount: 4,
          errorCount: 0,
          partialResult: false,
          correlationId: 'corr-productivity-1',
        },
      ]);
    }
    if (path === '/api/platform/v1/admin/api-history/overview') {
      return fulfillSuccess(route, {
        window: 'H24',
        observationPoint: 'ALL',
        from: '2026-08-10T00:00:00Z',
        to: '2026-08-11T00:00:00Z',
        generatedAt: '2026-08-11T00:00:00Z',
        summary: {
          totalRequests: 18420,
          successfulRequests: 18166,
          clientErrorRequests: 221,
          serverErrorRequests: 33,
          errorRate: 1.38,
          p50DurationMs: 84,
          p95DurationMs: 312,
          p99DurationMs: 684,
          requestsPerMinute: 12.8,
          activeRoutesOrServices: 24,
        },
        trend: [
          {
            bucket: '2026-08-10T18:00:00Z',
            totalRequests: 4210,
            clientErrors: 41,
            serverErrors: 4,
            p95DurationMs: 276,
          },
          {
            bucket: '2026-08-11T00:00:00Z',
            totalRequests: 4680,
            clientErrors: 52,
            serverErrors: 8,
            p95DurationMs: 312,
          },
        ],
        topRoutes: [
          {
            routeId: 'workspace-items',
            serviceName: 'platform-service',
            httpMethod: 'GET',
            routeTemplate: '/v1/workspace/work-items',
            totalRequests: 3460,
            serverErrors: 3,
            errorRate: 0.09,
            p95DurationMs: 188,
          },
        ],
        statusDistribution: [
          { statusFamily: '2xx', count: 18166 },
          { statusFamily: '4xx', count: 221 },
          { statusFamily: '5xx', count: 33 },
        ],
      });
    }
    if (path === '/api/platform/v1/admin/api-history/events') {
      return fulfillSuccess(route, {
        content: [
          {
            historyId: 'api-history-1',
            occurredAt: '2026-08-11T00:00:00Z',
            completedAt: '2026-08-11T00:00:00.188Z',
            ingestedAt: '2026-08-11T00:00:01Z',
            tenantId: 1,
            actorType: 'USER',
            actorId: '1',
            authType: 'SESSION',
            serviceName: 'platform-service',
            serviceVersion: '1.0.0',
            serviceInstance: 'platform-01',
            environment: 'development',
            observationPoint: 'GATEWAY',
            routeId: 'workspace-items',
            httpMethod: 'GET',
            routeTemplate: '/v1/workspace/work-items',
            requestPath: '/api/platform/v1/workspace/work-items',
            httpScheme: 'http',
            httpProtocol: 'HTTP/1.1',
            statusCode: 200,
            outcome: 'SUCCESS',
            durationMs: 188,
            requestSizeBytes: 0,
            responseSizeBytes: 2480,
            correlationId: 'corr-api-1',
            traceId: 'trace-api-1',
            spanId: 'span-api-1',
            capturePolicyVersion: '1',
          },
        ],
        nextCursor: null,
        size: 50,
      });
    }
    if (path === '/api/platform/v1/admin/audit-events') {
      return fulfillSuccess(route, {
        content: [],
        page: 0,
        size: 100,
        totalElements: 0,
        totalPages: 0,
      });
    }
    if (path === '/api/platform/v1/admin/audit-control/event-correlations') {
      return fulfillSuccess(route, {
        content: [
          {
            correlationId: 'corr-access-20260811-001',
            firstOccurredAt: '2026-08-10T23:41:00Z',
            lastOccurredAt: '2026-08-10T23:43:12Z',
            eventCount: 3,
            domainCount: 3,
            serviceCount: 3,
            domains: ['IDENTITY_ACCESS', 'PEOPLE_WORKFORCE', 'PLATFORM_WORKSPACE'],
            classifications: ['CONFIDENTIAL', 'RESTRICTED'],
            sourceServices: ['identity-service', 'people-service', 'platform-service'],
            outcomes: ['SUCCESS', 'DENIED'],
            latestEventType: 'WORKSPACE_ACCESS_DENIED',
            latestSubjectType: 'USER',
            latestSubjectId: 'employee-1042',
            latestSubjectDisplayName: '김민서',
            maxSeverity: 'HIGH',
            maxRiskScore: 82,
            attentionRequired: true,
          },
        ],
        page: 0,
        size: 25,
        totalElements: 1,
        totalPages: 1,
      });
    }
    if (path === '/api/platform/v1/admin/audit-control/event-correlations/detail') {
      return fulfillSuccess(route, {
        summary: {
          correlationId: 'corr-access-20260811-001',
          firstOccurredAt: '2026-08-10T23:41:00Z',
          lastOccurredAt: '2026-08-10T23:43:12Z',
          eventCount: 3,
          domainCount: 3,
          serviceCount: 3,
          domains: ['IDENTITY_ACCESS', 'PEOPLE_WORKFORCE', 'PLATFORM_WORKSPACE'],
          classifications: ['CONFIDENTIAL', 'RESTRICTED'],
          sourceServices: ['identity-service', 'people-service', 'platform-service'],
          outcomes: ['SUCCESS', 'DENIED'],
          latestEventType: 'WORKSPACE_ACCESS_DENIED',
          latestSubjectType: 'USER',
          latestSubjectId: 'employee-1042',
          latestSubjectDisplayName: '김민서',
          maxSeverity: 'HIGH',
          maxRiskScore: 82,
          attentionRequired: true,
        },
        events: [
          {
            eventId: 'event-identity-1',
            eventType: 'USER_AUTHENTICATED',
            schemaVersion: '1.0',
            occurredAt: '2026-08-10T23:41:00Z',
            ingestedAt: '2026-08-10T23:41:01Z',
            tenantId: 1,
            domain: 'IDENTITY_ACCESS',
            classification: 'CONFIDENTIAL',
            sourceService: 'identity-service',
            sourceModule: 'session',
            subjectType: 'USER',
            subjectId: 'employee-1042',
            subjectDisplayName: '김민서',
            actorType: 'USER',
            actorId: 'employee-1042',
            actorDisplayName: '김민서',
            outcome: 'SUCCESS',
            severity: 'INFO',
            riskScore: 8,
            correlationId: 'corr-access-20260811-001',
            traceId: 'trace-access-1',
            beforeState: {},
            afterState: { sessionState: 'AUTHENTICATED' },
            metadata: { authenticationMethod: 'PASSWORD' },
            recordHash: '8e781ff32346ac337de3418729473e316bd7daf0d65b291e7dc94699aafc8891',
          },
          {
            eventId: 'event-people-1',
            eventType: 'WORKFORCE_ASSIGNMENT_RESOLVED',
            schemaVersion: '1.0',
            occurredAt: '2026-08-10T23:42:08Z',
            ingestedAt: '2026-08-10T23:42:09Z',
            tenantId: 1,
            domain: 'PEOPLE_WORKFORCE',
            classification: 'RESTRICTED',
            sourceService: 'people-service',
            sourceModule: 'assignment',
            subjectType: 'USER',
            subjectId: 'employee-1042',
            subjectDisplayName: '김민서',
            actorType: 'SYSTEM',
            actorId: 'people-policy',
            actorDisplayName: 'People Policy',
            outcome: 'SUCCESS',
            severity: 'MEDIUM',
            riskScore: 46,
            correlationId: 'corr-access-20260811-001',
            causationId: 'event-identity-1',
            traceId: 'trace-access-1',
            beforeState: { organization: 'Digital Platform' },
            afterState: { organization: 'Digital Platform', employmentState: 'ACTIVE' },
            metadata: { source: 'HRIS' },
            recordHash: 'd2ec3c634825ce50465b0d23a4270209b85a2907b4fd01470979798be954c688',
          },
          {
            eventId: 'event-platform-1',
            eventType: 'WORKSPACE_ACCESS_DENIED',
            schemaVersion: '1.0',
            occurredAt: '2026-08-10T23:43:12Z',
            ingestedAt: '2026-08-10T23:43:13Z',
            tenantId: 1,
            domain: 'PLATFORM_WORKSPACE',
            classification: 'RESTRICTED',
            sourceService: 'platform-service',
            sourceModule: 'authorization',
            subjectType: 'USER',
            subjectId: 'employee-1042',
            subjectDisplayName: '김민서',
            actorType: 'SYSTEM',
            actorId: 'access-policy',
            actorDisplayName: 'Access Policy',
            outcome: 'DENIED',
            severity: 'HIGH',
            riskScore: 82,
            correlationId: 'corr-access-20260811-001',
            causationId: 'event-people-1',
            traceId: 'trace-access-1',
            beforeState: { requestedRole: 'HR_ADMIN' },
            afterState: { decision: 'DENIED' },
            metadata: { policy: 'least-privilege', reason: 'role-outside-delegation-boundary' },
            recordHash: 'ea97412c1d9c025b2fb0f92c1c334110ec54a129f79c927595d3a34610be2cb1',
          },
        ],
      });
    }
    if (path === '/api/platform/v1/admin/audit-control/events') {
      if (url.searchParams.get('category') === 'ADMIN_CHANGE') {
        return fulfillSuccess(route, {
          content: [
            {
              eventId: 'audit-change-api-1',
              occurredAt: '2026-08-10T18:08:00Z',
              ingestedAt: '2026-08-10T18:08:01Z',
              tenantId: 1,
              category: 'ADMIN_CHANGE',
              action: 'platform.release.deployed',
              outcome: 'SUCCESS',
              severity: 'MEDIUM',
              riskScore: 42,
              actorType: 'SERVICE',
              actorId: 'release-orchestrator',
              actorPrincipal: 'release-orchestrator',
              actorDisplayName: 'Release orchestrator',
              actorRoles: ['SYSTEM'],
              sourceService: 'dwp-platform-server',
              sourceModule: 'release-control',
              sourceInstance: 'platform-01',
              environment: 'development',
              targetType: 'SERVICE_RELEASE',
              targetId: 'platform-2026.08.10.1',
              targetDisplayName: 'Platform 2026.08.10.1',
              reason: 'Approved production rollout',
              correlationId: 'corr-release-20260810-1',
              traceId: 'trace-release-20260810-1',
              beforeState: { version: '2026.08.09.3' },
              afterState: { version: '2026.08.10.1' },
              changedFields: ['version'],
              metadata: { deploymentCell: 'ap-northeast-2-primary' },
              retentionClass: 'EXTENDED',
              recordHash: 'change-api-monitoring-fixture',
            },
          ],
          page: 0,
          size: 20,
          totalElements: 1,
          totalPages: 1,
        });
      }
      return fulfillSuccess(route, {
        content: [],
        page: 0,
        size: 50,
        totalElements: 0,
        totalPages: 0,
      });
    }
    if (
      path === '/api/platform/v1/admin/audit-control/saved-searches' ||
      path === '/api/platform/v1/admin/audit-control/findings' ||
      path === '/api/platform/v1/admin/audit-control/cases' ||
      path === '/api/platform/v1/admin/audit-control/integrity'
    ) {
      return fulfillSuccess(route, []);
    }
    if (path === '/api/platform/v1/admin/audit-control/overview') {
      return fulfillSuccess(route, {
        window: 'D7',
        from: '2026-08-04T00:00:00Z',
        to: '2026-08-11T00:00:00Z',
        generatedAt: '2026-08-11T00:00:00Z',
        summary: {
          totalEvents: 0,
          highRiskEvents: 0,
          deniedEvents: 0,
          failedEvents: 0,
          openFindings: 0,
          activeCases: 0,
          healthySources: 0,
          registeredSources: 0,
        },
        trend: [],
        categories: [],
        outcomes: [],
        topActors: [],
        attention: [],
        sources: [],
      });
    }
    if (path === '/api/platform/v1/admin/audit-control/policy') {
      return fulfillSuccess(route, {
        standardRetentionDays: 365,
        extendedRetentionDays: 2555,
        exportLimitRows: 10000,
        requireExportReason: true,
        integrityEnabled: true,
        highRiskThreshold: 70,
        updatedBy: 'system',
        updatedAt: '2026-08-11T00:00:00Z',
      });
    }
    if (path === '/api/platform/v1/navigation') {
      const korean = (url.searchParams.get('locale') ?? locale).toLowerCase().startsWith('ko');
      const apps = [
        ['work', korean ? '업무' : 'Work', '/work', 'APP.WORK'],
        ['ask', korean ? 'DWP에게 묻기' : 'Ask', '/ask', 'APP.ASK'],
        ['activity', korean ? '활동' : 'Activity', '/activity', 'APP.ACTIVITY'],
        ['apps', korean ? '앱' : 'Apps', '/apps', 'APP.APPS'],
      ].map(([navigationKey, label, routePath, resourceKey]) => ({
        navigationKey,
        itemType: 'APP',
        label,
        registryEntryKey: `DWP_${navigationKey.toUpperCase()}`,
        route: routePath,
        iconKey: navigationKey,
        requiredResourceKey: resourceKey,
        requiredPermissionCode: 'VIEW',
        children: [],
      }));
      return fulfillSuccess(route, [
        {
          navigationKey: 'workspace',
          itemType: 'GROUP',
          label: korean ? '업무' : 'Workspace',
          requiredPermissionCode: 'VIEW',
          children: apps,
        },
      ]);
    }
    if (path === '/api/provider/v1/admin/support-session-context') {
      return fulfillSuccess(route, null);
    }
    if (path === '/api/provider/v1/admin/me') {
      return fulfillSuccess(route, {
        operatorId: 1,
        authUserId: 1,
        displayName: options.displayName ?? 'Provider Admin',
        roles: ['PROVIDER_ADMIN'],
        permissions: [
          'ESTATE_READ',
          'TENANT_WRITE',
          'OPERATION_EXECUTE',
          'CHANGE_APPROVE',
          'HEALTH_READ',
          'INCIDENT_WRITE',
          'MAINTENANCE_WRITE',
          'SUPPORT_SESSION_WRITE',
          'BREAK_GLASS_SUPPORT',
          'COMMERCIAL_READ',
          'CATALOG_READ',
          'DATA_GOVERNANCE_READ',
          'DATA_GOVERNANCE_WRITE',
          'AUDIT_READ',
        ],
      });
    }
    if (path === '/api/provider/v1/admin/command-center') {
      return fulfillSuccess(route, {
        generatedAt: '2026-08-11T00:00:00Z',
        operatingState: 'HEALTHY',
        estate: {
          organizations: 12,
          tenants: 18,
          activeTenants: 17,
          provisioningTenants: 1,
          suspendedTenants: 0,
          failedTenants: 0,
          openOperations: 3,
          activeSupportSessions: 1,
          regions: [{ key: 'ap-northeast-2', count: 18 }],
          serviceTiers: [{ key: 'ENTERPRISE', count: 18 }],
        },
        activeIncidents: 0,
        expiringSubscriptions: 1,
        actionQueue: [
          {
            itemId: 'action-1',
            category: 'CHANGE',
            severity: 'MEDIUM',
            title: 'TENANT_UPGRADE',
            detail: 'A governed tenant upgrade is ready for review.',
            tenantId: 'tenant-skax',
            targetId: 'operation-1',
            createdAt: '2026-08-11T00:00:00Z',
            route: '/provider/operations',
          },
        ],
        services: [
          {
            serviceKey: 'identity',
            displayName: 'Identity service',
            criticality: 'CRITICAL',
            totalInstances: 18,
            healthyInstances: 18,
            pendingInstances: 0,
            degradedInstances: 0,
            failedInstances: 0,
            impactedTenants: 0,
            lastReconciledAt: '2026-08-11T00:00:00Z',
          },
          {
            serviceKey: 'workspace',
            displayName: 'Workspace service',
            criticality: 'HIGH',
            totalInstances: 18,
            healthyInstances: 17,
            pendingInstances: 1,
            degradedInstances: 0,
            failedInstances: 0,
            impactedTenants: 0,
            lastReconciledAt: '2026-08-11T00:00:00Z',
          },
        ],
        cells: [
          {
            deploymentCellId: 'cell-seoul-1',
            cellKey: 'seoul-1',
            displayName: 'Seoul enterprise cell',
            regionKey: 'ap-northeast-2',
            lifecycleState: 'ACTIVE',
            placementCapacity: 30,
            tenantCount: 18,
            serviceInstances: 36,
            healthyInstances: 35,
            saturationPct: 60,
            healthState: 'HEALTHY',
          },
        ],
        recentActivity: [
          {
            auditEventId: 'audit-1',
            action: 'TENANT_REVIEWED',
            category: 'TENANT',
            outcome: 'SUCCESS',
            operatorName: 'Provider Admin',
            tenantKey: 'skax',
            targetType: 'TENANT',
            targetId: 'tenant-skax',
            occurredAt: '2026-08-11T00:00:00Z',
          },
        ],
      });
    }
    if (path === '/api/provider/v1/admin/overview') {
      return fulfillSuccess(route, {
        organizations: 12,
        tenants: 18,
        activeTenants: 17,
        provisioningTenants: 1,
        suspendedTenants: 0,
        failedTenants: 0,
        openOperations: 3,
        activeSupportSessions: 1,
        regions: [{ key: 'ap-northeast-2', count: 18 }],
        serviceTiers: [{ key: 'ENTERPRISE', count: 18 }],
      });
    }
    if (path === '/api/provider/v1/admin/tenants') {
      return fulfillSuccess(route, {
        content: [PROVIDER_TENANT_FIXTURE, PROVIDER_SECOND_TENANT_FIXTURE],
        page: 0,
        size: 100,
        totalElements: 2,
        totalPages: 1,
      });
    }
    if (path === '/api/provider/v1/admin/tenants/tenant-skax') {
      return fulfillSuccess(route, PROVIDER_TENANT_FIXTURE);
    }
    if (path === '/api/provider/v1/admin/regions') {
      return fulfillSuccess(route, [
        {
          regionKey: 'ap-northeast-2',
          displayName: 'Seoul',
          jurisdictionCode: 'KR',
          residencyClass: 'REGIONAL',
          lifecycleState: 'ACTIVE',
        },
        {
          regionKey: 'us-east-1',
          displayName: 'Virginia',
          jurisdictionCode: 'US',
          residencyClass: 'REGIONAL',
          lifecycleState: 'ACTIVE',
        },
      ]);
    }
    if (path === '/api/provider/v1/admin/entitlements') {
      return fulfillSuccess(route, PROVIDER_TENANT_FIXTURE.entitlements);
    }
    if (path === '/api/provider/v1/admin/operations') {
      return fulfillSuccess(route, {
        content: [
          {
            operationId: 'operation-1',
            tenantId: 'tenant-skax',
            operationType: 'TENANT_UPGRADE',
            lifecycleState: 'AWAITING_APPROVAL',
            riskTier: 'HIGH',
            planHash: 'sha256:visual-operation-1',
            plan: '{"targetSchemaVersion":32}',
            createdAt: '2026-08-11T00:00:00Z',
            version: 1,
            steps: [
              {
                stepId: 1,
                order: 1,
                stepKey: 'validate-contracts',
                lifecycleState: 'READY',
                targetService: 'platform-service',
                redactedResult: '{}',
                attemptCount: 0,
                attempts: [],
              },
            ],
          },
        ],
        page: 0,
        size: 100,
        totalElements: 1,
        totalPages: 1,
      });
    }
    if (path === '/api/provider/v1/admin/operation-approvals') {
      return fulfillSuccess(route, [
        {
          operationApprovalId: 'approval-1',
          operationId: 'operation-1',
          tenantId: 'tenant-skax',
          tenantName: 'SKAX Production',
          operationType: 'TENANT_UPGRADE',
          riskTier: 'HIGH',
          gateKey: 'CHANGE_APPROVAL',
          gateOrder: 1,
          lifecycleState: 'PENDING',
          requiredRoleCode: 'PROVIDER_ADMIN',
          separationOfDuties: true,
          requestedBy: 2,
          requestedByName: 'Release Operator',
          requestReason: 'Apply the reviewed platform schema release.',
          requestedAt: '2026-08-11T00:00:00Z',
          expiresAt: '2026-08-12T00:00:00Z',
          version: 1,
        },
      ]);
    }
    if (path === '/api/provider/v1/admin/service-health') {
      return fulfillSuccess(route, {
        generatedAt: '2026-08-11T00:00:00Z',
        operatingState: 'ATTENTION',
        totalInstances: 36,
        healthyInstances: 35,
        pendingInstances: 0,
        degradedInstances: 1,
        failedInstances: 0,
        impactedTenants: 1,
        services: [
          {
            serviceKey: 'identity',
            displayName: 'Identity service',
            criticality: 'CRITICAL',
            totalInstances: 18,
            healthyInstances: 18,
            pendingInstances: 0,
            degradedInstances: 0,
            failedInstances: 0,
            impactedTenants: 0,
            lastReconciledAt: '2026-08-11T00:00:00Z',
          },
          {
            serviceKey: 'workspace',
            displayName: 'Workspace service',
            criticality: 'HIGH',
            totalInstances: 18,
            healthyInstances: 17,
            pendingInstances: 0,
            degradedInstances: 1,
            failedInstances: 0,
            impactedTenants: 1,
            lastReconciledAt: '2026-08-11T00:00:00Z',
          },
        ],
        cells: [
          {
            deploymentCellId: 'cell-seoul-1',
            cellKey: 'seoul-1',
            displayName: 'Seoul enterprise cell',
            regionKey: 'ap-northeast-2',
            lifecycleState: 'ACTIVE',
            placementCapacity: 30,
            tenantCount: 18,
            serviceInstances: 36,
            healthyInstances: 35,
            saturationPct: 60,
            healthState: 'ATTENTION',
          },
        ],
        incidents: [
          {
            incidentId: 'incident-1',
            incidentKey: 'INC-2026-0811',
            title: 'Workspace latency elevated in Seoul cell',
            severity: 'SEV3',
            lifecycleState: 'MONITORING',
            impactScope: 'CELL',
            serviceKey: 'workspace',
            regionKey: 'ap-northeast-2',
            deploymentCellId: 'cell-seoul-1',
            tenantId: 'tenant-skax',
            tenantName: 'SKAX Production',
            customerImpact: 'Intermittent delay when opening work queues.',
            publicSummary: 'Performance has recovered and remains under observation.',
            ownerName: 'Platform SRE',
            detectedAt: '2026-08-10T23:35:00Z',
            startedAt: '2026-08-10T23:30:00Z',
            version: 2,
            updates: [
              {
                incidentUpdateId: 'incident-update-1',
                lifecycleState: 'MONITORING',
                message: 'Latency returned to the operating threshold.',
                visibility: 'CUSTOMER',
                operatorName: 'Platform SRE',
                createdAt: '2026-08-11T00:00:00Z',
              },
            ],
          },
        ],
      });
    }
    if (path === '/api/provider/v1/admin/reliability-control') {
      return fulfillSuccess(route, {
        generatedAt: '2026-08-11T00:00:00Z',
        healthyObjectives: 5,
        atRiskObjectives: 1,
        exhaustedObjectives: 0,
        openDriftFindings: 1,
        upcomingMaintenance: 1,
        objectives: [],
        driftFindings: [],
        maintenanceWindows: [],
      });
    }
    if (path === '/api/provider/v1/admin/support-sessions') {
      return fulfillSuccess(route, [
        {
          supportSessionId: 'support-session-1',
          tenantId: 'tenant-skax',
          tenantKey: 'skax-production',
          tenantName: 'SKAX Production',
          operatorId: 1,
          operatorName: 'Provider Admin',
          lifecycleState: 'ACTIVE',
          justification: 'Investigate the customer-reported workspace latency.',
          scopes: ['TENANT_DIAGNOSTICS_READ'],
          accessMode: 'STANDARD',
          customerApprovalRequired: false,
          riskTier: 'L1',
          startedAt: '2026-08-10T23:40:00Z',
          expiresAt: '2026-08-11T01:40:00Z',
          lastUsedAt: '2026-08-11T00:00:00Z',
          version: 1,
        },
      ]);
    }
    if (path === '/api/provider/v1/admin/support-scopes') {
      return fulfillSuccess(route, [
        {
          scopeCode: 'TENANT_DIAGNOSTICS_READ',
          displayName: 'Tenant diagnostics read',
          riskTier: 'L1',
          requiresCustomerApproval: false,
          lifecycleState: 'ACTIVE',
        },
        {
          scopeCode: 'TENANT_CONFIGURATION_WRITE',
          displayName: 'Tenant configuration write',
          riskTier: 'L3',
          requiresCustomerApproval: true,
          lifecycleState: 'ACTIVE',
        },
      ]);
    }
    if (path === '/api/provider/v1/admin/commercial') {
      return fulfillSuccess(route, {
        generatedAt: '2026-08-11T00:00:00Z',
        activeSubscriptions: 12,
        trialSubscriptions: 1,
        expiringSubscriptions: 1,
        uncontractedOrganizations: 0,
        plans: [
          {
            planKey: 'enterprise',
            planVersion: 3,
            planName: 'Enterprise',
            serviceTier: 'ENTERPRISE',
            lifecycleState: 'ACTIVE',
            organizations: 10,
            tenants: 16,
          },
          {
            planKey: 'regulated',
            planVersion: 1,
            planName: 'Regulated enterprise',
            serviceTier: 'REGULATED',
            lifecycleState: 'ACTIVE',
            organizations: 2,
            tenants: 2,
          },
        ],
        subscriptions: [
          {
            subscriptionId: 'subscription-skax',
            organizationId: 'organization-skax',
            organizationKey: 'SKAX',
            organizationName: 'SKAX',
            planKey: 'enterprise',
            planName: 'Enterprise',
            serviceTier: 'ENTERPRISE',
            lifecycleState: 'ACTIVE',
            startsAt: '2026-01-01T00:00:00Z',
            endsAt: '2027-01-01T00:00:00Z',
            contractReference: 'SKAX-2026-001',
            tenants: 1,
            activeEntitlements: 8,
          },
        ],
        entitlements: [
          {
            entitlementId: 1,
            entitlementKey: 'workforce-management',
            name: 'Workforce management',
            entitlementType: 'APPLICATION',
            assignedTenants: 16,
            eligibleTenants: 18,
          },
        ],
      });
    }
    if (path === '/api/provider/v1/admin/audit-insights') {
      return fulfillSuccess(route, {
        generatedAt: '2026-08-11T00:00:00Z',
        events24Hours: 428,
        failed24Hours: 3,
        denied24Hours: 9,
        privilegedAccess24Hours: 14,
        outcomes: [
          { key: 'SUCCESS', count: 416 },
          { key: 'DENIED', count: 9 },
          { key: 'FAILED', count: 3 },
        ],
        categories: [
          { key: 'TENANT', count: 236 },
          { key: 'SUPPORT', count: 114 },
          { key: 'CHANGE', count: 78 },
        ],
      });
    }
    if (path === '/api/provider/v1/admin/audit-events') {
      return fulfillSuccess(route, [
        {
          auditEventId: 'provider-audit-1',
          operatorId: 1,
          operatorName: 'Provider Admin',
          tenantId: 'tenant-skax',
          tenantKey: 'skax-production',
          action: 'SUPPORT_SESSION_STARTED',
          targetType: 'SUPPORT_SESSION',
          targetId: 'support-session-1',
          eventCategory: 'SUPPORT',
          outcome: 'SUCCESS',
          correlationId: 'corr-support-1',
          redactedSnapshot: '{"scope":"TENANT_DIAGNOSTICS_READ"}',
          occurredAt: '2026-08-10T23:40:00Z',
        },
      ]);
    }
    if (path === '/api/provider/v1/admin/code-catalog/code-sets') {
      return fulfillSuccess(route, {
        catalogScope: 'GLOBAL_PRODUCT',
        changePolicy: 'RELEASE_MANAGED',
        codeSets: [
          {
            codeSetKey: 'PLATFORM.EVENT_ENVELOPE.DOMAIN',
            ownerService: 'platform-service',
            contractKind: 'OBSERVABILITY',
            configurationLevel: 'SYSTEM',
            validationSource: 'CATALOG',
            runtimeVisibility: 'ADMIN_ONLY',
            displayName: 'Event envelope domain',
            schemaVersion: 1,
            valueCount: 5,
            bindingCount: 2,
            enforcedBindingCount: 2,
            registrationState: 'REGISTERED',
          },
        ],
      });
    }
    if (path.startsWith('/api/provider/v1/admin/code-catalog/code-sets/')) {
      return fulfillSuccess(route, {
        codeSetKey: decodeURIComponent(path.split('/').pop() ?? ''),
        ownerService: 'platform-service',
        contractKind: 'OBSERVABILITY',
        displayName: 'Event envelope domain',
        description: 'Canonical business domains used by cross-domain event envelopes.',
        configurationLevel: 'SYSTEM',
        validationSource: 'CATALOG',
        sourceReference: 'sys_audit_events.event_source',
        schemaVersion: 1,
        runtimeVisibility: 'ADMIN_ONLY',
        values: [
          {
            code: 'IDENTITY',
            label: 'Identity',
            displayName: 'Identity',
            sortOrder: 10,
            predefined: true,
            lifecycleState: 'ACTIVE',
            behaviorMetadata: {},
          },
          {
            code: 'WORKFORCE',
            label: 'Workforce',
            displayName: 'Workforce',
            sortOrder: 20,
            predefined: true,
            lifecycleState: 'ACTIVE',
            behaviorMetadata: {},
          },
        ],
        bindings: [
          {
            consumerService: 'platform-service',
            usageType: 'API_CONTRACT',
            sourceReference: 'EventEnvelope.domain',
            enforcementType: 'TYPED_CONTRACT',
          },
        ],
      });
    }
    if (path === '/api/provider/v1/admin/data-governance') {
      return fulfillSuccess(route, {
        generatedAt: '2026-08-11T00:00:00Z',
        summary: {
          databases: 3,
          availableDatabases: 3,
          logicalTables: 128,
          partitions: 24,
          columns: 1840,
          foreignKeys: 176,
          documentedAssets: 117,
          reviewRequired: 4,
          totalBytes: 4286578688,
        },
        databases: [
          {
            databaseKey: 'platform',
            databaseName: 'dwp_platform',
            displayName: 'Platform database',
            ownerService: 'platform-service',
            status: 'AVAILABLE',
            logicalTables: 42,
            partitions: 8,
            views: 6,
            columns: 612,
            foreignKeys: 58,
            documentedAssets: 40,
            totalAssets: 48,
            totalBytes: 1543503872,
            businessDomains: ['GOVERNANCE', 'WORKSPACE'],
          },
        ],
        assets: [
          {
            assetKey: 'platform.public.sys_audit_events',
            databaseKey: 'platform',
            databaseName: 'dwp_platform',
            schemaName: 'public',
            objectName: 'sys_audit_events',
            objectType: 'PARTITIONED_TABLE',
            businessDomain: 'GOVERNANCE',
            ownerService: 'platform-service',
            lifecycleState: 'ACTIVE',
            criticality: 'CRITICAL',
            dataClassification: 'RESTRICTED',
            reviewState: 'VERIFIED',
            description: 'Immutable tenant audit evidence and correlation source.',
            estimatedRows: 1842000,
            totalBytes: 1288490188,
            tenantScoped: true,
            constraintCount: 4,
            indexCount: 7,
            inboundRelationships: 0,
            outboundRelationships: 1,
            primaryKey: ['audit_event_id', 'occurred_at'],
            columns: [
              {
                name: 'audit_event_id',
                dataType: 'uuid',
                nullable: false,
                primaryKey: true,
                foreignKey: false,
                indexed: true,
                classification: 'INTERNAL',
              },
              {
                name: 'tenant_id',
                dataType: 'bigint',
                nullable: false,
                primaryKey: false,
                foreignKey: true,
                indexed: true,
                classification: 'RESTRICTED',
              },
            ],
          },
          {
            assetKey: 'platform.public.usr_saved_views',
            databaseKey: 'platform',
            databaseName: 'dwp_platform',
            schemaName: 'public',
            objectName: 'usr_saved_views',
            objectType: 'TABLE',
            businessDomain: 'WORKSPACE',
            ownerService: 'platform-service',
            lifecycleState: 'ACTIVE',
            criticality: 'MEDIUM',
            dataClassification: 'INTERNAL',
            reviewState: 'REVIEW_REQUIRED',
            description: 'Governed personal and tenant-shared workspace views.',
            reviewNote: 'Confirm the organization sharing retention policy.',
            estimatedRows: 2400,
            totalBytes: 4194304,
            tenantScoped: true,
            constraintCount: 5,
            indexCount: 4,
            inboundRelationships: 1,
            outboundRelationships: 1,
            primaryKey: ['saved_view_id'],
            columns: [],
          },
        ],
        relationships: [
          {
            relationshipId: 'relationship-saved-view-tenant',
            databaseKey: 'platform',
            constraintName: 'fk_saved_view_tenant',
            sourceAssetKey: 'platform.public.usr_saved_views',
            targetAssetKey: 'platform.public.sys_tenants',
            sourceColumns: ['tenant_id'],
            targetColumns: ['tenant_id'],
            sourceIndexed: true,
          },
        ],
        lineage: [
          {
            edgeId: 'lineage-audit-correlation',
            edgeKey: 'audit-to-correlation',
            sourceAssetKey: 'platform.public.sys_audit_events',
            targetAssetKey: 'platform.api.event_correlations',
            processKey: 'event-correlation-projection',
            edgeType: 'AGGREGATION',
            ownerService: 'platform-service',
            description: 'Projects immutable audit evidence into incident timelines.',
            metadata: '{}',
          },
        ],
        findings: [
          {
            findingId: 'finding-saved-view-review',
            severity: 'MEDIUM',
            category: 'DOCUMENTATION',
            databaseKey: 'platform',
            assetKey: 'platform.public.usr_saved_views',
            title: 'Shared-view retention policy review',
            detail: 'The new shared-view asset is awaiting governance verification.',
            recommendation: 'Approve ownership and retention metadata before release.',
          },
        ],
      });
    }

    return route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ERROR', message: 'Not required by shell contract test' }),
    });
  });
}
