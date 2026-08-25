import { lazy, Suspense } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import type { ProductSurfaceManifest } from '../components/product-manifest';
import { ProductSurfaceLoadingShell } from '../components/product-surface-loading-shell';
import { resolveProductRoot } from '../features/shell/product-root-resolver';
import {
  resolveCanaryProductFlags,
  resolveProductSurfaceRolloutMode,
  useProductSurfaceCanaryAuthority,
} from '../features/shell/product-surface-canary-runtime';

import type { SurfaceDeniedState } from '../features/shell/product-surface-context';

const ProductCanaryAccessState = lazy(() =>
  import('./product-canary-access-state').then((module) => ({
    default: module.ProductCanaryAccessState,
  }))
);

function accessState(state: SurfaceDeniedState, productId: string) {
  return (
    <Suspense fallback={<ProductSurfaceLoadingShell productId={productId} />}>
      <ProductCanaryAccessState decision={{ state }} productId={productId} />
    </Suspense>
  );
}

export default function ProductCanaryRootRuntime({
  manifest,
  legacyPath,
}: {
  manifest: ProductSurfaceManifest;
  legacyPath: string;
}) {
  const authority = useProductSurfaceCanaryAuthority();
  const location = useLocation();
  if (authority.authorityPending) return <ProductSurfaceLoadingShell productId={manifest.id} />;
  const mode = resolveProductSurfaceRolloutMode(resolveCanaryProductFlags(authority, manifest.id));
  if (mode === 'baseline' || mode === 'shadow') return <Navigate to={legacyPath} replace />;
  if (mode === 'invalid' || !authority.envelope) {
    return accessState('authority-unavailable', manifest.id);
  }

  const requestedScopes = new URLSearchParams(location.search).getAll('scope');
  if (requestedScopes.length > 1) return accessState('authority-unavailable', manifest.id);
  if (requestedScopes.length === 1 && !requestedScopes[0]!.trim()) {
    return accessState('scope-invalid', manifest.id);
  }
  const resolution = resolveProductRoot(manifest, authority.envelope, {
    nowMs: authority.serverNowMs,
    ...(requestedScopes[0] ? { requestedScopeKey: requestedScopes[0] } : {}),
  });
  if (resolution.type !== 'redirect') return accessState(resolution.state, manifest.id);

  const [pathname = resolution.to, targetSearch = ''] = resolution.to.split('?', 2);
  const preservedSearch = new URLSearchParams(location.search);
  const canonicalScope = new URLSearchParams(targetSearch).get('scope');
  if (canonicalScope) preservedSearch.set('scope', canonicalScope);
  const serializedSearch = preservedSearch.toString();
  return (
    <Navigate
      to={{
        pathname,
        search: serializedSearch ? `?${serializedSearch}` : '',
        hash: location.hash,
      }}
      replace
    />
  );
}
