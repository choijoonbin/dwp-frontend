import { useTranslation } from 'react-i18next';

import { RoomsPermissionNotice } from './rooms-ui';

export function WorkplaceReservationPermissionNotices({
  loaded,
  canViewWorkplace,
  canUpdateWorkplaceBooking,
  canViewRooms,
  canUpdateRoomBooking,
}: {
  loaded: boolean;
  canViewWorkplace: boolean;
  canUpdateWorkplaceBooking: boolean;
  canViewRooms: boolean;
  canUpdateRoomBooking: boolean;
}) {
  const { t } = useTranslation('rooms');
  if (!loaded) return null;
  return (
    <>
      {canViewWorkplace && !canUpdateWorkplaceBooking && (
        <RoomsPermissionNotice>{t('permissions.workplaceUpdateReadOnly')}</RoomsPermissionNotice>
      )}
      {canViewRooms && !canUpdateRoomBooking && (
        <RoomsPermissionNotice>{t('permissions.roomUpdateReadOnly')}</RoomsPermissionNotice>
      )}
    </>
  );
}
