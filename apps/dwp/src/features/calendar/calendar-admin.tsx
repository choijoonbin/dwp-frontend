import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  Building2,
  CalendarCheck2,
  Clock3,
  Pencil,
  Plus,
  ShieldCheck,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  decideCalendarBooking,
  getCalendarAdminOverview,
  getPendingCalendarBookings,
  saveCalendarResource,
  usePermissions,
  useToast,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  ActionIconButton,
  ErrorState,
  FormDialog,
  FormField,
  SelectField,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
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

import { CalendarAdminBookingInbox } from './calendar-admin-booking-inbox';
import { CalendarMetric, CalendarPageHeading } from './calendar-components';
import { AdminLoading, errorMessage, ScopeNotice } from './calendar-admin-support';
import { CalendarCanvas } from './calendar-experience';

import type {
  CalendarBooking,
  CalendarResource,
  CalendarResourceInput,
  CalendarResourceState,
  CalendarResourceType,
} from '@dwp-frontend/shared-utils';

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
    <CalendarCanvas archetype="command">
      <CalendarPageHeading
        icon={ShieldCheck}
        eyebrow={t('admin.overview.eyebrow')}
        title={t('admin.overview.title')}
        description={t('admin.overview.description')}
      />
      {overview.isError && bookings.isError ? (
        <ErrorState
          title={t('admin.loadError')}
          description={t('error.description')}
          retryLabel={t('actions.retry')}
          onRetry={() => {
            void overview.refetch();
            void bookings.refetch();
          }}
        />
      ) : overview.isLoading && bookings.isLoading ? (
        <AdminLoading />
      ) : (
        <Stack spacing={2.5}>
          {bookings.isError ? (
            <ErrorState
              title={t('admin.pending.title')}
              description={t('error.description')}
              retryLabel={t('actions.retry')}
              onRetry={() => bookings.refetch()}
            />
          ) : bookings.isLoading ? (
            <Skeleton variant="rounded" height={300} />
          ) : (
            <CalendarAdminBookingInbox
              bookings={bookings.data ?? []}
              canDecide={canDecide}
              language={language}
              onDecide={(booking, value) => setDecision({ booking, value })}
            />
          )}
          {overview.isError ? (
            <ErrorState
              title={t('admin.overview.title')}
              description={t('error.description')}
              retryLabel={t('actions.retry')}
              onRetry={() => overview.refetch()}
            />
          ) : overview.isLoading || !overview.data ? (
            <Skeleton variant="rounded" height={128} />
          ) : (
            <Box
              component="section"
              aria-label={t('admin.overview.title')}
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
              <CalendarMetric
                label={t('admin.metrics.activeResources')}
                value={String(overview.data.activeResources)}
                hint={t('admin.metrics.maintenance', {
                  count: overview.data.resourcesInMaintenance,
                })}
                icon={Building2}
                tone="primary"
              />
              <CalendarMetric
                label={t('admin.metrics.weekBookings')}
                value={String(overview.data.bookingsThisWeek)}
                hint={t('admin.metrics.currentWeek')}
                icon={CalendarCheck2}
                tone="info"
              />
              <CalendarMetric
                label={t('admin.metrics.pendingBookings')}
                value={String(overview.data.pendingBookings)}
                hint={t('admin.metrics.decisionRequired')}
                icon={Clock3}
                tone={overview.data.pendingBookings ? 'warning' : 'neutral'}
              />
              <CalendarMetric
                label={t('admin.metrics.conflictedPeople')}
                value={String(overview.data.conflictedUsers)}
                hint={t('admin.metrics.aggregateOnly')}
                icon={AlertTriangle}
                tone={overview.data.conflictedUsers ? 'error' : 'neutral'}
              />
            </Box>
          )}
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
    </CalendarCanvas>
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
    <CalendarCanvas archetype="master-detail">
      <CalendarPageHeading
        icon={Building2}
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
                      <Typography variant="body2" fontWeight={600}>
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
    </CalendarCanvas>
  );
}
