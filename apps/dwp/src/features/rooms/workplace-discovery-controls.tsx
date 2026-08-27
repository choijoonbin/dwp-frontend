import { useTranslation } from 'react-i18next';
import { List, Map } from 'lucide-react';
import { DatePickerField, FilterBar, SelectField } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';

import type {
  WorkplaceFloor,
  WorkplaceResourceType,
  WorkplaceSite,
} from '@dwp-frontend/shared-utils';
import type { WorkplaceDiscoverySort } from './workplace-discovery-model';

export type WorkplaceDiscoveryView = 'map' | 'list';

type Props = {
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
  onTypeChange: (value: WorkplaceResourceType | 'ALL') => void;
  feature: string;
  features: readonly string[];
  onFeatureChange: (value: string) => void;
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
  onTypeChange,
  feature,
  features,
  onFeatureChange,
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
  const activeFilters = [
    ...(type !== 'ALL'
      ? [{ key: 'type', label: typeLabels[type], onRemove: () => onTypeChange('ALL') }]
      : []),
    ...(feature ? [{ key: 'feature', label: feature, onRemove: () => onFeatureChange('') }] : []),
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

  return (
    <Box sx={{ bgcolor: 'background.paper' }}>
      <FilterBar
        ariaLabel={t('workplace.explore.filterLabel')}
        searchLabel={t('workplace.explore.search')}
        searchValue={search}
        onSearchChange={onSearchChange}
        resultLabel={t('workplace.explore.resultSummary', {
          count: resultCount,
          total: totalCount,
        })}
        activeFilters={activeFilters}
        resetLabel={t('workplace.explore.resetDetails')}
        onReset={onReset}
        filters={
          <>
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
          </>
        }
      />
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
            ...(Object.keys(typeLabels) as WorkplaceResourceType[]).map((value) => ({
              value,
              label: typeLabels[value],
            })),
          ]}
          onValueChange={(value) => onTypeChange(value as WorkplaceResourceType | 'ALL')}
          sx={{ display: { xs: 'flex', sm: 'none' } }}
        />
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
            sx={{ whiteSpace: 'nowrap' }}
          >
            <ToggleButton value="ALL">{t('workplace.explore.allTypes')}</ToggleButton>
            {(Object.keys(typeLabels) as WorkplaceResourceType[]).map((value) => (
              <ToggleButton key={value} value={value}>
                {typeLabels[value]}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          gap={1.25}
          alignItems={{ xs: 'stretch', md: 'center' }}
          justifyContent="space-between"
        >
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            gap={1}
            alignItems={{ xs: 'stretch', sm: 'center' }}
            useFlexGap
            flexWrap="wrap"
          >
            <SelectField
              size="small"
              fullWidth={false}
              label={t('workplace.explore.features')}
              value={feature}
              options={[
                { value: '', label: t('workplace.explore.allFeatures') },
                ...features.map((value) => ({ value, label: value })),
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
                ...neighborhoods.map((value) => ({ value, label: value })),
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
          <Stack direction="row" gap={1} alignItems="center" justifyContent="flex-end">
            <SelectField
              size="small"
              label={t('workplace.explore.sort')}
              value={sort}
              options={[
                { value: 'availability', label: t('workplace.explore.sortOptions.availability') },
                { value: 'name', label: t('workplace.explore.sortOptions.name') },
                { value: 'capacity', label: t('workplace.explore.sortOptions.capacity') },
              ]}
              onValueChange={(value) => onSortChange(value as WorkplaceDiscoverySort)}
              sx={{ minWidth: 138, flex: { xs: 1, sm: '0 0 auto' } }}
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
}
