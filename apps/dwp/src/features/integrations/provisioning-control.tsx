import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Copy,
  CircleCheckBig,
  DatabaseZap,
  KeyRound,
  Link2,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCw,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  changeScimConnectorLifecycle,
  checkHrisConnectorConfiguration,
  createHrisConnector,
  createScimConnector,
  getSystemCodeSet,
  importSyntheticWorkdayFixture,
  listHrisConnectors,
  listHrisMappingProfiles,
  listHrisSources,
  listHrisSyncRuns,
  listScimConnectors,
  rotateScimConnectorSecret,
  updateHrisConnector,
  useAuth,
  useToast,
} from '@dwp-frontend/shared-utils';
import { EnterpriseDataGrid } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { AdminPanelError, AdminPanelLoading } from '../admin/admin-ui';

import type { GridColDef } from '@mui/x-data-grid';
import type {
  HrisSyncRun,
  CreateHrisConnectorRequest,
  ScimConnector,
  ScimCredentialIssued,
} from '@dwp-frontend/shared-utils';

const HRIS_SOURCE_TYPES: CreateHrisConnectorRequest['sourceType'][] = [
  'WORKDAY',
  'ORACLE_HCM',
  'SAP_HCM',
  'SCIM',
  'CUSTOM',
];
const HRIS_CONNECTOR_TYPES: CreateHrisConnectorRequest['connectorType'][] = [
  'WORKDAY_REST',
  'WORKDAY_SOAP',
  'ORACLE_HCM_REST',
  'SAP_SUCCESSFACTORS',
  'SCIM_BRIDGE',
  'CUSTOM_REST',
  'FILE_IMPORT',
];
const HRIS_AUTH_MODES: CreateHrisConnectorRequest['authMode'][] = [
  'NONE',
  'BASIC',
  'OAUTH2_CLIENT_CREDENTIALS',
  'MTLS',
  'SIGNED_REQUEST',
];

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
    state === 'ACTIVE' || state === 'SUCCEEDED'
      ? 'success'
      : state === 'FAILED'
        ? 'error'
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
  const connectorsQuery = useQuery({
    queryKey: ['admin', 'provisioning', 'scim'],
    queryFn: listScimConnectors,
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
        field: 'lifecycleState',
        headerName: t('provisioning.scim.columns.state'),
        width: 120,
        renderCell: ({ row }) => <StateChip state={row.lifecycleState} />,
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
                  onClick={() =>
                    void run(
                      () => rotateScimConnectorSecret(row.connectorId),
                      t('provisioning.scim.toasts.rotated')
                    )
                  }
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
                  onClick={() =>
                    void run(
                      () =>
                        changeScimConnectorLifecycle(
                          row.connectorId,
                          row.lifecycleState === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'
                        ),
                      t('provisioning.scim.toasts.lifecycle')
                    )
                  }
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

  if (connectorsQuery.isLoading)
    return <AdminPanelLoading label={t('provisioning.scim.loading')} />;
  if (connectorsQuery.isError)
    return <AdminPanelError message={message(connectorsQuery.error, t('common.operationError'))} />;
  const connectors = connectorsQuery.data ?? [];

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
          <Button startIcon={<Plus size={17} />} onClick={() => setCreateOpen(true)}>
            {t('provisioning.scim.actions.new')}
          </Button>
        </Stack>
      </Stack>
      <EnterpriseDataGrid
        ariaLabel={t('provisioning.scim.title')}
        rows={connectors}
        columns={columns}
        getRowId={(row) => row.connectorId}
        hideFooter
        minVisibleRows={3}
        maxVisibleRows={8}
        sx={{ border: 0, borderRadius: 0 }}
      />
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
    </Box>
  );
}

export function WorkforceDataOperations() {
  const { t } = useTranslation('workforce');
  const auth = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const canManage = (auth.user?.roles ?? []).some((role) => ['ADMIN', 'HR_ADMIN'].includes(role));
  const sources = useQuery({
    queryKey: ['workforce', 'hris', 'sources'],
    queryFn: listHrisSources,
  });
  const connectors = useQuery({
    queryKey: ['workforce', 'hris', 'connectors'],
    queryFn: listHrisConnectors,
  });
  const mappings = useQuery({
    queryKey: ['workforce', 'hris', 'mappings'],
    queryFn: listHrisMappingProfiles,
  });
  const runs = useQuery({
    queryKey: ['workforce', 'hris', 'runs'],
    queryFn: () => listHrisSyncRuns(100),
  });
  const pending = sources.isLoading || connectors.isLoading || mappings.isLoading || runs.isLoading;
  const failed = sources.isError || connectors.isError || mappings.isError || runs.isError;

  const columns = useMemo<GridColDef<HrisSyncRun>[]>(
    () => [
      {
        field: 'startedAt',
        headerName: t('provisioning.hris.columns.started'),
        width: 180,
        valueGetter: (_value, row) => new Date(row.startedAt).toLocaleString(),
      },
      {
        field: 'sourceKey',
        headerName: t('provisioning.hris.columns.source'),
        minWidth: 160,
        flex: 0.7,
      },
      { field: 'syncMode', headerName: t('provisioning.hris.columns.mode'), width: 130 },
      {
        field: 'lifecycleState',
        headerName: t('provisioning.hris.columns.state'),
        width: 130,
        renderCell: ({ row }) => <StateChip state={row.lifecycleState} namespace="workforce" />,
      },
      {
        field: 'readCount',
        headerName: t('provisioning.hris.columns.read'),
        width: 90,
        align: 'right',
        headerAlign: 'right',
      },
      {
        field: 'createdCount',
        headerName: t('provisioning.hris.columns.created'),
        width: 90,
        align: 'right',
        headerAlign: 'right',
      },
      {
        field: 'updatedCount',
        headerName: t('provisioning.hris.columns.updated'),
        width: 90,
        align: 'right',
        headerAlign: 'right',
      },
      {
        field: 'rejectedCount',
        headerName: t('provisioning.hris.columns.rejected'),
        width: 90,
        align: 'right',
        headerAlign: 'right',
      },
      {
        field: 'committedWatermark',
        headerName: t('provisioning.hris.columns.watermark'),
        minWidth: 180,
        flex: 0.8,
        valueGetter: (_value, row) => row.committedWatermark || t('provisioning.notAvailable'),
      },
    ],
    [t]
  );

  if (pending) return <AdminPanelLoading label={t('provisioning.hris.loading')} />;
  if (failed) return <AdminPanelError message={t('common.operationError')} />;

  const runImport = async () => {
    if (!canManage) return;
    setBusy(true);
    try {
      const result = await importSyntheticWorkdayFixture();
      await queryClient.invalidateQueries({ queryKey: ['workforce', 'hris'] });
      toast.success(
        t(
          result.replayed
            ? 'provisioning.hris.toasts.replayed'
            : 'provisioning.hris.toasts.imported',
          { count: result.readCount }
        )
      );
    } catch (error) {
      toast.error(message(error, t('common.operationError')));
    } finally {
      setBusy(false);
    }
  };

  const runConnectorAction = async (action: () => Promise<unknown>, success: string) => {
    if (!canManage) return;
    setBusy(true);
    try {
      await action();
      await queryClient.invalidateQueries({ queryKey: ['workforce', 'hris'] });
      toast.success(success);
    } catch (error) {
      toast.error(message(error, t('common.operationError')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        alignItems={{ xs: 'stretch', md: 'center' }}
        justifyContent="space-between"
        gap={1.5}
        sx={{ p: 2 }}
      >
        <Stack direction="row" alignItems="center" gap={1}>
          <DatabaseZap size={18} />
          <Typography component="h2" variant="subtitle1">
            {t('provisioning.hris.title')}
          </Typography>
          <Chip
            label={t('provisioning.hris.synthetic')}
            size="small"
            color="warning"
            variant="outlined"
          />
          {!canManage && <Chip label={t('pages.context.readOnly')} size="small" />}
        </Stack>
        <Stack direction="row" justifyContent="flex-end">
          <Button
            startIcon={<Plus size={17} />}
            disabled={busy || !canManage}
            onClick={() => setCreateOpen(true)}
          >
            {t('provisioning.hris.actions.newConnector')}
          </Button>
          <Button
            startIcon={<Play size={17} />}
            disabled={busy || !canManage}
            onClick={() => void runImport()}
          >
            {t('provisioning.hris.actions.importSample')}
          </Button>
        </Stack>
      </Stack>
      <Box
        sx={{
          px: 2,
          pb: 2,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
          gap: 0,
        }}
      >
        <Box sx={{ py: 1.5, pr: { md: 2 }, borderRight: { md: 1 }, borderColor: 'divider' }}>
          <Typography variant="caption" color="text.secondary">
            {t('provisioning.hris.sources')}
          </Typography>
          {(sources.data ?? []).map((source) => (
            <Typography key={source.sourceKey} variant="body2" fontWeight={700}>
              {source.name}{' '}
              <Typography component="span" variant="caption" color="text.secondary">
                / {source.systemType}
              </Typography>
            </Typography>
          ))}
        </Box>
        <Box sx={{ py: 1.5, px: { md: 2 }, borderRight: { md: 1 }, borderColor: 'divider' }}>
          <Typography variant="caption" color="text.secondary">
            {t('provisioning.hris.connectors')}
          </Typography>
          {(connectors.data ?? []).map((connector) => (
            <Stack
              key={connector.connectorInstanceId}
              direction="row"
              alignItems="center"
              gap={0.5}
            >
              <Link2 size={14} />
              <Typography variant="body2" fontWeight={700} sx={{ flex: 1 }} noWrap>
                {connector.connectorKey}
              </Typography>
              <StateChip state={connector.healthState} namespace="workforce" />
              <Tooltip title={t('provisioning.hris.actions.check')}>
                <IconButton
                  size="small"
                  disabled={busy || !canManage}
                  onClick={() =>
                    void runConnectorAction(async () => {
                      const result = await checkHrisConnectorConfiguration(
                        connector.connectorInstanceId
                      );
                      if (!result.valid) throw new Error(result.issues.join(' '));
                    }, t('provisioning.hris.toasts.checked'))
                  }
                >
                  <CircleCheckBig size={15} />
                </IconButton>
              </Tooltip>
              <Tooltip
                title={
                  connector.lifecycleState === 'ACTIVE'
                    ? t('provisioning.hris.actions.suspend')
                    : t('provisioning.hris.actions.activate')
                }
              >
                <span>
                  <IconButton
                    size="small"
                    disabled={busy || !canManage || connector.lifecycleState === 'RETIRED'}
                    onClick={() =>
                      void runConnectorAction(
                        () =>
                          updateHrisConnector(connector, {
                            endpointUri: connector.endpointUri ?? undefined,
                            credentialReference: connector.credentialReference ?? undefined,
                            scheduleExpression: connector.scheduleExpression ?? undefined,
                            lifecycleState:
                              connector.lifecycleState === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE',
                          }),
                        t('provisioning.hris.toasts.lifecycle')
                      )
                    }
                  >
                    {connector.lifecycleState === 'ACTIVE' ? (
                      <Pause size={15} />
                    ) : (
                      <Play size={15} />
                    )}
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          ))}
        </Box>
        <Box sx={{ py: 1.5, pl: { md: 2 } }}>
          <Typography variant="caption" color="text.secondary">
            {t('provisioning.hris.mappings')}
          </Typography>
          {(mappings.data ?? []).map((mapping) => (
            <Typography key={mapping.mappingProfileId} variant="body2" fontWeight={700}>
              {mapping.profileKey}{' '}
              <Typography component="span" variant="caption" color="text.secondary">
                / {mapping.sourceSchemaVersion} - {mapping.targetSchemaVersion}
              </Typography>
            </Typography>
          ))}
        </Box>
      </Box>
      <Box sx={{ borderTop: 1, borderColor: 'divider' }}>
        <EnterpriseDataGrid
          ariaLabel={t('provisioning.hris.runs')}
          rows={runs.data ?? []}
          columns={columns}
          getRowId={(row) => row.syncRunId}
          hideFooter={(runs.data?.length ?? 0) <= 25}
          initialState={{ pagination: { paginationModel: { page: 0, pageSize: 25 } } }}
          minVisibleRows={3}
          maxVisibleRows={8}
          sx={{ border: 0, borderRadius: 0 }}
        />
      </Box>
      {createOpen && canManage && (
        <HrisConnectorDialog
          open
          busy={busy}
          onClose={() => setCreateOpen(false)}
          onSave={async (request) => {
            await runConnectorAction(
              () => createHrisConnector(request),
              t('provisioning.hris.toasts.connectorCreated')
            );
            setCreateOpen(false);
          }}
        />
      )}
    </Box>
  );
}

function HrisConnectorDialog({
  open,
  busy,
  onClose,
  onSave,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSave: (request: CreateHrisConnectorRequest) => Promise<void>;
}) {
  const { t, i18n } = useTranslation('workforce');
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const sourceTypeCatalog = useQuery({
    queryKey: ['system-code-set', 'PEOPLE.HRIS_SOURCE_TYPE', locale],
    queryFn: () => getSystemCodeSet('PEOPLE.HRIS_SOURCE_TYPE', locale),
    staleTime: 5 * 60 * 1000,
  });
  const connectorTypeCatalog = useQuery({
    queryKey: ['system-code-set', 'PEOPLE.HRIS_CONNECTOR_TYPE', locale],
    queryFn: () => getSystemCodeSet('PEOPLE.HRIS_CONNECTOR_TYPE', locale),
    staleTime: 5 * 60 * 1000,
  });
  const authModeCatalog = useQuery({
    queryKey: ['system-code-set', 'PEOPLE.HRIS_AUTH_MODE', locale],
    queryFn: () => getSystemCodeSet('PEOPLE.HRIS_AUTH_MODE', locale),
    staleTime: 5 * 60 * 1000,
  });
  const sourceTypeOptions =
    sourceTypeCatalog.data?.values.filter((value) =>
      HRIS_SOURCE_TYPES.includes(value.code as CreateHrisConnectorRequest['sourceType'])
    ) ?? HRIS_SOURCE_TYPES.map((code) => ({ code, label: code }));
  const connectorTypeOptions =
    connectorTypeCatalog.data?.values.filter((value) =>
      HRIS_CONNECTOR_TYPES.includes(value.code as CreateHrisConnectorRequest['connectorType'])
    ) ?? HRIS_CONNECTOR_TYPES.map((code) => ({ code, label: code }));
  const authModeOptions =
    authModeCatalog.data?.values.filter((value) =>
      HRIS_AUTH_MODES.includes(value.code as CreateHrisConnectorRequest['authMode'])
    ) ?? HRIS_AUTH_MODES.map((code) => ({ code, label: code }));
  const [sourceKey, setSourceKey] = useState('');
  const [sourceType, setSourceType] = useState<CreateHrisConnectorRequest['sourceType']>('WORKDAY');
  const [sourceName, setSourceName] = useState('');
  const [connectorKey, setConnectorKey] = useState('');
  const [connectorType, setConnectorType] =
    useState<CreateHrisConnectorRequest['connectorType']>('WORKDAY_REST');
  const [endpointUri, setEndpointUri] = useState('');
  const [authMode, setAuthMode] = useState<CreateHrisConnectorRequest['authMode']>(
    'OAUTH2_CLIENT_CREDENTIALS'
  );
  const [credentialReference, setCredentialReference] = useState('');
  const [scheduleExpression, setScheduleExpression] = useState('');
  const remote = connectorType !== 'FILE_IMPORT';
  const valid =
    sourceKey.trim() &&
    sourceName.trim() &&
    connectorKey.trim() &&
    (!remote || endpointUri.startsWith('https://')) &&
    (authMode === 'NONE' ||
      /^(vault|secret|env|aws-secretsmanager):\/\//.test(credentialReference));

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle>{t('provisioning.hris.create.title')}</DialogTitle>
      <DialogContent sx={{ pt: '8px !important' }}>
        <Stack gap={2}>
          <Typography variant="body2" color="text.secondary">
            {t('provisioning.hris.create.secretNotice')}
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
            <TextField
              required
              fullWidth
              label={t('provisioning.hris.create.sourceKey')}
              value={sourceKey}
              onChange={(event) => setSourceKey(event.target.value)}
            />
            <TextField
              select
              fullWidth
              label={t('provisioning.hris.create.sourceType')}
              value={sourceType}
              onChange={(event) =>
                setSourceType(event.target.value as CreateHrisConnectorRequest['sourceType'])
              }
            >
              {sourceTypeOptions.map((value) => (
                <MenuItem key={value.code} value={value.code}>
                  {value.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              required
              fullWidth
              label={t('provisioning.hris.create.sourceName')}
              value={sourceName}
              onChange={(event) => setSourceName(event.target.value)}
            />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
            <TextField
              required
              fullWidth
              label={t('provisioning.hris.create.connectorKey')}
              value={connectorKey}
              onChange={(event) => setConnectorKey(event.target.value)}
            />
            <TextField
              select
              fullWidth
              label={t('provisioning.hris.create.connectorType')}
              value={connectorType}
              onChange={(event) => {
                const value = event.target.value as CreateHrisConnectorRequest['connectorType'];
                setConnectorType(value);
                if (value === 'FILE_IMPORT') setAuthMode('NONE');
              }}
            >
              {connectorTypeOptions.map((value) => (
                <MenuItem key={value.code} value={value.code}>
                  {value.label}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          <TextField
            required={remote}
            disabled={!remote}
            label={t('provisioning.hris.create.endpoint')}
            value={endpointUri}
            onChange={(event) => setEndpointUri(event.target.value)}
            helperText={
              remote
                ? t('provisioning.hris.create.httpsOnly')
                : t('provisioning.hris.create.fileManaged')
            }
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
            <TextField
              select
              fullWidth
              label={t('provisioning.hris.create.authMode')}
              value={authMode}
              onChange={(event) =>
                setAuthMode(event.target.value as CreateHrisConnectorRequest['authMode'])
              }
            >
              {authModeOptions.map((value) => (
                <MenuItem key={value.code} value={value.code}>
                  {value.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              required={authMode !== 'NONE'}
              disabled={authMode === 'NONE'}
              fullWidth
              label={t('provisioning.hris.create.credentialReference')}
              value={credentialReference}
              onChange={(event) => setCredentialReference(event.target.value)}
              placeholder={t('provisioning.hris.create.credentialReferencePlaceholder')}
            />
            <TextField
              fullWidth
              label={t('provisioning.hris.create.schedule')}
              value={scheduleExpression}
              onChange={(event) => setScheduleExpression(event.target.value)}
            />
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          {t('common.actions.cancel')}
        </Button>
        <Button
          variant="contained"
          disabled={busy || !valid}
          onClick={() =>
            void onSave({
              sourceKey: sourceKey.trim(),
              sourceType,
              sourceName: sourceName.trim(),
              connectorKey: connectorKey.trim(),
              connectorType,
              endpointUri: endpointUri.trim() || undefined,
              authMode,
              credentialReference: credentialReference.trim() || undefined,
              scheduleExpression: scheduleExpression.trim() || undefined,
            })
          }
        >
          {t('common.actions.create')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
