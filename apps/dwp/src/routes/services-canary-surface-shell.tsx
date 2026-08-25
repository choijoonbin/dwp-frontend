import { useTranslation } from 'react-i18next';

import { SERVICES_PRODUCT_MANIFEST } from '../features/services/services-product-manifest';
import { useAllowedProductSurface } from '../features/shell/allowed-product-surface-context';
import {
  resolveCanaryProductFlags,
  resolveProductSurfaceRolloutMode,
  useProductSurfaceCanaryAuthority,
} from '../features/shell/product-surface-canary-runtime';
import { ServicesLayout } from '../layouts/services-layout';
import { ServicesManagementLayout, ServicesWorkLayout } from '../layouts/services-surface-layouts';
import { REGISTERED_PRODUCT_PAGE_ROUTE_CATALOG } from './product-page-route-contracts';
import { buildProductCanaryLayoutRuntime } from './product-surface-canary-routes';
import { useProductSurfaceScopeTransition } from '../features/shell/use-product-surface-scope-transition';

export function ServicesCanarySurfaceShell({
  surfaceId,
}: {
  surfaceId: 'services.work' | 'services.management';
}) {
  const decision = useAllowedProductSurface();
  const authority = useProductSurfaceCanaryAuthority();
  const mode = resolveProductSurfaceRolloutMode(resolveCanaryProductFlags(authority, 'services'));
  const { t } = useTranslation('services');
  const { t: tCommon } = useTranslation('common');
  const transitionScope = useProductSurfaceScopeTransition(decision);
  const surface = SERVICES_PRODUCT_MANIFEST.surfaces.find(
    (candidate) => candidate.id === surfaceId
  )!;
  const runtime = buildProductCanaryLayoutRuntime({
    authority,
    manifest: SERVICES_PRODUCT_MANIFEST,
    decision,
    label: t(surface.labelKey),
    returnLabels: {
      work: tCommon('productSurface.actions.returnToWork'),
      catalog: tCommon('productSurface.actions.returnToCatalog'),
    },
    registeredRoutes: REGISTERED_PRODUCT_PAGE_ROUTE_CATALOG,
    rolloutMode: mode,
    onScopeChange: (scopeKey) => void transitionScope(scopeKey),
  });
  if (mode === 'surface-ui') {
    return surface.plane === 'management' ? (
      <ServicesManagementLayout surface={runtime} />
    ) : (
      <ServicesWorkLayout surface={runtime} />
    );
  }
  return <ServicesLayout surface={runtime} />;
}
