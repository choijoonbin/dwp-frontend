import { lazy, Suspense } from 'react';
import { AuthGuard } from '@dwp-frontend/shared-utils/auth/auth-guard';
import { useAuth } from '@dwp-frontend/shared-utils/auth/auth-provider';
import { isProviderIdentity } from '@dwp-frontend/shared-utils/auth/control-plane-access';
import { usePermissions } from '@dwp-frontend/shared-utils/auth/use-permissions';
import { isAppResourceEntitled } from '@dwp-frontend/shared-utils/auth/app-entitlements';
import {
  Navigate,
  useLocation,
  useParams,
  useSearchParams,
  type RouteObject,
} from 'react-router-dom';

import {
  canAccessAdminNavigationItem,
  canEnterCompanyAdministration,
} from '../features/admin/admin-access-policy';
import { ADMIN_NAVIGATION } from '../features/admin/admin-navigation';
import { createGlobalProductApplicationRuntime } from '../components/create-global-product-application-runtime';
import { resolveProductLegacyRoute } from './product-route-contract-source';
import {
  ProductCanaryRouteBoundary,
  ProductCanarySurfaceBoundary,
} from './product-surface-canary-routes';
import {
  authenticationFallback,
  ProductRouteGuard,
  routeFallback,
  WorkspaceRouteGuard,
} from './route-support';

const AdminPage = lazy(() => import('../pages/admin'));
const AdminLayout = lazy(() =>
  import('../layouts/admin-layout').then((module) => ({ default: module.AdminLayout }))
);
const ADMINISTRATION_PRODUCT_RUNTIME = createGlobalProductApplicationRuntime('administration');
const ALL_PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE = ADMINISTRATION_PRODUCT_RUNTIME.pageRoutes;
const PRODUCT_LEGACY_ROUTE_SOURCE = ADMINISTRATION_PRODUCT_RUNTIME.legacyRoutes;

export function AdminRouteGuard({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  if (isProviderIdentity(auth.user)) return <Navigate to="/provider" replace />;
  return <TenantAdminRouteGuard>{children}</TenantAdminRouteGuard>;
}

function TenantAdminRouteGuard({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const { permissions } = usePermissions();
  const roles = auth.user?.roles ?? [];
  const appPermitted = isAppResourceEntitled('APP.ADMINISTRATION', permissions);
  const resourceRoles = auth.user?.resourceRoles ?? [];
  const regularAccess = canEnterCompanyAdministration(roles, appPermitted, resourceRoles);
  return regularAccess ? children : <Navigate to="/403" replace />;
}

export function AdminLegacyRedirect() {
  const auth = useAuth();
  if (isProviderIdentity(auth.user)) return <Navigate to="/provider" replace />;
  return <TenantAdminLegacyRedirect />;
}

function TenantAdminLegacyRedirect() {
  const auth = useAuth();
  const { hasPermission, isLoaded } = usePermissions();
  const [searchParams] = useSearchParams();
  const roles = auth.user?.roles ?? [];
  const items = ADMIN_NAVIGATION.flatMap((group) => group.items).filter((item) =>
    canAccessAdminNavigationItem(item, {
      roles,
      permissionsLoaded: isLoaded,
      hasPermission,
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

export function AdminSectionRedirect() {
  const auth = useAuth();
  if (isProviderIdentity(auth.user)) return <Navigate to="/provider" replace />;
  return <TenantAdminSectionRedirect />;
}

function TenantAdminSectionRedirect() {
  const auth = useAuth();
  const { section } = useParams();
  const { hasPermission, isLoaded } = usePermissions();
  const roles = auth.user?.roles ?? [];
  const destination = ADMIN_NAVIGATION.find((group) => group.id === section)?.items.find((item) =>
    canAccessAdminNavigationItem(item, {
      roles,
      permissionsLoaded: isLoaded,
      hasPermission,
      resourceRoles: auth.user?.resourceRoles,
    })
  )?.path;
  return <Navigate to={destination ?? '/403'} replace />;
}

function productAdminLegacyRedirect(
  path: string,
  resourceKey: string,
  requiredAnySupportScopes: readonly string[] = []
): RouteObject {
  const sourcePath = `/${path}`;
  const definitions = PRODUCT_LEGACY_ROUTE_SOURCE.filter(
    (candidate) => candidate.sourcePath === sourcePath
  );
  if (definitions.length !== 1) {
    throw new Error(`Product admin legacy redirect is not registered exactly once: ${sourcePath}`);
  }
  const definition = definitions[0]!;
  const targets = ALL_PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE.filter(
    (candidate) => candidate.routeContractKey === definition.targetRouteContractKey
  );
  if (targets.length !== 1) {
    throw new Error(
      `Product admin legacy redirect target is not registered: ${definition.redirectId}`
    );
  }
  const target = targets[0]!;
  const redirect = <ProductAdminLegacyDestination redirectId={definition.redirectId} />;
  const legacy = (
    <ProductRouteGuard
      resourceKey={resourceKey}
      requiredAnySupportScopes={requiredAnySupportScopes}
    >
      {redirect}
    </ProductRouteGuard>
  );
  return {
    path,
    element: (
      <AuthGuard fallback={authenticationFallback}>
        <WorkspaceRouteGuard>
          <ProductCanarySurfaceBoundary
            productId={target.productId}
            surfaceId={target.surfaceId}
            legacy={legacy}
          >
            <ProductCanaryRouteBoundary
              productId={target.productId}
              surfaceId={target.surfaceId}
              routeContractKey={target.routeContractKey}
            >
              {redirect}
            </ProductCanaryRouteBoundary>
          </ProductCanarySurfaceBoundary>
        </WorkspaceRouteGuard>
      </AuthGuard>
    ),
  };
}

function ProductAdminLegacyDestination({ redirectId }: { redirectId: string }) {
  const location = useLocation();
  const resolved = resolveProductLegacyRoute(
    location.pathname,
    location.search,
    location.hash,
    PRODUCT_LEGACY_ROUTE_SOURCE.filter((redirect) => redirect.redirectId === redirectId),
    ALL_PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE
  );
  return resolved ? <Navigate to={resolved.target} replace /> : <Navigate to="/404" replace />;
}

const productAdminLegacyRoutes: RouteObject[] = [
  productAdminLegacyRedirect('admin/experience/announcements', 'ADMIN.COMMUNICATIONS', [
    'TENANT_CONFIGURATION_READ',
    'TENANT_CONFIGURATION_WRITE',
  ]),
  productAdminLegacyRedirect('admin/services/service-catalog', 'ADMIN.SERVICE_CATALOG'),
  productAdminLegacyRedirect('admin/services/service-operations', 'ADMIN.SERVICE_OPERATIONS'),
  productAdminLegacyRedirect('admin/notifications/overview', 'ADMIN.NOTIFICATION_OPERATIONS'),
  productAdminLegacyRedirect('admin/notifications/contracts', 'ADMIN.NOTIFICATION_CONTRACT'),
  productAdminLegacyRedirect('admin/notifications/policies', 'ADMIN.NOTIFICATION_POLICY'),
  productAdminLegacyRedirect('admin/notifications/operations', 'ADMIN.NOTIFICATION_OPERATIONS'),
  productAdminLegacyRedirect('admin/spaces/overview', 'ADMIN.SPACE_GOVERNANCE'),
  productAdminLegacyRedirect('admin/spaces/directory', 'ADMIN.SPACE_GOVERNANCE'),
  productAdminLegacyRedirect('admin/spaces/requests', 'ADMIN.SPACE_GOVERNANCE'),
  productAdminLegacyRedirect('admin/spaces/templates', 'ADMIN.SPACE_TEMPLATES'),
  productAdminLegacyRedirect('admin/spaces/content-reviews', 'ADMIN.SPACE_COMPLIANCE'),
  productAdminLegacyRedirect('admin/spaces/lifecycle', 'ADMIN.SPACE_ACCESS_REVIEW'),
  productAdminLegacyRedirect('admin/spaces/operations', 'ADMIN.SPACE_GOVERNANCE'),
];

export const administrationRoutes: RouteObject[] = [
  ...productAdminLegacyRoutes,
  {
    path: 'admin',
    element: (
      <AuthGuard fallback={authenticationFallback}>
        <AdminRouteGuard>
          <Suspense fallback={routeFallback}>
            <AdminLayout />
          </Suspense>
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
