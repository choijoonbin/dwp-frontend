import { beforeEach, describe, expect, it, vi } from 'vitest';

const runtime = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock('@dwp-frontend/shared-utils', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  axiosInstance: { get: runtime.get },
}));

import {
  PERFORMANCE_REVIEW_OPERATIONS_API_CONTRACT,
  queryPerformanceReviewOperations,
} from './performance-review-operations-api';

const CORRELATION = '11111111-1111-4111-8111-111111111111';

function emptyProjection() {
  return {
    projectionVersion: '1',
    asOf: '2027-04-01T00:00:00Z',
    variantKey: 'REVIEW_OPERATIONS',
    queryState: {
      state: 'EMPTY',
      scopeDecisionRevision: `scope:${'a'.repeat(64)}`,
      freshness: 'CURRENT',
      nextCursor: null,
      fieldDecisionSummary: { viewCount: 0, maskedCount: 0, omittedCount: 0 },
      partialFailures: [],
      correlationId: CORRELATION,
      cachePolicy: {
        authorizationDecisionRevision: 'auth:31',
        invalidationEvent: 'dwp.hris.access.assignment.changed.v1',
        maxAgeSeconds: 0,
      },
    },
    items: [],
  };
}

describe('performance review-operations API', () => {
  beforeEach(() => runtime.get.mockReset());

  it('declares the canonical PAGE route authority without changing the IAQ-021 wire path', () => {
    expect(PERFORMANCE_REVIEW_OPERATIONS_API_CONTRACT).toEqual({
      apiFunction: 'queryPerformanceReviewOperations',
      routeContractKey: 'route.hcm.operations.performance-review-operations.page',
      method: 'GET',
      path: '/api/people/v1/hris/performance/workbench/review-operations',
    });
  });

  it('uses the exact IAQ-021 path and serializes the closed request without trusted context', async () => {
    const signal = new AbortController().signal;
    runtime.get.mockResolvedValue({ data: { data: emptyProjection() } });

    await expect(
      queryPerformanceReviewOperations(
        {
          limit: 25,
          filter: {
            reviewAssignment: { codes: ['PERFORMANCE_REVIEW'], publicIds: ['cycle:1'] },
            workQueue: {
              minimumOpenCount: 2,
              maximumOpenCount: 40,
              slaStates: ['WITHIN_SLA'],
            },
            dueStatus: { codes: ['READY_TO_FREEZE'], minimumRevision: 5 },
            effectiveOn: '2027-04-02',
          },
          sort: ['dueStatus:ASC', 'itemPublicId:ASC'],
          locale: 'ko-KR',
          timeZone: 'Asia/Seoul',
          correlationId: CORRELATION,
          asOf: '2027-04-01T00:00:00Z',
          cursor: 'a'.repeat(32),
        },
        'scope:tenant/77',
        signal
      )
    ).resolves.toMatchObject({ variantKey: 'REVIEW_OPERATIONS', items: [] });

    expect(runtime.get).toHaveBeenCalledOnce();
    const [url, config] = runtime.get.mock.calls[0]!;
    const requestUrl = new URL(url, 'https://dwp.invalid');
    expect(requestUrl.pathname).toBe('/api/people/v1/hris/performance/workbench/review-operations');
    expect(config).toEqual({ contextScopeKey: 'scope:tenant/77', signal });
    const params = requestUrl.searchParams;
    expect(params.getAll('sort')).toEqual(['dueStatus:ASC', 'itemPublicId:ASC']);
    expect(params.get('correlationId')).toBe(CORRELATION);
    expect(params.get('effectiveOn')).toBe('2027-04-02');
    expect(params.getAll('reviewAssignmentCodes')).toEqual(['PERFORMANCE_REVIEW']);
    expect(params.get('minimumOpenCount')).toBe('2');
    expect(params.get('tenantId')).toBeNull();
    expect(params.get('subjectId')).toBeNull();
  });

  it('rejects a source response whose field decision summary is not authoritative', async () => {
    const invalid = emptyProjection();
    invalid.queryState.fieldDecisionSummary.viewCount = 1;
    runtime.get.mockResolvedValue({ data: { data: invalid } });

    await expect(
      queryPerformanceReviewOperations({
        limit: 25,
        filter: {},
        sort: ['itemPublicId:ASC'],
        locale: 'en-US',
        timeZone: 'UTC',
        correlationId: CORRELATION,
      })
    ).rejects.toThrow('Performance review-operations projection is invalid.');
  });
});
