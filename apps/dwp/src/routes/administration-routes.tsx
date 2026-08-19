import { lazy, Suspense } from 'react';
import { AuthGuard } from '@dwp-frontend/shared-utils/auth/auth-guard';
import { useAuth } from '@dwp-frontend/shared-utils/auth/auth-provider';
import {
  canEnterTenantControlPlane,
  hasProviderControlPlaneRole,
} from '@dwp-frontend/shared-utils/auth/control-plane-access';
import { usePermissions } from '@dwp-frontend/shared-utils/auth/use-permissions';
import { useProviderSupportContext } from '@dwp-frontend/shared-utils/auth/provider-support-context';
import { isAppResourceEntitled } from '@dwp-frontend/shared-utils/auth/app-entitlements';
import {
  Navigate,
  useLocation,
  useParams,
  useSearchParams,
  type RouteObject,
} from 'react-router-dom';

import { canAccessAdminNavigationItem } from '../features/admin/admin-access-policy';
import { ADMIN_NAVIGATION } from '../features/admin/admin-navigation';
import { AdminLayout } from '../layouts/admin-layout';
import { authenticationFallback, RouteFallback, routeFallback } from './route-support';

const AdminPage = lazy(() => import('../pages/admin'));

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

function AdminSectionRedirect() {
  const auth = useAuth();
  const { section } = useParams();
  const { hasPermission, isLoaded } = usePermissions();
  const roles = auth.user?.roles ?? [];
  const providerRole = hasProviderControlPlaneRole(roles);
  const supportContext = useProviderSupportContext(providerRole);
  if (providerRole && supportContext.isLoading) return <RouteFallback />;
  const destination = ADMIN_NAVIGATION.find((group) => group.id === section)?.items.find((item) =>
    canAccessAdminNavigationItem(item, {
      roles,
      permissionsLoaded: isLoaded,
      hasPermission,
      supportScopes: supportContext.data?.scopes,
      resourceRoles: auth.user?.resourceRoles,
    })
  )?.path;
  return <Navigate to={destination ?? '/403'} replace />;
}

export const administrationRoutes: RouteObject[] = [
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
      { path: ':section', element: <AdminSectionRedirect /> },
      {
        path: ':section/:view',
        element: (
          <Suspense fallback={routeFallback}>
            <AdminPage />
          </Suspense>
        ),
      },
    ],
  },
];
