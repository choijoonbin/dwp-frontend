// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HttpError, HttpTransportError } from '@dwp-frontend/shared-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { usePerformanceReviewOperationsRuntime } from './use-performance-review-operations';

import type { ProductSurfaceRequestScope } from '../../../../components/use-product-surface-request-scope';
import type { PerformancePopulationPreview } from '../model/performance-cycle-contract';
import type { FreezePerformancePopulationCommand } from './population-freeze-contract';
import type { PerformanceReviewOperationsDataSource } from './performance-review-operations-api';
import type {
  PerformanceReviewOperationsProjection,
  PerformanceReviewOperationsQuery,
} from './performance-review-operations-contract';
import type { PerformanceReviewOperationsCommandExecutors } from './use-performance-review-operations';

const ID = {
  cycle: '11111111-1111-4111-8111-111111111111',
  version: '22222222-2222-4222-8222-222222222222',
  preview: '33333333-3333-4333-8333-333333333333',
  rule: '44444444-4444-4444-8444-444444444444',
  snapshot: '55555555-5555-4555-8555-555555555555',
  freeze: '66666666-6666-4666-8666-666666666666',
} as const;
const HASH = 'a'.repeat(64);

const scope: ProductSurfaceRequestScope = {
  governed: true,
  ready: true,
  contextScopeKey: 'scope:talent',
  cacheKey: ['tenant-1', 'actor-1', 'NORMAL', 'hcm.operations', 'scope:talent', 'decision-1'],
  queryMeta: {
    accessSensitive: true,
    tenantId: 'tenant-1',
    actorId: 'actor-1',
    accessMode: 'NORMAL',
    productId: 'hcm',
    surfaceId: 'hcm.operations',
    contextScopeKey: 'scope:talent',
    decisionRevision: 'decision-1',
  },
};

function projection(
  request: PerformanceReviewOperationsQuery
): PerformanceReviewOperationsProjection {
  return {
    projectionVersion: '1',
    asOf: request.asOf ?? '2027-04-01T00:00:00Z',
    variantKey: 'REVIEW_OPERATIONS',
    queryState: {
      state: 'COMPLETE',
      scopeDecisionRevision: `scope:${'a'.repeat(64)}`,
      freshness: 'CURRENT',
      nextCursor: null,
      fieldDecisionSummary: { viewCount: 3, maskedCount: 0, omittedCount: 0 },
      partialFailures: [],
      correlationId: request.correlationId,
      cachePolicy: {
        authorizationDecisionRevision: 'auth:31',
        invalidationEvent: 'dwp.hris.access.assignment.changed.v1',
        maxAgeSeconds: 0,
      },
    },
    items: [
      {
        itemPublicId: `performance-cycle:${ID.cycle}`,
        title: 'FY27 performance review',
        statusCode: 'READY_TO_FREEZE',
        fieldGroups: {
          REVIEW_ASSIGNMENT: {
            decision: 'VIEW',
            value: {
              publicId: ID.cycle,
              code: 'PERFORMANCE_REVIEW',
              label: 'FY27 performance review',
              revision: 5,
            },
          },
          WORK_QUEUE: {
            decision: 'VIEW',
            value: { openCount: 12, oldestAt: null, slaStatus: 'WITHIN_SLA', revision: 5 },
          },
          DUE_STATUS: {
            decision: 'VIEW',
            value: { code: 'READY_TO_FREEZE', revision: 5 },
          },
        },
        deepLink: {
          route: '/hr/operations/performance/review-operations',
          resourcePublicId: ID.cycle,
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

const preview: PerformancePopulationPreview = {
  populationPreviewId: ID.preview,
  cycleVersionId: ID.version,
  workforceSnapshotId: ID.snapshot,
  workforceSnapshotRevision: 31,
  populationRuleVersionId: ID.rule,
  sourceCycleAggregateVersion: 4,
  state: 'READY',
  participantCount: 12,
  reviewerAssignmentCount: 4,
  contentHash: HASH,
  aggregateVersion: 1,
  createdAt: '2027-04-01T00:00:00Z',
  expiresAt: '2027-04-01T01:00:00Z',
  members: [],
};

function succeeded(command: FreezePerformancePopulationCommand) {
  return {
    freeze: {
      populationFreezeId: ID.freeze,
      cycleId: ID.cycle,
      cycleVersionId: ID.version,
      populationPreviewId: ID.preview,
      populationRuleVersionId: ID.rule,
      workforceSnapshotId: ID.snapshot,
      workforceSnapshotRevision: 31,
      sourceCycleAggregateVersion: 4,
      state: 'FROZEN' as const,
      participantCount: 12,
      reviewerAssignmentCount: 4,
      contentHash: HASH,
      aggregateVersion: 1 as const,
      frozenAt: '2027-04-01T00:00:01Z',
    },
    receipt: {
      receiptId: command.commandId,
      commandType: 'FREEZE_POPULATION' as const,
      originatingAction: 'performance.population.freeze' as const,
      aggregateId: ID.cycle,
      expectedAggregateVersion: command.expectedCycleRevision,
      appliedAggregateVersion: 1,
      state: 'SUCCEEDED' as const,
      resultRef: ID.freeze,
      errorCode: null,
      acceptedAt: '2027-04-01T00:00:00Z',
      completedAt: '2027-04-01T00:00:01Z',
    },
  };
}

let root: Root;
let mount: HTMLDivElement;
let queryClient: QueryClient;
let latest: ReturnType<typeof usePerformanceReviewOperationsRuntime>;

function Harness({
  dataSource,
  commandExecutors,
  focusResourcePublicId,
  onFocusResourcePublicIdChange,
}: {
  dataSource: PerformanceReviewOperationsDataSource;
  commandExecutors: PerformanceReviewOperationsCommandExecutors;
  focusResourcePublicId?: string;
  onFocusResourcePublicIdChange?: (resourcePublicId: string | null) => void;
}) {
  latest = usePerformanceReviewOperationsRuntime({
    requestScope: scope,
    locale: 'en-US',
    timeZone: 'UTC',
    dataSource,
    commandExecutors,
    focusResourcePublicId,
    onFocusResourcePublicIdChange,
  });
  return null;
}

async function renderHarness(
  dataSource: PerformanceReviewOperationsDataSource,
  commandExecutors: PerformanceReviewOperationsCommandExecutors = {},
  focusResourcePublicId?: string,
  onFocusResourcePublicIdChange?: (resourcePublicId: string | null) => void
) {
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(Harness, {
          dataSource,
          commandExecutors,
          focusResourcePublicId,
          onFocusResourcePublicIdChange,
        })
      )
    );
  });
  await act(async () => {
    await vi.waitFor(() => expect(latest.projection).toBeDefined());
  });
}

describe('performance review-operations runtime', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    mount = document.createElement('div');
    document.body.append(mount);
    root = createRoot(mount);
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    queryClient.clear();
    mount.remove();
    vi.restoreAllMocks();
  });

  it('restores controlled deep-link focus as an owner query filter', async () => {
    const query = vi.fn(async (request: PerformanceReviewOperationsQuery) => projection(request));
    await renderHarness({ query }, {}, ID.cycle);

    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0]?.[0].filter.reviewAssignment?.publicIds).toEqual([ID.cycle]);
    expect(latest.selectedItem?.deepLink.resourcePublicId).toBe(ID.cycle);
  });

  it('requires the exact executor for each advertised action', async () => {
    const query = vi.fn(async (request: PerformanceReviewOperationsQuery) => projection(request));
    const previewPopulation = vi.fn().mockResolvedValue(preview);
    await renderHarness({ query }, { previewPopulation });

    expect(latest.previewExecutorConnected).toBe(true);
    expect(latest.freezeExecutorConnected).toBe(false);
    await act(async () => latest.freezeSelected('Reviewed exact population evidence.'));
    expect(latest.freezeResult).toBeNull();
  });

  it('does not execute an unadvertised action even when its executor is connected', async () => {
    const query = vi.fn(async (request: PerformanceReviewOperationsQuery) => {
      const result = projection(request);
      return {
        ...result,
        items: result.items.map((item) => ({
          ...item,
          availableActions: item.availableActions.filter(
            (action) => action.actionKey !== 'hris.action.per.freeze-population'
          ),
        })),
      } satisfies PerformanceReviewOperationsProjection;
    });
    const previewPopulation = vi.fn().mockResolvedValue(preview);
    const freezePopulation = vi.fn();
    await renderHarness({ query }, { previewPopulation, freezePopulation }, ID.cycle);

    await act(async () => latest.previewSelected());
    await act(async () => latest.freezeSelected('Reviewed exact population evidence.'));

    expect(latest.preview).toEqual(preview);
    expect(latest.freezeExecutorConnected).toBe(true);
    expect(freezePopulation).not.toHaveBeenCalled();
    expect(latest.freezeResult).toBeNull();
  });

  it('updates controlled deep-link focus and never reuses preview evidence across selections', async () => {
    const otherCycle = '88888888-8888-4888-8888-888888888888';
    const query = vi.fn(async (request: PerformanceReviewOperationsQuery) => {
      const result = projection(request);
      const first = result.items[0]!;
      return {
        ...result,
        queryState: {
          ...result.queryState,
          fieldDecisionSummary: { viewCount: 6, maskedCount: 0, omittedCount: 0 },
        },
        items: [
          first,
          {
            ...first,
            itemPublicId: `performance-cycle:${otherCycle}`,
            title: 'FY28 performance review',
            deepLink: { ...first.deepLink, resourcePublicId: otherCycle },
          },
        ],
      } satisfies PerformanceReviewOperationsProjection;
    });
    const previewPopulation = vi.fn().mockResolvedValue(preview);
    const freezePopulation = vi.fn();
    const onFocus = vi.fn();
    await renderHarness({ query }, { previewPopulation, freezePopulation }, undefined, onFocus);

    await act(async () => latest.previewSelected());
    expect(latest.preview).toEqual(preview);
    act(() => latest.selectItem(`performance-cycle:${otherCycle}`));
    await act(async () => {
      await vi.waitFor(() => expect(latest.preview).toBeNull());
    });
    await act(async () => latest.freezeSelected('Reviewed exact population evidence.'));

    expect(onFocus).toHaveBeenCalledWith(otherCycle);
    expect(latest.selectedItem?.deepLink.resourcePublicId).toBe(otherCycle);
    expect(freezePopulation).not.toHaveBeenCalled();
  });

  it('replays the identical command id and payload after an ambiguous network result', async () => {
    const query = vi.fn(async (request: PerformanceReviewOperationsQuery) => projection(request));
    const previewPopulation = vi.fn().mockResolvedValue(preview);
    const freezePopulation = vi
      .fn()
      .mockRejectedValueOnce(new HttpTransportError('NETWORK'))
      .mockImplementationOnce(
        async (_cycleId: string, command: FreezePerformancePopulationCommand) => succeeded(command)
      );
    await renderHarness({ query }, { previewPopulation, freezePopulation }, ID.cycle);

    await act(async () => latest.previewSelected());
    await act(async () => {
      await vi.waitFor(() => expect(latest.previewConfirmedByProjection).toBe(true));
    });
    await act(async () => latest.freezeSelected('Reviewed exact population evidence.'));
    expect(latest.freezeRetryPending).toBe(true);
    expect(freezePopulation).toHaveBeenCalledTimes(1);
    const first = freezePopulation.mock.calls[0]!;

    await act(async () => latest.reconcileFreeze());
    expect(freezePopulation).toHaveBeenCalledTimes(2);
    const second = freezePopulation.mock.calls[1]!;
    expect(second[0]).toBe(first[0]);
    expect(second[1]).toBe(first[1]);
    expect(second[1].commandId).toBe(first[1].commandId);
    expect(second[1]).toEqual(first[1]);
    expect(latest.receipt?.state).toBe('SUCCEEDED');
    expect(latest.freezeRetryPending).toBe(false);
  });

  it.each([
    ['cancel', new HttpTransportError('ABORT')],
    ['validation', new HttpError('Invalid population.', 422)],
    ['conflict', new HttpError('Preview changed.', 409)],
  ])('unlocks a deterministic %s failure without retaining replay state', async (_label, error) => {
    const query = vi.fn(async (request: PerformanceReviewOperationsQuery) => projection(request));
    const previewPopulation = vi.fn().mockResolvedValue(preview);
    const freezePopulation = vi.fn().mockRejectedValue(error);
    await renderHarness({ query }, { previewPopulation, freezePopulation }, ID.cycle);

    await act(async () => latest.previewSelected());
    await act(async () => {
      await vi.waitFor(() => expect(latest.previewConfirmedByProjection).toBe(true));
    });
    await act(async () => latest.freezeSelected('Reviewed exact population evidence.'));

    expect(latest.freezeRetryPending).toBe(false);
    expect(latest.commandError).toBe(error);
  });

  it.each([
    ['timeout', new HttpTransportError('TIMEOUT')],
    ['request timeout', new HttpError('Timed out.', 408)],
    ['rate limited', new HttpError('Try later.', 429)],
    ['server error', new HttpError('Unavailable.', 503)],
  ])('retains the exact command after an ambiguous %s failure', async (_label, error) => {
    const query = vi.fn(async (request: PerformanceReviewOperationsQuery) => projection(request));
    const previewPopulation = vi.fn().mockResolvedValue(preview);
    const freezePopulation = vi.fn().mockRejectedValue(error);
    await renderHarness({ query }, { previewPopulation, freezePopulation }, ID.cycle);

    await act(async () => latest.previewSelected());
    await act(async () => {
      await vi.waitFor(() => expect(latest.previewConfirmedByProjection).toBe(true));
    });
    await act(async () => latest.freezeSelected('Reviewed exact population evidence.'));

    expect(latest.freezeRetryPending).toBe(true);
  });

  it('preserves preview evidence but waits for the refreshed IAQ action before enabling freeze', async () => {
    let releaseRefresh: ((value: PerformanceReviewOperationsProjection) => void) | undefined;
    const query = vi.fn((request: PerformanceReviewOperationsQuery) => {
      if (query.mock.calls.length === 1) {
        const firstPage = projection(request);
        return Promise.resolve({
          ...firstPage,
          queryState: { ...firstPage.queryState, nextCursor: 'a'.repeat(32) },
        });
      }
      if (query.mock.calls.length === 2) return Promise.resolve(projection(request));
      return new Promise<PerformanceReviewOperationsProjection>((resolve) => {
        releaseRefresh = resolve;
      });
    });
    const previewPopulation = vi.fn().mockResolvedValue(preview);
    const freezePopulation = vi.fn();
    await renderHarness({ query }, { previewPopulation, freezePopulation });

    act(() => latest.nextPage());
    await act(async () => {
      await vi.waitFor(() => expect(latest.pageIndex).toBe(1));
    });
    await act(async () => latest.previewSelected());
    expect(latest.preview).toEqual(preview);
    expect(latest.previewConfirmedByProjection).toBe(false);
    await act(async () => latest.freezeSelected('Reviewed exact population evidence.'));
    expect(freezePopulation).not.toHaveBeenCalled();

    const refreshRequest = query.mock.calls[2]?.[0];
    expect(refreshRequest?.cursor).toBeNull();
    expect(latest.pageIndex).toBe(0);
    await act(async () => releaseRefresh?.(projection(refreshRequest!)));
    await act(async () => {
      await vi.waitFor(() => expect(latest.previewConfirmedByProjection).toBe(true));
    });
    expect(latest.preview).toEqual(preview);
  });

  it('retains exact replay state for a nonterminal command receipt', async () => {
    const query = vi.fn(async (request: PerformanceReviewOperationsQuery) => projection(request));
    const previewPopulation = vi.fn().mockResolvedValue(preview);
    const freezePopulation = vi.fn(
      async (_cycleId: string, command: FreezePerformancePopulationCommand) => ({
        freeze: null,
        receipt: {
          receiptId: command.commandId,
          commandType: 'FREEZE_POPULATION' as const,
          originatingAction: 'performance.population.freeze' as const,
          aggregateId: ID.cycle,
          expectedAggregateVersion: command.expectedCycleRevision,
          appliedAggregateVersion: null,
          state: 'ACCEPTED' as const,
          resultRef: null,
          errorCode: null,
          acceptedAt: '2027-04-01T00:00:00Z',
          completedAt: null,
        },
      })
    );
    await renderHarness({ query }, { previewPopulation, freezePopulation }, ID.cycle);

    await act(async () => latest.previewSelected());
    await act(async () => {
      await vi.waitFor(() => expect(latest.previewConfirmedByProjection).toBe(true));
    });
    await act(async () => latest.freezeSelected('Reviewed exact population evidence.'));

    expect(latest.receipt?.state).toBe('ACCEPTED');
    expect(latest.freezeRetryPending).toBe(true);
  });

  it('pins the pending recovery cycle in the query and controlled URL callback', async () => {
    const otherCycle = '88888888-8888-4888-8888-888888888888';
    const query = vi.fn(async (request: PerformanceReviewOperationsQuery) => projection(request));
    const previewPopulation = vi.fn().mockResolvedValue(preview);
    const freezePopulation = vi.fn().mockRejectedValue(new HttpTransportError('NETWORK'));
    const onFocus = vi.fn();
    await renderHarness({ query }, { previewPopulation, freezePopulation }, ID.cycle, onFocus);
    await act(async () => latest.previewSelected());
    await act(async () => {
      await vi.waitFor(() => expect(latest.previewConfirmedByProjection).toBe(true));
    });
    await act(async () => latest.freezeSelected('Reviewed exact population evidence.'));
    expect(latest.freezeRetryPending).toBe(true);

    await renderHarness({ query }, { previewPopulation, freezePopulation }, otherCycle, onFocus);
    await act(async () => {
      await vi.waitFor(() => expect(onFocus).toHaveBeenCalledWith(ID.cycle));
    });
    expect(query.mock.calls.at(-1)?.[0].filter.reviewAssignment?.publicIds).toEqual([ID.cycle]);
    expect(latest.selectedItem?.deepLink.resourcePublicId).toBe(ID.cycle);
  });
});
