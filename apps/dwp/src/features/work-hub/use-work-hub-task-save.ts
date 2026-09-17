import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useEffect, useRef } from 'react';
import { mergeFilterSearchParams } from '@dwp-frontend/design-system';
import { getPersonalWorkTask } from '@dwp-frontend/shared-utils/api/personal-work-api';
import { HttpError } from '@dwp-frontend/shared-utils/http-error';
import type { MailProposalMutationBinding } from '@dwp-frontend/shared-utils';
import type {
  PersonalWorkTask,
  WorkSourceReference,
} from '@dwp-frontend/shared-utils/api/personal-work-contracts';
import { workHubReferenceKey, type WorkHubItem, type WorkHubSnapshot } from './work-hub-contracts';
import type { createWorkHubController } from './work-hub-controller';
import type { WorkTaskDialogSubmission, WorkTaskDialogSubmitContext } from './work-task-dialog';
import type { WorkHubOperationFeedback } from './work-hub-page-helpers';
import { runWorkHubCreatePlanLane } from './work-hub-create-plan-lane';
import {
  isPersonalTaskConflictReceipt,
  isPersonalTaskReviewedReceipt,
} from './work-hub-personal-save-receipt';
import {
  canUseWorkHubGenericAdjunct,
  isWorkHubItemCommandReady,
  isWorkHubSourceCommandReady,
} from './work-hub-command-authority';
import { personalWorkToHub } from './work-hub-source-adapters';
import { dayPlanHasReference } from './work-hub-model';
import { useWorkHubOperationOwner } from './use-work-hub-operation-owner';
import type {
  WorkTaskCreateClaim,
  WorkTaskSaveCoordinator,
} from './work-hub-task-save-coordinator';

export type WorkTaskScheduleHandoff = Readonly<{
  item: WorkHubItem;
  snapshot: WorkHubSnapshot;
}>;

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
  onCreateCompleted,
  proposalBinding,
  onScheduleCreated,
  taskSaveCoordinator,
  enabled,
  preflight,
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
  /** Runs only after a newly created task and its requested follow-up work are complete. */
  onCreateCompleted?: (reference: WorkSourceReference) => void | Promise<void>;
  proposalBinding?: MailProposalMutationBinding;
  /** Opens scheduling only after the created task is present in an exact, command-ready snapshot. */
  onScheduleCreated?: (handoff: WorkTaskScheduleHandoff) => void;
  taskSaveCoordinator?: WorkTaskSaveCoordinator;
  enabled: boolean;
  /** Returns a newly read aggregate snapshot before create or edit can dispatch. */
  preflight: () => Promise<WorkHubSnapshot | null>;
}) {
  const { t } = useTranslation('work');
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const owner = useWorkHubOperationOwner();
  const current = useRef({ owner, controller, taskId: editingTask?.taskId, enabled });
  current.current = { owner, controller, taskId: editingTask?.taskId, enabled };
  const search = useRef(searchParams);
  search.current = searchParams;
  const mounted = useRef(false);
  const activeRun = useRef<{ abort: AbortController } | null>(null);
  useEffect(() => {
    mounted.current = true;
    activeRun.current = null;
    return () => {
      mounted.current = false;
      activeRun.current?.abort.abort();
      activeRun.current = null;
    };
  }, [owner, controller, enabled]);
  return async (value: WorkTaskDialogSubmission, context: WorkTaskDialogSubmitContext) => {
    const identity = current.current;
    if (!owner || !identity.enabled || !mounted.current || activeRun.current)
      throw new DOMException('Work operation unavailable', 'AbortError');
    const run = { abort: new AbortController() };
    activeRun.current = run;
    let ownDialogClosed = false;
    const isCurrent = () =>
      mounted.current &&
      activeRun.current === run &&
      current.current.owner === identity.owner &&
      current.current.controller === identity.controller &&
      current.current.enabled &&
      (ownDialogClosed || current.current.taskId === identity.taskId);
    const assertCurrent = () => {
      if (!isCurrent()) throw new DOMException('Work owner changed', 'AbortError');
    };
    const { version, ...input } = value;
    let claimedCreate: WorkTaskCreateClaim | null = null;
    let editMutationFingerprint: string | null = null;
    try {
      const commandSnapshot = await preflight();
      assertCurrent();
      if (!commandSnapshot || !isWorkHubSourceCommandReady(commandSnapshot, 'personal')) {
        throw new HttpError('Personal work source is unavailable', 503);
      }
      const reviewedItem = editingTask
        ? snapshot?.items.find(
            (candidate) =>
              candidate.sourceId === 'personal' &&
              candidate.reference.sourceSystem === 'PERSONAL_TASK' &&
              candidate.reference.sourceReference === editingTask.taskId
          )
        : null;
      const currentItem = reviewedItem
        ? commandSnapshot.items.find(
            (candidate) => candidate.sourceId === 'personal' && candidate.key === reviewedItem.key
          )
        : null;
      if (editingTask) {
        if (
          !reviewedItem ||
          !currentItem ||
          !isWorkHubItemCommandReady(commandSnapshot, reviewedItem)
        ) {
          throw new HttpError('Personal work changed', 409);
        }
        const currentTask = await getPersonalWorkTask(editingTask.taskId, run.abort.signal);
        assertCurrent();
        if (
          !isPersonalTaskReviewedReceipt(currentTask, editingTask.taskId, editingTask.version) ||
          currentTask.status !== editingTask.status
        ) {
          throw new HttpError('Personal work changed', 409);
        }
      }
      let createdReference: WorkHubItem['reference'] | null = null;
      let createdPlanIntent: { date: string; idempotencyKey: string } | null = null;
      let createdTask: PersonalWorkTask | null = null;
      let scheduleHandoff: WorkTaskScheduleHandoff | null = null;
      let scheduleHandoffFailed = false;
      if (editingTask) {
        if (version === undefined) throw new Error('version required');
        controller.adopt(commandSnapshot);
        controller.select(currentItem!.reference);
        const editInput = { ...input, version };
        editMutationFingerprint = `EDIT:${JSON.stringify([editingTask.taskId, editInput])}`;
        const idempotencyKey = taskSaveCoordinator
          ? taskSaveCoordinator.mutationKey(owner, editMutationFingerprint, context.idempotencyKey)
          : context.idempotencyKey;
        await controller.savePersonalTask(editInput, idempotencyKey, {
          signal: run.abort.signal,
          canContinue: isCurrent,
          expectedStatus: editingTask.status,
          reviewedTask: editingTask,
        });
        assertCurrent();
        taskSaveCoordinator?.acknowledgeMutation(owner, editMutationFingerprint);
        editMutationFingerprint = null;
      } else {
        const planIntent = context.addToTodayPlan
          ? { date: today, idempotencyKey: crypto.randomUUID() }
          : null;
        const confirmation = taskSaveCoordinator
          ? await taskSaveCoordinator.runCreate(
              owner,
              input,
              context.idempotencyKey,
              (replayInput, idempotencyKey, guard) =>
                controller.capture(replayInput, idempotencyKey, guard, proposalBinding),
              planIntent
            )
          : {
              confirmationId: 0,
              planIntent,
              task: await controller.capture(
                input,
                context.idempotencyKey,
                {
                  signal: run.abort.signal,
                  canContinue: isCurrent,
                },
                proposalBinding
              ),
            };
        const created = confirmation.task;
        createdTask = created;
        createdPlanIntent = confirmation.planIntent;
        if (taskSaveCoordinator) {
          const claim = taskSaveCoordinator.claimCreate(owner, confirmation.confirmationId);
          if (!claim) {
            throw new DOMException('Work create receipt already claimed', 'AbortError');
          }
          claimedCreate = claim;
        }
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
      if (createdReference && createdPlanIntent && createdTask) {
        const planReference = createdReference;
        const planIntent = createdPlanIntent;
        const verifiedCreatedTask = createdTask;
        try {
          await runWorkHubCreatePlanLane(
            taskSaveCoordinator,
            { signal: run.abort.signal, canContinue: isCurrent },
            async () => {
              const planSnapshot = await preflight();
              assertCurrent();
              if (
                !isWorkHubItemCommandReady(planSnapshot, personalWorkToHub(verifiedCreatedTask))
              ) {
                throw new HttpError('Created personal work is unavailable', 503);
              }
              await controller.loadPlan(planIntent.date, {
                signal: run.abort.signal,
                canContinue: isCurrent,
              });
              assertCurrent();
              const submissionSnapshot = await preflight();
              assertCurrent();
              if (
                !isWorkHubItemCommandReady(
                  submissionSnapshot,
                  personalWorkToHub(verifiedCreatedTask)
                )
              ) {
                throw new HttpError('Created personal work is unavailable', 503);
              }
              if (
                dayPlanHasReference(
                  controller.state().plan,
                  controller.state().planDraft,
                  planReference
                )
              ) {
                onPlanDraftChange(controller.state().planDraft);
                onPlanError(null);
                return;
              }
              const next = controller.addToPlan(planReference);
              onPlanDraftChange(next);
              try {
                const planResult = await controller.savePlan(
                  planIntent.date,
                  next,
                  planIntent.idempotencyKey,
                  { signal: run.abort.signal, canContinue: isCurrent }
                );
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
              } catch (error) {
                assertCurrent();
                planSaveFailed = true;
                onPlanError(t('work:workHub.todayPlan.saveFailed'));
                if (error instanceof HttpError) throw error;
              }
            }
          );
        } catch {
          assertCurrent();
          planSaveFailed = true;
          onPlanError(t('work:workHub.todayPlan.saveFailed'));
        }
      }
      if (createdReference && createdTask && context.scheduleAfterCreate) {
        try {
          const scheduleSnapshot = await preflight();
          assertCurrent();
          const reviewedCreated = personalWorkToHub(createdTask, true);
          const exactCreated = scheduleSnapshot?.items.find(
            (candidate) =>
              candidate.sourceId === 'personal' &&
              candidate.key === reviewedCreated.key &&
              candidate.version === reviewedCreated.version
          );
          if (
            !scheduleSnapshot ||
            !exactCreated ||
            !canUseWorkHubGenericAdjunct(exactCreated, 'CALENDAR') ||
            !isWorkHubItemCommandReady(scheduleSnapshot, reviewedCreated)
          ) {
            scheduleHandoffFailed = true;
          } else {
            controller.adopt(scheduleSnapshot);
            controller.select(exactCreated.reference);
            scheduleHandoff = { item: exactCreated, snapshot: scheduleSnapshot };
          }
        } catch {
          assertCurrent();
          scheduleHandoffFailed = true;
        }
      }
      await queryClient.invalidateQueries({ queryKey: ['workspace', 'work-hub'] });
      assertCurrent();
      if (scheduleHandoff) onScheduleCreated?.(scheduleHandoff);
      const followUpWarnings = [
        ...(planSaveFailed ? [t('work:workHub.todayPlan.saveFailed')] : []),
        ...(scheduleHandoffFailed ? [t('work:workHub.taskForm.scheduleOpenFailedDetail')] : []),
      ];
      onFeedback({
        severity: followUpWarnings.length > 0 ? 'warning' : 'success',
        title: t('work:workHub.taskForm.savedTitle'),
        detail: [t('work:workHub.taskForm.savedDetail'), ...followUpWarnings].join(' '),
      });
      if (claimedCreate !== null) {
        if (planSaveFailed) taskSaveCoordinator?.releaseCreate(owner, claimedCreate);
        else taskSaveCoordinator?.acknowledgeCreate(owner, claimedCreate);
        claimedCreate = null;
      }
      if (createdReference) await onCreateCompleted?.(createdReference);
    } catch (error) {
      if (claimedCreate !== null) {
        taskSaveCoordinator?.releaseCreate(owner, claimedCreate);
        claimedCreate = null;
      }
      if (!isCurrent()) throw error;
      if (editingTask && error instanceof HttpError && error.status === 409) {
        try {
          const latest = await getPersonalWorkTask(editingTask.taskId, run.abort.signal);
          assertCurrent();
          if (
            !isPersonalTaskConflictReceipt(
              latest,
              editingTask.taskId,
              version ?? editingTask.version
            )
          ) {
            throw new Error('Unverified personal task conflict receipt');
          }
          if (editMutationFingerprint) {
            taskSaveCoordinator?.acknowledgeMutation(owner, editMutationFingerprint);
            editMutationFingerprint = null;
          }
          onEditingTaskChange(latest);
          queryClient.setQueryData(
            ['workspace', 'work-hub', 'personal-detail', latest.taskId, latest.version, owner],
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
        if (editMutationFingerprint) {
          taskSaveCoordinator?.acknowledgeMutation(owner, editMutationFingerprint);
          editMutationFingerprint = null;
        }
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
