import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  History,
  Play,
  Power,
  RotateCcw,
  XCircle,
} from 'lucide-react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  ActionButton,
  ConfirmDialog,
  InlineFeedback,
  LoadingState,
} from '@dwp-frontend/design-system';

import type {
  DwaionRoutineExecutionRun,
  DwaionRoutineRunCommand,
  DwaionRoutineRuntimeCapabilities,
} from '@dwp-frontend/shared-utils';
import type { DwaionRoutineCopy } from './dwaion-routine-copy';
import type { DwaionRoutine } from './dwaion-routine-model';

type PendingOperation =
  | { kind: 'activation'; action: 'ACTIVATE' | 'DEACTIVATE' }
  | { kind: 'trigger' }
  | { kind: 'run'; run: DwaionRoutineExecutionRun; action: DwaionRoutineRunCommand['action'] };

export function DwaionRoutineExecutionPanel({
  routine,
  capabilities,
  capabilitiesError,
  runs,
  runsLoading,
  runsError,
  busy,
  canManage,
  copy,
  formatTimestamp,
  onActivate,
  onTrigger,
  onRunCommand,
  onRetry,
}: {
  routine: DwaionRoutine;
  capabilities?: DwaionRoutineRuntimeCapabilities;
  capabilitiesError?: boolean;
  runs: readonly DwaionRoutineExecutionRun[];
  runsLoading?: boolean;
  runsError?: boolean;
  busy: boolean;
  canManage: boolean;
  copy: DwaionRoutineCopy;
  formatTimestamp: (value: string) => string;
  onActivate: (action: 'ACTIVATE' | 'DEACTIVATE') => void;
  onTrigger: () => void;
  onRunCommand: (run: DwaionRoutineExecutionRun, action: DwaionRoutineRunCommand['action']) => void;
  onRetry: () => void;
}) {
  const [pending, setPending] = useState<PendingOperation | null>(null);
  const active = routine.status === 'ACTIVE' && routine.executionMode === 'SCHEDULED';
  const runtimeAvailable = Boolean(
    capabilities?.activationAvailable &&
    capabilities.schedulingAvailable &&
    capabilities.backgroundExecutionAvailable
  );
  const confirmCopy = operationCopy(pending, copy);

  return (
    <Box component="section" aria-labelledby="routine-execution-title">
      <Stack direction="row" alignItems="center" gap={0.75}>
        <History size={17} aria-hidden="true" />
        <Typography id="routine-execution-title" component="h3" variant="subtitle2">
          {copy.runHistory}
        </Typography>
        <Chip
          size="small"
          color={active ? 'success' : 'default'}
          label={active ? copy.status.ACTIVE : copy.status[routine.status]}
          sx={{ ml: 'auto' }}
        />
      </Stack>

      {capabilitiesError ? (
        <InlineFeedback
          severity="warning"
          action={
            <ActionButton intent="quiet" onClick={onRetry}>
              {copy.retry}
            </ActionButton>
          }
          sx={{ mt: 1 }}
        >
          {copy.partial}
        </InlineFeedback>
      ) : !runtimeAvailable ? (
        <InlineFeedback severity="info" sx={{ mt: 1 }}>
          <Typography variant="body2" fontWeight="fontWeightBold">
            {copy.activationUnavailable}
          </Typography>
          {capabilities?.recoveryHint ? (
            <Typography variant="caption" color="text.secondary">
              {capabilities.recoveryHint}
            </Typography>
          ) : null}
        </InlineFeedback>
      ) : null}

      <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} sx={{ mt: 1 }}>
        <ActionButton
          intent={active ? 'secondary' : 'primary'}
          fullWidth
          startIcon={<Power size={16} aria-hidden="true" />}
          disabled={!canManage || busy || !runtimeAvailable || routine.status === 'ARCHIVED'}
          onClick={() =>
            setPending({ kind: 'activation', action: active ? 'DEACTIVATE' : 'ACTIVATE' })
          }
          sx={{ minHeight: 44 }}
        >
          {active ? copy.deactivate : copy.activate}
        </ActionButton>
        <ActionButton
          intent="secondary"
          fullWidth
          startIcon={<Play size={16} aria-hidden="true" />}
          disabled={!canManage || busy || !runtimeAvailable || !active}
          onClick={() => setPending({ kind: 'trigger' })}
          sx={{ minHeight: 44 }}
        >
          {copy.runNow}
        </ActionButton>
      </Stack>

      {runsLoading ? (
        <LoadingState embedded label={copy.runHistory} variant="skeleton" skeletonRows={2} />
      ) : runsError ? (
        <InlineFeedback
          severity="warning"
          action={
            <ActionButton intent="quiet" onClick={onRetry}>
              {copy.retry}
            </ActionButton>
          }
          sx={{ mt: 1 }}
        >
          {copy.partial}
        </InlineFeedback>
      ) : runs.length ? (
        <Stack component="ol" gap={1} sx={{ p: 0, m: 0, mt: 1.25, listStyle: 'none' }}>
          {runs.slice(0, 5).map((run) => (
            <RunItem
              key={run.routineRunId}
              run={run}
              busy={busy}
              canManage={canManage}
              copy={copy}
              formatTimestamp={formatTimestamp}
              onCommand={(action) => setPending({ kind: 'run', run, action })}
            />
          ))}
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.25 }}>
          {copy.noRuns}
        </Typography>
      )}

      <ConfirmDialog
        open={Boolean(pending)}
        title={confirmCopy.title}
        description={confirmCopy.description}
        cancelLabel={copy.cancel}
        confirmLabel={confirmCopy.confirm}
        busy={busy}
        intent={
          pending?.kind === 'run' &&
          (pending.action === 'CANCEL' || pending.action === 'COMPENSATE')
            ? 'danger'
            : 'primary'
        }
        onClose={() => setPending(null)}
        onConfirm={() => {
          if (!pending) return;
          if (pending.kind === 'activation') onActivate(pending.action);
          else if (pending.kind === 'trigger') onTrigger();
          else onRunCommand(pending.run, pending.action);
          setPending(null);
        }}
      />
    </Box>
  );
}

function RunItem({
  run,
  busy,
  canManage,
  copy,
  formatTimestamp,
  onCommand,
}: {
  run: DwaionRoutineExecutionRun;
  busy: boolean;
  canManage: boolean;
  copy: DwaionRoutineCopy;
  formatTimestamp: (value: string) => string;
  onCommand: (action: DwaionRoutineRunCommand['action']) => void;
}) {
  const running = ['QUEUED', 'CLAIMED', 'RUNNING', 'RETRY_SCHEDULED'].includes(run.state);
  const retryable = ['PARTIAL', 'FAILED'].includes(run.state);
  const compensatable =
    ['PARTIAL', 'COMPLETED', 'FAILED'].includes(run.state) && Boolean(run.receipt);
  return (
    <Box component="li" sx={{ p: 1.25, bgcolor: 'action.hover', borderRadius: 1.5 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" fontWeight="fontWeightBold">
            {run.state} · {run.trigger}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {formatTimestamp(run.updatedAt)} · {run.attemptCount}/{run.maximumAttempts}
          </Typography>
        </Box>
        <Chip
          size="small"
          color={
            ['COMPLETED', 'COMPENSATED'].includes(run.state)
              ? 'success'
              : ['FAILED', 'PARTIAL'].includes(run.state)
                ? 'warning'
                : run.state === 'CANCELLED'
                  ? 'default'
                  : 'info'
          }
          label={`${run.elapsedMs}ms`}
        />
      </Stack>
      {run.safeErrorCode ? (
        <Stack direction="row" gap={0.6} alignItems="flex-start" sx={{ mt: 0.75 }}>
          <AlertTriangle size={15} color="var(--mui-palette-warning-main)" aria-hidden="true" />
          <Typography variant="caption" color="warning.main">
            {run.safeErrorCode}
            {run.recoveryHint ? ` · ${run.recoveryHint}` : ''}
          </Typography>
        </Stack>
      ) : null}
      {run.receipt ? (
        <Box sx={{ mt: 1, p: 1, bgcolor: 'background.paper', borderRadius: 1 }}>
          <Stack direction="row" gap={0.6} alignItems="center">
            <CheckCircle2 size={15} color="var(--mui-palette-success-main)" aria-hidden="true" />
            <Typography variant="caption" fontWeight="fontWeightBold">
              {copy.actualReceipt} · {run.receipt.receiptId}
            </Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary" display="block">
            {copy.authorizationRevision}: {run.receipt.authorizationDecisionRevision}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block">
            {copy.authorizedSources}: {run.receipt.authorizedSources.join(' · ')}
          </Typography>
        </Box>
      ) : null}
      {running || retryable || compensatable ? (
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={0.75} sx={{ mt: 1 }}>
          {retryable ? (
            <ActionButton
              intent="secondary"
              startIcon={<RotateCcw size={15} />}
              disabled={busy || !canManage}
              onClick={() => onCommand('RETRY')}
            >
              {copy.retryRun}
            </ActionButton>
          ) : null}
          {running ? (
            <ActionButton
              intent="quiet"
              startIcon={<XCircle size={15} />}
              disabled={busy || !canManage}
              onClick={() => onCommand('CANCEL')}
            >
              {copy.cancelRun}
            </ActionButton>
          ) : null}
          {compensatable ? (
            <ActionButton
              intent="quiet"
              disabled={busy || !canManage}
              onClick={() => onCommand('COMPENSATE')}
            >
              {copy.compensateRun}
            </ActionButton>
          ) : null}
        </Stack>
      ) : null}
    </Box>
  );
}

function operationCopy(pending: PendingOperation | null, copy: DwaionRoutineCopy) {
  if (!pending)
    return { title: copy.runHistory, description: copy.runHistory, confirm: copy.confirm };
  if (pending.kind === 'activation') {
    return pending.action === 'ACTIVATE'
      ? {
          title: copy.activate,
          description: `${copy.executionBudgetHelp} ${copy.consentHelp}`,
          confirm: copy.activate,
        }
      : {
          title: copy.deactivate,
          description: copy.schedulerUnavailableHelp,
          confirm: copy.deactivate,
        };
  }
  if (pending.kind === 'trigger') {
    return { title: copy.runNow, description: copy.executionBudgetHelp, confirm: copy.runNow };
  }
  const label =
    pending.action === 'RETRY'
      ? copy.retryRun
      : pending.action === 'CANCEL'
        ? copy.cancelRun
        : copy.compensateRun;
  return {
    title: label,
    description: pending.action === 'COMPENSATE' ? copy.compensationEnabled : copy.recoveryPolicy,
    confirm: label,
  };
}
