import { describe, expect, it } from 'vitest';

import {
  selectPayrollFormulaReceipt,
  selectSuccessfulPayrollFormulaReceipt,
} from './payroll-element-formula-wire';
import {
  PAY006_IDS,
  commandReceiptWire,
} from '../testing/payroll-element-formula-fixtures.test-support';

describe('PayrollCommandReceipt.v1 wire', () => {
  it('accepts the exact 12-field canonical receipt and request binding', () => {
    const selected = selectPayrollFormulaReceipt(commandReceiptWire('VALIDATE_FORMULA'), {
      correlationId: PAY006_IDS.correlation,
      commandType: 'VALIDATE_FORMULA',
    });

    expect(Object.keys(selected)).toHaveLength(12);
    expect(selected).toMatchObject({
      receiptId: PAY006_IDS.receipt,
      originatingAction: 'PAY_FORMULA_VALIDATE',
      purposeCode: 'PAYROLL_CONFIGURATION',
      status: 'SUCCEEDED',
    });
  });

  it('parses the complete status domain so callers can fail closed', () => {
    for (const status of [
      'ACCEPTED',
      'RUNNING',
      'SUCCEEDED',
      'REJECTED',
      'FAILED',
      'RESULT_UNKNOWN',
    ] as const) {
      expect(
        selectPayrollFormulaReceipt(commandReceiptWire('SIMULATE_FORMULA', { status })).status
      ).toBe(status);
    }
    expect(() =>
      selectSuccessfulPayrollFormulaReceipt(
        commandReceiptWire('SIMULATE_FORMULA', { status: 'RESULT_UNKNOWN' }),
        {
          correlationId: PAY006_IDS.correlation,
          commandType: 'SIMULATE_FORMULA',
        }
      )
    ).toThrow(/receipt\.status\.RESULT_UNKNOWN/);
  });

  it('rejects composite resource and inline outbox-event responses', () => {
    expect(() =>
      selectPayrollFormulaReceipt({
        ...commandReceiptWire(),
        formula: { formulaId: PAY006_IDS.formula },
      })
    ).toThrow(/PayrollCommandReceipt\.v1/);
    expect(() =>
      selectPayrollFormulaReceipt({
        ...commandReceiptWire('PUBLISH_FORMULA'),
        publicationEvent: { type: 'PayrollConfigurationPublished' },
      })
    ).toThrow(/PayrollCommandReceipt\.v1/);
  });

  it('rejects action, command, correlation and noncanonical field substitution', () => {
    expect(() =>
      selectPayrollFormulaReceipt(
        commandReceiptWire('VALIDATE_FORMULA', {
          originatingAction: 'PAY_FORMULA_PUBLISH',
        })
      )
    ).toThrow(/originatingAction/);
    expect(() =>
      selectPayrollFormulaReceipt(commandReceiptWire('VALIDATE_FORMULA'), {
        correlationId: PAY006_IDS.correlation,
        commandType: 'PUBLISH_FORMULA',
      })
    ).toThrow(/expectation/);
    expect(() =>
      selectPayrollFormulaReceipt(commandReceiptWire('VALIDATE_FORMULA'), {
        correlationId: '30000000-0000-4000-8000-000000000099',
        commandType: 'VALIDATE_FORMULA',
      })
    ).toThrow(/expectation/);
    expect(() =>
      selectPayrollFormulaReceipt({ ...commandReceiptWire(), commandId: PAY006_IDS.command })
    ).toThrow(/PayrollCommandReceipt\.v1/);
  });

  it('preserves stable receipt and request digest identity on a replay', () => {
    const first = selectPayrollFormulaReceipt(commandReceiptWire('PUBLISH_FORMULA'));
    const replay = selectPayrollFormulaReceipt(commandReceiptWire('PUBLISH_FORMULA'));

    expect(replay.receiptId).toBe(first.receiptId);
    expect(replay.requestDigest).toBe(first.requestDigest);
  });
});
