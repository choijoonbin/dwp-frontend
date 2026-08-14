import { lazy, Suspense } from 'react';
import { AuthGuard } from '@dwp-frontend/shared-utils/auth/auth-guard';
import { Navigate, type RouteObject } from 'react-router-dom';

import { ApprovalLayout } from '../layouts/approval-layout';
import {
  AppRouteGuard,
  authenticationFallback,
  routeFallback,
  WorkspaceRouteGuard,
} from './route-support';

const ApprovalsPage = lazy(() => import('../pages/approvals'));

export const approvalsRoutes: RouteObject[] = [
  {
    path: 'approvals',
    element: (
      <AuthGuard fallback={authenticationFallback}>
        <WorkspaceRouteGuard>
          <AppRouteGuard resourceKey="APP.APPROVALS">
            <ApprovalLayout />
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
            <ApprovalsPage />
          </Suspense>
        ),
      },
    ],
  },
];
