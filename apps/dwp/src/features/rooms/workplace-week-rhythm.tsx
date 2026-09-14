import { foundationTokens } from '@dwp-frontend/design-system';
import { useTranslation } from 'react-i18next';
import { CalendarClock, CalendarDays, MapPin } from 'lucide-react';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import { WorkplaceHomeSectionHeader as SectionHeader } from './workplace-home-section-frame';
import { WorkplaceHomeWorkloadBar } from './workplace-home-workload-bar';
import { workplaceMemberCard } from './workplace-member-surfaces';

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
  const scaleMinutes = Math.max(60, ...week.map((day) => day.meetingMinutes + day.focusMinutes));
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
      sx={(theme) => ({
        ...workplaceMemberCard(theme),
        display: 'flex',
        flexDirection: 'column',
        borderWidth: { xs: 0, md: 1 },
        bgcolor: { xs: 'transparent', md: 'background.paper' },
      })}
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
            order: 1,
            px: 2,
            pt: 1.5,
            pb: hasWeekActivity ? 0 : 2.5,
          }}
        >
          {t('workplace.home.week.partial')}
        </Typography>
      )}
      {hasWeekActivity || complete ? (
        <Box
          component="ol"
          sx={{
            p: 0,
            m: 0,
            listStyle: 'none',
            order: 1,
            display: 'grid',
            gap: 1.5,
            px: { xs: 2, md: 2.5 },
            pb: 1.5,
            gridTemplateColumns: '1fr',
          }}
        >
          {week.map((day) => {
            const dateLabel = formatDate(
              `${day.date}T00:00:00Z`,
              { weekday: 'short', month: 'numeric', day: 'numeric', timeZone: 'UTC' },
              locale
            );
            const weekdayLabel = formatDate(
              `${day.date}T00:00:00Z`,
              { weekday: 'short', timeZone: 'UTC' },
              locale
            );
            const reservationLabel =
              day.reservationCount || complete
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
                  p: 0.5,
                  display: 'grid',
                  gridTemplateColumns: '28px minmax(0, 1fr) 50px',
                  alignItems: 'center',
                  gap: 1,
                  borderRadius: foundationTokens.radius.control + 'px',
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
                  <Typography
                    variant="caption"
                    fontWeight="fontWeightBold"
                    sx={{ whiteSpace: 'nowrap' }}
                  >
                    {weekdayLabel}
                  </Typography>
                </Box>
                <WorkplaceHomeWorkloadBar
                  day={day}
                  compact
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
                <Typography
                  sx={{
                    ...foundationTokens.workplace.typography.caption,
                    whiteSpace: 'nowrap',
                    textAlign: 'right',
                  }}
                  color={day.current ? 'primary.main' : 'text.secondary'}
                >
                  {day.current
                    ? t('workplace.home.week.today')
                    : complete
                      ? t('workplace.home.week.minutesShort', {
                          count: day.meetingMinutes + day.focusMinutes,
                        })
                      : t('workplace.home.sources.unverified')}
                </Typography>
                <Stack
                  spacing={0.55}
                  sx={{
                    gridColumn: '2',
                    minWidth: 0,
                    display: {
                      xs: 'none',
                      md:
                        day.current && (day.reservationCount || day.locations.length)
                          ? 'flex'
                          : 'none',
                    },
                  }}
                >
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
                      <Typography variant="caption" fontWeight="fontWeightBold">
                        {day.locations.join(' · ')}
                      </Typography>
                    </Stack>
                  )}
                </Stack>
              </Box>
            );
          })}
        </Box>
      ) : (
        <Box
          component="ol"
          sx={{ order: 1, m: 0, px: 2, pb: 2, listStyle: 'none', display: 'grid', gap: 1 }}
        >
          {week.map((day) => (
            <Box
              component="li"
              key={day.date}
              sx={{ display: 'grid', gridTemplateColumns: '52px minmax(0, 1fr)', gap: 1 }}
            >
              <Typography variant="caption" fontWeight="fontWeightBold">
                {formatDate(`${day.date}T00:00:00Z`, { weekday: 'short', timeZone: 'UTC' }, locale)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('workplace.home.availability.typeUnavailable')}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
      <Stack
        direction="row"
        gap={2}
        useFlexGap
        flexWrap="wrap"
        sx={{ order: { xs: 0, md: 2 }, px: { xs: 2, md: 3 }, pb: 2 }}
      >
        <Typography sx={foundationTokens.workplace.typography.caption} color="text.secondary">
          <Box
            component="span"
            sx={{ display: 'inline-block', width: 8, height: 8, bgcolor: 'primary.main', mr: 0.75 }}
          />
          {t('workplace.home.week.meetings')} ·{' '}
          {complete
            ? t('workplace.home.week.minutesShort', {
                count: week.reduce((total, day) => total + day.meetingMinutes, 0),
              })
            : t('workplace.home.sources.unverified')}
        </Typography>
        <Typography sx={foundationTokens.workplace.typography.caption} color="text.secondary">
          <Box
            component="span"
            sx={{
              display: 'inline-block',
              width: 8,
              height: 8,
              bgcolor: 'primary.light',
              mr: 0.75,
            }}
          />
          {t('workplace.home.week.focus')} ·{' '}
          {complete
            ? t('workplace.home.week.minutesShort', {
                count: week.reduce((total, day) => total + day.focusMinutes, 0),
              })
            : t('workplace.home.sources.unverified')}
        </Typography>
      </Stack>
    </Box>
  );
}
