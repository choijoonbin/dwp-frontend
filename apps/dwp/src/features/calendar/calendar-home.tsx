import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  cancelCalendarEvent,
  dwaionHandoffStrings,
  dwaionHandoffText,
  getCalendarPolicy,
  parseDwaionHandoff,
  respondToCalendarEvent,
  trashCalendarEvent,
  updateCalendarEventPreference,
  useAuth,
  usePermissions,
  useToast,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  ConfirmDialog,
  LiveStatus,
  LoadingState,
  OperationalContextBar,
} from '@dwp-frontend/design-system';
import { CalendarDays, CalendarPlus, Command, PanelRightClose, PanelRightOpen } from 'lucide-react';

import Box from '@mui/material/Box';
import useMediaQuery from '@mui/material/useMediaQuery';

import { CalendarEventDialog } from './calendar-event-dialog';
import { CalendarEventDrawer, calendarDate } from './calendar-components';
import { CalendarHomeHeader } from './calendar-home-header';
import { calendarReconcileHomeEvent } from './calendar-home-selection';
import { CalendarCanvas } from './calendar-experience';
import {
  calendarGreetingPeriod,
  calendarTodayHasCurrentEvent,
  calendarWorkdayPhase,
} from './calendar-today-model';
import { CalendarTodayWorkspace } from './calendar-today-workspace';
import { CalendarWorkspaceOverlays } from './calendar-workspace-overlays';
import { useCalendarWorkspaceSummary } from './calendar-workspace-summary';
import {
  calendarReadSourceState,
  retryRecoverableCalendarRead,
} from './calendar-read-source-state';
import { eventCapability } from './calendar-source-model';
import { calendarInternalPath, isCalendarCommandShortcut } from './calendar-schedule-state';

import type {
  CalendarEvent,
  CalendarEventType,
  CalendarResponseStatus,
} from '@dwp-frontend/shared-utils';

type CalendarHomeCreateState = Readonly<{
  start: string;
  end?: string;
  type: CalendarEventType;
  title?: string;
  attendeeEmails?: string[];
  fromDwaion?: boolean;
}>;

function requestedCalendarType(value: string | null): CalendarEventType {
  if (value === 'focus') return 'FOCUS';
  if (value === 'task') return 'TASK';
  if (value === 'out-of-office') return 'OUT_OF_OFFICE';
  return 'MEETING';
}

function roundedStart(value: string) {
  const start = new Date(value);
  if (Number.isNaN(start.getTime())) return new Date().toISOString();
  start.setSeconds(0, 0);
  start.setMinutes(start.getMinutes() < 30 ? 30 : 60);
  return start.toISOString();
}

function useCalendarLiveClock(anchor?: string) {
  const [currentTime, setCurrentTime] = useState(() => anchor ?? new Date().toISOString());

  useEffect(() => {
    const anchorTime = Date.parse(anchor ?? '');
    const baseTime = Number.isFinite(anchorTime) ? anchorTime : Date.now();
    const baseMonotonicTime = performance.now();
    const update = () =>
      setCurrentTime(new Date(baseTime + (performance.now() - baseMonotonicTime)).toISOString());
    update();
    const interval = window.setInterval(update, 15_000);
    return () => window.clearInterval(interval);
  }, [anchor]);

  return currentTime;
}

export function CalendarHome() {
  const { t, i18n } = useTranslation('calendar');
  const auth = useAuth();
  const { hasPermission } = usePermissions();
  const toast = useToast();
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();
  const desktopRail = useMediaQuery('(min-width:1280px)', { noSsr: true });
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [railDrawerOpen, setRailDrawerOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [selected, setSelected] = useState<CalendarEvent | null>(null);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [cancelling, setCancelling] = useState<CalendarEvent | null>(null);
  const [trashing, setTrashing] = useState<CalendarEvent | null>(null);
  const [createState, setCreateState] = useState<CalendarHomeCreateState | null>(null);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const currentSearch = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const summary = useCalendarWorkspaceSummary(true, language);
  const policyQuery = useQuery({
    queryKey: ['calendar', 'policy'],
    queryFn: getCalendarPolicy,
    enabled: summary.state !== 'DENIED',
    staleTime: 5 * 60_000,
    retry: retryRecoverableCalendarRead,
  });
  const policyState = calendarReadSourceState({
    data: policyQuery.data,
    error: policyQuery.error,
    failureCount: policyQuery.failureCount,
    failureReason: policyQuery.failureReason,
    isError: policyQuery.isError,
    isPending: policyQuery.isPending,
  });
  const policyData = policyState === 'READY' ? policyQuery.data : undefined;
  const currentTime = useCalendarLiveClock(summary.data?.generatedAt);
  const canCreateGranted = hasPermission('APP.CALENDAR', 'CREATE');
  const canUpdateGranted = hasPermission('APP.CALENDAR', 'UPDATE');
  const roomsPath = hasPermission('APP.ROOMS', 'VIEW') ? '/workplace/rooms' : null;
  const writable = summary.state === 'READY';
  const canCreate = canCreateGranted && writable;
  const canUpdate = canUpdateGranted && writable;
  const railVisible = Boolean(summary.data) && desktopRail && !railCollapsed;
  const railOpen = railVisible || railDrawerOpen;
  const requestedEventId = currentSearch.get('event');
  const dwaionHandoff = useMemo(
    () => parseDwaionHandoff(location.state, 'CALENDAR.EVENT.CREATE'),
    [location.state]
  );

  useEffect(() => {
    const openCommands = (event: KeyboardEvent) => {
      if (!isCalendarCommandShortcut(event)) return;
      event.preventDefault();
      setCommandOpen(true);
    };
    window.addEventListener('keydown', openCommands);
    return () => window.removeEventListener('keydown', openCommands);
  }, []);

  useEffect(() => {
    if (desktopRail) setRailDrawerOpen(false);
  }, [desktopRail]);

  useEffect(() => {
    const requestedType = currentSearch.get('create');
    if (!requestedType && !dwaionHandoff) return;
    if (canCreateGranted && !writable) return;
    if (canCreate) {
      setCreateState({
        start:
          dwaionHandoffText(dwaionHandoff, 'startsAt') ??
          roundedStart(summary.data?.generatedAt ?? new Date().toISOString()),
        end: dwaionHandoffText(dwaionHandoff, 'endsAt') ?? undefined,
        type: requestedCalendarType(requestedType),
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
    currentSearch,
    dwaionHandoff,
    location.pathname,
    location.search,
    navigate,
    summary.data?.generatedAt,
    writable,
  ]);

  useEffect(() => {
    if (summary.state !== 'READY' || !summary.data) return;
    const home = summary.data;
    const events = home.nextEvent ? [...home.today, home.nextEvent] : home.today;
    const requested = events.find((event) => event.eventId === requestedEventId) ?? null;
    setSelected((current) => calendarReconcileHomeEvent(current ?? requested, home));
    // Preserve an authorized draft, but never retain its sensitive fields or
    // destructive intent after a successful authority/version change.
    const reconcileIntent = (
      current: CalendarEvent | null,
      capability: 'canEdit' | 'canDelete'
    ) => {
      const next = calendarReconcileHomeEvent(current, home);
      return next && next.version === current?.version && eventCapability(next, capability)
        ? current
        : null;
    };
    setEditing((current) => reconcileIntent(current, 'canEdit'));
    setCancelling((current) => reconcileIntent(current, 'canDelete'));
    setTrashing((current) => reconcileIntent(current, 'canDelete'));
  }, [requestedEventId, summary.data, summary.state]);

  useEffect(() => {
    if (writable) return;
    setCreateState(null);
    setEditing(null);
    setCancelling(null);
    setTrashing(null);
    if (summary.state !== 'DENIED') return;
    setSelected(null);
    setRailDrawerOpen(false);
    setCommandOpen(false);
  }, [summary.state, writable]);

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
          ? { ...current, starred: preference.starred, preferenceVersion: preference.version }
          : current
      );
      await queryClient.invalidateQueries({ queryKey: ['calendar'] });
      toast.success(t(preference.starred ? 'event.starred' : 'event.unstarred'));
    },
    onError: () => toast.error(t('event.starError')),
  });

  const canManage = (event: CalendarEvent) =>
    canUpdate && event.status !== 'CANCELLED' && eventCapability(event, 'canEdit');
  const canDelete = (event: CalendarEvent) =>
    canUpdate && event.status !== 'CANCELLED' && eventCapability(event, 'canDelete');
  const respond = (event: CalendarEvent, response: 'ACCEPTED' | 'TENTATIVE' | 'DECLINED') =>
    respondMutation.mutate({ eventId: event.eventId, response });
  const openNow = (type: CalendarEventType) => {
    if (!canCreate) return;
    setCreateState({
      start: roundedStart(currentTime),
      type,
    });
  };
  const openFocusWindow = (start: string, end: string) => {
    if (!canCreate) return;
    setCreateState({ start, end, type: 'FOCUS' });
  };
  const navigateWithinCalendar = (path: string, preserveScheduleState = false) =>
    navigate(calendarInternalPath(path, currentSearch, { preserveScheduleState }));
  const openScheduleDate = (date: string) =>
    navigateWithinCalendar(`/calendar/schedule?view=day&date=${encodeURIComponent(date)}`, true);
  const greetingPeriod = summary.data
    ? calendarGreetingPeriod(currentTime, summary.data.timeZone)
    : 'morning';
  const greeting = t(
    {
      morning: 'home.greetingMorning',
      afternoon: 'home.greetingAfternoon',
      evening: 'home.greetingEvening',
    }[greetingPeriod]
  );
  const workdayPhase = summary.data
    ? calendarWorkdayPhase(currentTime, {
        date: summary.data.date,
        timeZone: summary.data.timeZone,
        workingDayStart: policyData?.workingDayStart,
        workingDayEnd: policyData?.workingDayEnd,
      })
    : 'UNKNOWN';
  const afterWorkWithoutCurrentEvent = Boolean(
    summary.data &&
    workdayPhase === 'AFTER' &&
    !calendarTodayHasCurrentEvent(summary.data.today, currentTime)
  );

  return (
    <CalendarCanvas archetype="command" topInset="compact">
      <CalendarHomeHeader
        state={summary.state}
        refreshing={summary.isFetching}
        timeZone={summary.data?.timeZone}
        eyebrow={
          summary.data
            ? t('home.commandEyebrow', { date: calendarDate(summary.data.date, language) })
            : t('home.today')
        }
        title={t('home.commandTitle')}
        description={t(
          afterWorkWithoutCurrentEvent
            ? 'home.commandDescriptionAfterWork'
            : 'home.commandDescription',
          {
            greeting,
            name: auth.user?.displayName ?? t('home.member'),
          }
        )}
        actions={
          <>
            <ActionButton
              intent="quiet"
              startIcon={<CalendarDays size={17} />}
              onClick={() => navigateWithinCalendar('/calendar/schedule', true)}
            >
              {t('actions.openCalendar')}
            </ActionButton>
            {summary.data ? (
              <ActionButton
                intent="secondary"
                startIcon={railOpen ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}
                aria-controls={railVisible ? 'calendar-workspace-rail' : undefined}
                aria-expanded={railOpen}
                onClick={() => {
                  if (desktopRail) setRailCollapsed((current) => !current);
                  else setRailDrawerOpen(true);
                }}
              >
                {t(railOpen ? 'workspace.hideRail' : 'workspace.showRail')}
              </ActionButton>
            ) : null}
            <ActionButton
              intent="secondary"
              startIcon={<Command size={17} />}
              aria-haspopup="dialog"
              aria-expanded={commandOpen}
              onClick={() => setCommandOpen(true)}
            >
              {t('command.trigger')}
            </ActionButton>
            {canCreate ? (
              <ActionButton
                intent="primary"
                startIcon={<CalendarPlus size={17} />}
                onClick={() => openNow('MEETING')}
              >
                {t('actions.newEvent')}
              </ActionButton>
            ) : null}
          </>
        }
      />

      {(summary.state === 'STALE' ||
        summary.state === 'DENIED' ||
        summary.state === 'UNAVAILABLE') && (
        <Box
          data-testid="calendar-read-state"
          data-calendar-read-state={summary.state}
          sx={{ mb: 1.5 }}
        >
          <OperationalContextBar
            label={t('shell.calendar.name')}
            items={[]}
            status={
              <LiveStatus
                state={summary.state === 'STALE' ? 'stale' : 'degraded'}
                label={t('shell.calendar.name')}
                detail={t(
                  summary.state === 'STALE'
                    ? 'readState.stale'
                    : summary.state === 'DENIED'
                      ? 'readState.denied'
                      : 'readState.unavailable'
                )}
              />
            }
            actions={
              <ActionButton intent="quiet" onClick={() => void summary.refetch()}>
                {t('actions.retry')}
              </ActionButton>
            }
          />
        </Box>
      )}

      {summary.state === 'LOADING' ? (
        <LoadingState
          label={t('schedule.loading')}
          variant="skeleton"
          embedded
          skeletonHeights={[124, 420]}
          skeletonGap={1}
        />
      ) : summary.data ? (
        <CalendarTodayWorkspace
          data={summary.data}
          currentTime={currentTime}
          workingDayStart={policyData?.workingDayStart}
          workingDayEnd={policyData?.workingDayEnd}
          railState={summary.state}
          railFetching={summary.isFetching}
          language={language}
          currentSearch={location.search}
          roomsPath={roomsPath}
          railVisible={railVisible}
          canCreate={canCreate}
          canRespond={canUpdate}
          onRetryRail={() => void summary.refetch()}
          onOpenEvent={setSelected}
          onRespond={(event, response) => respond(event, response)}
          onProtect={openFocusWindow}
          onCreateFocus={() => openNow('FOCUS')}
          onOpenSchedule={() => navigateWithinCalendar('/calendar/schedule', true)}
          onOpenScheduleDate={openScheduleDate}
          onOpenInsights={() => navigateWithinCalendar('/calendar/insights')}
          onOpenCommands={() => setCommandOpen(true)}
        />
      ) : null}

      <CalendarWorkspaceOverlays
        workspace
        desktopRail={desktopRail}
        railOpen={railDrawerOpen}
        railLabel={t('workspace.railTitle')}
        commandOpen={commandOpen}
        canCreate={canCreate}
        rail={{
          data: summary.data,
          state: summary.state,
          isFetching: summary.isFetching,
          language,
          currentSearch: location.search,
          roomsPath,
          onRetry: () => void summary.refetch(),
          canCreate,
          onCreateFocus: () => openNow('FOCUS'),
          onOpenCommands: () => setCommandOpen(true),
        }}
        onCloseRail={() => setRailDrawerOpen(false)}
        onCloseCommand={() => setCommandOpen(false)}
        onCreate={openNow}
        onNavigate={(path) => navigateWithinCalendar(path, path === '/calendar/schedule')}
      />

      {canCreate ? (
        <CalendarEventDialog
          open={Boolean(createState)}
          initialStart={createState?.start}
          initialEnd={createState?.end}
          initialType={createState?.type}
          initialTitle={createState?.title}
          initialTimeZone={summary.data?.timeZone}
          initialAttendeeEmails={createState?.attendeeEmails}
          fromDwaion={createState?.fromDwaion}
          onClose={() => setCreateState(null)}
        />
      ) : null}
      {canUpdate ? (
        <CalendarEventDialog
          open={Boolean(editing)}
          event={editing}
          onClose={() => setEditing(null)}
          onSaved={setSelected}
        />
      ) : null}
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
