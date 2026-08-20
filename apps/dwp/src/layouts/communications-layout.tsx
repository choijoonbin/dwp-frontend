import { COMMUNICATIONS_NAVIGATION } from '../features/communications/communications-navigation';
import { ProductAreaLayout } from './product-area-layout';

export function CommunicationsLayout() {
  return (
    <ProductAreaLayout
      areaKey="communications"
      navigation={COMMUNICATIONS_NAVIGATION}
      translationNamespace="communications"
    />
  );
}
