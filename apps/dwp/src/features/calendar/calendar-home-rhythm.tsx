import { useTranslation } from 'react-i18next';
import { ArrowRight, BarChart3, ShieldCheck } from 'lucide-react';
import { ActionButton } from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import { calendarDate } from './calendar-components';
import { CALENDAR_HOME_ROW_RADIUS, calendarHomeSurface } from './calendar-home-surfaces';

import type { CalendarHome } from '@dwp-frontend/shared-utils';

export function CalendarHomeRhythm({
  data,
  language,
  onOpenInsights,
  onOpenDate,
}: {
  data: CalendarHome;
  language: string;
  onOpenInsights: () => void;
  onOpenDate: (date: string) => void;
}) {
  const { t } = useTranslation('calendar');
  const scaleMinutes = Math.max(
    1,
    ...data.weekLoad.map((day) => day.meetingMinutes + day.focusMinutes)
  );
  return (
    <Box
      component="section"
      aria-labelledby="calendar-today-week-title"
      data-testid="calendar-today-week-outlook"
      sx={[calendarHomeSurface, { p: { xs: 2, sm: 2.5 } }]}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        gap={1}
        flexWrap="wrap"
        useFlexGap
      >
        <Stack direction="row" gap={1} alignItems="center">
          <BarChart3 size={20} aria-hidden="true" />
          <Typography
            id="calendar-today-week-title"
            component="h2"
            variant="subtitle1"
            fontWeight="fontWeightBold"
          >
            {t('home.weekPulse')}
          </Typography>
        </Stack>
        <ActionButton
          intent="quiet"
          size="small"
          endIcon={<ArrowRight size={15} />}
          onClick={onOpenInsights}
        >
          {t('workspace.openInsights')}
        </ActionButton>
      </Stack>
      <Typography variant="caption" color="text.secondary">
        {t('home.weekPulseDescription')}
      </Typography>
      <Stack direction="row" flexWrap="wrap" useFlexGap gap={1.5} sx={{ my: 1.5 }}>
        {[
          ['home.metrics.meetings', 'primary.main'],
          ['home.metrics.focus', 'success.main'],
        ].map(([label, color]) => (
          <Stack key={label} direction="row" gap={0.6} alignItems="center">
            <Box
              aria-hidden="true"
              sx={{
                width: 8,
                height: 8,
                bgcolor: color,
                '@media (forced-colors: active)': {
                  bgcolor: label === 'home.metrics.meetings' ? 'Highlight' : 'CanvasText',
                },
              }}
            />
            <Typography variant="caption" color="text.secondary">
              {t(label!)}
            </Typography>
          </Stack>
        ))}
      </Stack>
      <Typography component="p" variant="caption" color="text.secondary" sx={{ mb: 1 }}>
        {t('flow.rhythmScale')}
      </Typography>
      <Stack component="ul" gap={0.5} sx={{ p: 0, m: 0, listStyle: 'none' }}>
        {data.weekLoad.map((day) => {
          const meetingWidth = (100 * day.meetingMinutes) / scaleMinutes;
          const focusWidth = (100 * day.focusMinutes) / scaleMinutes;
          const today = day.date === data.date;
          return (
            <Box component="li" key={day.date}>
              <Box
                component="button"
                type="button"
                onClick={() => onOpenDate(day.date)}
                aria-current={today ? 'date' : undefined}
                aria-label={t('workspace.dayLoadLabel', {
                  date: calendarDate(day.date, language),
                  value: day.loadPercent,
                  meetings: day.meetingMinutes,
                  focus: day.focusMinutes,
                })}
                sx={(theme) => ({
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: '84px minmax(0, 1fr)',
                    sm: '112px minmax(0, 1fr) auto',
                  },
                  alignItems: 'center',
                  gap: 1,
                  width: 1,
                  textAlign: 'left',
                  cursor: 'pointer',
                  p: 1,
                  border: '1px solid',
                  borderColor: today ? alpha(theme.palette.primary.main, 0.3) : 'transparent',
                  borderRadius: CALENDAR_HOME_ROW_RADIUS,
                  bgcolor: today ? alpha(theme.palette.primary.main, 0.065) : 'transparent',
                  color: today ? 'primary.main' : 'text.secondary',
                  '&:hover': { bgcolor: 'action.hover' },
                  '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' },
                  '@media (forced-colors: active)': {
                    bgcolor: 'Canvas',
                    color: 'CanvasText',
                    borderColor: today ? 'Highlight' : 'Canvas',
                    '&:focus-visible': { outlineColor: 'Highlight' },
                  },
                })}
              >
                <Typography
                  component="span"
                  variant="caption"
                  fontWeight={today ? 'fontWeightBold' : 'fontWeightRegular'}
                >
                  {calendarDate(day.date, language)}
                  {today ? ` · ${t('actions.today')}` : ''}
                </Typography>
                <Box
                  aria-hidden="true"
                  sx={(theme) => ({
                    height: 9,
                    display: 'flex',
                    overflow: 'hidden',
                    borderRadius: CALENDAR_HOME_ROW_RADIUS,
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                    '@media (forced-colors: active)': {
                      border: '1px solid CanvasText',
                      bgcolor: 'Canvas',
                    },
                  })}
                >
                  <Box
                    sx={{
                      width: `${meetingWidth}%`,
                      bgcolor: 'primary.main',
                      '@media (forced-colors: active)': { bgcolor: 'Highlight' },
                    }}
                  />
                  <Box
                    sx={{
                      width: `${focusWidth}%`,
                      bgcolor: 'success.main',
                      '@media (forced-colors: active)': { bgcolor: 'CanvasText' },
                    }}
                  />
                </Box>
                <Typography
                  component="span"
                  variant="caption"
                  sx={{ gridColumn: { xs: '2', sm: 'auto' }, fontVariantNumeric: 'tabular-nums' }}
                >
                  {t('insights.utilization', { value: day.loadPercent })}
                </Typography>
              </Box>
            </Box>
          );
        })}
      </Stack>
      <Stack
        direction="row"
        gap={0.75}
        alignItems="center"
        sx={(theme) => ({
          mt: 1.5,
          p: 1.25,
          borderRadius: CALENDAR_HOME_ROW_RADIUS,
          color: 'success.main',
          bgcolor: alpha(theme.palette.success.main, 0.07),
          '@media (forced-colors: active)': { border: '1px solid CanvasText', color: 'CanvasText' },
        })}
      >
        <ShieldCheck size={16} aria-hidden="true" />
        <Typography variant="caption">
          {t('flow.weekSummary', {
            count: data.metrics.eventCount,
            focus: data.metrics.focusMinutes,
            conflicts: data.metrics.conflictCount,
          })}
        </Typography>
      </Stack>
    </Box>
  );
}
