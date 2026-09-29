import { Temporal } from 'temporal-polyfill';

export class People360PayloadError extends Error {
  constructor() {
    super('PEOPLE_360_RESPONSE_INVALID');
    this.name = 'People360PayloadError';
  }
}

export const PEOPLE_360_FIELD_DESCRIPTORS = [
  {
    field: 'person.displayName',
    section: 'person',
    property: 'displayName',
    kind: 'TEXT',
    max: 200,
    maskable: true,
  },
  {
    field: 'person.preferredLocale',
    section: 'person',
    property: 'preferredLocale',
    kind: 'TEXT',
    max: 64,
    maskable: true,
  },
  {
    field: 'person.timeZone',
    section: 'person',
    property: 'timeZone',
    kind: 'TEXT',
    max: 100,
    maskable: true,
  },
  {
    field: 'person.lifecycleState',
    section: 'person',
    property: 'lifecycleState',
    kind: 'TEXT',
    max: 80,
    maskable: true,
  },
  {
    field: 'employment.workerNumber',
    section: 'employment',
    property: 'workerNumber',
    kind: 'TEXT',
    max: 200,
    maskable: true,
  },
  {
    field: 'employment.workerType',
    section: 'employment',
    property: 'workerType',
    kind: 'TEXT',
    max: 80,
    maskable: true,
  },
  {
    field: 'employment.workerStatus',
    section: 'employment',
    property: 'workerStatus',
    kind: 'TEXT',
    max: 80,
    maskable: true,
  },
  {
    field: 'employment.originalHireDate',
    section: 'employment',
    property: 'originalHireDate',
    kind: 'DATE',
    max: 10,
    maskable: false,
  },
  {
    field: 'employment.relationshipType',
    section: 'employment',
    property: 'relationshipType',
    kind: 'TEXT',
    max: 80,
    maskable: true,
  },
  {
    field: 'employment.relationshipStartDate',
    section: 'employment',
    property: 'relationshipStartDate',
    kind: 'DATE',
    max: 10,
    maskable: false,
  },
  {
    field: 'employment.relationshipEndDate',
    section: 'employment',
    property: 'relationshipEndDate',
    kind: 'DATE',
    max: 10,
    maskable: false,
  },
  {
    field: 'employment.legalEmployerName',
    section: 'employment',
    property: 'legalEmployerName',
    kind: 'TEXT',
    max: 240,
    maskable: true,
  },
  {
    field: 'primaryAssignment.assignmentKey',
    section: 'primaryAssignment',
    property: 'assignmentKey',
    kind: 'TEXT',
    max: 200,
    maskable: true,
  },
  {
    field: 'primaryAssignment.assignmentStatus',
    section: 'primaryAssignment',
    property: 'assignmentStatus',
    kind: 'TEXT',
    max: 80,
    maskable: true,
  },
  {
    field: 'primaryAssignment.businessTitle',
    section: 'primaryAssignment',
    property: 'businessTitle',
    kind: 'TEXT',
    max: 240,
    maskable: true,
  },
  {
    field: 'primaryAssignment.organizationName',
    section: 'primaryAssignment',
    property: 'organizationName',
    kind: 'TEXT',
    max: 240,
    maskable: true,
  },
  {
    field: 'primaryAssignment.jobProfileName',
    section: 'primaryAssignment',
    property: 'jobProfileName',
    kind: 'TEXT',
    max: 240,
    maskable: true,
  },
  {
    field: 'primaryAssignment.jobGradeName',
    section: 'primaryAssignment',
    property: 'jobGradeName',
    kind: 'TEXT',
    max: 160,
    maskable: true,
  },
  {
    field: 'primaryAssignment.locationName',
    section: 'primaryAssignment',
    property: 'locationName',
    kind: 'TEXT',
    max: 240,
    maskable: true,
  },
  {
    field: 'primaryAssignment.managerDisplayName',
    section: 'primaryAssignment',
    property: 'managerDisplayName',
    kind: 'TEXT',
    max: 200,
    maskable: true,
  },
  {
    field: 'primaryAssignment.effectiveStartDate',
    section: 'primaryAssignment',
    property: 'effectiveStartDate',
    kind: 'DATE',
    max: 10,
    maskable: false,
  },
  {
    field: 'primaryAssignment.effectiveEndDate',
    section: 'primaryAssignment',
    property: 'effectiveEndDate',
    kind: 'DATE',
    max: 10,
    maskable: false,
  },
] as const;

export type People360Field = (typeof PEOPLE_360_FIELD_DESCRIPTORS)[number]['field'];
export const PEOPLE_360_FIELD_REGISTRY: readonly People360Field[] = Object.freeze(
  PEOPLE_360_FIELD_DESCRIPTORS.map((descriptor) => descriptor.field)
);
const PEOPLE_360_LIST_ALLOWED_FIELDS: ReadonlySet<People360Field> = new Set([
  'person.displayName',
  'person.lifecycleState',
  'employment.workerStatus',
  'primaryAssignment.businessTitle',
  'primaryAssignment.organizationName',
  'primaryAssignment.jobProfileName',
]);
export type People360FieldDecisionKind = 'VIEW' | 'MASK' | 'OMIT';
export type People360FieldDecision = Readonly<{
  field: People360Field;
  decision: People360FieldDecisionKind;
}>;

export type People360Access = Readonly<{
  archetype: 'SELF' | 'MANAGER' | 'HR_OPERATOR' | 'AUDITOR';
  scope: 'SELF' | 'TEAM' | 'WORKFORCE_POLICY';
  policyRevision: string;
  fieldDecisions: readonly People360FieldDecision[];
}>;

export type People360ProjectedPerson = Readonly<{
  personId: string;
  displayName?: string;
  preferredLocale?: string;
  timeZone?: string;
  lifecycleState?: string;
}>;

export type People360Employment = Readonly<{
  workerNumber?: string;
  workerType?: string;
  workerStatus?: string;
  originalHireDate?: string;
  relationshipType?: string;
  relationshipStartDate?: string;
  relationshipEndDate?: string;
  legalEmployerName?: string;
}>;

export type People360PrimaryAssignment = Readonly<{
  assignmentKey?: string;
  assignmentStatus?: string;
  businessTitle?: string;
  organizationName?: string;
  jobProfileName?: string;
  jobGradeName?: string;
  locationName?: string;
  managerDisplayName?: string;
  effectiveStartDate?: string;
  effectiveEndDate?: string;
}>;

export type People360DetailView = Readonly<{
  schemaVersion: 1;
  asOf: string;
  state: 'READY' | 'PARTIAL';
  projectionRevision: string;
  person: People360ProjectedPerson;
  employment?: People360Employment;
  primaryAssignment?: People360PrimaryAssignment;
  access: People360Access;
}>;

export type People360Person = People360DetailView;

export type People360Page = Readonly<{
  items: readonly People360Person[];
  nextCursor?: string;
  size: number;
  hasMore: boolean;
  asOf: string;
}>;

export type People360RequestScope = Readonly<{
  governed: boolean;
  ready: boolean;
  contextScopeKey?: string;
  cacheKey: readonly [string, string, string, string, string, string];
  queryMeta: Readonly<{
    accessSensitive: true;
    tenantId: string;
    actorId: string;
    accessMode: string;
    productId: string;
    surfaceId: string;
    contextScopeKey?: string;
    decisionRevision: string;
  }>;
}>;

export type People360ListRequest = Readonly<{
  query?: string;
  status?: string;
  cursor?: string;
  size?: number;
  asOf: string;
  projection: 'people360';
  contextScopeKey?: string;
  signal?: AbortSignal;
}>;

export type People360DataSource = Readonly<{
  list: (request: People360ListRequest) => Promise<unknown>;
  detail: (
    personId: string,
    asOf: string,
    projection: 'people360',
    contextScopeKey?: string,
    signal?: AbortSignal
  ) => Promise<unknown>;
}>;

export type People360SelfDataSource = Readonly<{
  self: (
    asOf: string,
    projection: 'people360',
    contextScopeKey?: string,
    signal?: AbortSignal
  ) => Promise<unknown>;
}>;

export type People360TeamDataSource = Readonly<{
  detail: (
    personId: string,
    asOf: string,
    projection: 'people360',
    contextScopeKey?: string,
    signal?: AbortSignal
  ) => Promise<unknown>;
}>;

export type People360DetailPresentation = Readonly<{
  loading: boolean;
  refreshing: boolean;
  stale: boolean;
  blockingError?: unknown;
  refreshError?: unknown;
  profile?: People360DetailView;
  retry: () => void;
}>;

const own = (source: object, key: PropertyKey) => Object.prototype.hasOwnProperty.call(source, key);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

const hasControlCharacter = (value: string) =>
  Array.from(value).some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code < 32 || code === 127;
  });

function invalid(): never {
  throw new People360PayloadError();
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return invalid();
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return invalid();
  return value as Record<string, unknown>;
}

function text(
  source: Record<string, unknown>,
  key: string,
  options: Readonly<{ required?: boolean; max?: number }> = {}
): string | undefined {
  const value = source[key];
  if (value === undefined || value === null) {
    if (options.required) return invalid();
    return undefined;
  }
  if (typeof value !== 'string') return invalid();
  const normalized = value.trim();
  if (
    (options.required && normalized.length === 0) ||
    normalized.length > (options.max ?? 512) ||
    hasControlCharacter(normalized)
  ) {
    return invalid();
  }
  return normalized || undefined;
}

function uuid(source: Record<string, unknown>, key: string, required = true): string | undefined {
  const value = text(source, key, { required, max: 36 });
  if (!value) return undefined;
  return UUID.test(value) ? value : invalid();
}

function boolean(source: Record<string, unknown>, key: string): boolean {
  return typeof source[key] === 'boolean' ? source[key] : invalid();
}

function nonNegativeInteger(source: Record<string, unknown>, key: string): number {
  const value = source[key];
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : invalid();
}

function date(source: Record<string, unknown>, key: string, required = false): string | undefined {
  const value = text(source, key, { required, max: 10 });
  if (!value) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return invalid();
  try {
    return Temporal.PlainDate.from(value).toString() === value ? value : invalid();
  } catch {
    return invalid();
  }
}

function denseArray(value: unknown): unknown[] {
  if (!Array.isArray(value)) return invalid();
  for (let index = 0; index < value.length; index += 1) {
    if (!own(value, String(index))) return invalid();
  }
  return value;
}

function fieldDecisions(value: unknown): readonly People360FieldDecision[] {
  const values = denseArray(value);
  if (values.length !== PEOPLE_360_FIELD_REGISTRY.length) return invalid();
  return Object.freeze(
    values.map((item, index) => {
      const source = record(item);
      const field = text(source, 'field', { required: true, max: 80 });
      const decision = text(source, 'decision', { required: true, max: 8 });
      if (field !== PEOPLE_360_FIELD_REGISTRY[index]) return invalid();
      if (decision !== 'VIEW' && decision !== 'MASK' && decision !== 'OMIT') return invalid();
      if (decision === 'MASK' && !PEOPLE_360_FIELD_DESCRIPTORS[index]?.maskable) return invalid();
      return Object.freeze({ field, decision }) as People360FieldDecision;
    })
  );
}

function access(value: unknown): People360Access {
  const source = record(value);
  const archetype = text(source, 'archetype', { required: true, max: 20 });
  const scope = text(source, 'scope', { required: true, max: 24 });
  if (!['SELF', 'MANAGER', 'HR_OPERATOR', 'AUDITOR'].includes(archetype ?? '')) return invalid();
  if (!['SELF', 'TEAM', 'WORKFORCE_POLICY'].includes(scope ?? '')) return invalid();
  const expectedScope =
    archetype === 'SELF' ? 'SELF' : archetype === 'MANAGER' ? 'TEAM' : 'WORKFORCE_POLICY';
  if (scope !== expectedScope) return invalid();
  return Object.freeze({
    archetype: archetype as People360Access['archetype'],
    scope: scope as People360Access['scope'],
    policyRevision: text(source, 'policyRevision', { required: true, max: 240 })!,
    fieldDecisions: fieldDecisions(source.fieldDecisions),
  });
}

function decisionMap(projectionAccess: People360Access) {
  return new Map(projectionAccess.fieldDecisions.map((item) => [item.field, item.decision]));
}

function fieldDescriptor(field: People360Field) {
  const descriptor = PEOPLE_360_FIELD_DESCRIPTORS.find((item) => item.field === field);
  return descriptor ?? invalid();
}

function projectedValue(
  source: Record<string, unknown>,
  field: People360Field,
  decisions: ReadonlyMap<People360Field, People360FieldDecisionKind>
): string | undefined {
  const descriptor = fieldDescriptor(field);
  const decision = decisions.get(field) ?? invalid();
  const present = own(source, descriptor.property);
  if (decision === 'OMIT') {
    if (present) invalid();
    return undefined;
  }
  if (
    !present ||
    source[descriptor.property] === null ||
    source[descriptor.property] === undefined
  ) {
    if (decision === 'MASK') invalid();
    return undefined;
  }
  const selected =
    descriptor.kind === 'DATE'
      ? date(source, descriptor.property)
      : text(source, descriptor.property, { max: descriptor.max });
  if (decision === 'MASK' && (!descriptor.maskable || selected !== '••••')) invalid();
  return selected;
}

function assertSectionMayBeAbsent(
  section: 'employment' | 'primaryAssignment',
  decisions: ReadonlyMap<People360Field, People360FieldDecisionKind>
) {
  const hasDisclosedField = PEOPLE_360_FIELD_DESCRIPTORS.some(
    (descriptor) => descriptor.section === section && decisions.get(descriptor.field) !== 'OMIT'
  );
  if (hasDisclosedField) invalid();
}

function projectedPerson(
  value: unknown,
  decisions: ReadonlyMap<People360Field, People360FieldDecisionKind>
): People360ProjectedPerson {
  const source = record(value);
  return Object.freeze({
    personId: uuid(source, 'personId')!,
    displayName: projectedValue(source, 'person.displayName', decisions),
    preferredLocale: projectedValue(source, 'person.preferredLocale', decisions),
    timeZone: projectedValue(source, 'person.timeZone', decisions),
    lifecycleState: projectedValue(source, 'person.lifecycleState', decisions),
  });
}

function projectedEmployment(
  value: unknown,
  decisions: ReadonlyMap<People360Field, People360FieldDecisionKind>
): People360Employment | undefined {
  if (value === undefined || value === null) {
    assertSectionMayBeAbsent('employment', decisions);
    return undefined;
  }
  const source = record(value);
  return Object.freeze({
    workerNumber: projectedValue(source, 'employment.workerNumber', decisions),
    workerType: projectedValue(source, 'employment.workerType', decisions),
    workerStatus: projectedValue(source, 'employment.workerStatus', decisions),
    originalHireDate: projectedValue(source, 'employment.originalHireDate', decisions),
    relationshipType: projectedValue(source, 'employment.relationshipType', decisions),
    relationshipStartDate: projectedValue(source, 'employment.relationshipStartDate', decisions),
    relationshipEndDate: projectedValue(source, 'employment.relationshipEndDate', decisions),
    legalEmployerName: projectedValue(source, 'employment.legalEmployerName', decisions),
  });
}

function projectedAssignment(
  value: unknown,
  decisions: ReadonlyMap<People360Field, People360FieldDecisionKind>
): People360PrimaryAssignment | undefined {
  if (value === undefined || value === null) {
    assertSectionMayBeAbsent('primaryAssignment', decisions);
    return undefined;
  }
  const source = record(value);
  return Object.freeze({
    assignmentKey: projectedValue(source, 'primaryAssignment.assignmentKey', decisions),
    assignmentStatus: projectedValue(source, 'primaryAssignment.assignmentStatus', decisions),
    businessTitle: projectedValue(source, 'primaryAssignment.businessTitle', decisions),
    organizationName: projectedValue(source, 'primaryAssignment.organizationName', decisions),
    jobProfileName: projectedValue(source, 'primaryAssignment.jobProfileName', decisions),
    jobGradeName: projectedValue(source, 'primaryAssignment.jobGradeName', decisions),
    locationName: projectedValue(source, 'primaryAssignment.locationName', decisions),
    managerDisplayName: projectedValue(source, 'primaryAssignment.managerDisplayName', decisions),
    effectiveStartDate: projectedValue(source, 'primaryAssignment.effectiveStartDate', decisions),
    effectiveEndDate: projectedValue(source, 'primaryAssignment.effectiveEndDate', decisions),
  });
}

export function selectPeople360Detail(
  value: unknown,
  requestedPersonId: string,
  requestedAsOf?: string
): People360DetailView {
  const source = record(value);
  if (source.schemaVersion !== 1) return invalid();
  const state = text(source, 'state', { required: true, max: 16 });
  if (state !== 'READY' && state !== 'PARTIAL') return invalid();
  const projectionAccess = access(source.access);
  const decisions = decisionMap(projectionAccess);
  const selectedPerson = projectedPerson(source.person, decisions);
  const asOf = date(source, 'asOf', true)!;
  if (selectedPerson.personId !== requestedPersonId || (requestedAsOf && asOf !== requestedAsOf)) {
    return invalid();
  }
  return Object.freeze({
    schemaVersion: 1,
    asOf,
    state,
    projectionRevision: text(source, 'projectionRevision', { required: true, max: 240 })!,
    person: selectedPerson,
    employment: projectedEmployment(source.employment, decisions),
    primaryAssignment: projectedAssignment(source.primaryAssignment, decisions),
    access: projectionAccess,
  });
}

export function selectPeople360Page(value: unknown, requestedAsOf: string): People360Page {
  const source = record(value);
  const asOf = date(source, 'asOf', true)!;
  if (asOf !== requestedAsOf) return invalid();
  const items = denseArray(source.items).map((item) => {
    const itemSource = record(item);
    const personSource = record(itemSource.person);
    const selected = selectPeople360Detail(item, uuid(personSource, 'personId')!, asOf);
    const minimizedListProjection = selected.access.fieldDecisions.every(
      ({ field, decision }) => PEOPLE_360_LIST_ALLOWED_FIELDS.has(field) || decision === 'OMIT'
    );
    return minimizedListProjection ? selected : invalid();
  });
  if (new Set(items.map((item) => item.person.personId)).size !== items.length) return invalid();
  const hasMore = boolean(source, 'hasMore');
  const nextCursor = text(source, 'nextCursor', { max: 1000 });
  if (hasMore && !nextCursor) return invalid();
  return Object.freeze({
    items: Object.freeze([...items]),
    nextCursor,
    size: nonNegativeInteger(source, 'size'),
    hasMore,
    asOf,
  });
}

export function people360Decision(
  profile: People360DetailView,
  field: People360Field
): People360FieldDecisionKind {
  return profile.access.fieldDecisions.find((item) => item.field === field)?.decision ?? 'OMIT';
}
