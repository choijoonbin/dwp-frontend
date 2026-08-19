import { Navigate, useLocation } from 'react-router-dom';
import { DwpDatePickerProvider } from '@dwp-frontend/design-system/enterprise/date-time/date-picker-provider';
import { usePermissions } from '@dwp-frontend/shared-utils';

import { RoomBookings } from '../features/rooms/room-bookings';
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
import {
  findFirstAccessibleRoomsPath,
  findRoomsNavigationItem,
} from '../features/rooms/rooms-navigation';

export default function RoomsPage() {
  const { pathname } = useLocation();
  const { hasPermission, isLoaded } = usePermissions();
  const page = findRoomsNavigationItem(pathname);
  const accessiblePath = findFirstAccessibleRoomsPath(hasPermission);

  if (!isLoaded) return null;
  if (!page) return <Navigate to={accessiblePath} replace />;
  if (
    page.requiredResourceKey &&
    !hasPermission(page.requiredResourceKey, page.requiredPermissionCode)
  ) {
    return <Navigate to={accessiblePath} replace />;
  }

  const content = {
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

  return <DwpDatePickerProvider>{content}</DwpDatePickerProvider>;
}
