import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Accessibility, Building2, Layers3, MapPinned } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Temporal } from 'temporal-polyfill';
import { getRoomsPolicy, getWorkplaceExplore, useAuth, useToast } from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  EmptyState,
  PageCanvas,
  mergeFilterSearchParams,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

import { RoomBookingDialog } from './room-booking-dialog';
import { useRoomsCapabilities } from './rooms-capabilities';
import { RoomsPageHeading, RoomsPermissionNotice } from './rooms-ui';
import { WorkplaceBookingDialog } from './workplace-booking-dialog';
import { isAuthoritativeWorkplaceReadFailure } from './workplace-authority-failure';
import {
  WorkplaceDiscoveryControls,
  type WorkplaceDiscoveryView,
} from './workplace-discovery-controls';
import {
  filterWorkplaceResources,
  workplaceBookingBlockCode,
  workplaceDiscoverySort,
  workplaceDiscoveryType,
} from './workplace-discovery-model';
import {
  WorkplaceFloorPlan,
  WorkplaceMapLegend,
  WorkplaceResourceList,
  workplaceResourceAvailability,
} from './workplace-floor-plan';
import { WorkplaceResourceInspector } from './workplace-resource-inspector';
import {
  workplaceDateBounds,
  workplaceDefaultSelection,
  workplaceDurationOptions,
  workplaceRange,
  workplaceTimeOptions,
} from './workplace-time-policy';

import type {
  CalendarResource,
  WorkplaceExploreResponse,
  WorkplaceResource,
  WorkplaceResourceType,
} from '@dwp-frontend/shared-utils';
import type { WorkplaceResourceAvailability } from './workplace-floor-plan';

function dateOnly(value = new Date()) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function defaultTime() {
  const now = new Date();
  const minutes = now.getMinutes() < 30 ? 30 : 0;
  const hour = now.getHours() + (minutes === 0 ? 1 : 0);
  return `${String(Math.min(hour, 19)).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function positiveNumber(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function initialSiteTimeZone(value: string | null) {
  if (value) {
    try {
      Temporal.Now.instant().toZonedDateTimeISO(value);
      return value;
    } catch {
      // The authoritative site response replaces malformed URL hints.
    }
  }
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export function WorkplaceExplore() {
  const { t } = useTranslation('rooms');
  const auth = useAuth();
  const capabilities = useRoomsCapabilities();
  const toast = useToast();
  const theme = useTheme();
  const wide = useMediaQuery(theme.breakpoints.up('lg'));
  const [searchParams, setSearchParams] = useSearchParams();
  const defaults = useMemo(() => ({ date: dateOnly(), time: defaultTime() }), []);
  const [bookingResource, setBookingResource] = useState<WorkplaceResource | null>(null);
  const [room, setRoom] = useState<CalendarResource | null>(null);
  const [lastVerifiedSnapshot, setLastVerifiedSnapshot] = useState<{
    identityKey: string;
    data: WorkplaceExploreResponse;
  } | null>(null);
  const [siteTimeZone, setSiteTimeZone] = useState(() =>
    initialSiteTimeZone(searchParams.get('timeZone'))
  );
  const explicitDateRef = useRef(searchParams.has('date'));
  const explicitTimeRef = useRef(searchParams.has('time'));
  const defaultedTimeZoneRef = useRef<string | null>(null);
  const pendingDefaultTimeRef = useRef<string | null>(null);
  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;

  const updateParams = useCallback(
    (values: Record<string, string | number | boolean | null | undefined>) => {
      const next = mergeFilterSearchParams(searchParamsRef.current, values);
      searchParamsRef.current = next;
      setSearchParams(next, { replace: true });
    },
    [setSearchParams]
  );

  const date = searchParams.get('date') ?? defaults.date;
  const time = searchParams.get('time') ?? defaults.time;
  const duration = positiveNumber(searchParams.get('duration'), 60);
  const requestedSiteId = searchParams.get('site') ?? '';
  const requestedFloorId = searchParams.get('floor') ?? '';
  const search = searchParams.get('q') ?? '';
  const type = workplaceDiscoveryType(searchParams.get('type'));
  const feature = searchParams.get('feature') ?? '';
  const neighborhood = searchParams.get('neighborhood') ?? '';
  const accessibleOnly = searchParams.get('accessible') === 'true';
  const sort = workplaceDiscoverySort(searchParams.get('sort'));
  const view: WorkplaceDiscoveryView = searchParams.get('view') === 'map' ? 'map' : 'list';
  const inspectedResourceId = searchParams.get('resource');
  const identityKey = `${auth.user?.tenantId ?? 'anonymous'}:${auth.user?.userId ?? 'anonymous'}`;

  const selectedRange = useMemo(() => {
    try {
      return workplaceRange(date, time, duration, siteTimeZone);
    } catch {
      return null;
    }
  }, [date, duration, siteTimeZone, time]);

  const query = useQuery({
    queryKey: [
      'workplace',
      'explore',
      identityKey,
      requestedFloorId || null,
      selectedRange?.from,
      selectedRange?.to,
    ],
    queryFn: () =>
      getWorkplaceExplore(selectedRange!.from, selectedRange!.to, requestedFloorId || null),
    enabled: Boolean(selectedRange),
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[2] === identityKey ? previous : undefined,
    staleTime: 15_000,
    refetchInterval: 60_000,
    retry: (failureCount, error) => !isAuthoritativeWorkplaceReadFailure(error) && failureCount < 1,
  });
  const roomPolicyQuery = useQuery({
    queryKey: ['rooms', 'policy', identityKey],
    queryFn: getRoomsPolicy,
    enabled: capabilities.isLoaded && capabilities.canViewRooms,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
  });

  const discardRetainedData = query.isError && isAuthoritativeWorkplaceReadFailure(query.error);
  useEffect(() => {
    if (discardRetainedData) {
      setLastVerifiedSnapshot(null);
      setBookingResource(null);
      setRoom(null);
      if (searchParamsRef.current.has('resource')) updateParams({ resource: null });
    } else if (query.data && !query.isPlaceholderData && !query.isError) {
      setLastVerifiedSnapshot({ identityKey, data: query.data });
    }
  }, [
    discardRetainedData,
    identityKey,
    query.data,
    query.isError,
    query.isPlaceholderData,
    updateParams,
  ]);
  const retainedData =
    lastVerifiedSnapshot?.identityKey === identityKey ? lastVerifiedSnapshot.data : null;
  const data = discardRetainedData ? null : (query.data ?? retainedData);
  const roomPolicy = roomPolicyQuery.data ?? null;
  const selectedFloor = data?.selectedFloor ?? null;
  const selectedSite = data?.sites.find((site) => site.siteId === selectedFloor?.siteId) ?? null;
  const siteId = requestedSiteId || selectedSite?.siteId || '';
  const floorId = requestedFloorId || selectedFloor?.floorId || '';
  const policy = data?.policy;
  const floors = (data?.floors ?? []).filter((floor) => floor.siteId === siteId);
  const mapAvailable = Boolean(selectedFloor?.backgroundAssetPath);

  useEffect(() => {
    if (!data || !policy || !selectedFloor || !selectedSite || query.isPlaceholderData) return;
    const shouldSyncLocation =
      requestedFloorId !== selectedFloor.floorId || requestedSiteId !== selectedSite.siteId;
    const shouldDefaultTimeZone = defaultedTimeZoneRef.current !== selectedSite.timeZone;
    if (
      !shouldDefaultTimeZone &&
      pendingDefaultTimeRef.current &&
      time !== pendingDefaultTimeRef.current
    ) {
      return;
    }
    if (!shouldSyncLocation && !shouldDefaultTimeZone) return;

    const selection = workplaceDefaultSelection(selectedSite.timeZone, policy, data.generatedAt);
    const hasExplicitDate = explicitDateRef.current;
    const hasExplicitTime = explicitTimeRef.current;
    const nextTime = hasExplicitTime ? time : selection.time;
    if (shouldDefaultTimeZone) {
      defaultedTimeZoneRef.current = selectedSite.timeZone;
      if (!hasExplicitTime) pendingDefaultTimeRef.current = nextTime;
      explicitDateRef.current = true;
      explicitTimeRef.current = true;
    }
    updateParams({
      site: selectedSite.siteId,
      floor: selectedFloor.floorId,
      timeZone: selectedSite.timeZone,
      date: shouldDefaultTimeZone && !hasExplicitDate ? selection.date : date,
      time: shouldDefaultTimeZone ? nextTime : time,
    });
  }, [
    data,
    date,
    policy,
    query.isPlaceholderData,
    requestedFloorId,
    requestedSiteId,
    selectedFloor,
    selectedSite,
    time,
    updateParams,
  ]);

  useEffect(() => {
    if (selectedSite?.timeZone && selectedSite.timeZone !== siteTimeZone) {
      setSiteTimeZone(selectedSite.timeZone);
    }
  }, [selectedSite?.timeZone, siteTimeZone]);

  const selectableTimes = useMemo(
    () =>
      policy
        ? workplaceTimeOptions(
            policy.workingDayStart,
            policy.workingDayEnd,
            policy.minimumBookingMinutes
          )
        : [],
    [policy]
  );
  const displayedTimeOptions = useMemo(
    () =>
      selectableTimes.some((option) => option.value === time)
        ? selectableTimes
        : [{ value: time, label: time }, ...selectableTimes],
    [selectableTimes, time]
  );
  const selectableDurations = useMemo(
    () => (policy ? workplaceDurationOptions(policy) : [30, 60, 90, 120]),
    [policy]
  );
  const displayedDurationOptions = useMemo(
    () =>
      selectableDurations.includes(duration)
        ? selectableDurations
        : [duration, ...selectableDurations],
    [duration, selectableDurations]
  );
  const dateBounds = policy
    ? workplaceDateBounds(siteTimeZone, policy.bookingWindowDays)
    : { minDate: null, maxDate: null };

  useEffect(() => {
    if (!policy) return;
    if (pendingDefaultTimeRef.current) {
      if (time !== pendingDefaultTimeRef.current) return;
      pendingDefaultTimeRef.current = null;
    }
    const nextTime = selectableTimes.some((option) => option.value === time)
      ? time
      : selectableTimes[0]?.value;
    const nextDuration = selectableDurations.includes(duration)
      ? duration
      : (selectableDurations[0] ?? policy.minimumBookingMinutes);
    if ((nextTime && nextTime !== time) || nextDuration !== duration) {
      updateParams({ time: nextTime ?? time, duration: nextDuration });
    }
  }, [duration, policy, selectableDurations, selectableTimes, time, updateParams]);

  useEffect(() => {
    if (selectedFloor && !mapAvailable && view === 'map') updateParams({ view: null });
  }, [mapAvailable, selectedFloor, updateParams, view]);

  const features = useMemo(
    () => [...new Set((data?.resources ?? []).flatMap((resource) => resource.features))].sort(),
    [data?.resources]
  );
  const neighborhoods = useMemo(
    () =>
      [
        ...new Set(
          (data?.resources ?? [])
            .map((resource) => resource.neighborhood)
            .filter((value): value is string => Boolean(value))
        ),
      ].sort(),
    [data?.resources]
  );
  const typeLabels = Object.fromEntries(
    (['ROOM', 'DESK', 'LOCKER', 'PARKING', 'FOCUS_POD', 'PHONE_BOOTH', 'EQUIPMENT'] as const).map(
      (value) => [value, t(`workplace.resourceTypes.${value}`)]
    )
  ) as Record<WorkplaceResourceType, string>;
  const statusLabels = Object.fromEntries(
    (['AVAILABLE', 'OCCUPIED', 'MINE', 'ASSIGNED', 'DROP_IN', 'UNAVAILABLE'] as const).map(
      (value) => [value, t(`workplace.status.${value}`)]
    )
  ) as Record<WorkplaceResourceAvailability, string>;
  const bookability = useMemo(
    () => ({
      canCreateRoomBooking: capabilities.canCreateRoomBooking,
      canCreateWorkplaceBooking: capabilities.canCreateWorkplaceBooking,
      occupancy: data?.occupancy ?? [],
      rangeFrom: selectedRange?.from ?? null,
      rangeTo: selectedRange?.to ?? null,
      roomPolicy,
      roomPolicyReady: Boolean(roomPolicy) && !roomPolicyQuery.isError,
      serverNow: data?.generatedAt ?? new Date().toISOString(),
      timeZone: selectedSite?.timeZone ?? null,
      verified:
        !query.isPlaceholderData &&
        !query.isError &&
        Boolean(selectedSite?.timeZone && selectedSite.timeZone === siteTimeZone),
      workplacePolicy: policy ?? null,
    }),
    [
      capabilities.canCreateRoomBooking,
      capabilities.canCreateWorkplaceBooking,
      data?.generatedAt,
      data?.occupancy,
      query.isError,
      query.isPlaceholderData,
      roomPolicy,
      roomPolicyQuery.isError,
      selectedRange?.from,
      selectedRange?.to,
      selectedSite?.timeZone,
      siteTimeZone,
      policy,
    ]
  );
  const filtered = useMemo(
    () =>
      filterWorkplaceResources(
        data?.resources ?? [],
        data?.occupancy ?? [],
        {
          search,
          type,
          feature,
          neighborhood,
          accessibleOnly,
          sort,
        },
        bookability
      ),
    [
      accessibleOnly,
      bookability,
      data?.occupancy,
      data?.resources,
      feature,
      neighborhood,
      search,
      sort,
      type,
    ]
  );
  const inspected =
    filtered.find((resource) => resource.resourceId === inspectedResourceId) ?? null;
  const inspectedIndex = inspected
    ? filtered.findIndex((resource) => resource.resourceId === inspected.resourceId)
    : -1;
  const inspectedStatus = inspected
    ? workplaceResourceAvailability(inspected, data?.occupancy ?? [])
    : null;
  const inspectedBlockCode = inspected ? workplaceBookingBlockCode(inspected, bookability) : null;

  const bookingBlockedReason = (resource: WorkplaceResource | null) => {
    if (!resource) return t('workplace.explore.bookingUnavailable');
    const code = workplaceBookingBlockCode(resource, bookability);
    if (code === 'UNVERIFIED') {
      return t(
        query.isError
          ? 'workplace.explore.availabilityStale'
          : 'workplace.explore.availabilityRefreshing'
      );
    }
    if (code === 'READ_ONLY') return t('permissions.workplaceBookingReadOnly');
    if (code === 'ROOM_POLICY') return t('workplace.explore.roomPolicyUnavailable');
    if (code === 'ROOM_BINDING') return t('workplace.explore.bindingUnavailable');
    if (code === 'ASSIGNED') {
      return t('workplace.explore.assignedBlocked', { name: resource.name });
    }
    if (code === 'DROP_IN') return t('workplace.explore.dropInOnly');
    if (code === 'POLICY_RANGE') return t('workplace.explore.policyRangeUnavailable');
    return code === 'UNAVAILABLE' ? t('workplace.explore.bookingUnavailable') : undefined;
  };
  const inspectedBlockedReason = bookingBlockedReason(inspected);
  const bookableCount = filtered.filter(
    (resource) => workplaceBookingBlockCode(resource, bookability) === null
  ).length;
  const bookingEligibilityLabels = {
    eligible: t('workplace.explore.bookingEligibility.eligible'),
    blocked: t('workplace.explore.bookingEligibility.blocked'),
  };
  const bookingEligibility = (resource: WorkplaceResource) =>
    workplaceBookingBlockCode(resource, bookability) === null;

  const chooseSite = (value: string) => {
    const nextFloor = data?.floors.find((floor) => floor.siteId === value);
    const nextSite = data?.sites.find((site) => site.siteId === value);
    if (nextSite?.timeZone) setSiteTimeZone(nextSite.timeZone);
    updateParams({
      site: value,
      floor: nextFloor?.floorId ?? null,
      timeZone: nextSite?.timeZone ?? null,
      resource: null,
    });
  };
  const chooseFloor = (value: string) => {
    const nextFloor = data?.floors.find((floor) => floor.floorId === value);
    const nextSite = data?.sites.find((site) => site.siteId === nextFloor?.siteId);
    if (nextSite?.timeZone) setSiteTimeZone(nextSite.timeZone);
    updateParams({
      site: nextFloor?.siteId ?? siteId,
      floor: value,
      timeZone: nextSite?.timeZone ?? siteTimeZone,
      resource: null,
    });
  };
  const inspectResource = (resource: WorkplaceResource) => {
    updateParams({ resource: resource.resourceId });
  };
  const beginBooking = (resource: WorkplaceResource) => {
    if (!selectedRange || !selectedSite || !selectedFloor) return;
    const blockedReason = bookingBlockedReason(resource);
    if (blockedReason) {
      toast.warning(blockedReason);
      return;
    }
    if (resource.type === 'ROOM') {
      setRoom({
        resourceId: resource.calendarResourceId!,
        code: resource.code,
        name: resource.name,
        nameKo: resource.nameKo,
        nameEn: resource.nameEn,
        type: 'ROOM',
        site: selectedSite.name,
        floor: selectedFloor.name,
        capacity: resource.capacity,
        features: resource.features,
        timeZone: selectedSite.timeZone,
        approvalRequired: resource.approvalRequired,
        state: resource.state,
        available: true,
        version: resource.version,
      });
      return;
    }
    setBookingResource(resource);
  };
  const resetFilters = () => {
    const firstSite = data?.sites[0];
    const firstFloor = data?.floors.find((floor) => floor.siteId === firstSite?.siteId);
    const resetSelection =
      policy && firstSite
        ? workplaceDefaultSelection(firstSite.timeZone, policy, data?.generatedAt)
        : defaults;
    updateParams({
      q: null,
      date: resetSelection.date,
      time: resetSelection.time,
      duration: 60,
      site: firstSite?.siteId ?? null,
      floor: firstFloor?.floorId ?? null,
      timeZone: firstSite?.timeZone ?? null,
      type: null,
      feature: null,
      neighborhood: null,
      accessible: null,
      sort: null,
      view: null,
      resource: null,
    });
  };

  const hasSites = Boolean(data?.sites.length);
  const hasFloors = Boolean(data?.floors.length && selectedFloor);
  const hasUsableData = !query.isLoading && (!query.isError || Boolean(data));

  return (
    <PageCanvas>
      <RoomsPageHeading
        eyebrow={t('workplace.explore.eyebrow')}
        title={t('workplace.explore.title')}
        description={t('workplace.explore.description')}
        actions={
          selectedSite && selectedFloor ? (
            <Stack direction="row" gap={1} useFlexGap flexWrap="wrap">
              <Chip
                icon={<Building2 size={15} />}
                label={t('workplace.explore.selectedScope', {
                  site: selectedSite?.name ?? '',
                  floor: selectedFloor?.name ?? '',
                })}
                variant="outlined"
              />
              <Chip
                color="success"
                label={t('workplace.explore.availableCount', { count: bookableCount })}
                variant="outlined"
              />
            </Stack>
          ) : undefined
        }
      />

      {capabilities.isLoaded &&
        !capabilities.canCreateWorkplaceBooking &&
        !capabilities.canCreateRoomBooking && (
          <RoomsPermissionNotice>{t('permissions.workplaceBookingReadOnly')}</RoomsPermissionNotice>
        )}
      {roomPolicyQuery.isError && (
        <Alert
          severity={roomPolicy ? 'warning' : 'error'}
          action={
            <ActionButton intent="quiet" onClick={() => roomPolicyQuery.refetch()}>
              {t('actions.retry')}
            </ActionButton>
          }
          sx={{ mb: 2 }}
        >
          {t(roomPolicy ? 'find.policyStale' : 'workplace.explore.roomPolicyUnavailable')}
        </Alert>
      )}

      <Box
        sx={{
          border: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          px: { xs: 1.25, md: 2 },
        }}
      >
        <WorkplaceDiscoveryControls
          search={search}
          onSearchChange={(value) => updateParams({ q: value, resource: null })}
          date={date}
          minDate={dateBounds.minDate}
          maxDate={dateBounds.maxDate}
          onDateChange={(value) => updateParams({ date: value, resource: null })}
          time={time}
          timeOptions={displayedTimeOptions}
          onTimeChange={(value) => updateParams({ time: value, resource: null })}
          duration={duration}
          durationOptions={displayedDurationOptions}
          onDurationChange={(value) => updateParams({ duration: value, resource: null })}
          sites={data?.sites ?? []}
          siteId={data?.sites.some((site) => site.siteId === siteId) ? siteId : ''}
          onSiteChange={chooseSite}
          floors={floors}
          floorId={floors.some((floor) => floor.floorId === floorId) ? floorId : ''}
          onFloorChange={chooseFloor}
          type={type}
          typeLabels={typeLabels}
          onTypeChange={(value) =>
            updateParams({ type: value === 'ALL' ? null : value, resource: null })
          }
          feature={feature}
          features={features}
          onFeatureChange={(value) => updateParams({ feature: value, resource: null })}
          neighborhood={neighborhood}
          neighborhoods={neighborhoods}
          onNeighborhoodChange={(value) => updateParams({ neighborhood: value, resource: null })}
          accessibleOnly={accessibleOnly}
          onAccessibleOnlyChange={(value) =>
            updateParams({ accessible: value || null, resource: null })
          }
          sort={sort}
          onSortChange={(value) => updateParams({ sort: value === 'availability' ? null : value })}
          resultCount={filtered.length}
          totalCount={data?.resources.length ?? 0}
          view={view}
          mapAvailable={mapAvailable}
          onViewChange={(value) => updateParams({ view: value === 'list' ? null : value })}
          onReset={resetFilters}
        />
      </Box>

      <Box
        component="section"
        aria-labelledby="workplace-discovery-results"
        sx={{
          mt: 2,
          border: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          p: { xs: 1.25, md: 2 },
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          gap={1.25}
          sx={{ mb: 1.5 }}
        >
          <Stack direction="row" gap={1} alignItems="center">
            <Layers3 size={19} color="var(--dwp-product-accent)" />
            <Box>
              <Typography id="workplace-discovery-results" component="h2" variant="h6">
                {selectedSite?.name ?? t('workplace.explore.resultsTitle')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {selectedFloor
                  ? t('workplace.explore.floorSummary', {
                      floor: selectedFloor.name,
                      count: filtered.length,
                    })
                  : t('workplace.explore.floorRequired')}
              </Typography>
            </Box>
          </Stack>
          {data && (
            <WorkplaceMapLegend labels={statusLabels} ariaLabel={t('workplace.explore.legend')} />
          )}
        </Stack>

        {query.isLoading && !data && <Skeleton variant="rectangular" height={460} />}
        {query.isError && (
          <Alert
            severity={data ? 'warning' : 'error'}
            action={
              <ActionButton intent="secondary" onClick={() => query.refetch()}>
                {t('actions.retry')}
              </ActionButton>
            }
            sx={{ mb: data ? 2 : 0 }}
          >
            {t(data ? 'workplace.staleWarning' : 'workplace.explore.loadError')}
          </Alert>
        )}
        {hasUsableData && !hasSites && (
          <EmptyState
            icon={<Building2 size={24} />}
            title={t('workplace.explore.noSitesTitle')}
            description={t('workplace.explore.noSitesDescription')}
          />
        )}
        {hasUsableData && hasSites && !hasFloors && (
          <EmptyState
            icon={<Layers3 size={24} />}
            title={t('workplace.explore.noFloorsTitle')}
            description={t('workplace.explore.noFloorsDescription')}
          />
        )}
        {hasUsableData && hasFloors && !mapAvailable && (
          <Alert icon={<MapPinned size={19} />} severity="info" sx={{ mb: 2 }}>
            <Typography variant="subtitle2">
              {t('workplace.explore.floorPlanMissingTitle')}
            </Typography>
            <Typography variant="body2">
              {t('workplace.explore.floorPlanMissingDescription')}
            </Typography>
          </Alert>
        )}
        {hasUsableData && hasFloors && filtered.length === 0 && (
          <EmptyState
            icon={<Accessibility size={22} />}
            title={t('workplace.explore.emptyTitle')}
            description={t('workplace.explore.emptyDescription')}
          />
        )}
        {hasUsableData && hasFloors && filtered.length > 0 && view === 'list' && (
          <WorkplaceResourceList
            resources={filtered}
            occupancy={data?.occupancy ?? []}
            onSelect={inspectResource}
            statusLabels={statusLabels}
            bookingEligibility={bookingEligibility}
            bookingEligibilityLabels={bookingEligibilityLabels}
            typeLabels={typeLabels}
            selectedResourceId={inspected?.resourceId}
          />
        )}
        {hasUsableData && hasFloors && filtered.length > 0 && view === 'map' && mapAvailable && (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: wide ? 'minmax(280px, 0.38fr) minmax(0, 0.62fr)' : '1fr',
              gap: 2,
              alignItems: 'start',
            }}
          >
            {wide && (
              <Box sx={{ maxHeight: 660, overflowY: 'auto', pr: 0.5 }}>
                <WorkplaceResourceList
                  resources={filtered}
                  occupancy={data?.occupancy ?? []}
                  onSelect={inspectResource}
                  statusLabels={statusLabels}
                  bookingEligibility={bookingEligibility}
                  bookingEligibilityLabels={bookingEligibilityLabels}
                  typeLabels={typeLabels}
                  selectedResourceId={inspected?.resourceId}
                  compact
                />
              </Box>
            )}
            <WorkplaceFloorPlan
              resources={filtered}
              occupancy={data?.occupancy ?? []}
              planWidth={selectedFloor?.planWidth ?? 1200}
              planHeight={selectedFloor?.planHeight ?? 760}
              backgroundAssetPath={selectedFloor?.backgroundAssetPath}
              selectedResourceId={inspected?.resourceId}
              onSelect={inspectResource}
              statusLabels={statusLabels}
              bookingEligibility={bookingEligibility}
              bookingEligibilityLabels={bookingEligibilityLabels}
              ariaLabel={t('workplace.explore.mapLabel', {
                site: selectedSite?.name ?? '',
                floor: selectedFloor?.name ?? '',
              })}
              zoomInLabel={t('workplace.explore.zoomIn')}
              zoomOutLabel={t('workplace.explore.zoomOut')}
              fitLabel={t('workplace.explore.fitMap')}
            />
          </Box>
        )}
        {query.isFetching && !query.isLoading && (
          <Stack direction="row" gap={1} alignItems="center" role="status" sx={{ mt: 1.5 }}>
            <CircularProgress size={14} />
            <Typography variant="caption" color="text.secondary">
              {t('workplace.explore.refreshing')}
            </Typography>
          </Stack>
        )}
      </Box>

      <WorkplaceResourceInspector
        resource={inspected}
        status={inspectedStatus}
        siteName={selectedSite?.name ?? ''}
        floorName={selectedFloor?.name ?? ''}
        typeLabels={typeLabels}
        statusLabels={statusLabels}
        bookingEligible={Boolean(inspected && !inspectedBlockedReason)}
        bookingEligibilityLabel={
          inspected && !inspectedBlockedReason
            ? bookingEligibilityLabels.eligible
            : bookingEligibilityLabels.blocked
        }
        canBook={Boolean(inspected && !inspectedBlockedReason)}
        blockedReason={inspectedBlockedReason}
        retrying={
          inspectedBlockCode === 'ROOM_POLICY'
            ? roomPolicyQuery.isFetching
            : inspectedBlockCode === 'UNVERIFIED'
              ? query.isFetching
              : false
        }
        onRetry={
          inspectedBlockCode === 'ROOM_POLICY'
            ? () => void roomPolicyQuery.refetch()
            : inspectedBlockCode === 'UNVERIFIED'
              ? () => void query.refetch()
              : undefined
        }
        onBook={() => inspected && beginBooking(inspected)}
        onClose={() => updateParams({ resource: null })}
        onPrevious={() => {
          const previous = filtered[inspectedIndex - 1];
          if (previous) inspectResource(previous);
        }}
        onNext={() => {
          const next = filtered[inspectedIndex + 1];
          if (next) inspectResource(next);
        }}
        previousDisabled={inspectedIndex <= 0}
        nextDisabled={inspectedIndex < 0 || inspectedIndex >= filtered.length - 1}
      />
      <WorkplaceBookingDialog
        open={Boolean(bookingResource)}
        resource={bookingResource}
        siteName={selectedSite?.name ?? ''}
        floorName={selectedFloor?.name ?? ''}
        initialStart={selectedRange?.from ?? ''}
        initialEnd={selectedRange?.to ?? ''}
        siteTimeZone={siteTimeZone}
        serverNow={data?.generatedAt ?? new Date().toISOString()}
        policy={policy ?? null}
        onClose={() => setBookingResource(null)}
      />
      <RoomBookingDialog
        open={Boolean(room)}
        room={room}
        initialStart={selectedRange?.from ?? ''}
        initialEnd={selectedRange?.to ?? ''}
        policy={roomPolicy}
        onClose={() => setRoom(null)}
      />
    </PageCanvas>
  );
}
