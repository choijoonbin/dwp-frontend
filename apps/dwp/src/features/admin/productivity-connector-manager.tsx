import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  Ban,
  CalendarDays,
  CheckCircle2,
  Cloud,
  DatabaseZap,
  KeyRound,
  Mail,
  Network,
  Pencil,
  Play,
  PlugZap,
  Plus,
  RefreshCw,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  activateProductivityConnector,
  checkProductivityConnector,
  createProductivityConnector,
  getProductivityOverview,
  listProductivityRuns,
  listProductivitySubjects,
  suspendProductivityConnector,
  updateProductivityConnector,
  useToast,
} from '@dwp-frontend/shared-utils';
import { formatDate } from '@dwp-frontend/shared-i18n';
import {
  ActionButton,
  ActionIconButton,
  FormDialog,
  FormField,
  ProgressMeter,
  SelectField,
} from '@dwp-frontend/design-system';

import { alpha, useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';

import {
  ManagementPanelError,
  ManagementPanelLoading,
} from '../../components/management-panel-state';

import type {
  ProductivityConnector,
  ProductivityConnectorHealth,
  ProductivityPolicyState,
  SaveProductivityConnectorRequest,
} from '@dwp-frontend/shared-utils';

const REQUIRED_SCOPES = [
  'openid',
  'profile',
  'offline_access',
  'User.Read',
  'Mail.ReadBasic',
  'Calendars.Read',
] as const;

type ViewMode = 'connections' | 'consent' | 'runs' | 'policy';

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function healthTone(health: ProductivityConnectorHealth) {
  if (health === 'HEALTHY') return 'success' as const;
  if (health === 'CONFIGURATION_REQUIRED' || health === 'AUTHENTICATION_REQUIRED') {
    return 'warning' as const;
  }
  if (health === 'UNAVAILABLE') return 'error' as const;
  return 'info' as const;
}

function Metric({
  icon: Icon,
  label,
  value,
  attention = false,
}: {
  icon: typeof PlugZap;
  label: string;
  value: number | string;
  attention?: boolean;
}) {
  return (
    <Box
      sx={{
        minWidth: 0,
        px: 2,
        py: 1.5,
        borderRight: { md: 1 },
        borderColor: 'divider',
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
        <Typography variant="caption" color="text.secondary" fontWeight={700}>
          {label}
        </Typography>
        <Icon size={16} aria-hidden="true" />
      </Stack>
      <Typography
        component="p"
        variant="h5"
        color={attention ? 'warning.main' : 'text.primary'}
        sx={{ mt: 0.5, fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
      </Typography>
    </Box>
  );
}

function ConnectorDialog({
  connector,
  open,
  busy,
  onClose,
  onSave,
}: {
  connector: ProductivityConnector | null;
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSave: (request: SaveProductivityConnectorRequest) => Promise<void>;
}) {
  const { t } = useTranslation('admin');
  const [connectorKey, setConnectorKey] = useState('MICROSOFT_365');
  const [displayName, setDisplayName] = useState('Microsoft 365');
  const [providerTenantId, setProviderTenantId] = useState('organizations');
  const [clientId, setClientId] = useState('');
  const [credentialReference, setCredentialReference] = useState('env:DWP_MS_GRAPH_CLIENT_SECRET');
  const [redirectUri, setRedirectUri] = useState(
    `${window.location.origin}/integrations/microsoft-365/callback`
  );
  const [policyState, setPolicyState] = useState<ProductivityPolicyState>('REVIEW_REQUIRED');

  useEffect(() => {
    if (!open) return;
    setConnectorKey(connector?.connectorKey ?? 'MICROSOFT_365');
    setDisplayName(connector?.displayName ?? 'Microsoft 365');
    setProviderTenantId(connector?.providerTenantId ?? 'organizations');
    setClientId(connector?.clientId ?? '');
    setCredentialReference(connector?.credentialReference ?? 'env:DWP_MS_GRAPH_CLIENT_SECRET');
    setRedirectUri(
      connector?.redirectUri ?? `${window.location.origin}/integrations/microsoft-365/callback`
    );
    setPolicyState(connector?.policyState ?? 'REVIEW_REQUIRED');
  }, [connector, open]);

  const valid =
    connectorKey.trim().length > 0 &&
    displayName.trim().length > 0 &&
    providerTenantId.trim().length > 0 &&
    clientId.trim().length > 0 &&
    /^env:[A-Z][A-Z0-9_]+$/.test(credentialReference) &&
    redirectUri.trim().length > 0;

  return (
    <FormDialog
      open={open}
      title={t(connector ? 'productivity.dialog.editTitle' : 'productivity.dialog.createTitle')}
      cancelLabel={t('common.actions.cancel')}
      submitLabel={t('common.actions.save')}
      busy={busy}
      submitDisabled={!valid}
      onClose={onClose}
      onSubmit={() =>
        onSave({
          connectorKey: connectorKey.trim(),
          displayName: displayName.trim(),
          providerType: 'MICROSOFT_GRAPH',
          authMode: 'DELEGATED',
          providerTenantId: providerTenantId.trim(),
          clientId: clientId.trim(),
          credentialReference: credentialReference.trim(),
          redirectUri: redirectUri.trim(),
          requestedScopes: [...REQUIRED_SCOPES],
          policyState,
          version: connector?.version,
        })
      }
      maxWidth="md"
    >
      <Stack gap={2}>
        <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
          <Stack direction="row" gap={1.25} alignItems="flex-start">
            <ShieldCheck size={18} aria-hidden="true" />
            <Box>
              <Typography variant="subtitle2">{t('productivity.dialog.delegatedTitle')}</Typography>
              <Typography variant="body2" color="text.secondary">
                {t('productivity.dialog.delegatedDescription')}
              </Typography>
            </Box>
          </Stack>
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
          <FormField
            required
            label={t('productivity.fields.connectorKey')}
            value={connectorKey}
            disabled={Boolean(connector)}
            onChange={(event) => setConnectorKey(event.target.value)}
          />
          <FormField
            required
            label={t('productivity.fields.displayName')}
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
          <FormField
            required
            label={t('productivity.fields.providerTenant')}
            value={providerTenantId}
            onChange={(event) => setProviderTenantId(event.target.value)}
          />
          <FormField
            required
            label={t('productivity.fields.clientId')}
            value={clientId}
            onChange={(event) => setClientId(event.target.value)}
          />
        </Stack>
        <FormField
          required
          label={t('productivity.fields.credentialReference')}
          value={credentialReference}
          supportingText={t('productivity.fields.credentialReferenceHelp')}
          onChange={(event) => setCredentialReference(event.target.value)}
        />
        <FormField
          required
          label={t('productivity.fields.redirectUri')}
          value={redirectUri}
          onChange={(event) => setRedirectUri(event.target.value)}
        />
        <SelectField<ProductivityPolicyState>
          required
          label={t('productivity.fields.policyState')}
          value={policyState}
          options={(['REVIEW_REQUIRED', 'APPROVED', 'BLOCKED'] as const).map((value) => ({
            value,
            label: t(`productivity.policyStates.${value}`),
          }))}
          onValueChange={(value) => value && setPolicyState(value)}
        />
        <Box>
          <Typography variant="caption" color="text.secondary" fontWeight={700}>
            {t('productivity.fields.delegatedScopes')}
          </Typography>
          <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mt: 0.75 }}>
            {REQUIRED_SCOPES.map((scope) => (
              <Chip key={scope} size="small" label={scope} variant="outlined" />
            ))}
          </Stack>
        </Box>
      </Stack>
    </FormDialog>
  );
}

export function ProductivityConnectorManager() {
  const { t } = useTranslation('admin');
  const navigate = useNavigate();
  const theme = useTheme();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [view, setView] = useState<ViewMode>('connections');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogConnector, setDialogConnector] = useState<ProductivityConnector | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const overviewQuery = useQuery({
    queryKey: ['admin', 'productivity', 'overview'],
    queryFn: getProductivityOverview,
    refetchInterval: 30_000,
  });
  const subjectsQuery = useQuery({
    queryKey: ['admin', 'productivity', 'subjects'],
    queryFn: () => listProductivitySubjects(200),
    enabled: view === 'consent',
  });
  const runsQuery = useQuery({
    queryKey: ['admin', 'productivity', 'runs'],
    queryFn: () => listProductivityRuns(200),
    enabled: view === 'runs',
  });

  const connectors = useMemo(
    () => overviewQuery.data?.connectorHealth ?? [],
    [overviewQuery.data?.connectorHealth]
  );
  useEffect(() => {
    if (!connectors.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !connectors.some((item) => item.connectorId === selectedId)) {
      setSelectedId(connectors[0].connectorId);
    }
  }, [connectors, selectedId]);
  const selected = connectors.find((item) => item.connectorId === selectedId) ?? null;

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin', 'productivity', 'overview'] }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'productivity', 'subjects'] }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'productivity', 'runs'] }),
    ]);
  };

  const save = async (request: SaveProductivityConnectorRequest) => {
    setBusyAction('save');
    try {
      const saved = dialogConnector
        ? await updateProductivityConnector(dialogConnector.connectorId, request)
        : await createProductivityConnector(request);
      setSelectedId(saved.connectorId);
      setDialogOpen(false);
      await invalidate();
      toast.success(t('productivity.toasts.saved'));
    } catch (error) {
      toast.error(errorMessage(error, t('common.operationError')));
    } finally {
      setBusyAction(null);
    }
  };

  const runAction = async (key: string, action: () => Promise<unknown>, success: string) => {
    setBusyAction(key);
    try {
      await action();
      await invalidate();
      toast.success(success);
    } catch (error) {
      toast.error(errorMessage(error, t('common.operationError')));
    } finally {
      setBusyAction(null);
    }
  };

  if (overviewQuery.isLoading) {
    return <ManagementPanelLoading label={t('productivity.loading')} />;
  }
  if (overviewQuery.isError || !overviewQuery.data) {
    return (
      <ManagementPanelError message={errorMessage(overviewQuery.error, t('common.loadError'))} />
    );
  }

  const overview = overviewQuery.data;
  const readinessChecks = selected
    ? [
        selected.clientId ? 'client' : null,
        selected.credentialReference ? 'secret' : null,
        selected.redirectUri ? 'redirect' : null,
        selected.policyState === 'APPROVED' ? 'policy' : null,
      ].filter(Boolean).length
    : 0;

  return (
    <Stack gap={2.5}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(5, minmax(0, 1fr))' },
          borderTop: 1,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Metric
          icon={PlugZap}
          label={t('productivity.metrics.connectors')}
          value={overview.connectors}
        />
        <Metric
          icon={CheckCircle2}
          label={t('productivity.metrics.active')}
          value={overview.activeConnectors}
        />
        <Metric
          icon={UsersRound}
          label={t('productivity.metrics.connected')}
          value={overview.connectedSubjects}
        />
        <Metric
          icon={AlertTriangle}
          label={t('productivity.metrics.stale')}
          value={overview.staleStreams}
          attention={overview.staleStreams > 0}
        />
        <Metric
          icon={Activity}
          label={t('productivity.metrics.failed24h')}
          value={overview.failedRuns24h}
          attention={overview.failedRuns24h > 0}
        />
      </Box>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
        gap={1.5}
      >
        <ToggleButtonGroup
          exclusive
          size="small"
          value={view}
          onChange={(_, value: ViewMode | null) => value && setView(value)}
          aria-label={t('productivity.views.label')}
        >
          <ToggleButton value="connections">{t('productivity.views.connections')}</ToggleButton>
          <ToggleButton value="consent">{t('productivity.views.consent')}</ToggleButton>
          <ToggleButton value="runs">{t('productivity.views.runs')}</ToggleButton>
          <ToggleButton value="policy">{t('productivity.views.policy')}</ToggleButton>
        </ToggleButtonGroup>
        <Stack direction="row" gap={1} justifyContent="flex-end">
          <ActionIconButton label={t('common.actions.refresh')} onClick={() => invalidate()}>
            <RefreshCw size={18} />
          </ActionIconButton>
          <ActionButton
            intent="primary"
            startIcon={<Plus size={17} />}
            onClick={() => {
              setDialogConnector(null);
              setDialogOpen(true);
            }}
          >
            {t('productivity.actions.add')}
          </ActionButton>
        </Stack>
      </Stack>

      {view === 'connections' && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: '320px minmax(0, 1fr)' },
            minHeight: 480,
            borderTop: 1,
            borderBottom: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
          }}
        >
          <Box sx={{ borderRight: { lg: 1 }, borderColor: 'divider' }}>
            <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="subtitle2">{t('productivity.connections.title')}</Typography>
              <Typography variant="caption" color="text.secondary">
                {t('productivity.connections.description')}
              </Typography>
            </Box>
            <List disablePadding aria-label={t('productivity.connections.title')}>
              {connectors.map((connector) => (
                <ListItem key={connector.connectorId} disablePadding>
                  <ListItemButton
                    selected={connector.connectorId === selectedId}
                    onClick={() => setSelectedId(connector.connectorId)}
                    sx={{ px: 2, py: 1.5, gap: 1.25, borderBottom: 1, borderColor: 'divider' }}
                  >
                    <Box
                      sx={{
                        width: 36,
                        height: 36,
                        display: 'grid',
                        placeItems: 'center',
                        borderRadius: 1,
                        color: 'primary.main',
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                      }}
                    >
                      <Cloud size={19} />
                    </Box>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography variant="subtitle2" noWrap>
                        {connector.displayName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {connector.connectorKey}
                      </Typography>
                    </Box>
                    <Box
                      role="img"
                      aria-label={t(`productivity.health.${connector.healthState}`)}
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        bgcolor: `${healthTone(connector.healthState)}.main`,
                      }}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </Box>

          {selected ? (
            <Stack sx={{ minWidth: 0 }}>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                justifyContent="space-between"
                alignItems={{ xs: 'flex-start', md: 'center' }}
                gap={2}
                sx={{ px: 2.5, py: 2, borderBottom: 1, borderColor: 'divider' }}
              >
                <Box>
                  <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                    <Typography variant="h6">{selected.displayName}</Typography>
                    <Chip
                      size="small"
                      color={healthTone(selected.healthState)}
                      label={t(`productivity.health.${selected.healthState}`)}
                    />
                    <Chip
                      size="small"
                      variant="outlined"
                      label={t(`productivity.lifecycle.${selected.lifecycleState}`)}
                    />
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {t('productivity.connections.boundary')}
                  </Typography>
                </Box>
                <Stack direction="row" gap={1} flexWrap="wrap">
                  <ActionButton
                    intent="quiet"
                    startIcon={<Network size={17} />}
                    onClick={() =>
                      navigate(
                        `/admin/platform/catalog?focus=${encodeURIComponent(`CONNECTOR_INSTANCE:${selected.connectorKey}`)}`
                      )
                    }
                  >
                    {t('productivity.actions.catalogImpact')}
                  </ActionButton>
                  <ActionButton
                    intent="secondary"
                    loading={busyAction === 'check'}
                    startIcon={<ShieldCheck size={17} />}
                    onClick={() =>
                      runAction(
                        'check',
                        () => checkProductivityConnector(selected.connectorId),
                        t('productivity.toasts.checked')
                      )
                    }
                  >
                    {t('productivity.actions.check')}
                  </ActionButton>
                  {selected.lifecycleState === 'ACTIVE' ? (
                    <ActionButton
                      intent="danger"
                      loading={busyAction === 'suspend'}
                      startIcon={<Ban size={17} />}
                      onClick={() =>
                        runAction(
                          'suspend',
                          () =>
                            suspendProductivityConnector(selected.connectorId, selected.version),
                          t('productivity.toasts.suspended')
                        )
                      }
                    >
                      {t('productivity.actions.suspend')}
                    </ActionButton>
                  ) : (
                    <ActionButton
                      intent="primary"
                      loading={busyAction === 'activate'}
                      startIcon={<Play size={17} />}
                      onClick={() =>
                        runAction(
                          'activate',
                          () =>
                            activateProductivityConnector(selected.connectorId, selected.version),
                          t('productivity.toasts.activated')
                        )
                      }
                    >
                      {t('productivity.actions.activate')}
                    </ActionButton>
                  )}
                  <ActionIconButton
                    label={t('common.actions.edit')}
                    disabled={selected.lifecycleState === 'ACTIVE'}
                    onClick={() => {
                      setDialogConnector(selected);
                      setDialogOpen(true);
                    }}
                  >
                    <Pencil size={18} />
                  </ActionIconButton>
                </Stack>
              </Stack>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.35fr) minmax(280px, 0.65fr)' },
                }}
              >
                <Stack gap={2.5} sx={{ p: 2.5, borderRight: { md: 1 }, borderColor: 'divider' }}>
                  <Box>
                    <ProgressMeter
                      label={t('productivity.readiness.title')}
                      value={readinessChecks * 25}
                      valueLabel={`${readinessChecks}/4`}
                      tone={readinessChecks === 4 ? 'success' : 'warning'}
                    />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      {selected.safeErrorCode
                        ? t('productivity.readiness.signal', { code: selected.safeErrorCode })
                        : t('productivity.readiness.ready')}
                    </Typography>
                  </Box>

                  <Divider />

                  <Box>
                    <Typography variant="subtitle2">{t('productivity.flow.title')}</Typography>
                    <Box
                      sx={{
                        mt: 1.25,
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, minmax(0, 1fr))' },
                        gap: 1,
                      }}
                    >
                      {[
                        [
                          UsersRound,
                          t('productivity.flow.user'),
                          t('productivity.flow.userDetail'),
                        ],
                        [
                          KeyRound,
                          t('productivity.flow.consent'),
                          t('productivity.flow.consentDetail'),
                        ],
                        [Cloud, t('productivity.flow.delta'), t('productivity.flow.deltaDetail')],
                        [
                          DatabaseZap,
                          t('productivity.flow.projection'),
                          t('productivity.flow.projectionDetail'),
                        ],
                      ].map(([Icon, label, detail]) => {
                        const FlowIcon = Icon as typeof UsersRound;
                        return (
                          <Box
                            key={String(label)}
                            sx={{ p: 1.25, border: 1, borderColor: 'divider' }}
                          >
                            <FlowIcon size={17} aria-hidden="true" />
                            <Typography variant="subtitle2" sx={{ mt: 0.75 }}>
                              {String(label)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {String(detail)}
                            </Typography>
                          </Box>
                        );
                      })}
                    </Box>
                  </Box>

                  <Divider />

                  <Box>
                    <Typography variant="subtitle2">{t('productivity.scopes.title')}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                      {t('productivity.scopes.description')}
                    </Typography>
                    <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mt: 1.25 }}>
                      {selected.requestedScopes.map((scope) => (
                        <Chip
                          key={scope}
                          size="small"
                          icon={scope.startsWith('Mail') ? <Mail size={14} /> : undefined}
                          label={scope}
                          variant="outlined"
                        />
                      ))}
                    </Stack>
                  </Box>
                </Stack>

                <Stack gap={2} sx={{ p: 2.5 }}>
                  <Typography variant="subtitle2">{t('productivity.signals.title')}</Typography>
                  {[
                    [
                      t('productivity.signals.policy'),
                      t(`productivity.policyStates.${selected.policyState}`),
                    ],
                    [t('productivity.signals.auth'), t('productivity.auth.DELEGATED')],
                    [t('productivity.signals.lastCheck'), selected.lastConfigurationCheckAt],
                    [t('productivity.signals.lastSync'), selected.lastSuccessfulSyncAt],
                    [t('productivity.signals.failures'), String(selected.consecutiveFailures)],
                  ].map(([label, value]) => (
                    <Stack
                      key={label}
                      direction="row"
                      justifyContent="space-between"
                      gap={2}
                      sx={{ pb: 1.25, borderBottom: 1, borderColor: 'divider' }}
                    >
                      <Typography variant="caption" color="text.secondary">
                        {label}
                      </Typography>
                      <Typography variant="body2" textAlign="right">
                        {value && String(value).includes('T')
                          ? formatDate(String(value), { dateStyle: 'short', timeStyle: 'short' })
                          : value || t('productivity.notAvailable')}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            </Stack>
          ) : (
            <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 420 }}>
              <Typography color="text.secondary">{t('productivity.connections.empty')}</Typography>
            </Box>
          )}
        </Box>
      )}

      {view === 'consent' && (
        <TableContainer sx={{ borderTop: 1, borderBottom: 1, borderColor: 'divider' }}>
          <Table size="small" aria-label={t('productivity.consent.title')}>
            <TableHead>
              <TableRow>
                <TableCell>{t('productivity.consent.user')}</TableCell>
                <TableCell>{t('productivity.consent.state')}</TableCell>
                <TableCell>{t('productivity.consent.scopes')}</TableCell>
                <TableCell>{t('productivity.consent.tokenExpiry')}</TableCell>
                <TableCell>{t('productivity.consent.lastSync')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(subjectsQuery.data ?? []).map((subject) => (
                <TableRow key={subject.subjectId} hover>
                  <TableCell>{t('productivity.consent.userId', { id: subject.userId })}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={subject.consentState === 'CONNECTED' ? 'success' : 'warning'}
                      label={t(`productivity.consentStates.${subject.consentState}`)}
                    />
                  </TableCell>
                  <TableCell>
                    {subject.grantedScopes.join(', ') || t('productivity.notAvailable')}
                  </TableCell>
                  <TableCell>
                    {subject.tokenExpiresAt
                      ? formatDate(subject.tokenExpiresAt, {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })
                      : t('productivity.notAvailable')}
                  </TableCell>
                  <TableCell>
                    {subject.lastSuccessfulSyncAt
                      ? formatDate(subject.lastSuccessfulSyncAt, {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })
                      : t('productivity.notAvailable')}
                  </TableCell>
                </TableRow>
              ))}
              {!subjectsQuery.isLoading && !(subjectsQuery.data ?? []).length && (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 8, color: 'text.secondary' }}>
                    {t('productivity.consent.empty')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {view === 'runs' && (
        <Stack sx={{ borderTop: 1, borderBottom: 1, borderColor: 'divider' }}>
          {(runsQuery.data ?? []).map((run) => (
            <Box
              key={run.runId}
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: '180px 140px minmax(0, 1fr) 180px' },
                alignItems: 'center',
                gap: 2,
                px: 2,
                py: 1.5,
                borderBottom: 1,
                borderColor: 'divider',
              }}
            >
              <Stack direction="row" alignItems="center" gap={1}>
                {run.resourceKind === 'MAIL' ? <Mail size={17} /> : <CalendarDays size={17} />}
                <Box>
                  <Typography variant="subtitle2">
                    {t(`productivity.resources.${run.resourceKind}`)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {run.syncMode}
                  </Typography>
                </Box>
              </Stack>
              <Chip
                size="small"
                color={
                  run.runState === 'SUCCEEDED'
                    ? 'success'
                    : run.runState === 'FAILED'
                      ? 'error'
                      : 'warning'
                }
                label={t(`productivity.runStates.${run.runState}`)}
                sx={{ justifySelf: 'start' }}
              />
              <Stack direction="row" gap={2} flexWrap="wrap">
                <Typography variant="caption">+{run.upsertCount}</Typography>
                <Typography variant="caption">−{run.deleteCount}</Typography>
                <Typography
                  variant="caption"
                  color={run.errorCount ? 'error.main' : 'text.secondary'}
                >
                  {t('productivity.runs.errors', { count: run.errorCount })}
                </Typography>
                {run.safeErrorCode && (
                  <Typography variant="caption" color="warning.main">
                    {run.safeErrorCode}
                  </Typography>
                )}
              </Stack>
              <Typography variant="caption" color="text.secondary" textAlign={{ md: 'right' }}>
                {formatDate(run.startedAt, { dateStyle: 'short', timeStyle: 'medium' })}
              </Typography>
            </Box>
          ))}
          {!runsQuery.isLoading && !(runsQuery.data ?? []).length && (
            <Box sx={{ py: 8, textAlign: 'center', color: 'text.secondary' }}>
              {t('productivity.runs.empty')}
            </Box>
          )}
        </Stack>
      )}

      {view === 'policy' && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
            borderTop: 1,
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          {[
            [
              ShieldCheck,
              t('productivity.policy.leastPrivilege'),
              t('productivity.policy.leastPrivilegeDetail'),
            ],
            [
              KeyRound,
              t('productivity.policy.secretIsolation'),
              t('productivity.policy.secretIsolationDetail'),
            ],
            [
              DatabaseZap,
              t('productivity.policy.minimumProjection'),
              t('productivity.policy.minimumProjectionDetail'),
            ],
          ].map(([Icon, title, description]) => {
            const PolicyIcon = Icon as typeof ShieldCheck;
            return (
              <Box
                key={String(title)}
                sx={{ p: 2.5, borderRight: { md: 1 }, borderColor: 'divider' }}
              >
                <PolicyIcon size={20} />
                <Typography variant="subtitle1" sx={{ mt: 1.25 }}>
                  {String(title)}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {String(description)}
                </Typography>
              </Box>
            );
          })}
        </Box>
      )}

      <ConnectorDialog
        connector={dialogConnector}
        open={dialogOpen}
        busy={busyAction === 'save'}
        onClose={() => setDialogOpen(false)}
        onSave={save}
      />
    </Stack>
  );
}
