import { lazy, Suspense } from 'react';
import { AuthGuard } from '@dwp-frontend/shared-utils/auth/auth-guard';
import { Outlet, type RouteObject } from 'react-router-dom';

import { APPROVAL_PRODUCT_MANIFEST } from '../features/approvals/approval-product-manifest';
import { ApprovalLayout } from '../layouts/approval-layout';
import { officialProductPageRelativePattern } from './official-product-page-route-contracts';
import {
  AppRouteGuard,
  authenticationFallback,
  routeFallback,
  WorkspaceRouteGuard,
} from './route-support';
import {
  ProductCanaryRoot,
  ProductCanaryFirstAllowedIndex,
  ProductCanaryIndexedSurfaceBoundary,
  ProductCanaryRouteBoundary,
  ProductCanarySurfaceBoundary,
  ProductCanaryUnknownRoute,
} from './product-surface-canary-routes';

const ApprovalsPage = lazy(() => import('../pages/approvals'));
const ApprovalSurfaceShell = lazy(() =>
  import('./approval-surface-shell').then((module) => ({
    default: module.ApprovalSurfaceShell,
  }))
);

const page = (children: React.ReactNode) => (
  <Suspense fallback={routeFallback}>{children}</Suspense>
);

const legacyShell = (
  <AppRouteGuard resourceKey="APP.APPROVALS">
    <ApprovalLayout />
  </AppRouteGuard>
);

const approvalManagementIndexCandidates = [
  {
    routeContractKey: 'route.approvals.admin.overview.page',
    path: '/approvals/admin/overview',
  },
  {
    routeContractKey: 'route.approvals.admin.workflows.page',
    path: '/approvals/admin/workflows',
  },
  {
    routeContractKey: 'route.approvals.admin.forms.page',
    path: '/approvals/admin/forms',
  },
  {
    routeContractKey: 'route.approvals.admin.policies.page',
    path: '/approvals/admin/policies',
  },
  {
    routeContractKey: 'route.approvals.admin.operations.page',
    path: '/approvals/admin/operations',
  },
  {
    routeContractKey: 'route.approvals.admin.signatures.page',
    path: '/approvals/admin/signatures',
  },
] as const;

function approvalPageRoute(
  surfaceId: 'approvals.work' | 'approvals.admin',
  routeContractKey: string,
  basePath: '/approvals' | '/approvals/admin'
): RouteObject {
  return {
    path: officialProductPageRelativePattern(routeContractKey, basePath),
    handle: { routeContractKey },
    element: (
      <ProductCanaryRouteBoundary
        productId="approvals"
        surfaceId={surfaceId}
        routeContractKey={routeContractKey}
        legacy={page(<ApprovalsPage />)}
      >
        {page(<ApprovalsPage governed />)}
      </ProductCanaryRouteBoundary>
    ),
  };
}

const approvalWorkRoutes = [
  'home',
  'inbox',
  'completed',
  'request-new',
  'request-drafts',
  'request-submitted',
  'request-needs-info',
  'request-archive',
  'delegations',
] as const;

const approvalManagementRoutes = [
  'overview',
  'workflows',
  'forms',
  'policies',
  'operations',
  'signatures',
] as const;

export const approvalsRoutes: RouteObject[] = [
  {
    path: 'approvals',
    element: (
      <AuthGuard fallback={authenticationFallback}>
        <WorkspaceRouteGuard>
          <Outlet />
        </WorkspaceRouteGuard>
      </AuthGuard>
    ),
    children: [
      {
        index: true,
        element: (
          <ProductCanaryRoot manifest={APPROVAL_PRODUCT_MANIFEST} legacyPath="/approvals/home" />
        ),
      },
      {
        path: 'admin',
        element: (
          <ProductCanaryIndexedSurfaceBoundary
            productId="approvals"
            surfaceId="approvals.admin"
            indexPath="/approvals/admin"
            legacy={legacyShell}
          >
            {page(<ApprovalSurfaceShell surfaceId="approvals.admin" />)}
          </ProductCanaryIndexedSurfaceBoundary>
        ),
        children: [
          {
            index: true,
            element: (
              <ProductCanaryFirstAllowedIndex
                productId="approvals"
                surfaceId="approvals.admin"
                candidates={approvalManagementIndexCandidates}
                legacy={page(<ApprovalsPage />)}
              />
            ),
          },
          ...approvalManagementRoutes.map((view) =>
            approvalPageRoute(
              'approvals.admin',
              `route.approvals.admin.${view}.page`,
              '/approvals/admin'
            )
          ),
          {
            path: '*',
            element: (
              <ProductCanaryUnknownRoute productId="approvals" legacy={page(<ApprovalsPage />)} />
            ),
          },
        ],
      },
      {
        element: (
          <ProductCanarySurfaceBoundary
            productId="approvals"
            surfaceId="approvals.work"
            legacy={legacyShell}
          >
            {page(<ApprovalSurfaceShell surfaceId="approvals.work" />)}
          </ProductCanarySurfaceBoundary>
        ),
        children: [
          ...approvalWorkRoutes.map((view) =>
            approvalPageRoute('approvals.work', `route.approvals.work.${view}.page`, '/approvals')
          ),
          {
            path: '*',
            element: (
              <ProductCanaryUnknownRoute productId="approvals" legacy={page(<ApprovalsPage />)} />
            ),
          },
        ],
      },
    ],
  },
];
