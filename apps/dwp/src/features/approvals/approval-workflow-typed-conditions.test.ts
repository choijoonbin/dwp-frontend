import { describe, expect, it } from 'vitest';

import { compileApprovalTypedForm } from './approval-form-typed-compiler';
import { validateApprovalTypedWorkflow } from './approval-workflow-typed-compiler';
import {
  approvalTypedWorkflowRouteFieldOptions,
  compileApprovalTypedWorkflowCondition,
  inspectApprovalTypedWorkflowRoleCodes,
  validateApprovalTypedWorkflowRouteFields,
} from './approval-workflow-typed-conditions';
import {
  APPROVAL_TYPED_WORKFLOW_CONTRACT,
  ApprovalTypedWorkflowError,
} from './approval-workflow-typed-model';

function workflow(condition?: unknown, candidateRole = 'FINANCE_REVIEWER') {
  return validateApprovalTypedWorkflow({
    schemaContract: APPROVAL_TYPED_WORKFLOW_CONTRACT,
    schemaVersion: 2,
    slaMinutes: 15,
    stages: [
      {
        key: 'FINANCE_REVIEW',
        name: 'Finance review',
        candidateRole,
        quorum: { mode: 'ANY' },
        slaMinutes: 15,
        predecessors: [],
        ...(condition === undefined ? {} : { routeCondition: condition }),
      },
    ],
  });
}
function clause(value: unknown, operator = 'GTE', field = 'amount') {
  return { all: [{ field, operator, value }] };
}
function field(key: string, type: string) {
  return { key, type, labelKo: key, labelEn: key };
}
async function form() {
  return compileApprovalTypedForm({
    schemaContract: 'DWP_APPROVAL_FORM_TYPED_V2',
    schemaVersion: 2,
    fields: [
      field('summary', 'TEXT'),
      field('amount', 'NUMBER'),
      { ...field('optional', 'TEXT'), visibleWhen: { op: 'EQ', field: 'summary', value: 'show' } },
      { ...field('lines', 'REPEATING_GROUP'), fields: [field('item', 'TEXT')] },
    ],
  });
}

describe('Java stage condition grammar and immutable typed field binding', () => {
  it('preserves 28-digit decimal strings without numeric coercion or source claims', async () => {
    const value = '12345678901234567890.12345678';
    const definition = workflow(clause(value));
    expect(definition.stages[0].routeCondition?.all[0].value).toBe(value);
    expect(validateApprovalTypedWorkflowRouteFields(definition)).toBe('SOURCE_UNKNOWN');
    expect(validateApprovalTypedWorkflowRouteFields(definition, await form())).toBe('FIELDS_VALID');
    expect(validateApprovalTypedWorkflowRouteFields(workflow())).toBe('NO_CONDITIONS');
  });

  it('preserves nonnumeric EQ/IN exact scalar types; it does not treat text as numbers', async () => {
    const condition = compileApprovalTypedWorkflowCondition(
      clause([true, 2, '2'], 'IN', 'summary'),
      'condition'
    );
    expect(condition.all[0].value).toEqual([true, 2, '2']);
    expect(validateApprovalTypedWorkflowRouteFields(workflow(condition), await form())).toBe(
      'FIELDS_VALID'
    );
    expect(() =>
      validateApprovalTypedWorkflowRouteFields(workflow(clause('20', 'GTE', 'summary')))
    ).not.toThrow();
    const schema = await form();
    expect(() =>
      validateApprovalTypedWorkflowRouteFields(workflow(clause('20', 'GTE', 'summary')), schema)
    ).toThrow(ApprovalTypedWorkflowError);
  });

  it.each(['unknown', 'lines', 'optional', 'item'])(
    'rejects absent/group/conditionally-visible/non-root field %s',
    async (key) => {
      const definition = workflow(clause('x', 'EQ', key));
      const schema = await form();
      expect(() => validateApprovalTypedWorkflowRouteFields(definition, schema)).toThrow(
        ApprovalTypedWorkflowError
      );
    }
  );

  it('offers only actual always-visible root fields from the compiled schema', async () => {
    expect(approvalTypedWorkflowRouteFieldOptions(await form()).map((item) => item.key)).toEqual([
      'summary',
      'amount',
    ]);
  });

  it.each(['1e2', '01', '.5', '+1', '1.123456789', '12345678901234567890123456789', '', true])(
    'rejects invalid numeric operand %j when the pinned field is numeric',
    async (value) => {
      const definition = workflow(clause(value));
      const schema = await form();
      expect(() => validateApprovalTypedWorkflowRouteFields(definition, schema)).toThrow(
        ApprovalTypedWorkflowError
      );
    }
  );

  it.each([
    2.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.MAX_SAFE_INTEGER + 1,
    null,
    { url: 'http://internal' },
    'bad\u007fvalue',
    'bad\nvalue',
    'x'.repeat(2001),
  ])('rejects unsafe or non-scalar JSON operand %#', (value) => {
    expect(() => compileApprovalTypedWorkflowCondition(clause(value), 'condition')).toThrow(
      ApprovalTypedWorkflowError
    );
  });

  it.each([
    { any: [] },
    { all: [] },
    { all: [{ field: 'amount', operator: 'GTE', value: 2, sourceId: 'fake' }] },
    clause([], 'IN'),
    clause(
      Array.from({ length: 51 }, () => 'x'),
      'IN'
    ),
    clause('x', 'EXECUTE'),
    clause('x', 'eq'),
    clause('x', 'EQ', 'lines.item'),
    clause('x', 'EQ', '$actor'),
  ])(
    'rejects extra keys, empty operands, group/system paths or unknown operators %#',
    (condition) => {
      expect(() => compileApprovalTypedWorkflowCondition(condition, 'condition')).toThrow(
        ApprovalTypedWorkflowError
      );
    }
  );

  it('enforces the 50-clause and existing canonical string-budget bounds', () => {
    expect(() =>
      compileApprovalTypedWorkflowCondition(
        {
          all: Array.from({ length: 51 }, () => ({ field: 'summary', operator: 'EQ', value: 'x' })),
        },
        'condition'
      )
    ).toThrow(ApprovalTypedWorkflowError);
    const condition = {
      all: Array.from({ length: 50 }, () => ({
        field: 'summary',
        operator: 'IN',
        value: Array.from({ length: 50 }, () => 'x'.repeat(81)),
      })),
    };
    expect(() => compileApprovalTypedWorkflowCondition(condition, 'condition')).toThrow(
      ApprovalTypedWorkflowError
    );
  });
});

describe('actual Auth ROLE_CODE references, not fake role or candidate authority', () => {
  it('keeps missing sources unknown and present references distinct from active/staffed authority', () => {
    expect(inspectApprovalTypedWorkflowRoleCodes(workflow()).status).toBe('SOURCE_UNKNOWN');
    expect(inspectApprovalTypedWorkflowRoleCodes(workflow(), ['FINANCE_REVIEWER']).status).toBe(
      'REFERENCES_PRESENT'
    );
    expect(inspectApprovalTypedWorkflowRoleCodes(workflow(), ['APPROVAL_OPERATOR'])).toEqual({
      status: 'MISSING_ROLES',
      missing: ['FINANCE_REVIEWER'],
    });
    expect(inspectApprovalTypedWorkflowRoleCodes(workflow(), [])).toEqual({
      status: 'MISSING_ROLES',
      missing: ['FINANCE_REVIEWER'],
    });
  });

  it('uses the Java identifier syntax but honors the actual Auth max50 source limit', () => {
    const role50 = 'R'.repeat(50);
    const role80 = 'R'.repeat(80);
    expect(
      inspectApprovalTypedWorkflowRoleCodes(workflow(undefined, role50), [role50]).status
    ).toBe('REFERENCES_PRESENT');
    expect(workflow(undefined, role80).stages[0].candidateRole).toBe(role80);
    expect(
      inspectApprovalTypedWorkflowRoleCodes(workflow(undefined, role80), [role80]).status
    ).toBe('INVALID_SOURCE');
  });

  it.each([
    { roles: ['finance_reviewer'] },
    { roles: ['FINANCE_REVIEWER', 'FINANCE_REVIEWER'] },
    { roles: new Array<string>(1) },
    { roles: Array.from({ length: 1001 }, (_, index) => `ROLE_${index}`) },
  ])('rejects malformed, duplicate, sparse or truncated-over-limit source %#', ({ roles }) => {
    expect(inspectApprovalTypedWorkflowRoleCodes(workflow(), roles).status).toBe('INVALID_SOURCE');
  });
});
