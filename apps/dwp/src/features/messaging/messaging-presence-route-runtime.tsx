import { Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getMessagingPrivacyPreference } from '@dwp-frontend/shared-utils/api/messaging-privacy-api';
import { isAppReadEntitled } from '@dwp-frontend/shared-utils/auth/app-entitlements';
import { useAuth } from '@dwp-frontend/shared-utils/auth/auth-provider';
import { usePermissions } from '@dwp-frontend/shared-utils/auth/use-permissions';

import { useMessagingPresenceHeartbeat } from './use-messaging-presence-heartbeat';

import type { ReactNode } from 'react';

export function MessagingPresenceRouteRuntime({
  children,
}: {
  children?: ReactNode;
} = {}) {
  const auth = useAuth();
  const { permissions, isLoaded } = usePermissions();
  const entitled = isLoaded && isAppReadEntitled('APP.MESSAGING', permissions);
  const privacyQuery = useQuery({
    queryKey: ['messaging', 'privacy-preferences'],
    queryFn: getMessagingPrivacyPreference,
    enabled: Boolean(entitled && auth.user),
    staleTime: 60_000,
    retry: 1,
  });
  const canPublishPresence = entitled && privacyQuery.data?.presenceSharingEnabled === true;
  useMessagingPresenceHeartbeat(
    canPublishPresence,
    auth.user ? { tenantId: auth.user.tenantId, userId: auth.user.userId } : null
  );
  return children ?? <Outlet />;
}
