import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CircleSlash2,
  FolderSearch2,
  RadioTower,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getAuditOverview } from '@dwp-frontend/shared-utils';
import { formatDate, formatNumber } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';

import { AdminPanelError, AdminPanelLoading } from './admin-ui';
import { RiskScore, severityColor } from './audit-ui';

import type { AuditOverview as AuditOverviewData, AuditWindow } from '@dwp-frontend/shared-utils';
import type { LucideIcon } from 'lucide-react';

const WINDOWS: AuditWindow[] = ['H24', 'D7', 'D30', 'D90'];

function Kpi({
  icon: Icon,
  label,
  value,
  detail,
  tone = 'primary',
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  tone?: 'primary' | 'error' | 'warning' | 'success';
}) {
  return (
    <Box
      sx={{
        minWidth: 0,
        px: 2.25,
        py: 2,
        borderRight: { xs: 0, md: 1 },
        borderBottom: { xs: 1, md: 0 },
        borderColor: 'divider',
        '&:last-of-type': { borderRight: 0, borderBottom: 0 },
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
        <Typography variant="overline" color="text.secondary">
          {label}
        </Typography>
        <Box sx={{ color: `${tone}.main`, display: 'grid', placeItems: 'center' }}>
          <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
        </Box>
      </Stack>
      <Typography component="p" variant="h4" sx={{ mt: 0.75, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
        {detail}
      </Typography>
    </Box>
  );
}

function TrendChart({ data }: { data: AuditOverviewData['trend'] }) {
  const { t } = useTranslation('admin');
  const theme = useTheme();
  const width = 720;
  const height = 190;
  const maximum = Math.max(1, ...data.map((point) => point.total));
  const points = data.map((point, index) => {
    const x = data.length <= 1 ? width / 2 : (index / (data.length - 1)) * width;
    const y = height - (point.total / maximum) * (height - 28) - 12;
    return { ...point, x, y };
  });
  const path = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');

  return (
    <Box
      component="svg"
      role="img"
      aria-label={t('auditControl.overview.trendLabel')}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      sx={{ width: 1, height: 190, display: 'block' }}
    >
      {[0.25, 0.5, 0.75].map((line) => (
        <line
          key={line}
          x1="0"
          x2={width}
          y1={height * line}
          y2={height * line}
          stroke={theme.palette.divider}
          strokeWidth="1"
        />
      ))}
      {path && (
        <>
          <path d={path} fill="none" stroke={theme.palette.primary.main} strokeWidth="3" />
          {points.map((point) => (
            <circle
              key={point.bucket}
              cx={point.x}
              cy={point.y}
              r={point.highRisk ? 4.5 : 3}
              fill={point.highRisk ? theme.palette.error.main : theme.palette.primary.main}
            />
          ))}
        </>
      )}
    </Box>
  );
}

export function AuditOverview() {
  const { t } = useTranslation('admin');
  const [window, setWindow] = useState<AuditWindow>('D7');
  const query = useQuery({
    queryKey: ['audit-control', 'overview', window],
    queryFn: () => getAuditOverview(window),
    refetchInterval: 60_000,
  });

  if (query.isLoading) return <AdminPanelLoading label={t('auditControl.loading')} />;
  if (query.isError || !query.data) {
    return <AdminPanelError message={t('auditControl.loadError')} />;
  }

  const data = query.data;
  const summary = data.summary;
  const sourceRatio = `${summary.healthySources}/${summary.registeredSources}`;
  const maxCategory = Math.max(1, ...data.categories.map((item) => item.count));

  return (
    <Box sx={{ borderTop: 1, borderBottom: 1, borderColor: 'divider' }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
        gap={1.5}
        sx={{ minHeight: 64, px: 2 }}
      >
        <Box>
          <Typography component="h2" variant="subtitle1">
            {t('auditControl.overview.posture')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('auditControl.updated', {
              time: formatDate(data.generatedAt, { timeStyle: 'short' }),
            })}
          </Typography>
        </Box>
        <Stack direction="row" alignItems="center" gap={1}>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={window}
            onChange={(_, value: AuditWindow | null) => value && setWindow(value)}
            aria-label={t('auditControl.filters.window')}
          >
            {WINDOWS.map((item) => (
              <ToggleButton key={item} value={item} sx={{ minWidth: 52 }}>
                {t(`auditControl.windows.${item}`)}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <Tooltip title={t('common.actions.refresh')}>
            <IconButton
              aria-label={t('common.actions.refresh')}
              onClick={() => void query.refetch()}
            >
              <RefreshCw size={18} strokeWidth={1.8} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      <Box
        aria-label={t('auditControl.overview.indicators')}
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(6, 1fr)' },
          borderTop: 1,
          borderColor: 'divider',
        }}
      >
        <Kpi
          icon={Activity}
          label={t('auditControl.kpi.events')}
          value={formatNumber(summary.totalEvents)}
          detail={t('auditControl.kpi.selectedWindow')}
        />
        <Kpi
          icon={ShieldAlert}
          label={t('auditControl.kpi.highRisk')}
          value={formatNumber(summary.highRiskEvents)}
          detail={t('auditControl.kpi.reviewPriority')}
          tone="error"
        />
        <Kpi
          icon={CircleSlash2}
          label={t('auditControl.kpi.denied')}
          value={formatNumber(summary.deniedEvents)}
          detail={t('auditControl.kpi.policyAndAccess')}
          tone="warning"
        />
        <Kpi
          icon={AlertTriangle}
          label={t('auditControl.kpi.findings')}
          value={formatNumber(summary.openFindings)}
          detail={t('auditControl.kpi.openQueue')}
          tone="warning"
        />
        <Kpi
          icon={FolderSearch2}
          label={t('auditControl.kpi.cases')}
          value={formatNumber(summary.activeCases)}
          detail={t('auditControl.kpi.activeInvestigations')}
        />
        <Kpi
          icon={RadioTower}
          label={t('auditControl.kpi.sources')}
          value={sourceRatio}
          detail={t('auditControl.kpi.healthyCollectors')}
          tone="success"
        />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.7fr) minmax(300px, 0.8fr)' },
        }}
      >
        <Box sx={{ p: 2.5, borderTop: 1, borderRight: { lg: 1 }, borderColor: 'divider' }}>
          <Typography component="h3" variant="subtitle1">
            {t('auditControl.overview.trend')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, mb: 2 }}>
            {t('auditControl.overview.trendDescription')}
          </Typography>
          <TrendChart data={data.trend} />
        </Box>
        <Box sx={{ p: 2.5, borderTop: 1, borderColor: 'divider' }}>
          <Typography component="h3" variant="subtitle1">
            {t('auditControl.overview.categories')}
          </Typography>
          <Stack gap={1.4} sx={{ mt: 2 }}>
            {data.categories.map((item) => (
              <Box key={item.key}>
                <Stack direction="row" justifyContent="space-between" gap={2}>
                  <Typography variant="caption" color="text.secondary">
                    {t(`auditControl.category.${item.key}`)}
                  </Typography>
                  <Typography variant="caption" fontWeight={750}>
                    {formatNumber(item.count)}
                  </Typography>
                </Stack>
                <Box
                  sx={(theme) => ({
                    mt: 0.5,
                    height: 5,
                    bgcolor: alpha(theme.palette.text.primary, 0.08),
                  })}
                >
                  <Box
                    sx={{
                      width: `${(item.count / maxCategory) * 100}%`,
                      height: 1,
                      bgcolor: 'primary.main',
                    }}
                  />
                </Box>
              </Box>
            ))}
          </Stack>
        </Box>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.2fr) minmax(0, 1fr)' },
        }}
      >
        <Box sx={{ borderTop: 1, borderRight: { lg: 1 }, borderColor: 'divider' }}>
          <Box sx={{ px: 2.5, py: 2 }}>
            <Typography component="h3" variant="subtitle1">
              {t('auditControl.overview.attention')}
            </Typography>
          </Box>
          <Divider />
          {data.attention.length ? (
            data.attention.map((finding) => (
              <Stack
                key={finding.findingId}
                direction="row"
                alignItems="center"
                gap={2}
                sx={{ minHeight: 72, px: 2.5, borderBottom: 1, borderColor: 'divider' }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography component="p" variant="subtitle2" noWrap>
                    {finding.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {finding.sourceService} / {finding.ruleKey}
                  </Typography>
                </Box>
                <RiskScore value={finding.riskScore} />
                <Chip
                  size="small"
                  variant="outlined"
                  color={severityColor(finding.severity)}
                  label={t(`auditControl.severity.${finding.severity}`)}
                />
              </Stack>
            ))
          ) : (
            <Stack alignItems="center" gap={1} sx={{ py: 5 }}>
              <CheckCircle2 size={24} color="currentColor" />
              <Typography variant="body2" color="text.secondary">
                {t('auditControl.overview.noFindings')}
              </Typography>
            </Stack>
          )}
        </Box>
        <Box sx={{ borderTop: 1, borderColor: 'divider', overflowX: 'auto' }}>
          <Box sx={{ px: 2.5, py: 2 }}>
            <Typography component="h3" variant="subtitle1">
              {t('auditControl.overview.sourceHealth')}
            </Typography>
          </Box>
          <Divider />
          <Table size="small" aria-label={t('auditControl.overview.sourceHealth')}>
            <TableHead>
              <TableRow>
                <TableCell>{t('auditControl.source.service')}</TableCell>
                <TableCell>{t('auditControl.source.status')}</TableCell>
                <TableCell align="right">{t('auditControl.source.events24h')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.sources.map((source) => (
                <TableRow key={source.sourceService}>
                  <TableCell>{source.sourceService}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      variant="outlined"
                      color={source.deliveryStatus === 'HEALTHY' ? 'success' : 'warning'}
                      label={t(`auditControl.source.states.${source.deliveryStatus}`)}
                    />
                  </TableCell>
                  <TableCell align="right">{formatNumber(source.eventCount24h)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </Box>
    </Box>
  );
}
