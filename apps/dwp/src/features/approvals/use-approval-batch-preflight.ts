import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { getApprovalTask, HttpError } from '@dwp-frontend/shared-utils';

import { buildApprovalBatchPreflight } from './approval-batch-preflight';

import type { ApprovalTask } from '@dwp-frontend/shared-utils';
import type { useProductSurfaceRequestScope } from '../../components/use-product-surface-request-scope';

type ApprovalWorkRequestScope = ReturnType<typeof useProductSurfaceRequestScope>;

export function useApprovalBatchPreflight({
  selectedTaskIds,
  queueTasks,
  open,
  sourceReady,
  requestScope,
}: {
  selectedTaskIds: readonly string[];
  queueTasks: readonly ApprovalTask[];
  open: boolean;
  sourceReady: boolean;
  requestScope: ApprovalWorkRequestScope;
}) {
  const detailQueries = useQueries({
    queries: selectedTaskIds.map((taskId) => ({
      queryKey: ['approvals', 'command-task', taskId, ...requestScope.cacheKey],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        getApprovalTask(taskId, requestScope.contextScopeKey, signal),
      enabled: open && requestScope.ready && sourceReady,
      staleTime: 0,
      retry: 0,
      meta: requestScope.queryMeta,
    })),
  });
  const preflight = useMemo(
    () =>
      buildApprovalBatchPreflight({
        selectedTaskIds,
        queueTasks,
        inspections: selectedTaskIds.map((taskId, index) => {
          const query = detailQueries[index];
          const error = query?.failureReason ?? query?.error;
          return {
            taskId,
            detail: query?.data,
            state: query?.isFetching
              ? 'LOADING'
              : query?.isSuccess && query.failureCount === 0
                ? 'READY'
                : query?.isError
                  ? 'ERROR'
                  : 'LOADING',
            denied: error instanceof HttpError && [401, 403, 404].includes(error.status),
          };
        }),
      }),
    [detailQueries, queueTasks, selectedTaskIds]
  );

  return {
    preflight,
    refreshing: detailQueries.some((query) => query.isFetching),
    refetch: () => Promise.all(detailQueries.map((query) => query.refetch())),
  };
}
