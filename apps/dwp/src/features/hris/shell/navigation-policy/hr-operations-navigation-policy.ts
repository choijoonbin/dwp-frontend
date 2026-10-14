import {
  HRIS_IA_CONTRACT_NODES,
  HRIS_IA_CONTRACT_TASK_GROUPS,
} from '../model/hris-information-architecture.generated';

export const HR_OPERATIONS_WORKBENCH_ID = 'HRIS-WB-HR-OPERATIONS' as const;

export type HrisNavigationRolloutMode = 'OFF' | 'SHADOW' | 'ENFORCED';

export type HrisNavigationPolicyNode = Readonly<{
  nodeId: string;
  label: string;
  route: string;
  displayOrder: number;
  enabled: boolean;
}>;

export type HrisNavigationPolicyGroup = Readonly<{
  groupId: string;
  label: string;
  displayOrder: number;
  enabled: boolean;
  defaultNodeId: string;
  nodes: readonly HrisNavigationPolicyNode[];
}>;

export type HrisNavigationPolicyLayer = Readonly<{
  revisionId: string;
  revision: number;
  digest: string;
  groups: readonly HrisNavigationPolicyGroup[];
}>;

export type HrisNavigationPolicyProjection = Readonly<{
  state: 'READY' | 'FAIL_CLOSED';
  workbenchId: typeof HR_OPERATIONS_WORKBENCH_ID;
  rolloutMode: HrisNavigationRolloutMode;
  policyRevisionKey: string;
  authorizationDecisionRevision: string;
  groups: readonly HrisNavigationPolicyGroup[];
  orderedNodeIds: readonly string[];
  landingNodeId: string | null;
  landingRoute: string | null;
  deniedReason?: 'MISSING_ENFORCED_POLICY' | 'STALE_ENFORCED_POLICY' | 'NO_EFFECTIVE_NODE';
}>;

export type HrisNavigationProjectionInput = Readonly<{
  rolloutMode: HrisNavigationRolloutMode;
  enrolled: boolean;
  policyFreshness: 'CURRENT' | 'STALE' | 'MISSING';
  canonicalDeployedNodeIds: ReadonlySet<string>;
  installedEligibleNodeIds: ReadonlySet<string>;
  pageAuthorizedNodeIds: ReadonlySet<string>;
  tenantBaseline?: HrisNavigationPolicyLayer;
  legalEntityOverlay?: HrisNavigationPolicyLayer;
  authorizationDecisionRevision: string;
}>;

export type HrisNavigationResolution = Readonly<{
  decision: 'ALLOW' | 'DENY';
  policyRevisionKey: string;
  authorizationDecisionRevision: string;
  nodeId: string | null;
  route: string | null;
  reason?: 'POLICY_UNAVAILABLE' | 'NODE_NOT_EFFECTIVE';
}>;

const NODE_LABELS: Readonly<Record<string, string>> = {
  'BASE:hr-operations-home': '운영 현황',
  'BASE:hr-people': '구성원',
  'BASE:hr-employment-assignments': '고용관계·배치',
  'BASE:hr-appointments': '발령',
  'BASE:hr-contracts-compensation-basis': '계약·보상기준',
  'BASE:hr-organization-positions': '조직·포지션',
  'MODERN:hcm.operations.workforce-planning': '인력 계획',
  'BASE:hr-employee-change-requests': '직원변경 요청',
  'BASE:hr-certificates-documents': '증명·문서',
  'MODERN:hcm.operations.hr-services': 'HR 서비스',
  'MODERN:hcm.operations.benefits': '복리후생',
  'BASE:hr-exit-return': '퇴직·복직',
  'MODERN:hcm.operations.onboarding': '온보딩',
  'MODERN:hcm.operations.recruiting': '채용',
  'MODERN:hcm.operations.contingent-workforce': '외부인력',
  'BASE:hr-data-quality': '데이터 품질',
  'MODERN:hcm.operations.people-analytics': '인력 분석',
};

type IaNode = (typeof HRIS_IA_CONTRACT_NODES)[number];
type IaTaskGroup = (typeof HRIS_IA_CONTRACT_TASK_GROUPS)[number];

const nodeById = new Map<string, IaNode>(
  HRIS_IA_CONTRACT_NODES.map((node) => [node.iaNodeId, node])
);

function buildCatalog(): readonly HrisNavigationPolicyGroup[] {
  const sourceGroups = HRIS_IA_CONTRACT_TASK_GROUPS.filter(
    (group) => group.workbenchEntryId === HR_OPERATIONS_WORKBENCH_ID
  ).sort((left, right) => left.displayOrder - right.displayOrder);
  const catalog = sourceGroups.map((group) => mapTaskGroup(group));
  const nodeCount = catalog.reduce((count, group) => count + group.nodes.length, 0);
  if (catalog.length !== 7 || nodeCount !== 17) {
    throw new Error('The HR Operations policy catalog must contain exactly 7 groups and 17 nodes.');
  }
  return Object.freeze(catalog);
}

function mapTaskGroup(group: IaTaskGroup): HrisNavigationPolicyGroup {
  const nodes = group.memberIaNodeIds.map((nodeId, displayOrder) => {
    const node = nodeById.get(nodeId);
    if (!node || node.inventoryGroup !== 'HR_OPERATIONS') {
      throw new Error(`Unknown HR Operations IA node: ${nodeId}`);
    }
    return Object.freeze({
      nodeId,
      label: NODE_LABELS[nodeId] ?? node.sourceNodeKey,
      route: node.canonicalRoute,
      displayOrder,
      enabled: true,
    });
  });
  return Object.freeze({
    groupId: group.taskGroupId,
    label: group.contractLabelKo,
    displayOrder: group.displayOrder,
    enabled: true,
    defaultNodeId: group.defaultIaNodeId,
    nodes: Object.freeze(nodes),
  });
}

export const HR_OPERATIONS_NAVIGATION_CATALOG = buildCatalog();
export const HR_OPERATIONS_NODE_IDS: ReadonlySet<string> = new Set(
  HR_OPERATIONS_NAVIGATION_CATALOG.flatMap((group) => group.nodes.map((node) => node.nodeId))
);

/**
 * Computes the only shell-visible menu set. Policy visibility is a restriction and can never
 * manufacture PAGE authority. A legal-entity overlay is intersected with the tenant baseline,
 * so an overlay cannot re-enable a tenant-disabled node.
 */
export function projectHrisNavigationPolicy(
  input: HrisNavigationProjectionInput
): HrisNavigationPolicyProjection {
  if (
    input.enrolled &&
    input.rolloutMode === 'ENFORCED' &&
    (!input.tenantBaseline || input.policyFreshness !== 'CURRENT')
  ) {
    return failClosed(
      input,
      input.policyFreshness === 'STALE' ? 'STALE_ENFORCED_POLICY' : 'MISSING_ENFORCED_POLICY'
    );
  }

  const enforcePolicy = input.enrolled && input.rolloutMode === 'ENFORCED';
  const tenant = enforcePolicy ? input.tenantBaseline : undefined;
  const legal = enforcePolicy ? input.legalEntityOverlay : undefined;
  const tenantEnabled = enabledNodeIds(tenant);
  const legalEnabled = enabledNodeIds(legal);
  const effectiveIds = new Set(
    [...HR_OPERATIONS_NODE_IDS].filter(
      (nodeId) =>
        input.canonicalDeployedNodeIds.has(nodeId) &&
        input.installedEligibleNodeIds.has(nodeId) &&
        (!tenant || tenantEnabled.has(nodeId)) &&
        (!legal || legalEnabled.has(nodeId)) &&
        input.pageAuthorizedNodeIds.has(nodeId)
    )
  );
  const policyOrder = legal ?? tenant;
  const groups = orderedGroups(policyOrder).flatMap((canonicalGroup) => {
    const sourceGroup = policyGroup(policyOrder, canonicalGroup.groupId) ?? canonicalGroup;
    const nodes = orderedNodes(sourceGroup, canonicalGroup)
      .filter((node) => effectiveIds.has(node.nodeId))
      .map((node, displayOrder) => Object.freeze({ ...node, displayOrder, enabled: true }));
    if (!nodes.length) return [];
    const defaultNodeId = nodes.some((node) => node.nodeId === sourceGroup.defaultNodeId)
      ? sourceGroup.defaultNodeId
      : nodes[0].nodeId;
    return [
      Object.freeze({
        ...canonicalGroup,
        displayOrder: 0,
        enabled: true,
        defaultNodeId,
        nodes: Object.freeze(nodes),
      }),
    ];
  });
  const normalizedGroups = groups.map((group, displayOrder) =>
    Object.freeze({ ...group, displayOrder })
  );
  const orderedNodeIds = normalizedGroups.flatMap((group) =>
    group.nodes.map((node) => node.nodeId)
  );
  const preferredDefault = policyOrder
    ? orderedGroups(policyOrder).map((group) => group.defaultNodeId)
    : HR_OPERATIONS_NAVIGATION_CATALOG.map((group) => group.defaultNodeId);
  const landingNodeId =
    preferredDefault.find((nodeId) => effectiveIds.has(nodeId)) ?? orderedNodeIds[0] ?? null;
  const landingRoute = landingNodeId ? (nodeById.get(landingNodeId)?.canonicalRoute ?? null) : null;
  const policyRevisionKey = revisionKey(input, tenant, legal);
  if (!landingNodeId || !landingRoute) {
    return {
      state: 'FAIL_CLOSED',
      workbenchId: HR_OPERATIONS_WORKBENCH_ID,
      rolloutMode: input.rolloutMode,
      policyRevisionKey,
      authorizationDecisionRevision: input.authorizationDecisionRevision,
      groups: Object.freeze([]),
      orderedNodeIds: Object.freeze([]),
      landingNodeId: null,
      landingRoute: null,
      deniedReason: 'NO_EFFECTIVE_NODE',
    };
  }
  return Object.freeze({
    state: 'READY',
    workbenchId: HR_OPERATIONS_WORKBENCH_ID,
    rolloutMode: input.rolloutMode,
    policyRevisionKey,
    authorizationDecisionRevision: input.authorizationDecisionRevision,
    groups: Object.freeze(normalizedGroups),
    orderedNodeIds: Object.freeze(orderedNodeIds),
    landingNodeId,
    landingRoute,
  });
}

export function resolveHrisPolicyLanding(
  projection: HrisNavigationPolicyProjection
): HrisNavigationResolution {
  if (projection.state !== 'READY' || !projection.landingNodeId || !projection.landingRoute) {
    return resolution(projection, 'DENY', null, null, 'POLICY_UNAVAILABLE');
  }
  return resolution(projection, 'ALLOW', projection.landingNodeId, projection.landingRoute);
}

export function resolveHrisPolicyDeepLink(
  projection: HrisNavigationPolicyProjection,
  requestedPath: string
): HrisNavigationResolution {
  if (projection.state !== 'READY') {
    return resolution(projection, 'DENY', null, null, 'POLICY_UNAVAILABLE');
  }
  const path = normalizePath(requestedPath);
  const node = projection.groups
    .flatMap((group) => group.nodes)
    .find((candidate) => normalizePath(candidate.route) === path);
  return node
    ? resolution(projection, 'ALLOW', node.nodeId, node.route)
    : resolution(projection, 'DENY', null, null, 'NODE_NOT_EFFECTIVE');
}

function enabledNodeIds(layer?: HrisNavigationPolicyLayer): ReadonlySet<string> {
  return new Set(
    layer?.groups.flatMap((group) =>
      group.enabled ? group.nodes.filter((node) => node.enabled).map((node) => node.nodeId) : []
    ) ?? []
  );
}

function orderedGroups(layer?: HrisNavigationPolicyLayer) {
  const source = layer?.groups ?? HR_OPERATIONS_NAVIGATION_CATALOG;
  return [...source].filter((group) => group.enabled).sort(byDisplayOrder);
}

function orderedNodes(
  source: HrisNavigationPolicyGroup,
  canonical: HrisNavigationPolicyGroup
): readonly HrisNavigationPolicyNode[] {
  const sourceById = new Map(source.nodes.map((node) => [node.nodeId, node]));
  return [...canonical.nodes]
    .map((node) => sourceById.get(node.nodeId) ?? node)
    .filter((node) => node.enabled)
    .sort(byDisplayOrder);
}

function policyGroup(layer: HrisNavigationPolicyLayer | undefined, groupId: string) {
  return layer?.groups.find((group) => group.groupId === groupId);
}

function byDisplayOrder(left: { displayOrder: number }, right: { displayOrder: number }) {
  return left.displayOrder - right.displayOrder;
}

function revisionKey(
  input: HrisNavigationProjectionInput,
  tenant?: HrisNavigationPolicyLayer,
  legal?: HrisNavigationPolicyLayer
) {
  if (!tenant) return `fallback:${input.authorizationDecisionRevision}`;
  return `${tenant.revisionId}:${tenant.revision}:${legal?.revisionId ?? 'tenant'}:${legal?.revision ?? tenant.revision}`;
}

function failClosed(
  input: HrisNavigationProjectionInput,
  reason: 'MISSING_ENFORCED_POLICY' | 'STALE_ENFORCED_POLICY'
): HrisNavigationPolicyProjection {
  return Object.freeze({
    state: 'FAIL_CLOSED',
    workbenchId: HR_OPERATIONS_WORKBENCH_ID,
    rolloutMode: input.rolloutMode,
    policyRevisionKey: `unavailable:${input.authorizationDecisionRevision}`,
    authorizationDecisionRevision: input.authorizationDecisionRevision,
    groups: Object.freeze([]),
    orderedNodeIds: Object.freeze([]),
    landingNodeId: null,
    landingRoute: null,
    deniedReason: reason,
  });
}

function resolution(
  projection: HrisNavigationPolicyProjection,
  decision: 'ALLOW' | 'DENY',
  nodeId: string | null,
  route: string | null,
  reason?: HrisNavigationResolution['reason']
): HrisNavigationResolution {
  return Object.freeze({
    decision,
    policyRevisionKey: projection.policyRevisionKey,
    authorizationDecisionRevision: projection.authorizationDecisionRevision,
    nodeId,
    route,
    ...(reason ? { reason } : {}),
  });
}

function normalizePath(value: string) {
  const pathname = value.split(/[?#]/, 1)[0] || '/';
  return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
}
