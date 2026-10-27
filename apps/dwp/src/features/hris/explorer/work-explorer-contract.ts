export {
  HRIS_WORK_EXPLORER_PATH,
  HRIS_WORK_EXPLORER_ROUTE_CONTRACT,
  HRIS_WORK_EXPLORER_SURFACE,
} from '../../../components/work-explorer-navigation';
export const HRIS_WORK_EXPLORER_BASE_PATH = '/api/platform/v1/hris/explorer' as const;
export const HRIS_WORK_EXPLORER_RECEIPT_PATH =
  '/api/platform/v1/admin/hris/command-receipts' as const;

export const EXPLORER_MODULES = ['HRM', 'PER', 'TIM', 'PAY', 'SYS'] as const;
export type ExplorerModule = (typeof EXPLORER_MODULES)[number];

export const EXPLORER_WORKBENCHES = [
  'MY_HR',
  'TEAM',
  'HR_OPERATIONS',
  'TIME',
  'PAYROLL',
  'PERFORMANCE',
  'SETTINGS',
] as const;
export type ExplorerWorkbench = (typeof EXPLORER_WORKBENCHES)[number];

export const EXPLORER_SOURCE_KINDS = [
  'COMMAND_RECEIPT',
  'WORKFLOW_CASE',
  'APPROVAL_CASE',
  'SERVICE_REQUEST',
  'OPERATION_EXCEPTION',
] as const;
export type ExplorerSourceKind = (typeof EXPLORER_SOURCE_KINDS)[number];

export const EXPLORER_ACTIVITY_STATES = [
  'PENDING',
  'IN_PROGRESS',
  'WAITING_FOR_ME',
  'RESULT_UNKNOWN',
  'FAILED',
] as const;
export type ExplorerActivityState = (typeof EXPLORER_ACTIVITY_STATES)[number];

export type ExplorerTarget =
  | Readonly<{ kind: 'HRIS_INTERNAL'; path: string }>
  | Readonly<{
      kind: 'DWP_CONTROL';
      path: '/admin/governance/audit-overview?product=HCM';
    }>;

export type ExplorerAuthorization = Readonly<{
  routeContractKey: string;
  capabilityMode: 'SINGLE' | 'ANY' | 'ALL';
  capabilityKeys: readonly string[];
}>;

export type ExplorerRoute = Readonly<{
  routeKey: string;
  target: ExplorerTarget;
  labelKey: string;
  module: ExplorerModule;
  workbench: ExplorerWorkbench;
  authorization: ExplorerAuthorization;
}>;

export type ExplorerFavorite = ExplorerRoute & Readonly<{ position: number }>;
export type ExplorerRecent = ExplorerRoute & Readonly<{ lastVisitedAt: string; expiresAt: string }>;

export type ExplorerActivity = Readonly<{
  activityId: string;
  sourceKind: ExplorerSourceKind;
  module: ExplorerModule;
  state: ExplorerActivityState;
  sourceRevision: number;
  updatedAt: string;
  target: ExplorerTarget;
}>;

export type ExplorerDegradedSource = Readonly<{
  module: ExplorerModule;
  sourceKind: 'CATALOG' | ExplorerSourceKind;
  reason: 'TIMEOUT' | 'UNAVAILABLE' | 'STALE';
  retryable: boolean;
}>;

export type HrisExplorerResponse = Readonly<{
  asOf: string;
  projectionRevision: number;
  entitlementRevision: number;
  favoritePreferenceRevision: number;
  routes: readonly ExplorerRoute[];
  favorites: readonly ExplorerFavorite[];
  recents: readonly ExplorerRecent[];
  inProgress: readonly ExplorerActivity[];
  nextCursor: string | null;
  projectionStatus: Readonly<{
    state: 'FRESH' | 'STALE' | 'PARTIAL';
    degradedSources: readonly ExplorerDegradedSource[];
  }>;
  policy: Readonly<{
    maxFavorites: 20;
    maxRecents: 20;
    recentTtlDays: 30;
    maxInProgress: 20;
    entitlementRefilter: true;
    cleanupMode: 'READ_AND_WRITE_THROUGH_PURGE';
  }>;
}>;

export type ExplorerReceipt = Readonly<{
  receiptId: string;
  commandType: 'EXPLORER_PREFERENCES_REPLACE' | 'EXPLORER_RECENT_RECORD';
  originatingAction: 'EXPLORER_PREFERENCES_REPLACE' | 'EXPLORER_RECENT_RECORD';
  subjectPrincipalPublicId: string;
  populationScopeDigest: string;
  fieldPolicyRevision: number;
  purposeCode: 'HRIS_APP_DISCOVERY';
  authorizationRevision: number;
  status: 'ACCEPTED' | 'RUNNING' | 'SUCCEEDED' | 'REJECTED' | 'FAILED' | 'RESULT_UNKNOWN';
  correlationId: string;
  requestDigest: string;
  createdAt: string;
  aggregateVersion?: number;
  resultRef?: string;
}>;

export type PlatformCommandReceipt = Readonly<{
  receiptId: string;
  commandType: string;
  originatingAction: string;
  subjectPrincipalPublicId: string;
  populationScopeDigest: string;
  fieldPolicyRevision: number;
  purposeCode: string;
  authorizationRevision: number;
  status: ExplorerReceipt['status'];
  correlationId: string;
  requestDigest: string;
  createdAt: string;
  aggregateVersion?: number;
  resultRef?: string;
}>;

export type HrisReceiptProjection =
  | Readonly<{ profile: 'EXPLORER'; receipt: ExplorerReceipt }>
  | Readonly<{ profile: 'PLATFORM'; receipt: PlatformCommandReceipt }>;

const EXPLORER_RECEIPT_IMMUTABLE_CONTEXT_KEYS = [
  'receiptId',
  'commandType',
  'originatingAction',
  'subjectPrincipalPublicId',
  'populationScopeDigest',
  'fieldPolicyRevision',
  'purposeCode',
  'authorizationRevision',
  'correlationId',
  'requestDigest',
  'createdAt',
] as const satisfies readonly (keyof ExplorerReceipt)[];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DIGEST = /^[0-9a-f]{64}$/;
const ROUTE_KEY = /^hris\.explorer\.[a-z0-9.-]{3,80}$/;
const ROUTE_CONTRACT = /^route\.[a-z0-9.-]{3,154}$/;
const CAPABILITY = /^[a-z][a-z0-9.-]{2,159}$/;
const INTERNAL_TARGET = /^\/hr(?:\/|$)/;
const OPERATIONAL_CONTROL_TARGET = '/admin/governance/audit-overview?product=HCM' as const;

function invalid(message = 'Invalid HRIS Work Explorer response.'): never {
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
    !value.length ||
    value.length > maximum ||
    value !== value.trim() ||
    (pattern && !pattern.test(value))
  ) {
    return invalid();
  }
  return value;
}

function valueFrom<T extends string>(value: unknown, allowed: readonly T[]): T {
  return typeof value === 'string' && allowed.includes(value as T) ? (value as T) : invalid();
}

function integer(value: unknown, minimum: number, maximum = Number.MAX_SAFE_INTEGER): number {
  return typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= minimum &&
    value <= maximum
    ? value
    : invalid();
}

function instant(value: unknown): string {
  const candidate = text(value, 100);
  return Number.isFinite(Date.parse(candidate)) && /[zZ]|[+-]\d\d:\d\d$/.test(candidate)
    ? candidate
    : invalid();
}

function array(value: unknown, maximum: number): unknown[] {
  return Array.isArray(value) && value.length <= maximum ? value : invalid();
}

function unique(values: readonly string[]): boolean {
  return values.length === new Set(values).size;
}

export function parseExplorerTarget(value: unknown): ExplorerTarget {
  const source = record(value, ['kind', 'path']);
  const kind = valueFrom(source.kind, ['HRIS_INTERNAL', 'DWP_CONTROL'] as const);
  const path = text(source.path, 300);
  if (kind === 'HRIS_INTERNAL') {
    if (!INTERNAL_TARGET.test(path)) return invalid('Unsafe HRIS Work Explorer target.');
    return Object.freeze({ kind, path });
  }
  // The transport reserves six literals, but only this exact PAGE contract is operational today.
  // Rejecting the other five prevents a future or malformed projection from becoming navigation.
  if (path !== OPERATIONAL_CONTROL_TARGET) return invalid('Unavailable DWP control target.');
  return Object.freeze({ kind, path });
}

function parseAuthorization(value: unknown): ExplorerAuthorization {
  const source = record(value, ['routeContractKey', 'capabilityMode', 'capabilityKeys']);
  const capabilityMode = valueFrom(source.capabilityMode, ['SINGLE', 'ANY', 'ALL'] as const);
  const capabilityKeys = array(source.capabilityKeys, 16).map((item) =>
    text(item, 160, CAPABILITY)
  );
  if (
    !unique(capabilityKeys) ||
    (capabilityMode === 'SINGLE' ? capabilityKeys.length !== 1 : capabilityKeys.length < 2)
  ) {
    return invalid();
  }
  return Object.freeze({
    routeContractKey: text(source.routeContractKey, 160, ROUTE_CONTRACT),
    capabilityMode,
    capabilityKeys: Object.freeze(capabilityKeys),
  });
}

function parseRouteIdentity(value: unknown, extra: readonly string[] = []): ExplorerRoute {
  const source = record(value, [
    'routeKey',
    'target',
    'labelKey',
    'module',
    'workbench',
    'authorization',
    ...extra,
  ]);
  const routeKey = text(source.routeKey, 96, ROUTE_KEY);
  const suffix = routeKey.slice('hris.explorer.'.length);
  const labelKey = text(source.labelKey, 128, /^hris\.explorer\.routes\.[a-z0-9.-]+$/);
  if (labelKey !== `hris.explorer.routes.${suffix}`) return invalid();
  const target = parseExplorerTarget(source.target);
  const module = valueFrom(source.module, EXPLORER_MODULES);
  const workbench = valueFrom(source.workbench, EXPLORER_WORKBENCHES);
  const authorization = parseAuthorization(source.authorization);
  if (
    target.kind === 'DWP_CONTROL' &&
    (routeKey !== 'hris.explorer.dwp-governance' ||
      module !== 'SYS' ||
      workbench !== 'SETTINGS' ||
      authorization.routeContractKey !== 'route.hcm.audit.evidence.page' ||
      authorization.capabilityMode !== 'SINGLE' ||
      authorization.capabilityKeys[0] !== 'hcm.audit.evidence.view')
  ) {
    return invalid('Mismatched DWP control identity.');
  }
  return Object.freeze({
    routeKey,
    target,
    labelKey,
    module,
    workbench,
    authorization,
  });
}

export function parseExplorerRoute(value: unknown): ExplorerRoute {
  return parseRouteIdentity(value);
}

function parseFavorite(value: unknown): ExplorerFavorite {
  const source = record(value, [
    'routeKey',
    'target',
    'labelKey',
    'module',
    'workbench',
    'authorization',
    'position',
  ]);
  return Object.freeze({
    ...parseRouteIdentity(source, ['position']),
    position: integer(source.position, 1, 20),
  });
}

function parseRecent(value: unknown): ExplorerRecent {
  const source = record(value, [
    'routeKey',
    'target',
    'labelKey',
    'module',
    'workbench',
    'authorization',
    'lastVisitedAt',
    'expiresAt',
  ]);
  const lastVisitedAt = instant(source.lastVisitedAt);
  const expiresAt = instant(source.expiresAt);
  if (Date.parse(expiresAt) <= Date.parse(lastVisitedAt)) return invalid();
  return Object.freeze({
    ...parseRouteIdentity(source, ['lastVisitedAt', 'expiresAt']),
    lastVisitedAt,
    expiresAt,
  });
}

function parseActivity(value: unknown): ExplorerActivity {
  const source = record(value, [
    'activityId',
    'sourceKind',
    'module',
    'state',
    'sourceRevision',
    'updatedAt',
    'target',
  ]);
  return Object.freeze({
    activityId: text(source.activityId, 36, UUID),
    sourceKind: valueFrom(source.sourceKind, EXPLORER_SOURCE_KINDS),
    module: valueFrom(source.module, EXPLORER_MODULES),
    state: valueFrom(source.state, EXPLORER_ACTIVITY_STATES),
    sourceRevision: integer(source.sourceRevision, 1),
    updatedAt: instant(source.updatedAt),
    target: parseExplorerTarget(source.target),
  });
}

function parseDegradedSource(value: unknown): ExplorerDegradedSource {
  const source = record(value, ['module', 'sourceKind', 'reason', 'retryable']);
  if (typeof source.retryable !== 'boolean') return invalid();
  return Object.freeze({
    module: valueFrom(source.module, EXPLORER_MODULES),
    sourceKind: valueFrom(source.sourceKind, ['CATALOG', ...EXPLORER_SOURCE_KINDS] as const),
    reason: valueFrom(source.reason, ['TIMEOUT', 'UNAVAILABLE', 'STALE'] as const),
    retryable: source.retryable,
  });
}

export function parseHrisExplorerResponse(value: unknown): HrisExplorerResponse {
  const source = record(value, [
    'asOf',
    'projectionRevision',
    'entitlementRevision',
    'favoritePreferenceRevision',
    'routes',
    'favorites',
    'recents',
    'inProgress',
    'nextCursor',
    'projectionStatus',
    'policy',
  ]);
  const routes = array(source.routes, 100).map(parseExplorerRoute);
  const favorites = array(source.favorites, 20)
    .map(parseFavorite)
    .sort((left, right) => left.position - right.position);
  const recents = array(source.recents, 20).map(parseRecent);
  const inProgress = array(source.inProgress, 20).map(parseActivity);
  const routeKeys = routes.map((route) => route.routeKey);
  const favoriteKeys = favorites.map((route) => route.routeKey);
  const recentKeys = recents.map((route) => route.routeKey);
  const positions = favorites.map((route) => route.position);
  if (
    !unique(routeKeys) ||
    !unique(favoriteKeys) ||
    !unique(recentKeys) ||
    !unique(positions.map(String)) ||
    positions.some((position, index) => position !== index + 1)
  ) {
    return invalid();
  }

  const status = record(source.projectionStatus, ['state', 'degradedSources']);
  const projectionState = valueFrom(status.state, ['FRESH', 'STALE', 'PARTIAL'] as const);
  const degradedSources = array(status.degradedSources, 20).map(parseDegradedSource);

  const policy = record(source.policy, [
    'maxFavorites',
    'maxRecents',
    'recentTtlDays',
    'maxInProgress',
    'entitlementRefilter',
    'cleanupMode',
  ]);
  if (
    policy.maxFavorites !== 20 ||
    policy.maxRecents !== 20 ||
    policy.recentTtlDays !== 30 ||
    policy.maxInProgress !== 20 ||
    policy.entitlementRefilter !== true ||
    policy.cleanupMode !== 'READ_AND_WRITE_THROUGH_PURGE'
  ) {
    return invalid();
  }
  const nextCursor = source.nextCursor === null ? null : text(source.nextCursor, 2048);
  return Object.freeze({
    asOf: instant(source.asOf),
    projectionRevision: integer(source.projectionRevision, 1),
    entitlementRevision: integer(source.entitlementRevision, 1),
    favoritePreferenceRevision: integer(source.favoritePreferenceRevision, 1),
    routes: Object.freeze(routes),
    favorites: Object.freeze(favorites),
    recents: Object.freeze(recents),
    inProgress: Object.freeze(inProgress),
    nextCursor,
    projectionStatus: Object.freeze({
      state: projectionState,
      degradedSources: Object.freeze(degradedSources),
    }),
    policy: Object.freeze({
      maxFavorites: 20,
      maxRecents: 20,
      recentTtlDays: 30,
      maxInProgress: 20,
      entitlementRefilter: true,
      cleanupMode: 'READ_AND_WRITE_THROUGH_PURGE',
    }),
  });
}

export function parseExplorerReceipt(value: unknown): ExplorerReceipt {
  const source = record(
    value,
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
    ],
    ['aggregateVersion', 'resultRef']
  );
  const commandType = valueFrom(source.commandType, [
    'EXPLORER_PREFERENCES_REPLACE',
    'EXPLORER_RECENT_RECORD',
  ] as const);
  const originatingAction = valueFrom(source.originatingAction, [
    'EXPLORER_PREFERENCES_REPLACE',
    'EXPLORER_RECENT_RECORD',
  ] as const);
  if (commandType !== originatingAction || source.purposeCode !== 'HRIS_APP_DISCOVERY') {
    return invalid();
  }
  const aggregateVersion =
    source.aggregateVersion === undefined ? undefined : integer(source.aggregateVersion, 0);
  const resultRef = source.resultRef === undefined ? undefined : text(source.resultRef, 500);
  return Object.freeze({
    receiptId: text(source.receiptId, 36, UUID),
    commandType,
    originatingAction,
    subjectPrincipalPublicId: text(source.subjectPrincipalPublicId, 36, UUID),
    populationScopeDigest: text(source.populationScopeDigest, 64, DIGEST),
    fieldPolicyRevision: integer(source.fieldPolicyRevision, 1),
    purposeCode: 'HRIS_APP_DISCOVERY',
    authorizationRevision: integer(source.authorizationRevision, 1),
    status: valueFrom(source.status, [
      'ACCEPTED',
      'RUNNING',
      'SUCCEEDED',
      'REJECTED',
      'FAILED',
      'RESULT_UNKNOWN',
    ] as const),
    correlationId: text(source.correlationId, 36, UUID),
    requestDigest: text(source.requestDigest, 64, DIGEST),
    createdAt: instant(source.createdAt),
    ...(aggregateVersion === undefined ? {} : { aggregateVersion }),
    ...(resultRef === undefined ? {} : { resultRef }),
  });
}

export function parsePlatformCommandReceipt(value: unknown): PlatformCommandReceipt {
  const source = record(
    value,
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
    ],
    ['aggregateVersion', 'resultRef']
  );
  const aggregateVersion =
    source.aggregateVersion === undefined ? undefined : integer(source.aggregateVersion, 0);
  const resultRef = source.resultRef === undefined ? undefined : text(source.resultRef, 2048);
  const purposeCode = text(source.purposeCode, 64);
  if (purposeCode.length < 3) return invalid();
  return Object.freeze({
    receiptId: text(source.receiptId, 36, UUID),
    commandType: text(source.commandType, 128),
    originatingAction: text(source.originatingAction, 128),
    subjectPrincipalPublicId: text(source.subjectPrincipalPublicId, 36, UUID),
    populationScopeDigest: text(source.populationScopeDigest, 64, DIGEST),
    fieldPolicyRevision: integer(source.fieldPolicyRevision, 1),
    purposeCode,
    authorizationRevision: integer(source.authorizationRevision, 1),
    status: valueFrom(source.status, [
      'ACCEPTED',
      'RUNNING',
      'SUCCEEDED',
      'REJECTED',
      'FAILED',
      'RESULT_UNKNOWN',
    ] as const),
    correlationId: text(source.correlationId, 36, UUID),
    requestDigest: text(source.requestDigest, 64, DIGEST),
    createdAt: instant(source.createdAt),
    ...(aggregateVersion === undefined ? {} : { aggregateVersion }),
    ...(resultRef === undefined ? {} : { resultRef }),
  });
}

export function parseHrisReceiptProjection(value: unknown): HrisReceiptProjection {
  const source = record(
    value,
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
    ],
    ['aggregateVersion', 'resultRef']
  );
  const explorerCommands = ['EXPLORER_PREFERENCES_REPLACE', 'EXPLORER_RECENT_RECORD'];
  const hasExplorerIdentity =
    (typeof source.commandType === 'string' && explorerCommands.includes(source.commandType)) ||
    (typeof source.originatingAction === 'string' &&
      explorerCommands.includes(source.originatingAction)) ||
    source.purposeCode === 'HRIS_APP_DISCOVERY';
  return hasExplorerIdentity
    ? Object.freeze({ profile: 'EXPLORER', receipt: parseExplorerReceipt(value) })
    : Object.freeze({ profile: 'PLATFORM', receipt: parsePlatformCommandReceipt(value) });
}

export function explorerTargetHref(target: ExplorerTarget): string {
  return target.path;
}

export function explorerReceiptNeedsReconciliation(status: ExplorerReceipt['status']): boolean {
  return status === 'ACCEPTED' || status === 'RUNNING' || status === 'RESULT_UNKNOWN';
}

export function nextExplorerFavoriteRouteKeys(
  current: readonly string[],
  routeKey: string,
  maximum: number
): readonly string[] | null {
  if (current.includes(routeKey)) return current.filter((key) => key !== routeKey);
  if (current.length >= maximum) return null;
  return [...current, routeKey];
}

export function explorerReceiptsShareImmutableContext(
  pending: ExplorerReceipt,
  reconciled: ExplorerReceipt
): boolean {
  return EXPLORER_RECEIPT_IMMUTABLE_CONTEXT_KEYS.every((key) => pending[key] === reconciled[key]);
}

export function hrisReceiptProjectionsShareImmutableContext(
  pending: HrisReceiptProjection,
  reconciled: HrisReceiptProjection
): boolean {
  if (pending.profile !== reconciled.profile) return false;
  return EXPLORER_RECEIPT_IMMUTABLE_CONTEXT_KEYS.every(
    (key) => pending.receipt[key] === reconciled.receipt[key]
  );
}
