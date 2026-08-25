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
  GuidedEmptyState,
  OperationalKpiStrip,
} from '@dwp-frontend/design-system';
import { formatDate, useDisplayDictionary } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import {
  ManagementPanelError,
  ManagementPanelLoading,
} from '../../components/management-panel-state';
import {
  ProductSurfaceHighRiskCommandDialog,
  productSurfaceHighRiskCommand,
  useProductSurfaceHighRiskCommand,
} from '../../components/product-surface-high-risk-command';
import { useProductActionMutation } from '../../components/use-product-action-mutation';
import { useOptionalAllowedProductSurface } from '../../components/allowed-product-surface-context';
import { useProductSurfaceCapabilityAccess } from '../../components/product-surface-capability-access';
import { useProductSurfaceRequestScope } from '../../components/use-product-surface-request-scope';
import { ConnectorDialog, IssueResolutionDialog, MappingDialog } from './hris-operations-dialogs';

import type { GridColDef } from '@mui/x-data-grid';
import type {
  HrisConnector,
  HrisMappingProfile,
  HrisReconciliationIssue,
  HrisSyncRun,
} from '@dwp-frontend/shared-utils';

type HrisView = 'connectors' | 'runs' | 'reconciliation' | 'mappings';

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
  return value ? formatDate(value, { dateStyle: 'medium', timeStyle: 'short' }) : '-';
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
  const governedPage = useOptionalAllowedProductSurface();
  const capabilityAccess = useProductSurfaceCapabilityAccess();
  const requestScope = useProductSurfaceRequestScope({
    productKey: 'hcm',
    surfaceKey: 'hcm.management',
  });
  const legacyCanManage = (auth.user?.roles ?? []).some((role) =>
    ['ADMIN', 'HR_ADMIN'].includes(role)
  );
  const canCreate = capabilityAccess.governed
    ? capabilityAccess.hasWritableCapability('hcm.integration.create')
    : legacyCanManage;
  const canUpdate = capabilityAccess.governed
    ? capabilityAccess.hasWritableCapability('hcm.integration.update')
    : legacyCanManage;
  const canExecute = capabilityAccess.governed
    ? capabilityAccess.hasWritableCapability('hcm.integration.execute')
    : legacyCanManage;
  const canManage = canCreate || canUpdate || canExecute;
  const syntheticImportEnabled = import.meta.env.DEV && !governedPage;
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['workforce', 'hris'] });
  };
  const createIntegration = useProductActionMutation(
    'route.hcm.management.integration-create.action'
  );
  const updateIntegration = useProductActionMutation(
    'route.hcm.management.integration-update.action'
  );
  const configurationCheck = useProductSurfaceHighRiskCommand({
    operation: 'HCM_INTEGRATION_CONFIGURATION_CHECK',
    execute: async (command, authority) => {
      const result = await checkHrisConnectorConfiguration(command.targetId, authority);
      if (!result.valid) throw new Error(result.issues.join(' '));
      return result;
    },
    onSuccess: async () => {
      await refresh();
      toast.success(t('provisioning.hris.toasts.checked'));
    },
  });
  const connectorExecution = useProductSurfaceHighRiskCommand({
    operation: 'HCM_INTEGRATION_EXECUTE',
    execute: (command, authority) =>
      executeHrisConnector(
        command.targetId,
        command.payload.syncMode === 'FULL' ? 'FULL' : 'DELTA',
        authority
      ),
    onSuccess: async () => {
      await refresh();
      toast.success(t('provisioning.hris.toasts.syncStarted'));
    },
  });
  const runRetry = useProductSurfaceHighRiskCommand({
    operation: 'HCM_INTEGRATION_RETRY',
    execute: (command, authority) => retryHrisSyncRun(command.targetId, authority),
    onSuccess: async () => {
      await refresh();
      toast.success(t('provisioning.hris.toasts.syncStarted'));
    },
  });
  const reconciliation = useProductSurfaceHighRiskCommand({
    operation: 'HCM_INTEGRATION_RECONCILE',
    execute: (command, authority) =>
      reconcileHrisRun(command.targetId, String(command.payload.syncRunId ?? ''), authority),
    onSuccess: async () => {
      await refresh();
      toast.success(t('provisioning.hris.toasts.reconciled'));
    },
  });

  const sources = useQuery({
    queryKey: ['workforce', 'hris', 'sources', ...requestScope.cacheKey],
    queryFn: ({ signal }) => listHrisSources(requestScope.contextScopeKey, signal),
    enabled: requestScope.ready,
    meta: requestScope.queryMeta,
  });
  const connectors = useQuery({
    queryKey: ['workforce', 'hris', 'connectors', ...requestScope.cacheKey],
    queryFn: ({ signal }) => listHrisConnectors(requestScope.contextScopeKey, signal),
    enabled: requestScope.ready,
    meta: requestScope.queryMeta,
  });
  const mappings = useQuery({
    queryKey: ['workforce', 'hris', 'mappings', ...requestScope.cacheKey],
    queryFn: ({ signal }) => listHrisMappingProfiles(requestScope.contextScopeKey, signal),
    enabled: requestScope.ready,
    meta: requestScope.queryMeta,
  });
  const runs = useQuery({
    queryKey: ['workforce', 'hris', 'runs', ...requestScope.cacheKey],
    queryFn: ({ signal }) => listHrisSyncRuns(100, requestScope.contextScopeKey, signal),
    enabled: requestScope.ready,
    meta: requestScope.queryMeta,
  });
  const reconciliations = useQuery({
    queryKey: ['workforce', 'hris', 'reconciliations', ...requestScope.cacheKey],
    queryFn: ({ signal }) => listHrisReconciliations(50, requestScope.contextScopeKey, signal),
    enabled: requestScope.ready,
    meta: requestScope.queryMeta,
  });
  const issues = useQuery({
    queryKey: ['workforce', 'hris', 'reconciliation-issues', ...requestScope.cacheKey],
    queryFn: ({ signal }) =>
      listHrisReconciliationIssues('OPEN', 100, requestScope.contextScopeKey, signal),
    enabled: requestScope.ready,
    meta: requestScope.queryMeta,
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

  const operate = async <T,>(
    permitted: boolean,
    action: () => Promise<T>,
    success: string | ((result: T) => string)
  ) => {
    if (!permitted) return;
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

  if (pending) return <ManagementPanelLoading label={t('provisioning.hris.loading')} />;
  if (failed) return <ManagementPanelError message={t('common.operationError')} />;

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
            disabled={!canCreate}
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
                  legacyCanManage,
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
          canUpdate={canUpdate}
          canExecute={canExecute}
          busy={busy}
          onCheck={(connector) =>
            configurationCheck.begin(
              productSurfaceHighRiskCommand({
                operation: 'HCM_INTEGRATION_CONFIGURATION_CHECK',
                commandMethod: 'POST',
                commandPath: `/api/people/v1/workforce/data-operations/hris/connectors/${encodeURIComponent(connector.connectorInstanceId)}/configuration-check`,
                targetType: 'HCM_CONNECTOR',
                targetId: connector.connectorInstanceId,
                expectedObjectVersion: connector.version,
                payload: {},
              })
            )
          }
          onExecute={(connector, syncMode) =>
            connectorExecution.begin(
              productSurfaceHighRiskCommand({
                operation: 'HCM_INTEGRATION_EXECUTE',
                commandMethod: 'POST',
                commandPath: `/api/people/v1/workforce/data-operations/hris/connectors/${encodeURIComponent(connector.connectorInstanceId)}/executions`,
                targetType: 'HCM_CONNECTOR',
                targetId: connector.connectorInstanceId,
                expectedObjectVersion: connector.version,
                payload: { syncMode },
              })
            )
          }
          onUpdate={(connector, request) =>
            operate(
              canUpdate,
              () =>
                updateIntegration((authority) =>
                  updateHrisConnector(connector, request, authority)
                ),
              t('provisioning.hris.toasts.lifecycle')
            )
          }
        />
      )}
      {view === 'runs' && (
        <RunView
          runs={runs.data ?? []}
          connectors={connectors.data ?? []}
          canExecute={canExecute}
          busy={busy}
          onRetry={(run) =>
            runRetry.begin(
              productSurfaceHighRiskCommand({
                operation: 'HCM_INTEGRATION_RETRY',
                commandMethod: 'POST',
                commandPath: `/api/people/v1/workforce/data-operations/hris/sync-runs/${encodeURIComponent(run.syncRunId)}/retry`,
                targetType: 'HCM_SYNC_RUN',
                targetId: run.syncRunId,
                expectedObjectVersion: run.version,
                payload: {},
              })
            )
          }
          onReconcile={(run, connector) =>
            reconciliation.begin(
              productSurfaceHighRiskCommand({
                operation: 'HCM_INTEGRATION_RECONCILE',
                commandMethod: 'POST',
                commandPath: `/api/people/v1/workforce/data-operations/hris/connectors/${encodeURIComponent(connector.connectorInstanceId)}/reconciliations`,
                targetType: 'HCM_CONNECTOR',
                targetId: connector.connectorInstanceId,
                expectedObjectVersion: connector.version,
                payload: { syncRunId: run.syncRunId },
              })
            )
          }
        />
      )}
      {view === 'reconciliation' && (
        <ReconciliationView
          issues={issues.data ?? []}
          runs={reconciliations.data ?? []}
          canUpdate={canUpdate}
          onResolve={setIssue}
        />
      )}
      {view === 'mappings' && (
        <MappingView
          mappings={mappings.data ?? []}
          canCreate={canCreate}
          canUpdate={canUpdate}
          busy={busy}
          onCreate={() => setCreateMappingOpen(true)}
          onActivate={(mapping) =>
            operate(
              canUpdate,
              () =>
                updateIntegration((authority) => activateHrisMappingProfile(mapping, authority)),
              t('provisioning.hris.toasts.mappingActivated')
            )
          }
        />
      )}

      {createConnectorOpen && (
        <ConnectorDialog
          busy={busy}
          onClose={() => setCreateConnectorOpen(false)}
          onSave={async (request) => {
            await operate(
              canCreate,
              () => createIntegration((authority) => createHrisConnector(request, authority)),
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
              canCreate,
              () => createIntegration((authority) => createHrisMappingProfile(request, authority)),
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
              canUpdate,
              () =>
                updateIntegration((authority) =>
                  resolveHrisReconciliationIssue(
                    issue.reconciliationIssueId,
                    state,
                    note,
                    authority
                  )
                ),
              t('provisioning.hris.toasts.issueResolved')
            );
            setIssue(null);
          }}
        />
      )}
      <ProductSurfaceHighRiskCommandDialog controller={configurationCheck.controller} />
      <ProductSurfaceHighRiskCommandDialog controller={connectorExecution.controller} />
      <ProductSurfaceHighRiskCommandDialog controller={runRetry.controller} />
      <ProductSurfaceHighRiskCommandDialog controller={reconciliation.controller} />
    </Box>
  );
}

function ConnectorView({
  connectors,
  mappings,
  canUpdate,
  canExecute,
  busy,
  onCheck,
  onExecute,
  onUpdate,
}: {
  connectors: HrisConnector[];
  mappings: Map<number, HrisMappingProfile>;
  canUpdate: boolean;
  canExecute: boolean;
  busy: boolean;
  onCheck: (connector: HrisConnector) => Promise<void>;
  onExecute: (connector: HrisConnector, syncMode: 'FULL' | 'DELTA') => Promise<void>;
  onUpdate: (
    connector: HrisConnector,
    request: {
      endpointUri?: string;
      credentialReference?: string;
      scheduleExpression?: string;
      lifecycleState: string;
    }
  ) => Promise<void>;
}) {
  const { t } = useTranslation('workforce');
  const display = useDisplayDictionary();
  if (!connectors.length) {
    return (
      <GuidedEmptyState
        kind={canUpdate || canExecute ? 'first-use' : 'permission'}
        title={t(
          canUpdate || canExecute
            ? 'provisioning.hris.empty.title'
            : 'provisioning.hris.empty.permissionTitle'
        )}
        description={t(
          canUpdate || canExecute
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
                disabled={!canExecute || busy}
                onClick={() => void onCheck(connector)}
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
                disabled={!canUpdate || busy || connector.lifecycleState === 'RETIRED'}
                onClick={() =>
                  void onUpdate(connector, {
                    endpointUri: connector.endpointUri ?? undefined,
                    credentialReference: connector.credentialReference ?? undefined,
                    scheduleExpression: connector.scheduleExpression ?? undefined,
                    lifecycleState: connector.lifecycleState === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE',
                  })
                }
              >
                {connector.lifecycleState === 'ACTIVE' ? <Pause size={16} /> : <Play size={16} />}
              </ActionIconButton>
              <ActionButton
                intent="secondary"
                size="small"
                disabled={!canExecute || busy || !runnable}
                onClick={() => void onExecute(connector, 'DELTA')}
              >
                {t('provisioning.hris.actions.deltaSync')}
              </ActionButton>
              <ActionButton
                intent="secondary"
                size="small"
                disabled={!canExecute || busy || !runnable}
                onClick={() => void onExecute(connector, 'FULL')}
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
  connectors,
  canExecute,
  busy,
  onRetry,
  onReconcile,
}: {
  runs: HrisSyncRun[];
  connectors: HrisConnector[];
  canExecute: boolean;
  busy: boolean;
  onRetry: (run: HrisSyncRun) => Promise<void>;
  onReconcile: (run: HrisSyncRun, connector: HrisConnector) => Promise<void>;
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
                disabled={!canExecute || busy}
                onClick={() => void onRetry(row)}
              >
                <RotateCcw size={15} />
              </ActionIconButton>
            )}
            {['SUCCEEDED', 'PARTIAL'].includes(row.lifecycleState) && row.connectorInstanceId && (
              <ActionIconButton
                label={t('provisioning.hris.actions.reconcile')}
                size="small"
                disabled={!canExecute || busy}
                onClick={() => {
                  const connector = connectors.find(
                    (candidate) => candidate.connectorInstanceId === row.connectorInstanceId
                  );
                  if (connector) void onReconcile(row, connector);
                }}
              >
                <GitCompareArrows size={15} />
              </ActionIconButton>
            )}
          </Stack>
        ),
      },
    ],
    [busy, canExecute, connectors, onReconcile, onRetry, t]
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
  canUpdate,
  onResolve,
}: {
  issues: HrisReconciliationIssue[];
  runs: Awaited<ReturnType<typeof listHrisReconciliations>>;
  canUpdate: boolean;
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
            disabled={!canUpdate}
            onClick={() => onResolve(row)}
          >
            <ArrowRight size={15} />
          </ActionIconButton>
        ),
      },
    ],
    [canUpdate, onResolve, t]
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
  canCreate,
  canUpdate,
  busy,
  onCreate,
  onActivate,
}: {
  mappings: HrisMappingProfile[];
  canCreate: boolean;
  canUpdate: boolean;
  busy: boolean;
  onCreate: () => void;
  onActivate: (mapping: HrisMappingProfile) => Promise<void>;
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
          disabled={!canCreate || busy}
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
              disabled={!canUpdate || busy}
              onClick={() => void onActivate(mapping)}
            >
              {t('provisioning.hris.actions.activate')}
            </ActionButton>
          )}
        </Stack>
      ))}
    </Box>
  );
}
