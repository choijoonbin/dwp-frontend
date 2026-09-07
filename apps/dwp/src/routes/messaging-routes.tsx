import { lazy, Suspense } from 'react';
import { AuthGuard } from '@dwp-frontend/shared-utils/auth/auth-guard';
import { Outlet, type RouteObject } from 'react-router-dom';

import { MESSAGING_PRODUCT_MANIFEST } from '../features/messaging/messaging-product-manifest';
import { MessagingLayout } from '../layouts/messaging-layout';
import {
  authenticationFallback,
  ProductRouteGuard,
  ProductWorkRouteGuard,
  routeFallback,
  WorkspaceRouteGuard,
} from './route-support';
import { buildTwoSurfaceProductChildren } from './two-surface-product-routes';

const MessagingPage = lazy(() => import('../pages/messaging'));

const page = (
  <Suspense fallback={routeFallback}>
    <MessagingPage />
  </Suspense>
);

const legacyShell = (
  <ProductWorkRouteGuard
    productId="messaging"
    surfaceId="messaging.work"
    resourceKey="APP.MESSAGING"
  >
    <MessagingLayout />
  </ProductWorkRouteGuard>
);

const managementLegacyShell = (
  <ProductRouteGuard resourceKey="ADMIN.MESSAGING">
    <MessagingLayout />
  </ProductRouteGuard>
);

export const messagingRoutes: RouteObject[] = [
  {
    path: 'messages',
    element: (
      <AuthGuard fallback={authenticationFallback}>
        <WorkspaceRouteGuard>
          <Outlet />
        </WorkspaceRouteGuard>
      </AuthGuard>
    ),
    children: buildTwoSurfaceProductChildren({
      manifest: MESSAGING_PRODUCT_MANIFEST,
      workSurfaceId: 'messaging.work',
      managementSurfaceId: 'messaging.management',
      managementBasePath: '/messages/admin',
      legacyPath: '/messages/home',
      legacyShell,
      managementLegacyShell,
      areaKey: 'messaging',
      translationNamespace: 'messaging',
      renderPage: () => page,
      legacyUnknown: page,
    }),
  },
];
