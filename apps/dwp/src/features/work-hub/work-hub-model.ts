import type {
  PersonalDayPlan,
  WorkSourceReference,
} from '@dwp-frontend/shared-utils/api/personal-work-contracts';
import {
  workHubReferenceKey,
  workHubUrgency,
  type WorkHubItem,
  type WorkHubSnapshot,
  type WorkHubUrgency,
} from './work-hub-contracts';

export type WorkHubFilters = {
  scope: 'ALL' | 'ACTIONABLE' | 'WAITING' | 'COMPLETED' | 'TODAY';
  query: string;
  sourceSystem: string | null;
  urgency: WorkHubUrgency | null;
};

export function parseWorkHubFilters(params: URLSearchParams): WorkHubFilters {
  const scope = params.get('scope');
  const urgency = params.get('urgency');
  return {
    scope: ['ALL', 'ACTIONABLE', 'WAITING', 'COMPLETED', 'TODAY'].includes(scope ?? '')
      ? (scope as WorkHubFilters['scope'])
      : 'ACTIONABLE',
    query: params.get('q') ?? '',
    sourceSystem: params.get('source') || null,
    urgency: ['OVERDUE', 'DUE_SOON', 'SCHEDULED', 'NO_DUE_DATE'].includes(urgency ?? '')
      ? (urgency as WorkHubUrgency)
      : null,
  };
}

const terminal = new Set(['COMPLETED', 'CANCELLED', 'ARCHIVED']);
const urgencyRank = { OVERDUE: 0, DUE_SOON: 1, SCHEDULED: 2, NO_DUE_DATE: 3 };
const priorityRank = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 };

export function selectWorkHubItems(
  snapshot: WorkHubSnapshot,
  filters: WorkHubFilters,
  now: number,
  today: readonly WorkSourceReference[] = []
): WorkHubItem[] {
  const todayKeys = new Set(today.map(workHubReferenceKey));
  const query = filters.query.trim().toLocaleLowerCase();
  return snapshot.items
    .filter((item) => {
      if (
        filters.scope === 'ACTIONABLE' &&
        (terminal.has(item.lifecycle) || item.waitingFor !== 'ME')
      )
        return false;
      if (
        filters.scope === 'WAITING' &&
        (terminal.has(item.lifecycle) || !['OTHERS', 'UNKNOWN'].includes(item.waitingFor))
      )
        return false;
      if (filters.scope === 'COMPLETED' && item.lifecycle !== 'COMPLETED') return false;
      if (filters.scope === 'TODAY' && !todayKeys.has(item.key)) return false;
      if (filters.sourceSystem && item.reference.sourceSystem !== filters.sourceSystem)
        return false;
      if (filters.urgency && workHubUrgency(item, now) !== filters.urgency) return false;
      return (
        !query ||
        [
          item.title,
          item.summary,
          item.reference.sourceSystem,
          item.reference.sourceReference,
        ].some((value) => value?.toLocaleLowerCase().includes(query))
      );
    })
    .sort((left, right) => {
      if (filters.scope === 'TODAY')
        return (
          today.findIndex((ref) => workHubReferenceKey(ref) === left.key) -
          today.findIndex((ref) => workHubReferenceKey(ref) === right.key)
        );
      return (
        urgencyRank[workHubUrgency(left, now)] - urgencyRank[workHubUrgency(right, now)] ||
        priorityRank[left.priority] - priorityRank[right.priority] ||
        (Date.parse(left.dueAt ?? '') || Infinity) - (Date.parse(right.dueAt ?? '') || Infinity) ||
        left.key.localeCompare(right.key)
      );
    });
}

export function selectWorkHubDetail(
  snapshot: WorkHubSnapshot,
  requestedKey: string | null,
  visible: readonly WorkHubItem[]
): { state: 'SELECTED'; item: WorkHubItem } | { state: 'UNAVAILABLE' | 'EMPTY' } {
  const item = requestedKey
    ? snapshot.items.find((candidate) => candidate.key === requestedKey)
    : visible[0];
  return item ? { state: 'SELECTED', item } : { state: requestedKey ? 'UNAVAILABLE' : 'EMPTY' };
}

export function workHubSummary(snapshot: WorkHubSnapshot, now: number) {
  const active = snapshot.items.filter((item) => !terminal.has(item.lifecycle));
  return {
    active: active.length,
    actionable: active.filter((item) => item.waitingFor === 'ME').length,
    waiting: active.filter((item) => item.waitingFor === 'OTHERS' || item.waitingFor === 'UNKNOWN')
      .length,
    overdue: active.filter((item) => workHubUrgency(item, now) === 'OVERDUE').length,
    completed: snapshot.items.filter((item) => item.lifecycle === 'COMPLETED').length,
    cancelled: snapshot.items.filter((item) => item.lifecycle === 'CANCELLED').length,
    archived: snapshot.items.filter((item) => item.lifecycle === 'ARCHIVED').length,
    complete: snapshot.completeness === 'COMPLETE',
  };
}

/** Preserve unavailable plan entries through their scoped opaque selection reference. */
export function dayPlanSelection(plan: PersonalDayPlan): WorkSourceReference[] {
  return [...plan.items]
    .sort((left, right) => left.position - right.position)
    .map((item) => item.selectionReference);
}

/** Resolves a persisted opaque selection only through the plan's current source receipt. */
export function resolveDayPlanReference(
  plan: PersonalDayPlan | null,
  selectionReference: WorkSourceReference
): WorkSourceReference | null {
  const persisted = plan?.items.find(
    (item) =>
      workHubReferenceKey(item.selectionReference) === workHubReferenceKey(selectionReference)
  );
  if (persisted) {
    return persisted.source.availability === 'UNAVAILABLE' ? null : persisted.source.reference;
  }
  return selectionReference.sourceSystem === 'DAY_PLAN_SELECTION' ? null : selectionReference;
}

export function resolveDayPlanReferences(
  plan: PersonalDayPlan | null,
  selections: readonly WorkSourceReference[]
): WorkSourceReference[] {
  return selections.flatMap((selection) => {
    const reference = resolveDayPlanReference(plan, selection);
    return reference ? [reference] : [];
  });
}

export function dayPlanHasReference(
  plan: PersonalDayPlan | null,
  selections: readonly WorkSourceReference[],
  reference: WorkSourceReference
): boolean {
  const key = workHubReferenceKey(reference);
  return resolveDayPlanReferences(plan, selections).some(
    (candidate) => workHubReferenceKey(candidate) === key
  );
}

export function removeDayPlanWorkReference(
  plan: PersonalDayPlan | null,
  selections: readonly WorkSourceReference[],
  reference: WorkSourceReference
): WorkSourceReference[] {
  const key = workHubReferenceKey(reference);
  return selections.filter((selection) => {
    const resolved = resolveDayPlanReference(plan, selection);
    return resolved
      ? workHubReferenceKey(resolved) !== key
      : workHubReferenceKey(selection) !== key;
  });
}

export function addDayPlanReference(
  items: readonly WorkSourceReference[],
  reference: WorkSourceReference
): WorkSourceReference[] {
  if (items.some((item) => workHubReferenceKey(item) === workHubReferenceKey(reference)))
    return [...items];
  if (items.length >= 100) throw new Error('A day plan supports at most 100 items');
  return [...items, reference];
}

export function moveDayPlanReference(
  items: readonly WorkSourceReference[],
  from: number,
  to: number
): WorkSourceReference[] {
  if (![from, to].every((index) => Number.isInteger(index) && index >= 0 && index < items.length))
    throw new Error('Invalid plan position');
  const next = [...items];
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
}
