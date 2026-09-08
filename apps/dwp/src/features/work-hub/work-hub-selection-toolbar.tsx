import { useTranslation } from 'react-i18next';
import { ActionButton } from '@dwp-frontend/design-system';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { WorkHubBatchTarget } from './work-hub-batch-execution';

export function WorkHubSelectionToolbar({
  count,
  selecting,
  selectedCount,
  eligibleCount,
  pending,
  onToggleSelection,
  onBatch,
}: {
  count: number;
  selecting: boolean;
  selectedCount: number;
  eligibleCount: number;
  pending: boolean;
  onToggleSelection: () => void;
  onBatch: (target: WorkHubBatchTarget) => void;
}) {
  const { t } = useTranslation('work');
  const disabled = pending || eligibleCount !== selectedCount || eligibleCount > 50;
  return (
    <Stack
      direction="row"
      justifyContent="space-between"
      gap={1}
      alignItems="center"
      sx={{ px: 2, py: 1.25, borderBottom: 1, borderColor: 'divider', flexWrap: 'wrap' }}
    >
      <Typography variant="subtitle2">{t('workHub.queue.heading', { count })}</Typography>
      <ActionButton
        size="small"
        intent={selecting ? 'secondary' : 'quiet'}
        onClick={onToggleSelection}
        sx={{ '@media (max-width:899.95px)': { minHeight: 44 } }}
      >
        {t(selecting ? 'workHub.batch.cancelSelection' : 'workHub.batch.selectMode')}
      </ActionButton>
      {selectedCount > 0 && (
        <Stack direction="row" gap={0.5} flexWrap="wrap" justifyContent="flex-end">
          <ActionButton
            size="small"
            intent="quiet"
            disabled={disabled}
            onClick={() => onBatch('IN_PROGRESS')}
            sx={{ '@media (max-width:899.95px)': { minHeight: 44 } }}
          >
            {t('workHub.batch.start')}
          </ActionButton>
          <ActionButton
            size="small"
            intent="quiet"
            disabled={disabled}
            onClick={() => onBatch('COMPLETED')}
            sx={{ '@media (max-width:899.95px)': { minHeight: 44 } }}
          >
            {t('workHub.batch.complete')}
          </ActionButton>
        </Stack>
      )}
    </Stack>
  );
}
