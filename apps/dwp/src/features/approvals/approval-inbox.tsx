import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Check,
  Clock3,
  Hand,
  MessageSquareText,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ActionButton, FormDialog, FormField } from '@dwp-frontend/design-system';
import { formatDate, useDisplayDictionary } from '@dwp-frontend/shared-i18n';
import {
  claimApprovalTask,
  decideApprovalTask,
  getApprovalTask,
  getApprovalTasks,
  useToast,
} from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import { ApprovalPayloadData } from './approval-payload-data';
import {
  approvalTimelineEventContext,
  approvalTimelineEventDetail,
} from './approval-timeline-copy';
import { ApprovalSurface, PriorityChip, StatusChip, approvalTone } from './approval-ui';
import {
  isProductSurfaceOperationCancelledError,
  useApprovalGovernedMutation,
} from './use-approval-governed-mutation';

import type { ApprovalTask } from '@dwp-frontend/shared-utils';

type Decision = 'APPROVE' | 'REJECT' | 'REQUEST_INFO';

export function ApprovalInbox({ view = 'INBOX' }: { view?: 'INBOX' | 'COMPLETED' }) {
  const { t, i18n } = useTranslation('approvals');
  const display = useDisplayDictionary();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const requestedTaskId = searchParams.get('task') ?? undefined;
  const [selectedId, setSelectedId] = useState<string>();
  const [decision, setDecision] = useState<Decision>();
  const [comment, setComment] = useState('');
  const queueCopy = view === 'COMPLETED' ? 'completed' : 'inbox';
  const tasks = useQuery({
    queryKey: ['approvals', 'tasks', view],
    queryFn: () => getApprovalTasks(view),
    staleTime: 20_000,
    retry: 1,
  });
  useEffect(() => {
    if (!tasks.isError) return;
    setSelectedId(undefined);
    setDecision(undefined);
  }, [tasks.isError]);
  useEffect(() => {
    if (tasks.isError) return;
    if (!tasks.data?.length) {
      if (selectedId) setSelectedId(undefined);
      return;
    }
    if (selectedId && tasks.data.some((task) => task.taskId === selectedId)) return;
    const requested = tasks.data.find((task) => task.taskId === requestedTaskId);
    setSelectedId(requested?.taskId ?? tasks.data[0].taskId);
  }, [requestedTaskId, selectedId, tasks.data, tasks.isError]);
  const detail = useQuery({
    queryKey: ['approvals', 'task', selectedId],
    queryFn: () => getApprovalTask(selectedId!),
    enabled: Boolean(selectedId) && !tasks.isError,
    staleTime: 10_000,
  });
  const runDecision = useApprovalGovernedMutation('route.approvals.work.task-decision.action');
  const runClaim = useApprovalGovernedMutation('route.approvals.work.task-claim.action');
  const decide = useMutation({
    mutationFn: (input: { decision: Decision; comment?: string; expectedVersion: number }) =>
      runDecision((execution) => decideApprovalTask(selectedId!, input, execution)),
    onSuccess: async () => {
      setDecision(undefined);
      setComment('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['approvals', 'tasks'] }),
        queryClient.invalidateQueries({ queryKey: ['approvals', 'task', selectedId] }),
        queryClient.invalidateQueries({ queryKey: ['approvals', 'home'] }),
      ]);
      setSelectedId(undefined);
      toast.success(t('inbox.decisionSaved'));
    },
    onError: (error) =>
      !isProductSurfaceOperationCancelledError(error) && toast.error(t('inbox.decisionError')),
  });
  const claim = useMutation({
    mutationFn: (input: { taskId: string; expectedVersion: number }) =>
      runClaim((execution) => claimApprovalTask(input.taskId, input.expectedVersion, execution)),
    onSuccess: async (claimed) => {
      queryClient.setQueryData(['approvals', 'task', claimed.task.taskId], claimed);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['approvals', 'tasks'] }),
        queryClient.invalidateQueries({ queryKey: ['approvals', 'home'] }),
      ]);
      toast.success(t('inbox.claimed'));
    },
    onError: (error) =>
      !isProductSurfaceOperationCancelledError(error) && toast.error(t('inbox.claimError')),
  });
  const selected = tasks.isError ? undefined : detail.data;

  return (
    <Paper
      variant="outlined"
      sx={{
        mt: 3,
        minHeight: 620,
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', lg: 'minmax(330px, 0.78fr) minmax(0, 1.6fr)' },
        overflow: 'hidden',
        borderRadius: 1,
      }}
    >
      <Box sx={{ borderRight: { lg: 1 }, borderColor: 'divider', minWidth: 0 }}>
        <Box sx={{ px: 2, py: 1.75, borderBottom: 1, borderColor: 'divider' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography component="h2" variant="subtitle1" fontWeight={760}>
                {t(`${queueCopy}.queue`)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t(`${queueCopy}.queueMeta`)}
              </Typography>
            </Box>
            <Chip size="small" label={tasks.isError ? '—' : (tasks.data?.length ?? 0)} />
          </Stack>
        </Box>
        {tasks.isError && (
          <Alert
            severity="error"
            sx={{ m: 1.5 }}
            action={
              <ActionButton
                intent="quiet"
                size="small"
                disabled={tasks.isFetching}
                onClick={() => void tasks.refetch()}
              >
                {t('actions.retry')}
              </ActionButton>
            }
          >
            {t(`${queueCopy}.loadError`)}
          </Alert>
        )}
        <Box sx={{ maxHeight: { lg: 560 }, overflowY: 'auto' }}>
          {!tasks.isError &&
            (tasks.data ?? []).map((task) => (
              <TaskRow
                key={task.taskId}
                task={task}
                selected={selectedId === task.taskId}
                onClick={() => setSelectedId(task.taskId)}
              />
            ))}
          {!tasks.isLoading && !tasks.isError && tasks.data?.length === 0 && (
            <Box sx={{ px: 3, py: 8, textAlign: 'center' }}>
              <ShieldCheck size={32} color={approvalTone.teal} />
              <Typography component="p" variant="subtitle1" sx={{ mt: 1 }}>
                {t(`${queueCopy}.empty`)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t(`${queueCopy}.emptyDescription`)}
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
      <Box sx={{ minWidth: 0, bgcolor: '#FAFBFD' }}>
        {!selected && (
          <Box
            sx={{
              minHeight: 560,
              display: 'grid',
              placeItems: 'center',
              textAlign: 'center',
              px: 3,
            }}
          >
            <Box>
              <MessageSquareText size={34} color="#728096" />
              <Typography component="p" variant="subtitle1" sx={{ mt: 1 }}>
                {t(`${queueCopy}.select`)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t(`${queueCopy}.selectDescription`)}
              </Typography>
            </Box>
          </Box>
        )}
        {selected && (
          <Box>
            <Box
              sx={{
                px: { xs: 2, md: 3 },
                py: 2.5,
                bgcolor: 'background.paper',
                borderBottom: 1,
                borderColor: 'divider',
              }}
            >
              <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={2}>
                <Box>
                  <Stack direction="row" gap={0.75} sx={{ mb: 1 }}>
                    <PriorityChip priority={selected.task.priority} />
                    <StatusChip status={selected.task.status} />
                    <Chip
                      size="small"
                      variant="outlined"
                      label={t(`classification.${selected.task.dataClassification}`, {
                        defaultValue: selected.task.dataClassification,
                      })}
                    />
                  </Stack>
                  <Typography component="h2" variant="h5">
                    {selected.task.title}
                  </Typography>
                  <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                    {selected.task.summary}
                  </Typography>
                </Box>
                <Box sx={{ minWidth: 74, textAlign: 'right' }}>
                  <Typography variant="caption" color="text.secondary">
                    {t('inbox.risk')}
                  </Typography>
                  <Typography
                    component="p"
                    variant="h4"
                    color={
                      selected.task.riskScore >= 80
                        ? 'error.main'
                        : selected.task.riskScore >= 60
                          ? 'warning.main'
                          : 'primary.main'
                    }
                  >
                    {selected.task.riskScore}
                  </Typography>
                </Box>
              </Stack>
            </Box>
            {selected.selfApprovalBlocked && (
              <Alert severity="warning" icon={<AlertTriangle size={19} />} sx={{ m: 2 }}>
                {t('inbox.selfApprovalBlocked')}
              </Alert>
            )}
            <Box
              sx={{
                p: { xs: 2, md: 3 },
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1.25fr) minmax(280px, 0.75fr)' },
                gap: 2,
              }}
            >
              <Stack gap={2}>
                <ApprovalSurface title={t('inbox.context')} meta={selected.task.requestNumber}>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                    }}
                  >
                    {[
                      [t('inbox.requester'), selected.task.requesterName ?? '-'],
                      [t('inbox.organization'), selected.task.requesterOrgName ?? '-'],
                      [
                        t('inbox.workflow'),
                        i18n.resolvedLanguage?.startsWith('ko')
                          ? selected.task.workflowNameKo
                          : selected.task.workflowNameEn,
                      ],
                      [
                        t('inbox.currentStage'),
                        t('inbox.stageProgress', {
                          name: selected.task.stepName,
                          current: selected.task.stepSequence,
                        }),
                      ],
                      [
                        t('inbox.due'),
                        selected.task.dueAt
                          ? formatDate(selected.task.dueAt, {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })
                          : '-',
                      ],
                    ].map(([label, value]) => (
                      <Box
                        key={label}
                        sx={{ p: 2, borderRight: 1, borderBottom: 1, borderColor: 'divider' }}
                      >
                        <Typography variant="caption" color="text.secondary">
                          {label}
                        </Typography>
                        <Typography variant="body2" fontWeight={700} sx={{ mt: 0.35 }}>
                          {value}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </ApprovalSurface>
                <ApprovalSurface title={t('inbox.requestData')}>
                  <ApprovalPayloadData
                    payload={selected.payload}
                    formSchema={selected.formSchema}
                  />
                </ApprovalSurface>
              </Stack>
              <ApprovalSurface title={t('inbox.timeline')} meta={t('inbox.timelineMeta')}>
                <Stack divider={<Divider flexItem />} sx={{ p: 2 }}>
                  {selected.timeline.map((event) => (
                    <Stack key={event.eventId} direction="row" gap={1.25} sx={{ py: 1.2 }}>
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          mt: 0.65,
                          flex: '0 0 8px',
                          borderRadius: '50%',
                          bgcolor: event.outcome === 'SUCCESS' ? 'success.main' : 'warning.main',
                        }}
                      />
                      <Box>
                        <Typography variant="body2" fontWeight={700}>
                          {t(`events.${event.eventType}`, {
                            defaultValue: display('auditActions', event.eventType),
                          })}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {approvalTimelineEventContext(t, event)} ·{' '}
                          {approvalTimelineEventDetail(t, event)} ·{' '}
                          {formatDate(event.occurredAt, {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </Typography>
                      </Box>
                    </Stack>
                  ))}
                </Stack>
              </ApprovalSurface>
            </Box>
            {view === 'INBOX' && (
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                justifyContent="flex-end"
                gap={1}
                sx={{
                  position: 'sticky',
                  bottom: 0,
                  px: 3,
                  py: 2,
                  borderTop: 1,
                  borderColor: 'divider',
                  bgcolor: 'rgba(255,255,255,0.94)',
                  backdropFilter: 'blur(14px)',
                }}
              >
                {selected.canClaim && (
                  <ActionButton
                    intent="secondary"
                    startIcon={<Hand size={17} />}
                    loading={claim.isPending}
                    onClick={() =>
                      claim.mutate({
                        taskId: selected.task.taskId,
                        expectedVersion: selected.task.version,
                      })
                    }
                  >
                    {t('actions.claim')}
                  </ActionButton>
                )}
                <ActionButton
                  intent="secondary"
                  startIcon={<MessageSquareText size={17} />}
                  disabled={!selected.canDecide}
                  onClick={() => setDecision('REQUEST_INFO')}
                >
                  {t('actions.requestInfo')}
                </ActionButton>
                <ActionButton
                  intent="danger"
                  startIcon={<X size={17} />}
                  disabled={!selected.canDecide}
                  onClick={() => setDecision('REJECT')}
                >
                  {t('actions.reject')}
                </ActionButton>
                <ActionButton
                  intent="primary"
                  startIcon={<Check size={17} />}
                  disabled={!selected.canDecide}
                  onClick={() => setDecision('APPROVE')}
                >
                  {t('actions.approve')}
                </ActionButton>
              </Stack>
            )}
          </Box>
        )}
      </Box>
      <FormDialog
        open={Boolean(decision)}
        title={t(`inbox.dialog.${decision ?? 'APPROVE'}.title`)}
        description={t(`inbox.dialog.${decision ?? 'APPROVE'}.description`)}
        cancelLabel={t('actions.cancel')}
        submitLabel={t(`inbox.dialog.${decision ?? 'APPROVE'}.confirm`)}
        submitIntent={decision === 'REJECT' ? 'danger' : 'primary'}
        busy={decide.isPending}
        submitDisabled={decision !== 'APPROVE' && comment.trim().length < 8}
        onClose={() => setDecision(undefined)}
        onSubmit={() =>
          decide.mutate({
            decision: decision!,
            comment: comment.trim() || undefined,
            expectedVersion: selected!.task.version,
          })
        }
      >
        <FormField
          autoFocus
          multiline
          minRows={3}
          label={t('inbox.comment')}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          required={decision !== 'APPROVE'}
        />
      </FormDialog>
    </Paper>
  );
}

function TaskRow({
  task,
  selected,
  onClick,
}: {
  task: ApprovalTask;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <ButtonBase
      onClick={onClick}
      sx={{
        width: 1,
        minHeight: 104,
        px: 2,
        py: 1.5,
        display: 'block',
        textAlign: 'left',
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: selected ? alpha(approvalTone.primary, 0.08) : 'background.paper',
        boxShadow: selected ? `inset 3px 0 0 ${approvalTone.primary}` : 'none',
        '&:hover': { bgcolor: alpha(approvalTone.primary, 0.055) },
      }}
    >
      <Stack direction="row" justifyContent="space-between" gap={1}>
        <Typography variant="caption" color="text.secondary">
          {task.requestNumber}
        </Typography>
        <Stack direction="row" gap={0.5}>
          <PriorityChip priority={task.priority} />
          <Chip
            size="small"
            icon={<Clock3 size={13} />}
            label={
              task.dueAt
                ? formatDate(task.dueAt, {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '-'
            }
          />
        </Stack>
      </Stack>
      <Typography variant="body2" fontWeight={760} noWrap sx={{ mt: 0.75 }}>
        {task.title}
      </Typography>
      <Typography variant="caption" color="text.secondary" noWrap>
        {task.requesterName} · {task.requesterOrgName}
      </Typography>
      <Typography variant="caption" color="primary.main" noWrap sx={{ display: 'block', mt: 0.35 }}>
        {task.stepSequence}. {task.stepName}
      </Typography>
    </ButtonBase>
  );
}
