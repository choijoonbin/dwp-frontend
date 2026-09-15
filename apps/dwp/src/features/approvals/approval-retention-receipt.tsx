import { CheckCheck, SearchCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ActionButton, InlineFeedback } from '@dwp-frontend/design-system';
import Stack from '@mui/material/Stack';
import { useApprovalRetentionReceipt } from './use-approval-retention-receipt';

import type {
  ApprovalRetentionReceiptMetadata,
  ApprovalRetentionReceiptOriginal,
} from '@dwp-frontend/shared-utils/api/approval-retention-receipt-profile';

export function ApprovalRetentionReceipt({
  original,
  sourceIsCurrent,
  isOriginal,
  onConfirmed,
}: Readonly<{
  original: ApprovalRetentionReceiptOriginal;
  sourceIsCurrent: () => boolean;
  isOriginal: (candidate: ApprovalRetentionReceiptOriginal) => boolean;
  onConfirmed: (
    candidate: ApprovalRetentionReceiptOriginal,
    receipt: ApprovalRetentionReceiptMetadata
  ) => void | Promise<void>;
}>) {
  const { t } = useTranslation('approvals');
  const receipt = useApprovalRetentionReceipt({ original, sourceIsCurrent, isOriginal });
  return (
    <Stack gap={1}>
      <InlineFeedback severity="warning">
        {t('admin.retention.receiptOriginalPreserved')}
      </InlineFeedback>
      {!receipt.available ? (
        <InlineFeedback severity="warning">
          {t('admin.retention.receiptUnavailable')}
        </InlineFeedback>
      ) : receipt.receipt ? (
        <InlineFeedback
          severity="success"
          icon={<CheckCheck size={18} aria-hidden="true" />}
          action={
            <ActionButton
              intent="quiet"
              size="small"
              onClick={() => {
                if (sourceIsCurrent() && receipt.isCurrent())
                  void onConfirmed(original, receipt.receipt!);
              }}
            >
              {t('admin.retention.receiptAccept')}
            </ActionButton>
          }
        >
          {t('admin.retention.receiptCommitted')}
        </InlineFeedback>
      ) : (
        <ActionButton
          type="button"
          intent="secondary"
          size="small"
          loading={receipt.pending}
          disabled={!receipt.available || receipt.pending}
          startIcon={<SearchCheck size={16} aria-hidden="true" />}
          onClick={() => void receipt.read()}
        >
          {t('admin.retention.receiptLookup')}
        </ActionButton>
      )}
      {receipt.error ? (
        <InlineFeedback severity="error">{t('admin.retention.receiptReadError')}</InlineFeedback>
      ) : null}
    </Stack>
  );
}
