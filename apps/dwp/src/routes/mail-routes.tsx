import { lazy, Suspense } from 'react';
import { AuthGuard } from '@dwp-frontend/shared-utils/auth/auth-guard';
import { Outlet, type RouteObject } from 'react-router-dom';

import { MAIL_PRODUCT_MANIFEST } from '../features/mail/mail-product-manifest';
import { resolveMailProductAreaMobileShell } from '../features/mail/mail-mobile-navigation';
import {
  MAIL_NAVIGATION_PROJECTION,
  renderMailNavigationMore,
} from '../features/mail/mail-navigation-more';
import { MailLayout } from '../layouts/mail-layout';
import {
  authenticationFallback,
  ProductRouteGuard,
  ProductWorkRouteGuard,
  routeFallback,
  WorkspaceRouteGuard,
} from './route-support';
import { buildTwoSurfaceProductChildren } from './two-surface-product-routes';
import { MailGovernedRoutePage } from './mail-governed-route-page';

const MailPage = lazy(() => import('../pages/mail'));

const page = (
  <MailGovernedRoutePage>
    <Suspense fallback={routeFallback}>
      <MailPage />
    </Suspense>
  </MailGovernedRoutePage>
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
      resolveMobileShell: resolveMailProductAreaMobileShell,
      shellNavigationProjection: MAIL_NAVIGATION_PROJECTION,
      renderNavigationItemChildren: renderMailNavigationMore,
      navigationChildrenPresentation: 'panel',
      renderPage: () => page,
      legacyUnknown: page,
    }),
  },
];
