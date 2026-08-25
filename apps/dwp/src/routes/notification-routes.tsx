import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthGuard } from '@dwp-frontend/shared-utils/auth/auth-guard';
import { PageCanvas } from '@dwp-frontend/design-system/components/page-canvas/page-canvas';
import { ErrorState } from '@dwp-frontend/design-system/components/states/state-panels';
import { Navigate, Outlet, useLocation, useParams, useRouteError } from 'react-router-dom';

import { NOTIFICATION_PRODUCT_MANIFEST } from '../features/notifications/notification-product-manifest';
import { NotificationLayout } from '../layouts/notification-layout';
import {
  AppRouteGuard,
  authenticationFallback,
  ProductRouteGuard,
  routeFallback,
  WorkspaceRouteGuard,
} from './route-support';
import { preserveProductRouteLocation } from './product-surface-canary-routes';
import { buildTwoSurfaceProductChildren } from './two-surface-product-routes';

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
  const location = useLocation();
  return (
    <Navigate
      to={preserveProductRouteLocation(
        `/notifications/center/${encodeURIComponent(notificationId ?? '')}`,
        location
      )}
      replace
    />
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
          <Outlet />
        </WorkspaceRouteGuard>
      </AuthGuard>
    ),
    children: [
      ...buildTwoSurfaceProductChildren({
        manifest: NOTIFICATION_PRODUCT_MANIFEST,
        workSurfaceId: 'notifications.work',
        managementSurfaceId: 'notifications.management',
        managementBasePath: '/notifications/admin',
        legacyPath: '/notifications/home',
        legacyShell: (
          <AppRouteGuard resourceKey="APP.NOTIFICATIONS">
            <NotificationLayout />
          </AppRouteGuard>
        ),
        areaKey: 'notifications',
        translationNamespace: 'notifications',
        renderPage: (route) => notificationRoutePage(route.pattern),
        renderLegacyPage: (route) => notificationLegacyRoutePage(route.pattern),
        renderErrorElement: (route) =>
          route.surfaceId === 'notifications.work' ? <NotificationRouteError /> : undefined,
        legacyUnknown: <Navigate to="/notifications/home" replace />,
      }),
      { path: ':notificationId', element: <LegacyNotificationDetailRedirect /> },
    ],
  },
];

function notificationRoutePage(pattern: string) {
  if (pattern === '/notifications/home') {
    return (
      <Suspense fallback={routeFallback}>
        <NotificationHome />
      </Suspense>
    );
  }
  if (pattern === '/notifications/settings') {
    return (
      <Suspense fallback={routeFallback}>
        <NotificationSettingsPage />
      </Suspense>
    );
  }
  if (pattern === '/notifications/admin/overview') {
    return page(<NotificationAdminOverview />);
  }
  if (pattern === '/notifications/admin/contracts') {
    return page(<NotificationAdminContracts />);
  }
  if (pattern === '/notifications/admin/policies') {
    return page(<NotificationAdminPolicies />);
  }
  if (pattern === '/notifications/admin/templates') {
    return page(<NotificationAdminTemplates />);
  }
  if (pattern === '/notifications/admin/operations') {
    return page(<NotificationAdminOperations />);
  }
  if (pattern === '/notifications/admin/suppressions') {
    return page(<NotificationAdminSuppressions />);
  }
  return <NotificationPageRoute />;
}

function notificationLegacyRoutePage(pattern: string) {
  const current = notificationRoutePage(pattern);
  const resourceKey = pattern.includes('/admin/contracts')
    ? 'ADMIN.NOTIFICATION_CONTRACT'
    : pattern.includes('/admin/policies')
      ? 'ADMIN.NOTIFICATION_POLICY'
      : pattern.includes('/admin/templates')
        ? 'ADMIN.NOTIFICATION_TEMPLATE'
        : pattern.includes('/admin/')
          ? 'ADMIN.NOTIFICATION_OPERATIONS'
          : undefined;
  return resourceKey ? (
    <ProductRouteGuard resourceKey={resourceKey}>{current}</ProductRouteGuard>
  ) : (
    current
  );
}

function page(children: React.ReactNode) {
  return <Suspense fallback={routeFallback}>{children}</Suspense>;
}
