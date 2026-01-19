import { useQuery } from '@tanstack/react-query';

import { getTenantId } from '../tenant-util';
import { useAuth } from '../auth/auth-provider';
import { getCodesByResourceKey } from '../api/code-usage-api';

import type { CodeUsageResponse } from '../api/code-usage-api';

// ----------------------------------------------------------------------

/**
 * Query key for codes by resource
 * Format: ["admin", "codes", "usage", tenantId, resourceKey]
 */
export const codesByResourceQueryKey = (tenantId: string, resourceKey: string) =>
  ['admin', 'codes', 'usage', tenantId, resourceKey] as const;

/**
 * Hook to fetch codes by resource key (usage-based)
 */
export const useCodesByResourceQuery = (resourceKey: string) => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();

  const query = useQuery({
    queryKey: codesByResourceQueryKey(tenantId, resourceKey),
    queryFn: async () => {
      const res = await getCodesByResourceKey(resourceKey);
      if (res.data) {
        return res.data;
      }
      throw new Error(res.message || 'Failed to fetch codes by resource');
    },
    enabled: isAuthenticated && Boolean(tenantId) && Boolean(resourceKey),
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
