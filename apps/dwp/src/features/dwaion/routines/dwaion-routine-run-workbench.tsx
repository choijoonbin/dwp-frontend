import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileKey2,
  GitBranch,
  RotateCcw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { ActionButton } from '@dwp-frontend/design-system';

import type {
  DwaionRoutineExecutionRun,
  DwaionRoutineRunCommand,
} from '@dwp-frontend/shared-utils';
import type { DwaionRoutineCopy } from './dwaion-routine-copy';

export function DwaionRoutineRunWorkbench({
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
  const receipt = run.receipt;
  const stages = [
    {
      key: 'trigger',
      title: copy.runStages.trigger,
      state: 'complete' as const,
      detail: `${run.trigger} · ${formatTimestamp(run.scheduledFor)} · ${run.routineRunId}`,
    },
    {
      key: 'authorization',
      title: copy.runStages.authorization,
      state: receipt ? ('complete' as const) : ('pending' as const),
      detail: receipt
        ? `${copy.authorizationRevision} ${receipt.authorizationDecisionRevision} · ${receipt.authorizedSources.join(' · ')}`
        : copy.runAuthorizationPending,
    },
    {
      key: 'evidence',
      title: copy.runStages.evidence,
      state: run.evidenceCount > 0 ? ('complete' as const) : ('pending' as const),
      detail: `${copy.dryRunMetrics.sources} ${run.evidenceCount}`,
    },
    {
      key: 'approval',
      title: copy.runStages.approval,
      state: ['COMPLETED', 'COMPENSATED'].includes(run.state)
        ? ('complete' as const)
        : ('pending' as const),
      detail: `${copy.runProposals} ${run.proposalsCreated} · ${copy.runApprovalGates} ${run.approvalGatedActionsCreated}`,
    },
    {
      key: 'delivery',
      title: copy.runStages.delivery,
      state:
        run.notificationState === 'FAILED'
          ? ('warning' as const)
          : run.notificationState === 'DELIVERED' || run.notificationState === 'NOT_REQUIRED'
            ? ('complete' as const)
            : ('pending' as const),
      detail: `${copy.runNotification}: ${run.notificationState}`,
    },
  ];

  return (
    <Box
      component="section"
      aria-labelledby="routine-run-workbench-title"
      data-testid="dwaion-routine-run-workbench"
      sx={{ mt: 1.25, p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1.5 }}
    >
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1}>
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" gap={0.75} alignItems="center">
            <GitBranch size={17} aria-hidden="true" />
            <Typography id="routine-run-workbench-title" component="h3" variant="subtitle2">
              {copy.runWorkbenchTitle}
            </Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            {copy.runWorkbenchDescription}
          </Typography>
        </Box>
        <Chip
          size="small"
          color={
            ['COMPLETED', 'COMPENSATED'].includes(run.state)
              ? 'success'
              : ['FAILED', 'PARTIAL'].includes(run.state)
                ? 'warning'
                : 'info'
          }
          label={run.state}
        />
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(4, minmax(0, 1fr))' },
          gap: 0.75,
          mt: 1.25,
        }}
      >
        <RunMetric label={copy.runEvidence} value={String(run.evidenceCount)} />
        <RunMetric label={copy.runTokens} value={run.tokensUsed.toLocaleString()} />
        <RunMetric label={copy.runLatency} value={`${run.elapsedMs}ms`} />
        <RunMetric label={copy.runAttempts} value={`${run.attemptCount}/${run.maximumAttempts}`} />
      </Box>

      <Typography component="h4" variant="subtitle2" sx={{ mt: 1.5 }}>
        {copy.executionDagTitle}
      </Typography>
      <Stack component="ol" gap={0.75} sx={{ p: 0, m: 0, mt: 0.75, listStyle: 'none' }}>
        {stages.map((stage, index) => (
          <Box
            component="li"
            key={stage.key}
            sx={{
              display: 'grid',
              gridTemplateColumns: '28px minmax(0, 1fr)',
              gap: 0.75,
              p: 1,
              bgcolor: 'action.hover',
              borderRadius: 1,
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
                bgcolor:
                  stage.state === 'complete'
                    ? 'success.main'
                    : stage.state === 'warning'
                      ? 'warning.main'
                      : 'action.disabled',
                color: 'common.white',
                fontWeight: 'fontWeightBold',
                fontSize: 'caption.fontSize',
              }}
            >
              {index + 1}
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" fontWeight="fontWeightBold">
                {stage.title}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
                {stage.detail}
              </Typography>
            </Box>
          </Box>
        ))}
      </Stack>

      <Box sx={{ mt: 1.25, p: 1, bgcolor: 'var(--dwp-product-soft)', borderRadius: 1 }}>
        <Stack direction="row" gap={0.75} alignItems="center">
          <ShieldCheck size={16} aria-hidden="true" />
          <Typography variant="subtitle2">{copy.zeroWriteEvidence}</Typography>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.35 }}>
          {receipt
            ? `${copy.externalWrites}: ${receipt.externalWritesPerformed} · ${copy.receiptFingerprint}: ${receipt.resultSha256}`
            : copy.zeroWriteReceiptPending}
        </Typography>
      </Box>

      <Box sx={{ mt: 1.25 }}>
        <Stack direction="row" gap={0.75} alignItems="center">
          <FileKey2 size={16} aria-hidden="true" />
          <Typography component="h4" variant="subtitle2">
            {copy.traceLedgerTitle}
          </Typography>
        </Stack>
        <Stack gap={0.35} sx={{ mt: 0.5 }}>
          <TraceLine label={copy.runIdentifier} value={run.routineRunId} />
          <TraceLine label={copy.runVersion} value={String(run.version)} />
          <TraceLine label={copy.runUpdatedAt} value={formatTimestamp(run.updatedAt)} />
          <TraceLine
            label={copy.runReceiptIdentifier}
            value={receipt?.receiptId ?? copy.runReceiptPending}
          />
          <TraceLine label={copy.idempotencyEvidence} value={copy.idempotencyUnavailable} />
        </Stack>
      </Box>

      {run.safeErrorCode ? (
        <Stack direction="row" gap={0.6} alignItems="flex-start" sx={{ mt: 1 }}>
          <AlertTriangle size={16} color="var(--mui-palette-warning-main)" aria-hidden="true" />
          <Typography variant="caption" color="warning.main">
            {run.safeErrorCode}
            {run.recoveryHint ? ` · ${run.recoveryHint}` : ''}
          </Typography>
        </Stack>
      ) : null}

      <Stack direction={{ xs: 'column', sm: 'row' }} gap={0.75} sx={{ mt: 1.25 }}>
        {retryable ? (
          <ActionButton
            intent="secondary"
            startIcon={<RotateCcw size={15} aria-hidden="true" />}
            disabled={busy || !canManage}
            onClick={() => onCommand('RETRY')}
          >
            {copy.retryRun}
          </ActionButton>
        ) : null}
        {running ? (
          <ActionButton
            intent="quiet"
            startIcon={<XCircle size={15} aria-hidden="true" />}
            disabled={busy || !canManage}
            onClick={() => onCommand('CANCEL')}
          >
            {copy.cancelRun}
          </ActionButton>
        ) : null}
        {compensatable ? (
          <ActionButton
            intent="quiet"
            startIcon={<Clock3 size={15} aria-hidden="true" />}
            disabled={busy || !canManage}
            onClick={() => onCommand('COMPENSATE')}
          >
            {copy.compensateRun}
          </ActionButton>
        ) : null}
        {!running && !retryable && !compensatable ? (
          <Stack direction="row" gap={0.5} alignItems="center">
            <CheckCircle2 size={16} color="var(--mui-palette-success-main)" aria-hidden="true" />
            <Typography variant="caption" color="text.secondary">
              {copy.noRecoveryActionRequired}
            </Typography>
          </Stack>
        ) : null}
      </Stack>
    </Box>
  );
}

function RunMetric({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ p: 0.75, bgcolor: 'action.hover', borderRadius: 1, minWidth: 0 }}>
      <Typography variant="subtitle2" sx={{ overflowWrap: 'anywhere' }}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Box>
  );
}

function TraceLine({ label, value }: { label: string; value: string }) {
  return (
    <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
      <Box component="span" sx={{ color: 'text.primary', fontWeight: 'fontWeightBold' }}>
        {label}:
      </Box>{' '}
      {value}
    </Typography>
  );
}
