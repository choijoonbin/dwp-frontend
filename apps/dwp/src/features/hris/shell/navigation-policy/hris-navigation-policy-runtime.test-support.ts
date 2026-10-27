import {
  HRIS_NAVIGATION_AUTHORIZATION_REGISTRY_SHA256,
  HRIS_NAVIGATION_AUTHORIZATION_REGISTRY_VERSION,
  HRIS_NAVIGATION_GENERATED_IA_SHA256,
  HRIS_NAVIGATION_IA_REGISTER_SHA256,
  HRIS_NAVIGATION_SHELL_REGISTER_SHA256,
  HRIS_NAVIGATION_TASK_GROUP_REGISTER_SHA256,
  HRIS_NAVIGATION_TOPOLOGY_REVISION,
  HRIS_NAVIGATION_TOPOLOGY_SHA256,
  HRIS_NAVIGATION_RUNTIME_OWNER_OVERLAY_RECORDS,
  HRIS_NAVIGATION_RUNTIME_OWNER_OVERLAY_REVISION,
  HRIS_NAVIGATION_RUNTIME_OWNER_OVERLAY_SHA256,
  selectHrisRuntimeNavigationPolicy,
  selectRuntimeHrisNavigationPolicyProjection,
} from './hris-navigation-policy-runtime';

import {
  canonicalHrisWorkbench,
  HRIS_SEVEN_WORKBENCH_NAVIGATION_CATALOG,
  HRIS_V46_SELF_POLICY_ROUTE_BINDINGS,
  isHrisRuntimeEffectiveRouteAlias,
} from './seven-workbench-navigation-policy';

import type { HrisWorkbenchId } from './seven-workbench-navigation-policy';

export function enforcedPolicy(workbenches: readonly Record<string, unknown>[]) {
  return selectHrisRuntimeNavigationPolicy(
    selectRuntimeHrisNavigationPolicyProjection(
      projection('ENFORCED', {
        policyEnforced: true,
        revisionPin: revisionPin('c'),
        workbenches,
      })
    )
  );
}

export function effectiveWorkbench(
  workbenchId: HrisWorkbenchId,
  nodeIds: readonly string[],
  landingNodeId = nodeIds[0]!
) {
  const canonical = canonicalHrisWorkbench(workbenchId)!;
  const selected = new Set(nodeIds);
  const groups = canonical.groups.flatMap((group) => {
    const nodes = group.nodes
      .filter((node) => selected.has(node.nodeId))
      .map((node) => ({
        nodeId: node.nodeId,
        displayOrder: node.displayOrder,
        routeAliases: node.routeAliases.filter(isHrisRuntimeEffectiveRouteAlias),
      }));
    return nodes.length
      ? [
          {
            groupId: group.groupId,
            displayOrder: group.displayOrder,
            defaultNodeId: nodes[0]!.nodeId,
            nodes,
          },
        ]
      : [];
  });
  return {
    workbenchId,
    displayOrder: canonical.displayOrder,
    landingNodeId,
    groups,
  };
}

export function canonicalNode(nodeId: string) {
  return HRIS_SEVEN_WORKBENCH_NAVIGATION_CATALOG.flatMap((workbench) => workbench.groups)
    .flatMap((group) => group.nodes)
    .find((node) => node.nodeId === nodeId)!;
}

export function withNodeRouteAliases(
  workbench: ReturnType<typeof effectiveWorkbench>,
  nodeId: string,
  routeAliases: unknown
) {
  return {
    ...workbench,
    groups: workbench.groups.map((group) => ({
      ...group,
      nodes: group.nodes.map((node) => (node.nodeId === nodeId ? { ...node, routeAliases } : node)),
    })),
  };
}

export function projection(
  enforcementState:
    | 'NOT_ENROLLED'
    | 'OFF'
    | 'SHADOW'
    | 'ENFORCED'
    | 'DENIED_MISSING_POLICY'
    | 'DENIED_STALE_CONTEXT',
  overrides: Record<string, unknown> = {}
) {
  return {
    schemaVersion: '2',
    topologyRevision: HRIS_NAVIGATION_TOPOLOGY_REVISION,
    topologySha256: HRIS_NAVIGATION_TOPOLOGY_SHA256,
    iaRegisterSha256: HRIS_NAVIGATION_IA_REGISTER_SHA256,
    shellRegisterSha256: HRIS_NAVIGATION_SHELL_REGISTER_SHA256,
    taskGroupRegisterSha256: HRIS_NAVIGATION_TASK_GROUP_REGISTER_SHA256,
    generatedIaSha256: HRIS_NAVIGATION_GENERATED_IA_SHA256,
    enforcementState,
    policyEnforced: false,
    tenantPolicyId: null,
    tenantRevisionId: null,
    tenantRevisionNumber: null,
    legalEntityRevisionId: null,
    legalEntityRevisionNumber: null,
    revisionPin: null,
    workbenches: [],
    denialReason: null,
    evaluatedAt: '2026-10-17T04:00:00Z',
    ...overrides,
  };
}

export function projectionV3(
  enforcementState:
    | 'NOT_ENROLLED'
    | 'OFF'
    | 'SHADOW'
    | 'ENFORCED'
    | 'DENIED_MISSING_POLICY'
    | 'DENIED_STALE_CONTEXT',
  overrides: Record<string, unknown> = {}
) {
  const enforced = enforcementState === 'ENFORCED';
  return {
    ...projection(enforcementState),
    schemaVersion: '3',
    authorizationRegistryVersion: HRIS_NAVIGATION_AUTHORIZATION_REGISTRY_VERSION,
    authorizationRegistryChecksum: HRIS_NAVIGATION_AUTHORIZATION_REGISTRY_SHA256,
    runtimeOwnerOverlayRevision: HRIS_NAVIGATION_RUNTIME_OWNER_OVERLAY_REVISION,
    runtimeOwnerOverlayChecksum: HRIS_NAVIGATION_RUNTIME_OWNER_OVERLAY_SHA256,
    runtimeOwnerOverlayRecords: HRIS_NAVIGATION_RUNTIME_OWNER_OVERLAY_RECORDS.map((record) => ({
      ...record,
      firstReadBinding: { ...record.firstReadBinding },
    })),
    authorityDecisionCount: enforced ? 6 : 0,
    navigationContextScopeKey: `hcm-scope-${'1'.repeat(40)}`,
    authoritySelfScopeKey: enforced ? `scope-${'7'.repeat(32)}` : null,
    authoritySnapshotRevision: enforced ? 'snapshot-1' : null,
    authorityDecisionRevision: enforced ? 'decision-1' : null,
    authorityAuthRevision: enforced ? 'auth-1' : null,
    authorityPolicyRevision: enforced ? 'policy-1' : null,
    authorityRelationshipRevision: enforced ? 'relationship-1' : null,
    authorityFreshUntil: enforced ? '2099-01-01T00:00:00.000Z' : null,
    admittedPolicyRoutes: [],
    ...overrides,
  };
}

export function admittedPolicyRoute(binding: (typeof HRIS_V46_SELF_POLICY_ROUTE_BINDINGS)[number]) {
  return {
    nodeId: binding.nodeId,
    path: binding.path,
    routeContractKey: binding.routeContractKey,
    profileKey: binding.profileKey,
    targetBinding: binding.targetBinding,
    scopeBinding: {
      kind: binding.scopeBindingKind,
      key: `scope-${'7'.repeat(32)}`,
      personPublicId: '6d07e952-2f5f-4dc1-8be7-6d7e210d23af',
    },
    decision: 'ALLOWED',
    routeGrantRef: `grant-${'8'.repeat(32)}`,
    decisionRevision: 'decision-1',
    authRevision: 'auth-1',
    policyRevision: 'policy-1',
    relationshipRevision: 'relationship-1',
    freshUntil: '2099-01-01T00:00:00.000Z',
  };
}

export function effectiveV3SelfWorkbench(
  nodeIds = HRIS_V46_SELF_POLICY_ROUTE_BINDINGS.map((binding) => binding.nodeId)
) {
  const routeByNode = new Map(
    HRIS_V46_SELF_POLICY_ROUTE_BINDINGS.map((binding) => [binding.nodeId, binding.path])
  );
  const source = effectiveWorkbench('HRIS-WB-MY-HR', nodeIds);
  return {
    ...source,
    groups: source.groups.map((group) => ({
      ...group,
      nodes: group.nodes.map((node) => ({
        ...node,
        routeAliases: [routeByNode.get(node.nodeId)!],
      })),
    })),
  };
}

export function revisionPin(versionOrSeed: '2' | '3' | string, maybeSeed?: string) {
  const version = maybeSeed ? versionOrSeed : '2';
  const seed = maybeSeed ?? versionOrSeed;
  return `nav-v${version}-${seed.repeat(64)}`;
}
