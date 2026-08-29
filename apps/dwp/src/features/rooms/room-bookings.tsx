import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { CalendarCheck2, CalendarX2, Clock3, MapPin, Pencil, UsersRound } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  cancelRoomBooking,
  getRoomBookings,
  getRoomsPolicy,
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
import { roomBookingActionPolicy } from './room-booking-action-policy';
import { useRoomsCapabilities } from './rooms-capabilities';
import { RoomsPageHeading, RoomsPermissionNotice } from './rooms-ui';
import { retryRecoverableWorkplaceRead } from './workplace-authority-failure';
import { workplaceHomeSourceData, workplaceHomeSourceState } from './workplace-home-source-state';

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

function roomBookingTargetId(eventId: string) {
  return `room-booking-${eventId.replace(/[^a-zA-Z0-9_-]/gu, '-')}`;
}

export function RoomBookings() {
  const { t, i18n } = useTranslation('rooms');
  const auth = useAuth();
  const identityKey = `${auth.user?.tenantId ?? 'anonymous'}:${auth.user?.userId ?? 'anonymous'}`;
  const activeIdentityRef = useRef(identityKey);
  activeIdentityRef.current = identityKey;
  const capabilities = useRoomsCapabilities();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const requestedEventId = searchParams.get('event');
  const [filter, setFilter] = useState<BookingFilter>('upcoming');
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [cancelling, setCancelling] = useState<CalendarEvent | null>(null);
  const range = useMemo(() => queryRange(filter), [filter]);
  const eventsQuery = useQuery({
    queryKey: ['rooms', 'my-bookings', identityKey, range.from, range.to],
    queryFn: () => getRoomBookings(range.from, range.to),
    staleTime: 20_000,
    refetchInterval: 60_000,
    retry: retryRecoverableWorkplaceRead,
  });
  const policyQuery = useQuery({
    queryKey: ['rooms', 'policy', identityKey],
    queryFn: getRoomsPolicy,
    enabled: capabilities.isLoaded && capabilities.canViewRooms,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: retryRecoverableWorkplaceRead,
  });
  const eventsSourceState = workplaceHomeSourceState({
    data: eventsQuery.data,
    error: eventsQuery.error,
    failureCount: eventsQuery.failureCount,
    failureReason: eventsQuery.failureReason,
    isError: eventsQuery.isError,
    isPending: eventsQuery.isPending,
    required: true,
  });
  const policySourceState = workplaceHomeSourceState({
    data: policyQuery.data,
    error: policyQuery.error,
    failureCount: policyQuery.failureCount,
    failureReason: policyQuery.failureReason,
    isError: policyQuery.isError,
    isPending: policyQuery.isPending,
    required: capabilities.isLoaded && capabilities.canViewRooms,
  });
  const eventsSourceStateRef = useRef(eventsSourceState);
  eventsSourceStateRef.current = eventsSourceState;
  const verifiedEvents = workplaceHomeSourceData(eventsSourceState, eventsQuery.data);
  const verifiedPolicy = workplaceHomeSourceData(policySourceState, policyQuery.data);
  const now = Date.now();
  const roomEvents = (verifiedEvents ?? [])
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
  const currentEditing = editing
    ? (eventsQuery.data?.find(
        (event) => event.eventId === editing.eventId && event.version === editing.version
      ) ?? null)
    : null;
  const currentCancelling = cancelling
    ? (eventsQuery.data?.find(
        (event) => event.eventId === cancelling.eventId && event.version === cancelling.version
      ) ?? null)
    : null;
  useEffect(() => {
    setEditing(null);
    setCancelling(null);
  }, [identityKey]);
  useEffect(() => {
    if (eventsSourceState !== 'READY') {
      setCancelling(null);
      if (eventsSourceState === 'DENIED') setEditing(null);
      return;
    }
    if (editing && !currentEditing) setEditing(null);
    if (cancelling && !currentCancelling) setCancelling(null);
  }, [cancelling, currentCancelling, currentEditing, editing, eventsSourceState]);
  useEffect(() => {
    if (policySourceState === 'DENIED') setEditing(null);
  }, [policySourceState]);
  const requestedEventVisible = roomEvents.some((event) => event.eventId === requestedEventId);
  useEffect(() => {
    if (!requestedEventId || !requestedEventVisible) return;
    const frame = window.requestAnimationFrame(() => {
      const target = document.getElementById(roomBookingTargetId(requestedEventId));
      target?.scrollIntoView({ block: 'center' });
      target?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [requestedEventId, requestedEventVisible]);
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
    mutationFn: ({
      event,
      identityKey: commandIdentityKey,
    }: {
      event: CalendarEvent;
      identityKey: string;
    }) => {
      const current = eventsQuery.data?.find(
        (candidate) => candidate.eventId === event.eventId && candidate.version === event.version
      );
      if (
        commandIdentityKey !== activeIdentityRef.current ||
        eventsSourceStateRef.current !== 'READY' ||
        !current ||
        !roomBookingActionPolicy(current, capabilities.canUpdateRoomBooking).canCancel
      ) {
        throw new Error(t('permissions.roomUpdateReadOnly'));
      }
      return cancelRoomBooking(current.eventId, current.version);
    },
    onSuccess: async (_, variables) => {
      if (variables.identityKey !== activeIdentityRef.current) return;
      setCancelling(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['rooms'] }),
        queryClient.invalidateQueries({ queryKey: ['calendar'] }),
      ]);
      toast.success(t('my.cancelled'));
    },
    onError: (_, variables) => {
      if (variables.identityKey === activeIdentityRef.current) toast.error(t('my.cancelError'));
    },
  });
  const responseMutation = useMutation({
    mutationFn: ({
      event,
      response,
      identityKey: commandIdentityKey,
    }: {
      event: CalendarEvent;
      response: 'ACCEPTED' | 'DECLINED';
      identityKey: string;
    }) => {
      const current = eventsQuery.data?.find(
        (candidate) => candidate.eventId === event.eventId && candidate.version === event.version
      );
      if (
        commandIdentityKey !== activeIdentityRef.current ||
        eventsSourceStateRef.current !== 'READY' ||
        !current ||
        !roomBookingActionPolicy(current, capabilities.canUpdateRoomBooking).canRespond
      ) {
        throw new Error(t('permissions.roomUpdateReadOnly'));
      }
      return respondToRoomBooking(current.eventId, response);
    },
    onSuccess: async (_, variables) => {
      if (variables.identityKey !== activeIdentityRef.current) return;
      await queryClient.invalidateQueries({ queryKey: ['rooms', 'my-bookings'] });
      toast.success(t('my.responseSaved'));
    },
    onError: (_, variables) => {
      if (variables.identityKey === activeIdentityRef.current) toast.error(t('my.responseError'));
    },
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
      {policySourceState !== 'READY' &&
        policySourceState !== 'LOADING' &&
        policySourceState !== 'SKIPPED' && (
          <Alert
            severity={policySourceState === 'STALE' ? 'warning' : 'error'}
            action={
              <ActionButton intent="quiet" onClick={() => policyQuery.refetch()}>
                {t('actions.retry')}
              </ActionButton>
            }
            sx={{ mb: 2 }}
          >
            {t(policySourceState === 'STALE' ? 'find.policyStale' : 'find.policyUnavailable')}
          </Alert>
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
        {eventsSourceState === 'STALE' && (
          <Alert
            severity="warning"
            action={
              <ActionButton intent="quiet" onClick={() => eventsQuery.refetch()}>
                {t('actions.retry')}
              </ActionButton>
            }
          >
            {t('workplace.staleWarning')}
          </Alert>
        )}
        {eventsSourceState === 'LOADING' ? (
          <Stack spacing={1} p={2}>
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} variant="rounded" height={118} />
            ))}
          </Stack>
        ) : eventsSourceState === 'DENIED' || eventsSourceState === 'UNAVAILABLE' ? (
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
            const baseActions = roomBookingActionPolicy(event, capabilities.canUpdateRoomBooking);
            const actions = {
              canRespond: eventsSourceState === 'READY' && baseActions.canRespond,
              canEdit:
                eventsSourceState === 'READY' &&
                policySourceState === 'READY' &&
                baseActions.canEdit,
              canCancel: eventsSourceState === 'READY' && baseActions.canCancel,
            };
            const selected = event.eventId === requestedEventId;
            return (
              <Box
                key={`${event.eventId}:${event.startsAt}`}
                id={roomBookingTargetId(event.eventId)}
                data-testid={roomBookingTargetId(event.eventId)}
                tabIndex={-1}
                aria-current={selected ? 'true' : undefined}
                sx={(theme) => ({
                  p: { xs: 1.5, md: 2 },
                  borderTop: index ? 1 : 0,
                  borderColor: 'divider',
                  bgcolor: selected ? 'var(--dwp-product-soft)' : 'transparent',
                  boxShadow: selected ? `inset 3px 0 ${theme.palette.primary.main}` : 'none',
                  '&:focus-visible': {
                    outline: '2px solid',
                    outlineColor: 'primary.main',
                    outlineOffset: -2,
                  },
                })}
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
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mt: 1.25, overflowWrap: 'anywhere' }}
                      >
                        {event.description}
                      </Typography>
                    )}
                  </Box>
                  <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
                    {actions.canRespond && (
                      <>
                        <ActionButton
                          intent="secondary"
                          onClick={() =>
                            responseMutation.mutate({ event, response: 'DECLINED', identityKey })
                          }
                        >
                          {t('my.decline')}
                        </ActionButton>
                        <ActionButton
                          intent="primary"
                          onClick={() =>
                            responseMutation.mutate({ event, response: 'ACCEPTED', identityKey })
                          }
                        >
                          {t('my.accept')}
                        </ActionButton>
                      </>
                    )}
                    {(actions.canEdit || actions.canCancel) && (
                      <>
                        {actions.canEdit && (
                          <ActionButton
                            intent="secondary"
                            startIcon={<Pencil size={16} />}
                            onClick={() => setEditing(event)}
                          >
                            {t('actions.edit')}
                          </ActionButton>
                        )}
                        {actions.canCancel && (
                          <ActionButton intent="danger" onClick={() => setCancelling(event)}>
                            {t('actions.cancelBooking')}
                          </ActionButton>
                        )}
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
        open={Boolean(
          editing && roomBookingActionPolicy(editing, capabilities.canUpdateRoomBooking).canEdit
        )}
        room={(currentEditing ?? editing)?.resource ?? null}
        event={currentEditing ?? editing}
        policy={verifiedPolicy ?? null}
        commandSourceReady={Boolean(
          currentEditing && eventsSourceState === 'READY' && policySourceState === 'READY'
        )}
        onClose={() => setEditing(null)}
      />
      <ConfirmDialog
        open={Boolean(
          currentCancelling &&
          eventsSourceState === 'READY' &&
          roomBookingActionPolicy(currentCancelling, capabilities.canUpdateRoomBooking).canCancel
        )}
        title={t('my.cancelTitle')}
        description={t('my.cancelDescription')}
        cancelLabel={t('actions.keep')}
        confirmLabel={t('actions.cancelBooking')}
        confirmingLabel={t('actions.cancelling')}
        intent="danger"
        busy={cancelMutation.isPending}
        onClose={() => setCancelling(null)}
        onConfirm={() => {
          if (
            currentCancelling &&
            eventsSourceState === 'READY' &&
            roomBookingActionPolicy(currentCancelling, capabilities.canUpdateRoomBooking).canCancel
          ) {
            cancelMutation.mutate({ event: currentCancelling, identityKey });
          }
        }}
      />
    </PageCanvas>
  );
}
