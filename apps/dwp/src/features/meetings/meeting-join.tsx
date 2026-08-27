import { useEffect, useState } from 'react';
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

  const resolveMutation = useMutation({
    mutationFn: () => resolveVideoMeetingCode(normalizeVideoMeetingCode(code)),
    onSuccess: (result) => {
      setResolution(result);
      setJoinRequest(null);
    },
  });
  const requestMutation = useMutation({
    mutationFn: () =>
      requestVideoMeetingJoin(resolution?.meeting.meetingId ?? '', {
        displayName: displayName.trim(),
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess: setJoinRequest,
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
    if (requestQuery.data) setJoinRequest(requestQuery.data);
  }, [requestQuery.data]);

  const enterDeviceCheck = () => {
    if (!resolution || !joinRequest) return;
    const query = new URLSearchParams({ joinRequest: joinRequest.requestId });
    navigate(
      `/meetings/room/${encodeURIComponent(resolution.meeting.meetingId)}?${query.toString()}`
    );
  };

  return (
    <PageCanvas mode="focus">
      <MeetingPageHeading
        eyebrow={t('join.eyebrow')}
        title={t('join.title')}
        description={t('join.description')}
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
        <Box
          component="form"
          sx={{ p: { xs: 2, sm: 3 } }}
          onSubmit={(event) => {
            event.preventDefault();
            if (hasValidJoinCodeLength(code)) resolveMutation.mutate();
          }}
        >
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.25} alignItems="flex-start">
            <FormField
              autoFocus
              required
              label={t('join.code')}
              placeholder={t('join.codePlaceholder')}
              value={formatJoinCode(code)}
              disabled={resolveMutation.isPending}
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
                setCode(normalizeVideoMeetingCode(event.target.value));
                setResolution(null);
                setJoinRequest(null);
              }}
            />
            <ActionButton
              type="submit"
              intent="primary"
              disabled={!hasValidJoinCodeLength(code)}
              loading={resolveMutation.isPending}
              loadingLabel={t('join.resolving')}
              startIcon={<KeyRound size={17} />}
              sx={{ mt: { sm: 1 }, minWidth: 144, height: 40 }}
            >
              {t('join.resolve')}
            </ActionButton>
          </Stack>
          {resolveMutation.isError && (
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
                  {requestMutation.isError && (
                    <Alert severity="error">{t('join.requestError')}</Alert>
                  )}
                  <ActionButton
                    intent="primary"
                    loading={requestMutation.isPending}
                    loadingLabel={t('join.requesting')}
                    disabled={!displayName.trim()}
                    onClick={() => requestMutation.mutate()}
                  >
                    {t('join.request')}
                  </ActionButton>
                </Stack>
              ) : (
                <JoinRequestState request={joinRequest} onContinue={enterDeviceCheck} />
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
}: {
  request: VideoMeetingJoinRequest;
  onContinue: () => void;
}) {
  const { t } = useTranslation('meetings');
  const state = {
    WAITING: {
      icon: <CircularProgress size={23} />,
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
      sx={{ mt: 2.5, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}
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
    </Stack>
  );
}
