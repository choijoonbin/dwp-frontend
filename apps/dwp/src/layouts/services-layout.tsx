import type { ProductSurfaceLayoutRuntime } from '../components/product-surface-controls';
import { SERVICES_NAVIGATION } from '../features/services/services-navigation';
import { SERVICES_PRODUCT_MANIFEST } from '../features/services/services-product-manifest';
import { ProductAreaLayout } from './product-area-layout';

export function ServicesLayout({ surface }: { surface?: ProductSurfaceLayoutRuntime } = {}) {
  return (
    <ProductAreaLayout
      areaKey="services"
      manifest={SERVICES_PRODUCT_MANIFEST}
      navigation={SERVICES_NAVIGATION}
      translationNamespace="services"
      surface={surface}
    />
  );
}
