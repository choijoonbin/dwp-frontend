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
const WorkHome = lazy(() =>
  import('../features/work/work-home').then((module) => ({ default: module.WorkHome }))
);

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
      { index: true, element: <LegacyWorkEntry /> },
      {
        path: 'home',
        element: (
          <Suspense fallback={routeFallback}>
            <WorkHome />
          </Suspense>
        ),
      },
      {
        path: 'queue',
        element: (
          <Suspense fallback={routeFallback}>
            <WorkPage />
          </Suspense>
        ),
      },
      { path: '*', element: <Navigate to="home" replace /> },
    ],
  },
];

function LegacyWorkEntry() {
  const { search } = useLocation();
  return <Navigate to={{ pathname: search ? '/work/queue' : '/work/home', search }} replace />;
}
