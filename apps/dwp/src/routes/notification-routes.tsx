import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthGuard } from '@dwp-frontend/shared-utils/auth/auth-guard';
import { PageCanvas } from '@dwp-frontend/design-system/components/page-canvas/page-canvas';
import { ErrorState } from '@dwp-frontend/design-system/components/states/state-panels';
import { Navigate, useParams, useRouteError } from 'react-router-dom';

import { NotificationLayout } from '../layouts/notification-layout';
import {
  AppRouteGuard,
  authenticationFallback,
  ProductRouteGuard,
  routeFallback,
  WorkspaceRouteGuard,
} from './route-support';

import type { RouteObject } from 'react-router-dom';

const NotificationsPage = lazy(() => import('../pages/notifications'));
const NotificationHome = lazy(() =>
  import('../features/notifications/notification-home').then((module) => ({
    default: module.NotificationHome,
  }))
);
const NotificationSettingsPage = lazy(() =>
  import('../features/notifications/notification-product-pages').then((module) => ({
    default: module.NotificationSettingsPage,
  }))
);
const NotificationAdminOverview = lazy(() =>
  import('../features/notifications/notification-product-pages').then((module) => ({
    default: module.NotificationAdminOverview,
  }))
);
const NotificationAdminContracts = lazy(() =>
  import('../features/notifications/notification-product-pages').then((module) => ({
    default: module.NotificationAdminContracts,
  }))
);
const NotificationAdminPolicies = lazy(() =>
  import('../features/notifications/notification-product-pages').then((module) => ({
    default: module.NotificationAdminPolicies,
  }))
);
const NotificationAdminOperations = lazy(() =>
  import('../features/notifications/notification-product-pages').then((module) => ({
    default: module.NotificationAdminOperations,
  }))
);
const NotificationAdminTemplates = lazy(() =>
  import('../features/notifications/notification-product-pages').then((module) => ({
    default: module.NotificationAdminTemplates,
  }))
);
const NotificationAdminSuppressions = lazy(() =>
  import('../features/notifications/notification-product-pages').then((module) => ({
    default: module.NotificationAdminSuppressions,
  }))
);

function NotificationPageRoute() {
  return (
    <Suspense fallback={routeFallback}>
      <NotificationsPage />
    </Suspense>
  );
}

function LegacyNotificationDetailRedirect() {
  const { notificationId } = useParams();
  return (
    <Navigate to={`/notifications/center/${encodeURIComponent(notificationId ?? '')}`} replace />
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
      { index: true, element: <Navigate to="home" replace /> },
      {
        path: 'home',
        element: (
          <Suspense fallback={routeFallback}>
            <NotificationHome />
          </Suspense>
        ),
        errorElement: <NotificationRouteError />,
      },
      {
        path: 'center',
        element: <NotificationPageRoute />,
        errorElement: <NotificationRouteError />,
      },
      {
        path: 'center/:notificationId',
        element: <NotificationPageRoute />,
        errorElement: <NotificationRouteError />,
      },
      {
        path: 'settings',
        element: (
          <Suspense fallback={routeFallback}>
            <NotificationSettingsPage />
          </Suspense>
        ),
      },
      {
        path: 'admin/overview',
        element: (
          <ProductRouteGuard resourceKey="ADMIN.NOTIFICATION_OPERATIONS">
            <Suspense fallback={routeFallback}>
              <NotificationAdminOverview />
            </Suspense>
          </ProductRouteGuard>
        ),
      },
      {
        path: 'admin/contracts',
        element: (
          <ProductRouteGuard resourceKey="ADMIN.NOTIFICATION_CONTRACT">
            <Suspense fallback={routeFallback}>
              <NotificationAdminContracts />
            </Suspense>
          </ProductRouteGuard>
        ),
      },
      {
        path: 'admin/policies',
        element: (
          <ProductRouteGuard resourceKey="ADMIN.NOTIFICATION_POLICY">
            <Suspense fallback={routeFallback}>
              <NotificationAdminPolicies />
            </Suspense>
          </ProductRouteGuard>
        ),
      },
      {
        path: 'admin/operations',
        element: (
          <ProductRouteGuard resourceKey="ADMIN.NOTIFICATION_OPERATIONS">
            <Suspense fallback={routeFallback}>
              <NotificationAdminOperations />
            </Suspense>
          </ProductRouteGuard>
        ),
      },
      {
        path: 'admin/templates',
        element: (
          <ProductRouteGuard resourceKey="ADMIN.NOTIFICATION_TEMPLATE">
            <Suspense fallback={routeFallback}>
              <NotificationAdminTemplates />
            </Suspense>
          </ProductRouteGuard>
        ),
      },
      {
        path: 'admin/suppressions',
        element: (
          <ProductRouteGuard resourceKey="ADMIN.NOTIFICATION_OPERATIONS">
            <Suspense fallback={routeFallback}>
              <NotificationAdminSuppressions />
            </Suspense>
          </ProductRouteGuard>
        ),
      },
      { path: ':notificationId', element: <LegacyNotificationDetailRedirect /> },
      { path: '*', element: <Navigate to="/notifications/home" replace /> },
    ],
  },
];
