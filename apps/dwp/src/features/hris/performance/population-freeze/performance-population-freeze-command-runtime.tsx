import { useCallback, useMemo } from 'react';

import {
  ProductSurfaceHighRiskCommandDialog,
  productSurfaceHighRiskCommand,
} from '../../../../components/product-surface-high-risk-command';
import { useProductActionMutation } from '../../../../components/use-product-action-mutation';
import { useProductSurfaceHighRiskCommandExecutor } from '../../../../components/use-product-surface-high-risk-command-executor';
import { previewPerformancePopulation } from '../api/performance-cycle-api';
import { selectPerformancePreviewCommandResult } from '../model/performance-cycle-contract';
import { newPerformanceCommandId } from '../model/performance-cycle-command';
import { HrisPerformanceReviewOperationsWorkspace } from './performance-review-operations-workspace';
import { freezePerformancePopulation } from './population-freeze-api';

import type {
  ProductSurfaceHighRiskCommandController,
  ProductSurfaceHighRiskCommandDescriptor,
  ProductSurfaceHighRiskOperation,
} from '../../../../components/product-surface-high-risk-command';
import type { PerformanceReviewOperationsDataSource } from './performance-review-operations-api';
import type {
  FreezePerformancePopulationCommand,
  PerformancePopulationFreezeResult,
} from './population-freeze-contract';
import type { PerformanceReviewOperationsCommandExecutors } from './use-performance-review-operations';

export const PERFORMANCE_POPULATION_PREVIEW_ACTION_CONTRACT =
  'route.hcm.operations.performance-cycle-population-preview.action' as const;
export const PERFORMANCE_POPULATION_FREEZE_HIGH_RISK_OPERATION =
  'HCM_PERFORMANCE_POPULATION_FREEZE' as const;

export type PerformancePopulationFreezeCommandBinding = Readonly<{
  cycleId: string;
  command: FreezePerformancePopulationCommand;
}>;

export type PerformanceReviewOperationsCommandRuntime = Readonly<{
  commandExecutors: PerformanceReviewOperationsCommandExecutors;
  freezeController: ProductSurfaceHighRiskCommandController;
}>;

export function performancePopulationFreezeHighRiskCommand({
  cycleId,
  command,
}: PerformancePopulationFreezeCommandBinding): ProductSurfaceHighRiskCommandDescriptor {
  const { expectedCycleRevision, ...payload } = command;
  return productSurfaceHighRiskCommand({
    operation: PERFORMANCE_POPULATION_FREEZE_HIGH_RISK_OPERATION as ProductSurfaceHighRiskOperation,
    commandMethod: 'POST',
    commandPath: `/api/people/v1/hris/performance/cycles/${encodeURIComponent(
      cycleId
    )}/population-freezes`,
    targetType: 'PERFORMANCE_CYCLE',
    targetId: cycleId,
    expectedObjectVersion: expectedCycleRevision,
    payload,
    idempotencyKey: command.commandId,
    idempotencyPayloadPath: 'ROOT_COMMAND_ID',
  });
}

export function usePerformanceReviewOperationsCommandRuntime(): PerformanceReviewOperationsCommandRuntime {
  const previewAuthority = useProductActionMutation(PERFORMANCE_POPULATION_PREVIEW_ACTION_CONTRACT);
  const freezeAuthority = useProductSurfaceHighRiskCommandExecutor({
    operation: PERFORMANCE_POPULATION_FREEZE_HIGH_RISK_OPERATION as ProductSurfaceHighRiskOperation,
    buildCommand: performancePopulationFreezeHighRiskCommand,
  });

  const previewPopulation = useCallback(
    async (cycleId: string, expectedCycleRevision: number, asOf: string) => {
      const request = {
        commandId: newPerformanceCommandId(),
        expectedRevision: expectedCycleRevision,
        asOf: new Date(asOf).toISOString(),
      };
      const result = selectPerformancePreviewCommandResult(
        await previewAuthority((authority) =>
          previewPerformancePopulation(cycleId, request, authority)
        )
      );
      if (result.receipt.state !== 'SUCCEEDED' || !result.preview) {
        throw new Error('Population preview did not complete successfully.');
      }
      return result.preview;
    },
    [previewAuthority]
  );

  const freezePopulation = useCallback(
    (cycleId: string, command: FreezePerformancePopulationCommand) =>
      freezeAuthority.execute<PerformancePopulationFreezeResult>(
        (authority) => freezePerformancePopulation(cycleId, command, authority),
        { cycleId, command }
      ),
    [freezeAuthority]
  );

  return useMemo(
    () => ({
      commandExecutors: { previewPopulation, freezePopulation },
      freezeController: freezeAuthority.controller,
    }),
    [freezeAuthority.controller, freezePopulation, previewPopulation]
  );
}

export function PerformancePopulationFreezeHighRiskDialog({
  controller,
}: Readonly<{ controller: ProductSurfaceHighRiskCommandController }>) {
  return <ProductSurfaceHighRiskCommandDialog controller={controller} />;
}

export type HrisPerformanceReviewOperationsPopulationFreezeRuntimeProps = Readonly<{
  dataSource?: PerformanceReviewOperationsDataSource;
  focusResourcePublicId?: string | null;
  onFocusResourcePublicIdChange?: (resourcePublicId: string | null) => void;
}>;

/** Production mount: Control imports this owner runtime and supplies no command callbacks. */
export function HrisPerformanceReviewOperationsPopulationFreezeRuntime({
  dataSource,
  focusResourcePublicId,
  onFocusResourcePublicIdChange,
}: HrisPerformanceReviewOperationsPopulationFreezeRuntimeProps) {
  const runtime = usePerformanceReviewOperationsCommandRuntime();
  return (
    <>
      <HrisPerformanceReviewOperationsWorkspace
        dataSource={dataSource}
        commandExecutors={runtime.commandExecutors}
        focusResourcePublicId={focusResourcePublicId}
        onFocusResourcePublicIdChange={onFocusResourcePublicIdChange}
      />
      <PerformancePopulationFreezeHighRiskDialog controller={runtime.freezeController} />
    </>
  );
}

export default HrisPerformanceReviewOperationsPopulationFreezeRuntime;
