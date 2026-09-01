import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Building2, CalendarCheck2, Clock3, ShieldCheck } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  decideCalendarBooking,
  getCalendarAdminOverview,
  getPendingCalendarBookings,
  usePermissions,
  useToast,
} from '@dwp-frontend/shared-utils';
import { ErrorState, FormDialog, FormField } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';

import { CalendarAdminBookingInbox } from './calendar-admin-booking-inbox';
import { CalendarMetric, CalendarPageHeading } from './calendar-components';
import { AdminLoading, errorMessage, ScopeNotice } from './calendar-admin-support';
import { CalendarCanvas } from './calendar-experience';

import type { CalendarBooking } from '@dwp-frontend/shared-utils';

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
