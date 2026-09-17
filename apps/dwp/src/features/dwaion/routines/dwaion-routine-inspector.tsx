import { Archive, FlaskConical, PauseCircle, Pencil, PlayCircle, ShieldCheck } from 'lucide-react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { ActionButton, DetailInspector, InlineFeedback } from '@dwp-frontend/design-system';

import { DWAION_ROUTINE_COPY_KO } from './dwaion-routine-copy';
import { DwaionRoutineDryRunInspection } from './dwaion-routine-dry-run-inspection';
import { DwaionRoutineExecutionPanel } from './dwaion-routine-execution-panel';
import {
  routineCommandState,
  routineConsentComplete,
  routineDryRunIsCurrent,
} from './dwaion-routine-model';

import type { DwaionRoutineCopy } from './dwaion-routine-copy';
import type { DwaionRoutine, DwaionRoutineDryRunReceipt } from './dwaion-routine-model';
import type {
  DwaionRoutineExecutionRun,
  DwaionRoutineAdvancedCommand,
  DwaionRoutineAdvancedPayload,
  DwaionRoutineHealth,
  DwaionRoutineRollbackReceipt,
  DwaionRoutineRunCommand,
  DwaionRoutineRuntimeCapabilities,
  DwaionRoutineVersionSnapshot,
} from '@dwp-frontend/shared-utils';

export function DwaionRoutineInspector({
  routine,
  open,
  variant,
  dryRunReceipt,
  runtimeCapabilities,
  runtimeCapabilitiesError = false,
  runs = [],
  runsLoading = false,
  runsError = false,
  versions = [],
  health,
  rollbackReceipt,
  advancedCommand,
  evidenceLoading = false,
  evidenceError = false,
  busy = false,
  canManage = true,
  onClose,
  onDryRun,
  onEdit,
  onToggleStatus,
  onArchive,
  onActivate,
  onTriggerRun,
  onRunCommand,
  onRollbackVersion,
  onDownloadTelemetry,
  onAdvancedCommand,
  onRetryRuntime,
  copy = DWAION_ROUTINE_COPY_KO,
  formatTimestamp = (value) => value,
}: {
  routine: DwaionRoutine | null;
  open: boolean;
  variant: 'inline' | 'drawer';
  dryRunReceipt?: DwaionRoutineDryRunReceipt | null;
  runtimeCapabilities?: DwaionRoutineRuntimeCapabilities;
  runtimeCapabilitiesError?: boolean;
  runs?: readonly DwaionRoutineExecutionRun[];
  runsLoading?: boolean;
  runsError?: boolean;
  versions?: readonly DwaionRoutineVersionSnapshot[];
  health?: DwaionRoutineHealth;
  rollbackReceipt?: DwaionRoutineRollbackReceipt | null;
  advancedCommand?: DwaionRoutineAdvancedCommand | null;
  evidenceLoading?: boolean;
  evidenceError?: boolean;
  busy?: boolean;
  canManage?: boolean;
  onClose: () => void;
  onDryRun: (routine: DwaionRoutine) => void;
  onEdit: (routine: DwaionRoutine) => void;
  onToggleStatus: (routine: DwaionRoutine) => void;
  onArchive: (routine: DwaionRoutine) => void;
  onActivate: (routine: DwaionRoutine, action: 'ACTIVATE' | 'DEACTIVATE') => void;
  onTriggerRun: (routine: DwaionRoutine) => void;
  onRunCommand: (
    routine: DwaionRoutine,
    run: DwaionRoutineExecutionRun,
    action: DwaionRoutineRunCommand['action']
  ) => void;
  onRollbackVersion: (routine: DwaionRoutine, version: DwaionRoutineVersionSnapshot) => void;
  onDownloadTelemetry: (routine: DwaionRoutine) => void;
  onAdvancedCommand: (routine: DwaionRoutine, payload: DwaionRoutineAdvancedPayload) => void;
  onRetryRuntime: () => void;
  copy?: DwaionRoutineCopy;
  formatTimestamp?: (value: string) => string;
}) {
  if (!routine) return null;

  const consentReady = routineConsentComplete(routine.consents);
  const currentReceipt = routineDryRunIsCurrent(routine, dryRunReceipt ?? null)
    ? (dryRunReceipt ?? null)
    : null;
  const archived = routine.status === 'ARCHIVED';
  const dryRunEnabled =
    routineCommandState(routine, routine.revision).allowed && canManage && !busy;

  return (
    <DetailInspector
      open={open}
      variant={variant}
      width={760}
      title={routine.title}
      subtitle={`${
        routine.status === 'DRAFT' && !consentReady
          ? copy.filters.ATTENTION
          : copy.status[routine.status]
      } ${copy.separator} ${copy.revisionPrefix}${routine.revision}`}
      closeLabel={copy.close}
      onClose={onClose}
      status={
        <Chip
          size="small"
          variant="outlined"
          color={routine.executionMode === 'SCHEDULED' ? 'success' : 'info'}
          label={
            routine.executionMode === 'SCHEDULED'
              ? copy.status.ACTIVE
              : routine.executionMode === 'WEBHOOK'
                ? copy.webhookTrigger
                : copy.proposalOnly
          }
        />
      }
    >
      <Stack gap={2}>
        {!runtimeCapabilities?.activationAvailable ? (
          <InlineFeedback severity="info">
            <Typography variant="body2" fontWeight="fontWeightBold">
              {copy.schedulerUnavailable}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {runtimeCapabilities?.recoveryHint ?? copy.schedulerUnavailableHelp}
            </Typography>
          </InlineFeedback>
        ) : null}

        <Box component="section" aria-labelledby="routine-consent-title">
          <Stack direction="row" alignItems="center" gap={0.75}>
            <ShieldCheck size={17} aria-hidden="true" />
            <Typography id="routine-consent-title" component="h3" variant="subtitle2">
              {copy.contractTitle}
            </Typography>
          </Stack>
          <Stack component="ol" sx={{ p: 0, m: 0, mt: 1, listStyle: 'none' }} gap={0.6}>
            <ContractStep
              number={1}
              title={copy.contractSteps.purpose}
              value={routine.description}
            />
            <ContractStep
              number={2}
              title={copy.contractSteps.source}
              value={routine.sourceKeys
                .map(
                  (source) => copy.sourceLabels[source as keyof typeof copy.sourceLabels] ?? source
                )
                .join(' · ')}
            />
            <ContractStep
              number={3}
              title={copy.contractSteps.trigger}
              value={
                routine.triggerType === 'WEBHOOK'
                  ? `${copy.webhookTrigger} · ${routine.webhookEventType ?? copy.capabilityUnavailable}${routine.webhookEndpointReference ? ` · ${routine.webhookEndpointReference}` : ''}`
                  : `${copy.cadence[routine.schedule.cadence]} · ${routine.schedule.localTime.slice(0, 5)} · ${routine.schedule.timeZone}. ${copy.contractValues.triggerPreview}`
              }
              warning={
                routine.triggerType === 'WEBHOOK'
                  ? !runtimeCapabilities?.webhookTriggerAvailable
                  : !routine.schedulingAvailable || !routine.backgroundExecutionAvailable
              }
            />
            <ContractStep
              number={4}
              title={copy.contractSteps.handoff}
              value={
                routine.proposalDeliveryAvailable
                  ? copy.proposalOnlyHelp
                  : copy.contractValues.handoffUnavailable
              }
              warning={!routine.proposalDeliveryAvailable}
            />
            <ContractStep
              number={5}
              title={copy.contractSteps.guardrail}
              value={`${copy.maximumRuns}: ${routine.budget.maximumRunsPerMonth} · ${copy.maximumTokens}: ${routine.budget.maximumTokensPerRun} · ${copy.maximumMinutes}: ${routine.budget.maximumMinutesPerRun}`}
            />
            <ContractStep
              number={6}
              title={copy.contractSteps.consent}
              value={
                consentReady
                  ? copy.contractValues.consentComplete
                  : copy.contractValues.consentIncomplete
              }
              warning={!consentReady}
            >
              <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 0.75 }}>
                {routine.consents.map((consent) => (
                  <Chip
                    key={consent.key}
                    size="small"
                    color={consent.state === 'ENABLED' ? 'success' : 'warning'}
                    variant="outlined"
                    label={`${copy.consentLabels[consent.key]} · ${copy.consentStates[consent.state]}`}
                  />
                ))}
              </Stack>
            </ContractStep>
          </Stack>
        </Box>

        <DwaionRoutineDryRunInspection
          routine={routine}
          receipt={currentReceipt}
          capabilities={runtimeCapabilities}
          copy={copy}
          formatTimestamp={formatTimestamp}
        />

        <DwaionRoutineExecutionPanel
          routine={routine}
          capabilities={runtimeCapabilities}
          capabilitiesError={runtimeCapabilitiesError}
          runs={runs}
          runsLoading={runsLoading}
          runsError={runsError}
          versions={versions}
          health={health}
          rollbackReceipt={rollbackReceipt}
          advancedCommand={advancedCommand}
          evidenceLoading={evidenceLoading}
          evidenceError={evidenceError}
          busy={busy}
          canManage={canManage}
          copy={copy}
          formatTimestamp={formatTimestamp}
          onActivate={(action) => onActivate(routine, action)}
          onTrigger={() => onTriggerRun(routine)}
          onRunCommand={(run, action) => onRunCommand(routine, run, action)}
          onRollbackVersion={(version) => onRollbackVersion(routine, version)}
          onDownloadTelemetry={() => onDownloadTelemetry(routine)}
          onAdvancedCommand={(payload) => onAdvancedCommand(routine, payload)}
          onRetry={onRetryRuntime}
        />

        {!archived ? (
          <Stack gap={1}>
            <ActionButton
              intent="primary"
              fullWidth
              startIcon={<FlaskConical size={17} aria-hidden="true" />}
              disabled={!dryRunEnabled}
              loading={busy}
              loadingLabel={copy.dryRunning}
              onClick={() => onDryRun(routine)}
              sx={{ minHeight: 44 }}
            >
              {copy.dryRun}
            </ActionButton>
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
              <ActionButton
                intent="secondary"
                fullWidth
                startIcon={<Pencil size={16} aria-hidden="true" />}
                disabled={busy || !canManage || routine.status === 'ACTIVE'}
                onClick={() => onEdit(routine)}
                sx={{ minHeight: 44 }}
              >
                {copy.edit}
              </ActionButton>
              <ActionButton
                intent="quiet"
                fullWidth
                startIcon={
                  routine.status === 'PAUSED' ? (
                    <PlayCircle size={16} aria-hidden="true" />
                  ) : (
                    <PauseCircle size={16} aria-hidden="true" />
                  )
                }
                disabled={busy || !canManage || routine.status === 'ACTIVE'}
                onClick={() => onToggleStatus(routine)}
                sx={{ minHeight: 44 }}
              >
                {routine.status === 'PAUSED' ? copy.resume : copy.pause}
              </ActionButton>
              <ActionButton
                intent="quiet"
                fullWidth
                startIcon={<Archive size={16} aria-hidden="true" />}
                disabled={busy || !canManage}
                onClick={() => onArchive(routine)}
                sx={{ minHeight: 44 }}
              >
                {copy.archive}
              </ActionButton>
            </Stack>
          </Stack>
        ) : null}
      </Stack>
    </DetailInspector>
  );
}

function ContractStep({
  number,
  title,
  value,
  warning = false,
  children,
}: {
  number: number;
  title: string;
  value: string;
  warning?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <Box
      component="li"
      sx={{
        display: 'grid',
        gridTemplateColumns: '28px minmax(0, 1fr)',
        gap: 1,
        p: 1,
        bgcolor: warning ? 'var(--dwp-semantic-warning-soft)' : 'var(--dwp-product-soft)',
        borderRadius: (theme) => Number(theme.shape.borderRadius) * 1.5 + 'px',
      }}
    >
      <Box
        aria-hidden="true"
        sx={{
          width: 24,
          height: 24,
          display: 'grid',
          placeItems: 'center',
          borderRadius: '50%',
          bgcolor: warning ? 'warning.main' : 'primary.main',
          color: 'primary.contrastText',
          fontSize: 'caption.fontSize',
          fontWeight: 'fontWeightBold',
        }}
      >
        {number}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="subtitle2">{title}</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
          {value}
        </Typography>
        {children}
      </Box>
    </Box>
  );
}
