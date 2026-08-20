import { lazy, Suspense } from 'react';
import { AuthGuard } from '@dwp-frontend/shared-utils/auth/auth-guard';
import { Navigate, type RouteObject } from 'react-router-dom';

import {
  AppRouteGuard,
  authenticationFallback,
  ProductRouteGuard,
  routeFallback,
  WorkspaceRouteGuard,
} from './route-support';

const ServicesLayout = lazy(() =>
  import('../layouts/services-layout').then((module) => ({ default: module.ServicesLayout }))
);
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

export const servicesRoutes: RouteObject[] = [
  {
    path: 'services',
    element: (
      <AuthGuard fallback={authenticationFallback}>
        <WorkspaceRouteGuard>
          <AppRouteGuard resourceKey="APP.EMPLOYEE_SERVICES">
            <Suspense fallback={routeFallback}>
              <ServicesLayout />
            </Suspense>
          </AppRouteGuard>
        </WorkspaceRouteGuard>
      </AuthGuard>
    ),
    children: [
      { index: true, element: <Navigate to="home" replace /> },
      {
        path: 'home',
        element: (
          <Suspense fallback={routeFallback}>
            <ServicesHome />
          </Suspense>
        ),
      },
      {
        path: 'admin/catalog',
        element: (
          <ProductRouteGuard resourceKey="ADMIN.SERVICE_CATALOG">
            <Suspense fallback={routeFallback}>
              <ServicesAdminCatalog />
            </Suspense>
          </ProductRouteGuard>
        ),
      },
      {
        path: 'admin/operations',
        element: (
          <ProductRouteGuard resourceKey="ADMIN.SERVICE_OPERATIONS">
            <Suspense fallback={routeFallback}>
              <ServicesAdminOperations />
            </Suspense>
          </ProductRouteGuard>
        ),
      },
      {
        path: ':view',
        element: (
          <Suspense fallback={routeFallback}>
            <ServicesPage />
          </Suspense>
        ),
      },
      {
        path: ':view/:requestId',
        element: (
          <Suspense fallback={routeFallback}>
            <ServicesPage />
          </Suspense>
        ),
      },
    ],
  },
];
