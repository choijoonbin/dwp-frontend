import { useTranslation } from 'react-i18next';
import { useToast } from '@dwp-frontend/shared-utils';
import { ActionButton } from '@dwp-frontend/design-system';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { WorkplaceReservationServices } from './workplace-reservation-services';
import { WorkplaceReservationVisits } from './workplace-reservation-visits';
import { WorkplaceReservationResourceCommands } from './workplace-reservation-resource-commands';

import type { WorkplaceUnifiedReservation } from './workplace-unified-reservations-model';

type WorkplaceReservationDetailTabContentProps = Readonly<{
  detailTab: string;
  reservation: WorkplaceUnifiedReservation;
  calendarPolicyUnavailable: boolean;
  conferenceUrl: string | null;
  onOpenServices: () => void;
}>;

function safeConferenceUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

export function WorkplaceReservationDetailTabContent({
  detailTab,
  reservation,
  calendarPolicyUnavailable,
  conferenceUrl,
  onOpenServices,
}: WorkplaceReservationDetailTabContentProps) {
  const { t } = useTranslation('rooms');
  const toast = useToast();
  const verifiedConferenceUrl = safeConferenceUrl(conferenceUrl);

  const copyConferenceLink = async () => {
    if (!verifiedConferenceUrl) return;
    try {
      await navigator.clipboard.writeText(verifiedConferenceUrl);
      toast.success(t('workplace.reservations.resourceCommands.teamsCopied'));
    } catch {
      toast.error(t('workplace.reservations.resourceCommands.teamsCopyError'));
    }
  };

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
          <Stack direction="row" gap={1} flexWrap="wrap">
            {verifiedConferenceUrl && (
              <ActionButton
                intent="secondary"
                size="small"
                onClick={() => void copyConferenceLink()}
              >
                {t('workplace.reservations.resourceCommands.copyTeamsLink')}
              </ActionButton>
            )}
            <ActionButton intent="secondary" size="small" onClick={onOpenServices}>
              {t('workplace.reservations.resourceCommands.openHelpRequest')}
            </ActionButton>
          </Stack>
          {reservation.authority === 'WORKPLACE' && (
            <WorkplaceReservationResourceCommands
              bookingId={reservation.authorityId}
              bookingVersion={reservation.version}
              sourceReady={reservation.sourceState === 'READY'}
            />
          )}
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
