import { useTranslation } from 'react-i18next';
import { CalendarClock, CalendarDays, MapPin } from 'lucide-react';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import { WorkplaceHomeSectionHeader as SectionHeader } from './workplace-home-section-frame';
import { WorkplaceHomeWorkloadBar } from './workplace-home-workload-bar';

import type { WorkplaceHomeWeekDay } from './workplace-home-model';

export function WorkplaceWeekRhythm({
  week,
  complete,
}: {
  week: readonly WorkplaceHomeWeekDay[];
  complete: boolean;
}) {
  const { t, i18n } = useTranslation('rooms');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage);
  const scaleMinutes = Math.max(
    60,
    ...week.flatMap((day) => [day.meetingMinutes, day.focusMinutes])
  );
  const hasWeekActivity = week.some(
    (day) =>
      day.meetingMinutes > 0 ||
      day.focusMinutes > 0 ||
      day.reservationCount > 0 ||
      day.locations.length > 0
  );

  return (
    <Box
      component="section"
      aria-labelledby="workplace-week-rhythm"
      sx={{ minWidth: 0, borderTop: 1, borderBottom: 1, borderColor: 'divider' }}
    >
      <SectionHeader
        id="workplace-week-rhythm"
        icon={CalendarClock}
        title={t('workplace.home.week.title')}
        description={t('workplace.home.week.description')}
      />
      {!complete && (
        <Typography
          color="warning.main"
          variant="caption"
          sx={{
            display: 'block',
            px: 2,
            pt: 1.5,
            pb: hasWeekActivity ? 0 : 2.5,
          }}
        >
          {t('workplace.home.week.partial')}
        </Typography>
      )}
      {hasWeekActivity ? (
        <Box
          component="ol"
          sx={{
            p: 0,
            m: 0,
            listStyle: 'none',
            display: 'grid',
            gap: 1.25,
            px: { xs: 2, md: 2.5 },
            pb: 2.5,
            gridTemplateColumns: { xs: '1fr', lg: 'repeat(5, minmax(0, 1fr))' },
          }}
        >
          {week.map((day) => {
            const dateLabel = formatDate(
              `${day.date}T00:00:00Z`,
              { weekday: 'short', month: 'numeric', day: 'numeric', timeZone: 'UTC' },
              locale
            );
            const reservationLabel = day.reservationCount
              ? t('workplace.home.week.reservations', { count: day.reservationCount })
              : complete
                ? t('workplace.home.week.noReservation')
                : '';

            return (
              <Box
                component="li"
                key={day.date}
                data-testid="workplace-week-day"
                aria-current={day.current ? 'date' : undefined}
                aria-label={[
                  dateLabel,
                  t('workplace.home.week.workloadLabel', {
                    meetingMinutes: day.meetingMinutes,
                    focusMinutes: day.focusMinutes,
                  }),
                  reservationLabel,
                  day.locations.join(' · '),
                ]
                  .filter(Boolean)
                  .join(', ')}
                sx={(theme) => ({
                  minWidth: 0,
                  minHeight: { xs: 0, sm: 124, lg: 212 },
                  p: 1.5,
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: '1fr',
                    sm: 'minmax(110px, 0.45fr) minmax(180px, 1fr) minmax(130px, 0.65fr)',
                    lg: '1fr',
                  },
                  alignItems: { sm: 'center', lg: 'stretch' },
                  gap: { xs: 1.25, sm: 2, lg: 1.25 },
                  border: 1,
                  borderTopWidth: day.current ? 3 : 1,
                  borderColor: day.current ? alpha(theme.palette.primary.main, 0.55) : 'divider',
                  borderTopColor: day.current ? 'primary.main' : 'divider',
                  borderRadius: 1,
                  bgcolor: day.current
                    ? alpha(
                        theme.palette.primary.main,
                        theme.palette.mode === 'dark' ? 0.18 : 0.055
                      )
                    : alpha(
                        theme.palette.background.paper,
                        theme.palette.mode === 'dark' ? 0.6 : 0.82
                      ),
                })}
              >
                <Box minWidth={0}>
                  <Typography variant="body2" fontWeight={day.current ? 850 : 750}>
                    {dateLabel}
                  </Typography>
                  {day.current && (
                    <Typography
                      variant="caption"
                      color="primary.main"
                      fontWeight={800}
                      sx={{ display: 'block', mt: 0.35 }}
                    >
                      {t('workplace.home.week.today')}
                    </Typography>
                  )}
                </Box>
                <WorkplaceHomeWorkloadBar
                  day={day}
                  scaleMinutes={scaleMinutes}
                  meetingLabel={t('workplace.home.week.meetings')}
                  focusLabel={t('workplace.home.week.focus')}
                  meetingValue={t('workplace.home.week.minutesShort', {
                    count: day.meetingMinutes,
                  })}
                  focusValue={t('workplace.home.week.minutesShort', {
                    count: day.focusMinutes,
                  })}
                  label={t('workplace.home.week.workloadLabel', {
                    meetingMinutes: day.meetingMinutes,
                    focusMinutes: day.focusMinutes,
                  })}
                />
                <Stack spacing={0.55} sx={{ alignSelf: { lg: 'end' } }}>
                  {reservationLabel && (
                    <Stack direction="row" spacing={0.65} alignItems="flex-start">
                      <CalendarDays size={14} aria-hidden="true" />
                      <Typography variant="caption" color="text.secondary">
                        {reservationLabel}
                      </Typography>
                    </Stack>
                  )}
                  {day.locations.length > 0 && (
                    <Stack direction="row" spacing={0.65} alignItems="flex-start">
                      <MapPin size={14} aria-hidden="true" />
                      <Typography variant="caption" fontWeight={700}>
                        {day.locations.join(' · ')}
                      </Typography>
                    </Stack>
                  )}
                </Stack>
              </Box>
            );
          })}
        </Box>
      ) : complete ? (
        <Box sx={{ px: { xs: 2, md: 2.5 }, pb: 2.5 }}>
          <Typography fontWeight={750}>{t('workplace.home.week.emptyTitle')}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.45 }}>
            {t('workplace.home.week.emptyDescription')}
          </Typography>
        </Box>
      ) : null}
    </Box>
  );
}
