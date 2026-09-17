import { Temporal } from 'temporal-polyfill';

import type {
  WorkplaceBookingBatch,
  WorkplaceBookingBatchItemState,
  WorkplaceBookingCandidate,
  WorkplaceBookingHoldInput,
  WorkplaceBookingIntentItemInput,
  WorkplaceBookingIntentPreview,
  WorkplaceReservationHold,
  WorkplaceTeamPlacementConstraint,
  WorkplaceExploreResponse,
  WorkplaceResource,
} from '@dwp-frontend/shared-utils';
import type { WorkplacePlannerResourceType } from './workplace-planner-url-state';

export type WorkplacePlannerDaySummary = Readonly<{
  date: string;
  total: number;
  available: number;
  resources: readonly WorkplaceResource[];
}>;

export type WorkplacePlannerCollectionState =
  'PERMISSION_LOADING' | 'DENIED' | 'LOADING' | 'ERROR' | 'EMPTY' | 'DEGRADED' | 'READY';

export type WorkplacePlannerBeneficiary = Readonly<{
  userId: number;
  personPublicId: string | null;
  displayName: string;
  delegationGrantId: string | null;
}>;

export type WorkplacePlannerIntentBuildResult =
  | Readonly<{ ok: true; items: readonly WorkplaceBookingIntentItemInput[] }>
  | Readonly<{ ok: false; code: 'NO_BENEFICIARY' | 'INVALID_RANGE' | 'TOO_MANY_ITEMS' }>;

export const WORKPLACE_PLANNER_MAX_INTENT_ITEMS = 50;

export function workplacePlannerRange(
  date: string,
  start: string,
  durationMinutes: number,
  timeZone: string
) {
  try {
    const from = Temporal.PlainDateTime.from(`${date}T${start}`)
      .toZonedDateTime(timeZone)
      .toInstant();
    return {
      from: from.toString(),
      to: from.add({ minutes: durationMinutes }).toString(),
    } as const;
  } catch {
    return null;
  }
}

function availableResource(resource: WorkplaceResource, response: WorkplaceExploreResponse) {
  return (
    resource.state === 'AVAILABLE' &&
    resource.mode !== 'UNAVAILABLE' &&
    !response.occupancy.some((slot) => slot.resourceId === resource.resourceId) &&
    !(response.closures ?? []).some((closure) => closure.resourceId === resource.resourceId)
  );
}

export function summarizeWorkplacePlannerDay(
  date: string,
  response: WorkplaceExploreResponse,
  resourceTypes: readonly WorkplacePlannerResourceType[],
  siteId = '',
  floorId = ''
): WorkplacePlannerDaySummary {
  const selectedTypes = new Set(resourceTypes);
  const resources = response.resources.filter(
    (resource) =>
      selectedTypes.has(resource.type as WorkplacePlannerResourceType) &&
      (!siteId || resource.siteId === siteId) &&
      (!floorId || resource.floorId === floorId)
  );
  return {
    date,
    total: resources.length,
    available: resources.filter((resource) => availableResource(resource, response)).length,
    resources,
  };
}

export function resolveWorkplacePlannerCollectionState({
  permissionLoaded,
  canView,
  pendingCount,
  errorCount,
  successfulCount,
  totalResources,
}: {
  permissionLoaded: boolean;
  canView: boolean;
  pendingCount: number;
  errorCount: number;
  successfulCount: number;
  totalResources: number;
}): WorkplacePlannerCollectionState {
  if (!permissionLoaded) return 'PERMISSION_LOADING';
  if (!canView) return 'DENIED';
  if (pendingCount > 0 && successfulCount === 0) return 'LOADING';
  if (errorCount > 0 && successfulCount === 0) return 'ERROR';
  if (errorCount > 0) return 'DEGRADED';
  if (successfulCount > 0 && totalResources === 0) return 'EMPTY';
  return 'READY';
}

function intentItem({
  date,
  endDate = date,
  beneficiary,
  resourceType,
  start,
  durationMinutes,
  timeZone,
  siteId,
  floorId,
  purpose,
  accessibleOnly,
  requiredFeatures,
}: {
  date: string;
  endDate?: string;
  beneficiary: WorkplacePlannerBeneficiary;
  resourceType: WorkplacePlannerResourceType;
  start: string;
  durationMinutes: number;
  timeZone: string;
  siteId: string;
  floorId: string;
  purpose: string;
  accessibleOnly: boolean;
  requiredFeatures: readonly string[];
}): WorkplaceBookingIntentItemInput | null {
  const from = workplacePlannerRange(date, start, durationMinutes, timeZone);
  const to = workplacePlannerRange(endDate, start, durationMinutes, timeZone);
  if (!from || !to) return null;
  return {
    clientItemKey: `${date}:${beneficiary.userId}:${resourceType}`,
    beneficiaryUserId: beneficiary.userId,
    beneficiaryPersonPublicId: beneficiary.personPublicId,
    beneficiaryDisplayName: beneficiary.displayName,
    delegationGrantId: beneficiary.delegationGrantId,
    resourceType,
    preferredResourceId: null,
    siteId: siteId || null,
    floorId: floorId || null,
    startsAt: from.from,
    endsAt: to.to,
    purpose,
    visibleToColleagues: false,
    accessibleOnly,
    requiredFeatures,
  };
}

/**
 * A team plan deliberately models the package rather than multiplying every
 * resource by every person and day: desks are daily per beneficiary, parking
 * is daily for the lead traveller, and lockers span the week per beneficiary.
 * This preserves the server's 50-item atomic preview boundary for the common
 * five-person/five-day plan without silently dropping an item.
 */
export function buildWorkplacePlannerIntentItems({
  dates,
  beneficiaries,
  resourceTypes,
  start,
  durationMinutes,
  timeZone,
  siteId,
  floorId,
  purpose,
  accessibleOnly = false,
  requiredFeatures = [],
}: {
  dates: readonly string[];
  beneficiaries: readonly WorkplacePlannerBeneficiary[];
  resourceTypes: readonly WorkplacePlannerResourceType[];
  start: string;
  durationMinutes: number;
  timeZone: string;
  siteId: string;
  floorId: string;
  purpose: string;
  accessibleOnly?: boolean;
  requiredFeatures?: readonly string[];
}): WorkplacePlannerIntentBuildResult {
  if (beneficiaries.length === 0) return { ok: false, code: 'NO_BENEFICIARY' };
  const orderedDates = [...new Set(dates)].sort();
  if (orderedDates.length === 0) return { ok: false, code: 'INVALID_RANGE' };
  const items: WorkplaceBookingIntentItemInput[] = [];
  const add = (input: Parameters<typeof intentItem>[0]) => {
    const item = intentItem(input);
    if (item) items.push(item);
  };
  const common = {
    start,
    durationMinutes,
    timeZone,
    siteId,
    floorId,
    purpose,
    accessibleOnly,
    requiredFeatures,
  };

  if (resourceTypes.includes('DESK')) {
    for (const date of orderedDates) {
      for (const beneficiary of beneficiaries) {
        add({ ...common, date, beneficiary, resourceType: 'DESK' });
      }
    }
  }
  if (resourceTypes.includes('PARKING')) {
    const lead = beneficiaries[0];
    for (const date of orderedDates) {
      add({ ...common, date, beneficiary: lead, resourceType: 'PARKING' });
    }
  }
  if (resourceTypes.includes('LOCKER')) {
    for (const beneficiary of beneficiaries) {
      add({
        ...common,
        date: orderedDates[0],
        endDate: orderedDates.at(-1),
        beneficiary,
        resourceType: 'LOCKER',
      });
    }
  }

  if (items.length === 0) return { ok: false, code: 'INVALID_RANGE' };
  if (items.length > WORKPLACE_PLANNER_MAX_INTENT_ITEMS) {
    return { ok: false, code: 'TOO_MANY_ITEMS' };
  }
  return { ok: true, items };
}

export function buildWorkplacePlannerTeamConstraints({
  items,
  enabled,
  sameNeighborhood,
  adjacentSeats,
  minimumDistanceMeters,
  maximumDistanceMeters,
}: {
  items: readonly WorkplaceBookingIntentItemInput[];
  enabled: boolean;
  sameNeighborhood: boolean;
  adjacentSeats: boolean;
  minimumDistanceMeters: number | null;
  maximumDistanceMeters: number | null;
}): readonly WorkplaceTeamPlacementConstraint[] {
  if (!enabled) return [];
  const desksByDate = new Map<string, string[]>();
  for (const item of items) {
    if (item.resourceType !== 'DESK') continue;
    const date = item.startsAt.slice(0, 10);
    desksByDate.set(date, [...(desksByDate.get(date) ?? []), item.clientItemKey]);
  }
  return [...desksByDate.entries()].flatMap(([date, clientItemKeys]) =>
    clientItemKeys.length < 2
      ? []
      : [
          {
            groupKey: `${date}:TEAM_DESKS`,
            clientItemKeys,
            sameNeighborhood,
            adjacentSeats,
            minimumDistanceMeters,
            maximumDistanceMeters,
          },
        ]
  );
}

export function defaultWorkplacePlannerCandidateSelections(
  preview: WorkplaceBookingIntentPreview,
  current: Readonly<Record<string, string>> = {}
) {
  return Object.fromEntries(
    preview.items.flatMap((item) => {
      const retained = item.candidates.some(
        (candidate) => candidate.resourceId === current[item.intentItemId]
      )
        ? current[item.intentItemId]
        : null;
      const candidate =
        retained ??
        item.candidates.find((entry) => entry.preferred)?.resourceId ??
        item.candidates[0]?.resourceId;
      return candidate ? [[item.intentItemId, candidate]] : [];
    })
  );
}

export function buildWorkplacePlannerHoldRequest(
  preview: WorkplaceBookingIntentPreview,
  selections: Readonly<Record<string, string>>,
  reason: string
): WorkplaceBookingHoldInput | null {
  const selectedItems = preview.items.filter(
    (item) => item.decision === 'AVAILABLE' || item.decision === 'ALTERNATIVES_AVAILABLE'
  );
  const resolved = selectedItems.flatMap((item) => {
    const resourceId = selections[item.intentItemId];
    const candidate = item.candidates.find((entry) => entry.resourceId === resourceId);
    return candidate
      ? [
          {
            intentItemId: item.intentItemId,
            resourceId: candidate.resourceId,
            expectedItemVersion: item.version,
            expectedResourceVersion: candidate.resourceVersion,
          },
        ]
      : [];
  });
  if (resolved.length === 0 || resolved.length !== selectedItems.length) return null;
  return {
    expectedIntentVersion: preview.version,
    selections: resolved,
    reason,
    explicitConfirmation: true,
  };
}

export function workplacePlannerHoldSecondsRemaining(
  holds: readonly WorkplaceReservationHold[],
  serverTime: string,
  elapsedMilliseconds = 0
) {
  const active = holds.filter((hold) => hold.state === 'ACTIVE');
  if (active.length === 0) return 0;
  const authoritativeNow = Date.parse(serverTime) + Math.max(0, elapsedMilliseconds);
  const earliestExpiry = Math.min(...active.map((hold) => Date.parse(hold.expiresAt)));
  if (!Number.isFinite(authoritativeNow) || !Number.isFinite(earliestExpiry)) return 0;
  return Math.max(0, Math.ceil((earliestExpiry - authoritativeNow) / 1_000));
}

export function workplacePlannerOfferSecondsRemaining(
  expiresAt: string,
  serverTime: string,
  elapsedSinceServerSnapshotMs: number
) {
  const expiry = Date.parse(expiresAt);
  const server = Date.parse(serverTime);
  if (!Number.isFinite(expiry) || !Number.isFinite(server)) return 0;
  return Math.max(
    0,
    Math.ceil((expiry - server - Math.max(0, elapsedSinceServerSnapshotMs)) / 1_000)
  );
}

export function workplacePlannerBatchCounts(batch: WorkplaceBookingBatch) {
  const initial: Record<WorkplaceBookingBatchItemState, number> = {
    PENDING: 0,
    PROCESSING: 0,
    SUCCEEDED: 0,
    FAILED: 0,
    RESULT_UNKNOWN: 0,
    COMPENSATION_PENDING: 0,
    COMPENSATED: 0,
    COMPENSATION_FAILED: 0,
  };
  for (const item of batch.items) initial[item.state] += 1;
  return initial;
}

export function shouldPollWorkplacePlannerBatch(batch: WorkplaceBookingBatch | undefined) {
  if (!batch) return false;
  return (
    !batch.terminal || batch.requeryRequired || batch.items.some((item) => item.requeryRequired)
  );
}

export function candidateById(
  candidates: readonly WorkplaceBookingCandidate[],
  resourceId: string | undefined
) {
  return candidates.find((candidate) => candidate.resourceId === resourceId) ?? null;
}
