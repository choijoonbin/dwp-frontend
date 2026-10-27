import {
  HRIS_NAVIGATION_TOPOLOGY_SUCCESSOR_REVISION,
  HRIS_NAVIGATION_TOPOLOGY_SUCCESSOR_SHA256,
} from '../model/hris-navigation-topology-successor';
import {
  PRODUCT_AUTHORIZATION_PAGE_PROJECTIONS,
  PRODUCT_AUTHORIZATION_REGISTRY_REVISION,
} from '../../../../routes/product-surface-authorization.generated';
import {
  canonicalHrisWorkbench,
  HRIS_V46_SELF_POLICY_ROUTE_BINDINGS,
  HRIS_V52_PAGE_AUTHORITY_ROUTE_BINDINGS,
  HRIS_WORKBENCH_IDS,
  hrisV46SelfPolicyRouteBinding,
  hrisV52PageAuthorityRouteBinding,
  isHrisRuntimeEffectiveRouteAlias,
  isHrisRuntimeMenuRouteAlias,
} from './seven-workbench-navigation-policy';
import {
  assertIncreasingOrder,
  boundedOpaque,
  instant,
  integer,
  nonBlank,
  normalizePath,
  oneOf,
  optionalInteger,
  optionalNavigationRevisionPin,
  optionalString,
  optionalUuid,
  patternedOpaque,
  record,
  requiredUuid,
} from './hris-navigation-policy-runtime-values';

import type {
  HrisTaskNavigationGroup,
  HrisTaskNavigationWorkbench,
  HrisWorkbenchId,
} from './seven-workbench-navigation-policy';

export const HRIS_NAVIGATION_POLICY_V2_RUNTIME_PATH =
  '/api/platform/v2/hris/navigation/projection' as const;
export const HRIS_NAVIGATION_POLICY_V3_RUNTIME_PATH =
  '/api/platform/v3/hris/navigation/projection' as const;
/** Compatibility export retained for consumers that still identify the V2 carrier explicitly. */
export const HRIS_NAVIGATION_POLICY_RUNTIME_PATH = HRIS_NAVIGATION_POLICY_V2_RUNTIME_PATH;
export const HRIS_NAVIGATION_SCOPE_PARAM = 'navigationScope' as const;
export const HRIS_NAVIGATION_TOPOLOGY_REVISION = HRIS_NAVIGATION_TOPOLOGY_SUCCESSOR_REVISION;
export const HRIS_NAVIGATION_TOPOLOGY_SHA256 = HRIS_NAVIGATION_TOPOLOGY_SUCCESSOR_SHA256;
export const HRIS_NAVIGATION_IA_REGISTER_SHA256 =
  'ab506a2bb2f80c8ab81a4b9d575374d6bda83b312d11dce07495d4812bdf4686' as const;
export const HRIS_NAVIGATION_SHELL_REGISTER_SHA256 =
  'f85ee40a66ce4100c5578fd3ca96bc89b652b0762e19d74cc7aeb76338009000' as const;
export const HRIS_NAVIGATION_TASK_GROUP_REGISTER_SHA256 =
  'f0b1ebb316e4d5944aac90002e144f25d8c1318216b6733e674cdc8c5042872b' as const;
export const HRIS_NAVIGATION_GENERATED_IA_SHA256 =
  '584cc32f845720ad06fb1bdcea7c967026c0e3a648f70e0215fd8a95a6b055bd' as const;
export const HRIS_NAVIGATION_AUTHORIZATION_REGISTRY_VERSION = 47 as const;
export const HRIS_NAVIGATION_AUTHORIZATION_REGISTRY_SHA256 =
  '925e8bfc406bc7e4ee62aee08582fdd7c67c629ffde470051704eaec5404800e' as const;
export const HRIS_NAVIGATION_RUNTIME_OWNER_OVERLAY_REVISION =
  'R6C_RUNTIME_OWNER_OVERLAY_V1' as const;
export const HRIS_NAVIGATION_RUNTIME_OWNER_OVERLAY_SHA256 =
  '42ed206e45fab76f77725ba5d37543e06b8df62da7aa142bb620b032bf552dbd' as const;

function includesAuthorizationRegistryRevision(
  current: Readonly<{ version: number; checksum: string }>,
  required: Readonly<{ version: number; checksum: string }>
) {
  return (
    current.version > required.version ||
    (current.version === required.version && current.checksum === required.checksum)
  );
}

export function currentHrisV52PageAuthorityRouteBinding(nodeId: string, route: string) {
  const binding = hrisV52PageAuthorityRouteBinding(nodeId, route);
  const expectedRouteId =
    binding?.routeContractKey === 'route.hcm.personal.requests.page'
      ? 'hcm.personal.requests'
      : binding?.routeContractKey === 'route.hcm.operations.certificates-documents.page'
        ? 'hcm.operations.certificates-documents'
        : undefined;
  const exactProjection = binding
    ? PRODUCT_AUTHORIZATION_PAGE_PROJECTIONS.filter(
        (projection) => projection.routeContractKey === binding.routeContractKey
      )
    : [];
  if (
    !binding ||
    !includesAuthorizationRegistryRevision(PRODUCT_AUTHORIZATION_REGISTRY_REVISION, {
      version: binding.minimumBundleVersion,
      checksum: binding.authorizationRegistryChecksum,
    }) ||
    binding.authorizationRegistryChecksum !==
      'b33fbf968e71f97b09fa497fdfad7d2f6854199170b79fd1602a0ea604977346' ||
    exactProjection.length !== 1 ||
    exactProjection[0]?.routeKind !== 'PAGE' ||
    exactProjection[0]?.subjectType !== 'PRODUCT' ||
    exactProjection[0]?.productId !== 'hcm' ||
    exactProjection[0]?.navigationContextId !== binding.surfaceId ||
    exactProjection[0]?.surfaceId !== binding.surfaceId ||
    exactProjection[0]?.routeId !== expectedRouteId ||
    exactProjection[0]?.pattern !== binding.path
  ) {
    return undefined;
  }
  return binding;
}

type RuntimeNavigationPolicyProjectionBase = Readonly<{
  topologyRevision: typeof HRIS_NAVIGATION_TOPOLOGY_REVISION;
  topologySha256: typeof HRIS_NAVIGATION_TOPOLOGY_SHA256;
  iaRegisterSha256: typeof HRIS_NAVIGATION_IA_REGISTER_SHA256;
  shellRegisterSha256: typeof HRIS_NAVIGATION_SHELL_REGISTER_SHA256;
  taskGroupRegisterSha256: typeof HRIS_NAVIGATION_TASK_GROUP_REGISTER_SHA256;
  generatedIaSha256: typeof HRIS_NAVIGATION_GENERATED_IA_SHA256;
  enforcementState:
    | 'NOT_ENROLLED'
    | 'OFF'
    | 'SHADOW'
    | 'ENFORCED'
    | 'DENIED_MISSING_POLICY'
    | 'DENIED_STALE_CONTEXT';
  policyEnforced: boolean;
  tenantPolicyId: string | null;
  tenantRevisionId: string | null;
  tenantRevisionNumber: number | null;
  legalEntityRevisionId: string | null;
  legalEntityRevisionNumber: number | null;
  revisionPin: string | null;
  workbenches: readonly HrisRuntimeNavigationWorkbench[];
  denialReason: string | null;
  evaluatedAt: string;
}>;

export type RuntimeNavigationPolicyProjectionV2 = RuntimeNavigationPolicyProjectionBase &
  Readonly<{ schemaVersion: '2' }>;

export type HrisRuntimeAdmittedPolicyRoute = Readonly<{
  nodeId: string;
  path: string;
  routeContractKey: string;
  profileKey: 'full-work';
  targetBinding: 'SELF';
  scopeBinding: Readonly<{
    kind: 'SELF';
    key: string;
    personPublicId: string;
  }>;
  decision: 'ALLOWED';
  routeGrantRef: string;
  decisionRevision: string;
  authRevision: string;
  policyRevision: string;
  relationshipRevision: string;
  freshUntil: string;
}>;

export type HrisRuntimeOwnerOverlayRecord = Readonly<{
  nodeId: string;
  historicalOwner: string;
  effectiveRuntimeOwner: string;
  canonicalPath: string;
  compatibilityPath: string | null;
  routeContractKey: string;
  firstReadBinding: Readonly<{
    method: string;
    gatewayPath: string;
    serviceKey: string;
    servicePath: string;
  }>;
  registryVersion: typeof HRIS_NAVIGATION_AUTHORIZATION_REGISTRY_VERSION;
  registryChecksum: typeof HRIS_NAVIGATION_AUTHORIZATION_REGISTRY_SHA256;
  evidenceDigest: string;
}>;

export const HRIS_NAVIGATION_RUNTIME_OWNER_OVERLAY_RECORDS: readonly HrisRuntimeOwnerOverlayRecord[] =
  Object.freeze([
    Object.freeze({
      nodeId: 'BASE:team-time',
      historicalOwner: 'HRIS-TIM',
      effectiveRuntimeOwner: 'dwp-people-server',
      canonicalPath: '/hr/team/time',
      compatibilityPath: null,
      routeContractKey: 'route.hcm.team.time.page',
      firstReadBinding: Object.freeze({
        method: 'GET',
        gatewayPath: '/api/people/v1/hr/team/time',
        serviceKey: 'people',
        servicePath: '/v1/hr/team/time',
      }),
      registryVersion: HRIS_NAVIGATION_AUTHORIZATION_REGISTRY_VERSION,
      registryChecksum: HRIS_NAVIGATION_AUTHORIZATION_REGISTRY_SHA256,
      evidenceDigest: '2ee4cff60ee78cb7ac5d034ea7af0bc7b1782969250e05a2de9fd977e6c8dd48',
    }),
    Object.freeze({
      nodeId: 'BASE:team-leave',
      historicalOwner: 'HRIS-TIM',
      effectiveRuntimeOwner: 'dwp-people-server',
      canonicalPath: '/hr/team/leave',
      compatibilityPath: '/hr/team/absence',
      routeContractKey: 'route.hcm.team.leave.page',
      firstReadBinding: Object.freeze({
        method: 'GET',
        gatewayPath: '/api/people/v1/hr/team/absence',
        serviceKey: 'people',
        servicePath: '/v1/hr/team/absence',
      }),
      registryVersion: HRIS_NAVIGATION_AUTHORIZATION_REGISTRY_VERSION,
      registryChecksum: HRIS_NAVIGATION_AUTHORIZATION_REGISTRY_SHA256,
      evidenceDigest: '71897471bbd7cd0ae24a881c282d92f2c110a0f0ea2ace0cb4596179c474a968',
    }),
    Object.freeze({
      nodeId: 'BASE:time-leave-operations',
      historicalOwner: 'HRIS-TIM',
      effectiveRuntimeOwner: 'dwp-people-server',
      canonicalPath: '/hr/operations/time/leave-operations',
      compatibilityPath: '/hr/operations/absence',
      routeContractKey: 'route.hcm.operations.time-leave-operations.page',
      firstReadBinding: Object.freeze({
        method: 'GET',
        gatewayPath: '/api/people/v1/hr/operations/{domain=ABSENCE}',
        serviceKey: 'people',
        servicePath: '/v1/hr/operations/{domain=ABSENCE}',
      }),
      registryVersion: HRIS_NAVIGATION_AUTHORIZATION_REGISTRY_VERSION,
      registryChecksum: HRIS_NAVIGATION_AUTHORIZATION_REGISTRY_SHA256,
      evidenceDigest: '8bac591712bd9a57a1b8a8269a6ffc5f7d626efef85f2c0bb6be8334b663cb88',
    }),
    Object.freeze({
      nodeId: 'BASE:hr-operations-home',
      historicalOwner: 'HRIS-PLATFORM',
      effectiveRuntimeOwner: 'dwp-people-server',
      canonicalPath: '/hr/operations/home',
      compatibilityPath: '/hr/operations',
      routeContractKey: 'route.hcm.operations.home.page',
      firstReadBinding: Object.freeze({
        method: 'GET',
        gatewayPath: '/api/people/v1/workforce/operations/overview',
        serviceKey: 'people',
        servicePath: '/v1/workforce/operations/overview',
      }),
      registryVersion: HRIS_NAVIGATION_AUTHORIZATION_REGISTRY_VERSION,
      registryChecksum: HRIS_NAVIGATION_AUTHORIZATION_REGISTRY_SHA256,
      evidenceDigest: '9fa6f38cc9a465a0c41ba72335089040a4cb6714950310efa2213727ac2a92f5',
    }),
  ]);

export type RuntimeNavigationPolicyProjectionV3 = RuntimeNavigationPolicyProjectionBase &
  Readonly<{
    schemaVersion: '3';
    authorizationRegistryVersion: typeof HRIS_NAVIGATION_AUTHORIZATION_REGISTRY_VERSION;
    authorizationRegistryChecksum: typeof HRIS_NAVIGATION_AUTHORIZATION_REGISTRY_SHA256;
    runtimeOwnerOverlayRevision: typeof HRIS_NAVIGATION_RUNTIME_OWNER_OVERLAY_REVISION;
    runtimeOwnerOverlayChecksum: typeof HRIS_NAVIGATION_RUNTIME_OWNER_OVERLAY_SHA256;
    runtimeOwnerOverlayRecords: readonly HrisRuntimeOwnerOverlayRecord[];
    authorityDecisionCount: 0 | 6;
    navigationContextScopeKey: string;
    authoritySelfScopeKey: string | null;
    authoritySnapshotRevision: string | null;
    authorityDecisionRevision: string | null;
    authorityAuthRevision: string | null;
    authorityPolicyRevision: string | null;
    authorityRelationshipRevision: string | null;
    authorityFreshUntil: string | null;
    admittedPolicyRoutes: readonly HrisRuntimeAdmittedPolicyRoute[];
  }>;

export type RuntimeNavigationPolicyProjection =
  RuntimeNavigationPolicyProjectionV2 | RuntimeNavigationPolicyProjectionV3;

export type HrisRuntimeNavigationWorkbench = Omit<HrisTaskNavigationWorkbench, 'defaultNodeId'> &
  Readonly<{ landingNodeId: string }>;

export type HrisRuntimeNavigationPolicy = Readonly<{
  mode: 'STATIC' | 'ENFORCED' | 'FAIL_CLOSED';
  schemaVersion: '2' | '3' | null;
  revisionPin: string;
  authorityFreshUntil: string | null;
  workbenches: readonly HrisRuntimeNavigationWorkbench[];
  orderedNodeIds: readonly string[];
  denialReason: string | null;
}>;

export type HrisRuntimeNavigationResolution = Readonly<{
  decision: 'ALLOW' | 'DENY';
  revisionPin: string;
  workbenchId: HrisWorkbenchId | null;
  nodeId: string | null;
  route: string | null;
}>;

export function selectRuntimeHrisNavigationPolicyProjection(
  value: unknown
): RuntimeNavigationPolicyProjection {
  const projection = record(value, 'runtime projection');
  const schemaVersion = oneOf(projection.schemaVersion, ['2', '3'] as const, 'projection schema');
  if (
    projection.topologyRevision !== HRIS_NAVIGATION_TOPOLOGY_REVISION ||
    projection.topologySha256 !== HRIS_NAVIGATION_TOPOLOGY_SHA256 ||
    projection.iaRegisterSha256 !== HRIS_NAVIGATION_IA_REGISTER_SHA256 ||
    projection.shellRegisterSha256 !== HRIS_NAVIGATION_SHELL_REGISTER_SHA256 ||
    projection.taskGroupRegisterSha256 !== HRIS_NAVIGATION_TASK_GROUP_REGISTER_SHA256 ||
    projection.generatedIaSha256 !== HRIS_NAVIGATION_GENERATED_IA_SHA256
  ) {
    throw new Error('HRIS navigation projection topology is invalid.');
  }
  const enforcementState = oneOf(
    projection.enforcementState,
    [
      'NOT_ENROLLED',
      'OFF',
      'SHADOW',
      'ENFORCED',
      'DENIED_MISSING_POLICY',
      'DENIED_STALE_CONTEXT',
    ] as const,
    'enforcement state'
  );
  if (typeof projection.policyEnforced !== 'boolean') {
    throw new Error('HRIS navigation projection enforcement marker is invalid.');
  }
  const evaluatedAt = instant(projection.evaluatedAt);
  const v3Authority =
    schemaVersion === '3'
      ? selectV3AuthorityCarrier(projection, enforcementState, evaluatedAt)
      : null;
  const admittedPolicyRoutes =
    v3Authority?.admittedPolicyRoutes ?? Object.freeze([] as HrisRuntimeAdmittedPolicyRoute[]);
  const workbenches = selectEffectiveWorkbenches(
    projection.workbenches,
    admittedPolicyRoutes,
    schemaVersion
  );
  if (schemaVersion === '3') {
    assertAdmittedPolicyRoutesConsumed(workbenches, admittedPolicyRoutes);
  }
  const common = {
    topologyRevision: HRIS_NAVIGATION_TOPOLOGY_REVISION,
    topologySha256: HRIS_NAVIGATION_TOPOLOGY_SHA256,
    iaRegisterSha256: HRIS_NAVIGATION_IA_REGISTER_SHA256,
    shellRegisterSha256: HRIS_NAVIGATION_SHELL_REGISTER_SHA256,
    taskGroupRegisterSha256: HRIS_NAVIGATION_TASK_GROUP_REGISTER_SHA256,
    generatedIaSha256: HRIS_NAVIGATION_GENERATED_IA_SHA256,
    enforcementState,
    policyEnforced: projection.policyEnforced,
    tenantPolicyId: optionalUuid(projection.tenantPolicyId),
    tenantRevisionId: optionalUuid(projection.tenantRevisionId),
    tenantRevisionNumber: optionalInteger(projection.tenantRevisionNumber),
    legalEntityRevisionId: optionalUuid(projection.legalEntityRevisionId),
    legalEntityRevisionNumber: optionalInteger(projection.legalEntityRevisionNumber),
    revisionPin: optionalNavigationRevisionPin(projection.revisionPin, schemaVersion),
    workbenches,
    denialReason: optionalString(projection.denialReason),
    evaluatedAt,
  } as const;
  const selected = Object.freeze(
    schemaVersion === '2'
      ? { schemaVersion, ...common }
      : {
          schemaVersion,
          ...common,
          ...v3Authority!,
        }
  ) as RuntimeNavigationPolicyProjection;
  assertRuntimeProjectionState(selected);
  return selected;
}

function selectEffectiveWorkbenches(
  value: unknown,
  admittedPolicyRoutes: readonly HrisRuntimeAdmittedPolicyRoute[],
  schemaVersion: RuntimeNavigationPolicyProjection['schemaVersion']
): readonly HrisRuntimeNavigationWorkbench[] {
  if (!Array.isArray(value)) throw new Error('HRIS navigation projection workbenches are invalid.');
  const seenWorkbenches = new Set<string>();
  const seenNodes = new Set<string>();
  const workbenches = value.map((candidate) => {
    const source = record(candidate, 'effective workbench');
    const workbenchId = oneOf(source.workbenchId, HRIS_WORKBENCH_IDS, 'effective workbench id');
    const canonical = canonicalHrisWorkbench(workbenchId)!;
    if (seenWorkbenches.has(workbenchId)) {
      throw new Error('Effective policy workbench is duplicated.');
    }
    seenWorkbenches.add(workbenchId);
    const groups = selectEffectiveGroups(
      source.groups,
      canonical,
      seenNodes,
      admittedPolicyRoutes,
      schemaVersion
    );
    const landingNodeId = nonBlank(source.landingNodeId, 'effective landing node');
    if (!groups.flatMap((group) => group.nodes).some((node) => node.nodeId === landingNodeId)) {
      throw new Error('Effective policy landing node is invalid.');
    }
    const displayOrder = integer(source.displayOrder, 0);
    if (displayOrder !== canonical.displayOrder) {
      throw new Error('Effective policy workbench order is invalid.');
    }
    return Object.freeze({
      ...canonical,
      displayOrder,
      landingNodeId,
      groups,
    });
  });
  assertIncreasingOrder(workbenches, 'workbench');
  return Object.freeze(workbenches);
}

function selectEffectiveGroups(
  value: unknown,
  canonicalWorkbench: HrisTaskNavigationWorkbench,
  seenNodes: Set<string>,
  admittedPolicyRoutes: readonly HrisRuntimeAdmittedPolicyRoute[],
  schemaVersion: RuntimeNavigationPolicyProjection['schemaVersion']
): readonly HrisTaskNavigationGroup[] {
  if (!Array.isArray(value) || !value.length) {
    throw new Error('Effective policy workbench groups are invalid.');
  }
  const seenGroups = new Set<string>();
  const groups = value.map((candidate) => {
    const source = record(candidate, 'effective group');
    const groupId = nonBlank(source.groupId, 'effective group id');
    const canonical = canonicalWorkbench.groups.find((group) => group.groupId === groupId);
    if (!canonical || seenGroups.has(groupId)) {
      throw new Error('Effective policy group is invalid.');
    }
    seenGroups.add(groupId);
    if (!Array.isArray(source.nodes) || !source.nodes.length) {
      throw new Error('Effective policy group nodes are invalid.');
    }
    const nodes = source.nodes.map((candidate) => {
      const node = record(candidate, 'effective node');
      const nodeId = nonBlank(node.nodeId, 'effective node id');
      const canonicalNode = canonical.nodes.find((value) => value.nodeId === nodeId);
      if (!canonicalNode || seenNodes.has(nodeId)) {
        throw new Error('Effective policy node is invalid.');
      }
      seenNodes.add(nodeId);
      const displayOrder = integer(node.displayOrder, 0);
      if (displayOrder !== canonicalNode.displayOrder) {
        throw new Error('Effective policy node order is invalid.');
      }
      const routeAliases = selectEffectiveRouteAliases(
        node.routeAliases,
        canonicalNode,
        admittedPolicyRoutes,
        schemaVersion
      );
      return Object.freeze({ ...canonicalNode, displayOrder, routeAliases });
    });
    const defaultNodeId = nonBlank(source.defaultNodeId, 'effective default node');
    if (!nodes.some((node) => node.nodeId === defaultNodeId)) {
      throw new Error('Effective policy default node is invalid.');
    }
    const displayOrder = integer(source.displayOrder, 0);
    if (displayOrder !== canonical.displayOrder) {
      throw new Error('Effective policy group order is invalid.');
    }
    assertIncreasingOrder(nodes, 'node');
    return Object.freeze({
      ...canonical,
      displayOrder,
      defaultNodeId,
      nodes: Object.freeze(nodes),
    });
  });
  assertIncreasingOrder(groups, 'group');
  return Object.freeze(groups);
}

function selectEffectiveRouteAliases(
  value: unknown,
  canonicalNode: HrisTaskNavigationGroup['nodes'][number],
  admittedPolicyRoutes: readonly HrisRuntimeAdmittedPolicyRoute[],
  schemaVersion: RuntimeNavigationPolicyProjection['schemaVersion']
) {
  if (!Array.isArray(value) || !value.length) {
    throw new Error('Effective policy node route aliases are invalid.');
  }
  const nodePolicyRoutes = admittedPolicyRoutes.filter(
    (route) => route.nodeId === canonicalNode.nodeId
  );
  const policyNode = canonicalNode.routeAliases.some((alias) =>
    hrisV46SelfPolicyRouteBinding(canonicalNode.nodeId, alias)
  );
  const sealedAliases = canonicalNode.routeAliases.filter((alias) => {
    const v52Candidate = HRIS_V52_PAGE_AUTHORITY_ROUTE_BINDINGS.some(
      (binding) => binding.nodeId === canonicalNode.nodeId && binding.path === normalizePath(alias)
    );
    if (v52Candidate) {
      return Boolean(currentHrisV52PageAuthorityRouteBinding(canonicalNode.nodeId, alias));
    }
    if (schemaVersion === '3' && policyNode) {
      return nodePolicyRoutes.some((route) => route.path === normalizePath(alias));
    }
    return isHrisRuntimeEffectiveRouteAlias(alias);
  });
  const sealedOrder = new Map(sealedAliases.map((alias, index) => [alias, index]));
  const seenAliases = new Set<string>();
  let previousOrder = -1;
  const routeAliases = value.map((candidate) => {
    const alias = nonBlank(candidate, 'effective node route alias');
    const displayOrder = sealedOrder.get(alias);
    if (seenAliases.has(alias)) {
      throw new Error('Effective policy node route alias is duplicated.');
    }
    if (displayOrder === undefined || displayOrder <= previousOrder) {
      throw new Error('Effective policy node route alias is not sealed.');
    }
    seenAliases.add(alias);
    previousOrder = displayOrder;
    return alias;
  });
  return Object.freeze(routeAliases);
}

function selectV3AuthorityCarrier(
  projection: Record<string, unknown>,
  enforcementState: RuntimeNavigationPolicyProjectionBase['enforcementState'],
  evaluatedAt: string
) {
  if (
    projection.authorizationRegistryVersion !== HRIS_NAVIGATION_AUTHORIZATION_REGISTRY_VERSION ||
    projection.authorizationRegistryChecksum !== HRIS_NAVIGATION_AUTHORIZATION_REGISTRY_SHA256
  ) {
    throw new Error('HRIS navigation authorization registry is invalid.');
  }
  if (!Array.isArray(projection.admittedPolicyRoutes)) {
    throw new Error('HRIS navigation admitted POLICY routes are invalid.');
  }
  const runtimeOwnerOverlay = selectV3RuntimeOwnerOverlay(projection);
  const navigationContextScopeKey = patternedOpaque(
    projection.navigationContextScopeKey,
    /^hcm-scope-[a-f0-9]{40}$/u,
    'navigation context scope key'
  );

  if (enforcementState !== 'ENFORCED') {
    const authorityValues = [
      projection.authoritySnapshotRevision,
      projection.authorityDecisionRevision,
      projection.authorityAuthRevision,
      projection.authorityPolicyRevision,
      projection.authorityRelationshipRevision,
      projection.authorityFreshUntil,
    ];
    if (
      projection.admittedPolicyRoutes.length !== 0 ||
      projection.authorityDecisionCount !== 0 ||
      (projection.authoritySelfScopeKey !== null &&
        projection.authoritySelfScopeKey !== undefined) ||
      authorityValues.some((value) => value !== null && value !== undefined)
    ) {
      throw new Error('Non-enforced HRIS navigation V3 authority carrier is inconsistent.');
    }
    return Object.freeze({
      authorizationRegistryVersion: HRIS_NAVIGATION_AUTHORIZATION_REGISTRY_VERSION,
      authorizationRegistryChecksum: HRIS_NAVIGATION_AUTHORIZATION_REGISTRY_SHA256,
      ...runtimeOwnerOverlay,
      authorityDecisionCount: 0 as const,
      navigationContextScopeKey,
      authoritySelfScopeKey: null,
      authoritySnapshotRevision: null,
      authorityDecisionRevision: null,
      authorityAuthRevision: null,
      authorityPolicyRevision: null,
      authorityRelationshipRevision: null,
      authorityFreshUntil: null,
      admittedPolicyRoutes: Object.freeze([] as HrisRuntimeAdmittedPolicyRoute[]),
    });
  }

  if (projection.authorityDecisionCount !== 6) {
    throw new Error('HRIS navigation authority decision count is invalid.');
  }
  const authoritySelfScopeKey = patternedOpaque(
    projection.authoritySelfScopeKey,
    /^scope-[a-f0-9]{32}$/u,
    'authority SELF scope key'
  );
  const authoritySnapshotRevision = boundedOpaque(
    projection.authoritySnapshotRevision,
    'authority snapshot revision'
  );
  const authorityDecisionRevision = boundedOpaque(
    projection.authorityDecisionRevision,
    'authority decision revision'
  );
  const authorityAuthRevision = boundedOpaque(
    projection.authorityAuthRevision,
    'authority auth revision'
  );
  const authorityPolicyRevision = boundedOpaque(
    projection.authorityPolicyRevision,
    'authority policy revision'
  );
  const authorityRelationshipRevision = boundedOpaque(
    projection.authorityRelationshipRevision,
    'authority relationship revision'
  );
  const authorityFreshUntil = instant(projection.authorityFreshUntil);
  if (Date.parse(authorityFreshUntil) <= Date.parse(evaluatedAt)) {
    throw new Error('HRIS navigation authority freshness is invalid.');
  }
  const admittedPolicyRoutes = selectAdmittedPolicyRoutes(projection.admittedPolicyRoutes, {
    authorityDecisionRevision,
    authorityAuthRevision,
    authorityPolicyRevision,
    authorityRelationshipRevision,
    authorityFreshUntil,
    authoritySelfScopeKey,
  });
  return Object.freeze({
    authorizationRegistryVersion: HRIS_NAVIGATION_AUTHORIZATION_REGISTRY_VERSION,
    authorizationRegistryChecksum: HRIS_NAVIGATION_AUTHORIZATION_REGISTRY_SHA256,
    ...runtimeOwnerOverlay,
    authorityDecisionCount: 6 as const,
    navigationContextScopeKey,
    authoritySelfScopeKey,
    authoritySnapshotRevision,
    authorityDecisionRevision,
    authorityAuthRevision,
    authorityPolicyRevision,
    authorityRelationshipRevision,
    authorityFreshUntil,
    admittedPolicyRoutes,
  });
}

function selectV3RuntimeOwnerOverlay(projection: Record<string, unknown>) {
  if (
    projection.runtimeOwnerOverlayRevision !== HRIS_NAVIGATION_RUNTIME_OWNER_OVERLAY_REVISION ||
    projection.runtimeOwnerOverlayChecksum !== HRIS_NAVIGATION_RUNTIME_OWNER_OVERLAY_SHA256 ||
    !Array.isArray(projection.runtimeOwnerOverlayRecords) ||
    projection.runtimeOwnerOverlayRecords.length !==
      HRIS_NAVIGATION_RUNTIME_OWNER_OVERLAY_RECORDS.length
  ) {
    throw new Error('HRIS navigation runtime owner overlay is invalid.');
  }
  const runtimeOwnerOverlayRecords = projection.runtimeOwnerOverlayRecords.map(
    (candidate, index) => {
      const source = record(candidate, 'runtime owner overlay record');
      const firstRead = record(source.firstReadBinding, 'runtime owner overlay first-read binding');
      const selected: HrisRuntimeOwnerOverlayRecord = Object.freeze({
        nodeId: nonBlank(source.nodeId, 'runtime owner overlay node'),
        historicalOwner: nonBlank(source.historicalOwner, 'runtime owner overlay historical owner'),
        effectiveRuntimeOwner: nonBlank(
          source.effectiveRuntimeOwner,
          'runtime owner overlay effective owner'
        ),
        canonicalPath: nonBlank(source.canonicalPath, 'runtime owner overlay canonical path'),
        compatibilityPath: optionalString(source.compatibilityPath),
        routeContractKey: nonBlank(source.routeContractKey, 'runtime owner overlay route contract'),
        firstReadBinding: Object.freeze({
          method: nonBlank(firstRead.method, 'runtime owner overlay first-read method'),
          gatewayPath: nonBlank(
            firstRead.gatewayPath,
            'runtime owner overlay first-read gateway path'
          ),
          serviceKey: nonBlank(
            firstRead.serviceKey,
            'runtime owner overlay first-read service key'
          ),
          servicePath: nonBlank(
            firstRead.servicePath,
            'runtime owner overlay first-read service path'
          ),
        }),
        registryVersion: integer(source.registryVersion, 1) as 47,
        registryChecksum: nonBlank(
          source.registryChecksum,
          'runtime owner overlay registry checksum'
        ) as typeof HRIS_NAVIGATION_AUTHORIZATION_REGISTRY_SHA256,
        evidenceDigest: patternedOpaque(
          source.evidenceDigest,
          /^[a-f0-9]{64}$/u,
          'runtime owner overlay evidence digest'
        ),
      });
      const expected = HRIS_NAVIGATION_RUNTIME_OWNER_OVERLAY_RECORDS[index];
      if (!expected || !sameRuntimeOwnerOverlayRecord(selected, expected)) {
        throw new Error('HRIS navigation runtime owner overlay record is not sealed.');
      }
      return selected;
    }
  );
  return Object.freeze({
    runtimeOwnerOverlayRevision: HRIS_NAVIGATION_RUNTIME_OWNER_OVERLAY_REVISION,
    runtimeOwnerOverlayChecksum: HRIS_NAVIGATION_RUNTIME_OWNER_OVERLAY_SHA256,
    runtimeOwnerOverlayRecords: Object.freeze(runtimeOwnerOverlayRecords),
  });
}

function sameRuntimeOwnerOverlayRecord(
  left: HrisRuntimeOwnerOverlayRecord,
  right: HrisRuntimeOwnerOverlayRecord
) {
  return (
    left.nodeId === right.nodeId &&
    left.historicalOwner === right.historicalOwner &&
    left.effectiveRuntimeOwner === right.effectiveRuntimeOwner &&
    left.canonicalPath === right.canonicalPath &&
    left.compatibilityPath === right.compatibilityPath &&
    left.routeContractKey === right.routeContractKey &&
    left.firstReadBinding.method === right.firstReadBinding.method &&
    left.firstReadBinding.gatewayPath === right.firstReadBinding.gatewayPath &&
    left.firstReadBinding.serviceKey === right.firstReadBinding.serviceKey &&
    left.firstReadBinding.servicePath === right.firstReadBinding.servicePath &&
    left.registryVersion === right.registryVersion &&
    left.registryChecksum === right.registryChecksum &&
    left.evidenceDigest === right.evidenceDigest
  );
}

function selectAdmittedPolicyRoutes(
  value: readonly unknown[],
  authority: Readonly<{
    authorityDecisionRevision: string;
    authorityAuthRevision: string;
    authorityPolicyRevision: string;
    authorityRelationshipRevision: string;
    authorityFreshUntil: string;
    authoritySelfScopeKey: string;
  }>
) {
  const seenNodes = new Set<string>();
  const seenPaths = new Set<string>();
  let previousOrder = -1;
  const routes = value.map((candidate) => {
    const source = record(candidate, 'admitted POLICY route');
    const nodeId = nonBlank(source.nodeId, 'admitted POLICY node id');
    const path = nonBlank(source.path, 'admitted POLICY path');
    const binding = hrisV46SelfPolicyRouteBinding(nodeId, path);
    const displayOrder = HRIS_V46_SELF_POLICY_ROUTE_BINDINGS.findIndex(
      (candidateBinding) =>
        candidateBinding.nodeId === nodeId && candidateBinding.path === normalizePath(path)
    );
    if (!binding || displayOrder <= previousOrder || path !== normalizePath(path)) {
      throw new Error('Admitted POLICY route is not sealed.');
    }
    if (seenNodes.has(nodeId) || seenPaths.has(path)) {
      throw new Error('Admitted POLICY route is duplicated.');
    }
    if (
      source.routeContractKey !== binding.routeContractKey ||
      source.profileKey !== binding.profileKey ||
      source.targetBinding !== binding.targetBinding ||
      source.decision !== 'ALLOWED' ||
      source.decisionRevision !== authority.authorityDecisionRevision ||
      source.authRevision !== authority.authorityAuthRevision ||
      source.policyRevision !== authority.authorityPolicyRevision ||
      source.relationshipRevision !== authority.authorityRelationshipRevision ||
      source.freshUntil !== authority.authorityFreshUntil
    ) {
      throw new Error('Admitted POLICY route authority binding is invalid.');
    }
    const routeGrantRef = patternedOpaque(
      source.routeGrantRef,
      /^grant-[a-f0-9]{32}$/u,
      'admitted POLICY route grant ref'
    );
    const scopeBinding = record(source.scopeBinding, 'admitted POLICY scope binding');
    if (scopeBinding.kind !== binding.scopeBindingKind) {
      throw new Error('Admitted POLICY route scope binding is invalid.');
    }
    const selectedScopeBinding = Object.freeze({
      kind: 'SELF' as const,
      key: patternedOpaque(scopeBinding.key, /^scope-[a-f0-9]{32}$/u, 'admitted POLICY scope key'),
      personPublicId: requiredUuid(scopeBinding.personPublicId, 'admitted POLICY person public id'),
    });
    if (selectedScopeBinding.key !== authority.authoritySelfScopeKey) {
      throw new Error('Admitted POLICY route SELF scope is inconsistent.');
    }
    seenNodes.add(nodeId);
    seenPaths.add(path);
    previousOrder = displayOrder;
    return Object.freeze({
      nodeId,
      path,
      routeContractKey: binding.routeContractKey,
      profileKey: binding.profileKey,
      targetBinding: binding.targetBinding,
      scopeBinding: selectedScopeBinding,
      decision: 'ALLOWED' as const,
      routeGrantRef,
      decisionRevision: authority.authorityDecisionRevision,
      authRevision: authority.authorityAuthRevision,
      policyRevision: authority.authorityPolicyRevision,
      relationshipRevision: authority.authorityRelationshipRevision,
      freshUntil: authority.authorityFreshUntil,
    });
  });
  return Object.freeze(routes);
}

function assertAdmittedPolicyRoutesConsumed(
  workbenches: readonly HrisRuntimeNavigationWorkbench[],
  admittedPolicyRoutes: readonly HrisRuntimeAdmittedPolicyRoute[]
) {
  const consumed = new Set(
    workbenches.flatMap((workbench) =>
      workbench.groups.flatMap((group) =>
        group.nodes.flatMap((node) =>
          node.routeAliases.flatMap((route) =>
            hrisV46SelfPolicyRouteBinding(node.nodeId, route)
              ? [`${node.nodeId}\u0000${normalizePath(route)}`]
              : []
          )
        )
      )
    )
  );
  const admitted = new Set(
    admittedPolicyRoutes.map((route) => `${route.nodeId}\u0000${route.path}`)
  );
  if (
    consumed.size !== admitted.size ||
    [...admitted].some((routeKey) => !consumed.has(routeKey))
  ) {
    throw new Error('Effective POLICY aliases and admitted decisions are inconsistent.');
  }
}

export function isRuntimeEffectiveRouteAlias(
  schemaVersion: HrisRuntimeNavigationPolicy['schemaVersion'],
  nodeId: string,
  route: string
) {
  const v52Candidate = HRIS_V52_PAGE_AUTHORITY_ROUTE_BINDINGS.some(
    (binding) => binding.nodeId === nodeId && binding.path === normalizePath(route)
  );
  if (v52Candidate) return Boolean(currentHrisV52PageAuthorityRouteBinding(nodeId, route));
  const policyNode = HRIS_V46_SELF_POLICY_ROUTE_BINDINGS.some(
    (binding) => binding.nodeId === nodeId
  );
  if (schemaVersion === '3' && policyNode) {
    return Boolean(hrisV46SelfPolicyRouteBinding(nodeId, route));
  }
  return isHrisRuntimeEffectiveRouteAlias(route);
}

export function isRuntimeMenuRouteAlias(
  schemaVersion: HrisRuntimeNavigationPolicy['schemaVersion'],
  nodeId: string,
  route: string
) {
  if (!isRuntimeEffectiveRouteAlias(schemaVersion, nodeId, route)) return false;
  if (
    hrisV46SelfPolicyRouteBinding(nodeId, route) ||
    currentHrisV52PageAuthorityRouteBinding(nodeId, route)
  ) {
    return true;
  }
  return isHrisRuntimeMenuRouteAlias(route);
}

export function assertRuntimeProjectionState(projection: RuntimeNavigationPolicyProjection) {
  if (['NOT_ENROLLED', 'OFF', 'SHADOW'].includes(projection.enforcementState)) {
    if (projection.policyEnforced) {
      throw new Error('Non-enforced navigation projection state is inconsistent.');
    }
    return;
  }
  if (projection.enforcementState === 'ENFORCED') {
    if (
      !projection.policyEnforced ||
      !projection.revisionPin ||
      projection.workbenches.length === 0
    ) {
      throw new Error('Enforced navigation projection state is inconsistent.');
    }
    return;
  }
  if (
    !projection.policyEnforced ||
    projection.workbenches.length !== 0 ||
    projection.revisionPin !== null ||
    !projection.denialReason
  ) {
    throw new Error('Denied navigation projection state is inconsistent.');
  }
}
