import type { ApprovalTaskDetail } from '@dwp-frontend/shared-utils/api/approval-api';

export type ApprovalWorkflowEvidenceStep = Readonly<{
  key: string;
  name: string;
  sequence: number;
  state: 'COMPLETED' | 'CURRENT';
}>;

export function buildApprovalWorkflowEvidence(
  detail: ApprovalTaskDetail
): ApprovalWorkflowEvidenceStep[] {
  const completed = new Map<number, ApprovalWorkflowEvidenceStep>();
  detail.timeline.forEach((event) => {
    if (!event.stepName || event.stepSequence == null) return;
    if (event.stepSequence >= detail.task.stepSequence) return;
    completed.set(event.stepSequence, {
      key: `completed-${event.stepSequence}-${event.stepName}`,
      name: event.stepName,
      sequence: event.stepSequence,
      state: 'COMPLETED',
    });
  });
  return [
    ...[...completed.values()].sort((left, right) => left.sequence - right.sequence),
    {
      key: `current-${detail.task.stepSequence}-${detail.task.stepKey}`,
      name: detail.task.stepName,
      sequence: detail.task.stepSequence,
      state: 'CURRENT',
    },
  ];
}
