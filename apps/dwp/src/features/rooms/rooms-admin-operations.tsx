import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, CalendarCheck2, CircleAlert, Clock3, RefreshCw, Wrench } from 'lucide-react';
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

import { InlineFeedback } from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { workplaceMemberCard, workplaceMemberSoftSurface } from './workplace-member-surfaces';
import { retryRecoverableWorkplaceRead } from './workplace-authority-failure';
import { workplaceHomeSourceData, workplaceHomeSourceState } from './workplace-home-source-state';
import { useRoomsCapabilities } from './rooms-capabilities';
import { RoomIdentity, RoomsPageHeading, RoomsPermissionNotice, RoomStateChip } from './rooms-ui';
import { useWorkplaceExperienceAuthority } from './workplace-experience-authority';

import type { CalendarBooking } from '@dwp-frontend/shared-utils';

type Decision = {
  identityKey: string;
  booking: CalendarBooking;
  value: 'APPROVE' | 'DECLINE';
  embeddedContext?: string;
};

const EMBEDDED_PAGE_SIZE = 5;

export function RoomsAdminOperations({ embedded = false }: { embedded?: boolean }) {
  const { t, i18n } = useTranslation('rooms');
  const toast = useToast();
  const identityKey = useWorkplaceExperienceAuthority();
  const inFlight = useRef(false);
  const identityRef = useRef(identityKey);
  identityRef.current = identityKey;
  const [reconcileIdentity, setReconcileIdentity] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const capabilities = useRoomsCapabilities();
  const [decision, setDecision] = useState<Decision | null>(null);
  const [note, setNote] = useState('');
  const [approvalPage, setApprovalPage] = useState(0);
  const overviewQuery = useQuery({
    queryKey: ['rooms', 'admin', 'overview', identityKey],
    enabled: capabilities.isLoaded && capabilities.canViewRoomsAdmin,
    queryFn: getRoomsAdminOverview,
    staleTime: 30_000,
    retry: retryRecoverableWorkplaceRead,
  });
  const pendingQuery = useQuery({
    queryKey: ['rooms', 'admin', 'bookings', 'pending', identityKey],
    enabled: capabilities.isLoaded && capabilities.canViewRoomsAdmin,
    queryFn: getPendingRoomBookings,
    staleTime: 15_000,
    retry: retryRecoverableWorkplaceRead,
  });
  const overviewState = workplaceHomeSourceState({
    ...overviewQuery,
    required: capabilities.isLoaded && capabilities.canViewRoomsAdmin,
  });
  const pendingState = workplaceHomeSourceState({
    ...pendingQuery,
    required: capabilities.isLoaded && capabilities.canViewRoomsAdmin,
  });
  const overview = workplaceHomeSourceData(overviewState, overviewQuery.data);
  const pendingData = workplaceHomeSourceData(pendingState, pendingQuery.data);
  const ready =
    overviewState === 'READY' &&
    pendingState === 'READY' &&
    !overviewQuery.isFetching &&
    !pendingQuery.isFetching &&
    reconcileIdentity !== identityKey;
  const readyRef = useRef(ready);
  readyRef.current = ready;
  useEffect(() => {
    setDecision(null);
    setNote('');
    setReconcileIdentity(null);
  }, [identityKey]);
  useEffect(() => {
    if (overviewState === 'DENIED' || pendingState === 'DENIED') {
      setDecision(null);
      setNote('');
    }
  }, [overviewState, pendingState]);
  const recheck = async () => {
    if (embedded && inFlight.current) return;
    if (embedded) {
      embeddedContextRef.current = '';
      readyRef.current = false;
      setDecision(null);
      setNote('');
    }
    const expected = identityKey;
    const results = await Promise.all([overviewQuery.refetch(), pendingQuery.refetch()]);
    if (expected === identityRef.current && results.every((result) => !result.isError))
      setReconcileIdentity(null);
  };
  const roomIds = new Set(
    (overview?.resources ?? [])
      .filter((resource) => resource.type === 'ROOM')
      .map((resource) => resource.resourceId)
  );
  const rooms = (overview?.resources ?? []).filter((resource) => resource.type === 'ROOM');
  const pending = (pendingData ?? []).filter((booking) => roomIds.has(booking.resourceId));
  const approvalPages = Math.max(1, Math.ceil(pending.length / EMBEDDED_PAGE_SIZE));
  const currentPage = Math.min(approvalPage, approvalPages - 1);
  const visiblePending = embedded
    ? pending.slice(currentPage * EMBEDDED_PAGE_SIZE, (currentPage + 1) * EMBEDDED_PAGE_SIZE)
    : pending;
  const embeddedContext = JSON.stringify([
    identityKey,
    currentPage,
    reconcileIdentity,
    capabilities.isLoaded,
    capabilities.canViewRoomsAdmin,
    capabilities.canManageRoomsAdmin,
    overviewState,
    pendingState,
    overviewQuery.dataUpdatedAt,
    pendingQuery.dataUpdatedAt,
    overviewQuery.isFetching,
    pendingQuery.isFetching,
  ]);
  const embeddedContextRef = useRef(embeddedContext);
  embeddedContextRef.current = embeddedContext;
  useEffect(() => {
    if (!embedded) return;
    setDecision(null);
    setNote('');
  }, [embedded, embeddedContext]);
  useEffect(() => {
    if (embedded) setApprovalPage(0);
  }, [
    embedded,
    identityKey,
    capabilities.canViewRoomsAdmin,
    capabilities.canManageRoomsAdmin,
    overviewState,
    pendingState,
    overviewQuery.dataUpdatedAt,
    pendingQuery.dataUpdatedAt,
  ]);
  const changeApprovalPage = (nextPage: number) => {
    if (
      !embedded ||
      inFlight.current ||
      !readyRef.current ||
      nextPage < 0 ||
      nextPage >= approvalPages
    )
      return;
    // Fence an already-open decision synchronously, before the new page renders.
    embeddedContextRef.current = '';
    setDecision(null);
    setNote('');
    setApprovalPage(nextPage);
  };
  const currentDecision =
    decision?.identityKey === identityKey &&
    (!embedded || decision.embeddedContext === embeddedContext) &&
    visiblePending.some(
      (booking) =>
        booking.bookingId === decision.booking.bookingId &&
        booking.version === decision.booking.version
    )
      ? decision
      : null;
  const chooseDecision = (booking: CalendarBooking, value: Decision['value']) => {
    if (inFlight.current || !readyRef.current) return;
    if (decision?.booking.bookingId !== booking.bookingId) setNote('');
    setDecision({ identityKey, booking, value, ...(embedded ? { embeddedContext } : {}) });
  };
  const mutation = useMutation({
    mutationFn: ({
      booking,
      value,
      identityKey: commandIdentity,
      note: commandNote,
      embeddedContext: commandContext,
    }: Decision & { note: string }) => {
      if (
        !capabilities.canManageRoomsAdmin ||
        commandNote.trim().length < 3 ||
        commandIdentity !== identityRef.current ||
        (embedded && commandContext !== embeddedContextRef.current) ||
        !readyRef.current ||
        !visiblePending.some(
          (candidate) =>
            candidate.bookingId === booking.bookingId && candidate.version === booking.version
        )
      ) {
        throw new Error(t('permissions.roomAdminOperationsReadOnly'));
      }
      return decideRoomBooking(booking.bookingId, value, commandNote.trim(), booking.version);
    },
    onSuccess: async (_, command) => {
      if (command.identityKey !== identityRef.current) return;
      if (!embedded || command.embeddedContext === embeddedContextRef.current) {
        setDecision(null);
        setNote('');
      }
      await queryClient.invalidateQueries({ queryKey: ['rooms', 'admin'] });
      if (command.identityKey !== identityRef.current) return;
      toast.success(t('admin.operations.decisionSaved'));
    },
    onError: (_, command) => {
      if (command.identityKey !== identityRef.current) return;
      setReconcileIdentity(command.identityKey);
      if (!embedded || command.embeddedContext === embeddedContextRef.current)
        toast.error(t('admin.operations.decisionError'));
    },
    onSettled: () => {
      inFlight.current = false;
    },
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
      value: overview ? rooms.filter((room) => room.state === 'AVAILABLE').length : null,
    },
    { key: 'pending', icon: Clock3, value: pendingData && overview ? pending.length : null },
    {
      key: 'maintenance',
      icon: Wrench,
      value: overview ? rooms.filter((room) => room.state === 'MAINTENANCE').length : null,
    },
    { key: 'bookings', icon: CalendarCheck2, value: overview?.bookingsThisWeek ?? null },
  ] as const;

  return (
    <Box
      component={embedded ? 'section' : PageCanvas}
      sx={{ minWidth: 0 }}
      data-testid={embedded ? 'policy-room-approval-queue' : undefined}
    >
      {!embedded ? (
        <RoomsPageHeading
          eyebrow={t('admin.operations.eyebrow')}
          title={t('admin.operations.title')}
          description={t('admin.operations.description')}
        />
      ) : null}
      {capabilities.isLoaded && !capabilities.canManageRoomsAdmin && (
        <RoomsPermissionNotice>
          {t('permissions.roomAdminOperationsReadOnly')}
        </RoomsPermissionNotice>
      )}
      {(['STALE', 'DENIED', 'UNAVAILABLE'] as string[]).includes(overviewState) ||
      (['STALE', 'DENIED', 'UNAVAILABLE'] as string[]).includes(pendingState) ||
      reconcileIdentity === identityKey ? (
        <InlineFeedback
          severity="error"
          sx={{ mb: 2 }}
          action={
            <ActionButton intent="quiet" onClick={() => void recheck()}>
              {t('actions.retry')}
            </ActionButton>
          }
        >
          {t(
            reconcileIdentity === identityKey
              ? 'workplace.experience.changeUnknown'
              : 'admin.operations.loadError'
          )}
        </InlineFeedback>
      ) : null}
      {!embedded ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, minmax(0, 1fr))' },
            gap: 1.5,
            mb: 2,
          }}
        >
          {metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <Stack
                key={metric.key}
                gap={0.75}
                sx={(theme) => ({ ...workplaceMemberCard(theme), p: 2 })}
              >
                <Stack direction="row" gap={0.75} alignItems="center" color="text.secondary">
                  <Icon size={16} color="var(--dwp-product-accent)" />
                  <Typography variant="overline">
                    {t(`admin.operations.metrics.${metric.key}`)}
                  </Typography>
                </Stack>
                <Typography variant="h4" fontWeight="fontWeightBold">
                  {overviewQuery.isLoading ||
                  (metric.key === 'pending' && pendingQuery.isLoading) ? (
                    <Skeleton width={48} />
                  ) : (
                    (metric.value ?? '—')
                  )}
                </Typography>
              </Stack>
            );
          })}
        </Box>
      ) : null}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            lg: embedded ? '1fr' : 'minmax(0, 1.45fr) minmax(0, 0.85fr)',
          },
          gap: 2,
        }}
      >
        <Box sx={workplaceMemberCard}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{
              px: 2,
              py: 1.5,
              borderBottom: 1,
              borderColor: 'divider',
              ...(embedded ? { gap: 1 } : {}),
            }}
          >
            <Typography component="h2" variant="subtitle1" fontWeight="fontWeightBold">
              {t('admin.operations.pendingTitle')}
            </Typography>
            <Stack direction="row" gap={0.5} alignItems="center">
              <Chip size="small" label={pendingData && overview ? pending.length : '—'} />
              {embedded ? (
                <ActionButton
                  intent="quiet"
                  aria-label={t('workplace.experience.refresh')}
                  disabled={
                    mutation.isPending || overviewQuery.isFetching || pendingQuery.isFetching
                  }
                  onClick={() => void recheck()}
                >
                  <RefreshCw size={16} />
                </ActionButton>
              ) : null}
            </Stack>
          </Stack>
          {pendingQuery.isLoading ? (
            <Stack p={2} gap={1}>
              {Array.from({ length: 3 }, (_, index) => (
                <Skeleton key={index} height={96} />
              ))}
            </Stack>
          ) : !pendingData || !overview ? (
            <InlineFeedback severity="error">{t('admin.operations.loadError')}</InlineFeedback>
          ) : pending.length === 0 ? (
            <EmptyState
              size="standard"
              icon={<CalendarCheck2 size={28} />}
              title={t('admin.operations.noPending')}
              description={t('admin.operations.noPendingDescription')}
            />
          ) : (
            visiblePending.map((booking) => (
              <Box
                key={booking.bookingId}
                data-room-booking-id={embedded ? booking.bookingId : undefined}
                sx={(theme) =>
                  embedded
                    ? { px: 1.5, py: 1.25, borderBottom: 1, borderColor: theme.palette.divider }
                    : { ...workplaceMemberSoftSurface(theme), p: 2, m: 1.5 }
                }
              >
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  justifyContent="space-between"
                  gap={embedded ? 1 : 1.5}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant={embedded ? 'body2' : 'body1'} fontWeight="fontWeightBold">
                      {booking.eventTitle}
                    </Typography>
                    <Typography
                      variant={embedded ? 'caption' : 'body2'}
                      component="p"
                      color="text.secondary"
                      sx={{ mt: embedded ? 0.25 : 0.5 }}
                    >
                      {booking.resourceName} · {format(booking.startsAt)} - {format(booking.endsAt)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {booking.organizerName} · {booking.organizerEmail}
                    </Typography>
                  </Box>
                  {capabilities.canManageRoomsAdmin && (
                    <Stack direction="row" gap={1} alignItems="center">
                      <ActionButton
                        intent="danger"
                        disabled={!ready || mutation.isPending}
                        onClick={() => chooseDecision(booking, 'DECLINE')}
                      >
                        {t('admin.operations.decline')}
                      </ActionButton>
                      <ActionButton
                        intent="primary"
                        disabled={!ready || mutation.isPending}
                        onClick={() => chooseDecision(booking, 'APPROVE')}
                      >
                        {t('admin.operations.approve')}
                      </ActionButton>
                    </Stack>
                  )}
                </Stack>
              </Box>
            ))
          )}
          {embedded && pendingData && overview && pending.length > 0 ? (
            <Stack
              component="nav"
              aria-label={t('workplace.experience.approvalQueuePagination')}
              gap={0.75}
              sx={{ px: 1.5, py: 1.25 }}
            >
              <Typography variant="caption" color="text.secondary" aria-live="polite">
                {t('workplace.experience.embeddedApprovalPage', {
                  total: pending.length,
                  from: currentPage * EMBEDDED_PAGE_SIZE + 1,
                  to: Math.min((currentPage + 1) * EMBEDDED_PAGE_SIZE, pending.length),
                  page: currentPage + 1,
                  pages: approvalPages,
                })}
              </Typography>
              <Stack direction="row" gap={1} justifyContent="flex-end">
                <ActionButton
                  intent="quiet"
                  disabled={!ready || mutation.isPending || currentPage === 0}
                  onClick={() => changeApprovalPage(currentPage - 1)}
                >
                  {t('workplace.experience.previous')}
                </ActionButton>
                <ActionButton
                  intent="quiet"
                  disabled={!ready || mutation.isPending || currentPage >= approvalPages - 1}
                  onClick={() => changeApprovalPage(currentPage + 1)}
                >
                  {t('workplace.experience.next')}
                </ActionButton>
              </Stack>
            </Stack>
          ) : null}
        </Box>
        {!embedded ? (
          <Box sx={workplaceMemberCard}>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}
            >
              <Typography component="h2" variant="subtitle1" fontWeight="fontWeightBold">
                {t('admin.operations.healthTitle')}
              </Typography>
              <CircleAlert size={18} />
            </Stack>
            <Stack>
              {!overview ? (
                <InlineFeedback severity="error">{t('admin.operations.loadError')}</InlineFeedback>
              ) : null}
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
        ) : null}
      </Box>

      <FormDialog
        open={Boolean(currentDecision && ready)}
        mobileFullScreen
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
        submitDisabled={!capabilities.canManageRoomsAdmin || !ready || note.trim().length < 3}
        onClose={() => {
          setDecision(null);
          setNote('');
        }}
        onSubmit={() => {
          if (
            currentDecision &&
            ready &&
            !inFlight.current &&
            (!embedded || currentDecision.embeddedContext === embeddedContextRef.current)
          ) {
            inFlight.current = true;
            mutation.mutate({ ...currentDecision, note });
          }
        }}
      >
        {decision ? (
          <Stack gap={1} sx={(theme) => ({ ...workplaceMemberSoftSurface(theme), p: 1.5, mb: 2 })}>
            <Typography fontWeight="fontWeightBold">{decision.booking.resourceName}</Typography>
            <Typography variant="body2">
              {format(decision.booking.startsAt)} – {format(decision.booking.endsAt)}
            </Typography>
          </Stack>
        ) : null}
        <FormField
          multiline
          minRows={3}
          label={t('admin.operations.note')}
          required
          disabled={mutation.isPending}
          value={note}
          onChange={(change) => setNote(change.target.value)}
          inputProps={{ maxLength: 1000 }}
        />
      </FormDialog>
    </Box>
  );
}
