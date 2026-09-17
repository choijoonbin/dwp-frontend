import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ActionButton, LoadingState } from '@dwp-frontend/design-system';
import {
  HttpError,
  type ApprovalTaskDetail,
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

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

import {
  executeSequentialApprovalBatch,
  hasApprovalTaskContentAccess,
  mergeApprovalBatchRetryResult,
  parseApprovalQueueFilter,
  approvalScopeIdentity,
  toggleApprovalBatchSelection,
} from './approval-command-center-model';
import { ApprovalCommandTaskList } from './approval-command-task-list';
import { ApprovalCommandBatchResult } from './approval-command-batch-result';
import {
  approvalBatchEligibleTaskIds,
  mergeApprovalBatchPreflightResult,
  type ApprovalBatchPreflight,
} from './approval-batch-preflight';
import { ApprovalDecisionDetail, type ApprovalDecisionKind } from './approval-decision-detail';
import {
  ApprovalCommandCenterDialogs,
  ApprovalCommandCenterHeader,
} from './approval-command-center-presentation';
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
import { useApprovalBatchPreflight } from './use-approval-batch-preflight';

import type {
  ApprovalBatchResult,
  ApprovalDecisionConfirmation,
  ApprovalQueueFilter,
} from './approval-command-center-model';

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
  const commandCenterRef = useRef<HTMLDivElement>(null);
  const detailPaneRef = useRef<HTMLDivElement>(null);
  const nowMs = useApprovalQueueClock();

  const [search, setSearch] = useState(searchParams.get('query') ?? '');
  const [selectedTaskId, setSelectedTaskId] = useState<string>();
  const selectedTaskIdRef = useRef(selectedTaskId);
  selectedTaskIdRef.current = selectedTaskId;
  const [mobileQueueMode, setMobileQueueMode] = useState(false);
  const [mobileSelectionMode, setMobileSelectionMode] = useState(false);
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const [confirmation, setConfirmation] = useState<ApprovalDecisionConfirmation>();
  const [decisionRecovery, setDecisionRecovery] = useState<ApprovalDecisionRecovery>();
  const decision = confirmation?.decision;
  const [comment, setComment] = useState('');
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [batchResult, setBatchResult] = useState<ApprovalBatchResult>();
  const [desktopWorkspaceHeight, setDesktopWorkspaceHeight] = useState<number>();

  useEffect(() => {
    if (mobile) {
      setDesktopWorkspaceHeight(undefined);
      return undefined;
    }
    let frame = 0;
    const measure = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const top = commandCenterRef.current?.getBoundingClientRect().top;
        if (top === undefined) return;
        setDesktopWorkspaceHeight(Math.max(520, Math.floor(window.innerHeight - top - 24)));
      });
    };
    measure();
    window.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('resize', measure);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', measure);
      window.visualViewport?.removeEventListener('resize', measure);
    };
  }, [mobile]);

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
  const batch = useApprovalBatchPreflight({
    selectedTaskIds: selectedBatchIds,
    queueTasks: visibleTasks,
    open: batchDialogOpen,
    sourceReady: tasksReady,
    requestScope,
  });
  const batchPreflight = batch.preflight;
  const batchPreflightRefreshing = batch.refreshing;
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
      quorum?: ApprovalDecisionConfirmation['quorum'];
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
      quorum?: ApprovalDecisionConfirmation['quorum'];
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
    mutationFn: async (input: {
      taskIds: readonly string[];
      scopeIdentity: string;
      previousResult?: ApprovalBatchResult;
      preflight?: ApprovalBatchPreflight;
    }) => {
      if (input.previousResult) {
        const latestQueue = await tasks.refetch();
        if (scopeIdentityRef.current !== input.scopeIdentity) throw new Error('scope changed');
        if (!latestQueue.isSuccess || latestQueue.error)
          throw latestQueue.error ?? new HttpError('approval queue refresh failed', 503);
      }
      const attempt = await executeSequentialApprovalBatch({
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
      });
      if (input.previousResult) return mergeApprovalBatchRetryResult(input.previousResult, attempt);
      return input.preflight
        ? mergeApprovalBatchPreflightResult(input.preflight, attempt)
        : attempt;
    },
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
      ref={commandCenterRef}
      component="section"
      variant="outlined"
      aria-labelledby="approval-command-center-title"
      sx={{
        overflow: 'hidden',
        display: { md: 'flex' },
        flexDirection: 'column',
        height: {
          md: desktopWorkspaceHeight ? `${desktopWorkspaceHeight}px` : 'calc(100dvh - 208px)',
        },
        minHeight: { md: 520 },
      }}
    >
      <ApprovalCommandCenterHeader
        filter={filter}
        hasQueueData={Boolean(tasks.data)}
        queueCount={tasks.pageInfo?.totalElements ?? visibleTasks.length}
        checkedAt={checkedAt}
        returnAvailable={Boolean(returnTarget)}
        refreshDisabled={tasks.isFetching || busy}
        mobile={mobile}
        showQueue={showQueue}
        mobileSelectionMode={mobileSelectionMode}
        selectionMode={selectionMode}
        selectedCount={selectedBatchIds.length}
        batchDisabled={selectedBatchIds.length === 0 || busy || !tasksReady}
        onReturn={returnToWork}
        onRefresh={() => void tasks.refetch()}
        onToggleMobileSelection={() => {
          setMobileSelectionMode((current) => {
            if (current) setSelectedBatchIds([]);
            return !current;
          });
        }}
        onOpenBatch={() => setBatchDialogOpen(true)}
      />

      {batchResult && tasks.data && (
        <Box sx={{ flex: '0 1 auto', maxHeight: { md: '34%' }, overflowY: { md: 'auto' } }}>
          <ApprovalCommandBatchResult
            result={batchResult}
            tasks={tasks.data}
            retrying={batchApprove.isPending}
            onRetry={(taskIds, previousResult) => {
              batchApprove.mutate({
                taskIds,
                scopeIdentity,
                previousResult,
              });
            }}
            onOpenTask={selectTask}
            onDismiss={() => setBatchResult(undefined)}
          />
        </Box>
      )}

      {tasks.isError ? (
        <Box role="alert" sx={{ flex: 1, px: 3, py: 6, textAlign: 'center' }}>
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
        <Box sx={{ minHeight: { xs: 620, md: 0 }, flex: 1, display: 'grid', placeItems: 'center' }}>
          <LoadingState label={t('common:labels.loading')} size="page" embedded />
        </Box>
      ) : (
        <Box
          sx={{
            flex: { md: '1 1 auto' },
            minHeight: { md: 0 },
            display: 'grid',
            gridTemplateAreas: {
              xs: '"list" "detail"',
              md: '"list detail"',
            },
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              md: 'minmax(300px, 38%) minmax(0, 1fr)',
              xl: 'minmax(360px, 36%) minmax(0, 1fr)',
            },
            gridTemplateRows: { md: 'minmax(0, 1fr)' },
          }}
        >
          <Box
            sx={{
              gridArea: 'list',
              display: showQueue ? 'block' : 'none',
              minWidth: 0,
              minHeight: { md: 0 },
              height: { md: '100%' },
              overflow: { md: 'hidden' },
            }}
          >
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
              display: showDetail ? { xs: 'block', md: 'flex' } : 'none',
              minWidth: 0,
              minHeight: { md: 0 },
              height: { md: '100%' },
              overflow: { md: 'hidden' },
              flexDirection: 'column',
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
            <Box sx={{ minHeight: { md: 0 }, flex: { md: '1 1 auto' } }}>
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
                    throw new Error('approval refresh failed');
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
        </Box>
      )}

      <ApprovalCommandCenterDialogs
        decisionOpen={Boolean(confirmation && confirmationReady)}
        decision={decision}
        decisionTarget={selected}
        verifiedAt={detail.dataUpdatedAt}
        comment={comment}
        decisionBusy={decide.isPending}
        decisionSubmitDisabled={
          !confirmationReady || (decision !== 'APPROVE' && comment.trim().length < 8)
        }
        batchOpen={batchDialogOpen}
        batchSelectedCount={selectedBatchIds.length}
        batchEligibleCount={batchPreflight.eligibleCount}
        batchBusy={batchApprove.isPending}
        batchSubmitDisabled={
          !tasksReady ||
          batchPreflightRefreshing ||
          batchPreflight.recheckCount > 0 ||
          batchPreflight.eligibleCount === 0
        }
        batchPreflight={batchPreflight}
        batchPreflightRefreshing={batchPreflightRefreshing}
        onDecisionClose={() => setConfirmation(undefined)}
        onCommentChange={setComment}
        onDecisionSubmit={() => {
          if (!confirmation || !confirmationReady || decide.isPending) return;
          decide.mutate({ ...confirmation, comment: comment.trim() || undefined });
        }}
        onBatchClose={() => setBatchDialogOpen(false)}
        onBatchSubmit={() => {
          if (
            !tasksReady ||
            batchApprove.isPending ||
            batchPreflightRefreshing ||
            batchPreflight.recheckCount > 0
          )
            return;
          const taskIds = approvalBatchEligibleTaskIds(batchPreflight);
          if (taskIds.length === 0) return;
          batchApprove.mutate({ taskIds, scopeIdentity, preflight: batchPreflight });
        }}
        onBatchRefresh={() => {
          void Promise.all([tasks.refetch(), batch.refetch()]);
        }}
      />
    </Paper>
  );
}
