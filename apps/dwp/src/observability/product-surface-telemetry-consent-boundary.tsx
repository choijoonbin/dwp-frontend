import { useEffect, useState, type PropsWithChildren } from 'react';

import ProductSurfaceTelemetryProvider from './product-surface-telemetry-provider';
import {
  PRODUCT_SURFACE_TELEMETRY_CONSENT_EVENT,
  readProductSurfaceTelemetryConsent,
} from './product-surface-telemetry-context';

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

  return (
    <ProductSurfaceTelemetryProvider
      productionCollectionEnabled={productionCollectionEnabled}
      privacyConsentGranted={privacyConsentGranted}
    >
      {children}
    </ProductSurfaceTelemetryProvider>
  );
}
