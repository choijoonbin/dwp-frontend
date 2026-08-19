import { lazy, Suspense } from 'react';
import { AuthGuard } from '@dwp-frontend/shared-utils/auth/auth-guard';

import { NotificationLayout } from '../layouts/notification-layout';
import {
  AppRouteGuard,
  authenticationFallback,
  routeFallback,
  WorkspaceRouteGuard,
} from './route-support';

import type { RouteObject } from 'react-router-dom';

const NotificationsPage = lazy(() => import('../pages/notifications'));

export const notificationRoutes: RouteObject[] = [
  {
    path: 'notifications',
    element: (
      <AuthGuard fallback={authenticationFallback}>
        <WorkspaceRouteGuard>
          <AppRouteGuard resourceKey="APP.NOTIFICATIONS">
            <NotificationLayout />
          </AppRouteGuard>
        </WorkspaceRouteGuard>
      </AuthGuard>
    ),
    children: [
      {
        path: '*',
        element: (
          <Suspense fallback={routeFallback}>
            <NotificationsPage />
          </Suspense>
        ),
      },
    ],
  },
];
