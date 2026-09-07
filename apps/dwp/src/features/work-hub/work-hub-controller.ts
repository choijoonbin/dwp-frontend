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
  PersonalWorkTaskInput,
  WorkSourceReference,
} from '@dwp-frontend/shared-utils/api/personal-work-contracts';
import { HttpError } from '@dwp-frontend/shared-utils/http-error';
import {
  executeWorkHubAction,
  type WorkHubActionResult,
  type WorkHubCommand,
} from './work-hub-actions';
import { loadWorkHub } from './work-hub-loader';
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
import { launchWorkHubAssist, prepareWorkHubAssist } from './work-hub-assist';
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

function planDraftFingerprint(items: readonly WorkSourceReference[]): string {
  return JSON.stringify(items.map(workHubReferenceKey));
}

/** A design-independent state owner. Plan conflicts adopt the latest receipt before another edit. */
export function createWorkHubController(
  enabledSources: readonly WorkHubSourceId[],
  clients = workHubControllerClients,
  authority = { canUpdatePersonal: false }
) {
  let snapshot: WorkHubSnapshot | null = null;
  let selectedKey: string | null = null;
  let plan: PersonalDayPlan | null = null;
  let planDraft: WorkSourceReference[] = [];
  let pending = false;
  let revision = 0;
  let planRevision = 0;
  let rejectedPlanDraft: { date: string; fingerprint: string } | null = null;
  async function refresh() {
    const requestRevision = ++revision;
    const next = await clients.loadWorkHub({
      enabledSources,
      canUpdatePersonal: authority.canUpdatePersonal,
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
      idempotencyKey: string
    ) {
      const item = snapshot?.items.find((candidate) => candidate.key === selectedKey);
      if (!item || item.reference.sourceSystem !== 'PERSONAL_TASK' || pending)
        throw new Error('Select editable personal work first');
      pending = true;
      try {
        const saved = await clients.updatePersonalWorkTask(
          item.reference.sourceReference,
          input,
          idempotencyKey
        );
        await refresh();
        return saved;
      } finally {
        pending = false;
      }
    },
    prepareAssist() {
      const item = snapshot?.items.find((candidate) => candidate.key === selectedKey);
      if (!item || !snapshot) throw new Error('Select verified work first');
      if (['LEGACY_PROJECTION', 'IDENTITY_GOVERNANCE'].includes(item.reference.sourceSystem))
        throw new Error('Open the source work to verify its current context first');
      return prepareWorkHubAssist(item, snapshot.receivedAt);
    },
    async launchAssist(request: {
      question: string;
      expectedKey: string;
      expectedVersion: number;
    }) {
      await refresh();
      const item = snapshot?.items.find((candidate) => candidate.key === selectedKey);
      if (!item || !snapshot) throw new Error('The selected work is no longer available');
      if (['LEGACY_PROJECTION', 'IDENTITY_GOVERNANCE'].includes(item.reference.sourceSystem))
        throw new Error('Open the source work to verify its current context first');
      return launchWorkHubAssist(item, request, snapshot.receivedAt);
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
    async execute(command: WorkHubCommand): Promise<WorkHubActionResult> {
      const item = snapshot?.items.find((candidate) => candidate.key === selectedKey);
      if (!item || pending) return { state: 'UNAVAILABLE', retryable: false };
      pending = true;
      try {
        const result = await clients.executeWorkHubAction(item, command);
        if (
          result.state === 'CONFIRMED' ||
          result.state === 'CONFLICT' ||
          result.state === 'FORBIDDEN'
        )
          await refresh();
        return result;
      } finally {
        pending = false;
      }
    },
    async capture(input: PersonalWorkTaskInput, idempotencyKey: string) {
      if (pending) throw new Error('A work command is already pending');
      pending = true;
      try {
        const task = await clients.createPersonalWorkTask(input, idempotencyKey);
        selectedKey = workHubReferenceKey({
          sourceSystem: 'PERSONAL_TASK',
          sourceReference: task.taskId,
        });
        await refresh();
        return task;
      } finally {
        pending = false;
      }
    },
    async loadPlan(date: string) {
      const requestRevision = ++planRevision;
      const loaded = await clients.getPersonalDayPlan(date);
      if (requestRevision === planRevision) {
        plan = loaded;
        planDraft = dayPlanSelection(loaded);
        rejectedPlanDraft = null;
      }
      return loaded;
    },
    addToPlan(reference: WorkSourceReference) {
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
      idempotencyKey: string
    ): Promise<WorkHubPlanSaveResult> {
      if (!plan || plan.date !== date || pending)
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
          idempotencyKey
        );
        if (requestRevision === planRevision) {
          plan = saved;
          planDraft = dayPlanSelection(saved);
          rejectedPlanDraft = null;
        }
        return { state: 'SAVED', plan: saved };
      } catch (error) {
        if (error instanceof HttpError && error.status === 409) {
          try {
            const latest = await clients.getPersonalDayPlan(date);
            if (requestRevision !== planRevision)
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
