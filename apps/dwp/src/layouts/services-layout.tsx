import type { ProductSurfaceLayoutRuntime } from '../components/product-surface-controls';
import { SERVICES_NAVIGATION } from '../features/services/services-navigation';
import { ProductAreaLayout } from './product-area-layout';

export function ServicesLayout({ surface }: { surface?: ProductSurfaceLayoutRuntime } = {}) {
  return (
    <ProductAreaLayout
      areaKey="services"
      navigation={SERVICES_NAVIGATION}
      translationNamespace="services"
      surface={surface}
    />
  );
}
