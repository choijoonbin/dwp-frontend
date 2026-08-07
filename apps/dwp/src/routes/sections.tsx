import type { RouteObject } from 'react-router-dom';

import { lazy, Suspense } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthGuard } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';

import { AppLayout } from '../layouts/app-layout';
import { AuthLayout } from '../layouts/auth-layout';

const HomePage = lazy(() => import('../pages/home'));
const ProfilePage = lazy(() => import('../pages/account/profile'));
const SettingsPage = lazy(() => import('../pages/account/settings'));
const SecurityPage = lazy(() => import('../pages/account/security'));
const SignInPage = lazy(() => import('../pages/sign-in'));
const OidcCallbackPage = lazy(() => import('../pages/auth/oidc-callback'));
const Page403 = lazy(() => import('../pages/page-403'));
const PageNotFound = lazy(() => import('../pages/page-not-found'));

const fallback = (
  <Box sx={{ minHeight: 240, display: 'grid', placeItems: 'center' }}>
    <CircularProgress size={28} aria-label="Loading page" />
  </Box>
);

export const routesSection: RouteObject[] = [
  {
    element: (
      <AuthGuard>
        <AppLayout />
      </AuthGuard>
    ),
    children: [
      {
        index: true,
        element: (
          <Suspense fallback={fallback}>
            <HomePage />
          </Suspense>
        ),
      },
      {
        path: 'account/profile',
        element: (
          <Suspense fallback={fallback}>
            <ProfilePage />
          </Suspense>
        ),
      },
      {
        path: 'account/settings',
        element: (
          <Suspense fallback={fallback}>
            <SettingsPage />
          </Suspense>
        ),
      },
      {
        path: 'account/security',
        element: (
          <Suspense fallback={fallback}>
            <SecurityPage />
          </Suspense>
        ),
      },
    ],
  },
  {
    element: <AuthLayout />,
    children: [
      {
        path: 'sign-in',
        element: (
          <Suspense fallback={fallback}>
            <SignInPage />
          </Suspense>
        ),
      },
    ],
  },
  {
    path: 'auth/oidc/callback',
    element: (
      <Suspense fallback={fallback}>
        <OidcCallbackPage />
      </Suspense>
    ),
  },
  {
    path: '403',
    element: (
      <Suspense fallback={fallback}>
        <Page403 />
      </Suspense>
    ),
  },
  {
    path: '404',
    element: (
      <Suspense fallback={fallback}>
        <PageNotFound />
      </Suspense>
    ),
  },
  { path: '*', element: <Navigate to="/404" replace /> },
];
