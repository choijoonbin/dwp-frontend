import { MESSAGING_NAVIGATION } from '../features/messaging/messaging-navigation';
import { MESSAGING_PRODUCT_MANIFEST } from '../features/messaging/messaging-product-manifest';
import { ProductAreaLayout } from './product-area-layout';

export function MessagingLayout() {
  return (
    <ProductAreaLayout
      areaKey="messaging"
      manifest={MESSAGING_PRODUCT_MANIFEST}
      navigation={MESSAGING_NAVIGATION}
      translationNamespace="messaging"
    />
  );
}
