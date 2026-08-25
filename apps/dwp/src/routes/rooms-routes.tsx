import { lazy, Suspense } from 'react';
import { AuthGuard } from '@dwp-frontend/shared-utils/auth/auth-guard';
import { Navigate, Outlet, useLocation, type RouteObject } from 'react-router-dom';

import { WORKPLACE_PRODUCT_MANIFEST } from '../features/rooms/workplace-product-manifest';
import { RoomsLayout } from '../layouts/rooms-layout';
import { DRAFT_PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE } from './draft-product-page-route-contracts';
import {
  AppRouteGuard,
  authenticationFallback,
  routeFallback,
  WorkspaceRouteGuard,
} from './route-support';
import { preserveProductRouteLocation } from './product-surface-canary-routes';
import { buildTwoSurfaceProductChildren } from './two-surface-product-routes';

const RoomsPage = lazy(() => import('../pages/rooms'));

const page = (
  <Suspense fallback={routeFallback}>
    <RoomsPage />
  </Suspense>
);

const legacyShell = (
  <AppRouteGuard resourceKey="APP.WORKPLACE">
    <RoomsLayout />
  </AppRouteGuard>
);

const workplaceCanonicalPaths = new Set(
  DRAFT_PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE.filter(
    (route) => route.productId === 'workplace' && !route.pattern.includes(':')
  ).map((route) => route.pattern)
);

function LegacyRoomsRedirect() {
  const location = useLocation();
  const suffix = location.pathname.replace(/^\/rooms\/?/u, '');
  const target = (suffix ? `/workplace/${suffix}` : '/workplace/home') as `/${string}`;
  return workplaceCanonicalPaths.has(target) ? (
    <Navigate to={preserveProductRouteLocation(target, location)} replace />
  ) : (
    <Navigate to="/404" replace />
  );
}

export const roomsRoutes: RouteObject[] = [
  {
    path: 'workplace',
    element: (
      <AuthGuard fallback={authenticationFallback}>
        <WorkspaceRouteGuard>
          <Outlet />
        </WorkspaceRouteGuard>
      </AuthGuard>
    ),
    children: buildTwoSurfaceProductChildren({
      manifest: WORKPLACE_PRODUCT_MANIFEST,
      workSurfaceId: 'workplace.work',
      managementSurfaceId: 'workplace.management',
      managementBasePath: '/workplace/admin',
      legacyPath: '/workplace/home',
      legacyShell,
      areaKey: 'rooms',
      translationNamespace: 'rooms',
      renderPage: () => page,
      legacyUnknown: page,
    }),
  },
  { path: 'rooms/*', element: <LegacyRoomsRedirect /> },
];
