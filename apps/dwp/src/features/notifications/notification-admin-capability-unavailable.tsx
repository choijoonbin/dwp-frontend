import { useTranslation } from 'react-i18next';
import { ShieldCheck } from 'lucide-react';
import { EmptyState } from '@dwp-frontend/design-system';

export function NotificationAdminCapabilityUnavailable() {
  const { t } = useTranslation('notifications');
  return (
    <EmptyState
      icon={<ShieldCheck size={28} />}
      title={t('admin.capabilityUnavailable.title')}
      description={t('admin.capabilityUnavailable.description')}
      size="page"
    />
  );
}
