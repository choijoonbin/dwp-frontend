import type { RouteObject } from 'react-router-dom';

import { lazy, Suspense } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthGuard } from '@dwp-frontend/shared-utils';
import { useAuth, usePermissions } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';

import { AppLayout } from '../layouts/app-layout';
import { AuthLayout } from '../layouts/auth-layout';
import { isAppResourceEntitled } from '../features/home/app-launchpad-model';

const HomePage = lazy(() => import('../pages/home'));
const WorkPage = lazy(() => import('../pages/work'));
const AskPage = lazy(() => import('../pages/ask'));
const ActivityPage = lazy(() => import('../pages/activity'));
const AppsPage = lazy(() => import('../pages/apps'));
const AdminPage = lazy(() => import('../pages/admin'));
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

function AdminRouteGuard({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const { permissions } = usePermissions();
  const rolePermitted = auth.user?.roles.some((role) =>
    ['ADMIN', 'TENANT_ADMIN', 'PLATFORM_ADMIN'].includes(role)
  );
  const appPermitted = isAppResourceEntitled('APP.ADMINISTRATION', permissions);
  return rolePermitted && appPermitted ? children : <Navigate to="/403" replace />;
}

function AppRouteGuard({
  resourceKey,
  children,
}: {
  resourceKey: string;
  children: React.ReactNode;
}) {
  const { permissions } = usePermissions();
  return isAppResourceEntitled(resourceKey, permissions) ? (
    children
  ) : (
    <Navigate to="/403" replace />
  );
}

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
        path: 'work',
        element: (
          <AppRouteGuard resourceKey="APP.WORK">
            <Suspense fallback={fallback}>
              <WorkPage />
            </Suspense>
          </AppRouteGuard>
        ),
      },
      {
        path: 'ask',
        element: (
          <AppRouteGuard resourceKey="APP.ASK">
            <Suspense fallback={fallback}>
              <AskPage />
            </Suspense>
          </AppRouteGuard>
        ),
      },
      {
        path: 'activity',
        element: (
          <AppRouteGuard resourceKey="APP.ACTIVITY">
            <Suspense fallback={fallback}>
              <ActivityPage />
            </Suspense>
          </AppRouteGuard>
        ),
      },
      {
        path: 'apps',
        element: (
          <Suspense fallback={fallback}>
            <AppsPage />
          </Suspense>
        ),
      },
      {
        path: 'admin',
        element: (
          <AdminRouteGuard>
            <Suspense fallback={fallback}>
              <AdminPage />
            </Suspense>
          </AdminRouteGuard>
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
