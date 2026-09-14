import {
  productSurfaceServerNow,
  resolveProductRollout,
} from '@dwp-frontend/shared-utils/auth/product-surface-authority-model';
import type { ProductSurfaceAuthoritySnapshot } from '@dwp-frontend/shared-utils/auth/product-surface-authority-model';
import { resolveCanonicalProductSurfaceContext } from '../../components/product-surface-capability-access';
import type { useOptionalAllowedProductSurface } from '../../components/allowed-product-surface-context';
import { HttpError } from '@dwp-frontend/shared-utils';

export function approvalRetentionPolicyAbsent(
  state:
    | {
        status: string;
        fetchStatus: string;
        data?: unknown;
        error?: unknown;
      }
    | undefined
): boolean {
  if (!state || state.status !== 'error' || state.fetchStatus !== 'idle' || state.data != null)
    return false;
  const error = state.error;
  return (
    error instanceof HttpError &&
    error.status === 409 &&
    error.details != null &&
    typeof error.details === 'object' &&
    'errorCode' in error.details &&
    error.details.errorCode === 'RETENTION_POLICY_NOT_CONFIGURED'
  );
}

type Decision = NonNullable<ReturnType<typeof useOptionalAllowedProductSurface>>;
export function resolveApprovalRetentionIdentity(
  decision: Decision | null | undefined,
  snapshot: ProductSurfaceAuthoritySnapshot | undefined,
  cacheKey: readonly string[],
  capability:
    | 'approvals.policy.read'
    | 'approvals.policy.update'
    | 'approvals.policy.publish'
    | 'approvals.operations.read'
    | 'approvals.operations.execute'
) {
  const entry = resolveCanonicalProductSurfaceContext(decision, snapshot);
  if (
    !entry ||
    !snapshot ||
    !decision ||
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
  for (const value of cacheKey.slice(0, 2)) {
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number <= 0 || String(number) !== value) return null;
  }
  const rollout = resolveProductRollout(snapshot, 'approvals');
  if (rollout.state !== 'ready' || !['110', '111'].includes(rollout.rollout.state)) return null;
  const now = productSurfaceServerNow(snapshot);
  const mutation =
    capability !== 'approvals.policy.read' && capability !== 'approvals.operations.read';
  const matches = entry.effectiveGrants.filter(
    (grant) =>
      grant.grantKind === 'CAPABILITY' &&
      grant.capabilityContractKey === capability &&
      ['ACTIVE', 'ELIGIBLE'].includes(grant.activationState) &&
      grant.scopeKeys.includes(decision.scope.key) &&
      grant.responsibilityRequirement === 'REQUIRED' &&
      Boolean(grant.responsibility?.code.trim()) &&
      (grant.validUntil == null ||
        (Number.isFinite(Date.parse(grant.validUntil)) && Date.parse(grant.validUntil) > now)) &&
      (!mutation || (!grant.readOnly && !decision.effectiveReadOnly && !decision.scope.readOnly))
  );
  if (matches.length !== 1) return null;
  const grant = matches[0]!;
  if (grant.grantKind !== 'CAPABILITY') return null;
  const resourceSetKey = grant.responsibility?.resourceSetKey;
  if (!resourceSetKey || !/^[A-Z][A-Z0-9_]{2,79}$/.test(resourceSetKey)) return null;
  return Object.freeze({
    resourceSetKey,
    fingerprint: JSON.stringify({ cacheKey, capability, scope: decision.scope, grant }),
  });
}
