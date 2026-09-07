import { lazy, Suspense } from 'react';
import { AuthGuard } from '@dwp-frontend/shared-utils/auth/auth-guard';
import { Outlet, type RouteObject } from 'react-router-dom';

import { MAIL_PRODUCT_MANIFEST } from '../features/mail/mail-product-manifest';
import { MailLayout } from '../layouts/mail-layout';
import {
  authenticationFallback,
  ProductRouteGuard,
  ProductWorkRouteGuard,
  routeFallback,
  WorkspaceRouteGuard,
} from './route-support';
import { buildTwoSurfaceProductChildren } from './two-surface-product-routes';

const MailPage = lazy(() => import('../pages/mail'));

const page = (
  <Suspense fallback={routeFallback}>
    <MailPage />
  </Suspense>
);

const legacyShell = (
  <ProductWorkRouteGuard productId="mail" surfaceId="mail.work" resourceKey="APP.MAIL">
    <MailLayout />
  </ProductWorkRouteGuard>
);

const managementLegacyShell = (
  <ProductRouteGuard resourceKey="ADMIN.MAIL">
    <MailLayout />
  </ProductRouteGuard>
);

export const mailRoutes: RouteObject[] = [
  {
    path: 'mail',
    element: (
      <AuthGuard fallback={authenticationFallback}>
        <WorkspaceRouteGuard>
          <Outlet />
        </WorkspaceRouteGuard>
      </AuthGuard>
    ),
    children: buildTwoSurfaceProductChildren({
      manifest: MAIL_PRODUCT_MANIFEST,
      workSurfaceId: 'mail.work',
      managementSurfaceId: 'mail.management',
      managementBasePath: '/mail/admin',
      legacyPath: '/mail/home',
      legacyShell,
      managementLegacyShell,
      areaKey: 'mail',
      translationNamespace: 'mail',
      renderPage: () => page,
      legacyUnknown: page,
    }),
  },
];
