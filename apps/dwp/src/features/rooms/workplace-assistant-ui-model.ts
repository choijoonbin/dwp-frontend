import type {
  WorkplaceAssistantCommandReceipt,
  WorkplaceAssistantFeedbackReceipt,
  WorkplaceAssistantGovernance,
  WorkplaceAssistantRequest,
} from '@dwp-frontend/shared-utils/api/workplace-assistant-contract';

export type WorkplaceAssistantTone = 'default' | 'info' | 'success' | 'warning' | 'error';
export type WorkplaceAssistantGovernanceAvailability = 'AVAILABLE' | 'PAUSED' | 'BLOCKED';

const TERMINAL = new Set(['SUCCEEDED', 'PARTIAL', 'FAILED'] as const);

export function workplaceAssistantNeedsGetOnlyRecovery(
  request: WorkplaceAssistantRequest | null,
  receipt?: WorkplaceAssistantCommandReceipt | null
) {
  return request?.state === 'RESULT_UNKNOWN' || receipt?.state === 'RESULT_UNKNOWN';
}

export function workplaceAssistantRequestTone(
  request: Pick<WorkplaceAssistantRequest, 'state'>
): WorkplaceAssistantTone {
  switch (request.state) {
    case 'SUCCEEDED':
      return 'success';
    case 'PARTIAL':
      return 'warning';
    case 'FAILED':
    case 'RESULT_UNKNOWN':
      return 'error';
    case 'VALIDATED':
    case 'AWAITING_CONFIRMATION':
    case 'PROCESSING':
      return 'info';
    default:
      return 'default';
  }
}

export function workplaceAssistantActions(input: {
  request: WorkplaceAssistantRequest | null;
  canUpdate: boolean;
  online: boolean;
  selectedCount: number;
  receipt?: WorkplaceAssistantCommandReceipt | null;
  feedbackReceipt?: WorkplaceAssistantFeedbackReceipt | null;
}) {
  const { request, canUpdate, online, selectedCount, receipt, feedbackReceipt } = input;
  const recoverOnly = workplaceAssistantNeedsGetOnlyRecovery(request, receipt);
  const mutable = Boolean(request && canUpdate && online && !recoverOnly && selectedCount > 0);
  return {
    recoverOnly,
    canValidate: mutable && request?.state === 'SUGGESTED',
    canConfirm:
      mutable &&
      (request?.state === 'VALIDATED' || request?.state === 'AWAITING_CONFIRMATION') &&
      request.validation?.allSelectedItemsValid === true,
    canFeedback:
      Boolean(
        request &&
        canUpdate &&
        online &&
        !recoverOnly &&
        request.redactionState !== 'RETAINED_CONTENT_DELETED' &&
        !feedbackReceipt
      ) && TERMINAL.has(request!.state as 'SUCCEEDED' | 'PARTIAL' | 'FAILED'),
    canRefresh: Boolean(request && online),
  };
}

export function workplaceAssistantGovernanceAvailability(
  governance: WorkplaceAssistantGovernance
): WorkplaceAssistantGovernanceAvailability {
  const versionEvidence = [
    governance.modelProviderReference,
    governance.modelVersion,
    governance.promptVersion,
    governance.toolVersion,
  ].every((value) => Boolean(value?.trim()));
  if (!governance.tenantOptIn || governance.killSwitch) return 'PAUSED';
  if (governance.redactionState !== 'READY' || !versionEvidence) return 'BLOCKED';
  return 'AVAILABLE';
}

export function workplaceAssistantCanManageGovernance(input: {
  permission: boolean;
  elevated: boolean;
  online: boolean;
  receipt?: WorkplaceAssistantCommandReceipt | null;
}) {
  return (
    input.permission && input.elevated && input.online && input.receipt?.state !== 'RESULT_UNKNOWN'
  );
}

export function workplaceAssistantExecutionCounts(
  request: WorkplaceAssistantRequest,
  states: readonly string[]
) {
  return {
    total: states.length,
    succeeded: states.filter((state) => state === 'SUCCEEDED').length,
    failed: states.filter((state) => state === 'FAILED' || state === 'COMPENSATION_FAILED').length,
    unknown: states.filter((state) => state === 'RESULT_UNKNOWN').length,
    pending: states.filter((state) => state === 'PENDING' || state === 'PROCESSING').length,
    requestState: request.state,
  };
}
