import { axiosInstance } from '@dwp-frontend/shared-utils/axios-instance';

import type { ApiResponse } from '@dwp-frontend/shared-utils';
import type { PayrollFoundationDefinition } from '../model/payroll-foundation-model';

export const PAYROLL_FOUNDATION_API_BASE = '/api/payroll/v1/hris/payroll/foundation' as const;

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
    scope: RequestScope
  ) => Promise<unknown>;
  update: (
    configurationId: string,
    request: PayrollFoundationUpdateRequest,
    commandId: string,
    scope: RequestScope
  ) => Promise<unknown>;
  simulate: (
    configurationId: string,
    request: PayrollFoundationVersionCommand,
    commandId: string,
    scope: RequestScope
  ) => Promise<unknown>;
  publish: (
    configurationId: string,
    request: PayrollFoundationVersionCommand,
    commandId: string,
    scope: RequestScope
  ) => Promise<unknown>;
  reverse: (
    configurationId: string,
    request: PayrollFoundationReversalCommand,
    commandId: string,
    scope: RequestScope
  ) => Promise<unknown>;
  receipt: (commandId: string, scope: RequestScope) => Promise<unknown>;
  reconcile: (commandId: string, scope: RequestScope) => Promise<unknown>;
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

function commandScope(scope: RequestScope, commandId: string) {
  return {
    ...scoped(scope),
    headers: { 'Idempotency-Key': commandId },
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
  scope: RequestScope
): Promise<unknown> {
  const response = await axiosInstance.post<ApiResponse<unknown>, PayrollFoundationCreateRequest>(
    `${PAYROLL_FOUNDATION_API_BASE}/configurations`,
    request,
    commandScope(scope, commandId)
  );
  return response.data.data;
}

export async function updatePayrollFoundation(
  configurationId: string,
  request: PayrollFoundationUpdateRequest,
  commandId: string,
  scope: RequestScope
): Promise<unknown> {
  const response = await axiosInstance.put<ApiResponse<unknown>, PayrollFoundationUpdateRequest>(
    configurationPath(configurationId),
    request,
    commandScope(scope, commandId)
  );
  return response.data.data;
}

async function postVersionCommand(
  operation: 'simulations' | 'publish',
  configurationId: string,
  request: PayrollFoundationVersionCommand,
  commandId: string,
  scope: RequestScope
) {
  const response = await axiosInstance.post<ApiResponse<unknown>, PayrollFoundationVersionCommand>(
    `${configurationPath(configurationId)}/${operation}`,
    request,
    commandScope(scope, commandId)
  );
  return response.data.data;
}

export function simulatePayrollFoundation(
  configurationId: string,
  request: PayrollFoundationVersionCommand,
  commandId: string,
  scope: RequestScope
) {
  return postVersionCommand('simulations', configurationId, request, commandId, scope);
}

export function publishPayrollFoundation(
  configurationId: string,
  request: PayrollFoundationVersionCommand,
  commandId: string,
  scope: RequestScope
) {
  return postVersionCommand('publish', configurationId, request, commandId, scope);
}

export async function reversePayrollFoundation(
  configurationId: string,
  request: PayrollFoundationReversalCommand,
  commandId: string,
  scope: RequestScope
) {
  const response = await axiosInstance.post<ApiResponse<unknown>, PayrollFoundationReversalCommand>(
    `${configurationPath(configurationId)}/reversals`,
    request,
    commandScope(scope, commandId)
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

export async function reconcilePayrollFoundationReceipt(commandId: string, scope: RequestScope) {
  const response = await axiosInstance.post<ApiResponse<unknown>, Record<string, never>>(
    `${PAYROLL_FOUNDATION_API_BASE}/receipts/${encodeURIComponent(commandId)}/reconcile`,
    {},
    { ...scoped(scope), csrfReplay: 'NEVER' }
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
