import { useQuery } from '@tanstack/react-query';
import { getProviderSupportSessionContext, useAuth } from '@dwp-frontend/shared-utils';

import { hasProviderControlPlaneRole } from '../auth/control-plane-access';

export const providerSupportContextQueryKey = ['provider', 'support-context'] as const;

export function useProviderSupportContext(enabled: boolean) {
  return useQuery({
    queryKey: providerSupportContextQueryKey,
    queryFn: getProviderSupportSessionContext,
    enabled,
    retry: false,
    staleTime: 10_000,
    refetchInterval: enabled ? 30_000 : false,
  });
}

export function useCurrentProviderSupportContext() {
  const auth = useAuth();
  return useProviderSupportContext(hasProviderControlPlaneRole(auth.user?.roles ?? []));
}
