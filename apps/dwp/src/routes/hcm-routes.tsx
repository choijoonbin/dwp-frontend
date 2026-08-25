import { lazy, Suspense } from 'react';
import { AuthGuard } from '@dwp-frontend/shared-utils/auth/auth-guard';
import { useAuth } from '@dwp-frontend/shared-utils/auth/auth-provider';
import { isHcmReadEntitled } from '@dwp-frontend/shared-utils/auth/hcm-access';
import { hasProviderControlPlaneRole } from '@dwp-frontend/shared-utils/auth/control-plane-access';
import { usePermissions } from '@dwp-frontend/shared-utils/auth/use-permissions';
import { useProviderSupportContext } from '@dwp-frontend/shared-utils/auth/provider-support-context';
import { Navigate, Outlet, useLocation, type RouteObject } from 'react-router-dom';

import { mapLegacyHrPath } from '../features/hcm/hcm-legacy-paths';
import { HCM_PRODUCT_MANIFEST } from '../features/hcm/hcm-product-manifest';
import { useOptionalAllowedProductSurface } from '../components/allowed-product-surface-context';
import { ConfiguredProductSurfaceShell } from './configured-product-surface-shell';
import { PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE } from './product-page-route-contracts';
import {
  ProductCanaryRoot,
  ProductCanaryRouteBoundary,
  ProductCanarySurfaceBoundary,
  ProductCanaryUnknownRoute,
} from './product-surface-canary-routes';
import { ProductCanaryFirstAllowedIndex } from './two-surface-product-routes';
import { authenticationFallback, RouteFallback, routeFallback } from './route-support';

const HcmPage = lazy(() => import('../pages/hcm'));
const HcmLayout = lazy(() =>
  import('../layouts/hcm-layout').then((module) => ({ default: module.HcmLayout }))
);

function HcmRouteGuard({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const { permissions } = usePermissions();
  const governedSurface = useOptionalAllowedProductSurface();
  const providerRole = hasProviderControlPlaneRole(auth.user?.roles ?? []);
  const supportContext = useProviderSupportContext(providerRole);
  if (governedSurface) return children;
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

const hcmPage = (
  <Suspense fallback={routeFallback}>
    <HcmPage />
  </Suspense>
);

const legacyHcmShell = (
  <HcmRouteGuard>
    <Suspense fallback={routeFallback}>
      <HcmLayout />
    </Suspense>
  </HcmRouteGuard>
);

const hcmPageRoutes = PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE.filter(
  (route) => route.productId === 'hcm'
);

function hcmSurfaceShell(surfaceId: string) {
  return (
    <ConfiguredProductSurfaceShell
      manifest={HCM_PRODUCT_MANIFEST}
      surfaceId={surfaceId}
      areaKey="hcm"
      translationNamespace="hcm"
      legacy={legacyHcmShell}
    />
  );
}

function hcmSurfaceBoundary(surfaceId: string) {
  return (
    <ProductCanarySurfaceBoundary productId="hcm" surfaceId={surfaceId} legacy={legacyHcmShell}>
      {hcmSurfaceShell(surfaceId)}
    </ProductCanarySurfaceBoundary>
  );
}

function hcmGovernedPage(routeContractKey: string) {
  const route = hcmPageRoutes.find((candidate) => candidate.routeContractKey === routeContractKey);
  if (!route) throw new Error(`Unknown HCM route contract: ${routeContractKey}`);
  return (
    <ProductCanaryRouteBoundary
      productId="hcm"
      surfaceId={route.surfaceId}
      routeContractKey={route.routeContractKey}
      legacy={hcmPage}
    >
      {hcmPage}
    </ProductCanaryRouteBoundary>
  );
}

function hcmRelativePath(pattern: string, parent: string): string {
  const prefix = `${parent}/`;
  if (!pattern.startsWith(prefix)) throw new Error(`HCM route is outside ${parent}: ${pattern}`);
  return pattern.slice(prefix.length);
}

function hcmChildren(surfaceId: string, parent: string, indexRouteKey?: string): RouteObject[] {
  const records = hcmPageRoutes.filter((route) => route.surfaceId === surfaceId);
  return [
    ...(indexRouteKey
      ? [
          {
            index: true,
            handle: { routeContractKey: indexRouteKey },
            element: hcmGovernedPage(indexRouteKey),
          },
        ]
      : []),
    ...records
      .filter((route) => route.routeContractKey !== indexRouteKey)
      .map((route) => ({
        path: hcmRelativePath(route.pattern, parent),
        handle: { routeContractKey: route.routeContractKey },
        element: hcmGovernedPage(route.routeContractKey),
      })),
    {
      path: '*',
      element: <ProductCanaryUnknownRoute productId="hcm" legacy={hcmPage} />,
    },
  ];
}

function hcmSurfaceRoutes(): RouteObject[] {
  const managementCandidates = hcmPageRoutes.filter(
    (route) => route.surfaceId === 'hcm.management'
  );
  const managementByPrefix = (prefix: string) =>
    managementCandidates
      .filter((route) => route.pattern.startsWith(`${prefix}/`))
      .map((route) => ({
        path: hcmRelativePath(route.pattern, prefix),
        handle: { routeContractKey: route.routeContractKey },
        element: hcmGovernedPage(route.routeContractKey),
      }));
  return [
    {
      index: true,
      element: <ProductCanaryRoot manifest={HCM_PRODUCT_MANIFEST} legacyPath="/hr/home" />,
    },
    {
      path: 'manage',
      element: hcmSurfaceBoundary('hcm.management'),
      children: [
        {
          index: true,
          element: (
            <ProductCanaryFirstAllowedIndex
              productId="hcm"
              surfaceId="hcm.management"
              candidates={managementCandidates}
              legacy={hcmPage}
            />
          ),
        },
        { path: '*', element: <ProductCanaryUnknownRoute productId="hcm" legacy={hcmPage} /> },
      ],
    },
    {
      path: 'design',
      element: hcmSurfaceBoundary('hcm.management'),
      children: [
        ...managementByPrefix('/hr/design'),
        { path: '*', element: <ProductCanaryUnknownRoute productId="hcm" legacy={hcmPage} /> },
      ],
    },
    {
      path: 'data',
      element: hcmSurfaceBoundary('hcm.management'),
      children: [
        ...managementByPrefix('/hr/data'),
        { path: '*', element: <ProductCanaryUnknownRoute productId="hcm" legacy={hcmPage} /> },
      ],
    },
    {
      path: 'operations',
      element: hcmSurfaceBoundary('hcm.operations'),
      children: hcmChildren(
        'hcm.operations',
        '/hr/operations',
        'route.hcm.operations.overview.page'
      ),
    },
    {
      path: 'team',
      element: hcmSurfaceBoundary('hcm.team'),
      children: hcmChildren('hcm.team', '/hr/team', 'route.hcm.team.home.page'),
    },
    {
      element: hcmSurfaceBoundary('hcm.personal'),
      children: [
        ...hcmPageRoutes
          .filter((route) => route.surfaceId === 'hcm.personal')
          .map((route) => ({
            path: hcmRelativePath(route.pattern, '/hr'),
            handle: { routeContractKey: route.routeContractKey },
            element: hcmGovernedPage(route.routeContractKey),
          })),
        { path: '*', element: <ProductCanaryUnknownRoute productId="hcm" legacy={hcmPage} /> },
      ],
    },
  ];
}

export const hcmRoutes: RouteObject[] = [
  {
    path: 'hr',
    element: (
      <AuthGuard fallback={authenticationFallback}>
        <Outlet />
      </AuthGuard>
    ),
    children: hcmSurfaceRoutes(),
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
