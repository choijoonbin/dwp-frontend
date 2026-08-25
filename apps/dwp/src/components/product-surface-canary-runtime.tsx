// Neutral runtime authority shared by the application shell and lazy product features.
import { createContext, useContext, type ReactNode } from 'react';

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
  | 'baseline'
  | 'shadow'
  | 'enforced-compatibility'
  | 'surface-ui'
  | 'invalid';

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
 * Only rollout 111 may replace legacy discovery or disclose cross-plane Surface entry points.
 * Rollout 110 enforces server authorization while retaining the existing combined experience.
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
  const remainsValid = (value: string | undefined) => {
    if (value === undefined) return false;
    const expiryMs = Date.parse(value);
    return Number.isFinite(expiryMs) && expiryMs > serverNowMs;
  };
  const optionalExpiryRemainsValid = (value: string | undefined) =>
    value === undefined || remainsValid(value);
  if (
    !envelope ||
    !envelope.decisionRevision.trim() ||
    !decision.decisionRevision.trim() ||
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
      context.contextKey === decision.context.contextKey &&
      context.productKey === expected.productId &&
      context.surfaceKey === expected.surfaceId &&
      context.accessMode === envelope.activeAccessMode
  );
  if (canonicalContext.length !== 1 || !remainsValid(canonicalContext[0]?.revalidateAt)) {
    return false;
  }
  const canonicalScopes = canonicalContext[0]!.scopes.filter(
    (scope) => scope.key === decision.scope.key
  );
  const canonicalScope = canonicalScopes.length === 1 ? canonicalScopes[0] : undefined;
  return Boolean(
    canonicalScope &&
      canonicalScope.kind === decision.scope.kind &&
      canonicalScope.readOnly === decision.scope.readOnly &&
      optionalExpiryRemainsValid(canonicalScope.validUntil)
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
