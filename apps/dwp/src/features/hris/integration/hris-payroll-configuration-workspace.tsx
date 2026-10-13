import { useMemo } from 'react';
import { resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import { useTranslation } from 'react-i18next';

import {
  ProductSurfaceHighRiskCommandDialog,
  productSurfaceHighRiskCommand,
} from '../../../components/product-surface-high-risk-command';
import { useProductActionMutation } from '../../../components/use-product-action-mutation';
import { useProductSurfaceHighRiskCommandExecutor } from '../../../components/use-product-surface-high-risk-command-executor';
import { useProductSurfaceRequestScope } from '../../../components/use-product-surface-request-scope';
import { PayrollConfigurationWorkbenchRuntime, payrollElementFormulaDataSource } from '../payroll';

import type { ProductActionRouteContractKey } from '../../../components/use-product-action-mutation';
import type {
  PayrollConfigurationOwnerBinding,
  PayrollConfigurationScope,
  PayrollFormulaCommandBinding,
} from '../payroll';

export const HRIS_PAYROLL_CONFIGURATION_ACTION_CONTRACTS = Object.freeze({
  validate: 'route.hcm.configuration.payroll-formula-validate.action',
  simulate: 'route.hcm.configuration.payroll-formula-simulate.action',
  publish: 'route.hcm.configuration.payroll-formula-publish.action',
} as const satisfies Record<'validate' | 'simulate' | 'publish', ProductActionRouteContractKey>);

function localTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export function payrollFormulaPublishCommand(binding: PayrollFormulaCommandBinding) {
  if (binding.kind !== 'PUBLISH') {
    throw new Error('Only an exact payroll formula publication can request step-up authority.');
  }
  return productSurfaceHighRiskCommand({
    operation: 'HCM_PAYROLL_FORMULA_PUBLISH',
    commandMethod: 'POST',
    commandPath: `/api/payroll/v1/formulas/${encodeURIComponent(binding.formulaId)}/publish`,
    targetType: 'PAYROLL_FORMULA',
    targetId: binding.formulaId,
    expectedObjectVersion: binding.expectedVersion,
    payload: { ...binding.request },
    idempotencyKey: binding.idempotencyKey,
  });
}

/**
 * Production adapter for the canonical payroll-settings PAGE. Reads and ordinary commands retain
 * their exact generated contracts; publication can receive authority only from the shared
 * high-risk coordinator and preserves the runtime's version and idempotency binding.
 */
export function HrisPayrollConfigurationWorkspace() {
  const { i18n } = useTranslation('hcm');
  const requestScope = useProductSurfaceRequestScope({
    productKey: 'hcm',
    surfaceKey: 'hcm.management',
  });
  const validate = useProductActionMutation(HRIS_PAYROLL_CONFIGURATION_ACTION_CONTRACTS.validate);
  const simulate = useProductActionMutation(HRIS_PAYROLL_CONFIGURATION_ACTION_CONTRACTS.simulate);
  const publish = useProductSurfaceHighRiskCommandExecutor({
    operation: 'HCM_PAYROLL_FORMULA_PUBLISH',
    buildCommand: payrollFormulaPublishCommand,
  });
  const timeZone = localTimeZone();
  const scopeIdentity =
    requestScope.contextScopeKey && requestScope.queryMeta.decisionRevision
      ? `${requestScope.contextScopeKey}\u0000${requestScope.queryMeta.decisionRevision}`
      : '';
  const correlationId = useMemo(
    () => (scopeIdentity ? (globalThis.crypto?.randomUUID?.() ?? '') : ''),
    [scopeIdentity]
  );
  const locale = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language);
  const scope = useMemo<PayrollConfigurationScope>(
    () => ({
      ready:
        requestScope.ready &&
        Boolean(requestScope.contextScopeKey) &&
        Boolean(requestScope.queryMeta.decisionRevision) &&
        Boolean(correlationId),
      contextScopeKey: requestScope.contextScopeKey ?? '',
      decisionRevision: requestScope.queryMeta.decisionRevision,
      locale,
      timeZone,
      correlationId,
    }),
    [
      correlationId,
      locale,
      requestScope.contextScopeKey,
      requestScope.queryMeta.decisionRevision,
      requestScope.ready,
      timeZone,
    ]
  );
  const ownerBinding = useMemo<PayrollConfigurationOwnerBinding>(
    () => ({
      page: { contractId: 'IAQ-055', read: payrollElementFormulaDataSource.workbench },
      validate: {
        contractId: 'PEP-PAY-006',
        execute: (execute) => validate(execute),
      },
      simulate: {
        contractId: 'PEP-PAY-007',
        execute: (execute) => simulate(execute),
      },
      publish: {
        contractId: 'PEP-PAY-008',
        execute: publish.execute,
      },
    }),
    [publish.execute, simulate, validate]
  );

  return (
    <div data-testid="hris-payroll-configuration-workspace">
      <PayrollConfigurationWorkbenchRuntime
        scope={scope}
        ownerBinding={ownerBinding}
        dataSource={payrollElementFormulaDataSource}
      />
      <ProductSurfaceHighRiskCommandDialog controller={publish.controller} />
    </div>
  );
}

export default HrisPayrollConfigurationWorkspace;
