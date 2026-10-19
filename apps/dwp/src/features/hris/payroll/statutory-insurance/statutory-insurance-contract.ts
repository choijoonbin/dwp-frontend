export const STATUTORY_INSURANCE_FEATURE = 'HRIS_PAYROLL_STATUTORY_INSURANCE' as const;
export const STATUTORY_INSURANCE_DEFAULT_ENABLED = false as const;
export const STATUTORY_INSURANCE_DEFAULT_ENROLLED_TENANTS = Object.freeze([] as readonly string[]);

export const STATUTORY_CONFIGURATION_PAGE_ROUTE_CONTRACT_KEY =
  'route.hcm.configuration.statutory.page' as const;
export const STATUTORY_CONFIGURATION_DATA_ROUTE_CONTRACT_KEY =
  'route.hcm.configuration.statutory.data' as const;
export const SOCIAL_INSURANCE_PAGE_ROUTE_CONTRACT_KEY =
  'route.hcm.operations.pay-tax-social-insurance.page' as const;
export const SOCIAL_INSURANCE_DATA_ROUTE_CONTRACT_KEY =
  'route.hcm.operations.pay-tax-social-insurance.data' as const;
export const COUNTRY_PACK_ACTIVATE_ROUTE_CONTRACT_KEY =
  'route.hcm.operations.country-pack-activate.action' as const;

export const STATUTORY_CONFIGURATION_PATH =
  '/api/payroll/v1/workbench/configuration/statutory' as const;
export const SOCIAL_INSURANCE_PATH = '/api/payroll/v1/workbench/pay-tax-social-insurance' as const;
export const STATUTORY_CONFIGURATION_ROUTE = '/hr/settings/statutory' as const;
export const SOCIAL_INSURANCE_ROUTE = '/hr/operations/payroll/tax-social-insurance' as const;

export const STATUTORY_CONFIGURATION_ENTRY_QUERY = Object.freeze({
  contractId: 'IAQ-026',
  variantKey: 'STATUTORY',
  method: 'GET',
  path: STATUTORY_CONFIGURATION_PATH,
  routeContractKey: STATUTORY_CONFIGURATION_DATA_ROUTE_CONTRACT_KEY,
  purpose: 'PAYROLL_CONFIGURATION',
  pageLimit: 100,
  fieldGroups: Object.freeze([
    'COUNTRY_PACK_METADATA',
    'STATUTORY_RULE',
    'ACTIVATION_STATUS',
  ] as const),
});

export const SOCIAL_INSURANCE_ENTRY_QUERY = Object.freeze({
  contractId: 'IAQ-048',
  variantKey: 'TAX_SOCIAL_INSURANCE',
  method: 'GET',
  path: SOCIAL_INSURANCE_PATH,
  routeContractKey: SOCIAL_INSURANCE_DATA_ROUTE_CONTRACT_KEY,
  purpose: 'PAYROLL_OPERATIONS',
  pageLimit: 100,
  fieldGroups: Object.freeze(['SOCIAL_INSURANCE', 'POLICY_VERSION'] as const),
});

export const COUNTRY_PACK_ACTIVATE_ACTION_KEY = 'hris.action.pay.country.pack.activate' as const;
export const MISSING_TAX_PRODUCER_COMPONENT = 'tax.result' as const;
export const MISSING_TAX_PRODUCER_ERROR = 'PRODUCER_UNAVAILABLE' as const;
export const COUNTRY_PACK_ACTIVATE_OPERATION = Object.freeze({
  contractId: 'PEP-PAY-028',
  actionKey: COUNTRY_PACK_ACTIVATE_ACTION_KEY,
  method: 'POST',
  pathTemplate: '/api/payroll/v1/country-packs/{packId}/activate',
  routeContractKey: COUNTRY_PACK_ACTIVATE_ROUTE_CONTRACT_KEY,
  purpose: 'STATUTORY_CONFIGURATION',
  riskTier: 'HIGH',
  stepUp: 'STEPUP-MGMT-HIGH-V1',
  segregationOfDuties: 'PACK_INSTALLER_NE_STATUTORY_APPROVER',
});

export type StatutoryInsuranceRollout = Readonly<{
  feature: typeof STATUTORY_INSURANCE_FEATURE;
  enabled: boolean;
  enrolledTenantIds: readonly string[];
}>;

export const STATUTORY_INSURANCE_DEFAULT_ROLLOUT: StatutoryInsuranceRollout = Object.freeze({
  feature: STATUTORY_INSURANCE_FEATURE,
  enabled: STATUTORY_INSURANCE_DEFAULT_ENABLED,
  enrolledTenantIds: STATUTORY_INSURANCE_DEFAULT_ENROLLED_TENANTS,
});

export type FieldDecision<T> =
  | Readonly<{ decision: 'VIEW'; value: T }>
  | Readonly<{
      decision: 'MASK';
      value: null;
      maskReason: string;
      maskedDisplayKey: string;
    }>;

export type MetadataValue = Readonly<{
  key: string;
  version: string;
  digest: string | null;
}>;

export type PolicyValue = Readonly<{
  policyKey: string;
  revision: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: string;
}>;

export type ActivationStatusValue = Readonly<{
  code: 'AVAILABLE' | 'INSTALLED' | 'VALIDATED' | 'APPROVED' | 'ACTIVE' | 'SUSPENDED' | 'RETIRED';
  revision: number;
}>;

export type PostedMoney = Readonly<{ amount: string; currency: string }>;

export type CountryPackActivationAction = Readonly<{
  actionKey: typeof COUNTRY_PACK_ACTIVATE_ACTION_KEY;
  method: 'POST';
  targetResourceType: 'COUNTRY_PACK';
  targetResourcePublicId: string;
  resolvedHref: string;
  idempotencyPolicy: 'REQUIRED_IDEMPOTENCY_KEY';
  stepUpPolicy: 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED';
}>;

export type StatutoryConfigurationItem = Readonly<{
  itemPublicId: string;
  title: string;
  statusCode: string;
  fieldGroups: Readonly<{
    COUNTRY_PACK_METADATA?: FieldDecision<MetadataValue>;
    STATUTORY_RULE?: FieldDecision<PolicyValue>;
    ACTIVATION_STATUS?: FieldDecision<ActivationStatusValue>;
  }>;
  deepLink: Readonly<{
    route: typeof STATUTORY_CONFIGURATION_ROUTE;
    resourcePublicId: string;
  }>;
  availableActions: readonly CountryPackActivationAction[];
}>;

export type SocialInsuranceItem = Readonly<{
  itemPublicId: string;
  title: string;
  statusCode: string;
  fieldGroups: Readonly<{
    SOCIAL_INSURANCE?: FieldDecision<PostedMoney>;
    POLICY_VERSION?: FieldDecision<PolicyValue>;
  }>;
  deepLink: Readonly<{
    route: typeof SOCIAL_INSURANCE_ROUTE;
    resourcePublicId: string;
  }>;
  availableActions: readonly [];
}>;

export type EntryQueryState = Readonly<{
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

export type StatutoryConfigurationProjection = Readonly<{
  projectionVersion: '2';
  asOf: string;
  variantKey: 'STATUTORY';
  queryState: EntryQueryState;
  items: readonly StatutoryConfigurationItem[];
}>;

export type SocialInsuranceProjection = Readonly<{
  projectionVersion: '1';
  asOf: string;
  variantKey: 'TAX_SOCIAL_INSURANCE';
  queryState: EntryQueryState;
  items: readonly SocialInsuranceItem[];
}>;

export const STATUTORY_CONFIGURATION_SORTS = Object.freeze([
  'countryPackMetadata:ASC',
  'statutoryRule:ASC',
  'activationStatus:ASC',
  'countryPackMetadata:DESC',
  'statutoryRule:DESC',
  'activationStatus:DESC',
  'itemPublicId:ASC',
  'itemPublicId:DESC',
] as const);
export const SOCIAL_INSURANCE_SORTS = Object.freeze([
  'taxResult:ASC',
  'socialInsurance:ASC',
  'policyVersion:ASC',
  'taxResult:DESC',
  'socialInsurance:DESC',
  'policyVersion:DESC',
  'itemPublicId:ASC',
  'itemPublicId:DESC',
] as const);

export type StatutoryConfigurationQuery = Readonly<{
  limit: number;
  filter: Readonly<{
    countryPackMetadata?: Readonly<{
      keys?: readonly string[];
      versions?: readonly string[];
    }> | null;
    statutoryRule?: Readonly<{
      policyKeys?: readonly string[];
      minimumRevision?: number | null;
    }> | null;
    activationStatus?: Readonly<{
      codes?: readonly string[];
      minimumRevision?: number | null;
    }> | null;
    effectiveOn?: string | null;
  }>;
  sort: readonly (typeof STATUTORY_CONFIGURATION_SORTS)[number][];
  locale: string;
  timeZone: string;
  correlationId: string;
  asOf?: string | null;
  cursor?: string | null;
}>;

export type SocialInsuranceQuery = Readonly<{
  limit: number;
  filter: Readonly<{
    taxResult?: Readonly<{
      currency?: string | null;
      minimumAmount?: string | null;
      maximumAmount?: string | null;
    }> | null;
    socialInsurance?: Readonly<{
      currency?: string | null;
      minimumAmount?: string | null;
      maximumAmount?: string | null;
    }> | null;
    policyVersion?: Readonly<{
      policyKeys?: readonly string[];
      minimumRevision?: number | null;
    }> | null;
    effectiveOn?: string | null;
  }>;
  sort: readonly (typeof SOCIAL_INSURANCE_SORTS)[number][];
  locale: string;
  timeZone: string;
  correlationId: string;
  asOf?: string | null;
  cursor?: string | null;
}>;

export type CountryPackActivationRequest = Readonly<{
  officialReferenceSet: string;
  effectiveDate: string;
  goldenPackDigest: string;
  statutoryApprovalReceiptId: string;
}>;

export type CountryPackActivationCommand = Readonly<{
  packId: string;
  expectedActivationRevision: number;
  idempotencyKey: string;
  correlationId: string;
  request: CountryPackActivationRequest;
}>;

export type PayrollCommandReceipt = Readonly<{
  receiptId: string;
  commandType: 'COUNTRY_PACK_ACTIVATE';
  originatingAction: 'PAY_COUNTRY_PACK_ACTIVATE';
  subjectPrincipalPublicId: string;
  populationScopeDigest: string;
  fieldPolicyRevision: number;
  purposeCode: 'STATUTORY_CONFIGURATION';
  authorizationRevision: number;
  status: 'ACCEPTED' | 'SUCCEEDED';
  correlationId: string;
  requestDigest: string;
  createdAt: string;
  aggregateVersion: number;
  resultRef?: string;
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const PUBLIC_ID = /^[A-Za-z0-9._:-]{1,128}$/u;
const CODE = /^[A-Z][A-Z0-9_]{1,63}$/u;
const DISPLAY_KEY = /^[a-z][a-z0-9._-]{1,127}$/u;
const COMPONENT_KEY = /^[a-z][a-z0-9._-]{0,127}$/u;
const POLICY_KEY = /^[a-z][a-z0-9._-]{1,127}$/u;
const DIGEST = /^[0-9a-f]{64}$/u;
const CURSOR = /^[A-Za-z0-9_-]{16,1024}$/u;
const DATE = /^\d{4}-\d{2}-\d{2}$/u;
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/u;
const MONEY = /^(?:0|[1-9][0-9]{0,14})(?:\.[0-9]{1,4})?$/u;
const CURRENCY = /^[A-Z]{3}$/u;

export class StatutoryInsuranceContractError extends Error {
  readonly kind = 'PAY003_CONTRACT_ERROR' as const;

  constructor(path: string) {
    super(`Invalid PAY-003 contract: ${path}`);
    this.name = 'StatutoryInsuranceContractError';
  }
}

function invalid(path: string): never {
  throw new StatutoryInsuranceContractError(path);
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid(path);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return invalid(path);
  return value as Record<string, unknown>;
}

function exact(
  value: unknown,
  path: string,
  allowed: readonly string[],
  required: readonly string[] = allowed
) {
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

function date(value: unknown, path: string): string {
  const candidate = text(value, path, 10, DATE);
  const parsed = new Date(`${candidate}T00:00:00Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== candidate) {
    return invalid(path);
  }
  return candidate;
}

function instant(value: unknown, path: string): string {
  const candidate = text(value, path, 100, INSTANT);
  if (Number.isNaN(Date.parse(candidate))) return invalid(path);
  return candidate;
}

function metadata(value: unknown, path: string): MetadataValue {
  const source = exact(value, path, ['key', 'version', 'digest']);
  return Object.freeze({
    key: text(source.key, `${path}.key`, 128, PUBLIC_ID),
    version: text(source.version, `${path}.version`, 64, PUBLIC_ID),
    digest: source.digest === null ? null : text(source.digest, `${path}.digest`, 64, DIGEST),
  });
}

function policy(value: unknown, path: string): PolicyValue {
  const source = exact(value, path, [
    'policyKey',
    'revision',
    'effectiveFrom',
    'effectiveTo',
    'status',
  ]);
  const effectiveFrom = date(source.effectiveFrom, `${path}.effectiveFrom`);
  const effectiveTo =
    source.effectiveTo === null ? null : date(source.effectiveTo, `${path}.effectiveTo`);
  if (effectiveTo !== null && effectiveTo <= effectiveFrom) return invalid(`${path}.effectiveTo`);
  return Object.freeze({
    policyKey: text(source.policyKey, `${path}.policyKey`, 128, POLICY_KEY),
    revision: integer(source.revision, `${path}.revision`, 1),
    effectiveFrom,
    effectiveTo,
    status: text(source.status, `${path}.status`, 64, CODE),
  });
}

function activationStatus(value: unknown, path: string): ActivationStatusValue {
  const source = exact(value, path, ['code', 'revision']);
  const code = text(source.code, `${path}.code`, 64, CODE);
  if (
    !['AVAILABLE', 'INSTALLED', 'VALIDATED', 'APPROVED', 'ACTIVE', 'SUSPENDED', 'RETIRED'].includes(
      code
    )
  ) {
    return invalid(`${path}.code`);
  }
  return Object.freeze({
    code: code as ActivationStatusValue['code'],
    revision: integer(source.revision, `${path}.revision`, 1),
  });
}

function money(value: unknown, path: string): PostedMoney {
  const source = exact(value, path, ['amount', 'currency']);
  return Object.freeze({
    amount: postedAmount(source.amount, `${path}.amount`),
    currency: text(source.currency, `${path}.currency`, 3, CURRENCY),
  });
}

function postedAmount(value: unknown, path: string) {
  const amount = text(value, path, 24, MONEY);
  return amount;
}

function fieldDecision<T>(
  value: unknown,
  path: string,
  parse: (value: unknown, path: string) => T
) {
  const candidate = record(value, path);
  if (candidate.decision === 'VIEW') {
    const source = exact(candidate, path, ['decision', 'value']);
    return Object.freeze({
      decision: 'VIEW' as const,
      value: parse(source.value, `${path}.value`),
    });
  }
  if (candidate.decision === 'MASK') {
    const source = exact(candidate, path, ['decision', 'value', 'maskReason', 'maskedDisplayKey']);
    if (source.value !== null) return invalid(`${path}.value`);
    return Object.freeze({
      decision: 'MASK' as const,
      value: null,
      maskReason: text(source.maskReason, `${path}.maskReason`, 64, CODE),
      maskedDisplayKey: text(source.maskedDisplayKey, `${path}.maskedDisplayKey`, 128, DISPLAY_KEY),
    });
  }
  return invalid(`${path}.decision`);
}

function queryState(value: unknown): EntryQueryState {
  const source = exact(value, 'queryState', [
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
    return invalid('queryState.state');
  }
  if (!['CURRENT', 'STALE', 'UNAVAILABLE'].includes(String(source.freshness))) {
    return invalid('queryState.freshness');
  }
  const summary = exact(source.fieldDecisionSummary, 'queryState.fieldDecisionSummary', [
    'viewCount',
    'maskedCount',
    'omittedCount',
  ]);
  if (!Array.isArray(source.partialFailures) || source.partialFailures.length > 32) {
    return invalid('queryState.partialFailures');
  }
  const failures = source.partialFailures.map((entry, index) => {
    const path = `queryState.partialFailures[${index}]`;
    const failure = exact(entry, path, ['componentKey', 'errorCode', 'correlationId', 'retryable']);
    if (typeof failure.retryable !== 'boolean') return invalid(`${path}.retryable`);
    return Object.freeze({
      componentKey: text(failure.componentKey, `${path}.componentKey`, 128, COMPONENT_KEY),
      errorCode: text(failure.errorCode, `${path}.errorCode`, 64, CODE),
      correlationId: uuid(failure.correlationId, `${path}.correlationId`),
      retryable: failure.retryable,
    });
  });
  const cache = exact(source.cachePolicy, 'queryState.cachePolicy', [
    'authorizationDecisionRevision',
    'invalidationEvent',
    'maxAgeSeconds',
  ]);
  if (cache.invalidationEvent !== 'dwp.hris.access.assignment.changed.v1') {
    return invalid('queryState.cachePolicy.invalidationEvent');
  }
  const state = source.state as EntryQueryState['state'];
  const freshness = source.freshness as EntryQueryState['freshness'];
  const nextCursor =
    source.nextCursor === null
      ? null
      : text(source.nextCursor, 'queryState.nextCursor', 1024, CURSOR);
  if (state === 'PARTIAL' && failures.length === 0) return invalid('queryState.partialFailures');
  if (state === 'COMPLETE' && failures.length !== 0) return invalid('queryState.partialFailures');
  if ((state === 'UNAVAILABLE') !== (freshness === 'UNAVAILABLE')) {
    return invalid('queryState.freshness');
  }
  if (state === 'UNAVAILABLE' && nextCursor !== null) return invalid('queryState.nextCursor');
  return Object.freeze({
    state,
    scopeDecisionRevision: text(
      source.scopeDecisionRevision,
      'queryState.scopeDecisionRevision',
      128,
      PUBLIC_ID
    ),
    freshness,
    nextCursor,
    fieldDecisionSummary: Object.freeze({
      viewCount: integer(summary.viewCount, 'queryState.fieldDecisionSummary.viewCount'),
      maskedCount: integer(summary.maskedCount, 'queryState.fieldDecisionSummary.maskedCount'),
      omittedCount: integer(summary.omittedCount, 'queryState.fieldDecisionSummary.omittedCount'),
    }),
    partialFailures: Object.freeze(failures),
    correlationId: uuid(source.correlationId, 'queryState.correlationId'),
    cachePolicy: Object.freeze({
      authorizationDecisionRevision: text(
        cache.authorizationDecisionRevision,
        'queryState.cachePolicy.authorizationDecisionRevision',
        128,
        PUBLIC_ID
      ),
      invalidationEvent: 'dwp.hris.access.assignment.changed.v1' as const,
      maxAgeSeconds: integer(cache.maxAgeSeconds, 'queryState.cachePolicy.maxAgeSeconds', 0, 300),
    }),
  });
}

function assertCardinality(state: EntryQueryState, itemCount: number) {
  if ((state.state === 'EMPTY' || state.state === 'UNAVAILABLE') && itemCount !== 0) {
    return invalid('items.cardinality');
  }
  if ((state.state === 'COMPLETE' || state.state === 'PARTIAL') && itemCount === 0) {
    return invalid('items.cardinality');
  }
}

function assertUniqueItemPublicIds(items: readonly { itemPublicId: string }[]) {
  if (new Set(items.map((item) => item.itemPublicId)).size !== items.length) {
    return invalid('items.itemPublicId.duplicate');
  }
}

function assertFieldDecisionSummary(
  state: EntryQueryState,
  groups: readonly Readonly<Record<string, FieldDecision<unknown>>>[],
  expectedGroupCount: number
) {
  let viewed = 0;
  let masked = 0;
  let omitted = 0;
  groups.forEach((item) => {
    viewed += Object.values(item).filter((decision) => decision.decision === 'VIEW').length;
    masked += Object.values(item).filter((decision) => decision.decision === 'MASK').length;
    omitted += expectedGroupCount - Object.keys(item).length;
  });
  if (
    state.fieldDecisionSummary.viewCount !== viewed ||
    state.fieldDecisionSummary.maskedCount !== masked ||
    state.fieldDecisionSummary.omittedCount !== omitted
  ) {
    return invalid('queryState.fieldDecisionSummary');
  }
}

function activationAction(value: unknown, itemPublicId: string): CountryPackActivationAction {
  const source = exact(value, 'items.availableActions[]', [
    'actionKey',
    'method',
    'targetResourceType',
    'targetResourcePublicId',
    'resolvedHref',
    'idempotencyPolicy',
    'stepUpPolicy',
  ]);
  const target = uuid(
    source.targetResourcePublicId,
    'items.availableActions[].targetResourcePublicId'
  );
  const href = text(source.resolvedHref, 'items.availableActions[].resolvedHref', 128);
  const expectedHref = `/api/payroll/v1/country-packs/${itemPublicId}/activate`;
  if (
    source.actionKey !== COUNTRY_PACK_ACTIVATE_ACTION_KEY ||
    source.method !== 'POST' ||
    source.targetResourceType !== 'COUNTRY_PACK' ||
    source.idempotencyPolicy !== 'REQUIRED_IDEMPOTENCY_KEY' ||
    source.stepUpPolicy !== 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED' ||
    target !== itemPublicId ||
    href !== expectedHref ||
    href.split(itemPublicId).length !== 2 ||
    href.includes('?') ||
    href.includes('#')
  ) {
    return invalid('items.availableActions[].binding');
  }
  return Object.freeze({
    actionKey: COUNTRY_PACK_ACTIVATE_ACTION_KEY,
    method: 'POST',
    targetResourceType: 'COUNTRY_PACK',
    targetResourcePublicId: target,
    resolvedHref: href,
    idempotencyPolicy: 'REQUIRED_IDEMPOTENCY_KEY',
    stepUpPolicy: 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED',
  });
}

export function parseStatutoryConfigurationProjection(
  value: unknown
): StatutoryConfigurationProjection {
  const source = exact(value, 'projection', [
    'projectionVersion',
    'asOf',
    'variantKey',
    'queryState',
    'items',
  ]);
  if (source.projectionVersion !== '2' || source.variantKey !== 'STATUTORY') {
    return invalid('projection.identity');
  }
  const state = queryState(source.queryState);
  if (!Array.isArray(source.items) || source.items.length > 100) return invalid('items');
  const items = source.items.map((entry, index): StatutoryConfigurationItem => {
    const path = `items[${index}]`;
    const item = exact(entry, path, [
      'itemPublicId',
      'title',
      'statusCode',
      'fieldGroups',
      'deepLink',
      'availableActions',
    ]);
    const itemPublicId = uuid(item.itemPublicId, `${path}.itemPublicId`);
    const groups = exact(
      item.fieldGroups,
      `${path}.fieldGroups`,
      ['COUNTRY_PACK_METADATA', 'STATUTORY_RULE', 'ACTIVATION_STATUS'],
      []
    );
    if (Object.keys(groups).length === 0) return invalid(`${path}.fieldGroups`);
    const fieldGroups: StatutoryConfigurationItem['fieldGroups'] = Object.freeze({
      ...(groups.COUNTRY_PACK_METADATA === undefined
        ? {}
        : {
            COUNTRY_PACK_METADATA: fieldDecision(
              groups.COUNTRY_PACK_METADATA,
              `${path}.fieldGroups.COUNTRY_PACK_METADATA`,
              metadata
            ),
          }),
      ...(groups.STATUTORY_RULE === undefined
        ? {}
        : {
            STATUTORY_RULE: fieldDecision(
              groups.STATUTORY_RULE,
              `${path}.fieldGroups.STATUTORY_RULE`,
              policy
            ),
          }),
      ...(groups.ACTIVATION_STATUS === undefined
        ? {}
        : {
            ACTIVATION_STATUS: fieldDecision(
              groups.ACTIVATION_STATUS,
              `${path}.fieldGroups.ACTIVATION_STATUS`,
              activationStatus
            ),
          }),
    });
    const deepLink = exact(item.deepLink, `${path}.deepLink`, ['route', 'resourcePublicId']);
    if (
      deepLink.route !== STATUTORY_CONFIGURATION_ROUTE ||
      deepLink.resourcePublicId !== itemPublicId
    ) {
      return invalid(`${path}.deepLink`);
    }
    if (!Array.isArray(item.availableActions) || item.availableActions.length > 1) {
      return invalid(`${path}.availableActions`);
    }
    const actions = item.availableActions.map((action) => activationAction(action, itemPublicId));
    const activation = fieldGroups.ACTIVATION_STATUS;
    const safeFields =
      fieldGroups.COUNTRY_PACK_METADATA?.decision === 'VIEW' &&
      fieldGroups.STATUTORY_RULE?.decision === 'VIEW' &&
      activation?.decision === 'VIEW' &&
      ['APPROVED', 'SUSPENDED'].includes(activation.value.code) &&
      Number.isSafeInteger(activation.value.revision) &&
      activation.value.revision >= 0;
    if (
      actions.length > 0 &&
      (!safeFields ||
        state.state !== 'COMPLETE' ||
        state.freshness !== 'CURRENT' ||
        state.partialFailures.length !== 0)
    ) {
      return invalid(`${path}.availableActions.preconditions`);
    }
    return Object.freeze({
      itemPublicId,
      title: text(item.title, `${path}.title`, 512),
      statusCode: text(item.statusCode, `${path}.statusCode`, 64, CODE),
      fieldGroups,
      deepLink: Object.freeze({
        route: STATUTORY_CONFIGURATION_ROUTE,
        resourcePublicId: itemPublicId,
      }),
      availableActions: Object.freeze(actions),
    });
  });
  assertUniqueItemPublicIds(items);
  assertCardinality(state, items.length);
  assertFieldDecisionSummary(
    state,
    items.map((item) => item.fieldGroups as Readonly<Record<string, FieldDecision<unknown>>>),
    3
  );
  return Object.freeze({
    projectionVersion: '2',
    asOf: instant(source.asOf, 'projection.asOf'),
    variantKey: 'STATUTORY',
    queryState: state,
    items: Object.freeze(items),
  });
}

export function parseSocialInsuranceProjection(value: unknown): SocialInsuranceProjection {
  const source = exact(value, 'projection', [
    'projectionVersion',
    'asOf',
    'variantKey',
    'queryState',
    'items',
  ]);
  if (source.projectionVersion !== '1' || source.variantKey !== 'TAX_SOCIAL_INSURANCE') {
    return invalid('projection.identity');
  }
  const state = queryState(source.queryState);
  if (!Array.isArray(source.items) || source.items.length > 100) return invalid('items');
  const items = source.items.map((entry, index): SocialInsuranceItem => {
    const path = `items[${index}]`;
    const item = exact(entry, path, [
      'itemPublicId',
      'title',
      'statusCode',
      'fieldGroups',
      'deepLink',
      'availableActions',
    ]);
    const itemPublicId = uuid(item.itemPublicId, `${path}.itemPublicId`);
    const groups = exact(
      item.fieldGroups,
      `${path}.fieldGroups`,
      ['SOCIAL_INSURANCE', 'POLICY_VERSION'],
      []
    );
    if (Object.keys(groups).length === 0) return invalid(`${path}.fieldGroups`);
    const fieldGroups: SocialInsuranceItem['fieldGroups'] = Object.freeze({
      ...(groups.SOCIAL_INSURANCE === undefined
        ? {}
        : {
            SOCIAL_INSURANCE: fieldDecision(
              groups.SOCIAL_INSURANCE,
              `${path}.fieldGroups.SOCIAL_INSURANCE`,
              money
            ),
          }),
      ...(groups.POLICY_VERSION === undefined
        ? {}
        : {
            POLICY_VERSION: fieldDecision(
              groups.POLICY_VERSION,
              `${path}.fieldGroups.POLICY_VERSION`,
              policy
            ),
          }),
    });
    const deepLink = exact(item.deepLink, `${path}.deepLink`, ['route', 'resourcePublicId']);
    if (deepLink.route !== SOCIAL_INSURANCE_ROUTE || deepLink.resourcePublicId !== itemPublicId) {
      return invalid(`${path}.deepLink`);
    }
    if (!Array.isArray(item.availableActions) || item.availableActions.length !== 0) {
      return invalid(`${path}.availableActions`);
    }
    return Object.freeze({
      itemPublicId,
      title: text(item.title, `${path}.title`, 512),
      statusCode: text(item.statusCode, `${path}.statusCode`, 64, CODE),
      fieldGroups,
      deepLink: Object.freeze({ route: SOCIAL_INSURANCE_ROUTE, resourcePublicId: itemPublicId }),
      availableActions: Object.freeze([] as []),
    });
  });
  assertUniqueItemPublicIds(items);
  assertCardinality(state, items.length);
  if (items.length > 0) {
    const [taxFailure] = state.partialFailures;
    if (
      state.state !== 'PARTIAL' ||
      state.partialFailures.length !== 1 ||
      taxFailure?.componentKey !== MISSING_TAX_PRODUCER_COMPONENT ||
      taxFailure.errorCode !== MISSING_TAX_PRODUCER_ERROR ||
      taxFailure.retryable !== true ||
      taxFailure.correlationId !== state.correlationId
    ) {
      return invalid('queryState.partialFailures.taxProducer');
    }
  }
  assertFieldDecisionSummary(
    state,
    items.map((item) => item.fieldGroups as Readonly<Record<string, FieldDecision<unknown>>>),
    2
  );
  return Object.freeze({
    projectionVersion: '1',
    asOf: instant(source.asOf, 'projection.asOf'),
    variantKey: 'TAX_SOCIAL_INSURANCE',
    queryState: state,
    items: Object.freeze(items),
  });
}

export function validateCountryPackActivationRequest(
  candidate: unknown
): CountryPackActivationRequest {
  const source = exact(candidate, 'activationRequest', [
    'officialReferenceSet',
    'effectiveDate',
    'goldenPackDigest',
    'statutoryApprovalReceiptId',
  ]);
  return Object.freeze({
    officialReferenceSet: text(
      source.officialReferenceSet,
      'activationRequest.officialReferenceSet',
      240
    ),
    effectiveDate: date(source.effectiveDate, 'activationRequest.effectiveDate'),
    goldenPackDigest: text(
      source.goldenPackDigest,
      'activationRequest.goldenPackDigest',
      64,
      DIGEST
    ),
    statutoryApprovalReceiptId: uuid(
      source.statutoryApprovalReceiptId,
      'activationRequest.statutoryApprovalReceiptId'
    ),
  });
}

export function validateCountryPackActivationCommand(
  candidate: unknown
): CountryPackActivationCommand {
  const source = exact(candidate, 'activationCommand', [
    'packId',
    'expectedActivationRevision',
    'idempotencyKey',
    'correlationId',
    'request',
  ]);
  return Object.freeze({
    packId: uuid(source.packId, 'activationCommand.packId'),
    expectedActivationRevision: integer(
      source.expectedActivationRevision,
      'activationCommand.expectedActivationRevision',
      0,
      Number.MAX_SAFE_INTEGER - 1
    ),
    idempotencyKey: uuid(source.idempotencyKey, 'activationCommand.idempotencyKey'),
    correlationId: uuid(source.correlationId, 'activationCommand.correlationId'),
    request: validateCountryPackActivationRequest(source.request),
  });
}

export function parsePayrollCommandReceipt(value: unknown): PayrollCommandReceipt {
  const source = exact(
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
      'aggregateVersion',
    ]
  );
  if (
    source.commandType !== 'COUNTRY_PACK_ACTIVATE' ||
    source.originatingAction !== 'PAY_COUNTRY_PACK_ACTIVATE' ||
    source.purposeCode !== 'STATUTORY_CONFIGURATION' ||
    !['ACCEPTED', 'SUCCEEDED'].includes(String(source.status))
  ) {
    return invalid('receipt.binding');
  }
  return Object.freeze({
    receiptId: uuid(source.receiptId, 'receipt.receiptId'),
    commandType: 'COUNTRY_PACK_ACTIVATE',
    originatingAction: 'PAY_COUNTRY_PACK_ACTIVATE',
    subjectPrincipalPublicId: uuid(
      source.subjectPrincipalPublicId,
      'receipt.subjectPrincipalPublicId'
    ),
    populationScopeDigest: text(
      source.populationScopeDigest,
      'receipt.populationScopeDigest',
      64,
      DIGEST
    ),
    fieldPolicyRevision: integer(source.fieldPolicyRevision, 'receipt.fieldPolicyRevision', 1),
    purposeCode: 'STATUTORY_CONFIGURATION',
    authorizationRevision: integer(
      source.authorizationRevision,
      'receipt.authorizationRevision',
      1
    ),
    status: source.status as PayrollCommandReceipt['status'],
    correlationId: uuid(source.correlationId, 'receipt.correlationId'),
    requestDigest: text(source.requestDigest, 'receipt.requestDigest', 64, DIGEST),
    createdAt: instant(source.createdAt, 'receipt.createdAt'),
    aggregateVersion: integer(source.aggregateVersion, 'receipt.aggregateVersion', 1),
    ...(source.resultRef === undefined
      ? {}
      : { resultRef: text(source.resultRef, 'receipt.resultRef', 256, PUBLIC_ID) }),
  });
}

export function statutoryInsuranceEnabledForTenant(
  rollout: StatutoryInsuranceRollout,
  tenantId: string
) {
  return (
    rollout.feature === STATUTORY_INSURANCE_FEATURE &&
    rollout.enabled === true &&
    rollout.enrolledTenantIds.includes(tenantId)
  );
}

export function statutoryConfigurationItemIsSafeToActivate(
  projection: StatutoryConfigurationProjection,
  item: StatutoryConfigurationItem
) {
  const activation = item.fieldGroups.ACTIVATION_STATUS;
  return (
    projection.queryState.state === 'COMPLETE' &&
    projection.queryState.freshness === 'CURRENT' &&
    projection.queryState.partialFailures.length === 0 &&
    item.fieldGroups.COUNTRY_PACK_METADATA?.decision === 'VIEW' &&
    item.fieldGroups.STATUTORY_RULE?.decision === 'VIEW' &&
    activation?.decision === 'VIEW' &&
    ['APPROVED', 'SUSPENDED'].includes(activation.value.code) &&
    item.availableActions.length === 1 &&
    item.availableActions[0]?.targetResourcePublicId === item.itemPublicId
  );
}
