import { NOTIFICATION_NAVIGATION } from '../features/notifications/notification-navigation';
import { ProductAreaLayout } from './product-area-layout';

export function NotificationLayout() {
  return (
    <ProductAreaLayout
      areaKey="notifications"
      navigation={NOTIFICATION_NAVIGATION}
      translationNamespace="notifications"
    />
  );
}
