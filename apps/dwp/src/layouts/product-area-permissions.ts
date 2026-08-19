export type GovernedProductAreaNavigationItem = {
  requiredResourceKey?: string;
  requiredPermissionCode?: string;
  requiredAnyPermissionCodes?: readonly string[];
  requiredAllPermissionCodes?: readonly string[];
};

export function canAccessProductAreaNavigationItem(
  item: GovernedProductAreaNavigationItem,
  hasPermission: (resourceKey: string, permissionCode?: string) => boolean
) {
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
