import {
  productSurfaceServerNow,
  productSurfaceSnapshotRemainsValid,
  resolveProductRollout,
} from '@dwp-frontend/shared-utils/auth/product-surface-authority-model';
import {
  APPROVAL_WORKFLOW_PLANNING_ROUTE,
  APPROVAL_WORKFLOW_PLANNING_SELECTION_ROUTE,
} from '@dwp-frontend/shared-utils/api/approval-workflow-planning-contract';
import { productScopeIdentitiesAreKnownAndUnique } from '../../components/product-manifest';
import type {
  ProductSurfaceAuthoritySnapshot,
  ProductSurfaceEffectiveContext,
  ProductSurfaceEffectiveScope,
  ProductSurfaceEvaluationData,
} from '@dwp-frontend/shared-utils';
import type { ApprovalWorkflowPlanningReadAuthority } from '@dwp-frontend/shared-utils/api/approval-workflow-planning-contract';
import type { ProductAuthorizationRouteProjection } from '../../routes/product-surface-authorization.generated';

export type ApprovalWorkflowPlanningSource = Readonly<{
  ready: boolean;
  tenantId: string;
  actorId: string;
  epoch: number;
  snapshot?: ProductSurfaceAuthoritySnapshot;
  contextKey?: string;
  contextScopeKey?: string;
  projections: readonly ProductAuthorizationRouteProjection[];
}>;
type Entry = Readonly<{
  source: ApprovalWorkflowPlanningSource;
  context: ProductSurfaceEffectiveContext;
  scope: ProductSurfaceEffectiveScope;
  rolloutState: '110' | '111';
}>;
const fresh = (value: string | null | undefined, now: number, required = false) =>
  value == null ? !required : Number.isFinite(Date.parse(value)) && Date.parse(value) > now;
const routes = [
  [
    APPROVAL_WORKFLOW_PLANNING_SELECTION_ROUTE,
    'GET',
    '/api/approvals/v1/admin/workflows/{workflowId}/planning-selection',
  ],
  [
    APPROVAL_WORKFLOW_PLANNING_ROUTE,
    'POST',
    '/api/approvals/v1/admin/workflows/{workflowId}/versions/{versionId}/simulation',
  ],
] as const;
export function approvalWorkflowPlanningInstalled(
  projections: ApprovalWorkflowPlanningSource['projections']
) {
  return routes.every(([key, method, path]) => {
    const matches = projections.filter((route) => route.routeContractKey === key);
    const route = matches[0];
    return (
      matches.length === 1 &&
      route?.routeKind === 'DATA' &&
      route.subjectType === 'PRODUCT' &&
      route.productId === 'approvals' &&
      route.surfaceId === 'approvals.admin' &&
      route.navigationContextId === 'approvals.admin' &&
      route.gatewayBindings.length === 1 &&
      route.gatewayBindings[0]?.method === method &&
      route.gatewayBindings[0].path === path
    );
  });
}
/** Both native DATA routes must be installed before evaluation, CSRF, catalog or preview HTTP. */
export function approvalWorkflowPlanningEntry(
  source: ApprovalWorkflowPlanningSource
): Entry | undefined {
  const snapshot = source.snapshot;
  if (
    !source.ready ||
    !source.actorId ||
    !source.tenantId ||
    !Number.isSafeInteger(source.epoch) ||
    !snapshot ||
    !productSurfaceSnapshotRemainsValid(snapshot) ||
    !approvalWorkflowPlanningInstalled(source.projections)
  )
    return undefined;
  const rollout = resolveProductRollout(snapshot, 'approvals');
  if (
    rollout.state !== 'ready' ||
    (rollout.rollout.state !== '110' && rollout.rollout.state !== '111')
  )
    return undefined;
  const contexts = snapshot.envelope.contexts.filter(
    (value) =>
      value.productKey === 'approvals' &&
      value.surfaceKey === 'approvals.admin' &&
      value.contextKey === source.contextKey
  );
  const context = contexts[0];
  const now = productSurfaceServerNow(snapshot);
  if (
    contexts.length !== 1 ||
    !context ||
    context.plane !== 'management' ||
    context.accessSource !== 'MANAGEMENT' ||
    !['NORMAL', 'ELEVATED'].includes(context.accessMode) ||
    context.accessMode !== snapshot.envelope.activeAccessMode ||
    context.appResourceKey !== 'APP.APPROVALS' ||
    !fresh(context.revalidateAt, now, true) ||
    !productScopeIdentitiesAreKnownAndUnique(context.scopes)
  )
    return undefined;
  const scopes = context.scopes.filter((value) => value.key === source.contextScopeKey);
  const scope = scopes[0];
  if (
    scopes.length !== 1 ||
    !scope ||
    scope.kind !== 'RESOURCE_SET' ||
    !fresh(scope.validUntil, now)
  )
    return undefined;
  return { source, context, scope, rolloutState: rollout.rollout.state };
}
export function approvalWorkflowPlanningAuthority(
  entry: Entry,
  evaluation: ProductSurfaceEvaluationData,
  routeContractKey: ApprovalWorkflowPlanningReadAuthority['routeContractKey']
) {
  const context = evaluation.context;
  const scope = evaluation.scope;
  const now = productSurfaceServerNow(entry.source.snapshot!);
  if (
    evaluation.decision !== 'ALLOWED' ||
    !/^psr-[a-f0-9]{64}$/u.test(evaluation.decisionRevision ?? '') ||
    !evaluation.routeGrantRef?.trim() ||
    evaluation.effectiveReadOnly !== true ||
    !context ||
    !scope ||
    context.productKey !== 'approvals' ||
    context.surfaceKey !== 'approvals.admin' ||
    context.plane !== 'management' ||
    context.contextKey !== entry.context.contextKey ||
    context.appResourceKey !== entry.context.appResourceKey ||
    context.accessSource !== entry.context.accessSource ||
    context.accessMode !== entry.context.accessMode ||
    scope.key !== entry.scope.key ||
    scope.kind !== entry.scope.kind ||
    !fresh(scope.validUntil, now) ||
    !productScopeIdentitiesAreKnownAndUnique(context.scopes) ||
    context.scopes.length !== entry.context.scopes.length ||
    !context.scopes.every(
      (value) =>
        entry.context.scopes.some(
          (canonical) => canonical.key === value.key && canonical.kind === value.kind
        ) && fresh(value.validUntil, now)
    ) ||
    !fresh(context.revalidateAt, now, true) ||
    !fresh(evaluation.revalidateAt, now, true) ||
    !fresh(evaluation.validUntil, now) ||
    Date.parse(evaluation.revalidateAt!) > Date.parse(context.revalidateAt)
  )
    return undefined;
  const direct = context.scopes.filter((value) => value.key === scope.key);
  if (
    direct.length !== 1 ||
    direct[0]?.kind !== scope.kind ||
    direct[0]?.displayName !== scope.displayName ||
    direct[0]?.readOnly !== scope.readOnly ||
    direct[0]?.isDefault !== scope.isDefault ||
    direct[0]?.validUntil !== scope.validUntil ||
    typeof scope.displayName !== 'string' ||
    !scope.displayName.trim() ||
    typeof scope.readOnly !== 'boolean' ||
    typeof scope.isDefault !== 'boolean' ||
    context.effectiveGrants.length !== 2
  )
    return undefined;
  const required = [
    ['approvals.admin.workflow-planning-form.read', 'ACTION.APPROVAL_FORM:VIEW'],
    ['approvals.admin.workflow-planning-simulation.read', 'ADMIN.APPROVAL_WORKFLOW:UPDATE'],
  ] as const;
  const predicate =
    routeContractKey === APPROVAL_WORKFLOW_PLANNING_ROUTE
      ? 'predicate.approval.workflow-planning-simulation.v1'
      : 'predicate.approval.workflow-planning-selection.v1';
  const expiries = [
    context.revalidateAt,
    evaluation.revalidateAt,
    evaluation.validUntil,
    scope.validUntil,
  ];
  let resourceSetKey: string | undefined;
  for (const [key, permission] of required) {
    const matches = context.effectiveGrants
      .filter((value) => value.grantKind === 'CAPABILITY')
      .filter((value) => value.capabilityContractKey === key);
    const grant = matches[0];
    if (
      matches.length !== 1 ||
      grant?.grantKind !== 'CAPABILITY' ||
      grant.resolvedCapabilityCode !== permission ||
      grant.authorityMode !== 'PERMISSION' ||
      grant.readOnly !== true ||
      grant.activationState !== 'ACTIVE' ||
      grant.requiresProductEntitlement !== true ||
      grant.scopeKeys.length !== 1 ||
      grant.scopeKeys[0] !== scope.key ||
      grant.predicatePolicyKeys.length !== 1 ||
      grant.predicatePolicyKeys[0] !== predicate ||
      grant.responsibilityRequirement !== 'REQUIRED' ||
      grant.responsibility?.code !== 'APP_CONFIG_ADMIN' ||
      !/^[A-Z][A-Z0-9_]{2,79}$/u.test(grant.responsibility.resourceSetKey ?? '') ||
      !fresh(grant.validUntil, now) ||
      (resourceSetKey && resourceSetKey !== grant.responsibility.resourceSetKey)
    )
      return undefined;
    resourceSetKey = grant.responsibility.resourceSetKey;
    expiries.push(grant.validUntil);
  }
  return Object.freeze({
    authority: Object.freeze({
      mode: 'SECURE',
      rolloutState: entry.rolloutState,
      routeContractKey,
      expectedDecisionRevision: evaluation.decisionRevision!,
      contextKey: context.contextKey,
      contextScopeKey: scope.key,
    }) as ApprovalWorkflowPlanningReadAuthority,
    resourceSetKey: resourceSetKey!,
    expiresAt: Math.min(
      ...expiries.filter((value): value is string => value != null).map(Date.parse)
    ),
  });
}
