import { lazy, Suspense } from 'react';
import { AuthGuard } from '@dwp-frontend/shared-utils/auth/auth-guard';
import { useAuth } from '@dwp-frontend/shared-utils/auth/auth-provider';
import { hasProviderControlPlaneRole } from '@dwp-frontend/shared-utils/auth/control-plane-access';
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

import {
  canAccessAdminNavigationItem,
  canEnterCompanyAdministration,
} from '../features/admin/admin-access-policy';
import { ADMIN_NAVIGATION } from '../features/admin/admin-navigation';
import { AdminLayout } from '../layouts/admin-layout';
import {
  PRODUCT_LEGACY_ROUTE_SOURCE,
  PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE,
} from './product-page-route-contracts';
import { resolveProductLegacyRoute } from './product-route-contract-source';
import {
  ProductCanaryRouteBoundary,
  ProductCanarySurfaceBoundary,
} from './product-surface-canary-routes';
import {
  authenticationFallback,
  ProductRouteGuard,
  RouteFallback,
  routeFallback,
  WorkspaceRouteGuard,
} from './route-support';

const AdminPage = lazy(() => import('../pages/admin'));

function AdminRouteGuard({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const { permissions } = usePermissions();
  const roles = auth.user?.roles ?? [];
  const providerRole = hasProviderControlPlaneRole(roles);
  const supportContext = useProviderSupportContext(providerRole);
  const appPermitted = isAppResourceEntitled('APP.ADMINISTRATION', permissions);
  const regularAccess = canEnterCompanyAdministration(roles, appPermitted, false);
  if (!regularAccess && providerRole && supportContext.isLoading) return <RouteFallback />;
  return canEnterCompanyAdministration(roles, appPermitted, Boolean(supportContext.data)) ? (
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

function productAdminLegacyRedirect(
  path: string,
  destination: string,
  resourceKey: string,
  requiredAnySupportScopes: readonly string[] = [],
  canary?: {
    redirectId: string;
    productId: string;
    surfaceId: string;
    routeContractKey: string;
  }
): RouteObject {
  const redirect = <ProductAdminLegacyDestination destination={destination} canary={canary} />;
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
          {canary ? (
            <ProductCanarySurfaceBoundary
              productId={canary.productId}
              surfaceId={canary.surfaceId}
              legacy={legacy}
            >
              <ProductCanaryRouteBoundary
                productId={canary.productId}
                surfaceId={canary.surfaceId}
                routeContractKey={canary.routeContractKey}
              >
                {redirect}
              </ProductCanaryRouteBoundary>
            </ProductCanarySurfaceBoundary>
          ) : (
            legacy
          )}
        </WorkspaceRouteGuard>
      </AuthGuard>
    ),
  };
}

function ProductAdminLegacyDestination({
  destination,
  canary,
}: {
  destination: string;
  canary?: { redirectId: string };
}) {
  const location = useLocation();
  const resolved = canary
    ? resolveProductLegacyRoute(
        location.pathname,
        location.search,
        location.hash,
        PRODUCT_LEGACY_ROUTE_SOURCE.filter((redirect) => redirect.redirectId === canary.redirectId),
        PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE
      )
    : undefined;
  if (canary && !resolved) return <Navigate to="/404" replace />;
  const target = resolved?.target ?? `${destination}${location.search}${location.hash}`;
  return <Navigate to={target} replace />;
}

const productAdminLegacyRoutes: RouteObject[] = [
  productAdminLegacyRedirect(
    'admin/experience/announcements',
    '/communications/admin/content',
    'ADMIN.COMMUNICATIONS',
    ['TENANT_CONFIGURATION_READ', 'TENANT_CONFIGURATION_WRITE'],
    {
      redirectId: 'communications-management-announcements-v1',
      productId: 'communications',
      surfaceId: 'communications.management',
      routeContractKey: 'route.communications.management.content.page',
    }
  ),
  productAdminLegacyRedirect(
    'admin/services/service-catalog',
    '/services/admin/catalog',
    'ADMIN.SERVICE_CATALOG',
    [],
    {
      redirectId: 'services-management-catalog-v1',
      productId: 'services',
      surfaceId: 'services.management',
      routeContractKey: 'route.services.management.catalog.page',
    }
  ),
  productAdminLegacyRedirect(
    'admin/services/service-operations',
    '/services/admin/operations',
    'ADMIN.SERVICE_OPERATIONS',
    [],
    {
      redirectId: 'services-management-operations-v1',
      productId: 'services',
      surfaceId: 'services.management',
      routeContractKey: 'route.services.management.operations.page',
    }
  ),
  productAdminLegacyRedirect(
    'admin/notifications/overview',
    '/notifications/admin/overview',
    'ADMIN.NOTIFICATION_OPERATIONS'
  ),
  productAdminLegacyRedirect(
    'admin/notifications/contracts',
    '/notifications/admin/contracts',
    'ADMIN.NOTIFICATION_CONTRACT'
  ),
  productAdminLegacyRedirect(
    'admin/notifications/policies',
    '/notifications/admin/policies',
    'ADMIN.NOTIFICATION_POLICY'
  ),
  productAdminLegacyRedirect(
    'admin/notifications/operations',
    '/notifications/admin/operations',
    'ADMIN.NOTIFICATION_OPERATIONS'
  ),
  productAdminLegacyRedirect(
    'admin/spaces/overview',
    '/spaces/admin/overview',
    'ADMIN.SPACE_GOVERNANCE'
  ),
  productAdminLegacyRedirect(
    'admin/spaces/directory',
    '/spaces/admin/directory',
    'ADMIN.SPACE_GOVERNANCE'
  ),
  productAdminLegacyRedirect(
    'admin/spaces/requests',
    '/spaces/admin/requests',
    'ADMIN.SPACE_GOVERNANCE'
  ),
  productAdminLegacyRedirect(
    'admin/spaces/templates',
    '/spaces/admin/templates',
    'ADMIN.SPACE_TEMPLATES'
  ),
  productAdminLegacyRedirect(
    'admin/spaces/content-reviews',
    '/spaces/admin/content-reviews',
    'ADMIN.SPACE_COMPLIANCE'
  ),
  productAdminLegacyRedirect(
    'admin/spaces/lifecycle',
    '/spaces/admin/lifecycle',
    'ADMIN.SPACE_ACCESS_REVIEW'
  ),
  productAdminLegacyRedirect(
    'admin/spaces/operations',
    '/spaces/admin/operations',
    'ADMIN.SPACE_GOVERNANCE'
  ),
];

export const administrationRoutes: RouteObject[] = [
  ...productAdminLegacyRoutes,
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
