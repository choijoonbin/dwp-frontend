import { useQuery } from '@tanstack/react-query';

import { getTenantId } from '../tenant-util';
import { useAuth } from '../auth/auth-provider';
import { getAllCodes } from '../api/admin-iam-api';


// ----------------------------------------------------------------------

/**
 * Query key for all codes
 * Format: ["admin", "codes", "all", tenantId]
 */
export const allCodesQueryKey = (tenantId: string) => ['admin', 'codes', 'all', tenantId] as const;

/**
 * Hook to fetch all codes
 */
export const useAllCodesQuery = () => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();

  const query = useQuery({
    queryKey: allCodesQueryKey(tenantId),
    queryFn: async () => {
      const res = await getAllCodes();
      if (res.data) {
        return res.data;
      }
      throw new Error(res.message || 'Failed to fetch all codes');
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
