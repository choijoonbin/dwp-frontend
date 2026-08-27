import { SPACE_NAVIGATION } from '../features/spaces/space-navigation';
import { SPACE_PRODUCT_MANIFEST } from '../features/spaces/space-product-manifest';
import { ProductAreaLayout } from './product-area-layout';

export function SpaceLayout() {
  return (
    <ProductAreaLayout
      areaKey="spaces"
      manifest={SPACE_PRODUCT_MANIFEST}
      navigation={SPACE_NAVIGATION}
      translationNamespace="spaces"
    />
  );
}
