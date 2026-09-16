import { useEffect } from 'react';
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
  disabled: commandDisabled = false,
  onToggleSelection,
  onBatch,
}: {
  count: number;
  selecting: boolean;
  selectedCount: number;
  eligibleCount: number;
  pending: boolean;
  disabled?: boolean;
  onToggleSelection: () => void;
  onBatch: (target: WorkHubBatchTarget) => void;
}) {
  const { t } = useTranslation('work');
  useEffect(() => {
    if (!selecting || pending) return;
    const cancelSelection = (event: KeyboardEvent) => {
      if (
        event.key !== 'Escape' ||
        event.defaultPrevented ||
        (event.target instanceof Element && event.target.closest('[role="dialog"]'))
      )
        return;
      event.preventDefault();
      onToggleSelection();
    };
    window.addEventListener('keydown', cancelSelection);
    return () => window.removeEventListener('keydown', cancelSelection);
  }, [onToggleSelection, pending, selecting]);
  const disabled =
    commandDisabled || pending || eligibleCount !== selectedCount || eligibleCount > 50;
  return (
    <Stack
      direction="row"
      justifyContent="space-between"
      gap={1}
      alignItems="center"
      sx={{
        px: { xs: 1, md: 1.5 },
        py: { xs: 0.5, md: 0.75 },
        mb: 0.75,
        minHeight: 44,
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: (theme) => `${theme.shape.borderRadius}px`,
        flexWrap: 'wrap',
        '@media (forced-colors: active)': { borderColor: 'CanvasText' },
      }}
    >
      <Typography variant="subtitle2">{t('workHub.queue.heading', { count })}</Typography>
      <ActionButton
        size="small"
        intent={selecting ? 'secondary' : 'quiet'}
        disabled={pending || (commandDisabled && !selecting)}
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
