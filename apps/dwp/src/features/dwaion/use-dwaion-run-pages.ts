import { useInfiniteQuery } from '@tanstack/react-query';
import { getDwaionUserRunPage } from '@dwp-frontend/shared-utils';

import { DWAION_ACTIVITY_PAGE_LIMIT } from './dwaion-activity-model';

import type { DwaionActivityPeriod } from './dwaion-activity-model';

export const DWAION_ACTIVITY_REFRESH_INTERVAL_MS = 60_000;

export function useDwaionRunPages({
  identity,
  period,
  periodFrom,
  enabled,
}: {
  identity: string;
  period: DwaionActivityPeriod;
  periodFrom: string;
  enabled: boolean;
}) {
  return useInfiniteQuery({
    queryKey: [
      'dwaion',
      'user-runs',
      'period-pages',
      identity,
      period,
      periodFrom,
      DWAION_ACTIVITY_PAGE_LIMIT,
    ],
    queryFn: ({ pageParam, signal }) =>
      getDwaionUserRunPage({
        limit: DWAION_ACTIVITY_PAGE_LIMIT,
        from: periodFrom,
        cursor: pageParam ?? undefined,
        signal,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => (page.hasMore ? (page.nextCursor ?? undefined) : undefined),
    enabled,
    staleTime: 15_000,
    refetchInterval: DWAION_ACTIVITY_REFRESH_INTERVAL_MS,
    retry: 1,
    meta: { accessSensitive: true },
  });
}
