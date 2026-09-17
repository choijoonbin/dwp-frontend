import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, CircleStop, Play, RotateCcw, ShieldAlert, ShieldCheck } from 'lucide-react';
import { OperationalKpiStrip } from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';
import { getDwaionIncidents, type DwaionIncidentSummary } from '@dwp-frontend/shared-utils';

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
} from './dwaion-admin-advancement-ui';
import {
  DwaionGovernedCommandDialog,
  type DwaionCommandIntent,
} from './dwaion-governed-command-dialog';
import {
  DwaionIncidentOperationDialog,
  type DwaionIncidentOperationDraft,
} from './dwaion-incident-operation-dialog';
import { DwaionCommandCapabilityButton } from './dwaion-command-capability-button';

type IncidentOperation =
  | 'INCIDENT_CONTAIN'
  | 'RUN_QUARANTINE'
  | 'RUN_REPLAY'
  | 'RUN_COMPENSATE'
  | 'INCIDENT_RECOVERY'
  | 'INCIDENT_CLOSE';

export function DwaionIncidentWorkbenchPanel() {
  const copy = useDwaionAdminAdvancementCopy();
  const query = useQuery({
    queryKey: ['dwaion', 'admin', 'control-plane', 'incidents'],
    queryFn: getDwaionIncidents,
    staleTime: 10_000,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [intent, setIntent] = useState<DwaionCommandIntent | null>(null);
  const [operationDraft, setOperationDraft] = useState<DwaionIncidentOperationDraft | null>(null);
  const incidents = useMemo(() => query.data?.incidents ?? [], [query.data?.incidents]);
  const selected = useMemo(
    () => incidents.find((incident) => incident.incidentId === selectedId) ?? incidents[0],
    [incidents, selectedId]
  );

  const open = (operation: IncidentOperation) => {
    if (!selected) return;
    setOperationDraft(initialDraft(operation, selected));
  };

  const submitOperation = () => {
    if (!selected || !operationDraft) return;
    const operation = operationDraft.operation;
    const recovery = operation === 'INCIDENT_RECOVERY' || operation === 'INCIDENT_CLOSE';
    setIntent({
      title: operationLabel(operation, copy.incidents),
      description: copy.command.description,
      kind: operation,
      target: { type: 'AI_INCIDENT', id: selected.incidentId },
      expectedVersion: selected.version,
      changes: [
        { label: 'Incident state', before: selected.state, after: operationAfter(operation) },
        {
          label: 'Affected runs',
          before: String(selected.affectedRunCount),
          after: recovery ? 'VALIDATION_REQUIRED' : 'CONTAINED',
        },
        ...operationChanges(operationDraft),
      ],
      impacts: [
        selected.scope,
        `${selected.affectedRunCount} runs`,
        `${selected.affectedUserCount ?? 'unknown'} users`,
        selected.correlationId,
        ...operationImpacts(operationDraft),
      ],
      recoveryPlan:
        'Keep the route isolated, validate canary traffic, separate replay from compensation, and re-quarantine on any failed check.',
      payload: {
        correlationId: selected.correlationId,
        affectedRunCount: selected.affectedRunCount,
        ownerRef: selected.ownerRef,
        operation: operationDraft,
      },
      destructive: !recovery,
    });
    setOperationDraft(null);
  };

  return (
    <Box id="dwaion-incident-workbench" sx={{ mt: 2.5, scrollMarginTop: 16 }}>
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
              title={copy.incidents.title}
              description={copy.incidents.description}
              actions={
                <DwaionFreshness
                  generatedAt={query.data.generatedAt}
                  fetching={query.isFetching}
                  onRefresh={() => void query.refetch()}
                />
              }
            >
              <OperationalKpiStrip
                ariaLabel={copy.ui.incidents.summaryLabel}
                items={[
                  {
                    key: 'open',
                    label: 'Open incidents',
                    value: incidents.filter((item) => item.state !== 'CLOSED').length,
                    tone: incidents.some((item) => item.severity === 'SEV1')
                      ? 'critical'
                      : 'warning',
                  },
                  {
                    key: 'runs',
                    label: 'Affected runs',
                    value: incidents.reduce((sum, item) => sum + item.affectedRunCount, 0),
                  },
                  {
                    key: 'quarantine',
                    label: 'Quarantined runs',
                    value: query.data.quarantinedRunCount,
                    tone: 'warning',
                  },
                  {
                    key: 'approval',
                    label: 'Recovery approvals',
                    value: query.data.recoveryApprovalCount,
                    tone: query.data.recoveryApprovalCount ? 'info' : 'neutral',
                  },
                ]}
              />
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: 'minmax(0,1fr)',
                    lg: 'minmax(17rem,4fr) minmax(0,8fr)',
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
                  {incidents.map((incident) => (
                    <IncidentRow
                      key={incident.incidentId}
                      incident={incident}
                      active={incident.incidentId === selected?.incidentId}
                      runsLabel={copy.ui.common.runsUnit}
                      onSelect={() => setSelectedId(incident.incidentId)}
                    />
                  ))}
                </Stack>
                {selected && (
                  <Stack spacing={2} sx={{ p: { xs: 1.75, md: 2.25 } }}>
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      justifyContent="space-between"
                      gap={1}
                    >
                      <Box>
                        <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
                          <Typography component="h3" variant="h6">
                            {selected.title}
                          </Typography>
                          <Chip
                            size="small"
                            color={severityColor(selected.severity)}
                            label={selected.severity}
                          />
                          <Chip size="small" variant="outlined" label={selected.state} />
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          {selected.incidentId} · {selected.correlationId}{' '}
                          {copy.ui.common.versionSeparator}
                          {selected.version}
                        </Typography>
                      </Box>
                      <Typography variant="body2" fontWeight={700}>
                        {selected.scope}
                      </Typography>
                    </Stack>
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4,1fr)' },
                        gap: 1,
                      }}
                    >
                      <Fact
                        label={copy.ui.incidents.affectedRuns}
                        value={String(selected.affectedRunCount)}
                      />
                      <Fact
                        label={copy.ui.incidents.affectedUsers}
                        value={
                          selected.affectedUserCount == null
                            ? '—'
                            : String(selected.affectedUserCount)
                        }
                      />
                      <Fact
                        label={copy.ui.incidents.owner}
                        value={selected.ownerRef ?? 'Unassigned'}
                      />
                      <Fact
                        label={copy.ui.incidents.opened}
                        value={formatDate(selected.openedAt, {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      />
                    </Box>
                    <Divider />
                    <Box>
                      <Typography component="h4" variant="subtitle2">
                        {copy.ui.incidents.immutableTimeline}
                      </Typography>
                      <Stack divider={<Divider flexItem />} sx={{ mt: 0.75 }}>
                        {selected.timeline.map((event) => (
                          <Stack key={event.eventId} spacing={0.25} sx={{ py: 1 }}>
                            <Stack direction="row" justifyContent="space-between" gap={1}>
                              <Typography variant="body2" fontWeight={700}>
                                {event.type}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {formatDate(event.occurredAt, {
                                  dateStyle: 'medium',
                                  timeStyle: 'short',
                                })}
                              </Typography>
                            </Stack>
                            <Typography variant="body2">{event.summary}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {event.actorRef ?? 'System'}
                              {event.evidenceRefs.length > 0
                                ? ` · ${event.evidenceRefs.join(' · ')}`
                                : ''}
                            </Typography>
                          </Stack>
                        ))}
                      </Stack>
                    </Box>
                    <Divider />
                    <Stack direction="row" gap={1} flexWrap="wrap">
                      <DwaionCommandCapabilityButton
                        commandKind="INCIDENT_CONTAIN"
                        intent="danger"
                        startIcon={<ShieldAlert size={16} />}
                        onClick={() => open('INCIDENT_CONTAIN')}
                      >
                        {copy.incidents.contain}
                      </DwaionCommandCapabilityButton>
                      <DwaionCommandCapabilityButton
                        commandKind="RUN_QUARANTINE"
                        intent="danger"
                        startIcon={<CircleStop size={16} />}
                        onClick={() => open('RUN_QUARANTINE')}
                      >
                        {copy.incidents.quarantine}
                      </DwaionCommandCapabilityButton>
                      <DwaionCommandCapabilityButton
                        commandKind="RUN_REPLAY"
                        intent="secondary"
                        startIcon={<Play size={16} />}
                        onClick={() => open('RUN_REPLAY')}
                      >
                        {copy.incidents.replay}
                      </DwaionCommandCapabilityButton>
                      <DwaionCommandCapabilityButton
                        commandKind="RUN_COMPENSATE"
                        intent="secondary"
                        startIcon={<RotateCcw size={16} />}
                        onClick={() => open('RUN_COMPENSATE')}
                      >
                        {copy.incidents.compensate}
                      </DwaionCommandCapabilityButton>
                      <DwaionCommandCapabilityButton
                        commandKind="INCIDENT_RECOVERY"
                        intent="primary"
                        startIcon={<ShieldCheck size={16} />}
                        onClick={() => open('INCIDENT_RECOVERY')}
                      >
                        {copy.incidents.recover}
                      </DwaionCommandCapabilityButton>
                      <DwaionCommandCapabilityButton
                        commandKind="INCIDENT_CLOSE"
                        intent="secondary"
                        startIcon={<CheckCircle2 size={16} />}
                        onClick={() => open('INCIDENT_CLOSE')}
                      >
                        {copy.incidents.close}
                      </DwaionCommandCapabilityButton>
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {copy.ui.incidents.replayExplanation}
                    </Typography>
                  </Stack>
                )}
              </Box>
            </DwaionAdminSection>
            {selected && (
              <DwaionCanonicalCommandActions
                title={copy.ui.incidents.responseOperations}
                description={copy.ui.incidents.responseOperationsDescription}
                actions={incidentCanonicalActions(selected, copy.command.description)}
                disabled={false}
                onRefresh={async () => {
                  await query.refetch();
                }}
              />
            )}
          </Stack>
        )}
      </DwaionAdminQueryBoundary>
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
      <DwaionIncidentOperationDialog
        value={operationDraft}
        title={operationDraft ? operationLabel(operationDraft.operation, copy.incidents) : ''}
        onChange={setOperationDraft}
        onClose={() => setOperationDraft(null)}
        onSubmit={submitOperation}
      />
    </Box>
  );
}

function IncidentRow({
  incident,
  active,
  runsLabel,
  onSelect,
}: {
  incident: DwaionIncidentSummary;
  active: boolean;
  runsLabel: string;
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
            {incident.title}
          </Typography>
          <Chip size="small" color={severityColor(incident.severity)} label={incident.severity} />
        </Stack>
        <Typography variant="caption" color="text.secondary">
          {incident.state} · {incident.affectedRunCount} {runsLabel}
        </Typography>
      </Box>
    </ButtonBase>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ minWidth: 0, p: 1.25, bgcolor: 'action.hover', borderRadius: 1.5 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={700} sx={{ mt: 0.25, overflowWrap: 'anywhere' }}>
        {value}
      </Typography>
    </Box>
  );
}

function severityColor(
  severity: DwaionIncidentSummary['severity']
): 'error' | 'warning' | 'default' {
  if (severity === 'SEV1') return 'error';
  if (severity === 'SEV2' || severity === 'SEV3') return 'warning';
  return 'default';
}

function operationAfter(operation: IncidentOperation) {
  const states: Record<IncidentOperation, string> = {
    INCIDENT_CONTAIN: 'CONTAINMENT_PENDING',
    RUN_QUARANTINE: 'QUARANTINE_PENDING',
    RUN_REPLAY: 'REPLAY_PENDING',
    RUN_COMPENSATE: 'COMPENSATION_PENDING',
    INCIDENT_RECOVERY: 'RECOVERY_APPROVAL_PENDING',
    INCIDENT_CLOSE: 'CLOSE_PENDING',
  };
  return states[operation];
}

function operationLabel(
  operation: IncidentOperation,
  copy: ReturnType<typeof useDwaionAdminAdvancementCopy>['incidents']
) {
  const labels: Record<IncidentOperation, string> = {
    INCIDENT_CONTAIN: copy.contain,
    RUN_QUARANTINE: copy.quarantine,
    RUN_REPLAY: copy.replay,
    RUN_COMPENSATE: copy.compensate,
    INCIDENT_RECOVERY: copy.recover,
    INCIDENT_CLOSE: copy.close,
  };
  return labels[operation];
}

function initialDraft(
  operation: IncidentOperation,
  incident: DwaionIncidentSummary
): DwaionIncidentOperationDraft {
  if (operation === 'INCIDENT_CONTAIN') {
    return {
      operation,
      isolationScopes: incident.scope,
      fallbackRoute: '',
      inFlightAction: 'PAUSE',
      correlationId: incident.correlationId,
      ownerRef: incident.ownerRef ?? '',
    };
  }
  if (operation === 'RUN_QUARANTINE') {
    return { operation, runIds: '', quarantineReason: incident.title };
  }
  if (operation === 'RUN_REPLAY') {
    return {
      operation,
      sourceRunIds: '',
      checkpointRef: '',
      inputPolicy: 'IMMUTABLE_ORIGINAL_INPUT',
      idempotencyScope: incident.correlationId,
    };
  }
  if (operation === 'RUN_COMPENSATE') {
    return {
      operation,
      targetRunIds: '',
      domainAction: '',
      compensationPolicy: '',
      ownerRef: incident.ownerRef ?? '',
    };
  }
  if (operation === 'INCIDENT_RECOVERY') {
    return {
      operation,
      validationEvidence: '',
      canaryPercent: '5',
      canaryMinutes: '30',
      reQuarantineCriteria: '',
    };
  }
  return {
    operation,
    falsePositive: 'NO',
    ticketRef: '',
    communicationsRef: '',
    postmortemRef: '',
    resolutionSummary: '',
  };
}

function operationChanges(draft: DwaionIncidentOperationDraft) {
  if (draft.operation === 'INCIDENT_CONTAIN') {
    return [
      { label: 'Isolation scope', before: 'Active', after: draft.isolationScopes },
      { label: 'Fallback', before: 'Current route', after: draft.fallbackRoute },
      { label: 'In-flight work', before: 'Running', after: draft.inFlightAction },
    ];
  }
  if (draft.operation === 'RUN_QUARANTINE') {
    return [{ label: 'Run selector', before: 'Active', after: draft.runIds }];
  }
  if (draft.operation === 'RUN_REPLAY') {
    return [
      { label: 'Source runs', before: draft.sourceRunIds, after: 'New governed runs' },
      { label: 'Checkpoint', before: 'Original', after: draft.checkpointRef },
    ];
  }
  if (draft.operation === 'RUN_COMPENSATE') {
    return [
      { label: 'Domain action', before: draft.domainAction, after: 'Compensation pending' },
      { label: 'Target runs', before: draft.targetRunIds, after: 'Compensated' },
    ];
  }
  if (draft.operation === 'INCIDENT_RECOVERY') {
    return [
      { label: 'Canary traffic', before: 'Isolated', after: `${draft.canaryPercent}%` },
      { label: 'Validation window', before: '—', after: `${draft.canaryMinutes} minutes` },
    ];
  }
  return [
    {
      label: 'Closure classification',
      before: 'Open',
      after: draft.falsePositive === 'YES' ? 'False positive' : 'Confirmed incident',
    },
    { label: 'Postmortem', before: 'Pending', after: draft.postmortemRef },
  ];
}

function operationImpacts(draft: DwaionIncidentOperationDraft) {
  if (draft.operation === 'INCIDENT_CONTAIN') {
    return [
      draft.isolationScopes,
      `Fallback ${draft.fallbackRoute}`,
      `${draft.inFlightAction} in-flight`,
    ];
  }
  if (draft.operation === 'RUN_QUARANTINE') return [draft.runIds, draft.quarantineReason];
  if (draft.operation === 'RUN_REPLAY') {
    return [draft.sourceRunIds, draft.checkpointRef, draft.idempotencyScope];
  }
  if (draft.operation === 'RUN_COMPENSATE') {
    return [draft.targetRunIds, draft.domainAction, draft.compensationPolicy];
  }
  if (draft.operation === 'INCIDENT_RECOVERY') {
    return [draft.validationEvidence, draft.reQuarantineCriteria];
  }
  return [draft.ticketRef, draft.communicationsRef, draft.postmortemRef];
}

function incidentCanonicalActions(
  incident: DwaionIncidentSummary,
  description: string
): DwaionCanonicalCommandAction[] {
  const target = { type: 'AI_INCIDENT', id: incident.incidentId };
  const common = {
    description,
    target,
    expectedVersion: incident.version,
    impacts: [
      incident.scope,
      `${incident.affectedRunCount} affected runs`,
      `${incident.affectedUserCount ?? 'unknown'} affected users`,
      `Correlation ${incident.correlationId}`,
    ],
    recoveryPlan:
      'Preserve quarantine, restore the last verified route, validate a bounded canary, and re-quarantine on any failed check.',
  };
  const evidencePayload = {
    incidentId: incident.incidentId,
    correlationId: incident.correlationId,
    ownerRef: incident.ownerRef,
    scope: incident.scope,
  };
  return [
    {
      ...common,
      label: 'Emergency kill',
      title: 'Emergency stop affected AI traffic',
      kind: 'INCIDENT_EMERGENCY_STOP',
      changes: [{ label: 'Traffic', before: 'ACTIVE', after: 'STOP_PENDING' }],
      payload: { ...evidencePayload, inFlightAction: 'PAUSE', fallback: 'LAST_VERIFIED_ROUTE' },
      destructive: true,
    },
    {
      ...common,
      label: 'Open war room',
      title: 'Open incident war room',
      kind: 'INCIDENT_WAR_ROOM_OPEN',
      changes: [{ label: 'War room', before: 'Not linked', after: 'CREATE_PENDING' }],
      payload: {
        ...evidencePayload,
        participantScope: ['incident-owner', 'security', 'platform-operations'],
        bindTimeline: true,
      },
    },
    {
      ...common,
      label: 'Export incident report',
      title: 'Export incident evidence report',
      kind: 'INCIDENT_REPORT_EXPORT',
      changes: [{ label: 'Report', before: 'Not generated', after: 'PDF_AND_JSONL_PENDING' }],
      payload: { ...evidencePayload, formats: ['PDF', 'JSONL'], includeTimeline: true },
    },
    {
      ...common,
      label: 'Run validation',
      title: 'Run incident recovery validation',
      kind: 'INCIDENT_VALIDATION_RUN',
      changes: [{ label: 'Validation', before: incident.state, after: 'VALIDATION_PENDING' }],
      payload: {
        ...evidencePayload,
        checks: ['provider-health', 'route-policy', 'connector-acl', 'canary-threshold'],
        canaryPercent: 5,
        reQuarantineOnFailure: true,
      },
    },
    {
      ...common,
      label: 'Connector reauth',
      title: 'Reauthorize affected connector',
      kind: 'INCIDENT_CONNECTOR_REAUTH',
      changes: [{ label: 'Connector authorization', before: 'SUSPECT', after: 'REAUTH_PENDING' }],
      payload: { ...evidencePayload, connectorScope: incident.scope, rotateSecret: true },
    },
    {
      ...common,
      label: 'Safe rollback',
      title: 'Safely rollback incident scope',
      kind: 'INCIDENT_SAFE_ROLLBACK',
      changes: [{ label: 'Deployment', before: 'Current', after: 'LAST_VERIFIED_PENDING' }],
      payload: {
        ...evidencePayload,
        rollbackTarget: 'LAST_VERIFIED',
        preserveEvidence: true,
        reQuarantineOnFailure: true,
      },
      destructive: true,
    },
    {
      ...common,
      label: 'Resync recovery data',
      title: 'Resynchronize recovery data',
      kind: 'INCIDENT_RECOVERY_RESYNC',
      changes: [{ label: 'Recovery data', before: 'PARTIAL', after: 'RESYNC_PENDING' }],
      payload: { ...evidencePayload, verifyChecksums: true, publishAfterValidation: true },
    },
    {
      ...common,
      label: 'Skip quarantined runs',
      title: 'Skip quarantined incident runs',
      kind: 'INCIDENT_SKIP_QUARANTINED',
      changes: [{ label: 'Run selection', before: 'All affected', after: 'Exclude quarantined' }],
      payload: {
        ...evidencePayload,
        runSelector: `incident:${incident.incidentId}:quarantined`,
        preserveForReplay: true,
      },
    },
    {
      ...common,
      label: 'Pause recovery routine',
      title: 'Pause incident recovery routine',
      kind: 'INCIDENT_ROUTINE_PAUSE',
      changes: [{ label: 'Recovery routine', before: 'RUNNING', after: 'PAUSE_PENDING' }],
      payload: { ...evidencePayload, pauseAtCheckpoint: true, preserveLease: true },
    },
  ];
}
