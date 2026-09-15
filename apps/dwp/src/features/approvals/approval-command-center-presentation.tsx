import { ArrowLeft, CheckCheck, ListChecks, ListPlus, RefreshCw, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ActionButton, FormDialog, FormField } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { ApprovalBatchPreflightSummary } from './approval-batch-preflight-summary';
import { ApprovalDecisionConfirmationSummary } from './approval-decision-confirmation-summary';

import type { ApprovalBatchPreflight } from './approval-batch-preflight';
import type { ApprovalDecisionKind } from './approval-decision-detail';
import type { ApprovalQueueFilter } from './approval-command-center-model';
import type { ApprovalTaskDetail } from '@dwp-frontend/shared-utils';

export function ApprovalCommandCenterHeader({
  filter,
  hasQueueData,
  queueCount,
  checkedAt,
  returnAvailable,
  refreshDisabled,
  mobile,
  showQueue,
  mobileSelectionMode,
  selectionMode,
  selectedCount,
  batchDisabled,
  onReturn,
  onRefresh,
  onToggleMobileSelection,
  onOpenBatch,
}: {
  filter: ApprovalQueueFilter;
  hasQueueData: boolean;
  queueCount: number;
  checkedAt: string | undefined;
  returnAvailable: boolean;
  refreshDisabled: boolean;
  mobile: boolean;
  showQueue: boolean;
  mobileSelectionMode: boolean;
  selectionMode: boolean;
  selectedCount: number;
  batchDisabled: boolean;
  onReturn: () => void;
  onRefresh: () => void;
  onToggleMobileSelection: () => void;
  onOpenBatch: () => void;
}) {
  const { t } = useTranslation('approvals');
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      alignItems={{ sm: 'center' }}
      justifyContent="space-between"
      gap={1.5}
      sx={{
        flex: '0 0 auto',
        px: { xs: 1.5, sm: 2 },
        py: 1.5,
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      <Stack direction="row" alignItems="center" gap={1.25}>
        <Box sx={{ color: 'primary.main' }}>
          <ListChecks size={21} aria-hidden="true" />
        </Box>
        <Box>
          <Typography
            id="approval-command-center-title"
            component="h2"
            variant="subtitle1"
            tabIndex={-1}
            data-approval-command-center-heading
          >
            {t('home.commandCenter.title')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('home.commandCenter.description')}
          </Typography>
          {hasQueueData && (
            <Typography
              component="p"
              variant="caption"
              color="text.secondary"
              role="status"
              aria-live="polite"
              sx={{ mt: 0.25 }}
            >
              {t('home.commandCenter.queueContext', {
                queue: t(`home.commandCenter.filters.${filter}`),
                count: queueCount,
                checkedAt: checkedAt ?? t('home.commandCenter.checkingFreshness'),
              })}
            </Typography>
          )}
        </Box>
      </Stack>
      <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
        {returnAvailable && (
          <ActionButton
            intent="quiet"
            size="small"
            startIcon={<ArrowLeft size={16} />}
            onClick={onReturn}
          >
            {t('common:productSurface.actions.returnToWork')}
          </ActionButton>
        )}
        <ActionButton
          intent="quiet"
          size="small"
          startIcon={<RefreshCw size={16} />}
          aria-label={t('home.commandCenter.refreshQueue')}
          disabled={refreshDisabled}
          onClick={onRefresh}
        >
          {t('actions.refresh')}
        </ActionButton>
        {mobile && showQueue && (
          <ActionButton
            intent={mobileSelectionMode ? 'secondary' : 'quiet'}
            size="small"
            startIcon={mobileSelectionMode ? <X size={16} /> : <ListPlus size={16} />}
            disabled={refreshDisabled}
            aria-pressed={mobileSelectionMode}
            onClick={onToggleMobileSelection}
          >
            {t(
              mobileSelectionMode
                ? 'home.commandCenter.cancelSelection'
                : 'home.commandCenter.startSelection'
            )}
          </ActionButton>
        )}
        {selectionMode && (
          <>
            <Chip
              size="small"
              color={selectedCount > 0 ? 'primary' : 'default'}
              label={t('home.commandCenter.selectedCount', { count: selectedCount })}
            />
            <ActionButton
              intent="primary"
              size="small"
              startIcon={<CheckCheck size={16} />}
              disabled={batchDisabled}
              onClick={onOpenBatch}
            >
              {t('home.commandCenter.batchApprove')}
            </ActionButton>
          </>
        )}
      </Stack>
    </Stack>
  );
}

export function ApprovalCommandCenterDialogs({
  decisionOpen,
  decision,
  decisionTarget,
  verifiedAt,
  comment,
  decisionBusy,
  decisionSubmitDisabled,
  batchOpen,
  batchSelectedCount,
  batchEligibleCount,
  batchBusy,
  batchSubmitDisabled,
  batchPreflight,
  batchPreflightRefreshing,
  onDecisionClose,
  onCommentChange,
  onDecisionSubmit,
  onBatchClose,
  onBatchSubmit,
  onBatchRefresh,
}: {
  decisionOpen: boolean;
  decision: ApprovalDecisionKind | undefined;
  decisionTarget: ApprovalTaskDetail | undefined;
  verifiedAt: number | undefined;
  comment: string;
  decisionBusy: boolean;
  decisionSubmitDisabled: boolean;
  batchOpen: boolean;
  batchSelectedCount: number;
  batchEligibleCount: number;
  batchBusy: boolean;
  batchSubmitDisabled: boolean;
  batchPreflight: ApprovalBatchPreflight;
  batchPreflightRefreshing: boolean;
  onDecisionClose: () => void;
  onCommentChange: (value: string) => void;
  onDecisionSubmit: () => void;
  onBatchClose: () => void;
  onBatchSubmit: () => void;
  onBatchRefresh: () => void;
}) {
  const { t } = useTranslation('approvals');
  return (
    <>
      <FormDialog
        open={decisionOpen}
        title={t(`inbox.dialog.${decision ?? 'APPROVE'}.title`)}
        description={t(`inbox.dialog.${decision ?? 'APPROVE'}.description`)}
        cancelLabel={t('actions.cancel')}
        submitLabel={t(`inbox.dialog.${decision ?? 'APPROVE'}.confirm`)}
        submitIntent={decision === 'REJECT' ? 'danger' : 'primary'}
        busy={decisionBusy}
        mobileFullScreen
        submitDisabled={decisionSubmitDisabled}
        onClose={onDecisionClose}
        onSubmit={onDecisionSubmit}
      >
        {decisionTarget && (
          <ApprovalDecisionConfirmationSummary
            detail={decisionTarget}
            {...(verifiedAt === undefined ? {} : { verifiedAt })}
          />
        )}
        <FormField
          autoFocus
          multiline
          minRows={3}
          label={t('inbox.comment')}
          value={comment}
          onChange={(event) => onCommentChange(event.target.value)}
          required={decision !== 'APPROVE'}
        />
      </FormDialog>

      <FormDialog
        open={batchOpen}
        title={t('home.commandCenter.batchDialogTitle')}
        description={t('home.commandCenter.batchDialogDescription', {
          count: batchSelectedCount,
        })}
        cancelLabel={t('actions.cancel')}
        submitLabel={t('home.commandCenter.batchDialogConfirmCount', {
          count: batchEligibleCount,
        })}
        submitIntent="primary"
        busy={batchBusy}
        submitDisabled={batchSubmitDisabled}
        mobileFullScreen
        onClose={onBatchClose}
        onSubmit={onBatchSubmit}
      >
        <ApprovalBatchPreflightSummary
          preflight={batchPreflight}
          refreshing={batchPreflightRefreshing}
          onRefresh={onBatchRefresh}
        />
      </FormDialog>
    </>
  );
}
