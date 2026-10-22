import { axiosInstance } from '@dwp-frontend/shared-utils';
import { productSurfaceReadScopeConfig } from '@dwp-frontend/shared-utils/api/product-surface-read-scope';

import {
  HRM012_ADAPTER_KIND,
  HRM012_QUERY_CONTRACT,
  assertHrm012QueryRequest,
  selectHrm012Projection,
} from './data-quality-contract';

import type { Hrm012Projection, Hrm012QueryRequest } from './data-quality-contract';

export const HRM012_API_CONTRACTS = Object.freeze([
  Object.freeze({
    bindingId: HRM012_QUERY_CONTRACT.queryId,
    operationId: HRM012_QUERY_CONTRACT.operationId,
    method: 'GET',
    browserPath: HRM012_QUERY_CONTRACT.browserPath,
    ownerPath: HRM012_QUERY_CONTRACT.ownerPath,
  }),
] as const);

export type Hrm012QueryAdapter = Readonly<{
  kind: typeof HRM012_ADAPTER_KIND;
  query: (
    request: Hrm012QueryRequest,
    contextScopeKey: string,
    signal: AbortSignal
  ) => Promise<Hrm012Projection>;
}>;

function appendNested(params: URLSearchParams, key: string, value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) {
    return value.reduce((appended, entry) => appendNested(params, key, entry) || appended, false);
  }
  if (typeof value === 'object') {
    return Object.entries(value as Readonly<Record<string, unknown>>).reduce(
      (appended, [childKey, childValue]) =>
        appendNested(params, `${key}[${childKey}]`, childValue) || appended,
      false
    );
  }
  params.append(key, String(value));
  return true;
}

export function hrm012QueryString(requestValue: Hrm012QueryRequest): string {
  const request = assertHrm012QueryRequest(requestValue);
  const params = new URLSearchParams({
    limit: String(request.limit),
    locale: request.locale,
    timeZone: request.timeZone,
    correlationId: request.correlationId,
  });
  request.sort.forEach((sort) => params.append('sort', sort));
  if (request.asOf) params.set('asOf', request.asOf);
  if (request.cursor) params.set('cursor', request.cursor);
  const appendedFilter = Object.entries(request.filter).reduce(
    (appended, [key, value]) => appendNested(params, `filter[${key}]`, value) || appended,
    false
  );
  if (!appendedFilter) params.set('filter', '{}');
  return params.toString();
}

export async function queryHrm012Entry(
  request: Hrm012QueryRequest,
  contextScopeKey: string,
  signal: AbortSignal
): Promise<Hrm012Projection> {
  if (!contextScopeKey.trim()) throw new Error('HRM-012 trusted request scope is unavailable.');
  const response = await axiosInstance.get<unknown>(
    `${HRM012_QUERY_CONTRACT.browserPath}?${hrm012QueryString(request)}`,
    productSurfaceReadScopeConfig(contextScopeKey, signal)
  );
  return selectHrm012Projection(response.data);
}

export function createHrm012QueryAdapter(): Hrm012QueryAdapter {
  return Object.freeze({ kind: HRM012_ADAPTER_KIND, query: queryHrm012Entry });
}
