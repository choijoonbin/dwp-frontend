import {
  HR_ABSENCE_FIXTURE,
  HR_BENEFITS_FIXTURE,
  HR_HOME_FIXTURE,
  HR_PAY_FIXTURE,
  HR_TALENT_FIXTURE,
  HR_TEAM_ABSENCE_FIXTURE,
  HR_TEAM_FIXTURE,
  HR_TEAM_TIME_FIXTURE,
  HR_TIME_FIXTURE,
  hrDomainOperationsFixture,
} from './product-area-fixtures';

const OBSERVED_AT = '2026-08-11T00:20:00Z';
const EMPTY_QUERY_STATE = {
  state: 'EMPTY',
  scopeDecisionRevision: 'scope:menu-route:1',
  freshness: 'CURRENT',
  nextCursor: null,
  fieldDecisionSummary: { viewCount: 0, maskedCount: 0, omittedCount: 0 },
  partialFailures: [],
  correlationId: '10000000-0000-4000-8000-000000000001',
  cachePolicy: {
    authorizationDecisionRevision: 'decision:menu-route:1',
    invalidationEvent: 'dwp.hris.access.assignment.changed.v1',
    maxAgeSeconds: 0,
  },
} as const;

const EXACT_HCM_FIXTURES: Readonly<Record<string, unknown>> = {
  '/api/people/v1/hr/home': HR_HOME_FIXTURE,
  '/api/people/v1/hr/time': HR_TIME_FIXTURE,
  '/api/people/v1/hr/absence': HR_ABSENCE_FIXTURE,
  '/api/people/v1/hr/team': HR_TEAM_FIXTURE,
  '/api/people/v1/hr/team/time': HR_TEAM_TIME_FIXTURE,
  '/api/people/v1/hr/team/absence': HR_TEAM_ABSENCE_FIXTURE,
  '/api/people/v1/hr/benefits': HR_BENEFITS_FIXTURE,
  '/api/people/v1/hr/pay': HR_PAY_FIXTURE,
  '/api/people/v1/hr/talent': HR_TALENT_FIXTURE,
  '/api/people/v1/workforce/operations/overview': {
    generatedAt: '2026-08-12T09:30:00Z',
    dataBoundary: 'TENANT',
    fieldGroups: ['DIRECTORY', 'EMPLOYMENT', 'JOB_GRADE'],
    domains: [
      {
        domain: 'TIME',
        pendingCount: 7,
        metrics: [
          { key: 'submitted', value: 18, severity: 'INFO' },
          { key: 'openExceptions', value: 3, severity: 'ATTENTION' },
        ],
      },
      {
        domain: 'ABSENCE',
        pendingCount: 2,
        metrics: [{ key: 'submitted', value: 2, severity: 'CRITICAL' }],
      },
    ],
  },
  '/api/time/v1/hris/work-plans': {
    queryState: 'EMPTY',
    freshness: 'CURRENT',
    asOf: '2026-08-11T00:20:00Z',
    partialFailures: [],
    workPlans: [],
  },
  '/api/payroll/v1/hris/payroll/foundation/configurations': {
    configurations: [],
    access: {
      canCreate: true,
      canEdit: true,
      canSimulate: true,
      canPublish: true,
      canReverse: true,
      canReconcile: true,
      publishDenialCode: null,
    },
    partialFailures: [],
  },
  '/api/people/v1/hris/performance/cycles': {
    cycles: [],
    allowedActions: ['CREATE_DRAFT'],
  },
  '/api/people/v1/hris/workbench/self-service/employment-documents': {
    asOf: OBSERVED_AT,
    documents: [],
  },
  '/api/people/v1/hris/workbench/operations/employment/assignments': {
    asOf: OBSERVED_AT,
    assignments: [],
  },
  '/api/time/v1/hris/workbench/clock-ingestion': {
    projectionVersion: '1',
    asOf: OBSERVED_AT,
    variantKey: 'CLOCK_INGESTION',
    queryState: EMPTY_QUERY_STATE,
    items: [],
  },
  '/api/time/v1/hris/workbench/time-exceptions': {
    projectionVersion: '1',
    asOf: OBSERVED_AT,
    variantKey: 'EXCEPTIONS',
    queryState: EMPTY_QUERY_STATE,
    items: [],
  },
  '/api/time/v1/hris/workbench/time-interpretation': {
    projectionVersion: '1',
    asOf: OBSERVED_AT,
    variantKey: 'INTERPRETATION',
    queryState: EMPTY_QUERY_STATE,
    items: [],
  },
  '/api/people/v1/hris/performance/workbench/review-operations': {
    projectionVersion: '1',
    asOf: OBSERVED_AT,
    variantKey: 'REVIEW_OPERATIONS',
    queryState: EMPTY_QUERY_STATE,
    items: [],
  },
  '/api/people/v1/hris/performance/compensation-planning/cycles': {
    items: [],
    nextCursor: null,
    hasMore: false,
    asOf: OBSERVED_AT,
    scopeRevision: 1,
    fieldPolicyRevision: 1,
  },
  '/api/payroll/v1/workbench/settings-payroll': {
    projectionVersion: '1',
    asOf: OBSERVED_AT,
    variantKey: 'PAYROLL',
    queryState: EMPTY_QUERY_STATE,
    items: [],
  },
  '/api/auth/hris/product-access/snapshot': {
    tenantId: 1,
    subjectId: 1,
    evaluatedAt: '2026-08-11T00:20:00Z',
    policyVersion: 'policy-1',
    evidenceVersion: 'evidence-1',
    state: 'ALLOWED',
    reasonCode: 'ALLOWED',
    roleGroups: ['CONFIGURATION_ADMIN'],
    grants: [
      {
        action: 'VIEW',
        resourceType: 'PRODUCT',
        resourceKey: 'UI.MENU.HRIS',
        scopeType: 'SELF',
        scopeKey: '1',
        mutable: false,
      },
      {
        action: 'VIEW',
        resourceType: 'PRODUCT',
        resourceKey: 'UI.WIDGET.HRIS',
        scopeType: 'SELF',
        scopeKey: '1',
        mutable: false,
      },
      {
        action: 'VIEW',
        resourceType: 'CONFIGURATION',
        resourceKey: 'HCM.CONFIGURATION_WORKBENCH',
        scopeType: 'TENANT',
        scopeKey: '1',
        mutable: false,
      },
    ],
    authority: {
      appEntitled: true,
      configurationAuthority: true,
      accessGovernanceAuthority: true,
      auditAuthority: true,
      readOnly: false,
      separationOfDutiesConflict: false,
      commandAuthorizationReusable: false,
    },
  },
  '/api/platform/v1/hris/configuration/projection': {
    tenantId: 1,
    subjectId: 1,
    evaluatedAt: '2026-08-11T00:20:00Z',
    projectionVersion: 'projection-1',
    state: 'COMPLETE',
    readOnly: false,
    commandAuthorizationReusable: false,
    allowedActions: ['VIEW', 'UPDATE', 'PUBLISH'],
    menus: [],
    widgets: [],
    sources: [
      { source: 'NAVIGATION', state: 'AVAILABLE', reasonCode: null },
      { source: 'HOME_TEMPLATE', state: 'AVAILABLE', reasonCode: null },
    ],
  },
};

const RAW_HCM_FIXTURE_PATHS = new Set([
  '/api/people/v1/hris/workbench/self-service/employment-documents',
  '/api/people/v1/hris/workbench/operations/employment/assignments',
]);

export type HcmShellFixtureResolution = Readonly<{
  data: unknown;
  mode: 'raw' | 'success-envelope';
}>;

export function resolveHcmShellFixture(path: string): HcmShellFixtureResolution | undefined {
  const exactFixture = EXACT_HCM_FIXTURES[path];
  if (exactFixture !== undefined) {
    return {
      data: exactFixture,
      mode: RAW_HCM_FIXTURE_PATHS.has(path) ? 'raw' : 'success-envelope',
    };
  }

  const operationsMatch = path.match(
    /^\/api\/people\/v1\/hr\/operations\/(time|absence|benefits|pay|talent)$/iu
  );
  if (!operationsMatch) return undefined;

  return {
    data: hrDomainOperationsFixture(
      operationsMatch[1].toUpperCase() as Parameters<typeof hrDomainOperationsFixture>[0]
    ),
    mode: 'success-envelope',
  };
}
