import { useCallback, useLayoutEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { matchPath, useLocation, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useProductSurfaceAuthority, useToast } from '@dwp-frontend/shared-utils';

import { PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE } from '../../routes/product-page-route-contracts';
import { transitionProductSurfaceScope } from './product-surface-cache';
import { useProductSurfaceTelemetry } from '../../observability/product-surface-telemetry-context';
import { productSurfaceOperationCoordinator } from '../../components/product-surface-operation-coordinator';

import type { AllowedSurfaceDecision } from './product-surface-context';
import type { ProductSurfaceEvaluationData } from '@dwp-frontend/shared-utils/api/auth-api';
import type { ProductSurfaceScopeKind } from '@dwp-frontend/shared-utils/api/observability-api';

const PRODUCT_QUERY_PREFIXES: Readonly<Record<string, readonly string[]>> = {
  approvals: ['approvals'],
  communications: ['communications', 'communication', 'announcements'],
  services: ['services', 'service-center', 'service-catalog'],
  hcm: ['hcm', 'hr'],
};

export function isProductAccessSensitiveQuery(
  query: { queryKey: readonly unknown[]; meta?: Readonly<Record<string, unknown>> },
  productId: string,
  surfaceId?: string
): boolean {
  if (
    query.meta?.accessSensitive === true &&
    query.meta.productId === productId &&
    (!surfaceId || query.meta.surfaceId === surfaceId)
  ) {
    return true;
  }
  const prefix = query.queryKey[0];
  return (
    typeof prefix === 'string' &&
    (PRODUCT_QUERY_PREFIXES[productId] ?? []).some(
      (candidate) => prefix === candidate || prefix.startsWith(`${candidate}-`)
    )
  );
}

function activeRouteContract(pathname: string, productId: string, surfaceId: string) {
  return PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE.find(
    (route) =>
      route.productId === productId &&
      route.surfaceId === surfaceId &&
      Boolean(matchPath({ path: route.pattern, end: true, caseSensitive: false }, pathname))
  );
}

export function isAuthorizedScopeTransitionResponse(
  evaluated: ProductSurfaceEvaluationData,
  expected: {
    productKey: string;
    surfaceKey: string;
    contextKey: string;
    scopeKey: string;
    decisionRevision: string;
    serverNowMs: number;
  }
): boolean {
  const revalidateAtMs = Date.parse(evaluated.revalidateAt ?? '');
  const contextRevalidateAtMs = Date.parse(evaluated.context?.revalidateAt ?? '');
  return (
    evaluated.decision === 'ALLOWED' &&
    evaluated.decisionRevision === expected.decisionRevision &&
    evaluated.context?.productKey === expected.productKey &&
    evaluated.context.surfaceKey === expected.surfaceKey &&
    evaluated.context.contextKey === expected.contextKey &&
    evaluated.scope?.key === expected.scopeKey &&
    evaluated.context.scopes.some((candidate) => candidate.key === expected.scopeKey) &&
    Boolean(evaluated.routeGrantRef?.trim()) &&
    typeof evaluated.effectiveReadOnly === 'boolean' &&
    Number.isFinite(expected.serverNowMs) &&
    Number.isFinite(revalidateAtMs) &&
    Number.isFinite(contextRevalidateAtMs) &&
    revalidateAtMs > expected.serverNowMs &&
    revalidateAtMs <= contextRevalidateAtMs
  );
}

export function useProductSurfaceScopeTransition(decision: AllowedSurfaceDecision) {
  const { t } = useTranslation('common');
  const toast = useToast();
  const authority = useProductSurfaceAuthority();
  const telemetry = useProductSurfaceTelemetry();
  const queryClient = useQueryClient();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const observedLocationKeyRef = useRef(location.key);

  useLayoutEffect(() => {
    if (observedLocationKeyRef.current === location.key) return;
    observedLocationKeyRef.current = location.key;
    productSurfaceOperationCoordinator.observeNavigation(
      {
        productKey: decision.context.productKey,
        surfaceKey: decision.context.surfaceKey,
      },
      new URLSearchParams(location.search).get('scope')
    );
  }, [decision.context.productKey, decision.context.surfaceKey, location.key, location.search]);

  return useCallback(
    async (scopeKey: string) => {
      const scope = decision.context.scopes.find((candidate) => candidate.key === scopeKey);
      const activeRoute = activeRouteContract(
        location.pathname,
        decision.context.productKey,
        decision.context.surfaceKey
      );
      if (!scope || !activeRoute || scopeKey === decision.scope.key) return;
      const transition = productSurfaceOperationCoordinator.beginScopeTransition(
        {
          productKey: decision.context.productKey,
          surfaceKey: decision.context.surfaceKey,
        },
        scopeKey
      );
      if (transition.state === 'BLOCKED') {
        toast.warning(t('productSurface.feedback.operationInProgress'));
        return false;
      }
      if (transition.abortedPreflightCount > 0) {
        toast.warning(t('productSurface.feedback.preflightCancelled'));
      }
      const scopeKind = scope.kind as ProductSurfaceScopeKind;
      const attempt = telemetry.beginScopeSwitch(
        decision.context.productKey,
        decision.context.surfaceKey,
        scopeKind
      );
      const previous = new URLSearchParams(searchParams);
      const next = new URLSearchParams(searchParams);
      next.set('scope', scopeKey);
      let completed = false;
      try {
        await transitionProductSurfaceScope({
          cancelInFlight: () =>
            queryClient.cancelQueries({
              predicate: (query) =>
                isProductAccessSensitiveQuery(
                  query,
                  decision.context.productKey,
                  decision.context.surfaceKey
                ),
            }),
          clearContent: () =>
            queryClient.removeQueries({
              predicate: (query) =>
                isProductAccessSensitiveQuery(
                  query,
                  decision.context.productKey,
                  decision.context.surfaceKey
                ),
            }),
          pushScopeUrl: () => {
            transition.assertCurrent();
            setSearchParams(next, { replace: false, state: { from: location.pathname } });
          },
          rollbackScopeUrl: () => {
            if (transition.isCurrent()) setSearchParams(previous, { replace: true });
          },
          startScopeQuery: async () => {
            transition.assertCurrent();
            const evaluated = await authority.evaluateProduct(
              {
                subject: {
                  type: 'PRODUCT',
                  productKey: decision.context.productKey,
                  surfaceKey: decision.context.surfaceKey,
                },
                routeContractKey: activeRoute.routeContractKey,
                contextKey: decision.context.contextKey,
                contextScopeKey: scopeKey,
              },
              { signal: transition.signal }
            );
            transition.assertCurrent();
            const serverNowMs = authority.snapshot
              ? Date.now() + authority.snapshot.clockOffsetMs
              : Number.NaN;
            if (
              !isAuthorizedScopeTransitionResponse(evaluated, {
                productKey: decision.context.productKey,
                surfaceKey: decision.context.surfaceKey,
                contextKey: decision.context.contextKey,
                scopeKey,
                decisionRevision: decision.decisionRevision,
                serverNowMs,
              })
            ) {
              throw new Error('The selected product scope was not authorized.');
            }
          },
        });
        transition.assertCurrent();
        completed = true;
        telemetry.completeScopeSwitch(
          decision.context.productKey,
          decision.context.surfaceKey,
          scopeKind,
          attempt.attemptId,
          attempt.startedAtMs
        );
        return true;
      } catch {
        telemetry.failScopeSwitch(
          decision.context.productKey,
          decision.context.surfaceKey,
          scopeKind,
          attempt.attemptId,
          transition.isCurrent() ? 'SCOPE_INVALID' : 'CANCELLED'
        );
        return false;
      } finally {
        transition.finish(completed);
      }
    },
    [
      authority,
      decision,
      location.pathname,
      queryClient,
      searchParams,
      setSearchParams,
      t,
      telemetry,
      toast,
    ]
  );
}
