import { axiosInstance, productSurfaceHighRiskMutationConfig } from '@dwp-frontend/shared-utils';
import { productSurfaceReadScopeConfig } from '@dwp-frontend/shared-utils/api/product-surface-read-scope';

import { parseHrisCommandReceipt } from '../command-receipts/model/command-receipt';
import {
  HRM011_ISSUE_ROUTE_CONTRACT,
  HRM011_QUERY_CONTRACT,
  assertHrm011EmploymentContractRequest,
  assertHrm011QueryRequest,
  selectHrm011Projection,
} from './contracts-compensation-basis-contract';

import type { ProductSurfaceGovernedMutationAuthority } from '@dwp-frontend/shared-utils';
import type { HrisCommandReceipt } from '../command-receipts/model/command-receipt';
import type {
  HRM011_ADAPTER_KIND,
  Hrm011IssueCommand,
  Hrm011Projection,
  Hrm011QueryRequest,
} from './contracts-compensation-basis-contract';

const CORRELATION_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const ISSUE_PATH = '/api/people/v1/hris/employment-contracts';

export const HRM011_API_CONTRACTS = Object.freeze([
  Object.freeze({
    bindingId: HRM011_QUERY_CONTRACT.queryId,
    operationId: HRM011_QUERY_CONTRACT.operationId,
    method: 'GET',
    browserPath: HRM011_QUERY_CONTRACT.browserPath,
    ownerPath: HRM011_QUERY_CONTRACT.ownerPath,
  }),
  Object.freeze({
    bindingId: 'PEP-HRM-011',
    operationId: 'issueEmploymentContract',
    routeContractKey: HRM011_ISSUE_ROUTE_CONTRACT,
    method: 'POST',
    browserPath: ISSUE_PATH,
    ownerPath: '/v1/hris/employment-contracts',
    successStatus: 202,
    requiredHeaders: Object.freeze([
      'Authorization',
      'Idempotency-Key',
      'If-Match',
      'X-Correlation-ID',
      'X-DWP-Expected-Object-Version',
    ]),
    optionalHeader: 'X-Purpose-Code',
    requestFields: Object.freeze([
      'relationshipPublicId',
      'templatePublicId',
      'templateVersion',
      'locale',
      'effectiveFrom',
      'effectiveTo',
      'snapshotDigest',
    ]),
    response: 'CommandReceiptV1',
  }),
] as const);

export type Hrm011QueryAdapter = Readonly<{
  kind: typeof HRM011_ADAPTER_KIND;
  query: (
    request: Hrm011QueryRequest,
    contextScopeKey: string,
    signal: AbortSignal
  ) => Promise<Hrm011Projection>;
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

export function hrm011QueryString(requestValue: Hrm011QueryRequest): string {
  const request = assertHrm011QueryRequest(requestValue);
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

export async function queryHrm011Entry(
  request: Hrm011QueryRequest,
  contextScopeKey: string,
  signal: AbortSignal
): Promise<Hrm011Projection> {
  if (!contextScopeKey.trim()) throw new Error('HRM-011 trusted request scope is unavailable.');
  const response = await axiosInstance.get<unknown>(
    `${HRM011_QUERY_CONTRACT.browserPath}?${hrm011QueryString(request)}`,
    productSurfaceReadScopeConfig(contextScopeKey, signal)
  );
  return selectHrm011Projection(response.data);
}

function commandHeaders(command: Hrm011IssueCommand): Record<string, string> {
  if (!Number.isSafeInteger(command.expectedObjectVersion) || command.expectedObjectVersion < 0) {
    throw new Error('Employment-contract optimistic version is invalid.');
  }
  const idempotencyLength =
    typeof command.idempotencyKey === 'string' ? [...command.idempotencyKey].length : 0;
  if (idempotencyLength < 16 || idempotencyLength > 128) {
    throw new Error('Employment-contract idempotency key is invalid.');
  }
  if (!CORRELATION_ID.test(command.correlationId)) {
    throw new Error('Employment-contract correlation identifier is invalid.');
  }
  return {
    'Idempotency-Key': command.idempotencyKey,
    'If-Match': `"${command.expectedObjectVersion}"`,
    'X-Correlation-ID': command.correlationId,
  };
}

export async function issueEmploymentContract(
  command: Hrm011IssueCommand,
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<HrisCommandReceipt> {
  const request = assertHrm011EmploymentContractRequest(command.request);
  if (
    authority.mode !== 'SECURE' ||
    !authority.stepUp ||
    authority.idempotencyKey !== command.idempotencyKey ||
    authority.objectVersion !== command.expectedObjectVersion
  ) {
    throw new Error('Employment-contract HIGH-risk authority does not match the command.');
  }
  const governed = productSurfaceHighRiskMutationConfig(authority, {
    objectVersionHeader: true,
  });
  const response = await axiosInstance.post<unknown, typeof request>(ISSUE_PATH, request, {
    ...governed,
    headers: { ...governed.headers, ...commandHeaders(command) },
    csrfReplay: 'NEVER',
  });
  if ((response as Readonly<{ status?: unknown }>).status !== 202) {
    throw new Error('Employment-contract command did not return the required 202 status.');
  }
  const receipt = parseHrisCommandReceipt(response.data);
  if (receipt.correlationId !== command.correlationId || receipt.purposeCode !== 'HR_LIFECYCLE') {
    throw new Error('Employment-contract receipt does not match the submitted command.');
  }
  return receipt;
}
