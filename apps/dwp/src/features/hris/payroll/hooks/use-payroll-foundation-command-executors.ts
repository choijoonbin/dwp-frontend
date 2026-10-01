import { useMemo } from 'react';

import { productSurfaceHighRiskCommand } from '../../../../components/product-surface-high-risk-command';
import { useProductActionMutation } from '../../../../components/use-product-action-mutation';
import { useProductSurfaceHighRiskCommandExecutor } from '../../../../components/use-product-surface-high-risk-command-executor';

import type { ProductSurfaceHighRiskCommandController } from '../../../../components/product-surface-high-risk-command';
import type { ProductActionRouteContractKey } from '../../../../components/use-product-action-mutation';
import type {
  PayrollFoundationCommandExecutors,
  PayrollFoundationPublishCommandBinding,
  PayrollFoundationReverseCommandBinding,
} from './use-payroll-foundation-studio';

export const PAYROLL_FOUNDATION_ACTION_CONTRACTS = Object.freeze({
  create: 'route.hcm.operations.payroll-foundation-create.action',
  update: 'route.hcm.operations.payroll-foundation-update.action',
  simulate: 'route.hcm.operations.payroll-foundation-simulate.action',
  publish: 'route.hcm.operations.payroll-foundation-publish.action',
  reverse: 'route.hcm.operations.payroll-foundation-reverse.action',
  reconcile: 'route.hcm.operations.payroll-foundation-reconcile.action',
} as const satisfies Record<
  keyof PayrollFoundationCommandExecutors,
  ProductActionRouteContractKey
>);

/** Resolves each payroll mutation through its own exact generated ACTION contract. */
export type PayrollFoundationCommandRuntime = Readonly<{
  commandExecutors: PayrollFoundationCommandExecutors;
  publishController: ProductSurfaceHighRiskCommandController;
  reverseController: ProductSurfaceHighRiskCommandController;
}>;

export function payrollFoundationPublishCommand({
  configurationId,
  commandId,
  request,
}: PayrollFoundationPublishCommandBinding) {
  return productSurfaceHighRiskCommand({
    operation: 'HCM_PAYROLL_FOUNDATION_PUBLISH',
    commandMethod: 'POST',
    commandPath: `/api/payroll/v1/hris/payroll/foundation/configurations/${encodeURIComponent(configurationId)}/publish`,
    targetType: 'PAYROLL_CONFIGURATION',
    targetId: configurationId,
    expectedObjectVersion: request.expectedVersion,
    payload: { ...request },
    idempotencyKey: commandId,
  });
}

export function payrollFoundationReverseCommand({
  configurationId,
  commandId,
  request,
}: PayrollFoundationReverseCommandBinding) {
  return productSurfaceHighRiskCommand({
    operation: 'HCM_PAYROLL_FOUNDATION_REVERSE',
    commandMethod: 'POST',
    commandPath: `/api/payroll/v1/hris/payroll/foundation/configurations/${encodeURIComponent(configurationId)}/reversals`,
    targetType: 'PAYROLL_CONFIGURATION',
    targetId: configurationId,
    expectedObjectVersion: request.expectedVersion,
    payload: { ...request },
    idempotencyKey: commandId,
  });
}

export function usePayrollFoundationCommandExecutors(): PayrollFoundationCommandRuntime {
  const create = useProductActionMutation(PAYROLL_FOUNDATION_ACTION_CONTRACTS.create);
  const update = useProductActionMutation(PAYROLL_FOUNDATION_ACTION_CONTRACTS.update);
  const simulate = useProductActionMutation(PAYROLL_FOUNDATION_ACTION_CONTRACTS.simulate);
  const publish = useProductSurfaceHighRiskCommandExecutor({
    operation: 'HCM_PAYROLL_FOUNDATION_PUBLISH',
    buildCommand: payrollFoundationPublishCommand,
  });
  const reverse = useProductSurfaceHighRiskCommandExecutor({
    operation: 'HCM_PAYROLL_FOUNDATION_REVERSE',
    buildCommand: payrollFoundationReverseCommand,
  });
  const reconcile = useProductActionMutation(PAYROLL_FOUNDATION_ACTION_CONTRACTS.reconcile);

  return useMemo(
    () => ({
      commandExecutors: {
        create,
        update,
        simulate,
        publish: publish.execute,
        reverse: reverse.execute,
        reconcile,
      },
      publishController: publish.controller,
      reverseController: reverse.controller,
    }),
    [
      create,
      publish.controller,
      publish.execute,
      reconcile,
      reverse.controller,
      reverse.execute,
      simulate,
      update,
    ]
  );
}
