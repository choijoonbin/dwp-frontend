import {
  CheckCircle2,
  CircleSlash2,
  Download,
  ExternalLink,
  RotateCcw,
  ShieldX,
  TimerOff,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ActionButton } from '@dwp-frontend/design-system';
import { foundationTokens } from '@dwp-frontend/design-system/foundation/tokens';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { approvalBatchOutcome, approvalBatchRetryTaskIds } from './approval-command-center-model';

import type { ApprovalBatchOutcome, ApprovalBatchResult } from './approval-command-center-model';
import type { ApprovalTask } from '@dwp-frontend/shared-utils';

const OUTCOME_PRESENTATION = {
  APPROVED: { icon: CheckCircle2, color: 'success.main' },
  INELIGIBLE: { icon: ShieldX, color: 'warning.main' },
  FAILED: { icon: CircleSlash2, color: 'error.main' },
  NOT_ATTEMPTED: { icon: TimerOff, color: 'text.secondary' },
} as const satisfies Record<ApprovalBatchOutcome, { icon: typeof CheckCircle2; color: string }>;

export function ApprovalBatchResultPanel({
  result,
  tasks,
  retrying,
  onRetry,
  onOpenTask,
  onDownload,
  onDismiss,
}: {
  result: ApprovalBatchResult;
  tasks: readonly ApprovalTask[];
  retrying: boolean;
  onRetry: () => void;
  onOpenTask: (taskId: string) => void;
  onDownload: () => void;
  onDismiss: () => void;
}) {
  const { t } = useTranslation('approvals');
  const taskById = new Map(tasks.map((task) => [task.taskId, task]));
  const retryTaskIds = approvalBatchRetryTaskIds(result);
  const failureCause = result.failure
    ? t(
        `inbox.decisionRecovery.${
          result.failure.reason === 'AUTHORITY_DENIED'
            ? 'DENIED'
            : result.failure.reason === 'VERSION_CONFLICT'
              ? 'CONFLICT'
              : 'UNAVAILABLE'
        }.title`
      )
    : undefined;

  return (
    <Box
      component="section"
      aria-labelledby="approval-batch-result-title"
      role="status"
      aria-live="polite"
      sx={{
        px: { xs: 1.5, sm: 2 },
        py: 1.5,
        bgcolor: 'action.hover',
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={2}>
        <Box>
          <Typography id="approval-batch-result-title" component="h3" variant="subtitle2">
            {t('home.commandCenter.batchResultTitle')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('home.commandCenter.batchResult', {
              approved: result.approvedTaskIds.length,
              ineligible: result.ineligibleTaskIds.length,
              remaining: result.remainingTaskIds.length + (result.failedTaskId ? 1 : 0),
            })}
          </Typography>
        </Box>
        <Stack direction="row" flexWrap="wrap" justifyContent="flex-end" gap={0.5}>
          <ActionButton
            intent="quiet"
            size="small"
            startIcon={<Download size={15} />}
            onClick={onDownload}
          >
            {t('home.commandCenter.downloadBatchCsv')}
          </ActionButton>
          {retryTaskIds.length > 0 && (
            <ActionButton
              intent="secondary"
              size="small"
              startIcon={<RotateCcw size={15} />}
              loading={retrying}
              disabled={retrying}
              onClick={onRetry}
            >
              {t('actions.retry')} ({retryTaskIds.length})
            </ActionButton>
          )}
          <ActionButton intent="quiet" size="small" disabled={retrying} onClick={onDismiss}>
            {t('actions.dismiss')}
          </ActionButton>
        </Stack>
      </Stack>
      <Box
        component="ol"
        sx={{
          m: 0,
          mt: 1.25,
          p: 0,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
          gap: 0.75,
          listStyle: 'none',
        }}
      >
        {result.requestedTaskIds.map((taskId) => {
          const outcome = approvalBatchOutcome(result, taskId);
          const presentation = OUTCOME_PRESENTATION[outcome];
          const Icon = presentation.icon;
          const task = taskById.get(taskId);
          return (
            <Stack
              component="li"
              key={taskId}
              style={{ borderRadius: foundationTokens.radius.surface }}
              direction="row"
              alignItems="flex-start"
              gap={1}
              sx={{
                minWidth: 0,
                p: 1,
                border: 1,
                borderColor: 'divider',
                bgcolor: 'background.paper',
              }}
            >
              <Box sx={{ mt: 0.15, color: presentation.color, flex: '0 0 auto' }}>
                <Icon size={17} aria-hidden="true" />
              </Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography
                  variant="body2"
                  fontWeight="fontWeightBold"
                  sx={{ overflowWrap: 'anywhere' }}
                >
                  {task?.title ?? taskId}
                </Typography>
                <Typography variant="caption" color={presentation.color}>
                  {t(`home.commandCenter.batchOutcomes.${outcome}`)}
                </Typography>
                {outcome === 'FAILED' && failureCause && (
                  <Typography component="p" variant="caption" color="text.secondary">
                    {failureCause} ·{' '}
                    {t(
                      result.failure?.retryable ? 'status.ELIGIBLE' : 'status.STATUS_NOT_RETRYABLE'
                    )}
                  </Typography>
                )}
                {outcome === 'NOT_ATTEMPTED' && (
                  <Typography component="p" variant="caption" color="text.secondary">
                    {t(
                      result.failure?.retryable ? 'status.ELIGIBLE' : 'status.STATUS_NOT_RETRYABLE'
                    )}
                  </Typography>
                )}
              </Box>
              {outcome === 'INELIGIBLE' && (
                <ActionButton
                  intent="quiet"
                  size="small"
                  startIcon={<ExternalLink size={15} />}
                  onClick={() => onOpenTask(taskId)}
                >
                  {t('actions.openDetails')}
                </ActionButton>
              )}
            </Stack>
          );
        })}
      </Box>
    </Box>
  );
}
