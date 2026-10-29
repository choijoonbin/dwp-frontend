import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { LoadingState } from '@dwp-frontend/design-system/components/states/state-panels';
import { axiosInstance } from '@dwp-frontend/shared-utils/axios-instance';
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
  canonicalHrisWorkbench,
  hrisWorkbenchIdForView,
  HRIS_SEVEN_WORKBENCH_NAVIGATION_CATALOG,
  HRIS_WORKBENCH_VIEW_BY_ID,
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
import type { HrisTaskNavigationGroup, HrisWorkbenchId } from './seven-workbench-navigation-policy';

import {
  HRIS_NAVIGATION_POLICY_V2_RUNTIME_PATH,
  HRIS_NAVIGATION_POLICY_V3_RUNTIME_PATH,
  HRIS_NAVIGATION_SCOPE_PARAM,
  selectRuntimeHrisNavigationPolicyProjection,
  assertRuntimeProjectionState,
  currentHrisV52PageAuthorityRouteBinding,
  isRuntimeEffectiveRouteAlias,
  isRuntimeMenuRouteAlias,
  type RuntimeNavigationPolicyProjection,
  type HrisRuntimeNavigationPolicy,
  type HrisRuntimeNavigationResolution,
} from './hris-navigation-policy-runtime-contract';
import { isFreshAfterNow, normalizePath } from './hris-navigation-policy-runtime-values';

export {
  HRIS_NAVIGATION_POLICY_V2_RUNTIME_PATH,
  HRIS_NAVIGATION_POLICY_V3_RUNTIME_PATH,
  HRIS_NAVIGATION_POLICY_RUNTIME_PATH,
  HRIS_NAVIGATION_SCOPE_PARAM,
  HRIS_NAVIGATION_TOPOLOGY_REVISION,
  HRIS_NAVIGATION_TOPOLOGY_SHA256,
  HRIS_NAVIGATION_IA_REGISTER_SHA256,
  HRIS_NAVIGATION_SHELL_REGISTER_SHA256,
  HRIS_NAVIGATION_TASK_GROUP_REGISTER_SHA256,
  HRIS_NAVIGATION_GENERATED_IA_SHA256,
  HRIS_NAVIGATION_AUTHORIZATION_REGISTRY_VERSION,
  HRIS_NAVIGATION_AUTHORIZATION_REGISTRY_SHA256,
  HRIS_NAVIGATION_RUNTIME_OWNER_OVERLAY_REVISION,
  HRIS_NAVIGATION_RUNTIME_OWNER_OVERLAY_SHA256,
  HRIS_NAVIGATION_RUNTIME_OWNER_OVERLAY_RECORDS,
  selectRuntimeHrisNavigationPolicyProjection,
} from './hris-navigation-policy-runtime-contract';
export type {
  RuntimeNavigationPolicyProjectionV2,
  HrisRuntimeAdmittedPolicyRoute,
  HrisRuntimeOwnerOverlayRecord,
  RuntimeNavigationPolicyProjectionV3,
  RuntimeNavigationPolicyProjection,
  HrisRuntimeNavigationWorkbench,
  HrisRuntimeNavigationPolicy,
  HrisRuntimeNavigationResolution,
} from './hris-navigation-policy-runtime-contract';
export { HRIS_LEGAL_ENTITY_SELECTOR_PARAM, selectHrisLegalEntitySelector };

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

function isRuntimePolicyFresh(policy: HrisRuntimeNavigationPolicy) {
  return policy.schemaVersion !== '3' || isFreshAfterNow(policy.authorityFreshUntil);
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
