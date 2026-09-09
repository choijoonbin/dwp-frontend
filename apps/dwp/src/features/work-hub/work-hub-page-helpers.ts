import type {
  AskDwpOptions,
  AskDwpResponse,
} from '@dwp-frontend/shared-utils/api/agent-runtime-api';
import type { CalendarEvent } from '@dwp-frontend/shared-utils/api/calendar-api';
import {
  askWorkHubAssist,
  isWorkHubAssistSourceSystem,
  workHubAssistDisposition,
} from './work-hub-assist';
import type {
  WorkHubActionKind,
  WorkHubItem,
  WorkHubSnapshot,
  WorkHubSourceId,
} from './work-hub-contracts';
import { isWorkHubItemCommandReady } from './work-hub-command-authority';
import {
  isFreshWorkScheduleCommand,
  type WorkScheduleCommand,
  type WorkScheduleExecutionGuard,
  type WorkScheduleResult,
} from './work-hub-scheduling';

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

export type WorkHubSelectionRequest = {
  work: string | null;
  personalTaskId: string | null;
  item: string | null;
};

/** New links require the canonical key; legacy parameters stay confined to their old owner. */
export function selectedWorkFromRequest(
  items: readonly WorkHubItem[],
  request: WorkHubSelectionRequest
) {
  if (request.work) return items.find((item) => item.key === request.work);
  if (request.personalTaskId)
    return items.find(
      (item) =>
        item.reference.sourceSystem === 'PERSONAL_TASK' &&
        item.reference.sourceReference === request.personalTaskId
    );
  if (!request.item) return undefined;
  return items.find(
    (item) =>
      item.reference.sourceSystem !== 'WORK_ASSIGNMENT' &&
      (item.legacyItem?.id === request.item || item.legacyItem?.workItemId === request.item)
  );
}

export function workHubCalendarRoute(date: string, returnTo: string) {
  return `/calendar/schedule?date=${date}&returnTo=${encodeURIComponent(returnTo)}`;
}

export function uniqueWorkSourceSystems(items: readonly WorkHubItem[]) {
  return [...new Set(items.map((item) => item.reference.sourceSystem))].sort();
}

/** Role filtering remains useful for an active assignment source even when its current page is empty. */
export function shouldShowWorkAssignmentRoleFilter(
  snapshot: Pick<WorkHubSnapshot, 'sources'> | null | undefined,
  enabledSources: readonly WorkHubSourceId[]
) {
  return (
    enabledSources.includes('work-assignments') &&
    snapshot?.sources.some((source) => source.sourceId === 'work-assignments') === true
  );
}

export function canUseWorkAssist(item: WorkHubItem, entitled: boolean) {
  return entitled && isWorkHubAssistSourceSystem(item.reference.sourceSystem);
}

export type WorkHubSnapshotRefetchResult = {
  data?: { snapshot?: WorkHubSnapshot };
  isSuccess: boolean;
  isRefetchError: boolean;
};

/** Rejects stale cached data when the network refetch itself did not succeed. */
export function verifiedWorkHubSnapshotFromRefetch(result: WorkHubSnapshotRefetchResult) {
  if (!result.isSuccess || result.isRefetchError) return null;
  return result.data?.snapshot ?? null;
}

/** Fails closed when a refetch returns cached data alongside an aggregate refresh error. */
export async function executeFreshWorkSchedule({
  command,
  confirmedEvent,
  guard = {},
  refresh,
  execute,
}: {
  command: WorkScheduleCommand;
  confirmedEvent?: CalendarEvent;
  guard?: WorkScheduleExecutionGuard;
  refresh: () => Promise<WorkHubSnapshotRefetchResult>;
  execute: (
    command: WorkScheduleCommand,
    confirmedEvent?: CalendarEvent,
    guard?: WorkScheduleExecutionGuard
  ) => Promise<WorkScheduleResult>;
}): Promise<WorkScheduleResult> {
  const canContinue = () => guard.signal?.aborted !== true && (guard.canContinue?.() ?? true);
  if (!canContinue()) throw new DOMException('Work schedule scope changed', 'AbortError');
  const refreshed = await refresh();
  if (!canContinue()) throw new DOMException('Work schedule scope changed', 'AbortError');
  if (
    !refreshed.isSuccess ||
    refreshed.isRefetchError ||
    !isFreshWorkScheduleCommand(command, refreshed.data?.snapshot)
  ) {
    return {
      state: 'CALENDAR_REJECTED',
      command,
      sourceChanged: false,
      reason: 'WORK_CHANGED',
      retryable: false,
    };
  }
  return execute(command, confirmedEvent, guard);
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
  if (!isWorkHubAssistSourceSystem(item.reference.sourceSystem))
    throw new Error('This Work source does not support AI assistance');
  options.signal?.throwIfAborted();
  const fresh = await refresh();
  options.signal?.throwIfAborted();
  const current = fresh.items.find((candidate) => candidate.key === item.key);
  if (!current || !isWorkHubItemCommandReady(fresh, item)) {
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
