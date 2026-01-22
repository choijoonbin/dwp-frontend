import { useQuery } from '@tanstack/react-query';

import { getTenantId } from '../tenant-util';
import { useAuth } from '../auth/auth-provider';
import { getMonitoringSummary } from '../api/monitoring-api';

import type { MonitoringSummaryParams } from '../api/monitoring-api';

// ----------------------------------------------------------------------

/**
 * Query key for monitoring summary
 * Format: ["admin", "monitoring", "summary", tenantId, from, to]
 */
export const monitoringSummaryQueryKey = (
  tenantId: string,
  params?: MonitoringSummaryParams
) => ['admin', 'monitoring', 'summary', tenantId, params?.from, params?.to] as const;

/**
 * Hook to fetch monitoring summary (KPI data)
 * Enabled only when authenticated and tenantId exists
 */
export const useMonitoringSummaryQuery = (params?: MonitoringSummaryParams) => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();

  const query = useQuery({
    queryKey: monitoringSummaryQueryKey(tenantId, params),
    queryFn: async () => {
      const res = await getMonitoringSummary(params);
      if (res.data) {
        return res.data;
      }
      throw new Error(res.message || 'Failed to fetch monitoring summary');
    },
    enabled: isAuthenticated && Boolean(tenantId),
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
};
