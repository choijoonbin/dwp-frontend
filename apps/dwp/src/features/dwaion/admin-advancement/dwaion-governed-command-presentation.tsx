import { CheckCircle2, Clock3, RotateCcw, ShieldCheck, TriangleAlert } from 'lucide-react';
import {
  ActionButton,
  FormField,
  InlineFeedback,
  foundationTokens,
} from '@dwp-frontend/design-system';
import type { DwaionGovernedCommand, DwaionGovernedCommandKind } from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { useDwaionAdminAdvancementCopy } from './dwaion-admin-advancement-copy';

export type DwaionCommandIntent = {
  title: string;
  description: string;
  kind: DwaionGovernedCommandKind;
  target: { type: string; id: string };
  expectedVersion: number;
  changes: Array<{ label: string; before: string; after: string }>;
  impacts: string[];
  recoveryPlan: string;
  payload?: Record<string, unknown>;
  destructive?: boolean;
};

export type DwaionCommandTransition = 'approve' | 'reject' | 'cancel' | 'retry' | 'rollback';

export function DwaionCommandReview({ intent }: { intent: DwaionCommandIntent | null }) {
  if (!intent) return null;
  return <CommandReviewDetails changes={intent.changes} impacts={intent.impacts} />;
}

export function DwaionStoredCommandReview({ command }: { command: DwaionGovernedCommand }) {
  const copy = useDwaionAdminAdvancementCopy();
  return (
    <Stack spacing={2}>
      <Stack spacing={0.5}>
        <Typography component="h3" variant="subtitle2">
          {copy.ui.command.submittedReviewRecord}
        </Typography>
        <Typography variant="body2">{command.review.reason}</Typography>
        <Typography variant="caption" color="text.secondary">
          {command.review.ticketRef}
          {command.review.evidenceRefs.length > 0
            ? ` · ${command.review.evidenceRefs.join(' · ')}`
            : ''}
        </Typography>
      </Stack>
      <CommandReviewDetails
        changes={command.review.preflight.changes.map((change) => ({
          label: change.field,
          before: change.before,
          after: change.after,
        }))}
        impacts={command.review.preflight.impactScopes}
      />
      <Box>
        <Typography variant="subtitle2">{copy.ui.command.recoveryPlan}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {command.review.preflight.recoveryPlan}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
          {copy.ui.common.checksumPrefix} · {command.review.preflight.recoveryPlanHash}
        </Typography>
      </Box>
      <Divider />
    </Stack>
  );
}

function CommandReviewDetails({
  changes,
  impacts,
}: {
  changes: Array<{ label: string; before: string; after: string }>;
  impacts: string[];
}) {
  return (
    <Stack spacing={2}>
      <Box
        sx={{
          border: 1,
          borderColor: 'divider',
          borderRadius: `${foundationTokens.radius.surface}px`,
          overflow: 'hidden',
        }}
      >
        {changes.map((change, index) => (
          <Box
            key={`${change.label}-${index}`}
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '9rem minmax(0, 1fr) minmax(0, 1fr)' },
              gap: 1,
              px: 1.5,
              py: 1.25,
              borderTop: index ? 1 : 0,
              borderColor: 'divider',
            }}
          >
            <Typography variant="caption" color="text.secondary">
              {change.label}
            </Typography>
            <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
              {change.before}
            </Typography>
            <Typography variant="body2" fontWeight={700} sx={{ overflowWrap: 'anywhere' }}>
              {change.after}
            </Typography>
          </Box>
        ))}
      </Box>
      <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
        {impacts.map((impact) => (
          <Typography component="li" variant="body2" key={impact} sx={{ mb: 0.5 }}>
            {impact}
          </Typography>
        ))}
      </Box>
    </Stack>
  );
}

export function DwaionCommandLifecycle({
  command,
  transitionReason,
  onTransitionReason,
  refreshing,
  onRefresh,
}: {
  command: DwaionGovernedCommand;
  transitionReason: string;
  onTransitionReason: (value: string) => void;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const copy = useDwaionAdminAdvancementCopy();
  const active = ['AWAITING_APPROVAL', 'QUEUED', 'RUNNING', 'PARTIAL'].includes(command.state);
  const tone: 'success' | 'error' | 'warning' | 'info' =
    command.state === 'SUCCEEDED'
      ? 'success'
      : command.state === 'FAILED' || command.state === 'REJECTED'
        ? 'error'
        : command.state === 'PARTIAL'
          ? 'warning'
          : 'info';
  return (
    <Stack spacing={2.25} aria-live="polite">
      <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
        <Chip
          icon={
            command.state === 'SUCCEEDED' ? (
              <CheckCircle2 size={16} />
            ) : command.state === 'FAILED' || command.state === 'REJECTED' ? (
              <TriangleAlert size={16} />
            ) : (
              <Clock3 size={16} />
            )
          }
          color={tone}
          label={command.state}
        />
        <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
          {command.commandId}
        </Typography>
        <ActionButton intent="quiet" loading={refreshing} onClick={onRefresh}>
          {copy.command.refreshStatus}
        </ActionButton>
      </Stack>
      {(command.state === 'QUEUED' || command.state === 'RUNNING') && (
        <LinearProgress
          variant={command.progressPercent == null ? 'indeterminate' : 'determinate'}
          value={command.progressPercent ?? undefined}
          aria-label={command.state}
        />
      )}
      {command.state === 'AWAITING_APPROVAL' && (
        <Stack direction="row" gap={1} alignItems="center">
          <ShieldCheck size={18} aria-hidden="true" />
          <InlineFeedback severity="warning">{copy.command.pendingApproval}</InlineFeedback>
        </Stack>
      )}
      {command.problem && (
        <Alert severity="error">
          <Typography variant="subtitle2">{command.problem.code}</Typography>
          <Typography variant="body2">{command.problem.detail}</Typography>
          {command.problem.recoveryHint && (
            <Typography variant="caption">{command.problem.recoveryHint}</Typography>
          )}
        </Alert>
      )}
      {command.transitionBlockReason && (
        <InlineFeedback severity="info">{command.transitionBlockReason}</InlineFeedback>
      )}
      {command.decision && (
        <Box>
          <Typography variant="subtitle2">{command.decision.decision}</Typography>
          <Typography variant="body2" color="text.secondary">
            {command.decision.reason} · {command.decision.actorUserId}
          </Typography>
          {command.decision.evidenceRefs.length > 0 && (
            <Typography variant="caption" color="text.secondary">
              {command.decision.evidenceRefs.join(' · ')}
            </Typography>
          )}
        </Box>
      )}
      <Divider />
      <Box>
        <Typography component="h3" variant="subtitle2">
          {copy.command.receipt}
        </Typography>
        {command.receipt ? (
          <Stack spacing={0.5} sx={{ mt: 1 }}>
            <Typography variant="body2">{command.receipt.resultSummary}</Typography>
            <Typography variant="caption" color="text.secondary">
              {command.receipt.receiptId} · {command.receipt.auditEventId}
            </Typography>
            {command.receipt.domainReceiptRef && (
              <Typography variant="caption" color="text.secondary">
                {copy.ui.command.domainReceipt} {command.receipt.domainReceiptRef}
              </Typography>
            )}
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {copy.command.noReceipt}
          </Typography>
        )}
      </Box>
      {(active || command.state === 'FAILED' || command.state === 'SUCCEEDED') &&
        command.allowedTransitions.length > 0 && (
          <FormField
            required
            multiline
            minRows={2}
            label={copy.command.transitionReason}
            value={transitionReason}
            onChange={(event) => onTransitionReason(event.target.value)}
          />
        )}
    </Stack>
  );
}

export function DwaionCommandActions({
  command,
  busy,
  disabled,
  onTransition,
}: {
  command: DwaionGovernedCommand;
  busy: boolean;
  disabled: boolean;
  onTransition: (transition: DwaionCommandTransition) => void;
}) {
  const copy = useDwaionAdminAdvancementCopy();
  if (command.state === 'AWAITING_APPROVAL') {
    const canApprove = command.canApprove && command.allowedTransitions.includes('APPROVE');
    const canReject = command.allowedTransitions.includes('REJECT');
    const canCancel = command.allowedTransitions.includes('CANCEL');
    if (!canApprove && !canReject && !canCancel) return null;
    return (
      <Stack direction="row" gap={1} flexWrap="wrap">
        {canReject && (
          <ActionButton
            intent="danger"
            disabled={busy || disabled}
            onClick={() => onTransition('reject')}
          >
            {copy.command.reject}
          </ActionButton>
        )}
        {canApprove && (
          <ActionButton
            intent="primary"
            disabled={busy || disabled}
            onClick={() => onTransition('approve')}
          >
            {copy.command.approve}
          </ActionButton>
        )}
        {canCancel && (
          <ActionButton
            intent="danger"
            disabled={busy || disabled}
            onClick={() => onTransition('cancel')}
          >
            {copy.command.cancelCommand}
          </ActionButton>
        )}
      </Stack>
    );
  }
  if (
    (command.state === 'QUEUED' || command.state === 'RUNNING') &&
    command.allowedTransitions.includes('CANCEL')
  ) {
    return (
      <ActionButton
        intent="danger"
        disabled={busy || disabled}
        onClick={() => onTransition('cancel')}
      >
        {copy.command.cancelCommand}
      </ActionButton>
    );
  }
  if (command.state === 'PARTIAL' || command.state === 'FAILED') {
    const canRetry = command.allowedTransitions.includes('RETRY');
    const canRollback = command.allowedTransitions.includes('ROLLBACK');
    if (!canRetry && !canRollback) return null;
    return (
      <Stack direction="row" gap={1} flexWrap="wrap">
        {canRetry && (
          <ActionButton
            intent="secondary"
            startIcon={<RotateCcw size={16} />}
            disabled={busy || disabled}
            onClick={() => onTransition('retry')}
          >
            {copy.command.retryCommand}
          </ActionButton>
        )}
        {canRollback && (
          <ActionButton
            intent="danger"
            disabled={busy || disabled}
            onClick={() => onTransition('rollback')}
          >
            {copy.command.rollback}
          </ActionButton>
        )}
      </Stack>
    );
  }
  if (command.state === 'SUCCEEDED' && command.allowedTransitions.includes('ROLLBACK')) {
    return (
      <ActionButton
        intent="danger"
        disabled={busy || disabled}
        onClick={() => onTransition('rollback')}
      >
        {copy.command.rollback}
      </ActionButton>
    );
  }
  return null;
}
