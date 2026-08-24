import { ProductSurfaceAccessState } from '../components/product-surface-access-state';
import { ProductAreaLayout } from './product-area-layout';

import type { ProductSurfaceLayoutRuntime } from '../components/product-surface-controls';
import type { ProductAreaLayoutProps } from './product-area-layout';

export type ProductWorkLayoutProps = Omit<ProductAreaLayoutProps, 'surface'> & {
  surface: ProductSurfaceLayoutRuntime;
};

export function ProductWorkLayout({ surface, ...layoutProps }: ProductWorkLayoutProps) {
  if (surface.decision.context.plane !== 'work') {
    return <ProductSurfaceAccessState decision={{ state: 'authority-unavailable' }} />;
  }
  return <ProductAreaLayout {...layoutProps} surface={surface} />;
}
