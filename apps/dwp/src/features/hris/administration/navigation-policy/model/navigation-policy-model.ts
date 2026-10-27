import {
  HR_OPERATIONS_NAVIGATION_CATALOG,
  HR_OPERATIONS_NODE_IDS,
  HR_OPERATIONS_WORKBENCH_ID,
} from '../../../shell/navigation-policy/hr-operations-navigation-policy';

import type {
  HrisNavigationPolicyGroup,
  HrisNavigationRolloutMode,
} from '../../../shell/navigation-policy/hr-operations-navigation-policy';

export type NavigationPolicyScopeKind = 'TENANT' | 'LEGAL_ENTITY';
export type NavigationPolicyLifecycle =
  'DRAFT' | 'VALIDATED' | 'PENDING_APPROVAL' | 'APPROVED' | 'PUBLISHED';
export type NavigationPolicyAction =
  'CREATE_DRAFT' | 'SAVE_DRAFT' | 'VALIDATE' | 'SUBMIT' | 'APPROVE' | 'PUBLISH' | 'RESTORE';
export type NavigationPolicyViewState =
  'LOADING' | 'READY' | 'EMPTY' | 'PARTIAL' | 'STALE' | 'DENIED' | 'UNAVAILABLE' | 'ERROR';

export type NavigationPolicyRevision = Readonly<{
  policyId: string;
  revisionId: string;
  revision: number;
  objectVersion: number;
  status: NavigationPolicyLifecycle;
  scopeKind: NavigationPolicyScopeKind;
  scopePublicId: string | null;
  legalEntityPublicId: string | null;
  rolloutMode: HrisNavigationRolloutMode;
  workbenchId: typeof HR_OPERATIONS_WORKBENCH_ID;
  groups: readonly HrisNavigationPolicyGroup[];
  digest: string;
  authorPrincipalId: number;
  approvedByPrincipalId: number | null;
  restoredFromRevisionId: number | null;
  restoredFromDigest: string | null;
  createdAt: string;
  updatedAt: string;
}>;

export type NavigationPolicyDraft = Omit<
  NavigationPolicyRevision,
  | 'policyId'
  | 'revisionId'
  | 'revision'
  | 'objectVersion'
  | 'status'
  | 'digest'
  | 'authorPrincipalId'
  | 'approvedByPrincipalId'
  | 'restoredFromRevisionId'
  | 'restoredFromDigest'
  | 'createdAt'
  | 'updatedAt'
> &
  Readonly<{
    policyId?: string;
    revisionId?: string;
    revision?: number;
    objectVersion: number;
    status: 'DRAFT' | 'VALIDATED' | 'PENDING_APPROVAL' | 'APPROVED';
  }>;

export type NavigationPolicyWorkspace = Readonly<{
  projectionVersion: '1';
  asOf: string | null;
  queryState: Readonly<{
    state: 'COMPLETE' | 'EMPTY' | 'PARTIAL' | 'UNAVAILABLE';
    freshness: 'CURRENT' | 'STALE' | 'UNAVAILABLE';
    scopeDecisionRevision: string;
    partialFailures: readonly Readonly<{
      componentKey: string;
      errorCode: string;
      correlationId: string;
      retryable: boolean;
    }>[];
  }>;
  scope: Readonly<{
    scopeKind: NavigationPolicyScopeKind;
    scopePublicId: string | null;
    displayName: string;
  }>;
  tenantBaseline: NavigationPolicyRevision | null;
  activeRevision: NavigationPolicyRevision | null;
  draft: NavigationPolicyDraft | null;
  restorableRevisions?: readonly NavigationPolicyRevision[];
}>;

export type NavigationPolicyCommandReceipt = Readonly<{
  receiptId: string;
  policyId: string;
  revisionId: string;
  revision: number;
  objectVersion: number;
  lifecycleState: NavigationPolicyLifecycle;
  status: 'SUCCEEDED';
  commandType: NavigationPolicyAction;
  requestDigest: string;
  correlationId: string;
  createdAt: string;
}>;

export type NavigationPolicyCommandInput = Readonly<{
  action: NavigationPolicyAction;
  draft: NavigationPolicyDraft;
  revisionId?: string;
  expectedVersion: number;
  targetRevisionId?: string;
  targetDigest?: string;
  reason?: string;
}>;

export type NavigationPolicyCommandOwner = Readonly<{
  execute(input: NavigationPolicyCommandInput): Promise<NavigationPolicyCommandReceipt>;
}>;

export type NavigationPolicyValidationIssue = Readonly<{
  code:
    | 'CATALOG_GROUP_MISMATCH'
    | 'CATALOG_NODE_MISMATCH'
    | 'NO_EFFECTIVE_NODE'
    | 'INVALID_DEFAULT'
    | 'LEGAL_OVERLAY_REENABLE';
  message: string;
  groupId?: string;
  nodeId?: string;
}>;

const NEXT_ACTIONS: Readonly<Record<NavigationPolicyLifecycle, readonly NavigationPolicyAction[]>> =
  {
    DRAFT: ['SAVE_DRAFT', 'VALIDATE'],
    VALIDATED: ['SUBMIT'],
    PENDING_APPROVAL: ['APPROVE'],
    APPROVED: ['PUBLISH'],
    PUBLISHED: ['RESTORE'],
  };

export function navigationPolicyActions(
  lifecycle: NavigationPolicyLifecycle
): readonly NavigationPolicyAction[] {
  return NEXT_ACTIONS[lifecycle];
}

export function createNavigationPolicyDraft(input: {
  scopeKind: NavigationPolicyScopeKind;
  scopePublicId?: string | null;
  tenantBaseline?: NavigationPolicyRevision | null;
}): NavigationPolicyDraft {
  const groups = HR_OPERATIONS_NAVIGATION_CATALOG.map((group) => {
    const tenantGroup = input.tenantBaseline?.groups.find(
      (candidate) => candidate.groupId === group.groupId
    );
    return cloneGroup(
      group,
      input.scopeKind === 'LEGAL_ENTITY' ? tenantGroup : undefined,
      input.scopeKind === 'LEGAL_ENTITY'
    );
  });
  return Object.freeze({
    scopeKind: input.scopeKind,
    scopePublicId: input.scopeKind === 'LEGAL_ENTITY' ? (input.scopePublicId ?? null) : null,
    legalEntityPublicId: input.scopeKind === 'LEGAL_ENTITY' ? (input.scopePublicId ?? null) : null,
    rolloutMode: 'SHADOW',
    workbenchId: HR_OPERATIONS_WORKBENCH_ID,
    groups: Object.freeze(groups),
    objectVersion: 0,
    status: 'DRAFT',
  });
}

export function setNavigationPolicyNodeEnabled(
  draft: NavigationPolicyDraft,
  groupId: string,
  nodeId: string,
  enabled: boolean,
  tenantBaseline?: NavigationPolicyRevision | null
): NavigationPolicyDraft {
  if (
    enabled &&
    draft.scopeKind === 'LEGAL_ENTITY' &&
    !isEnabledInBaseline(tenantBaseline, groupId, nodeId)
  ) {
    throw new Error('A legal-entity overlay cannot re-enable a tenant-disabled node.');
  }
  return updateGroup(draft, groupId, (group) => {
    const nodes = group.nodes.map((node) =>
      node.nodeId === nodeId ? Object.freeze({ ...node, enabled }) : node
    );
    if (!nodes.some((node) => node.nodeId === nodeId)) {
      throw new Error(`Unknown canonical navigation node: ${nodeId}`);
    }
    const enabledNodes = nodes.filter((node) => node.enabled);
    const defaultNodeId = enabledNodes.some((node) => node.nodeId === group.defaultNodeId)
      ? group.defaultNodeId
      : (enabledNodes[0]?.nodeId ?? group.defaultNodeId);
    return Object.freeze({
      ...group,
      enabled: enabledNodes.length > 0,
      defaultNodeId,
      nodes: Object.freeze(nodes),
    });
  });
}

export function setNavigationPolicyGroupEnabled(
  draft: NavigationPolicyDraft,
  groupId: string,
  enabled: boolean,
  tenantBaseline?: NavigationPolicyRevision | null
): NavigationPolicyDraft {
  return updateGroup(draft, groupId, (group) => {
    const nodes = group.nodes.map((node) => {
      const nextEnabled =
        enabled && draft.scopeKind === 'LEGAL_ENTITY'
          ? isEnabledInBaseline(tenantBaseline, groupId, node.nodeId)
          : enabled;
      return Object.freeze({ ...node, enabled: nextEnabled });
    });
    const firstEnabled = nodes.find((node) => node.enabled);
    return Object.freeze({
      ...group,
      enabled: enabled && Boolean(firstEnabled),
      defaultNodeId: firstEnabled?.nodeId ?? group.defaultNodeId,
      nodes: Object.freeze(nodes),
    });
  });
}

export function setNavigationPolicyDefaultNode(
  draft: NavigationPolicyDraft,
  groupId: string,
  nodeId: string
): NavigationPolicyDraft {
  return updateGroup(draft, groupId, (group) => {
    if (!group.nodes.some((node) => node.nodeId === nodeId && node.enabled)) {
      throw new Error('A group default must reference an enabled canonical node.');
    }
    return Object.freeze({ ...group, defaultNodeId: nodeId });
  });
}

export function moveNavigationPolicyGroup(
  draft: NavigationPolicyDraft,
  groupId: string,
  direction: -1 | 1
): NavigationPolicyDraft {
  const groups = reorder(draft.groups, groupId, direction, (group) => group.groupId).map(
    (group, displayOrder) => Object.freeze({ ...group, displayOrder })
  );
  return Object.freeze({ ...draft, groups: Object.freeze(groups) });
}

export function moveNavigationPolicyNode(
  draft: NavigationPolicyDraft,
  groupId: string,
  nodeId: string,
  direction: -1 | 1
): NavigationPolicyDraft {
  return updateGroup(draft, groupId, (group) => {
    const nodes = reorder(group.nodes, nodeId, direction, (node) => node.nodeId).map(
      (node, displayOrder) => Object.freeze({ ...node, displayOrder })
    );
    return Object.freeze({ ...group, nodes: Object.freeze(nodes) });
  });
}

export function validateNavigationPolicyDraft(
  draft: NavigationPolicyDraft,
  tenantBaseline?: NavigationPolicyRevision | null
): readonly NavigationPolicyValidationIssue[] {
  const issues: NavigationPolicyValidationIssue[] = [];
  const expectedGroups = new Set(HR_OPERATIONS_NAVIGATION_CATALOG.map((group) => group.groupId));
  const actualGroups = new Set(draft.groups.map((group) => group.groupId));
  if (
    draft.groups.length !== expectedGroups.size ||
    actualGroups.size !== draft.groups.length ||
    !sameSet(expectedGroups, actualGroups)
  ) {
    issues.push({
      code: 'CATALOG_GROUP_MISMATCH',
      message: 'Policy groups do not match the seven canonical HR Operations groups.',
    });
  }
  const actualNodeValues = draft.groups.flatMap((group) => group.nodes.map((node) => node.nodeId));
  const actualNodes = new Set(actualNodeValues);
  if (
    actualNodeValues.length !== HR_OPERATIONS_NODE_IDS.size ||
    actualNodes.size !== actualNodeValues.length ||
    !sameSet(HR_OPERATIONS_NODE_IDS, actualNodes)
  ) {
    issues.push({
      code: 'CATALOG_NODE_MISMATCH',
      message: 'Policy nodes do not match the seventeen canonical HR Operations nodes.',
    });
  }
  for (const group of draft.groups) {
    const canonicalGroup = HR_OPERATIONS_NAVIGATION_CATALOG.find(
      (candidate) => candidate.groupId === group.groupId
    );
    const canonicalGroupNodes = new Set(canonicalGroup?.nodes.map((node) => node.nodeId) ?? []);
    const actualGroupNodes = new Set(group.nodes.map((node) => node.nodeId));
    if (
      !canonicalGroup ||
      group.nodes.length !== canonicalGroupNodes.size ||
      actualGroupNodes.size !== group.nodes.length ||
      !sameSet(canonicalGroupNodes, actualGroupNodes)
    ) {
      issues.push({
        code: 'CATALOG_NODE_MISMATCH',
        message: `Policy nodes do not match canonical group ${group.groupId}.`,
        groupId: group.groupId,
      });
    }
    const enabledNodes = group.nodes.filter((node) => node.enabled);
    if (group.enabled && !enabledNodes.some((node) => node.nodeId === group.defaultNodeId)) {
      issues.push({
        code: 'INVALID_DEFAULT',
        message: 'The group default must remain enabled.',
        groupId: group.groupId,
        nodeId: group.defaultNodeId,
      });
    }
    if (draft.scopeKind === 'LEGAL_ENTITY') {
      for (const node of enabledNodes) {
        if (!isEnabledInBaseline(tenantBaseline, group.groupId, node.nodeId)) {
          issues.push({
            code: 'LEGAL_OVERLAY_REENABLE',
            message: 'A legal-entity overlay cannot re-enable a tenant-disabled node.',
            groupId: group.groupId,
            nodeId: node.nodeId,
          });
        }
      }
    }
  }
  if (!draft.groups.some((group) => group.enabled && group.nodes.some((node) => node.enabled))) {
    issues.push({
      code: 'NO_EFFECTIVE_NODE',
      message: 'At least one authorized landing candidate must remain enabled.',
    });
  }
  return Object.freeze(issues);
}

export function resolveNavigationPolicyViewState(input: {
  loading: boolean;
  denied: boolean;
  failed: boolean;
  workspace?: NavigationPolicyWorkspace;
}): NavigationPolicyViewState {
  if (input.denied) return 'DENIED';
  if (input.loading) return 'LOADING';
  if (input.failed) return 'ERROR';
  if (!input.workspace || input.workspace.queryState.state === 'UNAVAILABLE') return 'UNAVAILABLE';
  if (input.workspace.queryState.freshness === 'STALE') return 'STALE';
  if (input.workspace.queryState.state === 'PARTIAL') return 'PARTIAL';
  if (input.workspace.queryState.state === 'EMPTY') return 'EMPTY';
  return 'READY';
}

export function assertNavigationPolicyReceipt(
  value: unknown,
  expected: { action: NavigationPolicyAction; requestDigest: string }
): NavigationPolicyCommandReceipt {
  if (!isRecord(value)) throw new Error('Navigation-policy receipt is invalid.');
  if (
    value.status !== 'SUCCEEDED' ||
    value.commandType !== expected.action ||
    value.requestDigest !== expected.requestDigest ||
    !isUuid(value.receiptId) ||
    !isUuid(value.policyId) ||
    !isUuid(value.revisionId) ||
    !isUuid(value.correlationId) ||
    !isRevision(value.revision, 1) ||
    !isRevision(value.objectVersion, 0) ||
    !['DRAFT', 'VALIDATED', 'PENDING_APPROVAL', 'APPROVED', 'PUBLISHED'].includes(
      String(value.lifecycleState)
    ) ||
    typeof value.createdAt !== 'string' ||
    !Number.isFinite(Date.parse(value.createdAt))
  ) {
    throw new Error('Navigation-policy receipt does not match the sealed command.');
  }
  return Object.freeze(value as NavigationPolicyCommandReceipt);
}

function cloneGroup(
  canonical: HrisNavigationPolicyGroup,
  ceiling?: HrisNavigationPolicyGroup,
  restrictive = false
): HrisNavigationPolicyGroup {
  const ceilingNodes = new Map(ceiling?.nodes.map((node) => [node.nodeId, node.enabled]) ?? []);
  const nodes = canonical.nodes.map((node) =>
    Object.freeze({
      ...node,
      enabled:
        ceiling && ceiling.enabled
          ? ceilingNodes.get(node.nodeId) === true
          : restrictive
            ? false
            : true,
    })
  );
  const enabledNodes = nodes.filter((node) => node.enabled);
  return Object.freeze({
    ...canonical,
    enabled: enabledNodes.length > 0,
    defaultNodeId: enabledNodes.some((node) => node.nodeId === ceiling?.defaultNodeId)
      ? ceiling!.defaultNodeId
      : (enabledNodes[0]?.nodeId ?? canonical.defaultNodeId),
    nodes: Object.freeze(nodes),
  });
}

function updateGroup(
  draft: NavigationPolicyDraft,
  groupId: string,
  update: (group: HrisNavigationPolicyGroup) => HrisNavigationPolicyGroup
) {
  if (!draft.groups.some((group) => group.groupId === groupId)) {
    throw new Error(`Unknown canonical navigation group: ${groupId}`);
  }
  return Object.freeze({
    ...draft,
    groups: Object.freeze(
      draft.groups.map((group) => (group.groupId === groupId ? update(group) : group))
    ),
  });
}

function isEnabledInBaseline(
  baseline: NavigationPolicyRevision | null | undefined,
  groupId: string,
  nodeId: string
) {
  const group = baseline?.groups.find((candidate) => candidate.groupId === groupId);
  return Boolean(
    group?.enabled && group.nodes.some((node) => node.nodeId === nodeId && node.enabled)
  );
}

function reorder<T>(
  source: readonly T[],
  id: string,
  direction: -1 | 1,
  getId: (value: T) => string
): T[] {
  const values = [...source].sort((left, right) => {
    const leftOrder = (left as { displayOrder?: number }).displayOrder ?? 0;
    const rightOrder = (right as { displayOrder?: number }).displayOrder ?? 0;
    return leftOrder - rightOrder;
  });
  const index = values.findIndex((value) => getId(value) === id);
  if (index < 0) throw new Error(`Unknown policy item: ${id}`);
  const target = index + direction;
  if (target < 0 || target >= values.length) return values;
  [values[index], values[target]] = [values[target], values[index]];
  return values;
}

function sameSet(left: ReadonlySet<string>, right: ReadonlySet<string>) {
  return left.size === right.size && [...left].every((value) => right.has(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

function isRevision(value: unknown, minimum: number) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum;
}
