import type { WorkplaceVisitProviderState, WorkplaceVisitState } from '@dwp-frontend/shared-utils';

export type WorkplaceVisitAction =
  | 'SEND_INVITATION'
  | 'REQUEST_ACCESS'
  | 'CANCEL'
  | 'APPROVE'
  | 'RETRY_ACCESS'
  | 'NOTIFY_HOST'
  | 'CONFIRM_CHECKOUT';

const TERMINAL = new Set<WorkplaceVisitState>(['CHECKED_OUT', 'REJECTED', 'CANCELLED']);

export function workplaceVisitTone(state: WorkplaceVisitState) {
  if (['READY', 'ARRIVED', 'CHECKED_OUT', 'APPROVED'].includes(state)) return 'success' as const;
  if (['ACCESS_FAILED', 'REJECTED', 'RESULT_UNKNOWN'].includes(state)) return 'error' as const;
  if (['APPROVAL_PENDING', 'ACCESS_PENDING', 'OVERSTAY'].includes(state)) {
    return 'warning' as const;
  }
  return 'info' as const;
}

export function workplaceVisitProviderTone(state: WorkplaceVisitProviderState) {
  if (state === 'READY') return 'success' as const;
  if (state === 'DEGRADED' || state === 'CONFIGURED_UNVERIFIED') return 'warning' as const;
  return 'error' as const;
}

export function requesterVisitActions(
  state: WorkplaceVisitState,
  recoveryByGetOnly: boolean
): readonly WorkplaceVisitAction[] {
  if (state === 'RESULT_UNKNOWN' || recoveryByGetOnly) return [];
  const actions: WorkplaceVisitAction[] = [];
  if (state === 'PREVIEWED') actions.push('SEND_INVITATION');
  if (state === 'APPROVED') actions.push('REQUEST_ACCESS');
  if (!TERMINAL.has(state)) actions.push('CANCEL');
  return actions;
}

export function adminVisitAction(kind: string): WorkplaceVisitAction | null {
  if (kind === 'APPROVAL_PENDING') return 'APPROVE';
  if (kind === 'ACCESS_FAILED') return 'RETRY_ACCESS';
  if (kind === 'HOST_UNRESPONSIVE') return 'NOTIFY_HOST';
  if (kind === 'OVERSTAY') return 'CONFIRM_CHECKOUT';
  return null;
}

export function isGetOnlyVisitRecovery(state: WorkplaceVisitState, recoveryByGetOnly = false) {
  return state === 'RESULT_UNKNOWN' || recoveryByGetOnly;
}
