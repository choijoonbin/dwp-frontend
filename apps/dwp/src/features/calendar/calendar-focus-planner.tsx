import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, CalendarPlus, Clock3, Focus, ListTodo, Sparkles, Target } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { resolveSystemTimeZone } from '@dwp-frontend/shared-i18n';
import {
  getCalendarAvailability,
  getCalendarEvents,
  getCalendarHome,
  trashCalendarEvent,
  updateCalendarEventPreference,
  usePermissions,
  useToast,
} from '@dwp-frontend/shared-utils';
import { ActionButton, ConfirmDialog, GuidedEmptyState } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import { CalendarEventDialog } from './calendar-event-dialog';
import { eventCapability } from './calendar-source-model';
import {
  CalendarEventDrawer,
  CalendarPageHeading,
  calendarDate,
  calendarTime,
} from './calendar-components';
import {
  CalendarCanvas,
  CalendarSectionHeader,
  CalendarWeekBalanceRail,
} from './calendar-experience';
import {
  calendarEventMinutes,
  calendarHorizon,
  calendarPlanningEvents,
} from './calendar-workbench-model';

import type {
  CalendarAvailabilitySlot,
  CalendarEvent,
  CalendarEventType,
} from '@dwp-frontend/shared-utils';

type PlannerCreateState = Readonly<{
  type: Extract<CalendarEventType, 'FOCUS' | 'TASK'>;
  start: string;
  end: string;
}>;

function roundedStart() {
  const value = new Date();
  value.setSeconds(0, 0);
  value.setMinutes(value.getMinutes() < 30 ? 30 : 60);
  return value;
}

function createState(type: PlannerCreateState['type']): PlannerCreateState {
  const start = roundedStart();
  const duration = type === 'FOCUS' ? 90 : 60;
  return {
    type,
    start: start.toISOString(),
    end: new Date(start.getTime() + duration * 60_000).toISOString(),
  };
}

function slotCreateState(slot: CalendarAvailabilitySlot): PlannerCreateState {
  return { type: 'FOCUS', start: slot.startsAt, end: slot.endsAt };
}

function PlannerEventRow({ event, onOpen }: { event: CalendarEvent; onOpen: () => void }) {
  const { t, i18n } = useTranslation('calendar');
  const language = i18n.resolvedLanguage ?? i18n.language;
  const focus = event.type === 'FOCUS';
  const Icon = focus ? Focus : ListTodo;

  return (
    <Box
      component="button"
      type="button"
      onClick={onOpen}
      sx={{
        width: 1,
        minWidth: 0,
        display: 'grid',
        gridTemplateColumns: { xs: '38px minmax(0, 1fr)', sm: '42px minmax(0, 1fr) auto' },
        alignItems: 'center',
        gap: 1.25,
        p: 1.5,
        border: 0,
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'transparent',
        color: 'text.primary',
        textAlign: 'left',
        cursor: 'pointer',
        '&:hover': { bgcolor: 'action.hover' },
        '&:focus-visible': {
          outline: '2px solid',
          outlineColor: 'primary.main',
          outlineOffset: -2,
        },
      }}
    >
      <Box
        sx={(theme) => ({
          width: 38,
          height: 38,
          display: 'grid',
          placeItems: 'center',
          borderRadius: 1,
          color: focus ? 'success.dark' : 'warning.dark',
          bgcolor: alpha(focus ? theme.palette.success.main : theme.palette.warning.main, 0.12),
        })}
      >
        <Icon size={18} aria-hidden="true" />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography fontWeight={600} noWrap>
          {event.title}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ whiteSpace: { xs: 'normal', sm: 'nowrap' } }}
        >
          {calendarDate(event.startsAt, language)} · {calendarTime(event.startsAt, language)} –{' '}
          {calendarTime(event.endsAt, language)}
        </Typography>
      </Box>
      <Chip
        size="small"
        variant="outlined"
        label={t('units.minutes', { count: calendarEventMinutes(event) })}
        sx={{ gridColumn: { xs: '2', sm: 'auto' }, justifySelf: 'start', mt: { xs: 0.35, sm: 0 } }}
      />
    </Box>
  );
}

function PlannerLane({
  title,
  description,
  events,
  emptyTitle,
  emptyDescription,
  icon,
  onOpen,
}: {
  title: string;
  description: string;
  events: readonly CalendarEvent[];
  emptyTitle: string;
  emptyDescription: string;
  icon: LucideIcon;
  onOpen: (event: CalendarEvent) => void;
}) {
  return (
    <Box
      component="section"
      sx={{
        minWidth: 0,
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        overflow: 'hidden',
      }}
    >
      <CalendarSectionHeader icon={icon} title={title} description={description} />
      <Divider />
      {events.length ? (
        events.map((event) => (
          <PlannerEventRow key={event.eventId} event={event} onOpen={() => onOpen(event)} />
        ))
      ) : (
        <GuidedEmptyState kind="empty" title={emptyTitle} description={emptyDescription} />
      )}
    </Box>
  );
}

export function CalendarFocusPlanner() {
  const { t, i18n } = useTranslation('calendar');
  const { hasPermission } = usePermissions();
  const toast = useToast();
  const queryClient = useQueryClient();
  const language = i18n.resolvedLanguage ?? i18n.language;
  const timeZone = resolveSystemTimeZone('Asia/Seoul');
  const now = useMemo(() => new Date(), []);
  const range = useMemo(() => calendarHorizon(now, 0, 14), [now]);
  const [creating, setCreating] = useState<PlannerCreateState | null>(null);
  const [selected, setSelected] = useState<CalendarEvent | null>(null);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [trashing, setTrashing] = useState<CalendarEvent | null>(null);
  const canCreate = hasPermission('APP.CALENDAR', 'CREATE');
  const canUpdate = hasPermission('APP.CALENDAR', 'UPDATE');

  const home = useQuery({
    queryKey: ['calendar', 'home', timeZone],
    queryFn: () => getCalendarHome(timeZone),
    staleTime: 30_000,
    retry: 1,
  });
  const events = useQuery({
    queryKey: ['calendar', 'events', range.from, range.to],
    queryFn: () => getCalendarEvents(range.from, range.to),
    staleTime: 20_000,
    retry: 1,
  });
  const recommendations = useMutation({
    mutationFn: () => getCalendarAvailability([], range.from, range.to, 90, timeZone),
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

  const plan = useMemo(() => calendarPlanningEvents(events.data ?? [], now), [events.data, now]);
  const metrics = home.data?.metrics;
  const focusProgress = metrics
    ? Math.min(
        100,
        Math.round((metrics.focusMinutes * 100) / Math.max(1, metrics.focusTargetMinutes))
      )
    : 0;
  const focusGap = metrics ? Math.max(0, metrics.focusTargetMinutes - metrics.focusMinutes) : 0;
  const selectedIsEditable = Boolean(
    selected && canUpdate && selected.status !== 'CANCELLED' && eventCapability(selected, 'canEdit')
  );
  const selectedCanDelete = Boolean(
    selected && canUpdate && eventCapability(selected, 'canDelete')
  );
  const selectedCanStar = Boolean(selected && canUpdate && eventCapability(selected, 'canStar'));
  const loading = home.isLoading && events.isLoading;
  return (
    <CalendarCanvas archetype="coach">
      <CalendarPageHeading
        icon={Focus}
        eyebrow={t('focusPlan.eyebrow')}
        title={t('focusPlan.title')}
        description={t('focusPlan.description')}
        actions={
          canCreate ? (
            <>
              <ActionButton
                intent="secondary"
                startIcon={<ListTodo size={17} />}
                onClick={() => setCreating(createState('TASK'))}
              >
                {t('focusPlan.addTask')}
              </ActionButton>
              <ActionButton
                intent="primary"
                startIcon={<CalendarPlus size={18} />}
                onClick={() => setCreating(createState('FOCUS'))}
              >
                {t('focusPlan.addFocus')}
              </ActionButton>
            </>
          ) : undefined
        }
      />

      {(home.isError || events.isError) && (
        <Alert
          severity="error"
          action={
            <ActionButton
              intent="quiet"
              onClick={() => {
                void home.refetch();
                void events.refetch();
              }}
            >
              {t('actions.retry')}
            </ActionButton>
          }
        >
          {t('focusPlan.loadError')}
        </Alert>
      )}

      {loading ? (
        <Stack spacing={2}>
          <Skeleton variant="rounded" height={214} />
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2 }}>
            <Skeleton variant="rounded" height={320} />
            <Skeleton variant="rounded" height={320} />
          </Box>
        </Stack>
      ) : (
        <Stack spacing={2.5}>
          {home.isLoading && !home.data && <Skeleton variant="rounded" height={214} />}
          {home.data && (
            <Box
              component="section"
              aria-label={t('focusPlan.weeklyGoal')}
              sx={(theme) => ({
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.35fr) minmax(330px, 0.65fr)' },
                gap: 1.25,
                p: 1.25,
                bgcolor: alpha(
                  theme.palette.primary.main,
                  theme.palette.mode === 'dark' ? 0.08 : 0.035
                ),
                border: 1,
                borderColor: alpha(theme.palette.divider, 0.75),
                borderRadius: 1,
                overflow: 'hidden',
              })}
            >
              <Box
                sx={{
                  minWidth: 0,
                  display: 'grid',
                  gap: 2.25,
                  p: { xs: 2, md: 2.75 },
                  bgcolor: 'background.paper',
                  borderRadius: 1,
                }}
              >
                <CalendarSectionHeader
                  icon={Target}
                  title={t('focusPlan.weeklyGoal')}
                  description={
                    focusGap
                      ? t('focusPlan.minutesRemaining', { count: focusGap })
                      : t('focusPlan.goalProtected')
                  }
                  meta={t('focusPlan.goalProgress', { value: focusProgress })}
                  padded={false}
                />
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    component="h2"
                    sx={{
                      fontSize: { xs: '1.45rem', md: '1.7rem' },
                      lineHeight: 1.2,
                      fontWeight: 700,
                      letterSpacing: '-0.025em',
                    }}
                  >
                    {focusGap
                      ? t('focusPlan.minutesRemaining', { count: focusGap })
                      : t('focusPlan.goalProtected')}
                  </Typography>
                  <Box sx={{ mt: 1.5 }}>
                    <Box
                      role="meter"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={focusProgress}
                      aria-label={t('focusPlan.goalProgress', { value: focusProgress })}
                      sx={(theme) => ({
                        height: 8,
                        borderRadius: 999,
                        overflow: 'hidden',
                        bgcolor: alpha(theme.palette.primary.main, 0.12),
                      })}
                    >
                      <Box
                        sx={(theme) => ({
                          width: `${focusProgress}%`,
                          height: 1,
                          borderRadius: 999,
                          bgcolor: 'primary.main',
                          transition: theme.transitions.create('width'),
                          '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
                        })}
                      />
                    </Box>
                  </Box>
                  <Stack
                    direction="row"
                    flexWrap="wrap"
                    useFlexGap
                    gap={{ xs: 1.5, sm: 2.25 }}
                    sx={{ mt: 1.5 }}
                  >
                    {[
                      {
                        label: t('focusPlan.weeklyGoal'),
                        value: t('units.minutes', { count: metrics?.focusTargetMinutes ?? 0 }),
                      },
                      { label: t('focusPlan.focusBlocks'), value: plan.focus.length },
                      { label: t('focusPlan.taskBlocks'), value: plan.tasks.length },
                      { label: t('focusPlan.conflicts'), value: metrics?.conflictCount ?? 0 },
                    ].map(({ label, value }) => (
                      <Box key={String(label)} sx={{ minWidth: 76 }}>
                        <Typography
                          component="p"
                          sx={{
                            fontSize: '1.1rem',
                            fontWeight: 700,
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {value}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" fontWeight={500}>
                          {label}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </Box>
                {home.data?.weekLoad.length ? (
                  <Box sx={{ pt: 2.25, borderTop: 1, borderColor: 'divider' }}>
                    <CalendarWeekBalanceRail
                      days={home.data.weekLoad.map((day) => ({
                        key: day.date,
                        label: calendarDate(day.date, language, false),
                        meetingMinutes: day.meetingMinutes,
                        focusMinutes: day.focusMinutes,
                        loadPercent: day.loadPercent,
                      }))}
                      meetingLabel={`${t('home.metrics.meetings')} (${t('units.minute')})`}
                      focusLabel={`${t('home.metrics.focus')} (${t('units.minute')})`}
                      utilizationLabel={(day) =>
                        t('insights.utilization', { value: day.loadPercent })
                      }
                    />
                  </Box>
                ) : null}
              </Box>

              <Box
                sx={(theme) => ({
                  minWidth: 0,
                  p: { xs: 2, md: 2.5 },
                  bgcolor: alpha(
                    theme.palette.primary.main,
                    theme.palette.mode === 'dark' ? 0.14 : 0.075
                  ),
                  borderRadius: 1,
                })}
              >
                <CalendarSectionHeader
                  icon={Sparkles}
                  title={t('focusPlan.smartTitle')}
                  description={t('focusPlan.smartDescription')}
                  padded={false}
                />
                {recommendations.isError && (
                  <Alert severity="error" sx={{ mt: 1.5 }}>
                    {t('focusPlan.recommendationError')}
                  </Alert>
                )}
                {recommendations.data?.suggestions.length ? (
                  <Stack spacing={0.75} sx={{ mt: 1.75 }}>
                    {recommendations.data.suggestions.slice(0, 3).map((slot) => (
                      <Box
                        component={canCreate ? 'button' : 'div'}
                        type={canCreate ? 'button' : undefined}
                        key={slot.startsAt}
                        onClick={canCreate ? () => setCreating(slotCreateState(slot)) : undefined}
                        sx={(theme) => ({
                          display: 'grid',
                          gridTemplateColumns: 'minmax(0, 1fr) auto',
                          gap: 1,
                          alignItems: 'center',
                          p: 1.25,
                          border: 1,
                          borderColor: alpha(theme.palette.primary.main, 0.14),
                          borderRadius: 0.75,
                          bgcolor: alpha(theme.palette.background.paper, 0.78),
                          color: 'text.primary',
                          textAlign: 'left',
                          cursor: canCreate ? 'pointer' : 'default',
                          transition: theme.transitions.create([
                            'border-color',
                            'background-color',
                          ]),
                          '&:hover': canCreate
                            ? {
                                borderColor: 'primary.main',
                                bgcolor: 'background.paper',
                              }
                            : undefined,
                          '&:focus-visible': {
                            outline: '2px solid',
                            outlineColor: 'primary.main',
                            outlineOffset: 2,
                          },
                          '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
                        })}
                      >
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={600}>
                            {calendarDate(slot.startsAt, language)}
                          </Typography>
                          <Stack
                            direction="row"
                            spacing={0.6}
                            alignItems="center"
                            color="text.secondary"
                          >
                            <Clock3 size={14} />
                            <Typography variant="caption">
                              {calendarTime(slot.startsAt, language)} –{' '}
                              {calendarTime(slot.endsAt, language)}
                            </Typography>
                          </Stack>
                        </Box>
                        <ArrowRight size={17} aria-hidden="true" />
                      </Box>
                    ))}
                  </Stack>
                ) : recommendations.data ? (
                  <Stack spacing={1} alignItems="flex-start" sx={{ mt: 1.75 }}>
                    <Alert severity="info">{t('focusPlan.noRecommendation')}</Alert>
                    <ActionButton
                      intent="quiet"
                      loading={recommendations.isPending}
                      onClick={() => recommendations.mutate()}
                    >
                      {t('actions.retry')}
                    </ActionButton>
                  </Stack>
                ) : (
                  <ActionButton
                    intent="primary"
                    loading={recommendations.isPending}
                    startIcon={<Sparkles size={16} />}
                    onClick={() => recommendations.mutate()}
                    sx={{ mt: 2 }}
                  >
                    {t('focusPlan.findTime')}
                  </ActionButton>
                )}
              </Box>
            </Box>
          )}

          {events.isLoading && !events.data && (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
                gap: 2,
              }}
            >
              <Skeleton variant="rounded" height={320} />
              <Skeleton variant="rounded" height={320} />
            </Box>
          )}
          {events.data && (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
                gap: 2,
              }}
            >
              <PlannerLane
                icon={Focus}
                title={t('focusPlan.focusLaneTitle')}
                description={t('focusPlan.focusLaneDescription')}
                events={plan.focus}
                emptyTitle={t('focusPlan.focusEmptyTitle')}
                emptyDescription={t('focusPlan.focusEmptyDescription')}
                onOpen={setSelected}
              />
              <PlannerLane
                icon={ListTodo}
                title={t('focusPlan.taskLaneTitle')}
                description={t('focusPlan.taskLaneDescription')}
                events={plan.tasks}
                emptyTitle={t('focusPlan.taskEmptyTitle')}
                emptyDescription={t('focusPlan.taskEmptyDescription')}
                onOpen={setSelected}
              />
            </Box>
          )}
        </Stack>
      )}

      {canCreate && (
        <CalendarEventDialog
          open={Boolean(creating)}
          initialType={creating?.type}
          initialStart={creating?.start}
          initialEnd={creating?.end}
          onClose={() => setCreating(null)}
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
        canEdit={selectedIsEditable}
        canDelete={selectedCanDelete}
        canStar={selectedCanStar}
        starBusy={preferenceMutation.isPending}
        onClose={() => setSelected(null)}
        onEdit={
          selectedIsEditable
            ? () => {
                setEditing(selected);
                setSelected(null);
              }
            : undefined
        }
        onTrash={selectedCanDelete && selected ? () => setTrashing(selected) : undefined}
        onToggleStar={
          selectedCanStar && selected ? () => preferenceMutation.mutate(selected) : undefined
        }
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
