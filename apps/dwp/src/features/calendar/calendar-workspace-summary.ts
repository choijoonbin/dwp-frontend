import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { resolveZonedDateKey } from '@dwp-frontend/shared-i18n';
import { getCalendarHome } from '@dwp-frontend/shared-utils';

import {
  calendarReadSourceData,
  calendarReadSourceState,
  retryRecoverableCalendarRead,
} from './calendar-read-source-state';
import { calendarRegionalTimeZone } from './calendar-regional-time';
import { calendarHomeSnapshotIsFresh } from './calendar-today-model';

export function useCalendarWorkspaceSummary(enabled: boolean, language: string) {
  const [timeZone, setTimeZone] = useState(calendarRegionalTimeZone);
  useEffect(() => {
    const syncPreference = () => setTimeZone(calendarRegionalTimeZone());
    window.addEventListener('dwp:regional-preference-change', syncPreference);
    return () => window.removeEventListener('dwp:regional-preference-change', syncPreference);
  }, []);
  const query = useQuery({
    queryKey: ['calendar', 'home', timeZone, language],
    queryFn: () => getCalendarHome(timeZone),
    enabled,
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    retry: retryRecoverableCalendarRead,
  });
  const sourceState = enabled
    ? calendarReadSourceState({
        data: query.data,
        error: query.error,
        failureCount: query.failureCount,
        failureReason: query.failureReason,
        isError: query.isError,
        isPending: query.isPending,
      })
    : ('READY' as const);
  const responseContractInvalid = Boolean(
    query.data &&
    (query.data.timeZone !== timeZone ||
      resolveZonedDateKey(query.data.generatedAt, timeZone) !== query.data.date)
  );
  const state = responseContractInvalid
    ? ('UNAVAILABLE' as const)
    : sourceState === 'READY' && query.data && !calendarHomeSnapshotIsFresh(query.data.generatedAt)
      ? ('STALE' as const)
      : sourceState;

  return {
    data: enabled ? calendarReadSourceData(state, query.data) : undefined,
    state,
    isFetching: enabled && query.isFetching,
    refetch: query.refetch,
    timeZone,
  };
}
