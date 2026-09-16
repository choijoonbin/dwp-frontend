import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { mergeFilterSearchParams } from '@dwp-frontend/design-system';
import { HttpError } from '@dwp-frontend/shared-utils';
import { preflightPersonalWorkSource } from '@dwp-frontend/shared-utils/api/personal-work-api';
import type { PersonalWorkSource } from '@dwp-frontend/shared-utils/api/personal-work-contracts';
import type { NavigateFunction } from 'react-router-dom';

import {
  hasWorkMessengerCaptureState,
  readWorkMessengerCaptureState,
  workMessengerSourceReference,
} from '../../components/work-messenger-capture-state';

export type WorkMessengerSourceState = 'NONE' | 'LOADING' | 'READY' | 'DENIED' | 'UNAVAILABLE';

function sourceFailureState(error: unknown): WorkMessengerSourceState {
  return error instanceof HttpError && [403, 404, 410].includes(error.status)
    ? 'DENIED'
    : 'UNAVAILABLE';
}

export function useClearWorkTaskComposeIntent({
  envelope,
  hash,
  navigate,
  pathname,
  searchParams,
  state,
}: {
  envelope: boolean;
  hash: string;
  navigate: NavigateFunction;
  pathname: string;
  searchParams: URLSearchParams;
  state: unknown;
}) {
  return useCallback(() => {
    const next = mergeFilterSearchParams(searchParams, { compose: null });
    navigate(
      { pathname, search: next.toString(), hash },
      { replace: true, state: envelope ? null : state }
    );
  }, [envelope, hash, navigate, pathname, searchParams, state]);
}

export function useWorkMessengerCapture(
  state: unknown,
  owner: string | null,
  now: number,
  canCreate: boolean,
  composeRequested: boolean
) {
  const capture = useMemo(
    () => readWorkMessengerCaptureState(state, owner, now),
    [owner, now, state]
  );
  const query = useQuery<PersonalWorkSource>({
    queryKey: [
      'workspace',
      'work-hub',
      'messenger-source-preflight',
      owner,
      capture?.conversationId,
      capture?.messageId,
    ],
    enabled: Boolean(capture && canCreate),
    staleTime: 0,
    retry: false,
    queryFn: ({ signal }) => {
      if (!capture) throw new Error('Messenger capture is unavailable');
      return preflightPersonalWorkSource(workMessengerSourceReference(capture), signal);
    },
    meta: { accessSensitive: true },
  });
  const source =
    query.isSuccess && !query.isFetching && query.data?.availability === 'AVAILABLE'
      ? query.data
      : null;
  const sourceState: WorkMessengerSourceState =
    !capture || !canCreate
      ? 'NONE'
      : query.isPending || query.isFetching
        ? 'LOADING'
        : source
          ? 'READY'
          : query.isError
            ? sourceFailureState(query.error)
            : 'UNAVAILABLE';
  return {
    capture,
    source,
    sourceState,
    sourcePending: sourceState === 'LOADING',
    sourceError: sourceState === 'DENIED' || sourceState === 'UNAVAILABLE',
    retrySource: () => query.refetch(),
    envelope: hasWorkMessengerCaptureState(state),
    composeTaskRequested:
      composeRequested && (!hasWorkMessengerCaptureState(state) || Boolean(capture)),
  };
}
