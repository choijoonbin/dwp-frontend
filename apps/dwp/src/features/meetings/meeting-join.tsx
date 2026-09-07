import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Clock3, KeyRound, ShieldX } from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ActionButton, FormField, PageCanvas } from '@dwp-frontend/design-system';
import { useAuth } from '@dwp-frontend/shared-utils';
import {
  getVideoMeetingJoinRequest,
  normalizeVideoMeetingCode,
  requestVideoMeetingJoin,
  resolveVideoMeetingCode,
  type VideoMeetingCodeResolution,
  type VideoMeetingJoinRequest,
} from '@dwp-frontend/shared-utils/api/video-meeting-api';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { formatMeetingDateTime, MeetingPageHeading, MeetingStatusChip } from './meeting-components';
import {
  createMeetingJoinAttemptFence,
  type MeetingJoinRequestIntent,
  type MeetingJoinResolutionIntent,
} from './meeting-join-attempt-fence';
import { meetingInsetSurface, meetingSurface } from './meeting-visual-system';

const MIN_JOIN_CODE_LENGTH = 10;
const MAX_JOIN_CODE_LENGTH = 16;
const MAX_FORMATTED_JOIN_CODE_LENGTH = 19;

function formatJoinCode(value: string): string {
  return (
    normalizeVideoMeetingCode(value)
      .match(/.{1,4}/gu)
      ?.join('-') ?? ''
  );
}

function hasValidJoinCodeLength(value: string): boolean {
  const length = normalizeVideoMeetingCode(value).length;
  return length >= MIN_JOIN_CODE_LENGTH && length <= MAX_JOIN_CODE_LENGTH;
}

export function MeetingJoin() {
  const { t, i18n } = useTranslation('meetings');
  const auth = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [code, setCode] = useState(() => normalizeVideoMeetingCode(searchParams.get('code') ?? ''));
  const [displayName, setDisplayName] = useState(auth.user?.displayName ?? '');
  const [resolution, setResolution] = useState<VideoMeetingCodeResolution | null>(null);
  const [joinRequest, setJoinRequest] = useState<VideoMeetingJoinRequest | null>(null);
  const [resolveError, setResolveError] = useState(false);
  const [requestError, setRequestError] = useState(false);
  const [pendingResolutionGeneration, setPendingResolutionGeneration] = useState<number | null>(
    null
  );
  const [pendingRequestGeneration, setPendingRequestGeneration] = useState<number | null>(null);
  const attemptFenceRef = useRef<ReturnType<typeof createMeetingJoinAttemptFence> | null>(null);
  if (!attemptFenceRef.current) {
    attemptFenceRef.current = createMeetingJoinAttemptFence(code);
  }
  const attemptFence = attemptFenceRef.current;

  const resolveMutation = useMutation({
    mutationFn: (intent: MeetingJoinResolutionIntent) => resolveVideoMeetingCode(intent.code),
    onSuccess: (result, intent) => {
      if (!attemptFence.acceptResolution(intent, result.meeting.meetingId)) return;
      setPendingResolutionGeneration(null);
      setResolution(result);
      setJoinRequest(null);
      setResolveError(false);
      setRequestError(false);
    },
    onError: (_error, intent) => {
      if (!attemptFence.canCommitResolution(intent)) return;
      setPendingResolutionGeneration(null);
      setResolveError(true);
    },
  });
  const requestMutation = useMutation({
    mutationFn: (intent: MeetingJoinRequestIntent) =>
      requestVideoMeetingJoin(intent.meetingId, {
        displayName: intent.displayName,
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess: (result, intent) => {
      if (!attemptFence.canCommitRequest(intent) || result.meetingId !== intent.meetingId) return;
      setPendingRequestGeneration(null);
      setRequestError(false);
      setJoinRequest(result);
      if (!intent.requiresApproval && result.state === 'APPROVED') {
        const query = new URLSearchParams({ joinRequest: result.requestId });
        navigate(`/meetings/room/${encodeURIComponent(result.meetingId)}?${query.toString()}`);
      }
    },
    onError: (_error, intent) => {
      if (!attemptFence.canCommitRequest(intent)) return;
      setPendingRequestGeneration(null);
      setRequestError(true);
    },
  });
  const requestQuery = useQuery({
    queryKey: ['meetings', 'join-request', resolution?.meeting.meetingId, joinRequest?.requestId],
    queryFn: () =>
      getVideoMeetingJoinRequest(resolution?.meeting.meetingId ?? '', joinRequest?.requestId ?? ''),
    enabled: Boolean(
      resolution?.meeting.meetingId && joinRequest?.requestId && joinRequest.state === 'WAITING'
    ),
    refetchInterval: 2_500,
    retry: 1,
  });

  useEffect(() => {
    if (requestQuery.data && attemptFence.ownsMeeting(requestQuery.data.meetingId)) {
      setJoinRequest(requestQuery.data);
    }
  }, [attemptFence, requestQuery.data]);

  const enterDeviceCheck = () => {
    if (!resolution || !joinRequest) return;
    const query = new URLSearchParams({ joinRequest: joinRequest.requestId });
    navigate(
      `/meetings/room/${encodeURIComponent(resolution.meeting.meetingId)}?${query.toString()}`
    );
  };

  const currentStep = !resolution ? 0 : joinRequest?.state === 'APPROVED' ? 2 : 1;
  const steps = [
    { label: t('join.code'), icon: KeyRound },
    { label: t('join.request'), icon: Clock3 },
    { label: t('room.deviceCheck'), icon: CheckCircle2 },
  ] as const;

  return (
    <PageCanvas mode="focus">
      <MeetingPageHeading
        eyebrow={t('join.eyebrow')}
        title={t('join.title')}
        description={t('join.description')}
      />

      <Box
        sx={(theme) => ({
          ...meetingSurface(theme, { tone: 'primary' }),
          overflow: 'hidden',
        })}
      >
        <Box
          component="ol"
          aria-label={t('join.description')}
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: { xs: 0.5, sm: 1 },
            m: 0,
            px: { xs: 1.5, sm: 3 },
            pt: { xs: 1.5, sm: 2 },
            listStyle: 'none',
          }}
        >
          {steps.map((step, index) => {
            const Icon = step.icon;
            const reached = index <= currentStep;
            return (
              <Stack
                component="li"
                key={step.label}
                direction={{ xs: 'column', sm: 'row' }}
                alignItems="center"
                justifyContent="center"
                gap={0.75}
                aria-current={index === currentStep ? 'step' : undefined}
                sx={(theme) => ({
                  ...meetingInsetSurface(theme, reached ? 'primary' : 'neutral'),
                  minHeight: 48,
                  px: 1,
                  py: 0.75,
                  color: reached ? 'primary.main' : 'text.secondary',
                })}
              >
                <Icon size={16} aria-hidden="true" />
                <Typography variant="caption" fontWeight={reached ? 750 : 550} textAlign="center">
                  {step.label}
                </Typography>
              </Stack>
            );
          })}
        </Box>
        <Box
          component="form"
          sx={{
            p: { xs: 2, sm: 3 },
            bgcolor: 'background.paper',
            borderTop: 1,
            borderColor: 'divider',
          }}
          onSubmit={(event) => {
            event.preventDefault();
            if (!hasValidJoinCodeLength(code)) return;
            const normalizedCode = normalizeVideoMeetingCode(code);
            const intent = attemptFence.beginResolution(normalizedCode);
            setPendingResolutionGeneration(intent.generation);
            setResolution(null);
            setJoinRequest(null);
            setResolveError(false);
            setRequestError(false);
            setPendingRequestGeneration(null);
            resolveMutation.mutate(intent);
          }}
        >
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.25} alignItems="flex-start">
            <FormField
              autoFocus
              required
              label={t('join.code')}
              placeholder={t('join.codePlaceholder')}
              value={formatJoinCode(code)}
              supportingText={t('join.codeHint')}
              slotProps={{
                htmlInput: {
                  autoComplete: 'one-time-code',
                  inputMode: 'text',
                  maxLength: MAX_FORMATTED_JOIN_CODE_LENGTH,
                  'aria-label': code
                    ? t('join.codeAriaLabel', { code: Array.from(code).join(' ') })
                    : t('join.code'),
                },
              }}
              onChange={(event) => {
                const nextCode = normalizeVideoMeetingCode(event.target.value);
                attemptFence.replaceCode(nextCode);
                setCode(nextCode);
                setResolution(null);
                setJoinRequest(null);
                setResolveError(false);
                setRequestError(false);
                setPendingResolutionGeneration(null);
                setPendingRequestGeneration(null);
              }}
            />
            <ActionButton
              type="submit"
              intent="primary"
              disabled={!hasValidJoinCodeLength(code)}
              loading={pendingResolutionGeneration !== null}
              loadingLabel={t('join.resolving')}
              startIcon={<KeyRound size={17} />}
              sx={{ mt: { sm: 1 }, minWidth: 144, minHeight: 48 }}
            >
              {t('join.resolve')}
            </ActionButton>
          </Stack>
          {resolveError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {t('join.resolveError')}
            </Alert>
          )}
        </Box>

        {resolution && (
          <>
            <Divider />
            <Box sx={{ p: { xs: 2, sm: 3 } }}>
              <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={2}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography component="h2" variant="h6" fontWeight={800}>
                    {resolution.meeting.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {formatMeetingDateTime(resolution.meeting.startsAt, i18n.language)} ·{' '}
                    {resolution.meeting.organizerName}
                  </Typography>
                </Box>
                <MeetingStatusChip state={resolution.meeting.lifecycleState} />
              </Stack>

              {!resolution.joinAllowed ? (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  {t('join.notAllowed', {
                    reason: resolution.denialReason ?? t('status.CANCELLED'),
                  })}
                </Alert>
              ) : !joinRequest ? (
                <Stack gap={2} sx={{ mt: 2.5 }}>
                  <FormField
                    required
                    label={t('join.displayName')}
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value.slice(0, 100))}
                  />
                  {requestError && <Alert severity="error">{t('join.requestError')}</Alert>}
                  <ActionButton
                    intent="primary"
                    loading={pendingRequestGeneration !== null}
                    loadingLabel={t('join.requesting')}
                    disabled={!displayName.trim()}
                    onClick={() => {
                      const intent = attemptFence.beginRequest({
                        meetingId: resolution.meeting.meetingId,
                        displayName: displayName.trim(),
                        requiresApproval: resolution.requiresApproval,
                      });
                      if (!intent) return;
                      setPendingRequestGeneration(intent.generation);
                      setRequestError(false);
                      requestMutation.mutate(intent);
                    }}
                  >
                    {t(resolution.requiresApproval ? 'join.request' : 'join.continueDirect')}
                  </ActionButton>
                </Stack>
              ) : (
                <Stack gap={1.25}>
                  <JoinRequestState
                    request={joinRequest}
                    onContinue={enterDeviceCheck}
                    onRestart={() => setJoinRequest(null)}
                  />
                  {joinRequest.state === 'WAITING' && requestQuery.isError && (
                    <Alert severity="error">
                      <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        alignItems={{ xs: 'stretch', sm: 'center' }}
                        justifyContent="space-between"
                        gap={1}
                      >
                        <Typography variant="body2">{t('join.statusError')}</Typography>
                        <ActionButton
                          intent="quiet"
                          size="small"
                          loading={requestQuery.isFetching}
                          loadingLabel={t('join.checkingStatus')}
                          onClick={() => requestQuery.refetch()}
                        >
                          {t('join.retryStatus')}
                        </ActionButton>
                      </Stack>
                    </Alert>
                  )}
                </Stack>
              )}
            </Box>
          </>
        )}
      </Box>
    </PageCanvas>
  );
}

function JoinRequestState({
  request,
  onContinue,
  onRestart,
}: {
  request: VideoMeetingJoinRequest;
  onContinue: () => void;
  onRestart: () => void;
}) {
  const { t } = useTranslation('meetings');
  const state = {
    WAITING: {
      icon: <CircularProgress size={23} aria-hidden="true" />,
      title: t('join.waitingTitle'),
      description: t('join.waitingDescription'),
    },
    APPROVED: {
      icon: <CheckCircle2 size={24} color="#17805F" />,
      title: t('join.approvedTitle'),
      description: t('join.approvedDescription'),
    },
    DENIED: {
      icon: <ShieldX size={24} color="#B42318" />,
      title: t('join.deniedTitle'),
      description: t('join.deniedDescription'),
    },
    EXPIRED: {
      icon: <Clock3 size={24} color="#B45309" />,
      title: t('join.expiredTitle'),
      description: t('join.expiredDescription'),
    },
  }[request.state];

  return (
    <Stack
      role="status"
      direction={{ xs: 'column', sm: 'row' }}
      alignItems={{ xs: 'flex-start', sm: 'center' }}
      gap={1.5}
      sx={(theme) => ({
        ...meetingInsetSurface(
          theme,
          request.state === 'APPROVED'
            ? 'success'
            : request.state === 'WAITING'
              ? 'primary'
              : 'warning'
        ),
        mt: 2.5,
        p: 2,
      })}
    >
      {state.icon}
      <Box sx={{ flex: 1 }}>
        <Typography component="h2" variant="subtitle2" fontWeight={800}>
          {state.title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
          {state.description}
        </Typography>
      </Box>
      {request.state === 'APPROVED' && (
        <ActionButton intent="primary" onClick={onContinue}>
          {t('join.continue')}
        </ActionButton>
      )}
      {(request.state === 'DENIED' || request.state === 'EXPIRED') && (
        <ActionButton intent="quiet" onClick={onRestart}>
          {t('join.startOver')}
        </ActionButton>
      )}
    </Stack>
  );
}
