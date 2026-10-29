import { lazy, Suspense } from 'react';

import { ProductSurfaceLoadingShell } from '../components/product-surface-loading-shell';

const CatalogLayoutRuntime = lazy(() =>
  import('./catalog-layout').then((module) => ({ default: module.CatalogLayout }))
);

/** Loads the application catalog shell only when the catalog route is matched. */
export function CatalogLayout() {
  return (
    <Suspense fallback={<ProductSurfaceLoadingShell />}>
      <CatalogLayoutRuntime />
    </Suspense>
  );
}
