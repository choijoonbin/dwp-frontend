import {
  isAppPermissionEntitled,
  type AppEntitlementPermission,
} from '@dwp-frontend/shared-utils/auth/app-entitlements';
import type {
  WorkHubActionKind,
  WorkHubItem,
  WorkHubSnapshot,
  WorkHubSourceId,
} from './work-hub-contracts';
import type {
  PersonalWorkTaskInput,
  WorkSourceReference,
} from '@dwp-frontend/shared-utils/api/personal-work-contracts';

export type WorkHubGenericAdjunct =
  'AI' | 'ACTIVITY' | 'BATCH' | 'CALENDAR' | 'DAY_PLAN' | 'PERSONAL_TASK_SOURCE';

export function isWorkAssignmentReference(reference: WorkSourceReference): boolean {
  return reference.sourceSystem === 'WORK_ASSIGNMENT';
}

/** The assignment API is not registered with the generic owner/source resolvers. */
export function canUseWorkHubGenericAdjunct(
  item: Pick<WorkHubItem, 'reference'>,
  _adjunct: WorkHubGenericAdjunct
): boolean {
  return !isWorkAssignmentReference(item.reference);
}

export function personalTaskInputUsesUnsupportedSource(input: PersonalWorkTaskInput): boolean {
  return Boolean(
    (input.sourceReference && isWorkAssignmentReference(input.sourceReference)) ||
    input.sourceReferences?.some(isWorkAssignmentReference)
  );
}

const mutatingActions = new Set<WorkHubActionKind>([
  'WORKSPACE_START',
  'WORKSPACE_COMPLETE',
  'ACCESS_REVIEW_DECIDE',
  'PERSONAL_START',
  'PERSONAL_WAIT',
  'PERSONAL_COMPLETE',
  'PERSONAL_REOPEN',
  'PERSONAL_ARCHIVE',
]);

export function canUpdatePersonalWork(permissions: readonly AppEntitlementPermission[]): boolean {
  return isAppPermissionEntitled('APP.WORK', 'UPDATE', permissions);
}

export function isMutatingWorkHubAction(kind: WorkHubActionKind): boolean {
  return mutatingActions.has(kind);
}

/**
 * A PARTIAL snapshot may still carry current rows from a READY source. UNAVAILABLE may retain
 * previously verified rows for recovery context, so it never authorizes a new command.
 */
export function isWorkHubSourceCommandReady(
  snapshot: WorkHubSnapshot | null | undefined,
  sourceId: WorkHubSourceId
): boolean {
  if (!snapshot || snapshot.completeness === 'UNAVAILABLE') return false;
  const sources = snapshot.sources.filter((candidate) => candidate.sourceId === sourceId);
  return sources.length === 1 && sources[0]!.state === 'READY' && sources[0]!.receivedAt !== null;
}

function matchesReviewedWorkHubItem(candidate: WorkHubItem, reviewed: WorkHubItem) {
  return (
    candidate.sourceId === reviewed.sourceId &&
    candidate.key === reviewed.key &&
    candidate.reference.sourceSystem === reviewed.reference.sourceSystem &&
    candidate.reference.sourceReference === reviewed.reference.sourceReference &&
    (candidate.reference.obligationKey ?? null) === (reviewed.reference.obligationKey ?? null) &&
    candidate.version === reviewed.version &&
    candidate.lifecycle === reviewed.lifecycle &&
    candidate.sourceStatus === reviewed.sourceStatus
  );
}

/** Stable primitive identity for crossing a feature boundary without leaking Work Hub types. */
export function workHubCommandScope(item: WorkHubItem): string {
  return JSON.stringify([
    item.sourceId,
    item.key,
    item.reference.sourceSystem,
    item.reference.sourceReference,
    item.reference.obligationKey ?? null,
    item.version,
    item.lifecycle,
    item.sourceStatus,
  ]);
}

/** Binds a reviewed row to the exact version and lifecycle returned by its READY source. */
export function isWorkHubItemCommandReady(
  snapshot: WorkHubSnapshot | null | undefined,
  reviewed: WorkHubItem
): boolean {
  if (!isWorkHubSourceCommandReady(snapshot, reviewed.sourceId)) return false;
  const source = snapshot!.sources.find((candidate) => candidate.sourceId === reviewed.sourceId)!;
  const sourceItems = source.items.filter((candidate) => candidate.key === reviewed.key);
  const aggregateItems = snapshot!.items.filter((candidate) => candidate.key === reviewed.key);
  return (
    sourceItems.length === 1 &&
    aggregateItems.length === 1 &&
    matchesReviewedWorkHubItem(sourceItems[0]!, reviewed) &&
    matchesReviewedWorkHubItem(aggregateItems[0]!, reviewed)
  );
}

/** Requires both personal-link authority and the exact selected row from its READY source. */
export function canUnlinkWorkSchedule(
  snapshot: WorkHubSnapshot | null | undefined,
  reviewed: WorkHubItem
): boolean {
  return (
    canUseWorkHubGenericAdjunct(reviewed, 'CALENDAR') &&
    isWorkHubSourceCommandReady(snapshot, 'personal') &&
    isWorkHubItemCommandReady(snapshot, reviewed)
  );
}

export function canExecuteWorkHubAction(
  snapshot: WorkHubSnapshot | null | undefined,
  reviewed: WorkHubItem,
  kind: WorkHubActionKind
): boolean {
  if (!isMutatingWorkHubAction(kind)) return kind === 'OPEN_SOURCE';
  if (!isWorkHubItemCommandReady(snapshot, reviewed)) return false;
  const current = snapshot!.items.find((candidate) => candidate.key === reviewed.key)!;
  const sourceItem = snapshot!.sources
    .find((source) => source.sourceId === reviewed.sourceId)!
    .items.find((candidate) => candidate.key === reviewed.key)!;
  return [current, sourceItem].every((candidate) =>
    candidate.actions.some(
      (action) =>
        action.kind === kind &&
        (action.availability === 'AVAILABLE' ||
          (kind === 'ACCESS_REVIEW_DECIDE' && action.availability === 'DETAIL_REQUIRED'))
    )
  );
}
