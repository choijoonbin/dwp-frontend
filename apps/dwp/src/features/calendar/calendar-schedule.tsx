import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { CalendarPlus, ChevronLeft, ChevronRight, CircleAlert, List, Rows3 } from 'lucide-react';
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  getCalendarEvents,
  getCalendars,
  cancelCalendarEvent,
  respondToCalendarEvent,
  useAuth,
  useToast,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  ActionIconButton,
  ConfirmDialog,
  PageCanvas,
} from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';

import { CalendarEventDialog } from './calendar-event-dialog';
import {
  CALENDAR_EVENT_TONES,
  CalendarAgendaItem,
  CalendarEventDrawer,
  CalendarPageHeading,
  calendarDate,
  calendarLocale,
  calendarTime,
} from './calendar-components';

import type {
  CalendarEvent,
  CalendarEventType,
  CalendarResponseStatus,
} from '@dwp-frontend/shared-utils';

type CalendarViewMode = 'week' | 'month' | 'agenda';

const START_HOUR = 8;
const END_HOUR = 20;
const HOUR_HEIGHT = 58;

function startOfWeek(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  return date;
}

function addDays(value: Date, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function monthGridStart(value: Date) {
  const first = new Date(value.getFullYear(), value.getMonth(), 1);
  return startOfWeek(first);
}

function rangeFor(view: CalendarViewMode, cursor: Date) {
  if (view === 'month') {
    const from = monthGridStart(cursor);
    return { from, to: addDays(from, 42) };
  }
  const from = view === 'week' ? startOfWeek(cursor) : new Date(cursor);
  from.setHours(0, 0, 0, 0);
  return { from, to: addDays(from, view === 'agenda' ? 30 : 7) };
}

function moveCursor(cursor: Date, view: CalendarViewMode, direction: number) {
  const next = new Date(cursor);
  if (view === 'month') next.setMonth(next.getMonth() + direction);
  else next.setDate(next.getDate() + direction * (view === 'week' ? 7 : 30));
  return next;
}

function eventPosition(event: CalendarEvent) {
  const start = new Date(event.startsAt);
  const end = new Date(event.endsAt);
  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const endMinutes = end.getHours() * 60 + end.getMinutes();
  const top = Math.max(0, ((startMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT);
  const height = Math.max(
    24,
    ((Math.min(endMinutes, END_HOUR * 60) - Math.max(startMinutes, START_HOUR * 60)) / 60) *
      HOUR_HEIGHT
  );
  return { top, height };
}

export function CalendarSchedule() {
  const { t, i18n } = useTranslation('calendar');
  const auth = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const compactLayout = useMediaQuery('(max-width:599.95px)', { noSsr: true });
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView] = useState<CalendarViewMode>(() => (compactLayout ? 'agenda' : 'week'));
  const [cursor, setCursor] = useState(new Date());
  const [selectedCalendars, setSelectedCalendars] = useState<string[]>([]);
  const [selected, setSelected] = useState<CalendarEvent | null>(null);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [cancelling, setCancelling] = useState<CalendarEvent | null>(null);
  const [createState, setCreateState] = useState<{ start: string; type: CalendarEventType } | null>(
    null
  );
  const requestedEventId = searchParams.get('event');
  const language = i18n.resolvedLanguage ?? i18n.language;
  const range = useMemo(() => rangeFor(view, cursor), [cursor, view]);
  const eventsQuery = useQuery({
    queryKey: ['calendar', 'events', range.from.toISOString(), range.to.toISOString()],
    queryFn: () => getCalendarEvents(range.from.toISOString(), range.to.toISOString()),
    staleTime: 20_000,
    retry: 1,
  });
  const calendarsQuery = useQuery({
    queryKey: ['calendar', 'calendars'],
    queryFn: getCalendars,
    staleTime: 60_000,
    retry: 1,
  });

  useEffect(() => {
    if (!selectedCalendars.length && calendarsQuery.data?.length) {
      setSelectedCalendars(calendarsQuery.data.map((calendar) => calendar.calendarId));
    }
  }, [calendarsQuery.data, selectedCalendars.length]);

  useEffect(() => {
    const requestedType = searchParams.get('create');
    if (!requestedType) return;
    setCreateState({
      start: new Date().toISOString(),
      type: requestedType === 'focus' ? 'FOCUS' : 'MEETING',
    });
    const next = new URLSearchParams(searchParams);
    next.delete('create');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!requestedEventId || !eventsQuery.data) return;
    const requestedEvent = eventsQuery.data.find((event) => event.eventId === requestedEventId);
    if (!requestedEvent) return;
    setSelected((current) =>
      current?.eventId === requestedEvent.eventId ? current : requestedEvent
    );
  }, [eventsQuery.data, requestedEventId]);

  const clearEventSelection = () => {
    setSelected(null);
    if (!requestedEventId) return;
    const next = new URLSearchParams(searchParams);
    next.delete('event');
    setSearchParams(next, { replace: true });
  };

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
      clearEventSelection();
      setCancelling(null);
      await queryClient.invalidateQueries({ queryKey: ['calendar'] });
      toast.success(t('event.cancelled'));
    },
    onError: () => toast.error(t('event.cancelError')),
  });

  const events = (eventsQuery.data ?? []).filter(
    (event) => !selectedCalendars.length || selectedCalendars.includes(event.calendarId)
  );
  const agendaGroups = useMemo(() => {
    const groups = new Map<string, { date: Date; events: CalendarEvent[] }>();
    [...events]
      .sort((left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt))
      .forEach((event) => {
        const date = new Date(event.startsAt);
        const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
        const group = groups.get(key) ?? { date, events: [] };
        group.events.push(event);
        groups.set(key, group);
      });
    return [...groups.values()];
  }, [events]);
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(cursor), index));
  const monthDays = Array.from({ length: 42 }, (_, index) =>
    addDays(monthGridStart(cursor), index)
  );
  const title =
    view === 'month'
      ? formatDate(cursor, { year: 'numeric', month: 'long' }, calendarLocale(language))
      : `${calendarDate(range.from, language, false)} – ${calendarDate(addDays(range.to, -1), language, false)}`;

  const openAt = (date: Date, hour = 9, type: CalendarEventType = 'MEETING') => {
    const start = new Date(date);
    start.setHours(hour, 0, 0, 0);
    setCreateState({ start: start.toISOString(), type });
  };
  const respond = (event: CalendarEvent, response: 'ACCEPTED' | 'TENTATIVE' | 'DECLINED') =>
    respondMutation.mutate({ eventId: event.eventId, response });

  return (
    <PageCanvas>
      <CalendarPageHeading
        eyebrow={t('schedule.eyebrow')}
        title={t('schedule.title')}
        description={t('schedule.description')}
        actions={
          <ActionButton
            intent="primary"
            startIcon={<CalendarPlus size={18} />}
            onClick={() => openAt(new Date(), 9)}
          >
            {t('actions.newEvent')}
          </ActionButton>
        }
      />

      <Box
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
            minHeight: 62,
            px: 2,
            py: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            flexWrap: 'wrap',
          }}
        >
          <Stack direction="row" spacing={0.5} alignItems="center">
            <ActionIconButton
              label={t('actions.previous')}
              onClick={() => setCursor(moveCursor(cursor, view, -1))}
            >
              <ChevronLeft size={19} />
            </ActionIconButton>
            <ActionButton intent="quiet" onClick={() => setCursor(new Date())}>
              {t('actions.today')}
            </ActionButton>
            <ActionIconButton
              label={t('actions.next')}
              onClick={() => setCursor(moveCursor(cursor, view, 1))}
            >
              <ChevronRight size={19} />
            </ActionIconButton>
            <Typography fontWeight={800} sx={{ ml: 1 }}>
              {title}
            </Typography>
          </Stack>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={view}
            onChange={(_, value: CalendarViewMode | null) => value && setView(value)}
          >
            <ToggleButton value="week">
              <Rows3 size={16} />
              <Box component="span" sx={{ ml: 0.75 }}>
                {t('schedule.views.week')}
              </Box>
            </ToggleButton>
            <ToggleButton value="month">{t('schedule.views.month')}</ToggleButton>
            <ToggleButton value="agenda">
              <List size={16} />
              <Box component="span" sx={{ ml: 0.75 }}>
                {t('schedule.views.agenda')}
              </Box>
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
        <Divider />

        {eventsQuery.isError ? (
          <Alert
            severity="error"
            action={
              <ActionButton intent="quiet" onClick={() => eventsQuery.refetch()}>
                {t('actions.retry')}
              </ActionButton>
            }
          >
            {t('schedule.loadError')}
          </Alert>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', xl: '264px minmax(0, 1fr)' },
              minHeight: 660,
            }}
          >
            <Box
              component="aside"
              sx={{
                display: { xs: 'none', xl: 'block' },
                borderRight: 1,
                borderColor: 'divider',
                p: 1.5,
              }}
            >
              <DateCalendar
                value={dayjs(cursor)}
                onChange={(value) => value && setCursor(value.toDate())}
                sx={{ width: 1, '& .MuiPickersCalendarHeader-root': { px: 1 } }}
              />
              <Divider sx={{ my: 1.5 }} />
              <Typography variant="overline" color="text.secondary" sx={{ px: 1 }}>
                {t('schedule.myCalendars')}
              </Typography>
              <Stack sx={{ mt: 0.5 }}>
                {(calendarsQuery.data ?? []).map((calendar) => (
                  <FormControlLabel
                    key={calendar.calendarId}
                    control={
                      <Checkbox
                        size="small"
                        checked={selectedCalendars.includes(calendar.calendarId)}
                        onChange={(change) =>
                          setSelectedCalendars((current) =>
                            change.target.checked
                              ? [...current, calendar.calendarId]
                              : current.filter((id) => id !== calendar.calendarId)
                          )
                        }
                        sx={{ color: calendar.color, '&.Mui-checked': { color: calendar.color } }}
                      />
                    }
                    label={<Typography variant="body2">{calendar.name}</Typography>}
                    sx={{ mx: 0, px: 0.5 }}
                  />
                ))}
              </Stack>
            </Box>

            <Box sx={{ minWidth: 0, overflowX: 'auto' }}>
              {eventsQuery.isLoading ? (
                <Stack spacing={1} sx={{ p: 2 }}>
                  {Array.from({ length: 8 }, (_, index) => (
                    <Skeleton key={index} height={54} />
                  ))}
                </Stack>
              ) : view === 'week' ? (
                <Box sx={{ minWidth: 860 }}>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: '64px repeat(7, minmax(108px, 1fr))',
                      height: 62,
                      borderBottom: 1,
                      borderColor: 'divider',
                    }}
                  >
                    <Box />
                    {weekDays.map((day) => {
                      const today = day.toDateString() === new Date().toDateString();
                      return (
                        <Box
                          key={day.toISOString()}
                          sx={{
                            display: 'grid',
                            placeItems: 'center',
                            borderLeft: 1,
                            borderColor: 'divider',
                          }}
                        >
                          <Typography variant="caption" color="text.secondary">
                            {formatDate(day, { weekday: 'short' }, calendarLocale(language))}
                          </Typography>
                          <Typography
                            fontWeight={800}
                            color={today ? 'primary.main' : 'text.primary'}
                          >
                            {day.getDate()}
                          </Typography>
                        </Box>
                      );
                    })}
                  </Box>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: '64px repeat(7, minmax(108px, 1fr))',
                      height: (END_HOUR - START_HOUR) * HOUR_HEIGHT,
                    }}
                  >
                    <Box sx={{ position: 'relative', borderRight: 1, borderColor: 'divider' }}>
                      {Array.from({ length: END_HOUR - START_HOUR }, (_, index) => (
                        <Typography
                          key={index}
                          variant="caption"
                          color="text.secondary"
                          sx={{ position: 'absolute', top: index * HOUR_HEIGHT - 8, right: 10 }}
                        >
                          {String(START_HOUR + index).padStart(2, '0')}:00
                        </Typography>
                      ))}
                    </Box>
                    {weekDays.map((day) => {
                      const dayEvents = events.filter(
                        (event) => new Date(event.startsAt).toDateString() === day.toDateString()
                      );
                      return (
                        <Box
                          key={day.toISOString()}
                          sx={{
                            position: 'relative',
                            borderRight: 1,
                            borderColor: 'divider',
                            backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${HOUR_HEIGHT - 1}px, rgba(148,163,184,0.22) ${HOUR_HEIGHT - 1}px, rgba(148,163,184,0.22) ${HOUR_HEIGHT}px)`,
                          }}
                        >
                          {Array.from({ length: END_HOUR - START_HOUR }, (_, index) => (
                            <Box
                              component="button"
                              type="button"
                              aria-label={t('schedule.addAt', {
                                date: formatDate(
                                  day,
                                  { dateStyle: 'medium' },
                                  calendarLocale(language)
                                ),
                                hour: START_HOUR + index,
                              })}
                              key={index}
                              onClick={() => openAt(day, START_HOUR + index)}
                              sx={{
                                position: 'absolute',
                                top: index * HOUR_HEIGHT,
                                left: 0,
                                right: 0,
                                height: HOUR_HEIGHT,
                                p: 0,
                                border: 0,
                                bgcolor: 'transparent',
                                cursor: 'crosshair',
                                '&:hover': { bgcolor: 'action.hover' },
                              }}
                            />
                          ))}
                          {dayEvents.map((event) => {
                            const position = eventPosition(event);
                            const tone = CALENDAR_EVENT_TONES[event.type];
                            return (
                              <Box
                                component="button"
                                type="button"
                                key={`${event.eventId}-${event.startsAt}`}
                                onClick={() => setSelected(event)}
                                sx={{
                                  position: 'absolute',
                                  zIndex: 2,
                                  top: position.top + 2,
                                  left: 4,
                                  right: 4,
                                  height: position.height - 4,
                                  minHeight: 24,
                                  px: 1,
                                  py: 0.5,
                                  overflow: 'hidden',
                                  textAlign: 'left',
                                  border: 1,
                                  borderColor: event.conflict ? 'error.main' : tone.main,
                                  borderLeftWidth: 3,
                                  borderRadius: 0.75,
                                  bgcolor: tone.soft,
                                  color: 'text.primary',
                                  cursor: 'pointer',
                                  '&:hover': { boxShadow: 2, transform: 'translateY(-1px)' },
                                }}
                              >
                                <Typography variant="caption" fontWeight={800} noWrap>
                                  {event.title}
                                </Typography>
                                {position.height >= 42 && (
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    display="block"
                                    noWrap
                                  >
                                    {calendarTime(event.startsAt, language)} · {event.location}
                                  </Typography>
                                )}
                              </Box>
                            );
                          })}
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              ) : view === 'month' ? (
                <Box sx={{ minWidth: 760 }}>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(7, minmax(100px, 1fr))',
                      borderBottom: 1,
                      borderColor: 'divider',
                    }}
                  >
                    {weekDays.map((day) => (
                      <Typography
                        key={day.toISOString()}
                        variant="caption"
                        color="text.secondary"
                        fontWeight={700}
                        textAlign="center"
                        sx={{ py: 1 }}
                      >
                        {formatDate(day, { weekday: 'short' }, calendarLocale(language))}
                      </Typography>
                    ))}
                  </Box>
                  <Box
                    sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(100px, 1fr))' }}
                  >
                    {monthDays.map((day) => {
                      const dayEvents = events.filter(
                        (event) => new Date(event.startsAt).toDateString() === day.toDateString()
                      );
                      const outside = day.getMonth() !== cursor.getMonth();
                      return (
                        <Box
                          key={day.toISOString()}
                          onDoubleClick={() => openAt(day, 9)}
                          sx={{
                            minHeight: 126,
                            p: 0.75,
                            borderRight: 1,
                            borderBottom: 1,
                            borderColor: 'divider',
                            bgcolor: outside ? 'action.hover' : 'background.paper',
                          }}
                        >
                          <Typography
                            variant="caption"
                            color={outside ? 'text.disabled' : 'text.primary'}
                            fontWeight={700}
                          >
                            {day.getDate()}
                          </Typography>
                          <Stack spacing={0.4} sx={{ mt: 0.5 }}>
                            {dayEvents.slice(0, 3).map((event) => {
                              const tone = CALENDAR_EVENT_TONES[event.type];
                              return (
                                <Box
                                  component="button"
                                  type="button"
                                  key={`${event.eventId}-${event.startsAt}`}
                                  onClick={() => setSelected(event)}
                                  sx={{
                                    width: 1,
                                    px: 0.75,
                                    py: 0.4,
                                    border: 0,
                                    borderLeft: `3px solid ${tone.main}`,
                                    bgcolor: tone.soft,
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    borderRadius: 0.5,
                                  }}
                                >
                                  <Typography variant="caption" fontWeight={750} noWrap>
                                    {calendarTime(event.startsAt, language)} {event.title}
                                  </Typography>
                                </Box>
                              );
                            })}
                            {dayEvents.length > 3 && (
                              <Typography variant="caption" color="text.secondary">
                                +{dayEvents.length - 3}
                              </Typography>
                            )}
                          </Stack>
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              ) : (
                <Box sx={{ p: { xs: 1, md: 2 } }}>
                  {agendaGroups.length ? (
                    agendaGroups.map((group) => (
                      <Box key={group.date.toISOString()} sx={{ mb: 2 }}>
                        <Box
                          sx={{
                            position: 'sticky',
                            top: 0,
                            zIndex: 3,
                            py: 1,
                            bgcolor: 'background.paper',
                            borderBottom: 1,
                            borderColor: 'divider',
                          }}
                        >
                          <Typography fontWeight={800}>
                            {formatDate(
                              group.date,
                              { month: 'long', day: 'numeric', weekday: 'long' },
                              calendarLocale(language)
                            )}
                          </Typography>
                        </Box>
                        {group.events.map((event) => (
                          <CalendarAgendaItem
                            key={`${event.eventId}-${event.startsAt}`}
                            event={event}
                            onOpen={() => setSelected(event)}
                            onRespond={(response) => respond(event, response)}
                          />
                        ))}
                      </Box>
                    ))
                  ) : (
                    <Box
                      sx={{
                        minHeight: 320,
                        display: 'grid',
                        placeItems: 'center',
                        textAlign: 'center',
                      }}
                    >
                      <Box>
                        <CircleAlert size={28} />
                        <Typography fontWeight={800} sx={{ mt: 1 }}>
                          {t('schedule.noEvents')}
                        </Typography>
                        <Typography color="text.secondary">
                          {t('schedule.noEventsDescription')}
                        </Typography>
                      </Box>
                    </Box>
                  )}
                </Box>
              )}
            </Box>
          </Box>
        )}
      </Box>

      <CalendarEventDialog
        open={Boolean(createState)}
        initialStart={createState?.start}
        initialType={createState?.type}
        onClose={() => setCreateState(null)}
      />
      <CalendarEventDialog
        open={Boolean(editing)}
        event={editing}
        onClose={() => setEditing(null)}
        onSaved={setSelected}
      />
      <CalendarEventDrawer
        event={selected}
        open={Boolean(selected)}
        canEdit={
          selected?.organizerPersonPublicId
            ? selected.organizerPersonPublicId === auth.user?.personPublicId
            : selected?.organizerUserId === auth.user?.userId
        }
        onClose={clearEventSelection}
        onEdit={() => {
          setEditing(selected);
          clearEventSelection();
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
