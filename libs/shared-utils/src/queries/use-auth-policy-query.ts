import { useQuery } from '@tanstack/react-query';

import { getTenantId } from '../tenant-util';
import { getAuthPolicy } from '../api/auth-policy-api';

import type { AuthPolicyResponse } from '../auth/auth-policy-types';

// ----------------------------------------------------------------------

/**
 * Query key for auth policy
 * Format: ["auth", "policy", tenantId]
 */
export const authPolicyQueryKey = (tenantId: string) => ['auth', 'policy', tenantId] as const;

/**
 * Hook to fetch auth policy
 */
export const useAuthPolicyQuery = () => {
  const tenantId = getTenantId();

  const query = useQuery({
    queryKey: authPolicyQueryKey(tenantId),
    queryFn: async () => {
      const res = await getAuthPolicy();
      if (res.data) {
        return res.data;
      }
      throw new Error(res.message || 'Failed to fetch auth policy');
    },
    enabled: Boolean(tenantId),
    staleTime: 5 * 60 * 1000, // 5 minutes (policy rarely changes)
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 1, // Only retry once
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
};
