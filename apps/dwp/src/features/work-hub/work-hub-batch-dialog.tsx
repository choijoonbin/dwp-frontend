import { CheckCircle2, CircleHelp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  ActionButton,
  FormDialog,
  ContentDialog,
  InlineFeedback,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { WorkspaceWorkItem } from '@dwp-frontend/shared-utils/api/workspace-api';
import type { WorkHubItem } from './work-hub-contracts';
import {
  workHubBatchEligible,
  canRetryWorkHubBatchReceipt,
  type WorkHubBatchReceipt,
  type WorkHubBatchTarget,
} from './work-hub-batch-execution';

export type WorkHubBatchOutcome = 'CONFIRMED' | 'UNKNOWN';

export function isConfirmedBatchResult(
  target: WorkHubBatchTarget,
  requested: readonly WorkHubItem[],
  received: readonly WorkspaceWorkItem[]
) {
  const expectedStatus = target === 'COMPLETED' ? 'completed' : 'in-progress';
  const receivedById = new Map(received.map((item) => [item.workItemId, item]));
  return (
    received.length === requested.length &&
    requested.every((item) => {
      const workItemId = item.legacyItem?.workItemId;
      const result = workItemId ? receivedById.get(workItemId) : undefined;
      return result?.status === expectedStatus && result.version > (item.legacyItem?.version ?? -1);
    })
  );
}

export function WorkHubBatchDialog({
  target,
  selectedCount,
  items,
  outcome,
  busy,
  onClose,
  onConfirm,
  receipts = [],
  onRetryUnconfirmed,
  onReviewItem,
  reviewUnavailable = false,
}: {
  target: WorkHubBatchTarget | null;
  selectedCount: number;
  items: readonly WorkHubItem[];
  outcome: WorkHubBatchOutcome | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
  receipts?: readonly WorkHubBatchReceipt[];
  onRetryUnconfirmed?: () => void;
  onReviewItem?: (item: WorkHubItem) => void;
  reviewUnavailable?: boolean;
}) {
  const { t } = useTranslation(['work', 'common']);
  if (!target) return null;

  const action = target === 'COMPLETED' ? 'complete' : 'start';
  const eligible = items.filter((item) => workHubBatchEligible(item, target));
  const details = (
    <Stack gap={1.5}>
      <Stack direction="row" gap={1} flexWrap="wrap">
        <Chip
          size="small"
          label={t('work:workHub.batch.selectedCount', { count: selectedCount })}
        />
        <Chip
          size="small"
          label={t('work:workHub.batch.targetCount', { count: eligible.length })}
        />
        {selectedCount > eligible.length && (
          <Chip
            size="small"
            color="warning"
            label={t('work:workHub.batch.excludedCount', {
              count: selectedCount - eligible.length,
            })}
          />
        )}
      </Stack>
      <Typography variant="caption" color="text.secondary">
        {t('work:workHub.batch.executionNotice')}
      </Typography>
      <List dense disablePadding sx={{ maxHeight: 240, overflowY: 'auto' }}>
        {items.map((item) => (
          <ListItem key={item.key} disableGutters>
            <ListItemText
              primary={item.title}
              secondary={t(
                workHubBatchEligible(item, target)
                  ? `work:workHub.lifecycle.${item.lifecycle}`
                  : 'work:workHub.batch.receiptStates.EXCLUDED'
              )}
              slotProps={{ primary: { noWrap: true } }}
            />
          </ListItem>
        ))}
      </List>
    </Stack>
  );

  if (!outcome) {
    return (
      <FormDialog
        open
        title={t(`work:workHub.batch.${action}Title`)}
        description={t('work:workHub.batch.description', { count: items.length })}
        cancelLabel={t('common:actions.cancel')}
        submitLabel={t(`work:workHub.batch.${action}`)}
        submittingLabel={t('work:workHub.batch.processing')}
        busy={busy}
        onClose={onClose}
        submitDisabled={!eligible.length || items.length > 50}
        onSubmit={onConfirm}
      >
        {details}
      </FormDialog>
    );
  }

  const confirmed = outcome === 'CONFIRMED';
  return (
    <ContentDialog
      open
      maxWidth="sm"
      title={t('work:workHub.batch.reportTitle')}
      closeLabel={t('common:actions.close')}
      onClose={onClose}
      closeButtonSx={{
        '@media (max-width:599.95px)': { minWidth: 44, minHeight: 44 },
      }}
      footerContent={
        <Stack direction="row" gap={1} flexWrap="wrap">
          {onRetryUnconfirmed && receipts.some(canRetryWorkHubBatchReceipt) && (
            <ActionButton
              intent="secondary"
              loading={busy}
              onClick={onRetryUnconfirmed}
              sx={{ '@media (max-width:599.95px)': { minHeight: 44 } }}
            >
              {t('work:workHub.batch.retryUnconfirmed')}
            </ActionButton>
          )}
          <ActionButton
            autoFocus
            intent="primary"
            onClick={onClose}
            disabled={busy}
            sx={{ '@media (max-width:599.95px)': { minHeight: 44 } }}
          >
            {t('common:actions.close')}
          </ActionButton>
        </Stack>
      }
    >
      <InlineFeedback severity={confirmed ? 'success' : 'warning'}>
        {t(`work:workHub.batch.${confirmed ? 'successDetail' : 'unknownDetail'}`, {
          count: items.length,
        })}
      </InlineFeedback>
      {reviewUnavailable && (
        <InlineFeedback severity="warning">
          {t('work:workHub.batch.reviewUnavailable')}
        </InlineFeedback>
      )}
      {receipts.length > 0 && (
        <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ mt: 2 }}>
          {(['CONFIRMED', 'CONFLICT', 'FORBIDDEN', 'UNKNOWN', 'EXCLUDED'] as const).map((state) => (
            <Chip
              key={state}
              size="small"
              label={`${t(`work:workHub.batch.receiptStates.${state}`)} ${receipts.filter((receipt) => receipt.state === state).length}`}
            />
          ))}
        </Stack>
      )}
      <List aria-label={t('work:workHub.batch.resultList')} sx={{ mt: 1 }}>
        {items.map((item) => {
          const receipt = receipts.find((row) => row.item.key === item.key);
          const success = receipt ? receipt.state === 'CONFIRMED' : confirmed;
          return (
            <ListItem key={item.key} disableGutters sx={{ alignItems: 'flex-start', gap: 1 }}>
              <ListItemIcon sx={{ minWidth: 36, color: success ? 'success.main' : 'warning.main' }}>
                {success ? (
                  <CheckCircle2 size={18} aria-hidden="true" />
                ) : (
                  <CircleHelp size={18} aria-hidden="true" />
                )}
              </ListItemIcon>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <ListItemText
                  primary={item.title}
                  secondary={
                    receipt
                      ? t(
                          receipt.reason === 'CANCELLED'
                            ? `work:workHub.batch.${receipt.state === 'UNKNOWN' ? 'cancelledUnknown' : 'cancelledBeforeSend'}`
                            : `work:workHub.batch.receiptHelp.${receipt.state}`
                        )
                      : t(`work:workHub.batch.results.${confirmed ? 'confirmed' : 'unknown'}`)
                  }
                />
                {onReviewItem && (
                  <ActionButton
                    intent="quiet"
                    disabled={busy}
                    onClick={() => onReviewItem(item)}
                    aria-label={t('work:workHub.batch.reviewItemLabel', { title: item.title })}
                    sx={{ minHeight: 44, mt: 0.5 }}
                  >
                    {t('work:workHub.batch.reviewItem')}
                  </ActionButton>
                )}
              </Box>
            </ListItem>
          );
        })}
      </List>
      {!confirmed && (
        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {t('work:workHub.batch.noBlindRetry')}
          </Typography>
        </Box>
      )}
    </ContentDialog>
  );
}
