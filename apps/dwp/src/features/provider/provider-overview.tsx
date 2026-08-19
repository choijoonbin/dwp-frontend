import type { ReactNode } from 'react';
import type { ProviderActionItem, ProviderMetric } from '@dwp-frontend/shared-utils';

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Building2,
  Clock3,
  Globe2,
  Layers3,
  Radio,
  ServerCog,
  ShieldCheck,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { formatNumber, useDisplayDictionary } from '@dwp-frontend/shared-i18n';
import {
  getProviderCommandCenter,
  getProviderReliabilityControl,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  DistributionBar,
  LiveStatus,
  OperationalContextBar,
  SignalMetric,
  foundationTokens,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import {
  formatProviderDate,
  ProviderError,
  ProviderLoading,
  ProviderSectionHeading,
  ProviderStatusChip,
} from './provider-ui';

type QueueFilter = 'ALL' | 'CRITICAL' | 'REVIEW';

function SectionSurface({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Paper component="section" variant="outlined" sx={{ minWidth: 0, p: 2 }}>
      <ProviderSectionHeading title={title} description={description} action={action} />
      <Box sx={{ mt: 1.75 }}>{children}</Box>
    </Paper>
  );
}

function SeverityChip({ severity }: { severity: ProviderActionItem['severity'] }) {
  const { t } = useTranslation('provider');
  const color = severity === 'CRITICAL' ? 'error' : severity === 'HIGH' ? 'warning' : 'default';
  return (
    <Chip size="small" variant="outlined" color={color} label={t(`command.severity.${severity}`)} />
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <Stack direction="row" alignItems="center" gap={0.6}>
      <Box aria-hidden="true" sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: color }} />
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Stack>
  );
}

function DistributionList({ items, color }: { items: ProviderMetric[]; color: string }) {
  const max = Math.max(1, ...items.map((item) => item.count));
  return (
    <Stack gap={1.15}>
      {items.map((item) => (
        <Box key={item.key}>
          <Stack direction="row" justifyContent="space-between" gap={2}>
            <Typography variant="body2" fontWeight={650} noWrap>
              {item.key}
            </Typography>
            <Typography
              variant="body2"
              fontWeight={750}
              sx={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {formatNumber(item.count)}
            </Typography>
          </Stack>
          <Box
            sx={{
              mt: 0.6,
              height: 5,
              overflow: 'hidden',
              bgcolor: 'action.hover',
              borderRadius: 0.5,
            }}
          >
            <Box
              sx={{
                width: `${(item.count / max) * 100}%`,
                height: 1,
                bgcolor: color,
                transition: (theme) => theme.transitions.create('width'),
              }}
            />
          </Box>
        </Box>
      ))}
    </Stack>
  );
}

export function ProviderOverview() {
  const { t } = useTranslation('provider');
  const display = useDisplayDictionary();
  const navigate = useNavigate();
  const [queueFilter, setQueueFilter] = useState<QueueFilter>('ALL');
  const command = useQuery({
    queryKey: ['provider', 'command-center'],
    queryFn: getProviderCommandCenter,
    refetchInterval: 60_000,
  });
  const reliability = useQuery({
    queryKey: ['provider', 'reliability-control'],
    queryFn: getProviderReliabilityControl,
    refetchInterval: 60_000,
  });

  const filteredActions = useMemo(() => {
    const actions = command.data?.actionQueue ?? [];
    if (queueFilter === 'CRITICAL') return actions.filter((item) => item.severity === 'CRITICAL');
    if (queueFilter === 'REVIEW') return actions.filter((item) => item.severity !== 'CRITICAL');
    return actions;
  }, [command.data?.actionQueue, queueFilter]);

  if (command.isLoading) return <ProviderLoading />;
  if (command.isError) return <ProviderError error={command.error} />;
  if (!command.data) return null;

  const data = command.data;
  const serviceTotals = data.services.reduce(
    (summary, service) => ({
      total: summary.total + service.totalInstances,
      healthy: summary.healthy + service.healthyInstances,
      pending: summary.pending + service.pendingInstances,
      degraded: summary.degraded + service.degradedInstances,
      failed: summary.failed + service.failedInstances,
      impactSignals: summary.impactSignals + service.impactedTenants,
    }),
    { total: 0, healthy: 0, pending: 0, degraded: 0, failed: 0, impactSignals: 0 }
  );
  const serviceReadiness = serviceTotals.total
    ? (serviceTotals.healthy / serviceTotals.total) * 100
    : 0;
  const serviceExceptions = serviceTotals.pending + serviceTotals.degraded + serviceTotals.failed;
  const tenantReadiness = data.estate.tenants
    ? (data.estate.activeTenants / data.estate.tenants) * 100
    : 0;
  const criticalActions = data.actionQueue.filter((item) => item.severity === 'CRITICAL').length;
  const primaryAction = data.actionQueue[0];
  const objectiveRisk =
    (reliability.data?.atRiskObjectives ?? 0) + (reliability.data?.exhaustedObjectives ?? 0);
  const operatingTone =
    data.operatingState === 'CRITICAL'
      ? 'error'
      : data.operatingState === 'ATTENTION'
        ? 'warning'
        : 'success';

  const refresh = async () => {
    await Promise.all([command.refetch(), reliability.refetch()]);
  };

  return (
    <Stack gap={2.5} sx={{ width: 1, maxWidth: 1600, mx: 'auto' }}>
      <OperationalContextBar
        label={t('command.context.label')}
        items={[
          {
            label: t('command.context.scope'),
            value: t('command.context.global'),
            icon: <Globe2 size={16} />,
          },
          {
            label: t('command.context.time'),
            value: t('command.context.snapshot'),
            icon: <Clock3 size={16} />,
          },
          {
            label: t('command.context.coverage'),
            value: t('command.context.coverageValue', {
              organizations: data.estate.organizations,
              tenants: data.estate.tenants,
            }),
            icon: <Layers3 size={16} />,
          },
        ]}
        status={
          <LiveStatus
            state={command.isFetching || reliability.isFetching ? 'syncing' : 'live'}
            label={t(
              command.isFetching || reliability.isFetching
                ? 'command.live.syncing'
                : 'command.live.live'
            )}
            detail={t('command.lastEvaluated', { value: formatProviderDate(data.generatedAt) })}
            refreshLabel={t('actions.refresh')}
            refreshing={command.isFetching || reliability.isFetching}
            onRefresh={() => void refresh()}
          />
        }
      />

      <Paper
        component="section"
        variant="outlined"
        sx={(theme) => {
          const color = theme.palette[operatingTone].main;
          return {
            position: 'relative',
            overflow: 'hidden',
            px: { xs: 2, md: 2.5 },
            py: { xs: 2, md: 2.25 },
            bgcolor: alpha(color, theme.palette.mode === 'dark' ? 0.12 : 0.055),
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
                color: `${operatingTone}.main`,
                bgcolor: 'background.paper',
              }}
            >
              {data.operatingState === 'HEALTHY' ? (
                <ShieldCheck size={20} />
              ) : (
                <AlertTriangle size={20} />
              )}
            </Box>
            <Box minWidth={0}>
              <Typography component="h2" variant="h5">
                {t(`command.state.${data.operatingState}`)}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                {t(`command.pulse.${data.operatingState}`, {
                  actions: data.actionQueue.length,
                  critical: criticalActions,
                  incidents: data.activeIncidents,
                })}
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mt: 1.25 }}>
                <Chip
                  size="small"
                  variant="outlined"
                  color={data.activeIncidents ? 'error' : 'success'}
                  label={t('command.pulse.incidents', { count: data.activeIncidents })}
                />
                <Chip
                  size="small"
                  variant="outlined"
                  color={data.actionQueue.length ? 'warning' : 'success'}
                  label={t('command.pulse.actions', { count: data.actionQueue.length })}
                />
                {data.expiringSubscriptions > 0 && (
                  <Chip
                    size="small"
                    variant="outlined"
                    color="warning"
                    label={t('command.expiringContracts', { count: data.expiringSubscriptions })}
                    onClick={() => navigate('/provider/commercial')}
                  />
                )}
              </Stack>
            </Box>
          </Stack>
          {primaryAction && (
            <Button
              variant="contained"
              color={operatingTone}
              endIcon={<ArrowRight size={17} />}
              onClick={() => navigate(primaryAction.route)}
              sx={{ alignSelf: { xs: 'flex-start', md: 'center' }, flexShrink: 0 }}
            >
              {t('command.pulse.openPriority')}
            </Button>
          )}
        </Stack>
      </Paper>

      <Box
        component="section"
        aria-label={t('command.metrics.label')}
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, minmax(0, 1fr))',
            lg: 'repeat(4, minmax(0, 1fr))',
          },
          gap: 1.5,
        }}
      >
        <SignalMetric
          label={t('command.signals.estate')}
          value={`${formatNumber(data.estate.activeTenants)} / ${formatNumber(data.estate.tenants)}`}
          detail={t('command.signals.estateDetail', { count: data.estate.organizations })}
          icon={<Building2 size={18} />}
          tone={tenantReadiness === 100 ? 'success' : 'warning'}
          progress={tenantReadiness}
          progressLabel={t('command.signals.tenantReadiness', {
            value: tenantReadiness.toFixed(1),
          })}
          actionLabel={t('command.signals.openEstate')}
          onClick={() => navigate('/provider/tenants')}
        />
        <SignalMetric
          label={t('command.signals.services')}
          value={`${formatNumber(serviceTotals.healthy)} / ${formatNumber(serviceTotals.total)}`}
          detail={t('command.signals.servicesDetail', {
            exceptions: serviceTotals.degraded + serviceTotals.failed,
          })}
          icon={<ServerCog size={18} />}
          tone={serviceReadiness === 100 ? 'success' : serviceTotals.failed ? 'error' : 'warning'}
          progress={serviceReadiness}
          progressLabel={t('command.signals.serviceReadiness', {
            value: serviceReadiness.toFixed(1),
          })}
          actionLabel={t('command.signals.openServices')}
          onClick={() => navigate('/provider/health')}
        />
        <SignalMetric
          label={t('command.signals.customerImpact')}
          value={formatNumber(data.activeIncidents)}
          detail={t('command.signals.customerImpactDetail', { count: serviceTotals.impactSignals })}
          icon={<AlertTriangle size={18} />}
          tone={data.activeIncidents ? 'error' : 'success'}
          actionLabel={t('command.signals.openIncidents')}
          onClick={() => navigate('/provider/health')}
        />
        <SignalMetric
          label={t('command.signals.controlLoad')}
          value={formatNumber(data.estate.openOperations)}
          detail={t('command.signals.controlLoadDetail', {
            support: data.estate.activeSupportSessions,
            objectives: objectiveRisk,
          })}
          icon={<Activity size={18} />}
          tone={data.estate.openOperations || objectiveRisk ? 'warning' : 'info'}
          actionLabel={t('command.signals.openChanges')}
          onClick={() => navigate('/provider/operations')}
        />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 7fr) minmax(360px, 5fr)' },
          gap: 2,
          alignItems: 'start',
        }}
      >
        <SectionSurface
          title={t('command.queue.title')}
          description={t('command.queue.description')}
          action={
            <Stack direction="row" alignItems="center" gap={1}>
              <ToggleButtonGroup
                exclusive
                size="small"
                value={queueFilter}
                onChange={(_event, value: QueueFilter | null) => value && setQueueFilter(value)}
                aria-label={t('command.queue.filterLabel')}
              >
                <ToggleButton value="ALL">{t('command.queue.filters.all')}</ToggleButton>
                <ToggleButton value="CRITICAL">{t('command.queue.filters.critical')}</ToggleButton>
                <ToggleButton value="REVIEW">{t('command.queue.filters.review')}</ToggleButton>
              </ToggleButtonGroup>
              <ActionButton
                intent="quiet"
                size="small"
                endIcon={<ArrowRight size={16} />}
                onClick={() => navigate('/provider/operations')}
                sx={{ display: { xs: 'none', md: 'inline-flex' } }}
              >
                {t('actions.viewAll')}
              </ActionButton>
            </Stack>
          }
        >
          {filteredActions.length === 0 ? (
            <Stack direction="row" alignItems="center" gap={1} sx={{ py: 2 }}>
              <ShieldCheck size={18} color="currentColor" />
              <Box>
                <Typography variant="body2" fontWeight={700}>
                  {t('command.queue.emptyTitle')}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('command.queue.empty')}
                </Typography>
              </Box>
            </Stack>
          ) : (
            <Stack divider={<Divider flexItem />}>
              {filteredActions.slice(0, 6).map((item) => (
                <ButtonBase
                  key={item.itemId}
                  onClick={() => navigate(item.route)}
                  sx={{ width: 1, py: 1.25, textAlign: 'left', justifyContent: 'flex-start' }}
                >
                  <Box
                    aria-hidden="true"
                    sx={{
                      width: 4,
                      height: 42,
                      flex: '0 0 4px',
                      borderRadius: 0.5,
                      bgcolor:
                        item.severity === 'CRITICAL'
                          ? 'error.main'
                          : item.severity === 'HIGH'
                            ? 'warning.main'
                            : 'info.main',
                    }}
                  />
                  <Box sx={{ ml: 1.25, minWidth: 0, flex: 1 }}>
                    <Stack direction="row" alignItems="center" flexWrap="wrap" gap={0.75}>
                      <Typography variant="body2" fontWeight={750}>
                        {item.title}
                      </Typography>
                      <SeverityChip severity={item.severity} />
                      <Typography variant="caption" color="text.secondary">
                        {t(`command.categories.${item.category}`, { defaultValue: item.category })}
                      </Typography>
                    </Stack>
                    <Typography variant="caption" color="text.secondary" noWrap display="block">
                      {item.detail}
                    </Typography>
                  </Box>
                  <Stack alignItems="flex-end" gap={0.5} sx={{ ml: 1, flexShrink: 0 }}>
                    <Typography variant="caption" color="text.secondary">
                      {formatProviderDate(item.createdAt)}
                    </Typography>
                    <ArrowRight size={15} aria-hidden="true" />
                  </Stack>
                </ButtonBase>
              ))}
            </Stack>
          )}
        </SectionSurface>

        <SectionSurface
          title={t('command.services.title')}
          description={t('command.services.description')}
          action={
            <ActionButton
              intent="quiet"
              size="small"
              endIcon={<ArrowRight size={16} />}
              onClick={() => navigate('/provider/health')}
            >
              {t('command.services.open')}
            </ActionButton>
          }
        >
          {serviceTotals.total > 0 && serviceExceptions === 0 ? (
            <ButtonBase
              onClick={() => navigate('/provider/health')}
              sx={{ width: 1, py: 1, textAlign: 'left', justifyContent: 'flex-start' }}
            >
              <Box
                aria-hidden="true"
                sx={{
                  width: 36,
                  height: 36,
                  flex: '0 0 36px',
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: 1,
                  color: 'success.main',
                  bgcolor: (theme) => alpha(theme.palette.success.main, 0.1),
                }}
              >
                <ShieldCheck size={19} />
              </Box>
              <Box sx={{ ml: 1.25, minWidth: 0, flex: 1 }}>
                <Typography variant="body2" fontWeight={750}>
                  {t('command.services.allHealthyTitle')}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('command.services.allHealthyDetail', {
                    services: data.services.length,
                    instances: serviceTotals.total,
                  })}
                </Typography>
              </Box>
              <ArrowRight size={16} aria-hidden="true" />
            </ButtonBase>
          ) : (
            <>
              <Stack direction="row" flexWrap="wrap" gap={1.25} sx={{ mb: 1.5 }}>
                <LegendItem
                  color={foundationTokens.color.data.teal}
                  label={t('command.services.healthy')}
                />
                <LegendItem
                  color={foundationTokens.color.data.cyan}
                  label={t('command.services.pending')}
                />
                <LegendItem
                  color={foundationTokens.color.data.saffron}
                  label={t('command.services.degraded')}
                />
                <LegendItem
                  color={foundationTokens.color.data.coral}
                  label={t('command.services.failed')}
                />
              </Stack>
              <Stack divider={<Divider flexItem />}>
                {data.services.map((service) => (
                  <ButtonBase
                    key={service.serviceKey}
                    onClick={() => navigate('/provider/health')}
                    sx={{ width: 1, py: 1.15, textAlign: 'left', display: 'block' }}
                  >
                    <Stack
                      direction="row"
                      alignItems="center"
                      justifyContent="space-between"
                      gap={1.5}
                    >
                      <Box minWidth={0}>
                        <Typography variant="body2" fontWeight={750} noWrap>
                          {service.displayName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {t('command.services.instances', {
                            healthy: service.healthyInstances,
                            total: service.totalInstances,
                          })}
                        </Typography>
                      </Box>
                      <Stack direction="row" alignItems="center" gap={1} flexShrink={0}>
                        {service.impactedTenants > 0 && (
                          <Typography variant="caption" color="error.main" fontWeight={700}>
                            {t('command.services.impacted', { count: service.impactedTenants })}
                          </Typography>
                        )}
                        <ProviderStatusChip
                          state={
                            service.failedInstances
                              ? 'FAILED'
                              : service.degradedInstances
                                ? 'DEGRADED'
                                : service.pendingInstances
                                  ? 'PROVISIONING'
                                  : 'READY'
                          }
                        />
                      </Stack>
                    </Stack>
                    <Box sx={{ mt: 0.75 }}>
                      <DistributionBar
                        label={t('command.services.breakdown', {
                          name: service.displayName,
                          healthy: service.healthyInstances,
                          pending: service.pendingInstances,
                          degraded: service.degradedInstances,
                          failed: service.failedInstances,
                        })}
                        segments={[
                          {
                            key: 'healthy',
                            value: service.healthyInstances,
                            color: foundationTokens.color.data.teal,
                          },
                          {
                            key: 'pending',
                            value: service.pendingInstances,
                            color: foundationTokens.color.data.cyan,
                          },
                          {
                            key: 'degraded',
                            value: service.degradedInstances,
                            color: foundationTokens.color.data.saffron,
                          },
                          {
                            key: 'failed',
                            value: service.failedInstances,
                            color: foundationTokens.color.data.coral,
                          },
                        ]}
                      />
                    </Box>
                  </ButtonBase>
                ))}
              </Stack>
            </>
          )}
        </SectionSurface>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 7fr) minmax(360px, 5fr)' },
          gap: 2,
          alignItems: 'start',
        }}
      >
        <SectionSurface
          title={t('command.reliability.title')}
          description={t('command.reliability.description')}
          action={
            <ActionButton
              intent="quiet"
              size="small"
              endIcon={<ArrowRight size={16} />}
              onClick={() => navigate('/provider/health')}
            >
              {t('command.reliability.open')}
            </ActionButton>
          }
        >
          {reliability.isLoading ? (
            <Stack gap={1.25}>
              <Skeleton variant="rounded" height={52} />
              <Skeleton variant="rounded" height={52} />
              <Skeleton variant="rounded" height={52} />
            </Stack>
          ) : reliability.isError || !reliability.data ? (
            <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} gap={1}>
              <AlertTriangle size={18} color="currentColor" />
              <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                {t('command.reliability.unavailable')}
              </Typography>
              <ActionButton intent="quiet" size="small" onClick={() => void reliability.refetch()}>
                {t('actions.retryLoad')}
              </ActionButton>
            </Stack>
          ) : (
            <>
              <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mb: 1.25 }}>
                <Chip
                  size="small"
                  variant="outlined"
                  color="success"
                  label={t('command.reliability.healthy', {
                    count: reliability.data.healthyObjectives,
                  })}
                />
                <Chip
                  size="small"
                  variant="outlined"
                  color={objectiveRisk ? 'warning' : 'default'}
                  label={t('command.reliability.risk', { count: objectiveRisk })}
                />
                <Chip
                  size="small"
                  variant="outlined"
                  color={reliability.data.openDriftFindings ? 'error' : 'default'}
                  label={t('command.reliability.drift', {
                    count: reliability.data.openDriftFindings,
                  })}
                />
              </Stack>
              <Stack divider={<Divider flexItem />}>
                {reliability.data.objectives.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ py: 1.5 }}>
                    {t('command.reliability.empty')}
                  </Typography>
                ) : (
                  reliability.data.objectives.slice(0, 5).map((objective) => {
                    const budget = Math.max(
                      0,
                      Math.min(100, objective.errorBudgetRemainingPct ?? 0)
                    );
                    const budgetColor =
                      objective.complianceState === 'EXHAUSTED'
                        ? foundationTokens.color.data.coral
                        : objective.complianceState === 'AT_RISK'
                          ? foundationTokens.color.data.saffron
                          : foundationTokens.color.data.teal;
                    return (
                      <ButtonBase
                        key={objective.objectiveId}
                        onClick={() => navigate('/provider/health')}
                        sx={{ width: 1, py: 1.1, display: 'block', textAlign: 'left' }}
                      >
                        <Stack
                          direction="row"
                          alignItems="center"
                          justifyContent="space-between"
                          gap={1.5}
                        >
                          <Box minWidth={0}>
                            <Typography variant="body2" fontWeight={750} noWrap>
                              {objective.displayName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {objective.scopeLabel} · {objective.complianceWindowDays}
                              {t('command.reliability.days')}
                            </Typography>
                          </Box>
                          <Stack direction="row" alignItems="center" gap={1} flexShrink={0}>
                            <Typography variant="caption" color="text.secondary">
                              {t('command.reliability.achieved', {
                                value: objective.achievedPct?.toFixed(3) ?? '-',
                                target: objective.targetPct.toFixed(2),
                              })}
                            </Typography>
                            <ProviderStatusChip state={objective.complianceState} />
                          </Stack>
                        </Stack>
                        <Stack direction="row" alignItems="center" gap={1} sx={{ mt: 0.75 }}>
                          <Box
                            role="meter"
                            aria-label={t('command.reliability.budgetLabel', {
                              name: objective.displayName,
                            })}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={Math.round(budget)}
                            sx={{
                              height: 5,
                              flex: 1,
                              overflow: 'hidden',
                              bgcolor: 'action.hover',
                              borderRadius: 0.5,
                            }}
                          >
                            <Box sx={{ width: `${budget}%`, height: 1, bgcolor: budgetColor }} />
                          </Box>
                          <Typography
                            variant="caption"
                            fontWeight={700}
                            sx={{ minWidth: 48, textAlign: 'right' }}
                          >
                            {budget.toFixed(1)}%
                          </Typography>
                        </Stack>
                      </ButtonBase>
                    );
                  })
                )}
              </Stack>
            </>
          )}
        </SectionSurface>

        <SectionSurface
          title={t('command.cells.title')}
          description={t('command.cells.description')}
        >
          <Stack divider={<Divider flexItem />}>
            {data.cells.map((cell) => (
              <ButtonBase
                key={cell.deploymentCellId}
                onClick={() => navigate('/provider/health')}
                sx={{ width: 1, py: 1.2, display: 'block', textAlign: 'left' }}
              >
                <Stack direction="row" justifyContent="space-between" gap={2}>
                  <Box minWidth={0}>
                    <Typography variant="body2" fontWeight={750} noWrap>
                      {cell.displayName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {cell.regionKey} ·{' '}
                      {t('command.cells.instances', { count: cell.serviceInstances })}
                    </Typography>
                  </Box>
                  <Stack alignItems="flex-end" flexShrink={0}>
                    <Typography
                      variant="body2"
                      fontWeight={750}
                      sx={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      {cell.saturationPct.toFixed(1)}%
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t('command.cells.tenantCount', {
                        count: cell.tenantCount,
                        capacity: cell.placementCapacity,
                      })}
                    </Typography>
                  </Stack>
                </Stack>
                <Box
                  sx={{
                    mt: 0.75,
                    height: 6,
                    overflow: 'hidden',
                    bgcolor: 'action.hover',
                    borderRadius: 0.5,
                  }}
                >
                  <Box
                    sx={{
                      width: `${Math.min(100, cell.saturationPct)}%`,
                      height: 1,
                      bgcolor:
                        cell.healthState === 'CRITICAL'
                          ? 'error.main'
                          : cell.healthState === 'ATTENTION'
                            ? 'warning.main'
                            : 'info.main',
                    }}
                  />
                </Box>
              </ButtonBase>
            ))}
          </Stack>
        </SectionSurface>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(320px, 5fr) minmax(0, 7fr)' },
          gap: 2,
          alignItems: 'start',
        }}
      >
        <SectionSurface
          title={t('command.estateMix.title')}
          description={t('command.estateMix.description')}
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
              gap: 2,
            }}
          >
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                {t('command.estateMix.regions')}
              </Typography>
              <DistributionList
                items={data.estate.regions}
                color={foundationTokens.color.data.cyan}
              />
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                {t('command.estateMix.tiers')}
              </Typography>
              <DistributionList
                items={data.estate.serviceTiers}
                color={foundationTokens.color.data.violet}
              />
            </Box>
          </Box>
        </SectionSurface>

        <SectionSurface
          title={t('command.activity.title')}
          description={t('command.activity.description')}
          action={
            <ActionButton
              intent="quiet"
              size="small"
              endIcon={<ArrowRight size={16} />}
              onClick={() => navigate('/provider/audit')}
            >
              {t('actions.viewAll')}
            </ActionButton>
          }
        >
          <Stack divider={<Divider flexItem />}>
            {data.recentActivity.slice(0, 6).map((event) => (
              <ButtonBase
                key={event.auditEventId}
                onClick={() => navigate('/provider/audit')}
                sx={{ width: 1, py: 1.05, textAlign: 'left', justifyContent: 'flex-start' }}
              >
                <Box
                  aria-hidden="true"
                  sx={{
                    width: 30,
                    height: 30,
                    flex: '0 0 30px',
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: 1,
                    color: 'info.main',
                    bgcolor: 'action.hover',
                  }}
                >
                  <Radio size={15} />
                </Box>
                <Box sx={{ ml: 1, minWidth: 0, flex: 1 }}>
                  <Stack direction="row" alignItems="center" gap={0.75}>
                    <Typography variant="body2" fontWeight={700} noWrap>
                      {t(`audit.categories.${event.category}`, { defaultValue: event.category })}
                    </Typography>
                    <ProviderStatusChip state={event.outcome} />
                  </Stack>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    noWrap
                    display="block"
                    sx={{ fontFamily: foundationTokens.font.mono }}
                  >
                    {display('auditActions', event.action)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap display="block">
                    {event.operatorName ?? t('audit.global')} ·{' '}
                    {event.tenantKey ?? t('audit.global')}
                  </Typography>
                </Box>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ ml: 1, whiteSpace: 'nowrap' }}
                >
                  {formatProviderDate(event.occurredAt)}
                </Typography>
              </ButtonBase>
            ))}
          </Stack>
        </SectionSurface>
      </Box>
    </Stack>
  );
}
