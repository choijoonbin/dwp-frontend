import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  Clock3,
  Globe2,
  HeartPulse,
  Layers3,
  Plus,
  ServerCog,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatNumber, useDisplayDictionary } from '@dwp-frontend/shared-i18n';
import {
  createProviderIncident,
  getProviderOperatorProfile,
  getProviderReliabilityControl,
  getProviderServiceHealth,
  listProviderTenants,
  updateProviderIncident,
  useToast,
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
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import type { ProviderServiceIncident } from '@dwp-frontend/shared-utils';

import {
  CreateProviderIncidentDialog,
  ProviderHealthSection,
  UpdateProviderIncidentDialog,
} from './provider-health-components';
import type { ProviderIncidentDraft } from './provider-health-components';
import {
  formatProviderDate,
  ProviderError,
  ProviderLoading,
  ProviderStatusChip,
  providerError,
} from './provider-ui';
import { ProviderReliability } from './provider-reliability';

export function ProviderHealth() {
  const { t } = useTranslation('provider');
  const display = useDisplayDictionary();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [incidentFilter, setIncidentFilter] = useState<'ACTIVE' | 'RESOLVED' | 'ALL'>('ACTIVE');
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<ProviderServiceIncident | null>(null);
  const [busy, setBusy] = useState(false);
  const [showHealthyServices, setShowHealthyServices] = useState(false);
  const health = useQuery({
    queryKey: ['provider', 'health'],
    queryFn: getProviderServiceHealth,
    refetchInterval: 60_000,
  });
  const reliability = useQuery({
    queryKey: ['provider', 'reliability-control'],
    queryFn: getProviderReliabilityControl,
    refetchInterval: 60_000,
  });
  const operator = useQuery({
    queryKey: ['provider', 'operator'],
    queryFn: getProviderOperatorProfile,
  });
  const tenants = useQuery({
    queryKey: ['provider', 'tenants', 'health'],
    queryFn: () => listProviderTenants({ page: 0, size: 100 }),
  });
  const canManageIncidents = operator.data?.permissions.includes('INCIDENT_WRITE') ?? false;
  const canScheduleMaintenance = operator.data?.permissions.includes('MAINTENANCE_WRITE') ?? false;
  const visibleIncidents = useMemo(
    () =>
      (health.data?.incidents ?? []).filter((incident) => {
        const resolved = ['RESOLVED', 'CLOSED'].includes(incident.lifecycleState);
        return incidentFilter === 'ALL' || (incidentFilter === 'RESOLVED' ? resolved : !resolved);
      }),
    [health.data, incidentFilter]
  );

  const refresh = async () => queryClient.invalidateQueries({ queryKey: ['provider'] });
  const createIncident = async (draft: ProviderIncidentDraft) => {
    setBusy(true);
    try {
      await createProviderIncident({
        title: draft.title.trim(),
        severity: draft.severity,
        impactScope: draft.impactScope,
        serviceKey: draft.impactScope === 'SERVICE' ? draft.target : null,
        regionKey: draft.impactScope === 'REGION' ? draft.target : null,
        deploymentCellId: draft.impactScope === 'CELL' ? draft.target : null,
        tenantId: draft.impactScope === 'TENANT' ? draft.target : null,
        customerImpact: draft.customerImpact.trim(),
        publicSummary: draft.publicSummary.trim() || null,
        initialUpdate: draft.initialUpdate.trim(),
      });
      setCreateOpen(false);
      toast.success(t('health.incidents.declared'));
      await refresh();
    } catch (error) {
      toast.error(providerError(error, t('errors.operation')));
    } finally {
      setBusy(false);
    }
  };
  const updateIncident = async (
    state: 'IDENTIFIED' | 'MONITORING' | 'RESOLVED' | 'CLOSED',
    message: string,
    visibility: 'INTERNAL' | 'CUSTOMER'
  ) => {
    if (!selected) return;
    setBusy(true);
    try {
      await updateProviderIncident(selected, state, message, visibility);
      setSelected(null);
      toast.success(t('health.incidents.updated'));
      await refresh();
    } catch (error) {
      toast.error(providerError(error, t('errors.operation')));
    } finally {
      setBusy(false);
    }
  };

  if (health.isLoading || tenants.isLoading || (operator.isLoading && !operator.data))
    return <ProviderLoading />;
  if (health.isError || tenants.isError || (operator.isError && !operator.data))
    return (
      <ProviderError
        error={health.error ?? tenants.error ?? operator.error}
        onRetry={() => void Promise.all([health.refetch(), tenants.refetch(), operator.refetch()])}
        retrying={health.isFetching || tenants.isFetching || operator.isFetching}
      />
    );
  if (!health.data) return null;

  const activeIncidents = health.data.incidents.filter(
    (incident) => !['RESOLVED', 'CLOSED'].includes(incident.lifecycleState)
  );
  const exceptionInstances =
    health.data.pendingInstances + health.data.degradedInstances + health.data.failedInstances;
  const serviceReadiness = health.data.totalInstances
    ? (health.data.healthyInstances / health.data.totalInstances) * 100
    : 0;
  const riskObjectives =
    (reliability.data?.atRiskObjectives ?? 0) + (reliability.data?.exhaustedObjectives ?? 0);
  const totalObjectives = riskObjectives + (reliability.data?.healthyObjectives ?? 0);
  const worstCell = [...health.data.cells].sort(
    (left, right) => right.saturationPct - left.saturationPct
  )[0];
  const cellHeadroom = worstCell ? Math.max(0, 100 - worstCell.saturationPct) : 100;
  const sortedServices = [...health.data.services].sort((left, right) => {
    const leftExceptions =
      left.pendingInstances + left.degradedInstances + left.failedInstances + left.impactedTenants;
    const rightExceptions =
      right.pendingInstances +
      right.degradedInstances +
      right.failedInstances +
      right.impactedTenants;
    return rightExceptions - leftExceptions || left.displayName.localeCompare(right.displayName);
  });
  const operatingTone =
    health.data.operatingState === 'CRITICAL'
      ? 'error'
      : health.data.operatingState === 'ATTENTION'
        ? 'warning'
        : 'success';
  const liveState = health.isFetching || reliability.isFetching ? 'syncing' : 'live';

  return (
    <Stack data-testid="provider-health-canvas" gap={2.5} sx={{ width: 1, minWidth: 0 }}>
      <OperationalContextBar
        label={t('health.context.label')}
        items={[
          {
            label: t('health.context.scope'),
            value: t('health.context.global'),
            icon: <Globe2 size={16} />,
          },
          {
            label: t('health.context.time'),
            value: t('health.context.snapshot'),
            icon: <Clock3 size={16} />,
          },
          {
            label: t('health.context.coverage'),
            value: t('health.context.coverageValue', {
              services: health.data.services.length,
              cells: health.data.cells.length,
            }),
            icon: <Layers3 size={16} />,
          },
        ]}
        status={
          <LiveStatus
            state={liveState}
            label={t(`health.live.${liveState}`)}
            detail={t('health.lastUpdated', {
              value: formatProviderDate(health.data.generatedAt),
            })}
            refreshLabel={t('actions.refresh')}
            refreshing={health.isFetching || reliability.isFetching}
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
              {health.data.operatingState === 'HEALTHY' ? (
                <ShieldCheck size={20} />
              ) : (
                <AlertTriangle size={20} />
              )}
            </Box>
            <Box minWidth={0}>
              <Typography component="h2" variant="h5">
                {t(`health.pulse.title.${health.data.operatingState}`)}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                {t(`health.pulse.detail.${health.data.operatingState}`, {
                  incidents: activeIncidents.length,
                  impacted: health.data.impactedTenants,
                  exceptions: exceptionInstances,
                })}
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mt: 1.25 }}>
                <Chip
                  size="small"
                  variant="outlined"
                  color={activeIncidents.length ? 'error' : 'success'}
                  label={t('health.pulse.incidents', { count: activeIncidents.length })}
                />
                <Chip
                  size="small"
                  variant="outlined"
                  color={health.data.impactedTenants ? 'warning' : 'success'}
                  label={t('health.pulse.impacted', { count: health.data.impactedTenants })}
                />
                <Chip
                  size="small"
                  variant="outlined"
                  color={riskObjectives ? 'warning' : 'success'}
                  label={t('health.pulse.sloRisk', { count: riskObjectives })}
                />
              </Stack>
            </Box>
          </Stack>
          {canManageIncidents && (
            <Button
              variant="contained"
              color={activeIncidents.length ? operatingTone : 'primary'}
              startIcon={activeIncidents.length ? <HeartPulse size={17} /> : <Plus size={17} />}
              onClick={() =>
                activeIncidents[0] ? setSelected(activeIncidents[0]) : setCreateOpen(true)
              }
              sx={{ alignSelf: { xs: 'flex-start', md: 'center' }, flexShrink: 0 }}
            >
              {activeIncidents.length
                ? t('health.pulse.openIncident')
                : t('health.incidents.actions.create')}
            </Button>
          )}
        </Stack>
      </Paper>

      <Box
        component="section"
        aria-label={t('health.signals.label')}
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
          label={t('health.signals.readiness')}
          value={`${formatNumber(health.data.healthyInstances)} / ${formatNumber(health.data.totalInstances)}`}
          detail={t('health.signals.readinessDetail', { exceptions: exceptionInstances })}
          icon={<ServerCog size={18} />}
          tone={
            exceptionInstances ? (health.data.failedInstances ? 'error' : 'warning') : 'success'
          }
          progress={serviceReadiness}
          progressLabel={t('health.signals.readinessProgress', {
            value: serviceReadiness.toFixed(1),
          })}
        />
        <SignalMetric
          label={t('health.signals.customerImpact')}
          value={formatNumber(health.data.impactedTenants)}
          detail={t('health.signals.customerImpactDetail', { incidents: activeIncidents.length })}
          icon={<Users size={18} />}
          tone={health.data.impactedTenants ? 'error' : 'success'}
        />
        <SignalMetric
          label={t('health.signals.reliability')}
          value={
            reliability.data ? `${reliability.data.healthyObjectives} / ${totalObjectives}` : '-'
          }
          detail={
            reliability.isError
              ? t('health.signals.reliabilityUnavailable')
              : t('health.signals.reliabilityDetail', { risk: riskObjectives })
          }
          icon={<HeartPulse size={18} />}
          tone={reliability.isError ? 'neutral' : riskObjectives ? 'warning' : 'success'}
        />
        <SignalMetric
          label={t('health.signals.capacity')}
          value={worstCell ? `${cellHeadroom.toFixed(1)}%` : '-'}
          detail={
            worstCell
              ? t('health.signals.capacityDetail', { cell: worstCell.displayName })
              : t('health.signals.capacityUnavailable')
          }
          icon={<Layers3 size={18} />}
          tone={cellHeadroom < 15 ? 'error' : cellHeadroom < 30 ? 'warning' : 'info'}
          progress={worstCell ? cellHeadroom : undefined}
          progressLabel={
            worstCell
              ? t('health.signals.capacityProgress', { value: cellHeadroom.toFixed(1) })
              : undefined
          }
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
        <ProviderHealthSection
          title={t('health.incidents.title')}
          description={t('health.incidents.description')}
          action={
            <Stack direction="row" alignItems="center" gap={1}>
              <ToggleButtonGroup
                exclusive
                size="small"
                value={incidentFilter}
                onChange={(_event, value: typeof incidentFilter | null) =>
                  value && setIncidentFilter(value)
                }
                aria-label={t('health.incidents.filterLabel')}
              >
                {['ACTIVE', 'RESOLVED', 'ALL'].map((value) => (
                  <ToggleButton key={value} value={value}>
                    {t(`health.incidents.filters.${value}`)}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
              {canManageIncidents && (
                <ActionButton
                  intent="primary"
                  size="small"
                  startIcon={<Plus size={16} />}
                  onClick={() => setCreateOpen(true)}
                  sx={{ display: { xs: 'none', md: 'inline-flex' } }}
                >
                  {t('health.incidents.actions.create')}
                </ActionButton>
              )}
            </Stack>
          }
        >
          {visibleIncidents.length === 0 ? (
            <Stack direction="row" alignItems="center" gap={1.25} sx={{ py: 2 }}>
              <Box
                aria-hidden="true"
                sx={{
                  width: 34,
                  height: 34,
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: 1,
                  color: 'success.main',
                  bgcolor: 'action.hover',
                }}
              >
                <ShieldCheck size={18} />
              </Box>
              <Box>
                <Typography variant="body2" fontWeight={750}>
                  {t('health.incidents.emptyTitle')}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('health.incidents.empty')}
                </Typography>
              </Box>
            </Stack>
          ) : (
            <Stack divider={<Divider flexItem />}>
              {visibleIncidents.map((incident) => (
                <Box key={incident.incidentId} sx={{ py: 1.35 }}>
                  <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    alignItems={{ xs: 'stretch', md: 'flex-start' }}
                    gap={{ xs: 1, md: 1.5 }}
                  >
                    <Box
                      aria-hidden="true"
                      sx={{
                        width: 4,
                        minHeight: 46,
                        flex: '0 0 4px',
                        borderRadius: 0.5,
                        bgcolor:
                          incident.severity === 'SEV1'
                            ? 'error.main'
                            : incident.severity === 'SEV2'
                              ? 'warning.main'
                              : 'info.main',
                      }}
                    />
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Stack direction="row" alignItems="center" flexWrap="wrap" gap={0.75}>
                        <Typography variant="body2" fontWeight={750}>
                          {incident.incidentKey} · {incident.title}
                        </Typography>
                        <Chip
                          size="small"
                          variant="outlined"
                          label={display('severities', incident.severity)}
                        />
                        <ProviderStatusChip state={incident.lifecycleState} />
                      </Stack>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.45 }}>
                        {incident.customerImpact}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ mt: 0.65, display: 'block' }}
                      >
                        {incident.tenantName || t(`health.scopes.${incident.impactScope}`)} ·{' '}
                        {incident.ownerName || t('health.incidents.unassigned')} ·{' '}
                        {formatProviderDate(incident.detectedAt)}
                      </Typography>
                    </Box>
                    {canManageIncidents && incident.lifecycleState !== 'CLOSED' && (
                      <ActionButton
                        intent="quiet"
                        size="small"
                        onClick={() => setSelected(incident)}
                        sx={{ alignSelf: { xs: 'flex-start', md: 'center' }, flexShrink: 0 }}
                      >
                        {t('health.incidents.actions.update')}
                      </ActionButton>
                    )}
                  </Stack>
                </Box>
              ))}
            </Stack>
          )}
        </ProviderHealthSection>

        <ProviderHealthSection
          title={t('health.services.title')}
          description={t('health.services.description')}
          action={
            exceptionInstances === 0 ? (
              <ActionButton
                intent="quiet"
                size="small"
                onClick={() => setShowHealthyServices((value) => !value)}
              >
                {t(showHealthyServices ? 'health.services.collapse' : 'health.services.expand')}
              </ActionButton>
            ) : undefined
          }
        >
          {exceptionInstances === 0 && !showHealthyServices ? (
            <Stack direction="row" alignItems="center" gap={1.25} sx={{ py: 1.5 }}>
              <Box
                aria-hidden="true"
                sx={{
                  width: 38,
                  height: 38,
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: 1,
                  color: 'success.main',
                  bgcolor: 'action.hover',
                }}
              >
                <ShieldCheck size={20} />
              </Box>
              <Box>
                <Typography variant="body2" fontWeight={750}>
                  {t('health.services.allHealthyTitle')}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('health.services.allHealthyDetail', {
                    services: health.data.services.length,
                    instances: health.data.totalInstances,
                  })}
                </Typography>
              </Box>
            </Stack>
          ) : (
            <Stack divider={<Divider flexItem />}>
              {sortedServices.map((service) => {
                const serviceExceptions =
                  service.pendingInstances + service.degradedInstances + service.failedInstances;
                return (
                  <Box key={service.serviceKey} sx={{ py: 1.25 }}>
                    <Stack
                      direction="row"
                      alignItems="center"
                      justifyContent="space-between"
                      gap={1.5}
                    >
                      <Box minWidth={0}>
                        <Stack direction="row" alignItems="center" flexWrap="wrap" gap={0.75}>
                          <Typography variant="body2" fontWeight={750}>
                            {service.displayName}
                          </Typography>
                          <Chip size="small" variant="outlined" label={service.criticality} />
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          {t('health.services.coverage', {
                            healthy: service.healthyInstances,
                            total: service.totalInstances,
                            impacted: service.impactedTenants,
                          })}
                        </Typography>
                      </Box>
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
                    <Box sx={{ mt: 0.8 }}>
                      <DistributionBar
                        label={t('health.services.breakdown', {
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
                    {serviceExceptions > 0 && (
                      <Typography
                        variant="caption"
                        color="warning.main"
                        fontWeight={700}
                        sx={{ mt: 0.55, display: 'block' }}
                      >
                        {t('health.services.exceptions', {
                          count: serviceExceptions,
                          impacted: service.impactedTenants,
                        })}
                      </Typography>
                    )}
                  </Box>
                );
              })}
            </Stack>
          )}
        </ProviderHealthSection>
      </Box>

      <ProviderReliability
        services={health.data.services}
        cells={health.data.cells}
        tenants={tenants.data?.content ?? []}
        canSchedule={canScheduleMaintenance}
      />

      <ProviderHealthSection
        title={t('health.cells.title')}
        description={t('health.cells.description')}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
            columnGap: 2,
          }}
        >
          {health.data.cells.map((cell) => (
            <ButtonBase
              key={cell.deploymentCellId}
              sx={{
                width: 1,
                py: 1.25,
                display: 'block',
                textAlign: 'left',
                borderBottom: 1,
                borderColor: 'divider',
              }}
            >
              <Stack
                direction="row"
                alignItems="flex-start"
                justifyContent="space-between"
                gap={1.5}
              >
                <Box minWidth={0}>
                  <Typography variant="body2" fontWeight={750} noWrap>
                    {cell.displayName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('health.cells.capacity', {
                      region: cell.regionKey,
                      used: cell.tenantCount,
                      total: cell.placementCapacity,
                    })}
                  </Typography>
                </Box>
                <Stack alignItems="flex-end" gap={0.5} flexShrink={0}>
                  <ProviderStatusChip state={cell.healthState} />
                  <Typography variant="caption" fontWeight={750}>
                    {cell.saturationPct.toFixed(1)}%
                  </Typography>
                </Stack>
              </Stack>
              <Box
                role="meter"
                aria-label={t('health.cells.saturationLabel', { name: cell.displayName })}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(cell.saturationPct)}
                sx={{
                  mt: 0.8,
                  height: 6,
                  overflow: 'hidden',
                  borderRadius: 0.5,
                  bgcolor: 'action.hover',
                }}
              >
                <Box
                  sx={{
                    width: `${Math.min(100, cell.saturationPct)}%`,
                    height: 1,
                    bgcolor:
                      cell.saturationPct >= 85
                        ? 'error.main'
                        : cell.saturationPct >= 70
                          ? 'warning.main'
                          : 'info.main',
                  }}
                />
              </Box>
            </ButtonBase>
          ))}
        </Box>
      </ProviderHealthSection>

      {createOpen && (
        <CreateProviderIncidentDialog
          health={health.data}
          tenants={tenants.data?.content ?? []}
          busy={busy}
          onClose={() => setCreateOpen(false)}
          onCreate={createIncident}
        />
      )}
      {selected && (
        <UpdateProviderIncidentDialog
          incident={selected}
          busy={busy}
          onClose={() => setSelected(null)}
          onUpdate={updateIncident}
        />
      )}
    </Stack>
  );
}
