import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  CircleSlash2,
  FileSearch,
  Gauge,
  Layers3,
  RadioTower,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getAuditOverview } from '@dwp-frontend/shared-utils';
import { formatDate, formatNumber } from '@dwp-frontend/shared-i18n';

import { alpha, useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { AdminPanelError, AdminPanelLoading } from './admin-ui';
import { RiskScore, severityColor } from './audit-ui';
import { useSystemCodeOptions } from '../../components/use-system-code-options';

import type { AuditOverview as AuditOverviewData, AuditWindow } from '@dwp-frontend/shared-utils';

const WINDOW_FALLBACK: AuditWindow[] = ['H24', 'D7', 'D30', 'D90'];

function TrendChart({ data, label }: { data: AuditOverviewData['trend']; label: string }) {
  const theme = useTheme();
  const width = 820;
  const height = 220;
  const inset = 20;
  const max = Math.max(1, ...data.map((item) => item.total));
  const points = data.map((item, index) => ({
    ...item,
    x: data.length <= 1 ? width / 2 : inset + (index / (data.length - 1)) * (width - inset * 2),
    y: height - inset - (item.total / max) * (height - inset * 2),
    highY: height - inset - (item.highRisk / max) * (height - inset * 2),
  }));
  const totalPath = points
    .map((point, index) => `${index ? 'L' : 'M'}${point.x},${point.y}`)
    .join(' ');
  const riskPath = points
    .map((point, index) => `${index ? 'L' : 'M'}${point.x},${point.highY}`)
    .join(' ');
  const area = points.length
    ? `${totalPath} L${points.at(-1)!.x},${height - inset} L${points[0].x},${height - inset} Z`
    : '';

  return (
    <Box sx={{ width: '100%', height: 250 }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height="100%"
        preserveAspectRatio="none"
        role="img"
        aria-label={label}
      >
        {[0.25, 0.5, 0.75].map((ratio) => (
          <line
            key={ratio}
            x1={inset}
            x2={width - inset}
            y1={height * ratio}
            y2={height * ratio}
            stroke={theme.palette.divider}
            strokeWidth="1"
          />
        ))}
        {area && <path d={area} fill={alpha(theme.palette.primary.main, 0.08)} />}
        {totalPath && (
          <path d={totalPath} fill="none" stroke={theme.palette.primary.main} strokeWidth="3" />
        )}
        {riskPath && (
          <path
            d={riskPath}
            fill="none"
            stroke={theme.palette.error.main}
            strokeWidth="2"
            strokeDasharray="6 5"
          />
        )}
        {points.map((point) => (
          <circle
            key={point.bucket}
            cx={point.x}
            cy={point.y}
            r="3.5"
            fill={theme.palette.background.paper}
            stroke={theme.palette.primary.main}
            strokeWidth="2"
          />
        ))}
      </svg>
    </Box>
  );
}

function PostureMetric({
  icon: Icon,
  label,
  value,
  detail,
  tone = 'primary',
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  detail: string;
  tone?: 'primary' | 'warning' | 'error' | 'success';
}) {
  return (
    <Box sx={{ px: 2, py: 1.75, minWidth: 0, borderRight: { md: 1 }, borderColor: 'divider' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
        <Typography variant="caption" color="text.secondary" fontWeight={700}>
          {label}
        </Typography>
        <Icon size={16} color="currentColor" />
      </Stack>
      <Typography
        component="p"
        variant="h5"
        fontWeight={780}
        color={`${tone}.main`}
        sx={{ mt: 0.75 }}
      >
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary" noWrap display="block">
        {detail}
      </Typography>
    </Box>
  );
}

function DimensionBars({
  title,
  icon: Icon,
  data,
  translate,
}: {
  title: string;
  icon: typeof Activity;
  data: AuditOverviewData['categories'];
  translate?: (key: string) => string;
}) {
  const max = Math.max(1, ...data.map((item) => item.count));
  return (
    <Box sx={{ p: 2.25 }}>
      <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 2 }}>
        <Icon size={17} />
        <Typography component="h3" variant="subtitle2">
          {title}
        </Typography>
      </Stack>
      <Stack gap={1.5}>
        {data.slice(0, 6).map((item) => (
          <Box key={item.key}>
            <Stack direction="row" justifyContent="space-between" gap={2} sx={{ mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary" noWrap>
                {translate ? translate(item.key) : item.key || '—'}
              </Typography>
              <Typography variant="caption" fontWeight={750}>
                {formatNumber(item.count)}
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={(item.count / max) * 100}
              aria-label={`${title}: ${translate ? translate(item.key) : item.key || '—'}`}
              sx={{ height: 5, bgcolor: 'action.hover' }}
            />
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

export function AuditOverview() {
  const { t } = useTranslation('admin');
  const navigate = useNavigate();
  const [window, setWindow] = useState<AuditWindow>('D7');
  const windows = useSystemCodeOptions('PLATFORM.AUDIT.WINDOW', WINDOW_FALLBACK);
  const query = useQuery({
    queryKey: ['audit-control', 'overview', window],
    queryFn: () => getAuditOverview(window),
    refetchInterval: 60_000,
  });

  const riskPosture = useMemo(() => {
    if (!query.data) return 0;
    const summary = query.data.summary;
    const unhealthy = Math.max(0, summary.registeredSources - summary.healthySources);
    return Math.min(
      100,
      summary.openFindings * 18 +
        summary.highRiskEvents * 8 +
        summary.deniedEvents * 3 +
        unhealthy * 20
    );
  }, [query.data]);

  if (query.isLoading) return <AdminPanelLoading label={t('auditControl.loading')} />;
  if (query.isError || !query.data)
    return <AdminPanelError message={t('auditControl.loadError')} />;

  const data = query.data;
  const summary = data.summary;
  const posture = riskPosture >= 70 ? 'CRITICAL' : riskPosture >= 35 ? 'ELEVATED' : 'CONTROLLED';

  return (
    <Box
      sx={{ borderTop: 1, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ sm: 'center' }}
        justifyContent="space-between"
        gap={1.5}
        sx={{ px: 2.25, py: 1.5 }}
      >
        <Box>
          <Typography component="h2" variant="subtitle1">
            {t('auditControl.overview.commandPosture')}
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
            {windows.map((item) => (
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
              <RefreshCw size={18} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      <Box
        sx={(theme) => ({
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(320px, 0.75fr) minmax(0, 1.65fr)' },
          borderTop: 1,
          borderColor: 'divider',
          background: `linear-gradient(110deg, ${alpha(theme.palette.primary.main, 0.08)}, ${alpha(
            theme.palette.success.main,
            0.035
          )} 55%, transparent)`,
        })}
      >
        <Box sx={{ p: { xs: 2.5, lg: 3 }, borderRight: { lg: 1 }, borderColor: 'divider' }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
            <Box>
              <Typography variant="overline" color="text.secondary">
                {t('auditControl.overview.materialRisk')}
              </Typography>
              <Stack direction="row" alignItems="baseline" gap={1.25} sx={{ mt: 0.25 }}>
                <Typography component="p" variant="h2" fontWeight={780}>
                  {riskPosture}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  / 100
                </Typography>
              </Stack>
            </Box>
            <Box
              sx={(theme) => ({
                display: 'grid',
                placeItems: 'center',
                width: 72,
                height: 72,
                borderRadius: '50%',
                color:
                  posture === 'CRITICAL'
                    ? theme.palette.error.main
                    : posture === 'ELEVATED'
                      ? theme.palette.warning.main
                      : theme.palette.success.main,
                background: `conic-gradient(currentColor ${riskPosture * 3.6}deg, ${alpha(
                  theme.palette.text.primary,
                  0.08
                )} 0deg)`,
              })}
            >
              <Box
                sx={{
                  display: 'grid',
                  placeItems: 'center',
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  bgcolor: 'background.paper',
                }}
              >
                <Gauge size={23} />
              </Box>
            </Box>
          </Stack>
          <Chip
            size="small"
            sx={{ mt: 1.5 }}
            color={
              posture === 'CRITICAL' ? 'error' : posture === 'ELEVATED' ? 'warning' : 'success'
            }
            label={t(`auditControl.overview.postureState.${posture}`)}
          />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.25 }}>
            {t(`auditControl.overview.postureGuidance.${posture}`)}
          </Typography>
          <Stack direction="row" gap={1} flexWrap="wrap" sx={{ mt: 2 }}>
            <Button
              variant="contained"
              size="small"
              endIcon={<ArrowUpRight size={16} />}
              onClick={() => navigate('/admin/governance/audit-investigations')}
            >
              {t('auditControl.overview.openWorkbench')}
            </Button>
            <Button
              variant="outlined"
              size="small"
              onClick={() => navigate('/admin/governance/audit-events')}
            >
              {t('auditControl.overview.exploreEvidence')}
            </Button>
          </Stack>
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
          }}
        >
          <PostureMetric
            icon={ShieldAlert}
            label={t('auditControl.kpi.findings')}
            value={formatNumber(summary.openFindings)}
            detail={t('auditControl.kpi.openQueue')}
            tone={summary.openFindings ? 'warning' : 'success'}
          />
          <PostureMetric
            icon={FileSearch}
            label={t('auditControl.kpi.cases')}
            value={formatNumber(summary.activeCases)}
            detail={t('auditControl.kpi.activeInvestigations')}
          />
          <PostureMetric
            icon={AlertTriangle}
            label={t('auditControl.kpi.highRisk')}
            value={formatNumber(summary.highRiskEvents)}
            detail={t('auditControl.kpi.reviewPriority')}
            tone={summary.highRiskEvents ? 'error' : 'success'}
          />
          <PostureMetric
            icon={CircleSlash2}
            label={t('auditControl.kpi.denied')}
            value={formatNumber(summary.deniedEvents)}
            detail={t('auditControl.kpi.policyAndAccess')}
            tone="warning"
          />
          <PostureMetric
            icon={Activity}
            label={t('auditControl.kpi.events')}
            value={formatNumber(summary.totalEvents)}
            detail={t('auditControl.kpi.selectedWindow')}
          />
          <PostureMetric
            icon={RadioTower}
            label={t('auditControl.kpi.sources')}
            value={`${summary.healthySources}/${summary.registeredSources}`}
            detail={t('auditControl.kpi.healthyCollectors')}
            tone={summary.healthySources === summary.registeredSources ? 'success' : 'warning'}
          />
        </Box>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1.45fr) minmax(360px, 0.75fr)' },
          borderTop: 1,
          borderColor: 'divider',
        }}
      >
        <Box sx={{ p: 2.5, borderRight: { xl: 1 }, borderColor: 'divider' }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1}>
            <Box>
              <Typography component="h3" variant="subtitle1">
                {t('auditControl.overview.riskTrajectory')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('auditControl.overview.riskTrajectoryHint')}
              </Typography>
            </Box>
            <Stack direction="row" gap={2}>
              <Stack direction="row" alignItems="center" gap={0.75}>
                <Box sx={{ width: 18, height: 3, bgcolor: 'primary.main' }} />
                <Typography variant="caption">{t('auditControl.overview.allActivity')}</Typography>
              </Stack>
              <Stack direction="row" alignItems="center" gap={0.75}>
                <Box sx={{ width: 18, borderTop: '2px dashed', borderColor: 'error.main' }} />
                <Typography variant="caption">
                  {t('auditControl.overview.highRiskActivity')}
                </Typography>
              </Stack>
            </Stack>
          </Stack>
          <TrendChart data={data.trend} label={t('auditControl.overview.trendLabel')} />
        </Box>

        <Box sx={{ minWidth: 0 }}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ px: 2.25, py: 1.75 }}
          >
            <Stack direction="row" alignItems="center" gap={1}>
              <ShieldAlert size={17} />
              <Typography component="h3" variant="subtitle2">
                {t('auditControl.overview.actionQueue')}
              </Typography>
            </Stack>
            <Button size="small" onClick={() => navigate('/admin/governance/audit-investigations')}>
              {t('auditControl.overview.viewAll')}
            </Button>
          </Stack>
          <Divider />
          {data.attention.length ? (
            data.attention.slice(0, 5).map((finding) => (
              <Box
                component="button"
                type="button"
                key={finding.findingId}
                onClick={() =>
                  navigate(
                    `/admin/governance/audit-investigations?finding=${encodeURIComponent(finding.findingId)}`
                  )
                }
                sx={(theme) => ({
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) auto',
                  width: '100%',
                  p: 1.75,
                  border: 0,
                  borderBottom: `1px solid ${theme.palette.divider}`,
                  bgcolor: 'transparent',
                  color: 'text.primary',
                  textAlign: 'left',
                  cursor: 'pointer',
                  '&:hover': { bgcolor: 'action.hover' },
                })}
              >
                <Box minWidth={0}>
                  <Stack direction="row" alignItems="center" gap={0.75}>
                    <Chip
                      size="small"
                      variant="outlined"
                      color={severityColor(finding.severity)}
                      label={t(`auditControl.severity.${finding.severity}`)}
                    />
                    <Typography component="p" variant="subtitle2" noWrap>
                      {finding.title}
                    </Typography>
                  </Stack>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    noWrap
                    display="block"
                    sx={{ mt: 0.6 }}
                  >
                    {finding.actorId || t('auditControl.investigations.unknownActor')} →{' '}
                    {finding.targetId || '—'}
                  </Typography>
                </Box>
                <RiskScore value={finding.riskScore} />
              </Box>
            ))
          ) : (
            <Stack alignItems="center" gap={1} sx={{ py: 5 }}>
              <CheckCircle2 size={25} />
              <Typography variant="body2" color="text.secondary">
                {t('auditControl.overview.noFindings')}
              </Typography>
            </Stack>
          )}
        </Box>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
          borderTop: 1,
          borderColor: 'divider',
          '& > *:not(:last-child)': { borderRight: { md: 1 }, borderColor: 'divider' },
        }}
      >
        <DimensionBars
          icon={Layers3}
          title={t('auditControl.overview.riskDomains')}
          data={data.categories}
          translate={(key) => t(`auditControl.category.${key}`)}
        />
        <DimensionBars
          icon={UserRound}
          title={t('auditControl.overview.activeActors')}
          data={data.topActors}
        />
        <Box sx={{ p: 2.25 }}>
          <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 2 }}>
            <ShieldCheck size={17} />
            <Typography component="h3" variant="subtitle2">
              {t('auditControl.overview.collectionAssurance')}
            </Typography>
          </Stack>
          <Stack gap={1.25}>
            {data.sources.map((source) => (
              <Stack key={source.sourceService} direction="row" alignItems="center" gap={1}>
                <Box
                  sx={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    bgcolor: source.deliveryStatus === 'HEALTHY' ? 'success.main' : 'warning.main',
                  }}
                />
                <Typography variant="body2" noWrap flex={1}>
                  {source.sourceService}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatNumber(source.eventCount24h)}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}
