import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import {
  CalendarCheck2,
  CheckCircle2,
  Clock3,
  LogIn,
  MapPin,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  cancelRoomBooking,
  cancelWorkplaceBooking,
  checkInWorkplaceBooking,
  getRoomBookings,
  getRoomsPolicy,
  getWorkplaceBookings,
  releaseWorkplaceBooking,
  respondToRoomBooking,
  useAuth,
  useToast,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  ConfirmDialog,
  EmptyState,
  FilterBar,
  LoadingState,
  PageCanvas,
  SelectField,
} from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { roomBookingActionPolicy } from './room-booking-action-policy';
import { RoomBookingDialog } from './room-booking-dialog';
import { useRoomsCapabilities } from './rooms-capabilities';
import { RoomsPageHeading } from './rooms-ui';
import { retryRecoverableWorkplaceRead } from './workplace-authority-failure';
import { workplaceBookingActionPolicy } from './workplace-booking-action-policy';
import { useWorkplaceDecisionClock } from './workplace-decision-clock';
import { workplaceHomeSourceData } from './workplace-home-source-state';
import { workplaceMemberCard, workplaceMemberSoftSurface } from './workplace-member-surfaces';
import { WorkplaceMobileReservationInspector } from './workplace-mobile-reservation-inspector';
import { WorkplaceReservationDetailTabContent } from './workplace-reservation-detail-tab-content';
import { resolveReservationSourceState } from './workplace-reservation-source-status';
import { WorkplaceReservationSourceSummary } from './workplace-reservation-source-summary';
import {
  WORKPLACE_RESERVATION_AUTHORITIES,
  WORKPLACE_RESERVATION_PERIODS,
  WORKPLACE_RESERVATION_STATUSES,
  WORKPLACE_RESERVATION_TYPES,
  parseWorkplaceReservationsUrl,
  updateWorkplaceReservationsUrl,
  workplaceReservationsRange,
  type WorkplaceReservationsUrlPatch,
} from './workplace-reservations-url-state';
import { WorkplaceRelocateBookingDialog } from './workplace-relocate-booking-dialog';
import {
  filterWorkplaceUnifiedReservations,
  projectWorkplaceUnifiedReservations,
  selectWorkplaceUnifiedReservation,
  workplaceUnifiedReservationTargetId,
  type WorkplaceUnifiedReservation,
} from './workplace-unified-reservations-model';
import {
  DEFAULT_WORKPLACE_RESERVATION_FILTERS,
  formatWorkplaceReservationRange,
  readWorkplaceReservationDetailTab,
  WORKPLACE_RESERVATION_DETAIL_TABS,
  writeWorkplaceReservationDetailTab,
  type CalendarMutationInput,
  type WorkplaceMutationInput,
  type WorkplaceReservationConfirmation,
  type WorkplaceReservationDetailTab,
} from './workplace-unified-reservations-runtime';

import type { CalendarEvent, WorkplaceBooking } from '@dwp-frontend/shared-utils';

export function WorkplaceUnifiedReservations() {
  const { t, i18n } = useTranslation('rooms');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage);
  const auth = useAuth();
  const capabilities = useRoomsCapabilities();
  const toast = useToast();
  const queryClient = useQueryClient();
  const mobileInspector = useMediaQuery('(max-width:899.95px)');
  const identityKey = `${auth.user?.tenantId ?? 'anonymous'}:${auth.user?.userId ?? 'anonymous'}`;
  const activeIdentityRef = useRef(identityKey);
  const inspectorOpenerRef = useRef<HTMLElement | null>(null);
  const timelineHeadingRef = useRef<HTMLHeadingElement | null>(null);
  activeIdentityRef.current = identityKey;
  const [searchParams, setSearchParams] = useSearchParams();
  const parsedUrl = useMemo(() => parseWorkplaceReservationsUrl(searchParams), [searchParams]);
  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;
  const [urlWasNormalized, setUrlWasNormalized] = useState(false);
  const [confirmation, setConfirmation] = useState<WorkplaceReservationConfirmation | null>(null);
  const [relocating, setRelocating] = useState<WorkplaceBooking | null>(null);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const initialDetailTab = readWorkplaceReservationDetailTab(searchParams);
  const [detailTab, setDetailTab] = useState(initialDetailTab);
  const { nowInstant, readNow } = useWorkplaceDecisionClock(identityKey);

  useEffect(() => setDetailTab(initialDetailTab), [initialDetailTab]);

  useEffect(() => {
    if (!parsedUrl.corrected) return;
    setUrlWasNormalized(true);
    searchParamsRef.current = parsedUrl.canonicalSearchParams;
    setSearchParams(parsedUrl.canonicalSearchParams, { replace: true });
  }, [parsedUrl, setSearchParams]);

  const updateParams = (patch: WorkplaceReservationsUrlPatch) => {
    const next = updateWorkplaceReservationsUrl(searchParamsRef.current, patch);
    searchParamsRef.current = next;
    setSearchParams(next, { replace: true });
  };
  const updateDetailTab = (value: WorkplaceReservationDetailTab) => {
    setDetailTab(value);
    const next = writeWorkplaceReservationDetailTab(searchParamsRef.current, value);
    searchParamsRef.current = next;
    setSearchParams(next, { replace: true });
  };
  const range = useMemo(
    () => workplaceReservationsRange(parsedUrl.state.period),
    [parsedUrl.state.period]
  );

  const workplaceQuery = useQuery({
    queryKey: ['workplace', 'reservations', identityKey, range.from, range.to],
    queryFn: () => getWorkplaceBookings(range.from, range.to),
    enabled: capabilities.isLoaded && capabilities.canViewWorkplace,
    staleTime: 20_000,
    refetchInterval: 60_000,
    retry: retryRecoverableWorkplaceRead,
  });
  const calendarQuery = useQuery({
    queryKey: ['rooms', 'reservations', identityKey, range.from, range.to],
    queryFn: () => getRoomBookings(range.from, range.to),
    enabled: capabilities.isLoaded && capabilities.canViewRooms,
    staleTime: 20_000,
    refetchInterval: 60_000,
    retry: retryRecoverableWorkplaceRead,
  });
  const roomPolicyQuery = useQuery({
    queryKey: ['rooms', 'policy', identityKey],
    queryFn: getRoomsPolicy,
    enabled: capabilities.isLoaded && capabilities.canViewRooms,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: retryRecoverableWorkplaceRead,
  });

  const workplaceState = resolveReservationSourceState({
    loaded: capabilities.isLoaded,
    permitted: capabilities.canViewWorkplace,
    snapshot: workplaceQuery,
  });
  const calendarState = resolveReservationSourceState({
    loaded: capabilities.isLoaded,
    permitted: capabilities.canViewRooms,
    snapshot: calendarQuery,
  });
  const policyState = resolveReservationSourceState({
    loaded: capabilities.isLoaded,
    permitted: capabilities.canViewRooms,
    snapshot: roomPolicyQuery,
  });
  const workplaceStateRef = useRef(workplaceState);
  const calendarStateRef = useRef(calendarState);
  workplaceStateRef.current = workplaceState;
  calendarStateRef.current = calendarState;

  const workplaceBookings = useMemo(
    () => workplaceHomeSourceData(workplaceState, workplaceQuery.data) ?? [],
    [workplaceQuery.data, workplaceState]
  );
  const calendarEvents = useMemo(
    () => workplaceHomeSourceData(calendarState, calendarQuery.data) ?? [],
    [calendarQuery.data, calendarState]
  );
  const projection = useMemo(
    () =>
      projectWorkplaceUnifiedReservations({
        workplace: workplaceBookings,
        calendar: calendarEvents,
        workplaceState,
        calendarState,
      }),
    [calendarEvents, calendarState, workplaceBookings, workplaceState]
  );
  const filteredItems = useMemo(
    () =>
      filterWorkplaceUnifiedReservations(projection.items, {
        type: parsedUrl.state.type,
        status: parsedUrl.state.status,
        authority: parsedUrl.state.authority,
        query: parsedUrl.state.query,
      }),
    [parsedUrl.state, projection.items]
  );
  const selectedItem = selectWorkplaceUnifiedReservation(
    filteredItems,
    parsedUrl.state,
    !mobileInspector
  );
  const selectedWorkplaceBooking =
    selectedItem?.authority === 'WORKPLACE'
      ? (workplaceBookings.find((booking) => booking.bookingId === selectedItem.authorityId) ??
        null)
      : null;
  const selectedCalendarEvent =
    selectedItem?.authority === 'CALENDAR'
      ? (calendarEvents.find((event) => event.eventId === selectedItem.authorityId) ?? null)
      : null;

  useEffect(() => {
    setDetailTab('overview');
    setConfirmation(null);
    setRelocating(null);
    setEditingEvent(null);
  }, [identityKey, selectedItem?.key]);

  const workplacePolicies = useMemo(
    () =>
      new Map(
        workplaceBookings.map((booking) => [
          booking.bookingId,
          workplaceBookingActionPolicy({
            booking,
            sourceState: workplaceState,
            canUpdateWorkplaceBooking: capabilities.canUpdateWorkplaceBooking,
            nowInstant,
          }),
        ])
      ),
    [capabilities.canUpdateWorkplaceBooking, nowInstant, workplaceBookings, workplaceState]
  );
  const selectedWorkplacePolicy = selectedWorkplaceBooking
    ? workplacePolicies.get(selectedWorkplaceBooking.bookingId)
    : null;
  const selectedCalendarPolicy = selectedCalendarEvent
    ? roomBookingActionPolicy(selectedCalendarEvent, capabilities.canUpdateRoomBooking)
    : null;
  const canCancelSelected =
    selectedItem?.authority === 'WORKPLACE'
      ? selectedWorkplacePolicy?.canCancel === true
      : selectedCalendarPolicy?.canCancel === true && calendarState === 'READY';
  const urgentBooking = workplaceBookings.find(
    (booking) => workplacePolicies.get(booking.bookingId)?.canCheckIn
  );

  const invalidateWorkplace = () => queryClient.invalidateQueries({ queryKey: ['workplace'] });
  const invalidateCalendar = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['rooms'] }),
      queryClient.invalidateQueries({ queryKey: ['calendar'] }),
    ]);

  const workplaceMutation = useMutation({
    mutationFn: ({ booking, action, commandIdentity }: WorkplaceMutationInput) => {
      const current = workplaceQuery.data?.find(
        (candidate) =>
          candidate.bookingId === booking.bookingId && candidate.version === booking.version
      );
      if (
        commandIdentity !== activeIdentityRef.current ||
        workplaceStateRef.current !== 'READY' ||
        !current
      ) {
        throw new Error(t('permissions.workplaceUpdateReadOnly'));
      }
      const policy = workplaceBookingActionPolicy({
        booking: current,
        sourceState: workplaceStateRef.current,
        canUpdateWorkplaceBooking: capabilities.canUpdateWorkplaceBooking,
        nowInstant: readNow(),
      });
      if (action === 'check-in' && policy.canCheckIn) {
        return checkInWorkplaceBooking(current.bookingId, current.version);
      }
      if (action === 'release' && policy.canRelease) {
        return releaseWorkplaceBooking(current.bookingId, current.version);
      }
      if (action === 'cancel' && policy.canCancel) {
        return cancelWorkplaceBooking(current.bookingId, current.version);
      }
      throw new Error(t('permissions.workplaceUpdateReadOnly'));
    },
    onSuccess: async (_, variables) => {
      if (variables.commandIdentity !== activeIdentityRef.current) return;
      setConfirmation(null);
      await invalidateWorkplace();
      toast.success(t(`workplace.reservations.feedback.${variables.action}`));
    },
    onError: (_, variables) => {
      if (variables.commandIdentity === activeIdentityRef.current) {
        toast.error(t('workplace.reservations.feedback.commandError'));
      }
    },
  });

  const calendarMutation = useMutation({
    mutationFn: async ({ event, action, commandIdentity }: CalendarMutationInput) => {
      const current = calendarQuery.data?.find(
        (candidate) => candidate.eventId === event.eventId && candidate.version === event.version
      );
      if (
        commandIdentity !== activeIdentityRef.current ||
        calendarStateRef.current !== 'READY' ||
        !current
      ) {
        throw new Error(t('permissions.roomUpdateReadOnly'));
      }
      const policy = roomBookingActionPolicy(current, capabilities.canUpdateRoomBooking);
      if (action === 'cancel' && policy.canCancel) {
        await cancelRoomBooking(current.eventId, current.version);
        return;
      }
      if (action === 'accept' && policy.canRespond) {
        await respondToRoomBooking(current.eventId, 'ACCEPTED');
        return;
      }
      if (action === 'decline' && policy.canRespond) {
        await respondToRoomBooking(current.eventId, 'DECLINED');
        return;
      }
      throw new Error(t('permissions.roomUpdateReadOnly'));
    },
    onSuccess: async (_, variables) => {
      if (variables.commandIdentity !== activeIdentityRef.current) return;
      setConfirmation(null);
      await invalidateCalendar();
      toast.success(t(`workplace.reservations.feedback.${variables.action}`));
    },
    onError: (_, variables) => {
      if (variables.commandIdentity === activeIdentityRef.current) {
        toast.error(t('workplace.reservations.feedback.commandError'));
      }
    },
  });

  const commandGateRef = useRef<string | null>(null);
  const dispatchWorkplaceCommand = (command: WorkplaceMutationInput) => {
    const key = `WORKPLACE:${command.commandIdentity}:${command.booking.bookingId}:${command.booking.version}:${command.action}`;
    if (commandGateRef.current) return;
    commandGateRef.current = key;
    workplaceMutation.mutate(command, {
      onSettled: () => {
        if (commandGateRef.current === key) commandGateRef.current = null;
      },
    });
  };
  const dispatchCalendarCommand = (command: CalendarMutationInput) => {
    const key = `CALENDAR:${command.commandIdentity}:${command.event.eventId}:${command.event.version}:${command.action}`;
    if (commandGateRef.current) return;
    commandGateRef.current = key;
    calendarMutation.mutate(command, {
      onSettled: () => {
        if (commandGateRef.current === key) commandGateRef.current = null;
      },
    });
  };

  const openItem = (item: WorkplaceUnifiedReservation) => {
    inspectorOpenerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    updateParams({
      reservation: item.authorityId,
      reservationAuthority: item.authority,
    });
  };
  const formatRange = (item: WorkplaceUnifiedReservation) =>
    formatWorkplaceReservationRange(item, locale);
  const resetFilters = () => updateParams(DEFAULT_WORKPLACE_RESERVATION_FILTERS);
  const anySourceVisible = projection.items.length > 0;
  const allTerminal = ![workplaceState, calendarState].includes('LOADING');

  return (
    <PageCanvas topInset="compact" data-testid="workplace-unified-reservations">
      <RoomsPageHeading
        eyebrow={t('workplace.reservations.eyebrow')}
        title={t('workplace.reservations.title')}
        description={t('workplace.reservations.description')}
      />

      {urlWasNormalized && (
        <Box role="status" sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {t('workplace.reservations.urlNormalized')}
          </Typography>
        </Box>
      )}

      {urgentBooking && (
        <Box
          data-testid="workplace-reservations-next-action"
          sx={(theme) => ({
            ...workplaceMemberCard(theme),
            p: { xs: 2, md: 2.5 },
            mb: 2,
            borderColor: 'error.light',
          })}
        >
          <Stack direction={{ xs: 'column', md: 'row' }} gap={2} justifyContent="space-between">
            <Box minWidth={0}>
              <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
                <Chip size="small" color="error" label={t('workplace.reservations.checkInDue')} />
                <Typography component="h2" variant="h6">
                  {urgentBooking.resourceName}
                </Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                {formatDate(
                  urgentBooking.checkInClosesAt,
                  { dateStyle: 'medium', timeStyle: 'short' },
                  locale
                )}{' '}
                · {urgentBooking.siteName} · {urgentBooking.floorName}
              </Typography>
            </Box>
            <ActionButton
              intent="primary"
              startIcon={<CheckCircle2 size={17} />}
              loading={workplaceMutation.isPending}
              onClick={() =>
                dispatchWorkplaceCommand({
                  booking: urgentBooking,
                  action: 'check-in',
                  commandIdentity: identityKey,
                })
              }
            >
              {t('workplace.reservations.actions.checkIn')}
            </ActionButton>
          </Stack>
        </Box>
      )}

      <WorkplaceReservationSourceSummary
        workplace={{
          state: workplaceState,
          updatedAt: workplaceQuery.dataUpdatedAt,
          retry: () => void workplaceQuery.refetch(),
        }}
        calendar={{
          state: calendarState,
          updatedAt: calendarQuery.dataUpdatedAt,
          retry: () => void calendarQuery.refetch(),
        }}
        locale={locale}
        notYetVerified={t('workplace.reservations.notYetVerified')}
      />

      <Box
        data-testid="workplace-reservations-filters"
        sx={(theme) => ({ ...workplaceMemberCard(theme), p: 2, mb: 2 })}
      >
        <FilterBar
          ariaLabel={t('workplace.reservations.filters.label')}
          searchLabel={t('workplace.reservations.filters.search')}
          searchValue={parsedUrl.state.query}
          onSearchChange={(value) => updateParams({ q: value, reservation: null })}
          searchPlaceholder={t('workplace.reservations.filters.searchPlaceholder')}
          resetLabel={t('actions.resetFilters')}
          onReset={resetFilters}
          resultLabel={t('workplace.reservations.resultCount', { count: filteredItems.length })}
          filters={
            <>
              <SelectField
                size="small"
                fullWidth={false}
                label={t('workplace.reservations.filters.period')}
                value={parsedUrl.state.period}
                options={WORKPLACE_RESERVATION_PERIODS.map((value) => ({
                  value,
                  label: t(`workplace.reservations.periods.${value}`),
                }))}
                onValueChange={(value) =>
                  value &&
                  updateParams({ period: value, reservation: null, reservationAuthority: null })
                }
                sx={{ width: { xs: 1, sm: 140 } }}
              />
              <SelectField
                size="small"
                fullWidth={false}
                label={t('workplace.reservations.filters.type')}
                value={parsedUrl.state.type}
                options={WORKPLACE_RESERVATION_TYPES.map((value) => ({
                  value,
                  label: t(`workplace.reservations.types.${value}`),
                }))}
                onValueChange={(value) =>
                  value &&
                  updateParams({ types: value, reservation: null, reservationAuthority: null })
                }
                sx={{ width: { xs: 1, sm: 150 } }}
              />
              <SelectField
                size="small"
                fullWidth={false}
                label={t('workplace.reservations.filters.status')}
                value={parsedUrl.state.status}
                options={WORKPLACE_RESERVATION_STATUSES.map((value) => ({
                  value,
                  label: t(`workplace.reservations.statuses.${value}`),
                }))}
                onValueChange={(value) =>
                  value &&
                  updateParams({ status: value, reservation: null, reservationAuthority: null })
                }
                sx={{ width: { xs: 1, sm: 150 } }}
              />
              <SelectField
                size="small"
                fullWidth={false}
                label={t('workplace.reservations.filters.authority')}
                value={parsedUrl.state.authority}
                options={WORKPLACE_RESERVATION_AUTHORITIES.map((value) => ({
                  value,
                  label: t(`workplace.reservations.authorities.${value}`),
                }))}
                onValueChange={(value) =>
                  value &&
                  updateParams({ authority: value, reservation: null, reservationAuthority: null })
                }
                sx={{ width: { xs: 1, sm: 160 } }}
              />
            </>
          }
        />
      </Box>

      {projection.partial && anySourceVisible && (
        <Box role="status" sx={{ mb: 2 }}>
          <Typography variant="body2" color="warning.main">
            {t('workplace.reservations.partial')}
          </Typography>
        </Box>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'minmax(0, 1fr)',
            lg: 'minmax(0, 1.55fr) minmax(300px, .75fr)',
          },
          gap: 2.5,
          alignItems: 'start',
        }}
      >
        <Box
          data-testid="workplace-reservations-timeline"
          sx={(theme) => ({
            ...workplaceMemberCard(theme),
            minWidth: 0,
            display: { xs: selectedItem ? 'none' : 'block', md: 'block' },
          })}
        >
          <Stack direction="row" alignItems="center" justifyContent="space-between" p={2} gap={1}>
            <Typography component="h2" variant="h6" ref={timelineHeadingRef} tabIndex={-1}>
              {t('workplace.reservations.timeline')}
            </Typography>
            <Chip
              size="small"
              label={t('workplace.reservations.activeCount', { count: filteredItems.length })}
            />
          </Stack>
          <Divider />
          {!allTerminal && filteredItems.length === 0 ? (
            <LoadingState
              label={t('workplace.reservations.loading')}
              variant="skeleton"
              skeletonRows={4}
              skeletonHeight={126}
              embedded
            />
          ) : filteredItems.length === 0 ? (
            <EmptyState
              icon={<CalendarCheck2 size={28} />}
              title={t('workplace.reservations.emptyTitle')}
              description={t('workplace.reservations.emptyDescription')}
              action={
                <ActionButton component={Link} to="/workplace/find?v=1&types=ALL" intent="primary">
                  {t('workplace.reservations.findSpace')}
                </ActionButton>
              }
            />
          ) : (
            <Stack spacing={1.5} p={{ xs: 1.5, md: 2 }}>
              {filteredItems.map((item) => {
                const selected = item.key === selectedItem?.key;
                return (
                  <Box
                    component="article"
                    key={item.key}
                    id={workplaceUnifiedReservationTargetId(item)}
                    data-testid={workplaceUnifiedReservationTargetId(item)}
                    aria-current={selected ? 'true' : undefined}
                    sx={(theme) => ({
                      ...workplaceMemberSoftSurface(theme),
                      p: { xs: 1.5, md: 2 },
                      border: 1,
                      borderColor: selected ? 'primary.main' : 'transparent',
                      borderInlineStart: selected ? '3px solid' : undefined,
                      borderInlineStartColor: selected ? 'primary.main' : undefined,
                    })}
                  >
                    <Stack direction="row" justifyContent="space-between" gap={1.5}>
                      <Box minWidth={0}>
                        <Stack direction="row" gap={0.75} flexWrap="wrap" alignItems="center">
                          <Chip
                            size="small"
                            color={item.sourceState === 'STALE' ? 'warning' : 'default'}
                            label={t(
                              `workplace.reservations.types.${item.authority === 'CALENDAR' ? 'MEETING' : item.resourceType}`
                            )}
                          />
                          <Chip
                            size="small"
                            variant="outlined"
                            label={t(`workplace.reservations.statuses.${item.state}`)}
                          />
                          {item.sourceState === 'STALE' && (
                            <Chip
                              size="small"
                              color="warning"
                              label={t('workplace.reservations.staleItem')}
                            />
                          )}
                        </Stack>
                        <Typography
                          component="h3"
                          variant="subtitle1"
                          fontWeight="fontWeightBold"
                          sx={{ mt: 1 }}
                        >
                          {item.title}
                        </Typography>
                        <Stack
                          direction={{ xs: 'column', sm: 'row' }}
                          gap={{ xs: 0.5, sm: 2 }}
                          mt={1}
                        >
                          <Stack direction="row" gap={0.6} alignItems="center">
                            <Clock3 size={15} aria-hidden="true" />
                            <Typography variant="body2">{formatRange(item)}</Typography>
                          </Stack>
                          <Stack direction="row" gap={0.6} alignItems="center">
                            <MapPin size={15} aria-hidden="true" />
                            <Typography variant="body2">{item.location}</Typography>
                          </Stack>
                        </Stack>
                      </Box>
                      <Chip
                        size="small"
                        variant="outlined"
                        label={t(`workplace.reservations.authorities.${item.authority}`)}
                      />
                    </Stack>
                    <Stack direction="row" gap={1} flexWrap="wrap" mt={1.5}>
                      <ActionButton
                        intent={selected ? 'primary' : 'secondary'}
                        size="small"
                        onClick={() => openItem(item)}
                      >
                        {t('workplace.reservations.actions.detail')}
                      </ActionButton>
                      <ActionButton
                        component={Link}
                        to={`/workplace/find?v=1&types=${item.resourceType}&resource=${encodeURIComponent(item.resourceId)}`}
                        intent="quiet"
                        size="small"
                      >
                        {t('workplace.reservations.actions.map')}
                      </ActionButton>
                    </Stack>
                  </Box>
                );
              })}
            </Stack>
          )}
        </Box>

        {selectedItem && (
          <WorkplaceMobileReservationInspector
            label={t('workplace.reservations.detail.title')}
            closeLabel={t('actions.close')}
            fallbackFocusRef={timelineHeadingRef}
            openerRef={inspectorOpenerRef}
            onClose={() => updateParams({ reservation: null, reservationAuthority: null })}
          >
            <Box p={{ xs: 1.5, md: 2.5 }}>
              <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1}>
                <Box minWidth={0}>
                  <Typography variant="overline" color="primary.main">
                    {t('workplace.reservations.detail.title')}
                  </Typography>
                  <Typography component="h2" variant="h6">
                    {selectedItem.title}
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  color={selectedItem.sourceState === 'STALE' ? 'warning' : 'success'}
                  label={t(`workplace.reservations.sourceStates.${selectedItem.sourceState}`)}
                  sx={{ display: { xs: 'none', md: 'inline-flex' } }}
                />
              </Stack>
              <Stack
                spacing={1.25}
                sx={(theme) => ({ ...workplaceMemberSoftSurface(theme), p: 1.5, mt: 2 })}
              >
                <Stack direction="row" gap={1} alignItems="flex-start">
                  <Clock3 size={16} aria-hidden="true" />
                  <Typography variant="body2">{formatRange(selectedItem)}</Typography>
                </Stack>
                <Stack direction="row" gap={1} alignItems="flex-start">
                  <MapPin size={16} aria-hidden="true" />
                  <Typography variant="body2">{selectedItem.location}</Typography>
                </Stack>
                {selectedItem.attendeeCount !== null && (
                  <Stack direction="row" gap={1} alignItems="flex-start">
                    <UsersRound size={16} aria-hidden="true" />
                    <Typography variant="body2">
                      {t('workplace.reservations.detail.attendees', {
                        count: selectedItem.attendeeCount,
                      })}
                    </Typography>
                  </Stack>
                )}
                <Stack direction="row" gap={1} alignItems="flex-start">
                  <ShieldCheck size={16} aria-hidden="true" />
                  <Typography variant="body2">
                    {t('workplace.reservations.detail.authority', {
                      value: t(`workplace.reservations.authorities.${selectedItem.authority}`),
                    })}
                  </Typography>
                </Stack>
              </Stack>
            </Box>
            <Tabs
              value={detailTab}
              onChange={(_, value: WorkplaceReservationDetailTab) => updateDetailTab(value)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{ borderTop: 1, borderBottom: 1, borderColor: 'divider', px: 1 }}
            >
              {WORKPLACE_RESERVATION_DETAIL_TABS.map((value) => (
                <Tab
                  key={value}
                  value={value}
                  label={t(`workplace.reservations.detail.tabs.${value}`)}
                />
              ))}
            </Tabs>
            <Box p={{ xs: 1.5, md: 2.5 }}>
              <WorkplaceReservationDetailTabContent
                detailTab={detailTab}
                reservation={selectedItem}
                conferenceUrl={
                  selectedCalendarEvent &&
                  !selectedCalendarEvent.redacted &&
                  selectedCalendarEvent.detailLevel !== 'FREE_BUSY'
                    ? (selectedCalendarEvent.conferenceUrl ?? null)
                    : null
                }
                onOpenServices={() => updateDetailTab('services')}
                calendarPolicyUnavailable={Boolean(
                  selectedCalendarEvent && calendarState === 'READY' && policyState !== 'READY'
                )}
              />
              {detailTab !== 'services' && (
                <Stack direction="row" gap={1} flexWrap="wrap" mt={2}>
                  {selectedWorkplaceBooking && selectedWorkplacePolicy?.canCheckIn && (
                    <ActionButton
                      intent="primary"
                      startIcon={<CheckCircle2 size={16} />}
                      loading={workplaceMutation.isPending}
                      onClick={() =>
                        dispatchWorkplaceCommand({
                          booking: selectedWorkplaceBooking,
                          action: 'check-in',
                          commandIdentity: identityKey,
                        })
                      }
                    >
                      {t('workplace.reservations.actions.checkIn')}
                    </ActionButton>
                  )}
                  {selectedWorkplaceBooking && selectedWorkplacePolicy?.canRelease && (
                    <ActionButton
                      intent="secondary"
                      onClick={() =>
                        setConfirmation({
                          authority: 'WORKPLACE',
                          authorityId: selectedWorkplaceBooking.bookingId,
                          version: selectedWorkplaceBooking.version,
                          action: 'release',
                        })
                      }
                    >
                      {t('workplace.reservations.actions.release')}
                    </ActionButton>
                  )}
                  {selectedWorkplaceBooking &&
                    workplaceState === 'READY' &&
                    capabilities.canUpdateWorkplaceBooking &&
                    selectedWorkplaceBooking.status === 'RESERVED' && (
                      <ActionButton
                        intent="secondary"
                        onClick={() => setRelocating(selectedWorkplaceBooking)}
                      >
                        {t('workplace.reservations.actions.relocate')}
                      </ActionButton>
                    )}
                  {selectedCalendarEvent &&
                    selectedCalendarPolicy?.canEdit &&
                    calendarState === 'READY' &&
                    policyState === 'READY' && (
                      <ActionButton
                        intent="secondary"
                        onClick={() => setEditingEvent(selectedCalendarEvent)}
                      >
                        {t('actions.edit')}
                      </ActionButton>
                    )}
                  {selectedCalendarEvent &&
                    selectedCalendarPolicy?.canRespond &&
                    calendarState === 'READY' && (
                      <>
                        <ActionButton
                          intent="secondary"
                          onClick={() =>
                            dispatchCalendarCommand({
                              event: selectedCalendarEvent,
                              action: 'decline',
                              commandIdentity: identityKey,
                            })
                          }
                        >
                          {t('my.decline')}
                        </ActionButton>
                        <ActionButton
                          intent="primary"
                          onClick={() =>
                            dispatchCalendarCommand({
                              event: selectedCalendarEvent,
                              action: 'accept',
                              commandIdentity: identityKey,
                            })
                          }
                        >
                          {t('my.accept')}
                        </ActionButton>
                      </>
                    )}
                  {canCancelSelected && selectedItem.sourceState === 'READY' && (
                    <ActionButton
                      intent="danger"
                      onClick={() =>
                        setConfirmation({
                          authority: selectedItem.authority,
                          authorityId: selectedItem.authorityId,
                          version: selectedItem.version,
                          action: 'cancel',
                        })
                      }
                    >
                      {t('actions.cancelBooking')}
                    </ActionButton>
                  )}
                  {selectedCalendarEvent && (
                    <ActionButton
                      component={Link}
                      to={`/calendar/schedule?event=${encodeURIComponent(selectedCalendarEvent.eventId)}`}
                      intent="quiet"
                      startIcon={<LogIn size={16} />}
                    >
                      {t('workplace.reservations.actions.openCalendar')}
                    </ActionButton>
                  )}
                </Stack>
              )}
            </Box>
          </WorkplaceMobileReservationInspector>
        )}
      </Box>

      <RoomBookingDialog
        open={Boolean(
          editingEvent &&
          calendarState === 'READY' &&
          policyState === 'READY' &&
          roomBookingActionPolicy(editingEvent, capabilities.canUpdateRoomBooking).canEdit
        )}
        room={editingEvent?.resource ?? null}
        event={editingEvent}
        policy={workplaceHomeSourceData(policyState, roomPolicyQuery.data) ?? null}
        commandSourceReady={calendarState === 'READY' && policyState === 'READY'}
        onClose={() => setEditingEvent(null)}
        onSaved={async () => {
          setEditingEvent(null);
          await invalidateCalendar();
        }}
      />
      <WorkplaceRelocateBookingDialog
        booking={relocating}
        identityKey={identityKey}
        isBookingCurrent={(commandIdentity, bookingId, version) =>
          commandIdentity === activeIdentityRef.current &&
          workplaceStateRef.current === 'READY' &&
          workplaceQuery.data?.some(
            (booking) => booking.bookingId === bookingId && booking.version === version
          ) === true
        }
        open={Boolean(relocating && workplaceState === 'READY')}
        onClose={() => setRelocating(null)}
        onDenied={() => {
          setRelocating(null);
          toast.error(t('permissions.workplaceUpdateReadOnly'));
        }}
      />
      <ConfirmDialog
        open={Boolean(confirmation)}
        title={t(
          confirmation?.action === 'release'
            ? 'workplace.reservations.confirm.releaseTitle'
            : 'workplace.reservations.confirm.cancelTitle'
        )}
        description={t(
          confirmation?.action === 'release'
            ? 'workplace.reservations.confirm.releaseDescription'
            : 'workplace.reservations.confirm.cancelDescription'
        )}
        cancelLabel={t('actions.keep')}
        confirmLabel={t(
          confirmation?.action === 'release'
            ? 'workplace.reservations.actions.release'
            : 'actions.cancelBooking'
        )}
        confirmingLabel={t('actions.saving')}
        intent="danger"
        busy={workplaceMutation.isPending || calendarMutation.isPending}
        focusCancelAfterOpen
        minimumActionHeight={44}
        mobilePresentation="sheet"
        onClose={() => setConfirmation(null)}
        onConfirm={() => {
          if (!confirmation) return;
          if (confirmation.authority === 'WORKPLACE') {
            const booking = workplaceQuery.data?.find(
              (candidate) =>
                candidate.bookingId === confirmation.authorityId &&
                candidate.version === confirmation.version
            );
            if (booking) {
              dispatchWorkplaceCommand({
                booking,
                action: confirmation.action,
                commandIdentity: identityKey,
              });
            }
            return;
          }
          const event = calendarQuery.data?.find(
            (candidate) =>
              candidate.eventId === confirmation.authorityId &&
              candidate.version === confirmation.version
          );
          if (event && confirmation.action === 'cancel') {
            dispatchCalendarCommand({ event, action: 'cancel', commandIdentity: identityKey });
          }
        }}
      />
    </PageCanvas>
  );
}
