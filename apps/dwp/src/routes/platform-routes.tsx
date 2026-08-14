import { lazy, Suspense } from 'react';
import { Navigate, type RouteObject } from 'react-router-dom';

import { AuthLayout } from '../layouts/auth-layout';
import { routeFallback } from './route-support';

const SignInPage = lazy(() => import('../pages/sign-in'));
const OidcCallbackPage = lazy(() => import('../pages/auth/oidc-callback'));
const AccountActivationPage = lazy(() => import('../pages/auth/account-activation'));
const Page403 = lazy(() => import('../pages/page-403'));
const PageNotFound = lazy(() => import('../pages/page-not-found'));

export const platformRoutes: RouteObject[] = [
  {
    element: <AuthLayout />,
    children: [
      {
        path: 'sign-in',
        element: (
          <Suspense fallback={routeFallback}>
            <SignInPage />
          </Suspense>
        ),
      },
      {
        path: 'activate',
        element: (
          <Suspense fallback={routeFallback}>
            <AccountActivationPage />
          </Suspense>
        ),
      },
    ],
  },
  {
    path: 'auth/oidc/callback',
    element: (
      <Suspense fallback={routeFallback}>
        <OidcCallbackPage />
      </Suspense>
    ),
  },
  {
    path: '403',
    element: (
      <Suspense fallback={routeFallback}>
        <Page403 />
      </Suspense>
    ),
  },
  {
    path: '404',
    element: (
      <Suspense fallback={routeFallback}>
        <PageNotFound />
      </Suspense>
    ),
  },
  { path: '*', element: <Navigate to="/404" replace /> },
];
