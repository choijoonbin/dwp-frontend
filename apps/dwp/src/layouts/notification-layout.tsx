import { NOTIFICATION_NAVIGATION } from '../features/notifications/notification-navigation';
import { NOTIFICATION_PRODUCT_MANIFEST } from '../features/notifications/notification-product-manifest';
import { ProductAreaLayout } from './product-area-layout';

export function NotificationLayout() {
  return (
    <ProductAreaLayout
      areaKey="notifications"
      manifest={NOTIFICATION_PRODUCT_MANIFEST}
      navigation={NOTIFICATION_NAVIGATION}
      translationNamespace="notifications"
    />
  );
}
