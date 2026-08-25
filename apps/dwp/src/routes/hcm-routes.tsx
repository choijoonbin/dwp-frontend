import { lazy, Suspense } from 'react';
import { AuthGuard } from '@dwp-frontend/shared-utils/auth/auth-guard';
import { useAuth } from '@dwp-frontend/shared-utils/auth/auth-provider';
import { isHcmReadEntitled } from '@dwp-frontend/shared-utils/auth/hcm-access';
import { hasProviderControlPlaneRole } from '@dwp-frontend/shared-utils/auth/control-plane-access';
import { usePermissions } from '@dwp-frontend/shared-utils/auth/use-permissions';
import { useProviderSupportContext } from '@dwp-frontend/shared-utils/auth/provider-support-context';
import { Navigate, useLocation, type RouteObject } from 'react-router-dom';

import { mapLegacyHrPath } from '../features/hcm/hcm-legacy-paths';
import { authenticationFallback, RouteFallback, routeFallback } from './route-support';

const HcmPage = lazy(() => import('../pages/hcm'));
const HcmLayout = lazy(() =>
  import('../layouts/hcm-layout').then((module) => ({ default: module.HcmLayout }))
);

function HcmRouteGuard({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const { permissions } = usePermissions();
  const providerRole = hasProviderControlPlaneRole(auth.user?.roles ?? []);
  const supportContext = useProviderSupportContext(providerRole);
  if (providerRole && supportContext.isLoading) return <RouteFallback />;
  if (supportContext.data?.scopes.includes('WORKFORCE_READ')) return children;
  const entitled = isHcmReadEntitled(
    permissions,
    auth.user?.roles ?? [],
    auth.user?.legacyRoleFallbackAllowed === true
  );
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
          <Suspense fallback={routeFallback}>
            <HcmLayout />
          </Suspense>
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
