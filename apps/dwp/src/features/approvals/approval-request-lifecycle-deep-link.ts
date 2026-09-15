import type { ApprovalRequestStatus } from '@dwp-frontend/shared-utils';
import type { ApprovalRequestView } from './approval-request-model';

const VIEW_STATUSES: Readonly<Record<ApprovalRequestView, readonly ApprovalRequestStatus[]>> = {
  drafts: ['DRAFT'],
  submitted: ['SUBMITTED', 'IN_REVIEW', 'NEEDS_INFO'],
  'needs-info': ['NEEDS_INFO'],
  archive: ['APPROVED', 'REJECTED', 'WITHDRAWN', 'CANCELLED'],
};

export function approvalRequestBelongsToView(
  view: ApprovalRequestView,
  status: ApprovalRequestStatus
): boolean {
  return VIEW_STATUSES[view].includes(status);
}

