import { DWAION_PRODUCT_MANIFEST } from '../features/dwaion/dwaion-navigation';
import { ProductAreaLayout } from './product-area-layout';

export function DwaionLayout() {
  return (
    <ProductAreaLayout
      areaKey={DWAION_PRODUCT_MANIFEST.shellKey}
      navigation={DWAION_PRODUCT_MANIFEST.navigation}
      translationNamespace="work"
    />
  );
}
