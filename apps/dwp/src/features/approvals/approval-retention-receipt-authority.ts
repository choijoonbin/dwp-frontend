import {
  productSurfaceServerNow,
  productSurfaceSnapshotRemainsValid,
  resolveProductRollout,
} from '@dwp-frontend/shared-utils/auth/product-surface-authority-model';
import { APPROVAL_RETENTION_RECEIPT_BINDINGS } from '@dwp-frontend/shared-utils/api/approval-retention-receipt-api';
import { assertApprovalRetentionReceiptOriginal } from '@dwp-frontend/shared-utils/api/approval-retention-receipt-profile';
import { productScopeIdentitiesAreKnownAndUnique } from '../../components/product-manifest';

import type {
  ProductSurfaceAuthoritySnapshot,
  ProductSurfaceEffectiveContext,
  ProductSurfaceEffectiveScope,
  ProductSurfaceEvaluationData,
} from '@dwp-frontend/shared-utils';
import type { ApprovalRetentionReceiptReadAuthority } from '@dwp-frontend/shared-utils/api/approval-retention-receipt-api';
import type {
  ApprovalRetentionReceiptCommand,
  ApprovalRetentionReceiptOriginal,
} from '@dwp-frontend/shared-utils/api/approval-retention-receipt-profile';
import type { ProductAuthorizationRouteProjection } from '../../routes/product-surface-authorization.generated';

export type ApprovalRetentionReceiptSource = Readonly<{
  ready: boolean;
  tenantId: string;
  actorId: string;
  epoch: number;
  snapshot?: ProductSurfaceAuthoritySnapshot;
  contextKey?: string;
  contextScopeKey?: string;
  projections: readonly ProductAuthorizationRouteProjection[];
}>;

export type ApprovalRetentionReceiptEntry = Readonly<{
  source: ApprovalRetentionReceiptSource;
  context: ProductSurfaceEffectiveContext;
  scope: ProductSurfaceEffectiveScope;
  rolloutState: '110' | '111';
}>;

const OPERATION_AUTHORITY = {
  INITIALIZE_POLICY: {
    capability: 'approvals.policy.update',
    permission: 'ADMIN.APPROVAL_POLICY:UPDATE',
  },
  SAVE_POLICY: {
    capability: 'approvals.policy.update',
    permission: 'ADMIN.APPROVAL_POLICY:UPDATE',
  },
  PUBLISH_POLICY: {
    capability: 'approvals.policy.publish',
    permission: 'ADMIN.APPROVAL_POLICY:PUBLISH',
  },
  CLAIM_RECORD: {
    capability: 'approvals.operations.execute',
    permission: 'ADMIN.APPROVAL_OPERATIONS:EXECUTE',
  },
} as const satisfies Record<
  ApprovalRetentionReceiptCommand['operation'],
  Readonly<{ capability: string; permission: string }>
>;

function fresh(value: string | null | undefined, now: number, required = false) {
  return value == null
    ? !required
    : typeof value === 'string' && Number.isFinite(Date.parse(value)) && Date.parse(value) > now;
}

export function approvalRetentionReceiptRouteInstalled(
  operation: ApprovalRetentionReceiptCommand['operation'],
  projections: readonly ProductAuthorizationRouteProjection[]
) {
  const binding = APPROVAL_RETENTION_RECEIPT_BINDINGS[operation];
  const matches = projections.filter(
    (route) => route.routeContractKey === binding.routeContractKey
  );
  const route = matches[0];
  return Boolean(
    matches.length === 1 &&
    route?.routeKind === 'DATA' &&
    route.subjectType === 'PRODUCT' &&
    route.productId === 'approvals' &&
    route.surfaceId === 'approvals.admin' &&
    route.navigationContextId === 'approvals.admin' &&
    route.gatewayBindings.length === 1 &&
    route.gatewayBindings[0]?.method === 'GET' &&
    route.gatewayBindings[0].path === `/api/approvals${binding.path}`
  );
}

export function approvalRetentionReceiptEntry(
  source: ApprovalRetentionReceiptSource,
  original: ApprovalRetentionReceiptOriginal
): ApprovalRetentionReceiptEntry | undefined {
  assertApprovalRetentionReceiptOriginal(original);
  const snapshot = source.snapshot;
  const actorUserId = Number(source.actorId);
  if (
    !source.ready ||
    !source.tenantId ||
    !Number.isSafeInteger(actorUserId) ||
    actorUserId <= 0 ||
    actorUserId !== original.actorUserId ||
    !Number.isSafeInteger(source.epoch) ||
    !snapshot ||
    !productSurfaceSnapshotRemainsValid(snapshot) ||
    !approvalRetentionReceiptRouteInstalled(original.command.operation, source.projections)
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
      context.surfaceKey === 'approvals.admin' &&
      context.contextKey === source.contextKey
  );
  const context = contexts[0];
  const now = productSurfaceServerNow(snapshot);
  if (
    contexts.length !== 1 ||
    !context ||
    context.plane !== 'management' ||
    context.accessSource !== 'MANAGEMENT' ||
    context.appResourceKey !== 'APP.APPROVALS' ||
    !['NORMAL', 'ELEVATED'].includes(context.accessMode) ||
    context.accessMode !== snapshot.envelope.activeAccessMode ||
    !fresh(context.revalidateAt, now, true) ||
    !productScopeIdentitiesAreKnownAndUnique(context.scopes)
  )
    return undefined;
  const scopes = context.scopes.filter((scope) => scope.key === source.contextScopeKey);
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

/** The receipt GET reuses the original capability only as read-only transaction evidence. */
export function approvalRetentionReceiptAuthority(
  entry: ApprovalRetentionReceiptEntry,
  evaluation: ProductSurfaceEvaluationData,
  original: ApprovalRetentionReceiptOriginal
):
  | Readonly<{
      authority: ApprovalRetentionReceiptReadAuthority;
      expiresAt: number;
      resourceSetKey: string;
    }>
  | undefined {
  assertApprovalRetentionReceiptOriginal(original);
  const expected = OPERATION_AUTHORITY[original.command.operation];
  const expectedRoute =
    APPROVAL_RETENTION_RECEIPT_BINDINGS[original.command.operation].routeContractKey;
  const context = evaluation.context;
  const scope = evaluation.scope;
  const now = productSurfaceServerNow(entry.source.snapshot!);
  if (
    evaluation.decision !== 'ALLOWED' ||
    !/^psr-[0-9a-f]{64}$/u.test(evaluation.decisionRevision ?? '') ||
    !evaluation.routeGrantRef?.trim() ||
    evaluation.effectiveReadOnly !== true ||
    !context ||
    !scope ||
    context.productKey !== 'approvals' ||
    context.surfaceKey !== 'approvals.admin' ||
    context.plane !== 'management' ||
    context.accessSource !== 'MANAGEMENT' ||
    context.appResourceKey !== 'APP.APPROVALS' ||
    context.contextKey !== entry.context.contextKey ||
    context.accessMode !== entry.context.accessMode ||
    scope.key !== entry.scope.key ||
    scope.kind !== entry.scope.kind ||
    !fresh(scope.validUntil, now) ||
    !fresh(evaluation.validUntil, now) ||
    !fresh(evaluation.revalidateAt, now, true) ||
    !fresh(context.revalidateAt, now, true) ||
    Date.parse(evaluation.revalidateAt!) > Date.parse(context.revalidateAt) ||
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
    )
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
    grant.capabilityContractKey !== expected.capability ||
    grant.resolvedCapabilityCode !== expected.permission ||
    grant.authorityMode !== 'PERMISSION' ||
    grant.activationState !== 'ACTIVE' ||
    grant.readOnly !== true ||
    grant.requiresProductEntitlement !== false ||
    grant.scopeKeys.length !== 1 ||
    grant.scopeKeys[0] !== scope.key ||
    grant.predicatePolicyKeys.length !== 1 ||
    grant.predicatePolicyKeys[0] !== 'predicate.approval.retention-command-original-authority.v1' ||
    grant.responsibilityRequirement !== 'REQUIRED' ||
    grant.responsibility?.code !== 'APP_CONFIG_ADMIN' ||
    grant.responsibility.resourceSetKey !== original.resourceSetKey ||
    !fresh(grant.validUntil, now)
  )
    return undefined;
  return Object.freeze({
    authority: Object.freeze({
      mode: 'SECURE',
      rolloutState: entry.rolloutState,
      routeContractKey: expectedRoute,
      expectedDecisionRevision: evaluation.decisionRevision!,
      contextKey: context.contextKey,
      contextScopeKey: scope.key,
    }),
    resourceSetKey: original.resourceSetKey,
    expiresAt: Math.min(
      ...[
        evaluation.revalidateAt,
        context.revalidateAt,
        evaluation.validUntil,
        scope.validUntil,
        grant.validUntil,
      ]
        .filter((value): value is string => value != null)
        .map(Date.parse)
    ),
  });
}
