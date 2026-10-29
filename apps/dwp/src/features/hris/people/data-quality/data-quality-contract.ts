import { resolveCanonicalTimeZone } from '@dwp-frontend/shared-i18n';

export const HRM012_FEATURE = 'HRIS_HRM_DATA_QUALITY_WORKBENCH' as const;
export const HRM012_ADAPTER_KIND = 'HRIS_HRM_012_ENTRY_QUERY_V1' as const;
export const HRM012_QUERY_ID = 'IAQ-012' as const;
export const HRM012_FIELD_GROUPS = [
  'INGESTION_STATUS',
  'QUALITY_FINDING',
  'COMMAND_RECEIPT',
] as const;

export const HRM012_QUERY_CONTRACT = Object.freeze({
  queryId: HRM012_QUERY_ID,
  operationId: 'IAQ.OP.012',
  iaNodeId: 'BASE:hr-data-quality',
  variantKey: 'DATA_QUALITY',
  browserPath: '/api/people/v1/hris/workbench/operations/data/quality',
  ownerPath: '/v1/hris/workbench/operations/data/quality',
  route: '/hr/operations/people/data-quality',
  deepLinkTemplate: '/hr/operations/people/data-quality?tab=overview&focus={resourcePublicId}',
  capability: 'hcm.operations.people.view',
  purpose: 'HR_OPERATIONS',
  fieldGroups: Object.freeze(HRM012_FIELD_GROUPS),
  filters: Object.freeze(['ingestionStatus', 'qualityFinding', 'commandReceipt', 'effectiveOn']),
  sorts: Object.freeze([
    'ingestionStatus:ASC',
    'qualityFinding:ASC',
    'commandReceipt:ASC',
    'ingestionStatus:DESC',
    'qualityFinding:DESC',
    'commandReceipt:DESC',
    'itemPublicId:ASC',
    'itemPublicId:DESC',
  ]),
  defaultSort: 'itemPublicId:ASC',
  pageLimit: 100,
  availableActions: Object.freeze([]),
  framing: Object.freeze({
    primaryUser: 'HR operations data-quality analyst with an authorized target population',
    operationalQuestion:
      'Which ingestion runs or quality findings need attention, and can their authorized evidence be reconciled without disclosing restricted source values?',
    primaryAction: 'Inspect a selected run, finding, and command receipt.',
    archetype: 'command-center-with-list-detail-inspector',
  }),
} as const);

export type Hrm012StatusValue = Readonly<{ code: string; revision: number }>;
export type Hrm012AuditValue = Readonly<{
  decisionCode: string;
  evidenceDigest: string;
  occurredAt: string;
  revision: number;
}>;
export type Hrm012ReceiptValue = Readonly<{
  receiptId: string;
  state: string;
  occurredAt: string;
  revision: number;
}>;
export type Hrm012FieldValue = Hrm012StatusValue | Hrm012AuditValue | Hrm012ReceiptValue;
export type Hrm012FieldDecision =
  | Readonly<{ decision: 'VIEW'; value: Hrm012FieldValue }>
  | Readonly<{
      decision: 'MASK';
      value: null;
      maskReason: string;
      maskedDisplayKey: string;
    }>;
export type Hrm012FieldGroups = Readonly<
  Partial<Record<(typeof HRM012_QUERY_CONTRACT.fieldGroups)[number], Hrm012FieldDecision>>
>;

export type Hrm012Item = Readonly<{
  itemPublicId: string;
  title: string;
  statusCode: string;
  fieldGroups: Hrm012FieldGroups;
  deepLink: Readonly<{
    route: typeof HRM012_QUERY_CONTRACT.route;
    resourcePublicId: string;
  }>;
  availableActions: readonly [];
}>;

export type Hrm012QueryState = Readonly<{
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

export type Hrm012Projection = Readonly<{
  projectionVersion: '1';
  variantKey: typeof HRM012_QUERY_CONTRACT.variantKey;
  asOf: string;
  queryState: Hrm012QueryState;
  items: readonly Hrm012Item[];
}>;

export type Hrm012TrustedScope = Readonly<{
  contextScopeKey: string;
  decisionRevision: string;
  locale: string;
  timeZone: string;
  correlationId: string;
}>;

export type Hrm012QueryOptions = Readonly<{
  filter?: Readonly<Record<string, unknown>>;
  sort?: readonly string[];
  asOf?: string | null;
  cursor?: string | null;
}>;

export type Hrm012QueryRequest = Readonly<{
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
const DIGEST = /^[0-9a-f]{64}$/u;
const CURSOR = /^[A-Za-z0-9_-]{16,1024}$/u;
const CIVIL_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const INSTANT =
  /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/u;

export class Hrm012ContractError extends Error {
  readonly kind = 'HRM012_CONTRACT_OR_REVISION_ERROR' as const;

  constructor(path: string) {
    super(`Invalid HRM-012 contract: ${path}`);
    this.name = 'Hrm012ContractError';
  }
}

function invalid(path: string): never {
  throw new Hrm012ContractError(path);
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

function uuid(value: unknown, path: string): string {
  return text(value, path, 36, UUID).toLowerCase();
}

function instant(value: unknown, path: string): string {
  const candidate = text(value, path, 64, INSTANT);
  civilDate(candidate.slice(0, 10), path);
  if (!Number.isFinite(Date.parse(candidate))) return invalid(path);
  return candidate;
}

function civilDate(value: unknown, path: string): string {
  const candidate = text(value, path, 10, CIVIL_DATE);
  const [year, month, day] = candidate.split('-').map(Number);
  const parsed = new Date(Date.UTC(year!, month! - 1, day!));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() + 1 !== month ||
    parsed.getUTCDate() !== day
  ) {
    return invalid(path);
  }
  return candidate;
}

function stringList(value: unknown, path: string, pattern: RegExp) {
  if (!Array.isArray(value) || value.length > 50) return invalid(path);
  const values = value.map((entry, index) => text(entry, `${path}[${index}]`, 128, pattern));
  if (new Set(values).size !== values.length) return invalid(path);
  return Object.freeze(values);
}

function parseStatusValue(value: unknown, path: string): Hrm012StatusValue {
  const source = exact(value, path, ['code', 'revision']);
  return Object.freeze({
    code: text(source.code, `${path}.code`, 64, CODE),
    revision: integer(source.revision, `${path}.revision`, 1),
  });
}

function parseAuditValue(value: unknown, path: string): Hrm012AuditValue {
  const source = exact(value, path, ['decisionCode', 'evidenceDigest', 'occurredAt', 'revision']);
  return Object.freeze({
    decisionCode: text(source.decisionCode, `${path}.decisionCode`, 64, CODE),
    evidenceDigest: text(source.evidenceDigest, `${path}.evidenceDigest`, 64, DIGEST),
    occurredAt: instant(source.occurredAt, `${path}.occurredAt`),
    revision: integer(source.revision, `${path}.revision`, 1),
  });
}

function parseReceiptValue(value: unknown, path: string): Hrm012ReceiptValue {
  const source = exact(value, path, ['receiptId', 'state', 'occurredAt', 'revision']);
  return Object.freeze({
    receiptId: uuid(source.receiptId, `${path}.receiptId`),
    state: text(source.state, `${path}.state`, 64, CODE),
    occurredAt: instant(source.occurredAt, `${path}.occurredAt`),
    revision: integer(source.revision, `${path}.revision`, 1),
  });
}

function parseDecision(
  group: (typeof HRM012_QUERY_CONTRACT.fieldGroups)[number],
  value: unknown,
  path: string
): Hrm012FieldDecision {
  const candidate = record(value, path);
  if (candidate.decision === 'VIEW') {
    const source = exact(candidate, path, ['decision', 'value']);
    const parsedValue =
      group === 'INGESTION_STATUS'
        ? parseStatusValue(source.value, `${path}.value`)
        : group === 'QUALITY_FINDING'
          ? parseAuditValue(source.value, `${path}.value`)
          : parseReceiptValue(source.value, `${path}.value`);
    return Object.freeze({ decision: 'VIEW', value: parsedValue });
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

function parseItem(value: unknown, index: number): Hrm012Item {
  const path = `items[${index}]`;
  const source = exact(value, path, [
    'itemPublicId',
    'title',
    'statusCode',
    'fieldGroups',
    'deepLink',
    'availableActions',
  ]);
  const itemPublicId = text(source.itemPublicId, `${path}.itemPublicId`, 128, PUBLIC_ID);
  const groups = record(source.fieldGroups, `${path}.fieldGroups`);
  const groupKeys = Object.keys(groups);
  if (
    groupKeys.length === 0 ||
    groupKeys.some((key) => !(HRM012_QUERY_CONTRACT.fieldGroups as readonly string[]).includes(key))
  ) {
    return invalid(`${path}.fieldGroups`);
  }
  const fieldGroups: Partial<Record<string, Hrm012FieldDecision>> = {};
  groupKeys.forEach((key) => {
    fieldGroups[key] = parseDecision(
      key as (typeof HRM012_QUERY_CONTRACT.fieldGroups)[number],
      groups[key],
      `${path}.fieldGroups.${key}`
    );
  });
  const deepLink = exact(source.deepLink, `${path}.deepLink`, ['route', 'resourcePublicId']);
  if (deepLink.route !== HRM012_QUERY_CONTRACT.route) return invalid(`${path}.deepLink.route`);
  const deepLinkResource = text(
    deepLink.resourcePublicId,
    `${path}.deepLink.resourcePublicId`,
    128,
    PUBLIC_ID
  );
  if (deepLinkResource !== itemPublicId) return invalid(`${path}.deepLink.resourcePublicId`);
  if (!Array.isArray(source.availableActions) || source.availableActions.length !== 0) {
    return invalid(`${path}.availableActions`);
  }
  return Object.freeze({
    itemPublicId,
    title: text(source.title, `${path}.title`, 512),
    statusCode: text(source.statusCode, `${path}.statusCode`, 64, CODE),
    fieldGroups: Object.freeze(fieldGroups),
    deepLink: Object.freeze({
      route: HRM012_QUERY_CONTRACT.route,
      resourcePublicId: deepLinkResource,
    }),
    availableActions: Object.freeze([] as const),
  });
}

export function selectHrm012Projection(value: unknown): Hrm012Projection {
  const source = exact(value, 'root', [
    'projectionVersion',
    'asOf',
    'variantKey',
    'queryState',
    'items',
  ]);
  if (source.projectionVersion !== '1' || source.variantKey !== HRM012_QUERY_CONTRACT.variantKey) {
    return invalid('root.variant');
  }
  if (!Array.isArray(source.items) || source.items.length > HRM012_QUERY_CONTRACT.pageLimit) {
    return invalid('items');
  }
  const items = source.items.map(parseItem);
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
  const partialFailures = query.partialFailures.map((value, index) => {
    const path = `queryState.partialFailures[${index}]`;
    const failure = exact(value, path, ['componentKey', 'errorCode', 'correlationId', 'retryable']);
    if (typeof failure.retryable !== 'boolean') return invalid(`${path}.retryable`);
    return Object.freeze({
      componentKey: text(failure.componentKey, `${path}.componentKey`, 128, COMPONENT_KEY),
      errorCode: text(failure.errorCode, `${path}.errorCode`, 64, CODE),
      correlationId: uuid(failure.correlationId, `${path}.correlationId`),
      retryable: failure.retryable,
    });
  });
  if (
    new Set(partialFailures.map((failure) => JSON.stringify(failure))).size !==
    partialFailures.length
  ) {
    return invalid('queryState.partialFailures.uniqueItems');
  }
  const state = query.state as Hrm012QueryState['state'];
  const freshness = query.freshness as Hrm012QueryState['freshness'];
  const nextCursor =
    query.nextCursor === null
      ? null
      : text(query.nextCursor, 'queryState.nextCursor', 1024, CURSOR);
  if (
    ((state === 'EMPTY' || state === 'UNAVAILABLE') && items.length !== 0) ||
    (state === 'PARTIAL' && partialFailures.length === 0) ||
    ((state === 'COMPLETE' || state === 'EMPTY') && partialFailures.length > 0) ||
    (state === 'UNAVAILABLE') !== (freshness === 'UNAVAILABLE') ||
    (state === 'UNAVAILABLE' && nextCursor !== null)
  ) {
    return invalid('queryState.cardinality');
  }
  const counts = items.reduce(
    (summary, item) => {
      const decisions = Object.values(item.fieldGroups).filter(
        (decision): decision is Hrm012FieldDecision => decision !== undefined
      );
      summary.viewCount += decisions.filter((decision) => decision.decision === 'VIEW').length;
      summary.maskedCount += decisions.filter((decision) => decision.decision === 'MASK').length;
      summary.omittedCount += HRM012_QUERY_CONTRACT.fieldGroups.length - decisions.length;
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
    variantKey: HRM012_QUERY_CONTRACT.variantKey,
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
      partialFailures: Object.freeze(partialFailures),
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

function parseStatusFilter(value: unknown, path: string) {
  if (value === null) return null;
  const source = exact(value, path, ['codes', 'minimumRevision'], []);
  return Object.freeze({
    ...('codes' in source ? { codes: stringList(source.codes, `${path}.codes`, CODE) } : {}),
    ...('minimumRevision' in source
      ? {
          minimumRevision:
            source.minimumRevision === null
              ? null
              : integer(source.minimumRevision, `${path}.minimumRevision`, 1),
        }
      : {}),
  });
}

function parseAuditFilter(value: unknown, path: string) {
  if (value === null) return null;
  const source = exact(value, path, ['decisionCodes', 'evidenceDigest'], []);
  return Object.freeze({
    ...('decisionCodes' in source
      ? { decisionCodes: stringList(source.decisionCodes, `${path}.decisionCodes`, CODE) }
      : {}),
    ...('evidenceDigest' in source
      ? {
          evidenceDigest:
            source.evidenceDigest === null
              ? null
              : text(source.evidenceDigest, `${path}.evidenceDigest`, 64, DIGEST),
        }
      : {}),
  });
}

function parseReceiptFilter(value: unknown, path: string) {
  if (value === null) return null;
  const source = exact(value, path, ['receiptIds', 'states'], []);
  return Object.freeze({
    ...('receiptIds' in source
      ? { receiptIds: stringList(source.receiptIds, `${path}.receiptIds`, PUBLIC_ID) }
      : {}),
    ...('states' in source ? { states: stringList(source.states, `${path}.states`, CODE) } : {}),
  });
}

function parseFilter(value: unknown, path: string) {
  const source = exact(value, path, HRM012_QUERY_CONTRACT.filters, []);
  return Object.freeze({
    ...('ingestionStatus' in source
      ? { ingestionStatus: parseStatusFilter(source.ingestionStatus, `${path}.ingestionStatus`) }
      : {}),
    ...('qualityFinding' in source
      ? { qualityFinding: parseAuditFilter(source.qualityFinding, `${path}.qualityFinding`) }
      : {}),
    ...('commandReceipt' in source
      ? { commandReceipt: parseReceiptFilter(source.commandReceipt, `${path}.commandReceipt`) }
      : {}),
    ...('effectiveOn' in source
      ? {
          effectiveOn:
            source.effectiveOn === null
              ? null
              : civilDate(source.effectiveOn, `${path}.effectiveOn`),
        }
      : {}),
  });
}

export function assertHrm012TrustedScope(value: unknown): Hrm012TrustedScope {
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
    canonicalTimeZone = resolveCanonicalTimeZone(timeZone) ?? invalid('scope.localeOrTimeZone');
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

export function createHrm012QueryRequest(
  scopeValue: Hrm012TrustedScope,
  options: Hrm012QueryOptions = {}
): Hrm012QueryRequest {
  const scope = assertHrm012TrustedScope(scopeValue);
  const requestedSort = [...(options.sort ?? [HRM012_QUERY_CONTRACT.defaultSort])];
  if (!requestedSort.some((sort) => sort.startsWith('itemPublicId:'))) {
    requestedSort.push(HRM012_QUERY_CONTRACT.defaultSort);
  }
  if (
    requestedSort.length < 1 ||
    requestedSort.length > 3 ||
    new Set(requestedSort).size !== requestedSort.length ||
    requestedSort.some(
      (sort) => !(HRM012_QUERY_CONTRACT.sorts as readonly string[]).includes(sort)
    ) ||
    !requestedSort.at(-1)?.startsWith('itemPublicId:')
  ) {
    return invalid('request.sort');
  }
  return Object.freeze({
    limit: HRM012_QUERY_CONTRACT.pageLimit,
    filter: parseFilter(options.filter ?? {}, 'request.filter'),
    sort: Object.freeze(requestedSort),
    locale: scope.locale,
    timeZone: scope.timeZone,
    correlationId: scope.correlationId,
    ...(options.asOf === undefined
      ? {}
      : { asOf: options.asOf === null ? null : instant(options.asOf, 'request.asOf') }),
    ...(options.cursor === undefined
      ? {}
      : {
          cursor:
            options.cursor === null ? null : text(options.cursor, 'request.cursor', 1024, CURSOR),
        }),
  });
}

export function assertHrm012QueryRequest(value: unknown): Hrm012QueryRequest {
  const source = exact(
    value,
    'request',
    ['limit', 'filter', 'sort', 'locale', 'timeZone', 'correlationId', 'asOf', 'cursor'],
    ['limit', 'filter', 'sort', 'locale', 'timeZone', 'correlationId']
  );
  if (source.limit !== HRM012_QUERY_CONTRACT.pageLimit) return invalid('request.limit');
  const scope = assertHrm012TrustedScope({
    contextScopeKey: 'assertion-only',
    decisionRevision: 'assertion-only',
    locale: source.locale,
    timeZone: source.timeZone,
    correlationId: source.correlationId,
  });
  return createHrm012QueryRequest(scope, {
    filter: record(source.filter, 'request.filter'),
    sort: Array.isArray(source.sort) ? source.sort.map((entry) => String(entry)) : [],
    ...('asOf' in source
      ? { asOf: source.asOf === null ? null : text(source.asOf, 'request.asOf', 64) }
      : {}),
    ...('cursor' in source
      ? { cursor: source.cursor === null ? null : text(source.cursor, 'request.cursor', 1024) }
      : {}),
  });
}
