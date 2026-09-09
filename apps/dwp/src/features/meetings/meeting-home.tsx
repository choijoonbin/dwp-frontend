import { useCallback, useEffect, useRef, useState } from 'react';
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
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { ActionButton } from '@dwp-frontend/design-system';
import { ListTodo } from 'lucide-react';

import { MeetingHomeHeader } from './meeting-home-header';
import { MeetingHomeFocus } from './meeting-home-focus';
import { MeetingHomeTimeline } from './meeting-home-timeline';
import { MeetingHomeResults } from './meeting-home-results';
import { MeetingHomeResources } from './meeting-home-resources';
import { MeetingHomeWorkQueue } from './meeting-home-work-queue';
import { MeetingHomeCandidateQueue } from './meeting-home-candidate-queue';
import { MeetingHomeManualFollowUps } from './meeting-home-manual-follow-ups';
import {
  initialMeetingHomeQueueState,
  type MeetingHomeQueueState,
} from './meeting-home-queue-state';
import { useMeetingHomeManualOutcomes } from './use-meeting-home-manual-outcomes';
import { homeFocusMeeting, homeUnavailableReason } from './meeting-home-model';
import { meetingHomeInset } from './meeting-home-presentation';

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
  const [queueState, setQueueState] = useState<
    Record<'recap' | 'work' | 'candidate', MeetingHomeQueueState>
  >({
    recap: initialMeetingHomeQueueState,
    work: initialMeetingHomeQueueState,
    candidate: initialMeetingHomeQueueState,
  });
  const updateQueueState = useCallback(
    (source: keyof typeof queueState, state: MeetingHomeQueueState) => {
      setQueueState((current) => {
        const previous = current[source];
        return previous.status === state.status && previous.count === state.count
          ? current
          : { ...current, [source]: state };
      });
    },
    []
  );
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
  const manualOutcomes = useMeetingHomeManualOutcomes({
    recent: query.data?.recent ?? [],
    scope,
    actorId,
    enabled: authenticated && Boolean(query.data),
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
  const manualFollowUpCount = manualOutcomes.entries
    .filter((entry) => entry.followUp)
    .slice(0, 1).length;
  const authoritativeQueueCount = Object.values(queueState).reduce(
    (total, state) => total + state.count,
    0
  );
  const queueCount = manualFollowUpCount + authoritativeQueueCount;
  const queueLoading =
    manualOutcomes.loading || Object.values(queueState).some((state) => state.status === 'loading');
  const queueError = Object.values(queueState).some((state) => state.status === 'error');

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
          void queryClient.invalidateQueries({ queryKey: ['meetings', 'home'] });
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
          gridTemplateColumns: {
            xs: 'minmax(0, 1fr)',
            lg: 'minmax(0, 2fr) minmax(280px, 1fr)',
            xl: 'minmax(0, 7fr) minmax(400px, 5fr)',
          },
          gap: { xs: 2.5, lg: 3 },
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
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            gap={1}
            sx={{ mb: 0.5 }}
          >
            <Stack direction="row" alignItems="center" gap={0.75}>
              <ListTodo size={17} aria-hidden="true" />
              <Typography component="h2" variant="subtitle1" sx={{ fontWeight: 'fontWeightBold' }}>
                {t('home.design.queueTitle')}
              </Typography>
              <Chip
                size="small"
                color={queueCount > 0 ? 'primary' : 'default'}
                label={t('home.results.count', { count: queueCount })}
                aria-label={t('home.manual.queueCount', { count: queueCount })}
              />
            </Stack>
            <ActionButton
              intent="quiet"
              size="small"
              onClick={() =>
                navigate(
                  authoritativeQueueCount === 0 && manualFollowUpCount > 0
                    ? '/meetings/history'
                    : '/meetings/follow-ups'
                )
              }
            >
              {t('actions.viewAll')}
            </ActionButton>
          </Stack>
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 1.5 }}>
            {t(
              authoritativeQueueCount === 0 && manualFollowUpCount > 0
                ? 'home.manual.queueDescription'
                : 'home.design.queueDescription'
            )}
          </Typography>
          <Stack gap={1.25} data-testid="meeting-home-queue-content">
            <MeetingHomeResults
              embedded
              recent={data.recent}
              section="queue"
              timeZone={displayTimeZone}
              onStateChange={(state) => updateQueueState('recap', state)}
            />
            <MeetingHomeManualFollowUps outcomes={manualOutcomes.entries} />
            <MeetingHomeWorkQueue
              embedded
              scope={scope}
              actorId={actorId}
              timeZone={displayTimeZone}
              onStateChange={(state) => updateQueueState('work', state)}
            />
            <MeetingHomeCandidateQueue
              recent={data.recent}
              scope={scope}
              enabled={authenticated}
              onStateChange={(state) => updateQueueState('candidate', state)}
            />
            {!queueLoading && !queueError && queueCount === 0 && (
              <Box
                role="status"
                data-testid="meeting-home-queue-empty"
                sx={(theme) => ({
                  ...meetingHomeInset(theme),
                  px: 1.5,
                  py: 1.25,
                  minHeight: 64,
                  display: 'flex',
                  alignItems: 'center',
                })}
              >
                <Typography variant="body2" color="text.secondary">
                  {t('home.manual.queueEmpty')}
                </Typography>
              </Box>
            )}
          </Stack>
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
          <MeetingHomeResults
            recent={data.recent}
            section="recent"
            timeZone={displayTimeZone}
            manualOutcomes={manualOutcomes.entries}
          />
        </Box>
        <MeetingHomeResources />
      </Box>
    </PageCanvas>
  );
}
