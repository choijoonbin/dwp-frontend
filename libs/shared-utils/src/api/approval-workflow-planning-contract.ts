export const APPROVAL_WORKFLOW_PLANNING_SELECTION_ROUTE =
  'route.approvals.admin.workflow-planning-selection.data' as const;
export const APPROVAL_WORKFLOW_PLANNING_ROUTE =
  'route.approvals.admin.workflow-planning-simulation.data' as const;

export type ApprovalWorkflowPlanningFormPin = Readonly<{
  formId: string;
  formVersionId: string;
  formRevision: number;
  formVersion: number;
  formSchemaSha256: string;
}>;
export type ApprovalWorkflowPlanningSelection = Readonly<{
  workflowId: string;
  workflowVersionId: string;
  workflowRevision: number;
  workflowSha256: string;
  managementResourceSetKey: string;
  policy: Readonly<{ version: number; sha256: string }>;
  forms: readonly ApprovalWorkflowPlanningFormPin[];
  selectedFormId: string | null;
  generatedAt: string;
}>;
export type ApprovalWorkflowPlanningInput = Readonly<{
  workflowRevision: number;
  workflowSha256: string;
  formVersionId: string;
  formSchemaSha256: string;
  policyVersion: number;
  policySha256: string;
  managementResourceSetKey: string;
  samplePayload: Readonly<Record<string, unknown>>;
}>;
export type ApprovalWorkflowPlanningStage = Readonly<{
  stepKey: string;
  selected: boolean;
  predecessors: readonly string[];
  roleCode: string;
  quorumMode: 'ANY' | 'ALL' | 'COUNT' | 'PERCENT';
  quorumValue?: number | null;
  activeMemberCount: number;
  indicativeThreshold?: number | null;
  poolWarning?: 'EMPTY_POOL' | 'INSUFFICIENT_POOL' | null;
}>;
export type ApprovalWorkflowPlanningResult = Readonly<{
  mode: 'ROLE_POOL_PREVIEW';
  runtimeEligibility: 'NOT_EVALUATED';
  requesterExclusion: 'NOT_EVALUATED';
  snapshotSha256: string;
  authorityRevision: string;
  expiresAt: string;
  stages: readonly ApprovalWorkflowPlanningStage[];
}>;
export type ApprovalWorkflowPlanningReadAuthority = Readonly<{
  mode: 'SECURE';
  rolloutState: '110' | '111';
  routeContractKey:
    typeof APPROVAL_WORKFLOW_PLANNING_ROUTE | typeof APPROVAL_WORKFLOW_PLANNING_SELECTION_ROUTE;
  expectedDecisionRevision: string;
  contextKey: string;
  contextScopeKey: string;
}>;

export const planningUuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const uuid = (value: unknown): value is string =>
  typeof value === 'string' && planningUuid.test(value);
const hash = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
const integer = (value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
const instant = (value: unknown): value is string =>
  typeof value === 'string' && Number.isFinite(Date.parse(value));
const key = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Z][A-Z0-9_]{0,79}$/u.test(value);
function invalid(): never {
  throw new Error('Invalid approval workflow planning contract');
}
function object(value: unknown): Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
  )
    invalid();
  return value as Record<string, unknown>;
}
function closed(value: unknown, required: readonly string[], optional: readonly string[] = []) {
  const data = object(value);
  if (
    !required.every((name) => Object.hasOwn(data, name)) ||
    Object.keys(data).some((name) => !required.includes(name) && !optional.includes(name))
  )
    invalid();
  return data;
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
export function readApprovalWorkflowPlanningSelection(
  value: unknown
): ApprovalWorkflowPlanningSelection {
  const data = closed(value, [
    'workflowId',
    'workflowVersionId',
    'workflowRevision',
    'workflowSha256',
    'managementResourceSetKey',
    'policy',
    'forms',
    'selectedFormId',
    'generatedAt',
  ]);
  const policy = closed(data.policy, ['version', 'sha256']);
  if (
    !uuid(data.workflowId) ||
    !uuid(data.workflowVersionId) ||
    !integer(data.workflowRevision) ||
    !hash(data.workflowSha256) ||
    typeof data.managementResourceSetKey !== 'string' ||
    !/^[A-Z][A-Z0-9_]{2,79}$/u.test(data.managementResourceSetKey) ||
    !integer(policy.version, 1) ||
    !hash(policy.sha256) ||
    !instant(data.generatedAt) ||
    !Array.isArray(data.forms) ||
    data.forms.length > 100
  )
    invalid();
  const ids = new Set<string>();
  const versions = new Set<string>();
  for (const value of data.forms) {
    const form = closed(value, [
      'formId',
      'formVersionId',
      'formRevision',
      'formVersion',
      'formSchemaSha256',
    ]);
    if (
      !uuid(form.formId) ||
      !uuid(form.formVersionId) ||
      !integer(form.formRevision) ||
      !integer(form.formVersion, 1) ||
      !hash(form.formSchemaSha256) ||
      ids.has(String(form.formId)) ||
      versions.has(String(form.formVersionId))
    )
      invalid();
    ids.add(String(form.formId));
    versions.add(String(form.formVersionId));
  }
  if (
    data.selectedFormId !== null &&
    (typeof data.selectedFormId !== 'string' || !ids.has(data.selectedFormId))
  )
    invalid();
  return freeze(JSON.parse(JSON.stringify(data)) as ApprovalWorkflowPlanningSelection);
}
export function captureApprovalWorkflowPlanningInput(
  value: unknown
): ApprovalWorkflowPlanningInput {
  const data = closed(value, [
    'workflowRevision',
    'workflowSha256',
    'formVersionId',
    'formSchemaSha256',
    'policyVersion',
    'policySha256',
    'managementResourceSetKey',
    'samplePayload',
  ]);
  const sample = object(data.samplePayload);
  if (
    !integer(data.workflowRevision) ||
    !hash(data.workflowSha256) ||
    !uuid(data.formVersionId) ||
    !hash(data.formSchemaSha256) ||
    !integer(data.policyVersion, 1) ||
    !hash(data.policySha256) ||
    typeof data.managementResourceSetKey !== 'string' ||
    !/^[A-Z][A-Z0-9_]{2,79}$/u.test(data.managementResourceSetKey) ||
    Object.keys(sample).length > 100
  )
    invalid();
  const queue = [{ value: data.samplePayload, depth: 0 }];
  let nodes = 0;
  while (queue.length) {
    const node = queue.pop()!;
    if (++nodes > 50000 || node.depth > 32) invalid();
    if (typeof node.value === 'number' && !Number.isSafeInteger(node.value)) invalid();
    if (node.value && typeof node.value === 'object') {
      if (!Array.isArray(node.value)) object(node.value);
      Object.values(node.value).forEach((value) => queue.push({ value, depth: node.depth + 1 }));
    } else if (node.value !== null && !['string', 'number', 'boolean'].includes(typeof node.value))
      invalid();
  }
  const serialized = JSON.stringify(data);
  if (new TextEncoder().encode(serialized).length > 524288) invalid();
  return freeze(JSON.parse(serialized) as ApprovalWorkflowPlanningInput);
}
export function readApprovalWorkflowPlanningResult(
  value: unknown,
  now = Date.now()
): ApprovalWorkflowPlanningResult {
  const data = closed(value, [
    'mode',
    'runtimeEligibility',
    'requesterExclusion',
    'snapshotSha256',
    'authorityRevision',
    'expiresAt',
    'stages',
  ]);
  if (
    data.mode !== 'ROLE_POOL_PREVIEW' ||
    data.runtimeEligibility !== 'NOT_EVALUATED' ||
    data.requesterExclusion !== 'NOT_EVALUATED' ||
    !hash(data.snapshotSha256) ||
    typeof data.authorityRevision !== 'string' ||
    !/^awp-[a-f0-9]{64}$/u.test(data.authorityRevision) ||
    !instant(data.expiresAt) ||
    Date.parse(data.expiresAt) <= now ||
    !Array.isArray(data.stages) ||
    data.stages.length < 1 ||
    data.stages.length > 64
  )
    invalid();
  const seen = new Set<string>();
  for (const value of data.stages) {
    const stage = closed(
      value,
      ['stepKey', 'selected', 'predecessors', 'roleCode', 'quorumMode', 'activeMemberCount'],
      ['quorumValue', 'indicativeThreshold', 'poolWarning']
    );
    if (
      !key(stage.stepKey) ||
      seen.has(stage.stepKey) ||
      !key(stage.roleCode) ||
      typeof stage.selected !== 'boolean' ||
      !Array.isArray(stage.predecessors) ||
      stage.predecessors.length > 64 ||
      stage.predecessors.some((value) => !key(value)) ||
      new Set(stage.predecessors).size !== stage.predecessors.length ||
      !integer(stage.activeMemberCount, 0, 1000) ||
      !['ANY', 'ALL', 'COUNT', 'PERCENT'].includes(String(stage.quorumMode))
    )
      invalid();
    seen.add(stage.stepKey);
    const parameterized = stage.quorumMode === 'COUNT' || stage.quorumMode === 'PERCENT';
    if (
      parameterized
        ? !integer(stage.quorumValue, 1, stage.quorumMode === 'PERCENT' ? 100 : 1000)
        : stage.quorumValue != null
    )
      invalid();
    const count = stage.activeMemberCount;
    const expected =
      stage.quorumMode === 'ANY'
        ? 1
        : stage.quorumMode === 'ALL'
          ? count
          : stage.quorumMode === 'COUNT'
            ? (stage.quorumValue as number)
            : Math.ceil((count * (stage.quorumValue as number)) / 100);
    const warning = count === 0 ? 'EMPTY_POOL' : expected > count ? 'INSUFFICIENT_POOL' : null;
    if (
      warning
        ? stage.poolWarning !== warning || stage.indicativeThreshold != null
        : stage.poolWarning != null || stage.indicativeThreshold !== expected
    )
      invalid();
  }
  for (const stage of data.stages)
    if (
      (stage as ApprovalWorkflowPlanningStage).predecessors.some(
        (key) => !seen.has(key) || key === (stage as ApprovalWorkflowPlanningStage).stepKey
      )
    )
      invalid();
  return freeze(JSON.parse(JSON.stringify(data)) as ApprovalWorkflowPlanningResult);
}
export function validateApprovalWorkflowPlanningAuthority(
  authority: ApprovalWorkflowPlanningReadAuthority,
  route: string
) {
  if (
    !authority ||
    Object.keys(authority).length !== 6 ||
    authority.mode !== 'SECURE' ||
    !['110', '111'].includes(authority.rolloutState) ||
    authority.routeContractKey !== route ||
    !/^psr-[a-f0-9]{64}$/u.test(authority.expectedDecisionRevision) ||
    ![authority.contextKey, authority.contextScopeKey].every(
      (value) =>
        typeof value === 'string' &&
        value.length > 0 &&
        value.length <= 500 &&
        value === value.trim() &&
        !Array.from(value).some(
          (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127
        )
    )
  )
    invalid();
}
