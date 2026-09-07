import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  cancelCalendarEvent,
  dwaionHandoffStrings,
  dwaionHandoffText,
  getCalendarEvents,
  getCalendarPolicy,
  getCalendars,
  parseDwaionHandoff,
  respondToCalendarEvent,
  trashCalendarEvent,
  updateCalendarEventPreference,
  updateCalendarSubscription,
  updateCalendarEvent,
  usePermissions,
  useToast,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  ConfirmDialog,
  foundationTokens,
  LiveStatus,
  OperationalContextBar,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import useMediaQuery from '@mui/material/useMediaQuery';
import { alpha } from '@mui/material/styles';

import { CalendarEventDialog } from './calendar-event-dialog';
import { CalendarEventDrawer } from './calendar-components';
import { CalendarCanvas } from './calendar-experience';
import { CalendarInteractiveGrid, type CalendarRange } from './calendar-interactive-grid';
import {
  calendarReadSourceData,
  calendarReadSourceState,
  combineCalendarReadSourceStates,
  retryRecoverableCalendarRead,
} from './calendar-read-source-state';
import { CalendarShareDialog } from './calendar-share-dialog';
import { CalendarSourcePanel, CalendarSourcePicker } from './calendar-source-rail';
import { CalendarScheduleChrome } from './calendar-schedule-chrome';
import { CalendarCommandPaletteOverlay } from './calendar-workspace-overlays';
import {
  calendarCanChangeSelection,
  eventCapability,
  normalizeCalendarSelection,
} from './calendar-source-model';
import {
  calendarScheduleCalendarIds,
  calendarScheduleDate,
  calendarScheduleDateValue,
  calendarInternalPath,
  calendarScheduleSavedConfiguration,
  calendarScheduleSearchParams,
  calendarScheduleStateFromSavedView,
  calendarScheduleView,
  isCalendarCommandShortcut,
  type CalendarScheduleView,
} from './calendar-schedule-state';

import type {
  CalendarEvent,
  CalendarEventType,
  CalendarResponseStatus,
  CalendarSummary,
  UpdateCalendarEventInput,
} from '@dwp-frontend/shared-utils';

const CALENDAR_SURFACE_RADIUS = `${foundationTokens.radius.surface}px`;

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

function sameCalendarSelection(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
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
    importance: event.importance ?? 'NORMAL',
    version: event.version,
  };
}

export function CalendarSchedule() {
  const { t, i18n } = useTranslation('calendar');
  const { hasPermission } = usePermissions();
  const toast = useToast();
  const queryClient = useQueryClient();
  const compact = useMediaQuery('(max-width:899.95px)', { noSsr: true });
  const mobileSourcePicker = useMediaQuery('(max-width:599.95px)', { noSsr: true });
  const desktopSources = useMediaQuery('(min-width:1280px)', { noSsr: true });
  const location = useLocation();
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();
  const routeSearchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const [range, setRange] = useState<CalendarRange>(initialRange);
  const [viewState, setView] = useState<CalendarScheduleView>(() =>
    calendarScheduleView(routeSearchParams.get('view'), compact ? 'agenda' : 'week')
  );
  const [navigateDateState, setNavigateDate] = useState(() =>
    calendarScheduleDate(routeSearchParams.get('date'))
  );
  const [selectedCalendarsState, setSelectedCalendars] = useState<string[]>([]);
  const [calendarSelectionInitialized, setCalendarSelectionInitialized] = useState(false);
  const [selected, setSelected] = useState<CalendarEvent | null>(null);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [cancelling, setCancelling] = useState<CalendarEvent | null>(null);
  const [trashing, setTrashing] = useState<CalendarEvent | null>(null);
  const [createState, setCreateState] = useState<CreateState | null>(null);
  const [sourcePickerOpen, setSourcePickerOpen] = useState(false);
  const [sourcesCollapsed, setSourcesCollapsed] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [sharingCalendar, setSharingCalendar] = useState<CalendarSummary | null>(null);
  const requestedEventId = routeSearchParams.get('event');
  const hasExplicitScheduleState =
    routeSearchParams.has('view') ||
    routeSearchParams.has('date') ||
    routeSearchParams.has('calendars');
  const view = routeSearchParams.has('view')
    ? calendarScheduleView(routeSearchParams.get('view'), viewState)
    : viewState;
  const navigateDate = routeSearchParams.has('date')
    ? calendarScheduleDate(routeSearchParams.get('date'), navigateDateState)
    : navigateDateState;
  const language = i18n.resolvedLanguage ?? i18n.language;
  const canCreateGranted = hasPermission('APP.CALENDAR', 'CREATE');
  const canUpdateGranted = hasPermission('APP.CALENDAR', 'UPDATE');
  const dwaionHandoff = useMemo(
    () => parseDwaionHandoff(location.state, 'CALENDAR.EVENT.CREATE'),
    [location.state]
  );

  const eventsQuery = useQuery({
    queryKey: ['calendar', 'events', range.from, range.to],
    queryFn: () => getCalendarEvents(range.from, range.to),
    staleTime: 20_000,
    retry: retryRecoverableCalendarRead,
  });
  const calendarsQuery = useQuery({
    queryKey: ['calendar', 'calendars'],
    queryFn: getCalendars,
    staleTime: 60_000,
    retry: retryRecoverableCalendarRead,
  });
  const policyQuery = useQuery({
    queryKey: ['calendar', 'policy'],
    queryFn: getCalendarPolicy,
    staleTime: 5 * 60_000,
    retry: retryRecoverableCalendarRead,
  });
  const eventsState = calendarReadSourceState({
    data: eventsQuery.data,
    error: eventsQuery.error,
    failureCount: eventsQuery.failureCount,
    failureReason: eventsQuery.failureReason,
    isError: eventsQuery.isError,
    isPending: eventsQuery.isPending,
  });
  const calendarsState = calendarReadSourceState({
    data: calendarsQuery.data,
    error: calendarsQuery.error,
    failureCount: calendarsQuery.failureCount,
    failureReason: calendarsQuery.failureReason,
    isError: calendarsQuery.isError,
    isPending: calendarsQuery.isPending,
  });
  const policyState = calendarReadSourceState({
    data: policyQuery.data,
    error: policyQuery.error,
    failureCount: policyQuery.failureCount,
    failureReason: policyQuery.failureReason,
    isError: policyQuery.isError,
    isPending: policyQuery.isPending,
  });
  const coreReadState = combineCalendarReadSourceStates([eventsState, calendarsState, policyState]);
  const authorityDenied = coreReadState === 'DENIED';
  const readState = coreReadState;
  const eventsData =
    readState === 'DENIED' ? undefined : calendarReadSourceData(eventsState, eventsQuery.data);
  const calendarsData =
    readState === 'DENIED'
      ? undefined
      : calendarReadSourceData(calendarsState, calendarsQuery.data);
  const policyData =
    readState === 'DENIED' ? undefined : calendarReadSourceData(policyState, policyQuery.data);
  const scheduleWritable = readState === 'READY';
  const canCreate = canCreateGranted && scheduleWritable;
  const canUpdate = canUpdateGranted && scheduleWritable;
  const selectedCalendars = useMemo(() => {
    if (!calendarsData) return [];
    const configured = routeSearchParams.has('calendars')
      ? (calendarScheduleCalendarIds(routeSearchParams.get('calendars')) ?? [])
      : selectedCalendarsState;
    return normalizeCalendarSelection(calendarsData, configured);
  }, [calendarsData, routeSearchParams, selectedCalendarsState]);

  useEffect(() => {
    if (calendarSelectionInitialized || !calendarsData) return;
    const configured = calendarScheduleCalendarIds(routeSearchParams.get('calendars'));
    setSelectedCalendars(normalizeCalendarSelection(calendarsData, configured));
    setCalendarSelectionInitialized(true);
  }, [calendarSelectionInitialized, calendarsData, routeSearchParams]);

  useEffect(() => {
    const requestedView = routeSearchParams.get('view');
    if (requestedView !== null) {
      const nextView = calendarScheduleView(requestedView, compact ? 'agenda' : 'week');
      setView((current) => (current === nextView ? current : nextView));
    }

    const requestedDate = routeSearchParams.get('date');
    if (requestedDate !== null) {
      const nextDate = calendarScheduleDate(requestedDate);
      setNavigateDate((current) =>
        calendarScheduleDateValue(current) === calendarScheduleDateValue(nextDate)
          ? current
          : nextDate
      );
    }

    const requestedCalendars = routeSearchParams.get('calendars');
    if (requestedCalendars === null || !calendarSelectionInitialized || !calendarsData) {
      return;
    }
    const configured = calendarScheduleCalendarIds(requestedCalendars);
    if (configured === null) return;
    const nextCalendars = normalizeCalendarSelection(calendarsData, configured);
    setSelectedCalendars((current) =>
      sameCalendarSelection(current, nextCalendars) ? current : nextCalendars
    );
  }, [calendarSelectionInitialized, calendarsData, compact, routeSearchParams]);

  useEffect(() => {
    const requestedType = routeSearchParams.get('create');
    if (!requestedType && !dwaionHandoff) return;
    if (canCreateGranted && !scheduleWritable) return;
    if (canCreate) {
      setCreateState({
        start: dwaionHandoffText(dwaionHandoff, 'startsAt') ?? new Date().toISOString(),
        end: dwaionHandoffText(dwaionHandoff, 'endsAt') ?? undefined,
        type: requestedType === 'focus' ? 'FOCUS' : 'MEETING',
        title: dwaionHandoffText(dwaionHandoff, 'title') ?? undefined,
        attendeeEmails: dwaionHandoffStrings(dwaionHandoff, 'attendees'),
        fromDwaion: Boolean(dwaionHandoff),
      });
    }
    const next = new URLSearchParams(location.search);
    next.delete('create');
    const search = next.toString();
    navigate(
      { pathname: location.pathname, search: search ? `?${search}` : '' },
      { replace: true, state: null }
    );
  }, [
    canCreate,
    canCreateGranted,
    dwaionHandoff,
    location.pathname,
    location.search,
    navigate,
    routeSearchParams,
    scheduleWritable,
  ]);

  useEffect(() => {
    if (!requestedEventId || !eventsData) return;
    const requested = eventsData.find((event) => event.eventId === requestedEventId);
    if (requested) setSelected(requested);
  }, [eventsData, requestedEventId]);

  useEffect(() => {
    if (scheduleWritable) return;
    setCreateState(null);
    setEditing(null);
    setCancelling(null);
    setTrashing(null);
    if (!authorityDenied) return;
    setSelected(null);
    setSourcePickerOpen(false);
    setSharingCalendar(null);
    setCommandPaletteOpen(false);
  }, [authorityDenied, scheduleWritable]);

  useEffect(() => {
    const openCommands = (event: KeyboardEvent) => {
      if (!isCalendarCommandShortcut(event)) return;
      event.preventDefault();
      setCommandPaletteOpen(true);
    };
    window.addEventListener('keydown', openCommands);
    return () => window.removeEventListener('keydown', openCommands);
  }, []);

  const clearEventSelection = () => {
    setSelected(null);
    if (!requestedEventId) return;
    const next = new URLSearchParams(location.search);
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
  const trashMutation = useMutation({
    mutationFn: (event: CalendarEvent) =>
      trashCalendarEvent(event.eventId, event.version, t('event.userDeletionReason')),
    onSuccess: async () => {
      clearEventSelection();
      setTrashing(null);
      await queryClient.invalidateQueries({ queryKey: ['calendar'] });
      toast.success(t('event.trashed'));
    },
    onError: () => toast.error(t('event.trashError')),
  });
  const preferenceMutation = useMutation({
    mutationFn: (event: CalendarEvent) =>
      updateCalendarEventPreference(event.eventId, {
        starred: !event.starred,
        hidden: false,
        version: event.preferenceVersion ?? 0,
      }),
    onSuccess: async (preference, event) => {
      setSelected((current) =>
        current?.eventId === event.eventId
          ? {
              ...current,
              starred: preference.starred,
              preferenceVersion: preference.version,
            }
          : current
      );
      await queryClient.invalidateQueries({ queryKey: ['calendar', 'events'] });
      toast.success(t(preference.starred ? 'event.starred' : 'event.unstarred'));
    },
    onError: () => toast.error(t('event.starError')),
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
    (event: CalendarEvent) =>
      canUpdate && event.status !== 'CANCELLED' && eventCapability(event, 'canEdit'),
    [canUpdate]
  );
  const canDelete = useCallback(
    (event: CalendarEvent) =>
      canUpdate && event.status !== 'CANCELLED' && eventCapability(event, 'canDelete'),
    [canUpdate]
  );
  const canMove = useCallback(
    (event: CalendarEvent) =>
      !moveMutation.isPending && canManage(event) && event.recurrence === 'NONE',
    [canManage, moveMutation.isPending]
  );
  const events = useMemo(() => {
    const source = eventsData ?? [];
    if (!calendarSelectionInitialized || !calendarsData) {
      return [];
    }
    return source.filter((event) => selectedCalendars.includes(event.calendarId));
  }, [calendarSelectionInitialized, calendarsData, eventsData, selectedCalendars]);
  const syncScheduleState = useCallback(
    (next: Readonly<{ view: CalendarScheduleView; date: Date; calendarIds: readonly string[] }>) =>
      setSearchParams(calendarScheduleSearchParams(new URLSearchParams(location.search), next)),
    [location.search, setSearchParams]
  );
  const selectCalendarState = useCallback(
    (nextView: CalendarScheduleView, nextDate: Date) => {
      if (
        nextView === view &&
        calendarScheduleDateValue(nextDate) === calendarScheduleDateValue(navigateDate)
      ) {
        return;
      }
      setView(nextView);
      setNavigateDate(nextDate);
      if (calendarSelectionInitialized) {
        syncScheduleState({
          view: nextView,
          date: nextDate,
          calendarIds: selectedCalendars,
        });
      }
    },
    [calendarSelectionInitialized, navigateDate, selectedCalendars, syncScheduleState, view]
  );
  const selectDate = useCallback(
    (nextDate: Date) => {
      if (calendarScheduleDateValue(nextDate) === calendarScheduleDateValue(navigateDate)) return;
      setNavigateDate(nextDate);
      if (calendarSelectionInitialized) {
        syncScheduleState({ view, date: nextDate, calendarIds: selectedCalendars });
      }
    },
    [calendarSelectionInitialized, navigateDate, selectedCalendars, syncScheduleState, view]
  );
  const selectCalendars = useCallback(
    (nextCalendarIds: string[]) => {
      const normalized = calendarsData
        ? normalizeCalendarSelection(calendarsData, nextCalendarIds)
        : [];
      setSelectedCalendars(normalized);
      syncScheduleState({ view, date: navigateDate, calendarIds: normalized });
    },
    [calendarsData, navigateDate, syncScheduleState, view]
  );
  const subscriptionMutation = useMutation({
    mutationFn: ({
      calendar,
      selected: nextSelected,
      favorite: nextFavorite,
    }: {
      calendar: CalendarSummary;
      selected: boolean;
      favorite: boolean;
      previousCalendarIds: string[];
    }) =>
      updateCalendarSubscription(calendar.calendarId, {
        selected: nextSelected,
        favorite: nextFavorite,
        displayOrder: calendar.displayOrder ?? 0,
        version: calendar.subscriptionVersion ?? 0,
      }),
    onSuccess: (subscription, variables) => {
      queryClient.setQueryData<CalendarSummary[]>(['calendar', 'calendars'], (current) =>
        current?.map((calendar) =>
          calendar.calendarId === variables.calendar.calendarId
            ? {
                ...calendar,
                selected: subscription.selected,
                favorite: subscription.favorite,
                displayOrder: subscription.displayOrder,
                subscriptionVersion: subscription.version,
              }
            : calendar
        )
      );
      toast.success(t('sources.updated'));
    },
    onError: async (_error, variables) => {
      selectCalendars(variables.previousCalendarIds);
      await queryClient.invalidateQueries({ queryKey: ['calendar', 'calendars'] });
      toast.error(t('sources.updateError'));
    },
  });
  const changeCalendarSelection = useCallback(
    (calendar: CalendarSummary, nextSelected: boolean) => {
      if (subscriptionMutation.isPending || !scheduleWritable) return;
      if (!calendarCanChangeSelection(calendar, nextSelected)) return;
      const nextCalendarIds = nextSelected
        ? [...selectedCalendars, calendar.calendarId]
        : selectedCalendars.filter((calendarId) => calendarId !== calendar.calendarId);
      const previousCalendarIds = [...selectedCalendars];
      selectCalendars(nextCalendarIds);
      subscriptionMutation.mutate({
        calendar,
        selected: nextSelected,
        favorite: calendar.favorite ?? false,
        previousCalendarIds,
      });
    },
    [scheduleWritable, selectCalendars, selectedCalendars, subscriptionMutation]
  );
  const changeCalendarFavorite = useCallback(
    (calendar: CalendarSummary, favorite: boolean) => {
      if (subscriptionMutation.isPending || !scheduleWritable) return;
      subscriptionMutation.mutate({
        calendar,
        selected: selectedCalendars.includes(calendar.calendarId),
        favorite,
        previousCalendarIds: [...selectedCalendars],
      });
    },
    [scheduleWritable, selectedCalendars, subscriptionMutation]
  );
  const savedViewConfiguration = useMemo(
    () =>
      calendarScheduleSavedConfiguration({
        view,
        date: navigateDate,
        calendarIds: selectedCalendars,
      }),
    [navigateDate, selectedCalendars, view]
  );
  const applySavedView = useCallback(
    (configuration: Record<string, unknown>) => {
      const state = calendarScheduleStateFromSavedView(configuration, {
        view,
        date: navigateDate,
        calendarIds: selectedCalendars,
      });
      const next = {
        ...state,
        calendarIds: normalizeCalendarSelection(calendarsData ?? [], state.calendarIds),
      };
      setView(next.view);
      setNavigateDate(next.date);
      setSelectedCalendars(next.calendarIds);
      syncScheduleState(next);
    },
    [calendarsData, navigateDate, selectedCalendars, syncScheduleState, view]
  );
  const initialWritableCalendarId = useMemo(
    () =>
      calendarsData?.find(
        (calendar) =>
          selectedCalendars.includes(calendar.calendarId) &&
          calendar.capabilities?.canCreateEvents === true
      )?.calendarId ?? null,
    [calendarsData, selectedCalendars]
  );
  const openNow = (type: CalendarEventType) => {
    if (!canCreate) return;
    const start = new Date();
    start.setSeconds(0, 0);
    start.setMinutes(start.getMinutes() < 30 ? 30 : 60);
    setCreateState({ start: start.toISOString(), type });
  };
  const respond = (event: CalendarEvent, response: 'ACCEPTED' | 'TENTATIVE' | 'DECLINED') =>
    respondMutation.mutate({ eventId: event.eventId, response });
  return (
    <CalendarCanvas archetype="temporal">
      <CalendarScheduleChrome
        canCreate={canCreate}
        sourcesAvailable={Boolean(calendarsData)}
        commandPaletteOpen={commandPaletteOpen}
        desktopSources={desktopSources}
        sourcesCollapsed={sourcesCollapsed}
        hasExplicitScheduleState={hasExplicitScheduleState}
        view={view}
        savedViewConfiguration={savedViewConfiguration}
        onOpenCommands={() => setCommandPaletteOpen(true)}
        onCreate={openNow}
        onToggleSources={() => setSourcesCollapsed((current) => !current)}
        onOpenSources={() => setSourcePickerOpen(true)}
        onApplySavedView={applySavedView}
      />

      {(readState === 'STALE' || readState === 'DENIED' || readState === 'UNAVAILABLE') && (
        <Box
          data-testid="calendar-read-state"
          data-calendar-read-state={readState}
          sx={{ mb: 1.5 }}
        >
          <OperationalContextBar
            label={t('shell.calendar.name')}
            items={[]}
            status={
              <LiveStatus
                state={readState === 'STALE' ? 'stale' : 'degraded'}
                label={t('shell.calendar.name')}
                detail={t(
                  readState === 'STALE'
                    ? 'readState.stale'
                    : readState === 'DENIED'
                      ? 'readState.denied'
                      : 'readState.unavailable'
                )}
              />
            }
            actions={
              <ActionButton
                intent="quiet"
                onClick={() => {
                  void eventsQuery.refetch();
                  void calendarsQuery.refetch();
                  void policyQuery.refetch();
                }}
              >
                {t('actions.retry')}
              </ActionButton>
            }
          />
        </Box>
      )}

      <Box
        data-testid="calendar-schedule-surface"
        data-calendar-experience="schedule"
        data-location-search={location.search}
        sx={(theme) => ({
          bgcolor: 'background.paper',
          border: 1,
          borderColor: alpha(theme.palette.divider, 0.78),
          borderRadius: CALENDAR_SURFACE_RADIUS,
          overflow: 'hidden',
          boxShadow: 'none',
          '@media (forced-colors: active)': {
            borderColor: 'CanvasText',
            boxShadow: 'none',
          },
        })}
      >
        {(eventsQuery.isFetching || calendarsQuery.isFetching || moveMutation.isPending) && (
          <LinearProgress aria-label={t('schedule.loading')} />
        )}
        {!calendarsData && calendarsState !== 'LOADING' ? (
          <Alert
            severity="error"
            action={
              <ActionButton
                intent="quiet"
                onClick={() => {
                  void calendarsQuery.refetch();
                }}
              >
                {t('actions.retry')}
              </ActionButton>
            }
          >
            {t('sources.failClosedError')}
          </Alert>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns:
                desktopSources && !sourcesCollapsed ? '264px minmax(0, 1fr)' : 'minmax(0, 1fr)',
            }}
          >
            <Box
              id="calendar-source-panel"
              data-testid="calendar-source-panel"
              component="aside"
              sx={{
                display: desktopSources && !sourcesCollapsed ? 'block' : 'none',
                borderRight: 1,
                borderColor: 'divider',
                minHeight: 0,
                bgcolor: 'background.default',
              }}
            >
              <CalendarSourcePanel
                calendars={calendarsData ?? []}
                selectedCalendarIds={selectedCalendars}
                date={navigateDate}
                loading={calendarsQuery.isLoading}
                error={!calendarsData && calendarsState !== 'LOADING'}
                busy={subscriptionMutation.isPending || !scheduleWritable}
                onDateChange={selectDate}
                onSelectionChange={changeCalendarSelection}
                onFavoriteChange={changeCalendarFavorite}
                onManageSharing={setSharingCalendar}
                onRetry={() => void calendarsQuery.refetch()}
              />
            </Box>
            {!eventsData && eventsState !== 'LOADING' ? (
              <Box sx={{ minWidth: 0, p: { xs: 1.5, sm: 2 } }}>
                <Alert
                  severity="error"
                  action={
                    <ActionButton intent="quiet" onClick={() => void eventsQuery.refetch()}>
                      {t('actions.retry')}
                    </ActionButton>
                  }
                >
                  {t('schedule.loadError')}
                </Alert>
              </Box>
            ) : (
              <CalendarInteractiveGrid
                events={events}
                language={language}
                compact={compact}
                loading={eventsQuery.isLoading || calendarsQuery.isLoading}
                view={view}
                navigateDate={navigateDate}
                weekStart={policyData?.weekStart ?? 1}
                workingDayStart={policyData?.workingDayStart ?? '08:00'}
                workingDayEnd={policyData?.workingDayEnd ?? '19:00'}
                canCreate={canCreate}
                interactionLocked={moveMutation.isPending}
                canMove={canMove}
                onRangeChange={(next) =>
                  setRange((current) =>
                    current.from === next.from && current.to === next.to ? current : next
                  )
                }
                onCalendarStateChange={selectCalendarState}
                onCreateRange={(start, end, _allDay) => {
                  if (!canCreate) return;
                  setCreateState({
                    start: start.toISOString(),
                    end: end.toISOString(),
                    type: 'MEETING',
                  });
                }}
                onOpenEvent={setSelected}
                onMoveEvent={(event, change, revert) => {
                  if (!canMove(event)) return revert();
                  moveMutation.mutate({ event, change, revert });
                }}
              />
            )}
          </Box>
        )}
      </Box>

      <CalendarCommandPaletteOverlay
        open={commandPaletteOpen}
        canCreate={canCreate}
        onClose={() => setCommandPaletteOpen(false)}
        onCreate={openNow}
        onNavigate={(path) =>
          navigate(
            calendarInternalPath(path, routeSearchParams, {
              preserveScheduleState: path === '/calendar/schedule',
            })
          )
        }
      />

      <CalendarSourcePicker
        open={sourcePickerOpen}
        mobile={mobileSourcePicker}
        calendars={calendarsData ?? []}
        selectedCalendarIds={selectedCalendars}
        date={navigateDate}
        loading={calendarsQuery.isLoading}
        error={!calendarsData && calendarsState !== 'LOADING'}
        busy={subscriptionMutation.isPending || !scheduleWritable}
        onClose={() => setSourcePickerOpen(false)}
        onDateChange={selectDate}
        onSelectionChange={changeCalendarSelection}
        onFavoriteChange={changeCalendarFavorite}
        onManageSharing={(calendar) => {
          setSourcePickerOpen(false);
          setSharingCalendar(calendar);
        }}
        onRetry={() => void calendarsQuery.refetch()}
      />
      <CalendarShareDialog
        calendar={sharingCalendar}
        open={Boolean(sharingCalendar)}
        onClose={() => setSharingCalendar(null)}
      />

      {canCreate && (
        <CalendarEventDialog
          open={Boolean(createState)}
          initialStart={createState?.start}
          initialEnd={createState?.end}
          initialType={createState?.type}
          initialTitle={createState?.title}
          initialAttendeeEmails={createState?.attendeeEmails}
          initialCalendarId={initialWritableCalendarId}
          fromDwaion={createState?.fromDwaion}
          onClose={() => setCreateState(null)}
        />
      )}
      {canUpdate && (
        <CalendarEventDialog
          open={Boolean(editing)}
          event={editing}
          onClose={() => setEditing(null)}
          onSaved={setSelected}
        />
      )}
      <CalendarEventDrawer
        event={selected}
        open={Boolean(selected)}
        canEdit={Boolean(selected && canManage(selected))}
        canDelete={Boolean(selected && canDelete(selected))}
        canStar={Boolean(selected && canUpdate && eventCapability(selected, 'canStar'))}
        starBusy={preferenceMutation.isPending}
        onClose={clearEventSelection}
        onEdit={
          canUpdate
            ? () => {
                setEditing(selected);
                clearEventSelection();
              }
            : undefined
        }
        onCancel={() => selected && canDelete(selected) && setCancelling(selected)}
        onTrash={() => selected && canDelete(selected) && setTrashing(selected)}
        onToggleStar={() => selected && preferenceMutation.mutate(selected)}
        onRespond={
          selected && canUpdate && eventCapability(selected, 'canRespond')
            ? (response) => respond(selected, response)
            : undefined
        }
      />
      <ConfirmDialog
        open={canUpdate && Boolean(cancelling)}
        title={t('event.cancelTitle')}
        description={t('event.cancelDescription', { title: cancelling?.title })}
        cancelLabel={t('actions.close')}
        confirmLabel={t('event.cancelEvent')}
        confirmingLabel={t('event.cancelling')}
        intent="danger"
        busy={cancelMutation.isPending}
        onClose={() => setCancelling(null)}
        onConfirm={() => {
          if (canUpdate && cancelling) cancelMutation.mutate(cancelling);
        }}
      />
      <ConfirmDialog
        open={Boolean(trashing)}
        title={t('event.trashTitle')}
        description={t('event.trashDescription', { title: trashing?.title })}
        cancelLabel={t('actions.close')}
        confirmLabel={t('event.moveToTrash')}
        confirmingLabel={t('event.trashing')}
        intent="danger"
        busy={trashMutation.isPending}
        onClose={() => setTrashing(null)}
        onConfirm={() => {
          if (trashing && canDelete(trashing)) trashMutation.mutate(trashing);
        }}
      />
    </CalendarCanvas>
  );
}
