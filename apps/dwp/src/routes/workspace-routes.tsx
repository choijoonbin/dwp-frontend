import { lazy, Suspense } from 'react';
import { AuthGuard } from '@dwp-frontend/shared-utils/auth/auth-guard';
import type { RouteObject } from 'react-router-dom';

import { HomeRouteFallback } from '../components/home-loading-skeleton';
import { CatalogLayout } from '../layouts/catalog-layout';
import { HomeLayout } from '../layouts/home-layout';
import { authenticationFallback, routeFallback, WorkspaceRouteGuard } from './route-support';

const HomePage = lazy(() => import('../pages/home'));
const AppsPage = lazy(() => import('../pages/apps'));

export const workspaceRoutes: RouteObject[] = [
  {
    element: (
      <AuthGuard fallback={authenticationFallback}>
        <WorkspaceRouteGuard>
          <HomeLayout />
        </WorkspaceRouteGuard>
      </AuthGuard>
    ),
    children: [
      {
        index: true,
        element: (
          <Suspense fallback={<HomeRouteFallback />}>
            <HomePage />
          </Suspense>
        ),
      },
    ],
  },
  {
    element: (
      <AuthGuard fallback={authenticationFallback}>
        <WorkspaceRouteGuard>
          <CatalogLayout />
        </WorkspaceRouteGuard>
      </AuthGuard>
    ),
    children: [
      {
        path: 'apps',
        element: (
          <Suspense fallback={routeFallback}>
            <AppsPage />
          </Suspense>
        ),
      },
    ],
  },
];
