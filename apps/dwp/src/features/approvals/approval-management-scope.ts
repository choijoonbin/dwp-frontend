import { useLayoutEffect, useMemo, useRef } from 'react';
import { useProductSurfaceAuthority } from '@dwp-frontend/shared-utils';

import { useOptionalAllowedProductSurface } from '../../components/allowed-product-surface-context';

export function approvalManagementScopeIdentity(cacheKey: readonly string[]): string {
  return JSON.stringify(cacheKey);
}

export function approvalManagementScopeIsReady(
  scope: {
    contextScopeKey?: string;
    cacheKey: readonly string[];
    ready?: boolean;
  },
  options: { legacyCompatibility?: boolean } = {}
): boolean {
  if (typeof scope.ready === 'boolean') return scope.ready;
  const [tenantId, actorId, accessMode, surfaceKey, contextScopeKey, decisionRevision] =
    scope.cacheKey;
  if (options.legacyCompatibility) {
    return Boolean(
      tenantId &&
      actorId &&
      accessMode &&
      surfaceKey === 'approvals.admin.legacy' &&
      !contextScopeKey &&
      scope.contextScopeKey === undefined &&
      decisionRevision
    );
  }
  return Boolean(
    tenantId &&
    actorId &&
    surfaceKey === 'approvals.admin' &&
    contextScopeKey &&
    contextScopeKey === scope.contextScopeKey &&
    decisionRevision
  );
}

export function useApprovalManagementScopeReady(scope: {
  contextScopeKey?: string;
  cacheKey: readonly string[];
  ready?: boolean;
}): boolean {
  const authority = useProductSurfaceAuthority();
  const decision = useOptionalAllowedProductSurface();
  const rollout = authority.rolloutForProduct('approvals');
  const secureDecision =
    decision?.context.productKey === 'approvals' &&
    decision.context.surfaceKey === 'approvals.admin';
  if (secureDecision) return approvalManagementScopeIsReady(scope);
  const legacyCompatibility =
    rollout.state === 'ready' &&
    (rollout.rollout.state === '000' || rollout.rollout.state === '100');
  return approvalManagementScopeIsReady(scope, { legacyCompatibility });
}

export function useApprovalManagementScopeReset(
  cacheKey: readonly string[],
  reset: () => void
): void {
  const identity = useMemo(() => approvalManagementScopeIdentity(cacheKey), [cacheKey]);
  const previousIdentity = useRef(identity);

  useLayoutEffect(() => {
    if (previousIdentity.current === identity) return;
    previousIdentity.current = identity;
    reset();
  }, [identity, reset]);
}
