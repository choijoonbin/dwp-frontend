import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import {
  getHrDomainOperations,
  getHrTeam,
  getHrTeamAbsence,
  getHrTeamTime,
  getHrWorkforceOperationsOverview,
} from './hr-api';
import {
  getOrganizationChart,
  getOrganizationIntelligence,
  getOrganizationScenarioDecisionHistory,
  getOrganizationScenarioDecisionPack,
  getPerson,
  listOrganizationScenarios,
  listPeople,
  listWorkforceOrganizationCandidates,
} from './people-admin-api';
import {
  listHrisConnectors,
  listHrisMappingProfiles,
  listHrisReconciliationIssues,
  listHrisReconciliations,
  listHrisSources,
  listHrisSyncRuns,
} from './hris-admin-api';
import { getSystemCodeSet } from './system-code-catalog-api';
import { getHcmServiceCatalog, getHcmServiceRequests } from './service-center-api';
import { listWorkforceReferenceCatalogs } from './workforce-api';
import {
  listWorkforceExportAttempts,
  listWorkforceExportDatasets,
  listWorkforceExportRequests,
  previewWorkforceExport,
} from './workforce-export-api';

function jsonResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ data }),
  } as Response;
}

function scopedFetchMock() {
  return vi
    .fn()
    .mockImplementation((url: string) =>
      Promise.resolve(
        url === '/api/auth/csrf'
          ? jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' })
          : jsonResponse([])
      )
    );
}

describe('HCM Product Surface read scope', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('binds every management PAGE/DATA request to the non-default scope and design view', async () => {
    const fetchMock = scopedFetchMock();
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();
    const scope = 'scope:hcm/non-default';

    await listWorkforceExportDatasets(scope, controller.signal);
    await previewWorkforceExport('WORKFORCE_DIRECTORY', {}, scope, controller.signal);
    await listWorkforceExportRequests(scope, controller.signal);
    await listWorkforceExportAttempts('export-1', scope, controller.signal);
    await listHrisSources(scope, controller.signal);
    await listHrisConnectors(scope, controller.signal);
    await listHrisMappingProfiles(scope, controller.signal);
    await listHrisSyncRuns(100, scope, controller.signal);
    await listHrisReconciliations(50, scope, controller.signal);
    await listHrisReconciliationIssues('OPEN', 100, scope, controller.signal);
    for (const codeSet of [
      'PEOPLE.HRIS_SOURCE_TYPE',
      'PEOPLE.HRIS_CONNECTOR_TYPE',
      'PEOPLE.HRIS_AUTH_MODE',
      'PEOPLE.POSITION_TYPE',
      'PEOPLE.POSITION_CRITICALITY',
    ]) {
      await getSystemCodeSet(codeSet, 'ko', scope, controller.signal);
    }
    await getOrganizationChart({
      depth: 10,
      surface: 'workforce',
      view: 'design',
      contextScopeKey: scope,
      signal: controller.signal,
    });
    await getOrganizationIntelligence({
      depth: 10,
      contextScopeKey: scope,
      signal: controller.signal,
    });
    await listOrganizationScenarios(scope, controller.signal);
    await getOrganizationScenarioDecisionPack('scenario-1', scope, controller.signal);
    await getOrganizationScenarioDecisionHistory('scenario-1', scope, controller.signal);
    await listWorkforceOrganizationCandidates(scope, controller.signal);
    await listWorkforceReferenceCatalogs('ko', scope, controller.signal);

    const calls = fetchMock.mock.calls.filter(([url]) => url !== '/api/auth/csrf');
    expect(calls.map(([url]) => url)).toEqual([
      '/api/people/v1/workforce/exports/datasets?contextScopeKey=scope%3Ahcm%2Fnon-default',
      '/api/people/v1/workforce/exports/preview?contextScopeKey=scope%3Ahcm%2Fnon-default',
      '/api/people/v1/workforce/exports?contextScopeKey=scope%3Ahcm%2Fnon-default',
      '/api/people/v1/workforce/exports/export-1/attempts?contextScopeKey=scope%3Ahcm%2Fnon-default',
      '/api/people/v1/workforce/data-operations/hris/sources?contextScopeKey=scope%3Ahcm%2Fnon-default',
      '/api/people/v1/workforce/data-operations/hris/connectors?contextScopeKey=scope%3Ahcm%2Fnon-default',
      '/api/people/v1/workforce/data-operations/hris/mapping-profiles?contextScopeKey=scope%3Ahcm%2Fnon-default',
      '/api/people/v1/workforce/data-operations/hris/sync-runs?size=100&contextScopeKey=scope%3Ahcm%2Fnon-default',
      '/api/people/v1/workforce/data-operations/hris/reconciliations?size=50&contextScopeKey=scope%3Ahcm%2Fnon-default',
      '/api/people/v1/workforce/data-operations/hris/reconciliation-issues?size=100&state=OPEN&contextScopeKey=scope%3Ahcm%2Fnon-default',
      ...[
        'PEOPLE.HRIS_SOURCE_TYPE',
        'PEOPLE.HRIS_CONNECTOR_TYPE',
        'PEOPLE.HRIS_AUTH_MODE',
        'PEOPLE.POSITION_TYPE',
        'PEOPLE.POSITION_CRITICALITY',
      ].map(
        (codeSet) =>
          `/api/platform/v1/catalog/code-sets/${codeSet}?locale=ko&contextScopeKey=scope%3Ahcm%2Fnon-default`
      ),
      '/api/people/v1/workforce/organization/chart?depth=10&view=design&contextScopeKey=scope%3Ahcm%2Fnon-default',
      '/api/people/v1/workforce/organization/intelligence?depth=10&contextScopeKey=scope%3Ahcm%2Fnon-default',
      '/api/people/v1/workforce/organization/scenarios?contextScopeKey=scope%3Ahcm%2Fnon-default',
      '/api/people/v1/workforce/organization/scenarios/scenario-1/decision-pack?contextScopeKey=scope%3Ahcm%2Fnon-default',
      '/api/people/v1/workforce/organization/scenarios/scenario-1/decision-pack/history?contextScopeKey=scope%3Ahcm%2Fnon-default',
      '/api/people/v1/workforce/organization/candidates?contextScopeKey=scope%3Ahcm%2Fnon-default',
      '/api/people/v1/workforce/reference-data?locale=ko&contextScopeKey=scope%3Ahcm%2Fnon-default',
    ]);
    calls.forEach((call) => expect((call[1] as RequestInit).signal).toBeInstanceOf(AbortSignal));
  });

  it('scopes operations and team reads while keeping operations chart free of design view', async () => {
    const fetchMock = scopedFetchMock();
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();
    const operationsScope = 'scope:hcm/operations-west';
    const teamScope = 'scope:hcm/team-blue';

    await getHrWorkforceOperationsOverview(operationsScope, controller.signal);
    await getHrDomainOperations('TIME', operationsScope, controller.signal);
    await listPeople({
      size: 100,
      surface: 'workforce',
      contextScopeKey: operationsScope,
      signal: controller.signal,
    });
    await listPeople({
      size: 100,
      surface: 'workforce',
      view: 'assignments',
      contextScopeKey: operationsScope,
      signal: controller.signal,
    });
    await getOrganizationChart({
      depth: 10,
      surface: 'workforce',
      contextScopeKey: operationsScope,
      signal: controller.signal,
    });
    await getPerson('person-1', '2026-08-25', 'workforce', operationsScope, controller.signal);
    await getHrTeam(teamScope, controller.signal);
    await getHrTeamTime(teamScope, controller.signal);
    await getHrTeamAbsence(teamScope, controller.signal);

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/people/v1/workforce/operations/overview?contextScopeKey=scope%3Ahcm%2Foperations-west',
      '/api/people/v1/hr/operations/TIME?contextScopeKey=scope%3Ahcm%2Foperations-west',
      '/api/people/v1/workforce/people?size=100&contextScopeKey=scope%3Ahcm%2Foperations-west',
      '/api/people/v1/workforce/people?size=100&view=assignments&contextScopeKey=scope%3Ahcm%2Foperations-west',
      '/api/people/v1/workforce/organization/chart?depth=10&contextScopeKey=scope%3Ahcm%2Foperations-west',
      '/api/people/v1/workforce/people/person-1?asOf=2026-08-25&contextScopeKey=scope%3Ahcm%2Foperations-west',
      '/api/people/v1/hr/team?contextScopeKey=scope%3Ahcm%2Fteam-blue',
      '/api/people/v1/hr/team/time?contextScopeKey=scope%3Ahcm%2Fteam-blue',
      '/api/people/v1/hr/team/absence?contextScopeKey=scope%3Ahcm%2Fteam-blue',
    ]);
    expect(
      fetchMock.mock.calls.some(([url]) => String(url).includes('/organization/candidates'))
    ).toBe(false);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/identity'))).toBe(false);
  });

  it('preserves legacy URLs when no governed scope is selected', async () => {
    const fetchMock = scopedFetchMock();
    vi.stubGlobal('fetch', fetchMock);

    await listWorkforceReferenceCatalogs('en');
    await getHrTeam();
    await getOrganizationChart({ depth: 10, surface: 'workforce' });
    await getPerson('person-2', undefined, 'directory', undefined, undefined, 'directory');
    await getOrganizationChart({ depth: 10, surface: 'directory', view: 'directory' });
    await getHcmServiceCatalog();
    await getHcmServiceRequests();

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/people/v1/workforce/reference-data?locale=en',
      '/api/people/v1/hr/team',
      '/api/people/v1/workforce/organization/chart?depth=10',
      '/api/people/v1/people/person-2?view=directory',
      '/api/people/v1/org-chart?depth=10&view=directory',
      '/api/platform/v1/services/catalog?surface=hcm',
      '/api/platform/v1/services/requests?surface=hcm',
    ]);
  });
});
