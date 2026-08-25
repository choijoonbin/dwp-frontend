import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  productSurfaceServerNow,
  useAuth,
  useProductSurfaceAuthority,
} from '@dwp-frontend/shared-utils';

import { useOptionalAllowedProductSurface } from './allowed-product-surface-context';
import {
  ProductSurfaceOperationCancelledError,
  isProductSurfaceOperationCancelledError,
  productSurfaceOperationCoordinator,
  sameProductSurfaceOperationIdentity,
} from './product-surface-operation-coordinator';

import type {
  ProductSurfaceAuthoritySnapshot,
  ProductSurfaceEvaluationData,
  ProductSurfaceGovernedMutationAuthority,
  ProductSurfaceSecureMutationAuthority,
} from '@dwp-frontend/shared-utils';
import type {
  ProductSurfaceOperationIdentity,
  ProductSurfaceOperationTicket,
} from './product-surface-operation-coordinator';

export { isProductSurfaceOperationCancelledError };

export type ProductSurfaceMutationBinding = Readonly<{
  productKey: string;
  surfaceKey: string;
  routeContractKey: string;
}>;

export class ProductSurfaceMutationAuthorityError extends Error {
  constructor() {
    super('Product surface mutation authority is unavailable.');
    this.name = 'ProductSurfaceMutationAuthorityError';
  }
}

function nonBlank(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function resolveProductSurfaceMutationEntryBinding(
  snapshot: ProductSurfaceAuthoritySnapshot | undefined,
  binding: Pick<ProductSurfaceMutationBinding, 'productKey' | 'surfaceKey'>,
  requestedScopeKey: string | undefined,
  clientNowMs = Date.now()
): { contextKey: string; contextScopeKey: string } | null {
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
    ? { contextKey: context.contextKey, contextScopeKey: selected[0]!.key }
    : null;
}

export function secureProductSurfaceMutationAuthority(
  rolloutState: '110' | '111',
  binding: ProductSurfaceMutationBinding,
  requested: { contextKey: string; contextScopeKey: string },
  evaluation: ProductSurfaceEvaluationData,
  serverNowMs: number
): ProductSurfaceSecureMutationAuthority | null {
  const revalidateAtMs = Date.parse(evaluation.revalidateAt ?? '');
  const contextRevalidateAtMs = Date.parse(evaluation.context?.revalidateAt ?? '');
  if (
    evaluation.decision !== 'ALLOWED' ||
    !nonBlank(evaluation.decisionRevision) ||
    !evaluation.context ||
    evaluation.context.productKey !== binding.productKey ||
    evaluation.context.surfaceKey !== binding.surfaceKey ||
    evaluation.context.contextKey !== requested.contextKey ||
    !evaluation.scope ||
    evaluation.scope.key !== requested.contextScopeKey ||
    evaluation.scope.readOnly ||
    evaluation.effectiveReadOnly !== false ||
    !nonBlank(evaluation.routeGrantRef) ||
    !Number.isFinite(revalidateAtMs) ||
    !Number.isFinite(contextRevalidateAtMs) ||
    revalidateAtMs > contextRevalidateAtMs ||
    revalidateAtMs <= serverNowMs
  ) {
    return null;
  }
  return {
    mode: 'SECURE',
    rolloutState,
    expectedDecisionRevision: evaluation.decisionRevision,
    contextKey: evaluation.context.contextKey,
    contextScopeKey: evaluation.scope.key,
  };
}

export function useProductSurfaceGovernedMutation(binding: ProductSurfaceMutationBinding) {
  const auth = useAuth();
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
            contextKey: entry.contextKey,
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
          {
            subject: {
              type: 'PRODUCT',
              productKey: binding.productKey,
              surfaceKey: binding.surfaceKey,
            },
            routeContractKey: binding.routeContractKey,
            contextKey: entry.contextKey,
            contextScopeKey: entry.contextScopeKey,
          },
          { signal: ticket.signal }
        );
        ticket.assertCurrent();
        if (!sameProductSurfaceOperationIdentity(operationIdentityRef.current, operationIdentity)) {
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
        if (!sameProductSurfaceOperationIdentity(operationIdentityRef.current, operationIdentity)) {
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
    },
    [authority, binding, entry, operationIdentity, rolloutState]
  );
}
