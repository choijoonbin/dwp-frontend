import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, AlertTriangle, Plus, RefreshCw, Server, Users } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createProviderIncident,
  getProviderOperatorProfile,
  getProviderServiceHealth,
  listProviderTenants,
  updateProviderIncident,
  useToast,
} from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import type {
  ProviderServiceHealthOverview,
  ProviderServiceIncident,
  ProviderTenant,
} from '@dwp-frontend/shared-utils';

import {
  formatProviderDate,
  ProviderError,
  ProviderLoading,
  ProviderSectionHeading,
  ProviderStatusChip,
  providerError,
} from './provider-ui';
import { ProviderReliability } from './provider-reliability';

type IncidentDraft = {
  title: string;
  severity: ProviderServiceIncident['severity'];
  impactScope: 'GLOBAL' | 'REGION' | 'CELL' | 'SERVICE' | 'TENANT';
  target: string;
  customerImpact: string;
  publicSummary: string;
  initialUpdate: string;
};

const initialDraft: IncidentDraft = {
  title: '',
  severity: 'SEV3',
  impactScope: 'SERVICE',
  target: '',
  customerImpact: '',
  publicSummary: '',
  initialUpdate: '',
};

function CreateIncidentDialog({
  health,
  tenants,
  busy,
  onClose,
  onCreate,
}: {
  health: ProviderServiceHealthOverview;
  tenants: ProviderTenant[];
  busy: boolean;
  onClose: () => void;
  onCreate: (draft: IncidentDraft) => Promise<void>;
}) {
  const { t } = useTranslation('provider');
  const [draft, setDraft] = useState(initialDraft);
  const regions = useMemo(
    () => [...new Set(health.cells.map((cell) => cell.regionKey))].sort(),
    [health.cells]
  );
  const targets =
    draft.impactScope === 'REGION'
      ? regions.map((region) => ({ value: region, label: region }))
      : draft.impactScope === 'CELL'
        ? health.cells.map((cell) => ({ value: cell.deploymentCellId, label: cell.displayName }))
        : draft.impactScope === 'SERVICE'
          ? health.services.map((service) => ({
              value: service.serviceKey,
              label: service.displayName,
            }))
          : draft.impactScope === 'TENANT'
            ? tenants.map((tenant) => ({ value: tenant.tenantId, label: tenant.displayName }))
            : [];
  const valid =
    draft.title.trim() &&
    draft.customerImpact.trim() &&
    draft.initialUpdate.trim() &&
    (draft.impactScope === 'GLOBAL' || draft.target);

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{t('health.incidents.createTitle')}</DialogTitle>
      <DialogContent dividers>
        <Stack gap={2}>
          <Alert severity="warning">{t('health.incidents.createNotice')}</Alert>
          <TextField
            required
            label={t('health.incidents.fields.title')}
            value={draft.title}
            onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value }))}
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
            <TextField
              select
              fullWidth
              label={t('health.incidents.fields.severity')}
              value={draft.severity}
              onChange={(event) =>
                setDraft((value) => ({
                  ...value,
                  severity: event.target.value as IncidentDraft['severity'],
                }))
              }
            >
              {['SEV1', 'SEV2', 'SEV3', 'SEV4'].map((severity) => (
                <MenuItem key={severity} value={severity}>
                  {t(`health.severity.${severity}`)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              fullWidth
              label={t('health.incidents.fields.scope')}
              value={draft.impactScope}
              onChange={(event) =>
                setDraft((value) => ({
                  ...value,
                  impactScope: event.target.value as IncidentDraft['impactScope'],
                  target: '',
                }))
              }
            >
              {['GLOBAL', 'REGION', 'CELL', 'SERVICE', 'TENANT'].map((scope) => (
                <MenuItem key={scope} value={scope}>
                  {t(`health.scopes.${scope}`)}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          {draft.impactScope !== 'GLOBAL' && (
            <TextField
              select
              required
              label={t('health.incidents.fields.target')}
              value={draft.target}
              onChange={(event) => setDraft((value) => ({ ...value, target: event.target.value }))}
            >
              {targets.map((target) => (
                <MenuItem key={target.value} value={target.value}>
                  {target.label}
                </MenuItem>
              ))}
            </TextField>
          )}
          <TextField
            required
            multiline
            minRows={2}
            label={t('health.incidents.fields.impact')}
            value={draft.customerImpact}
            onChange={(event) =>
              setDraft((value) => ({ ...value, customerImpact: event.target.value }))
            }
          />
          <TextField
            multiline
            minRows={2}
            label={t('health.incidents.fields.publicSummary')}
            value={draft.publicSummary}
            onChange={(event) =>
              setDraft((value) => ({ ...value, publicSummary: event.target.value }))
            }
          />
          <TextField
            required
            multiline
            minRows={2}
            label={t('health.incidents.fields.initialUpdate')}
            value={draft.initialUpdate}
            onChange={(event) =>
              setDraft((value) => ({ ...value, initialUpdate: event.target.value }))
            }
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          {t('actions.cancel')}
        </Button>
        <Button
          variant="contained"
          color="warning"
          startIcon={<AlertTriangle size={17} />}
          disabled={busy || !valid}
          onClick={() => void onCreate(draft)}
        >
          {t('health.incidents.actions.declare')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function UpdateIncidentDialog({
  incident,
  busy,
  onClose,
  onUpdate,
}: {
  incident: ProviderServiceIncident;
  busy: boolean;
  onClose: () => void;
  onUpdate: (
    state: 'IDENTIFIED' | 'MONITORING' | 'RESOLVED' | 'CLOSED',
    message: string,
    visibility: 'INTERNAL' | 'CUSTOMER'
  ) => Promise<void>;
}) {
  const { t } = useTranslation('provider');
  const [state, setState] = useState<'IDENTIFIED' | 'MONITORING' | 'RESOLVED' | 'CLOSED'>(
    incident.lifecycleState === 'INVESTIGATING'
      ? 'IDENTIFIED'
      : incident.lifecycleState === 'IDENTIFIED'
        ? 'MONITORING'
        : incident.lifecycleState === 'MONITORING'
          ? 'RESOLVED'
          : 'CLOSED'
  );
  const [message, setMessage] = useState('');
  const [visibility, setVisibility] = useState<'INTERNAL' | 'CUSTOMER'>('INTERNAL');
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('health.incidents.updateTitle', { key: incident.incidentKey })}</DialogTitle>
      <DialogContent dividers>
        <Stack gap={2}>
          <TextField
            select
            label={t('health.incidents.fields.state')}
            value={state}
            onChange={(event) => setState(event.target.value as typeof state)}
          >
            {['IDENTIFIED', 'MONITORING', 'RESOLVED', 'CLOSED'].map((value) => (
              <MenuItem key={value} value={value}>
                {t(`states.${value}`)}
              </MenuItem>
            ))}
          </TextField>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={visibility}
            onChange={(_event, value: 'INTERNAL' | 'CUSTOMER' | null) =>
              value && setVisibility(value)
            }
            aria-label={t('health.incidents.fields.visibility')}
          >
            <ToggleButton value="INTERNAL">
              {t('health.incidents.visibility.INTERNAL')}
            </ToggleButton>
            <ToggleButton value="CUSTOMER">
              {t('health.incidents.visibility.CUSTOMER')}
            </ToggleButton>
          </ToggleButtonGroup>
          <TextField
            required
            multiline
            minRows={3}
            label={t('health.incidents.fields.update')}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          {t('actions.cancel')}
        </Button>
        <Button
          variant="contained"
          disabled={busy || !message.trim()}
          onClick={() => void onUpdate(state, message.trim(), visibility)}
        >
          {t('actions.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function ProviderHealth() {
  const { t } = useTranslation('provider');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [incidentFilter, setIncidentFilter] = useState<'ACTIVE' | 'RESOLVED' | 'ALL'>('ACTIVE');
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<ProviderServiceIncident | null>(null);
  const [busy, setBusy] = useState(false);
  const health = useQuery({
    queryKey: ['provider', 'health'],
    queryFn: getProviderServiceHealth,
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
  const createIncident = async (draft: IncidentDraft) => {
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

  if (health.isLoading || operator.isLoading || tenants.isLoading) return <ProviderLoading />;
  if (health.isError || operator.isError || tenants.isError)
    return <ProviderError error={health.error ?? operator.error ?? tenants.error} />;
  if (!health.data) return null;

  const metrics = [
    { label: t('health.metrics.instances'), value: health.data.totalInstances, icon: Server },
    { label: t('health.metrics.healthy'), value: health.data.healthyInstances, icon: Activity },
    {
      label: t('health.metrics.degraded'),
      value: health.data.degradedInstances,
      icon: AlertTriangle,
    },
    { label: t('health.metrics.failed'), value: health.data.failedInstances, icon: AlertTriangle },
    { label: t('health.metrics.impacted'), value: health.data.impactedTenants, icon: Users },
  ];

  return (
    <Stack gap={3}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(5, 1fr)' },
          borderBlock: 1,
          borderColor: 'divider',
        }}
      >
        {metrics.map(({ label, value, icon: Icon }, index) => (
          <Box
            key={label}
            sx={{
              p: 1.75,
              borderLeft: { xs: index % 2 ? 1 : 0, md: index ? 1 : 0 },
              borderTop: { xs: index > 1 ? 1 : 0, md: 0 },
              borderColor: 'divider',
            }}
          >
            <Stack direction="row" alignItems="center" gap={0.75} color="text.secondary">
              <Icon size={16} />
              <Typography variant="caption">{label}</Typography>
            </Stack>
            <Typography variant="h4" sx={{ mt: 0.5 }}>
              {value.toLocaleString()}
            </Typography>
          </Box>
        ))}
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1fr) minmax(380px, 0.72fr)' },
          gap: 4,
        }}
      >
        <Box component="section" minWidth={0}>
          <ProviderSectionHeading
            title={t('health.services.title')}
            description={t('health.services.description')}
            action={
              <Tooltip title={t('actions.refresh')}>
                <IconButton aria-label={t('actions.refresh')} onClick={() => void health.refetch()}>
                  <RefreshCw size={18} />
                </IconButton>
              </Tooltip>
            }
          />
          <Stack
            divider={<Divider flexItem />}
            sx={{ mt: 1.5, borderBlock: 1, borderColor: 'divider' }}
          >
            {health.data.services.map((service) => {
              const healthyPct = service.totalInstances
                ? (service.healthyInstances / service.totalInstances) * 100
                : 0;
              return (
                <Box key={service.serviceKey} sx={{ py: 1.5 }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
                    <Box minWidth={0}>
                      <Stack direction="row" alignItems="center" gap={1}>
                        <Typography variant="body2" fontWeight={750} noWrap>
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
                    <Typography variant="body2" fontWeight={750}>
                      {healthyPct.toFixed(0)}%
                    </Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={healthyPct}
                    color={
                      service.failedInstances ? 'error' : healthyPct < 100 ? 'warning' : 'success'
                    }
                    sx={{ mt: 0.75, height: 5, borderRadius: 0 }}
                  />
                </Box>
              );
            })}
          </Stack>
        </Box>

        <Box component="section" minWidth={0}>
          <ProviderSectionHeading
            title={t('health.cells.title')}
            description={t('health.cells.description')}
          />
          <Stack
            divider={<Divider flexItem />}
            sx={{ mt: 1.5, borderBlock: 1, borderColor: 'divider' }}
          >
            {health.data.cells.map((cell) => (
              <Box key={cell.deploymentCellId} sx={{ py: 1.35 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
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
                  <ProviderStatusChip state={cell.healthState} />
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(100, cell.saturationPct)}
                  sx={{ mt: 0.75, height: 4, borderRadius: 0 }}
                />
              </Box>
            ))}
          </Stack>
        </Box>
      </Box>

      <ProviderReliability
        services={health.data.services}
        cells={health.data.cells}
        tenants={tenants.data?.content ?? []}
        canSchedule={canScheduleMaintenance}
      />

      <Box component="section">
        <ProviderSectionHeading
          title={t('health.incidents.title')}
          description={t('health.incidents.description')}
          action={
            canManageIncidents ? (
              <Button
                variant="contained"
                startIcon={<Plus size={17} />}
                onClick={() => setCreateOpen(true)}
              >
                {t('health.incidents.actions.create')}
              </Button>
            ) : undefined
          }
        />
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ xs: 'stretch', sm: 'center' }}
          justifyContent="space-between"
          gap={1}
          sx={{ mt: 1.5, mb: 1 }}
        >
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
          <Typography variant="caption" color="text.secondary">
            {t('health.lastUpdated', { value: formatProviderDate(health.data.generatedAt) })}
          </Typography>
        </Stack>
        <Stack divider={<Divider flexItem />} sx={{ borderBlock: 1, borderColor: 'divider' }}>
          {visibleIncidents.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2.5 }}>
              {t('health.incidents.empty')}
            </Typography>
          ) : (
            visibleIncidents.map((incident) => (
              <Stack
                key={incident.incidentId}
                direction={{ xs: 'column', md: 'row' }}
                alignItems={{ xs: 'stretch', md: 'center' }}
                gap={{ xs: 1, md: 2 }}
                sx={{ py: 1.5 }}
              >
                <Chip
                  size="small"
                  color={
                    incident.severity === 'SEV1'
                      ? 'error'
                      : incident.severity === 'SEV2'
                        ? 'warning'
                        : 'default'
                  }
                  label={incident.severity}
                  sx={{ alignSelf: { xs: 'flex-start', md: 'center' } }}
                />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="body2" fontWeight={750} noWrap>
                    {incident.incidentKey} / {incident.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap display="block">
                    {incident.customerImpact}
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                  {formatProviderDate(incident.detectedAt)}
                </Typography>
                <ProviderStatusChip state={incident.lifecycleState} />
                {canManageIncidents && incident.lifecycleState !== 'CLOSED' && (
                  <Button size="small" onClick={() => setSelected(incident)}>
                    {t('health.incidents.actions.update')}
                  </Button>
                )}
              </Stack>
            ))
          )}
        </Stack>
      </Box>

      {createOpen && (
        <CreateIncidentDialog
          health={health.data}
          tenants={tenants.data?.content ?? []}
          busy={busy}
          onClose={() => setCreateOpen(false)}
          onCreate={createIncident}
        />
      )}
      {selected && (
        <UpdateIncidentDialog
          incident={selected}
          busy={busy}
          onClose={() => setSelected(null)}
          onUpdate={updateIncident}
        />
      )}
    </Stack>
  );
}
