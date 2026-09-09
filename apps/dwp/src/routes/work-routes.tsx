import { lazy, Suspense } from 'react';
import { Navigate, useLocation, type RouteObject } from 'react-router-dom';
import { AuthGuard } from '@dwp-frontend/shared-utils/auth/auth-guard';

import { WORK_HUB_VIEWS } from '../features/work-hub/work-hub-view-contract';
import { useWorkHubOperationOwner } from '../features/work-hub/use-work-hub-operation-owner';
import {
  authenticationFallback,
  ProductRouteGuard,
  routeFallback,
  WorkspaceRouteGuard,
} from './route-support';

const WorkPage = lazy(() => import('../pages/work'));
const WorkLayout = lazy(() =>
  import('../layouts/work-layout').then(({ WorkLayout }) => ({ default: WorkLayout }))
);
const DwaionWorkCalendarContext = lazy(
  () => import('../components/dwaion-assistant/dwaion-work-calendar-context')
);

export const workRoutes: RouteObject[] = [
  {
    path: 'work',
    element: (
      <AuthGuard fallback={authenticationFallback}>
        <WorkspaceRouteGuard>
          <ProductRouteGuard resourceKey="APP.WORK" permissionCode="VIEW">
            <Suspense fallback={routeFallback}>
              <WorkLayout />
            </Suspense>
          </ProductRouteGuard>
        </WorkspaceRouteGuard>
      </AuthGuard>
    ),
    children: [
      { index: true, element: <WorkQueueRedirect /> },
      { path: 'home', element: <WorkQueueRedirect /> },
      {
        path: 'calendar',
        element: (
          <Suspense fallback={routeFallback}>
            <DwaionWorkCalendarContext />
          </Suspense>
        ),
      },
      ...WORK_HUB_VIEWS.map(({ view }) => ({
        path: view,
        element: (
          <Suspense fallback={routeFallback}>
            <WorkPageOwnerBoundary />
          </Suspense>
        ),
      })),
      { path: '*', element: <WorkQueueRedirect /> },
    ],
  },
];

function WorkQueueRedirect() {
  const { search } = useLocation();
  return <Navigate to={{ pathname: '/work/queue', search }} replace />;
}

/** Discard every Work draft, selection and in-flight observer when the signed-in owner changes. */
function WorkPageOwnerBoundary() {
  const owner = useWorkHubOperationOwner();
  const { pathname } = useLocation();
  return <WorkPage key={`${owner ?? 'unauthenticated'}:${pathname}`} />;
}
