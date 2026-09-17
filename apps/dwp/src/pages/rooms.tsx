import { lazy, Suspense } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { DwpDatePickerProvider } from '@dwp-frontend/design-system/enterprise/date-time/date-picker-provider';

import { ProductSurfaceLocalNotFound } from '../components/product-surface-local-not-found';
import { findRoomsNavigationItem } from '../features/rooms/rooms-navigation';
import { resolveLegacyWorkplacePlannerLocation } from '../features/rooms/workplace-planner-url-state';
import { ProductAreaNavigationItemAccessGuard } from '../layouts/product-area-navigation-access-guard';
import { RouteFallback } from '../routes/route-support';

const RoomsAdminOperations = lazy(() =>
  import('../features/rooms/rooms-admin-operations').then((module) => ({
    default: module.RoomsAdminOperations,
  }))
);
const RoomsAdminPolicies = lazy(() =>
  import('../features/rooms/rooms-admin-policies').then((module) => ({
    default: module.RoomsAdminPolicies,
  }))
);
const WorkplaceAdminLocations = lazy(() =>
  import('../features/rooms/workplace-admin-locations').then((module) => ({
    default: module.WorkplaceAdminLocations,
  }))
);
const WorkplaceAdminGovernance = lazy(() =>
  import('../features/rooms/workplace-admin-governance').then((module) => ({
    default: module.WorkplaceAdminGovernance,
  }))
);
const WorkplaceAdminOperations = lazy(() =>
  import('../features/rooms/workplace-admin-facilities').then((module) => ({
    default: module.WorkplaceAdminOperationsWorkspace,
  }))
);
const WorkplaceExceptionConsole = lazy(() =>
  import('../features/rooms/workplace-exception-console').then((module) => ({
    default: module.WorkplaceExceptionConsole,
  }))
);
const WorkplaceAdminOverview = lazy(() =>
  import('../features/rooms/workplace-admin-overview').then((module) => ({
    default: module.WorkplaceAdminOverview,
  }))
);
const WorkplaceAdminPolicy = lazy(() =>
  import('../features/rooms/workplace-admin-policy').then((module) => ({
    default: module.WorkplaceAdminPolicy,
  }))
);
const WorkplaceUnifiedReservations = lazy(() =>
  import('../features/rooms/workplace-unified-reservations').then((module) => ({
    default: module.WorkplaceUnifiedReservations,
  }))
);
const WorkplaceServiceOrders = lazy(() => import('../features/rooms/workplace-service-orders'));
const WorkplaceWayfindingPage = lazy(() =>
  import('../features/rooms/workplace-navigation-pages').then((module) => ({
    default: module.WorkplaceWayfindingPage,
  }))
);
const WorkplaceDeviceOperationsPage = lazy(() =>
  import('../features/rooms/workplace-navigation-pages').then((module) => ({
    default: module.WorkplaceDeviceOperationsPage,
  }))
);
const WorkplaceSpacePlanning = lazy(() => import('../features/rooms/workplace-space-planning'));
const WorkplaceServiceProviderAdminPage = lazy(
  () => import('../features/rooms/workplace-service-provider-admin')
);
const WorkplaceAssistantUser = lazy(() =>
  import('../features/rooms/workplace-assistant-user').then((module) => ({
    default: module.WorkplaceAssistantUser,
  }))
);
const WorkplaceAssistantAdmin = lazy(() =>
  import('../features/rooms/workplace-assistant-admin').then((module) => ({
    default: module.WorkplaceAssistantAdmin,
  }))
);
const WorkplaceSafetyUser = lazy(() =>
  import('../features/rooms/workplace-safety-user').then((module) => ({
    default: module.WorkplaceSafetyUser,
  }))
);
const WorkplaceSafetyAdmin = lazy(() =>
  import('../features/rooms/workplace-safety-admin').then((module) => ({
    default: module.WorkplaceSafetyAdmin,
  }))
);
const WorkplaceServiceFulfillment = lazy(
  () => import('../features/rooms/workplace-service-fulfillment')
);
const WorkplaceServiceCatalogAdmin = lazy(
  () => import('../features/rooms/workplace-service-catalog-admin')
);
const WorkplaceVisitAdmin = lazy(() =>
  import('../features/rooms/workplace-visit-admin').then((module) => ({
    default: module.WorkplaceVisitAdmin,
  }))
);
const WorkplaceVisitPolicyAdmin = lazy(() =>
  import('../features/rooms/workplace-visit-management').then((module) => ({
    default: module.WorkplaceVisitPolicyAdmin,
  }))
);
const WorkplaceVisitAccessZoneAdmin = lazy(() =>
  import('../features/rooms/workplace-visit-management').then((module) => ({
    default: module.WorkplaceVisitAccessZoneAdmin,
  }))
);
const WorkplaceVisitProviderAdmin = lazy(() =>
  import('../features/rooms/workplace-visit-management').then((module) => ({
    default: module.WorkplaceVisitProviderAdmin,
  }))
);
const WorkplaceKioskDeviceAdmin = lazy(() =>
  import('../features/rooms/workplace-visit-management').then((module) => ({
    default: module.WorkplaceKioskDeviceAdmin,
  }))
);
const WorkplacePlanner = lazy(() =>
  import('../features/rooms/workplace-planner').then((module) => ({
    default: module.WorkplacePlanner,
  }))
);
const WorkplaceExplore = lazy(() =>
  import('../features/rooms/workplace-explore').then((module) => ({
    default: module.WorkplaceExplore,
  }))
);
const WorkplaceHome = lazy(() =>
  import('../features/rooms/workplace-member-workspace').then((module) => ({
    default: module.WorkplaceMemberWorkspace,
  }))
);

export default function RoomsPage() {
  const location = useLocation();
  const { pathname } = location;
  const page = findRoomsNavigationItem(pathname);

  if (!page) return <ProductSurfaceLocalNotFound />;

  const plannerMode = new URLSearchParams(location.search).get('mode')?.toUpperCase() === 'PLANNER';
  const content = {
    home: <WorkplaceHome />,
    find: plannerMode ? (
      <Navigate
        replace
        to={resolveLegacyWorkplacePlannerLocation(location.search, location.hash)}
      />
    ) : (
      <WorkplaceExplore />
    ),
    wayfinding: <WorkplaceWayfindingPage />,
    planner: <WorkplacePlanner />,
    assistant: <WorkplaceAssistantUser />,
    reservations: <WorkplaceUnifiedReservations />,
    'service-orders': <WorkplaceServiceOrders />,
    safety: <WorkplaceSafetyUser />,
    'admin-overview': <WorkplaceAdminOverview />,
    'admin-safety': <WorkplaceSafetyAdmin />,
    'admin-operations': <WorkplaceAdminOperations />,
    'admin-exceptions': <WorkplaceExceptionConsole />,
    'admin-devices': <WorkplaceDeviceOperationsPage />,
    'admin-space-planning': <WorkplaceSpacePlanning />,
    'admin-assistant-governance': <WorkplaceAssistantAdmin />,
    'admin-governance': <WorkplaceAdminGovernance />,
    'admin-locations': <WorkplaceAdminLocations />,
    'admin-policy': <WorkplaceAdminPolicy />,
    'admin-service-fulfillment': <WorkplaceServiceFulfillment />,
    'admin-service-catalog': <WorkplaceServiceCatalogAdmin />,
    'admin-service-providers': <WorkplaceServiceProviderAdminPage />,
    'admin-visits': <WorkplaceVisitAdmin />,
    'admin-visit-policies': <WorkplaceVisitPolicyAdmin />,
    'admin-access-zones': <WorkplaceVisitAccessZoneAdmin />,
    'admin-visit-providers': <WorkplaceVisitProviderAdmin />,
    'admin-kiosk-devices': <WorkplaceKioskDeviceAdmin />,
    'admin-room-operations': <RoomsAdminOperations />,
    'admin-room-policy': <RoomsAdminPolicies />,
  }[page.view];

  return (
    <ProductAreaNavigationItemAccessGuard item={page}>
      <DwpDatePickerProvider>
        <Suspense fallback={<RouteFallback />}>{content}</Suspense>
      </DwpDatePickerProvider>
    </ProductAreaNavigationItemAccessGuard>
  );
}
