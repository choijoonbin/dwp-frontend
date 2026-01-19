import { useQuery } from '@tanstack/react-query';

import { getTenantId } from '../tenant-util';
import { useAuth } from '../auth/auth-provider';
import { getMonitoringTimeseries } from '../api/monitoring-api';

import type { MonitoringTimeseriesParams, TimeseriesResponse } from '../api/monitoring-api';

// ----------------------------------------------------------------------

/**
 * Query key for monitoring timeseries
 * Format: ["admin", "monitoring", "timeseries", tenantId, params]
 */
export const monitoringTimeseriesQueryKey = (
  tenantId: string,
  params: MonitoringTimeseriesParams
) =>
  [
    'admin',
    'monitoring',
    'timeseries',
    tenantId,
    params.from,
    params.to,
    params.interval,
    params.metric,
  ] as const;

/**
 * Hook to fetch monitoring timeseries data
 * Enabled only when authenticated and tenantId exists
 */
export const useMonitoringTimeseriesQuery = (params: MonitoringTimeseriesParams) => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();

  const query = useQuery({
    queryKey: monitoringTimeseriesQueryKey(tenantId, params),
    queryFn: async () => {
      const res = await getMonitoringTimeseries(params);
      if (res.data) {
        return res.data;
      }
      throw new Error(res.message || 'Failed to fetch timeseries data');
    },
    enabled: isAuthenticated && Boolean(tenantId) && Boolean(params.from) && Boolean(params.to),
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
