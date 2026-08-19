import { lazy, Suspense } from 'react';
import { AuthGuard } from '@dwp-frontend/shared-utils/auth/auth-guard';
import { Navigate, type RouteObject } from 'react-router-dom';

import { SpaceLayout } from '../layouts/space-layout';
import {
  AppRouteGuard,
  authenticationFallback,
  routeFallback,
  WorkspaceRouteGuard,
} from './route-support';

const SpacesPage = lazy(() => import('../pages/spaces'));

export const spacesRoutes: RouteObject[] = [
  {
    path: 'spaces',
    element: (
      <AuthGuard fallback={authenticationFallback}>
        <WorkspaceRouteGuard>
          <AppRouteGuard resourceKey="APP.SPACES">
            <SpaceLayout />
          </AppRouteGuard>
        </WorkspaceRouteGuard>
      </AuthGuard>
    ),
    children: [
      { index: true, element: <Navigate to="home" replace /> },
      {
        path: '*',
        element: (
          <Suspense fallback={routeFallback}>
            <SpacesPage />
          </Suspense>
        ),
      },
    ],
  },
];
