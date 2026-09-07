import { ListChecks, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { FormField } from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { APPROVAL_BATCH_LIMIT } from './approval-command-center-model';
import { PriorityChip } from './approval-ui';

import type { ApprovalTask } from '@dwp-frontend/shared-utils';

export function ApprovalCommandTaskList({
  tasks,
  selectedTaskId,
  selectedBatchIds,
  emptyQueue,
  search,
  busy,
  onSearchChange,
  onSelect,
  onToggleBatch,
}: {
  tasks: readonly ApprovalTask[];
  selectedTaskId?: string;
  selectedBatchIds: readonly string[];
  emptyQueue: boolean;
  search: string;
  busy: boolean;
  onSearchChange: (value: string) => void;
  onSelect: (taskId: string) => void;
  onToggleBatch: (taskId: string) => void;
}) {
  const { t } = useTranslation('approvals');
  return (
    <Box sx={{ minWidth: 0, borderRight: { md: 1 }, borderColor: 'divider' }}>
      <Box sx={{ px: 1.75, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
        <FormField
          size="small"
          label={t('home.commandCenter.searchLabel')}
          placeholder={t('home.commandCenter.searchPlaceholder')}
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={16} aria-hidden="true" />
                </InputAdornment>
              ),
            },
          }}
        />
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary" role="status" aria-live="polite">
            {t('home.commandCenter.resultCount', { count: tasks.length })}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('home.commandCenter.batchLimit', { count: APPROVAL_BATCH_LIMIT })}
          </Typography>
        </Stack>
      </Box>
      <Box
        role={tasks.length > 0 ? 'list' : undefined}
        aria-label={tasks.length > 0 ? t('home.commandCenter.taskList') : undefined}
        sx={{ maxHeight: { md: 690 }, overflowY: 'auto' }}
      >
        {tasks.map((task) => (
          <ApprovalCommandTaskRow
            key={task.taskId}
            task={task}
            selected={selectedTaskId === task.taskId}
            checked={selectedBatchIds.includes(task.taskId)}
            disabled={busy}
            onSelect={() => onSelect(task.taskId)}
            onToggleBatch={() => onToggleBatch(task.taskId)}
          />
        ))}
        {tasks.length === 0 && (
          <Box role="status" sx={{ px: 3, py: 8, textAlign: 'center' }}>
            <ListChecks size={30} color="currentColor" aria-hidden="true" />
            <Typography component="p" variant="subtitle2" sx={{ mt: 1 }}>
              {t(emptyQueue ? 'inbox.empty' : 'home.commandCenter.noResults')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t(emptyQueue ? 'inbox.emptyDescription' : 'home.commandCenter.noResultsDescription')}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}

function ApprovalCommandTaskRow({
  task,
  selected,
  checked,
  disabled,
  onSelect,
  onToggleBatch,
}: {
  task: ApprovalTask;
  selected: boolean;
  checked: boolean;
  disabled: boolean;
  onSelect: () => void;
  onToggleBatch: () => void;
}) {
  const { t } = useTranslation('approvals');
  return (
    <Box
      role="listitem"
      data-approval-task-id={task.taskId}
      sx={{
        display: 'grid',
        gridTemplateColumns: '44px minmax(0, 1fr)',
        minHeight: 118,
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: selected ? 'action.selected' : 'background.paper',
        '&:focus-within': { outline: 2, outlineColor: 'primary.main', outlineOffset: -2 },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', pt: 1.25 }}>
        <Checkbox
          size="small"
          checked={checked}
          disabled={disabled}
          onChange={onToggleBatch}
          slotProps={{
            input: {
              'aria-label': t('home.commandCenter.selectForBatch', { title: task.title }),
            },
          }}
        />
      </Box>
      <ButtonBase
        aria-pressed={selected}
        disabled={disabled}
        onClick={onSelect}
        sx={{
          minWidth: 0,
          px: 1.25,
          py: 1.25,
          display: 'block',
          textAlign: 'left',
          '&:hover': { bgcolor: 'action.hover' },
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
          <Typography variant="caption" color="text.secondary">
            {task.requestNumber}
          </Typography>
          <Stack direction="row" gap={0.5} alignItems="center">
            <PriorityChip priority={task.priority} />
            <Chip
              size="small"
              variant="outlined"
              color={task.riskScore >= 80 ? 'error' : task.riskScore >= 60 ? 'warning' : 'default'}
              label={t('home.commandCenter.riskCompact', { score: task.riskScore })}
            />
          </Stack>
        </Stack>
        <Typography
          variant="body2"
          sx={{
            mt: 0.75,
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: 2,
            overflow: 'hidden',
            overflowWrap: 'anywhere',
          }}
        >
          {task.title}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', mt: 0.4, overflowWrap: 'anywhere' }}
        >
          {task.requesterName ?? t('home.unknownRequester')} · {task.requesterOrgName ?? '-'}
        </Typography>
        <Stack direction="row" justifyContent="space-between" gap={1} sx={{ mt: 0.45 }}>
          <Typography variant="caption" color="primary.main">
            {t('inbox.stageProgress', { current: task.stepSequence, name: task.stepName })}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {task.dueAt
              ? formatDate(task.dueAt, { month: 'short', day: 'numeric', hour: '2-digit' })
              : t('home.commandCenter.noDueDate')}
          </Typography>
        </Stack>
      </ButtonBase>
    </Box>
  );
}
