import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { LocalUserChoices } from '@livekit/components-react';
import { DisconnectReason } from 'livekit-client';
import { CalendarClock, ShieldCheck, UsersRound, Video } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ActionButton, ErrorState, LoadingState, PageCanvas } from '@dwp-frontend/design-system';
import { useAuth } from '@dwp-frontend/shared-utils';
import {
  confirmVideoMeetingConnected,
  endVideoMeeting,
  getVideoMeeting,
  issueVideoMeetingToken,
  leaveVideoMeeting,
  requestVideoMeetingJoin,
  startVideoMeeting,
  type VideoMeetingJoinCredential,
  type VideoMeetingSummary,
} from '@dwp-frontend/shared-utils/api/video-meeting-api';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { formatMeetingDateTime, MeetingPageHeading, MeetingStatusChip } from './meeting-components';
import { createMeetingConnectionSynchronizer } from './meeting-connection-sync';
import { MeetingDepartureState, type MeetingDepartureKind } from './meeting-departure-state';
import { createMeetingDepartureSynchronizer } from './meeting-departure-sync';
import { createMeetingEndSynchronizer } from './meeting-end-sync';
import { MeetingLobbyPanel } from './meeting-lobby-panel';
import { MeetingPreJoin } from './meeting-prejoin';

const LazyLiveVideoMeetingRoom = lazy(() => import('./live-video-meeting-room'));

export function MeetingRoomExperience({ meetingId }: { meetingId: string }) {
  const { t, i18n } = useTranslation('meetings');
  const auth = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const joinRequestId = searchParams.get('joinRequest');
  const [preJoin, setPreJoin] = useState(false);
  const [choices, setChoices] = useState<LocalUserChoices | null>(null);
  const [credential, setCredential] = useState<VideoMeetingJoinCredential | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);
  const [departure, setDeparture] = useState<MeetingDepartureKind | null>(null);
  const departureEffectGeneration = useRef({ value: 0 });
  const lastDepartureRequest = useRef<Promise<void> | null>(null);
  const queryKey = ['meetings', meetingId, 'detail'] as const;
  const query = useQuery({
    queryKey,
    queryFn: () => getVideoMeeting(meetingId),
    staleTime: 15_000,
    refetchInterval: credential ? 4_000 : 5_000,
    retry: 1,
  });
  const connectionSynchronizer = useMemo(
    () => createMeetingConnectionSynchronizer(() => confirmVideoMeetingConnected(meetingId)),
    [meetingId]
  );
  const departureSynchronizer = useMemo(
    () =>
      createMeetingDepartureSynchronizer((keepalive) =>
        leaveVideoMeeting(meetingId, { keepalive })
      ),
    [meetingId]
  );
  const endSynchronizer = useMemo(
    () =>
      createMeetingEndSynchronizer(
        (sessionId) => connectionSynchronizer.settle(sessionId),
        (expectedVersion) => endVideoMeeting(meetingId, expectedVersion)
      ),
    [connectionSynchronizer, meetingId]
  );
  const admissionMutation = useMutation({
    mutationFn: () =>
      requestVideoMeetingJoin(meetingId, {
        displayName: auth.user?.displayName ?? '',
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess: async () => {
      setLocalError(null);
      await queryClient.invalidateQueries({ queryKey });
    },
    onError: () => setLocalError(t('join.requestError')),
  });
  const joinMutation = useMutation({
    mutationFn: async ({
      meeting,
      nextChoices,
    }: {
      meeting: VideoMeetingSummary;
      nextChoices: LocalUserChoices;
    }) => {
      await lastDepartureRequest.current?.catch(() => undefined);
      let activeMeeting = meeting;
      if (meeting.canHost && meeting.lifecycleState !== 'LIVE') {
        activeMeeting = await startVideoMeeting(meeting.meetingId, meeting.version);
      }
      const nextCredential = await issueVideoMeetingToken(meeting.meetingId, {
        joinRequestId,
      });
      return { meeting: activeMeeting, choices: nextChoices, credential: nextCredential };
    },
    onSuccess: ({ meeting, choices: nextChoices, credential: nextCredential }) => {
      departureSynchronizer.reset(nextCredential.sessionId);
      connectionSynchronizer.start(nextCredential.sessionId);
      lastDepartureRequest.current = null;
      queryClient.setQueryData(queryKey, meeting);
      setChoices(nextChoices);
      setCredential(nextCredential);
      setDeparture(null);
      setLocalError(null);
    },
    onError: () => setLocalError(t('errors.operation')),
  });
  const endMutation = useMutation({
    mutationFn: (input: { sessionId: string; expectedVersion: number }) =>
      endSynchronizer.synchronize(input),
    onSuccess: (meeting, input) => {
      connectionSynchronizer.end(input.sessionId);
      queryClient.setQueryData(queryKey, meeting);
      setCredential(null);
      setChoices(null);
      setEnded(true);
      void queryClient.invalidateQueries({ queryKey: ['meetings'] });
    },
    onError: () => setLocalError(t('errors.operation')),
  });

  useEffect(() => {
    const generationTracker = departureEffectGeneration.current;
    const generation = ++generationTracker.value;
    if (!credential) return undefined;
    const synchronizeDeparture = () => {
      void connectionSynchronizer
        .settle(credential.sessionId)
        .catch(() => undefined)
        .then(() => departureSynchronizer.synchronize(credential.sessionId, { keepalive: true }))
        .catch(() => undefined);
    };
    window.addEventListener('pagehide', synchronizeDeparture);
    return () => {
      window.removeEventListener('pagehide', synchronizeDeparture);
      globalThis.queueMicrotask(() => {
        if (generationTracker.value === generation) synchronizeDeparture();
      });
    };
  }, [connectionSynchronizer, credential, departureSynchronizer]);

  if (query.isLoading) {
    return (
      <PageCanvas mode="focus">
        <LoadingState label={t('room.loading')} />
      </PageCanvas>
    );
  }
  if (!query.data) {
    return (
      <PageCanvas mode="focus">
        <ErrorState
          title={t('errors.loadTitle')}
          description={t('errors.loadDescription')}
          retryLabel={t('actions.retry')}
          onRetry={() => query.refetch()}
        />
      </PageCanvas>
    );
  }

  const meeting = query.data;
  const authenticatedUserId = Number(auth.user?.userId);
  const currentParticipant = Number.isFinite(authenticatedUserId)
    ? meeting.participants.find((participant) => participant.userId === authenticatedUserId)
    : undefined;
  const admissionState = currentParticipant?.attendanceState;
  const requiresAdmissionRequest =
    !meeting.canHost && (admissionState === undefined || admissionState === 'INVITED');
  const waitingForAdmission = !meeting.canHost && admissionState === 'REQUESTED';
  const admissionDenied = !meeting.canHost && admissionState === 'DENIED';
  const waitingForHost = !meeting.canHost && meeting.lifecycleState !== 'LIVE';
  if (ended || meeting.lifecycleState === 'ENDED') {
    return (
      <PageCanvas mode="focus">
        <Box
          role="status"
          sx={{
            minHeight: 420,
            display: 'grid',
            placeItems: 'center',
            textAlign: 'center',
          }}
        >
          <Stack alignItems="center" gap={2} sx={{ maxWidth: 520 }}>
            <Box
              sx={{
                width: 52,
                height: 52,
                display: 'grid',
                placeItems: 'center',
                borderRadius: 1,
                bgcolor: 'action.hover',
              }}
            >
              <Video size={25} />
            </Box>
            <Typography component="h1" variant="h4" fontWeight={800}>
              {t('room.endedTitle')}
            </Typography>
            <Typography color="text.secondary">{t('room.endedDescription')}</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
              <ActionButton
                intent="primary"
                onClick={() =>
                  navigate(`/meetings/history?meeting=${encodeURIComponent(meeting.meetingId)}`)
                }
              >
                {t('history.openRecap')}
              </ActionButton>
              <ActionButton intent="secondary" onClick={() => navigate('/meetings/home')}>
                {t('room.returnHome')}
              </ActionButton>
            </Stack>
          </Stack>
        </Box>
      </PageCanvas>
    );
  }

  if (meeting.lifecycleState === 'CANCELLED') {
    return (
      <PageCanvas mode="focus">
        <Box
          role="status"
          sx={{ minHeight: 420, display: 'grid', placeItems: 'center', textAlign: 'center' }}
        >
          <Stack alignItems="center" gap={2} sx={{ maxWidth: 520 }}>
            <Typography component="h1" variant="h4" fontWeight={800}>
              {t('room.cancelledTitle')}
            </Typography>
            <Typography color="text.secondary">{t('room.cancelledDescription')}</Typography>
            <ActionButton intent="primary" onClick={() => navigate('/meetings/mine')}>
              {t('room.returnToMeetings')}
            </ActionButton>
          </Stack>
        </Box>
      </PageCanvas>
    );
  }

  if (departure) {
    return (
      <PageCanvas mode="focus">
        <MeetingDepartureState
          kind={departure}
          busy={joinMutation.isPending}
          error={localError}
          onRejoin={() => {
            if (!choices) {
              setDeparture(null);
              setPreJoin(true);
              return;
            }
            joinMutation.mutate({ meeting, nextChoices: choices });
          }}
          onHome={() => navigate('/meetings/home')}
          onHistory={() => navigate('/meetings/history')}
        />
      </PageCanvas>
    );
  }

  if (credential && choices) {
    return (
      <Suspense fallback={<LoadingState label={t('room.connecting')} />}>
        <LazyLiveVideoMeetingRoom
          meeting={meeting}
          credential={credential}
          choices={choices}
          ending={endMutation.isPending}
          operationError={localError ?? (query.isError ? t('errors.lifecycleSync') : null)}
          onConnected={() => {
            void connectionSynchronizer
              .synchronize(credential.sessionId)
              .then(() => setLocalError(null))
              .catch(() => setLocalError(t('errors.attendanceSync')));
          }}
          onLeave={(reason) => {
            const sessionId = credential.sessionId;
            const connectionRequest = connectionSynchronizer.settle(sessionId);
            connectionSynchronizer.end(sessionId);
            const departureRequest = connectionRequest
              .catch(() => undefined)
              .then(() => departureSynchronizer.synchronize(sessionId, { keepalive: false }));
            lastDepartureRequest.current = departureRequest;
            void departureRequest
              .then(() => queryClient.invalidateQueries({ queryKey }))
              .catch(() => setLocalError(t('errors.leaveSync')));
            setCredential(null);
            if (
              reason === DisconnectReason.ROOM_DELETED ||
              reason === DisconnectReason.ROOM_CLOSED
            ) {
              setEnded(true);
              return;
            }
            setDeparture(reason === DisconnectReason.CLIENT_INITIATED ? 'LEFT' : 'DISCONNECTED');
          }}
          onEndForEveryone={() =>
            endMutation.mutate({
              sessionId: credential.sessionId,
              expectedVersion: meeting.version,
            })
          }
        />
      </Suspense>
    );
  }

  if (preJoin) {
    return (
      <PageCanvas mode="focus" topInset="compact">
        <MeetingPreJoin
          meeting={meeting}
          defaultDisplayName={auth.user?.displayName ?? ''}
          busy={joinMutation.isPending}
          onCancel={() => {
            setLocalError(null);
            setPreJoin(false);
          }}
          onError={() => setLocalError(t('errors.mediaPermission'))}
          onSubmit={(nextChoices) => joinMutation.mutateAsync({ meeting, nextChoices })}
        />
      </PageCanvas>
    );
  }

  return (
    <PageCanvas mode="focus">
      <MeetingPageHeading
        eyebrow={t('room.eyebrow')}
        title={t('room.prepareTitle')}
        description={t('room.prepareDescription')}
      />
      {localError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {localError}
        </Alert>
      )}
      {waitingForAdmission && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography fontWeight={800}>{t('join.waitingTitle')}</Typography>
          <Typography variant="body2">{t('join.waitingDescription')}</Typography>
        </Alert>
      )}
      {admissionDenied && (
        <Alert severity="error" sx={{ mb: 2 }}>
          <Typography fontWeight={800}>{t('join.deniedTitle')}</Typography>
          <Typography variant="body2">{t('join.deniedDescription')}</Typography>
        </Alert>
      )}
      {!requiresAdmissionRequest && !waitingForAdmission && !admissionDenied && waitingForHost && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography fontWeight={800}>{t('room.waitingForHostTitle')}</Typography>
          <Typography variant="body2">{t('room.waitingForHostDescription')}</Typography>
        </Alert>
      )}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            lg: meeting.canModerate ? 'minmax(0, 1fr) 360px' : '1fr',
          },
          gap: 3,
          alignItems: 'start',
        }}
      >
        <Box
          sx={{
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            bgcolor: 'background.paper',
            overflow: 'hidden',
          }}
        >
          <Box sx={{ p: { xs: 2, md: 3 } }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2}>
              <Box sx={{ minWidth: 0 }}>
                <Typography component="h2" variant="h5" fontWeight={800}>
                  {meeting.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {formatMeetingDateTime(meeting.startsAt, i18n.language)} · {meeting.timeZone}
                </Typography>
              </Box>
              <MeetingStatusChip state={meeting.lifecycleState} />
            </Stack>
            <Typography
              sx={{ mt: 2, whiteSpace: 'pre-wrap' }}
              color={meeting.agenda ? 'text.primary' : 'text.secondary'}
            >
              {meeting.agenda || t('room.agendaEmpty')}
            </Typography>
          </Box>
          <Divider />
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            gap={2}
            sx={{ px: { xs: 2, md: 3 }, py: 2 }}
          >
            <Stack direction="row" gap={0.75} alignItems="center">
              <CalendarClock size={16} />
              <Typography variant="body2">
                {t('units.minutes', { count: meeting.durationMinutes })}
              </Typography>
            </Stack>
            <Stack direction="row" gap={0.75} alignItems="center">
              <UsersRound size={16} />
              <Typography variant="body2">
                {t('room.participants', { count: meeting.attendeeCount })}
              </Typography>
            </Stack>
            <Stack direction="row" gap={0.75} alignItems="center">
              <ShieldCheck size={16} />
              <Typography variant="body2">{t(`access.${meeting.accessScope}`)}</Typography>
            </Stack>
            <Chip
              size="small"
              variant="outlined"
              label={t('room.meetingCode', { code: meeting.meetingCode })}
            />
          </Stack>
          <Divider />
          <Box sx={{ p: { xs: 2, md: 3 } }}>
            {requiresAdmissionRequest ? (
              <ActionButton
                intent="primary"
                loading={admissionMutation.isPending}
                loadingLabel={t('join.requesting')}
                onClick={() => admissionMutation.mutate()}
              >
                {t('join.request')}
              </ActionButton>
            ) : (
              <ActionButton
                intent="primary"
                startIcon={<Video size={18} />}
                disabled={waitingForAdmission || admissionDenied || waitingForHost}
                onClick={() => setPreJoin(true)}
              >
                {waitingForAdmission
                  ? t('join.waitingTitle')
                  : waitingForHost
                    ? t('room.waitingForHostAction')
                    : t('room.deviceCheck')}
              </ActionButton>
            )}
          </Box>
        </Box>
        {meeting.canModerate && <MeetingLobbyPanel meetingId={meetingId} />}
      </Box>
    </PageCanvas>
  );
}
