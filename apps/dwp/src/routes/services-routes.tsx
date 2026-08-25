import { lazy, Suspense } from 'react';
import { AuthGuard } from '@dwp-frontend/shared-utils/auth/auth-guard';
import { Navigate, Outlet, useLocation, type RouteObject } from 'react-router-dom';

import { SERVICES_PRODUCT_MANIFEST } from '../features/services/services-product-manifest';
import {
  isProductSurfaceEnforced,
  resolveCanaryProductFlags,
  resolveProductSurfaceRolloutMode,
  useProductSurfaceCanaryAuthority,
} from '../features/shell/product-surface-canary-runtime';
import { ServicesLayout } from '../layouts/services-layout';
import { productPageRelativePattern } from './product-page-route-contracts';
import {
  AppRouteGuard,
  authenticationFallback,
  ProductRouteGuard,
  routeFallback,
  WorkspaceRouteGuard,
} from './route-support';
import {
  ProductCanaryRoot,
  ProductCanaryRouteBoundary,
  ProductCanarySurfaceBoundary,
  ProductCanaryUnknownRoute,
  preserveProductRouteLocation,
  resolveFirstAllowedCanaryRoute,
} from './product-surface-canary-routes';

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
  <AppRouteGuard resourceKey="APP.EMPLOYEE_SERVICES">
    <ServicesLayout />
  </AppRouteGuard>
);

const legacyManagementShell = (
  <AppRouteGuard resourceKey="APP.EMPLOYEE_SERVICES">
    <ServicesLayout />
  </AppRouteGuard>
);

function ServicesManagementIndex() {
  const authority = useProductSurfaceCanaryAuthority();
  const location = useLocation();
  const mode = resolveProductSurfaceRolloutMode(resolveCanaryProductFlags(authority, 'services'));
  if (!isProductSurfaceEnforced(mode)) return page(<ServicesPage />);
  const destination = resolveFirstAllowedCanaryRoute(authority, {
    productId: 'services',
    surfaceId: 'services.management',
    candidates: [
      {
        routeContractKey: 'route.services.management.catalog.page',
        path: '/services/admin/catalog',
      },
      {
        routeContractKey: 'route.services.management.operations.page',
        path: '/services/admin/operations',
      },
    ],
  });
  return destination ? (
    <Navigate to={preserveProductRouteLocation(destination, location)} replace />
  ) : (
    <Navigate to="/403" replace />
  );
}

function servicesWorkRoute(routeContractKey: string, element: React.ReactNode): RouteObject {
  return {
    path: productPageRelativePattern(routeContractKey, '/services'),
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
    path: productPageRelativePattern(routeContractKey, '/services/admin'),
    handle: { routeContractKey },
    element: (
      <ProductCanaryRouteBoundary
        productId="services"
        surfaceId="services.management"
        routeContractKey={routeContractKey}
        legacy={<ProductRouteGuard resourceKey={resourceKey}>{element}</ProductRouteGuard>}
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
          <ProductCanarySurfaceBoundary
            productId="services"
            surfaceId="services.management"
            legacy={legacyManagementShell}
          >
            {page(<ServicesSurfaceShell surfaceId="services.management" />)}
          </ProductCanarySurfaceBoundary>
        ),
        children: [
          { index: true, element: <ServicesManagementIndex /> },
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
        ],
      },
    ],
  },
];
