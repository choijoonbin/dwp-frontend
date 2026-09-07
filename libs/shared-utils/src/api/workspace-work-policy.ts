import type { WorkspaceWorkItem } from './workspace-api';

export type WorkspaceWorkReference = Pick<WorkspaceWorkItem, 'id' | 'type' | 'sourceSystem'> &
  Partial<Pick<WorkspaceWorkItem, 'sourceReference'>>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

/** Opaque owner references must survive every Home, AI and queue entry point. */
export function workspaceWorkItemReference(item: WorkspaceWorkReference): string | null {
  if (item.type === 'Review' || item.sourceSystem === 'IDENTITY_GOVERNANCE') {
    const reference = item.sourceReference?.trim();
    return item.type === 'Review' &&
      item.sourceSystem === 'IDENTITY_GOVERNANCE' &&
      reference &&
      UUID_PATTERN.test(reference)
      ? reference
      : null;
  }
  return item.id;
}

export function workspaceWorkItemRoute(item: WorkspaceWorkReference): string {
  const reference = workspaceWorkItemReference(item);
  return reference ? `/work/queue?item=${encodeURIComponent(reference)}` : '/work/queue';
}

/**
 * Native Workspace tasks are the only Work projections currently covered by
 * the common Activity ledger. Approvals, service requests, reviews and other
 * source-owned projections must keep using their owning application's history.
 */
export function workspaceWorkActivityRoute(
  item: Pick<WorkspaceWorkItem, 'workItemId' | 'type' | 'sourceSystem'>
): string | null {
  if (
    item.type !== 'Task' ||
    !['WORKSPACE', 'DWP_WORKSPACE'].includes(item.sourceSystem) ||
    !UUID_PATTERN.test(item.workItemId)
  ) {
    return null;
  }
  const params = new URLSearchParams({
    objectType: 'WORK_ITEM',
    objectId: item.workItemId,
  });
  return `/activity/timeline?${params.toString()}`;
}

export function workspaceWorkSourceRoute(
  item: Pick<WorkspaceWorkItem, 'sourceRoute'>
): string | null {
  const route = item.sourceRoute;
  return route?.startsWith('/') && !route.startsWith('//') && !/[\\\r\n]/u.test(route)
    ? route
    : null;
}

export function canChangeWorkspaceWorkStatus(
  item: WorkspaceWorkItem,
  target: 'IN_PROGRESS' | 'WAITING' | 'COMPLETED'
): boolean {
  // A projected approval, request or required acknowledgement belongs to its source app.
  if (
    item.type !== 'Task' ||
    !['WORKSPACE', 'DWP_WORKSPACE'].includes(item.sourceSystem) ||
    ['completed', 'cancelled', 'archived'].includes(item.status)
  ) {
    return false;
  }
  if (target === 'IN_PROGRESS')
    return item.status !== 'in-progress' && item.capabilities?.canStart === true;
  if (target === 'WAITING') return item.status !== 'waiting' && item.capabilities?.canWait === true;
  return item.capabilities?.canComplete === true;
}

function dueTimestamp(value: string | null | undefined): number {
  const timestamp = value ? Date.parse(value) : NaN;
  return Number.isFinite(timestamp) ? timestamp : Infinity;
}

export function rankWorkspaceWorkItems(items: readonly WorkspaceWorkItem[]): WorkspaceWorkItem[] {
  const priorityOrder = { high: 0, medium: 1, low: 2 } as const;
  return items
    .filter((item) => !['completed', 'cancelled', 'archived'].includes(item.status))
    .sort((left, right) => {
      const priority = priorityOrder[left.priority] - priorityOrder[right.priority];
      if (priority) return priority;
      const leftDue = dueTimestamp(left.dueAt);
      const rightDue = dueTimestamp(right.dueAt);
      if (leftDue !== rightDue) return leftDue < rightDue ? -1 : 1;
      const updated = Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
      if (Number.isFinite(updated) && updated !== 0) return updated;
      return left.workItemId.localeCompare(right.workItemId);
    });
}

export function workspaceWorkFreshness(input: {
  generatedAt?: string;
  isFetching: boolean;
  isError: boolean;
  now: number;
}): 'live' | 'syncing' | 'stale' | 'degraded' {
  if (input.isError) return 'degraded';
  if (input.isFetching) return 'syncing';
  const generatedAt = input.generatedAt ? Date.parse(input.generatedAt) : NaN;
  return !Number.isFinite(generatedAt) ||
    generatedAt > input.now + 60_000 ||
    input.now - generatedAt > 5 * 60_000
    ? 'stale'
    : 'live';
}
