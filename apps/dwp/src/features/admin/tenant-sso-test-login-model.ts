const KNOWN_STATES = new Set([
  'BLOCKED',
  'NOT_REQUIRED',
  'READY_FOR_EXTERNAL_PROBE',
  'UNAVAILABLE',
]);

const KNOWN_REASONS = new Set([
  'SSO_LOGIN_NOT_ENABLED',
  'ENABLED_IDENTITY_PROVIDER_NOT_OBSERVED',
  'IDENTITY_PROVIDER_CONFIGURATION_INCOMPLETE',
  'OIDC_CLIENT_SECRET_UNAVAILABLE',
  'OIDC_ENDPOINT_POLICY_INVALID',
  'OIDC_CALLBACK_POLICY_INVALID',
  'EXTERNAL_IDP_LOGIN_EXECUTOR_NOT_CONNECTED',
]);

const KNOWN_BOUNDARIES = new Set(['UNCONNECTED_EXTERNAL_IDP_EXECUTOR']);

export function ssoTestLoginStateLabelKey(value: unknown): string {
  const state = typeof value === 'string' && KNOWN_STATES.has(value) ? value : 'UNKNOWN';
  return `settingsHome.overview.governance.ssoTest.states.${state}`;
}

export function ssoTestLoginReasonLabelKey(value: unknown): string {
  const reason = typeof value === 'string' && KNOWN_REASONS.has(value) ? value : 'UNKNOWN';
  return `settingsHome.overview.governance.ssoTest.reasons.${reason}`;
}

export function ssoTestLoginBoundaryLabelKey(value: unknown): string {
  const boundary = typeof value === 'string' && KNOWN_BOUNDARIES.has(value) ? value : 'UNKNOWN';
  return `settingsHome.overview.governance.ssoTest.boundaries.${boundary}`;
}

export function ssoTestLoginStateTone(value: unknown): 'default' | 'info' | 'warning' | 'error' {
  if (value === 'BLOCKED') return 'error';
  if (value === 'UNAVAILABLE') return 'warning';
  if (value === 'READY_FOR_EXTERNAL_PROBE') return 'info';
  return 'default';
}

export function abbreviatedSsoReceiptHash(value: unknown): string | null {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/i.test(value)) return null;
  return `${value.slice(0, 12)}…`;
}
