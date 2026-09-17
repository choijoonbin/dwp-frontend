import { CirclePause, CloudCog, Play, RefreshCcw, ShieldAlert, Wrench } from 'lucide-react';
import { ActionButton, InlineFeedback } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  AdminV2FactGrid,
  AdminV2GovernedAction,
  AdminV2InspectorPaper,
  AdminV2MetricStrip,
  AdminV2RecordButton,
  AdminV2Section,
  AdminV2StateBoundary,
  AdminV2StatusPill,
  AdminV2Timeline,
  AdminV2ViewTabs,
  AdminV2WorkspaceFrame,
} from './admin-v2-foundation';
import { ApprovalAdminV2ActionDeck } from './approval-admin-v2-action-deck';

import type { AdminV2WorkspaceActionDeck } from './approval-admin-v2-action-deck';
import type {
  AdminV2Fact,
  AdminV2Metric,
  AdminV2SourceState,
  AdminV2StateCopy,
  AdminV2Status,
  AdminV2WorkspaceHeader,
} from './admin-v2-types';

export type OperationsIncidentView = 'incidents' | 'recovery' | 'queues';

export type ApprovalIncidentRecord = {
  id: string;
  title: string;
  description: string;
  severityLabel: string;
  detectedLabel: string;
  affectedLabel: string;
  correlationLabel: string;
  status: AdminV2Status;
  sourceStatus: AdminV2Status;
  facts: readonly AdminV2Fact[];
  evidence: readonly {
    id: string;
    title: string;
    detail: string;
    meta?: string;
    status: AdminV2Status;
  }[];
};

export type ApprovalRecoveryPlan = {
  incidentId: string;
  planId: string;
  planRevisionLabel: string;
  createdAtLabel: string;
  dryRunStatus: AdminV2Status;
  executionStatus: AdminV2Status;
  eligibilityFacts: readonly AdminV2Fact[];
  steps: readonly {
    id: string;
    title: string;
    detail: string;
    meta?: string;
    status: AdminV2Status;
  }[];
  redactedPayloadLabel: string;
  redactedPayloadPreview: string;
};

export type ApprovalOperationsQueue = {
  id: string;
  name: string;
  description: string;
  depthLabel: string;
  oldestLabel: string;
  sourceRevisionLabel: string;
  status: AdminV2Status;
};

export type OperationsIncidentCopy = {
  header: AdminV2WorkspaceHeader;
  state: AdminV2StateCopy;
  navigationLabel: string;
  incidentsTab: string;
  recoveryTab: string;
  queuesTab: string;
  incidentsTitle: string;
  incidentsDescription: string;
  incidentDetailTitle: string;
  incidentDetailDescription: string;
  evidenceTitle: string;
  evidenceDescription: string;
  recoveryTitle: string;
  recoveryDescription: string;
  eligibilityTitle: string;
  stepsTitle: string;
  payloadTitle: string;
  payloadDescription: string;
  queuesTitle: string;
  queuesDescription: string;
  noSelectionLabel: string;
  refreshLabel: string;
  prepareRecoveryLabel: string;
  executeRecoveryLabel: string;
  mobileExecuteLabel: string;
  mobileExecuteReason: string;
  pauseQueueLabel: string;
  mobilePauseLabel: string;
  mobilePauseReason: string;
  serverEvidenceTitle: string;
  serverEvidenceDescription: string;
};

export type OperationsIncidentRecoveryWorkspaceProps = {
  state: AdminV2SourceState;
  copy: OperationsIncidentCopy;
  metrics: readonly AdminV2Metric[];
  view: OperationsIncidentView;
  incidents: readonly ApprovalIncidentRecord[];
  selectedIncidentId: string | null;
  recoveryPlan: ApprovalRecoveryPlan | null;
  queues: readonly ApprovalOperationsQueue[];
  prepareRecoveryReady: boolean;
  prepareRecoveryDisabledReason?: string;
  executeRecoveryReady: boolean;
  executeRecoveryDisabledReason?: string;
  pauseQueueReady: boolean;
  pauseQueueDisabledReason?: string;
  actionDeck?: AdminV2WorkspaceActionDeck;
  onViewChange: (view: OperationsIncidentView) => void;
  onSelectIncident: (incidentId: string) => void;
  onRefresh: () => void;
  onPrepareRecovery: (incidentId: string) => void;
  onExecuteRecovery: (planId: string) => void;
  onPauseQueue: (queueId: string) => void;
  onRetry?: () => void;
  onResolveConflict?: () => void;
};

function IncidentList({
  copy,
  incidents,
  selectedIncidentId,
  onSelectIncident,
  onRefresh,
}: Pick<
  OperationsIncidentRecoveryWorkspaceProps,
  'copy' | 'incidents' | 'selectedIncidentId' | 'onSelectIncident' | 'onRefresh'
>) {
  return (
    <AdminV2InspectorPaper>
      <AdminV2Section
        title={copy.incidentsTitle}
        description={copy.incidentsDescription}
        labelledBy="admin-v2-operations-incidents"
        action={
          <ActionButton
            intent="quiet"
            size="small"
            startIcon={<RefreshCcw size={15} />}
            onClick={onRefresh}
          >
            {copy.refreshLabel}
          </ActionButton>
        }
      >
        <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
          {incidents.map((incident) => (
            <Box component="li" key={incident.id}>
              <AdminV2RecordButton
                selected={incident.id === selectedIncidentId}
                title={incident.title}
                description={incident.description}
                meta={`${incident.severityLabel} · ${incident.detectedLabel} · ${incident.affectedLabel}`}
                status={incident.status}
                onClick={() => onSelectIncident(incident.id)}
              />
            </Box>
          ))}
        </Box>
      </AdminV2Section>
    </AdminV2InspectorPaper>
  );
}

function IncidentDetail({
  copy,
  incident,
  commandReady,
  prepareRecoveryReady,
  prepareRecoveryDisabledReason,
  onPrepareRecovery,
}: {
  copy: OperationsIncidentCopy;
  incident: ApprovalIncidentRecord | null;
  commandReady: boolean;
  prepareRecoveryReady: boolean;
  prepareRecoveryDisabledReason?: string;
  onPrepareRecovery: (incidentId: string) => void;
}) {
  return (
    <AdminV2InspectorPaper>
      <AdminV2Section
        title={incident?.title ?? copy.incidentDetailTitle}
        description={incident?.description ?? copy.incidentDetailDescription}
        labelledBy="admin-v2-operations-incident-detail"
        action={incident ? <AdminV2StatusPill status={incident.status} /> : undefined}
      >
        {incident ? (
          <>
            <Stack
              direction="row"
              gap={0.75}
              flexWrap="wrap"
              sx={{ p: 1.5, borderBlockEnd: 1, borderColor: 'divider' }}
            >
              <AdminV2StatusPill status={incident.sourceStatus} />
              <Typography variant="caption" color="text.secondary">
                {incident.correlationLabel}
              </Typography>
            </Stack>
            <AdminV2FactGrid facts={incident.facts} />
            <Box sx={{ px: 1.5, py: 1.25, borderBlock: 1, borderColor: 'divider' }}>
              <Typography variant="subtitle2" fontWeight="fontWeightBold">
                {copy.evidenceTitle}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {copy.evidenceDescription}
              </Typography>
            </Box>
            <AdminV2Timeline items={incident.evidence} />
            <Stack alignItems="flex-end" sx={{ p: 1.5 }} gap={0.5}>
              <ActionButton
                intent="secondary"
                startIcon={<Wrench size={16} />}
                disabled={!commandReady || !prepareRecoveryReady}
                onClick={() => onPrepareRecovery(incident.id)}
              >
                {copy.prepareRecoveryLabel}
              </ActionButton>
              {(!commandReady || !prepareRecoveryReady) && prepareRecoveryDisabledReason ? (
                <Typography variant="caption" color="text.secondary" textAlign="right">
                  {prepareRecoveryDisabledReason}
                </Typography>
              ) : null}
            </Stack>
          </>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
            {copy.noSelectionLabel}
          </Typography>
        )}
      </AdminV2Section>
    </AdminV2InspectorPaper>
  );
}

function RecoveryView({
  copy,
  recoveryPlan,
  commandReady,
  executeRecoveryReady,
  executeRecoveryDisabledReason,
  onExecuteRecovery,
}: Pick<OperationsIncidentRecoveryWorkspaceProps, 'copy' | 'recoveryPlan' | 'onExecuteRecovery'> & {
  commandReady: boolean;
  executeRecoveryReady: boolean;
  executeRecoveryDisabledReason?: string;
}) {
  const executionReady = commandReady && executeRecoveryReady;
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0,1fr)', lg: 'minmax(0,1.35fr) minmax(280px,.65fr)' },
        gap: { xs: 1.5, lg: 2 },
        alignItems: 'start',
      }}
    >
      <AdminV2InspectorPaper>
        <AdminV2Section
          title={copy.recoveryTitle}
          description={copy.recoveryDescription}
          labelledBy="admin-v2-operations-recovery"
          action={
            recoveryPlan ? <AdminV2StatusPill status={recoveryPlan.executionStatus} /> : undefined
          }
        >
          {recoveryPlan ? (
            <>
              <Stack
                direction="row"
                gap={0.75}
                flexWrap="wrap"
                sx={{ p: 1.5, borderBlockEnd: 1, borderColor: 'divider' }}
              >
                <AdminV2StatusPill status={recoveryPlan.dryRunStatus} />
                <Typography variant="caption" color="text.secondary">
                  {recoveryPlan.planRevisionLabel} · {recoveryPlan.createdAtLabel}
                </Typography>
              </Stack>
              <Box sx={{ px: 1.5, py: 1.25, borderBlockEnd: 1, borderColor: 'divider' }}>
                <Typography variant="subtitle2" fontWeight="fontWeightBold">
                  {copy.stepsTitle}
                </Typography>
              </Box>
              <AdminV2Timeline items={recoveryPlan.steps} />
              <Box sx={{ p: 1.5, borderBlockStart: 1, borderColor: 'divider' }}>
                <AdminV2GovernedAction
                  desktopLabel={copy.executeRecoveryLabel}
                  mobileLabel={copy.mobileExecuteLabel}
                  mobileReason={copy.mobileExecuteReason}
                  disabled={!executionReady}
                  disabledReason={executeRecoveryDisabledReason}
                  onAction={() => onExecuteRecovery(recoveryPlan.planId)}
                  icon={<Play size={16} />}
                />
              </Box>
            </>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
              {copy.recoveryDescription}
            </Typography>
          )}
        </AdminV2Section>
      </AdminV2InspectorPaper>

      <Stack gap={1.5}>
        <AdminV2InspectorPaper>
          <AdminV2Section
            title={copy.eligibilityTitle}
            labelledBy="admin-v2-operations-eligibility"
          >
            {recoveryPlan ? <AdminV2FactGrid facts={recoveryPlan.eligibilityFacts} /> : null}
          </AdminV2Section>
        </AdminV2InspectorPaper>
        <AdminV2InspectorPaper>
          <AdminV2Section
            title={copy.payloadTitle}
            description={copy.payloadDescription}
            labelledBy="admin-v2-operations-payload"
          >
            {recoveryPlan ? (
              <Box sx={{ p: 1.5 }}>
                <Typography variant="caption" color="text.secondary">
                  {recoveryPlan.redactedPayloadLabel}
                </Typography>
                <Box
                  component="pre"
                  sx={{
                    m: 0,
                    mt: 0.75,
                    p: 1.25,
                    maxHeight: 240,
                    overflow: 'auto',
                    bgcolor: 'action.hover',
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: (theme) => `${Number(theme.shape.borderRadius)}px`,
                    fontSize: (theme) => theme.typography.caption.fontSize,
                    whiteSpace: 'pre-wrap',
                    overflowWrap: 'anywhere',
                  }}
                >
                  {recoveryPlan.redactedPayloadPreview}
                </Box>
              </Box>
            ) : null}
          </AdminV2Section>
        </AdminV2InspectorPaper>
      </Stack>
    </Box>
  );
}

function QueuesView({
  copy,
  queues,
  commandReady,
  pauseQueueReady,
  pauseQueueDisabledReason,
  onPauseQueue,
}: Pick<OperationsIncidentRecoveryWorkspaceProps, 'copy' | 'queues' | 'onPauseQueue'> & {
  commandReady: boolean;
  pauseQueueReady: boolean;
  pauseQueueDisabledReason?: string;
}) {
  return (
    <AdminV2InspectorPaper>
      <AdminV2Section
        title={copy.queuesTitle}
        description={copy.queuesDescription}
        labelledBy="admin-v2-operations-queues"
      >
        <Stack divider={<Divider flexItem />}>
          {queues.length === 0 ? (
            <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
              <Typography variant="body2" color="text.secondary">
                {copy.queuesDescription}
              </Typography>
              <Box sx={{ mt: 1.25 }}>
                <AdminV2GovernedAction
                  desktopLabel={copy.pauseQueueLabel}
                  mobileLabel={copy.mobilePauseLabel}
                  mobileReason={copy.mobilePauseReason}
                  disabled
                  disabledReason={pauseQueueDisabledReason}
                  onAction={() => undefined}
                  icon={<CirclePause size={16} />}
                />
              </Box>
            </Box>
          ) : null}
          {queues.map((queue) => (
            <Box key={queue.id} sx={{ p: { xs: 1.5, sm: 2 } }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1}>
                <Box minWidth={0}>
                  <Typography variant="subtitle2" fontWeight="fontWeightBold">
                    {queue.name}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ overflowWrap: 'anywhere' }}
                  >
                    {queue.description}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {queue.depthLabel} · {queue.oldestLabel} · {queue.sourceRevisionLabel}
                  </Typography>
                </Box>
                <AdminV2StatusPill status={queue.status} />
              </Stack>
              <Box sx={{ mt: 1.25 }}>
                <AdminV2GovernedAction
                  desktopLabel={copy.pauseQueueLabel}
                  mobileLabel={copy.mobilePauseLabel}
                  mobileReason={copy.mobilePauseReason}
                  disabled={!commandReady || !pauseQueueReady}
                  disabledReason={pauseQueueDisabledReason}
                  onAction={() => onPauseQueue(queue.id)}
                  icon={<CirclePause size={16} />}
                />
              </Box>
            </Box>
          ))}
        </Stack>
      </AdminV2Section>
    </AdminV2InspectorPaper>
  );
}

export function OperationsIncidentRecoveryWorkspace({
  state,
  copy,
  metrics,
  view,
  incidents,
  selectedIncidentId,
  recoveryPlan,
  queues,
  prepareRecoveryReady,
  prepareRecoveryDisabledReason,
  executeRecoveryReady,
  executeRecoveryDisabledReason,
  pauseQueueReady,
  pauseQueueDisabledReason,
  actionDeck,
  onViewChange,
  onSelectIncident,
  onRefresh,
  onPrepareRecovery,
  onExecuteRecovery,
  onPauseQueue,
  onRetry,
  onResolveConflict,
}: OperationsIncidentRecoveryWorkspaceProps) {
  const selectedIncident = incidents.find((incident) => incident.id === selectedIncidentId) ?? null;
  const selectedRecoveryPlan =
    recoveryPlan?.incidentId === selectedIncidentId ? recoveryPlan : null;
  const commandReady = state === 'ready';

  return (
    <AdminV2WorkspaceFrame
      header={copy.header}
      icon={CloudCog}
      primaryAction={
        <ActionButton intent="secondary" startIcon={<RefreshCcw size={16} />} onClick={onRefresh}>
          {copy.refreshLabel}
        </ActionButton>
      }
    >
      <AdminV2StateBoundary
        state={state}
        copy={copy.state}
        actions={{ onRetry, onResolveConflict }}
      >
        <InlineFeedback
          severity="info"
          title={copy.serverEvidenceTitle}
          icon={<ShieldAlert size={18} />}
        >
          {copy.serverEvidenceDescription}
        </InlineFeedback>
        <AdminV2MetricStrip metrics={metrics} />
        {actionDeck ? <ApprovalAdminV2ActionDeck state={state} deck={actionDeck} /> : null}
        <AdminV2InspectorPaper>
          <AdminV2ViewTabs
            label={copy.navigationLabel}
            value={view}
            options={[
              { value: 'incidents', label: copy.incidentsTab, count: incidents.length },
              { value: 'recovery', label: copy.recoveryTab, count: selectedRecoveryPlan ? 1 : 0 },
              { value: 'queues', label: copy.queuesTab, count: queues.length },
            ]}
            onChange={onViewChange}
          />
          <Box sx={{ p: { xs: 1.25, sm: 1.75 } }}>
            {view === 'incidents' ? (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: 'minmax(0,1fr)',
                    lg: 'minmax(300px,.85fr) minmax(0,1.5fr)',
                  },
                  gap: { xs: 1.5, lg: 2 },
                  alignItems: 'start',
                }}
              >
                <IncidentList
                  copy={copy}
                  incidents={incidents}
                  selectedIncidentId={selectedIncidentId}
                  onSelectIncident={onSelectIncident}
                  onRefresh={onRefresh}
                />
                <IncidentDetail
                  copy={copy}
                  incident={selectedIncident}
                  commandReady={commandReady}
                  prepareRecoveryReady={prepareRecoveryReady}
                  prepareRecoveryDisabledReason={prepareRecoveryDisabledReason}
                  onPrepareRecovery={onPrepareRecovery}
                />
              </Box>
            ) : null}
            {view === 'recovery' ? (
              <RecoveryView
                copy={copy}
                recoveryPlan={selectedRecoveryPlan}
                commandReady={commandReady}
                executeRecoveryReady={Boolean(selectedRecoveryPlan) && executeRecoveryReady}
                executeRecoveryDisabledReason={executeRecoveryDisabledReason}
                onExecuteRecovery={onExecuteRecovery}
              />
            ) : null}
            {view === 'queues' ? (
              <QueuesView
                copy={copy}
                queues={queues}
                commandReady={commandReady}
                pauseQueueReady={pauseQueueReady}
                pauseQueueDisabledReason={pauseQueueDisabledReason}
                onPauseQueue={onPauseQueue}
              />
            ) : null}
          </Box>
        </AdminV2InspectorPaper>
      </AdminV2StateBoundary>
    </AdminV2WorkspaceFrame>
  );
}
