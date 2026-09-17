import type {
  WorkspaceActivityEvent,
  WorkspaceActivityExecutionSummary,
  WorkspaceActivityState,
} from '@dwp-frontend/shared-utils';

export const FLOW_ACTIVITY_STATES = [
  ['running', 'running', 'info'],
  ['needs-input', 'needsInput', 'warning'],
  ['policy-blocked', 'policyBlocked', 'error'],
  ['completed', 'completed', 'success'],
  ['failed', 'failed', 'error'],
  ['cancelled', 'cancelled', 'secondary'],
  ['unknown', 'unknown', 'secondary'],
] as const;

export function validFlowActivitySummary(summary: WorkspaceActivityExecutionSummary): boolean {
  const values = FLOW_ACTIVITY_STATES.map(
    ([, key]) => summary[key] ?? (key === 'unknown' ? 0 : NaN)
  );
  const attentionItems =
    summary.attentionItems === undefined
      ? []
      : Array.isArray(summary.attentionItems)
        ? summary.attentionItems
        : null;
  return (
    Number.isSafeInteger(summary.total) &&
    summary.total >= 0 &&
    values.every((value) => Number.isSafeInteger(value) && value >= 0) &&
    values.reduce((total, value) => total + value, 0) === summary.total &&
    Number.isFinite(Date.parse(summary.generatedAt)) &&
    attentionItems !== null &&
    attentionItems.length <= 5 &&
    new Set(attentionItems.map((item) => item.id)).size === attentionItems.length &&
    attentionItems.every(
      (item) =>
        Boolean(item.id) &&
        ['needs-input', 'policy-blocked'].includes(item.state) &&
        item.sourceAccess === 'AVAILABLE' &&
        ['EXECUTION', 'EXECUTION_SNAPSHOT'].includes(item.eventKind ?? '')
    )
  );
}

export function flowActivityHistoryRoute(state?: WorkspaceActivityState): string {
  const params = new URLSearchParams();
  if (state) params.set('state', state);
  return `/activity/timeline${params.size ? `?${params}` : ''}`;
}

export function flowActivityAttentionRoute(event: WorkspaceActivityEvent): string {
  const params = new URLSearchParams({ event: event.id, state: event.state });
  return `/activity/timeline?${params}`;
}
