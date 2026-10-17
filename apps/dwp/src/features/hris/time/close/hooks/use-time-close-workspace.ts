import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HttpError, HttpTransportError } from '@dwp-frontend/shared-utils';

import { assertTimeCloseScope } from '../model/time-close-model';

import type { TimeCloseDataSource, TimeClosePageRequest } from '../api/time-close-api';
import type {
  TimeCloseEntryMode,
  TimeCloseFreshness,
  TimeClosePartialFailure,
  TimeClosePeriod,
  TimeCloseProjection,
  TimeCloseScope,
} from '../model/time-close-model';

export type TimeCloseWorkspaceState = Readonly<{
  kind: 'LOADING' | 'EMPTY' | 'READY' | 'PARTIAL' | 'ERROR';
  freshness: TimeCloseFreshness;
  asOf: string | null;
  nextCursor: string | null;
  periods: readonly TimeClosePeriod[];
  failures: readonly TimeClosePartialFailure[];
  refreshFailure?: 'DENIED' | 'UNAVAILABLE' | 'INVALID';
}>;

type WorkspaceRecord = Readonly<{
  identity: string;
  state: TimeCloseWorkspaceState;
}>;

export type TimeCloseProjectionReader = TimeCloseDataSource['readProjection'];

const loadingState: TimeCloseWorkspaceState = Object.freeze({
  kind: 'LOADING',
  freshness: 'UNAVAILABLE',
  asOf: null,
  nextCursor: null,
  periods: [],
  failures: [],
});

const unavailableState: TimeCloseWorkspaceState = Object.freeze({
  kind: 'ERROR',
  freshness: 'UNAVAILABLE',
  asOf: null,
  nextCursor: null,
  periods: [],
  failures: [],
  refreshFailure: 'INVALID',
});

function scopeReady(scope: TimeCloseScope): boolean {
  try {
    assertTimeCloseScope(scope);
    return true;
  } catch {
    return false;
  }
}

function identityFor(scope: TimeCloseScope, entryMode: TimeCloseEntryMode): string {
  return JSON.stringify([
    scope.ready,
    scope.contextScopeKey,
    scope.decisionRevision,
    scope.locale,
    scope.timeZone,
    scope.correlationId,
    scope.effectiveOn,
    entryMode,
  ]);
}

function stateFromProjection(projection: TimeCloseProjection): TimeCloseWorkspaceState {
  const kind =
    projection.queryState === 'EMPTY'
      ? 'EMPTY'
      : projection.queryState === 'PARTIAL'
        ? 'PARTIAL'
        : projection.queryState === 'UNAVAILABLE'
          ? 'ERROR'
          : 'READY';
  return {
    kind,
    freshness: projection.freshness,
    asOf: projection.asOf,
    nextCursor: projection.nextCursor,
    periods: projection.periods,
    failures: projection.partialFailures,
  };
}

function failureKind(error: unknown): 'DENIED' | 'UNAVAILABLE' | 'INVALID' {
  if (
    error instanceof HttpError &&
    (error.status === 401 || error.status === 403 || error.status === 404)
  ) {
    return 'DENIED';
  }
  if (
    error instanceof HttpTransportError ||
    !(error instanceof Error) ||
    error.name === 'AbortError'
  ) {
    return 'UNAVAILABLE';
  }
  return 'INVALID';
}

function mergeProjection(
  prior: TimeCloseWorkspaceState,
  next: TimeCloseProjection
): TimeCloseWorkspaceState {
  if (prior.asOf !== next.asOf) throw new Error('TIM close continuation changed its as-of.');
  const byId = new Map(prior.periods.map((period) => [period.periodId, period]));
  next.periods.forEach((period) => {
    if (byId.has(period.periodId)) throw new Error('TIM close continuation repeated a period.');
    byId.set(period.periodId, period);
  });
  return {
    kind: next.queryState === 'PARTIAL' || prior.kind === 'PARTIAL' ? 'PARTIAL' : 'READY',
    freshness: prior.freshness === 'STALE' || next.freshness === 'STALE' ? 'STALE' : next.freshness,
    asOf: prior.asOf,
    nextCursor: next.nextCursor,
    periods: [...byId.values()],
    failures: [...prior.failures, ...next.partialFailures],
  };
}

export function useTimeCloseWorkspace({
  reader,
  entryMode,
  scope,
}: Readonly<{
  reader?: TimeCloseProjectionReader;
  entryMode: TimeCloseEntryMode;
  scope: TimeCloseScope;
}>) {
  const { ready, contextScopeKey, decisionRevision, locale, timeZone, correlationId, effectiveOn } =
    scope;
  const currentScope = useMemo<TimeCloseScope>(
    () => ({
      ready,
      contextScopeKey,
      decisionRevision,
      locale,
      timeZone,
      correlationId,
      effectiveOn,
    }),
    [contextScopeKey, correlationId, decisionRevision, effectiveOn, locale, ready, timeZone]
  );
  const identity = identityFor(currentScope, entryMode);
  const valid = scopeReady(currentScope);
  const currentIdentityRef = useRef(identity);
  currentIdentityRef.current = identity;
  const [record, setRecord] = useState<WorkspaceRecord>(() => ({
    identity,
    state: reader && valid ? loadingState : unavailableState,
  }));
  const visibleState = record.identity === identity ? record.state : loadingState;
  const [revision, setRevision] = useState(0);
  const [readSuccessRevision, setReadSuccessRevision] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [denialRecord, setDenialRecord] = useState<
    Readonly<{ identity: string; revision: number }>
  >({ identity, revision: 0 });
  const readAbortRef = useRef<AbortController | null>(null);
  const pageAbortRef = useRef<AbortController | null>(null);
  const loadingMoreRef = useRef(false);
  const denialRevision = denialRecord.identity === identity ? denialRecord.revision : 0;
  const protectedStateIdentity = `${identity}:${denialRevision}:${
    visibleState.refreshFailure === 'DENIED' ? 'denied' : 'active'
  }`;

  const recordDenial = useCallback(() => {
    setDenialRecord((current) => ({
      identity,
      revision: current.identity === identity ? current.revision + 1 : 1,
    }));
  }, [identity]);

  const refresh = useCallback(() => {
    if (!reader || !valid) return;
    setRefreshing(true);
    setRevision((current) => current + 1);
  }, [reader, valid]);

  useEffect(() => {
    readAbortRef.current?.abort();
    pageAbortRef.current?.abort();
    loadingMoreRef.current = false;
    setLoadingMore(false);
    if (!reader || !valid) {
      setRefreshing(false);
      setRecord({ identity, state: unavailableState });
      return;
    }
    const abort = new AbortController();
    readAbortRef.current = abort;
    const sameIdentity = record.identity === identity;
    const prior = sameIdentity ? record.state : null;
    if (!prior || ['LOADING', 'ERROR'].includes(prior.kind)) {
      setRecord({ identity, state: loadingState });
    }
    void reader(entryMode, currentScope, {}, abort.signal)
      .then((projection) => {
        if (abort.signal.aborted || currentIdentityRef.current !== identity) return;
        setRecord({ identity, state: stateFromProjection(projection) });
        setReadSuccessRevision((current) => current + 1);
      })
      .catch((error: unknown) => {
        if (abort.signal.aborted || currentIdentityRef.current !== identity) return;
        const failure = failureKind(error);
        if (
          failure !== 'DENIED' &&
          prior &&
          prior.asOf !== null &&
          (prior.kind === 'READY' || prior.kind === 'PARTIAL' || prior.kind === 'EMPTY')
        ) {
          setRecord({
            identity,
            state: {
              ...prior,
              kind: prior.periods.length === 0 ? 'EMPTY' : 'PARTIAL',
              freshness: 'STALE',
              refreshFailure: failure,
            },
          });
        } else {
          if (failure === 'DENIED') recordDenial();
          setRecord({
            identity,
            state: { ...unavailableState, refreshFailure: failure },
          });
        }
      })
      .finally(() => {
        if (readAbortRef.current === abort) readAbortRef.current = null;
        if (!abort.signal.aborted && currentIdentityRef.current === identity) setRefreshing(false);
      });
    return () => {
      abort.abort();
      if (readAbortRef.current === abort) readAbortRef.current = null;
    };
    // record is intentionally captured at the start of this refresh, not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentScope, entryMode, identity, reader, revision, valid]);

  const loadMore = useCallback(async () => {
    const state = record.identity === identity ? record.state : null;
    if (!reader || !valid || !state?.asOf || !state.nextCursor || loadingMoreRef.current) return;
    const page: TimeClosePageRequest = { asOf: state.asOf, cursor: state.nextCursor };
    const abort = new AbortController();
    pageAbortRef.current = abort;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const projection = await reader(entryMode, currentScope, page, abort.signal);
      if (abort.signal.aborted || currentIdentityRef.current !== identity) return;
      setRecord({ identity, state: mergeProjection(state, projection) });
    } catch (error: unknown) {
      if (abort.signal.aborted || currentIdentityRef.current !== identity) return;
      const failure = failureKind(error);
      if (failure === 'DENIED') recordDenial();
      setRecord(
        failure === 'DENIED'
          ? { identity, state: { ...unavailableState, refreshFailure: 'DENIED' } }
          : {
              identity,
              state: {
                ...state,
                kind: state.periods.length === 0 ? 'EMPTY' : 'PARTIAL',
                freshness: 'STALE',
                refreshFailure: failure,
              },
            }
      );
    } finally {
      if (pageAbortRef.current === abort) pageAbortRef.current = null;
      loadingMoreRef.current = false;
      if (!abort.signal.aborted && currentIdentityRef.current === identity) setLoadingMore(false);
    }
  }, [currentScope, entryMode, identity, reader, record, recordDenial, valid]);

  const deny = useCallback(() => {
    readAbortRef.current?.abort();
    readAbortRef.current = null;
    pageAbortRef.current?.abort();
    loadingMoreRef.current = false;
    setLoadingMore(false);
    setRefreshing(false);
    recordDenial();
    setRecord({
      identity,
      state: { ...unavailableState, refreshFailure: 'DENIED' },
    });
  }, [identity, recordDenial]);

  useEffect(
    () => () => {
      readAbortRef.current?.abort();
      pageAbortRef.current?.abort();
    },
    []
  );

  return {
    state: visibleState,
    scopeIdentity: identity,
    protectedStateIdentity,
    scopeCurrent: record.identity === identity,
    refreshing,
    loadingMore,
    readSuccessRevision,
    refresh,
    loadMore,
    deny,
  } as const;
}
