import { axiosInstance } from '@dwp-frontend/shared-utils';
import { productSurfaceReadScopeConfig } from '@dwp-frontend/shared-utils/api/product-surface-read-scope';

import {
  HRM007_ADAPTER_KIND,
  HRM007_QUERY_CONTRACTS,
  assertHrm007QueryRequest,
  selectHrm007Projection,
} from './hrm-007-contract';

import type { Hrm007Projection, Hrm007QueryId, Hrm007QueryRequest } from './hrm-007-contract';

export const HRM007_ENTRY_QUERY_API_CONTRACTS = Object.freeze([
  Object.freeze({
    bindingId: 'IAQ-005',
    operationId: 'IAQ.OP.005',
    method: 'GET',
    path: HRM007_QUERY_CONTRACTS['IAQ-005'].path,
  }),
  Object.freeze({
    bindingId: 'IAQ-007',
    operationId: 'IAQ.OP.007',
    method: 'GET',
    path: HRM007_QUERY_CONTRACTS['IAQ-007'].path,
  }),
  Object.freeze({
    bindingId: 'IAQ-013',
    operationId: 'IAQ.OP.013',
    method: 'GET',
    path: HRM007_QUERY_CONTRACTS['IAQ-013'].path,
  }),
] as const);

export type Hrm007QueryAdapter = Readonly<{
  kind: typeof HRM007_ADAPTER_KIND;
  query: (
    queryId: Hrm007QueryId,
    request: Hrm007QueryRequest,
    contextScopeKey: string,
    signal: AbortSignal
  ) => Promise<Hrm007Projection>;
}>;

function appendNested(params: URLSearchParams, key: string, value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) {
    let appended = false;
    value.forEach((entry) => {
      appended = appendNested(params, key, entry) || appended;
    });
    return appended;
  }
  if (typeof value === 'object') {
    let appended = false;
    Object.entries(value as Record<string, unknown>).forEach(([childKey, childValue]) => {
      appended = appendNested(params, `${key}[${childKey}]`, childValue) || appended;
    });
    return appended;
  }
  params.append(key, String(value));
  return true;
}

export function hrm007QueryString(
  queryId: Hrm007QueryId,
  requestValue: Hrm007QueryRequest
): string {
  const request = assertHrm007QueryRequest(queryId, requestValue);
  const params = new URLSearchParams({
    limit: String(request.limit),
    locale: request.locale,
    timeZone: request.timeZone,
    correlationId: request.correlationId,
  });
  request.sort.forEach((sort) => params.append('sort', sort));
  if (request.asOf) params.set('asOf', request.asOf);
  if (request.cursor) params.set('cursor', request.cursor);
  let appendedFilter = false;
  Object.entries(request.filter).forEach(([key, value]) => {
    appendedFilter = appendNested(params, `filter[${key}]`, value) || appendedFilter;
  });
  if (!appendedFilter) params.set('filter', '{}');
  return params.toString();
}

export async function queryHrm007Entry(
  queryId: Hrm007QueryId,
  request: Hrm007QueryRequest,
  contextScopeKey: string,
  signal: AbortSignal
): Promise<Hrm007Projection> {
  if (!contextScopeKey.trim()) throw new Error('HRM-007 trusted request scope is unavailable.');
  const response = await axiosInstance.get<unknown>(
    `${HRM007_QUERY_CONTRACTS[queryId].path}?${hrm007QueryString(queryId, request)}`,
    productSurfaceReadScopeConfig(contextScopeKey, signal)
  );
  return selectHrm007Projection(queryId, response.data);
}

export function createHrm007QueryAdapter(): Hrm007QueryAdapter {
  return Object.freeze({
    kind: HRM007_ADAPTER_KIND,
    query: queryHrm007Entry,
  });
}
