import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleGauge,
  DatabaseZap,
  FileCheck2,
  GitCompareArrows,
  Link2,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  activateHrisMappingProfile,
  checkHrisConnectorConfiguration,
  createHrisConnector,
  createHrisMappingProfile,
  executeHrisConnector,
  getSystemCodeSet,
  importSyntheticWorkdayFixture,
  listHrisConnectors,
  listHrisMappingProfiles,
  listHrisReconciliationIssues,
  listHrisReconciliations,
  listHrisSources,
  listHrisSyncRuns,
  reconcileHrisRun,
  resolveHrisReconciliationIssue,
  retryHrisSyncRun,
  updateHrisConnector,
  useAuth,
  useToast,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  ActionIconButton,
  EnterpriseDataGrid,
  FormDialog,
  FormField,
  GuidedEmptyState,
  OperationalKpiStrip,
  SelectField,
} from '@dwp-frontend/design-system';
import { useDisplayDictionary } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { AdminPanelError, AdminPanelLoading } from '../admin/admin-ui';

import type { GridColDef } from '@mui/x-data-grid';
import type {
  CreateHrisConnectorRequest,
  HrisConnector,
  HrisMappingProfile,
  HrisReconciliationIssue,
  HrisSyncRun,
} from '@dwp-frontend/shared-utils';

type HrisView = 'connectors' | 'runs' | 'reconciliation' | 'mappings';

const SOURCE_TYPES: CreateHrisConnectorRequest['sourceType'][] = [
  'WORKDAY',
  'ORACLE_HCM',
  'SAP_HCM',
  'SCIM',
  'CUSTOM',
];
const CONNECTOR_TYPES: CreateHrisConnectorRequest['connectorType'][] = [
  'WORKDAY_REST',
  'WORKDAY_SOAP',
  'ORACLE_HCM_REST',
  'SAP_SUCCESSFACTORS',
  'SCIM_BRIDGE',
  'CUSTOM_REST',
  'FILE_IMPORT',
];
const AUTH_MODES: CreateHrisConnectorRequest['authMode'][] = [
  'NONE',
  'BASIC',
  'OAUTH2_CLIENT_CREDENTIALS',
  'MTLS',
  'SIGNED_REQUEST',
];

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function StateChip({ state }: { state: string }) {
  const display = useDisplayDictionary();
  const color = ['ACTIVE', 'HEALTHY', 'SUCCEEDED', 'RESOLVED'].includes(state)
    ? 'success'
    : ['FAILED', 'CRITICAL'].includes(state)
      ? 'error'
      : ['DEGRADED', 'WARNING', 'PARTIAL'].includes(state)
        ? 'warning'
        : 'default';
  return <Chip size="small" variant="outlined" color={color} label={display('states', state)} />;
}

function formatInstant(value?: string | null): string {
  return value ? new Date(value).toLocaleString() : '-';
}

export function HrisOperationsWorkbench() {
  const { t } = useTranslation('workforce');
  const display = useDisplayDictionary();
  const auth = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [view, setView] = useState<HrisView>('connectors');
  const [busy, setBusy] = useState(false);
  const [createConnectorOpen, setCreateConnectorOpen] = useState(false);
  const [createMappingOpen, setCreateMappingOpen] = useState(false);
  const [issue, setIssue] = useState<HrisReconciliationIssue | null>(null);
  const canManage = (auth.user?.roles ?? []).some((role) => ['ADMIN', 'HR_ADMIN'].includes(role));
  const syntheticImportEnabled = import.meta.env.DEV;

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
  const reconciliations = useQuery({
    queryKey: ['workforce', 'hris', 'reconciliations'],
    queryFn: () => listHrisReconciliations(50),
  });
  const issues = useQuery({
    queryKey: ['workforce', 'hris', 'reconciliation-issues'],
    queryFn: () => listHrisReconciliationIssues('OPEN', 100),
  });
  const queries = [sources, connectors, mappings, runs, reconciliations, issues];
  const pending = queries.some((query) => query.isLoading);
  const failed = queries.some((query) => query.isError);

  const activeMappings = useMemo(
    () =>
      new Map(
        (mappings.data ?? [])
          .filter((item) => item.lifecycleState === 'ACTIVE')
          .map((item) => [item.sourceSystemId, item])
      ),
    [mappings.data]
  );
  const failedRuns = (runs.data ?? []).filter((run) => run.lifecycleState === 'FAILED');
  const healthyConnectors = (connectors.data ?? []).filter(
    (connector) => connector.lifecycleState === 'ACTIVE' && connector.healthState === 'HEALTHY'
  );

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['workforce', 'hris'] });
  };
  const operate = async <T,>(
    action: () => Promise<T>,
    success: string | ((result: T) => string)
  ) => {
    if (!canManage) return;
    setBusy(true);
    try {
      const result = await action();
      await refresh();
      toast.success(typeof success === 'function' ? success(result) : success);
    } catch (error) {
      toast.error(errorMessage(error, t('common.operationError')));
    } finally {
      setBusy(false);
    }
  };

  if (pending) return <AdminPanelLoading label={t('provisioning.hris.loading')} />;
  if (failed) return <AdminPanelError message={t('common.operationError')} />;

  const kpis = [
    {
      key: 'connectors',
      label: t('provisioning.hris.kpi.connectors'),
      value: `${healthyConnectors.length}/${connectors.data?.length ?? 0}`,
      detail: t('provisioning.hris.kpi.healthy'),
      tone:
        healthyConnectors.length === (connectors.data?.length ?? 0)
          ? ('success' as const)
          : ('warning' as const),
      onSelect: () => setView('connectors'),
    },
    {
      key: 'lastRun',
      label: t('provisioning.hris.kpi.lastRun'),
      value: runs.data?.[0] ? display('states', runs.data[0].lifecycleState) : '-',
      detail: runs.data?.[0] ? formatInstant(runs.data[0].startedAt) : t('provisioning.never'),
      tone: runs.data?.[0]?.lifecycleState === 'FAILED' ? ('critical' as const) : ('info' as const),
      onSelect: () => setView('runs'),
    },
    {
      key: 'failures',
      label: t('provisioning.hris.kpi.failedRuns'),
      value: failedRuns.length,
      detail: t('provisioning.hris.kpi.retainedRuns'),
      tone: failedRuns.length ? ('critical' as const) : ('success' as const),
      onSelect: () => setView('runs'),
    },
    {
      key: 'issues',
      label: t('provisioning.hris.kpi.openIssues'),
      value: issues.data?.length ?? 0,
      detail: t('provisioning.hris.kpi.reviewRequired'),
      tone: issues.data?.some((item) => item.severity === 'CRITICAL')
        ? ('critical' as const)
        : ('warning' as const),
      onSelect: () => setView('reconciliation'),
    },
  ];

  return (
    <Box
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        overflow: 'hidden',
        bgcolor: 'background.paper',
      }}
    >
      <Stack
        direction={{ xs: 'column', lg: 'row' }}
        alignItems={{ xs: 'stretch', lg: 'center' }}
        justifyContent="space-between"
        gap={2}
        sx={{ px: { xs: 2, md: 2.5 }, py: 2 }}
      >
        <Stack direction="row" alignItems="center" gap={1.25}>
          <Box
            sx={{
              display: 'grid',
              placeItems: 'center',
              width: 34,
              height: 34,
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              borderRadius: 1,
            }}
          >
            <DatabaseZap size={19} />
          </Box>
          <Box>
            <Typography component="h2" variant="subtitle1">
              {t('provisioning.hris.title')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('provisioning.hris.description')}
            </Typography>
          </Box>
          {!canManage && <Chip label={t('pages.context.readOnly')} size="small" />}
        </Stack>
        <Stack direction="row" gap={1} justifyContent="flex-end" flexWrap="wrap">
          <ActionButton
            intent="quiet"
            startIcon={<RefreshCw size={16} />}
            onClick={() => void refresh()}
          >
            {t('common.actions.refresh')}
          </ActionButton>
          <ActionButton
            intent="secondary"
            startIcon={<Plus size={16} />}
            disabled={!canManage}
            onClick={() => setCreateConnectorOpen(true)}
          >
            {t('provisioning.hris.actions.newConnector')}
          </ActionButton>
          {syntheticImportEnabled && (
            <ActionButton
              intent="secondary"
              startIcon={<Play size={16} />}
              loading={busy}
              disabled={!canManage}
              onClick={() =>
                void operate(
                  () => importSyntheticWorkdayFixture(),
                  (result) => t('provisioning.hris.toasts.imported', { count: result.readCount })
                )
              }
            >
              {t('provisioning.hris.actions.importSample')}
            </ActionButton>
          )}
        </Stack>
      </Stack>

      <OperationalKpiStrip ariaLabel={t('provisioning.hris.kpi.label')} items={kpis} />

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        alignItems={{ xs: 'stretch', md: 'center' }}
        justifyContent="space-between"
        gap={1.5}
        sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}
      >
        <ToggleButtonGroup
          exclusive
          size="small"
          value={view}
          onChange={(_event, value: HrisView | null) => value && setView(value)}
          aria-label={t('provisioning.hris.views.label')}
        >
          <ToggleButton value="connectors">
            <Link2 size={15} />
            {t('provisioning.hris.views.connectors')}
          </ToggleButton>
          <ToggleButton value="runs">
            <CircleGauge size={15} />
            {t('provisioning.hris.views.runs')}
          </ToggleButton>
          <ToggleButton value="reconciliation">
            <GitCompareArrows size={15} />
            {t('provisioning.hris.views.reconciliation')}
          </ToggleButton>
          <ToggleButton value="mappings">
            <FileCheck2 size={15} />
            {t('provisioning.hris.views.mappings')}
          </ToggleButton>
        </ToggleButtonGroup>
        <Typography variant="caption" color="text.secondary">
          {t('provisioning.hris.cursorPolicy')}
        </Typography>
      </Stack>

      {view === 'connectors' && (
        <ConnectorView
          connectors={connectors.data ?? []}
          mappings={activeMappings}
          canManage={canManage}
          busy={busy}
          onOperate={operate}
        />
      )}
      {view === 'runs' && (
        <RunView runs={runs.data ?? []} canManage={canManage} busy={busy} onOperate={operate} />
      )}
      {view === 'reconciliation' && (
        <ReconciliationView
          issues={issues.data ?? []}
          runs={reconciliations.data ?? []}
          canManage={canManage}
          onResolve={setIssue}
        />
      )}
      {view === 'mappings' && (
        <MappingView
          mappings={mappings.data ?? []}
          canManage={canManage}
          busy={busy}
          onCreate={() => setCreateMappingOpen(true)}
          onOperate={operate}
        />
      )}

      {createConnectorOpen && (
        <ConnectorDialog
          busy={busy}
          onClose={() => setCreateConnectorOpen(false)}
          onSave={async (request) => {
            await operate(
              () => createHrisConnector(request),
              t('provisioning.hris.toasts.connectorCreated')
            );
            setCreateConnectorOpen(false);
          }}
        />
      )}
      {createMappingOpen && (
        <MappingDialog
          sources={sources.data ?? []}
          busy={busy}
          onClose={() => setCreateMappingOpen(false)}
          onSave={async (request) => {
            await operate(
              () => createHrisMappingProfile(request),
              t('provisioning.hris.toasts.mappingCreated')
            );
            setCreateMappingOpen(false);
          }}
        />
      )}
      {issue && (
        <IssueResolutionDialog
          issue={issue}
          busy={busy}
          onClose={() => setIssue(null)}
          onSave={async (state, note) => {
            await operate(
              () => resolveHrisReconciliationIssue(issue.reconciliationIssueId, state, note),
              t('provisioning.hris.toasts.issueResolved')
            );
            setIssue(null);
          }}
        />
      )}
    </Box>
  );
}

function ConnectorView({
  connectors,
  mappings,
  canManage,
  busy,
  onOperate,
}: {
  connectors: HrisConnector[];
  mappings: Map<number, HrisMappingProfile>;
  canManage: boolean;
  busy: boolean;
  onOperate: (action: () => Promise<unknown>, success: string) => Promise<void>;
}) {
  const { t } = useTranslation('workforce');
  const display = useDisplayDictionary();
  if (!connectors.length) {
    return (
      <GuidedEmptyState
        kind={canManage ? 'first-use' : 'permission'}
        title={t(
          canManage ? 'provisioning.hris.empty.title' : 'provisioning.hris.empty.permissionTitle'
        )}
        description={t(
          canManage
            ? 'provisioning.hris.empty.description'
            : 'provisioning.hris.empty.permissionDescription'
        )}
      />
    );
  }
  return (
    <Box
      sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: 'repeat(2, minmax(0, 1fr))' } }}
    >
      {connectors.map((connector, index) => {
        const mapping = mappings.get(connector.sourceSystemId);
        const runnable = connector.lifecycleState === 'ACTIVE' && Boolean(mapping);
        let host = '-';
        try {
          host = connector.endpointUri ? new URL(connector.endpointUri).host : '-';
        } catch {
          host = '-';
        }
        return (
          <Box
            key={connector.connectorInstanceId}
            sx={{
              p: 2.25,
              borderBottom: 1,
              borderRight: { xl: index % 2 === 0 ? 1 : 0 },
              borderColor: 'divider',
              minWidth: 0,
            }}
          >
            <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={2}>
              <Stack direction="row" gap={1.25} minWidth={0}>
                <Box
                  sx={{
                    display: 'grid',
                    placeItems: 'center',
                    width: 36,
                    height: 36,
                    bgcolor: 'action.hover',
                    color: 'primary.main',
                    borderRadius: 1,
                    flex: '0 0 auto',
                  }}
                >
                  <Link2 size={18} />
                </Box>
                <Box minWidth={0}>
                  <Typography variant="subtitle2" noWrap>
                    {connector.connectorKey}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {display('connectorTypes', connector.connectorType)} · {host}
                  </Typography>
                </Box>
              </Stack>
              <Stack direction="row" gap={0.75}>
                <StateChip state={connector.lifecycleState} />
                <StateChip state={connector.healthState} />
              </Stack>
            </Stack>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, minmax(0, 1fr))' },
                mt: 2,
                borderTop: 1,
                borderBottom: 1,
                borderColor: 'divider',
              }}
            >
              {[
                [
                  t('provisioning.hris.connector.mapping'),
                  mapping?.profileKey ?? t('provisioning.hris.connector.missing'),
                ],
                [
                  t('provisioning.hris.connector.lastSuccess'),
                  formatInstant(connector.lastSuccessfulSyncAt),
                ],
                [
                  t('provisioning.hris.connector.lastAttempt'),
                  formatInstant(connector.lastAttemptedSyncAt),
                ],
                [
                  t('provisioning.hris.connector.failures'),
                  String(connector.consecutiveFailureCount),
                ],
              ].map(([label, value], metricIndex) => (
                <Box
                  key={label}
                  sx={{
                    py: 1.25,
                    px: 1.25,
                    borderLeft: metricIndex ? 1 : 0,
                    borderColor: 'divider',
                    minWidth: 0,
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    {label}
                  </Typography>
                  <Typography variant="body2" fontWeight={700} noWrap>
                    {value}
                  </Typography>
                </Box>
              ))}
            </Box>
            {connector.lastErrorCode && (
              <Stack
                direction="row"
                gap={0.75}
                alignItems="center"
                sx={{ mt: 1.5, color: 'warning.main' }}
              >
                <AlertTriangle size={15} />
                <Typography variant="caption">{connector.lastErrorCode}</Typography>
              </Stack>
            )}
            <Stack
              direction="row"
              justifyContent="flex-end"
              gap={0.75}
              sx={{ mt: 1.5 }}
              flexWrap="wrap"
            >
              <ActionButton
                intent="quiet"
                size="small"
                startIcon={<ShieldCheck size={15} />}
                disabled={!canManage || busy}
                onClick={() =>
                  void onOperate(async () => {
                    const result = await checkHrisConnectorConfiguration(
                      connector.connectorInstanceId
                    );
                    if (!result.valid) throw new Error(result.issues.join(' '));
                  }, t('provisioning.hris.toasts.checked'))
                }
              >
                {t('provisioning.hris.actions.check')}
              </ActionButton>
              <ActionIconButton
                size="small"
                label={t(
                  connector.lifecycleState === 'ACTIVE'
                    ? 'provisioning.hris.actions.suspend'
                    : 'provisioning.hris.actions.activate'
                )}
                disabled={!canManage || busy || connector.lifecycleState === 'RETIRED'}
                onClick={() =>
                  void onOperate(
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
                {connector.lifecycleState === 'ACTIVE' ? <Pause size={16} /> : <Play size={16} />}
              </ActionIconButton>
              <ActionButton
                intent="secondary"
                size="small"
                disabled={!canManage || busy || !runnable}
                onClick={() =>
                  void onOperate(
                    () => executeHrisConnector(connector.connectorInstanceId, 'DELTA'),
                    t('provisioning.hris.toasts.syncStarted')
                  )
                }
              >
                {t('provisioning.hris.actions.deltaSync')}
              </ActionButton>
              <ActionButton
                intent="secondary"
                size="small"
                disabled={!canManage || busy || !runnable}
                onClick={() =>
                  void onOperate(
                    () => executeHrisConnector(connector.connectorInstanceId, 'FULL'),
                    t('provisioning.hris.toasts.syncStarted')
                  )
                }
              >
                {t('provisioning.hris.actions.fullSync')}
              </ActionButton>
            </Stack>
          </Box>
        );
      })}
    </Box>
  );
}

function RunView({
  runs,
  canManage,
  busy,
  onOperate,
}: {
  runs: HrisSyncRun[];
  canManage: boolean;
  busy: boolean;
  onOperate: (action: () => Promise<unknown>, success: string) => Promise<void>;
}) {
  const { t } = useTranslation('workforce');
  const columns = useMemo<GridColDef<HrisSyncRun>[]>(
    () => [
      {
        field: 'startedAt',
        headerName: t('provisioning.hris.columns.started'),
        width: 180,
        valueGetter: (_value, row) => formatInstant(row.startedAt),
      },
      {
        field: 'sourceKey',
        headerName: t('provisioning.hris.columns.source'),
        minWidth: 150,
        flex: 0.7,
      },
      { field: 'syncMode', headerName: t('provisioning.hris.columns.mode'), width: 100 },
      {
        field: 'lifecycleState',
        headerName: t('provisioning.hris.columns.state'),
        width: 125,
        renderCell: ({ row }) => <StateChip state={row.lifecycleState} />,
      },
      {
        field: 'pageCount',
        headerName: t('provisioning.hris.columns.pages'),
        width: 80,
        align: 'right',
        headerAlign: 'right',
      },
      {
        field: 'readCount',
        headerName: t('provisioning.hris.columns.read'),
        width: 80,
        align: 'right',
        headerAlign: 'right',
      },
      {
        field: 'createdCount',
        headerName: t('provisioning.hris.columns.created'),
        width: 80,
        align: 'right',
        headerAlign: 'right',
      },
      {
        field: 'updatedCount',
        headerName: t('provisioning.hris.columns.updated'),
        width: 80,
        align: 'right',
        headerAlign: 'right',
      },
      {
        field: 'failureCode',
        headerName: t('provisioning.hris.columns.failure'),
        minWidth: 150,
        flex: 0.7,
        valueGetter: (_value, row) => row.failureCode ?? '-',
      },
      {
        field: 'actions',
        headerName: t('provisioning.hris.columns.actions'),
        width: 110,
        sortable: false,
        renderCell: ({ row }) => (
          <Stack direction="row">
            {row.lifecycleState === 'FAILED' && (
              <ActionIconButton
                label={t('provisioning.hris.actions.retry')}
                size="small"
                disabled={!canManage || busy}
                onClick={() =>
                  void onOperate(
                    () => retryHrisSyncRun(row.syncRunId),
                    t('provisioning.hris.toasts.syncStarted')
                  )
                }
              >
                <RotateCcw size={15} />
              </ActionIconButton>
            )}
            {['SUCCEEDED', 'PARTIAL'].includes(row.lifecycleState) && row.connectorInstanceId && (
              <ActionIconButton
                label={t('provisioning.hris.actions.reconcile')}
                size="small"
                disabled={!canManage || busy}
                onClick={() =>
                  void onOperate(
                    () => reconcileHrisRun(row.connectorInstanceId!, row.syncRunId),
                    t('provisioning.hris.toasts.reconciled')
                  )
                }
              >
                <GitCompareArrows size={15} />
              </ActionIconButton>
            )}
          </Stack>
        ),
      },
    ],
    [busy, canManage, onOperate, t]
  );
  return (
    <EnterpriseDataGrid
      ariaLabel={t('provisioning.hris.runs')}
      rows={runs}
      columns={columns}
      getRowId={(row) => row.syncRunId}
      minVisibleRows={6}
      maxVisibleRows={12}
      hideFooter={runs.length <= 25}
      sx={{ border: 0, borderRadius: 0 }}
    />
  );
}

function ReconciliationView({
  issues,
  runs,
  canManage,
  onResolve,
}: {
  issues: HrisReconciliationIssue[];
  runs: Awaited<ReturnType<typeof listHrisReconciliations>>;
  canManage: boolean;
  onResolve: (issue: HrisReconciliationIssue) => void;
}) {
  const { t } = useTranslation('workforce');
  const columns = useMemo<GridColDef<HrisReconciliationIssue>[]>(
    () => [
      {
        field: 'firstDetectedAt',
        headerName: t('provisioning.hris.reconciliation.detected'),
        width: 180,
        valueGetter: (_value, row) => formatInstant(row.firstDetectedAt),
      },
      {
        field: 'severity',
        headerName: t('provisioning.hris.reconciliation.severity'),
        width: 120,
        renderCell: ({ row }) => <StateChip state={row.severity} />,
      },
      {
        field: 'issueCode',
        headerName: t('provisioning.hris.reconciliation.issue'),
        minWidth: 220,
        flex: 0.8,
      },
      { field: 'entityType', headerName: t('provisioning.hris.reconciliation.entity'), width: 120 },
      {
        field: 'redactedSummary',
        headerName: t('provisioning.hris.reconciliation.summary'),
        minWidth: 320,
        flex: 1.3,
      },
      {
        field: 'action',
        headerName: '',
        width: 70,
        sortable: false,
        renderCell: ({ row }) => (
          <ActionIconButton
            label={t('provisioning.hris.actions.resolve')}
            size="small"
            disabled={!canManage}
            onClick={() => onResolve(row)}
          >
            <ArrowRight size={15} />
          </ActionIconButton>
        ),
      },
    ],
    [canManage, onResolve, t]
  );
  return (
    <Box>
      <Stack
        direction="row"
        gap={2}
        sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}
      >
        <Typography variant="body2" fontWeight={700}>
          {t('provisioning.hris.reconciliation.open', { count: issues.length })}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('provisioning.hris.reconciliation.runs', { count: runs.length })}
        </Typography>
      </Stack>
      {issues.length ? (
        <EnterpriseDataGrid
          ariaLabel={t('provisioning.hris.views.reconciliation')}
          rows={issues}
          columns={columns}
          getRowId={(row) => row.reconciliationIssueId}
          minVisibleRows={5}
          maxVisibleRows={10}
          hideFooter={issues.length <= 25}
          sx={{ border: 0, borderRadius: 0 }}
        />
      ) : (
        <GuidedEmptyState
          kind="first-use"
          title={t('provisioning.hris.reconciliation.emptyTitle')}
          description={t('provisioning.hris.reconciliation.emptyDescription')}
        />
      )}
    </Box>
  );
}

function MappingView({
  mappings,
  canManage,
  busy,
  onCreate,
  onOperate,
}: {
  mappings: HrisMappingProfile[];
  canManage: boolean;
  busy: boolean;
  onCreate: () => void;
  onOperate: (action: () => Promise<unknown>, success: string) => Promise<void>;
}) {
  const { t } = useTranslation('workforce');
  return (
    <Box>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}
      >
        <Typography variant="body2" color="text.secondary">
          {t('provisioning.hris.mapping.policy')}
        </Typography>
        <ActionButton
          intent="secondary"
          size="small"
          startIcon={<Plus size={15} />}
          disabled={!canManage || busy}
          onClick={onCreate}
        >
          {t('provisioning.hris.actions.newMapping')}
        </ActionButton>
      </Stack>
      {mappings.map((mapping) => (
        <Stack
          key={mapping.mappingProfileId}
          direction={{ xs: 'column', md: 'row' }}
          alignItems={{ xs: 'stretch', md: 'center' }}
          gap={1.5}
          sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}
        >
          <CheckCircle2 size={17} color="currentColor" />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2">{mapping.profileKey}</Typography>
            <Typography variant="caption" color="text.secondary">
              {mapping.adapterType} · {mapping.sourceSchemaVersion} → {mapping.targetSchemaVersion}
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
            {mapping.mappingSha256.slice(0, 12)}
          </Typography>
          <StateChip state={mapping.lifecycleState} />
          {mapping.lifecycleState === 'DRAFT' && (
            <ActionButton
              intent="secondary"
              size="small"
              disabled={!canManage || busy}
              onClick={() =>
                void onOperate(
                  () => activateHrisMappingProfile(mapping),
                  t('provisioning.hris.toasts.mappingActivated')
                )
              }
            >
              {t('provisioning.hris.actions.activate')}
            </ActionButton>
          )}
        </Stack>
      ))}
    </Box>
  );
}

function ConnectorDialog({
  busy,
  onClose,
  onSave,
}: {
  busy: boolean;
  onClose: () => void;
  onSave: (request: CreateHrisConnectorRequest) => Promise<void>;
}) {
  const { t, i18n } = useTranslation('workforce');
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const sourceCatalog = useQuery({
    queryKey: ['system-code-set', 'PEOPLE.HRIS_SOURCE_TYPE', locale],
    queryFn: () => getSystemCodeSet('PEOPLE.HRIS_SOURCE_TYPE', locale),
    staleTime: 300_000,
  });
  const connectorCatalog = useQuery({
    queryKey: ['system-code-set', 'PEOPLE.HRIS_CONNECTOR_TYPE', locale],
    queryFn: () => getSystemCodeSet('PEOPLE.HRIS_CONNECTOR_TYPE', locale),
    staleTime: 300_000,
  });
  const authCatalog = useQuery({
    queryKey: ['system-code-set', 'PEOPLE.HRIS_AUTH_MODE', locale],
    queryFn: () => getSystemCodeSet('PEOPLE.HRIS_AUTH_MODE', locale),
    staleTime: 300_000,
  });
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
  const options = <T extends string>(catalog: typeof sourceCatalog, fallback: T[]) =>
    catalog.data?.values
      .filter((value) => fallback.includes(value.code as T))
      .map((value) => ({ value: value.code as T, label: value.label })) ??
    fallback.map((value) => ({ value, label: value }));
  const remote = connectorType !== 'FILE_IMPORT';
  const valid =
    sourceKey.trim() &&
    sourceName.trim() &&
    connectorKey.trim() &&
    (!remote || endpointUri.startsWith('https://')) &&
    (authMode === 'NONE' ||
      /^(vault|secret|env|aws-secretsmanager):\/\//.test(credentialReference));
  return (
    <FormDialog
      open
      title={t('provisioning.hris.create.title')}
      description={t('provisioning.hris.create.secretNotice')}
      cancelLabel={t('common.actions.cancel')}
      submitLabel={t('common.actions.create')}
      busy={busy}
      submitDisabled={!valid}
      maxWidth="md"
      onClose={onClose}
      onSubmit={() =>
        onSave({
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
      <Stack gap={2}>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
          <FormField
            required
            label={t('provisioning.hris.create.sourceKey')}
            value={sourceKey}
            onChange={(event) => setSourceKey(event.target.value)}
          />
          <SelectField
            label={t('provisioning.hris.create.sourceType')}
            value={sourceType}
            options={options(sourceCatalog, SOURCE_TYPES)}
            onValueChange={(value) => value && setSourceType(value)}
          />
          <FormField
            required
            label={t('provisioning.hris.create.sourceName')}
            value={sourceName}
            onChange={(event) => setSourceName(event.target.value)}
          />
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
          <FormField
            required
            label={t('provisioning.hris.create.connectorKey')}
            value={connectorKey}
            onChange={(event) => setConnectorKey(event.target.value)}
          />
          <SelectField
            label={t('provisioning.hris.create.connectorType')}
            value={connectorType}
            options={options(connectorCatalog, CONNECTOR_TYPES)}
            onValueChange={(value) => {
              if (!value) return;
              setConnectorType(value);
              if (value === 'FILE_IMPORT') setAuthMode('NONE');
            }}
          />
        </Stack>
        <FormField
          required={remote}
          disabled={!remote}
          label={t('provisioning.hris.create.endpoint')}
          value={endpointUri}
          onChange={(event) => setEndpointUri(event.target.value)}
          supportingText={t(
            remote ? 'provisioning.hris.create.httpsOnly' : 'provisioning.hris.create.fileManaged'
          )}
        />
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
          <SelectField
            label={t('provisioning.hris.create.authMode')}
            value={authMode}
            options={options(authCatalog, AUTH_MODES)}
            onValueChange={(value) => value && setAuthMode(value)}
          />
          <FormField
            required={authMode !== 'NONE'}
            disabled={authMode === 'NONE'}
            label={t('provisioning.hris.create.credentialReference')}
            value={credentialReference}
            placeholder={t('provisioning.hris.create.credentialReferencePlaceholder')}
            onChange={(event) => setCredentialReference(event.target.value)}
          />
          <FormField
            label={t('provisioning.hris.create.schedule')}
            value={scheduleExpression}
            onChange={(event) => setScheduleExpression(event.target.value)}
          />
        </Stack>
      </Stack>
    </FormDialog>
  );
}

function MappingDialog({
  sources,
  busy,
  onClose,
  onSave,
}: {
  sources: Awaited<ReturnType<typeof listHrisSources>>;
  busy: boolean;
  onClose: () => void;
  onSave: (request: Parameters<typeof createHrisMappingProfile>[0]) => Promise<void>;
}) {
  const { t } = useTranslation('workforce');
  const [sourceSystemId, setSourceSystemId] = useState<number | ''>(
    sources[0]?.sourceSystemId ?? ''
  );
  const [profileKey, setProfileKey] = useState('');
  const [sourceVersion, setSourceVersion] = useState('');
  const [definition, setDefinition] = useState('{\n  "mappings": []\n}');
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(definition) as Record<string, unknown>;
  } catch {
    parsed = null;
  }
  const valid =
    sourceSystemId !== '' &&
    profileKey.trim() &&
    sourceVersion.trim() &&
    Array.isArray(parsed?.mappings) &&
    parsed.mappings.length > 0;
  return (
    <FormDialog
      open
      title={t('provisioning.hris.mapping.createTitle')}
      description={t('provisioning.hris.mapping.createDescription')}
      cancelLabel={t('common.actions.cancel')}
      submitLabel={t('common.actions.create')}
      busy={busy}
      submitDisabled={!valid}
      maxWidth="md"
      onClose={onClose}
      onSubmit={() =>
        parsed && sourceSystemId !== ''
          ? onSave({
              sourceSystemId,
              profileKey: profileKey.trim(),
              adapterType: 'WORKDAY_REST',
              sourceSchemaVersion: sourceVersion.trim(),
              targetSchemaVersion: 'dwp.workforce-projection.v1',
              mappingDefinition: parsed,
            })
          : undefined
      }
    >
      <Stack gap={2}>
        <SelectField<number>
          label={t('provisioning.hris.mapping.source')}
          value={sourceSystemId}
          options={sources.map((source) => ({ value: source.sourceSystemId, label: source.name }))}
          onValueChange={setSourceSystemId}
        />
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
          <FormField
            label={t('provisioning.hris.mapping.key')}
            value={profileKey}
            onChange={(event) => setProfileKey(event.target.value)}
          />
          <FormField
            label={t('provisioning.hris.mapping.sourceVersion')}
            value={sourceVersion}
            onChange={(event) => setSourceVersion(event.target.value)}
          />
        </Stack>
        <FormField
          multiline
          minRows={10}
          label={t('provisioning.hris.mapping.definition')}
          value={definition}
          errorMessage={!parsed ? t('provisioning.hris.mapping.invalidJson') : undefined}
          onChange={(event) => setDefinition(event.target.value)}
          inputProps={{ spellCheck: false }}
        />
      </Stack>
    </FormDialog>
  );
}

function IssueResolutionDialog({
  issue,
  busy,
  onClose,
  onSave,
}: {
  issue: HrisReconciliationIssue;
  busy: boolean;
  onClose: () => void;
  onSave: (state: 'RESOLVED' | 'ACCEPTED', note: string) => Promise<void>;
}) {
  const { t } = useTranslation('workforce');
  const [state, setState] = useState<'RESOLVED' | 'ACCEPTED'>('RESOLVED');
  const [note, setNote] = useState('');
  return (
    <FormDialog
      open
      title={t('provisioning.hris.reconciliation.resolveTitle')}
      description={`${issue.issueCode} · ${issue.redactedSummary}`}
      cancelLabel={t('common.actions.cancel')}
      submitLabel={t('common.actions.save')}
      busy={busy}
      submitDisabled={!note.trim()}
      onClose={onClose}
      onSubmit={() => onSave(state, note.trim())}
    >
      <Stack gap={2}>
        <SelectField
          label={t('provisioning.hris.reconciliation.disposition')}
          value={state}
          options={[
            { value: 'RESOLVED', label: t('provisioning.hris.reconciliation.resolved') },
            { value: 'ACCEPTED', label: t('provisioning.hris.reconciliation.accepted') },
          ]}
          onValueChange={(value) => value && setState(value)}
        />
        <FormField
          multiline
          minRows={4}
          label={t('provisioning.hris.reconciliation.note')}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </Stack>
    </FormDialog>
  );
}
