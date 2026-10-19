import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HttpError, HttpTransportError } from '@dwp-frontend/shared-utils';

import {
  Hrm011ContractError,
  createHrm011QueryRequest,
  selectHrm011Projection,
} from './contracts-compensation-basis-contract';

import type { Hrm011QueryAdapter } from './contracts-compensation-basis-api';
import type { Hrm011Projection, Hrm011TrustedScope } from './contracts-compensation-basis-contract';

export type Hrm011WorkbenchQueryState = Readonly<{
  projection: Hrm011Projection | null;
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

export function hrm011ErrorIsConcealed(error: unknown): boolean {
  return (
    error instanceof Hrm011ContractError ||
    (error instanceof HttpError && [400, 401, 403, 404, 409].includes(error.status))
  );
}

export function hrm011ErrorMayRetainStaleProjection(error: unknown): boolean {
  return (
    (error instanceof HttpError && [429, 503].includes(error.status)) ||
    (error instanceof HttpTransportError && error.reason === 'NETWORK')
  );
}

function abortedBeforeDispatch(): Error {
  const error = new Error('HRM-011 owner query was aborted before dispatch.');
  error.name = 'AbortError';
  return error;
}

function waitForActiveBrowserTask(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(abortedBeforeDispatch());
      return;
    }
    let settled = false;
    const onAbort = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      reject(abortedBeforeDispatch());
    };
    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', onAbort);
      if (signal.aborted) reject(abortedBeforeDispatch());
      else resolve();
    }, 0);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

export function useHrm011WorkbenchQuery({
  adapter,
  scope,
}: Readonly<{
  adapter: Hrm011QueryAdapter;
  scope: Hrm011TrustedScope;
}>): Hrm011WorkbenchQueryState {
  const [cursorHistory, setCursorHistory] = useState<readonly (string | null)[]>([null]);
  const [projection, setProjection] = useState<Hrm011Projection | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [stale, setStale] = useState(false);
  const projectionRef = useRef<Hrm011Projection | null>(null);
  const asOfRef = useRef<string | null>(null);
  const activeRequest = useRef<AbortController | null>(null);
  const requestInFlight = useRef(false);
  const cursor = cursorHistory.at(-1) ?? null;
  const stableScope = useMemo<Hrm011TrustedScope>(
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
      const request = createHrm011QueryRequest(stableScope, {
        cursor,
        asOf: asOfRef.current,
      });
      void waitForActiveBrowserTask(controller.signal)
        .then(() =>
          controller.signal.aborted
            ? undefined
            : adapter.query(request, stableScope.contextScopeKey, controller.signal)
        )
        .then((value) => {
          if (controller.signal.aborted || value === undefined) return;
          const nextProjection = selectHrm011Projection(value);
          if (
            nextProjection.queryState.correlationId !== stableScope.correlationId ||
            nextProjection.queryState.scopeDecisionRevision !== stableScope.decisionRevision ||
            nextProjection.queryState.cachePolicy.authorizationDecisionRevision !==
              stableScope.decisionRevision
          ) {
            throw new Hrm011ContractError('trusted scope or authorization revision');
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
            hrm011ErrorMayRetainStaleProjection(failure);
          if (retain) setStale(true);
          else {
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
    [adapter, cursor, stableScope]
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
      refresh: () => load(true),
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
