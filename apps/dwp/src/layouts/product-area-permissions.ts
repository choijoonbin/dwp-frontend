export type GovernedProductAreaNavigationItem = {
  requiredResourceKey?: string;
  requiredPermissionCode?: string;
  requiredAnyPermissionCodes?: readonly string[];
  requiredAllPermissionCodes?: readonly string[];
  requiredAnyAuthorities?: readonly {
    resourceKey: string;
    permissionCode: string;
  }[];
  requiredAnySupportScopes?: readonly string[];
};

export function canAccessProductAreaNavigationItem(
  item: GovernedProductAreaNavigationItem,
  hasPermission: (resourceKey: string, permissionCode?: string) => boolean,
  supportScopes: readonly string[] = []
) {
  if (supportScopes.length > 0) {
    return Boolean(item.requiredAnySupportScopes?.some((scope) => supportScopes.includes(scope)));
  }
  if (item.requiredAnyAuthorities?.length) {
    return item.requiredAnyAuthorities.some(
      ({ resourceKey, permissionCode }) =>
        hasPermission(resourceKey, permissionCode) || hasPermission(resourceKey, 'MANAGE')
    );
  }
  if (!item.requiredResourceKey) return true;
  if (hasPermission(item.requiredResourceKey, 'MANAGE')) return true;
  if (item.requiredAllPermissionCodes)
    return item.requiredAllPermissionCodes.every((code) =>
      hasPermission(item.requiredResourceKey!, code)
    );
  if (item.requiredAnyPermissionCodes)
    return item.requiredAnyPermissionCodes.some((code) =>
      hasPermission(item.requiredResourceKey!, code)
    );
  return hasPermission(item.requiredResourceKey, item.requiredPermissionCode);
}
