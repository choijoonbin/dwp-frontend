import { Ban, CheckCircle2, CircleHelp, Clock3, ShieldAlert, TriangleAlert } from 'lucide-react';
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

export type WorkHubBatchReceiptSummary = {
  selected: number;
  eligible: number;
  confirmed: number;
  conflict: number;
  forbidden: number;
  unknown: number;
  excluded: number;
};

/** The result header is derived only from the reviewed items and durable source receipts. */
export function summarizeWorkHubBatchReceipts(
  items: readonly WorkHubItem[],
  receipts: readonly WorkHubBatchReceipt[]
): WorkHubBatchReceiptSummary {
  const count = (state: WorkHubBatchReceipt['state']) =>
    receipts.filter((receipt) => receipt.state === state).length;
  return {
    selected: items.length,
    eligible: receipts.filter((receipt) => receipt.reviewedCommand.kind !== null).length,
    confirmed: count('CONFIRMED'),
    conflict: count('CONFLICT'),
    forbidden: count('FORBIDDEN'),
    unknown: count('UNKNOWN'),
    excluded: count('EXCLUDED'),
  };
}

const receiptIcon = {
  CONFIRMED: CheckCircle2,
  CONFLICT: TriangleAlert,
  FORBIDDEN: ShieldAlert,
  UNKNOWN: Clock3,
  EXCLUDED: Ban,
} satisfies Record<WorkHubBatchReceipt['state'], typeof CheckCircle2>;

const receiptColor = {
  CONFIRMED: 'success.main',
  CONFLICT: 'error.main',
  FORBIDDEN: 'warning.main',
  UNKNOWN: 'info.main',
  EXCLUDED: 'text.secondary',
} satisfies Record<WorkHubBatchReceipt['state'], string>;

export function WorkHubBatchReportPanel({
  items,
  outcome,
  busy,
  receipts,
  onRetryUnconfirmed,
  onReviewItem,
  reviewUnavailable = false,
  compact = false,
}: {
  items: readonly WorkHubItem[];
  outcome: WorkHubBatchOutcome;
  busy: boolean;
  receipts: readonly WorkHubBatchReceipt[];
  onRetryUnconfirmed?: () => void;
  onReviewItem?: (item: WorkHubItem) => void;
  reviewUnavailable?: boolean;
  compact?: boolean;
}) {
  const { t } = useTranslation(['work', 'common']);
  const confirmed = outcome === 'CONFIRMED';
  const summary = summarizeWorkHubBatchReceipts(items, receipts);
  const itemsByKey = new Map(items.map((item) => [item.key, item]));

  return (
    <Stack gap={1.5} data-testid="work-hub-batch-report">
      <InlineFeedback severity={confirmed ? 'success' : 'warning'}>
        {t(`work:workHub.batch.${confirmed ? 'successDetail' : 'unknownDetail'}`, {
          count: summary.confirmed,
        })}
      </InlineFeedback>
      {reviewUnavailable && (
        <InlineFeedback severity="warning">
          {t('work:workHub.batch.reviewUnavailable')}
        </InlineFeedback>
      )}
      <Box
        component="dl"
        aria-label={t('work:workHub.batch.resultSummary')}
        sx={{
          m: 0,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(7.5rem, 1fr))',
          border: 1,
          borderColor: 'divider',
          borderRadius: 1.5,
          overflow: 'hidden',
          bgcolor: 'background.paper',
          '@media (forced-colors: active)': { borderColor: 'CanvasText' },
        }}
      >
        {(
          [
            ['selected', 'selectedCount'],
            ['eligible', 'eligibleCount'],
            ['confirmed', 'receiptStates.CONFIRMED'],
            ['conflict', 'receiptStates.CONFLICT'],
            ['forbidden', 'receiptStates.FORBIDDEN'],
            ['unknown', 'receiptStates.UNKNOWN'],
            ['excluded', 'receiptStates.EXCLUDED'],
          ] as const
        ).map(([value, label]) => (
          <Box
            key={value}
            sx={{
              px: 1.25,
              py: 1,
              minWidth: 0,
              borderRight: 1,
              borderBottom: 1,
              borderColor: 'divider',
              '&:nth-of-type(2n)': { borderRight: { xs: 0, sm: 1 } },
              '@media (forced-colors: active)': { borderColor: 'CanvasText' },
            }}
          >
            <Typography component="dd" variant="h6" sx={{ m: 0, lineHeight: 1.15 }}>
              {summary[value]}
            </Typography>
            <Typography
              component="dt"
              variant="caption"
              color="text.secondary"
              sx={{ wordBreak: 'normal' }}
            >
              {t(`work:workHub.batch.${label}`, { count: summary[value] })}
            </Typography>
          </Box>
        ))}
      </Box>
      {receipts.length === 0 && items.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {t('work:workHub.batch.noReceiptResults')}
        </Typography>
      ) : receipts.length === 0 ? (
        <List dense disablePadding aria-label={t('work:workHub.batch.resultList')}>
          {items.map((item) => (
            <ListItem
              key={item.key}
              disableGutters
              sx={{ alignItems: 'flex-start', gap: 1, px: 1, py: 1.25 }}
            >
              <ListItemIcon sx={{ minWidth: 28, mt: 0.25, color: 'info.main' }}>
                <CircleHelp size={18} aria-hidden="true" />
              </ListItemIcon>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <ListItemText
                  sx={{ m: 0 }}
                  primary={item.title}
                  secondary={t('work:workHub.batch.results.unknown')}
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
          ))}
        </List>
      ) : (
        <List
          dense
          disablePadding
          aria-label={t('work:workHub.batch.resultList')}
          sx={{
            maxHeight: compact ? { xs: 'none', md: 430 } : 360,
            overflowY: { xs: 'visible', md: compact ? 'auto' : 'visible' },
            pr: { md: compact ? 0.5 : 0 },
          }}
        >
          {receipts.map((receipt) => {
            const item = itemsByKey.get(receipt.item.key) ?? receipt.item;
            const Icon = receiptIcon[receipt.state] ?? CircleHelp;
            return (
              <ListItem
                key={`${receipt.item.key}:${receipt.idempotencyKey}`}
                disableGutters
                sx={{
                  alignItems: 'flex-start',
                  gap: 1,
                  px: 1,
                  py: 1.25,
                  borderBottom: 1,
                  borderColor: 'divider',
                  '&:last-child': { borderBottom: 0 },
                  '@media (forced-colors: active)': { borderColor: 'CanvasText' },
                }}
              >
                <ListItemIcon sx={{ minWidth: 28, mt: 0.25, color: receiptColor[receipt.state] }}>
                  <Icon size={18} aria-hidden="true" />
                </ListItemIcon>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <ListItemText
                    sx={{ m: 0 }}
                    primary={item.title}
                    secondary={
                      receipt.reason === 'CANCELLED'
                        ? t(
                            `work:workHub.batch.${receipt.state === 'UNKNOWN' ? 'cancelledUnknown' : 'cancelledBeforeSend'}`
                          )
                        : t(`work:workHub.batch.receiptHelp.${receipt.state}`)
                    }
                    slotProps={{
                      primary: { sx: { overflowWrap: 'anywhere' } },
                      secondary: { sx: { overflowWrap: 'anywhere' } },
                    }}
                  />
                  <Chip
                    size="small"
                    variant="outlined"
                    label={t(`work:workHub.batch.receiptStates.${receipt.state}`)}
                    sx={{ mt: 0.75 }}
                  />
                  {onReviewItem && receipt.state !== 'CONFIRMED' && (
                    <ActionButton
                      intent="quiet"
                      disabled={busy}
                      onClick={() => onReviewItem(item)}
                      aria-label={t('work:workHub.batch.reviewItemLabel', { title: item.title })}
                      sx={{ minHeight: 44, mt: 0.5, ml: 0.5 }}
                    >
                      {t('work:workHub.batch.reviewItem')}
                    </ActionButton>
                  )}
                </Box>
              </ListItem>
            );
          })}
        </List>
      )}
      {!confirmed && (
        <Typography variant="caption" color="text.secondary">
          {t('work:workHub.batch.noBlindRetry')}
        </Typography>
      )}
      {onRetryUnconfirmed && receipts.some(canRetryWorkHubBatchReceipt) && (
        <ActionButton
          intent="secondary"
          loading={busy}
          onClick={onRetryUnconfirmed}
          sx={{ alignSelf: 'flex-start', minHeight: 44 }}
        >
          {t('work:workHub.batch.retryUnconfirmed')}
        </ActionButton>
      )}
    </Stack>
  );
}

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
      <WorkHubBatchReportPanel
        items={items}
        outcome={outcome}
        busy={busy}
        receipts={receipts}
        onRetryUnconfirmed={onRetryUnconfirmed}
        onReviewItem={onReviewItem}
        reviewUnavailable={reviewUnavailable}
      />
    </ContentDialog>
  );
}
