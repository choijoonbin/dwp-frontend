import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Copy,
  KeyRound,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCw,
  Workflow,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  changeScimConnectorLifecycle,
  createScimConnector,
  listScimConnectors,
  listScimProvisioningEvents,
  rotateScimConnectorSecret,
  useToast,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  DetailInspector,
  EnterpriseDataGrid,
  GuidedEmptyState,
  OperationalKpiStrip,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Tooltip from '@mui/material/Tooltip';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { AdminPanelError, AdminPanelLoading } from '../admin/admin-ui';

import type { GridColDef } from '@mui/x-data-grid';
import type {
  ScimConnector,
  ScimCredentialIssued,
  ScimProvisioningEvent,
} from '@dwp-frontend/shared-utils';

function message(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function StateChip({
  state,
  namespace = 'admin',
}: {
  state: string;
  namespace?: 'admin' | 'workforce';
}) {
  const { t } = useTranslation(namespace);
  const color =
    state === 'ACTIVE' || state === 'SUCCEEDED' || state === 'READY'
      ? 'success'
      : state === 'FAILED' || state === 'ATTENTION'
        ? 'error'
        : state === 'PENDING'
          ? 'warning'
          : 'default';
  return (
    <Chip
      size="small"
      variant="outlined"
      color={color}
      label={t(`provisioning.states.${state}`, { defaultValue: state })}
    />
  );
}

function ConnectorInspector({
  connector,
  events,
  onClose,
}: {
  connector: ScimConnector | null;
  events: ScimProvisioningEvent[];
  onClose: () => void;
}) {
  const { t } = useTranslation('admin');
  const toast = useToast();
  const endpoint = `${globalThis.location?.origin ?? ''}/api/auth/scim/v2`;
  const connectorEvents = connector
    ? events.filter((event) => event.connectorId === connector.connectorId).slice(0, 8)
    : [];
  const mapping = [
    ['userName', 'email'],
    ['active', 'status'],
    ['name.givenName', 'givenName'],
    ['name.familyName', 'familyName'],
    ['displayName', 'displayName'],
    ['externalId', 'externalId'],
    ['Group.displayName', 'group.displayName'],
    ['Group.members', 'group.members'],
  ];

  return (
    <DetailInspector
      open={Boolean(connector)}
      variant="drawer"
      width={500}
      title={connector?.displayName ?? t('provisioning.scim.inspector.title')}
      subtitle={connector?.connectorKey}
      closeLabel={t('provisioning.scim.inspector.close')}
      onClose={onClose}
      status={
        connector ? <StateChip state={connector.health ?? connector.lifecycleState} /> : undefined
      }
    >
      {connector && (
        <Stack gap={2.5}>
          <Box component="section" aria-labelledby="scim-readiness-title">
            <Typography id="scim-readiness-title" component="h3" variant="subtitle2">
              {t('provisioning.scim.inspector.readiness')}
            </Typography>
            <Stack sx={{ mt: 1, borderTop: 1, borderColor: 'divider' }}>
              {[
                {
                  label: t('provisioning.scim.steps.credential'),
                  complete: connector.lifecycleState === 'ACTIVE',
                },
                {
                  label: t('provisioning.scim.steps.idp'),
                  external: true,
                  complete: false,
                },
                {
                  label: t('provisioning.scim.steps.firstSync'),
                  complete: Boolean(connector.lastUsedAt || connector.lastSuccessAt),
                },
                {
                  label: t('provisioning.scim.steps.reconcile'),
                  complete: (connector.failedEvents24h ?? 0) === 0,
                },
              ].map((step) => (
                <Stack
                  key={step.label}
                  direction="row"
                  alignItems="center"
                  gap={1}
                  sx={{ py: 1.1, borderBottom: 1, borderColor: 'divider' }}
                >
                  {step.complete ? (
                    <CheckCircle2 size={17} color="currentColor" />
                  ) : step.external ? (
                    <CircleDashed size={17} color="currentColor" />
                  ) : (
                    <AlertTriangle size={17} color="currentColor" />
                  )}
                  <Typography variant="body2" sx={{ flex: 1 }}>
                    {step.label}
                  </Typography>
                  <Chip
                    size="small"
                    variant="outlined"
                    color={step.complete ? 'success' : step.external ? 'info' : 'warning'}
                    label={t(
                      step.complete
                        ? 'provisioning.scim.stepStates.complete'
                        : step.external
                          ? 'provisioning.scim.stepStates.external'
                          : 'provisioning.scim.stepStates.pending'
                    )}
                  />
                </Stack>
              ))}
            </Stack>
          </Box>

          <Box component="section" aria-labelledby="scim-endpoint-title">
            <Typography id="scim-endpoint-title" component="h3" variant="subtitle2">
              {t('provisioning.scim.inspector.endpoint')}
            </Typography>
            <TextField
              fullWidth
              size="small"
              value={endpoint}
              inputProps={{ readOnly: true }}
              sx={{ mt: 1 }}
              InputProps={{
                endAdornment: (
                  <Tooltip title={t('provisioning.scim.inspector.copyEndpoint')}>
                    <IconButton
                      aria-label={t('provisioning.scim.inspector.copyEndpoint')}
                      onClick={() =>
                        void navigator.clipboard
                          .writeText(endpoint)
                          .then(() =>
                            toast.success(t('provisioning.scim.inspector.endpointCopied'))
                          )
                      }
                    >
                      <Copy size={16} />
                    </IconButton>
                  </Tooltip>
                ),
              }}
            />
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.75 }}>
              {t('provisioning.scim.inspector.tokenPrefix', { prefix: connector.tokenPrefix })}
            </Typography>
          </Box>

          <Box component="section" aria-labelledby="scim-mapping-title">
            <Typography id="scim-mapping-title" component="h3" variant="subtitle2">
              {t('provisioning.scim.inspector.mapping')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('provisioning.scim.inspector.mappingDescription')}
            </Typography>
            <Box sx={{ mt: 1, borderTop: 1, borderColor: 'divider' }}>
              {mapping.map(([source, target]) => (
                <Stack
                  key={source}
                  direction="row"
                  justifyContent="space-between"
                  gap={2}
                  sx={{ py: 0.75, borderBottom: 1, borderColor: 'divider' }}
                >
                  <Typography variant="caption" fontFamily="monospace">
                    {source}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" fontFamily="monospace">
                    {target}
                  </Typography>
                </Stack>
              ))}
            </Box>
          </Box>

          <Box component="section" aria-labelledby="scim-events-title">
            <Typography id="scim-events-title" component="h3" variant="subtitle2">
              {t('provisioning.scim.inspector.recentEvents')}
            </Typography>
            {connectorEvents.length ? (
              <Stack sx={{ mt: 1, borderTop: 1, borderColor: 'divider' }}>
                {connectorEvents.map((event) => (
                  <Box key={event.eventId} sx={{ py: 1, borderBottom: 1, borderColor: 'divider' }}>
                    <Stack direction="row" justifyContent="space-between" gap={1}>
                      <Typography variant="body2" fontWeight={700}>
                        {event.resourceType} {event.operation}
                      </Typography>
                      <StateChip state={event.outcome} />
                    </Stack>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {event.summary} · {new Date(event.occurredAt).toLocaleString()}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {t('provisioning.scim.inspector.noEvents')}
              </Typography>
            )}
          </Box>
        </Stack>
      )}
    </DetailInspector>
  );
}

function SecretDialog({
  issued,
  onClose,
}: {
  issued: ScimCredentialIssued | null;
  onClose: () => void;
}) {
  const { t } = useTranslation('admin');
  const toast = useToast();
  return (
    <Dialog open={Boolean(issued)} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('provisioning.scim.secret.title')}</DialogTitle>
      <DialogContent sx={{ pt: '8px !important' }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('provisioning.scim.secret.notice')}
        </Typography>
        <TextField
          fullWidth
          label={t('provisioning.scim.secret.token')}
          value={issued?.bearerToken ?? ''}
          inputProps={{ readOnly: true }}
          InputProps={{
            endAdornment: (
              <Tooltip title={t('provisioning.scim.secret.copy')}>
                <IconButton
                  aria-label={t('provisioning.scim.secret.copy')}
                  onClick={() => {
                    if (!issued) return;
                    void navigator.clipboard
                      .writeText(issued.bearerToken)
                      .then(() => toast.success(t('provisioning.scim.secret.copied')));
                  }}
                >
                  <Copy size={17} />
                </IconButton>
              </Tooltip>
            ),
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={onClose}>
          {t('common.actions.close')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function ScimCreateDialog({
  open,
  busy,
  onClose,
  onSave,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSave: (request: { connectorKey: string; displayName: string }) => Promise<void>;
}) {
  const { t } = useTranslation('admin');
  const [connectorKey, setConnectorKey] = useState('');
  const [displayName, setDisplayName] = useState('');
  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('provisioning.scim.create.title')}</DialogTitle>
      <DialogContent sx={{ pt: '8px !important' }}>
        <Stack gap={2}>
          <TextField
            autoFocus
            required
            label={t('provisioning.scim.create.key')}
            value={connectorKey}
            onChange={(event) => setConnectorKey(event.target.value)}
            helperText={t('provisioning.scim.create.keyHelp')}
          />
          <TextField
            required
            label={t('provisioning.scim.create.name')}
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          {t('common.actions.cancel')}
        </Button>
        <Button
          variant="contained"
          disabled={busy || !connectorKey.trim() || !displayName.trim()}
          onClick={() =>
            void onSave({ connectorKey: connectorKey.trim(), displayName: displayName.trim() })
          }
        >
          {t('common.actions.create')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function IdentityProvisioningManager() {
  const { t } = useTranslation('admin');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<ScimCredentialIssued | null>(null);
  const [inspectedConnectorId, setInspectedConnectorId] = useState<string | null>(null);
  const connectorsQuery = useQuery({
    queryKey: ['admin', 'provisioning', 'scim'],
    queryFn: listScimConnectors,
  });
  const eventsQuery = useQuery({
    queryKey: ['admin', 'provisioning', 'scim', 'events'],
    queryFn: () => listScimProvisioningEvents(undefined, 100),
    retry: false,
  });

  const refresh = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ['admin', 'provisioning', 'scim'] }),
    [queryClient]
  );
  const run = useCallback(
    async (action: () => Promise<ScimCredentialIssued | ScimConnector>, success: string) => {
      setBusy(true);
      try {
        const result = await action();
        if ('bearerToken' in result) setIssued(result);
        await refresh();
        toast.success(success);
      } catch (error) {
        toast.error(message(error, t('common.operationError')));
      } finally {
        setBusy(false);
      }
    },
    [refresh, t, toast]
  );

  const columns = useMemo<GridColDef<ScimConnector>[]>(
    () => [
      {
        field: 'displayName',
        headerName: t('provisioning.scim.columns.connector'),
        minWidth: 240,
        flex: 1,
        renderCell: ({ row }) => (
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" fontWeight={700} noWrap>
              {row.displayName}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" noWrap>
              {row.connectorKey}
            </Typography>
          </Box>
        ),
      },
      { field: 'tokenPrefix', headerName: t('provisioning.scim.columns.tokenPrefix'), width: 150 },
      {
        field: 'allowedOperations',
        headerName: t('provisioning.scim.columns.operations'),
        minWidth: 220,
        flex: 0.8,
        valueGetter: (_value, row) => row.allowedOperations.join(', '),
      },
      {
        field: 'health',
        headerName: t('provisioning.scim.columns.health'),
        width: 120,
        renderCell: ({ row }) => <StateChip state={row.health ?? row.lifecycleState} />,
      },
      {
        field: 'events24h',
        headerName: t('provisioning.scim.columns.activity24h'),
        width: 132,
        renderCell: ({ row }) => (
          <Stack direction="row" alignItems="center" gap={0.5}>
            <Typography variant="body2">{row.events24h ?? 0}</Typography>
            {(row.failedEvents24h ?? 0) > 0 && (
              <Chip
                size="small"
                color="error"
                variant="outlined"
                label={t('provisioning.scim.failedCount', { count: row.failedEvents24h })}
              />
            )}
          </Stack>
        ),
      },
      {
        field: 'lastUsedAt',
        headerName: t('provisioning.scim.columns.lastUsed'),
        width: 180,
        valueGetter: (_value, row) =>
          row.lastUsedAt ? new Date(row.lastUsedAt).toLocaleString() : t('provisioning.never'),
      },
      {
        field: 'actions',
        headerName: '',
        width: 104,
        sortable: false,
        renderCell: ({ row }) => (
          <Stack direction="row">
            <Tooltip title={t('provisioning.scim.actions.rotate')}>
              <span>
                <IconButton
                  size="small"
                  disabled={busy || row.lifecycleState === 'RETIRED'}
                  onClick={(event) => {
                    event.stopPropagation();
                    void run(
                      () => rotateScimConnectorSecret(row.connectorId),
                      t('provisioning.scim.toasts.rotated')
                    );
                  }}
                >
                  <RotateCw size={16} />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip
              title={
                row.lifecycleState === 'ACTIVE'
                  ? t('provisioning.scim.actions.suspend')
                  : t('provisioning.scim.actions.activate')
              }
            >
              <span>
                <IconButton
                  size="small"
                  disabled={busy || row.lifecycleState === 'RETIRED'}
                  onClick={(event) => {
                    event.stopPropagation();
                    void run(
                      () =>
                        changeScimConnectorLifecycle(
                          row.connectorId,
                          row.lifecycleState === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'
                        ),
                      t('provisioning.scim.toasts.lifecycle')
                    );
                  }}
                >
                  {row.lifecycleState === 'ACTIVE' ? <Pause size={16} /> : <Play size={16} />}
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        ),
      },
    ],
    [busy, run, t]
  );
  const eventColumns = useMemo<GridColDef<ScimProvisioningEvent>[]>(
    () => [
      {
        field: 'connectorName',
        headerName: t('provisioning.scim.eventColumns.connector'),
        minWidth: 180,
        flex: 0.8,
      },
      {
        field: 'operation',
        headerName: t('provisioning.scim.eventColumns.operation'),
        width: 116,
      },
      {
        field: 'resourceType',
        headerName: t('provisioning.scim.eventColumns.resource'),
        minWidth: 180,
        flex: 0.8,
        renderCell: ({ row }) => (
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2">{row.resourceType}</Typography>
            <Typography variant="caption" color="text.secondary" noWrap display="block">
              {row.resourceId || row.summary}
            </Typography>
          </Box>
        ),
      },
      {
        field: 'outcome',
        headerName: t('provisioning.scim.eventColumns.outcome'),
        width: 112,
        renderCell: ({ row }) => <StateChip state={row.outcome} />,
      },
      {
        field: 'occurredAt',
        headerName: t('provisioning.scim.eventColumns.occurredAt'),
        width: 190,
        valueGetter: (_value, row) => new Date(row.occurredAt).toLocaleString(),
      },
    ],
    [t]
  );

  if (connectorsQuery.isLoading)
    return <AdminPanelLoading label={t('provisioning.scim.loading')} />;
  if (connectorsQuery.isError)
    return <AdminPanelError message={message(connectorsQuery.error, t('common.operationError'))} />;
  const connectors = connectorsQuery.data ?? [];
  const events = eventsQuery.data ?? [];
  const inspectedConnector =
    connectors.find((connector) => connector.connectorId === inspectedConnectorId) ?? null;
  const activeConnectors = connectors.filter(
    (connector) => connector.lifecycleState === 'ACTIVE'
  ).length;
  const attentionConnectors = connectors.filter(
    (connector) => (connector.health ?? connector.lifecycleState) === 'ATTENTION'
  ).length;
  const events24h = connectors.reduce((sum, connector) => sum + (connector.events24h ?? 0), 0);
  const failures24h = connectors.reduce(
    (sum, connector) => sum + (connector.failedEvents24h ?? 0),
    0
  );

  return (
    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
        gap={1}
        sx={{ p: 2 }}
      >
        <Stack direction="row" alignItems="center" gap={1}>
          <KeyRound size={18} />
          <Typography component="h2" variant="subtitle1">
            {t('provisioning.scim.title')}
          </Typography>
          <Chip label={connectors.length} size="small" variant="outlined" />
        </Stack>
        <Stack direction="row" justifyContent="flex-end">
          <Tooltip title={t('common.actions.refresh')}>
            <IconButton
              aria-label={t('common.actions.refresh')}
              onClick={() => void connectorsQuery.refetch()}
            >
              <RefreshCw size={18} />
            </IconButton>
          </Tooltip>
          <ActionButton
            intent="primary"
            size="small"
            startIcon={<Plus size={17} />}
            onClick={() => setCreateOpen(true)}
          >
            {t('provisioning.scim.actions.new')}
          </ActionButton>
        </Stack>
      </Stack>

      <OperationalKpiStrip
        ariaLabel={t('provisioning.scim.metrics.label')}
        items={[
          {
            key: 'active',
            label: t('provisioning.scim.metrics.active'),
            value: activeConnectors,
            tone: activeConnectors ? 'success' : 'neutral',
            detail: t('provisioning.scim.metrics.activeDetail'),
          },
          {
            key: 'attention',
            label: t('provisioning.scim.metrics.attention'),
            value: attentionConnectors,
            tone: attentionConnectors ? 'critical' : 'success',
            detail: t('provisioning.scim.metrics.attentionDetail'),
          },
          {
            key: 'events',
            label: t('provisioning.scim.metrics.events'),
            value: events24h,
            tone: 'info',
            detail: t('provisioning.scim.metrics.eventsDetail'),
          },
          {
            key: 'failures',
            label: t('provisioning.scim.metrics.failures'),
            value: failures24h,
            tone: failures24h ? 'critical' : 'success',
            detail: t('provisioning.scim.metrics.failuresDetail'),
          },
        ]}
      />

      <Box component="section" aria-labelledby="scim-workflow-title" sx={{ p: 2 }}>
        <Stack direction="row" alignItems="center" gap={1}>
          <Workflow size={18} />
          <Box>
            <Typography id="scim-workflow-title" component="h3" variant="subtitle2">
              {t('provisioning.scim.workflow.title')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('provisioning.scim.workflow.description')}
            </Typography>
          </Box>
        </Stack>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
            mt: 1.5,
            borderTop: 1,
            borderLeft: 1,
            borderColor: 'divider',
          }}
        >
          {[
            {
              key: 'credential',
              label: t('provisioning.scim.steps.credential'),
              detail: t('provisioning.scim.steps.credentialDetail'),
              state: connectors.length ? 'complete' : 'pending',
            },
            {
              key: 'idp',
              label: t('provisioning.scim.steps.idp'),
              detail: t('provisioning.scim.steps.idpDetail'),
              state: 'external',
            },
            {
              key: 'firstSync',
              label: t('provisioning.scim.steps.firstSync'),
              detail: t('provisioning.scim.steps.firstSyncDetail'),
              state: connectors.some((connector) => connector.lastUsedAt || connector.lastSuccessAt)
                ? 'complete'
                : 'pending',
            },
            {
              key: 'reconcile',
              label: t('provisioning.scim.steps.reconcile'),
              detail: t('provisioning.scim.steps.reconcileDetail'),
              state: failures24h > 0 ? 'attention' : events24h > 0 ? 'complete' : 'pending',
            },
          ].map((step, index) => (
            <Box
              key={step.key}
              sx={{ p: 1.5, borderRight: 1, borderBottom: 1, borderColor: 'divider' }}
            >
              <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
                <Typography variant="caption" color="text.secondary">
                  {t('provisioning.scim.workflow.step', { number: index + 1 })}
                </Typography>
                <Chip
                  size="small"
                  variant="outlined"
                  color={
                    step.state === 'complete'
                      ? 'success'
                      : step.state === 'attention'
                        ? 'error'
                        : step.state === 'external'
                          ? 'info'
                          : 'warning'
                  }
                  label={t(`provisioning.scim.stepStates.${step.state}`)}
                />
              </Stack>
              <Typography variant="body2" fontWeight={700} sx={{ mt: 0.75 }}>
                {step.label}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                display="block"
                sx={{ mt: 0.25 }}
              >
                {step.detail}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>
      {connectors.length === 0 ? (
        <GuidedEmptyState
          kind="first-use"
          title={t('provisioning.scim.empty.title')}
          description={t('provisioning.scim.empty.description')}
          actionLabel={t('provisioning.scim.actions.new')}
          onAction={() => setCreateOpen(true)}
        />
      ) : (
        <EnterpriseDataGrid
          ariaLabel={t('provisioning.scim.title')}
          rows={connectors}
          columns={columns}
          getRowId={(row) => row.connectorId}
          hideFooter
          minVisibleRows={3}
          maxVisibleRows={8}
          onRowClick={({ row }) => setInspectedConnectorId(row.connectorId)}
          stickyColumns={{ left: ['displayName'], right: ['actions'] }}
          sx={{ border: 0, borderRadius: 0, '& .MuiDataGrid-row': { cursor: 'pointer' } }}
        />
      )}

      <Box
        component="section"
        aria-labelledby="scim-activity-title"
        sx={{ borderTop: 1, borderColor: 'divider' }}
      >
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          gap={1}
          sx={{ px: 2, py: 1.5 }}
        >
          <Stack direction="row" alignItems="center" gap={1}>
            <Activity size={18} />
            <Box>
              <Typography id="scim-activity-title" component="h3" variant="subtitle2">
                {t('provisioning.scim.activity.title')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('provisioning.scim.activity.description')}
              </Typography>
            </Box>
          </Stack>
          <Chip size="small" variant="outlined" label={events.length} />
        </Stack>
        {eventsQuery.isError ? (
          <Typography variant="body2" color="error.main" sx={{ px: 2, pb: 2 }}>
            {t('provisioning.scim.activity.loadError')}
          </Typography>
        ) : events.length ? (
          <EnterpriseDataGrid
            ariaLabel={t('provisioning.scim.activity.title')}
            rows={events}
            columns={eventColumns}
            getRowId={(row) => row.eventId}
            hideFooter={events.length <= 25}
            minVisibleRows={3}
            maxVisibleRows={7}
            initialState={{ pagination: { paginationModel: { page: 0, pageSize: 25 } } }}
            sx={{ border: 0, borderRadius: 0 }}
          />
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ px: 2, pb: 2 }}>
            {t('provisioning.scim.activity.empty')}
          </Typography>
        )}
      </Box>
      <ScimCreateDialog
        open={createOpen}
        busy={busy}
        onClose={() => setCreateOpen(false)}
        onSave={async (request) => {
          await run(() => createScimConnector(request), t('provisioning.scim.toasts.created'));
          setCreateOpen(false);
        }}
      />
      <SecretDialog issued={issued} onClose={() => setIssued(null)} />
      <ConnectorInspector
        connector={inspectedConnector}
        events={events}
        onClose={() => setInspectedConnectorId(null)}
      />
    </Box>
  );
}
