import { lazy, Suspense } from 'react';
import { AuthGuard } from '@dwp-frontend/shared-utils/auth/auth-guard';
import { Outlet, type RouteObject } from 'react-router-dom';

import { SPACE_PRODUCT_MANIFEST } from '../features/spaces/space-product-manifest';
import { SpaceLayout } from '../layouts/space-layout';
import {
  AppRouteGuard,
  authenticationFallback,
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
  <AppRouteGuard resourceKey="APP.SPACES">
    <SpaceLayout />
  </AppRouteGuard>
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
      areaKey: 'spaces',
      translationNamespace: 'spaces',
      renderPage: () => page,
      legacyUnknown: page,
    }),
  },
];
