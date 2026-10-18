import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HttpError, HttpTransportError } from '@dwp-frontend/shared-utils';

import {
  Hrm009ContractError,
  createHrm009QueryRequest,
  selectHrm009Projection,
} from './certificate-contract';

import type { Hrm009QueryAdapter } from './certificate-api';
import type { Hrm009Projection, Hrm009QueryId, Hrm009TrustedScope } from './certificate-contract';

export type Hrm009WorkbenchQueryState = Readonly<{
  projection: Hrm009Projection | null;
  error: unknown;
  loading: boolean;
  fetching: boolean;
  stale: boolean;
  canPrevious: boolean;
  canNext: boolean;
  refresh: () => void;
  previous: () => void;
  next: () => void;
  canDelegate: () => boolean;
}>;

export function hrm009ErrorIsConcealed(error: unknown): boolean {
  return (
    error instanceof Hrm009ContractError ||
    (error instanceof HttpError && [400, 401, 403, 404, 409].includes(error.status))
  );
}

export function hrm009ErrorMayRetainStaleProjection(error: unknown): boolean {
  return (
    (error instanceof HttpError && [429, 503].includes(error.status)) ||
    (error instanceof HttpTransportError && error.reason === 'NETWORK')
  );
}

export function useHrm009WorkbenchQuery({
  adapter,
  queryId,
  scope,
}: Readonly<{
  adapter: Hrm009QueryAdapter;
  queryId: Hrm009QueryId;
  scope: Hrm009TrustedScope;
}>): Hrm009WorkbenchQueryState {
  const [cursorHistory, setCursorHistory] = useState<readonly (string | null)[]>([null]);
  const [projection, setProjection] = useState<Hrm009Projection | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [stale, setStale] = useState(false);
  const projectionRef = useRef<Hrm009Projection | null>(null);
  const asOfRef = useRef<string | null>(null);
  const activeRequest = useRef<AbortController | null>(null);
  const requestInFlight = useRef(false);
  const cursor = cursorHistory.at(-1) ?? null;
  const stableScope = useMemo<Hrm009TrustedScope>(
    () =>
      Object.freeze({
        contextScopeKey: scope.contextScopeKey,
        decisionRevision: scope.decisionRevision,
        locale: scope.locale,
        timeZone: scope.timeZone,
        correlationId: scope.correlationId,
      }),
    [
      scope.contextScopeKey,
      scope.correlationId,
      scope.decisionRevision,
      scope.locale,
      scope.timeZone,
    ]
  );

  useEffect(() => {
    projectionRef.current = projection;
  }, [projection]);

  const load = useCallback(
    (retainCurrentOnRetryableFailure: boolean) => {
      activeRequest.current?.abort();
      const controller = new AbortController();
      activeRequest.current = controller;
      requestInFlight.current = true;
      setFetching(true);
      if (!projectionRef.current || !retainCurrentOnRetryableFailure) setLoading(true);
      if (!retainCurrentOnRetryableFailure) {
        projectionRef.current = null;
        setProjection(null);
        setStale(false);
      }
      setError(null);
      const request = createHrm009QueryRequest(queryId, stableScope, {
        cursor,
        asOf: asOfRef.current,
      });
      void Promise.resolve()
        .then(() =>
          controller.signal.aborted
            ? undefined
            : adapter.query(queryId, request, stableScope.contextScopeKey, controller.signal)
        )
        .then((value) => {
          if (controller.signal.aborted || value === undefined) return;
          const nextProjection = selectHrm009Projection(queryId, value);
          if (
            nextProjection.queryState.correlationId !== stableScope.correlationId ||
            nextProjection.queryState.scopeDecisionRevision !== stableScope.decisionRevision ||
            nextProjection.queryState.cachePolicy.authorizationDecisionRevision !==
              stableScope.decisionRevision
          ) {
            throw new Hrm009ContractError('trusted scope or authorization revision');
          }
          if (asOfRef.current === null) asOfRef.current = nextProjection.asOf;
          projectionRef.current = nextProjection;
          setProjection(nextProjection);
          setStale(nextProjection.queryState.freshness === 'STALE');
          setError(null);
        })
        .catch((failure: unknown) => {
          if (controller.signal.aborted) return;
          const retain =
            retainCurrentOnRetryableFailure &&
            projectionRef.current !== null &&
            hrm009ErrorMayRetainStaleProjection(failure);
          if (retain) {
            setStale(true);
          } else {
            projectionRef.current = null;
            setProjection(null);
            setStale(false);
          }
          setError(failure);
        })
        .finally(() => {
          if (controller.signal.aborted) return;
          requestInFlight.current = false;
          setLoading(false);
          setFetching(false);
        });
      return controller;
    },
    [adapter, cursor, queryId, stableScope]
  );

  useEffect(() => {
    const controller = load(false);
    return () => {
      controller.abort();
      requestInFlight.current = false;
    };
  }, [load]);

  const queryState = projection?.queryState;
  const canDelegate = useCallback(
    () =>
      !requestInFlight.current &&
      !error &&
      !stale &&
      queryState?.state === 'COMPLETE' &&
      queryState.freshness === 'CURRENT',
    [error, queryState, stale]
  );

  return useMemo(
    () => ({
      projection,
      error,
      loading,
      fetching,
      stale,
      canPrevious: cursorHistory.length > 1,
      canNext: Boolean(projection?.queryState.nextCursor),
      refresh: () => {
        load(true);
      },
      previous: () => {
        if (!requestInFlight.current) {
          requestInFlight.current = true;
          setCursorHistory((history) => history.slice(0, -1));
        }
      },
      next: () => {
        const nextCursor = projectionRef.current?.queryState.nextCursor;
        if (!requestInFlight.current && nextCursor) {
          requestInFlight.current = true;
          setCursorHistory((history) => [...history, nextCursor]);
        }
      },
      canDelegate,
    }),
    [canDelegate, cursorHistory.length, error, fetching, load, loading, projection, stale]
  );
}
