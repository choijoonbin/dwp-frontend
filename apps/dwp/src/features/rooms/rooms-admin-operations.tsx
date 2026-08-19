import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, CalendarCheck2, CircleAlert, Clock3, Wrench } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  decideRoomBooking,
  getPendingRoomBookings,
  getRoomsAdminOverview,
  useToast,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  EmptyState,
  FormDialog,
  FormField,
  PageCanvas,
} from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { RoomIdentity, RoomsPageHeading, RoomStateChip } from './rooms-ui';

import type { CalendarBooking } from '@dwp-frontend/shared-utils';

type Decision = { booking: CalendarBooking; value: 'APPROVE' | 'DECLINE' };

export function RoomsAdminOperations() {
  const { t, i18n } = useTranslation('rooms');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [decision, setDecision] = useState<Decision | null>(null);
  const [note, setNote] = useState('');
  const overviewQuery = useQuery({
    queryKey: ['rooms', 'admin', 'overview'],
    queryFn: getRoomsAdminOverview,
    staleTime: 30_000,
    retry: 1,
  });
  const pendingQuery = useQuery({
    queryKey: ['rooms', 'admin', 'bookings', 'pending'],
    queryFn: getPendingRoomBookings,
    staleTime: 15_000,
    retry: 1,
  });
  const roomIds = new Set(
    (overviewQuery.data?.resources ?? [])
      .filter((resource) => resource.type === 'ROOM')
      .map((resource) => resource.resourceId)
  );
  const rooms = (overviewQuery.data?.resources ?? []).filter(
    (resource) => resource.type === 'ROOM'
  );
  const pending = (pendingQuery.data ?? []).filter((booking) => roomIds.has(booking.resourceId));
  const mutation = useMutation({
    mutationFn: ({ booking, value }: Decision) =>
      decideRoomBooking(booking.bookingId, value, note.trim(), booking.version),
    onSuccess: async () => {
      setDecision(null);
      setNote('');
      await queryClient.invalidateQueries({ queryKey: ['rooms', 'admin'] });
      toast.success(t('admin.operations.decisionSaved'));
    },
    onError: () => toast.error(t('admin.operations.decisionError')),
  });
  const format = (value: string) =>
    formatDate(
      value,
      { dateStyle: 'medium', timeStyle: 'short' },
      resolveSupportedLocale(i18n.resolvedLanguage)
    );
  const metrics = [
    {
      key: 'active',
      icon: Building2,
      value: rooms.filter((room) => room.state === 'AVAILABLE').length,
    },
    { key: 'pending', icon: Clock3, value: pending.length },
    {
      key: 'maintenance',
      icon: Wrench,
      value: rooms.filter((room) => room.state === 'MAINTENANCE').length,
    },
    { key: 'bookings', icon: CalendarCheck2, value: overviewQuery.data?.bookingsThisWeek ?? 0 },
  ] as const;

  return (
    <PageCanvas>
      <RoomsPageHeading
        eyebrow={t('admin.operations.eyebrow')}
        title={t('admin.operations.title')}
        description={t('admin.operations.description')}
      />
      {overviewQuery.isError || pendingQuery.isError ? (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            <ActionButton
              intent="quiet"
              onClick={() => {
                void overviewQuery.refetch();
                void pendingQuery.refetch();
              }}
            >
              {t('actions.retry')}
            </ActionButton>
          }
        >
          {t('admin.operations.loadError')}
        </Alert>
      ) : null}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, minmax(0, 1fr))' },
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          bgcolor: 'background.paper',
          overflow: 'hidden',
          mb: 2,
        }}
      >
        {metrics.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <Stack
              key={metric.key}
              gap={0.75}
              sx={{
                p: 2,
                borderLeft: { xs: index % 2 ? 1 : 0, lg: index ? 1 : 0 },
                borderTop: { xs: index > 1 ? 1 : 0, lg: 0 },
                borderColor: 'divider',
              }}
            >
              <Stack direction="row" gap={0.75} alignItems="center" color="text.secondary">
                <Icon size={16} />
                <Typography variant="overline">
                  {t(`admin.operations.metrics.${metric.key}`)}
                </Typography>
              </Stack>
              <Typography variant="h4" fontWeight={800}>
                {overviewQuery.isLoading ? <Skeleton width={48} /> : metric.value}
              </Typography>
            </Stack>
          );
        })}
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1.45fr) minmax(360px, 0.8fr)' },
          gap: 2,
        }}
      >
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
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}
          >
            <Typography component="h2" variant="subtitle1" fontWeight={800}>
              {t('admin.operations.pendingTitle')}
            </Typography>
            <Chip size="small" label={pending.length} />
          </Stack>
          {pendingQuery.isLoading ? (
            <Stack p={2} gap={1}>
              {Array.from({ length: 3 }, (_, index) => (
                <Skeleton key={index} height={96} />
              ))}
            </Stack>
          ) : pending.length === 0 ? (
            <EmptyState
              size="standard"
              icon={<CalendarCheck2 size={28} />}
              title={t('admin.operations.noPending')}
              description={t('admin.operations.noPendingDescription')}
            />
          ) : (
            pending.map((booking, index) => (
              <Box
                key={booking.bookingId}
                sx={{ p: 2, borderTop: index ? 1 : 0, borderColor: 'divider' }}
              >
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  justifyContent="space-between"
                  gap={1.5}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography fontWeight={800}>{booking.eventTitle}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {booking.resourceName} · {format(booking.startsAt)} - {format(booking.endsAt)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {booking.organizerName} · {booking.organizerEmail}
                    </Typography>
                  </Box>
                  <Stack direction="row" gap={1} alignItems="center">
                    <ActionButton
                      intent="danger"
                      onClick={() => setDecision({ booking, value: 'DECLINE' })}
                    >
                      {t('admin.operations.decline')}
                    </ActionButton>
                    <ActionButton
                      intent="primary"
                      onClick={() => setDecision({ booking, value: 'APPROVE' })}
                    >
                      {t('admin.operations.approve')}
                    </ActionButton>
                  </Stack>
                </Stack>
              </Box>
            ))
          )}
        </Box>
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
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}
          >
            <Typography component="h2" variant="subtitle1" fontWeight={800}>
              {t('admin.operations.healthTitle')}
            </Typography>
            <CircleAlert size={18} />
          </Stack>
          <Stack>
            {rooms.map((room, index) => (
              <Stack
                key={room.resourceId}
                direction="row"
                justifyContent="space-between"
                gap={1}
                sx={{ p: 1.5, borderTop: index ? 1 : 0, borderColor: 'divider' }}
              >
                <RoomIdentity room={room} />
                <RoomStateChip room={room} />
              </Stack>
            ))}
          </Stack>
        </Box>
      </Box>

      <FormDialog
        open={Boolean(decision)}
        title={t(
          decision?.value === 'DECLINE'
            ? 'admin.operations.declineTitle'
            : 'admin.operations.approveTitle'
        )}
        description={decision?.booking.eventTitle}
        cancelLabel={t('actions.cancel')}
        submitLabel={t(
          decision?.value === 'DECLINE' ? 'admin.operations.decline' : 'admin.operations.approve'
        )}
        submittingLabel={t('actions.saving')}
        submitIntent={decision?.value === 'DECLINE' ? 'danger' : 'primary'}
        busy={mutation.isPending}
        onClose={() => {
          setDecision(null);
          setNote('');
        }}
        onSubmit={() => {
          if (decision) mutation.mutate(decision);
        }}
      >
        <FormField
          multiline
          minRows={3}
          label={t('admin.operations.note')}
          value={note}
          onChange={(change) => setNote(change.target.value)}
          inputProps={{ maxLength: 1000 }}
        />
      </FormDialog>
    </PageCanvas>
  );
}
