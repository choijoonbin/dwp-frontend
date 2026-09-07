import {
  workspaceWorkItemRoute,
  rankWorkspaceWorkItems,
} from '@dwp-frontend/shared-utils/api/workspace-work-policy';
import type { DwaionConversationSummary, WorkspaceWorkItem } from '@dwp-frontend/shared-utils';

export type HomeLoadState = 'loading' | 'error' | 'ready';

export function homeLoadState(query: { isPending: boolean; isError: boolean }): HomeLoadState {
  return query.isError ? 'error' : query.isPending ? 'loading' : 'ready';
}

function timestamp(value: string | null | undefined, fallback: number): number {
  const parsed = value ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function homePriorityWork(items: readonly WorkspaceWorkItem[]): WorkspaceWorkItem[] {
  return rankWorkspaceWorkItems(items).slice(0, 4);
}

export function homeRecentConversations(items: readonly DwaionConversationSummary[]) {
  return [...items]
    .sort((left, right) => timestamp(right.lastMessageAt, 0) - timestamp(left.lastMessageAt, 0))
    .slice(0, 3);
}

export function homeWorkRoute(item: WorkspaceWorkItem): string {
  return workspaceWorkItemRoute(item);
}

export function homeIsOverdue(item: WorkspaceWorkItem, now: number): boolean {
  return item.status !== 'completed' && timestamp(item.dueAt, Infinity) < now;
}

// The oldest successful receipt bounds freshness of the combined snapshot.
export function homeVerifiedAt(queries: readonly { isError: boolean; dataUpdatedAt: number }[]) {
  const receipts = queries
    .filter((query) => !query.isError && query.dataUpdatedAt > 0)
    .map((query) => query.dataUpdatedAt);
  return receipts.length ? Math.min(...receipts) : null;
}
