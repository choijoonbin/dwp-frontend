import { useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import {
  deadLetterApprovalEvent,
  reassignApprovalTask,
  reassignApprovalTasks,
  replayApprovalEvent,
  runApprovalDeliveryBatch,
} from '@dwp-frontend/shared-utils/api/approval-native-operations-api';

import { ApprovalHighRiskCommandDialog } from './approval-high-risk-command-dialog';
import { useApprovalManagementHighRiskCommand } from './approval-management-command-scope';
import {
  approvalNativeOperationCommand,
  approvalNativeOperationReceiptMatches,
} from './approval-native-operations-model';

import type { ApprovalMutationExecution } from '@dwp-frontend/shared-utils';
import type { ApprovalNativeOperationProposal } from './approval-native-operations-model';

type ApprovalNativeOperationCommandProps = Readonly<{
  proposal: ApprovalNativeOperationProposal;
  cacheKey: readonly string[];
  assertCurrent: () => void;
  onCommitted: () => void | Promise<void>;
  onDismiss: () => void;
}>;

export function ApprovalNativeOperationCommand({
  proposal,
  cacheKey,
  assertCurrent,
  onCommitted,
  onDismiss,
}: ApprovalNativeOperationCommandProps) {
  const queryClient = useQueryClient();
  const descriptor = useMemo(() => approvalNativeOperationCommand(proposal), [proposal]);
  const descriptorFingerprint = useMemo(() => JSON.stringify(descriptor), [descriptor]);
  const command = useApprovalManagementHighRiskCommand({
    cacheKey,
    operation: proposal.operation,
    execute: async (received, execution) => {
      assertCurrent();
      if (JSON.stringify(received) !== descriptorFingerprint) {
        throw new Error('Approval native operation command changed');
      }
      const options = { beforeDispatch: assertCurrent };
      const result = await dispatch(proposal, execution, options);
      assertCurrent();
      if (!approvalNativeOperationReceiptMatches(proposal, result)) {
        throw new Error('Approval native operation receipt changed');
      }
      return result;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: cacheKey, exact: true });
      await onCommitted();
    },
    onConflict: async () => {
      await queryClient.invalidateQueries({ queryKey: cacheKey, exact: true });
    },
  });
  const beginRef = useRef(command.begin);
  beginRef.current = command.begin;

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) void beginRef.current(descriptor);
    });
    return () => {
      active = false;
    };
  }, [descriptor, descriptorFingerprint]);

  return (
    <ApprovalHighRiskCommandDialog
      controller={{
        ...command.controller,
        close: () => {
          if (command.controller.busy) return;
          command.controller.close();
          onDismiss();
        },
      }}
    />
  );
}

async function dispatch(
  proposal: ApprovalNativeOperationProposal,
  execution: ApprovalMutationExecution,
  options: Readonly<{ beforeDispatch: () => void }>
) {
  if (proposal.kind === 'DELIVERY_SINGLE') {
    return proposal.action === 'DEAD_LETTER'
      ? deadLetterApprovalEvent(
          proposal.target.outboxId,
          proposal.target.version,
          proposal.reason,
          execution,
          options
        )
      : replayApprovalEvent(
          proposal.target.outboxId,
          proposal.target.version,
          proposal.reason,
          execution,
          options
        );
  }
  if (proposal.kind === 'DELIVERY_BATCH') {
    return runApprovalDeliveryBatch(
      proposal.action,
      proposal.operationId,
      proposal.targets.map((target) => ({
        targetId: target.outboxId,
        expectedVersion: target.version,
      })),
      proposal.reason,
      execution,
      options
    );
  }
  const personId = proposal.candidate.personPublicId!;
  if (proposal.kind === 'TASK_SINGLE') {
    return reassignApprovalTask(
      proposal.target.taskId,
      proposal.target.version,
      proposal.candidate.userId,
      personId,
      proposal.reason,
      execution,
      options
    );
  }
  return reassignApprovalTasks(
    proposal.operationId,
    proposal.targets.map((target) => ({
      targetId: target.taskId,
      expectedVersion: target.version,
      assigneeUserId: proposal.candidate.userId,
      assigneePersonPublicId: personId,
    })),
    proposal.reason,
    execution,
    options
  );
}
