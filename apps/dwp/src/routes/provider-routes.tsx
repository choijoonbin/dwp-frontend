import { lazy, Suspense } from 'react';
import { AuthGuard } from '@dwp-frontend/shared-utils/auth/auth-guard';
import { useAuth } from '@dwp-frontend/shared-utils/auth/auth-provider';
import {
  hasProviderControlPlaneRole,
  isProviderIdentity,
} from '@dwp-frontend/shared-utils/auth/control-plane-access';
import { Navigate, type RouteObject } from 'react-router-dom';

import { authenticationFallback, routeFallback } from './route-support';

const ProviderAccessPending = lazy(() =>
  import('../features/provider/provider-access-pending').then((module) => ({
    default: module.ProviderAccessPending,
  }))
);
const ProviderLanding = lazy(() =>
  import('../features/provider/provider-landing').then((module) => ({
    default: module.ProviderLanding,
  }))
);

const ProviderLayout = lazy(() =>
  import('../layouts/provider-layout').then((module) => ({ default: module.ProviderLayout }))
);
const ProviderPage = lazy(() => import('../pages/provider'));
const ProviderTenantExperiencePreviewPage = lazy(
  () => import('../pages/provider-tenant-experience-preview')
);

function ProviderRouteGuard({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  if (!isProviderIdentity(auth.user)) return <Navigate to="/403" replace />;
  if (!hasProviderControlPlaneRole(auth.user?.roles ?? [])) {
    return (
      <Suspense fallback={routeFallback}>
        <ProviderAccessPending />
      </Suspense>
    );
  }
  return children;
}

export const providerRoutes: RouteObject[] = [
  {
    path: 'provider',
    element: (
      <AuthGuard fallback={authenticationFallback}>
        <ProviderRouteGuard>
          <Suspense fallback={routeFallback}>
            <ProviderLayout />
          </Suspense>
        </ProviderRouteGuard>
      </AuthGuard>
    ),
    children: [
      {
        index: true,
        element: (
          <Suspense fallback={routeFallback}>
            <ProviderLanding />
          </Suspense>
        ),
      },
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
      {
        path: 'tenants/:tenantId/experience-preview',
        element: (
          <Suspense fallback={routeFallback}>
            <ProviderTenantExperiencePreviewPage />
          </Suspense>
        ),
      },
    ],
  },
];
