import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import {
  CalendarCheck2,
  CheckCircle2,
  Clock3,
  LogOut,
  MapPin,
  PencilLine,
  XCircle,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  cancelWorkplaceBooking,
  checkInWorkplaceBooking,
  getWorkplaceBookings,
  releaseWorkplaceBooking,
  useAuth,
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

import { useRoomsCapabilities } from './rooms-capabilities';
import { RoomsPageHeading, RoomsPermissionNotice } from './rooms-ui';
import { retryRecoverableWorkplaceRead } from './workplace-authority-failure';
import { workplaceBookingActionPolicy } from './workplace-booking-action-policy';
import { useWorkplaceDecisionClock } from './workplace-decision-clock';
import {
  workplaceDecisionActionProps,
  useWorkplaceDecisionStatus,
} from './workplace-decision-status';
import { workplaceHomeDecisionDeadline } from './workplace-home-decision-clock';
import { workplaceHomeSourceData, workplaceHomeSourceState } from './workplace-home-source-state';
import { WorkplaceReleaseWindows } from './workplace-release-windows';
import { WorkplaceRelocateBookingDialog } from './workplace-relocate-booking-dialog';

import type { WorkplaceBooking } from '@dwp-frontend/shared-utils';

type BookingFilter = 'upcoming' | 'past';
type BookingAction = {
  identityKey: string;
  booking: WorkplaceBooking;
  action: 'cancel' | 'release';
};
type BookingMutationAction =
  BookingAction | (Omit<BookingAction, 'action'> & { action: 'check-in' });
type RelocatingBooking = { identityKey: string; booking: WorkplaceBooking };
type SubmittedDecisionAction = { identityKey: string; actionId: string };
type RelocateDeniedNotice = { identityKey: string; bookingId: string };

const TERMINAL_BOOKING_STATUSES = ['COMPLETED', 'NO_SHOW', 'CANCELLED', 'RELEASED'] as const;
const REFRESH_INTERVAL = 60_000;
const DECISION_BOUNDARY_SETTLE_MS = 10;

function bookingRange(filter: BookingFilter) {
  const from = new Date();
  const to = new Date();
  if (filter === 'upcoming') to.setFullYear(to.getFullYear() + 1);
  else from.setFullYear(from.getFullYear() - 1);
  return { from: from.toISOString(), to: to.toISOString() };
}

function bookingTargetId(bookingId: string) {
  return `workplace-booking-${bookingId.replace(/[^a-zA-Z0-9_-]/gu, '-')}`;
}

export function WorkplaceBookings() {
  const { t, i18n } = useTranslation('rooms');
  const toast = useToast();
  const queryClient = useQueryClient();
  const capabilities = useRoomsCapabilities();
  const auth = useAuth();
  const identityKey = `${auth.user?.tenantId ?? 'anonymous'}:${auth.user?.userId ?? 'anonymous'}`;
  const activeIdentityRef = useRef(identityKey);
  const changeMutationInFlightRef = useRef(false);
  const completeDecisionActionRef = useRef<(identityKey: string, actionId: string) => void>(
    () => undefined
  );
  const relocateTriggerRef = useRef<HTMLElement | null>(null);
  const [submittedDecisionAction, setSubmittedDecisionAction] =
    useState<SubmittedDecisionAction | null>(null);
  activeIdentityRef.current = identityKey;
  const [searchParams] = useSearchParams();
  const requestedBookingId = searchParams.get('booking');
  const [filter, setFilter] = useState<BookingFilter>('upcoming');
  const [confirming, setConfirming] = useState<BookingAction | null>(null);
  const [relocating, setRelocating] = useState<RelocatingBooking | null>(null);
  const [relocateDeniedNotice, setRelocateDeniedNotice] = useState<RelocateDeniedNotice | null>(
    null
  );
  const activeConfirming = confirming?.identityKey === identityKey ? confirming : null;
  const activeRelocatingDraft = relocating?.identityKey === identityKey ? relocating : null;
  const activeRelocateDeniedNotice =
    relocateDeniedNotice?.identityKey === identityKey ? relocateDeniedNotice : null;
  const range = useMemo(() => bookingRange(filter), [filter]);
  const query = useQuery({
    queryKey: ['workplace', 'bookings', identityKey, range.from, range.to],
    queryFn: () => getWorkplaceBookings(range.from, range.to),
    staleTime: 20_000,
    refetchInterval: 60_000,
    retry: retryRecoverableWorkplaceRead,
  });
  const bookingSourceState = workplaceHomeSourceState({
    data: query.data,
    error: query.error,
    failureCount: query.failureCount,
    failureReason: query.failureReason,
    isError: query.isError,
    isPending: query.isPending,
    required: true,
  });
  const bookingSourceStateRef = useRef(bookingSourceState);
  bookingSourceStateRef.current = bookingSourceState;
  const verifiedBookings = workplaceHomeSourceData(bookingSourceState, query.data);
  const {
    advance: advanceDecisionClock,
    nowInstant: decisionNowInstant,
    readNow: readDecisionNow,
  } = useWorkplaceDecisionClock(identityKey);
  const bookings = useMemo(
    () =>
      (verifiedBookings ?? [])
        .filter((booking) =>
          filter === 'upcoming'
            ? Date.parse(booking.endsAt) > decisionNowInstant &&
              !TERMINAL_BOOKING_STATUSES.includes(
                booking.status as (typeof TERMINAL_BOOKING_STATUSES)[number]
              )
            : Date.parse(booking.endsAt) <= decisionNowInstant ||
              TERMINAL_BOOKING_STATUSES.includes(
                booking.status as (typeof TERMINAL_BOOKING_STATUSES)[number]
              )
        )
        .sort((left, right) =>
          filter === 'upcoming'
            ? Date.parse(left.startsAt) - Date.parse(right.startsAt)
            : Date.parse(right.startsAt) - Date.parse(left.startsAt)
        ),
    [decisionNowInstant, filter, verifiedBookings]
  );
  const bookingPolicies = useMemo(
    () =>
      new Map(
        bookings.map((booking) => [
          booking.bookingId,
          workplaceBookingActionPolicy({
            booking,
            sourceState: bookingSourceState,
            canUpdateWorkplaceBooking: capabilities.canUpdateWorkplaceBooking,
            nowInstant: decisionNowInstant,
          }),
        ])
      ),
    [bookingSourceState, bookings, capabilities.canUpdateWorkplaceBooking, decisionNowInstant]
  );
  const activeRelocating = activeRelocatingDraft
    ? (query.data?.find(
        (candidate) =>
          candidate.bookingId === activeRelocatingDraft.booking.bookingId &&
          candidate.version === activeRelocatingDraft.booking.version
      ) ?? null)
    : null;
  const changeMutation = useMutation({
    mutationFn: ({ booking, action, identityKey: actionIdentityKey }: BookingMutationAction) => {
      const currentBooking = query.data?.find(
        (candidate) =>
          candidate.bookingId === booking.bookingId && candidate.version === booking.version
      );
      if (actionIdentityKey !== activeIdentityRef.current || !currentBooking) {
        throw new Error(t('permissions.workplaceUpdateReadOnly'));
      }
      const policy = workplaceBookingActionPolicy({
        booking: currentBooking,
        sourceState: bookingSourceStateRef.current,
        canUpdateWorkplaceBooking: capabilities.canUpdateWorkplaceBooking,
        nowInstant: readDecisionNow(),
      });
      const allowed =
        action === 'check-in'
          ? policy.canCheckIn
          : action === 'release'
            ? policy.canRelease
            : policy.canCancel;
      if (!allowed) throw new Error(t('permissions.workplaceUpdateReadOnly'));
      setSubmittedDecisionAction({
        identityKey: actionIdentityKey,
        actionId: `${action}:${currentBooking.bookingId}`,
      });
      if (action === 'check-in') {
        return checkInWorkplaceBooking(currentBooking.bookingId, currentBooking.version);
      }
      if (action === 'release') {
        return releaseWorkplaceBooking(currentBooking.bookingId, currentBooking.version);
      }
      return cancelWorkplaceBooking(currentBooking.bookingId, currentBooking.version);
    },
    onSuccess: async (_, variables) => {
      if (variables.identityKey !== activeIdentityRef.current) return;
      completeDecisionActionRef.current(
        variables.identityKey,
        `${variables.action}:${variables.booking.bookingId}`
      );
      setConfirming((current) =>
        current?.identityKey === variables.identityKey &&
        current.booking.bookingId === variables.booking.bookingId
          ? null
          : current
      );
      await queryClient.invalidateQueries({ queryKey: ['workplace'] });
      if (variables.identityKey === activeIdentityRef.current) {
        toast.success(t(`workplace.my.${variables.action}Saved`));
      }
    },
    onError: (_, variables) => {
      if (variables.identityKey !== activeIdentityRef.current) return;
      setConfirming((current) =>
        current?.identityKey === variables.identityKey &&
        current.booking.bookingId === variables.booking.bookingId
          ? null
          : current
      );
      if (variables.identityKey === activeIdentityRef.current) {
        toast.error(t('workplace.my.actionError'));
      }
    },
    onSettled: (_, __, variables) => {
      changeMutationInFlightRef.current = false;
      setSubmittedDecisionAction((current) =>
        current?.identityKey === variables.identityKey &&
        current.actionId === `${variables.action}:${variables.booking.bookingId}`
          ? null
          : current
      );
    },
  });
  const submittedDecisionActionId =
    submittedDecisionAction?.identityKey === identityKey ? submittedDecisionAction.actionId : null;
  const activeMutationPending =
    changeMutation.isPending && changeMutation.variables?.identityKey === identityKey;
  const anyMutationPending = changeMutation.isPending || changeMutationInFlightRef.current;
  const submitBookingAction = (action: BookingMutationAction) => {
    if (changeMutationInFlightRef.current) return;
    changeMutationInFlightRef.current = true;
    try {
      changeMutation.mutate(action);
    } catch (error) {
      changeMutationInFlightRef.current = false;
      throw error;
    }
  };
  const decisionActions = useMemo(
    () =>
      bookings.flatMap((booking) => {
        const policy = bookingPolicies.get(booking.bookingId);
        return [
          ...(policy?.canCheckIn
            ? [
                {
                  id: `check-in:${booking.bookingId}`,
                  kind: 'CHECK_IN' as const,
                  endsAt: booking.endsAt,
                },
              ]
            : []),
          ...(policy?.canRelease
            ? [
                {
                  id: `release:${booking.bookingId}`,
                  kind: 'RELEASE' as const,
                  endsAt: booking.endsAt,
                },
              ]
            : []),
          ...(policy?.canCancel
            ? [
                {
                  id: `cancel:${booking.bookingId}`,
                  kind: 'CANCEL' as const,
                  endsAt: booking.startsAt,
                },
              ]
            : []),
        ];
      }),
    [bookingPolicies, bookings]
  );
  const {
    announceClosure,
    completeAction: completeDecisionAction,
    notice: decisionNotice,
    statusRef: decisionStatusRef,
  } = useWorkplaceDecisionStatus(decisionActions, decisionNowInstant, {
    identityKey,
    sourceReady: bookingSourceState === 'READY',
    submittedActionIds: submittedDecisionActionId ? [submittedDecisionActionId] : [],
  });
  completeDecisionActionRef.current = completeDecisionAction;
  const decisionDeadline = workplaceHomeDecisionDeadline({
    now: new Date(decisionNowInstant).toISOString(),
    bookings: query.data ?? [],
  });
  const { refetch: refetchBookings } = query;
  useEffect(() => {
    const delayToBoundary =
      decisionDeadline === null
        ? Number.POSITIVE_INFINITY
        : decisionDeadline - Math.max(decisionNowInstant, Date.now()) + DECISION_BOUNDARY_SETTLE_MS;
    const delay = Math.max(
      DECISION_BOUNDARY_SETTLE_MS,
      Math.min(REFRESH_INTERVAL, delayToBoundary)
    );
    const reachesDecisionBoundary =
      decisionDeadline !== null && delayToBoundary <= REFRESH_INTERVAL;
    const timer = window.setTimeout(() => {
      advanceDecisionClock();
      if (reachesDecisionBoundary) void refetchBookings();
    }, delay);
    return () => window.clearTimeout(timer);
  }, [advanceDecisionClock, decisionDeadline, decisionNowInstant, refetchBookings]);

  useEffect(() => {
    if (!activeConfirming) return;
    if (
      submittedDecisionActionId ===
      `${activeConfirming.action}:${activeConfirming.booking.bookingId}`
    ) {
      return;
    }
    const currentBooking = query.data?.find(
      (candidate) =>
        candidate.bookingId === activeConfirming.booking.bookingId &&
        candidate.version === activeConfirming.booking.version
    );
    if (!currentBooking) {
      setConfirming(null);
      announceClosure({
        actionId: `${activeConfirming.action}:${activeConfirming.booking.bookingId}`,
        kind: activeConfirming.action === 'release' ? 'RELEASE' : 'CANCEL',
        endsAt:
          activeConfirming.action === 'release'
            ? activeConfirming.booking.endsAt
            : activeConfirming.booking.startsAt,
        reason: 'UNVERIFIED',
      });
      return;
    }
    const policy = workplaceBookingActionPolicy({
      booking: currentBooking,
      sourceState: bookingSourceState,
      canUpdateWorkplaceBooking: capabilities.canUpdateWorkplaceBooking,
      nowInstant: decisionNowInstant,
    });
    const allowed = activeConfirming.action === 'release' ? policy.canRelease : policy.canCancel;
    if (allowed) return;

    const boundary = Date.parse(
      activeConfirming.action === 'release'
        ? activeConfirming.booking.endsAt
        : activeConfirming.booking.startsAt
    );
    setConfirming(null);
    announceClosure({
      actionId: `${activeConfirming.action}:${activeConfirming.booking.bookingId}`,
      kind: activeConfirming.action === 'release' ? 'RELEASE' : 'CANCEL',
      endsAt:
        activeConfirming.action === 'release'
          ? activeConfirming.booking.endsAt
          : activeConfirming.booking.startsAt,
      reason: Number.isFinite(boundary) && decisionNowInstant >= boundary ? 'ENDED' : 'UNVERIFIED',
    });
  }, [
    announceClosure,
    bookingSourceState,
    capabilities.canUpdateWorkplaceBooking,
    activeConfirming,
    decisionNowInstant,
    query.data,
    submittedDecisionActionId,
  ]);

  useEffect(() => {
    if (!activeRelocatingDraft) return;
    if (!activeRelocating) {
      setRelocating(null);
      return;
    }
    const policy = workplaceBookingActionPolicy({
      booking: activeRelocating,
      sourceState: bookingSourceState,
      canUpdateWorkplaceBooking: capabilities.canUpdateWorkplaceBooking,
      nowInstant: decisionNowInstant,
    });
    if (!policy.canCancel) setRelocating(null);
  }, [
    activeRelocating,
    activeRelocatingDraft,
    bookingSourceState,
    capabilities.canUpdateWorkplaceBooking,
    decisionNowInstant,
  ]);
  useEffect(() => {
    setConfirming((current) => (current?.identityKey === identityKey ? current : null));
    setRelocating((current) => (current?.identityKey === identityKey ? current : null));
    setRelocateDeniedNotice((current) => (current?.identityKey === identityKey ? current : null));
    relocateTriggerRef.current = null;
    setSubmittedDecisionAction((current) =>
      current?.identityKey === identityKey ? current : null
    );
  }, [identityKey]);
  useEffect(() => {
    if (!activeRelocateDeniedNotice) return;
    const frame = window.requestAnimationFrame(() => {
      const trigger = relocateTriggerRef.current;
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeRelocateDeniedNotice]);
  const isCurrentRelocateBooking = (
    actionIdentityKey: string,
    bookingId: string,
    version: number
  ) =>
    actionIdentityKey === activeIdentityRef.current &&
    query.data?.some(
      (candidate) => candidate.bookingId === bookingId && candidate.version === version
    ) === true;
  const requestedBookingVisible = bookings.some(
    (booking) => booking.bookingId === requestedBookingId
  );
  useEffect(() => {
    if (!requestedBookingId || !requestedBookingVisible) return;
    const frame = window.requestAnimationFrame(() => {
      const target = document.getElementById(bookingTargetId(requestedBookingId));
      target?.scrollIntoView({ block: 'center' });
      target?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [requestedBookingId, requestedBookingVisible]);
  const format = (value: string) =>
    formatDate(
      value,
      { dateStyle: 'medium', timeStyle: 'short' },
      resolveSupportedLocale(i18n.resolvedLanguage)
    );

  return (
    <PageCanvas>
      <RoomsPageHeading
        eyebrow={t('workplace.my.eyebrow')}
        title={t('workplace.my.title')}
        description={t('workplace.my.description')}
      />
      {capabilities.isLoaded && !capabilities.canUpdateWorkplaceBooking && (
        <RoomsPermissionNotice>{t('permissions.workplaceUpdateReadOnly')}</RoomsPermissionNotice>
      )}
      {activeRelocateDeniedNotice && (
        <Alert
          severity="error"
          role="alert"
          aria-live="assertive"
          aria-atomic="true"
          data-testid="workplace-relocate-denied-alert"
        >
          {t('workplace.my.relocate.deniedNotice')}
        </Alert>
      )}
      <Box
        ref={decisionStatusRef}
        tabIndex={-1}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-testid="workplace-booking-decision-status"
        sx={{
          display: decisionNotice ? 'block' : 'none',
          mb: 2,
          px: 2,
          py: 1.5,
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          bgcolor: 'background.paper',
          color: 'text.secondary',
          '&:focus-visible': {
            outline: '2px solid',
            outlineColor: 'primary.main',
            outlineOffset: 2,
          },
        }}
      >
        {decisionNotice
          ? t(
              `workplace.home.decisionStatus.${
                decisionNotice.kind === 'CHECK_IN'
                  ? 'checkIn'
                  : decisionNotice.kind === 'RELEASE'
                    ? 'release'
                    : 'cancel'
              }${decisionNotice.reason === 'ENDED' ? 'Ended' : decisionNotice.reason === 'RECOVERED' ? 'Recovered' : 'Unverified'}`
            )
          : null}
      </Box>
      <Box
        sx={{ border: 1, borderColor: 'divider', bgcolor: 'background.paper', overflow: 'hidden' }}
      >
        <Tabs
          value={filter}
          onChange={(_, value: BookingFilter) => setFilter(value)}
          sx={{ px: 1.5, borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab value="upcoming" label={t('my.upcoming')} />
          <Tab value="past" label={t('my.past')} />
        </Tabs>
        {query.isLoading && (
          <Stack spacing={1} p={2}>
            {[0, 1, 2].map((value) => (
              <Skeleton key={value} height={112} />
            ))}
          </Stack>
        )}
        {(bookingSourceState === 'STALE' ||
          bookingSourceState === 'DENIED' ||
          bookingSourceState === 'UNAVAILABLE') && (
          <Alert
            severity={bookingSourceState === 'STALE' ? 'warning' : 'error'}
            action={
              <ActionButton intent="quiet" onClick={() => query.refetch()}>
                {t('actions.retry')}
              </ActionButton>
            }
          >
            {t(
              bookingSourceState === 'STALE' ? 'workplace.staleWarning' : 'workplace.my.loadError'
            )}
          </Alert>
        )}
        {bookingSourceState === 'READY' && bookings.length === 0 && (
          <EmptyState
            icon={<CalendarCheck2 size={28} />}
            title={t(
              filter === 'upcoming' ? 'workplace.my.emptyUpcoming' : 'workplace.my.emptyPast'
            )}
            description={t('workplace.my.emptyDescription')}
          />
        )}
        {bookings.map((booking, index) => {
          const selected = booking.bookingId === requestedBookingId;
          const actionPolicy = bookingPolicies.get(booking.bookingId);
          return (
            <Box
              key={booking.bookingId}
              id={bookingTargetId(booking.bookingId)}
              data-testid={bookingTargetId(booking.bookingId)}
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
              <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" gap={2}>
                <Box sx={{ minWidth: 0 }}>
                  <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
                    <Typography component="h2" variant="subtitle1" fontWeight={800}>
                      {booking.resourceName}
                    </Typography>
                    <Chip
                      size="small"
                      variant="outlined"
                      label={t(`workplace.resourceTypes.${booking.resourceType}`)}
                    />
                    <Chip
                      size="small"
                      color={booking.status === 'CHECKED_IN' ? 'success' : 'default'}
                      label={t(`workplace.bookingStatus.${booking.status}`)}
                    />
                  </Stack>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    gap={{ xs: 0.6, sm: 2 }}
                    sx={{ mt: 1 }}
                    color="text.secondary"
                  >
                    <Stack direction="row" gap={0.6} alignItems="center">
                      <Clock3 size={15} />
                      <Typography variant="body2">
                        {format(booking.startsAt)} - {format(booking.endsAt)}
                      </Typography>
                    </Stack>
                    <Stack direction="row" gap={0.6} alignItems="center">
                      <MapPin size={15} />
                      <Typography variant="body2">
                        {booking.siteName} · {booking.floorName}
                      </Typography>
                    </Stack>
                  </Stack>
                  {booking.purpose && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      {booking.purpose}
                    </Typography>
                  )}
                </Box>
                {filter === 'upcoming' && capabilities.canUpdateWorkplaceBooking && (
                  <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
                    {actionPolicy?.canCheckIn && (
                      <ActionButton
                        intent="primary"
                        startIcon={<CheckCircle2 size={16} />}
                        disabled={anyMutationPending}
                        loading={
                          activeMutationPending &&
                          changeMutation.variables?.action === 'check-in' &&
                          changeMutation.variables.booking.bookingId === booking.bookingId
                        }
                        onClick={() =>
                          submitBookingAction({ identityKey, booking, action: 'check-in' })
                        }
                        {...workplaceDecisionActionProps(`check-in:${booking.bookingId}`)}
                      >
                        {t('workplace.my.checkIn')}
                      </ActionButton>
                    )}
                    {actionPolicy?.canRelease && (
                      <ActionButton
                        intent="secondary"
                        startIcon={<LogOut size={16} />}
                        disabled={anyMutationPending}
                        onClick={() => setConfirming({ identityKey, booking, action: 'release' })}
                        {...workplaceDecisionActionProps(`release:${booking.bookingId}`)}
                      >
                        {t('workplace.my.release')}
                      </ActionButton>
                    )}
                    {actionPolicy?.canCancel && (
                      <ActionButton
                        intent="secondary"
                        startIcon={<PencilLine size={16} />}
                        disabled={anyMutationPending}
                        onClick={(event) => {
                          relocateTriggerRef.current = event.currentTarget;
                          setRelocateDeniedNotice(null);
                          setRelocating({ identityKey, booking });
                        }}
                      >
                        {t('workplace.my.relocate.action')}
                      </ActionButton>
                    )}
                    {actionPolicy?.canCancel && (
                      <ActionButton
                        intent="danger"
                        startIcon={<XCircle size={16} />}
                        disabled={anyMutationPending}
                        onClick={() => setConfirming({ identityKey, booking, action: 'cancel' })}
                        {...workplaceDecisionActionProps(`cancel:${booking.bookingId}`)}
                      >
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
      <WorkplaceReleaseWindows />
      <WorkplaceRelocateBookingDialog
        booking={activeRelocating}
        identityKey={identityKey}
        isBookingCurrent={isCurrentRelocateBooking}
        open={Boolean(activeRelocating)}
        onClose={() => setRelocating(null)}
        onDenied={({ identityKey: deniedIdentityKey, bookingId }) => {
          if (deniedIdentityKey !== activeIdentityRef.current) return;
          setRelocating(null);
          setRelocateDeniedNotice({ identityKey: deniedIdentityKey, bookingId });
        }}
      />
      <ConfirmDialog
        open={Boolean(activeConfirming)}
        title={t(
          activeConfirming?.action === 'release'
            ? 'workplace.my.releaseTitle'
            : 'workplace.my.cancelTitle'
        )}
        description={t(
          activeConfirming?.action === 'release'
            ? 'workplace.my.releaseDescription'
            : 'workplace.my.cancelDescription'
        )}
        cancelLabel={t('actions.keep')}
        confirmLabel={t(
          activeConfirming?.action === 'release' ? 'workplace.my.release' : 'actions.cancelBooking'
        )}
        confirmingLabel={t('actions.saving')}
        intent={activeConfirming?.action === 'release' ? 'primary' : 'danger'}
        busy={activeMutationPending}
        onClose={() => {
          if (!activeMutationPending) setConfirming(null);
        }}
        onConfirm={() => {
          if (activeConfirming) submitBookingAction(activeConfirming);
        }}
      />
    </PageCanvas>
  );
}
