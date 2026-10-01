const HOME_CHANGE_TYPES = new Set([
  'BASELINE',
  'SETTINGS_PUBLISHED',
  'ASSET_PUBLISHED',
  'ASSET_RESET',
  'EXPERIENCE_PUBLISHED',
  'ROLLBACK',
]);
const BRANDING_CHANGE_TYPES = new Set([
  'BASELINE',
  'SETTINGS_PUBLISHED',
  'ASSET_PUBLISHED',
  'ASSET_RESET',
  'ROLLBACK',
]);
const HOME_REVISION_SCOPES = new Set([
  'PRESENTATION',
  'BACKGROUND',
  'BACKGROUND_ASSET',
  'LAUNCHPAD',
  'COMPOSITION',
]);
const TEMPLATE_SOURCES = new Set(['CREATE', 'UPDATE', 'PUBLISH', 'REVOKE', 'RESTORE']);
const TEMPLATE_LIFECYCLES = new Set(['DRAFT', 'PUBLISHED', 'REVOKED']);

function closedKey(prefix: string, value: string, values: ReadonlySet<string>): string {
  return `${prefix}.${values.has(value) ? value : 'UNAVAILABLE'}`;
}

export function homeExperienceChangeTypeKey(value: string): string {
  return closedKey('homeExperience.history.changeTypes', value, HOME_CHANGE_TYPES);
}

export function homeExperienceScopeKey(value: string): string {
  return closedKey('homeExperience.history.scopes', value, HOME_REVISION_SCOPES);
}

export function brandingChangeTypeKey(value: string): string {
  return closedKey('branding.history.changeTypes', value, BRANDING_CHANGE_TYPES);
}

export function homeTemplateRevisionSourceKey(value: string): string {
  return closedKey('homeWidgets.blueprints.history.sources', value, TEMPLATE_SOURCES);
}

export function homeTemplateLifecycleKey(value: string): string {
  return closedKey('homeWidgets.blueprints.lifecycle', value, TEMPLATE_LIFECYCLES);
}
