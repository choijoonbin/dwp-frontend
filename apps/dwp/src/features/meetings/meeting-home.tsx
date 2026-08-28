import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarPlus2, LogIn, RefreshCw, Video } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  ActionButton,
  ErrorState,
  GuidedEmptyState,
  LoadingState,
  PageCanvas,
} from '@dwp-frontend/design-system';
import { useToast } from '@dwp-frontend/shared-utils';
import {
  createInstantVideoMeeting,
  getVideoMeetingHome,
  scheduleVideoMeeting,
  type ScheduleVideoMeetingInput,
} from '@dwp-frontend/shared-utils/api/video-meeting-api';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';

import {
  MeetingActionPanel,
  MeetingMetric,
  MeetingPageHeading,
  MeetingSectionHeading,
  MeetingSummaryRow,
} from './meeting-components';
import { MeetingScheduleDialog } from './meeting-schedule-dialog';

export function MeetingHome() {
  const { t } = useTranslation('meetings');
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const query = useQuery({
    queryKey: ['meetings', 'home', timeZone],
    queryFn: () => getVideoMeetingHome(timeZone),
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
  });
  const instantMutation = useMutation({
    mutationFn: () =>
      createInstantVideoMeeting({
        title: t('home.instant.defaultTitle'),
        agenda: null,
        participantUserIds: [],
        accessScope: 'INTERNAL',
        waitingRoomEnabled: true,
        defaultMicrophoneEnabled: false,
        defaultCameraEnabled: false,
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess: (meeting) => navigate(`/meetings/room/${encodeURIComponent(meeting.meetingId)}`),
    onError: () => toast.error(t('errors.operation')),
  });
  const scheduleMutation = useMutation({
    mutationFn: (input: ScheduleVideoMeetingInput) => scheduleVideoMeeting(input),
    onSuccess: async () => {
      setScheduleOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['meetings'] });
      toast.success(t('schedule.success'));
    },
    onError: () => toast.error(t('schedule.error')),
  });

  if (query.isLoading) {
    return (
      <PageCanvas>
        <LoadingState label={t('home.loading')} variant="skeleton" skeletonRows={5} />
      </PageCanvas>
    );
  }

  if (query.isError || !query.data) {
    return (
      <PageCanvas>
        <ErrorState
          title={t('errors.loadTitle')}
          description={t('errors.loadDescription')}
          retryLabel={t('actions.retry')}
          retrying={query.isFetching}
          onRetry={() => query.refetch()}
        />
      </PageCanvas>
    );
  }

  const data = query.data;
  const focusMeeting = data.activeMeeting ?? data.nextMeeting;

  return (
    <PageCanvas>
      <MeetingPageHeading
        eyebrow={t('home.eyebrow')}
        title={t('home.title')}
        description={t('home.description')}
        actions={
          <ActionButton
            intent="quiet"
            startIcon={<RefreshCw size={16} />}
            onClick={() => query.refetch()}
          >
            {t('actions.refresh')}
          </ActionButton>
        }
      />

      {!data.capabilities.available && (
        <Alert severity="warning" sx={{ mb: 2.5 }}>
          {t('home.serviceUnavailable', {
            reason: data.capabilities.unavailableReason ?? data.capabilities.provider,
          })}
        </Alert>
      )}

      <Box
        component="section"
        aria-label={t('home.eyebrow')}
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          bgcolor: 'background.paper',
          overflow: 'hidden',
        }}
      >
        <MeetingActionPanel
          icon={Video}
          title={t('home.instant.title')}
          description={t('home.instant.description')}
          action={t('home.instant.action')}
          emphasis
          busy={instantMutation.isPending}
          disabled={!data.capabilities.available}
          onAction={() => instantMutation.mutate()}
        />
        <MeetingActionPanel
          icon={CalendarPlus2}
          title={t('home.schedule.title')}
          description={t('home.schedule.description')}
          action={t('home.schedule.action')}
          disabled={!data.capabilities.available}
          onAction={() => setScheduleOpen(true)}
        />
        <MeetingActionPanel
          icon={LogIn}
          title={t('home.join.title')}
          description={t('home.join.description')}
          action={t('home.join.action')}
          disabled={!data.capabilities.available}
          onAction={() => navigate('/meetings/join')}
        />
      </Box>

      <Box
        sx={{
          mt: 3,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.35fr) minmax(360px, 0.65fr)' },
          gap: 3,
          alignItems: 'start',
        }}
      >
        <Box component="section" aria-labelledby="meeting-focus-title" sx={{ minWidth: 0 }}>
          <MeetingSectionHeading
            id="meeting-focus-title"
            title={t(data.activeMeeting ? 'home.focus.live' : 'home.focus.next')}
          />
          <Box
            sx={{
              minHeight: 176,
              border: 1,
              borderColor: focusMeeting?.lifecycleState === 'LIVE' ? 'success.main' : 'divider',
              borderRadius: 1,
              bgcolor: 'background.paper',
              overflow: 'hidden',
              display: 'grid',
              alignItems: 'center',
            }}
          >
            {focusMeeting ? (
              <MeetingSummaryRow
                meeting={focusMeeting}
                onOpen={() =>
                  navigate(`/meetings/room/${encodeURIComponent(focusMeeting.meetingId)}`)
                }
              />
            ) : (
              <GuidedEmptyState
                kind="empty"
                title={t('home.focus.empty')}
                description={t('home.focus.emptyDescription')}
                size="compact"
              />
            )}
          </Box>
        </Box>

        <Box component="section" aria-labelledby="meeting-pulse-title" sx={{ minWidth: 0 }}>
          <MeetingSectionHeading id="meeting-pulse-title" title={t('home.metrics.title')} />
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              bgcolor: 'background.paper',
              overflow: 'hidden',
              '& > *': { borderBottom: 1, borderColor: 'divider' },
              '& > *:nth-of-type(odd)': { borderRight: 1, borderColor: 'divider' },
              '& > *:nth-last-of-type(-n+2)': { borderBottom: 0 },
            }}
          >
            <MeetingMetric
              label={t('home.metrics.today')}
              value={data.metrics.meetingsToday}
              tone="#2563EB"
            />
            <MeetingMetric
              label={t('home.metrics.minutes')}
              value={t('units.minutes', { count: data.metrics.meetingMinutesToday })}
              tone="#0F766E"
            />
            <MeetingMetric
              label={t('home.metrics.waiting')}
              value={data.metrics.waitingForApproval}
              tone="#B45309"
            />
            <MeetingMetric
              label={t('home.metrics.joinTime')}
              value={
                data.metrics.averageJoinSeconds == null
                  ? t('home.metrics.notMeasured')
                  : t('units.seconds', { count: data.metrics.averageJoinSeconds })
              }
              tone="#7C3AED"
            />
          </Box>
        </Box>
      </Box>

      <Box
        sx={{
          mt: 3,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1.3fr) minmax(360px, 0.7fr)' },
          gap: 3,
          alignItems: 'start',
        }}
      >
        <Box component="section" aria-labelledby="meeting-today-title" sx={{ minWidth: 0 }}>
          <MeetingSectionHeading
            id="meeting-today-title"
            title={t('home.today.title')}
            description={t('home.today.description')}
            action={
              <ActionButton intent="quiet" size="small" onClick={() => navigate('/meetings/mine')}>
                {t('actions.viewAll')}
              </ActionButton>
            }
          />
          <Box
            sx={{
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              bgcolor: 'background.paper',
              overflow: 'hidden',
            }}
          >
            {data.today.length ? (
              data.today.map((meeting) => (
                <MeetingSummaryRow
                  key={meeting.meetingId}
                  meeting={meeting}
                  onOpen={() => navigate(`/meetings/room/${encodeURIComponent(meeting.meetingId)}`)}
                />
              ))
            ) : (
              <GuidedEmptyState
                kind="empty"
                title={t('home.today.empty')}
                description={t('home.today.emptyDescription')}
                size="compact"
              />
            )}
          </Box>
        </Box>

        <Box component="section" aria-labelledby="meeting-recent-title" sx={{ minWidth: 0 }}>
          <MeetingSectionHeading
            id="meeting-recent-title"
            title={t('home.recent.title')}
            description={t('home.recent.description')}
            action={
              <ActionButton
                intent="quiet"
                size="small"
                onClick={() => navigate('/meetings/history')}
              >
                {t('actions.viewAll')}
              </ActionButton>
            }
          />
          <Box
            sx={{
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              bgcolor: 'background.paper',
              overflow: 'hidden',
            }}
          >
            {data.recent.length ? (
              data.recent
                .slice(0, 4)
                .map((meeting) => (
                  <MeetingSummaryRow
                    key={meeting.meetingId}
                    meeting={meeting}
                    history={meeting}
                    onOpen={() =>
                      navigate(`/meetings/history?meeting=${encodeURIComponent(meeting.meetingId)}`)
                    }
                  />
                ))
            ) : (
              <GuidedEmptyState
                kind="empty"
                title={t('home.recent.empty')}
                description={t('home.recent.emptyDescription')}
                size="compact"
              />
            )}
          </Box>
        </Box>
      </Box>

      <MeetingScheduleDialog
        open={scheduleOpen}
        busy={scheduleMutation.isPending}
        onClose={() => setScheduleOpen(false)}
        onSubmit={(input) => scheduleMutation.mutate(input)}
      />
    </PageCanvas>
  );
}
