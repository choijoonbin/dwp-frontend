import { lazy, Suspense } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import type { ProductSurfaceLayoutRuntime } from '../components/product-surface-controls';
import { normalizeProductPath, type ProductSurfaceManifest } from '../components/product-manifest';
import {
  buildProductHeaderEntryPoints,
  buildProductSurfaceEntryPoints,
} from '../features/shell/product-entry-point-model';
import {
  isProductSurfaceEnforced,
  resolveCanaryProductFlags,
  resolveCanaryRouteDecision,
  resolveCanarySurfaceDecision,
  resolveProductSurfaceRolloutMode,
  useProductSurfaceCanaryAuthority,
  type ProductSurfaceCanaryAuthority,
  type ProductSurfaceRolloutMode,
} from '../features/shell/product-surface-canary-runtime';
import { resolveProductSurfaceReturnTarget } from '../features/shell/product-surface-layout-model';
import { buildProductCompatibilityNavigationTargets } from '../features/shell/product-surface-compatibility-navigation';
import { ProductSurfaceTelemetryExposure } from '../observability/product-surface-telemetry-context';
import { ProductSurfaceLoadingShell } from '../components/product-surface-loading-shell';

import type { ReactNode } from 'react';
import type {
  AllowedSurfaceDecision,
  SurfaceDecision,
} from '../features/shell/product-surface-context';
import type { RegisteredProductRoute } from './product-route-contract-source';

const ProductSurfaceGuard = lazy(() =>
  import('./product-surface-guard').then((module) => ({ default: module.ProductSurfaceGuard }))
);
const ProductCanaryAccessState = lazy(() =>
  import('./product-canary-access-state').then((module) => ({
    default: module.ProductCanaryAccessState,
  }))
);
const ProductCanaryRootRuntime = lazy(() => import('./product-canary-root-runtime'));
const ProductCanaryFirstAllowedIndexRuntime = lazy(
  () => import('./product-canary-first-allowed-index-runtime')
);
const ProductSurfaceLocalNotFound = lazy(() =>
  import('../components/product-surface-local-not-found').then((module) => ({
    default: module.ProductSurfaceLocalNotFound,
  }))
);

function accessState(
  decision: Exclude<SurfaceDecision, { state: 'allowed' }>,
  productId: string,
  surfaceId?: string,
  routeId?: string
) {
  return (
    <Suspense fallback={null}>
      <ProductCanaryAccessState
        decision={decision}
        productId={productId}
        surfaceId={surfaceId}
        routeId={routeId}
      />
    </Suspense>
  );
}

export type ProductCanaryBoundaryStrategy = 'legacy' | 'server' | 'fail-closed';

export {
  preserveProductRouteLocation,
  resolveFirstAllowedCanaryRoute,
} from './product-canary-index-resolution';

export function isProductCanaryBoundaryPending(
  authority: ProductSurfaceCanaryAuthority,
  target: { surfaceId: string; routeContractKey?: string }
): boolean {
  return (
    authority.authorityPending === true ||
    (target.routeContractKey
      ? authority.pendingRoutes?.[target.routeContractKey] === true
      : authority.pendingSurfaces?.[target.surfaceId] === true)
  );
}

function pendingState(productId?: string, surfaceId?: string) {
  return <ProductSurfaceLoadingShell productId={productId} surfaceId={surfaceId} />;
}

export function resolveProductCanaryBoundaryStrategy(
  authority: ProductSurfaceCanaryAuthority,
  productId?: string
): ProductCanaryBoundaryStrategy {
  const mode = resolveProductSurfaceRolloutMode(
    productId ? resolveCanaryProductFlags(authority, productId) : authority.flags
  );
  if (mode === 'invalid') return 'fail-closed';
  return isProductSurfaceEnforced(mode) ? 'server' : 'legacy';
}

export function ProductCanarySurfaceBoundary({
  productId,
  surfaceId,
  legacy,
  children,
}: {
  productId: string;
  surfaceId: string;
  legacy: ReactNode;
  children: ReactNode;
}) {
  const authority = useProductSurfaceCanaryAuthority();
  if (isProductCanaryBoundaryPending(authority, { surfaceId })) {
    return pendingState(productId, surfaceId);
  }
  const strategy = resolveProductCanaryBoundaryStrategy(authority, productId);
  if (strategy === 'fail-closed') {
    return accessState({ state: 'authority-unavailable' }, productId, surfaceId);
  }
  if (strategy === 'legacy') return legacy;
  const decision = resolveCanarySurfaceDecision(authority, { productId, surfaceId });
  if (decision.state !== 'allowed') return accessState(decision, productId, surfaceId);
  return (
    <Suspense fallback={null}>
      <ProductSurfaceTelemetryExposure
        productKey={productId}
        surfaceKey={surfaceId as `${string}.${string}`}
      >
        <ProductSurfaceGuard decision={decision}>{children}</ProductSurfaceGuard>
      </ProductSurfaceTelemetryExposure>
    </Suspense>
  );
}

/**
 * Surface indexes are routing aliases, not PAGE authority targets. In enforced modes they must
 * redirect before the Surface shell guard runs so an opaque URL scope is evaluated only against
 * the exact destination PAGE. All non-index locations retain the normal Surface boundary.
 */
export function ProductCanaryIndexedSurfaceBoundary({
  productId,
  surfaceId,
  indexPath,
  legacy,
  children,
}: {
  productId: string;
  surfaceId: string;
  indexPath: `/${string}`;
  legacy: ReactNode;
  children: ReactNode;
}) {
  const authority = useProductSurfaceCanaryAuthority();
  const location = useLocation();
  const mode = resolveProductSurfaceRolloutMode(resolveCanaryProductFlags(authority, productId));
  const atSurfaceIndex =
    normalizeProductPath(location.pathname).toLowerCase() ===
    normalizeProductPath(indexPath).toLowerCase();
  if (isProductSurfaceEnforced(mode) && atSurfaceIndex) return <Outlet />;
  return (
    <ProductCanarySurfaceBoundary productId={productId} surfaceId={surfaceId} legacy={legacy}>
      {children}
    </ProductCanarySurfaceBoundary>
  );
}

export function ProductCanaryRouteBoundary({
  productId,
  surfaceId,
  routeContractKey,
  legacy,
  children,
}: {
  productId: string;
  surfaceId: string;
  routeContractKey: string;
  legacy?: ReactNode;
  children: ReactNode;
}) {
  const authority = useProductSurfaceCanaryAuthority();
  const location = useLocation();
  if (isProductCanaryBoundaryPending(authority, { surfaceId, routeContractKey })) {
    return pendingState(productId, surfaceId);
  }
  const strategy = resolveProductCanaryBoundaryStrategy(authority, productId);
  if (strategy === 'fail-closed') {
    return accessState({ state: 'authority-unavailable' }, productId, surfaceId, routeContractKey);
  }
  if (strategy === 'legacy') return legacy ?? children;
  const decision = resolveCanaryRouteDecision(authority, {
    productId,
    surfaceId,
    routeContractKey,
  });
  if (decision.state !== 'allowed') {
    return accessState(decision, productId, surfaceId, routeContractKey);
  }
  const search = new URLSearchParams(location.search);
  const canonicalScopeAlreadyPresent =
    search.getAll('scope').length === 1 && search.get('scope') === decision.scope.key;
  if (!canonicalScopeAlreadyPresent) {
    search.set('scope', decision.scope.key);
    return (
      <Navigate
        replace
        to={{ pathname: location.pathname, search: search.toString(), hash: location.hash }}
      />
    );
  }
  return (
    <Suspense fallback={null}>
      <ProductSurfaceGuard decision={decision}>{children}</ProductSurfaceGuard>
    </Suspense>
  );
}

export function ProductCanaryRoot({
  manifest,
  legacyPath,
}: {
  manifest: ProductSurfaceManifest;
  legacyPath: string;
}) {
  return (
    <Suspense fallback={pendingState(manifest.id)}>
      <ProductCanaryRootRuntime manifest={manifest} legacyPath={legacyPath} />
    </Suspense>
  );
}

export function ProductCanaryUnknownRoute({ productId }: { productId: string; legacy: ReactNode }) {
  const authority = useProductSurfaceCanaryAuthority();
  if (authority.authorityPending) return pendingState(productId);
  const mode = resolveProductSurfaceRolloutMode(resolveCanaryProductFlags(authority, productId));
  if (mode === 'invalid') {
    return accessState({ state: 'authority-unavailable' }, productId);
  }
  return (
    <Suspense fallback={pendingState(productId)}>
      <ProductSurfaceLocalNotFound />
    </Suspense>
  );
}

export function ProductCanaryFirstAllowedIndex({
  productId,
  surfaceId,
  candidates,
  legacy,
}: {
  productId: string;
  surfaceId: string;
  candidates: readonly { routeContractKey: string; path: string }[];
  legacy: ReactNode;
}) {
  const authority = useProductSurfaceCanaryAuthority();
  const mode = resolveProductSurfaceRolloutMode(resolveCanaryProductFlags(authority, productId));
  if (!isProductSurfaceEnforced(mode)) return legacy;
  return (
    <Suspense fallback={pendingState(productId, surfaceId)}>
      <ProductCanaryFirstAllowedIndexRuntime
        productId={productId}
        surfaceId={surfaceId}
        candidates={candidates}
      />
    </Suspense>
  );
}

export function buildProductCanaryLayoutRuntime({
  authority,
  manifest,
  decision,
  label,
  returnLabels,
  registeredRoutes,
  onScopeChange,
  rolloutMode,
}: {
  authority: ProductSurfaceCanaryAuthority;
  manifest: ProductSurfaceManifest;
  decision: AllowedSurfaceDecision;
  label: string;
  returnLabels: Readonly<Record<'work' | 'catalog', string>>;
  registeredRoutes: readonly RegisteredProductRoute[];
  onScopeChange?: (scopeKey: string) => void;
  rolloutMode: ProductSurfaceRolloutMode;
}): ProductSurfaceLayoutRuntime {
  const serverNowMs = authority.serverNowMs ?? Date.now();
  const compatibilityNavigationTargets = buildProductCompatibilityNavigationTargets({
    authority,
    manifest,
    registeredRoutes,
    rolloutMode,
  });
  const trustedPageRoutes = registeredRoutes
    .filter(
      (route): route is Extract<RegisteredProductRoute, { routeKind: 'PAGE' }> =>
        route.routeKind === 'PAGE' && route.productId === manifest.id
    )
    .map((route) => ({
      route,
      decision: resolveCanaryRouteDecision(authority, {
        productId: manifest.id,
        surfaceId: route.surfaceId,
        routeContractKey: route.routeContractKey,
      }),
    }));
  const allowedRouteIds = new Set(
    trustedPageRoutes.flatMap(({ route, decision: routeDecision }) =>
      routeDecision.state === 'allowed' ? [route.routeId] : []
    )
  );
  const trustedEntryTargets = manifest.surfaces.flatMap((surface) => {
    const candidates = trustedPageRoutes.filter(
      (
        candidate
      ): candidate is (typeof trustedPageRoutes)[number] & {
        decision: AllowedSurfaceDecision;
      } =>
        candidate.route.surfaceId === surface.id &&
        candidate.decision.state === 'allowed' &&
        surface.supportedScopeKinds.includes(candidate.decision.scope.kind) &&
        candidate.decision.context.scopes.every((scope) =>
          surface.supportedScopeKinds.includes(scope.kind)
        )
    );
    const exactIndex = candidates.find(({ route }) => route.pattern === surface.indexPath);
    const canonicalContexts = authority.envelope?.contexts.filter(
      (context) =>
        context.productKey === manifest.id &&
        context.surfaceKey === surface.id &&
        context.accessMode === authority.envelope?.activeAccessMode
    );
    const canonical = canonicalContexts?.length === 1 ? canonicalContexts[0] : undefined;
    const navigationPaths = surface.navigation.flatMap((group) =>
      group.items.map((item) => item.path)
    );
    const canonicalResourceEntry = navigationPaths.flatMap((path) => {
      const candidate = candidates.find(
        ({ route, decision: routeDecision }) =>
          route.pattern === path &&
          canonical !== undefined &&
          routeDecision.context.appResourceKey === canonical.appResourceKey
      );
      return candidate ? [candidate] : [];
    })[0];
    const firstNavigationEntry = navigationPaths.flatMap((path) => {
      const candidate = candidates.find(({ route }) => route.pattern === path);
      return candidate ? [candidate] : [];
    })[0];
    const trustedAllowed =
      exactIndex ?? canonicalResourceEntry ?? firstNavigationEntry ?? candidates[0];
    const scopeSelectionTarget = trustedAllowed
      ? undefined
      : navigationPaths.flatMap((path) => {
          const normalizedPath = normalizeProductPath(path);
          const target = compatibilityNavigationTargets?.get(normalizedPath);
          const route = trustedPageRoutes.find(
            (candidate) =>
              candidate.route.surfaceId === surface.id &&
              normalizeProductPath(candidate.route.pattern) === normalizedPath &&
              candidate.decision.state === 'scope-selection-required'
          );
          return target?.state === 'scope-selection-required' && route && canonical
            ? [{ route: route.route, context: canonical }]
            : [];
        })[0];
    const trusted = trustedAllowed
      ? { route: trustedAllowed.route, context: trustedAllowed.decision.context }
      : scopeSelectionTarget;
    return trusted ? [{ surfaceId: surface.id, ...trusted }] : [];
  });
  const trustedEntryContexts = trustedEntryTargets.map(({ context }) => context);
  const entryPointManifest: ProductSurfaceManifest = {
    ...manifest,
    surfaces: manifest.surfaces.map((surface) => {
      const target = trustedEntryTargets.find((candidate) => candidate.surfaceId === surface.id);
      return target ? { ...surface, indexPath: target.route.pattern } : surface;
    }) as unknown as ProductSurfaceManifest['surfaces'],
  };
  const returnTarget =
    decision.context.plane === 'management'
      ? resolveProductSurfaceReturnTarget(
          manifest,
          decision.context.surfaceKey,
          trustedEntryContexts,
          registeredRoutes,
          authority.lastAllowedWorkRouteIds,
          allowedRouteIds,
          serverNowMs
        )
      : { path: '/apps', kind: 'catalog' as const };
  const entryPoints = isProductSurfaceEnforced(rolloutMode)
    ? buildProductHeaderEntryPoints(
        entryPointManifest,
        decision.context.surfaceKey,
        buildProductSurfaceEntryPoints(entryPointManifest, trustedEntryContexts, serverNowMs)
      )
    : undefined;
  return {
    decision,
    label,
    serverNowMs,
    entryPoints,
    availableScopes: decision.context.scopes,
    onScopeChange,
    returnTarget: { path: returnTarget.path, label: returnLabels[returnTarget.kind] },
    compatibilityNavigation: rolloutMode === 'enforced-compatibility',
    compatibilityNavigationTargets,
  };
}
