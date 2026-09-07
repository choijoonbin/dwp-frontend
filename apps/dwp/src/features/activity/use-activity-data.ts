import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getActivityPage,
  getActivityEvent,
  getActivityExecutionSummary,
  HttpError,
  useAuth,
  usePermissions,
} from '@dwp-frontend/shared-utils';
import type { WorkspaceActivityFilters } from '@dwp-frontend/shared-utils';

import { activityQueryKeys, validActivityTimeRange } from './activity-model';

function retryActivity(failureCount: number, error: Error) {
  return (
    !(error instanceof HttpError && [400, 401, 403, 404].includes(error.status)) && failureCount < 1
  );
}

export function useActivityData(filters: WorkspaceActivityFilters, eventId = '') {
  const { user, isAuthenticated } = useAuth();
  const { isLoaded, hasPermission } = usePermissions();
  const identity = `${user?.tenantId ?? ''}:${user?.userId ?? ''}:${hasPermission('APP.ASK', 'VIEW')}`;
  const enabled =
    isAuthenticated && Boolean(user) && isLoaded && hasPermission('APP.ACTIVITY', 'VIEW');
  const options = {
    enabled,
    staleTime: 15_000,
    refetchInterval: 60_000,
    retry: retryActivity,
    meta: { accessSensitive: true },
  };
  const feed = useQuery({
    ...options,
    enabled: enabled && validActivityTimeRange(filters),
    queryKey: activityQueryKeys.feed(identity, filters),
    queryFn: ({ signal }) => getActivityPage(filters, signal),
  });
  const summary = useQuery({
    ...options,
    queryKey: activityQueryKeys.summary(identity),
    queryFn: ({ signal }) => getActivityExecutionSummary(signal),
  });
  const detail = useQuery({
    ...options,
    enabled: enabled && Boolean(eventId),
    queryKey: activityQueryKeys.detail(identity, eventId),
    queryFn: ({ signal }) => getActivityEvent(eventId, signal),
  });
  // Repaint freshness when polling is paused/offline; an old success must not stay "live".
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const refresh = async () => {
    await Promise.all([feed.refetch(), summary.refetch(), ...(eventId ? [detail.refetch()] : [])]);
  };
  return { feed, summary, detail, now, refresh };
}
