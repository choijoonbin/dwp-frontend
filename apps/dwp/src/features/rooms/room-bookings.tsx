import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarCheck2, CalendarX2, Clock3, MapPin, Pencil, UsersRound } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  cancelRoomBooking,
  getRoomBookings,
  respondToRoomBooking,
  useAuth,
  useToast,
} from '@dwp-frontend/shared-utils';
import { ActionButton, ConfirmDialog, EmptyState, PageCanvas } from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';

import { RoomBookingDialog } from './room-booking-dialog';
import { useRoomsCapabilities } from './rooms-capabilities';
import { RoomsPageHeading, RoomsPermissionNotice } from './rooms-ui';

import type { CalendarEvent } from '@dwp-frontend/shared-utils';

type BookingFilter = 'upcoming' | 'past';

function queryRange(filter: BookingFilter) {
  const now = new Date();
  const from = new Date(now);
  const to = new Date(now);
  if (filter === 'upcoming') {
    to.setDate(to.getDate() + 365);
  } else {
    from.setDate(from.getDate() - 365);
  }
  return { from: from.toISOString(), to: to.toISOString() };
}

export function RoomBookings() {
  const { t, i18n } = useTranslation('rooms');
  const auth = useAuth();
  const capabilities = useRoomsCapabilities();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<BookingFilter>('upcoming');
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [cancelling, setCancelling] = useState<CalendarEvent | null>(null);
  const range = useMemo(() => queryRange(filter), [filter]);
  const eventsQuery = useQuery({
    queryKey: ['rooms', 'my-bookings', range.from, range.to],
    queryFn: () => getRoomBookings(range.from, range.to),
    staleTime: 20_000,
    retry: 1,
  });
  const now = Date.now();
  const roomEvents = (eventsQuery.data ?? [])
    .filter((event) => event.resource?.type === 'ROOM')
    .filter((event) =>
      filter === 'upcoming'
        ? Date.parse(event.endsAt) >= now && event.status !== 'CANCELLED'
        : Date.parse(event.endsAt) < now || event.status === 'CANCELLED'
    )
    .sort((left, right) =>
      filter === 'upcoming'
        ? Date.parse(left.startsAt) - Date.parse(right.startsAt)
        : Date.parse(right.startsAt) - Date.parse(left.startsAt)
    );
  const isOrganizer = (event: CalendarEvent) =>
    event.organizerPersonPublicId
      ? event.organizerPersonPublicId === auth.user?.personPublicId
      : event.organizerUserId === auth.user?.userId;
  const format = (value: string) =>
    formatDate(
      value,
      { dateStyle: 'medium', timeStyle: 'short' },
      resolveSupportedLocale(i18n.resolvedLanguage)
    );

  const cancelMutation = useMutation({
    mutationFn: (event: CalendarEvent) => cancelRoomBooking(event.eventId, event.version),
    onSuccess: async () => {
      setCancelling(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['rooms'] }),
        queryClient.invalidateQueries({ queryKey: ['calendar'] }),
      ]);
      toast.success(t('my.cancelled'));
    },
    onError: () => toast.error(t('my.cancelError')),
  });
  const responseMutation = useMutation({
    mutationFn: ({
      event,
      response,
    }: {
      event: CalendarEvent;
      response: 'ACCEPTED' | 'DECLINED';
    }) => respondToRoomBooking(event.eventId, response),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['rooms', 'my-bookings'] });
      toast.success(t('my.responseSaved'));
    },
    onError: () => toast.error(t('my.responseError')),
  });

  return (
    <PageCanvas>
      <RoomsPageHeading
        eyebrow={t('my.eyebrow')}
        title={t('my.title')}
        description={t('my.description')}
      />
      {capabilities.isLoaded && !capabilities.canUpdateRoomBooking && (
        <RoomsPermissionNotice>{t('permissions.roomUpdateReadOnly')}</RoomsPermissionNotice>
      )}
      <Box
        sx={{
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          overflow: 'hidden',
        }}
      >
        <Tabs
          value={filter}
          onChange={(_, value: BookingFilter) => setFilter(value)}
          sx={{ px: 1.5, borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab value="upcoming" label={t('my.upcoming')} />
          <Tab value="past" label={t('my.past')} />
        </Tabs>
        {eventsQuery.isLoading ? (
          <Stack spacing={1} p={2}>
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} variant="rounded" height={118} />
            ))}
          </Stack>
        ) : eventsQuery.isError ? (
          <Alert
            severity="error"
            action={
              <ActionButton intent="quiet" onClick={() => eventsQuery.refetch()}>
                {t('actions.retry')}
              </ActionButton>
            }
          >
            {t('my.loadError')}
          </Alert>
        ) : roomEvents.length === 0 ? (
          <EmptyState
            icon={filter === 'upcoming' ? <CalendarCheck2 size={28} /> : <CalendarX2 size={28} />}
            title={t(filter === 'upcoming' ? 'my.emptyUpcoming' : 'my.emptyPast')}
            description={t('my.emptyDescription')}
          />
        ) : (
          roomEvents.map((event, index) => {
            const organizer = isOrganizer(event);
            return (
              <Box
                key={`${event.eventId}:${event.startsAt}`}
                sx={{ p: { xs: 1.5, md: 2 }, borderTop: index ? 1 : 0, borderColor: 'divider' }}
              >
                <Stack
                  direction={{ xs: 'column', lg: 'row' }}
                  justifyContent="space-between"
                  gap={2}
                >
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
                      <Typography component="h2" variant="subtitle1" fontWeight={800}>
                        {event.title}
                      </Typography>
                      <Chip
                        size="small"
                        variant="outlined"
                        label={organizer ? t('my.organizer') : t('my.invited')}
                      />
                      {event.resource?.approvalRequired && (
                        <Chip
                          size="small"
                          color="warning"
                          variant="outlined"
                          label={t('my.approvalRequired')}
                        />
                      )}
                      {event.status === 'CANCELLED' && (
                        <Chip
                          size="small"
                          color="error"
                          variant="outlined"
                          label={t('my.cancelledState')}
                        />
                      )}
                    </Stack>
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      gap={{ xs: 0.75, sm: 2 }}
                      sx={{ mt: 1 }}
                      color="text.secondary"
                    >
                      <Stack direction="row" gap={0.6} alignItems="center">
                        <Clock3 size={15} />
                        <Typography variant="body2">
                          {format(event.startsAt)} - {format(event.endsAt)}
                        </Typography>
                      </Stack>
                      <Stack direction="row" gap={0.6} alignItems="center">
                        <MapPin size={15} />
                        <Typography variant="body2">{event.resource?.name}</Typography>
                      </Stack>
                      <Stack direction="row" gap={0.6} alignItems="center">
                        <UsersRound size={15} />
                        <Typography variant="body2">
                          {t('my.attendeeCount', { count: event.attendees.length })}
                        </Typography>
                      </Stack>
                    </Stack>
                    {event.description && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1.25 }} noWrap>
                        {event.description}
                      </Typography>
                    )}
                  </Box>
                  <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
                    {capabilities.canUpdateRoomBooking &&
                      !organizer &&
                      event.myResponse === 'NEEDS_ACTION' && (
                        <>
                          <ActionButton
                            intent="secondary"
                            onClick={() => responseMutation.mutate({ event, response: 'DECLINED' })}
                          >
                            {t('my.decline')}
                          </ActionButton>
                          <ActionButton
                            intent="primary"
                            onClick={() => responseMutation.mutate({ event, response: 'ACCEPTED' })}
                          >
                            {t('my.accept')}
                          </ActionButton>
                        </>
                      )}
                    {capabilities.canUpdateRoomBooking &&
                      organizer &&
                      event.status !== 'CANCELLED' && (
                        <>
                          <ActionButton
                            intent="secondary"
                            startIcon={<Pencil size={16} />}
                            onClick={() => setEditing(event)}
                          >
                            {t('actions.edit')}
                          </ActionButton>
                          <ActionButton intent="danger" onClick={() => setCancelling(event)}>
                            {t('actions.cancelBooking')}
                          </ActionButton>
                        </>
                      )}
                  </Stack>
                </Stack>
                {index < roomEvents.length - 1 && <Divider sx={{ display: 'none' }} />}
              </Box>
            );
          })
        )}
      </Box>

      <RoomBookingDialog
        open={Boolean(editing)}
        room={editing?.resource ?? null}
        event={editing}
        onClose={() => setEditing(null)}
      />
      <ConfirmDialog
        open={Boolean(cancelling)}
        title={t('my.cancelTitle')}
        description={t('my.cancelDescription')}
        cancelLabel={t('actions.keep')}
        confirmLabel={t('actions.cancelBooking')}
        confirmingLabel={t('actions.cancelling')}
        intent="danger"
        busy={cancelMutation.isPending}
        onClose={() => setCancelling(null)}
        onConfirm={() => {
          if (cancelling) cancelMutation.mutate(cancelling);
        }}
      />
    </PageCanvas>
  );
}
