import type { RouteObject } from 'react-router-dom';

import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useSearchParams } from 'react-router-dom';
import { AuthGuard } from '@dwp-frontend/shared-utils';
import { useAuth, usePermissions } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';

import { AppLayout } from '../layouts/app-layout';
import { AccountLayout } from '../layouts/account-layout';
import { AdminLayout } from '../layouts/admin-layout';
import { AuthLayout } from '../layouts/auth-layout';
import { HomeLayout } from '../layouts/home-layout';
import { ProviderLayout } from '../layouts/provider-layout';
import { getLegacyAdminPath } from '../features/admin/admin-navigation';
import { isAppResourceEntitled } from '../features/home/app-launchpad-model';

const HomePage = lazy(() => import('../pages/home'));
const WorkPage = lazy(() => import('../pages/work'));
const AskPage = lazy(() => import('../pages/ask'));
const ActivityPage = lazy(() => import('../pages/activity'));
const AppsPage = lazy(() => import('../pages/apps'));
const AdminPage = lazy(() => import('../pages/admin'));
const ProviderPage = lazy(() => import('../pages/provider'));
const ProfilePage = lazy(() => import('../pages/account/profile'));
const SettingsPage = lazy(() => import('../pages/account/settings'));
const SecurityPage = lazy(() => import('../pages/account/security'));
const SignInPage = lazy(() => import('../pages/sign-in'));
const OidcCallbackPage = lazy(() => import('../pages/auth/oidc-callback'));
const AccountActivationPage = lazy(() => import('../pages/auth/account-activation'));
const Page403 = lazy(() => import('../pages/page-403'));
const PageNotFound = lazy(() => import('../pages/page-not-found'));

function RouteFallback() {
  const { t } = useTranslation('common');
  return (
    <Box sx={{ minHeight: 240, display: 'grid', placeItems: 'center' }}>
      <CircularProgress size={28} aria-label={t('labels.loadingPage')} />
    </Box>
  );
}

const fallback = <RouteFallback />;

function AdminRouteGuard({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const { permissions } = usePermissions();
  const rolePermitted = auth.user?.roles.some((role) =>
    ['ADMIN', 'TENANT_ADMIN', 'PLATFORM_ADMIN', 'AUDITOR', 'AUDIT_ADMIN'].includes(role)
  );
  const appPermitted = isAppResourceEntitled('APP.ADMINISTRATION', permissions);
  return rolePermitted && appPermitted ? children : <Navigate to="/403" replace />;
}

function AdminLegacyRedirect() {
  const [searchParams] = useSearchParams();
  return <Navigate to={getLegacyAdminPath(searchParams.get('view'))} replace />;
}

function ProviderRouteGuard({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  return auth.user?.roles.some((role) =>
    ['PROVIDER_ADMIN', 'PROVIDER_OPERATOR', 'PROVIDER_SUPPORT', 'PROVIDER_AUDITOR'].includes(role)
  ) ? (
    children
  ) : (
    <Navigate to="/403" replace />
  );
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
        <HomeLayout />
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
    ],
  },
  {
    element: (
      <AuthGuard>
        <AppLayout />
      </AuthGuard>
    ),
    children: [
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
    ],
  },
  {
    path: 'account',
    element: (
      <AuthGuard>
        <AccountLayout />
      </AuthGuard>
    ),
    children: [
      { index: true, element: <Navigate to="settings/appearance" replace /> },
      {
        path: 'profile',
        element: (
          <Suspense fallback={fallback}>
            <ProfilePage />
          </Suspense>
        ),
      },
      { path: 'settings', element: <Navigate to="appearance" replace /> },
      {
        path: 'settings/:section',
        element: (
          <Suspense fallback={fallback}>
            <SettingsPage />
          </Suspense>
        ),
      },
      {
        path: 'security',
        element: (
          <Suspense fallback={fallback}>
            <SecurityPage />
          </Suspense>
        ),
      },
    ],
  },
  {
    path: 'admin',
    element: (
      <AuthGuard>
        <AdminRouteGuard>
          <AdminLayout />
        </AdminRouteGuard>
      </AuthGuard>
    ),
    children: [
      { index: true, element: <AdminLegacyRedirect /> },
      {
        path: ':section/:view',
        element: (
          <Suspense fallback={fallback}>
            <AdminPage />
          </Suspense>
        ),
      },
    ],
  },
  {
    path: 'provider',
    element: (
      <AuthGuard>
        <ProviderRouteGuard>
          <ProviderLayout />
        </ProviderRouteGuard>
      </AuthGuard>
    ),
    children: [
      { index: true, element: <Navigate to="overview" replace /> },
      {
        path: ':view',
        element: (
          <Suspense fallback={fallback}>
            <ProviderPage />
          </Suspense>
        ),
      },
      {
        path: 'tenants/:tenantId',
        element: (
          <Suspense fallback={fallback}>
            <ProviderPage />
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
      {
        path: 'activate',
        element: (
          <Suspense fallback={fallback}>
            <AccountActivationPage />
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
