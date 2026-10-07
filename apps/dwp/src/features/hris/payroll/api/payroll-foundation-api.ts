import {
  productSurfaceGovernedMutationConfig,
  productSurfaceHighRiskMutationConfig,
} from '@dwp-frontend/shared-utils';
import { axiosInstance } from '@dwp-frontend/shared-utils/axios-instance';

import type {
  ApiResponse,
  ProductSurfaceGovernedMutationAuthority,
} from '@dwp-frontend/shared-utils';
import type { PayrollFoundationDefinition } from '../model/payroll-foundation-model';

export const PAYROLL_FOUNDATION_API_BASE = '/api/payroll/v1/hris/payroll/foundation' as const;

export const PAYROLL_FOUNDATION_MUTATION_API_CONTRACTS = [
  {
    apiFunction: 'createPayrollFoundation',
    routeContractKey: 'route.hcm.operations.payroll-foundation-create.action',
    method: 'POST',
    path: `${PAYROLL_FOUNDATION_API_BASE}/configurations`,
  },
  {
    apiFunction: 'updatePayrollFoundation',
    routeContractKey: 'route.hcm.operations.payroll-foundation-update.action',
    method: 'PUT',
    path: `${PAYROLL_FOUNDATION_API_BASE}/configurations/{configurationId}`,
  },
  {
    apiFunction: 'simulatePayrollFoundation',
    routeContractKey: 'route.hcm.operations.payroll-foundation-simulate.action',
    method: 'POST',
    path: `${PAYROLL_FOUNDATION_API_BASE}/configurations/{configurationId}/simulations`,
  },
  {
    apiFunction: 'publishPayrollFoundation',
    routeContractKey: 'route.hcm.operations.payroll-foundation-publish.action',
    method: 'POST',
    path: `${PAYROLL_FOUNDATION_API_BASE}/configurations/{configurationId}/publish`,
  },
  {
    apiFunction: 'reversePayrollFoundation',
    routeContractKey: 'route.hcm.operations.payroll-foundation-reverse.action',
    method: 'POST',
    path: `${PAYROLL_FOUNDATION_API_BASE}/configurations/{configurationId}/reversals`,
  },
  {
    apiFunction: 'reconcilePayrollFoundationReceipt',
    routeContractKey: 'route.hcm.operations.payroll-foundation-reconcile.action',
    method: 'POST',
    path: `${PAYROLL_FOUNDATION_API_BASE}/receipts/{commandId}/reconcile`,
  },
] as const;

type RequestScope = Readonly<{
  contextScopeKey?: string;
  signal?: AbortSignal;
  beforeDispatch?: () => void;
}>;

export type PayrollFoundationCreateRequest = Readonly<{
  definition: PayrollFoundationDefinition;
}>;

export type PayrollFoundationUpdateRequest = Readonly<{
  expectedVersion: number;
  definition: PayrollFoundationDefinition;
}>;

export type PayrollFoundationVersionCommand = Readonly<{
  expectedVersion: number;
}>;

export type PayrollFoundationReversalCommand = Readonly<{
  expectedVersion: number;
  publishCommandId: string;
}>;

export type PayrollFoundationDataSource = Readonly<{
  list: (scope: RequestScope) => Promise<unknown>;
  get: (configurationId: string, scope: RequestScope) => Promise<unknown>;
  versions: (configurationId: string, scope: RequestScope) => Promise<unknown>;
  create: (
    request: PayrollFoundationCreateRequest,
    commandId: string,
    scope: RequestScope,
    authority: ProductSurfaceGovernedMutationAuthority
  ) => Promise<unknown>;
  update: (
    configurationId: string,
    request: PayrollFoundationUpdateRequest,
    commandId: string,
    scope: RequestScope,
    authority: ProductSurfaceGovernedMutationAuthority
  ) => Promise<unknown>;
  simulate: (
    configurationId: string,
    request: PayrollFoundationVersionCommand,
    commandId: string,
    scope: RequestScope,
    authority: ProductSurfaceGovernedMutationAuthority
  ) => Promise<unknown>;
  publish: (
    configurationId: string,
    request: PayrollFoundationVersionCommand,
    commandId: string,
    scope: RequestScope,
    authority: ProductSurfaceGovernedMutationAuthority
  ) => Promise<unknown>;
  reverse: (
    configurationId: string,
    request: PayrollFoundationReversalCommand,
    commandId: string,
    scope: RequestScope,
    authority: ProductSurfaceGovernedMutationAuthority
  ) => Promise<unknown>;
  receipt: (commandId: string, scope: RequestScope) => Promise<unknown>;
  reconcile: (
    commandId: string,
    scope: RequestScope,
    authority: ProductSurfaceGovernedMutationAuthority
  ) => Promise<unknown>;
}>;

function configurationPath(configurationId: string) {
  return `${PAYROLL_FOUNDATION_API_BASE}/configurations/${encodeURIComponent(configurationId)}`;
}

function scoped(scope: RequestScope) {
  return {
    ...(scope.contextScopeKey ? { contextScopeKey: scope.contextScopeKey } : {}),
    ...(scope.signal ? { signal: scope.signal } : {}),
    ...(scope.beforeDispatch ? { beforeDispatch: scope.beforeDispatch } : {}),
  };
}

function commandScope(
  scope: RequestScope,
  commandId: string,
  authority: ProductSurfaceGovernedMutationAuthority,
  highRisk = false,
  expectedVersion?: number
) {
  if (
    highRisk &&
    authority.mode === 'SECURE' &&
    (authority.idempotencyKey !== commandId || authority.objectVersion !== expectedVersion)
  ) {
    throw new Error('Payroll command authority does not match the command.');
  }
  const governed = highRisk
    ? productSurfaceHighRiskMutationConfig(authority, { objectVersionHeader: false })
    : productSurfaceGovernedMutationConfig(authority);
  return {
    ...scoped(scope),
    ...governed,
    headers: { ...governed.headers, 'Idempotency-Key': commandId },
    // An uncertain mutation must never be replayed by the transport with a newly fetched CSRF token.
    csrfReplay: 'NEVER' as const,
  };
}

export async function listPayrollFoundations(scope: RequestScope): Promise<unknown> {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${PAYROLL_FOUNDATION_API_BASE}/configurations`,
    scoped(scope)
  );
  return response.data.data;
}

export async function getPayrollFoundation(
  configurationId: string,
  scope: RequestScope
): Promise<unknown> {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    configurationPath(configurationId),
    scoped(scope)
  );
  return response.data.data;
}

export async function listPayrollFoundationVersions(
  configurationId: string,
  scope: RequestScope
): Promise<unknown> {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${configurationPath(configurationId)}/versions`,
    scoped(scope)
  );
  return response.data.data;
}

export async function createPayrollFoundation(
  request: PayrollFoundationCreateRequest,
  commandId: string,
  scope: RequestScope,
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<unknown> {
  const response = await axiosInstance.post<ApiResponse<unknown>, PayrollFoundationCreateRequest>(
    `${PAYROLL_FOUNDATION_API_BASE}/configurations`,
    request,
    commandScope(scope, commandId, authority)
  );
  return response.data.data;
}

export async function updatePayrollFoundation(
  configurationId: string,
  request: PayrollFoundationUpdateRequest,
  commandId: string,
  scope: RequestScope,
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<unknown> {
  const response = await axiosInstance.put<ApiResponse<unknown>, PayrollFoundationUpdateRequest>(
    configurationPath(configurationId),
    request,
    commandScope(scope, commandId, authority)
  );
  return response.data.data;
}

async function postVersionCommand(
  operation: 'simulations' | 'publish',
  configurationId: string,
  request: PayrollFoundationVersionCommand,
  commandId: string,
  scope: RequestScope,
  authority: ProductSurfaceGovernedMutationAuthority,
  highRisk = false,
  expectedVersion?: number
) {
  const response = await axiosInstance.post<ApiResponse<unknown>, PayrollFoundationVersionCommand>(
    `${configurationPath(configurationId)}/${operation}`,
    request,
    commandScope(scope, commandId, authority, highRisk, expectedVersion)
  );
  return response.data.data;
}

export function simulatePayrollFoundation(
  configurationId: string,
  request: PayrollFoundationVersionCommand,
  commandId: string,
  scope: RequestScope,
  authority: ProductSurfaceGovernedMutationAuthority
) {
  return postVersionCommand('simulations', configurationId, request, commandId, scope, authority);
}

export function publishPayrollFoundation(
  configurationId: string,
  request: PayrollFoundationVersionCommand,
  commandId: string,
  scope: RequestScope,
  authority: ProductSurfaceGovernedMutationAuthority
) {
  return postVersionCommand(
    'publish',
    configurationId,
    request,
    commandId,
    scope,
    authority,
    true,
    request.expectedVersion
  );
}

export async function reversePayrollFoundation(
  configurationId: string,
  request: PayrollFoundationReversalCommand,
  commandId: string,
  scope: RequestScope,
  authority: ProductSurfaceGovernedMutationAuthority
) {
  const response = await axiosInstance.post<ApiResponse<unknown>, PayrollFoundationReversalCommand>(
    `${configurationPath(configurationId)}/reversals`,
    request,
    commandScope(scope, commandId, authority, true, request.expectedVersion)
  );
  return response.data.data;
}

export async function getPayrollFoundationReceipt(commandId: string, scope: RequestScope) {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${PAYROLL_FOUNDATION_API_BASE}/receipts/${encodeURIComponent(commandId)}`,
    scoped(scope)
  );
  return response.data.data;
}

export async function reconcilePayrollFoundationReceipt(
  commandId: string,
  scope: RequestScope,
  authority: ProductSurfaceGovernedMutationAuthority
) {
  const governed = productSurfaceGovernedMutationConfig(authority);
  const response = await axiosInstance.post<ApiResponse<unknown>, Record<string, never>>(
    `${PAYROLL_FOUNDATION_API_BASE}/receipts/${encodeURIComponent(commandId)}/reconcile`,
    {},
    {
      ...scoped(scope),
      ...governed,
      headers: governed.headers,
      csrfReplay: 'NEVER',
    }
  );
  return response.data.data;
}

export const payrollFoundationDataSource: PayrollFoundationDataSource = Object.freeze({
  list: listPayrollFoundations,
  get: getPayrollFoundation,
  versions: listPayrollFoundationVersions,
  create: createPayrollFoundation,
  update: updatePayrollFoundation,
  simulate: simulatePayrollFoundation,
  publish: publishPayrollFoundation,
  reverse: reversePayrollFoundation,
  receipt: getPayrollFoundationReceipt,
  reconcile: reconcilePayrollFoundationReceipt,
});
