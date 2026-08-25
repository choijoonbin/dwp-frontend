import { appResourceAliasCandidates, type AppEntitlementPermission } from './app-entitlements';

const LEGACY_HCM_ROLES = new Set(['WORKSPACE_MEMBER', 'ADMIN', 'HR_ADMIN', 'PEOPLE_ADMIN']);
const HCM_PERMISSION_CODES = new Set(['VIEW', 'MANAGE']);

function token(value: string): string {
  return value.trim().toUpperCase();
}

/** Mirrors the People `/hr/**` read guard exactly, including legacy fallback. */
export function isHcmReadEntitled(
  permissions: readonly AppEntitlementPermission[],
  roles: readonly string[],
  legacyRoleFallbackAllowed = false
): boolean {
  if (permissions.length === 0) {
    return (
      legacyRoleFallbackAllowed && roles.some((role) => LEGACY_HCM_ROLES.has(token(role)))
    );
  }

  const hcmKeys = new Set(appResourceAliasCandidates('APP.HCM'));
  const matching = permissions.filter(
    (permission) =>
      token(permission.resourceType) === 'APP' &&
      hcmKeys.has(token(permission.resourceKey)) &&
      HCM_PERMISSION_CODES.has(token(permission.permissionCode))
  );
  if (matching.some((permission) => token(permission.effect) === 'DENY')) return false;
  return matching.some((permission) => token(permission.effect) === 'ALLOW');
}
