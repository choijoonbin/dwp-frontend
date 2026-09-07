import { lazy, Suspense } from 'react';
import { AuthGuard } from '@dwp-frontend/shared-utils/auth/auth-guard';
import { Outlet, type RouteObject } from 'react-router-dom';

import { SERVICES_PRODUCT_MANIFEST } from '../features/services/services-product-manifest';
import { SERVICES_NAVIGATION } from '../features/services/services-navigation';
import { ServicesLayout } from '../layouts/services-layout';
import { LegacyProductFirstAllowedIndex } from './legacy-product-first-allowed-index';
import { officialProductPageRelativePattern } from './official-product-page-route-contracts';
import {
  authenticationFallback,
  ProductAnyRouteGuard,
  ProductRouteGuard,
  ProductWorkRouteGuard,
  routeFallback,
  WorkspaceRouteGuard,
} from './route-support';
import {
  ProductCanaryRoot,
  ProductCanaryFirstAllowedIndex,
  ProductCanaryIndexedSurfaceBoundary,
  ProductCanaryRouteBoundary,
  ProductCanarySurfaceBoundary,
  ProductCanaryUnknownRoute,
} from './product-surface-canary-routes';

import type { ProductNavigationGroup } from '../components/product-manifest';

const ServicesPage = lazy(() => import('../pages/services'));
const ServicesHome = lazy(() =>
  import('../features/services/services-home').then((module) => ({
    default: module.ServicesHome,
  }))
);
const ServicesAdminCatalog = lazy(() =>
  import('../features/services/services-admin').then((module) => ({
    default: module.ServicesAdminCatalog,
  }))
);
const ServicesAdminOperations = lazy(() =>
  import('../features/services/services-admin').then((module) => ({
    default: module.ServicesAdminOperations,
  }))
);
const ServicesSurfaceShell = lazy(() =>
  import('./services-canary-surface-shell').then((module) => ({
    default: module.ServicesCanarySurfaceShell,
  }))
);

const page = (children: React.ReactNode) => (
  <Suspense fallback={routeFallback}>{children}</Suspense>
);

const legacyWorkShell = (
  <ProductWorkRouteGuard
    productId="services"
    surfaceId="services.work"
    resourceKey="APP.EMPLOYEE_SERVICES"
  >
    <ServicesLayout />
  </ProductWorkRouteGuard>
);

const legacyManagementShell = (
  <ProductAnyRouteGuard
    authorities={[
      { resourceKey: 'ADMIN.SERVICE_CATALOG', permissionCode: 'VIEW' },
      { resourceKey: 'ADMIN.SERVICE_OPERATIONS', permissionCode: 'VIEW' },
    ]}
  >
    <ServicesLayout />
  </ProductAnyRouteGuard>
);

const servicesManagementIndexCandidates = [
  {
    routeContractKey: 'route.services.management.catalog.page',
    path: '/services/admin/catalog',
  },
  {
    routeContractKey: 'route.services.management.operations.page',
    path: '/services/admin/operations',
  },
] as const;

const servicesManagementLegacyItems = (
  SERVICES_NAVIGATION as readonly ProductNavigationGroup[]
).flatMap((group) => group.items.filter((item) => item.path.startsWith('/services/admin/')));

function servicesWorkRoute(routeContractKey: string, element: React.ReactNode): RouteObject {
  return {
    path: officialProductPageRelativePattern(routeContractKey, '/services'),
    handle: { routeContractKey },
    element: (
      <ProductCanaryRouteBoundary
        productId="services"
        surfaceId="services.work"
        routeContractKey={routeContractKey}
      >
        {element}
      </ProductCanaryRouteBoundary>
    ),
  };
}

function servicesManagementRoute(
  routeContractKey: string,
  resourceKey: string,
  element: React.ReactNode
): RouteObject {
  return {
    path: officialProductPageRelativePattern(routeContractKey, '/services/admin'),
    handle: { routeContractKey },
    element: (
      <ProductCanaryRouteBoundary
        productId="services"
        surfaceId="services.management"
        routeContractKey={routeContractKey}
        legacy={
          <ProductRouteGuard resourceKey={resourceKey} localDeny>
            {element}
          </ProductRouteGuard>
        }
      >
        {element}
      </ProductCanaryRouteBoundary>
    ),
  };
}

export const servicesRoutes: RouteObject[] = [
  {
    path: 'services',
    element: (
      <AuthGuard fallback={authenticationFallback}>
        <WorkspaceRouteGuard>
          <Outlet />
        </WorkspaceRouteGuard>
      </AuthGuard>
    ),
    children: [
      {
        index: true,
        element: (
          <ProductCanaryRoot manifest={SERVICES_PRODUCT_MANIFEST} legacyPath="/services/home" />
        ),
      },
      {
        path: 'admin',
        element: (
          <ProductCanaryIndexedSurfaceBoundary
            productId="services"
            surfaceId="services.management"
            indexPath="/services/admin"
            legacy={legacyManagementShell}
          >
            {page(<ServicesSurfaceShell surfaceId="services.management" />)}
          </ProductCanaryIndexedSurfaceBoundary>
        ),
        children: [
          {
            index: true,
            element: (
              <ProductCanaryFirstAllowedIndex
                productId="services"
                surfaceId="services.management"
                candidates={servicesManagementIndexCandidates}
                legacy={<LegacyProductFirstAllowedIndex items={servicesManagementLegacyItems} />}
              />
            ),
          },
          servicesManagementRoute(
            'route.services.management.catalog.page',
            'ADMIN.SERVICE_CATALOG',
            page(<ServicesAdminCatalog />)
          ),
          servicesManagementRoute(
            'route.services.management.operations.page',
            'ADMIN.SERVICE_OPERATIONS',
            page(<ServicesAdminOperations />)
          ),
          {
            path: '*',
            element: (
              <ProductCanaryUnknownRoute productId="services" legacy={page(<ServicesPage />)} />
            ),
          },
        ],
      },
      {
        element: (
          <ProductCanarySurfaceBoundary
            productId="services"
            surfaceId="services.work"
            legacy={legacyWorkShell}
          >
            {page(<ServicesSurfaceShell surfaceId="services.work" />)}
          </ProductCanarySurfaceBoundary>
        ),
        children: [
          servicesWorkRoute('route.services.work.home.page', page(<ServicesHome />)),
          ...(['discover', 'my', 'drafts'] as const).map((view) =>
            servicesWorkRoute(`route.services.work.${view}.page`, page(<ServicesPage />))
          ),
          servicesWorkRoute('route.services.work.my-detail.page', page(<ServicesPage />)),
          servicesWorkRoute('route.services.work.draft-detail.page', page(<ServicesPage />)),
          {
            path: ':view',
            element: (
              <ProductCanaryUnknownRoute productId="services" legacy={page(<ServicesPage />)} />
            ),
          },
          {
            path: ':view/:requestId',
            element: (
              <ProductCanaryUnknownRoute productId="services" legacy={page(<ServicesPage />)} />
            ),
          },
          {
            path: '*',
            element: (
              <ProductCanaryUnknownRoute productId="services" legacy={page(<ServicesPage />)} />
            ),
          },
        ],
      },
    ],
  },
];
