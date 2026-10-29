import { NotificationDeliveryOperationsPage } from './notification-admin-operations-page';
import { NotificationAdminSurface } from './notification-product-pages';

export default function NotificationAdminOperationsRoute() {
  return (
    <NotificationAdminSurface view="operations">
      <NotificationDeliveryOperationsPage />
    </NotificationAdminSurface>
  );
}
