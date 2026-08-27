import type {
  ProductNavigationAccess,
  ProductPlane,
  ProductScopeKind,
} from '../../components/product-manifest';

export type ProductAccessMode = 'NORMAL' | 'ELEVATED' | 'PROVIDER_SUPPORT';
export type ProductAccessSource = 'ENTITLEMENT' | 'RELATIONSHIP' | 'MANAGEMENT' | 'SUPPORT';

export type EffectiveScope = {
  key: string;
  kind: ProductScopeKind;
  displayName: string;
  isDefault: boolean;
  readOnly: boolean;
  validUntil?: string;
};

export type EffectiveCapabilityGrant = {
  grantKind: 'CAPABILITY';
  capabilityContractKey: string;
  resolvedCapabilityCode: string;
  authorityMode: 'PERMISSION' | 'PERMISSION_AND_RELATIONSHIP' | 'PERMISSION_OR_RELATIONSHIP';
  predicatePolicyKeys?: readonly string[];
  responsibilityRequirement: 'REQUIRED' | 'NOT_REQUIRED' | 'LEGACY_OVERSIGHT';
  responsibility?: { code: string; resourceSetKey: string };
  scopeKeys: readonly string[];
  requiresProductEntitlement: boolean;
  readOnly: boolean;
  activationState: string;
  validUntil?: string;
};

export type EffectivePolicyGrant = {
  grantKind: 'POLICY';
  accessPolicyKey: string;
  authorityMode:
    'ENTITLEMENT' | 'RELATIONSHIP' | 'ENTITLEMENT_AND_RELATIONSHIP' | 'SUPPORT_SESSION';
  policyDecisionRef: string;
  scopeKeys: readonly string[];
  requiresProductEntitlement: boolean;
  readOnly: boolean;
  validUntil?: string;
};

export type EffectiveGrant = EffectiveCapabilityGrant | EffectivePolicyGrant;

export type EffectiveProductSurfaceContext = {
  contextKey: string;
  productKey: string;
  surfaceKey: string;
  plane: ProductPlane;
  accessMode: ProductAccessMode;
  accessSource: ProductAccessSource;
  appResourceKey: string;
  effectiveGrants: readonly EffectiveGrant[];
  scopes: readonly EffectiveScope[];
  revalidateAt: string;
};

export type EffectiveProductSurfaceContextEnvelope = {
  contractVersion: string;
  decisionRevision: string;
  sourceRevisions: Readonly<Record<string, string>>;
  activeAccessMode: ProductAccessMode;
  generatedAt: string;
  contexts: readonly EffectiveProductSurfaceContext[];
};

export type SurfaceDecisionDetail = {
  decisionRevision?: string;
  validUntil?: string;
  expiredAt?: string;
  requiredAssurance?: string;
  requestPolicyRef?: string;
  correlationId?: string;
};

export type SurfaceDeniedState =
  | 'app-denied'
  | 'surface-denied'
  | 'route-denied'
  | 'scope-selection-required'
  | 'scope-invalid'
  | 'expired'
  | 'activation-required'
  | 'step-up-required'
  | 'sod-conflict'
  | 'support-scope-denied'
  | 'authority-unavailable';

export type AllowedSurfaceDecision = {
  state: 'allowed';
  context: EffectiveProductSurfaceContext;
  routeGrantRef: string;
  scope: EffectiveScope;
  effectiveReadOnly: boolean;
  revalidateAt: string;
  decisionRevision: string;
};

export type SurfaceDecision =
  AllowedSurfaceDecision | { state: SurfaceDeniedState; detail?: SurfaceDecisionDetail };

export type ProductSurfaceDirectEvaluation = {
  decision: string;
  decisionRevision?: string;
  context?: EffectiveProductSurfaceContext;
  routeGrantRef?: string;
  scope?: EffectiveScope;
  effectiveReadOnly?: boolean;
  revalidateAt?: string;
  validUntil?: string;
  expiredAt?: string;
  requiredAssurance?: string;
  requestPolicyRef?: string;
  correlationId?: string;
};

export type EffectiveScopeResolution =
  | { state: 'selected'; scope: EffectiveScope; canonicalize: boolean }
  | { state: 'scope-selection-required' }
  | { state: 'scope-invalid' }
  | { state: 'expired' }
  | { state: 'authority-unavailable' };

const DIRECT_DECISION_STATES: Readonly<Record<string, SurfaceDeniedState>> = {
  APP_DENIED: 'app-denied',
  SURFACE_DENIED: 'surface-denied',
  ROUTE_DENIED: 'route-denied',
  SCOPE_SELECTION_REQUIRED: 'scope-selection-required',
  SCOPE_INVALID: 'scope-invalid',
  EXPIRED: 'expired',
  ACTIVATION_REQUIRED: 'activation-required',
  STEP_UP_REQUIRED: 'step-up-required',
  SOD_CONFLICT: 'sod-conflict',
  SUPPORT_SCOPE_DENIED: 'support-scope-denied',
  AUTHORITY_UNAVAILABLE: 'authority-unavailable',
};

const REASON_CODE_STATES: Readonly<Record<string, SurfaceDeniedState>> = {
  APP_ENTITLEMENT_REQUIRED: 'app-denied',
  SURFACE_CAPABILITY_REQUIRED: 'surface-denied',
  ROUTE_CAPABILITY_REQUIRED: 'route-denied',
  ASSIGNMENT_EXPIRED: 'expired',
  ACTIVATION_REQUIRED: 'activation-required',
  STEP_UP_REQUIRED: 'step-up-required',
  SOD_CONFLICT: 'sod-conflict',
  SUPPORT_SCOPE_REQUIRED: 'support-scope-denied',
  SCOPE_CONTEXT_EXPIRED: 'scope-invalid',
  AUTHORITY_RESOLUTION_UNAVAILABLE: 'authority-unavailable',
};

function isExpired(isoValue: string | undefined, nowMs: number): boolean {
  if (!isoValue) return false;
  const timestamp = Date.parse(isoValue);
  return !Number.isFinite(timestamp) || timestamp <= nowMs;
}

export function resolveEffectiveScope(
  scopes: readonly EffectiveScope[],
  requestedScopeKey?: string,
  nowMs = Date.now()
): EffectiveScopeResolution {
  if (scopes.length === 0) return { state: 'authority-unavailable' };
  if (requestedScopeKey) {
    const requested = scopes.find((scope) => scope.key === requestedScopeKey);
    if (!requested) return { state: 'scope-invalid' };
    if (isExpired(requested.validUntil, nowMs)) return { state: 'expired' };
    return { state: 'selected', scope: requested, canonicalize: false };
  }
  if (scopes.length === 1) {
    const scope = scopes[0]!;
    if (isExpired(scope.validUntil, nowMs)) return { state: 'expired' };
    return { state: 'selected', scope, canonicalize: true };
  }
  const defaults = scopes.filter((scope) => scope.isDefault);
  if (defaults.length > 1) return { state: 'authority-unavailable' };
  if (defaults.length === 0) return { state: 'scope-selection-required' };
  const scope = defaults[0]!;
  if (isExpired(scope.validUntil, nowMs)) return { state: 'expired' };
  return { state: 'selected', scope, canonicalize: true };
}

function deniedDetail(evaluation: ProductSurfaceDirectEvaluation): SurfaceDecisionDetail {
  return {
    decisionRevision: evaluation.decisionRevision,
    validUntil: evaluation.validUntil,
    expiredAt: evaluation.expiredAt,
    requiredAssurance: evaluation.requiredAssurance,
    requestPolicyRef: evaluation.requestPolicyRef,
    correlationId: evaluation.correlationId,
  };
}

export function mapProductSurfaceDirectEvaluation(
  evaluation: ProductSurfaceDirectEvaluation,
  expected: { productKey: string; surfaceKey: string },
  nowMs = Date.now()
): SurfaceDecision {
  if (evaluation.decision !== 'ALLOWED') {
    return {
      state: DIRECT_DECISION_STATES[evaluation.decision] ?? 'authority-unavailable',
      detail: deniedDetail(evaluation),
    };
  }
  const { context, routeGrantRef, scope, effectiveReadOnly, revalidateAt, decisionRevision } =
    evaluation;
  const canonicalScope = context?.scopes.find((candidate) => candidate.key === scope?.key);
  const revalidateTimestamp = Date.parse(revalidateAt ?? '');
  const contextRevalidateTimestamp = Date.parse(context?.revalidateAt ?? '');
  if (
    !context ||
    context.productKey !== expected.productKey ||
    context.surfaceKey !== expected.surfaceKey ||
    !routeGrantRef?.trim() ||
    !scope ||
    !canonicalScope ||
    typeof effectiveReadOnly !== 'boolean' ||
    !revalidateAt ||
    !Number.isFinite(revalidateTimestamp) ||
    !Number.isFinite(contextRevalidateTimestamp) ||
    revalidateTimestamp > contextRevalidateTimestamp ||
    !decisionRevision
  ) {
    return { state: 'authority-unavailable' };
  }
  if (revalidateTimestamp <= nowMs) {
    return { state: 'expired', detail: { decisionRevision } };
  }
  return {
    state: 'allowed',
    context,
    routeGrantRef,
    scope: canonicalScope,
    effectiveReadOnly,
    revalidateAt,
    decisionRevision,
  };
}

export function mapProductSurfaceAccessError(error: {
  status?: number;
  reasonCode?: string;
  decisionRevision?: string;
  correlationId?: string;
}): SurfaceDecision {
  const mapped = error.reasonCode ? REASON_CODE_STATES[error.reasonCode] : undefined;
  const detail =
    error.decisionRevision || error.correlationId
      ? {
          decisionRevision: error.decisionRevision,
          correlationId: error.correlationId,
        }
      : undefined;
  if (mapped) return { state: mapped, ...(detail ? { detail } : {}) };
  if (error.status === 503) {
    return { state: 'authority-unavailable', ...(detail ? { detail } : {}) };
  }
  if (error.status === 401) {
    return { state: 'authority-unavailable', ...(detail ? { detail } : {}) };
  }
  if (error.status === 403) return { state: 'route-denied', ...(detail ? { detail } : {}) };
  if (error.status === 404) return { state: 'route-denied', ...(detail ? { detail } : {}) };
  return { state: 'authority-unavailable', ...(detail ? { detail } : {}) };
}

function grantIsEffectiveForScope(
  grant: EffectiveGrant,
  scopeKey: string | undefined,
  nowMs: number
): boolean {
  return (
    !isExpired(grant.validUntil, nowMs) &&
    (!scopeKey || grant.scopeKeys.includes(scopeKey)) &&
    (grant.grantKind !== 'CAPABILITY' || grant.activationState === 'ACTIVE')
  );
}

export function canContextAccessNavigation(
  access: ProductNavigationAccess,
  context: EffectiveProductSurfaceContext,
  scopeKey?: string,
  nowMs = Date.now()
): boolean {
  if (isExpired(context.revalidateAt, nowMs)) return false;
  const capabilityKeys = new Set(
    context.effectiveGrants
      .filter(
        (grant): grant is EffectiveCapabilityGrant =>
          grant.grantKind === 'CAPABILITY' && grantIsEffectiveForScope(grant, scopeKey, nowMs)
      )
      .map((grant) => grant.capabilityContractKey)
  );
  if (access.type === 'capability') return capabilityKeys.has(access.capabilityContractKey);
  if (access.type === 'capability-expression') {
    const matcher = access.mode === 'ALL' ? 'every' : 'some';
    return access.capabilityContractKeys[matcher]((key) => capabilityKeys.has(key));
  }
  return context.effectiveGrants.some(
    (grant) =>
      grant.grantKind === 'POLICY' &&
      grant.accessPolicyKey === access.accessPolicyKey &&
      grantIsEffectiveForScope(grant, scopeKey, nowMs)
  );
}
