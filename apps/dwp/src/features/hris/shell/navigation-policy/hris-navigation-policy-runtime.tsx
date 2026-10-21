import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { LoadingState } from '@dwp-frontend/design-system';
import { axiosInstance } from '@dwp-frontend/shared-utils';
import { productSurfaceReadScopeConfig } from '@dwp-frontend/shared-utils/api/product-surface-read-scope';
import { useAuth } from '@dwp-frontend/shared-utils/auth/auth-provider';
import { useProductSurfaceAuthority } from '@dwp-frontend/shared-utils/auth/product-surface-context-provider';
import { useLocation, useSearchParams } from 'react-router-dom';

import { ProductSurfaceAccessState } from '../../../../components/product-surface-access-state';
import { useProductAreaAuthorizedNavigationPaths } from '../../../../components/product-area-authorized-navigation-context';
import {
  resolveCanarySurfaceDecision,
  useProductSurfaceCanaryAuthority,
} from '../../../../components/product-surface-canary-runtime';
import { resolveProductSurfaceRequestScope } from '../../../../components/use-product-surface-request-scope';
import {
  groupHrisShellNavigationItems,
  HRIS_SHELL_ENTRIES,
  projectHrisShellNavigation,
  resolveHrisShellSelectedView,
} from '../model/hris-shell-navigation-contract';
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
  hrisWorkbenchIdForView,
  HRIS_SEVEN_WORKBENCH_NAVIGATION_CATALOG,
  HRIS_V46_SELF_POLICY_ROUTE_BINDINGS,
  HRIS_V52_PAGE_AUTHORITY_ROUTE_BINDINGS,
  HRIS_WORKBENCH_IDS,
  HRIS_WORKBENCH_VIEW_BY_ID,
  hrisV46SelfPolicyRouteBinding,
  hrisV52PageAuthorityRouteBinding,
  isHrisRuntimeEffectiveRouteAlias,
  isHrisRuntimeMenuRouteAlias,
} from './seven-workbench-navigation-policy';
import {
  HRIS_LEGAL_ENTITY_SELECTOR_PARAM,
  isHrisLegalEntityPublicId,
  selectHrisLegalEntitySelector,
} from './hris-legal-entity-selector';
import {
  isHrisNavigationPolicyRuntimeEnabled,
  isHrisNavigationPolicyV3RuntimeEnabled,
} from './hris-navigation-policy-feature';

import type { ApiResponse } from '@dwp-frontend/shared-utils';
import type {
  ProductNavigationGroup,
  ProductShellNavigationProjection,
} from '../../../../components/product-manifest';
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
export { HRIS_LEGAL_ENTITY_SELECTOR_PARAM, selectHrisLegalEntitySelector };

function currentHrisV52PageAuthorityRouteBinding(nodeId: string, route: string) {
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
    PRODUCT_AUTHORIZATION_REGISTRY_REVISION.version < binding.minimumBundleVersion ||
    (PRODUCT_AUTHORIZATION_REGISTRY_REVISION.version === binding.minimumBundleVersion &&
      PRODUCT_AUTHORIZATION_REGISTRY_REVISION.checksum !== binding.authorizationRegistryChecksum) ||
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

const STATIC_POLICY: HrisRuntimeNavigationPolicy = Object.freeze({
  mode: 'STATIC',
  schemaVersion: null,
  revisionPin: 'static',
  authorityFreshUntil: null,
  workbenches: Object.freeze([]),
  orderedNodeIds: Object.freeze([]),
  denialReason: null,
});

/**
 * `/hr/manage/system` remains a finite shell compatibility candidate for direct-route selection,
 * but it is not an executable task in the seven-workbench navigation contract. Keeping it out of
 * the static task projection prevents OFF/SHADOW tenants from receiving an empty Settings flyout.
 */
const HRIS_STATIC_SHELL_ONLY_COMPATIBILITY_PATHS: ReadonlySet<string> = new Set([
  '/hr/manage/system',
]);

function failClosedPolicy(revisionPin: string, denialReason: string) {
  return Object.freeze({
    mode: 'FAIL_CLOSED' as const,
    schemaVersion: null,
    revisionPin,
    authorityFreshUntil: null,
    workbenches: Object.freeze([]),
    orderedNodeIds: Object.freeze([]),
    denialReason,
  });
}

const INVALID_SELECTOR_POLICY = failClosedPolicy(
  'invalid-legal-entity-selector',
  'INVALID_LEGAL_ENTITY_SELECTOR'
);
const PROJECTION_PENDING_POLICY = failClosedPolicy(
  'projection-pending',
  'NAVIGATION_PROJECTION_PENDING'
);
const PROJECTION_ERROR_POLICY = failClosedPolicy(
  'projection-unavailable',
  'NAVIGATION_PROJECTION_UNAVAILABLE'
);
const policyContext = createContext<HrisRuntimeNavigationPolicy>(STATIC_POLICY);

export async function readRuntimeNavigationPolicyProjection(input: {
  contextScopeKey: string;
  navigationScope: 'TENANT' | 'LEGAL_ENTITY';
  carrierVersion?: '2' | '3';
  legalEntityPublicId?: string | null;
  correlationId: string;
  signal?: AbortSignal;
}): Promise<RuntimeNavigationPolicyProjection> {
  const carrierVersion = input.carrierVersion ?? '2';
  if (carrierVersion === '3' && input.navigationScope !== 'TENANT') {
    throw new Error('HRIS navigation V3 is restricted to tenant SELF scope.');
  }
  const search = new URLSearchParams();
  search.set(HRIS_NAVIGATION_SCOPE_PARAM, input.navigationScope);
  if (
    input.navigationScope === 'LEGAL_ENTITY' &&
    input.legalEntityPublicId &&
    isHrisLegalEntityPublicId(input.legalEntityPublicId)
  ) {
    search.set(HRIS_LEGAL_ENTITY_SELECTOR_PARAM, input.legalEntityPublicId.toLowerCase());
  } else if (input.navigationScope === 'LEGAL_ENTITY' || input.legalEntityPublicId) {
    throw new Error('HRIS navigation scope selector is invalid.');
  }
  const scoped = productSurfaceReadScopeConfig(input.contextScopeKey, input.signal);
  const suffix = search.size ? `?${search.toString()}` : '';
  const runtimePath =
    carrierVersion === '3'
      ? HRIS_NAVIGATION_POLICY_V3_RUNTIME_PATH
      : HRIS_NAVIGATION_POLICY_V2_RUNTIME_PATH;
  const response = await axiosInstance.get<ApiResponse<unknown>>(`${runtimePath}${suffix}`, {
    ...scoped,
    headers: { 'X-Correlation-ID': input.correlationId },
  });
  const projection = selectRuntimeHrisNavigationPolicyProjection(response.data.data);
  if (projection.schemaVersion !== carrierVersion) {
    throw new Error('HRIS navigation projection carrier version is invalid.');
  }
  if (
    projection.schemaVersion === '3' &&
    projection.navigationContextScopeKey !== input.contextScopeKey
  ) {
    throw new Error('HRIS navigation projection context scope is invalid.');
  }
  return projection;
}

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

export function selectHrisRuntimeNavigationPolicy(
  projection: RuntimeNavigationPolicyProjection
): HrisRuntimeNavigationPolicy {
  assertRuntimeProjectionState(projection);
  if (['NOT_ENROLLED', 'OFF', 'SHADOW'].includes(projection.enforcementState)) {
    return STATIC_POLICY;
  }
  if (projection.schemaVersion === '3' && !isFreshAfterNow(projection.authorityFreshUntil)) {
    return failClosedPolicy(
      projection.revisionPin ?? `stale:${projection.evaluatedAt}`,
      'AUTHORITY_DECISION_STALE'
    );
  }
  if (
    projection.enforcementState !== 'ENFORCED' ||
    !projection.policyEnforced ||
    !projection.revisionPin
  ) {
    return failClosedPolicy(
      projection.revisionPin ?? `${projection.enforcementState}:${projection.evaluatedAt}`,
      projection.denialReason ?? projection.enforcementState
    );
  }
  return Object.freeze({
    mode: 'ENFORCED',
    schemaVersion: projection.schemaVersion,
    revisionPin: projection.revisionPin,
    authorityFreshUntil: projection.schemaVersion === '3' ? projection.authorityFreshUntil : null,
    workbenches: projection.workbenches,
    orderedNodeIds: Object.freeze(
      projection.workbenches.flatMap((workbench) =>
        workbench.groups.flatMap((group) => group.nodes.map((node) => node.nodeId))
      )
    ),
    denialReason: projection.workbenches.length ? null : 'NO_EFFECTIVE_WORKBENCH',
  });
}

export function projectHrisWorkbenchTaskNavigation(
  policy: HrisRuntimeNavigationPolicy,
  view: string,
  authorizedPaths: ReadonlySet<string>
): readonly HrisTaskNavigationGroup[] {
  const workbenchId = hrisWorkbenchIdForView(view);
  if (!workbenchId || policy.mode === 'FAIL_CLOSED') return Object.freeze([]);
  const workbench =
    policy.mode === 'STATIC'
      ? canonicalHrisWorkbench(workbenchId)
      : policy.workbenches.find((candidate) => candidate.workbenchId === workbenchId);
  if (!workbench) return Object.freeze([]);
  if (policy.mode === 'ENFORCED' && !isRuntimePolicyFresh(policy)) return Object.freeze([]);
  const normalizedAuthorized = new Set([...authorizedPaths].map(normalizePath));
  return Object.freeze(
    workbench.groups.flatMap((group) => {
      const nodes = group.nodes.flatMap((node) => {
        const authorizedAliases = node.routeAliases.filter(
          (route) =>
            (policy.mode === 'STATIC'
              ? !HRIS_STATIC_SHELL_ONLY_COMPATIBILITY_PATHS.has(normalizePath(route))
              : isRuntimeEffectiveRouteAlias(policy.schemaVersion, node.nodeId, route)) &&
            normalizedAuthorized.has(normalizePath(route))
        );
        const menuTarget =
          policy.mode === 'STATIC'
            ? authorizedAliases[0]
            : (authorizedAliases.find((route) =>
                Boolean(currentHrisV52PageAuthorityRouteBinding(node.nodeId, route))
              ) ??
              authorizedAliases.find((route) =>
                isRuntimeMenuRouteAlias(policy.schemaVersion, node.nodeId, route)
              ));
        const routeAliases = menuTarget
          ? [menuTarget, ...authorizedAliases.filter((route) => route !== menuTarget)]
          : [];
        return routeAliases.length
          ? [Object.freeze({ ...node, routeAliases: Object.freeze(routeAliases) })]
          : [];
      });
      if (!nodes.length) return [];
      const defaultNodeId = nodes.some((node) => node.nodeId === group.defaultNodeId)
        ? group.defaultNodeId
        : nodes[0]!.nodeId;
      return [Object.freeze({ ...group, defaultNodeId, nodes: Object.freeze(nodes) })];
    })
  );
}

export function createHrisPolicyShellNavigationProjection(
  policy: HrisRuntimeNavigationPolicy,
  pinnedAuthorizedPaths?: ReadonlySet<string> | null
): ProductShellNavigationProjection {
  if (policy.mode === 'STATIC') {
    return Object.freeze({
      hideSurfaceNavigation: true,
      project: (authorizedPaths) => projectStaticShell(policy, authorizedPaths),
      resolveSelectedView: resolveHrisShellSelectedView,
    });
  }
  return Object.freeze({
    hideSurfaceNavigation: true,
    project: (authorizedPaths) =>
      projectAggregateShell(policy, pinnedAuthorizedPaths ?? authorizedPaths),
    resolveSelectedView: (pathname) => resolveAggregateSelectedView(policy, pathname),
  });
}

export function resolveHrisRuntimePolicyLanding(
  policy: HrisRuntimeNavigationPolicy,
  workbenchId: HrisWorkbenchId = 'HRIS-WB-HR-OPERATIONS',
  authorizedPaths: ReadonlySet<string> = new Set()
): HrisRuntimeNavigationResolution {
  const workbench = policy.workbenches.find((candidate) => candidate.workbenchId === workbenchId);
  const nodes = workbench
    ? projectHrisWorkbenchTaskNavigation(
        policy,
        HRIS_WORKBENCH_VIEW_BY_ID[workbenchId],
        authorizedPaths
      ).flatMap((group) => group.nodes)
    : [];
  const node = nodes.find((candidate) => candidate.nodeId === workbench?.landingNodeId) ?? nodes[0];
  return policy.mode === 'ENFORCED' && isRuntimePolicyFresh(policy) && workbench && node
    ? resolution(policy, 'ALLOW', workbench.workbenchId, node.nodeId, node.routeAliases[0] ?? null)
    : resolution(policy, 'DENY', workbenchId, null, null);
}

export function resolveHrisRuntimePolicyDeepLink(
  policy: HrisRuntimeNavigationPolicy,
  requestedPath: string,
  authorizedPaths?: ReadonlySet<string> | null
): HrisRuntimeNavigationResolution {
  if (policy.mode === 'STATIC') {
    return resolution(policy, 'ALLOW', null, null, normalizePath(requestedPath));
  }
  const normalizedAuthorized = new Set([...(authorizedPaths ?? [])].map(normalizePath));
  if (!normalizedAuthorized.has(normalizePath(requestedPath))) {
    return resolution(policy, 'DENY', null, null, null);
  }
  const match = effectiveRouteMatches(policy, requestedPath);
  return policy.mode === 'ENFORCED' && isRuntimePolicyFresh(policy) && match.length === 1
    ? resolution(
        policy,
        'ALLOW',
        match[0]!.workbenchId,
        match[0]!.node.nodeId,
        normalizePath(requestedPath)
      )
    : resolution(policy, 'DENY', null, null, null);
}

export function HrisNavigationPolicyRuntimeProvider({ children }: { children: ReactNode }) {
  const runtimeEnabled = isHrisNavigationPolicyRuntimeEnabled();
  const v3RuntimeEnabled = isHrisNavigationPolicyV3RuntimeEnabled();
  const auth = useAuth();
  const productAuthority = useProductSurfaceAuthority();
  const canaryAuthority = useProductSurfaceCanaryAuthority();
  const { pathname } = useLocation();
  const [correlationId] = useState(() => crypto.randomUUID());
  const [searchParams] = useSearchParams();
  const legalEntitySelector = selectHrisLegalEntitySelector(searchParams);
  const navigationScope = legalEntitySelector.state === 'LEGAL_ENTITY' ? 'LEGAL_ENTITY' : 'TENANT';
  const carrierVersion =
    navigationScope === 'TENANT' && v3RuntimeEnabled ? ('3' as const) : ('2' as const);
  const scopeSurface = resolveHrisNavigationProjectionScopeSurface(
    pathname,
    legalEntitySelector.state
  );
  const surfaceDecision = scopeSurface
    ? resolveCanarySurfaceDecision(canaryAuthority, {
        productId: 'hcm',
        surfaceId: scopeSurface,
      })
    : null;
  const requestScope = resolveProductSurfaceRequestScope({
    decision: surfaceDecision?.state === 'allowed' ? surfaceDecision : null,
    snapshot: productAuthority.snapshot,
    tenantId: String(auth.user?.tenantId ?? ''),
    actorId: String(auth.user?.userId ?? ''),
    productKey: 'hcm',
    surfaceKey: scopeSurface ?? 'hcm.utility',
  });
  const authorityPending = Boolean(
    productAuthority.status === 'loading' ||
    canaryAuthority.authorityPending ||
    (scopeSurface && canaryAuthority.pendingSurfaces?.[scopeSurface])
  );
  const query = useQuery({
    queryKey: [
      'hris',
      'navigation-policy',
      `runtime-v${carrierVersion}`,
      navigationScope,
      legalEntitySelector.legalEntityPublicId,
      requestScope.cacheKey,
    ],
    queryFn: ({ signal }) =>
      readRuntimeNavigationPolicyProjection({
        contextScopeKey: requestScope.contextScopeKey!,
        navigationScope,
        carrierVersion,
        legalEntityPublicId: legalEntitySelector.legalEntityPublicId,
        correlationId,
        signal,
      }),
    enabled: shouldReadHrisRuntimeNavigationPolicyProjection({
      runtimeEnabled,
      selectorState: legalEntitySelector.state,
      governed: requestScope.governed,
      requestReady: requestScope.ready && !authorityPending,
      contextScopeKey: requestScope.contextScopeKey,
    }),
    meta: requestScope.queryMeta,
    staleTime: 20_000,
  });
  const policy = useMemo(
    () =>
      resolveHrisRuntimeNavigationPolicyEvidence({
        runtimeEnabled,
        governed: requestScope.governed,
        requestReady: requestScope.ready && !authorityPending,
        selectorState: legalEntitySelector.state,
        queryPending: query.isPending,
        queryError: query.isError,
        projection: query.data,
      }),
    [
      legalEntitySelector.state,
      query.data,
      query.isError,
      query.isPending,
      requestScope.governed,
      requestScope.ready,
      authorityPending,
      runtimeEnabled,
    ]
  );
  return <policyContext.Provider value={policy}>{children}</policyContext.Provider>;
}

export function resolveHrisRuntimeNavigationPolicyEvidence(input: {
  runtimeEnabled: boolean;
  governed: boolean;
  requestReady: boolean;
  selectorState: 'TENANT' | 'LEGAL_ENTITY' | 'INVALID';
  queryPending: boolean;
  queryError: boolean;
  projection?: RuntimeNavigationPolicyProjection;
}): HrisRuntimeNavigationPolicy {
  if (!input.runtimeEnabled) return STATIC_POLICY;
  if (input.selectorState === 'INVALID') return INVALID_SELECTOR_POLICY;
  if (!input.requestReady || input.queryPending) return PROJECTION_PENDING_POLICY;
  if (!input.governed) {
    return failClosedPolicy('scope-ungoverned', 'NAVIGATION_SCOPE_UNGOVERNED');
  }
  if (input.queryError || !input.projection) return PROJECTION_ERROR_POLICY;
  return selectHrisRuntimeNavigationPolicy(input.projection);
}

export function resolveHrisNavigationProjectionScopeSurface(
  _pathname: string,
  selectorState: 'TENANT' | 'LEGAL_ENTITY' | 'INVALID'
): 'hcm.utility' | 'hcm.operations' | null {
  if (selectorState === 'INVALID') return null;
  if (selectorState === 'TENANT') return 'hcm.utility';
  // The aggregate legal-entity projection is owned by the People operations
  // boundary regardless of the currently selected HRIS workbench. Reusing
  // this exact scope keeps one projection/revision pin across surface moves;
  // management scope is reserved for policy authoring and must fail closed.
  return 'hcm.operations';
}

export function shouldReadHrisRuntimeNavigationPolicyProjection(input: {
  runtimeEnabled: boolean;
  selectorState: 'TENANT' | 'LEGAL_ENTITY' | 'INVALID';
  governed: boolean;
  requestReady: boolean;
  contextScopeKey?: string;
}) {
  return (
    input.runtimeEnabled &&
    input.selectorState !== 'INVALID' &&
    input.governed &&
    input.requestReady &&
    Boolean(input.contextScopeKey)
  );
}

export function useHrisNavigationPolicyShellProjection(): ProductShellNavigationProjection {
  const policy = useHrisRuntimeNavigationPolicy();
  const authorizedPaths = useProductAreaAuthorizedNavigationPaths();
  return useMemo(
    () => createHrisPolicyShellNavigationProjection(policy, authorizedPaths),
    [authorizedPaths, policy]
  );
}

export function useHrisRuntimeNavigationPolicy() {
  return useContext(policyContext);
}

export function HrisNavigationPolicyDeepLinkGuard({ children }: { children: ReactNode }) {
  const { t } = useTranslation('hcm');
  const policy = useHrisRuntimeNavigationPolicy();
  const authorizedPaths = useProductAreaAuthorizedNavigationPaths();
  const { pathname } = useLocation();
  if (policy.mode !== 'STATIC' && isRegisteredTaskRoute(pathname)) {
    const decision = resolveHrisRuntimePolicyDeepLink(policy, pathname, authorizedPaths);
    if (decision.decision === 'DENY') {
      if (policy.denialReason === 'NAVIGATION_PROJECTION_PENDING') {
        return (
          <section aria-label={t('navigation.policyStatus')}>
            <LoadingState label={t('navigation.policyLoading')} variant="skeleton" size="page" />
          </section>
        );
      }
      const state =
        policy.denialReason === 'NAVIGATION_PROJECTION_UNAVAILABLE'
          ? 'authority-unavailable'
          : policy.denialReason === 'INVALID_LEGAL_ENTITY_SELECTOR'
            ? 'scope-invalid'
            : 'route-denied';
      return (
        <section aria-label={t('navigation.policyStatus')}>
          <ProductSurfaceAccessState decision={{ state }} />
        </section>
      );
    }
  }
  return children;
}

function projectAggregateShell(
  policy: HrisRuntimeNavigationPolicy,
  authorizedPaths: ReadonlySet<string>
): readonly ProductNavigationGroup[] {
  const normalized = new Set([...authorizedPaths].map(normalizePath));
  const home = projectHrisShellNavigation(
    normalized.has('/hr/home') ? new Set(['/hr/home']) : new Set()
  );
  if (policy.mode !== 'ENFORCED' || !isRuntimePolicyFresh(policy)) return home;
  const items = policy.workbenches.flatMap((workbench) => {
    const view = HRIS_WORKBENCH_VIEW_BY_ID[workbench.workbenchId];
    const groups = projectHrisWorkbenchTaskNavigation(policy, view, normalized);
    const nodes = groups.flatMap((group) => group.nodes);
    if (!nodes.length) return [];
    const landing = nodes.find((node) => node.nodeId === workbench.landingNodeId) ?? nodes[0]!;
    const shellEntry = HRIS_SHELL_ENTRIES.find((entry) => entry.view === view);
    if (!shellEntry) throw new Error(`Missing HRIS shell entry: ${workbench.workbenchId}`);
    return [
      Object.freeze({
        path: landing.routeAliases[0]!,
        view,
        icon: shellEntry.icon,
        activePathPrefixes: Object.freeze(nodes.flatMap((node) => node.routeAliases)),
      }),
    ];
  });
  return Object.freeze([...home, ...groupHrisShellNavigationItems(items)]);
}

function projectStaticShell(
  policy: HrisRuntimeNavigationPolicy,
  authorizedPaths: ReadonlySet<string>
): readonly ProductNavigationGroup[] {
  const groups = projectHrisShellNavigation(authorizedPaths);
  return Object.freeze(
    groups.flatMap((group) => {
      const items = group.items.filter(
        (item) =>
          item.view === 'shell-home' ||
          projectHrisWorkbenchTaskNavigation(policy, item.view, authorizedPaths).length > 0
      );
      return items.length ? [Object.freeze({ ...group, items: Object.freeze(items) })] : [];
    })
  );
}

function resolveAggregateSelectedView(policy: HrisRuntimeNavigationPolicy, pathname: string) {
  const normalized = normalizePath(pathname);
  if (normalized === '/hr/home') return 'shell-home';
  if (policy.mode !== 'ENFORCED' || !isRuntimePolicyFresh(policy)) return undefined;
  const matches = effectiveRouteMatches(policy, normalized);
  const workbenchIds = new Set(matches.map((match) => match.workbenchId));
  return workbenchIds.size === 1 ? HRIS_WORKBENCH_VIEW_BY_ID[[...workbenchIds][0]!] : undefined;
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

function isRuntimeEffectiveRouteAlias(
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

function isRuntimeMenuRouteAlias(
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

function isRuntimePolicyFresh(policy: HrisRuntimeNavigationPolicy) {
  return policy.schemaVersion !== '3' || isFreshAfterNow(policy.authorityFreshUntil);
}

function isFreshAfterNow(value: string | null) {
  return value !== null && Date.parse(value) > Date.now();
}

function effectiveRouteMatches(policy: HrisRuntimeNavigationPolicy, requestedPath: string) {
  const path = normalizePath(requestedPath);
  return policy.workbenches.flatMap((workbench) =>
    workbench.groups.flatMap((group) =>
      group.nodes
        .filter((node) =>
          node.routeAliases.some(
            (route) =>
              isRuntimeEffectiveRouteAlias(policy.schemaVersion, node.nodeId, route) &&
              normalizePath(route) === path
          )
        )
        .map((node) => ({ workbenchId: workbench.workbenchId, node }))
    )
  );
}

function isRegisteredTaskRoute(pathname: string) {
  const path = normalizePath(pathname);
  return HRIS_SEVEN_WORKBENCH_NAVIGATION_CATALOG.some((workbench) =>
    workbench.groups.some((group) =>
      group.nodes.some((node) => node.routeAliases.some((route) => normalizePath(route) === path))
    )
  );
}

function resolution(
  policy: HrisRuntimeNavigationPolicy,
  decision: 'ALLOW' | 'DENY',
  workbenchId: HrisWorkbenchId | null,
  nodeId: string | null,
  route: string | null
): HrisRuntimeNavigationResolution {
  return Object.freeze({
    decision,
    revisionPin: policy.revisionPin,
    workbenchId,
    nodeId,
    route,
  });
}

function assertIncreasingOrder(values: readonly { displayOrder: number }[], label: string) {
  if (
    values.some(
      (value, index) => index > 0 && value.displayOrder <= values[index - 1]!.displayOrder
    )
  ) {
    throw new Error(`Effective policy ${label} sequence is invalid.`);
  }
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} is invalid.`);
  }
  return value as Record<string, unknown>;
}

function nonBlank(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is invalid.`);
  return value;
}

function boundedOpaque(value: unknown, label: string) {
  const candidate = nonBlank(value, label);
  if (candidate !== candidate.trim() || candidate.length > 512 || /[\r\n]/u.test(candidate)) {
    throw new Error(`${label} is invalid.`);
  }
  return candidate;
}

function patternedOpaque(value: unknown, pattern: RegExp, label: string) {
  const candidate = boundedOpaque(value, label);
  if (!pattern.test(candidate)) throw new Error(`${label} is invalid.`);
  return candidate;
}

function optionalString(value: unknown): string | null {
  return value == null ? null : nonBlank(value, 'optional string');
}

function optionalUuid(value: unknown): string | null {
  if (value == null) return null;
  return requiredUuid(value, 'UUID');
}

function requiredUuid(value: unknown, label: string): string {
  const candidate = nonBlank(value, label);
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/iu.test(candidate)) {
    throw new Error(`${label} is invalid.`);
  }
  return candidate;
}

function optionalNavigationRevisionPin(value: unknown, schemaVersion: '2' | '3'): string | null {
  if (value == null) return null;
  const candidate = nonBlank(value, 'navigation revision pin');
  if (!new RegExp(`^nav-v${schemaVersion}-[a-f0-9]{64}$`, 'u').test(candidate)) {
    throw new Error('Navigation revision pin is invalid.');
  }
  return candidate;
}

function assertRuntimeProjectionState(projection: RuntimeNavigationPolicyProjection) {
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

function integer(value: unknown, minimum: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) {
    throw new Error('Integer is invalid.');
  }
  return value;
}

function optionalInteger(value: unknown): number | null {
  return value == null ? null : integer(value, 1);
}

function instant(value: unknown): string {
  const candidate = nonBlank(value, 'instant');
  if (!Number.isFinite(Date.parse(candidate))) throw new Error('Instant is invalid.');
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

function normalizePath(value: string) {
  const pathname = value.split(/[?#]/u, 1)[0] || '/';
  return pathname.length > 1 ? pathname.replace(/\/+$/u, '') : pathname;
}
