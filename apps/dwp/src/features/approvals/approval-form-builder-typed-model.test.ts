import { describe, expect, it } from 'vitest';
import {
  compileApprovalTypedForm,
  requireApprovalTypedSummary,
} from './approval-form-typed-compiler';
import { evaluateApprovalTypedForm } from './approval-form-typed-evaluator';
import {
  addTypedEditorField,
  canChangeTypedCalculationOperator,
  changeTypedEditorFieldType,
  canDuplicateTypedEditorField,
  duplicateTypedEditorField,
  moveTypedEditorField,
  patchTypedEditorField,
  removeTypedEditorField,
  typedEditorField,
  typedEditorSeed,
} from './approval-form-builder-typed-model';
import {
  advancedApprovalFormDraft,
  approvalFormEditorUpdateInput,
  captureApprovalFormEditorDraft,
} from './approval-form-editor-draft';
import { emptyFormDraft } from './approval-form-catalog-drafts';
import type {
  ApprovalTypedCalculation,
  ApprovalTypedFormSchema,
} from '@dwp-frontend/shared-utils/api/approval-form-typed-contract';

const seed = () => typedEditorSeed('요청 내용', 'Summary');
const definition = (): ApprovalTypedFormSchema => ({
  ...seed(),
  fields: [
    ...seed().fields,
    { key: 'amount', labelKo: '금액', labelEn: 'Amount', type: 'NUMBER' },
    {
      key: 'details',
      labelKo: '추가 내용',
      labelEn: 'Details',
      type: 'TEXT',
      visibleWhen: { op: 'GT', field: 'amount', value: '100.00000001' },
      requiredWhen: { op: 'GTE', field: 'amount', value: '200' },
    },
    {
      key: 'items',
      labelKo: '항목',
      labelEn: 'Items',
      type: 'REPEATING_GROUP',
      maxRows: 2,
      fields: [
        { key: 'price', labelKo: '가격', labelEn: 'Price', type: 'NUMBER' },
        {
          key: 'lineTotal',
          labelKo: '합계',
          labelEn: 'Line total',
          type: 'CALCULATED_NUMBER',
          calculation: { op: 'FIELD', field: 'price' },
        },
      ],
    },
    {
      key: 'total',
      labelKo: '총액',
      labelEn: 'Total',
      type: 'CALCULATED_NUMBER',
      calculation: { op: 'SUM', group: 'items', field: 'lineTotal' },
    },
  ],
});

describe('typed form authoring model', () => {
  it('copies exact scalar rules with a fresh bounded scope key and preserves source objects', async () => {
    const source = patchTypedEditorField(definition(), ['amount'], {
      min: '12345678901234567890.12345678',
    });
    const first = duplicateTypedEditorField(source, ['amount']);
    const second = duplicateTypedEditorField(first.schema, ['amount']);
    expect(first.path).toEqual(['amount_copy_1']);
    expect(second.path).toEqual(['amount_copy_2']);
    expect(typedEditorField(first.schema, first.path)).toHaveProperty(
      'min',
      '12345678901234567890.12345678'
    );
    expect(typedEditorField(first.schema, first.path)).not.toBe(
      typedEditorField(source, ['amount'])
    );
    expect(source.fields).toHaveLength(5);
    await expect(compileApprovalTypedForm(second.schema)).resolves.toHaveProperty('schemaSha256');
    const longKey = `a${'b'.repeat(79)}`;
    const long = seed();
    const result = duplicateTypedEditorField(
      {
        ...long,
        fields: [
          ...long.fields,
          { key: longKey, type: 'TEXT', labelKo: '긴 키', labelEn: 'Long key' },
        ],
      },
      [longKey]
    );
    expect(result.path[0]).toHaveLength(80);
    await expect(compileApprovalTypedForm(result.schema)).resolves.toHaveProperty('schemaSha256');
  });
  it('keeps copied group calculations local and never redirects existing external SUM references', async () => {
    const source = definition();
    const copy = duplicateTypedEditorField(source, ['items']);
    const copied = typedEditorField(copy.schema, copy.path);
    const original = typedEditorField(source, ['items']);
    expect(copied?.type === 'REPEATING_GROUP' && copied.fields).not.toBe(
      original?.type === 'REPEATING_GROUP' && original.fields
    );
    const compiled = await compileApprovalTypedForm(copy.schema);
    const result = evaluateApprovalTypedForm(
      compiled,
      { summary: 'Review', items: [{ price: '7' }], items_copy_1: [{ price: '9' }] },
      'SUBMIT'
    );
    expect(result.payload.total).toBe('7');
    expect((result.payload.items_copy_1 as Record<string, unknown>[])[0].lineTotal).toBe('9');
    const row = duplicateTypedEditorField(copy.schema, ['items_copy_1', 'lineTotal']);
    expect(row.path).toEqual(['items_copy_1', 'lineTotal_copy_1']);
    await expect(compileApprovalTypedForm(row.schema)).resolves.toHaveProperty('schemaSha256');
    expect(typedEditorField(source, ['items', 'lineTotal'])).toHaveProperty('calculation', {
      op: 'FIELD',
      field: 'price',
    });
  });
  it('blocks summary copies and enforces root50, row20 and global250 compiler cardinalities', () => {
    const source = definition();
    expect(duplicateTypedEditorField(source, ['summary']).schema).toBe(source);
    const field = (index: number) => ({
      key: `field${index}`,
      type: 'TEXT' as const,
      labelKo: '필드',
      labelEn: 'Field',
    });
    const full = {
      ...seed(),
      fields: [...seed().fields, ...Array.from({ length: 49 }, (_, i) => field(i))],
    };
    expect(canDuplicateTypedEditorField(full, ['field0'])).toBe(false);
    const rows = {
      ...seed(),
      fields: [
        ...seed().fields,
        {
          key: 'items',
          type: 'REPEATING_GROUP' as const,
          labelKo: '항목',
          labelEn: 'Items',
          fields: Array.from({ length: 20 }, (_, i) => field(i)),
        },
      ],
    };
    expect(duplicateTypedEditorField(rows, ['items', 'field0']).schema).toBe(rows);
    const budget = {
      ...seed(),
      fields: [
        ...seed().fields,
        ...Array.from({ length: 12 }, (_, i) => ({
          key: `group${i}`,
          type: 'REPEATING_GROUP' as const,
          labelKo: '항목',
          labelEn: 'Items',
          fields: Array.from({ length: i === 11 ? 17 : 20 }, (_, n) => field(n)),
        })),
      ],
    };
    expect(canDuplicateTypedEditorField(budget, ['group11', 'field0'])).toBe(false);
    expect(duplicateTypedEditorField(budget, ['group0']).schema).toBe(budget);
  });
  it('matches the compiler depth8 boundary including ROUND wrapping existing subtrees', async () => {
    let expression: ApprovalTypedCalculation = { op: 'CONST', value: '1' };
    for (let depth = 0; depth < 8; depth++)
      expression = { op: 'ROUND', args: [expression], scale: 2 };
    expect(canChangeTypedCalculationOperator(expression, 'ROUND', 0)).toBe(false);
    expect(canChangeTypedCalculationOperator({ op: 'CONST', value: '1' }, 'ROUND', 8)).toBe(false);
    expect(canChangeTypedCalculationOperator({ op: 'CONST', value: '1' }, 'ADD', 7)).toBe(true);
    const schema = {
      ...seed(),
      fields: [
        ...seed().fields,
        {
          key: 'result',
          type: 'CALCULATED_NUMBER' as const,
          labelKo: '결과',
          labelEn: 'Result',
          calculation: expression,
        },
      ],
    };
    await expect(compileApprovalTypedForm(schema)).resolves.toHaveProperty('schemaSha256');
    await expect(
      compileApprovalTypedForm({
        ...schema,
        fields: [
          ...seed().fields,
          { ...schema.fields[1], calculation: { op: 'ROUND', args: [expression], scale: 2 } },
        ],
      })
    ).rejects.toThrow();
  });
  it('creates an explicit V2 definition without changing legacy drafts', () => {
    const legacy = emptyFormDraft();
    const typed = advancedApprovalFormDraft(legacy);
    expect(typed).not.toHaveProperty('fields');
    expect(typed.typedSchema).toEqual(typedEditorSeed('요청 내용', 'Request summary'));
    expect(legacy).not.toHaveProperty('typedSchema');
    expect(approvalFormEditorUpdateInput(typed)).not.toHaveProperty('fields');
    expect(approvalFormEditorUpdateInput(legacy)).not.toHaveProperty('typedSchema');
  });
  it('locks the root summary key, type and visibility at the model boundary', () => {
    const source = seed();
    const changed = patchTypedEditorField(source, ['summary'], {
      key: 'renamed',
      type: 'NUMBER',
      visibleWhen: { op: 'PRESENT', field: 'amount' },
      labelEn: 'Updated',
    });
    expect(changed.fields[0]).toMatchObject({
      key: 'summary',
      type: 'TEXTAREA',
      labelEn: 'Updated',
    });
    expect(changed.fields[0]).not.toHaveProperty('visibleWhen');
    expect(removeTypedEditorField(source, ['summary'])).toBe(source);
    expect(changeTypedEditorFieldType(source, ['summary'], 'NUMBER')).toBe(source);
  });
  it('edits and reorders the exact row scope immutably', () => {
    const source = definition();
    const changed = patchTypedEditorField(source, ['items', 'price'], {
      min: '12345678901234567890.12345678',
    });
    expect(typedEditorField(changed, ['items', 'price'])).toHaveProperty(
      'min',
      '12345678901234567890.12345678'
    );
    expect(typedEditorField(source, ['items', 'price'])).not.toHaveProperty('min');
    expect(
      typedEditorField(moveTypedEditorField(changed, ['items', 'lineTotal'], -1), ['items'])?.type
    ).toBe('REPEATING_GROUP');
    expect(source.fields.map((field) => field.key)).toEqual([
      'summary',
      'amount',
      'details',
      'items',
      'total',
    ]);
  });
  it('prevents nested groups and respects per-scope cardinality', () => {
    const source = definition();
    expect(addTypedEditorField(source, 'REPEATING_GROUP', 'items').schema).toBe(source);
    expect(changeTypedEditorFieldType(source, ['items', 'price'], 'REPEATING_GROUP')).toBe(source);
    const full = {
      ...seed(),
      fields: Array.from({ length: 50 }, (_, index) => ({
        key: `field${index}`,
        labelKo: '이름',
        labelEn: 'Name',
        type: 'TEXT' as const,
      })),
    };
    expect(addTypedEditorField(full, 'NUMBER').schema).toBe(full);
  });
  it('resets incompatible type-specific rules while preserving key and metadata', () => {
    const source = patchTypedEditorField(definition(), ['amount'], {
      min: '0',
      max: '9999999999999999999999999999',
    });
    const next = changeTypedEditorFieldType(source, ['amount'], 'SELECT');
    expect(typedEditorField(next, ['amount'])).toEqual({
      key: 'amount',
      labelKo: '금액',
      labelEn: 'Amount',
      type: 'SELECT',
      options: [],
    });
    expect(typedEditorField(source, ['amount'])).toHaveProperty('min', '0');
  });
  it('uses actual scoped conditions, row calculations and 28-digit canonical strings', async () => {
    const compiled = await compileApprovalTypedForm(definition());
    requireApprovalTypedSummary(compiled);
    const result = evaluateApprovalTypedForm(
      compiled,
      {
        summary: 'Review',
        amount: '100.00000001',
        items: [{ price: '12345678901234567890.12345678' }],
      },
      'SUBMIT'
    );
    expect(result.visibleFields).not.toContain('details');
    expect(result.payload.total).toBe('12345678901234567890.12345678');
    expect((result.payload.items as Record<string, unknown>[])[0].lineTotal).toBe(
      '12345678901234567890.12345678'
    );
    expect(() =>
      evaluateApprovalTypedForm(compiled, { summary: 'Review', amount: '200' }, 'SUBMIT')
    ).toThrow();
    expect(() =>
      evaluateApprovalTypedForm(
        compiled,
        { summary: 'Review', items: [{ price: '1', lineTotal: '2' }] },
        'SUBMIT'
      )
    ).toThrow();
  });
  it('closes validation on dangling dependencies instead of silently remapping', async () => {
    await expect(
      compileApprovalTypedForm(removeTypedEditorField(definition(), ['items', 'price']))
    ).rejects.toThrow();
  });
  it('captures only the immutable compiled definition and never saves before compilation', async () => {
    const typed = advancedApprovalFormDraft(emptyFormDraft());
    expect(captureApprovalFormEditorDraft(typed, null)).toBeNull();
    const compiled = await compileApprovalTypedForm(typed.typedSchema);
    const snapshot = captureApprovalFormEditorDraft(typed, compiled);
    expect(snapshot?.typedSchema).toBe(compiled.definition);
    expect(Object.isFrozen(snapshot?.typedSchema)).toBe(true);
  });
});
