import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock3, Copy, FileText, MapPin, UsersRound, Video } from 'lucide-react';
import { ActionButton } from '@dwp-frontend/design-system';
import { resolveZonedDateKey } from '@dwp-frontend/shared-i18n';
import { useToast } from '@dwp-frontend/shared-utils';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import { calendarDate, calendarTime } from './calendar-components';
import {
  calendarConferenceUrl,
  calendarEventCanJoin,
  calendarMinutesUntil,
  calendarTodayLeadEvent,
} from './calendar-today-model';
import { calendarHomeSurface } from './calendar-home-surfaces';

import type { CalendarEvent, CalendarHome } from '@dwp-frontend/shared-utils';

export function CalendarHomeHero({
  data,
  currentTime,
  language,
  writable,
  onOpen,
}: {
  data: CalendarHome;
  currentTime: string;
  language: string;
  writable: boolean;
  onOpen: (event: CalendarEvent) => void;
}) {
  const { t } = useTranslation('calendar');
  const toast = useToast();
  const [copying, setCopying] = useState(false);
  const event = calendarTodayLeadEvent(data.today, currentTime) ?? data.nextEvent ?? null;
  const conferenceUrl = event ? calendarConferenceUrl(event) : null;
  const scheduledToday = event && resolveZonedDateKey(event.startsAt, data.timeZone) === data.date;
  const inProgress =
    event &&
    Date.parse(event.startsAt) <= Date.parse(currentTime) &&
    Date.parse(event.endsAt) > Date.parse(currentTime);
  const canJoin = Boolean(event && writable && calendarEventCanJoin(event, currentTime));
  const copyLink = async () => {
    if (!conferenceUrl || !writable || copying) return;
    setCopying(true);
    try {
      await navigator.clipboard.writeText(conferenceUrl);
      toast.success(t('flow.linkCopied'));
    } catch {
      toast.error(t('flow.copyFailed'));
    } finally {
      setCopying(false);
    }
  };
  return (
    <Box
      component="section"
      aria-labelledby="calendar-today-now-title"
      data-testid="calendar-today-now"
      sx={[
        calendarHomeSurface,
        (theme) => ({
          p: { xs: 2, sm: 3 },
          mb: 2.5,
          bgcolor: event ? 'primary.main' : 'background.paper',
          color: event ? 'primary.contrastText' : 'text.primary',
          boxShadow: event ? theme.shadows[2] : 'none',
          '@media (forced-colors: active)': {
            bgcolor: 'Canvas',
            color: 'CanvasText',
            borderColor: 'CanvasText',
            boxShadow: 'none',
          },
        }),
      ]}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) auto' },
          gap: 2.5,
          alignItems: 'center',
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" fontWeight="fontWeightBold">
            {event
              ? inProgress
                ? t('home.inProgress')
                : scheduledToday
                  ? t('home.startsIn', { count: calendarMinutesUntil(event, currentTime) })
                  : t('home.nextScheduled')
              : t('home.clearSchedule')}
          </Typography>
          <Typography
            id="calendar-today-now-title"
            component="h2"
            variant="h5"
            fontWeight="fontWeightBold"
            sx={{ mt: 0.5, overflowWrap: 'anywhere' }}
          >
            {event?.title ?? t('home.noNextEvent')}
          </Typography>
          {event ? (
            <Stack direction="row" flexWrap="wrap" useFlexGap gap={1.5} sx={{ mt: 1.25 }}>
              <Stack direction="row" gap={0.6} alignItems="center">
                <Clock3 size={15} aria-hidden="true" />
                <Typography variant="body2">
                  {!scheduledToday ? `${calendarDate(event.startsAt, language)} · ` : ''}
                  {calendarTime(event.startsAt, language)}–{calendarTime(event.endsAt, language)}
                </Typography>
              </Stack>
              {event.location ? (
                <Stack direction="row" gap={0.6} alignItems="center">
                  <MapPin size={15} aria-hidden="true" />
                  <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                    {event.location}
                  </Typography>
                </Stack>
              ) : null}
              {conferenceUrl ? (
                <Stack direction="row" gap={0.6} alignItems="center">
                  <Video size={15} aria-hidden="true" />
                  <Typography variant="body2">{t('flow.onlineMeeting')}</Typography>
                </Stack>
              ) : null}
              {event.attendees.length ? (
                <Stack direction="row" gap={0.6} alignItems="center">
                  <UsersRound size={15} aria-hidden="true" />
                  <Typography variant="body2">
                    {t('home.attendeeShort', { count: event.attendees.length })}
                  </Typography>
                </Stack>
              ) : null}
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {t('home.noNextEventDescription')}
            </Typography>
          )}
        </Box>
        {event ? (
          <Stack gap={1} sx={{ maxWidth: { md: 360 }, '& button': { whiteSpace: 'normal' } }}>
            <Stack direction="row" flexWrap="wrap" useFlexGap gap={1}>
              {conferenceUrl && writable ? (
                <ActionButton
                  intent="quiet"
                  startIcon={<Copy size={16} />}
                  loading={copying}
                  onClick={() => void copyLink()}
                  sx={(theme) => ({
                    color: 'inherit',
                    bgcolor: alpha(theme.palette.primary.contrastText, 0.13),
                    '&:hover': { bgcolor: alpha(theme.palette.primary.contrastText, 0.2) },
                    '@media (forced-colors: active)': { border: '1px solid ButtonText' },
                  })}
                >
                  {t('flow.copyLink')}
                </ActionButton>
              ) : null}
              <ActionButton
                intent="quiet"
                startIcon={<FileText size={16} />}
                onClick={() => onOpen(event)}
                sx={(theme) => ({
                  color: 'inherit',
                  bgcolor: alpha(theme.palette.primary.contrastText, 0.13),
                  '&:hover': { bgcolor: alpha(theme.palette.primary.contrastText, 0.2) },
                  '@media (forced-colors: active)': { border: '1px solid ButtonText' },
                })}
              >
                {t('flow.previewAgenda')}
              </ActionButton>
            </Stack>
            <ActionButton
              intent="secondary"
              startIcon={canJoin ? <Video size={17} /> : <FileText size={17} />}
              onClick={() =>
                canJoin && conferenceUrl
                  ? window.open(conferenceUrl, '_blank', 'noopener,noreferrer')
                  : onOpen(event)
              }
              sx={{
                alignSelf: 'flex-start',
                bgcolor: 'background.paper',
                color: 'primary.main',
                borderColor: 'transparent',
                '&:hover': { bgcolor: 'background.default', borderColor: 'transparent' },
                '@media (forced-colors: active)': {
                  borderColor: 'ButtonText',
                  color: 'ButtonText',
                },
              }}
            >
              {t(canJoin ? 'event.join' : 'actions.details')}
            </ActionButton>
          </Stack>
        ) : null}
      </Box>
    </Box>
  );
}
