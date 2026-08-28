import type { EffectiveAccess } from '@dwp-frontend/shared-utils';

type EffectiveRole = EffectiveAccess['roles'][number];
type EffectivePermission = EffectiveAccess['permissions'][number];

export function effectiveRoleRowId(role: EffectiveRole): string {
  return JSON.stringify([
    role.roleId,
    role.source,
    role.sourceGroupId ?? null,
    role.scopeType ?? null,
    role.scopeRef ?? null,
  ]);
}

export function effectivePermissionRowId(permission: EffectivePermission): string {
  return JSON.stringify([
    permission.resourceType,
    permission.resourceKey,
    permission.permissionCode,
  ]);
}
