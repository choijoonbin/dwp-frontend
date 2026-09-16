import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  productSurfaceServerNow,
  useAuth,
  useProductSurfaceAuthority,
  type ProductSurfaceGovernedMutationAuthority,
} from '@dwp-frontend/shared-utils';

import { useOptionalAllowedProductSurface } from './allowed-product-surface-context';
import {
  ProductSurfaceMutationAuthorityError,
  buildProductSurfaceMutationEvaluationRequest,
  classifyProductSurfaceTaskFailure,
  resolveProductSurfaceMutationEntryBinding,
  secureProductSurfaceMutationAuthority,
} from './use-product-surface-governed-mutation';
import {
  productActionMutationBinding,
  type ProductActionRouteContractKey,
} from './use-product-action-mutation';
import { useProductSurfaceTelemetry } from '../observability/product-surface-telemetry-context';
import {
  ProductSurfaceOperationCancelledError,
  productSurfaceOperationCoordinator,
  sameProductSurfaceOperationIdentity,
} from './product-surface-operation-coordinator';

import type { ProductSurfaceAuthoritySnapshot } from '@dwp-frontend/shared-utils';
import type { ProductSurfaceMutationBinding } from './use-product-surface-governed-mutation';
import type { AllowedSurfaceDecision } from '../features/shell/product-surface-context';
import type {
  ProductSurfaceOperationIdentity,
  ProductSurfaceOperationTicket,
} from './product-surface-operation-coordinator';

function remainsFresh(value: string | null | undefined, nowMs: number) {
  if (value == null) return true;
  const instant = Date.parse(value);
  return Number.isFinite(instant) && instant > nowMs;
}

/**
 * Resolves a target product scope for an embedded/contextual action without borrowing the host
 * page's scope. Ambiguous target scopes fail closed unless the target declares one default scope.
 */
export function resolveContextualProductSurfaceScopeKey(
  snapshot: ProductSurfaceAuthoritySnapshot | undefined,
  binding: Pick<ProductSurfaceMutationBinding, 'productKey' | 'surfaceKey'>,
  pageDecision: AllowedSurfaceDecision | null,
  requiredScopeKind: string,
  clientNowMs = Date.now()
): string | undefined {
  if (!snapshot) return undefined;
  const serverNowMs = productSurfaceServerNow(snapshot, clientNowMs);
  const contexts = snapshot.envelope.contexts.filter(
    (context) =>
      context.productKey === binding.productKey && context.surfaceKey === binding.surfaceKey
  );
  if (contexts.length !== 1) return undefined;
  const context = contexts[0]!;
  if (
    context.accessMode !== snapshot.envelope.activeAccessMode ||
    !context.contextKey.trim() ||
    !context.appResourceKey.trim() ||
    !context.plane.trim() ||
    !remainsFresh(context.revalidateAt, serverNowMs)
  )
    return undefined;
  const scopeKeys = new Set(context.scopes.map((scope) => scope.key));
  if (scopeKeys.size !== context.scopes.length) return undefined;
  const scopes = context.scopes.filter(
    (scope) =>
      scope.kind === requiredScopeKind &&
      !scope.readOnly &&
      scope.key.trim() &&
      remainsFresh(scope.validUntil, serverNowMs)
  );
  const directScopeKey =
    pageDecision?.context.productKey === binding.productKey &&
    pageDecision.context.surfaceKey === binding.surfaceKey
      ? pageDecision.scope.key
      : undefined;
  if (directScopeKey && scopes.filter((scope) => scope.key === directScopeKey).length === 1)
    return directScopeKey;
  if (scopes.length === 1) return scopes[0]!.key;
  const defaults = scopes.filter((scope) => scope.isDefault);
  return defaults.length === 1 ? defaults[0]!.key : undefined;
}

export function hasContextualProductSurfaceCapability(
  snapshot: ProductSurfaceAuthoritySnapshot | undefined,
  binding: Pick<ProductSurfaceMutationBinding, 'productKey' | 'surfaceKey'>,
  contextScopeKey: string | undefined,
  capabilityContractKey: string,
  clientNowMs = Date.now()
) {
  if (!snapshot || !contextScopeKey || !capabilityContractKey.trim()) return false;
  const nowMs = productSurfaceServerNow(snapshot, clientNowMs);
  const contexts = snapshot.envelope.contexts.filter(
    (context) =>
      context.productKey === binding.productKey && context.surfaceKey === binding.surfaceKey
  );
  if (contexts.length !== 1) return false;
  const context = contexts[0]!;
  const scopes = context.scopes.filter((scope) => scope.key === contextScopeKey);
  if (
    scopes.length !== 1 ||
    scopes[0]!.readOnly ||
    !remainsFresh(scopes[0]!.validUntil, nowMs) ||
    !remainsFresh(context.revalidateAt, nowMs)
  )
    return false;
  return (
    context.effectiveGrants.some(
      (grant) =>
        grant.grantKind === 'CAPABILITY' &&
        grant.capabilityContractKey === capabilityContractKey &&
        !grant.readOnly &&
        grant.scopeKeys.includes(contextScopeKey) &&
        grant.activationState === 'ACTIVE' &&
        remainsFresh(grant.validUntil, nowMs)
    ) === true &&
    context.effectiveGrants.filter(
      (grant) =>
        grant.grantKind === 'CAPABILITY' &&
        grant.capabilityContractKey === capabilityContractKey &&
        grant.scopeKeys.includes(contextScopeKey)
    ).length === 1
  );
}

/**
 * Executes an ACTION owned by another product surface, such as a Services command embedded in
 * Work. The target product's own scope, capability and exact route are authoritative.
 */
export function useContextualProductActionMutation(
  routeContractKey: ProductActionRouteContractKey,
  capabilityContractKey: string,
  requiredScopeKind: string
) {
  const auth = useAuth();
  const telemetry = useProductSurfaceTelemetry();
  const authority = useProductSurfaceAuthority();
  const pageDecision = useOptionalAllowedProductSurface();
  const binding = productActionMutationBinding(routeContractKey);
  const rollout = authority.rolloutForProduct(binding.productKey);
  const rolloutState = rollout.state === 'ready' ? rollout.rollout.state : undefined;
  const contextScopeKey = useMemo(
    () =>
      resolveContextualProductSurfaceScopeKey(
        authority.snapshot,
        binding,
        pageDecision,
        requiredScopeKind
      ),
    [authority.snapshot, binding, pageDecision, requiredScopeKind]
  );
  const entry = useMemo(
    () => resolveProductSurfaceMutationEntryBinding(authority.snapshot, binding, contextScopeKey),
    [authority.snapshot, binding, contextScopeKey]
  );
  const targetContext = useMemo(() => {
    const contexts = authority.snapshot?.envelope.contexts.filter(
      (context) =>
        context.productKey === binding.productKey && context.surfaceKey === binding.surfaceKey
    );
    return contexts?.length === 1 ? contexts[0] : undefined;
  }, [authority.snapshot, binding.productKey, binding.surfaceKey]);
  const governed = rolloutState === '110' || rolloutState === '111';
  const ready =
    rolloutState === '000' ||
    rolloutState === '100' ||
    (governed && authority.status === 'ready' && Boolean(authority.snapshot && entry));
  const hasWritableCapability =
    !governed ||
    hasContextualProductSurfaceCapability(
      authority.snapshot,
      binding,
      contextScopeKey,
      capabilityContractKey
    );
  const operationIdentity = useMemo<ProductSurfaceOperationIdentity | null>(
    () =>
      entry && authority.snapshot && targetContext
        ? {
            productKey: binding.productKey,
            surfaceKey: binding.surfaceKey,
            tenantId: String(auth.user?.tenantId ?? ''),
            actorId: String(auth.user?.userId ?? ''),
            accessMode: authority.snapshot.envelope.activeAccessMode,
            contextKey: targetContext.contextKey,
            contextScopeKey: entry.contextScopeKey,
            decisionRevision: authority.snapshot.envelope.decisionRevision,
          }
        : null,
    [
      auth.user?.tenantId,
      auth.user?.userId,
      authority.snapshot,
      binding.productKey,
      binding.surfaceKey,
      entry,
      targetContext,
    ]
  );
  const operationIdentityRef = useRef(operationIdentity);
  operationIdentityRef.current = operationIdentity;
  const ownedTickets = useRef(new Set<ProductSurfaceOperationTicket>());

  useLayoutEffect(() => {
    if (operationIdentity) productSurfaceOperationCoordinator.observeIdentity(operationIdentity);
    else productSurfaceOperationCoordinator.observeAuthorityUnavailable(binding);
  }, [binding, operationIdentity]);

  useEffect(
    () => () => {
      for (const ticket of ownedTickets.current) ticket.cancel();
      ownedTickets.current.clear();
    },
    []
  );

  const run = useCallback(
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
            !operationIdentity ||
            !hasWritableCapability
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
    [authority, binding, entry, hasWritableCapability, operationIdentity, rolloutState, telemetry]
  );

  return {
    run,
    governed,
    ready,
    hasWritableCapability,
    contextScopeKey,
    contextKey: targetContext?.contextKey ?? '',
    contextScopeKind: requiredScopeKind,
    accessMode: authority.snapshot?.envelope.activeAccessMode ?? 'LEGACY',
    decisionRevision: authority.snapshot?.envelope.decisionRevision ?? '',
  } as const;
}
