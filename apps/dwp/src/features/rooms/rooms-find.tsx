import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarClock, FilterX, Search, UsersRound, Video } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import {
  ActionButton,
  DatePickerField,
  EmptyState,
  FormField,
  PageCanvas,
  SelectField,
} from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import { getRoomAvailability, getRoomsPolicy } from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import LinearProgress from '@mui/material/LinearProgress';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
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
  onSelect,
}: {
  room: CalendarResource;
  date: string;
  durationMinutes: number;
  policy: CalendarPolicy;
  occupancy: readonly RoomOccupancy[];
  canBook: boolean;
  onSelect: (selection: BookingSelection) => void;
}) {
  const { t, i18n } = useTranslation('rooms');
  const slots = roomPolicySlots(date, room.timeZone, durationMinutes, policy, SLOT_MINUTES);
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
        role="group"
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
          const selectable =
            canBook &&
            roomSlotAvailable({
              start,
              end,
              occupancy,
              active: room.state === 'AVAILABLE',
            });
          const label = formatDate(
            start,
            { hour: '2-digit', minute: '2-digit', timeZone: room.timeZone },
            resolveSupportedLocale(i18n.resolvedLanguage)
          );
          return (
            <Tooltip
              key={slot.startsAt}
              title={t(
                !canBook
                  ? 'permissions.roomBookingReadOnly'
                  : occupied
                    ? 'find.slotOccupied'
                    : selectable
                      ? 'find.slotAvailable'
                      : 'find.slotUnavailable',
                {
                  time: label,
                }
              )}
            >
              <Box component="span" sx={{ display: 'block', minWidth: 0 }}>
                <Box
                  component="button"
                  type="button"
                  disabled={!selectable}
                  aria-label={t(selectable ? 'find.bookSlot' : 'find.unavailableSlot', {
                    room: room.name,
                    time: label,
                  })}
                  onClick={() => onSelect({ room, startsAt: slot.startsAt, endsAt: slot.endsAt })}
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
              </Box>
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
  const [date, setDate] = useState(() => roomLocalDate('UTC'));
  const [search, setSearch] = useState('');
  const [site, setSite] = useState('ALL');
  const [capacity, setCapacity] = useState('0');
  const [duration, setDuration] = useState(DEFAULT_ROOM_POLICY.defaultEventMinutes);
  const [feature, setFeature] = useState<string | null>(null);
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
  const rooms = useMemo(() => availabilityQuery.data?.rooms ?? [], [availabilityQuery.data?.rooms]);
  const sites = [...new Set(rooms.map((room) => room.site))].sort();
  const features = [...new Set(rooms.flatMap((room) => room.features))].sort();
  const activeTimeZone =
    rooms.find((room) => site !== 'ALL' && room.site === site)?.timeZone ??
    rooms[0]?.timeZone ??
    'UTC';
  const durationOptions = useMemo(() => roomDurationOptions(policy), [policy]);
  const dateBounds = roomDateBounds(activeTimeZone, policy.maximumAdvanceDays);
  useEffect(() => {
    if (defaultedTimeZoneRef.current || !rooms[0]) return;
    defaultedTimeZoneRef.current = true;
    setDate(roomLocalDate(rooms[0].timeZone, availabilityQuery.data?.generatedAt));
  }, [availabilityQuery.data?.generatedAt, rooms]);
  useEffect(() => {
    if (!durationOptions.includes(duration)) {
      setDuration(durationOptions[0] ?? policy.defaultEventMinutes);
    }
  }, [duration, durationOptions, policy.defaultEventMinutes]);
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
    setSearch('');
    setSite('ALL');
    setCapacity('0');
    setFeature(null);
  };

  return (
    <PageCanvas>
      <RoomsPageHeading
        eyebrow={t('find.eyebrow')}
        title={t('find.title')}
        description={t('find.description')}
        actions={
          <ActionButton intent="secondary" startIcon={<FilterX size={17} />} onClick={resetFilters}>
            {t('actions.resetFilters')}
          </ActionButton>
        }
      />

      {capabilities.isLoaded && !capabilities.canCreateRoomBooking && (
        <RoomsPermissionNotice>{t('permissions.roomBookingReadOnly')}</RoomsPermissionNotice>
      )}

      <Box
        sx={{
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          p: { xs: 1.5, md: 2 },
          mb: 2,
        }}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: '1fr 1fr',
              xl: 'minmax(260px, 1.4fr) 220px 180px auto',
            },
            gap: 1.5,
            alignItems: 'center',
          }}
        >
          <FormField
            size="small"
            label={t('find.searchLabel')}
            value={search}
            onChange={(change) => setSearch(change.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={17} />
                </InputAdornment>
              ),
            }}
          />
          <DatePickerField
            size="small"
            label={t('find.dateLabel')}
            value={date}
            minDate={dateBounds.minDate}
            maxDate={dateBounds.maxDate}
            onValueChange={(value) => value && setDate(value)}
          />
          <SelectField
            size="small"
            label={t('find.siteLabel')}
            value={site}
            options={[
              { value: 'ALL', label: t('find.allSites') },
              ...sites.map((value) => ({ value, label: value })),
            ]}
            onValueChange={(value) => setSite(String(value))}
          />
          <Stack direction="row" gap={1} alignItems="center">
            <UsersRound size={17} />
            <ToggleButtonGroup
              exclusive
              size="small"
              value={capacity}
              onChange={(_, value: string | null) => value && setCapacity(value)}
              aria-label={t('find.capacityLabel')}
            >
              {['0', '4', '8', '12'].map((value) => (
                <ToggleButton
                  key={value}
                  value={value}
                  aria-label={t('find.capacityOption', { count: value })}
                >
                  {value === '0' ? t('find.any') : `${value}+`}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Stack>
        </Box>
        <Stack direction={{ xs: 'column', md: 'row' }} gap={1.5} sx={{ mt: 1.5 }}>
          <Stack direction="row" gap={0.75} alignItems="center" flexWrap="wrap" sx={{ flex: 1 }}>
            <Video size={16} />
            {features.map((value) => (
              <Chip
                key={value}
                size="small"
                clickable
                color={feature === value ? 'primary' : 'default'}
                variant={feature === value ? 'filled' : 'outlined'}
                label={t(`features.${value}`, { defaultValue: value })}
                onClick={() => setFeature((current) => (current === value ? null : value))}
              />
            ))}
          </Stack>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={duration}
            onChange={(_, value: number | null) => value && setDuration(value)}
            aria-label={t('find.durationLabel')}
          >
            {durationOptions.map((value) => (
              <ToggleButton key={value} value={value}>
                {t('find.minutes', { count: value })}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Stack>
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
        {availabilityQuery.isLoading ? (
          <Stack spacing={1} p={2}>
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} variant="rounded" height={112} />
            ))}
          </Stack>
        ) : availabilityQuery.isError ? (
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
                  canBook={capabilities.canCreateRoomBooking}
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
        policy={policy}
        onClose={() => setSelection(null)}
      />
    </PageCanvas>
  );
}
