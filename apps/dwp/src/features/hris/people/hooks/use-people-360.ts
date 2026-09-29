import { useMemo } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { resolveHcmQueryFailure } from '../../../../components/hcm-query-state-model';
import { people360DataSource } from '../api/people-360-api';
import {
  PEOPLE_360_PAGE_SIZE,
  people360DetailQueryKey,
  people360ListQueryKey,
} from '../model/people-360-model';
import { selectPeople360Detail, selectPeople360Page } from '../model/people-360-view-model';

import type { People360Filters } from '../model/people-360-model';
import type {
  People360DataSource,
  People360DetailPresentation,
  People360RequestScope,
} from '../model/people-360-view-model';

function invalidatesCachedProjection(error: unknown) {
  const failure = resolveHcmQueryFailure(error);
  return (
    failure?.kind === 'permission' ||
    failure?.kind === 'not-found' ||
    failure?.kind === 'context-changed'
  );
}

export function usePeople360List({
  filters,
  deferredQuery,
  requestScope,
  dataSource = people360DataSource,
}: Readonly<{
  filters: People360Filters;
  deferredQuery: string;
  requestScope: People360RequestScope;
  dataSource?: People360DataSource;
}>) {
  const queryFilters = { ...filters, query: deferredQuery };
  const people = useInfiniteQuery({
    queryKey: people360ListQueryKey(queryFilters, requestScope),
    queryFn: async ({ pageParam, signal }) =>
      selectPeople360Page(
        await dataSource.list({
          projection: 'people360',
          asOf: filters.asOf,
          query: deferredQuery || undefined,
          status: filters.status === 'ALL' ? undefined : filters.status,
          cursor: typeof pageParam === 'string' ? pageParam : undefined,
          size: PEOPLE_360_PAGE_SIZE,
          contextScopeKey: requestScope.contextScopeKey,
          signal,
        }),
        filters.asOf
      ),
    enabled: requestScope.ready,
    meta: requestScope.queryMeta,
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : null),
    staleTime: 30_000,
  });
  const loadedRows = useMemo(
    () => (people.data?.pages ?? []).flatMap((page) => page.items),
    [people.data]
  );
  const accessInvalidated = people.isError && invalidatesCachedProjection(people.error);
  const refreshError =
    people.data && people.isError && !accessInvalidated ? people.error : undefined;
  return { people, loadedRows, accessInvalidated, refreshError } as const;
}

export function usePeople360Detail({
  personId,
  asOf,
  requestScope,
  dataSource = people360DataSource,
}: Readonly<{
  personId: string | null;
  asOf: string;
  requestScope: People360RequestScope;
  dataSource?: People360DataSource;
}>): People360DetailPresentation {
  const detail = useQuery({
    queryKey: people360DetailQueryKey(personId, asOf, requestScope),
    queryFn: async ({ signal }) =>
      selectPeople360Detail(
        await dataSource.detail(
          personId ?? '',
          asOf,
          'people360',
          requestScope.contextScopeKey,
          signal
        ),
        personId ?? '',
        asOf
      ),
    enabled: Boolean(personId) && requestScope.ready,
    meta: requestScope.queryMeta,
    staleTime: 30_000,
  });
  const cachedProjectionInvalid = detail.isError && invalidatesCachedProjection(detail.error);
  const blockingError =
    detail.error && (!detail.data || cachedProjectionInvalid) ? detail.error : undefined;
  const refreshError =
    detail.data && detail.error && !cachedProjectionInvalid ? detail.error : undefined;
  return {
    loading: detail.isLoading,
    refreshing: detail.isFetching,
    stale: Boolean(refreshError),
    blockingError,
    refreshError,
    profile: blockingError ? undefined : detail.data,
    retry: () => void detail.refetch(),
  };
}
