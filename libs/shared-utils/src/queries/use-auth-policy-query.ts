import { useQuery } from '@tanstack/react-query';

import { getTenantId } from '../tenant-util';
import { getAuthPolicy } from '../api/auth-policy-api';

export function useAuthPolicyQuery() {
  const tenantId = getTenantId();
  return useQuery({
    queryKey: ['auth', 'policy', tenantId],
    queryFn: async () => (await getAuthPolicy()).data,
    staleTime: 5 * 60 * 1000,
  });
}
