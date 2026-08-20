import { useTranslation } from 'react-i18next';
import { PageCanvas, ResourcePageHeader } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';

import { ProductAdminSurface } from '../../components/product-admin-surface';
import {
  NotificationAdminOverviewPage,
  NotificationDeliveryOperationsPage,
  NotificationTypeCatalogPage,
} from './notification-admin';
import { NotificationPreferences } from './notification-preferences';

export function NotificationSettingsPage() {
  const { t } = useTranslation('notifications');
  return (
    <PageCanvas>
      <ResourcePageHeader
        eyebrow={t('settings.eyebrow')}
        title={t('settings.title')}
        description={t('settings.description')}
      />
      <Box sx={{ mt: 3 }}>
        <NotificationPreferences />
      </Box>
    </PageCanvas>
  );
}

function NotificationAdminSurface({ view }: { view: 'overview' | 'contracts' | 'operations' }) {
  const { t } = useTranslation('notifications');
  const content = {
    overview: <NotificationAdminOverviewPage />,
    contracts: <NotificationTypeCatalogPage />,
    operations: <NotificationDeliveryOperationsPage />,
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

export function NotificationAdminOperations() {
  return <NotificationAdminSurface view="operations" />;
}
