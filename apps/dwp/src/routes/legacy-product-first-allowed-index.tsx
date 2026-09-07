import { useAuth } from '@dwp-frontend/shared-utils/auth/auth-provider';
import { isProviderIdentity } from '@dwp-frontend/shared-utils/auth/control-plane-access';
import { usePermissions } from '@dwp-frontend/shared-utils/auth/use-permissions';
import { Navigate, useLocation } from 'react-router-dom';

import { canAccessProductAreaNavigationItem } from '../layouts/product-area-permissions';
import { preserveProductRouteLocation } from './product-canary-index-resolution';
import { RouteFallback } from './route-support';

import type { ProductNavigationItem } from '../components/product-manifest';

export function resolveLegacyFirstAllowedNavigationPath(
  items: readonly ProductNavigationItem[],
  hasPermission: (resourceKey: string, permissionCode?: string) => boolean,
  canAccessAudience: (item: ProductNavigationItem) => boolean = () => true
): string | undefined {
  return items.find(
    (item) => canAccessAudience(item) && canAccessProductAreaNavigationItem(item, hasPermission)
  )?.path;
}

/**
 * Compatibility-mode counterpart of ProductCanaryFirstAllowedIndex.
 *
 * It resolves only from the caller's Management navigation contract and the loaded local
 * permission snapshot. This prevents a Management index from falling through to a Work page while
 * 000/100 rollout modes still use legacy authorization.
 */
export function LegacyProductFirstAllowedIndex({
  items,
  canAccessAudience,
}: {
  items: readonly ProductNavigationItem[];
  canAccessAudience?: (item: ProductNavigationItem) => boolean;
}) {
  const auth = useAuth();
  const { hasPermission, isLoaded } = usePermissions();
  const location = useLocation();
  if (isProviderIdentity(auth.user)) return <Navigate to="/provider" replace />;
  if (!isLoaded) return <RouteFallback />;
  const destination = resolveLegacyFirstAllowedNavigationPath(
    items,
    hasPermission,
    canAccessAudience
  );
  return (
    <Navigate
      to={destination ? preserveProductRouteLocation(destination, location) : '/403'}
      replace
    />
  );
}
