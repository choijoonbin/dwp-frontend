import { describe, expect, it } from 'vitest';

import { parsePerformanceReviewOperationsProjection } from './performance-review-operations-contract';

const IDS = {
  cycle: '11111111-1111-4111-8111-111111111111',
  correlation: '22222222-2222-4222-8222-222222222222',
} as const;

function source() {
  return {
    projectionVersion: '1',
    asOf: '2027-04-01T00:00:00Z',
    variantKey: 'REVIEW_OPERATIONS',
    queryState: {
      state: 'COMPLETE',
      scopeDecisionRevision: `scope:${'a'.repeat(64)}`,
      freshness: 'CURRENT',
      nextCursor: null,
      fieldDecisionSummary: { viewCount: 3, maskedCount: 0, omittedCount: 0 },
      partialFailures: [],
      correlationId: IDS.correlation,
      cachePolicy: {
        authorizationDecisionRevision: 'auth:31',
        invalidationEvent: 'dwp.hris.access.assignment.changed.v1',
        maxAgeSeconds: 0,
      },
    },
    items: [
      {
        itemPublicId: `performance-cycle:${IDS.cycle}`,
        title: 'FY27 performance review',
        statusCode: 'READY_TO_FREEZE',
        fieldGroups: {
          REVIEW_ASSIGNMENT: {
            decision: 'VIEW',
            value: {
              publicId: IDS.cycle,
              code: 'PERFORMANCE_REVIEW',
              label: 'FY27 performance review',
              revision: 5,
            },
          },
          WORK_QUEUE: {
            decision: 'VIEW',
            value: {
              openCount: 12,
              oldestAt: '2027-03-31T23:00:00Z',
              slaStatus: 'WITHIN_SLA',
              revision: 5,
            },
          },
          DUE_STATUS: {
            decision: 'VIEW',
            value: { code: 'READY_TO_FREEZE', revision: 5 },
          },
        },
        deepLink: {
          route: '/hr/operations/performance/review-operations',
          resourcePublicId: IDS.cycle,
        },
        availableActions: [
          {
            actionKey: 'hris.action.per.preview-population',
            method: 'POST',
            hrefTemplate: '/api/people/v1/hris/performance/cycles/{cycleId}/population-previews',
            idempotencyPolicy: 'REQUIRED_IDEMPOTENCY_KEY',
            stepUpPolicy: 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED',
          },
          {
            actionKey: 'hris.action.per.freeze-population',
            method: 'POST',
            hrefTemplate: '/api/people/v1/hris/performance/cycles/{cycleId}/population-freezes',
            idempotencyPolicy: 'REQUIRED_IDEMPOTENCY_KEY',
            stepUpPolicy: 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED',
          },
        ],
      },
    ],
  };
}

describe('IAQ-021 performance review-operations projection', () => {
  it('accepts and deeply freezes only the exact projection, deep link, and action allowlist', () => {
    const projection = parsePerformanceReviewOperationsProjection(source());

    expect(projection.items[0]?.deepLink).toEqual({
      route: '/hr/operations/performance/review-operations',
      resourcePublicId: IDS.cycle,
    });
    expect(projection.items[0]?.availableActions.map((action) => action.actionKey)).toEqual([
      'hris.action.per.preview-population',
      'hris.action.per.freeze-population',
    ]);
    expect(Object.isFrozen(projection)).toBe(true);
    expect(Object.isFrozen(projection.items)).toBe(true);
    expect(Object.isFrozen(projection.items[0]?.fieldGroups)).toBe(true);
    expect(Object.isFrozen(projection.items[0]?.availableActions)).toBe(true);
  });

  it('preserves an exact zero aggregate revision instead of fabricating a positive revision', () => {
    const candidate = source();
    candidate.items[0]!.fieldGroups.REVIEW_ASSIGNMENT.value.revision = 0;
    candidate.items[0]!.fieldGroups.WORK_QUEUE.value.revision = 0;
    candidate.items[0]!.fieldGroups.DUE_STATUS.value.revision = 0;

    const item = parsePerformanceReviewOperationsProjection(candidate).items[0]!;

    expect(item.fieldGroups.REVIEW_ASSIGNMENT?.decision).toBe('VIEW');
    if (item.fieldGroups.REVIEW_ASSIGNMENT?.decision === 'VIEW') {
      expect(item.fieldGroups.REVIEW_ASSIGNMENT.value.revision).toBe(0);
    }
  });

  it('enforces VIEW, MASK, and OMIT counts against the serialized field groups', () => {
    const candidate = source();
    candidate.items[0]!.fieldGroups = {
      REVIEW_ASSIGNMENT: candidate.items[0]!.fieldGroups.REVIEW_ASSIGNMENT,
      WORK_QUEUE: {
        decision: 'MASK',
        value: null,
        maskReason: 'SENSITIVE_FIELD',
        maskedDisplayKey: 'hris.field.masked',
      },
    } as (typeof candidate.items)[0]['fieldGroups'];
    candidate.queryState.fieldDecisionSummary = {
      viewCount: 1,
      maskedCount: 1,
      omittedCount: 1,
    };

    const projection = parsePerformanceReviewOperationsProjection(candidate);

    expect(projection.items[0]?.fieldGroups.WORK_QUEUE?.decision).toBe('MASK');
    expect(projection.items[0]?.fieldGroups.DUE_STATUS).toBeUndefined();
    expect(() =>
      parsePerformanceReviewOperationsProjection({
        ...candidate,
        queryState: {
          ...candidate.queryState,
          fieldDecisionSummary: { viewCount: 2, maskedCount: 0, omittedCount: 1 },
        },
      })
    ).toThrow('Performance review-operations projection is invalid.');
  });

  it('rejects state/cardinality mismatches, unallowlisted actions, and serialized trusted context', () => {
    expect(() =>
      parsePerformanceReviewOperationsProjection({
        ...source(),
        queryState: { ...source().queryState, state: 'EMPTY' },
      })
    ).toThrow('Performance review-operations projection is invalid.');
    const hostile = source();
    hostile.items[0]!.availableActions[0]!.hrefTemplate = '/api/people/admin/delete-all';
    expect(() => parsePerformanceReviewOperationsProjection(hostile)).toThrow(
      'Performance review-operations projection is invalid.'
    );
    const mismatchedLink = source();
    mismatchedLink.items[0]!.deepLink.resourcePublicId = IDS.correlation;
    expect(() => parsePerformanceReviewOperationsProjection(mismatchedLink)).toThrow(
      'Performance review-operations projection is invalid.'
    );
    expect(() => parsePerformanceReviewOperationsProjection({ ...source(), tenantId: 77 })).toThrow(
      'Performance review-operations projection is invalid.'
    );
  });

  it('requires partial failures and closes unavailable projections', () => {
    const empty = source();
    empty.items = [];
    empty.queryState.fieldDecisionSummary = { viewCount: 0, maskedCount: 0, omittedCount: 0 };
    empty.queryState.state = 'PARTIAL';
    expect(() => parsePerformanceReviewOperationsProjection(empty)).toThrow(
      'Performance review-operations projection is invalid.'
    );

    empty.queryState.state = 'UNAVAILABLE';
    empty.queryState.freshness = 'UNAVAILABLE';
    expect(parsePerformanceReviewOperationsProjection(empty).items).toEqual([]);
  });
});
