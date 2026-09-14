import type Decimal from 'decimal.js';

import type {
  ApprovalTypedCalculation,
  ApprovalTypedCondition,
  ApprovalTypedFormEvaluation,
} from '@dwp-frontend/shared-utils/api/approval-form-typed-contract';

import {
  ApprovalDecimal,
  boundedTypedDecimal,
  freezeTypedJson,
  typedDate,
  typedDecimal,
  typedFormInvalid,
  typedJavaBlank,
  typedNumeric,
  typedObject,
  type CompiledApprovalTypedField,
  type CompiledApprovalTypedForm,
  type CompiledApprovalTypedScope,
} from './approval-form-typed-model';

export type ApprovalTypedValidationMode = 'DRAFT' | 'SUBMIT';

/** Server validation remains authoritative. This engine returns canonical strings and never evaluates code. */
export function evaluateApprovalTypedForm(
  schema: CompiledApprovalTypedForm,
  raw: unknown,
  mode: ApprovalTypedValidationMode
): ApprovalTypedFormEvaluation {
  if (mode !== 'DRAFT' && mode !== 'SUBMIT') typedFormInvalid('Unknown validation mode.');
  const input = typedObject(raw);
  const visible = new Set<string>();
  const required = new Set<string>();
  let operations = 0;
  function tick(): void {
    if (++operations > 200000) typedFormInvalid('Evaluation exceeds the operation limit.');
  }
  function condition(
    rule: ApprovalTypedCondition,
    scope: CompiledApprovalTypedScope,
    values: Record<string, unknown>
  ): boolean {
    tick();
    if (rule.op === 'AND') return rule.args.every((child) => condition(child, scope, values));
    if (rule.op === 'OR') return rule.args.some((child) => condition(child, scope, values));
    if (rule.op === 'NOT') return !condition(rule.args[0], scope, values);
    if ('args' in rule) typedFormInvalid('Invalid compiled condition.');
    const fieldKey = rule.field;
    const actual = values[fieldKey];
    if (rule.op === 'PRESENT') return !empty(actual);
    if (empty(actual)) return false;
    function compare(literal: unknown): number {
      if (typedNumeric(scope.fields[fieldKey]!))
        return typedDecimal(actual).comparedTo(typedDecimal(literal));
      return actual === literal ? 0 : (actual as string) < (literal as string) ? -1 : 1;
    }
    if (rule.op === 'IN') return rule.values.some((value) => compare(value) === 0);
    const comparison = compare(rule.value);
    switch (rule.op) {
      case 'EQ':
        return comparison === 0;
      case 'NE':
        return comparison !== 0;
      case 'GT':
        return comparison > 0;
      case 'GTE':
        return comparison >= 0;
      case 'LT':
        return comparison < 0;
      case 'LTE':
        return comparison <= 0;
    }
  }
  function expression(
    ast: ApprovalTypedCalculation,
    values: Record<string, unknown>
  ): Decimal | null {
    tick();
    if (ast.op === 'CONST') return typedDecimal(ast.value);
    if (ast.op === 'FIELD')
      return values[ast.field] == null ? null : typedDecimal(values[ast.field]);
    if (ast.op === 'SUM') {
      const group = values[ast.group];
      if (group == null) return null;
      let sum = new ApprovalDecimal(0);
      for (const row of group as Record<string, unknown>[]) {
        tick();
        if (row[ast.field] == null) return null;
        sum = boundedTypedDecimal(sum.plus(typedDecimal(row[ast.field])));
      }
      return sum;
    }
    const left = expression(ast.args[0], values);
    if (left === null) return null;
    if (ast.op === 'ROUND')
      return boundedTypedDecimal(left.toDecimalPlaces(ast.scale, ApprovalDecimal.ROUND_HALF_UP));
    const right = expression(ast.args[1], values);
    if (right === null) return null;
    let result: Decimal;
    switch (ast.op) {
      case 'ADD':
        result = left.plus(right);
        break;
      case 'SUBTRACT':
        result = left.minus(right);
        break;
      case 'MULTIPLY':
        result = left.times(right);
        break;
      case 'DIVIDE':
        if (right.isZero()) typedFormInvalid('Division by zero.');
        result = left.dividedBy(right).toDecimalPlaces(8, ApprovalDecimal.ROUND_HALF_UP);
        break;
      case 'MIN':
        result = ApprovalDecimal.min(left, right);
        break;
      case 'MAX':
        result = ApprovalDecimal.max(left, right);
        break;
    }
    return boundedTypedDecimal(result);
  }
  function scope(
    definition: CompiledApprovalTypedScope,
    source: Record<string, unknown>,
    prefix: string
  ): Record<string, unknown> {
    const keys = Object.keys(source);
    if (keys.length > Object.keys(definition.fields).length + (prefix ? 0 : 1))
      typedFormInvalid('Too many payload fields.', prefix);
    for (const key of keys) {
      if (!Object.hasOwn(definition.fields, key) && !(prefix === '' && key === 'createdFrom'))
        typedFormInvalid('Unknown payload field.', prefix + key);
    }
    const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const field of definition.order) {
      const path = prefix + field.key;
      if (field.visibleWhen !== null && !condition(field.visibleWhen, definition, result)) continue;
      visible.add(path);
      const mandatory =
        field.required ||
        (field.requiredWhen !== null && condition(field.requiredWhen, definition, result));
      if (mandatory) required.add(path);
      let value = Object.hasOwn(source, field.key) ? source[field.key] : undefined;
      if (field.calculation !== null) {
        const calculated = expression(field.calculation, result);
        if (!empty(value) && (calculated === null || !typedDecimal(value).equals(calculated)))
          typedFormInvalid('Computed input differs from the calculation.', path);
        value = calculated;
      }
      if (empty(value)) {
        if (mode === 'SUBMIT' && mandatory) typedFormInvalid('Required field is missing.', path);
        continue;
      }
      if (field.children) {
        if (!Array.isArray(value) || value.length > field.maxRows)
          typedFormInvalid('Repeating group exceeds its row limit.', path);
        if (mode === 'SUBMIT' && value.length < Math.max(field.minRows, mandatory ? 1 : 0))
          typedFormInvalid('Repeating group has too few rows.', path);
        result[field.key] = value.map((row, index) =>
          scope(field.children!, typedObject(row), `${path}[${index}].`)
        );
      } else {
        result[field.key] = scalar(field, value, path);
      }
    }
    return result;
  }
  const payload = scope(schema.scope, input, '');
  if (Object.hasOwn(input, 'createdFrom')) {
    if (typeof input.createdFrom !== 'string' || input.createdFrom.length > 160)
      typedFormInvalid('Invalid origin marker.', 'createdFrom');
    payload.createdFrom = input.createdFrom;
  }
  return Object.freeze({
    payload: freezeTypedJson(payload) as Readonly<Record<string, unknown>>,
    visibleFields: Object.freeze(Array.from(visible).sort()),
    requiredFields: Object.freeze(Array.from(required).sort()),
    schemaSha256: schema.schemaSha256,
  });
}

/** For trusted stored amendment bases only; do not strip client-supplied computed values before validation. */
export function withoutApprovalTypedComputedValues(
  schema: CompiledApprovalTypedForm,
  raw: unknown
): Record<string, unknown> {
  function clean(
    scope: CompiledApprovalTypedScope,
    input: Record<string, unknown>
  ): Record<string, unknown> {
    const output = { ...input };
    for (const field of Object.values(scope.fields)) {
      if (field.calculation) delete output[field.key];
      const rows = output[field.key];
      if (field.children && Array.isArray(rows))
        output[field.key] = rows.map((row) => clean(field.children!, typedObject(row)));
    }
    return output;
  }
  return clean(schema.scope, typedObject(raw));
}

function scalar(field: CompiledApprovalTypedField, raw: unknown, path: string): string {
  if (typedNumeric(field)) {
    const value = field.calculation ? boundedTypedDecimal(raw as Decimal) : typedDecimal(raw);
    if (
      (field.min !== null && value.lessThan(field.min)) ||
      (field.max !== null && value.greaterThan(field.max))
    )
      typedFormInvalid('Number is outside its bounds.', path);
    return value.toFixed();
  }
  if (typeof raw !== 'string' || raw.length > 10000)
    typedFormInvalid('Expected a bounded text value.', path);
  if (field.type === 'DATE') typedDate(raw);
  else if (field.type === 'SELECT') {
    if (!field.options.includes(raw)) typedFormInvalid('Unknown SELECT option.', path);
  } else if (['TEXT', 'TEXTAREA', 'USER'].includes(field.type)) {
    const length = Array.from(raw).length;
    if (length < field.minLength || length > field.maxLength)
      typedFormInvalid('Text is outside its length bounds.', path);
  } else typedFormInvalid('Invalid compiled scalar type.', path);
  return raw;
}

function empty(value: unknown): boolean {
  return value == null || (typeof value === 'string' && typedJavaBlank(value));
}
