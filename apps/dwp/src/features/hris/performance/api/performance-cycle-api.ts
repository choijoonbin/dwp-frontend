import { axiosInstance, productSurfaceGovernedMutationConfig } from '@dwp-frontend/shared-utils';
import { productSurfaceReadScopeConfig } from '@dwp-frontend/shared-utils/api/product-surface-read-scope';

import type {
  ApiResponse,
  ProductSurfaceGovernedMutationAuthority,
} from '@dwp-frontend/shared-utils';
import type {
  CreatePerformanceCycleRequest,
  PreviewPerformancePopulationRequest,
  PublishPerformanceCycleRequest,
  UpdatePerformanceCycleRequest,
  ValidatePerformanceCycleRequest,
} from '../model/performance-cycle-command';

const PERFORMANCE_CYCLE_BASE = '/api/people/v1/hris/performance';

export type PerformanceCycleDataSource = Readonly<{
  readCollection: (contextScopeKey?: string, signal?: AbortSignal) => Promise<unknown>;
  readCycle: (cycleId: string, contextScopeKey?: string, signal?: AbortSignal) => Promise<unknown>;
  readReceipt: (
    receiptId: string,
    contextScopeKey?: string,
    signal?: AbortSignal
  ) => Promise<unknown>;
  createCycle: (
    request: CreatePerformanceCycleRequest,
    authority: ProductSurfaceGovernedMutationAuthority
  ) => Promise<unknown>;
  updateCycle: (
    cycleId: string,
    request: UpdatePerformanceCycleRequest,
    authority: ProductSurfaceGovernedMutationAuthority
  ) => Promise<unknown>;
  validateCycle: (
    cycleId: string,
    request: ValidatePerformanceCycleRequest,
    authority: ProductSurfaceGovernedMutationAuthority
  ) => Promise<unknown>;
  previewPopulation: (
    cycleId: string,
    request: PreviewPerformancePopulationRequest,
    authority: ProductSurfaceGovernedMutationAuthority
  ) => Promise<unknown>;
  publishCycle: (
    cycleId: string,
    request: PublishPerformanceCycleRequest,
    authority: ProductSurfaceGovernedMutationAuthority
  ) => Promise<unknown>;
}>;

function commandConfig(authority: ProductSurfaceGovernedMutationAuthority, commandId: string) {
  const governed = productSurfaceGovernedMutationConfig(authority);
  return {
    ...governed,
    headers: {
      ...governed.headers,
      'Idempotency-Key': commandId,
    },
  };
}

export async function readPerformanceCycleCollection(
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<unknown> {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${PERFORMANCE_CYCLE_BASE}/cycles`,
    productSurfaceReadScopeConfig(contextScopeKey, signal)
  );
  return response.data.data;
}

export async function readPerformanceCycle(
  cycleId: string,
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<unknown> {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${PERFORMANCE_CYCLE_BASE}/cycles/${encodeURIComponent(cycleId)}`,
    productSurfaceReadScopeConfig(contextScopeKey, signal)
  );
  return response.data.data;
}

export async function readPerformanceCommandReceipt(
  receiptId: string,
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<unknown> {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${PERFORMANCE_CYCLE_BASE}/command-receipts/${encodeURIComponent(receiptId)}`,
    productSurfaceReadScopeConfig(contextScopeKey, signal)
  );
  return response.data.data;
}

export async function createPerformanceCycle(
  request: CreatePerformanceCycleRequest,
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<unknown> {
  const response = await axiosInstance.post<ApiResponse<unknown>, CreatePerformanceCycleRequest>(
    `${PERFORMANCE_CYCLE_BASE}/cycles`,
    request,
    commandConfig(authority, request.commandId)
  );
  return response.data.data;
}

export async function updatePerformanceCycle(
  cycleId: string,
  request: UpdatePerformanceCycleRequest,
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<unknown> {
  const response = await axiosInstance.patch<ApiResponse<unknown>, UpdatePerformanceCycleRequest>(
    `${PERFORMANCE_CYCLE_BASE}/cycles/${encodeURIComponent(cycleId)}`,
    request,
    commandConfig(authority, request.commandId)
  );
  return response.data.data;
}

export async function validatePerformanceCycle(
  cycleId: string,
  request: ValidatePerformanceCycleRequest,
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<unknown> {
  const response = await axiosInstance.post<ApiResponse<unknown>, ValidatePerformanceCycleRequest>(
    `${PERFORMANCE_CYCLE_BASE}/cycles/${encodeURIComponent(cycleId)}/validate`,
    request,
    commandConfig(authority, request.commandId)
  );
  return response.data.data;
}

export async function previewPerformancePopulation(
  cycleId: string,
  request: PreviewPerformancePopulationRequest,
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<unknown> {
  const response = await axiosInstance.post<
    ApiResponse<unknown>,
    PreviewPerformancePopulationRequest
  >(
    `${PERFORMANCE_CYCLE_BASE}/cycles/${encodeURIComponent(cycleId)}/population-previews`,
    request,
    commandConfig(authority, request.commandId)
  );
  return response.data.data;
}

export async function publishPerformanceCycle(
  cycleId: string,
  request: PublishPerformanceCycleRequest,
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<unknown> {
  const response = await axiosInstance.post<ApiResponse<unknown>, PublishPerformanceCycleRequest>(
    `${PERFORMANCE_CYCLE_BASE}/cycles/${encodeURIComponent(cycleId)}/publish`,
    request,
    commandConfig(authority, request.commandId)
  );
  return response.data.data;
}

export const performanceCycleDataSource: PerformanceCycleDataSource = {
  readCollection: readPerformanceCycleCollection,
  readCycle: readPerformanceCycle,
  readReceipt: readPerformanceCommandReceipt,
  createCycle: createPerformanceCycle,
  updateCycle: updatePerformanceCycle,
  validateCycle: validatePerformanceCycle,
  previewPopulation: previewPerformancePopulation,
  publishCycle: publishPerformanceCycle,
};
