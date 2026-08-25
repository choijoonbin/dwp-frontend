import type {
  ProductSurfaceContextListData,
  ProductSurfaceEffectiveContext,
  ProductSurfaceRollout,
} from '../api/auth-api';
import { isProductScopeKind } from './product-surface-scope-kind';

const ACCESS_MODES = new Set(['NORMAL', 'ELEVATED', 'PROVIDER_SUPPORT']);
const ACCESS_SOURCES = new Set(['ENTITLEMENT', 'RELATIONSHIP', 'MANAGEMENT', 'SUPPORT']);
const PLANES = new Set(['work', 'management']);
const ROLLOUT_STATES = new Set(['000', '100', '110', '111']);
const AUTHORITY_STATUSES = new Set(['NOT_EVALUATED', 'AVAILABLE', 'UNAVAILABLE']);
const CAPABILITY_AUTHORITY_MODES = new Set([
  'PERMISSION',
  'PERMISSION_AND_RELATIONSHIP',
  'PERMISSION_OR_RELATIONSHIP',
]);
const POLICY_AUTHORITY_MODES = new Set([
  'ENTITLEMENT',
  'RELATIONSHIP',
  'ENTITLEMENT_AND_RELATIONSHIP',
  'SUPPORT_SESSION',
]);
const RESPONSIBILITY_REQUIREMENTS = new Set(['REQUIRED', 'NOT_REQUIRED', 'LEGACY_OVERSIGHT']);
const ACTIVATION_STATES = new Set(['ACTIVE', 'ELIGIBLE']);

export type ProductSurfaceAuthoritySnapshot = {
  envelope: ProductSurfaceContextListData;
  receivedAtMs: number;
  clockOffsetMs: number;
  earliestRevalidateAtMs: number | null;
};

export type ProductRolloutResolution =
  | {
      state: 'ready';
      rollout: ProductSurfaceRollout;
      surfaceUiEvaluation: 'resolved' | 'unavailable';
    }
  | { state: 'authority-unavailable' };

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function nonBlank(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function validInstant(value: unknown): value is string {
  return nonBlank(value) && Number.isFinite(Date.parse(value));
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(nonBlank);
}

function nullableInstant(value: unknown): boolean {
  return value === undefined || value === null || validInstant(value);
}

function validScope(value: unknown): boolean {
  const scope = record(value);
  return Boolean(
    scope &&
    nonBlank(scope.key) &&
    nonBlank(scope.kind) &&
    isProductScopeKind(scope.kind) &&
    nonBlank(scope.displayName) &&
    typeof scope.isDefault === 'boolean' &&
    typeof scope.readOnly === 'boolean' &&
    nullableInstant(scope.validUntil)
  );
}

function validResponsibility(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  const responsibility = record(value);
  return Boolean(
    responsibility && nonBlank(responsibility.code) && nonBlank(responsibility.resourceSetKey)
  );
}

function validGrant(value: unknown): boolean {
  const grant = record(value);
  if (
    !grant ||
    !stringArray(grant.scopeKeys) ||
    typeof grant.requiresProductEntitlement !== 'boolean' ||
    typeof grant.readOnly !== 'boolean' ||
    !nullableInstant(grant.validUntil)
  ) {
    return false;
  }
  if (grant.grantKind === 'CAPABILITY') {
    return Boolean(
      nonBlank(grant.capabilityContractKey) &&
      nonBlank(grant.resolvedCapabilityCode) &&
      nonBlank(grant.authorityMode) &&
      CAPABILITY_AUTHORITY_MODES.has(grant.authorityMode) &&
      stringArray(grant.predicatePolicyKeys) &&
      nonBlank(grant.responsibilityRequirement) &&
      RESPONSIBILITY_REQUIREMENTS.has(grant.responsibilityRequirement) &&
      validResponsibility(grant.responsibility) &&
      nonBlank(grant.activationState) &&
      ACTIVATION_STATES.has(grant.activationState)
    );
  }
  return Boolean(
    grant.grantKind === 'POLICY' &&
    nonBlank(grant.accessPolicyKey) &&
    nonBlank(grant.policyDecisionRef) &&
    nonBlank(grant.authorityMode) &&
    POLICY_AUTHORITY_MODES.has(grant.authorityMode)
  );
}

/**
 * Provider support is a separate, session-bound read-only authority union. It must never carry
 * normal entitlement/capability authority or a writable scope across the wire boundary.
 */
export function isExclusiveProviderSupportContext(value: unknown): boolean {
  const context = record(value);
  const grants = context?.effectiveGrants;
  const scopes = context?.scopes;
  if (
    !context ||
    context.accessMode !== 'PROVIDER_SUPPORT' ||
    context.accessSource !== 'SUPPORT' ||
    !Array.isArray(grants) ||
    grants.length === 0 ||
    !Array.isArray(scopes) ||
    scopes.length === 0 ||
    !scopes.every((scope) => {
      const candidate = record(scope);
      return (
        validScope(scope) && candidate?.kind === 'SUPPORT_SESSION' && candidate.readOnly === true
      );
    })
  ) {
    return false;
  }

  const scopeKeys = new Set(
    scopes.flatMap((scope) => {
      const key = record(scope)?.key;
      return nonBlank(key) ? [key] : [];
    })
  );
  const defaultScopeCount = scopes.filter((scope) => record(scope)?.isDefault === true).length;
  if (scopeKeys.size !== scopes.length || defaultScopeCount > 1) return false;
  const referencedScopeKeys = new Set<string>();
  const grantsAreExclusive = grants.every((grant) => {
    const candidate = record(grant);
    if (
      !candidate ||
      !validGrant(grant) ||
      candidate.grantKind !== 'POLICY' ||
      candidate.authorityMode !== 'SUPPORT_SESSION' ||
      candidate.requiresProductEntitlement !== false ||
      candidate.readOnly !== true ||
      !Array.isArray(candidate.scopeKeys) ||
      candidate.scopeKeys.length === 0
    ) {
      return false;
    }
    for (const scopeKey of candidate.scopeKeys) {
      if (!nonBlank(scopeKey) || !scopeKeys.has(scopeKey)) return false;
      referencedScopeKeys.add(scopeKey);
    }
    return true;
  });
  return grantsAreExclusive && referencedScopeKeys.size === scopeKeys.size;
}

function containsProviderSupportAuthority(value: unknown): boolean {
  const context = record(value);
  const grants = context?.effectiveGrants;
  const scopes = context?.scopes;
  return Boolean(
    context?.accessSource === 'SUPPORT' ||
    (Array.isArray(grants) &&
      grants.some((grant) => record(grant)?.authorityMode === 'SUPPORT_SESSION')) ||
    (Array.isArray(scopes) && scopes.some((scope) => record(scope)?.kind === 'SUPPORT_SESSION'))
  );
}

function validContext(value: unknown, activeAccessMode: string, generatedAtMs: number): boolean {
  const context = record(value);
  if (
    !context ||
    !nonBlank(context.contextKey) ||
    !nonBlank(context.productKey) ||
    !nonBlank(context.surfaceKey) ||
    !nonBlank(context.plane) ||
    !PLANES.has(context.plane) ||
    !nonBlank(context.accessMode) ||
    context.accessMode !== activeAccessMode ||
    !nonBlank(context.accessSource) ||
    !ACCESS_SOURCES.has(context.accessSource) ||
    !nonBlank(context.appResourceKey) ||
    !Array.isArray(context.effectiveGrants) ||
    !context.effectiveGrants.every(validGrant) ||
    !Array.isArray(context.scopes) ||
    context.scopes.length === 0 ||
    !context.scopes.every(validScope) ||
    !validInstant(context.revalidateAt) ||
    Date.parse(context.revalidateAt) <= generatedAtMs
  ) {
    return false;
  }
  const scopeKeys = context.scopes.map((scope) => record(scope)?.key);
  const defaults = context.scopes.filter((scope) => record(scope)?.isDefault === true);
  const scopeKeySet = new Set(scopeKeys);
  return (
    (activeAccessMode === 'PROVIDER_SUPPORT'
      ? isExclusiveProviderSupportContext(context)
      : !containsProviderSupportAuthority(context)) &&
    scopeKeySet.size === scopeKeys.length &&
    defaults.length <= 1 &&
    context.effectiveGrants.every((grant) =>
      (record(grant)?.scopeKeys as unknown[]).every((scopeKey) => scopeKeySet.has(scopeKey))
    )
  );
}

function validSourceRevisions(value: unknown): boolean {
  const revisions = record(value);
  return Boolean(
    revisions &&
    Object.values(revisions).every(
      (revision) => revision === undefined || revision === null || nonBlank(revision)
    )
  );
}

export function parseProductSurfaceAuthoritySnapshot(
  value: unknown,
  receivedAtMs = Date.now()
): ProductSurfaceAuthoritySnapshot {
  const envelope = record(value);
  if (
    !envelope ||
    !nonBlank(envelope.contractVersion) ||
    !nonBlank(envelope.decisionRevision) ||
    !validSourceRevisions(envelope.sourceRevisions) ||
    !nonBlank(envelope.activeAccessMode) ||
    !ACCESS_MODES.has(envelope.activeAccessMode) ||
    !validInstant(envelope.generatedAt) ||
    !Array.isArray(envelope.contexts) ||
    !Array.isArray(envelope.rollouts)
  ) {
    throw new Error('Product surface authority envelope is invalid.');
  }
  const generatedAtMs = Date.parse(envelope.generatedAt);
  if (
    !envelope.contexts.every((context) =>
      validContext(context, envelope.activeAccessMode as string, generatedAtMs)
    )
  ) {
    throw new Error('Product surface authority context is invalid.');
  }
  const contexts = envelope.contexts as ProductSurfaceEffectiveContext[];
  const contextKeys = contexts.map((context) => context.contextKey);
  const surfaceKeys = contexts.map(
    (context) => `${context.productKey}:${context.surfaceKey}:${context.accessMode}`
  );
  if (
    new Set(contextKeys).size !== contextKeys.length ||
    new Set(surfaceKeys).size !== surfaceKeys.length ||
    envelope.rollouts.some((rollout) => {
      const value = record(rollout);
      return (
        !nonBlank(value?.productKey) ||
        !nonBlank(value?.authorityStatus) ||
        !AUTHORITY_STATUSES.has(value.authorityStatus)
      );
    })
  ) {
    throw new Error('Product surface authority contains duplicate or invalid identities.');
  }
  const revalidateTimes = contexts.map((context) => Date.parse(context.revalidateAt));
  return {
    envelope: envelope as unknown as ProductSurfaceContextListData,
    receivedAtMs,
    clockOffsetMs: generatedAtMs - receivedAtMs,
    earliestRevalidateAtMs: revalidateTimes.length ? Math.min(...revalidateTimes) : null,
  };
}

function rolloutBits(rollout: ProductSurfaceRollout): string {
  return `${rollout.flags.contextShadow ? 1 : 0}${rollout.flags.capabilityEnforcement ? 1 : 0}${rollout.flags.surfaceUi ? 1 : 0}`;
}

export function resolveProductRollout(
  snapshot: ProductSurfaceAuthoritySnapshot,
  productKey: string
): ProductRolloutResolution {
  const matches = snapshot.envelope.rollouts.filter((rollout) => rollout.productKey === productKey);
  if (matches.length !== 1) return { state: 'authority-unavailable' };
  const rollout = matches[0]!;
  const flags = record(rollout.flags);
  const authorityStatus = rollout.authorityStatus;
  const statusMatchesState =
    (rollout.state === '000' && authorityStatus === 'NOT_EVALUATED') ||
    (rollout.state === '100' && AUTHORITY_STATUSES.has(authorityStatus)) ||
    (rollout.state === '110' && authorityStatus === 'AVAILABLE') ||
    (rollout.state === '111' && authorityStatus === 'AVAILABLE');
  if (
    !ROLLOUT_STATES.has(rollout.state) ||
    !flags ||
    typeof flags.contextShadow !== 'boolean' ||
    typeof flags.capabilityEnforcement !== 'boolean' ||
    typeof flags.surfaceUi !== 'boolean' ||
    rolloutBits(rollout) !== rollout.state ||
    !nonBlank(rollout.cohort) ||
    !nonBlank(rollout.opaqueRevision) ||
    !statusMatchesState
  ) {
    return { state: 'authority-unavailable' };
  }
  return {
    state: 'ready',
    rollout,
    surfaceUiEvaluation: 'resolved',
  };
}

export function productSurfaceServerNow(
  snapshot: ProductSurfaceAuthoritySnapshot,
  clientNowMs = Date.now()
): number {
  return clientNowMs + snapshot.clockOffsetMs;
}

export function productSurfaceRefreshDelay(
  snapshot: ProductSurfaceAuthoritySnapshot,
  clientNowMs = Date.now(),
  maximumDelayMs = 60_000
): number {
  if (!Number.isFinite(maximumDelayMs) || maximumDelayMs <= 0) return 0;
  if (snapshot.earliestRevalidateAtMs === null) return maximumDelayMs;
  const remaining =
    snapshot.earliestRevalidateAtMs - productSurfaceServerNow(snapshot, clientNowMs);
  return Math.max(0, Math.min(maximumDelayMs, remaining));
}
