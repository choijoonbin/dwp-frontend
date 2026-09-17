import type { ApprovalRequestDetail, ApprovalTimelineEvent } from '@dwp-frontend/shared-utils';

export function latestApprovalInformationRequestEvent(
  detail: ApprovalRequestDetail | undefined
): ApprovalTimelineEvent | undefined {
  const message = detail?.request.latestInformationRequest?.trim();
  if (!detail || !message) return undefined;

  return detail.timeline
    .filter(
      (event) => event.eventType === 'INFORMATION_REQUESTED' && event.message?.trim() === message
    )
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))[0];
}
