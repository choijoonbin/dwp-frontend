import type { RouteObject } from 'react-router-dom';

import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { AuthGuard } from '@dwp-frontend/shared-utils/auth/auth-guard';
import { useAuth } from '@dwp-frontend/shared-utils/auth/auth-provider';
import { usePermissions } from '@dwp-frontend/shared-utils/auth/use-permissions';

import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';

import { AppLayout } from '../layouts/app-layout';
import { AccountLayout } from '../layouts/account-layout';
import { AdminLayout } from '../layouts/admin-layout';
import { AuthLayout } from '../layouts/auth-layout';
import { HomeLayout } from '../layouts/home-layout';
import { CommunicationsLayout } from '../layouts/communications-layout';
import { CalendarLayout } from '../layouts/calendar-layout';
import { ApprovalLayout } from '../layouts/approval-layout';
import { HcmLayout } from '../layouts/hcm-layout';
import { ProviderLayout } from '../layouts/provider-layout';
import { ServicesLayout } from '../layouts/services-layout';
import { ADMIN_NAVIGATION } from '../features/admin/admin-navigation';
import { isAppResourceEntitled } from '../features/home/app-launchpad-model';
import { mapLegacyHrPath } from '../features/hcm/hcm-navigation';
import { ShellBootScreen } from '../components/shell-boot-screen';
import {
  canAccessAdminNavigationItem,
  canEnterTenantControlPlane,
  hasAnyRole,
  hasProviderControlPlaneRole,
  WORKFORCE_OPERATIONS_ROLES,
} from '../features/auth/control-plane-access';
import { useProviderSupportContext } from '../features/provider/use-provider-support-context';

const HomePage = lazy(() => import('../pages/home'));
const WorkPage = lazy(() => import('../pages/work'));
const AskPage = lazy(() => import('../pages/ask'));
const ActivityPage = lazy(() => import('../pages/activity'));
const AppsPage = lazy(() => import('../pages/apps'));
const HcmPage = lazy(() => import('../pages/hcm'));
const CommunicationsPage = lazy(() => import('../pages/communications'));
const CalendarPage = lazy(() => import('../pages/calendar'));
const ApprovalsPage = lazy(() => import('../pages/approvals'));
const ServicesPage = lazy(() => import('../pages/services'));
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
const authenticationFallback = <ShellBootScreen />;

function AdminRouteGuard({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const { pathname } = useLocation();
  const { permissions } = usePermissions();
  const roles = auth.user?.roles ?? [];
  const providerRole = hasProviderControlPlaneRole(roles);
  const supportContext = useProviderSupportContext(providerRole);
  const appPermitted = isAppResourceEntitled('APP.ADMINISTRATION', permissions);
  const regularAccess = canEnterTenantControlPlane(
    roles,
    appPermitted,
    false,
    auth.user?.resourceRoles
  );
  const assignedReviewerAccess = !providerRole && pathname === '/admin/identity/access-reviews';
  if (!regularAccess && providerRole && supportContext.isLoading) return <RouteFallback />;
  return assignedReviewerAccess ||
    canEnterTenantControlPlane(
      roles,
      appPermitted,
      Boolean(supportContext.data),
      auth.user?.resourceRoles
    ) ? (
    children
  ) : (
    <Navigate to="/403" replace />
  );
}

function AdminLegacyRedirect() {
  const auth = useAuth();
  const { hasPermission, isLoaded } = usePermissions();
  const [searchParams] = useSearchParams();
  const roles = auth.user?.roles ?? [];
  const providerRole = hasProviderControlPlaneRole(roles);
  const supportContext = useProviderSupportContext(providerRole);
  if (providerRole && supportContext.isLoading) return <RouteFallback />;
  const items = ADMIN_NAVIGATION.flatMap((group) => group.items).filter((item) =>
    canAccessAdminNavigationItem(item, {
      roles,
      permissionsLoaded: isLoaded,
      hasPermission,
      supportScopes: supportContext.data?.scopes,
      resourceRoles: auth.user?.resourceRoles,
    })
  );
  const requestedView = searchParams.get('view');
  const destination = items.find((item) => item.view === requestedView)?.path ?? items[0]?.path;
  return <Navigate to={destination ?? '/403'} replace />;
}

function AdminPeopleLegacyRedirect() {
  const { view } = useParams();
  if (view === 'people-directory') return <Navigate to="/hr/directory" replace />;
  if (view === 'directory') return <Navigate to="/hr/organization" replace />;
  if (view === 'access' || view === 'roles' || view === 'provisioning') {
    return <Navigate to={`/admin/identity/${view}`} replace />;
  }
  return <Navigate to="/admin" replace />;
}

function ProviderRouteGuard({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  return hasProviderControlPlaneRole(auth.user?.roles ?? []) ? (
    children
  ) : (
    <Navigate to="/403" replace />
  );
}

function WorkspaceRouteGuard({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const providerRole = hasProviderControlPlaneRole(auth.user?.roles ?? []);
  const supportContext = useProviderSupportContext(providerRole);
  if (providerRole && supportContext.isLoading) return <RouteFallback />;
  if (!providerRole) return children;
  return supportContext.data ? (
    <Navigate to="/admin" replace />
  ) : (
    <Navigate to="/provider" replace />
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

function HcmRouteGuard({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const { permissions } = usePermissions();
  const providerRole = hasProviderControlPlaneRole(auth.user?.roles ?? []);
  const supportContext = useProviderSupportContext(providerRole);
  if (providerRole && supportContext.isLoading) return <RouteFallback />;
  if (supportContext.data?.scopes.includes('WORKFORCE_READ')) return children;
  const entitled =
    isAppResourceEntitled('APP.HCM', permissions) ||
    isAppResourceEntitled('APP.PEOPLE_DIRECTORY', permissions) ||
    (isAppResourceEntitled('APP.WORKFORCE_MANAGEMENT', permissions) &&
      hasAnyRole(auth.user?.roles ?? [], WORKFORCE_OPERATIONS_ROLES));
  return entitled ? children : <Navigate to="/403" replace />;
}

function LegacyPeopleRedirect() {
  const location = useLocation();
  const pathname = mapLegacyHrPath(location.pathname);
  return <Navigate to={`${pathname}${location.search}${location.hash}`} replace />;
}

export const routesSection: RouteObject[] = [
  {
    path: 'approvals',
    element: (
      <AuthGuard fallback={authenticationFallback}>
        <WorkspaceRouteGuard>
          <AppRouteGuard resourceKey="APP.APPROVALS">
            <ApprovalLayout />
          </AppRouteGuard>
        </WorkspaceRouteGuard>
      </AuthGuard>
    ),
    children: [
      { index: true, element: <Navigate to="home" replace /> },
      {
        path: '*',
        element: (
          <Suspense fallback={fallback}>
            <ApprovalsPage />
          </Suspense>
        ),
      },
    ],
  },
  {
    path: 'calendar',
    element: (
      <AuthGuard fallback={authenticationFallback}>
        <WorkspaceRouteGuard>
          <AppRouteGuard resourceKey="APP.CALENDAR">
            <CalendarLayout />
          </AppRouteGuard>
        </WorkspaceRouteGuard>
      </AuthGuard>
    ),
    children: [
      { index: true, element: <Navigate to="home" replace /> },
      {
        path: '*',
        element: (
          <Suspense fallback={fallback}>
            <CalendarPage />
          </Suspense>
        ),
      },
    ],
  },
  {
    path: 'services',
    element: (
      <AuthGuard fallback={authenticationFallback}>
        <WorkspaceRouteGuard>
          <AppRouteGuard resourceKey="APP.EMPLOYEE_SERVICES">
            <ServicesLayout />
          </AppRouteGuard>
        </WorkspaceRouteGuard>
      </AuthGuard>
    ),
    children: [
      { index: true, element: <Navigate to="discover" replace /> },
      {
        path: ':view',
        element: (
          <Suspense fallback={fallback}>
            <ServicesPage />
          </Suspense>
        ),
      },
      {
        path: ':view/:requestId',
        element: (
          <Suspense fallback={fallback}>
            <ServicesPage />
          </Suspense>
        ),
      },
    ],
  },
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
          <Suspense fallback={fallback}>
            <CommunicationsPage />
          </Suspense>
        ),
      },
      {
        path: ':view/:storyId',
        element: (
          <Suspense fallback={fallback}>
            <CommunicationsPage />
          </Suspense>
        ),
      },
    ],
  },
  {
    path: 'hr',
    element: (
      <AuthGuard fallback={authenticationFallback}>
        <HcmRouteGuard>
          <HcmLayout />
        </HcmRouteGuard>
      </AuthGuard>
    ),
    children: [
      { index: true, element: <Navigate to="home" replace /> },
      {
        path: '*',
        element: (
          <Suspense fallback={fallback}>
            <HcmPage />
          </Suspense>
        ),
      },
    ],
  },
  {
    path: 'people/*',
    element: (
      <AuthGuard fallback={authenticationFallback}>
        <LegacyPeopleRedirect />
      </AuthGuard>
    ),
  },
  {
    path: 'workforce/*',
    element: (
      <AuthGuard fallback={authenticationFallback}>
        <LegacyPeopleRedirect />
      </AuthGuard>
    ),
  },
  {
    element: (
      <AuthGuard fallback={authenticationFallback}>
        <WorkspaceRouteGuard>
          <HomeLayout />
        </WorkspaceRouteGuard>
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
      <AuthGuard fallback={authenticationFallback}>
        <WorkspaceRouteGuard>
          <AppLayout />
        </WorkspaceRouteGuard>
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
      <AuthGuard fallback={authenticationFallback}>
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
      <AuthGuard fallback={authenticationFallback}>
        <AdminRouteGuard>
          <AdminLayout />
        </AdminRouteGuard>
      </AuthGuard>
    ),
    children: [
      { index: true, element: <AdminLegacyRedirect /> },
      { path: 'people/:view', element: <AdminPeopleLegacyRedirect /> },
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
      <AuthGuard fallback={authenticationFallback}>
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
