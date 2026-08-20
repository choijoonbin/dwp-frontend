import { lazy, Suspense } from 'react';
import { Navigate, useLocation, type RouteObject } from 'react-router-dom';
import { AuthGuard } from '@dwp-frontend/shared-utils/auth/auth-guard';

import { DWAION_PRODUCT_MANIFEST } from '../features/dwaion/dwaion-navigation';
import { DwaionLayout } from '../layouts/dwaion-layout';
import {
  AppRouteGuard,
  ProductAnyRouteGuard,
  ProductRouteGuard,
  WorkspaceRouteGuard,
  authenticationFallback,
  routeFallback,
} from './route-support';

const DwaionWorkspacePage = lazy(() => import('../pages/dwaion'));
const DwaionHome = lazy(() =>
  import('../features/dwaion/dwaion-home').then((module) => ({ default: module.DwaionHome }))
);
const DwaionConversations = lazy(() =>
  import('../features/dwaion/dwaion-conversations').then((module) => ({
    default: module.DwaionConversations,
  }))
);
const DwaionAgents = lazy(() =>
  import('../features/dwaion/dwaion-agents').then((module) => ({ default: module.DwaionAgents }))
);
const DwaionActions = lazy(() =>
  import('../features/dwaion/dwaion-actions').then((module) => ({ default: module.DwaionActions }))
);
const DwaionAdminOverview = lazy(() =>
  import('../features/dwaion/dwaion-admin').then((module) => ({
    default: module.DwaionAdminOverview,
  }))
);
const DwaionAdminAgents = lazy(() =>
  import('../features/dwaion/dwaion-admin-agents').then((module) => ({
    default: module.DwaionAdminAgents,
  }))
);
const DwaionAdminSources = lazy(() =>
  import('../features/dwaion/dwaion-admin-sources').then((module) => ({
    default: module.DwaionAdminSources,
  }))
);
const DwaionAdminActions = lazy(() =>
  import('../features/dwaion/dwaion-admin-actions').then((module) => ({
    default: module.DwaionAdminActions,
  }))
);
const DwaionAdminSafety = lazy(() =>
  import('../features/dwaion/dwaion-admin-safety').then((module) => ({
    default: module.DwaionAdminSafety,
  }))
);
const DwaionAdminEvaluation = lazy(() =>
  import('../features/dwaion/dwaion-admin-evaluation').then((module) => ({
    default: module.DwaionAdminEvaluation,
  }))
);
const DwaionAdminAudit = lazy(() =>
  import('../features/dwaion/dwaion-admin-audit').then((module) => ({
    default: module.DwaionAdminAudit,
  }))
);

const ACTION_AUTHORITIES = [
  { resourceKey: 'APP.CALENDAR', permissionCode: 'CREATE' },
  { resourceKey: 'APP.MAIL', permissionCode: 'CREATE' },
  { resourceKey: 'APP.EMPLOYEE_SERVICES', permissionCode: 'VIEW' },
  { resourceKey: 'ACTION.APPROVAL_REQUEST', permissionCode: 'CREATE' },
] as const;

const authenticatedProduct = (
  <AuthGuard fallback={authenticationFallback}>
    <WorkspaceRouteGuard>
      <AppRouteGuard resourceKey={DWAION_PRODUCT_MANIFEST.appKey}>
        <DwaionLayout />
      </AppRouteGuard>
    </WorkspaceRouteGuard>
  </AuthGuard>
);

export const dwaionRoutes: RouteObject[] = [
  {
    path: 'dwaion',
    element: authenticatedProduct,
    children: [
      { index: true, element: <LegacyDwaionEntry /> },
      {
        path: 'home',
        element: (
          <Suspense fallback={routeFallback}>
            <DwaionHome />
          </Suspense>
        ),
      },
      {
        path: 'new',
        element: (
          <Suspense fallback={routeFallback}>
            <DwaionWorkspacePage />
          </Suspense>
        ),
      },
      {
        path: 'conversations',
        element: (
          <Suspense fallback={routeFallback}>
            <DwaionConversations />
          </Suspense>
        ),
      },
      {
        path: 'conversations/:conversationId',
        element: (
          <Suspense fallback={routeFallback}>
            <DwaionWorkspacePage />
          </Suspense>
        ),
      },
      {
        path: 'agents',
        element: (
          <Suspense fallback={routeFallback}>
            <DwaionAgents />
          </Suspense>
        ),
      },
      {
        path: 'actions',
        element: (
          <ProductAnyRouteGuard authorities={ACTION_AUTHORITIES}>
            <Suspense fallback={routeFallback}>
              <DwaionActions />
            </Suspense>
          </ProductAnyRouteGuard>
        ),
      },
      {
        path: 'admin/overview',
        element: (
          <ProductRouteGuard resourceKey="ADMIN.DWAION_OPERATIONS">
            <Suspense fallback={routeFallback}>
              <DwaionAdminOverview />
            </Suspense>
          </ProductRouteGuard>
        ),
      },
      {
        path: 'admin/agents',
        element: (
          <ProductRouteGuard resourceKey="ADMIN.DWAION_AGENTS">
            <Suspense fallback={routeFallback}>
              <DwaionAdminAgents />
            </Suspense>
          </ProductRouteGuard>
        ),
      },
      {
        path: 'admin/sources',
        element: (
          <ProductRouteGuard resourceKey="ADMIN.DWAION_SOURCES">
            <Suspense fallback={routeFallback}>
              <DwaionAdminSources />
            </Suspense>
          </ProductRouteGuard>
        ),
      },
      {
        path: 'admin/actions',
        element: (
          <ProductRouteGuard resourceKey="ADMIN.DWAION_ACTIONS">
            <Suspense fallback={routeFallback}>
              <DwaionAdminActions />
            </Suspense>
          </ProductRouteGuard>
        ),
      },
      {
        path: 'admin/safety',
        element: (
          <ProductRouteGuard resourceKey="ADMIN.DWAION_SAFETY">
            <Suspense fallback={routeFallback}>
              <DwaionAdminSafety />
            </Suspense>
          </ProductRouteGuard>
        ),
      },
      {
        path: 'admin/evaluation',
        element: (
          <ProductRouteGuard resourceKey="ADMIN.DWAION_EVALUATION">
            <Suspense fallback={routeFallback}>
              <DwaionAdminEvaluation />
            </Suspense>
          </ProductRouteGuard>
        ),
      },
      {
        path: 'admin/audit',
        element: (
          <ProductAnyRouteGuard
            authorities={[
              { resourceKey: 'ADMIN.DWAION_RETENTION', permissionCode: 'VIEW' },
              { resourceKey: 'ADMIN.DWAION_AUDIT', permissionCode: 'VIEW' },
            ]}
          >
            <Suspense fallback={routeFallback}>
              <DwaionAdminAudit />
            </Suspense>
          </ProductAnyRouteGuard>
        ),
      },
      { path: 'admin/retention', element: <Navigate to="/dwaion/admin/audit" replace /> },
      { path: '*', element: <Navigate to="/dwaion/home" replace /> },
    ],
  },
  {
    path: 'ask',
    element: (
      <AuthGuard fallback={authenticationFallback}>
        <WorkspaceRouteGuard>
          <AppRouteGuard resourceKey={DWAION_PRODUCT_MANIFEST.appKey}>
            <LegacyDwaionEntry />
          </AppRouteGuard>
        </WorkspaceRouteGuard>
      </AuthGuard>
    ),
  },
];

function LegacyDwaionEntry() {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const conversationId = params.get('conversation')?.trim();
  const hasNewConversationContext = Boolean(params.get('q')?.trim() || params.get('agent')?.trim());
  params.delete('conversation');

  if (conversationId) {
    return (
      <Navigate
        to={{
          pathname: `/dwaion/conversations/${encodeURIComponent(conversationId)}`,
          search: params.toString() ? `?${params.toString()}` : '',
        }}
        replace
      />
    );
  }
  return (
    <Navigate
      to={{ pathname: hasNewConversationContext ? '/dwaion/new' : '/dwaion/home', search }}
      replace
    />
  );
}
