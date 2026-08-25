// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  GOVERNED_SURFACE_PAGE_ROUTES,
  ProductSurfaceAuthorityBridge,
  resolveActiveGovernedPageRoute,
  resolveGovernedPageEvaluationRoutes,
} from './product-surface-authority-bridge';
import { useProductSurfaceCanaryAuthority } from './product-surface-canary-runtime';

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
const APPROVALS_PATH = '/approvals/home';
const APPROVALS_ROUTES = resolveGovernedPageEvaluationRoutes(
  APPROVALS_PATH,
  GOVERNED_SURFACE_PAGE_ROUTES
);
const ACTIVE_ROUTE = resolveActiveGovernedPageRoute(APPROVALS_PATH)!;

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
      authorityStatus: state === '111' ? ('AVAILABLE' as const) : ('NOT_EVALUATED' as const),
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
  resolution: ReturnType<typeof rollout> | { state: 'authority-unavailable' }
): ProductSurfaceAuthorityContextValue {
  return {
    status: 'ready',
    snapshot,
    serverNowMs: Date.parse(GENERATED_AT),
    rolloutForProduct: (productKey) =>
      productKey === 'approvals' ? resolution : { state: 'authority-unavailable' },
    evaluateProduct: evaluation,
    evaluateGoverned: vi.fn(),
    revalidate: vi.fn().mockResolvedValue(true),
  };
}

let root: Root | null;
let container: HTMLDivElement | null;
let queryClient: QueryClient;
let observedAuthority: ProductSurfaceCanaryAuthority | undefined;

function AuthorityProbe() {
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
          createElement(ProductSurfaceAuthorityBridge, null, createElement(AuthorityProbe))
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

  it.each([
    ['110 enforced compatibility', rollout('110')],
    ['111 separated Surface UI', rollout('111')],
  ])(
    'bounds %s PAGE requests to the active product and exact active Surface scope',
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
        expect(request.contextScopeKey).toBe(
          request.subject.surfaceKey === ACTIVE_ROUTE.surfaceId ? selectedScope : undefined
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
});
