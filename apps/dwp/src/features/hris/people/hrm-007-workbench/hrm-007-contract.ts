export const HRM007_FEATURE = 'HRIS_HRM_APPOINTMENT_WORKBENCH' as const;
export const HRM007_ADAPTER_KIND = 'HRIS_HRM_007_ENTRY_QUERY_V1' as const;

export const HRM007_QUERY_IDS = ['IAQ-005', 'IAQ-007', 'IAQ-013'] as const;
export type Hrm007QueryId = (typeof HRM007_QUERY_IDS)[number];

const ACTION_CREATE_EMPLOYEE_CHANGE = Object.freeze({
  actionKey: 'hris.action.hrm.create-employee-change-request',
  method: 'POST',
  hrefTemplate: '/api/people/v1/hris/employee-change-requests',
  idempotencyPolicy: 'REQUIRED_IDEMPOTENCY_KEY',
  stepUpPolicy: 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED',
} as const);

const ACTION_SUBMIT_EMPLOYEE_CHANGE = Object.freeze({
  actionKey: 'hris.action.hrm.submit-employee-change-request',
  method: 'POST',
  hrefTemplate: '/api/people/v1/hris/employee-change-requests/{requestPublicId}/submit',
  idempotencyPolicy: 'REQUIRED_IDEMPOTENCY_KEY',
  stepUpPolicy: 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED',
} as const);

const ACTION_CREATE_ASSIGNMENT_EVENT = Object.freeze({
  actionKey: 'hris.action.hrm.create-assignment-event',
  method: 'POST',
  hrefTemplate: '/api/people/v1/hris/assignment-events',
  idempotencyPolicy: 'REQUIRED_IDEMPOTENCY_KEY',
  stepUpPolicy: 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED',
} as const);

const ACTION_VALIDATE_ASSIGNMENT_EVENT = Object.freeze({
  actionKey: 'hris.action.hrm.validate-assignment-event',
  method: 'POST',
  hrefTemplate: '/api/people/v1/hris/assignment-events/{eventPublicId}/validate',
  idempotencyPolicy: 'REQUIRED_IDEMPOTENCY_KEY',
  stepUpPolicy: 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED',
} as const);

const ACTION_SUBMIT_ASSIGNMENT_EVENT = Object.freeze({
  actionKey: 'hris.action.hrm.submit-assignment-event',
  method: 'POST',
  hrefTemplate: '/api/people/v1/hris/assignment-events/{eventPublicId}/submit',
  idempotencyPolicy: 'REQUIRED_IDEMPOTENCY_KEY',
  stepUpPolicy: 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED',
} as const);

const ACTION_PUBLISH_ASSIGNMENT_EVENT = Object.freeze({
  actionKey: 'hris.action.hrm.publish-assignment-event',
  method: 'POST',
  hrefTemplate: '/api/people/v1/hris/assignment-events/{eventPublicId}/publish',
  idempotencyPolicy: 'REQUIRED_IDEMPOTENCY_KEY',
  stepUpPolicy: 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED',
} as const);

export const HRM007_QUERY_CONTRACTS = Object.freeze({
  'IAQ-005': Object.freeze({
    queryId: 'IAQ-005',
    operationId: 'IAQ.OP.005',
    variantKey: 'PEOPLE_CHANGES',
    path: '/api/people/v1/hris/workbench/team/people-changes',
    route: '/hr/team/people-changes',
    capability: 'hcm.team.people-change.view',
    purpose: 'HR_LIFECYCLE',
    fieldGroups: ['CHANGE_REQUEST_SUMMARY', 'LIMITED_EMPLOYMENT', 'APPROVAL_STATUS'],
    fieldKinds: Object.freeze({
      CHANGE_REQUEST_SUMMARY: 'AGGREGATE',
      LIMITED_EMPLOYMENT: 'STATUS',
      APPROVAL_STATUS: 'STATUS',
    }),
    filterKinds: Object.freeze({
      changeRequestSummary: 'AGGREGATE',
      limitedEmployment: 'STATUS',
      approvalStatus: 'STATUS',
      effectiveOn: 'DATE',
    }),
    sorts: [
      'changeRequestSummary:ASC',
      'limitedEmployment:ASC',
      'approvalStatus:ASC',
      'changeRequestSummary:DESC',
      'limitedEmployment:DESC',
      'approvalStatus:DESC',
      'itemPublicId:ASC',
      'itemPublicId:DESC',
    ],
    actions: [ACTION_CREATE_EMPLOYEE_CHANGE, ACTION_SUBMIT_EMPLOYEE_CHANGE],
  }),
  'IAQ-007': Object.freeze({
    queryId: 'IAQ-007',
    operationId: 'IAQ.OP.007',
    variantKey: 'APPOINTMENTS',
    path: '/api/people/v1/hris/workbench/operations/appointments',
    route: '/hr/operations/people/appointments',
    capability: 'hcm.operations.people.view',
    purpose: 'HR_LIFECYCLE',
    fieldGroups: ['APPOINTMENT', 'ASSIGNMENT', 'EMPLOYMENT'],
    fieldKinds: Object.freeze({
      APPOINTMENT: 'TEMPORAL',
      ASSIGNMENT: 'REFERENCE',
      EMPLOYMENT: 'EFFECTIVE_RANGE',
    }),
    filterKinds: Object.freeze({
      appointment: 'TEMPORAL',
      assignment: 'REFERENCE',
      employment: 'EFFECTIVE_RANGE',
      effectiveOn: 'DATE',
    }),
    sorts: [
      'appointment:ASC',
      'assignment:ASC',
      'employment:ASC',
      'appointment:DESC',
      'assignment:DESC',
      'employment:DESC',
      'itemPublicId:ASC',
      'itemPublicId:DESC',
    ],
    actions: [
      ACTION_CREATE_ASSIGNMENT_EVENT,
      ACTION_VALIDATE_ASSIGNMENT_EVENT,
      ACTION_SUBMIT_ASSIGNMENT_EVENT,
      ACTION_PUBLISH_ASSIGNMENT_EVENT,
    ],
  }),
  'IAQ-013': Object.freeze({
    queryId: 'IAQ-013',
    operationId: 'IAQ.OP.013',
    variantKey: 'PEOPLE_EMPLOYMENT',
    path: '/api/people/v1/hris/workbench/configuration/people-employment',
    route: '/hr/settings/people-employment',
    capability: 'hcm.configuration.workbench.view',
    purpose: 'HRIS_CONFIGURATION',
    fieldGroups: ['POLICY_METADATA', 'EMPLOYMENT_RULE', 'IMPACT_SUMMARY'],
    fieldKinds: Object.freeze({
      POLICY_METADATA: 'POLICY',
      EMPLOYMENT_RULE: 'POLICY',
      IMPACT_SUMMARY: 'AGGREGATE',
    }),
    filterKinds: Object.freeze({
      policyMetadata: 'POLICY',
      employmentRule: 'POLICY',
      impactSummary: 'AGGREGATE',
      effectiveOn: 'DATE',
    }),
    sorts: [
      'policyMetadata:ASC',
      'employmentRule:ASC',
      'impactSummary:ASC',
      'policyMetadata:DESC',
      'employmentRule:DESC',
      'impactSummary:DESC',
      'itemPublicId:ASC',
      'itemPublicId:DESC',
    ],
    actions: [],
  }),
} as const);

export type Hrm007Action =
  | typeof ACTION_CREATE_EMPLOYEE_CHANGE
  | typeof ACTION_SUBMIT_EMPLOYEE_CHANGE
  | typeof ACTION_CREATE_ASSIGNMENT_EVENT
  | typeof ACTION_VALIDATE_ASSIGNMENT_EVENT
  | typeof ACTION_SUBMIT_ASSIGNMENT_EVENT
  | typeof ACTION_PUBLISH_ASSIGNMENT_EVENT;

export type Hrm007AggregateValue = Readonly<{
  itemCount: number;
  revision: number;
  asOf: string;
}>;
export type Hrm007StatusValue = Readonly<{ code: string; revision: number }>;
export type Hrm007TemporalValue = Readonly<{
  startAt: string;
  endAt: string | null;
  durationMinutes: number;
}>;
export type Hrm007ReferenceValue = Readonly<{
  publicId: string;
  code: string;
  label: string;
  revision: number;
}>;
export type Hrm007EffectiveRangeValue = Readonly<{
  effectiveFrom: string;
  effectiveTo: string | null;
  revision: number;
}>;
export type Hrm007PolicyValue = Readonly<{
  policyKey: string;
  revision: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: string;
}>;
export type Hrm007FieldValue =
  | Hrm007AggregateValue
  | Hrm007StatusValue
  | Hrm007TemporalValue
  | Hrm007ReferenceValue
  | Hrm007EffectiveRangeValue
  | Hrm007PolicyValue;
export type Hrm007FieldDecision =
  | Readonly<{ decision: 'VIEW'; value: Hrm007FieldValue }>
  | Readonly<{
      decision: 'MASK';
      value: null;
      maskReason: string;
      maskedDisplayKey: string;
    }>;

export type Hrm007Item = Readonly<{
  itemPublicId: string;
  title: string;
  statusCode: string;
  fieldGroups: Readonly<Record<string, Hrm007FieldDecision>>;
  deepLink: Readonly<{ route: string; resourcePublicId: string }>;
  availableActions: readonly Hrm007Action[];
}>;

export type Hrm007Projection = Readonly<{
  projectionVersion: '1';
  variantKey: 'PEOPLE_CHANGES' | 'APPOINTMENTS' | 'PEOPLE_EMPLOYMENT';
  asOf: string;
  queryState: Readonly<{
    state: 'COMPLETE' | 'EMPTY' | 'PARTIAL' | 'UNAVAILABLE';
    scopeDecisionRevision: string;
    freshness: 'CURRENT' | 'STALE' | 'UNAVAILABLE';
    nextCursor: string | null;
    fieldDecisionSummary: Readonly<{
      viewCount: number;
      maskedCount: number;
      omittedCount: number;
    }>;
    partialFailures: readonly Readonly<{
      componentKey: string;
      errorCode: string;
      correlationId: string;
      retryable: boolean;
    }>[];
    correlationId: string;
    cachePolicy: Readonly<{
      authorizationDecisionRevision: string;
      invalidationEvent: 'dwp.hris.access.assignment.changed.v1';
      maxAgeSeconds: number;
    }>;
  }>;
  items: readonly Hrm007Item[];
}>;

export type Hrm007TrustedScope = Readonly<{
  contextScopeKey: string;
  decisionRevision: string;
  locale: string;
  timeZone: string;
  correlationId: string;
}>;

export type Hrm007QueryOptions = Readonly<{
  filter?: Readonly<Record<string, unknown>>;
  sort?: readonly string[];
  asOf?: string | null;
  cursor?: string | null;
}>;

export type Hrm007QueryRequest = Readonly<{
  limit: 100;
  filter: Readonly<Record<string, unknown>>;
  sort: readonly string[];
  locale: string;
  timeZone: string;
  correlationId: string;
  asOf?: string | null;
  cursor?: string | null;
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const PUBLIC_ID = /^[A-Za-z0-9._:-]{1,128}$/u;
const CODE = /^[A-Z][A-Z0-9_]{1,63}$/u;
const DISPLAY_KEY = /^[a-z][a-z0-9._-]{1,127}$/u;
const COMPONENT_KEY = /^[a-z][a-z0-9._-]{0,127}$/u;
const POLICY_KEY = /^[a-z][a-z0-9._-]{1,127}$/u;
const CURSOR = /^[A-Za-z0-9_-]{16,1024}$/u;
const CIVIL_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/u;

export class Hrm007ContractError extends Error {
  readonly kind = 'HRM007_CONTRACT_OR_REVISION_ERROR' as const;

  constructor(path: string) {
    super(`Invalid HRM-007 entry-query contract: ${path}`);
    this.name = 'Hrm007ContractError';
  }
}

function invalid(path: string): never {
  throw new Hrm007ContractError(path);
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid(path);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return invalid(path);
  return value as Record<string, unknown>;
}

function exact(value: unknown, path: string, allowed: readonly string[], required = allowed) {
  const source = record(value, path);
  const keys = Object.keys(source);
  if (
    keys.some((key) => !allowed.includes(key)) ||
    required.some((key) => !Object.prototype.hasOwnProperty.call(source, key))
  ) {
    return invalid(path);
  }
  return source;
}

function text(value: unknown, path: string, maximum: number, pattern?: RegExp): string {
  if (
    typeof value !== 'string' ||
    !value ||
    value !== value.trim() ||
    value.length > maximum ||
    (pattern && !pattern.test(value))
  ) {
    return invalid(path);
  }
  return value;
}

function integer(value: unknown, path: string, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || Number(value) < minimum || Number(value) > maximum) {
    return invalid(path);
  }
  return Number(value);
}

function instant(value: unknown, path: string): string {
  const result = text(value, path, 64, INSTANT);
  if (!Number.isFinite(Date.parse(result))) return invalid(path);
  return result;
}

function civilDate(value: unknown, path: string): string {
  const result = text(value, path, 10, CIVIL_DATE);
  const [year, month, day] = result.split('-').map(Number);
  const parsed = new Date(Date.UTC(year!, month! - 1, day!));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() + 1 !== month ||
    parsed.getUTCDate() !== day
  ) {
    return invalid(path);
  }
  return result;
}

function uuid(value: unknown, path: string) {
  return text(value, path, 36, UUID).toLowerCase();
}

function parseAggregate(value: unknown, path: string): Hrm007AggregateValue {
  const source = exact(value, path, ['itemCount', 'revision', 'asOf']);
  return Object.freeze({
    itemCount: integer(source.itemCount, `${path}.itemCount`),
    revision: integer(source.revision, `${path}.revision`, 1),
    asOf: instant(source.asOf, `${path}.asOf`),
  });
}

function parseStatus(value: unknown, path: string): Hrm007StatusValue {
  const source = exact(value, path, ['code', 'revision']);
  return Object.freeze({
    code: text(source.code, `${path}.code`, 64, CODE),
    revision: integer(source.revision, `${path}.revision`, 1),
  });
}

function parseTemporal(value: unknown, path: string): Hrm007TemporalValue {
  const source = exact(value, path, ['startAt', 'endAt', 'durationMinutes']);
  return Object.freeze({
    startAt: instant(source.startAt, `${path}.startAt`),
    endAt: source.endAt === null ? null : instant(source.endAt, `${path}.endAt`),
    durationMinutes: integer(source.durationMinutes, `${path}.durationMinutes`),
  });
}

function parseReference(value: unknown, path: string): Hrm007ReferenceValue {
  const source = exact(value, path, ['publicId', 'code', 'label', 'revision']);
  return Object.freeze({
    publicId: text(source.publicId, `${path}.publicId`, 128, PUBLIC_ID),
    code: text(source.code, `${path}.code`, 64, CODE),
    label: text(source.label, `${path}.label`, 512),
    revision: integer(source.revision, `${path}.revision`, 1),
  });
}

function parseEffectiveRange(value: unknown, path: string): Hrm007EffectiveRangeValue {
  const source = exact(value, path, ['effectiveFrom', 'effectiveTo', 'revision']);
  return Object.freeze({
    effectiveFrom: civilDate(source.effectiveFrom, `${path}.effectiveFrom`),
    effectiveTo:
      source.effectiveTo === null ? null : civilDate(source.effectiveTo, `${path}.effectiveTo`),
    revision: integer(source.revision, `${path}.revision`, 1),
  });
}

function parsePolicy(value: unknown, path: string): Hrm007PolicyValue {
  const source = exact(value, path, [
    'policyKey',
    'revision',
    'effectiveFrom',
    'effectiveTo',
    'status',
  ]);
  return Object.freeze({
    policyKey: text(source.policyKey, `${path}.policyKey`, 128, POLICY_KEY),
    revision: integer(source.revision, `${path}.revision`, 1),
    effectiveFrom: civilDate(source.effectiveFrom, `${path}.effectiveFrom`),
    effectiveTo:
      source.effectiveTo === null ? null : civilDate(source.effectiveTo, `${path}.effectiveTo`),
    status: text(source.status, `${path}.status`, 64, CODE),
  });
}

const VALUE_PARSERS = {
  AGGREGATE: parseAggregate,
  STATUS: parseStatus,
  TEMPORAL: parseTemporal,
  REFERENCE: parseReference,
  EFFECTIVE_RANGE: parseEffectiveRange,
  POLICY: parsePolicy,
} as const;

function parseDecision(
  value: unknown,
  path: string,
  kind: keyof typeof VALUE_PARSERS
): Hrm007FieldDecision {
  const candidate = record(value, path);
  if (candidate.decision === 'VIEW') {
    const source = exact(candidate, path, ['decision', 'value']);
    return Object.freeze({
      decision: 'VIEW',
      value: VALUE_PARSERS[kind](source.value, `${path}.value`),
    });
  }
  const source = exact(candidate, path, ['decision', 'value', 'maskReason', 'maskedDisplayKey']);
  if (source.decision !== 'MASK' || source.value !== null) return invalid(path);
  return Object.freeze({
    decision: 'MASK',
    value: null,
    maskReason: text(source.maskReason, `${path}.maskReason`, 64, CODE),
    maskedDisplayKey: text(source.maskedDisplayKey, `${path}.maskedDisplayKey`, 128, DISPLAY_KEY),
  });
}

function parseAction(queryId: Hrm007QueryId, value: unknown, path: string): Hrm007Action {
  const source = exact(value, path, [
    'actionKey',
    'method',
    'hrefTemplate',
    'idempotencyPolicy',
    'stepUpPolicy',
  ]);
  const expected = HRM007_QUERY_CONTRACTS[queryId].actions.find(
    (candidate) => candidate.actionKey === source.actionKey
  );
  if (
    !expected ||
    source.method !== expected.method ||
    source.hrefTemplate !== expected.hrefTemplate ||
    source.idempotencyPolicy !== expected.idempotencyPolicy ||
    source.stepUpPolicy !== expected.stepUpPolicy
  ) {
    return invalid(path);
  }
  return expected;
}

function parseItem(queryId: Hrm007QueryId, value: unknown, index: number): Hrm007Item {
  const path = `items[${index}]`;
  const source = exact(value, path, [
    'itemPublicId',
    'title',
    'statusCode',
    'fieldGroups',
    'deepLink',
    'availableActions',
  ]);
  const contract = HRM007_QUERY_CONTRACTS[queryId];
  const groups = record(source.fieldGroups, `${path}.fieldGroups`);
  const groupKeys = Object.keys(groups);
  if (
    groupKeys.length === 0 ||
    groupKeys.some((key) => !(contract.fieldGroups as readonly string[]).includes(key))
  ) {
    return invalid(`${path}.fieldGroups`);
  }
  const parsedGroups: Record<string, Hrm007FieldDecision> = {};
  for (const key of groupKeys) {
    const kind = (contract.fieldKinds as Readonly<Record<string, keyof typeof VALUE_PARSERS>>)[key];
    if (!kind) return invalid(`${path}.fieldGroups.${key}`);
    parsedGroups[key] = parseDecision(groups[key], `${path}.fieldGroups.${key}`, kind);
  }
  const deepLink = exact(source.deepLink, `${path}.deepLink`, ['route', 'resourcePublicId']);
  if (deepLink.route !== contract.route) return invalid(`${path}.deepLink.route`);
  if (
    !Array.isArray(source.availableActions) ||
    source.availableActions.length > contract.actions.length
  ) {
    return invalid(`${path}.availableActions`);
  }
  const actions = source.availableActions.map((action, actionIndex) =>
    parseAction(queryId, action, `${path}.availableActions[${actionIndex}]`)
  );
  if (new Set(actions.map((action) => action.actionKey)).size !== actions.length) {
    return invalid(`${path}.availableActions`);
  }
  return Object.freeze({
    itemPublicId: text(source.itemPublicId, `${path}.itemPublicId`, 128, PUBLIC_ID),
    title: text(source.title, `${path}.title`, 512),
    statusCode: text(source.statusCode, `${path}.statusCode`, 64, CODE),
    fieldGroups: Object.freeze(parsedGroups),
    deepLink: Object.freeze({
      route: contract.route,
      resourcePublicId: text(
        deepLink.resourcePublicId,
        `${path}.deepLink.resourcePublicId`,
        128,
        PUBLIC_ID
      ),
    }),
    availableActions: Object.freeze(actions),
  });
}

export function selectHrm007Projection(queryId: Hrm007QueryId, value: unknown): Hrm007Projection {
  const source = exact(value, 'root', [
    'projectionVersion',
    'asOf',
    'variantKey',
    'queryState',
    'items',
  ]);
  const contract = HRM007_QUERY_CONTRACTS[queryId];
  if (source.projectionVersion !== '1' || source.variantKey !== contract.variantKey) {
    return invalid('root.variant');
  }
  if (!Array.isArray(source.items) || source.items.length > 500) return invalid('items');
  const items = source.items.map((item, index) => parseItem(queryId, item, index));
  if (new Set(items.map((item) => item.itemPublicId)).size !== items.length) {
    return invalid('items.itemPublicId');
  }
  const query = exact(source.queryState, 'queryState', [
    'state',
    'scopeDecisionRevision',
    'freshness',
    'nextCursor',
    'fieldDecisionSummary',
    'partialFailures',
    'correlationId',
    'cachePolicy',
  ]);
  if (!['COMPLETE', 'EMPTY', 'PARTIAL', 'UNAVAILABLE'].includes(String(query.state))) {
    return invalid('queryState.state');
  }
  if (!['CURRENT', 'STALE', 'UNAVAILABLE'].includes(String(query.freshness))) {
    return invalid('queryState.freshness');
  }
  if (!Array.isArray(query.partialFailures) || query.partialFailures.length > 32) {
    return invalid('queryState.partialFailures');
  }
  const failures = query.partialFailures.map((failureValue, index) => {
    const path = `queryState.partialFailures[${index}]`;
    const failure = exact(failureValue, path, [
      'componentKey',
      'errorCode',
      'correlationId',
      'retryable',
    ]);
    if (typeof failure.retryable !== 'boolean') return invalid(`${path}.retryable`);
    return Object.freeze({
      componentKey: text(failure.componentKey, `${path}.componentKey`, 128, COMPONENT_KEY),
      errorCode: text(failure.errorCode, `${path}.errorCode`, 64, CODE),
      correlationId: uuid(failure.correlationId, `${path}.correlationId`),
      retryable: failure.retryable,
    });
  });
  const state = query.state as Hrm007Projection['queryState']['state'];
  const freshness = query.freshness as Hrm007Projection['queryState']['freshness'];
  const nextCursor =
    query.nextCursor === null
      ? null
      : text(query.nextCursor, 'queryState.nextCursor', 1024, CURSOR);
  if (
    ((state === 'EMPTY' || state === 'UNAVAILABLE') && items.length !== 0) ||
    (state === 'PARTIAL' && failures.length === 0) ||
    (state === 'COMPLETE' && failures.length !== 0) ||
    (state === 'UNAVAILABLE') !== (freshness === 'UNAVAILABLE') ||
    (state === 'UNAVAILABLE' && (items.length !== 0 || nextCursor !== null))
  ) {
    return invalid('queryState.cardinality');
  }
  const counts = items.reduce(
    (summary, item) => {
      const decisions = Object.values(item.fieldGroups);
      summary.viewCount += decisions.filter((decision) => decision.decision === 'VIEW').length;
      summary.maskedCount += decisions.filter((decision) => decision.decision === 'MASK').length;
      summary.omittedCount += contract.fieldGroups.length - decisions.length;
      return summary;
    },
    { viewCount: 0, maskedCount: 0, omittedCount: 0 }
  );
  const summary = exact(query.fieldDecisionSummary, 'queryState.fieldDecisionSummary', [
    'viewCount',
    'maskedCount',
    'omittedCount',
  ]);
  if (
    integer(summary.viewCount, 'queryState.fieldDecisionSummary.viewCount') !== counts.viewCount ||
    integer(summary.maskedCount, 'queryState.fieldDecisionSummary.maskedCount') !==
      counts.maskedCount ||
    integer(summary.omittedCount, 'queryState.fieldDecisionSummary.omittedCount') !==
      counts.omittedCount
  ) {
    return invalid('queryState.fieldDecisionSummary');
  }
  const cache = exact(query.cachePolicy, 'queryState.cachePolicy', [
    'authorizationDecisionRevision',
    'invalidationEvent',
    'maxAgeSeconds',
  ]);
  if (cache.invalidationEvent !== 'dwp.hris.access.assignment.changed.v1') {
    return invalid('queryState.cachePolicy.invalidationEvent');
  }
  return Object.freeze({
    projectionVersion: '1',
    variantKey: contract.variantKey,
    asOf: instant(source.asOf, 'asOf'),
    queryState: Object.freeze({
      state,
      scopeDecisionRevision: text(
        query.scopeDecisionRevision,
        'queryState.scopeDecisionRevision',
        128,
        PUBLIC_ID
      ),
      freshness,
      nextCursor,
      fieldDecisionSummary: Object.freeze(counts),
      partialFailures: Object.freeze(failures),
      correlationId: uuid(query.correlationId, 'queryState.correlationId'),
      cachePolicy: Object.freeze({
        authorizationDecisionRevision: text(
          cache.authorizationDecisionRevision,
          'queryState.cachePolicy.authorizationDecisionRevision',
          128,
          PUBLIC_ID
        ),
        invalidationEvent: 'dwp.hris.access.assignment.changed.v1',
        maxAgeSeconds: integer(cache.maxAgeSeconds, 'queryState.cachePolicy.maxAgeSeconds', 0, 300),
      }),
    }),
    items: Object.freeze(items),
  });
}

type FilterKind =
  'AGGREGATE' | 'STATUS' | 'TEMPORAL' | 'REFERENCE' | 'EFFECTIVE_RANGE' | 'POLICY' | 'DATE';

const FILTER_KEYS: Readonly<Record<FilterKind, readonly string[]>> = Object.freeze({
  AGGREGATE: ['minimumItemCount', 'maximumItemCount'],
  STATUS: ['codes', 'minimumRevision'],
  TEMPORAL: ['startFrom', 'startTo', 'endFrom', 'endTo'],
  REFERENCE: ['codes', 'publicIds'],
  EFFECTIVE_RANGE: ['activeOn', 'from', 'to'],
  POLICY: ['policyKeys', 'minimumRevision'],
  DATE: [],
});

function filterList(value: unknown, path: string, pattern: RegExp) {
  if (!Array.isArray(value) || value.length > 50) return invalid(path);
  const values = value.map((entry, index) => text(entry, `${path}[${index}]`, 128, pattern));
  if (new Set(values).size !== values.length) return invalid(path);
  return Object.freeze(values);
}

function parseFilterValue(kind: FilterKind, value: unknown, path: string): unknown {
  if (kind === 'DATE') return value === null ? null : civilDate(value, path);
  if (value === null) return null;
  const source = exact(value, path, FILTER_KEYS[kind], []);
  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(source)) {
    if (['codes', 'publicIds', 'policyKeys'].includes(key)) {
      result[key] = filterList(entry, `${path}.${key}`, key === 'codes' ? CODE : PUBLIC_ID);
    } else if (key === 'minimumRevision') {
      result[key] = entry === null ? null : integer(entry, `${path}.${key}`, 1);
    } else if (key === 'minimumItemCount' || key === 'maximumItemCount') {
      result[key] = entry === null ? null : integer(entry, `${path}.${key}`);
    } else if (['activeOn', 'from', 'to'].includes(key)) {
      result[key] = entry === null ? null : civilDate(entry, `${path}.${key}`);
    } else {
      result[key] = entry === null ? null : instant(entry, `${path}.${key}`);
    }
  }
  return Object.freeze(result);
}

export function assertHrm007TrustedScope(value: unknown): Hrm007TrustedScope {
  const source = exact(value, 'scope', [
    'contextScopeKey',
    'decisionRevision',
    'locale',
    'timeZone',
    'correlationId',
  ]);
  const locale = text(source.locale, 'scope.locale', 35);
  const timeZone = text(source.timeZone, 'scope.timeZone', 255);
  let canonicalLocale: string;
  let canonicalTimeZone: string;
  try {
    [canonicalLocale] = Intl.getCanonicalLocales(locale);
    canonicalTimeZone = new Intl.DateTimeFormat('en', { timeZone }).resolvedOptions().timeZone;
  } catch {
    return invalid('scope.localeOrTimeZone');
  }
  if (!canonicalLocale || !canonicalTimeZone) return invalid('scope.localeOrTimeZone');
  return Object.freeze({
    contextScopeKey: text(source.contextScopeKey, 'scope.contextScopeKey', 256),
    decisionRevision: text(source.decisionRevision, 'scope.decisionRevision', 128, PUBLIC_ID),
    locale: canonicalLocale,
    timeZone: canonicalTimeZone,
    correlationId: uuid(source.correlationId, 'scope.correlationId'),
  });
}

export function createHrm007QueryRequest(
  queryId: Hrm007QueryId,
  scope: Hrm007TrustedScope,
  options: Hrm007QueryOptions = {}
): Hrm007QueryRequest {
  const trustedScope = assertHrm007TrustedScope(scope);
  const contract = HRM007_QUERY_CONTRACTS[queryId];
  const sourceFilter = options.filter ?? {};
  const rawFilter = record(sourceFilter, 'request.filter');
  const filter: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rawFilter)) {
    const kind = (contract.filterKinds as Readonly<Record<string, FilterKind>>)[key];
    if (!kind) return invalid(`request.filter.${key}`);
    filter[key] = parseFilterValue(kind, value, `request.filter.${key}`);
  }
  const requestedSort = [...(options.sort ?? ['itemPublicId:ASC'])];
  if (!requestedSort.some((sort) => sort.startsWith('itemPublicId:'))) {
    requestedSort.push('itemPublicId:ASC');
  }
  if (
    requestedSort.length < 1 ||
    requestedSort.length > 3 ||
    new Set(requestedSort).size !== requestedSort.length ||
    requestedSort.some((sort) => !(contract.sorts as readonly string[]).includes(sort)) ||
    !requestedSort.at(-1)?.startsWith('itemPublicId:')
  ) {
    return invalid('request.sort');
  }
  const request = {
    limit: 100 as const,
    filter: Object.freeze(filter),
    sort: Object.freeze(requestedSort),
    locale: trustedScope.locale,
    timeZone: trustedScope.timeZone,
    correlationId: trustedScope.correlationId,
    ...(options.asOf === undefined
      ? {}
      : { asOf: options.asOf === null ? null : instant(options.asOf, 'request.asOf') }),
    ...(options.cursor === undefined
      ? {}
      : {
          cursor:
            options.cursor === null ? null : text(options.cursor, 'request.cursor', 1024, CURSOR),
        }),
  };
  return Object.freeze(request);
}

export function assertHrm007QueryRequest(
  queryId: Hrm007QueryId,
  value: unknown
): Hrm007QueryRequest {
  const source = exact(
    value,
    'request',
    ['limit', 'filter', 'sort', 'locale', 'timeZone', 'correlationId', 'asOf', 'cursor'],
    ['limit', 'filter', 'sort', 'locale', 'timeZone', 'correlationId']
  );
  if (source.limit !== 100) return invalid('request.limit');
  const scope = assertHrm007TrustedScope({
    contextScopeKey: 'validated:adapter',
    decisionRevision: 'validated:adapter',
    locale: source.locale,
    timeZone: source.timeZone,
    correlationId: source.correlationId,
  });
  return createHrm007QueryRequest(queryId, scope, {
    filter: record(source.filter, 'request.filter'),
    sort: Array.isArray(source.sort)
      ? source.sort.map((entry) => String(entry))
      : invalid('request.sort'),
    ...('asOf' in source ? { asOf: source.asOf as string | null } : {}),
    ...('cursor' in source ? { cursor: source.cursor as string | null } : {}),
  });
}
