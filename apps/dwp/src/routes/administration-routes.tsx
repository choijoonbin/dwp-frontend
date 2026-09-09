import { lazy, Suspense, useEffect } from 'react';
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
import {
  SPACE_ADMIN_AUTHORITIES,
  SPACE_ADMIN_NAVIGATION_CONTRACTS,
} from '../components/spaces/space-admin-navigation-contract';
import { canAccessProductAreaNavigationItem } from '../layouts/product-area-permissions';
import { createGlobalProductApplicationRuntime } from '../components/create-global-product-application-runtime';
import { resolveProductLegacyRoute } from './product-route-contract-source';
import {
  authenticationFallback,
  ProductAnyRouteGuard,
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

export function TenantAdminRouteGuard({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const { permissions, isLoaded } = usePermissions();
  const roles = auth.user?.roles ?? [];
  const appPermitted = isAppResourceEntitled('APP.ADMINISTRATION', permissions);
  const resourceRoles = auth.user?.resourceRoles ?? [];
  if (!isLoaded) return routeFallback;
  const regularAccess = canEnterCompanyAdministration(roles, appPermitted, resourceRoles);
  return regularAccess ? children : <Navigate to="/403" replace />;
}

export function AdminLegacyRedirect() {
  const auth = useAuth();
  if (isProviderIdentity(auth.user)) return <Navigate to="/provider" replace />;
  return <TenantAdminLegacyRedirect />;
}

export function TenantAdminLegacyRedirect() {
  const auth = useAuth();
  const { hasPermission, isLoaded } = usePermissions();
  const [searchParams] = useSearchParams();
  const roles = auth.user?.roles ?? [];
  if (!isLoaded) return routeFallback;
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

export function TenantAdminSectionRedirect() {
  const auth = useAuth();
  const { section } = useParams();
  const { hasPermission, isLoaded } = usePermissions();
  const roles = auth.user?.roles ?? [];
  if (!isLoaded) return routeFallback;
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

export function SpacesAdminLegacyIndexRedirect() {
  const { hasPermission, isLoaded } = usePermissions();
  const location = useLocation();
  if (!isLoaded) return routeFallback;
  const destination = SPACE_ADMIN_NAVIGATION_CONTRACTS.find((item) =>
    canAccessProductAreaNavigationItem(item, hasPermission)
  )?.path;
  const target = destination ? `${destination}${location.search}${location.hash}` : '/403';
  return <ProductApplicationRedirect target={target} />;
}

export function ProductApplicationRedirect({ target }: { target: string }) {
  useEffect(() => window.location.replace(target), [target]);
  return routeFallback;
}

function productAdminLegacyRedirect(path: string): RouteObject {
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
  const lifecycle = definition.targetLifecycle === 'DRAFT' ? 'DRAFT' : 'OFFICIAL';
  return {
    path,
    handle: {
      routeContractKey: target.routeContractKey,
      productPageLifecycle: lifecycle,
    },
    element: (
      <AuthGuard fallback={authenticationFallback}>
        <WorkspaceRouteGuard>{redirect}</WorkspaceRouteGuard>
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
  return <ProductApplicationRedirect target={resolved?.target ?? '/404'} />;
}

const productAdminLegacyRoutes: RouteObject[] = [
  productAdminLegacyRedirect('admin/experience/announcements'),
  productAdminLegacyRedirect('admin/services/service-catalog'),
  productAdminLegacyRedirect('admin/services/service-operations'),
  productAdminLegacyRedirect('admin/notifications/overview'),
  productAdminLegacyRedirect('admin/notifications/contracts'),
  productAdminLegacyRedirect('admin/notifications/policies'),
  productAdminLegacyRedirect('admin/notifications/operations'),
  productAdminLegacyRedirect('admin/spaces/overview'),
  productAdminLegacyRedirect('admin/spaces/directory'),
  productAdminLegacyRedirect('admin/spaces/requests'),
  productAdminLegacyRedirect('admin/spaces/templates'),
  productAdminLegacyRedirect('admin/spaces/content-reviews'),
  productAdminLegacyRedirect('admin/spaces/lifecycle'),
  productAdminLegacyRedirect('admin/spaces/operations'),
];

export const administrationRoutes: RouteObject[] = [
  ...productAdminLegacyRoutes,
  {
    path: 'admin/spaces',
    handle: {
      productSurfaceId: 'spaces.management',
      productPageLifecycle: 'DRAFT',
      legacyProductIndex: true,
    },
    element: (
      <AuthGuard fallback={authenticationFallback}>
        <WorkspaceRouteGuard>
          <ProductAnyRouteGuard authorities={SPACE_ADMIN_AUTHORITIES}>
            <SpacesAdminLegacyIndexRedirect />
          </ProductAnyRouteGuard>
        </WorkspaceRouteGuard>
      </AuthGuard>
    ),
  },
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
