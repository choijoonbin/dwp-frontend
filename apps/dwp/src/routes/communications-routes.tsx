import { lazy, Suspense } from 'react';
import { AuthGuard } from '@dwp-frontend/shared-utils/auth/auth-guard';
import { Navigate, Outlet, useLocation, type RouteObject } from 'react-router-dom';

import { COMMUNICATIONS_PRODUCT_MANIFEST } from '../features/communications/communications-product-manifest';
import { CommunicationsLayout } from '../layouts/communications-layout';
import { productPageRelativePattern } from './product-page-route-contracts';
import {
  AppRouteGuard,
  authenticationFallback,
  ProductRouteGuard,
  routeFallback,
  WorkspaceRouteGuard,
} from './route-support';
import {
  ProductCanaryRoot,
  ProductCanaryRouteBoundary,
  ProductCanarySurfaceBoundary,
  ProductCanaryUnknownRoute,
  preserveProductRouteLocation,
} from './product-surface-canary-routes';

const CommunicationsPage = lazy(() => import('../pages/communications'));
const CommunicationsHome = lazy(() =>
  import('../features/communications/communications-home').then((module) => ({
    default: module.CommunicationsHome,
  }))
);
const CommunicationsAdminContent = lazy(() =>
  import('../features/communications/communications-admin-content').then((module) => ({
    default: module.CommunicationsAdminContent,
  }))
);
const CommunicationsSurfaceShell = lazy(() =>
  import('./communications-canary-surface-shell').then((module) => ({
    default: module.CommunicationsCanarySurfaceShell,
  }))
);

const COMMUNICATIONS_SUPPORT_SCOPES = [
  'TENANT_CONFIGURATION_READ',
  'TENANT_CONFIGURATION_WRITE',
] as const;

const page = (children: React.ReactNode) => (
  <Suspense fallback={routeFallback}>{children}</Suspense>
);

const legacyWorkShell = (
  <AppRouteGuard
    resourceKey="APP.COMMUNICATIONS"
    requiredAnySupportScopes={COMMUNICATIONS_SUPPORT_SCOPES}
  >
    <CommunicationsLayout />
  </AppRouteGuard>
);

const legacyManagementShell = (
  <AppRouteGuard
    resourceKey="APP.COMMUNICATIONS"
    requiredAnySupportScopes={COMMUNICATIONS_SUPPORT_SCOPES}
  >
    <CommunicationsLayout />
  </AppRouteGuard>
);

function CommunicationsManagementIndex() {
  const location = useLocation();
  return (
    <Navigate
      to={preserveProductRouteLocation('/communications/admin/content', location)}
      replace
    />
  );
}

function communicationsWorkRoute(routeContractKey: string, element: React.ReactNode): RouteObject {
  return {
    path: productPageRelativePattern(routeContractKey, '/communications'),
    handle: { routeContractKey },
    element: (
      <ProductCanaryRouteBoundary
        productId="communications"
        surfaceId="communications.work"
        routeContractKey={routeContractKey}
      >
        {element}
      </ProductCanaryRouteBoundary>
    ),
  };
}

export const communicationsRoutes: RouteObject[] = [
  {
    path: 'communications',
    element: (
      <AuthGuard fallback={authenticationFallback}>
        <WorkspaceRouteGuard>
          <Outlet />
        </WorkspaceRouteGuard>
      </AuthGuard>
    ),
    children: [
      {
        index: true,
        element: (
          <ProductCanaryRoot
            manifest={COMMUNICATIONS_PRODUCT_MANIFEST}
            legacyPath="/communications/home"
          />
        ),
      },
      {
        path: 'admin',
        element: (
          <ProductCanarySurfaceBoundary
            productId="communications"
            surfaceId="communications.management"
            legacy={legacyManagementShell}
          >
            {page(<CommunicationsSurfaceShell surfaceId="communications.management" />)}
          </ProductCanarySurfaceBoundary>
        ),
        children: [
          { index: true, element: <CommunicationsManagementIndex /> },
          {
            path: productPageRelativePattern(
              'route.communications.management.content.page',
              '/communications/admin'
            ),
            handle: {
              routeContractKey: 'route.communications.management.content.page',
            },
            element: (
              <ProductCanaryRouteBoundary
                productId="communications"
                surfaceId="communications.management"
                routeContractKey="route.communications.management.content.page"
                legacy={
                  <ProductRouteGuard
                    resourceKey="ADMIN.COMMUNICATIONS"
                    requiredAnySupportScopes={COMMUNICATIONS_SUPPORT_SCOPES}
                  >
                    {page(<CommunicationsAdminContent />)}
                  </ProductRouteGuard>
                }
              >
                {page(<CommunicationsAdminContent />)}
              </ProductCanaryRouteBoundary>
            ),
          },
          {
            path: '*',
            element: (
              <ProductCanaryUnknownRoute
                productId="communications"
                legacy={page(<CommunicationsPage />)}
              />
            ),
          },
        ],
      },
      {
        element: (
          <ProductCanarySurfaceBoundary
            productId="communications"
            surfaceId="communications.work"
            legacy={legacyWorkShell}
          >
            {page(<CommunicationsSurfaceShell surfaceId="communications.work" />)}
          </ProductCanarySurfaceBoundary>
        ),
        children: [
          communicationsWorkRoute(
            'route.communications.work.home.page',
            page(<CommunicationsHome />)
          ),
          ...(['for-you', 'all', 'required', 'saved'] as const).map((view) =>
            communicationsWorkRoute(
              `route.communications.work.${view}.page`,
              page(<CommunicationsPage />)
            )
          ),
          ...(['for-you', 'all', 'required', 'saved'] as const).map((view) =>
            communicationsWorkRoute(
              `route.communications.work.${view}-story.page`,
              page(<CommunicationsPage />)
            )
          ),
          {
            path: ':view',
            element: (
              <ProductCanaryUnknownRoute
                productId="communications"
                legacy={page(<CommunicationsPage />)}
              />
            ),
          },
          {
            path: ':view/:storyId',
            element: (
              <ProductCanaryUnknownRoute
                productId="communications"
                legacy={page(<CommunicationsPage />)}
              />
            ),
          },
        ],
      },
    ],
  },
];
