export type PayrollWorkbenchState = 'COMPLETE' | 'EMPTY' | 'PARTIAL' | 'UNAVAILABLE';
export type PayrollWorkbenchFreshness = 'CURRENT' | 'STALE' | 'UNAVAILABLE';

export type PayrollPolicyValue = Readonly<{
  policyKey: string;
  revision: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: string;
}>;

export type PayrollStatusValue = Readonly<{ code: string; revision: number }>;
export type PayrollFieldValue = PayrollPolicyValue | PayrollStatusValue;
export type PayrollFieldDecision =
  | Readonly<{ decision: 'VIEW'; value: PayrollFieldValue }>
  | Readonly<{
      decision: 'MASK';
      value: null;
      maskReason: string;
      maskedDisplayKey: string;
    }>;

export type PayrollWorkbenchAction = Readonly<{
  actionKey: PayrollWorkbenchActionKey;
  method: 'POST';
  hrefTemplate: string;
  idempotencyPolicy: 'REQUIRED_IDEMPOTENCY_KEY';
  stepUpPolicy: 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED';
}>;

export type PayrollWorkbenchItem = Readonly<{
  itemPublicId: string;
  title: string;
  statusCode: string;
  fieldGroups: Readonly<
    Partial<Record<'POLICY_VERSION' | 'PAYROLL_POLICY' | 'EFFECTIVE_STATUS', PayrollFieldDecision>>
  >;
  deepLink: Readonly<{ route: '/hr/settings/payroll'; resourcePublicId: string }>;
  availableActions: readonly PayrollWorkbenchAction[];
}>;

export type PayrollConfigurationWorkbench = Readonly<{
  projectionVersion: '1';
  variantKey: 'PAYROLL';
  asOf: string;
  queryState: Readonly<{
    state: PayrollWorkbenchState;
    scopeDecisionRevision: string;
    freshness: PayrollWorkbenchFreshness;
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
  items: readonly PayrollWorkbenchItem[];
}>;

export const PAYROLL_WORKBENCH_ACTION_BINDINGS = Object.freeze({
  'hris.action.pay.formula.publish': '/api/payroll/v1/formulas/{formulaId}/publish',
  'hris.action.sys.post.platform.v1.admin.hris.configurations.resource.versions':
    '/api/platform/v1/admin/hris/configurations/{configId}/versions',
  'hris.action.sys.post.platform.v1.admin.hris.configurations.resource.versions.resource.validate':
    '/api/platform/v1/admin/hris/configurations/{configId}/versions/{version}/validate',
  'hris.action.sys.post.platform.v1.admin.hris.configurations.resource.versions.resource.simulate':
    '/api/platform/v1/admin/hris/configurations/{configId}/versions/{version}/simulate',
  'hris.action.sys.post.platform.v1.admin.hris.configurations.resource.versions.resource.approve':
    '/api/platform/v1/admin/hris/configurations/{configId}/versions/{version}/approve',
  'hris.action.sys.post.platform.v1.admin.hris.configurations.resource.versions.resource.publish':
    '/api/platform/v1/admin/hris/configurations/{configId}/versions/{version}/publish',
} as const);

export type PayrollWorkbenchActionKey = keyof typeof PAYROLL_WORKBENCH_ACTION_BINDINGS;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const PUBLIC_ID = /^[A-Za-z0-9._:-]{1,128}$/u;
const CODE = /^[A-Z][A-Z0-9_]{1,63}$/u;
const COMPONENT = /^[a-z][a-z0-9._-]{0,127}$/u;
const DISPLAY_KEY = /^[a-z][a-z0-9._-]{1,127}$/u;
const POLICY_KEY = /^[a-z][a-z0-9._-]{1,127}$/u;
const CURSOR = /^[A-Za-z0-9_-]{16,1024}$/u;
const DATE = /^\d{4}-\d{2}-\d{2}$/u;

function invalid(path: string): never {
  throw new Error(`Invalid payroll configuration workbench source: ${path}`);
}

function exact(value: unknown, path: string, allowed: readonly string[]) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(path);
  const source = value as Record<string, unknown>;
  if (Object.keys(source).some((key) => !allowed.includes(key))) invalid(path);
  return source;
}

function string(value: unknown, path: string, pattern?: RegExp, maximum = 512) {
  if (
    typeof value !== 'string' ||
    !value ||
    value !== value.trim() ||
    value.length > maximum ||
    (pattern && !pattern.test(value))
  )
    invalid(path);
  return value;
}

function integer(value: unknown, path: string, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || Number(value) < minimum || Number(value) > maximum)
    invalid(path);
  return Number(value);
}

function timestamp(value: unknown, path: string) {
  const result = string(value, path, undefined, 64);
  if (!Number.isFinite(Date.parse(result))) invalid(path);
  return result;
}

function civilDate(value: unknown, path: string) {
  const result = string(value, path, DATE, 10);
  const parsed = new Date(`${result}T00:00:00Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== result) invalid(path);
  return result;
}

function uuid(value: unknown, path: string) {
  return string(value, path, UUID, 36);
}

function policyValue(value: unknown, path: string): PayrollPolicyValue {
  const source = exact(value, path, [
    'policyKey',
    'revision',
    'effectiveFrom',
    'effectiveTo',
    'status',
  ]);
  return Object.freeze({
    policyKey: string(source.policyKey, `${path}.policyKey`, POLICY_KEY, 128),
    revision: integer(source.revision, `${path}.revision`, 1),
    effectiveFrom: civilDate(source.effectiveFrom, `${path}.effectiveFrom`),
    effectiveTo:
      source.effectiveTo === null ? null : civilDate(source.effectiveTo, `${path}.effectiveTo`),
    status: string(source.status, `${path}.status`, CODE, 64),
  });
}

function statusValue(value: unknown, path: string): PayrollStatusValue {
  const source = exact(value, path, ['code', 'revision']);
  return Object.freeze({
    code: string(source.code, `${path}.code`, CODE, 64),
    revision: integer(source.revision, `${path}.revision`, 1),
  });
}

function fieldDecision(value: unknown, path: string, status: boolean): PayrollFieldDecision {
  const discriminator = exact(value, path, ['decision', 'value', 'maskReason', 'maskedDisplayKey']);
  if (discriminator.decision === 'VIEW') {
    if ('maskReason' in discriminator || 'maskedDisplayKey' in discriminator) invalid(path);
    return Object.freeze({
      decision: 'VIEW',
      value: status
        ? statusValue(discriminator.value, `${path}.value`)
        : policyValue(discriminator.value, `${path}.value`),
    });
  }
  if (
    discriminator.decision !== 'MASK' ||
    discriminator.value !== null ||
    !('maskReason' in discriminator) ||
    !('maskedDisplayKey' in discriminator)
  )
    invalid(path);
  return Object.freeze({
    decision: 'MASK',
    value: null,
    maskReason: string(discriminator.maskReason, `${path}.maskReason`, CODE, 64),
    maskedDisplayKey: string(
      discriminator.maskedDisplayKey,
      `${path}.maskedDisplayKey`,
      DISPLAY_KEY,
      128
    ),
  });
}

function action(value: unknown, path: string): PayrollWorkbenchAction {
  const source = exact(value, path, [
    'actionKey',
    'method',
    'hrefTemplate',
    'idempotencyPolicy',
    'stepUpPolicy',
  ]);
  const actionKey = string(source.actionKey, `${path}.actionKey`, undefined, 160);
  if (!(actionKey in PAYROLL_WORKBENCH_ACTION_BINDINGS)) invalid(`${path}.actionKey`);
  const key = actionKey as PayrollWorkbenchActionKey;
  if (
    source.method !== 'POST' ||
    source.hrefTemplate !== PAYROLL_WORKBENCH_ACTION_BINDINGS[key] ||
    source.idempotencyPolicy !== 'REQUIRED_IDEMPOTENCY_KEY' ||
    source.stepUpPolicy !== 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED'
  )
    invalid(path);
  return Object.freeze({
    actionKey: key,
    method: 'POST',
    hrefTemplate: PAYROLL_WORKBENCH_ACTION_BINDINGS[key],
    idempotencyPolicy: 'REQUIRED_IDEMPOTENCY_KEY',
    stepUpPolicy: 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED',
  });
}

function item(value: unknown, index: number): PayrollWorkbenchItem {
  const path = `items[${index}]`;
  const source = exact(value, path, [
    'itemPublicId',
    'title',
    'statusCode',
    'fieldGroups',
    'deepLink',
    'availableActions',
  ]);
  const groups = exact(source.fieldGroups, `${path}.fieldGroups`, [
    'POLICY_VERSION',
    'PAYROLL_POLICY',
    'EFFECTIVE_STATUS',
  ]);
  if (Object.keys(groups).length === 0) invalid(`${path}.fieldGroups`);
  const fieldGroups: PayrollWorkbenchItem['fieldGroups'] = Object.freeze({
    ...('POLICY_VERSION' in groups
      ? {
          POLICY_VERSION: fieldDecision(
            groups.POLICY_VERSION,
            `${path}.fieldGroups.POLICY_VERSION`,
            false
          ),
        }
      : {}),
    ...('PAYROLL_POLICY' in groups
      ? {
          PAYROLL_POLICY: fieldDecision(
            groups.PAYROLL_POLICY,
            `${path}.fieldGroups.PAYROLL_POLICY`,
            false
          ),
        }
      : {}),
    ...('EFFECTIVE_STATUS' in groups
      ? {
          EFFECTIVE_STATUS: fieldDecision(
            groups.EFFECTIVE_STATUS,
            `${path}.fieldGroups.EFFECTIVE_STATUS`,
            true
          ),
        }
      : {}),
  });
  const deepLink = exact(source.deepLink, `${path}.deepLink`, ['route', 'resourcePublicId']);
  if (deepLink.route !== '/hr/settings/payroll') invalid(`${path}.deepLink.route`);
  if (!Array.isArray(source.availableActions) || source.availableActions.length > 6)
    invalid(`${path}.availableActions`);
  const actions = source.availableActions.map((entry, actionIndex) =>
    action(entry, `${path}.availableActions[${actionIndex}]`)
  );
  if (new Set(actions.map((entry) => entry.actionKey)).size !== actions.length)
    invalid(`${path}.availableActions`);
  return Object.freeze({
    itemPublicId: string(source.itemPublicId, `${path}.itemPublicId`, PUBLIC_ID, 128),
    title: string(source.title, `${path}.title`),
    statusCode: string(source.statusCode, `${path}.statusCode`, CODE, 64),
    fieldGroups,
    deepLink: Object.freeze({
      route: '/hr/settings/payroll' as const,
      resourcePublicId: string(
        deepLink.resourcePublicId,
        `${path}.deepLink.resourcePublicId`,
        PUBLIC_ID,
        128
      ),
    }),
    availableActions: Object.freeze(actions),
  });
}

export function selectPayrollConfigurationWorkbench(value: unknown): PayrollConfigurationWorkbench {
  const source = exact(value, 'root', [
    'projectionVersion',
    'asOf',
    'variantKey',
    'queryState',
    'items',
  ]);
  if (source.projectionVersion !== '1' || source.variantKey !== 'PAYROLL') invalid('root');
  if (!Array.isArray(source.items) || source.items.length > 500) invalid('items');
  const items = source.items.map(item);
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
  const states = new Set<PayrollWorkbenchState>(['COMPLETE', 'EMPTY', 'PARTIAL', 'UNAVAILABLE']);
  const freshnessValues = new Set<PayrollWorkbenchFreshness>(['CURRENT', 'STALE', 'UNAVAILABLE']);
  if (!states.has(query.state as PayrollWorkbenchState)) invalid('queryState.state');
  if (!freshnessValues.has(query.freshness as PayrollWorkbenchFreshness))
    invalid('queryState.freshness');
  const state = query.state as PayrollWorkbenchState;
  const freshness = query.freshness as PayrollWorkbenchFreshness;
  if (!Array.isArray(query.partialFailures) || query.partialFailures.length > 32)
    invalid('queryState.partialFailures');
  const failures = query.partialFailures.map((entry, index) => {
    const failure = exact(entry, `queryState.partialFailures[${index}]`, [
      'componentKey',
      'errorCode',
      'correlationId',
      'retryable',
    ]);
    if (typeof failure.retryable !== 'boolean') invalid(`queryState.partialFailures[${index}]`);
    return Object.freeze({
      componentKey: string(
        failure.componentKey,
        `queryState.partialFailures[${index}].componentKey`,
        COMPONENT,
        128
      ),
      errorCode: string(
        failure.errorCode,
        `queryState.partialFailures[${index}].errorCode`,
        CODE,
        64
      ),
      correlationId: uuid(
        failure.correlationId,
        `queryState.partialFailures[${index}].correlationId`
      ),
      retryable: failure.retryable,
    });
  });
  if (
    ((state === 'EMPTY' || state === 'UNAVAILABLE') && items.length > 0) ||
    (state === 'PARTIAL' && failures.length === 0) ||
    (state === 'COMPLETE' && failures.length > 0) ||
    ((state === 'UNAVAILABLE' || freshness === 'UNAVAILABLE') &&
      (items.length > 0 || query.nextCursor !== null || state !== 'UNAVAILABLE'))
  )
    invalid('queryState');

  const summary = exact(query.fieldDecisionSummary, 'queryState.fieldDecisionSummary', [
    'viewCount',
    'maskedCount',
    'omittedCount',
  ]);
  const counts = items.reduce(
    (result, current) => {
      const decisions = Object.values(current.fieldGroups);
      result.viewCount += decisions.filter((entry) => entry?.decision === 'VIEW').length;
      result.maskedCount += decisions.filter((entry) => entry?.decision === 'MASK').length;
      result.omittedCount += 3 - decisions.length;
      return result;
    },
    { viewCount: 0, maskedCount: 0, omittedCount: 0 }
  );
  if (
    integer(summary.viewCount, 'queryState.fieldDecisionSummary.viewCount') !== counts.viewCount ||
    integer(summary.maskedCount, 'queryState.fieldDecisionSummary.maskedCount') !==
      counts.maskedCount ||
    integer(summary.omittedCount, 'queryState.fieldDecisionSummary.omittedCount') !==
      counts.omittedCount
  )
    invalid('queryState.fieldDecisionSummary');

  const cache = exact(query.cachePolicy, 'queryState.cachePolicy', [
    'authorizationDecisionRevision',
    'invalidationEvent',
    'maxAgeSeconds',
  ]);
  if (cache.invalidationEvent !== 'dwp.hris.access.assignment.changed.v1')
    invalid('queryState.cachePolicy.invalidationEvent');
  const nextCursor =
    query.nextCursor === null
      ? null
      : string(query.nextCursor, 'queryState.nextCursor', CURSOR, 1024);
  return Object.freeze({
    projectionVersion: '1',
    variantKey: 'PAYROLL',
    asOf: timestamp(source.asOf, 'asOf'),
    queryState: Object.freeze({
      state,
      scopeDecisionRevision: string(
        query.scopeDecisionRevision,
        'queryState.scopeDecisionRevision',
        PUBLIC_ID,
        128
      ),
      freshness,
      nextCursor,
      fieldDecisionSummary: Object.freeze(counts),
      partialFailures: Object.freeze(failures),
      correlationId: uuid(query.correlationId, 'queryState.correlationId'),
      cachePolicy: Object.freeze({
        authorizationDecisionRevision: string(
          cache.authorizationDecisionRevision,
          'queryState.cachePolicy.authorizationDecisionRevision',
          PUBLIC_ID,
          128
        ),
        invalidationEvent: 'dwp.hris.access.assignment.changed.v1' as const,
        maxAgeSeconds: integer(cache.maxAgeSeconds, 'queryState.cachePolicy.maxAgeSeconds', 0, 300),
      }),
    }),
    items: Object.freeze(items),
  });
}

export function payrollWorkbenchCanPublish(item: PayrollWorkbenchItem | null | undefined) {
  return Boolean(
    item?.availableActions.some(
      (candidate) => candidate.actionKey === 'hris.action.pay.formula.publish'
    )
  );
}
