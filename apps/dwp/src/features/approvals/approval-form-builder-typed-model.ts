import { APPROVAL_TYPED_FORM_CONTRACT } from '@dwp-frontend/shared-utils/api/approval-form-typed-contract';

import type {
  ApprovalTypedCalculation,
  ApprovalTypedField,
  ApprovalTypedFormSchema,
  ApprovalTypedScalarField,
} from '@dwp-frontend/shared-utils/api/approval-form-typed-contract';

export function canChangeTypedCalculationOperator(
  expression: ApprovalTypedCalculation,
  op: ApprovalTypedCalculation['op'],
  depth: number
): boolean {
  const height = (value: ApprovalTypedCalculation): number =>
    'args' in value ? 1 + Math.max(...value.args.map(height)) : 0;
  if (['CONST', 'FIELD', 'SUM'].includes(op)) return true;
  if (op === 'ROUND') return depth + 1 + height(expression) <= 8;
  return depth < 8;
}

export const APPROVAL_TYPED_FIELD_TYPES = [
  'TEXT',
  'TEXTAREA',
  'NUMBER',
  'DATE',
  'SELECT',
  'USER',
  'CALCULATED_NUMBER',
  'REPEATING_GROUP',
] as const;
export type ApprovalTypedFieldPath = readonly [string] | readonly [string, string];

export function typedEditorFields(
  schema: ApprovalTypedFormSchema,
  parent?: string
): readonly ApprovalTypedField[] {
  if (!parent) return schema.fields;
  const field = schema.fields.find((item) => item.key === parent);
  return field?.type === 'REPEATING_GROUP' ? field.fields : [];
}

export function typedEditorField(
  schema: ApprovalTypedFormSchema,
  path: ApprovalTypedFieldPath
): ApprovalTypedField | undefined {
  return typedEditorFields(schema, path.length === 2 ? path[0] : undefined).find(
    (field) => field.key === path[path.length - 1]
  );
}

function replaceScope(
  schema: ApprovalTypedFormSchema,
  fields: readonly ApprovalTypedField[],
  parent?: string
): ApprovalTypedFormSchema {
  return parent
    ? {
        ...schema,
        fields: schema.fields.map((field) =>
          field.key === parent && field.type === 'REPEATING_GROUP'
            ? { ...field, fields: fields as readonly ApprovalTypedScalarField[] }
            : field
        ),
      }
    : { ...schema, fields };
}

export function patchTypedEditorField(
  schema: ApprovalTypedFormSchema,
  path: ApprovalTypedFieldPath,
  patch: Readonly<Record<string, unknown>>
): ApprovalTypedFormSchema {
  const parent = path.length === 2 ? path[0] : undefined;
  const key = path[path.length - 1];
  const safePatch = { ...patch };
  if (path.length === 1 && key === 'summary') {
    delete safePatch.key;
    delete safePatch.type;
    delete safePatch.visibleWhen;
  }
  return replaceScope(
    schema,
    typedEditorFields(schema, parent).map((field) =>
      field.key === key
        ? (Object.fromEntries(
            Object.entries({ ...field, ...safePatch }).filter(([, value]) => value !== undefined)
          ) as unknown as ApprovalTypedField)
        : field
    ),
    parent
  );
}

export function changeTypedEditorFieldType(
  schema: ApprovalTypedFormSchema,
  path: ApprovalTypedFieldPath,
  type: ApprovalTypedField['type']
): ApprovalTypedFormSchema {
  const current = typedEditorField(schema, path);
  if (
    !current ||
    current.type === type ||
    (path.length === 1 && current.key === 'summary') ||
    (path.length === 2 && type === 'REPEATING_GROUP')
  )
    return schema;
  const parent = path.length === 2 ? path[0] : undefined;
  const { key, labelKo, labelEn, helpKo, helpEn, required, visibleWhen, requiredWhen } = current;
  const base = newTypedEditorField(type, []);
  const next = Object.fromEntries(
    Object.entries({
      ...base,
      key,
      labelKo,
      labelEn,
      helpKo,
      helpEn,
      required,
      visibleWhen,
      requiredWhen,
    }).filter(([, value]) => value !== undefined)
  ) as unknown as ApprovalTypedField;
  return replaceScope(
    schema,
    typedEditorFields(schema, parent).map((field) => (field.key === key ? next : field)),
    parent
  );
}

export function moveTypedEditorField(
  schema: ApprovalTypedFormSchema,
  path: ApprovalTypedFieldPath,
  direction: -1 | 1
): ApprovalTypedFormSchema {
  const parent = path.length === 2 ? path[0] : undefined;
  const fields = [...typedEditorFields(schema, parent)];
  const index = fields.findIndex((field) => field.key === path[path.length - 1]);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= fields.length) return schema;
  [fields[index], fields[target]] = [fields[target]!, fields[index]!];
  return replaceScope(schema, fields, parent);
}

export function removeTypedEditorField(
  schema: ApprovalTypedFormSchema,
  path: ApprovalTypedFieldPath
): ApprovalTypedFormSchema {
  if (path.length === 1 && path[0] === 'summary') return schema;
  const parent = path.length === 2 ? path[0] : undefined;
  const fields = typedEditorFields(schema, parent);
  if (fields.length <= 1) return schema;
  return replaceScope(
    schema,
    fields.filter((field) => field.key !== path[path.length - 1]),
    parent
  );
}

export function canDuplicateTypedEditorField(
  schema: ApprovalTypedFormSchema,
  path: ApprovalTypedFieldPath
): boolean {
  const field = typedEditorField(schema, path);
  if (!field || (path.length === 1 && path[0] === 'summary')) return false;
  const parent = path.length === 2 ? path[0] : undefined;
  const count = schema.fields.reduce(
    (total, item) => total + 1 + (item.type === 'REPEATING_GROUP' ? item.fields.length : 0),
    0
  );
  const added = 1 + (field.type === 'REPEATING_GROUP' ? field.fields.length : 0);
  return typedEditorFields(schema, parent).length < (parent ? 20 : 50) && count + added <= 250;
}

export function duplicateTypedEditorField(
  schema: ApprovalTypedFormSchema,
  path: ApprovalTypedFieldPath
): { schema: ApprovalTypedFormSchema; path: ApprovalTypedFieldPath } {
  const field = typedEditorField(schema, path);
  if (!field || !canDuplicateTypedEditorField(schema, path)) return { schema, path };
  const parent = path.length === 2 ? path[0] : undefined;
  const fields = [...typedEditorFields(schema, parent)];
  let index = 1;
  const copyKey = () => {
    const suffix = `_copy_${index}`;
    return `${field.key.slice(0, 80 - suffix.length)}${suffix}`;
  };
  while (fields.some((item) => item.key === copyKey())) index += 1;
  const copy = { ...structuredClone(field), key: copyKey() };
  // Child references stay local to the copied group; external references keep their original target.
  fields.splice(fields.findIndex((item) => item.key === field.key) + 1, 0, copy);
  return {
    schema: replaceScope(schema, fields, parent),
    path: parent ? [parent, copy.key] : [copy.key],
  };
}

export function newTypedEditorField(
  type: ApprovalTypedField['type'],
  fields: readonly ApprovalTypedField[]
): ApprovalTypedField {
  let index = 1;
  while (fields.some((field) => field.key === `field${index}`)) index += 1;
  const base = { key: `field${index}`, labelKo: '', labelEn: '', required: false };
  if (type === 'REPEATING_GROUP')
    return {
      ...base,
      type,
      minRows: 0,
      maxRows: 20,
      fields: [{ key: 'item', labelKo: '', labelEn: '', type: 'TEXT', required: false }],
    };
  if (type === 'CALCULATED_NUMBER')
    return { ...base, type, calculation: { op: 'CONST', value: '0' } };
  if (type === 'SELECT') return { ...base, type, options: [] };
  return { ...base, type };
}

export function addTypedEditorField(
  schema: ApprovalTypedFormSchema,
  type: ApprovalTypedField['type'],
  parent?: string
): { schema: ApprovalTypedFormSchema; path: ApprovalTypedFieldPath } {
  const fields = typedEditorFields(schema, parent);
  if ((parent && type === 'REPEATING_GROUP') || fields.length >= (parent ? 20 : 50))
    return { schema, path: parent ? [parent, fields[0]?.key ?? ''] : [fields[0]?.key ?? ''] };
  const field = newTypedEditorField(type, fields);
  return {
    schema: replaceScope(schema, [...fields, field], parent),
    path: parent ? [parent, field.key] : [field.key],
  };
}

export function typedEditorSeed(
  summaryLabelKo: string,
  summaryLabelEn: string
): ApprovalTypedFormSchema {
  return {
    schemaContract: APPROVAL_TYPED_FORM_CONTRACT,
    schemaVersion: 2,
    fields: [
      {
        key: 'summary',
        type: 'TEXTAREA',
        labelKo: summaryLabelKo,
        labelEn: summaryLabelEn,
        required: true,
        maxLength: 2000,
      },
    ],
  };
}
