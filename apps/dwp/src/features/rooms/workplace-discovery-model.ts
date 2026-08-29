import { workplaceResourceAvailability } from './workplace-floor-plan';
import { validateRoomBookingRange } from './room-availability-model';
import { validateWorkplaceBookingRange } from './workplace-time-policy';

import type {
  CalendarPolicy,
  WorkplaceOccupancy,
  WorkplacePolicy,
  WorkplaceResource,
  WorkplaceResourceType,
} from '@dwp-frontend/shared-utils';

export type WorkplaceDiscoverySort = 'availability' | 'name' | 'capacity';

export type WorkplaceDiscoveryFilters = {
  search: string;
  type: WorkplaceResourceType | 'ALL';
  feature: string;
  neighborhood: string;
  accessibleOnly: boolean;
  sort: WorkplaceDiscoverySort;
};

export type WorkplaceBookabilityContext = {
  canCreateRoomBooking: boolean;
  canCreateWorkplaceBooking: boolean;
  occupancy: readonly WorkplaceOccupancy[];
  rangeFrom: string | null;
  rangeTo: string | null;
  roomPolicy: CalendarPolicy | null;
  roomPolicyReady: boolean;
  serverNow: string;
  timeZone: string | null;
  verified: boolean;
  workplacePolicy: WorkplacePolicy | null;
};

export type WorkplaceBookingBlockCode =
  | 'UNVERIFIED'
  | 'UNAVAILABLE'
  | 'READ_ONLY'
  | 'ROOM_POLICY'
  | 'ROOM_BINDING'
  | 'ASSIGNED'
  | 'DROP_IN'
  | 'POLICY_RANGE';

const RESOURCE_TYPES = new Set<WorkplaceResourceType>([
  'ROOM',
  'DESK',
  'LOCKER',
  'PARKING',
  'FOCUS_POD',
  'PHONE_BOOTH',
  'EQUIPMENT',
]);

const SORTS = new Set<WorkplaceDiscoverySort>(['availability', 'name', 'capacity']);

export function workplaceDiscoveryType(value: string | null): WorkplaceResourceType | 'ALL' {
  return value && RESOURCE_TYPES.has(value as WorkplaceResourceType)
    ? (value as WorkplaceResourceType)
    : 'ALL';
}

export function workplaceDiscoverySort(value: string | null): WorkplaceDiscoverySort {
  return value && SORTS.has(value as WorkplaceDiscoverySort)
    ? (value as WorkplaceDiscoverySort)
    : 'availability';
}

export function workplaceBookingBlockCode(
  resource: WorkplaceResource,
  context: WorkplaceBookabilityContext
): WorkplaceBookingBlockCode | null {
  if (!context.verified || !context.rangeFrom || !context.rangeTo || !context.timeZone) {
    return 'UNVERIFIED';
  }
  const availability = workplaceResourceAvailability(resource, context.occupancy);
  if (['OCCUPIED', 'UNAVAILABLE', 'MINE'].includes(availability)) return 'UNAVAILABLE';
  const canCreateBooking =
    resource.type === 'ROOM' ? context.canCreateRoomBooking : context.canCreateWorkplaceBooking;
  if (!canCreateBooking) {
    return 'READ_ONLY';
  }
  if (resource.type === 'ROOM' && (!context.roomPolicyReady || !context.roomPolicy)) {
    return 'ROOM_POLICY';
  }
  if (resource.type === 'ROOM' && !resource.calendarResourceId) return 'ROOM_BINDING';
  if (resource.mode === 'ASSIGNED' && !resource.assignedToCurrentUser) return 'ASSIGNED';
  if (
    resource.mode === 'DROP_IN' &&
    Date.parse(context.rangeFrom) > Date.parse(context.serverNow) + 15 * 60_000
  ) {
    return 'DROP_IN';
  }
  const rangeError =
    resource.type === 'ROOM'
      ? validateRoomBookingRange(
          context.rangeFrom,
          context.rangeTo,
          context.timeZone,
          context.roomPolicy!,
          context.serverNow
        )
      : context.workplacePolicy
        ? validateWorkplaceBookingRange(
            context.rangeFrom,
            context.rangeTo,
            context.timeZone,
            context.workplacePolicy,
            context.serverNow
          )
        : 'invalid';
  if (rangeError) return 'POLICY_RANGE';
  return null;
}

export function workplaceRelocationCandidates(
  resources: readonly WorkplaceResource[],
  resourceType: WorkplaceResourceType | null | undefined,
  context: WorkplaceBookabilityContext
) {
  if (!resourceType) return [];
  return resources.filter(
    (resource) =>
      resource.type === resourceType && workplaceBookingBlockCode(resource, context) === null
  );
}

export function filterWorkplaceResources(
  resources: readonly WorkplaceResource[],
  occupancy: readonly WorkplaceOccupancy[],
  filters: WorkplaceDiscoveryFilters,
  bookability?: WorkplaceBookabilityContext
): WorkplaceResource[] {
  const keyword = filters.search.trim().toLocaleLowerCase();
  const availabilityOrder = {
    AVAILABLE: 0,
    DROP_IN: 1,
    MINE: 2,
    ASSIGNED: 3,
    OCCUPIED: 4,
    UNAVAILABLE: 5,
  } as const;

  return resources
    .filter(
      (resource) =>
        (filters.type === 'ALL' || resource.type === filters.type) &&
        (!filters.feature || resource.features.includes(filters.feature)) &&
        (!filters.neighborhood || resource.neighborhood === filters.neighborhood) &&
        (!filters.accessibleOnly || resource.accessible) &&
        (!keyword ||
          [resource.name, resource.code, resource.neighborhood, ...resource.features]
            .filter(Boolean)
            .some((value) => String(value).toLocaleLowerCase().includes(keyword)))
    )
    .sort((left, right) => {
      if (filters.sort === 'name') return left.name.localeCompare(right.name);
      if (filters.sort === 'capacity') {
        return right.capacity - left.capacity || left.name.localeCompare(right.name);
      }
      if (bookability) {
        const eligibility =
          Number(Boolean(workplaceBookingBlockCode(left, bookability))) -
          Number(Boolean(workplaceBookingBlockCode(right, bookability)));
        if (eligibility) return eligibility;
      }
      const leftRank = availabilityOrder[workplaceResourceAvailability(left, occupancy)];
      const rightRank = availabilityOrder[workplaceResourceAvailability(right, occupancy)];
      return leftRank - rightRank || left.name.localeCompare(right.name);
    });
}
