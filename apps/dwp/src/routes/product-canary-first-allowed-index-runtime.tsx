import { lazy, Suspense } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { normalizeProductPath } from '../components/product-manifest';
import { GOVERNED_PRODUCT_MANIFESTS } from '../components/product-manifest-registry';
import { ProductSurfaceLoadingShell } from '../components/product-surface-loading-shell';
import {
  useProductSurfaceCanaryAuthority,
  type ProductSurfaceCanaryAuthority,
} from '../features/shell/product-surface-canary-runtime';
import { canContextAccessNavigation } from '../features/shell/product-surface-context';
import {
  preserveProductRouteLocation,
  resolveFirstAllowedCanaryRoute,
} from './product-canary-index-resolution';

import type { SurfaceDecision } from '../features/shell/product-surface-context';

const ProductCanaryAccessState = lazy(() =>
  import('./product-canary-access-state').then((module) => ({
    default: module.ProductCanaryAccessState,
  }))
);

function resolveIndexDecision(
  authority: ProductSurfaceCanaryAuthority,
  candidates: readonly { routeContractKey: string; path: string }[]
): Exclude<SurfaceDecision, { state: 'allowed' }> {
  const decisions = candidates.flatMap((candidate) => {
    const decision = authority.routeDecisions?.[candidate.routeContractKey];
    return decision && decision.state !== 'allowed' ? [decision] : [];
  });
  return (
    decisions.find((decision) => decision.state === 'authority-unavailable') ??
    decisions.find((decision) => decision.state === 'scope-selection-required') ??
    decisions[0] ?? { state: 'authority-unavailable' }
  );
}

export default function ProductCanaryFirstAllowedIndexRuntime({
  productId,
  surfaceId,
  candidates,
}: {
  productId: string;
  surfaceId: string;
  candidates: readonly { routeContractKey: string; path: string }[];
}) {
  const authority = useProductSurfaceCanaryAuthority();
  const location = useLocation();
  if (candidates.some((candidate) => authority.pendingRoutes?.[candidate.routeContractKey])) {
    return <ProductSurfaceLoadingShell productId={productId} surfaceId={surfaceId} />;
  }

  const requestedScope = new URLSearchParams(location.search).get('scope') ?? undefined;
  const canonicalContexts =
    authority.envelope?.contexts.filter(
      (context) =>
        context.productKey === productId &&
        context.surfaceKey === surfaceId &&
        context.accessMode === authority.envelope?.activeAccessMode
    ) ?? [];
  const canonicalScope =
    canonicalContexts.length === 1
      ? canonicalContexts[0]!.scopes.find((scope) => scope.key === requestedScope)
      : undefined;
  const canonicalScopeValid = Boolean(
    canonicalScope &&
    (!canonicalScope.validUntil ||
      Date.parse(canonicalScope.validUntil) > (authority.serverNowMs ?? Date.now()))
  );
  const allowedDestination = resolveFirstAllowedCanaryRoute(authority, {
    productId,
    surfaceId,
    candidates,
    ...(canonicalScopeValid && requestedScope ? { requestedScopeKey: requestedScope } : {}),
  });
  if (allowedDestination) {
    return <Navigate to={preserveProductRouteLocation(allowedDestination, location)} replace />;
  }

  const decision = resolveIndexDecision(authority, candidates);
  if (canonicalScopeValid && decision.state !== 'authority-unavailable') {
    const manifest = GOVERNED_PRODUCT_MANIFESTS.find((candidate) => candidate.id === productId);
    const surface = manifest?.surfaces.find((candidate) => candidate.id === surfaceId);
    const canonicalContext = canonicalContexts[0];
    const scopedDestination = candidates.find((candidate) => {
      if (
        authority.routeDecisions?.[candidate.routeContractKey]?.state !== 'scope-selection-required'
      ) {
        return false;
      }
      const item = surface?.navigation
        .flatMap((group) => group.items)
        .find(
          (candidateItem) =>
            normalizeProductPath(candidateItem.path) === normalizeProductPath(candidate.path)
        );
      return Boolean(
        item &&
        canonicalContext &&
        requestedScope &&
        canContextAccessNavigation(
          item.access,
          canonicalContext,
          requestedScope,
          authority.serverNowMs ?? Date.now()
        )
      );
    })?.path;
    if (scopedDestination) {
      return <Navigate to={preserveProductRouteLocation(scopedDestination, location)} replace />;
    }
  }
  return (
    <Suspense fallback={<ProductSurfaceLoadingShell productId={productId} surfaceId={surfaceId} />}>
      <ProductCanaryAccessState decision={decision} productId={productId} surfaceId={surfaceId} />
    </Suspense>
  );
}
