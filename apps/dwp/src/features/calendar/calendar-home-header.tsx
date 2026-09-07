import { useTranslation } from 'react-i18next';
import { CalendarDays, CheckCircle2, RefreshCw } from 'lucide-react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { calendarHomeSurface } from './calendar-home-surfaces';

import type { ReactNode } from 'react';
import type { CalendarReadSourceState } from './calendar-read-source-state';

export function CalendarHomeHeader({
  eyebrow,
  title,
  description,
  timeZone,
  state,
  refreshing,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  timeZone?: string;
  state: CalendarReadSourceState;
  refreshing: boolean;
  actions: ReactNode;
}) {
  const { t } = useTranslation('calendar');
  return (
    <Box
      component="header"
      data-testid="calendar-home-header"
      sx={[calendarHomeSurface, { p: { xs: 2, sm: 2.5, lg: 3 }, mb: 2.5 }]}
    >
      <Stack direction="row" flexWrap="wrap" useFlexGap gap={1} alignItems="center" sx={{ mb: 1 }}>
        <CalendarDays size={15} aria-hidden="true" />
        <Typography variant="caption" color="text.secondary">
          {eyebrow}
        </Typography>
        {timeZone ? (
          <Typography variant="caption" color="text.secondary">
            {timeZone}
          </Typography>
        ) : null}
        {state === 'READY' ? (
          <Stack direction="row" gap={0.5} alignItems="center" sx={{ color: 'success.main' }}>
            {refreshing ? (
              <RefreshCw size={13} aria-hidden="true" />
            ) : (
              <CheckCircle2 size={13} aria-hidden="true" />
            )}
            <Typography variant="caption">
              {t(refreshing ? 'flow.refreshing' : 'flow.synced')}
            </Typography>
          </Stack>
        ) : null}
      </Stack>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) minmax(260px, auto)' },
          gap: 2,
          alignItems: 'center',
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap" useFlexGap>
            <Typography component="h1" variant="h4" fontWeight="fontWeightBold">
              {title}
            </Typography>
            <Typography variant="overline" color="primary.main">
              {t('flow.eyebrow')}
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, maxWidth: 620 }}>
            {description}
          </Typography>
        </Box>
        <Stack
          direction="row"
          flexWrap="wrap"
          useFlexGap
          gap={0.75}
          sx={{
            maxWidth: 470,
            '& > *': { minWidth: 0, maxWidth: '100%', flex: { xs: '1 1 9rem', sm: '0 1 auto' } },
          }}
        >
          {actions}
        </Stack>
      </Box>
    </Box>
  );
}
