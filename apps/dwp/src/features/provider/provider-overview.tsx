import { useTranslation } from 'react-i18next';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Building2,
  Clock3,
  Headphones,
  RefreshCw,
  ServerCog,
  ShieldCheck,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getProviderCommandCenter } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import type { LucideIcon } from 'lucide-react';

import {
  formatProviderDate,
  ProviderError,
  ProviderLoading,
  ProviderSectionHeading,
  ProviderStatusChip,
} from './provider-ui';

type Metric = { label: string; value: number; icon: LucideIcon; tone?: string };

export function ProviderOverview() {
  const { t } = useTranslation('provider');
  const navigate = useNavigate();
  const command = useQuery({
    queryKey: ['provider', 'command-center'],
    queryFn: getProviderCommandCenter,
    refetchInterval: 60_000,
  });

  if (command.isLoading) return <ProviderLoading />;
  if (command.isError) return <ProviderError error={command.error} />;
  if (!command.data) return null;

  const data = command.data;
  const serviceExceptions = data.services.reduce(
    (total, service) => total + service.degradedInstances + service.failedInstances,
    0
  );
  const metrics: Metric[] = [
    {
      label: t('command.metrics.customers'),
      value: data.estate.organizations,
      icon: Building2,
    },
    {
      label: t('command.metrics.activeTenants'),
      value: data.estate.activeTenants,
      icon: ServerCog,
    },
    {
      label: t('command.metrics.serviceExceptions'),
      value: serviceExceptions,
      icon: Activity,
      tone: serviceExceptions ? 'warning.main' : 'success.main',
    },
    {
      label: t('command.metrics.openChanges'),
      value: data.estate.openOperations,
      icon: Clock3,
    },
    {
      label: t('command.metrics.incidents'),
      value: data.activeIncidents,
      icon: AlertTriangle,
      tone: data.activeIncidents ? 'error.main' : 'success.main',
    },
    {
      label: t('command.metrics.support'),
      value: data.estate.activeSupportSessions,
      icon: Headphones,
    },
  ];

  return (
    <Stack gap={3}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
        gap={1.5}
        sx={{ py: 1.5, borderBlock: 1, borderColor: 'divider' }}
      >
        <Stack direction="row" alignItems="center" gap={1.25}>
          <Box
            aria-hidden
            sx={{
              width: 9,
              height: 9,
              borderRadius: '50%',
              bgcolor:
                data.operatingState === 'HEALTHY'
                  ? 'success.main'
                  : data.operatingState === 'CRITICAL'
                    ? 'error.main'
                    : 'warning.main',
              boxShadow: (theme) => `0 0 0 4px ${theme.palette.action.hover}`,
            }}
          />
          <Box>
            <Typography variant="subtitle2" fontWeight={750}>
              {t(`command.state.${data.operatingState}`)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('command.lastEvaluated', { value: formatProviderDate(data.generatedAt) })}
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" alignItems="center" gap={0.5}>
          {data.expiringSubscriptions > 0 && (
            <Chip
              size="small"
              color="warning"
              variant="outlined"
              label={t('command.expiringContracts', { count: data.expiringSubscriptions })}
              onClick={() => navigate('/provider/commercial')}
            />
          )}
          <Tooltip title={t('actions.refresh')}>
            <IconButton aria-label={t('actions.refresh')} onClick={() => void command.refetch()}>
              <RefreshCw size={18} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      <Box
        component="section"
        aria-label={t('command.metrics.label')}
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(2, minmax(0, 1fr))',
            md: 'repeat(3, minmax(0, 1fr))',
            xl: 'repeat(6, minmax(0, 1fr))',
          },
          borderBlock: 1,
          borderColor: 'divider',
        }}
      >
        {metrics.map(({ label, value, icon: Icon, tone }, index) => (
          <Box
            key={label}
            sx={{
              minWidth: 0,
              p: 1.75,
              borderLeft: {
                xs: index % 2 === 0 ? 0 : 1,
                md: index % 3 === 0 ? 0 : 1,
                xl: index === 0 ? 0 : 1,
              },
              borderTop: {
                xs: index > 1 ? 1 : 0,
                md: index > 2 ? 1 : 0,
                xl: 0,
              },
              borderColor: 'divider',
            }}
          >
            <Stack direction="row" alignItems="center" gap={0.75} color="text.secondary">
              <Icon size={16} />
              <Typography variant="caption" noWrap>
                {label}
              </Typography>
            </Stack>
            <Typography variant="h4" sx={{ mt: 0.5, color: tone ?? 'text.primary' }}>
              {value.toLocaleString()}
            </Typography>
          </Box>
        ))}
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1.15fr) minmax(380px, 0.85fr)' },
          gap: { xs: 3, xl: 4 },
        }}
      >
        <Box component="section" minWidth={0}>
          <ProviderSectionHeading
            title={t('command.queue.title')}
            description={t('command.queue.description')}
            action={
              <Button
                size="small"
                endIcon={<ArrowRight size={16} />}
                onClick={() => navigate('/provider/operations')}
              >
                {t('actions.viewAll')}
              </Button>
            }
          />
          <Stack
            divider={<Divider flexItem />}
            sx={{ mt: 1.5, borderBlock: 1, borderColor: 'divider' }}
          >
            {data.actionQueue.length === 0 ? (
              <Stack direction="row" alignItems="center" gap={1} sx={{ py: 2.25 }}>
                <ShieldCheck size={18} color="currentColor" />
                <Typography variant="body2" color="text.secondary">
                  {t('command.queue.empty')}
                </Typography>
              </Stack>
            ) : (
              data.actionQueue.slice(0, 6).map((item) => (
                <Button
                  key={item.itemId}
                  color="inherit"
                  onClick={() => navigate(item.route)}
                  sx={{ minHeight: 64, justifyContent: 'flex-start', px: 0.5, textAlign: 'left' }}
                >
                  <Box
                    sx={{
                      width: 4,
                      height: 32,
                      flex: '0 0 4px',
                      bgcolor:
                        item.severity === 'CRITICAL'
                          ? 'error.main'
                          : item.severity === 'HIGH'
                            ? 'warning.main'
                            : 'info.main',
                    }}
                  />
                  <Box sx={{ ml: 1.25, minWidth: 0, flex: 1 }}>
                    <Stack direction="row" alignItems="center" gap={1}>
                      <Typography variant="body2" fontWeight={750} noWrap>
                        {t(`operationTypes.${item.title}`, { defaultValue: item.title })}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t(`command.categories.${item.category}`, { defaultValue: item.category })}
                      </Typography>
                    </Stack>
                    <Typography variant="caption" color="text.secondary" noWrap display="block">
                      {item.detail}
                    </Typography>
                  </Box>
                  <ArrowRight size={16} />
                </Button>
              ))
            )}
          </Stack>
        </Box>

        <Box component="section" minWidth={0}>
          <ProviderSectionHeading
            title={t('command.services.title')}
            description={t('command.services.description')}
            action={
              <Button
                size="small"
                endIcon={<ArrowRight size={16} />}
                onClick={() => navigate('/provider/health')}
              >
                {t('command.services.open')}
              </Button>
            }
          />
          <Stack gap={1.5} sx={{ mt: 1.75 }}>
            {data.services.map((service) => {
              const healthyPct = service.totalInstances
                ? (service.healthyInstances / service.totalInstances) * 100
                : 0;
              return (
                <Box key={service.serviceKey}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
                    <Box minWidth={0}>
                      <Typography variant="body2" fontWeight={700} noWrap>
                        {service.displayName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t('command.services.instances', {
                          healthy: service.healthyInstances,
                          total: service.totalInstances,
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
                  <LinearProgress
                    variant="determinate"
                    value={healthyPct}
                    color={healthyPct === 100 ? 'success' : 'warning'}
                    sx={{ mt: 0.75, height: 4, borderRadius: 0 }}
                  />
                </Box>
              );
            })}
          </Stack>
        </Box>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(320px, 0.8fr) minmax(0, 1.2fr)' },
          gap: { xs: 3, lg: 4 },
        }}
      >
        <Box component="section" minWidth={0}>
          <ProviderSectionHeading
            title={t('command.cells.title')}
            description={t('command.cells.description')}
          />
          <Stack
            divider={<Divider flexItem />}
            sx={{ mt: 1.5, borderBlock: 1, borderColor: 'divider' }}
          >
            {data.cells.map((cell) => (
              <Box key={cell.deploymentCellId} sx={{ py: 1.25 }}>
                <Stack direction="row" justifyContent="space-between" gap={2}>
                  <Box minWidth={0}>
                    <Typography variant="body2" fontWeight={700} noWrap>
                      {cell.displayName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {cell.regionKey} / {cell.tenantCount.toLocaleString()}{' '}
                      {t('command.cells.tenants')}
                    </Typography>
                  </Box>
                  <Typography variant="body2" fontWeight={750}>
                    {cell.saturationPct.toFixed(1)}%
                  </Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(100, cell.saturationPct)}
                  color={
                    cell.healthState === 'CRITICAL'
                      ? 'error'
                      : cell.healthState === 'ATTENTION'
                        ? 'warning'
                        : 'primary'
                  }
                  sx={{ mt: 0.75, height: 4, borderRadius: 0 }}
                />
              </Box>
            ))}
          </Stack>
        </Box>

        <Box component="section" minWidth={0}>
          <ProviderSectionHeading
            title={t('command.activity.title')}
            action={
              <Button
                size="small"
                endIcon={<ArrowRight size={16} />}
                onClick={() => navigate('/provider/audit')}
              >
                {t('actions.viewAll')}
              </Button>
            }
          />
          <Stack
            divider={<Divider flexItem />}
            sx={{ mt: 1.5, borderBlock: 1, borderColor: 'divider' }}
          >
            {data.recentActivity.slice(0, 6).map((event) => (
              <Stack
                key={event.auditEventId}
                direction="row"
                alignItems="center"
                gap={1.25}
                sx={{ py: 1.15 }}
              >
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="body2" fontWeight={700} noWrap>
                    {event.action}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap display="block">
                    {event.operatorName ?? '-'} / {event.tenantKey ?? t('audit.global')}
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                  {formatProviderDate(event.occurredAt)}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Box>
      </Box>
    </Stack>
  );
}
