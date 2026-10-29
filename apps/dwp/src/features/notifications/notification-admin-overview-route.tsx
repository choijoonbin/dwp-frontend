import { NotificationAdminOverviewPage } from './notification-admin-overview-page';
import { NotificationAdminNoiseQualityRuntime } from './notification-noise-quality-runtime';
import { NotificationAdminSurface } from './notification-product-pages';

export default function NotificationAdminOverviewRoute() {
  return (
    <NotificationAdminSurface view="overview">
      <NotificationAdminOverviewPage />
      <NotificationAdminNoiseQualityRuntime />
    </NotificationAdminSurface>
  );
}
