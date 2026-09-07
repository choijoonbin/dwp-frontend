import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckSquare2, DatabaseZap, ListChecks, Plus } from 'lucide-react';
import {
  ActionButton,
  GuidedEmptyState,
  InlineFeedback,
  LiveStatus,
  LoadingState,
  LocalErrorState,
  PageCanvas,
  ResourcePageHeader,
  mergeFilterSearchParams,
  useDateTimePolicy,
} from '@dwp-frontend/design-system';
import { formatDate, resolveZonedDateKey } from '@dwp-frontend/shared-i18n';
import {
  canChangeWorkspaceWorkStatus,
  workspaceWorkActivityRoute,
  workspaceWorkFreshness,
} from '@dwp-frontend/shared-utils';
import { getPersonalWorkTask } from '@dwp-frontend/shared-utils/api/personal-work-api';
import { usePermissions } from '@dwp-frontend/shared-utils/auth/use-permissions';
import { HttpError } from '@dwp-frontend/shared-utils/http-error';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';

import { AccessReviewWorkItem } from '../features/work/access-review-work-item';
import { useWorkClock } from '../features/work/use-work-clock';
import { useWorkHubBatch } from '../features/work-hub/use-work-hub-batch';
import { useWorkHubRuntime } from '../features/work-hub/use-work-hub-runtime';
import { WorkHubAssistDialog } from '../features/work-hub/work-hub-assist-dialog';
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
  parseWorkHubFilters,
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
import {
  WorkTaskDialog,
  type WorkTaskDialogSubmitContext,
  type WorkTaskDialogSubmission,
} from '../features/work-hub/work-task-dialog';
import { WorkTodayPlanPanel } from '../features/work-hub/work-today-plan-panel';

import type { PersonalWorkTask } from '@dwp-frontend/shared-utils/api/personal-work-contracts';

export default function WorkPage() {
  const { t } = useTranslation(['work', 'common']);
  const now = useWorkClock();
  const { timeZone } = useDateTimePolicy();
  const mobile = useMediaQuery('(max-width:899.95px)');
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const runtime = useWorkHubRuntime();
  const { query, controller } = runtime;
  const snapshot = query.data?.snapshot;
  const filters = parseWorkHubFilters(searchParams);
  const requested =
    searchParams.get('work') ?? searchParams.get('personalTaskId') ?? searchParams.get('item');
  const today = resolveZonedDateKey(now, timeZone) ?? new Date(now).toISOString().slice(0, 10);
  const [checkedKeys, setCheckedKeys] = useState<Set<string>>(new Set());
  const [feedback, setFeedback] = useState<WorkHubOperationFeedback | null>(null);
  const [sourceDialogOpen, setSourceDialogOpen] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<PersonalWorkTask | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [planDraft, setPlanDraft] = useState<ReturnType<typeof controller.state>['planDraft']>([]);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [scheduleItem, setScheduleItem] = useState<WorkHubItem | null>(null);
  const [assistItem, setAssistItem] = useState<WorkHubItem | null>(null);
  const [assistError, setAssistError] = useState<string | null>(null);
  const lastMobileSelection = useRef<string | null>(null);
  const queueScroll = useRef<HTMLDivElement | null>(null);
  const queueScrollTop = useRef(0);
  const actionKeys = useRef(new Map<string, string>());
  const planLoadOwner = useRef<typeof controller | null>(null);
  const restoreQueueFocus = useRef(false);

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
  const visibleItems = useMemo(
    () => (snapshot ? selectWorkHubItems(snapshot, filters, now, todayPlanReferences) : []),
    [filters, now, snapshot, todayPlanReferences]
  );
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
  const selectedActivityRoute =
    selectedItem?.legacyItem && hasPermission('APP.ACTIVITY', 'VIEW')
      ? workspaceWorkActivityRoute(selectedItem.legacyItem)
      : null;
  const showMobileDetail = mobile && Boolean(requested);
  const sourceSystems = uniqueWorkSourceSystems(snapshot?.items ?? []);
  const partialCopy = snapshot ? workHubPartialCopy(snapshot) : null;
  const scheduleRange = useMemo(() => workScheduleLookupRange(today), [today]);
  const openCalendar = () =>
    navigate(workHubCalendarRoute(today, `${location.pathname}${location.search}`));

  const setFilters = (values: Record<string, string | null>) => {
    setCheckedKeys(new Set());
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
        navigate(result.route);
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

  const saveTask = async (
    value: WorkTaskDialogSubmission,
    context: WorkTaskDialogSubmitContext
  ) => {
    const { version, ...input } = value;
    try {
      let createdReference: WorkHubItem['reference'] | null = null;
      if (editingTask) {
        if (version === undefined) throw new Error('version required');
        const item = snapshot?.items.find(
          (candidate) =>
            candidate.reference.sourceSystem === 'PERSONAL_TASK' &&
            candidate.reference.sourceReference === editingTask.taskId
        );
        if (!item || !snapshot) throw new Error('task unavailable');
        controller.adopt(snapshot);
        controller.select(item.reference);
        await controller.savePersonalTask({ ...input, version }, context.idempotencyKey);
      } else {
        const created = await controller.capture(input, context.idempotencyKey);
        createdReference = {
          sourceSystem: 'PERSONAL_TASK',
          sourceReference: created.taskId,
        };
        lastMobileSelection.current = workHubReferenceKey(createdReference);
        setSearchParams(
          mergeFilterSearchParams(searchParams, {
            work: workHubReferenceKey(createdReference),
            item: null,
            personalTaskId: null,
          }),
          { replace: true }
        );
      }
      setTaskDialogOpen(false);
      setEditingTask(null);
      let planSaveFailed = false;
      if (createdReference && context.addToTodayPlan) {
        const next = controller.addToPlan(createdReference);
        setPlanDraft(next);
        try {
          const planResult = await controller.savePlan(today, next, crypto.randomUUID());
          if (planResult.state === 'SAVED') {
            setPlanDraft(controller.state().planDraft);
            setPlanError(null);
          } else {
            planSaveFailed = true;
            setPlanDraft([...planResult.draft]);
            setPlanError(
              t(
                `work:workHub.todayPlan.${
                  planResult.state === 'CONFLICT' ? 'conflict' : 'saveFailed'
                }`
              )
            );
          }
        } catch {
          planSaveFailed = true;
          setPlanError(t('work:workHub.todayPlan.saveFailed'));
        }
      }
      setFeedback({
        severity: planSaveFailed ? 'warning' : 'success',
        title: t('work:workHub.taskForm.savedTitle'),
        detail: planSaveFailed
          ? `${t('work:workHub.taskForm.savedDetail')} ${t('work:workHub.todayPlan.saveFailed')}`
          : t('work:workHub.taskForm.savedDetail'),
      });
      await queryClient.invalidateQueries({ queryKey: ['workspace', 'work-hub'] });
    } catch (error) {
      if (editingTask && error instanceof HttpError && error.status === 409) {
        try {
          const latest = await getPersonalWorkTask(editingTask.taskId);
          setEditingTask(latest);
          queryClient.setQueryData(
            ['workspace', 'work-hub', 'personal-detail', latest.taskId, latest.version],
            latest
          );
          await queryClient.invalidateQueries({ queryKey: ['workspace', 'work-hub'] });
          setFeedback({
            severity: 'warning',
            title: t('work:workHub.results.CONFLICT.title'),
            detail: t('work:workHub.results.CONFLICT.detail'),
          });
        } catch {
          // Preserve the user's draft; the generic retry guidance below remains valid.
        }
      } else if (
        editingTask &&
        error instanceof HttpError &&
        [401, 403, 404].includes(error.status)
      ) {
        queryClient.removeQueries({
          queryKey: ['workspace', 'work-hub', 'personal-detail', editingTask.taskId],
        });
        queryClient.removeQueries({
          queryKey: ['workspace', 'work-hub', 'personal-timeline', editingTask.taskId],
        });
        setTaskDialogOpen(false);
        setEditingTask(null);
        await queryClient.invalidateQueries({ queryKey: ['workspace', 'work-hub'] });
      }
      setFeedback({
        severity: error instanceof HttpError && error.status === 409 ? 'warning' : 'error',
        title:
          error instanceof HttpError && error.status === 409
            ? t('work:workHub.results.CONFLICT.title')
            : t('work:workHub.taskForm.saveFailedTitle'),
        detail:
          error instanceof HttpError && error.status === 409
            ? t('work:workHub.results.CONFLICT.detail')
            : t('work:workHub.taskForm.saveFailedDetail'),
      });
      throw error;
    }
  };

  const togglePlanItem = (item: WorkHubItem) => {
    const exists = dayPlanHasReference(loadedPlan, planDraft, item.reference);
    if (exists) {
      const next = controller.removePlanItem(item.reference);
      setPlanDraft(next);
    } else {
      setPlanDraft(controller.addToPlan(item.reference));
    }
    setPlanOpen(true);
  };

  const assistMutation = useMutation({
    mutationFn: async (question: string) => {
      if (!assistItem || !snapshot) throw new Error('selection unavailable');
      controller.adopt(snapshot);
      controller.select(assistItem.reference);
      return controller.launchAssist({
        question,
        expectedKey: assistItem.key,
        expectedVersion: assistItem.version,
      });
    },
    onSuccess: (result) => navigate(result.route, { state: result.state }),
    onError: () => setAssistError(t('work:workHub.assist.failed')),
  });

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
    setPlanOpen(false);
    requestAnimationFrame(() =>
      document.querySelector<HTMLButtonElement>('[data-work-plan-trigger]')?.focus()
    );
  };
  useEffect(() => {
    if (!canSchedule) setScheduleItem(null);
  }, [canSchedule]);
  const header = (
    <ResourcePageHeader
      eyebrow={t('work:workHub.header.eyebrow')}
      title={t('work:workHub.header.title')}
      description={t('work:workHub.header.description')}
      scope={<Chip size="small" variant="outlined" label={t('work:workHub.header.scope')} />}
      status={
        <LiveStatus
          state={freshness}
          label={t(`work:workPage.freshness.${freshness}`)}
          detail={
            query.data?.generatedAt
              ? t('work:workPage.freshness.generatedAt', {
                  date: formatDate(query.data.generatedAt, {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  }),
                })
              : t('work:workPage.freshness.unknown')
          }
          refreshLabel={t('work:workPage.retry')}
          refreshing={query.isFetching}
          onRefresh={() => void query.refetch()}
        />
      }
      primaryAction={
        canCreate ? (
          <ActionButton
            intent="primary"
            startIcon={<Plus size={17} />}
            onClick={() => {
              setEditingTask(null);
              setTaskDialogOpen(true);
            }}
          >
            {t('work:workHub.actions.createTask')}
          </ActionButton>
        ) : undefined
      }
      secondaryActions={
        <>
          <ActionButton
            data-work-plan-trigger
            intent={planOpen ? 'primary' : 'secondary'}
            startIcon={<ListChecks size={17} />}
            onClick={() => setPlanOpen((value) => !value)}
          >
            {t('work:workHub.todayPlan.open')}
          </ActionButton>
          <ActionButton
            intent="quiet"
            startIcon={<DatabaseZap size={17} />}
            onClick={() => setSourceDialogOpen(true)}
          >
            {t('work:workHub.sourcesDialog.open')}
          </ActionButton>
        </>
      }
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

      <Box sx={{ mt: 2 }}>
        <WorkHubFilterControls
          filters={filters}
          sourceSystems={sourceSystems}
          resultCount={visibleItems.length}
          onChange={setFilters}
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
            overflow: 'hidden',
            borderRadius: 'shape.borderRadius',
            display: 'grid',
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              lg: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))',
            },
            minHeight: 560,
          }}
        >
          <Box
            ref={queueScroll}
            sx={{
              display: showMobileDetail || (mobile && planOpen) ? 'none' : 'block',
              minWidth: 0,
              maxHeight: { lg: 'calc(100dvh - 330px)' },
              overflowY: { lg: 'auto' },
              borderRight: { lg: 1 },
              borderColor: 'divider',
            }}
          >
            <Stack
              direction="row"
              justifyContent="space-between"
              gap={1}
              alignItems="center"
              sx={{ px: 2, py: 1.25, borderBottom: 1, borderColor: 'divider' }}
            >
              <Typography variant="subtitle2">
                {t('work:workHub.queue.heading', { count: visibleItems.length })}
              </Typography>
              {checkedKeys.size > 0 && (
                <Stack direction="row" gap={0.5} flexWrap="wrap" justifyContent="flex-end">
                  <ActionButton
                    size="small"
                    intent="quiet"
                    disabled={
                      batch.pending ||
                      batch.items.length !== checkedKeys.size ||
                      batch.items.some(
                        (item) => !canChangeWorkspaceWorkStatus(item.legacyItem!, 'IN_PROGRESS')
                      )
                    }
                    onClick={() => batch.open('IN_PROGRESS')}
                  >
                    {t('work:workHub.batch.start')}
                  </ActionButton>
                  <ActionButton
                    size="small"
                    intent="quiet"
                    disabled={
                      batch.pending ||
                      batch.items.length !== checkedKeys.size ||
                      batch.items.some(
                        (item) => !canChangeWorkspaceWorkStatus(item.legacyItem!, 'COMPLETED')
                      )
                    }
                    onClick={() => batch.open('COMPLETED')}
                  >
                    {t('work:workHub.batch.complete')}
                  </ActionButton>
                </Stack>
              )}
            </Stack>
            <WorkHubList
              items={visibleItems}
              selectedKey={selectedItem?.key ?? null}
              checkedKeys={checkedKeys}
              now={now}
              canCheck={(item) =>
                Boolean(
                  item.legacyItem &&
                  (canChangeWorkspaceWorkStatus(item.legacyItem, 'IN_PROGRESS') ||
                    canChangeWorkspaceWorkStatus(item.legacyItem, 'COMPLETED'))
                )
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
              onSchedule={canSchedule ? setScheduleItem : undefined}
            />
          </Box>

          <Box
            sx={{
              display: !mobile || showMobileDetail || planOpen ? 'block' : 'none',
              minWidth: 0,
              overflowY: { lg: 'auto' },
              maxHeight: { lg: 'calc(100dvh - 330px)' },
            }}
          >
            {planOpen ? (
              <Box sx={{ p: { xs: 1.5, md: 2.5 } }}>
                {mobile && (
                  <ActionButton intent="quiet" onClick={closePlan} sx={{ mb: 1 }}>
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
                  disabled={!canCreate || snapshot.completeness === 'UNAVAILABLE'}
                  error={planError}
                  onDraftChange={(next) => {
                    setPlanDraft(next);
                    setPlanError(null);
                  }}
                  onSelect={(item) => {
                    setPlanOpen(false);
                    openItem(item);
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
                  setAssistError(null);
                  setAssistItem(selectedItem);
                }}
                onOpenActivity={
                  selectedActivityRoute ? () => navigate(selectedActivityRoute) : undefined
                }
                specializedContent={
                  <Stack gap={3}>
                    {selectedItem.reference.sourceSystem === 'IDENTITY_GOVERNANCE' ? (
                      <AccessReviewWorkItem workItemRef={selectedItem.reference.sourceReference} />
                    ) : selectedItem.reference.sourceSystem === 'PERSONAL_TASK' ? (
                      <WorkHubPersonalDetail
                        item={selectedItem}
                        canEdit={canCreate}
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
        </Paper>
      )}

      <WorkHubSourceStatusDialog
        open={sourceDialogOpen}
        sources={snapshot.sources}
        onClose={() => setSourceDialogOpen(false)}
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
      />
      <WorkTaskDialog
        open={taskDialogOpen}
        mode={editingTask ? 'edit' : 'create'}
        initialValue={
          editingTask
            ? {
                title: editingTask.title,
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
        disabled={!canCreate}
        onClose={() => {
          setTaskDialogOpen(false);
          setEditingTask(null);
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
      <WorkHubAssistDialog
        open={Boolean(assistItem)}
        item={assistItem}
        verifiedAt={snapshot.receivedAt}
        busy={assistMutation.isPending}
        error={assistError}
        onClose={() => {
          setAssistItem(null);
          setAssistError(null);
        }}
        onSubmit={async (question) => {
          await assistMutation.mutateAsync(question);
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
      />
    </PageCanvas>
  );
}
