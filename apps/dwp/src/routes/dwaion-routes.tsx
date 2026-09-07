import { lazy, Suspense } from 'react';
import { Navigate, Outlet, useLocation, type RouteObject } from 'react-router-dom';
import { AuthGuard } from '@dwp-frontend/shared-utils/auth/auth-guard';

import { DWAION_SURFACE_MANIFEST } from '../features/dwaion/dwaion-product-manifest';
import { DwaionLayout } from '../layouts/dwaion-layout';
import {
  ProductAnyRouteGuard,
  ProductRouteGuard,
  ProductWorkRouteGuard,
  WorkspaceRouteGuard,
  authenticationFallback,
  routeFallback,
} from './route-support';
import { preserveProductRouteLocation } from './product-surface-canary-routes';
import { buildTwoSurfaceProductChildren } from './two-surface-product-routes';

const DwaionWorkspacePage = lazy(() => import('../pages/dwaion'));
const DwaionHome = lazy(() =>
  import('../features/dwaion/dwaion-home').then((module) => ({ default: module.DwaionHome }))
);
const DwaionConversations = lazy(() =>
  import('../features/dwaion/dwaion-conversations').then((module) => ({
    default: module.DwaionConversations,
  }))
);
const DwaionActivity = lazy(() =>
  import('../features/dwaion/dwaion-activity').then((module) => ({
    default: module.DwaionActivity,
  }))
);
const DwaionProposals = lazy(() =>
  import('../features/dwaion/dwaion-proposals').then((module) => ({
    default: module.DwaionProposals,
  }))
);
const DwaionAgents = lazy(() =>
  import('../features/dwaion/dwaion-agents').then((module) => ({ default: module.DwaionAgents }))
);
const DwaionActions = lazy(() =>
  import('../features/dwaion/dwaion-actions').then((module) => ({ default: module.DwaionActions }))
);
const DwaionRoutines = lazy(() =>
  import('../features/dwaion/dwaion-routines').then((module) => ({
    default: module.DwaionRoutines,
  }))
);
const DwaionPersonalControls = lazy(() =>
  import('../features/dwaion/dwaion-personal-controls').then((module) => ({
    default: module.DwaionPersonalControls,
  }))
);
const DwaionArtifacts = lazy(() =>
  import('../features/dwaion/dwaion-artifacts').then((module) => ({
    default: module.DwaionArtifacts,
  }))
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
const DwaionAdminGates = lazy(() =>
  import('../features/dwaion/dwaion-admin-gates').then((module) => ({
    default: module.DwaionAdminGates,
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

const DWAION_ADMIN_AUTHORITIES = [
  { resourceKey: 'ADMIN.DWAION_OPERATIONS', permissionCode: 'VIEW' },
  { resourceKey: 'ADMIN.DWAION_AGENTS', permissionCode: 'VIEW' },
  { resourceKey: 'ADMIN.DWAION_SOURCES', permissionCode: 'VIEW' },
  { resourceKey: 'ADMIN.DWAION_ACTIONS', permissionCode: 'VIEW' },
  { resourceKey: 'ADMIN.DWAION_SAFETY', permissionCode: 'VIEW' },
  { resourceKey: 'ADMIN.DWAION_EVALUATION', permissionCode: 'VIEW' },
  { resourceKey: 'ADMIN.DWAION_GATES', permissionCode: 'VIEW' },
  { resourceKey: 'ADMIN.DWAION_RETENTION', permissionCode: 'VIEW' },
  { resourceKey: 'ADMIN.DWAION_AUDIT', permissionCode: 'VIEW' },
] as const;

const legacyShell = (
  <ProductWorkRouteGuard
    productId="dwaion"
    surfaceId="dwaion.work"
    resourceKey={DWAION_SURFACE_MANIFEST.appKey}
  >
    <DwaionLayout />
  </ProductWorkRouteGuard>
);

const managementLegacyShell = (
  <ProductAnyRouteGuard authorities={DWAION_ADMIN_AUTHORITIES}>
    <DwaionLayout />
  </ProductAnyRouteGuard>
);

export const dwaionRoutes: RouteObject[] = [
  {
    path: 'dwaion',
    element: (
      <AuthGuard fallback={authenticationFallback}>
        <WorkspaceRouteGuard>
          <Outlet />
        </WorkspaceRouteGuard>
      </AuthGuard>
    ),
    children: [
      ...buildTwoSurfaceProductChildren({
        manifest: DWAION_SURFACE_MANIFEST,
        workSurfaceId: 'dwaion.work',
        managementSurfaceId: 'dwaion.management',
        managementBasePath: '/dwaion/admin',
        legacyPath: '/dwaion/home',
        legacyShell,
        managementLegacyShell,
        areaKey: 'dwaion',
        translationNamespace: 'work',
        renderPage: (route) => dwaionRoutePage(route.pattern),
        renderLegacyPage: (route) => dwaionLegacyRoutePage(route.pattern),
        legacyUnknown: <Navigate to="/dwaion/home" replace />,
      }),
      { path: 'admin/retention', element: <LegacyDwaionRetentionRedirect /> },
    ],
  },
  {
    path: 'ask',
    element: (
      <AuthGuard fallback={authenticationFallback}>
        <WorkspaceRouteGuard>
          <ProductWorkRouteGuard
            productId="dwaion"
            surfaceId="dwaion.work"
            resourceKey={DWAION_SURFACE_MANIFEST.appKey}
          >
            <LegacyDwaionEntry />
          </ProductWorkRouteGuard>
        </WorkspaceRouteGuard>
      </AuthGuard>
    ),
  },
];

function LegacyDwaionEntry() {
  const { search, hash } = useLocation();
  const params = new URLSearchParams(search);
  const conversationId = params.get('conversation')?.trim();
  const hasLegacyQuestion = params.has('q');
  const hasNewConversationContext = hasLegacyQuestion || Boolean(params.get('agent')?.trim());
  params.delete('conversation');
  params.delete('q');
  const canonicalSearch = params.toString() ? `?${params.toString()}` : '';

  if (conversationId) {
    return (
      <Navigate
        to={{
          pathname: `/dwaion/conversations/${encodeURIComponent(conversationId)}`,
          search: canonicalSearch,
          hash,
        }}
        replace
      />
    );
  }
  return (
    <Navigate
      to={{
        pathname: hasNewConversationContext ? '/dwaion/new' : '/dwaion/home',
        search: canonicalSearch,
        hash,
      }}
      replace
    />
  );
}

function LegacyDwaionRetentionRedirect() {
  const location = useLocation();
  return <Navigate to={preserveProductRouteLocation('/dwaion/admin/audit', location)} replace />;
}

function page(children: React.ReactNode) {
  return <Suspense fallback={routeFallback}>{children}</Suspense>;
}

function dwaionRoutePage(pattern: string) {
  const component =
    pattern === '/dwaion/home' ? (
      <DwaionHome />
    ) : pattern === '/dwaion/activity' ? (
      <DwaionActivity />
    ) : pattern === '/dwaion/proposals' ? (
      <DwaionProposals />
    ) : pattern === '/dwaion/conversations' ? (
      <DwaionConversations />
    ) : pattern === '/dwaion/agents' ? (
      <DwaionAgents />
    ) : pattern === '/dwaion/actions' ? (
      <DwaionActions />
    ) : pattern === '/dwaion/routines' ? (
      <DwaionRoutines />
    ) : pattern === '/dwaion/personal-controls' ? (
      <DwaionPersonalControls />
    ) : pattern === '/dwaion/artifacts' ? (
      <DwaionArtifacts />
    ) : pattern === '/dwaion/admin/overview' ? (
      <DwaionAdminOverview />
    ) : pattern === '/dwaion/admin/agents' ? (
      <DwaionAdminAgents />
    ) : pattern === '/dwaion/admin/sources' ? (
      <DwaionAdminSources />
    ) : pattern === '/dwaion/admin/actions' ? (
      <DwaionAdminActions />
    ) : pattern === '/dwaion/admin/safety' ? (
      <DwaionAdminSafety />
    ) : pattern === '/dwaion/admin/evaluation' ? (
      <DwaionAdminEvaluation />
    ) : pattern === '/dwaion/admin/gates' ? (
      <DwaionAdminGates />
    ) : pattern === '/dwaion/admin/audit' ? (
      <DwaionAdminAudit />
    ) : (
      <DwaionWorkspacePage />
    );
  return page(component);
}

function dwaionLegacyRoutePage(pattern: string) {
  const current = dwaionRoutePage(pattern);
  if (pattern === '/dwaion/actions') {
    return (
      <ProductAnyRouteGuard authorities={ACTION_AUTHORITIES} localDeny>
        {current}
      </ProductAnyRouteGuard>
    );
  }
  if (pattern === '/dwaion/personal-controls') {
    return (
      <ProductAnyRouteGuard
        localDeny
        authorities={[
          { resourceKey: 'APP.DWAION_MEMORY', permissionCode: 'VIEW' },
          { resourceKey: 'APP.DWAION_PRIVACY', permissionCode: 'VIEW' },
        ]}
      >
        {current}
      </ProductAnyRouteGuard>
    );
  }
  const workResourceKey =
    pattern === '/dwaion/routines'
      ? 'APP.DWAION_ROUTINES'
      : pattern === '/dwaion/artifacts'
        ? 'APP.DWAION_ARTIFACTS'
        : undefined;
  if (workResourceKey) {
    return (
      <ProductRouteGuard resourceKey={workResourceKey} localDeny>
        {current}
      </ProductRouteGuard>
    );
  }
  const resourceKey =
    pattern === '/dwaion/admin/overview'
      ? 'ADMIN.DWAION_OPERATIONS'
      : pattern === '/dwaion/admin/agents'
        ? 'ADMIN.DWAION_AGENTS'
        : pattern === '/dwaion/admin/sources'
          ? 'ADMIN.DWAION_SOURCES'
          : pattern === '/dwaion/admin/actions'
            ? 'ADMIN.DWAION_ACTIONS'
            : pattern === '/dwaion/admin/safety'
              ? 'ADMIN.DWAION_SAFETY'
              : pattern === '/dwaion/admin/evaluation'
                ? 'ADMIN.DWAION_EVALUATION'
                : pattern === '/dwaion/admin/gates'
                  ? 'ADMIN.DWAION_GATES'
                  : undefined;
  if (resourceKey)
    return (
      <ProductRouteGuard resourceKey={resourceKey} localDeny>
        {current}
      </ProductRouteGuard>
    );
  if (pattern === '/dwaion/admin/audit') {
    return (
      <ProductAnyRouteGuard
        localDeny
        authorities={[
          { resourceKey: 'ADMIN.DWAION_RETENTION', permissionCode: 'VIEW' },
          { resourceKey: 'ADMIN.DWAION_AUDIT', permissionCode: 'VIEW' },
        ]}
      >
        {current}
      </ProductAnyRouteGuard>
    );
  }
  return current;
}
