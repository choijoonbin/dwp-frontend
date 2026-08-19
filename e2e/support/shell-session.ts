import {
  DEFAULT_APP_PERMISSIONS,
  WORKSPACE_ACTIVITY_FIXTURE,
  WORKSPACE_APPS_FIXTURE,
  WORKSPACE_QUEUE_FIXTURE,
} from './runtime-access';
import {
  APPROVAL_ADMIN_FIXTURE,
  APPROVAL_DELEGATIONS_FIXTURE,
  APPROVAL_FORM_DETAIL_FIXTURE,
  APPROVAL_FORM_FIXTURE,
  APPROVAL_HOME_FIXTURE,
  APPROVAL_OPERATIONS_FIXTURE,
  APPROVAL_POLICIES_FIXTURE,
  APPROVAL_REQUEST_DETAIL_FIXTURE,
  APPROVAL_REQUEST_FIXTURE,
  APPROVAL_SIGNATURE_FIXTURES,
  APPROVAL_TASK_DETAIL_FIXTURE,
  APPROVAL_TASK_FIXTURE,
  APPROVAL_WORKFLOW_DETAIL_FIXTURE,
  APPROVAL_WORKFLOW_FIXTURE,
  CALENDAR_ADMIN_FIXTURE,
  CALENDAR_AVAILABILITY_FIXTURE,
  CALENDAR_BOOKINGS_FIXTURE,
  CALENDAR_EVENT_FIXTURE,
  CALENDAR_FOCUS_FIXTURE,
  CALENDAR_HOME_FIXTURE,
  CALENDAR_RESOURCES_FIXTURE,
  CALENDAR_SUMMARIES_FIXTURE,
  HR_ABSENCE_FIXTURE,
  HR_BENEFITS_FIXTURE,
  HR_HOME_FIXTURE,
  HR_PAY_FIXTURE,
  HR_SERVICE_CATALOG_FIXTURE,
  HR_SERVICE_REQUESTS_FIXTURE,
  HR_TALENT_FIXTURE,
  HR_TIME_FIXTURE,
  ROOM_BOOKING_EVENT_FIXTURE,
  hrDomainOperationsFixture,
} from './product-area-fixtures';

import type { Page, Route } from '@playwright/test';
import type {
  LocalizationRevision,
  LocalizationRevisionState,
  PreferenceExceptionRequest,
  ResourceRoleDTO,
} from '@dwp-frontend/shared-utils';

type Appearance = {
  mode: 'system' | 'light' | 'dark';
  density: 'compact' | 'standard' | 'comfortable';
  highContrast: boolean;
  reduceMotion: boolean;
};

type ShellSessionOptions = {
  userId?: number;
  personPublicId?: string | null;
  locale?: 'en' | 'ko';
  displayName?: string;
  jobTitle?: string;
  email?: string;
  appearance?: Appearance;
  localizationState?: LocalizationRevisionState;
  groups?: Array<{ groupRef: string; displayName: string }>;
  resourceRoles?: ResourceRoleDTO[];
  permissions?: Array<{
    resourceType: string;
    resourceKey: string;
    permissionCode: string;
    effect: 'ALLOW' | 'DENY';
  }>;
};

type MockHomeSurface = {
  schemaVersion: 2;
  surfaceKey: 'workspace-home' | 'hcm-home' | 'approval-home';
  customized: boolean;
  layout: {
    appLayout: Record<string, unknown> | null;
    presentation: 'balanced' | 'expressive' | 'focused';
    widgets: Array<{
      widgetKey: string;
      visible: boolean;
      size: 'fifth' | 'quarter' | 'compact' | 'medium' | 'large' | 'full';
    }>;
  };
  version: number;
  updatedAt: string | null;
};

export const FULL_PRODUCT_PERMISSIONS = [
  ...DEFAULT_APP_PERMISSIONS,
  {
    resourceType: 'APP',
    resourceKey: 'APP.WORKFORCE_MANAGEMENT',
    permissionCode: 'VIEW',
    effect: 'ALLOW' as const,
  },
  {
    resourceType: 'APP',
    resourceKey: 'APP.CALENDAR',
    permissionCode: 'VIEW',
    effect: 'ALLOW' as const,
  },
  ...['VIEW', 'CREATE', 'UPDATE'].map((permissionCode) => ({
    resourceType: 'APP',
    resourceKey: 'APP.ROOMS',
    permissionCode,
    effect: 'ALLOW' as const,
  })),
  ...['VIEW', 'CREATE', 'UPDATE'].map((permissionCode) => ({
    resourceType: 'APP',
    resourceKey: 'APP.WORKPLACE',
    permissionCode,
    effect: 'ALLOW' as const,
  })),
  {
    resourceType: 'APP',
    resourceKey: 'APP.APPROVALS',
    permissionCode: 'VIEW',
    effect: 'ALLOW' as const,
  },
  {
    resourceType: 'DATA',
    resourceKey: 'DATA.WORKFORCE',
    permissionCode: 'MANAGE',
    effect: 'ALLOW' as const,
  },
  {
    resourceType: 'ACTION',
    resourceKey: 'ACTION.WORKFORCE_REFERENCE',
    permissionCode: 'MANAGE',
    effect: 'ALLOW' as const,
  },
  {
    resourceType: 'ACTION',
    resourceKey: 'ACTION.WORKFORCE_DATA_OPERATIONS',
    permissionCode: 'MANAGE',
    effect: 'ALLOW' as const,
  },
  ...[
    ['ADMIN.COMMUNICATIONS', 'VIEW'],
    ['ADMIN.COMMUNICATIONS', 'CREATE'],
    ['ADMIN.COMMUNICATIONS', 'UPDATE'],
    ['ADMIN.COMMUNICATIONS', 'APPROVE'],
    ['ADMIN.COMMUNICATIONS', 'MANAGE'],
    ['ADMIN.SERVICE_CATALOG', 'VIEW'],
    ['ADMIN.SERVICE_CATALOG', 'CREATE'],
    ['ADMIN.SERVICE_CATALOG', 'UPDATE'],
    ['ADMIN.SERVICE_CATALOG', 'MANAGE'],
    ['ADMIN.SERVICE_OPERATIONS', 'VIEW'],
    ['ADMIN.SERVICE_OPERATIONS', 'UPDATE'],
    ['ADMIN.SERVICE_OPERATIONS', 'MANAGE'],
    ['ADMIN.IDENTITY_DIRECTORY', 'VIEW'],
    ['ADMIN.IDENTITY_DIRECTORY', 'MANAGE'],
    ['ADMIN.APP_GOVERNANCE', 'VIEW'],
    ['ADMIN.APP_GOVERNANCE', 'MANAGE'],
    ['ADMIN.APP_ACCESS_REQUESTS', 'VIEW'],
    ['ADMIN.APP_ACCESS_REQUESTS', 'MANAGE'],
    ['ADMIN.IDENTITY_PROVISIONING', 'VIEW'],
    ['ADMIN.IDENTITY_PROVISIONING', 'MANAGE'],
    ['ADMIN.API_MONITORING', 'VIEW'],
    ['ADMIN.AUDIT_VIEW', 'VIEW'],
    ['ADMIN.AUDIT_INVESTIGATE', 'UPDATE'],
    ['ADMIN.AUDIT_CONFIGURE', 'MANAGE'],
    ['ADMIN.AUDIT_EXPORT', 'EXPORT'],
    ['ADMIN.PRODUCTIVITY_CONNECTOR', 'MANAGE'],
    ['ADMIN.WORKFORCE_ACCESS', 'MANAGE'],
    ['ADMIN.SAVED_VIEW_CUSTODY', 'VIEW'],
    ['ADMIN.SAVED_VIEW_CUSTODY', 'MANAGE'],
    ['ADMIN.SPACE_GOVERNANCE', 'VIEW'],
    ['ADMIN.SPACE_GOVERNANCE', 'MANAGE'],
    ['ADMIN.SPACE_TEMPLATES', 'VIEW'],
    ['ADMIN.SPACE_TEMPLATES', 'CREATE'],
    ['ADMIN.SPACE_TEMPLATES', 'UPDATE'],
    ['ADMIN.SPACE_TEMPLATES', 'MANAGE'],
    ['ADMIN.SPACE_COMPLIANCE', 'VIEW'],
    ['ADMIN.SPACE_COMPLIANCE', 'APPROVE'],
    ['ADMIN.SPACE_ACCESS_REVIEW', 'VIEW'],
    ['ADMIN.SPACE_ACCESS_REVIEW', 'APPROVE'],
    ['ADMIN.CALENDAR', 'VIEW'],
    ['ADMIN.CALENDAR', 'CREATE'],
    ['ADMIN.CALENDAR', 'UPDATE'],
    ['ADMIN.CALENDAR', 'MANAGE'],
    ['ADMIN.ROOMS', 'VIEW'],
    ['ADMIN.ROOMS', 'CREATE'],
    ['ADMIN.ROOMS', 'UPDATE'],
    ['ADMIN.ROOMS', 'MANAGE'],
    ['ADMIN.WORKPLACE', 'VIEW'],
    ['ADMIN.WORKPLACE', 'CREATE'],
    ['ADMIN.WORKPLACE', 'UPDATE'],
    ['ADMIN.WORKPLACE', 'MANAGE'],
    ['ADMIN.APPROVAL_DESIGN', 'VIEW'],
    ['ADMIN.APPROVAL_DESIGN', 'CREATE'],
    ['ADMIN.APPROVAL_DESIGN', 'UPDATE'],
    ['ADMIN.APPROVAL_DESIGN', 'APPROVE'],
    ['ADMIN.APPROVAL_DESIGN', 'MANAGE'],
    ['ADMIN.APPROVAL_POLICY', 'VIEW'],
    ['ADMIN.APPROVAL_POLICY', 'APPROVE'],
    ['ADMIN.APPROVAL_POLICY', 'MANAGE'],
    ['ADMIN.APPROVAL_OPERATIONS', 'VIEW'],
    ['ADMIN.APPROVAL_OPERATIONS', 'UPDATE'],
    ['ADMIN.APPROVAL_OPERATIONS', 'MANAGE'],
    ['ADMIN.APPROVAL_SIGNATURE', 'VIEW'],
    ['ADMIN.APPROVAL_SIGNATURE', 'MANAGE'],
  ].map(([resourceKey, permissionCode]) => ({
    resourceType: 'ADMIN',
    resourceKey,
    permissionCode,
    effect: 'ALLOW' as const,
  })),
  ...[
    ['ACTION.APPROVAL_TASK', 'VIEW'],
    ['ACTION.APPROVAL_TASK', 'APPROVE'],
    ['ACTION.APPROVAL_REQUEST', 'VIEW'],
    ['ACTION.APPROVAL_REQUEST', 'CREATE'],
    ['ACTION.APPROVAL_REQUEST', 'UPDATE'],
    ['ACTION.APPROVAL_DELEGATION', 'VIEW'],
    ['ACTION.APPROVAL_DELEGATION', 'MANAGE'],
  ].map(([resourceKey, permissionCode]) => ({
    resourceType: 'ACTION',
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

export const CATALOG_ASSURANCE_FINDING_FIXTURE = {
  findingId: '71000000-0000-0000-0000-000000000001',
  entityRef: 'APP:DWP_WORK',
  findingCode: 'OWNER_MISSING',
  severity: 'HIGH',
  lifecycleState: 'OPEN',
  ruleKey: 'DWP_CATALOG_IMPACT',
  ruleVersion: 1,
  evidence: {
    entityRef: 'APP:DWP_WORK',
    entityRevision: 1,
    lifecycleState: 'ACTIVE',
    signal: 'ownerRef',
    value: null,
    directDependentCount: 0,
    ruleKey: 'DWP_CATALOG_IMPACT',
    ruleVersion: 1,
  },
  evidenceSha256: 'a'.repeat(64),
  firstDetectedAt: '2026-08-11T00:20:00Z',
  lastDetectedAt: '2026-08-12T00:20:00Z',
  dispositionReason: null,
  dispositionEvidenceRef: null,
  disposedBy: null,
  disposedAt: null,
  version: 0,
} as const;

export const CATALOG_ASSURANCE_FIXTURE = {
  openCount: 1,
  criticalCount: 0,
  ownerMissingCount: 1,
  deprecationImpactCount: 0,
  activeRule: {
    ruleKey: 'DWP_CATALOG_IMPACT',
    ruleVersion: 1,
    definition: {
      maximumTraversalDepth: 8,
      criticalDirectBlocks: true,
      retireWithDirectDependentsBlocks: true,
      criticalityWeights: { INFORMATIONAL: 1, OPERATIONAL: 2, CRITICAL: 4 },
    },
    contentSha256: 'b'.repeat(64),
  },
  findings: [CATALOG_ASSURANCE_FINDING_FIXTURE],
  generatedAt: '2026-08-12T00:20:00Z',
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

const communicationStory = ({
  communicationId,
  title,
  summary,
  categoryKey,
  contentType,
  publisherName,
  coverImageUrl,
  publishedAt,
  featured = false,
}: {
  communicationId: number;
  title: string;
  summary: string;
  categoryKey: string;
  contentType: 'ANNOUNCEMENT' | 'NEWS' | 'EVENT' | 'POLICY_UPDATE';
  publisherName: string;
  coverImageUrl: string;
  publishedAt: string;
  featured?: boolean;
}) => ({
  communicationId,
  title,
  summary,
  body: summary,
  severity: 'INFO' as const,
  contentType,
  categoryKey,
  publisherName,
  coverImageUrl,
  featured,
  pinned: false,
  acknowledgementRequired: false,
  acknowledgementDueAt: null,
  dismissible: true,
  readingMinutes: 3,
  sourceLocale: 'en',
  actionLabel: null,
  actionUrl: null,
  publishedAt,
  endsAt: null,
  readerState: {
    unread: true,
    saved: false,
    acknowledged: false,
    dismissed: false,
    openedAt: null,
    savedAt: null,
    acknowledgedAt: null,
  },
  reactions: { counts: {}, viewerReaction: null, total: 0 },
});

export const HOME_COMMUNICATIONS_FIXTURE = {
  featured: communicationStory({
    communicationId: 4101,
    title: 'Leadership town hall questions and answers',
    summary: 'Review the key answers shared during this quarter leadership conversation.',
    categoryKey: 'LEADERSHIP',
    contentType: 'ANNOUNCEMENT',
    publisherName: 'CEO Office',
    coverImageUrl: '/media/communications/community-day.jpg',
    publishedAt: '2026-08-13T09:00:00Z',
    featured: true,
  }),
  items: [
    communicationStory({
      communicationId: 4104,
      title: 'A new way to collaborate with colleagues in the AI era',
      summary:
        'See how small ideas become measurable workplace improvements through team experiments.',
      categoryKey: 'INNOVATION',
      contentType: 'NEWS',
      publisherName: 'Digital Workplace',
      coverImageUrl: '/media/communications/innovation-lab.jpg',
      publishedAt: '2026-08-18T09:00:00Z',
    }),
    communicationStory({
      communicationId: 4103,
      title: 'Green campus day brings our community together',
      summary: 'Find the schedule and participation details for this week volunteer program.',
      categoryKey: 'CULTURE',
      contentType: 'EVENT',
      publisherName: 'People & Culture',
      coverImageUrl: '/media/communications/community-day.jpg',
      publishedAt: '2026-08-17T09:00:00Z',
    }),
    communicationStory({
      communicationId: 4102,
      title: 'Security readiness checklist for distributed work',
      summary:
        'Complete these practical checks to keep customer and company information protected.',
      categoryKey: 'SECURITY',
      contentType: 'POLICY_UPDATE',
      publisherName: 'Information Security',
      coverImageUrl: '/media/communications/security-readiness.jpg',
      publishedAt: '2026-08-16T09:00:00Z',
    }),
  ],
  summary: { total: 4, unread: 4, required: 0, saved: 0 },
  generatedAt: '2026-08-18T09:10:00Z',
} as const;

export function createHomeOverviewFixture(roles: readonly string[] = ['WORKSPACE_MEMBER']) {
  const operator = roles.some((role) =>
    ['ADMIN', 'TENANT_ADMIN', 'PLATFORM_ADMIN', 'PROVIDER_ADMIN'].includes(role)
  );
  const manager = roles.some((role) => ['MANAGER', 'PEOPLE_MANAGER'].includes(role));
  const communications = {
    featured: null,
    items: [],
    summary: { total: 0, unread: 0, required: 0, saved: 0 },
    generatedAt: '2026-08-14T00:20:00Z',
  };
  const recommendations = [
    {
      key: 'work-due-soon',
      kind: 'ACTION',
      priority: 'HIGH',
      title: 'Review work approaching its deadline',
      description: 'Your personal work queue contains time-sensitive items.',
      actionPath: '/work',
      source: 'DWP_WORKSPACE',
      evidenceCount: WORKSPACE_QUEUE_FIXTURE.summary.dueSoon,
      confidence: 'HIGH',
    },
  ] as const;

  return {
    audience: {
      profile: operator ? 'OPERATOR' : manager ? 'MANAGER' : 'MEMBER',
      ruleVersion: 'home-rules-2026.08',
      reasons: [
        operator
          ? 'CONTROL_PLANE_RESPONSIBILITY'
          : manager
            ? 'PEOPLE_LEADERSHIP_RESPONSIBILITY'
            : 'AUTHENTICATED_WORKFORCE_MEMBER',
      ],
    },
    work: {
      status: 'AVAILABLE',
      source: 'DWP_WORKSPACE',
      generatedAt: WORKSPACE_QUEUE_FIXTURE.generatedAt,
      data: WORKSPACE_QUEUE_FIXTURE,
      reason: null,
    },
    calendar: {
      status: 'AVAILABLE',
      source: 'DWP_CALENDAR',
      generatedAt: CALENDAR_HOME_FIXTURE.generatedAt,
      data: CALENDAR_HOME_FIXTURE,
      reason: null,
    },
    communications: {
      status: 'AVAILABLE',
      source: 'DWP_COMMUNICATIONS',
      generatedAt: communications.generatedAt,
      data: communications,
      reason: null,
    },
    activity: {
      status: 'AVAILABLE',
      source: 'DWP_ACTIVITY',
      generatedAt: WORKSPACE_ACTIVITY_FIXTURE.generatedAt,
      data: WORKSPACE_ACTIVITY_FIXTURE,
      reason: null,
    },
    recommendations,
    recommendationSection: {
      status: 'AVAILABLE',
      source: 'DWP_HOME_RECOMMENDATIONS',
      generatedAt: '2026-08-14T00:20:00Z',
      data: recommendations,
      reason: null,
    },
    generatedAt: '2026-08-14T00:20:00Z',
  } as const;
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
      policyId: 'policy-default',
      scope: 'TENANT',
      source: 'TENANT_EXPERIENCE_POLICY',
      ownerType: 'ROLE',
      ownerRef: 'TENANT_ADMIN',
      ownerDisplayName: 'Tenant administrator',
      contactUri: '/admin/experience/preference-exceptions',
      managedPaths: ['appearance.fontFamily', 'appearance.accentColor', 'navigation.pattern'],
      rules: [
        {
          ruleId: 'rule-font',
          preferencePath: 'appearance.fontFamily',
          displayKey: 'settings.productFont.title',
          managedValue: null,
          exceptionAllowed: true,
          version: 0,
        },
        {
          ruleId: 'rule-accent',
          preferencePath: 'appearance.accentColor',
          displayKey: 'settings.brandAccent.title',
          managedValue: null,
          exceptionAllowed: true,
          version: 0,
        },
        {
          ruleId: 'rule-navigation',
          preferencePath: 'navigation.pattern',
          displayKey: 'settings.navigationPattern.title',
          managedValue: 'sidebar',
          exceptionAllowed: true,
          version: 0,
        },
      ],
      version: 0,
    },
    version: 1,
    updatedAt: '2026-08-11T00:00:00Z' as string | null,
  };
  let personalPreference = structuredClone(defaultPersonalPreference);
  let preferenceExceptions: PreferenceExceptionRequest[] = [];
  const defaultHomeSurfaces: Record<MockHomeSurface['surfaceKey'], MockHomeSurface> = {
    'workspace-home': {
      schemaVersion: 4,
      surfaceKey: 'workspace-home',
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
    },
    'hcm-home': {
      schemaVersion: 4,
      surfaceKey: 'hcm-home',
      customized: false,
      layout: {
        appLayout: null,
        presentation: 'balanced',
        widgets: [
          { widgetKey: 'people-signals', visible: true, size: 'full' },
          { widgetKey: 'quick-actions', visible: true, size: 'full' },
          { widgetKey: 'profile', visible: true, size: 'compact' },
          { widgetKey: 'team', visible: true, size: 'full' },
          { widgetKey: 'operations', visible: true, size: 'full' },
        ],
      },
      version: 0,
      updatedAt: null,
    },
    'approval-home': {
      schemaVersion: 4,
      surfaceKey: 'approval-home',
      customized: false,
      layout: {
        appLayout: null,
        presentation: 'balanced',
        widgets: [
          { widgetKey: 'decision-pulse', visible: true, size: 'full' },
          { widgetKey: 'focus-queue', visible: true, size: 'large' },
          { widgetKey: 'flow', visible: true, size: 'medium' },
          { widgetKey: 'my-requests', visible: true, size: 'medium' },
          { widgetKey: 'insights', visible: true, size: 'medium' },
          { widgetKey: 'admin-health', visible: true, size: 'full' },
        ],
      },
      version: 0,
      updatedAt: null,
    },
  };
  const homeSurfaces = structuredClone(defaultHomeSurfaces);
  const localizationPreview = (
    sourceEntries: Record<string, string>,
    entries: Record<string, string>
  ) => {
    const missingKeys = Object.keys(sourceEntries).filter((key) => !entries[key]?.trim());
    const resolvedEntries = Object.fromEntries(
      Object.entries(sourceEntries).map(([key, value]) => [key, entries[key]?.trim() || value])
    );
    return {
      resolvedEntries,
      missingKeys,
      fallbackKeys: missingKeys,
      unknownKeys: Object.keys(entries).filter((key) => !(key in sourceEntries)),
      placeholderIssues: [],
      completeness:
        Math.round(
          ((Object.keys(sourceEntries).length - missingKeys.length) * 10_000) /
            Object.keys(sourceEntries).length
        ) / 100,
      publishable:
        missingKeys.length === 0 && Object.keys(entries).every((key) => key in sourceEntries),
    };
  };
  const initialLocalizationState = options.localizationState ?? 'DRAFT';
  const initialSourceEntries = {
    'shell.welcome': 'Welcome, {{name}}',
    'shell.empty': 'No work requires your attention.',
  };
  const initialLocalizationEntries = {
    'shell.welcome': '환영합니다, {{name}}',
    'shell.empty': '확인이 필요한 업무가 없습니다.',
  };
  let localizationRevision: LocalizationRevision = {
    revisionId: '81000000-0000-0000-0000-000000000001',
    bundleId: '80000000-0000-0000-0000-000000000001',
    bundleKey: 'shell',
    sourceLocale: 'en',
    targetLocale: 'ko',
    revisionNumber: 2,
    basedOnRevisionId: '81000000-0000-0000-0000-000000000000',
    sourceEntries: initialSourceEntries,
    entries: initialLocalizationEntries,
    lifecycleState: initialLocalizationState,
    changeSummary: 'Improve the governed Korean shell language',
    contentSha256: 'c'.repeat(64),
    submittedBy: initialLocalizationState === 'DRAFT' ? null : 2,
    submittedAt: initialLocalizationState === 'DRAFT' ? null : '2026-08-13T00:05:00Z',
    decidedBy: null,
    decidedAt: null,
    publishedBy: null,
    publishedAt: null,
    version: initialLocalizationState === 'DRAFT' ? 0 : 1,
    createdAt: '2026-08-13T00:00:00Z',
    createdBy: 2,
    updatedAt: '2026-08-13T00:05:00Z',
    decisions:
      initialLocalizationState === 'DRAFT'
        ? []
        : [
            {
              decisionId: '82000000-0000-0000-0000-000000000001',
              previousState: 'DRAFT',
              decision: 'SUBMITTED',
              reason: 'Ready for independent language review.',
              actorId: 2,
              decidedAt: '2026-08-13T00:05:00Z',
            },
          ],
    preview: localizationPreview(initialSourceEntries, initialLocalizationEntries),
  };

  const localizationWorkspace = () => ({
    bundleCount: 1,
    draftCount: localizationRevision.lifecycleState === 'DRAFT' ? 1 : 0,
    reviewCount: ['IN_REVIEW', 'APPROVED'].includes(localizationRevision.lifecycleState) ? 1 : 0,
    publishedCount: localizationRevision.lifecycleState === 'PUBLISHED' ? 1 : 0,
    issueCount:
      localizationRevision.preview.missingKeys.length +
      localizationRevision.preview.unknownKeys.length +
      localizationRevision.preview.placeholderIssues.length,
    bundles: [
      {
        bundleId: localizationRevision.bundleId,
        bundleKey: localizationRevision.bundleKey,
        sourceLocale: localizationRevision.sourceLocale,
        targetLocale: localizationRevision.targetLocale,
        lifecycleState: 'ACTIVE',
        currentPublishedRevisionId:
          localizationRevision.lifecycleState === 'PUBLISHED'
            ? localizationRevision.revisionId
            : '81000000-0000-0000-0000-000000000000',
        currentPublishedRevisionNumber: localizationRevision.lifecycleState === 'PUBLISHED' ? 2 : 1,
        openRevisionState: ['DRAFT', 'IN_REVIEW', 'APPROVED'].includes(
          localizationRevision.lifecycleState
        )
          ? localizationRevision.lifecycleState
          : null,
        openRevisionNumber: ['DRAFT', 'IN_REVIEW', 'APPROVED'].includes(
          localizationRevision.lifecycleState
        )
          ? localizationRevision.revisionNumber
          : null,
        completeness: localizationRevision.preview.completeness,
        issueCount:
          localizationRevision.preview.missingKeys.length +
          localizationRevision.preview.unknownKeys.length +
          localizationRevision.preview.placeholderIssues.length,
        version: 1,
        updatedAt: localizationRevision.updatedAt,
      },
    ],
  });

  await page.route('**/api/**', (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (!path.startsWith('/api/')) return route.continue();

    if (path === '/api/auth/me') {
      return fulfillSuccess(route, {
        userId: options.userId ?? 1,
        personPublicId:
          options.personPublicId !== undefined
            ? options.personPublicId
            : provider
              ? null
              : 'person-session-user',
        displayName: options.displayName ?? (provider ? 'Provider Admin' : 'Tenant Admin'),
        jobTitle:
          options.jobTitle ?? (provider ? 'Platform operations lead' : 'Tenant administrator'),
        email: options.email ?? (provider ? 'provider.admin@dwp.local' : 'tenant.admin@dwp.local'),
        tenantId: 1,
        tenantCode: 'default',
        tenantName: 'SKAX',
        preferredLocale: locale,
        tenantDefaultLocale: locale,
        roles,
        groups: options.groups ?? [],
        resourceRoles: options.resourceRoles ?? [],
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
    if (path === '/api/platform/v1/search/audit') {
      return fulfillSuccess(route, {
        eventId: 'search-audit-event',
        queryDigest: '0'.repeat(64),
      });
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
    if (
      path === '/api/auth/admin/access/privileged/me/eligibilities' ||
      path === '/api/auth/admin/access/privileged/me/requests'
    ) {
      return fulfillSuccess(route, []);
    }
    if (path === '/api/platform/v1/personal-preferences/managed-policy') {
      return fulfillSuccess(route, personalPreference.managedPolicy);
    }
    if (path === '/api/platform/v1/personal-preferences/exceptions') {
      if (route.request().method() === 'GET') {
        return fulfillSuccess(route, preferenceExceptions);
      }
      const body = route.request().postDataJSON() as {
        preferencePath: string;
        requestedValue: unknown;
        businessJustification: string;
        businessImpact: string;
        requestedUntil?: string | null;
      };
      const request: PreferenceExceptionRequest = {
        requestId: `exception-${preferenceExceptions.length + 1}`,
        userId: 1,
        preferencePath: body.preferencePath,
        requestedValue: body.requestedValue,
        businessJustification: body.businessJustification,
        businessImpact: body.businessImpact,
        requestState: 'PENDING',
        assignedOwnerRef: 'TENANT_ADMIN',
        requestedUntil: body.requestedUntil ?? null,
        decisionReason: null,
        decisionEvidenceRef: null,
        decidedBy: null,
        decidedAt: null,
        createdAt: '2026-08-13T00:00:00Z',
        updatedAt: '2026-08-13T00:00:00Z',
        version: 0,
      };
      preferenceExceptions = [request, ...preferenceExceptions];
      return fulfillSuccess(route, request);
    }
    if (
      path.startsWith('/api/platform/v1/personal-preferences/exceptions/') &&
      path.endsWith('/cancel')
    ) {
      const requestId = path.split('/').at(-2) ?? '';
      const request = preferenceExceptions.find((candidate) => candidate.requestId === requestId);
      if (!request) return route.fulfill({ status: 404 });
      const cancelled: PreferenceExceptionRequest = {
        ...request,
        requestState: 'CANCELLED',
        updatedAt: '2026-08-13T00:05:00Z',
        version: request.version + 1,
      };
      preferenceExceptions = preferenceExceptions.map((candidate) =>
        candidate.requestId === requestId ? cancelled : candidate
      );
      return fulfillSuccess(route, cancelled);
    }
    if (path === '/api/platform/v1/admin/preference-exceptions') {
      return fulfillSuccess(route, preferenceExceptions);
    }
    if (
      path.startsWith('/api/platform/v1/admin/preference-exceptions/') &&
      path.endsWith('/decision')
    ) {
      const requestId = path.split('/').at(-2) ?? '';
      const request = preferenceExceptions.find((candidate) => candidate.requestId === requestId);
      if (!request) return route.fulfill({ status: 404 });
      const body = route.request().postDataJSON() as {
        decision: 'APPROVED' | 'REJECTED';
        reason: string;
        evidenceRef?: string;
      };
      const decided: PreferenceExceptionRequest = {
        ...request,
        requestState: body.decision,
        decisionReason: body.reason,
        decisionEvidenceRef: body.evidenceRef ?? null,
        decidedBy: 1,
        decidedAt: '2026-08-13T00:10:00Z',
        updatedAt: '2026-08-13T00:10:00Z',
        version: request.version + 1,
      };
      preferenceExceptions = preferenceExceptions.map((candidate) =>
        candidate.requestId === requestId ? decided : candidate
      );
      return fulfillSuccess(route, decided);
    }
    if (path === '/api/platform/v1/admin/localization') {
      return fulfillSuccess(route, localizationWorkspace());
    }
    if (
      path ===
      `/api/platform/v1/admin/localization/bundles/${localizationRevision.bundleId}/revisions`
    ) {
      return fulfillSuccess(route, [localizationRevision]);
    }
    if (
      path ===
      `/api/platform/v1/admin/localization/revisions/${localizationRevision.revisionId}/diff`
    ) {
      return fulfillSuccess(route, {
        revisionId: localizationRevision.revisionId,
        comparedWithRevisionId: localizationRevision.basedOnRevisionId,
        added: 0,
        updated: 2,
        removed: 0,
        unchanged: 0,
        entries: Object.keys(localizationRevision.sourceEntries).map((key) => ({
          key,
          changeType: 'UPDATED',
          sourceValue: localizationRevision.sourceEntries[key],
          beforeValue: key === 'shell.welcome' ? '{{name}}님, 안녕하세요' : '새 업무가 없습니다.',
          afterValue: localizationRevision.entries[key],
          fallback: false,
        })),
      });
    }
    if (
      path === `/api/platform/v1/admin/localization/revisions/${localizationRevision.revisionId}` &&
      route.request().method() === 'PUT'
    ) {
      const body = route.request().postDataJSON() as {
        sourceEntries: Record<string, string>;
        entries: Record<string, string>;
        changeSummary: string;
      };
      localizationRevision = {
        ...localizationRevision,
        sourceEntries: body.sourceEntries,
        entries: body.entries,
        changeSummary: body.changeSummary,
        contentSha256: 'd'.repeat(64),
        version: localizationRevision.version + 1,
        updatedAt: '2026-08-13T00:10:00Z',
        preview: localizationPreview(body.sourceEntries, body.entries),
      };
      return fulfillSuccess(route, localizationRevision);
    }
    if (
      path ===
      `/api/platform/v1/admin/localization/revisions/${localizationRevision.revisionId}/submit`
    ) {
      const body = route.request().postDataJSON() as { reason: string };
      localizationRevision = {
        ...localizationRevision,
        lifecycleState: 'IN_REVIEW',
        submittedBy: 1,
        submittedAt: '2026-08-13T00:12:00Z',
        version: localizationRevision.version + 1,
        updatedAt: '2026-08-13T00:12:00Z',
        decisions: [
          ...localizationRevision.decisions,
          {
            decisionId: `localization-decision-${localizationRevision.decisions.length + 1}`,
            previousState: 'DRAFT',
            decision: 'SUBMITTED',
            reason: body.reason,
            actorId: 1,
            decidedAt: '2026-08-13T00:12:00Z',
          },
        ],
      };
      return fulfillSuccess(route, localizationRevision);
    }
    if (
      path ===
      `/api/platform/v1/admin/localization/revisions/${localizationRevision.revisionId}/decision`
    ) {
      const body = route.request().postDataJSON() as {
        decision: 'APPROVED' | 'REJECTED';
        reason: string;
      };
      localizationRevision = {
        ...localizationRevision,
        lifecycleState: body.decision,
        decidedBy: 1,
        decidedAt: '2026-08-13T00:15:00Z',
        version: localizationRevision.version + 1,
        updatedAt: '2026-08-13T00:15:00Z',
        decisions: [
          ...localizationRevision.decisions,
          {
            decisionId: `localization-decision-${localizationRevision.decisions.length + 1}`,
            previousState: 'IN_REVIEW',
            decision: body.decision,
            reason: body.reason,
            actorId: 1,
            decidedAt: '2026-08-13T00:15:00Z',
          },
        ],
      };
      return fulfillSuccess(route, localizationRevision);
    }
    if (
      path ===
      `/api/platform/v1/admin/localization/revisions/${localizationRevision.revisionId}/publish`
    ) {
      const body = route.request().postDataJSON() as { reason: string };
      localizationRevision = {
        ...localizationRevision,
        lifecycleState: 'PUBLISHED',
        publishedBy: 1,
        publishedAt: '2026-08-13T00:18:00Z',
        version: localizationRevision.version + 1,
        updatedAt: '2026-08-13T00:18:00Z',
        decisions: [
          ...localizationRevision.decisions,
          {
            decisionId: `localization-decision-${localizationRevision.decisions.length + 1}`,
            previousState: 'APPROVED',
            decision: 'PUBLISHED',
            reason: body.reason,
            actorId: 1,
            decidedAt: '2026-08-13T00:18:00Z',
          },
        ],
      };
      return fulfillSuccess(route, localizationRevision);
    }
    if (
      path === '/api/platform/v1/personal-preferences' ||
      path === '/api/platform/v1/personal-preferences/reset'
    ) {
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
    if (path === '/api/platform/v1/home/overview') {
      return fulfillSuccess(route, createHomeOverviewFixture(roles));
    }
    const recommendationFeedbackMatch = path.match(
      /^\/api\/platform\/v1\/home\/recommendations\/([^/]+)\/feedback$/u
    );
    if (recommendationFeedbackMatch) {
      const body = request.postDataJSON() as {
        feedbackType: 'HELPFUL' | 'NOT_RELEVANT' | 'DISMISSED';
      };
      return fulfillSuccess(route, {
        recommendationKey: decodeURIComponent(recommendationFeedbackMatch[1] ?? ''),
        feedbackType: body.feedbackType,
        ruleVersion: 'home-rules-2026.08',
        recordedAt: '2026-08-14T00:30:00Z',
      });
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
        version: 0,
      });
    }
    if (path === '/api/platform/v1/home-preferences') {
      if (request.method() === 'GET') {
        return fulfillSuccess(route, homeSurfaces['workspace-home']);
      }
      const body = request.postDataJSON() as {
        layout: MockHomeSurface['layout'];
        version: number;
      };
      const current = homeSurfaces['workspace-home'];
      if (body.version !== current.version) {
        return route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'ERROR', message: 'Version conflict' }),
        });
      }
      homeSurfaces['workspace-home'] = {
        ...current,
        customized: true,
        layout: body.layout,
        version: current.customized ? current.version + 1 : 0,
        updatedAt: '2026-08-14T00:00:00Z',
      };
      return fulfillSuccess(route, homeSurfaces['workspace-home']);
    }
    if (path === '/api/platform/v1/home-preferences/reset') {
      homeSurfaces['workspace-home'] = structuredClone(defaultHomeSurfaces['workspace-home']);
      return fulfillSuccess(route, homeSurfaces['workspace-home']);
    }
    const homeSurfaceMatch = path.match(
      /^\/api\/platform\/v1\/home-preferences\/surfaces\/(workspace-home|hcm-home|hris-home|approval-home)(\/reset)?$/u
    );
    if (homeSurfaceMatch) {
      const requestedSurfaceKey = homeSurfaceMatch[1];
      const surfaceKey = (
        requestedSurfaceKey === 'hris-home' ? 'hcm-home' : requestedSurfaceKey
      ) as MockHomeSurface['surfaceKey'];
      if (request.method() === 'GET') return fulfillSuccess(route, homeSurfaces[surfaceKey]);
      if (homeSurfaceMatch[2] === '/reset') {
        homeSurfaces[surfaceKey] = structuredClone(defaultHomeSurfaces[surfaceKey]);
        return fulfillSuccess(route, homeSurfaces[surfaceKey]);
      }
      const body = request.postDataJSON() as {
        layout: MockHomeSurface['layout'];
        version: number;
      };
      const current = homeSurfaces[surfaceKey];
      if (body.version !== current.version) {
        return route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'ERROR', message: 'Version conflict' }),
        });
      }
      homeSurfaces[surfaceKey] = {
        ...current,
        customized: true,
        layout: body.layout,
        version: current.customized ? current.version + 1 : 0,
        updatedAt: '2026-08-14T00:00:00Z',
      };
      return fulfillSuccess(route, homeSurfaces[surfaceKey]);
    }
    if (path === '/api/platform/v1/announcements') {
      return fulfillSuccess(route, []);
    }
    if (path === '/api/platform/v1/communications') {
      return fulfillSuccess(route, {
        featured: null,
        items: [],
        summary: { total: 0, unread: 0, required: 0, saved: 0 },
        generatedAt: '2026-08-11T00:20:00Z',
      });
    }
    if (path === '/api/platform/v1/admin/services/catalog') {
      return fulfillSuccess(route, []);
    }
    if (path === '/api/platform/v1/services/catalog') {
      return fulfillSuccess(route, HR_SERVICE_CATALOG_FIXTURE);
    }
    if (path === '/api/platform/v1/services/requests') {
      return fulfillSuccess(route, HR_SERVICE_REQUESTS_FIXTURE);
    }
    if (path === '/api/platform/v1/admin/services/requests') {
      return fulfillSuccess(route, []);
    }
    if (path === '/api/platform/v1/calendar/home') {
      return fulfillSuccess(route, CALENDAR_HOME_FIXTURE);
    }
    if (path === '/api/platform/v1/calendar/calendars') {
      return fulfillSuccess(route, CALENDAR_SUMMARIES_FIXTURE);
    }
    if (path === '/api/platform/v1/calendar/events') {
      return fulfillSuccess(
        route,
        request.method() === 'GET'
          ? [CALENDAR_EVENT_FIXTURE, CALENDAR_FOCUS_FIXTURE]
          : CALENDAR_EVENT_FIXTURE
      );
    }
    if (/^\/api\/platform\/v1\/calendar\/events\/[^/]+$/u.test(path)) {
      const body = request.postDataJSON() as Record<string, unknown> | null;
      const source = path.includes(CALENDAR_FOCUS_FIXTURE.eventId)
        ? CALENDAR_FOCUS_FIXTURE
        : CALENDAR_EVENT_FIXTURE;
      return fulfillSuccess(route, { ...source, ...(body ?? {}), version: source.version + 1 });
    }
    if (/^\/api\/platform\/v1\/calendar\/events\/[^/]+\/response$/u.test(path)) {
      return fulfillSuccess(route, CALENDAR_EVENT_FIXTURE);
    }
    if (/^\/api\/platform\/v1\/calendar\/events\/[^/]+\/cancel$/u.test(path)) {
      return fulfillSuccess(route, null);
    }
    if (path === '/api/platform/v1/calendar/resources') {
      return fulfillSuccess(route, CALENDAR_RESOURCES_FIXTURE);
    }
    if (path === '/api/platform/v1/calendar/availability') {
      return fulfillSuccess(route, CALENDAR_AVAILABILITY_FIXTURE);
    }
    if (path === '/api/platform/v1/rooms/availability') {
      return fulfillSuccess(route, {
        rooms: CALENDAR_RESOURCES_FIXTURE.filter((resource) => resource.type === 'ROOM'),
        occupancy: [
          {
            resourceId: CALENDAR_RESOURCES_FIXTURE[0].resourceId,
            startsAt: ROOM_BOOKING_EVENT_FIXTURE.startsAt,
            endsAt: ROOM_BOOKING_EVENT_FIXTURE.endsAt,
            bookingStatus: 'CONFIRMED',
          },
        ],
        generatedAt: '2026-08-19T00:20:00Z',
      });
    }
    if (path === '/api/platform/v1/rooms/bookings') {
      return fulfillSuccess(
        route,
        request.method() === 'GET' ? [ROOM_BOOKING_EVENT_FIXTURE] : ROOM_BOOKING_EVENT_FIXTURE
      );
    }
    if (/^\/api\/platform\/v1\/rooms\/bookings\/[^/]+$/u.test(path)) {
      return fulfillSuccess(route, ROOM_BOOKING_EVENT_FIXTURE);
    }
    if (/^\/api\/platform\/v1\/rooms\/bookings\/[^/]+\/(response|cancel)$/u.test(path)) {
      return fulfillSuccess(route, path.endsWith('/cancel') ? null : ROOM_BOOKING_EVENT_FIXTURE);
    }
    if (path === '/api/platform/v1/admin/calendar/overview') {
      return fulfillSuccess(route, CALENDAR_ADMIN_FIXTURE);
    }
    if (path === '/api/platform/v1/admin/calendar/bookings/pending') {
      return fulfillSuccess(route, CALENDAR_BOOKINGS_FIXTURE);
    }
    if (path === '/api/platform/v1/admin/rooms/overview') {
      return fulfillSuccess(route, {
        ...CALENDAR_ADMIN_FIXTURE,
        resources: CALENDAR_RESOURCES_FIXTURE.filter((resource) => resource.type === 'ROOM'),
      });
    }
    if (path === '/api/platform/v1/admin/rooms/bookings/pending') {
      return fulfillSuccess(route, CALENDAR_BOOKINGS_FIXTURE);
    }
    if (path === '/api/platform/v1/admin/rooms/policy') {
      return fulfillSuccess(route, CALENDAR_ADMIN_FIXTURE.policy);
    }
    if (path === '/api/platform/v1/admin/rooms/resources') {
      return fulfillSuccess(route, CALENDAR_RESOURCES_FIXTURE[0]);
    }
    if (/^\/api\/platform\/v1\/admin\/rooms\/resources\/[^/]+$/u.test(path)) {
      return fulfillSuccess(route, CALENDAR_RESOURCES_FIXTURE[0]);
    }
    if (/^\/api\/platform\/v1\/admin\/rooms\/bookings\/[^/]+\/decision$/u.test(path)) {
      return fulfillSuccess(route, CALENDAR_BOOKINGS_FIXTURE[0]);
    }
    if (path === '/api/approvals/v1/home') {
      return fulfillSuccess(route, APPROVAL_HOME_FIXTURE);
    }
    if (path === '/api/approvals/v1/tasks') {
      return fulfillSuccess(route, [APPROVAL_TASK_FIXTURE]);
    }
    if (/^\/api\/approvals\/v1\/tasks\/[^/]+$/u.test(path)) {
      return fulfillSuccess(route, APPROVAL_TASK_DETAIL_FIXTURE);
    }
    if (path === '/api/approvals/v1/requests') {
      return fulfillSuccess(route, [APPROVAL_REQUEST_FIXTURE]);
    }
    if (/^\/api\/approvals\/v1\/requests\/[^/]+\/detail$/u.test(path)) {
      return fulfillSuccess(route, APPROVAL_REQUEST_DETAIL_FIXTURE);
    }
    if (/^\/api\/approvals\/v1\/requests\/[^/]+$/u.test(path)) {
      return fulfillSuccess(route, APPROVAL_REQUEST_FIXTURE);
    }
    if (path === '/api/approvals/v1/workflows/published') {
      return fulfillSuccess(route, [APPROVAL_WORKFLOW_FIXTURE]);
    }
    if (/^\/api\/approvals\/v1\/workflows\/published\/[^/]+\/template$/u.test(path)) {
      return fulfillSuccess(route, {
        workflow: APPROVAL_WORKFLOW_FIXTURE,
        form: APPROVAL_FORM_DETAIL_FIXTURE,
      });
    }
    if (path === '/api/approvals/v1/delegations') {
      return fulfillSuccess(route, APPROVAL_DELEGATIONS_FIXTURE);
    }
    if (path === '/api/approvals/v1/admin/overview') {
      return fulfillSuccess(route, APPROVAL_ADMIN_FIXTURE);
    }
    if (path === '/api/approvals/v1/admin/workflows') {
      return fulfillSuccess(route, [APPROVAL_WORKFLOW_FIXTURE]);
    }
    if (/^\/api\/approvals\/v1\/admin\/workflows\/[^/]+$/u.test(path)) {
      return fulfillSuccess(route, APPROVAL_WORKFLOW_DETAIL_FIXTURE);
    }
    if (path === '/api/approvals/v1/admin/forms') {
      return fulfillSuccess(route, [APPROVAL_FORM_FIXTURE]);
    }
    if (/^\/api\/approvals\/v1\/admin\/forms\/[^/]+$/u.test(path)) {
      return fulfillSuccess(route, APPROVAL_FORM_DETAIL_FIXTURE);
    }
    if (path === '/api/approvals/v1/admin/policies') {
      return fulfillSuccess(route, APPROVAL_POLICIES_FIXTURE);
    }
    if (path === '/api/approvals/v1/admin/operations') {
      return fulfillSuccess(route, APPROVAL_OPERATIONS_FIXTURE);
    }
    if (path === '/api/approvals/v1/admin/signatures') {
      return fulfillSuccess(route, APPROVAL_SIGNATURE_FIXTURES);
    }
    if (path === '/api/people/v1/hr/home') {
      return fulfillSuccess(route, HR_HOME_FIXTURE);
    }
    if (path === '/api/people/v1/hr/time') {
      return fulfillSuccess(route, HR_TIME_FIXTURE);
    }
    if (path === '/api/people/v1/hr/absence') {
      return fulfillSuccess(route, HR_ABSENCE_FIXTURE);
    }
    if (path === '/api/people/v1/hr/benefits') {
      return fulfillSuccess(route, HR_BENEFITS_FIXTURE);
    }
    if (path === '/api/people/v1/hr/pay') {
      return fulfillSuccess(route, HR_PAY_FIXTURE);
    }
    if (path === '/api/people/v1/hr/talent') {
      return fulfillSuccess(route, HR_TALENT_FIXTURE);
    }
    const hrOperationsMatch = path.match(
      /^\/api\/people\/v1\/hr\/operations\/(time|absence|benefits|pay|talent)$/u
    );
    if (hrOperationsMatch) {
      return fulfillSuccess(
        route,
        hrDomainOperationsFixture(
          hrOperationsMatch[1].toUpperCase() as Parameters<typeof hrDomainOperationsFixture>[0]
        )
      );
    }
    const sessionDisplayName =
      options.displayName ?? (provider ? 'Provider Admin' : 'Tenant Admin');
    const sessionEmail =
      options.email ?? (provider ? 'provider.admin@dwp.local' : 'tenant.admin@dwp.local');
    const sessionPerson = {
      personId: 'person-session-user',
      displayName: sessionDisplayName,
      lifecycleState: 'ACTIVE',
      workerNumber: null,
      workerType: 'EMPLOYEE',
      workerStatus: 'ACTIVE',
      assignmentKey: 'ASG-SESSION-USER',
      businessTitle:
        options.jobTitle ?? (provider ? 'Platform operations lead' : 'Tenant administrator'),
      organizationId: 'org-skax',
      organizationKey: 'SKAX',
      organizationName: 'SKAX',
      jobProfileName: options.jobTitle ?? 'Tenant administrator',
      managementLevel: roles.includes('MANAGER') ? 'MANAGER' : 'INDIVIDUAL_CONTRIBUTOR',
      jobGradeKey: null,
      jobGradeName: null,
      locationKey: 'SEOUL-HQ',
      locationName: 'Seoul HQ',
      workEmail: sessionEmail,
      profileImageKey: null,
      assignmentEffectiveFrom: '2026-01-01',
      managerPersonId: null,
      managerDisplayName: null,
      directReportCount: roles.includes('MANAGER') ? 2 : 0,
      dataAccess: {
        classification: 'DIRECTORY',
        workerNumberMasked: true,
        excludedFieldGroups: [],
      },
    };
    if (path === '/api/people/v1/people') {
      return fulfillSuccess(route, {
        items: url.searchParams.get('query') ? [sessionPerson] : [],
        nextCursor: null,
        size: 100,
        hasMore: false,
        asOf: '2026-08-11',
      });
    }
    if (path === `/api/people/v1/people/${sessionPerson.personId}`) {
      return fulfillSuccess(route, {
        person: sessionPerson,
        originalHireDate: '2026-01-01',
        legalEmployerName: 'SKAX',
        managerAssignmentKey: null,
        assignments: [
          {
            assignmentKey: 'ASG-SESSION-USER',
            assignmentStatus: 'ACTIVE',
            primaryAssignment: true,
            effectiveStartDate: '2026-01-01',
            businessTitle: sessionPerson.businessTitle,
            organizationName: 'SKAX',
            jobProfileName: sessionPerson.jobProfileName,
            jobGradeName: null,
            locationName: 'Seoul HQ',
            managerAssignmentKey: null,
            changeReasonCode: null,
          },
        ],
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
    if (path === '/api/people/v1/workforce/exports/datasets') {
      return fulfillSuccess(route, [
        {
          datasetKey: 'ORGANIZATION_INTELLIGENCE',
          name: 'Organization intelligence',
          description: 'Organization health, comparison, and data-quality decision evidence.',
          requiredFieldGroups: ['DIRECTORY'],
          allowedSelectionKeys: ['view', 'asOf', 'compareTo', 'scenarioId', 'rootOrganizationId'],
          version: 2,
        },
        {
          datasetKey: 'WORKFORCE_DIRECTORY',
          name: 'Workforce directory',
          description: 'Governed workforce directory rows within the resolved population.',
          requiredFieldGroups: ['DIRECTORY', 'EMPLOYMENT'],
          allowedSelectionKeys: [
            'query',
            'status',
            'organization',
            'location',
            'grade',
            'role',
            'asOf',
          ],
          version: 1,
        },
        {
          datasetKey: 'ASSIGNMENT_REGISTER',
          name: 'Assignment register',
          description: 'Effective-dated worker and assignment records.',
          requiredFieldGroups: ['DIRECTORY', 'WORKER_IDENTIFIERS', 'EMPLOYMENT'],
          allowedSelectionKeys: ['organization', 'status', 'asOf'],
          version: 1,
        },
      ]);
    }
    if (
      path === '/api/people/v1/workforce/exports/preview' &&
      route.request().method() === 'POST'
    ) {
      const body = route.request().postDataJSON() as {
        datasetKey: string;
      };
      return fulfillSuccess(route, {
        authorized: true,
        executionEnabled: false,
        datasetKey: body.datasetKey,
        allowedSelectionKeys: [],
        populationType: 'TENANT',
        organizationIds: [],
        fieldGroups: ['DIRECTORY', 'WORKER_IDENTIFIERS', 'EMPLOYMENT', 'JOB_GRADE'],
        exportFormat: 'CSV',
        maskingProfile: 'WORKFORCE_MINIMUM',
        watermarkTemplate: 'DWP confidential | request={{requestId}}',
        artifactTtlHours: 24,
        maximumAttempts: 5,
        maximumManualRetries: 1,
        blockers: ['D-09', 'D-12'],
        message: 'Execution remains blocked until release decisions are approved.',
        evaluatedAt: '2026-08-13T01:00:00Z',
      });
    }
    if (path === '/api/people/v1/workforce/exports' && route.request().method() === 'GET') {
      return fulfillSuccess(route, []);
    }
    if (
      path.startsWith('/api/people/v1/workforce/exports/') &&
      path.endsWith('/attempts') &&
      route.request().method() === 'GET'
    ) {
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
        content: [
          {
            userId: 1,
            displayName: options.displayName ?? 'Tenant Admin',
            email: options.email ?? 'tenant.admin@dwp.local',
            status: 'ACTIVE',
            mfaEnabled: true,
            roles: ['TENANT_ADMIN'],
            directRoles: ['TENANT_ADMIN'],
            inheritedRoles: [],
            effectiveRoles: ['TENANT_ADMIN'],
            effectiveAccess: [
              {
                roleId: 1,
                roleCode: 'TENANT_ADMIN',
                roleName: 'Tenant administrator',
                privileged: true,
                sourceType: 'DIRECT',
                sourceId: 1,
                sourceKey: 'TENANT_ADMIN',
                sourceName: 'Direct assignment',
                assignmentType: 'DIRECT',
                scopeType: 'TENANT',
                scopeRef: null,
                validFrom: null,
                validTo: null,
                assignedAt: '2026-08-11T00:00:00Z',
              },
            ],
            groupIds: [],
            roleManagement: { allowed: false, reason: 'SELF' },
            accessRevision: 1,
            version: 0,
            updatedAt: '2026-08-11T00:00:00Z',
            updatedBy: 1,
          },
        ],
        page: 0,
        size: 25,
        totalElements: 1,
        totalPages: 1,
      });
    }
    if (path === '/api/people/v1/admin/workforce/access-policies/organizations') {
      return fulfillSuccess(route, [
        {
          organizationId: '55000000-0000-0000-0000-000000000001',
          organizationKey: 'SKAX',
          name: 'SKAX',
          parentOrganizationId: null,
        },
        {
          organizationId: '55000000-0000-0000-0000-000000000002',
          organizationKey: 'PLATFORM',
          name: 'Digital Workplace Platform',
          parentOrganizationId: '55000000-0000-0000-0000-000000000001',
        },
      ]);
    }
    if (path === '/api/people/v1/admin/workforce/access-policies') {
      return fulfillSuccess(route, [
        {
          policyId: '56000000-0000-0000-0000-000000000001',
          subjectType: 'ROLE',
          subjectRef: 'HR_ADMIN',
          populationType: 'ORG_TREE',
          organizationId: '55000000-0000-0000-0000-000000000002',
          organizationName: 'Digital Workplace Platform',
          fieldGroups: ['DIRECTORY', 'EMPLOYMENT'],
          actionCodes: ['READ', 'EXPORT'],
          validFrom: '2026-08-01T00:00:00Z',
          validTo: '2026-12-31T00:00:00Z',
          lifecycleState: 'ACTIVE',
          justification: 'Approved workforce operating boundary for the HR administration role.',
          version: 1,
        },
      ]);
    }
    if (path === '/api/platform/v1/admin/saved-view-ownership/orphaned') {
      return fulfillSuccess(route, [
        {
          savedViewId: '57000000-0000-0000-0000-000000000001',
          surfaceKey: 'WORKFORCE_OVERVIEW',
          name: 'Quarterly workforce risk review',
          scope: 'TEAM',
          ownerGroupRef: 'group-people-operations',
          retentionUntil: '2026-09-30T00:00:00Z',
          updatedAt: '2026-08-10T03:00:00Z',
        },
      ]);
    }
    if (path === '/api/platform/v1/admin/saved-view-ownership/transfers') {
      return fulfillSuccess(route, [
        {
          transferBatchId: '58000000-0000-0000-0000-000000000001',
          sourceOwnerUserId: 42,
          targetOwnerUserId: 1,
          disposition: 'TRANSFER',
          reasonCode: 'OFFBOARDING',
          sourceReference: 'HR-OFFBOARDING-2026-0810',
          retentionUntil: null,
          transferredCount: 4,
          createdAt: '2026-08-10T03:10:00Z',
          createdBy: 1,
        },
      ]);
    }
    if (path === '/api/auth/admin/identity/roles') {
      return fulfillSuccess(route, []);
    }
    if (path === '/api/auth/admin/access/app-governance') {
      return fulfillSuccess(route, {
        metrics: {
          activeAssignments: 0,
          pendingApprovals: 0,
          reviewsDueSoon: 0,
          resourcesWithoutOwner: 0,
        },
        responsibilities: [],
        principals: [],
        resourceSets: [],
        assignments: [],
      });
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
    if (path === '/api/platform/v1/admin/catalog/assurance') {
      return fulfillSuccess(route, CATALOG_ASSURANCE_FIXTURE);
    }
    if (path === '/api/platform/v1/admin/catalog/assurance/evaluate') {
      return fulfillSuccess(route, CATALOG_ASSURANCE_FIXTURE);
    }
    if (
      path.startsWith('/api/platform/v1/admin/catalog/assurance/findings/') &&
      path.endsWith('/disposition')
    ) {
      const body = route.request().postDataJSON() as {
        decision: string;
        reason: string;
        evidenceRef?: string;
        version: number;
      };
      return fulfillSuccess(route, {
        ...CATALOG_ASSURANCE_FINDING_FIXTURE,
        lifecycleState: body.decision,
        dispositionReason: body.reason,
        dispositionEvidenceRef: body.evidenceRef ?? null,
        disposedBy: 1,
        disposedAt: '2026-08-12T00:25:00Z',
        version: body.version + 1,
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
        activeRevisionId: '51000000-0000-0000-0000-000000000001',
        activeRevisionNumber: 1,
      });
    }
    if (path === '/api/platform/v1/admin/audit-control/policy/revisions') {
      return fulfillSuccess(route, [
        {
          revisionId: '51000000-0000-0000-0000-000000000001',
          revisionNumber: 1,
          lifecycleState: 'PUBLISHED',
          standardRetentionDays: 365,
          extendedRetentionDays: 2555,
          exportLimitRows: 10000,
          requireExportReason: true,
          integrityEnabled: true,
          highRiskThreshold: 70,
          changeReason: 'Initial governed baseline',
          diff: {},
          contentSha256: 'a'.repeat(64),
          createdBy: 'system',
          createdAt: '2026-08-11T00:00:00Z',
          publishedBy: 'system',
          publishedAt: '2026-08-11T00:00:00Z',
          version: 0,
          approval: null,
        },
      ]);
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
          'SUPPORT_ACCESS_REVIEW',
          'SUPPORT_POST_REVIEW',
          'BREAK_GLASS_SUPPORT',
          'COMMERCIAL_READ',
          'COMMERCIAL_WRITE',
          'COMMERCIAL_APPROVE',
          'CATALOG_READ',
          'DATA_GOVERNANCE_READ',
          'DATA_GOVERNANCE_WRITE',
          'FEATURE_ROLLOUT_READ',
          'FEATURE_ROLLOUT_WRITE',
          'FEATURE_ROLLOUT_APPROVE',
          'AUDIT_READ',
        ],
      });
    }
    if (path === '/api/provider/v1/admin/feature-rollouts/flags') {
      return fulfillSuccess(route, [
        {
          featureFlagId: '59000000-0000-0000-0000-000000000001',
          featureKey: 'WORKFORCE_EXPORT_V2',
          displayName: 'Governed workforce export',
          description: 'Controls the governed workforce export request experience.',
          ownerService: 'dwp-people-server',
          valueType: 'BOOLEAN',
          defaultValue: false,
          configurationSchema: { type: 'boolean' },
          riskTier: 'L2',
          lifecycleState: 'ACTIVE',
          version: 1,
        },
      ]);
    }
    if (path === '/api/provider/v1/admin/feature-rollouts') {
      return fulfillSuccess(route, [
        {
          rolloutRevisionId: '5a000000-0000-0000-0000-000000000001',
          featureFlagId: '59000000-0000-0000-0000-000000000001',
          featureKey: 'WORKFORCE_EXPORT_V2',
          revisionNumber: 3,
          name: 'Pilot ring rollout',
          lifecycleState: 'PENDING_APPROVAL',
          rolloutValue: true,
          targeting: { serviceTier: ['ENTERPRISE'], region: ['ap-northeast-2'] },
          strategy: 'RING',
          currentStageOrder: null,
          previousRevisionId: '5a000000-0000-0000-0000-000000000000',
          rollbackOfRevisionId: null,
          justification: 'Enable the governed experience for approved design partners.',
          requestedBy: 1,
          approvedBy: null,
          submittedAt: '2026-08-11T00:05:00Z',
          approvedAt: null,
          activatedAt: null,
          completedAt: null,
          pausedAt: null,
          version: 2,
          stages: [
            {
              rolloutStageId: '5b000000-0000-0000-0000-000000000001',
              stageOrder: 1,
              stageName: 'Design partners',
              exposurePercentage: 5,
              minimumObservationMinutes: 60,
              healthGate: { maxErrorRate: 1, maxP95LatencyMs: 800 },
              lifecycleState: 'PENDING',
              startedAt: null,
              completedAt: null,
            },
            {
              rolloutStageId: '5b000000-0000-0000-0000-000000000002',
              stageOrder: 2,
              stageName: 'Enterprise ring',
              exposurePercentage: 25,
              minimumObservationMinutes: 180,
              healthGate: { maxErrorRate: 1, maxP95LatencyMs: 800 },
              lifecycleState: 'PENDING',
              startedAt: null,
              completedAt: null,
            },
          ],
          approval: {
            approvalId: '5c000000-0000-0000-0000-000000000001',
            lifecycleState: 'PENDING',
            requestedBy: 1,
            requestedAt: '2026-08-11T00:05:00Z',
            decidedBy: null,
            decidedAt: null,
            decisionReason: null,
          },
          externalExecutionEnabled: false,
        },
      ]);
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
    if (path === '/api/provider/v1/admin/support-access-requests') {
      return fulfillSuccess(route, [
        {
          supportAccessRequestId: 'support-request-pending',
          tenantId: 'tenant-skax',
          tenantKey: 'skax-production',
          tenantName: 'SKAX Production',
          requesterOperatorId: 2,
          requesterName: 'Provider Support Engineer',
          lifecycleState: 'PENDING_APPROVAL',
          accessMode: 'STANDARD',
          justification: 'Investigate the customer-approved workspace latency case.',
          scopes: ['TENANT_CONFIGURATION_WRITE'],
          durationMinutes: 30,
          approvalReference: 'SKAX-CASE-2408',
          customerApprovalRequired: true,
          riskTier: 'L3',
          requestKey: 'support-case-2408',
          requestedAt: '2026-08-11T00:00:00Z',
          decisionDueAt: '2026-08-12T00:00:00Z',
          postReviewState: 'NOT_REQUIRED',
          version: 0,
        },
        {
          supportAccessRequestId: 'support-request-review',
          tenantId: 'tenant-skax',
          tenantKey: 'skax-production',
          tenantName: 'SKAX Production',
          requesterOperatorId: 2,
          requesterName: 'Provider Support Engineer',
          lifecycleState: 'COMPLETED',
          accessMode: 'STANDARD',
          justification: 'Validate the tenant configuration after the approved change.',
          scopes: ['TENANT_CONFIGURATION_WRITE'],
          durationMinutes: 15,
          approvalReference: 'SKAX-CASE-2401',
          customerApprovalRequired: true,
          riskTier: 'L3',
          requestKey: 'support-case-2401',
          requestedAt: '2026-08-10T21:00:00Z',
          decisionDueAt: '2026-08-11T21:00:00Z',
          decidedAt: '2026-08-10T21:05:00Z',
          decidedBy: 1,
          decidedByName: 'Provider Admin',
          decisionReason: 'Customer evidence and least privilege confirmed.',
          supportSessionId: 'support-session-history',
          activatedAt: '2026-08-10T21:10:00Z',
          completedAt: '2026-08-10T21:25:00Z',
          postReviewState: 'PENDING',
          version: 3,
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
            version: 2,
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
    if (path === '/api/provider/v1/admin/subscription-renewals') {
      const request = route.request();
      const pending = {
        renewalRevisionId: 'renewal-pending',
        subscriptionId: 'subscription-skax',
        organizationId: 'organization-skax',
        organizationKey: 'SKAX',
        organizationName: 'SKAX',
        revisionNumber: 2,
        lifecycleState: 'PENDING_APPROVAL',
        baselineSubscriptionVersion: 2,
        currentPlanKey: 'enterprise',
        currentPlanName: 'Enterprise',
        targetPlanKey: 'regulated',
        targetPlanName: 'Regulated enterprise',
        targetServiceTier: 'REGULATED',
        currentEndsAt: '2027-01-01T00:00:00Z',
        proposedEndsAt: '2028-01-01T00:00:00Z',
        currentContractReference: 'SKAX-2026-001',
        proposedContractReference: 'SKAX-2027-001',
        reason: 'Renew the regulated service package after security and commercial review.',
        addedEntitlements: ['premium-audit'],
        removedEntitlements: [],
        impactedTenants: 1,
        currentEntitlementCount: 8,
        projectedEntitlementCount: 9,
        contentSha256: 'b'.repeat(64),
        requestKey: 'commercial-renewal-fixture',
        requestedBy: 2,
        requestedByName: 'Commercial Operations',
        requestedAt: '2026-08-11T00:00:00Z',
        decisionDueAt: '2026-08-13T00:00:00Z',
        executionState: 'NOT_STARTED',
        notificationState: 'DISABLED_PENDING_CONTRACT',
        version: 0,
      };
      if (request.method() === 'POST') {
        return fulfillSuccess(route, {
          ...pending,
          renewalRevisionId: 'renewal-created',
          revisionNumber: 3,
          requestedBy: 1,
          requestedByName: 'Provider Admin',
          reason: 'Renew the customer contract after commercial evidence review.',
        });
      }
      return fulfillSuccess(route, [
        pending,
        {
          ...pending,
          renewalRevisionId: 'renewal-published',
          revisionNumber: 1,
          lifecycleState: 'PUBLISHED',
          requestedAt: '2026-08-01T00:00:00Z',
          decisionDueAt: '2026-08-03T00:00:00Z',
          decidedBy: 1,
          decidedByName: 'Provider Admin',
          decidedAt: '2026-08-01T01:00:00Z',
          decisionReason: 'Independent commercial and security review completed.',
          publishedBy: 2,
          publishedByName: 'Commercial Operations',
          publishedAt: '2026-08-01T02:00:00Z',
          executionState: 'MANUAL_ACTION_REQUIRED',
          version: 2,
        },
      ]);
    }
    if (
      path.startsWith('/api/provider/v1/admin/subscription-renewals/') &&
      path.endsWith('/decision')
    ) {
      return fulfillSuccess(route, {
        renewalRevisionId: path.split('/').at(-2),
        lifecycleState: 'APPROVED',
        version: 1,
      });
    }
    if (
      path.startsWith('/api/provider/v1/admin/subscription-renewals/') &&
      path.endsWith('/publish')
    ) {
      return fulfillSuccess(route, {
        renewalRevisionId: path.split('/').at(-2),
        lifecycleState: 'PUBLISHED',
        executionState: 'MANUAL_ACTION_REQUIRED',
        notificationState: 'DISABLED_PENDING_CONTRACT',
        version: 2,
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
