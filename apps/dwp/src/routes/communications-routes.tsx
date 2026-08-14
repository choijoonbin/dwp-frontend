import { lazy, Suspense } from 'react';
import { AuthGuard } from '@dwp-frontend/shared-utils/auth/auth-guard';
import { Navigate, type RouteObject } from 'react-router-dom';

import { CommunicationsLayout } from '../layouts/communications-layout';
import {
  AppRouteGuard,
  authenticationFallback,
  routeFallback,
  WorkspaceRouteGuard,
} from './route-support';

const CommunicationsPage = lazy(() => import('../pages/communications'));

export const communicationsRoutes: RouteObject[] = [
  {
    path: 'communications',
    element: (
      <AuthGuard fallback={authenticationFallback}>
        <WorkspaceRouteGuard>
          <AppRouteGuard resourceKey="APP.COMMUNICATIONS">
            <CommunicationsLayout />
          </AppRouteGuard>
        </WorkspaceRouteGuard>
      </AuthGuard>
    ),
    children: [
      { index: true, element: <Navigate to="for-you" replace /> },
      {
        path: ':view',
        element: (
          <Suspense fallback={routeFallback}>
            <CommunicationsPage />
          </Suspense>
        ),
      },
      {
        path: ':view/:storyId',
        element: (
          <Suspense fallback={routeFallback}>
            <CommunicationsPage />
          </Suspense>
        ),
      },
    ],
  },
];
