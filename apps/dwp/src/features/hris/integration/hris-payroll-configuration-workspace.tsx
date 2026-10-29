import { useMemo, type SyntheticEvent } from 'react';
import { resolveSupportedLocale, resolveSystemTimeZone } from '@dwp-frontend/shared-i18n';
import { InlineFeedback } from '@dwp-frontend/design-system';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';

import {
  ProductSurfaceHighRiskCommandDialog,
  productSurfaceHighRiskCommand,
} from '../../../components/product-surface-high-risk-command';
import { useProductActionMutation } from '../../../components/use-product-action-mutation';
import { useProductSurfaceHighRiskCommandExecutor } from '../../../components/use-product-surface-high-risk-command-executor';
import { useProductSurfaceRequestScope } from '../../../components/use-product-surface-request-scope';
import {
  HrisPayrollFoundationSettingsWorkspace,
  PayrollConfigurationWorkbenchRuntime,
  payrollElementFormulaDataSource,
} from '../payroll';

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
  return resolveSystemTimeZone('UTC');
}

export const HRIS_PAYROLL_FOUNDATION_SETTINGS_RUNTIME_STATE =
  import.meta.env.VITE_HRIS_PAYROLL_SETTINGS_FOUNDATION_ENABLED === 'true' ? 'ON' : 'OFF';

type PayrollSettingsTab = 'formula' | 'foundation' | 'invalid';

function selectedTab(value: string | null): PayrollSettingsTab {
  if (value === null || value === '' || value === 'formula') return 'formula';
  if (value === 'foundation') return 'foundation';
  return 'invalid';
}

export type HrisPayrollConfigurationWorkspaceProps = Readonly<{
  foundationEnabled?: boolean;
}>;

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
export function HrisPayrollConfigurationWorkspace({
  foundationEnabled = HRIS_PAYROLL_FOUNDATION_SETTINGS_RUNTIME_STATE === 'ON',
}: HrisPayrollConfigurationWorkspaceProps) {
  const { t } = useTranslation('hcm');
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = selectedTab(searchParams.get('tab'));
  const visibleTab = tab === 'foundation' && foundationEnabled ? 'foundation' : 'formula';

  const selectTab = (_event: SyntheticEvent, next: 'formula' | 'foundation') => {
    const updated = new URLSearchParams(searchParams);
    if (next === 'formula') updated.delete('tab');
    else updated.set('tab', 'foundation');
    setSearchParams(updated, { replace: true });
  };

  return (
    <Stack gap={2} data-testid="hris-payroll-configuration-workspace" minWidth={0}>
      <Tabs
        value={
          tab === 'invalid' || (tab === 'foundation' && !foundationEnabled) ? false : visibleTab
        }
        onChange={selectTab}
        aria-label={t('pages.hcm.settings-payroll.tabs.label', {
          defaultValue: 'Payroll configuration sections',
        })}
        variant="scrollable"
        scrollButtons="auto"
      >
        <Tab
          value="formula"
          label={t('pages.hcm.settings-payroll.tabs.formula', {
            defaultValue: 'Elements & formulas',
          })}
        />
        {foundationEnabled ? (
          <Tab
            value="foundation"
            label={t('pages.hcm.settings-payroll.tabs.foundation', {
              defaultValue: 'Foundation',
            })}
          />
        ) : null}
      </Tabs>

      {tab === 'formula' ? <PayrollFormulaConfigurationTab /> : null}
      {tab === 'foundation' && foundationEnabled ? (
        <HrisPayrollFoundationSettingsWorkspace />
      ) : null}
      {tab === 'foundation' && !foundationEnabled ? (
        <InlineFeedback
          severity="info"
          title={t('pages.hcm.settings-payroll.foundationOffTitle', {
            defaultValue: 'Payroll Foundation settings are not active',
          })}
        >
          {t('pages.hcm.settings-payroll.foundationOffDescription', {
            defaultValue:
              'This tenant has not activated the governed Foundation settings surface. No payroll data was loaded.',
          })}
        </InlineFeedback>
      ) : null}
      {tab === 'invalid' ? (
        <InlineFeedback
          severity="warning"
          title={t('pages.hcm.settings-payroll.invalidTabTitle', {
            defaultValue: 'Unknown payroll settings section',
          })}
        >
          {t('pages.hcm.settings-payroll.invalidTabDescription', {
            defaultValue:
              'Only the allowlisted formula and Foundation sections can be opened. No payroll data was loaded.',
          })}
        </InlineFeedback>
      ) : null}
    </Stack>
  );
}

function PayrollFormulaConfigurationTab() {
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
    <div data-testid="hris-payroll-formula-configuration-tab">
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
