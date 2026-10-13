import { describe, expect, it } from 'vitest';

import {
  PAYROLL_ELEMENT_FORMULA_CONTRACT,
  PAYROLL_ELEMENT_FORMULA_OPERATION_BINDINGS,
  PAY_FORMULA_GOLDEN_CASES,
  PAY_FORMULA_REGISTRY_ID,
  PAY_FORMULA_SAFETY_LIMITS,
  payrollWorkbenchCanPublish,
  selectPayFormulaAst,
  selectPayrollConfigurationWorkbench,
  selectPayrollFormulaReceipt,
  validatePayFormulaAst,
  validateSimulationCommand,
} from '..';
import {
  PAY006_IDS,
  commandReceiptWire,
  workbenchWire,
} from '../testing/payroll-element-formula-fixtures.test-support';

import type { PayFormulaAst } from '..';

const CONTROL_AUTHORITY = '35931b47';

describe(`BASE-TFR-PAY-006 contract at Control ${CONTROL_AUTHORITY}`, () => {
  it('pins the independent configuration slice and its exact owner operations', () => {
    expect(PAYROLL_ELEMENT_FORMULA_CONTRACT).toEqual(
      expect.objectContaining({
        sliceId: 'BASE-TFR-PAY-006',
        formulaRegistry: 'PAY_RULE_AST_V1',
        commandResponse: 'PayrollCommandReceipt.v1',
        publicationEvent: 'PayrollConfigurationPublished.v1',
        stringFormulaAccepted: false,
        calculatesPayroll: false,
        productionActivation: false,
        population: ['LEGAL_ENTITY', 'PAY_GROUP'],
      })
    );
    expect(PAYROLL_ELEMENT_FORMULA_OPERATION_BINDINGS).toEqual([
      expect.objectContaining({
        contract: 'IAQ-055',
        permission: 'hcm.configuration.workbench.view',
        path: '/api/payroll/v1/workbench/settings-payroll',
      }),
      expect.objectContaining({ contract: 'PEP-PAY-004' }),
      expect.objectContaining({ contract: 'PEP-PAY-005' }),
      expect.objectContaining({ contract: 'PEP-PAY-006' }),
      expect.objectContaining({ contract: 'PEP-PAY-007' }),
      expect.objectContaining({
        contract: 'PEP-PAY-008',
        permission: 'hcm.configuration.policy.publish',
        path: '/api/payroll/v1/formulas/{formulaId}/publish',
      }),
    ]);
  });

  it('locks PAY-P-FORMULA registry, safety bounds and golden outcomes', () => {
    expect(PAY_FORMULA_REGISTRY_ID).toBe('PAY_RULE_AST_V1');
    expect(PAY_FORMULA_SAFETY_LIMITS).toEqual({
      maxNodes: 2_048,
      maxDepth: 64,
      maxTimeoutMillis: 2_000,
    });
    expect(PAY_FORMULA_GOLDEN_CASES).toMatchObject({
      moneyRateHalfUp: {
        money: '100.00',
        currency: 'TST',
        rate: '0.125',
        scale: 2,
        mode: 'HALF_UP',
        expected: '12.50',
      },
      rejectionCodes: {
        stringRoot: 'TYPE',
        cycle: 'CYCLE',
        mixedCurrency: 'CURRENCY_MISMATCH',
        mixedUnit: 'UNIT_MISMATCH',
        unknownFunction: 'FUNCTION_NOT_ALLOWED',
        timeout: 'TIMEOUT',
      },
    });
    expect(() => selectPayFormulaAst('basePay * 0.125')).toThrow(/TYPE/);

    const cyclic: PayFormulaAst = {
      registryId: PAY_FORMULA_REGISTRY_ID,
      registryVersion: 1,
      declaredReturnType: 'NUMBER',
      rootNodeId: 'a',
      nodes: [
        { nodeId: 'a', operator: 'ADD', arguments: ['b'], returnType: 'NUMBER' },
        { nodeId: 'b', operator: 'ADD', arguments: ['a'], returnType: 'NUMBER' },
      ],
    };
    expect(validatePayFormulaAst(cyclic)).toContainEqual({ code: 'CYCLE', nodeId: 'a' });
    expect(
      validateSimulationCommand({
        expectedVersion: 1,
        inputs: { basePay: { type: 'MONEY', value: '100.00', currency: 'TST' } },
        rounding: { scale: 2, mode: 'HALF_UP', increment: '0.01' },
        timeoutMillis: 2_001,
      })
    ).toEqual({ valid: false, errors: ['TIMEOUT_LIMIT'] });
  });

  it('accepts exact IAQ-055 state/action evidence and exact receipt-only mutation data', () => {
    const workbench = selectPayrollConfigurationWorkbench(workbenchWire());
    const receipt = selectPayrollFormulaReceipt(commandReceiptWire('PUBLISH_FORMULA'), {
      commandType: 'PUBLISH_FORMULA',
      correlationId: PAY006_IDS.correlation,
    });

    expect(workbench).toMatchObject({ projectionVersion: '1', variantKey: 'PAYROLL' });
    expect(workbench.items[0]?.deepLink.route).toBe('/hr/settings/payroll');
    expect(payrollWorkbenchCanPublish(workbench.items[0])).toBe(true);
    expect(receipt).toMatchObject({
      originatingAction: 'PAY_FORMULA_PUBLISH',
      purposeCode: 'PAYROLL_CONFIGURATION',
      status: 'SUCCEEDED',
    });
    expect(() =>
      selectPayrollFormulaReceipt({
        ...commandReceiptWire('PUBLISH_FORMULA'),
        publicationEvent: { type: 'PayrollConfigurationPublished' },
      })
    ).toThrow(/PayrollCommandReceipt\.v1/);
  });
});
