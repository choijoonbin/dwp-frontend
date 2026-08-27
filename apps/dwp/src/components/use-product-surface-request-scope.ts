import { useAuth, useProductSurfaceAuthority } from '@dwp-frontend/shared-utils';

import { useOptionalAllowedProductSurface } from './allowed-product-surface-context';
import { resolveCanonicalProductSurfaceContext } from './product-surface-capability-access';

import type { ProductSurfaceAuthoritySnapshot } from '@dwp-frontend/shared-utils';
import type { AllowedSurfaceDecision } from '../features/shell/product-surface-context';

export type ProductSurfaceRequestScope = Readonly<{
  governed: boolean;
  ready: boolean;
  contextScopeKey?: string;
  cacheKey: readonly [string, string, string, string, string, string];
  queryMeta: Readonly<{
    accessSensitive: true;
    tenantId: string;
    actorId: string;
    accessMode: string;
    productId: string;
    surfaceId: string;
    contextScopeKey?: string;
    decisionRevision: string;
  }>;
}>;

export function resolveProductSurfaceRequestScope({
  decision,
  snapshot,
  tenantId,
  actorId,
  productKey,
  surfaceKey,
}: {
  decision: AllowedSurfaceDecision | null;
  snapshot?: ProductSurfaceAuthoritySnapshot;
  tenantId: string;
  actorId: string;
  productKey: string;
  surfaceKey: string;
}): ProductSurfaceRequestScope {
  const matchesExpectedSurface =
    decision?.context.productKey === productKey && decision.context.surfaceKey === surfaceKey;
  const governedDecision = matchesExpectedSurface ? decision : null;
  const entryContext = resolveCanonicalProductSurfaceContext(governedDecision, snapshot);
  const governed = decision !== null;
  const contextScopeKey = entryContext ? governedDecision?.scope.key : undefined;
  const accessMode = entryContext?.accessMode ?? snapshot?.envelope.activeAccessMode ?? 'LEGACY';
  const decisionRevision =
    governedDecision?.decisionRevision ?? snapshot?.envelope.decisionRevision ?? '';
  return {
    governed,
    ready: !governed || Boolean(entryContext && contextScopeKey),
    ...(contextScopeKey ? { contextScopeKey } : {}),
    cacheKey: [
      tenantId,
      actorId,
      accessMode,
      entryContext?.surfaceKey ?? `${surfaceKey}.legacy`,
      contextScopeKey ?? '',
      governedDecision?.decisionRevision ?? snapshot?.envelope.decisionRevision ?? '',
    ],
    queryMeta: {
      accessSensitive: true,
      tenantId,
      actorId,
      accessMode,
      productId: productKey,
      surfaceId: surfaceKey,
      ...(contextScopeKey ? { contextScopeKey } : {}),
      decisionRevision,
    },
  };
}

/**
 * Binds any governed PAGE/DATA GET and its React Query cache to the exact selected surface scope.
 * Governed callers must set `enabled: requestScope.ready` and include `cacheKey` in their key.
 */
export function useProductSurfaceRequestScope({
  productKey,
  surfaceKey,
}: {
  productKey: string;
  surfaceKey: string;
}): ProductSurfaceRequestScope {
  const auth = useAuth();
  const decision = useOptionalAllowedProductSurface();
  const authority = useProductSurfaceAuthority();
  return resolveProductSurfaceRequestScope({
    decision,
    snapshot: authority.snapshot,
    tenantId: String(auth.user?.tenantId ?? ''),
    actorId: String(auth.user?.userId ?? ''),
    productKey,
    surfaceKey,
  });
}
