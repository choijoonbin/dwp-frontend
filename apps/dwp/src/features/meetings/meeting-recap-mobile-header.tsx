import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarClock, ChevronLeft, RefreshCw, ShieldCheck, UsersRound } from 'lucide-react';
import { ActionButton, ActionIconButton } from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { meetingSurface } from './meeting-visual-system';

/** Presentation only: the parent supplies already-authorized metadata and stage state. */
export function MeetingRecapMobileHeader({
  title,
  ended,
  access,
  evidence,
  duration,
  participants,
  refreshing,
  onClose,
  onRefresh,
  pipeline,
}: {
  title: string;
  ended: string;
  access: string;
  evidence: string;
  duration: string;
  participants: string;
  refreshing: boolean;
  onClose: () => void;
  onRefresh: () => void;
  pipeline: ReactNode;
}) {
  const { t } = useTranslation('meetings');
  return (
    <Box
      data-testid="meeting-recap-mobile-header"
      sx={(theme) => ({ ...meetingSurface(theme), p: 1.5, minWidth: 0 })}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" gap={0.5}>
        <ActionButton
          intent="quiet"
          size="small"
          startIcon={<ChevronLeft size={16} aria-hidden="true" />}
          onClick={onClose}
          sx={{ minWidth: 0, minHeight: 44, justifyContent: 'flex-start' }}
        >
          {t('history.recap.back')}
        </ActionButton>
        <ActionIconButton
          label={t('actions.refresh')}
          loading={refreshing}
          onClick={onRefresh}
          sx={{ flexShrink: 0, minWidth: 44, minHeight: 44 }}
        >
          <RefreshCw size={16} aria-hidden="true" />
        </ActionIconButton>
      </Stack>
      <Typography
        id="meeting-recap-title"
        component="h1"
        variant="h5"
        fontWeight="fontWeightBold"
        sx={{ mt: 0.5, overflowWrap: 'anywhere' }}
      >
        {title}
      </Typography>
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.5 }}>
        {ended}
      </Typography>
      <Stack direction="row" flexWrap="wrap" gap={1.25} sx={{ my: 1 }}>
        <Stack
          component="span"
          direction="row"
          alignItems="center"
          gap={0.5}
          aria-label={`${t('history.recap.metrics.duration')}: ${duration}`}
        >
          <CalendarClock size={14} aria-hidden="true" />
          <Typography component="span" variant="caption" fontWeight="fontWeightBold">
            {duration}
          </Typography>
        </Stack>
        <Stack
          component="span"
          direction="row"
          alignItems="center"
          gap={0.5}
          aria-label={`${t('history.recap.metrics.participants')}: ${participants}`}
        >
          <UsersRound size={14} aria-hidden="true" />
          <Typography component="span" variant="caption" fontWeight="fontWeightBold">
            {participants}
          </Typography>
        </Stack>
      </Stack>
      <Stack
        direction="row"
        flexWrap="wrap"
        gap={0.5}
        sx={{
          '& .MuiChip-root': { maxWidth: '100%', height: 'auto', minHeight: 24 },
          '& .MuiChip-label': { whiteSpace: 'normal', overflowWrap: 'anywhere' },
        }}
      >
        <Chip size="small" icon={<ShieldCheck size={14} aria-hidden="true" />} label={access} />
        <Chip size="small" variant="outlined" label={evidence} />
      </Stack>
      <Box sx={{ mt: 1.25, pt: 1, borderTop: 1, borderColor: 'divider' }}>{pipeline}</Box>
    </Box>
  );
}
