export type HrisHomePayloadFieldDescriptor =
  | Readonly<{
      type: 'STRING';
      nullable: boolean;
      nonBlank: boolean;
    }>
  | Readonly<{
      type: 'DATE_KEY';
      nullable: boolean;
    }>
  | Readonly<{
      type: 'BOOLEAN';
      nullable: boolean;
    }>
  | Readonly<{
      type: 'NUMBER';
      nullable: boolean;
      integer: boolean;
      minimum: number | null;
      maximum: number | null;
    }>
  | HrisHomePayloadObjectDescriptor;

export type HrisHomePayloadObjectDescriptor = Readonly<{
  type: 'OBJECT';
  nullable: boolean;
  fields: Readonly<Record<string, HrisHomePayloadFieldDescriptor>>;
}>;

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

function isStrictDateKey(value: string): boolean {
  if (!DATE_KEY_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function cloneHrisHomePayloadDescriptor(
  descriptor: HrisHomePayloadFieldDescriptor
): HrisHomePayloadFieldDescriptor {
  if (descriptor.type !== 'OBJECT') return Object.freeze({ ...descriptor });
  return Object.freeze({
    type: 'OBJECT' as const,
    nullable: descriptor.nullable,
    fields: Object.freeze(
      Object.fromEntries(
        Object.entries(descriptor.fields).map(([field, child]) => [
          field,
          cloneHrisHomePayloadDescriptor(child),
        ])
      )
    ),
  });
}

export function isValidHrisHomePayloadDescriptor(
  descriptor: HrisHomePayloadFieldDescriptor,
  visited = new Set<HrisHomePayloadFieldDescriptor>()
): boolean {
  if (!descriptor || typeof descriptor !== 'object') return false;
  if (typeof descriptor.nullable !== 'boolean') return false;
  if (descriptor.type === 'STRING') return typeof descriptor.nonBlank === 'boolean';
  if (descriptor.type === 'DATE_KEY' || descriptor.type === 'BOOLEAN') return true;
  if (descriptor.type === 'NUMBER') {
    return (
      typeof descriptor.integer === 'boolean' &&
      (descriptor.minimum === null || Number.isFinite(descriptor.minimum)) &&
      (descriptor.maximum === null || Number.isFinite(descriptor.maximum)) &&
      (descriptor.minimum === null ||
        descriptor.maximum === null ||
        descriptor.minimum <= descriptor.maximum)
    );
  }
  if (descriptor.type !== 'OBJECT' || !descriptor.fields || typeof descriptor.fields !== 'object') {
    return false;
  }
  if (visited.has(descriptor)) return false;
  visited.add(descriptor);
  const entries = Object.entries(descriptor.fields);
  const valid =
    entries.length > 0 &&
    entries.every(
      ([field, child]) =>
        field.trim().length > 0 && isValidHrisHomePayloadDescriptor(child, visited)
    );
  visited.delete(descriptor);
  return valid;
}

export function payloadDescriptorMatchesFields(
  descriptor: HrisHomePayloadObjectDescriptor,
  exposedFields: readonly string[]
): boolean {
  const descriptorFields = Object.keys(descriptor.fields).sort();
  const expectedFields = [...exposedFields].sort();
  return (
    descriptorFields.length === expectedFields.length &&
    descriptorFields.every((field, index) => field === expectedFields[index])
  );
}

export function normalizeHrisHomePayload(
  value: unknown,
  descriptor: HrisHomePayloadFieldDescriptor,
  path: string
): unknown {
  if (value === null) {
    if (descriptor.nullable) return null;
    throw new Error(`Non-null HRIS home payload field required: ${path}`);
  }
  if (descriptor.type === 'STRING') {
    if (typeof value !== 'string' || (descriptor.nonBlank && value.trim().length === 0)) {
      throw new Error(`Invalid HRIS home payload string: ${path}`);
    }
    return value;
  }
  if (descriptor.type === 'DATE_KEY') {
    if (typeof value !== 'string' || !isStrictDateKey(value)) {
      throw new Error(`Invalid HRIS home payload date: ${path}`);
    }
    return value;
  }
  if (descriptor.type === 'BOOLEAN') {
    if (typeof value !== 'boolean') {
      throw new Error(`Invalid HRIS home payload boolean: ${path}`);
    }
    return value;
  }
  if (descriptor.type === 'NUMBER') {
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      (descriptor.integer && !Number.isInteger(value)) ||
      (descriptor.minimum !== null && value < descriptor.minimum) ||
      (descriptor.maximum !== null && value > descriptor.maximum)
    ) {
      throw new Error(`Invalid HRIS home payload number: ${path}`);
    }
    return value;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Invalid HRIS home payload object: ${path}`);
  }
  if (Object.getOwnPropertySymbols(value).length > 0) {
    throw new Error(`Unexpected HRIS home payload symbol: ${path}`);
  }
  const expectedFields = Object.keys(descriptor.fields).sort();
  const actualFields = Object.keys(value).sort();
  if (
    actualFields.length !== expectedFields.length ||
    actualFields.some((field, index) => field !== expectedFields[index])
  ) {
    throw new Error(`Unexpected HRIS home payload field: ${path}`);
  }
  const source = value as Record<string, unknown>;
  return Object.freeze(
    Object.fromEntries(
      expectedFields.map((field) => [
        field,
        normalizeHrisHomePayload(source[field], descriptor.fields[field]!, `${path}.${field}`),
      ])
    )
  );
}
