import { useTranslation } from 'react-i18next';

import type { ProductPlane, ProductSurfaceManifest } from '../components/product-manifest';
import { ProductSurfaceAccessState } from '../components/product-surface-access-state';
import {
  resolveCanaryProductFlags,
  resolveProductSurfaceRolloutMode,
  useProductSurfaceCanaryAuthority,
} from '../features/shell/product-surface-canary-runtime';
import { buildProductCompatibilityNavigation } from '../features/shell/product-surface-compatibility-navigation';
import { useProductSurfaceScopeTransition } from '../features/shell/use-product-surface-scope-transition';
import { ProductManagementLayout } from '../layouts/product-management-layout';
import { ProductWorkLayout } from '../layouts/product-work-layout';
import { ProductAreaLayout, type ProductAreaLayoutProps } from '../layouts/product-area-layout';
import { REGISTERED_PRODUCT_PAGE_ROUTE_CATALOG } from './product-page-route-contracts';
import { buildProductCanaryLayoutRuntime } from './product-surface-canary-routes';
import { useAllowedProductSurface } from './product-surface-guard';

import type { ReactNode } from 'react';
import type { ProductSurfaceRolloutMode } from '../features/shell/product-surface-canary-runtime';

export type ConfiguredProductSurfacePresentation =
  | 'legacy'
  | 'compatibility'
  | 'separated-work'
  | 'separated-management'
  | 'unavailable';

export function resolveConfiguredProductSurfacePresentation(
  mode: ProductSurfaceRolloutMode,
  plane: ProductPlane
): ConfiguredProductSurfacePresentation {
  if (mode === 'baseline' || mode === 'shadow') return 'legacy';
  if (mode === 'enforced-compatibility') return 'compatibility';
  if (mode === 'surface-ui') {
    return plane === 'management' ? 'separated-management' : 'separated-work';
  }
  return 'unavailable';
}

export function ConfiguredProductSurfaceShell({
  manifest,
  surfaceId,
  areaKey,
  translationNamespace,
  legacy,
}: {
  manifest: ProductSurfaceManifest;
  surfaceId: string;
  areaKey: ProductAreaLayoutProps['areaKey'];
  translationNamespace: NonNullable<ProductAreaLayoutProps['translationNamespace']>;
  legacy: ReactNode;
}) {
  const decision = useAllowedProductSurface();
  const authority = useProductSurfaceCanaryAuthority();
  const mode = resolveProductSurfaceRolloutMode(resolveCanaryProductFlags(authority, manifest.id));
  const { t } = useTranslation(translationNamespace);
  const { t: tCommon } = useTranslation('common');
  const transitionScope = useProductSurfaceScopeTransition(decision);
  const surface = manifest.surfaces.find((candidate) => candidate.id === surfaceId);
  if (!surface) throw new Error(`Unknown product surface: ${manifest.id}/${surfaceId}`);
  const presentation = resolveConfiguredProductSurfacePresentation(mode, surface.plane);

  const runtime = buildProductCanaryLayoutRuntime({
    authority,
    manifest,
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

  if (presentation === 'legacy') return legacy;
  if (presentation === 'unavailable') {
    return <ProductSurfaceAccessState decision={{ state: 'authority-unavailable' }} />;
  }
  const layoutProps = {
    areaKey,
    navigation:
      presentation === 'compatibility'
        ? buildProductCompatibilityNavigation(manifest)
        : surface.navigation,
    translationNamespace,
    surface: runtime,
  };
  if (presentation === 'compatibility') return <ProductAreaLayout {...layoutProps} />;
  return presentation === 'separated-management' ? (
    <ProductManagementLayout {...layoutProps} />
  ) : (
    <ProductWorkLayout {...layoutProps} />
  );
}
