import { useQuery } from '@tanstack/react-query';

import { getTenantId } from '../tenant-util';
import { useAuth } from '../auth/auth-provider';
import { getMonitoringApiHistories } from '../api/monitoring-api';

import type { MonitoringListParams } from '../api/monitoring-api';

// ----------------------------------------------------------------------

/**
 * Query key for monitoring API histories
 * Format: ["admin", "monitoring", "apihistories", tenantId, page, size, from, to, keyword]
 */
export const monitoringApiHistoriesQueryKey = (
  tenantId: string,
  params?: MonitoringListParams
) =>
  [
    'admin',
    'monitoring',
    'apihistories',
    tenantId,
    params?.page,
    params?.size,
    params?.from,
    params?.to,
    params?.keyword,
    params?.apiName,
    params?.apiUrl,
    params?.statusCode,
    params?.userId,
  ] as const;

/**
 * Hook to fetch monitoring API histories list
 * Enabled only when authenticated and tenantId exists
 */
export const useMonitoringApiHistoriesQuery = (params?: MonitoringListParams) => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();

  const query = useQuery({
    queryKey: monitoringApiHistoriesQueryKey(tenantId, params),
    queryFn: async () => {
      const res = await getMonitoringApiHistories(params);
      if (res.data) return res.data;
      throw new Error(res.message || 'Failed to fetch API histories');
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
