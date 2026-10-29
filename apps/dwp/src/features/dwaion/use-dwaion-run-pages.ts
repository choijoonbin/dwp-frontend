import { useMemo } from 'react';
import { useInfiniteQuery, useQueries, useQuery } from '@tanstack/react-query';
import { getDwaionUserRun, getDwaionUserRunPage, HttpError } from '@dwp-frontend/shared-utils';

import {
  isAuthoritativeActivityDenial,
  isAuthoritativeActivityRootDenial,
  usableActivityQueryData,
} from '../../components/activity/activity-query-contract';
import { DWAION_ACTIVITY_PAGE_LIMIT } from './dwaion-activity-model';

import type { DwaionActivityPeriod } from './dwaion-activity-model';
import type { DwaionUserRun, DwaionUserRunPage } from '@dwp-frontend/shared-utils';

export const DWAION_ACTIVITY_REFRESH_INTERVAL_MS = 60_000;
export const DWAION_ACTIVITY_RUNNING_REFRESH_INTERVAL_MS = 15_000;

export function nextDwaionRunPageParam(page: DwaionUserRunPage): string | undefined {
  return page.hasMore ? (page.nextCursor ?? undefined) : undefined;
}

export function dwaionRunPagesRefetchInterval(
  pages: readonly DwaionUserRunPage[] | undefined
): number | false {
  if (!pages?.length) return DWAION_ACTIVITY_REFRESH_INTERVAL_MS;
  return false;
}

export function shouldRefetchDwaionRunPagesOnLifecycle(
  pages: readonly DwaionUserRunPage[] | undefined
): boolean {
  return !pages?.length;
}

export function dwaionHeadRunPageRefetchInterval(page: DwaionUserRunPage | undefined): number {
  return page?.runs.some((run) => run.runState === 'RUNNING')
    ? DWAION_ACTIVITY_RUNNING_REFRESH_INTERVAL_MS
    : DWAION_ACTIVITY_REFRESH_INTERVAL_MS;
}

export function dwaionRunDetailRefetchInterval(
  run: Pick<DwaionUserRun, 'runState'> | undefined
): number | false {
  return run?.runState === 'RUNNING' ? DWAION_ACTIVITY_RUNNING_REFRESH_INTERVAL_MS : false;
}

export function dwaionRunDetailStaleTime(run: Pick<DwaionUserRun, 'runState'> | undefined): number {
  return run && dwaionRunDetailRefetchInterval(run) === false ? Infinity : 15_000;
}

export function dwaionRunDetailRefetchOnWindowFocus(
  run: Pick<DwaionUserRun, 'runState'> | undefined
): boolean {
  return dwaionRunDetailRefetchInterval(run) !== false;
}

export function shouldStopDwaionRunDetailRefresh(error: unknown): boolean {
  return (
    error instanceof TypeError ||
    (error instanceof HttpError && [400, 401, 403, 404].includes(error.status))
  );
}

export function dwaionKnownRunDetailRefetchInterval(
  detailRun: Pick<DwaionUserRun, 'runState'> | undefined,
  listedRun: Pick<DwaionUserRun, 'runState'> | undefined,
  error: unknown
): number | false {
  return shouldStopDwaionRunDetailRefresh(error)
    ? false
    : dwaionRunDetailRefetchInterval(detailRun ?? listedRun);
}

export function dwaionKnownRunDetailRefetchOnWindowFocus(
  detailRun: Pick<DwaionUserRun, 'runState'> | undefined,
  listedRun: Pick<DwaionUserRun, 'runState'> | undefined,
  error: unknown
): boolean {
  return (
    !shouldStopDwaionRunDetailRefresh(error) &&
    dwaionRunDetailRefetchOnWindowFocus(detailRun ?? listedRun)
  );
}

function retryDwaionActivity(count: number, error: Error): boolean {
  return !(error instanceof HttpError && [400, 401, 403, 404].includes(error.status)) && count < 1;
}

export function overlayDwaionRunPages(
  head: DwaionUserRunPage | undefined,
  pages: readonly DwaionUserRunPage[] | undefined,
  detailRuns: readonly DwaionUserRun[] = [],
  deniedRunIds: readonly string[] = []
): DwaionUserRun[] {
  const denied = new Set(deniedRunIds.map((runId) => runId.toLowerCase()));
  const details = new Map(detailRuns.map((run) => [run.runId.toLowerCase(), run]));
  const unique = new Map<string, DwaionUserRun>();
  for (const page of [...(head ? [head] : []), ...(pages ?? [])]) {
    for (const run of page.runs) {
      const key = run.runId.toLowerCase();
      if (!denied.has(key) && !unique.has(key)) unique.set(key, details.get(key) ?? run);
    }
  }
  return [...unique.values()];
}

export function useDwaionRunPages({
  identity,
  period,
  periodFrom,
  enabled,
  selectedRunId = '',
}: {
  identity: string;
  period: DwaionActivityPeriod;
  periodFrom: string;
  enabled: boolean;
  selectedRunId?: string;
}) {
  const queryKey = [
    'dwaion',
    'user-runs',
    'period-pages',
    identity,
    period,
    periodFrom,
    DWAION_ACTIVITY_PAGE_LIMIT,
  ] as const;
  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam, signal }) =>
      getDwaionUserRunPage({
        limit: DWAION_ACTIVITY_PAGE_LIMIT,
        from: periodFrom,
        cursor: pageParam ?? undefined,
        signal,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: nextDwaionRunPageParam,
    enabled,
    staleTime: 15_000,
    // Infinite-query polling refetches every loaded page. Stop automatic refresh after the
    // user opens older history; the explicit refresh action resets to a fresh first page.
    refetchInterval: (currentQuery) =>
      dwaionRunPagesRefetchInterval(currentQuery.state.data?.pages),
    refetchOnMount: (currentQuery) =>
      shouldRefetchDwaionRunPagesOnLifecycle(currentQuery.state.data?.pages),
    refetchOnReconnect: (currentQuery) =>
      shouldRefetchDwaionRunPagesOnLifecycle(currentQuery.state.data?.pages),
    refetchOnWindowFocus: (currentQuery) =>
      shouldRefetchDwaionRunPagesOnLifecycle(currentQuery.state.data?.pages),
    retry: retryDwaionActivity,
    meta: { accessSensitive: true },
  });
  const refreshHeadSeparately = Boolean(query.data?.pages.length);
  const head = useQuery({
    queryKey: [...queryKey, 'head-refresh', refreshHeadSeparately ? 'active' : 'inactive'],
    queryFn: ({ signal }) =>
      getDwaionUserRunPage({
        limit: DWAION_ACTIVITY_PAGE_LIMIT,
        from: periodFrom,
        signal,
      }),
    enabled: enabled && refreshHeadSeparately,
    initialData: () => query.data?.pages[0],
    initialDataUpdatedAt: () => query.dataUpdatedAt,
    staleTime: 15_000,
    refetchInterval: (currentQuery) => dwaionHeadRunPageRefetchInterval(currentQuery.state.data),
    retry: retryDwaionActivity,
    meta: { accessSensitive: true },
  });
  const runningRuns = useMemo(() => {
    const headIds = new Set((head.data?.runs ?? []).map((run) => run.runId.toLowerCase()));
    const seen = new Set<string>();
    const runs: DwaionUserRun[] = [];
    for (const page of query.data?.pages ?? []) {
      for (const run of page.runs) {
        const runId = run.runId.toLowerCase();
        if (
          run.runState !== 'RUNNING' ||
          runId === selectedRunId ||
          headIds.has(runId) ||
          seen.has(runId)
        ) {
          continue;
        }
        seen.add(runId);
        runs.push(run);
      }
    }
    return runs;
  }, [head.data?.runs, query.data?.pages, selectedRunId]);
  const runningDetails = useQueries({
    queries: runningRuns.map((listedRun) => ({
      queryKey: ['dwaion', 'user-run', 'detail', identity, listedRun.runId] as const,
      queryFn: ({ signal }: { signal: AbortSignal }) => getDwaionUserRun(listedRun.runId, signal),
      enabled,
      staleTime: (currentQuery: { state: { data?: DwaionUserRun } }) =>
        dwaionRunDetailStaleTime(currentQuery.state.data ?? listedRun),
      refetchInterval: (currentQuery: { state: { data?: DwaionUserRun; error?: unknown } }) =>
        dwaionKnownRunDetailRefetchInterval(
          currentQuery.state.data,
          listedRun,
          currentQuery.state.error
        ),
      refetchOnWindowFocus: (currentQuery: { state: { data?: DwaionUserRun; error?: unknown } }) =>
        dwaionKnownRunDetailRefetchOnWindowFocus(
          currentQuery.state.data,
          listedRun,
          currentQuery.state.error
        ),
      retry: retryDwaionActivity,
      meta: { accessSensitive: true },
    })),
  });
  const deniedRunningRunIds = runningDetails.flatMap((detail, index) =>
    detail.isError && detail.error instanceof HttpError && detail.error.status === 404
      ? [runningRuns[index]!.runId]
      : []
  );
  const runningRunDetails = runningDetails.flatMap((detail) => {
    const run = usableActivityQueryData(detail);
    return run ? [run] : [];
  });
  const rootDenied =
    [query.error, head.error].some(isAuthoritativeActivityDenial) ||
    runningDetails.some(
      (detail) => detail.isError && isAuthoritativeActivityRootDenial(detail.error)
    );
  const error =
    [query.error, head.error].find(isAuthoritativeActivityDenial) ??
    runningDetails.find(
      (detail) => detail.isError && isAuthoritativeActivityRootDenial(detail.error)
    )?.error ??
    query.error ??
    head.error ??
    runningDetails.find((detail) => detail.isError)?.error;
  return {
    ...query,
    dataUpdatedAt: Math.max(
      query.dataUpdatedAt,
      head.dataUpdatedAt,
      ...runningDetails.map((detail) => detail.dataUpdatedAt)
    ),
    deniedRunningRunIds,
    error,
    headPage: head.data,
    isError: query.isError || head.isError || runningDetails.some((detail) => detail.isError),
    isFetching:
      query.isFetching || head.isFetching || runningDetails.some((detail) => detail.isFetching),
    refetchHead: head.refetch,
    rootDenied,
    runningRunDetails,
  };
}
