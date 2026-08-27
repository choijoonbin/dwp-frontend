import { useAuth } from '@dwp-frontend/shared-utils/auth/auth-provider';
import { isProviderIdentity } from '@dwp-frontend/shared-utils/auth/control-plane-access';
import { usePermissions } from '@dwp-frontend/shared-utils/auth/use-permissions';

import { NotificationArrivalHost } from './notification-arrival-host';
import { NotificationCacheSyncHost } from './notification-cache-sync-host';
import { NotificationLiveBridge } from './notification-live-bridge';

export function NotificationRuntimeHost() {
  const auth = useAuth();
  const { hasPermission, isLoaded } = usePermissions();
  const notificationAccess = hasPermission('APP.NOTIFICATIONS', 'VIEW');
  const providerAccount = isProviderIdentity(auth.user);

  if (
    auth.isLoading ||
    !auth.isAuthenticated ||
    providerAccount ||
    !isLoaded ||
    !notificationAccess
  ) {
    return null;
  }

  return (
    <>
      <NotificationArrivalHost />
      <NotificationCacheSyncHost />
      <NotificationLiveBridge />
    </>
  );
}
