import { DWAION_PRODUCT_MANIFEST } from '../features/dwaion/dwaion-navigation';
import { resolveDwaionProductAreaMobileShell } from '../features/dwaion/dwaion-product-area-mobile-shell';
import { DWAION_SURFACE_MANIFEST } from '../features/dwaion/dwaion-product-manifest';
import { ProductAreaLayout } from './product-area-layout';

export function DwaionLayout() {
  return (
    <ProductAreaLayout
      areaKey={DWAION_PRODUCT_MANIFEST.shellKey}
      manifest={DWAION_SURFACE_MANIFEST}
      navigation={DWAION_PRODUCT_MANIFEST.navigation}
      resolveMobileShell={resolveDwaionProductAreaMobileShell}
      translationNamespace="work"
    />
  );
}
