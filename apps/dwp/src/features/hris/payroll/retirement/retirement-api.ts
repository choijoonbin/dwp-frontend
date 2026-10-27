import { axiosInstance } from '@dwp-frontend/shared-utils';
import { productSurfaceReadScopeConfig } from '@dwp-frontend/shared-utils/api/product-surface-read-scope';

import {
  PAY004_DATA_ROUTE_CONTRACT_KEY,
  PAY004_QUERY_CONTRACT,
  assertPay004QueryRequest,
  selectPay004Projection,
} from './retirement-contract';

import type {
  PAY004_ADAPTER_KIND,
  Pay004Projection,
  Pay004QueryRequest,
} from './retirement-contract';

export const PAY004_API_CONTRACTS = Object.freeze([
  Object.freeze({
    bindingId: PAY004_QUERY_CONTRACT.queryId,
    operationId: PAY004_QUERY_CONTRACT.operationId,
    method: 'GET',
    browserPath: PAY004_QUERY_CONTRACT.browserPath,
    ownerPath: PAY004_QUERY_CONTRACT.ownerPath,
  }),
] as const);

export type Pay004QueryAdapter = Readonly<{
  kind: typeof PAY004_ADAPTER_KIND;
  query: (
    request: Pay004QueryRequest,
    contextScopeKey: string,
    signal: AbortSignal
  ) => Promise<Pay004Projection>;
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

export function pay004QueryString(requestValue: Pay004QueryRequest): string {
  const request = assertPay004QueryRequest(requestValue);
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

export async function queryPay004Entry(
  requestValue: Pay004QueryRequest,
  contextScopeKey: string,
  signal: AbortSignal
): Promise<Pay004Projection> {
  if (!contextScopeKey.trim()) throw new Error('PAY-004 trusted request scope is unavailable.');
  const request = assertPay004QueryRequest(requestValue);
  const response = await axiosInstance.get<unknown>(
    `${PAY004_QUERY_CONTRACT.browserPath}?${pay004QueryString(request)}`,
    {
      ...productSurfaceReadScopeConfig(contextScopeKey, signal),
      headers: {
        'X-Correlation-ID': request.correlationId,
        'X-DWP-Route-Contract-Key': PAY004_DATA_ROUTE_CONTRACT_KEY,
      },
    }
  );
  return selectPay004Projection(response.data);
}
