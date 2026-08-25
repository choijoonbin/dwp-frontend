import type { ProductSurfaceManifest } from '../../components/product-manifest';
import type { RegisteredProductRoute } from '../../routes/product-route-contract-source';

import { buildProductSurfaceEntryPoints } from './product-entry-point-model';
import { resolveProductSurface } from './product-surface-resolver';

import type { EffectiveProductSurfaceContext } from './product-surface-context';

export type ProductSurfaceReturnTarget = {
  path: string;
  kind: 'work' | 'catalog';
};

export function resolveProductSurfaceReturnTarget(
  manifest: ProductSurfaceManifest,
  currentSurfaceId: string,
  contexts: readonly EffectiveProductSurfaceContext[],
  registeredProductRouteCatalog: readonly RegisteredProductRoute[],
  lastAllowedWorkRouteIds: Readonly<Record<string, string>> = {},
  allowedRouteIds?: ReadonlySet<string>,
  nowMs = Date.now()
): ProductSurfaceReturnTarget {
  const current = manifest.surfaces.find((surface) => surface.id === currentSurfaceId);
  const requestedReturnSurface = current?.returnSurfaceId;
  const entries = buildProductSurfaceEntryPoints(manifest, contexts, nowMs);
  const workEntries = entries.filter((entry) => entry.plane === 'work');
  const returnEntry =
    workEntries.find((entry) => entry.surfaceId === requestedReturnSurface) ?? workEntries[0];
  if (!returnEntry) return { path: '/apps', kind: 'catalog' };

  const routePath = (routeId: string | undefined) => {
    if (!routeId || (allowedRouteIds && !allowedRouteIds.has(routeId))) return undefined;
    const route = registeredProductRouteCatalog.find(
      (candidate) =>
        candidate.routeKind === 'PAGE' &&
        candidate.routeId === routeId &&
        candidate.surfaceId === returnEntry.surfaceId &&
        !candidate.pattern.includes(':') &&
        !candidate.pattern.includes('*')
    );
    if (!route || route.routeKind !== 'PAGE') return undefined;
    const resolution = resolveProductSurface(
      route.pattern,
      [manifest],
      registeredProductRouteCatalog
    );
    if (resolution.type !== 'known-route' || resolution.surfaceId !== returnEntry.surfaceId) {
      return undefined;
    }
    const url = new URL(route.pattern, 'https://dwp.invalid');
    if (returnEntry.contextScopeKey) url.searchParams.set('scope', returnEntry.contextScopeKey);
    return `${url.pathname}${url.search}`;
  };

  const lastPath = routePath(lastAllowedWorkRouteIds[returnEntry.surfaceId]);
  if (lastPath) return { path: lastPath, kind: 'work' };

  if (manifest.id === 'approvals' && returnEntry.surfaceId === 'approvals.work') {
    for (const fallbackRouteId of ['approvals.work.inbox', 'approvals.work.home']) {
      const fallbackPath = routePath(fallbackRouteId);
      if (fallbackPath) return { path: fallbackPath, kind: 'work' };
    }
  }
  return { path: returnEntry.path, kind: 'work' };
}
