import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  KeyRound,
  Link2,
  RefreshCw,
  SearchCheck,
  Trash2,
  Unplug,
  WandSparkles,
} from 'lucide-react';
import { ActionButton, FormDialog, FormField, SelectField } from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';
import { getDwaionConnectors, type DwaionConnectorSummary } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { useDwaionAdminAdvancementCopy } from './dwaion-admin-advancement-copy';
import {
  DwaionCanonicalCommandActions,
  type DwaionCanonicalCommandAction,
} from './dwaion-canonical-command-actions';
import {
  DwaionAdminQueryBoundary,
  DwaionAdminSection,
  DwaionCapabilityNotice,
  DwaionFreshness,
  DwaionHealthChip,
} from './dwaion-admin-advancement-ui';
import {
  DwaionGovernedCommandDialog,
  type DwaionCommandIntent,
} from './dwaion-governed-command-dialog';
import {
  DwaionConnectorOperationDialog,
  type DwaionConnectorOperationDraft,
} from './dwaion-connector-operation-dialog';

type ConnectorDraft = {
  name: string;
  providerType: string;
  ownerRef: string;
  tenantScope: string;
  region: string;
  repositories: string;
  excludedRepositories: string;
  groupMappingSource: string;
  secretRef: string;
  retentionDays: string;
  deletionMode: 'SOFT_DELETE' | 'PURGE_AFTER_RETENTION';
};

const EMPTY_DRAFT: ConnectorDraft = {
  name: '',
  providerType: '',
  ownerRef: '',
  tenantScope: '',
  region: '',
  repositories: '',
  excludedRepositories: '',
  groupMappingSource: '',
  secretRef: '',
  retentionDays: '30',
  deletionMode: 'PURGE_AFTER_RETENTION',
};

type ConnectorOperation =
  | 'CONNECTOR_PROBE'
  | 'CONNECTOR_SYNC'
  | 'CONNECTOR_REINDEX'
  | 'CONNECTOR_SECRET_ROTATE'
  | 'CONNECTOR_SCOPE_REDUCE'
  | 'CONNECTOR_REVOKE'
  | 'CONNECTOR_DELETE';

export function DwaionConnectorOperationsPanel() {
  const copy = useDwaionAdminAdvancementCopy();
  const query = useQuery({
    queryKey: ['dwaion', 'admin', 'control-plane', 'connectors'],
    queryFn: getDwaionConnectors,
    staleTime: 20_000,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [intent, setIntent] = useState<DwaionCommandIntent | null>(null);
  const [wizard, setWizard] = useState<ConnectorDraft | null>(null);
  const [operationDraft, setOperationDraft] = useState<DwaionConnectorOperationDraft | null>(null);
  const connectors = useMemo(() => query.data?.connectors ?? [], [query.data?.connectors]);
  const commandsAvailable =
    query.data?.capability.status === 'AVAILABLE' && query.data.capability.configured;
  const selected = useMemo(
    () => connectors.find((connector) => connector.connectorId === selectedId) ?? connectors[0],
    [connectors, selectedId]
  );

  useEffect(() => {
    const openWizard = () => {
      if (commandsAvailable) setWizard({ ...EMPTY_DRAFT });
    };
    window.addEventListener('dwaion:open-connector-wizard', openWizard);
    return () => window.removeEventListener('dwaion:open-connector-wizard', openWizard);
  }, [commandsAvailable]);

  const openOperation = (operation: ConnectorOperation) => {
    if (!selected) return;
    setOperationDraft(initialOperationDraft(operation, selected));
  };

  const submitOperation = () => {
    if (!selected || !operationDraft) return;
    const operation = operationDraft.operation;
    const destructive = ['CONNECTOR_SCOPE_REDUCE', 'CONNECTOR_REVOKE', 'CONNECTOR_DELETE'].includes(
      operation
    );
    setIntent({
      title: operationLabel(operation, copy.connectors),
      description: copy.command.description,
      kind: operation,
      target: { type: 'CONNECTOR', id: selected.connectorId },
      expectedVersion: selected.version,
      changes: [
        { label: 'Lifecycle action', before: selected.syncState, after: operation },
        ...connectorOperationChanges(operationDraft, selected),
      ],
      impacts: [
        selected.tenantScope,
        ...selected.repositories,
        'ACL and indexed content',
        ...connectorOperationImpacts(operationDraft),
      ],
      recoveryPlan:
        'Pause new sync jobs, restore the last verified connector revision, rotate credentials, and re-run ACL probes before resuming.',
      payload: { connectorId: selected.connectorId, ...operationDraft },
      destructive,
    });
    setOperationDraft(null);
  };

  const createConnector = () => {
    if (!wizard) return;
    setIntent({
      title: copy.connectors.create,
      description: copy.command.description,
      kind: 'CONNECTOR_CREATE',
      target: { type: 'CONNECTOR', id: wizard.name.trim().toLowerCase().replace(/\s+/g, '-') },
      expectedVersion: 0,
      changes: [
        { label: 'Owner', before: '—', after: wizard.ownerRef },
        { label: 'Tenant scope', before: '—', after: wizard.tenantScope },
        { label: 'Repositories', before: '—', after: wizard.repositories },
        {
          label: 'Excluded repositories',
          before: '—',
          after: wizard.excludedRepositories || 'None',
        },
        { label: 'Retention', before: '—', after: `${wizard.retentionDays} days` },
        { label: 'Deletion', before: '—', after: wizard.deletionMode },
      ],
      impacts: [wizard.tenantScope, wizard.repositories, wizard.groupMappingSource],
      recoveryPlan:
        'Keep the connector disabled, revoke the secret reference, delete partial indexes, and verify source ACLs.',
      payload: {
        ...wizard,
        repositories: splitList(wizard.repositories),
        excludedRepositories: splitList(wizard.excludedRepositories),
        retentionDays: Number(wizard.retentionDays),
      },
    });
    setWizard(null);
  };

  return (
    <Box id="dwaion-connector-operations" sx={{ mt: 2.5, scrollMarginTop: 16 }}>
      <DwaionAdminQueryBoundary
        loading={query.isLoading}
        error={query.isError}
        fetching={query.isFetching}
        onRetry={() => void query.refetch()}
      >
        {query.data && (
          <Stack spacing={2}>
            <DwaionCapabilityNotice capability={query.data.capability} />
            <DwaionAdminSection
              title={copy.connectors.title}
              description={copy.connectors.description}
              actions={
                <Stack direction="row" gap={1} flexWrap="wrap">
                  <DwaionFreshness
                    generatedAt={query.data.generatedAt}
                    fetching={query.isFetching}
                    onRefresh={() => void query.refetch()}
                  />
                  <ActionButton
                    disabled={!commandsAvailable}
                    intent="primary"
                    startIcon={<Link2 size={16} />}
                    onClick={() => setWizard({ ...EMPTY_DRAFT })}
                  >
                    {copy.connectors.create}
                  </ActionButton>
                </Stack>
              }
            >
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: 'minmax(0,1fr)',
                    lg: 'minmax(16rem,4fr) minmax(0,8fr)',
                  },
                }}
              >
                <Stack
                  divider={<Divider flexItem />}
                  sx={{
                    borderRight: { lg: 1 },
                    borderBottom: { xs: 1, lg: 0 },
                    borderColor: 'divider',
                  }}
                >
                  {connectors.map((connector) => (
                    <ConnectorRow
                      key={connector.connectorId}
                      connector={connector}
                      active={connector.connectorId === selected?.connectorId}
                      onSelect={() => setSelectedId(connector.connectorId)}
                    />
                  ))}
                </Stack>
                {selected ? (
                  <Stack spacing={2} sx={{ p: { xs: 1.75, md: 2.25 }, minWidth: 0 }}>
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      justifyContent="space-between"
                      gap={1}
                    >
                      <Box>
                        <Typography component="h3" variant="h6">
                          {selected.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {selected.ownerRef} · {selected.tenantScope} ·{' '}
                          {selected.region ?? 'global'} {copy.ui.common.versionSeparator}
                          {selected.version}
                        </Typography>
                      </Box>
                      <DwaionHealthChip health={selected.health} />
                    </Stack>
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4,1fr)' },
                        gap: 1.25,
                      }}
                    >
                      <Fact label={copy.ui.connectors.syncStatus} value={selected.syncState} />
                      <Fact
                        label={copy.ui.connectors.aclCoverage}
                        value={
                          selected.aclCoverage == null ? '—' : `${selected.aclCoverage.toFixed(2)}%`
                        }
                      />
                      <Fact
                        label={copy.ui.connectors.repositories}
                        value={String(selected.repositories.length)}
                      />
                      <Fact
                        label={copy.ui.connectors.lastSync}
                        value={
                          selected.lastSuccessfulSyncAt
                            ? formatDate(selected.lastSuccessfulSyncAt, {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              })
                            : '—'
                        }
                      />
                    </Box>
                    <Divider />
                    <Stack direction="row" gap={1} flexWrap="wrap">
                      <ActionButton
                        disabled={!commandsAvailable}
                        intent="secondary"
                        startIcon={<SearchCheck size={16} />}
                        onClick={() => openOperation('CONNECTOR_PROBE')}
                      >
                        {copy.connectors.probe}
                      </ActionButton>
                      <ActionButton
                        disabled={!commandsAvailable}
                        intent="secondary"
                        startIcon={<RefreshCw size={16} />}
                        onClick={() => openOperation('CONNECTOR_SYNC')}
                      >
                        {copy.connectors.sync}
                      </ActionButton>
                      <ActionButton
                        disabled={!commandsAvailable}
                        intent="secondary"
                        startIcon={<WandSparkles size={16} />}
                        onClick={() => openOperation('CONNECTOR_REINDEX')}
                      >
                        {copy.connectors.reindex}
                      </ActionButton>
                      <ActionButton
                        disabled={!commandsAvailable}
                        intent="secondary"
                        startIcon={<KeyRound size={16} />}
                        onClick={() => openOperation('CONNECTOR_SECRET_ROTATE')}
                      >
                        {copy.connectors.rotate}
                      </ActionButton>
                      <ActionButton
                        disabled={!commandsAvailable}
                        intent="danger"
                        onClick={() => openOperation('CONNECTOR_SCOPE_REDUCE')}
                      >
                        {copy.connectors.reduce}
                      </ActionButton>
                      <ActionButton
                        disabled={!commandsAvailable}
                        intent="danger"
                        startIcon={<Unplug size={16} />}
                        onClick={() => openOperation('CONNECTOR_REVOKE')}
                      >
                        {copy.connectors.revoke}
                      </ActionButton>
                      <ActionButton
                        disabled={!commandsAvailable}
                        intent="danger"
                        startIcon={<Trash2 size={16} />}
                        onClick={() => openOperation('CONNECTOR_DELETE')}
                      >
                        {copy.connectors.delete}
                      </ActionButton>
                    </Stack>
                  </Stack>
                ) : (
                  <Typography color="text.secondary" sx={{ p: 3 }}>
                    {copy.notConfigured}
                  </Typography>
                )}
              </Box>
            </DwaionAdminSection>
            {selected && (
              <DwaionCanonicalCommandActions
                title={copy.ui.connectors.lifecycleOperations}
                description={copy.ui.connectors.lifecycleOperationsDescription}
                actions={connectorCanonicalActions(selected, copy.command.description)}
                disabled={!commandsAvailable}
                onRefresh={async () => {
                  await query.refetch();
                }}
              />
            )}
          </Stack>
        )}
      </DwaionAdminQueryBoundary>

      <ConnectorWizard
        value={wizard}
        onChange={setWizard}
        onClose={() => setWizard(null)}
        onSubmit={createConnector}
      />
      <DwaionConnectorOperationDialog
        value={operationDraft}
        connectorName={selected?.name ?? ''}
        title={operationDraft ? operationLabel(operationDraft.operation, copy.connectors) : ''}
        onChange={setOperationDraft}
        onClose={() => setOperationDraft(null)}
        onSubmit={submitOperation}
      />
      <DwaionGovernedCommandDialog
        intent={intent}
        onClose={() => setIntent(null)}
        onReconcile={async () => {
          await query.refetch();
        }}
        onCompleted={async () => {
          setIntent(null);
          await query.refetch();
        }}
      />
    </Box>
  );
}

function ConnectorRow({
  connector,
  active,
  onSelect,
}: {
  connector: DwaionConnectorSummary;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <ButtonBase
      aria-pressed={active}
      onClick={onSelect}
      sx={{
        width: 1,
        textAlign: 'left',
        px: 2,
        py: 1.5,
        bgcolor: active ? 'action.selected' : undefined,
      }}
    >
      <Box sx={{ width: 1, minWidth: 0 }}>
        <Stack direction="row" justifyContent="space-between" gap={1}>
          <Typography variant="subtitle2" noWrap>
            {connector.name}
          </Typography>
          <Chip size="small" label={connector.syncState} />
        </Stack>
        <Typography variant="caption" color="text.secondary">
          {connector.providerType} · {connector.ownerRef}
        </Typography>
      </Box>
    </ButtonBase>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ p: 1.25, bgcolor: 'action.hover', borderRadius: 1.5, minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={700} sx={{ mt: 0.25, overflowWrap: 'anywhere' }}>
        {value}
      </Typography>
    </Box>
  );
}

function ConnectorWizard({
  value,
  onChange,
  onClose,
  onSubmit,
}: {
  value: ConnectorDraft | null;
  onChange: (value: ConnectorDraft | null) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const copy = useDwaionAdminAdvancementCopy();
  const valid = Boolean(
    value?.name.trim() &&
    value.ownerRef.trim() &&
    value.tenantScope.trim() &&
    value.providerType.trim() &&
    value.secretRef.trim() &&
    Number.isInteger(Number(value.retentionDays)) &&
    Number(value.retentionDays) > 0
  );
  if (!value) return null;
  return (
    <FormDialog
      open
      title={copy.connectors.create}
      description={copy.connectors.description}
      cancelLabel={copy.command.cancel}
      submitLabel={copy.command.submit}
      submitDisabled={!valid}
      mobileFullScreen
      onClose={onClose}
      onSubmit={onSubmit}
    >
      <Stack spacing={1.75}>
        <FormField
          required
          label={copy.ui.connectors.name}
          value={value.name}
          onChange={(event) => onChange({ ...value, name: event.target.value })}
        />
        <FormField
          required
          label={copy.ui.connectors.providerType}
          value={value.providerType}
          onChange={(event) => onChange({ ...value, providerType: event.target.value })}
        />
        <FormField
          required
          label={copy.ui.connectors.owner}
          value={value.ownerRef}
          onChange={(event) => onChange({ ...value, ownerRef: event.target.value })}
        />
        <FormField
          required
          label={copy.ui.connectors.tenantScope}
          value={value.tenantScope}
          onChange={(event) => onChange({ ...value, tenantScope: event.target.value })}
        />
        <FormField
          label={copy.ui.connectors.region}
          value={value.region}
          onChange={(event) => onChange({ ...value, region: event.target.value })}
        />
        <FormField
          label={copy.ui.connectors.includeRepositories}
          value={value.repositories}
          onChange={(event) => onChange({ ...value, repositories: event.target.value })}
        />
        <FormField
          label={copy.ui.connectors.excludeRepositories}
          value={value.excludedRepositories}
          onChange={(event) => onChange({ ...value, excludedRepositories: event.target.value })}
        />
        <FormField
          label={copy.ui.connectors.groupMappingSource}
          value={value.groupMappingSource}
          onChange={(event) => onChange({ ...value, groupMappingSource: event.target.value })}
        />
        <FormField
          required
          label={copy.ui.connectors.secretReference}
          value={value.secretRef}
          onChange={(event) => onChange({ ...value, secretRef: event.target.value })}
        />
        <FormField
          type="number"
          label={copy.ui.connectors.retentionDays}
          value={value.retentionDays}
          onChange={(event) => onChange({ ...value, retentionDays: event.target.value })}
        />
        <SelectField
          label={copy.ui.connectors.deletionPolicy}
          value={value.deletionMode}
          options={(['SOFT_DELETE', 'PURGE_AFTER_RETENTION'] as const).map((mode) => ({
            value: mode,
            label: mode,
          }))}
          onValueChange={(deletionMode) => deletionMode && onChange({ ...value, deletionMode })}
        />
      </Stack>
    </FormDialog>
  );
}

function splitList(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function operationLabel(
  operation: ConnectorOperation,
  copy: ReturnType<typeof useDwaionAdminAdvancementCopy>['connectors']
) {
  const labels: Record<ConnectorOperation, string> = {
    CONNECTOR_PROBE: copy.probe,
    CONNECTOR_SYNC: copy.sync,
    CONNECTOR_REINDEX: copy.reindex,
    CONNECTOR_SECRET_ROTATE: copy.rotate,
    CONNECTOR_SCOPE_REDUCE: copy.reduce,
    CONNECTOR_REVOKE: copy.revoke,
    CONNECTOR_DELETE: copy.delete,
  };
  return labels[operation];
}

function initialOperationDraft(
  operation: ConnectorOperation,
  connector: DwaionConnectorSummary
): DwaionConnectorOperationDraft {
  const repositoryScope = connector.repositories.join(', ');
  if (operation === 'CONNECTOR_PROBE') {
    return { operation, repositoryScope, principalSamples: '' };
  }
  if (operation === 'CONNECTOR_SYNC') {
    return { operation, repositoryScope, mode: 'INCREMENTAL' };
  }
  if (operation === 'CONNECTOR_REINDEX') {
    return { operation, repositoryScope, staleIndexPolicy: 'KEEP_UNTIL_VERIFIED' };
  }
  if (operation === 'CONNECTOR_SECRET_ROTATE') {
    return { operation, newSecretRef: '', overlapMinutes: '15' };
  }
  if (operation === 'CONNECTOR_SCOPE_REDUCE') {
    return {
      operation,
      newTenantScope: connector.tenantScope,
      excludedRepositories: '',
      groupMappingSource: '',
    };
  }
  if (operation === 'CONNECTOR_REVOKE') {
    return { operation, inFlightPolicy: 'DRAIN', revokeAt: new Date().toISOString() };
  }
  return { operation, confirmation: '', retentionEvidenceRef: '' };
}

function connectorOperationChanges(
  draft: DwaionConnectorOperationDraft,
  connector: DwaionConnectorSummary
) {
  if (draft.operation === 'CONNECTOR_SCOPE_REDUCE') {
    return [
      { label: 'Tenant scope', before: connector.tenantScope, after: draft.newTenantScope },
      {
        label: 'Excluded repositories',
        before: 'None',
        after: draft.excludedRepositories,
      },
    ];
  }
  if (draft.operation === 'CONNECTOR_SECRET_ROTATE') {
    return [
      { label: 'Secret reference', before: 'Current secret', after: draft.newSecretRef },
      { label: 'Overlap', before: '—', after: `${draft.overlapMinutes} minutes` },
    ];
  }
  if (draft.operation === 'CONNECTOR_REVOKE') {
    return [
      { label: 'Access', before: 'Granted', after: `Revoked at ${draft.revokeAt}` },
      { label: 'In-flight sync', before: connector.syncState, after: draft.inFlightPolicy },
    ];
  }
  if (draft.operation === 'CONNECTOR_DELETE') {
    return [{ label: 'Connector', before: connector.name, after: 'Deletion pending' }];
  }
  return [
    {
      label: 'Repository scope',
      before: connector.repositories.join(', '),
      after: draft.repositoryScope,
    },
  ];
}

function connectorOperationImpacts(draft: DwaionConnectorOperationDraft) {
  if (draft.operation === 'CONNECTOR_PROBE') return [draft.principalSamples];
  if (draft.operation === 'CONNECTOR_SYNC') return [draft.mode, draft.repositoryScope];
  if (draft.operation === 'CONNECTOR_REINDEX') {
    return [draft.repositoryScope, draft.staleIndexPolicy];
  }
  if (draft.operation === 'CONNECTOR_SECRET_ROTATE') {
    return [draft.newSecretRef, `${draft.overlapMinutes} minute overlap`];
  }
  if (draft.operation === 'CONNECTOR_SCOPE_REDUCE') {
    return [draft.newTenantScope, draft.excludedRepositories, draft.groupMappingSource];
  }
  if (draft.operation === 'CONNECTOR_REVOKE') return [draft.revokeAt, draft.inFlightPolicy];
  return [draft.retentionEvidenceRef, 'Indexed content and credentials'];
}

function connectorCanonicalActions(
  connector: DwaionConnectorSummary,
  description: string
): DwaionCanonicalCommandAction[] {
  const target = { type: 'CONNECTOR', id: connector.connectorId };
  const common = {
    description,
    target,
    expectedVersion: connector.version,
    impacts: [connector.tenantScope, ...connector.repositories, 'ACL-derived retrieval results'],
    recoveryPlan:
      'Restore the last verified connector revision, rotate credentials, rerun ACL probes, and resume with a bounded sync.',
  };
  return [
    {
      ...common,
      label: 'Save connector draft',
      title: 'Save governed connector draft',
      kind: 'CONNECTOR_DRAFT_SAVE',
      changes: [{ label: 'Draft', before: `v${connector.version}`, after: 'New draft revision' }],
      payload: { connectorId: connector.connectorId, basedOnVersion: connector.version },
    },
    {
      ...common,
      label: 'OAuth reauthorize',
      title: 'Reauthorize connector OAuth grant',
      kind: 'CONNECTOR_OAUTH_REAUTHORIZE',
      changes: [
        { label: 'OAuth grant', before: 'Current grant', after: 'REAUTHORIZATION_PENDING' },
      ],
      payload: { connectorId: connector.connectorId, providerType: connector.providerType },
    },
    {
      ...common,
      label: 'Quarantine',
      title: 'Quarantine connector',
      kind: 'CONNECTOR_QUARANTINE',
      changes: [{ label: 'Serving state', before: connector.syncState, after: 'QUARANTINED' }],
      payload: { connectorId: connector.connectorId, inFlightPolicy: 'DRAIN' },
      destructive: true,
    },
    {
      ...common,
      label: 'Pause sync',
      title: 'Pause connector synchronization',
      kind: 'CONNECTOR_PAUSE',
      changes: [{ label: 'Sync state', before: connector.syncState, after: 'PAUSE_PENDING' }],
      payload: { connectorId: connector.connectorId, inFlightPolicy: 'DRAIN' },
    },
    {
      ...common,
      label: 'Heal ACL drift',
      title: 'Heal connector ACL drift',
      kind: 'CONNECTOR_DRIFT_HEAL',
      changes: [
        {
          label: 'ACL coverage',
          before: connector.aclCoverage == null ? 'Unknown' : `${connector.aclCoverage}%`,
          after: 'RECONCILIATION_PENDING',
        },
      ],
      payload: {
        connectorId: connector.connectorId,
        repositories: connector.repositories,
        verifyBeforePublish: true,
      },
    },
    {
      ...common,
      label: 'Connector kill switch',
      title: 'Activate connector kill switch',
      kind: 'CONNECTOR_KILL_SWITCH',
      changes: [{ label: 'Connector state', before: connector.syncState, after: 'KILL_PENDING' }],
      payload: { connectorId: connector.connectorId, revokeCredentials: true, stopServing: true },
      destructive: true,
    },
  ];
}
