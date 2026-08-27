import type { QueryClient } from '@tanstack/react-query';

import { notificationQueryKeys } from './integration-contract';

type NotificationInvalidationClient = Pick<QueryClient, 'invalidateQueries'>;
type NotificationResetClient = Pick<QueryClient, 'resetQueries'>;

const scheduledInvalidations = new WeakMap<NotificationInvalidationClient, Promise<unknown[]>>();

export function invalidateNotificationCaches(
  queryClient: NotificationInvalidationClient
): Promise<unknown[]> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: notificationQueryKeys.summary() }),
    queryClient.invalidateQueries({ queryKey: notificationQueryKeys.appSummaryRoot() }),
    queryClient.invalidateQueries({ queryKey: notificationQueryKeys.inboxRoot() }),
  ]);
}

/** Coalesces synchronous live-signal consumers into one cache refresh cycle. */
export function scheduleNotificationCacheInvalidation(
  queryClient: NotificationInvalidationClient
): Promise<unknown[]> {
  const current = scheduledInvalidations.get(queryClient);
  if (current) return current;

  const scheduled = Promise.resolve()
    .then(() => invalidateNotificationCaches(queryClient))
    .finally(() => {
      if (scheduledInvalidations.get(queryClient) === scheduled) {
        scheduledInvalidations.delete(queryClient);
      }
    });
  scheduledInvalidations.set(queryClient, scheduled);
  return scheduled;
}

export function resetNotificationCaches(queryClient: NotificationResetClient): Promise<unknown[]> {
  return Promise.all([
    queryClient.resetQueries({ queryKey: notificationQueryKeys.summary() }),
    queryClient.resetQueries({ queryKey: notificationQueryKeys.appSummaryRoot() }),
    queryClient.resetQueries({ queryKey: notificationQueryKeys.inboxRoot() }),
  ]);
}
