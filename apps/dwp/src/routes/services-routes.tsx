import { lazy, Suspense } from 'react';
import { AuthGuard } from '@dwp-frontend/shared-utils/auth/auth-guard';
import { Navigate, type RouteObject } from 'react-router-dom';

import { ServicesLayout } from '../layouts/services-layout';
import {
  AppRouteGuard,
  authenticationFallback,
  routeFallback,
  WorkspaceRouteGuard,
} from './route-support';

const ServicesPage = lazy(() => import('../pages/services'));

export const servicesRoutes: RouteObject[] = [
  {
    path: 'services',
    element: (
      <AuthGuard fallback={authenticationFallback}>
        <WorkspaceRouteGuard>
          <AppRouteGuard resourceKey="APP.EMPLOYEE_SERVICES">
            <ServicesLayout />
          </AppRouteGuard>
        </WorkspaceRouteGuard>
      </AuthGuard>
    ),
    children: [
      { index: true, element: <Navigate to="discover" replace /> },
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
