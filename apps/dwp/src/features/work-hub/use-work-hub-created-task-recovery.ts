import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { WorkSourceReference } from '@dwp-frontend/shared-utils/api/personal-work-contracts';
import {
  useWorkHubCreateRecovery,
  WorkTaskCreateRecoveryDeferredError,
} from './use-work-hub-create-recovery';
import { runWorkHubCreatePlanLane } from './work-hub-create-plan-lane';
import { dayPlanHasReference } from './work-hub-model';
import type { createWorkHubController } from './work-hub-controller';
import { isWorkHubItemCommandReady } from './work-hub-command-authority';
import type { WorkHubSnapshot } from './work-hub-contracts';
import type { WorkHubOperationFeedback } from './work-hub-page-helpers';
import { personalWorkToHub } from './work-hub-source-adapters';
import type { WorkTaskSaveCoordinator } from './work-hub-task-save-coordinator';

function aggregateRetryRevision(snapshot: WorkHubSnapshot | null | undefined) {
  const personal = snapshot?.sources.find(({ sourceId }) => sourceId === 'personal');
  return JSON.stringify([
    snapshot?.completeness ?? 'MISSING',
    personal?.state ?? 'MISSING',
    snapshot?.completeness !== 'UNAVAILABLE' && personal?.state === 'READY'
      ? personal.receivedAt
      : null,
  ]);
}

/** Finishes a create receipt and its optional today-plan follow-up after a route remount. */
export function useWorkHubCreatedTaskRecovery({
  coordinator,
  owner,
  controller,
  snapshot,
  preflight,
  onCreated,
  onPlanDraftChange,
  onPlanError,
  onFeedback,
}: {
  coordinator?: WorkTaskSaveCoordinator;
  owner: string | null;
  controller: ReturnType<typeof createWorkHubController>;
  snapshot: WorkHubSnapshot | undefined;
  /** Returns a newly read aggregate snapshot before the recovered plan write can dispatch. */
  preflight: () => Promise<WorkHubSnapshot | null>;
  onCreated: (reference: WorkSourceReference) => void;
  onPlanDraftChange: (draft: WorkSourceReference[]) => void;
  onPlanError: (message: string | null) => void;
  onFeedback: (feedback: WorkHubOperationFeedback) => void;
}) {
  const { t } = useTranslation('work');
  const queryClient = useQueryClient();
  const retryRevision = aggregateRetryRevision(snapshot);

  useWorkHubCreateRecovery({
    coordinator,
    owner,
    retryRevision,
    onRecovered: async (confirmation, guard) => {
      const reference = {
        sourceSystem: 'PERSONAL_TASK',
        sourceReference: confirmation.task.taskId,
      } as const;
      const planIntent = confirmation.planIntent;
      if (planIntent) {
        await runWorkHubCreatePlanLane(coordinator, guard, async () => {
          const commandSnapshot = await preflight();
          if (!guard.canContinue()) throw new DOMException('Work owner changed', 'AbortError');
          if (!isWorkHubItemCommandReady(commandSnapshot, personalWorkToHub(confirmation.task))) {
            throw new WorkTaskCreateRecoveryDeferredError(
              commandSnapshot ? aggregateRetryRevision(commandSnapshot) : retryRevision
            );
          }
          await controller.loadPlan(planIntent.date, guard);
          if (!guard.canContinue()) throw new DOMException('Work owner changed', 'AbortError');
          const submissionSnapshot = await preflight();
          if (!guard.canContinue()) throw new DOMException('Work owner changed', 'AbortError');
          if (
            !isWorkHubItemCommandReady(submissionSnapshot, personalWorkToHub(confirmation.task))
          ) {
            throw new WorkTaskCreateRecoveryDeferredError(
              submissionSnapshot ? aggregateRetryRevision(submissionSnapshot) : retryRevision
            );
          }
          if (
            !dayPlanHasReference(controller.state().plan, controller.state().planDraft, reference)
          ) {
            const next = controller.addToPlan(reference);
            const result = await controller.savePlan(
              planIntent.date,
              next,
              planIntent.idempotencyKey,
              guard
            );
            if (!guard.canContinue()) throw new DOMException('Work owner changed', 'AbortError');
            if (result.state !== 'SAVED') {
              onPlanDraftChange([...result.draft]);
              onPlanError(
                t(`workHub.todayPlan.${result.state === 'CONFLICT' ? 'conflict' : 'saveFailed'}`)
              );
              throw new WorkTaskCreateRecoveryDeferredError(
                aggregateRetryRevision(submissionSnapshot)
              );
            }
            onPlanDraftChange(controller.state().planDraft);
            onPlanError(null);
            await queryClient.invalidateQueries({
              queryKey: ['workspace', 'work-hub', 'home-plan'],
            });
          } else {
            onPlanDraftChange(controller.state().planDraft);
            onPlanError(null);
          }
        });
      }
      if (!guard.canContinue()) throw new DOMException('Work owner changed', 'AbortError');
      onCreated(reference);
      onFeedback({
        severity: 'success',
        title: t('workHub.taskForm.savedTitle'),
        detail: t('workHub.taskForm.savedDetail'),
      });
    },
  });
}
