import { lazy, Suspense } from 'react';
import { Navigate } from 'react-router-dom';

import type { ProductSurfaceLayoutRuntime } from '../components/product-surface-controls';
import type { ProductSurfaceManifest } from '../components/product-manifest';
import {
  buildProductHeaderEntryPoints,
  buildProductSurfaceEntryPoints,
} from '../features/shell/product-entry-point-model';
import { resolveProductRoot } from '../features/shell/product-root-resolver';
import {
  isProductSurfaceEnforced,
  isProductSurfaceUiSeparated,
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

export function preserveProductRouteLocation(
  pathname: string,
  location: { search?: string; hash?: string }
): string {
  const search = location.search
    ? location.search.startsWith('?')
      ? location.search
      : `?${location.search}`
    : '';
  const hash = location.hash
    ? location.hash.startsWith('#')
      ? location.hash
      : `#${location.hash}`
    : '';
  return `${pathname}${search}${hash}`;
}

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
  const authority = useProductSurfaceCanaryAuthority();
  if (authority.authorityPending) return pendingState(manifest.id);
  const mode = resolveProductSurfaceRolloutMode(resolveCanaryProductFlags(authority, manifest.id));
  if (mode === 'baseline' || mode === 'shadow') {
    return <Navigate to={legacyPath} replace />;
  }
  if (mode === 'invalid' || !authority.envelope) {
    return accessState({ state: 'authority-unavailable' }, manifest.id);
  }
  const resolution = resolveProductRoot(manifest, authority.envelope, {
    nowMs: authority.serverNowMs,
  });
  if (resolution.type === 'redirect') return <Navigate to={resolution.to} replace />;
  return accessState({ state: resolution.state }, manifest.id);
}

export function ProductCanaryUnknownRoute({
  productId,
  legacy,
}: {
  productId: string;
  legacy: ReactNode;
}) {
  const authority = useProductSurfaceCanaryAuthority();
  if (authority.authorityPending) return pendingState(productId);
  const mode = resolveProductSurfaceRolloutMode(resolveCanaryProductFlags(authority, productId));
  if (mode === 'baseline' || mode === 'shadow') return legacy;
  if (mode === 'invalid') {
    return accessState({ state: 'authority-unavailable' }, productId);
  }
  return <Navigate to="/404" replace />;
}

export function resolveFirstAllowedCanaryRoute(
  authority: ProductSurfaceCanaryAuthority,
  input: {
    productId: string;
    surfaceId: string;
    candidates: readonly { routeContractKey: string; path: string }[];
  }
): string | undefined {
  return input.candidates.find(
    (candidate) =>
      resolveCanaryRouteDecision(authority, {
        productId: input.productId,
        surfaceId: input.surfaceId,
        routeContractKey: candidate.routeContractKey,
      }).state === 'allowed'
  )?.path;
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
  const contexts = authority.envelope?.contexts ?? [];
  const allowedRouteIds = new Set(
    registeredRoutes.flatMap((route) =>
      route.routeKind === 'PAGE' &&
      authority.routeDecisions?.[route.routeContractKey]?.state === 'allowed'
        ? [route.routeId]
        : []
    )
  );
  const returnTarget =
    decision.context.plane === 'management'
      ? resolveProductSurfaceReturnTarget(
          manifest,
          decision.context.surfaceKey,
          contexts,
          registeredRoutes,
          authority.lastAllowedWorkRouteIds,
          allowedRouteIds,
          serverNowMs
        )
      : { path: '/apps', kind: 'catalog' as const };
  const entryPoints = isProductSurfaceUiSeparated(rolloutMode)
    ? buildProductHeaderEntryPoints(
        manifest,
        decision.context.surfaceKey,
        buildProductSurfaceEntryPoints(manifest, contexts, serverNowMs)
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
    compatibilityNavigationTargets: buildProductCompatibilityNavigationTargets({
      authority,
      manifest,
      registeredRoutes,
      rolloutMode,
    }),
  };
}
