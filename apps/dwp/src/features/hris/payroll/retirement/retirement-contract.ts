export const PAY004_FEATURE = 'HRIS_PAY_RETIREMENT_WORKBENCH' as const;
export const PAY004_ADAPTER_KIND = 'HRIS_PAY_004_ENTRY_QUERY_V1' as const;
export const PAY004_QUERY_ID = 'IAQ-049' as const;
export const PAY004_PAGE_ROUTE_CONTRACT_KEY = 'route.hcm.operations.pay-retirement.page' as const;
export const PAY004_DATA_ROUTE_CONTRACT_KEY = 'route.hcm.operations.pay-retirement.data' as const;
export const PAY004_DEFAULT_ENABLED = false as const;
export const PAY004_DEFAULT_ENROLLED_TENANTS = Object.freeze([] as readonly string[]);
export const PAY004_FIELD_GROUPS = ['RETIREMENT_RESULT', 'POLICY_VERSION', 'CASE_STATUS'] as const;

export const PAY004_QUERY_CONTRACT = Object.freeze({
  queryId: PAY004_QUERY_ID,
  operationId: 'IAQ.OP.049',
  iaNodeId: 'BASE:pay-retirement',
  variantKey: 'RETIREMENT',
  browserPath: '/api/payroll/v1/workbench/pay-retirement',
  ownerPath: '/v1/workbench/pay-retirement',
  route: '/hr/operations/payroll/retirement',
  deepLinkTemplate: '/hr/operations/payroll/retirement?tab=overview&focus={resourcePublicId}',
  visibilityCapability: 'hcm.operations.payroll-support.view',
  resolvedCapability: 'DATA.HRIS_PAYROLL_STATUS:VIEW',
  purpose: 'PAYROLL_OPERATIONS',
  scopeResolver: 'PAY_TARGET_POPULATION',
  targetBindingKind: 'TARGET_POPULATION',
  projectionPolicyKey: 'pay004.iaq-049.fields.v1',
  pageRouteContractKey: PAY004_PAGE_ROUTE_CONTRACT_KEY,
  dataRouteContractKey: PAY004_DATA_ROUTE_CONTRACT_KEY,
  fieldGroups: Object.freeze(PAY004_FIELD_GROUPS),
  filters: Object.freeze(['retirementResult', 'policyVersion', 'caseStatus', 'effectiveOn']),
  sorts: Object.freeze([
    'retirementResult:ASC',
    'policyVersion:ASC',
    'caseStatus:ASC',
    'retirementResult:DESC',
    'policyVersion:DESC',
    'caseStatus:DESC',
    'itemPublicId:ASC',
    'itemPublicId:DESC',
  ]),
  defaultSort: 'itemPublicId:ASC',
  pageLimit: 100,
  availableActions: Object.freeze([]),
  framing: Object.freeze({
    primaryUser: 'Payroll support or statutory operations analyst',
    operationalQuestion:
      'Which retirement cases are blocked, ready, calculated, finalized or corrected, and which immutable result and policy revision apply?',
    primaryAction: 'Inspect one retirement case and its immutable result and policy lineage.',
    archetype: 'list-detail-retirement-case-workbench',
  }),
} as const);

export type Pay004Rollout = Readonly<{
  feature: typeof PAY004_FEATURE;
  enabled: boolean;
  enrolledTenantIds: readonly string[];
}>;

export const PAY004_DEFAULT_ROLLOUT: Pay004Rollout = Object.freeze({
  feature: PAY004_FEATURE,
  enabled: PAY004_DEFAULT_ENABLED,
  enrolledTenantIds: PAY004_DEFAULT_ENROLLED_TENANTS,
});

export type Pay004TrustedAdmission = Readonly<{
  kind: 'TRUSTED_PRODUCT_SURFACE_PAGE';
  feature: typeof PAY004_FEATURE;
  pageRouteContractKey: typeof PAY004_PAGE_ROUTE_CONTRACT_KEY;
  dataRouteContractKey: typeof PAY004_DATA_ROUTE_CONTRACT_KEY;
  tenantId: string;
  contextScopeKey: string;
  decisionRevision: string;
  locale: string;
  timeZone: string;
  correlationId: string;
}>;

export type Pay004MoneyValue = Readonly<{ amount: string; currency: string }>;
export type Pay004PolicyValue = Readonly<{
  policyKey: string;
  revision: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: string;
}>;
export type Pay004StatusValue = Readonly<{ code: string; revision: number }>;
export type Pay004FieldValue = Pay004MoneyValue | Pay004PolicyValue | Pay004StatusValue;
export type Pay004FieldDecision =
  | Readonly<{ decision: 'VIEW'; value: Pay004FieldValue }>
  | Readonly<{
      decision: 'MASK';
      value: null;
      maskReason: string;
      maskedDisplayKey: string;
    }>;
export type Pay004FieldGroups = Readonly<
  Partial<Record<(typeof PAY004_FIELD_GROUPS)[number], Pay004FieldDecision>>
>;

export type Pay004RetirementItem = Readonly<{
  itemPublicId: string;
  title: string;
  statusCode: string;
  fieldGroups: Pay004FieldGroups;
  deepLink: Readonly<{
    route: typeof PAY004_QUERY_CONTRACT.route;
    resourcePublicId: string;
  }>;
  availableActions: readonly [];
}>;

export type Pay004QueryState = Readonly<{
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

export type Pay004Projection = Readonly<{
  projectionVersion: '1';
  variantKey: typeof PAY004_QUERY_CONTRACT.variantKey;
  asOf: string;
  queryState: Pay004QueryState;
  items: readonly Pay004RetirementItem[];
}>;

export type Pay004TrustedScope = Readonly<{
  contextScopeKey: string;
  decisionRevision: string;
  locale: string;
  timeZone: string;
  correlationId: string;
}>;

export type Pay004QueryOptions = Readonly<{
  limit?: number;
  filter?: Readonly<Record<string, unknown>>;
  sort?: readonly string[];
  asOf?: string | null;
  cursor?: string | null;
}>;

export type Pay004Sort = (typeof PAY004_QUERY_CONTRACT.sorts)[number];

export type Pay004QueryRequest = Readonly<{
  limit: number;
  filter: Readonly<Record<string, unknown>>;
  sort: readonly string[];
  locale: string;
  timeZone: string;
  correlationId: string;
  asOf?: string | null;
  cursor?: string | null;
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const PUBLIC_ID = /^[A-Za-z0-9._:-]{1,128}$/u;
const POLICY_KEY = /^[a-z][a-z0-9._-]{1,127}$/u;
const CODE = /^[A-Z][A-Z0-9_]{1,63}$/u;
const DISPLAY_KEY = /^[a-z][a-z0-9._-]{1,127}$/u;
const COMPONENT_KEY = /^[a-z][a-z0-9._-]{0,127}$/u;
const CURSOR = /^[A-Za-z0-9_-]{16,1024}$/u;
const CIVIL_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const INSTANT =
  /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/u;
const MONEY = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]{1,6})?$/u;
const POSTED_MONEY = /^(?:0|[1-9][0-9]{0,14})(?:\.[0-9]{1,4})?$/u;
const CURRENCY = /^[A-Z]{3}$/u;
const CASE_STATES = Object.freeze([
  'DRAFT',
  'VALIDATED',
  'BLOCKED_PACK_REQUIRED',
  'CALCULATED',
  'APPROVED',
  'FINALIZED',
  'CORRECTED',
  'CANCELLED',
] as const);
const PACK_STATES = Object.freeze(['NOT_REQUIRED', 'NOT_INSTALLED', 'DISABLED', 'ACTIVE'] as const);

export class Pay004ContractError extends Error {
  readonly kind = 'PAY004_CONTRACT_OR_REVISION_ERROR' as const;

  constructor(path: string) {
    super(`Invalid PAY-004 contract: ${path}`);
    this.name = 'Pay004ContractError';
  }
}

function invalid(path: string): never {
  throw new Pay004ContractError(path);
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
    Array.from(value).length > maximum ||
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
  return text(value, path, 36, UUID);
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

function instant(value: unknown, path: string): string {
  const candidate = text(value, path, 64, INSTANT);
  civilDate(candidate.slice(0, 10), path);
  if (!Number.isFinite(Date.parse(candidate))) return invalid(path);
  return candidate;
}

function stringList(value: unknown, path: string, pattern: RegExp) {
  if (!Array.isArray(value) || value.length > 50) return invalid(path);
  const values = value.map((entry, index) => text(entry, `${path}[${index}]`, 128, pattern));
  if (new Set(values).size !== values.length) return invalid(path);
  return Object.freeze(values);
}

function parseMoney(value: unknown, path: string): Pay004MoneyValue {
  const source = exact(value, path, ['amount', 'currency']);
  return Object.freeze({
    amount: text(source.amount, `${path}.amount`, 24, POSTED_MONEY),
    currency: text(source.currency, `${path}.currency`, 3, CURRENCY),
  });
}

function parsePolicy(value: unknown, path: string): Pay004PolicyValue {
  const source = exact(value, path, [
    'policyKey',
    'revision',
    'effectiveFrom',
    'effectiveTo',
    'status',
  ]);
  const effectiveFrom = civilDate(source.effectiveFrom, `${path}.effectiveFrom`);
  const effectiveTo =
    source.effectiveTo === null ? null : civilDate(source.effectiveTo, `${path}.effectiveTo`);
  if (effectiveTo !== null && effectiveTo < effectiveFrom) return invalid(`${path}.effectiveTo`);
  const status = text(source.status, `${path}.status`, 64, CODE);
  if (!(PACK_STATES as readonly string[]).includes(status)) return invalid(`${path}.status`);
  return Object.freeze({
    policyKey: text(source.policyKey, `${path}.policyKey`, 128, POLICY_KEY),
    revision: integer(source.revision, `${path}.revision`, 1),
    effectiveFrom,
    effectiveTo,
    status,
  });
}

function parseStatus(value: unknown, path: string): Pay004StatusValue {
  const source = exact(value, path, ['code', 'revision']);
  const code = text(source.code, `${path}.code`, 64, CODE);
  if (!(CASE_STATES as readonly string[]).includes(code)) return invalid(`${path}.code`);
  return Object.freeze({
    code,
    revision: integer(source.revision, `${path}.revision`, 1),
  });
}

function parseDecision(
  group: (typeof PAY004_FIELD_GROUPS)[number],
  value: unknown,
  path: string
): Pay004FieldDecision {
  const candidate = record(value, path);
  if (candidate.decision === 'VIEW') {
    const source = exact(candidate, path, ['decision', 'value']);
    const parsed =
      group === 'RETIREMENT_RESULT'
        ? parseMoney(source.value, `${path}.value`)
        : group === 'POLICY_VERSION'
          ? parsePolicy(source.value, `${path}.value`)
          : parseStatus(source.value, `${path}.value`);
    return Object.freeze({ decision: 'VIEW', value: parsed });
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

function parseItem(value: unknown, index: number): Pay004RetirementItem {
  const path = `items[${index}]`;
  const source = exact(value, path, [
    'itemPublicId',
    'title',
    'statusCode',
    'fieldGroups',
    'deepLink',
    'availableActions',
  ]);
  const itemPublicId = uuid(source.itemPublicId, `${path}.itemPublicId`);
  const groups = record(source.fieldGroups, `${path}.fieldGroups`);
  const keys = Object.keys(groups);
  if (
    keys.length === 0 ||
    keys.some((key) => !(PAY004_FIELD_GROUPS as readonly string[]).includes(key))
  ) {
    return invalid(`${path}.fieldGroups`);
  }
  const fieldGroups: Partial<Record<string, Pay004FieldDecision>> = {};
  keys.forEach((key) => {
    fieldGroups[key] = parseDecision(
      key as (typeof PAY004_FIELD_GROUPS)[number],
      groups[key],
      `${path}.fieldGroups.${key}`
    );
  });
  const deepLink = exact(source.deepLink, `${path}.deepLink`, ['route', 'resourcePublicId']);
  if (deepLink.route !== PAY004_QUERY_CONTRACT.route) return invalid(`${path}.deepLink.route`);
  const resourcePublicId = uuid(deepLink.resourcePublicId, `${path}.deepLink.resourcePublicId`);
  if (resourcePublicId !== itemPublicId) return invalid(`${path}.deepLink.resourcePublicId`);
  if (!Array.isArray(source.availableActions) || source.availableActions.length !== 0) {
    return invalid(`${path}.availableActions`);
  }
  const statusCode = text(source.statusCode, `${path}.statusCode`, 64, CODE);
  if (
    statusCode !== 'RESTRICTED' &&
    !(CASE_STATES as readonly string[]).includes(statusCode)
  ) {
    return invalid(`${path}.statusCode`);
  }
  return Object.freeze({
    itemPublicId,
    title: text(source.title, `${path}.title`, 512),
    statusCode,
    fieldGroups: Object.freeze(fieldGroups),
    deepLink: Object.freeze({ route: PAY004_QUERY_CONTRACT.route, resourcePublicId }),
    availableActions: Object.freeze([] as const),
  });
}

export function selectPay004Projection(value: unknown): Pay004Projection {
  const source = exact(value, 'root', [
    'projectionVersion',
    'asOf',
    'variantKey',
    'queryState',
    'items',
  ]);
  if (source.projectionVersion !== '1' || source.variantKey !== PAY004_QUERY_CONTRACT.variantKey) {
    return invalid('root.variant');
  }
  if (!Array.isArray(source.items) || source.items.length > PAY004_QUERY_CONTRACT.pageLimit) {
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
  const failures = query.partialFailures.map((value, index) => {
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
  const state = query.state as Pay004QueryState['state'];
  const freshness = query.freshness as Pay004QueryState['freshness'];
  const nextCursor =
    query.nextCursor === null
      ? null
      : text(query.nextCursor, 'queryState.nextCursor', 1024, CURSOR);
  if (
    ((state === 'EMPTY' || state === 'UNAVAILABLE') && items.length !== 0) ||
    ((state === 'COMPLETE' || state === 'PARTIAL') && items.length === 0) ||
    (state === 'PARTIAL' && failures.length === 0) ||
    ((state === 'COMPLETE' || state === 'EMPTY') && failures.length > 0) ||
    (state === 'UNAVAILABLE') !== (freshness === 'UNAVAILABLE') ||
    (state === 'UNAVAILABLE' && nextCursor !== null)
  ) {
    return invalid('queryState.cardinality');
  }
  const counts = items.reduce(
    (summary, item) => {
      const decisions = Object.values(item.fieldGroups).filter(
        (decision): decision is Pay004FieldDecision => decision !== undefined
      );
      summary.viewCount += decisions.filter((decision) => decision.decision === 'VIEW').length;
      summary.maskedCount += decisions.filter((decision) => decision.decision === 'MASK').length;
      summary.omittedCount += PAY004_FIELD_GROUPS.length - decisions.length;
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
    variantKey: PAY004_QUERY_CONTRACT.variantKey,
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

function parseMoneyFilter(value: unknown, path: string) {
  if (value === null) return null;
  const source = exact(value, path, ['currency', 'minimumAmount', 'maximumAmount'], []);
  const amount = (candidate: unknown, child: string) =>
    candidate === null
      ? null
      : text(candidate, `${path}.${child}`, Number.MAX_SAFE_INTEGER, MONEY);
  const minimum =
    'minimumAmount' in source ? amount(source.minimumAmount, 'minimumAmount') : undefined;
  const maximum =
    'maximumAmount' in source ? amount(source.maximumAmount, 'maximumAmount') : undefined;
  const scaled = (candidate: string) => {
    const negative = candidate.startsWith('-');
    const [whole, fraction = ''] = (negative ? candidate.slice(1) : candidate).split('.');
    const value = BigInt(whole!) * 1_000_000n + BigInt(fraction.padEnd(6, '0'));
    return negative ? -value : value;
  };
  if (minimum !== undefined && minimum !== null && maximum !== undefined && maximum !== null) {
    if (scaled(minimum) > scaled(maximum)) return invalid(`${path}.amountRange`);
  }
  return Object.freeze({
    ...('currency' in source
      ? {
          currency:
            source.currency === null
              ? null
              : text(source.currency, `${path}.currency`, 3, CURRENCY),
        }
      : {}),
    ...(minimum === undefined ? {} : { minimumAmount: minimum }),
    ...(maximum === undefined ? {} : { maximumAmount: maximum }),
  });
}

function parsePolicyFilter(value: unknown, path: string) {
  if (value === null) return null;
  const source = exact(value, path, ['policyKeys', 'minimumRevision'], []);
  return Object.freeze({
    ...('policyKeys' in source
      ? { policyKeys: stringList(source.policyKeys, `${path}.policyKeys`, PUBLIC_ID) }
      : {}),
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

function parseStatusFilter(value: unknown, path: string) {
  if (value === null) return null;
  const source = exact(value, path, ['codes', 'minimumRevision'], []);
  const codes =
    'codes' in source ? stringList(source.codes, `${path}.codes`, CODE) : undefined;
  if (codes?.some((code) => !(CASE_STATES as readonly string[]).includes(code))) {
    return invalid(`${path}.codes`);
  }
  return Object.freeze({
    ...(codes === undefined ? {} : { codes }),
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

function parseFilter(value: unknown, path: string) {
  const source = exact(value, path, PAY004_QUERY_CONTRACT.filters, []);
  return Object.freeze({
    ...('retirementResult' in source
      ? { retirementResult: parseMoneyFilter(source.retirementResult, `${path}.retirementResult`) }
      : {}),
    ...('policyVersion' in source
      ? { policyVersion: parsePolicyFilter(source.policyVersion, `${path}.policyVersion`) }
      : {}),
    ...('caseStatus' in source
      ? { caseStatus: parseStatusFilter(source.caseStatus, `${path}.caseStatus`) }
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

export function assertPay004TrustedScope(value: unknown): Pay004TrustedScope {
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
  if (!canonicalLocale || canonicalLocale !== locale || canonicalTimeZone !== timeZone) {
    return invalid('scope.localeOrTimeZone');
  }
  return Object.freeze({
    contextScopeKey: text(source.contextScopeKey, 'scope.contextScopeKey', 512),
    decisionRevision: text(source.decisionRevision, 'scope.decisionRevision', 128, PUBLIC_ID),
    locale,
    timeZone,
    correlationId: uuid(source.correlationId, 'scope.correlationId'),
  });
}

export function pay004EnabledForTenant(rollout: Pay004Rollout, tenantId: string): boolean {
  return (
    rollout.feature === PAY004_FEATURE &&
    rollout.enabled === true &&
    rollout.enrolledTenantIds.includes(tenantId)
  );
}

export function assertPay004TrustedAdmission(value: unknown): Pay004TrustedAdmission {
  const source = exact(value, 'admission', [
    'kind',
    'feature',
    'pageRouteContractKey',
    'dataRouteContractKey',
    'tenantId',
    'contextScopeKey',
    'decisionRevision',
    'locale',
    'timeZone',
    'correlationId',
  ]);
  if (
    source.kind !== 'TRUSTED_PRODUCT_SURFACE_PAGE' ||
    source.feature !== PAY004_FEATURE ||
    source.pageRouteContractKey !== PAY004_PAGE_ROUTE_CONTRACT_KEY ||
    source.dataRouteContractKey !== PAY004_DATA_ROUTE_CONTRACT_KEY
  ) {
    return invalid('admission.binding');
  }
  const scope = assertPay004TrustedScope({
    contextScopeKey: source.contextScopeKey,
    decisionRevision: source.decisionRevision,
    locale: source.locale,
    timeZone: source.timeZone,
    correlationId: source.correlationId,
  });
  return Object.freeze({
    kind: 'TRUSTED_PRODUCT_SURFACE_PAGE',
    feature: PAY004_FEATURE,
    pageRouteContractKey: PAY004_PAGE_ROUTE_CONTRACT_KEY,
    dataRouteContractKey: PAY004_DATA_ROUTE_CONTRACT_KEY,
    tenantId: text(source.tenantId, 'admission.tenantId', 128, PUBLIC_ID),
    ...scope,
  });
}

export function createPay004QueryRequest(
  trustedScope: Pay004TrustedScope,
  options: Pay004QueryOptions = {}
): Pay004QueryRequest {
  const scope = assertPay004TrustedScope(trustedScope);
  const sort = pay004Sort(
    options.sort ?? [PAY004_QUERY_CONTRACT.defaultSort],
    true
  );
  return Object.freeze({
    limit: integer(options.limit ?? PAY004_QUERY_CONTRACT.pageLimit, 'request.limit', 1, 100),
    filter: parseFilter(options.filter ?? {}, 'request.filter'),
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

function pay004Sort(value: unknown, appendDefaultTieBreak: boolean): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    return invalid('request.sort');
  }
  const requested = value as string[];
  const sort = appendDefaultTieBreak && !requested.some((entry) => entry.startsWith('itemPublicId:'))
    ? [...requested, PAY004_QUERY_CONTRACT.defaultSort]
    : [...requested];
  if (
    sort.length < 1 ||
    sort.length > 3 ||
    new Set(sort).size !== sort.length ||
    sort.some((entry) => !(PAY004_QUERY_CONTRACT.sorts as readonly string[]).includes(entry)) ||
    new Set(sort.map((entry) => entry.split(':', 1)[0])).size !== sort.length ||
    !sort.at(-1)?.startsWith('itemPublicId:')
  ) {
    return invalid('request.sort');
  }
  return sort;
}

export function assertPay004QueryRequest(value: unknown): Pay004QueryRequest {
  const source = exact(
    value,
    'request',
    ['limit', 'filter', 'sort', 'locale', 'timeZone', 'correlationId', 'asOf', 'cursor'],
    ['limit', 'filter', 'sort', 'locale', 'timeZone', 'correlationId']
  );
  const sort = pay004Sort(source.sort, false);
  const scope = assertPay004TrustedScope({
    contextScopeKey: 'assertion-only',
    decisionRevision: 'assertion-only',
    locale: source.locale,
    timeZone: source.timeZone,
    correlationId: source.correlationId,
  });
  return createPay004QueryRequest(scope, {
    limit: source.limit as number,
    filter: record(source.filter, 'request.filter'),
    sort,
    ...('asOf' in source
      ? { asOf: source.asOf === null ? null : text(source.asOf, 'request.asOf', 64) }
      : {}),
    ...('cursor' in source
      ? { cursor: source.cursor === null ? null : text(source.cursor, 'request.cursor', 1024) }
      : {}),
  });
}
