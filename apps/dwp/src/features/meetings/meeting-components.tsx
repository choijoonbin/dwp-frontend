import { useTranslation } from 'react-i18next';
import { ArrowRight, Clock3, UsersRound, type LucideIcon } from 'lucide-react';
import { ActionButton } from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import type {
  VideoMeetingHistoryItem,
  VideoMeetingLifecycleState,
  VideoMeetingSummary,
} from '@dwp-frontend/shared-utils/api/video-meeting-api';

const STATUS_COLORS: Record<
  VideoMeetingLifecycleState,
  'default' | 'info' | 'success' | 'warning'
> = {
  DRAFT: 'default',
  SCHEDULED: 'info',
  LOBBY: 'warning',
  LIVE: 'success',
  ENDED: 'default',
  CANCELLED: 'default',
};

export function formatMeetingDateTime(value: string, language: string): string {
  return formatDate(
    value,
    {
      month: 'short',
      day: 'numeric',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
    },
    resolveSupportedLocale(language)
  );
}

export function formatMeetingTime(value: string, language: string): string {
  return formatDate(
    value,
    { hour: '2-digit', minute: '2-digit' },
    resolveSupportedLocale(language)
  );
}

export function MeetingPageHeading({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: { xs: 'flex-start', md: 'center' },
        justifyContent: 'space-between',
        flexDirection: { xs: 'column', md: 'row' },
        gap: 2,
        mb: 3,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="overline" color="primary.main">
          {eyebrow}
        </Typography>
        <Typography component="h1" variant="h4" fontWeight={800} sx={{ mt: 0.25 }}>
          {title}
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5, maxWidth: 760 }}>
          {description}
        </Typography>
      </Box>
      {actions}
    </Box>
  );
}

export function MeetingSectionHeading({
  id,
  title,
  description,
  action,
}: {
  id: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="flex-end" gap={2} mb={1.25}>
      <Box>
        <Typography id={id} component="h2" variant="h6" fontWeight={800}>
          {title}
        </Typography>
        {description && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
            {description}
          </Typography>
        )}
      </Box>
      {action}
    </Stack>
  );
}

export function MeetingStatusChip({ state }: { state: VideoMeetingLifecycleState }) {
  const { t } = useTranslation('meetings');
  return <Chip size="small" color={STATUS_COLORS[state]} label={t(`status.${state}`)} />;
}

export function MeetingActionPanel({
  icon: Icon,
  title,
  description,
  action,
  onAction,
  emphasis = false,
  busy = false,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action: string;
  onAction: () => void;
  emphasis?: boolean;
  busy?: boolean;
}) {
  return (
    <Box
      sx={{
        minWidth: 0,
        p: { xs: 2, md: 2.5 },
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 1.25,
        bgcolor: emphasis ? (theme) => alpha(theme.palette.primary.main, 0.065) : 'transparent',
        '&:not(:last-child)': {
          borderRight: { md: 1 },
          borderBottom: { xs: 1, md: 0 },
          borderColor: 'divider',
        },
      }}
    >
      <Box
        sx={{
          width: 38,
          height: 38,
          display: 'grid',
          placeItems: 'center',
          borderRadius: 1,
          color: emphasis ? 'primary.contrastText' : 'primary.main',
          bgcolor: emphasis ? 'primary.main' : (theme) => alpha(theme.palette.primary.main, 0.1),
        }}
      >
        <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
      </Box>
      <Box sx={{ minHeight: { md: 72 } }}>
        <Typography component="h2" variant="subtitle1" fontWeight={800}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
          {description}
        </Typography>
      </Box>
      <ActionButton
        intent={emphasis ? 'primary' : 'secondary'}
        loading={busy}
        endIcon={<ArrowRight size={16} aria-hidden="true" />}
        onClick={onAction}
      >
        {action}
      </ActionButton>
    </Box>
  );
}

export function MeetingMetric({
  label,
  value,
  detail,
  progress,
  tone,
}: {
  label: string;
  value: string | number;
  detail?: string;
  progress?: number;
  tone: string;
}) {
  return (
    <Box sx={{ p: 2, minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography component="p" variant="h6" fontWeight={800} sx={{ mt: 0.3 }}>
        {value}
      </Typography>
      {detail && (
        <Typography variant="caption" color="text.secondary">
          {detail}
        </Typography>
      )}
      {progress !== undefined && (
        <LinearProgress
          variant="determinate"
          value={Math.max(0, Math.min(100, progress))}
          aria-label={label}
          sx={{
            mt: 1,
            height: 4,
            bgcolor: 'action.hover',
            '& .MuiLinearProgress-bar': { bgcolor: tone },
          }}
        />
      )}
    </Box>
  );
}

export function MeetingSummaryRow({
  meeting,
  onOpen,
  history,
}: {
  meeting: VideoMeetingSummary;
  onOpen?: () => void;
  history?: VideoMeetingHistoryItem;
}) {
  const { t, i18n } = useTranslation('meetings');
  return (
    <Box>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        gap={1.5}
        sx={{ px: 2, py: 1.75 }}
      >
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
            <Typography component="h3" variant="subtitle2" fontWeight={800} noWrap>
              {meeting.title}
            </Typography>
            <MeetingStatusChip state={meeting.lifecycleState} />
          </Stack>
          <Stack direction="row" gap={1.5} flexWrap="wrap" sx={{ mt: 0.65 }}>
            <Stack direction="row" gap={0.5} alignItems="center">
              <Clock3 size={14} aria-hidden="true" />
              <Typography variant="caption" color="text.secondary">
                {formatMeetingDateTime(meeting.startsAt, i18n.language)}
              </Typography>
            </Stack>
            <Stack direction="row" gap={0.5} alignItems="center">
              <UsersRound size={14} aria-hidden="true" />
              <Typography variant="caption" color="text.secondary">
                {t('units.participants', {
                  count: history?.participantPeak ?? meeting.attendeeCount,
                })}
              </Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {meeting.organizerName}
            </Typography>
          </Stack>
        </Box>
        {onOpen && (
          <ActionButton intent="quiet" endIcon={<ArrowRight size={15} />} onClick={onOpen}>
            {meeting.lifecycleState === 'LIVE' ? t('actions.join') : t('home.focus.prepare')}
          </ActionButton>
        )}
      </Stack>
      <Divider />
    </Box>
  );
}
