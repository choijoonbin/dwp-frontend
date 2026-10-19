import type { HrisCommandReceipt } from '../command-receipts/model/command-receipt';

export const HRM011_FEATURE = 'HRIS_HRM_CONTRACT_COMPENSATION_WORKBENCH' as const;
export const HRM011_ADAPTER_KIND = 'HRIS_HRM_011_ENTRY_QUERY_V2' as const;
export const HRM011_QUERY_ID = 'IAQ-008' as const;
export const HRM011_ISSUE_ROUTE_CONTRACT =
  'route.hcm.operations.employment-contract-issue.action' as const;

export const HRM011_ISSUE_ACTION = Object.freeze({
  actionKey: 'hris.action.hrm.issue-employment-contract',
  method: 'POST',
  hrefTemplate: '/api/people/v1/hris/employment-contracts',
  idempotencyPolicy: 'REQUIRED_IDEMPOTENCY_KEY',
  stepUpPolicy: 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED',
} as const);

export const HRM011_QUERY_CONTRACT = Object.freeze({
  queryId: HRM011_QUERY_ID,
  operationId: 'IAQ.OP.008',
  iaNodeId: 'BASE:hr-contracts-compensation-basis',
  variantKey: 'CONTRACTS_COMPENSATION_BASIS',
  browserPath: '/api/people/v1/hris/workbench/operations/contracts/compensation/basis',
  ownerPath: '/v1/hris/workbench/operations/contracts/compensation/basis',
  route: '/hr/operations/people/contracts-compensation-basis',
  deepLinkTemplate:
    '/hr/operations/people/contracts-compensation-basis?tab=overview&focus={resourcePublicId}',
  capability: 'hcm.operations.people.view',
  purpose: 'HR_OPERATIONS',
  fieldGroups: Object.freeze(['CONTRACT_METADATA', 'COMPENSATION_BASIS']),
  filters: Object.freeze(['contractMetadata', 'compensationBasis', 'effectiveOn']),
  sorts: Object.freeze([
    'contractMetadata:ASC',
    'compensationBasis:ASC',
    'contractMetadata:DESC',
    'compensationBasis:DESC',
    'itemPublicId:ASC',
    'itemPublicId:DESC',
  ]),
  defaultSort: 'itemPublicId:ASC',
  pageLimit: 100,
  framing: Object.freeze({
    primaryUser:
      'HR operations specialist with the required workforce population and HRIS_DUTY_CONTRACT_ISSUER responsibility',
    operationalQuestion:
      'Which current work relationships have one authoritative compensation basis and one valid published employment-contract template, and which can safely issue a contract now?',
    primaryAction:
      'Issue an employment contract for the selected relationship after preview, current-version, authorization, step-up and snapshot-digest validation.',
    archetype: 'list-detail-workflow',
  }),
} as const);

export type Hrm011IssueAction = typeof HRM011_ISSUE_ACTION;
export type Hrm011MetadataValue = Readonly<{
  key: string;
  version: string;
  digest: string | null;
}>;
export type Hrm011MoneyValue = Readonly<{ amount: string; currency: string }>;
export type Hrm011FieldValue = Hrm011MetadataValue | Hrm011MoneyValue;
export type Hrm011FieldDecision =
  | Readonly<{ decision: 'VIEW'; value: Hrm011FieldValue }>
  | Readonly<{
      decision: 'MASK';
      value: null;
      maskReason: string;
      maskedDisplayKey: string;
    }>;

export type Hrm011Item = Readonly<{
  itemPublicId: string;
  resourceVersion: number;
  title: string;
  statusCode: string;
  fieldGroups: Readonly<Record<string, Hrm011FieldDecision>>;
  deepLink: Readonly<{ route: typeof HRM011_QUERY_CONTRACT.route; resourcePublicId: string }>;
  availableActions: readonly Hrm011IssueAction[];
}>;

export type Hrm011QueryState = Readonly<{
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

export type Hrm011Projection = Readonly<{
  projectionVersion: '2';
  variantKey: typeof HRM011_QUERY_CONTRACT.variantKey;
  asOf: string;
  queryState: Hrm011QueryState;
  items: readonly Hrm011Item[];
}>;

export type Hrm011TrustedScope = Readonly<{
  contextScopeKey: string;
  decisionRevision: string;
  locale: string;
  timeZone: string;
  correlationId: string;
}>;

export type Hrm011QueryOptions = Readonly<{
  filter?: Readonly<Record<string, unknown>>;
  sort?: readonly string[];
  asOf?: string | null;
  cursor?: string | null;
}>;

export type Hrm011QueryRequest = Readonly<{
  limit: 100;
  filter: Readonly<Record<string, unknown>>;
  sort: readonly string[];
  locale: string;
  timeZone: string;
  correlationId: string;
  asOf?: string | null;
  cursor?: string | null;
}>;

export type Hrm011EmploymentContractRequest = Readonly<{
  relationshipPublicId: string;
  templatePublicId: string;
  templateVersion: number;
  locale: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  snapshotDigest: string;
}>;

export type Hrm011IssueCommand = Readonly<{
  request: Hrm011EmploymentContractRequest;
  expectedObjectVersion: number;
  idempotencyKey: string;
  correlationId: string;
}>;

export type Hrm011IssueDraft = Hrm011IssueCommand &
  Readonly<{
    sourceItemPublicId: string;
    action: Hrm011IssueAction;
  }>;

export type Hrm011IssueResult = HrisCommandReceipt | void;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const PUBLIC_ID = /^[A-Za-z0-9._:-]{1,128}$/u;
const CODE = /^[A-Z][A-Z0-9_]{1,63}$/u;
const DISPLAY_KEY = /^[a-z][a-z0-9._-]{1,127}$/u;
const COMPONENT_KEY = /^[a-z][a-z0-9._-]{0,127}$/u;
const DIGEST = /^[0-9a-f]{64}$/u;
const CURSOR = /^[A-Za-z0-9_-]{16,1024}$/u;
const CIVIL_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/u;
const DECIMAL = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]{1,6})?$/u;
const CURRENCY = /^[A-Z]{3}$/u;
const POSITIVE_INTEGER_TEXT = /^[1-9][0-9]*$/u;

export class Hrm011ContractError extends Error {
  readonly kind = 'HRM011_CONTRACT_OR_REVISION_ERROR' as const;

  constructor(path: string) {
    super(`Invalid HRM-011 contract: ${path}`);
    this.name = 'Hrm011ContractError';
  }
}

function invalid(path: string): never {
  throw new Hrm011ContractError(path);
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

function canonicalDecimal(value: unknown, path: string): string {
  const candidate = text(value, path, 64, DECIMAL);
  if (/^-0(?:\.0+)?$/u.test(candidate)) return invalid(path);
  return candidate;
}

function stringList(value: unknown, path: string, pattern: RegExp) {
  if (!Array.isArray(value) || value.length > 50) return invalid(path);
  const values = value.map((entry, index) => text(entry, `${path}[${index}]`, 128, pattern));
  if (new Set(values).size !== values.length) return invalid(path);
  return Object.freeze(values);
}

function parseMetadataValue(value: unknown, path: string): Hrm011MetadataValue {
  const source = exact(value, path, ['key', 'version', 'digest']);
  return Object.freeze({
    key: text(source.key, `${path}.key`, 128, PUBLIC_ID),
    version: text(source.version, `${path}.version`, 64, PUBLIC_ID),
    digest: source.digest === null ? null : text(source.digest, `${path}.digest`, 64, DIGEST),
  });
}

function parseMoneyValue(value: unknown, path: string): Hrm011MoneyValue {
  const source = exact(value, path, ['amount', 'currency']);
  return Object.freeze({
    amount: canonicalDecimal(source.amount, `${path}.amount`),
    currency: text(source.currency, `${path}.currency`, 3, CURRENCY),
  });
}

function parseDecision(
  group: (typeof HRM011_QUERY_CONTRACT.fieldGroups)[number],
  value: unknown,
  path: string
): Hrm011FieldDecision {
  const candidate = record(value, path);
  if (candidate.decision === 'VIEW') {
    const source = exact(candidate, path, ['decision', 'value']);
    return Object.freeze({
      decision: 'VIEW',
      value:
        group === 'CONTRACT_METADATA'
          ? parseMetadataValue(source.value, `${path}.value`)
          : parseMoneyValue(source.value, `${path}.value`),
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

function parseAction(value: unknown, path: string): Hrm011IssueAction {
  const source = exact(value, path, [
    'actionKey',
    'method',
    'hrefTemplate',
    'idempotencyPolicy',
    'stepUpPolicy',
  ]);
  if (
    source.actionKey !== HRM011_ISSUE_ACTION.actionKey ||
    source.method !== HRM011_ISSUE_ACTION.method ||
    source.hrefTemplate !== HRM011_ISSUE_ACTION.hrefTemplate ||
    source.idempotencyPolicy !== HRM011_ISSUE_ACTION.idempotencyPolicy ||
    source.stepUpPolicy !== HRM011_ISSUE_ACTION.stepUpPolicy
  ) {
    return invalid(path);
  }
  return HRM011_ISSUE_ACTION;
}

function parseItem(value: unknown, index: number): Hrm011Item {
  const path = `items[${index}]`;
  const source = exact(value, path, [
    'itemPublicId',
    'resourceVersion',
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
    groupKeys.some((key) => !(HRM011_QUERY_CONTRACT.fieldGroups as readonly string[]).includes(key))
  ) {
    return invalid(`${path}.fieldGroups`);
  }
  const fieldGroups: Record<string, Hrm011FieldDecision> = {};
  groupKeys.forEach((key) => {
    fieldGroups[key] = parseDecision(
      key as (typeof HRM011_QUERY_CONTRACT.fieldGroups)[number],
      groups[key],
      `${path}.fieldGroups.${key}`
    );
  });
  const deepLink = exact(source.deepLink, `${path}.deepLink`, ['route', 'resourcePublicId']);
  if (deepLink.route !== HRM011_QUERY_CONTRACT.route) return invalid(`${path}.deepLink.route`);
  const deepLinkResource = text(
    deepLink.resourcePublicId,
    `${path}.deepLink.resourcePublicId`,
    128,
    PUBLIC_ID
  );
  if (deepLinkResource !== itemPublicId) return invalid(`${path}.deepLink.resourcePublicId`);
  if (!Array.isArray(source.availableActions) || source.availableActions.length > 1) {
    return invalid(`${path}.availableActions`);
  }
  const availableActions = source.availableActions.map((action, actionIndex) =>
    parseAction(action, `${path}.availableActions[${actionIndex}]`)
  );
  const statusCode = text(source.statusCode, `${path}.statusCode`, 64, CODE);
  const contractDecision = fieldGroups.CONTRACT_METADATA;
  const basisDecision = fieldGroups.COMPENSATION_BASIS;
  if (availableActions.length > 0) {
    if (
      statusCode !== 'READY_TO_ISSUE' ||
      contractDecision?.decision !== 'VIEW' ||
      basisDecision?.decision !== 'VIEW'
    ) {
      return invalid(`${path}.availableActions`);
    }
    const metadata = contractDecision.value as Hrm011MetadataValue;
    const money = basisDecision.value as Hrm011MoneyValue;
    uuid(itemPublicId, `${path}.itemPublicId`);
    uuid(metadata.key, `${path}.fieldGroups.CONTRACT_METADATA.value.key`);
    const templateVersion = text(
      metadata.version,
      `${path}.fieldGroups.CONTRACT_METADATA.value.version`,
      16,
      POSITIVE_INTEGER_TEXT
    );
    integer(Number(templateVersion), `${path}.fieldGroups.CONTRACT_METADATA.value.version`, 1);
    if (metadata.digest === null || money.amount.startsWith('-')) {
      return invalid(`${path}.availableActions`);
    }
  }
  return Object.freeze({
    itemPublicId,
    resourceVersion: integer(source.resourceVersion, `${path}.resourceVersion`),
    title: text(source.title, `${path}.title`, 512),
    statusCode,
    fieldGroups: Object.freeze(fieldGroups),
    deepLink: Object.freeze({
      route: HRM011_QUERY_CONTRACT.route,
      resourcePublicId: deepLinkResource,
    }),
    availableActions: Object.freeze(availableActions),
  });
}

export function selectHrm011Projection(value: unknown): Hrm011Projection {
  const source = exact(value, 'root', [
    'projectionVersion',
    'asOf',
    'variantKey',
    'queryState',
    'items',
  ]);
  if (source.projectionVersion !== '2' || source.variantKey !== HRM011_QUERY_CONTRACT.variantKey) {
    return invalid('root.variant');
  }
  if (!Array.isArray(source.items) || source.items.length > HRM011_QUERY_CONTRACT.pageLimit) {
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
  const state = query.state as Hrm011QueryState['state'];
  const freshness = query.freshness as Hrm011QueryState['freshness'];
  const nextCursor =
    query.nextCursor === null
      ? null
      : text(query.nextCursor, 'queryState.nextCursor', 1024, CURSOR);
  if (
    ((state === 'EMPTY' || state === 'UNAVAILABLE') && items.length !== 0) ||
    (state === 'PARTIAL' && partialFailures.length === 0) ||
    (state === 'COMPLETE' && partialFailures.length !== 0) ||
    (state === 'UNAVAILABLE') !== (freshness === 'UNAVAILABLE') ||
    (state === 'UNAVAILABLE' && nextCursor !== null) ||
    ((state !== 'COMPLETE' || freshness !== 'CURRENT') &&
      items.some((item) => item.availableActions.length > 0))
  ) {
    return invalid('queryState.cardinality');
  }
  const counts = items.reduce(
    (summary, item) => {
      const decisions = Object.values(item.fieldGroups);
      summary.viewCount += decisions.filter((decision) => decision.decision === 'VIEW').length;
      summary.maskedCount += decisions.filter((decision) => decision.decision === 'MASK').length;
      summary.omittedCount += HRM011_QUERY_CONTRACT.fieldGroups.length - decisions.length;
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
    projectionVersion: '2',
    variantKey: HRM011_QUERY_CONTRACT.variantKey,
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

function parseMetadataFilter(value: unknown, path: string) {
  if (value === null) return null;
  const source = exact(value, path, ['keys', 'versions'], []);
  return Object.freeze({
    ...('keys' in source ? { keys: stringList(source.keys, `${path}.keys`, PUBLIC_ID) } : {}),
    ...('versions' in source
      ? { versions: stringList(source.versions, `${path}.versions`, PUBLIC_ID) }
      : {}),
  });
}

function parseMoneyFilter(value: unknown, path: string) {
  if (value === null) return null;
  const source = exact(value, path, ['currency', 'minimumAmount', 'maximumAmount'], []);
  const result = {
    ...('currency' in source
      ? {
          currency:
            source.currency === null
              ? null
              : text(source.currency, `${path}.currency`, 3, CURRENCY),
        }
      : {}),
    ...('minimumAmount' in source
      ? {
          minimumAmount:
            source.minimumAmount === null
              ? null
              : canonicalDecimal(source.minimumAmount, `${path}.minimumAmount`),
        }
      : {}),
    ...('maximumAmount' in source
      ? {
          maximumAmount:
            source.maximumAmount === null
              ? null
              : canonicalDecimal(source.maximumAmount, `${path}.maximumAmount`),
        }
      : {}),
  };
  if (
    typeof result.minimumAmount === 'string' &&
    typeof result.maximumAmount === 'string' &&
    Number(result.minimumAmount) > Number(result.maximumAmount)
  ) {
    return invalid(path);
  }
  return Object.freeze(result);
}

function parseFilter(value: unknown, path: string) {
  const source = exact(value, path, HRM011_QUERY_CONTRACT.filters, []);
  return Object.freeze({
    ...('contractMetadata' in source
      ? {
          contractMetadata: parseMetadataFilter(
            source.contractMetadata,
            `${path}.contractMetadata`
          ),
        }
      : {}),
    ...('compensationBasis' in source
      ? {
          compensationBasis: parseMoneyFilter(
            source.compensationBasis,
            `${path}.compensationBasis`
          ),
        }
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

export function assertHrm011TrustedScope(value: unknown): Hrm011TrustedScope {
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

export function createHrm011QueryRequest(
  scopeValue: Hrm011TrustedScope,
  options: Hrm011QueryOptions = {}
): Hrm011QueryRequest {
  const scope = assertHrm011TrustedScope(scopeValue);
  const requestedSort = [...(options.sort ?? [HRM011_QUERY_CONTRACT.defaultSort])];
  if (!requestedSort.some((sort) => sort.startsWith('itemPublicId:'))) {
    requestedSort.push(HRM011_QUERY_CONTRACT.defaultSort);
  }
  if (
    requestedSort.length < 1 ||
    requestedSort.length > 3 ||
    new Set(requestedSort).size !== requestedSort.length ||
    requestedSort.some(
      (sort) => !(HRM011_QUERY_CONTRACT.sorts as readonly string[]).includes(sort)
    ) ||
    !requestedSort.at(-1)?.startsWith('itemPublicId:')
  ) {
    return invalid('request.sort');
  }
  return Object.freeze({
    limit: HRM011_QUERY_CONTRACT.pageLimit,
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

export function assertHrm011QueryRequest(value: unknown): Hrm011QueryRequest {
  const source = exact(
    value,
    'request',
    ['limit', 'filter', 'sort', 'locale', 'timeZone', 'correlationId', 'asOf', 'cursor'],
    ['limit', 'filter', 'sort', 'locale', 'timeZone', 'correlationId']
  );
  if (source.limit !== HRM011_QUERY_CONTRACT.pageLimit) return invalid('request.limit');
  const scope = assertHrm011TrustedScope({
    contextScopeKey: 'validated:scope',
    decisionRevision: 'validated:decision',
    locale: source.locale,
    timeZone: source.timeZone,
    correlationId: source.correlationId,
  });
  return createHrm011QueryRequest(scope, {
    filter: record(source.filter, 'request.filter'),
    sort: Array.isArray(source.sort)
      ? source.sort.map((entry) => String(entry))
      : invalid('request.sort'),
    ...('asOf' in source ? { asOf: source.asOf as string | null } : {}),
    ...('cursor' in source ? { cursor: source.cursor as string | null } : {}),
  });
}

export function assertHrm011EmploymentContractRequest(
  value: unknown
): Hrm011EmploymentContractRequest {
  const source = exact(value, 'employmentContractRequest', [
    'relationshipPublicId',
    'templatePublicId',
    'templateVersion',
    'locale',
    'effectiveFrom',
    'effectiveTo',
    'snapshotDigest',
  ]);
  const locale = text(source.locale, 'employmentContractRequest.locale', 35);
  let canonicalLocale: string;
  try {
    [canonicalLocale] = Intl.getCanonicalLocales(locale);
  } catch {
    return invalid('employmentContractRequest.locale');
  }
  if (!canonicalLocale || canonicalLocale !== locale) {
    return invalid('employmentContractRequest.locale');
  }
  const effectiveFrom = civilDate(source.effectiveFrom, 'employmentContractRequest.effectiveFrom');
  const effectiveTo =
    source.effectiveTo === null
      ? null
      : civilDate(source.effectiveTo, 'employmentContractRequest.effectiveTo');
  if (effectiveTo !== null && effectiveTo <= effectiveFrom) {
    return invalid('employmentContractRequest.effectiveTo');
  }
  return Object.freeze({
    relationshipPublicId: uuid(
      source.relationshipPublicId,
      'employmentContractRequest.relationshipPublicId'
    ),
    templatePublicId: uuid(source.templatePublicId, 'employmentContractRequest.templatePublicId'),
    templateVersion: integer(
      source.templateVersion,
      'employmentContractRequest.templateVersion',
      1
    ),
    locale: canonicalLocale,
    effectiveFrom,
    effectiveTo,
    snapshotDigest: text(
      source.snapshotDigest,
      'employmentContractRequest.snapshotDigest',
      64,
      DIGEST
    ),
  });
}

export function hrm011ItemCanIssue(item: Hrm011Item): boolean {
  return (
    item.statusCode === 'READY_TO_ISSUE' &&
    item.availableActions.length === 1 &&
    item.availableActions[0] === HRM011_ISSUE_ACTION &&
    item.fieldGroups.CONTRACT_METADATA?.decision === 'VIEW' &&
    item.fieldGroups.COMPENSATION_BASIS?.decision === 'VIEW'
  );
}

export function createHrm011IssueRequest(
  item: Hrm011Item,
  locale: string,
  effectiveFrom: string,
  effectiveTo: string | null
): Hrm011EmploymentContractRequest {
  if (!hrm011ItemCanIssue(item)) return invalid('issue.item');
  const metadataDecision = item.fieldGroups.CONTRACT_METADATA;
  if (metadataDecision?.decision !== 'VIEW') return invalid('issue.contractMetadata');
  const metadata = metadataDecision.value as Hrm011MetadataValue;
  if (metadata.digest === null || !POSITIVE_INTEGER_TEXT.test(metadata.version)) {
    return invalid('issue.contractMetadata');
  }
  return assertHrm011EmploymentContractRequest({
    relationshipPublicId: item.itemPublicId,
    templatePublicId: metadata.key,
    templateVersion: Number(metadata.version),
    locale,
    effectiveFrom,
    effectiveTo,
    snapshotDigest: metadata.digest,
  });
}
