import { createContext, useContext } from 'react';

import type { ReactNode } from 'react';
import type { AllowedSurfaceDecision } from './product-surface-context';

const AllowedProductSurfaceContext = createContext<AllowedSurfaceDecision | null>(null);

export function AllowedProductSurfaceProvider({
  decision,
  children,
}: {
  decision: AllowedSurfaceDecision;
  children: ReactNode;
}) {
  return (
    <AllowedProductSurfaceContext.Provider value={decision}>
      {children}
    </AllowedProductSurfaceContext.Provider>
  );
}

export function useOptionalAllowedProductSurface(): AllowedSurfaceDecision | null {
  return useContext(AllowedProductSurfaceContext);
}

export function useAllowedProductSurface(): AllowedSurfaceDecision {
  const decision = useOptionalAllowedProductSurface();
  if (!decision) {
    throw new Error('useAllowedProductSurface must be used inside an allowed ProductSurfaceGuard.');
  }
  return decision;
}
