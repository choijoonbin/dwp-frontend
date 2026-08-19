import { MESSAGING_NAVIGATION } from '../features/messaging/messaging-navigation';
import { ProductAreaLayout } from './product-area-layout';

export function MessagingLayout() {
  return (
    <ProductAreaLayout
      areaKey="messaging"
      navigation={MESSAGING_NAVIGATION}
      translationNamespace="messaging"
    />
  );
}
