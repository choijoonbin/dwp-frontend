import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  Building2,
  CalendarCheck2,
  Check,
  Clock3,
  Pencil,
  Plus,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  decideCalendarBooking,
  getCalendarAdminOverview,
  getPendingCalendarBookings,
  saveCalendarResource,
  updateCalendarPolicy,
  usePermissions,
  useToast,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  ActionIconButton,
  EmptyState,
  ErrorState,
  FormDialog,
  FormField,
  PageCanvas,
  SelectField,
  SignalMetric,
  TimePickerField,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';

import { CalendarPageHeading, calendarDate, calendarTime } from './calendar-components';

import type {
  CalendarBooking,
  CalendarPolicy,
  CalendarResource,
  CalendarResourceInput,
  CalendarResourceState,
  CalendarResourceType,
} from '@dwp-frontend/shared-utils';

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function AdminLoading() {
  return (
    <Stack spacing={2}>
      <Skeleton variant="rounded" height={126} />
      <Skeleton variant="rounded" height={360} />
    </Stack>
  );
}

function ScopeNotice() {
  const { t } = useTranslation('calendar');
  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2 }} color="text.secondary">
      <ShieldCheck size={15} />
      <Typography variant="caption">{t('admin.privacyBoundary')}</Typography>
    </Stack>
  );
}

export function CalendarAdminOverview() {
  const { t, i18n } = useTranslation('calendar');
  const { hasPermission } = usePermissions();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [decision, setDecision] = useState<{
    booking: CalendarBooking;
    value: 'APPROVE' | 'DECLINE';
  } | null>(null);
  const [note, setNote] = useState('');
  const canDecide = hasPermission('ADMIN.CALENDAR', 'MANAGE');
  const language = i18n.resolvedLanguage ?? i18n.language;
  const overview = useQuery({
    queryKey: ['calendar', 'admin', 'overview'],
    queryFn: getCalendarAdminOverview,
    staleTime: 20_000,
    retry: 1,
  });
  const bookings = useQuery({
    queryKey: ['calendar', 'admin', 'bookings', 'pending'],
    queryFn: getPendingCalendarBookings,
    staleTime: 15_000,
    retry: 1,
  });
  const mutation = useMutation({
    mutationFn: () => {
      if (!decision) throw new Error(t('admin.bookingDecisionMissing'));
      return decideCalendarBooking(
        decision.booking.bookingId,
        decision.value,
        note.trim(),
        decision.booking.version
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['calendar', 'admin'] });
      toast.success(t('admin.bookingDecisionSaved'));
      setDecision(null);
      setNote('');
    },
    onError: (error) => toast.error(errorMessage(error, t('admin.bookingDecisionError'))),
  });

  return (
    <PageCanvas>
      <CalendarPageHeading
        eyebrow={t('admin.overview.eyebrow')}
        title={t('admin.overview.title')}
        description={t('admin.overview.description')}
      />
      {overview.isError || bookings.isError ? (
        <ErrorState
          title={t('admin.loadError')}
          description={t('error.description')}
          retryLabel={t('actions.retry')}
          onRetry={() => {
            void overview.refetch();
            void bookings.refetch();
          }}
        />
      ) : overview.isLoading || bookings.isLoading || !overview.data ? (
        <AdminLoading />
      ) : (
        <Stack spacing={2.5}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, minmax(0, 1fr))',
                xl: 'repeat(4, minmax(0, 1fr))',
              },
              gap: 1.5,
            }}
          >
            <SignalMetric
              label={t('admin.metrics.activeResources')}
              value={String(overview.data.activeResources)}
              detail={t('admin.metrics.maintenance', {
                count: overview.data.resourcesInMaintenance,
              })}
              icon={<Building2 size={17} />}
              tone="primary"
            />
            <SignalMetric
              label={t('admin.metrics.weekBookings')}
              value={String(overview.data.bookingsThisWeek)}
              detail={t('admin.metrics.currentWeek')}
              icon={<CalendarCheck2 size={17} />}
              tone="info"
            />
            <SignalMetric
              label={t('admin.metrics.pendingBookings')}
              value={String(overview.data.pendingBookings)}
              detail={t('admin.metrics.decisionRequired')}
              icon={<Clock3 size={17} />}
              tone={overview.data.pendingBookings ? 'warning' : 'neutral'}
            />
            <SignalMetric
              label={t('admin.metrics.conflictedPeople')}
              value={String(overview.data.conflictedUsers)}
              detail={t('admin.metrics.aggregateOnly')}
              icon={<AlertTriangle size={17} />}
              tone={overview.data.conflictedUsers ? 'error' : 'neutral'}
            />
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
            <Box
              sx={{
                p: 2.25,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 2,
              }}
            >
              <Box>
                <Typography component="h2" variant="h6" fontWeight={800}>
                  {t('admin.pending.title')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('admin.pending.description')}
                </Typography>
              </Box>
              <Chip
                size="small"
                variant="outlined"
                color={bookings.data?.length ? 'warning' : 'success'}
                label={t('admin.pending.count', { count: bookings.data?.length ?? 0 })}
              />
            </Box>
            <Divider />
            {bookings.data?.length ? (
              <TableContainer>
                <Table size="small" aria-label={t('admin.pending.title')}>
                  <TableHead>
                    <TableRow>
                      <TableCell>{t('admin.pending.resource')}</TableCell>
                      <TableCell>{t('admin.pending.schedule')}</TableCell>
                      <TableCell>{t('admin.pending.requester')}</TableCell>
                      <TableCell align="right">{t('admin.pending.actions')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {bookings.data.map((booking) => (
                      <TableRow key={booking.bookingId} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight={750}>
                            {booking.resourceName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {booking.eventTitle}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {calendarDate(booking.startsAt, language)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {calendarTime(booking.startsAt, language)} –{' '}
                            {calendarTime(booking.endsAt, language)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{booking.organizerName}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {booking.organizerEmail ?? t('admin.pending.internal')}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          {canDecide ? (
                            <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                              <ActionIconButton
                                label={t('admin.pending.approve')}
                                intent="primary"
                                onClick={() => setDecision({ booking, value: 'APPROVE' })}
                              >
                                <Check size={17} />
                              </ActionIconButton>
                              <ActionIconButton
                                label={t('admin.pending.decline')}
                                onClick={() => setDecision({ booking, value: 'DECLINE' })}
                              >
                                <X size={17} />
                              </ActionIconButton>
                            </Stack>
                          ) : (
                            <Chip size="small" variant="outlined" label={t('admin.readOnly')} />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <EmptyState
                title={t('admin.pending.emptyTitle')}
                description={t('admin.pending.emptyDescription')}
              />
            )}
          </Box>
          <ScopeNotice />
        </Stack>
      )}

      <FormDialog
        open={Boolean(decision)}
        title={t(
          decision?.value === 'DECLINE'
            ? 'admin.pending.declineTitle'
            : 'admin.pending.approveTitle'
        )}
        description={
          decision
            ? t('admin.pending.decisionDescription', { resource: decision.booking.resourceName })
            : undefined
        }
        cancelLabel={t('actions.cancel')}
        submitLabel={t(
          decision?.value === 'DECLINE' ? 'admin.pending.decline' : 'admin.pending.approve'
        )}
        submittingLabel={t('actions.saving')}
        submitIntent={decision?.value === 'DECLINE' ? 'danger' : 'primary'}
        submitDisabled={decision?.value === 'DECLINE' && !note.trim()}
        busy={mutation.isPending}
        onClose={() => {
          setDecision(null);
          setNote('');
        }}
        onSubmit={() => mutation.mutate()}
      >
        <FormField
          multiline
          minRows={3}
          required={decision?.value === 'DECLINE'}
          label={t('admin.pending.noteLabel')}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          supportingText={t('admin.pending.noteHint')}
          inputProps={{ maxLength: 1000 }}
        />
      </FormDialog>
    </PageCanvas>
  );
}

type ResourceForm = {
  code: string;
  nameKo: string;
  nameEn: string;
  type: CalendarResourceType;
  site: string;
  floor: string;
  capacity: number;
  features: string;
  timeZone: string;
  approvalRequired: boolean;
  state: CalendarResourceState;
};

function resourceForm(resource?: CalendarResource | null): ResourceForm {
  return {
    code: resource?.code ?? '',
    nameKo: resource?.nameKo ?? '',
    nameEn: resource?.nameEn ?? '',
    type: resource?.type ?? 'ROOM',
    site: resource?.site ?? '',
    floor: resource?.floor ?? '',
    capacity: resource?.capacity ?? 4,
    features: resource?.features.join(', ') ?? '',
    timeZone: resource?.timeZone ?? 'Asia/Seoul',
    approvalRequired: resource?.approvalRequired ?? false,
    state: resource?.state ?? 'AVAILABLE',
  };
}

export function CalendarAdminResources() {
  const { t } = useTranslation('calendar');
  const { hasPermission } = usePermissions();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<CalendarResource | 'new' | null>(null);
  const [form, setForm] = useState<ResourceForm>(resourceForm());
  const query = useQuery({
    queryKey: ['calendar', 'admin', 'overview'],
    queryFn: getCalendarAdminOverview,
    staleTime: 20_000,
    retry: 1,
  });
  const canCreate = hasPermission('ADMIN.CALENDAR', 'CREATE');
  const canUpdate = hasPermission('ADMIN.CALENDAR', 'UPDATE');
  const valid = Boolean(
    form.code.match(/^[A-Z0-9][A-Z0-9_-]{2,79}$/) &&
      form.nameKo.trim() &&
      form.nameEn.trim() &&
      form.site.trim() &&
      form.capacity > 0
  );
  const mutation = useMutation({
    mutationFn: () => {
      const current = editing === 'new' ? null : editing;
      const input: CalendarResourceInput = {
        code: form.code.trim(),
        nameKo: form.nameKo.trim(),
        nameEn: form.nameEn.trim(),
        type: form.type,
        site: form.site.trim(),
        floor: form.floor.trim() || null,
        capacity: form.capacity,
        features: form.features
          .split(',')
          .map((value) => value.trim().toUpperCase())
          .filter(Boolean),
        timeZone: form.timeZone,
        approvalRequired: form.approvalRequired,
        state: form.state,
        version: current?.version ?? null,
      };
      return saveCalendarResource(current?.resourceId ?? null, input);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['calendar'] });
      toast.success(t('admin.resources.saved'));
      setEditing(null);
    },
    onError: (error) => toast.error(errorMessage(error, t('admin.resources.saveError'))),
  });
  const open = (resource: CalendarResource | 'new') => {
    setEditing(resource);
    setForm(resourceForm(resource === 'new' ? null : resource));
  };

  return (
    <PageCanvas>
      <CalendarPageHeading
        eyebrow={t('admin.resources.eyebrow')}
        title={t('admin.resources.title')}
        description={t('admin.resources.description')}
        actions={
          canCreate ? (
            <ActionButton
              intent="primary"
              startIcon={<Plus size={17} />}
              onClick={() => open('new')}
            >
              {t('admin.resources.add')}
            </ActionButton>
          ) : undefined
        }
      />
      {query.isError ? (
        <ErrorState
          title={t('admin.loadError')}
          retryLabel={t('actions.retry')}
          onRetry={() => query.refetch()}
        />
      ) : query.isLoading || !query.data ? (
        <AdminLoading />
      ) : (
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
          <TableContainer>
            <Table aria-label={t('admin.resources.title')}>
              <TableHead>
                <TableRow>
                  <TableCell>{t('admin.resources.resource')}</TableCell>
                  <TableCell>{t('admin.resources.location')}</TableCell>
                  <TableCell>{t('admin.resources.capacity')}</TableCell>
                  <TableCell>{t('admin.resources.bookingPolicy')}</TableCell>
                  <TableCell>{t('admin.resources.state')}</TableCell>
                  <TableCell align="right">{t('admin.resources.actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {query.data.resources.map((resource) => (
                  <TableRow key={resource.resourceId} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={750}>
                        {resource.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {resource.code} · {t(`resources.types.${resource.type}`)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {resource.site}
                      {resource.floor ? ` · ${resource.floor}` : ''}
                    </TableCell>
                    <TableCell>{t('resources.capacity', { count: resource.capacity })}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        variant="outlined"
                        color={resource.approvalRequired ? 'warning' : 'success'}
                        label={t(
                          resource.approvalRequired
                            ? 'resources.approvalRequired'
                            : 'resources.instantBooking'
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        variant="outlined"
                        label={t(`admin.resources.states.${resource.state}`)}
                      />
                    </TableCell>
                    <TableCell align="right">
                      {canUpdate ? (
                        <ActionIconButton label={t('actions.edit')} onClick={() => open(resource)}>
                          <Pencil size={17} />
                        </ActionIconButton>
                      ) : (
                        <Chip size="small" variant="outlined" label={t('admin.readOnly')} />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}
      <ScopeNotice />

      <FormDialog
        open={Boolean(editing)}
        title={t(editing === 'new' ? 'admin.resources.createTitle' : 'admin.resources.editTitle')}
        description={t('admin.resources.formDescription')}
        cancelLabel={t('actions.cancel')}
        submitLabel={t('actions.save')}
        submittingLabel={t('actions.saving')}
        busy={mutation.isPending}
        submitDisabled={!valid}
        onClose={() => setEditing(null)}
        onSubmit={() => mutation.mutate()}
        maxWidth="md"
      >
        <Stack spacing={2}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <FormField
              required
              label={t('admin.resources.codeLabel')}
              value={form.code}
              onChange={(event) =>
                setForm((value) => ({ ...value, code: event.target.value.toUpperCase() }))
              }
              supportingText={t('admin.resources.codeHint')}
              inputProps={{ maxLength: 80 }}
            />
            <SelectField
              label={t('admin.resources.typeLabel')}
              value={form.type}
              onValueChange={(value) =>
                setForm((current) => ({ ...current, type: value as CalendarResourceType }))
              }
              options={['ROOM', 'DESK', 'EQUIPMENT'].map((value) => ({
                value,
                label: t(`resources.types.${value}`),
              }))}
            />
            <FormField
              required
              label={t('admin.resources.nameKoLabel')}
              value={form.nameKo}
              onChange={(event) => setForm((value) => ({ ...value, nameKo: event.target.value }))}
            />
            <FormField
              required
              label={t('admin.resources.nameEnLabel')}
              value={form.nameEn}
              onChange={(event) => setForm((value) => ({ ...value, nameEn: event.target.value }))}
            />
            <FormField
              required
              label={t('admin.resources.siteLabel')}
              value={form.site}
              onChange={(event) => setForm((value) => ({ ...value, site: event.target.value }))}
            />
            <FormField
              label={t('admin.resources.floorLabel')}
              value={form.floor}
              onChange={(event) => setForm((value) => ({ ...value, floor: event.target.value }))}
            />
            <FormField
              required
              type="number"
              label={t('admin.resources.capacityLabel')}
              value={form.capacity}
              onChange={(event) =>
                setForm((value) => ({ ...value, capacity: Number(event.target.value) }))
              }
              inputProps={{ min: 1, max: 10000 }}
            />
            <SelectField
              label={t('admin.resources.stateLabel')}
              value={form.state}
              onValueChange={(value) =>
                setForm((current) => ({ ...current, state: value as CalendarResourceState }))
              }
              options={['AVAILABLE', 'MAINTENANCE', 'RETIRED'].map((value) => ({
                value,
                label: t(`admin.resources.states.${value}`),
              }))}
            />
          </Box>
          <FormField
            label={t('admin.resources.featuresLabel')}
            value={form.features}
            onChange={(event) => setForm((value) => ({ ...value, features: event.target.value }))}
            supportingText={t('admin.resources.featuresHint')}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={form.approvalRequired}
                onChange={(event) =>
                  setForm((value) => ({ ...value, approvalRequired: event.target.checked }))
                }
              />
            }
            label={t('admin.resources.approvalLabel')}
          />
        </Stack>
      </FormDialog>
    </PageCanvas>
  );
}

export function CalendarAdminPolicies() {
  const { t } = useTranslation('calendar');
  const { hasPermission } = usePermissions();
  const toast = useToast();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['calendar', 'admin', 'overview'],
    queryFn: getCalendarAdminOverview,
    staleTime: 20_000,
    retry: 1,
  });
  const [form, setForm] = useState<CalendarPolicy | null>(null);
  const canManage = hasPermission('ADMIN.CALENDAR', 'MANAGE');
  useEffect(() => {
    if (query.data?.policy) setForm(query.data.policy);
  }, [query.data?.policy]);
  const valid = Boolean(
    form &&
      form.workingDayStart < form.workingDayEnd &&
      form.minimumEventMinutes <= form.defaultEventMinutes &&
      form.defaultEventMinutes <= form.maximumEventMinutes
  );
  const mutation = useMutation({
    mutationFn: () => {
      if (!form) throw new Error(t('admin.policies.missing'));
      return updateCalendarPolicy(form);
    },
    onSuccess: async (saved) => {
      setForm(saved);
      await queryClient.invalidateQueries({ queryKey: ['calendar'] });
      toast.success(t('admin.policies.saved'));
    },
    onError: (error) => toast.error(errorMessage(error, t('admin.policies.saveError'))),
  });

  return (
    <PageCanvas>
      <CalendarPageHeading
        eyebrow={t('admin.policies.eyebrow')}
        title={t('admin.policies.title')}
        description={t('admin.policies.description')}
        actions={
          canManage ? (
            <ActionButton
              intent="primary"
              startIcon={<SlidersHorizontal size={17} />}
              loading={mutation.isPending}
              disabled={!valid}
              onClick={() => mutation.mutate()}
            >
              {t('actions.save')}
            </ActionButton>
          ) : undefined
        }
      />
      {query.isError ? (
        <ErrorState
          title={t('admin.loadError')}
          retryLabel={t('actions.retry')}
          onRetry={() => query.refetch()}
        />
      ) : query.isLoading || !form ? (
        <AdminLoading />
      ) : (
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
          {!canManage && <Alert severity="info">{t('admin.policies.readOnlyHint')}</Alert>}
          <Box
            sx={{
              p: { xs: 2, md: 3 },
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) minmax(0, 1fr)' },
              columnGap: 4,
              rowGap: 2.25,
            }}
          >
            <SelectField
              disabled={!canManage}
              label={t('admin.policies.weekStart')}
              value={form.weekStart}
              onValueChange={(value) => setForm({ ...form, weekStart: Number(value) })}
              options={[1, 7].map((value) => ({
                value,
                label: t(value === 1 ? 'admin.policies.monday' : 'admin.policies.sunday'),
              }))}
            />
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <TimePickerField
                disabled={!canManage}
                label={t('admin.policies.workStart')}
                value={form.workingDayStart}
                onValueChange={(value) => value && setForm({ ...form, workingDayStart: value })}
              />
              <TimePickerField
                disabled={!canManage}
                label={t('admin.policies.workEnd')}
                value={form.workingDayEnd}
                onValueChange={(value) => value && setForm({ ...form, workingDayEnd: value })}
              />
            </Box>
            <FormField
              disabled={!canManage}
              type="number"
              label={t('admin.policies.defaultDuration')}
              value={form.defaultEventMinutes}
              onChange={(event) =>
                setForm({ ...form, defaultEventMinutes: Number(event.target.value) })
              }
              inputProps={{ min: 5, max: 1440, step: 5 }}
            />
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <FormField
                disabled={!canManage}
                type="number"
                label={t('admin.policies.minimumDuration')}
                value={form.minimumEventMinutes}
                onChange={(event) =>
                  setForm({ ...form, minimumEventMinutes: Number(event.target.value) })
                }
                inputProps={{ min: 5, max: 1440, step: 5 }}
              />
              <FormField
                disabled={!canManage}
                type="number"
                label={t('admin.policies.maximumDuration')}
                value={form.maximumEventMinutes}
                onChange={(event) =>
                  setForm({ ...form, maximumEventMinutes: Number(event.target.value) })
                }
                inputProps={{ min: 5, max: 1440, step: 5 }}
              />
            </Box>
            <FormField
              disabled={!canManage}
              type="number"
              label={t('admin.policies.advanceDays')}
              value={form.maximumAdvanceDays}
              onChange={(event) =>
                setForm({ ...form, maximumAdvanceDays: Number(event.target.value) })
              }
              inputProps={{ min: 1, max: 1095 }}
            />
            <FormField
              disabled={!canManage}
              type="number"
              label={t('admin.policies.bufferMinutes')}
              value={form.defaultBufferMinutes}
              onChange={(event) =>
                setForm({ ...form, defaultBufferMinutes: Number(event.target.value) })
              }
              inputProps={{ min: 0, max: 120, step: 5 }}
            />
            <FormField
              disabled={!canManage}
              type="number"
              label={t('admin.policies.focusTarget')}
              value={form.weeklyFocusTargetMinutes}
              onChange={(event) =>
                setForm({ ...form, weeklyFocusTargetMinutes: Number(event.target.value) })
              }
              inputProps={{ min: 0, max: 6000, step: 30 }}
            />
            <FormField
              disabled={!canManage}
              type="number"
              label={t('admin.policies.meetingLimit')}
              value={form.dailyMeetingLimitMinutes}
              onChange={(event) =>
                setForm({ ...form, dailyMeetingLimitMinutes: Number(event.target.value) })
              }
              inputProps={{ min: 30, max: 1440, step: 30 }}
            />
          </Box>
          <Divider />
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            gap={3}
            sx={{ px: { xs: 2, md: 3 }, py: 2 }}
          >
            <FormControlLabel
              disabled={!canManage}
              control={
                <Checkbox
                  checked={form.enforceMeetingAgenda}
                  onChange={(event) =>
                    setForm({ ...form, enforceMeetingAgenda: event.target.checked })
                  }
                />
              }
              label={t('admin.policies.enforceAgenda')}
            />
            <FormControlLabel
              disabled={!canManage}
              control={
                <Checkbox
                  checked={form.allowExternalAttendees}
                  onChange={(event) =>
                    setForm({ ...form, allowExternalAttendees: event.target.checked })
                  }
                />
              }
              label={t('admin.policies.externalAttendees')}
            />
          </Stack>
        </Box>
      )}
      <ScopeNotice />
    </PageCanvas>
  );
}
