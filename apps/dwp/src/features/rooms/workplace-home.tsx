import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActionButton,
  LiveStatus,
  LocalErrorState,
  LoadingState,
  PageCanvas,
  ResourcePageHeader,
} from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
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

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';

import { useRoomsCapabilities } from './rooms-capabilities';
import {
  latestWorkplaceDecisionInstant,
  workplaceHomeDecisionDeadline,
} from './workplace-home-decision-clock';
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
  WorkplaceWeekRhythm,
} from './workplace-home-sections';

import type { WorkplaceBooking, WorkplaceExploreResponse } from '@dwp-frontend/shared-utils';

const REFRESH_INTERVAL = 60_000;
const DECISION_BOUNDARY_SETTLE_MS = 10;

type WorkplaceHomeExploreSnapshot = {
  explore: WorkplaceExploreResponse;
  range: ReturnType<typeof workplaceHomeQueryRange>;
};

export function WorkplaceHome() {
  const { t, i18n } = useTranslation('rooms');
  const auth = useAuth();
  const capabilities = useRoomsCapabilities();
  const permissions = usePermissions();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [clock, setClock] = useState(Date.now);
  const identityKey = `${auth.user?.tenantId ?? 'anonymous'}:${auth.user?.userId ?? 'anonymous'}`;
  const browserTimeZone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Seoul',
    []
  );
  const exploreQuery = useQuery({
    queryKey: ['workplace', 'home', identityKey, 'explore'],
    queryFn: async (): Promise<WorkplaceHomeExploreSnapshot> => {
      const range = workplaceHomeQueryRange(new Date(), browserTimeZone);
      const explore = await getWorkplaceExplore(range.availabilityFrom, range.availabilityTo);
      return { explore, range };
    },
    staleTime: 30_000,
    refetchInterval: REFRESH_INTERVAL,
    retry: 1,
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
    retry: 1,
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
    retry: 1,
  });

  const roomSourceRequired = capabilities.isLoaded && capabilities.canViewRooms;
  const exploreState = workplaceHomeSourceState({
    data: exploreQuery.data,
    error: exploreQuery.error,
    isError: exploreQuery.isError,
    isPending: exploreQuery.isPending,
    required: true,
  });
  const bookingsState = workplaceHomeSourceState({
    data: bookingsQuery.data,
    error: bookingsQuery.error,
    isError: bookingsQuery.isError,
    isPending: bookingsQuery.isPending,
    required: true,
  });
  const roomBookingsState = workplaceHomeSourceState({
    data: roomBookingsQuery.data,
    error: roomBookingsQuery.error,
    isError: roomBookingsQuery.isError,
    isPending: roomBookingsQuery.isPending,
    required: roomSourceRequired,
  });
  const exploreSnapshot = workplaceHomeSourceData(exploreState, exploreQuery.data);
  const explore = exploreSnapshot?.explore;
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
    retry: 1,
  });
  const roomPolicyState = workplaceHomeSourceState({
    data: roomPolicyQuery.data,
    error: roomPolicyQuery.error,
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
    retry: 1,
  });
  const calendarState = workplaceHomeSourceState({
    data: calendarQuery.data,
    error: calendarQuery.error,
    isError: calendarQuery.isError,
    isPending: calendarQuery.isPending,
    required: canViewCalendar,
  });
  const calendar = workplaceHomeSourceData(calendarState, calendarQuery.data);
  const activeRange = exploreSnapshot?.range ?? workplaceHomeQueryRange(new Date(clock), timeZone);
  const workplaceDecisionInstant = latestWorkplaceDecisionInstant(clock, explore?.generatedAt);
  const homeDecisionInstant = latestWorkplaceDecisionInstant(
    workplaceDecisionInstant,
    calendar?.generatedAt
  );
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
      serverNow: new Date(workplaceDecisionInstant).toISOString(),
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
      workplaceDecisionInstant,
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
      }),
    [bookability, bookings, calendar, explore, homeDecisionNow, roomBookings, timeZone]
  );

  const checkInMutation = useMutation({
    mutationFn: (booking: WorkplaceBooking) => {
      if (!capabilities.canUpdateWorkplaceBooking) throw new Error('workplace-update-denied');
      return checkInWorkplaceBooking(booking.bookingId, booking.version);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['workplace'] });
      toast.success(t('workplace.my.check-inSaved'));
    },
    onError: () => toast.error(t('workplace.my.actionError')),
  });

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
        : decisionDeadline - Date.now() + DECISION_BOUNDARY_SETTLE_MS;
    const delay = Math.max(
      DECISION_BOUNDARY_SETTLE_MS,
      Math.min(REFRESH_INTERVAL, delayToBoundary)
    );
    const reachesDecisionBoundary =
      decisionDeadline !== null && delayToBoundary <= REFRESH_INTERVAL;
    const timer = window.setTimeout(() => {
      setClock(Date.now());
      if (reachesDecisionBoundary) refreshHome();
    }, delay);
    return () => window.clearTimeout(timer);
  }, [decisionDeadline, refreshHome]);
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
          time: formatDate(model.verifiedAt, { hour: '2-digit', minute: '2-digit' }, locale),
        })
      : undefined;
  const header = (
    <ResourcePageHeader
      eyebrow={t('workplace.home.eyebrow')}
      title={t('workplace.home.title')}
      description={t('workplace.home.description')}
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

  if (initialLoading) {
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
      {(hasStaleData || hasUnavailableData) && (
        <Alert
          severity="warning"
          action={
            <ActionButton intent="quiet" onClick={refreshHome}>
              {t('actions.retry')}
            </ActionButton>
          }
          sx={{ mt: 2 }}
        >
          {t(hasUnavailableData ? 'workplace.partialWarning' : 'workplace.staleWarning')}
        </Alert>
      )}
      <WorkplaceDayBrief
        model={model}
        availabilityState={availabilityState}
        checkInState={checkInState}
        decisionComplete={nextActionComplete}
        canManage={capabilities.canManageWorkplaceAdmin}
        checkInBusy={checkInMutation.isPending}
        onRefresh={refreshHome}
        onCheckIn={() => {
          if (model.nextAction.kind === 'CHECK_IN') {
            checkInMutation.mutate(model.nextAction.booking);
          }
        }}
      />
      <Box
        sx={{
          mt: 3,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1.55fr) minmax(320px, 0.75fr)' },
          gap: 3,
          alignItems: 'stretch',
        }}
      >
        <WorkplaceTodayFlow agenda={model.agenda} complete={agendaComplete} />
        <WorkplaceReadySpaces
          model={model}
          state={availabilityState}
          canManage={capabilities.canManageWorkplaceAdmin}
          refreshing={exploreQuery.isFetching}
          onRefresh={() => void exploreQuery.refetch()}
        />
      </Box>
      <Box
        sx={{
          mt: 3,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1.45fr) minmax(320px, 0.85fr)' },
          gap: 3,
          alignItems: 'stretch',
        }}
      >
        <WorkplaceWeekRhythm week={model.week} complete={agendaComplete} />
        <WorkplaceAttentionSection items={model.attention} complete={attentionComplete} />
      </Box>
    </PageCanvas>
  );
}
