import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as SharedUtils from '@dwp-frontend/shared-utils';

const runtime = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock('@dwp-frontend/shared-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof SharedUtils>()),
  axiosInstance: { get: runtime.get },
}));

import {
  HRM007_ENTRY_QUERY_API_CONTRACTS,
  createHrm007QueryAdapter,
  hrm007QueryString,
  queryHrm007Entry,
} from './hrm-007-api';
import {
  HRM007_ADAPTER_KIND,
  HRM007_QUERY_CONTRACTS,
  createHrm007QueryRequest,
} from './hrm-007-contract';
import { HRM007_TEST_SCOPE, hrm007ProjectionWire } from './hrm-007-fixtures.test-support';
import { hrm007QueryKey } from './use-hrm-007-workbench';

import type { Hrm007QueryId, Hrm007QueryRequest } from './hrm-007-contract';

describe('HRM-007 sealed GET adapter', () => {
  beforeEach(() => runtime.get.mockReset());

  it('declares exactly three GET entry-query contracts and no command surface', () => {
    expect(HRM007_ENTRY_QUERY_API_CONTRACTS).toEqual([
      {
        bindingId: 'IAQ-005',
        operationId: 'IAQ.OP.005',
        method: 'GET',
        path: '/api/people/v1/hris/workbench/team/people-changes',
      },
      {
        bindingId: 'IAQ-007',
        operationId: 'IAQ.OP.007',
        method: 'GET',
        path: '/api/people/v1/hris/workbench/operations/appointments',
      },
      {
        bindingId: 'IAQ-013',
        operationId: 'IAQ.OP.013',
        method: 'GET',
        path: '/api/people/v1/hris/workbench/configuration/people-employment',
      },
    ]);
    const adapter = createHrm007QueryAdapter();
    expect(Object.keys(adapter)).toEqual(['kind', 'query']);
    expect(adapter.kind).toBe(HRM007_ADAPTER_KIND);
    expect(Object.isFrozen(adapter)).toBe(true);
    expect(JSON.stringify(adapter)).not.toMatch(/post|command|mutation/u);
  });

  it.each(['IAQ-005', 'IAQ-007', 'IAQ-013'] as const)(
    'queries the exact %s browser path and selects its sealed variant',
    async (queryId) => {
      runtime.get.mockResolvedValue({ data: hrm007ProjectionWire(queryId) });
      const signal = new AbortController().signal;
      const request = createHrm007QueryRequest(queryId, HRM007_TEST_SCOPE);
      await expect(
        queryHrm007Entry(queryId, request, HRM007_TEST_SCOPE.contextScopeKey, signal)
      ).resolves.toMatchObject({ variantKey: HRM007_QUERY_CONTRACTS[queryId].variantKey });

      const [url, config] = runtime.get.mock.calls[0]!;
      const parsed = new URL(url, 'https://dwp.invalid');
      expect(parsed.pathname).toBe(HRM007_QUERY_CONTRACTS[queryId].path);
      expect(parsed.searchParams.get('limit')).toBe('100');
      expect(parsed.searchParams.getAll('sort')).toEqual(['itemPublicId:ASC']);
      expect(parsed.searchParams.get('tenant')).toBeNull();
      expect(parsed.searchParams.get('tenantId')).toBeNull();
      expect(parsed.searchParams.get('decisionRevision')).toBeNull();
      expect(config).toEqual({ contextScopeKey: HRM007_TEST_SCOPE.contextScopeKey, signal });
      runtime.get.mockReset();
    }
  );

  it('serializes only the IAQ-specific nested filters and never caller tenant context', async () => {
    runtime.get.mockResolvedValue({ data: hrm007ProjectionWire('IAQ-007') });
    const request = createHrm007QueryRequest('IAQ-007', HRM007_TEST_SCOPE, {
      filter: {
        appointment: { startFrom: '2026-10-17T00:00:00Z', endTo: null },
        assignment: { codes: ['ASSIGNMENT'], publicIds: ['assignment:1001'] },
        employment: { activeOn: '2026-10-17' },
        effectiveOn: '2026-10-17',
      },
      sort: ['appointment:ASC'],
      cursor: 'abcdefghijklmnop',
    });
    await queryHrm007Entry(
      'IAQ-007',
      request,
      HRM007_TEST_SCOPE.contextScopeKey,
      new AbortController().signal
    );
    const url = new URL(runtime.get.mock.calls[0]![0], 'https://dwp.invalid');
    expect(url.searchParams.get('filter[appointment][startFrom]')).toBe('2026-10-17T00:00:00Z');
    expect(url.searchParams.getAll('filter[assignment][codes]')).toEqual(['ASSIGNMENT']);
    expect(url.searchParams.get('filter[employment][activeOn]')).toBe('2026-10-17');
    expect(url.searchParams.get('filter[effectiveOn]')).toBe('2026-10-17');
    expect(url.searchParams.getAll('sort')).toEqual(['appointment:ASC', 'itemPublicId:ASC']);
    expect(url.searchParams.get('cursor')).toBe('abcdefghijklmnop');
  });

  it('serializes an explicit empty filter when null and empty nested filters emit no leaves', () => {
    const request = createHrm007QueryRequest('IAQ-007', HRM007_TEST_SCOPE, {
      filter: {
        appointment: null,
        assignment: {},
        employment: {},
        effectiveOn: null,
      },
    });
    const params = new URLSearchParams(hrm007QueryString('IAQ-007', request));

    expect(params.get('filter')).toBe('{}');
    expect([...params.keys()].filter((key) => key.startsWith('filter['))).toEqual([]);
  });

  it('rejects an invalid request before transport', async () => {
    const invalid = {
      ...createHrm007QueryRequest('IAQ-013', HRM007_TEST_SCOPE),
      limit: 101,
    } as unknown as Hrm007QueryRequest;
    await expect(
      queryHrm007Entry(
        'IAQ-013',
        invalid,
        HRM007_TEST_SCOPE.contextScopeKey,
        new AbortController().signal
      )
    ).rejects.toThrow(/request\.limit/u);
    expect(runtime.get).not.toHaveBeenCalled();
  });

  it('does not permit a query ID outside the sealed set', () => {
    expect(() => createHrm007QueryRequest('IAQ-999' as Hrm007QueryId, HRM007_TEST_SCOPE)).toThrow();
  });

  it('binds cache identity to adapter, query, scope, revision, as-of, sort, limit, cursor, and filter', () => {
    const first = createHrm007QueryAdapter();
    const second = createHrm007QueryAdapter();
    const options = {
      asOf: '2026-10-17T00:00:00Z',
      cursor: 'abcdefghijklmnop',
      sort: ['approvalStatus:ASC'] as const,
      filter: { approvalStatus: { codes: ['APPROVED'] } },
    };
    const firstKey = hrm007QueryKey(first, 'IAQ-005', HRM007_TEST_SCOPE, options);
    const changedRevision = hrm007QueryKey(
      first,
      'IAQ-005',
      { ...HRM007_TEST_SCOPE, decisionRevision: 'decision:hrm-007:52' },
      options
    );
    const changedAdapter = hrm007QueryKey(second, 'IAQ-005', HRM007_TEST_SCOPE, options);

    expect(firstKey).toContain(100);
    expect(firstKey).toContain('2026-10-17T00:00:00Z');
    expect(firstKey).toContain('abcdefghijklmnop');
    expect(firstKey).not.toEqual(changedRevision);
    expect(firstKey).not.toEqual(changedAdapter);
  });
});
