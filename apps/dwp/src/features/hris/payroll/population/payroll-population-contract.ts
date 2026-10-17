import { Temporal } from 'temporal-polyfill';

export const PAYROLL_RUN_PREPARE_FEATURE = 'HRIS_PAYROLL_RUN_PREPARE' as const;
export const PAYROLL_RUN_PREPARE_DEFAULT_ENABLED = false as const;
export const PAYROLL_RUN_PREPARE_DEFAULT_ENROLLED_TENANTS = Object.freeze([] as readonly string[]);

export const PAYROLL_POPULATION_PAGE_ROUTE_CONTRACT_KEY =
  'route.hcm.operations.payroll-population.page' as const;
export const PAYROLL_POPULATION_DATA_ROUTE_CONTRACT_KEY =
  'route.hcm.operations.payroll-support.data' as const;
export const PAYROLL_RUN_PREPARE_ROUTE_CONTRACT_KEY =
  'route.hcm.operations.payroll-run.action' as const;

export const PAYROLL_POPULATION_PATH = '/api/payroll/v1/workbench/population' as const;
export const PAYROLL_RUN_PREPARE_PATH = '/api/payroll/v1/runs' as const;
export const PAYROLL_COMMAND_CENTER_PATH = '/hr/operations/payroll/command-center' as const;

export const PAYROLL_POPULATION_ENTRY_QUERY = Object.freeze({
  contractId: 'IAQ-014',
  method: 'GET',
  path: PAYROLL_POPULATION_PATH,
  routeContractKey: PAYROLL_POPULATION_DATA_ROUTE_CONTRACT_KEY,
  purpose: 'PAYROLL_OPERATIONS',
});

export const PAYROLL_RUN_PREPARE_ACTION = Object.freeze({
  contractId: 'PEP-PAY-011',
  method: 'POST',
  path: PAYROLL_RUN_PREPARE_PATH,
  routeContractKey: PAYROLL_RUN_PREPARE_ROUTE_CONTRACT_KEY,
  purpose: 'PAYROLL_PROCESSING',
  expectedObjectVersion: 0,
  stepUpRequired: true,
});

export const PAYROLL_POPULATION_SORTS = [
  'payrollPopulation:ASC',
  'projectionVersion:ASC',
  'payrollPopulation:DESC',
  'projectionVersion:DESC',
  'itemPublicId:ASC',
  'itemPublicId:DESC',
] as const;
export type PayrollPopulationSort = (typeof PAYROLL_POPULATION_SORTS)[number];

export type PayrollPopulationQuery = Readonly<{
  limit: number;
  filter: Readonly<{
    payrollPopulation?: Readonly<{
      minimumItemCount?: number | null;
      maximumItemCount?: number | null;
    }> | null;
    projectionVersion?: Readonly<{
      keys?: readonly string[];
      versions?: readonly string[];
    }> | null;
    effectiveOn?: string | null;
  }>;
  sort: readonly PayrollPopulationSort[];
  locale: string;
  timeZone: string;
  correlationId: string;
  asOf?: string | null;
  cursor?: string | null;
}>;

export type PayrollPopulationAggregateValue = Readonly<{
  itemCount: number;
  revision: number;
  asOf: string;
}>;

export type PayrollPopulationMetadataValue = Readonly<{
  key: string;
  version: string;
  digest: string | null;
}>;

export type PayrollPopulationFieldDecision<T> =
  | Readonly<{ decision: 'VIEW'; value: T }>
  | Readonly<{
      decision: 'MASK';
      value: null;
      maskReason: string;
      maskedDisplayKey: string;
    }>;

export type PayrollPopulationAction = Readonly<{
  actionKey: 'hris.action.pay.run.prepare';
  method: 'POST';
  hrefTemplate: typeof PAYROLL_RUN_PREPARE_PATH;
  idempotencyPolicy: 'REQUIRED_IDEMPOTENCY_KEY';
  stepUpPolicy: 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED';
}>;

export type PayrollPopulationItem = Readonly<{
  itemPublicId: string;
  title: string;
  statusCode: string;
  fieldGroups: Readonly<{
    PAYROLL_POPULATION?: PayrollPopulationFieldDecision<PayrollPopulationAggregateValue>;
    PROJECTION_VERSION?: PayrollPopulationFieldDecision<PayrollPopulationMetadataValue>;
  }>;
  deepLink: Readonly<{
    route: '/hr/operations/payroll/population';
    resourcePublicId: string;
  }>;
  availableActions: readonly PayrollPopulationAction[];
}>;

export type PayrollPopulationProjection = Readonly<{
  projectionVersion: '1';
  asOf: string;
  variantKey: 'POPULATION';
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
  items: readonly PayrollPopulationItem[];
}>;

export type PayrollRunPrepareDraft = Readonly<{
  runType: 'REGULAR' | 'OFF_CYCLE' | 'RETRO' | 'CORRECTION';
  payrollEntityId: string;
  payGroupId: string;
  payPeriodId: string;
}>;

export type PayrollRunPrepareCommand = Readonly<{
  preparationId: string;
  runType: PayrollRunPrepareDraft['runType'];
  payrollEntityId: string;
  payGroupId: string;
  payPeriodId: string;
  asOf: string;
  inputSnapshotDigest: string;
}>;

export type PayrollRunPreparedReceipt = Readonly<{
  receiptId: string;
  commandType: 'RUN_PREPARE';
  originatingAction: 'PAY_RUN_PREPARE';
  subjectPrincipalPublicId: string;
  populationScopeDigest: string;
  fieldPolicyRevision: number;
  purposeCode: 'PAYROLL_PROCESSING';
  authorizationRevision: number;
  status: 'ACCEPTED' | 'RUNNING' | 'SUCCEEDED' | 'REJECTED' | 'FAILED' | 'RESULT_UNKNOWN';
  correlationId: string;
  requestDigest: string;
  createdAt: string;
  aggregateVersion?: number;
  resultRef?: string;
}>;

export type PayrollRunPrepareRollout = Readonly<{
  feature: typeof PAYROLL_RUN_PREPARE_FEATURE;
  enabled: boolean;
  enrolledTenantIds: readonly string[];
}>;

export const PAYROLL_RUN_PREPARE_DEFAULT_ROLLOUT: PayrollRunPrepareRollout = Object.freeze({
  feature: PAYROLL_RUN_PREPARE_FEATURE,
  enabled: PAYROLL_RUN_PREPARE_DEFAULT_ENABLED,
  enrolledTenantIds: PAYROLL_RUN_PREPARE_DEFAULT_ENROLLED_TENANTS,
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const DIGEST = /^[0-9a-f]{64}$/u;
const CODE = /^[A-Z][A-Z0-9_]{1,63}$/u;
const PUBLIC_ID = /^[A-Za-z0-9._:-]{1,128}$/u;
const DISPLAY_KEY = /^[a-z][a-z0-9._-]{1,127}$/u;
const COMPONENT_KEY = /^[a-z][a-z0-9._-]{0,127}$/u;
const CURSOR = /^[A-Za-z0-9_-]{16,1024}$/u;
const DATE = /^\d{4}-\d{2}-\d{2}$/u;
const RECEIPT_STATUSES = new Set<PayrollRunPreparedReceipt['status']>([
  'ACCEPTED',
  'RUNNING',
  'SUCCEEDED',
  'REJECTED',
  'FAILED',
  'RESULT_UNKNOWN',
]);

function invalid(path: string): never {
  throw new Error(`Invalid PAY-013 transport source: ${path}`);
}

function exact(value: unknown, path: string, keys: readonly string[]) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid(path);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return invalid(path);
  const source = value as Record<string, unknown>;
  const actual = Object.keys(source).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    return invalid(path);
  }
  return source;
}

function exactOptional(
  value: unknown,
  path: string,
  allowed: readonly string[],
  required: readonly string[] = []
) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid(path);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return invalid(path);
  const source = value as Record<string, unknown>;
  if (
    Object.keys(source).some((key) => !allowed.includes(key)) ||
    required.some((key) => !Object.hasOwn(source, key))
  ) {
    return invalid(path);
  }
  return source;
}

function text(value: unknown, path: string, maximum: number, pattern?: RegExp, minimum = 1) {
  const length = typeof value === 'string' ? Array.from(value).length : -1;
  if (
    typeof value !== 'string' ||
    length < minimum ||
    length > maximum ||
    value !== value.trim() ||
    (pattern && !pattern.test(value)) ||
    Array.from(value).some((character) => {
      const point = character.codePointAt(0);
      return point !== undefined && (point <= 0x1f || point === 0x7f);
    })
  ) {
    return invalid(path);
  }
  return value;
}

function uuid(value: unknown, path: string) {
  return text(value, path, 36, UUID);
}

function digest(value: unknown, path: string) {
  return text(value, path, 64, DIGEST);
}

function integer(value: unknown, path: string, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || Number(value) < minimum || Number(value) > maximum) {
    return invalid(path);
  }
  return Number(value);
}

function instant(value: unknown, path: string) {
  const candidate = text(value, path, 100);
  try {
    Temporal.Instant.from(candidate);
  } catch {
    return invalid(path);
  }
  return candidate;
}

function plainDate(value: unknown, path: string) {
  const candidate = text(value, path, 10, DATE);
  try {
    Temporal.PlainDate.from(candidate);
  } catch {
    return invalid(path);
  }
  return candidate;
}

function fieldDecision<T>(
  value: unknown,
  path: string,
  parseValue: (candidate: unknown) => T
): PayrollPopulationFieldDecision<T> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid(path);
  const source = value as Record<string, unknown>;
  if (source.decision === 'VIEW') {
    const visible = exact(source, path, ['decision', 'value']);
    return Object.freeze({ decision: 'VIEW', value: parseValue(visible.value) });
  }
  if (source.decision === 'MASK') {
    const masked = exact(source, path, ['decision', 'value', 'maskReason', 'maskedDisplayKey']);
    if (masked.value !== null) return invalid(`${path}.value`);
    return Object.freeze({
      decision: 'MASK',
      value: null,
      maskReason: text(masked.maskReason, `${path}.maskReason`, 64, CODE),
      maskedDisplayKey: text(masked.maskedDisplayKey, `${path}.maskedDisplayKey`, 128, DISPLAY_KEY),
    });
  }
  return invalid(`${path}.decision`);
}

function aggregateValue(value: unknown): PayrollPopulationAggregateValue {
  const source = exact(value, 'population.item.aggregate', ['itemCount', 'revision', 'asOf']);
  return Object.freeze({
    itemCount: integer(source.itemCount, 'population.item.aggregate.itemCount'),
    revision: integer(source.revision, 'population.item.aggregate.revision', 1),
    asOf: instant(source.asOf, 'population.item.aggregate.asOf'),
  });
}

function metadataValue(value: unknown): PayrollPopulationMetadataValue {
  const source = exact(value, 'population.item.metadata', ['key', 'version', 'digest']);
  return Object.freeze({
    key: text(source.key, 'population.item.metadata.key', 128, PUBLIC_ID),
    version: text(source.version, 'population.item.metadata.version', 64, PUBLIC_ID),
    digest:
      source.digest === null ? null : digest(source.digest, 'population.item.metadata.digest'),
  });
}

function action(value: unknown): PayrollPopulationAction {
  const source = exact(value, 'population.item.action', [
    'actionKey',
    'method',
    'hrefTemplate',
    'idempotencyPolicy',
    'stepUpPolicy',
  ]);
  if (
    source.actionKey !== 'hris.action.pay.run.prepare' ||
    source.method !== 'POST' ||
    source.hrefTemplate !== PAYROLL_RUN_PREPARE_PATH ||
    source.idempotencyPolicy !== 'REQUIRED_IDEMPOTENCY_KEY' ||
    source.stepUpPolicy !== 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED'
  ) {
    return invalid('population.item.action.binding');
  }
  return Object.freeze({
    actionKey: 'hris.action.pay.run.prepare',
    method: 'POST',
    hrefTemplate: PAYROLL_RUN_PREPARE_PATH,
    idempotencyPolicy: 'REQUIRED_IDEMPOTENCY_KEY',
    stepUpPolicy: 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED',
  });
}

function item(value: unknown, index: number): PayrollPopulationItem {
  const path = `population.items[${index}]`;
  const source = exact(value, path, [
    'itemPublicId',
    'title',
    'statusCode',
    'fieldGroups',
    'deepLink',
    'availableActions',
  ]);
  const fieldGroups = exactOptional(source.fieldGroups, `${path}.fieldGroups`, [
    'PAYROLL_POPULATION',
    'PROJECTION_VERSION',
  ]);
  if (Object.keys(fieldGroups).length === 0) return invalid(`${path}.fieldGroups`);
  const deepLink = exact(source.deepLink, `${path}.deepLink`, ['route', 'resourcePublicId']);
  if (deepLink.route !== '/hr/operations/payroll/population') {
    return invalid(`${path}.deepLink.route`);
  }
  const itemPublicId = text(source.itemPublicId, `${path}.itemPublicId`, 128, PUBLIC_ID);
  const resourcePublicId = text(
    deepLink.resourcePublicId,
    `${path}.deepLink.resourcePublicId`,
    128,
    PUBLIC_ID
  );
  if (!Array.isArray(source.availableActions) || source.availableActions.length > 1) {
    return invalid(`${path}.availableActions`);
  }
  return Object.freeze({
    itemPublicId,
    title: text(source.title, `${path}.title`, 512),
    statusCode: text(source.statusCode, `${path}.statusCode`, 64, CODE),
    fieldGroups: Object.freeze({
      ...(fieldGroups.PAYROLL_POPULATION !== undefined
        ? {
            PAYROLL_POPULATION: fieldDecision(
              fieldGroups.PAYROLL_POPULATION,
              `${path}.fieldGroups.PAYROLL_POPULATION`,
              aggregateValue
            ),
          }
        : {}),
      ...(fieldGroups.PROJECTION_VERSION !== undefined
        ? {
            PROJECTION_VERSION: fieldDecision(
              fieldGroups.PROJECTION_VERSION,
              `${path}.fieldGroups.PROJECTION_VERSION`,
              metadataValue
            ),
          }
        : {}),
    }),
    deepLink: Object.freeze({
      route: '/hr/operations/payroll/population' as const,
      resourcePublicId,
    }),
    availableActions: Object.freeze(source.availableActions.map(action)),
  });
}

function queryState(value: unknown, itemCount: number): PayrollPopulationProjection['queryState'] {
  const source = exact(value, 'population.queryState', [
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
    return invalid('population.queryState.state');
  }
  if (!['CURRENT', 'STALE', 'UNAVAILABLE'].includes(String(source.freshness))) {
    return invalid('population.queryState.freshness');
  }
  if (
    source.nextCursor !== null &&
    (typeof source.nextCursor !== 'string' || !CURSOR.test(source.nextCursor))
  ) {
    return invalid('population.queryState.nextCursor');
  }
  if (!Array.isArray(source.partialFailures) || source.partialFailures.length > 32) {
    return invalid('population.queryState.partialFailures');
  }
  const failures = Object.freeze(
    source.partialFailures.map((failure, index) => {
      const path = `population.queryState.partialFailures[${index}]`;
      const candidate = exact(failure, path, [
        'componentKey',
        'errorCode',
        'correlationId',
        'retryable',
      ]);
      if (typeof candidate.retryable !== 'boolean') return invalid(`${path}.retryable`);
      return Object.freeze({
        componentKey: text(candidate.componentKey, `${path}.componentKey`, 128, COMPONENT_KEY),
        errorCode: text(candidate.errorCode, `${path}.errorCode`, 64, CODE),
        correlationId: uuid(candidate.correlationId, `${path}.correlationId`),
        retryable: candidate.retryable,
      });
    })
  );
  const summary = exact(source.fieldDecisionSummary, 'population.queryState.summary', [
    'viewCount',
    'maskedCount',
    'omittedCount',
  ]);
  const cache = exact(source.cachePolicy, 'population.queryState.cachePolicy', [
    'authorizationDecisionRevision',
    'invalidationEvent',
    'maxAgeSeconds',
  ]);
  if (cache.invalidationEvent !== 'dwp.hris.access.assignment.changed.v1') {
    return invalid('population.queryState.cachePolicy.invalidationEvent');
  }
  const state = source.state as PayrollPopulationProjection['queryState']['state'];
  const freshness = source.freshness as PayrollPopulationProjection['queryState']['freshness'];
  if (
    ((state === 'EMPTY' || state === 'UNAVAILABLE') && itemCount !== 0) ||
    (state === 'PARTIAL' && failures.length === 0) ||
    (state === 'COMPLETE' && failures.length !== 0) ||
    (state === 'UNAVAILABLE' && (freshness !== 'UNAVAILABLE' || source.nextCursor !== null)) ||
    (freshness === 'UNAVAILABLE' && state !== 'UNAVAILABLE')
  ) {
    return invalid('population.queryState.invariant');
  }
  return Object.freeze({
    state,
    scopeDecisionRevision: text(
      source.scopeDecisionRevision,
      'population.queryState.scopeDecisionRevision',
      128,
      PUBLIC_ID
    ),
    freshness,
    nextCursor: source.nextCursor as string | null,
    fieldDecisionSummary: Object.freeze({
      viewCount: integer(summary.viewCount, 'population.queryState.summary.viewCount'),
      maskedCount: integer(summary.maskedCount, 'population.queryState.summary.maskedCount'),
      omittedCount: integer(summary.omittedCount, 'population.queryState.summary.omittedCount'),
    }),
    partialFailures: failures,
    correlationId: uuid(source.correlationId, 'population.queryState.correlationId'),
    cachePolicy: Object.freeze({
      authorizationDecisionRevision: text(
        cache.authorizationDecisionRevision,
        'population.queryState.cachePolicy.authorizationDecisionRevision',
        128,
        PUBLIC_ID
      ),
      invalidationEvent: 'dwp.hris.access.assignment.changed.v1' as const,
      maxAgeSeconds: integer(
        cache.maxAgeSeconds,
        'population.queryState.cachePolicy.maxAgeSeconds',
        0,
        300
      ),
    }),
  });
}

export function parsePayrollPopulationProjection(value: unknown): PayrollPopulationProjection {
  const source = exact(value, 'population', [
    'projectionVersion',
    'asOf',
    'variantKey',
    'queryState',
    'items',
  ]);
  if (
    source.projectionVersion !== '1' ||
    source.variantKey !== 'POPULATION' ||
    !Array.isArray(source.items) ||
    source.items.length > 500
  ) {
    return invalid('population.binding');
  }
  const items = Object.freeze(source.items.map(item));
  if (new Set(items.map((candidate) => candidate.itemPublicId)).size !== items.length) {
    return invalid('population.items.identity');
  }
  const state = queryState(source.queryState, items.length);
  let viewCount = 0;
  let maskedCount = 0;
  let omittedCount = 0;
  items.forEach((candidate) => {
    (['PAYROLL_POPULATION', 'PROJECTION_VERSION'] as const).forEach((key) => {
      const field = candidate.fieldGroups[key];
      if (!field) omittedCount += 1;
      else if (field.decision === 'VIEW') viewCount += 1;
      else maskedCount += 1;
    });
  });
  if (
    state.fieldDecisionSummary.viewCount !== viewCount ||
    state.fieldDecisionSummary.maskedCount !== maskedCount ||
    state.fieldDecisionSummary.omittedCount !== omittedCount
  ) {
    return invalid('population.queryState.fieldDecisionSummary');
  }
  return Object.freeze({
    projectionVersion: '1',
    asOf: instant(source.asOf, 'population.asOf'),
    variantKey: 'POPULATION',
    queryState: state,
    items,
  });
}

function nullableNonNegative(value: unknown, path: string) {
  return value === null ? null : integer(value, path);
}

function stringList(value: unknown, path: string) {
  if (!Array.isArray(value) || value.length > 50 || new Set(value).size !== value.length) {
    return invalid(path);
  }
  return Object.freeze(
    value.map((candidate, index) => text(candidate, `${path}[${index}]`, 128, PUBLIC_ID))
  );
}

export function validatePayrollPopulationQuery(query: PayrollPopulationQuery) {
  const source = exactOptional(
    query,
    'query',
    ['limit', 'filter', 'sort', 'locale', 'timeZone', 'correlationId', 'asOf', 'cursor'],
    ['limit', 'filter', 'sort', 'locale', 'timeZone', 'correlationId']
  );
  const filter = exactOptional(source.filter, 'query.filter', [
    'payrollPopulation',
    'projectionVersion',
    'effectiveOn',
  ]);
  if (
    !Array.isArray(source.sort) ||
    source.sort.length < 1 ||
    source.sort.length > 3 ||
    new Set(source.sort).size !== source.sort.length ||
    source.sort.some((candidate) => !PAYROLL_POPULATION_SORTS.includes(candidate))
  ) {
    return invalid('query.sort');
  }
  const populationFilter =
    filter.payrollPopulation == null
      ? filter.payrollPopulation
      : exactOptional(filter.payrollPopulation, 'query.filter.payrollPopulation', [
          'minimumItemCount',
          'maximumItemCount',
        ]);
  const minimumItemCount = populationFilter?.minimumItemCount;
  const maximumItemCount = populationFilter?.maximumItemCount;
  if (
    minimumItemCount !== undefined &&
    minimumItemCount !== null &&
    (!Number.isSafeInteger(minimumItemCount) || Number(minimumItemCount) < 0)
  ) {
    return invalid('query.filter.payrollPopulation.minimumItemCount');
  }
  if (
    maximumItemCount !== undefined &&
    maximumItemCount !== null &&
    (!Number.isSafeInteger(maximumItemCount) || Number(maximumItemCount) < 0)
  ) {
    return invalid('query.filter.payrollPopulation.maximumItemCount');
  }
  const metadataFilter =
    filter.projectionVersion == null
      ? filter.projectionVersion
      : exactOptional(filter.projectionVersion, 'query.filter.projectionVersion', [
          'keys',
          'versions',
        ]);
  const effectiveOn =
    filter.effectiveOn === undefined
      ? undefined
      : filter.effectiveOn === null
        ? null
        : plainDate(filter.effectiveOn, 'query.filter.effectiveOn');
  if (source.cursor != null && !CURSOR.test(String(source.cursor))) return invalid('query.cursor');
  const normalized: PayrollPopulationQuery = Object.freeze({
    limit: integer(source.limit, 'query.limit', 1, 100),
    filter: Object.freeze({
      ...(populationFilter !== undefined
        ? {
            payrollPopulation:
              populationFilter === null
                ? null
                : Object.freeze({
                    ...(minimumItemCount !== undefined
                      ? {
                          minimumItemCount: nullableNonNegative(
                            minimumItemCount,
                            'query.filter.payrollPopulation.minimumItemCount'
                          ),
                        }
                      : {}),
                    ...(maximumItemCount !== undefined
                      ? {
                          maximumItemCount: nullableNonNegative(
                            maximumItemCount,
                            'query.filter.payrollPopulation.maximumItemCount'
                          ),
                        }
                      : {}),
                  }),
          }
        : {}),
      ...(metadataFilter !== undefined
        ? {
            projectionVersion:
              metadataFilter === null
                ? null
                : Object.freeze({
                    ...(metadataFilter.keys !== undefined
                      ? {
                          keys: stringList(
                            metadataFilter.keys,
                            'query.filter.projectionVersion.keys'
                          ),
                        }
                      : {}),
                    ...(metadataFilter.versions !== undefined
                      ? {
                          versions: stringList(
                            metadataFilter.versions,
                            'query.filter.projectionVersion.versions'
                          ),
                        }
                      : {}),
                  }),
          }
        : {}),
      ...(effectiveOn !== undefined ? { effectiveOn } : {}),
    }),
    sort: Object.freeze([...(source.sort as PayrollPopulationSort[])]),
    locale: text(source.locale, 'query.locale', 35, undefined, 2),
    timeZone: text(source.timeZone, 'query.timeZone', 255),
    correlationId: uuid(source.correlationId, 'query.correlationId'),
    ...(source.asOf !== undefined
      ? { asOf: source.asOf === null ? null : instant(source.asOf, 'query.asOf') }
      : {}),
    ...(source.cursor !== undefined ? { cursor: source.cursor as string | null } : {}),
  });
  return normalized;
}

export function parsePayrollRunPreparedReceipt(value: unknown): PayrollRunPreparedReceipt {
  const source = exactOptional(
    value,
    'receipt',
    [
      'receiptId',
      'commandType',
      'originatingAction',
      'subjectPrincipalPublicId',
      'populationScopeDigest',
      'fieldPolicyRevision',
      'purposeCode',
      'authorizationRevision',
      'status',
      'correlationId',
      'requestDigest',
      'createdAt',
      'aggregateVersion',
      'resultRef',
    ],
    [
      'receiptId',
      'commandType',
      'originatingAction',
      'subjectPrincipalPublicId',
      'populationScopeDigest',
      'fieldPolicyRevision',
      'purposeCode',
      'authorizationRevision',
      'status',
      'correlationId',
      'requestDigest',
      'createdAt',
    ]
  );
  if (
    source.commandType !== 'RUN_PREPARE' ||
    source.originatingAction !== 'PAY_RUN_PREPARE' ||
    source.purposeCode !== 'PAYROLL_PROCESSING' ||
    !RECEIPT_STATUSES.has(source.status as PayrollRunPreparedReceipt['status'])
  ) {
    return invalid('receipt.binding');
  }
  return Object.freeze({
    receiptId: uuid(source.receiptId, 'receipt.receiptId'),
    commandType: 'RUN_PREPARE',
    originatingAction: 'PAY_RUN_PREPARE',
    subjectPrincipalPublicId: uuid(
      source.subjectPrincipalPublicId,
      'receipt.subjectPrincipalPublicId'
    ),
    populationScopeDigest: digest(source.populationScopeDigest, 'receipt.populationScopeDigest'),
    fieldPolicyRevision: integer(source.fieldPolicyRevision, 'receipt.fieldPolicyRevision', 1),
    purposeCode: 'PAYROLL_PROCESSING',
    authorizationRevision: integer(
      source.authorizationRevision,
      'receipt.authorizationRevision',
      1
    ),
    status: source.status as PayrollRunPreparedReceipt['status'],
    correlationId: uuid(source.correlationId, 'receipt.correlationId'),
    requestDigest: digest(source.requestDigest, 'receipt.requestDigest'),
    createdAt: instant(source.createdAt, 'receipt.createdAt'),
    ...(source.aggregateVersion !== undefined
      ? { aggregateVersion: integer(source.aggregateVersion, 'receipt.aggregateVersion') }
      : {}),
    ...(source.resultRef !== undefined
      ? { resultRef: text(source.resultRef, 'receipt.resultRef', Number.MAX_SAFE_INTEGER) }
      : {}),
  });
}

export function payrollPopulationItemIsSafeToPrepare(
  projection: PayrollPopulationProjection | null,
  selected: PayrollPopulationItem | null
) {
  const aggregate = selected?.fieldGroups.PAYROLL_POPULATION;
  const metadata = selected?.fieldGroups.PROJECTION_VERSION;
  return Boolean(
    projection &&
    selected &&
    selected.statusCode === 'READY' &&
    projection.queryState.state === 'COMPLETE' &&
    projection.queryState.freshness === 'CURRENT' &&
    projection.queryState.partialFailures.length === 0 &&
    aggregate?.decision === 'VIEW' &&
    aggregate.value.itemCount > 0 &&
    metadata?.decision === 'VIEW' &&
    metadata.value.digest &&
    selected.availableActions.some(
      (candidate) => candidate.actionKey === 'hris.action.pay.run.prepare'
    )
  );
}

export function payrollRunPrepareEnabledForTenant(
  rollout: PayrollRunPrepareRollout,
  tenantId: string
) {
  return (
    rollout.feature === PAYROLL_RUN_PREPARE_FEATURE &&
    rollout.enabled === true &&
    Boolean(tenantId) &&
    rollout.enrolledTenantIds.includes(tenantId)
  );
}

export function buildPayrollRunPrepareCommand(
  projection: PayrollPopulationProjection,
  selected: PayrollPopulationItem,
  draft: PayrollRunPrepareDraft,
  preparationId: string
): PayrollRunPrepareCommand {
  if (!payrollPopulationItemIsSafeToPrepare(projection, selected)) {
    return invalid('command.preflight');
  }
  const aggregate = selected.fieldGroups.PAYROLL_POPULATION;
  const metadata = selected.fieldGroups.PROJECTION_VERSION;
  if (aggregate?.decision !== 'VIEW' || metadata?.decision !== 'VIEW' || !metadata.value.digest) {
    return invalid('command.source');
  }
  if (!['REGULAR', 'OFF_CYCLE', 'RETRO', 'CORRECTION'].includes(draft.runType)) {
    return invalid('command.runType');
  }
  return Object.freeze({
    preparationId: uuid(preparationId, 'command.preparationId'),
    runType: draft.runType,
    payrollEntityId: uuid(draft.payrollEntityId, 'command.payrollEntityId'),
    payGroupId: uuid(draft.payGroupId, 'command.payGroupId'),
    payPeriodId: uuid(draft.payPeriodId, 'command.payPeriodId'),
    asOf: aggregate.value.asOf,
    inputSnapshotDigest: metadata.value.digest,
  });
}

export function validatePayrollRunPrepareCommand(
  value: PayrollRunPrepareCommand
): PayrollRunPrepareCommand {
  const source = exact(value, 'command', [
    'preparationId',
    'runType',
    'payrollEntityId',
    'payGroupId',
    'payPeriodId',
    'asOf',
    'inputSnapshotDigest',
  ]);
  if (!['REGULAR', 'OFF_CYCLE', 'RETRO', 'CORRECTION'].includes(String(source.runType))) {
    return invalid('command.runType');
  }
  return Object.freeze({
    preparationId: uuid(source.preparationId, 'command.preparationId'),
    runType: source.runType as PayrollRunPrepareDraft['runType'],
    payrollEntityId: uuid(source.payrollEntityId, 'command.payrollEntityId'),
    payGroupId: uuid(source.payGroupId, 'command.payGroupId'),
    payPeriodId: uuid(source.payPeriodId, 'command.payPeriodId'),
    asOf: instant(source.asOf, 'command.asOf'),
    inputSnapshotDigest: digest(source.inputSnapshotDigest, 'command.inputSnapshotDigest'),
  });
}
