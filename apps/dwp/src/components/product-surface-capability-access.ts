import { productSurfaceServerNow } from '@dwp-frontend/shared-utils/auth/product-surface-authority-model';
import { useProductSurfaceAuthority } from '@dwp-frontend/shared-utils/auth/product-surface-context-provider';

import { useOptionalAllowedProductSurface } from './allowed-product-surface-context';

import type { ProductSurfaceAuthoritySnapshot } from '@dwp-frontend/shared-utils/auth/product-surface-authority-model';
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
    !snapshot.envelope.decisionRevision.trim() ||
    !decision.decisionRevision.trim() ||
    !decision.context.contextKey.trim() ||
    !decision.context.appResourceKey.trim() ||
    snapshot.envelope.activeAccessMode !== decision.context.accessMode
  ) {
    return null;
  }
  const nowMs = productSurfaceServerNow(snapshot);
  const remainsValid = (value: string | null | undefined, required = false) => {
    if (value == null) return !required;
    const instant = Date.parse(value);
    return Number.isFinite(instant) && instant > nowMs;
  };
  const scopeKeysAreUniqueAndFresh = (
    scopes: readonly Readonly<{ key: string; validUntil?: string | null }>[]
  ) => {
    const keys = new Set(scopes.map((scope) => scope.key));
    return (
      scopes.length > 0 &&
      keys.size === scopes.length &&
      scopes.every((scope) => scope.key.trim().length > 0 && remainsValid(scope.validUntil))
    );
  };
  const directSelectedScopes = decision.context.scopes.filter(
    (scope) => scope.key === decision.scope.key && scope.kind === decision.scope.kind
  );
  if (
    !remainsValid(decision.revalidateAt, true) ||
    !remainsValid(decision.context.revalidateAt, true) ||
    !remainsValid(decision.scope.validUntil) ||
    !scopeKeysAreUniqueAndFresh(decision.context.scopes) ||
    directSelectedScopes.length !== 1
  ) {
    return null;
  }
  const directSelectedScope = directSelectedScopes[0]!;
  if (
    directSelectedScope.displayName !== decision.scope.displayName ||
    directSelectedScope.isDefault !== decision.scope.isDefault ||
    directSelectedScope.readOnly !== decision.scope.readOnly ||
    directSelectedScope.validUntil !== decision.scope.validUntil ||
    (decision.scope.readOnly && !decision.effectiveReadOnly)
  ) {
    return null;
  }
  const matches = snapshot.envelope.contexts.filter((context) => {
    if (!scopeKeysAreUniqueAndFresh(context.scopes)) return false;
    if (
      decision.context.scopes.some(
        (directScope) =>
          !context.scopes.some(
            (canonicalScope) =>
              canonicalScope.key === directScope.key && canonicalScope.kind === directScope.kind
          )
      )
    ) {
      return false;
    }
    const selectedScope = context.scopes.filter(
      (scope) => scope.key === decision.scope.key && scope.kind === decision.scope.kind
    );
    return (
      context.contextKey.trim().length > 0 &&
      context.appResourceKey.trim().length > 0 &&
      context.productKey === decision.context.productKey &&
      context.surfaceKey === decision.context.surfaceKey &&
      context.accessMode === decision.context.accessMode &&
      context.plane === decision.context.plane &&
      remainsValid(context.revalidateAt, true) &&
      selectedScope.length === 1 &&
      remainsValid(selectedScope[0]!.validUntil)
    );
  });
  return matches.length === 1 ? matches[0]! : null;
}

/** Evaluates one ACTION capability against the canonical entry context and selected scope. */
export function hasWritableProductSurfaceCapability(
  decision: AllowedSurfaceDecision | null | undefined,
  entryContext: CanonicalProductSurfaceContext | null | undefined,
  capabilityContractKey: string,
  nowMs = Date.now()
): boolean {
  const selectedScope = entryContext?.scopes.find(
    (scope) => scope.key === decision?.scope.key && scope.kind === decision?.scope.kind
  );
  const decisionRevalidateAtMs = Date.parse(decision?.revalidateAt ?? '');
  const decisionContextRevalidateAtMs = Date.parse(decision?.context.revalidateAt ?? '');
  const contextRevalidateAtMs = Date.parse(entryContext?.revalidateAt ?? '');
  if (
    !decision ||
    !entryContext ||
    !selectedScope ||
    !capabilityContractKey.trim() ||
    decision.context.productKey !== entryContext.productKey ||
    decision.context.surfaceKey !== entryContext.surfaceKey ||
    decision.context.accessMode !== entryContext.accessMode ||
    decision.context.plane !== entryContext.plane ||
    decision.effectiveReadOnly ||
    decision.scope.readOnly ||
    selectedScope.readOnly ||
    !Number.isFinite(decisionRevalidateAtMs) ||
    !Number.isFinite(decisionContextRevalidateAtMs) ||
    !Number.isFinite(contextRevalidateAtMs) ||
    decisionRevalidateAtMs <= nowMs ||
    decisionContextRevalidateAtMs <= nowMs ||
    contextRevalidateAtMs <= nowMs
  ) {
    return false;
  }
  if (selectedScope.validUntil) {
    const scopeValidUntilMs = Date.parse(selectedScope.validUntil);
    if (!Number.isFinite(scopeValidUntilMs) || scopeValidUntilMs <= nowMs) return false;
  }
  if (decision.scope.validUntil) {
    const directScopeValidUntilMs = Date.parse(decision.scope.validUntil);
    if (!Number.isFinite(directScopeValidUntilMs) || directScopeValidUntilMs <= nowMs) return false;
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
