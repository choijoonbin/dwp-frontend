import { resolveZonedDateKey } from '@dwp-frontend/shared-i18n';

export const TIME_CLOSE_ENTRY_MODES = ['COMMAND_CENTER', 'DAILY_CLOSE', 'MONTHLY_CLOSE'] as const;

export type TimeCloseEntryMode = (typeof TIME_CLOSE_ENTRY_MODES)[number];
export type TimeCloseQueryState = 'COMPLETE' | 'EMPTY' | 'PARTIAL' | 'UNAVAILABLE';
export type TimeCloseFreshness = 'CURRENT' | 'STALE' | 'UNAVAILABLE';
export type TimeCloseCommandKind = 'VALIDATE' | 'CLOSE' | 'REOPEN' | 'HANDOFF';
export type TimeCloseReceiptStatus =
  'ACCEPTED' | 'RUNNING' | 'SUCCEEDED' | 'REJECTED' | 'FAILED' | 'RESULT_UNKNOWN';

export const TIME_CLOSE_ROUTE_PURPOSES = Object.freeze({
  'route.hcm.operations.time-command-center.page': 'TIME_OPERATIONS',
  'route.hcm.operations.time-daily-close.page': 'TIME_CLOSE',
  'route.hcm.operations.time-monthly-close.page': 'TIME_CLOSE',
  'route.hcm.operations.time-close-validate.action': 'WORK_TIME_PERIOD_CLOSURE',
  'route.hcm.operations.time-close.action': 'WORK_TIME_PERIOD_CLOSURE',
  'route.hcm.operations.time-reopen.action': 'WORK_TIME_PERIOD_CLOSURE',
  'route.hcm.operations.time-payroll-handoff-create.action': 'CLOSED_TIME_PAYROLL_TRANSFER',
  'route.hcm.operations.time-payroll-handoff.data': 'CLOSED_TIME_PAYROLL_TRANSFER',
} as const);

export type TimeClosePageRouteContractKey =
  | 'route.hcm.operations.time-command-center.page'
  | 'route.hcm.operations.time-daily-close.page'
  | 'route.hcm.operations.time-monthly-close.page';

export type TimeCloseActionKey =
  | 'hris.action.tim.close.validate'
  | 'hris.action.tim.close.close'
  | 'hris.action.tim.close.reopen'
  | 'hris.action.tim.handoff.create';

export type TimeCloseAction = Readonly<{
  actionKey: TimeCloseActionKey;
  method: 'POST';
  hrefTemplate:
    | '/api/time/v1/close-periods/{periodId}/validations'
    | '/api/time/v1/close-periods/{periodId}/close'
    | '/api/time/v1/close-periods/{periodId}/reopen'
    | '/api/time/v1/close-periods/{periodId}/payroll-handoffs';
  idempotencyPolicy: 'REQUIRED_IDEMPOTENCY_KEY';
  stepUpPolicy: 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED';
}>;

export type TimeCloseReceiptSummary = Readonly<{
  receiptId: string;
  state: string;
  occurredAt: string;
  revision: number;
}>;

export type TimeClosePeriod = Readonly<{
  periodId: string;
  title: string;
  statusCode: string;
  periodStart: string | null;
  periodEnd: string | null;
  version: number | null;
  closeStatus: string | null;
  closeStatusRevision: number | null;
  blockerCount: number | null;
  impactCount: number | null;
  commandReceipt: TimeCloseReceiptSummary | null;
  handoffReceipt: TimeCloseReceiptSummary | null;
  deepLinkResourceId: string;
  actions: readonly TimeCloseAction[];
}>;

export type TimeClosePartialFailure = Readonly<{
  componentKey: string;
  errorCode: string;
  correlationId: string;
  retryable: boolean;
}>;

export type TimeCloseProjection = Readonly<{
  variant: TimeCloseEntryMode;
  queryState: TimeCloseQueryState;
  freshness: TimeCloseFreshness;
  asOf: string;
  nextCursor: string | null;
  correlationId: string;
  scopeDecisionRevision: string;
  cacheAuthorizationDecisionRevision: string;
  partialFailures: readonly TimeClosePartialFailure[];
  periods: readonly TimeClosePeriod[];
}>;

export type TimeCloseScope = Readonly<{
  ready: boolean;
  contextScopeKey: string;
  decisionRevision: string;
  locale: string;
  timeZone: string;
  correlationId: string;
  effectiveOn: string;
}>;

export type TimeCloseCommandReceipt = Readonly<{
  receiptId: string;
  commandType: 'PERIOD_VALIDATE' | 'PERIOD_CLOSE' | 'PERIOD_REOPEN' | 'PAYROLL_HANDOFF';
  originatingAction:
    'TIME_PERIOD_VALIDATE' | 'TIME_PERIOD_CLOSE' | 'TIME_PERIOD_REOPEN' | 'TIME_PAYROLL_HANDOFF';
  subjectPrincipalPublicId: string;
  populationScopeDigest: string;
  fieldPolicyRevision: number;
  purposeCode: 'WORK_TIME_PERIOD_CLOSURE' | 'CLOSED_TIME_PAYROLL_TRANSFER';
  authorizationRevision: number;
  status: TimeCloseReceiptStatus;
  correlationId: string;
  requestDigest: string;
  createdAt: string;
  aggregateVersion?: number;
  resultRef?: string;
}>;

export type PayrollTimeHandoffStatus = Readonly<{
  handoffId: string;
  closePeriodId: string;
  closedTimeResultId: string;
  closeRevision: number;
  payrollEntityId: string;
  payPeriodId: string;
  workerCount: number;
  lineCount: number;
  sourceDigest: string;
  ruleDigest: string;
  payloadDigest: string;
  status: 'PENDING' | 'ACKNOWLEDGED' | 'REJECTED' | 'RESULT_UNKNOWN';
  receiverReceiptId: string | null;
  receiverReceiptRevision: number | null;
  receiverReceiptDigest: string | null;
  reasonCode: string | null;
  outcomeAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
  etag: string;
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const DIGEST = /^[0-9a-f]{64}$/u;
const CODE = /^[A-Z][A-Z0-9_]{1,63}$/u;
const REASON = /^[A-Z][A-Z0-9._-]{0,79}$/u;
const PUBLIC_ID = /^[A-Za-z0-9._:-]{1,128}$/u;
const CURSOR = /^[A-Za-z0-9_-]{16,1024}$/u;
const DECISION_REVISION = /^psr-[0-9a-f]{64}$/u;
const CONTEXT_SCOPE = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,199}$/u;
const STRONG_NUMERIC_ETAG = /^"[0-9]+"$/u;
const CIVIL_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const RFC3339 =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|[+-](\d{2}):(\d{2}))$/u;

export function isTimeCloseUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

function sourceRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Invalid ${label}.`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(
  source: Record<string, unknown>,
  allowed: readonly string[],
  required: readonly string[],
  label: string
): void {
  const keys = Object.keys(source);
  if (keys.some((key) => !allowed.includes(key)) || required.some((key) => !keys.includes(key))) {
    throw new Error(`Invalid ${label}.`);
  }
}

function exactText(value: unknown, maximum: number, label: string): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > maximum ||
    value !== value.trim() ||
    [...value].some((character) => {
      const point = character.codePointAt(0);
      return point !== undefined && (point < 0x20 || point === 0x7f);
    })
  ) {
    throw new Error(`Invalid ${label}.`);
  }
  return value;
}

function nonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`Invalid ${label}.`);
  return value;
}

function patterned(value: unknown, pattern: RegExp, maximum: number, label: string): string {
  const candidate = exactText(value, maximum, label);
  if (!pattern.test(candidate)) throw new Error(`Invalid ${label}.`);
  return candidate;
}

function uuid(value: unknown, label: string): string {
  return patterned(value, UUID, 36, label);
}

function integer(value: unknown, minimum: number, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) {
    throw new Error(`Invalid ${label}.`);
  }
  return value as number;
}

function validCalendarDate(year: number, month: number, day: number): boolean {
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1 && month <= 12 && day >= 1 && day <= (days[month - 1] ?? 0);
}

export function assertTimeCloseInstant(value: unknown, label: string): asserts value is string {
  const candidate = exactText(value, 80, label);
  const match = RFC3339.exec(candidate);
  if (
    !match ||
    !validCalendarDate(Number(match[1]), Number(match[2]), Number(match[3])) ||
    Number(match[4]) > 23 ||
    Number(match[5]) > 59 ||
    Number(match[6]) > 59 ||
    (match[7] !== undefined && Number(match[7]) > 23) ||
    (match[8] !== undefined && Number(match[8]) > 59) ||
    !Number.isFinite(Date.parse(candidate))
  ) {
    throw new Error(`Invalid ${label}.`);
  }
}

function instant(value: unknown, label: string): string {
  assertTimeCloseInstant(value, label);
  return value;
}

function civilDate(value: unknown, label: string): string {
  const candidate = patterned(value, CIVIL_DATE, 10, label);
  const parsed = new Date(`${candidate}T00:00:00Z`);
  if (!Number.isFinite(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== candidate) {
    throw new Error(`Invalid ${label}.`);
  }
  return candidate;
}

function literal<T extends string>(value: unknown, values: readonly T[], label: string): T {
  if (typeof value !== 'string' || !values.includes(value as T)) {
    throw new Error(`Invalid ${label}.`);
  }
  return value as T;
}

function nullable<T>(value: unknown, parser: (input: unknown) => T, label: string): T | null {
  if (value === null) return null;
  try {
    return parser(value);
  } catch {
    throw new Error(`Invalid ${label}.`);
  }
}

function parseMaskedOrView<T>(
  value: unknown,
  parseValue: (input: unknown) => T,
  label: string
): T | null {
  const source = sourceRecord(value, label);
  const decision = literal(source.decision, ['VIEW', 'MASK'] as const, `${label} decision`);
  if (decision === 'MASK') {
    exactKeys(
      source,
      ['decision', 'value', 'maskReason', 'maskedDisplayKey'],
      ['decision', 'value', 'maskReason', 'maskedDisplayKey'],
      label
    );
    if (source.value !== null) throw new Error(`Invalid ${label}.`);
    patterned(source.maskReason, CODE, 64, `${label} mask reason`);
    patterned(source.maskedDisplayKey, /^[a-z][a-z0-9._-]{1,127}$/u, 128, `${label} key`);
    return null;
  }
  exactKeys(source, ['decision', 'value'], ['decision', 'value'], label);
  return parseValue(source.value);
}

function fieldGroup<T>(
  groups: Record<string, unknown>,
  key: string,
  parser: (input: unknown) => T
): T | null {
  return Object.hasOwn(groups, key) ? parseMaskedOrView(groups[key], parser, key) : null;
}

function parseEffectiveRange(value: unknown) {
  const source = sourceRecord(value, 'time period value');
  exactKeys(
    source,
    ['effectiveFrom', 'effectiveTo', 'revision'],
    ['effectiveFrom', 'effectiveTo', 'revision'],
    'time period value'
  );
  return {
    effectiveFrom: civilDate(source.effectiveFrom, 'period start'),
    effectiveTo: nullable(
      source.effectiveTo,
      (entry) => civilDate(entry, 'period end'),
      'period end'
    ),
    revision: integer(source.revision, 1, 'period revision'),
  } as const;
}

function parseAggregate(value: unknown) {
  const source = sourceRecord(value, 'aggregate value');
  exactKeys(
    source,
    ['itemCount', 'revision', 'asOf'],
    ['itemCount', 'revision', 'asOf'],
    'aggregate value'
  );
  return {
    itemCount: integer(source.itemCount, 0, 'aggregate count'),
    revision: integer(source.revision, 1, 'aggregate revision'),
    asOf: instant(source.asOf, 'aggregate as-of'),
  } as const;
}

function parseStatus(value: unknown) {
  const source = sourceRecord(value, 'status value');
  exactKeys(source, ['code', 'revision'], ['code', 'revision'], 'status value');
  return {
    code: patterned(source.code, CODE, 64, 'status code'),
    revision: integer(source.revision, 1, 'status revision'),
  } as const;
}

function parseReceiptSummary(value: unknown): TimeCloseReceiptSummary {
  const source = sourceRecord(value, 'receipt value');
  exactKeys(
    source,
    ['receiptId', 'state', 'occurredAt', 'revision'],
    ['receiptId', 'state', 'occurredAt', 'revision'],
    'receipt value'
  );
  return {
    receiptId: uuid(source.receiptId, 'receipt id'),
    state: patterned(source.state, CODE, 64, 'receipt state'),
    occurredAt: instant(source.occurredAt, 'receipt time'),
    revision: integer(source.revision, 1, 'receipt revision'),
  };
}

const CLOSE_ACTIONS = Object.freeze({
  'hris.action.tim.close.validate': '/api/time/v1/close-periods/{periodId}/validations',
  'hris.action.tim.close.close': '/api/time/v1/close-periods/{periodId}/close',
  'hris.action.tim.close.reopen': '/api/time/v1/close-periods/{periodId}/reopen',
  'hris.action.tim.handoff.create': '/api/time/v1/close-periods/{periodId}/payroll-handoffs',
} as const);

const ADJACENT_ACTIONS = Object.freeze({
  'hris.action.tim.timecard.correct': '/api/time/v1/timecards/{timecardId}/corrections',
  'hris.action.tim.timecard.decide': '/api/time/v1/timecards/{timecardId}/decisions',
} as const);

function parseActions(value: unknown, variant: TimeCloseEntryMode): readonly TimeCloseAction[] {
  if (!Array.isArray(value) || value.length > 6) throw new Error('Invalid available actions.');
  const seen = new Set<string>();
  const actions: TimeCloseAction[] = [];
  value.forEach((entry) => {
    const source = sourceRecord(entry, 'available action');
    exactKeys(
      source,
      ['actionKey', 'method', 'hrefTemplate', 'idempotencyPolicy', 'stepUpPolicy'],
      ['actionKey', 'method', 'hrefTemplate', 'idempotencyPolicy', 'stepUpPolicy'],
      'available action'
    );
    const actionKey = exactText(source.actionKey, 128, 'action key');
    const href = exactText(source.hrefTemplate, 200, 'action href');
    const expected =
      CLOSE_ACTIONS[actionKey as keyof typeof CLOSE_ACTIONS] ??
      (variant === 'COMMAND_CENTER'
        ? ADJACENT_ACTIONS[actionKey as keyof typeof ADJACENT_ACTIONS]
        : undefined);
    if (
      !expected ||
      href !== expected ||
      source.method !== 'POST' ||
      source.idempotencyPolicy !== 'REQUIRED_IDEMPOTENCY_KEY' ||
      source.stepUpPolicy !== 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED' ||
      seen.has(actionKey)
    ) {
      throw new Error('Invalid available action.');
    }
    seen.add(actionKey);
    if (Object.hasOwn(CLOSE_ACTIONS, actionKey)) {
      actions.push({
        actionKey: actionKey as TimeCloseActionKey,
        method: 'POST',
        hrefTemplate: href as TimeCloseAction['hrefTemplate'],
        idempotencyPolicy: 'REQUIRED_IDEMPOTENCY_KEY',
        stepUpPolicy: 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED',
      });
    }
  });
  return actions;
}

const VARIANT_META = Object.freeze({
  COMMAND_CENTER: {
    route: '/hr/operations/time/command-center',
    groups: ['TIME_PERIOD', 'EXCEPTION_SUMMARY', 'COMMAND_RECEIPT'],
  },
  DAILY_CLOSE: {
    route: '/hr/operations/time/daily-close',
    groups: ['TIME_PERIOD', 'CLOSE_STATUS', 'IMPACT_SUMMARY'],
  },
  MONTHLY_CLOSE: {
    route: '/hr/operations/time/monthly-close',
    groups: ['TIME_PERIOD', 'CLOSE_STATUS', 'PAYROLL_HANDOFF'],
  },
} as const);

function parseQueryState(value: unknown) {
  const source = sourceRecord(value, 'query state');
  exactKeys(
    source,
    [
      'state',
      'scopeDecisionRevision',
      'freshness',
      'nextCursor',
      'fieldDecisionSummary',
      'partialFailures',
      'correlationId',
      'cachePolicy',
    ],
    [
      'state',
      'scopeDecisionRevision',
      'freshness',
      'nextCursor',
      'fieldDecisionSummary',
      'partialFailures',
      'correlationId',
      'cachePolicy',
    ],
    'query state'
  );
  const state = literal(
    source.state,
    ['COMPLETE', 'EMPTY', 'PARTIAL', 'UNAVAILABLE'] as const,
    'query state'
  );
  const freshness = literal(
    source.freshness,
    ['CURRENT', 'STALE', 'UNAVAILABLE'] as const,
    'query freshness'
  );
  const nextCursor = nullable(
    source.nextCursor,
    (entry) => patterned(entry, CURSOR, 1024, 'next cursor'),
    'next cursor'
  );
  if (!Array.isArray(source.partialFailures) || source.partialFailures.length > 32) {
    throw new Error('Invalid partial failures.');
  }
  const partialFailures = source.partialFailures.map((entry): TimeClosePartialFailure => {
    const failure = sourceRecord(entry, 'partial failure');
    exactKeys(
      failure,
      ['componentKey', 'errorCode', 'correlationId', 'retryable'],
      ['componentKey', 'errorCode', 'correlationId', 'retryable'],
      'partial failure'
    );
    if (typeof failure.retryable !== 'boolean') throw new Error('Invalid partial failure.');
    return {
      componentKey: patterned(
        failure.componentKey,
        /^[a-z][a-z0-9._-]{0,127}$/u,
        128,
        'partial component'
      ),
      errorCode: patterned(failure.errorCode, CODE, 64, 'partial error'),
      correlationId: uuid(failure.correlationId, 'partial correlation'),
      retryable: failure.retryable,
    };
  });
  const summary = sourceRecord(source.fieldDecisionSummary, 'field decision summary');
  exactKeys(
    summary,
    ['viewCount', 'maskedCount', 'omittedCount'],
    ['viewCount', 'maskedCount', 'omittedCount'],
    'field decision summary'
  );
  const fieldDecisionSummary = {
    viewCount: integer(summary.viewCount, 0, 'view count'),
    maskedCount: integer(summary.maskedCount, 0, 'masked count'),
    omittedCount: integer(summary.omittedCount, 0, 'omitted count'),
  } as const;
  const cache = sourceRecord(source.cachePolicy, 'cache policy');
  exactKeys(
    cache,
    ['authorizationDecisionRevision', 'invalidationEvent', 'maxAgeSeconds'],
    ['authorizationDecisionRevision', 'invalidationEvent', 'maxAgeSeconds'],
    'cache policy'
  );
  const cacheAuthorizationDecisionRevision = patterned(
    cache.authorizationDecisionRevision,
    PUBLIC_ID,
    128,
    'cache revision'
  );
  if (cache.invalidationEvent !== 'dwp.hris.access.assignment.changed.v1') {
    throw new Error('Invalid cache policy.');
  }
  const maxAge = integer(cache.maxAgeSeconds, 0, 'cache age');
  if (maxAge > 300) throw new Error('Invalid cache policy.');
  if (
    (state === 'PARTIAL') !== partialFailures.length > 0 ||
    (freshness === 'UNAVAILABLE') !== (state === 'UNAVAILABLE') ||
    (state === 'UNAVAILABLE' && nextCursor !== null)
  ) {
    throw new Error('Invalid query-state invariant.');
  }
  return {
    state,
    freshness,
    nextCursor,
    scopeDecisionRevision: patterned(
      source.scopeDecisionRevision,
      PUBLIC_ID,
      128,
      'scope decision revision'
    ),
    correlationId: uuid(source.correlationId, 'query correlation'),
    fieldDecisionSummary,
    cacheAuthorizationDecisionRevision,
    partialFailures,
  } as const;
}

export function parseTimeCloseProjection(
  value: unknown,
  expectedVariant: TimeCloseEntryMode
): TimeCloseProjection {
  const source = sourceRecord(value, 'time close projection');
  exactKeys(
    source,
    ['projectionVersion', 'asOf', 'variantKey', 'queryState', 'items'],
    ['projectionVersion', 'asOf', 'variantKey', 'queryState', 'items'],
    'time close projection'
  );
  if (source.projectionVersion !== '1' || source.variantKey !== expectedVariant) {
    throw new Error('Invalid time close projection variant.');
  }
  const query = parseQueryState(source.queryState);
  if (!Array.isArray(source.items) || source.items.length > 500) {
    throw new Error('Invalid time close items.');
  }
  if (['EMPTY', 'UNAVAILABLE'].includes(query.state) && source.items.length !== 0) {
    throw new Error('Invalid empty time close projection.');
  }
  const meta = VARIANT_META[expectedVariant];
  const identifiers = new Set<string>();
  const fieldDecisionSummary = { viewCount: 0, maskedCount: 0, omittedCount: 0 };
  const periods = source.items.map((entry): TimeClosePeriod => {
    const item = sourceRecord(entry, 'time close item');
    exactKeys(
      item,
      ['itemPublicId', 'title', 'statusCode', 'fieldGroups', 'deepLink', 'availableActions'],
      ['itemPublicId', 'title', 'statusCode', 'fieldGroups', 'deepLink', 'availableActions'],
      'time close item'
    );
    const periodId = patterned(item.itemPublicId, PUBLIC_ID, 128, 'period id');
    if (identifiers.has(periodId)) throw new Error('Duplicate time close period.');
    identifiers.add(periodId);
    const groups = sourceRecord(item.fieldGroups, 'field groups');
    if (
      Object.keys(groups).length < 1 ||
      Object.keys(groups).some((key) => !meta.groups.includes(key as never))
    ) {
      throw new Error('Invalid time close field groups.');
    }
    meta.groups.forEach((key) => {
      if (!Object.hasOwn(groups, key)) {
        fieldDecisionSummary.omittedCount += 1;
        return;
      }
      const group = sourceRecord(groups[key], key);
      const decision = literal(group.decision, ['VIEW', 'MASK'] as const, `${key} decision`);
      if (decision === 'VIEW') fieldDecisionSummary.viewCount += 1;
      else fieldDecisionSummary.maskedCount += 1;
    });
    const period = fieldGroup(groups, 'TIME_PERIOD', parseEffectiveRange);
    const closeStatus = fieldGroup(groups, 'CLOSE_STATUS', parseStatus);
    const exceptionSummary = fieldGroup(groups, 'EXCEPTION_SUMMARY', parseAggregate);
    const impactSummary = fieldGroup(groups, 'IMPACT_SUMMARY', parseAggregate);
    const commandReceipt = fieldGroup(groups, 'COMMAND_RECEIPT', parseReceiptSummary);
    const handoffReceipt = fieldGroup(groups, 'PAYROLL_HANDOFF', parseReceiptSummary);
    const parsedActions = parseActions(item.availableActions, expectedVariant);
    const deepLink = sourceRecord(item.deepLink, 'deep link');
    exactKeys(deepLink, ['route', 'resourcePublicId'], ['route', 'resourcePublicId'], 'deep link');
    const deepLinkResourceId = patterned(
      deepLink.resourcePublicId,
      PUBLIC_ID,
      128,
      'deep link resource'
    );
    if (deepLink.route !== meta.route || deepLinkResourceId !== periodId) {
      throw new Error('Invalid time close deep link.');
    }
    return {
      periodId,
      title: exactText(item.title, 512, 'period title'),
      statusCode: patterned(item.statusCode, CODE, 64, 'period status'),
      periodStart: period?.effectiveFrom ?? null,
      periodEnd: period?.effectiveTo ?? null,
      version: period?.revision ?? null,
      closeStatus: closeStatus?.code ?? null,
      closeStatusRevision: closeStatus?.revision ?? null,
      blockerCount: exceptionSummary?.itemCount ?? null,
      impactCount: impactSummary?.itemCount ?? null,
      commandReceipt,
      handoffReceipt,
      deepLinkResourceId,
      // Public identifiers that are not owner UUIDs remain readable but can never become a
      // command target. The wire action collection is still parsed strictly before it is hidden.
      actions: isTimeCloseUuid(periodId) && period !== null ? parsedActions : [],
    };
  });
  if (
    fieldDecisionSummary.viewCount !== query.fieldDecisionSummary.viewCount ||
    fieldDecisionSummary.maskedCount !== query.fieldDecisionSummary.maskedCount ||
    fieldDecisionSummary.omittedCount !== query.fieldDecisionSummary.omittedCount
  ) {
    throw new Error('Invalid field decision summary.');
  }
  return {
    variant: expectedVariant,
    queryState: query.state,
    freshness: query.freshness,
    asOf: instant(source.asOf, 'projection as-of'),
    nextCursor: query.nextCursor,
    correlationId: query.correlationId,
    scopeDecisionRevision: query.scopeDecisionRevision,
    cacheAuthorizationDecisionRevision: query.cacheAuthorizationDecisionRevision,
    partialFailures: query.partialFailures,
    periods,
  };
}

function isValidLocale(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    value.length < 2 ||
    value.length > 35 ||
    value !== value.trim()
  ) {
    return false;
  }
  try {
    new Intl.Locale(value);
    return true;
  } catch {
    return false;
  }
}

function isValidTimeZone(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    value.length < 1 ||
    value.length > 255 ||
    value !== value.trim()
  ) {
    return false;
  }
  return resolveZonedDateKey(0, value) !== null;
}

export function assertTimeCloseScope(scope: TimeCloseScope): void {
  if (!scope || typeof scope !== 'object') {
    throw new Error('Invalid TIM close operation scope.');
  }
  let effectiveOnValid = true;
  try {
    civilDate(scope.effectiveOn, 'effective date');
  } catch {
    effectiveOnValid = false;
  }
  if (
    scope.ready !== true ||
    !CONTEXT_SCOPE.test(scope.contextScopeKey) ||
    !DECISION_REVISION.test(scope.decisionRevision) ||
    !isValidLocale(scope.locale) ||
    !isValidTimeZone(scope.timeZone) ||
    !UUID.test(scope.correlationId) ||
    !effectiveOnValid
  ) {
    throw new Error('Invalid TIM close operation scope.');
  }
}

export function assertStrongTimeCloseEtag(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !STRONG_NUMERIC_ETAG.test(value)) {
    throw new Error('Invalid TIM close aggregate ETag.');
  }
}

export function parseTimeCloseCommandReceipt(value: unknown): TimeCloseCommandReceipt {
  const source = sourceRecord(value, 'time close command receipt');
  const required = [
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
  ] as const;
  exactKeys(
    source,
    [...required, 'aggregateVersion', 'resultRef'],
    required,
    'time close command receipt'
  );
  const commandType = literal(
    source.commandType,
    ['PERIOD_VALIDATE', 'PERIOD_CLOSE', 'PERIOD_REOPEN', 'PAYROLL_HANDOFF'] as const,
    'close command type'
  );
  const pairs = {
    PERIOD_VALIDATE: ['TIME_PERIOD_VALIDATE', 'WORK_TIME_PERIOD_CLOSURE'],
    PERIOD_CLOSE: ['TIME_PERIOD_CLOSE', 'WORK_TIME_PERIOD_CLOSURE'],
    PERIOD_REOPEN: ['TIME_PERIOD_REOPEN', 'WORK_TIME_PERIOD_CLOSURE'],
    PAYROLL_HANDOFF: ['TIME_PAYROLL_HANDOFF', 'CLOSED_TIME_PAYROLL_TRANSFER'],
  } as const;
  const expected = pairs[commandType];
  if (source.originatingAction !== expected[0] || source.purposeCode !== expected[1]) {
    throw new Error('Invalid time close command receipt binding.');
  }
  return {
    receiptId: uuid(source.receiptId, 'receipt id'),
    commandType,
    originatingAction: expected[0],
    subjectPrincipalPublicId: uuid(source.subjectPrincipalPublicId, 'receipt subject'),
    populationScopeDigest: patterned(source.populationScopeDigest, DIGEST, 64, 'scope digest'),
    fieldPolicyRevision: integer(source.fieldPolicyRevision, 1, 'field policy revision'),
    purposeCode: expected[1],
    authorizationRevision: integer(source.authorizationRevision, 1, 'authorization revision'),
    status: literal(
      source.status,
      ['ACCEPTED', 'RUNNING', 'SUCCEEDED', 'REJECTED', 'FAILED', 'RESULT_UNKNOWN'] as const,
      'receipt status'
    ),
    correlationId: uuid(source.correlationId, 'receipt correlation'),
    requestDigest: patterned(source.requestDigest, DIGEST, 64, 'request digest'),
    createdAt: instant(source.createdAt, 'receipt time'),
    ...(Object.hasOwn(source, 'aggregateVersion')
      ? { aggregateVersion: integer(source.aggregateVersion, 1, 'aggregate version') }
      : {}),
    ...(Object.hasOwn(source, 'resultRef')
      ? { resultRef: nonEmptyString(source.resultRef, 'result reference') }
      : {}),
  };
}

const COMMAND_BINDING = Object.freeze({
  VALIDATE: ['PERIOD_VALIDATE', 'TIME_PERIOD_VALIDATE', 'WORK_TIME_PERIOD_CLOSURE'],
  CLOSE: ['PERIOD_CLOSE', 'TIME_PERIOD_CLOSE', 'WORK_TIME_PERIOD_CLOSURE'],
  REOPEN: ['PERIOD_REOPEN', 'TIME_PERIOD_REOPEN', 'WORK_TIME_PERIOD_CLOSURE'],
  HANDOFF: ['PAYROLL_HANDOFF', 'TIME_PAYROLL_HANDOFF', 'CLOSED_TIME_PAYROLL_TRANSFER'],
} as const);

export function assertTimeCloseReceiptBinding(
  kind: TimeCloseCommandKind,
  receipt: TimeCloseCommandReceipt,
  correlationId: string
): void {
  const binding = COMMAND_BINDING[kind];
  if (
    receipt.commandType !== binding[0] ||
    receipt.originatingAction !== binding[1] ||
    receipt.purposeCode !== binding[2] ||
    receipt.correlationId !== correlationId
  ) {
    throw new Error('TIM close receipt does not match the pending command.');
  }
}

export function assertTimeCloseReceiptReplayInvariant(
  prior: TimeCloseCommandReceipt,
  replay: TimeCloseCommandReceipt
): void {
  if (JSON.stringify(prior) !== JSON.stringify(replay)) {
    throw new Error('TIM close command replay changed its durable receipt.');
  }
}

export function assertTimeCloseReceiptProgression(
  prior: TimeCloseCommandReceipt,
  next: TimeCloseCommandReceipt
): void {
  const priorStable = {
    ...prior,
    status: undefined,
    aggregateVersion: undefined,
    resultRef: undefined,
  };
  const nextStable = {
    ...next,
    status: undefined,
    aggregateVersion: undefined,
    resultRef: undefined,
  };
  const allowed: Record<TimeCloseReceiptStatus, readonly TimeCloseReceiptStatus[]> = {
    ACCEPTED: ['ACCEPTED', 'RUNNING', 'SUCCEEDED', 'REJECTED', 'FAILED', 'RESULT_UNKNOWN'],
    RUNNING: ['RUNNING', 'SUCCEEDED', 'REJECTED', 'FAILED', 'RESULT_UNKNOWN'],
    SUCCEEDED: ['SUCCEEDED'],
    REJECTED: ['REJECTED'],
    FAILED: ['FAILED'],
    RESULT_UNKNOWN: ['RESULT_UNKNOWN'],
  };
  if (
    JSON.stringify(priorStable) !== JSON.stringify(nextStable) ||
    !allowed[prior.status].includes(next.status) ||
    (prior.aggregateVersion !== undefined && prior.aggregateVersion !== next.aggregateVersion) ||
    (prior.resultRef !== undefined && prior.resultRef !== next.resultRef)
  ) {
    throw new Error('Invalid TIM close receipt progression.');
  }
}

export function parsePayrollTimeHandoffStatus(
  value: unknown,
  etag: unknown
): PayrollTimeHandoffStatus {
  assertStrongTimeCloseEtag(etag);
  const source = sourceRecord(value, 'payroll handoff status');
  const keys = [
    'handoffId',
    'closePeriodId',
    'closedTimeResultId',
    'closeRevision',
    'payrollEntityId',
    'payPeriodId',
    'workerCount',
    'lineCount',
    'sourceDigest',
    'ruleDigest',
    'payloadDigest',
    'status',
    'receiverReceiptId',
    'receiverReceiptRevision',
    'receiverReceiptDigest',
    'reasonCode',
    'outcomeAt',
    'createdAt',
    'updatedAt',
    'version',
  ] as const;
  exactKeys(source, keys, keys, 'payroll handoff status');
  const status = literal(
    source.status,
    ['PENDING', 'ACKNOWLEDGED', 'REJECTED', 'RESULT_UNKNOWN'] as const,
    'handoff status'
  );
  const receiverReceiptId = nullable(
    source.receiverReceiptId,
    (entry) => uuid(entry, 'receiver receipt id'),
    'receiver receipt id'
  );
  const receiverReceiptRevision = nullable(
    source.receiverReceiptRevision,
    (entry) => integer(entry, 1, 'receiver receipt revision'),
    'receiver receipt revision'
  );
  const receiverReceiptDigest = nullable(
    source.receiverReceiptDigest,
    (entry) => patterned(entry, DIGEST, 64, 'receiver receipt digest'),
    'receiver receipt digest'
  );
  const reasonCode = nullable(
    source.reasonCode,
    (entry) => patterned(entry, REASON, 80, 'handoff reason'),
    'handoff reason'
  );
  const outcomeAt = nullable(
    source.outcomeAt,
    (entry) => instant(entry, 'handoff outcome time'),
    'handoff outcome time'
  );
  const noOutcome =
    receiverReceiptId === null &&
    receiverReceiptRevision === null &&
    receiverReceiptDigest === null &&
    reasonCode === null &&
    outcomeAt === null;
  const acknowledged =
    receiverReceiptId !== null &&
    receiverReceiptRevision !== null &&
    receiverReceiptDigest !== null &&
    reasonCode === null &&
    outcomeAt !== null;
  const negative =
    receiverReceiptId !== null &&
    receiverReceiptRevision !== null &&
    receiverReceiptDigest !== null &&
    reasonCode !== null &&
    outcomeAt !== null;
  if (
    (status === 'PENDING' && !noOutcome) ||
    (status === 'ACKNOWLEDGED' && !acknowledged) ||
    ((status === 'REJECTED' || status === 'RESULT_UNKNOWN') && !negative)
  ) {
    throw new Error('Invalid payroll handoff outcome invariant.');
  }
  const version = integer(source.version, 1, 'handoff version');
  const workerCount = integer(source.workerCount, 0, 'worker count');
  const lineCount = integer(source.lineCount, 0, 'line count');
  if (workerCount > 1_000_000 || lineCount > 1_000_000) {
    throw new Error('Invalid payroll handoff count.');
  }
  if (etag !== `"${version}"`) throw new Error('Payroll handoff ETag does not match its version.');
  return {
    handoffId: uuid(source.handoffId, 'handoff id'),
    closePeriodId: uuid(source.closePeriodId, 'close period id'),
    closedTimeResultId: uuid(source.closedTimeResultId, 'closed time result id'),
    closeRevision: integer(source.closeRevision, 1, 'close revision'),
    payrollEntityId: uuid(source.payrollEntityId, 'payroll entity id'),
    payPeriodId: uuid(source.payPeriodId, 'pay period id'),
    workerCount,
    lineCount,
    sourceDigest: patterned(source.sourceDigest, DIGEST, 64, 'source digest'),
    ruleDigest: patterned(source.ruleDigest, DIGEST, 64, 'rule digest'),
    payloadDigest: patterned(source.payloadDigest, DIGEST, 64, 'payload digest'),
    status,
    receiverReceiptId,
    receiverReceiptRevision,
    receiverReceiptDigest,
    reasonCode,
    outcomeAt,
    createdAt: instant(source.createdAt, 'handoff created time'),
    updatedAt: instant(source.updatedAt, 'handoff updated time'),
    version,
    etag,
  };
}

export function timeCloseCommandAllowed(
  period: TimeClosePeriod,
  kind: TimeCloseCommandKind
): boolean {
  const actionKey = {
    VALIDATE: 'hris.action.tim.close.validate',
    CLOSE: 'hris.action.tim.close.close',
    REOPEN: 'hris.action.tim.close.reopen',
    HANDOFF: 'hris.action.tim.handoff.create',
  }[kind] as TimeCloseActionKey;
  if (!isTimeCloseUuid(period.periodId) || period.version === null) return false;
  if (kind === 'CLOSE' && period.blockerCount !== null && period.blockerCount > 0) return false;
  if (kind === 'HANDOFF' && period.closeStatus !== 'CLOSED' && period.statusCode !== 'CLOSED') {
    return false;
  }
  return period.actions.some((action) => action.actionKey === actionKey);
}
