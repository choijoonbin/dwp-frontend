import { lazy, Suspense } from 'react';
import { AuthGuard } from '@dwp-frontend/shared-utils/auth/auth-guard';
import { Outlet, type RouteObject } from 'react-router-dom';

import { CALENDAR_PRODUCT_MANIFEST } from '../features/calendar/calendar-product-manifest';
import { CalendarLayout } from '../layouts/calendar-layout';
import {
  authenticationFallback,
  ProductRouteGuard,
  ProductWorkRouteGuard,
  routeFallback,
  WorkspaceRouteGuard,
} from './route-support';
import { buildTwoSurfaceProductChildren } from './two-surface-product-routes';

const CalendarPage = lazy(() => import('../pages/calendar'));

const page = (
  <Suspense fallback={routeFallback}>
    <CalendarPage />
  </Suspense>
);

const legacyShell = (
  <ProductWorkRouteGuard productId="calendar" surfaceId="calendar.work" resourceKey="APP.CALENDAR">
    <CalendarLayout />
  </ProductWorkRouteGuard>
);

const managementLegacyShell = (
  <ProductRouteGuard resourceKey="ADMIN.CALENDAR">
    <CalendarLayout />
  </ProductRouteGuard>
);

export const calendarRoutes: RouteObject[] = [
  {
    path: 'calendar',
    element: (
      <AuthGuard fallback={authenticationFallback}>
        <WorkspaceRouteGuard>
          <Outlet />
        </WorkspaceRouteGuard>
      </AuthGuard>
    ),
    children: buildTwoSurfaceProductChildren({
      manifest: CALENDAR_PRODUCT_MANIFEST,
      workSurfaceId: 'calendar.work',
      managementSurfaceId: 'calendar.management',
      managementBasePath: '/calendar/admin',
      legacyPath: '/calendar/home',
      legacyShell,
      managementLegacyShell,
      areaKey: 'calendar',
      translationNamespace: 'calendar',
      renderPage: () => page,
      legacyUnknown: page,
    }),
  },
];
