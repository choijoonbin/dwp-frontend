import { useQuery } from '@tanstack/react-query';

import { getTenantId } from '../tenant-util';
import { getAuthPolicy } from '../api/auth-policy-api';

export function useAuthPolicyQuery(enabled = true) {
  const tenantId = getTenantId();
  return useQuery({
    queryKey: ['auth', 'policy', tenantId],
    queryFn: async () => (await getAuthPolicy()).data,
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}
