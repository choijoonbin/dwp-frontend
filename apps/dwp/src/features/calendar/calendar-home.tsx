import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  CalendarPlus,
  Clock3,
  MapPin,
  ShieldAlert,
  Sparkles,
  UsersRound,
  Video,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  getCalendarHome,
  cancelCalendarEvent,
  respondToCalendarEvent,
  useAuth,
  useToast,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  ConfirmDialog,
  GuidedEmptyState,
  PageCanvas,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { CalendarEventDialog } from './calendar-event-dialog';
import {
  CALENDAR_EVENT_TONES,
  CalendarAgendaItem,
  CalendarEventDrawer,
  CalendarMetric,
  CalendarPageHeading,
  calendarDate,
  calendarTime,
} from './calendar-components';

import type { CalendarEvent, CalendarResponseStatus } from '@dwp-frontend/shared-utils';

function minutesLabel(value: number, hour: string, minute: string) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  if (!hours) return `${minutes}${minute}`;
  if (!minutes) return `${hours}${hour}`;
  return `${hours}${hour} ${minutes}${minute}`;
}

export function CalendarHome() {
  const { t, i18n } = useTranslation('calendar');
  const auth = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<CalendarEvent | null>(null);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [cancelling, setCancelling] = useState<CalendarEvent | null>(null);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Seoul';
  const language = i18n.resolvedLanguage ?? i18n.language;
  const query = useQuery({
    queryKey: ['calendar', 'home', timeZone],
    queryFn: () => getCalendarHome(timeZone),
    staleTime: 30_000,
    retry: 1,
  });
  const respondMutation = useMutation({
    mutationFn: ({
      eventId,
      response,
    }: {
      eventId: string;
      response: Exclude<CalendarResponseStatus, 'NEEDS_ACTION'>;
    }) => respondToCalendarEvent(eventId, response),
    onSuccess: async (event) => {
      setSelected(event);
      await queryClient.invalidateQueries({ queryKey: ['calendar'] });
      toast.success(t('event.responseSaved'));
    },
    onError: () => toast.error(t('event.responseError')),
  });
  const cancelMutation = useMutation({
    mutationFn: (event: CalendarEvent) => cancelCalendarEvent(event.eventId, event.version),
    onSuccess: async () => {
      setSelected(null);
      setCancelling(null);
      await queryClient.invalidateQueries({ queryKey: ['calendar'] });
      toast.success(t('event.cancelled'));
    },
    onError: () => toast.error(t('event.cancelError')),
  });
  const data = query.data;
  const metrics = data?.metrics;
  const next = data?.nextEvent;
  const nextTone = next ? CALENDAR_EVENT_TONES[next.type] : CALENDAR_EVENT_TONES.MEETING;
  const nextStart = next ? new Date(next.startsAt) : null;
  const timeUntil = nextStart
    ? Math.max(0, Math.round((nextStart.getTime() - Date.now()) / 60_000))
    : 0;
  const focusProgress = metrics
    ? Math.min(
        100,
        Math.round((metrics.focusMinutes / Math.max(1, metrics.focusTargetMinutes)) * 100)
      )
    : 0;
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return t('home.greetingMorning');
    if (hour < 18) return t('home.greetingAfternoon');
    return t('home.greetingEvening');
  }, [t]);

  const respond = (event: CalendarEvent, response: 'ACCEPTED' | 'TENTATIVE' | 'DECLINED') => {
    respondMutation.mutate({ eventId: event.eventId, response });
  };

  return (
    <PageCanvas>
      <CalendarPageHeading
        eyebrow={data ? calendarDate(data.date, language) : t('home.today')}
        title={`${greeting}, ${auth.user?.displayName ?? t('home.member')}`}
        description={t('home.description')}
        actions={
          <ActionButton
            intent="primary"
            startIcon={<CalendarPlus size={18} />}
            onClick={() => setCreateOpen(true)}
          >
            {t('actions.newEvent')}
          </ActionButton>
        }
      />

      {query.isError && (
        <Alert
          severity="error"
          action={
            <ActionButton intent="quiet" onClick={() => query.refetch()}>
              {t('actions.retry')}
            </ActionButton>
          }
        >
          {t('home.loadError')}
        </Alert>
      )}

      {query.isLoading ? (
        <Stack spacing={2}>
          <Skeleton variant="rounded" height={188} />
          <Skeleton variant="rounded" height={118} />
          <Skeleton variant="rounded" height={360} />
        </Stack>
      ) : data ? (
        <Stack spacing={3}>
          <Box
            component="section"
            aria-label={t('home.nextEvent')}
            sx={{
              minHeight: 174,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) auto' },
              gap: 3,
              alignItems: 'center',
              px: { xs: 2.5, md: 3.5 },
              py: 3,
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              bgcolor: 'background.paper',
              position: 'relative',
              overflow: 'hidden',
              '&::before': {
                content: '""',
                position: 'absolute',
                inset: '0 auto 0 0',
                width: 5,
                bgcolor: nextTone.main,
              },
            }}
          >
            {next ? (
              <Box sx={{ minWidth: 0 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="overline" sx={{ color: nextTone.main }}>
                    {timeUntil > 0
                      ? t('home.startsIn', { count: timeUntil })
                      : t('home.inProgress')}
                  </Typography>
                  {next.conflict && (
                    <Stack direction="row" spacing={0.5} alignItems="center" color="error.main">
                      <ShieldAlert size={14} />
                      <Typography variant="caption" fontWeight={700}>
                        {t('event.conflict')}
                      </Typography>
                    </Stack>
                  )}
                </Stack>
                <Typography component="h2" variant="h4" fontWeight={800} sx={{ mt: 0.75 }}>
                  {next.title}
                </Typography>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={{ xs: 0.75, sm: 2 }}
                  sx={{ mt: 1.25 }}
                  color="text.secondary"
                >
                  <Stack direction="row" spacing={0.75} alignItems="center">
                    <Clock3 size={16} />
                    <Typography variant="body2">
                      {calendarTime(next.startsAt, language)} –{' '}
                      {calendarTime(next.endsAt, language)}
                    </Typography>
                  </Stack>
                  {next.location && (
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      <MapPin size={16} />
                      <Typography variant="body2">{next.location}</Typography>
                    </Stack>
                  )}
                  {next.attendees.length > 0 && (
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      <UsersRound size={16} />
                      <Typography variant="body2">
                        {t('home.attendeeShort', { count: next.attendees.length })}
                      </Typography>
                    </Stack>
                  )}
                </Stack>
              </Box>
            ) : (
              <Box>
                <Typography variant="overline" color="success.main">
                  {t('home.clearSchedule')}
                </Typography>
                <Typography component="h2" variant="h4" fontWeight={800} sx={{ mt: 0.75 }}>
                  {t('home.noNextEvent')}
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 0.75 }}>
                  {t('home.noNextEventDescription')}
                </Typography>
              </Box>
            )}
            <Stack
              direction="row"
              spacing={1}
              justifyContent={{ xs: 'flex-start', md: 'flex-end' }}
            >
              {next?.conferenceUrl && (
                <ActionButton
                  intent="primary"
                  onClick={() => window.open(next.conferenceUrl!, '_blank', 'noopener,noreferrer')}
                  startIcon={<Video size={17} />}
                >
                  {t('event.join')}
                </ActionButton>
              )}
              {next && (
                <ActionButton intent="secondary" onClick={() => setSelected(next)}>
                  {t('actions.details')}
                </ActionButton>
              )}
            </Stack>
          </Box>

          <Box
            component="section"
            aria-label={t('home.weekSnapshot')}
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, minmax(0, 1fr))' },
              bgcolor: 'background.paper',
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              overflow: 'hidden',
              '& > *:not(:last-child)': { borderRight: { lg: 1 }, borderColor: 'divider' },
            }}
          >
            <CalendarMetric
              label={t('home.metrics.meetings')}
              value={minutesLabel(metrics!.meetingMinutes, t('units.hour'), t('units.minute'))}
              hint={t('home.metrics.meetingsHint', { count: metrics!.eventCount })}
              color="#2563EB"
            />
            <CalendarMetric
              label={t('home.metrics.focus')}
              value={minutesLabel(metrics!.focusMinutes, t('units.hour'), t('units.minute'))}
              hint={t('home.metrics.focusHint', { progress: focusProgress })}
              color="#0F766E"
              progress={focusProgress}
            />
            <CalendarMetric
              label={t('home.metrics.responses')}
              value={metrics!.awaitingResponseCount}
              hint={
                metrics!.awaitingResponseCount
                  ? t('home.metrics.responsesHint')
                  : t('home.metrics.allCaughtUp')
              }
              color="#D97706"
            />
            <CalendarMetric
              label={t('home.metrics.rooms')}
              value={metrics!.availableRoomCount}
              hint={t('home.metrics.roomsHint')}
              color="#C2415D"
            />
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1.7fr) minmax(320px, 1fr)' },
              gap: 3,
            }}
          >
            <Box
              component="section"
              sx={{
                bgcolor: 'background.paper',
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                overflow: 'hidden',
              }}
            >
              <Box
                sx={{
                  px: 2.5,
                  py: 2,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Box>
                  <Typography component="h2" variant="h6" fontWeight={800}>
                    {t('home.todayAgenda')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('home.todayAgendaDescription')}
                  </Typography>
                </Box>
                <ActionButton
                  component={Link}
                  to="/calendar/schedule"
                  intent="quiet"
                  endIcon={<ArrowRight size={16} />}
                >
                  {t('actions.openCalendar')}
                </ActionButton>
              </Box>
              <Divider />
              {data.today.length ? (
                data.today.map((event) => (
                  <CalendarAgendaItem
                    key={`${event.eventId}-${event.startsAt}`}
                    event={event}
                    onOpen={() => setSelected(event)}
                    onRespond={(response) => respond(event, response)}
                  />
                ))
              ) : (
                <GuidedEmptyState
                  kind="empty"
                  title={t('home.emptyToday')}
                  description={t('home.emptyTodayDescription')}
                  actionLabel={t('actions.addFocus')}
                  onAction={() => setCreateOpen(true)}
                />
              )}
            </Box>

            <Box
              component="section"
              sx={{
                bgcolor: 'background.paper',
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                overflow: 'hidden',
              }}
            >
              <Box sx={{ px: 2.5, py: 2 }}>
                <Typography component="h2" variant="h6" fontWeight={800}>
                  {t('home.weekPulse')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('home.weekPulseDescription')}
                </Typography>
              </Box>
              <Divider />
              <Stack spacing={1.75} sx={{ p: 2.5 }}>
                {data.weekLoad.map((day) => (
                  <Box key={day.date}>
                    <Stack
                      direction="row"
                      alignItems="center"
                      justifyContent="space-between"
                      sx={{ mb: 0.65 }}
                    >
                      <Typography variant="body2" fontWeight={700}>
                        {calendarDate(day.date, language, false)}
                      </Typography>
                      <Typography
                        variant="caption"
                        color={day.loadPercent > 100 ? 'error.main' : 'text.secondary'}
                        fontWeight={700}
                      >
                        {day.eventCount
                          ? t('home.eventCount', { count: day.eventCount })
                          : t('home.freeDay')}
                      </Typography>
                    </Stack>
                    <Box
                      sx={{
                        position: 'relative',
                        height: 7,
                        bgcolor: 'action.hover',
                        borderRadius: 0.5,
                        overflow: 'hidden',
                      }}
                    >
                      <Box
                        sx={{
                          position: 'absolute',
                          inset: 0,
                          width: `${Math.min(100, day.loadPercent)}%`,
                          bgcolor:
                            day.loadPercent > 100
                              ? '#C2415D'
                              : day.loadPercent > 75
                                ? '#D97706'
                                : '#2563EB',
                        }}
                      />
                    </Box>
                  </Box>
                ))}
              </Stack>
            </Box>
          </Box>

          <Box
            component="section"
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: 'auto minmax(0, 1fr)' },
              gap: 2,
              alignItems: 'start',
              p: 2.5,
              bgcolor: '#F6F8FB',
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 200 }}>
              <Sparkles size={19} color="#7C3AED" />
              <Box>
                <Typography fontWeight={800}>{t('home.attentionTitle')}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('home.attentionDescription')}
                </Typography>
              </Box>
            </Stack>
            {data.attention.length ? (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                  gap: 1,
                }}
              >
                {data.attention.map((item) => (
                  <Box
                    key={item.key}
                    sx={{
                      p: 1.5,
                      bgcolor: 'background.paper',
                      borderLeft: '3px solid',
                      borderLeftColor:
                        item.severity === 'HIGH'
                          ? 'error.main'
                          : item.severity === 'MEDIUM'
                            ? 'warning.main'
                            : 'primary.main',
                    }}
                  >
                    <Typography variant="body2" fontWeight={750}>
                      {item.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.description}
                    </Typography>
                  </Box>
                ))}
              </Box>
            ) : (
              <Typography color="text.secondary">{t('home.noAttention')}</Typography>
            )}
          </Box>
        </Stack>
      ) : null}

      <CalendarEventDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <CalendarEventDialog
        open={Boolean(editing)}
        event={editing}
        onClose={() => setEditing(null)}
        onSaved={(event) => setSelected(event)}
      />
      <CalendarEventDrawer
        event={selected}
        open={Boolean(selected)}
        canEdit={
          selected?.organizerPersonPublicId
            ? selected.organizerPersonPublicId === auth.user?.personPublicId
            : selected?.organizerUserId === auth.user?.userId
        }
        onClose={() => setSelected(null)}
        onEdit={() => {
          setEditing(selected);
          setSelected(null);
        }}
        onCancel={() => selected && setCancelling(selected)}
        onRespond={(response) => selected && respond(selected, response)}
      />
      <ConfirmDialog
        open={Boolean(cancelling)}
        title={t('event.cancelTitle')}
        description={t('event.cancelDescription', { title: cancelling?.title })}
        cancelLabel={t('actions.close')}
        confirmLabel={t('event.cancelEvent')}
        confirmingLabel={t('event.cancelling')}
        intent="danger"
        busy={cancelMutation.isPending}
        onClose={() => setCancelling(null)}
        onConfirm={() => {
          if (cancelling) cancelMutation.mutate(cancelling);
        }}
      />
    </PageCanvas>
  );
}
