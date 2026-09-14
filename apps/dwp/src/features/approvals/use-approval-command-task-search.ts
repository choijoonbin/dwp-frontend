import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { searchApprovalTasks } from '@dwp-frontend/shared-utils/api/approval-search-api';

import type { ApprovalQueueFilter } from './approval-command-center-model';
import type { ApprovalSearchFilters } from '@dwp-frontend/shared-utils/api/approval-search-api';

export function approvalTaskSearchFilters(
  queue: ApprovalQueueFilter,
  query: string,
  page: number,
  sort: ApprovalSearchFilters['sort'],
  status: string
): ApprovalSearchFilters {
  return {
    query: query.trim(),
    page,
    size: 25,
    sort,
    status,
    ...(queue === 'URGENT' ? { priority: 'URGENT' as const } : {}),
    ...(queue === 'DUE_TODAY' ? { due: 'TODAY' as const } : {}),
    ...(queue === 'HIGH_RISK' ? { minRiskScore: 70 } : {}),
  };
}

export function hasSameApprovalSearchScope(
  previousKey: readonly unknown[],
  currentKey: readonly unknown[],
  scopeSize: number
) {
  return (
    previousKey.slice(0, 3 + scopeSize).every((value, index) => value === currentKey[index]) &&
    previousKey.length === currentKey.length
  );
}

export function useApprovalCommandTaskSearch({
  queue,
  search,
  page,
  sort,
  status,
  day,
  scope,
  view = 'INBOX',
}: {
  queue: ApprovalQueueFilter;
  search: string;
  page: number;
  sort: ApprovalSearchFilters['sort'];
  status: string;
  day: string;
  view?: 'INBOX' | 'COMPLETED';
  scope: {
    ready: boolean;
    cacheKey: readonly string[];
    contextScopeKey?: string;
    queryMeta: Record<string, unknown>;
  };
}) {
  const [settledSearch, setSettledSearch] = useState(search);
  useEffect(() => {
    const timer = setTimeout(() => setSettledSearch(search), 350);
    return () => clearTimeout(timer);
  }, [search]);
  const pendingSearch = settledSearch !== search;
  const filters = approvalTaskSearchFilters(queue, settledSearch, page, sort, status);
  const queryKey = ['approvals', 'command-tasks', view, ...scope.cacheKey, filters, day] as const;
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => searchApprovalTasks(view, filters, scope.contextScopeKey, signal),
    enabled: scope.ready,
    staleTime: 20_000,
    retry: 1,
    refetchOnReconnect: 'always',
    placeholderData: (previousData, previousQuery) =>
      previousQuery &&
      hasSameApprovalSearchScope(previousQuery.queryKey, queryKey, scope.cacheKey.length)
        ? previousData
        : undefined,
    meta: scope.queryMeta,
  });
  return {
    ...query,
    queryKey,
    data: query.data?.items,
    pageInfo: query.data,
    isFetching: query.isFetching || pendingSearch || query.isPlaceholderData,
  };
}
