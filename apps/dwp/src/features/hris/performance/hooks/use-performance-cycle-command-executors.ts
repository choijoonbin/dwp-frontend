import { useMemo } from 'react';

import { productSurfaceHighRiskCommand } from '../../../../components/product-surface-high-risk-command';
import { useProductActionMutation } from '../../../../components/use-product-action-mutation';
import { useProductSurfaceHighRiskCommandExecutor } from '../../../../components/use-product-surface-high-risk-command-executor';

import type { ProductSurfaceHighRiskCommandController } from '../../../../components/product-surface-high-risk-command';
import type { ProductActionRouteContractKey } from '../../../../components/use-product-action-mutation';
import type {
  PerformanceCommandExecutors,
  PerformancePublishCommandBinding,
} from './use-performance-cycle-studio';

export const PERFORMANCE_CYCLE_ACTION_CONTRACTS = Object.freeze({
  create: 'route.hcm.operations.performance-cycle-create.action',
  update: 'route.hcm.operations.performance-cycle-update.action',
  validate: 'route.hcm.operations.performance-cycle-validate.action',
  preview: 'route.hcm.operations.performance-cycle-population-preview.action',
  publish: 'route.hcm.operations.performance-cycle-publish.action',
} as const satisfies Record<keyof PerformanceCommandExecutors, ProductActionRouteContractKey>);

/**
 * Binds every performance command to its own immutable ACTION contract.
 *
 * These callbacks only relay authority resolved by the product-surface runtime. They never
 * construct, widen or reuse an authority decision across a different command route.
 */
export type PerformanceCycleCommandRuntime = Readonly<{
  commandExecutors: PerformanceCommandExecutors;
  publishController: ProductSurfaceHighRiskCommandController;
}>;

export function performanceCyclePublishCommand({
  cycleId,
  request,
}: PerformancePublishCommandBinding) {
  return productSurfaceHighRiskCommand({
    operation: 'HCM_PERFORMANCE_CYCLE_PUBLISH',
    commandMethod: 'POST',
    commandPath: `/api/people/v1/hris/performance/cycles/${encodeURIComponent(cycleId)}/publish`,
    targetType: 'PERFORMANCE_CYCLE',
    targetId: cycleId,
    expectedObjectVersion: request.expectedRevision,
    payload: { ...request },
    idempotencyKey: request.commandId,
    idempotencyPayloadPath: 'ROOT_COMMAND_ID',
  });
}

export function usePerformanceCycleCommandExecutors(): PerformanceCycleCommandRuntime {
  const create = useProductActionMutation(PERFORMANCE_CYCLE_ACTION_CONTRACTS.create);
  const update = useProductActionMutation(PERFORMANCE_CYCLE_ACTION_CONTRACTS.update);
  const validate = useProductActionMutation(PERFORMANCE_CYCLE_ACTION_CONTRACTS.validate);
  const preview = useProductActionMutation(PERFORMANCE_CYCLE_ACTION_CONTRACTS.preview);
  const publish = useProductSurfaceHighRiskCommandExecutor({
    operation: 'HCM_PERFORMANCE_CYCLE_PUBLISH',
    buildCommand: performanceCyclePublishCommand,
  });

  return useMemo(
    () => ({
      commandExecutors: { create, update, validate, preview, publish: publish.execute },
      publishController: publish.controller,
    }),
    [create, preview, publish.controller, publish.execute, update, validate]
  );
}
