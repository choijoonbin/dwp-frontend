import type { ProductSurfaceLayoutRuntime } from '../components/product-surface-controls';
import { COMMUNICATIONS_NAVIGATION } from '../features/communications/communications-navigation';
import { ProductAreaLayout } from './product-area-layout';

export function CommunicationsLayout({ surface }: { surface?: ProductSurfaceLayoutRuntime } = {}) {
  return (
    <ProductAreaLayout
      areaKey="communications"
      navigation={COMMUNICATIONS_NAVIGATION}
      translationNamespace="communications"
      surface={surface}
    />
  );
}
