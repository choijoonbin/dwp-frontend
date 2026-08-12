import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowUpRight,
  BriefcaseBusiness,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Sparkles,
  UserRound,
} from 'lucide-react';
import {
  ActionButton,
  EnterpriseDataGrid,
  EmptyState,
  FilterBar,
  LiveStatus,
  LocalErrorState,
  LoadingState,
  mergeFilterSearchParams,
  OperationalKpiStrip,
  PageCanvas,
  ResourcePageHeader,
} from '@dwp-frontend/design-system';
import {
  getWorkspaceWorkQueue,
  updateWorkspaceWorkStatus,
  useToast,
} from '@dwp-frontend/shared-utils';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import ToggleButton from '@mui/material/ToggleButton';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { SectionHeading } from '../features/work-hub/workspace-ui';
import { GovernedSavedViewControl } from '../features/saved-views/governed-saved-view-control';

import type { GridColDef } from '@mui/x-data-grid';
import type {
  WorkspacePriority as Priority,
  WorkspaceWorkItem,
  WorkspaceWorkStatus as WorkStatus,
} from '@dwp-frontend/shared-utils';

type WorkFilter = 'all' | WorkStatus;
type WorkRow = WorkspaceWorkItem & { due: string };

const statusColor: Record<WorkStatus, 'error' | 'info' | 'warning' | 'success'> = {
  'due-soon': 'error',
  'in-progress': 'info',
  waiting: 'warning',
  completed: 'success',
};

const priorityColor: Record<Priority, 'error' | 'warning' | 'default'> = {
  high: 'error',
  medium: 'warning',
  low: 'default',
};

const WORK_FILTERS: WorkFilter[] = ['all', 'due-soon', 'in-progress', 'waiting', 'completed'];

function isWorkFilter(value: string | null): value is WorkFilter {
  return Boolean(value && WORK_FILTERS.includes(value as WorkFilter));
}

export default function WorkPage() {
  const { t } = useTranslation(['work', 'common']);
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const filterParam = searchParams.get('status');
  const filter: WorkFilter = isWorkFilter(filterParam) ? filterParam : 'all';
  const query = searchParams.get('q') ?? '';
  const columnPreset = searchParams.get('columns') === 'compact' ? 'compact' : 'operational';
  const showQueueDetailColumns = useMediaQuery('(min-width:600px)');
  const showSourceColumn = useMediaQuery('(min-width:1600px)');
  const queueQuery = useQuery({
    queryKey: ['workspace', 'work-queue'],
    queryFn: getWorkspaceWorkQueue,
    staleTime: 30_000,
    retry: 1,
  });
  const items = useMemo<WorkRow[]>(
    () =>
      (queueQuery.data?.items ?? []).map((item) => ({
        ...item,
        due: item.dueAt
          ? formatDate(new Date(item.dueAt), {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })
          : t('workPage.noDueDate'),
      })),
    [queueQuery.data?.items, t]
  );
  const selectedId = searchParams.get('item') ?? '';
  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return items.filter((item) => {
      const statusMatches = filter === 'all' || item.status === filter;
      const queryMatches =
        !normalized ||
        [item.id, item.title, item.summary, item.owner, item.sourceSystem].some((value) =>
          String(value ?? '')
            .toLocaleLowerCase()
            .includes(normalized)
        );
      return statusMatches && queryMatches;
    });
  }, [filter, items, query]);
  const selected = items.find((item) => item.id === selectedId) || filteredItems[0];
  const columns = useMemo<GridColDef<WorkRow>[]>(
    () => [
      { field: 'id', headerName: t('workPage.columns.id'), width: 112 },
      { field: 'title', headerName: t('workPage.columns.work'), minWidth: 200, flex: 1 },
      {
        field: 'priority',
        headerName: t('workPage.columns.priority'),
        width: 92,
        renderCell: ({ value }) => {
          const priority = value as Priority;
          return (
            <Chip
              label={t(`labels.priority.${priority}`)}
              color={priorityColor[priority]}
              size="small"
              variant="outlined"
            />
          );
        },
      },
      {
        field: 'status',
        headerName: t('workPage.columns.status'),
        width: 108,
        renderCell: ({ value }) => {
          const status = value as WorkStatus;
          return (
            <Chip
              label={t(`labels.status.${status}`)}
              color={statusColor[status]}
              size="small"
              variant="outlined"
            />
          );
        },
      },
      { field: 'due', headerName: t('workPage.columns.due'), width: 128 },
      { field: 'sourceSystem', headerName: t('workPage.columns.source'), width: 120 },
    ],
    [t]
  );

  const statusMutation = useMutation({
    mutationFn: ({ item, status }: { item: WorkRow; status: 'IN_PROGRESS' | 'COMPLETED' }) =>
      updateWorkspaceWorkStatus(item.workItemId, status, item.version),
    onSuccess: async (updated) => {
      queryClient.setQueryData(
        ['workspace', 'work-queue'],
        (current: Awaited<ReturnType<typeof getWorkspaceWorkQueue>> | undefined) =>
          current
            ? {
                ...current,
                items: current.items.map((item) =>
                  item.workItemId === updated.workItemId ? updated : item
                ),
              }
            : current
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['workspace', 'work-queue'] }),
        queryClient.invalidateQueries({ queryKey: ['workspace', 'activity'] }),
      ]);
      toast.success(t('workPage.statusUpdated', { title: updated.title }));
    },
    onError: () => toast.error(t('workPage.statusUpdateError')),
  });

  const selectFilter = (value: WorkFilter) => {
    setSearchParams(
      mergeFilterSearchParams(searchParams, {
        status: value === 'all' ? null : value,
        item: null,
      }),
      { replace: true }
    );
  };
  const changeFilter = (_event: React.MouseEvent<HTMLElement>, value: WorkFilter | null) => {
    if (value) selectFilter(value);
  };

  const header = (
    <ResourcePageHeader
      eyebrow={t('workPage.header.eyebrow')}
      title={t('workPage.header.title')}
      description={t('workPage.header.description')}
      status={
        <LiveStatus
          state={queueQuery.isFetching ? 'syncing' : 'live'}
          label={t('workPage.liveData')}
          refreshLabel={t('workPage.retry')}
          refreshing={queueQuery.isFetching}
          onRefresh={() => void queueQuery.refetch()}
        />
      }
    />
  );
  if (queueQuery.isLoading) {
    return (
      <PageCanvas>
        {header}
        <LoadingState label={t('workPage.loading')} variant="skeleton" size="page" />
      </PageCanvas>
    );
  }
  if (queueQuery.isError) {
    return (
      <PageCanvas>
        {header}
        <LocalErrorState
          title={t('workPage.loadErrorTitle')}
          description={t('workPage.loadErrorDescription')}
          retryLabel={t('workPage.retry')}
          onRetry={() => void queueQuery.refetch()}
          retrying={queueQuery.isFetching}
          size="page"
        />
      </PageCanvas>
    );
  }
  if (items.length === 0) {
    return (
      <PageCanvas>
        {header}
        <EmptyState
          title={t('workPage.emptyTitle')}
          description={t('workPage.emptyDescription')}
          size="page"
        />
      </PageCanvas>
    );
  }

  const summaryValues: Record<string, number> = {
    all: queueQuery.data?.summary.total ?? 0,
    due: queueQuery.data?.summary.dueSoon ?? 0,
    progress: queueQuery.data?.summary.inProgress ?? 0,
    waiting: queueQuery.data?.summary.waiting ?? 0,
  };

  return (
    <PageCanvas>
      {header}

      <Box sx={{ mt: 3 }}>
        <OperationalKpiStrip
          ariaLabel={t('workPage.summaryLabel')}
          items={[
            {
              key: 'all',
              value: String(summaryValues.all).padStart(2, '0'),
              label: t('workPage.summary.all.label'),
              detail: t('workPage.summary.all.detail'),
              onSelect: () => selectFilter('all'),
            },
            {
              key: 'due',
              value: String(summaryValues.due).padStart(2, '0'),
              label: t('workPage.summary.due.label'),
              detail: t('workPage.summary.due.detail'),
              tone: 'critical',
              onSelect: () => selectFilter('due-soon'),
            },
            {
              key: 'progress',
              value: String(summaryValues.progress).padStart(2, '0'),
              label: t('workPage.summary.progress.label'),
              detail: t('workPage.summary.progress.detail'),
              tone: 'info',
              onSelect: () => selectFilter('in-progress'),
            },
            {
              key: 'waiting',
              value: String(summaryValues.waiting).padStart(2, '0'),
              label: t('workPage.summary.waiting.label'),
              detail: t('workPage.summary.waiting.detail'),
              tone: 'warning',
              onSelect: () => selectFilter('waiting'),
            },
          ]}
        />
      </Box>

      <Box sx={{ mt: 3 }}>
        <FilterBar
          ariaLabel={t('workPage.filterLabel')}
          searchLabel={t('workPage.searchLabel')}
          searchPlaceholder={t('workPage.searchPlaceholder')}
          searchValue={query}
          onSearchChange={(value) =>
            setSearchParams(
              mergeFilterSearchParams(searchParams, { q: value || null, item: null }),
              { replace: true }
            )
          }
          filters={
            <ToggleButtonGroup
              exclusive
              size="small"
              value={filter}
              onChange={changeFilter}
              aria-label={t('workPage.filterLabel')}
            >
              {WORK_FILTERS.map((value) => (
                <ToggleButton key={value} value={value}>
                  {t(`workPage.filters.${value}`)}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          }
          savedViews={
            <GovernedSavedViewControl
              surfaceKey="workspace.work"
              currentConfiguration={{ q: query, status: filter, columns: columnPreset }}
              selectedBuiltInViewId={
                !query && columnPreset === 'operational' ? `builtin-${filter}` : null
              }
              builtInViews={WORK_FILTERS.map((value) => ({
                id: `builtin-${value}`,
                name: t(`workPage.filters.${value}`),
                configuration: { q: '', status: value, columns: 'operational' },
                isDefault: value === 'all',
              }))}
              onApply={(configuration) => {
                const nextStatus =
                  typeof configuration.status === 'string' && isWorkFilter(configuration.status)
                    ? configuration.status
                    : 'all';
                const nextQuery = typeof configuration.q === 'string' ? configuration.q : '';
                const nextColumns = configuration.columns === 'compact' ? 'compact' : 'operational';
                setSearchParams(
                  mergeFilterSearchParams(searchParams, {
                    q: nextQuery || null,
                    status: nextStatus === 'all' ? null : nextStatus,
                    columns: nextColumns === 'operational' ? null : nextColumns,
                    item: null,
                  }),
                  { replace: true }
                );
              }}
            />
          }
          activeFilters={
            filter === 'all'
              ? []
              : [
                  {
                    key: 'status',
                    label: t(`workPage.filters.${filter}`),
                    onRemove: () => selectFilter('all'),
                  },
                ]
          }
          resetLabel={t('workPage.resetFilters')}
          onReset={() =>
            setSearchParams(
              mergeFilterSearchParams(searchParams, { q: null, status: null, item: null }),
              { replace: true }
            )
          }
          resultLabel={t('workPage.resultSummary', { count: filteredItems.length })}
        />
      </Box>

      <Box
        sx={{
          mt: 2,
          display: 'grid',
          gridTemplateColumns: {
            xs: 'minmax(0, 1fr)',
            lg: 'minmax(0, 1.65fr) minmax(320px, 0.75fr)',
          },
          alignItems: 'stretch',
        }}
      >
        <Box sx={{ minWidth: 0, pr: { lg: 3 } }}>
          <EnterpriseDataGrid
            ariaLabel={t('workPage.queueLabel')}
            rows={filteredItems}
            columns={columns}
            getRowId={(row) => row.id}
            onRowClick={({ row }) =>
              setSearchParams(mergeFilterSearchParams(searchParams, { item: row.id }), {
                replace: true,
              })
            }
            columnVisibilityModel={{
              priority: columnPreset === 'operational' && showQueueDetailColumns,
              status: showQueueDetailColumns,
              due: showQueueDetailColumns,
              sourceSystem: columnPreset === 'operational' && showSourceColumn,
            }}
            rowSelectionModel={
              selected ? { type: 'include', ids: new Set([selected.id]) } : undefined
            }
            height={520}
            hideFooter={filteredItems.length <= 25}
            stickyColumns={{ left: ['id'] }}
            toolbar={{
              ariaLabel: t('workPage.gridToolbar'),
              showQuickFilter: false,
              columnsLabel: t('workPage.chooseColumns'),
              filtersLabel: t('workPage.gridFilters'),
              columnPresetsLabel: t('workPage.columnPresets.label'),
              selectedColumnPresetId: columnPreset,
              columnPresets: [
                { id: 'operational', label: t('workPage.columnPresets.operational') },
                { id: 'compact', label: t('workPage.columnPresets.compact') },
              ],
              onColumnPresetChange: (value) =>
                setSearchParams(
                  mergeFilterSearchParams(searchParams, {
                    columns: value === 'operational' ? null : value,
                  }),
                  { replace: true }
                ),
              onRefresh: () => void queueQuery.refetch(),
              refreshLabel: t('workPage.retry'),
              refreshing: queueQuery.isFetching,
            }}
          />
        </Box>

        {selected && (
          <Box
            component="aside"
            aria-labelledby="selected-work-heading"
            sx={{
              minWidth: 0,
              mt: { xs: 3, lg: 0 },
              pt: { xs: 3, lg: 0 },
              pl: { xs: 0, lg: 3 },
              borderTop: { xs: 1, lg: 0 },
              borderLeft: { xs: 0, lg: 1 },
              borderColor: 'divider',
            }}
          >
            <SectionHeading
              id="selected-work-heading"
              icon={BriefcaseBusiness}
              title={t('workPage.decisionContext')}
              meta={
                <Chip
                  label={t(`labels.status.${selected.status}`)}
                  color={statusColor[selected.status]}
                  size="small"
                />
              }
            />

            <Typography component="h3" variant="h6" sx={{ mt: 3 }}>
              {selected.title}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>
              {t('workPage.itemMeta', {
                id: selected.id,
                type: t(`labels.type.${selected.type}`),
                owner: selected.owner,
              })}
            </Typography>

            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 2 }}>
              <Chip
                label={t(`labels.priority.${selected.priority}`)}
                color={priorityColor[selected.priority]}
                size="small"
                variant="outlined"
              />
              <Chip
                icon={<Clock3 size={14} />}
                label={selected.due}
                size="small"
                variant="outlined"
              />
              <Chip label={selected.sourceSystem} size="small" variant="outlined" />
            </Box>

            <Box
              sx={{
                mt: 3,
                p: 2,
                bgcolor: 'action.selected',
                borderLeft: 3,
                borderColor: 'primary.main',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Sparkles size={17} strokeWidth={1.8} aria-hidden="true" />
                <Typography component="h3" variant="subtitle2">
                  {t('workPage.whyNext')}
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ mt: 0.75 }}>
                {selected.reason || t('workPage.noDecisionContext')}
              </Typography>
            </Box>

            <Box sx={{ display: 'grid', gap: 2.5, mt: 3 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  {t('workPage.recommendedNext')}
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.35 }}>
                  {selected.recommendedNext || t('workPage.noRecommendedNext')}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  {t('workPage.latestActivity')}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                  <UserRound size={16} strokeWidth={1.8} aria-hidden="true" />
                  <Typography variant="body2">
                    {selected.latestActivity || t('workPage.noLatestActivity')}
                  </Typography>
                </Box>
              </Box>
            </Box>

            <Divider sx={{ my: 3 }} />
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <ActionButton
                intent="primary"
                startIcon={
                  selected.status === 'completed' ? (
                    <CheckCircle2 size={17} aria-hidden="true" />
                  ) : (
                    <CircleAlert size={17} aria-hidden="true" />
                  )
                }
                disabled={
                  statusMutation.isPending ||
                  (selected.status === 'completed' && !selected.sourceRoute)
                }
                onClick={() => {
                  if (selected.status === 'completed') {
                    if (selected.sourceRoute) navigate(selected.sourceRoute);
                    return;
                  }
                  statusMutation.mutate({ item: selected, status: 'IN_PROGRESS' });
                }}
              >
                {selected.status === 'completed'
                  ? t('workPage.viewRecord')
                  : t('workPage.continueWork')}
              </ActionButton>
              {selected.status !== 'completed' && (
                <ActionButton
                  intent="secondary"
                  startIcon={<CheckCircle2 size={17} aria-hidden="true" />}
                  disabled={statusMutation.isPending}
                  onClick={() => statusMutation.mutate({ item: selected, status: 'COMPLETED' })}
                >
                  {t('workPage.completeWork')}
                </ActionButton>
              )}
              <ActionButton
                intent="secondary"
                endIcon={<ArrowUpRight size={16} aria-hidden="true" />}
                disabled={!selected.sourceRoute}
                onClick={() => selected.sourceRoute && navigate(selected.sourceRoute)}
              >
                {t('workPage.openSource')}
              </ActionButton>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
              {t('workPage.liveNotice')}
            </Typography>
          </Box>
        )}
      </Box>
    </PageCanvas>
  );
}
