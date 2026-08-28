import type { RouteObject } from 'react-router-dom';

import type { ProductSurfaceManifest } from '../components/product-manifest';
import type { ProductAreaLayoutProps } from '../layouts/product-area-layout';
import { ConfiguredProductSurfaceShell } from './configured-product-surface-shell';
import { buildProductPageRouteContractSource } from './draft-product-page-route-contract-source';
import { OFFICIAL_PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE } from './official-product-page-route-contracts';
import {
  ProductCanaryRoot,
  ProductCanaryFirstAllowedIndex,
  ProductCanaryIndexedSurfaceBoundary,
  ProductCanaryRouteBoundary,
  ProductCanarySurfaceBoundary,
  ProductCanaryUnknownRoute,
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
  managementLegacyShell?: ReactNode;
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

export function buildTwoSurfaceProductChildren({
  manifest,
  workSurfaceId,
  managementSurfaceId,
  managementBasePath,
  legacyPath,
  legacyShell,
  managementLegacyShell = legacyShell,
  areaKey,
  translationNamespace,
  renderPage,
  renderLegacyPage = renderPage,
  renderErrorElement,
  legacyUnknown,
}: TwoSurfaceProductRouteOptions): RouteObject[] {
  const productRoutes = buildProductPageRouteContractSource(
    [manifest],
    OFFICIAL_PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE
  );
  const officialRouteContractKeys = new Set(
    OFFICIAL_PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE.filter(
      (route) => route.productId === manifest.id
    ).map((route) => route.routeContractKey)
  );
  const workRoutes = productRoutes.filter((route) => route.surfaceId === workSurfaceId);
  const managementRoutes = productRoutes.filter((route) => route.surfaceId === managementSurfaceId);
  const hasOfficialWorkPage = workRoutes.some((route) =>
    officialRouteContractKeys.has(route.routeContractKey)
  );
  const hasOfficialManagementPage = managementRoutes.some((route) =>
    officialRouteContractKeys.has(route.routeContractKey)
  );
  const surfaceShell = (surfaceId: string) => (
    <ConfiguredProductSurfaceShell
      manifest={manifest}
      surfaceId={surfaceId}
      areaKey={areaKey}
      translationNamespace={translationNamespace}
      legacy={surfaceId === managementSurfaceId ? managementLegacyShell : legacyShell}
    />
  );
  const governedRoute = (
    surfaceId: string,
    parentPath: string,
    route: ProductPageRouteContractSource
  ): RouteObject => {
    const legacyPage = renderLegacyPage(route);
    const isOfficialPage = officialRouteContractKeys.has(route.routeContractKey);
    return {
      path: relativePattern(route.pattern, parentPath),
      handle: {
        routeContractKey: route.routeContractKey,
        productPageLifecycle: isOfficialPage ? 'OFFICIAL' : 'DRAFT',
      },
      element: (
        <ProductCanaryRouteBoundary
          productId={manifest.id}
          surfaceId={surfaceId}
          routeContractKey={route.routeContractKey}
          legacy={legacyPage}
        >
          {isOfficialPage ? renderPage(route) : legacyPage}
        </ProductCanaryRouteBoundary>
      ),
      errorElement: renderErrorElement?.(route),
    };
  };

  return [
    {
      index: true,
      element: <ProductCanaryRoot manifest={manifest} legacyPath={legacyPath} />,
    },
    {
      path: relativePattern(managementBasePath, manifest.basePath),
      handle: {
        surfaceId: managementSurfaceId,
        productSurfaceLifecycle: hasOfficialManagementPage ? 'OFFICIAL' : 'DRAFT',
      },
      element: (
        <ProductCanaryIndexedSurfaceBoundary
          productId={manifest.id}
          surfaceId={managementSurfaceId}
          indexPath={managementBasePath}
          legacy={managementLegacyShell}
        >
          {surfaceShell(managementSurfaceId)}
        </ProductCanaryIndexedSurfaceBoundary>
      ),
      children: [
        {
          index: true,
          element: (
            <ProductCanaryFirstAllowedIndex
              productId={manifest.id}
              surfaceId={managementSurfaceId}
              candidates={managementRoutes.map((route) => ({
                routeContractKey: route.routeContractKey,
                path: route.pattern,
              }))}
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
      handle: {
        surfaceId: workSurfaceId,
        productSurfaceLifecycle: hasOfficialWorkPage ? 'OFFICIAL' : 'DRAFT',
      },
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
