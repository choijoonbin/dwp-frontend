import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCheck, ListChecks } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ActionButton, FormDialog, FormField, LoadingState } from '@dwp-frontend/design-system';
import {
  claimApprovalTask,
  decideApprovalTask,
  getApprovalTask,
  getApprovalTasks,
  useToast,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

import {
  executeSequentialApprovalBatch,
  filterApprovalTasks,
  parseApprovalQueueFilter,
  toggleApprovalBatchSelection,
} from './approval-command-center-model';
import { ApprovalCommandTaskList } from './approval-command-task-list';
import { ApprovalDecisionDetail, type ApprovalDecisionKind } from './approval-decision-detail';
import {
  isProductSurfaceOperationCancelledError,
  useApprovalGovernedMutation,
} from './use-approval-governed-mutation';
import { useProductSurfaceRequestScope } from '../../components/use-product-surface-request-scope';
import { useApprovalQueueClock } from './use-approval-queue-clock';

import type { ApprovalBatchResult, ApprovalQueueFilter } from './approval-command-center-model';
import type { ApprovalTaskDetail } from '@dwp-frontend/shared-utils';

type DecisionConfirmation = {
  decision: ApprovalDecisionKind;
  taskId: string;
  expectedVersion: number;
  scopeIdentity: string;
};

export function ApprovalCommandCenter() {
  const { t } = useTranslation('approvals');
  const toast = useToast();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('md'));
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTaskId = searchParams.get('task') ?? undefined;
  const requestScope = useProductSurfaceRequestScope({
    productKey: 'approvals',
    surfaceKey: 'approvals.work',
  });
  const scopeIdentity = requestScope.cacheKey.join('|');
  const scopeIdentityRef = useRef(scopeIdentity);
  scopeIdentityRef.current = scopeIdentity;
  const previousScopeIdentity = useRef(scopeIdentity);
  const restoreTaskIdRef = useRef<string | undefined>(undefined);
  const detailPaneRef = useRef<HTMLDivElement>(null);
  const nowMs = useApprovalQueueClock();

  const [search, setSearch] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState<string>();
  const [mobileQueueMode, setMobileQueueMode] = useState(false);
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const [confirmation, setConfirmation] = useState<DecisionConfirmation>();
  const decision = confirmation?.decision;
  const [comment, setComment] = useState('');
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [batchResult, setBatchResult] = useState<ApprovalBatchResult>();

  const tasks = useQuery({
    queryKey: ['approvals', 'command-tasks', 'INBOX', ...requestScope.cacheKey],
    queryFn: () => getApprovalTasks('INBOX', requestScope.contextScopeKey),
    enabled: requestScope.ready,
    staleTime: 20_000,
    retry: 1,
    meta: requestScope.queryMeta,
  });
  const filter: ApprovalQueueFilter = parseApprovalQueueFilter(searchParams.get('queue'));
  const visibleTasks = useMemo(
    () =>
      filterApprovalTasks({
        tasks: tasks.data ?? [],
        filter,
        search,
        nowMs,
      }),
    [filter, search, tasks.data, nowMs]
  );

  useEffect(() => {
    if (previousScopeIdentity.current === scopeIdentity) return;
    previousScopeIdentity.current = scopeIdentity;
    setSearch('');
    setSelectedTaskId(undefined);
    setMobileQueueMode(true);
    setSelectedBatchIds([]);
    setConfirmation(undefined);
    setComment('');
    setBatchDialogOpen(false);
    setBatchResult(undefined);
    const next = new URLSearchParams(searchParams);
    next.delete('task');
    setSearchParams(next, { replace: true });
  }, [scopeIdentity, searchParams, setSearchParams]);

  useEffect(() => {
    setSelectedTaskId(requestedTaskId);
    setMobileQueueMode(mobile && !requestedTaskId);
  }, [requestedTaskId, mobile]);

  useEffect(() => {
    if (tasks.isError || !tasks.data) return;
    if (mobile && mobileQueueMode) return;
    if (selectedTaskId && visibleTasks.some((task) => task.taskId === selectedTaskId)) return;
    const requested = requestedTaskId
      ? visibleTasks.find((task) => task.taskId === requestedTaskId)
      : undefined;
    setSelectedTaskId(requested?.taskId ?? (mobile ? undefined : visibleTasks[0]?.taskId));
  }, [
    mobile,
    mobileQueueMode,
    requestedTaskId,
    selectedTaskId,
    tasks.data,
    tasks.isError,
    visibleTasks,
  ]);

  const detail = useQuery({
    queryKey: ['approvals', 'command-task', selectedTaskId, ...requestScope.cacheKey],
    queryFn: () => getApprovalTask(selectedTaskId!, requestScope.contextScopeKey),
    enabled: requestScope.ready && Boolean(selectedTaskId) && !tasks.isError,
    staleTime: 0,
    retry: 1,
    meta: requestScope.queryMeta,
  });

  const tasksReady =
    requestScope.ready && tasks.isSuccess && !tasks.isFetching && tasks.failureCount === 0;
  const selected =
    tasksReady &&
    detail.isSuccess &&
    !detail.isFetching &&
    detail.failureCount === 0 &&
    detail.data.task.taskId === selectedTaskId
      ? detail.data
      : undefined;
  const confirmationReady = Boolean(
    confirmation &&
    selected &&
    selected.canDecide &&
    !selected.selfApprovalBlocked &&
    confirmation.taskId === selected.task.taskId &&
    confirmation.expectedVersion === selected.task.version &&
    confirmation.scopeIdentity === scopeIdentity
  );

  const assertCurrentAuthority = (
    input: { taskId: string; expectedVersion: number; scopeIdentity: string },
    kind: 'claim' | 'decide'
  ) => {
    const queueState = queryClient.getQueryState([
      'approvals',
      'command-tasks',
      'INBOX',
      ...requestScope.cacheKey,
    ]);
    const taskState = queryClient.getQueryState<ApprovalTaskDetail>([
      'approvals',
      'command-task',
      input.taskId,
      ...requestScope.cacheKey,
    ]);
    const latest = taskState?.data;
    if (
      scopeIdentityRef.current !== input.scopeIdentity ||
      !requestScope.ready ||
      queueState?.status !== 'success' ||
      queueState.fetchStatus !== 'idle' ||
      queueState.fetchFailureCount > 0 ||
      taskState?.status !== 'success' ||
      taskState.fetchStatus !== 'idle' ||
      taskState.fetchFailureCount > 0 ||
      latest?.task.taskId !== input.taskId ||
      latest.task.version !== input.expectedVersion ||
      !Number.isSafeInteger(input.expectedVersion) ||
      input.expectedVersion < 0 ||
      (kind === 'claim' ? !latest.canClaim : !latest.canDecide || latest.selfApprovalBlocked)
    ) {
      throw new Error('approval authority changed');
    }
  };

  useEffect(() => {
    setConfirmation(undefined);
    setComment('');
  }, [selectedTaskId]);

  useEffect(() => {
    if (confirmation && !confirmationReady) setConfirmation(undefined);
  }, [confirmation, confirmationReady]);

  useEffect(() => {
    if (mobile && selectedTaskId && !mobileQueueMode) detailPaneRef.current?.focus();
  }, [mobile, selectedTaskId, mobileQueueMode]);

  const runDecision = useApprovalGovernedMutation('route.approvals.work.task-decision.action');
  const runClaim = useApprovalGovernedMutation('route.approvals.work.task-claim.action');

  const invalidateApprovalWork = async (taskId?: string) => {
    const invalidations = [
      queryClient.invalidateQueries({ queryKey: ['approvals', 'command-tasks'] }),
      queryClient.invalidateQueries({ queryKey: ['approvals', 'tasks'] }),
      queryClient.invalidateQueries({ queryKey: ['approvals', 'home'] }),
    ];
    if (taskId) {
      invalidations.push(
        queryClient.invalidateQueries({ queryKey: ['approvals', 'command-task', taskId] }),
        queryClient.invalidateQueries({ queryKey: ['approvals', 'task', taskId] })
      );
    }
    await Promise.all(invalidations);
  };

  const decide = useMutation({
    mutationFn: (input: {
      taskId: string;
      decision: ApprovalDecisionKind;
      comment?: string;
      expectedVersion: number;
      scopeIdentity: string;
    }) =>
      runDecision((execution) => {
        assertCurrentAuthority(input, 'decide');
        return decideApprovalTask(
          input.taskId,
          {
            decision: input.decision,
            comment: input.comment,
            expectedVersion: input.expectedVersion,
          },
          execution
        );
      }),
    onSuccess: async (_result, input) => {
      if (scopeIdentityRef.current !== input.scopeIdentity) return;
      setConfirmation(undefined);
      setComment('');
      setSelectedBatchIds((current) => current.filter((taskId) => taskId !== input.taskId));
      setSelectedTaskId(undefined);
      const next = new URLSearchParams(searchParams);
      next.delete('task');
      setSearchParams(next, { replace: true });
      await invalidateApprovalWork(input.taskId);
      toast.success(t('inbox.decisionSaved'));
    },
    onError: (error, input) => {
      if (
        scopeIdentityRef.current !== input.scopeIdentity ||
        isProductSurfaceOperationCancelledError(error)
      )
        return;
      toast.error(t('inbox.decisionError'));
    },
  });

  const claim = useMutation({
    mutationFn: (input: { taskId: string; expectedVersion: number; scopeIdentity: string }) =>
      runClaim((execution) => {
        assertCurrentAuthority(input, 'claim');
        return claimApprovalTask(input.taskId, input.expectedVersion, execution);
      }),
    onSuccess: async (claimed, input) => {
      if (scopeIdentityRef.current !== input.scopeIdentity) return;
      queryClient.setQueryData(
        ['approvals', 'command-task', claimed.task.taskId, ...requestScope.cacheKey],
        claimed
      );
      await invalidateApprovalWork();
      toast.success(t('inbox.claimed'));
    },
    onError: (error, input) => {
      if (
        scopeIdentityRef.current !== input.scopeIdentity ||
        isProductSurfaceOperationCancelledError(error)
      )
        return;
      toast.error(t('inbox.claimError'));
    },
  });

  const batchApprove = useMutation({
    mutationFn: async (input: { taskIds: readonly string[]; scopeIdentity: string }) =>
      executeSequentialApprovalBatch({
        taskIds: input.taskIds,
        loadTask: async (taskId) => {
          if (scopeIdentityRef.current !== input.scopeIdentity) throw new Error('scope changed');
          const latest = await getApprovalTask(taskId, requestScope.contextScopeKey);
          if (scopeIdentityRef.current !== input.scopeIdentity) throw new Error('scope changed');
          if (
            latest.task.taskId !== taskId ||
            !Number.isSafeInteger(latest.task.version) ||
            latest.task.version < 0
          )
            throw new Error('invalid task authority');
          queryClient.setQueryData(
            ['approvals', 'command-task', taskId, ...requestScope.cacheKey],
            latest
          );
          return latest;
        },
        approveTask: async (latest) => {
          if (scopeIdentityRef.current !== input.scopeIdentity) throw new Error('scope changed');
          await runDecision((execution) =>
            decideApprovalTask(
              latest.task.taskId,
              { decision: 'APPROVE', expectedVersion: latest.task.version },
              execution
            )
          );
        },
      }),
    onSuccess: async (result, input) => {
      if (scopeIdentityRef.current !== input.scopeIdentity) return;
      setBatchDialogOpen(false);
      setBatchResult(result);
      setSelectedBatchIds((current) =>
        current.filter((taskId) => !result.approvedTaskIds.includes(taskId))
      );
      await invalidateApprovalWork();
      await Promise.all(
        input.taskIds.map((taskId) =>
          queryClient.invalidateQueries({
            queryKey: ['approvals', 'command-task', taskId, ...requestScope.cacheKey],
          })
        )
      );
      if (result.failedTaskId) toast.error(t('home.commandCenter.batchStopped'));
      else toast.success(t('home.commandCenter.batchCompleted'));
    },
    onError: (error, input) => {
      if (
        scopeIdentityRef.current !== input.scopeIdentity ||
        isProductSurfaceOperationCancelledError(error)
      )
        return;
      setBatchDialogOpen(false);
      toast.error(t('home.commandCenter.batchFailed'));
    },
  });

  const selectTask = (taskId: string) => {
    restoreTaskIdRef.current = taskId;
    setMobileQueueMode(false);
    setSelectedTaskId(taskId);
    const next = new URLSearchParams(searchParams);
    next.set('task', taskId);
    setSearchParams(next, { replace: true });
  };

  const backToQueue = () => {
    const taskId = restoreTaskIdRef.current ?? selectedTaskId;
    setMobileQueueMode(true);
    setSelectedTaskId(undefined);
    const next = new URLSearchParams(searchParams);
    next.delete('task');
    setSearchParams(next, { replace: true });
    window.requestAnimationFrame(() => {
      if (!taskId) return;
      const row = document.querySelector<HTMLElement>(`[data-approval-task-id="${taskId}"]`);
      row?.querySelector<HTMLElement>('button')?.focus();
    });
  };

  const toggleBatch = (taskId: string) => {
    setBatchResult(undefined);
    setSelectedBatchIds((current) => {
      const next = toggleApprovalBatchSelection(current, taskId);
      if (next.length === current.length && !current.includes(taskId)) {
        toast.error(t('home.commandCenter.batchLimitReached'));
      }
      return next;
    });
  };

  const showQueue = !mobile || mobileQueueMode || !selectedTaskId;
  const showDetail = !mobile || (!mobileQueueMode && Boolean(selectedTaskId));
  const busy = decide.isPending || claim.isPending || batchApprove.isPending;

  return (
    <Paper
      component="section"
      variant="outlined"
      aria-labelledby="approval-command-center-title"
      sx={{ overflow: 'hidden' }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ sm: 'center' }}
        justifyContent="space-between"
        gap={1.5}
        sx={{ px: { xs: 1.5, sm: 2 }, py: 1.5, borderBottom: 1, borderColor: 'divider' }}
      >
        <Stack direction="row" alignItems="center" gap={1.25}>
          <Box sx={{ color: 'primary.main' }}>
            <ListChecks size={21} aria-hidden="true" />
          </Box>
          <Box>
            <Typography id="approval-command-center-title" component="h2" variant="subtitle1">
              {t('home.commandCenter.title')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('home.commandCenter.description')}
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
          <Chip
            size="small"
            color={selectedBatchIds.length > 0 ? 'primary' : 'default'}
            label={t('home.commandCenter.selectedCount', { count: selectedBatchIds.length })}
          />
          <ActionButton
            intent="primary"
            size="small"
            startIcon={<CheckCheck size={16} />}
            disabled={selectedBatchIds.length === 0 || busy || !tasksReady}
            onClick={() => setBatchDialogOpen(true)}
          >
            {t('home.commandCenter.batchApprove')}
          </ActionButton>
        </Stack>
      </Stack>

      {batchResult && (
        <Box
          role="status"
          aria-live="polite"
          sx={{ px: 2, py: 1.25, bgcolor: 'action.hover', borderBottom: 1, borderColor: 'divider' }}
        >
          <Typography variant="body2">
            {t('home.commandCenter.batchResult', {
              approved: batchResult.approvedTaskIds.length,
              ineligible: batchResult.ineligibleTaskIds.length,
              remaining: batchResult.remainingTaskIds.length + (batchResult.failedTaskId ? 1 : 0),
            })}
          </Typography>
        </Box>
      )}

      {tasks.isError ? (
        <Box role="alert" sx={{ px: 3, py: 6, textAlign: 'center' }}>
          <Typography component="p" variant="subtitle1">
            {t('inbox.loadError')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {t('home.commandCenter.queueFailClosed')}
          </Typography>
          <ActionButton
            intent="secondary"
            size="small"
            disabled={tasks.isFetching}
            onClick={() => void tasks.refetch()}
            sx={{ mt: 1.5 }}
          >
            {t('actions.retry')}
          </ActionButton>
        </Box>
      ) : tasks.isLoading || !tasks.data ? (
        <Box sx={{ minHeight: 620, display: 'grid', placeItems: 'center' }}>
          <LoadingState label={t('common:labels.loading')} size="page" embedded />
        </Box>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateAreas: {
              xs: '"list" "detail"',
              md: '"list detail"',
            },
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              md: 'minmax(350px, 0.78fr) minmax(520px, 1.5fr)',
            },
            gridTemplateRows: { md: 'minmax(680px, auto)' },
          }}
        >
          <Box sx={{ gridArea: 'list', display: showQueue ? 'block' : 'none', minWidth: 0 }}>
            <ApprovalCommandTaskList
              tasks={visibleTasks}
              selectedTaskId={selectedTaskId}
              selectedBatchIds={selectedBatchIds}
              emptyQueue={tasks.data.length === 0}
              search={search}
              busy={busy || tasks.isFetching}
              onSearchChange={setSearch}
              onSelect={selectTask}
              onToggleBatch={toggleBatch}
            />
          </Box>
          <Box
            ref={detailPaneRef}
            role="region"
            aria-label={t('home.commandCenter.detailTitle')}
            tabIndex={-1}
            sx={{
              gridArea: 'detail',
              display: showDetail ? 'block' : 'none',
              minWidth: 0,
              bgcolor: 'background.paper',
            }}
          >
            <ApprovalDecisionDetail
              detail={selected}
              loading={Boolean(selectedTaskId) && (detail.isFetching || tasks.isFetching)}
              error={
                Boolean(selectedTaskId) &&
                (detail.isError || detail.failureCount > 0 || tasks.failureCount > 0)
              }
              mobile={mobile}
              decisionBusy={decide.isPending || batchApprove.isPending}
              claimBusy={claim.isPending}
              onBack={backToQueue}
              onRetry={() => void detail.refetch()}
              onClaim={() => {
                if (!selected) return;
                claim.mutate({
                  taskId: selected.task.taskId,
                  expectedVersion: selected.task.version,
                  scopeIdentity,
                });
              }}
              onDecision={(kind) => {
                if (!selected || !selected.canDecide || selected.selfApprovalBlocked) return;
                setConfirmation({
                  decision: kind,
                  taskId: selected.task.taskId,
                  expectedVersion: selected.task.version,
                  scopeIdentity,
                });
              }}
            />
          </Box>
        </Box>
      )}

      <FormDialog
        open={Boolean(confirmation && confirmationReady)}
        title={t(`inbox.dialog.${decision ?? 'APPROVE'}.title`)}
        description={t(`inbox.dialog.${decision ?? 'APPROVE'}.description`)}
        cancelLabel={t('actions.cancel')}
        submitLabel={t(`inbox.dialog.${decision ?? 'APPROVE'}.confirm`)}
        submitIntent={decision === 'REJECT' ? 'danger' : 'primary'}
        busy={decide.isPending}
        submitDisabled={!confirmationReady || (decision !== 'APPROVE' && comment.trim().length < 8)}
        onClose={() => setConfirmation(undefined)}
        onSubmit={() => {
          if (!confirmation || !confirmationReady || decide.isPending) return;
          decide.mutate({
            ...confirmation,
            comment: comment.trim() || undefined,
          });
        }}
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

      <FormDialog
        open={batchDialogOpen}
        title={t('home.commandCenter.batchDialogTitle')}
        description={t('home.commandCenter.batchDialogDescription', {
          count: selectedBatchIds.length,
        })}
        cancelLabel={t('actions.cancel')}
        submitLabel={t('home.commandCenter.batchDialogConfirm')}
        submitIntent="primary"
        busy={batchApprove.isPending}
        submitDisabled={selectedBatchIds.length === 0 || !tasksReady}
        onClose={() => setBatchDialogOpen(false)}
        onSubmit={() => {
          if (!tasksReady || batchApprove.isPending) return;
          batchApprove.mutate({ taskIds: [...selectedBatchIds], scopeIdentity });
        }}
      >
        <Box role="note" sx={{ py: 1 }}>
          <Typography variant="body2">{t('home.commandCenter.batchDialogEvidence')}</Typography>
        </Box>
      </FormDialog>
    </Paper>
  );
}
