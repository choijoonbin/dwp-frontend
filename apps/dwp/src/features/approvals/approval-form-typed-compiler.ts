import {
  APPROVAL_TYPED_FORM_CONTRACT,
  type ApprovalTypedCalculation,
  type ApprovalTypedCondition,
  type ApprovalTypedField,
  type ApprovalTypedFormSchema,
} from '@dwp-frontend/shared-utils/api/approval-form-typed-contract';

import {
  freezeTypedJson,
  typedDate,
  typedDecimal,
  typedFormInvalid,
  typedJavaBlank,
  typedJavaTrim,
  typedNumeric,
  typedObject,
  type CompiledApprovalTypedField,
  type CompiledApprovalTypedForm,
  type CompiledApprovalTypedScope,
} from './approval-form-typed-model';

const types = new Set([
  'TEXT',
  'TEXTAREA',
  'NUMBER',
  'DATE',
  'SELECT',
  'USER',
  'CALCULATED_NUMBER',
  'REPEATING_GROUP',
]);
const fieldKeys = new Set([
  'key',
  'labelKo',
  'labelEn',
  'helpKo',
  'helpEn',
  'type',
  'required',
  'options',
  'visibleWhen',
  'requiredWhen',
  'calculation',
  'min',
  'max',
  'minLength',
  'maxLength',
  'minRows',
  'maxRows',
  'fields',
]);
interface Budget {
  fields: number;
  nodes: number;
}
const budget = (): Budget => ({ fields: 0, nodes: 0 });

/** Pure typed-schema compilation. Legacy/unmarked forms must use the existing V1 engine. */
export async function compileApprovalTypedForm(raw: unknown): Promise<CompiledApprovalTypedForm> {
  const definition = typedObject(freezeTypedJson(raw));
  only(definition, ['schemaContract', 'schemaVersion', 'fields']);
  if (definition.schemaContract !== APPROVAL_TYPED_FORM_CONTRACT)
    typedFormInvalid('Expected typed form V2 discriminator.');
  integer(definition.schemaVersion, 2, 2);
  const scope = compileScope(definition.fields, false, budget());
  const canonicalJson = JSON.stringify(definition);
  if (canonicalJson.length > 200000) typedFormInvalid('Form schema exceeds the size limit.');
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalJson));
  const schemaSha256 = Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');
  return Object.freeze({
    definition: definition as unknown as ApprovalTypedFormSchema,
    canonicalJson,
    schemaSha256,
    scope,
  });
}

/** The form-owned transport always carries this visible standard field. */
export function requireApprovalTypedSummary(schema: CompiledApprovalTypedForm): void {
  const summary = schema.scope.fields.summary;
  if (!summary || !['TEXT', 'TEXTAREA'].includes(summary.type) || summary.visibleWhen !== null) {
    typedFormInvalid('Stored typed forms require a visible root summary TEXT or TEXTAREA field.');
  }
}

function compileScope(raw: unknown, row: boolean, total: Budget): CompiledApprovalTypedScope {
  const fields: Record<string, CompiledApprovalTypedField> = Object.create(null) as Record<
    string,
    CompiledApprovalTypedField
  >;
  for (const value of list(raw, 1, row ? 20 : 50)) {
    const field = compileField(typedObject(value), row, total);
    if (Object.hasOwn(fields, field.key)) typedFormInvalid('Duplicate field key.');
    fields[field.key] = field;
  }
  const dependencies = new Map<string, Set<string>>();
  for (const field of Object.values(fields)) {
    const refs = new Set<string>();
    validateCondition(field.visibleWhen, fields, refs);
    validateCondition(field.requiredWhen, fields, refs);
    validateCalculation(field.calculation, fields, refs, row);
    dependencies.set(field.key, refs);
  }
  const order: CompiledApprovalTypedField[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();
  function visit(key: string): void {
    if (visited.has(key)) return;
    if (visiting.has(key)) typedFormInvalid('Cyclic form-field dependency.', key);
    visiting.add(key);
    for (const dependency of Array.from(dependencies.get(key)!).sort()) visit(dependency);
    visiting.delete(key);
    visited.add(key);
    order.push(fields[key]!);
  }
  for (const key of Object.keys(fields)) visit(key);
  return Object.freeze({ fields: Object.freeze(fields), order: Object.freeze(order) });
}

function compileField(
  value: Record<string, unknown>,
  row: boolean,
  total: Budget
): CompiledApprovalTypedField {
  only(value, fieldKeys);
  if (++total.fields > 250) typedFormInvalid('Too many fields.');
  const key = text(value.key, 80);
  if (!/^[a-z][A-Za-z0-9_]{1,79}$/.test(key) || key === 'createdFrom')
    typedFormInvalid('Invalid or reserved field key.');
  text(value.labelKo, 160);
  text(value.labelEn, 160);
  optionalText(value.helpKo, 500);
  optionalText(value.helpEn, 500);
  const type = text(value.type, 32);
  if (!types.has(type)) typedFormInvalid('Unsupported field type.');
  if (value.required != null && typeof value.required !== 'boolean')
    typedFormInvalid('Expected a boolean.');
  const required = value.required === true;
  const options =
    value.options == null ? [] : list(value.options, 0, 50).map((option) => text(option, 160));
  if (
    new Set(options).size !== options.length ||
    (type === 'SELECT' ? options.length < 2 : options.length !== 0)
  ) {
    typedFormInvalid('Only SELECT accepts two or more unique options.');
  }
  const visibleWhen = parseCondition(value.visibleWhen, 0, budget(), total);
  const requiredWhen = parseCondition(value.requiredWhen, 0, budget(), total);
  const calculation = parseCalculation(value.calculation, 0, budget(), total);
  if ((type === 'CALCULATED_NUMBER') !== (calculation !== null))
    typedFormInvalid('Calculation/type mismatch.');
  const numeric = type === 'NUMBER' || type === 'CALCULATED_NUMBER';
  const textual = ['TEXT', 'TEXTAREA', 'USER'].includes(type);
  if (!numeric && (Object.hasOwn(value, 'min') || Object.hasOwn(value, 'max')))
    typedFormInvalid('Numeric bounds require numeric fields.');
  if (!textual && (Object.hasOwn(value, 'minLength') || Object.hasOwn(value, 'maxLength')))
    typedFormInvalid('Length bounds require text fields.');
  const min = value.min == null ? null : typedDecimal(value.min).toFixed();
  const max = value.max == null ? null : typedDecimal(value.max).toFixed();
  if (min !== null && max !== null && typedDecimal(min).greaterThan(max))
    typedFormInvalid('Invalid numeric bounds.');
  const minLength = optionalInteger(value.minLength, 0, 10000, 0);
  const maxLength = optionalInteger(value.maxLength, 1, 10000, 10000);
  if (minLength > maxLength) typedFormInvalid('Invalid length bounds.');
  const group = type === 'REPEATING_GROUP';
  if (row && group) typedFormInvalid('Nested repeating groups are not supported.');
  if (
    !group &&
    ['fields', 'minRows', 'maxRows'].some((property) => Object.hasOwn(value, property))
  ) {
    typedFormInvalid('Row settings require a repeating group.');
  }
  const minRows = optionalInteger(value.minRows, 0, 50, 0);
  const maxRows = optionalInteger(value.maxRows, 1, 50, 20);
  if (minRows > maxRows) typedFormInvalid('Invalid row bounds.');
  const children = group ? compileScope(value.fields, true, total) : null;
  return Object.freeze({
    key,
    type: type as ApprovalTypedField['type'],
    required,
    options: Object.freeze(options),
    visibleWhen,
    requiredWhen,
    calculation,
    min,
    max,
    minLength,
    maxLength,
    minRows,
    maxRows,
    children,
  });
}

function parseCondition(
  raw: unknown,
  depth: number,
  tree: Budget,
  total: Budget
): ApprovalTypedCondition | null {
  if (raw == null) return null;
  node(depth, tree, total);
  const value = typedObject(raw);
  const op = text(value.op, 16);
  if (op === 'AND' || op === 'OR' || op === 'NOT') {
    only(value, ['op', 'args']);
    const args = list(value.args, op === 'NOT' ? 1 : 2, op === 'NOT' ? 1 : 20).map((arg) => {
      const child = parseCondition(arg, depth + 1, tree, total);
      if (!child) typedFormInvalid('Missing condition operand.');
      return child;
    });
    return Object.freeze({ op, args: Object.freeze(args) }) as ApprovalTypedCondition;
  }
  if (!['PRESENT', 'EQ', 'NE', 'IN', 'GT', 'GTE', 'LT', 'LTE'].includes(op))
    typedFormInvalid('Unknown condition operator.');
  only(
    value,
    op === 'PRESENT'
      ? ['op', 'field']
      : op === 'IN'
        ? ['op', 'field', 'values']
        : ['op', 'field', 'value']
  );
  const field = text(value.field, 80);
  if (op === 'PRESENT') return Object.freeze({ op, field });
  if (op === 'IN')
    return Object.freeze({
      op,
      field,
      values: Object.freeze(list(value.values, 1, 50).map(literal)),
    });
  return Object.freeze({ op, field, value: literal(value.value) }) as ApprovalTypedCondition;
}

function parseCalculation(
  raw: unknown,
  depth: number,
  tree: Budget,
  total: Budget
): ApprovalTypedCalculation | null {
  if (raw == null) return null;
  node(depth, tree, total);
  const value = typedObject(raw);
  const op = text(value.op, 16);
  if (op === 'CONST') {
    only(value, ['op', 'value']);
    return Object.freeze({ op, value: typedDecimal(value.value).toFixed() });
  }
  if (op === 'FIELD' || op === 'SUM') {
    only(value, op === 'FIELD' ? ['op', 'field'] : ['op', 'group', 'field']);
    const field = text(value.field, 80);
    return op === 'FIELD'
      ? Object.freeze({ op, field })
      : Object.freeze({ op, field, group: text(value.group, 80) });
  }
  if (!['ADD', 'SUBTRACT', 'MULTIPLY', 'DIVIDE', 'MIN', 'MAX', 'ROUND'].includes(op))
    typedFormInvalid('Unknown calculation operator.');
  only(value, op === 'ROUND' ? ['op', 'args', 'scale'] : ['op', 'args']);
  const count = op === 'ROUND' ? 1 : 2;
  const args = list(value.args, count, count).map((arg) => {
    const child = parseCalculation(arg, depth + 1, tree, total);
    if (!child) typedFormInvalid('Missing calculation operand.');
    return child;
  });
  return Object.freeze({
    op,
    args: Object.freeze(args),
    ...(op === 'ROUND' ? { scale: integer(value.scale, 0, 8) } : {}),
  }) as ApprovalTypedCalculation;
}

function validateCondition(
  condition: ApprovalTypedCondition | null,
  fields: Readonly<Record<string, CompiledApprovalTypedField>>,
  refs: Set<string>
): void {
  if (!condition) return;
  if ('args' in condition) {
    for (const child of condition.args) validateCondition(child, fields, refs);
    return;
  }
  const field = reference(condition.field, fields);
  if (field.children) typedFormInvalid('Conditions require scalar references.');
  refs.add(field.key);
  if (['GT', 'GTE', 'LT', 'LTE'].includes(condition.op) && !typedNumeric(field))
    typedFormInvalid('Numeric conditions require numeric fields.');
  const values =
    condition.op === 'PRESENT' ? [] : condition.op === 'IN' ? condition.values : [condition.value];
  for (const value of values) {
    if (typedNumeric(field)) typedDecimal(value);
    else {
      if (typeof value !== 'string' || value.length > 10000)
        typedFormInvalid('Condition literal type mismatch.');
      if (field.type === 'SELECT' && !field.options.includes(value))
        typedFormInvalid('Unknown SELECT option.');
      if (field.type === 'DATE') typedDate(value);
    }
  }
}

function validateCalculation(
  expression: ApprovalTypedCalculation | null,
  fields: Readonly<Record<string, CompiledApprovalTypedField>>,
  refs: Set<string>,
  row: boolean
): void {
  if (!expression) return;
  if (expression.op === 'FIELD') {
    const field = reference(expression.field, fields);
    if (!typedNumeric(field)) typedFormInvalid('Calculation reference must be numeric.');
    refs.add(field.key);
  } else if (expression.op === 'SUM') {
    if (row) typedFormInvalid('Row calculations cannot aggregate a group.');
    const group = reference(expression.group, fields);
    if (!group.children) typedFormInvalid('SUM requires a repeating group.');
    if (!typedNumeric(reference(expression.field, group.children.fields)))
      typedFormInvalid('SUM requires a numeric row field.');
    refs.add(group.key);
  }
  if ('args' in expression)
    for (const child of expression.args) validateCalculation(child, fields, refs, row);
}

function reference(
  key: string,
  fields: Readonly<Record<string, CompiledApprovalTypedField>>
): CompiledApprovalTypedField {
  if (!Object.hasOwn(fields, key)) typedFormInvalid('Unknown or cross-scope reference.', key);
  return fields[key]!;
}
function only(value: Record<string, unknown>, allowed: Iterable<string>): void {
  const keys = new Set(allowed);
  if (Object.keys(value).some((key) => !keys.has(key)))
    typedFormInvalid('Unknown schema property.');
}
function list(value: unknown, min: number, max: number): unknown[] {
  if (!Array.isArray(value) || value.length < min || value.length > max)
    typedFormInvalid('Invalid schema list size.');
  return value;
}
function literal(value: unknown): string | number {
  if (typeof value !== 'string' && typeof value !== 'number')
    typedFormInvalid('Expected scalar condition literal.');
  return value;
}
function text(value: unknown, max: number): string {
  if (
    typeof value !== 'string' ||
    typedJavaBlank(value) ||
    typedJavaTrim(value) !== value ||
    value.length > max
  )
    typedFormInvalid('Invalid schema text.');
  return value;
}
function optionalText(value: unknown, max: number): void {
  if (value != null && (typeof value !== 'string' || value.length > max))
    typedFormInvalid('Invalid help text.');
}
function integer(value: unknown, min: number, max: number): number {
  const result = typedDecimal(value);
  if (!result.isInteger() || result.lessThan(min) || result.greaterThan(max))
    typedFormInvalid('Integer is out of bounds.');
  return result.toNumber();
}
function optionalInteger(value: unknown, min: number, max: number, fallback: number): number {
  return value == null ? fallback : integer(value, min, max);
}
function node(depth: number, tree: Budget, total: Budget): void {
  if (depth > 8 || ++tree.nodes > 128 || ++total.nodes > 2048)
    typedFormInvalid('Expression complexity exceeds the limit.');
}
