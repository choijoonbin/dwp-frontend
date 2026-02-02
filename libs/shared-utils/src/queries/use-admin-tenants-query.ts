import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../auth/auth-provider';
import { getAdminTenants } from '../api/admin-iam-api';

// ----------------------------------------------------------------------

export const adminTenantsQueryKey = ['admin', 'tenants'] as const;

/**
 * Admin Tenant 목록 조회 (로그인 사용자 소속 Tenant만)
 * GET /api/admin/tenants
 */
export const useAdminTenantsQuery = (options?: { enabled?: boolean }) => {
  const { isAuthenticated } = useAuth();
  const enabled = options?.enabled !== false && isAuthenticated;

  const query = useQuery({
    queryKey: adminTenantsQueryKey,
    queryFn: async () => {
      const res = await getAdminTenants();
      if (res.data) return res.data;
      throw new Error(res.message || 'Failed to fetch tenants');
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
};
