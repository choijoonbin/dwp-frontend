import type { TenantSettingOwnerDescriptor } from '@dwp-frontend/shared-utils';

const OWNER_PRESENTATION_VALUES = {
  adapter: new Set(['CONNECTED', 'UNAVAILABLE']),
  resolution: new Set(['TENANT_OVERRIDE_OR_OWNER_DEFAULT']),
  freshness: new Set(['FRESH', 'STALE', 'NO_DATA', 'DRIFTED']),
  lifecycle: new Set(['DRAFT', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'PUBLISHED', 'SUPERSEDED']),
  actions: new Set(['SUBMIT', 'APPROVE', 'REJECT', 'PUBLISH']),
} as const;

function registryLabelKey(kind: keyof typeof OWNER_PRESENTATION_VALUES, value: string): string {
  return `settingRegistry.${kind}.${OWNER_PRESENTATION_VALUES[kind].has(value) ? value : 'UNKNOWN'}`;
}

export const settingOwnerAdapterLabelKey = (value: string) => registryLabelKey('adapter', value);
export const settingResolutionLabelKey = (value: string) => registryLabelKey('resolution', value);
export const settingFreshnessLabelKey = (value: string) => registryLabelKey('freshness', value);
export const settingLifecycleLabelKey = (value: string) => registryLabelKey('lifecycle', value);
export const settingActionLabelKey = (value: string) => registryLabelKey('actions', value);

export type TenantSettingValueLabels = {
  enabled: string;
  disabled: string;
  ownerOnly: string;
  unavailable: string;
  localLogin: string;
  ssoLogin: string;
  durationMinutes: (count: number) => string;
};

export function supportsGenericTenantSettingEditor(owner: TenantSettingOwnerDescriptor): boolean {
  return owner.editorKind === 'BOOLEAN' || owner.editorKind === 'LOCALE';
}

export function formatTenantSettingValue(
  owner: TenantSettingOwnerDescriptor | undefined,
  value: unknown,
  labels: TenantSettingValueLabels
): string {
  if (!owner || owner.editorKind === 'OWNER_ONLY') return labels.ownerOnly;
  if (owner.editorKind === 'BOOLEAN') {
    if (value === true) return labels.enabled;
    if (value === false) return labels.disabled;
    return labels.unavailable;
  }
  if (owner.editorKind === 'LOGIN_TYPE') {
    if (value === 'LOCAL') return labels.localLogin;
    if (value === 'SSO') return labels.ssoLogin;
    return labels.unavailable;
  }
  if (owner.editorKind === 'DURATION_SECONDS') {
    return typeof value === 'number'
      ? labels.durationMinutes(Math.round(value / 60))
      : labels.unavailable;
  }
  return typeof value === 'string' ? value : labels.unavailable;
}
