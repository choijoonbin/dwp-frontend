import {
  canAccessProductAreaNavigationItem,
  type GovernedProductAreaNavigationItem,
} from './product-area-permissions';

export type ProductAreaNavigationItemAccessDecision =
  'loading' | 'allowed' | 'route-denied' | 'support-scope-denied';

export function resolveProductAreaNavigationItemAccess(
  item: GovernedProductAreaNavigationItem,
  hasPermission: (resourceKey: string, permissionCode?: string) => boolean,
  permissionsLoaded: boolean,
  providerRole: boolean,
  supportContextLoading: boolean,
  /** Scopes are trusted only when they came from a resolved provider support session. */
  _supportScopes?: readonly string[]
): ProductAreaNavigationItemAccessDecision {
  if (!permissionsLoaded || (providerRole && supportContextLoading)) return 'loading';
  if (providerRole) return 'support-scope-denied';
  const allowed = canAccessProductAreaNavigationItem(item, hasPermission, undefined);
  if (allowed) return 'allowed';
  return 'route-denied';
}
