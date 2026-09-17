import {
  approvalDeliveryBatchCommand,
  approvalDeliveryDeadLetterCommand,
  approvalDeliveryReplayCommand,
  approvalTaskBatchReassignCommand,
  approvalTaskReassignCommand,
} from '../../components/product-surface-high-risk-command-model';
import {
  approvalOperationsFullData,
  approvalOperationsSourceCurrent,
  type ApprovalOperationsQueryState,
} from './approval-operations-workbench-model';

import type { ApprovalIntegrationDelivery, ApprovalTask } from '@dwp-frontend/shared-utils';
import type { ApprovalDelegationCandidate } from '@dwp-frontend/shared-utils';
import type {
  ApprovalNativeDeliveryAction,
  ApprovalNativeOperationReceipt,
} from '@dwp-frontend/shared-utils/api/approval-native-operations-api';
import type {
  ApprovalHighRiskCommandDescriptor,
  ApprovalHighRiskOperation,
} from '../../components/product-surface-high-risk-command-model';

export const APPROVAL_NATIVE_OPERATION_BATCH_LIMIT = 50;
export const APPROVAL_NATIVE_HIGH_RISK_OPERATIONS = [
  'DELIVERY_DEAD_LETTER',
  'DELIVERY_REPLAY',
  'DELIVERY_BATCH_RETRY',
  'DELIVERY_BATCH_DEAD_LETTER',
  'DELIVERY_BATCH_REPLAY',
  'DELIVERY_RECONCILE',
  'TASK_REASSIGN',
  'TASK_BATCH_REASSIGN',
] as const satisfies readonly ApprovalHighRiskOperation[];

export type ApprovalDeliveryOperation = ApprovalNativeDeliveryAction | 'SINGLE_RETRY';

type ProposalBase = Readonly<{
  operation: ApprovalHighRiskOperation;
  sourceGeneratedAt: string;
  scopeFingerprint: string;
  selectionFingerprint: string;
  reason: string;
}>;

export type ApprovalNativeOperationProposal =
  | (ProposalBase &
      Readonly<{
        kind: 'DELIVERY_SINGLE';
        action: 'DEAD_LETTER' | 'REPLAY';
        target: ApprovalIntegrationDelivery;
      }>)
  | (ProposalBase &
      Readonly<{
        kind: 'DELIVERY_BATCH';
        action: ApprovalNativeDeliveryAction;
        operationId: string;
        targets: readonly ApprovalIntegrationDelivery[];
      }>)
  | (ProposalBase &
      Readonly<{
        kind: 'TASK_SINGLE';
        target: ApprovalTask;
        candidate: ApprovalDelegationCandidate;
      }>)
  | (ProposalBase &
      Readonly<{
        kind: 'TASK_BATCH';
        operationId: string;
        targets: readonly ApprovalTask[];
        candidate: ApprovalDelegationCandidate;
      }>);

function stableIds(ids: readonly string[]) {
  return [...ids].sort().join('\u0000');
}

function validReason(reason: string) {
  const trimmed = reason.trim();
  if (!trimmed || trimmed.length > 1000) throw new Error('Invalid Approval operation reason');
  return trimmed;
}

function requireBatch<T>(targets: readonly T[]) {
  if (targets.length < 1 || targets.length > APPROVAL_NATIVE_OPERATION_BATCH_LIMIT) {
    throw new Error('Invalid Approval operation batch');
  }
  return targets.map((target) => structuredClone(target));
}

export function toggleApprovalOperationSelection(
  selected: ReadonlySet<string>,
  targetId: string,
  checked: boolean
): Set<string> {
  const next = new Set(selected);
  if (checked) {
    if (!next.has(targetId) && next.size >= APPROVAL_NATIVE_OPERATION_BATCH_LIMIT) return next;
    next.add(targetId);
  } else {
    next.delete(targetId);
  }
  return next;
}

export function approvalDeliverySupports(
  delivery: ApprovalIntegrationDelivery,
  action: ApprovalNativeDeliveryAction
): boolean {
  if (action === 'RETRY') {
    return (
      (delivery.status === 'FAILED' || delivery.status === 'DEAD') &&
      delivery.retryEligibility?.eligible === true &&
      delivery.retryEligibility.expectedVersion === delivery.version
    );
  }
  if (action === 'DEAD_LETTER') return delivery.status === 'FAILED';
  if (action === 'REPLAY') return delivery.status === 'DEAD';
  return ['PENDING', 'SENDING', 'FAILED', 'DEAD'].includes(delivery.status);
}

export function approvalTaskSupportsReassignment(task: ApprovalTask): boolean {
  return task.status === 'PENDING' || task.status === 'CLAIMED';
}

export function createApprovalDeliveryOperationProposal(
  input: Readonly<{
    action: Exclude<ApprovalDeliveryOperation, 'SINGLE_RETRY'>;
    targets: readonly ApprovalIntegrationDelivery[];
    reason: string;
    generatedAt: string;
    scopeFingerprint: string;
    operationId?: string;
  }>
): ApprovalNativeOperationProposal {
  const targets = requireBatch(input.targets);
  if (!targets.every((target) => approvalDeliverySupports(target, input.action))) {
    throw new Error('Approval delivery operation is no longer eligible');
  }
  const reason = validReason(input.reason);
  const selected = stableIds(targets.map((target) => target.outboxId));
  if (targets.length === 1 && (input.action === 'DEAD_LETTER' || input.action === 'REPLAY')) {
    return Object.freeze({
      kind: 'DELIVERY_SINGLE',
      operation: input.action === 'DEAD_LETTER' ? 'DELIVERY_DEAD_LETTER' : 'DELIVERY_REPLAY',
      action: input.action,
      target: targets[0]!,
      sourceGeneratedAt: input.generatedAt,
      scopeFingerprint: input.scopeFingerprint,
      selectionFingerprint: selected,
      reason,
    });
  }
  const operation = (
    {
      RETRY: 'DELIVERY_BATCH_RETRY',
      DEAD_LETTER: 'DELIVERY_BATCH_DEAD_LETTER',
      REPLAY: 'DELIVERY_BATCH_REPLAY',
      RECONCILE: 'DELIVERY_RECONCILE',
    } as const
  )[input.action];
  return Object.freeze({
    kind: 'DELIVERY_BATCH',
    operation,
    action: input.action,
    operationId: input.operationId ?? globalThis.crypto.randomUUID(),
    targets,
    sourceGeneratedAt: input.generatedAt,
    scopeFingerprint: input.scopeFingerprint,
    selectionFingerprint: selected,
    reason,
  });
}

export function createApprovalTaskReassignmentProposal(
  input: Readonly<{
    targets: readonly ApprovalTask[];
    candidate: ApprovalDelegationCandidate;
    reason: string;
    generatedAt: string;
    scopeFingerprint: string;
    operationId?: string;
  }>
): ApprovalNativeOperationProposal {
  const targets = requireBatch(input.targets);
  if (
    !targets.every(approvalTaskSupportsReassignment) ||
    !Number.isSafeInteger(input.candidate.userId) ||
    input.candidate.userId < 1 ||
    !input.candidate.personPublicId
  ) {
    throw new Error('Approval task reassignment is no longer eligible');
  }
  const base = {
    candidate: structuredClone(input.candidate),
    sourceGeneratedAt: input.generatedAt,
    scopeFingerprint: input.scopeFingerprint,
    selectionFingerprint: stableIds(targets.map((target) => target.taskId)),
    reason: validReason(input.reason),
  } as const;
  return targets.length === 1
    ? Object.freeze({
        ...base,
        kind: 'TASK_SINGLE',
        operation: 'TASK_REASSIGN',
        target: targets[0]!,
      })
    : Object.freeze({
        ...base,
        kind: 'TASK_BATCH',
        operation: 'TASK_BATCH_REASSIGN',
        operationId: input.operationId ?? globalThis.crypto.randomUUID(),
        targets,
      });
}

export function approvalNativeOperationCommand(
  proposal: ApprovalNativeOperationProposal
): ApprovalHighRiskCommandDescriptor {
  if (proposal.kind === 'DELIVERY_SINGLE') {
    return proposal.action === 'DEAD_LETTER'
      ? approvalDeliveryDeadLetterCommand(
          proposal.target.outboxId,
          proposal.target.version,
          proposal.reason
        )
      : approvalDeliveryReplayCommand(
          proposal.target.outboxId,
          proposal.target.version,
          proposal.reason
        );
  }
  if (proposal.kind === 'DELIVERY_BATCH') {
    return approvalDeliveryBatchCommand(
      proposal.operation as Extract<
        ApprovalHighRiskOperation,
        | 'DELIVERY_BATCH_RETRY'
        | 'DELIVERY_BATCH_DEAD_LETTER'
        | 'DELIVERY_BATCH_REPLAY'
        | 'DELIVERY_RECONCILE'
      >,
      proposal.operationId,
      proposal.targets.map((target) => ({
        targetId: target.outboxId,
        expectedVersion: target.version,
      })),
      proposal.reason
    );
  }
  const candidatePersonId = proposal.candidate.personPublicId!;
  if (proposal.kind === 'TASK_SINGLE') {
    return approvalTaskReassignCommand(
      proposal.target.taskId,
      proposal.target.version,
      proposal.candidate.userId,
      candidatePersonId,
      proposal.reason
    );
  }
  return approvalTaskBatchReassignCommand(
    proposal.operationId,
    proposal.targets.map((target) => ({
      targetId: target.taskId,
      expectedVersion: target.version,
      assigneeUserId: proposal.candidate.userId,
      assigneePersonPublicId: candidatePersonId,
    })),
    proposal.reason
  );
}

export function approvalNativeOperationSnapshotCurrent(
  state: ApprovalOperationsQueryState | undefined,
  proposal: ApprovalNativeOperationProposal,
  current: Readonly<{
    selectedIds: ReadonlySet<string>;
    scopeFingerprint: string;
    canOperate: boolean;
  }>,
  now = Date.now()
): boolean {
  if (
    !current.canOperate ||
    current.scopeFingerprint !== proposal.scopeFingerprint ||
    stableIds([...current.selectedIds]) !== proposal.selectionFingerprint ||
    !approvalOperationsSourceCurrent(state, now)
  ) {
    return false;
  }
  const data = approvalOperationsFullData(state?.data);
  if (!data) return false;
  if (proposal.kind === 'DELIVERY_SINGLE') {
    const target = data.integrationDeliveries.find(
      (item) => item.outboxId === proposal.target.outboxId
    );
    return (
      JSON.stringify(target) === JSON.stringify(proposal.target) &&
      Boolean(target && approvalDeliverySupports(target, proposal.action))
    );
  }
  if (proposal.kind === 'DELIVERY_BATCH') {
    return proposal.targets.every((original) => {
      const target = data.integrationDeliveries.find((item) => item.outboxId === original.outboxId);
      return (
        JSON.stringify(target) === JSON.stringify(original) &&
        Boolean(target && approvalDeliverySupports(target, proposal.action))
      );
    });
  }
  const originals = proposal.kind === 'TASK_SINGLE' ? [proposal.target] : proposal.targets;
  return originals.every((original) => {
    const target = data.breachedTasks.find((item) => item.taskId === original.taskId);
    return (
      JSON.stringify(target) === JSON.stringify(original) &&
      Boolean(target && approvalTaskSupportsReassignment(target))
    );
  });
}

export function approvalNativeOperationReceiptMatches(
  proposal: ApprovalNativeOperationProposal,
  receipt: ApprovalNativeOperationReceipt
): boolean {
  const expectedOperationId =
    proposal.kind === 'DELIVERY_BATCH' || proposal.kind === 'TASK_BATCH'
      ? proposal.operationId
      : null;
  const batch = expectedOperationId !== null;
  const expectedOperation =
    proposal.kind === 'TASK_SINGLE' || proposal.kind === 'TASK_BATCH'
      ? 'TASK_REASSIGN'
      : {
          RETRY: 'DELIVERY_RETRY',
          DEAD_LETTER: 'DELIVERY_DEAD_LETTER',
          REPLAY: 'DELIVERY_REPLAY',
          RECONCILE: 'DELIVERY_RECONCILE',
        }[proposal.action];
  const expectedAssigneeUserId =
    proposal.kind === 'TASK_SINGLE' || proposal.kind === 'TASK_BATCH'
      ? proposal.candidate.userId
      : null;
  const targets =
    proposal.kind === 'DELIVERY_SINGLE' || proposal.kind === 'TASK_SINGLE'
      ? [proposal.target]
      : proposal.targets;
  const expectedById = new Map(
    targets.map((target) => ['outboxId' in target ? target.outboxId : target.taskId, target])
  );
  return (
    receipt.operation === expectedOperation &&
    receipt.commandMode === (batch ? 'BATCH' : 'SINGLE') &&
    (expectedOperationId === null || receipt.operationId === expectedOperationId) &&
    receipt.itemCount === targets.length &&
    stableIds(receipt.items.map((item) => item.targetId)) === stableIds([...expectedById.keys()]) &&
    receipt.items.every((item) => {
      const target = expectedById.get(item.targetId);
      if (!target) return false;
      const task = 'taskId' in target;
      const expectedAfter = task
        ? 'PENDING'
        : proposal.kind === 'DELIVERY_SINGLE' || proposal.kind === 'DELIVERY_BATCH'
          ? proposal.action === 'DEAD_LETTER'
            ? 'DEAD'
            : proposal.action === 'RECONCILE'
              ? target.status === 'SENDING'
                ? 'FAILED'
                : target.status
              : 'PENDING'
          : '';
      return (
        item.requestId === (target.requestId ?? null) &&
        item.previousVersion === target.version &&
        item.committedVersion === target.version + 1 &&
        item.statusBefore === target.status &&
        item.statusAfter === expectedAfter &&
        item.assigneeUserId === (task ? expectedAssigneeUserId : null)
      );
    })
  );
}
