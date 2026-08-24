export type ProductSurfaceStepUpProof = Readonly<{
  challenge: string;
  challengeId: string;
  decisionRevision: string;
  expiresAt: string;
}>;

export type ProductSurfaceLegacyMutationAuthority = Readonly<{
  mode: 'LEGACY_COMPATIBILITY';
  rolloutState: '000' | '100';
}>;

export type ProductSurfaceSecureMutationAuthority = Readonly<{
  mode: 'SECURE';
  rolloutState: '110' | '111';
  expectedDecisionRevision: string;
  contextKey: string;
  contextScopeKey: string;
  objectVersion?: number;
  idempotencyKey?: string;
  stepUp?: ProductSurfaceStepUpProof;
}>;

export type ProductSurfaceGovernedMutationAuthority =
  | ProductSurfaceLegacyMutationAuthority
  | ProductSurfaceSecureMutationAuthority;

export const PRODUCT_SURFACE_EXPECTED_DECISION_REVISION_HEADER =
  'X-DWP-Expected-Decision-Revision' as const;
export const PRODUCT_SURFACE_STEP_UP_CHALLENGE_HEADER = 'X-DWP-Step-Up-Challenge' as const;
export const PRODUCT_SURFACE_IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key' as const;
export const PRODUCT_SURFACE_EXPECTED_OBJECT_VERSION_HEADER =
  'X-DWP-Expected-Object-Version' as const;

function nonBlank(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function buildProductSurfaceGovernedMutationHeaders(
  authority: ProductSurfaceGovernedMutationAuthority,
  options: { objectVersionHeader?: boolean } = {}
): Record<string, string> {
  if (authority.mode === 'LEGACY_COMPATIBILITY') return {};
  if (
    !nonBlank(authority.expectedDecisionRevision) ||
    !nonBlank(authority.contextKey) ||
    !nonBlank(authority.contextScopeKey) ||
    (authority.idempotencyKey !== undefined && !nonBlank(authority.idempotencyKey)) ||
    (authority.objectVersion !== undefined &&
      (!Number.isSafeInteger(authority.objectVersion) || authority.objectVersion < 0))
  ) {
    throw new Error('Product surface governed mutation authority is invalid.');
  }
  if (
    authority.stepUp &&
    (!nonBlank(authority.stepUp.challenge) ||
      !nonBlank(authority.stepUp.challengeId) ||
      authority.stepUp.decisionRevision !== authority.expectedDecisionRevision ||
      !Number.isFinite(Date.parse(authority.stepUp.expiresAt)) ||
      !nonBlank(authority.idempotencyKey) ||
      authority.objectVersion === undefined)
  ) {
    throw new Error('Product surface governed step-up proof is invalid.');
  }
  if (options.objectVersionHeader && authority.objectVersion === undefined) {
    throw new Error('Product surface governed object-version precondition is required.');
  }
  return {
    [PRODUCT_SURFACE_EXPECTED_DECISION_REVISION_HEADER]: authority.expectedDecisionRevision,
    ...(authority.idempotencyKey
      ? { [PRODUCT_SURFACE_IDEMPOTENCY_KEY_HEADER]: authority.idempotencyKey }
      : {}),
    ...(authority.stepUp
      ? { [PRODUCT_SURFACE_STEP_UP_CHALLENGE_HEADER]: authority.stepUp.challenge }
      : {}),
    ...(options.objectVersionHeader
      ? { [PRODUCT_SURFACE_EXPECTED_OBJECT_VERSION_HEADER]: String(authority.objectVersion) }
      : {}),
  };
}

export function productSurfaceGovernedMutationConfig(
  authority: ProductSurfaceGovernedMutationAuthority,
  options?: { objectVersionHeader?: boolean }
): { headers: Record<string, string>; contextScopeKey?: string } {
  return {
    headers: buildProductSurfaceGovernedMutationHeaders(authority, options),
    ...(authority.mode === 'SECURE' ? { contextScopeKey: authority.contextScopeKey } : {}),
  };
}
