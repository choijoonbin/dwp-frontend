import { axiosInstance } from '@dwp-frontend/shared-utils';
import { productSurfaceReadScopeConfig } from '@dwp-frontend/shared-utils/api/product-surface-read-scope';

import { parsePerformanceReviewOperationsProjection } from './performance-review-operations-contract';

import type { ApiResponse } from '@dwp-frontend/shared-utils';
import type {
  PerformanceReviewOperationsProjection,
  PerformanceReviewOperationsQuery,
} from './performance-review-operations-contract';

const REVIEW_OPERATIONS_PATH =
  '/api/people/v1/hris/performance/workbench/review-operations' as const;

export const PERFORMANCE_REVIEW_OPERATIONS_API_CONTRACT = {
  apiFunction: 'queryPerformanceReviewOperations',
  routeContractKey: 'route.hcm.operations.performance-review-operations.page',
  method: 'GET',
  path: REVIEW_OPERATIONS_PATH,
} as const;

export type PerformanceReviewOperationsDataSource = Readonly<{
  query: (
    request: PerformanceReviewOperationsQuery,
    contextScopeKey?: string,
    signal?: AbortSignal
  ) => Promise<PerformanceReviewOperationsProjection>;
}>;

function appendMany(params: URLSearchParams, key: string, values?: readonly string[]): void {
  values?.forEach((value) => params.append(key, value));
}

function queryParams(request: PerformanceReviewOperationsQuery): URLSearchParams {
  const params = new URLSearchParams({
    limit: String(request.limit),
    locale: request.locale,
    timeZone: request.timeZone,
    correlationId: request.correlationId,
  });
  appendMany(params, 'sort', request.sort);
  if (request.asOf) params.set('asOf', request.asOf);
  if (request.cursor) params.set('cursor', request.cursor);
  appendMany(params, 'reviewAssignmentCodes', request.filter.reviewAssignment?.codes);
  appendMany(params, 'reviewAssignmentPublicIds', request.filter.reviewAssignment?.publicIds);
  appendMany(params, 'slaStates', request.filter.workQueue?.slaStates);
  appendMany(params, 'dueStatusCodes', request.filter.dueStatus?.codes);
  const minimumOpenCount = request.filter.workQueue?.minimumOpenCount;
  const maximumOpenCount = request.filter.workQueue?.maximumOpenCount;
  const minimumDueRevision = request.filter.dueStatus?.minimumRevision;
  if (minimumOpenCount !== null && minimumOpenCount !== undefined) {
    params.set('minimumOpenCount', String(minimumOpenCount));
  }
  if (maximumOpenCount !== null && maximumOpenCount !== undefined) {
    params.set('maximumOpenCount', String(maximumOpenCount));
  }
  if (minimumDueRevision !== null && minimumDueRevision !== undefined) {
    params.set('minimumDueRevision', String(minimumDueRevision));
  }
  if (request.filter.effectiveOn) params.set('effectiveOn', request.filter.effectiveOn);
  return params;
}

export async function queryPerformanceReviewOperations(
  request: PerformanceReviewOperationsQuery,
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<PerformanceReviewOperationsProjection> {
  const query = queryParams(request).toString();
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${REVIEW_OPERATIONS_PATH}?${query}`,
    productSurfaceReadScopeConfig(contextScopeKey, signal)
  );
  return parsePerformanceReviewOperationsProjection(response.data.data);
}

export const performanceReviewOperationsDataSource: PerformanceReviewOperationsDataSource = {
  query: queryPerformanceReviewOperations,
};
