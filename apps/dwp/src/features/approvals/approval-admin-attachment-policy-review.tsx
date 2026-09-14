import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FormDialog, FormField, InlineFeedback } from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import type { ApprovalAttachmentPolicy } from '@dwp-frontend/shared-utils/api/approval-attachment-policy-contract';

export function ApprovalAdminAttachmentPolicyReview({
  policy,
  ready,
  busy,
  onClose,
  onSubmit,
}: {
  policy: Readonly<ApprovalAttachmentPolicy> | null;
  ready: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (comment: string) => void;
}) {
  const { t } = useTranslation('approvals');
  const [comment, setComment] = useState('');
  useEffect(() => {
    setComment('');
  }, [policy]);
  const valid = comment.trim().length > 0 && comment.trim().length <= 1000;
  return (
    <FormDialog
      open={Boolean(policy)}
      title={t('admin.attachmentPolicy.review')}
      cancelLabel={t('actions.cancel')}
      submitLabel={t('actions.publish')}
      busy={busy}
      submitDisabled={!ready || !valid}
      onClose={onClose}
      onSubmit={() => onSubmit(comment)}
      maxWidth="sm"
      mobileFullScreen
    >
      {policy ? (
        <Stack gap={2}>
          <Box sx={{ typography: 'caption', overflowWrap: 'anywhere', color: 'text.secondary' }}>
            {`${policy.resourceSetKey} · v${policy.version} · `}
            {t('admin.document.pending')} {policy.pendingRevision}
          </Box>
          <Box sx={{ typography: 'body2', overflowWrap: 'anywhere' }}>
            {policy.pendingRulesSha256}
          </Box>
          <InlineFeedback severity={ready ? 'info' : 'warning'}>
            {t(
              ready
                ? 'admin.attachmentPolicy.reason.ALLOWED'
                : 'admin.attachmentPolicy.sourceChanged'
            )}
          </InlineFeedback>
          <FormField
            multiline
            minRows={3}
            label={t('admin.document.reviewComment')}
            value={comment}
            disabled={!ready || busy}
            slotProps={{ htmlInput: { maxLength: 1000 } }}
            onChange={(event) => setComment(event.target.value)}
          />
        </Stack>
      ) : null}
    </FormDialog>
  );
}
