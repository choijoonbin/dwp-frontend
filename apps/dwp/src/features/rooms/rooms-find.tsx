import { useMemo, useState } from 'react';
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
import { getRoomAvailability } from '@dwp-frontend/shared-utils';

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
import { roomSlotAvailable, roomSlotOverlaps } from './room-availability-model';
import { RoomIdentity, RoomsPageHeading, RoomStateChip } from './rooms-ui';

import type { CalendarResource, RoomOccupancy } from '@dwp-frontend/shared-utils';

const START_HOUR = 8;
const END_HOUR = 20;
const SLOT_MINUTES = 30;
const SLOT_COUNT = ((END_HOUR - START_HOUR) * 60) / SLOT_MINUTES;

type BookingSelection = {
  room: CalendarResource;
  startsAt: string;
  endsAt: string;
};

function dateOnly(value = new Date()) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function rangeForDate(value: string) {
  const start = new Date(`${value}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { from: start.toISOString(), to: end.toISOString() };
}

function slotDate(value: string, index: number) {
  const start = new Date(`${value}T00:00:00`);
  start.setHours(START_HOUR, index * SLOT_MINUTES, 0, 0);
  return start;
}

function RoomTimeline({
  room,
  date,
  durationMinutes,
  occupancy,
  onSelect,
}: {
  room: CalendarResource;
  date: string;
  durationMinutes: number;
  occupancy: readonly RoomOccupancy[];
  onSelect: (selection: BookingSelection) => void;
}) {
  const { t, i18n } = useTranslation('rooms');
  const slotsNeeded = durationMinutes / SLOT_MINUTES;
  return (
    <Box sx={{ minWidth: 720 }}>
      <Box
        aria-hidden="true"
        sx={{ display: 'grid', gridTemplateColumns: `repeat(${SLOT_COUNT}, minmax(28px, 1fr))` }}
      >
        {Array.from({ length: SLOT_COUNT }, (_, index) => (
          <Typography
            key={index}
            variant="caption"
            color="text.secondary"
            sx={{ height: 22, pl: 0.4, visibility: index % 4 === 0 ? 'visible' : 'hidden' }}
          >
            {String(START_HOUR + index / 2).padStart(2, '0')}:00
          </Typography>
        ))}
      </Box>
      <Box
        role="group"
        aria-label={t('find.timelineLabel', { room: room.name })}
        sx={{
          display: 'grid',
          gridTemplateColumns: `repeat(${SLOT_COUNT}, minmax(28px, 1fr))`,
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          overflow: 'hidden',
        }}
      >
        {Array.from({ length: SLOT_COUNT }, (_, index) => {
          const start = slotDate(date, index);
          const end = new Date(start.getTime() + durationMinutes * 60_000);
          const outside = index + slotsNeeded > SLOT_COUNT;
          const occupied = roomSlotOverlaps(
            start,
            new Date(start.getTime() + SLOT_MINUTES * 60_000),
            occupancy
          );
          const selectable =
            !outside &&
            roomSlotAvailable({
              start,
              end,
              occupancy,
              active: room.state === 'AVAILABLE',
            });
          const label = formatDate(
            start,
            { hour: '2-digit', minute: '2-digit' },
            resolveSupportedLocale(i18n.resolvedLanguage)
          );
          return (
            <Tooltip
              key={start.toISOString()}
              title={t(
                occupied
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
                  onClick={() =>
                    onSelect({ room, startsAt: start.toISOString(), endsAt: end.toISOString() })
                  }
                  sx={{
                    display: 'block',
                    width: '100%',
                    height: 44,
                    minWidth: 0,
                    p: 0,
                    border: 0,
                    borderRight: index === SLOT_COUNT - 1 ? 0 : 1,
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
  const [date, setDate] = useState(dateOnly);
  const [search, setSearch] = useState('');
  const [site, setSite] = useState('ALL');
  const [capacity, setCapacity] = useState('0');
  const [duration, setDuration] = useState(30);
  const [feature, setFeature] = useState<string | null>(null);
  const [selection, setSelection] = useState<BookingSelection | null>(null);
  const range = useMemo(() => rangeForDate(date), [date]);
  const availabilityQuery = useQuery({
    queryKey: ['rooms', 'availability', range.from, range.to],
    queryFn: () => getRoomAvailability(range.from, range.to),
    staleTime: 15_000,
    refetchInterval: 60_000,
    retry: 1,
  });
  const rooms = availabilityQuery.data?.rooms ?? [];
  const sites = [...new Set(rooms.map((room) => room.site))].sort();
  const features = [...new Set(rooms.flatMap((room) => room.features))].sort();
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
            {[30, 60, 90].map((value) => (
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
                  occupancy={occupancyByRoom.get(room.resourceId) ?? []}
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
        onClose={() => setSelection(null)}
      />
    </PageCanvas>
  );
}
