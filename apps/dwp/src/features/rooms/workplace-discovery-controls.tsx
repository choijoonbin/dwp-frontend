import { foundationTokens } from '@dwp-frontend/design-system';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { List, Map, MapPin, SlidersHorizontal } from 'lucide-react';
import { ActionButton, DatePickerField, FilterBar, SelectField } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Drawer from '@mui/material/Drawer';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';

import type {
  WorkplaceFloor,
  WorkplaceResourceType,
  WorkplaceSite,
} from '@dwp-frontend/shared-utils';
import type { WorkplaceDiscoverySort } from './workplace-discovery-model';

export type WorkplaceDiscoveryView = 'map' | 'list';

type Props = {
  scopeLabel: string;
  bookableCount: number;
  search: string;
  onSearchChange: (value: string) => void;
  date: string;
  minDate: string | null;
  maxDate: string | null;
  onDateChange: (value: string) => void;
  time: string;
  timeOptions: readonly { value: string; label: string }[];
  onTimeChange: (value: string) => void;
  duration: number;
  durationOptions: readonly number[];
  onDurationChange: (value: number) => void;
  sites: readonly WorkplaceSite[];
  siteId: string;
  onSiteChange: (value: string) => void;
  floors: readonly WorkplaceFloor[];
  floorId: string;
  onFloorChange: (value: string) => void;
  type: WorkplaceResourceType | 'ALL';
  typeLabels: Record<WorkplaceResourceType, string>;
  typeOptions: readonly WorkplaceResourceType[];
  onTypeChange: (value: WorkplaceResourceType | 'ALL') => void;
  feature: string;
  features: readonly string[];
  onFeatureChange: (value: string) => void;
  capacity: number | null;
  onCapacityChange: (value: number | null) => void;
  neighborhood: string;
  neighborhoods: readonly string[];
  onNeighborhoodChange: (value: string) => void;
  accessibleOnly: boolean;
  onAccessibleOnlyChange: (value: boolean) => void;
  sort: WorkplaceDiscoverySort;
  onSortChange: (value: WorkplaceDiscoverySort) => void;
  resultCount: number;
  totalCount: number;
  view: WorkplaceDiscoveryView;
  mapAvailable: boolean;
  onViewChange: (value: WorkplaceDiscoveryView) => void;
  onReset: () => void;
};

export function WorkplaceDiscoveryControls({
  scopeLabel,
  bookableCount,
  search,
  onSearchChange,
  date,
  minDate,
  maxDate,
  onDateChange,
  time,
  timeOptions,
  onTimeChange,
  duration,
  durationOptions,
  onDurationChange,
  sites,
  siteId,
  onSiteChange,
  floors,
  floorId,
  onFloorChange,
  type,
  typeLabels,
  typeOptions,
  onTypeChange,
  feature,
  features,
  onFeatureChange,
  capacity,
  onCapacityChange,
  neighborhood,
  neighborhoods,
  onNeighborhoodChange,
  accessibleOnly,
  onAccessibleOnlyChange,
  sort,
  onSortChange,
  resultCount,
  totalCount,
  view,
  mapAvailable,
  onViewChange,
  onReset,
}: Props) {
  const { t } = useTranslation('rooms');
  const mobile = useMediaQuery('(max-width:767px)');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const activeFilters = [
    ...(type !== 'ALL'
      ? [{ key: 'type', label: typeLabels[type], onRemove: () => onTypeChange('ALL') }]
      : []),
    ...(feature ? [{ key: 'feature', label: feature, onRemove: () => onFeatureChange('') }] : []),
    ...(capacity !== null
      ? [
          {
            key: 'capacity',
            label: t('workplace.explore.capacityFilterValue', { count: capacity }),
            onRemove: () => onCapacityChange(null),
          },
        ]
      : []),
    ...(neighborhood
      ? [
          {
            key: 'neighborhood',
            label: neighborhood,
            onRemove: () => onNeighborhoodChange(''),
          },
        ]
      : []),
    ...(accessibleOnly
      ? [
          {
            key: 'accessible',
            label: t('workplace.explore.accessibleOnly'),
            onRemove: () => onAccessibleOnlyChange(false),
          },
        ]
      : []),
  ];
  const featureOptions = feature && !features.includes(feature) ? [feature, ...features] : features;
  const neighborhoodOptions =
    neighborhood && !neighborhoods.includes(neighborhood)
      ? [neighborhood, ...neighborhoods]
      : neighborhoods;
  const capacityOptions = [1, 2, 4, 6, 8, 10, 12, 20];
  if (capacity !== null && !capacityOptions.includes(capacity)) capacityOptions.push(capacity);
  capacityOptions.sort((left, right) => left - right);

  const resultLabel = t('workplace.explore.resultSummary', {
    count: resultCount,
    total: totalCount,
  });
  const resultSummary = (
    <Stack
      direction="row"
      gap={1}
      useFlexGap
      flexWrap="wrap"
      alignItems="center"
      sx={{ minWidth: 0 }}
    >
      <Typography
        role="status"
        aria-live="polite"
        variant="caption"
        color="text.secondary"
        sx={{ overflowWrap: 'anywhere' }}
      >
        {resultLabel} · {t('workplace.explore.availableCount', { count: bookableCount })}
      </Typography>
      {search ? (
        <Chip
          size="small"
          label={search}
          onDelete={() => onSearchChange('')}
          sx={{ maxWidth: '100%' }}
        />
      ) : null}
    </Stack>
  );
  const scopeHeader = (
    <Stack
      data-testid="workplace-discovery-scope"
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      gap={1}
      sx={{ py: 1.25 }}
    >
      <Stack direction="row" alignItems="center" gap={1} sx={{ minWidth: 0 }}>
        <Box sx={{ color: 'primary.main', display: 'flex', flexShrink: 0 }}>
          <MapPin size={17} aria-hidden="true" />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            component="h1"
            aria-label={
              scopeLabel === t('workplace.explore.title')
                ? scopeLabel
                : `${t('workplace.explore.title')} · ${scopeLabel}`
            }
            sx={{ ...foundationTokens.workplace.typography.cardTitle, overflowWrap: 'anywhere' }}
          >
            {scopeLabel}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
            {[date, time, t('workplace.explore.minutes', { count: duration })].join(' · ')}
          </Typography>
        </Box>
      </Stack>
      <ActionButton
        intent="secondary"
        size="small"
        aria-expanded={mobile ? filtersOpen : advancedOpen}
        aria-haspopup={mobile ? 'dialog' : undefined}
        aria-controls={
          mobile
            ? filtersOpen
              ? 'workplace-mobile-filter-dialog'
              : undefined
            : advancedOpen
              ? 'workplace-discovery-native-scope-fields'
              : undefined
        }
        startIcon={<SlidersHorizontal size={16} />}
        onClick={() => (mobile ? setFiltersOpen(true) : setAdvancedOpen((value) => !value))}
        sx={{ flexShrink: 0 }}
      >
        {t('workplace.member.filters.open')}
      </ActionButton>
    </Stack>
  );

  const controls = (
    <Box sx={{ bgcolor: 'background.paper' }}>
      {mobile || advancedOpen ? (
        <Box id="workplace-discovery-native-scope-fields">
          <FilterBar
            ariaLabel={t('workplace.explore.filterLabel')}
            searchLabel={t('workplace.explore.search')}
            searchValue={search}
            onSearchChange={onSearchChange}
            activeFilters={activeFilters}
            resetLabel={mobile ? undefined : t('workplace.explore.resetDetails')}
            onReset={mobile ? undefined : onReset}
            filters={
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                <DatePickerField
                  size="small"
                  fullWidth={false}
                  label={t('workplace.explore.date')}
                  value={date}
                  minDate={minDate}
                  maxDate={maxDate}
                  onValueChange={(value) => value && onDateChange(value)}
                  sx={{ width: { xs: 1, sm: 156 } }}
                />
                <SelectField
                  size="small"
                  fullWidth={false}
                  label={t('workplace.explore.time')}
                  value={time}
                  options={timeOptions}
                  onValueChange={(value) => onTimeChange(String(value))}
                  sx={{ width: { xs: 1, sm: 132 } }}
                />
                <SelectField
                  size="small"
                  fullWidth={false}
                  label={t('workplace.explore.duration')}
                  value={String(duration)}
                  options={durationOptions.map((value) => ({
                    value: String(value),
                    label: t('workplace.explore.minutes', { count: value }),
                  }))}
                  onValueChange={(value) => onDurationChange(Number(value))}
                  sx={{ width: { xs: 1, sm: 128 } }}
                />
                <SelectField
                  size="small"
                  fullWidth={false}
                  label={t('workplace.explore.capacityFilter')}
                  value={capacity === null ? '' : String(capacity)}
                  options={[
                    { value: '', label: t('workplace.explore.anyCapacity') },
                    ...capacityOptions.map((value) => ({
                      value: String(value),
                      label: t('workplace.explore.capacityFilterValue', { count: value }),
                    })),
                  ]}
                  onValueChange={(value) => onCapacityChange(value === '' ? null : Number(value))}
                  sx={{ width: { xs: 1, sm: 132 } }}
                />
                <SelectField
                  size="small"
                  fullWidth={false}
                  label={t('workplace.explore.site')}
                  value={siteId}
                  options={sites.map((site) => ({ value: site.siteId, label: site.name }))}
                  onValueChange={(value) => onSiteChange(String(value))}
                  sx={{ width: { xs: 1, sm: 180 } }}
                />
                <SelectField
                  size="small"
                  fullWidth={false}
                  label={t('workplace.explore.floor')}
                  value={floorId}
                  options={floors.map((floor) => ({ value: floor.floorId, label: floor.name }))}
                  onValueChange={(value) => onFloorChange(String(value))}
                  sx={{ width: { xs: 1, sm: 128 } }}
                />
              </Box>
            }
          />
        </Box>
      ) : null}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 1.25,
          py: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <SelectField
          size="small"
          label={t('workplace.explore.type')}
          value={type}
          options={[
            { value: 'ALL', label: t('workplace.explore.allTypes') },
            ...typeOptions.map((value) => ({
              value,
              label: typeLabels[value],
            })),
          ]}
          onValueChange={(value) => onTypeChange(value as WorkplaceResourceType | 'ALL')}
          sx={{ display: { xs: 'flex', sm: 'none' } }}
        />
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          gap={1}
          useFlexGap
          flexWrap="wrap"
        >
          <Box
            sx={{ display: { xs: 'none', sm: 'block' }, minWidth: 0, overflowX: 'auto', pb: 0.25 }}
          >
            <ToggleButtonGroup
              exclusive
              size="small"
              value={type}
              onChange={(_, value: WorkplaceResourceType | 'ALL' | null) =>
                value && onTypeChange(value)
              }
              aria-label={t('workplace.explore.type')}
              sx={{
                whiteSpace: 'nowrap',
                '& .Mui-selected': { color: 'primary.main', bgcolor: 'var(--dwp-product-soft)' },
              }}
            >
              <ToggleButton value="ALL">{t('workplace.explore.allTypes')}</ToggleButton>
              {typeOptions.map((value) => (
                <ToggleButton key={value} value={value}>
                  {typeLabels[value]}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
          {!mobile ? resultSummary : null}
        </Stack>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          gap={1.25}
          alignItems={{ xs: 'stretch', md: 'center' }}
          justifyContent="space-between"
          useFlexGap
          flexWrap="wrap"
        >
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            gap={1}
            alignItems={{ xs: 'stretch', sm: 'center' }}
            useFlexGap
            flexWrap="wrap"
            sx={{ flex: { xs: '1 1 100%', md: '1 1 680px' }, minWidth: 0 }}
          >
            <SelectField
              size="small"
              fullWidth={false}
              label={t('workplace.explore.features')}
              value={feature}
              options={[
                { value: '', label: t('workplace.explore.allFeatures') },
                ...featureOptions.map((value) => ({ value, label: value })),
              ]}
              onValueChange={(value) => onFeatureChange(String(value))}
              sx={{ width: { xs: 1, sm: 210 } }}
            />
            <SelectField
              size="small"
              fullWidth={false}
              label={t('workplace.explore.neighborhood')}
              value={neighborhood}
              options={[
                { value: '', label: t('workplace.explore.allNeighborhoods') },
                ...neighborhoodOptions.map((value) => ({ value, label: value })),
              ]}
              onValueChange={(value) => onNeighborhoodChange(String(value))}
              sx={{ width: { xs: 1, sm: 210 } }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={accessibleOnly}
                  onChange={(event) => onAccessibleOnlyChange(event.target.checked)}
                />
              }
              label={t('workplace.explore.accessibleOnly')}
              sx={{ mr: 0, whiteSpace: 'nowrap' }}
            />
          </Stack>
          <Stack
            direction="row"
            gap={1}
            alignItems="center"
            justifyContent="flex-end"
            sx={{
              minWidth: 0,
              width: { xs: '100%', md: 360 },
              flex: { xs: '1 1 100%', md: '0 0 auto' },
              ml: { md: 'auto' },
            }}
          >
            <SelectField
              size="small"
              fullWidth={false}
              label={t('workplace.explore.sort')}
              value={sort}
              options={[
                { value: 'availability', label: t('workplace.explore.sortOptions.availability') },
                { value: 'name', label: t('workplace.explore.sortOptions.name') },
                { value: 'capacity', label: t('workplace.explore.sortOptions.capacity') },
              ]}
              onValueChange={(value) => onSortChange(value as WorkplaceDiscoverySort)}
              sx={{ minWidth: 0, flex: '1 1 0%' }}
            />
            <ToggleButtonGroup
              exclusive
              size="small"
              value={view}
              onChange={(_, value: WorkplaceDiscoveryView | null) => value && onViewChange(value)}
            >
              <Tooltip
                title={
                  mapAvailable
                    ? t('workplace.explore.mapView')
                    : t('workplace.explore.mapUnavailable')
                }
              >
                <span>
                  <ToggleButton
                    value="map"
                    disabled={!mapAvailable}
                    aria-label={t('workplace.explore.mapView')}
                  >
                    <Map size={17} />
                  </ToggleButton>
                </span>
              </Tooltip>
              <Tooltip title={t('workplace.explore.listView')}>
                <ToggleButton value="list" aria-label={t('workplace.explore.listView')}>
                  <List size={17} />
                </ToggleButton>
              </Tooltip>
            </ToggleButtonGroup>
          </Stack>
        </Stack>
      </Box>
    </Box>
  );

  if (!mobile)
    return (
      <>
        {scopeHeader}
        {controls}
      </>
    );

  return (
    <>
      {scopeHeader}
      <Stack spacing={1.25} sx={{ pb: 1.25 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
          {resultSummary}
          <ToggleButtonGroup
            exclusive
            size="small"
            value={view}
            onChange={(_, value: WorkplaceDiscoveryView | null) => value && onViewChange(value)}
            aria-label={t('workplace.member.filters.view')}
            sx={{ flexShrink: 0 }}
          >
            <ToggleButton value="list" aria-label={t('workplace.explore.listView')}>
              <List size={17} />
            </ToggleButton>
            <ToggleButton
              value="map"
              disabled={!mapAvailable}
              aria-label={t('workplace.explore.mapView')}
            >
              <Map size={17} />
            </ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      </Stack>
      <Drawer
        anchor="bottom"
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        slotProps={{
          paper: {
            sx: {
              maxHeight: '92dvh',
              width: '100%',
              maxWidth: 430,
              mx: 'auto',
              borderTopLeftRadius: foundationTokens.radius.surface * 2 + 'px',
              borderTopRightRadius: foundationTokens.radius.surface * 2 + 'px',
              overflow: 'hidden',
            },
          },
        }}
      >
        <Stack
          id="workplace-mobile-filter-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="workplace-mobile-filter-title"
          sx={{ minWidth: 0, maxHeight: '92dvh' }}
        >
          <Box sx={{ px: 2, pt: 1, pb: 1.5, borderBottom: 1, borderColor: 'divider' }}>
            <Box
              aria-hidden="true"
              sx={{
                width: 40,
                height: 4,
                borderRadius: foundationTokens.radius.surface + 'px',
                bgcolor: 'divider',
                mx: 'auto',
                mb: 1.5,
              }}
            />
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2}>
              <Box minWidth={0}>
                <Typography id="workplace-mobile-filter-title" component="h2" variant="h6">
                  {t('workplace.explore.filterLabel')}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {scopeLabel} · {resultLabel}
                </Typography>
              </Box>
              <Typography variant="caption" color="primary.main" fontWeight="fontWeightBold">
                {t('workplace.explore.availableCount', { count: bookableCount })}
              </Typography>
            </Stack>
          </Box>
          <Box
            sx={{
              px: 2,
              minHeight: 0,
              flex: '1 1 auto',
              overflowY: 'auto',
              overscrollBehavior: 'contain',
            }}
          >
            {controls}
          </Box>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'minmax(96px, .7fr) minmax(0, 1.5fr)',
              gap: 1,
              p: 2,
              borderTop: 1,
              borderColor: 'divider',
              bgcolor: 'background.paper',
            }}
          >
            <ActionButton intent="secondary" onClick={onReset}>
              {t('workplace.explore.resetDetails')}
            </ActionButton>
            <ActionButton intent="primary" onClick={() => setFiltersOpen(false)}>
              {t('workplace.member.filters.apply')}
            </ActionButton>
          </Box>
        </Stack>
      </Drawer>
    </>
  );
}
