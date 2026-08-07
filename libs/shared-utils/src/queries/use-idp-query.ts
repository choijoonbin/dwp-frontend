import { useQuery } from '@tanstack/react-query';

import { getTenantId } from '../tenant-util';
import { getIdentityProviders } from '../api/auth-policy-api';

export function useIdpQuery() {
  const tenantId = getTenantId();
  return useQuery({
    queryKey: ['auth', 'idp', tenantId],
    queryFn: async () => {
      const providers = (await getIdentityProviders()).data;
      return providers.find((provider) => provider.enabled) || null;
    },
    staleTime: 5 * 60 * 1000,
  });
}
