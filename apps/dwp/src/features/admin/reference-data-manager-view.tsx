import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Archive,
  CalendarClock,
  CheckCircle2,
  CircleGauge,
  Database,
  GitBranch,
  History,
  Languages,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { ActionButton, EnterpriseDataGrid, FormField } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import ListItemButton from '@mui/material/ListItemButton';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

import {
  ManagementPanelError,
  ManagementPanelLoading,
} from '../../components/management-panel-state';
import { LifecycleChip } from './lifecycle-chip';
import { OperationalMetric } from './reference-data-metrics';
import { ReferenceDataOverview } from './reference-data-overview';
import {
  REQUIRED_REFERENCE_LOCALES as REQUIRED_LOCALES,
  formatReferenceDate as formatDate,
  hasReferenceLocale as hasLocale,
  preferredReferenceLabel as preferredLabel,
  referenceDataErrorMessage as errorMessage,
  referenceValidityState as validityState,
} from './reference-data-manager-model';
import { ReferenceDataActivity } from './reference-data-activity';

import type { Dispatch, SetStateAction } from 'react';
import type { GridColDef } from '@mui/x-data-grid';
import type {
  PlatformAuditEvent,
  ReferenceItem,
  ReferenceSetDetail,
  ReferenceSetSummary,
} from '@dwp-frontend/shared-utils';
import type {
  DetailView,
  ItemDialogState,
  ItemFilter,
  PendingAction,
  SetDialogMode,
} from './reference-data-manager-model';
import type { ReferenceDataCatalogSummary } from './reference-data-overview';

type QueryStatus = {
  isLoading: boolean;
  isError: boolean;
  error: unknown;
};

type DetailQueryStatus = QueryStatus & {
  refetch: () => Promise<unknown>;
};

type DetailSummary = {
  available: number;
  draft: number;
  scheduled: number;
  roots: number;
  translationCoverage: number;
};

type ReferenceDataManagerViewProps = {
  sets: ReferenceSetSummary[];
  catalogSummary: ReferenceDataCatalogSummary;
  query: string;
  setQuery: Dispatch<SetStateAction<string>>;
  selectedKey: string | null;
  setSelectedKey: Dispatch<SetStateAction<string | null>>;
  detail: ReferenceSetDetail | undefined;
  detailQuery: DetailQueryStatus;
  detailSummary: DetailSummary;
  detailView: DetailView;
  setDetailView: Dispatch<SetStateAction<DetailView>>;
  itemFilter: ItemFilter;
  setItemFilter: Dispatch<SetStateAction<ItemFilter>>;
  itemQuery: string;
  setItemQuery: Dispatch<SetStateAction<string>>;
  filteredItems: ReferenceItem[];
  activityQuery: QueryStatus;
  activities: PlatformAuditEvent[];
  setSetDialogMode: Dispatch<SetStateAction<SetDialogMode>>;
  setItemDialog: Dispatch<SetStateAction<ItemDialogState>>;
  setPendingAction: Dispatch<SetStateAction<PendingAction>>;
};

export function ReferenceDataManagerView({
  sets,
  catalogSummary,
  query,
  setQuery,
  selectedKey,
  setSelectedKey,
  detail,
  detailQuery,
  detailSummary,
  detailView,
  setDetailView,
  itemFilter,
  setItemFilter,
  itemQuery,
  setItemQuery,
  filteredItems,
  activityQuery,
  activities,
  setSetDialogMode,
  setItemDialog,
  setPendingAction,
}: ReferenceDataManagerViewProps) {
  const { t, i18n } = useTranslation('admin');
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));

  const formatValidity = useCallback(
    (item: ReferenceItem) => {
      if (item.validFrom && item.validTo) {
        return `${formatDate(item.validFrom)} – ${formatDate(item.validTo)}`;
      }
      if (item.validFrom) {
        return t('referenceData.validity.from', { date: formatDate(item.validFrom) });
      }
      if (item.validTo) {
        return t('referenceData.validity.until', { date: formatDate(item.validTo) });
      }
      return t('referenceData.validity.noLimit');
    },
    [t]
  );

  const columns = useMemo<GridColDef<ReferenceItem>[]>(
    () => [
      {
        field: 'code',
        headerName: t('referenceData.columns.value'),
        minWidth: 190,
        flex: 1.15,
        renderCell: ({ row }) => (
          <Box sx={{ minWidth: 0, py: 1 }}>
            <Typography variant="body2" fontWeight={700} noWrap>
              {preferredLabel(row, locale)}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
              {row.code}
            </Typography>
          </Box>
        ),
      },
      {
        field: 'lifecycleState',
        headerName: t('referenceData.columns.state'),
        width: 104,
        renderCell: ({ row }) => <LifecycleChip state={row.lifecycleState} />,
      },
      {
        field: 'validity',
        headerName: t('referenceData.columns.validity'),
        minWidth: 180,
        flex: 0.9,
        sortable: false,
        renderCell: ({ row }) => {
          const state = validityState(row);
          return (
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" noWrap>
                {formatValidity(row)}
              </Typography>
              <Typography
                variant="caption"
                color={state === 'expired' ? 'error.main' : 'text.secondary'}
              >
                {t(`referenceData.validity.${state}`)}
              </Typography>
            </Box>
          );
        },
      },
      {
        field: 'labels',
        headerName: t('referenceData.columns.locales'),
        width: 118,
        sortable: false,
        renderCell: ({ row }) => (
          <Stack direction="row" gap={0.5}>
            {REQUIRED_LOCALES.map((required) => (
              <Chip
                key={required}
                label={required.toUpperCase()}
                size="small"
                color={hasLocale(row, required) ? 'success' : 'default'}
                variant={hasLocale(row, required) ? 'filled' : 'outlined'}
                sx={{ height: 22, '& .MuiChip-label': { px: 0.75 } }}
              />
            ))}
          </Stack>
        ),
      },
      {
        field: 'parentCode',
        headerName: t('referenceData.columns.hierarchy'),
        minWidth: 120,
        flex: 0.65,
        renderCell: ({ row }) => (
          <Stack direction="row" alignItems="center" gap={0.75} sx={{ minWidth: 0 }}>
            <GitBranch size={15} strokeWidth={1.8} aria-hidden="true" />
            <Typography variant="body2" noWrap>
              {row.parentCode || t('referenceData.hierarchy.root')}
            </Typography>
          </Stack>
        ),
      },
      {
        field: 'updatedAt',
        headerName: t('referenceData.columns.updated'),
        minWidth: 132,
        flex: 0.7,
        renderCell: ({ row }) =>
          row.updatedAt ? (
            <Typography variant="body2" noWrap>
              {formatDate(row.updatedAt)}
            </Typography>
          ) : (
            '—'
          ),
      },
      {
        field: 'actions',
        headerName: '',
        width: 92,
        sortable: false,
        filterable: false,
        align: 'right',
        renderCell: ({ row }) => (
          <Stack direction="row" justifyContent="flex-end" sx={{ width: 1 }}>
            <Tooltip title={t('referenceData.actions.editItem')}>
              <span>
                <IconButton
                  size="small"
                  aria-label={t('referenceData.actions.editNamed', { code: row.code })}
                  disabled={
                    detail?.lifecycleState === 'RETIRED' || row.lifecycleState === 'RETIRED'
                  }
                  onClick={() => setItemDialog({ mode: 'edit', item: row })}
                >
                  <Pencil size={17} strokeWidth={1.8} />
                </IconButton>
              </span>
            </Tooltip>
            {row.lifecycleState === 'DRAFT' ? (
              <Tooltip title={t('referenceData.actions.activateItem')}>
                <span>
                  <IconButton
                    size="small"
                    color="success"
                    aria-label={t('referenceData.actions.activateNamed', { code: row.code })}
                    disabled={detail?.lifecycleState !== 'ACTIVE'}
                    onClick={() => setPendingAction({ kind: 'activate-item', item: row })}
                  >
                    <CheckCircle2 size={17} strokeWidth={1.8} />
                  </IconButton>
                </span>
              </Tooltip>
            ) : (
              <Tooltip title={t('referenceData.actions.retireItem')}>
                <span>
                  <IconButton
                    size="small"
                    aria-label={t('referenceData.actions.retireNamed', { code: row.code })}
                    disabled={
                      row.lifecycleState === 'RETIRED' || detail?.lifecycleState === 'RETIRED'
                    }
                    onClick={() => setPendingAction({ kind: 'retire-item', item: row })}
                  >
                    <Archive size={17} strokeWidth={1.8} />
                  </IconButton>
                </span>
              </Tooltip>
            )}
          </Stack>
        ),
      },
    ],
    [detail?.lifecycleState, formatValidity, locale, setItemDialog, setPendingAction, t]
  );

  return (
    <>
      <ReferenceDataOverview summary={catalogSummary} />

      <Box
        sx={{
          minHeight: 660,
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: '316px minmax(0, 1fr)' },
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Box
          component="aside"
          aria-label={t('referenceData.referenceSets')}
          sx={{
            minWidth: 0,
            borderRight: { xs: 0, md: 1 },
            borderBottom: { xs: 1, md: 0 },
            borderColor: 'divider',
          }}
        >
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ p: 2 }}>
            <Box>
              <Typography component="h2" variant="subtitle1" fontWeight={700}>
                {t('referenceData.referenceSets')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('referenceData.catalogListHelp')}
              </Typography>
            </Box>
            <Tooltip title={t('referenceData.actions.newSet')}>
              <IconButton
                size="small"
                aria-label={t('referenceData.actions.newSet')}
                onClick={() => setSetDialogMode('create')}
              >
                <Plus size={18} strokeWidth={1.8} />
              </IconButton>
            </Tooltip>
          </Stack>
          <Box sx={{ px: 2, pb: 1.5 }}>
            <FormField
              fullWidth
              size="small"
              label={t('referenceData.searchSets')}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search size={17} strokeWidth={1.8} aria-hidden="true" />
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Box>
          <Box sx={{ maxHeight: { xs: 300, md: 664 }, overflowY: 'auto', px: 1, pb: 1 }}>
            {sets.length ? (
              sets.map((set) => (
                <ListItemButton
                  key={set.setKey}
                  selected={set.setKey === selectedKey}
                  onClick={() => setSelectedKey(set.setKey)}
                  sx={{
                    minHeight: 94,
                    py: 1.25,
                    px: 1.5,
                    alignItems: 'flex-start',
                    borderRadius: 1,
                    mb: 0.5,
                    borderLeft: 3,
                    borderLeftColor: set.setKey === selectedKey ? 'primary.main' : 'transparent',
                  }}
                >
                  <Box sx={{ minWidth: 0, width: 1 }}>
                    <Stack
                      direction="row"
                      alignItems="center"
                      justifyContent="space-between"
                      gap={1}
                    >
                      <Typography component="p" variant="subtitle2" noWrap>
                        {set.name}
                      </Typography>
                      <LifecycleChip state={set.lifecycleState} />
                    </Stack>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      noWrap
                      sx={{ display: 'block', mt: 0.25 }}
                    >
                      {set.setKey}
                    </Typography>
                    <Stack direction="row" alignItems="center" gap={1} sx={{ mt: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        {t('referenceData.itemCount', { count: set.itemCount })}
                      </Typography>
                      <Box
                        sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: 'text.disabled' }}
                      />
                      <Typography variant="caption" color="text.secondary">
                        {t('referenceData.revisionShort', { revision: set.revision })}
                      </Typography>
                    </Stack>
                  </Box>
                </ListItemButton>
              ))
            ) : (
              <Box sx={{ py: 7, px: 2, textAlign: 'center' }}>
                <Database size={28} strokeWidth={1.5} color={theme.palette.text.disabled} />
                <Typography component="p" variant="subtitle2" sx={{ mt: 1.5 }}>
                  {t('referenceData.noSets')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {t('referenceData.empty.catalogDescription')}
                </Typography>
                <ActionButton
                  intent="quiet"
                  size="small"
                  startIcon={<Plus size={16} />}
                  onClick={() => setSetDialogMode('create')}
                  sx={{ mt: 2 }}
                >
                  {t('referenceData.actions.createSet')}
                </ActionButton>
              </Box>
            )}
          </Box>
        </Box>

        <Box component="section" aria-label={t('referenceData.setDetail')} sx={{ minWidth: 0 }}>
          {detailQuery.isLoading ? (
            <ManagementPanelLoading label={t('referenceData.loadingSet')} />
          ) : detailQuery.isError ? (
            <ManagementPanelError
              message={errorMessage(detailQuery.error, t('common.operationError'))}
            />
          ) : detail ? (
            <>
              <Box
                sx={{
                  minHeight: 118,
                  px: { xs: 2, md: 2.5 },
                  py: 2,
                  display: 'flex',
                  alignItems: { xs: 'flex-start', sm: 'center' },
                  justifyContent: 'space-between',
                  flexDirection: { xs: 'column', sm: 'row' },
                  gap: 2,
                  borderBottom: 1,
                  borderColor: 'divider',
                }}
              >
                <Box sx={{ minWidth: 0, maxWidth: 720 }}>
                  <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                    <Typography component="h2" variant="h6" fontWeight={700}>
                      {detail.name}
                    </Typography>
                    <LifecycleChip state={detail.lifecycleState} />
                    <Chip
                      size="small"
                      variant="outlined"
                      color={detail.lifecycleState === 'ACTIVE' ? 'success' : 'default'}
                      icon={
                        detail.lifecycleState === 'ACTIVE' ? (
                          <ShieldCheck size={14} />
                        ) : (
                          <CircleGauge size={14} />
                        )
                      }
                      label={
                        detail.lifecycleState === 'ACTIVE'
                          ? t('referenceData.runtime.published')
                          : t('referenceData.runtime.notPublished')
                      }
                    />
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {detail.description || t('referenceData.noDescription')}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mt: 0.75 }}
                  >
                    {t('referenceData.revision', { key: detail.setKey, revision: detail.revision })}
                  </Typography>
                </Box>
                <Stack direction="row" alignItems="center" gap={0.5} flexWrap="wrap">
                  <Tooltip title={t('common.actions.refresh')}>
                    <IconButton
                      aria-label={t('referenceData.actions.refreshSet')}
                      onClick={() => void detailQuery.refetch()}
                    >
                      <RefreshCw size={18} strokeWidth={1.8} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={t('referenceData.actions.editSet')}>
                    <span>
                      <IconButton
                        aria-label={t('referenceData.actions.editSet')}
                        disabled={detail.lifecycleState === 'RETIRED'}
                        onClick={() => setSetDialogMode('edit')}
                      >
                        <Pencil size={18} strokeWidth={1.8} />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <ActionButton
                    intent="secondary"
                    size="small"
                    startIcon={<Plus size={17} />}
                    disabled={detail.lifecycleState === 'RETIRED'}
                    onClick={() => setItemDialog({ mode: 'create' })}
                  >
                    {t('referenceData.actions.newItem')}
                  </ActionButton>
                  {detail.lifecycleState === 'DRAFT' ? (
                    <ActionButton
                      intent="secondary"
                      size="small"
                      startIcon={<CheckCircle2 size={17} />}
                      disabled={detail.items.length === 0}
                      onClick={() => setPendingAction({ kind: 'activate-set' })}
                    >
                      {t('referenceData.actions.activate')}
                    </ActionButton>
                  ) : (
                    <Tooltip title={t('referenceData.actions.retireSet')}>
                      <span>
                        <IconButton
                          aria-label={t('referenceData.actions.retireSet')}
                          disabled={detail.lifecycleState === 'RETIRED'}
                          onClick={() => setPendingAction({ kind: 'retire-set' })}
                        >
                          <Archive size={18} strokeWidth={1.8} />
                        </IconButton>
                      </span>
                    </Tooltip>
                  )}
                </Stack>
              </Box>

              <Box
                aria-label={t('referenceData.health.title')}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: 'repeat(2, minmax(0, 1fr))',
                    lg: 'repeat(5, minmax(0, 1fr))',
                  },
                  borderBottom: 1,
                  borderColor: 'divider',
                  bgcolor: alpha(theme.palette.primary.main, 0.025),
                }}
              >
                <OperationalMetric
                  icon={<ShieldCheck size={15} strokeWidth={1.8} />}
                  label={t('referenceData.health.available')}
                  value={detailSummary.available}
                  detail={t('referenceData.health.availableDetail')}
                />
                <OperationalMetric
                  icon={<Pencil size={15} strokeWidth={1.8} />}
                  label={t('referenceData.health.draft')}
                  value={detailSummary.draft}
                  detail={t('referenceData.health.draftDetail')}
                />
                <OperationalMetric
                  icon={<CalendarClock size={15} strokeWidth={1.8} />}
                  label={t('referenceData.health.timeBound')}
                  value={detailSummary.scheduled}
                  detail={t('referenceData.health.timeBoundDetail')}
                />
                <OperationalMetric
                  icon={<Languages size={15} strokeWidth={1.8} />}
                  label={t('referenceData.health.translation')}
                  value={`${detailSummary.translationCoverage}%`}
                  detail={t('referenceData.health.translationDetail')}
                />
                <OperationalMetric
                  icon={<GitBranch size={15} strokeWidth={1.8} />}
                  label={t('referenceData.health.roots')}
                  value={detailSummary.roots}
                  detail={t('referenceData.health.rootsDetail')}
                />
              </Box>

              <Tabs
                value={detailView}
                onChange={(_event, value: DetailView) => setDetailView(value)}
                aria-label={t('referenceData.detailViews')}
                sx={{ px: { xs: 1, md: 2 }, borderBottom: 1, borderColor: 'divider' }}
              >
                <Tab value="values" label={t('referenceData.tabs.values')} />
                <Tab
                  value="activity"
                  icon={<History size={16} />}
                  iconPosition="start"
                  label={t('referenceData.tabs.activity')}
                />
              </Tabs>

              {detailView === 'values' && (
                <>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    alignItems={{ xs: 'stretch', sm: 'center' }}
                    justifyContent="space-between"
                    gap={1.5}
                    sx={{
                      px: { xs: 1.5, md: 2 },
                      py: 1.5,
                      borderBottom: 1,
                      borderColor: 'divider',
                    }}
                  >
                    <ToggleButtonGroup
                      size="small"
                      exclusive
                      value={itemFilter}
                      onChange={(_event, value: ItemFilter | null) => value && setItemFilter(value)}
                      aria-label={t('referenceData.filters.lifecycle')}
                    >
                      <ToggleButton value="ALL">{t('referenceData.filters.all')}</ToggleButton>
                      <ToggleButton value="ACTIVE">{t('common.lifecycle.ACTIVE')}</ToggleButton>
                      <ToggleButton value="DRAFT">{t('common.lifecycle.DRAFT')}</ToggleButton>
                      <ToggleButton value="RETIRED">{t('common.lifecycle.RETIRED')}</ToggleButton>
                    </ToggleButtonGroup>
                    <FormField
                      size="small"
                      value={itemQuery}
                      onChange={(event) => setItemQuery(event.target.value)}
                      placeholder={t('referenceData.searchItems')}
                      aria-label={t('referenceData.searchItems')}
                      sx={{ width: { xs: 1, sm: 260 } }}
                      slotProps={{
                        input: {
                          startAdornment: (
                            <InputAdornment position="start">
                              <Search size={16} strokeWidth={1.8} />
                            </InputAdornment>
                          ),
                        },
                      }}
                    />
                  </Stack>
                  {desktop ? (
                    <EnterpriseDataGrid
                      ariaLabel={t('referenceData.referenceItems')}
                      rows={filteredItems}
                      columns={columns}
                      getRowId={(row) => row.code}
                      rowHeight={64}
                      minVisibleRows={filteredItems.length === 0 ? 4 : 1}
                      maxVisibleRows={8}
                      hideFooter={filteredItems.length <= 25}
                      initialState={{ pagination: { paginationModel: { pageSize: 25, page: 0 } } }}
                      slots={{
                        noRowsOverlay: () => (
                          <Box
                            sx={{
                              height: 1,
                              display: 'grid',
                              placeItems: 'center',
                              textAlign: 'center',
                              p: 3,
                            }}
                          >
                            <Box>
                              <Database
                                size={26}
                                strokeWidth={1.5}
                                color={theme.palette.text.disabled}
                              />
                              <Typography component="p" variant="subtitle2" sx={{ mt: 1 }}>
                                {itemQuery || itemFilter !== 'ALL'
                                  ? t('referenceData.empty.noMatchingItems')
                                  : t('referenceData.noItems')}
                              </Typography>
                              {!itemQuery && itemFilter === 'ALL' && (
                                <ActionButton
                                  intent="quiet"
                                  size="small"
                                  startIcon={<Plus size={16} />}
                                  onClick={() => setItemDialog({ mode: 'create' })}
                                  sx={{ mt: 1 }}
                                >
                                  {t('referenceData.actions.createItem')}
                                </ActionButton>
                              )}
                            </Box>
                          </Box>
                        ),
                      }}
                      sx={{ border: 0, borderRadius: 0 }}
                    />
                  ) : (
                    <Box
                      component="ul"
                      aria-label={t('referenceData.referenceItems')}
                      sx={{ listStyle: 'none', p: 0, m: 0 }}
                    >
                      {filteredItems.length ? (
                        filteredItems.map((item) => (
                          <Box
                            component="li"
                            key={item.code}
                            sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}
                          >
                            <Stack
                              direction="row"
                              alignItems="flex-start"
                              justifyContent="space-between"
                              gap={2}
                            >
                              <Box sx={{ minWidth: 0 }}>
                                <Typography component="h3" variant="subtitle2">
                                  {preferredLabel(item, locale)}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {item.code}
                                </Typography>
                              </Box>
                              <LifecycleChip state={item.lifecycleState} />
                            </Stack>
                            <Stack direction="row" gap={1} flexWrap="wrap" sx={{ mt: 1 }}>
                              <Typography variant="caption" color="text.secondary">
                                {formatValidity(item)}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {item.parentCode
                                  ? t('referenceData.parentSummary', { code: item.parentCode })
                                  : t('referenceData.hierarchy.root')}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {t('referenceData.itemSummary', {
                                  order: item.sortOrder,
                                  count: item.labels.length,
                                })}
                              </Typography>
                            </Stack>
                            <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1 }}>
                              <Tooltip title={t('referenceData.actions.editItem')}>
                                <span>
                                  <IconButton
                                    size="small"
                                    aria-label={t('referenceData.actions.editNamed', {
                                      code: item.code,
                                    })}
                                    disabled={
                                      detail.lifecycleState === 'RETIRED' ||
                                      item.lifecycleState === 'RETIRED'
                                    }
                                    onClick={() => setItemDialog({ mode: 'edit', item })}
                                  >
                                    <Pencil size={17} strokeWidth={1.8} />
                                  </IconButton>
                                </span>
                              </Tooltip>
                              {item.lifecycleState === 'DRAFT' ? (
                                <Tooltip title={t('referenceData.actions.activateItem')}>
                                  <span>
                                    <IconButton
                                      size="small"
                                      color="success"
                                      aria-label={t('referenceData.actions.activateNamed', {
                                        code: item.code,
                                      })}
                                      disabled={detail.lifecycleState !== 'ACTIVE'}
                                      onClick={() =>
                                        setPendingAction({ kind: 'activate-item', item })
                                      }
                                    >
                                      <CheckCircle2 size={17} strokeWidth={1.8} />
                                    </IconButton>
                                  </span>
                                </Tooltip>
                              ) : (
                                <Tooltip title={t('referenceData.actions.retireItem')}>
                                  <span>
                                    <IconButton
                                      size="small"
                                      aria-label={t('referenceData.actions.retireNamed', {
                                        code: item.code,
                                      })}
                                      disabled={
                                        item.lifecycleState === 'RETIRED' ||
                                        detail.lifecycleState === 'RETIRED'
                                      }
                                      onClick={() =>
                                        setPendingAction({ kind: 'retire-item', item })
                                      }
                                    >
                                      <Archive size={17} strokeWidth={1.8} />
                                    </IconButton>
                                  </span>
                                </Tooltip>
                              )}
                            </Stack>
                          </Box>
                        ))
                      ) : (
                        <Box component="li" sx={{ py: 6, textAlign: 'center' }}>
                          <Typography variant="body2" color="text.secondary">
                            {t('referenceData.empty.noMatchingItems')}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  )}
                </>
              )}

              {detailView === 'activity' && (
                <ReferenceDataActivity
                  isLoading={activityQuery.isLoading}
                  isError={activityQuery.isError}
                  error={activityQuery.error}
                  activities={activities}
                />
              )}
            </>
          ) : (
            <Box
              sx={{
                minHeight: 520,
                display: 'grid',
                placeItems: 'center',
                textAlign: 'center',
                p: 3,
              }}
            >
              <Box>
                <Database size={32} strokeWidth={1.5} color={theme.palette.text.disabled} />
                <Typography component="p" variant="subtitle1" sx={{ mt: 1.5 }}>
                  {t('referenceData.selectSet')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {t('referenceData.empty.selectDescription')}
                </Typography>
              </Box>
            </Box>
          )}
        </Box>
      </Box>
    </>
  );
}
