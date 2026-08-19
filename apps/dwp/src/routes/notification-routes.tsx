import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthGuard } from '@dwp-frontend/shared-utils/auth/auth-guard';
import { PageCanvas } from '@dwp-frontend/design-system/components/page-canvas/page-canvas';
import { ErrorState } from '@dwp-frontend/design-system/components/states/state-panels';
import { Navigate, useRouteError } from 'react-router-dom';

import { NotificationLayout } from '../layouts/notification-layout';
import {
  AppRouteGuard,
  authenticationFallback,
  routeFallback,
  WorkspaceRouteGuard,
} from './route-support';

import type { RouteObject } from 'react-router-dom';

const NotificationsPage = lazy(() => import('../pages/notifications'));

function NotificationPageRoute() {
  return (
    <Suspense fallback={routeFallback}>
      <NotificationsPage />
    </Suspense>
  );
}

function NotificationRouteError() {
  const { t } = useTranslation('notifications');
  const error = useRouteError();
  const correlationId =
    error instanceof Error && 'correlationId' in error
      ? String((error as Error & { correlationId?: unknown }).correlationId ?? '')
      : '';

  return (
    <PageCanvas mode="workspace">
      <ErrorState
        title={t('states.routeErrorTitle')}
        description={t('states.routeErrorDescription')}
        retryLabel={t('actions.retry')}
        onRetry={() => window.location.reload()}
      />
      {correlationId && (
        <span data-notification-error-correlation hidden>
          {correlationId}
        </span>
      )}
    </PageCanvas>
  );
}

export const notificationRoutes: RouteObject[] = [
  {
    path: 'notifications',
    element: (
      <AuthGuard fallback={authenticationFallback}>
        <WorkspaceRouteGuard>
          <AppRouteGuard resourceKey="APP.NOTIFICATIONS">
            <NotificationLayout />
          </AppRouteGuard>
        </WorkspaceRouteGuard>
      </AuthGuard>
    ),
    children: [
      {
        index: true,
        element: <NotificationPageRoute />,
        errorElement: <NotificationRouteError />,
      },
      {
        path: ':notificationId',
        element: <NotificationPageRoute />,
        errorElement: <NotificationRouteError />,
      },
      { path: '*', element: <Navigate to="/notifications" replace /> },
    ],
  },
];
