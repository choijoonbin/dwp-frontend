import { ProductSurfaceAccessState } from '../components/product-surface-access-state';
import {
  AllowedProductSurfaceProvider,
  useAllowedProductSurface,
} from '../features/shell/allowed-product-surface-context';
import { RouteFallback } from './route-support';

import type { ReactNode } from 'react';
import type { ProductSurfaceAccessStateActions } from '../components/product-surface-access-state';
import type {
  AllowedSurfaceDecision,
  SurfaceDecision,
} from '../features/shell/product-surface-context';

export { useAllowedProductSurface };

export function ProductSurfaceGuard({
  decision,
  pending = false,
  actions,
  children,
}: {
  decision?: SurfaceDecision;
  pending?: boolean;
  actions?: ProductSurfaceAccessStateActions;
  children: ReactNode | ((allowed: AllowedSurfaceDecision) => ReactNode);
}) {
  if (pending) return <RouteFallback />;
  const effectiveDecision = decision ?? ({ state: 'authority-unavailable' } as const);
  if (effectiveDecision.state !== 'allowed') {
    return <ProductSurfaceAccessState decision={effectiveDecision} actions={actions} />;
  }
  return (
    <AllowedProductSurfaceProvider decision={effectiveDecision}>
      {typeof children === 'function' ? children(effectiveDecision) : children}
    </AllowedProductSurfaceProvider>
  );
}
