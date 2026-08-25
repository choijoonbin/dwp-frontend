import { useTranslation } from 'react-i18next';

import { COMMUNICATIONS_PRODUCT_MANIFEST } from '../features/communications/communications-product-manifest';
import { useAllowedProductSurface } from '../features/shell/allowed-product-surface-context';
import {
  resolveCanaryProductFlags,
  resolveProductSurfaceRolloutMode,
  useProductSurfaceCanaryAuthority,
} from '../features/shell/product-surface-canary-runtime';
import { CommunicationsLayout } from '../layouts/communications-layout';
import {
  CommunicationsManagementLayout,
  CommunicationsWorkLayout,
} from '../layouts/communications-surface-layouts';
import { REGISTERED_PRODUCT_PAGE_ROUTE_CATALOG } from './product-page-route-contracts';
import { buildProductCanaryLayoutRuntime } from './product-surface-canary-routes';
import { useProductSurfaceScopeTransition } from '../features/shell/use-product-surface-scope-transition';

export function CommunicationsCanarySurfaceShell({
  surfaceId,
}: {
  surfaceId: 'communications.work' | 'communications.management';
}) {
  const decision = useAllowedProductSurface();
  const authority = useProductSurfaceCanaryAuthority();
  const mode = resolveProductSurfaceRolloutMode(
    resolveCanaryProductFlags(authority, 'communications')
  );
  const { t } = useTranslation('communications');
  const { t: tCommon } = useTranslation('common');
  const transitionScope = useProductSurfaceScopeTransition(decision);
  const surface = COMMUNICATIONS_PRODUCT_MANIFEST.surfaces.find(
    (candidate) => candidate.id === surfaceId
  )!;
  const runtime = buildProductCanaryLayoutRuntime({
    authority,
    manifest: COMMUNICATIONS_PRODUCT_MANIFEST,
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
      <CommunicationsManagementLayout surface={runtime} />
    ) : (
      <CommunicationsWorkLayout surface={runtime} />
    );
  }
  return <CommunicationsLayout surface={runtime} />;
}
