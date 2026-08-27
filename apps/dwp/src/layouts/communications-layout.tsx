import type { ProductSurfaceLayoutRuntime } from '../components/product-surface-controls';
import { COMMUNICATIONS_NAVIGATION } from '../features/communications/communications-navigation';
import { COMMUNICATIONS_PRODUCT_MANIFEST } from '../features/communications/communications-product-manifest';
import { ProductAreaLayout } from './product-area-layout';

export function CommunicationsLayout({ surface }: { surface?: ProductSurfaceLayoutRuntime } = {}) {
  return (
    <ProductAreaLayout
      areaKey="communications"
      manifest={COMMUNICATIONS_PRODUCT_MANIFEST}
      navigation={COMMUNICATIONS_NAVIGATION}
      translationNamespace="communications"
      surface={surface}
    />
  );
}
