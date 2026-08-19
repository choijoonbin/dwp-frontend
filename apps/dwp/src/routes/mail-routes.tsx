import { lazy, Suspense } from 'react';
import { AuthGuard } from '@dwp-frontend/shared-utils/auth/auth-guard';
import { Navigate, type RouteObject } from 'react-router-dom';

import { MailLayout } from '../layouts/mail-layout';
import {
  AppRouteGuard,
  authenticationFallback,
  routeFallback,
  WorkspaceRouteGuard,
} from './route-support';

const MailPage = lazy(() => import('../pages/mail'));

export const mailRoutes: RouteObject[] = [
  {
    path: 'mail',
    element: (
      <AuthGuard fallback={authenticationFallback}>
        <WorkspaceRouteGuard>
          <AppRouteGuard resourceKey="APP.MAIL">
            <MailLayout />
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
            <MailPage />
          </Suspense>
        ),
      },
    ],
  },
];
