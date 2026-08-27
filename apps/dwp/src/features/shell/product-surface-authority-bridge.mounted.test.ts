// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '@dwp-frontend/shared-utils/http-error';

import {
  ProductSurfaceAuthorityBridge,
  resolveActiveGovernedPageRoute,
  resolveGovernedPageEvaluationRoutes,
} from './product-surface-authority-bridge';
import { createGlobalProductApplicationRuntime } from '../../components/create-global-product-application-runtime';
import { GOVERNED_PRODUCT_MANIFESTS } from '../../components/product-manifest-registry';
import { useProductSurfaceCanaryAuthority } from './product-surface-canary-runtime';
import { readProductSurfaceLastRoute } from './product-surface-last-route';
import {
  ALL_PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE,
  PRODUCT_LEGACY_ROUTE_SOURCE,
} from '../../routes/product-page-route-contracts';

import type {
  ProductSurfaceEffectiveContext,
  ProductSurfaceEvaluationData,
  ProductSurfaceEvaluationRequest,
  ProductSurfaceRollout,
} from '@dwp-frontend/shared-utils/api/auth-api';
import type { ProductSurfaceAuthoritySnapshot } from '@dwp-frontend/shared-utils/auth/product-surface-authority-model';
import type { ProductSurfaceAuthorityContextValue } from '@dwp-frontend/shared-utils/auth/product-surface-context-provider';
import type * as ProductSurfaceContextProviderModule from '@dwp-frontend/shared-utils/auth/product-surface-context-provider';
import type { ProductSurfaceCanaryAuthority } from './product-surface-canary-runtime';

const bridgeMocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  useProductSurfaceAuthority: vi.fn(),
}));

vi.mock('@dwp-frontend/shared-utils/auth/auth-provider', () => ({
  useAuth: bridgeMocks.useAuth,
}));

vi.mock(
  '@dwp-frontend/shared-utils/auth/product-surface-context-provider',
  async (importOriginal) => ({
    ...(await importOriginal<typeof ProductSurfaceContextProviderModule>()),
    useProductSurfaceAuthority: bridgeMocks.useProductSurfaceAuthority,
  })
);

const REVISION = 'revision-mounted-1';
const GENERATED_AT = '2029-01-01T00:00:00.000Z';
const REVALIDATE_AT = '2030-01-01T00:00:00.000Z';
const GOVERNED_SURFACE_PAGE_ROUTES = ALL_PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE;
const TEST_RUNTIME = createGlobalProductApplicationRuntime('shell', GOVERNED_PRODUCT_MANIFESTS);
const APPROVALS_PATH = '/approvals/home';
const APPROVALS_MANAGEMENT_PATH = '/approvals/admin/forms';
const APPROVALS_ROUTES = resolveGovernedPageEvaluationRoutes(
  APPROVALS_PATH,
  GOVERNED_SURFACE_PAGE_ROUTES
);
const ACTIVE_ROUTE = resolveActiveGovernedPageRoute(APPROVALS_PATH, GOVERNED_SURFACE_PAGE_ROUTES)!;
const MANAGEMENT_ROUTE = resolveActiveGovernedPageRoute(
  APPROVALS_MANAGEMENT_PATH,
  GOVERNED_SURFACE_PAGE_ROUTES
)!;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

const contexts = [...new Set(APPROVALS_ROUTES.map((route) => route.surfaceId))].map(
  (surfaceId): ProductSurfaceEffectiveContext => ({
    contextKey: `context-${surfaceId}`,
    productKey: 'approvals',
    surfaceKey: surfaceId,
    plane: surfaceId.includes('admin') ? 'management' : 'work',
    accessMode: 'NORMAL',
    accessSource: surfaceId.includes('admin') ? 'MANAGEMENT' : 'ENTITLEMENT',
    appResourceKey: 'APP.APPROVALS',
    effectiveGrants: [],
    scopes: [
      {
        key: `scope-${surfaceId}`,
        kind: 'RESOURCE_SET',
        displayName: surfaceId,
        isDefault: true,
        readOnly: false,
      },
    ],
    revalidateAt: REVALIDATE_AT,
  })
);

const contextBySurface = Object.fromEntries(
  contexts.map((context) => [context.surfaceKey, context])
);

function activePageQueryMeta(overrides: Readonly<Record<string, unknown>> = {}) {
  return {
    accessSensitive: true,
    tenantId: '1',
    actorId: '42',
    accessMode: 'NORMAL',
    productId: ACTIVE_ROUTE.productId,
    surfaceId: ACTIVE_ROUTE.surfaceId,
    contextScopeKey: contextBySurface[ACTIVE_ROUTE.surfaceId]!.scopes[0]!.key,
    decisionRevision: REVISION,
    ...overrides,
  };
}

const snapshot: ProductSurfaceAuthoritySnapshot = {
  envelope: {
    contractVersion: 'product-surfaces/v3',
    decisionRevision: REVISION,
    sourceRevisions: {},
    activeAccessMode: 'NORMAL',
    generatedAt: GENERATED_AT,
    contexts,
    rollouts: [],
  },
  receivedAtMs: Date.parse(GENERATED_AT),
  clockOffsetMs: 0,
  earliestRevalidateAtMs: Date.parse(REVALIDATE_AT),
};

function rollout(
  state: ProductSurfaceRollout['state'],
  surfaceUiEvaluation: 'resolved' | 'unavailable' = 'resolved',
  flags: ProductSurfaceRollout['flags'] = {
    contextShadow: state !== '000',
    capabilityEnforcement: state === '110' || state === '111',
    surfaceUi: state === '111',
  }
) {
  return {
    state: 'ready' as const,
    rollout: {
      productKey: 'approvals',
      state,
      flags,
      cohort: 'mounted-test',
      opaqueRevision: 'rollout-mounted-1',
      authorityStatus:
        state === '110' || state === '111' ? ('AVAILABLE' as const) : ('NOT_EVALUATED' as const),
    },
    surfaceUiEvaluation,
  };
}

function allowedEvaluation(
  request: ProductSurfaceEvaluationRequest,
  options: { readOnly?: boolean } = {}
): ProductSurfaceEvaluationData {
  const context = contextBySurface[request.subject.surfaceKey];
  if (!context) throw new Error(`Missing mounted context: ${request.subject.surfaceKey}`);
  return {
    decision: 'ALLOWED',
    decisionRevision: REVISION,
    context,
    routeGrantRef: request.routeContractKey,
    scope: context.scopes[0],
    effectiveReadOnly: options.readOnly ?? false,
    revalidateAt: REVALIDATE_AT,
  };
}

function authority(
  evaluation: ProductSurfaceAuthorityContextValue['evaluateProduct'],
  resolution: ReturnType<typeof rollout> | { state: 'authority-unavailable' },
  options: {
    productKey?: string;
    snapshot?: ProductSurfaceAuthoritySnapshot;
  } = {}
): ProductSurfaceAuthorityContextValue {
  const productKey = options.productKey ?? 'approvals';
  const authoritySnapshot = options.snapshot ?? snapshot;
  return {
    status: 'ready',
    snapshot: authoritySnapshot,
    serverNowMs: Date.parse(GENERATED_AT),
    rolloutForProduct: (candidateProductKey) =>
      candidateProductKey === productKey ? resolution : { state: 'authority-unavailable' },
    evaluateProduct: evaluation,
    evaluateGoverned: vi.fn(),
    revalidate: vi.fn().mockResolvedValue(true),
  };
}

let root: Root | null;
let container: HTMLDivElement | null;
let queryClient: QueryClient;
let observedAuthority: ProductSurfaceCanaryAuthority | undefined;
let navigateBridge: ReturnType<typeof useNavigate> | undefined;

function AuthorityProbe() {
  navigateBridge = useNavigate();
  observedAuthority = useProductSurfaceCanaryAuthority();
  return null;
}

async function mountBridge(
  pathname: string,
  authorityValue: ProductSurfaceAuthorityContextValue
): Promise<void> {
  bridgeMocks.useProductSurfaceAuthority.mockReturnValue(authorityValue);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(
          MemoryRouter,
          { initialEntries: [pathname] },
          createElement(
            ProductSurfaceAuthorityBridge,
            { runtime: TEST_RUNTIME },
            createElement(AuthorityProbe)
          )
        )
      )
    );
  });
}

async function unmountBridge(): Promise<void> {
  if (!root) return;
  await act(async () => root?.unmount());
  root = null;
}

describe('mounted product surface authority bridge', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    root = null;
    container = null;
    observedAuthority = undefined;
    navigateBridge = undefined;
    window.sessionStorage.clear();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    bridgeMocks.useAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      user: { tenantId: 1, userId: 42 },
    });
  });

  afterEach(async () => {
    await unmountBridge();
    container?.remove();
    queryClient.clear();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it.each([
    ['000 baseline', APPROVALS_PATH, rollout('000')],
    ['100 shadow', APPROVALS_PATH, rollout('100')],
    [
      'invalid rollout',
      APPROVALS_PATH,
      rollout('110', 'resolved', {
        contextShadow: false,
        capabilityEnforcement: true,
        surfaceUi: false,
      }),
    ],
    ['unavailable Surface UI evaluation', APPROVALS_PATH, rollout('111', 'unavailable')],
    ['missing rollout', APPROVALS_PATH, { state: 'authority-unavailable' } as const],
    ['global route', '/apps', rollout('111')],
  ])(
    'sends zero PAGE evaluations for %s and exposes no PAGE decision',
    async (_name, path, mode) => {
      const evaluateProduct = vi.fn();
      await mountBridge(path, authority(evaluateProduct, mode));

      await act(async () => Promise.resolve());

      expect(evaluateProduct).not.toHaveBeenCalled();
      if (path === APPROVALS_PATH) {
        expect(observedAuthority?.routeDecisions?.[ACTIVE_ROUTE.routeContractKey]).toBeUndefined();
        expect(observedAuthority?.surfaceDecisions?.[ACTIVE_ROUTE.surfaceId]).toBeUndefined();
      }
    }
  );

  it('passes a legacy Deep Link scope only to its exact registered PAGE target', async () => {
    const redirect = PRODUCT_LEGACY_ROUTE_SOURCE[0]!;
    const target = GOVERNED_SURFACE_PAGE_ROUTES.find(
      (route) => route.routeContractKey === redirect.targetRouteContractKey
    )!;
    const aliasSnapshot: ProductSurfaceAuthoritySnapshot = {
      ...snapshot,
      envelope: {
        ...snapshot.envelope,
        contexts: [],
      },
    };
    const evaluateProduct = vi.fn(async (request: ProductSurfaceEvaluationRequest) => ({
      decision: 'ROUTE_DENIED' as const,
      decisionRevision: REVISION,
      correlationId: request.routeContractKey,
    }));
    const selectedScope = 'opaque-legacy-selected-scope';

    await mountBridge(
      `${redirect.sourcePath}?scope=${selectedScope}`,
      authority(evaluateProduct, rollout('111'), {
        productKey: target.productId,
        snapshot: aliasSnapshot,
      })
    );
    const planned = resolveGovernedPageEvaluationRoutes(
      redirect.sourcePath,
      GOVERNED_SURFACE_PAGE_ROUTES,
      TEST_RUNTIME.productBoundaries,
      PRODUCT_LEGACY_ROUTE_SOURCE
    );
    await vi.waitFor(() => expect(evaluateProduct).toHaveBeenCalledTimes(planned.length));

    for (const [request] of evaluateProduct.mock.calls) {
      expect(request.contextKey).toBeUndefined();
      expect(request.contextScopeKey).toBe(
        request.routeContractKey === target.routeContractKey ? selectedScope : undefined
      );
    }
  });

  it.each([
    ['110 enforced compatibility', rollout('110')],
    ['111 separated Surface UI', rollout('111')],
  ])(
    'bounds %s PAGE requests to the active product and exact active PAGE scope',
    async (_name, mode) => {
      const evaluateProduct = vi.fn(
        async (
          request: ProductSurfaceEvaluationRequest,
          _options: { signal?: AbortSignal } = {}
        ) => ({
          decision: 'ROUTE_DENIED' as const,
          decisionRevision: REVISION,
          correlationId: request.routeContractKey,
        })
      );
      const selectedScope = 'opaque-selected-scope';

      await mountBridge(
        `${APPROVALS_PATH}?scope=${selectedScope}`,
        authority(evaluateProduct, mode)
      );
      await vi.waitFor(() =>
        expect(evaluateProduct).toHaveBeenCalledTimes(APPROVALS_ROUTES.length)
      );

      const calls = evaluateProduct.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      expect(calls.length).toBeLessThan(GOVERNED_SURFACE_PAGE_ROUTES.length);
      for (const [request, options] of calls) {
        expect(request.subject.productKey).toBe('approvals');
        expect(request.contextKey).toBeUndefined();
        expect(request.contextScopeKey).toBe(
          request.routeContractKey === ACTIVE_ROUTE.routeContractKey ? selectedScope : undefined
        );
        expect(options?.signal).toBeInstanceOf(AbortSignal);
      }
    }
  );

  it('passes React Query AbortSignals through and aborts in-flight PAGE evaluations on unmount', async () => {
    const signals: AbortSignal[] = [];
    const evaluateProduct = vi.fn(
      (_request: ProductSurfaceEvaluationRequest, options: { signal?: AbortSignal } = {}) => {
        if (options.signal) signals.push(options.signal);
        return new Promise<ProductSurfaceEvaluationData>(() => undefined);
      }
    );

    await mountBridge(APPROVALS_PATH, authority(evaluateProduct, rollout('110')));
    await vi.waitFor(() => expect(signals).toHaveLength(APPROVALS_ROUTES.length));
    expect(signals.every((signal) => !signal.aborted)).toBe(true);

    await unmountBridge();

    expect(signals.every((signal) => signal.aborted)).toBe(true);
  });

  it('settles every Work PAGE after an in-flight management-to-work scope transition', async () => {
    const workRoutes = APPROVALS_ROUTES.filter((route) => route.surfaceId === 'approvals.work');
    const evaluateProduct = vi.fn(async (request: ProductSurfaceEvaluationRequest) => {
      const delayMs =
        request.routeContractKey
          .split('')
          .reduce((total, character) => total + character.charCodeAt(0), 0) % 40;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return allowedEvaluation(request);
    });

    await mountBridge(
      '/approvals/admin/workflows?scope=management-scope',
      authority(evaluateProduct, rollout('111'))
    );
    await act(async () => {
      navigateBridge?.(`${APPROVALS_PATH}?scope=work-scope`);
    });
    await act(async () => {
      await vi.waitFor(
        () =>
          expect(
            workRoutes.filter(
              (route) =>
                observedAuthority?.routeDecisions?.[route.routeContractKey]?.state === 'allowed'
            )
          ).toHaveLength(workRoutes.length),
        { timeout: 2_000 }
      );
    });

    expect(workRoutes.length).toBeGreaterThan(0);
    const latestRequestByRoute = new Map(
      evaluateProduct.mock.calls.map(([request]) => [request.routeContractKey, request])
    );
    expect(latestRequestByRoute.get(ACTIVE_ROUTE.routeContractKey)?.contextScopeKey).toBe(
      'work-scope'
    );
    expect(
      workRoutes
        .filter((route) => route.routeContractKey !== ACTIVE_ROUTE.routeContractKey)
        .every(
          (route) => latestRequestByRoute.get(route.routeContractKey)?.contextScopeKey === undefined
        )
    ).toBe(true);
  });

  it('uses the active PAGE allow for Surface presentation instead of a read-only sibling', async () => {
    const evaluateProduct = vi.fn(async (request: ProductSurfaceEvaluationRequest) =>
      allowedEvaluation(request, {
        readOnly:
          request.subject.surfaceKey === ACTIVE_ROUTE.surfaceId &&
          request.routeContractKey !== ACTIVE_ROUTE.routeContractKey,
      })
    );

    await mountBridge(APPROVALS_PATH, authority(evaluateProduct, rollout('111')));
    await act(async () => {
      await vi.waitFor(() =>
        expect(observedAuthority?.surfaceDecisions?.[ACTIVE_ROUTE.surfaceId]?.state).toBe('allowed')
      );
    });

    expect(observedAuthority?.routeDecisions?.[ACTIVE_ROUTE.routeContractKey]).toMatchObject({
      state: 'allowed',
      effectiveReadOnly: false,
    });
    expect(observedAuthority?.surfaceDecisions?.[ACTIVE_ROUTE.surfaceId]).toMatchObject({
      state: 'allowed',
      effectiveReadOnly: false,
      routeGrantRef: ACTIVE_ROUTE.routeContractKey,
    });
  });

  it('stores last Work route convenience state under the list revision, not the direct revision', async () => {
    const evaluateProduct = vi.fn(async (request: ProductSurfaceEvaluationRequest) => ({
      ...allowedEvaluation(request),
      decisionRevision: 'revision-direct-page',
    }));

    await mountBridge(APPROVALS_PATH, authority(evaluateProduct, rollout('111')));
    await vi.waitFor(() =>
      expect(observedAuthority?.routeDecisions?.[ACTIVE_ROUTE.routeContractKey]?.state).toBe(
        'allowed'
      )
    );

    expect(
      readProductSurfaceLastRoute(
        {
          tenantId: '1',
          actorId: '42',
          productId: 'approvals',
          surfaceId: ACTIVE_ROUTE.surfaceId,
        },
        REVISION,
        window.sessionStorage,
        Date.parse(GENERATED_AT)
      )
    ).toBe(ACTIVE_ROUTE.routeId);
  });

  it('does not store or automatically restore a Management PAGE as last-route convenience state', async () => {
    const evaluateProduct = vi.fn(async (request: ProductSurfaceEvaluationRequest) =>
      allowedEvaluation(request)
    );

    await mountBridge(APPROVALS_MANAGEMENT_PATH, authority(evaluateProduct, rollout('111')));
    await vi.waitFor(() =>
      expect(observedAuthority?.routeDecisions?.[MANAGEMENT_ROUTE.routeContractKey]?.state).toBe(
        'allowed'
      )
    );

    expect(contextBySurface[MANAGEMENT_ROUTE.surfaceId]?.plane).toBe('management');
    expect(
      readProductSurfaceLastRoute(
        {
          tenantId: '1',
          actorId: '42',
          productId: MANAGEMENT_ROUTE.productId,
          surfaceId: MANAGEMENT_ROUTE.surfaceId,
        },
        REVISION,
        window.sessionStorage,
        Date.parse(GENERATED_AT)
      )
    ).toBeUndefined();
    expect(window.sessionStorage).toHaveLength(0);
  });

  it('renews direct PAGE leases before expiry and fails closed at the deadline while renewal is pending', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.parse('2029-01-01T00:00:00.000Z'));
    const initialWallNowMs = Date.now();
    const initialMonotonicNowMs = performance.now();
    const initialDeadlineMs = initialWallNowMs + 1_000;
    const renewedDeadline = new Date(initialWallNowMs + 10_000).toISOString();
    const attempts = new Map<string, number>();
    const pendingRenewals = new Map<
      string,
      {
        request: ProductSurfaceEvaluationRequest;
        renewal: ReturnType<typeof deferred<ProductSurfaceEvaluationData>>;
      }
    >();
    const evaluateProduct = vi.fn(async (request: ProductSurfaceEvaluationRequest) => {
      const attempt = (attempts.get(request.routeContractKey) ?? 0) + 1;
      attempts.set(request.routeContractKey, attempt);
      if (attempt === 1) {
        return {
          ...allowedEvaluation(request),
          revalidateAt: new Date(initialDeadlineMs).toISOString(),
        };
      }
      if (attempt === 2) throw new Error('transient direct authority failure');
      const renewal = deferred<ProductSurfaceEvaluationData>();
      pendingRenewals.set(request.routeContractKey, { request, renewal });
      return renewal.promise;
    });

    await mountBridge(APPROVALS_PATH, authority(evaluateProduct, rollout('111')));
    await vi.waitFor(() =>
      expect(observedAuthority?.routeDecisions?.[ACTIVE_ROUTE.routeContractKey]?.state).toBe(
        'allowed'
      )
    );
    const expiredBusinessQueryKey = ['approvals-business', 'expires-with-direct-lease'] as const;
    await queryClient.fetchQuery({
      queryKey: expiredBusinessQueryKey,
      queryFn: async () => ({ private: true }),
      staleTime: Number.POSITIVE_INFINITY,
      meta: activePageQueryMeta(),
    });

    vi.setSystemTime(initialWallNowMs + 86_400_000);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(
        Math.max(0, initialMonotonicNowMs + 800 - performance.now())
      );
    });
    await vi.waitFor(() =>
      expect(attempts.get(ACTIVE_ROUTE.routeContractKey)).toBeGreaterThanOrEqual(2)
    );
    expect(observedAuthority?.routeDecisions?.[ACTIVE_ROUTE.routeContractKey]?.state).toBe(
      'allowed'
    );
    expect(queryClient.getQueryData(expiredBusinessQueryKey)).toEqual({ private: true });

    vi.setSystemTime(initialWallNowMs - 86_400_000);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(
        Math.max(0, initialMonotonicNowMs + 1_000 - performance.now())
      );
    });
    expect(observedAuthority?.routeDecisions?.[ACTIVE_ROUTE.routeContractKey]?.state).toBe(
      'expired'
    );
    expect(pendingRenewals.size).toBe(APPROVALS_ROUTES.length);
    await vi.waitFor(() =>
      expect(queryClient.getQueryData(expiredBusinessQueryKey)).toBeUndefined()
    );

    await act(async () => {
      for (const { request, renewal } of pendingRenewals.values()) {
        renewal.resolve({ ...allowedEvaluation(request), revalidateAt: renewedDeadline });
      }
      await Promise.all([...pendingRenewals.values()].map(({ renewal }) => renewal.promise));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(observedAuthority?.routeDecisions?.[ACTIVE_ROUTE.routeContractKey]?.state).toBe(
      'allowed'
    );
  });

  it('fails closed for changing past deadlines without creating an automatic refetch loop', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.parse('2029-01-01T00:00:00.000Z'));
    const pastDeadlineBaseMs = Date.now() - 1_000;
    const attempts = new Map<string, number>();
    const evaluateProduct = vi.fn(async (request: ProductSurfaceEvaluationRequest) => {
      const attempt = (attempts.get(request.routeContractKey) ?? 0) + 1;
      attempts.set(request.routeContractKey, attempt);
      return {
        ...allowedEvaluation(request),
        revalidateAt: new Date(pastDeadlineBaseMs - attempt).toISOString(),
      };
    });

    await mountBridge(APPROVALS_PATH, authority(evaluateProduct, rollout('111')));
    await vi.waitFor(() =>
      expect(observedAuthority?.routeDecisions?.[ACTIVE_ROUTE.routeContractKey]?.state).toBe(
        'expired'
      )
    );
    expect(evaluateProduct).toHaveBeenCalledTimes(APPROVALS_ROUTES.length);

    await act(async () => {
      await queryClient.refetchQueries({
        type: 'active',
        predicate: (query) => query.queryKey[0] === 'product-surface-direct-evaluation',
      });
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(evaluateProduct).toHaveBeenCalledTimes(APPROVALS_ROUTES.length * 2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(evaluateProduct).toHaveBeenCalledTimes(APPROVALS_ROUTES.length * 2);
    expect(observedAuthority?.routeDecisions?.[ACTIVE_ROUTE.routeContractKey]?.state).toBe(
      'expired'
    );
  });

  it('keeps a route-local 403 authoritative over retained ALLOWED data and evicts exact evaluations when inactive', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.parse('2029-01-01T00:00:00.000Z'));
    let denied = false;
    const evaluateProduct = vi.fn(async (request: ProductSurfaceEvaluationRequest) => {
      if (denied) throw new HttpError('route denied', 403);
      return allowedEvaluation(request);
    });

    await mountBridge(APPROVALS_PATH, authority(evaluateProduct, rollout('111')));
    await vi.waitFor(() =>
      expect(observedAuthority?.routeDecisions?.[ACTIVE_ROUTE.routeContractKey]?.state).toBe(
        'allowed'
      )
    );
    const revokedBusinessQueryKey = ['approvals-business', 'revoked-active-scope'] as const;
    const otherScopeBusinessQueryKey = ['approvals-business', 'other-scope'] as const;
    const retainedGovernedEvaluationKey = [
      'governed-route-direct-evaluation',
      'retained-by-route-local-purge',
    ] as const;
    await Promise.all([
      queryClient.fetchQuery({
        queryKey: revokedBusinessQueryKey,
        queryFn: async () => ({ private: 'revoked' }),
        staleTime: Number.POSITIVE_INFINITY,
        meta: activePageQueryMeta(),
      }),
      queryClient.fetchQuery({
        queryKey: otherScopeBusinessQueryKey,
        queryFn: async () => ({ private: 'other-scope' }),
        staleTime: Number.POSITIVE_INFINITY,
        meta: activePageQueryMeta({ contextScopeKey: 'scope-other' }),
      }),
      queryClient.fetchQuery({
        queryKey: retainedGovernedEvaluationKey,
        queryFn: async () => ({ decision: 'ALLOWED' }),
        staleTime: Number.POSITIVE_INFINITY,
        meta: activePageQueryMeta(),
      }),
    ]);
    let revokedBusinessSignal: AbortSignal | undefined;
    const revokedBusinessFetch = queryClient
      .fetchQuery({
        queryKey: revokedBusinessQueryKey,
        queryFn: ({ signal }) => {
          revokedBusinessSignal = signal;
          return new Promise<{ private: string }>(() => undefined);
        },
        staleTime: 0,
        meta: activePageQueryMeta(),
      })
      .catch(() => undefined);
    await vi.waitFor(() => expect(revokedBusinessSignal).toBeInstanceOf(AbortSignal));
    denied = true;
    await act(async () => {
      await queryClient.refetchQueries({
        type: 'active',
        predicate: (query) => query.queryKey[0] === 'product-surface-direct-evaluation',
      });
      await vi.advanceTimersByTimeAsync(0);
      await vi.waitFor(() =>
        expect(
          APPROVALS_ROUTES.every(
            (route) =>
              observedAuthority?.routeDecisions?.[route.routeContractKey]?.state === 'route-denied'
          )
        ).toBe(true)
      );
      await vi.waitFor(() =>
        expect(queryClient.getQueryData(revokedBusinessQueryKey)).toBeUndefined()
      );
      await vi.waitFor(() => expect(revokedBusinessSignal?.aborted).toBe(true));
    });
    await revokedBusinessFetch;
    expect(queryClient.getQueryData(otherScopeBusinessQueryKey)).toEqual({
      private: 'other-scope',
    });
    expect(queryClient.getQueryData(retainedGovernedEvaluationKey)).toEqual({
      decision: 'ALLOWED',
    });
    expect(
      queryClient.getQueryCache().findAll({
        predicate: (query) => query.queryKey[0] === 'product-surface-direct-evaluation',
      }).length
    ).toBeGreaterThan(0);

    await act(async () => navigateBridge?.('/apps'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(
      queryClient.getQueryCache().findAll({
        predicate: (query) => query.queryKey[0] === 'product-surface-direct-evaluation',
      })
    ).toHaveLength(0);
  });
});
