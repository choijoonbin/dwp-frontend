import { useQueryClient } from '@tanstack/react-query';
import { getApprovalTask } from '@dwp-frontend/shared-utils';
import { approvalQuorumVotePrecondition } from '@dwp-frontend/shared-utils/api/approval-quorum-contract';
import { ProductSurfaceOperationCancelledError } from '../../components/product-surface-operation-coordinator';
import { isProductSurfaceOperationCancelledError } from './use-approval-governed-mutation';
import { readApprovalHrisSeparationWaiverTaskBinding } from './approval-hris-separation-waiver-command';
import { useApprovalHrisSeparationWaiverCommand } from './use-approval-hris-separation-waiver-command';

import type { ApprovalTaskDetail } from '@dwp-frontend/shared-utils';
import type { ApprovalDecisionConfirmation } from './approval-command-center-model';

type AuthorityInput = Readonly<{
  taskId: string;
  expectedVersion: number;
  scopeIdentity: string;
  quorum?: ApprovalDecisionConfirmation['quorum'];
}>;

export function useApprovalHrisSeparationWaiverDecision({
  confirmation,
  confirmationReady,
  selected,
  comment,
  decisionPending,
  contextScopeKey,
  requestScopeCacheKey,
  isCurrentScope,
  isSelectedTask,
  assertCurrentAuthority,
  submitRegular,
  clearConfirmation,
  completeDecision,
  recover,
  reportError,
}: Readonly<{
  confirmation?: ApprovalDecisionConfirmation;
  confirmationReady: boolean;
  selected?: ApprovalTaskDetail;
  comment: string;
  decisionPending: boolean;
  contextScopeKey?: string;
  requestScopeCacheKey: readonly string[];
  isCurrentScope: (candidate: string) => boolean;
  isSelectedTask: (taskId: string) => boolean;
  assertCurrentAuthority: (input: AuthorityInput) => void;
  submitRegular: (input: ApprovalDecisionConfirmation & { comment?: string }) => void;
  clearConfirmation: () => void;
  completeDecision: (taskId: string, sourceScopeIdentity: string) => Promise<void>;
  recover: (kind: 'CONFLICT' | 'UNAVAILABLE', taskId: string, sourceScope: string) => void;
  reportError: () => void;
}>) {
  const queryClient = useQueryClient();
  const high = useApprovalHrisSeparationWaiverCommand({
    onSuccess: async (_result, candidate) => {
      await completeDecision(candidate.taskId, candidate.scopeIdentity);
    },
    onConflict: (candidate) => {
      recover('CONFLICT', candidate.taskId, candidate.scopeIdentity);
    },
  });

  const unavailable = (taskId: string, sourceScope: string) => {
    clearConfirmation();
    recover('UNAVAILABLE', taskId, sourceScope);
    reportError();
  };

  const submit = async () => {
    if (!confirmation || !confirmationReady || decisionPending || high.controller.open) return;
    const regularInput = { ...confirmation, comment: comment.trim() || undefined };
    if (confirmation.decision !== 'APPROVE') {
      submitRegular(regularInput);
      return;
    }
    if (!selected) return;
    let binding;
    try {
      binding = readApprovalHrisSeparationWaiverTaskBinding(selected);
    } catch {
      unavailable(confirmation.taskId, confirmation.scopeIdentity);
      return;
    }
    if (!binding) {
      submitRegular(regularInput);
      return;
    }
    const quorum = approvalQuorumVotePrecondition(confirmation.quorum);
    if (!quorum) {
      unavailable(confirmation.taskId, confirmation.scopeIdentity);
      return;
    }
    const source: AuthorityInput = {
      taskId: confirmation.taskId,
      expectedVersion: confirmation.expectedVersion,
      scopeIdentity: confirmation.scopeIdentity,
      quorum: confirmation.quorum,
    };
    const taskKey = [
      'approvals',
      'command-task',
      confirmation.taskId,
      ...requestScopeCacheKey,
    ] as const;
    const expectedCorrelationId = binding.correlationId;
    const assertCurrent = () => {
      try {
        if (!isSelectedTask(source.taskId)) throw new ProductSurfaceOperationCancelledError();
        assertCurrentAuthority(source);
        const latest = queryClient.getQueryData<ApprovalTaskDetail>(taskKey);
        const current = latest && readApprovalHrisSeparationWaiverTaskBinding(latest);
        if (!current || current.correlationId !== expectedCorrelationId) {
          throw new ProductSurfaceOperationCancelledError();
        }
      } catch (error) {
        if (isProductSurfaceOperationCancelledError(error)) throw error;
        throw new ProductSurfaceOperationCancelledError();
      }
    };
    const refreshCurrent = async () => {
      const latest = await getApprovalTask(confirmation.taskId, contextScopeKey);
      if (!isCurrentScope(confirmation.scopeIdentity)) {
        throw new ProductSurfaceOperationCancelledError();
      }
      queryClient.setQueryData(taskKey, latest);
      assertCurrent();
    };
    clearConfirmation();
    try {
      await high.begin({
        taskId: confirmation.taskId,
        input: {
          decision: 'APPROVE',
          ...(comment.trim() ? { comment: comment.trim() } : {}),
          expectedVersion: confirmation.expectedVersion,
          quorum,
        },
        correlationId: expectedCorrelationId,
        scopeIdentity: confirmation.scopeIdentity,
        refreshCurrent,
        assertCurrent,
      });
    } catch (error) {
      if (isProductSurfaceOperationCancelledError(error)) return;
      if (!isCurrentScope(confirmation.scopeIdentity)) return;
      recover('UNAVAILABLE', confirmation.taskId, confirmation.scopeIdentity);
      reportError();
    }
  };

  return { ...high, submit };
}
