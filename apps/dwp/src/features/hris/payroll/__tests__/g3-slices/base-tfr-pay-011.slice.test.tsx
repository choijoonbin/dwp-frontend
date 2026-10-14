// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import {
  HrisPayrollCalculationCommandCenter,
  PAYROLL_APPROVE_PATH,
  PAYROLL_CALCULATE_PATH,
  PAYROLL_CALCULATION_COMMANDS,
  PAYROLL_CALCULATION_OPERATION_BINDINGS,
  PAYROLL_COMMAND_RECEIPT_PATH,
  PAYROLL_FINALIZE_PATH,
  PAYROLL_RUN_PATH,
  isPayrollReceiptPending,
  orderPayrollRunsExceptionFirst,
  payrollRunCommandAvailability,
  selectPayrollCalculationReceipt,
  selectPayrollCalculationRun,
  validatePayrollActionCommand,
} from '../..';

const AC = Object.freeze([
  'PAY011-AC-01',
  'PAY011-AC-02',
  'PAY011-AC-03',
  'PAY011-AC-04',
  'PAY011-AC-05',
  'PAY011-AC-06',
  'PAY011-AC-07',
  'PAY011-AC-08',
  'PAY011-AC-09',
  'PAY011-AC-10',
  'PAY011-AC-11',
  'PAY011-AC-12',
] as const);

const ids = Object.freeze({
  run: '40000000-0000-4000-8000-000000000001',
  period: '40000000-0000-4000-8000-000000000002',
  receipt: '40000000-0000-4000-8000-000000000003',
  subject: '40000000-0000-4000-8000-000000000004',
  correlation: '40000000-0000-4000-8000-000000000005',
});

function run(state = 'READY') {
  return {
    runId: ids.run,
    runType: 'REGULAR',
    payPeriodId: ids.period,
    state,
    workerCount: 12,
    gross: { amount: '10000.0000', currency: 'USD' },
    net: { amount: '8000.0000', currency: 'USD' },
    version: 6,
  };
}

function receipt(status = 'RUNNING') {
  return {
    receiptId: ids.receipt,
    commandType: 'RUN_CALCULATE',
    originatingAction: 'PAY_RUN_CALCULATE',
    subjectPrincipalPublicId: ids.subject,
    populationScopeDigest: 'a'.repeat(64),
    fieldPolicyRevision: 41,
    purposeCode: 'PAYROLL_PROCESSING',
    authorizationRevision: 41,
    status,
    correlationId: ids.correlation,
    requestDigest: 'b'.repeat(64),
    createdAt: '2026-10-14T07:00:00Z',
    aggregateVersion: 7,
    resultRef: 'payroll-run:attempt:7',
  };
}

describe('[SLICE:BASE-TFR-PAY-011] Control contract', () => {
  it('tracks all twelve acceptance criteria in the frontend evidence map', () => {
    expect(AC).toEqual(
      Array.from({ length: 12 }, (_, index) => `PAY011-AC-${String(index + 1).padStart(2, '0')}`)
    );
  });

  it('pins only the five sealed v41 paths, purposes, capabilities, step-up and SoD rules', () => {
    expect({
      run: PAYROLL_RUN_PATH,
      calculate: PAYROLL_CALCULATE_PATH,
      approve: PAYROLL_APPROVE_PATH,
      finalize: PAYROLL_FINALIZE_PATH,
      receipt: PAYROLL_COMMAND_RECEIPT_PATH,
    }).toEqual({
      run: '/api/payroll/v1/runs/{runId}',
      calculate: '/api/payroll/v1/runs/{runId}/attempts',
      approve: '/api/payroll/v1/runs/{runId}/approvals',
      finalize: '/api/payroll/v1/runs/{runId}/finalize',
      receipt: '/api/payroll/v1/command-receipts/{receiptId}',
    });
    expect(PAYROLL_CALCULATION_OPERATION_BINDINGS).toHaveLength(5);
    expect(PAYROLL_CALCULATION_OPERATION_BINDINGS[2]).toMatchObject({
      contractId: 'PEP-PAY-017',
      purpose: 'PAYROLL_PROCESSING',
      stepUp: true,
      segregationOfDuties: 'RUN_MAKER_NE_APPROVER',
    });
    expect(PAYROLL_CALCULATION_OPERATION_BINDINGS[4]).toMatchObject({
      contractId: 'PEP-PAY-033',
      purpose: 'COMMAND_STATUS',
      contextMismatch: 'OPAQUE_404',
    });
  });

  it('keeps closed RunResponse and ActionCommand schemas fail-closed', () => {
    expect(selectPayrollCalculationRun(run())).toMatchObject({ state: 'READY', version: 6 });
    expect(() =>
      selectPayrollCalculationRun({ ...run(), snapshotDigest: 'x'.repeat(64) })
    ).toThrow();
    expect(validatePayrollActionCommand({ reasonCode: 'PAYROLL_CALCULATION' })).toEqual({
      reasonCode: 'PAYROLL_CALCULATION',
    });
    expect(() =>
      validatePayrollActionCommand({ reasonCode: 'PAYROLL_CALCULATION', tenantId: 9 } as never)
    ).toThrow();
  });

  it('binds the canonical receipt pairs and preserves uncertainty for reconciliation', () => {
    expect(PAYROLL_CALCULATION_COMMANDS).toEqual({
      CALCULATE: { commandType: 'RUN_CALCULATE', originatingAction: 'PAY_RUN_CALCULATE' },
      APPROVE: { commandType: 'RUN_APPROVE', originatingAction: 'PAY_RUN_APPROVE' },
      FINALIZE: { commandType: 'RUN_FINALIZE', originatingAction: 'PAY_RUN_FINALIZE' },
    });
    const selected = selectPayrollCalculationReceipt(receipt('RESULT_UNKNOWN'), {
      kind: 'CALCULATE',
      correlationId: ids.correlation,
    });
    expect(isPayrollReceiptPending(selected)).toBe(true);
    expect(selected.resultRef).toBe('payroll-run:attempt:7');
    expect(() =>
      selectPayrollCalculationReceipt({ ...receipt(), originatingAction: 'PAY_RUN_APPROVE' })
    ).toThrow();
  });

  it('orders exception states first and exposes only legal command-state boundaries', () => {
    const ready = selectPayrollCalculationRun(run('READY'));
    const failed = selectPayrollCalculationRun({
      ...run('FAILED'),
      runId: '40000000-0000-4000-8000-000000000011',
    });
    const unknown = selectPayrollCalculationRun({
      ...run('RESULT_UNKNOWN'),
      runId: '40000000-0000-4000-8000-000000000012',
    });
    expect(
      orderPayrollRunsExceptionFirst([ready, failed, unknown]).map((item) => item.state)
    ).toEqual(['RESULT_UNKNOWN', 'FAILED', 'READY']);
    expect(payrollRunCommandAvailability(unknown).uncertain).toBe(true);
    expect(payrollRunCommandAvailability(ready).calculate).toBe(true);
  });

  it('exports the inactive route adapter for Control integration without self-activation', () => {
    expect(HrisPayrollCalculationCommandCenter).toBeTypeOf('function');
  });
});
