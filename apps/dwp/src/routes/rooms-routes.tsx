import { lazy, Suspense } from 'react';
import { AuthGuard } from '@dwp-frontend/shared-utils/auth/auth-guard';
import { Navigate, Outlet, useLocation, type RouteObject } from 'react-router-dom';

import { WORKPLACE_PRODUCT_MANIFEST } from '../features/rooms/workplace-product-manifest';
import { normalizeProductPath } from '../components/product-manifest';
import { RoomsLayout } from '../layouts/rooms-layout';
import { buildProductPageRouteContractSource } from './draft-product-page-route-contract-source';
import { OFFICIAL_PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE } from './official-product-page-route-contracts';
import {
  authenticationFallback,
  ProductAnyRouteGuard,
  ProductWorkRouteGuard,
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
  <ProductWorkRouteGuard
    productId="workplace"
    surfaceId="workplace.work"
    resourceKey="APP.WORKPLACE"
  >
    <RoomsLayout />
  </ProductWorkRouteGuard>
);

const WORKPLACE_ADMIN_AUTHORITIES = [
  { resourceKey: 'ADMIN.WORKPLACE', permissionCode: 'VIEW' },
  { resourceKey: 'ADMIN.ROOMS', permissionCode: 'VIEW' },
] as const;

const managementLegacyShell = (
  <ProductAnyRouteGuard authorities={WORKPLACE_ADMIN_AUTHORITIES}>
    <RoomsLayout />
  </ProductAnyRouteGuard>
);

const workplaceCanonicalPaths = new Map(
  buildProductPageRouteContractSource(
    [WORKPLACE_PRODUCT_MANIFEST],
    OFFICIAL_PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE
  )
    .filter((route) => !route.pattern.includes(':'))
    .map((route) => [route.pattern.toLowerCase(), route.pattern] as const)
);

export function resolveLegacyRoomsPath(pathname: string): `/${string}` | undefined {
  const normalizedPath = normalizeProductPath(pathname);
  const lowerPath = normalizedPath.toLowerCase();
  if (lowerPath !== '/rooms' && !lowerPath.startsWith('/rooms/')) return undefined;
  const suffix = normalizedPath.slice('/rooms'.length).replace(/^\/+|\/+$/gu, '');
  const requestedTarget = suffix ? `/workplace/${suffix}` : '/workplace/home';
  return workplaceCanonicalPaths.get(requestedTarget.toLowerCase());
}

function LegacyRoomsRedirect() {
  const location = useLocation();
  const target = resolveLegacyRoomsPath(location.pathname);
  return target ? (
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
      managementLegacyShell,
      areaKey: 'rooms',
      translationNamespace: 'rooms',
      renderPage: () => page,
      legacyUnknown: page,
    }),
  },
  { path: 'rooms/*', element: <LegacyRoomsRedirect /> },
];
