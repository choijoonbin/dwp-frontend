import { lazy, Suspense } from 'react';
import { Navigate, useLocation, type RouteObject } from 'react-router-dom';
import { AuthGuard } from '@dwp-frontend/shared-utils/auth/auth-guard';

import { ActivityLayout } from '../layouts/activity-layout';
import {
  AppRouteGuard,
  authenticationFallback,
  routeFallback,
  WorkspaceRouteGuard,
} from './route-support';

const ActivityPage = lazy(() => import('../pages/activity'));
const ActivityHome = lazy(() =>
  import('../features/activity/activity-home').then((module) => ({ default: module.ActivityHome }))
);

export const activityRoutes: RouteObject[] = [
  {
    path: 'activity',
    element: (
      <AuthGuard fallback={authenticationFallback}>
        <WorkspaceRouteGuard>
          <AppRouteGuard resourceKey="APP.ACTIVITY">
            <ActivityLayout />
          </AppRouteGuard>
        </WorkspaceRouteGuard>
      </AuthGuard>
    ),
    children: [
      { index: true, element: <LegacyActivityEntry /> },
      {
        path: 'home',
        element: (
          <Suspense fallback={routeFallback}>
            <ActivityHome />
          </Suspense>
        ),
      },
      {
        path: 'timeline',
        element: (
          <Suspense fallback={routeFallback}>
            <ActivityPage />
          </Suspense>
        ),
      },
      { path: '*', element: <Navigate to="home" replace /> },
    ],
  },
];

function LegacyActivityEntry() {
  const { search } = useLocation();
  return (
    <Navigate to={{ pathname: search ? '/activity/timeline' : '/activity/home', search }} replace />
  );
}
