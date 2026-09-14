import {
  productSurfaceServerNow,
  resolveProductRollout,
} from '@dwp-frontend/shared-utils/auth/product-surface-authority-model';
import {
  APPROVAL_POLICY_IMPACT_GRANTS,
  APPROVAL_POLICY_IMPACT_ROUTE,
} from '@dwp-frontend/shared-utils/api/approval-policy-impact-contract';
import { resolveCanonicalProductSurfaceContext } from '../../components/product-surface-capability-access';
import type { useOptionalAllowedProductSurface } from '../../components/allowed-product-surface-context';
import type { ProductSurfaceAuthoritySnapshot } from '@dwp-frontend/shared-utils/auth/product-surface-authority-model';
import type { ApprovalPolicyImpactReadAuthority } from '@dwp-frontend/shared-utils/api/approval-policy-impact-contract';
import type { ApprovalPolicy } from '@dwp-frontend/shared-utils';

type AllowedSurfaceDecision = NonNullable<ReturnType<typeof useOptionalAllowedProductSurface>>;

export function approvalPolicyImpactSourceIdentity(policy: ApprovalPolicy) {
  return JSON.stringify({
    policyId: policy.policyId,
    key: policy.policyKey,
    version: policy.version,
    current: [policy.enforcementMode, policy.severity, policy.lifecycleState, policy.rule],
    pending: [
      policy.pendingReview,
      policy.pendingEnforcementMode,
      policy.pendingSeverity,
      policy.pendingLifecycleState,
      policy.pendingRule,
      policy.pendingBy,
      policy.pendingAt,
    ],
  });
}

export function resolveApprovalPolicyImpactIdentity(
  decision: AllowedSurfaceDecision | null | undefined,
  snapshot: ProductSurfaceAuthoritySnapshot | undefined,
  cacheKey: readonly string[]
): Readonly<{ authority: ApprovalPolicyImpactReadAuthority; fingerprint: string }> | null {
  const entry = resolveCanonicalProductSurfaceContext(decision, snapshot);
  if (
    !decision ||
    !snapshot ||
    !entry ||
    decision.decisionRevision !== snapshot.envelope.decisionRevision ||
    decision.context.contextKey !== entry.contextKey ||
    entry.plane !== 'management' ||
    entry.productKey !== 'approvals' ||
    entry.surfaceKey !== 'approvals.admin' ||
    !['NORMAL', 'ELEVATED'].includes(entry.accessMode) ||
    cacheKey[2] !== entry.accessMode ||
    cacheKey[3] !== entry.surfaceKey ||
    cacheKey[4] !== decision.scope.key ||
    cacheKey[5] !== decision.decisionRevision
  )
    return null;
  const tenantId = Number(cacheKey[0]);
  const actorId = Number(cacheKey[1]);
  if (
    !Number.isSafeInteger(tenantId) ||
    tenantId <= 0 ||
    String(tenantId) !== cacheKey[0] ||
    !Number.isSafeInteger(actorId) ||
    actorId <= 0 ||
    String(actorId) !== cacheKey[1]
  )
    return null;
  const rollout = resolveProductRollout(snapshot, 'approvals');
  if (rollout.state !== 'ready' || !['110', '111'].includes(rollout.rollout.state)) return null;
  const now = productSurfaceServerNow(snapshot);
  const selected = Object.keys(APPROVAL_POLICY_IMPACT_GRANTS).map((capability) =>
    entry.effectiveGrants.flatMap((grant) =>
      grant.grantKind === 'CAPABILITY' &&
      grant.capabilityContractKey === capability &&
      ['ACTIVE', 'ELIGIBLE'].includes(grant.activationState) &&
      grant.scopeKeys.includes(decision.scope.key) &&
      grant.responsibilityRequirement === 'REQUIRED' &&
      Boolean(grant.responsibility?.code.trim()) &&
      (grant.validUntil == null ||
        (Number.isFinite(Date.parse(grant.validUntil)) && Date.parse(grant.validUntil) > now))
        ? [grant]
        : []
    )
  );
  if (selected.some((grants) => grants.length !== 1)) return null;
  const grants = selected.map((matches) => matches[0]!);
  const resourceSetKey = grants[0]?.responsibility?.resourceSetKey;
  if (
    !resourceSetKey ||
    !/^[A-Z][A-Z0-9_]{2,79}$/u.test(resourceSetKey) ||
    grants.some((grant) => grant.responsibility?.resourceSetKey !== resourceSetKey)
  )
    return null;
  const authority: ApprovalPolicyImpactReadAuthority = Object.freeze({
    tenantId,
    actorId,
    resourceSetKey,
    contextKey: entry.contextKey,
    contextScopeKey: decision.scope.key,
    expectedDecisionRevision: decision.decisionRevision,
    routeContractKey: APPROVAL_POLICY_IMPACT_ROUTE,
    mode: 'SECURE',
    rolloutState: rollout.rollout.state as '110' | '111',
    accessMode: entry.accessMode as 'NORMAL' | 'ELEVATED',
  });
  return Object.freeze({
    authority,
    fingerprint: JSON.stringify({ authority, scope: decision.scope, grants }),
  });
}
