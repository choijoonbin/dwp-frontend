import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import {
  ActionButton,
  FormDialog,
  FormField,
  InlineFeedback,
  LoadingState,
} from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import type { ApprovalFormWorkspaceReview } from '@dwp-frontend/shared-utils';
import type { ApprovalFormWorkspaceReadState } from './approval-form-workspace-model';

export function ApprovalFormWorkspaceReviewDialog({
  open,
  review,
  state,
  ready,
  expired,
  busy,
  onClose,
  onConfirm,
  onReject,
}: {
  open: boolean;
  review: ApprovalFormWorkspaceReview | null;
  state: ApprovalFormWorkspaceReadState;
  ready: boolean;
  expired: boolean;
  busy: boolean;
  onClose: () => void;
  onConfirm: (comment: string) => void;
  onReject: (comment: string) => void;
}) {
  const { t } = useTranslation('approvals');
  const [comment, setComment] = useState('');
  useEffect(() => {
    if (!open) setComment('');
  }, [open]);
  const decisionReady = ready && comment.trim().length >= 10 && comment.trim().length <= 1000;
  return (
    <FormDialog
      open={open}
      title={t('admin.formWorkspace.review')}
      cancelLabel={t('actions.cancel')}
      submitLabel={t('actions.publish')}
      submittingLabel={t('actions.publish')}
      busy={busy}
      submitDisabled={!decisionReady}
      onClose={onClose}
      onSubmit={() => onConfirm(comment.trim())}
      maxWidth="sm"
      mobileFullScreen
    >
      <Stack gap={2}>
        {state === 'LOADING' ? (
          <LoadingState label={t('admin.formWorkspace.review')} size="compact" />
        ) : null}
        {state === 'DENIED' || state === 'UNAVAILABLE' || state === 'STALE' ? (
          <InlineFeedback severity="warning">
            {t('admin.formWorkspace.sourceUnavailable')}
          </InlineFeedback>
        ) : null}
        {review && state !== 'DENIED' ? (
          <Box
            component="dl"
            sx={{
              m: 0,
              display: 'grid',
              gridTemplateColumns: 'minmax(0,1fr) minmax(0,2fr)',
              gap: 1,
              typography: 'body2',
            }}
          >
            {[
              [t('admin.formWorkspace.schemaHash'), review.schemaSha256],
              [t('admin.formWorkspace.materialDigest'), review.reviewContentDigest],
              [
                t('admin.formWorkspace.currentPublished'),
                review.basePublishedVersionId ?? t('admin.formWorkspace.notRecorded'),
              ],
              [
                t('admin.formWorkspace.lastEditor'),
                review.lastEditorUserId ?? t('admin.formWorkspace.notRecorded'),
              ],
            ].map(([label, value]) => (
              <Box key={String(label)} sx={{ display: 'contents' }}>
                <Box component="dt" sx={{ color: 'text.secondary' }}>
                  {label}
                </Box>
                <Box component="dd" sx={{ m: 0, overflowWrap: 'anywhere' }}>
                  {value}
                </Box>
              </Box>
            ))}
          </Box>
        ) : null}
        {review ? (
          <InlineFeedback severity="info">
            {t('admin.formWorkspace.assignedReview', {
              reviewer: review.reviewRequest.reviewerUserId,
              requestedAt: review.reviewRequest.requestedAt,
            })}
          </InlineFeedback>
        ) : null}
        {review && !review.independentCheckerEligible ? (
          <InlineFeedback severity="error">
            {t('admin.formWorkspace.independentCheckerRequired')}
          </InlineFeedback>
        ) : null}
        {expired ? (
          <InlineFeedback severity="warning">
            {t('admin.formWorkspace.reviewExpired')}
          </InlineFeedback>
        ) : null}
        {!ready && review?.independentCheckerEligible && !expired ? (
          <InlineFeedback severity="warning">
            {t('admin.formWorkspace.sourceChanged')}
          </InlineFeedback>
        ) : null}
        <FormField
          required
          multiline
          minRows={3}
          label={t('admin.formWorkspace.reviewComment')}
          supportingText={t('admin.formWorkspace.reviewCommentHelp')}
          value={comment}
          disabled={busy || !review}
          inputProps={{ maxLength: 1000 }}
          onChange={(event) => setComment(event.target.value)}
        />
        <ActionButton
          type="button"
          intent="danger"
          disabled={!decisionReady || busy}
          onClick={() => onReject(comment.trim())}
        >
          {t('admin.formWorkspace.rejectReview')}
        </ActionButton>
      </Stack>
    </FormDialog>
  );
}
