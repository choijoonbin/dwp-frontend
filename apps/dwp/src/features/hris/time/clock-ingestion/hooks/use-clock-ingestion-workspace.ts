import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  combineClockWorkspace,
  mergeClockExceptionWorkbench,
  mergeClockWorkbench,
} from '../model/clock-ingestion-model';

import type { ClockPageRequest } from '../api/clock-ingestion-api';
import type {
  ClockExceptionWorkbench,
  ClockIngestionScope,
  ClockWorkbench,
  ClockWorkspace,
} from '../model/clock-ingestion-model';

export type ClockEventPageReader = (
  scope: ClockIngestionScope,
  page: ClockPageRequest,
  signal: AbortSignal
) => Promise<ClockWorkbench>;

export type ClockExceptionPageReader = (
  scope: ClockIngestionScope,
  page: ClockPageRequest,
  signal: AbortSignal
) => Promise<ClockExceptionWorkbench>;

export type ClockPageReaders = Readonly<{
  events?: ClockEventPageReader;
  exceptions?: ClockExceptionPageReader;
}>;

const emptyPage = { asOf: null, nextCursor: null } as const;

const loading: ClockWorkspace = {
  state: 'LOADING',
  freshness: 'UNAVAILABLE',
  asOf: null,
  failures: [],
  events: [],
  exceptions: [],
  eventPage: emptyPage,
  exceptionPage: emptyPage,
};

const closed: ClockWorkspace = {
  ...loading,
  state: 'ERROR',
  failures: ['CLOCK_SCOPE_UNAVAILABLE'],
};

export function useClockIngestionWorkspace(readers: ClockPageReaders, scope: ClockIngestionScope) {
  const eventReader = readers.events;
  const exceptionReader = readers.exceptions;
  const currentScope = useMemo(
    (): ClockIngestionScope => ({
      ready: scope.ready,
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
      scope.ready,
      scope.timeZone,
    ]
  );
  const [workspace, setWorkspace] = useState<ClockWorkspace>(
    (eventReader || exceptionReader) && scope.ready ? loading : closed
  );
  const [revision, setRevision] = useState(0);
  const [loadingMoreEvents, setLoadingMoreEvents] = useState(false);
  const [loadingMoreExceptions, setLoadingMoreExceptions] = useState(false);
  const eventsRef = useRef<ClockWorkbench | null>(null);
  const exceptionsRef = useRef<ClockExceptionWorkbench | null>(null);
  const failuresRef = useRef<string[]>([]);
  const visitRef = useRef(0);
  const continuationAbortsRef = useRef(new Set<AbortController>());

  const publish = useCallback(() => {
    setWorkspace(
      combineClockWorkspace(eventsRef.current, exceptionsRef.current, failuresRef.current)
    );
  }, []);

  const reload = useCallback(() => setRevision((current) => current + 1), []);

  useEffect(
    () => () => {
      visitRef.current += 1;
      continuationAbortsRef.current.forEach((controller) => controller.abort());
      continuationAbortsRef.current.clear();
    },
    []
  );

  useEffect(() => {
    continuationAbortsRef.current.forEach((controller) => controller.abort());
    continuationAbortsRef.current.clear();
    visitRef.current += 1;
    const visit = visitRef.current;
    eventsRef.current = null;
    exceptionsRef.current = null;
    failuresRef.current = [];
    setLoadingMoreEvents(false);
    setLoadingMoreExceptions(false);
    if ((!eventReader && !exceptionReader) || !currentScope.ready) {
      setWorkspace(closed);
      return;
    }

    const abort = new AbortController();
    setWorkspace(loading);
    const eventRead = eventReader
      ? eventReader(currentScope, {}, abort.signal)
      : Promise.reject(new Error('event page authority unavailable'));
    const exceptionRead = exceptionReader
      ? exceptionReader(currentScope, {}, abort.signal)
      : Promise.reject(new Error('exception page authority unavailable'));

    void Promise.allSettled([eventRead, exceptionRead]).then(([eventResult, exceptionResult]) => {
      if (abort.signal.aborted || visitRef.current !== visit) return;
      const failures: string[] = [];
      if (eventResult.status === 'fulfilled') eventsRef.current = eventResult.value;
      else failures.push('CLOCK_EVENTS_UNAVAILABLE');
      if (exceptionResult.status === 'fulfilled') exceptionsRef.current = exceptionResult.value;
      else failures.push('TIME_EXCEPTIONS_UNAVAILABLE');
      failuresRef.current = failures;
      publish();
    });
    return () => abort.abort();
  }, [publish, currentScope, eventReader, exceptionReader, revision]);

  const loadMoreEvents = useCallback(async () => {
    const current = eventsRef.current;
    const read = eventReader;
    if (!current?.nextCursor || !read || loadingMoreEvents) return;
    const visit = visitRef.current;
    const abort = new AbortController();
    continuationAbortsRef.current.add(abort);
    setLoadingMoreEvents(true);
    try {
      const next = await read(
        currentScope,
        { asOf: current.asOf, cursor: current.nextCursor },
        abort.signal
      );
      if (visitRef.current !== visit) return;
      eventsRef.current = mergeClockWorkbench(current, next);
      failuresRef.current = failuresRef.current.filter(
        (failure) => failure !== 'CLOCK_EVENTS_CONTINUATION_UNAVAILABLE'
      );
      publish();
    } catch {
      if (visitRef.current !== visit) return;
      failuresRef.current = [
        ...new Set([...failuresRef.current, 'CLOCK_EVENTS_CONTINUATION_UNAVAILABLE']),
      ];
      publish();
    } finally {
      continuationAbortsRef.current.delete(abort);
      if (visitRef.current === visit) setLoadingMoreEvents(false);
    }
  }, [currentScope, eventReader, loadingMoreEvents, publish]);

  const loadMoreExceptions = useCallback(async () => {
    const current = exceptionsRef.current;
    const read = exceptionReader;
    if (!current?.nextCursor || !read || loadingMoreExceptions) return;
    const visit = visitRef.current;
    const abort = new AbortController();
    continuationAbortsRef.current.add(abort);
    setLoadingMoreExceptions(true);
    try {
      const next = await read(
        currentScope,
        { asOf: current.asOf, cursor: current.nextCursor },
        abort.signal
      );
      if (visitRef.current !== visit) return;
      exceptionsRef.current = mergeClockExceptionWorkbench(current, next);
      failuresRef.current = failuresRef.current.filter(
        (failure) => failure !== 'TIME_EXCEPTIONS_CONTINUATION_UNAVAILABLE'
      );
      publish();
    } catch {
      if (visitRef.current !== visit) return;
      failuresRef.current = [
        ...new Set([...failuresRef.current, 'TIME_EXCEPTIONS_CONTINUATION_UNAVAILABLE']),
      ];
      publish();
    } finally {
      continuationAbortsRef.current.delete(abort);
      if (visitRef.current === visit) setLoadingMoreExceptions(false);
    }
  }, [currentScope, exceptionReader, loadingMoreExceptions, publish]);

  return {
    workspace,
    reload,
    loadMoreEvents,
    loadMoreExceptions,
    loadingMoreEvents,
    loadingMoreExceptions,
  } as const;
}
