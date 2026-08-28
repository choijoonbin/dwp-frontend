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
  return t(`roleGovernance.${namespace}.${value}`, { defaultValue: value });
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

export function permissionEffectLabel(value: string, t: TFunction<'admin'>) {
  return translatedCode(t, 'effects', value);
}

export function localizedCodeLabel(label: string, canonicalCode: string) {
  return label === canonicalCode ? canonicalCode : `${label} (${canonicalCode})`;
}
