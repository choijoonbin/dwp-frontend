import { productSurfaceServerNow, useProductSurfaceAuthority } from '@dwp-frontend/shared-utils';

import { useOptionalAllowedProductSurface } from './allowed-product-surface-context';

import type { ProductSurfaceAuthoritySnapshot } from '@dwp-frontend/shared-utils';
import type { AllowedSurfaceDecision } from '../features/shell/product-surface-context';

const WRITABLE_ACTIVATION_STATES = new Set(['ACTIVE', 'ELIGIBLE']);

export type CanonicalProductSurfaceContext =
  ProductSurfaceAuthoritySnapshot['envelope']['contexts'][number];

export function resolveCanonicalProductSurfaceContext(
  decision: AllowedSurfaceDecision | null | undefined,
  snapshot: ProductSurfaceAuthoritySnapshot | undefined
): CanonicalProductSurfaceContext | null {
  if (
    !decision ||
    !snapshot ||
    snapshot.envelope.activeAccessMode !== decision.context.accessMode
  ) {
    return null;
  }
  const matches = snapshot.envelope.contexts.filter(
    (context) =>
      context.contextKey === decision.context.contextKey &&
      context.productKey === decision.context.productKey &&
      context.surfaceKey === decision.context.surfaceKey &&
      context.accessMode === decision.context.accessMode &&
      context.scopes.some((scope) => scope.key === decision.scope.key)
  );
  return matches.length === 1 ? matches[0]! : null;
}

/** Evaluates one ACTION capability against the canonical entry context and selected scope. */
export function hasWritableProductSurfaceCapability(
  decision: AllowedSurfaceDecision | null | undefined,
  entryContext: CanonicalProductSurfaceContext | null | undefined,
  capabilityContractKey: string,
  nowMs = Date.now()
): boolean {
  const selectedScope = entryContext?.scopes.find((scope) => scope.key === decision?.scope.key);
  const decisionRevalidateAtMs = Date.parse(decision?.revalidateAt ?? '');
  const contextRevalidateAtMs = Date.parse(entryContext?.revalidateAt ?? '');
  if (
    !decision ||
    !entryContext ||
    !selectedScope ||
    !capabilityContractKey.trim() ||
    decision.context.contextKey !== entryContext.contextKey ||
    decision.context.productKey !== entryContext.productKey ||
    decision.context.surfaceKey !== entryContext.surfaceKey ||
    decision.context.accessMode !== entryContext.accessMode ||
    decision.effectiveReadOnly ||
    decision.scope.readOnly ||
    selectedScope.readOnly ||
    !Number.isFinite(decisionRevalidateAtMs) ||
    !Number.isFinite(contextRevalidateAtMs) ||
    decisionRevalidateAtMs <= nowMs ||
    contextRevalidateAtMs <= nowMs
  ) {
    return false;
  }
  if (selectedScope.validUntil) {
    const scopeValidUntilMs = Date.parse(selectedScope.validUntil);
    if (!Number.isFinite(scopeValidUntilMs) || scopeValidUntilMs <= nowMs) return false;
  }
  return entryContext.effectiveGrants.some((grant) => {
    if (
      grant.grantKind !== 'CAPABILITY' ||
      grant.capabilityContractKey !== capabilityContractKey ||
      grant.readOnly ||
      !grant.scopeKeys.includes(decision.scope.key) ||
      !WRITABLE_ACTIVATION_STATES.has(grant.activationState)
    ) {
      return false;
    }
    if (!grant.validUntil) return true;
    const validUntilMs = Date.parse(grant.validUntil);
    return Number.isFinite(validUntilMs) && validUntilMs > nowMs;
  });
}

export function useProductSurfaceCapabilityAccess() {
  const decision = useOptionalAllowedProductSurface();
  const authority = useProductSurfaceAuthority();
  const entryContext = resolveCanonicalProductSurfaceContext(decision, authority.snapshot);
  const nowMs = authority.snapshot ? productSurfaceServerNow(authority.snapshot) : Date.now();
  return {
    governed: decision !== null,
    contextScopeKey: entryContext ? decision?.scope.key : undefined,
    hasWritableCapability: (capabilityContractKey: string) =>
      hasWritableProductSurfaceCapability(decision, entryContext, capabilityContractKey, nowMs),
  } as const;
}
