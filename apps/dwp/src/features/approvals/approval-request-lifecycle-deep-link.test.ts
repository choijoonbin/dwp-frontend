import { describe, expect, it } from 'vitest';
import { HttpError } from '@dwp-frontend/shared-utils';

import {
  approvalRequestBelongsToView,
  mergeApprovalRequestSearchResults,
  resolveApprovalRequestDeepLink,
} from './approval-request-lifecycle-deep-link';

import type {
  ApprovalRequest,
  ApprovalRequestDetail,
  ApprovalRequestStatus,
} from '@dwp-frontend/shared-utils';

const request = (requestId: string, status: ApprovalRequestStatus) =>
  ({ requestId, status }) as ApprovalRequest;

describe('approval request lifecycle deep links', () => {
  it.each([
    ['drafts', 'DRAFT'],
    ['submitted', 'SUBMITTED'],
    ['submitted', 'IN_REVIEW'],
    ['submitted', 'NEEDS_INFO'],
    ['needs-info', 'NEEDS_INFO'],
    ['archive', 'APPROVED'],
    ['archive', 'REJECTED'],
    ['archive', 'WITHDRAWN'],
    ['archive', 'CANCELLED'],
  ] as const)('accepts %s/%s', (view, status) => {
    expect(approvalRequestBelongsToView(view, status)).toBe(true);
  });

  it.each([
    ['drafts', 'SUBMITTED'],
    ['needs-info', 'IN_REVIEW'],
    ['archive', 'NEEDS_INFO'],
    ['submitted', 'APPROVED'],
  ] as const)('rejects %s/%s', (view, status) => {
    expect(approvalRequestBelongsToView(view, status)).toBe(false);
  });

  it('classifies denied, missing, and wrong-view deep links without exposing a request', () => {
    expect(
      resolveApprovalRequestDeepLink('drafts', 'request-1', {
        error: new HttpError('Denied', 403),
        isError: true,
        isFetching: false,
      })
    ).toEqual({ problem: 'DENIED' });
    expect(
      resolveApprovalRequestDeepLink('drafts', 'request-1', {
        error: new HttpError('Missing', 404),
        isError: true,
        isFetching: false,
      })
    ).toEqual({ problem: 'NOT_FOUND' });
    expect(
      resolveApprovalRequestDeepLink('drafts', 'request-1', {
        data: { request: request('request-1', 'SUBMITTED') } as ApprovalRequestDetail,
        error: null,
        isError: false,
        isFetching: false,
      })
    ).toEqual({ problem: 'WRONG_VIEW' });
  });

  it('prepends an independently loaded deep link exactly once', () => {
    const linked = request('request-1', 'DRAFT');
    const searched = [request('request-2', 'DRAFT')];
    expect(mergeApprovalRequestSearchResults(linked, searched)).toEqual([linked, ...searched]);
    expect(mergeApprovalRequestSearchResults(linked, [linked, ...searched])).toEqual([
      linked,
      ...searched,
    ]);
  });
});
