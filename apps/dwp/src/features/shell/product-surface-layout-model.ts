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
  lastAllowedWorkRoutes: Readonly<Record<string, string>> = {},
  nowMs = Date.now()
): ProductSurfaceReturnTarget {
  const current = manifest.surfaces.find((surface) => surface.id === currentSurfaceId);
  const requestedReturnSurface = current?.returnSurfaceId;
  const entries = buildProductSurfaceEntryPoints(manifest, contexts, nowMs);
  const workEntries = entries.filter((entry) => entry.plane === 'work');
  const returnEntry =
    workEntries.find((entry) => entry.surfaceId === requestedReturnSurface) ?? workEntries[0];
  if (!returnEntry) return { path: '/apps', kind: 'catalog' };

  const lastPath = lastAllowedWorkRoutes[returnEntry.surfaceId];
  if (lastPath) {
    const resolution = resolveProductSurface(lastPath, [manifest], registeredProductRouteCatalog);
    if (resolution.type === 'known-route' && resolution.surfaceId === returnEntry.surfaceId) {
      const url = new URL(lastPath, 'https://dwp.invalid');
      if (returnEntry.contextScopeKey) url.searchParams.set('scope', returnEntry.contextScopeKey);
      return { path: `${url.pathname}${url.search}${url.hash}`, kind: 'work' };
    }
  }
  return { path: returnEntry.path, kind: 'work' };
}
