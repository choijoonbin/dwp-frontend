import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays } from 'lucide-react';
import { resolveSystemTimeZone } from '@dwp-frontend/shared-i18n';
import {
  cancelAuthenticatedCalendarBooking,
  cancelAuthenticatedCalendarBookingHold,
  confirmAuthenticatedCalendarBooking,
  createAuthenticatedCalendarBookingHold,
  getAuthenticatedCalendarBookablePage,
  getAuthenticatedCalendarBookingAvailability,
  getCalendarBookingCapabilities,
  getCalendarBookingPage,
  getMyCalendarBookingAppointment,
  listCalendarBookingPages,
  listMyCalendarBookingAppointments,
  rescheduleAuthenticatedCalendarBooking,
  resolveIdempotentMutationIntent,
  useAuth,
  useToast,
  type CalendarBookingAnswer,
  type CalendarBookingAppointment,
  type CalendarBookingAvailabilitySlot,
  type CalendarBookingHold,
  type CalendarBookingOneTimeToken,
  type CalendarBookingPage,
  type IdempotentMutationIntent,
} from '@dwp-frontend/shared-utils';
import type { TFunction } from 'i18next';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { CalendarPageHeading } from '../calendar-components';
import { CalendarCanvas } from '../calendar-experience';
import {
  CalendarBookingAppointments,
  CalendarBookingBookablePanel,
  CalendarBookingCapabilityNotice,
  CalendarBookingOneTimeTokenNotice,
  CalendarBookingOwnedPageDetail,
  CalendarBookingPageBrowser,
  CalendarBookingStatus,
  type CalendarBookingCopy,
} from './calendar-booking-components';
import {
  calendarBookingAvailabilityRange,
  CALENDAR_BOOKING_APPOINTMENT_SERVER_LIMIT,
  type CalendarBookingAnswerDraft,
} from './calendar-booking-model';
import {
  calendarBookingQueryState,
  combineCalendarBookingQueryStates,
  isCalendarBookingAuthorityFailure,
  isCalendarBookingVersionConflict,
  retryCalendarBookingRead,
  type CalendarBookingQueryState,
} from './calendar-booking-query-state';

function queryState<T>(
  query: Readonly<{
    data: T | undefined;
    error: unknown;
    isError: boolean;
    isPending: boolean;
    isFetching: boolean;
  }>,
  enabled: boolean,
  empty: (data: T) => boolean,
  partial?: (data: T) => boolean
) {
  return calendarBookingQueryState(query, { enabled, empty, partial });
}

function bookingCopy(t: TFunction<'calendar'>) {
  return {
    loading: t('booking.states.loading'),
    empty: t('booking.states.empty'),
    unavailable: t('booking.states.unavailable'),
    denied: t('booking.states.denied'),
    disabled: t('booking.states.disabled'),
    stale: t('booking.states.stale'),
    partial: t('booking.states.partial'),
    retry: t('actions.retry'),
    searchLabel: t('booking.pages.searchLabel'),
    searchPlaceholder: t('booking.pages.searchPlaceholder'),
    pagesLabel: t('booking.pages.listLabel'),
    noSearchResults: t('booking.pages.noSearchResults'),
    showMore: t('booking.pages.showMore'),
    externalDisabled: t('booking.capabilities.externalDisabled'),
    externalEnabled: t('booking.capabilities.externalEnabled'),
    selectPage: (title) => t('booking.pages.select', { title }),
    pageState: (state) => t(`booking.pageStates.${state}`),
    minutes: (minutes) => t('units.minutes', { count: minutes }),
    pageDetailHeading: t('booking.pages.detailHeading'),
    timeZone: (value) => t('booking.pages.timeZone', { value }),
    dailyLimit: (count) => t('booking.pages.dailyLimit', { count }),
    notice: (minutes) => t('booking.pages.notice', { minutes }),
    advanceWindow: (days) => t('booking.pages.advanceWindow', { days }),
    buffers: (before, after) => t('booking.pages.buffers', { before, after }),
    availabilityRuleCount: (count) => t('booking.pages.availabilityRuleCount', { count }),
    questionCount: (count) => t('booking.pages.questionCount', { count }),
    bookableHeading: t('booking.bookable.heading'),
    slotsLabel: t('booking.bookable.slotsLabel'),
    noSlots: t('booking.bookable.noSlots'),
    showMoreSlots: t('booking.bookable.showMoreSlots'),
    selectSlot: (value) => t('booking.bookable.selectSlot', { value }),
    createHold: t('booking.bookable.createHold'),
    releaseHold: t('booking.bookable.releaseHold'),
    holdExpired: t('booking.bookable.holdExpired'),
    versionChanged: t('booking.bookable.versionChanged'),
    accessInfoMissing: t('booking.bookable.accessInfoMissing'),
    meetingMode: (mode) => t(`booking.meetingModes.${mode}`),
    accessInformation: t('booking.bookable.accessInformation'),
    openVideo: t('booking.bookable.openVideo'),
    questionsHeading: t('booking.questions.heading'),
    required: t('booking.questions.required'),
    answerRequired: t('booking.questions.answerRequired'),
    invalidAnswer: t('booking.questions.invalidAnswer'),
    confirmBooking: t('booking.bookable.confirm'),
    confirmReschedule: t('booking.bookable.confirmReschedule'),
    appointmentsHeading: t('booking.appointments.heading'),
    appointmentsLabel: t('booking.appointments.listLabel'),
    selectAppointment: (value) => t('booking.appointments.select', { value }),
    appointmentState: (state) => t(`booking.appointmentStates.${state}`),
    appointmentDetail: t('booking.appointments.detail'),
    appointmentPage: t('booking.appointments.page'),
    appointmentTime: t('booking.appointments.time'),
    requestReschedule: t('booking.appointments.reschedule'),
    cancelReason: t('booking.appointments.cancelReason'),
    cancelAppointment: t('booking.appointments.cancel'),
    actionsUnavailable: t('booking.appointments.actionsUnavailable'),
    oneTimeTokenHeading: t('booking.token.heading'),
    publicTokenDescription: t('booking.token.publicDescription'),
    managementTokenDescription: t('booking.token.managementDescription'),
    dismissToken: t('booking.token.dismiss'),
  } satisfies CalendarBookingCopy;
}

function forced(state: CalendarBookingQueryState, revoked: boolean) {
  return revoked ? ('DENIED' as const) : state;
}

export function CalendarBookingWorkspace() {
  const { t, i18n } = useTranslation('calendar');
  const auth = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const identity = auth.user
    ? `${auth.user.tenantId}:${auth.user.userId}:${auth.user.personPublicId ?? ''}`
    : null;
  const copy = useMemo(() => bookingCopy(t), [t]);
  const range = useMemo(() => calendarBookingAvailabilityRange(new Date(), 14), []);
  const rootKey = useMemo(() => ['calendar', 'booking', identity] as const, [identity]);
  const [revoked, setRevoked] = useState(false);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<CalendarBookingAvailabilitySlot | null>(null);
  const [hold, setHold] = useState<CalendarBookingHold | null>(null);
  const [heldPageVersion, setHeldPageVersion] = useState<number | null>(null);
  const [answers, setAnswers] = useState<CalendarBookingAnswerDraft>({});
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<CalendarBookingAppointment | null>(null);
  const [oneTimeToken, setOneTimeToken] = useState<CalendarBookingOneTimeToken | null>(null);
  const [now, setNow] = useState(Date.now());
  const holdIntent = useRef<IdempotentMutationIntent | null>(null);
  const confirmIntent = useRef<IdempotentMutationIntent | null>(null);
  const rescheduleIntent = useRef<IdempotentMutationIntent | null>(null);
  const authenticated = Boolean(identity && auth.isAuthenticated && !auth.isLoading);

  const clearFlow = useCallback(() => {
    setSelectedSlot(null);
    setHold(null);
    setHeldPageVersion(null);
    setAnswers({});
    holdIntent.current = null;
    confirmIntent.current = null;
    rescheduleIntent.current = null;
  }, []);

  const clearPrivateUiState = useCallback(() => {
    clearFlow();
    setSelectedPageId(null);
    setSelectedAppointmentId(null);
    setRescheduleTarget(null);
    setOneTimeToken(null);
  }, [clearFlow]);

  const purgePrivateState = useCallback(async () => {
    clearPrivateUiState();
    await queryClient.cancelQueries({ queryKey: rootKey });
    queryClient.removeQueries({ queryKey: rootKey });
  }, [clearPrivateUiState, queryClient, rootKey]);

  useEffect(() => {
    setRevoked(false);
    clearPrivateUiState();
    return () => {
      void queryClient.cancelQueries({ queryKey: rootKey });
      queryClient.removeQueries({ queryKey: rootKey });
    };
  }, [clearPrivateUiState, identity, queryClient, rootKey]);

  useEffect(() => {
    if (!hold) return undefined;
    const delay = Math.max(0, Date.parse(hold.expiresAt) - Date.now() + 25);
    const timer = window.setTimeout(() => setNow(Date.now()), Math.min(delay, 2_147_483_647));
    return () => window.clearTimeout(timer);
  }, [hold]);

  const capabilitiesQuery = useQuery({
    queryKey: [...rootKey, 'capabilities'],
    queryFn: ({ signal }) => getCalendarBookingCapabilities(signal),
    enabled: authenticated && !revoked,
    staleTime: 0,
    gcTime: 0,
    retry: retryCalendarBookingRead,
    meta: { accessSensitive: true, identity },
  });
  const capabilitiesState = queryState(capabilitiesQuery, authenticated && !revoked, () => false);
  const bookingEnabled =
    capabilitiesState === 'READY' &&
    capabilitiesQuery.data?.authenticatedBookingEnabled === true &&
    !revoked;

  const pagesQuery = useQuery({
    queryKey: [...rootKey, 'pages'],
    queryFn: ({ signal }) => listCalendarBookingPages(signal),
    enabled: bookingEnabled,
    staleTime: 0,
    gcTime: 0,
    retry: retryCalendarBookingRead,
    meta: { accessSensitive: true, identity },
  });
  const appointmentsQuery = useQuery({
    queryKey: [...rootKey, 'appointments'],
    queryFn: ({ signal }) => listMyCalendarBookingAppointments(signal),
    enabled: bookingEnabled,
    staleTime: 0,
    gcTime: 0,
    retry: retryCalendarBookingRead,
    meta: { accessSensitive: true, identity },
  });
  const pagesState = forced(
    queryState(pagesQuery, bookingEnabled, (data) => data.length === 0),
    revoked
  );
  const appointmentsState = forced(
    queryState(
      appointmentsQuery,
      bookingEnabled,
      (data) => data.length === 0,
      (data) => data.length >= CALENDAR_BOOKING_APPOINTMENT_SERVER_LIMIT
    ),
    revoked
  );
  const appointmentDetailQuery = useQuery({
    queryKey: [...rootKey, 'appointment-detail', selectedAppointmentId],
    queryFn: ({ signal }) => getMyCalendarBookingAppointment(selectedAppointmentId!, signal),
    enabled: bookingEnabled && Boolean(selectedAppointmentId),
    staleTime: 0,
    gcTime: 0,
    retry: retryCalendarBookingRead,
    meta: { accessSensitive: true, identity },
  });
  const appointmentDetailState = queryState(
    appointmentDetailQuery,
    bookingEnabled && Boolean(selectedAppointmentId),
    () => false
  );
  const appointmentActionState = selectedAppointmentId
    ? combineCalendarBookingQueryStates([appointmentsState, appointmentDetailState])
    : 'EMPTY';
  const appointments = useMemo(() => {
    const listed = appointmentsQuery.data ?? [];
    if (!appointmentDetailQuery.data) return listed;
    const replaced = listed.map((appointment) =>
      appointment.appointmentId === appointmentDetailQuery.data?.appointmentId
        ? appointmentDetailQuery.data
        : appointment
    );
    return replaced.some(
      (appointment) => appointment.appointmentId === appointmentDetailQuery.data?.appointmentId
    )
      ? replaced
      : [...replaced, appointmentDetailQuery.data];
  }, [appointmentDetailQuery.data, appointmentsQuery.data]);
  const pages = pagesQuery.data ?? [];
  const selectedListedPage = pages.find((page) => page.pageId === selectedPageId) ?? null;
  const pageDetailQuery = useQuery({
    queryKey: [...rootKey, 'page-detail', selectedPageId],
    queryFn: ({ signal }) => getCalendarBookingPage(selectedPageId!, signal),
    enabled: bookingEnabled && Boolean(selectedListedPage),
    staleTime: 0,
    gcTime: 0,
    retry: retryCalendarBookingRead,
    meta: { accessSensitive: true, identity },
  });
  const pageDetailState = queryState(
    pageDetailQuery,
    bookingEnabled && Boolean(selectedListedPage),
    () => false
  );
  const selectedIsBookable = Boolean(rescheduleTarget) || selectedListedPage?.state === 'PUBLISHED';

  const bookableQuery = useQuery({
    queryKey: [...rootKey, 'bookable', selectedPageId],
    queryFn: ({ signal }) => getAuthenticatedCalendarBookablePage(selectedPageId!, signal),
    enabled: bookingEnabled && Boolean(selectedPageId) && selectedIsBookable,
    staleTime: 0,
    gcTime: 0,
    retry: retryCalendarBookingRead,
    meta: { accessSensitive: true, identity },
  });
  const availabilityQuery = useQuery({
    queryKey: [...rootKey, 'availability', selectedPageId, range.from, range.to],
    queryFn: ({ signal }) =>
      getAuthenticatedCalendarBookingAvailability(selectedPageId!, range, signal),
    enabled: bookingEnabled && Boolean(selectedPageId) && selectedIsBookable,
    staleTime: 0,
    gcTime: 0,
    retry: retryCalendarBookingRead,
    meta: { accessSensitive: true, identity },
  });
  const bookableState = queryState(
    bookableQuery,
    bookingEnabled && Boolean(selectedPageId) && selectedIsBookable,
    () => false
  );
  const availabilityState = queryState(
    availabilityQuery,
    bookingEnabled && Boolean(selectedPageId) && selectedIsBookable,
    (data) => data.slots.length === 0
  );
  const versionsMatch = Boolean(
    bookableQuery.data &&
    availabilityQuery.data &&
    bookableQuery.data.pageId === selectedPageId &&
    availabilityQuery.data.pageId === selectedPageId &&
    Date.parse(availabilityQuery.data.from) === Date.parse(range.from) &&
    Date.parse(availabilityQuery.data.to) === Date.parse(range.to) &&
    bookableQuery.data.pageVersion === availabilityQuery.data.pageVersion &&
    (!pageDetailQuery.data || pageDetailQuery.data.version === bookableQuery.data.pageVersion)
  );
  const combinedBookingPanelState = selectedPageId
    ? combineCalendarBookingQueryStates([
        bookableState,
        availabilityState === 'EMPTY' ? 'READY' : availabilityState,
      ])
    : 'EMPTY';
  const bookingPanelState = forced(
    combinedBookingPanelState === 'READY' && !versionsMatch ? 'STALE' : combinedBookingPanelState,
    revoked
  );

  useEffect(() => {
    const denied = [
      capabilitiesState,
      pagesState,
      appointmentsState,
      appointmentDetailState,
      pageDetailState,
      bookableState,
      availabilityState,
    ]
      .filter((state) => state !== 'DISABLED')
      .some((state) => state === 'DENIED');
    if (!denied || revoked) return;
    setRevoked(true);
    void purgePrivateState();
  }, [
    appointmentsState,
    appointmentDetailState,
    availabilityState,
    bookableState,
    capabilitiesState,
    pageDetailState,
    pagesState,
    purgePrivateState,
    revoked,
  ]);

  const handleMutationError = useCallback(
    (error: unknown) => {
      if (isCalendarBookingAuthorityFailure(error)) {
        setRevoked(true);
        void purgePrivateState();
        toast.error(t('booking.toast.denied'));
        return;
      }
      if (isCalendarBookingVersionConflict(error)) {
        clearFlow();
        void queryClient.invalidateQueries({ queryKey: rootKey });
        toast.warning(t('booking.toast.versionChanged'));
        return;
      }
      toast.error(t('booking.toast.actionError'));
    },
    [clearFlow, purgePrivateState, queryClient, rootKey, t, toast]
  );

  const createHold = useMutation({
    mutationFn: ({
      pageId,
      pageVersion,
      slot,
      idempotencyKey,
    }: Readonly<{
      pageId: string;
      pageVersion: number;
      slot: CalendarBookingAvailabilitySlot;
      idempotencyKey: string;
    }>) =>
      createAuthenticatedCalendarBookingHold(pageId, {
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        idempotencyKey,
        pageVersion,
      }),
    retry: false,
    onSuccess: (created, request) => {
      setHold(created);
      setHeldPageVersion(request.pageVersion);
      setNow(Date.now());
      toast.success(t('booking.toast.holdCreated'));
    },
    onError: handleMutationError,
  });
  const releaseHold = useMutation({
    mutationFn: (value: CalendarBookingHold) =>
      cancelAuthenticatedCalendarBookingHold(value.pageId, value.holdId, {
        fencingToken: value.fencingToken,
      }),
    retry: false,
    onError: handleMutationError,
    onSettled: () => {
      clearFlow();
      void queryClient.invalidateQueries({ queryKey: [...rootKey, 'availability'] });
    },
  });
  const confirm = useMutation({
    mutationFn: ({
      pageId,
      held,
      bookingAnswers,
      idempotencyKey,
    }: Readonly<{
      pageId: string;
      held: CalendarBookingHold;
      bookingAnswers: readonly CalendarBookingAnswer[];
      idempotencyKey: string;
    }>) =>
      confirmAuthenticatedCalendarBooking(
        pageId,
        {
          holdId: held.holdId,
          fencingToken: held.fencingToken,
          idempotencyKey,
          answers: [...bookingAnswers],
        },
        setOneTimeToken
      ),
    retry: false,
    onSuccess: (created) => {
      clearFlow();
      setSelectedAppointmentId(created.appointmentId);
      void queryClient.invalidateQueries({ queryKey: rootKey });
      toast.success(t('booking.toast.confirmed'));
    },
    onError: handleMutationError,
  });
  const reschedule = useMutation({
    mutationFn: ({
      target,
      replacement,
      idempotencyKey,
    }: Readonly<{
      target: CalendarBookingAppointment;
      replacement: CalendarBookingHold;
      idempotencyKey: string;
    }>) =>
      rescheduleAuthenticatedCalendarBooking(target.appointmentId, {
        replacementHoldId: replacement.holdId,
        fencingToken: replacement.fencingToken,
        idempotencyKey,
        version: target.version,
      }),
    retry: false,
    onSuccess: (updated) => {
      clearFlow();
      setRescheduleTarget(null);
      setSelectedAppointmentId(updated.appointmentId);
      void queryClient.invalidateQueries({ queryKey: rootKey });
      toast.success(t('booking.toast.rescheduled'));
    },
    onError: handleMutationError,
  });
  const cancel = useMutation({
    mutationFn: (input: { appointmentId: string; version: number; reason: string | null }) =>
      cancelAuthenticatedCalendarBooking(input.appointmentId, {
        version: input.version,
        reason: input.reason,
      }),
    retry: false,
    onSuccess: (updated) => {
      setSelectedAppointmentId(updated.appointmentId);
      void queryClient.invalidateQueries({ queryKey: rootKey });
      toast.success(t('booking.toast.cancelled'));
    },
    onError: handleMutationError,
  });

  const selectPage = useCallback(
    async (page: CalendarBookingPage) => {
      if (rescheduleTarget && page.pageId !== rescheduleTarget.pageId) {
        toast.warning(t('booking.toast.reschedulePageLocked'));
        return;
      }
      if (hold) await releaseHold.mutateAsync(hold).catch(() => undefined);
      clearFlow();
      setSelectedPageId(page.pageId);
    },
    [clearFlow, hold, releaseHold, rescheduleTarget, t, toast]
  );
  const requestHold = useCallback(
    (slot: CalendarBookingAvailabilitySlot, pageVersion: number) => {
      if (!selectedPageId || bookingPanelState !== 'READY') return;
      holdIntent.current = resolveIdempotentMutationIntent(holdIntent.current, {
        pageId: selectedPageId,
        pageVersion,
        slot,
      });
      createHold.mutate({
        pageId: selectedPageId,
        pageVersion,
        slot,
        idempotencyKey: holdIntent.current.key,
      });
    },
    [bookingPanelState, createHold, selectedPageId]
  );
  const completeBooking = useCallback(
    (bookingAnswers: readonly CalendarBookingAnswer[], held: CalendarBookingHold) => {
      if (!selectedPageId || bookingPanelState !== 'READY') return;
      if (rescheduleTarget) {
        if (selectedPageId !== rescheduleTarget.pageId || held.pageId !== rescheduleTarget.pageId) {
          clearFlow();
          toast.warning(t('booking.toast.reschedulePageLocked'));
          return;
        }
        rescheduleIntent.current = resolveIdempotentMutationIntent(rescheduleIntent.current, {
          appointmentId: rescheduleTarget.appointmentId,
          version: rescheduleTarget.version,
          holdId: held.holdId,
          fencingToken: held.fencingToken,
        });
        reschedule.mutate({
          target: rescheduleTarget,
          replacement: held,
          idempotencyKey: rescheduleIntent.current.key,
        });
        return;
      }
      confirmIntent.current = resolveIdempotentMutationIntent(confirmIntent.current, {
        pageId: selectedPageId,
        holdId: held.holdId,
        fencingToken: held.fencingToken,
        answers: bookingAnswers,
      });
      confirm.mutate({
        pageId: selectedPageId,
        held,
        bookingAnswers,
        idempotencyKey: confirmIntent.current.key,
      });
    },
    [bookingPanelState, clearFlow, confirm, reschedule, rescheduleTarget, selectedPageId, t, toast]
  );
  const beginReschedule = useCallback(
    (appointment: CalendarBookingAppointment) => {
      clearFlow();
      setRescheduleTarget(appointment);
      setSelectedAppointmentId(appointment.appointmentId);
      setSelectedPageId(appointment.pageId);
    },
    [clearFlow]
  );
  const retryAll = useCallback(() => {
    setRevoked(false);
    void queryClient.invalidateQueries({ queryKey: rootKey });
  }, [queryClient, rootKey]);
  const busy =
    createHold.isPending ||
    releaseHold.isPending ||
    confirm.isPending ||
    reschedule.isPending ||
    cancel.isPending;
  const language = i18n.resolvedLanguage ?? i18n.language;
  const localTimeZone = useMemo(() => resolveSystemTimeZone('UTC'), []);
  const capabilityDisplayState = forced(
    capabilitiesState === 'READY' && capabilitiesQuery.data?.authenticatedBookingEnabled === false
      ? 'DISABLED'
      : capabilitiesState,
    revoked
  );

  return (
    <CalendarCanvas archetype="master-detail">
      <CalendarPageHeading
        icon={CalendarDays}
        eyebrow={t('booking.eyebrow')}
        title={t('booking.title')}
        description={t('booking.description')}
      />
      <Stack spacing={2.5}>
        <CalendarBookingStatus
          state={capabilityDisplayState}
          copy={copy}
          onRetry={capabilityDisplayState === 'UNAVAILABLE' ? retryAll : undefined}
        />
        {capabilitiesQuery.data ? (
          <CalendarBookingCapabilityNotice
            externalEnabled={capabilitiesQuery.data.externalPublicBookingEnabled}
            disabledReason={
              capabilitiesQuery.data.externalPublicBookingEnabled
                ? undefined
                : t('booking.capabilities.externalDisabledReason')
            }
            copy={copy}
          />
        ) : null}
        {oneTimeToken ? (
          <CalendarBookingOneTimeTokenNotice
            token={oneTimeToken}
            copy={copy}
            onDismiss={() => setOneTimeToken(null)}
          />
        ) : null}
        {bookingEnabled ? (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'minmax(0, 1fr)',
                lg: 'minmax(260px, 0.75fr) minmax(0, 1.25fr)',
              },
              gap: { xs: 2, lg: 3 },
              alignItems: 'start',
            }}
          >
            <CalendarBookingPageBrowser
              pages={pages}
              state={pages.length === 0 && pagesState === 'READY' ? 'EMPTY' : pagesState}
              selectedPageId={selectedPageId}
              copy={copy}
              onSelect={(page) => void selectPage(page)}
              onRetry={() => void pagesQuery.refetch()}
            />
            <Stack spacing={2}>
              {!selectedPageId ? (
                <Typography role="status" color="text.secondary">
                  {t('booking.pages.selectPrompt')}
                </Typography>
              ) : null}
              {selectedListedPage ? (
                <CalendarBookingOwnedPageDetail
                  page={pageDetailQuery.data ?? null}
                  state={forced(pageDetailState, revoked)}
                  copy={copy}
                  onRetry={() => void pageDetailQuery.refetch()}
                />
              ) : null}
              {selectedIsBookable ? (
                <CalendarBookingBookablePanel
                  page={bookableQuery.data ?? null}
                  availability={availabilityQuery.data ?? null}
                  state={bookingPanelState}
                  selectedSlot={selectedSlot}
                  hold={hold}
                  heldPageVersion={heldPageVersion}
                  answers={answers}
                  purpose={rescheduleTarget ? 'RESCHEDULE' : 'BOOK'}
                  locale={language}
                  busy={busy}
                  now={now}
                  copy={copy}
                  onSelectSlot={setSelectedSlot}
                  onCreateHold={requestHold}
                  onReleaseHold={(value) => releaseHold.mutate(value)}
                  onAnswer={(key, value) => setAnswers((current) => ({ ...current, [key]: value }))}
                  onConfirm={completeBooking}
                  onRetry={() => {
                    void bookableQuery.refetch();
                    void availabilityQuery.refetch();
                  }}
                />
              ) : null}
            </Stack>
          </Box>
        ) : null}
        {bookingEnabled ? (
          <CalendarBookingAppointments
            appointments={appointments}
            state={appointmentsState}
            actionState={forced(appointmentActionState, revoked)}
            selectedAppointmentId={selectedAppointmentId}
            locale={language}
            timeZone={localTimeZone}
            copy={copy}
            busy={busy}
            now={now}
            onSelect={(appointment) => setSelectedAppointmentId(appointment.appointmentId)}
            onRequestReschedule={beginReschedule}
            onCancel={(input) => cancel.mutate(input)}
            onRetry={() => void appointmentsQuery.refetch()}
          />
        ) : null}
      </Stack>
    </CalendarCanvas>
  );
}
