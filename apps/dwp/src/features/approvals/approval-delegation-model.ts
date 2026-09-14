import type {
  ApprovalDelegation,
  ApprovalDelegationCreateInput,
  ApprovalWorkflow,
} from '@dwp-frontend/shared-utils';

export type ApprovalDelegationWorkflowOption = Readonly<{
  value: string;
  label: string;
}>;

export function isApprovalDelegationDirection(
  direction: unknown
): direction is ApprovalDelegation['direction'] {
  return direction === 'OUTGOING' || direction === 'INCOMING';
}

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

export function isApprovalDelegationPeriodValid(startsAt: string, endsAt: string): boolean {
  const starts = Date.parse(startsAt);
  const ends = Date.parse(endsAt);
  return Number.isFinite(starts) && Number.isFinite(ends) && ends > starts;
}

export function isApprovalDelegationSnapshotCurrent(
  current: readonly ApprovalDelegation[] | undefined,
  snapshot: Pick<ApprovalDelegation, 'delegationId' | 'direction' | 'lifecycleState' | 'version'>
): boolean {
  const authoritative = current?.find(
    (delegation) => delegation.delegationId === snapshot.delegationId
  );
  return (
    authoritative?.version === snapshot.version &&
    authoritative.direction === snapshot.direction &&
    authoritative.lifecycleState === snapshot.lifecycleState
  );
}

export function canRevokeApprovalDelegation(
  delegation: Pick<ApprovalDelegation, 'direction' | 'lifecycleState'>,
  sourceReady: boolean
): boolean {
  return (
    sourceReady && delegation.direction === 'OUTGOING' && delegation.lifecycleState === 'ACTIVE'
  );
}
