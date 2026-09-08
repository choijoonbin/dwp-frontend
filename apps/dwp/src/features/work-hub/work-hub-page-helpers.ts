import type {
  AskDwpOptions,
  AskDwpResponse,
} from '@dwp-frontend/shared-utils/api/agent-runtime-api';
import {
  askWorkHubAssist,
  isWorkHubAssistSourceSystem,
  workHubAssistDisposition,
} from './work-hub-assist';
import type { WorkHubActionKind, WorkHubItem, WorkHubSnapshot } from './work-hub-contracts';

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
  return entitled && isWorkHubAssistSourceSystem(item.reference.sourceSystem);
}

export async function submitWorkHubAssist({
  item,
  question,
  options,
  locale,
  route,
  refresh,
  refetch,
  resetSelection,
}: {
  item: WorkHubItem;
  question: string;
  options: AskDwpOptions & { conversationId?: string };
  locale: string;
  route: string;
  refresh: () => Promise<WorkHubSnapshot>;
  refetch: () => Promise<unknown>;
  resetSelection: () => void;
}): Promise<AskDwpResponse> {
  options.signal?.throwIfAborted();
  const fresh = await refresh();
  options.signal?.throwIfAborted();
  const current = fresh.items.find((candidate) => candidate.key === item.key);
  if (!current || current.version !== item.version) {
    const source = fresh.sources.find((candidate) => candidate.sourceId === item.sourceId);
    if (
      current ||
      source?.state === 'READY' ||
      source?.state === 'FORBIDDEN' ||
      source?.failureStatus === 404
    )
      resetSelection();
    await refetch();
    throw new Error('Work context changed');
  }
  const response = await askWorkHubAssist(
    current,
    { question, expectedKey: item.key, expectedVersion: item.version },
    fresh.receivedAt,
    { ...options, locale, route }
  );
  if (['PURGE', 'REFRESH'].includes(workHubAssistDisposition(response))) {
    resetSelection();
    await refetch();
  }
  return response;
}
