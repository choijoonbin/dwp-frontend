import { resolveZonedDateKey } from '@dwp-frontend/shared-i18n';

import type { WorkHubItem } from './work-hub-contracts';

export type WorkTodayPlanCandidateFilters = {
  query: string;
  due: 'all' | 'today' | 'overdue' | 'scheduled' | 'none';
  status: 'all' | 'actionable' | 'OPEN' | 'IN_PROGRESS' | 'WAITING';
};

export type WorkTodayPlanDateContext = { date: string; timeZone: string; now: number };

export function isWorkDueOnPlanDate(
  item: Pick<WorkHubItem, 'dueAt'>,
  context: Pick<WorkTodayPlanDateContext, 'date' | 'timeZone'>
) {
  return Boolean(item.dueAt && resolveZonedDateKey(item.dueAt, context.timeZone) === context.date);
}

/** "Today" is a calendar date in the selected zone; "overdue" uses the actual instant. */
export function filterWorkTodayPlanCandidates(
  candidates: readonly WorkHubItem[],
  filters: WorkTodayPlanCandidateFilters,
  context: WorkTodayPlanDateContext,
  sourceLabel: (item: WorkHubItem) => string
): WorkHubItem[] {
  const query = filters.query.trim().toLocaleLowerCase();
  return candidates.filter((item) => {
    const dueInstant = item.dueAt ? Date.parse(item.dueAt) : Number.NaN;
    const dueDate = item.dueAt ? resolveZonedDateKey(item.dueAt, context.timeZone) : null;
    if (filters.due === 'today' && !isWorkDueOnPlanDate(item, context)) return false;
    if (filters.due === 'overdue' && !(dueInstant < context.now)) return false;
    if (filters.due === 'scheduled' && !(dueDate && dueDate > context.date)) return false;
    // An invalid date is unknown, not a claim that the source explicitly has no due date.
    if (filters.due === 'none' && item.dueAt !== null) return false;
    if (filters.status === 'actionable' && item.waitingFor !== 'ME') return false;
    if (
      filters.status !== 'all' &&
      filters.status !== 'actionable' &&
      item.lifecycle !== filters.status
    )
      return false;
    return (
      !query ||
      [item.title, item.displayId, sourceLabel(item)].some((value) =>
        value?.toLocaleLowerCase().includes(query)
      )
    );
  });
}
