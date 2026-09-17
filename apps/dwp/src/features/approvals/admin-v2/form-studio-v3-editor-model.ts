export type FormStudioV3EditableFieldType =
  'TEXT' | 'TEXTAREA' | 'NUMBER' | 'DATE' | 'DATETIME' | 'BOOLEAN';

export type FormStudioV3FieldDraft = Readonly<{
  key: string;
  type: string;
  labelKo: string;
  labelEn: string;
  helpKo: string;
  helpEn: string;
  required: boolean;
  desktopSpan: number;
  tabletSpan: number;
  mobileSpan: number;
}>;

export type FormStudioV3EditorField = FormStudioV3FieldDraft &
  Readonly<{
    id: string;
    parentId: string | null;
    control: string;
    sourceType: string;
    editable: boolean;
    classification: string;
    viewRoles: readonly string[];
    editRoles: readonly string[];
  }>;

type JsonRecord = Record<string, unknown>;
type FieldLocation = Readonly<{
  id: string;
  parentId: string | null;
  list: unknown[];
  index: number;
  field: JsonRecord;
}>;

const FIELD_KEY = /^[a-z][a-z0-9_]{1,79}$/u;
const CONTROL_BY_TYPE: Readonly<Record<FormStudioV3EditableFieldType, string>> = {
  TEXT: 'TEXT_INPUT',
  TEXTAREA: 'TEXTAREA',
  NUMBER: 'NUMBER_INPUT',
  DATE: 'DATE_PICKER',
  DATETIME: 'DATETIME_PICKER',
  BOOLEAN: 'CHECKBOX',
};

export const FORM_STUDIO_V3_EDITABLE_FIELD_TYPES = Object.freeze(
  Object.keys(CONTROL_BY_TYPE) as FormStudioV3EditableFieldType[]
);

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function record(value: unknown, label: string): JsonRecord {
  if (!isRecord(value)) throw new Error(`Invalid Form Studio V3 ${label}.`);
  return value;
}

function list(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`Invalid Form Studio V3 ${label}.`);
  return value;
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function integer(value: unknown, fallback: number): number {
  return Number.isSafeInteger(value) ? (value as number) : fallback;
}

function boolean(value: unknown): boolean {
  return value === true;
}

function stringList(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function cloneSchema(schema: Readonly<Record<string, unknown>>): JsonRecord {
  return structuredClone(schema) as JsonRecord;
}

function fieldLocations(schema: JsonRecord): FieldLocation[] {
  const result: FieldLocation[] = [];
  const visit = (items: unknown[], parentId: string | null) => {
    items.forEach((value, index) => {
      const field = record(value, 'field');
      const key = text(field.key);
      if (!key) throw new Error('Invalid Form Studio V3 field key.');
      const id = parentId ? `${parentId}.${key}` : key;
      result.push({ id, parentId, list: items, index, field });
      if (field.columns != null) visit(list(field.columns, `${id} columns`), id);
    });
  };

  list(schema.pages, 'pages').forEach((pageValue) => {
    const page = record(pageValue, 'page');
    list(page.sections, 'sections').forEach((sectionValue) => {
      const section = record(sectionValue, 'section');
      visit(list(section.fields, 'fields'), null);
    });
  });
  return result;
}

function localized(value: unknown) {
  const source = isRecord(value) ? value : {};
  return { ko: text(source.ko), en: text(source.en) };
}

function toEditorField(location: FieldLocation): FormStudioV3EditorField {
  const { field } = location;
  const labels = localized(field.label);
  const help = localized(field.help);
  const span = isRecord(field.span) ? field.span : {};
  const retention = isRecord(field.retention) ? field.retention : {};
  const rawType = text(field.type, 'TEXT');
  const type = rawType;
  return {
    id: location.id,
    parentId: location.parentId,
    key: text(field.key),
    type,
    sourceType: rawType,
    editable: FORM_STUDIO_V3_EDITABLE_FIELD_TYPES.includes(
      rawType as FormStudioV3EditableFieldType
    ),
    control: text(
      field.control,
      CONTROL_BY_TYPE[type as FormStudioV3EditableFieldType] ?? 'TEXT_INPUT'
    ),
    labelKo: labels.ko,
    labelEn: labels.en,
    helpKo: help.ko,
    helpEn: help.en,
    required: boolean(field.required),
    desktopSpan: integer(span.desktop, 6),
    tabletSpan: integer(span.tablet, 12),
    mobileSpan: integer(span.mobile, 12),
    classification: text(retention.classification, 'INTERNAL'),
    viewRoles: stringList(field.viewRoles),
    editRoles: stringList(field.editRoles),
  };
}

function assertDraft(
  draft: FormStudioV3FieldDraft,
  existingKeys: Set<string>,
  ownKey?: string,
  ownType?: string
) {
  const normalizedKey = draft.key.trim();
  if (!FIELD_KEY.test(normalizedKey)) throw new Error('Invalid Form Studio V3 field key.');
  if (normalizedKey !== ownKey && existingKeys.has(normalizedKey)) {
    throw new Error('Duplicate Form Studio V3 field key.');
  }
  if (!draft.labelKo.trim() || !draft.labelEn.trim()) {
    throw new Error('Form Studio V3 field labels are required.');
  }
  if (
    !FORM_STUDIO_V3_EDITABLE_FIELD_TYPES.includes(draft.type as FormStudioV3EditableFieldType) &&
    draft.type !== ownType
  ) {
    throw new Error('Unsupported Form Studio V3 field type.');
  }
  [draft.desktopSpan, draft.tabletSpan, draft.mobileSpan].forEach((span) => {
    if (!Number.isSafeInteger(span) || span < 1 || span > 12) {
      throw new Error('Invalid Form Studio V3 field span.');
    }
  });
}

function uniqueKey(schema: JsonRecord, base: string): string {
  const keys = new Set(fieldLocations(schema).map((item) => text(item.field.key)));
  let candidate = base;
  let suffix = 2;
  while (keys.has(candidate)) {
    candidate = `${base}_${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function target(schema: JsonRecord, fieldId: string): FieldLocation {
  const location = fieldLocations(schema).find((item) => item.id === fieldId);
  if (!location) throw new Error('Form Studio V3 field is stale.');
  return location;
}

function fieldRecord(draft: FormStudioV3FieldDraft, current?: JsonRecord): JsonRecord {
  const base = current ? structuredClone(current) : {};
  const key = draft.key.trim();
  const type = draft.type;
  const editableType = FORM_STUDIO_V3_EDITABLE_FIELD_TYPES.includes(
    type as FormStudioV3EditableFieldType
  )
    ? (type as FormStudioV3EditableFieldType)
    : null;
  const currentExport = isRecord(base.export) ? base.export : null;
  return {
    ...base,
    key,
    type,
    control: editableType ? CONTROL_BY_TYPE[editableType] : text(base.control),
    label: { ko: draft.labelKo.trim(), en: draft.labelEn.trim() },
    help: { ko: draft.helpKo.trim(), en: draft.helpEn.trim() },
    span: {
      desktop: draft.desktopSpan,
      tablet: draft.tabletSpan,
      mobile: draft.mobileSpan,
    },
    required: draft.required,
    validation: isRecord(base.validation) ? base.validation : {},
    options: Array.isArray(base.options) ? base.options : [],
    viewRoles: Array.isArray(base.viewRoles) ? base.viewRoles : ['*'],
    editRoles: Array.isArray(base.editRoles) ? base.editRoles : ['*'],
    retention: isRecord(base.retention)
      ? base.retention
      : { classification: 'INTERNAL', retentionClass: 'STANDARD', legalHoldEligible: true },
    export: currentExport
      ? {
          ...currentExport,
          label: { ko: draft.labelKo.trim(), en: draft.labelEn.trim() },
          format: type === 'NUMBER' ? 'NUMBER' : text(currentExport.format, 'TEXT'),
        }
      : {
          included: true,
          label: { ko: draft.labelKo.trim(), en: draft.labelEn.trim() },
          format: type === 'NUMBER' ? 'NUMBER' : 'TEXT',
          mask: 'NONE',
        },
  };
}

export function readFormStudioV3EditorFields(
  schema: Readonly<Record<string, unknown>>
): readonly FormStudioV3EditorField[] {
  return fieldLocations(cloneSchema(schema)).map(toEditorField);
}

export function createFormStudioV3FieldDraft(
  schema: Readonly<Record<string, unknown>>
): FormStudioV3FieldDraft {
  const source = cloneSchema(schema);
  const key = uniqueKey(source, 'new_field');
  return {
    key,
    type: 'TEXT',
    labelKo: '새 필드',
    labelEn: 'New field',
    helpKo: '',
    helpEn: '',
    required: false,
    desktopSpan: 6,
    tabletSpan: 12,
    mobileSpan: 12,
  };
}

export function addFormStudioV3Field(
  schema: Readonly<Record<string, unknown>>,
  draft: FormStudioV3FieldDraft
): Readonly<Record<string, unknown>> {
  const next = cloneSchema(schema);
  const locations = fieldLocations(next);
  assertDraft(draft, new Set(locations.map((item) => text(item.field.key))));
  const pages = list(next.pages, 'pages');
  const page = record(pages[0], 'first page');
  const sections = list(page.sections, 'sections');
  const section = record(sections[0], 'first section');
  list(section.fields, 'fields').push(fieldRecord(draft));
  return next;
}

export function updateFormStudioV3Field(
  schema: Readonly<Record<string, unknown>>,
  fieldId: string,
  draft: FormStudioV3FieldDraft
): Readonly<Record<string, unknown>> {
  const next = cloneSchema(schema);
  const locations = fieldLocations(next);
  const location = locations.find((item) => item.id === fieldId);
  if (!location) throw new Error('Form Studio V3 field is stale.');
  const ownKey = text(location.field.key);
  assertDraft(
    draft,
    new Set(locations.map((item) => text(item.field.key))),
    ownKey,
    text(location.field.type)
  );
  if (draft.key.trim() !== ownKey) {
    throw new Error('Published Form Studio V3 field keys are immutable.');
  }
  location.list[location.index] = fieldRecord(draft, location.field);
  return next;
}

export function cloneFormStudioV3Field(
  schema: Readonly<Record<string, unknown>>,
  fieldId: string
): Readonly<{ schema: Readonly<Record<string, unknown>>; fieldId: string }> {
  const next = cloneSchema(schema);
  const location = target(next, fieldId);
  const originalKey = text(location.field.key);
  const key = uniqueKey(next, `${originalKey}_copy`);
  const copy = structuredClone(location.field);
  copy.key = key;
  const labels = localized(copy.label);
  copy.label = { ko: `${labels.ko} 복사본`, en: `${labels.en} copy` };
  location.list.splice(location.index + 1, 0, copy);
  return {
    schema: next,
    fieldId: location.parentId ? `${location.parentId}.${key}` : key,
  };
}

export function removeFormStudioV3Field(
  schema: Readonly<Record<string, unknown>>,
  fieldId: string
): Readonly<Record<string, unknown>> {
  const next = cloneSchema(schema);
  const location = target(next, fieldId);
  location.list.splice(location.index, 1);
  return next;
}

export function moveFormStudioV3Field(
  schema: Readonly<Record<string, unknown>>,
  fieldId: string,
  direction: -1 | 1
): Readonly<Record<string, unknown>> {
  const next = cloneSchema(schema);
  const location = target(next, fieldId);
  const destination = location.index + direction;
  if (destination < 0 || destination >= location.list.length) return next;
  const [field] = location.list.splice(location.index, 1);
  location.list.splice(destination, 0, field);
  return next;
}
