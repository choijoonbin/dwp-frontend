import type { ApprovalTaskDetail, ApprovalTimelineEvent } from '@dwp-frontend/shared-utils';

export type ApprovalCompletedDecisionRecord = Readonly<{
  decision: 'APPROVED' | 'REJECTED';
  event: ApprovalTimelineEvent;
}>;

export function approvalCompletedDecisionRecord(
  detail: ApprovalTaskDetail
): ApprovalCompletedDecisionRecord | undefined {
  const decision = detail.task.status;
  if (decision !== 'APPROVED' && decision !== 'REJECTED') return undefined;
  const eventType = decision === 'APPROVED' ? 'TASK_APPROVED' : 'TASK_REJECTED';
  const events = detail.timeline
    .filter(
      (event) =>
        event.eventType === eventType &&
        event.outcome === 'SUCCESS' &&
        event.stepSequence === detail.task.stepSequence &&
        Number.isFinite(Date.parse(event.occurredAt))
    )
    .sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt));
  const event = events[0];
  return event ? { decision, event } : undefined;
}
