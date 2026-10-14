import {
  HR_OPERATIONS_NAVIGATION_CATALOG,
  HR_OPERATIONS_WORKBENCH_ID,
} from '../../../shell/navigation-policy/hr-operations-navigation-policy';

import { assertNavigationPolicyReceipt } from './navigation-policy-model';

import type {
  NavigationPolicyAction,
  NavigationPolicyCommandReceipt,
  NavigationPolicyLifecycle,
  NavigationPolicyRevision,
  NavigationPolicyScopeKind,
  NavigationPolicyWorkspace,
} from './navigation-policy-model';
import type {
  HrisNavigationPolicyGroup,
  HrisNavigationRolloutMode,
} from '../../../shell/navigation-policy/hr-operations-navigation-policy';

const LIFECYCLE_STATES = new Set<NavigationPolicyLifecycle>([
  'DRAFT',
  'VALIDATED',
  'PENDING_APPROVAL',
  'APPROVED',
  'PUBLISHED',
]);
const ROLLOUT_MODES = new Set<HrisNavigationRolloutMode>(['OFF', 'SHADOW', 'ENFORCED']);
const SERVER_COMMAND_BY_ACTION: Readonly<Record<NavigationPolicyAction, string>> = {
  CREATE_DRAFT: 'CREATE_DRAFT',
  SAVE_DRAFT: 'UPDATE_DRAFT',
  VALIDATE: 'VALIDATE',
  SUBMIT: 'SUBMIT',
  APPROVE: 'APPROVE',
  PUBLISH: 'PUBLISH',
  RESTORE: 'RESTORE',
};

/**
 * Converts the owner service's compact DTO into the studio projection. Presentation-only labels
 * and routes always come from the locally generated canonical IA and never from server input.
 */
export function selectNavigationPolicyWorkspace(
  value: unknown,
  tenantBaselineValue?: unknown
): NavigationPolicyWorkspace {
  const workspace = record(value, 'Navigation-policy workspace');
  const scopeKind = oneOf(workspace.scopeKind, ['TENANT', 'LEGAL_ENTITY'] as const, 'scope kind');
  const scopePublicId = optionalUuid(workspace.scopePublicId, 'workspace scope');
  if (scopeKind === 'TENANT' && scopePublicId !== null) {
    throw new Error('Tenant navigation-policy workspace must omit scopePublicId.');
  }
  if (scopeKind === 'LEGAL_ENTITY' && scopePublicId === null) {
    throw new Error('Legal-entity navigation-policy workspace requires scopePublicId.');
  }
  if (workspace.workbenchId !== HR_OPERATIONS_WORKBENCH_ID) {
    throw new Error('Navigation-policy workspace workbench is invalid.');
  }

  const draft = optionalRevision(workspace.draft, scopeKind, scopePublicId);
  const published = optionalRevision(workspace.published, scopeKind, scopePublicId);
  if (draft?.status === 'PUBLISHED' || (published && published.status !== 'PUBLISHED')) {
    throw new Error('Navigation-policy workspace lifecycle projection is invalid.');
  }
  const restorableRevisions = array(workspace.restorableRevisions, 'restorable revisions').map(
    (revision) => selectRevision(revision, scopeKind, scopePublicId)
  );
  let tenantBaseline = scopeKind === 'TENANT' ? published : null;
  if (scopeKind === 'LEGAL_ENTITY') {
    const baselineWorkspace = record(tenantBaselineValue, 'Tenant baseline workspace');
    if (
      baselineWorkspace.workbenchId !== HR_OPERATIONS_WORKBENCH_ID ||
      baselineWorkspace.scopeKind !== 'TENANT' ||
      baselineWorkspace.scopePublicId != null
    ) {
      throw new Error('Tenant baseline workspace is invalid.');
    }
    tenantBaseline = optionalRevision(baselineWorkspace.published, 'TENANT', null);
  }

  const revisions = [draft, published, tenantBaseline, ...restorableRevisions].filter(
    (revision): revision is NavigationPolicyRevision => revision !== null
  );
  const asOf =
    revisions
      .map((revision) => revision.updatedAt)
      .sort((left, right) => Date.parse(right) - Date.parse(left))[0] ?? null;
  const empty = draft === null && published === null;
  return Object.freeze({
    projectionVersion: '1',
    asOf,
    queryState: Object.freeze({
      state: empty ? 'EMPTY' : 'COMPLETE',
      freshness: 'CURRENT',
      scopeDecisionRevision: 'owner-current',
      partialFailures: Object.freeze([]),
    }),
    scope: Object.freeze({
      scopeKind,
      scopePublicId,
      displayName: scopeKind === 'TENANT' ? 'Tenant baseline' : `Legal entity ${scopePublicId}`,
    }),
    tenantBaseline,
    activeRevision: published,
    draft: draft
      ? Object.freeze({
          policyId: draft.policyId,
          revisionId: draft.revisionId,
          revision: draft.revision,
          objectVersion: draft.objectVersion,
          status: draft.status,
          scopeKind: draft.scopeKind,
          scopePublicId: draft.scopePublicId,
          legalEntityPublicId: draft.legalEntityPublicId,
          rolloutMode: draft.rolloutMode,
          workbenchId: draft.workbenchId,
          groups: draft.groups,
        })
      : null,
    restorableRevisions: Object.freeze(restorableRevisions),
  });
}

export function selectNavigationPolicyCommandReceipt(
  value: unknown,
  expected: { action: NavigationPolicyAction; requestDigest: string }
): NavigationPolicyCommandReceipt {
  const receipt = record(value, 'Navigation-policy command receipt');
  if (receipt.commandType !== SERVER_COMMAND_BY_ACTION[expected.action]) {
    throw new Error('Navigation-policy receipt does not match the sealed command.');
  }
  const selected = {
    receiptId: receipt.receiptId,
    policyId: receipt.policyId,
    revisionId: receipt.revisionId,
    revision: receipt.revisionNumber,
    objectVersion: receipt.objectVersion,
    lifecycleState: receipt.lifecycleState,
    status: 'SUCCEEDED',
    commandType: expected.action,
    requestDigest: receipt.requestDigest,
    correlationId: receipt.correlationId,
    createdAt: receipt.createdAt,
  };
  return assertNavigationPolicyReceipt(selected, expected);
}

function optionalRevision(
  value: unknown,
  scopeKind: NavigationPolicyScopeKind,
  scopePublicId: string | null
): NavigationPolicyRevision | null {
  return value == null ? null : selectRevision(value, scopeKind, scopePublicId);
}

function selectRevision(
  value: unknown,
  scopeKind: NavigationPolicyScopeKind,
  scopePublicId: string | null
): NavigationPolicyRevision {
  const revision = record(value, 'Navigation-policy revision');
  const policy = record(revision.policy, 'Navigation-policy document');
  const policyScopeKind = oneOf(
    policy.scopeKind,
    ['TENANT', 'LEGAL_ENTITY'] as const,
    'policy scope'
  );
  const legalEntityPublicId = optionalUuid(policy.legalEntityPublicId, 'legal entity');
  if (
    policyScopeKind !== scopeKind ||
    (scopeKind === 'TENANT' && legalEntityPublicId !== null) ||
    (scopeKind === 'LEGAL_ENTITY' && legalEntityPublicId !== scopePublicId)
  ) {
    throw new Error('Navigation-policy revision scope is invalid.');
  }
  const lifecycleState = oneOf(revision.lifecycleState, [...LIFECYCLE_STATES], 'lifecycle state');
  const rolloutMode = oneOf(revision.rolloutMode, [...ROLLOUT_MODES], 'rollout mode');
  if (policy.rolloutMode !== rolloutMode || policy.workbenchId !== HR_OPERATIONS_WORKBENCH_ID) {
    throw new Error('Navigation-policy document identity is invalid.');
  }
  return Object.freeze({
    policyId: uuid(revision.policyId, 'policy'),
    revisionId: uuid(revision.revisionId, 'revision'),
    revision: safeInteger(revision.revisionNumber, 1, 'revision number'),
    objectVersion: safeInteger(revision.objectVersion, 0, 'object version'),
    status: lifecycleState,
    scopeKind,
    scopePublicId,
    legalEntityPublicId,
    rolloutMode,
    workbenchId: HR_OPERATIONS_WORKBENCH_ID,
    groups: selectGroups(policy.groups),
    digest: nonBlank(revision.payloadDigest, 'payload digest'),
    authorPrincipalId: safeInteger(revision.authoredBy, 1, 'author'),
    approvedByPrincipalId:
      revision.approvedBy == null ? null : safeInteger(revision.approvedBy, 1, 'approver'),
    restoredFromRevisionId:
      revision.restoredFromRevisionId == null
        ? null
        : safeInteger(revision.restoredFromRevisionId, 1, 'restored revision'),
    restoredFromDigest:
      revision.restoredFromDigest == null
        ? null
        : nonBlank(revision.restoredFromDigest, 'restored digest'),
    createdAt: instant(revision.createdAt, 'createdAt'),
    updatedAt: instant(revision.updatedAt, 'updatedAt'),
  });
}

function selectGroups(value: unknown): readonly HrisNavigationPolicyGroup[] {
  const rawGroups = array(value, 'policy groups');
  if (rawGroups.length !== HR_OPERATIONS_NAVIGATION_CATALOG.length) {
    throw new Error('Navigation-policy group catalog is incomplete.');
  }
  const rawById = new Map(
    rawGroups.map((value) => {
      const group = record(value, 'policy group');
      return [nonBlank(group.groupId, 'group id'), group] as const;
    })
  );
  if (rawById.size !== rawGroups.length)
    throw new Error('Navigation-policy groups are duplicated.');
  const groups = HR_OPERATIONS_NAVIGATION_CATALOG.map((canonicalGroup) => {
    const source = rawById.get(canonicalGroup.groupId);
    if (!source) throw new Error(`Navigation-policy group is missing: ${canonicalGroup.groupId}`);
    const rawNodes = array(source.nodes, 'policy nodes');
    const nodeById = new Map(
      rawNodes.map((value) => {
        const node = record(value, 'policy node');
        return [nonBlank(node.nodeId, 'node id'), node] as const;
      })
    );
    if (nodeById.size !== rawNodes.length || nodeById.size !== canonicalGroup.nodes.length) {
      throw new Error(`Navigation-policy node catalog is invalid: ${canonicalGroup.groupId}`);
    }
    const nodes = canonicalGroup.nodes.map((canonicalNode) => {
      const sourceNode = nodeById.get(canonicalNode.nodeId);
      if (!sourceNode)
        throw new Error(`Navigation-policy node is missing: ${canonicalNode.nodeId}`);
      return Object.freeze({
        ...canonicalNode,
        displayOrder: safeInteger(sourceNode.displayOrder, 0, 'node display order'),
        enabled: boolean(sourceNode.enabled, 'node enabled'),
      });
    });
    const defaultNodeId = nonBlank(source.defaultNodeId, 'default node');
    if (!nodeById.has(defaultNodeId)) throw new Error('Navigation-policy default node is invalid.');
    return Object.freeze({
      ...canonicalGroup,
      displayOrder: safeInteger(source.displayOrder, 0, 'group display order'),
      enabled: boolean(source.enabled, 'group enabled'),
      defaultNodeId,
      nodes: Object.freeze(nodes),
    });
  });
  return Object.freeze(groups.sort((left, right) => left.displayOrder - right.displayOrder));
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} is invalid.`);
  }
  return value as Record<string, unknown>;
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} is invalid.`);
  return value;
}

function nonBlank(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is invalid.`);
  return value;
}

function uuid(value: unknown, label: string): string {
  const candidate = nonBlank(value, label);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(candidate)
  ) {
    throw new Error(`${label} is invalid.`);
  }
  return candidate;
}

function optionalUuid(value: unknown, label: string): string | null {
  return value == null ? null : uuid(value, label);
}

function safeInteger(value: unknown, minimum: number, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${label} is invalid.`);
  }
  return value;
}

function boolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${label} is invalid.`);
  return value;
}

function instant(value: unknown, label: string): string {
  const candidate = nonBlank(value, label);
  if (!Number.isFinite(Date.parse(candidate))) throw new Error(`${label} is invalid.`);
  return candidate;
}

function oneOf<const Value extends string>(
  value: unknown,
  allowed: readonly Value[],
  label: string
): Value {
  if (typeof value !== 'string' || !allowed.includes(value as Value)) {
    throw new Error(`${label} is invalid.`);
  }
  return value as Value;
}
