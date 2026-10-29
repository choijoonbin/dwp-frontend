import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  getNotificationDeliveryOperations,
  NOTIFICATION_API_CAPABILITIES,
} from '@dwp-frontend/shared-utils/api/notification-api';
import { usePermissions } from '@dwp-frontend/shared-utils';
import { LoadingState } from '@dwp-frontend/design-system';

import { NotificationAdminCapabilityUnavailable } from './notification-admin-capability-unavailable';
import { NotificationErrorState } from './notification-error-support';
import { notificationQueryKeys } from './integration-contract';
import { NotificationOperationsWorkbench } from './notification-operations-workbench';
import { useOnlineStatus } from './use-notification-runtime';

export function NotificationDeliveryOperationsPage() {
  const { t } = useTranslation('notifications');
  const { hasPermission } = usePermissions();
  const online = useOnlineStatus();
  const canViewCentralAudit = hasPermission('ADMIN.AUDIT_VIEW', 'VIEW');
  const query = useQuery({
    queryKey: notificationQueryKeys.adminOperations(),
    queryFn: ({ signal }) => getNotificationDeliveryOperations(signal),
    staleTime: 15_000,
    refetchInterval: online ? 20_000 : false,
    retry: 1,
    enabled: NOTIFICATION_API_CAPABILITIES.tenantAdmin,
  });

  if (!NOTIFICATION_API_CAPABILITIES.tenantAdmin) {
    return <NotificationAdminCapabilityUnavailable />;
  }
  if (query.isLoading) {
    return (
      <LoadingState
        label={t('states.loadingOperations')}
        variant="skeleton"
        skeletonRows={8}
        size="page"
      />
    );
  }
  if (query.isError || !query.data) {
    return (
      <NotificationErrorState
        error={query.error}
        title={t('states.operationsErrorTitle')}
        description={t('states.operationsErrorDescription')}
        retryLabel={t('actions.retry')}
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
        size="page"
      />
    );
  }
  return (
    <NotificationOperationsWorkbench
      data={query.data}
      online={online}
      refreshing={query.isFetching}
      canViewCentralAudit={canViewCentralAudit}
      onRefresh={() => void query.refetch()}
    />
  );
}
