import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Copy,
  Gauge,
  RefreshCw,
  Route,
  Search,
  Server,
  X,
} from 'lucide-react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
  getApiHistoryOverview,
  getApiHistoryTrace,
  listApiHistoryEvents,
} from '@dwp-frontend/shared-utils';
import { EnterpriseDataGrid } from '@dwp-frontend/design-system';
import { formatDate, formatNumber } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
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

import { AdminPanelError, AdminPanelLoading } from './admin-ui';

import type { GridColDef } from '@mui/x-data-grid';
import type {
  ApiHistoryEvent,
  ApiHistoryFilters,
  ApiHistoryObservationPoint,
  ApiHistoryOutcome,
  ApiHistoryTrendPoint,
  ApiHistoryWindow,
} from '@dwp-frontend/shared-utils';
import type { LucideIcon } from 'lucide-react';

const WINDOWS: ApiHistoryWindow[] = ['H1', 'H6', 'H24', 'D7', 'D30'];
const OBSERVATION_POINTS: ApiHistoryObservationPoint[] = ['GATEWAY', 'SERVICE', 'ALL'];
const METHODS = ['ALL', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const OUTCOMES: Array<ApiHistoryOutcome | 'ALL'> = [
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

type MetricProps = {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  tone?: 'neutral' | 'success' | 'warning' | 'error';
};

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function eventTimestamp(value: string): string {
  return formatDate(value, { dateStyle: 'medium', timeStyle: 'medium' });
}

function compactTimestamp(value: string): string {
  return formatDate(value, { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function duration(value: number): string {
  if (value < 1_000) return `${formatNumber(value)} ms`;
  return `${formatNumber(value / 1_000, { maximumFractionDigits: 2 })} s`;
}

function bytes(value?: number | null): string {
  if (value == null) return '—';
  if (value < 1_024) return `${formatNumber(value)} B`;
  if (value < 1_048_576) return `${formatNumber(value / 1_024, { maximumFractionDigits: 1 })} KB`;
  return `${formatNumber(value / 1_048_576, { maximumFractionDigits: 1 })} MB`;
}

function outcomeColor(outcome: ApiHistoryOutcome): 'success' | 'warning' | 'error' | 'default' {
  if (outcome === 'SUCCESS') return 'success';
  if (outcome === 'REDIRECTION' || outcome === 'CLIENT_ERROR') return 'warning';
  if (outcome === 'SERVER_ERROR' || outcome === 'CANCELLED') return 'error';
  return 'default';
}

function Metric({ label, value, hint, icon: Icon, tone = 'neutral' }: MetricProps) {
  const theme = useTheme();
  const colors = {
    neutral: theme.palette.info.main,
    success: theme.palette.success.main,
    warning: theme.palette.warning.main,
    error: theme.palette.error.main,
  };
  const color = colors[tone];
  return (
    <Box
      sx={{
        minWidth: 0,
        minHeight: 112,
        px: { xs: 1.5, md: 2 },
        py: 1.75,
        borderRight: { xs: 0, sm: 1 },
        borderBottom: { xs: 1, md: 0 },
        borderColor: 'divider',
        '&:last-of-type': { borderRight: 0 },
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
        <Typography variant="caption" color="text.secondary" fontWeight={700}>
          {label}
        </Typography>
        <Box
          aria-hidden="true"
          sx={{ width: 28, height: 28, display: 'grid', placeItems: 'center', color }}
        >
          <Icon size={17} strokeWidth={1.8} />
        </Box>
      </Stack>
      <Typography
        component="p"
        sx={{
          mt: 1,
          fontSize: 24,
          lineHeight: 1.1,
          fontWeight: 760,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
        {hint}
      </Typography>
    </Box>
  );
}

function TrafficChart({ points, label }: { points: ApiHistoryTrendPoint[]; label: string }) {
  const theme = useTheme();
  const width = 900;
  const height = 220;
  const padding = { top: 20, right: 16, bottom: 28, left: 36 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maximum = Math.max(1, ...points.map((point) => point.totalRequests));
  const x = (index: number) =>
    padding.left +
    (points.length <= 1 ? chartWidth / 2 : (index / (points.length - 1)) * chartWidth);
  const y = (value: number) => padding.top + chartHeight - (value / maximum) * chartHeight;
  const line = points.map((point, index) => `${x(index)},${y(point.totalRequests)}`).join(' ');
  const barWidth = Math.max(2, Math.min(10, chartWidth / Math.max(1, points.length) - 2));

  return (
    <Box>
      <Box
        component="svg"
        role="img"
        aria-label={label}
        viewBox={`0 0 ${width} ${height}`}
        sx={{ display: 'block', width: 1, height: 220, overflow: 'visible' }}
      >
        {[0, 0.5, 1].map((ratio) => (
          <line
            key={ratio}
            x1={padding.left}
            x2={width - padding.right}
            y1={padding.top + chartHeight * ratio}
            y2={padding.top + chartHeight * ratio}
            stroke={theme.palette.divider}
            strokeWidth="1"
          />
        ))}
        {points.map((point, index) => {
          const errors = point.clientErrors + point.serverErrors;
          const errorHeight = (errors / maximum) * chartHeight;
          return errors > 0 ? (
            <rect
              key={`${point.bucket}-error`}
              x={x(index) - barWidth / 2}
              y={padding.top + chartHeight - errorHeight}
              width={barWidth}
              height={Math.max(2, errorHeight)}
              rx="1"
              fill={point.serverErrors > 0 ? theme.palette.error.main : theme.palette.warning.main}
              opacity="0.75"
            />
          ) : null;
        })}
        {points.length > 1 && (
          <polyline
            points={line}
            fill="none"
            stroke={theme.palette.info.main}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {points.map((point, index) => (
          <circle
            key={point.bucket}
            cx={x(index)}
            cy={y(point.totalRequests)}
            r={points.length > 32 ? 1.5 : 2.75}
            fill={theme.palette.background.paper}
            stroke={theme.palette.info.main}
            strokeWidth="2"
          />
        ))}
        <text x="0" y={padding.top + 5} fill={theme.palette.text.secondary} fontSize="11">
          {formatNumber(maximum)}
        </text>
        <text
          x="0"
          y={padding.top + chartHeight + 4}
          fill={theme.palette.text.secondary}
          fontSize="11"
        >
          0
        </text>
      </Box>
      <Stack direction="row" justifyContent="space-between" gap={2} sx={{ mt: -2.25 }}>
        <Typography variant="caption" color="text.secondary">
          {points[0] ? compactTimestamp(points[0].bucket) : '—'}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {points.at(-1) ? compactTimestamp(points.at(-1)!.bucket) : '—'}
        </Typography>
      </Stack>
    </Box>
  );
}

function CopyValue({ value, label }: { value?: string | null; label: string }) {
  if (!value) return <Typography variant="body2">—</Typography>;
  return (
    <Stack direction="row" alignItems="center" gap={0.5} sx={{ minWidth: 0 }}>
      <Typography
        variant="body2"
        sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        {value}
      </Typography>
      <Tooltip title={label}>
        <IconButton
          size="small"
          aria-label={label}
          onClick={() => void navigator.clipboard.writeText(value)}
        >
          <Copy size={15} />
        </IconButton>
      </Tooltip>
    </Stack>
  );
}

function TraceDrawer({ historyId, onClose }: { historyId: string | null; onClose: () => void }) {
  const { t } = useTranslation('admin');
  const detailQuery = useQuery({
    queryKey: ['admin', 'api-history', 'detail', historyId],
    queryFn: () => getApiHistoryTrace(historyId!),
    enabled: Boolean(historyId),
  });
  const detail = detailQuery.data;

  return (
    <Drawer
      anchor="right"
      open={Boolean(historyId)}
      onClose={onClose}
      slotProps={{
        paper: { sx: { width: { xs: '100%', sm: 540 }, maxWidth: '100%' } },
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ minHeight: 64, px: 2.5, borderBottom: 1, borderColor: 'divider' }}
      >
        <Box>
          <Typography component="h2" variant="subtitle1">
            {t('apiMonitoring.detail.title')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('apiMonitoring.detail.subtitle')}
          </Typography>
        </Box>
        <Tooltip title={t('common.actions.close')}>
          <IconButton aria-label={t('common.actions.close')} onClick={onClose}>
            <X size={19} />
          </IconButton>
        </Tooltip>
      </Stack>
      {detailQuery.isLoading && <AdminPanelLoading label={t('apiMonitoring.detail.loading')} />}
      {detailQuery.isError && (
        <AdminPanelError
          message={errorMessage(detailQuery.error, t('apiMonitoring.detail.loadError'))}
        />
      )}
      {detail && (
        <Box sx={{ overflowY: 'auto' }}>
          <Box sx={{ p: 2.5 }}>
            <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
              <Chip
                label={detail.selected.statusCode}
                size="small"
                color={outcomeColor(detail.selected.outcome)}
                variant="outlined"
              />
              <Chip label={detail.selected.httpMethod} size="small" variant="outlined" />
              <Chip label={detail.selected.observationPoint} size="small" variant="outlined" />
            </Stack>
            <Typography
              component="p"
              variant="subtitle1"
              sx={{ mt: 1.5, overflowWrap: 'anywhere' }}
            >
              {detail.selected.routeTemplate}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              {eventTimestamp(detail.selected.occurredAt)} / {duration(detail.selected.durationMs)}
            </Typography>
          </Box>
          <Divider />
          <Box
            component="dl"
            sx={{
              display: 'grid',
              gridTemplateColumns: '140px minmax(0, 1fr)',
              gap: 0,
              m: 0,
              px: 2.5,
              '& > dt, & > dd': { m: 0, py: 1.25, borderBottom: 1, borderColor: 'divider' },
            }}
          >
            {[
              [t('apiMonitoring.detail.fields.service'), detail.selected.serviceName],
              [t('apiMonitoring.detail.fields.instance'), detail.selected.serviceInstance ?? '—'],
              [
                t('apiMonitoring.detail.fields.actor'),
                detail.selected.actorId ?? detail.selected.actorType,
              ],
              [t('apiMonitoring.detail.fields.auth'), detail.selected.authType],
              [
                t('apiMonitoring.detail.fields.requestSize'),
                bytes(detail.selected.requestSizeBytes),
              ],
              [
                t('apiMonitoring.detail.fields.responseSize'),
                bytes(detail.selected.responseSizeBytes),
              ],
              [t('apiMonitoring.detail.fields.client'), detail.selected.userAgentFamily ?? '—'],
              [t('apiMonitoring.detail.fields.error'), detail.selected.errorType ?? '—'],
            ].map(([term, value]) => (
              <Box key={term} sx={{ display: 'contents' }}>
                <Typography component="dt" variant="caption" color="text.secondary">
                  {term}
                </Typography>
                <Typography component="dd" variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                  {value}
                </Typography>
              </Box>
            ))}
            <Typography component="dt" variant="caption" color="text.secondary">
              {t('apiMonitoring.detail.fields.correlation')}
            </Typography>
            <Box component="dd">
              <CopyValue
                value={detail.selected.correlationId}
                label={t('apiMonitoring.detail.copyCorrelation')}
              />
            </Box>
            <Typography component="dt" variant="caption" color="text.secondary">
              {t('apiMonitoring.detail.fields.trace')}
            </Typography>
            <Box component="dd">
              <CopyValue
                value={detail.selected.traceId}
                label={t('apiMonitoring.detail.copyTrace')}
              />
            </Box>
          </Box>
          <Box sx={{ px: 2.5, py: 2.5 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
              <Typography component="h3" variant="subtitle2">
                {t('apiMonitoring.detail.traceTitle')}
              </Typography>
              <Chip label={detail.trace.length} size="small" variant="outlined" />
            </Stack>
            <Box component="ol" sx={{ listStyle: 'none', p: 0, m: 0, mt: 1.5 }}>
              {detail.trace.map((hop, index) => (
                <Box
                  component="li"
                  key={hop.historyId}
                  sx={{
                    position: 'relative',
                    pl: 3.5,
                    pb: 2,
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      left: 8,
                      top: 10,
                      bottom: index === detail.trace.length - 1 ? 'auto' : -2,
                      width: 1,
                      height: index === detail.trace.length - 1 ? 0 : '100%',
                      bgcolor: 'divider',
                    },
                    '&::after': {
                      content: '""',
                      position: 'absolute',
                      left: 4,
                      top: 6,
                      width: 9,
                      height: 9,
                      borderRadius: '50%',
                      bgcolor: hop.statusCode >= 500 ? 'error.main' : 'success.main',
                      boxShadow: (theme) => `0 0 0 4px ${theme.palette.background.paper}`,
                    },
                  }}
                >
                  <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
                    <Typography variant="subtitle2">{hop.serviceName}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {duration(hop.durationMs)}
                    </Typography>
                  </Stack>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mt: 0.25, overflowWrap: 'anywhere' }}
                  >
                    {hop.observationPoint} / {hop.httpMethod} / {hop.statusCode} /{' '}
                    {hop.routeTemplate}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      )}
    </Drawer>
  );
}

export function ApiMonitoring() {
  const { t } = useTranslation('admin');
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

  const columns = useMemo<GridColDef<ApiHistoryEvent>[]>(
    () => [
      {
        field: 'occurredAt',
        headerName: t('apiMonitoring.events.columns.time'),
        width: 178,
        renderCell: ({ row }) => eventTimestamp(row.occurredAt),
      },
      {
        field: 'statusCode',
        headerName: t('apiMonitoring.events.columns.status'),
        width: 94,
        renderCell: ({ row }) => (
          <Chip
            label={row.statusCode}
            size="small"
            color={outcomeColor(row.outcome)}
            variant="outlined"
          />
        ),
      },
      {
        field: 'httpMethod',
        headerName: t('apiMonitoring.events.columns.method'),
        width: 88,
      },
      {
        field: 'routeTemplate',
        headerName: t('apiMonitoring.events.columns.route'),
        minWidth: 250,
        flex: 1.4,
        renderCell: ({ row }) => (
          <Typography
            variant="body2"
            title={row.routeTemplate}
            sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {row.routeTemplate}
          </Typography>
        ),
      },
      {
        field: 'serviceName',
        headerName: t('apiMonitoring.events.columns.service'),
        minWidth: 160,
        flex: 0.8,
      },
      {
        field: 'durationMs',
        headerName: t('apiMonitoring.events.columns.latency'),
        width: 112,
        align: 'right',
        headerAlign: 'right',
        renderCell: ({ row }) => duration(row.durationMs),
      },
      {
        field: 'actorId',
        headerName: t('apiMonitoring.events.columns.actor'),
        width: 132,
        valueGetter: (_value, row) => row.actorId ?? row.actorType,
      },
      {
        field: 'traceId',
        headerName: t('apiMonitoring.events.columns.trace'),
        width: 156,
        renderCell: ({ row }) => row.traceId?.slice(0, 12) ?? '—',
      },
    ],
    [t]
  );

  if (overviewQuery.isLoading && !overviewQuery.data) {
    return <AdminPanelLoading label={t('apiMonitoring.loading')} />;
  }
  if (overviewQuery.isError && !overviewQuery.data) {
    return (
      <AdminPanelError message={errorMessage(overviewQuery.error, t('apiMonitoring.loadError'))} />
    );
  }

  const overview = overviewQuery.data;
  const summary = overview?.summary;
  const statusMaximum = Math.max(
    1,
    ...(overview?.statusDistribution.map((item) => item.count) ?? [])
  );
  const refresh = () => {
    void overviewQuery.refetch();
    void eventsQuery.refetch();
  };
  const applySearch = () => setQuery(queryInput.trim());

  return (
    <Box data-testid="api-monitoring">
      <Box
        component="section"
        aria-label={t('apiMonitoring.filters.label')}
        sx={{ borderTop: 1, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}
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
            {WINDOWS.map((value) => (
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
            {OBSERVATION_POINTS.map((value) => (
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
              {METHODS.map((value) => (
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
              {OUTCOMES.map((value) => (
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
            </Stack>
          </Stack>
          <Box sx={{ mt: 1.5 }}>
            <TrafficChart
              points={overview?.trend ?? []}
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
        <TableContainer sx={{ borderTop: 1, borderColor: 'divider' }}>
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
          <AdminPanelError
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
              <Box
                component="li"
                key={event.historyId}
                onClick={() => setSelectedHistoryId(event.historyId)}
                sx={{ p: 1.75, borderBottom: 1, borderColor: 'divider', cursor: 'pointer' }}
              >
                <Stack
                  direction="row"
                  alignItems="flex-start"
                  justifyContent="space-between"
                  gap={1.5}
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
            <Button
              variant="text"
              onClick={() => void eventsQuery.fetchNextPage()}
              disabled={eventsQuery.isFetchingNextPage}
            >
              {eventsQuery.isFetchingNextPage
                ? t('apiMonitoring.events.loadingMore')
                : t('apiMonitoring.events.loadMore')}
            </Button>
          </Box>
        )}
      </Box>

      <TraceDrawer historyId={selectedHistoryId} onClose={() => setSelectedHistoryId(null)} />
    </Box>
  );
}
