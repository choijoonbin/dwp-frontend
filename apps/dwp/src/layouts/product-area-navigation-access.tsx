import { useAuth } from '@dwp-frontend/shared-utils/auth/auth-provider';
import { isProviderIdentity } from '@dwp-frontend/shared-utils/auth/control-plane-access';
import { usePermissions } from '@dwp-frontend/shared-utils/auth/use-permissions';
import { useProviderSupportContext } from '@dwp-frontend/shared-utils/auth/provider-support-context';

import {
  exactProductRouteAllowsLegacyAdminGuard,
  useOptionalAllowedExactProductRoute,
} from '../features/shell/allowed-product-surface-context';
import { resolveProductAreaNavigationItemAccess } from './product-area-navigation-access-decision';

import type { GovernedProductAreaNavigationItem } from './product-area-permissions';

export function useProductAreaNavigationAccess() {
  const auth = useAuth();
  const { hasPermission, isLoaded: permissionsLoaded } = usePermissions();
  const providerRole = isProviderIdentity(auth.user);
  const supportContext = useProviderSupportContext(providerRole);
  const supportSession = providerRole ? (supportContext.data ?? undefined) : undefined;
  const exactRouteDecision = useOptionalAllowedExactProductRoute();

  const decisionForItem = (item: GovernedProductAreaNavigationItem) => {
    const resourceKeys = item.requiredAnyAuthorities?.length
      ? item.requiredAnyAuthorities.map(({ resourceKey }) => resourceKey)
      : item.requiredResourceKey
        ? [item.requiredResourceKey]
        : [];
    if (
      !providerRole &&
      exactProductRouteAllowsLegacyAdminGuard(exactRouteDecision, resourceKeys)
    ) {
      return 'allowed' as const;
    }
    return resolveProductAreaNavigationItemAccess(
      item,
      hasPermission,
      permissionsLoaded,
      providerRole,
      supportContext.isLoading,
      supportSession?.scopes
    );
  };

  return {
    canAccessItem: (item: GovernedProductAreaNavigationItem) => decisionForItem(item) === 'allowed',
    decisionForItem,
    supportSession,
  };
}
