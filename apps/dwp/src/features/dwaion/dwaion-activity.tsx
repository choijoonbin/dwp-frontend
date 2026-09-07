import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bot, CheckCircle2, ChevronRight, CircleAlert, Clock3, ShieldCheck } from 'lucide-react';
import {
  GuidedEmptyState,
  LiveStatus,
  LoadingState,
  LocalErrorState,
  OperationalKpiStrip,
  PageCanvas,
  ResourcePageHeader,
} from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import {
  getDwaionUserRun,
  getDwaionUserRuns,
  HttpError,
  useAuth,
  usePermissions,
  type DwaionUserRun,
} from '@dwp-frontend/shared-utils';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

import {
  DWAION_ACTIVITY_FILTERS,
  DWAION_ACTIVITY_WINDOW_LIMIT,
  filterDwaionActivityWindow,
  findExactDwaionRun,
  resolveDwaionActivityFilter,
  summarizeDwaionActivityWindow,
  updateDwaionActivityFilter,
  updateDwaionActivitySelection,
} from './dwaion-activity-model';
import { DwaionActivitySelection } from './dwaion-activity-selection';

import type { DwaionActivityFilter } from './dwaion-activity-model';

const EMPTY_RUNS: DwaionUserRun[] = [];

export function DwaionActivity() {
  const { t, i18n } = useTranslation('work');
  const navigate = useNavigate();
  const theme = useTheme();
  const mobileInspector = useMediaQuery(theme.breakpoints.down('md'));
  const desktopSplit = useMediaQuery(theme.breakpoints.up('lg'));
  const { user, isAuthenticated } = useAuth();
  const { isLoaded, hasPermission } = usePermissions();
  const [params, setParams] = useSearchParams();
  const selectedRunId = params.get('run')?.trim().toLowerCase() ?? '';
  const filter = resolveDwaionActivityFilter(params.get('state'));
  const locale = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language);
  const canLoadRuns =
    isAuthenticated && Boolean(user) && isLoaded && hasPermission('APP.ASK', 'VIEW');
  const identity = `${user?.tenantId ?? ''}:${user?.userId ?? ''}`;
  const runs = useQuery({
    queryKey: ['dwaion', 'user-runs', 'recent-window', identity, DWAION_ACTIVITY_WINDOW_LIMIT],
    queryFn: () => getDwaionUserRuns(undefined, DWAION_ACTIVITY_WINDOW_LIMIT),
    enabled: canLoadRuns,
    staleTime: 15_000,
    refetchInterval: 60_000,
    retry: 1,
    meta: { accessSensitive: true },
  });
  const accessResponseDenied =
    runs.isError && runs.error instanceof HttpError && [401, 403].includes(runs.error.status);
  const runDataUsable = canLoadRuns && !accessResponseDenied;
  const allRuns = runDataUsable ? (runs.data ?? EMPTY_RUNS) : EMPTY_RUNS;
  const visibleRuns = useMemo(() => filterDwaionActivityWindow(allRuns, filter), [allRuns, filter]);
  const metrics = useMemo(() => summarizeDwaionActivityWindow(allRuns), [allRuns]);
  const selectedWindowRun = findExactDwaionRun(allRuns, selectedRunId);
  const selectedRunDetail = useQuery({
    queryKey: ['dwaion', 'user-run', 'detail', identity, selectedRunId],
    queryFn: ({ signal }) => getDwaionUserRun(selectedRunId, signal),
    enabled: canLoadRuns && Boolean(selectedRunId) && !selectedWindowRun,
    staleTime: 15_000,
    refetchInterval: 60_000,
    retry: (count, error) =>
      !(error instanceof TypeError) &&
      !(error instanceof HttpError && [400, 401, 403, 404].includes(error.status)) &&
      count < 1,
    meta: { accessSensitive: true },
  });
  const selectedRun = runDataUsable
    ? (selectedWindowRun ?? (selectedRunDetail.isError ? undefined : selectedRunDetail.data))
    : undefined;
  const selectedRunLoading =
    !selectedRun && canLoadRuns && selectedRunDetail.isPending && Boolean(selectedRunId);
  const exactSelectionActive = Boolean(selectedRunId) && !selectedWindowRun;
  const retrievalError = runs.isError || (exactSelectionActive && selectedRunDetail.isError);
  const retrievalPending =
    runs.isPending || runs.isFetching || (exactSelectionActive && selectedRunDetail.isFetching);
  const refreshRuns = () =>
    Promise.all([runs.refetch(), ...(exactSelectionActive ? [selectedRunDetail.refetch()] : [])]);
  const closeSelection = () =>
    setParams(updateDwaionActivitySelection(params, null), { replace: true });
  const selectRun = (runId: string) => setParams(updateDwaionActivitySelection(params, runId));
  const selectFilter = (value: DwaionActivityFilter) =>
    setParams(updateDwaionActivityFilter(params, value), { replace: true });
  const lastRetrieved = runs.dataUpdatedAt
    ? formatDate(
        new Date(runs.dataUpdatedAt).toISOString(),
        { dateStyle: 'medium', timeStyle: 'short' },
        locale
      )
    : undefined;

  return (
    <PageCanvas>
      <ResourcePageHeader
        eyebrow={t('dwaionActivity.eyebrow')}
        title={t('dwaionActivity.title')}
        description={t('dwaionActivity.description')}
        scope={
          <Stack direction="row" spacing={0.65} alignItems="center">
            <ShieldCheck size={15} color="var(--dwp-product-secondary)" aria-hidden="true" />
            <Typography variant="caption" color="text.secondary">
              {t('dwaionActivity.privacy')}
            </Typography>
          </Stack>
        }
        status={
          <LiveStatus
            state={retrievalError ? 'degraded' : retrievalPending ? 'syncing' : 'live'}
            label={t(
              retrievalError
                ? 'dwaionActivity.status.degraded'
                : retrievalPending
                  ? 'dwaionActivity.status.syncing'
                  : 'dwaionActivity.status.live'
            )}
            detail={
              lastRetrieved
                ? t('dwaionActivity.lastRetrieved', { at: lastRetrieved })
                : t('dwaionActivity.status.pending')
            }
            refreshLabel={t('dwaionActivity.refresh')}
            refreshing={retrievalPending}
            onRefresh={() => void refreshRuns()}
          />
        }
      />

      {runs.data && runDataUsable && (
        <Box sx={{ mt: 3 }}>
          <OperationalKpiStrip
            ariaLabel={t('dwaionActivity.summaryLabel')}
            items={[
              {
                key: 'total',
                value: metrics.total,
                label: t('dwaionActivity.metrics.total'),
                detail: t('dwaionActivity.metrics.totalDetail'),
              },
              {
                key: 'running',
                value: metrics.running,
                label: t('dwaionActivity.metrics.running'),
                detail: t('dwaionActivity.metrics.runningDetail'),
                tone: 'info',
              },
              {
                key: 'completed',
                value: metrics.completed,
                label: t('dwaionActivity.metrics.completed'),
                detail: t('dwaionActivity.metrics.completedDetail'),
                tone: 'success',
              },
              {
                key: 'attention',
                value: metrics.attention,
                label: t('dwaionActivity.metrics.attention'),
                detail: t('dwaionActivity.metrics.attentionDetail'),
                tone: metrics.attention ? 'warning' : 'neutral',
              },
            ]}
          />
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
            {t('dwaionActivity.windowNotice', { count: DWAION_ACTIVITY_WINDOW_LIMIT })}
          </Typography>
        </Box>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 7fr) minmax(20rem, 5fr)' },
          gap: { xs: 2.5, lg: 3 },
          mt: 3.5,
          alignItems: 'start',
        }}
      >
        <Box component="section" aria-labelledby="dwaion-activity-list" sx={{ minWidth: 0 }}>
          <ActivityListHeader
            filter={filter}
            total={allRuns.length}
            visible={visibleRuns.length}
            onFilter={selectFilter}
          />
          <ActivityListBody
            runs={runs}
            visibleRuns={visibleRuns}
            selectedRunId={selectedRunId}
            filter={filter}
            locale={locale}
            onSelect={selectRun}
            onResetFilter={() => selectFilter('ALL')}
            onStart={() => navigate('/dwaion/new')}
          />
        </Box>

        {!mobileInspector && selectedRunId ? (
          <Box sx={{ minWidth: 0, position: { lg: 'sticky' }, top: { lg: 24 } }}>
            <DwaionActivitySelection
              runId={selectedRunId}
              run={selectedRun}
              runLoading={selectedRunLoading}
              locale={locale}
              variant="inline"
              refreshing={retrievalPending}
              onRefresh={() => void refreshRuns()}
              onClose={closeSelection}
            />
          </Box>
        ) : desktopSplit ? (
          <EmptyInspector />
        ) : null}
      </Box>

      {mobileInspector && selectedRunId && (
        <DwaionActivitySelection
          runId={selectedRunId}
          run={selectedRun}
          runLoading={selectedRunLoading}
          locale={locale}
          variant="drawer"
          refreshing={retrievalPending}
          onRefresh={() => void refreshRuns()}
          onClose={closeSelection}
        />
      )}
    </PageCanvas>
  );
}

function ActivityListHeader({
  filter,
  total,
  visible,
  onFilter,
}: {
  filter: DwaionActivityFilter;
  total: number;
  visible: number;
  onFilter: (value: DwaionActivityFilter) => void;
}) {
  const { t } = useTranslation('work');
  return (
    <Stack gap={1.5}>
      <Box>
        <Typography id="dwaion-activity-list" component="h2" variant="h6">
          {t('dwaionActivity.listTitle')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
          {t('dwaionActivity.listDescription')}
        </Typography>
      </Box>
      <Box sx={{ maxWidth: 1, overflowX: 'auto', pb: 0.25 }}>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={filter}
          onChange={(_, value: DwaionActivityFilter | null) => value && onFilter(value)}
          aria-label={t('dwaionActivity.filterLabel')}
          sx={{
            minWidth: 'max-content',
            '& .MuiToggleButton-root': { minHeight: 40, color: 'text.primary' },
            '& .MuiToggleButton-root.Mui-selected': { color: 'text.primary' },
          }}
        >
          {DWAION_ACTIVITY_FILTERS.map((state) => (
            <ToggleButton key={state} value={state}>
              {t(`dwaionActivity.filters.${state}`)}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>
      <Typography variant="caption" color="text.secondary" role="status">
        {t('dwaionActivity.filteredWindow', { visible, total })}
      </Typography>
    </Stack>
  );
}

function ActivityListBody({
  runs,
  visibleRuns,
  selectedRunId,
  filter,
  locale,
  onSelect,
  onResetFilter,
  onStart,
}: {
  runs: ReturnType<typeof useQuery<DwaionUserRun[]>>;
  visibleRuns: DwaionUserRun[];
  selectedRunId: string;
  filter: DwaionActivityFilter;
  locale: 'ko' | 'en';
  onSelect: (runId: string) => void;
  onResetFilter: () => void;
  onStart: () => void;
}) {
  const { t } = useTranslation('work');
  if (runs.isPending) {
    return (
      <Box sx={{ mt: 2 }}>
        <LoadingState label={t('dwaionActivity.loading')} variant="skeleton" size="page" />
      </Box>
    );
  }
  if (runs.isError && !runs.data) {
    return (
      <Box sx={{ mt: 2 }}>
        <LocalErrorState
          title={t('dwaionActivity.errorTitle')}
          description={t('dwaionActivity.errorDescription')}
          size="page"
        />
      </Box>
    );
  }
  if (!visibleRuns.length) {
    const filtered = filter !== 'ALL';
    return (
      <Box sx={{ mt: 2 }}>
        <GuidedEmptyState
          kind={filtered ? 'no-results' : 'empty'}
          title={t(filtered ? 'dwaionActivity.noResultsTitle' : 'dwaionActivity.emptyTitle')}
          description={t(
            filtered ? 'dwaionActivity.noResultsDescription' : 'dwaionActivity.emptyDescription'
          )}
          actionLabel={t(filtered ? 'dwaionActivity.resetFilter' : 'dwaionActivity.start')}
          onAction={filtered ? onResetFilter : onStart}
        />
      </Box>
    );
  }
  return (
    <Box
      component="ul"
      aria-label={t('dwaionActivity.listLabel')}
      sx={{ listStyle: 'none', p: 0, m: 0, mt: 2, borderBlock: 1, borderColor: 'divider' }}
    >
      {visibleRuns.map((run) => (
        <Box component="li" key={run.runId} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <RunRow
            run={run}
            locale={locale}
            selected={run.runId === selectedRunId}
            onSelect={() => onSelect(run.runId)}
          />
        </Box>
      ))}
    </Box>
  );
}

function RunRow({
  run,
  locale,
  selected,
  onSelect,
}: {
  run: DwaionUserRun;
  locale: 'ko' | 'en';
  selected: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation('work');
  const Icon =
    run.runState === 'RUNNING' ? Clock3 : run.runState === 'COMPLETED' ? CheckCircle2 : CircleAlert;
  const agentName = t(`dwaionActivity.agents.${run.agentKey}`, { defaultValue: run.agentKey });
  return (
    <Box
      component="button"
      type="button"
      aria-current={selected ? 'true' : undefined}
      aria-label={t('dwaionActivity.selectRun', {
        agent: agentName,
        state: t(`dwaionActivity.states.${run.runState}`),
      })}
      data-testid={`dwaion-run-${run.runId}`}
      onClick={onSelect}
      sx={{
        width: 1,
        minHeight: 72,
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        px: 1.5,
        py: 1.25,
        border: 0,
        borderInlineStart: 3,
        borderInlineStartColor: selected ? 'var(--dwp-product-accent)' : 'transparent',
        borderRadius: 0,
        bgcolor: selected ? 'action.selected' : 'transparent',
        color: 'text.primary',
        font: 'inherit',
        textAlign: 'left',
        cursor: 'pointer',
        '&:hover': { bgcolor: 'action.hover' },
        '&:focus-visible': {
          outline: '2px solid',
          outlineColor: 'primary.main',
          outlineOffset: -2,
        },
      }}
    >
      <Box
        aria-hidden="true"
        sx={{
          width: 38,
          height: 38,
          display: 'grid',
          placeItems: 'center',
          borderRadius: 'shape.borderRadius',
          bgcolor: 'var(--dwp-product-soft)',
          color: run.runState === 'FAILED' ? 'error.main' : 'var(--dwp-product-accent)',
          flex: '0 0 auto',
        }}
      >
        <Icon size={18} />
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
          <Typography variant="body2" fontWeight={800} sx={{ overflowWrap: 'anywhere' }}>
            {agentName}
          </Typography>
          <Chip
            size="small"
            variant="outlined"
            color={runStateColor(run.runState)}
            label={t(`dwaionActivity.states.${run.runState}`)}
            sx={{ height: 23, color: 'text.primary' }}
          />
          {run.answerState && (
            <Chip
              size="small"
              label={t(`dwaionActivity.answerStates.${run.answerState}`)}
              sx={{ height: 23 }}
            />
          )}
        </Stack>
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.35 }}>
          {t('dwaionActivity.runMeta', {
            risk: run.riskTier,
            sources: run.sourceCount,
            latency: run.latencyMs,
          })}
        </Typography>
        <Stack direction="row" spacing={0.6} alignItems="center" sx={{ mt: 0.35 }}>
          <Bot size={13} aria-hidden="true" />
          <Typography variant="caption" color="text.secondary">
            {t(`dwaionActivity.outcomes.${run.policyOutcome}`)}
          </Typography>
        </Stack>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: '0 0 auto' }}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: { xs: 'none', sm: 'block' }, whiteSpace: 'nowrap' }}
        >
          {formatDate(
            run.completedAt ?? run.createdAt,
            { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' },
            locale
          )}
        </Typography>
        <ChevronRight size={16} aria-hidden="true" />
      </Box>
    </Box>
  );
}

function EmptyInspector() {
  const { t } = useTranslation('work');
  return (
    <Box
      component="aside"
      aria-label={t('dwaionActivity.details.title')}
      sx={{ minWidth: 0, borderLeft: 1, borderColor: 'divider', bgcolor: 'background.paper', p: 3 }}
    >
      <GuidedEmptyState
        kind="empty"
        title={t('dwaionActivity.details.emptyTitle')}
        description={t('dwaionActivity.details.emptyDescription')}
        size="compact"
        announce={false}
      />
    </Box>
  );
}

function runStateColor(state: DwaionUserRun['runState']): 'info' | 'success' | 'error' {
  if (state === 'RUNNING') return 'info';
  if (state === 'COMPLETED') return 'success';
  return 'error';
}
