import { describe, expect, it } from 'vitest';

import {
  PAYROLL_ELEMENT_FORMULA_CONTRACT,
  PAY_FORMULA_GOLDEN_CASES,
  PAY_FORMULA_REGISTRY_ID,
  PAY_FORMULA_SAFETY_LIMITS,
  selectPayFormulaAst,
  validatePayFormulaAst,
  validateSimulationCommand,
} from './payroll-element-formula-model';

import type { PayFormulaAst, PayFormulaNode } from './payroll-element-formula-model';

const roundingRef = Object.freeze({
  owner: 'PAY' as const,
  schemaId: 'pay.rounding-policy.v1',
  publicId: '10000000-0000-4000-8000-000000000001',
  revision: 1,
  contentHash: 'a'.repeat(64),
});

function ast(nodes?: readonly PayFormulaNode[]): PayFormulaAst {
  return {
    registryId: PAY_FORMULA_REGISTRY_ID,
    registryVersion: 1,
    declaredReturnType: 'MONEY',
    rootNodeId: 'rounded_total',
    nodes: nodes ?? [
      {
        nodeId: 'base_pay',
        operator: 'INPUT',
        arguments: [],
        returnType: 'MONEY',
        inputKey: 'basePay',
        currency: 'XTS',
      },
      {
        nodeId: 'allowance',
        operator: 'LITERAL',
        arguments: [],
        returnType: 'MONEY',
        value: '125.25000000',
        currency: 'XTS',
      },
      {
        nodeId: 'gross',
        operator: 'ADD',
        arguments: ['base_pay', 'allowance'],
        returnType: 'MONEY',
        currency: 'XTS',
      },
      {
        nodeId: 'rounded_total',
        operator: 'ROUND',
        arguments: ['gross'],
        returnType: 'MONEY',
        currency: 'XTS',
        roundingRef,
      },
    ],
  };
}

describe('PAY-P-FORMULA closed typed AST', () => {
  it('accepts a bounded typed money graph and preserves canonical decimal strings', () => {
    const selected = selectPayFormulaAst(ast());

    expect(selected.registryId).toBe('PAY_RULE_AST_V1');
    expect(selected.nodes[1]?.value).toBe('125.25000000');
    expect(selected.nodes[3]?.roundingRef).toEqual(roundingRef);
    expect(validatePayFormulaAst(selected)).toEqual([]);
  });

  it('rejects a string formula instead of parsing or executing it', () => {
    expect(() =>
      selectPayFormulaAst({
        registryId: 'PAY_RULE_AST_V1',
        registryVersion: 1,
        declaredReturnType: 'MONEY',
        rootNodeId: 'root',
        nodes: [],
        expression: 'java.lang.Runtime.getRuntime().exec("curl attacker")',
      })
    ).toThrow(/TYPE/);
  });

  it('reports CYCLE without recursing indefinitely', () => {
    const cyclic: PayFormulaAst = {
      ...ast(),
      rootNodeId: 'a',
      nodes: [
        {
          nodeId: 'a',
          operator: 'ADD',
          arguments: ['b'],
          returnType: 'MONEY',
          currency: 'XTS',
        },
        {
          nodeId: 'b',
          operator: 'ADD',
          arguments: ['a'],
          returnType: 'MONEY',
          currency: 'XTS',
        },
      ],
    };

    expect(validatePayFormulaAst(cyclic)).toContainEqual({ code: 'CYCLE', nodeId: 'a' });
  });

  it('rejects mixed currencies for unit-preserving operators', () => {
    const mixed: PayFormulaAst = {
      ...ast(),
      rootNodeId: 'total',
      nodes: [
        {
          nodeId: 'left',
          operator: 'LITERAL',
          arguments: [],
          returnType: 'MONEY',
          value: '1.00',
          currency: 'XTS',
        },
        {
          nodeId: 'right',
          operator: 'LITERAL',
          arguments: [],
          returnType: 'MONEY',
          value: '1.00',
          currency: 'XUA',
        },
        {
          nodeId: 'total',
          operator: 'ADD',
          arguments: ['left', 'right'],
          returnType: 'MONEY',
          currency: 'XTS',
        },
      ],
    };

    expect(validatePayFormulaAst(mixed)).toContainEqual({
      code: 'CURRENCY_MISMATCH',
      nodeId: 'total',
    });
  });

  it('distinguishes unit mismatch and rejects functions outside the registry', () => {
    const mixedUnits: PayFormulaAst = {
      ...ast(),
      rootNodeId: 'total',
      nodes: [
        {
          nodeId: 'money',
          operator: 'INPUT',
          arguments: [],
          returnType: 'MONEY',
          inputKey: 'money',
          currency: 'TST',
        },
        {
          nodeId: 'hours',
          operator: 'INPUT',
          arguments: [],
          returnType: 'QUANTITY_HOUR',
          inputKey: 'hours',
        },
        {
          nodeId: 'total',
          operator: 'ADD',
          arguments: ['money', 'hours'],
          returnType: 'MONEY',
          currency: 'TST',
        },
      ],
    };
    const unknown = { ...ast().nodes[0], operator: 'EVAL' } as unknown as PayFormulaNode;

    expect(validatePayFormulaAst(mixedUnits)).toContainEqual({
      code: 'UNIT_MISMATCH',
      nodeId: 'total',
    });
    expect(validatePayFormulaAst({ ...ast(), nodes: [unknown] })).toContainEqual({
      code: 'FUNCTION_NOT_ALLOWED',
      nodeId: 'base_pay',
    });
    expect(() => selectPayFormulaAst({ ...ast(), nodes: [unknown] })).toThrow(
      /FUNCTION_NOT_ALLOWED/
    );
  });

  it('enforces rounding inputs and the sandbox timeout ceiling', () => {
    expect(
      validateSimulationCommand({
        expectedVersion: 1,
        inputs: { basePay: { type: 'MONEY', value: '7500.000000', currency: 'XTS' } },
        rounding: { scale: 2, mode: 'HALF_EVEN', increment: '0.01' },
        timeoutMillis: PAY_FORMULA_SAFETY_LIMITS.maxTimeoutMillis + 1,
      })
    ).toEqual(expect.objectContaining({ valid: false, errors: ['TIMEOUT_LIMIT'] }));

    expect(
      validateSimulationCommand({
        expectedVersion: 1,
        inputs: { basePay: { type: 'MONEY', value: '7500.000000', currency: 'XTS' } },
        rounding: { scale: 2, mode: 'HALF_EVEN', increment: '0.01' },
        timeoutMillis: 250,
      })
    ).toEqual({ valid: true, errors: [] });
  });

  it('pins the bounded configuration slice and exact permissions', () => {
    expect(PAYROLL_ELEMENT_FORMULA_CONTRACT).toMatchObject({
      sliceId: 'BASE-TFR-PAY-006',
      formulaRegistry: 'PAY_RULE_AST_V1',
      stringFormulaAccepted: false,
      calculatesPayroll: false,
      productionActivation: false,
      commandResponse: 'PayrollCommandReceipt.v1',
      publicationEvent: 'PayrollConfigurationPublished.v1',
      permissions: {
        workbench: 'hcm.configuration.workbench.view',
        author: 'hcm.operations.payroll-inputs.update',
        publish: 'hcm.configuration.policy.publish',
      },
    });
    expect(PAY_FORMULA_GOLDEN_CASES.moneyRateHalfUp).toEqual({
      money: '100.00',
      currency: 'TST',
      rate: '0.125',
      scale: 2,
      mode: 'HALF_UP',
      expected: '12.50',
    });
  });
});
