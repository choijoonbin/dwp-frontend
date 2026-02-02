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

export type UseAdminUserDetailQueryOptions = {
  /** true면 인증/tenant 무시하고 호출. Drawer 등에서 호출 보장용 */
  enabled?: boolean;
};

/**
 * Hook to fetch admin user detail
 * GET /api/admin/users/:userId
 */
export const useAdminUserDetailQuery = (userId: string, options?: UseAdminUserDetailQueryOptions) => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();

  const enabledDefault = isAuthenticated && Boolean(tenantId) && Boolean(userId);
  const enabled = options?.enabled !== undefined ? options.enabled && Boolean(userId) : enabledDefault;

  const query = useQuery({
    queryKey: adminUserDetailQueryKey(tenantId, userId),
    queryFn: async () => {
      const res = await getAdminUserDetail(userId);
      if (res.data) {
        return res.data;
      }
      throw new Error(res.message || 'Failed to fetch user detail');
    },
    enabled,
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
