import { lazy, Suspense } from 'react';
import { AuthGuard } from '@dwp-frontend/shared-utils/auth/auth-guard';
import { Outlet, type RouteObject } from 'react-router-dom';

import { COMMUNICATIONS_PRODUCT_MANIFEST } from '../features/communications/communications-product-manifest';
import { COMMUNICATIONS_WORK_NAVIGATION } from '../features/communications/communications-navigation';
import { CommunicationsLayout } from '../layouts/communications-layout';
import { ProductAreaNavigationItemAccessGuard } from '../layouts/product-area-navigation-access-guard';
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
  ProductCanaryFirstAllowedIndex,
  ProductCanaryIndexedSurfaceBoundary,
  ProductCanaryRouteBoundary,
  ProductCanarySurfaceBoundary,
  ProductCanaryUnknownRoute,
} from './product-surface-canary-routes';

import type { ProductNavigationGroup } from '../components/product-manifest';

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

const communicationsManagementIndexCandidates = [
  {
    routeContractKey: 'route.communications.management.content.page',
    path: '/communications/admin/content',
  },
] as const;

function communicationsWorkRoute(
  routeContractKey: string,
  navigationPath: string,
  element: React.ReactNode
): RouteObject {
  const navigationItem = (COMMUNICATIONS_WORK_NAVIGATION as readonly ProductNavigationGroup[])
    .flatMap((group) => group.items)
    .find((item) => item.path === navigationPath);
  if (!navigationItem) {
    throw new Error(`Missing Communications work navigation item: ${navigationPath}`);
  }
  return {
    path: productPageRelativePattern(routeContractKey, '/communications'),
    handle: { routeContractKey },
    element: (
      <ProductCanaryRouteBoundary
        productId="communications"
        surfaceId="communications.work"
        routeContractKey={routeContractKey}
        legacy={
          <ProductAreaNavigationItemAccessGuard item={navigationItem}>
            {element}
          </ProductAreaNavigationItemAccessGuard>
        }
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
          <ProductCanaryIndexedSurfaceBoundary
            productId="communications"
            surfaceId="communications.management"
            indexPath="/communications/admin"
            legacy={legacyManagementShell}
          >
            {page(<CommunicationsSurfaceShell surfaceId="communications.management" />)}
          </ProductCanaryIndexedSurfaceBoundary>
        ),
        children: [
          {
            index: true,
            element: (
              <ProductCanaryFirstAllowedIndex
                productId="communications"
                surfaceId="communications.management"
                candidates={communicationsManagementIndexCandidates}
                legacy={page(<CommunicationsPage />)}
              />
            ),
          },
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
                    localDeny
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
            '/communications/home',
            page(<CommunicationsHome />)
          ),
          ...(['for-you', 'all', 'required', 'saved'] as const).map((view) =>
            communicationsWorkRoute(
              `route.communications.work.${view}.page`,
              `/communications/${view}`,
              page(<CommunicationsPage />)
            )
          ),
          ...(['for-you', 'all', 'required', 'saved'] as const).map((view) =>
            communicationsWorkRoute(
              `route.communications.work.${view}-story.page`,
              `/communications/${view}`,
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
