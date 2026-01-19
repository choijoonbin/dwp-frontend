import { useQuery } from '@tanstack/react-query';

import { getTenantId } from '../tenant-util';
import { useAuth } from '../auth/auth-provider';
import { getMonitoringVisitors } from '../api/monitoring-api';

import type { MonitoringVisitorsParams, VisitorsResponse } from '../api/monitoring-api';

// ----------------------------------------------------------------------

/**
 * Query key for monitoring visitors
 * Format: ["admin", "monitoring", "visitors", tenantId, params]
 */
export const monitoringVisitorsQueryKey = (
  tenantId: string,
  params?: MonitoringVisitorsParams
) =>
  [
    'admin',
    'monitoring',
    'visitors',
    tenantId,
    params?.page,
    params?.size,
    params?.from,
    params?.to,
    params?.keyword,
  ] as const;

/**
 * Hook to fetch monitoring visitors list
 * Enabled only when authenticated and tenantId exists
 */
export const useMonitoringVisitorsQuery = (params?: MonitoringVisitorsParams) => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();

  const query = useQuery({
    queryKey: monitoringVisitorsQueryKey(tenantId, params),
    queryFn: async () => {
      const res = await getMonitoringVisitors(params);
      if (res.data) {
        return res.data;
      }
      throw new Error(res.message || 'Failed to fetch visitors');
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
