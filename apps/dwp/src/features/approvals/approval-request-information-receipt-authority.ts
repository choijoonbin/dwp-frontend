import {
  productSurfaceServerNow,
  productSurfaceSnapshotRemainsValid,
  resolveProductRollout,
} from '@dwp-frontend/shared-utils/auth/product-surface-authority-model';
import { APPROVAL_INFORMATION_RECEIPT_ROUTE } from '@dwp-frontend/shared-utils/api/approval-information-receipt-api';
import { productScopeIdentitiesAreKnownAndUnique } from '../../components/product-manifest';

import type {
  ProductSurfaceAuthoritySnapshot,
  ProductSurfaceEffectiveContext,
  ProductSurfaceEffectiveScope,
  ProductSurfaceEvaluationData,
} from '@dwp-frontend/shared-utils';
import type { ApprovalInformationReceiptReadAuthority } from '@dwp-frontend/shared-utils/api/approval-information-receipt-api';
import type { ProductAuthorizationRouteProjection } from '../../routes/product-surface-authorization.generated';

export type ApprovalInformationReceiptSource = Readonly<{
  ready: boolean;
  tenantId: string;
  actorId: string;
  epoch: number;
  snapshot?: ProductSurfaceAuthoritySnapshot;
  contextKey?: string;
  contextScopeKey?: string;
  projections: readonly ProductAuthorizationRouteProjection[];
}>;

export type ApprovalInformationReceiptEntry = Readonly<{
  source: ApprovalInformationReceiptSource;
  context: ProductSurfaceEffectiveContext;
  scope: ProductSurfaceEffectiveScope;
  rolloutState: '110' | '111';
}>;

export function approvalInformationReceiptRouteInstalled(
  projections: readonly ProductAuthorizationRouteProjection[]
) {
  const routes = projections.filter(
    (route) => route.routeContractKey === APPROVAL_INFORMATION_RECEIPT_ROUTE
  );
  const route = routes[0];
  return Boolean(
    routes.length === 1 &&
    route?.routeKind === 'DATA' &&
    route.subjectType === 'PRODUCT' &&
    route.productId === 'approvals' &&
    route.surfaceId === 'approvals.work' &&
    route.navigationContextId === 'approvals.work' &&
    route.gatewayBindings.length === 1 &&
    route.gatewayBindings[0]?.method === 'POST' &&
    route.gatewayBindings[0].path ===
      '/api/approvals/v1/requests/{requestId}/information-commands/{originalKey}/receipt'
  );
}

function fresh(value: string | null | undefined, now: number, required = false) {
  return value == null
    ? !required
    : typeof value === 'string' && Number.isFinite(Date.parse(value)) && Date.parse(value) > now;
}

export function approvalInformationReceiptEntry(
  source: ApprovalInformationReceiptSource
): ApprovalInformationReceiptEntry | undefined {
  const snapshot = source.snapshot;
  if (
    !source.ready ||
    !source.tenantId ||
    !source.actorId ||
    !Number.isSafeInteger(source.epoch) ||
    !snapshot ||
    !productSurfaceSnapshotRemainsValid(snapshot) ||
    !approvalInformationReceiptRouteInstalled(source.projections)
  )
    return undefined;
  const rollout = resolveProductRollout(snapshot, 'approvals');
  if (
    rollout.state !== 'ready' ||
    (rollout.rollout.state !== '110' && rollout.rollout.state !== '111')
  )
    return undefined;
  const contexts = snapshot.envelope.contexts.filter(
    (context) =>
      context.productKey === 'approvals' &&
      context.surfaceKey === 'approvals.work' &&
      context.contextKey === source.contextKey
  );
  const context = contexts[0];
  const now = productSurfaceServerNow(snapshot);
  if (
    contexts.length !== 1 ||
    !context ||
    context.plane !== 'work' ||
    !['NORMAL', 'ELEVATED'].includes(context.accessMode) ||
    context.accessMode !== snapshot.envelope.activeAccessMode ||
    !context.appResourceKey ||
    !fresh(context.revalidateAt, now, true) ||
    !productScopeIdentitiesAreKnownAndUnique(context.scopes)
  )
    return undefined;
  const scopes = context.scopes.filter((scope) => scope.key === source.contextScopeKey);
  const scope = scopes[0];
  if (scopes.length !== 1 || !scope || !fresh(scope.validUntil, now)) return undefined;
  return { source, context, scope, rolloutState: rollout.rollout.state };
}

/** Fresh receipt DATA proof, intentionally independent of writable ACTION authority. */
export function approvalInformationReceiptAuthority(
  entry: ApprovalInformationReceiptEntry,
  evaluation: ProductSurfaceEvaluationData
): Readonly<{ authority: ApprovalInformationReceiptReadAuthority; expiresAt: number }> | undefined {
  const context = evaluation.context;
  const scope = evaluation.scope;
  const now = productSurfaceServerNow(entry.source.snapshot!);
  if (
    evaluation.decision !== 'ALLOWED' ||
    !/^psr-[0-9a-f]{64}$/u.test(evaluation.decisionRevision ?? '') ||
    !evaluation.routeGrantRef?.trim() ||
    evaluation.effectiveReadOnly !== true ||
    !context ||
    context.productKey !== 'approvals' ||
    context.surfaceKey !== 'approvals.work' ||
    context.contextKey !== entry.context.contextKey ||
    context.appResourceKey !== entry.context.appResourceKey ||
    context.accessMode !== entry.context.accessMode ||
    context.accessSource !== entry.context.accessSource ||
    context.plane !== 'work' ||
    !productScopeIdentitiesAreKnownAndUnique(context.scopes) ||
    context.scopes.length !== entry.context.scopes.length ||
    !context.scopes.every(
      (candidate) =>
        typeof candidate.displayName === 'string' &&
        Boolean(candidate.displayName.trim()) &&
        typeof candidate.isDefault === 'boolean' &&
        typeof candidate.readOnly === 'boolean' &&
        fresh(candidate.validUntil, now) &&
        entry.context.scopes.some(
          (canonical) => canonical.key === candidate.key && canonical.kind === candidate.kind
        )
    ) ||
    !scope ||
    scope.key !== entry.scope.key ||
    scope.kind !== entry.scope.kind ||
    !fresh(scope.validUntil, now) ||
    !fresh(evaluation.validUntil, now) ||
    !fresh(evaluation.revalidateAt, now, true) ||
    !fresh(context.revalidateAt, now, true) ||
    Date.parse(evaluation.revalidateAt!) > Date.parse(context.revalidateAt)
  )
    return undefined;
  const direct = context.scopes.filter((candidate) => candidate.key === scope.key);
  if (
    direct.length !== 1 ||
    direct[0]?.kind !== scope.kind ||
    direct[0]?.displayName !== scope.displayName ||
    direct[0]?.readOnly !== scope.readOnly ||
    direct[0]?.isDefault !== scope.isDefault ||
    direct[0]?.validUntil !== scope.validUntil ||
    context.effectiveGrants.length !== 1
  )
    return undefined;
  const grant = context.effectiveGrants[0];
  if (
    grant?.grantKind !== 'CAPABILITY' ||
    grant.capabilityContractKey !== 'approvals.work.information-command-receipt.read' ||
    grant.resolvedCapabilityCode !== 'ACTION.APPROVAL_REQUEST:VIEW' ||
    !['PERMISSION', 'PERMISSION_AND_RELATIONSHIP', 'PERMISSION_OR_RELATIONSHIP'].includes(
      grant.authorityMode
    ) ||
    grant.activationState !== 'ACTIVE' ||
    grant.readOnly !== true ||
    grant.requiresProductEntitlement !== true ||
    grant.scopeKeys.length !== 1 ||
    grant.scopeKeys[0] !== scope.key ||
    grant.predicatePolicyKeys.length !== 1 ||
    grant.predicatePolicyKeys[0] !== 'predicate.approval.original-information-command-receipt.v1' ||
    !['REQUIRED', 'NOT_REQUIRED', 'LEGACY_OVERSIGHT'].includes(grant.responsibilityRequirement) ||
    (grant.responsibilityRequirement === 'REQUIRED' &&
      (!grant.responsibility?.code || !grant.responsibility.resourceSetKey)) ||
    !fresh(grant.validUntil, now)
  )
    return undefined;
  return {
    authority: Object.freeze({
      mode: 'SECURE',
      rolloutState: entry.rolloutState,
      routeContractKey: APPROVAL_INFORMATION_RECEIPT_ROUTE,
      expectedDecisionRevision: evaluation.decisionRevision!,
      contextKey: context.contextKey,
      contextScopeKey: scope.key,
    }),
    expiresAt: Math.min(
      ...[
        evaluation.revalidateAt,
        context.revalidateAt,
        evaluation.validUntil,
        scope.validUntil,
        grant.validUntil,
      ]
        .filter((value): value is string => value != null)
        .map((value) => Date.parse(value))
    ),
  };
}
