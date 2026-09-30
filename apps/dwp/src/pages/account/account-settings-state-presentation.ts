const PERSONAL_SETTING_KEYS = new Set([
  'profile',
  'security',
  'appearance',
  'accessibility',
  'language',
  'home',
  'notifications',
  'managed',
]);
const PERSONAL_ACTIVITY_TYPES = new Set(['VIEW', 'CHANGE']);
const MANAGED_PREFERENCE_PATHS = new Set([
  'appearance.fontFamily',
  'appearance.accentColor',
  'navigation.pattern',
]);
const MANAGED_EXCEPTION_STATES = new Set([
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
  'EXPIRED',
]);
const MANAGED_OVERRIDE_STATES = new Set([
  'OVERRIDDEN',
  'INHERITED',
  'UNMANAGED_BASELINE',
  'OWNER_LOCKED',
  'DRIFTED',
]);
const MANAGED_OWNER_LABEL_KEYS = new Set([
  'managed.effective.owners.authPolicy',
  'managed.effective.owners.tenantDirectory',
  'managed.effective.owners.registeredOwner',
]);
const IDENTITY_PROVIDER_PROTOCOLS = new Set(['OIDC', 'SAML']);

export function personalSettingLabelKey(value: unknown): string {
  return typeof value === 'string' && PERSONAL_SETTING_KEYS.has(value)
    ? `navigation.${value}`
    : 'settingsHome.observations.recent.unknownSetting';
}

export function personalActivityType(value: unknown): string {
  return typeof value === 'string' && PERSONAL_ACTIVITY_TYPES.has(value) ? value : 'UNAVAILABLE';
}

export function managedPreferencePathLabelKey(value: unknown): string {
  return typeof value === 'string' && MANAGED_PREFERENCE_PATHS.has(value)
    ? `managed.pathLabels.${value}`
    : 'managed.pathLabels.unknown';
}

export function managedExceptionState(value: unknown): string {
  return typeof value === 'string' && MANAGED_EXCEPTION_STATES.has(value) ? value : 'UNAVAILABLE';
}

export function managedEffectiveFreshness(value: unknown): 'FRESH' | 'DRIFTED' | 'UNAVAILABLE' {
  if (value === 'FRESH' || value === 'DRIFTED') return value;
  return 'UNAVAILABLE';
}

export function managedEffectiveSourceLabelKey(value: unknown): string {
  if (value === 'TENANT_OVERRIDE') return 'managed.effective.source.organization';
  if (value === 'OWNER_DEFAULT' || value === 'OWNER_CURRENT' || value === 'OWNER_PUBLICATION') {
    return 'managed.effective.source.owner';
  }
  return 'managed.effective.source.unavailable';
}

export function managedOverrideState(value: unknown): string {
  return typeof value === 'string' && MANAGED_OVERRIDE_STATES.has(value) ? value : 'UNAVAILABLE';
}

export function managedOwnerLabelKey(value: unknown): string {
  return typeof value === 'string' && MANAGED_OWNER_LABEL_KEYS.has(value)
    ? value
    : 'managed.effective.owners.registeredOwner';
}

export function identityProviderProtocol(value: unknown): string {
  return typeof value === 'string' && IDENTITY_PROVIDER_PROTOCOLS.has(value)
    ? value
    : 'UNAVAILABLE';
}
