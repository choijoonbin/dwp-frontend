import { useQuery } from '@tanstack/react-query';

import { getTenantId } from '../tenant-util';
import { useAuth } from '../auth/auth-provider';
import { getAdminUserDetail } from '../api/admin-iam-api';


// ----------------------------------------------------------------------

/**
 * Query key for admin user detail
 * Format: ["admin", "users", "detail", tenantId, userId]
 */
export const adminUserDetailQueryKey = (tenantId: string, userId: string) =>
  ['admin', 'users', 'detail', tenantId, userId] as const;

/**
 * Hook to fetch admin user detail
 */
export const useAdminUserDetailQuery = (userId: string) => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();

  const query = useQuery({
    queryKey: adminUserDetailQueryKey(tenantId, userId),
    queryFn: async () => {
      const res = await getAdminUserDetail(userId);
      if (res.data) {
        return res.data;
      }
      throw new Error(res.message || 'Failed to fetch user detail');
    },
    enabled: isAuthenticated && Boolean(tenantId) && Boolean(userId),
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
