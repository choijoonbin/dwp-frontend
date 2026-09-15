import { useTranslation } from 'react-i18next';
import { Activity, UserRoundCog } from 'lucide-react';
import { ActionButton, EmptyState } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';

import { approvalTaskSupportsReassignment } from './approval-native-operations-model';
import { ApprovalLinkRow, ApprovalSurface, StatusChip, approvalTone } from './approval-ui';

import type { ApprovalTask } from '@dwp-frontend/shared-utils';

type ApprovalOperationsTaskPaneProps = Readonly<{
  tasks: readonly ApprovalTask[];
  selected: ApprovalTask | null;
  selectedIds: ReadonlySet<string>;
  canOperate: boolean;
  busy: boolean;
  onSelect: (task: ApprovalTask) => void;
  onToggle: (targetId: string, checked: boolean) => void;
  onToggleVisible: (targets: readonly ApprovalTask[], checked: boolean) => void;
  onReassign: (targets: readonly ApprovalTask[]) => void;
}>;

export function ApprovalOperationsTaskPane({
  tasks,
  selected,
  selectedIds,
  canOperate,
  busy,
  onSelect,
  onToggle,
  onToggleVisible,
  onReassign,
}: ApprovalOperationsTaskPaneProps) {
  const { t } = useTranslation('approvals');
  const selectedTargets = tasks.filter((task) => selectedIds.has(task.taskId));
  const allSelected = tasks.length > 0 && tasks.every((task) => selectedIds.has(task.taskId));
  return (
    <>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ sm: 'center' }}
        justifyContent="space-between"
        gap={1}
        sx={{ px: 1.5, py: 1, borderBlock: 1, borderColor: 'divider' }}
      >
        <FormControlLabel
          sx={{
            m: 0,
            '& .MuiFormControlLabel-label.Mui-disabled': { color: 'text.secondary' },
          }}
          control={
            <Checkbox
              size="small"
              checked={allSelected}
              indeterminate={selectedTargets.length > 0 && !allSelected}
              disabled={!canOperate || busy || tasks.length === 0}
              onChange={(_event, checked) => onToggleVisible(tasks, checked)}
            />
          }
          label={t('admin.nativeOperations.selectedCount', {
            count: selectedTargets.length,
            defaultValue: '{{count}} selected',
          })}
        />
        <ActionButton
          size="small"
          intent="primary"
          startIcon={<UserRoundCog size={16} />}
          disabled={
            !canOperate ||
            busy ||
            selectedTargets.length === 0 ||
            !selectedTargets.every(approvalTaskSupportsReassignment)
          }
          onClick={() => onReassign(selectedTargets)}
        >
          {t('admin.nativeOperations.actions.TASK_REASSIGN', { defaultValue: 'Reassign task' })}
        </ActionButton>
      </Stack>
      {tasks.length === 0 ? (
        <EmptyState
          title={t('admin.assurance.states.enforced')}
          description={t('admin.breached.meta')}
          icon={<Activity size={24} />}
        />
      ) : (
        <Stack
          component="ul"
          sx={{ m: 0, p: 0, listStyle: 'none', maxHeight: 540, overflowY: 'auto' }}
        >
          {tasks.map((task) => (
            <Box component="li" key={task.taskId} sx={{ display: 'flex', alignItems: 'stretch' }}>
              <Checkbox
                size="small"
                checked={selectedIds.has(task.taskId)}
                disabled={!canOperate || busy || !approvalTaskSupportsReassignment(task)}
                inputProps={{
                  'aria-label': t('admin.nativeOperations.selectTarget', {
                    target: task.title,
                    defaultValue: 'Select {{target}}',
                  }),
                }}
                sx={{ alignSelf: 'center', ml: 0.5 }}
                onChange={(_event, checked) => onToggle(task.taskId, checked)}
              />
              <ButtonBase
                onClick={() => onSelect(task)}
                aria-current={task.taskId === selected?.taskId ? 'true' : undefined}
                sx={{
                  flex: 1,
                  minWidth: 0,
                  p: 1.5,
                  textAlign: 'left',
                  display: 'block',
                  borderBottom: 1,
                  borderColor: 'divider',
                  bgcolor:
                    task.taskId === selected?.taskId
                      ? alpha(approvalTone.primary, 0.075)
                      : 'transparent',
                }}
              >
                <Box
                  sx={{
                    typography: 'body2',
                    fontWeight: 'fontWeightBold',
                    overflowWrap: 'anywhere',
                  }}
                >
                  {task.title}
                </Box>
                <Box
                  sx={{ typography: 'caption', color: 'text.secondary', overflowWrap: 'anywhere' }}
                >
                  {task.requestNumber} · {task.requesterName}
                </Box>
              </ButtonBase>
            </Box>
          ))}
        </Stack>
      )}
    </>
  );
}

export function ApprovalOperationsTaskInspector({
  task,
  canOperate,
  busy,
  formatTimestamp,
  onReassign,
}: Readonly<{
  task: ApprovalTask;
  canOperate: boolean;
  busy: boolean;
  formatTimestamp: (value?: string | null) => string;
  onReassign: (targets: readonly ApprovalTask[]) => void;
}>) {
  const { t } = useTranslation('approvals');
  return (
    <ApprovalSurface
      title={task.title}
      meta={task.requestNumber}
      action={<UserRoundCog size={18} />}
    >
      <Stack gap={1.5} sx={{ p: 2 }}>
        <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
          <StatusChip status={task.status} />
          <StatusChip status={task.priority} />
          <Box sx={{ typography: 'caption', color: 'text.secondary' }}>
            {t('admin.version', { version: task.version })}
          </Box>
        </Stack>
        <Box sx={{ typography: 'body2', overflowWrap: 'anywhere' }}>{task.summary}</Box>
        <Box sx={{ typography: 'caption', color: 'text.secondary', overflowWrap: 'anywhere' }}>
          {task.stepName} · {formatTimestamp(task.dueAt)}
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} justifyContent="flex-end">
          <ApprovalLinkRow
            title={t('actions.openDetails')}
            detail={task.requesterName ?? ''}
            route={`/approvals/inbox?task=${encodeURIComponent(task.taskId)}`}
            tone={approvalTone.primary}
          />
          <ActionButton
            intent="primary"
            startIcon={<UserRoundCog size={16} />}
            disabled={!canOperate || busy || !approvalTaskSupportsReassignment(task)}
            onClick={() => onReassign([task])}
          >
            {t('admin.nativeOperations.actions.TASK_REASSIGN', { defaultValue: 'Reassign task' })}
          </ActionButton>
        </Stack>
      </Stack>
    </ApprovalSurface>
  );
}
