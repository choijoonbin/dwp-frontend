import type {
  ApprovalDelegation,
  ApprovalDelegationCreateInput,
  ApprovalWorkflow,
} from '@dwp-frontend/shared-utils';

export type ApprovalDelegationWorkflowOption = Readonly<{
  value: string;
  label: string;
}>;

export function buildApprovalDelegationWorkflowOptions(
  workflows: readonly ApprovalWorkflow[],
  locale?: string
): ApprovalDelegationWorkflowOption[] {
  const korean = locale?.startsWith('ko') === true;
  return workflows.map((workflow) => ({
    value: workflow.workflowId,
    label: `${korean ? workflow.nameKo : workflow.nameEn} · ${workflow.workflowKey}`,
  }));
}

export function buildApprovalDelegationCreateInput(input: {
  delegateUserId: number;
  scopeType: 'ALL' | 'WORKFLOW';
  workflowId: string;
  startsAt: string;
  endsAt: string;
  reason: string;
}): ApprovalDelegationCreateInput | null {
  const period = {
    delegateUserId: input.delegateUserId,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    reason: input.reason,
  };
  if (input.scopeType === 'ALL') return { ...period, scopeType: 'ALL' };
  return input.workflowId
    ? { ...period, scopeType: 'WORKFLOW', workflowId: input.workflowId }
    : null;
}

export type ApprovalDelegationWorkflowReference = Readonly<{
  displayKey: string | null;
  compactWorkflowId: string | null;
  workflowId: string | null;
}>;

function compactWorkflowId(workflowId: string): string {
  return workflowId.length > 16 ? `${workflowId.slice(0, 8)}…${workflowId.slice(-4)}` : workflowId;
}

export function buildApprovalDelegationWorkflowReference(
  delegation: Pick<ApprovalDelegation, 'workflowId' | 'workflowKey'>
): ApprovalDelegationWorkflowReference {
  const workflowId = delegation.workflowId?.trim() || null;
  const compactId = workflowId ? compactWorkflowId(workflowId) : null;
  return {
    displayKey: delegation.workflowKey?.trim() || compactId,
    compactWorkflowId: compactId,
    workflowId,
  };
}
