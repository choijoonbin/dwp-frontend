import { Navigate, useLocation } from 'react-router-dom';
import { DwpDatePickerProvider } from '@dwp-frontend/design-system/enterprise/date-time/date-picker-provider';
import { usePermissions } from '@dwp-frontend/shared-utils';

import { RoomBookings } from '../features/rooms/room-bookings';
import { RoomsAdminOperations } from '../features/rooms/rooms-admin-operations';
import { RoomsAdminPolicies } from '../features/rooms/rooms-admin-policies';
import { RoomsFind } from '../features/rooms/rooms-find';
import { WorkplaceAdminLocations } from '../features/rooms/workplace-admin-locations';
import { WorkplaceAdminOverview } from '../features/rooms/workplace-admin-overview';
import { WorkplaceAdminPolicy } from '../features/rooms/workplace-admin-policy';
import { WorkplaceBookings } from '../features/rooms/workplace-bookings';
import { WorkplaceExplore } from '../features/rooms/workplace-explore';
import { findRoomsNavigationItem, ROOMS_DEFAULT_PATH } from '../features/rooms/rooms-navigation';

export default function RoomsPage() {
  const { pathname } = useLocation();
  const { hasPermission } = usePermissions();
  const page = findRoomsNavigationItem(pathname);

  if (!page) return <Navigate to={ROOMS_DEFAULT_PATH} replace />;
  if (
    page.requiredResourceKey &&
    !hasPermission(page.requiredResourceKey, page.requiredPermissionCode)
  ) {
    return <Navigate to={ROOMS_DEFAULT_PATH} replace />;
  }

  const content = {
    explore: <WorkplaceExplore />,
    'find-rooms': <RoomsFind />,
    'my-bookings': <WorkplaceBookings />,
    'my-meetings': <RoomBookings />,
    'admin-overview': <WorkplaceAdminOverview />,
    'admin-locations': <WorkplaceAdminLocations />,
    'admin-policy': <WorkplaceAdminPolicy />,
    'admin-room-operations': <RoomsAdminOperations />,
    'admin-room-policy': <RoomsAdminPolicies />,
  }[page.view];

  return <DwpDatePickerProvider>{content}</DwpDatePickerProvider>;
}
