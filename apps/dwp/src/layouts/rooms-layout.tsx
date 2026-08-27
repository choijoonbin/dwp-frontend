import { ROOMS_NAVIGATION } from '../features/rooms/rooms-navigation';
import { WORKPLACE_PRODUCT_MANIFEST } from '../features/rooms/workplace-product-manifest';
import { ProductAreaLayout } from './product-area-layout';

export function RoomsLayout() {
  return (
    <ProductAreaLayout
      areaKey="rooms"
      manifest={WORKPLACE_PRODUCT_MANIFEST}
      navigation={ROOMS_NAVIGATION}
      translationNamespace="rooms"
    />
  );
}
