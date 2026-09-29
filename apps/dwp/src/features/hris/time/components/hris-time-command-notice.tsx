import { useTranslation } from 'react-i18next';
import { AlertTriangle, RefreshCw, RotateCcw, ShieldX } from 'lucide-react';
import { ActionButton } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { TimeCommandFailure } from '../model/hris-time-model';

const fallbackCopy: Record<
  TimeCommandFailure['kind'],
  Readonly<{ title: string; description: string }>
> = {
  CONFLICT: {
    title: 'The time card changed',
    description:
      'Your draft is preserved. Refresh the current card, review the new version, and then decide whether to save again.',
  },
  UNAUTHENTICATED: {
    title: 'Your session is no longer valid',
    description:
      'Your draft is preserved in this dialog, but it cannot be sent. Sign in again before making another change.',
  },
  FORBIDDEN: {
    title: 'This action is no longer permitted',
    description:
      'Your draft is preserved for review. The current HRIS authority does not allow this command.',
  },
  UNKNOWN_OUTCOME: {
    title: 'The command outcome is unknown',
    description:
      'No confirmation was received and the command may have succeeded. Your draft is preserved; refresh and verify the current card before retrying.',
  },
  ABORTED: {
    title: 'The command was cancelled',
    description: 'Your draft is preserved. Reopen the current card before sending another command.',
  },
  REJECTED: {
    title: 'The command was rejected',
    description:
      'Your draft is preserved. Correct the input or retry after the service condition is resolved.',
  },
};

export function HrisTimeCommandNotice({
  failure,
  refreshing,
  refreshed,
  onRefresh,
  onReviewLatest,
  onRetry,
}: {
  failure: TimeCommandFailure;
  refreshing: boolean;
  refreshed: boolean;
  onRefresh?: () => void;
  onReviewLatest?: () => void;
  onRetry?: () => void;
}) {
  const { t } = useTranslation('hcm');
  const copy = fallbackCopy[failure.kind];
  const Icon =
    failure.kind === 'FORBIDDEN' || failure.kind === 'UNAUTHENTICATED' ? ShieldX : AlertTriangle;
  return (
    <Paper
      variant="outlined"
      role="alert"
      sx={{ p: 1.5, borderColor: 'warning.main', bgcolor: 'action.hover' }}
    >
      <Stack direction="row" gap={1} alignItems="flex-start">
        <Icon size={18} aria-hidden="true" />
        <Box minWidth={0} flex={1}>
          <Typography component="p" variant="subtitle2">
            {t(`hrisTime.command.${failure.kind}.title`, { defaultValue: copy.title })}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.25 }}>
            {t(`hrisTime.command.${failure.kind}.description`, {
              defaultValue: copy.description,
            })}
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={0.75} sx={{ mt: 1.25 }}>
            {failure.requiresRefresh && onRefresh && (
              <ActionButton
                intent="secondary"
                size="small"
                startIcon={<RefreshCw size={14} aria-hidden="true" />}
                loading={refreshing}
                onClick={onRefresh}
              >
                {t('hrisTime.command.refresh', { defaultValue: 'Refresh current card' })}
              </ActionButton>
            )}
            {failure.requiresRefresh && refreshed && onReviewLatest && (
              <ActionButton intent="primary" size="small" onClick={onReviewLatest}>
                {t('hrisTime.command.reviewLatest', {
                  defaultValue: 'Review latest and continue',
                })}
              </ActionButton>
            )}
            {failure.retryAllowed && onRetry && (
              <ActionButton
                intent="secondary"
                size="small"
                startIcon={<RotateCcw size={14} aria-hidden="true" />}
                onClick={onRetry}
              >
                {t('hrisTime.command.retry', { defaultValue: 'Retry command' })}
              </ActionButton>
            )}
          </Stack>
        </Box>
      </Stack>
    </Paper>
  );
}
