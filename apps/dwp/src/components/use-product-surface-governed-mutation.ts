import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  HttpError,
  HttpTransportError,
  productSurfaceServerNow,
  useAuth,
  useProductSurfaceAuthority,
} from '@dwp-frontend/shared-utils';

import { useOptionalAllowedProductSurface } from './allowed-product-surface-context';
import { isProductScopeKind, productScopeIdentitiesAreKnownAndUnique } from './product-manifest';
import { useProductSurfaceTelemetry } from '../observability/product-surface-telemetry-context';
import {
  ProductSurfaceOperationCancelledError,
  isProductSurfaceOperationCancelledError,
  productSurfaceOperationCoordinator,
  sameProductSurfaceOperationIdentity,
} from './product-surface-operation-coordinator';

import type {
  ProductSurfaceAuthoritySnapshot,
  ProductSurfaceEvaluationData,
  ProductSurfaceEvaluationRequest,
  ProductSurfaceGovernedMutationAuthority,
  ProductSurfaceSecureMutationAuthority,
} from '@dwp-frontend/shared-utils';
import type {
  ProductSurfaceReasonCode,
  ProductSurfaceTaskKind,
} from '@dwp-frontend/shared-utils/api/observability-api';
import type {
  ProductSurfaceOperationIdentity,
  ProductSurfaceOperationTicket,
} from './product-surface-operation-coordinator';

export { isProductSurfaceOperationCancelledError };

export type ProductSurfaceMutationBinding = Readonly<{
  productKey: string;
  surfaceKey: string;
  routeContractKey: string;
  taskKind: ProductSurfaceTaskKind;
}>;

export type ProductSurfaceMutationEntryAuthority = Readonly<{
  contextScopeKey: string;
  contextScopeKind: string;
  accessMode: ProductSurfaceAuthoritySnapshot['envelope']['activeAccessMode'];
  plane: string;
  canonicalScopes: readonly Readonly<{ key: string; kind: string }>[];
}>;

export class ProductSurfaceMutationAuthorityError extends Error {
  constructor() {
    super('Product surface mutation authority is unavailable.');
    this.name = 'ProductSurfaceMutationAuthorityError';
  }
}

export type ProductSurfaceTaskFailureDisposition =
  | Readonly<{ kind: 'abandoned' }>
  | Readonly<{ kind: 'failed'; reasonCode: ProductSurfaceReasonCode }>;

const PRODUCT_SURFACE_REASON_CODES = new Set<ProductSurfaceReasonCode>([
  'APP_DENIED',
  'SURFACE_DENIED',
  'ROUTE_DENIED',
  'SCOPE_SELECTION_REQUIRED',
  'SCOPE_INVALID',
  'EXPIRED',
  'ACTIVATION_REQUIRED',
  'STEP_UP_REQUIRED',
  'SOD_CONFLICT',
  'SUPPORT_SCOPE_DENIED',
  'AUTHORITY_UNAVAILABLE',
  'NETWORK_ERROR',
  'CANCELLED',
  'VALIDATION_ERROR',
]);

function productSurfaceErrorCode(error: HttpError): string | null {
  if (!error.details || typeof error.details !== 'object' || Array.isArray(error.details)) {
    return null;
  }
  const value = (error.details as Record<string, unknown>).errorCode;
  return typeof value === 'string' && value.trim() ? value.trim().toUpperCase() : null;
}

export function classifyProductSurfaceTaskFailure(
  error: unknown
): ProductSurfaceTaskFailureDisposition {
  if (
    isProductSurfaceOperationCancelledError(error) ||
    (error instanceof HttpTransportError && error.reason === 'ABORT')
  ) {
    return { kind: 'abandoned' };
  }
  if (error instanceof ProductSurfaceMutationAuthorityError) {
    return { kind: 'failed', reasonCode: 'AUTHORITY_UNAVAILABLE' };
  }
  if (error instanceof HttpTransportError) {
    return { kind: 'failed', reasonCode: 'NETWORK_ERROR' };
  }
  if (error instanceof HttpError) {
    const code = productSurfaceErrorCode(error);
    if (code && PRODUCT_SURFACE_REASON_CODES.has(code as ProductSurfaceReasonCode)) {
      return { kind: 'failed', reasonCode: code as ProductSurfaceReasonCode };
    }
    if (code === 'INVALID_SCOPE_SELECTION') {
      return { kind: 'failed', reasonCode: 'SCOPE_INVALID' };
    }
    if (code === 'DECISION_REVISION_CONFLICT' || code === 'AUTHORITY_RESOLUTION_UNAVAILABLE') {
      return { kind: 'failed', reasonCode: 'AUTHORITY_UNAVAILABLE' };
    }
    if (error.status === 401) {
      return { kind: 'failed', reasonCode: 'AUTHORITY_UNAVAILABLE' };
    }
    if (error.status === 403) return { kind: 'failed', reasonCode: 'ROUTE_DENIED' };
    if (error.status === 400 || error.status === 409 || error.status === 422) {
      return { kind: 'failed', reasonCode: 'VALIDATION_ERROR' };
    }
    if (error.status >= 500) return { kind: 'failed', reasonCode: 'NETWORK_ERROR' };
  }
  return { kind: 'failed', reasonCode: 'NETWORK_ERROR' };
}

function nonBlank(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function resolveProductSurfaceMutationEntryBinding(
  snapshot: ProductSurfaceAuthoritySnapshot | undefined,
  binding: Pick<ProductSurfaceMutationBinding, 'productKey' | 'surfaceKey'>,
  requestedScopeKey: string | undefined,
  clientNowMs = Date.now()
): ProductSurfaceMutationEntryAuthority | null {
  if (!snapshot) return null;
  const serverNowMs = productSurfaceServerNow(snapshot, clientNowMs);
  const contexts = snapshot.envelope.contexts.filter(
    (context) =>
      context.productKey === binding.productKey && context.surfaceKey === binding.surfaceKey
  );
  if (contexts.length !== 1) return null;
  const context = contexts[0]!;
  const revalidateAtMs = Date.parse(context.revalidateAt);
  if (
    !nonBlank(context.contextKey) ||
    !nonBlank(context.appResourceKey) ||
    !nonBlank(context.plane) ||
    context.accessMode !== snapshot.envelope.activeAccessMode ||
    !productScopeIdentitiesAreKnownAndUnique(context.scopes) ||
    !Number.isFinite(revalidateAtMs) ||
    revalidateAtMs <= serverNowMs
  ) {
    return null;
  }
  const scopes = context.scopes.filter((scope) => {
    const validUntilMs = scope.validUntil ? Date.parse(scope.validUntil) : undefined;
    return (
      !scope.readOnly &&
      (validUntilMs === undefined || (Number.isFinite(validUntilMs) && validUntilMs > serverNowMs))
    );
  });
  const selected = requestedScopeKey
    ? scopes.filter((scope) => scope.key === requestedScopeKey)
    : scopes.length === 1
      ? scopes
      : [];
  return selected.length === 1 && nonBlank(selected[0]!.key)
    ? {
        contextScopeKey: selected[0]!.key,
        contextScopeKind: selected[0]!.kind,
        accessMode: context.accessMode,
        plane: context.plane,
        canonicalScopes: context.scopes.map((scope) => ({ key: scope.key, kind: scope.kind })),
      }
    : null;
}

export function buildProductSurfaceMutationEvaluationRequest(
  binding: ProductSurfaceMutationBinding,
  entry: ProductSurfaceMutationEntryAuthority
): ProductSurfaceEvaluationRequest {
  return {
    subject: {
      type: 'PRODUCT',
      productKey: binding.productKey,
      surfaceKey: binding.surfaceKey,
    },
    routeContractKey: binding.routeContractKey,
    contextScopeKey: entry.contextScopeKey,
  };
}

export function secureProductSurfaceMutationAuthority(
  rolloutState: '110' | '111',
  binding: ProductSurfaceMutationBinding,
  requested: ProductSurfaceMutationEntryAuthority,
  evaluation: ProductSurfaceEvaluationData,
  serverNowMs: number
): ProductSurfaceSecureMutationAuthority | null {
  const candidate = record(evaluation);
  const context = record(candidate?.context);
  const evaluatedScope = record(candidate?.scope);
  if (
    !candidate ||
    !context ||
    !evaluatedScope ||
    !Number.isFinite(serverNowMs) ||
    !Array.isArray(context.scopes) ||
    !context.scopes.every((scope) => Boolean(record(scope))) ||
    !Array.isArray(context.effectiveGrants) ||
    !context.effectiveGrants.every((grant) => Boolean(record(grant)))
  ) {
    return null;
  }
  const optionalExpiryIsFresh = (value: unknown) => {
    if (value == null) return true;
    if (!nonBlank(value)) return false;
    const expiryMs = Date.parse(value);
    return Number.isFinite(expiryMs) && expiryMs > serverNowMs;
  };
  const stringArray = (value: unknown): value is string[] =>
    Array.isArray(value) && value.every(nonBlank);
  const responsibilityIsWellFormed = (value: unknown) => {
    if (value == null) return true;
    const responsibility = record(value);
    return Boolean(
      responsibility && nonBlank(responsibility.code) && nonBlank(responsibility.resourceSetKey)
    );
  };
  const contextScopes = context.scopes.map((scope) => record(scope)!);
  const contextScopeKeys = new Set(contextScopes.map((scope) => scope.key));
  const grants = context.effectiveGrants.map((grant) => record(grant)!);
  const grantIsWellFormed = (grant: Record<string, unknown>) => {
    if (
      !stringArray(grant.scopeKeys) ||
      !grant.scopeKeys.every((scopeKey) => contextScopeKeys.has(scopeKey)) ||
      typeof grant.requiresProductEntitlement !== 'boolean' ||
      typeof grant.readOnly !== 'boolean' ||
      !optionalExpiryIsFresh(grant.validUntil)
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
        stringArray(grant.predicatePolicyKeys) &&
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
  };
  const selectedDirectScopes = contextScopes.filter(
    (scope) => scope.key === requested.contextScopeKey && scope.kind === requested.contextScopeKind
  );
  const selectedDirectScope =
    selectedDirectScopes.length === 1 ? selectedDirectScopes[0] : undefined;
  const writableRouteGrants = grants.filter((grant) => {
    if (
      !grantIsWellFormed(grant) ||
      grant.readOnly ||
      !(grant.scopeKeys as string[]).includes(requested.contextScopeKey)
    ) {
      return false;
    }
    return grant.grantKind === 'CAPABILITY'
      ? grant.activationState === 'ACTIVE'
      : grant.grantKind === 'POLICY';
  });
  const revalidateAtMs = nonBlank(candidate.revalidateAt)
    ? Date.parse(candidate.revalidateAt)
    : Number.NaN;
  const contextRevalidateAtMs = nonBlank(context.revalidateAt)
    ? Date.parse(context.revalidateAt)
    : Number.NaN;
  if (
    candidate.decision !== 'ALLOWED' ||
    !nonBlank(candidate.decisionRevision) ||
    context.productKey !== binding.productKey ||
    context.surfaceKey !== binding.surfaceKey ||
    context.accessMode !== requested.accessMode ||
    context.plane !== requested.plane ||
    !nonBlank(context.contextKey) ||
    !nonBlank(context.appResourceKey) ||
    contextScopes.length === 0 ||
    contextScopeKeys.size !== contextScopes.length ||
    contextScopes.some(
      (scope) =>
        !nonBlank(scope.key) ||
        !nonBlank(scope.kind) ||
        !isProductScopeKind(scope.kind) ||
        !nonBlank(scope.displayName) ||
        typeof scope.isDefault !== 'boolean' ||
        typeof scope.readOnly !== 'boolean' ||
        !optionalExpiryIsFresh(scope.validUntil) ||
        !requested.canonicalScopes.some(
          (canonical) => canonical.key === scope.key && canonical.kind === scope.kind
        )
    ) ||
    !selectedDirectScope ||
    !grants.every(grantIsWellFormed) ||
    writableRouteGrants.length !== 1 ||
    evaluatedScope.key !== requested.contextScopeKey ||
    evaluatedScope.kind !== requested.contextScopeKind ||
    !nonBlank(evaluatedScope.displayName) ||
    evaluatedScope.displayName !== selectedDirectScope.displayName ||
    typeof evaluatedScope.isDefault !== 'boolean' ||
    evaluatedScope.isDefault !== selectedDirectScope.isDefault ||
    typeof evaluatedScope.readOnly !== 'boolean' ||
    evaluatedScope.readOnly !== selectedDirectScope.readOnly ||
    evaluatedScope.validUntil !== selectedDirectScope.validUntil ||
    evaluatedScope.readOnly ||
    candidate.effectiveReadOnly !== false ||
    !nonBlank(candidate.routeGrantRef) ||
    !optionalExpiryIsFresh(evaluatedScope.validUntil) ||
    !optionalExpiryIsFresh(candidate.validUntil) ||
    !Number.isFinite(revalidateAtMs) ||
    !Number.isFinite(contextRevalidateAtMs) ||
    revalidateAtMs > contextRevalidateAtMs ||
    contextRevalidateAtMs <= serverNowMs ||
    revalidateAtMs <= serverNowMs
  ) {
    return null;
  }
  return {
    mode: 'SECURE',
    rolloutState,
    expectedDecisionRevision: candidate.decisionRevision,
    contextKey: context.contextKey,
    contextScopeKey: evaluatedScope.key as string,
  };
}

export function useProductSurfaceGovernedMutation(binding: ProductSurfaceMutationBinding) {
  const auth = useAuth();
  const telemetry = useProductSurfaceTelemetry();
  const pageDecision = useOptionalAllowedProductSurface();
  const authority = useProductSurfaceAuthority();
  const rollout = authority.rolloutForProduct(binding.productKey);
  const rolloutState = rollout.state === 'ready' ? rollout.rollout.state : undefined;
  const selectedScopeKey =
    pageDecision?.context.productKey === binding.productKey &&
    pageDecision.context.surfaceKey === binding.surfaceKey
      ? pageDecision.scope.key
      : undefined;
  const entry = useMemo(
    () => resolveProductSurfaceMutationEntryBinding(authority.snapshot, binding, selectedScopeKey),
    [authority.snapshot, binding, selectedScopeKey]
  );
  const operationIdentity = useMemo<ProductSurfaceOperationIdentity | null>(
    () =>
      entry &&
      authority.snapshot &&
      pageDecision?.context.productKey === binding.productKey &&
      pageDecision.context.surfaceKey === binding.surfaceKey
        ? {
            productKey: binding.productKey,
            surfaceKey: binding.surfaceKey,
            tenantId: String(auth.user?.tenantId ?? ''),
            actorId: String(auth.user?.userId ?? ''),
            accessMode: authority.snapshot.envelope.activeAccessMode,
            contextKey: pageDecision.context.contextKey,
            contextScopeKey: entry.contextScopeKey,
            decisionRevision: pageDecision.decisionRevision,
          }
        : null,
    [
      auth.user?.tenantId,
      auth.user?.userId,
      authority.snapshot,
      binding.productKey,
      binding.surfaceKey,
      entry,
      pageDecision,
    ]
  );
  const operationIdentityRef = useRef(operationIdentity);
  operationIdentityRef.current = operationIdentity;
  const ownedTickets = useRef(new Set<ProductSurfaceOperationTicket>());

  useLayoutEffect(() => {
    if (operationIdentity) {
      productSurfaceOperationCoordinator.observeIdentity(operationIdentity);
    } else {
      productSurfaceOperationCoordinator.observeAuthorityUnavailable(binding);
    }
  }, [binding, operationIdentity]);

  useEffect(
    () => () => {
      for (const ticket of ownedTickets.current) ticket.cancel();
      ownedTickets.current.clear();
    },
    []
  );

  return useCallback(
    async <T>(
      execute: (mutationAuthority: ProductSurfaceGovernedMutationAuthority) => Promise<T>
    ): Promise<T> => {
      const task = telemetry.beginTask(binding.productKey, binding.surfaceKey, binding.taskKind);
      try {
        const result = await (async () => {
          if (rolloutState === '000' || rolloutState === '100') {
            return execute({ mode: 'LEGACY_COMPATIBILITY', rolloutState });
          }
          if (
            (rolloutState !== '110' && rolloutState !== '111') ||
            authority.status !== 'ready' ||
            !authority.snapshot ||
            !entry ||
            !operationIdentity
          ) {
            throw new ProductSurfaceMutationAuthorityError();
          }
          const ticket = productSurfaceOperationCoordinator.beginOperation(binding);
          ownedTickets.current.add(ticket);
          let dispatched = false;
          try {
            const evaluation = await authority.evaluateProduct(
              buildProductSurfaceMutationEvaluationRequest(binding, entry),
              { signal: ticket.signal }
            );
            ticket.assertCurrent();
            if (
              !sameProductSurfaceOperationIdentity(operationIdentityRef.current, operationIdentity)
            ) {
              throw new ProductSurfaceOperationCancelledError();
            }
            const secure = secureProductSurfaceMutationAuthority(
              rolloutState,
              binding,
              entry,
              evaluation,
              productSurfaceServerNow(authority.snapshot)
            );
            if (!secure) throw new ProductSurfaceMutationAuthorityError();
            ticket.assertCurrent();
            if (
              !sameProductSurfaceOperationIdentity(operationIdentityRef.current, operationIdentity)
            ) {
              throw new ProductSurfaceOperationCancelledError();
            }
            ticket.markDispatched();
            dispatched = true;
            return await execute(secure);
          } catch (error) {
            if (dispatched) throw error;
            if (ticket.signal.aborted) throw new ProductSurfaceOperationCancelledError();
            ticket.assertCurrent();
            throw error;
          } finally {
            ticket.finish();
            ownedTickets.current.delete(ticket);
          }
        })();
        telemetry.completeTask(
          binding.productKey,
          binding.surfaceKey,
          binding.taskKind,
          task.attemptId,
          task.startedAtMs
        );
        return result;
      } catch (error) {
        const failure = classifyProductSurfaceTaskFailure(error);
        if (failure.kind === 'abandoned') {
          telemetry.abandonTask(
            binding.productKey,
            binding.surfaceKey,
            binding.taskKind,
            task.attemptId,
            task.startedAtMs
          );
        } else {
          telemetry.failTask(
            binding.productKey,
            binding.surfaceKey,
            binding.taskKind,
            task.attemptId,
            failure.reasonCode
          );
        }
        throw error;
      }
    },
    [authority, binding, entry, operationIdentity, rolloutState, telemetry]
  );
}
