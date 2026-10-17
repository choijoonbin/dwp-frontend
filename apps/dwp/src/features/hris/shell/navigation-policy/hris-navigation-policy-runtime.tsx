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
  HRIS_SHELL_ENTRIES,
  projectHrisShellNavigation,
  resolveHrisShellSelectedView,
} from '../model/hris-shell-navigation-contract';
import {
  canonicalHrisWorkbench,
  hrisWorkbenchIdForView,
  HRIS_SEVEN_WORKBENCH_NAVIGATION_CATALOG,
  HRIS_WORKBENCH_IDS,
  HRIS_WORKBENCH_VIEW_BY_ID,
  isHrisRuntimeEffectiveRouteAlias,
} from './seven-workbench-navigation-policy';
import {
  HRIS_LEGAL_ENTITY_SELECTOR_PARAM,
  isHrisLegalEntityPublicId,
  selectHrisLegalEntitySelector,
} from './hris-legal-entity-selector';
import { isHrisNavigationPolicyRuntimeEnabled } from './hris-navigation-policy-feature';

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

export const HRIS_NAVIGATION_POLICY_RUNTIME_PATH =
  '/api/platform/v2/hris/navigation/projection' as const;
export const HRIS_NAVIGATION_SCOPE_PARAM = 'navigationScope' as const;
export const HRIS_NAVIGATION_TOPOLOGY_REVISION = 'HRIS-IA-98-WB7-G46-N97-R5' as const;
// SHA-256 of `topologyRevision|ia|shell|taskGroup|generatedIa|7|46|97` as UTF-8.
export const HRIS_NAVIGATION_TOPOLOGY_SHA256 =
  '4d27b3b8958d591968ed42e7ccd6387664fff66a364adfc83a8a5b7f223a6d8a' as const;
export const HRIS_NAVIGATION_IA_REGISTER_SHA256 =
  'ab506a2bb2f80c8ab81a4b9d575374d6bda83b312d11dce07495d4812bdf4686' as const;
export const HRIS_NAVIGATION_SHELL_REGISTER_SHA256 =
  'f85ee40a66ce4100c5578fd3ca96bc89b652b0762e19d74cc7aeb76338009000' as const;
export const HRIS_NAVIGATION_TASK_GROUP_REGISTER_SHA256 =
  'f0b1ebb316e4d5944aac90002e144f25d8c1318216b6733e674cdc8c5042872b' as const;
export const HRIS_NAVIGATION_GENERATED_IA_SHA256 =
  '584cc32f845720ad06fb1bdcea7c967026c0e3a648f70e0215fd8a95a6b055bd' as const;
export { HRIS_LEGAL_ENTITY_SELECTOR_PARAM, selectHrisLegalEntitySelector };

export type RuntimeNavigationPolicyProjection = Readonly<{
  schemaVersion: '2';
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

export type HrisRuntimeNavigationWorkbench = Omit<HrisTaskNavigationWorkbench, 'defaultNodeId'> &
  Readonly<{ landingNodeId: string }>;

export type HrisRuntimeNavigationPolicy = Readonly<{
  mode: 'STATIC' | 'ENFORCED' | 'FAIL_CLOSED';
  revisionPin: string;
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
  revisionPin: 'static',
  workbenches: Object.freeze([]),
  orderedNodeIds: Object.freeze([]),
  denialReason: null,
});

function failClosedPolicy(revisionPin: string, denialReason: string) {
  return Object.freeze({
    mode: 'FAIL_CLOSED' as const,
    revisionPin,
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
  legalEntityPublicId?: string | null;
  correlationId: string;
  signal?: AbortSignal;
}): Promise<RuntimeNavigationPolicyProjection> {
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
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${HRIS_NAVIGATION_POLICY_RUNTIME_PATH}${suffix}`,
    { ...scoped, headers: { 'X-Correlation-ID': input.correlationId } }
  );
  return selectRuntimeHrisNavigationPolicyProjection(response.data.data);
}

export function selectRuntimeHrisNavigationPolicyProjection(
  value: unknown
): RuntimeNavigationPolicyProjection {
  const projection = record(value, 'runtime projection');
  if (projection.schemaVersion !== '2') {
    throw new Error('HRIS navigation projection schema is invalid.');
  }
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
  const selected = Object.freeze({
    schemaVersion: '2',
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
    revisionPin: optionalNavigationRevisionPin(projection.revisionPin),
    workbenches: selectEffectiveWorkbenches(projection.workbenches),
    denialReason: optionalString(projection.denialReason),
    evaluatedAt: instant(projection.evaluatedAt),
  }) as RuntimeNavigationPolicyProjection;
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
    revisionPin: projection.revisionPin,
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
  if (policy.mode !== 'ENFORCED') return Object.freeze([]);
  const workbenchId = hrisWorkbenchIdForView(view);
  const workbench = policy.workbenches.find((candidate) => candidate.workbenchId === workbenchId);
  if (!workbench) return Object.freeze([]);
  const normalizedAuthorized = new Set([...authorizedPaths].map(normalizePath));
  return Object.freeze(
    workbench.groups.flatMap((group) => {
      const nodes = group.nodes.flatMap((node) => {
        const routeAliases = node.routeAliases.filter(
          (route) =>
            isHrisRuntimeEffectiveRouteAlias(route) &&
            normalizedAuthorized.has(normalizePath(route))
        );
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
      project: projectHrisShellNavigation,
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
  return policy.mode === 'ENFORCED' && workbench && node
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
  return policy.mode === 'ENFORCED' && match.length === 1
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
  const auth = useAuth();
  const productAuthority = useProductSurfaceAuthority();
  const canaryAuthority = useProductSurfaceCanaryAuthority();
  const { pathname } = useLocation();
  const [correlationId] = useState(() => crypto.randomUUID());
  const [searchParams] = useSearchParams();
  const legalEntitySelector = selectHrisLegalEntitySelector(searchParams);
  const navigationScope = legalEntitySelector.state === 'LEGAL_ENTITY' ? 'LEGAL_ENTITY' : 'TENANT';
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
      'runtime-v2',
      navigationScope,
      legalEntitySelector.legalEntityPublicId,
      requestScope.cacheKey,
    ],
    queryFn: ({ signal }) =>
      readRuntimeNavigationPolicyProjection({
        contextScopeKey: requestScope.contextScopeKey!,
        navigationScope,
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
            <LoadingState
              label={t('navigation.policyLoading')}
              variant="skeleton"
              size="page"
            />
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
  if (policy.mode !== 'ENFORCED') return home;
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
  return Object.freeze([
    ...home,
    ...(items.length ? [{ id: 'workbenches', items: Object.freeze(items) }] : []),
  ]);
}

function resolveAggregateSelectedView(policy: HrisRuntimeNavigationPolicy, pathname: string) {
  const normalized = normalizePath(pathname);
  if (normalized === '/hr/home') return 'shell-home';
  if (policy.mode !== 'ENFORCED') return undefined;
  const matches = effectiveRouteMatches(policy, normalized);
  const workbenchIds = new Set(matches.map((match) => match.workbenchId));
  return workbenchIds.size === 1 ? HRIS_WORKBENCH_VIEW_BY_ID[[...workbenchIds][0]!] : undefined;
}

function selectEffectiveWorkbenches(value: unknown): readonly HrisRuntimeNavigationWorkbench[] {
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
    const groups = selectEffectiveGroups(source.groups, canonical, seenNodes);
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
  seenNodes: Set<string>
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
      return Object.freeze({ ...canonicalNode, displayOrder });
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

function effectiveRouteMatches(policy: HrisRuntimeNavigationPolicy, requestedPath: string) {
  const path = normalizePath(requestedPath);
  return policy.workbenches.flatMap((workbench) =>
    workbench.groups.flatMap((group) =>
      group.nodes
        .filter((node) =>
          node.routeAliases.some(
            (route) => isHrisRuntimeEffectiveRouteAlias(route) && normalizePath(route) === path
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

function optionalString(value: unknown): string | null {
  return value == null ? null : nonBlank(value, 'optional string');
}

function optionalUuid(value: unknown): string | null {
  if (value == null) return null;
  const candidate = nonBlank(value, 'UUID');
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/iu.test(candidate)) {
    throw new Error('UUID is invalid.');
  }
  return candidate;
}

function optionalNavigationRevisionPin(value: unknown): string | null {
  if (value == null) return null;
  const candidate = nonBlank(value, 'navigation revision pin');
  if (!/^nav-v2-[a-f0-9]{64}$/u.test(candidate)) {
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
