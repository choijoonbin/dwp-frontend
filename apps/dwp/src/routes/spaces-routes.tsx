import { lazy, Suspense } from 'react';
import { AuthGuard } from '@dwp-frontend/shared-utils/auth/auth-guard';
import { Outlet, type RouteObject } from 'react-router-dom';

import { SPACE_ADMIN_AUTHORITIES } from '../components/spaces/space-admin-navigation-contract';
import { SPACE_PRODUCT_MANIFEST } from '../features/spaces/space-product-manifest';
import { SpaceLayout } from '../layouts/space-layout';
import {
  authenticationFallback,
  ProductAnyRouteGuard,
  ProductWorkRouteGuard,
  routeFallback,
  WorkspaceRouteGuard,
} from './route-support';
import { buildTwoSurfaceProductChildren } from './two-surface-product-routes';

const SpacesPage = lazy(() => import('../pages/spaces'));

const page = (
  <Suspense fallback={routeFallback}>
    <SpacesPage />
  </Suspense>
);

const legacyShell = (
  <ProductWorkRouteGuard productId="spaces" surfaceId="spaces.work" resourceKey="APP.SPACES">
    <SpaceLayout />
  </ProductWorkRouteGuard>
);

const managementLegacyShell = (
  <ProductAnyRouteGuard authorities={SPACE_ADMIN_AUTHORITIES}>
    <SpaceLayout />
  </ProductAnyRouteGuard>
);

export const spacesRoutes: RouteObject[] = [
  {
    path: 'spaces',
    element: (
      <AuthGuard fallback={authenticationFallback}>
        <WorkspaceRouteGuard>
          <Outlet />
        </WorkspaceRouteGuard>
      </AuthGuard>
    ),
    children: buildTwoSurfaceProductChildren({
      manifest: SPACE_PRODUCT_MANIFEST,
      workSurfaceId: 'spaces.work',
      managementSurfaceId: 'spaces.management',
      managementBasePath: '/spaces/admin',
      legacyPath: '/spaces/home',
      legacyShell,
      managementLegacyShell,
      areaKey: 'spaces',
      translationNamespace: 'spaces',
      renderPage: () => page,
      legacyUnknown: page,
    }),
  },
];
