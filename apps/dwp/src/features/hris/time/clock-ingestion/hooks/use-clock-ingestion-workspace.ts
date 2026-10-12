import { useCallback, useEffect, useState } from 'react';

import { combineClockWorkspace } from '../model/clock-ingestion-model';

import type { ClockIngestionDataSource } from '../api/clock-ingestion-api';
import type { ClockIngestionScope, ClockWorkspace } from '../model/clock-ingestion-model';

const loading: ClockWorkspace = {
  state: 'LOADING',
  freshness: 'UNAVAILABLE',
  asOf: null,
  failures: [],
  events: [],
  exceptions: [],
};

const closed: ClockWorkspace = {
  state: 'ERROR',
  freshness: 'UNAVAILABLE',
  asOf: null,
  failures: ['CLOCK_SCOPE_UNAVAILABLE'],
  events: [],
  exceptions: [],
};

export function useClockIngestionWorkspace(
  dataSource: ClockIngestionDataSource | null,
  scope: ClockIngestionScope
) {
  const [workspace, setWorkspace] = useState<ClockWorkspace>(
    dataSource && scope.ready ? loading : closed
  );
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((current) => current + 1), []);

  useEffect(() => {
    if (!dataSource || !scope.ready) {
      setWorkspace(closed);
      return;
    }
    const abort = new AbortController();
    const boundScope: ClockIngestionScope = {
      ready: scope.ready,
      contextScopeKey: scope.contextScopeKey,
      decisionRevision: scope.decisionRevision,
      locale: scope.locale,
      timeZone: scope.timeZone,
      correlationId: scope.correlationId,
    };
    setWorkspace(loading);
    void Promise.allSettled([
      dataSource.readEvents(boundScope, abort.signal),
      dataSource.readExceptions(boundScope, abort.signal),
    ]).then(([eventResult, exceptionResult]) => {
      if (abort.signal.aborted) return;
      const failures: string[] = [];
      if (eventResult.status === 'rejected') failures.push('CLOCK_EVENTS_UNAVAILABLE');
      if (exceptionResult.status === 'rejected') failures.push('TIME_EXCEPTIONS_UNAVAILABLE');
      setWorkspace(
        combineClockWorkspace(
          eventResult.status === 'fulfilled' ? eventResult.value : null,
          exceptionResult.status === 'fulfilled' ? exceptionResult.value : null,
          failures
        )
      );
    });
    return () => abort.abort();
  }, [
    dataSource,
    revision,
    scope.contextScopeKey,
    scope.correlationId,
    scope.decisionRevision,
    scope.locale,
    scope.ready,
    scope.timeZone,
  ]);

  return { workspace, reload } as const;
}
