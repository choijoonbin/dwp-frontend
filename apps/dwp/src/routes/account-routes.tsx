import { lazy, Suspense } from 'react';
import { AuthGuard } from '@dwp-frontend/shared-utils/auth/auth-guard';
import { Navigate, type RouteObject } from 'react-router-dom';

import { AccountLayout } from '../layouts/account-layout';
import { authenticationFallback, routeFallback } from './route-support';

const ProfilePage = lazy(() => import('../pages/account/profile'));
const SettingsPage = lazy(() => import('../pages/account/settings'));
const SecurityPage = lazy(() => import('../pages/account/security'));

export const accountRoutes: RouteObject[] = [
  {
    path: 'account',
    element: (
      <AuthGuard fallback={authenticationFallback}>
        <AccountLayout />
      </AuthGuard>
    ),
    children: [
      { index: true, element: <Navigate to="settings/appearance" replace /> },
      {
        path: 'profile',
        element: (
          <Suspense fallback={routeFallback}>
            <ProfilePage />
          </Suspense>
        ),
      },
      { path: 'settings', element: <Navigate to="appearance" replace /> },
      {
        path: 'settings/:section',
        element: (
          <Suspense fallback={routeFallback}>
            <SettingsPage />
          </Suspense>
        ),
      },
      {
        path: 'security',
        element: (
          <Suspense fallback={routeFallback}>
            <SecurityPage />
          </Suspense>
        ),
      },
    ],
  },
];
