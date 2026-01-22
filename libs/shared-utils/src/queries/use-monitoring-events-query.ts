import { useQuery } from '@tanstack/react-query';

import { getTenantId } from '../tenant-util';
import { useAuth } from '../auth/auth-provider';
import { getMonitoringEvents } from '../api/monitoring-api';

import type { MonitoringEventsParams } from '../api/monitoring-api';

// ----------------------------------------------------------------------

/**
 * Query key for monitoring events
 * Format: ["admin", "monitoring", "events", tenantId, params]
 */
export const monitoringEventsQueryKey = (
  tenantId: string,
  params?: MonitoringEventsParams
) =>
  [
    'admin',
    'monitoring',
    'events',
    tenantId,
    params?.page,
    params?.size,
    params?.from,
    params?.to,
    params?.keyword,
    params?.eventType,
    params?.resourceKey,
  ] as const;

/**
 * Hook to fetch monitoring events list
 * Enabled only when authenticated and tenantId exists
 */
export const useMonitoringEventsQuery = (params?: MonitoringEventsParams) => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();

  const query = useQuery({
    queryKey: monitoringEventsQueryKey(tenantId, params),
    queryFn: async () => {
      const res = await getMonitoringEvents(params);
      if (res.data) return res.data;
      throw new Error(res.message || 'Failed to fetch events');
    },
    enabled: isAuthenticated && Boolean(tenantId),
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 2 * 60 * 1000, // 2 minutes
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
};
