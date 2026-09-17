import { HttpError } from '@dwp-frontend/shared-utils';

import type { AdminV2SourceState } from './admin-v2-types';

type QuerySnapshot<T> = Readonly<{
  data: T | undefined;
  error: unknown;
  failureReason: unknown;
  failureCount: number;
  isError: boolean;
  isPending: boolean;
  isFetching: boolean;
}>;

function status(error: unknown): number | null {
  return error instanceof HttpError ? error.status : null;
}

export function retryApprovalAdminV2Read(failureCount: number, error: unknown): boolean {
  const responseStatus = status(error);
  if (responseStatus && [401, 403, 409, 503].includes(responseStatus)) return false;
  return failureCount < 1;
}

export function approvalAdminV2SourceState<T>(
  source: QuerySnapshot<T>,
  scopeReady: boolean,
  empty: (data: T) => boolean
): AdminV2SourceState {
  if (!scopeReady && source.data === undefined) return 'loading';
  const failure = source.failureReason ?? source.error;
  const responseStatus = status(failure);
  if (responseStatus === 401 || responseStatus === 403) return 'forbidden';
  if (responseStatus === 409) return 'conflict';
  if (source.data !== undefined && (source.isError || failure != null || source.failureCount > 0)) {
    return 'stale';
  }
  if (responseStatus === 503 || source.isError || failure != null || source.failureCount > 0) {
    return 'unavailable';
  }
  if (source.data !== undefined) return empty(source.data) ? 'empty' : 'ready';
  if (source.isPending || source.isFetching) return 'loading';
  return 'unavailable';
}

export function approvalAdminV2CommandReady(
  sourceState: AdminV2SourceState,
  scopeReady: boolean,
  target: Readonly<{ commandReady: boolean }> | null | undefined
): boolean {
  return sourceState === 'ready' && scopeReady && target?.commandReady === true;
}

export function approvalAdminV2CommandFailureState(
  error: unknown
): Extract<AdminV2SourceState, 'forbidden' | 'conflict' | 'unavailable'> {
  const responseStatus = status(error);
  if (responseStatus === 401 || responseStatus === 403) return 'forbidden';
  if (responseStatus === 409) return 'conflict';
  return 'unavailable';
}

export function approvalAdminV2CommandErrorState(error: unknown, dispatched: boolean) {
  const responseStatus = status(error);
  if (responseStatus === 409) return 'commandConflict' as const;
  if (!dispatched) return 'authorityUnavailable' as const;
  if (responseStatus === null || responseStatus >= 500) return 'commandUncertain' as const;
  return 'commandRejected' as const;
}
