import { useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArchiveRestore,
  Building2,
  CalendarPlus,
  Clock3,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createCompanyCalendar,
  createCompanyCalendarEvent,
  getCompanyCalendarEvents,
  getCompanyCalendars,
  restoreCompanyCalendarEvent,
  trashCompanyCalendarEvent,
  updateCompanyCalendar,
  updateCompanyCalendarEvent,
  usePermissions,
  useToast,
} from '@dwp-frontend/shared-utils';
import { ActionButton, ConfirmDialog, SelectField } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import { CompanyCalendarDialog, CompanyEventDialog } from './calendar-admin-company-dialogs';
import { CalendarPageHeading, calendarDate, calendarTime } from './calendar-components';
import { CalendarCanvas } from './calendar-experience';

import type {
  CompanyCalendar,
  CompanyCalendarEvent,
  CompanyCalendarInput,
  CreateCalendarEventInput,
  UpdateCalendarEventInput,
} from '@dwp-frontend/shared-utils';

function queryRange() {
  const from = new Date();
  from.setDate(from.getDate() - 14);
  const to = new Date();
  to.setDate(to.getDate() + 350);
  return { from: from.toISOString(), to: to.toISOString() };
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function CalendarAdminCompanyCalendars() {
  const { t, i18n } = useTranslation('calendar');
  const { hasPermission } = usePermissions();
  const toast = useToast();
  const queryClient = useQueryClient();
  const range = useMemo(queryRange, []);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const canCreate = hasPermission('ADMIN.CALENDAR', 'CREATE');
  const canUpdate = hasPermission('ADMIN.CALENDAR', 'UPDATE');
  const canManage = hasPermission('ADMIN.CALENDAR', 'MANAGE');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<'active' | 'trash'>('active');
  const [calendarDialog, setCalendarDialog] = useState<CompanyCalendar | 'create' | null>(null);
  const [eventDialog, setEventDialog] = useState<CompanyCalendarEvent | 'create' | null>(null);
  const [deleting, setDeleting] = useState<CompanyCalendarEvent | null>(null);
  const [restoring, setRestoring] = useState<CompanyCalendarEvent | null>(null);
  const eventTabsId = useId();

  const calendarsQuery = useQuery({
    queryKey: ['calendar', 'admin', 'company-calendars'],
    queryFn: getCompanyCalendars,
    staleTime: 30_000,
    retry: 1,
  });
  useEffect(() => {
    if (selectedId && calendarsQuery.data?.some((calendar) => calendar.calendarId === selectedId)) {
      return;
    }
    setSelectedId(calendarsQuery.data?.[0]?.calendarId ?? null);
  }, [calendarsQuery.data, selectedId]);
  const selected =
    calendarsQuery.data?.find((calendar) => calendar.calendarId === selectedId) ?? null;
  const eventsQuery = useQuery({
    queryKey: ['calendar', 'admin', 'company-events', selectedId, tab, range],
    queryFn: () => getCompanyCalendarEvents(selectedId!, range.from, range.to, tab === 'trash'),
    enabled: Boolean(selectedId),
    staleTime: 15_000,
    retry: 1,
  });

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['calendar', 'admin', 'company-calendars'] }),
      queryClient.invalidateQueries({ queryKey: ['calendar', 'admin', 'company-events'] }),
      queryClient.invalidateQueries({ queryKey: ['calendar', 'calendars'] }),
      queryClient.invalidateQueries({ queryKey: ['calendar', 'events'] }),
    ]);
  };
  const calendarMutation = useMutation({
    mutationFn: (input: CompanyCalendarInput) =>
      calendarDialog === 'create'
        ? createCompanyCalendar(input)
        : updateCompanyCalendar((calendarDialog as CompanyCalendar).calendarId, input),
    onSuccess: async (saved) => {
      setCalendarDialog(null);
      setSelectedId(saved.calendarId);
      await invalidate();
      toast.success(t('company.calendarSaved'));
    },
    onError: () => toast.error(t('company.calendarSaveError')),
  });
  const eventMutation = useMutation({
    mutationFn: (input: CreateCalendarEventInput | UpdateCalendarEventInput) => {
      if (!selectedId) throw new Error(t('company.selectCalendar'));
      return eventDialog === 'create'
        ? createCompanyCalendarEvent(selectedId, input as CreateCalendarEventInput)
        : updateCompanyCalendarEvent(
            selectedId,
            (eventDialog as CompanyCalendarEvent).eventId,
            input as UpdateCalendarEventInput
          );
    },
    onSuccess: async () => {
      setEventDialog(null);
      await invalidate();
      toast.success(t('company.eventSaved'));
    },
    onError: () => toast.error(t('company.eventSaveError')),
  });
  const trashMutation = useMutation({
    mutationFn: (event: CompanyCalendarEvent) =>
      trashCompanyCalendarEvent(event.calendarId, event.eventId, event.version),
    onSuccess: async () => {
      setDeleting(null);
      await invalidate();
      toast.success(t('company.eventTrashed'));
    },
    onError: () => toast.error(t('company.eventTrashError')),
  });
  const restoreMutation = useMutation({
    mutationFn: (event: CompanyCalendarEvent) =>
      restoreCompanyCalendarEvent(event.calendarId, event.eventId, event.version),
    onSuccess: async () => {
      setRestoring(null);
      await invalidate();
      toast.success(t('company.eventRestored'));
    },
    onError: () => toast.error(t('company.eventRestoreError')),
  });
  const events = eventsQuery.data ?? [];

  return (
    <CalendarCanvas archetype="master-detail">
      <CalendarPageHeading
        icon={Building2}
        eyebrow={t('company.eyebrow')}
        title={t('company.title')}
        description={t('company.description')}
        actions={
          <Stack direction="row" spacing={1}>
            {canCreate && (
              <ActionButton
                intent="secondary"
                startIcon={<Building2 size={17} />}
                onClick={() => setCalendarDialog('create')}
              >
                {t('company.newCalendar')}
              </ActionButton>
            )}
            {canCreate && selected && (
              <ActionButton
                intent="primary"
                startIcon={<CalendarPlus size={17} />}
                onClick={() => setEventDialog('create')}
              >
                {t('company.publishEvent')}
              </ActionButton>
            )}
          </Stack>
        }
      />

      <Alert severity="info" icon={<ShieldCheck size={19} />} sx={{ mb: 2.5 }}>
        {t('company.governanceNotice')}
      </Alert>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '280px minmax(0, 1fr)' },
          gap: 2.5,
          alignItems: 'start',
        }}
      >
        {calendarsQuery.data?.length ? (
          <Box sx={{ display: { xs: 'block', lg: 'none' } }}>
            <SelectField
              label={t('company.calendarsLabel')}
              value={selectedId ?? ''}
              onValueChange={(value) => setSelectedId(String(value))}
              options={calendarsQuery.data.map((calendar) => ({
                value: calendar.calendarId,
                label: `${calendar.name} · ${t('company.eventCounts', {
                  active: calendar.upcomingEventCount,
                  trash: calendar.trashedEventCount,
                })}`,
              }))}
            />
          </Box>
        ) : null}
        <Box
          component="aside"
          sx={{
            display: {
              xs: calendarsQuery.data?.length ? 'none' : 'block',
              lg: 'block',
            },
            bgcolor: 'background.paper',
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            p: 1,
          }}
        >
          <Typography variant="overline" color="text.secondary" sx={{ px: 1.25 }}>
            {t('company.calendarsLabel')}
          </Typography>
          {calendarsQuery.isError ? (
            <Alert
              severity="error"
              action={
                <ActionButton intent="quiet" size="small" onClick={() => calendarsQuery.refetch()}>
                  {t('actions.retry')}
                </ActionButton>
              }
              sx={{ mt: 1 }}
            >
              {t('company.calendarsLoadError')}
            </Alert>
          ) : calendarsQuery.isLoading ? (
            <Stack spacing={1} sx={{ mt: 1 }}>
              <Skeleton variant="rounded" height={76} />
              <Skeleton variant="rounded" height={76} />
            </Stack>
          ) : calendarsQuery.data?.length ? (
            <Stack spacing={0.5} sx={{ mt: 0.5 }}>
              {calendarsQuery.data.map((calendar) => (
                <Box
                  key={calendar.calendarId}
                  component="button"
                  type="button"
                  aria-pressed={selectedId === calendar.calendarId}
                  onClick={() => setSelectedId(calendar.calendarId)}
                  sx={{
                    width: 1,
                    p: 1.25,
                    textAlign: 'left',
                    border: 0,
                    borderLeft: 3,
                    borderLeftColor:
                      selectedId === calendar.calendarId ? 'primary.main' : 'transparent',
                    borderRadius: 0.75,
                    bgcolor: (theme) =>
                      selectedId === calendar.calendarId
                        ? alpha(
                            theme.palette.primary.main,
                            theme.palette.mode === 'dark' ? 0.16 : 0.08
                          )
                        : 'transparent',
                    color: 'text.primary',
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'action.hover' },
                    '&:focus-visible': {
                      outline: '2px solid',
                      outlineColor: 'primary.main',
                      outlineOffset: 1,
                    },
                  }}
                >
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Box
                      sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: calendar.color }}
                    />
                    <Typography fontWeight={600} noWrap title={calendar.name} sx={{ flex: 1 }}>
                      {calendar.name}
                    </Typography>
                  </Stack>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mt: 0.5 }}
                  >
                    {t('company.eventCounts', {
                      active: calendar.upcomingEventCount,
                      trash: calendar.trashedEventCount,
                    })}
                  </Typography>
                </Box>
              ))}
            </Stack>
          ) : (
            <Box sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                {t('company.noCalendars')}
              </Typography>
              {canCreate && (
                <ActionButton
                  intent="quiet"
                  startIcon={<Plus size={16} />}
                  onClick={() => setCalendarDialog('create')}
                >
                  {t('company.createFirstCalendar')}
                </ActionButton>
              )}
            </Box>
          )}
        </Box>

        <Box sx={{ minWidth: 0 }}>
          {selected ? (
            <Box
              sx={{
                bgcolor: 'background.paper',
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                overflow: 'hidden',
              }}
            >
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                justifyContent="space-between"
                alignItems={{ xs: 'flex-start', sm: 'center' }}
                gap={1.5}
                sx={{ px: { xs: 2, sm: 2.5 }, pt: 2.25 }}
              >
                <Box>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Box
                      sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: selected.color }}
                    />
                    <Typography component="h2" variant="h6" fontWeight={600}>
                      {selected.name}
                    </Typography>
                    <Chip size="small" label={t('company.requiredForAll')} variant="outlined" />
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {t('company.calendarScopeDescription')}
                  </Typography>
                </Box>
                {canUpdate && (
                  <ActionButton
                    intent="quiet"
                    startIcon={<Pencil size={16} />}
                    onClick={() => setCalendarDialog(selected)}
                  >
                    {t('actions.edit')}
                  </ActionButton>
                )}
              </Stack>
              <Tabs
                value={tab}
                onChange={(_, value: 'active' | 'trash') => setTab(value)}
                aria-label={t('company.eventsTabsLabel')}
                sx={{ px: { xs: 1, sm: 2 }, mt: 1 }}
              >
                <Tab
                  id={`${eventTabsId}-active-tab`}
                  aria-controls={`${eventTabsId}-active-panel`}
                  value="active"
                  label={t('company.activeEvents')}
                />
                <Tab
                  id={`${eventTabsId}-trash-tab`}
                  aria-controls={`${eventTabsId}-trash-panel`}
                  value="trash"
                  label={t('company.trashEvents')}
                />
              </Tabs>
              <Divider />
              <Box
                role="tabpanel"
                id={`${eventTabsId}-${tab}-panel`}
                aria-labelledby={`${eventTabsId}-${tab}-tab`}
                tabIndex={0}
                sx={{ p: { xs: 1.5, sm: 2.5 } }}
              >
                {eventsQuery.isError ? (
                  <Alert
                    severity="error"
                    action={
                      <ActionButton
                        intent="quiet"
                        size="small"
                        onClick={() => eventsQuery.refetch()}
                      >
                        {t('actions.retry')}
                      </ActionButton>
                    }
                  >
                    {t('company.eventsLoadError')}
                  </Alert>
                ) : eventsQuery.isLoading ? (
                  <Stack spacing={1.25}>
                    <Skeleton variant="rounded" height={112} />
                    <Skeleton variant="rounded" height={112} />
                  </Stack>
                ) : events.length ? (
                  <Stack divider={<Divider flexItem />}>
                    {events.map((event) => (
                      <Box
                        key={event.eventId}
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) auto' },
                          gap: 1.5,
                          alignItems: 'center',
                          px: 0.5,
                          py: 1.75,
                        }}
                      >
                        <Box sx={{ minWidth: 0 }}>
                          <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
                            <Typography fontWeight={600}>{event.title}</Typography>
                            {event.importance === 'HIGH' && (
                              <Chip size="small" color="error" label={t('event.importance.HIGH')} />
                            )}
                            {event.legalHold && <Chip size="small" label={t('trash.legalHold')} />}
                          </Stack>
                          <Stack
                            direction="row"
                            spacing={0.75}
                            alignItems="center"
                            sx={{ mt: 0.5 }}
                            color="text.secondary"
                          >
                            <Clock3 size={14} />
                            <Typography variant="caption">
                              {calendarDate(event.startsAt, language)} ·{' '}
                              {calendarTime(event.startsAt, language)} –{' '}
                              {calendarTime(event.endsAt, language)}
                            </Typography>
                          </Stack>
                          {event.description && (
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              noWrap
                              sx={{ mt: 0.75 }}
                            >
                              {event.description}
                            </Typography>
                          )}
                        </Box>
                        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                          {tab === 'active' ? (
                            <>
                              {canUpdate && event.capabilities.canEdit && (
                                <ActionButton
                                  intent="quiet"
                                  size="small"
                                  onClick={() => setEventDialog(event)}
                                >
                                  {t('actions.edit')}
                                </ActionButton>
                              )}
                              {canManage && event.capabilities.canDelete && (
                                <ActionButton
                                  intent="danger"
                                  size="small"
                                  startIcon={<Trash2 size={15} />}
                                  onClick={() => setDeleting(event)}
                                >
                                  {t('company.moveToTrash')}
                                </ActionButton>
                              )}
                            </>
                          ) : (
                            <ActionButton
                              intent="secondary"
                              size="small"
                              startIcon={<ArchiveRestore size={15} />}
                              disabled={!canManage || !event.capabilities.canRestore}
                              onClick={() => setRestoring(event)}
                            >
                              {t('trash.restore')}
                            </ActionButton>
                          )}
                        </Stack>
                      </Box>
                    ))}
                  </Stack>
                ) : (
                  <Box sx={{ py: 7, textAlign: 'center' }}>
                    <Typography fontWeight={600}>
                      {t(tab === 'active' ? 'company.noActiveEvents' : 'company.noTrashEvents')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {t(
                        tab === 'active'
                          ? 'company.noActiveEventsDescription'
                          : 'company.noTrashEventsDescription'
                      )}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>
          ) : null}
        </Box>
      </Box>

      <CompanyCalendarDialog
        open={Boolean(calendarDialog)}
        calendar={calendarDialog === 'create' ? null : calendarDialog}
        busy={calendarMutation.isPending}
        error={
          calendarMutation.isError
            ? errorMessage(calendarMutation.error, t('company.calendarSaveError'))
            : null
        }
        onClose={() => setCalendarDialog(null)}
        onSave={(input) => calendarMutation.mutate(input)}
      />
      <CompanyEventDialog
        open={Boolean(eventDialog)}
        event={eventDialog === 'create' ? null : eventDialog}
        busy={eventMutation.isPending}
        error={
          eventMutation.isError
            ? errorMessage(eventMutation.error, t('company.eventSaveError'))
            : null
        }
        onClose={() => setEventDialog(null)}
        onCreate={(input) => eventMutation.mutate(input)}
        onUpdate={(input) => eventMutation.mutate(input)}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        title={t('company.trashTitle')}
        description={t('company.trashDescription', { title: deleting?.title })}
        cancelLabel={t('actions.cancel')}
        confirmLabel={t('company.moveToTrash')}
        confirmingLabel={t('company.trashing')}
        intent="danger"
        busy={trashMutation.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) trashMutation.mutate(deleting);
        }}
      />
      <ConfirmDialog
        open={Boolean(restoring)}
        title={t('trash.restoreTitle')}
        description={t('trash.restoreDescription', { title: restoring?.title })}
        cancelLabel={t('actions.cancel')}
        confirmLabel={t('trash.restore')}
        confirmingLabel={t('trash.restoring')}
        busy={restoreMutation.isPending}
        onClose={() => setRestoring(null)}
        onConfirm={() => {
          if (restoring) restoreMutation.mutate(restoring);
        }}
      />
    </CalendarCanvas>
  );
}
