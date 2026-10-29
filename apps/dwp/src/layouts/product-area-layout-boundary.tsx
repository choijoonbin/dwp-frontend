import { lazy, Suspense } from 'react';

import { ProductSurfaceLoadingShell } from '../components/product-surface-loading-shell';

import type { ProductAreaLayoutProps } from './product-area-layout-contract';

const ProductAreaLayoutRuntime = lazy(() =>
  import('./product-area-layout').then((module) => ({ default: module.ProductAreaLayout }))
);

/** Loads the shared product shell only after a product route has been selected. */
export function ProductAreaLayout(props: ProductAreaLayoutProps) {
  return (
    <Suspense fallback={<ProductSurfaceLoadingShell />}>
      <ProductAreaLayoutRuntime {...props} />
    </Suspense>
  );
}
