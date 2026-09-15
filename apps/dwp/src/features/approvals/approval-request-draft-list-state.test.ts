import { describe, expect, it } from 'vitest';

import { approvalRequestDraftListState } from './approval-request-draft-list-state';

import type { ApprovalRequest } from '@dwp-frontend/shared-utils';

const row = { requestId: 'request-1', version: 3 } as ApprovalRequest;

describe('approval request draft list source state', () => {
  it('retains rendered rows during background refetch while writes fail closed', () => {
    expect(
      approvalRequestDraftListState({
        ready: true,
        pendingFilter: false,
        fetching: true,
        error: false,
        items: [row],
      })
    ).toEqual({ rows: [row], busy: true, initialLoading: false, sourceReady: false });
  });

  it('uses a loading state only when there is no retained structure', () => {
    expect(
      approvalRequestDraftListState({
        ready: true,
        pendingFilter: true,
        fetching: false,
        error: false,
      }).initialLoading
    ).toBe(true);
  });

  it('drops retained rows on an authoritative source error', () => {
    expect(
      approvalRequestDraftListState({
        ready: true,
        pendingFilter: false,
        fetching: false,
        error: true,
        items: [row],
      }).rows
    ).toEqual([]);
  });
});
