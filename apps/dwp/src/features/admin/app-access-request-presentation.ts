const REQUEST_STATES = new Set([
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
  'EXPIRED',
  'REVOKED',
]);
const FULFILLMENT_STATES = new Set([
  'NOT_REQUIRED',
  'PENDING',
  'SUCCEEDED',
  'FAILED',
  'REVOKED',
  'EXPIRED',
]);

export function appAccessRequestStateLabelKey(value: string): string {
  return `appAccess.states.${REQUEST_STATES.has(value) ? value : 'UNKNOWN'}`;
}

export function appAccessFulfillmentStateLabelKey(value: string): string {
  return `appAccess.fulfillmentStates.${FULFILLMENT_STATES.has(value) ? value : 'UNKNOWN'}`;
}

export function appAccessFulfillmentDescriptionKey(value: string): string {
  return `appAccess.fulfillmentDescriptions.${FULFILLMENT_STATES.has(value) ? value : 'UNKNOWN'}`;
}
