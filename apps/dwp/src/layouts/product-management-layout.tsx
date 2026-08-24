import { ProductSurfaceAccessState } from '../components/product-surface-access-state';
import { ProductAreaLayout } from './product-area-layout';

import type { ProductSurfaceLayoutRuntime } from '../components/product-surface-controls';
import type { ProductAreaLayoutProps } from './product-area-layout';

export type ProductManagementLayoutProps = Omit<ProductAreaLayoutProps, 'surface'> & {
  surface: ProductSurfaceLayoutRuntime;
};

export function ProductManagementLayout({ surface, ...layoutProps }: ProductManagementLayoutProps) {
  if (surface.decision.context.plane !== 'management') {
    return <ProductSurfaceAccessState decision={{ state: 'authority-unavailable' }} />;
  }
  return <ProductAreaLayout {...layoutProps} surface={surface} />;
}
