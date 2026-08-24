import type { ProductSurfaceManifest } from '../../components/product-manifest';

import { resolveEffectiveScope, type SurfaceDeniedState } from './product-surface-context';

import type {
  EffectiveProductSurfaceContext,
  EffectiveProductSurfaceContextEnvelope,
  ProductAccessMode,
} from './product-surface-context';

export type ProductRootResolution =
  | {
      type: 'redirect';
      productId: string;
      surfaceId: string;
      contextKey: string;
      contextScopeKey?: string;
      requiresScopeSelection: boolean;
      to: string;
      replace: true;
    }
  | { type: 'access-state'; state: SurfaceDeniedState };

function appendCanonicalScope(path: string, contextScopeKey: string | undefined): string {
  if (!contextScopeKey) return path;
  const search = new URLSearchParams({ scope: contextScopeKey });
  return `${path}?${search.toString()}`;
}

function contextIsStructurallyValid(
  context: EffectiveProductSurfaceContext,
  manifest: ProductSurfaceManifest,
  activeAccessMode: ProductAccessMode
): boolean {
  const surface = manifest.surfaces.find((candidate) => candidate.id === context.surfaceKey);
  return Boolean(
    surface &&
      context.productKey === manifest.id &&
      context.plane === surface.plane &&
      context.accessMode === activeAccessMode &&
      context.scopes.every((scope) => surface.supportedScopeKinds.includes(scope.kind))
  );
}

export function resolveProductRoot(
  manifest: ProductSurfaceManifest,
  envelope: Pick<
    EffectiveProductSurfaceContextEnvelope,
    'contexts' | 'activeAccessMode' | 'decisionRevision'
  >,
  options: {
    deniedState?: Extract<SurfaceDeniedState, 'app-denied' | 'authority-unavailable'>;
    nowMs?: number;
  } = {}
): ProductRootResolution {
  if (!envelope.decisionRevision.trim())
    return { type: 'access-state', state: 'authority-unavailable' };
  const productContexts = envelope.contexts.filter((context) => context.productKey === manifest.id);
  if (
    productContexts.some(
      (context) => !contextIsStructurallyValid(context, manifest, envelope.activeAccessMode)
    )
  ) {
    return { type: 'access-state', state: 'authority-unavailable' };
  }

  for (const plane of ['work', 'management'] as const) {
    for (const surface of manifest.surfaces.filter((candidate) => candidate.plane === plane)) {
      const matchingContexts = productContexts.filter(
        (context) => context.surfaceKey === surface.id
      );
      if (matchingContexts.length > 1) {
        return { type: 'access-state', state: 'authority-unavailable' };
      }
      const context = matchingContexts[0];
      if (!context) continue;
      const revalidateAt = Date.parse(context.revalidateAt);
      if (!Number.isFinite(revalidateAt)) {
        return { type: 'access-state', state: 'authority-unavailable' };
      }
      if (revalidateAt <= (options.nowMs ?? Date.now())) {
        return { type: 'access-state', state: 'expired' };
      }
      const scopeResolution = resolveEffectiveScope(context.scopes, undefined, options.nowMs);
      if (scopeResolution.state === 'authority-unavailable') {
        return { type: 'access-state', state: 'authority-unavailable' };
      }
      if (scopeResolution.state === 'expired') return { type: 'access-state', state: 'expired' };
      if (scopeResolution.state === 'scope-invalid') {
        return { type: 'access-state', state: 'scope-invalid' };
      }
      if (scopeResolution.state === 'scope-selection-required') {
        return {
          type: 'redirect',
          productId: manifest.id,
          surfaceId: surface.id,
          contextKey: context.contextKey,
          requiresScopeSelection: true,
          to: surface.indexPath,
          replace: true,
        };
      }
      return {
        type: 'redirect',
        productId: manifest.id,
        surfaceId: surface.id,
        contextKey: context.contextKey,
        contextScopeKey: scopeResolution.scope.key,
        requiresScopeSelection: false,
        to: appendCanonicalScope(surface.indexPath, scopeResolution.scope.key),
        replace: true,
      };
    }
  }
  return { type: 'access-state', state: options.deniedState ?? 'app-denied' };
}
