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
import GlobalStyles from '@mui/material/GlobalStyles';
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
  DwaionRoutineAdvancedCommand,
  DwaionRoutineAdvancedPayload,
  DwaionRoutineHealth,
  DwaionRoutineProviderCapability,
  DwaionRoutineRollbackReceipt,
  DwaionRoutineRunCommand,
  DwaionRoutineRuntimeCapabilities,
  DwaionRoutineVersionSnapshot,
} from '@dwp-frontend/shared-utils';
import type { DwaionRoutineCopy } from './dwaion-routine-copy';
import type { DwaionRoutine } from './dwaion-routine-model';
import { DwaionCapabilityActions } from '../dwaion-capability-actions';
import { DwaionRoutineEvidencePanel } from './dwaion-routine-evidence-panel';
import { DwaionRoutineRunWorkbench } from './dwaion-routine-run-workbench';

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
  versions = [],
  health,
  rollbackReceipt,
  advancedCommand,
  evidenceLoading = false,
  evidenceError = false,
  busy,
  canManage,
  copy,
  formatTimestamp,
  onActivate,
  onTrigger,
  onRunCommand,
  onRollbackVersion,
  onDownloadTelemetry,
  onAdvancedCommand,
  onRetry,
}: {
  routine: DwaionRoutine;
  capabilities?: DwaionRoutineRuntimeCapabilities;
  capabilitiesError?: boolean;
  runs: readonly DwaionRoutineExecutionRun[];
  runsLoading?: boolean;
  runsError?: boolean;
  versions?: readonly DwaionRoutineVersionSnapshot[];
  health?: DwaionRoutineHealth;
  rollbackReceipt?: DwaionRoutineRollbackReceipt | null;
  advancedCommand?: DwaionRoutineAdvancedCommand | null;
  evidenceLoading?: boolean;
  evidenceError?: boolean;
  busy: boolean;
  canManage: boolean;
  copy: DwaionRoutineCopy;
  formatTimestamp: (value: string) => string;
  onActivate: (action: 'ACTIVATE' | 'DEACTIVATE') => void;
  onTrigger: () => void;
  onRunCommand: (run: DwaionRoutineExecutionRun, action: DwaionRoutineRunCommand['action']) => void;
  onRollbackVersion: (version: DwaionRoutineVersionSnapshot) => void;
  onDownloadTelemetry: () => void;
  onAdvancedCommand: (payload: DwaionRoutineAdvancedPayload) => void;
  onRetry: () => void;
}) {
  const [pending, setPending] = useState<PendingOperation | null>(null);
  const active = routine.status === 'ACTIVE' && routine.executionMode !== 'DRY_RUN_ONLY';
  const runtimeAvailable = Boolean(
    capabilities?.activationAvailable &&
    (routine.triggerType === 'WEBHOOK'
      ? capabilities.webhookTriggerAvailable
      : capabilities.schedulingAvailable) &&
    capabilities.backgroundExecutionAvailable
  );
  const confirmCopy = operationCopy(pending, copy);
  const printableRun = selectPrintableRoutineRun(runs);

  return (
    <Box component="section" aria-labelledby="routine-execution-title">
      <GlobalStyles
        styles={{
          '@media print': {
            'body *': { visibility: 'hidden !important' },
            '.routine-print-report, .routine-print-report *': {
              visibility: 'visible !important',
            },
            '.routine-print-report': {
              display: 'block !important',
              position: 'absolute',
              inset: '0 auto auto 0',
              width: '100%',
            },
          },
        }}
      />
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

      {runs[0] ? (
        <DwaionRoutineRunWorkbench
          run={runs[0]}
          capabilities={capabilities}
          busy={busy}
          canManage={canManage}
          copy={copy}
          formatTimestamp={formatTimestamp}
          onCommand={(action) => setPending({ kind: 'run', run: runs[0]!, action })}
        />
      ) : null}

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
          {runs.slice(0, 5).map((run, index) => (
            <RunItem
              key={run.routineRunId}
              run={run}
              busy={busy}
              canManage={canManage}
              copy={copy}
              formatTimestamp={formatTimestamp}
              showActions={index > 0}
              onCommand={(action) => setPending({ kind: 'run', run, action })}
            />
          ))}
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.25 }}>
          {copy.noRuns}
        </Typography>
      )}

      <DwaionRoutineEvidencePanel
        routine={routine}
        versions={versions}
        health={health}
        rollbackReceipt={rollbackReceipt}
        loading={evidenceLoading}
        error={evidenceError}
        busy={busy}
        canManage={canManage}
        copy={copy}
        formatTimestamp={formatTimestamp}
        onRetry={onRetry}
        onRollback={onRollbackVersion}
        onDownloadTelemetry={onDownloadTelemetry}
      />

      <Box sx={{ mt: 1.25 }}>
        <DwaionCapabilityActions
          title={copy.advancedRuntimeTitle}
          description={copy.advancedRuntimeDescription}
          actions={routineProviderActions(
            routine,
            runs,
            printableRun,
            advancedCommand,
            capabilities,
            copy,
            canManage && !busy,
            onAdvancedCommand
          )}
        />
        {advancedCommand?.routineId === routine.routineId ? (
          <InlineFeedback
            severity={
              advancedCommand.state === 'FAILED'
                ? 'error'
                : advancedCommand.state === 'PARTIAL'
                  ? 'warning'
                  : advancedCommand.state === 'SUCCEEDED'
                    ? 'success'
                    : 'info'
            }
            sx={{ mt: 1 }}
          >
            <Typography variant="body2" fontWeight="fontWeightBold">
              {advancedCommand.kind} · {advancedCommand.state}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
              {advancedCommand.problem?.detail ??
                advancedCommand.receipt?.providerReceiptId ??
                advancedCommand.commandId}
            </Typography>
          </InlineFeedback>
        ) : null}
      </Box>

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
      {printableRun ? (
        <RoutineRunPrintReport
          routine={routine}
          run={printableRun}
          copy={copy}
          formatTimestamp={formatTimestamp}
        />
      ) : null}
    </Box>
  );
}

function routineProviderActions(
  routine: DwaionRoutine,
  runs: readonly DwaionRoutineExecutionRun[],
  reportRun: DwaionRoutineExecutionRun | null,
  advancedCommand: DwaionRoutineAdvancedCommand | null | undefined,
  capabilities: DwaionRoutineRuntimeCapabilities | undefined,
  copy: DwaionRoutineCopy,
  enabled: boolean,
  onAdvancedCommand: (payload: DwaionRoutineAdvancedPayload) => void
) {
  const providerReason = capabilities?.recoveryHint ?? copy.runtimeActionUnavailable;
  const source = routine.sourceKeys.find(
    (value): value is 'WORK_ITEM' | 'MAIL' | 'CALENDAR' =>
      value === 'WORK_ITEM' || value === 'MAIL' || value === 'CALENDAR'
  );
  const latestRun = runs[0];
  const rollbackRun = runs.find((run) => Boolean(run.receipt?.providerReceiptId));
  const enginePayload =
    advancedCommand?.kind === 'AGENT_ENGINE_SWITCH' &&
    advancedCommand.state === 'SUCCEEDED' &&
    advancedCommand.receipt?.providerOutcome.appliedPayload.kind === 'AGENT_ENGINE_SWITCH'
      ? advancedCommand.receipt.providerOutcome.appliedPayload
      : null;
  const activeEngineOverride =
    enginePayload?.action === 'APPLY' && Date.parse(enginePayload.expiresAt) > Date.now();
  const action = (
    key: string,
    label: string,
    capability: DwaionRoutineProviderCapability | undefined,
    payload: () => DwaionRoutineAdvancedPayload,
    prerequisite = true
  ) => ({
    key,
    label,
    capability: `routine.provider.${key}`,
    reason:
      capability?.recoveryHint ??
      capability?.reasonCode ??
      (capability?.available && capability.configured ? copy.runtimeEvidenceReady : providerReason),
    available: Boolean(enabled && prerequisite && capability?.available && capability.configured),
    onClick: () => onAdvancedCommand(payload()),
  });
  return [
    {
      key: 'print',
      label: copy.printReport,
      capability: 'browser.print',
      reason: reportRun?.receipt
        ? `${copy.runtimeEvidenceReady} · ${reportRun.receipt.receiptId}`
        : copy.runReceiptPending,
      available: Boolean(reportRun?.receipt),
      onClick: () => {
        if (!reportRun?.receipt) return;
        const previousTitle = document.title;
        document.title = `${routine.title} · ${reportRun.routineRunId} · ${reportRun.receipt.receiptId}`;
        window.addEventListener(
          'afterprint',
          () => {
            document.title = previousTitle;
          },
          { once: true }
        );
        window.print();
      },
    },
    action('worm', copy.wormDelivery, capabilities?.wormDelivery, () => ({
      kind: 'WORM_EVIDENCE_DELIVERY',
      evidenceScope: 'FULL_AUDIT',
      retentionDays: 1825,
      legalHold: false,
    })),
    action(
      'oauth',
      copy.oauthReauthorize,
      capabilities?.oauthReauthorization,
      () => ({
        kind: 'OAUTH_REAUTHORIZATION',
        source: source ?? 'WORK_ITEM',
        connectionReference: `routine-source:${source ?? 'WORK_ITEM'}`,
      }),
      Boolean(source)
    ),
    action('temporary-limit', copy.temporaryLimit, capabilities?.temporaryBudgetIncrease, () => ({
      kind: 'TEMPORARY_BUDGET_INCREASE',
      additionalRuns: 1,
      additionalTokensPerRun: 10_000,
      additionalMinutesPerRun: 15,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })),
    action(
      'engine-rollback',
      copy.engineRollback,
      capabilities?.agentSwitching,
      () => ({ kind: 'AGENT_ENGINE_SWITCH', action: 'ROLLBACK' }),
      activeEngineOverride
    ),
    action('escalate', copy.escalate, capabilities?.operatorEscalation, () => ({
      kind: 'OPERATOR_ESCALATION',
      severity: 'P2',
      summary: `Operator review requested for routine ${routine.title}.`,
      routineRunId: latestRun?.routineRunId ?? null,
    })),
    action(
      'provider-rollback',
      copy.compensateRun,
      capabilities?.providerRollback,
      () => ({
        kind: 'PROVIDER_ROLLBACK',
        routineRunId: rollbackRun?.routineRunId ?? '',
        providerReceiptId: rollbackRun?.receipt?.providerReceiptId ?? '',
      }),
      Boolean(rollbackRun?.receipt?.providerReceiptId)
    ),
  ];
}

export function selectPrintableRoutineRun(
  runs: readonly DwaionRoutineExecutionRun[]
): DwaionRoutineExecutionRun | null {
  return (
    runs.find(
      (run) =>
        (run.state === 'COMPLETED' || run.state === 'COMPENSATED') &&
        run.receipt?.routineRunId === run.routineRunId &&
        run.receipt.terminalState === run.state
    ) ?? null
  );
}

function RoutineRunPrintReport({
  routine,
  run,
  copy,
  formatTimestamp,
}: {
  routine: DwaionRoutine;
  run: DwaionRoutineExecutionRun;
  copy: DwaionRoutineCopy;
  formatTimestamp: (value: string) => string;
}) {
  const receipt = run.receipt;
  if (!receipt) return null;
  const metrics = [
    [copy.printEvidenceCount, run.evidenceCount],
    [copy.printProposalsCreated, run.proposalsCreated],
    [copy.printApprovalActions, run.approvalGatedActionsCreated],
    [copy.printTokensUsed, run.tokensUsed],
    [copy.printElapsed, `${run.elapsedMs} ms`],
  ] as const;
  return (
    <Box
      className="routine-print-report"
      data-run-id={run.routineRunId}
      data-receipt-id={receipt.receiptId}
      sx={{ display: 'none', color: '#111', bgcolor: '#fff', p: 4 }}
    >
      <Typography component="h1" variant="h4">
        {copy.printReportTitle}
      </Typography>
      <Typography component="p" variant="h6" sx={{ mt: 1 }}>
        {routine.title}
      </Typography>
      <Stack component="dl" spacing={1.25} sx={{ mt: 3, m: 0 }}>
        <PrintFact label={copy.printRunId} value={run.routineRunId} />
        <PrintFact label={copy.printReceiptId} value={receipt.receiptId} />
        <PrintFact label={copy.printResultDigest} value={receipt.resultSha256} />
        <PrintFact label={copy.printTerminalState} value={run.state} />
        <PrintFact label={copy.printCompletedAt} value={formatTimestamp(receipt.completedAt)} />
      </Stack>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 2,
          mt: 3,
        }}
      >
        {metrics.map(([label, value]) => (
          <Box key={label} sx={{ border: '1px solid #d1d5db', borderRadius: 1, p: 1.5 }}>
            <Typography variant="caption" component="p">
              {label}
            </Typography>
            <Typography variant="h6" component="p">
              {value}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function PrintFact({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '10rem minmax(0, 1fr)', gap: 2 }}>
      <Typography component="dt" variant="body2" fontWeight="fontWeightBold">
        {label}
      </Typography>
      <Typography component="dd" variant="body2" sx={{ m: 0, overflowWrap: 'anywhere' }}>
        {value}
      </Typography>
    </Box>
  );
}

function RunItem({
  run,
  busy,
  canManage,
  copy,
  formatTimestamp,
  showActions,
  onCommand,
}: {
  run: DwaionRoutineExecutionRun;
  busy: boolean;
  canManage: boolean;
  copy: DwaionRoutineCopy;
  formatTimestamp: (value: string) => string;
  showActions: boolean;
  onCommand: (action: DwaionRoutineRunCommand['action']) => void;
}) {
  const running = ['QUEUED', 'CLAIMED', 'RUNNING', 'RETRY_SCHEDULED'].includes(run.state);
  const retryable = ['PARTIAL', 'FAILED'].includes(run.state);
  const compensatable =
    (run.state === 'PARTIAL' && run.compensationRequired) ||
    (run.state === 'COMPLETED' && Boolean(run.receipt));
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
          {run.receipt.recoveryAction ? (
            <Typography variant="caption" color="text.secondary" display="block">
              {copy.recoveryAction}: {run.receipt.recoveryAction}
            </Typography>
          ) : null}
          {run.receipt.recoveryCommandId ? (
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
              sx={{ overflowWrap: 'anywhere' }}
            >
              {copy.recoveryCommandId}: {run.receipt.recoveryCommandId}
            </Typography>
          ) : null}
        </Box>
      ) : null}
      {showActions && (running || retryable || compensatable) ? (
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
              {run.state === 'PARTIAL' ? copy.safeCancelRollback : copy.compensateRun}
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
    pending.action === 'SKIP_QUARANTINED_AND_CONTINUE'
      ? copy.skipQuarantined
      : pending.action === 'RETRY'
        ? copy.retryRun
        : pending.action === 'CANCEL'
          ? copy.cancelRun
          : pending.run.state === 'PARTIAL'
            ? copy.safeCancelRollback
            : copy.compensateRun;
  return {
    title: label,
    description:
      pending.action === 'SKIP_QUARANTINED_AND_CONTINUE'
        ? copy.skipQuarantinedDescription
        : pending.action === 'COMPENSATE'
          ? copy.compensationEnabled
          : copy.recoveryPolicy,
    confirm: label,
  };
}
