import { AlertTriangle, CircleCheckBig, RefreshCw, RotateCcw, SearchCheck } from 'lucide-react';
import { ActionButton } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';

import type {
  TimecardCommandFailure,
  TimecardCommandFeedback,
} from '../hooks/use-timecard-workspace';

const FAILURE_COPY: Record<
  TimecardCommandFailure['kind'],
  Readonly<{ title: string; description: string }>
> = {
  CONFLICT: {
    title: 'The timecard changed',
    description:
      'Your entries remain in this dialog. Refresh the canonical record and review its new version before sending another command.',
  },
  DENIED: {
    title: 'This command is not available',
    description:
      'Current owner authorization did not permit the command. Nothing was sent through a legacy path.',
  },
  REJECTED: {
    title: 'The command was rejected',
    description:
      'Your entries remain in this dialog. Review the values or refresh the canonical record before trying a new command.',
  },
  UNKNOWN_OUTCOME: {
    title: 'The command outcome is not confirmed',
    description:
      'The command may have been accepted. Keep this dialog open and retry the exact command or check its receipt; both paths preserve the command identity.',
  },
  RECEIPT_UNAVAILABLE: {
    title: 'The receipt could not be checked',
    description:
      'No new command was created. Keep this dialog open and check the existing receipt again when the service is available.',
  },
};

const RECEIPT_COPY: Record<
  TimecardCommandFeedback['status'],
  Readonly<{ title: string; description: string }>
> = {
  ACCEPTED: {
    title: 'Command accepted',
    description: 'The canonical owner accepted the command. Check the same receipt for completion.',
  },
  RUNNING: {
    title: 'Command is running',
    description:
      'The canonical owner is processing the command. Check the same receipt for completion.',
  },
  SUCCEEDED: {
    title: 'Command completed',
    description: 'The canonical timecard will refresh to its owner-confirmed state.',
  },
  REJECTED: {
    title: 'Command rejected',
    description: 'The owner rejected the command and did not confirm the requested transition.',
  },
  FAILED: {
    title: 'Command failed',
    description: 'The owner recorded a terminal failure. Refresh before preparing another command.',
  },
  RESULT_UNKNOWN: {
    title: 'Command result is unknown',
    description: 'Check the same receipt before deciding whether to retry the exact command.',
  },
};

export function TimecardCommandNotice({
  failure,
  feedback,
  busy,
  onRefresh,
  onRetry,
  onReconcile,
}: {
  failure: TimecardCommandFailure | null;
  feedback: TimecardCommandFeedback | null;
  busy: boolean;
  onRefresh: () => void;
  onRetry: () => void;
  onReconcile: () => void;
}) {
  const { t } = useTranslation('hcm');
  if (!failure && !feedback) return null;

  const copy = failure ? FAILURE_COPY[failure.kind] : RECEIPT_COPY[feedback!.status];
  const terminalSuccess = !failure && feedback?.status === 'SUCCEEDED';
  const observedReceipt = feedback?.receipt;
  const canReconcile =
    Boolean(observedReceipt) &&
    ['ACCEPTED', 'RUNNING', 'RESULT_UNKNOWN'].includes(observedReceipt!.status);
  const Icon = terminalSuccess ? CircleCheckBig : failure ? AlertTriangle : SearchCheck;

  return (
    <Paper
      variant="outlined"
      role={terminalSuccess ? 'status' : 'alert'}
      aria-live={terminalSuccess ? 'polite' : 'assertive'}
      sx={{
        p: 1.5,
        borderColor: terminalSuccess ? 'success.main' : 'warning.main',
        bgcolor: 'action.hover',
      }}
    >
      <Stack direction="row" gap={1} alignItems="flex-start">
        <Icon size={18} aria-hidden="true" />
        <Box minWidth={0} flex={1}>
          <Typography component="p" variant="subtitle2">
            {copy.title}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {copy.description}
          </Typography>
          {observedReceipt && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mt: 0.75, overflowWrap: 'anywhere' }}
            >
              {t('hrisTime.i18nClosure.timecard.notice.receipt', {
                id: observedReceipt.receiptId,
                status: observedReceipt.status,
              })}
            </Typography>
          )}
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={0.75} sx={{ mt: 1.25 }}>
            {failure?.canRetrySameCommand && (
              <ActionButton
                intent="secondary"
                size="small"
                disabled={busy}
                startIcon={<RotateCcw size={14} aria-hidden="true" />}
                onClick={onRetry}
              >
                {t('hrisTime.i18nClosure.timecard.notice.retryExact')}
              </ActionButton>
            )}
            {(failure?.canReconcile || canReconcile) && (
              <ActionButton
                intent="secondary"
                size="small"
                disabled={busy}
                startIcon={<SearchCheck size={14} aria-hidden="true" />}
                onClick={onReconcile}
              >
                {t('hrisTime.i18nClosure.timecard.notice.checkReceipt')}
              </ActionButton>
            )}
            {failure?.canRefresh && (
              <ActionButton
                intent="secondary"
                size="small"
                disabled={busy}
                startIcon={<RefreshCw size={14} aria-hidden="true" />}
                onClick={onRefresh}
              >
                {t('hrisTime.i18nClosure.timecard.notice.refresh')}
              </ActionButton>
            )}
          </Stack>
        </Box>
      </Stack>
    </Paper>
  );
}
