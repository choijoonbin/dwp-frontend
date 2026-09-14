import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckCheck, ListChecks, ListPlus, RefreshCw, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ActionButton, FormDialog, FormField, LoadingState } from '@dwp-frontend/design-system';
import {
  HttpError,
  claimApprovalTask,
  decideApprovalTask,
  getApprovalTask,
  usePermissions,
  useToast,
} from '@dwp-frontend/shared-utils';
import { formatDate } from '@dwp-frontend/shared-i18n';
import {
  approvalQuorumVotePrecondition,
  readApprovalQuorumTaskSnapshot,
  sameApprovalQuorumTaskSnapshot,
} from '@dwp-frontend/shared-utils/api/approval-quorum-contract';
import type { ApprovalQuorumTaskSnapshot } from '@dwp-frontend/shared-utils/api/approval-quorum-contract';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

import {
  executeSequentialApprovalBatch,
  hasApprovalTaskContentAccess,
  parseApprovalQueueFilter,
  approvalScopeIdentity,
  toggleApprovalBatchSelection,
} from './approval-command-center-model';
import { ApprovalCommandTaskList } from './approval-command-task-list';
import { ApprovalBatchResultPanel } from './approval-batch-result-panel';
import { ApprovalDecisionDetail, type ApprovalDecisionKind } from './approval-decision-detail';
import {
  ApprovalDecisionRecoveryNotice,
  type ApprovalDecisionRecovery,
} from './approval-decision-recovery-notice';
import {
  isProductSurfaceOperationCancelledError,
  useApprovalGovernedMutation,
} from './use-approval-governed-mutation';
import { useProductSurfaceRequestScope } from '../../components/use-product-surface-request-scope';
import { useApprovalQueueClock } from './use-approval-queue-clock';
import { useApprovalCommandTaskSearch } from './use-approval-command-task-search';
import { useApprovalTaskDocuments } from './use-approval-task-documents';
import { authorizedApprovalWorkReturnTarget } from './approval-return-target';

import type { ApprovalBatchResult, ApprovalQueueFilter } from './approval-command-center-model';
import type { ApprovalTaskDetail } from '@dwp-frontend/shared-utils';

type DecisionConfirmation = {
  decision: ApprovalDecisionKind;
  taskId: string;
  expectedVersion: number;
  scopeIdentity: string;
  quorum?: ApprovalQuorumTaskSnapshot | null;
};

export function ApprovalCommandCenter() {
  const { t } = useTranslation('approvals');
  const toast = useToast();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const pendingListNavigation = useRef<string | undefined>(undefined);
  const requestedTaskId = searchParams.get('task') ?? undefined;
  const { permissions } = usePermissions();
  const requestedReturnTarget = searchParams.get('returnTo');
  const returnTarget = authorizedApprovalWorkReturnTarget(requestedReturnTarget, permissions);
  const returnToWork = () => {
    const currentTarget = authorizedApprovalWorkReturnTarget(requestedReturnTarget, permissions);
    if (currentTarget) navigate(currentTarget);
  };
  const requestScope = useProductSurfaceRequestScope({
    productKey: 'approvals',
    surfaceKey: 'approvals.work',
  });
  const scopeIdentity = approvalScopeIdentity(requestScope.cacheKey);
  const scopeIdentityRef = useRef(scopeIdentity);
  scopeIdentityRef.current = scopeIdentity;
  const previousScopeIdentity = useRef(scopeIdentity);
  const restoreTaskIdRef = useRef<string | undefined>(undefined);
  const detailPaneRef = useRef<HTMLDivElement>(null);
  const nowMs = useApprovalQueueClock();

  const [search, setSearch] = useState(searchParams.get('query') ?? '');
  const [selectedTaskId, setSelectedTaskId] = useState<string>();
  const selectedTaskIdRef = useRef(selectedTaskId);
  selectedTaskIdRef.current = selectedTaskId;
  const [mobileQueueMode, setMobileQueueMode] = useState(false);
  const [mobileSelectionMode, setMobileSelectionMode] = useState(false);
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const [confirmation, setConfirmation] = useState<DecisionConfirmation>();
  const [decisionRecovery, setDecisionRecovery] = useState<ApprovalDecisionRecovery>();
  const decision = confirmation?.decision;
  const [comment, setComment] = useState('');
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [batchResult, setBatchResult] = useState<ApprovalBatchResult>();

  const filter: ApprovalQueueFilter = parseApprovalQueueFilter(searchParams.get('queue'));
  const requestedPage = Number(searchParams.get('page') ?? '0');
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage >= 0 && requestedPage <= 100000
      ? requestedPage
      : 0;
  const requestedSort = searchParams.get('sort');
  const sort =
    requestedSort === 'NEWEST' || requestedSort === 'OLDEST' ? requestedSort : 'PRIORITY';
  const requestedStatus = searchParams.get('status');
  const status =
    requestedStatus === 'PENDING' ||
    requestedStatus === 'CLAIMED' ||
    requestedStatus === 'INFO_REQUESTED'
      ? requestedStatus
      : '';
  const tasks = useApprovalCommandTaskSearch({
    queue: filter,
    search,
    page,
    sort,
    status,
    day: new Date(nowMs).toDateString(),
    scope: requestScope,
  });
  const visibleTasks = useMemo(() => tasks.data ?? [], [tasks.data]);
  const changeSearch = (value: string) => {
    setSearch(value);
    changeListParameters({ query: value, page: '0' });
  };
  const changeListParameters = (values: Record<string, string>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    next.delete('task');
    pendingListNavigation.current = next.toString();
    setSelectedTaskId(undefined);
    setSelectedBatchIds([]);
    setConfirmation(undefined);
    setSearchParams(next, { replace: true });
  };
  const previousQueue = useRef(filter);
  const urlSearch = searchParams.get('query') ?? '';
  useEffect(() => setSearch(urlSearch), [urlSearch]);
  useEffect(() => {
    if (previousQueue.current === filter) return;
    previousQueue.current = filter;
    const next = new URLSearchParams(searchParams);
    next.delete('page');
    setSelectedBatchIds([]);
    setSearchParams(next, { replace: true });
  }, [filter, searchParams, setSearchParams]);

  useEffect(() => {
    if (previousScopeIdentity.current === scopeIdentity) return;
    previousScopeIdentity.current = scopeIdentity;
    setSearch('');
    setSelectedTaskId(undefined);
    setMobileQueueMode(true);
    setMobileSelectionMode(false);
    setSelectedBatchIds([]);
    setConfirmation(undefined);
    setDecisionRecovery(undefined);
    setComment('');
    setBatchDialogOpen(false);
    setBatchResult(undefined);
    const next = new URLSearchParams(searchParams);
    next.delete('task');
    for (const key of ['query', 'page', 'status', 'sort']) next.delete(key);
    setSearchParams(next, { replace: true });
  }, [scopeIdentity, searchParams, setSearchParams]);

  useEffect(() => {
    setSelectedTaskId(requestedTaskId);
    setMobileQueueMode(mobile && !requestedTaskId);
  }, [requestedTaskId, mobile]);

  useEffect(() => {
    if (pendingListNavigation.current !== undefined) {
      if (pendingListNavigation.current !== searchParams.toString()) return;
      pendingListNavigation.current = undefined;
    }
    if (tasks.isError || tasks.isFetching || !tasks.data) return;
    if (mobile && mobileQueueMode) return;
    if (selectedTaskId && visibleTasks.some((task) => task.taskId === selectedTaskId)) {
      if (!mobile && !requestedTaskId) {
        const next = new URLSearchParams(searchParams);
        next.set('task', selectedTaskId);
        setSearchParams(next, { replace: true });
      }
      return;
    }
    const requested = requestedTaskId
      ? visibleTasks.find((task) => task.taskId === requestedTaskId)
      : undefined;
    const nextTaskId = requested?.taskId ?? (mobile ? undefined : visibleTasks[0]?.taskId);
    setSelectedTaskId(nextTaskId);
    if (!mobile) {
      const next = new URLSearchParams(searchParams);
      if (nextTaskId) next.set('task', nextTaskId);
      else next.delete('task');
      setSearchParams(next, { replace: true });
    }
  }, [
    mobile,
    mobileQueueMode,
    requestedTaskId,
    searchParams,
    selectedTaskId,
    setSearchParams,
    tasks.data,
    tasks.isError,
    tasks.isFetching,
    visibleTasks,
  ]);

  const detail = useQuery({
    queryKey: ['approvals', 'command-task', selectedTaskId, ...requestScope.cacheKey],
    queryFn: ({ signal }) => getApprovalTask(selectedTaskId!, requestScope.contextScopeKey, signal),
    enabled: requestScope.ready && Boolean(selectedTaskId) && !tasks.isError && !tasks.isFetching,
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
    hasApprovalTaskContentAccess(selected) &&
    selected.canDecide &&
    !selected.selfApprovalBlocked &&
    confirmation.taskId === selected.task.taskId &&
    confirmation.expectedVersion === selected.task.version &&
    confirmation.scopeIdentity === scopeIdentity &&
    sameApprovalQuorumTaskSnapshot(confirmation.quorum, selected.quorum)
  );

  const assertCurrentAuthority = (
    input: {
      taskId: string;
      expectedVersion: number;
      scopeIdentity: string;
      quorum?: ApprovalQuorumTaskSnapshot | null;
    },
    kind: 'claim' | 'decide' | 'read'
  ) => {
    const queueState = queryClient.getQueryState(tasks.queryKey);
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
      !tasksReady ||
      queueState?.status !== 'success' ||
      queueState.fetchStatus !== 'idle' ||
      queueState.fetchFailureCount > 0 ||
      taskState?.status !== 'success' ||
      taskState.fetchStatus !== 'idle' ||
      taskState.fetchFailureCount > 0 ||
      latest?.task.taskId !== input.taskId ||
      latest.task.version !== input.expectedVersion ||
      !hasApprovalTaskContentAccess(latest) ||
      !Number.isSafeInteger(input.expectedVersion) ||
      input.expectedVersion < 0 ||
      (kind === 'claim'
        ? !latest.canClaim
        : kind === 'decide'
          ? !latest.canDecide ||
            latest.selfApprovalBlocked ||
            !sameApprovalQuorumTaskSnapshot(input.quorum, latest.quorum)
          : selectedTaskIdRef.current !== input.taskId)
    ) {
      throw new Error('approval authority changed');
    }
  };

  useEffect(() => {
    setConfirmation(undefined);
    setDecisionRecovery(undefined);
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
      queryClient.invalidateQueries({ queryKey: ['approvals', 'command-queue-counts'] }),
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
    mutationFn: async (input: {
      taskId: string;
      decision: ApprovalDecisionKind;
      comment?: string;
      expectedVersion: number;
      scopeIdentity: string;
      quorum?: ApprovalQuorumTaskSnapshot | null;
    }) => {
      const latest = await getApprovalTask(input.taskId, requestScope.contextScopeKey);
      if (scopeIdentityRef.current !== input.scopeIdentity) throw new Error('scope changed');
      queryClient.setQueryData(
        ['approvals', 'command-task', input.taskId, ...requestScope.cacheKey],
        latest
      );
      if (
        latest.task.taskId !== input.taskId ||
        latest.task.version !== input.expectedVersion ||
        !sameApprovalQuorumTaskSnapshot(input.quorum, latest.quorum)
      ) {
        throw new HttpError('approval task version changed', 409);
      }
      if (
        !hasApprovalTaskContentAccess(latest) ||
        !latest.canDecide ||
        latest.selfApprovalBlocked
      ) {
        throw new HttpError('approval decision authority changed', 403);
      }
      return runDecision((execution) => {
        assertCurrentAuthority(input, 'decide');
        return decideApprovalTask(
          input.taskId,
          {
            decision: input.decision,
            comment: input.comment,
            expectedVersion: input.expectedVersion,
            quorum: approvalQuorumVotePrecondition(input.quorum),
          },
          execution
        );
      });
    },
    onSuccess: async (_result, input) => {
      if (scopeIdentityRef.current !== input.scopeIdentity) return;
      setConfirmation(undefined);
      setDecisionRecovery(undefined);
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
      setConfirmation(undefined);
      setDecisionRecovery({
        kind:
          error instanceof HttpError && error.status === 409
            ? 'CONFLICT'
            : error instanceof HttpError && error.status === 403
              ? 'DENIED'
              : 'UNAVAILABLE',
        command: 'DECISION',
        decision: input.decision,
        taskId: input.taskId,
      });
      toast.error(t('inbox.decisionError'));
    },
  });

  const claim = useMutation({
    mutationFn: async (input: {
      taskId: string;
      expectedVersion: number;
      scopeIdentity: string;
    }) => {
      const latest = await getApprovalTask(input.taskId, requestScope.contextScopeKey);
      if (scopeIdentityRef.current !== input.scopeIdentity) throw new Error('scope changed');
      queryClient.setQueryData(
        ['approvals', 'command-task', input.taskId, ...requestScope.cacheKey],
        latest
      );
      if (latest.task.taskId !== input.taskId || latest.task.version !== input.expectedVersion) {
        throw new HttpError('approval task version changed', 409);
      }
      if (!hasApprovalTaskContentAccess(latest) || !latest.canClaim) {
        throw new HttpError('approval claim authority changed', 403);
      }
      return runClaim((execution) => {
        assertCurrentAuthority(input, 'claim');
        return claimApprovalTask(input.taskId, input.expectedVersion, execution);
      });
    },
    onSuccess: async (claimed, input) => {
      if (scopeIdentityRef.current !== input.scopeIdentity) return;
      setDecisionRecovery(undefined);
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
      setDecisionRecovery({
        kind:
          error instanceof HttpError && error.status === 409
            ? 'CONFLICT'
            : error instanceof HttpError && error.status === 403
              ? 'DENIED'
              : 'UNAVAILABLE',
        command: 'CLAIM',
        taskId: input.taskId,
      });
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
          await runDecision((execution) => {
            assertCurrentAuthority(
              {
                taskId: latest.task.taskId,
                expectedVersion: latest.task.version,
                scopeIdentity: input.scopeIdentity,
                quorum: latest.quorum,
              },
              'decide'
            );
            return decideApprovalTask(
              latest.task.taskId,
              {
                decision: 'APPROVE',
                expectedVersion: latest.task.version,
                quorum: approvalQuorumVotePrecondition(latest.quorum),
              },
              execution
            );
          });
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
    setMobileSelectionMode(false);
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
  const selectionMode = !mobile || mobileSelectionMode;
  const activeDecisionRecovery =
    decisionRecovery?.taskId === selectedTaskId ? decisionRecovery : undefined;
  const displayedSelection =
    selected && activeDecisionRecovery
      ? { ...selected, canClaim: false, canDecide: false }
      : selected;
  const cachedDocumentDetail =
    detail.data?.task.taskId === selectedTaskId ? detail.data : undefined;
  const assertDocumentCurrent = () => {
    const queue = queryClient.getQueryState(tasks.queryKey);
    const current = queryClient.getQueryState<ApprovalTaskDetail>([
      'approvals',
      'command-task',
      selectedTaskId,
      ...requestScope.cacheKey,
    ]);
    const latest = current?.data;
    if (
      !requestScope.ready ||
      scopeIdentityRef.current !== scopeIdentity ||
      selectedTaskIdRef.current !== selectedTaskId ||
      !cachedDocumentDetail ||
      !Number.isSafeInteger(cachedDocumentDetail.task.version) ||
      cachedDocumentDetail.task.version < 0 ||
      activeDecisionRecovery ||
      queue?.status !== 'success' ||
      queue.error ||
      queue.fetchStatus !== 'idle' ||
      queue.fetchFailureCount > 0 ||
      current?.status !== 'success' ||
      current.error ||
      current.fetchStatus !== 'idle' ||
      current.fetchFailureCount > 0 ||
      !latest ||
      latest.task.taskId !== selectedTaskId ||
      latest.task.version !== cachedDocumentDetail.task.version ||
      latest.task.requestId !== cachedDocumentDetail.task.requestId ||
      !hasApprovalTaskContentAccess(latest)
    )
      throw new HttpError('approval document source unavailable', 409);
  };
  const taskDocuments = useApprovalTaskDocuments(cachedDocumentDetail, assertDocumentCurrent, {
    taskId: selectedTaskId,
    ready: Boolean(selected && !activeDecisionRecovery),
    error:
      [detail.failureReason, detail.error, tasks.failureReason, tasks.error].find(
        (error) => error instanceof HttpError && [401, 403, 404].includes(error.status)
      ) ??
      detail.failureReason ??
      detail.error ??
      tasks.failureReason ??
      tasks.error,
    refreshOwner: async () => {
      const expectedId = selectedTaskId;
      const expectedScope = scopeIdentity;
      const queue = await tasks.refetch();
      if (selectedTaskIdRef.current !== expectedId || scopeIdentityRef.current !== expectedScope)
        throw new HttpError('approval document identity changed', 409);
      if (!queue.isSuccess || queue.error)
        throw queue.error ?? new HttpError('approval queue refresh failed', 503);
      const refreshed = await detail.refetch();
      if (selectedTaskIdRef.current !== expectedId || scopeIdentityRef.current !== expectedScope)
        throw new HttpError('approval document identity changed', 409);
      if (!refreshed.isSuccess || refreshed.error || !refreshed.data)
        throw refreshed.error ?? new HttpError('approval document refresh failed', 503);
      return refreshed.data;
    },
  });
  const checkedAt = tasks.pageInfo?.evaluatedAt
    ? formatDate(tasks.pageInfo.evaluatedAt, {
        hour: '2-digit',
        minute: '2-digit',
      })
    : undefined;

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
            <Typography
              id="approval-command-center-title"
              component="h2"
              variant="subtitle1"
              tabIndex={-1}
              data-approval-command-center-heading
            >
              {t('home.commandCenter.title')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('home.commandCenter.description')}
            </Typography>
            {tasks.data && (
              <Typography
                component="p"
                variant="caption"
                color="text.secondary"
                role="status"
                aria-live="polite"
                sx={{ mt: 0.25 }}
              >
                {t('home.commandCenter.queueContext', {
                  queue: t(`home.commandCenter.filters.${filter}`),
                  count: tasks.pageInfo?.totalElements ?? visibleTasks.length,
                  checkedAt: checkedAt ?? t('home.commandCenter.checkingFreshness'),
                })}
              </Typography>
            )}
          </Box>
        </Stack>
        <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
          {returnTarget && (
            <ActionButton
              intent="quiet"
              size="small"
              startIcon={<ArrowLeft size={16} />}
              onClick={returnToWork}
            >
              {t('common:productSurface.actions.returnToWork')}
            </ActionButton>
          )}
          <ActionButton
            intent="quiet"
            size="small"
            startIcon={<RefreshCw size={16} />}
            disabled={tasks.isFetching || busy}
            onClick={() => void tasks.refetch()}
          >
            {t('actions.refresh')}
          </ActionButton>
          {mobile && showQueue && (
            <ActionButton
              intent={mobileSelectionMode ? 'secondary' : 'quiet'}
              size="small"
              startIcon={mobileSelectionMode ? <X size={16} /> : <ListPlus size={16} />}
              disabled={busy || !tasksReady}
              aria-pressed={mobileSelectionMode}
              onClick={() => {
                setMobileSelectionMode((current) => {
                  if (current) setSelectedBatchIds([]);
                  return !current;
                });
              }}
            >
              {t(
                mobileSelectionMode
                  ? 'home.commandCenter.cancelSelection'
                  : 'home.commandCenter.startSelection'
              )}
            </ActionButton>
          )}
          {selectionMode && (
            <>
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
            </>
          )}
        </Stack>
      </Stack>

      {batchResult && tasks.data && (
        <ApprovalBatchResultPanel
          result={batchResult}
          tasks={tasks.data}
          onDismiss={() => setBatchResult(undefined)}
        />
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
              selectionMode={selectionMode}
              onSearchChange={changeSearch}
              totalElements={tasks.pageInfo?.totalElements ?? 0}
              page={page}
              totalPages={tasks.pageInfo?.totalPages ?? 0}
              sort={sort}
              status={status}
              onPageChange={(value) => changeListParameters({ page: String(value) })}
              onSortChange={(value) => changeListParameters({ sort: value, page: '0' })}
              onStatusChange={(value) => changeListParameters({ status: value, page: '0' })}
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
            {activeDecisionRecovery && (
              <ApprovalDecisionRecoveryNotice
                recovery={activeDecisionRecovery}
                busy={detail.isFetching}
                onRecover={async () => {
                  const refreshed = await detail.refetch();
                  if (!refreshed.isSuccess || !refreshed.data) return;
                  setDecisionRecovery(undefined);
                  if (
                    activeDecisionRecovery.command === 'DECISION' &&
                    activeDecisionRecovery.kind === 'CONFLICT' &&
                    activeDecisionRecovery.decision &&
                    refreshed.data.canDecide &&
                    !refreshed.data.selfApprovalBlocked
                  ) {
                    setConfirmation({
                      decision: activeDecisionRecovery.decision,
                      taskId: refreshed.data.task.taskId,
                      expectedVersion: refreshed.data.task.version,
                      quorum: readApprovalQuorumTaskSnapshot(refreshed.data.quorum),
                      scopeIdentity,
                    });
                  }
                }}
              />
            )}
            <ApprovalDecisionDetail
              detail={displayedSelection}
              loading={Boolean(selectedTaskId) && (detail.isFetching || tasks.isFetching)}
              error={
                Boolean(selectedTaskId) &&
                (detail.isError || detail.failureCount > 0 || tasks.failureCount > 0)
              }
              mobile={mobile}
              decisionBusy={decide.isPending || batchApprove.isPending}
              claimBusy={claim.isPending}
              verifiedAt={detail.dataUpdatedAt}
              onRevalidateDocument={async () => {
                if (!selected || activeDecisionRecovery)
                  throw new Error('approval document unavailable');
                const expected = {
                  taskId: selected.task.taskId,
                  expectedVersion: selected.task.version,
                  quorum: readApprovalQuorumTaskSnapshot(selected.quorum),
                  scopeIdentity,
                };
                assertCurrentAuthority(expected, 'read');
                const refreshed = await detail.refetch();
                if (!refreshed.isSuccess || !refreshed.data)
                  throw new Error('approval document refresh failed');
                assertCurrentAuthority(expected, 'read');
                return refreshed.data;
              }}
              documents={taskDocuments}
              onBack={backToQueue}
              onRetry={() => void detail.refetch()}
              onClaim={() => {
                if (!selected || activeDecisionRecovery) return;
                claim.mutate({
                  taskId: selected.task.taskId,
                  expectedVersion: selected.task.version,
                  scopeIdentity,
                });
              }}
              onDecision={(kind) => {
                if (
                  !selected ||
                  activeDecisionRecovery ||
                  !selected.canDecide ||
                  selected.selfApprovalBlocked
                )
                  return;
                setConfirmation({
                  decision: kind,
                  taskId: selected.task.taskId,
                  expectedVersion: selected.task.version,
                  quorum: readApprovalQuorumTaskSnapshot(selected.quorum),
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
