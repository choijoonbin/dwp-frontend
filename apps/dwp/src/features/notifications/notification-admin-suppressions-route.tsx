import { NotificationAdminSurface } from './notification-product-pages';
import { NotificationSuppressionStudio } from './notification-suppression-studio';

export default function NotificationAdminSuppressionsRoute() {
  return (
    <NotificationAdminSurface view="suppressions">
      <NotificationSuppressionStudio />
    </NotificationAdminSurface>
  );
}
