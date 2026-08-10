import { useQuery } from '@tanstack/react-query';

import { getTenantId } from '../tenant-util';
import { getIdentityProviders } from '../api/auth-policy-api';

type UseIdpQueryOptions = {
  enabled?: boolean;
  providerKey?: string | null;
};

export function useIdpQuery({ enabled = true, providerKey }: UseIdpQueryOptions = {}) {
  const tenantId = getTenantId();
  const preferredProviderKey = providerKey?.trim() || null;

  return useQuery({
    queryKey: ['auth', 'idp', tenantId, preferredProviderKey],
    queryFn: async () => {
      const providers = (await getIdentityProviders()).data;
      if (preferredProviderKey) {
        return (
          providers.find(
            (provider) => provider.enabled && provider.providerKey === preferredProviderKey
          ) || null
        );
      }
      return providers.find((provider) => provider.enabled) || null;
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}
