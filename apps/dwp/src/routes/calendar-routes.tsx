import { lazy, Suspense } from 'react';
import { AuthGuard } from '@dwp-frontend/shared-utils/auth/auth-guard';
import { Outlet, type RouteObject } from 'react-router-dom';

import { CALENDAR_PRODUCT_MANIFEST } from '../features/calendar/calendar-product-manifest';
import { CalendarLayout } from '../layouts/calendar-layout';
import {
  AppRouteGuard,
  authenticationFallback,
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
  <AppRouteGuard resourceKey="APP.CALENDAR">
    <CalendarLayout />
  </AppRouteGuard>
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
      areaKey: 'calendar',
      translationNamespace: 'calendar',
      renderPage: () => page,
      legacyUnknown: page,
    }),
  },
];
