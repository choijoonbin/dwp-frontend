import { useQuery } from '@tanstack/react-query';

import { getTenantId } from '../tenant-util';
import { getIdentityProvider } from '../api/auth-policy-api';


// ----------------------------------------------------------------------

/**
 * Query key for identity provider
 * Format: ["auth", "idp", tenantId]
 */
export const idpQueryKey = (tenantId: string) => ['auth', 'idp', tenantId] as const;

/**
 * Hook to fetch identity provider configuration
 */
export const useIdpQuery = () => {
  const tenantId = getTenantId();

  const query = useQuery({
    queryKey: idpQueryKey(tenantId),
    queryFn: async () => {
      const res = await getIdentityProvider();
      if (res.data) {
        return res.data;
      }
      throw new Error(res.message || 'Failed to fetch identity provider');
    },
    enabled: Boolean(tenantId),
    staleTime: 5 * 60 * 1000, // 5 minutes
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
