import { foundationTokens } from '@dwp-frontend/design-system';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActionButton,
  LiveStatus,
  LocalErrorState,
  LoadingState,
  PageCanvas,
} from '@dwp-frontend/design-system';
import {
  formatDate,
  resolveSupportedLocale,
  resolveSystemTimeZone,
} from '@dwp-frontend/shared-i18n';
import { useSearchParams } from 'react-router-dom';
import { Temporal } from 'temporal-polyfill';
import {
  checkInWorkplaceBooking,
  getCalendarHome,
  getRoomBookings,
  getRoomsPolicy,
  getWorkplaceBookings,
  getWorkplaceExplore,
  useAuth,
  usePermissions,
  useToast,
} from '@dwp-frontend/shared-utils';

import { InlineFeedback } from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';

import { useRoomsCapabilities, useWorkplaceGovernanceCapabilities } from './rooms-capabilities';
import { retryRecoverableWorkplaceRead } from './workplace-authority-failure';
import { workplaceBookingActionPolicy } from './workplace-booking-action-policy';
import { useWorkplaceDecisionClock } from './workplace-decision-clock';
import { workplaceHomeDecisionDeadline } from './workplace-home-decision-clock';
import { useWorkplaceDecisionStatus } from './workplace-decision-status';
import { buildWorkplaceHomeModel, workplaceHomeQueryRange } from './workplace-home-model';
import {
  workplaceHomeSourceComplete,
  workplaceHomeSourceData,
  workplaceHomeSourceState,
} from './workplace-home-source-state';
import {
  WorkplaceAttentionSection,
  WorkplaceDayBrief,
  WorkplaceReadySpaces,
  WorkplaceTodayFlow,
} from './workplace-home-sections';
import { WorkplaceWeekRhythm } from './workplace-week-rhythm';
import { WorkplaceHomeScope } from './workplace-home-scope';
import { WorkplaceHomeSourceSummary } from './workplace-home-source-summary';

import type { WorkplaceBooking, WorkplaceExploreResponse } from '@dwp-frontend/shared-utils';

const REFRESH_INTERVAL = 60_000;
const DECISION_BOUNDARY_SETTLE_MS = 10;

type WorkplaceHomeExploreSnapshot = {
  explore: WorkplaceExploreResponse;
  range: ReturnType<typeof workplaceHomeQueryRange>;
};

type WorkplaceHomeCheckInAction = {
  identityKey: string;
  booking: WorkplaceBooking;
};

type SubmittedCheckInAction = {
  identityKey: string;
  actionId: string;
};

export function WorkplaceHome() {
  const { t, i18n } = useTranslation('rooms');
  const auth = useAuth();
  const capabilities = useRoomsCapabilities();
  const governance = useWorkplaceGovernanceCapabilities();
  const permissions = usePermissions();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedFloorId = searchParams.get('floor') ?? '';
  const requestedStart = searchParams.get('from');
  const [scopeCatalog, setScopeCatalog] = useState<{
    identityKey: string;
    catalog: WorkplaceExploreResponse;
  } | null>(null);
  const identityKey = `${auth.user?.tenantId ?? 'anonymous'}:${auth.user?.userId ?? 'anonymous'}`;
  const activeIdentityRef = useRef(identityKey);
  const completeDecisionActionRef = useRef<(identityKey: string, actionId: string) => void>(
    () => undefined
  );
  const [submittedCheckInAction, setSubmittedCheckInAction] =
    useState<SubmittedCheckInAction | null>(null);
  activeIdentityRef.current = identityKey;
  const browserTimeZone = useMemo(() => resolveSystemTimeZone('Asia/Seoul'), []);
  const exploreQuery = useQuery({
    queryKey: ['workplace', 'home', identityKey, 'explore', requestedFloorId, requestedStart],
    queryFn: async (): Promise<WorkplaceHomeExploreSnapshot> => {
      const range = workplaceHomeQueryRange(new Date(), browserTimeZone);
      if (requestedStart) {
        try {
          const start = Temporal.Instant.from(requestedStart);
          range.availabilityFrom = start.toString();
          range.availabilityTo = start.add({ hours: 1 }).toString();
        } catch {
          /* A malformed URL uses the current native availability window. */
        }
      }
      const explore = await getWorkplaceExplore(
        range.availabilityFrom,
        range.availabilityTo,
        requestedFloorId || null
      );
      return { explore, range };
    },
    enabled: capabilities.isLoaded && capabilities.canViewWorkplace,
    staleTime: 30_000,
    refetchInterval: REFRESH_INTERVAL,
    retry: retryRecoverableWorkplaceRead,
  });
  const queriedFloor = exploreQuery.data?.explore.selectedFloor ?? null;
  const queriedSite =
    exploreQuery.data?.explore.sites.find((site) => site.siteId === queriedFloor?.siteId) ?? null;
  const timeZone = queriedSite?.timeZone ?? browserTimeZone;
  const bookingsQuery = useQuery({
    queryKey: ['workplace', 'home', identityKey, 'bookings', timeZone],
    queryFn: () => {
      const range = workplaceHomeQueryRange(new Date(), timeZone);
      return getWorkplaceBookings(range.bookingsFrom, range.bookingsTo);
    },
    enabled: exploreQuery.isFetched,
    staleTime: 30_000,
    refetchInterval: REFRESH_INTERVAL,
    retry: retryRecoverableWorkplaceRead,
  });
  const roomBookingsQuery = useQuery({
    queryKey: ['workplace', 'home', identityKey, 'room-bookings', timeZone],
    queryFn: () => {
      const range = workplaceHomeQueryRange(new Date(), timeZone);
      return getRoomBookings(range.bookingsFrom, range.bookingsTo);
    },
    enabled: capabilities.isLoaded && capabilities.canViewRooms && exploreQuery.isFetched,
    staleTime: 30_000,
    refetchInterval: REFRESH_INTERVAL,
    retry: retryRecoverableWorkplaceRead,
  });

  const roomSourceRequired = capabilities.isLoaded && capabilities.canViewRooms;
  const exploreState = workplaceHomeSourceState({
    data: exploreQuery.data,
    error: exploreQuery.error,
    failureCount: exploreQuery.failureCount,
    failureReason: exploreQuery.failureReason,
    isError: exploreQuery.isError,
    isPending: exploreQuery.isPending,
    required: true,
  });
  const bookingsState = workplaceHomeSourceState({
    data: bookingsQuery.data,
    error: bookingsQuery.error,
    failureCount: bookingsQuery.failureCount,
    failureReason: bookingsQuery.failureReason,
    isError: bookingsQuery.isError,
    isPending: bookingsQuery.isPending,
    required: true,
  });
  const roomBookingsState = workplaceHomeSourceState({
    data: roomBookingsQuery.data,
    error: roomBookingsQuery.error,
    failureCount: roomBookingsQuery.failureCount,
    failureReason: roomBookingsQuery.failureReason,
    isError: roomBookingsQuery.isError,
    isPending: roomBookingsQuery.isPending,
    required: roomSourceRequired,
  });
  const exploreSnapshot = workplaceHomeSourceData(exploreState, exploreQuery.data);
  const explore = exploreSnapshot?.explore;
  useEffect(() => {
    if (exploreState === 'DENIED') setScopeCatalog(null);
    else if (exploreState === 'READY' && explore)
      setScopeCatalog({ identityKey, catalog: explore });
  }, [explore, exploreState, identityKey]);
  const catalog =
    exploreState === 'DENIED'
      ? undefined
      : (explore ?? (scopeCatalog?.identityKey === identityKey ? scopeCatalog.catalog : undefined));
  const bookings = workplaceHomeSourceData(bookingsState, bookingsQuery.data);
  const roomBookings = workplaceHomeSourceData(roomBookingsState, roomBookingsQuery.data);
  const roomPolicyRequired =
    capabilities.isLoaded &&
    capabilities.canCreateRoomBooking &&
    Boolean(explore?.resources.some((resource) => resource.type === 'ROOM'));
  const roomPolicyQuery = useQuery({
    queryKey: ['rooms', 'policy', identityKey],
    queryFn: getRoomsPolicy,
    enabled: roomPolicyRequired,
    staleTime: 30_000,
    refetchInterval: REFRESH_INTERVAL,
    retry: retryRecoverableWorkplaceRead,
  });
  const roomPolicyState = workplaceHomeSourceState({
    data: roomPolicyQuery.data,
    error: roomPolicyQuery.error,
    failureCount: roomPolicyQuery.failureCount,
    failureReason: roomPolicyQuery.failureReason,
    isError: roomPolicyQuery.isError,
    isPending: roomPolicyQuery.isPending,
    required: roomPolicyRequired,
  });
  const canViewCalendar = permissions.isLoaded && permissions.hasPermission('APP.CALENDAR', 'VIEW');
  const calendarQuery = useQuery({
    queryKey: ['workplace', 'home', identityKey, 'calendar', timeZone],
    queryFn: () => getCalendarHome(timeZone),
    enabled: canViewCalendar && exploreState !== 'LOADING',
    staleTime: 30_000,
    refetchInterval: REFRESH_INTERVAL,
    retry: retryRecoverableWorkplaceRead,
  });
  const calendarState = workplaceHomeSourceState({
    data: calendarQuery.data,
    error: calendarQuery.error,
    failureCount: calendarQuery.failureCount,
    failureReason: calendarQuery.failureReason,
    isError: calendarQuery.isError,
    isPending: calendarQuery.isPending,
    required: canViewCalendar,
  });
  const bookingsStateRef = useRef(bookingsState);
  bookingsStateRef.current = bookingsState;
  const calendar = workplaceHomeSourceData(calendarState, calendarQuery.data);
  const {
    advance: advanceDecisionClock,
    nowInstant: homeDecisionInstant,
    readNow: readDecisionNow,
  } = useWorkplaceDecisionClock(identityKey, [explore?.generatedAt, calendar?.generatedAt]);
  const activeRange =
    exploreSnapshot?.range ?? workplaceHomeQueryRange(new Date(homeDecisionInstant), timeZone);
  const homeDecisionNow = new Date(homeDecisionInstant).toISOString();
  const bookability = useMemo(
    () => ({
      canCreateRoomBooking: capabilities.canCreateRoomBooking,
      canCreateWorkplaceBooking: capabilities.canCreateWorkplaceBooking,
      occupancy: explore?.occupancy ?? [],
      rangeFrom: activeRange.availabilityFrom,
      rangeTo: activeRange.availabilityTo,
      roomPolicy: roomPolicyQuery.data ?? null,
      roomPolicyReady: roomPolicyState === 'READY',
      serverNow: homeDecisionNow,
      timeZone,
      verified: exploreState === 'READY',
      workplacePolicy: explore?.policy ?? null,
    }),
    [
      activeRange.availabilityFrom,
      activeRange.availabilityTo,
      capabilities.canCreateRoomBooking,
      capabilities.canCreateWorkplaceBooking,
      explore?.occupancy,
      explore?.policy,
      exploreState,
      roomPolicyQuery.data,
      roomPolicyState,
      timeZone,
      homeDecisionNow,
    ]
  );

  const model = useMemo(
    () =>
      buildWorkplaceHomeModel({
        explore,
        bookings,
        roomBookings,
        calendar,
        bookability,
        now: homeDecisionNow,
        timeZone,
        bookingSourceState: bookingsState,
        canUpdateWorkplaceBooking: true,
      }),
    [
      bookability,
      bookings,
      bookingsState,
      calendar,
      explore,
      homeDecisionNow,
      roomBookings,
      timeZone,
    ]
  );

  const checkInMutation = useMutation({
    mutationFn: ({ booking, identityKey: actionIdentityKey }: WorkplaceHomeCheckInAction) => {
      const currentBooking = bookings?.find(
        (candidate) =>
          candidate.bookingId === booking.bookingId && candidate.version === booking.version
      );
      if (actionIdentityKey !== activeIdentityRef.current || !currentBooking) {
        throw new Error('workplace-update-denied');
      }
      const actionPolicy = workplaceBookingActionPolicy({
        booking: currentBooking,
        sourceState: bookingsStateRef.current,
        canUpdateWorkplaceBooking: capabilities.canUpdateWorkplaceBooking,
        nowInstant: readDecisionNow(),
      });
      if (!actionPolicy.canCheckIn) throw new Error('workplace-update-denied');
      setSubmittedCheckInAction({
        identityKey: actionIdentityKey,
        actionId: `check-in:${currentBooking.bookingId}`,
      });
      return checkInWorkplaceBooking(currentBooking.bookingId, currentBooking.version);
    },
    onSuccess: async (_, variables) => {
      if (variables.identityKey !== activeIdentityRef.current) return;
      completeDecisionActionRef.current(
        variables.identityKey,
        `check-in:${variables.booking.bookingId}`
      );
      await queryClient.invalidateQueries({ queryKey: ['workplace'] });
      if (variables.identityKey === activeIdentityRef.current) {
        toast.success(t('workplace.my.check-inSaved'));
      }
    },
    onError: (_, variables) => {
      if (variables.identityKey === activeIdentityRef.current) {
        toast.error(t('workplace.my.actionError'));
      }
    },
    onSettled: (_, __, variables) => {
      checkInInFlightRef.current = false;
      setSubmittedCheckInAction((current) =>
        current?.identityKey === variables.identityKey &&
        current.actionId === `check-in:${variables.booking.bookingId}`
          ? null
          : current
      );
    },
  });
  const checkInInFlightRef = useRef(false);

  const hasExploreData = explore !== undefined;
  const hasBookingsData = bookings !== undefined;
  const hasRoomBookingsData = roomBookings !== undefined;
  const hasCalendarData = calendar !== undefined;
  const hasAnyData = hasExploreData || hasBookingsData || hasRoomBookingsData || hasCalendarData;
  const calendarSourceRequired = canViewCalendar;
  const sourceStates = [
    exploreState,
    bookingsState,
    roomBookingsState,
    roomPolicyState,
    calendarState,
  ];
  const hasUnavailableData = sourceStates.some(
    (state) => state === 'DENIED' || state === 'UNAVAILABLE'
  );
  const hasStaleData = sourceStates.some((state) => state === 'STALE');
  const isFetching =
    exploreQuery.isFetching ||
    bookingsQuery.isFetching ||
    (roomSourceRequired && roomBookingsQuery.isFetching) ||
    (roomPolicyRequired && roomPolicyQuery.isFetching) ||
    (calendarSourceRequired && calendarQuery.isFetching);
  const agendaComplete =
    workplaceHomeSourceComplete(bookingsState) &&
    workplaceHomeSourceComplete(roomBookingsState) &&
    workplaceHomeSourceComplete(calendarState);
  const attentionComplete =
    workplaceHomeSourceComplete(bookingsState) && workplaceHomeSourceComplete(calendarState);
  const nextActionComplete =
    model.nextAction.kind === 'CHECK_IN'
      ? bookingsState === 'READY'
      : model.nextAction.kind === 'OPEN_NEXT'
        ? agendaComplete
        : agendaComplete &&
          exploreState === 'READY' &&
          workplaceHomeSourceComplete(roomPolicyState);
  const initialLoading =
    !capabilities.isLoaded ||
    !permissions.isLoaded ||
    sourceStates.some((state) => state === 'LOADING');
  const availabilityState =
    exploreState === 'READY' ? 'READY' : exploreState === 'STALE' ? 'STALE' : 'UNAVAILABLE';
  const checkInState = !capabilities.canUpdateWorkplaceBooking
    ? 'READ_ONLY'
    : bookingsState === 'READY'
      ? 'AVAILABLE'
      : 'UNVERIFIED';
  const decisionActions = useMemo(() => {
    const actions = new Map<string, { id: string; kind: 'CHECK_IN' | 'RELEASE'; endsAt: string }>();
    if (model.nextAction.kind === 'CHECK_IN' && checkInState === 'AVAILABLE') {
      actions.set(`check-in:${model.nextAction.booking.bookingId}`, {
        id: `check-in:${model.nextAction.booking.bookingId}`,
        kind: 'CHECK_IN',
        endsAt: model.nextAction.booking.endsAt,
      });
    }
    model.attention.forEach((item) => {
      if (item.kind !== 'CHECK_IN' && item.kind !== 'RELEASE') return;
      actions.set(item.key, {
        id: item.key,
        kind: item.kind,
        endsAt: item.booking.endsAt,
      });
    });
    return [...actions.values()];
  }, [checkInState, model.attention, model.nextAction]);
  const submittedCheckInActionId =
    submittedCheckInAction?.identityKey === identityKey ? submittedCheckInAction.actionId : null;
  const {
    completeAction: completeDecisionAction,
    notice: decisionNotice,
    statusRef: decisionStatusRef,
  } = useWorkplaceDecisionStatus(decisionActions, homeDecisionInstant, {
    identityKey,
    sourceReady: bookingsState === 'READY',
    submittedActionIds: submittedCheckInActionId ? [submittedCheckInActionId] : [],
  });
  completeDecisionActionRef.current = completeDecisionAction;
  useEffect(() => {
    setSubmittedCheckInAction((current) => (current?.identityKey === identityKey ? current : null));
  }, [identityKey]);

  const { refetch: refetchExplore } = exploreQuery;
  const { refetch: refetchBookings } = bookingsQuery;
  const { refetch: refetchRoomBookings } = roomBookingsQuery;
  const { refetch: refetchRoomPolicy } = roomPolicyQuery;
  const { refetch: refetchCalendar } = calendarQuery;

  const refreshHome = useCallback(() => {
    void refetchExplore();
    void refetchBookings();
    if (roomSourceRequired) void refetchRoomBookings();
    if (roomPolicyRequired) void refetchRoomPolicy();
    if (calendarSourceRequired) void refetchCalendar();
  }, [
    calendarSourceRequired,
    refetchBookings,
    refetchCalendar,
    refetchExplore,
    refetchRoomBookings,
    refetchRoomPolicy,
    roomPolicyRequired,
    roomSourceRequired,
  ]);
  const decisionDeadline = workplaceHomeDecisionDeadline({
    now: homeDecisionNow,
    availabilityFrom: activeRange.availabilityFrom,
    bookings,
    roomBookings,
    calendar,
  });
  useEffect(() => {
    const delayToBoundary =
      decisionDeadline === null
        ? Number.POSITIVE_INFINITY
        : decisionDeadline -
          Math.max(homeDecisionInstant, Date.now()) +
          DECISION_BOUNDARY_SETTLE_MS;
    const delay = Math.max(
      DECISION_BOUNDARY_SETTLE_MS,
      Math.min(REFRESH_INTERVAL, delayToBoundary)
    );
    const reachesDecisionBoundary =
      decisionDeadline !== null && delayToBoundary <= REFRESH_INTERVAL;
    const timer = window.setTimeout(() => {
      advanceDecisionClock();
      if (reachesDecisionBoundary) refreshHome();
    }, delay);
    return () => window.clearTimeout(timer);
  }, [advanceDecisionClock, decisionDeadline, homeDecisionInstant, refreshHome]);
  const locale = resolveSupportedLocale(i18n.resolvedLanguage);
  const statusState = initialLoading
    ? 'syncing'
    : hasUnavailableData
      ? 'degraded'
      : hasStaleData
        ? 'stale'
        : 'live';
  const statusLabel = initialLoading
    ? t('workplace.home.loading')
    : hasUnavailableData
      ? t('workplace.home.status.partial')
      : hasStaleData
        ? t('workplace.home.status.stale')
        : t('workplace.home.live');
  const statusDetail =
    statusState === 'live' && model.verifiedAt
      ? t('workplace.home.status.verifiedAt', {
          time: formatDate(
            model.verifiedAt,
            { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone },
            locale
          ),
        })
      : undefined;
  const header = (
    <WorkplaceHomeScope
      catalog={catalog}
      floorId={requestedFloorId || catalog?.selectedFloor?.floorId || ''}
      startsAt={activeRange.availabilityFrom}
      timeZone={timeZone}
      discoveryPath={model.discoveryPath}
      busy={exploreQuery.isFetching}
      onFloorChange={(floorId) => {
        const next = new URLSearchParams(searchParams);
        next.set('floor', floorId);
        next.delete('from');
        setSearchParams(next, { replace: true });
      }}
      onStartChange={(value) => {
        const next = new URLSearchParams(searchParams);
        if (value) next.set('from', value);
        else next.delete('from');
        setSearchParams(next, { replace: true });
      }}
      status={
        <LiveStatus
          state={statusState}
          label={statusLabel}
          detail={statusDetail}
          refreshLabel={t('actions.retry')}
          refreshing={isFetching}
          onRefresh={refreshHome}
        />
      }
    />
  );

  if (initialLoading && !hasAnyData) {
    return (
      <PageCanvas>
        {header}
        <LoadingState label={t('workplace.home.loading')} variant="skeleton" size="page" />
      </PageCanvas>
    );
  }
  if (!hasAnyData) {
    return (
      <PageCanvas>
        {header}
        <LocalErrorState
          title={t('workplace.home.errorTitle')}
          description={t('workplace.home.errorDescription')}
          retryLabel={t('actions.retry')}
          onRetry={refreshHome}
          retrying={isFetching}
          size="page"
        />
      </PageCanvas>
    );
  }

  return (
    <PageCanvas>
      {header}
      {initialLoading && (
        <InlineFeedback severity="info" sx={{ mt: 2 }}>
          {t('workplace.home.loading')}
        </InlineFeedback>
      )}
      {(hasStaleData || hasUnavailableData) && (
        <InlineFeedback
          severity="warning"
          action={
            <ActionButton intent="quiet" onClick={refreshHome}>
              {t('actions.retry')}
            </ActionButton>
          }
          sx={{ mt: 2 }}
        >
          {t(hasUnavailableData ? 'workplace.partialWarning' : 'workplace.staleWarning')}
        </InlineFeedback>
      )}
      <Box
        ref={decisionStatusRef}
        tabIndex={-1}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-testid="workplace-decision-status"
        sx={{
          display: decisionNotice ? 'block' : 'none',
          mt: 2,
          px: 2,
          py: 1.5,
          border: 1,
          borderColor: 'divider',
          borderRadius: foundationTokens.radius.control + 'px',
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
              `workplace.home.decisionStatus.${decisionNotice.kind === 'CHECK_IN' ? 'checkIn' : 'release'}${decisionNotice.reason === 'ENDED' ? 'Ended' : decisionNotice.reason === 'RECOVERED' ? 'Recovered' : 'Unverified'}`
            )
          : null}
      </Box>
      <WorkplaceDayBrief
        model={model}
        timeZone={timeZone}
        nowInstant={homeDecisionInstant}
        availabilityState={availabilityState}
        checkInState={checkInState}
        decisionComplete={nextActionComplete}
        canManage={capabilities.canManageWorkplaceAdmin}
        canViewAccess={governance.isLoaded && governance.access.canView}
        checkInBusy={Boolean(submittedCheckInActionId)}
        decisionActionId={
          model.nextAction.kind === 'CHECK_IN' && checkInState === 'AVAILABLE'
            ? `check-in:${model.nextAction.booking.bookingId}`
            : null
        }
        onRefresh={refreshHome}
        onCheckIn={() => {
          if (model.nextAction.kind === 'CHECK_IN' && !checkInInFlightRef.current) {
            checkInInFlightRef.current = true;
            checkInMutation.mutate({ identityKey, booking: model.nextAction.booking });
          }
        }}
      />
      <Box sx={{ mt: foundationTokens.workplace.layout.sectionGap + 'px' }}>
        <WorkplaceReadySpaces
          model={model}
          state={availabilityState}
          refreshing={exploreQuery.isFetching}
          onRefresh={() => void exploreQuery.refetch()}
        />
      </Box>
      <Box
        sx={{
          mt: foundationTokens.workplace.layout.sectionGap + 'px',
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 7fr) minmax(0, 5fr)' },
          gridTemplateAreas: {
            xs: '"attention" "agenda" "week"',
            lg: '"agenda week" "agenda attention"',
          },
          gap: foundationTokens.workplace.layout.gutter + 'px',
          alignItems: 'start',
        }}
      >
        <Box sx={{ gridArea: 'attention', minWidth: 0 }}>
          <WorkplaceAttentionSection
            items={model.attention}
            complete={attentionComplete}
            timeZone={timeZone}
          />
        </Box>
        <Box sx={{ gridArea: 'agenda', minWidth: 0 }}>
          <WorkplaceTodayFlow agenda={model.agenda} complete={agendaComplete} timeZone={timeZone} />
        </Box>
        <Box sx={{ gridArea: 'week', minWidth: 0 }}>
          <WorkplaceWeekRhythm week={model.week} complete={agendaComplete} />
        </Box>
      </Box>
      <WorkplaceHomeSourceSummary
        workspaceState={exploreState === 'READY' ? bookingsState : exploreState}
        calendarState={calendarState}
        workspaceUpdatedAt={explore?.generatedAt}
        calendarUpdatedAt={calendar?.generatedAt}
      />
    </PageCanvas>
  );
}
