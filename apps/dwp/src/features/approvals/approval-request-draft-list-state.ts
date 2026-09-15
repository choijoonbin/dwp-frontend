import type { ApprovalRequest } from '@dwp-frontend/shared-utils';

export function approvalRequestDraftListState(input: {
  ready: boolean;
  pendingFilter: boolean;
  fetching: boolean;
  error: boolean;
  items?: readonly ApprovalRequest[];
}) {
  const rows = input.ready && !input.error ? (input.items ?? []) : [];
  return {
    rows,
    busy: input.pendingFilter || input.fetching,
    initialLoading: (input.pendingFilter || input.fetching) && rows.length === 0,
    sourceReady: input.ready && !input.pendingFilter && !input.fetching && !input.error,
  } as const;
}
