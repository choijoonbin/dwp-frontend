import type {
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
  return (
    Number.isSafeInteger(summary.total) &&
    summary.total >= 0 &&
    values.every((value) => Number.isSafeInteger(value) && value >= 0) &&
    values.reduce((total, value) => total + value, 0) === summary.total &&
    Number.isFinite(Date.parse(summary.generatedAt))
  );
}

export function flowActivityHistoryRoute(state?: WorkspaceActivityState): string {
  const params = new URLSearchParams();
  if (state) params.set('state', state);
  return `/activity/timeline${params.size ? `?${params}` : ''}`;
}
