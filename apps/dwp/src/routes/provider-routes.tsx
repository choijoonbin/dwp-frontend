import { lazy, Suspense } from 'react';
import { AuthGuard } from '@dwp-frontend/shared-utils/auth/auth-guard';
import { useAuth } from '@dwp-frontend/shared-utils/auth/auth-provider';
import { hasProviderControlPlaneRole } from '@dwp-frontend/shared-utils/auth/control-plane-access';
import { Navigate, type RouteObject } from 'react-router-dom';

import { ProviderLayout } from '../layouts/provider-layout';
import { authenticationFallback, routeFallback } from './route-support';

const ProviderPage = lazy(() => import('../pages/provider'));

function ProviderRouteGuard({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  return hasProviderControlPlaneRole(auth.user?.roles ?? []) ? (
    children
  ) : (
    <Navigate to="/403" replace />
  );
}

export const providerRoutes: RouteObject[] = [
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
          <Suspense fallback={routeFallback}>
            <ProviderPage />
          </Suspense>
        ),
      },
      {
        path: 'tenants/:tenantId',
        element: (
          <Suspense fallback={routeFallback}>
            <ProviderPage />
          </Suspense>
        ),
      },
    ],
  },
];
