import type { Hrm012Projection, Hrm012TrustedScope } from '../data-quality-contract';

export const HRM012_TEST_CORRELATION_ID = '11111111-1111-4111-8111-111111111111';
export const HRM012_TEST_RECEIPT_ID = '22222222-2222-4222-8222-222222222222';
export const HRM012_TEST_AS_OF = '2026-10-22T00:30:00Z';
export const HRM012_TEST_DIGEST = 'a'.repeat(64);
export const HRM012_TEST_CURSOR = 'abcdefghijklmnop';

export const HRM012_TEST_SCOPE: Hrm012TrustedScope = Object.freeze({
  contextScopeKey: 'target-population:hrm-012',
  decisionRevision: 'decision-revision-57',
  locale: 'en-US',
  timeZone: 'Asia/Seoul',
  correlationId: HRM012_TEST_CORRELATION_ID,
});

type QueryState = Hrm012Projection['queryState']['state'];
type Freshness = Hrm012Projection['queryState']['freshness'];

function visibleItem() {
  return {
    itemPublicId: 'run.hrm012.0001',
    title: 'October workforce ingestion',
    statusCode: 'RECONCILED',
    fieldGroups: {
      INGESTION_STATUS: {
        decision: 'VIEW',
        value: { code: 'APPLIED', revision: 7 },
      },
      QUALITY_FINDING: {
        decision: 'MASK',
        value: null,
        maskReason: 'FIELD_POLICY',
        maskedDisplayKey: 'hris.data_quality.restricted',
      },
      COMMAND_RECEIPT: {
        decision: 'VIEW',
        value: {
          receiptId: HRM012_TEST_RECEIPT_ID,
          state: 'SUCCEEDED',
          occurredAt: '2026-10-22T00:20:00Z',
          revision: 4,
        },
      },
    },
    deepLink: {
      route: '/hr/operations/people/data-quality',
      resourcePublicId: 'run.hrm012.0001',
    },
    availableActions: [],
  };
}

export function hrm012OmittedProjectionWire() {
  return {
    ...hrm012ProjectionWire(),
    items: [
      {
        ...visibleItem(),
        fieldGroups: {
          INGESTION_STATUS: {
            decision: 'VIEW',
            value: { code: 'VALIDATED', revision: 8 },
          },
        },
      },
    ],
    queryState: {
      ...hrm012ProjectionWire().queryState,
      fieldDecisionSummary: { viewCount: 1, maskedCount: 0, omittedCount: 2 },
    },
  };
}

export function hrm012ProjectionWire(
  state: QueryState = 'COMPLETE',
  freshness: Freshness = state === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'CURRENT',
  nextCursor: string | null = null
) {
  const items = state === 'EMPTY' || state === 'UNAVAILABLE' ? [] : [visibleItem()];
  return {
    projectionVersion: '1',
    asOf: HRM012_TEST_AS_OF,
    variantKey: 'DATA_QUALITY',
    queryState: {
      state,
      scopeDecisionRevision: HRM012_TEST_SCOPE.decisionRevision,
      freshness,
      nextCursor: state === 'UNAVAILABLE' ? null : nextCursor,
      fieldDecisionSummary:
        items.length === 0
          ? { viewCount: 0, maskedCount: 0, omittedCount: 0 }
          : { viewCount: 2, maskedCount: 1, omittedCount: 0 },
      partialFailures:
        state === 'PARTIAL'
          ? [
              {
                componentKey: 'quality.projection',
                errorCode: 'OWNER_COMPONENT_UNAVAILABLE',
                correlationId: HRM012_TEST_CORRELATION_ID,
                retryable: true,
              },
            ]
          : [],
      correlationId: HRM012_TEST_CORRELATION_ID,
      cachePolicy: {
        authorizationDecisionRevision: HRM012_TEST_SCOPE.decisionRevision,
        invalidationEvent: 'dwp.hris.access.assignment.changed.v1',
        maxAgeSeconds: 30,
      },
    },
    items,
  };
}
