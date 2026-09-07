import { CheckCircle2, CircleHelp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  ActionButton,
  ConfirmDialog,
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

export type WorkHubBatchTarget = 'IN_PROGRESS' | 'COMPLETED';
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
}: {
  target: WorkHubBatchTarget | null;
  selectedCount: number;
  items: readonly WorkHubItem[];
  outcome: WorkHubBatchOutcome | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation(['work', 'common']);
  if (!target) return null;

  const action = target === 'COMPLETED' ? 'complete' : 'start';
  const details = (
    <Stack gap={1.5}>
      <Stack direction="row" gap={1} flexWrap="wrap">
        <Chip
          size="small"
          label={t('work:workHub.batch.selectedCount', { count: selectedCount })}
        />
        <Chip size="small" label={t('work:workHub.batch.targetCount', { count: items.length })} />
        {selectedCount > items.length && (
          <Chip
            size="small"
            color="warning"
            label={t('work:workHub.batch.excludedCount', {
              count: selectedCount - items.length,
            })}
          />
        )}
      </Stack>
      <Typography variant="caption" color="text.secondary">
        {t('work:workHub.batch.atomicNotice')}
      </Typography>
      <List dense disablePadding sx={{ maxHeight: 240, overflowY: 'auto' }}>
        {items.map((item) => (
          <ListItem key={item.key} disableGutters>
            <ListItemText
              primary={item.title}
              secondary={t(`work:workHub.lifecycle.${item.lifecycle}`)}
              slotProps={{ primary: { noWrap: true } }}
            />
          </ListItem>
        ))}
      </List>
    </Stack>
  );

  if (!outcome) {
    return (
      <ConfirmDialog
        open
        title={t(`work:workHub.batch.${action}Title`)}
        description={t('work:workHub.batch.description', { count: items.length })}
        cancelLabel={t('common:actions.cancel')}
        confirmLabel={t(`work:workHub.batch.${action}`)}
        confirmingLabel={t('work:workHub.batch.processing')}
        busy={busy}
        details={details}
        onClose={onClose}
        onConfirm={onConfirm}
      />
    );
  }

  const confirmed = outcome === 'CONFIRMED';
  return (
    <ContentDialog
      open
      maxWidth="sm"
      title={t(`work:workHub.batch.${confirmed ? 'successTitle' : 'unknownTitle'}`)}
      closeLabel={t('common:actions.close')}
      onClose={onClose}
      footerContent={
        <ActionButton autoFocus intent="primary" onClick={onClose}>
          {t('common:actions.close')}
        </ActionButton>
      }
    >
      <InlineFeedback severity={confirmed ? 'success' : 'warning'}>
        {t(`work:workHub.batch.${confirmed ? 'successDetail' : 'unknownDetail'}`, {
          count: items.length,
        })}
      </InlineFeedback>
      <List aria-label={t('work:workHub.batch.resultList')} sx={{ mt: 1 }}>
        {items.map((item) => (
          <ListItem key={item.key} disableGutters>
            <ListItemIcon sx={{ minWidth: 36, color: confirmed ? 'success.main' : 'warning.main' }}>
              {confirmed ? (
                <CheckCircle2 size={18} aria-hidden="true" />
              ) : (
                <CircleHelp size={18} aria-hidden="true" />
              )}
            </ListItemIcon>
            <ListItemText
              primary={item.title}
              secondary={t(`work:workHub.batch.results.${confirmed ? 'confirmed' : 'unknown'}`)}
            />
          </ListItem>
        ))}
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
