import { useAuth } from '@dwp-frontend/shared-utils/auth/auth-provider';
import { hasProviderControlPlaneRole } from '@dwp-frontend/shared-utils/auth/control-plane-access';
import { usePermissions } from '@dwp-frontend/shared-utils/auth/use-permissions';
import { useProviderSupportContext } from '@dwp-frontend/shared-utils/auth/provider-support-context';

import { resolveProductAreaNavigationItemAccess } from './product-area-navigation-access-decision';

import type { GovernedProductAreaNavigationItem } from './product-area-permissions';

export function useProductAreaNavigationAccess() {
  const auth = useAuth();
  const { hasPermission, isLoaded: permissionsLoaded } = usePermissions();
  const providerRole = hasProviderControlPlaneRole(auth.user?.roles ?? []);
  const supportContext = useProviderSupportContext(providerRole);
  const supportSession = providerRole ? (supportContext.data ?? undefined) : undefined;

  const decisionForItem = (item: GovernedProductAreaNavigationItem) =>
    resolveProductAreaNavigationItemAccess(
      item,
      hasPermission,
      permissionsLoaded,
      providerRole,
      supportContext.isLoading,
      supportSession?.scopes
    );

  return {
    canAccessItem: (item: GovernedProductAreaNavigationItem) => decisionForItem(item) === 'allowed',
    decisionForItem,
    supportSession,
  };
}
