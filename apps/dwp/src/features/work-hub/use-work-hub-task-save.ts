import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useEffect, useRef } from 'react';
import { mergeFilterSearchParams } from '@dwp-frontend/design-system';
import { getPersonalWorkTask } from '@dwp-frontend/shared-utils/api/personal-work-api';
import { HttpError } from '@dwp-frontend/shared-utils/http-error';
import type {
  PersonalWorkTask,
  WorkSourceReference,
} from '@dwp-frontend/shared-utils/api/personal-work-contracts';
import { workHubReferenceKey, type WorkHubItem, type WorkHubSnapshot } from './work-hub-contracts';
import type { createWorkHubController } from './work-hub-controller';
import type { WorkTaskDialogSubmission, WorkTaskDialogSubmitContext } from './work-task-dialog';
import type { WorkHubOperationFeedback } from './work-hub-page-helpers';
import { useWorkHubOperationOwner } from './use-work-hub-operation-owner';

export function useWorkHubTaskSave({
  controller,
  snapshot,
  editingTask,
  today,
  onTaskClosed,
  onEditingTaskChange,
  onPlanDraftChange,
  onPlanError,
  onFeedback,
  onCreated,
}: {
  controller: ReturnType<typeof createWorkHubController>;
  snapshot: WorkHubSnapshot | undefined;
  editingTask: PersonalWorkTask | null;
  today: string;
  onTaskClosed: () => void;
  onEditingTaskChange: (task: PersonalWorkTask) => void;
  onPlanDraftChange: (draft: WorkSourceReference[]) => void;
  onPlanError: (message: string | null) => void;
  onFeedback: (feedback: WorkHubOperationFeedback) => void;
  onCreated: (reference: WorkSourceReference) => void;
}) {
  const { t } = useTranslation('work');
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const owner = useWorkHubOperationOwner();
  const current = useRef({ owner, controller, taskId: editingTask?.taskId });
  current.current = { owner, controller, taskId: editingTask?.taskId };
  const search = useRef(searchParams);
  search.current = searchParams;
  const mounted = useRef(false);
  const activeRun = useRef<object | null>(null);
  useEffect(() => {
    mounted.current = true;
    activeRun.current = null;
    return () => {
      mounted.current = false;
      activeRun.current = null;
    };
  }, [owner, controller]);
  return async (value: WorkTaskDialogSubmission, context: WorkTaskDialogSubmitContext) => {
    const identity = current.current;
    if (!owner || !mounted.current || activeRun.current)
      throw new DOMException('Work operation unavailable', 'AbortError');
    const run = {};
    activeRun.current = run;
    let ownDialogClosed = false;
    const isCurrent = () =>
      mounted.current &&
      activeRun.current === run &&
      current.current.owner === identity.owner &&
      current.current.controller === identity.controller &&
      (ownDialogClosed || current.current.taskId === identity.taskId);
    const assertCurrent = () => {
      if (!isCurrent()) throw new DOMException('Work owner changed', 'AbortError');
    };
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
        assertCurrent();
      } else {
        const created = await controller.capture(input, context.idempotencyKey);
        assertCurrent();
        createdReference = {
          sourceSystem: 'PERSONAL_TASK',
          sourceReference: created.taskId,
        };
        onCreated(createdReference);
        setSearchParams(
          mergeFilterSearchParams(search.current, {
            work: workHubReferenceKey(createdReference),
            item: null,
            personalTaskId: null,
            compose: null,
          }),
          { replace: true }
        );
      }
      ownDialogClosed = true;
      onTaskClosed();
      if (editingTask)
        setSearchParams(mergeFilterSearchParams(search.current, { compose: null }), {
          replace: true,
        });
      let planSaveFailed = false;
      if (createdReference && context.addToTodayPlan) {
        const next = controller.addToPlan(createdReference);
        onPlanDraftChange(next);
        try {
          const planResult = await controller.savePlan(today, next, crypto.randomUUID());
          assertCurrent();
          if (planResult.state === 'SAVED') {
            onPlanDraftChange(controller.state().planDraft);
            onPlanError(null);
          } else {
            planSaveFailed = true;
            onPlanDraftChange([...planResult.draft]);
            onPlanError(
              t(
                `work:workHub.todayPlan.${
                  planResult.state === 'CONFLICT' ? 'conflict' : 'saveFailed'
                }`
              )
            );
          }
        } catch {
          assertCurrent();
          planSaveFailed = true;
          onPlanError(t('work:workHub.todayPlan.saveFailed'));
        }
      }
      onFeedback({
        severity: planSaveFailed ? 'warning' : 'success',
        title: t('work:workHub.taskForm.savedTitle'),
        detail: planSaveFailed
          ? `${t('work:workHub.taskForm.savedDetail')} ${t('work:workHub.todayPlan.saveFailed')}`
          : t('work:workHub.taskForm.savedDetail'),
      });
      await queryClient.invalidateQueries({ queryKey: ['workspace', 'work-hub'] });
    } catch (error) {
      if (!isCurrent()) throw error;
      if (editingTask && error instanceof HttpError && error.status === 409) {
        try {
          const latest = await getPersonalWorkTask(editingTask.taskId);
          assertCurrent();
          onEditingTaskChange(latest);
          queryClient.setQueryData(
            ['workspace', 'work-hub', 'personal-detail', latest.taskId, latest.version],
            latest
          );
          await queryClient.invalidateQueries({ queryKey: ['workspace', 'work-hub'] });
          assertCurrent();
          onFeedback({
            severity: 'warning',
            title: t('work:workHub.results.CONFLICT.title'),
            detail: t('work:workHub.results.CONFLICT.detail'),
          });
        } catch {
          assertCurrent();
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
        ownDialogClosed = true;
        onTaskClosed();
        await queryClient.invalidateQueries({ queryKey: ['workspace', 'work-hub'] });
        assertCurrent();
      }
      onFeedback({
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
    } finally {
      if (activeRun.current === run) activeRun.current = null;
    }
  };
}
