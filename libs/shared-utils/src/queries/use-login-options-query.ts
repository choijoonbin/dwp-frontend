import { useQuery } from '@tanstack/react-query';

import { getTenantId } from '../tenant-util';
import { getLoginOptions } from '../api/auth-policy-api';

export function useLoginOptionsQuery(enabled = true) {
  const tenantId = getTenantId();
  return useQuery({
    queryKey: ['auth', 'login-options', tenantId],
    queryFn: async () => (await getLoginOptions()).data,
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}
