import { Navigate, useLocation, type RouteObject } from 'react-router-dom';

import type { ProductSurfaceManifest } from '../components/product-manifest';
import type { ProductAreaLayoutProps } from '../layouts/product-area-layout';
import {
  isProductSurfaceEnforced,
  resolveCanaryProductFlags,
  resolveProductSurfaceRolloutMode,
  useProductSurfaceCanaryAuthority,
} from '../features/shell/product-surface-canary-runtime';
import { ConfiguredProductSurfaceShell } from './configured-product-surface-shell';
import { DRAFT_PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE } from './draft-product-page-route-contracts';
import {
  ProductCanaryRoot,
  ProductCanaryRouteBoundary,
  ProductCanarySurfaceBoundary,
  ProductCanaryUnknownRoute,
  preserveProductRouteLocation,
  resolveFirstAllowedCanaryRoute,
} from './product-surface-canary-routes';

import type { ReactNode } from 'react';
import type { ProductPageRouteContractSource } from './product-route-contract-source';

type TwoSurfaceProductRouteOptions = {
  manifest: ProductSurfaceManifest;
  workSurfaceId: string;
  managementSurfaceId: string;
  managementBasePath: `/${string}`;
  legacyPath: `/${string}`;
  legacyShell: ReactNode;
  areaKey: ProductAreaLayoutProps['areaKey'];
  translationNamespace: NonNullable<ProductAreaLayoutProps['translationNamespace']>;
  renderPage: (route: ProductPageRouteContractSource) => ReactNode;
  renderLegacyPage?: (route: ProductPageRouteContractSource) => ReactNode;
  renderErrorElement?: (route: ProductPageRouteContractSource) => ReactNode | undefined;
  legacyUnknown: ReactNode;
};

function relativePattern(pattern: string, parentPath: string): string {
  const prefix = parentPath.endsWith('/') ? parentPath : `${parentPath}/`;
  if (!pattern.startsWith(prefix)) {
    throw new Error(`Product DRAFT route is outside Router parent ${parentPath}: ${pattern}`);
  }
  return pattern.slice(prefix.length);
}

export function ProductCanaryFirstAllowedIndex({
  productId,
  surfaceId,
  candidates,
  legacy,
}: {
  productId: string;
  surfaceId: string;
  candidates: readonly ProductPageRouteContractSource[];
  legacy: ReactNode;
}) {
  const authority = useProductSurfaceCanaryAuthority();
  const location = useLocation();
  const mode = resolveProductSurfaceRolloutMode(resolveCanaryProductFlags(authority, productId));
  if (!isProductSurfaceEnforced(mode)) return legacy;
  const destination = resolveFirstAllowedCanaryRoute(authority, {
    productId,
    surfaceId,
    candidates: candidates.map((route) => ({
      routeContractKey: route.routeContractKey,
      path: route.pattern,
    })),
  });
  return destination ? (
    <Navigate to={preserveProductRouteLocation(destination, location)} replace />
  ) : (
    <Navigate to="/403" replace />
  );
}

export function buildTwoSurfaceProductChildren({
  manifest,
  workSurfaceId,
  managementSurfaceId,
  managementBasePath,
  legacyPath,
  legacyShell,
  areaKey,
  translationNamespace,
  renderPage,
  renderLegacyPage = renderPage,
  renderErrorElement,
  legacyUnknown,
}: TwoSurfaceProductRouteOptions): RouteObject[] {
  const productRoutes = DRAFT_PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE.filter(
    (route) => route.productId === manifest.id
  );
  const workRoutes = productRoutes.filter((route) => route.surfaceId === workSurfaceId);
  const managementRoutes = productRoutes.filter((route) => route.surfaceId === managementSurfaceId);
  const surfaceShell = (surfaceId: string) => (
    <ConfiguredProductSurfaceShell
      manifest={manifest}
      surfaceId={surfaceId}
      areaKey={areaKey}
      translationNamespace={translationNamespace}
      legacy={legacyShell}
    />
  );
  const governedRoute = (
    surfaceId: string,
    parentPath: string,
    route: ProductPageRouteContractSource
  ): RouteObject => ({
    path: relativePattern(route.pattern, parentPath),
    handle: { routeContractKey: route.routeContractKey },
    element: (
      <ProductCanaryRouteBoundary
        productId={manifest.id}
        surfaceId={surfaceId}
        routeContractKey={route.routeContractKey}
        legacy={renderLegacyPage(route)}
      >
        {renderPage(route)}
      </ProductCanaryRouteBoundary>
    ),
    errorElement: renderErrorElement?.(route),
  });

  return [
    {
      index: true,
      element: <ProductCanaryRoot manifest={manifest} legacyPath={legacyPath} />,
    },
    {
      path: relativePattern(managementBasePath, manifest.basePath),
      element: (
        <ProductCanarySurfaceBoundary
          productId={manifest.id}
          surfaceId={managementSurfaceId}
          legacy={legacyShell}
        >
          {surfaceShell(managementSurfaceId)}
        </ProductCanarySurfaceBoundary>
      ),
      children: [
        {
          index: true,
          element: (
            <ProductCanaryFirstAllowedIndex
              productId={manifest.id}
              surfaceId={managementSurfaceId}
              candidates={managementRoutes}
              legacy={legacyUnknown}
            />
          ),
        },
        ...managementRoutes.map((route) =>
          governedRoute(managementSurfaceId, managementBasePath, route)
        ),
        {
          path: '*',
          element: <ProductCanaryUnknownRoute productId={manifest.id} legacy={legacyUnknown} />,
        },
      ],
    },
    {
      element: (
        <ProductCanarySurfaceBoundary
          productId={manifest.id}
          surfaceId={workSurfaceId}
          legacy={legacyShell}
        >
          {surfaceShell(workSurfaceId)}
        </ProductCanarySurfaceBoundary>
      ),
      children: [
        ...workRoutes.map((route) => governedRoute(workSurfaceId, manifest.basePath, route)),
        {
          path: '*',
          element: <ProductCanaryUnknownRoute productId={manifest.id} legacy={legacyUnknown} />,
        },
      ],
    },
  ];
}
