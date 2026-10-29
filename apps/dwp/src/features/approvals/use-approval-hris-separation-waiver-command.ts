import { useCallback, useEffect, useMemo, useRef } from 'react';
import { approveApprovalHrisSeparationWaiverTask } from '@dwp-frontend/shared-utils/api/approval-hris-separation-waiver-api';
import { snapshotApprovalHrisSeparationWaiverTaskApproveInput } from '@dwp-frontend/shared-utils/api/approval-hris-separation-waiver-contract';
import { ProductSurfaceOperationCancelledError } from '../../components/product-surface-operation-coordinator';
import { approvalHrisSeparationWaiverTaskApproveCommand } from './approval-hris-separation-waiver-command';
import { useApprovalHighRiskCommand } from './use-approval-high-risk-command';

import type { ApprovalTaskDetail } from '@dwp-frontend/shared-utils';
import type { ApprovalHrisSeparationWaiverTaskApproveInput } from '@dwp-frontend/shared-utils/api/approval-hris-separation-waiver-contract';

export type ApprovalHrisSeparationWaiverCommandCandidate = Readonly<{
  taskId: string;
  input: ApprovalHrisSeparationWaiverTaskApproveInput;
  correlationId: string;
  scopeIdentity: string;
  refreshCurrent: () => Promise<void>;
  assertCurrent: () => void;
}>;

export function useApprovalHrisSeparationWaiverCommand({
  onSuccess,
  onConflict,
}: {
  onSuccess?: (
    result: ApprovalTaskDetail,
    candidate: ApprovalHrisSeparationWaiverCommandCandidate
  ) => void | Promise<void>;
  onConflict?: (candidate: ApprovalHrisSeparationWaiverCommandCandidate) => void | Promise<void>;
}) {
  const pending = useRef<ApprovalHrisSeparationWaiverCommandCandidate | null>(null);
  const high = useApprovalHighRiskCommand<ApprovalTaskDetail>({
    operation: 'HRIS_SEPARATION_WAIVER_TASK_APPROVE',
    execute: async (command, execution) => {
      const candidate = pending.current;
      if (!candidate || execution.mode !== 'SECURE') {
        throw new ProductSurfaceOperationCancelledError();
      }
      const body = snapshotApprovalHrisSeparationWaiverTaskApproveInput(candidate.input);
      if (
        command.targetId !== candidate.taskId ||
        command.targetType !== 'HRIS_SEPARATION_WAIVER_TASK' ||
        command.expectedObjectVersion !== body.expectedVersion ||
        JSON.stringify(command.payload) !== JSON.stringify(body)
      ) {
        throw new ProductSurfaceOperationCancelledError();
      }
      await candidate.refreshCurrent();
      candidate.assertCurrent();
      return approveApprovalHrisSeparationWaiverTask(
        candidate.taskId,
        body,
        execution,
        candidate.correlationId,
        candidate.assertCurrent
      );
    },
    onSuccess: async (result) => {
      const candidate = pending.current;
      pending.current = null;
      if (candidate) await onSuccess?.(result, candidate);
    },
    onConflict: async () => {
      const candidate = pending.current;
      pending.current = null;
      if (candidate) await onConflict?.(candidate);
    },
  });

  const begin = useCallback(
    async (candidate: ApprovalHrisSeparationWaiverCommandCandidate) => {
      if (pending.current) throw new ProductSurfaceOperationCancelledError();
      candidate.assertCurrent();
      const input = snapshotApprovalHrisSeparationWaiverTaskApproveInput(candidate.input);
      const captured = Object.freeze({ ...candidate, input });
      pending.current = captured;
      try {
        await high.begin(
          approvalHrisSeparationWaiverTaskApproveCommand(captured.taskId, captured.input)
        );
      } catch (error) {
        if (pending.current === captured) pending.current = null;
        throw error;
      }
    },
    [high]
  );
  const close = useCallback(() => {
    pending.current = null;
    high.controller.close();
  }, [high.controller]);
  useEffect(() => {
    if (!high.controller.open && !high.controller.busy && !high.controller.attempt) {
      pending.current = null;
    }
  }, [high.controller.attempt, high.controller.busy, high.controller.open]);
  const controller = useMemo(() => ({ ...high.controller, close }), [close, high.controller]);

  return { begin, controller };
}
