import { lazy, Suspense } from 'react';
import { Navigate, useLocation, type RouteObject } from 'react-router-dom';
import { AuthGuard } from '@dwp-frontend/shared-utils/auth/auth-guard';

import { WorkLayout } from '../layouts/work-layout';
import {
  AppRouteGuard,
  authenticationFallback,
  routeFallback,
  WorkspaceRouteGuard,
} from './route-support';

const WorkPage = lazy(() => import('../pages/work'));

export const workRoutes: RouteObject[] = [
  {
    path: 'work',
    element: (
      <AuthGuard fallback={authenticationFallback}>
        <WorkspaceRouteGuard>
          <AppRouteGuard resourceKey="APP.WORK">
            <WorkLayout />
          </AppRouteGuard>
        </WorkspaceRouteGuard>
      </AuthGuard>
    ),
    children: [
      { index: true, element: <WorkQueueRedirect /> },
      { path: 'home', element: <WorkQueueRedirect /> },
      {
        path: 'queue',
        element: (
          <Suspense fallback={routeFallback}>
            <WorkPage />
          </Suspense>
        ),
      },
      { path: '*', element: <WorkQueueRedirect /> },
    ],
  },
];

function WorkQueueRedirect() {
  const { search } = useLocation();
  return <Navigate to={{ pathname: '/work/queue', search }} replace />;
}
