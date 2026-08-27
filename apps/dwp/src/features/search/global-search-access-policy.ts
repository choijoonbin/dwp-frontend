import {
  hasProviderControlPlaneRole,
  isProviderIdentity,
} from '@dwp-frontend/shared-utils/auth/control-plane-access';

import type { MeResponse } from '@dwp-frontend/shared-utils/api/auth-api';

export type GlobalSearchPersona = {
  providerAccount: boolean;
  searchVisible: boolean;
  tenantSourcesEnabled: boolean;
  providerSourcesEnabled: boolean;
};

export function resolveGlobalSearchPersona(
  identity: Pick<MeResponse, 'identityPlane' | 'roles' | 'resourceRoles'> | null | undefined
): GlobalSearchPersona {
  if (!identity) {
    return {
      providerAccount: false,
      searchVisible: false,
      tenantSourcesEnabled: false,
      providerSourcesEnabled: false,
    };
  }
  const providerAccount = isProviderIdentity(identity);
  const providerSearchEnabled = providerAccount && hasProviderControlPlaneRole(identity.roles);
  return providerAccount
    ? {
        providerAccount: true,
        searchVisible: providerSearchEnabled,
        tenantSourcesEnabled: false,
        providerSourcesEnabled: providerSearchEnabled,
      }
    : {
        providerAccount: false,
        searchVisible: true,
        tenantSourcesEnabled: true,
        providerSourcesEnabled: false,
      };
}
