import type { WorkspaceWorkItem } from '@dwp-frontend/shared-utils/api/workspace-api';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export type WorkQueueDispatch =
  | { kind: 'workspace'; item: WorkspaceWorkItem }
  | { kind: 'access-review'; item: WorkspaceWorkItem; workItemRef: string }
  | { kind: 'unavailable' };

function isIdentityReview(item: WorkspaceWorkItem): boolean {
  return item.type === 'Review' || item.sourceSystem === 'IDENTITY_GOVERNANCE';
}

export function selectWorkspaceWorkItem(
  items: readonly WorkspaceWorkItem[],
  requestedItemRef: string | null
): WorkspaceWorkItem | undefined {
  if (!requestedItemRef) return items[0];
  return items.find((item) =>
    isIdentityReview(item)
      ? item.sourceReference === requestedItemRef
      : item.id === requestedItemRef || item.workItemId === requestedItemRef
  );
}

export function dispatchWorkspaceWorkItem(item: WorkspaceWorkItem | undefined): WorkQueueDispatch {
  if (!item) return { kind: 'unavailable' };
  if (!isIdentityReview(item)) return { kind: 'workspace', item };
  const workItemRef = item.sourceReference?.trim();
  if (
    item.type !== 'Review' ||
    item.sourceSystem !== 'IDENTITY_GOVERNANCE' ||
    !workItemRef ||
    !UUID_PATTERN.test(workItemRef)
  ) {
    return { kind: 'unavailable' };
  }
  return { kind: 'access-review', item, workItemRef };
}
