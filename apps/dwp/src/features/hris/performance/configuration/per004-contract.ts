export const PER004_FEATURE_DEFAULT_ENABLED = false;
export const PER004_ENROLLED_TENANTS: readonly string[] = [];
export const PER004_PROVIDER_BOUND = false;

export const PER004_ROUTES = {
  formsScales: '/api/people/v1/hris/performance/workbench/forms-scales',
  settingsPerformance: '/api/people/v1/hris/performance/workbench/settings-performance',
} as const;

export type Per004Variant = 'FORMS_SCALES' | 'PERFORMANCE';
export type Per004QueryState = 'COMPLETE' | 'EMPTY' | 'PARTIAL' | 'UNAVAILABLE';
export type Per004FieldDecision = 'VIEW' | 'MASK' | 'OMIT';
export type Per004Field = Readonly<{
  decision: Exclude<Per004FieldDecision, 'OMIT'>;
  value: unknown | null;
  maskReason?: string;
  maskedDisplayKey?: string;
}>;

const ACTION_BASE = 'hris.action.sys.post.platform.v1.admin.hris.configurations.resource.versions';
export const PER004_ACTION_KEYS = [
  ACTION_BASE,
  `${ACTION_BASE}.resource.validate`,
  `${ACTION_BASE}.resource.simulate`,
  `${ACTION_BASE}.resource.submit`,
  `${ACTION_BASE}.resource.approve`,
  `${ACTION_BASE}.resource.publish`,
] as const;

export type Per004Action = Readonly<{
  actionKey: (typeof PER004_ACTION_KEYS)[number];
  method: 'POST';
  targetResourceType: 'REFERENCE_CONFIGURATION' | 'REFERENCE_CONFIGURATION_VERSION';
  targetConfigurationId: string;
  targetVersion?: number;
  expectedObjectVersion?: number;
  resolvedHref: string;
  idempotencyPolicy: 'REQUIRED_IDEMPOTENCY_KEY';
  stepUpPolicy: 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED';
}>;

export type Per004Item = Readonly<{
  itemPublicId: string;
  title: string;
  statusCode: string;
  fieldGroups: Readonly<Record<string, Per004Field>>;
  deepLink: Readonly<{ route: string; resourcePublicId: string }>;
  availableActions: readonly Per004Action[];
}>;

export type Per004Projection = Readonly<{
  projectionVersion: '2';
  asOf: string;
  variantKey: Per004Variant;
  queryState: Readonly<{
    state: Per004QueryState;
    scopeDecisionRevision: string;
    freshness: 'CURRENT' | 'STALE' | 'UNAVAILABLE';
    nextCursor: string | null;
    fieldDecisionSummary: Readonly<{ viewCount: number; maskedCount: number; omittedCount: number }>;
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
  items: readonly Per004Item[];
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const STATUS = /^[A-Z][A-Z0-9_]{1,63}$/;
const CURSOR = /^[A-Za-z0-9_-]{16,1024}$/;
const REVISION = /^[A-Za-z0-9._:-]{1,128}$/;
const KEY = /^[A-Za-z0-9._:-]{1,128}$/;
const POLICY_KEY = /^[a-z][a-z0-9._-]{1,127}$/;
const DISPLAY_KEY = /^[a-z][a-z0-9._-]{1,127}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const INSTANT = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|([+-])(\d{2}):(\d{2}))$/;
const ACTIONS = new Set<string>(PER004_ACTION_KEYS);
const FIELDS: Record<Per004Variant, readonly string[]> = {
  FORMS_SCALES: ['FORM_VERSION', 'RATING_SCALE', 'POLICY_STATUS'],
  PERFORMANCE: ['POLICY_VERSION', 'PERFORMANCE_POLICY', 'EFFECTIVE_STATUS'],
};

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('PER004_CONTRACT_INVALID');
  return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []): void {
  if (required.some((key) => !(key in value)) ||
      Object.keys(value).some((key) => !required.includes(key) && !optional.includes(key))) {
    throw new Error('PER004_CONTRACT_INVALID');
  }
}
function uuid(value: unknown): value is string { return typeof value === 'string' && UUID.test(value); }
function integer(value: unknown, min = 0): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min;
}
function date(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}
function instant(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const parts = INSTANT.exec(value);
  if (!parts || !date(parts[1]) || Number(parts[2]) > 23 || Number(parts[3]) > 59 ||
      parts[4] !== undefined && Number(parts[4]) > 59) return false;
  if (parts[6] !== 'Z' && (Number(parts[8]) > 18 || Number(parts[9]) > 59 ||
      Number(parts[8]) === 18 && Number(parts[9]) !== 0)) return false;
  return Number.isFinite(Date.parse(value));
}
function parseValue(variant: Per004Variant, group: string, wire: unknown): void {
  const value = record(wire);
  if (variant === 'FORMS_SCALES' && group === 'FORM_VERSION') {
    keys(value, ['key', 'version', 'digest']);
    if (typeof value.key !== 'string' || !KEY.test(value.key) ||
        typeof value.version !== 'string' || !REVISION.test(value.version) || value.version.length > 64 ||
        value.digest !== null && (typeof value.digest !== 'string' || !SHA256.test(value.digest))) {
      throw new Error('PER004_CONTRACT_INVALID');
    }
  } else if (variant === 'FORMS_SCALES' && group === 'RATING_SCALE') {
    keys(value, ['publicId', 'code', 'label', 'revision']);
    if (typeof value.publicId !== 'string' || !KEY.test(value.publicId) ||
        typeof value.code !== 'string' || !STATUS.test(value.code) ||
        typeof value.label !== 'string' || !value.label || value.label.length > 512 ||
        !integer(value.revision, 1)) throw new Error('PER004_CONTRACT_INVALID');
  } else if (group === 'POLICY_STATUS' || group === 'EFFECTIVE_STATUS') {
    keys(value, ['code', 'revision']);
    if (typeof value.code !== 'string' || !STATUS.test(value.code) ||
        !integer(value.revision, 1)) throw new Error('PER004_CONTRACT_INVALID');
  } else {
    keys(value, ['policyKey', 'revision', 'effectiveFrom', 'effectiveTo', 'status']);
    if (typeof value.policyKey !== 'string' || !POLICY_KEY.test(value.policyKey) ||
        !integer(value.revision, 1) || !date(value.effectiveFrom) ||
        value.effectiveTo !== null && !date(value.effectiveTo) ||
        typeof value.status !== 'string' || !STATUS.test(value.status)) {
      throw new Error('PER004_CONTRACT_INVALID');
    }
  }
}

function actionAllowedForState(actionKey: string, status: string): boolean {
  if (actionKey === ACTION_BASE) return status === 'NO_MUTABLE_VERSION_AND_CREATE_ELIGIBLE';
  const suffix = actionKey.slice(`${ACTION_BASE}.resource.`.length);
  return ({
    validate: 'DRAFT', simulate: 'VALIDATED', submit: 'SIMULATED', approve: 'PENDING_APPROVAL',
  } as Record<string, string>)[suffix] === status ||
    suffix === 'publish' && (status === 'APPROVED' || status === 'SCHEDULED');
}

export function parsePer004Action(wire: unknown, itemId: string): Per004Action {
  const action = record(wire);
  const isCreate = action.actionKey === ACTION_BASE;
  keys(action, ['actionKey', 'method', 'targetResourceType', 'targetConfigurationId', 'resolvedHref',
    'idempotencyPolicy', 'stepUpPolicy'], isCreate ? [] : ['targetVersion', 'expectedObjectVersion']);
  if (!ACTIONS.has(String(action.actionKey)) || action.method !== 'POST' ||
      action.targetConfigurationId !== itemId ||
      action.idempotencyPolicy !== 'REQUIRED_IDEMPOTENCY_KEY' ||
      action.stepUpPolicy !== 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED') throw new Error('PER004_ACTION_INVALID');
  const suffix = isCreate ? '' : String(action.actionKey).slice(`${ACTION_BASE}.resource.`.length);
  if (!isCreate && (!['validate', 'simulate', 'submit', 'approve', 'publish'].includes(suffix) ||
      !integer(action.targetVersion, 1) || !integer(action.expectedObjectVersion))) {
    throw new Error('PER004_ACTION_INVALID');
  }
  const href = `/api/platform/v1/admin/hris/configurations/${itemId}/versions` +
    (isCreate ? '' : `/${action.targetVersion}/${suffix}`);
  if (action.resolvedHref !== href || action.targetResourceType !==
      (isCreate ? 'REFERENCE_CONFIGURATION' : 'REFERENCE_CONFIGURATION_VERSION')) {
    throw new Error('PER004_ACTION_INVALID');
  }
  return action as Per004Action;
}

export function parsePer004Projection(wire: unknown, variant: Per004Variant): Per004Projection {
  const root = record(wire);
  keys(root, ['projectionVersion', 'asOf', 'variantKey', 'queryState', 'items']);
  if (root.projectionVersion !== '2' || root.variantKey !== variant ||
      !instant(root.asOf) || !Array.isArray(root.items) ||
      root.items.length > 100) throw new Error('PER004_CONTRACT_INVALID');
  const state = record(root.queryState);
  keys(state, ['state', 'scopeDecisionRevision', 'freshness', 'nextCursor', 'fieldDecisionSummary',
    'partialFailures', 'correlationId', 'cachePolicy']);
  if (!['COMPLETE', 'EMPTY', 'PARTIAL', 'UNAVAILABLE'].includes(String(state.state)) ||
      !['CURRENT', 'STALE', 'UNAVAILABLE'].includes(String(state.freshness)) ||
      typeof state.scopeDecisionRevision !== 'string' || !REVISION.test(state.scopeDecisionRevision) ||
      !uuid(state.correlationId) ||
      state.nextCursor !== null && (typeof state.nextCursor !== 'string' || !CURSOR.test(state.nextCursor)) ||
      !Array.isArray(state.partialFailures) || state.partialFailures.length > 32 ||
      (state.state === 'PARTIAL') !== (state.partialFailures.length > 0) ||
      (state.state === 'EMPTY' || state.state === 'UNAVAILABLE') && root.items.length !== 0 ||
      state.state === 'COMPLETE' && root.items.length === 0 ||
      state.state === 'UNAVAILABLE' && (state.nextCursor !== null || state.freshness !== 'UNAVAILABLE') ||
      (state.state === 'COMPLETE' || state.state === 'EMPTY') && state.freshness !== 'CURRENT' ||
      state.state === 'PARTIAL' && state.freshness !== 'STALE') {
    throw new Error('PER004_CONTRACT_INVALID');
  }
  const summary = record(state.fieldDecisionSummary);
  keys(summary, ['viewCount', 'maskedCount', 'omittedCount']);
  if (!integer(summary.viewCount) || !integer(summary.maskedCount) || !integer(summary.omittedCount))
    throw new Error('PER004_CONTRACT_INVALID');
  const cache = record(state.cachePolicy);
  keys(cache, ['authorizationDecisionRevision', 'invalidationEvent', 'maxAgeSeconds']);
  if (typeof cache.authorizationDecisionRevision !== 'string' ||
      !REVISION.test(cache.authorizationDecisionRevision) ||
      cache.invalidationEvent !== 'dwp.hris.access.assignment.changed.v1' ||
      !integer(cache.maxAgeSeconds) || cache.maxAgeSeconds > 300) throw new Error('PER004_CONTRACT_INVALID');
  for (const failureWire of state.partialFailures) {
    const failure = record(failureWire);
    keys(failure, ['componentKey', 'errorCode', 'correlationId', 'retryable']);
    if (typeof failure.componentKey !== 'string' ||
        !/^[a-z][a-z0-9._-]{0,127}$/.test(failure.componentKey) ||
        typeof failure.errorCode !== 'string' || !STATUS.test(failure.errorCode) ||
        !uuid(failure.correlationId) || typeof failure.retryable !== 'boolean') throw new Error('PER004_CONTRACT_INVALID');
  }
  const seen = new Set<string>();
  let views = 0;
  let masks = 0;
  let omits = 0;
  for (const wireItem of root.items) {
    const item = record(wireItem);
    keys(item, ['itemPublicId', 'title', 'statusCode', 'fieldGroups', 'deepLink', 'availableActions']);
    if (!uuid(item.itemPublicId) || seen.has(item.itemPublicId) ||
        typeof item.title !== 'string' || !item.title || item.title.length > 512 ||
        typeof item.statusCode !== 'string' || !STATUS.test(item.statusCode) ||
        !Array.isArray(item.availableActions) || item.availableActions.length > (variant === 'FORMS_SCALES' ? 0 : 1)) {
      throw new Error('PER004_CONTRACT_INVALID');
    }
    seen.add(item.itemPublicId);
    const deepLink = record(item.deepLink);
    keys(deepLink, ['route', 'resourcePublicId']);
    if (deepLink.resourcePublicId !== item.itemPublicId || deepLink.route !==
      (variant === 'FORMS_SCALES' ? '/hr/operations/performance/forms-scales' : '/hr/settings/performance')) {
      throw new Error('PER004_CONTRACT_INVALID');
    }
    const groups = record(item.fieldGroups);
    if (Object.keys(groups).length === 0 ||
        Object.keys(groups).some((key) => !FIELDS[variant].includes(key)))
      throw new Error('PER004_CONTRACT_INVALID');
    for (const group of FIELDS[variant]) {
      if (!(group in groups)) { omits++; continue; }
      const field = record(groups[group]);
      if (field.decision === 'VIEW') {
        keys(field, ['decision', 'value']);
        if (field.value === null) throw new Error('PER004_CONTRACT_INVALID');
        parseValue(variant, group, field.value);
        views++;
      } else if (field.decision === 'MASK') {
        keys(field, ['decision', 'value', 'maskReason', 'maskedDisplayKey']);
        if (field.value !== null || typeof field.maskReason !== 'string' ||
            !STATUS.test(field.maskReason) || typeof field.maskedDisplayKey !== 'string' ||
            !DISPLAY_KEY.test(field.maskedDisplayKey)) throw new Error('PER004_CONTRACT_INVALID');
        masks++;
      } else throw new Error('PER004_CONTRACT_INVALID');
    }
    for (const action of item.availableActions) {
      const parsedAction = parsePer004Action(action, item.itemPublicId);
      if (variant === 'FORMS_SCALES' || state.state !== 'COMPLETE' || state.freshness !== 'CURRENT' ||
          !actionAllowedForState(parsedAction.actionKey, item.statusCode) ||
          FIELDS[variant].some((field) => record(groups[field]).decision !== 'VIEW')) {
        throw new Error('PER004_ACTION_INVALID');
      }
    }
  }
  if (summary.viewCount !== views || summary.maskedCount !== masks || summary.omittedCount !== omits)
    throw new Error('PER004_CONTRACT_INVALID');
  return root as Per004Projection;
}
