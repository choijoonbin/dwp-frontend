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

export function resolveHcmShellFixture(path: string): unknown | undefined {
  const exactFixture = EXACT_HCM_FIXTURES[path];
  if (exactFixture !== undefined) return exactFixture;

  const operationsMatch = path.match(
    /^\/api\/people\/v1\/hr\/operations\/(time|absence|benefits|pay|talent)$/iu
  );
  if (!operationsMatch) return undefined;

  return hrDomainOperationsFixture(
    operationsMatch[1].toUpperCase() as Parameters<typeof hrDomainOperationsFixture>[0]
  );
}
