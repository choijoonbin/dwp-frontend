import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { RefreshCw } from 'lucide-react';
import { ActionButton, InlineFeedback } from '@dwp-frontend/design-system';
import { useAuth } from '@dwp-frontend/shared-utils';
import { getVideoMeetingSchedule } from '@dwp-frontend/shared-utils/api/video-meeting-schedule-api';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export function MeetingInvitationDelivery({
  meetingId,
  meetingVersion,
  invitationRevision,
}: {
  meetingId: string;
  meetingVersion: number;
  invitationRevision: number;
}) {
  const { t } = useTranslation('meetings');
  const { user, isAuthenticated } = useAuth();
  const query = useQuery({
    queryKey: [
      'meetings',
      'invitation-delivery',
      user?.identityPlane,
      user?.tenantId,
      user?.userId,
      meetingId,
      meetingVersion,
      invitationRevision,
    ],
    queryFn: async ({ signal }) => {
      const result = await getVideoMeetingSchedule(meetingId, signal);
      if (
        result.meetingVersion !== meetingVersion ||
        result.invitationRevision !== invitationRevision
      ) {
        throw new Error('The meeting invitation changed; refresh its preparation.');
      }
      return result.deliveryState;
    },
    enabled: isAuthenticated && Boolean(user),
    staleTime: 0,
    gcTime: 0,
    retry: false,
    meta: { accessSensitive: true },
  });
  return (
    <Stack gap={1} data-testid="meeting-invitation-delivery" sx={{ py: 1.5 }}>
      <Typography component="h3" variant="subtitle2">
        {t('preparation.delivery.title')}
      </Typography>
      {query.isError ? (
        <InlineFeedback severity="warning">{t('preparation.delivery.error')}</InlineFeedback>
      ) : (
        <Typography variant="body2" role="status">
          {t(
            query.isFetching
              ? 'preparation.delivery.checking'
              : query.data
                ? `preparation.delivery.states.${query.data}`
                : 'preparation.delivery.checking'
          )}
        </Typography>
      )}
      <Typography variant="caption" color="text.secondary">
        {t('preparation.delivery.boundary', { revision: invitationRevision })}
      </Typography>
      <ActionButton
        intent="quiet"
        startIcon={<RefreshCw size={16} />}
        onClick={() => void query.refetch()}
        disabled={query.isFetching || !isAuthenticated}
        sx={{ minHeight: 44, alignSelf: 'flex-start' }}
      >
        {t('preparation.delivery.refresh')}
      </ActionButton>
    </Stack>
  );
}
