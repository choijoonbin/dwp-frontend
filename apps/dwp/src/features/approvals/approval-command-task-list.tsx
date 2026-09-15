import { ChevronLeft, ChevronRight, ListChecks, Search, UserRoundCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ActionIconButton, FormField } from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { APPROVAL_BATCH_LIMIT } from './approval-command-center-model';
import { PriorityChip, StatusChip } from './approval-ui';

import type { ApprovalTask } from '@dwp-frontend/shared-utils';

export function ApprovalCommandTaskList({
  tasks,
  selectedTaskId,
  selectedBatchIds,
  emptyQueue,
  search,
  busy,
  selectionMode,
  onSearchChange,
  onSelect,
  onToggleBatch,
  totalElements,
  page,
  totalPages,
  sort,
  status,
  onPageChange,
  onSortChange,
  onStatusChange,
}: {
  tasks: readonly ApprovalTask[];
  selectedTaskId?: string;
  selectedBatchIds: readonly string[];
  emptyQueue: boolean;
  search: string;
  busy: boolean;
  selectionMode: boolean;
  onSearchChange: (value: string) => void;
  onSelect: (taskId: string) => void;
  onToggleBatch: (taskId: string) => void;
  totalElements: number;
  page: number;
  totalPages: number;
  sort: 'PRIORITY' | 'NEWEST' | 'OLDEST';
  status: string;
  onPageChange: (page: number) => void;
  onSortChange: (sort: string) => void;
  onStatusChange: (status: string) => void;
}) {
  const { t } = useTranslation('approvals');
  return (
    <Box
      sx={{
        minWidth: 0,
        height: { md: '100%' },
        display: { md: 'flex' },
        flexDirection: 'column',
        borderRight: { md: 1 },
        borderColor: 'divider',
      }}
    >
      <Box sx={{ flex: '0 0 auto', px: 1.75, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
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
        <Box
          sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1, mt: 1 }}
        >
          <FormField
            select
            size="small"
            label={t('home.commandCenter.statusFilter')}
            value={status}
            onChange={(event) => onStatusChange(event.target.value)}
            disabled={busy}
          >
            <MenuItem value="">{t('home.commandCenter.allStatuses')}</MenuItem>
            {(['PENDING', 'CLAIMED', 'INFO_REQUESTED'] as const).map((value) => (
              <MenuItem key={value} value={value}>
                {t(`status.${value}`)}
              </MenuItem>
            ))}
          </FormField>
          <FormField
            select
            size="small"
            label={t('home.commandCenter.sortLabel')}
            value={sort}
            onChange={(event) => onSortChange(event.target.value)}
            disabled={busy}
          >
            {(['PRIORITY', 'NEWEST', 'OLDEST'] as const).map((value) => (
              <MenuItem key={value} value={value}>
                {t(`home.commandCenter.sort.${value}`)}
              </MenuItem>
            ))}
          </FormField>
        </Box>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary" role="status" aria-live="polite">
            {t('home.commandCenter.resultCount', { count: totalElements })}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('home.commandCenter.batchLimit', { count: APPROVAL_BATCH_LIMIT })}
          </Typography>
        </Stack>
      </Box>
      <Box
        role={tasks.length > 0 ? 'grid' : undefined}
        aria-label={tasks.length > 0 ? t('home.commandCenter.taskList') : undefined}
        sx={{
          minHeight: { md: 0 },
          flex: { md: '1 1 auto' },
          overflowY: { md: 'auto' },
          overscrollBehavior: { md: 'contain' },
          scrollbarGutter: { md: 'stable' },
        }}
      >
        {tasks.map((task) => (
          <ApprovalCommandTaskRow
            key={task.taskId}
            task={task}
            selected={selectedTaskId === task.taskId}
            checked={selectedBatchIds.includes(task.taskId)}
            disabled={busy}
            selectionMode={selectionMode}
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
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ flex: '0 0 auto', px: 1.5, py: 1, borderTop: 1, borderColor: 'divider' }}
      >
        <ActionIconButton
          size="small"
          label={t('home.commandCenter.previousPage')}
          disabled={busy || page === 0}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft size={18} />
        </ActionIconButton>
        <Typography variant="caption" role="status">
          {t('home.commandCenter.page', { page: totalPages ? page + 1 : 0, total: totalPages })}
        </Typography>
        <ActionIconButton
          size="small"
          label={t('home.commandCenter.nextPage')}
          disabled={busy || page + 1 >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight size={18} />
        </ActionIconButton>
      </Stack>
    </Box>
  );
}

function ApprovalCommandTaskRow({
  task,
  selected,
  checked,
  disabled,
  selectionMode,
  onSelect,
  onToggleBatch,
}: {
  task: ApprovalTask;
  selected: boolean;
  checked: boolean;
  disabled: boolean;
  selectionMode: boolean;
  onSelect: () => void;
  onToggleBatch: () => void;
}) {
  const { t } = useTranslation('approvals');
  return (
    <Box
      role="row"
      aria-selected={selected}
      data-approval-task-id={task.taskId}
      sx={(theme) => ({
        display: 'grid',
        gridTemplateColumns: selectionMode ? '44px minmax(0, 1fr)' : 'minmax(0, 1fr)',
        minHeight: 118,
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: selected ? 'action.selected' : 'background.paper',
        boxShadow: selected ? `inset 3px 0 0 ${theme.palette.primary.main}` : 'none',
        '&:focus-within': { outline: 2, outlineColor: 'primary.main', outlineOffset: -2 },
      })}
    >
      {selectionMode && (
        <Box
          role="gridcell"
          sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', pt: 1.25 }}
        >
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
      )}
      <Box role="gridcell" sx={{ minWidth: 0 }}>
        <ButtonBase
          aria-current={selected ? 'true' : undefined}
          disabled={disabled}
          onClick={onSelect}
          sx={{
            width: '100%',
            minWidth: 0,
            px: 1.25,
            py: 1.25,
            display: 'block',
            textAlign: 'left',
            '&:hover': { bgcolor: 'action.hover' },
          }}
        >
          <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1}>
            <Typography variant="caption" color="text.secondary">
              {task.requestNumber}
            </Typography>
            <Stack
              direction="row"
              gap={0.5}
              alignItems="center"
              justifyContent="flex-end"
              flexWrap="wrap"
            >
              <StatusChip status={task.status} />
              <PriorityChip priority={task.priority} />
              <Chip
                size="small"
                variant="outlined"
                color={
                  task.riskScore >= 80 ? 'error' : task.riskScore >= 60 ? 'warning' : 'default'
                }
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
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            gap={1}
            sx={{ mt: 0.4 }}
          >
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ minWidth: 0, overflowWrap: 'anywhere' }}
            >
              {task.requesterName ?? t('home.unknownRequester')} · {task.requesterOrgName ?? '-'}
            </Typography>
            {(task.status === 'CLAIMED' || task.status === 'REASSIGNED') && (
              <Stack direction="row" alignItems="center" gap={0.4} sx={{ flex: '0 0 auto' }}>
                <UserRoundCheck size={14} aria-hidden="true" />
                <Typography variant="caption" color="primary.main">
                  {t(`home.commandCenter.assignment.${task.status}`)}
                </Typography>
              </Stack>
            )}
          </Stack>
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
    </Box>
  );
}
