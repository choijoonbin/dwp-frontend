import { formatNumber, useDisplayDictionary } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';

import {
  apiMonitoringCompactTimestamp,
  apiMonitoringDuration,
  apiMonitoringEventTimestamp,
  apiMonitoringOutcomeColor,
} from './api-monitoring-model';

import type { GridColDef } from '@mui/x-data-grid';
import type { ApiHistoryEvent, ApiHistoryTrendPoint, AuditEvent } from '@dwp-frontend/shared-utils';
import type { TFunction } from 'i18next';
import type { LucideIcon } from 'lucide-react';

type MetricProps = {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  tone?: 'neutral' | 'success' | 'warning' | 'error';
};

export function ApiMonitoringMetric({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'neutral',
}: MetricProps) {
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

export function TrafficChart({
  points,
  changes,
  label,
}: {
  points: ApiHistoryTrendPoint[];
  changes: AuditEvent[];
  label: string;
}) {
  const theme = useTheme();
  const display = useDisplayDictionary();
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
  const changeMarkers = changes
    .map((change) => {
      const occurredAt = new Date(change.occurredAt).getTime();
      const nearestIndex = points.reduce(
        (best, point, index) =>
          Math.abs(new Date(point.bucket).getTime() - occurredAt) < best.distance
            ? { index, distance: Math.abs(new Date(point.bucket).getTime() - occurredAt) }
            : best,
        { index: 0, distance: Number.POSITIVE_INFINITY }
      ).index;
      return { change, index: nearestIndex };
    })
    .filter(() => points.length > 0);

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
        {changeMarkers.map(({ change, index }) => (
          <g key={change.eventId}>
            <line
              x1={x(index)}
              x2={x(index)}
              y1={padding.top}
              y2={padding.top + chartHeight}
              stroke={theme.palette.secondary.main}
              strokeWidth="1"
              strokeDasharray="4 4"
              opacity="0.65"
            />
            <circle
              cx={x(index)}
              cy={padding.top + 5}
              r="4"
              fill={theme.palette.secondary.main}
              stroke={theme.palette.background.paper}
              strokeWidth="1.5"
            >
              <title>{display('auditActions', change.action)}</title>
            </circle>
          </g>
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
          {points[0] ? apiMonitoringCompactTimestamp(points[0].bucket) : '—'}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {points.at(-1) ? apiMonitoringCompactTimestamp(points.at(-1)!.bucket) : '—'}
        </Typography>
      </Stack>
    </Box>
  );
}

export function createApiHistoryColumns(t: TFunction<'admin'>): GridColDef<ApiHistoryEvent>[] {
  return [
    {
      field: 'occurredAt',
      headerName: t('apiMonitoring.events.columns.time'),
      width: 178,
      renderCell: ({ row }) => apiMonitoringEventTimestamp(row.occurredAt),
    },
    {
      field: 'statusCode',
      headerName: t('apiMonitoring.events.columns.status'),
      width: 94,
      renderCell: ({ row }) => (
        <Chip
          label={row.statusCode}
          size="small"
          color={apiMonitoringOutcomeColor(row.outcome)}
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
      renderCell: ({ row }) => apiMonitoringDuration(row.durationMs),
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
  ];
}
