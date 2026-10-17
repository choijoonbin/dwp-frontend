import type { HrisCommandReceipt } from '../../people/command-receipts/model/command-receipt';

export const HRM009_FEATURE = 'HRIS_HRM_CERTIFICATE_WORKBENCH' as const;
export const HRM009_ADAPTER_KIND = 'HRIS_HRM_009_STAGE_A_ENTRY_QUERY_V1' as const;
export const HRM009_REQUEST_CERTIFICATE_ROUTE_CONTRACT =
  'route.hcm.operations.certificate-issue.action' as const;

export const HRM009_QUERY_IDS = ['IAQ-003', 'IAQ-010'] as const;
export type Hrm009QueryId = (typeof HRM009_QUERY_IDS)[number];

const REQUEST_CERTIFICATE_ACTION = Object.freeze({
  actionKey: 'hris.action.hrm.request-certificate',
  method: 'POST',
  hrefTemplate: '/api/people/v1/hris/certificates',
  idempotencyPolicy: 'REQUIRED_IDEMPOTENCY_KEY',
  stepUpPolicy: 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED',
} as const);

const CREATE_EMPLOYEE_CHANGE_ACTION = Object.freeze({
  actionKey: 'hris.action.hrm.create-employee-change-request',
  method: 'POST',
  hrefTemplate: '/api/people/v1/hris/employee-change-requests',
  idempotencyPolicy: 'REQUIRED_IDEMPOTENCY_KEY',
  stepUpPolicy: 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED',
} as const);

const SUBMIT_EMPLOYEE_CHANGE_ACTION = Object.freeze({
  actionKey: 'hris.action.hrm.submit-employee-change-request',
  method: 'POST',
  hrefTemplate: '/api/people/v1/hris/employee-change-requests/{requestPublicId}/submit',
  idempotencyPolicy: 'REQUIRED_IDEMPOTENCY_KEY',
  stepUpPolicy: 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED',
} as const);

export const HRM009_QUERY_CONTRACTS = Object.freeze({
  'IAQ-003': Object.freeze({
    queryId: 'IAQ-003',
    operationId: 'IAQ.OP.003',
    iaNodeId: 'BASE:my-hr-requests',
    variantKey: 'REQUESTS',
    path: '/api/people/v1/hris/workbench/self-service/requests',
    ownerPath: '/v1/hris/workbench/self-service/requests',
    route: '/hr/me/requests',
    capability: 'hcm.personal.requests.view',
    purpose: 'EMPLOYEE_SELF_SERVICE',
    population: Object.freeze(['SELF']),
    fieldGroups: Object.freeze(['REQUEST_SUMMARY', 'REQUEST_STATUS', 'COMMAND_RECEIPT']),
    filterKinds: Object.freeze({
      requestSummary: 'AGGREGATE',
      requestStatus: 'STATUS',
      commandReceipt: 'RECEIPT',
      effectiveOn: 'DATE',
    }),
    sorts: Object.freeze([
      'requestSummary:ASC',
      'requestStatus:ASC',
      'commandReceipt:ASC',
      'requestSummary:DESC',
      'requestStatus:DESC',
      'commandReceipt:DESC',
      'itemPublicId:ASC',
      'itemPublicId:DESC',
    ]),
    actions: Object.freeze([
      CREATE_EMPLOYEE_CHANGE_ACTION,
      SUBMIT_EMPLOYEE_CHANGE_ACTION,
      REQUEST_CERTIFICATE_ACTION,
    ]),
    framing: Object.freeze({
      primaryUser: 'Employee',
      operationalQuestion:
        'Which governed HR requests can I review, and can I request a certificate now?',
      primaryAction: 'Request certificate',
      archetype: 'list-detail',
    }),
  }),
  'IAQ-010': Object.freeze({
    queryId: 'IAQ-010',
    operationId: 'IAQ.OP.010',
    iaNodeId: 'BASE:hr-certificates-documents',
    variantKey: 'CERTIFICATES_DOCUMENTS',
    path: '/api/people/v1/hris/workbench/operations/certificates/documents',
    ownerPath: '/v1/hris/workbench/operations/certificates/documents',
    route: '/hr/operations/people/certificates-documents',
    capability: 'hcm.operations.people.view',
    purpose: 'HR_OPERATIONS',
    population: Object.freeze(['LEGAL_ENTITY', 'NAMED_POPULATION', 'ORG_TREE', 'ORG_UNIT']),
    fieldGroups: Object.freeze(['CERTIFICATE_METADATA', 'DOCUMENT_METADATA']),
    filterKinds: Object.freeze({
      certificateMetadata: 'METADATA',
      documentMetadata: 'METADATA',
      effectiveOn: 'DATE',
    }),
    sorts: Object.freeze([
      'certificateMetadata:ASC',
      'documentMetadata:ASC',
      'certificateMetadata:DESC',
      'documentMetadata:DESC',
      'itemPublicId:ASC',
      'itemPublicId:DESC',
    ]),
    actions: Object.freeze([REQUEST_CERTIFICATE_ACTION]),
    framing: Object.freeze({
      primaryUser: 'HR operations certificate issuer',
      operationalQuestion:
        'Which certificate metadata in my authorized population needs an issuance decision?',
      primaryAction: 'Issue certificate request',
      archetype: 'focus-form',
    }),
  }),
} as const);

export const HRM009_TEAM_MANAGEMENT_DISPOSITION = 'DENY_DEFER_NO_PROFILE_NO_FALLBACK' as const;

export type Hrm009Action =
  | typeof REQUEST_CERTIFICATE_ACTION
  | typeof CREATE_EMPLOYEE_CHANGE_ACTION
  | typeof SUBMIT_EMPLOYEE_CHANGE_ACTION;

export type Hrm009AggregateValue = Readonly<{
  itemCount: number;
  revision: number;
  asOf: string;
}>;
export type Hrm009StatusValue = Readonly<{ code: string; revision: number }>;
export type Hrm009ReceiptValue = Readonly<{
  receiptId: string;
  state: string;
  occurredAt: string;
  revision: number;
}>;
export type Hrm009MetadataValue = Readonly<{
  key: string;
  version: string;
  digest: string | null;
}>;
export type Hrm009FieldValue =
  Hrm009AggregateValue | Hrm009StatusValue | Hrm009ReceiptValue | Hrm009MetadataValue;
export type Hrm009FieldDecision =
  | Readonly<{ decision: 'VIEW'; value: Hrm009FieldValue }>
  | Readonly<{
      decision: 'MASK';
      value: null;
      maskReason: string;
      maskedDisplayKey: string;
    }>;

export type Hrm009Item = Readonly<{
  itemPublicId: string;
  title: string;
  statusCode: string;
  fieldGroups: Readonly<Record<string, Hrm009FieldDecision>>;
  deepLink: Readonly<{ route: string; resourcePublicId: string }>;
  availableActions: readonly Hrm009Action[];
}>;

export type Hrm009Projection = Readonly<{
  projectionVersion: '1';
  variantKey: 'REQUESTS' | 'CERTIFICATES_DOCUMENTS';
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
  items: readonly Hrm009Item[];
}>;

export type Hrm009TrustedScope = Readonly<{
  contextScopeKey: string;
  decisionRevision: string;
  locale: string;
  timeZone: string;
  correlationId: string;
}>;

export type Hrm009QueryOptions = Readonly<{
  limit?: number;
  filter?: Readonly<Record<string, unknown>>;
  sort?: readonly string[];
  asOf?: string | null;
  cursor?: string | null;
}>;

export type Hrm009QueryRequest = Readonly<{
  limit: number;
  filter: Readonly<Record<string, unknown>>;
  sort: readonly string[];
  locale: string;
  timeZone: string;
  correlationId: string;
  asOf?: string | null;
  cursor?: string | null;
}>;

export type Hrm009CertificateRequest = Readonly<{
  personPublicId: string;
  certificateType: string;
  purposeCode: 'EMPLOYEE_SELF_SERVICE' | 'HR_OPERATIONS';
  locale: string;
  asOf: string;
}>;

export type Hrm009RequestCertificateDraft = Readonly<{
  sourceQueryId: Hrm009QueryId;
  sourceItemPublicId: string;
  request: Hrm009CertificateRequest;
}>;

export type Hrm009RequestCertificateResult = HrisCommandReceipt | void;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const PUBLIC_ID = /^[A-Za-z0-9._:-]{1,128}$/u;
const CODE = /^[A-Z][A-Z0-9_]{1,63}$/u;
const DISPLAY_KEY = /^[a-z][a-z0-9._-]{1,127}$/u;
const COMPONENT_KEY = /^[a-z][a-z0-9._-]{0,127}$/u;
const DIGEST = /^[0-9a-f]{64}$/u;
const CURSOR = /^[A-Za-z0-9_-]{16,1024}$/u;
const CIVIL_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/u;
const LOCALE = /^[a-z]{2}(?:-[A-Z]{2})?$/u;

export class Hrm009ContractError extends Error {
  readonly kind = 'HRM009_CONTRACT_OR_REVISION_ERROR' as const;

  constructor(path: string) {
    super(`Invalid HRM-009 Stage-A contract: ${path}`);
    this.name = 'Hrm009ContractError';
  }
}

function invalid(path: string): never {
  throw new Hrm009ContractError(path);
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
  const candidate = text(value, path, 64, INSTANT);
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

function uuid(value: unknown, path: string): string {
  return text(value, path, 36, UUID);
}

function array(value: unknown, path: string, maximum: number): unknown[] {
  if (!Array.isArray(value) || value.length > maximum) return invalid(path);
  return value;
}

function aggregateValue(value: unknown, path: string): void {
  const source = exact(value, path, ['itemCount', 'revision', 'asOf']);
  integer(source.itemCount, `${path}.itemCount`);
  integer(source.revision, `${path}.revision`, 1);
  instant(source.asOf, `${path}.asOf`);
}

function statusValue(value: unknown, path: string): void {
  const source = exact(value, path, ['code', 'revision']);
  text(source.code, `${path}.code`, 64, CODE);
  integer(source.revision, `${path}.revision`, 1);
}

function receiptValue(value: unknown, path: string): void {
  const source = exact(value, path, ['receiptId', 'state', 'occurredAt', 'revision']);
  uuid(source.receiptId, `${path}.receiptId`);
  text(source.state, `${path}.state`, 64, CODE);
  instant(source.occurredAt, `${path}.occurredAt`);
  integer(source.revision, `${path}.revision`, 1);
}

function metadataValue(value: unknown, path: string): void {
  const source = exact(value, path, ['key', 'version', 'digest']);
  text(source.key, `${path}.key`, 128, PUBLIC_ID);
  text(source.version, `${path}.version`, 64, PUBLIC_ID);
  if (source.digest !== null) text(source.digest, `${path}.digest`, 64, DIGEST);
}

const FIELD_PARSERS = Object.freeze({
  REQUEST_SUMMARY: aggregateValue,
  REQUEST_STATUS: statusValue,
  COMMAND_RECEIPT: receiptValue,
  CERTIFICATE_METADATA: metadataValue,
  DOCUMENT_METADATA: metadataValue,
});

function fieldDecision(value: unknown, path: string, parseValue: typeof aggregateValue) {
  const candidate = record(value, path);
  if (candidate.decision === 'VIEW') {
    const source = exact(candidate, path, ['decision', 'value']);
    parseValue(source.value, `${path}.value`);
    return 'VIEW' as const;
  }
  if (candidate.decision === 'MASK') {
    const source = exact(candidate, path, ['decision', 'value', 'maskReason', 'maskedDisplayKey']);
    if (source.value !== null) invalid(`${path}.value`);
    text(source.maskReason, `${path}.maskReason`, 64, CODE);
    text(source.maskedDisplayKey, `${path}.maskedDisplayKey`, 128, DISPLAY_KEY);
    return 'MASK' as const;
  }
  return invalid(`${path}.decision`);
}

function action(queryId: Hrm009QueryId, value: unknown, path: string): void {
  const source = exact(value, path, [
    'actionKey',
    'method',
    'hrefTemplate',
    'idempotencyPolicy',
    'stepUpPolicy',
  ]);
  const allowed = HRM009_QUERY_CONTRACTS[queryId].actions as readonly Hrm009Action[];
  const expected = allowed.find((candidate) => candidate.actionKey === source.actionKey);
  if (
    !expected ||
    source.method !== expected.method ||
    source.hrefTemplate !== expected.hrefTemplate ||
    source.idempotencyPolicy !== expected.idempotencyPolicy ||
    source.stepUpPolicy !== expected.stepUpPolicy
  ) {
    invalid(path);
  }
}

function items(
  queryId: Hrm009QueryId,
  value: unknown
): Readonly<{ value: unknown[]; view: number; masked: number; omitted: number }> {
  const contract = HRM009_QUERY_CONTRACTS[queryId];
  const itemValues = array(value, 'items', 500);
  let view = 0;
  let masked = 0;
  let omitted = 0;
  itemValues.forEach((itemValue, itemIndex) => {
    const path = `items[${itemIndex}]`;
    const item = exact(itemValue, path, [
      'itemPublicId',
      'title',
      'statusCode',
      'fieldGroups',
      'deepLink',
      'availableActions',
    ]);
    text(item.itemPublicId, `${path}.itemPublicId`, 128, PUBLIC_ID);
    text(item.title, `${path}.title`, 512);
    text(item.statusCode, `${path}.statusCode`, 64, CODE);
    const groups = record(item.fieldGroups, `${path}.fieldGroups`);
    const groupKeys = Object.keys(groups);
    if (
      groupKeys.length === 0 ||
      groupKeys.some((key) => !(contract.fieldGroups as readonly string[]).includes(key))
    ) {
      invalid(`${path}.fieldGroups`);
    }
    contract.fieldGroups.forEach((group) => {
      const decision = groups[group];
      if (decision === undefined) {
        omitted += 1;
        return;
      }
      const result = fieldDecision(decision, `${path}.fieldGroups.${group}`, FIELD_PARSERS[group]);
      if (result === 'VIEW') view += 1;
      else masked += 1;
    });
    const deepLink = exact(item.deepLink, `${path}.deepLink`, ['route', 'resourcePublicId']);
    if (deepLink.route !== contract.route) invalid(`${path}.deepLink.route`);
    text(deepLink.resourcePublicId, `${path}.deepLink.resourcePublicId`, 128, PUBLIC_ID);
    const actions = array(
      item.availableActions,
      `${path}.availableActions`,
      contract.actions.length
    );
    actions.forEach((candidate, actionIndex) =>
      action(queryId, candidate, `${path}.availableActions[${actionIndex}]`)
    );
    const actionKeys = actions.map(
      (candidate) => (candidate as Readonly<Record<string, unknown>>).actionKey
    );
    if (new Set(actionKeys).size !== actionKeys.length) invalid(`${path}.availableActions`);
  });
  return { value: itemValues, view, masked, omitted };
}

export function selectHrm009Projection(queryId: Hrm009QueryId, value: unknown): Hrm009Projection {
  const contract = HRM009_QUERY_CONTRACTS[queryId];
  const source = exact(value, 'projection', [
    'projectionVersion',
    'asOf',
    'variantKey',
    'queryState',
    'items',
  ]);
  if (source.projectionVersion !== '1' || source.variantKey !== contract.variantKey) {
    invalid('projection.identity');
  }
  instant(source.asOf, 'projection.asOf');
  const state = exact(source.queryState, 'queryState', [
    'state',
    'scopeDecisionRevision',
    'freshness',
    'nextCursor',
    'fieldDecisionSummary',
    'partialFailures',
    'correlationId',
    'cachePolicy',
  ]);
  if (!['COMPLETE', 'EMPTY', 'PARTIAL', 'UNAVAILABLE'].includes(String(state.state))) {
    invalid('queryState.state');
  }
  if (!['CURRENT', 'STALE', 'UNAVAILABLE'].includes(String(state.freshness))) {
    invalid('queryState.freshness');
  }
  text(state.scopeDecisionRevision, 'queryState.scopeDecisionRevision', 128, PUBLIC_ID);
  if (state.nextCursor !== null) text(state.nextCursor, 'queryState.nextCursor', 1024, CURSOR);
  uuid(state.correlationId, 'queryState.correlationId');
  const failures = array(state.partialFailures, 'queryState.partialFailures', 32);
  failures.forEach((failureValue, index) => {
    const path = `queryState.partialFailures[${index}]`;
    const failure = exact(failureValue, path, [
      'componentKey',
      'errorCode',
      'correlationId',
      'retryable',
    ]);
    text(failure.componentKey, `${path}.componentKey`, 128, COMPONENT_KEY);
    text(failure.errorCode, `${path}.errorCode`, 64, CODE);
    uuid(failure.correlationId, `${path}.correlationId`);
    if (typeof failure.retryable !== 'boolean') invalid(`${path}.retryable`);
  });
  const cache = exact(state.cachePolicy, 'queryState.cachePolicy', [
    'authorizationDecisionRevision',
    'invalidationEvent',
    'maxAgeSeconds',
  ]);
  text(
    cache.authorizationDecisionRevision,
    'queryState.cachePolicy.authorizationDecisionRevision',
    128,
    PUBLIC_ID
  );
  if (cache.invalidationEvent !== 'dwp.hris.access.assignment.changed.v1') {
    invalid('queryState.cachePolicy.invalidationEvent');
  }
  integer(cache.maxAgeSeconds, 'queryState.cachePolicy.maxAgeSeconds', 0, 300);
  const projectedItems = items(queryId, source.items);
  if (
    (['EMPTY', 'UNAVAILABLE'].includes(String(state.state)) && projectedItems.value.length !== 0) ||
    (state.state === 'PARTIAL' && failures.length === 0) ||
    (state.state === 'COMPLETE' && failures.length !== 0) ||
    (state.state === 'UNAVAILABLE' &&
      (state.freshness !== 'UNAVAILABLE' || state.nextCursor !== null)) ||
    (state.freshness === 'UNAVAILABLE' && state.state !== 'UNAVAILABLE')
  ) {
    invalid('queryState.cardinality');
  }
  const summary = exact(state.fieldDecisionSummary, 'queryState.fieldDecisionSummary', [
    'viewCount',
    'maskedCount',
    'omittedCount',
  ]);
  if (
    integer(summary.viewCount, 'queryState.fieldDecisionSummary.viewCount') !==
      projectedItems.view ||
    integer(summary.maskedCount, 'queryState.fieldDecisionSummary.maskedCount') !==
      projectedItems.masked ||
    integer(summary.omittedCount, 'queryState.fieldDecisionSummary.omittedCount') !==
      projectedItems.omitted
  ) {
    invalid('queryState.fieldDecisionSummary');
  }
  return Object.freeze(source) as unknown as Hrm009Projection;
}

export function assertHrm009TrustedScope(value: unknown): Hrm009TrustedScope {
  const source = exact(value, 'trustedScope', [
    'contextScopeKey',
    'decisionRevision',
    'locale',
    'timeZone',
    'correlationId',
  ]);
  text(source.contextScopeKey, 'trustedScope.contextScopeKey', 1024);
  text(source.decisionRevision, 'trustedScope.decisionRevision', 128, PUBLIC_ID);
  const locale = text(source.locale, 'trustedScope.locale', 35);
  const timeZone = text(source.timeZone, 'trustedScope.timeZone', 255);
  let canonicalLocale: string;
  let canonicalTimeZone: string;
  try {
    [canonicalLocale] = Intl.getCanonicalLocales(locale);
    canonicalTimeZone = new Intl.DateTimeFormat('en', { timeZone }).resolvedOptions().timeZone;
  } catch {
    return invalid('trustedScope.localeOrTimeZone');
  }
  if (!canonicalLocale || canonicalLocale.length < 2 || !canonicalTimeZone) {
    return invalid('trustedScope.localeOrTimeZone');
  }
  uuid(source.correlationId, 'trustedScope.correlationId');
  return Object.freeze({
    contextScopeKey: source.contextScopeKey,
    decisionRevision: source.decisionRevision,
    locale: canonicalLocale,
    timeZone: canonicalTimeZone,
    correlationId: source.correlationId,
  }) as Hrm009TrustedScope;
}

type FilterKind = 'AGGREGATE' | 'STATUS' | 'RECEIPT' | 'METADATA' | 'DATE';

const FILTER_KEYS: Readonly<Record<Exclude<FilterKind, 'DATE'>, readonly string[]>> = Object.freeze(
  {
    AGGREGATE: ['minimumItemCount', 'maximumItemCount'],
    STATUS: ['codes', 'minimumRevision'],
    RECEIPT: ['receiptIds', 'states'],
    METADATA: ['keys', 'versions'],
  }
);

function filterList(
  value: unknown,
  path: string,
  pattern: RegExp,
  maximumLength = 128
): readonly string[] {
  if (!Array.isArray(value) || value.length > 50) return invalid(path);
  const values = value.map((entry, index) =>
    text(entry, `${path}[${index}]`, maximumLength, pattern)
  );
  if (new Set(values).size !== values.length) return invalid(path);
  return Object.freeze(values);
}

function parseFilterValue(kind: FilterKind, value: unknown, path: string): unknown {
  if (kind === 'DATE') return value === null ? null : civilDate(value, path);
  if (value === null) return null;
  const source = exact(value, path, FILTER_KEYS[kind], []);
  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(source)) {
    if (key === 'minimumItemCount' || key === 'maximumItemCount') {
      result[key] = entry === null ? null : integer(entry, `${path}.${key}`);
    } else if (key === 'minimumRevision') {
      result[key] = entry === null ? null : integer(entry, `${path}.${key}`, 1);
    } else {
      result[key] = filterList(
        entry,
        `${path}.${key}`,
        key === 'codes' || key === 'states' ? CODE : PUBLIC_ID
      );
    }
  }
  return Object.freeze(result);
}

export function createHrm009QueryRequest(
  queryId: Hrm009QueryId,
  scopeValue: Hrm009TrustedScope,
  options: Hrm009QueryOptions = {}
): Hrm009QueryRequest {
  const scope = assertHrm009TrustedScope(scopeValue);
  const contract = HRM009_QUERY_CONTRACTS[queryId];
  const rawFilter = record(options.filter ?? {}, 'request.filter');
  const filter: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rawFilter)) {
    const kind = (contract.filterKinds as Readonly<Record<string, FilterKind>>)[key];
    if (!kind) return invalid(`request.filter.${key}`);
    filter[key] = parseFilterValue(kind, value, `request.filter.${key}`);
  }
  const sort = [...(options.sort ?? ['itemPublicId:ASC'])];
  if (
    sort.length < 1 ||
    sort.length > 3 ||
    new Set(sort).size !== sort.length ||
    sort.some((candidate) => !(contract.sorts as readonly string[]).includes(candidate))
  ) {
    return invalid('request.sort');
  }
  const limit = integer(options.limit ?? 100, 'request.limit', 1, 100);
  return Object.freeze({
    limit,
    filter: Object.freeze(filter),
    sort: Object.freeze(sort),
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

export function assertHrm009QueryRequest(
  queryId: Hrm009QueryId,
  value: unknown
): Hrm009QueryRequest {
  const source = exact(
    value,
    'request',
    ['limit', 'filter', 'sort', 'locale', 'timeZone', 'correlationId', 'asOf', 'cursor'],
    ['limit', 'filter', 'sort', 'locale', 'timeZone', 'correlationId']
  );
  const scope = assertHrm009TrustedScope({
    contextScopeKey: 'validated:adapter',
    decisionRevision: 'validated:adapter',
    locale: source.locale,
    timeZone: source.timeZone,
    correlationId: source.correlationId,
  });
  return createHrm009QueryRequest(queryId, scope, {
    limit: integer(source.limit, 'request.limit', 1, 100),
    filter: record(source.filter, 'request.filter'),
    sort: array(source.sort, 'request.sort', 3).map((candidate, index) =>
      text(candidate, `request.sort[${index}]`, 128)
    ),
    ...('asOf' in source ? { asOf: source.asOf as string | null } : {}),
    ...('cursor' in source ? { cursor: source.cursor as string | null } : {}),
  });
}

export function assertHrm009CertificateRequest(value: unknown): Hrm009CertificateRequest {
  const source = exact(value, 'certificateRequest', [
    'personPublicId',
    'certificateType',
    'purposeCode',
    'locale',
    'asOf',
  ]);
  uuid(source.personPublicId, 'certificateRequest.personPublicId');
  text(source.certificateType, 'certificateRequest.certificateType', 64);
  if (!['EMPLOYEE_SELF_SERVICE', 'HR_OPERATIONS'].includes(String(source.purposeCode))) {
    invalid('certificateRequest.purposeCode');
  }
  text(source.locale, 'certificateRequest.locale', 35, LOCALE);
  instant(source.asOf, 'certificateRequest.asOf');
  return Object.freeze(source) as unknown as Hrm009CertificateRequest;
}

export function hasHrm009RequestCertificateAction(item: Hrm009Item | null): boolean {
  return Boolean(
    item?.availableActions.some(
      (candidate) => candidate.actionKey === REQUEST_CERTIFICATE_ACTION.actionKey
    )
  );
}
