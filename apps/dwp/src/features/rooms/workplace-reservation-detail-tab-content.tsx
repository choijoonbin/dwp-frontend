import { useTranslation } from 'react-i18next';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { WorkplaceReservationServices } from './workplace-reservation-services';
import { WorkplaceReservationVisits } from './workplace-reservation-visits';

import type { WorkplaceUnifiedReservation } from './workplace-unified-reservations-model';

type WorkplaceReservationDetailTabContentProps = Readonly<{
  detailTab: string;
  reservation: WorkplaceUnifiedReservation;
  calendarPolicyUnavailable: boolean;
}>;

export function WorkplaceReservationDetailTabContent({
  detailTab,
  reservation,
  calendarPolicyUnavailable,
}: WorkplaceReservationDetailTabContentProps) {
  const { t } = useTranslation('rooms');

  return (
    <>
      {detailTab === 'overview' ? (
        <Stack spacing={1.25}>
          {reservation.organizerName && (
            <Typography variant="body2">
              {t('workplace.reservations.detail.organizer', {
                value: reservation.organizerName,
              })}
            </Typography>
          )}
          <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
            {t('workplace.reservations.detail.reference', {
              value: reservation.authorityId,
            })}
          </Typography>
        </Stack>
      ) : detailTab === 'services' ? (
        <WorkplaceReservationServices
          reservationId={reservation.authorityId}
          reservationAuthority={reservation.authority}
          reservationVersion={reservation.version}
          attendeeCount={reservation.attendeeCount}
          sourceReady={reservation.sourceState === 'READY'}
        />
      ) : detailTab === 'visitors' || detailTab === 'access' ? (
        <WorkplaceReservationVisits
          reservation={reservation}
          sourceReady={reservation.sourceState === 'READY'}
          focus={detailTab}
        />
      ) : (
        <Typography variant="body2" color="text.secondary">
          {t('workplace.reservations.detail.extensionUnavailable')}
        </Typography>
      )}
      {reservation.sourceState === 'STALE' && (
        <Typography variant="body2" color="warning.main" sx={{ mt: 2 }}>
          {t('workplace.reservations.detail.staleWriteBlocked')}
        </Typography>
      )}
      {calendarPolicyUnavailable && (
        <Typography variant="body2" color="warning.main" sx={{ mt: 2 }}>
          {t('workplace.reservations.detail.calendarPolicyUnavailable')}
        </Typography>
      )}
    </>
  );
}
