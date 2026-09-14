import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import fixture from './__fixtures__/approval-form-typed-parity.json';
import {
  compileApprovalTypedForm,
  requireApprovalTypedSummary,
} from './approval-form-typed-compiler';
import {
  evaluateApprovalTypedForm,
  withoutApprovalTypedComputedValues,
} from './approval-form-typed-evaluator';
import { ApprovalTypedFormError, typedDate, typedDecimal } from './approval-form-typed-model';

type RawField = Record<string, unknown>;
function schemaCopy(): { schemaContract: string; schemaVersion: number; fields: RawField[] } {
  return structuredClone(fixture.schema) as {
    schemaContract: string;
    schemaVersion: number;
    fields: RawField[];
  };
}
function calculated(
  op: string,
  left: string,
  right?: string,
  scale?: number
): ReturnType<typeof schemaCopy> {
  const schema = schemaCopy();
  const field = schema.fields.find((item) => item.key === 'total')!;
  field.calculation = {
    op,
    args: [
      { op: 'CONST', value: left },
      ...(right === undefined ? [] : [{ op: 'CONST', value: right }]),
    ],
    ...(scale === undefined ? {} : { scale }),
  };
  field.required = false;
  schema.fields = [field];
  return schema;
}

describe('typed V2 cross-runtime golden contract', () => {
  it('pins the complete shared fixture bytes and the independently compiled schema hash', async () => {
    const raw = readFileSync(
      new URL('./__fixtures__/approval-form-typed-parity.json', import.meta.url)
    );
    expect(createHash('sha256').update(raw).digest('hex')).toBe(
      '5867525b45e2eee0d90f9f36d6903f8a03c74561c639a6c5169104b43e55a9a4'
    );
    const compiled = await compileApprovalTypedForm(fixture.schema);
    expect(compiled.schemaSha256).toBe(
      '0326a781da96bba19de66643543402efd3258b56e90e6ad81c9f57b38a046b7f'
    );
    expect(compiled.schemaSha256).toBe(fixture.schemaSha256);
  });

  it.each(fixture.cases)('$name', async (test) => {
    const schema = await compileApprovalTypedForm(fixture.schema);
    const result = evaluateApprovalTypedForm(
      schema,
      test.input,
      test.submitting ? 'SUBMIT' : 'DRAFT'
    );
    expect(result.payload).toEqual(test.expectedPayload);
    expect(result.visibleFields).toEqual([...test.expectedVisible].sort());
    expect(result.requiredFields).toEqual([...test.expectedRequired].sort());
    expect(result.schemaSha256).toBe(fixture.schemaSha256);
    expect(Object.isFrozen(result.payload)).toBe(true);
    expect(Object.isFrozen(result.visibleFields)).toBe(true);
  });

  it.each(fixture.invalidCases)('$name', async (test) => {
    const schema = await compileApprovalTypedForm(fixture.schema);
    expect(() =>
      evaluateApprovalTypedForm(schema, test.input, test.submitting ? 'SUBMIT' : 'DRAFT')
    ).toThrow(ApprovalTypedFormError);
  });

  it('does not mutate inputs, arrays or compiled definitions, and ignores object key order only', async () => {
    const input = structuredClone(fixture.cases[0]!.input);
    const before = structuredClone(input);
    const definition = schemaCopy();
    const compiled = await compileApprovalTypedForm(definition);
    definition.fields[0]!.labelEn = 'Mutated';
    evaluateApprovalTypedForm(compiled, input, 'SUBMIT');
    expect(input).toEqual(before);
    expect(compiled.definition.fields[0]!.labelEn).toBe('Category');
    const reversedKeys = Object.fromEntries(Object.entries(fixture.schema).reverse());
    expect((await compileApprovalTypedForm(reversedKeys)).schemaSha256).toBe(compiled.schemaSha256);
    const reordered = schemaCopy();
    reordered.fields.reverse();
    expect((await compileApprovalTypedForm(reordered)).schemaSha256).not.toBe(
      compiled.schemaSha256
    );
  });
});

describe('typed schema fail-closed boundaries', () => {
  it.each([undefined, 'UNKNOWN', 'DWP_APPROVAL_FORM_TYPED_V1'])(
    'does not dispatch unmarked or unknown contracts %s into V2',
    async (marker) => {
      const schema = schemaCopy();
      const raw = { ...schema, schemaContract: marker };
      if (marker === undefined) delete raw.schemaContract;
      await expect(compileApprovalTypedForm(raw)).rejects.toThrow(ApprovalTypedFormError);
      await expect(compileApprovalTypedForm({ ...schema, schemaVersion: 1 })).rejects.toThrow(
        ApprovalTypedFormError
      );
    }
  );

  it('requires visible root summary only for stored authoring schemas', async () => {
    const schema = schemaCopy();
    const generic = await compileApprovalTypedForm(schema);
    expect(() => requireApprovalTypedSummary(generic)).toThrow(ApprovalTypedFormError);
    schema.fields.push({
      key: 'summary',
      type: 'TEXTAREA',
      labelKo: 'Summary',
      labelEn: 'Summary',
      required: true,
    });
    const stored = await compileApprovalTypedForm(schema);
    expect(() => requireApprovalTypedSummary(stored)).not.toThrow();
    schema.fields.at(-1)!.visibleWhen = { op: 'PRESENT', field: 'category' };
    expect(() => requireApprovalTypedSummary(stored)).not.toThrow();
    const hidden = await compileApprovalTypedForm(schema);
    expect(() => requireApprovalTypedSummary(hidden)).toThrow(ApprovalTypedFormError);
  });

  it.each(['missing', 'items.quantity', 'constructor'])(
    'rejects dangling and cross-scope references %s',
    async (field) => {
      const schema = schemaCopy();
      schema.fields[1]!.visibleWhen = { op: 'PRESENT', field };
      await expect(compileApprovalTypedForm(schema)).rejects.toThrow(ApprovalTypedFormError);
    }
  );

  it('rejects root, group and row dependency cycles', async () => {
    for (const scenario of ['root', 'group', 'row']) {
      const schema = schemaCopy();
      if (scenario === 'root') schema.fields[0]!.visibleWhen = { op: 'PRESENT', field: 'details' };
      if (scenario === 'group') schema.fields[2]!.visibleWhen = { op: 'PRESENT', field: 'total' };
      if (scenario === 'row')
        (schema.fields[2]!.fields as RawField[])[0]!.visibleWhen = {
          op: 'PRESENT',
          field: 'lineTotal',
        };
      await expect(compileApprovalTypedForm(schema)).rejects.toThrow(ApprovalTypedFormError);
    }
  });

  it('rejects duplicate/unknown/type-confused fields, nested groups and unbounded IN', async () => {
    const mutations: ((schema: ReturnType<typeof schemaCopy>) => void)[] = [
      (schema) => schema.fields.push(schema.fields[0]!),
      (schema) => {
        schema.fields[0]!.lookupUrl = 'https://untrusted.example';
      },
      (schema) => {
        schema.fields[1]!.visibleWhen = { op: 'GT', field: 'category', value: 1 };
      },
      (schema) => {
        schema.fields[1]!.visibleWhen = { op: 'EQ', field: 'category', value: 'MISSING' };
      },
      (schema) => {
        (schema.fields[2]!.fields as RawField[])[0]!.type = 'REPEATING_GROUP';
      },
      (schema) => {
        schema.fields[1]!.visibleWhen = {
          op: 'IN',
          field: 'category',
          values: Array(51).fill('OTHER'),
        };
      },
    ];
    for (const mutate of mutations) {
      const schema = schemaCopy();
      mutate(schema);
      await expect(compileApprovalTypedForm(schema)).rejects.toThrow(ApprovalTypedFormError);
    }
  });

  it('enforces depth, per-tree AST nodes, field and schema text budgets', async () => {
    const schema = schemaCopy();
    let condition: unknown = { op: 'PRESENT', field: 'category' };
    for (let index = 0; index < 9; index++) condition = { op: 'NOT', args: [condition] };
    schema.fields[1]!.visibleWhen = condition;
    await expect(compileApprovalTypedForm(schema)).rejects.toThrow(ApprovalTypedFormError);
    const broad = schemaCopy();
    broad.fields[1]!.visibleWhen = {
      op: 'AND',
      args: Array.from({ length: 20 }, () => ({
        op: 'AND',
        args: Array.from({ length: 7 }, () => ({ op: 'PRESENT', field: 'category' })),
      })),
    };
    await expect(compileApprovalTypedForm(broad)).rejects.toThrow(ApprovalTypedFormError);
    await expect(
      compileApprovalTypedForm({
        ...fixture.schema,
        fields: Array(51).fill(fixture.schema.fields[0]),
      })
    ).rejects.toThrow(ApprovalTypedFormError);
    const label = schemaCopy();
    label.fields[0]!.labelEn = 'x'.repeat(161);
    await expect(compileApprovalTypedForm(label)).rejects.toThrow(ApprovalTypedFormError);
  });

  it.each([
    0.1,
    NaN,
    Infinity,
    -Infinity,
    Number.MAX_SAFE_INTEGER + 1,
    '1e2',
    '01',
    '+1',
    '1.000000001',
    '10000000000000000000000000000',
  ])('rejects non-contract numeric transport %s', async (value) => {
    expect(() => typedDecimal(value)).toThrow(ApprovalTypedFormError);
    const schema = schemaCopy();
    (schema.fields[2]!.fields as RawField[])[0]!.min = value;
    await expect(compileApprovalTypedForm(schema)).rejects.toThrow(ApprovalTypedFormError);
    const compiled = await compileApprovalTypedForm(fixture.schema);
    expect(() =>
      evaluateApprovalTypedForm(compiled, { items: [{ quantity: value }] }, 'DRAFT')
    ).toThrow(ApprovalTypedFormError);
  });
});

describe('exact decimal evaluation and amendment normalization', () => {
  it.each([
    ['ADD', '0.1', '0.2', '0.3'],
    ['SUBTRACT', '1', '0.2', '0.8'],
    ['MULTIPLY', '0.1', '0.2', '0.02'],
    ['DIVIDE', '1', '3', '0.33333333'],
    ['DIVIDE', '-1', '6', '-0.16666667'],
    ['MIN', '-1', '2', '-1'],
    ['MAX', '-1', '2', '2'],
  ])('%s uses exact inputs and bounded plain strings', async (op, left, right, expected) => {
    const schema = await compileApprovalTypedForm(calculated(op!, left!, right!));
    expect(evaluateApprovalTypedForm(schema, {}, 'DRAFT').payload.total).toBe(expected);
  });

  it('rounds negative halfway away from zero only where explicitly requested', async () => {
    const schema = await compileApprovalTypedForm(calculated('ROUND', '-1.005', undefined, 2));
    expect(evaluateApprovalTypedForm(schema, {}, 'DRAFT').payload.total).toBe('-1.01');
  });

  it.each([
    ['ADD', '9999999999999999999999999999', '1'],
    ['MULTIPLY', '9999999999999999999999999999', '9999999999999999999999999999'],
    ['MULTIPLY', '0.00000001', '0.00000001'],
    ['DIVIDE', '1', '0'],
  ])('rejects %s overflow/scale/zero instead of silently rounding', async (op, left, right) => {
    const schema = await compileApprovalTypedForm(calculated(op!, left!, right!));
    expect(() => evaluateApprovalTypedForm(schema, {}, 'DRAFT')).toThrow(ApprovalTypedFormError);
  });

  it('rejects an overflowing intermediate even when its parent would cancel the value', async () => {
    const raw = calculated('SUBTRACT', '1', '1');
    raw.fields[0]!.calculation = {
      op: 'SUBTRACT',
      args: [
        {
          op: 'ADD',
          args: [
            { op: 'CONST', value: '9999999999999999999999999999' },
            { op: 'CONST', value: '1' },
          ],
        },
        { op: 'CONST', value: '1' },
      ],
    };
    const schema = await compileApprovalTypedForm(raw);
    expect(() => evaluateApprovalTypedForm(schema, {}, 'DRAFT')).toThrow(ApprovalTypedFormError);
  });

  it('recomputes trusted stored amendments while rejecting untrusted computed patches', async () => {
    const schema = await compileApprovalTypedForm(fixture.schema);
    const old = evaluateApprovalTypedForm(schema, fixture.cases[0]!.input, 'SUBMIT').payload;
    const base = withoutApprovalTypedComputedValues(schema, old);
    (base.items as Record<string, unknown>[])[0]!.quantity = '4';
    expect(evaluateApprovalTypedForm(schema, base, 'SUBMIT').payload.total).toBe('56');
    expect(old.total).toBe('35.5');
    expect(() => evaluateApprovalTypedForm(schema, { ...base, total: '35.5' }, 'SUBMIT')).toThrow(
      ApprovalTypedFormError
    );
  });

  it('preserves missing calculations rather than inventing zero, and closes full-submit validation', async () => {
    const schema = await compileApprovalTypedForm(fixture.schema);
    const result = evaluateApprovalTypedForm(schema, { items: [{ quantity: 1 }] }, 'DRAFT');
    expect(result.payload).toEqual({ items: [{ quantity: '1' }] });
    expect(() => evaluateApprovalTypedForm(schema, result.payload, 'SUBMIT')).toThrow(
      ApprovalTypedFormError
    );
    expect(() => evaluateApprovalTypedForm(schema, {}, 'UNKNOWN' as never)).toThrow(
      ApprovalTypedFormError
    );
  });

  it('rejects unknown root/row fields and allows only the existing bounded origin marker', async () => {
    const schema = await compileApprovalTypedForm(fixture.schema);
    expect(
      evaluateApprovalTypedForm(schema, { createdFrom: 'template' }, 'DRAFT').payload.createdFrom
    ).toBe('template');
    for (const input of [
      { tenantId: 'other' },
      { createdFrom: 'x'.repeat(161) },
      { items: [{ createdFrom: 'other' }] },
    ]) {
      expect(() => evaluateApprovalTypedForm(schema, input, 'DRAFT')).toThrow(
        ApprovalTypedFormError
      );
    }
  });

  it('never treats inherited object properties as submitted form values', async () => {
    const raw = schemaCopy();
    raw.fields = [{ ...raw.fields[4], key: 'constructor', type: 'TEXT', requiredWhen: null }];
    const schema = await compileApprovalTypedForm(raw);
    expect(evaluateApprovalTypedForm(schema, {}, 'DRAFT').payload).toEqual({});
    expect(
      evaluateApprovalTypedForm(schema, { constructor: 'Explicit own value' }, 'DRAFT').payload
    ).toEqual({ constructor: 'Explicit own value' });
  });

  it('counts text code points but also enforces the UTF-16 transport cap and Java blank semantics', async () => {
    const raw = schemaCopy();
    raw.fields = [
      {
        ...raw.fields[4],
        key: 'summary',
        type: 'TEXT',
        required: true,
        requiredWhen: null,
        maxLength: 2,
      },
    ];
    const schema = await compileApprovalTypedForm(raw);
    expect(evaluateApprovalTypedForm(schema, { summary: '😀😀' }, 'SUBMIT').payload.summary).toBe(
      '😀😀'
    );
    expect(evaluateApprovalTypedForm(schema, { summary: '\u00a0' }, 'SUBMIT').payload.summary).toBe(
      '\u00a0'
    );
    expect(() => evaluateApprovalTypedForm(schema, { summary: '\u2003' }, 'SUBMIT')).toThrow(
      ApprovalTypedFormError
    );
    expect(() => evaluateApprovalTypedForm(schema, { summary: '😀😀😀' }, 'SUBMIT')).toThrow(
      ApprovalTypedFormError
    );
    raw.fields[0]!.maxLength = 10000;
    const wide = await compileApprovalTypedForm(raw);
    expect(() => evaluateApprovalTypedForm(wide, { summary: '😀'.repeat(5001) }, 'DRAFT')).toThrow(
      ApprovalTypedFormError
    );
  });

  it('evaluates compound conditions from normalized visible inputs, never stale hidden values', async () => {
    const raw = schemaCopy();
    raw.fields[4]!.visibleWhen = {
      op: 'OR',
      args: [
        { op: 'PRESENT', field: 'details' },
        {
          op: 'AND',
          args: [
            { op: 'EQ', field: 'category', value: 'OTHER' },
            { op: 'NOT', args: [{ op: 'PRESENT', field: 'total' }] },
          ],
        },
      ],
    };
    const schema = await compileApprovalTypedForm(raw);
    const hidden = evaluateApprovalTypedForm(
      schema,
      { category: 'STANDARD', details: { invalid: 'stale' } },
      'DRAFT'
    );
    expect(hidden.payload).toEqual({ category: 'STANDARD' });
    expect(hidden.visibleFields).not.toContain('justification');
    expect(
      evaluateApprovalTypedForm(schema, { category: 'OTHER' }, 'DRAFT').visibleFields
    ).toContain('justification');
  });

  it('separates repeating-group cardinality between draft and submit without lifting the hard cap', async () => {
    const schema = await compileApprovalTypedForm(fixture.schema);
    expect(
      evaluateApprovalTypedForm(schema, { category: 'STANDARD', items: [] }, 'DRAFT').payload
    ).toEqual({ category: 'STANDARD', items: [], total: '0' });
    expect(() =>
      evaluateApprovalTypedForm(schema, { category: 'STANDARD', items: [] }, 'SUBMIT')
    ).toThrow(ApprovalTypedFormError);
    expect(() => evaluateApprovalTypedForm(schema, { items: [{}, {}, {}, {}] }, 'DRAFT')).toThrow(
      ApprovalTypedFormError
    );
  });

  it('validates ISO date leap boundaries with the existing calendar engine', () => {
    for (const date of ['0000-02-29', '2000-02-29', '2026-09-14', '9999-12-31'])
      expect(() => typedDate(date)).not.toThrow();
    for (const date of ['1900-02-29', '2026-02-29', '2026-13-01', '2026-9-01', '2026-09-14T00:00Z'])
      expect(() => typedDate(date)).toThrow(ApprovalTypedFormError);
  });
});
