import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LoadingState } from '@dwp-frontend/design-system';
import { axiosInstance } from '@dwp-frontend/shared-utils';
import { productSurfaceReadScopeConfig } from '@dwp-frontend/shared-utils/api/product-surface-read-scope';
import { useLocation, useSearchParams } from 'react-router-dom';

import { ProductSurfaceAccessState } from '../../../../components/product-surface-access-state';
import { useProductSurfaceRequestScope } from '../../../../components/use-product-surface-request-scope';
import {
  HRIS_SHELL_ENTRIES,
  projectHrisShellNavigation,
  resolveHrisShellSelectedView,
} from '../model/hris-shell-navigation-contract';
import {
  HR_OPERATIONS_NAVIGATION_CATALOG,
  HR_OPERATIONS_WORKBENCH_ID,
} from './hr-operations-navigation-policy';
import {
  HRIS_LEGAL_ENTITY_SELECTOR_PARAM,
  selectHrisLegalEntitySelector,
} from './hris-legal-entity-selector';
import { isHrisNavigationPolicyRuntimeEnabled } from './hris-navigation-policy-feature';

import type { ApiResponse } from '@dwp-frontend/shared-utils';
import type { ProductShellNavigationProjection } from '../../../../components/product-manifest';
import type { HrisNavigationPolicyGroup } from './hr-operations-navigation-policy';

export const HRIS_NAVIGATION_POLICY_RUNTIME_PATH =
  '/api/platform/v1/hris/navigation/projection' as const;
export { HRIS_LEGAL_ENTITY_SELECTOR_PARAM, selectHrisLegalEntitySelector };

export type RuntimeNavigationPolicyProjection = Readonly<{
  workbenchId: typeof HR_OPERATIONS_WORKBENCH_ID;
  enforcementState:
    | 'NOT_ENROLLED'
    | 'OFF'
    | 'SHADOW'
    | 'ENFORCED'
    | 'DENIED_MISSING_POLICY'
    | 'DENIED_STALE_CONTEXT';
  policyEnforced: boolean;
  tenantPolicyId: string | null;
  tenantRevisionId: number | null;
  legalEntityRevisionId: number | null;
  revisionPin: string | null;
  groups: readonly HrisNavigationPolicyGroup[];
  denialReason: string | null;
  evaluatedAt: string;
}>;

export type HrisRuntimeNavigationPolicy = Readonly<{
  mode: 'STATIC' | 'ENFORCED' | 'FAIL_CLOSED';
  revisionPin: string;
  groups: readonly HrisNavigationPolicyGroup[];
  orderedNodeIds: readonly string[];
  landingNodeId: string | null;
  landingRoute: string | null;
  denialReason: string | null;
}>;

export type HrisRuntimeNavigationResolution = Readonly<{
  decision: 'ALLOW' | 'DENY';
  revisionPin: string;
  nodeId: string | null;
  route: string | null;
}>;

const STATIC_POLICY: HrisRuntimeNavigationPolicy = Object.freeze({
  mode: 'STATIC',
  revisionPin: 'static',
  groups: Object.freeze([]),
  orderedNodeIds: Object.freeze([]),
  landingNodeId: null,
  landingRoute: null,
  denialReason: null,
});
const INVALID_SELECTOR_POLICY: HrisRuntimeNavigationPolicy = Object.freeze({
  mode: 'FAIL_CLOSED',
  revisionPin: 'invalid-legal-entity-selector',
  groups: Object.freeze([]),
  orderedNodeIds: Object.freeze([]),
  landingNodeId: null,
  landingRoute: null,
  denialReason: 'INVALID_LEGAL_ENTITY_SELECTOR',
});
const PROJECTION_PENDING_POLICY: HrisRuntimeNavigationPolicy = Object.freeze({
  mode: 'FAIL_CLOSED',
  revisionPin: 'projection-pending',
  groups: Object.freeze([]),
  orderedNodeIds: Object.freeze([]),
  landingNodeId: null,
  landingRoute: null,
  denialReason: 'NAVIGATION_PROJECTION_PENDING',
});
const PROJECTION_ERROR_POLICY: HrisRuntimeNavigationPolicy = Object.freeze({
  mode: 'FAIL_CLOSED',
  revisionPin: 'projection-unavailable',
  groups: Object.freeze([]),
  orderedNodeIds: Object.freeze([]),
  landingNodeId: null,
  landingRoute: null,
  denialReason: 'NAVIGATION_PROJECTION_UNAVAILABLE',
});

const policyContext = createContext<HrisRuntimeNavigationPolicy>(STATIC_POLICY);

const NODE_PATH_ALIASES: Readonly<Record<string, readonly string[]>> = Object.freeze({
  'BASE:hr-operations-home': ['/hr/operations'],
  'BASE:hr-people': ['/hr/operations/people'],
  'BASE:hr-employee-change-requests': ['/hr/operations/people/employee-change-requests'],
  'BASE:hr-employment-assignments': [
    '/hr/operations/people/employment-assignments',
    '/hr/operations/assignments',
  ],
  'BASE:hr-organization-positions': ['/hr/design/organization'],
});

const NODE_BY_PATH = new Map(
  Object.entries(NODE_PATH_ALIASES).flatMap(([nodeId, paths]) =>
    paths.map((path) => [path, nodeId] as const)
  )
);

export async function readRuntimeNavigationPolicyProjection(input: {
  contextScopeKey: string;
  legalEntityPublicId?: string | null;
  correlationId: string;
  signal?: AbortSignal;
}): Promise<RuntimeNavigationPolicyProjection> {
  const search = new URLSearchParams({
    workbenchId: HR_OPERATIONS_WORKBENCH_ID,
    // The gateway consumes this browser selector; controller authorization uses gateway-owned
    // trusted context rather than accepting the query value as evidence.
    contextScopeKey: input.contextScopeKey,
  });
  if (input.legalEntityPublicId) {
    search.set(HRIS_LEGAL_ENTITY_SELECTOR_PARAM, input.legalEntityPublicId);
  }
  const scoped = productSurfaceReadScopeConfig(input.contextScopeKey, input.signal);
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${HRIS_NAVIGATION_POLICY_RUNTIME_PATH}?${search.toString()}`,
    { ...scoped, headers: { 'X-Correlation-ID': input.correlationId } }
  );
  return selectRuntimeHrisNavigationPolicyProjection(response.data.data);
}

export function selectRuntimeHrisNavigationPolicyProjection(
  value: unknown
): RuntimeNavigationPolicyProjection {
  const projection = record(value, 'runtime projection');
  if (projection.workbenchId !== HR_OPERATIONS_WORKBENCH_ID) {
    throw new Error('HRIS navigation projection workbench is invalid.');
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
  return Object.freeze({
    workbenchId: HR_OPERATIONS_WORKBENCH_ID,
    enforcementState,
    policyEnforced: projection.policyEnforced,
    tenantPolicyId: optionalUuid(projection.tenantPolicyId),
    tenantRevisionId: optionalInteger(projection.tenantRevisionId),
    legalEntityRevisionId: optionalInteger(projection.legalEntityRevisionId),
    revisionPin: optionalString(projection.revisionPin),
    groups: selectEffectiveGroups(projection.groups),
    denialReason: optionalString(projection.denialReason),
    evaluatedAt: instant(projection.evaluatedAt),
  });
}

export function selectHrisRuntimeNavigationPolicy(
  projection: RuntimeNavigationPolicyProjection
): HrisRuntimeNavigationPolicy {
  if (['NOT_ENROLLED', 'OFF', 'SHADOW'].includes(projection.enforcementState)) {
    return STATIC_POLICY;
  }
  if (
    projection.enforcementState !== 'ENFORCED' ||
    !projection.policyEnforced ||
    !projection.revisionPin
  ) {
    return Object.freeze({
      mode: 'FAIL_CLOSED',
      revisionPin:
        projection.revisionPin ?? `${projection.enforcementState}:${projection.evaluatedAt}`,
      groups: Object.freeze([]),
      orderedNodeIds: Object.freeze([]),
      landingNodeId: null,
      landingRoute: null,
      denialReason: projection.denialReason ?? projection.enforcementState,
    });
  }
  const orderedNodeIds = projection.groups.flatMap((group) =>
    group.nodes.map((node) => node.nodeId)
  );
  const landingNodeId =
    projection.groups
      .map((group) => group.defaultNodeId)
      .find((nodeId) => orderedNodeIds.includes(nodeId)) ??
    orderedNodeIds[0] ??
    null;
  const landingRoute = landingNodeId ? (canonicalNode(landingNodeId)?.route ?? null) : null;
  return Object.freeze({
    mode: orderedNodeIds.length && landingRoute ? 'ENFORCED' : 'FAIL_CLOSED',
    revisionPin: projection.revisionPin,
    groups: projection.groups,
    orderedNodeIds: Object.freeze(orderedNodeIds),
    landingNodeId,
    landingRoute,
    denialReason: orderedNodeIds.length ? null : 'NO_EFFECTIVE_NODE',
  });
}

export function createHrisPolicyShellNavigationProjection(
  policy: HrisRuntimeNavigationPolicy
): ProductShellNavigationProjection {
  if (policy.mode === 'STATIC') {
    return Object.freeze({
      hideSurfaceNavigation: true,
      project: projectHrisShellNavigation,
      resolveSelectedView: resolveHrisShellSelectedView,
    });
  }
  const hrOperationsCandidates: readonly string[] =
    HRIS_SHELL_ENTRIES.find((entry) => entry.view === 'workbench-hr-operations')?.candidates ?? [];
  const allowedPaths = new Set(
    policy.orderedNodeIds.flatMap((nodeId) => NODE_PATH_ALIASES[nodeId] ?? [])
  );
  return Object.freeze({
    hideSurfaceNavigation: true,
    project: (authorizedPaths) => {
      const restricted = new Set(
        [...authorizedPaths].filter(
          (path) => !hrOperationsCandidates.includes(path) || allowedPaths.has(path)
        )
      );
      return projectHrisShellNavigation(restricted);
    },
    resolveSelectedView: (pathname) => {
      const normalized = normalizePath(pathname);
      const nodeId = NODE_BY_PATH.get(normalized);
      if (nodeId && !policy.orderedNodeIds.includes(nodeId)) return undefined;
      return resolveHrisShellSelectedView(normalized);
    },
  });
}

export function resolveHrisRuntimePolicyLanding(
  policy: HrisRuntimeNavigationPolicy
): HrisRuntimeNavigationResolution {
  return policy.mode === 'ENFORCED' && policy.landingNodeId && policy.landingRoute
    ? resolution(policy, 'ALLOW', policy.landingNodeId, policy.landingRoute)
    : resolution(policy, 'DENY', null, null);
}

export function resolveHrisRuntimePolicyDeepLink(
  policy: HrisRuntimeNavigationPolicy,
  requestedPath: string
): HrisRuntimeNavigationResolution {
  if (policy.mode === 'STATIC')
    return resolution(policy, 'ALLOW', null, normalizePath(requestedPath));
  const normalized = normalizePath(requestedPath);
  const nodeId = NODE_BY_PATH.get(normalized) ?? canonicalNodeByRoute(normalized)?.nodeId;
  return policy.mode === 'ENFORCED' && nodeId && policy.orderedNodeIds.includes(nodeId)
    ? resolution(policy, 'ALLOW', nodeId, normalized)
    : resolution(policy, 'DENY', null, null);
}

export function HrisNavigationPolicyRuntimeProvider({ children }: { children: ReactNode }) {
  const runtimeEnabled = isHrisNavigationPolicyRuntimeEnabled();
  const requestScope = useProductSurfaceRequestScope({
    productKey: 'hcm',
    surfaceKey: 'hcm.operations',
  });
  const [correlationId] = useState(() => crypto.randomUUID());
  const [searchParams] = useSearchParams();
  const legalEntitySelector = selectHrisLegalEntitySelector(searchParams);
  const query = useQuery({
    queryKey: [
      'hris',
      'navigation-policy',
      'runtime',
      legalEntitySelector.legalEntityPublicId,
      requestScope.cacheKey,
    ],
    queryFn: ({ signal }) =>
      readRuntimeNavigationPolicyProjection({
        contextScopeKey: requestScope.contextScopeKey!,
        legalEntityPublicId: legalEntitySelector.legalEntityPublicId,
        correlationId,
        signal,
      }),
    enabled: shouldReadHrisRuntimeNavigationPolicyProjection({
      runtimeEnabled,
      selectorState: legalEntitySelector.state,
      governed: requestScope.governed,
      requestReady: requestScope.ready,
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
        requestReady: requestScope.ready,
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
      runtimeEnabled,
    ]
  );
  return <policyContext.Provider value={policy}>{children}</policyContext.Provider>;
}

export function resolveHrisRuntimeNavigationPolicyEvidence(
  input: Readonly<{
    runtimeEnabled: boolean;
    governed: boolean;
    requestReady: boolean;
    selectorState: 'TENANT' | 'LEGAL_ENTITY' | 'INVALID';
    queryPending: boolean;
    queryError: boolean;
    projection?: RuntimeNavigationPolicyProjection;
  }>
): HrisRuntimeNavigationPolicy {
  if (!input.runtimeEnabled) return STATIC_POLICY;
  if (input.selectorState === 'INVALID') return INVALID_SELECTOR_POLICY;
  if (!input.governed) return STATIC_POLICY;
  if (!input.requestReady || input.queryPending) return PROJECTION_PENDING_POLICY;
  if (input.queryError || !input.projection) return PROJECTION_ERROR_POLICY;
  return selectHrisRuntimeNavigationPolicy(input.projection);
}

export function shouldReadHrisRuntimeNavigationPolicyProjection(
  input: Readonly<{
    runtimeEnabled: boolean;
    selectorState: 'TENANT' | 'LEGAL_ENTITY' | 'INVALID';
    governed: boolean;
    requestReady: boolean;
    contextScopeKey?: string;
  }>
) {
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
  return useMemo(() => createHrisPolicyShellNavigationProjection(policy), [policy]);
}

export function useHrisRuntimeNavigationPolicy() {
  return useContext(policyContext);
}

export function HrisNavigationPolicyDeepLinkGuard({ children }: { children: ReactNode }) {
  const policy = useHrisRuntimeNavigationPolicy();
  const { pathname } = useLocation();
  const normalizedPath = normalizePath(pathname);
  if (
    policy.mode !== 'STATIC' &&
    (NODE_BY_PATH.has(normalizedPath) || Boolean(canonicalNodeByRoute(normalizedPath)))
  ) {
    const decision = resolveHrisRuntimePolicyDeepLink(policy, pathname);
    if (decision.decision === 'DENY') {
      if (policy.denialReason === 'NAVIGATION_PROJECTION_PENDING') {
        return (
          <main id="dwp-main-content" tabIndex={-1} style={{ outline: 'none' }}>
            <LoadingState
              label="Verifying the effective HR Operations navigation policy"
              variant="skeleton"
              size="page"
            />
          </main>
        );
      }
      const state =
        policy.denialReason === 'NAVIGATION_PROJECTION_UNAVAILABLE'
          ? 'authority-unavailable'
          : policy.denialReason === 'INVALID_LEGAL_ENTITY_SELECTOR'
            ? 'scope-invalid'
            : 'route-denied';
      return <ProductSurfaceAccessState decision={{ state }} pageLevel />;
    }
  }
  return children;
}

function selectEffectiveGroups(value: unknown): readonly HrisNavigationPolicyGroup[] {
  if (!Array.isArray(value)) throw new Error('HRIS navigation projection groups are invalid.');
  const seenGroups = new Set<string>();
  const seenNodes = new Set<string>();
  const groups = value.map((candidate) => {
    const source = record(candidate, 'effective group');
    const groupId = nonBlank(source.groupId, 'effective group id');
    const canonical = HR_OPERATIONS_NAVIGATION_CATALOG.find((group) => group.groupId === groupId);
    if (!canonical || seenGroups.has(groupId))
      throw new Error('Effective policy group is invalid.');
    seenGroups.add(groupId);
    if (!Array.isArray(source.nodes) || source.nodes.length === 0) {
      throw new Error('Effective policy group nodes are invalid.');
    }
    const nodes = source.nodes.map((candidate) => {
      const node = record(candidate, 'effective node');
      const nodeId = nonBlank(node.nodeId, 'effective node id');
      const canonicalNode = canonical.nodes.find((value) => value.nodeId === nodeId);
      if (!canonicalNode || seenNodes.has(nodeId))
        throw new Error('Effective policy node is invalid.');
      seenNodes.add(nodeId);
      return Object.freeze({
        ...canonicalNode,
        displayOrder: integer(node.displayOrder, 0),
        enabled: true,
      });
    });
    const defaultNodeId = nonBlank(source.defaultNodeId, 'effective default node');
    if (!nodes.some((node) => node.nodeId === defaultNodeId)) {
      throw new Error('Effective policy default node is invalid.');
    }
    return Object.freeze({
      ...canonical,
      displayOrder: integer(source.displayOrder, 0),
      enabled: true,
      defaultNodeId,
      nodes: Object.freeze(nodes.sort((left, right) => left.displayOrder - right.displayOrder)),
    });
  });
  return Object.freeze(groups.sort((left, right) => left.displayOrder - right.displayOrder));
}

function canonicalNode(nodeId: string) {
  return HR_OPERATIONS_NAVIGATION_CATALOG.flatMap((group) => group.nodes).find(
    (node) => node.nodeId === nodeId
  );
}

function canonicalNodeByRoute(route: string) {
  return HR_OPERATIONS_NAVIGATION_CATALOG.flatMap((group) => group.nodes).find(
    (node) => normalizePath(node.route) === route
  );
}

function resolution(
  policy: HrisRuntimeNavigationPolicy,
  decision: 'ALLOW' | 'DENY',
  nodeId: string | null,
  route: string | null
): HrisRuntimeNavigationResolution {
  return Object.freeze({ decision, revisionPin: policy.revisionPin, nodeId, route });
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${label} is invalid.`);
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
  if (!/^[0-9a-f-]{36}$/iu.test(candidate)) throw new Error('UUID is invalid.');
  return candidate;
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
