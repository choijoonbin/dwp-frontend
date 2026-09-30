const EFFECTIVE_STATES = new Set(['AVAILABLE', 'ALREADY_ADDED', 'DEPRECATED', 'DENY']);
const PUBLIC_REASONS = new Set([
  'NOT_AVAILABLE',
  'DISABLED_BY_ORGANIZATION',
  'APP_ACCESS_REQUIRED',
  'INCOMPATIBLE',
  'TEMPORARILY_UNAVAILABLE',
  'DEPRECATED',
  'AVAILABLE',
  'ALREADY_ADDED',
]);
const PLACEMENTS = new Set([
  'CLASSIC_PERSONAL',
  'FLOW_PERSONAL',
  'FLOW_GOVERNED',
  'MZ_PERSONAL',
  'MZ_GOVERNED',
]);
const POLICY_STATES = new Set(['DRAFT', 'PUBLISHED', 'SUPERSEDED', 'REVOKED']);

export function widgetEffectiveStateLabelKey(value: string): string {
  return `homeWidgets.controlPlane.effective.${EFFECTIVE_STATES.has(value) ? value : 'UNKNOWN'}`;
}

export function widgetEffectiveStatePriority(value: string): number {
  if (value === 'DENY') return 4;
  if (value === 'DEPRECATED') return 3;
  if (value === 'ALREADY_ADDED') return 2;
  if (value === 'AVAILABLE') return 1;
  return 5;
}

export function widgetPublicReasonLabelKey(value: string): string {
  return `homeWidgets.controlPlane.publicReasons.${PUBLIC_REASONS.has(value) ? value : 'UNKNOWN'}`;
}

export function widgetPlacementLabelKey(value: string): string {
  return `homeWidgets.controlPlane.placements.${PLACEMENTS.has(value) ? value : 'UNKNOWN'}`;
}

export function widgetPolicyStateLabelKey(value: string): string {
  return `homeWidgets.controlPlane.policyStates.${POLICY_STATES.has(value) ? value : 'UNKNOWN'}`;
}
