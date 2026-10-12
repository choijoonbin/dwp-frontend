import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { getPerformanceReviewOperationsCopy } from './performance-review-operations-copy';
import { PerformanceReviewOperationsWorkspaceView } from './performance-review-operations-workspace';

import type { PerformanceReviewOperationsProjection } from './performance-review-operations-contract';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
}));

const CYCLE_ID = '11111111-1111-4111-8111-111111111111';
const RECEIPT_ID = '22222222-2222-4222-8222-222222222222';
const CORRELATION_ID = '33333333-3333-4333-8333-333333333333';

const projection: PerformanceReviewOperationsProjection = {
  projectionVersion: '1',
  asOf: '2027-04-01T00:00:00Z',
  variantKey: 'REVIEW_OPERATIONS',
  queryState: {
    state: 'COMPLETE',
    scopeDecisionRevision: `scope:${'a'.repeat(64)}`,
    freshness: 'CURRENT',
    nextCursor: 'a'.repeat(32),
    fieldDecisionSummary: { viewCount: 2, maskedCount: 1, omittedCount: 0 },
    partialFailures: [],
    correlationId: CORRELATION_ID,
    cachePolicy: {
      authorizationDecisionRevision: 'auth:31',
      invalidationEvent: 'dwp.hris.access.assignment.changed.v1',
      maxAgeSeconds: 0,
    },
  },
  items: [
    {
      itemPublicId: `performance-cycle:${CYCLE_ID}`,
      title: 'A very long localized performance review title that must wrap safely',
      statusCode: 'READY_TO_FREEZE',
      fieldGroups: {
        REVIEW_ASSIGNMENT: {
          decision: 'VIEW',
          value: {
            publicId: CYCLE_ID,
            code: 'PERFORMANCE_REVIEW',
            label: 'FY27 performance review',
            revision: 5,
          },
        },
        WORK_QUEUE: {
          decision: 'MASK',
          value: null,
          maskReason: 'SENSITIVE_FIELD',
          maskedDisplayKey: 'hris.field.masked',
        },
        DUE_STATUS: {
          decision: 'VIEW',
          value: { code: 'READY_TO_FREEZE', revision: 5 },
        },
      },
      deepLink: {
        route: '/hr/operations/performance/review-operations',
        resourcePublicId: CYCLE_ID,
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

function render(overrides: Record<string, unknown> = {}) {
  const copy = getPerformanceReviewOperationsCopy('en');
  return renderToStaticMarkup(
    createElement(PerformanceReviewOperationsWorkspaceView, {
      copy,
      locale: 'en-US',
      timeZone: 'UTC',
      projection,
      selectedItem: projection.items[0]!,
      preview: null,
      freezeResult: null,
      receipt: null,
      commandError: null,
      commandBusy: false,
      previewExecutorConnected: true,
      freezeExecutorConnected: true,
      freezeRetryPending: false,
      loading: false,
      fetching: false,
      error: null,
      pageIndex: 0,
      canNext: true,
      canPrevious: false,
      onSelect: vi.fn(),
      onRefresh: vi.fn(),
      onNext: vi.fn(),
      onPrevious: vi.fn(),
      onPreview: vi.fn(),
      onFreeze: vi.fn(),
      onRetryFreeze: vi.fn(),
      ...overrides,
    })
  );
}

describe('performance review-operations workspace', () => {
  it('renders a responsive semantic workbench with governed field masking and target-sized controls', () => {
    const html = render();

    expect(html).toContain('data-testid="performance-review-operations-workspace"');
    expect(html).toContain('data-route="/hr/operations/performance/review-operations"');
    expect(html).toContain('<h2');
    expect(html).toContain('<h3');
    expect(html).toContain('<ul');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('min-height:48px');
    expect(html).toContain('Restricted by field policy');
    expect(html).toContain('overflow-wrap:anywhere');
    expect(html).not.toContain('SENSITIVE_FIELD');
    expect(html).not.toContain('@keyframes');
  });

  it('keeps preview and freeze fail-closed until generated command authority is connected', () => {
    const html = render({
      previewExecutorConnected: false,
      freezeExecutorConnected: false,
    });

    expect(html).toContain('Command authority is not connected');
    expect(html).toContain('Generate preview');
    expect(html.match(/disabled=""/gu)?.length).toBeGreaterThanOrEqual(3);
  });

  it('renders RESULT_UNKNOWN reconciliation without a duplicate freeze submission action', () => {
    const html = render({
      receipt: {
        receiptId: RECEIPT_ID,
        commandType: 'FREEZE_POPULATION',
        originatingAction: 'performance.population.freeze',
        aggregateId: CYCLE_ID,
        expectedAggregateVersion: 4,
        appliedAggregateVersion: null,
        state: 'RESULT_UNKNOWN',
        resultRef: null,
        errorCode: null,
        acceptedAt: '2027-04-01T00:00:00Z',
        completedAt: null,
      },
    });

    expect(html).toContain('Result requires reconciliation');
    expect(html).toContain('Do not submit again');
    expect(html).toContain('Reconcile receipt');
    expect(html).not.toContain('Submit again');
  });

  it('renders empty and partial operational states without fabricating items', () => {
    const empty: PerformanceReviewOperationsProjection = {
      ...projection,
      queryState: {
        ...projection.queryState,
        state: 'PARTIAL',
        fieldDecisionSummary: { viewCount: 0, maskedCount: 0, omittedCount: 0 },
        partialFailures: [
          {
            componentKey: 'performance.preview',
            errorCode: 'OWNER_UNAVAILABLE',
            correlationId: CORRELATION_ID,
            retryable: true,
          },
        ],
      },
      items: [],
    };
    const html = render({ projection: empty, selectedItem: null });

    expect(html).toContain('Some operation data is unavailable');
    expect(html).toContain('No review operations');
    expect(html).not.toContain(CYCLE_ID);
  });
});
