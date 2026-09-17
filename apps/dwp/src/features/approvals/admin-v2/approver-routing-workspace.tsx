import {
  CircleSlash2,
  Network,
  Play,
  RefreshCcw,
  ShieldQuestion,
  UserRoundCheck,
} from 'lucide-react';
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

import type {
  AdminV2Fact,
  AdminV2Metric,
  AdminV2SourceState,
  AdminV2StateCopy,
  AdminV2Status,
  AdminV2WorkspaceHeader,
} from './admin-v2-types';

export type ApproverRoutingView = 'directory' | 'simulation' | 'exceptions';

export type ApproverGroupRecord = {
  id: string;
  name: string;
  description: string;
  ownerLabel: string;
  scopeLabel: string;
  memberCountLabel: string;
  usageLabel: string;
  status: AdminV2Status;
  facts: readonly AdminV2Fact[];
  members: readonly {
    id: string;
    name: string;
    roleLabel: string;
    sourceLabel: string;
    status: AdminV2Status;
  }[];
};

export type RoutingSimulationResult = {
  simulationId: string;
  title: string;
  description: string;
  status: AdminV2Status;
  inputs: readonly AdminV2Fact[];
  steps: readonly {
    id: string;
    title: string;
    detail: string;
    status: AdminV2Status;
    meta?: string;
  }[];
  explanation: string;
  authorityLabel: string;
  expiresLabel: string;
};

export type RoutingExceptionRecord = {
  id: string;
  title: string;
  description: string;
  status: AdminV2Status;
  affectedWorkflowsLabel: string;
  detectedLabel: string;
  evidence: readonly AdminV2Fact[];
  remediationLabel: string;
};

export type ApproverRoutingCopy = {
  header: AdminV2WorkspaceHeader;
  state: AdminV2StateCopy;
  navigationLabel: string;
  directoryTab: string;
  simulationTab: string;
  exceptionsTab: string;
  directoryTitle: string;
  directoryDescription: string;
  groupDetailTitle: string;
  groupDetailDescription: string;
  membersTitle: string;
  membersDescription: string;
  simulationTitle: string;
  simulationDescription: string;
  simulationInputsTitle: string;
  simulationRouteTitle: string;
  explanationTitle: string;
  exceptionsTitle: string;
  exceptionsDescription: string;
  noSelectionLabel: string;
  runSimulationLabel: string;
  refreshDirectoryLabel: string;
  editGroupLabel: string;
  publishGroupLabel: string;
  mobileEditGroupLabel: string;
  mobilePublishGroupLabel: string;
  mobileCommandReason: string;
  retireGroupLabel: string;
  mobileRetireLabel: string;
  mobileRetireReason: string;
  requestRemediationLabel: string;
  failClosedTitle: string;
  failClosedDescription: string;
};

export type ApproverRoutingWorkspaceProps = {
  state: AdminV2SourceState;
  copy: ApproverRoutingCopy;
  metrics: readonly AdminV2Metric[];
  view: ApproverRoutingView;
  groups: readonly ApproverGroupRecord[];
  selectedGroupId: string | null;
  simulation: RoutingSimulationResult | null;
  exceptions: readonly RoutingExceptionRecord[];
  editGroupReady: boolean;
  editGroupDisabledReason?: string;
  publishGroupReady: boolean;
  publishGroupDisabledReason?: string;
  simulationReady: boolean;
  simulationDisabledReason?: string;
  remediationReady: boolean;
  remediationDisabledReason?: string;
  onViewChange: (view: ApproverRoutingView) => void;
  onSelectGroup: (groupId: string) => void;
  onRefreshDirectory: () => void;
  onRunSimulation: () => void;
  onEditGroup: (groupId: string) => void;
  onPublishGroup: (groupId: string) => void;
  onRetireGroup: (groupId: string) => void;
  onRequestRemediation: (exceptionId: string) => void;
  onRetry?: () => void;
  onResolveConflict?: () => void;
};

function DirectoryView({
  copy,
  groups,
  selectedGroupId,
  selectedGroup,
  commandReady,
  editGroupReady,
  editGroupDisabledReason,
  publishGroupReady,
  publishGroupDisabledReason,
  onSelectGroup,
  onRefreshDirectory,
  onEditGroup,
  onPublishGroup,
  onRetireGroup,
}: Pick<
  ApproverRoutingWorkspaceProps,
  | 'copy'
  | 'groups'
  | 'selectedGroupId'
  | 'editGroupReady'
  | 'editGroupDisabledReason'
  | 'publishGroupReady'
  | 'publishGroupDisabledReason'
  | 'onSelectGroup'
  | 'onRefreshDirectory'
  | 'onEditGroup'
  | 'onPublishGroup'
  | 'onRetireGroup'
> & {
  selectedGroup: ApproverGroupRecord | null;
  commandReady: boolean;
}) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0,1fr)', lg: 'minmax(280px,.85fr) minmax(0,1.6fr)' },
        gap: { xs: 1.5, lg: 2 },
        alignItems: 'start',
      }}
    >
      <AdminV2InspectorPaper>
        <AdminV2Section
          title={copy.directoryTitle}
          description={copy.directoryDescription}
          labelledBy="admin-v2-routing-directory"
          action={
            <ActionButton
              intent="quiet"
              size="small"
              startIcon={<RefreshCcw size={15} />}
              onClick={onRefreshDirectory}
            >
              {copy.refreshDirectoryLabel}
            </ActionButton>
          }
        >
          <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
            {groups.map((group) => (
              <Box component="li" key={group.id}>
                <AdminV2RecordButton
                  selected={group.id === selectedGroupId}
                  title={group.name}
                  description={group.description}
                  meta={`${group.scopeLabel} · ${group.memberCountLabel} · ${group.usageLabel}`}
                  status={group.status}
                  onClick={() => onSelectGroup(group.id)}
                />
              </Box>
            ))}
          </Box>
        </AdminV2Section>
      </AdminV2InspectorPaper>

      <AdminV2InspectorPaper>
        <AdminV2Section
          title={selectedGroup?.name ?? copy.groupDetailTitle}
          description={selectedGroup?.description ?? copy.groupDetailDescription}
          labelledBy="admin-v2-routing-group-detail"
          action={selectedGroup ? <AdminV2StatusPill status={selectedGroup.status} /> : undefined}
        >
          {selectedGroup ? (
            <>
              <AdminV2FactGrid facts={selectedGroup.facts} />
              <Box sx={{ px: 1.5, py: 1.25, borderBlockEnd: 1, borderColor: 'divider' }}>
                <Typography variant="subtitle2" fontWeight="fontWeightBold">
                  {copy.membersTitle}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {copy.membersDescription}
                </Typography>
              </Box>
              <Stack divider={<Divider flexItem />}>
                {selectedGroup.members.map((member) => (
                  <Stack
                    key={member.id}
                    direction="row"
                    gap={1.25}
                    alignItems="flex-start"
                    sx={{ p: 1.5 }}
                  >
                    <UserRoundCheck size={18} aria-hidden="true" />
                    <Box minWidth={0} flex={1}>
                      <Typography variant="body2" fontWeight="fontWeightBold">
                        {member.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {member.roleLabel} · {member.sourceLabel}
                      </Typography>
                    </Box>
                    <AdminV2StatusPill status={member.status} />
                  </Stack>
                ))}
              </Stack>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                alignItems="flex-start"
                gap={1}
                sx={{ p: 1.5, borderBlockStart: 1, borderColor: 'divider' }}
              >
                <AdminV2GovernedAction
                  desktopLabel={copy.editGroupLabel}
                  mobileLabel={copy.mobileEditGroupLabel}
                  mobileReason={copy.mobileCommandReason}
                  disabled={!commandReady || !editGroupReady}
                  disabledReason={editGroupDisabledReason}
                  onAction={() => onEditGroup(selectedGroup.id)}
                  icon={<UserRoundCheck size={16} />}
                />
                <AdminV2GovernedAction
                  desktopLabel={copy.publishGroupLabel}
                  mobileLabel={copy.mobilePublishGroupLabel}
                  mobileReason={copy.mobileCommandReason}
                  disabled={!commandReady || !publishGroupReady}
                  disabledReason={publishGroupDisabledReason}
                  onAction={() => onPublishGroup(selectedGroup.id)}
                  icon={<ShieldQuestion size={16} />}
                />
                <AdminV2GovernedAction
                  desktopLabel={copy.retireGroupLabel}
                  mobileLabel={copy.mobileRetireLabel}
                  mobileReason={copy.mobileRetireReason}
                  disabled={!commandReady}
                  onAction={() => onRetireGroup(selectedGroup.id)}
                  icon={<CircleSlash2 size={16} />}
                />
              </Stack>
            </>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
              {copy.noSelectionLabel}
            </Typography>
          )}
        </AdminV2Section>
      </AdminV2InspectorPaper>
    </Box>
  );
}

function SimulationView({
  copy,
  simulation,
  simulationReady,
  simulationDisabledReason,
  onRunSimulation,
}: Pick<
  ApproverRoutingWorkspaceProps,
  'copy' | 'simulation' | 'simulationReady' | 'simulationDisabledReason' | 'onRunSimulation'
>) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0,1fr)', lg: 'minmax(260px,.8fr) minmax(0,1.6fr)' },
        gap: { xs: 1.5, lg: 2 },
        alignItems: 'start',
      }}
    >
      <AdminV2InspectorPaper>
        <AdminV2Section
          title={copy.simulationInputsTitle}
          description={copy.simulationDescription}
          labelledBy="admin-v2-routing-simulation-inputs"
          action={
            <ActionButton
              intent="primary"
              size="small"
              startIcon={<Play size={15} />}
              disabled={!simulationReady}
              onClick={onRunSimulation}
            >
              {copy.runSimulationLabel}
            </ActionButton>
          }
        >
          {simulation ? <AdminV2FactGrid facts={simulation.inputs} /> : null}
          {!simulationReady && simulationDisabledReason ? (
            <Typography variant="caption" color="text.secondary" sx={{ px: 1.5, pb: 1.25 }}>
              {simulationDisabledReason}
            </Typography>
          ) : null}
          <Box sx={{ p: 1.5 }}>
            <InlineFeedback severity="info" title={copy.failClosedTitle}>
              {copy.failClosedDescription}
            </InlineFeedback>
          </Box>
        </AdminV2Section>
      </AdminV2InspectorPaper>

      <AdminV2InspectorPaper>
        <AdminV2Section
          title={simulation?.title ?? copy.simulationTitle}
          description={simulation?.description ?? copy.simulationDescription}
          labelledBy="admin-v2-routing-simulation-result"
          action={simulation ? <AdminV2StatusPill status={simulation.status} /> : undefined}
        >
          {simulation ? (
            <>
              <AdminV2Timeline items={simulation.steps} />
              <Box sx={{ p: 1.5, borderBlockStart: 1, borderColor: 'divider' }}>
                <Typography variant="subtitle2" fontWeight="fontWeightBold">
                  {copy.explanationTitle}
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5, overflowWrap: 'anywhere' }}>
                  {simulation.explanation}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', mt: 1 }}
                >
                  {simulation.authorityLabel} · {simulation.expiresLabel}
                </Typography>
              </Box>
            </>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
              {copy.simulationDescription}
            </Typography>
          )}
        </AdminV2Section>
      </AdminV2InspectorPaper>
    </Box>
  );
}

function ExceptionsView({
  copy,
  exceptions,
  remediationReady,
  remediationDisabledReason,
  onRequestRemediation,
}: Pick<
  ApproverRoutingWorkspaceProps,
  'copy' | 'exceptions' | 'remediationReady' | 'remediationDisabledReason' | 'onRequestRemediation'
>) {
  return (
    <AdminV2InspectorPaper>
      <AdminV2Section
        title={copy.exceptionsTitle}
        description={copy.exceptionsDescription}
        labelledBy="admin-v2-routing-exceptions"
      >
        <Stack divider={<Divider flexItem />}>
          {exceptions.length === 0 ? (
            <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
              <Typography variant="body2" color="text.secondary">
                {copy.exceptionsDescription}
              </Typography>
              <Stack alignItems="flex-start" gap={0.75} sx={{ mt: 1.25 }}>
                <ActionButton intent="secondary" startIcon={<ShieldQuestion size={16} />} disabled>
                  {copy.requestRemediationLabel}
                </ActionButton>
                {remediationDisabledReason ? (
                  <Typography variant="caption" color="text.secondary">
                    {remediationDisabledReason}
                  </Typography>
                ) : null}
              </Stack>
            </Box>
          ) : null}
          {exceptions.map((exception) => (
            <Box key={exception.id} sx={{ p: { xs: 1.5, sm: 2 } }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1}>
                <Box minWidth={0}>
                  <Typography variant="subtitle2" fontWeight="fontWeightBold">
                    {exception.title}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ overflowWrap: 'anywhere' }}
                  >
                    {exception.description}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {exception.affectedWorkflowsLabel} · {exception.detectedLabel}
                  </Typography>
                </Box>
                <AdminV2StatusPill status={exception.status} />
              </Stack>
              <Box
                sx={{
                  mt: 1.25,
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: (theme) => `${Number(theme.shape.borderRadius) * 1.5}px`,
                }}
              >
                <AdminV2FactGrid facts={exception.evidence} />
              </Box>
              <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1.25 }}>
                <ActionButton
                  intent="secondary"
                  startIcon={<ShieldQuestion size={16} />}
                  disabled={!remediationReady}
                  onClick={() => onRequestRemediation(exception.id)}
                >
                  {exception.remediationLabel || copy.requestRemediationLabel}
                </ActionButton>
              </Stack>
              {!remediationReady && remediationDisabledReason ? (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75 }}>
                  {remediationDisabledReason}
                </Typography>
              ) : null}
            </Box>
          ))}
        </Stack>
      </AdminV2Section>
    </AdminV2InspectorPaper>
  );
}

export function ApproverRoutingWorkspace({
  state,
  copy,
  metrics,
  view,
  groups,
  selectedGroupId,
  simulation,
  exceptions,
  editGroupReady,
  editGroupDisabledReason,
  publishGroupReady,
  publishGroupDisabledReason,
  simulationReady,
  simulationDisabledReason,
  remediationReady,
  remediationDisabledReason,
  onViewChange,
  onSelectGroup,
  onRefreshDirectory,
  onRunSimulation,
  onEditGroup,
  onPublishGroup,
  onRetireGroup,
  onRequestRemediation,
  onRetry,
  onResolveConflict,
}: ApproverRoutingWorkspaceProps) {
  const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? null;
  const commandReady = state === 'ready';

  return (
    <AdminV2WorkspaceFrame
      header={copy.header}
      icon={Network}
      primaryAction={
        <Stack alignItems="flex-end" gap={0.5}>
          <ActionButton
            intent="primary"
            startIcon={<Play size={16} />}
            disabled={!commandReady || !simulationReady}
            onClick={onRunSimulation}
          >
            {copy.runSimulationLabel}
          </ActionButton>
          {(!commandReady || !simulationReady) && simulationDisabledReason ? (
            <Typography variant="caption" color="text.secondary">
              {simulationDisabledReason}
            </Typography>
          ) : null}
        </Stack>
      }
    >
      <AdminV2StateBoundary
        state={state}
        copy={copy.state}
        actions={{ onRetry, onResolveConflict }}
      >
        <AdminV2MetricStrip metrics={metrics} />
        <AdminV2InspectorPaper>
          <AdminV2ViewTabs
            label={copy.navigationLabel}
            value={view}
            options={[
              { value: 'directory', label: copy.directoryTab, count: groups.length },
              { value: 'simulation', label: copy.simulationTab, count: simulation ? 1 : 0 },
              { value: 'exceptions', label: copy.exceptionsTab, count: exceptions.length },
            ]}
            onChange={onViewChange}
          />
          <Box sx={{ p: { xs: 1.25, sm: 1.75 } }}>
            {view === 'directory' ? (
              <DirectoryView
                copy={copy}
                groups={groups}
                selectedGroupId={selectedGroupId}
                selectedGroup={selectedGroup}
                commandReady={commandReady}
                editGroupReady={editGroupReady}
                editGroupDisabledReason={editGroupDisabledReason}
                publishGroupReady={publishGroupReady}
                publishGroupDisabledReason={publishGroupDisabledReason}
                onSelectGroup={onSelectGroup}
                onRefreshDirectory={onRefreshDirectory}
                onEditGroup={onEditGroup}
                onPublishGroup={onPublishGroup}
                onRetireGroup={onRetireGroup}
              />
            ) : null}
            {view === 'simulation' ? (
              <SimulationView
                copy={copy}
                simulation={simulation}
                simulationReady={commandReady && simulationReady}
                simulationDisabledReason={simulationDisabledReason}
                onRunSimulation={onRunSimulation}
              />
            ) : null}
            {view === 'exceptions' ? (
              <ExceptionsView
                copy={copy}
                exceptions={exceptions}
                remediationReady={commandReady && remediationReady}
                remediationDisabledReason={remediationDisabledReason}
                onRequestRemediation={onRequestRemediation}
              />
            ) : null}
          </Box>
        </AdminV2InspectorPaper>
      </AdminV2StateBoundary>
    </AdminV2WorkspaceFrame>
  );
}
