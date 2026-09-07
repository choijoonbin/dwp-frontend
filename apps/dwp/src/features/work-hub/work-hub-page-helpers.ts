import type { WorkHubActionKind, WorkHubItem } from './work-hub-contracts';

export type WorkHubOperationFeedback = {
  severity: 'success' | 'warning' | 'error' | 'info';
  title: string;
  detail: string;
};

const personalActions = new Set<WorkHubActionKind>([
  'PERSONAL_START',
  'PERSONAL_WAIT',
  'PERSONAL_COMPLETE',
  'PERSONAL_REOPEN',
  'PERSONAL_ARCHIVE',
]);

export function isPersonalWorkAction(kind: WorkHubActionKind) {
  return personalActions.has(kind);
}

export function selectedWorkFromRequest(items: readonly WorkHubItem[], requested: string | null) {
  if (!requested) return undefined;
  return items.find(
    (item) =>
      item.key === requested ||
      item.reference.sourceReference === requested ||
      item.legacyItem?.id === requested ||
      item.legacyItem?.workItemId === requested
  );
}

export function workHubCalendarRoute(date: string, returnTo: string) {
  return `/calendar/schedule?date=${date}&returnTo=${encodeURIComponent(returnTo)}`;
}

export function uniqueWorkSourceSystems(items: readonly WorkHubItem[]) {
  return [...new Set(items.map((item) => item.reference.sourceSystem))].sort();
}

export function canUseWorkAssist(item: WorkHubItem, entitled: boolean) {
  return (
    entitled && !['IDENTITY_GOVERNANCE', 'LEGACY_PROJECTION'].includes(item.reference.sourceSystem)
  );
}
