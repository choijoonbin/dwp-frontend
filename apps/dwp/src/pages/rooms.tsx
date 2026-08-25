import { useLocation } from 'react-router-dom';
import { DwpDatePickerProvider } from '@dwp-frontend/design-system/enterprise/date-time/date-picker-provider';

import { RoomBookings } from '../features/rooms/room-bookings';
import { ProductSurfaceLocalNotFound } from '../components/product-surface-local-not-found';
import { RoomsAdminOperations } from '../features/rooms/rooms-admin-operations';
import { RoomsAdminPolicies } from '../features/rooms/rooms-admin-policies';
import { RoomsFind } from '../features/rooms/rooms-find';
import { WorkplaceAdminLocations } from '../features/rooms/workplace-admin-locations';
import { WorkplaceAdminGovernance } from '../features/rooms/workplace-admin-governance';
import { WorkplaceAdminOperations } from '../features/rooms/workplace-admin-operations';
import { WorkplaceAdminOverview } from '../features/rooms/workplace-admin-overview';
import { WorkplaceAdminPolicy } from '../features/rooms/workplace-admin-policy';
import { WorkplaceBookings } from '../features/rooms/workplace-bookings';
import { WorkplaceExplore } from '../features/rooms/workplace-explore';
import { WorkplaceHome } from '../features/rooms/workplace-home';
import { findRoomsNavigationItem } from '../features/rooms/rooms-navigation';
import { ProductAreaNavigationItemAccessGuard } from '../layouts/product-area-navigation-access-guard';

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
      <DwpDatePickerProvider>{content}</DwpDatePickerProvider>
    </ProductAreaNavigationItemAccessGuard>
  );
}
