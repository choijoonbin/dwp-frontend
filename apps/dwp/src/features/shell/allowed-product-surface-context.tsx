import { createContext, useContext } from 'react';

import type { ReactNode } from 'react';
import type { AllowedSurfaceDecision } from './product-surface-context';

export type AllowedProductSurfaceBoundaryKind = 'surface' | 'exact-route';

type AllowedProductSurfaceContextValue = {
  decision: AllowedSurfaceDecision;
  boundaryKind: AllowedProductSurfaceBoundaryKind;
};

const AllowedProductSurfaceContext = createContext<AllowedProductSurfaceContextValue | null>(null);

export function AllowedProductSurfaceProvider({
  decision,
  boundaryKind = 'surface',
  children,
}: {
  decision: AllowedSurfaceDecision;
  boundaryKind?: AllowedProductSurfaceBoundaryKind;
  children: ReactNode;
}) {
  return (
    <AllowedProductSurfaceContext.Provider value={{ decision, boundaryKind }}>
      {children}
    </AllowedProductSurfaceContext.Provider>
  );
}

export function useOptionalAllowedProductSurface(): AllowedSurfaceDecision | null {
  return useContext(AllowedProductSurfaceContext)?.decision ?? null;
}

/**
 * Returns only an exact PAGE decision. A Surface-level allow must never bypass a downstream
 * PAGE guard because the actor may be authorized for only a subset of that Surface.
 */
export function useOptionalAllowedExactProductRoute(): AllowedSurfaceDecision | null {
  const authority = useContext(AllowedProductSurfaceContext);
  return authority?.boundaryKind === 'exact-route' ? authority.decision : null;
}

export function exactProductRouteAllowsLegacyAdminGuard(
  decision: AllowedSurfaceDecision | null,
  resourceKeys: readonly string[]
): boolean {
  return Boolean(
    decision &&
    decision.context.plane === 'management' &&
    resourceKeys.length > 0 &&
    resourceKeys.every((resourceKey) => resourceKey.startsWith('ADMIN.'))
  );
}

export function useAllowedProductSurface(): AllowedSurfaceDecision {
  const decision = useOptionalAllowedProductSurface();
  if (!decision) {
    throw new Error('useAllowedProductSurface must be used inside an allowed ProductSurfaceGuard.');
  }
  return decision;
}
