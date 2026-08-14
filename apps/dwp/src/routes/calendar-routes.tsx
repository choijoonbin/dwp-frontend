import { lazy, Suspense } from 'react';
import { AuthGuard } from '@dwp-frontend/shared-utils/auth/auth-guard';
import { Navigate, type RouteObject } from 'react-router-dom';

import { CalendarLayout } from '../layouts/calendar-layout';
import {
  AppRouteGuard,
  authenticationFallback,
  routeFallback,
  WorkspaceRouteGuard,
} from './route-support';

const CalendarPage = lazy(() => import('../pages/calendar'));

export const calendarRoutes: RouteObject[] = [
  {
    path: 'calendar',
    element: (
      <AuthGuard fallback={authenticationFallback}>
        <WorkspaceRouteGuard>
          <AppRouteGuard resourceKey="APP.CALENDAR">
            <CalendarLayout />
          </AppRouteGuard>
        </WorkspaceRouteGuard>
      </AuthGuard>
    ),
    children: [
      { index: true, element: <Navigate to="home" replace /> },
      {
        path: '*',
        element: (
          <Suspense fallback={routeFallback}>
            <CalendarPage />
          </Suspense>
        ),
      },
    ],
  },
];
