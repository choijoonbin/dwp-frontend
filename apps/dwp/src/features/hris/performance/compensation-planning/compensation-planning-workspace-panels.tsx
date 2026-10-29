import { ActionButton, InlineFeedback } from '@dwp-frontend/design-system';
import { useTranslation } from 'react-i18next';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { CompensationPlanningCopy } from './compensation-planning-copy';
import type { CompensationCommandResult } from './compensation-planning-contract';
import { translatePerformance } from '../performance-i18n';
import type {
  CompensationPlanningWorkspaceProps,
  CompensationPlanningWorkspaceStatus,
} from './compensation-planning-workspace-model';

const stateFallback: Record<CompensationPlanningWorkspaceStatus, readonly [string, string]> = {
  LOADING: ['Loading compensation plans', 'Revalidating scope and owner data.'],
  EMPTY: ['No compensation cycles yet', 'Create a governed cycle to begin planning.'],
  READY: ['', ''],
  DENIED: ['Access unavailable', 'Your current duty or population scope does not allow this view.'],
  STEP_UP_REQUIRED: [
    'Verification required',
    'Complete fresh verification to continue this high-risk action.',
  ],
  STALE_VERSION: ['This plan changed', 'Refresh the plan before making another change.'],
  RESULT_UNKNOWN: [
    'Result needs reconciliation',
    'Retry the same sealed command to learn its durable result.',
  ],
  ERROR: [
    'Compensation planning is unavailable',
    'Refresh this governed projection or use the correlation reference with support.',
  ],
};

export function StatePanel({
  status,
  errorMessage,
  onRefresh,
  onRetryPending,
}: Pick<
  CompensationPlanningWorkspaceProps,
  'status' | 'errorMessage' | 'onRefresh' | 'onRetryPending'
>) {
  const { t } = useTranslation('hcm');
  const [fallbackTitle, fallbackDescription] = stateFallback[status];
  const title = t(`hrisPerformance.compensationPlanning.state.${status}.title`, {
    defaultValue: fallbackTitle,
  });
  const description = t(`hrisPerformance.compensationPlanning.state.${status}.description`, {
    defaultValue: fallbackDescription,
  });
  return (
    <Paper
      variant="outlined"
      className="compplan-semantic-panel"
      sx={{ p: 4, textAlign: 'center' }}
    >
      <Typography component="h2" variant="h6">
        {title}
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 1 }}>
        {errorMessage || description}
      </Typography>
      <Stack direction="row" justifyContent="center" gap={1} sx={{ mt: 2 }}>
        {status === 'RESULT_UNKNOWN' && onRetryPending ? (
          <ActionButton intent="primary" onClick={onRetryPending}>
            {t('hrisPerformance.compensationPlanning.reconcileResult', {
              defaultValue: 'Reconcile result',
            })}
          </ActionButton>
        ) : null}
        {status !== 'LOADING' ? (
          <ActionButton intent="secondary" onClick={onRefresh}>
            {t('hrisPerformance.compensationPlanning.refresh', { defaultValue: 'Refresh' })}
          </ActionButton>
        ) : null}
      </Stack>
    </Paper>
  );
}

function statusLabel(status: string, copy: CompensationPlanningCopy) {
  return (
    (
      {
        DRAFT: copy.statusDraft,
        OPEN: copy.statusOpen,
        PROPOSAL_REVIEW: copy.statusProposalReview,
        APPROVED: copy.statusApproved,
        PUBLISHED: copy.statusPublished,
        CANCELLED: copy.statusCancelled,
        SUBMITTED: copy.statusSubmitted,
        FROZEN: copy.statusFrozen,
      } as Record<string, string>
    )[status] ?? status.replaceAll('_', ' ')
  );
}

export function StatusChip({ status, copy }: { status: string; copy: CompensationPlanningCopy }) {
  const color =
    status === 'APPROVED' || status === 'PUBLISHED'
      ? 'success'
      : status === 'PROPOSAL_REVIEW'
        ? 'warning'
        : 'default';
  return <Chip size="small" color={color} label={statusLabel(status, copy)} />;
}

export function ResultEvidence({ result }: { result: CompensationCommandResult }) {
  const { t } = useTranslation('hcm');
  const receipt =
    'receiptId' in result
      ? result.receiptId
      : 'commandReceiptId' in result
        ? result.commandReceiptId
        : result.approvalReceiptId;
  const digest = 'resultDigest' in result ? result.resultDigest : result.payloadDigest;
  return (
    <InlineFeedback
      severity="success"
      title={t('hrisPerformance.compensationPlanning.evidence.title', {
        defaultValue: 'Durable audit evidence',
      })}
    >
      <Stack gap={0.5} sx={{ overflowWrap: 'anywhere' }}>
        <Typography variant="body2">
          {translatePerformance(
            t,
            'hrisPerformance.compensationPlanning.evidence.receipt',
            'Receipt: {{value}}',
            { value: receipt }
          )}
        </Typography>
        <Typography variant="body2">
          {translatePerformance(
            t,
            'hrisPerformance.compensationPlanning.evidence.aggregateVersion',
            'Aggregate version: {{value}}',
            { value: result.aggregateVersion ?? '—' }
          )}
        </Typography>
        <Typography variant="body2">
          {translatePerformance(
            t,
            'hrisPerformance.compensationPlanning.evidence.digest',
            'Digest: {{value}}',
            { value: digest }
          )}
        </Typography>
        {'snapshotId' in result ? (
          <>
            <Typography variant="body2">
              {translatePerformance(
                t,
                'hrisPerformance.compensationPlanning.evidence.snapshot',
                'Snapshot: {{snapshotId}} · revision {{revision}}',
                { snapshotId: result.snapshotId, revision: result.snapshotRevision }
              )}
            </Typography>
            <Typography variant="body2">
              {translatePerformance(
                t,
                'hrisPerformance.compensationPlanning.evidence.sourceVersion',
                'Source version: {{sourceVersion}} · lines {{lineCount}}',
                { sourceVersion: result.sourceVersion, lineCount: result.lineCount }
              )}
            </Typography>
            <Typography variant="body2">
              {translatePerformance(
                t,
                'hrisPerformance.compensationPlanning.evidence.published',
                'Published: {{value}}',
                { value: result.publishedAt }
              )}
            </Typography>
          </>
        ) : null}
      </Stack>
    </InlineFeedback>
  );
}
