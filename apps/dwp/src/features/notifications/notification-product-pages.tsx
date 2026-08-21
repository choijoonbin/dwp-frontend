import { useTranslation } from 'react-i18next';

import { ProductAdminSurface } from '../../components/product-admin-surface';
import {
  NotificationAdminOverviewPage,
  NotificationDeliveryOperationsPage,
  NotificationTypeCatalogPage,
} from './notification-admin';
import { NotificationPreferences } from './notification-preferences';
import { NotificationPolicyStudio } from './notification-policy-studio';
import { NotificationTemplateStudio } from './notification-template-studio';
import { NotificationSuppressionStudio } from './notification-suppression-studio';

export function NotificationSettingsPage() {
  return <NotificationPreferences />;
}

function NotificationAdminSurface({
  view,
}: {
  view: 'overview' | 'contracts' | 'policies' | 'templates' | 'operations' | 'suppressions';
}) {
  const { t } = useTranslation('notifications');
  const content = {
    overview: <NotificationAdminOverviewPage />,
    contracts: <NotificationTypeCatalogPage />,
    policies: <NotificationPolicyStudio />,
    templates: <NotificationTemplateStudio />,
    operations: <NotificationDeliveryOperationsPage />,
    suppressions: <NotificationSuppressionStudio />,
  }[view];
  return (
    <ProductAdminSurface
      eyebrow={t('admin.product.eyebrow')}
      title={t(`admin.product.${view}.title`)}
      description={t(`admin.product.${view}.description`)}
    >
      {content}
    </ProductAdminSurface>
  );
}

export function NotificationAdminOverview() {
  return <NotificationAdminSurface view="overview" />;
}

export function NotificationAdminContracts() {
  return <NotificationAdminSurface view="contracts" />;
}

export function NotificationAdminPolicies() {
  return <NotificationAdminSurface view="policies" />;
}

export function NotificationAdminTemplates() {
  return <NotificationAdminSurface view="templates" />;
}

export function NotificationAdminOperations() {
  return <NotificationAdminSurface view="operations" />;
}

export function NotificationAdminSuppressions() {
  return <NotificationAdminSurface view="suppressions" />;
}
