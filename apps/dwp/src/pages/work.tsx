import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import {
  ActionButton,
  GuidedEmptyState,
  LoadingState,
  LocalErrorState,
  PageCanvas,
  mergeFilterSearchParams,
  useDateTimePolicy,
} from '@dwp-frontend/design-system';
import { resolveZonedDateKey } from '@dwp-frontend/shared-i18n';
import { workspaceWorkFreshness } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import useMediaQuery from '@mui/material/useMediaQuery';

import {
  MailProposalOwnerHandoffNotice,
  useMailProposalOwnerHandoff,
} from '../components/mail-proposal-owner-handoff';
import { AccessReviewWorkItem } from '../features/work/access-review-work-item';
import { useWorkClock } from '../features/work/use-work-clock';
import { useWorkHubActivityReturn } from '../features/work-hub/use-work-hub-activity-return';
import { useWorkHubActions } from '../features/work-hub/use-work-hub-actions';
import { WorkHubAssignmentDetail } from '../features/work-hub/work-hub-assignment-detail';
import { useWorkHubBatch } from '../features/work-hub/use-work-hub-batch';
import { useWorkHubCreatedTaskRecovery } from '../features/work-hub/use-work-hub-created-task-recovery';
import { useWorkHubPlanSave } from '../features/work-hub/use-work-hub-plan-save';
import { useWorkHubRuntime } from '../features/work-hub/use-work-hub-runtime';
import { WorkHubSelectionToolbar } from '../features/work-hub/work-hub-selection-toolbar';
import { WorkHubPageHeader } from '../features/work-hub/work-hub-page-header';
import { useWorkHubTaskSave } from '../features/work-hub/use-work-hub-task-save';
import { useWorkHubReturnHandoff } from '../features/work-hub/use-work-hub-return-handoff';
import { useWorkHubCalendarHandoff } from '../features/work-hub/use-work-hub-calendar-handoff';
import { useWorkHubServiceResponse } from './use-work-hub-service-response';
import { WorkHubAssistPanel } from '../features/work-hub/work-hub-assist-dialog';
import { selectedWorkConversationRoute } from '@dwp-frontend/shared-utils/api/agent-selected-work-api';
import { WorkHubRecoveryDialogs } from '../features/work-hub/work-hub-recovery-dialogs';
import type { WorkHubItem } from '../features/work-hub/work-hub-contracts';
import { WorkHubDetailPanel } from '../features/work-hub/work-hub-detail-panel';
import { WorkHubFilterControls } from '../features/work-hub/work-hub-filter-controls';
import { WorkHubList } from '../features/work-hub/work-hub-list';
import { WorkHubNoSelection } from '../features/work-hub/work-hub-no-selection';
import { WorkHubMobileEmptyCapture } from '../features/work-hub/work-hub-mobile-empty-capture';
import {
  canExecuteWorkHubAction,
  canUnlinkWorkSchedule,
  canUseWorkHubGenericAdjunct,
  isWorkHubItemCommandReady,
  isWorkHubSourceCommandReady,
  workHubCommandScope,
} from '../features/work-hub/work-hub-command-authority';
import {
  dayPlanHasReference,
  resolveDayPlanReferences,
  selectWorkHubDetail,
  selectWorkHubItems,
} from '../features/work-hub/work-hub-model';
import {
  WorkHubPageNotices,
  workHubPartialCopy,
} from '../features/work-hub/work-hub-partial-notice';
import { WorkHubPersonalDetail } from '../features/work-hub/work-hub-personal-detail';
import {
  canUseWorkAssist,
  selectedWorkFromRequest,
  shouldShowWorkAssignmentRoleFilter,
  submitWorkHubAssist,
  uniqueWorkSourceSystems,
  verifiedWorkHubSnapshotFromRefetch,
  workHubSelectionRequest,
  type WorkHubOperationFeedback,
} from '../features/work-hub/work-hub-page-helpers';
import { WorkHubScheduleLinks } from '../features/work-hub/work-hub-schedule-links';
import { workScheduleLookupRange } from '../features/work-hub/work-hub-scheduling';
import { WorkHubSourceOwnedDetail } from '../features/work-hub/work-hub-source-owned-detail';
import {
  WorkHubScheduleExecutionDialog,
  WorkHubTaskEditorDialog,
} from '../features/work-hub/work-hub-page-dialogs';
import {
  useClearWorkTaskComposeIntent,
  useWorkMessengerCapture,
} from '../features/work-hub/use-work-messenger-capture';
import { useWorkMobileQueueRestore } from '../features/work-hub/use-work-mobile-queue-restore';
import { WorkTodayPlanPanel } from '../features/work-hub/work-today-plan-panel';
import {
  WORK_HUB_VIEWS,
  workHubFiltersForPath,
  workHubPathForScope,
  workHubViewFromPath,
} from '../features/work-hub/work-hub-view-navigation';
import type { WorkLayoutContext } from '../layouts/work-layout';
import type { PersonalWorkTask } from '@dwp-frontend/shared-utils/api/personal-work-contracts';

export default function WorkPage() {
  const { t, i18n } = useTranslation(['work', 'common']);
  const now = useWorkClock();
  const { timeZone } = useDateTimePolicy();
  const narrowViewport = useMediaQuery('(max-width:899.95px)');
  const navigate = useNavigate();
  const location = useLocation();
  const { setWorkNavigationState, availableWidth, scheduleCoordinator, taskSaveCoordinator } =
    useOutletContext<WorkLayoutContext | undefined>() ?? {};
  const mobile = availableWidth === undefined ? narrowViewport : availableWidth < 900;
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const proposalOwnerHandoff = useMailProposalOwnerHandoff('WORK');
  const runtime = useWorkHubRuntime();
  const { query, controller, owner } = runtime;
  const snapshot = query.data?.snapshot;
  const workCommandsReady = Boolean(snapshot && snapshot.completeness !== 'UNAVAILABLE');
  const canCreate = runtime.canUpdatePersonal && isWorkHubSourceCommandReady(snapshot, 'personal');
  const taskCreationEnabled = canCreate && !proposalOwnerHandoff.blocksSubmission;
  const messenger = useWorkMessengerCapture(
    location.state,
    owner,
    now,
    canCreate,
    searchParams.get('compose') === 'task'
  );
  const messengerSource = messenger.source;
  const canSchedule =
    runtime.canUpdatePersonal && runtime.canCreateCalendarEvent && workCommandsReady;
  const filters = workHubFiltersForPath(location.pathname, searchParams);
  const view = workHubViewFromPath(location.pathname);
  const requestedSort = searchParams.get('sort');
  const sort = ['due', 'updated', 'title'].includes(requestedSort ?? '')
    ? requestedSort!
    : 'urgency';
  const density = searchParams.get('density') === 'comfortable' ? 'comfortable' : 'compact';
  const { selectionRequest, requested } = workHubSelectionRequest(searchParams);
  const composeTaskRequested = messenger.composeTaskRequested;
  const clearTaskComposeIntent = useClearWorkTaskComposeIntent({
    envelope: messenger.envelope,
    hash: location.hash,
    navigate,
    pathname: location.pathname,
    searchParams,
    state: location.state,
  });
  const sourcePanelRequested = searchParams.get('panel') === 'sources';
  const today = resolveZonedDateKey(now, timeZone) ?? new Date(now).toISOString().slice(0, 10);
  const [checkedKeys, setCheckedKeys] = useState<Set<string>>(new Set());
  const [feedback, setFeedback] = useState<WorkHubOperationFeedback | null>(null);
  const [sourceDialogOpen, setSourceDialogOpen] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<PersonalWorkTask | null>(null);
  const planOpen = view === 'day-plan';
  const [planSaving, setPlanSaving] = useState(false);
  const [planDraft, setPlanDraft] = useState<ReturnType<typeof controller.state>['planDraft']>([]);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [scheduleSelection, setScheduleSelection] = useState<{
    owner: string;
    item: WorkHubItem;
  } | null>(null);
  const scheduleItem =
    scheduleSelection?.owner === owner
      ? (snapshot?.items.find(
          (candidate) =>
            workHubCommandScope(candidate) === workHubCommandScope(scheduleSelection.item)
        ) ?? null)
      : null;
  const [assistItem, setAssistItem] = useState<WorkHubItem | null>(null);
  const { lastMobileSelection, queueScroll, queueScrollTop, restoreQueueFocus } =
    useWorkMobileQueueRestore({ mobile, requested });
  const selectionContext = `${location.pathname}|${filters.query}|${filters.sourceSystem ?? ''}|${filters.urgency ?? ''}|${filters.assignmentRole ?? ''}`;
  const previousSelectionContext = useRef(selectionContext);
  const planLoadOwner = useRef<typeof controller | null>(null);
  useEffect(() => {
    if (previousSelectionContext.current === selectionContext) return;
    previousSelectionContext.current = selectionContext;
    setCheckedKeys(new Set());
  }, [selectionContext]);
  useEffect(() => {
    if (snapshot) controller.adopt(snapshot);
  }, [controller, snapshot]);
  useEffect(() => {
    if (!snapshot) return;
    const currentKeys = new Set(snapshot.items.map((item) => item.key));
    setCheckedKeys((current) => {
      const next = new Set([...current].filter((key) => currentKeys.has(key)));
      return next.size === current.size ? current : next;
    });
  }, [snapshot]);
  useEffect(() => {
    if (
      !snapshot ||
      (planLoadOwner.current === controller && controller.state().plan?.date === today)
    ) {
      return;
    }
    let active = true;
    planLoadOwner.current = controller;
    setPlanLoading(true);
    controller
      .loadPlan(today)
      .then(() => {
        if (!active) return;
        setPlanDraft(controller.state().planDraft);
        setPlanError(null);
      })
      .catch(() => {
        if (active) {
          planLoadOwner.current = null;
          setPlanError(t('work:workHub.todayPlan.loadFailed'));
        }
      })
      .finally(() => {
        if (active) setPlanLoading(false);
      });
    return () => {
      active = false;
    };
  }, [controller, snapshot, t, today]);
  const loadedPlan = controller.state().plan;
  const todayPlanReferences = useMemo(
    () => resolveDayPlanReferences(loadedPlan, planDraft),
    [loadedPlan, planDraft]
  );
  const visibleItems = useMemo(() => {
    const items = snapshot ? selectWorkHubItems(snapshot, filters, now, todayPlanReferences) : [];
    if (sort === 'due')
      items.sort(
        (a, b) => (Date.parse(a.dueAt ?? '') || Infinity) - (Date.parse(b.dueAt ?? '') || Infinity)
      );
    if (sort === 'updated')
      items.sort(
        (a, b) => (Date.parse(b.updatedAt ?? '') || 0) - (Date.parse(a.updatedAt ?? '') || 0)
      );
    if (sort === 'title') items.sort((a, b) => a.title.localeCompare(b.title));
    return items;
  }, [filters, now, snapshot, todayPlanReferences, sort]);
  const scopeCounts = useMemo(
    () =>
      Object.fromEntries(
        WORK_HUB_VIEWS.map(({ scope }) => [
          scope,
          snapshot
            ? selectWorkHubItems(
                snapshot,
                { scope, query: '', sourceSystem: null, urgency: null, assignmentRole: null },
                now,
                todayPlanReferences
              ).length
            : 0,
        ])
      ),
    [snapshot, now, todayPlanReferences]
  );
  useEffect(() => {
    setWorkNavigationState?.({
      counts: Object.fromEntries(
        WORK_HUB_VIEWS.map(({ view, scope }) => [view, scopeCounts[scope]])
      ),
      incomplete: snapshot?.completeness !== 'COMPLETE',
      readySources: snapshot?.sources.filter((source) => source.state === 'READY').length ?? 0,
      requestedSources:
        snapshot?.sources.filter((source) => source.state !== 'NOT_REQUESTED').length ?? 0,
    });
  }, [setWorkNavigationState, scopeCounts, snapshot]);
  useEffect(() => {
    if (composeTaskRequested) {
      setEditingTask(null);
      setTaskDialogOpen(true);
    } else {
      setTaskDialogOpen(false);
    }
  }, [composeTaskRequested]);
  useEffect(() => {
    if (messenger.envelope && (!messenger.capture || !messenger.composeTaskRequested)) {
      clearTaskComposeIntent();
    }
  }, [
    clearTaskComposeIntent,
    messenger.capture,
    messenger.composeTaskRequested,
    messenger.envelope,
  ]);
  useEffect(() => {
    setSourceDialogOpen(sourcePanelRequested);
  }, [sourcePanelRequested]);
  const explicitSelection = snapshot
    ? selectedWorkFromRequest(snapshot.items, selectionRequest)
    : undefined;
  const detailSelection = snapshot
    ? selectWorkHubDetail(
        snapshot,
        explicitSelection?.key ?? (mobile ? null : requested),
        visibleItems
      )
    : ({ state: 'EMPTY' } as const);
  const selectedItem =
    explicitSelection ??
    (!mobile && detailSelection.state === 'SELECTED' ? detailSelection.item : undefined);
  const serviceResponse = useWorkHubServiceResponse({
    owner,
    item: selectedItem,
    onConfirmed: () => void query.refetch(),
  });
  const openActivity = useWorkHubActivityReturn(selectedItem, Boolean(snapshot), query.refetch);
  const showMobileDetail = mobile && Boolean(requested);
  const assistActive = Boolean(
    assistItem &&
    selectedItem?.key === assistItem.key &&
    canUseWorkAssist(selectedItem, runtime.canUseAssist)
  );
  useEffect(() => {
    if (assistItem && !assistActive) setAssistItem(null);
  }, [assistItem, assistActive]);
  const sourceSystems = uniqueWorkSourceSystems(snapshot?.items ?? []);
  const showAssignmentRoleFilter = shouldShowWorkAssignmentRoleFilter(
    snapshot,
    runtime.enabledSources
  );
  const partialCopy = snapshot ? workHubPartialCopy(snapshot) : null;
  const scheduleRange = useMemo(() => workScheduleLookupRange(today), [today]);
  const { openCalendar, continueWorkInCalendar } = useWorkHubCalendarHandoff({
    owner,
    date: today,
    now,
    onFeedback: setFeedback,
  });
  const openSource = useWorkHubReturnHandoff({
    itemKey: selectedItem?.key ?? null,
    ready: Boolean(snapshot),
    refetch: query.refetch,
  });
  const refreshWorkSnapshot = () => query.refetch().then(verifiedWorkHubSnapshotFromRefetch);
  const setFilters = (values: Record<string, string | null>) => {
    setCheckedKeys(new Set());
    if (values.scope) {
      const { scope, ...refinements } = values;
      navigate({
        pathname: workHubPathForScope(scope as typeof filters.scope),
        search: mergeFilterSearchParams(searchParams, {
          ...refinements,
          scope: null,
          work: null,
          item: null,
          personalTaskId: null,
        }).toString(),
      });
      return;
    }
    setSearchParams(
      mergeFilterSearchParams(searchParams, {
        ...values,
        work: null,
        item: null,
        personalTaskId: null,
      }),
      { replace: true }
    );
  };
  const openItem = (item: WorkHubItem, focusToken?: string) => {
    setAssistItem(null);
    serviceResponse.clear();
    lastMobileSelection.current = focusToken ?? null;
    queueScrollTop.current = queueScroll.current?.scrollTop ?? window.scrollY;
    controller.select(item.reference);
    setSearchParams(
      mergeFilterSearchParams(searchParams, {
        work: item.key,
        item: null,
        personalTaskId: null,
      }),
      { replace: true }
    );
  };
  const backToQueue = () => {
    restoreQueueFocus.current = true;
    serviceResponse.clear();
    setSearchParams(
      mergeFilterSearchParams(searchParams, { work: null, item: null, personalTaskId: null }),
      { replace: true }
    );
  };
  const action = useWorkHubActions({
    owner,
    snapshot,
    controller,
    onFeedback: setFeedback,
    onHandoff: (item, route) => openSource(item, route, 'SOURCE'),
    refresh: refreshWorkSnapshot,
    mutationCoordinator: taskSaveCoordinator,
  });
  const batch = useWorkHubBatch({
    snapshot,
    checkedKeys,
    clearSelection: () => setCheckedKeys(new Set()),
    onFeedback: setFeedback,
    refresh: refreshWorkSnapshot,
  });
  const savePlan = useWorkHubPlanSave({
    owner,
    snapshot,
    controller,
    enabled: canCreate,
    preflight: refreshWorkSnapshot,
    mutationCoordinator: taskSaveCoordinator,
  });
  const saveTask = useWorkHubTaskSave({
    controller,
    snapshot,
    editingTask,
    today,
    taskSaveCoordinator,
    enabled: taskCreationEnabled,
    proposalBinding: proposalOwnerHandoff.binding,
    preflight: refreshWorkSnapshot,
    onTaskClosed: () => {
      setTaskDialogOpen(false);
      setEditingTask(null);
    },
    onEditingTaskChange: setEditingTask,
    onPlanDraftChange: setPlanDraft,
    onPlanError: setPlanError,
    onFeedback: setFeedback,
    onCreated: () => {
      lastMobileSelection.current = null;
    },
    onCreateCompleted: async () => {
      if (!proposalOwnerHandoff.active) return;
      await proposalOwnerHandoff.waitForTerminalAndReturn();
    },
    onScheduleCreated: ({ item, snapshot: scheduleSnapshot }) => {
      if (!owner) return;
      controller.adopt(scheduleSnapshot);
      setScheduleSelection({ owner, item });
    },
  });
  useWorkHubCreatedTaskRecovery({
    coordinator: taskSaveCoordinator,
    owner,
    controller,
    snapshot,
    preflight: refreshWorkSnapshot,
    onCreated: () => {
      lastMobileSelection.current = null;
    },
    onPlanDraftChange: setPlanDraft,
    onPlanError: setPlanError,
    onFeedback: setFeedback,
  });
  const togglePlanItem = async (item: WorkHubItem) => {
    if (
      planSaving ||
      planLoading ||
      !canCreate ||
      !canUseWorkHubGenericAdjunct(item, 'DAY_PLAN') ||
      !isWorkHubItemCommandReady(snapshot, item)
    )
      return;
    const exists = dayPlanHasReference(loadedPlan, planDraft, item.reference);
    const next = exists
      ? controller.removePlanItem(item.reference)
      : controller.addToPlan(item.reference);
    setPlanDraft(next);
    setPlanSaving(true);
    try {
      const result = await savePlan(today, next, crypto.randomUUID(), [item]);
      if (result.state !== 'SAVED') {
        setPlanDraft([...result.draft]);
        setPlanError(
          t(`work:workHub.todayPlan.${result.state === 'CONFLICT' ? 'conflict' : 'saveFailed'}`)
        );
        navigate('/work/day-plan');
      } else {
        await queryClient.invalidateQueries({ queryKey: ['workspace', 'work-hub', 'home-plan'] });
        setPlanDraft(controller.state().planDraft);
        setPlanError(null);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setPlanError(t('work:workHub.todayPlan.saveFailed'));
      navigate('/work/day-plan');
    } finally {
      setPlanSaving(false);
    }
  };
  const freshness = workspaceWorkFreshness({
    generatedAt: query.data?.generatedAt,
    isFetching: query.isFetching,
    isError:
      query.isError ||
      snapshot?.completeness === 'PARTIAL' ||
      snapshot?.completeness === 'UNAVAILABLE',
    now,
  });
  const openSchedule = (item: WorkHubItem) => {
    if (
      owner &&
      canSchedule &&
      canUseWorkHubGenericAdjunct(item, 'CALENDAR') &&
      isWorkHubItemCommandReady(snapshot, item)
    )
      setScheduleSelection({ owner, item });
  };
  const closePlan = () => {
    navigate('/work/queue');
    requestAnimationFrame(() =>
      document.querySelector<HTMLButtonElement>('[data-work-plan-trigger]')?.focus()
    );
  };
  useEffect(() => {
    if (!canSchedule || (scheduleSelection && !scheduleItem)) setScheduleSelection(null);
  }, [canSchedule, scheduleItem, scheduleSelection]);
  const header = showMobileDetail ? null : (
    <WorkHubPageHeader
      view={view}
      count={visibleItems.length}
      complete={snapshot?.completeness === 'COMPLETE'}
      freshness={freshness}
      generatedAt={query.data?.generatedAt}
      refreshing={query.isFetching}
      canCreate={canCreate}
      onRefresh={() => void query.refetch()}
      onSources={() => {
        setSourceDialogOpen(true);
        setSearchParams(mergeFilterSearchParams(searchParams, { panel: 'sources' }), {
          replace: true,
        });
      }}
      onCreate={() => {
        setEditingTask(null);
        setTaskDialogOpen(true);
      }}
    />
  );
  if (query.isLoading) {
    return (
      <PageCanvas topInset="compact">
        {header}
        <LoadingState label={t('work:workPage.loading')} variant="skeleton" size="page" />
      </PageCanvas>
    );
  }
  if (!snapshot) {
    return (
      <PageCanvas topInset="compact">
        {header}
        <LocalErrorState
          title={t('work:workPage.loadErrorTitle')}
          description={t('work:workPage.loadErrorDescription')}
          retryLabel={t('work:workPage.retry')}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
          size="page"
        />
      </PageCanvas>
    );
  }
  const requestedUnavailable = Boolean(requested) && !explicitSelection;
  return (
    <PageCanvas topInset="compact">
      {header}
      <MailProposalOwnerHandoffNotice handoff={proposalOwnerHandoff} />
      <WorkHubPageNotices
        queryError={query.isError}
        snapshot={snapshot}
        showBatchReportAction={batch.receipts.length > 0 && !batch.target}
        onInspectSources={() => setSourceDialogOpen(true)}
        onReopenBatchReport={batch.reopen}
        feedback={feedback}
        onDismissFeedback={() => setFeedback(null)}
      />
      <Box sx={{ mt: 1, display: showMobileDetail || planOpen || assistActive ? 'none' : 'block' }}>
        <WorkHubFilterControls
          filters={filters}
          sourceSystems={sourceSystems}
          showAssignmentRoleFilter={showAssignmentRoleFilter}
          resultCount={visibleItems.length}
          onChange={setFilters}
          counts={scopeCounts}
          sort={sort}
          density={density}
        />
      </Box>

      {snapshot.completeness === 'UNAVAILABLE' && snapshot.items.length === 0 && !planOpen ? (
        <LocalErrorState
          title={t('work:workPage.loadErrorTitle')}
          description={t('work:workPage.loadErrorDescription')}
          retryLabel={t('work:workPage.retry')}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
          supportLabel={t('work:workHub.sourcesDialog.open')}
          onSupport={() => setSourceDialogOpen(true)}
          size="page"
        />
      ) : snapshot.items.length === 0 && snapshot.completeness === 'PARTIAL' && !planOpen ? (
        <GuidedEmptyState
          kind="empty"
          title={t(`work:${partialCopy!.title}`)}
          description={t(`work:${partialCopy!.description}`)}
          actionLabel={t('work:workHub.partial.inspect')}
          onAction={() => setSourceDialogOpen(true)}
          secondaryActionLabel={t('work:workPage.retry')}
          onSecondaryAction={() => void query.refetch()}
          size="page"
        />
      ) : snapshot.items.length === 0 && !planOpen ? (
        mobile ? (
          <WorkHubMobileEmptyCapture
            key={owner}
            ownerKey={owner ?? ''}
            canCreate={taskCreationEnabled}
            canScheduleAfterCreate={canSchedule}
            onSubmit={saveTask}
          />
        ) : (
          <GuidedEmptyState
            kind="first-use"
            title={t('work:workHub.empty.title')}
            description={t('work:workHub.empty.description')}
            actionLabel={canCreate ? t('work:workHub.actions.createTask') : undefined}
            onAction={canCreate ? () => setTaskDialogOpen(true) : undefined}
            size="page"
          />
        )
      ) : visibleItems.length === 0 && !planOpen ? (
        <GuidedEmptyState
          kind="no-results"
          title={t('work:workHub.noResults.title')}
          description={t('work:workHub.noResults.description')}
          actionLabel={t('work:workHub.filters.reset')}
          onAction={() =>
            setFilters({
              q: null,
              scope: null,
              source: null,
              urgency: null,
              assignmentRole: null,
            })
          }
          secondaryActionLabel={canCreate ? t('work:workHub.actions.createTask') : undefined}
          onSecondaryAction={canCreate ? () => setTaskDialogOpen(true) : undefined}
          size="page"
        />
      ) : (
        <Paper
          variant="outlined"
          sx={{
            mt: 2,
            overflow: 'visible',
            border: 0,
            bgcolor: 'transparent',
            display: 'grid',
            gap: 2,
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              md:
                planOpen || mobile
                  ? 'minmax(0, 1fr)'
                  : assistActive
                    ? 'minmax(0,1.4fr) minmax(300px,1fr)'
                    : requested
                      ? 'minmax(340px, 5fr) minmax(0, 7fr)'
                      : 'minmax(0, 1.2fr) minmax(0, 1fr)',
            },
            minHeight: 560,
          }}
        >
          <Box
            ref={queueScroll}
            sx={{
              display: showMobileDetail || planOpen || assistActive ? 'none' : 'block',
              minWidth: 0,
            }}
          >
            <WorkHubSelectionToolbar
              count={visibleItems.length}
              selecting={searchParams.get('select') === '1'}
              selectedCount={checkedKeys.size}
              eligibleCount={batch.items.length}
              pending={batch.pending}
              disabled={!workCommandsReady}
              onBatch={batch.open}
              onToggleSelection={() => {
                setCheckedKeys(new Set());
                setSearchParams(
                  mergeFilterSearchParams(searchParams, {
                    select: searchParams.get('select') === '1' ? null : '1',
                  }),
                  { replace: true }
                );
              }}
            />
            <WorkHubList
              items={visibleItems}
              selectedKey={selectedItem?.key ?? null}
              checkedKeys={checkedKeys}
              now={now}
              canCheck={(item) =>
                canUseWorkHubGenericAdjunct(item, 'BATCH') &&
                isWorkHubItemCommandReady(snapshot, item) &&
                !['COMPLETED', 'CANCELLED', 'ARCHIVED'].includes(item.lifecycle)
              }
              onCheck={(item, checked) =>
                setCheckedKeys((current) => {
                  const next = new Set(current);
                  if (checked) next.add(item.key);
                  else next.delete(item.key);
                  return next;
                })
              }
              onOpen={openItem}
              onSchedule={canSchedule ? openSchedule : undefined}
              inTodayPlan={(item) => dayPlanHasReference(loadedPlan, planDraft, item.reference)}
              onTogglePlan={canCreate ? (item) => void togglePlanItem(item) : undefined}
              onAction={action.run}
              busy={!workCommandsReady || action.pending || planSaving || planLoading}
              density={density}
              selectionMode={searchParams.get('select') === '1'}
            />
          </Box>

          <Box
            sx={{
              display: !mobile || showMobileDetail || planOpen ? 'block' : 'none',
              minWidth: 0,
              borderRadius: (theme) => `${theme.shape.borderRadius}px`,
              overflow: 'hidden',
              border: planOpen ? 0 : 1,
              borderColor: 'divider',
            }}
          >
            {planOpen ? (
              <Box sx={{ p: { xs: 1.5, md: 2.5 } }}>
                {mobile && (
                  <ActionButton intent="quiet" onClick={closePlan} sx={{ mb: 1, minHeight: 44 }}>
                    {t('work:workHub.actions.backToQueue')}
                  </ActionButton>
                )}
                <WorkTodayPlanPanel
                  items={snapshot.items}
                  draft={planDraft}
                  plan={loadedPlan}
                  intentVersion={`${loadedPlan?.date ?? today}:${loadedPlan?.version ?? 'loading'}`}
                  date={today}
                  now={now}
                  loading={planLoading}
                  pending={false}
                  onSchedule={canSchedule ? openSchedule : undefined}
                  disabled={!canCreate || snapshot.completeness === 'UNAVAILABLE'}
                  error={planError}
                  onDraftChange={(next) => {
                    setPlanDraft(next);
                    setPlanError(null);
                  }}
                  onSelect={(item) => {
                    navigate({
                      pathname: '/work/queue',
                      search: new URLSearchParams({ work: item.key }).toString(),
                    });
                  }}
                  onSave={async (draft, context) => {
                    const result = await savePlan(today, draft, context.idempotencyKey);
                    if (result.state !== 'SAVED') {
                      setPlanDraft([...result.draft]);
                      setPlanError(
                        t(
                          `work:workHub.todayPlan.${
                            result.state === 'CONFLICT' ? 'conflict' : 'saveFailed'
                          }`
                        )
                      );
                      throw new Error(result.state);
                    }
                    await queryClient.invalidateQueries({
                      queryKey: ['workspace', 'work-hub', 'home-plan'],
                    });
                    setPlanDraft(controller.state().planDraft);
                    setPlanError(null);
                    setFeedback({
                      severity: 'success',
                      title: t('work:workHub.todayPlan.savedTitle'),
                      detail: t('work:workHub.todayPlan.savedDetail'),
                    });
                  }}
                />
              </Box>
            ) : requestedUnavailable ? (
              <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 480, p: 3 }}>
                <LocalErrorState
                  title={t('work:workHub.unavailable.title')}
                  description={t('work:workHub.unavailable.description')}
                  retryLabel={t('work:workHub.actions.backToQueue')}
                  onRetry={backToQueue}
                  size="standard"
                />
              </Stack>
            ) : selectedItem ? (
              <WorkHubDetailPanel
                item={selectedItem}
                now={now}
                verifiedAt={
                  snapshot.sources.find((source) => source.sourceId === selectedItem.sourceId)
                    ?.receivedAt ?? snapshot.receivedAt
                }
                mobile={mobile}
                busyAction={action.pendingKind}
                commandsDisabled={!isWorkHubItemCommandReady(snapshot, selectedItem)}
                inTodayPlan={dayPlanHasReference(loadedPlan, planDraft, selectedItem.reference)}
                canManagePlan={
                  canCreate &&
                  canUseWorkHubGenericAdjunct(selectedItem, 'DAY_PLAN') &&
                  isWorkHubItemCommandReady(snapshot, selectedItem)
                }
                canSchedule={
                  canSchedule &&
                  canUseWorkHubGenericAdjunct(selectedItem, 'CALENDAR') &&
                  isWorkHubItemCommandReady(snapshot, selectedItem)
                }
                canAskAi={canUseWorkAssist(selectedItem, runtime.canUseAssist)}
                onBack={backToQueue}
                onAction={(kind) => action.run(selectedItem, kind)}
                onTogglePlan={() => togglePlanItem(selectedItem)}
                onSchedule={() => openSchedule(selectedItem)}
                onAskAi={() => {
                  setAssistItem(selectedItem);
                  if (mobile)
                    requestAnimationFrame(() =>
                      document
                        .querySelector('[data-testid="work-assist-panel"]')
                        ?.scrollIntoView({ block: 'start' })
                    );
                }}
                onOpenActivity={
                  canUseWorkHubGenericAdjunct(selectedItem, 'ACTIVITY') ? openActivity : undefined
                }
                specializedContent={
                  <Stack gap={3}>
                    {selectedItem.reference.sourceSystem === 'IDENTITY_GOVERNANCE' ? (
                      <AccessReviewWorkItem
                        workItemRef={selectedItem.reference.sourceReference}
                        commandsEnabled={isWorkHubItemCommandReady(snapshot, selectedItem)}
                        commandScope={workHubCommandScope(selectedItem)}
                        preflight={() =>
                          refreshWorkSnapshot().then((fresh) =>
                            canExecuteWorkHubAction(fresh, selectedItem, 'ACCESS_REVIEW_DECIDE')
                          )
                        }
                      />
                    ) : selectedItem.reference.sourceSystem === 'PERSONAL_TASK' ? (
                      <WorkHubPersonalDetail
                        item={selectedItem}
                        ownerFingerprint={owner}
                        canEdit={canCreate && isWorkHubItemCommandReady(snapshot, selectedItem)}
                        mutationCoordinator={taskSaveCoordinator}
                        snapshot={snapshot}
                        preflight={refreshWorkSnapshot}
                        onDeleted={() => {
                          backToQueue();
                          void controller
                            .loadPlan(today)
                            .then(() => setPlanDraft(controller.state().planDraft))
                            .catch(() => setPlanError(t('work:workHub.todayPlan.loadFailed')));
                        }}
                        onOpenSource={(route) => openSource(selectedItem, route, 'SOURCE')}
                        onEdit={(task) => {
                          setEditingTask(task);
                          setTaskDialogOpen(true);
                        }}
                      />
                    ) : selectedItem.reference.sourceSystem === 'WORK_ASSIGNMENT' ? (
                      <WorkHubAssignmentDetail
                        key={selectedItem.key}
                        item={selectedItem}
                        commandsEnabled={
                          runtime.canUpdatePersonal &&
                          isWorkHubItemCommandReady(snapshot, selectedItem)
                        }
                        onAccessDenied={() => {
                          backToQueue();
                          void query.refetch();
                        }}
                        onChanged={() => void query.refetch()}
                        onOpenSource={(route) => openSource(selectedItem, route, 'SOURCE')}
                      />
                    ) : (
                      <>
                        <WorkHubSourceOwnedDetail
                          item={selectedItem}
                          onSourceInvalid={backToQueue}
                        />
                        {serviceResponse.bridge}
                      </>
                    )}
                    {runtime.canUseCalendar &&
                      canUseWorkHubGenericAdjunct(selectedItem, 'CALENDAR') && (
                        <WorkHubScheduleLinks
                          item={selectedItem}
                          ownerFingerprint={owner}
                          from={scheduleRange.from}
                          to={scheduleRange.to}
                          canUnlink={canCreate && canUnlinkWorkSchedule(snapshot, selectedItem)}
                          preflight={refreshWorkSnapshot}
                          loadSchedules={controller.loadSchedules}
                          unlinkSchedule={controller.unlinkSchedule}
                          onOpenCalendar={openCalendar}
                        />
                      )}
                  </Stack>
                }
              />
            ) : (
              <WorkHubNoSelection />
            )}
          </Box>
          {assistActive && selectedItem && !planOpen && (
            <WorkHubAssistPanel
              item={selectedItem}
              verifiedAt={snapshot.receivedAt}
              onClose={() => {
                setAssistItem(null);
                requestAnimationFrame(() =>
                  document.querySelector<HTMLButtonElement>('[data-work-ai-trigger]')?.focus()
                );
              }}
              onSubmit={async (question, options) => {
                return submitWorkHubAssist({
                  item: selectedItem,
                  question,
                  options,
                  locale: i18n.resolvedLanguage ?? 'ko',
                  route: location.pathname,
                  refresh: controller.refresh,
                  refetch: query.refetch,
                  resetSelection: () => {
                    setAssistItem(null);
                    controller.select(null);
                    backToQueue();
                  },
                });
              }}
              onOpenSource={(route) => {
                if (!openSource(selectedItem, route, 'ASSIST')) {
                  setFeedback({
                    severity: 'error',
                    title: t('work:workHub.results.UNAVAILABLE.title'),
                    detail: t('work:workHub.results.UNAVAILABLE.detail'),
                  });
                }
              }}
              onDraftApply={serviceResponse.applyDraft}
              onContinue={(response) => {
                const route = selectedWorkConversationRoute(response);
                if (route) navigate(route);
              }}
            />
          )}
        </Paper>
      )}
      <WorkHubRecoveryDialogs
        sourceOpen={sourceDialogOpen}
        snapshot={snapshot}
        onCloseSources={() => {
          setSourceDialogOpen(false);
          setSearchParams(mergeFilterSearchParams(searchParams, { panel: null }), {
            replace: true,
          });
        }}
        refresh={refreshWorkSnapshot}
        refreshSource={runtime.refreshSource}
        retrying={query.isFetching || runtime.sourceRefreshing !== null}
        batch={batch}
        onOpenItem={openItem}
      />
      <WorkHubTaskEditorDialog
        open={taskDialogOpen}
        task={editingTask}
        items={snapshot.items}
        disabled={!taskCreationEnabled || messenger.sourcePending || messenger.sourceError}
        canScheduleAfterCreate={canSchedule}
        captureSource={messengerSource}
        captureSourceState={messenger.sourceState}
        onRetryCaptureSource={() => void messenger.retrySource()}
        onClose={() => {
          if (proposalOwnerHandoff.active) {
            void proposalOwnerHandoff.cancelAndReturn();
            return;
          }
          setTaskDialogOpen(false);
          setEditingTask(null);
          clearTaskComposeIntent();
        }}
        onSubmit={saveTask}
      />
      <WorkHubScheduleExecutionDialog
        item={scheduleItem}
        snapshot={snapshot}
        plannedForToday={Boolean(
          scheduleItem && dayPlanHasReference(loadedPlan, planDraft, scheduleItem.reference)
        )}
        ownerFingerprint={owner}
        canSchedule={canSchedule}
        coordinator={scheduleCoordinator}
        controller={controller}
        refresh={() => query.refetch()}
        onClose={() => setScheduleSelection(null)}
        onOpenCalendar={(draft) => scheduleItem && continueWorkInCalendar(scheduleItem, draft)}
        onInvalidateLinks={(queryKey) => queryClient.invalidateQueries({ queryKey })}
      />
    </PageCanvas>
  );
}
