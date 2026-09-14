import type { components as GatewayComponents } from '@dwp-frontend/api-contracts';

type Schema = GatewayComponents['schemas'];
export const APPROVAL_POLICY_IMPACT_ROUTE = 'route.approvals.admin.policy-impact.data' as const;
export const APPROVAL_POLICY_IMPACT_GRANTS = Object.freeze({
  'approvals.design.read': 'ADMIN.APPROVAL_DESIGN:VIEW',
  'approvals.operations.read': 'ADMIN.APPROVAL_OPERATIONS:VIEW',
  'approvals.policy.read': 'ADMIN.APPROVAL_POLICY:VIEW',
});
export type ApprovalPolicyImpactReadAuthority = Readonly<{
  tenantId: number;
  actorId: number;
  resourceSetKey: string;
  contextKey: string;
  contextScopeKey: string;
  expectedDecisionRevision: string;
  routeContractKey: typeof APPROVAL_POLICY_IMPACT_ROUTE;
  mode: 'SECURE';
  rolloutState: '110' | '111';
  accessMode: 'NORMAL' | 'ELEVATED';
}>;
type Rules = Readonly<Required<Schema['approval_ApprovalPolicyImpactRules']>>;
type Head = Readonly<
  Omit<
    Required<Schema['approval_ApprovalPolicyImpactHead']>,
    | 'current'
    | 'pending'
    | 'publishedVersionId'
    | 'publishedVersion'
    | 'pendingBy'
    | 'pendingAt'
    | 'capturedAt'
  > & {
    current: Rules;
    pending?: Rules | null;
    publishedVersionId?: string | null;
    publishedVersion?: number | null;
    pendingBy?: number | null;
    pendingAt?: string | null;
    capturedAt?: string | null;
  }
>;
export type ApprovalPolicyImpactFamily = Readonly<{
  counts: Readonly<Required<Schema['approval_ApprovalPolicyImpactCounts']>>;
  items: readonly Readonly<{
    id: string;
    workflowVersionId?: string | null;
    requestId?: string | null;
    version: number;
    effect: Readonly<Required<Schema['approval_ApprovalPolicyImpactEffect']>>;
  }>[];
}>;
export type ApprovalPolicyImpact = Readonly<{
  status: 'NO_PROPOSAL' | 'COMPLETE' | 'PARTIAL';
  policy: Head;
  sourceDigest: string;
  semanticDiff: readonly Readonly<
    Schema['approval_ApprovalPolicyImpactDiff'] & {
      path: string;
      kind: 'ADD' | 'REMOVE' | 'CHANGE';
    }
  >[];
  workflows: ApprovalPolicyImpactFamily;
  requests: ApprovalPolicyImpactFamily;
  tasks: ApprovalPolicyImpactFamily;
  observedAt: string;
  authority: Readonly<Required<Schema['approval_ApprovalPolicyImpactAuthority']>>;
}>;

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const revision = /^psr-[0-9a-f]{64}$/u;
const digest = /^[0-9a-f]{64}$/u;
const policyKeys = [
  'BLOCK_SELF_APPROVAL',
  'REQUIRE_REJECT_REASON',
  'SLA_ESCALATION',
  'CAPTURE_DECISION_EVIDENCE',
];
function invalid(): never {
  throw new Error('Invalid approval policy impact contract');
}
function object(
  value: unknown,
  required: readonly string[],
  optional: readonly string[] = []
): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
  const data = value as Record<string, unknown>;
  if (
    !required.every((key) => Object.hasOwn(data, key)) ||
    Object.keys(data).some((key) => !required.includes(key) && !optional.includes(key))
  )
    invalid();
  return data;
}
function text(value: unknown, max = 512): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= max &&
    value === value.trim() &&
    !Array.from(value).some(
      (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127
    )
  );
}
function integer(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
}
function instant(value: unknown): value is string {
  return (
    text(value, 40) &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/u.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}
function choice(value: unknown, choices: readonly string[]): boolean {
  return typeof value === 'string' && choices.includes(value);
}
function nullable(data: Record<string, unknown>, key: string, check: (value: unknown) => boolean) {
  if (data[key] != null && !check(data[key])) invalid();
}
function boundedJson(value: unknown) {
  const pending = [{ value, depth: 0 }];
  let count = 0;
  let characters = 0;
  while (pending.length) {
    const node = pending.pop()!;
    if (++count > 20000 || node.depth > 16) invalid();
    if (typeof node.value === 'string') characters += node.value.length;
    else if (typeof node.value === 'number') {
      if (!Number.isFinite(node.value)) invalid();
    } else if (node.value && typeof node.value === 'object') {
      if (
        !Array.isArray(node.value) &&
        ![Object.prototype, null].includes(Object.getPrototypeOf(node.value))
      )
        invalid();
      for (const [key, child] of Object.entries(node.value)) {
        if (['__proto__', 'prototype', 'constructor'].includes(key)) invalid();
        characters += key.length;
        pending.push({ value: child, depth: node.depth + 1 });
      }
    } else if (node.value !== null && typeof node.value !== 'boolean') invalid();
    if (characters > 500000) invalid();
  }
}
function rules(value: unknown, key: string) {
  const data = object(value, ['enforcementMode', 'severity', 'lifecycleState', 'rule']);
  if (
    !choice(data.enforcementMode, ['BLOCK', 'WARN', 'MONITOR']) ||
    !choice(data.severity, ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']) ||
    !choice(data.lifecycleState, ['ACTIVE', 'DISABLED', 'RETIRED'])
  )
    invalid();
  if (key === 'BLOCK_SELF_APPROVAL') {
    if (typeof object(data.rule, ['requesterCannotDecide']).requesterCannotDecide !== 'boolean')
      invalid();
  } else if (key === 'REQUIRE_REJECT_REASON') {
    if (!integer(object(data.rule, ['minimumLength']).minimumLength, 4, 1000)) invalid();
  } else if (key === 'SLA_ESCALATION') {
    const rule = object(data.rule, ['warningPercent', 'breachPercent']);
    if (
      !integer(rule.warningPercent, 1, 99) ||
      !integer(rule.breachPercent, rule.warningPercent as number, 100)
    )
      invalid();
  } else if (key === 'CAPTURE_DECISION_EVIDENCE') {
    if (!text(object(data.rule, ['retentionClass']).retentionClass, 100)) invalid();
  } else invalid();
}
function family(value: unknown) {
  const data = object(value, ['counts', 'items']);
  const counts = object(data.counts, [
    'examined',
    'constraintChanged',
    'pinConflict',
    'configurationOnly',
    'unknown',
    'complete',
    'countKind',
  ]);
  if (
    !integer(counts.examined, 0, 1000) ||
    typeof counts.complete !== 'boolean' ||
    counts.countKind !== (counts.complete ? 'EXACT_OBSERVED_AT' : 'OBSERVED_LOWER_BOUND')
  )
    invalid();
  for (const key of ['constraintChanged', 'pinConflict', 'configurationOnly', 'unknown']) {
    if (!integer(counts[key], 0, counts.examined as number)) invalid();
  }
  if (
    (counts.complete && counts.unknown !== 0) ||
    !Array.isArray(data.items) ||
    data.items.length !== Math.min(counts.examined as number, 100)
  )
    invalid();
  const ids = new Set<string>();
  for (const item of data.items) {
    const row = object(item, ['id', 'version', 'effect'], ['workflowVersionId', 'requestId']);
    if (!text(row.id, 36) || !uuid.test(row.id) || ids.has(row.id) || !integer(row.version))
      invalid();
    ids.add(row.id);
    nullable(row, 'workflowVersionId', (id) => typeof id === 'string' && uuid.test(id));
    nullable(row, 'requestId', (id) => typeof id === 'string' && uuid.test(id));
    const effect = object(row.effect, [
      'reasons',
      'constraintChanged',
      'pinConflict',
      'configurationOnly',
      'unknown',
    ]);
    if (
      !Array.isArray(effect.reasons) ||
      effect.reasons.length > 100 ||
      !effect.reasons.every((reason) => text(reason, 160) && /^[A-Z][A-Z0-9_]*$/u.test(reason)) ||
      ['constraintChanged', 'pinConflict', 'configurationOnly', 'unknown'].some(
        (key) => typeof effect[key] !== 'boolean'
      )
    )
      invalid();
  }
  if ((counts.examined as number) <= 100) {
    for (const key of ['constraintChanged', 'pinConflict', 'configurationOnly', 'unknown']) {
      if (
        counts[key] !==
        data.items.filter((item) => (item as { effect: Record<string, unknown> }).effect[key])
          .length
      )
        invalid();
    }
  }
}
export function validateApprovalPolicyImpactReadAuthority(
  value: ApprovalPolicyImpactReadAuthority
) {
  const data = object(value, [
    'tenantId',
    'actorId',
    'resourceSetKey',
    'contextKey',
    'contextScopeKey',
    'expectedDecisionRevision',
    'routeContractKey',
    'mode',
    'rolloutState',
    'accessMode',
  ]);
  if (
    !integer(data.tenantId, 1) ||
    !integer(data.actorId, 1) ||
    !text(data.resourceSetKey, 80) ||
    !/^[A-Z][A-Z0-9_]{2,79}$/u.test(data.resourceSetKey) ||
    !text(data.contextKey) ||
    !text(data.contextScopeKey) ||
    !text(data.expectedDecisionRevision) ||
    !revision.test(data.expectedDecisionRevision) ||
    data.routeContractKey !== APPROVAL_POLICY_IMPACT_ROUTE ||
    data.mode !== 'SECURE' ||
    !choice(data.rolloutState, ['110', '111']) ||
    !choice(data.accessMode, ['NORMAL', 'ELEVATED'])
  )
    invalid();
}
export function readApprovalPolicyImpact(
  value: unknown,
  expected: Readonly<{
    policyId: string;
    expectedVersion: number;
    authority: ApprovalPolicyImpactReadAuthority;
  }>,
  now = Date.now()
): ApprovalPolicyImpact {
  validateApprovalPolicyImpactReadAuthority(expected.authority);
  if (!uuid.test(expected.policyId) || !integer(expected.expectedVersion) || !Number.isFinite(now))
    invalid();
  boundedJson(value);
  const data = object(value, [
    'status',
    'policy',
    'sourceDigest',
    'semanticDiff',
    'workflows',
    'requests',
    'tasks',
    'observedAt',
    'authority',
  ]);
  if (
    !choice(data.status, ['NO_PROPOSAL', 'COMPLETE', 'PARTIAL']) ||
    !text(data.sourceDigest, 64) ||
    !digest.test(data.sourceDigest) ||
    !instant(data.observedAt) ||
    Date.parse(data.observedAt) > now + 5000
  )
    invalid();
  const head = object(
    data.policy,
    ['policyId', 'policyKey', 'rowVersion', 'current', 'metadataProvenance'],
    ['publishedVersionId', 'publishedVersion', 'pending', 'pendingBy', 'pendingAt', 'capturedAt']
  );
  if (
    head.policyId !== expected.policyId ||
    head.rowVersion !== expected.expectedVersion ||
    !text(head.policyKey) ||
    !policyKeys.includes(head.policyKey) ||
    !text(head.metadataProvenance, 160)
  )
    invalid();
  nullable(head, 'publishedVersionId', (id) => typeof id === 'string' && uuid.test(id));
  nullable(head, 'publishedVersion', (version) => integer(version, 1));
  nullable(head, 'pendingBy', (id) => integer(id, 1));
  nullable(head, 'pendingAt', instant);
  nullable(head, 'capturedAt', instant);
  rules(head.current, head.policyKey);
  if (head.pending != null) rules(head.pending, head.policyKey);
  if ((data.status === 'NO_PROPOSAL') !== (head.pending == null)) invalid();
  if (
    !Array.isArray(data.semanticDiff) ||
    data.semanticDiff.length > 100 ||
    (head.pending == null && data.semanticDiff.length !== 0)
  )
    invalid();
  for (const diff of data.semanticDiff) {
    const row = object(diff, ['path', 'kind'], ['current', 'proposed']);
    if (
      !text(row.path, 512) ||
      !choice(row.kind, ['ADD', 'REMOVE', 'CHANGE']) ||
      (row.kind !== 'ADD' && !Object.hasOwn(row, 'current')) ||
      (row.kind !== 'REMOVE' && !Object.hasOwn(row, 'proposed'))
    )
      invalid();
  }
  for (const key of ['workflows', 'requests', 'tasks']) family(data[key]);
  const complete = ['workflows', 'requests', 'tasks'].every(
    (key) => (data[key] as ApprovalPolicyImpactFamily).counts.complete
  );
  if (data.status !== 'NO_PROPOSAL' && (data.status === 'COMPLETE') !== complete) invalid();
  const authority = object(data.authority, [
    'tenantId',
    'actorId',
    'resourceSetKey',
    'contextKey',
    'contextScopeKey',
    'decisionRevision',
    'routeKey',
    'rolloutState',
    'validUntil',
    'accessMode',
    'providerIdentity',
    'supportSession',
    'entitlementSatisfied',
    'grants',
  ]);
  const original = expected.authority;
  for (const key of [
    'tenantId',
    'actorId',
    'resourceSetKey',
    'contextKey',
    'contextScopeKey',
    'rolloutState',
    'accessMode',
  ] as const) {
    if (authority[key] !== original[key]) invalid();
  }
  if (
    authority.decisionRevision !== original.expectedDecisionRevision ||
    authority.routeKey !== APPROVAL_POLICY_IMPACT_ROUTE ||
    authority.providerIdentity !== false ||
    authority.supportSession !== false ||
    authority.entitlementSatisfied !== true ||
    !instant(authority.validUntil) ||
    Date.parse(authority.validUntil) <= now
  )
    invalid();
  const grants = object(authority.grants, Object.keys(APPROVAL_POLICY_IMPACT_GRANTS));
  for (const [key, permission] of Object.entries(APPROVAL_POLICY_IMPACT_GRANTS)) {
    const grant = object(grants[key], ['resourceSetKey', 'permission']);
    if (grant.resourceSetKey !== original.resourceSetKey || grant.permission !== permission)
      invalid();
  }
  const result = JSON.parse(JSON.stringify(value)) as ApprovalPolicyImpact;
  const remaining: object[] = [result];
  while (remaining.length) {
    const node = remaining.pop()!;
    for (const child of Object.values(node))
      if (child && typeof child === 'object') remaining.push(child);
    Object.freeze(node);
  }
  return result;
}
