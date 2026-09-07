import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { resolveSystemTimeZone } from '@dwp-frontend/shared-i18n';
import { ErrorState, LoadingState, PageCanvas } from '@dwp-frontend/design-system';
import { useAuth, useToast } from '@dwp-frontend/shared-utils';
import { readRegionalPreference } from '@dwp-frontend/shared-utils/regional-preference';
import {
  createInstantVideoMeeting,
  getVideoMeetingHome,
} from '@dwp-frontend/shared-utils/api/video-meeting-api';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';

import { MeetingHomeHeader } from './meeting-home-header';
import { MeetingHomeFocus } from './meeting-home-focus';
import { MeetingHomeTimeline } from './meeting-home-timeline';
import { MeetingHomeResults } from './meeting-home-results';
import { MeetingHomeResources } from './meeting-home-resources';
import { MeetingHomeWorkQueue } from './meeting-home-work-queue';
import { homeFocusMeeting, homeUnavailableReason } from './meeting-home-model';

export function MeetingHome() {
  const { user, isAuthenticated } = useAuth();
  const scope = JSON.stringify([
    isAuthenticated,
    user?.identityPlane,
    user?.tenantId,
    user?.userId,
  ]);
  return (
    <MeetingHomeContent
      key={scope}
      scope={scope}
      actorId={user?.userId ?? 0}
      authenticated={isAuthenticated && Boolean(user)}
    />
  );
}

function MeetingHomeContent({
  scope,
  actorId,
  authenticated,
}: {
  scope: string;
  actorId: number;
  authenticated: boolean;
}) {
  const { t } = useTranslation('meetings');
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const mounted = useRef(false);
  const [joinCode, setJoinCode] = useState('');
  const [clock, setClock] = useState(() => Date.now());
  const [regionalPreference, setRegionalPreference] = useState(readRegionalPreference);
  const timeZone =
    regionalPreference.timeZone === 'system'
      ? resolveSystemTimeZone('UTC')
      : regionalPreference.timeZone;
  useEffect(() => {
    const update = () => setRegionalPreference(readRegionalPreference());
    window.addEventListener('dwp:regional-preference-change', update);
    window.addEventListener('storage', update);
    return () => {
      window.removeEventListener('dwp:regional-preference-change', update);
      window.removeEventListener('storage', update);
    };
  }, []);
  const query = useQuery({
    queryKey: ['meetings', 'home', 'snapshot', scope, timeZone],
    queryFn: () => getVideoMeetingHome(timeZone),
    enabled: authenticated,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: false,
    gcTime: 0,
    meta: { accessSensitive: true },
  });
  useEffect(() => {
    mounted.current = true;
    const timer = window.setInterval(() => setClock(Date.now()), 30_000);
    return () => {
      mounted.current = false;
      window.clearInterval(timer);
    };
  }, []);
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
    onSuccess: (meeting) => {
      if (mounted.current) navigate('/meetings/room/' + encodeURIComponent(meeting.meetingId));
    },
    onError: () => {
      if (mounted.current) toast.error(t('errors.operation'));
    },
  });

  if (!authenticated || query.isLoading)
    return (
      <PageCanvas mode="workspace" topInset="compact">
        <LoadingState label={t('home.loading')} variant="skeleton" skeletonRows={5} />
      </PageCanvas>
    );
  // A failed authorization revalidation must not leave an authorized-looking snapshot.
  if (query.isError || !query.data)
    return (
      <PageCanvas mode="workspace" topInset="compact">
        <Box data-testid="meeting-home-stale">
          <ErrorState
            title={t('errors.loadTitle')}
            description={t('errors.loadDescription')}
            retryLabel={t('actions.retry')}
            retrying={query.isFetching}
            onRetry={() => query.refetch()}
          />
        </Box>
      </PageCanvas>
    );
  const data = query.data;
  const displayTimeZone =
    regionalPreference.timeZone === 'system' ? data.timeZone || timeZone : timeZone;
  const available = data.capabilities.available;
  const serverTime = Date.parse(data.serverNow);
  const now = Number.isFinite(serverTime)
    ? serverTime + Math.max(0, clock - query.dataUpdatedAt)
    : clock;
  const disabled = !available || instantMutation.isPending;

  return (
    <PageCanvas mode="workspace" topInset="compact">
      <MeetingHomeHeader
        timeZone={displayTimeZone}
        now={now}
        updatedAt={query.dataUpdatedAt}
        refreshing={query.isFetching}
        disabled={disabled}
        scheduleDisabled={
          instantMutation.isPending ||
          homeUnavailableReason(data.capabilities.unavailableReason) === 'policy'
        }
        starting={instantMutation.isPending}
        joinCode={joinCode}
        meetingCount={data.today.length}
        live={Boolean(data.activeMeeting)}
        onCodeChange={setJoinCode}
        onRefresh={() => {
          void queryClient.invalidateQueries({ queryKey: ['meetings', 'home', 'results'] });
          void query.refetch();
        }}
        onSchedule={() => navigate('/meetings/mine?view=schedule')}
        onStart={() => instantMutation.mutate()}
      />
      {!available && (
        <Alert severity="warning" sx={{ mb: 2, overflowWrap: 'anywhere' }}>
          {t('home.serviceUnavailable', {
            reason: t(
              'home.unavailableReasons.' +
                homeUnavailableReason(data.capabilities.unavailableReason)
            ),
          })}
        </Alert>
      )}
      <MeetingHomeFocus
        meeting={homeFocusMeeting(data.activeMeeting, data.nextMeeting, data.today)}
        now={now}
        timeZone={displayTimeZone}
        disabled={disabled}
        onStart={() => instantMutation.mutate()}
      />
      <Box
        data-testid="meeting-day-lists"
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 2fr) minmax(280px, 1fr)' },
          gap: 3,
          alignItems: 'start',
          mt: 3,
        }}
      >
        <MeetingHomeTimeline
          meetings={data.today}
          timeZone={displayTimeZone}
          disabled={!available}
        />
        <Box data-testid="meeting-home-queue" sx={{ minWidth: 0 }}>
          <MeetingHomeResults recent={data.recent} section="queue" timeZone={displayTimeZone} />
          <MeetingHomeWorkQueue scope={scope} actorId={actorId} timeZone={displayTimeZone} />
        </Box>
      </Box>
      <Box
        data-testid="meeting-home-continuation"
        sx={{
          mt: 3,
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0,1fr)', lg: 'minmax(0,7fr) minmax(0,5fr)' },
          gap: 3,
          alignItems: 'start',
        }}
      >
        <Box data-testid="meeting-home-recent" sx={{ minWidth: 0 }}>
          <MeetingHomeResults recent={data.recent} section="recent" timeZone={displayTimeZone} />
        </Box>
        <MeetingHomeResources />
      </Box>
    </PageCanvas>
  );
}
