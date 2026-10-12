import { axiosInstance, productSurfaceHighRiskMutationConfig } from '@dwp-frontend/shared-utils';

import {
  parsePerformancePopulationFreezeResult,
  type FreezePerformancePopulationCommand,
  type PerformancePopulationFreezeResult,
} from './population-freeze-contract';

import type {
  ApiResponse,
  ProductSurfaceGovernedMutationAuthority,
} from '@dwp-frontend/shared-utils';

const PERFORMANCE_BASE = '/api/people/v1/hris/performance';

export const PERFORMANCE_POPULATION_FREEZE_API_CONTRACT = {
  apiFunction: 'freezePerformancePopulation',
  routeContractKey: 'route.hcm.operations.performance-population-freeze.action',
  method: 'POST',
  path: `${PERFORMANCE_BASE}/cycles/{cycleId}/population-freezes`,
} as const;

type FreezePopulationBody = Omit<FreezePerformancePopulationCommand, 'expectedCycleRevision'>;

export type PerformancePopulationFreezeDataSource = Readonly<{
  freezePopulation: (
    cycleId: string,
    command: FreezePerformancePopulationCommand,
    authority: ProductSurfaceGovernedMutationAuthority
  ) => Promise<PerformancePopulationFreezeResult>;
}>;

function mutationConfig(
  authority: ProductSurfaceGovernedMutationAuthority,
  command: FreezePerformancePopulationCommand
) {
  if (
    authority.mode === 'SECURE' &&
    ((authority.idempotencyKey !== undefined && authority.idempotencyKey !== command.commandId) ||
      (authority.objectVersion !== undefined &&
        authority.objectVersion !== command.expectedCycleRevision))
  ) {
    throw new Error('Population-freeze authority does not match the command.');
  }
  const governed = productSurfaceHighRiskMutationConfig(authority, {
    objectVersionHeader: true,
  });
  return {
    ...governed,
    headers: {
      ...governed.headers,
      'Idempotency-Key': command.commandId,
      'If-Match': String(command.expectedCycleRevision),
    },
  };
}

export async function freezePerformancePopulation(
  cycleId: string,
  command: FreezePerformancePopulationCommand,
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<PerformancePopulationFreezeResult> {
  const { expectedCycleRevision: _expectedCycleRevision, ...body } = command;
  const response = await axiosInstance.post<ApiResponse<unknown>, FreezePopulationBody>(
    `${PERFORMANCE_BASE}/cycles/${encodeURIComponent(cycleId)}/population-freezes`,
    body,
    mutationConfig(authority, command)
  );
  const result = parsePerformancePopulationFreezeResult(response.data.data);
  if (
    result.receipt.receiptId !== command.commandId ||
    result.receipt.aggregateId !== cycleId ||
    result.receipt.expectedAggregateVersion !== command.expectedCycleRevision ||
    (result.freeze !== null &&
      (result.freeze.populationPreviewId !== command.populationPreviewId ||
        result.freeze.populationRuleVersionId !== command.populationRuleId ||
        result.freeze.workforceSnapshotId !== command.workforceSnapshotId ||
        result.freeze.workforceSnapshotRevision !== command.workforceSnapshotRevision ||
        result.freeze.contentHash !== command.previewContentHash))
  ) {
    throw new Error('Population-freeze response does not match the governed command.');
  }
  return result;
}

export const performancePopulationFreezeDataSource: PerformancePopulationFreezeDataSource = {
  freezePopulation: freezePerformancePopulation,
};
