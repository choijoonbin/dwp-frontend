import { Outlet } from 'react-router-dom';
import { isAppReadEntitled, usePermissions } from '@dwp-frontend/shared-utils';

import { useMessagingPresenceHeartbeat } from './use-messaging-presence-heartbeat';

import type { ReactNode } from 'react';

export function MessagingPresenceRouteRuntime({
  children,
}: {
  children?: ReactNode;
} = {}) {
  const { permissions, isLoaded } = usePermissions();
  const canPublishPresence = isLoaded && isAppReadEntitled('APP.MESSAGING', permissions);
  useMessagingPresenceHeartbeat(canPublishPresence);
  return children ?? <Outlet />;
}
