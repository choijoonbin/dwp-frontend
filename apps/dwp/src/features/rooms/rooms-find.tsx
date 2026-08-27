import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarClock, Video } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ActionButton,
  DatePickerField,
  EmptyState,
  FilterBar,
  PageCanvas,
  SelectField,
  mergeFilterSearchParams,
} from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import { getRoomAvailability, getRoomsPolicy } from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { RoomBookingDialog } from './room-booking-dialog';
import {
  DEFAULT_ROOM_POLICY,
  roomAvailabilityRange,
  roomDateBounds,
  roomDurationOptions,
  roomLocalDate,
  roomPolicySlots,
  roomSlotAvailable,
  roomSlotOverlaps,
} from './room-availability-model';
import { useRoomsCapabilities } from './rooms-capabilities';
import { RoomIdentity, RoomsPageHeading, RoomsPermissionNotice, RoomStateChip } from './rooms-ui';

import type { CalendarPolicy, CalendarResource, RoomOccupancy } from '@dwp-frontend/shared-utils';

const SLOT_MINUTES = 30;

type BookingSelection = {
  room: CalendarResource;
  startsAt: string;
  endsAt: string;
};

function RoomTimeline({
  room,
  date,
  durationMinutes,
  policy,
  occupancy,
  canBook,
  bookingBlockedReason,
  serverNow,
  onSelect,
}: {
  room: CalendarResource;
  date: string;
  durationMinutes: number;
  policy: CalendarPolicy;
  occupancy: readonly RoomOccupancy[];
  canBook: boolean;
  bookingBlockedReason?: string;
  serverNow: string;
  onSelect: (selection: BookingSelection) => void;
}) {
  const { t, i18n } = useTranslation('rooms');
  const slots = roomPolicySlots(date, room.timeZone, durationMinutes, policy, SLOT_MINUTES);
  const [activeSlotIndex, setActiveSlotIndex] = useState(0);
  const slotRefs = useRef(new Map<number, HTMLButtonElement>());

  useEffect(() => {
    if (activeSlotIndex >= slots.length) setActiveSlotIndex(0);
  }, [activeSlotIndex, slots.length]);

  const moveFocus = (index: number) => {
    if (!slots.length) return;
    const nextIndex = (index + slots.length) % slots.length;
    setActiveSlotIndex(nextIndex);
    slotRefs.current.get(nextIndex)?.focus();
  };
  return (
    <Box sx={{ minWidth: Math.max(520, slots.length * 30) }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
        {t('find.resourceTimeZone', { timeZone: room.timeZone })}
      </Typography>
      <Box
        aria-hidden="true"
        sx={{ display: 'grid', gridTemplateColumns: `repeat(${slots.length}, minmax(28px, 1fr))` }}
      >
        {slots.map((slot, index) => (
          <Typography
            key={slot.startsAt}
            variant="caption"
            color="text.secondary"
            sx={{ height: 22, pl: 0.4, visibility: index % 4 === 0 ? 'visible' : 'hidden' }}
          >
            {slot.localTime}
          </Typography>
        ))}
      </Box>
      <Box
        role="toolbar"
        aria-orientation="horizontal"
        aria-label={t('find.timelineLabel', { room: room.name })}
        sx={{
          display: 'grid',
          gridTemplateColumns: `repeat(${slots.length}, minmax(28px, 1fr))`,
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          overflow: 'hidden',
        }}
      >
        {slots.map((slot, index) => {
          const start = new Date(slot.startsAt);
          const end = new Date(slot.endsAt);
          const occupied = roomSlotOverlaps(
            start,
            new Date(start.getTime() + SLOT_MINUTES * 60_000),
            occupancy
          );
          const past = start.getTime() < Date.parse(serverNow);
          const selectable =
            canBook &&
            !past &&
            roomSlotAvailable({
              start,
              end,
              occupancy,
              active: room.state === 'AVAILABLE',
              bufferMinutes: policy.defaultBufferMinutes,
            });
          const label = formatDate(
            start,
            { hour: '2-digit', minute: '2-digit', timeZone: room.timeZone },
            resolveSupportedLocale(i18n.resolvedLanguage)
          );
          const tooltip =
            bookingBlockedReason ??
            t(
              !canBook
                ? 'permissions.roomBookingReadOnly'
                : past
                  ? 'find.slotPast'
                  : occupied
                    ? 'find.slotOccupied'
                    : selectable
                      ? 'find.slotAvailable'
                      : 'find.slotUnavailable',
              { time: label }
            );
          return (
            <Tooltip key={slot.startsAt} title={tooltip}>
              <Box
                component="button"
                type="button"
                tabIndex={index === activeSlotIndex ? 0 : -1}
                aria-disabled={!selectable}
                aria-label={t(selectable ? 'find.bookSlot' : 'find.unavailableSlot', {
                  room: room.name,
                  time: label,
                })}
                ref={(node: HTMLButtonElement | null) => {
                  if (node) slotRefs.current.set(index, node);
                  else slotRefs.current.delete(index);
                }}
                onFocus={() => setActiveSlotIndex(index)}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                    event.preventDefault();
                    moveFocus(index + 1);
                  }
                  if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                    event.preventDefault();
                    moveFocus(index - 1);
                  }
                  if (event.key === 'Home' || event.key === 'End') {
                    event.preventDefault();
                    moveFocus(event.key === 'Home' ? 0 : slots.length - 1);
                  }
                }}
                onClick={() => {
                  if (selectable) {
                    onSelect({ room, startsAt: slot.startsAt, endsAt: slot.endsAt });
                  }
                }}
                sx={{
                  display: 'block',
                  width: '100%',
                  height: 44,
                  minWidth: 0,
                  p: 0,
                  border: 0,
                  borderRight: index === slots.length - 1 ? 0 : 1,
                  borderColor: 'divider',
                  bgcolor: occupied ? 'warning.light' : 'background.paper',
                  opacity: occupied ? 0.7 : selectable ? 1 : 0.45,
                  cursor: selectable ? 'pointer' : 'not-allowed',
                  '&:hover': selectable ? { bgcolor: 'var(--dwp-product-soft)' } : undefined,
                  '&:focus-visible': {
                    position: 'relative',
                    zIndex: 1,
                    outline: '2px solid var(--dwp-product-accent)',
                    outlineOffset: -2,
                  },
                }}
              />
            </Tooltip>
          );
        })}
      </Box>
    </Box>
  );
}

export function RoomsFind() {
  const { t } = useTranslation('rooms');
  const capabilities = useRoomsCapabilities();
  const [searchParams, setSearchParams] = useSearchParams();
  const date = searchParams.get('date') ?? roomLocalDate('UTC');
  const search = searchParams.get('q') ?? '';
  const site = searchParams.get('site') ?? 'ALL';
  const capacity = searchParams.get('capacity') ?? '0';
  const duration = Number(searchParams.get('duration')) || DEFAULT_ROOM_POLICY.defaultEventMinutes;
  const feature = searchParams.get('feature');
  const [selection, setSelection] = useState<BookingSelection | null>(null);
  const defaultedTimeZoneRef = useRef(false);
  const range = useMemo(() => roomAvailabilityRange(date), [date]);
  const availabilityQuery = useQuery({
    queryKey: ['rooms', 'availability', range.from, range.to],
    queryFn: () => getRoomAvailability(range.from, range.to),
    staleTime: 15_000,
    refetchInterval: 60_000,
    retry: 1,
  });
  const policyQuery = useQuery({
    queryKey: ['rooms', 'policy'],
    queryFn: getRoomsPolicy,
    enabled: capabilities.isLoaded && capabilities.canViewRooms,
    staleTime: 30_000,
    retry: 1,
  });
  const policy = policyQuery.data ?? DEFAULT_ROOM_POLICY;
  const policyAvailable = Boolean(policyQuery.data);
  const rooms = useMemo(() => availabilityQuery.data?.rooms ?? [], [availabilityQuery.data?.rooms]);
  const sites = [...new Set(rooms.map((room) => room.site))].sort();
  const features = [...new Set(rooms.flatMap((room) => room.features))].sort();
  const activeTimeZone =
    rooms.find((room) => site !== 'ALL' && room.site === site)?.timeZone ??
    rooms[0]?.timeZone ??
    'UTC';
  const durationOptions = useMemo(() => roomDurationOptions(policy), [policy]);
  const dateBounds = roomDateBounds(
    activeTimeZone,
    policy.maximumAdvanceDays,
    availabilityQuery.data?.generatedAt
  );
  const updateParams = useCallback(
    (values: Record<string, string | number | null | undefined>) => {
      setSearchParams((current) => mergeFilterSearchParams(current, values), { replace: true });
    },
    [setSearchParams]
  );
  useEffect(() => {
    if (defaultedTimeZoneRef.current || !rooms[0]) return;
    defaultedTimeZoneRef.current = true;
    if (!searchParams.has('date')) {
      updateParams({ date: roomLocalDate(rooms[0].timeZone, availabilityQuery.data?.generatedAt) });
    }
  }, [availabilityQuery.data?.generatedAt, rooms, searchParams, updateParams]);
  useEffect(() => {
    if (!durationOptions.includes(duration)) {
      updateParams({ duration: durationOptions[0] ?? policy.defaultEventMinutes });
    }
  }, [duration, durationOptions, policy.defaultEventMinutes, updateParams]);
  const filtered = rooms.filter((room) => {
    const query = search.trim().toLocaleLowerCase();
    return (
      (!query ||
        [room.name, room.code, room.site, room.floor, ...room.features]
          .filter(Boolean)
          .some((value) => String(value).toLocaleLowerCase().includes(query))) &&
      (site === 'ALL' || room.site === site) &&
      room.capacity >= Number(capacity) &&
      (!feature || room.features.includes(feature))
    );
  });
  const occupancyByRoom = useMemo(() => {
    const result = new Map<string, RoomOccupancy[]>();
    for (const slot of availabilityQuery.data?.occupancy ?? []) {
      const current = result.get(slot.resourceId) ?? [];
      current.push(slot);
      result.set(slot.resourceId, current);
    }
    return result;
  }, [availabilityQuery.data?.occupancy]);
  const resetFilters = () => {
    updateParams({
      q: null,
      date: roomLocalDate(activeTimeZone, availabilityQuery.data?.generatedAt),
      site: null,
      capacity: null,
      duration: policy.defaultEventMinutes,
      feature: null,
    });
  };

  return (
    <PageCanvas>
      <RoomsPageHeading
        eyebrow={t('find.eyebrow')}
        title={t('find.title')}
        description={t('find.description')}
      />

      {capabilities.isLoaded && !capabilities.canCreateRoomBooking && (
        <RoomsPermissionNotice>{t('permissions.roomBookingReadOnly')}</RoomsPermissionNotice>
      )}
      {policyQuery.isError && (
        <Alert
          severity={policyAvailable ? 'warning' : 'error'}
          action={
            <ActionButton intent="quiet" onClick={() => policyQuery.refetch()}>
              {t('actions.retry')}
            </ActionButton>
          }
          sx={{ mb: 2 }}
        >
          {t(policyAvailable ? 'find.policyStale' : 'find.policyUnavailable')}
        </Alert>
      )}

      <Box
        sx={{ bgcolor: 'background.paper', borderInline: 1, borderColor: 'divider', px: 2, mb: 2 }}
      >
        <FilterBar
          ariaLabel={t('find.filterLabel')}
          searchLabel={t('find.searchLabel')}
          searchValue={search}
          onSearchChange={(value) => updateParams({ q: value })}
          resultLabel={t('find.resultCount', { count: filtered.length })}
          activeFilters={
            feature
              ? [
                  {
                    key: 'feature',
                    label: t(`features.${feature}`, { defaultValue: feature }),
                    onRemove: () => updateParams({ feature: null }),
                  },
                ]
              : []
          }
          resetLabel={t('actions.resetFilters')}
          onReset={resetFilters}
          filters={
            <>
              <DatePickerField
                size="small"
                label={t('find.dateLabel')}
                value={date}
                minDate={dateBounds.minDate}
                maxDate={dateBounds.maxDate}
                onValueChange={(value) => value && updateParams({ date: value })}
                sx={{ minWidth: 156 }}
              />
              <SelectField
                size="small"
                label={t('find.siteLabel')}
                value={site}
                options={[
                  { value: 'ALL', label: t('find.allSites') },
                  ...sites.map((value) => ({ value, label: value })),
                ]}
                onValueChange={(value) => updateParams({ site: String(value) })}
                sx={{ minWidth: 170 }}
              />
              <SelectField
                size="small"
                label={t('find.capacityLabel')}
                value={capacity}
                options={['0', '4', '8', '12'].map((value) => ({
                  value,
                  label: value === '0' ? t('find.any') : t('find.capacityOption', { count: value }),
                }))}
                onValueChange={(value) => updateParams({ capacity: String(value) })}
                sx={{ minWidth: 150 }}
              />
              <SelectField
                size="small"
                label={t('find.durationLabel')}
                value={String(duration)}
                options={durationOptions.map((value) => ({
                  value: String(value),
                  label: t('find.minutes', { count: value }),
                }))}
                onValueChange={(value) => updateParams({ duration: String(value) })}
                sx={{ minWidth: 140 }}
              />
            </>
          }
        />
        {features.length > 0 && (
          <Stack
            direction="row"
            gap={0.75}
            alignItems="center"
            useFlexGap
            flexWrap="wrap"
            sx={{ py: 1.25, borderBottom: 1, borderColor: 'divider' }}
          >
            <Video size={16} aria-hidden="true" />
            {features.map((value) => (
              <Chip
                key={value}
                size="small"
                clickable
                color={feature === value ? 'primary' : 'default'}
                variant={feature === value ? 'filled' : 'outlined'}
                label={t(`features.${value}`, { defaultValue: value })}
                onClick={() => updateParams({ feature: feature === value ? null : value })}
              />
            ))}
          </Stack>
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
        {availabilityQuery.isFetching && <LinearProgress aria-label={t('find.loading')} />}
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}
        >
          <Typography component="h2" variant="subtitle1" fontWeight={800}>
            {t('find.results')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('find.resultCount', { count: filtered.length })}
          </Typography>
        </Stack>
        {availabilityQuery.isError && availabilityQuery.data && (
          <Alert
            severity="warning"
            action={
              <ActionButton intent="quiet" onClick={() => availabilityQuery.refetch()}>
                {t('actions.retry')}
              </ActionButton>
            }
          >
            {t('workplace.staleWarning')}
          </Alert>
        )}
        {availabilityQuery.isLoading ? (
          <Stack spacing={1} p={2}>
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} variant="rounded" height={112} />
            ))}
          </Stack>
        ) : availabilityQuery.isError && !availabilityQuery.data ? (
          <Alert
            severity="error"
            action={
              <ActionButton intent="quiet" onClick={() => availabilityQuery.refetch()}>
                {t('actions.retry')}
              </ActionButton>
            }
          >
            {t('find.loadError')}
          </Alert>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<CalendarClock size={28} />}
            title={t('find.emptyTitle')}
            description={t('find.emptyDescription')}
            actionLabel={t('actions.resetFilters')}
            onAction={resetFilters}
          />
        ) : (
          filtered.map((room, index) => (
            <Box
              key={room.resourceId}
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', lg: '280px minmax(0, 1fr)' },
                gap: 2,
                p: 2,
                borderTop: index ? 1 : 0,
                borderColor: 'divider',
              }}
            >
              <Stack gap={1.25} justifyContent="space-between">
                <Stack direction="row" justifyContent="space-between" gap={1}>
                  <RoomIdentity room={room} />
                  <RoomStateChip room={room} />
                </Stack>
                <Stack direction="row" gap={0.5} flexWrap="wrap">
                  {room.features.slice(0, 4).map((value) => (
                    <Chip
                      key={value}
                      size="small"
                      variant="outlined"
                      label={t(`features.${value}`, { defaultValue: value })}
                    />
                  ))}
                </Stack>
              </Stack>
              <Box sx={{ minWidth: 0, overflowX: 'auto', pb: 0.5 }}>
                <RoomTimeline
                  room={room}
                  date={date}
                  durationMinutes={duration}
                  policy={policy}
                  occupancy={occupancyByRoom.get(room.resourceId) ?? []}
                  canBook={
                    capabilities.canCreateRoomBooking &&
                    policyAvailable &&
                    !availabilityQuery.isError
                  }
                  bookingBlockedReason={
                    !policyAvailable
                      ? t('find.policyUnavailable')
                      : availabilityQuery.isError
                        ? t('find.availabilityStale')
                        : undefined
                  }
                  serverNow={availabilityQuery.data?.generatedAt ?? new Date().toISOString()}
                  onSelect={setSelection}
                />
              </Box>
            </Box>
          ))
        )}
      </Box>

      <RoomBookingDialog
        open={Boolean(selection)}
        room={selection?.room ?? null}
        initialStart={selection?.startsAt}
        initialEnd={selection?.endsAt}
        policy={policyQuery.data ?? null}
        onClose={() => setSelection(null)}
      />
    </PageCanvas>
  );
}
