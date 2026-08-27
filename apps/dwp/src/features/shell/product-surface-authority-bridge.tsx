import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { matchPath, useLocation } from 'react-router-dom';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { HttpError } from '@dwp-frontend/shared-utils/http-error';
import { useAuth } from '@dwp-frontend/shared-utils/auth/auth-provider';
import {
  productSurfaceEvaluationQueryKey,
  useProductSurfaceAuthority,
} from '@dwp-frontend/shared-utils/auth/product-surface-context-provider';

import {
  isSegmentOwnedPath,
  normalizeProductPath,
  type ProductSurfaceManifest,
} from '../../components/product-manifest';
import type { ProductApplicationRuntime } from '../../components/product-application-runtime';
import {
  createDirectDecisionClockAnchor,
  directDecisionServerNow,
  readMonotonicNowMs,
  scheduleDirectDecisionLease,
} from '../../components/direct-decision-lease';
import { productSurfaceOperationCoordinator } from '../../components/product-surface-operation-coordinator';
import {
  isProductSurfaceEnforced,
  ProductSurfaceCanaryProvider,
  resolveProductSurfaceRolloutMode,
} from './product-surface-canary-runtime';
import {
  purgeForeignProductSurfaceLastRoutes,
  purgeProductSurfaceLastRoutes,
  readProductSurfaceLastRoute,
  storeProductSurfaceLastRoute,
} from './product-surface-last-route';
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
import type { ProductPageRouteContractSource } from '../../routes/product-route-contract-source';

const INVALID_FLAGS: ProductSurfaceRolloutFlags = {
  contextShadow: false,
  capabilityEnforcement: true,
  surfaceUi: false,
  surfaceUiEvaluation: 'unavailable',
};
type ProductSurfaceNavigationObservation = Readonly<{
  locationKey: string;
  target?: ProductSurfaceOperationTarget;
}>;

type ActivePageAllowedQueryIdentity = Readonly<{
  routeContractKey: string;
  tenantId: string;
  actorId: string;
  accessMode: string;
  productId: string;
  surfaceId: string;
  contextScopeKey: string;
  decisionRevision: string;
}>;

const DIRECT_EVALUATION_QUERY_PREFIXES = new Set([
  'product-surface-direct-evaluation',
  'governed-route-direct-evaluation',
]);

function revokesActivePageData(decision: SurfaceDecision | undefined): boolean {
  return Boolean(
    decision && decision.state !== 'allowed' && decision.state !== 'authority-unavailable'
  );
}

function isRouteLocalDirectEvaluationDenial(error: unknown): boolean {
  return error instanceof HttpError && (error.status === 403 || error.status === 404);
}

function matchesRevokedActivePageQuery(
  candidate: {
    queryKey: readonly unknown[];
    meta?: Readonly<Record<string, unknown>>;
  },
  identity: ActivePageAllowedQueryIdentity
): boolean {
  const prefix = candidate.queryKey[0];
  if (typeof prefix === 'string' && DIRECT_EVALUATION_QUERY_PREFIXES.has(prefix)) return false;
  const meta = candidate.meta;
  return Boolean(
    meta?.accessSensitive === true &&
    meta.tenantId === identity.tenantId &&
    meta.actorId === identity.actorId &&
    meta.accessMode === identity.accessMode &&
    meta.productId === identity.productId &&
    meta.surfaceId === identity.surfaceId &&
    meta.contextScopeKey === identity.contextScopeKey &&
    meta.decisionRevision === identity.decisionRevision
  );
}

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
  routes: readonly Pick<ProductPageRouteContractSource, 'productId' | 'surfaceId'>[] = []
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
  routes: readonly (Pick<ProductPageRouteContractSource, 'pattern' | 'surfaceId'> &
    Partial<Pick<ProductPageRouteContractSource, 'routeContractKey'>>)[],
  manifests: readonly ProductSurfaceManifest[] = [],
  legacyRedirects: readonly {
    sourcePath: `/${string}`;
    targetRouteContractKey: string;
  }[] = []
): string | undefined {
  const canonicalPathname = decodeGovernedPathname(pathname);
  const matches = matchingGovernedPageRoutes(canonicalPathname, routes);
  const pageRoute = highestSpecificityPageRoute(matches);
  if (pageRoute) return pageRoute.surfaceId;
  if (matches.length > 0) return undefined;

  const normalizedPath = normalizeProductPath(canonicalPathname);
  const legacyRedirect = legacyRedirects.find(
    (candidate) =>
      governedPathOwnershipKey(candidate.sourcePath) === governedPathOwnershipKey(normalizedPath)
  );
  if (legacyRedirect) {
    const targetSurfaceIds = [
      ...new Set(
        routes
          .filter((route) => route.routeContractKey === legacyRedirect.targetRouteContractKey)
          .map((route) => route.surfaceId)
      ),
    ];
    return targetSurfaceIds.length === 1 ? targetSurfaceIds[0] : undefined;
  }

  const candidates = manifests.flatMap((manifest) => {
    if (
      governedPathOwnershipKey(normalizedPath) === governedPathOwnershipKey(manifest.basePath) ||
      !isGovernedSegmentOwnedPath(normalizedPath, manifest.basePath)
    ) {
      return [];
    }
    return manifest.surfaces.flatMap((surface) =>
      surface.routeMatchers
        .filter((matcher) => matchesGovernedProductRoute(normalizedPath, matcher))
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

export function resolveActiveGovernedPageRoute(
  pathname: string,
  routes?: readonly ProductPageRouteContractSource[]
): ProductPageRouteContractSource | undefined;
export function resolveActiveGovernedPageRoute<T extends { pattern: string }>(
  pathname: string,
  routes: readonly T[]
): T | undefined;
export function resolveActiveGovernedPageRoute(
  pathname: string,
  routes: readonly { pattern: string }[] = []
) {
  return highestSpecificityPageRoute(
    matchingGovernedPageRoutes(decodeGovernedPathname(pathname), routes)
  );
}

export function resolveActiveGovernedEvaluationRouteContractKey(
  pathname: string,
  routes: readonly { pattern: string; routeContractKey: string }[] = [],
  legacyRedirects: readonly {
    sourcePath: `/${string}`;
    targetRouteContractKey: string;
  }[] = []
): string | undefined {
  const canonicalPathname = decodeGovernedPathname(pathname);
  const activePage = resolveActiveGovernedPageRoute(canonicalPathname, routes);
  if (activePage) return activePage.routeContractKey;

  const normalizedPath = normalizeProductPath(canonicalPathname);
  const redirectTargets = legacyRedirects
    .filter(
      (redirect) =>
        governedPathOwnershipKey(redirect.sourcePath) === governedPathOwnershipKey(normalizedPath)
    )
    .map((redirect) => redirect.targetRouteContractKey);
  if (redirectTargets.length !== 1) return undefined;
  const matchingTargets = routes.filter((route) => route.routeContractKey === redirectTargets[0]);
  return matchingTargets.length === 1 ? matchingTargets[0]!.routeContractKey : undefined;
}

export function resolveActiveGovernedProductId(
  pathname: string,
  routes: readonly Pick<
    ProductPageRouteContractSource,
    'pattern' | 'productId' | 'routeContractKey'
  >[] = [],
  manifests: readonly Pick<ProductSurfaceManifest, 'id' | 'basePath'>[] = [],
  legacyRedirects: readonly {
    sourcePath: `/${string}`;
    targetRouteContractKey: string;
  }[] = []
): string | undefined {
  const canonicalPathname = decodeGovernedPathname(pathname);
  const pageRoute = resolveActiveGovernedPageRoute(canonicalPathname, routes);
  if (pageRoute) return pageRoute.productId;

  const normalizedPath = normalizeProductPath(canonicalPathname);
  const legacyRedirect = legacyRedirects.find(
    (candidate) =>
      governedPathOwnershipKey(candidate.sourcePath) === governedPathOwnershipKey(normalizedPath)
  );
  if (legacyRedirect) {
    const owners = [
      ...new Set(
        routes
          .filter((route) => route.routeContractKey === legacyRedirect.targetRouteContractKey)
          .map((route) => route.productId)
      ),
    ];
    return owners.length === 1 ? owners[0] : undefined;
  }

  const candidates = manifests
    .filter((manifest) => isGovernedSegmentOwnedPath(normalizedPath, manifest.basePath))
    .sort((left, right) => right.basePath.length - left.basePath.length);
  const best = candidates[0];
  if (!best) return undefined;
  return candidates.some(
    (candidate) => candidate.basePath.length === best.basePath.length && candidate.id !== best.id
  )
    ? undefined
    : best.id;
}

export function resolveGovernedPageEvaluationRoutes<
  T extends { pattern: `/${string}`; productId: string; routeContractKey: string },
>(
  pathname: string,
  routes: readonly T[],
  manifests: readonly Pick<ProductSurfaceManifest, 'id' | 'basePath'>[] = [],
  legacyRedirects: readonly {
    sourcePath: `/${string}`;
    targetRouteContractKey: string;
  }[] = []
): readonly T[] {
  const productId = resolveActiveGovernedProductId(pathname, routes, manifests, legacyRedirects);
  return productId ? routes.filter((route) => route.productId === productId) : [];
}

export function resolveProductSurfaceEvaluationScopeKey(
  routeContractKey: string,
  activeRouteContractKey: string | undefined,
  requestedScope: string | undefined
): string | undefined {
  return routeContractKey === activeRouteContractKey ? requestedScope : undefined;
}

function routeSegments(path: string): string[] {
  return normalizeProductPath(path).split('/').filter(Boolean);
}

function decodeGovernedPathname(pathname: string): string {
  try {
    return decodeURI(pathname);
  } catch {
    return pathname;
  }
}

function governedPathOwnershipKey(pathname: string): `/${string}` {
  return normalizeProductPath(pathname).toLowerCase() as `/${string}`;
}

function isGovernedSegmentOwnedPath(pathname: string, prefix: string): boolean {
  return isSegmentOwnedPath(governedPathOwnershipKey(pathname), governedPathOwnershipKey(prefix));
}

function matchesGovernedProductRoute(
  pathname: string,
  matcher: ProductSurfaceManifest['surfaces'][number]['routeMatchers'][number]
): boolean {
  const pathKey = governedPathOwnershipKey(pathname);
  const matcherKey = governedPathOwnershipKey(matcher.path);
  return matcher.kind === 'exact'
    ? pathKey === matcherKey
    : isSegmentOwnedPath(pathKey, matcherKey);
}

function isDynamicSegment(segment: string): boolean {
  return segment === '*' || segment.startsWith(':');
}

/**
 * A dynamic product detail route must never claim a segment reserved by a static sibling.
 * For example, `/spaces/:spaceKey` cannot own `/spaces/admin`, even when the management
 * surface index has not redirected to its first PAGE yet.
 */
function isShadowedDynamicMatch<T extends { pattern: string }>(
  route: T,
  pathname: string,
  routes: readonly T[]
): boolean {
  const patternSegments = routeSegments(route.pattern);
  if (!patternSegments.some(isDynamicSegment)) return false;
  const pathnameSegments = routeSegments(pathname);
  return patternSegments.some(
    (segment, index) =>
      isDynamicSegment(segment) &&
      routes.some((candidate) => {
        if (candidate === route) return false;
        const candidateSegments = routeSegments(candidate.pattern);
        const reservedSegment = candidateSegments[index];
        if (!reservedSegment || isDynamicSegment(reservedSegment)) return false;
        if (reservedSegment.toLowerCase() !== pathnameSegments[index]?.toLowerCase()) return false;
        return candidateSegments.slice(0, index).every((candidateSegment, prefixIndex) => {
          const actualSegment = pathnameSegments[prefixIndex];
          return (
            Boolean(actualSegment) &&
            (isDynamicSegment(candidateSegment) ||
              candidateSegment.toLowerCase() === actualSegment!.toLowerCase())
          );
        });
      })
  );
}

function matchingGovernedPageRoutes<T extends { pattern: string }>(
  pathname: string,
  routes: readonly T[]
): T[] {
  return routes.filter(
    (route) =>
      matchPath({ path: route.pattern, end: true, caseSensitive: false }, pathname) &&
      !isShadowedDynamicMatch(route, pathname, routes)
  );
}

function pageRouteSpecificity(pattern: string): number {
  return routeSegments(pattern).reduce(
    (score, segment) => score + (segment === '*' ? 1 : segment.startsWith(':') ? 3 : 10),
    0
  );
}

function highestSpecificityPageRoute<T extends { pattern: string }>(routes: readonly T[]) {
  if (routes.length === 0) return undefined;
  const ranked = [...routes].sort(
    (left, right) => pageRouteSpecificity(right.pattern) - pageRouteSpecificity(left.pattern)
  );
  const best = ranked[0]!;
  return ranked[1] && pageRouteSpecificity(ranked[1].pattern) === pageRouteSpecificity(best.pattern)
    ? undefined
    : best;
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
    correlationId: data.correlationId ?? undefined,
  };
}

function safeDirectDecision(
  data: ProductSurfaceEvaluationData,
  expected: { productKey: string; surfaceKey: string },
  nowMs: number | undefined
): SurfaceDecision {
  try {
    return mapProductSurfaceDirectEvaluation(directEvaluation(data), expected, nowMs);
  } catch {
    return { state: 'authority-unavailable' };
  }
}

function isAuthoritativeDirectEvaluationError(error: unknown): boolean {
  return (
    error instanceof HttpError &&
    (error.status === 403 || error.status === 404 || error.status === 409 || error.status === 503)
  );
}

function decisionFromError(error: unknown): SurfaceDecision {
  if (!(error instanceof HttpError)) return { state: 'authority-unavailable' };
  const details =
    error.details && typeof error.details === 'object'
      ? (error.details as {
          errorCode?: unknown;
          decisionRevision?: unknown;
          correlationId?: unknown;
        })
      : undefined;
  return mapProductSurfaceAccessError({
    status: error.status,
    reasonCode: typeof details?.errorCode === 'string' ? details.errorCode : undefined,
    decisionRevision:
      typeof details?.decisionRevision === 'string' ? details.decisionRevision : undefined,
    correlationId: typeof details?.correlationId === 'string' ? details.correlationId : undefined,
  });
}

function pageEvaluationEnabled(flags: ProductSurfaceRolloutFlags | undefined): boolean {
  return Boolean(
    flags &&
    flags.surfaceUiEvaluation === 'resolved' &&
    isProductSurfaceEnforced(resolveProductSurfaceRolloutMode(flags))
  );
}

function surfaceDecision(
  decisions: readonly SurfaceDecision[],
  activePageDecision?: SurfaceDecision
): SurfaceDecision {
  return (
    (activePageDecision?.state === 'allowed' ? activePageDecision : undefined) ??
    decisions.find((decision) => decision.state === 'allowed') ??
    decisions.find((decision) => decision.state === 'authority-unavailable') ??
    decisions[0] ?? { state: 'authority-unavailable' }
  );
}

export function ProductSurfaceAuthorityBridge({
  children,
  runtime,
}: {
  children?: ReactNode;
  runtime: ProductApplicationRuntime;
}) {
  const authority = useProductSurfaceAuthority();
  const auth = useAuth();
  const queryClient = useQueryClient();
  const location = useLocation();
  const [directDecisionMonotonicFloorMs, setDirectDecisionMonotonicFloorMs] = useState(() =>
    readMonotonicNowMs()
  );
  const snapshot = authority.status === 'ready' ? authority.snapshot : undefined;
  const directDecisionClockAnchorRef = useRef<
    | {
        snapshot: ProductSurfaceAuthoritySnapshot;
        anchor: ReturnType<typeof createDirectDecisionClockAnchor>;
      }
    | undefined
  >(undefined);
  if (snapshot && directDecisionClockAnchorRef.current?.snapshot !== snapshot) {
    directDecisionClockAnchorRef.current = {
      snapshot,
      anchor: createDirectDecisionClockAnchor(snapshot.clockOffsetMs),
    };
  } else if (!snapshot) {
    directDecisionClockAnchorRef.current = undefined;
  }
  const directDecisionClockAnchor = directDecisionClockAnchorRef.current?.anchor;
  const envelope = useMemo(() => (snapshot ? effectiveEnvelope(snapshot) : undefined), [snapshot]);
  const productFlags = useMemo(
    () =>
      Object.fromEntries(
        runtime.productIds.map((productKey) => {
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
    [authority, runtime.productIds]
  );
  const requestedScope = useMemo(
    () => new URLSearchParams(location.search).get('scope') ?? undefined,
    [location.search]
  );
  const activeSurfaceId = useMemo(
    () =>
      resolveActiveGovernedSurfaceId(
        location.pathname,
        runtime.pageRoutes,
        runtime.productManifests,
        runtime.legacyRoutes
      ),
    [location.pathname, runtime.legacyRoutes, runtime.pageRoutes, runtime.productManifests]
  );
  const activePageRoute = useMemo(
    () => resolveActiveGovernedPageRoute(location.pathname, runtime.pageRoutes),
    [location.pathname, runtime.pageRoutes]
  );
  const activeEvaluationRouteContractKey = useMemo(
    () =>
      resolveActiveGovernedEvaluationRouteContractKey(
        location.pathname,
        runtime.pageRoutes,
        runtime.legacyRoutes
      ),
    [location.pathname, runtime.legacyRoutes, runtime.pageRoutes]
  );
  const evaluationRoutes = useMemo(
    () =>
      resolveGovernedPageEvaluationRoutes(
        location.pathname,
        runtime.pageRoutes,
        runtime.productBoundaries,
        runtime.legacyRoutes
      ),
    [location.pathname, runtime.legacyRoutes, runtime.pageRoutes, runtime.productBoundaries]
  );
  const activeOperationTarget = useMemo(
    () => resolveGovernedSurfaceOperationTarget(activeSurfaceId, runtime.pageRoutes),
    [activeSurfaceId, runtime.pageRoutes]
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
    return evaluationRoutes.flatMap((route) => {
      if (!pageEvaluationEnabled(productFlags[route.productId])) return [];
      const request: ProductSurfaceEvaluationRequest = {
        subject: {
          type: 'PRODUCT',
          productKey: route.productId,
          surfaceKey: route.surfaceId,
        },
        routeContractKey: route.routeContractKey,
        contextScopeKey: resolveProductSurfaceEvaluationScopeKey(
          route.routeContractKey,
          activeEvaluationRouteContractKey,
          requestedScope
        ),
      };
      return [{ route, request }];
    });
  }, [
    activeEvaluationRouteContractKey,
    envelope,
    evaluationRoutes,
    productFlags,
    requestedScope,
    snapshot,
  ]);
  const evaluations = useQueries({
    queries: requests.map(({ route, request }) => ({
      queryKey: productSurfaceEvaluationQueryKey(snapshot!, request, {
        tenantId: String(auth.user?.tenantId ?? ''),
        actorId: String(auth.user?.userId ?? ''),
      }),
      queryFn: ({ signal }) => authority.evaluateProduct(request, { signal }),
      retry: false,
      staleTime: Number.POSITIVE_INFINITY,
      gcTime: 0,
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
  const directDecisionLeaseSignature = JSON.stringify(
    evaluations.map((result) =>
      result.data?.decision === 'ALLOWED' && typeof result.data.revalidateAt === 'string'
        ? result.data.revalidateAt
        : null
    )
  );
  useEffect(() => {
    if (!snapshot || !directDecisionClockAnchor || requests.length === 0) return undefined;
    const deadlines = JSON.parse(directDecisionLeaseSignature) as (string | null)[];
    const cancellations: (() => void)[] = [];
    requests.forEach(({ request }, index) => {
      const revalidateAt = deadlines[index];
      if (!revalidateAt) return;
      const serverDeadlineMs = Date.parse(revalidateAt);
      if (!Number.isFinite(serverDeadlineMs)) return;
      const queryKey = productSurfaceEvaluationQueryKey(snapshot, request, {
        tenantId: String(auth.user?.tenantId ?? ''),
        actorId: String(auth.user?.userId ?? ''),
      });
      const refetchExact = () => {
        void queryClient.refetchQueries(
          { queryKey, exact: true, type: 'active' },
          { cancelRefetch: false }
        );
      };
      cancellations.push(
        scheduleDirectDecisionLease({
          anchor: directDecisionClockAnchor,
          serverDeadlineMs,
          onRenew: refetchExact,
          onExpire: () => {
            setDirectDecisionMonotonicFloorMs(readMonotonicNowMs());
            refetchExact();
          },
        })
      );
    });
    return () => cancellations.forEach((cancel) => cancel());
  }, [
    auth.user?.tenantId,
    auth.user?.userId,
    directDecisionClockAnchor,
    directDecisionLeaseSignature,
    queryClient,
    requests,
    snapshot,
  ]);
  const directDecisionServerNowMs = directDecisionClockAnchor
    ? directDecisionServerNow(directDecisionClockAnchor, directDecisionMonotonicFloorMs)
    : undefined;
  const routeDecisions = useMemo(() => {
    const entries = requests.map(({ route }, index) => {
      const result = evaluations[index];
      const decision = isAuthoritativeDirectEvaluationError(result?.error)
        ? decisionFromError(result?.error)
        : result?.data
          ? safeDirectDecision(
              result.data,
              { productKey: route.productId, surfaceKey: route.surfaceId },
              directDecisionServerNowMs
            )
          : result?.error
            ? decisionFromError(result.error)
            : ({ state: 'authority-unavailable' } as const);
      return [route.routeContractKey, decision] as const;
    });
    return Object.fromEntries(entries);
  }, [directDecisionServerNowMs, evaluations, requests]);
  const previousActivePageAllow = useRef<ActivePageAllowedQueryIdentity | null>(null);
  const activePageDecision = activePageRoute
    ? routeDecisions[activePageRoute.routeContractKey]
    : undefined;
  const activePageEvaluationIndex = activePageRoute
    ? requests.findIndex(({ route }) => route.routeContractKey === activePageRoute.routeContractKey)
    : -1;
  const activePageEvaluationError =
    activePageEvaluationIndex >= 0 ? evaluations[activePageEvaluationIndex]?.error : undefined;
  const activePageAccessRevoked =
    isRouteLocalDirectEvaluationDenial(activePageEvaluationError) ||
    revokesActivePageData(activePageDecision);
  useEffect(() => {
    if (!activePageRoute || !auth.user) return;
    if (activePageDecision?.state === 'allowed') {
      previousActivePageAllow.current = {
        routeContractKey: activePageRoute.routeContractKey,
        tenantId: String(auth.user.tenantId),
        actorId: String(auth.user.userId),
        accessMode: activePageDecision.context.accessMode,
        productId: activePageDecision.context.productKey,
        surfaceId: activePageDecision.context.surfaceKey,
        contextScopeKey: activePageDecision.scope.key,
        decisionRevision: activePageDecision.decisionRevision,
      };
      return;
    }
    if (!activePageAccessRevoked) return;
    const previous = previousActivePageAllow.current;
    if (!previous || previous.routeContractKey !== activePageRoute.routeContractKey) return;
    previousActivePageAllow.current = null;
    const matches = (candidate: {
      queryKey: readonly unknown[];
      meta?: Readonly<Record<string, unknown>>;
    }) => matchesRevokedActivePageQuery(candidate, previous);
    let cancellation: Promise<void>;
    try {
      cancellation = queryClient.cancelQueries({ predicate: matches });
    } catch {
      cancellation = Promise.resolve();
    }
    queryClient.removeQueries({ predicate: matches });
    void cancellation.catch(() => undefined);
  }, [activePageAccessRevoked, activePageDecision, activePageRoute, auth.user, queryClient]);
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
              .map(({ route }) => routeDecisions[route.routeContractKey]!),
            activePageRoute?.surfaceId === surfaceId
              ? routeDecisions[activePageRoute.routeContractKey]
              : undefined
          ),
        ])
      ),
    [activePageRoute, requests, routeDecisions]
  );
  const previousStorageRevision = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (auth.isLoading) return;
    if (!auth.user) {
      purgeProductSurfaceLastRoutes();
      previousStorageRevision.current = undefined;
      return;
    }
    purgeForeignProductSurfaceLastRoutes({
      tenantId: String(auth.user.tenantId),
      actorId: String(auth.user.userId),
    });
  }, [auth.isLoading, auth.user]);
  useEffect(() => {
    const revision = envelope?.decisionRevision;
    const previous = previousStorageRevision.current;
    if (previous && revision && previous !== revision) purgeProductSurfaceLastRoutes();
    if (revision) previousStorageRevision.current = revision;
  }, [envelope?.decisionRevision]);
  useEffect(() => {
    if (
      !auth.user ||
      !envelope ||
      !activePageRoute ||
      activePageRoute.pattern.includes(':') ||
      activePageRoute.pattern.includes('*')
    ) {
      return;
    }
    const decision = routeDecisions[activePageRoute.routeContractKey];
    if (decision?.state !== 'allowed' || decision.context.plane !== 'work') return;
    storeProductSurfaceLastRoute(
      {
        tenantId: String(auth.user.tenantId),
        actorId: String(auth.user.userId),
        productId: activePageRoute.productId,
        surfaceId: activePageRoute.surfaceId,
      },
      {
        routeId: activePageRoute.routeId,
        decisionRevision: envelope.decisionRevision,
        expiresAt: decision.revalidateAt,
      },
      undefined,
      authority.serverNowMs
    );
  }, [activePageRoute, auth.user, authority.serverNowMs, envelope, routeDecisions]);
  const lastAllowedWorkRouteIds = useMemo(() => {
    const navigationStorageReadKey = location.key;
    if (!navigationStorageReadKey || !auth.user || !envelope) return {};
    return Object.fromEntries(
      envelope.contexts
        .filter((context) => context.plane === 'work')
        .flatMap((context) => {
          const routeId = readProductSurfaceLastRoute(
            {
              tenantId: String(auth.user!.tenantId),
              actorId: String(auth.user!.userId),
              productId: context.productKey,
              surfaceId: context.surfaceKey,
            },
            envelope.decisionRevision,
            undefined,
            authority.serverNowMs
          );
          return routeId ? [[context.surfaceKey, routeId] as const] : [];
        })
    );
  }, [auth.user, authority.serverNowMs, envelope, location.key]);
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
      lastAllowedWorkRouteIds,
      revalidate: authority.revalidate,
    }),
    [
      authority.revalidate,
      authority.serverNowMs,
      authority.status,
      envelope,
      lastAllowedWorkRouteIds,
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
