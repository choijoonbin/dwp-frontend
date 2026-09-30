import type { TFunction } from 'i18next';

export const ROLE_PERMISSION_CODES = [
  'VIEW',
  'CREATE',
  'UPDATE',
  'DELETE',
  'MANAGE',
  'EXECUTE',
  'APPROVE',
  'EXPORT',
  'PUBLISH',
] as const;
export const ROLE_RESOURCE_TYPES = ['APP', 'NAVIGATION', 'API', 'ACTION', 'DATA'] as const;

export function rolePermissionCodes(permissions: readonly { permissionCode: string }[]): string[] {
  const canonical = new Set<string>(ROLE_PERMISSION_CODES);
  const additional = [...new Set(permissions.map(({ permissionCode }) => permissionCode.trim()))]
    .filter((code) => code && !canonical.has(code))
    .sort();
  return [...ROLE_PERMISSION_CODES, ...additional];
}

function translatedCode(
  t: TFunction<'admin'>,
  namespace: 'permissionCodes' | 'resourceTypes' | 'sources' | 'effects',
  value: string
) {
  const known =
    (namespace === 'permissionCodes' && ROLE_PERMISSION_CODES.includes(value as never)) ||
    (namespace === 'resourceTypes' && ROLE_RESOURCE_TYPES.includes(value as never)) ||
    (namespace === 'sources' && ['DIRECT', 'GROUP'].includes(value)) ||
    (namespace === 'effects' && ['NONE', 'ALLOW', 'DENY'].includes(value));
  return t(`roleGovernance.${namespace}.${known ? value : 'UNKNOWN'}`);
}

export function permissionCodeLabel(value: string, t: TFunction<'admin'>) {
  return translatedCode(t, 'permissionCodes', value);
}

export function resourceTypeLabel(value: string, t: TFunction<'admin'>) {
  return translatedCode(t, 'resourceTypes', value);
}

export function assignmentSourceLabel(value: string, t: TFunction<'admin'>) {
  return translatedCode(t, 'sources', value);
}

export function assignmentTypeLabel(value: string, t: TFunction<'admin'>) {
  return t(
    `roleGovernance.assignmentTypes.${['ACTIVE', 'ELIGIBLE'].includes(value) ? value : 'UNKNOWN'}`
  );
}

export function permissionEffectLabel(value: string, t: TFunction<'admin'>) {
  return translatedCode(t, 'effects', value);
}

export function localizedCodeLabel(label: string, canonicalCode: string) {
  void canonicalCode;
  return label;
}

export function roleTypeLabel(value: string, t: TFunction<'admin'>) {
  return t(`roleGovernance.roleTypes.${['SYSTEM', 'CUSTOM'].includes(value) ? value : 'UNKNOWN'}`);
}

export function roleStatusLabel(value: string, t: TFunction<'admin'>) {
  return t(
    `roleGovernance.statuses.${['ACTIVE', 'INACTIVE', 'RETIRED'].includes(value) ? value : 'UNKNOWN'}`
  );
}

export function roleScopeLabel(value: string | null | undefined, t: TFunction<'admin'>) {
  return t(
    `roleGovernance.scopes.${value && ['TENANT', 'ORG_UNIT', 'RESOURCE'].includes(value) ? value : 'UNKNOWN'}`
  );
}
