import { useMemo } from 'react';

import { productSurfaceHighRiskCommand } from '../../../../components/product-surface-high-risk-command';
import { useProductActionMutation } from '../../../../components/use-product-action-mutation';
import { useProductSurfaceHighRiskCommandExecutor } from '../../../../components/use-product-surface-high-risk-command-executor';
import {
  PAYROLL_FOUNDATION_SETTINGS_ACTION_CONTRACTS,
  PAYROLL_FOUNDATION_SETTINGS_API_BASE,
} from '../api/payroll-foundation-settings-api';

import type { ProductSurfaceHighRiskCommandController } from '../../../../components/product-surface-high-risk-command';
import type {
  PayrollFoundationCommandExecutors,
  PayrollFoundationPublishCommandBinding,
  PayrollFoundationReverseCommandBinding,
} from './use-payroll-foundation-studio';

export type PayrollFoundationSettingsCommandRuntime = Readonly<{
  commandExecutors: PayrollFoundationCommandExecutors;
  publishController: ProductSurfaceHighRiskCommandController;
  reverseController: ProductSurfaceHighRiskCommandController;
}>;

export function payrollFoundationSettingsPublishCommand({
  configurationId,
  commandId,
  request,
}: PayrollFoundationPublishCommandBinding) {
  return productSurfaceHighRiskCommand({
    operation: 'HCM_PAYROLL_FOUNDATION_SETTINGS_PUBLISH',
    commandMethod: 'POST',
    commandPath: `${PAYROLL_FOUNDATION_SETTINGS_API_BASE}/configurations/${encodeURIComponent(configurationId)}/publish`,
    targetType: 'PAYROLL_CONFIGURATION',
    targetId: configurationId,
    expectedObjectVersion: request.expectedVersion,
    payload: { ...request },
    idempotencyKey: commandId,
  });
}

export function payrollFoundationSettingsReverseCommand({
  configurationId,
  commandId,
  request,
}: PayrollFoundationReverseCommandBinding) {
  return productSurfaceHighRiskCommand({
    operation: 'HCM_PAYROLL_FOUNDATION_SETTINGS_REVERSE',
    commandMethod: 'POST',
    commandPath: `${PAYROLL_FOUNDATION_SETTINGS_API_BASE}/configurations/${encodeURIComponent(configurationId)}/reversals`,
    targetType: 'PAYROLL_CONFIGURATION',
    targetId: configurationId,
    expectedObjectVersion: request.expectedVersion,
    payload: { ...request },
    idempotencyKey: commandId,
  });
}

/** Resolves settings commands only through their exact hcm.management ACTION contracts. */
export function usePayrollFoundationSettingsCommandExecutors(): PayrollFoundationSettingsCommandRuntime {
  const create = useProductActionMutation(PAYROLL_FOUNDATION_SETTINGS_ACTION_CONTRACTS.create);
  const update = useProductActionMutation(PAYROLL_FOUNDATION_SETTINGS_ACTION_CONTRACTS.update);
  const simulate = useProductActionMutation(PAYROLL_FOUNDATION_SETTINGS_ACTION_CONTRACTS.simulate);
  const publish = useProductSurfaceHighRiskCommandExecutor({
    operation: 'HCM_PAYROLL_FOUNDATION_SETTINGS_PUBLISH',
    buildCommand: payrollFoundationSettingsPublishCommand,
  });
  const reverse = useProductSurfaceHighRiskCommandExecutor({
    operation: 'HCM_PAYROLL_FOUNDATION_SETTINGS_REVERSE',
    buildCommand: payrollFoundationSettingsReverseCommand,
  });
  const reconcile = useProductActionMutation(
    PAYROLL_FOUNDATION_SETTINGS_ACTION_CONTRACTS.reconcile
  );

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
