import {
  productSurfaceGovernedMutationConfig,
  productSurfaceHighRiskMutationConfig,
} from '@dwp-frontend/shared-utils';
import { axiosInstance } from '@dwp-frontend/shared-utils/axios-instance';
import { productSurfaceReadScopeConfig } from '@dwp-frontend/shared-utils/api/product-surface-read-scope';

import { selectPayrollConfigurationWorkbench } from '../model/payroll-configuration-workbench-model';
import { selectSuccessfulPayrollFormulaReceipt } from '../model/payroll-element-formula-wire';

import type {
  ApiResponse,
  ProductSurfaceGovernedMutationAuthority,
} from '@dwp-frontend/shared-utils';
import type { PayrollConfigurationWorkbench } from '../model/payroll-configuration-workbench-model';
import type {
  CreatePayrollElementVersion,
  CreatePayrollFormulaVersion,
  PayrollFormulaReceipt,
  SimulatePayrollFormula,
} from '../model/payroll-element-formula-model';

export const PAYROLL_CONFIGURATION_WORKBENCH_PATH =
  '/api/payroll/v1/workbench/settings-payroll' as const;
export const PAYROLL_ELEMENT_VERSIONS_PATH = '/api/payroll/v1/elements/versions' as const;
export const PAYROLL_FORMULA_VERSIONS_PATH = '/api/payroll/v1/formulas/versions' as const;
export const PAYROLL_CONFIGURATION_PURPOSE = 'PAYROLL_CONFIGURATION' as const;

export const PAYROLL_ELEMENT_FORMULA_OPERATION_BINDINGS = Object.freeze([
  {
    contract: 'IAQ-055',
    permission: 'hcm.configuration.workbench.view',
    method: 'GET',
    path: PAYROLL_CONFIGURATION_WORKBENCH_PATH,
  },
  {
    contract: 'PEP-PAY-004',
    permission: 'hcm.operations.payroll-inputs.update',
    method: 'POST',
    path: PAYROLL_ELEMENT_VERSIONS_PATH,
  },
  {
    contract: 'PEP-PAY-005',
    permission: 'hcm.operations.payroll-inputs.update',
    method: 'POST',
    path: PAYROLL_FORMULA_VERSIONS_PATH,
  },
  {
    contract: 'PEP-PAY-006',
    permission: 'hcm.operations.payroll-inputs.update',
    method: 'POST',
    path: '/api/payroll/v1/formulas/{formulaId}/validations',
  },
  {
    contract: 'PEP-PAY-007',
    permission: 'hcm.operations.payroll-inputs.update',
    method: 'POST',
    path: '/api/payroll/v1/formulas/{formulaId}/simulations',
  },
  {
    contract: 'PEP-PAY-008',
    permission: 'hcm.configuration.policy.publish',
    method: 'POST',
    path: '/api/payroll/v1/formulas/{formulaId}/publish',
  },
] as const);

export type PayrollConfigurationWorkbenchQuery = Readonly<{
  limit?: number;
  cursor?: string;
  asOf?: string;
  policyVersion?: Readonly<{ policyKeys?: readonly string[]; minimumRevision?: number }>;
  payrollPolicy?: Readonly<{ policyKeys?: readonly string[]; minimumRevision?: number }>;
  effectiveStatus?: Readonly<{ codes?: readonly string[]; minimumRevision?: number }>;
  effectiveOn?: string;
  sort?: readonly (
    | 'policyVersion:ASC'
    | 'payrollPolicy:ASC'
    | 'effectiveStatus:ASC'
    | 'policyVersion:DESC'
    | 'payrollPolicy:DESC'
    | 'effectiveStatus:DESC'
    | 'itemPublicId:ASC'
    | 'itemPublicId:DESC'
  )[];
  locale?: string;
  timeZone?: string;
  correlationId: string;
}>;

export type PayrollFormulaCommandAuthority = Readonly<{
  governance: ProductSurfaceGovernedMutationAuthority;
  idempotencyKey: string;
  correlationId: string;
  expectedObjectVersion?: number;
}>;

export type PayrollFormulaVersionCommand = Readonly<{ expectedVersion: number }>;

type ReadScope = Readonly<{ contextScopeKey?: string; signal?: AbortSignal }>;

export type PayrollElementFormulaDataSource = Readonly<{
  workbench: (
    query: PayrollConfigurationWorkbenchQuery,
    scope: ReadScope
  ) => Promise<PayrollConfigurationWorkbench>;
  createElement: (
    body: CreatePayrollElementVersion,
    authority: PayrollFormulaCommandAuthority
  ) => Promise<PayrollFormulaReceipt>;
  createFormula: (
    body: CreatePayrollFormulaVersion,
    authority: PayrollFormulaCommandAuthority
  ) => Promise<PayrollFormulaReceipt>;
  validateFormula: (
    formulaId: string,
    body: PayrollFormulaVersionCommand,
    authority: PayrollFormulaCommandAuthority
  ) => Promise<PayrollFormulaReceipt>;
  simulateFormula: (
    formulaId: string,
    body: SimulatePayrollFormula,
    authority: PayrollFormulaCommandAuthority
  ) => Promise<PayrollFormulaReceipt>;
  publishFormula: (
    formulaId: string,
    body: PayrollFormulaVersionCommand,
    authority: PayrollFormulaCommandAuthority
  ) => Promise<PayrollFormulaReceipt>;
}>;

function addValue(search: URLSearchParams, key: string, value: string | undefined) {
  if (value !== undefined) search.set(key, value);
}

function addNumber(search: URLSearchParams, key: string, value: number | undefined) {
  if (value !== undefined) search.set(key, String(value));
}

function addValues(search: URLSearchParams, key: string, values: readonly string[] | undefined) {
  values?.forEach((value) => search.append(key, value));
}

export async function readPayrollConfigurationWorkbench(
  query: PayrollConfigurationWorkbenchQuery,
  scope: ReadScope
): Promise<PayrollConfigurationWorkbench> {
  validateWorkbenchQuery(query);
  const search = new URLSearchParams({
    limit: String(query.limit ?? 50),
    locale: query.locale ?? 'en',
    timeZone: query.timeZone ?? 'UTC',
    correlationId: query.correlationId,
  });
  addValue(search, 'cursor', query.cursor);
  addValue(search, 'asOf', query.asOf);
  addValues(search, 'filter.policyVersion.policyKeys', query.policyVersion?.policyKeys);
  addNumber(search, 'filter.policyVersion.minimumRevision', query.policyVersion?.minimumRevision);
  addValues(search, 'filter.payrollPolicy.policyKeys', query.payrollPolicy?.policyKeys);
  addNumber(search, 'filter.payrollPolicy.minimumRevision', query.payrollPolicy?.minimumRevision);
  addValues(search, 'filter.effectiveStatus.codes', query.effectiveStatus?.codes);
  addNumber(
    search,
    'filter.effectiveStatus.minimumRevision',
    query.effectiveStatus?.minimumRevision
  );
  addValue(search, 'filter.effectiveOn', query.effectiveOn);
  for (const sort of query.sort ?? ['itemPublicId:ASC']) search.append('sort', sort);
  const scoped = productSurfaceReadScopeConfig(scope.contextScopeKey, scope.signal);
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${PAYROLL_CONFIGURATION_WORKBENCH_PATH}?${search.toString()}`,
    {
      ...scoped,
      headers: {
        'X-Correlation-ID': query.correlationId,
      },
    }
  );
  return selectPayrollConfigurationWorkbench(response.data.data);
}

export function createPayrollElementVersion(
  body: CreatePayrollElementVersion,
  authority: PayrollFormulaCommandAuthority
) {
  return mutate(
    PAYROLL_ELEMENT_VERSIONS_PATH,
    body,
    authority,
    body.expectedVersion,
    false,
    'CREATE_ELEMENT_VERSION'
  );
}

export function createPayrollFormulaVersion(
  body: CreatePayrollFormulaVersion,
  authority: PayrollFormulaCommandAuthority
) {
  return mutate(
    PAYROLL_FORMULA_VERSIONS_PATH,
    body,
    authority,
    body.expectedVersion,
    false,
    'CREATE_FORMULA_VERSION'
  );
}

export function validatePayrollFormula(
  formulaId: string,
  body: PayrollFormulaVersionCommand,
  authority: PayrollFormulaCommandAuthority
) {
  return mutate(
    formulaPath(formulaId, 'validations'),
    body,
    authority,
    body.expectedVersion,
    false,
    'VALIDATE_FORMULA'
  );
}

export function simulatePayrollFormula(
  formulaId: string,
  body: SimulatePayrollFormula,
  authority: PayrollFormulaCommandAuthority
) {
  return mutate(
    formulaPath(formulaId, 'simulations'),
    body,
    authority,
    body.expectedVersion,
    false,
    'SIMULATE_FORMULA'
  );
}

export function publishPayrollFormula(
  formulaId: string,
  body: PayrollFormulaVersionCommand,
  authority: PayrollFormulaCommandAuthority
) {
  return mutate(
    formulaPath(formulaId, 'publish'),
    body,
    authority,
    body.expectedVersion,
    true,
    'PUBLISH_FORMULA'
  );
}

async function mutate<T extends object>(
  path: string,
  body: T,
  authority: PayrollFormulaCommandAuthority,
  expectedVersion: number | undefined,
  highRisk: boolean,
  commandType: PayrollFormulaReceipt['commandType']
) {
  validateAuthority(authority, expectedVersion);
  const governed = highRisk
    ? productSurfaceHighRiskMutationConfig(authority.governance, {
        objectVersionHeader: expectedVersion !== undefined,
      })
    : productSurfaceGovernedMutationConfig(authority.governance, {
        objectVersionHeader: expectedVersion !== undefined,
      });
  const response = await axiosInstance.post<ApiResponse<unknown>, T>(path, body, {
    ...governed,
    headers: {
      ...governed.headers,
      'Idempotency-Key': authority.idempotencyKey,
      'X-Correlation-ID': authority.correlationId,
      ...(expectedVersion !== undefined
        ? { 'X-DWP-Expected-Object-Version': String(expectedVersion) }
        : {}),
    },
    csrfReplay: 'NEVER',
  });
  return selectSuccessfulPayrollFormulaReceipt(response.data.data, {
    commandType,
    correlationId: authority.correlationId,
  });
}

function validateWorkbenchQuery(query: PayrollConfigurationWorkbenchQuery) {
  const limit = query.limit ?? 50;
  const sort = query.sort ?? ['itemPublicId:ASC'];
  if (
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 100 ||
    sort.length < 1 ||
    sort.length > 3 ||
    new Set(sort).size !== sort.length ||
    !isUuid(query.correlationId) ||
    (query.locale !== undefined && (query.locale.length < 2 || query.locale.length > 35)) ||
    (query.timeZone !== undefined && (query.timeZone.length < 1 || query.timeZone.length > 255))
  ) {
    throw new Error('Payroll workbench query is invalid.');
  }
}

function validateAuthority(
  authority: PayrollFormulaCommandAuthority,
  expectedVersion: number | undefined
) {
  if (
    !isUuid(authority.idempotencyKey) ||
    !isUuid(authority.correlationId) ||
    (expectedVersion !== undefined &&
      (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1)) ||
    authority.expectedObjectVersion !== expectedVersion
  ) {
    throw new Error('Payroll formula command authority is invalid.');
  }
  if (
    authority.governance.mode === 'SECURE' &&
    (authority.governance.idempotencyKey !== authority.idempotencyKey ||
      (expectedVersion !== undefined && authority.governance.objectVersion !== expectedVersion) ||
      authority.governance.contextScopeKey === undefined)
  ) {
    throw new Error('Payroll formula command authority does not match the command.');
  }
}

function formulaPath(formulaId: string, action: 'validations' | 'simulations' | 'publish') {
  if (!isUuid(formulaId)) throw new Error('Payroll formula identifier is invalid.');
  return `/api/payroll/v1/formulas/${encodeURIComponent(formulaId)}/${action}`;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
}

export const payrollElementFormulaDataSource: PayrollElementFormulaDataSource = Object.freeze({
  workbench: readPayrollConfigurationWorkbench,
  createElement: createPayrollElementVersion,
  createFormula: createPayrollFormulaVersion,
  validateFormula: validatePayrollFormula,
  simulateFormula: simulatePayrollFormula,
  publishFormula: publishPayrollFormula,
});
