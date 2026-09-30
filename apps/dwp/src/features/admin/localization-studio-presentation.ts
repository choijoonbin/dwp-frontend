const REVISION_STATES = new Set([
  'DRAFT',
  'IN_REVIEW',
  'APPROVED',
  'REJECTED',
  'PUBLISHED',
  'SUPERSEDED',
]);
const CHANGE_TYPES = new Set(['ADDED', 'UPDATED', 'REMOVED', 'UNCHANGED']);
const DECISIONS = new Set(['SUBMITTED', 'APPROVED', 'REJECTED', 'PUBLISHED', 'RESTORED']);

export function localizationRevisionStateLabelKey(value: string): string {
  return `localization.states.${REVISION_STATES.has(value) ? value : 'UNKNOWN'}`;
}

export function localizationRevisionStateColor(
  value: string
): 'default' | 'info' | 'warning' | 'success' | 'error' {
  const colors: Record<string, ReturnType<typeof localizationRevisionStateColor>> = {
    DRAFT: 'default',
    IN_REVIEW: 'warning',
    APPROVED: 'info',
    REJECTED: 'error',
    PUBLISHED: 'success',
    SUPERSEDED: 'default',
  };
  return colors[value] ?? 'default';
}

export function localizationChangeTypeLabelKey(value: string): string {
  return `localization.diff.states.${CHANGE_TYPES.has(value) ? value : 'UNKNOWN'}`;
}

export function localizationDecisionLabelKey(value: string): string {
  return `localization.decisions.${DECISIONS.has(value) ? value : 'UNKNOWN'}`;
}
