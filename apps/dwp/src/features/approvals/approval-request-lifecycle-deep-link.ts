import { HttpError } from '@dwp-frontend/shared-utils';

import type {
  ApprovalRequest,
  ApprovalRequestDetail,
  ApprovalRequestStatus,
} from '@dwp-frontend/shared-utils';
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

export type ApprovalRequestDeepLinkProblem = 'NOT_FOUND' | 'DENIED' | 'WRONG_VIEW' | 'ERROR';

export function resolveApprovalRequestDeepLink(
  view: ApprovalRequestView,
  requestedId: string | null,
  state: Readonly<{
    data?: ApprovalRequestDetail;
    error: unknown;
    isError: boolean;
    isFetching: boolean;
  }>
): Readonly<{ request?: ApprovalRequest; problem?: ApprovalRequestDeepLinkProblem }> {
  if (!requestedId || state.isFetching) return {};
  const request = state.data?.request;
  if (
    !state.isError &&
    request?.requestId === requestedId &&
    approvalRequestBelongsToView(view, request.status)
  )
    return { request };
  if (state.isError) {
    if (state.error instanceof HttpError && state.error.status === 404)
      return { problem: 'NOT_FOUND' };
    if (state.error instanceof HttpError && [401, 403].includes(state.error.status))
      return { problem: 'DENIED' };
    return { problem: 'ERROR' };
  }
  if (request?.requestId !== requestedId || !approvalRequestBelongsToView(view, request.status))
    return { problem: 'WRONG_VIEW' };
  return { problem: 'ERROR' };
}

export function mergeApprovalRequestSearchResults(
  requested: ApprovalRequest | undefined,
  searched: readonly ApprovalRequest[]
): readonly ApprovalRequest[] {
  return requested && !searched.some((request) => request.requestId === requested.requestId)
    ? [requested, ...searched]
    : searched;
}
