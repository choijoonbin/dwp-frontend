import { lazy, Suspense } from 'react';
import { AuthGuard } from '@dwp-frontend/shared-utils/auth/auth-guard';
import { Navigate, Outlet, useLocation, type RouteObject } from 'react-router-dom';

import { WORKPLACE_PRODUCT_MANIFEST } from '../features/rooms/workplace-product-manifest';
import { migrateLegacyWorkplaceFindUrl } from '../features/rooms/workplace-find-url-state';
import { migrateLegacyWorkplaceReservationsUrl } from '../features/rooms/workplace-reservations-url-state';
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
const WorkplaceVisitKioskRoute = lazy(() =>
  import('../features/rooms/workplace-visit-kiosk').then((module) => ({
    default: module.WorkplaceVisitKioskRoute,
  }))
);
const WorkplaceDeviceDisplayRoute = lazy(
  () => import('../features/rooms/workplace-navigation-device-route')
);

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

export function resolveLegacyWorkplaceFindLocation(
  search: string,
  hash: string,
  source: 'explore' | 'rooms'
) {
  const normalized = migrateLegacyWorkplaceFindUrl(new URLSearchParams(search), source);
  return {
    pathname: '/workplace/find',
    search: `?${normalized.toString()}`,
    hash,
  } as const;
}

function LegacyWorkplaceFindRedirect({ source }: { source: 'explore' | 'rooms' }) {
  const location = useLocation();
  return (
    <Navigate
      replace
      to={resolveLegacyWorkplaceFindLocation(location.search, location.hash, source)}
    />
  );
}

export function resolveLegacyWorkplaceReservationsLocation(
  search: string,
  hash: string,
  source: 'my-bookings' | 'my-meetings'
) {
  const normalized = migrateLegacyWorkplaceReservationsUrl(new URLSearchParams(search), source);
  return {
    pathname: '/workplace/reservations',
    search: `?${normalized.toString()}`,
    hash,
  } as const;
}

function LegacyWorkplaceReservationsRedirect({
  source,
}: {
  source: 'my-bookings' | 'my-meetings';
}) {
  const location = useLocation();
  return (
    <Navigate
      replace
      to={resolveLegacyWorkplaceReservationsLocation(location.search, location.hash, source)}
    />
  );
}

export const roomsRoutes: RouteObject[] = [
  {
    path: 'device/workplace/devices/:deviceId/display',
    element: (
      <Suspense fallback={routeFallback}>
        <WorkplaceDeviceDisplayRoute />
      </Suspense>
    ),
  },
  {
    path: 'workplace/kiosk',
    element: (
      <Suspense fallback={routeFallback}>
        <WorkplaceVisitKioskRoute />
      </Suspense>
    ),
  },
  {
    path: 'workplace',
    element: (
      <AuthGuard fallback={authenticationFallback}>
        <WorkspaceRouteGuard>
          <Outlet />
        </WorkspaceRouteGuard>
      </AuthGuard>
    ),
    children: [
      { path: 'rooms', element: <LegacyWorkplaceFindRedirect source="rooms" /> },
      {
        path: 'my-bookings',
        element: <LegacyWorkplaceReservationsRedirect source="my-bookings" />,
      },
      {
        path: 'my-meetings',
        element: <LegacyWorkplaceReservationsRedirect source="my-meetings" />,
      },
      ...buildTwoSurfaceProductChildren({
        manifest: WORKPLACE_PRODUCT_MANIFEST,
        workSurfaceId: 'workplace.work',
        managementSurfaceId: 'workplace.management',
        managementBasePath: '/workplace/admin',
        legacyPath: '/workplace/home',
        legacyShell,
        managementLegacyShell,
        areaKey: 'rooms',
        translationNamespace: 'rooms',
        renderPage: (route) =>
          route.routeContractKey === 'route.workplace.work.explore.page' ? (
            <LegacyWorkplaceFindRedirect source="explore" />
          ) : (
            page
          ),
        legacyUnknown: page,
      }),
    ],
  },
  { path: 'rooms/*', element: <LegacyRoomsRedirect /> },
];
