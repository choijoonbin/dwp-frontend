import { lazy, useEffect, useState, type PropsWithChildren } from 'react';

import {
  PRODUCT_SURFACE_TELEMETRY_CONSENT_EVENT,
  readProductSurfaceTelemetryConsent,
} from './product-surface-telemetry-context';

const ProductSurfaceTelemetryProvider = lazy(() => import('./product-surface-telemetry-provider'));

export function ProductSurfaceTelemetryConsentBoundary({
  children,
  productionCollectionEnabled,
}: PropsWithChildren<{ productionCollectionEnabled: boolean }>) {
  const [privacyConsentGranted, setPrivacyConsentGranted] = useState(() =>
    readProductSurfaceTelemetryConsent(window.localStorage)
  );

  useEffect(() => {
    const refresh = () =>
      setPrivacyConsentGranted(readProductSurfaceTelemetryConsent(window.localStorage));
    window.addEventListener(PRODUCT_SURFACE_TELEMETRY_CONSENT_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(PRODUCT_SURFACE_TELEMETRY_CONSENT_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  if (!productionCollectionEnabled || !privacyConsentGranted) return children;

  return (
    <ProductSurfaceTelemetryProvider
      productionCollectionEnabled={productionCollectionEnabled}
      privacyConsentGranted={privacyConsentGranted}
    >
      {children}
    </ProductSurfaceTelemetryProvider>
  );
}
