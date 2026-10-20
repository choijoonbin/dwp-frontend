import {
  PRODUCT_AUTHORIZATION_PAGE_PROJECTIONS,
  PRODUCT_AUTHORIZATION_REGISTRY_REVISION,
} from '../../../../../routes/product-surface-authorization.generated';

export const HRIS_OPERATIONS_FEATURE = 'HRIS_OPERATIONS_EXCEPTION_CENTER' as const;
export const HRIS_OPERATIONS_ROUTE = '/hr/settings/operations' as const;
export const HRIS_OPERATIONS_ENTRY_PATH =
  '/api/platform/v1/hris/workbench/settings-operations' as const;
export const HRIS_OPERATION_EXCEPTIONS_PATH =
  '/api/platform/v1/admin/hris/operations/exceptions' as const;
export const HRIS_OPERATIONS_RECEIPT_PATH =
  '/api/platform/v1/admin/hris/command-receipts/{receiptId}' as const;

export const HRIS_OPERATIONS_API_CONTRACTS = Object.freeze({
  entry: Object.freeze({
    id: 'IAQ-059',
    method: 'GET',
    path: HRIS_OPERATIONS_ENTRY_PATH,
    routeContractKey: 'route.hcm.configuration.settings-operations.page',
    purpose: 'HRIS_CONFIGURATION',
    targetBindingKinds: Object.freeze(['CONFIG_SCOPE'] as const),
  }),
  list: Object.freeze({
    id: 'PEP-SYS-037',
    method: 'GET',
    path: HRIS_OPERATION_EXCEPTIONS_PATH,
    routeContractKey: 'route.hcm.operations.exception.data',
    purpose: 'HRIS_OPERATIONS',
    targetBindingKinds: Object.freeze(['TARGET_POPULATION'] as const),
  }),
  detail: Object.freeze({
    id: 'PEP-SYS-038',
    method: 'GET',
    path: `${HRIS_OPERATION_EXCEPTIONS_PATH}/{exceptionId}`,
    routeContractKey: 'route.hcm.operations.exception-detail.data',
    purpose: 'HRIS_OPERATIONS',
    targetBindingKinds: Object.freeze(['TARGET_POPULATION', 'OBJECT'] as const),
  }),
  receipt: Object.freeze({
    id: 'PEP-SYS-040',
    method: 'GET',
    path: HRIS_OPERATIONS_RECEIPT_PATH,
    reused: true,
  }),
});

export type HrisOperationsTrustedAdmission = Readonly<{
  kind: 'TRUSTED_PRODUCT_SURFACE_PAGE_AND_DATA';
  feature: typeof HRIS_OPERATIONS_FEATURE;
  pageRouteContractKey: typeof HRIS_OPERATIONS_API_CONTRACTS.entry.routeContractKey;
  pageContextScopeKind: 'CONFIG_SCOPE';
  pageDecisionRevision: string;
  targetPopulationScopeKey: string;
  dataRouteContractKeys: readonly [
    typeof HRIS_OPERATIONS_API_CONTRACTS.list.routeContractKey,
    typeof HRIS_OPERATIONS_API_CONTRACTS.detail.routeContractKey,
  ];
}>;

export const HRIS_OPERATION_MODULES = ['HRM', 'PER', 'PAY', 'SYS', 'TIM'] as const;
export type HrisOperationModule = (typeof HRIS_OPERATION_MODULES)[number];

export const HRIS_OPERATION_SEVERITIES = ['INFO', 'WARNING', 'HIGH', 'CRITICAL'] as const;
export type HrisOperationSeverity = (typeof HRIS_OPERATION_SEVERITIES)[number];

export const HRIS_OPERATION_PUBLIC_STATES = ['OPEN', 'ACKNOWLEDGED', 'RESOLVED'] as const;
export type HrisOperationPublicState = (typeof HRIS_OPERATION_PUBLIC_STATES)[number];

export const HRIS_OPERATION_PROJECTION_STATES = [
  'COMPLETE',
  'PARTIAL',
  'STALE',
  'UNAVAILABLE',
] as const;
export type HrisOperationProjectionState = (typeof HRIS_OPERATION_PROJECTION_STATES)[number];

export const HRIS_OPERATION_SOURCE_STATES = ['AVAILABLE', 'STALE', 'UNAVAILABLE'] as const;
export type HrisOperationSourceState = (typeof HRIS_OPERATION_SOURCE_STATES)[number];

export const HRIS_OPERATION_FIELD_DECISIONS = ['VIEW', 'MASK', 'OMIT'] as const;
export type HrisOperationFieldDecision = (typeof HRIS_OPERATION_FIELD_DECISIONS)[number];

export type HrisOperationsEntry = Readonly<{
  asOf: string;
  projectionState: HrisOperationProjectionState;
  lastSuccessfulRefreshAt: string | null;
  sources: readonly Readonly<{
    ownerModule: HrisOperationModule;
    state: HrisOperationSourceState;
    reasonCode?: string;
  }>[];
  counts: Readonly<{
    total: number;
    open: number;
    acknowledged: number;
    resolved: number;
    highImpact: number;
  }>;
}>;

export type HrisOperationalExceptionListItem = Readonly<{
  exceptionPublicId: string;
  ownerModule: HrisOperationModule;
  severity: HrisOperationSeverity;
  state: HrisOperationPublicState;
  code: string;
  summaryKey: string;
  ownerRouteKey: HrisOperationOwnerRouteKey;
  ownerDeepLink: string | null;
  sourceRevision: number;
  firstObservedAt: string;
  lastObservedAt: string;
  occurrenceCount: number;
}>;

export type HrisOperationalExceptionPage = Readonly<{
  asOf: string;
  items: readonly HrisOperationalExceptionListItem[];
  nextCursor: string | null;
}>;

export type HrisOperationFieldDecisions = Readonly<{
  OPERATION_EXCEPTION: HrisOperationFieldDecision;
  OWNER_DEEP_LINK: HrisOperationFieldDecision;
  RECOVERY_METADATA: HrisOperationFieldDecision;
  REDACTED_PAYLOAD: 'OMIT';
}>;

export type HrisOperationalExceptionDetail = HrisOperationalExceptionListItem &
  Readonly<{
    type: string;
    correlationId: string | null;
    evidenceRefs: readonly string[];
    fieldDecisions: HrisOperationFieldDecisions;
  }>;

export type HrisOperationsQueryState = Readonly<{
  tab: 'overview';
  focus: string | null;
  ownerModule: HrisOperationModule | 'ALL';
  severity: HrisOperationSeverity | 'ALL';
  state: HrisOperationPublicState | 'ALL';
}>;

export const EMPTY_HRIS_OPERATIONS_QUERY_STATE: HrisOperationsQueryState = Object.freeze({
  tab: 'overview',
  focus: null,
  ownerModule: 'ALL',
  severity: 'ALL',
  state: 'ALL',
});

export const HRIS_OPERATION_OWNER_ROUTE_KEYS = [
  'route.hcm.operations.employee-change-requests.page',
  'route.hcm.operations.employment-assignments.page',
  'route.hcm.operations.organization-positions.page',
  'route.hcm.operations.compensation-planning.page',
  'route.hcm.operations.performance-goal-cycles.page',
  'route.hcm.operations.performance-multirater-surveys.page',
  'route.hcm.operations.performance-review-operations.page',
  'route.hcm.configuration.payroll.page',
  'route.hcm.operations.pay.page',
  'route.hcm.operations.payroll-population.page',
  'route.hcm.configuration.navigation-policy-workspace.page',
  'route.hcm.configuration.settings-operations.page',
  'route.hcm.configuration.settings-reference.page',
  'route.hcm.management.controlled-export.page',
  'route.hcm.operations.time-command-center.page',
  'route.hcm.operations.time-daily-close.page',
  'route.hcm.operations.time-exceptions.page',
  'route.hcm.operations.time-interpretation.page',
  'route.hcm.operations.time-monthly-close.page',
] as const;
export type HrisOperationOwnerRouteKey = (typeof HRIS_OPERATION_OWNER_ROUTE_KEYS)[number];

const HRIS_OPERATION_OWNER_ROUTE_MODULES = Object.freeze({
  'route.hcm.operations.employee-change-requests.page': 'HRM',
  'route.hcm.operations.employment-assignments.page': 'HRM',
  'route.hcm.operations.organization-positions.page': 'HRM',
  'route.hcm.operations.compensation-planning.page': 'PER',
  'route.hcm.operations.performance-goal-cycles.page': 'PER',
  'route.hcm.operations.performance-multirater-surveys.page': 'PER',
  'route.hcm.operations.performance-review-operations.page': 'PER',
  'route.hcm.configuration.payroll.page': 'PAY',
  'route.hcm.operations.pay.page': 'PAY',
  'route.hcm.operations.payroll-population.page': 'PAY',
  'route.hcm.configuration.navigation-policy-workspace.page': 'SYS',
  'route.hcm.configuration.settings-operations.page': 'SYS',
  'route.hcm.configuration.settings-reference.page': 'SYS',
  'route.hcm.management.controlled-export.page': 'SYS',
  'route.hcm.operations.time-command-center.page': 'TIM',
  'route.hcm.operations.time-daily-close.page': 'TIM',
  'route.hcm.operations.time-exceptions.page': 'TIM',
  'route.hcm.operations.time-interpretation.page': 'TIM',
  'route.hcm.operations.time-monthly-close.page': 'TIM',
} satisfies Readonly<Record<HrisOperationOwnerRouteKey, HrisOperationModule>>);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const CODE = /^[A-Z][A-Z0-9._-]{0,79}$/u;
const SUMMARY_KEY =
  /^hris\.operations\.exception\.(hrm|per|pay|sys|tim)\.[a-z][a-z0-9._-]{0,119}$/u;
const REASON_CODE = /^[A-Z][A-Z0-9._-]{0,127}$/u;
const CURSOR = /^[A-Za-z0-9_-]{16,4096}$/u;
const EVIDENCE_REF =
  /^urn:dwp:hris:evidence:(audit|command-receipt|domain-event|owner-projection):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/u;

function invalid(message = 'Invalid HRIS operations response.'): never {
  throw new Error(message);
}

function record(
  value: unknown,
  required: readonly string[],
  optional: readonly string[] = []
): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return invalid();
  const source = value as Record<string, unknown>;
  if (required.some((key) => !Object.prototype.hasOwnProperty.call(source, key))) return invalid();
  const allowed = new Set([...required, ...optional]);
  if (Object.keys(source).some((key) => !allowed.has(key))) return invalid();
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

function valueFrom<const T extends string>(value: unknown, values: readonly T[]): T {
  return typeof value === 'string' && values.includes(value as T) ? (value as T) : invalid();
}

function nonNegativeInteger(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : invalid();
}

function positiveInteger(value: unknown): number {
  const result = nonNegativeInteger(value);
  return result > 0 ? result : invalid();
}

function instant(value: unknown): string {
  const result = text(value, 100);
  return result.includes('T') &&
    Number.isFinite(Date.parse(result)) &&
    /(?:Z|[+-]\d\d:\d\d)$/u.test(result)
    ? result
    : invalid();
}

function nullableInstant(value: unknown): string | null {
  return value === null ? null : instant(value);
}

function nullableText(value: unknown, maximum: number, pattern?: RegExp): string | null {
  return value === null ? null : text(value, maximum, pattern);
}

function array(value: unknown, maximum: number): unknown[] {
  if (!Array.isArray(value) || value.length > maximum) return invalid();
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(value, index)) return invalid();
  }
  return value;
}

const ownerRouteKeySet = new Set<string>(HRIS_OPERATION_OWNER_ROUTE_KEYS);
const ownerRoutePatterns = (() => {
  if (PRODUCT_AUTHORIZATION_REGISTRY_REVISION.version !== 52) {
    return invalid('HRIS operations requires the exact product authorization v52 registry.');
  }
  const patterns = new Map<HrisOperationOwnerRouteKey, string>();
  for (const projection of PRODUCT_AUTHORIZATION_PAGE_PROJECTIONS) {
    if (!ownerRouteKeySet.has(projection.routeContractKey)) continue;
    if (
      projection.routeKind !== 'PAGE' ||
      projection.productId !== 'hcm' ||
      !projection.pattern ||
      !projection.pattern.startsWith('/hr/') ||
      projection.pattern.includes('?') ||
      projection.pattern.includes('#') ||
      patterns.has(projection.routeContractKey as HrisOperationOwnerRouteKey)
    ) {
      return invalid('HRIS operations owner PAGE registry is not exact.');
    }
    patterns.set(projection.routeContractKey as HrisOperationOwnerRouteKey, projection.pattern);
  }
  if (patterns.size !== HRIS_OPERATION_OWNER_ROUTE_KEYS.length) {
    return invalid('HRIS operations owner PAGE registry is incomplete.');
  }
  return patterns;
})();

export function hrisOperationOwnerDeepLink(
  routeKey: HrisOperationOwnerRouteKey,
  exceptionPublicId: string
): string {
  const id = text(exceptionPublicId, 36, UUID);
  const pattern = ownerRoutePatterns.get(routeKey) ?? invalid();
  return `${pattern}?focus=${id}`;
}

function ownerRouteKey(value: unknown): HrisOperationOwnerRouteKey {
  const candidate = text(value, 160);
  return ownerRouteKeySet.has(candidate) ? (candidate as HrisOperationOwnerRouteKey) : invalid();
}

function ownerDeepLink(
  value: unknown,
  routeKey: HrisOperationOwnerRouteKey,
  exceptionPublicId: string
): string | null {
  const candidate = nullableText(value, 360);
  if (candidate === null) return null;
  return candidate === hrisOperationOwnerDeepLink(routeKey, exceptionPublicId)
    ? candidate
    : invalid('Unsafe HRIS operations owner deep link.');
}

function parseSource(value: unknown): HrisOperationsEntry['sources'][number] {
  const source = record(value, ['ownerModule', 'state'], ['reasonCode']);
  const state = valueFrom(source.state, HRIS_OPERATION_SOURCE_STATES);
  const reasonCode =
    source.reasonCode === undefined ? undefined : text(source.reasonCode, 128, REASON_CODE);
  const expectedReason =
    state === 'STALE'
      ? 'OWNER_PROJECTION_STALE'
      : state === 'UNAVAILABLE'
        ? 'OWNER_PROJECTION_UNAVAILABLE'
        : undefined;
  if (reasonCode !== expectedReason) {
    return invalid('Inconsistent HRIS operations source status.');
  }
  return Object.freeze({
    ownerModule: valueFrom(source.ownerModule, HRIS_OPERATION_MODULES),
    state,
    ...(reasonCode === undefined ? {} : { reasonCode }),
  });
}

export function parseHrisOperationsEntry(value: unknown): HrisOperationsEntry {
  const source = record(value, [
    'asOf',
    'projectionState',
    'lastSuccessfulRefreshAt',
    'sources',
    'counts',
  ]);
  const sources = array(source.sources, HRIS_OPERATION_MODULES.length).map(parseSource);
  if (
    sources.length !== HRIS_OPERATION_MODULES.length ||
    sources.some((item, index) => item.ownerModule !== HRIS_OPERATION_MODULES[index])
  ) {
    return invalid('Incomplete or unordered HRIS operations source status.');
  }
  const counts = record(source.counts, ['total', 'open', 'acknowledged', 'resolved', 'highImpact']);
  const parsedCounts = Object.freeze({
    total: nonNegativeInteger(counts.total),
    open: nonNegativeInteger(counts.open),
    acknowledged: nonNegativeInteger(counts.acknowledged),
    resolved: nonNegativeInteger(counts.resolved),
    highImpact: nonNegativeInteger(counts.highImpact),
  });
  if (
    parsedCounts.open + parsedCounts.acknowledged + parsedCounts.resolved !==
    parsedCounts.total
  ) {
    return invalid('Inconsistent HRIS operations counts.');
  }
  if (parsedCounts.highImpact > parsedCounts.total) return invalid();
  const hasObservedSource = sources.some((item) => item.state !== 'UNAVAILABLE');
  if (parsedCounts.total > 0 !== hasObservedSource) {
    return invalid('Inconsistent HRIS operations source availability.');
  }
  const projectionState = valueFrom(source.projectionState, HRIS_OPERATION_PROJECTION_STATES);
  const expectedProjectionState: HrisOperationProjectionState =
    parsedCounts.total === 0
      ? 'UNAVAILABLE'
      : sources.some((item) => item.state === 'STALE')
        ? 'STALE'
        : sources.every((item) => item.state === 'AVAILABLE')
          ? 'COMPLETE'
          : 'PARTIAL';
  if (projectionState !== expectedProjectionState) {
    return invalid('Inconsistent HRIS operations projection state.');
  }
  const lastSuccessfulRefreshAt = nullableInstant(source.lastSuccessfulRefreshAt);
  if ((parsedCounts.total === 0) !== (lastSuccessfulRefreshAt === null)) {
    return invalid('Inconsistent HRIS operations refresh state.');
  }
  return Object.freeze({
    asOf: instant(source.asOf),
    projectionState,
    lastSuccessfulRefreshAt,
    sources: Object.freeze(sources),
    counts: parsedCounts,
  });
}

const ITEM_KEYS = [
  'exceptionPublicId',
  'ownerModule',
  'severity',
  'state',
  'code',
  'summaryKey',
  'ownerRouteKey',
  'ownerDeepLink',
  'sourceRevision',
  'firstObservedAt',
  'lastObservedAt',
  'occurrenceCount',
] as const;
const DETAIL_KEYS = ['type', 'correlationId', 'evidenceRefs', 'fieldDecisions'] as const;

function parseListItem(value: unknown, detail = false): HrisOperationalExceptionListItem {
  const source = record(value, ITEM_KEYS, detail ? DETAIL_KEYS : []);
  const exceptionPublicId = text(source.exceptionPublicId, 36, UUID);
  const ownerModule = valueFrom(source.ownerModule, HRIS_OPERATION_MODULES);
  const summaryKey = text(source.summaryKey, 160, SUMMARY_KEY);
  if (summaryKey.split('.')[3] !== ownerModule.toLowerCase()) return invalid();
  const routeKey = ownerRouteKey(source.ownerRouteKey);
  if (HRIS_OPERATION_OWNER_ROUTE_MODULES[routeKey] !== ownerModule) {
    return invalid('HRIS operation owner route does not match its owner module.');
  }
  const firstObservedAt = instant(source.firstObservedAt);
  const lastObservedAt = instant(source.lastObservedAt);
  return Object.freeze({
    exceptionPublicId,
    ownerModule,
    severity: valueFrom(source.severity, HRIS_OPERATION_SEVERITIES),
    state: valueFrom(source.state, HRIS_OPERATION_PUBLIC_STATES),
    code: text(source.code, 80, CODE),
    summaryKey,
    ownerRouteKey: routeKey,
    ownerDeepLink: ownerDeepLink(source.ownerDeepLink, routeKey, exceptionPublicId),
    sourceRevision: positiveInteger(source.sourceRevision),
    firstObservedAt,
    lastObservedAt,
    occurrenceCount: positiveInteger(source.occurrenceCount),
  });
}

export function parseHrisOperationalExceptionPage(value: unknown): HrisOperationalExceptionPage {
  const source = record(value, ['asOf', 'items', 'nextCursor']);
  const items = array(source.items, 100).map((item) => parseListItem(item));
  if (items.length !== new Set(items.map((item) => item.exceptionPublicId)).size) return invalid();
  for (let index = 1; index < items.length; index += 1) {
    const previous = items[index - 1]!;
    const current = items[index]!;
    const previousObservedAt = Date.parse(previous.lastObservedAt);
    const currentObservedAt = Date.parse(current.lastObservedAt);
    if (
      previousObservedAt < currentObservedAt ||
      (previousObservedAt === currentObservedAt &&
        previous.exceptionPublicId.localeCompare(current.exceptionPublicId) < 0)
    ) {
      return invalid('Unstable HRIS operational exception ordering.');
    }
  }
  return Object.freeze({
    asOf: instant(source.asOf),
    items: Object.freeze(items),
    nextCursor: nullableText(source.nextCursor, 4096, CURSOR),
  });
}

function parseFieldDecisions(value: unknown): HrisOperationFieldDecisions {
  const source = record(value, [
    'OPERATION_EXCEPTION',
    'OWNER_DEEP_LINK',
    'RECOVERY_METADATA',
    'REDACTED_PAYLOAD',
  ]);
  const redactedPayload = valueFrom(source.REDACTED_PAYLOAD, HRIS_OPERATION_FIELD_DECISIONS);
  if (redactedPayload !== 'OMIT') return invalid('Raw HRIS exception payload must be omitted.');
  return Object.freeze({
    OPERATION_EXCEPTION: valueFrom(source.OPERATION_EXCEPTION, HRIS_OPERATION_FIELD_DECISIONS),
    OWNER_DEEP_LINK: valueFrom(source.OWNER_DEEP_LINK, HRIS_OPERATION_FIELD_DECISIONS),
    RECOVERY_METADATA: valueFrom(source.RECOVERY_METADATA, HRIS_OPERATION_FIELD_DECISIONS),
    REDACTED_PAYLOAD: redactedPayload,
  });
}

export function parseHrisOperationalExceptionDetail(
  value: unknown
): HrisOperationalExceptionDetail {
  const source = record(value, [...ITEM_KEYS, ...DETAIL_KEYS]);
  const item = parseListItem(source, true);
  const fieldDecisions = parseFieldDecisions(source.fieldDecisions);
  if (fieldDecisions.OPERATION_EXCEPTION !== 'VIEW') {
    return invalid('HRIS operation exception detail is not viewable.');
  }
  if ((fieldDecisions.OWNER_DEEP_LINK === 'VIEW') !== (item.ownerDeepLink !== null)) {
    return invalid('HRIS operation exception owner link decision is inconsistent.');
  }
  const correlationId = nullableText(source.correlationId, 36, UUID);
  const evidenceRefs = array(source.evidenceRefs, 20).map((entry) =>
    text(entry, 160, EVIDENCE_REF)
  );
  if (
    evidenceRefs.length !== new Set(evidenceRefs).size ||
    evidenceRefs.some((entry, index) => index > 0 && evidenceRefs[index - 1]! >= entry)
  ) {
    return invalid('HRIS operation evidence references are not canonical.');
  }
  const recoveryVisible = fieldDecisions.RECOVERY_METADATA === 'VIEW';
  if (recoveryVisible && (correlationId === null || evidenceRefs.length === 0)) {
    return invalid('Visible HRIS operation recovery metadata is incomplete.');
  }
  if (!recoveryVisible && (correlationId !== null || evidenceRefs.length > 0)) {
    return invalid('Masked HRIS operation recovery metadata was returned.');
  }
  return Object.freeze({
    ...item,
    type: text(source.type, 80, CODE),
    correlationId,
    evidenceRefs: Object.freeze(evidenceRefs),
    fieldDecisions,
  });
}

export function hrisOperationReceiptId(evidenceRef: string): string | null {
  const match = EVIDENCE_REF.exec(evidenceRef);
  return match?.[1] === 'command-receipt' ? (match[2] ?? null) : null;
}

export function hrisOperationSummary(item: Pick<HrisOperationalExceptionListItem, 'code'>): string {
  return item.code
    .toLowerCase()
    .split(/[._-]+/u)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join(' ');
}

export function parseHrisOperationsQueryState(search: URLSearchParams): HrisOperationsQueryState {
  const rawFocus = search.get('focus');
  const rawModule = search.get('owner');
  const rawSeverity = search.get('severity');
  const rawState = search.get('state');
  return Object.freeze({
    tab: 'overview',
    focus: rawFocus && UUID.test(rawFocus) ? rawFocus : null,
    ownerModule:
      rawModule && HRIS_OPERATION_MODULES.includes(rawModule as HrisOperationModule)
        ? (rawModule as HrisOperationModule)
        : 'ALL',
    severity:
      rawSeverity && HRIS_OPERATION_SEVERITIES.includes(rawSeverity as HrisOperationSeverity)
        ? (rawSeverity as HrisOperationSeverity)
        : 'ALL',
    state:
      rawState && HRIS_OPERATION_PUBLIC_STATES.includes(rawState as HrisOperationPublicState)
        ? (rawState as HrisOperationPublicState)
        : 'ALL',
  });
}

export function mergeHrisOperationsQueryState(
  current: URLSearchParams,
  patch: Partial<HrisOperationsQueryState>
): URLSearchParams {
  const currentState = parseHrisOperationsQueryState(current);
  const focus = patch.focus === undefined ? currentState.focus : patch.focus;
  const ownerModule =
    patch.ownerModule === undefined ? currentState.ownerModule : patch.ownerModule;
  const severity = patch.severity === undefined ? currentState.severity : patch.severity;
  const state = patch.state === undefined ? currentState.state : patch.state;
  const next = new URLSearchParams();
  next.set('tab', 'overview');
  const values = [
    ['focus', focus],
    ['owner', ownerModule],
    ['severity', severity],
    ['state', state],
  ] as const;
  for (const [key, value] of values) {
    if (value === null || value === 'ALL') next.delete(key);
    else next.set(key, value);
  }
  return next;
}
