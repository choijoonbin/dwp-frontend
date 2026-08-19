import { lazy, Suspense } from 'react';
import { AuthGuard } from '@dwp-frontend/shared-utils/auth/auth-guard';
import { Navigate, type RouteObject } from 'react-router-dom';

import { RoomsLayout } from '../layouts/rooms-layout';
import {
  AppRouteGuard,
  authenticationFallback,
  routeFallback,
  WorkspaceRouteGuard,
} from './route-support';

const RoomsPage = lazy(() => import('../pages/rooms'));

export const roomsRoutes: RouteObject[] = [
  {
    path: 'rooms',
    element: (
      <AuthGuard fallback={authenticationFallback}>
        <WorkspaceRouteGuard>
          <AppRouteGuard resourceKey="APP.ROOMS">
            <RoomsLayout />
          </AppRouteGuard>
        </WorkspaceRouteGuard>
      </AuthGuard>
    ),
    children: [
      { index: true, element: <Navigate to="find" replace /> },
      {
        path: '*',
        element: (
          <Suspense fallback={routeFallback}>
            <RoomsPage />
          </Suspense>
        ),
      },
    ],
  },
];
