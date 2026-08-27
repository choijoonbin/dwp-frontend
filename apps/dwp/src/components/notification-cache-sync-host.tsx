import { useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  NOTIFICATION_SYNC_RESET_EVENT,
  parseNotificationSyncResetSignal,
} from '@dwp-frontend/shared-utils/api/notification-api';

import {
  resetNotificationCaches,
  scheduleNotificationCacheInvalidation,
} from '../features/notifications/notification-cache-policy';
import { useNotificationLiveUpdates } from '../features/notifications/use-notification-runtime';

export function NotificationCacheSyncHost() {
  const queryClient = useQueryClient();
  const synchronize = useCallback(() => {
    void scheduleNotificationCacheInvalidation(queryClient);
  }, [queryClient]);

  useNotificationLiveUpdates(synchronize);

  useEffect(() => {
    const synchronizeAfterReset = (event: Event) => {
      const signal = parseNotificationSyncResetSignal((event as CustomEvent<unknown>).detail);
      if (!signal) return;
      void resetNotificationCaches(queryClient);
    };
    window.addEventListener(NOTIFICATION_SYNC_RESET_EVENT, synchronizeAfterReset);
    return () => window.removeEventListener(NOTIFICATION_SYNC_RESET_EVENT, synchronizeAfterReset);
  }, [queryClient]);

  return null;
}
