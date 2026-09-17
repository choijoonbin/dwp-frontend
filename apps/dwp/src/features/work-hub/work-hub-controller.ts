import {
  createPersonalWorkTask,
  getPersonalDayPlan,
  getPersonalWorkTask,
  getPersonalWorkTimeline,
  replacePersonalDayPlan,
  updatePersonalWorkTask,
} from '@dwp-frontend/shared-utils/api/personal-work-api';
import type {
  PersonalDayPlan,
  PersonalWorkStatus,
  PersonalWorkTask,
  PersonalWorkTaskInput,
  WorkSourceReference,
} from '@dwp-frontend/shared-utils/api/personal-work-contracts';
import { HttpError } from '@dwp-frontend/shared-utils/http-error';
import type { MailProposalMutationBinding } from '@dwp-frontend/shared-utils';
import {
  executeWorkHubAction,
  type WorkHubActionGuard,
  type WorkHubActionResult,
  type WorkHubCommand,
} from './work-hub-actions';
import { loadWorkHub } from './work-hub-loader';
import {
  canExecuteWorkHubAction,
  isWorkAssignmentReference,
  personalTaskInputUsesUnsupportedSource,
} from './work-hub-command-authority';
import {
  workHubItemRoute,
  workHubReferenceKey,
  type WorkHubSnapshot,
  type WorkHubSourceId,
} from './work-hub-contracts';
import {
  addDayPlanReference,
  removeDayPlanWorkReference,
  dayPlanSelection,
  moveDayPlanReference,
  parseWorkHubFilters,
  resolveDayPlanReferences,
  selectWorkHubDetail,
  selectWorkHubItems,
  workHubSummary,
} from './work-hub-model';
import { hydrateWorkSource } from './work-hub-source-hydration';
import {
  isPersonalDayPlanReceipt,
  isPersonalDayPlanSaveReceipt,
  isPersonalTaskCreateReceipt,
  isPersonalTaskEditReceipt,
} from './work-hub-personal-save-receipt';
import {
  executeWorkSchedule,
  loadWorkSchedules,
  prepareWorkSchedule,
  unlinkWorkSchedule,
} from './work-hub-scheduling';

export const workHubControllerClients = {
  loadWorkHub,
  executeWorkHubAction,
  createPersonalWorkTask,
  getPersonalDayPlan,
  getPersonalWorkTask,
  getPersonalWorkTimeline,
  replacePersonalDayPlan,
  updatePersonalWorkTask,
};

export type WorkHubPlanSaveResult =
  | { state: 'SAVED'; plan: PersonalDayPlan }
  | {
      state: 'CONFLICT';
      draft: WorkSourceReference[];
      submittedDraft: WorkSourceReference[];
      plan: PersonalDayPlan;
    }
  | { state: 'UNAVAILABLE'; draft: WorkSourceReference[] };

type PersonalTaskSaveGuard = WorkHubActionGuard & {
  expectedStatus?: PersonalWorkStatus;
  reviewedTask?: PersonalWorkTask;
};

function planDraftFingerprint(items: readonly WorkSourceReference[]): string {
  return JSON.stringify(items.map(workHubReferenceKey));
}

/** A design-independent state owner. Plan conflicts adopt the latest receipt before another edit. */
export function createWorkHubController(
  enabledSources: readonly WorkHubSourceId[],
  clients = workHubControllerClients,
  authority: { canUpdatePersonal: boolean; actorId?: number | null } = {
    canUpdatePersonal: false,
    actorId: null,
  }
) {
  let snapshot: WorkHubSnapshot | null = null;
  let selectedKey: string | null = null;
  let plan: PersonalDayPlan | null = null;
  let planDraft: WorkSourceReference[] = [];
  let pending = false;
  let revision = 0;
  let planRevision = 0;
  let rejectedPlanDraft: { date: string; fingerprint: string } | null = null;
  const canContinue = (guard: WorkHubActionGuard) =>
    !guard.signal?.aborted && (guard.canContinue?.() ?? true);
  async function refresh() {
    const requestRevision = ++revision;
    const next = await clients.loadWorkHub({
      enabledSources,
      canUpdatePersonal: authority.canUpdatePersonal,
      actorId: authority.actorId ?? null,
    });
    if (requestRevision === revision) snapshot = next;
    return next;
  }
  return {
    state: () => ({ snapshot, selectedKey, plan, planDraft: [...planDraft], pending }),
    adopt(verifiedSnapshot: WorkHubSnapshot) {
      if (!snapshot || Date.parse(verifiedSnapshot.receivedAt) >= Date.parse(snapshot.receivedAt))
        snapshot = verifiedSnapshot;
    },
    refresh,
    prepareSchedule(
      calendar: Parameters<typeof prepareWorkSchedule>[1],
      input: Parameters<typeof prepareWorkSchedule>[2]
    ) {
      const item = snapshot?.items.find((candidate) => candidate.key === selectedKey);
      if (!item) throw new Error('Select verified work first');
      return prepareWorkSchedule(item, calendar, input);
    },
    executeSchedule: executeWorkSchedule,
    loadSchedules: loadWorkSchedules,
    unlinkSchedule: unlinkWorkSchedule,
    async loadPersonalDetail() {
      const item = snapshot?.items.find((candidate) => candidate.key === selectedKey);
      if (!item || item.reference.sourceSystem !== 'PERSONAL_TASK')
        throw new Error('Select personal work first');
      const task = await clients.getPersonalWorkTask(item.reference.sourceReference);
      return { task, source: snapshot ? hydrateWorkSource(task.source, snapshot) : null };
    },
    async loadPersonalTimeline(page = 0) {
      const item = snapshot?.items.find((candidate) => candidate.key === selectedKey);
      if (!item || item.reference.sourceSystem !== 'PERSONAL_TASK')
        throw new Error('Select personal work first');
      return clients.getPersonalWorkTimeline(item.reference.sourceReference, page);
    },
    async savePersonalTask(
      input: PersonalWorkTaskInput & { version: number },
      idempotencyKey: string,
      guard: PersonalTaskSaveGuard = {}
    ) {
      const item = snapshot?.items.find((candidate) => candidate.key === selectedKey);
      if (
        !item ||
        item.reference.sourceSystem !== 'PERSONAL_TASK' ||
        pending ||
        !canContinue(guard) ||
        personalTaskInputUsesUnsupportedSource(input)
      )
        throw new Error('Select editable personal work first');
      pending = true;
      try {
        const saved = await clients.updatePersonalWorkTask(
          item.reference.sourceReference,
          input,
          idempotencyKey,
          guard.signal
        );
        if (
          !canContinue(guard) ||
          !guard.reviewedTask ||
          !isPersonalTaskEditReceipt(
            saved,
            item.reference.sourceReference,
            input,
            guard.expectedStatus ?? item.lifecycle,
            guard.reviewedTask
          )
        ) {
          throw new Error('Unverified personal task update receipt');
        }
        return saved;
      } finally {
        pending = false;
      }
    },
    view(params: URLSearchParams, now: number) {
      if (!snapshot) return null;
      const verifiedSnapshot = snapshot;
      const filters = parseWorkHubFilters(params);
      const todayReferences = resolveDayPlanReferences(plan, planDraft);
      const items = selectWorkHubItems(snapshot, filters, now, todayReferences);
      const selection = selectWorkHubDetail(snapshot, params.get('work') ?? selectedKey, items);
      return {
        filters,
        items,
        selection,
        summary: workHubSummary(snapshot, now),
        routes: new Map(items.map((item) => [item.key, workHubItemRoute(item.reference)])),
        planItems:
          plan?.items.map((item) => ({
            ...item,
            verifiedSource: hydrateWorkSource(item.source, verifiedSnapshot),
          })) ?? [],
      };
    },
    select: (reference: WorkSourceReference | null) => {
      selectedKey = reference ? workHubReferenceKey(reference) : null;
    },
    async execute(
      command: WorkHubCommand,
      guard: WorkHubActionGuard = {}
    ): Promise<WorkHubActionResult> {
      const item = snapshot?.items.find((candidate) => candidate.key === selectedKey);
      const canContinue = () => !guard.signal?.aborted && (guard.canContinue?.() ?? true);
      if (
        !item ||
        !canExecuteWorkHubAction(snapshot, item, command.kind) ||
        pending ||
        !canContinue()
      )
        return { state: 'UNAVAILABLE', retryable: false };
      pending = true;
      try {
        return await clients.executeWorkHubAction(item, command, undefined, guard);
      } finally {
        pending = false;
      }
    },
    async capture(
      input: PersonalWorkTaskInput,
      idempotencyKey: string,
      guard: WorkHubActionGuard = {},
      proposalBinding?: MailProposalMutationBinding
    ) {
      if (pending || !canContinue(guard) || personalTaskInputUsesUnsupportedSource(input))
        throw new Error('A work command is already pending or its source is unsupported');
      pending = true;
      try {
        const task = await clients.createPersonalWorkTask(
          input,
          idempotencyKey,
          guard.signal,
          proposalBinding
        );
        if (!canContinue(guard) || !isPersonalTaskCreateReceipt(task, input)) {
          throw new Error('Unverified personal task creation receipt');
        }
        selectedKey = workHubReferenceKey({
          sourceSystem: 'PERSONAL_TASK',
          sourceReference: task.taskId,
        });
        return task;
      } finally {
        pending = false;
      }
    },
    async loadPlan(date: string, guard: WorkHubActionGuard = {}) {
      const requestRevision = ++planRevision;
      const loaded = await clients.getPersonalDayPlan(date, guard.signal);
      if (requestRevision === planRevision && canContinue(guard)) {
        plan = loaded;
        planDraft = dayPlanSelection(loaded);
        rejectedPlanDraft = null;
      }
      return loaded;
    },
    addToPlan(reference: WorkSourceReference) {
      if (isWorkAssignmentReference(reference)) return [...planDraft];
      const existing = plan?.items.find(
        (item) =>
          item.source.availability !== 'UNAVAILABLE' &&
          workHubReferenceKey(item.source.reference) === workHubReferenceKey(reference)
      );
      planDraft = addDayPlanReference(planDraft, existing?.selectionReference ?? reference);
      return [...planDraft];
    },
    movePlanItem(from: number, to: number) {
      planDraft = moveDayPlanReference(planDraft, from, to);
      return [...planDraft];
    },
    removePlanItem(reference: WorkSourceReference) {
      planDraft = removeDayPlanWorkReference(plan, planDraft, reference);
      return [...planDraft];
    },
    async savePlan(
      date: string,
      items: WorkSourceReference[],
      idempotencyKey: string,
      guard: WorkHubActionGuard = {}
    ): Promise<WorkHubPlanSaveResult> {
      if (
        !plan ||
        plan.date !== date ||
        pending ||
        !canContinue(guard) ||
        items.some(isWorkAssignmentReference)
      )
        return { state: 'UNAVAILABLE', draft: plan ? [...planDraft] : [...items] };
      const submittedFingerprint = planDraftFingerprint(items);
      if (
        rejectedPlanDraft?.date === date &&
        rejectedPlanDraft.fingerprint === submittedFingerprint
      ) {
        return {
          state: 'CONFLICT',
          draft: [...planDraft],
          submittedDraft: [...items],
          plan,
        };
      }
      const base = plan;
      const requestRevision = ++planRevision;
      planDraft = [...items];
      pending = true;
      try {
        const saved = await clients.replacePersonalDayPlan(
          date,
          { version: base.version, items },
          idempotencyKey,
          guard.signal
        );
        if (
          !canContinue(guard) ||
          requestRevision !== planRevision ||
          !isPersonalDayPlanSaveReceipt(saved, date, base.version, items, base)
        ) {
          return { state: 'UNAVAILABLE', draft: [...items] };
        }
        plan = saved;
        planDraft = dayPlanSelection(saved);
        rejectedPlanDraft = null;
        return { state: 'SAVED', plan: saved };
      } catch (error) {
        if (!canContinue(guard)) return { state: 'UNAVAILABLE', draft: [...items] };
        if (error instanceof HttpError && error.status === 409) {
          try {
            const latest = await clients.getPersonalDayPlan(date, guard.signal);
            if (
              !canContinue(guard) ||
              requestRevision !== planRevision ||
              !isPersonalDayPlanReceipt(latest, date, base.version)
            )
              return { state: 'UNAVAILABLE', draft: [...planDraft] };
            const latestDraft = dayPlanSelection(latest);
            plan = latest;
            planDraft = latestDraft;
            rejectedPlanDraft = { date, fingerprint: submittedFingerprint };
            if (planDraftFingerprint(latestDraft) === submittedFingerprint) {
              rejectedPlanDraft = null;
              return { state: 'SAVED', plan: latest };
            }
            return {
              state: 'CONFLICT',
              draft: [...latestDraft],
              submittedDraft: [...items],
              plan: latest,
            };
          } catch {
            return { state: 'UNAVAILABLE', draft: [...items] };
          }
        }
        return {
          state: 'UNAVAILABLE',
          draft: [...items],
        };
      } finally {
        pending = false;
      }
    },
  };
}
