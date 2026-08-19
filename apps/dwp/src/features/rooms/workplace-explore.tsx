import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Accessibility,
  Building2,
  FilterX,
  Layers3,
  List,
  Map,
  Search,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import {
  getWorkplaceExplore,
  useAuth,
  useToast,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  DatePickerField,
  EmptyState,
  FormField,
  PageCanvas,
  SelectField,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import InputAdornment from '@mui/material/InputAdornment';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

import { RoomBookingDialog } from './room-booking-dialog';
import { RoomsPageHeading } from './rooms-ui';
import { WorkplaceBookingDialog } from './workplace-booking-dialog';
import {
  WorkplaceFloorPlan,
  WorkplaceMapLegend,
  WorkplaceResourceList,
  workplaceResourceAvailability,
} from './workplace-floor-plan';

import type {
  CalendarResource,
  WorkplaceResource,
  WorkplaceResourceType,
} from '@dwp-frontend/shared-utils';
import type { WorkplaceResourceAvailability } from './workplace-floor-plan';

type ViewMode = 'map' | 'list';

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

function timeOptions() {
  return Array.from({ length: 24 }, (_, index) => {
    const total = 8 * 60 + index * 30;
    const value = `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
    return { value, label: value };
  });
}

function range(date: string, time: string, duration: number) {
  const start = new Date(`${date}T${time}:00`);
  const end = new Date(start.getTime() + duration * 60_000);
  return { from: start.toISOString(), to: end.toISOString() };
}

export function WorkplaceExplore() {
  const { t } = useTranslation('rooms');
  const auth = useAuth();
  const toast = useToast();
  const theme = useTheme();
  const compact = useMediaQuery(theme.breakpoints.down('md'));
  const [date, setDate] = useState(dateOnly);
  const [time, setTime] = useState(defaultTime);
  const [duration, setDuration] = useState(60);
  const [siteId, setSiteId] = useState('ALL');
  const [floorId, setFloorId] = useState<string | null>(null);
  const [type, setType] = useState<WorkplaceResourceType | 'ALL'>('ALL');
  const [feature, setFeature] = useState('ALL');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<ViewMode>('map');
  const [selected, setSelected] = useState<WorkplaceResource | null>(null);
  const [room, setRoom] = useState<CalendarResource | null>(null);
  const selectedRange = useMemo(() => range(date, time, duration), [date, duration, time]);

  useEffect(() => {
    if (compact) setView('list');
  }, [compact]);

  const query = useQuery({
    queryKey: ['workplace', 'explore', floorId, selectedRange.from, selectedRange.to],
    queryFn: () => getWorkplaceExplore(selectedRange.from, selectedRange.to, floorId),
    staleTime: 15_000,
    refetchInterval: 60_000,
    retry: 1,
  });
  const data = query.data;
  const selectedFloor = data?.selectedFloor ?? null;
  const selectedSite = data?.sites.find((site) => site.siteId === selectedFloor?.siteId) ?? null;
  const floors = (data?.floors ?? []).filter((floor) => siteId === 'ALL' || floor.siteId === siteId);
  const features = [...new Set((data?.resources ?? []).flatMap((resource) => resource.features))].sort();
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
  const filtered = (data?.resources ?? []).filter((resource) => {
    const keyword = search.trim().toLocaleLowerCase();
    return (
      (type === 'ALL' || resource.type === type) &&
      (feature === 'ALL' || resource.features.includes(feature)) &&
      (!keyword ||
        [resource.name, resource.code, resource.neighborhood, ...resource.features]
          .filter(Boolean)
          .some((value) => String(value).toLocaleLowerCase().includes(keyword)))
    );
  });
  const availableCount = filtered.filter(
    (resource) => workplaceResourceAvailability(resource, data?.occupancy ?? []) === 'AVAILABLE'
  ).length;

  const reset = () => {
    setType('ALL');
    setFeature('ALL');
    setSearch('');
  };
  const chooseSite = (value: string) => {
    setSiteId(value);
    const floor = data?.floors.find((candidate) => value === 'ALL' || candidate.siteId === value);
    setFloorId(floor?.floorId ?? null);
  };
  const chooseResource = (resource: WorkplaceResource) => {
    if (
      resource.mode === 'ASSIGNED' &&
      !data?.policy.allowAssignedDeskLending &&
      resource.assignedUserId !== auth.user?.userId &&
      resource.assignedPersonPublicId !== auth.user?.personPublicId
    ) {
      toast.warning(t('workplace.explore.assignedBlocked', { name: resource.assignedDisplayName }));
      return;
    }
    if (resource.mode === 'DROP_IN' && Date.parse(selectedRange.from) > Date.now() + 15 * 60_000) {
      toast.warning(t('workplace.explore.dropInOnly'));
      return;
    }
    if (resource.type === 'ROOM') {
      if (!resource.calendarResourceId || !selectedSite || !selectedFloor) return;
      setRoom({
        resourceId: resource.calendarResourceId,
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
    setSelected(resource);
  };

  return (
    <PageCanvas>
      <RoomsPageHeading
        eyebrow={t('workplace.explore.eyebrow')}
        title={t('workplace.explore.title')}
        description={t('workplace.explore.description')}
        actions={
          <Stack direction="row" gap={1}>
            <Chip
              icon={<Building2 size={15} />}
              label={t('workplace.explore.siteCount', { count: data?.sites.length ?? 0 })}
              variant="outlined"
            />
            <Chip
              color="success"
              label={t('workplace.explore.availableCount', { count: availableCount })}
              variant="outlined"
            />
          </Stack>
        }
      />

      <Box sx={{ border: 1, borderColor: 'divider', bgcolor: 'background.paper', p: { xs: 1.25, md: 2 } }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', xl: '1.3fr repeat(5, minmax(130px, 0.7fr))' },
            gap: 1.25,
          }}
        >
          <FormField
            size="small"
            label={t('workplace.explore.search')}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start"><Search size={17} /></InputAdornment>
              ),
            }}
          />
          <DatePickerField
            size="small"
            label={t('workplace.explore.date')}
            value={date}
            onValueChange={(value) => value && setDate(value)}
          />
          <SelectField
            size="small"
            label={t('workplace.explore.time')}
            value={time}
            options={timeOptions()}
            onValueChange={(value) => setTime(String(value))}
          />
          <SelectField
            size="small"
            label={t('workplace.explore.duration')}
            value={String(duration)}
            options={[30, 60, 90, 120, 240, 480].map((value) => ({
              value: String(value), label: t('workplace.explore.minutes', { count: value }),
            }))}
            onValueChange={(value) => setDuration(Number(value))}
          />
          <SelectField
            size="small"
            label={t('workplace.explore.site')}
            value={siteId}
            options={[
              { value: 'ALL', label: t('workplace.explore.allSites') },
              ...(data?.sites ?? []).map((site) => ({ value: site.siteId, label: site.name })),
            ]}
            onValueChange={(value) => chooseSite(String(value))}
          />
          <SelectField
            size="small"
            label={t('workplace.explore.floor')}
            value={selectedFloor?.floorId ?? ''}
            options={floors.map((floor) => ({ value: floor.floorId, label: `${floor.siteName} · ${floor.name}` }))}
            onValueChange={(value) => setFloorId(String(value))}
          />
        </Box>
        <Divider sx={{ my: 1.5 }} />
        <Stack direction={{ xs: 'column', md: 'row' }} gap={1} justifyContent="space-between">
          <Stack direction="row" gap={1} useFlexGap flexWrap="wrap">
            <SelectField
              size="small"
              label={t('workplace.explore.type')}
              value={type}
              sx={{ minWidth: 170 }}
              options={[
                { value: 'ALL', label: t('workplace.explore.allTypes') },
                ...Object.entries(typeLabels).map(([value, label]) => ({ value, label })),
              ]}
              onValueChange={(value) => setType(value as WorkplaceResourceType | 'ALL')}
            />
            <SelectField
              size="small"
              label={t('workplace.explore.features')}
              value={feature}
              sx={{ minWidth: 170 }}
              options={[
                { value: 'ALL', label: t('workplace.explore.allFeatures') },
                ...features.map((value) => ({ value, label: value })),
              ]}
              onValueChange={(value) => setFeature(String(value))}
            />
            <ActionButton intent="quiet" startIcon={<FilterX size={17} />} onClick={reset}>
              {t('actions.resetFilters')}
            </ActionButton>
          </Stack>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={view}
            onChange={(_, value: ViewMode | null) => value && setView(value)}
          >
            <Tooltip title={t('workplace.explore.mapView')}>
              <ToggleButton value="map" aria-label={t('workplace.explore.mapView')}><Map size={17} /></ToggleButton>
            </Tooltip>
            <Tooltip title={t('workplace.explore.listView')}>
              <ToggleButton value="list" aria-label={t('workplace.explore.listView')}><List size={17} /></ToggleButton>
            </Tooltip>
          </ToggleButtonGroup>
        </Stack>
      </Box>

      <Box sx={{ mt: 2, border: 1, borderColor: 'divider', bgcolor: 'background.paper', p: { xs: 1.25, md: 2 } }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={1.25} sx={{ mb: 1.5 }}>
          <Stack direction="row" gap={1} alignItems="center">
            <Layers3 size={19} color="var(--dwp-product-accent)" />
            <Box>
              <Typography variant="h6" fontWeight={750}>{selectedFloor?.siteName ?? t('workplace.explore.floorPlan')}</Typography>
              <Typography variant="caption" color="text.secondary">
                {selectedFloor ? `${selectedFloor.name} · ${filtered.length}${t('workplace.explore.resourcesUnit')}` : ''}
              </Typography>
            </Box>
          </Stack>
          <WorkplaceMapLegend labels={statusLabels} ariaLabel={t('workplace.explore.legend')} />
        </Stack>

        {query.isLoading && <Skeleton variant="rectangular" height={460} />}
        {query.isError && (
          <Alert severity="error" action={<ActionButton intent="secondary" onClick={() => query.refetch()}>{t('actions.retry')}</ActionButton>}>
            {t('workplace.explore.loadError')}
          </Alert>
        )}
        {!query.isLoading && !query.isError && filtered.length === 0 && (
          <EmptyState
            icon={<Accessibility size={22} />}
            title={t('workplace.explore.emptyTitle')}
            description={t('workplace.explore.emptyDescription')}
          />
        )}
        {!query.isLoading && !query.isError && filtered.length > 0 && view === 'map' && (
          <WorkplaceFloorPlan
            resources={filtered}
            occupancy={data?.occupancy ?? []}
            planWidth={selectedFloor?.planWidth ?? 1200}
            planHeight={selectedFloor?.planHeight ?? 760}
            backgroundAssetPath={selectedFloor?.backgroundAssetPath}
            selectedResourceId={selected?.resourceId}
            onSelect={chooseResource}
            statusLabels={statusLabels}
            entryLabel={t('workplace.explore.entry')}
          />
        )}
        {!query.isLoading && !query.isError && filtered.length > 0 && view === 'list' && (
          <WorkplaceResourceList
            resources={filtered}
            occupancy={data?.occupancy ?? []}
            onSelect={chooseResource}
            statusLabels={statusLabels}
            typeLabels={typeLabels}
          />
        )}
        {query.isFetching && !query.isLoading && (
          <Stack direction="row" gap={1} alignItems="center" sx={{ mt: 1 }}>
            <CircularProgress size={14} />
            <Typography variant="caption" color="text.secondary">{t('workplace.explore.refreshing')}</Typography>
          </Stack>
        )}
      </Box>

      <WorkplaceBookingDialog
        open={Boolean(selected)}
        resource={selected}
        siteName={selectedSite?.name ?? ''}
        floorName={selectedFloor?.name ?? ''}
        initialStart={selectedRange.from}
        initialEnd={selectedRange.to}
        onClose={() => setSelected(null)}
      />
      <RoomBookingDialog
        open={Boolean(room)}
        room={room}
        initialStart={selectedRange.from}
        initialEnd={selectedRange.to}
        onClose={() => setRoom(null)}
      />
    </PageCanvas>
  );
}
