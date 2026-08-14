export type AppEntitlementPermission = {
  resourceType: string;
  resourceKey: string;
  permissionCode: string;
  effect: string;
};

const APP_RESOURCE_ALIASES: Readonly<Record<string, readonly string[]>> = {
  'APP.HCM': ['APP.HCM', 'APP.HRIS'],
  'APP.HRIS': ['APP.HCM', 'APP.HRIS'],
};

export function appResourceAliasCandidates(resourceKey: string): readonly string[] {
  const normalized = resourceKey.trim().toUpperCase();
  return APP_RESOURCE_ALIASES[normalized] ?? [normalized];
}

export function isAppResourceEntitled(
  resourceKey: string,
  permissions: readonly AppEntitlementPermission[]
): boolean {
  const appPermissions = permissions.filter(
    (permission) => permission.resourceType.trim().toUpperCase() === 'APP'
  );
  if (appPermissions.length === 0) return true;

  const resourceKeys = new Set(appResourceAliasCandidates(resourceKey));
  const matchingPermissions = appPermissions.filter(
    (permission) =>
      resourceKeys.has(permission.resourceKey.trim().toUpperCase()) &&
      ['VIEW', 'USE', 'LAUNCH'].includes(permission.permissionCode.trim().toUpperCase())
  );
  if (matchingPermissions.some((permission) => permission.effect.trim().toUpperCase() === 'DENY')) {
    return false;
  }
  return matchingPermissions.some(
    (permission) => permission.effect.trim().toUpperCase() === 'ALLOW'
  );
}
