import { NotificationTypeCatalogPage } from './notification-admin-contracts-page';
import { NotificationAdminSurface } from './notification-product-pages';

export default function NotificationAdminContractsRoute() {
  return (
    <NotificationAdminSurface view="contracts">
      <NotificationTypeCatalogPage />
    </NotificationAdminSurface>
  );
}
