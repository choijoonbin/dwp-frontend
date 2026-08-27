// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '@dwp-frontend/shared-utils/http-error';

import { useGovernedRouteAccessDecision } from './governed-route-access-guard';

import type {
  GovernedRouteEvaluationData,
  GovernedRouteEvaluationRequest,
} from '@dwp-frontend/shared-utils/api/auth-api';
import type { ProductSurfaceAuthoritySnapshot } from '@dwp-frontend/shared-utils/auth/product-surface-authority-model';
import type { ProductSurfaceAuthorityContextValue } from '@dwp-frontend/shared-utils/auth/product-surface-context-provider';
import type * as ProductSurfaceContextProviderModule from '@dwp-frontend/shared-utils/auth/product-surface-context-provider';
import type { GovernedRouteAccessDecision } from './governed-route-access-guard';

const guardMocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  useProductSurfaceAuthority: vi.fn(),
}));

vi.mock('@dwp-frontend/shared-utils/auth/auth-provider', () => ({
  useAuth: guardMocks.useAuth,
}));

vi.mock(
  '@dwp-frontend/shared-utils/auth/product-surface-context-provider',
  async (importOriginal) => ({
    ...(await importOriginal<typeof ProductSurfaceContextProviderModule>()),
    useProductSurfaceAuthority: guardMocks.useProductSurfaceAuthority,
  })
);

const request: GovernedRouteEvaluationRequest = {
  subject: { type: 'GOVERNED_CONTEXT' },
  navigationContextId: 'work.work',
  routeContractKey: 'route.context.work__work.review-detail.data',
  target: { opaqueTargetRef: 'opaque-work-ref' },
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function snapshot(nowMs: number): ProductSurfaceAuthoritySnapshot {
  return {
    envelope: {
      contractVersion: 'product-surfaces/v3',
      decisionRevision: 'list-revision-1',
      sourceRevisions: {},
      activeAccessMode: 'NORMAL',
      generatedAt: new Date(nowMs).toISOString(),
      contexts: [],
      rollouts: [],
    },
    receivedAtMs: nowMs,
    clockOffsetMs: 0,
    earliestRevalidateAtMs: null,
  };
}

function allowed(revalidateAt: string): GovernedRouteEvaluationData {
  return {
    decision: 'ALLOWED',
    decisionRevision: 'governed-revision-1',
    context: {
      contextKey: 'governed-context-1',
      navigationContextId: request.navigationContextId,
      accessSource: 'RELATIONSHIP',
      accessMode: 'NORMAL',
      routeGrantRef: 'named-reviewer-assignment',
      effectiveReadOnly: false,
      decisionRevision: 'governed-revision-1',
      revalidateAt,
    },
  };
}

function authority(
  authoritySnapshot: ProductSurfaceAuthoritySnapshot,
  evaluateGoverned: ProductSurfaceAuthorityContextValue['evaluateGoverned']
): ProductSurfaceAuthorityContextValue {
  return {
    status: 'ready',
    snapshot: authoritySnapshot,
    serverNowMs: Date.parse(authoritySnapshot.envelope.generatedAt),
    rolloutForProduct: () => ({ state: 'authority-unavailable' }),
    evaluateProduct: vi.fn(),
    evaluateGoverned,
    revalidate: vi.fn().mockResolvedValue(true),
  };
}

let root: Root | null;
let container: HTMLDivElement | null;
let queryClient: QueryClient;
let observedDecision: GovernedRouteAccessDecision | undefined;

function DecisionProbe() {
  observedDecision = useGovernedRouteAccessDecision(request);
  return null;
}

async function mountGuard(authorityValue: ProductSurfaceAuthorityContextValue): Promise<void> {
  guardMocks.useProductSurfaceAuthority.mockReturnValue(authorityValue);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
      createElement(QueryClientProvider, { client: queryClient }, createElement(DecisionProbe))
    );
  });
}

describe('mounted governed route access guard', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    root = null;
    container = null;
    observedDecision = undefined;
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    guardMocks.useAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      user: { tenantId: 1, userId: 42 },
    });
  });

  afterEach(async () => {
    if (root) await act(async () => root?.unmount());
    root = null;
    container?.remove();
    queryClient.clear();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('keeps a retained allow before expiry and fails closed while the deadline refetch is pending', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.parse('2029-01-01T00:00:00.000Z'));
    const initialWallNowMs = Date.now();
    const initialMonotonicNowMs = performance.now();
    const initialDeadlineMs = initialWallNowMs + 1_000;
    const renewal = deferred<GovernedRouteEvaluationData>();
    let attempt = 0;
    const evaluateGoverned = vi.fn(async () => {
      attempt += 1;
      if (attempt === 1) return allowed(new Date(initialDeadlineMs).toISOString());
      if (attempt === 2) throw new Error('transient governed authority failure');
      return renewal.promise;
    });

    await mountGuard(authority(snapshot(Date.now()), evaluateGoverned));
    await vi.waitFor(() => expect(observedDecision?.state).toBe('allowed'));

    vi.setSystemTime(initialWallNowMs + 86_400_000);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(
        Math.max(0, initialMonotonicNowMs + 800 - performance.now())
      );
    });
    await vi.waitFor(() => expect(evaluateGoverned).toHaveBeenCalledTimes(2));
    expect(observedDecision?.state).toBe('allowed');

    vi.setSystemTime(initialWallNowMs - 86_400_000);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(
        Math.max(0, initialMonotonicNowMs + 1_000 - performance.now())
      );
    });
    expect(evaluateGoverned).toHaveBeenCalledTimes(3);
    expect(observedDecision?.state).toBe('authority-unavailable');

    await act(async () => {
      renewal.resolve(allowed(new Date(initialWallNowMs + 10_000).toISOString()));
      await renewal.promise;
      await vi.advanceTimersByTimeAsync(0);
      await vi.waitFor(() => expect(observedDecision?.state).toBe('allowed'));
    });
  });

  it('does not automatically refetch changing past deadlines', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.parse('2029-01-01T00:00:00.000Z'));
    const pastDeadlineBaseMs = Date.now() - 1_000;
    let attempt = 0;
    const evaluateGoverned = vi.fn(async () => {
      attempt += 1;
      return allowed(new Date(pastDeadlineBaseMs - attempt).toISOString());
    });

    await mountGuard(authority(snapshot(Date.now()), evaluateGoverned));
    await vi.waitFor(() => expect(observedDecision?.state).toBe('authority-unavailable'));
    expect(evaluateGoverned).toHaveBeenCalledTimes(1);

    await act(async () => {
      await queryClient.refetchQueries({
        type: 'active',
        predicate: (query) => query.queryKey[0] === 'governed-route-direct-evaluation',
      });
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(evaluateGoverned).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(evaluateGoverned).toHaveBeenCalledTimes(2);
    expect(observedDecision?.state).toBe('authority-unavailable');
  });

  it('prioritizes a route-local 403 over retained data and garbage-collects the exact query on unmount', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.parse('2029-01-01T00:00:00.000Z'));
    let denied = false;
    const evaluateGoverned = vi.fn(async () => {
      if (denied) throw new HttpError('route denied', 403);
      return allowed(new Date(Date.now() + 60_000).toISOString());
    });

    await mountGuard(authority(snapshot(Date.now()), evaluateGoverned));
    await vi.waitFor(() => expect(observedDecision?.state).toBe('allowed'));
    denied = true;
    await act(async () => {
      await queryClient.refetchQueries({
        type: 'active',
        predicate: (query) => query.queryKey[0] === 'governed-route-direct-evaluation',
      });
      await vi.advanceTimersByTimeAsync(0);
      await vi.waitFor(() => expect(observedDecision?.state).toBe('route-denied'));
    });

    await act(async () => {
      root?.unmount();
      root = null;
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(
      queryClient.getQueryCache().findAll({
        predicate: (query) => query.queryKey[0] === 'governed-route-direct-evaluation',
      })
    ).toHaveLength(0);
  });
});
