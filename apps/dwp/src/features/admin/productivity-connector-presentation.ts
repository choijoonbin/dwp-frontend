const key = (group: string, value: string, known: ReadonlySet<string>) =>
  `productivity.${group}.${known.has(value) ? value : 'UNKNOWN'}`;

const HEALTH = new Set([
  'CONFIGURATION_REQUIRED',
  'HEALTHY',
  'DEGRADED',
  'AUTHENTICATION_REQUIRED',
  'UNAVAILABLE',
]);
const LIFECYCLE = new Set(['DRAFT', 'ACTIVE', 'SUSPENDED', 'RETIRED']);
const POLICY = new Set(['REVIEW_REQUIRED', 'APPROVED', 'REVOKED', 'BLOCKED']);
const CONSENT = new Set(['NOT_CONNECTED', 'CONNECTED', 'REAUTHORIZATION_REQUIRED', 'REVOKED']);
const RESOURCES = new Set(['MAIL', 'CALENDAR']);
const RUNS = new Set(['RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED', 'BLOCKED']);
const SYNC_MODES = new Set(['INITIAL', 'DELTA', 'RESET']);
const SCOPE_KEYS: Record<string, string> = {
  openid: 'OPENID',
  profile: 'PROFILE',
  offline_access: 'OFFLINE_ACCESS',
  'User.Read': 'USER_READ',
  'Mail.ReadBasic': 'MAIL_READ_BASIC',
  'Calendars.Read': 'CALENDARS_READ',
};

export const productivityHealthLabelKey = (value: string) => key('health', value, HEALTH);
export const productivityLifecycleLabelKey = (value: string) => key('lifecycle', value, LIFECYCLE);
export const productivityPolicyLabelKey = (value: string) => key('policyStates', value, POLICY);
export const productivityConsentLabelKey = (value: string) => key('consentStates', value, CONSENT);
export const productivityResourceLabelKey = (value: string) => key('resources', value, RESOURCES);
export const productivityRunStateLabelKey = (value: string) => key('runStates', value, RUNS);
export const productivitySyncModeLabelKey = (value: string) => key('syncModes', value, SYNC_MODES);
export const productivityScopeLabelKey = (value: string) =>
  `productivity.scopeLabels.${SCOPE_KEYS[value] ?? 'UNKNOWN'}`;
