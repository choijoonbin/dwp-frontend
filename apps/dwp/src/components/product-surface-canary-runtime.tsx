// Neutral runtime authority shared by the application shell and lazy product features.
import { createContext, useContext, type ReactNode } from 'react';
import { isExclusiveProviderSupportContext } from '@dwp-frontend/shared-utils/auth/product-surface-authority-model';

import { isProductScopeKind } from './product-manifest';

import type {
  EffectiveProductSurfaceContextEnvelope,
  SurfaceDecision,
} from '../features/shell/product-surface-context';

export type ProductSurfaceRolloutFlags = {
  contextShadow: boolean;
  capabilityEnforcement: boolean;
  surfaceUi: boolean;
  surfaceUiEvaluation: 'resolved' | 'unavailable';
};

export type ProductSurfaceRolloutMode =
  'baseline' | 'shadow' | 'enforced-compatibility' | 'surface-ui' | 'invalid';

export type ProductSurfaceCanaryAuthority = {
  flags: ProductSurfaceRolloutFlags;
  authorityPending?: boolean;
  productFlags?: Readonly<Record<string, ProductSurfaceRolloutFlags>>;
  envelope?: EffectiveProductSurfaceContextEnvelope;
  surfaceDecisions?: Readonly<Record<string, SurfaceDecision>>;
  routeDecisions?: Readonly<Record<string, SurfaceDecision>>;
  pendingSurfaces?: Readonly<Record<string, boolean>>;
  pendingRoutes?: Readonly<Record<string, boolean>>;
  serverNowMs?: number;
  /** Surface id to safe registered route id. Raw URLs and object identifiers are never stored. */
  lastAllowedWorkRouteIds?: Readonly<Record<string, string>>;
  revalidate?: () => Promise<boolean>;
};

const INVALID_PRODUCT_SURFACE_FLAGS: ProductSurfaceRolloutFlags = {
  contextShadow: false,
  capabilityEnforcement: true,
  surfaceUi: false,
  surfaceUiEvaluation: 'unavailable',
};

const BASELINE_FLAGS: ProductSurfaceRolloutFlags = {
  contextShadow: false,
  capabilityEnforcement: false,
  surfaceUi: false,
  surfaceUiEvaluation: 'resolved',
};

export const BASELINE_PRODUCT_SURFACE_AUTHORITY: ProductSurfaceCanaryAuthority = {
  flags: BASELINE_FLAGS,
};

const ProductSurfaceCanaryContext = createContext<ProductSurfaceCanaryAuthority>(
  BASELINE_PRODUCT_SURFACE_AUTHORITY
);

export function resolveProductSurfaceRolloutMode(
  flags: ProductSurfaceRolloutFlags
): ProductSurfaceRolloutMode {
  const uiEnabled = flags.surfaceUiEvaluation === 'resolved' && flags.surfaceUi;
  if (!flags.contextShadow && !flags.capabilityEnforcement && !uiEnabled) return 'baseline';
  if (flags.contextShadow && !flags.capabilityEnforcement && !uiEnabled) return 'shadow';
  if (flags.contextShadow && flags.capabilityEnforcement && !uiEnabled) {
    return 'enforced-compatibility';
  }
  if (
    flags.contextShadow &&
    flags.capabilityEnforcement &&
    flags.surfaceUiEvaluation === 'resolved' &&
    flags.surfaceUi
  ) {
    return 'surface-ui';
  }
  return 'invalid';
}

export function isProductSurfaceEnforced(mode: ProductSurfaceRolloutMode): boolean {
  return mode === 'enforced-compatibility' || mode === 'surface-ui';
}

/**
 * Rollout 110 keeps product pages on the compatibility shell while projecting the exact current
 * plane and its single server-authorized management transition. Rollout 111 additionally enables
 * the native Surface shell and server-authorized app-catalog discovery.
 */
export function isProductSurfaceUiSeparated(mode: ProductSurfaceRolloutMode): mode is 'surface-ui' {
  return mode === 'surface-ui';
}

export function resolveCanaryProductFlags(
  authority: ProductSurfaceCanaryAuthority,
  productId: string
): ProductSurfaceRolloutFlags {
  if (!authority.productFlags) return authority.flags;
  return authority.productFlags[productId] ?? INVALID_PRODUCT_SURFACE_FLAGS;
}

function allowedDecisionIsTrusted(
  authority: ProductSurfaceCanaryAuthority,
  decision: Extract<SurfaceDecision, { state: 'allowed' }>,
  expected: { productId: string; surfaceId: string }
): boolean {
  const envelope = authority.envelope;
  const serverNowMs = authority.serverNowMs ?? Date.now();
  const nonBlank = (value: unknown): value is string =>
    typeof value === 'string' && value.trim().length > 0;
  const record = (value: unknown): Record<string, unknown> | undefined =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  const remainsValid = (value: unknown) => {
    if (!nonBlank(value)) return false;
    const expiryMs = Date.parse(value);
    return Number.isFinite(expiryMs) && expiryMs > serverNowMs;
  };
  const optionalExpiryRemainsValid = (value: unknown) => value === undefined || remainsValid(value);
  const optionalInstantIsWellFormed = (value: unknown) =>
    value === undefined || (nonBlank(value) && Number.isFinite(Date.parse(value)));
  const stringArray = (value: unknown): value is string[] =>
    Array.isArray(value) && value.every(nonBlank);
  const accessSourceIsKnown = (value: unknown) =>
    value === 'ENTITLEMENT' ||
    value === 'RELATIONSHIP' ||
    value === 'MANAGEMENT' ||
    value === 'SUPPORT';
  const scopesAreWellFormed = (scopes: unknown): scopes is typeof decision.context.scopes => {
    if (!Array.isArray(scopes) || scopes.length === 0) return false;
    const keys = new Set<string>();
    return scopes.every((scope) => {
      if (typeof scope !== 'object' || scope === null) return false;
      const candidate = scope as Record<string, unknown>;
      if (
        !nonBlank(candidate.key) ||
        keys.has(candidate.key) ||
        !nonBlank(candidate.kind) ||
        !isProductScopeKind(candidate.kind) ||
        !nonBlank(candidate.displayName) ||
        typeof candidate.isDefault !== 'boolean' ||
        typeof candidate.readOnly !== 'boolean' ||
        !optionalExpiryRemainsValid(candidate.validUntil)
      ) {
        return false;
      }
      keys.add(candidate.key);
      return true;
    });
  };
  const responsibilityIsWellFormed = (value: unknown) => {
    if (value === undefined) return true;
    const responsibility = record(value);
    return Boolean(
      responsibility && nonBlank(responsibility.code) && nonBlank(responsibility.resourceSetKey)
    );
  };
  const effectiveGrantsAreWellFormed = (grants: unknown, scopes: unknown): boolean => {
    if (!Array.isArray(grants) || !Array.isArray(scopes)) return false;
    const contextScopeKeys = new Set(
      scopes.flatMap((scope) => {
        const key = record(scope)?.key;
        return nonBlank(key) ? [key] : [];
      })
    );
    return grants.every((value) => {
      const grant = record(value);
      if (
        !grant ||
        !stringArray(grant.scopeKeys) ||
        !grant.scopeKeys.every((scopeKey) => contextScopeKeys.has(scopeKey)) ||
        typeof grant.requiresProductEntitlement !== 'boolean' ||
        typeof grant.readOnly !== 'boolean' ||
        !optionalInstantIsWellFormed(grant.validUntil)
      ) {
        return false;
      }
      if (grant.grantKind === 'CAPABILITY') {
        return Boolean(
          nonBlank(grant.capabilityContractKey) &&
          nonBlank(grant.resolvedCapabilityCode) &&
          (grant.authorityMode === 'PERMISSION' ||
            grant.authorityMode === 'PERMISSION_AND_RELATIONSHIP' ||
            grant.authorityMode === 'PERMISSION_OR_RELATIONSHIP') &&
          (grant.predicatePolicyKeys === undefined || stringArray(grant.predicatePolicyKeys)) &&
          (grant.responsibilityRequirement === 'REQUIRED' ||
            grant.responsibilityRequirement === 'NOT_REQUIRED' ||
            grant.responsibilityRequirement === 'LEGACY_OVERSIGHT') &&
          responsibilityIsWellFormed(grant.responsibility) &&
          nonBlank(grant.activationState)
        );
      }
      return Boolean(
        grant.grantKind === 'POLICY' &&
        nonBlank(grant.accessPolicyKey) &&
        nonBlank(grant.policyDecisionRef) &&
        (grant.authorityMode === 'ENTITLEMENT' ||
          grant.authorityMode === 'RELATIONSHIP' ||
          grant.authorityMode === 'ENTITLEMENT_AND_RELATIONSHIP' ||
          grant.authorityMode === 'SUPPORT_SESSION')
      );
    });
  };
  if (
    !envelope ||
    typeof decision !== 'object' ||
    decision === null ||
    typeof decision.context !== 'object' ||
    decision.context === null ||
    typeof decision.scope !== 'object' ||
    decision.scope === null ||
    !nonBlank(envelope.decisionRevision) ||
    !nonBlank(decision.decisionRevision) ||
    !nonBlank(decision.context.contextKey) ||
    !nonBlank(decision.routeGrantRef) ||
    !nonBlank(decision.scope.key) ||
    !nonBlank(decision.scope.kind) ||
    typeof decision.effectiveReadOnly !== 'boolean' ||
    decision.context.productKey !== expected.productId ||
    decision.context.surfaceKey !== expected.surfaceId ||
    decision.context.accessMode !== envelope.activeAccessMode ||
    !remainsValid(decision.revalidateAt) ||
    !remainsValid(decision.context.revalidateAt) ||
    !optionalExpiryRemainsValid(decision.scope.validUntil) ||
    envelope.contexts.some(
      (context) =>
        context.productKey === expected.productId &&
        context.accessMode !== envelope.activeAccessMode
    )
  ) {
    return false;
  }
  const canonicalContext = envelope.contexts.filter(
    (context) =>
      context.productKey === expected.productId &&
      context.surfaceKey === expected.surfaceId &&
      context.accessMode === envelope.activeAccessMode
  );
  const canonical = canonicalContext.length === 1 ? canonicalContext[0] : undefined;
  if (
    !canonical ||
    !nonBlank(canonical.contextKey) ||
    !nonBlank(canonical.appResourceKey) ||
    !remainsValid(canonical.revalidateAt) ||
    decision.context.plane !== canonical.plane ||
    !accessSourceIsKnown(canonical.accessSource) ||
    !accessSourceIsKnown(decision.context.accessSource) ||
    !nonBlank(decision.context.appResourceKey)
  ) {
    return false;
  }
  if (!scopesAreWellFormed(canonical.scopes) || !scopesAreWellFormed(decision.context.scopes)) {
    return false;
  }
  if (
    !scopesAreWellFormed([decision.scope]) ||
    !effectiveGrantsAreWellFormed(canonical.effectiveGrants, canonical.scopes) ||
    !effectiveGrantsAreWellFormed(decision.context.effectiveGrants, decision.context.scopes)
  ) {
    return false;
  }
  const providerSupportAuthorityIsExclusive =
    envelope.activeAccessMode === 'PROVIDER_SUPPORT'
      ? isExclusiveProviderSupportContext(canonical) &&
        isExclusiveProviderSupportContext(decision.context) &&
        decision.scope.readOnly === true &&
        decision.effectiveReadOnly === true
      : canonical.accessSource !== 'SUPPORT' &&
        decision.context.accessSource !== 'SUPPORT' &&
        canonical.effectiveGrants.every(
          (grant) => grant.grantKind !== 'POLICY' || grant.authorityMode !== 'SUPPORT_SESSION'
        ) &&
        decision.context.effectiveGrants.every(
          (grant) => grant.grantKind !== 'POLICY' || grant.authorityMode !== 'SUPPORT_SESSION'
        );
  if (!providerSupportAuthorityIsExclusive) return false;
  if (
    decision.context.scopes.some(
      (directScope) =>
        !canonical.scopes.some(
          (canonicalScope) =>
            canonicalScope.key === directScope.key && canonicalScope.kind === directScope.kind
        )
    )
  ) {
    return false;
  }
  // Source, app resource, default and read-only are exact-route projections. The surface entry
  // may conservatively aggregate alternatives, while the direct decision remains authoritative.
  // Direct scope sets may be a route-local subset; identity is anchored by key/kind while
  // default, read-only and per-grant validity are validated as independent projections.
  const selectedDirectScopes = decision.context.scopes.filter(
    (scope) => scope.key === decision.scope.key
  );
  const selectedDirectScope =
    selectedDirectScopes.length === 1 ? selectedDirectScopes[0] : undefined;
  return Boolean(
    selectedDirectScope &&
    selectedDirectScope.kind === decision.scope.kind &&
    selectedDirectScope.readOnly === decision.scope.readOnly &&
    selectedDirectScope.isDefault === decision.scope.isDefault &&
    selectedDirectScope.validUntil === decision.scope.validUntil &&
    (!decision.scope.readOnly || decision.effectiveReadOnly)
  );
}

export function resolveCanarySurfaceDecision(
  authority: ProductSurfaceCanaryAuthority,
  expected: { productId: string; surfaceId: string }
): SurfaceDecision {
  const decision = authority.surfaceDecisions?.[expected.surfaceId];
  if (!decision) return { state: 'authority-unavailable' };
  if (decision.state !== 'allowed') return decision;
  return allowedDecisionIsTrusted(authority, decision, expected)
    ? decision
    : { state: 'authority-unavailable' };
}

export function resolveCanaryRouteDecision(
  authority: ProductSurfaceCanaryAuthority,
  expected: { productId: string; surfaceId: string; routeContractKey: string }
): SurfaceDecision {
  const decision = authority.routeDecisions?.[expected.routeContractKey];
  if (!decision) return { state: 'authority-unavailable' };
  if (decision.state !== 'allowed') return decision;
  return allowedDecisionIsTrusted(authority, decision, expected)
    ? decision
    : { state: 'authority-unavailable' };
}

export function ProductSurfaceCanaryProvider({
  authority,
  children,
}: {
  authority: ProductSurfaceCanaryAuthority;
  children: ReactNode;
}) {
  return (
    <ProductSurfaceCanaryContext.Provider value={authority}>
      {children}
    </ProductSurfaceCanaryContext.Provider>
  );
}

export function useProductSurfaceCanaryAuthority(): ProductSurfaceCanaryAuthority {
  return useContext(ProductSurfaceCanaryContext);
}
