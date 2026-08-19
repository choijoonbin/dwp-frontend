import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarCheck2, CheckCircle2, Clock3, LogOut, MapPin, XCircle } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  cancelWorkplaceBooking,
  checkInWorkplaceBooking,
  getWorkplaceBookings,
  releaseWorkplaceBooking,
  useToast,
} from '@dwp-frontend/shared-utils';
import { ActionButton, ConfirmDialog, EmptyState, PageCanvas } from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';

import { RoomsPageHeading } from './rooms-ui';

import type { WorkplaceBooking } from '@dwp-frontend/shared-utils';

type BookingFilter = 'upcoming' | 'past';
type BookingAction = { booking: WorkplaceBooking; action: 'cancel' | 'release' };

const TERMINAL_BOOKING_STATUSES = ['COMPLETED', 'NO_SHOW', 'CANCELLED', 'RELEASED'] as const;

function bookingRange(filter: BookingFilter) {
  const from = new Date();
  const to = new Date();
  if (filter === 'upcoming') to.setFullYear(to.getFullYear() + 1);
  else from.setFullYear(from.getFullYear() - 1);
  return { from: from.toISOString(), to: to.toISOString() };
}

export function WorkplaceBookings() {
  const { t, i18n } = useTranslation('rooms');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<BookingFilter>('upcoming');
  const [confirming, setConfirming] = useState<BookingAction | null>(null);
  const range = useMemo(() => bookingRange(filter), [filter]);
  const query = useQuery({
    queryKey: ['workplace', 'bookings', range.from, range.to],
    queryFn: () => getWorkplaceBookings(range.from, range.to),
    staleTime: 20_000,
    refetchInterval: 60_000,
    retry: 1,
  });
  const now = Date.now();
  const bookings = (query.data ?? [])
    .filter((booking) =>
      filter === 'upcoming'
        ? Date.parse(booking.endsAt) >= now && !TERMINAL_BOOKING_STATUSES.includes(
            booking.status as (typeof TERMINAL_BOOKING_STATUSES)[number]
          )
        : Date.parse(booking.endsAt) < now || TERMINAL_BOOKING_STATUSES.includes(
            booking.status as (typeof TERMINAL_BOOKING_STATUSES)[number]
          )
    )
    .sort((left, right) =>
      filter === 'upcoming'
        ? Date.parse(left.startsAt) - Date.parse(right.startsAt)
        : Date.parse(right.startsAt) - Date.parse(left.startsAt)
    );
  const format = (value: string) =>
    formatDate(
      value,
      { dateStyle: 'medium', timeStyle: 'short' },
      resolveSupportedLocale(i18n.resolvedLanguage)
    );

  const changeMutation = useMutation({
    mutationFn: ({ booking, action }: BookingAction | { booking: WorkplaceBooking; action: 'check-in' }) => {
      if (action === 'check-in') return checkInWorkplaceBooking(booking.bookingId, booking.version);
      if (action === 'release') return releaseWorkplaceBooking(booking.bookingId, booking.version);
      return cancelWorkplaceBooking(booking.bookingId, booking.version);
    },
    onSuccess: async (_, variables) => {
      setConfirming(null);
      await queryClient.invalidateQueries({ queryKey: ['workplace'] });
      toast.success(t(`workplace.my.${variables.action}Saved`));
    },
    onError: () => toast.error(t('workplace.my.actionError')),
  });

  return (
    <PageCanvas>
      <RoomsPageHeading
        eyebrow={t('workplace.my.eyebrow')}
        title={t('workplace.my.title')}
        description={t('workplace.my.description')}
      />
      <Box sx={{ border: 1, borderColor: 'divider', bgcolor: 'background.paper', overflow: 'hidden' }}>
        <Tabs
          value={filter}
          onChange={(_, value: BookingFilter) => setFilter(value)}
          sx={{ px: 1.5, borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab value="upcoming" label={t('my.upcoming')} />
          <Tab value="past" label={t('my.past')} />
        </Tabs>
        {query.isLoading && (
          <Stack spacing={1} p={2}>{[0, 1, 2].map((value) => <Skeleton key={value} height={112} />)}</Stack>
        )}
        {query.isError && (
          <Alert severity="error" action={<ActionButton intent="quiet" onClick={() => query.refetch()}>{t('actions.retry')}</ActionButton>}>
            {t('workplace.my.loadError')}
          </Alert>
        )}
        {!query.isLoading && !query.isError && bookings.length === 0 && (
          <EmptyState
            icon={<CalendarCheck2 size={28} />}
            title={t(filter === 'upcoming' ? 'workplace.my.emptyUpcoming' : 'workplace.my.emptyPast')}
            description={t('workplace.my.emptyDescription')}
          />
        )}
        {bookings.map((booking, index) => {
          return (
            <Box
              key={booking.bookingId}
              sx={{ p: { xs: 1.5, md: 2 }, borderTop: index ? 1 : 0, borderColor: 'divider' }}
            >
              <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" gap={2}>
                <Box sx={{ minWidth: 0 }}>
                  <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
                    <Typography component="h2" variant="subtitle1" fontWeight={800}>{booking.resourceName}</Typography>
                    <Chip size="small" variant="outlined" label={t(`workplace.resourceTypes.${booking.resourceType}`)} />
                    <Chip size="small" color={booking.status === 'CHECKED_IN' ? 'success' : 'default'} label={t(`workplace.bookingStatus.${booking.status}`)} />
                  </Stack>
                  <Stack direction={{ xs: 'column', sm: 'row' }} gap={{ xs: 0.6, sm: 2 }} sx={{ mt: 1 }} color="text.secondary">
                    <Stack direction="row" gap={0.6} alignItems="center"><Clock3 size={15} /><Typography variant="body2">{format(booking.startsAt)} - {format(booking.endsAt)}</Typography></Stack>
                    <Stack direction="row" gap={0.6} alignItems="center"><MapPin size={15} /><Typography variant="body2">{booking.siteName} · {booking.floorName}</Typography></Stack>
                  </Stack>
                  {booking.purpose && <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{booking.purpose}</Typography>}
                </Box>
                {filter === 'upcoming' && (
                  <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
                    {booking.canCheckIn && (
                      <ActionButton intent="primary" startIcon={<CheckCircle2 size={16} />} onClick={() => changeMutation.mutate({ booking, action: 'check-in' })}>
                        {t('workplace.my.checkIn')}
                      </ActionButton>
                    )}
                    {booking.canRelease && (
                      <ActionButton intent="secondary" startIcon={<LogOut size={16} />} onClick={() => setConfirming({ booking, action: 'release' })}>
                        {t('workplace.my.release')}
                      </ActionButton>
                    )}
                    {booking.canCancel && (
                      <ActionButton intent="danger" startIcon={<XCircle size={16} />} onClick={() => setConfirming({ booking, action: 'cancel' })}>
                        {t('actions.cancelBooking')}
                      </ActionButton>
                    )}
                  </Stack>
                )}
              </Stack>
            </Box>
          );
        })}
      </Box>
      <ConfirmDialog
        open={Boolean(confirming)}
        title={t(confirming?.action === 'release' ? 'workplace.my.releaseTitle' : 'workplace.my.cancelTitle')}
        description={t(confirming?.action === 'release' ? 'workplace.my.releaseDescription' : 'workplace.my.cancelDescription')}
        cancelLabel={t('actions.keep')}
        confirmLabel={t(confirming?.action === 'release' ? 'workplace.my.release' : 'actions.cancelBooking')}
        confirmingLabel={t('actions.saving')}
        intent={confirming?.action === 'release' ? 'primary' : 'danger'}
        busy={changeMutation.isPending}
        onClose={() => setConfirming(null)}
        onConfirm={() => {
          if (confirming) changeMutation.mutate(confirming);
        }}
      />
    </PageCanvas>
  );
}
