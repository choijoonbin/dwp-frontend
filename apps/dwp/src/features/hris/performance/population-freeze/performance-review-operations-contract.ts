import { Temporal } from 'temporal-polyfill';

export const PERFORMANCE_REVIEW_OPERATIONS_ROUTE =
  '/hr/operations/performance/review-operations' as const;
export const PERFORMANCE_REVIEW_OPERATIONS_ROUTE_CONTRACT =
  'route.hcm.operations.performance-review-operations.page' as const;
export const PERFORMANCE_REVIEW_OPERATIONS_CAPABILITY = 'hcm.operations.performance.view' as const;

export const PERFORMANCE_REVIEW_OPERATION_SORTS = [
  'reviewAssignment:ASC',
  'reviewAssignment:DESC',
  'workQueue:ASC',
  'workQueue:DESC',
  'dueStatus:ASC',
  'dueStatus:DESC',
  'itemPublicId:ASC',
  'itemPublicId:DESC',
] as const;

export type PerformanceReviewOperationSort = (typeof PERFORMANCE_REVIEW_OPERATION_SORTS)[number];

export type PerformanceReviewOperationsFilter = Readonly<{
  reviewAssignment?: Readonly<{
    codes?: readonly string[];
    publicIds?: readonly string[];
  }> | null;
  workQueue?: Readonly<{
    minimumOpenCount?: number | null;
    maximumOpenCount?: number | null;
    slaStates?: readonly string[];
  }> | null;
  dueStatus?: Readonly<{
    codes?: readonly string[];
    minimumRevision?: number | null;
  }> | null;
  effectiveOn?: string | null;
}>;

export type PerformanceReviewOperationsQuery = Readonly<{
  limit: number;
  filter: PerformanceReviewOperationsFilter;
  sort: readonly PerformanceReviewOperationSort[];
  locale: string;
  timeZone: string;
  correlationId: string;
  asOf?: string | null;
  cursor?: string | null;
}>;

export type PerformanceReviewReferenceValue = Readonly<{
  publicId: string;
  code: string;
  label: string;
  revision: number;
}>;

export type PerformanceReviewQueueValue = Readonly<{
  openCount: number;
  oldestAt: string | null;
  slaStatus: string;
  revision: number;
}>;

export type PerformanceReviewStatusValue = Readonly<{
  code: string;
  revision: number;
}>;

export type PerformanceFieldDecision<T> =
  | Readonly<{ decision: 'VIEW'; value: T }>
  | Readonly<{
      decision: 'MASK';
      value: null;
      maskReason: string;
      maskedDisplayKey: string;
    }>;

export type PerformanceReviewOperationItem = Readonly<{
  itemPublicId: string;
  title: string;
  statusCode: string;
  fieldGroups: Readonly<{
    REVIEW_ASSIGNMENT?: PerformanceFieldDecision<PerformanceReviewReferenceValue>;
    WORK_QUEUE?: PerformanceFieldDecision<PerformanceReviewQueueValue>;
    DUE_STATUS?: PerformanceFieldDecision<PerformanceReviewStatusValue>;
  }>;
  deepLink: Readonly<{
    route: typeof PERFORMANCE_REVIEW_OPERATIONS_ROUTE;
    resourcePublicId: string;
  }>;
  availableActions: readonly PerformanceReviewOperationAction[];
}>;

export type PerformanceReviewOperationAction = Readonly<{
  actionKey: 'hris.action.per.preview-population' | 'hris.action.per.freeze-population';
  method: 'POST';
  hrefTemplate:
    | '/api/people/v1/hris/performance/cycles/{cycleId}/population-previews'
    | '/api/people/v1/hris/performance/cycles/{cycleId}/population-freezes';
  idempotencyPolicy: 'REQUIRED_IDEMPOTENCY_KEY';
  stepUpPolicy: 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED';
}>;

export type PerformanceReviewOperationsProjection = Readonly<{
  projectionVersion: '1';
  asOf: string;
  variantKey: 'REVIEW_OPERATIONS';
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
  items: readonly PerformanceReviewOperationItem[];
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CODE = /^[A-Z][A-Z0-9_]{1,63}$/;
const PUBLIC_ID = /^[A-Za-z0-9._:-]{1,128}$/;
const DISPLAY_KEY = /^[a-z][a-z0-9._-]{1,127}$/;
const CURSOR = /^[A-Za-z0-9_-]{16,1024}$/;

function invalid(): never {
  throw new Error('Performance review-operations projection is invalid.');
}

function exactRecord(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return invalid();
  const source = value as Record<string, unknown>;
  const actual = Object.keys(source).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    return invalid();
  }
  return source;
}

function text(value: unknown, maximum: number, pattern?: RegExp): string {
  if (
    typeof value !== 'string' ||
    !value ||
    value !== value.trim() ||
    value.length > maximum ||
    (pattern && !pattern.test(value))
  ) {
    return invalid();
  }
  return value;
}

function integer(value: unknown, minimum = 0, maximum = Number.MAX_SAFE_INTEGER): number {
  return typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= minimum &&
    value <= maximum
    ? value
    : invalid();
}

function instant(value: unknown): string {
  const candidate = text(value, 100);
  try {
    Temporal.Instant.from(candidate);
    return candidate;
  } catch {
    return invalid();
  }
}

function nullableInstant(value: unknown): string | null {
  return value === null ? null : instant(value);
}

function uuid(value: unknown): string {
  return text(value, 36, UUID);
}

function array(value: unknown, maximum: number): unknown[] {
  return Array.isArray(value) && value.length <= maximum ? value : invalid();
}

function decision<T>(
  value: unknown,
  parseValue: (source: unknown) => T
): PerformanceFieldDecision<T> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  const source = value as Record<string, unknown>;
  if (source.decision === 'VIEW') {
    const exact = exactRecord(source, ['decision', 'value']);
    return Object.freeze({ decision: 'VIEW', value: parseValue(exact.value) });
  }
  if (source.decision === 'MASK') {
    const exact = exactRecord(source, ['decision', 'value', 'maskReason', 'maskedDisplayKey']);
    if (exact.value !== null) return invalid();
    return Object.freeze({
      decision: 'MASK',
      value: null,
      maskReason: text(exact.maskReason, 64, CODE),
      maskedDisplayKey: text(exact.maskedDisplayKey, 128, DISPLAY_KEY),
    });
  }
  return invalid();
}

function referenceValue(value: unknown): PerformanceReviewReferenceValue {
  const source = exactRecord(value, ['publicId', 'code', 'label', 'revision']);
  return Object.freeze({
    publicId: text(source.publicId, 128, PUBLIC_ID),
    code: text(source.code, 64, CODE),
    label: text(source.label, 512),
    revision: integer(source.revision, 1),
  });
}

function queueValue(value: unknown): PerformanceReviewQueueValue {
  const source = exactRecord(value, ['openCount', 'oldestAt', 'slaStatus', 'revision']);
  return Object.freeze({
    openCount: integer(source.openCount),
    oldestAt: nullableInstant(source.oldestAt),
    slaStatus: text(source.slaStatus, 64, CODE),
    revision: integer(source.revision, 1),
  });
}

function statusValue(value: unknown): PerformanceReviewStatusValue {
  const source = exactRecord(value, ['code', 'revision']);
  return Object.freeze({
    code: text(source.code, 64, CODE),
    revision: integer(source.revision, 1),
  });
}

function action(value: unknown): PerformanceReviewOperationAction {
  const source = exactRecord(value, [
    'actionKey',
    'method',
    'hrefTemplate',
    'idempotencyPolicy',
    'stepUpPolicy',
  ]);
  if (
    source.method !== 'POST' ||
    source.idempotencyPolicy !== 'REQUIRED_IDEMPOTENCY_KEY' ||
    source.stepUpPolicy !== 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED'
  ) {
    return invalid();
  }
  if (
    source.actionKey === 'hris.action.per.preview-population' &&
    source.hrefTemplate === '/api/people/v1/hris/performance/cycles/{cycleId}/population-previews'
  ) {
    return Object.freeze({
      actionKey: source.actionKey,
      method: source.method,
      hrefTemplate: source.hrefTemplate,
      idempotencyPolicy: source.idempotencyPolicy,
      stepUpPolicy: source.stepUpPolicy,
    });
  }
  if (
    source.actionKey === 'hris.action.per.freeze-population' &&
    source.hrefTemplate === '/api/people/v1/hris/performance/cycles/{cycleId}/population-freezes'
  ) {
    return Object.freeze({
      actionKey: source.actionKey,
      method: source.method,
      hrefTemplate: source.hrefTemplate,
      idempotencyPolicy: source.idempotencyPolicy,
      stepUpPolicy: source.stepUpPolicy,
    });
  }
  return invalid();
}

function item(value: unknown): PerformanceReviewOperationItem {
  const source = exactRecord(value, [
    'itemPublicId',
    'title',
    'statusCode',
    'fieldGroups',
    'deepLink',
    'availableActions',
  ]);
  if (
    !source.fieldGroups ||
    typeof source.fieldGroups !== 'object' ||
    Array.isArray(source.fieldGroups)
  ) {
    return invalid();
  }
  const rawGroups = source.fieldGroups as Record<string, unknown>;
  const keys = Object.keys(rawGroups);
  if (
    keys.length < 1 ||
    keys.some((key) => !['REVIEW_ASSIGNMENT', 'WORK_QUEUE', 'DUE_STATUS'].includes(key))
  ) {
    return invalid();
  }
  const groups: PerformanceReviewOperationItem['fieldGroups'] = Object.freeze({
    ...(rawGroups.REVIEW_ASSIGNMENT === undefined
      ? {}
      : { REVIEW_ASSIGNMENT: decision(rawGroups.REVIEW_ASSIGNMENT, referenceValue) }),
    ...(rawGroups.WORK_QUEUE === undefined
      ? {}
      : { WORK_QUEUE: decision(rawGroups.WORK_QUEUE, queueValue) }),
    ...(rawGroups.DUE_STATUS === undefined
      ? {}
      : { DUE_STATUS: decision(rawGroups.DUE_STATUS, statusValue) }),
  });
  const link = exactRecord(source.deepLink, ['route', 'resourcePublicId']);
  if (link.route !== PERFORMANCE_REVIEW_OPERATIONS_ROUTE) return invalid();
  const resourcePublicId = text(link.resourcePublicId, 128, PUBLIC_ID);
  const itemPublicId = text(source.itemPublicId, 128, PUBLIC_ID);
  const assignment = groups.REVIEW_ASSIGNMENT;
  if (
    itemPublicId !== `performance-cycle:${resourcePublicId}` ||
    (assignment?.decision === 'VIEW' && assignment.value.publicId !== resourcePublicId)
  ) {
    return invalid();
  }
  const actions = array(source.availableActions, 2).map(action);
  if (new Set(actions.map((candidate) => candidate.actionKey)).size !== actions.length) {
    return invalid();
  }
  return Object.freeze({
    itemPublicId,
    title: text(source.title, 512),
    statusCode: text(source.statusCode, 64, CODE),
    fieldGroups: groups,
    deepLink: Object.freeze({
      route: PERFORMANCE_REVIEW_OPERATIONS_ROUTE,
      resourcePublicId,
    }),
    availableActions: Object.freeze(actions),
  });
}

function queryState(value: unknown): PerformanceReviewOperationsProjection['queryState'] {
  const source = exactRecord(value, [
    'state',
    'scopeDecisionRevision',
    'freshness',
    'nextCursor',
    'fieldDecisionSummary',
    'partialFailures',
    'correlationId',
    'cachePolicy',
  ]);
  if (!['COMPLETE', 'EMPTY', 'PARTIAL', 'UNAVAILABLE'].includes(String(source.state))) {
    return invalid();
  }
  if (!['CURRENT', 'STALE', 'UNAVAILABLE'].includes(String(source.freshness))) return invalid();
  const summary = exactRecord(source.fieldDecisionSummary, [
    'viewCount',
    'maskedCount',
    'omittedCount',
  ]);
  const failures = array(source.partialFailures, 32).map((entry) => {
    const failure = exactRecord(entry, ['componentKey', 'errorCode', 'correlationId', 'retryable']);
    if (typeof failure.retryable !== 'boolean') return invalid();
    return Object.freeze({
      componentKey: text(failure.componentKey, 128, DISPLAY_KEY),
      errorCode: text(failure.errorCode, 64, CODE),
      correlationId: uuid(failure.correlationId),
      retryable: failure.retryable,
    });
  });
  const cache = exactRecord(source.cachePolicy, [
    'authorizationDecisionRevision',
    'invalidationEvent',
    'maxAgeSeconds',
  ]);
  if (cache.invalidationEvent !== 'dwp.hris.access.assignment.changed.v1') return invalid();
  const nextCursor = source.nextCursor === null ? null : text(source.nextCursor, 1024, CURSOR);
  return Object.freeze({
    state: source.state as PerformanceReviewOperationsProjection['queryState']['state'],
    scopeDecisionRevision: text(source.scopeDecisionRevision, 128, PUBLIC_ID),
    freshness: source.freshness as PerformanceReviewOperationsProjection['queryState']['freshness'],
    nextCursor,
    fieldDecisionSummary: Object.freeze({
      viewCount: integer(summary.viewCount),
      maskedCount: integer(summary.maskedCount),
      omittedCount: integer(summary.omittedCount),
    }),
    partialFailures: Object.freeze(failures),
    correlationId: uuid(source.correlationId),
    cachePolicy: Object.freeze({
      authorizationDecisionRevision: text(cache.authorizationDecisionRevision, 128, PUBLIC_ID),
      invalidationEvent: 'dwp.hris.access.assignment.changed.v1',
      maxAgeSeconds: integer(cache.maxAgeSeconds, 0, 300),
    }),
  });
}

export function parsePerformanceReviewOperationsProjection(
  value: unknown
): PerformanceReviewOperationsProjection {
  const source = exactRecord(value, [
    'projectionVersion',
    'asOf',
    'variantKey',
    'queryState',
    'items',
  ]);
  if (source.projectionVersion !== '1' || source.variantKey !== 'REVIEW_OPERATIONS') {
    return invalid();
  }
  const state = queryState(source.queryState);
  const items = array(source.items, 500).map(item);
  if (
    (['EMPTY', 'UNAVAILABLE'].includes(state.state) && items.length !== 0) ||
    (state.state === 'PARTIAL' && state.partialFailures.length === 0) ||
    (state.state === 'COMPLETE' && state.partialFailures.length !== 0) ||
    (state.state === 'UNAVAILABLE' &&
      (state.freshness !== 'UNAVAILABLE' || state.nextCursor !== null))
  ) {
    return invalid();
  }
  let viewCount = 0;
  let maskedCount = 0;
  let omittedCount = 0;
  for (const candidate of items) {
    for (const key of ['REVIEW_ASSIGNMENT', 'WORK_QUEUE', 'DUE_STATUS'] as const) {
      const field = candidate.fieldGroups[key];
      if (!field) omittedCount += 1;
      else if (field.decision === 'VIEW') viewCount += 1;
      else maskedCount += 1;
    }
  }
  if (
    state.fieldDecisionSummary.viewCount !== viewCount ||
    state.fieldDecisionSummary.maskedCount !== maskedCount ||
    state.fieldDecisionSummary.omittedCount !== omittedCount
  ) {
    return invalid();
  }
  return Object.freeze({
    projectionVersion: '1',
    asOf: instant(source.asOf),
    variantKey: 'REVIEW_OPERATIONS',
    queryState: state,
    items: Object.freeze(items),
  });
}
