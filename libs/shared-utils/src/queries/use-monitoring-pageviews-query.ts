import { useQuery } from '@tanstack/react-query';

import { getTenantId } from '../tenant-util';
import { useAuth } from '../auth/auth-provider';
import { getMonitoringPageViews } from '../api/monitoring-api';

import type { MonitoringListParams } from '../api/monitoring-api';

// ----------------------------------------------------------------------

/**
 * Query key for monitoring page views
 * Format: ["admin", "monitoring", "pageviews", tenantId, page, size, from, to, keyword]
 */
export const monitoringPageViewsQueryKey = (
  tenantId: string,
  params?: MonitoringListParams
) =>
  [
    'admin',
    'monitoring',
    'pageviews',
    tenantId,
    params?.page,
    params?.size,
    params?.from,
    params?.to,
    params?.keyword,
    params?.route,
    params?.menu,
    params?.path,
    params?.userId,
  ] as const;

/**
 * Hook to fetch monitoring page views list
 * Enabled only when authenticated and tenantId exists
 */
export const useMonitoringPageViewsQuery = (params?: MonitoringListParams) => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();

  const query = useQuery({
    queryKey: monitoringPageViewsQueryKey(tenantId, params),
    queryFn: async () => {
      const res = await getMonitoringPageViews(params);
      if (res.data) return res.data;
      throw new Error(res.message || 'Failed to fetch page views');
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
