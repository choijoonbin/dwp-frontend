import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  DatabaseZap,
  Network,
  ShieldCheck,
  UserRoundCheck,
  UsersRound,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ActionButton, ErrorState, LoadingState } from '@dwp-frontend/design-system';
import { formatDate, formatNumber } from '@dwp-frontend/shared-i18n';
import {
  getOrganizationChart,
  listHrisSyncRuns,
  listOrganizationScenarios,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { LucideIcon } from 'lucide-react';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function Metric({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      gap={1.25}
      sx={{ minWidth: 0, px: 2, py: 1.75, borderRight: { md: 1 }, borderColor: 'divider' }}
    >
      <Box
        aria-hidden="true"
        sx={{
          width: 34,
          height: 34,
          flex: '0 0 34px',
          display: 'grid',
          placeItems: 'center',
          color: 'primary.main',
          bgcolor: 'action.selected',
          borderRadius: 1,
        }}
      >
        <Icon size={18} strokeWidth={1.8} />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary" display="block">
          {label}
        </Typography>
        <Typography component="p" variant="h5" sx={{ mt: 0.15 }}>
          {value}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap display="block">
          {detail}
        </Typography>
      </Box>
    </Stack>
  );
}

export function WorkforceOverview() {
  const { t } = useTranslation('workforce');
  const asOf = today();
  const chart = useQuery({
    queryKey: ['workforce', 'overview', 'chart', asOf],
    queryFn: () => getOrganizationChart({ asOf, depth: 12, surface: 'workforce' }),
  });
  const scenarios = useQuery({
    queryKey: ['workforce', 'overview', 'scenarios'],
    queryFn: listOrganizationScenarios,
  });
  const runs = useQuery({
    queryKey: ['workforce', 'overview', 'sync-runs'],
    queryFn: () => listHrisSyncRuns(20),
  });
  const latestRun = useMemo(
    () =>
      [...(runs.data ?? [])].sort(
        (left, right) => new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime()
      )[0],
    [runs.data]
  );

  if (chart.isLoading || scenarios.isLoading || runs.isLoading) {
    return <LoadingState label={t('overview.loading')} size="page" />;
  }
  if (chart.isError || scenarios.isError || runs.isError || !chart.data) {
    return (
      <ErrorState
        title={t('common.loadError')}
        description={t('overview.loadError')}
        size="standard"
      />
    );
  }

  const data = chart.data;
  const draftScenarios = (scenarios.data ?? []).filter((item) => item.lifecycleState === 'DRAFT');
  const quality = data.analysis.dataQualityScore;
  const signals = data.analysis.signals.slice(0, 5);

  return (
    <Stack gap={3}>
      <Box
        sx={{
          borderTop: 1,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', xl: 'repeat(4, 1fr)' },
        }}
      >
        <Metric
          icon={UsersRound}
          label={t('overview.metrics.activeWorkforce')}
          value={formatNumber(data.metrics.activeHeadcount)}
          detail={t('overview.metrics.leaveDetail', { count: data.metrics.onLeaveHeadcount })}
        />
        <Metric
          icon={Building2}
          label={t('overview.metrics.organizations')}
          value={formatNumber(data.metrics.organizationCount)}
          detail={t('overview.metrics.layersDetail', { count: data.analysis.maximumLayers })}
        />
        <Metric
          icon={UserRoundCheck}
          label={t('overview.metrics.openPositions')}
          value={formatNumber(data.metrics.openPositionCount)}
          detail={t('overview.metrics.managersDetail', { count: data.metrics.managerCount })}
        />
        <Metric
          icon={ShieldCheck}
          label={t('overview.metrics.dataQuality')}
          value={`${quality}%`}
          detail={t('overview.metrics.issuesDetail', {
            count:
              data.analysis.missingManagerCount +
              data.analysis.missingGradeCount +
              data.analysis.orphanOrganizationCount,
          })}
        />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1.45fr) minmax(340px, 0.7fr)' },
          borderTop: 1,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Box sx={{ minWidth: 0, p: { xs: 2, md: 2.5 } }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
            <Box>
              <Typography component="h2" variant="h6">
                {t('overview.attention.title')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('overview.attention.description')}
              </Typography>
            </Box>
            <ActionButton
              component={NavLink}
              to="/workforce/organization"
              intent="quiet"
              endIcon={<ArrowRight size={16} />}
            >
              {t('overview.attention.openDesign')}
            </ActionButton>
          </Stack>
          <Stack sx={{ mt: 2 }} divider={<Divider flexItem />}>
            {signals.length ? (
              signals.map((signal) => (
                <Stack
                  key={`${signal.code}-${signal.organizationId ?? 'tenant'}`}
                  direction="row"
                  alignItems="center"
                  gap={1.25}
                  sx={{ minHeight: 54, py: 1 }}
                >
                  <Box
                    sx={{ color: signal.severity === 'CRITICAL' ? 'error.main' : 'warning.main' }}
                  >
                    <AlertTriangle size={18} strokeWidth={1.8} />
                  </Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="body2" fontWeight={700}>
                      {t(`overview.signals.${signal.code}`, { defaultValue: signal.code })}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t('overview.attention.affected', { count: signal.count })}
                    </Typography>
                  </Box>
                  <Chip
                    size="small"
                    variant="outlined"
                    color={signal.severity === 'CRITICAL' ? 'error' : 'warning'}
                    label={t(`overview.severity.${signal.severity}`, {
                      defaultValue: signal.severity,
                    })}
                  />
                </Stack>
              ))
            ) : (
              <Stack direction="row" alignItems="center" gap={1} sx={{ py: 3 }}>
                <CheckCircle2 size={18} color="#16815F" />
                <Typography variant="body2">{t('overview.attention.clear')}</Typography>
              </Stack>
            )}
          </Stack>
        </Box>
        <Box
          sx={{
            p: { xs: 2, md: 2.5 },
            borderTop: { xs: 1, xl: 0 },
            borderLeft: { xl: 1 },
            borderColor: 'divider',
            bgcolor: 'action.hover',
          }}
        >
          <Stack direction="row" alignItems="center" gap={1}>
            <DatabaseZap size={18} strokeWidth={1.8} />
            <Typography component="h2" variant="h6">
              {t('overview.freshness.title')}
            </Typography>
          </Stack>
          <Stack gap={2} sx={{ mt: 2 }}>
            <Box>
              <Stack direction="row" justifyContent="space-between" gap={1}>
                <Typography variant="body2" color="text.secondary">
                  {t('overview.freshness.lastRun')}
                </Typography>
                <Chip
                  size="small"
                  color={latestRun?.lifecycleState === 'SUCCEEDED' ? 'success' : 'default'}
                  label={
                    latestRun
                      ? t(`overview.syncStates.${latestRun.lifecycleState}`, {
                          defaultValue: latestRun.lifecycleState,
                        })
                      : t('overview.freshness.never')
                  }
                />
              </Stack>
              <Typography variant="body2" fontWeight={700} sx={{ mt: 0.5 }}>
                {latestRun
                  ? formatDate(latestRun.startedAt, { dateStyle: 'medium', timeStyle: 'short' })
                  : t('overview.freshness.notAvailable')}
              </Typography>
              {latestRun && (
                <Typography variant="caption" color="text.secondary">
                  {t('overview.freshness.runSummary', {
                    read: latestRun.readCount,
                    changed: latestRun.createdCount + latestRun.updatedCount,
                    rejected: latestRun.rejectedCount,
                  })}
                </Typography>
              )}
            </Box>
            <Box>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  {t('overview.freshness.quality')}
                </Typography>
                <Typography variant="body2" fontWeight={750}>
                  {quality}%
                </Typography>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={quality}
                color={quality >= 90 ? 'success' : quality >= 70 ? 'warning' : 'error'}
                sx={{ mt: 0.75, height: 6, borderRadius: 1 }}
              />
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">
                {t('overview.freshness.draftScenarios')}
              </Typography>
              <Typography variant="h5" sx={{ mt: 0.25 }}>
                {formatNumber(draftScenarios.length)}
              </Typography>
            </Box>
            <ActionButton
              component={NavLink}
              to="/workforce/data-operations"
              intent="secondary"
              endIcon={<ArrowRight size={16} />}
            >
              {t('overview.freshness.openOperations')}
            </ActionButton>
          </Stack>
        </Box>
      </Box>

      <Box
        sx={{ borderTop: 1, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}
      >
        <Stack direction="row" alignItems="center" gap={1} sx={{ px: 2.5, py: 1.5 }}>
          <Network size={18} strokeWidth={1.8} />
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography component="h2" variant="subtitle1">
              {t('overview.structure.title')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('overview.structure.description', { date: data.asOf })}
            </Typography>
          </Box>
          <Chip
            size="small"
            variant="outlined"
            label={t('overview.structure.health', { score: data.analysis.healthScore })}
          />
        </Stack>
      </Box>
    </Stack>
  );
}
