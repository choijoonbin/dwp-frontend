import {
  axiosInstance,
  productSurfaceGovernedMutationConfig,
  productSurfaceHighRiskMutationConfig,
} from '@dwp-frontend/shared-utils';
import { productSurfaceReadScopeConfig } from '@dwp-frontend/shared-utils/api/product-surface-read-scope';

import {
  EMPLOYEE_CHANGE_APPLY_ROUTE_CONTRACT,
  EMPLOYEE_CHANGE_CREATE_ROUTE_CONTRACT,
  EMPLOYEE_CHANGE_SUBMIT_ROUTE_CONTRACT,
  EMPLOYEE_CHANGE_WORKBENCH_ROUTE_CONTRACT,
  parseEmployeeChangeCommandReceipt,
  parseEmployeeChangeProjection,
} from '../model/employee-change-contract';

import type { ProductSurfaceGovernedMutationAuthority } from '@dwp-frontend/shared-utils';
import type {
  EmployeeChangeCommandReceipt,
  EmployeeChangeCreateRequest,
  EmployeeChangeProjection,
  EmployeeChangeQuery,
} from '../model/employee-change-contract';

const WORKBENCH_PATH = '/api/people/v1/hris/workbench/operations/employee/change/requests';
const REQUESTS_PATH = '/api/people/v1/hris/employee-change-requests';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export const EMPLOYEE_CHANGE_API_CONTRACTS = [
  {
    apiFunction: 'queryEmployeeChangeWorkbench',
    bindingId: 'IAQ-009',
    routeContractKey: EMPLOYEE_CHANGE_WORKBENCH_ROUTE_CONTRACT,
    method: 'GET',
    path: WORKBENCH_PATH,
  },
  {
    apiFunction: 'createEmployeeChangeRequest',
    bindingId: 'PEP-HRM-003',
    routeContractKey: EMPLOYEE_CHANGE_CREATE_ROUTE_CONTRACT,
    method: 'POST',
    path: REQUESTS_PATH,
  },
  {
    apiFunction: 'submitEmployeeChangeRequest',
    bindingId: 'PEP-HRM-004',
    routeContractKey: EMPLOYEE_CHANGE_SUBMIT_ROUTE_CONTRACT,
    method: 'POST',
    path: `${REQUESTS_PATH}/{requestPublicId}/submit`,
  },
  {
    apiFunction: 'applyEmployeeChangeRequest',
    bindingId: 'PEP-HRM-005',
    routeContractKey: EMPLOYEE_CHANGE_APPLY_ROUTE_CONTRACT,
    method: 'POST',
    path: `${REQUESTS_PATH}/{requestPublicId}/apply`,
  },
] as const;

export type EmployeeChangeCreateCommand = Readonly<{
  request: EmployeeChangeCreateRequest;
  expectedTargetVersion: number;
  idempotencyKey: string;
  correlationId: string;
  purposeCode?: string;
}>;

export type EmployeeChangeLifecycleCommand = Readonly<{
  requestPublicId: string;
  expectedRequestVersion: number;
  idempotencyKey: string;
  correlationId: string;
  purposeCode?: string;
}>;

export type EmployeeChangeDataSource = Readonly<{
  query: (
    request: EmployeeChangeQuery,
    contextScopeKey?: string,
    signal?: AbortSignal
  ) => Promise<EmployeeChangeProjection>;
  create: (
    command: EmployeeChangeCreateCommand,
    authority: ProductSurfaceGovernedMutationAuthority
  ) => Promise<EmployeeChangeCommandReceipt>;
  submit: (
    command: EmployeeChangeLifecycleCommand,
    authority: ProductSurfaceGovernedMutationAuthority
  ) => Promise<EmployeeChangeCommandReceipt>;
  apply: (
    command: EmployeeChangeLifecycleCommand,
    authority: ProductSurfaceGovernedMutationAuthority
  ) => Promise<EmployeeChangeCommandReceipt>;
}>;

function appendMany(params: URLSearchParams, key: string, values?: readonly string[]): void {
  values?.forEach((value) => params.append(key, value));
}

function queryParams(request: EmployeeChangeQuery): URLSearchParams {
  const params = new URLSearchParams({
    limit: String(request.limit),
    locale: request.locale,
    timeZone: request.timeZone,
    correlationId: request.correlationId,
  });
  appendMany(params, 'sort', request.sort);
  if (request.asOf) params.set('asOf', request.asOf);
  if (request.cursor) params.set('cursor', request.cursor);
  const summary = request.filter.changeRequestSummary;
  if (summary?.minimumItemCount !== null && summary?.minimumItemCount !== undefined) {
    params.set('filter[changeRequestSummary][minimumItemCount]', String(summary.minimumItemCount));
  }
  if (summary?.maximumItemCount !== null && summary?.maximumItemCount !== undefined) {
    params.set('filter[changeRequestSummary][maximumItemCount]', String(summary.maximumItemCount));
  }
  const approval = request.filter.approvalStatus;
  appendMany(params, 'filter[approvalStatus][codes]', approval?.codes);
  if (approval?.minimumRevision !== null && approval?.minimumRevision !== undefined) {
    params.set('filter[approvalStatus][minimumRevision]', String(approval.minimumRevision));
  }
  const employment = request.filter.employment;
  if (employment?.activeOn) params.set('filter[employment][activeOn]', employment.activeOn);
  if (employment?.from) params.set('filter[employment][from]', employment.from);
  if (employment?.to) params.set('filter[employment][to]', employment.to);
  if (request.filter.effectiveOn) params.set('filter[effectiveOn]', request.filter.effectiveOn);
  return params;
}

function commandHeaders(
  command: Pick<EmployeeChangeCreateCommand, 'idempotencyKey' | 'correlationId' | 'purposeCode'>,
  expectedVersion: number
): Record<string, string> {
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1) {
    throw new Error('Employee-change optimistic version is invalid.');
  }
  if (!/^[A-Za-z0-9._:-]{16,128}$/u.test(command.idempotencyKey)) {
    throw new Error('Employee-change idempotency key is invalid.');
  }
  if (!UUID.test(command.correlationId)) {
    throw new Error('Employee-change correlation identifier is invalid.');
  }
  return {
    'Idempotency-Key': command.idempotencyKey,
    'If-Match': `"v:${expectedVersion}"`,
    'X-Correlation-ID': command.correlationId,
    ...(command.purposeCode ? { 'X-Purpose-Code': command.purposeCode } : {}),
  };
}

function mutationConfig(
  authority: ProductSurfaceGovernedMutationAuthority,
  command: EmployeeChangeCreateCommand | EmployeeChangeLifecycleCommand,
  expectedVersion: number,
  highRisk: boolean
) {
  if (
    authority.mode === 'SECURE' &&
    ((authority.idempotencyKey !== undefined &&
      authority.idempotencyKey !== command.idempotencyKey) ||
      (highRisk && authority.objectVersion !== expectedVersion))
  ) {
    throw new Error('Employee-change command authority does not match the command.');
  }
  const governed = highRisk
    ? productSurfaceHighRiskMutationConfig(authority, { objectVersionHeader: true })
    : productSurfaceGovernedMutationConfig(authority);
  return {
    ...governed,
    headers: {
      ...governed.headers,
      ...commandHeaders(command, expectedVersion),
    },
    csrfReplay: 'NEVER' as const,
  };
}

export async function queryEmployeeChangeWorkbench(
  request: EmployeeChangeQuery,
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<EmployeeChangeProjection> {
  const response = await axiosInstance.get<unknown>(
    `${WORKBENCH_PATH}?${queryParams(request).toString()}`,
    productSurfaceReadScopeConfig(contextScopeKey, signal)
  );
  return parseEmployeeChangeProjection(response.data);
}

export async function createEmployeeChangeRequest(
  command: EmployeeChangeCreateCommand,
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<EmployeeChangeCommandReceipt> {
  const response = await axiosInstance.post<unknown, EmployeeChangeCreateRequest>(
    REQUESTS_PATH,
    command.request,
    mutationConfig(authority, command, command.expectedTargetVersion, false)
  );
  return parseEmployeeChangeCommandReceipt(response.data);
}

export async function submitEmployeeChangeRequest(
  command: EmployeeChangeLifecycleCommand,
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<EmployeeChangeCommandReceipt> {
  const response = await axiosInstance.post<unknown, Record<string, never>>(
    `${REQUESTS_PATH}/${encodeURIComponent(command.requestPublicId)}/submit`,
    {},
    mutationConfig(authority, command, command.expectedRequestVersion, false)
  );
  return parseEmployeeChangeCommandReceipt(response.data);
}

export async function applyEmployeeChangeRequest(
  command: EmployeeChangeLifecycleCommand,
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<EmployeeChangeCommandReceipt> {
  const response = await axiosInstance.post<unknown, Record<string, never>>(
    `${REQUESTS_PATH}/${encodeURIComponent(command.requestPublicId)}/apply`,
    {},
    mutationConfig(authority, command, command.expectedRequestVersion, true)
  );
  return parseEmployeeChangeCommandReceipt(response.data);
}

export const employeeChangeDataSource: EmployeeChangeDataSource = Object.freeze({
  query: queryEmployeeChangeWorkbench,
  create: createEmployeeChangeRequest,
  submit: submitEmployeeChangeRequest,
  apply: applyEmployeeChangeRequest,
});
