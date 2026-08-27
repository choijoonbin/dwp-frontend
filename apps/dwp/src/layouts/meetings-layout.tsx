import { MEETINGS_NAVIGATION } from '../features/meetings/meetings-navigation';
import { MEETINGS_PRODUCT_MANIFEST } from '../features/meetings/meetings-product-manifest';
import { ProductAreaLayout } from './product-area-layout';

export function MeetingsLayout() {
  return (
    <ProductAreaLayout
      areaKey="meetings"
      manifest={MEETINGS_PRODUCT_MANIFEST}
      navigation={MEETINGS_NAVIGATION}
      translationNamespace="meetings"
    />
  );
}
