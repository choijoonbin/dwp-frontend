import { useTranslation } from 'react-i18next';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { VideoMeetingLifecycleState } from '@dwp-frontend/shared-utils/api/video-meeting-api';

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
  density = 'default',
  headingRef,
  headingTabIndex,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
  density?: 'default' | 'compact';
  headingRef?: React.Ref<HTMLHeadingElement>;
  headingTabIndex?: number;
}) {
  const compact = density === 'compact';
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
        mb: compact ? { xs: 2, md: 2.5 } : { xs: 2.5, md: 3.5 },
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
          ref={headingRef}
          tabIndex={headingTabIndex}
          sx={{
            mt: 0.35,
            fontSize: compact
              ? { xs: '1.35rem', sm: '1.5rem', md: '1.65rem' }
              : { xs: '1.75rem', sm: '2rem', md: '2.15rem' },
            fontWeight: 760,
            letterSpacing: '-0.035em',
            lineHeight: compact ? 1.25 : 1.15,
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
