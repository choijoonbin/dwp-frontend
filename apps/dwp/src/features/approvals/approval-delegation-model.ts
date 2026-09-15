import type {
  ApprovalDelegation,
  ApprovalDelegationCreateInput,
  ApprovalDelegationUpdateInput,
  ApprovalWorkflow,
} from '@dwp-frontend/shared-utils';

export const APPROVAL_DELEGATION_MAX_DURATION_MS = 90 * 24 * 60 * 60 * 1000;
const APPROVAL_DELEGATION_START_GRACE_MS = 5 * 60 * 1000;

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
  const duration = ends - starts;
  return (
    Number.isFinite(starts) &&
    Number.isFinite(ends) &&
    duration > 0 &&
    duration <= APPROVAL_DELEGATION_MAX_DURATION_MS
  );
}

export function isApprovalDelegationWindowCurrent(input: {
  startsAt: string;
  endsAt: string;
  retainedStartsAt?: string;
  nowMs?: number;
}): boolean {
  if (!isApprovalDelegationPeriodValid(input.startsAt, input.endsAt)) return false;
  const startsAtMs = Date.parse(input.startsAt);
  const endsAtMs = Date.parse(input.endsAt);
  const retainedStartsAtMs = input.retainedStartsAt
    ? Date.parse(input.retainedStartsAt)
    : Number.NaN;
  const nowMs = input.nowMs ?? Date.now();
  return (
    endsAtMs > nowMs &&
    (startsAtMs >= nowMs - APPROVAL_DELEGATION_START_GRACE_MS ||
      (Number.isFinite(retainedStartsAtMs) && startsAtMs === retainedStartsAtMs))
  );
}

export function buildApprovalDelegationUpdateInput(input: {
  delegation: ApprovalDelegation;
  scopeType: 'ALL' | 'WORKFLOW';
  workflowId: string;
  startsAt: string;
  endsAt: string;
  reason: string;
  nowMs?: number;
}): ApprovalDelegationUpdateInput | null {
  if (
    !Number.isSafeInteger(input.delegation.delegateUserId) ||
    input.delegation.delegateUserId <= 0 ||
    input.reason.length < 10 ||
    input.reason.length > 1000 ||
    !isApprovalDelegationWindowCurrent({
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      retainedStartsAt: input.delegation.startsAt,
      nowMs: input.nowMs,
    })
  ) {
    return null;
  }
  const period = {
    delegateUserId: input.delegation.delegateUserId,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    reason: input.reason,
    expectedVersion: input.delegation.version,
  };
  if (input.scopeType === 'ALL') return { ...period, scopeType: 'ALL' };
  return input.workflowId
    ? { ...period, scopeType: 'WORKFLOW', workflowId: input.workflowId }
    : null;
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

export function isApprovalDelegationUpdateSnapshotCurrent(
  current: readonly ApprovalDelegation[] | undefined,
  snapshot: ApprovalDelegation
): boolean {
  const authoritative = current?.find(
    (delegation) => delegation.delegationId === snapshot.delegationId
  );
  return Boolean(
    authoritative &&
    isApprovalDelegationSnapshotCurrent(current, snapshot) &&
    authoritative.delegatorUserId === snapshot.delegatorUserId &&
    authoritative.delegateUserId === snapshot.delegateUserId &&
    authoritative.scopeType === snapshot.scopeType &&
    (authoritative.workflowId ?? null) === (snapshot.workflowId ?? null) &&
    authoritative.startsAt === snapshot.startsAt &&
    authoritative.endsAt === snapshot.endsAt &&
    authoritative.reason === snapshot.reason
  );
}

export function sameApprovalDelegationUpdateInput(
  left: ApprovalDelegationUpdateInput,
  right: ApprovalDelegationUpdateInput
): boolean {
  return (
    left.delegateUserId === right.delegateUserId &&
    left.scopeType === right.scopeType &&
    (left.workflowId ?? null) === (right.workflowId ?? null) &&
    left.startsAt === right.startsAt &&
    left.endsAt === right.endsAt &&
    left.reason === right.reason &&
    left.expectedVersion === right.expectedVersion
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

export const canUpdateApprovalDelegation = canRevokeApprovalDelegation;
