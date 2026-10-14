import { describe, expect, it } from 'vitest';

import {
  PAYROLL_CALCULATION_OPERATION_BINDINGS,
  orderPayrollRunsExceptionFirst,
  payrollRunCommandAvailability,
  selectPayrollCalculationReceipt,
  selectPayrollCalculationRun,
  validatePayrollActionCommand,
} from './payroll-calculation-contract';

const ids = Object.freeze({
  run: '10000000-0000-4000-8000-000000000001',
  period: '10000000-0000-4000-8000-000000000002',
  receipt: '10000000-0000-4000-8000-000000000003',
  subject: '10000000-0000-4000-8000-000000000004',
  correlation: '10000000-0000-4000-8000-000000000005',
});

function run(overrides: Record<string, unknown> = {}) {
  return {
    runId: ids.run,
    runType: 'REGULAR',
    payPeriodId: ids.period,
    state: 'READY',
    workerCount: 24,
    gross: { amount: '120000.2500', currency: 'USD' },
    net: { amount: '95500.1000', currency: 'USD' },
    version: 7,
    ...overrides,
  };
}

function receipt(overrides: Record<string, unknown> = {}) {
  return {
    receiptId: ids.receipt,
    commandType: 'RUN_CALCULATE',
    originatingAction: 'PAY_RUN_CALCULATE',
    subjectPrincipalPublicId: ids.subject,
    populationScopeDigest: 'a'.repeat(64),
    fieldPolicyRevision: 41,
    purposeCode: 'PAYROLL_PROCESSING',
    authorizationRevision: 41,
    status: 'RUNNING',
    correlationId: ids.correlation,
    requestDigest: 'b'.repeat(64),
    createdAt: '2026-10-14T05:00:00Z',
    aggregateVersion: 8,
    resultRef: 'payroll-run:attempt:8',
    ...overrides,
  };
}

describe('PAY-011 closed transport model', () => {
  it('pins the five exact PEP operations, purposes, step-up and SoD policy', () => {
    expect(PAYROLL_CALCULATION_OPERATION_BINDINGS).toMatchObject([
      { contractId: 'PEP-PAY-012', purpose: 'PAYROLL_PROCESSING', stepUp: false },
      { contractId: 'PEP-PAY-013', method: 'GET' },
      {
        contractId: 'PEP-PAY-017',
        stepUp: true,
        segregationOfDuties: 'RUN_MAKER_NE_APPROVER',
      },
      {
        contractId: 'PEP-PAY-018',
        stepUp: true,
        segregationOfDuties: 'RUN_MAKER_NE_FINALIZER',
      },
      { contractId: 'PEP-PAY-033', purpose: 'COMMAND_STATUS', contextMismatch: 'OPAQUE_404' },
    ]);
  });

  it('selects only the closed canonical RunResponse and PostedMoney shape', () => {
    expect(selectPayrollCalculationRun(run())).toEqual(run());
    expect(() => selectPayrollCalculationRun(run({ attemptNumber: 2 }))).toThrow(
      /PAY-011 transport source/
    );
    expect(() =>
      selectPayrollCalculationRun(run({ gross: { amount: '1e3', currency: 'USD' } }))
    ).toThrow(/run\.gross\.amount/);
    expect(
      selectPayrollCalculationRun(run({ net: { amount: '1.00', currency: 'EUR' } })).net
    ).toEqual({ amount: '1.00', currency: 'EUR' });
  });

  it('selects the exact receipt pair, six statuses and optional recovery evidence', () => {
    for (const status of [
      'ACCEPTED',
      'RUNNING',
      'SUCCEEDED',
      'REJECTED',
      'FAILED',
      'RESULT_UNKNOWN',
    ] as const) {
      expect(
        selectPayrollCalculationReceipt(receipt({ status }), {
          kind: 'CALCULATE',
          correlationId: ids.correlation,
        }).status
      ).toBe(status);
    }
    expect(selectPayrollCalculationReceipt(receipt()).resultRef).toBe('payroll-run:attempt:8');
    expect(() =>
      selectPayrollCalculationReceipt(receipt({ originatingAction: 'PAY_RUN_APPROVE' }))
    ).toThrow(/receipt\.binding/);
    expect(() => selectPayrollCalculationReceipt({ ...receipt(), event: {} })).toThrow(
      /PAY-011 transport source/
    );
  });

  it('validates closed action commands without expectedVersion or authority claims', () => {
    expect(
      validatePayrollActionCommand({
        reasonCode: 'PAYROLL_CALCULATION',
        approvalReceiptId: ids.receipt,
        comment: 'Reconcile frozen input.',
      })
    ).toEqual({
      reasonCode: 'PAYROLL_CALCULATION',
      approvalReceiptId: ids.receipt,
      comment: 'Reconcile frozen input.',
    });
    expect(() =>
      validatePayrollActionCommand({
        reasonCode: 'PAYROLL_CALCULATION',
        expectedVersion: 7,
      } as never)
    ).toThrow(/command/);
  });

  it('applies action-command length limits in Unicode code points', () => {
    expect(validatePayrollActionCommand({ reasonCode: '💰'.repeat(64) }).reasonCode).toHaveLength(
      128
    );
    expect(() => validatePayrollActionCommand({ reasonCode: '💰'.repeat(65) })).toThrow(
      /command\.reasonCode/
    );
  });

  it('orders exceptions first and exposes only valid state transitions', () => {
    const ready = selectPayrollCalculationRun(run());
    const failed = selectPayrollCalculationRun(
      run({ runId: '10000000-0000-4000-8000-000000000011', state: 'FAILED' })
    );
    const unknown = selectPayrollCalculationRun(
      run({ runId: '10000000-0000-4000-8000-000000000012', state: 'RESULT_UNKNOWN' })
    );
    expect(
      orderPayrollRunsExceptionFirst([ready, failed, unknown]).map((item) => item.state)
    ).toEqual(['RESULT_UNKNOWN', 'FAILED', 'READY']);
    expect(payrollRunCommandAvailability(ready)).toEqual({
      calculate: true,
      approve: false,
      finalize: false,
      uncertain: false,
    });
  });
});
