import { useEffect } from 'react';

import { ProductSurfaceAccessState } from '../components/product-surface-access-state';
import { ProductSurfaceLoadingShell } from '../components/product-surface-loading-shell';
import { AllowedProductSurfaceProvider } from '../features/shell/allowed-product-surface-context';
import { useProductSurfaceTelemetry } from '../observability/product-surface-telemetry-context';

import type { ReactNode } from 'react';
import type { ProductSurfaceAccessStateActions } from '../components/product-surface-access-state';
import type {
  AllowedSurfaceDecision,
  SurfaceDecision,
} from '../features/shell/product-surface-context';

function AllowedProductSurface({
  decision,
  children,
}: {
  decision: AllowedSurfaceDecision;
  children: ReactNode | ((allowed: AllowedSurfaceDecision) => ReactNode);
}) {
  const telemetry = useProductSurfaceTelemetry();
  useEffect(() => {
    telemetry.completePendingScopeSwitch(
      decision.context.productKey,
      decision.context.surfaceKey,
      decision.scope.kind
    );
  }, [decision, telemetry]);
  return (
    <AllowedProductSurfaceProvider decision={decision}>
      {typeof children === 'function' ? children(decision) : children}
    </AllowedProductSurfaceProvider>
  );
}

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
  if (pending) return <ProductSurfaceLoadingShell />;
  const effectiveDecision = decision ?? ({ state: 'authority-unavailable' } as const);
  if (effectiveDecision.state !== 'allowed') {
    return <ProductSurfaceAccessState decision={effectiveDecision} actions={actions} />;
  }
  return <AllowedProductSurface decision={effectiveDecision}>{children}</AllowedProductSurface>;
}
