import { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { LiveStatus, PageCanvas } from '@dwp-frontend/design-system';
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
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { alpha, useTheme } from '@mui/material/styles';

import {
  DWAION_ACTIVITY_WINDOW_LIMIT,
  filterDwaionActivityPeriod,
  filterDwaionActivityWindow,
  findExactDwaionRun,
  resolveDwaionActivityFilter,
  resolveDwaionActivityPeriod,
  summarizeDwaionActivityWindow,
  updateDwaionActivityFilter,
  updateDwaionActivityPeriod,
  updateDwaionActivitySelection,
} from './dwaion-activity-model';
import { DwaionActivitySelection } from './dwaion-activity-selection';
import { DwaionActivityLatency } from './dwaion-activity-latency';
import { DwaionActivitySummary } from './dwaion-activity-summary';
import { ActivityListBody, ActivityListHeader, EmptyInspector } from './dwaion-activity-view';
import { DWAION_ACTIVITY_REFRESH_EVENT } from './dwaion-mobile-shell-profile';

import type { DwaionActivityFilter, DwaionActivityPeriod } from './dwaion-activity-model';

const EMPTY_RUNS: DwaionUserRun[] = [];

export function DwaionActivity() {
  const { t, i18n } = useTranslation('work');
  const navigate = useNavigate();
  const theme = useTheme();
  const compactLayout = useMediaQuery(theme.breakpoints.down('md'));
  const desktopSplit = useMediaQuery(theme.breakpoints.up('lg'));
  const { user, isAuthenticated } = useAuth();
  const { isLoaded, hasPermission } = usePermissions();
  const [params, setParams] = useSearchParams();
  const selectedRunId = params.get('run')?.trim().toLowerCase() ?? '';
  const filter = resolveDwaionActivityFilter(params.get('state'));
  const period = resolveDwaionActivityPeriod(params.get('period'));
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
  const periodRuns = useMemo(() => filterDwaionActivityPeriod(allRuns, period), [allRuns, period]);
  const visibleRuns = useMemo(
    () => filterDwaionActivityWindow(periodRuns, filter),
    [filter, periodRuns]
  );
  const metrics = useMemo(() => summarizeDwaionActivityWindow(periodRuns), [periodRuns]);
  const selectedWindowRun = findExactDwaionRun(allRuns, selectedRunId);
  const selectedRunDetail = useQuery({
    queryKey: ['dwaion', 'user-run', 'detail', identity, selectedRunId],
    queryFn: ({ signal }) => getDwaionUserRun(selectedRunId, signal),
    enabled: runDataUsable && Boolean(selectedRunId) && !selectedWindowRun,
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
    !selectedRun && runDataUsable && selectedRunDetail.isPending && Boolean(selectedRunId);
  const exactSelectionActive = Boolean(selectedRunId) && !selectedWindowRun;
  const selectionAccessDenied =
    !runDataUsable ||
    (exactSelectionActive &&
      selectedRunDetail.isError &&
      selectedRunDetail.error instanceof HttpError &&
      [401, 403].includes(selectedRunDetail.error.status));
  const retrievalError = runs.isError || (exactSelectionActive && selectedRunDetail.isError);
  const retrievalPending =
    runs.isPending || runs.isFetching || (exactSelectionActive && selectedRunDetail.isFetching);
  const refetchRuns = runs.refetch;
  const refetchSelectedRun = selectedRunDetail.refetch;
  const refreshRuns = useCallback(
    () =>
      canLoadRuns
        ? Promise.all([refetchRuns(), ...(exactSelectionActive ? [refetchSelectedRun()] : [])])
        : Promise.resolve([]),
    [canLoadRuns, exactSelectionActive, refetchRuns, refetchSelectedRun]
  );
  useEffect(() => {
    const handleRefresh = () => void refreshRuns();
    globalThis.addEventListener(DWAION_ACTIVITY_REFRESH_EVENT, handleRefresh);
    return () => globalThis.removeEventListener(DWAION_ACTIVITY_REFRESH_EVENT, handleRefresh);
  }, [refreshRuns]);
  const closeSelection = () => {
    const returnTarget = selectedRunId
      ? document.querySelector<HTMLElement>(`[data-testid="dwaion-run-${selectedRunId}"]`)
      : null;
    setParams(updateDwaionActivitySelection(params, null), { replace: true });
    globalThis.requestAnimationFrame(() => returnTarget?.focus({ preventScroll: true }));
  };
  const selectRun = (runId: string) => setParams(updateDwaionActivitySelection(params, runId));
  const selectFilter = (value: DwaionActivityFilter) =>
    setParams(updateDwaionActivityFilter(params, value), { replace: true });
  const selectPeriod = (value: DwaionActivityPeriod) =>
    setParams(updateDwaionActivityPeriod(params, value), { replace: true });
  const lastRetrieved = runs.dataUpdatedAt
    ? formatDate(
        new Date(runs.dataUpdatedAt).toISOString(),
        { dateStyle: 'medium', timeStyle: 'short' },
        locale
      )
    : undefined;

  return (
    <PageCanvas topInset="compact">
      <Box data-testid="dwaion-activity" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
        <Box
          component="header"
          sx={{
            p: { xs: 1.5, sm: 2, lg: 2.25 },
            borderRadius: (theme) => Number(theme.shape.borderRadius) * 1.5 + 'px',
            bgcolor: 'background.paper',
            boxShadow: (theme) => `0 1px 5px ${alpha(theme.palette.text.primary, 0.06)}`,
          }}
        >
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'stretch', md: 'flex-start' }}
            gap={{ xs: 1.25, md: 2 }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography
                component="p"
                variant="overline"
                color="primary.main"
                fontWeight="fontWeightBold"
              >
                {t('dwaionActivity.eyebrow')}
              </Typography>
              <Typography
                component="h1"
                variant={compactLayout ? 'h6' : 'h4'}
                fontWeight="fontWeightBold"
                sx={{ mt: compactLayout ? -0.25 : 0 }}
              >
                {t('dwaionActivity.title')}
              </Typography>
              <Typography
                color="text.secondary"
                variant="body2"
                sx={{ mt: 0.5, maxWidth: 760, display: { xs: 'none', sm: 'block' } }}
              >
                {t('dwaionActivity.description')}
              </Typography>
              <Stack
                direction="row"
                spacing={0.65}
                alignItems="center"
                sx={{ mt: 1, display: { xs: 'none', sm: 'flex' } }}
              >
                <ShieldCheck size={15} color="var(--dwp-product-secondary)" aria-hidden="true" />
                <Typography variant="caption" color="text.secondary">
                  {t('dwaionActivity.privacy')}
                </Typography>
              </Stack>
            </Box>
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
                !compactLayout && lastRetrieved
                  ? t('dwaionActivity.lastRetrieved', { at: lastRetrieved })
                  : !compactLayout
                    ? t('dwaionActivity.status.pending')
                    : undefined
              }
              refreshLabel={t('dwaionActivity.refresh')}
              refreshing={retrievalPending}
              onRefresh={canLoadRuns ? () => void refreshRuns() : undefined}
            />
          </Stack>
        </Box>

        {runs.data && runDataUsable && (
          <DwaionActivitySummary metrics={metrics} filter={filter} onFilter={selectFilter} />
        )}

        <ActivityListHeader
          filter={filter}
          period={period}
          total={periodRuns.length}
          visible={visibleRuns.length}
          onFilter={selectFilter}
          onPeriod={selectPeriod}
          showCounts={runDataUsable && Boolean(runs.data)}
          disabled={!runDataUsable}
        />

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              lg: 'minmax(0, 7fr) minmax(22rem, 5fr)',
            },
            gap: { xs: 1.5, md: 2, lg: 2.25 },
            mt: { xs: 1, md: 1.25 },
            alignItems: 'start',
          }}
        >
          <Box component="section" aria-labelledby="dwaion-activity-list" sx={{ minWidth: 0 }}>
            <ActivityListBody
              runs={runs}
              visibleRuns={visibleRuns}
              selectedRunId={selectedRunId}
              filter={filter}
              locale={locale}
              onSelect={selectRun}
              onResetFilter={() => selectFilter('ALL')}
              onStart={() => navigate('/dwaion/new')}
              accessDenied={accessResponseDenied || (isLoaded && !canLoadRuns)}
              onRefresh={canLoadRuns ? () => void refreshRuns() : undefined}
            />
            {runDataUsable && !runs.isError && !runs.isPending && (
              <DwaionActivityLatency
                runs={visibleRuns}
                selectedRunId={selectedRunId}
                onSelect={selectRun}
              />
            )}
          </Box>

          {selectedRunId ? (
            <Box sx={{ minWidth: 0, position: { lg: 'sticky' }, top: { lg: 16 } }}>
              <DwaionActivitySelection
                runId={selectedRunId}
                run={selectedRun}
                runLoading={selectedRunLoading}
                locale={locale}
                refreshing={retrievalPending}
                accessDenied={selectionAccessDenied}
                onRefresh={() => void refreshRuns()}
                onClose={closeSelection}
              />
            </Box>
          ) : desktopSplit ? (
            <EmptyInspector />
          ) : null}
        </Box>
      </Box>
    </PageCanvas>
  );
}
