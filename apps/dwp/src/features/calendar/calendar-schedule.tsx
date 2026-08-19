import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { CalendarPlus, Focus, GripVertical, Info, Layers3 } from 'lucide-react';
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  cancelCalendarEvent,
  dwaionHandoffStrings,
  dwaionHandoffText,
  getCalendarEvents,
  getCalendars,
  parseDwaionHandoff,
  respondToCalendarEvent,
  updateCalendarEvent,
  useAuth,
  useToast,
} from '@dwp-frontend/shared-utils';
import { ActionButton, ConfirmDialog, PageCanvas } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import LinearProgress from '@mui/material/LinearProgress';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';

import { CalendarEventDialog } from './calendar-event-dialog';
import { CalendarEventDrawer, CalendarPageHeading } from './calendar-components';
import { CalendarInteractiveGrid, type CalendarRange } from './calendar-interactive-grid';

import type {
  CalendarEvent,
  CalendarEventType,
  CalendarResponseStatus,
  UpdateCalendarEventInput,
} from '@dwp-frontend/shared-utils';

type CreateState = Readonly<{
  start: string;
  end?: string;
  type: CalendarEventType;
  title?: string;
  attendeeEmails?: string[];
  fromDwaion?: boolean;
}>;

function initialRange(): CalendarRange {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - ((from.getDay() || 7) - 1));
  const to = new Date(from);
  to.setDate(to.getDate() + 7);
  return { from: from.toISOString(), to: to.toISOString() };
}

function updateInput(
  event: CalendarEvent,
  change: Readonly<{ startsAt: string; endsAt: string; allDay: boolean }>
): UpdateCalendarEventInput {
  return {
    title: event.title,
    description: event.description ?? null,
    type: event.type,
    startsAt: change.startsAt,
    endsAt: change.endsAt,
    timeZone: event.timeZone,
    allDay: change.allDay,
    location: event.location ?? null,
    conferenceUrl: event.conferenceUrl ?? null,
    visibility: event.visibility,
    recurrence: event.recurrence,
    recurrenceInterval: event.recurrenceInterval,
    recurrenceUntil: event.recurrenceUntil ?? null,
    responseRequired: event.responseRequired,
    attendees: event.attendees.map((attendee) => ({
      userId: attendee.userId ?? null,
      personPublicId: attendee.personPublicId ?? null,
      email: attendee.email,
      name: attendee.name,
      type: attendee.type,
    })),
    resourceId: event.resource?.resourceId ?? null,
    version: event.version,
  };
}

export function CalendarSchedule() {
  const { t, i18n } = useTranslation('calendar');
  const auth = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const compact = useMediaQuery('(max-width:899.95px)', { noSsr: true });
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [range, setRange] = useState<CalendarRange>(initialRange);
  const [navigateDate, setNavigateDate] = useState(new Date());
  const [selectedCalendars, setSelectedCalendars] = useState<string[]>([]);
  const [selected, setSelected] = useState<CalendarEvent | null>(null);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [cancelling, setCancelling] = useState<CalendarEvent | null>(null);
  const [createState, setCreateState] = useState<CreateState | null>(null);
  const requestedEventId = searchParams.get('event');
  const language = i18n.resolvedLanguage ?? i18n.language;
  const dwaionHandoff = useMemo(
    () => parseDwaionHandoff(location.state, 'CALENDAR.EVENT.CREATE'),
    [location.state]
  );

  const eventsQuery = useQuery({
    queryKey: ['calendar', 'events', range.from, range.to],
    queryFn: () => getCalendarEvents(range.from, range.to),
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
    if (!requestedType && !dwaionHandoff) return;
    setCreateState({
      start: dwaionHandoffText(dwaionHandoff, 'startsAt') ?? new Date().toISOString(),
      end: dwaionHandoffText(dwaionHandoff, 'endsAt') ?? undefined,
      type: requestedType === 'focus' ? 'FOCUS' : 'MEETING',
      title: dwaionHandoffText(dwaionHandoff, 'title') ?? undefined,
      attendeeEmails: dwaionHandoffStrings(dwaionHandoff, 'attendees'),
      fromDwaion: Boolean(dwaionHandoff),
    });
    const next = new URLSearchParams(searchParams);
    next.delete('create');
    const search = next.toString();
    navigate(
      { pathname: location.pathname, search: search ? `?${search}` : '' },
      { replace: true, state: null }
    );
  }, [dwaionHandoff, location.pathname, navigate, searchParams]);

  useEffect(() => {
    if (!requestedEventId || !eventsQuery.data) return;
    const requested = eventsQuery.data.find((event) => event.eventId === requestedEventId);
    if (requested) setSelected(requested);
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
  const moveMutation = useMutation({
    mutationFn: async ({
      event,
      change,
    }: {
      event: CalendarEvent;
      change: Readonly<{ startsAt: string; endsAt: string; allDay: boolean }>;
      revert: () => void;
    }) => updateCalendarEvent(event.eventId, updateInput(event, change)),
    onSuccess: async (saved) => {
      setSelected((current) => (current?.eventId === saved.eventId ? saved : current));
      await queryClient.invalidateQueries({ queryKey: ['calendar'] });
      toast.success(t('schedule.moveSuccess'));
    },
    onError: (_error, variables) => {
      variables.revert();
      toast.error(t('schedule.moveError'));
    },
  });

  const canManage = useCallback(
    (event: CalendarEvent) => {
      const organizer = event.organizerPersonPublicId
        ? event.organizerPersonPublicId === auth.user?.personPublicId
        : event.organizerUserId === auth.user?.userId;
      return organizer && event.status !== 'CANCELLED';
    },
    [auth.user?.personPublicId, auth.user?.userId]
  );
  const canMove = useCallback(
    (event: CalendarEvent) => canManage(event) && event.recurrence === 'NONE',
    [canManage]
  );
  const events = useMemo(
    () =>
      (eventsQuery.data ?? []).filter(
        (event) => !selectedCalendars.length || selectedCalendars.includes(event.calendarId)
      ),
    [eventsQuery.data, selectedCalendars]
  );
  const openNow = (type: CalendarEventType) => {
    const start = new Date();
    start.setSeconds(0, 0);
    start.setMinutes(start.getMinutes() < 30 ? 30 : 60);
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
          <>
            <ActionButton
              intent="secondary"
              startIcon={<Focus size={17} />}
              onClick={() => openNow('FOCUS')}
            >
              {t('actions.addFocus')}
            </ActionButton>
            <ActionButton
              intent="primary"
              startIcon={<CalendarPlus size={18} />}
              onClick={() => openNow('MEETING')}
            >
              {t('actions.newEvent')}
            </ActionButton>
          </>
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
        {eventsQuery.isFetching && <LinearProgress aria-label={t('schedule.loading')} />}
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
              gridTemplateColumns: { xs: 'minmax(0, 1fr)', xl: '252px minmax(0, 1fr)' },
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
                value={dayjs(navigateDate)}
                onChange={(value) => value && setNavigateDate(value.toDate())}
                sx={{ width: 1, '& .MuiPickersCalendarHeader-root': { px: 1 } }}
              />
              <Divider sx={{ my: 1.5 }} />
              <Stack direction="row" alignItems="center" justifyContent="space-between" px={1}>
                <Stack direction="row" spacing={0.75} alignItems="center">
                  <Layers3 size={15} />
                  <Typography variant="overline" color="text.secondary">
                    {t('schedule.myCalendars')}
                  </Typography>
                </Stack>
                <Chip size="small" label={selectedCalendars.length} />
              </Stack>
              <Stack sx={{ mt: 0.5 }}>
                {calendarsQuery.isLoading
                  ? Array.from({ length: 3 }, (_, index) => <Skeleton key={index} height={40} />)
                  : (calendarsQuery.data ?? []).map((calendar) => (
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
                            sx={{
                              color: calendar.color,
                              '&.Mui-checked': { color: calendar.color },
                            }}
                          />
                        }
                        label={<Typography variant="body2">{calendar.name}</Typography>}
                        sx={{ mx: 0, px: 0.5 }}
                      />
                    ))}
              </Stack>
              <Box sx={{ mt: 2, p: 1.25, bgcolor: 'action.hover', borderRadius: 1 }}>
                <Stack direction="row" spacing={0.75} alignItems="flex-start">
                  <GripVertical size={15} />
                  <Typography variant="caption" color="text.secondary">
                    {t('schedule.dragHint')}
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={0.75} alignItems="flex-start" sx={{ mt: 1 }}>
                  <Info size={15} />
                  <Typography variant="caption" color="text.secondary">
                    {t('schedule.recurrenceMoveHint')}
                  </Typography>
                </Stack>
              </Box>
            </Box>
            <CalendarInteractiveGrid
              events={events}
              language={language}
              compact={compact}
              loading={eventsQuery.isLoading}
              navigateDate={navigateDate}
              canMove={canMove}
              onRangeChange={(next) =>
                setRange((current) =>
                  current.from === next.from && current.to === next.to ? current : next
                )
              }
              onCreateRange={(start, end, _allDay) =>
                setCreateState({
                  start: start.toISOString(),
                  end: end.toISOString(),
                  type: 'MEETING',
                })
              }
              onOpenEvent={setSelected}
              onMoveEvent={(event, change, revert) =>
                moveMutation.mutate({ event, change, revert })
              }
            />
          </Box>
        )}
      </Box>

      <CalendarEventDialog
        open={Boolean(createState)}
        initialStart={createState?.start}
        initialEnd={createState?.end}
        initialType={createState?.type}
        initialTitle={createState?.title}
        initialAttendeeEmails={createState?.attendeeEmails}
        fromDwaion={createState?.fromDwaion}
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
        canEdit={Boolean(selected && canManage(selected))}
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
