import { lazy, Suspense } from 'react';
import { AuthGuard } from '@dwp-frontend/shared-utils/auth/auth-guard';
import { Navigate, type RouteObject } from 'react-router-dom';

import { CommunicationsLayout } from '../layouts/communications-layout';
import {
  AppRouteGuard,
  authenticationFallback,
  ProductRouteGuard,
  routeFallback,
  WorkspaceRouteGuard,
} from './route-support';

const CommunicationsPage = lazy(() => import('../pages/communications'));
const CommunicationsHome = lazy(() =>
  import('../features/communications/communications-home').then((module) => ({
    default: module.CommunicationsHome,
  }))
);
const CommunicationsAdminContent = lazy(() =>
  import('../features/communications/communications-admin-content').then((module) => ({
    default: module.CommunicationsAdminContent,
  }))
);

const COMMUNICATIONS_SUPPORT_SCOPES = [
  'TENANT_CONFIGURATION_READ',
  'TENANT_CONFIGURATION_WRITE',
] as const;

export const communicationsRoutes: RouteObject[] = [
  {
    path: 'communications',
    element: (
      <AuthGuard fallback={authenticationFallback}>
        <WorkspaceRouteGuard>
          <AppRouteGuard
            resourceKey="APP.COMMUNICATIONS"
            requiredAnySupportScopes={COMMUNICATIONS_SUPPORT_SCOPES}
          >
            <CommunicationsLayout />
          </AppRouteGuard>
        </WorkspaceRouteGuard>
      </AuthGuard>
    ),
    children: [
      { index: true, element: <Navigate to="home" replace /> },
      {
        path: 'home',
        element: (
          <AppRouteGuard resourceKey="APP.COMMUNICATIONS">
            <Suspense fallback={routeFallback}>
              <CommunicationsHome />
            </Suspense>
          </AppRouteGuard>
        ),
      },
      {
        path: 'admin/content',
        element: (
          <ProductRouteGuard
            resourceKey="ADMIN.COMMUNICATIONS"
            requiredAnySupportScopes={COMMUNICATIONS_SUPPORT_SCOPES}
          >
            <Suspense fallback={routeFallback}>
              <CommunicationsAdminContent />
            </Suspense>
          </ProductRouteGuard>
        ),
      },
      {
        path: ':view',
        element: (
          <AppRouteGuard resourceKey="APP.COMMUNICATIONS">
            <Suspense fallback={routeFallback}>
              <CommunicationsPage />
            </Suspense>
          </AppRouteGuard>
        ),
      },
      {
        path: ':view/:storyId',
        element: (
          <AppRouteGuard resourceKey="APP.COMMUNICATIONS">
            <Suspense fallback={routeFallback}>
              <CommunicationsPage />
            </Suspense>
          </AppRouteGuard>
        ),
      },
    ],
  },
];
