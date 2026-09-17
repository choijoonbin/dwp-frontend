import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  BellRing,
  CalendarClock,
  CalendarRange,
  CheckCircle2,
  Clock3,
  Link2,
  LockKeyhole,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Star,
  Trash2,
  UserRoundCog,
  UserRoundPlus,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import {
  createCalendarDelegation,
  getCalendarDelegations,
  getCalendarPolicy,
  getCalendarSettings,
  getCalendars,
  listPeople,
  resetCalendarSettings,
  revokeCalendarDelegation,
  updateCalendarSettings,
  updateCalendarSubscription,
  useToast,
} from '@dwp-frontend/shared-utils';
import { timeZoneOptions, type TimeZonePreference } from '@dwp-frontend/shared-utils/regional-preference';
import {
  ActionButton,
  ActionIconButton,
  ConfirmDialog,
  SelectField,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import { usePersonalPreference } from '../../providers/personal-preference-provider';
import { CalendarPageHeading } from './calendar-components';
import { CalendarDelegationDialog } from './calendar-delegation-dialog';
import { CalendarCanvas, CalendarSectionHeader } from './calendar-experience';
import { calendarCanChangeSelection, calendarIsRequired } from './calendar-source-model';

import type {
  CalendarDayOfWeek,
  CalendarDelegation,
  CalendarSettingKey,
  CalendarSettings as CalendarSettingsData,
  CalendarSummary,
  CreateCalendarDelegationInput,
  UpdateCalendarSettingsInput,
} from '@dwp-frontend/shared-utils';

const DAYS: readonly CalendarDayOfWeek[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
];
const CALENDAR_TIME_ZONES = timeZoneOptions.filter(
  (value): value is Exclude<TimeZonePreference, 'system'> => value !== 'system'
);

function SettingSurface({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <Box
      component="section"
      sx={{
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: 1.5,
        overflow: 'hidden',
        boxShadow: (theme) =>
          theme.palette.mode === 'dark' ? 'none' : '0 12px 36px rgba(15, 35, 70, 0.035)',
        '@media (forced-colors: active)': { borderColor: 'CanvasText', boxShadow: 'none' },
      }}
    >
      {children}
    </Box>
  );
}

function calendarSourceLabel(calendar: CalendarSummary) {
  if (calendar.sourceKind === 'COMPANY' || calendar.type === 'SYSTEM') return 'company';
  if (calendar.sourceKind === 'SHARED') return 'shared';
  if (calendar.sourceKind === 'TEAM' || calendar.sourceKind === 'RESOURCE') return 'team';
  return 'mine';
}

function settingsInput(settings: CalendarSettingsData): UpdateCalendarSettingsInput {
  return {
    workingDays: [...settings.workingDays],
    workingDayStart: settings.workingDayStart.slice(0, 5),
    workingDayEnd: settings.workingDayEnd.slice(0, 5),
    timeZone: settings.timeZone,
    weekStart: settings.weekStart,
    defaultEventMinutes: settings.defaultEventMinutes,
    speedyMeetingMode: settings.speedyMeetingMode,
    defaultBufferMinutes: settings.defaultBufferMinutes,
    defaultVisibility: settings.defaultVisibility,
    defaultReminderMinutes: settings.defaultReminderMinutes,
    version: settings.version,
  };
}

function sameSettings(
  left: UpdateCalendarSettingsInput | null,
  right: CalendarSettingsData | undefined
) {
  if (!left || !right) return true;
  return JSON.stringify(left) === JSON.stringify(settingsInput(right));
}

function settingLocked(settings: CalendarSettingsData | undefined, key: CalendarSettingKey) {
  return settings?.governance.find((entry) => entry.key === key)?.locked === true;
}

function personInitials(name: string) {
  return name
    .trim()
    .split(/\s+/u)
    .slice(0, 2)
    .map((part) => part.slice(0, 1))
    .join('')
    .toUpperCase();
}

export function CalendarSettings() {
  const { t, i18n } = useTranslation('calendar');
  const toast = useToast();
  const queryClient = useQueryClient();
  const personalPreference = usePersonalPreference();
  const [draft, setDraft] = useState<UpdateCalendarSettingsInput | null>(null);
  const [delegationDialogOpen, setDelegationDialogOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<CalendarDelegation | null>(null);
  const [resetOpen, setResetOpen] = useState(false);

  const settingsQuery = useQuery({
    queryKey: ['calendar', 'settings'],
    queryFn: ({ signal }) => getCalendarSettings(signal),
    staleTime: 60_000,
    retry: 1,
  });
  const policyQuery = useQuery({
    queryKey: ['calendar', 'policy'],
    queryFn: getCalendarPolicy,
    staleTime: 5 * 60_000,
    retry: 1,
  });
  const calendarsQuery = useQuery({
    queryKey: ['calendar', 'calendars'],
    queryFn: ({ signal }) => getCalendars(signal),
    staleTime: 60_000,
    retry: 1,
  });
  const delegationsQuery = useQuery({
    queryKey: ['calendar', 'settings', 'delegations'],
    queryFn: ({ signal }) => getCalendarDelegations(signal),
    staleTime: 30_000,
    retry: 1,
  });
  const peopleQuery = useQuery({
    queryKey: ['calendar', 'settings', 'people-labels'],
    queryFn: ({ signal }) => listPeople({ size: 100, surface: 'directory', signal }),
    staleTime: 5 * 60_000,
    retry: 1,
  });
  const dirty = !sameSettings(draft, settingsQuery.data);

  useEffect(() => {
    if (!settingsQuery.data) return;
    setDraft((current) =>
      current && !sameSettings(current, settingsQuery.data)
        ? current
        : settingsInput(settingsQuery.data)
    );
  }, [settingsQuery.data]);

  const syncRegionalPreference = (saved: CalendarSettingsData) => {
    const timeZone = CALENDAR_TIME_ZONES.includes(
      saved.timeZone as (typeof CALENDAR_TIME_ZONES)[number]
    )
      ? (saved.timeZone as (typeof CALENDAR_TIME_ZONES)[number])
      : 'system';
    personalPreference.update({
      regional: {
        timeZone,
        firstDayOfWeek: saved.weekStart === 'SUNDAY' ? 'sunday' : 'monday',
      },
    });
  };
  const saveMutation = useMutation({
    mutationFn: updateCalendarSettings,
    onSuccess: (saved) => {
      queryClient.setQueryData(['calendar', 'settings'], saved);
      setDraft(settingsInput(saved));
      syncRegionalPreference(saved);
      toast.success(t('settings.saved'));
    },
    onError: async () => {
      await queryClient.invalidateQueries({ queryKey: ['calendar', 'settings'] });
      toast.error(t('settings.saveError'));
    },
  });
  const resetMutation = useMutation({
    mutationFn: resetCalendarSettings,
    onSuccess: (saved) => {
      queryClient.setQueryData(['calendar', 'settings'], saved);
      setDraft(settingsInput(saved));
      setResetOpen(false);
      syncRegionalPreference(saved);
      toast.success(t('settings.resetDone'));
    },
    onError: async () => {
      await queryClient.invalidateQueries({ queryKey: ['calendar', 'settings'] });
      toast.error(t('settings.resetError'));
    },
  });
  const subscriptionMutation = useMutation({
    mutationFn: ({ calendar, selected, favorite }: {
      calendar: CalendarSummary;
      selected: boolean;
      favorite: boolean;
    }) =>
      updateCalendarSubscription(calendar.calendarId, {
        selected,
        favorite,
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
      toast.success(t('settings.sources.updated'));
    },
    onError: async () => {
      await queryClient.invalidateQueries({ queryKey: ['calendar', 'calendars'] });
      toast.error(t('settings.sources.updateError'));
    },
  });
  const createDelegationMutation = useMutation({
    mutationFn: createCalendarDelegation,
    onSuccess: async () => {
      setDelegationDialogOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['calendar', 'settings', 'delegations'] });
      toast.success(t('settings.delegation.created'));
    },
    onError: () => toast.error(t('settings.delegation.createError')),
  });
  const revokeDelegationMutation = useMutation({
    mutationFn: (delegation: CalendarDelegation) =>
      revokeCalendarDelegation(delegation.delegationId, delegation.version),
    onSuccess: async () => {
      setRevokeTarget(null);
      await queryClient.invalidateQueries({ queryKey: ['calendar', 'settings', 'delegations'] });
      toast.success(t('settings.delegation.revoked'));
    },
    onError: () => toast.error(t('settings.delegation.revokeError')),
  });

  const sourceCounts = useMemo(() => {
    const calendars = calendarsQuery.data ?? [];
    return {
      total: calendars.length,
      selected: calendars.filter((calendar) => calendar.selected).length,
      shared: calendars.filter((calendar) => calendar.sourceKind === 'SHARED').length,
    };
  }, [calendarsQuery.data]);
  const peopleById = useMemo(
    () => new Map((peopleQuery.data?.items ?? []).map((person) => [person.personId, person])),
    [peopleQuery.data?.items]
  );
  const formatDelegationDate = (value: string) =>
    formatDate(
      value,
      { dateStyle: 'medium', timeStyle: 'short' },
      resolveSupportedLocale(i18n.resolvedLanguage, i18n.language)
    );
  const patchDraft = (patch: Partial<UpdateCalendarSettingsInput>) =>
    setDraft((current) => (current ? { ...current, ...patch } : current));
  const settingsBusy = saveMutation.isPending || resetMutation.isPending;

  if (settingsQuery.isLoading || !draft) {
    return (
      <CalendarCanvas archetype="policy">
        <Skeleton variant="rounded" height={104} />
        <Stack spacing={2} sx={{ mt: 2 }}>
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} variant="rounded" height={180} />
          ))}
        </Stack>
      </CalendarCanvas>
    );
  }

  if (settingsQuery.isError) {
    return (
      <CalendarCanvas archetype="policy">
        <CalendarPageHeading
          icon={Settings2}
          eyebrow={t('settings.eyebrow')}
          title={t('settings.title')}
          description={t('settings.description')}
        />
        <Alert
          severity="error"
          action={
            <ActionButton intent="quiet" size="small" onClick={() => settingsQuery.refetch()}>
              {t('actions.retry')}
            </ActionButton>
          }
        >
          {t('settings.loadError')}
        </Alert>
      </CalendarCanvas>
    );
  }

  const loadedSettings = settingsQuery.data;
  if (!loadedSettings) return null;

  return (
    <CalendarCanvas archetype="policy">
      <CalendarPageHeading
        icon={Settings2}
        eyebrow={t('settings.eyebrow')}
        title={t('settings.title')}
        description={t('settings.description')}
        actions={
          <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
            <Typography variant="caption" color="text.secondary" role="status">
              {settingsBusy
                ? t('settings.saveState.saving')
                : dirty
                  ? t('settings.saveState.dirty')
                  : t('settings.saveState.ready')}
            </Typography>
            <ActionButton
              intent="secondary"
              startIcon={<RotateCcw size={16} />}
              disabled={settingsBusy}
              onClick={() => setResetOpen(true)}
            >
              {t('settings.reset')}
            </ActionButton>
            <ActionButton
              intent="secondary"
              disabled={!dirty || settingsBusy}
              onClick={() => setDraft(settingsInput(loadedSettings))}
            >
              {t('settings.discard')}
            </ActionButton>
            <ActionButton
              intent="primary"
              startIcon={<CheckCircle2 size={17} />}
              loading={saveMutation.isPending}
              disabled={
                !dirty ||
                settingsBusy ||
                draft.workingDays.length === 0 ||
                draft.workingDayEnd <= draft.workingDayStart
              }
              onClick={() => saveMutation.mutate(draft)}
            >
              {t('settings.save')}
            </ActionButton>
          </Stack>
        }
      />

      <Stack spacing={2}>
        <Alert severity="info" icon={<ShieldCheck size={19} />}>
          {t('settings.governanceNotice')}
        </Alert>

        <SettingSurface>
          <CalendarSectionHeader
            icon={Clock3}
            title={t('settings.working.title')}
            description={t('settings.working.description')}
            meta={<Chip size="small" variant="outlined" label={t('settings.personal')} />}
          />
          <Divider />
          <Box sx={{ px: { xs: 2, md: 2.5 }, py: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              {t('settings.working.days')}
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(4, minmax(0, 1fr))', sm: 'repeat(7, 1fr)' },
                gap: 0.75,
              }}
            >
              {DAYS.map((day) => {
                const selected = draft.workingDays.includes(day);
                return (
                  <FormControlLabel
                    key={day}
                    label={t(`settings.days.${day}`)}
                    labelPlacement="bottom"
                    control={
                      <Checkbox
                        checked={selected}
                        disabled={settingLocked(settingsQuery.data, 'WORKING_DAYS')}
                        onChange={(_, checked) =>
                          patchDraft({
                            workingDays: checked
                              ? DAYS.filter((value) =>
                                  value === day ? true : draft.workingDays.includes(value)
                                )
                              : draft.workingDays.filter((value) => value !== day),
                          })
                        }
                      />
                    }
                    sx={(theme) => ({
                      m: 0,
                      minWidth: 0,
                      minHeight: 64,
                      py: 0.5,
                      borderRadius: 1,
                      border: 1,
                      borderColor: selected ? 'primary.main' : 'divider',
                      bgcolor: selected
                        ? alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.18 : 0.07)
                        : 'transparent',
                      '& .MuiCheckbox-root': { p: 0.25 },
                      '& .MuiFormControlLabel-label': {
                        fontSize: 12,
                        fontWeight: selected ? 700 : 500,
                      },
                    })}
                  />
                );
              })}
            </Box>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr 1fr',
                  md: '180px 180px minmax(220px, 1fr) 180px',
                },
                gap: 1.5,
                mt: 2,
              }}
            >
              <TextField
                type="time"
                label={t('settings.working.start')}
                value={draft.workingDayStart}
                disabled={settingLocked(settingsQuery.data, 'WORKING_DAY_START')}
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { step: 300 } }}
                onChange={(event) => patchDraft({ workingDayStart: event.target.value })}
              />
              <TextField
                type="time"
                label={t('settings.working.end')}
                value={draft.workingDayEnd}
                disabled={settingLocked(settingsQuery.data, 'WORKING_DAY_END')}
                error={draft.workingDayEnd <= draft.workingDayStart}
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { step: 300 } }}
                onChange={(event) => patchDraft({ workingDayEnd: event.target.value })}
              />
              <SelectField<string>
                label={t('settings.working.timeZone')}
                value={draft.timeZone}
                disabled={settingLocked(settingsQuery.data, 'TIME_ZONE')}
                options={CALENDAR_TIME_ZONES.map((value) => ({ value, label: value }))}
                onValueChange={(value) => value && patchDraft({ timeZone: value })}
              />
              <SelectField<CalendarDayOfWeek>
                label={t('settings.working.weekStart')}
                value={draft.weekStart}
                disabled={settingLocked(settingsQuery.data, 'WEEK_START')}
                options={DAYS.map((value) => ({
                  value,
                  label: t(`settings.daysLong.${value}`),
                }))}
                onValueChange={(value) => value && patchDraft({ weekStart: value })}
              />
            </Box>
          </Box>
        </SettingSurface>

        <SettingSurface>
          <CalendarSectionHeader
            icon={CalendarClock}
            title={t('settings.defaults.title')}
            description={t('settings.defaults.description')}
            meta={
              <Chip
                size="small"
                color="success"
                variant="outlined"
                label={t('settings.productivity')}
              />
            }
          />
          <Divider />
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
              gap: 2,
              px: { xs: 2, md: 2.5 },
              py: 2,
            }}
          >
            <Stack spacing={1.5}>
              <SelectField<number>
                label={t('settings.defaults.duration')}
                value={draft.defaultEventMinutes}
                disabled={settingLocked(settingsQuery.data, 'DEFAULT_EVENT_MINUTES')}
                options={[25, 30, 45, 50, 60, 90].map((value) => ({
                  value,
                  label: t('units.minutes', { count: value }),
                }))}
                onValueChange={(value) => value && patchDraft({ defaultEventMinutes: value })}
              />
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                gap={2}
                sx={{ p: 1.25, borderRadius: 1, bgcolor: 'action.hover' }}
              >
                <Box>
                  <Typography variant="body2" fontWeight={650}>
                    {t('settings.defaults.speedy')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('settings.defaults.speedyHint')}
                  </Typography>
                </Box>
                <Switch
                  checked={draft.speedyMeetingMode === 'FIVE_TEN'}
                  disabled={settingLocked(settingsQuery.data, 'SPEEDY_MEETING_MODE')}
                  slotProps={{ input: { 'aria-label': t('settings.defaults.speedy') } }}
                  onChange={(_, checked) =>
                    patchDraft({ speedyMeetingMode: checked ? 'FIVE_TEN' : 'STANDARD' })
                  }
                />
              </Stack>
              <SelectField<number>
                label={t('settings.defaults.buffer')}
                value={draft.defaultBufferMinutes}
                disabled={settingLocked(settingsQuery.data, 'DEFAULT_BUFFER_MINUTES')}
                options={[0, 5, 10, 15, 30].map((value) => ({
                  value,
                  label: value
                    ? t('units.minutes', { count: value })
                    : t('settings.defaults.none'),
                }))}
                onValueChange={(value) => {
                  if (typeof value === 'number') patchDraft({ defaultBufferMinutes: value });
                }}
              />
            </Stack>
            <Stack spacing={1.5}>
              <SelectField<UpdateCalendarSettingsInput['defaultVisibility']>
                label={t('settings.defaults.visibility')}
                value={draft.defaultVisibility}
                disabled={settingLocked(settingsQuery.data, 'DEFAULT_VISIBILITY')}
                options={(['FREE_BUSY', 'DETAILS', 'PRIVATE'] as const).map((value) => ({
                  value,
                  label: t(`settings.defaults.visibilityOptions.${value}`),
                }))}
                onValueChange={(value) => value && patchDraft({ defaultVisibility: value })}
              />
              <SelectField<number>
                label={t('settings.defaults.reminder')}
                value={draft.defaultReminderMinutes}
                disabled={settingLocked(settingsQuery.data, 'DEFAULT_REMINDER_MINUTES')}
                options={[0, 5, 10, 15, 30, 60].map((value) => ({
                  value,
                  label: value
                    ? t('settings.defaults.before', { count: value })
                    : t('settings.defaults.none'),
                }))}
                onValueChange={(value) => {
                  if (typeof value === 'number') patchDraft({ defaultReminderMinutes: value });
                }}
              />
              <Box
                sx={(theme) => ({
                  p: 1.25,
                  borderRadius: 1,
                  bgcolor: alpha(
                    theme.palette.info.main,
                    theme.palette.mode === 'dark' ? 0.12 : 0.05
                  ),
                  border: 1,
                  borderColor: alpha(theme.palette.info.main, 0.22),
                })}
              >
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <LockKeyhole size={17} aria-hidden="true" />
                  <Box>
                    <Typography variant="body2" fontWeight={650}>
                      {t('settings.inherited')}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {policyQuery.data
                        ? t('settings.policySummary', {
                            min: policyQuery.data.minimumEventMinutes,
                            max: policyQuery.data.maximumEventMinutes,
                            days: policyQuery.data.maximumAdvanceDays,
                          })
                        : t('settings.policyUnavailable')}
                    </Typography>
                  </Box>
                </Stack>
              </Box>
            </Stack>
          </Box>
        </SettingSurface>

        <SettingSurface>
          <CalendarSectionHeader
            icon={UserRoundCog}
            title={t('settings.delegation.title')}
            description={t('settings.delegation.description')}
            meta={
              <ActionButton
                intent="secondary"
                size="small"
                startIcon={<UserRoundPlus size={16} />}
                disabled={delegationsQuery.isError}
                onClick={() => setDelegationDialogOpen(true)}
              >
                {t('settings.delegation.add')}
              </ActionButton>
            }
          />
          <Divider />
          <Alert severity="warning" icon={<ShieldCheck size={18} />} sx={{ borderRadius: 0 }}>
            {t('settings.delegation.guardrail')}
          </Alert>
          {delegationsQuery.isError ? (
            <Alert
              severity="error"
              action={
                <ActionButton
                  intent="quiet"
                  size="small"
                  onClick={() => delegationsQuery.refetch()}
                >
                  {t('actions.retry')}
                </ActionButton>
              }
            >
              {t('settings.delegation.loadError')}
            </Alert>
          ) : delegationsQuery.isLoading ? (
            <Stack spacing={1} sx={{ p: 2 }}>
              <Skeleton height={64} />
              <Skeleton height={64} />
            </Stack>
          ) : (delegationsQuery.data ?? []).length ? (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                gap: 1,
                p: 2,
              }}
            >
              {(delegationsQuery.data ?? []).map((delegation) => {
                const person = peopleById.get(delegation.delegatePersonPublicId);
                const name = person?.displayName ?? t('settings.delegation.unknownPerson');
                const revocable = ['ACTIVE', 'SCHEDULED'].includes(delegation.status);
                return (
                  <Stack
                    key={delegation.delegationId}
                    direction="row"
                    alignItems="center"
                    spacing={1.25}
                    sx={{ p: 1.25, border: 1, borderColor: 'divider', borderRadius: 1 }}
                  >
                    <Avatar
                      sx={{
                        width: 36,
                        height: 36,
                        fontSize: 13,
                        bgcolor: 'action.selected',
                        color: 'text.primary',
                        '@media (forced-colors: active)': {
                          bgcolor: 'Canvas',
                          color: 'CanvasText',
                          border: '1px solid CanvasText',
                        },
                      }}
                    >
                      {personInitials(name)}
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack
                        direction="row"
                        spacing={0.75}
                        flexWrap="wrap"
                        alignItems="center"
                      >
                        <Typography variant="body2" fontWeight={700} noWrap>
                          {name}
                        </Typography>
                        <Chip
                          size="small"
                          label={t(`settings.delegation.status.${delegation.status}`)}
                        />
                      </Stack>
                      <Typography variant="caption" color="text.secondary" display="block" noWrap>
                        {delegation.scopes
                          .map((scope) => t(`settings.delegation.scope.${scope}.short`))
                          .join(' · ')}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {formatDelegationDate(delegation.validFrom)} –{' '}
                        {formatDelegationDate(delegation.validUntil)}
                      </Typography>
                    </Box>
                    {revocable ? (
                      <ActionIconButton
                        size="small"
                        label={t('settings.delegation.revokeFor', { name })}
                        intent="danger"
                        onClick={() => setRevokeTarget(delegation)}
                      >
                        <Trash2 size={16} />
                      </ActionIconButton>
                    ) : null}
                  </Stack>
                );
              })}
            </Box>
          ) : (
            <Stack spacing={0.5} alignItems="flex-start" sx={{ p: 2.5 }}>
              <Typography variant="subtitle2">
                {t('settings.delegation.emptyTitle')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('settings.delegation.emptyDescription')}
              </Typography>
            </Stack>
          )}
        </SettingSurface>

        <SettingSurface>
          <CalendarSectionHeader
            icon={CalendarRange}
            title={t('settings.sources.title')}
            description={t('settings.sources.description')}
            meta={
              calendarsQuery.data ? (
                <Typography variant="caption" color="text.secondary">
                  {t('settings.sources.summary', sourceCounts)}
                </Typography>
              ) : undefined
            }
          />
          <Divider />
          {calendarsQuery.isError ? (
            <Alert
              severity="warning"
              action={
                <ActionButton intent="quiet" size="small" onClick={() => calendarsQuery.refetch()}>
                  {t('actions.retry')}
                </ActionButton>
              }
            >
              {t('settings.sources.loadError')}
            </Alert>
          ) : calendarsQuery.isLoading ? (
            <Stack spacing={1} sx={{ p: 2 }}>
              {Array.from({ length: 3 }, (_, index) => (
                <Skeleton key={index} height={52} />
              ))}
            </Stack>
          ) : (
            <Stack divider={<Divider flexItem />}>
              {(calendarsQuery.data ?? []).map((calendar) => {
                const required = calendarIsRequired(calendar);
                const busy =
                  subscriptionMutation.isPending &&
                  subscriptionMutation.variables?.calendar.calendarId === calendar.calendarId;
                return (
                  <Stack
                    key={calendar.calendarId}
                    direction="row"
                    alignItems="center"
                    spacing={1.25}
                    sx={{ px: { xs: 2, md: 2.5 }, py: 1.25, minHeight: 64 }}
                  >
                    <Box
                      aria-hidden="true"
                      sx={{ width: 8, height: 32, borderRadius: 999, bgcolor: calendar.color }}
                    />
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Stack direction="row" alignItems="center" spacing={0.75} flexWrap="wrap">
                        <Typography variant="body2" fontWeight={650} noWrap title={calendar.name}>
                          {calendar.name}
                        </Typography>
                        {required ? (
                          <Chip size="small" variant="outlined" label={t('sources.required')} />
                        ) : null}
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        {t(`sources.groups.${calendarSourceLabel(calendar)}`)}
                      </Typography>
                    </Box>
                    <ActionIconButton
                      size="small"
                      label={t('settings.sources.favoriteFor', { name: calendar.name })}
                      disabled={busy}
                      onClick={() =>
                        subscriptionMutation.mutate({
                          calendar,
                          selected: calendar.selected,
                          favorite: !(calendar.favorite ?? false),
                        })
                      }
                    >
                      <Star
                        size={17}
                        fill={calendar.favorite ? 'currentColor' : 'none'}
                        aria-hidden="true"
                      />
                    </ActionIconButton>
                    <Switch
                      checked={required || calendar.selected}
                      disabled={
                        busy || (calendar.selected && !calendarCanChangeSelection(calendar, false))
                      }
                      slotProps={{
                        input: {
                          'aria-label': t('settings.sources.visibleFor', { name: calendar.name }),
                        },
                      }}
                      onChange={(_, selected) =>
                        subscriptionMutation.mutate({
                          calendar,
                          selected,
                          favorite: calendar.favorite ?? false,
                        })
                      }
                    />
                  </Stack>
                );
              })}
              {(calendarsQuery.data ?? []).length === 0 ? (
                <Typography color="text.secondary" sx={{ p: 2.5 }}>
                  {t('settings.sources.empty')}
                </Typography>
              ) : null}
            </Stack>
          )}
          <Divider />
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'stretch', sm: 'center' }}
            gap={1}
            sx={{ px: { xs: 2, md: 2.5 }, py: 1.5 }}
          >
            <Typography variant="caption" color="text.secondary">
              {t('settings.sources.manageHint')}
            </Typography>
            <ActionButton
              component={Link}
              to="/calendar/schedule"
              intent="secondary"
              startIcon={<Link2 size={16} />}
            >
              {t('settings.sources.openCalendar')}
            </ActionButton>
          </Stack>
        </SettingSurface>

        <SettingSurface>
          <CalendarSectionHeader
            icon={BellRing}
            title={t('settings.notifications.title')}
            description={t('settings.notifications.description')}
            meta={
              <Chip
                size="small"
                color="success"
                variant="outlined"
                label={t('settings.availableElsewhere')}
              />
            }
          />
          <Divider />
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'stretch', sm: 'center' }}
            gap={1.5}
            sx={{ px: { xs: 2, md: 2.5 }, py: 2 }}
          >
            <Typography variant="body2" color="text.secondary">
              {t('settings.notifications.ownerHint')}
            </Typography>
            <ActionButton component={Link} to="/notifications/settings" intent="secondary">
              {t('settings.notifications.open')}
            </ActionButton>
          </Stack>
        </SettingSurface>
      </Stack>

      <CalendarDelegationDialog
        open={delegationDialogOpen}
        existing={delegationsQuery.data ?? []}
        busy={createDelegationMutation.isPending}
        onClose={() => setDelegationDialogOpen(false)}
        onSubmit={(input: CreateCalendarDelegationInput) =>
          createDelegationMutation.mutate(input)
        }
      />
      <ConfirmDialog
        open={Boolean(revokeTarget)}
        title={t('settings.delegation.revokeTitle')}
        description={t('settings.delegation.revokeDescription')}
        cancelLabel={t('actions.cancel')}
        confirmLabel={t('settings.delegation.revoke')}
        confirmingLabel={t('settings.delegation.revoking')}
        intent="danger"
        busy={revokeDelegationMutation.isPending}
        onClose={() => setRevokeTarget(null)}
        onConfirm={() => {
          if (revokeTarget) revokeDelegationMutation.mutate(revokeTarget);
        }}
      />
      <ConfirmDialog
        open={resetOpen}
        title={t('settings.resetTitle')}
        description={t('settings.resetDescription')}
        cancelLabel={t('actions.cancel')}
        confirmLabel={t('settings.reset')}
        confirmingLabel={t('settings.resetting')}
        busy={resetMutation.isPending}
        onClose={() => setResetOpen(false)}
        onConfirm={() => resetMutation.mutate(loadedSettings.version)}
      />
    </CalendarCanvas>
  );
}
