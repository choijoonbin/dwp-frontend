import { Navigate, useLocation } from 'react-router-dom';
import { DwpDatePickerProvider } from '@dwp-frontend/design-system/enterprise/date-time/date-picker-provider';
import { usePermissions } from '@dwp-frontend/shared-utils';

import { RoomBookings } from '../features/rooms/room-bookings';
import { RoomsAdminOperations } from '../features/rooms/rooms-admin-operations';
import { RoomsAdminPolicies } from '../features/rooms/rooms-admin-policies';
import { RoomsAdminResources } from '../features/rooms/rooms-admin-resources';
import { RoomsFind } from '../features/rooms/rooms-find';
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
    find: <RoomsFind />,
    'my-bookings': <RoomBookings />,
    'admin-operations': <RoomsAdminOperations />,
    'admin-resources': <RoomsAdminResources />,
    'admin-policies': <RoomsAdminPolicies />,
  }[page.view];

  return <DwpDatePickerProvider>{content}</DwpDatePickerProvider>;
}
