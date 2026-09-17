export type AppEntitlementPermission = {
  resourceType: string;
  resourceKey: string;
  permissionCode: string;
  effect: string;
};

const APP_RESOURCE_ALIASES: Readonly<Record<string, readonly string[]>> = {
  'APP.HCM': ['APP.HCM', 'APP.HRIS'],
  'APP.HRIS': ['APP.HCM', 'APP.HRIS'],
  'APP.MAIL': ['APP.MAIL', 'APP.MAIL_CALENDAR'],
  'APP.MAIL_CALENDAR': ['APP.MAIL', 'APP.MAIL_CALENDAR'],
  'APP.MESSAGING': ['APP.MESSAGING', 'APP.COLLABORATION'],
  'APP.COLLABORATION': ['APP.MESSAGING', 'APP.COLLABORATION'],
  'APP.WORKPLACE': ['APP.WORKPLACE', 'APP.ROOMS'],
  'APP.ROOMS': ['APP.WORKPLACE', 'APP.ROOMS'],
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

  return isExplicitAppResourceEntitled(resourceKey, permissions);
}

/** Requires an explicit application launch grant and never applies the legacy empty-list fallback. */
export function isExplicitAppResourceEntitled(
  resourceKey: string,
  permissions: readonly AppEntitlementPermission[]
): boolean {
  const appPermissions = permissions.filter(
    (permission) => permission.resourceType.trim().toUpperCase() === 'APP'
  );

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

/** Exact read contract for surfaces that launch an API-backed app. */
export function isAppReadEntitled(
  resourceKey: string,
  permissions: readonly AppEntitlementPermission[]
): boolean {
  return isAppPermissionEntitled(resourceKey, 'VIEW', permissions);
}

/** Exact, deny-precedence application command entitlement. */
export function isAppPermissionEntitled(
  resourceKey: string,
  permissionCode: string,
  permissions: readonly AppEntitlementPermission[]
): boolean {
  const resourceKeys = new Set(appResourceAliasCandidates(resourceKey));
  const expectedCode = permissionCode.trim().toUpperCase();
  if (!expectedCode) return false;
  const matching = permissions.filter(
    (permission) =>
      permission.resourceType.trim().toUpperCase() === 'APP' &&
      resourceKeys.has(permission.resourceKey.trim().toUpperCase()) &&
      permission.permissionCode.trim().toUpperCase() === expectedCode
  );
  if (matching.some((permission) => permission.effect.trim().toUpperCase() === 'DENY')) {
    return false;
  }
  return matching.some((permission) => permission.effect.trim().toUpperCase() === 'ALLOW');
}
