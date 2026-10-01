const PRODUCTIVITY_CONNECTION_STATES = new Set([
  'NOT_CONNECTED',
  'CONNECTED',
  'REAUTHORIZATION_REQUIRED',
  'REVOKED',
]);
const PRIVACY_REQUEST_STATES = new Set(['RECEIVED', 'CANCELLED']);
const PRIVACY_REQUEST_EVENTS = new Set([
  'REQUEST_RECEIVED',
  'FULFILLMENT_BOUNDARY_RECORDED',
  'REQUEST_CANCELLED',
]);
const PRIVACY_CONSENT_STATES = new Set(['GRANTED', 'WITHDRAWN']);

export function productivityConnectionState(value: unknown): string {
  return typeof value === 'string' && PRODUCTIVITY_CONNECTION_STATES.has(value)
    ? value
    : 'UNAVAILABLE';
}

export function privacyRequestState(value: unknown): string {
  return typeof value === 'string' && PRIVACY_REQUEST_STATES.has(value) ? value : 'UNAVAILABLE';
}

export function privacyRequestEvent(value: unknown): string {
  return typeof value === 'string' && PRIVACY_REQUEST_EVENTS.has(value) ? value : 'UNAVAILABLE';
}

export function privacyConsentState(value: unknown): string {
  return typeof value === 'string' && PRIVACY_CONSENT_STATES.has(value) ? value : 'UNAVAILABLE';
}
