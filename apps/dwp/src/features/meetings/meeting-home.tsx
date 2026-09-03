import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  CalendarClock,
  CalendarPlus2,
  Clock3,
  Gauge,
  LogIn,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UsersRound,
  Video,
  type LucideIcon,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { resolveSystemTimeZone } from '@dwp-frontend/shared-i18n';
import {
  ActionButton,
  ErrorState,
  FormField,
  GlyphSurface,
  GuidedEmptyState,
  LoadingState,
  PageCanvas,
} from '@dwp-frontend/design-system';
import { useToast } from '@dwp-frontend/shared-utils';
import {
  createInstantVideoMeeting,
  getVideoMeetingHome,
  normalizeVideoMeetingCode,
  scheduleVideoMeeting,
  type ScheduleVideoMeetingInput,
  type VideoMeetingSummary,
} from '@dwp-frontend/shared-utils/api/video-meeting-api';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import {
  formatMeetingDateTime,
  MeetingPageHeading,
  MeetingSectionHeading,
  MeetingSummaryRow,
} from './meeting-components';
import { MeetingScheduleDialog } from './meeting-schedule-dialog';
import {
  meetingCommandSurface,
  meetingInsetSurface,
  meetingListSurface,
  meetingSurface,
  type MeetingSurfaceTone,
} from './meeting-visual-system';

const MAX_FORMATTED_JOIN_CODE_LENGTH = 19;

type HomeUnavailableReason = 'configuration' | 'policy' | 'temporary';

const HOME_UNAVAILABLE_REASON_MAP: Readonly<Record<string, HomeUnavailableReason>> = {
  MEETINGS_DISABLED: 'policy',
  MEETINGS_DISABLED_BY_POLICY: 'policy',
  MEETING_PROVIDER_DISABLED: 'configuration',
  CAPABILITY_NOT_CONFIGURED: 'configuration',
  LIVEKIT_CONTROL_PLANE_NOT_CONFIGURED: 'configuration',
  MEDIA_PROVIDER_NOT_CONFIGURED: 'configuration',
  MEETING_PROVIDER_NOT_CONFIGURED: 'configuration',
  CAPABILITY_NOT_READY: 'temporary',
  MEETING_PROVIDER_UNAVAILABLE: 'temporary',
  REALTIME_PROVIDER_LIVENESS_NOT_READY: 'temporary',
  REALTIME_PROVIDER_UNAVAILABLE: 'temporary',
};

type PulseSignal = {
  key: string;
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone: MeetingSurfaceTone;
};

function formatHomeJoinCode(value: string): string {
  const normalized = normalizeVideoMeetingCode(value);
  return normalized.match(/.{1,4}/gu)?.join('-') ?? '';
}

function resolveHomeUnavailableReason(reason: string | null | undefined): HomeUnavailableReason {
  return (reason && HOME_UNAVAILABLE_REASON_MAP[reason]) || 'configuration';
}

export function MeetingHome() {
  const { t } = useTranslation('meetings');
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const timeZone = resolveSystemTimeZone();
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
      <PageCanvas mode="workspace" topInset="compact">
        <LoadingState label={t('home.loading')} variant="skeleton" skeletonRows={5} />
      </PageCanvas>
    );
  }

  if (query.isError || !query.data) {
    return (
      <PageCanvas mode="workspace" topInset="compact">
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
  const capabilitiesAvailable = data.capabilities.available;
  const unavailableReason = resolveHomeUnavailableReason(data.capabilities.unavailableReason);
  const normalizedJoinCode = normalizeVideoMeetingCode(joinCode);
  const pulseSignals: PulseSignal[] = [];

  if (data.metrics.meetingsToday > 0) {
    pulseSignals.push({
      key: 'today',
      label: t('home.metrics.today'),
      value: data.metrics.meetingsToday,
      icon: CalendarClock,
      tone: 'primary',
    });
  }
  if (data.metrics.meetingMinutesToday > 0) {
    pulseSignals.push({
      key: 'minutes',
      label: t('home.metrics.minutes'),
      value: t('units.minutes', { count: data.metrics.meetingMinutesToday }),
      icon: Clock3,
      tone: 'success',
    });
  }
  if (data.metrics.waitingForApproval > 0) {
    pulseSignals.push({
      key: 'waiting',
      label: t('home.metrics.waiting'),
      value: data.metrics.waitingForApproval,
      icon: UsersRound,
      tone: 'warning',
    });
  }
  if (data.metrics.averageJoinSeconds != null && data.metrics.averageJoinSeconds > 0) {
    pulseSignals.push({
      key: 'join-time',
      label: t('home.metrics.joinTime'),
      value: t('units.seconds', { count: data.metrics.averageJoinSeconds }),
      icon: Gauge,
      tone: 'violet',
    });
  }

  const openJoin = () => {
    if (normalizedJoinCode) {
      navigate(`/meetings/join?code=${encodeURIComponent(normalizedJoinCode)}`);
      return;
    }
    navigate('/meetings/join');
  };

  return (
    <PageCanvas mode="workspace" topInset="compact">
      <MeetingPageHeading
        eyebrow={t('home.eyebrow')}
        title={t('home.title')}
        description={t('home.description')}
        actions={
          <ActionButton
            intent="quiet"
            startIcon={<RefreshCw size={16} aria-hidden="true" />}
            loading={query.isFetching}
            loadingLabel={t('home.refreshing')}
            onClick={() => query.refetch()}
            sx={{ minHeight: 44 }}
          >
            {t('actions.refresh')}
          </ActionButton>
        }
      />

      {!capabilitiesAvailable && (
        <Alert
          severity="warning"
          sx={{
            mb: 2.5,
            minWidth: 0,
            '& .MuiAlert-message': {
              minWidth: 0,
              overflowWrap: 'anywhere',
              wordBreak: 'break-word',
            },
          }}
        >
          {t('home.serviceUnavailable', {
            reason: t(`home.unavailableReasons.${unavailableReason}`),
          })}
        </Alert>
      )}

      <Box
        component="section"
        aria-label={t('home.command.label')}
        data-testid="meeting-command-deck"
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'minmax(0, 1fr)',
            lg: 'minmax(0, 7fr) minmax(300px, 5fr)',
          },
          gap: { xs: 2, md: 2.5 },
          alignItems: 'stretch',
        }}
      >
        <MeetingCommandHero
          meeting={focusMeeting}
          disabled={!capabilitiesAvailable}
          busy={instantMutation.isPending}
          onOpenMeeting={() => {
            if (focusMeeting) {
              navigate(`/meetings/room/${encodeURIComponent(focusMeeting.meetingId)}`);
            }
          }}
          onStart={() => instantMutation.mutate()}
        />

        <Box
          data-testid="meeting-command-secondary"
          sx={(theme) => ({
            ...meetingListSurface(theme),
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
          })}
        >
          {focusMeeting && (
            <MeetingQuickAction
              icon={Video}
              title={t('home.instant.title')}
              description={t('home.instant.description')}
              action={t('home.instant.action')}
              busy={instantMutation.isPending}
              disabled={!capabilitiesAvailable}
              onAction={() => instantMutation.mutate()}
            />
          )}
          <MeetingQuickAction
            icon={CalendarPlus2}
            title={t('home.schedule.title')}
            description={t('home.schedule.description')}
            action={t('home.schedule.action')}
            disabled={!capabilitiesAvailable}
            onAction={() => setScheduleOpen(true)}
          />
          <Box sx={{ p: { xs: 2, sm: 2.25 }, minWidth: 0 }}>
            <Stack direction="row" alignItems="flex-start" gap={1.25}>
              <GlyphSurface size={36} tone="#315fc8" variant="soft">
                <LogIn size={18} strokeWidth={1.8} />
              </GlyphSurface>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography component="h2" variant="subtitle2" fontWeight={750}>
                  {t('home.join.title')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                  {t('home.join.description')}
                </Typography>
              </Box>
            </Stack>
            <Stack
              component="form"
              direction={{ xs: 'column', sm: 'row', lg: 'column', xl: 'row' }}
              alignItems="stretch"
              gap={1}
              sx={{ mt: 1.5 }}
              onSubmit={(event) => {
                event.preventDefault();
                openJoin();
              }}
            >
              <FormField
                label={t('join.code')}
                value={joinCode}
                size="small"
                autoComplete="off"
                disabled={!capabilitiesAvailable}
                inputProps={{
                  inputMode: 'text',
                  maxLength: MAX_FORMATTED_JOIN_CODE_LENGTH,
                }}
                onChange={(event) => setJoinCode(formatHomeJoinCode(event.target.value))}
                sx={{ '& .MuiInputBase-root': { minHeight: 44 } }}
              />
              <ActionButton
                type="submit"
                intent="secondary"
                disabled={!capabilitiesAvailable}
                endIcon={<ArrowRight size={15} aria-hidden="true" />}
                sx={{
                  flex: '0 0 auto',
                  minHeight: 44,
                  whiteSpace: 'nowrap',
                  '@media (forced-colors: active)': {
                    '&.Mui-disabled': {
                      color: 'GrayText',
                      borderColor: 'GrayText',
                      opacity: 1,
                    },
                  },
                }}
              >
                {t('home.join.action')}
              </ActionButton>
            </Stack>
          </Box>
        </Box>
      </Box>

      <Box component="section" aria-labelledby="meeting-pulse-title" sx={{ mt: { xs: 3, md: 4 } }}>
        <MeetingSectionHeading
          id="meeting-pulse-title"
          title={t('home.metrics.title')}
          description={t('home.metrics.description')}
        />
        <Box
          data-testid="meeting-insight-strip"
          sx={(theme) => ({
            ...meetingSurface(theme, { elevated: false }),
            p: { xs: 2, md: 2.25 },
          })}
        >
          {pulseSignals.length ? (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'minmax(0, 1fr)',
                  sm: 'repeat(2, minmax(0, 1fr))',
                  lg: `repeat(${pulseSignals.length}, minmax(0, 1fr))`,
                },
                columnGap: 1.5,
                rowGap: 1,
              }}
            >
              {pulseSignals.map((signal) => (
                <MeetingPulseSignal key={signal.key} signal={signal} />
              ))}
            </Box>
          ) : (
            <Stack data-meeting-insight-empty="true" direction="row" gap={1.5} alignItems="center">
              <GlyphSurface size={40} tone="#0f766e" variant="soft">
                <Sparkles size={19} strokeWidth={1.8} />
              </GlyphSurface>
              <Box sx={{ minWidth: 0 }}>
                <Typography component="h3" variant="subtitle2" fontWeight={750}>
                  {t('home.metrics.quietTitle')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                  {t('home.metrics.quietDescription')}
                </Typography>
              </Box>
            </Stack>
          )}
        </Box>
      </Box>

      <Box
        data-testid="meeting-day-lists"
        sx={(theme) => ({
          ...meetingSurface(theme),
          mt: { xs: 3, md: 4 },
          display: 'grid',
          gridTemplateColumns: {
            xs: 'minmax(0, 1fr)',
            lg: 'minmax(0, 1.15fr) minmax(0, .85fr)',
          },
          overflow: 'hidden',
        })}
      >
        <Box
          component="section"
          aria-labelledby="meeting-today-title"
          sx={{ p: { xs: 2, md: 2.5 }, minWidth: 0 }}
        >
          <MeetingSectionHeading
            id="meeting-today-title"
            title={t('home.today.title')}
            description={t('home.today.description')}
            action={
              <ActionButton
                intent="quiet"
                size="small"
                onClick={() => navigate('/meetings/mine')}
                sx={{ minHeight: 44 }}
              >
                {t('actions.viewAll')}
              </ActionButton>
            }
          />
          {data.today.length ? (
            <Box sx={{ '& > *:not(:last-child)': { borderBottom: 1, borderColor: 'divider' } }}>
              {data.today.map((meeting) => (
                <MeetingSummaryRow
                  key={meeting.meetingId}
                  meeting={meeting}
                  inset={false}
                  onOpen={() => navigate(`/meetings/room/${encodeURIComponent(meeting.meetingId)}`)}
                />
              ))}
            </Box>
          ) : (
            <GuidedEmptyState
              kind="empty"
              title={t('home.today.empty')}
              description={t('home.today.emptyDescription')}
              size="compact"
            />
          )}
        </Box>

        <Box
          component="section"
          aria-labelledby="meeting-recent-title"
          sx={{
            p: { xs: 2, md: 2.5 },
            minWidth: 0,
            borderTop: { xs: 1, lg: 0 },
            borderLeft: { xs: 0, lg: 1 },
            borderColor: 'divider',
            bgcolor: (theme) =>
              alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.025 : 0.012),
          }}
        >
          <MeetingSectionHeading
            id="meeting-recent-title"
            title={t('home.recent.title')}
            description={t('home.recent.description')}
            action={
              <ActionButton
                intent="quiet"
                size="small"
                onClick={() => navigate('/meetings/history')}
                sx={{ minHeight: 44 }}
              >
                {t('actions.viewAll')}
              </ActionButton>
            }
          />
          {data.recent.length ? (
            <Box sx={{ '& > *:not(:last-child)': { borderBottom: 1, borderColor: 'divider' } }}>
              {data.recent.slice(0, 4).map((meeting) => (
                <MeetingSummaryRow
                  key={meeting.meetingId}
                  meeting={meeting}
                  history={meeting}
                  inset={false}
                  onOpen={() =>
                    navigate(`/meetings/history?meeting=${encodeURIComponent(meeting.meetingId)}`)
                  }
                />
              ))}
            </Box>
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

      <MeetingScheduleDialog
        open={scheduleOpen}
        busy={scheduleMutation.isPending}
        onClose={() => setScheduleOpen(false)}
        onSubmit={(input) => scheduleMutation.mutate(input)}
      />
    </PageCanvas>
  );
}

function MeetingCommandHero({
  meeting,
  disabled,
  busy,
  onOpenMeeting,
  onStart,
}: {
  meeting: VideoMeetingSummary | null | undefined;
  disabled: boolean;
  busy: boolean;
  onOpenMeeting: () => void;
  onStart: () => void;
}) {
  const { t, i18n } = useTranslation('meetings');
  const live = meeting?.lifecycleState === 'LIVE';

  return (
    <Box
      data-testid="meeting-command-primary"
      sx={(theme) => ({
        ...meetingCommandSurface(theme, live),
        minHeight: { xs: 300, md: 330 },
        p: { xs: 2.5, sm: 3.5, md: 4 },
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      })}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2}>
        <GlyphSurface size={46} tone={live ? '#0f766e' : '#315fc8'}>
          {meeting ? (
            <CalendarClock size={22} strokeWidth={1.8} />
          ) : (
            <Video size={22} strokeWidth={1.8} />
          )}
        </GlyphSurface>
        <Chip
          icon={<ShieldCheck size={14} aria-hidden="true" />}
          label={meeting ? t(`status.${meeting.lifecycleState}`) : t('home.command.ready')}
          size="small"
          sx={{
            maxWidth: '70%',
            color: 'inherit',
            bgcolor: 'rgba(255,255,255,.13)',
            border: '1px solid rgba(255,255,255,.2)',
            fontWeight: 700,
            '& .MuiChip-icon': { color: 'inherit' },
            '@media (forced-colors: active)': {
              borderColor: 'CanvasText',
              bgcolor: 'Canvas',
            },
          }}
        />
      </Stack>

      <Box sx={{ mt: { xs: 4, md: 5 }, maxWidth: 650 }}>
        <Typography
          component="h2"
          sx={{
            fontSize: { xs: '1.65rem', sm: '2rem', md: '2.25rem' },
            fontWeight: 760,
            letterSpacing: '-0.035em',
            lineHeight: 1.12,
            wordBreak: 'keep-all',
            overflowWrap: 'break-word',
            hyphens: 'none',
          }}
        >
          {meeting?.title ?? t('home.command.clearTitle')}
        </Typography>
        <Typography
          sx={{
            mt: 1.25,
            color: 'rgba(248,251,255,.78)',
            lineHeight: 1.65,
            maxWidth: 590,
            wordBreak: 'keep-all',
            overflowWrap: 'break-word',
            hyphens: 'none',
            '@media (forced-colors: active)': { color: 'CanvasText' },
          }}
        >
          {meeting ? t('home.command.focusDescription') : t('home.command.clearDescription')}
        </Typography>
        {meeting && (
          <Stack direction="row" flexWrap="wrap" columnGap={2} rowGap={0.75} sx={{ mt: 2 }}>
            <Stack direction="row" alignItems="center" gap={0.65}>
              <Clock3 size={15} aria-hidden="true" />
              <Typography variant="body2">
                {formatMeetingDateTime(meeting.startsAt, i18n.language)}
              </Typography>
            </Stack>
            <Stack direction="row" alignItems="center" gap={0.65}>
              <UsersRound size={15} aria-hidden="true" />
              <Typography variant="body2">{meeting.organizerName}</Typography>
            </Stack>
          </Stack>
        )}
      </Box>

      <Box sx={{ mt: 3 }}>
        <ActionButton
          intent="primary"
          loading={!meeting && busy}
          disabled={disabled}
          endIcon={<ArrowRight size={16} aria-hidden="true" />}
          onClick={meeting ? onOpenMeeting : onStart}
          sx={{
            minHeight: 44,
            bgcolor: '#fff',
            color: '#173d91',
            '&:hover': { bgcolor: 'rgba(255,255,255,.9)' },
            '@media (forced-colors: active)': {
              color: disabled ? 'GrayText' : 'ButtonText',
              bgcolor: 'ButtonFace',
              border: '1px solid',
              borderColor: disabled ? 'GrayText' : 'ButtonText',
              opacity: 1,
            },
          }}
        >
          {meeting
            ? meeting.lifecycleState === 'LIVE'
              ? t('actions.join')
              : t('home.focus.prepare')
            : t('home.instant.action')}
        </ActionButton>
      </Box>
    </Box>
  );
}

function MeetingQuickAction({
  icon: Icon,
  title,
  description,
  action,
  busy = false,
  disabled = false,
  onAction,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action: string;
  busy?: boolean;
  disabled?: boolean;
  onAction: () => void;
}) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row', lg: 'column', xl: 'row' }}
      alignItems={{ xs: 'stretch', sm: 'center', lg: 'stretch', xl: 'center' }}
      gap={1.5}
      sx={{ p: { xs: 2, sm: 2.25 }, minWidth: 0 }}
    >
      <Stack direction="row" alignItems="flex-start" gap={1.25} sx={{ minWidth: 0, flex: 1 }}>
        <GlyphSurface size={36} tone="#315fc8" variant="soft">
          <Icon size={18} strokeWidth={1.8} />
        </GlyphSurface>
        <Box sx={{ minWidth: 0 }}>
          <Typography component="h2" variant="subtitle2" fontWeight={750}>
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {description}
          </Typography>
        </Box>
      </Stack>
      <ActionButton
        intent="quiet"
        size="small"
        loading={busy}
        disabled={disabled}
        endIcon={<ArrowRight size={15} aria-hidden="true" />}
        onClick={onAction}
        sx={{
          flex: '0 0 auto',
          minHeight: 44,
          alignSelf: { sm: 'center', lg: 'flex-start', xl: 'center' },
          '@media (forced-colors: active)': {
            '&.Mui-disabled': {
              color: 'GrayText',
              border: '1px solid GrayText',
              opacity: 1,
            },
          },
        }}
      >
        {action}
      </ActionButton>
    </Stack>
  );
}

function MeetingPulseSignal({ signal }: { signal: PulseSignal }) {
  const Icon = signal.icon;
  return (
    <Stack
      data-meeting-insight={signal.key}
      direction="row"
      alignItems="center"
      gap={1.25}
      sx={(theme) => ({
        ...meetingInsetSurface(theme, signal.tone),
        px: 1.5,
        py: 1.25,
        minWidth: 0,
      })}
    >
      <GlyphSurface
        size={34}
        tone={
          signal.tone === 'success'
            ? '#0f766e'
            : signal.tone === 'warning'
              ? '#b45309'
              : signal.tone === 'violet'
                ? '#7c3aed'
                : '#315fc8'
        }
        variant="soft"
      >
        <Icon size={17} strokeWidth={1.8} />
      </GlyphSurface>
      <Box sx={{ minWidth: 0 }}>
        <Typography
          component="p"
          sx={{
            fontSize: '1.05rem',
            lineHeight: 1.2,
            fontWeight: 760,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {signal.value}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {signal.label}
        </Typography>
      </Box>
    </Stack>
  );
}
