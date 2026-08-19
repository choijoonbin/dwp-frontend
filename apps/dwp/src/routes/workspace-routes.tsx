import { lazy, Suspense } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AuthGuard } from '@dwp-frontend/shared-utils/auth/auth-guard';
import type { RouteObject } from 'react-router-dom';

import { HomeRouteFallback } from '../components/home-loading-skeleton';
import { AppLayout } from '../layouts/app-layout';
import { HomeLayout } from '../layouts/home-layout';
import {
  AppRouteGuard,
  authenticationFallback,
  routeFallback,
  WorkspaceRouteGuard,
} from './route-support';

const HomePage = lazy(() => import('../pages/home'));
const WorkPage = lazy(() => import('../pages/work'));
const DwaionPage = lazy(() => import('../pages/dwaion'));
const ActivityPage = lazy(() => import('../pages/activity'));
const AppsPage = lazy(() => import('../pages/apps'));

export const workspaceRoutes: RouteObject[] = [
  {
    element: (
      <AuthGuard fallback={authenticationFallback}>
        <WorkspaceRouteGuard>
          <HomeLayout />
        </WorkspaceRouteGuard>
      </AuthGuard>
    ),
    children: [
      {
        index: true,
        element: (
          <Suspense fallback={<HomeRouteFallback />}>
            <HomePage />
          </Suspense>
        ),
      },
    ],
  },
  {
    element: (
      <AuthGuard fallback={authenticationFallback}>
        <WorkspaceRouteGuard>
          <AppLayout />
        </WorkspaceRouteGuard>
      </AuthGuard>
    ),
    children: [
      {
        path: 'work',
        element: (
          <AppRouteGuard resourceKey="APP.WORK">
            <Suspense fallback={routeFallback}>
              <WorkPage />
            </Suspense>
          </AppRouteGuard>
        ),
      },
      {
        path: 'dwaion',
        element: (
          <AppRouteGuard resourceKey="APP.ASK">
            <Suspense fallback={routeFallback}>
              <DwaionPage />
            </Suspense>
          </AppRouteGuard>
        ),
      },
      {
        path: 'ask',
        element: (
          <AppRouteGuard resourceKey="APP.ASK">
            <LegacyDwaionRedirect />
          </AppRouteGuard>
        ),
      },
      {
        path: 'activity',
        element: (
          <AppRouteGuard resourceKey="APP.ACTIVITY">
            <Suspense fallback={routeFallback}>
              <ActivityPage />
            </Suspense>
          </AppRouteGuard>
        ),
      },
      {
        path: 'apps',
        element: (
          <Suspense fallback={routeFallback}>
            <AppsPage />
          </Suspense>
        ),
      },
    ],
  },
];

function LegacyDwaionRedirect() {
  const location = useLocation();
  return <Navigate to={{ pathname: '/dwaion', search: location.search }} replace />;
}
