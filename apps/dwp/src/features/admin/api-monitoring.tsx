import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileSearch,
  Gauge,
  Globe2,
  RefreshCw,
  Route,
  Search,
  Server,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
  getApiHistoryOverview,
  listAuditEvents,
  listApiHistoryEvents,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  EnterpriseDataGrid,
  LiveStatus,
  OperationalContextBar,
} from '@dwp-frontend/design-system';
import { formatNumber, useDisplayDictionary } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
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
import { useSystemCodeOptions } from '../../components/use-system-code-options';
import { ApiMonitoringTraceDrawer as TraceDrawer } from './api-monitoring-detail';
import {
  apiMonitoringCompactTimestamp as compactTimestamp,
  apiMonitoringDuration as duration,
  apiMonitoringErrorMessage as errorMessage,
  apiMonitoringEventTimestamp as eventTimestamp,
  apiMonitoringOutcomeColor as outcomeColor,
  auditWindowForApiHistory,
} from './api-monitoring-model';
import {
  ApiMonitoringMetric as Metric,
  TrafficChart,
  createApiHistoryColumns,
} from './api-monitoring-visuals';

import type {
  ApiHistoryFilters,
  ApiHistoryObservationPoint,
  ApiHistoryOutcome,
  ApiHistoryWindow,
} from '@dwp-frontend/shared-utils';

const WINDOW_FALLBACK: ApiHistoryWindow[] = ['H1', 'H6', 'H24', 'D7', 'D30'];
const OBSERVATION_POINT_FALLBACK: ApiHistoryObservationPoint[] = ['GATEWAY', 'SERVICE', 'ALL'];
const METHOD_FALLBACK = ['ALL', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const OUTCOME_FALLBACK: Array<ApiHistoryOutcome | 'ALL'> = [
  'ALL',
  'SUCCESS',
  'CLIENT_ERROR',
  'SERVER_ERROR',
  'CANCELLED',
];
const SERVICES = [
  'ALL',
  'dwp-gateway',
  'dwp-auth-server',
  'dwp-platform-server',
  'dwp-people-server',
  'dwp-provider-server',
  'dwp-agent-runtime',
];

export function ApiMonitoring() {
  const { t } = useTranslation('admin');
  const display = useDisplayDictionary();
  const navigate = useNavigate();
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const [window, setWindow] = useState<ApiHistoryWindow>('H24');
  const [observationPoint, setObservationPoint] = useState<ApiHistoryObservationPoint>('GATEWAY');
  const [serviceName, setServiceName] = useState('ALL');
  const [httpMethod, setHttpMethod] = useState('ALL');
  const [outcome, setOutcome] = useState<ApiHistoryOutcome | 'ALL'>('ALL');
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const windows = useSystemCodeOptions('PLATFORM.API_HISTORY.WINDOW', WINDOW_FALLBACK);
  const observationPoints = useSystemCodeOptions(
    'PLATFORM.API_HISTORY.OBSERVATION_POINT_FILTER',
    OBSERVATION_POINT_FALLBACK
  );
  const methods = useSystemCodeOptions('PLATFORM.API_HISTORY.HTTP_METHOD_FILTER', METHOD_FALLBACK);
  const outcomes = useSystemCodeOptions('PLATFORM.API_HISTORY.OUTCOME_FILTER', OUTCOME_FALLBACK);

  const filters = useMemo<ApiHistoryFilters>(
    () => ({
      window,
      observationPoint,
      serviceName: serviceName === 'ALL' ? undefined : serviceName,
      httpMethod: httpMethod === 'ALL' ? undefined : httpMethod,
      outcome,
      query: query || undefined,
    }),
    [window, observationPoint, serviceName, httpMethod, outcome, query]
  );

  const overviewQuery = useQuery({
    queryKey: ['admin', 'api-history', 'overview', filters],
    queryFn: () => getApiHistoryOverview(filters),
    refetchInterval: autoRefresh ? 30_000 : false,
  });
  const changesQuery = useQuery({
    queryKey: ['admin', 'api-history', 'changes', auditWindowForApiHistory(window)],
    queryFn: () =>
      listAuditEvents({
        window: auditWindowForApiHistory(window),
        category: 'ADMIN_CHANGE',
        severity: 'ALL',
        outcome: 'ALL',
        page: 0,
        size: 20,
      }),
    retry: false,
    refetchInterval: autoRefresh ? 30_000 : false,
  });
  const eventsQuery = useInfiniteQuery({
    queryKey: ['admin', 'api-history', 'events', filters],
    queryFn: ({ pageParam }) => listApiHistoryEvents(filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor || undefined,
    refetchInterval: autoRefresh ? 30_000 : false,
  });
  const events = useMemo(
    () => eventsQuery.data?.pages.flatMap((page) => page.content) ?? [],
    [eventsQuery.data]
  );
  const changeEvents = changesQuery.data?.content ?? [];

  const columns = useMemo(() => createApiHistoryColumns(t), [t]);

  if (overviewQuery.isLoading && !overviewQuery.data) {
    return <ManagementPanelLoading label={t('apiMonitoring.loading')} />;
  }
  if (overviewQuery.isError && !overviewQuery.data) {
    return (
      <ManagementPanelError
        message={errorMessage(overviewQuery.error, t('apiMonitoring.loadError'))}
      />
    );
  }

  const overview = overviewQuery.data;
  const summary = overview?.summary;
  const statusMaximum = Math.max(
    1,
    ...(overview?.statusDistribution.map((item) => item.count) ?? [])
  );
  const monitoringState =
    (summary?.serverErrorRequests ?? 0) > 0 &&
    ((summary?.errorRate ?? 0) >= 5 || (summary?.p99DurationMs ?? 0) > 2_000)
      ? 'CRITICAL'
      : (summary?.serverErrorRequests ?? 0) > 0 || (summary?.p95DurationMs ?? 0) > 1_000
        ? 'ATTENTION'
        : 'HEALTHY';
  const monitoringTone =
    monitoringState === 'CRITICAL'
      ? 'error'
      : monitoringState === 'ATTENTION'
        ? 'warning'
        : 'success';
  const refresh = () => {
    void overviewQuery.refetch();
    void eventsQuery.refetch();
    void changesQuery.refetch();
  };
  const applySearch = () => setQuery(queryInput.trim());

  return (
    <Box data-testid="api-monitoring" sx={{ width: 1, minWidth: 0 }}>
      <OperationalContextBar
        label={t('apiMonitoring.context.label')}
        items={[
          {
            label: t('apiMonitoring.context.window'),
            value: t('apiMonitoring.context.windowValue', {
              window: t(`apiMonitoring.windows.${window}`),
              from: overview?.from ? compactTimestamp(overview.from) : '—',
              to: overview?.to ? compactTimestamp(overview.to) : '—',
            }),
            icon: <Globe2 size={16} />,
          },
          {
            label: t('apiMonitoring.context.observation'),
            value: t(`apiMonitoring.observation.${observationPoint}`),
            icon: <Server size={16} />,
          },
          {
            label: t('apiMonitoring.context.target'),
            value: t('apiMonitoring.context.targetValue', {
              service: serviceName === 'ALL' ? t('apiMonitoring.filters.allServices') : serviceName,
              method: httpMethod === 'ALL' ? t('apiMonitoring.filters.allMethods') : httpMethod,
            }),
            icon: <Route size={16} />,
          },
        ]}
        status={
          <LiveStatus
            state={
              overviewQuery.isFetching || eventsQuery.isFetching || changesQuery.isFetching
                ? 'syncing'
                : changesQuery.isError
                  ? 'degraded'
                  : 'live'
            }
            label={t(
              overviewQuery.isFetching || eventsQuery.isFetching || changesQuery.isFetching
                ? 'apiMonitoring.live.syncing'
                : changesQuery.isError
                  ? 'apiMonitoring.live.changeContextUnavailable'
                  : autoRefresh
                    ? 'apiMonitoring.live.auto'
                    : 'apiMonitoring.live.manual'
            )}
            detail={
              overview?.generatedAt
                ? t('apiMonitoring.generatedAt', {
                    time: eventTimestamp(overview.generatedAt),
                  })
                : undefined
            }
            refreshLabel={t('apiMonitoring.filters.refresh')}
            refreshing={
              overviewQuery.isFetching || eventsQuery.isFetching || changesQuery.isFetching
            }
            onRefresh={refresh}
          />
        }
      />

      <Paper
        component="section"
        variant="outlined"
        sx={(surfaceTheme) => {
          const color = surfaceTheme.palette[monitoringTone].main;
          return {
            position: 'relative',
            overflow: 'hidden',
            mt: 2,
            px: { xs: 2, md: 2.5 },
            py: { xs: 2, md: 2.25 },
            bgcolor: alpha(color, surfaceTheme.palette.mode === 'dark' ? 0.12 : 0.055),
            borderColor: alpha(color, 0.35),
            '&::before': {
              position: 'absolute',
              inset: '0 auto 0 0',
              width: 4,
              bgcolor: color,
              content: '""',
            },
          };
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          alignItems={{ xs: 'stretch', md: 'center' }}
          justifyContent="space-between"
          gap={2}
        >
          <Stack direction="row" alignItems="flex-start" gap={1.25} minWidth={0}>
            <Box
              aria-hidden="true"
              sx={{
                width: 38,
                height: 38,
                flex: '0 0 38px',
                display: 'grid',
                placeItems: 'center',
                borderRadius: 1,
                color: `${monitoringTone}.main`,
                bgcolor: 'background.paper',
              }}
            >
              {monitoringState === 'HEALTHY' ? (
                <CheckCircle2 size={20} />
              ) : (
                <AlertTriangle size={20} />
              )}
            </Box>
            <Box minWidth={0}>
              <Typography component="h2" variant="h5">
                {t(`apiMonitoring.pulse.title.${monitoringState}`)}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                {t(`apiMonitoring.pulse.detail.${monitoringState}`, {
                  errors: summary?.serverErrorRequests ?? 0,
                  rate: formatNumber(summary?.errorRate ?? 0, { maximumFractionDigits: 2 }),
                  latency: duration(summary?.p95DurationMs ?? 0),
                })}
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mt: 1.25 }}>
                <Chip
                  size="small"
                  variant="outlined"
                  color={summary?.serverErrorRequests ? 'error' : 'success'}
                  label={t('apiMonitoring.pulse.errors', {
                    count: summary?.serverErrorRequests ?? 0,
                  })}
                />
                <Chip
                  size="small"
                  variant="outlined"
                  color={(summary?.errorRate ?? 0) >= 5 ? 'error' : 'default'}
                  label={t('apiMonitoring.pulse.errorRate', {
                    value: formatNumber(summary?.errorRate ?? 0, { maximumFractionDigits: 2 }),
                  })}
                />
                <Chip
                  size="small"
                  variant="outlined"
                  color={(summary?.p95DurationMs ?? 0) > 1_000 ? 'warning' : 'default'}
                  label={t('apiMonitoring.pulse.p95', {
                    value: duration(summary?.p95DurationMs ?? 0),
                  })}
                />
              </Stack>
            </Box>
          </Stack>
          <ActionButton
            intent="secondary"
            startIcon={<FileSearch size={17} />}
            onClick={() => navigate('/admin/governance/audit-events')}
            sx={{ alignSelf: { xs: 'flex-start', md: 'center' }, flexShrink: 0 }}
          >
            {t('apiMonitoring.pulse.openEvidence')}
          </ActionButton>
        </Stack>
      </Paper>

      <Box
        component="section"
        aria-label={t('apiMonitoring.filters.label')}
        sx={{
          mt: 2,
          borderTop: 1,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Stack
          direction={{ xs: 'column', lg: 'row' }}
          alignItems={{ xs: 'stretch', lg: 'center' }}
          justifyContent="space-between"
          gap={1.5}
          sx={{ px: { xs: 1.5, md: 2 }, py: 1.5 }}
        >
          <ToggleButtonGroup
            exclusive
            size="small"
            value={window}
            aria-label={t('apiMonitoring.filters.window')}
            onChange={(_event, value: ApiHistoryWindow | null) => value && setWindow(value)}
          >
            {windows.map((value) => (
              <ToggleButton key={value} value={value} sx={{ minWidth: 52 }}>
                {t(`apiMonitoring.windows.${value}`)}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={observationPoint}
            aria-label={t('apiMonitoring.filters.observation')}
            onChange={(_event, value: ApiHistoryObservationPoint | null) =>
              value && setObservationPoint(value)
            }
          >
            {observationPoints.map((value) => (
              <ToggleButton key={value} value={value}>
                {t(`apiMonitoring.observation.${value}`)}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} sx={{ flex: 1 }}>
            <TextField
              select
              size="small"
              label={t('apiMonitoring.filters.service')}
              value={serviceName}
              onChange={(event) => setServiceName(event.target.value)}
              sx={{ minWidth: 180 }}
            >
              {SERVICES.map((value) => (
                <MenuItem key={value} value={value}>
                  {value === 'ALL' ? t('apiMonitoring.filters.allServices') : value}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label={t('apiMonitoring.filters.method')}
              value={httpMethod}
              onChange={(event) => setHttpMethod(event.target.value)}
              sx={{ minWidth: 112 }}
            >
              {methods.map((value) => (
                <MenuItem key={value} value={value}>
                  {value === 'ALL' ? t('apiMonitoring.filters.allMethods') : value}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label={t('apiMonitoring.filters.outcome')}
              value={outcome}
              onChange={(event) => setOutcome(event.target.value as ApiHistoryOutcome | 'ALL')}
              sx={{ minWidth: 154 }}
            >
              {outcomes.map((value) => (
                <MenuItem key={value} value={value}>
                  {t(`apiMonitoring.outcomes.${value}`)}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </Stack>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ xs: 'stretch', sm: 'center' }}
          justifyContent="space-between"
          gap={1.5}
          sx={{ px: { xs: 1.5, md: 2 }, py: 1.25, borderTop: 1, borderColor: 'divider' }}
        >
          <TextField
            size="small"
            value={queryInput}
            onChange={(event) => setQueryInput(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && applySearch()}
            placeholder={t('apiMonitoring.filters.searchPlaceholder')}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={17} />
                  </InputAdornment>
                ),
                endAdornment: queryInput ? (
                  <InputAdornment position="end">
                    <Tooltip title={t('apiMonitoring.filters.search')}>
                      <IconButton
                        size="small"
                        aria-label={t('apiMonitoring.filters.search')}
                        onClick={applySearch}
                      >
                        <ChevronRight size={17} />
                      </IconButton>
                    </Tooltip>
                  </InputAdornment>
                ) : undefined,
              },
            }}
            sx={{ width: { xs: 1, sm: 380 } }}
          />
          <Stack direction="row" alignItems="center" justifyContent="flex-end" gap={0.5}>
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={autoRefresh}
                  onChange={(event) => setAutoRefresh(event.target.checked)}
                />
              }
              label={t('apiMonitoring.filters.autoRefresh')}
              sx={{ mr: 0.5 }}
            />
            <Tooltip title={t('apiMonitoring.filters.refresh')}>
              <IconButton aria-label={t('apiMonitoring.filters.refresh')} onClick={refresh}>
                <RefreshCw size={18} />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </Box>

      <Box
        component="section"
        aria-label={t('apiMonitoring.summary.label')}
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(6, minmax(0, 1fr))' },
          mt: 2,
          borderTop: 1,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Metric
          label={t('apiMonitoring.summary.total')}
          value={formatNumber(summary?.totalRequests ?? 0)}
          hint={t('apiMonitoring.summary.totalHint', {
            window: t(`apiMonitoring.windows.${window}`),
          })}
          icon={Activity}
        />
        <Metric
          label={t('apiMonitoring.summary.throughput')}
          value={formatNumber(summary?.requestsPerMinute ?? 0, { maximumFractionDigits: 1 })}
          hint={t('apiMonitoring.summary.perMinute')}
          icon={Gauge}
        />
        <Metric
          label={t('apiMonitoring.summary.errorRate')}
          value={`${formatNumber(summary?.errorRate ?? 0, { maximumFractionDigits: 2 })}%`}
          hint={t('apiMonitoring.summary.serverErrors', {
            count: summary?.serverErrorRequests ?? 0,
          })}
          icon={summary?.serverErrorRequests ? AlertTriangle : CheckCircle2}
          tone={summary?.serverErrorRequests ? 'error' : 'success'}
        />
        <Metric
          label={t('apiMonitoring.summary.p95')}
          value={duration(summary?.p95DurationMs ?? 0)}
          hint={t('apiMonitoring.summary.latencyHint')}
          icon={Clock3}
          tone={(summary?.p95DurationMs ?? 0) > 1_000 ? 'warning' : 'neutral'}
        />
        <Metric
          label={t('apiMonitoring.summary.p99')}
          value={duration(summary?.p99DurationMs ?? 0)}
          hint={t('apiMonitoring.summary.tailLatency')}
          icon={Clock3}
          tone={(summary?.p99DurationMs ?? 0) > 2_000 ? 'error' : 'neutral'}
        />
        <Metric
          label={t('apiMonitoring.summary.activeRoutes')}
          value={formatNumber(summary?.activeRoutesOrServices ?? 0)}
          hint={t('apiMonitoring.summary.activeRoutesHint')}
          icon={Route}
        />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 2fr) minmax(280px, 1fr)' },
          mt: 2,
          borderTop: 1,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Box component="section" sx={{ p: { xs: 1.5, md: 2.5 }, minWidth: 0 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
            <Box>
              <Typography component="h2" variant="subtitle1">
                {t('apiMonitoring.trend.title')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('apiMonitoring.trend.description')}
              </Typography>
            </Box>
            <Stack direction="row" gap={1.5}>
              <Stack direction="row" alignItems="center" gap={0.5}>
                <Box sx={{ width: 16, height: 2, bgcolor: 'info.main' }} />
                <Typography variant="caption">{t('apiMonitoring.trend.requests')}</Typography>
              </Stack>
              <Stack direction="row" alignItems="center" gap={0.5}>
                <Box sx={{ width: 8, height: 8, bgcolor: 'error.main' }} />
                <Typography variant="caption">{t('apiMonitoring.trend.errors')}</Typography>
              </Stack>
              <Stack direction="row" alignItems="center" gap={0.5}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'secondary.main' }} />
                <Typography variant="caption">{t('apiMonitoring.trend.changes')}</Typography>
              </Stack>
            </Stack>
          </Stack>
          <Box sx={{ mt: 1.5 }}>
            <TrafficChart
              points={overview?.trend ?? []}
              changes={changeEvents}
              label={t('apiMonitoring.trend.chartLabel')}
            />
          </Box>
        </Box>
        <Box
          component="section"
          sx={{
            p: { xs: 1.5, md: 2.5 },
            borderTop: { xs: 1, lg: 0 },
            borderLeft: { lg: 1 },
            borderColor: 'divider',
          }}
        >
          <Typography component="h2" variant="subtitle1">
            {t('apiMonitoring.status.title')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('apiMonitoring.status.description')}
          </Typography>
          <Stack gap={1.5} sx={{ mt: 2.5 }}>
            {(overview?.statusDistribution ?? []).map((item) => {
              const statusTone = item.statusFamily.startsWith('5')
                ? theme.palette.error.main
                : item.statusFamily.startsWith('4')
                  ? theme.palette.warning.main
                  : item.statusFamily.startsWith('3')
                    ? theme.palette.info.main
                    : theme.palette.success.main;
              return (
                <Box key={item.statusFamily}>
                  <Stack direction="row" justifyContent="space-between" gap={2}>
                    <Typography variant="body2" fontWeight={700}>
                      {item.statusFamily}
                    </Typography>
                    <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {formatNumber(item.count)}
                    </Typography>
                  </Stack>
                  <Box sx={{ height: 6, mt: 0.75, bgcolor: 'action.hover', overflow: 'hidden' }}>
                    <Box
                      sx={{
                        width: `${Math.max(2, (item.count / statusMaximum) * 100)}%`,
                        height: 1,
                        bgcolor: statusTone,
                      }}
                    />
                  </Box>
                </Box>
              );
            })}
            {!overview?.statusDistribution.length && (
              <Typography variant="body2" color="text.secondary">
                {t('apiMonitoring.status.empty')}
              </Typography>
            )}
          </Stack>
          <Divider sx={{ my: 2.25 }} />
          <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
            <Box>
              <Typography component="h3" variant="subtitle2">
                {t('apiMonitoring.changes.title')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('apiMonitoring.changes.description')}
              </Typography>
            </Box>
            <Chip
              size="small"
              variant="outlined"
              label={t('apiMonitoring.changes.count', { count: changeEvents.length })}
            />
          </Stack>
          {changesQuery.isError ? (
            <Typography variant="body2" color="warning.main" sx={{ mt: 1.5 }}>
              {t('apiMonitoring.changes.unavailable')}
            </Typography>
          ) : changeEvents.length ? (
            <Stack component="ol" sx={{ p: 0, mt: 1.25, mb: 0, listStyle: 'none' }}>
              {changeEvents.slice(0, 4).map((event) => (
                <Box component="li" key={event.eventId}>
                  <ButtonBase
                    onClick={() =>
                      navigate(
                        `/admin/governance/audit-events?query=${encodeURIComponent(
                          event.correlationId ?? event.action
                        )}`
                      )
                    }
                    sx={{
                      width: 1,
                      py: 1,
                      textAlign: 'left',
                      justifyContent: 'stretch',
                      borderTop: 1,
                      borderColor: 'divider',
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                  >
                    <Box minWidth={0} flex={1}>
                      <Typography
                        variant="body2"
                        fontWeight={700}
                        noWrap
                        title={display('auditActions', event.action)}
                      >
                        {display('auditActions', event.action)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block" noWrap>
                        {event.sourceService} / {compactTimestamp(event.occurredAt)}
                      </Typography>
                    </Box>
                    <ChevronRight size={16} aria-hidden="true" />
                  </ButtonBase>
                </Box>
              ))}
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
              {t('apiMonitoring.changes.empty')}
            </Typography>
          )}
        </Box>
      </Box>

      <Box
        component="section"
        sx={{
          mt: 2,
          borderTop: 1,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ minHeight: 58, px: 2 }}
        >
          <Box>
            <Typography component="h2" variant="subtitle1">
              {t('apiMonitoring.routes.title')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('apiMonitoring.routes.description')}
            </Typography>
          </Box>
          <Chip label={overview?.topRoutes.length ?? 0} size="small" variant="outlined" />
        </Stack>
        <TableContainer
          tabIndex={0}
          role="region"
          aria-label={t('apiMonitoring.routes.tableLabel')}
          sx={{ borderTop: 1, borderColor: 'divider' }}
        >
          <Table size="small" aria-label={t('apiMonitoring.routes.tableLabel')}>
            <TableHead>
              <TableRow>
                <TableCell>{t('apiMonitoring.routes.columns.route')}</TableCell>
                <TableCell>{t('apiMonitoring.routes.columns.service')}</TableCell>
                <TableCell align="right">{t('apiMonitoring.routes.columns.requests')}</TableCell>
                <TableCell align="right">{t('apiMonitoring.routes.columns.errorRate')}</TableCell>
                <TableCell align="right">{t('apiMonitoring.routes.columns.p95')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(overview?.topRoutes ?? []).map((routeMetric) => (
                <TableRow
                  key={`${routeMetric.serviceName}-${routeMetric.httpMethod}-${routeMetric.routeTemplate}`}
                >
                  <TableCell sx={{ maxWidth: 460 }}>
                    <Stack direction="row" alignItems="center" gap={1} sx={{ minWidth: 0 }}>
                      <Chip label={routeMetric.httpMethod} size="small" variant="outlined" />
                      <Typography variant="body2" noWrap title={routeMetric.routeTemplate}>
                        {routeMetric.routeTemplate}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>{routeMetric.serviceName}</TableCell>
                  <TableCell align="right">{formatNumber(routeMetric.totalRequests)}</TableCell>
                  <TableCell align="right">
                    <Typography
                      component="span"
                      variant="body2"
                      color={routeMetric.errorRate > 0 ? 'error.main' : 'text.primary'}
                    >
                      {formatNumber(routeMetric.errorRate, { maximumFractionDigits: 2 })}%
                    </Typography>
                  </TableCell>
                  <TableCell align="right">{duration(routeMetric.p95DurationMs)}</TableCell>
                </TableRow>
              ))}
              {!overview?.topRoutes.length && (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    {t('apiMonitoring.routes.empty')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      <Box
        component="section"
        sx={{
          mt: 2,
          borderTop: 1,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ minHeight: 60, px: 2 }}
        >
          <Stack direction="row" alignItems="center" gap={1}>
            <Server size={18} aria-hidden="true" />
            <Typography component="h2" variant="subtitle1">
              {t('apiMonitoring.events.title')}
            </Typography>
            <Chip label={events.length} size="small" variant="outlined" />
          </Stack>
          <Typography variant="caption" color="text.secondary">
            {overview?.generatedAt
              ? t('apiMonitoring.generatedAt', { time: eventTimestamp(overview.generatedAt) })
              : '—'}
          </Typography>
        </Stack>
        {eventsQuery.isError && (
          <ManagementPanelError
            message={errorMessage(eventsQuery.error, t('apiMonitoring.events.loadError'))}
          />
        )}
        {!eventsQuery.isError && desktop && (
          <EnterpriseDataGrid
            ariaLabel={t('apiMonitoring.events.tableLabel')}
            rows={events}
            columns={columns}
            getRowId={(row) => row.historyId}
            rowHeight={52}
            columnHeaderHeight={52}
            minVisibleRows={3}
            maxVisibleRows={10}
            hideFooter
            loading={eventsQuery.isLoading}
            onRowClick={({ row }) => setSelectedHistoryId(row.historyId)}
            getRowClassName={({ row }) => (row.statusCode >= 500 ? 'api-history-error' : '')}
            sx={{
              border: 0,
              borderRadius: 0,
              borderTop: 1,
              borderColor: 'divider',
              '& .MuiDataGrid-row': { cursor: 'pointer' },
              '& .api-history-error': {
                bgcolor: alpha(theme.palette.error.main, 0.045),
              },
            }}
          />
        )}
        {!eventsQuery.isError && !desktop && (
          <Box
            component="ol"
            sx={{ listStyle: 'none', p: 0, m: 0, borderTop: 1, borderColor: 'divider' }}
          >
            {events.map((event) => (
              <Box component="li" key={event.historyId}>
                <ButtonBase
                  onClick={() => setSelectedHistoryId(event.historyId)}
                  sx={{
                    width: 1,
                    p: 1.75,
                    borderBottom: 1,
                    borderColor: 'divider',
                    justifyContent: 'stretch',
                    textAlign: 'left',
                  }}
                >
                  <Stack
                    direction="row"
                    alignItems="flex-start"
                    justifyContent="space-between"
                    gap={1.5}
                    width={1}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Stack direction="row" alignItems="center" gap={0.75}>
                        <Chip
                          label={event.statusCode}
                          size="small"
                          color={outcomeColor(event.outcome)}
                          variant="outlined"
                        />
                        <Typography variant="caption" fontWeight={700}>
                          {event.httpMethod}
                        </Typography>
                      </Stack>
                      <Typography variant="body2" noWrap sx={{ mt: 1 }}>
                        {event.routeTemplate}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: 'block', mt: 0.35 }}
                      >
                        {event.serviceName} / {eventTimestamp(event.occurredAt)}
                      </Typography>
                    </Box>
                    <Stack alignItems="flex-end" gap={0.5}>
                      <Typography variant="body2" fontWeight={700}>
                        {duration(event.durationMs)}
                      </Typography>
                      <ChevronRight size={17} />
                    </Stack>
                  </Stack>
                </ButtonBase>
              </Box>
            ))}
            {!events.length && !eventsQuery.isLoading && (
              <Box component="li" sx={{ py: 5, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  {t('apiMonitoring.events.empty')}
                </Typography>
              </Box>
            )}
          </Box>
        )}
        {eventsQuery.hasNextPage && (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              p: 1.5,
              borderTop: 1,
              borderColor: 'divider',
            }}
          >
            <ActionButton
              intent="quiet"
              onClick={() => void eventsQuery.fetchNextPage()}
              disabled={eventsQuery.isFetchingNextPage}
            >
              {eventsQuery.isFetchingNextPage
                ? t('apiMonitoring.events.loadingMore')
                : t('apiMonitoring.events.loadMore')}
            </ActionButton>
          </Box>
        )}
      </Box>

      <TraceDrawer historyId={selectedHistoryId} onClose={() => setSelectedHistoryId(null)} />
    </Box>
  );
}
