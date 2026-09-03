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
