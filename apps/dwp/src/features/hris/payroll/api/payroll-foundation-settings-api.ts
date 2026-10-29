import { createPayrollFoundationDataSource } from './payroll-foundation-api';

import type { ProductActionRouteContractKey } from '../../../../components/use-product-action-mutation';

export const PAYROLL_FOUNDATION_SETTINGS_API_BASE =
  '/api/payroll/v1/settings/payroll/foundation' as const;

export const PAYROLL_FOUNDATION_SETTINGS_READ_CONTRACTS = Object.freeze({
  list: {
    routeContractKey: 'route.hcm.configuration.payroll-foundation-configurations.data',
    method: 'GET',
    path: `${PAYROLL_FOUNDATION_SETTINGS_API_BASE}/configurations`,
  },
  detail: {
    routeContractKey: 'route.hcm.configuration.payroll-foundation-configuration.data',
    method: 'GET',
    path: `${PAYROLL_FOUNDATION_SETTINGS_API_BASE}/configurations/{configurationId}`,
  },
  versions: {
    routeContractKey: 'route.hcm.configuration.payroll-foundation-versions.data',
    method: 'GET',
    path: `${PAYROLL_FOUNDATION_SETTINGS_API_BASE}/configurations/{configurationId}/versions`,
  },
  receipt: {
    routeContractKey: 'route.hcm.configuration.payroll-foundation-receipt.data',
    method: 'GET',
    path: `${PAYROLL_FOUNDATION_SETTINGS_API_BASE}/receipts/{commandId}`,
  },
} as const);

export const PAYROLL_FOUNDATION_SETTINGS_ACTION_CONTRACTS = Object.freeze({
  create: 'route.hcm.configuration.payroll-foundation-create.action',
  update: 'route.hcm.configuration.payroll-foundation-update.action',
  simulate: 'route.hcm.configuration.payroll-foundation-simulate.action',
  publish: 'route.hcm.configuration.payroll-foundation-publish.action',
  reverse: 'route.hcm.configuration.payroll-foundation-reverse.action',
  reconcile: 'route.hcm.configuration.payroll-foundation-reconcile.action',
} as const satisfies Record<
  'create' | 'update' | 'simulate' | 'publish' | 'reverse' | 'reconcile',
  ProductActionRouteContractKey
>);

export const HCM_PAYROLL_FOUNDATION_SETTINGS_MUTATION_API_CONTRACTS = [
  {
    apiFunction: 'createPayrollFoundationAtBase',
    routeContractKey: PAYROLL_FOUNDATION_SETTINGS_ACTION_CONTRACTS.create,
    method: 'POST',
    path: `${PAYROLL_FOUNDATION_SETTINGS_API_BASE}/configurations`,
  },
  {
    apiFunction: 'updatePayrollFoundationAtBase',
    routeContractKey: PAYROLL_FOUNDATION_SETTINGS_ACTION_CONTRACTS.update,
    method: 'PUT',
    path: `${PAYROLL_FOUNDATION_SETTINGS_API_BASE}/configurations/{configurationId}`,
  },
  {
    apiFunction: 'simulatePayrollFoundationAtBase',
    routeContractKey: PAYROLL_FOUNDATION_SETTINGS_ACTION_CONTRACTS.simulate,
    method: 'POST',
    path: `${PAYROLL_FOUNDATION_SETTINGS_API_BASE}/configurations/{configurationId}/simulations`,
  },
  {
    apiFunction: 'publishPayrollFoundationAtBase',
    routeContractKey: PAYROLL_FOUNDATION_SETTINGS_ACTION_CONTRACTS.publish,
    method: 'POST',
    path: `${PAYROLL_FOUNDATION_SETTINGS_API_BASE}/configurations/{configurationId}/publish`,
  },
  {
    apiFunction: 'reversePayrollFoundationAtBase',
    routeContractKey: PAYROLL_FOUNDATION_SETTINGS_ACTION_CONTRACTS.reverse,
    method: 'POST',
    path: `${PAYROLL_FOUNDATION_SETTINGS_API_BASE}/configurations/{configurationId}/reversals`,
  },
  {
    apiFunction: 'reconcilePayrollFoundationReceiptAtBase',
    routeContractKey: PAYROLL_FOUNDATION_SETTINGS_ACTION_CONTRACTS.reconcile,
    method: 'POST',
    path: `${PAYROLL_FOUNDATION_SETTINGS_API_BASE}/receipts/{commandId}/reconcile`,
  },
] as const;

export const payrollFoundationSettingsDataSource = createPayrollFoundationDataSource(
  PAYROLL_FOUNDATION_SETTINGS_API_BASE
);
