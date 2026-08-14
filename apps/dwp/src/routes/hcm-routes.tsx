import { lazy, Suspense } from 'react';
import { AuthGuard } from '@dwp-frontend/shared-utils/auth/auth-guard';
import { useAuth } from '@dwp-frontend/shared-utils/auth/auth-provider';
import { isAppResourceEntitled } from '@dwp-frontend/shared-utils/auth/app-entitlements';
import {
  hasAnyRole,
  hasProviderControlPlaneRole,
  WORKFORCE_OPERATIONS_ROLES,
} from '@dwp-frontend/shared-utils/auth/control-plane-access';
import { usePermissions } from '@dwp-frontend/shared-utils/auth/use-permissions';
import { useProviderSupportContext } from '@dwp-frontend/shared-utils/auth/provider-support-context';
import { Navigate, useLocation, type RouteObject } from 'react-router-dom';

import { mapLegacyHrPath } from '../features/hcm/hcm-navigation';
import { HcmLayout } from '../layouts/hcm-layout';
import { authenticationFallback, RouteFallback, routeFallback } from './route-support';

const HcmPage = lazy(() => import('../pages/hcm'));

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

export const hcmRoutes: RouteObject[] = [
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
          <Suspense fallback={routeFallback}>
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
];
