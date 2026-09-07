import { lazy, Suspense } from 'react';
import { Navigate, useLocation, useParams, type RouteObject } from 'react-router-dom';
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
        path: 'events/:eventId',
        element: <ActivityEventEntry />,
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

// Shared inspection entry preserves APP.ACTIVITY access without requiring APP.WORK.
function ActivityEventEntry() {
  const { eventId } = useParams();
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  if (eventId) params.set('event', eventId);
  return <Navigate to={{ pathname: '/activity/timeline', search: params.toString() }} replace />;
}

function LegacyActivityEntry() {
  const { search } = useLocation();
  return (
    <Navigate to={{ pathname: search ? '/activity/timeline' : '/activity/home', search }} replace />
  );
}
