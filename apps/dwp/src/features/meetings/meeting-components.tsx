import { useTranslation } from 'react-i18next';
import { ArrowRight, CalendarClock, Clock3, UsersRound } from 'lucide-react';
import { ActionButton, GlyphSurface } from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
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
        width: '100%',
        minWidth: 0,
        maxWidth: '100%',
        alignItems: { xs: 'flex-start', md: 'flex-end' },
        justifyContent: 'space-between',
        flexDirection: { xs: 'column', md: 'row' },
        gap: { xs: 1.5, md: 3 },
        mb: { xs: 2.5, md: 3.5 },
      }}
    >
      <Box sx={{ width: '100%', minWidth: 0, maxWidth: 820 }}>
        <Typography
          variant="overline"
          color="primary.main"
          sx={{ fontWeight: 750, letterSpacing: '0.08em' }}
        >
          {eyebrow}
        </Typography>
        <Typography
          component="h1"
          sx={{
            mt: 0.35,
            fontSize: { xs: '1.75rem', sm: '2rem', md: '2.15rem' },
            fontWeight: 760,
            letterSpacing: '-0.035em',
            lineHeight: 1.15,
            maxWidth: '100%',
            wordBreak: 'keep-all',
            overflowWrap: 'break-word',
            hyphens: 'none',
          }}
        >
          {title}
        </Typography>
        <Typography
          color="text.secondary"
          sx={{
            mt: 0.75,
            maxWidth: 760,
            lineHeight: 1.65,
            wordBreak: 'keep-all',
            overflowWrap: 'break-word',
            hyphens: 'none',
          }}
        >
          {description}
        </Typography>
      </Box>
      {actions && <Box sx={{ flex: '0 0 auto' }}>{actions}</Box>}
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
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      justifyContent="space-between"
      alignItems={{ xs: 'flex-start', sm: 'flex-end' }}
      gap={1.25}
      mb={1.5}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography
          id={id}
          component="h2"
          sx={{ fontSize: '1.1rem', lineHeight: 1.3, fontWeight: 740, letterSpacing: '-0.015em' }}
        >
          {title}
        </Typography>
        {description && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 0.35, lineHeight: 1.55, maxWidth: 680 }}
          >
            {description}
          </Typography>
        )}
      </Box>
      {action && <Box sx={{ flex: '0 0 auto' }}>{action}</Box>}
    </Stack>
  );
}

export function MeetingStatusChip({ state }: { state: VideoMeetingLifecycleState }) {
  const { t } = useTranslation('meetings');
  return (
    <Chip
      size="small"
      color={STATUS_COLORS[state]}
      label={t(`status.${state}`)}
      sx={{ fontWeight: 700 }}
    />
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
    <Box sx={{ p: 2, minWidth: 0, position: 'relative' }}>
      <Stack direction="row" alignItems="center" gap={0.75}>
        <Box
          aria-hidden="true"
          sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: tone, flex: '0 0 auto' }}
        />
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
      </Stack>
      <Typography
        component="p"
        variant="h6"
        fontWeight={760}
        sx={{ mt: 0.45, fontVariantNumeric: 'tabular-nums' }}
      >
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
  inset = true,
}: {
  meeting: VideoMeetingSummary;
  onOpen?: () => void;
  history?: VideoMeetingHistoryItem;
  inset?: boolean;
}) {
  const { t, i18n } = useTranslation('meetings');
  const glyphTone =
    meeting.lifecycleState === 'LIVE'
      ? '#0f766e'
      : meeting.lifecycleState === 'LOBBY'
        ? '#b45309'
        : '#315fc8';

  return (
    <Box sx={{ py: 1.5, px: inset ? { xs: 1.5, sm: 2 } : 0 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        gap={1.5}
      >
        <Stack direction="row" alignItems="flex-start" gap={1.25} sx={{ minWidth: 0, flex: 1 }}>
          <GlyphSurface size={38} tone={glyphTone} variant="soft">
            <CalendarClock size={18} strokeWidth={1.8} />
          </GlyphSurface>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
              <Typography
                component="h3"
                variant="subtitle2"
                fontWeight={740}
                sx={{ wordBreak: 'keep-all', overflowWrap: 'break-word', hyphens: 'none' }}
              >
                {meeting.title}
              </Typography>
              <MeetingStatusChip state={meeting.lifecycleState} />
            </Stack>
            <Stack direction="row" columnGap={1.5} rowGap={0.5} flexWrap="wrap" sx={{ mt: 0.65 }}>
              <Stack direction="row" gap={0.5} alignItems="center" color="text.secondary">
                <Clock3 size={14} aria-hidden="true" />
                <Typography variant="caption" color="inherit">
                  {formatMeetingDateTime(meeting.startsAt, i18n.language)}
                </Typography>
              </Stack>
              <Stack direction="row" gap={0.5} alignItems="center" color="text.secondary">
                <UsersRound size={14} aria-hidden="true" />
                <Typography variant="caption" color="inherit">
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
        </Stack>
        {onOpen && (
          <ActionButton
            intent="quiet"
            size="small"
            endIcon={<ArrowRight size={15} aria-hidden="true" />}
            onClick={onOpen}
            sx={{ minHeight: 44, alignSelf: { xs: 'flex-start', sm: 'center' } }}
          >
            {history || meeting.lifecycleState === 'ENDED'
              ? t('history.openRecap')
              : meeting.lifecycleState === 'LIVE'
                ? t('actions.join')
                : t('home.focus.prepare')}
          </ActionButton>
        )}
      </Stack>
    </Box>
  );
}
