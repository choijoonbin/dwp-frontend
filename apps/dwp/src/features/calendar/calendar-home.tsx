import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  CalendarPlus,
  Clock3,
  DoorOpen,
  Focus,
  Inbox,
  MapPin,
  ShieldAlert,
  Sparkles,
  UsersRound,
  Video,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { resolveSystemTimeZone } from '@dwp-frontend/shared-i18n';
import {
  getCalendarHome,
  cancelCalendarEvent,
  respondToCalendarEvent,
  trashCalendarEvent,
  updateCalendarEventPreference,
  useAuth,
  usePermissions,
  useToast,
} from '@dwp-frontend/shared-utils';
import { ActionButton, ConfirmDialog, GuidedEmptyState } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha, lighten } from '@mui/material/styles';

import { CalendarEventDialog } from './calendar-event-dialog';
import { eventCapability } from './calendar-source-model';
import {
  CALENDAR_EVENT_TONES,
  CalendarAgendaItem,
  CalendarEventDrawer,
  CalendarMetric,
  CalendarPageHeading,
  calendarDate,
  calendarTime,
} from './calendar-components';
import {
  CalendarCanvas,
  CalendarSectionHeader,
  CalendarWeekBalanceRail,
} from './calendar-experience';

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
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [createType, setCreateType] = useState<'MEETING' | 'FOCUS'>('MEETING');
  const [selected, setSelected] = useState<CalendarEvent | null>(null);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [cancelling, setCancelling] = useState<CalendarEvent | null>(null);
  const [trashing, setTrashing] = useState<CalendarEvent | null>(null);
  const timeZone = resolveSystemTimeZone('Asia/Seoul');
  const language = i18n.resolvedLanguage ?? i18n.language;
  const canCreate = hasPermission('APP.CALENDAR', 'CREATE');
  const canUpdate = hasPermission('APP.CALENDAR', 'UPDATE');
  const canRespond = canUpdate;
  const roomsPath = hasPermission('APP.ROOMS', 'VIEW') ? '/workplace/rooms' : null;
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
  const trashMutation = useMutation({
    mutationFn: (event: CalendarEvent) =>
      trashCalendarEvent(event.eventId, event.version, t('event.userDeletionReason')),
    onSuccess: async () => {
      setSelected(null);
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
    <CalendarCanvas archetype="command">
      <CalendarPageHeading
        icon={CalendarDays}
        eyebrow={data ? calendarDate(data.date, language) : t('home.today')}
        title={`${greeting}, ${auth.user?.displayName ?? t('home.member')}`}
        description={t('home.description')}
        actions={
          canCreate ? (
            <ActionButton
              intent="primary"
              startIcon={<CalendarPlus size={18} />}
              onClick={() => {
                setCreateType('MEETING');
                setCreateOpen(true);
              }}
            >
              {t('actions.newEvent')}
            </ActionButton>
          ) : undefined
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
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 2fr) minmax(320px, 1fr)' },
              gap: 2,
              alignItems: 'stretch',
            }}
          >
            <Box
              component="section"
              aria-label={t('home.nextEvent')}
              sx={{
                minHeight: 190,
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
                  width: 4,
                  bgcolor: nextTone.main,
                },
              }}
            >
              {next ? (
                <Box sx={{ minWidth: 0 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography
                      variant="overline"
                      sx={(theme) => ({
                        color:
                          theme.palette.mode === 'dark'
                            ? lighten(nextTone.main, 0.42)
                            : nextTone.main,
                      })}
                    >
                      {timeUntil > 0
                        ? t('home.startsIn', { count: timeUntil })
                        : t('home.inProgress')}
                    </Typography>
                    {next.conflict && (
                      <Stack direction="row" spacing={0.5} alignItems="center" color="error.main">
                        <ShieldAlert size={14} />
                        <Typography variant="caption" fontWeight={600}>
                          {t('event.conflict')}
                        </Typography>
                      </Stack>
                    )}
                  </Stack>
                  <Typography
                    component="h2"
                    sx={{
                      mt: 0.75,
                      fontSize: { xs: 24, sm: 28 },
                      lineHeight: 1.2,
                      fontWeight: 700,
                    }}
                  >
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
                  <Typography
                    component="h2"
                    sx={{
                      mt: 0.75,
                      fontSize: { xs: 24, sm: 28 },
                      lineHeight: 1.2,
                      fontWeight: 700,
                    }}
                  >
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
                    onClick={() =>
                      window.open(next.conferenceUrl!, '_blank', 'noopener,noreferrer')
                    }
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
              sx={(theme) => ({
                minHeight: 190,
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                bgcolor: alpha(
                  theme.palette.primary.main,
                  theme.palette.mode === 'dark' ? 0.08 : 0.025
                ),
                overflow: 'hidden',
              })}
            >
              <CalendarSectionHeader
                icon={Sparkles}
                title={t('home.attentionTitle')}
                description={t('home.attentionDescription')}
              />
              <Divider />
              {data.attention.length ? (
                <Stack>
                  {data.attention.slice(0, 3).map((item) => (
                    <Box
                      component={Link}
                      to={
                        item.eventId
                          ? `${item.actionPath}?event=${encodeURIComponent(item.eventId)}`
                          : item.actionPath
                      }
                      key={item.key}
                      sx={{
                        px: 2.25,
                        py: 1.45,
                        color: 'text.primary',
                        textDecoration: 'none',
                        borderBottom: 1,
                        borderColor: 'divider',
                        '&:last-of-type': { borderBottom: 0 },
                        '&:hover': { bgcolor: 'action.hover' },
                        '&:focus-visible': {
                          outline: '2px solid',
                          outlineColor: 'primary.main',
                          outlineOffset: -2,
                        },
                      }}
                    >
                      <Stack direction="row" spacing={1} alignItems="flex-start">
                        <Box
                          aria-hidden="true"
                          sx={{
                            width: 7,
                            height: 7,
                            flex: '0 0 7px',
                            mt: 0.75,
                            borderRadius: '50%',
                            bgcolor:
                              item.severity === 'HIGH'
                                ? 'error.main'
                                : item.severity === 'MEDIUM'
                                  ? 'warning.main'
                                  : 'primary.main',
                          }}
                        />
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={600}>
                            {item.title}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {item.description}
                          </Typography>
                        </Box>
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              ) : (
                <Typography color="text.secondary" sx={{ px: 2.25, py: 2.5 }}>
                  {t('home.noAttention')}
                </Typography>
              )}
            </Box>
          </Box>

          <Box
            component="section"
            aria-label={t('home.weekSnapshot')}
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
              gap: 1.25,
            }}
          >
            <CalendarMetric
              label={t('home.metrics.meetings')}
              value={minutesLabel(metrics!.meetingMinutes, t('units.hour'), t('units.minute'))}
              hint={t('home.metrics.meetingsHint', { count: metrics!.eventCount })}
              icon={UsersRound}
              tone="primary"
              onClick={() => navigate('/calendar/schedule')}
              actionLabel={t('actions.openCalendar')}
            />
            <CalendarMetric
              label={t('home.metrics.focus')}
              value={minutesLabel(metrics!.focusMinutes, t('units.hour'), t('units.minute'))}
              hint={t('home.metrics.focusHint', { progress: focusProgress })}
              icon={Focus}
              tone="success"
              progress={focusProgress}
              progressLabel={t('home.metrics.focusHint', { progress: focusProgress })}
              onClick={() => navigate('/calendar/focus')}
            />
            {metrics!.awaitingResponseCount > 0 && (
              <CalendarMetric
                label={t('home.metrics.responses')}
                value={metrics!.awaitingResponseCount}
                hint={t('home.metrics.responsesHint')}
                icon={Inbox}
                tone="warning"
                onClick={() => navigate('/calendar/invitations')}
              />
            )}
            {roomsPath && metrics!.availableRoomCount > 0 && (
              <CalendarMetric
                label={t('home.metrics.rooms')}
                value={metrics!.availableRoomCount}
                hint={t('home.metrics.roomsHint')}
                icon={DoorOpen}
                tone="info"
                onClick={() => navigate(roomsPath)}
              />
            )}
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
              <CalendarSectionHeader
                icon={CalendarDays}
                title={t('home.todayAgenda')}
                description={t('home.todayAgendaDescription')}
                action={
                  <ActionButton
                    component={Link}
                    to="/calendar/schedule"
                    intent="quiet"
                    endIcon={<ArrowRight size={16} />}
                  >
                    {t('actions.openCalendar')}
                  </ActionButton>
                }
              />
              <Divider />
              {data.today.length ? (
                data.today.map((event) => (
                  <CalendarAgendaItem
                    key={`${event.eventId}-${event.startsAt}`}
                    event={event}
                    onOpen={() => setSelected(event)}
                    onRespond={
                      canRespond && eventCapability(event, 'canRespond')
                        ? (response) => respond(event, response)
                        : undefined
                    }
                  />
                ))
              ) : (
                <GuidedEmptyState
                  kind="empty"
                  title={t('home.emptyToday')}
                  description={t('home.emptyTodayDescription')}
                  actionLabel={canCreate ? t('actions.addFocus') : undefined}
                  onAction={
                    canCreate
                      ? () => {
                          setCreateType('FOCUS');
                          setCreateOpen(true);
                        }
                      : undefined
                  }
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
              <CalendarSectionHeader
                icon={BarChart3}
                title={t('home.weekPulse')}
                description={t('home.weekPulseDescription')}
              />
              <Divider />
              <Box sx={{ p: 2.5 }}>
                <CalendarWeekBalanceRail
                  days={data.weekLoad.map((day) => ({
                    key: day.date,
                    label: calendarDate(day.date, language, false),
                    meetingMinutes: day.meetingMinutes,
                    focusMinutes: day.focusMinutes,
                    loadPercent: day.loadPercent,
                  }))}
                  meetingLabel={`${t('home.metrics.meetings')} (${t('units.minute')})`}
                  focusLabel={`${t('home.metrics.focus')} (${t('units.minute')})`}
                  utilizationLabel={(day) =>
                    day.loadPercent > 100
                      ? `${t('insights.utilization', { value: day.loadPercent })} · ${t('event.conflict')}`
                      : t('insights.utilization', { value: day.loadPercent })
                  }
                />
              </Box>
            </Box>
          </Box>

          <Typography variant="caption" color="text.secondary" textAlign="right">
            {t('home.updatedAt', { time: calendarTime(data.generatedAt, language) })}
          </Typography>
        </Stack>
      ) : null}

      {canCreate && (
        <CalendarEventDialog
          open={createOpen}
          initialType={createType}
          onClose={() => setCreateOpen(false)}
        />
      )}
      {canUpdate && (
        <CalendarEventDialog
          open={Boolean(editing)}
          event={editing}
          onClose={() => setEditing(null)}
          onSaved={(event) => setSelected(event)}
        />
      )}
      <CalendarEventDrawer
        event={selected}
        open={Boolean(selected)}
        canEdit={Boolean(selected && canUpdate && eventCapability(selected, 'canEdit'))}
        canDelete={Boolean(selected && canUpdate && eventCapability(selected, 'canDelete'))}
        canStar={Boolean(selected && canUpdate && eventCapability(selected, 'canStar'))}
        starBusy={preferenceMutation.isPending}
        onClose={() => setSelected(null)}
        onEdit={
          canUpdate
            ? () => {
                setEditing(selected);
                setSelected(null);
              }
            : undefined
        }
        onCancel={
          selected && canUpdate && eventCapability(selected, 'canDelete')
            ? () => setCancelling(selected)
            : undefined
        }
        onTrash={
          selected && canUpdate && eventCapability(selected, 'canDelete')
            ? () => setTrashing(selected)
            : undefined
        }
        onToggleStar={
          selected && canUpdate && eventCapability(selected, 'canStar')
            ? () => preferenceMutation.mutate(selected)
            : undefined
        }
        onRespond={
          selected && canRespond && eventCapability(selected, 'canRespond')
            ? (response) => respond(selected, response)
            : undefined
        }
      />
      <ConfirmDialog
        open={Boolean(cancelling && canUpdate && eventCapability(cancelling, 'canDelete'))}
        title={t('event.cancelTitle')}
        description={t('event.cancelDescription', { title: cancelling?.title })}
        cancelLabel={t('actions.close')}
        confirmLabel={t('event.cancelEvent')}
        confirmingLabel={t('event.cancelling')}
        intent="danger"
        busy={cancelMutation.isPending}
        onClose={() => setCancelling(null)}
        onConfirm={() => {
          if (canUpdate && cancelling && eventCapability(cancelling, 'canDelete')) {
            cancelMutation.mutate(cancelling);
          }
        }}
      />
      <ConfirmDialog
        open={Boolean(trashing && canUpdate && eventCapability(trashing, 'canDelete'))}
        title={t('event.trashTitle')}
        description={t('event.trashDescription', { title: trashing?.title })}
        cancelLabel={t('actions.close')}
        confirmLabel={t('event.moveToTrash')}
        confirmingLabel={t('event.trashing')}
        intent="danger"
        busy={trashMutation.isPending}
        onClose={() => setTrashing(null)}
        onConfirm={() => {
          if (canUpdate && trashing && eventCapability(trashing, 'canDelete')) {
            trashMutation.mutate(trashing);
          }
        }}
      />
    </CalendarCanvas>
  );
}
