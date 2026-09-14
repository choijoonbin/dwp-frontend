import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { searchApprovalRequests } from '@dwp-frontend/shared-utils';

import { APPROVAL_REQUEST_VIEW } from './approval-request-model';

import type { ApprovalSearchFilters } from '@dwp-frontend/shared-utils';
import type { ApprovalRequestView } from './approval-request-model';
import type { useProductSurfaceRequestScope } from '../../components/use-product-surface-request-scope';

export function useApprovalRequestSearch(
  view: ApprovalRequestView,
  scope: ReturnType<typeof useProductSurfaceRequestScope>
) {
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState<ApprovalSearchFilters['priority']>();
  const [sort, setSort] = useState<'NEWEST' | 'OLDEST'>('NEWEST');
  const [page, setPage] = useState(0);
  const identity = JSON.stringify([scope.cacheKey, view]);
  const reset = () => {
    setText('');
    setQuery('');
    setStatus('');
    setPriority(undefined);
    setSort('NEWEST');
    setPage(0);
  };
  useEffect(reset, [identity]);
  useEffect(() => {
    if (text.trim() === query) return;
    const timer = setTimeout(() => {
      setQuery(text.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [text, query]);
  const filters = useMemo(
    () => ({ query, status, priority, sort, page, size: 20 }),
    [query, status, priority, sort, page]
  );
  const queryKey = [
    'approvals',
    ...scope.cacheKey,
    'requests',
    'search',
    APPROVAL_REQUEST_VIEW[view],
    filters,
  ];
  const result = useQuery({
    queryKey,
    queryFn: ({ signal }) =>
      searchApprovalRequests(APPROVAL_REQUEST_VIEW[view], filters, scope.contextScopeKey, signal),
    enabled: scope.ready,
    meta: scope.queryMeta,
    retry: false,
    staleTime: 0,
    refetchInterval: 60_000,
  });
  return {
    queryKey,
    text,
    setText,
    status,
    setStatus: (value: string) => {
      setStatus(value);
      setPage(0);
    },
    priority,
    setPriority: (value: ApprovalSearchFilters['priority']) => {
      setPriority(value);
      setPage(0);
    },
    sort,
    setSort: (value: 'NEWEST' | 'OLDEST') => {
      setSort(value);
      setPage(0);
    },
    page,
    setPage,
    reset,
    filtered: Boolean(text.trim() || status || priority),
    result,
    requests: {
      ...result,
      data: scope.ready && !result.isError && !result.isFetching ? result.data?.items : undefined,
      isFetching: result.isFetching || text.trim() !== query,
      refetch: async () => {
        const refreshed = await result.refetch();
        return { ...refreshed, data: refreshed.data?.items };
      },
    },
  };
}
