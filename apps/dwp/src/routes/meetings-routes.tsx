import { lazy, Suspense } from 'react';
import { AuthGuard } from '@dwp-frontend/shared-utils/auth/auth-guard';
import { Outlet, type RouteObject } from 'react-router-dom';

import { MEETINGS_PRODUCT_MANIFEST } from '../features/meetings/meetings-product-manifest';
import { MeetingsLayout } from '../layouts/meetings-layout';
import {
  authenticationFallback,
  ProductRouteGuard,
  ProductWorkRouteGuard,
  routeFallback,
  WorkspaceRouteGuard,
} from './route-support';
import { buildTwoSurfaceProductChildren } from './two-surface-product-routes';

const MeetingsPage = lazy(() => import('../pages/meetings'));

const page = (
  <Suspense fallback={routeFallback}>
    <MeetingsPage />
  </Suspense>
);

const legacyShell = (
  <ProductWorkRouteGuard productId="meetings" surfaceId="meetings.work" resourceKey="APP.MEETINGS">
    <MeetingsLayout />
  </ProductWorkRouteGuard>
);

const managementLegacyShell = (
  <ProductRouteGuard resourceKey="ADMIN.MEETINGS">
    <MeetingsLayout />
  </ProductRouteGuard>
);

export const meetingsRoutes: RouteObject[] = [
  {
    path: 'meetings',
    element: (
      <AuthGuard fallback={authenticationFallback}>
        <WorkspaceRouteGuard>
          <Outlet />
        </WorkspaceRouteGuard>
      </AuthGuard>
    ),
    children: buildTwoSurfaceProductChildren({
      manifest: MEETINGS_PRODUCT_MANIFEST,
      workSurfaceId: 'meetings.work',
      managementSurfaceId: 'meetings.management',
      managementBasePath: '/meetings/admin',
      legacyPath: '/meetings/home',
      legacyShell,
      managementLegacyShell,
      areaKey: 'meetings',
      translationNamespace: 'meetings',
      renderPage: () => page,
      legacyUnknown: page,
    }),
  },
];
