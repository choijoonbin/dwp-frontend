import {
  productSurfaceGovernedMutationConfig,
  productSurfaceHighRiskMutationConfig,
} from '@dwp-frontend/shared-utils';
import { axiosInstance } from '@dwp-frontend/shared-utils/axios-instance';
import { productSurfaceReadScopeConfig } from '@dwp-frontend/shared-utils/api/product-surface-read-scope';

import {
  selectPayrollCalculationReceipt,
  selectPayrollCalculationRun,
  validatePayrollActionCommand,
} from '../model/payroll-calculation-contract';

import type {
  ApiResponse,
  ProductSurfaceGovernedMutationAuthority,
} from '@dwp-frontend/shared-utils';
import type {
  PayrollActionCommand,
  PayrollCalculationCommandKind,
  PayrollCalculationReceipt,
  PayrollCalculationRun,
} from '../model/payroll-calculation-contract';

export const PAYROLL_RUN_PATH = '/api/payroll/v1/runs/{runId}' as const;
export const PAYROLL_CALCULATE_PATH = '/api/payroll/v1/runs/{runId}/attempts' as const;
export const PAYROLL_APPROVE_PATH = '/api/payroll/v1/runs/{runId}/approvals' as const;
export const PAYROLL_FINALIZE_PATH = '/api/payroll/v1/runs/{runId}/finalize' as const;
export const PAYROLL_COMMAND_RECEIPT_PATH = '/api/payroll/v1/command-receipts/{receiptId}' as const;

export type PayrollCalculationReadScope = Readonly<{
  contextScopeKey?: string;
  correlationId: string;
  signal?: AbortSignal;
}>;

export type PayrollCalculationCommandAuthority = Readonly<{
  governance: ProductSurfaceGovernedMutationAuthority;
  idempotencyKey: string;
  correlationId: string;
  expectedObjectVersion: number;
}>;

export type PayrollCalculationDataSource = Readonly<{
  run: (runId: string, scope: PayrollCalculationReadScope) => Promise<PayrollCalculationRun>;
  calculate: (
    runId: string,
    body: PayrollActionCommand,
    authority: PayrollCalculationCommandAuthority
  ) => Promise<PayrollCalculationReceipt>;
  approve: (
    runId: string,
    body: PayrollActionCommand,
    authority: PayrollCalculationCommandAuthority
  ) => Promise<PayrollCalculationReceipt>;
  finalize: (
    runId: string,
    body: PayrollActionCommand,
    authority: PayrollCalculationCommandAuthority
  ) => Promise<PayrollCalculationReceipt>;
  receipt: (
    receiptId: string,
    scope: PayrollCalculationReadScope
  ) => Promise<PayrollCalculationReceipt>;
}>;

export async function getPayrollCalculationRun(runId: string, scope: PayrollCalculationReadScope) {
  const scoped = readConfig(scope);
  const response = await axiosInstance.get<ApiResponse<unknown>>(runPath(runId), scoped);
  const run = selectPayrollCalculationRun(response.data.data);
  if (run.runId !== runId) throw new Error('Payroll run response does not match the request.');
  return run;
}

export function calculatePayrollRun(
  runId: string,
  body: PayrollActionCommand,
  authority: PayrollCalculationCommandAuthority
) {
  return mutate(runId, 'CALCULATE', body, authority, false);
}

export function approvePayrollRun(
  runId: string,
  body: PayrollActionCommand,
  authority: PayrollCalculationCommandAuthority
) {
  return mutate(runId, 'APPROVE', body, authority, true);
}

export function finalizePayrollRun(
  runId: string,
  body: PayrollActionCommand,
  authority: PayrollCalculationCommandAuthority
) {
  return mutate(runId, 'FINALIZE', body, authority, true);
}

export async function getPayrollCalculationReceipt(
  receiptId: string,
  scope: PayrollCalculationReadScope
) {
  const scoped = readConfig(scope);
  const response = await axiosInstance.get<ApiResponse<unknown>>(receiptPath(receiptId), scoped);
  const receipt = selectPayrollCalculationReceipt(response.data.data);
  if (receipt.receiptId !== receiptId) {
    throw new Error('Payroll receipt response does not match the request.');
  }
  return receipt;
}

async function mutate(
  runId: string,
  kind: PayrollCalculationCommandKind,
  body: PayrollActionCommand,
  authority: PayrollCalculationCommandAuthority,
  highRisk: boolean
) {
  assertUuid(runId, 'Payroll run identifier');
  validateCommandAuthority(authority, highRisk);
  const request = validatePayrollActionCommand(body);
  const governed = highRisk
    ? productSurfaceHighRiskMutationConfig(authority.governance, {
        objectVersionHeader: true,
      })
    : productSurfaceGovernedMutationConfig(authority.governance, {
        objectVersionHeader: true,
      });
  const response = await axiosInstance.post<ApiResponse<unknown>, PayrollActionCommand>(
    commandPath(runId, kind),
    request,
    {
      ...governed,
      headers: {
        ...governed.headers,
        'Idempotency-Key': authority.idempotencyKey,
        'X-Correlation-ID': authority.correlationId,
        'X-DWP-Expected-Object-Version': String(authority.expectedObjectVersion),
      },
      csrfReplay: 'NEVER',
    }
  );
  return selectPayrollCalculationReceipt(response.data.data, {
    kind,
    correlationId: authority.correlationId,
  });
}

function readConfig(scope: PayrollCalculationReadScope) {
  assertUuid(scope.correlationId, 'Payroll correlation identifier');
  const scoped = productSurfaceReadScopeConfig(scope.contextScopeKey, scope.signal);
  return {
    ...scoped,
    headers: {
      'X-Correlation-ID': scope.correlationId,
    },
  };
}

function validateCommandAuthority(
  authority: PayrollCalculationCommandAuthority,
  highRisk: boolean
) {
  assertUuid(authority.idempotencyKey, 'Payroll idempotency key');
  assertUuid(authority.correlationId, 'Payroll correlation identifier');
  if (
    !Number.isSafeInteger(authority.expectedObjectVersion) ||
    authority.expectedObjectVersion < 0
  ) {
    throw new Error('Payroll expected object version is invalid.');
  }
  if (highRisk && authority.governance.mode !== 'SECURE') {
    throw new Error('Payroll high-risk command authority requires step-up.');
  }
  if (authority.governance.mode === 'SECURE') {
    if (
      !authority.governance.contextScopeKey ||
      authority.governance.idempotencyKey !== authority.idempotencyKey ||
      authority.governance.objectVersion !== authority.expectedObjectVersion ||
      (highRisk && !authority.governance.stepUp)
    ) {
      throw new Error('Payroll command authority does not match the request.');
    }
  }
}

function commandPath(runId: string, kind: PayrollCalculationCommandKind) {
  const suffix = kind === 'CALCULATE' ? 'attempts' : kind === 'APPROVE' ? 'approvals' : 'finalize';
  return `${runPath(runId)}/${suffix}`;
}

function runPath(runId: string) {
  assertUuid(runId, 'Payroll run identifier');
  return `/api/payroll/v1/runs/${encodeURIComponent(runId)}`;
}

function receiptPath(receiptId: string) {
  assertUuid(receiptId, 'Payroll receipt identifier');
  return `/api/payroll/v1/command-receipts/${encodeURIComponent(receiptId)}`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function assertUuid(value: string, label: string): void {
  if (!UUID.test(value)) throw new Error(`${label} is invalid.`);
}

export const payrollCalculationDataSource: PayrollCalculationDataSource = Object.freeze({
  run: getPayrollCalculationRun,
  calculate: calculatePayrollRun,
  approve: approvePayrollRun,
  finalize: finalizePayrollRun,
  receipt: getPayrollCalculationReceipt,
});
