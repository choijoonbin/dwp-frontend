import { NotificationAdminSurface } from './notification-product-pages';
import { NotificationTemplateStudio } from './notification-template-studio';

export default function NotificationAdminTemplatesRoute() {
  return (
    <NotificationAdminSurface view="templates">
      <NotificationTemplateStudio />
    </NotificationAdminSurface>
  );
}
