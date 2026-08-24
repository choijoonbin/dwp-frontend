import { useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import { matchPath, useLocation } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import { HttpError } from '@dwp-frontend/shared-utils/http-error';
import { useAuth } from '@dwp-frontend/shared-utils/auth/auth-provider';
import {
  productSurfaceEvaluationQueryKey,
  useProductSurfaceAuthority,
} from '@dwp-frontend/shared-utils/auth/product-surface-context-provider';

import { PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE } from '../../routes/product-page-route-contracts';
import {
  isSegmentOwnedPath,
  matchesProductRoute,
  normalizeProductPath,
  type ProductSurfaceManifest,
} from '../../components/product-manifest';
import { GOVERNED_PRODUCT_MANIFESTS } from '../../components/product-manifest-registry';
import { productSurfaceOperationCoordinator } from '../../components/product-surface-operation-coordinator';
import { ProductSurfaceCanaryProvider } from './product-surface-canary-runtime';
import {
  mapProductSurfaceAccessError,
  mapProductSurfaceDirectEvaluation,
} from './product-surface-context';

import type {
  ProductSurfaceEffectiveContext,
  ProductSurfaceEvaluationData,
  ProductSurfaceEvaluationRequest,
} from '@dwp-frontend/shared-utils/api/auth-api';
import type { ProductSurfaceAuthoritySnapshot } from '@dwp-frontend/shared-utils/auth/product-surface-authority-model';
import type {
  ProductSurfaceCanaryAuthority,
  ProductSurfaceRolloutFlags,
} from './product-surface-canary-runtime';
import type {
  EffectiveProductSurfaceContext,
  EffectiveProductSurfaceContextEnvelope,
  ProductSurfaceDirectEvaluation,
  SurfaceDecision,
} from './product-surface-context';
import type { ProductSurfaceOperationTarget } from '../../components/product-surface-operation-coordinator';

const CANARY_PRODUCTS = ['approvals', 'communications', 'services'] as const;
const INVALID_FLAGS: ProductSurfaceRolloutFlags = {
  contextShadow: false,
  capabilityEnforcement: true,
  surfaceUi: false,
  surfaceUiEvaluation: 'unavailable',
};
const CANARY_ROUTES = PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE.filter((route) =>
  (CANARY_PRODUCTS as readonly string[]).includes(route.productId)
);
const CANARY_MANIFESTS = GOVERNED_PRODUCT_MANIFESTS;

type ProductSurfaceNavigationObservation = Readonly<{
  locationKey: string;
  target?: ProductSurfaceOperationTarget;
}>;

function sameOperationTarget(
  left: ProductSurfaceOperationTarget | undefined,
  right: ProductSurfaceOperationTarget | undefined
): boolean {
  return Boolean(
    left && right && left.productKey === right.productKey && left.surfaceKey === right.surfaceKey
  );
}

export function resolveGovernedSurfaceOperationTarget(
  surfaceId: string | undefined,
  routes: readonly Pick<(typeof CANARY_ROUTES)[number], 'productId' | 'surfaceId'>[] = CANARY_ROUTES
): ProductSurfaceOperationTarget | undefined {
  if (!surfaceId) return undefined;
  const owners = [
    ...new Set(
      routes.filter((route) => route.surfaceId === surfaceId).map((route) => route.productId)
    ),
  ];
  return owners.length === 1 ? { productKey: owners[0]!, surfaceKey: surfaceId } : undefined;
}

export function observeProductSurfaceLocationChange(
  previous: ProductSurfaceNavigationObservation,
  current: ProductSurfaceNavigationObservation,
  requestedScopeKey: string | null
): void {
  if (previous.locationKey === current.locationKey || !previous.target) return;
  productSurfaceOperationCoordinator.observeNavigation(
    previous.target,
    sameOperationTarget(previous.target, current.target) ? requestedScopeKey : null
  );
}

export function resolveActiveGovernedSurfaceId(
  pathname: string,
  routes: readonly Pick<(typeof CANARY_ROUTES)[number], 'pattern' | 'surfaceId'>[],
  manifests: readonly ProductSurfaceManifest[] = []
): string | undefined {
  const matches = routes.filter((route) =>
    matchPath({ path: route.pattern, end: true, caseSensitive: false }, pathname)
  );
  if (matches.length === 1) return matches[0]!.surfaceId;
  if (matches.length > 1) return undefined;

  const normalizedPath = normalizeProductPath(pathname);
  const candidates = manifests.flatMap((manifest) => {
    if (
      normalizedPath === manifest.basePath ||
      !isSegmentOwnedPath(normalizedPath, manifest.basePath)
    ) {
      return [];
    }
    return manifest.surfaces.flatMap((surface) =>
      surface.routeMatchers
        .filter((matcher) => matchesProductRoute(normalizedPath, matcher))
        .map((matcher) => ({ surfaceId: surface.id, specificity: matcher.path.length }))
    );
  });
  candidates.sort((left, right) => right.specificity - left.specificity);
  const best = candidates[0];
  if (!best) return undefined;
  return candidates.some(
    (candidate) =>
      candidate.specificity === best.specificity && candidate.surfaceId !== best.surfaceId
  )
    ? undefined
    : best.surfaceId;
}

function effectiveContext(context: ProductSurfaceEffectiveContext): EffectiveProductSurfaceContext {
  return {
    ...context,
    plane: context.plane as EffectiveProductSurfaceContext['plane'],
    effectiveGrants: context.effectiveGrants.map((grant) => ({
      ...grant,
      validUntil: grant.validUntil ?? undefined,
      responsibility:
        grant.grantKind === 'CAPABILITY' ? (grant.responsibility ?? undefined) : undefined,
    })) as EffectiveProductSurfaceContext['effectiveGrants'],
    scopes: context.scopes.map((scope) => ({
      ...scope,
      kind: scope.kind as EffectiveProductSurfaceContext['scopes'][number]['kind'],
      validUntil: scope.validUntil ?? undefined,
    })),
  };
}

function effectiveEnvelope(
  snapshot: ProductSurfaceAuthoritySnapshot
): EffectiveProductSurfaceContextEnvelope {
  return {
    contractVersion: snapshot.envelope.contractVersion,
    decisionRevision: snapshot.envelope.decisionRevision,
    sourceRevisions: Object.fromEntries(
      Object.entries(snapshot.envelope.sourceRevisions).filter(
        (entry): entry is [string, string] =>
          typeof entry[1] === 'string' && Boolean(entry[1].trim())
      )
    ),
    activeAccessMode: snapshot.envelope.activeAccessMode,
    generatedAt: snapshot.envelope.generatedAt,
    contexts: snapshot.envelope.contexts.map(effectiveContext),
  };
}

function directEvaluation(data: ProductSurfaceEvaluationData): ProductSurfaceDirectEvaluation {
  return {
    decision: data.decision,
    decisionRevision: data.decisionRevision ?? undefined,
    context: data.context ? effectiveContext(data.context) : undefined,
    routeGrantRef: data.routeGrantRef ?? undefined,
    scope: data.scope
      ? {
          ...data.scope,
          kind: data.scope.kind as EffectiveProductSurfaceContext['scopes'][number]['kind'],
          validUntil: data.scope.validUntil ?? undefined,
        }
      : undefined,
    effectiveReadOnly: data.effectiveReadOnly ?? undefined,
    revalidateAt: data.revalidateAt ?? undefined,
    validUntil: data.validUntil ?? undefined,
    expiredAt: data.expiredAt ?? undefined,
    requiredAssurance: data.requiredAssurance ?? undefined,
    requestPolicyRef: data.requestPolicyRef ?? undefined,
  };
}

function decisionFromError(error: unknown): SurfaceDecision {
  if (!(error instanceof HttpError)) return { state: 'authority-unavailable' };
  const details =
    error.details && typeof error.details === 'object'
      ? (error.details as { errorCode?: unknown; decisionRevision?: unknown })
      : undefined;
  return mapProductSurfaceAccessError({
    status: error.status,
    reasonCode: typeof details?.errorCode === 'string' ? details.errorCode : undefined,
    decisionRevision:
      typeof details?.decisionRevision === 'string' ? details.decisionRevision : undefined,
  });
}

function surfaceDecision(decisions: readonly SurfaceDecision[]): SurfaceDecision {
  return (
    decisions.find((decision) => decision.state === 'allowed') ??
    decisions.find((decision) => decision.state === 'authority-unavailable') ??
    decisions[0] ?? { state: 'authority-unavailable' }
  );
}

export function ProductSurfaceAuthorityBridge({ children }: { children: ReactNode }) {
  const authority = useProductSurfaceAuthority();
  const auth = useAuth();
  const location = useLocation();
  const snapshot = authority.status === 'ready' ? authority.snapshot : undefined;
  const envelope = useMemo(() => (snapshot ? effectiveEnvelope(snapshot) : undefined), [snapshot]);
  const productFlags = useMemo(
    () =>
      Object.fromEntries(
        CANARY_PRODUCTS.map((productKey) => {
          const resolution = authority.rolloutForProduct(productKey);
          return [
            productKey,
            resolution.state === 'ready'
              ? {
                  ...resolution.rollout.flags,
                  surfaceUiEvaluation: resolution.surfaceUiEvaluation,
                }
              : INVALID_FLAGS,
          ];
        })
      ) as Record<string, ProductSurfaceRolloutFlags>,
    [authority]
  );
  const requestedScope = useMemo(
    () => new URLSearchParams(location.search).get('scope') ?? undefined,
    [location.search]
  );
  const activeSurfaceId = useMemo(
    () => resolveActiveGovernedSurfaceId(location.pathname, CANARY_ROUTES, CANARY_MANIFESTS),
    [location.pathname]
  );
  const activeOperationTarget = useMemo(
    () => resolveGovernedSurfaceOperationTarget(activeSurfaceId),
    [activeSurfaceId]
  );
  const navigationObservationRef = useRef<ProductSurfaceNavigationObservation>({
    locationKey: location.key,
    target: activeOperationTarget,
  });

  useLayoutEffect(() => {
    const current = {
      locationKey: location.key,
      target: activeOperationTarget,
    } satisfies ProductSurfaceNavigationObservation;
    observeProductSurfaceLocationChange(
      navigationObservationRef.current,
      current,
      requestedScope ?? null
    );
    navigationObservationRef.current = current;
  }, [activeOperationTarget, location.key, requestedScope]);
  const requests = useMemo(() => {
    if (!snapshot || !envelope) return [];
    return CANARY_ROUTES.flatMap((route) => {
      if (!productFlags[route.productId]?.capabilityEnforcement) return [];
      const context = envelope.contexts.find(
        (candidate) =>
          candidate.productKey === route.productId && candidate.surfaceKey === route.surfaceId
      );
      const request: ProductSurfaceEvaluationRequest = {
        subject: {
          type: 'PRODUCT',
          productKey: route.productId,
          surfaceKey: route.surfaceId,
        },
        routeContractKey: route.routeContractKey,
        contextKey: context?.contextKey,
        contextScopeKey: route.surfaceId === activeSurfaceId ? requestedScope : undefined,
      };
      return [{ route, request }];
    });
  }, [activeSurfaceId, envelope, productFlags, requestedScope, snapshot]);
  const evaluations = useQueries({
    queries: requests.map(({ route, request }) => ({
      queryKey: productSurfaceEvaluationQueryKey(snapshot!, request, {
        tenantId: String(auth.user?.tenantId ?? ''),
        actorId: String(auth.user?.userId ?? ''),
      }),
      queryFn: () => authority.evaluateProduct(request),
      retry: false,
      staleTime: Number.POSITIVE_INFINITY,
      meta: {
        accessSensitive: true,
        tenantId: String(auth.user?.tenantId ?? ''),
        actorId: String(auth.user?.userId ?? ''),
        accessMode: snapshot!.envelope.activeAccessMode,
        productId: route.productId,
        surfaceId: route.surfaceId,
        contextScopeKey: request.contextScopeKey ?? '',
        decisionRevision: snapshot!.envelope.decisionRevision,
      },
    })),
  });
  const routeDecisions = useMemo(() => {
    const entries = requests.map(({ route }, index) => {
      const result = evaluations[index];
      const decision = result?.data
        ? mapProductSurfaceDirectEvaluation(
            directEvaluation(result.data),
            { productKey: route.productId, surfaceKey: route.surfaceId },
            authority.serverNowMs
          )
        : result?.error
          ? decisionFromError(result.error)
          : ({ state: 'authority-unavailable' } as const);
      return [route.routeContractKey, decision] as const;
    });
    return Object.fromEntries(entries);
  }, [authority.serverNowMs, evaluations, requests]);
  const pendingRoutes = useMemo(
    () =>
      Object.fromEntries(
        requests.map(({ route }, index) => [
          route.routeContractKey,
          evaluations[index]?.isPending === true,
        ])
      ),
    [evaluations, requests]
  );
  const pendingSurfaces = useMemo(
    () =>
      Object.fromEntries(
        [...new Set(requests.map(({ route }) => route.surfaceId))].map((surfaceId) => [
          surfaceId,
          requests.some(
            ({ route }) => route.surfaceId === surfaceId && pendingRoutes[route.routeContractKey]
          ),
        ])
      ),
    [pendingRoutes, requests]
  );
  const surfaceDecisions = useMemo(
    () =>
      Object.fromEntries(
        [...new Set(requests.map(({ route }) => route.surfaceId))].map((surfaceId) => [
          surfaceId,
          surfaceDecision(
            requests
              .filter(({ route }) => route.surfaceId === surfaceId)
              .map(({ route }) => routeDecisions[route.routeContractKey]!)
          ),
        ])
      ),
    [requests, routeDecisions]
  );
  const canaryAuthority = useMemo<ProductSurfaceCanaryAuthority>(
    () => ({
      flags: INVALID_FLAGS,
      authorityPending: authority.status === 'loading',
      productFlags,
      envelope,
      surfaceDecisions,
      routeDecisions,
      pendingRoutes,
      pendingSurfaces,
      serverNowMs: authority.serverNowMs,
      revalidate: authority.revalidate,
    }),
    [
      authority.revalidate,
      authority.serverNowMs,
      authority.status,
      envelope,
      productFlags,
      pendingRoutes,
      pendingSurfaces,
      routeDecisions,
      surfaceDecisions,
    ]
  );

  return (
    <ProductSurfaceCanaryProvider authority={canaryAuthority}>
      {children}
    </ProductSurfaceCanaryProvider>
  );
}
