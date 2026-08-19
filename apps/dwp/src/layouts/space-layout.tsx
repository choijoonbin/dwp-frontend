import { SPACE_NAVIGATION } from '../features/spaces/space-navigation';
import { ProductAreaLayout } from './product-area-layout';

export function SpaceLayout() {
  return (
    <ProductAreaLayout
      areaKey="spaces"
      navigation={SPACE_NAVIGATION}
      translationNamespace="spaces"
    />
  );
}
