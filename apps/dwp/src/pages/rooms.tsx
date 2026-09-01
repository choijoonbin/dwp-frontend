import { lazy, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import { DwpDatePickerProvider } from '@dwp-frontend/design-system/enterprise/date-time/date-picker-provider';

import { ProductSurfaceLocalNotFound } from '../components/product-surface-local-not-found';
import { findRoomsNavigationItem } from '../features/rooms/rooms-navigation';
import { ProductAreaNavigationItemAccessGuard } from '../layouts/product-area-navigation-access-guard';
import { RouteFallback } from '../routes/route-support';

const RoomBookings = lazy(() =>
  import('../features/rooms/room-bookings').then((module) => ({
    default: module.RoomBookings,
  }))
);
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
const RoomsFind = lazy(() =>
  import('../features/rooms/rooms-find').then((module) => ({
    default: module.RoomsFind,
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
  import('../features/rooms/workplace-admin-operations').then((module) => ({
    default: module.WorkplaceAdminOperations,
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
const WorkplaceBookings = lazy(() =>
  import('../features/rooms/workplace-bookings').then((module) => ({
    default: module.WorkplaceBookings,
  }))
);
const WorkplaceExplore = lazy(() =>
  import('../features/rooms/workplace-explore').then((module) => ({
    default: module.WorkplaceExplore,
  }))
);
const WorkplaceHome = lazy(() =>
  import('../features/rooms/workplace-home').then((module) => ({
    default: module.WorkplaceHome,
  }))
);

export default function RoomsPage() {
  const { pathname } = useLocation();
  const page = findRoomsNavigationItem(pathname);

  if (!page) return <ProductSurfaceLocalNotFound />;

  const content = {
    home: <WorkplaceHome />,
    explore: <WorkplaceExplore />,
    'find-rooms': <RoomsFind />,
    'my-bookings': <WorkplaceBookings />,
    'my-meetings': <RoomBookings />,
    'admin-overview': <WorkplaceAdminOverview />,
    'admin-operations': <WorkplaceAdminOperations />,
    'admin-governance': <WorkplaceAdminGovernance />,
    'admin-locations': <WorkplaceAdminLocations />,
    'admin-policy': <WorkplaceAdminPolicy />,
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
