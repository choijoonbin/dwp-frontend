import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as SharedUtils from '@dwp-frontend/shared-utils';

const runtime = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock('@dwp-frontend/shared-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof SharedUtils>()),
  axiosInstance: { get: runtime.get },
}));

import {
  createHrisOrganizationPositionsQueryAdapter,
  queryHrisOrganizationGraph,
} from './organization-positions-api';
import {
  HRIS_ORGANIZATION_POSITIONS_ADAPTER_KIND,
  HRIS_ORGANIZATION_GRAPH_PATH,
} from './organization-positions-contract';
import {
  organizationManagementChartRequest,
  organizationManagementQueryPlan,
} from '../../../../components/organization-management-query';

const ROOT = '10000000-0000-4000-8000-000000000001';
const request = {
  asOf: '2026-10-17T00:00:00Z',
  rootPublicId: ROOT,
  depth: 0,
  relationshipType: 'REPORTING',
  includePositions: false,
} as const;
const response = {
  schemaVersion: 2,
  asOf: request.asOf,
  effectiveDate: '2026-10-17',
  rootPublicId: ROOT,
  depth: 0,
  relationshipType: 'REPORTING',
  positionsIncluded: false,
  nodes: [{ organizationPublicId: ROOT, parentPublicId: null, name: 'Root', depth: 0 }],
  positions: [],
};

describe('PEP-HRM-010 browser adapter', () => {
  beforeEach(() => {
    runtime.get.mockReset().mockResolvedValue({ data: response });
  });

  it('has only the sealed kind and query properties', () => {
    const adapter = createHrisOrganizationPositionsQueryAdapter('scope:organization');
    expect(Object.keys(adapter)).toEqual(['kind', 'query']);
    expect(adapter.kind).toBe(HRIS_ORGANIZATION_POSITIONS_ADAPTER_KIND);
  });

  it('maps the canonical unwrapped GET response and forwards AbortSignal and request scope', async () => {
    const signal = new AbortController().signal;
    await expect(
      queryHrisOrganizationGraph(request, signal, 'scope:organization')
    ).resolves.toEqual(response);
    expect(runtime.get).toHaveBeenCalledTimes(1);
    expect(runtime.get).toHaveBeenCalledWith(
      `${HRIS_ORGANIZATION_GRAPH_PATH}?asOf=2026-10-17T00%3A00%3A00Z&rootPublicId=${ROOT}&depth=0&relationshipType=REPORTING&includePositions=false`,
      expect.objectContaining({ signal })
    );
  });

  it('rejects an invalid query before the transport is called', async () => {
    const adapter = createHrisOrganizationPositionsQueryAdapter();
    await expect(
      adapter.query({ ...request, depth: 13 }, new AbortController().signal)
    ).rejects.toThrow('Organization graph query is invalid.');
    expect(runtime.get).not.toHaveBeenCalled();
  });
});

describe('OrganizationExplorer no-adapter management regression', () => {
  it('keeps the directory chart enabled while all workforce-only owners stay disabled', () => {
    expect(
      organizationManagementQueryPlan({
        workforceView: false,
        requestScopeReady: false,
        workforceReadOnly: true,
        insightsSelected: false,
      })
    ).toEqual({ chart: true, scenarios: false, candidates: false, intelligence: false });

    const signal = new AbortController().signal;
    expect(
      organizationManagementChartRequest({
        experience: 'directory',
        asOf: '2026-10-17',
        rootOrganizationId: ROOT,
        scenarioId: 'scenario-ignored',
        contextScopeKey: 'scope-ignored',
        signal,
      })
    ).toEqual({
      asOf: '2026-10-17',
      rootOrganizationId: ROOT,
      scenarioId: undefined,
      depth: 10,
      surface: 'directory',
      view: undefined,
      contextScopeKey: undefined,
      signal,
    });
  });

  it('retains workforce readiness, read-only, and insight query isolation', () => {
    expect(
      organizationManagementQueryPlan({
        workforceView: true,
        requestScopeReady: false,
        workforceReadOnly: false,
        insightsSelected: true,
      })
    ).toEqual({ chart: false, scenarios: false, candidates: false, intelligence: false });
    expect(
      organizationManagementQueryPlan({
        workforceView: true,
        requestScopeReady: true,
        workforceReadOnly: false,
        insightsSelected: false,
      })
    ).toEqual({ chart: true, scenarios: true, candidates: true, intelligence: false });
    expect(
      organizationManagementQueryPlan({
        workforceView: true,
        requestScopeReady: true,
        workforceReadOnly: true,
        insightsSelected: true,
      })
    ).toEqual({ chart: true, scenarios: true, candidates: false, intelligence: true });

    const signal = new AbortController().signal;
    expect(
      organizationManagementChartRequest({
        experience: 'workforce',
        asOf: '2026-10-17',
        rootOrganizationId: ROOT,
        scenarioId: 'scenario-1',
        contextScopeKey: 'scope:organization',
        signal,
      })
    ).toEqual({
      asOf: '2026-10-17',
      rootOrganizationId: ROOT,
      scenarioId: 'scenario-1',
      depth: 10,
      surface: 'workforce',
      view: 'design',
      contextScopeKey: 'scope:organization',
      signal,
    });
  });
});
