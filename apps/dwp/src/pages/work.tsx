import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import { CheckSquare2 } from 'lucide-react';
import {
  ActionButton,
  GuidedEmptyState,
  InlineFeedback,
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
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';

import { AccessReviewWorkItem } from '../features/work/access-review-work-item';
import { useWorkClock } from '../features/work/use-work-clock';
import { useWorkHubActivityReturn } from '../features/work-hub/use-work-hub-activity-return';
import { useWorkHubBatch } from '../features/work-hub/use-work-hub-batch';
import { useWorkHubRuntime } from '../features/work-hub/use-work-hub-runtime';
import { WorkHubSelectionToolbar } from '../features/work-hub/work-hub-selection-toolbar';
import { WorkHubPageHeader } from '../features/work-hub/work-hub-page-header';
import { useWorkHubTaskSave } from '../features/work-hub/use-work-hub-task-save';
import { useWorkHubReturnHandoff } from '../features/work-hub/use-work-hub-return-handoff';
import { WorkHubAssistPanel } from '../features/work-hub/work-hub-assist-dialog';
import { selectedWorkConversationRoute } from '@dwp-frontend/shared-utils/api/agent-selected-work-api';
import type { WorkHubActionResult } from '../features/work-hub/work-hub-actions';
import { WorkHubBatchDialog } from '../features/work-hub/work-hub-batch-dialog';
import {
  workHubReferenceKey,
  type WorkHubActionKind,
  type WorkHubItem,
} from '../features/work-hub/work-hub-contracts';
import { WorkHubDetailPanel } from '../features/work-hub/work-hub-detail-panel';
import { WorkHubFilterControls } from '../features/work-hub/work-hub-filter-controls';
import { WorkHubList } from '../features/work-hub/work-hub-list';
import {
  dayPlanHasReference,
  resolveDayPlanReferences,
  selectWorkHubDetail,
  selectWorkHubItems,
} from '../features/work-hub/work-hub-model';
import {
  WorkHubPartialNotice,
  workHubPartialCopy,
} from '../features/work-hub/work-hub-partial-notice';
import { WorkHubPersonalDetail } from '../features/work-hub/work-hub-personal-detail';
import {
  canUseWorkAssist,
  isPersonalWorkAction,
  selectedWorkFromRequest,
  submitWorkHubAssist,
  uniqueWorkSourceSystems,
  workHubCalendarRoute,
  type WorkHubOperationFeedback,
} from '../features/work-hub/work-hub-page-helpers';
import { WorkHubScheduleDialog } from '../features/work-hub/work-hub-schedule-dialog';
import {
  WorkHubScheduleLinks,
  workHubScheduleLinksQueryKey,
} from '../features/work-hub/work-hub-schedule-links';
import { workScheduleLookupRange } from '../features/work-hub/work-hub-scheduling';
import { WorkHubSourceOwnedDetail } from '../features/work-hub/work-hub-source-owned-detail';
import { WorkHubSourceStatusDialog } from '../features/work-hub/work-hub-source-status-dialog';
import { WorkTaskDialog } from '../features/work-hub/work-task-dialog';
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
  const { setWorkNavigationState, availableWidth } =
    useOutletContext<WorkLayoutContext | undefined>() ?? {};
  const mobile = availableWidth === undefined ? narrowViewport : availableWidth < 900;
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const runtime = useWorkHubRuntime();
  const { query, controller } = runtime;
  const snapshot = query.data?.snapshot;
  const filters = workHubFiltersForPath(location.pathname, searchParams);
  const view = workHubViewFromPath(location.pathname);
  const requestedSort = searchParams.get('sort');
  const sort = ['due', 'updated', 'title'].includes(requestedSort ?? '')
    ? requestedSort!
    : 'urgency';
  const density = searchParams.get('density') === 'comfortable' ? 'comfortable' : 'compact';
  const requested =
    searchParams.get('work') ?? searchParams.get('personalTaskId') ?? searchParams.get('item');
  const composeTaskRequested = searchParams.get('compose') === 'task';
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
  const [scheduleItem, setScheduleItem] = useState<WorkHubItem | null>(null);
  const [assistItem, setAssistItem] = useState<WorkHubItem | null>(null);
  const lastMobileSelection = useRef<string | null>(null);
  const queueScroll = useRef<HTMLDivElement | null>(null);
  const queueScrollTop = useRef(0);
  const selectionContext = `${location.pathname}|${filters.query}|${filters.sourceSystem ?? ''}|${filters.urgency ?? ''}`;
  const previousSelectionContext = useRef(selectionContext);
  const actionKeys = useRef(new Map<string, string>());
  const planLoadOwner = useRef<typeof controller | null>(null);
  const restoreQueueFocus = useRef(false);
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
    if (!mobile || requested || !restoreQueueFocus.current) return;
    restoreQueueFocus.current = false;
    const frame = requestAnimationFrame(() => {
      if (queueScroll.current) queueScroll.current.scrollTop = queueScrollTop.current;
      const focusKey = lastMobileSelection.current;
      const row = [...document.querySelectorAll<HTMLElement>('[data-work-key]')].find(
        (candidate) => candidate.dataset.workKey === focusKey
      );
      (
        row?.querySelector<HTMLElement>('[data-work-open]') ??
        document.querySelector<HTMLElement>('[data-work-open]')
      )?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [mobile, requested]);

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
                { scope, query: '', sourceSystem: null, urgency: null },
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
    setSourceDialogOpen(sourcePanelRequested);
  }, [sourcePanelRequested]);
  const explicitSelection = snapshot
    ? selectedWorkFromRequest(snapshot.items, requested)
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
  const partialCopy = snapshot ? workHubPartialCopy(snapshot) : null;
  const scheduleRange = useMemo(() => workScheduleLookupRange(today), [today]);
  const openCalendar = () =>
    navigate(workHubCalendarRoute(today, `${location.pathname}${location.search}`));
  const openSource = useWorkHubReturnHandoff({
    itemKey: selectedItem?.key ?? null,
    ready: Boolean(snapshot),
    refetch: query.refetch,
  });

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
  const openItem = (item: WorkHubItem) => {
    setAssistItem(null);
    lastMobileSelection.current = item.key;
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
    setSearchParams(
      mergeFilterSearchParams(searchParams, { work: null, item: null, personalTaskId: null }),
      { replace: true }
    );
  };

  const actionMutation = useMutation({
    mutationFn: async ({ item, kind }: { item: WorkHubItem; kind: WorkHubActionKind }) => {
      if (!snapshot) throw new Error('snapshot unavailable');
      controller.adopt(snapshot);
      controller.select(item.reference);
      if (isPersonalWorkAction(kind)) {
        const identity = `${item.key}:${item.version}:${kind}`;
        const idempotencyKey = actionKeys.current.get(identity) ?? crypto.randomUUID();
        actionKeys.current.set(identity, idempotencyKey);
        return controller.execute({
          kind: kind as
            | 'PERSONAL_START'
            | 'PERSONAL_WAIT'
            | 'PERSONAL_COMPLETE'
            | 'PERSONAL_REOPEN'
            | 'PERSONAL_ARCHIVE',
          idempotencyKey,
        });
      }
      if (kind === 'WORKSPACE_START' || kind === 'WORKSPACE_COMPLETE' || kind === 'OPEN_SOURCE') {
        return controller.execute({ kind });
      }
      throw new Error('unsupported direct action');
    },
    onSuccess: async (result: WorkHubActionResult, variables) => {
      if (result.state === 'HANDED_OFF') {
        if (!openSource(variables.item, result.route, 'SOURCE')) {
          setFeedback({
            severity: 'error',
            title: t('work:workHub.results.UNAVAILABLE.title'),
            detail: t('work:workHub.results.UNAVAILABLE.detail'),
          });
        }
        return;
      }
      if (result.state === 'CONFIRMED') {
        actionKeys.current.delete(
          `${variables.item.key}:${variables.item.version}:${variables.kind}`
        );
        setFeedback({
          severity: 'success',
          title: t('work:workHub.results.confirmedTitle'),
          detail: t('work:workHub.results.confirmedDetail'),
        });
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['workspace', 'work-hub'] }),
          queryClient.invalidateQueries({ queryKey: ['workspace', 'activity'] }),
        ]);
        return;
      }
      if (result.state === 'CONFLICT' || result.state === 'FORBIDDEN') {
        actionKeys.current.delete(
          `${variables.item.key}:${variables.item.version}:${variables.kind}`
        );
        await query.refetch();
      }
      setFeedback({
        severity: result.state === 'CONFLICT' ? 'warning' : 'error',
        title: t(`work:workHub.results.${result.state}.title`),
        detail: t(`work:workHub.results.${result.state}.detail`),
      });
    },
    onError: () =>
      setFeedback({
        severity: 'error',
        title: t('work:workHub.results.UNAVAILABLE.title'),
        detail: t('work:workHub.results.UNAVAILABLE.detail'),
      }),
  });

  const batch = useWorkHubBatch({
    snapshot,
    checkedKeys,
    clearSelection: () => setCheckedKeys(new Set()),
    onFeedback: setFeedback,
    refresh: async () => query.refetch(),
  });

  const saveTask = useWorkHubTaskSave({
    controller,
    snapshot,
    editingTask,
    today,
    onTaskClosed: () => {
      setTaskDialogOpen(false);
      setEditingTask(null);
    },
    onEditingTaskChange: setEditingTask,
    onPlanDraftChange: setPlanDraft,
    onPlanError: setPlanError,
    onFeedback: setFeedback,
    onCreated: (reference) => {
      lastMobileSelection.current = workHubReferenceKey(reference);
    },
  });

  const togglePlanItem = async (item: WorkHubItem) => {
    if (planSaving || planLoading) return;
    const exists = dayPlanHasReference(loadedPlan, planDraft, item.reference);
    const next = exists
      ? controller.removePlanItem(item.reference)
      : controller.addToPlan(item.reference);
    setPlanDraft(next);
    setPlanSaving(true);
    try {
      const result = await controller.savePlan(today, next, crypto.randomUUID());
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
    } catch {
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
  const canCreate = runtime.canUpdatePersonal;
  const canSchedule = canCreate && runtime.canUseCalendar;
  const closePlan = () => {
    navigate('/work/queue');
    requestAnimationFrame(() =>
      document.querySelector<HTMLButtonElement>('[data-work-plan-trigger]')?.focus()
    );
  };
  useEffect(() => {
    if (!canSchedule) setScheduleItem(null);
  }, [canSchedule]);
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
      {query.isError && (
        <InlineFeedback severity="warning" title={t('work:workPage.loadErrorTitle')} sx={{ mt: 2 }}>
          {t('work:workPage.loadErrorDescription')}
        </InlineFeedback>
      )}
      {snapshot.completeness === 'UNAVAILABLE' && snapshot.items.length > 0 && (
        <InlineFeedback
          severity="warning"
          title={t('work:workPage.freshness.degraded')}
          sx={{ mt: 2 }}
        >
          {t('work:workPage.loadErrorDescription')}
        </InlineFeedback>
      )}
      {snapshot.completeness === 'PARTIAL' && snapshot.items.length > 0 && (
        <WorkHubPartialNotice snapshot={snapshot} onInspect={() => setSourceDialogOpen(true)} />
      )}
      {batch.receipts.length > 0 && !batch.target && (
        <ActionButton
          intent="quiet"
          size="small"
          onClick={batch.reopen}
          sx={{ minHeight: { xs: 44, md: 32 } }}
        >
          {t('work:workHub.batch.reopenReport')}
        </ActionButton>
      )}
      {feedback && (
        <InlineFeedback
          severity={feedback.severity}
          title={feedback.title}
          onClose={() => setFeedback(null)}
          closeLabel={t('common:actions.close')}
          sx={{ mt: 2 }}
        >
          {feedback.detail}
        </InlineFeedback>
      )}

      <Box sx={{ mt: 1, display: showMobileDetail || planOpen || assistActive ? 'none' : 'block' }}>
        <WorkHubFilterControls
          filters={filters}
          sourceSystems={sourceSystems}
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
        <GuidedEmptyState
          kind="first-use"
          title={t('work:workHub.empty.title')}
          description={t('work:workHub.empty.description')}
          actionLabel={canCreate ? t('work:workHub.actions.createTask') : undefined}
          onAction={canCreate ? () => setTaskDialogOpen(true) : undefined}
          size="page"
        />
      ) : visibleItems.length === 0 && !planOpen ? (
        <GuidedEmptyState
          kind="no-results"
          title={t('work:workHub.noResults.title')}
          description={t('work:workHub.noResults.description')}
          actionLabel={t('work:workHub.filters.reset')}
          onAction={() => setFilters({ q: null, scope: null, source: null, urgency: null })}
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
                      ? 'minmax(280px, 0.75fr) minmax(0, 1.25fr)'
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
              canCheck={(item) => !['COMPLETED', 'CANCELLED', 'ARCHIVED'].includes(item.lifecycle)}
              onCheck={(item, checked) =>
                setCheckedKeys((current) => {
                  const next = new Set(current);
                  if (checked) next.add(item.key);
                  else next.delete(item.key);
                  return next;
                })
              }
              onOpen={openItem}
              onSchedule={canSchedule ? setScheduleItem : undefined}
              inTodayPlan={(item) => dayPlanHasReference(loadedPlan, planDraft, item.reference)}
              onTogglePlan={canCreate ? (item) => void togglePlanItem(item) : undefined}
              onAction={(item, kind) => actionMutation.mutate({ item, kind })}
              busy={actionMutation.isPending || planSaving || planLoading}
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
                  loading={planLoading}
                  pending={false}
                  onSchedule={canSchedule ? setScheduleItem : undefined}
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
                    const result = await controller.savePlan(today, draft, context.idempotencyKey);
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
                mobile={mobile}
                busyAction={actionMutation.isPending ? actionMutation.variables?.kind : null}
                commandsDisabled={snapshot.completeness === 'UNAVAILABLE'}
                inTodayPlan={dayPlanHasReference(loadedPlan, planDraft, selectedItem.reference)}
                canManagePlan={canCreate}
                canSchedule={canSchedule}
                canAskAi={canUseWorkAssist(selectedItem, runtime.canUseAssist)}
                onBack={backToQueue}
                onAction={(kind) => actionMutation.mutate({ item: selectedItem, kind })}
                onTogglePlan={() => togglePlanItem(selectedItem)}
                onSchedule={() => setScheduleItem(selectedItem)}
                onAskAi={() => {
                  setAssistItem(selectedItem);
                  if (mobile)
                    requestAnimationFrame(() =>
                      document
                        .querySelector('[data-testid="work-assist-panel"]')
                        ?.scrollIntoView({ block: 'start' })
                    );
                }}
                onOpenActivity={openActivity}
                specializedContent={
                  <Stack gap={3}>
                    {selectedItem.reference.sourceSystem === 'IDENTITY_GOVERNANCE' ? (
                      <AccessReviewWorkItem workItemRef={selectedItem.reference.sourceReference} />
                    ) : selectedItem.reference.sourceSystem === 'PERSONAL_TASK' ? (
                      <WorkHubPersonalDetail
                        item={selectedItem}
                        canEdit={canCreate}
                        statusActionPending={actionMutation.isPending}
                        onStatusAction={(status) => {
                          const kind =
                            status === 'IN_PROGRESS'
                              ? 'PERSONAL_START'
                              : status === 'WAITING'
                                ? 'PERSONAL_WAIT'
                                : status === 'COMPLETED'
                                  ? 'PERSONAL_COMPLETE'
                                  : ['COMPLETED', 'ARCHIVED'].includes(selectedItem.lifecycle)
                                    ? 'PERSONAL_REOPEN'
                                    : null;
                          if (!kind) return false;
                          actionMutation.mutate({ item: selectedItem, kind });
                          return true;
                        }}
                        snapshot={snapshot}
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
                    ) : (
                      <WorkHubSourceOwnedDetail item={selectedItem} />
                    )}
                    {runtime.canUseCalendar && (
                      <WorkHubScheduleLinks
                        item={selectedItem}
                        from={scheduleRange.from}
                        to={scheduleRange.to}
                        canUnlink={canCreate && snapshot.completeness !== 'UNAVAILABLE'}
                        loadSchedules={controller.loadSchedules}
                        unlinkSchedule={controller.unlinkSchedule}
                        onOpenCalendar={openCalendar}
                      />
                    )}
                  </Stack>
                }
              />
            ) : (
              <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 480, p: 3 }}>
                <CheckSquare2 size={30} aria-hidden="true" />
                <Typography component="h2" variant="subtitle1" sx={{ mt: 1.5 }}>
                  {t('work:workHub.detail.selectTitle')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {t('work:workHub.detail.selectDescription')}
                </Typography>
              </Stack>
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
              onContinue={(response) => {
                const route = selectedWorkConversationRoute(response);
                if (route) navigate(route);
              }}
            />
          )}
        </Paper>
      )}

      <WorkHubSourceStatusDialog
        open={sourceDialogOpen}
        sources={snapshot.sources}
        onClose={() => {
          setSourceDialogOpen(false);
          setSearchParams(mergeFilterSearchParams(searchParams, { panel: null }), {
            replace: true,
          });
        }}
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
        batchResultCount={batch.receipts.length}
        onOpenBatchResults={() => {
          setSourceDialogOpen(false);
          setSearchParams(mergeFilterSearchParams(searchParams, { panel: null }), {
            replace: true,
          });
          batch.reopen();
        }}
      />
      <WorkTaskDialog
        open={taskDialogOpen}
        mode={editingTask ? 'edit' : 'create'}
        initialValue={
          editingTask
            ? {
                title: editingTask.title,
                checklist: editingTask.checklist ?? [],
                sources: editingTask.sources ?? (editingTask.source ? [editingTask.source] : []),
                description: editingTask.description,
                priority: editingTask.priority,
                dueAt: editingTask.dueAt,
                sourceReference:
                  editingTask.source?.availability !== 'UNAVAILABLE'
                    ? editingTask.source?.reference
                    : null,
                version: editingTask.version,
              }
            : undefined
        }
        sourceLabel={
          editingTask?.source?.availability === 'AVAILABLE' ? editingTask.source.title : null
        }
        sourceOptions={snapshot.items
          .filter((item) => item.reference.sourceSystem !== 'PERSONAL_TASK')
          .map((item) => ({ reference: item.reference, label: item.title }))}
        disabled={!canCreate}
        onClose={() => {
          setTaskDialogOpen(false);
          setEditingTask(null);
          setSearchParams(mergeFilterSearchParams(searchParams, { compose: null }), {
            replace: true,
          });
        }}
        onSubmit={saveTask}
      />
      <WorkHubScheduleDialog
        open={Boolean(scheduleItem)}
        item={scheduleItem}
        onClose={() => setScheduleItem(null)}
        onOpenCalendar={openCalendar}
        prepare={(calendar, input) => {
          if (!scheduleItem || !snapshot) throw new Error('selection unavailable');
          controller.adopt(snapshot);
          controller.select(scheduleItem.reference);
          return controller.prepareSchedule(calendar, input);
        }}
        execute={async (command, confirmedEvent) => {
          const result = await controller.executeSchedule(command, confirmedEvent);
          if (result.state === 'SCHEDULED' || result.state === 'LINK_REMOVED') {
            await queryClient.invalidateQueries({ queryKey: workHubScheduleLinksQueryKey });
          }
          return result;
        }}
      />
      <WorkHubBatchDialog
        target={batch.target}
        selectedCount={batch.reviewItems.length}
        items={batch.reviewItems}
        outcome={batch.outcome}
        busy={batch.pending}
        onClose={batch.close}
        onConfirm={batch.confirm}
        receipts={batch.receipts}
        onRetryUnconfirmed={batch.retryUnconfirmed}
      />
    </PageCanvas>
  );
}
